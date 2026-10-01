'use strict';
// The ladder's rules, with no files and no processes: who plays whom, what a
// result does to two ratings, and the record a match leaves. Pure functions
// over plain JSON, so the offline ladder (ladder.js, files on this computer)
// and an online one later (a server and a database) share every rule.

const RATING_START = 1000; // every new entry
const RATING_K = 32;       // Elo step: how far one result moves a rating
const PAIR_SPREAD = 4;     // the opponent is picked from this many nearest in rating

// a small seeded random, so a ladder's pairings and seeds replay from its count
function rngOf(n) {
  let s = (n * 2654435761 + 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a usable entry id: short, plain, and never a name every object already has
// ('constructor', '__proto__'), which would read as an entry that is there
function idOk(id) { return /^[a-z0-9_-]{1,40}$/.test(id) && !(id in Object.prototype); }

function newEntry(id, meta) {
  return Object.assign({ id, name: id, author: '', version: '', hash: '', rev: 1, from: 'file',
    rating: RATING_START, games: 0, w: 0, l: 0, d: 0, added: new Date().toISOString() }, meta || {});
}

// the chance a beats b, and both ratings after a result (sa: 1 win, 0.5 draw, 0 loss)
function expected(ra, rb) { return 1 / (1 + Math.pow(10, (rb - ra) / 400)); }
function rate(ra, rb, sa) {
  const ea = expected(ra, rb), d = RATING_K * (sa - ea);
  return [Math.round((ra + d) * 10) / 10, Math.round((rb - d) * 10) / 10];
}

// the next `count` matches: the entry with the fewest games first, against one
// of the PAIR_SPREAD nearest to it in rating (never itself while there is
// anyone else), on a fresh seed and shape, sides alternating by the match number
function pairings(ladder, count, shapes) {
  const ids = Object.keys(ladder.entries).filter((id) => !ladder.entries[id].retired && !ladder.entries[id].missing);
  if (!ids.length) return [];
  const games = Object.fromEntries(ids.map((id) => [id, ladder.entries[id].games]));
  const out = [];
  for (let k = 0; k < count; k++) {
    const n = ladder.n + k, rnd = rngOf(n);
    ids.sort((x, y) => games[x] - games[y] || (rnd() < 0.5 ? -1 : 1));
    const a = ids[0], ra = ladder.entries[a].rating;
    const rest = ids.length > 1 ? ids.filter((id) => id !== a) : [a];
    rest.sort((x, y) => Math.abs(ladder.entries[x].rating - ra) - Math.abs(ladder.entries[y].rating - ra));
    const b = rest[Math.floor(rnd() * Math.min(PAIR_SPREAD, rest.length))];
    games[a]++; games[b]++;
    const swap = n % 2 === 1; // a takes team 1 on odd matches
    out.push({ n, id: 'L' + String(n + 1).padStart(5, '0'), team0: swap ? b : a, team1: swap ? a : b,
      seed: 1 + Math.floor(rnd() * 999999), shape: Math.floor(rnd() * shapes) });
  }
  return out;
}

// the five seats of each side: seat i is on team i % 2 (the roster's rule)
function seatsOf(m) {
  const seats = {};
  for (let i = 0; i < 10; i++) seats[i] = i % 2 === 0 ? m.team0 : m.team1;
  return seats;
}

// fold a finished match's arena log into the ladder; returns the history record
function applyResult(ladder, m, log, logPath) {
  let r = log.result || {};
  // a side whose sandbox died (out of memory: app/arena/sandbox.js) cannot
  // turn a loss into a draw or a void match by crashing: the match is the
  // other side's, unless the crashed side won it outright anyway
  const dead = [0, 1].map((t) => (log.seats || []).some((q) => q.id % 2 === t && q.dead));
  if (dead[0] !== dead[1] && r.winner !== (dead[0] ? 0 : 1)) r = Object.assign({}, r, { winner: dead[0] ? 1 : 0, reason: 'forfeit' });
  const A = ladder.entries[m.team0], B = ladder.entries[m.team1];
  const error = r.reason === 'error';
  const winner = r.winner === 0 ? m.team0 : r.winner === 1 ? m.team1 : null;
  const before = [A.rating, B.rating];
  const self = m.team0 === m.team1;
  if (!error && !self) {
    const sa = r.winner === 0 ? 1 : r.winner === 1 ? 0 : 0.5;
    [A.rating, B.rating] = rate(A.rating, B.rating, sa);
    if (sa === 1) { A.w++; B.l++; } else if (sa === 0) { A.l++; B.w++; } else { A.d++; B.d++; }
    A.games++; B.games++;
  }
  const side = (team) => {
    const t = { kills: 0, deaths: 0, dmg: 0, siege: 0, gold: 0 };
    for (const p of log.players || []) if (p.id % 2 === team) for (const k in t) t[k] += p[k] || 0;
    const e = log.samples && log.samples.length ? log.samples[log.samples.length - 1].eagles[team] : null;
    t.bird = e ? Math.round(100 * e[0] / e[1]) : null; // the bird's nerve left at the end, %
    // the bot file's health (log.seats, the arena): how often it threw, out of how many thinks
    t.errors = 0; t.thinks = 0;
    for (const q of log.seats || []) if (q.id % 2 === team) { t.errors += q.errors || 0; t.thinks += q.thinks || 0; }
    return t;
  };
  return {
    v: 1, id: m.id, date: new Date().toISOString(), api: 1, patch: log.patch || null,
    seed: m.seed, shape: m.shape, shapeName: log.shapeName || null,
    team0: { id: m.team0, rev: A.rev, before: before[0], after: A.rating, stats: side(0) },
    team1: { id: m.team1, rev: B.rev, before: before[1], after: B.rating, stats: side(1) },
    winner, reason: r.reason || 'error', time: r.time || 0, ticks: r.ticks || 0, error: r.error || null,
    rated: !error && !self, fun: log.fun ? log.fun.score : null, log: logPath,
  };
}

// the standings, best first, with what the history says about each entry:
// win share (a draw counts half), mean fun score and match length, kills per
// death, the rating after each match (trail) and its peak, the last five
// results (form, newest last), its record against every other entry (vs), and
// how often its code threw (errors, out of thinks)
function standings(ladder, history) {
  const rows = Object.values(ladder.entries).map((e) => {
    const mine = history.filter((h) => h.team0.id === e.id || h.team1.id === e.id);
    const rated = mine.filter((h) => h.rated);
    const fun = mine.filter((h) => h.fun != null);
    const len = mine.filter((h) => h.reason === 'eagle');
    let k = 0, dth = 0, errors = 0, thinks = 0;
    const vs = {};
    for (const h of mine) {
      const me = h.team0.id === e.id ? h.team0 : h.team1, them = h.team0.id === e.id ? h.team1 : h.team0;
      k += me.stats.kills; dth += me.stats.deaths;
      errors += me.stats.errors || 0; thinks += me.stats.thinks || 0;
      if (!h.rated) continue;
      const v = vs[them.id] || (vs[them.id] = { w: 0, l: 0, d: 0 });
      if (h.winner === e.id) v.w++; else if (h.winner === them.id) v.l++; else v.d++;
    }
    const trail = rated.map((h) => (h.team0.id === e.id ? h.team0.after : h.team1.after));
    const last = rated[rated.length - 1];
    return Object.assign({}, e, {
      winPct: e.games ? Math.round(100 * (e.w + e.d / 2) / e.games) : null,
      fun: fun.length ? Math.round(fun.reduce((a, h) => a + h.fun, 0) / fun.length) : null,
      avgMin: len.length ? Math.round(len.reduce((a, h) => a + h.time, 0) / len.length / 6) / 10 : null,
      kd: dth ? Math.round(10 * k / dth) / 10 : k || null,
      trail,
      peak: trail.length ? Math.max(RATING_START, ...trail) : RATING_START,
      delta: last ? Math.round(10 * ((last.team0.id === e.id ? last.team0 : last.team1).after - (last.team0.id === e.id ? last.team0 : last.team1).before)) / 10 : null,
      form: rated.slice(-5).map((h) => (h.winner === e.id ? 'W' : h.winner ? 'L' : 'D')),
      vs, errors, thinks,
    });
  });
  rows.sort((x, y) => !!x.retired - !!y.retired || y.rating - x.rating || y.games - x.games);
  return rows;
}

module.exports = { RATING_START, RATING_K, PAIR_SPREAD, rngOf, idOk, newEntry, expected, rate, pairings, seatsOf, applyResult, standings };
