'use strict';
// How fun a match was, as numbers: eight parts in 0..1 read off a match log
// (match.js) and one weighted score out of 100. A proxy, not a verdict - the
// weights are a first guess to be tuned against how matches actually feel,
// so every part and the raw number under it ride along in the log.

// part -> weight (the table in docs/dev/arena.md explains each)
const FUN_WEIGHTS = { close: 2, swings: 2, comeback: 1, length: 1, action: 2, busy: 2, spread: 1, variety: 1 };
const LEAD_SMOOTH = 30;   // s the lead is averaged over before a change counts
const LEAD_DEAD = 0.05;   // |lead| under this is nobody's lead
const SWINGS_MAX = 3;     // lead changes that already read as a see-saw
const COMEBACK_DEF = 0.3; // a winner once this far behind made a full comeback
const LEN_GOOD = [12, 18], LEN_ZERO = [5, 30]; // min: the sweet spot, and where it hits 0
const LULL_OK = 60, LULL_SPAN = 180; // s: a gap in the fighting this long is free, this much longer costs it all
const SPREAD_FULL = 0.6;  // share of the walkable map that counts as all of it
const ACTS = ['fight', 'siege', 'work', 'move'];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
function entropy(counts) {
  const vals = counts.filter((v) => v > 0), tot = vals.reduce((a, b) => a + b, 0);
  if (!tot || counts.length < 2) return 0;
  let h = 0;
  for (const v of vals) { const q = v / tot; h -= q * Math.log(q); }
  return h / Math.log(counts.length);
}

// team 0's lead at one sample, -1..1: the birds' nerve gap first, then the
// kill and gold gaps (the same three numbers the top bar and TAB show)
function leadAt(s, pk, seats) {
  const nerve = s.eagles.map((e) => (e[2] === 'down' || e[2] === 'flee' || e[2] === 'gone' ? Math.max(0, e[0]) / e[1] : 1));
  const K = pk.indexOf('kills'), G = pk.indexOf('gold');
  const k = [0, 0], g = [0, 0];
  s.p.forEach((r, i) => { const t = seats[i].team; k[t] += r[K]; g[t] += r[G]; });
  const kill = (k[0] - k[1]) / Math.max(5, k[0] + k[1]);
  const gold = (g[0] - g[1]) / Math.max(1, g[0] + g[1]);
  return 0.6 * (nerve[0] - nerve[1]) + 0.2 * kill + 0.2 * gold;
}

function funScore(log) {
  const S = log.samples, pk = log.pKeys, seats = log.seats;
  const raw = {};
  const parts = {};
  if (!S.length) return { score: 0, parts, raw, weights: FUN_WEIGHTS };
  const last = S[S.length - 1];
  const win = log.result.winner;
  const nerveEnd = last.eagles.map((e) => Math.max(0, e[0]) / e[1]);

  // close: how near the loser came
  parts.close = win == null ? 1 - Math.abs(nerveEnd[0] - nerveEnd[1]) : 1 - nerveEnd[win];
  raw.winnerNerve = win == null ? null : Math.round(nerveEnd[win] * 100) / 100;

  // the lead line, smoothed; swings and the comeback read it
  const lead = S.map((s) => leadAt(s, pk, seats));
  const w = Math.max(1, Math.round(LEAD_SMOOTH / log.sampleEvery));
  const smooth = lead.map((_, i) => { let a = 0, n = 0; for (let j = Math.max(0, i - w + 1); j <= i; j++) { a += lead[j]; n++; } return a / n; });
  let side = 0, changes = 0, worst = 0;
  for (const v of smooth) {
    const s = v > LEAD_DEAD ? 1 : v < -LEAD_DEAD ? -1 : 0;
    if (s && side && s !== side) changes++;
    if (s) side = s;
    if (win != null) worst = Math.max(worst, win === 0 ? -v : v);
  }
  raw.leadChanges = changes;
  raw.winnerWorstDeficit = Math.round(worst * 100) / 100;
  parts.swings = Math.min(changes, SWINGS_MAX) / SWINGS_MAX;
  parts.comeback = win == null ? 0 : clamp01(worst / COMEBACK_DEF);

  // length
  const min = log.result.time / 60;
  raw.minutes = Math.round(min * 10) / 10;
  parts.length = min >= LEN_GOOD[0] && min <= LEN_GOOD[1] ? 1
    : min < LEN_GOOD[0] ? clamp01((min - LEN_ZERO[0]) / (LEN_GOOD[0] - LEN_ZERO[0]))
      : clamp01((LEN_ZERO[1] - min) / (LEN_ZERO[1] - LEN_GOOD[1]));

  // action: the longest stretch after both birds roost with no player hurt by a player
  const D = pk.indexOf('dmg');
  let lull = 0, since = null, lastDmg = null;
  for (const s of S) {
    const landed = s.eagles.every((e) => e[2] !== 'fly' && e[2] !== 'dive');
    const dmg = s.p.reduce((a, r) => a + r[D], 0);
    if (!landed) { lastDmg = dmg; continue; }
    if (since == null) since = s.t;
    if (lastDmg != null && dmg > lastDmg) since = s.t;
    lull = Math.max(lull, s.t - since);
    lastDmg = dmg;
  }
  raw.longestLull = Math.round(lull);
  parts.action = clamp01(1 - (lull - LULL_OK) / LULL_SPAN);

  // busy: idle share of the time bodies were up
  let idle = 0, up = 0;
  const actTot = { fight: 0, siege: 0, work: 0, move: 0 };
  for (const p of log.players) {
    const a = p.acts;
    idle += a.idle; up += a.idle + a.fight + a.siege + a.work + a.move;
    for (const k of ACTS) actTot[k] += a[k];
  }
  raw.idleShare = up ? Math.round(idle / up * 1000) / 1000 : 0;
  raw.actShare = {};
  for (const k of ACTS) raw.actShare[k] = up ? Math.round(actTot[k] / up * 1000) / 1000 : 0;
  parts.busy = clamp01(1 - 2 * raw.idleShare);

  // spread: how much of the walkable map anyone stood in
  raw.cellsSeen = log.cells.seen; raw.cellsOpen = log.cells.open;
  parts.spread = log.cells.open ? clamp01(log.cells.seen / log.cells.open / SPREAD_FULL) : 0;

  // variety: what the bodies did, and what the brains said they were doing
  const actH = entropy(ACTS.map((k) => actTot[k]));
  const goalTot = {};
  for (const p of log.players) for (const g in p.goals) goalTot[g] = (goalTot[g] || 0) + p.goals[g];
  const goalKeys = Object.keys(goalTot);
  const goalH = goalKeys.length > 1 ? entropy(goalKeys.map((k) => goalTot[k])) : null;
  raw.actEntropy = Math.round(actH * 100) / 100;
  raw.goalEntropy = goalH == null ? null : Math.round(goalH * 100) / 100;
  parts.variety = goalH == null ? actH : (actH + goalH) / 2;

  let sum = 0, wsum = 0;
  for (const k in FUN_WEIGHTS) { sum += FUN_WEIGHTS[k] * parts[k]; wsum += FUN_WEIGHTS[k]; }
  for (const k in parts) parts[k] = Math.round(parts[k] * 100) / 100;
  return { score: Math.round(100 * sum / wsum), parts, raw, weights: FUN_WEIGHTS };
}

module.exports = { funScore, FUN_WEIGHTS, leadAt };
