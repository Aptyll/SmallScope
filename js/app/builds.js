'use strict';
// ------------------------------------------------------------ builds
// THE META, League's recommended builds made from real matches: which items
// people finish on each hero, in what order, and how often that wins.
//
// There is no stats server. Every screen keeps the builds of the matches it
// saw (PROFILE.builds, js/app/profile.js), and every time a guest joins a
// host the two swap what they know (the 'meta' message, js/net/net.js) - so a
// record spreads through every lobby its players ever sit in, and the shop's
// numbers grow from the whole community rather than one machine. A record is
// keyed by its match and seat (buildsKey), so a match heard from nine
// screens still counts once.
//
// What a record holds: one HUMAN seat's hero, its finished items in the order
// they were bought (`p.buys`: legendaries and boots, buyItem,
// js/sim/items.js), whether its side won, and the patch it was played on.
// Bots are left out: they buy their curated list (BOT_BUILDS), so counting
// them would only echo the list back. Practice and 1V1 are not the 5v5's
// meta, and are left out too.
//
// The shop reads it through buildsStats (one hero's pick and win rates) and
// buildsRec (the RECOMMENDED tab's rows). While a hero has fewer than
// BUILDS_MIN games, the curated list stands in. Nothing in the sim reads any
// of this (CLAUDE.md rule 2): a bot's buys never depend on what one machine
// has heard.
const BUILDS_KEEP = 3000;  // records a screen keeps, newest first out of the door last
const BUILDS_SEND = 1200;  // the newest this many go to the other end of a join
const BUILDS_HERO = 400;   // the newest this many of a hero's records make its numbers
const BUILDS_MIN = 10;     // a hero's games before its numbers replace the curated build
const BUILDS_PATH_MIN = 4; // games a path needs before its win rate can rank it
const BUILDS_ITEMS = 8;    // finished items a record keeps (six slots, and what was sold on the way)
const BUILDS_TAKE = 200;   // new records one join may bring in: a forger has to sit in a lobby per 200
const BUILDS_T_MAX = 90;   // a match's minutes a record may claim
const BUILDS_GOLD = 600, BUILDS_GOLD_MIN = 1500; // the most gold a build can have cost: the start, then this much a minute (a laner earns about half of it)

// one record, as kept and as sent: { m: match, s: seat, v: patch, h: hero,
// w: won 1/0, q: both sides had a person 1/0, t: the match's whole minutes,
// b: [item ids] }
function buildsKey(r) { return r.m + ':' + r.s; }
// a record off the wire or out of storage, checked field by field: anything
// malformed or impossible is dropped whole, never half-read. Impossible: a
// build dearer than the match's minutes could have paid for, more than two
// pairs of boots, an item three times over. It cannot stop a careful liar
// (there is no server to ask), but it keeps a hand-edited record from being
// anything a real match could not have been.
function buildsClean(r) {
  if (!r || typeof r !== 'object' || typeof r.m !== 'string' || !/^[0-9a-f]{8}$/.test(r.m)) return null;
  if (!(r.s >= 0 && r.s < MAX_PLAYERS && (r.s | 0) === r.s) || typeof r.v !== 'string' || r.v.length > 8) return null;
  if (!CLASSES.some((c) => c.name === r.h) || (r.w !== 0 && r.w !== 1) || (r.q !== 0 && r.q !== 1)) return null;
  if (!Array.isArray(r.b) || !r.b.length || r.b.length > BUILDS_ITEMS) return null;
  if (!r.b.every((id) => typeof id === 'string' && Object.hasOwn(BUILD_ITEMS, id) && itemFinished(id))) return null;
  if (!/^\d\.\d{3}$/.test(r.v) || !(r.t >= 1 && r.t <= BUILDS_T_MAX && (r.t | 0) === r.t)) return null;
  if (r.b.filter(isBoots).length > 2 || r.b.some((id) => r.b.filter((q) => q === id).length > 2)) return null;
  if (r.b.reduce((g, id) => g + BUILD_ITEMS[id].price, 0) > BUILDS_GOLD + BUILDS_GOLD_MIN * r.t) return null;
  return { m: r.m, s: r.s, v: r.v, h: r.h, w: r.w, q: r.q, t: r.t, b: r.b.slice() };
}
// FNV-1a over a string: a match's id, from what every screen of it agrees on
function buildsHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// A match ends (endMatch, js/sim/player.js; once, on its first win or loss):
// note every human seat. `won` is the local side's result. The match's id is
// cut from what every screen of it shares at the whistle - the seed, the
// seats, the people's names, every hero and every build - so the host and each guest file the
// same record under the same key.
function buildsNote(won) {
  if (PRACTICE || state.onevone) return 0;
  const winner = won ? player.team : 1 - player.team;
  const seats = players.filter((p) => p.active && isHuman(p) && p.buys && p.buys.length);
  if (!seats.length) return 0;
  const both = [0, 1].every((t) => players.some((p) => p.active && isHuman(p) && p.team === t)) ? 1 : 0;
  // (a bot's name is left out: each screen calls the bots by its own side's colours)
  const m = buildsHash(SEED + '|' + players.map((p) => p.active ? p.id + (isHuman(p) ? p.name : '') + CLASSES[p.cls].name + p.team + (p.buys || []).join(',') : '').join('|'));
  const v = PATCH_TXT.replace(/^PATCH /, ''), t = Math.max(1, Math.min(BUILDS_T_MAX, Math.ceil(state.elapsed / 60)));
  return buildsMerge(seats.map((p) => ({ m, s: p.id, v, h: CLASSES[p.cls].name, w: p.team === winner ? 1 : 0, q: both, t, b: p.buys.slice(0, BUILDS_ITEMS) })));
}
// records in (a match's own, or a peer's), each kept once; the newest
// BUILDS_KEEP stay. A peer's (`take`) bring at most that many new ones.
// Returns how many were new.
function buildsMerge(list, take) {
  if (!Array.isArray(list)) return 0;
  const have = PROFILE.builds(), keys = new Set(have.map(buildsKey));
  let n = 0;
  for (const raw of list.slice(0, BUILDS_SEND)) {
    const r = buildsClean(raw);
    if (!r || keys.has(buildsKey(r))) continue;
    keys.add(buildsKey(r)); have.push(r); n++;
    if (take && n >= take) break;
  }
  if (!n) return 0;
  PROFILE.putBuilds(have.slice(-BUILDS_KEEP));
  buildsCache = null;
  return n;
}
// what this screen hands the other end of a join: its newest records
function buildsPack() { return PROFILE.builds().slice(-BUILDS_SEND); }

// ONE HERO'S NUMBERS, off its newest BUILDS_HERO records: its games, and for
// each finished item, each first pair of boots and each PATH (the first
// three legendaries in the order bought) how many games had it and how many
// of those were won. Cached until the records change.
let buildsCache = null;
function buildsStats(hero) {
  if (!buildsCache) buildsCache = new Map();
  if (buildsCache.has(hero)) return buildsCache.get(hero);
  const recs = PROFILE.builds().filter((r) => r.h === hero).slice(-BUILDS_HERO);
  const items = new Map(), boots = new Map(), paths = new Map();
  const add = (map, k, w, ids) => { const e = map.get(k) || { ids, n: 0, w: 0 }; e.n++; e.w += w; map.set(k, e); };
  for (const r of recs) {
    for (const id of new Set(r.b)) add(items, id, r.w, [id]);
    const b = r.b.find(isBoots);
    if (b) add(boots, b, r.w, [b]);
    const core = r.b.filter((id) => !isBoots(id)).slice(0, 3);
    if (core.length >= 2) add(paths, core.join(','), r.w, core);
  }
  const out = { hero, n: recs.length, items, boots: [...boots.values()], paths: [...paths.values()] };
  buildsCache.set(hero, out);
  return out;
}
// a share as a whole percent
function buildsPct(a, b) { return b > 0 ? Math.round(a * 100 / b) : 0; }
// a win rate that a handful of games cannot inflate: the share with one win
// and one loss added (so 3 of 3 ranks under 30 of 40)
function buildsRate(e) { return (e.w + 1) / (e.n + 2); }
// pick and win rate of one item on one hero, or null while the hero is
// short of BUILDS_MIN games (the tooltips, js/ui/shop.js)
function buildsItem(hero, id) {
  const S = buildsStats(hero);
  if (S.n < BUILDS_MIN) return null;
  const e = S.items.get(id) || { n: 0, w: 0 };
  return { pick: buildsPct(e.n, S.n), win: e.n ? buildsPct(e.w, e.n) : null, n: e.n, games: S.n };
}

// THE RECOMMENDED TAB'S BUILDS for a hero. With enough games: the most
// picked path and, when another path with BUILDS_PATH_MIN games wins more,
// that one too, each with its boots; then the boots and the other items
// people finish most. Short of games: the curated list (`list`, the hero's
// BOT_BUILDS), with no numbers. Each row is { ids, pick?, win? }.
function buildsRec(hero, list) {
  const S = buildsStats(hero);
  const curated = { data: false, games: S.n, core: [{ ids: list.filter((id) => !isBoots(id)).slice(0, 3) }],
    boots: list.filter(isBoots).map((id) => ({ ids: [id] })), more: list.filter((id) => !isBoots(id)).slice(3) };
  if (S.n < BUILDS_MIN || !S.paths.length) return curated;
  const byPick = S.paths.slice().sort((a, b) => b.n - a.n || buildsRate(b) - buildsRate(a));
  const top = byPick[0];
  const best = S.paths.filter((e) => e !== top && e.n >= BUILDS_PATH_MIN && buildsRate(e) > buildsRate(top))
    .sort((a, b) => buildsRate(b) - buildsRate(a))[0];
  const row = (e) => ({ ids: e.ids, pick: buildsPct(e.n, S.n), win: buildsPct(e.w, e.n), n: e.n, best: e === best });
  const core = [row(top)].concat(best ? [row(best)] : []);
  const boots = S.boots.sort((a, b) => b.n - a.n).slice(0, 3).map(row);
  const shown = new Set(core.flatMap((r) => r.ids));
  const more = [...S.items.values()].filter((e) => !shown.has(e.ids[0]) && !isBoots(e.ids[0]))
    .sort((a, b) => b.n - a.n).slice(0, 8).map((e) => e.ids[0]);
  return { data: true, games: S.n, core, boots, more };
}
