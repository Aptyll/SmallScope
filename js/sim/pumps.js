'use strict';
// ------------------------------------------------------------ pumps
// THE GOLD PUMPS: two neutral map objectives in the jungle, one each side of
// the middle by its base mouth (PUMP_SPOT). Nobody owns one and nothing can hurt one (`team` stays
// undefined: structFoe is false for it and ownsStruct true). A ring on the
// snow round each is the whole interaction: heroes only (players, never a
// soldier), standing in it with no rival hero inside, fill it to their side
// over PUMP_CAP_T; a rival inside pauses it. While a side holds it, every
// hero on that side is paid the tier's `pay` every `period` (gainGold).
//
// The pump's own state rides its tile object (the snapshot diffs tile
// objects field by field, and `structures` is a save root):
//   hold   the side holding it, -1 for nobody (its paint, ring and maps)
//   cap    0..1, how far `capBy` has filled the ring toward itself
//   capBy  the side filling it, -1 for nobody
//   payT   the clock to the next pay; it strokes off this (pumpFrame)
//   paid   a pay has landed since the last flip (the coin hop's gate)
const PUMP_R = 4.5;       // tiles from the pump's centre a hero counts as in its ring
const PUMP_CAP_T = 5;     // s one side alone in the ring takes to fill it
const PUMP_FADE_T = 10;   // s an empty ring takes to lose a full fill's progress
const PUMP_SPOT = [48, 69];  // RED's pump: its 4x2 footprint's top-left tile, in the jungle's middle by the base mouth (BLUE's mirrored across the middle column)
function pumpRingPx() { return PUMP_R * TILE; }

// Runs at boot after the camps (js/app/boot.js): one pump each side of the
// middle, mirrored, so the pair is fair
function placePumps() {
  const w = structW('pump');
  for (const ax of [PUMP_SPOT[0], WORLD - PUMP_SPOT[0] - w]) {
    for (const [x, y] of footprint('pump', ax, PUMP_SPOT[1])) objects[idx(x, y)] = null;
    createStruct(ax, PUMP_SPOT[1], 'pump', { id: -1, team: undefined }, false);
  }
}

// the heroes of each side standing in o's ring: [red, blue]
function pumpCount(o) {
  const c = structCenter(o), r = pumpRingPx(), n = [0, 0];
  for (const p of players) {
    if (!unitAlive(p) || (p.team !== 0 && p.team !== 1)) continue;
    if (Math.hypot(p.x - c.x, p.y - c.y) <= r) n[p.team]++;
  }
  return n;
}

// one step of a pump (updateStructures): the ring, then the pay
function updatePump(o, dt) {
  const t = STRUCTS.pump;
  const n = pumpCount(o);
  const side = n[0] && !n[1] ? 0 : n[1] && !n[0] ? 1 : -1;
  const step = dt / PUMP_CAP_T;
  if (side >= 0) {
    if (o.hold === side) {
      // the holder in its own ring wipes a rival's part-fill back out
      if (o.capBy >= 0) { o.cap -= step; if (o.cap <= 0) { o.cap = 0; o.capBy = -1; } }
    } else if (o.capBy >= 0 && o.capBy !== side) {
      // a rival's part-fill drains before this side's own starts
      o.cap -= step;
      if (o.cap <= 0) { o.cap = 0; o.capBy = side; }
    } else {
      o.capBy = side;
      o.cap += step;
      if (o.cap >= 1) pumpFlip(o, side, t);
    }
  } else if (!n[0] && !n[1] && o.capBy >= 0) {
    // nobody in it: a part-fill fades
    o.cap -= dt / PUMP_FADE_T;
    if (o.cap <= 0) { o.cap = 0; o.capBy = -1; }
  }
  // both sides in it: everything holds where it is
  if (o.hold < 0) return;
  o.payT -= dt;
  if (o.payT > 0) return;
  o.payT = t.period;
  o.paid = true;
  // every hero on the holding side, wherever they are: gold is never a
  // physical drop. The +N rises over the barrel, where the drawn coin hops out
  const c = structCenter(o);
  for (const p of players) {
    if (p.team !== o.hold || !p.active) continue;
    gainGold(p, t.pay);
    sfxFor(p, 'coin');
  }
  addFloater(c.x - 5, c.y - 14, String(t.pay), RES_COLORS.gold);
  burst(c.x - 5, c.y - 6, '#c9d0e2', 2, 20, 0.3);
}
function pumpFlip(o, side, t) {
  o.hold = side; o.cap = 0; o.capBy = -1;
  o.payT = t.period; o.paid = false;
  const c = structCenter(o), col = TEAMS[skin(side)].mark;
  joltObj(o, 0.4);
  sfxAt('place', c.x, c.y);
  for (const [x, y] of circlePts(Math.round(pumpRingPx()))) if (((x * 7 + y * 3) & 15) === 0) burst(c.x + x, c.y + y, col, 1, 25, 0.5, true);
  burst(c.x, c.y - 10, col, 10, 50, 0.6, true);
}
