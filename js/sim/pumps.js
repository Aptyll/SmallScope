'use strict';
// ------------------------------------------------------------ pumps
// THE GOLD PUMPS: two neutral map objectives, one beside the middle of the
// top lane and one beside the middle of the bot lane, set off the road so a
// wave walks past. Nobody owns one and nothing can hurt one (`team` stays
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
const PUMP_SEEK = 12;     // tiles from a lane's middle a mirrored pair's spot is looked for...
const PUMP_SEEK_FAR = 20; // ...and a lone pump's, on a shape where no pair stands
const PUMP_ROAD = 3.5;    // tiles the pump's centre keeps off any road edge, so the ring sits beside the lane, not on it
const PUMP_STAND = 1;     // share of the ring's tiles a hero must be able to stand on: no water in a pair's...
const PUMP_STAND_LONE = 0.8; // ...and a little at a lone pump's edge
const PUMP_CLEAR = 1;     // tiles round the footprint the lane's pines give way

// the two lanes' middles, in tiles: the creek crossing at the bend of each
function pumpLaneMid(lane) {
  const c = baseTile(0, (WORLD - 1) / 2, lane === 0 ? -56 : 56);
  return { tx: c.tx, ty: c.ty };
}
function pumpAll() { return structures.filter((o) => o.type === 'generator'); }
function pumpRingPx() { return PUMP_R * TILE; }

// could a pump stand with its footprint's top-left at (ax, ay)? Every tile is
// plain snow in the world (never ice, water, a ford, the cistern's stone, a
// road or a camp), holding nothing the lane would not fell; its centre keeps
// PUMP_ROAD off every road; and `stand` of its ring is ground a hero can stand on
function pumpSpotOk(ax, ay, stand) {
  const w = structW('generator'), h = structH('generator');
  for (const [x, y] of footprint('generator', ax, ay)) {
    if (!inWorld(x, y) || waterAt(x, y) || cisternTouches(x, y)) return false;
    if (ground[idx(x, y)] !== 0 || roadDist(x, y, true) < 1) return false;
    const o = objects[idx(x, y)];
    if (o && !laneFells(o)) return false;
    if (campAt((x + 0.5) * TILE, (y + 0.5) * TILE)) return false;
  }
  const cx = ax + w / 2, cy = ay + h / 2;
  if (roadDist(cx - 0.5, cy - 0.5, true) < PUMP_ROAD) return false;
  let n = 0, ok = 0;
  const r = Math.ceil(PUMP_R);
  for (let y = Math.floor(cy) - r; y <= Math.floor(cy) + r; y++) for (let x = Math.floor(cx) - r; x <= Math.floor(cx) + r; x++) {
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > PUMP_R) continue;
    n++;
    if (!inWorld(x, y) || waterAt(x, y) || cisternTouches(x, y)) continue;
    const o = objects[idx(x, y)];
    if (o && !laneFells(o) && !(x >= ax && x < ax + w && y >= ay && y < ay + h)) continue;
    ok++;
  }
  return ok >= n * stand;
}
// the anchor whose footprint is the point mirror of (ax, ay)'s: the map is
// laid point-symmetric about its middle, tile (x, y) to (W-1-x, W-1-y)
function pumpMirror(ax, ay) { return [WORLD - structW('generator') - ax, WORLD - structH('generator') - ay]; }
// the anchors within `reach` tiles of a lane's middle, nearest first (ties broken by a
// fixed order, so a seed always picks the same spot)
function pumpSeek(lane, reach) {
  const m = pumpLaneMid(lane), w = structW('generator'), h = structH('generator'), offs = [];
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) if (dx * dx + dy * dy <= reach * reach) offs.push([dx, dy]);
  offs.sort((a, b) => a[0] * a[0] + a[1] * a[1] - b[0] * b[0] - b[1] * b[1] || a[1] - b[1] || a[0] - b[0]);
  return offs.map(([dx, dy]) => [Math.round(m.tx - w / 2) + dx, Math.round(m.ty - h / 2) + dy]);
}

// Runs at boot after the landmarks (js/app/boot.js), outside genWorld and with
// no rng(): no seed moves. The top lane's spot is the nearest one whose mirror
// on the bot lane will stand too, so the pair is fair; a shape where no such
// pair stands (the frozen isles' lake) takes the nearest spot on each lane
// alone, further out, and a lane with none has no pump.
function placePumps() {
  if (PRACTICE) return;
  let pair = null;
  for (const [ax, ay] of pumpSeek(0, PUMP_SEEK)) {
    if (!pumpSpotOk(ax, ay, PUMP_STAND)) continue;
    const [bx, by] = pumpMirror(ax, ay);
    if (pumpSpotOk(bx, by, PUMP_STAND)) { pair = [[ax, ay], [bx, by]]; break; }
  }
  const spots = pair || [0, 2].map((lane) => pumpSeek(lane, PUMP_SEEK_FAR).find(([ax, ay]) => pumpSpotOk(ax, ay, PUMP_STAND_LONE)) || null);
  spots.forEach((s, i) => { if (s) pumpStand(s[0], s[1], i === 0 ? 0 : 2); });
}
function pumpStand(ax, ay, lane) {
  const w = structW('generator'), h = structH('generator');
  // the footprint and its edge, and every tile of the ring, give way
  for (let y = ay - PUMP_CLEAR; y < ay + h + PUMP_CLEAR + 1; y++) for (let x = ax - PUMP_CLEAR; x < ax + w + PUMP_CLEAR; x++) {
    if (inWorld(x, y) && objects[idx(x, y)] && laneFells(objects[idx(x, y)])) objects[idx(x, y)] = null;
  }
  const cx = ax + w / 2, cy = ay + h / 2, r = Math.ceil(PUMP_R);
  for (let y = Math.floor(cy) - r; y <= Math.floor(cy) + r; y++) for (let x = Math.floor(cx) - r; x <= Math.floor(cx) + r; x++) {
    if (inWorld(x, y) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= PUMP_R && objects[idx(x, y)] && laneFells(objects[idx(x, y)])) objects[idx(x, y)] = null;
  }
  const o = createStruct(ax, ay, 'generator', 0, { id: -1, team: undefined }, false);
  o.lane = lane;
  return o;
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
  const t = STRUCTS.generator.tiers[o.tier];
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
