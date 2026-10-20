'use strict';
// The valley's one map of how deep the snow lies, and the deep snow that is
// the valley's BRUSH: hand-placed patches a body hides in.
// ------------------------------------------------------------ snow depth
// Snow piles where the wind drops it, so the map is a set of DRIFTS, each a
// mound of depth: the deep BRUSH patches (layBrush), the warrens' pools
// (layMeadowDrifts) and a small pad in the lee of every standing thing
// (layLees). snowDepth(fx, fy) is the whole map - the tallest drift at a
// point, over a shallow dusting in the hollows - and every system that cares
// how deep the snow is asks it: the fog of war reads the DEEP band (brushOf,
// deepAt: a body in it is hidden, js/sim/fog.js), the ground bake draws that
// band raised (js/draw/depth.js) with its reeds standing in it, and the
// lighter bands are there for anything that dresses the snow. A pure function
// of the seed and the scenery worldgen stood up: hash2/vnoise only, not one
// rng() call, so no seed's world moves and every client lays the same map.
const DEPTH_DEEP = 0.6;     // snowDepth at and above which snow is DEEP: the brush
const DEPTH_MID = 0.25;     // ...and the band under it: a drift you see but do not hide in
const DRIFT_HOLLOW = 0.2;   // the deepest a hollow's dusting gets: under DEPTH_MID, a dusting and never a drift
const DRIFT_WIND_ARC = 0.4; // rad either side of the creek's line the prevailing wind may blow
const DRIFT_RAG = 0.16;     // how far a lee pad's edge wanders either way, as a share of its width
const LEE_AMP = 0.42;       // the tallest pad of snow in one object's own lee: the MID band, never DEPTH_DEEP
const LEE_WOODS = 4;        // breakers among its eight neighbours past which an object is forest floor and gets no pad
const DRIFT_RAG_STEP = 0.25; // tiles along a pad per sample of its edge's wander
const drifts = [];          // every deep drift: the brush patches and the warrens' pools, in tile space
let driftCell = null;       // per tile: the drifts whose skirt reaches it (null for none)
let leeCell = null;         // per tile: the lee pads (below) that reach it (null for none)
const driftWind = { ang: 0, dx: 1, dy: 0 }; // the prevailing wind, blowing toward (dx, dy)

// ---- the shape --------------------------------------------------------------
// One drift's depth at a tile-space point: a brush patch's (brushDepth) or a
// warren's pool (poolDepth), else a lee pad's. In a pad's own frame u runs
// downwind from the crest and v across it; the half-width is a rounded head
// upwind of the crest and a tail tapering to nothing at `len`, bent a little
// on `bend` and wandering on the pre-sampled `rag`. Depth falls off across
// the width as 1 - q^2, so a pad is a smooth mound.
function driftDepth(D, fx, fy) {
  if (D.brush) return brushDepth(D, fx, fy);
  if (D.pool) return poolDepth(D, fx, fy);
  const rx = fx - D.x, ry = fy - D.y;
  const u = rx * D.dx + ry * D.dy;
  if (u <= -D.head || u >= D.len) return 0;
  const t = u > 0 ? u / D.len : 0;
  const v = -rx * D.dy + ry * D.dx - D.bend * t * t * D.len;
  let w;
  if (u < 0) { const k = u / D.head; w = D.wid * Math.sqrt(1 - k * k); }
  else w = D.wid * Math.pow(1 - t, 0.6) * (1 + 0.3 * Math.sin(Math.PI * Math.min(1, t * 2.2)));
  const n = D.rag.length >> 1, f = Math.min(n - 1.001, (u + D.head) / DRIFT_RAG_STEP), i = f | 0;
  const o = v < 0 ? 0 : n;
  w *= 1 + DRIFT_RAG * (D.rag[o + i] + (D.rag[o + i + 1] - D.rag[o + i]) * (f - i));
  const q = v / w;
  if (q * q >= 1) return 0;
  return D.amp * (1 - q * q) * (1 - 0.2 * t);
}
// the shallow dusting in the valley's hollows: low on the position noise
function hollowDepth(fx, fy) {
  const n = vnoise(fx / 9 + 41.7, fy / 9 + 13.3);
  return n < 0.35 ? DRIFT_HOLLOW * (0.35 - n) / 0.35 : 0;
}
// THE map: how deep the snow lies at a tile-space point (tile + 0.5 is a
// tile's centre), 0 to 1. Static for the match; say nothing about what the
// ground is - deepAt is the one that asks.
function snowDepth(fx, fy) { return Math.max(hollowDepth(fx, fy), leeDepth(fx, fy), driftsDepth(fx, fy)); }
// the small pad of snow in the lee of each standing thing (layLees)
function leeDepth(fx, fy) {
  const tx = Math.floor(fx), ty = Math.floor(fy);
  const L = leeCell && inWorld(tx, ty) ? leeCell[idx(tx, ty)] : null;
  let d = 0;
  if (L) for (let k = 0; k < L.length; k++) { const e = driftDepth(L[k], fx, fy); if (e > d) d = e; }
  return d;
}
// ...the deep drifts' share of it alone: the only share that reaches
// DEPTH_DEEP (a hollow tops out at DRIFT_HOLLOW, a lee pad at LEE_AMP), so
// what asks after the deep band alone skips the rest
function driftsDepth(fx, fy) {
  const tx = Math.floor(fx), ty = Math.floor(fy);
  const L = driftCell && inWorld(tx, ty) ? driftCell[idx(tx, ty)] : null;
  let d = 0;
  if (L) for (let k = 0; k < L.length; k++) { const e = driftDepth(L[k], fx, fy); if (e > d) d = e; }
  return d;
}
function snowDepthPx(x, y) { return snowDepth(x / TILE, y / TILE); }
// is this world point in DEEP snow - in the brush? Only open snow holds it:
// a runtime paving or a hole takes it away with the ground.
function deepAt(x, y) { return !!brushOf(x, y); }
// ...and WHICH patch (a drift of `drifts`), or null: the one the fog of war
// hides a body in (js/sim/fog.js). The same depth the ground bake draws, so
// what is drawn deep IS the brush to the pixel.
function brushOf(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (!inWorld(tx, ty) || ground[idx(tx, ty)] !== 0) return null;
  const L = driftCell && driftCell[idx(tx, ty)];
  if (L) for (let k = 0; k < L.length; k++) if (driftDepth(L[k], x / TILE, y / TILE) >= DEPTH_DEEP) return L[k];
  return null;
}

// ---- the brush ---------------------------------------------------------------
// THE BRUSH: deep snow, hand-placed - the same patches on every seed, each a
// stand of frosted reeds in a drift (js/draw/depth.js draws both) that hides
// whoever is in it from the other side (brushHide, js/sim/fog.js). RED's half
// is listed in the road's frame (baseTile, js/sim/base.js: u along the road
// from RED's corner, s across it, - the top side); BLUE's is the same list
// mirrored across the creek's line, which is (tx, ty) -> (ty, tx), so both
// sides get the same ambushes. Per patch: [u, s, half-length, half-width (tiles),
// angle (deg, world: 0 east, 90 south)] - an ellipse with a wandering rim.
//   lane:   one by each side lane, on its inside edge, short of the lane's middle
//   mid:    one either side of the mid road
//   jungle: one each side of the road between the mid road and the dens
//   river:  one each side short of the creek, toward the bears
const BRUSH_PATCHES = [
  [66, -25, 4, 1.7, -62], [66, 25, 4, 1.7, -28],   // lane
  [90, -8.5, 3.5, 1.5, -45], [90, 8.5, 3.5, 1.5, -45], // mid
  [76, -13, 3, 2, 45], [76, 13, 3, 2, 45],         // jungle
  [103, -28, 3.5, 2, 45], [103, 30, 3.5, 2, 45],   // river
];
const BRUSH_AMP = 0.95;   // the depth in a patch past its rim's slope
const BRUSH_EDGE = 0.6;   // tiles in from the rim it takes to reach BRUSH_AMP
const BRUSH_SKIRT = 1;    // tiles out from the rim its skirt (the MID band) runs
const BRUSH_WOB = 0.12;   // how far the rim wanders, as a share of the radius
const BRUSH_CLEAR = 1;    // tiles out from the rim the scenery is cleared and the ice turned to snow
const brushes = [];       // the patches, as drifts with brush: true (also in drifts)
// tiles in from a deep drift's rim at a tile-space point (negative outside):
// how the fog of war asks whether an eye is in a patch or right next to it
function brushIn(D, fx, fy) {
  if (D.pool) return poolIn(D, fx, fy) - DEPTH_DEEP / D.amp * D.edge; // a pool is deep from there in
  const dx = fx - D.x, dy = fy - D.y;
  const a = dx * D.c + dy * D.s, b = -dx * D.s + dy * D.c;
  const r = Math.hypot(a / D.a, b / D.b), th = Math.atan2(b * D.flip / D.b, a / D.a);
  const wob = 1 + BRUSH_WOB * (vnoise(Math.cos(th) * 2 + D.key * 7.3, Math.sin(th) * 2 + D.key * 3.1) - 0.5) * 2;
  return (wob - r) * D.b;
}
// one patch's depth: DEEP from its rim in, rising to BRUSH_AMP; a skirt in
// the MID band outside it
function brushDepth(D, fx, fy) {
  const m = brushIn(D, fx, fy);
  if (m >= 0) return DEPTH_DEEP + (BRUSH_AMP - DEPTH_DEEP) * Math.min(1, m / BRUSH_EDGE);
  return m > -BRUSH_SKIRT ? DEPTH_DEEP * 0.9 * (1 + m / BRUSH_SKIRT) : 0;
}
// the patch nearest a world point whose middle is within r px (and passes
// ok(x, y), if given), as its middle in world px, or null: where a bot waits
// in ambush (aiLaneSpot, js/ai/ai-farm.js)
function brushNear(x, y, r, ok) {
  let best = null, bd = r;
  for (const D of brushes) {
    const bx = D.x * TILE, by = D.y * TILE, d = Math.hypot(bx - x, by - y);
    if (d < bd && (!ok || ok(bx, by))) { bd = d; best = D; }
  }
  return best && { x: best.x * TILE, y: best.y * TILE };
}
// lay the patches, both sides', and clear what stands in them: the pines,
// rocks, bushes, stumps and snags inside BRUSH_CLEAR of the rim, and the ice
// (to snow). Anything else on a tile there - a chest, a landmark, a camp's
// prop - stands, and the reeds round it. No rng(): placed, never rolled.
function layBrush() {
  brushes.length = 0;
  BRUSH_PATCHES.forEach(([u, s, a, b, ang], k) => {
    const t = baseTile(0, u, s);
    for (const side of [0, 1]) {
      const g = (side ? 90 - ang : ang) * Math.PI / 180;
      const D = {
        brush: true, key: k, x: side ? t.ty : t.tx, y: side ? t.tx : t.ty, a, b, c: Math.cos(g), s: Math.sin(g), flip: side ? -1 : 1,
        len: a * (1 + BRUSH_WOB) + BRUSH_SKIRT, head: 0, wid: 0, bend: 0, // driftTiles' reach
      };
      brushes.push(D); drifts.push(D);
      const R = Math.ceil(D.len + BRUSH_CLEAR);
      for (let ty = Math.floor(D.y - R); ty <= D.y + R; ty++) for (let tx = Math.floor(D.x - R); tx <= D.x + R; tx++) {
        if (!inWorld(tx, ty) || brushIn(D, tx + 0.5, ty + 0.5) < -BRUSH_CLEAR) continue;
        const i = idx(tx, ty), o = objects[i];
        if (ground[i] === 1) ground[i] = 0;
        if (o && BRUSH_FELLS[o.type]) objects[i] = null;
      }
    }
  });
}
const BRUSH_FELLS = { tree: true, rock: true, bush: true, stump: true, snag: true };

// ---- laying the drifts ----------------------------------------------------
// what breaks the wind: anything worldgen stood up that stands above the
// snow (a pine, a snag, a rock, a chest, a den, a hut) and the berry bushes,
// which trap it the way a hedge does - each holds a lee pad (layLees)
function driftBreak(tx, ty) {
  const o = objAt(tx, ty);
  return !!o && (o.type === 'bush' || !!(OBJECTS[o.type] && OBJECTS[o.type].solid) || o.type === 'part');
}
// the tiles a drift reaches, with the margin its rim and cast shade need
function driftTiles(D, pad) {
  const r = Math.max(D.len, D.head) + D.wid * (1 + DRIFT_RAG) + Math.abs(D.bend) * D.len + pad;
  const out = [];
  for (let ty = Math.floor(D.y - r); ty <= Math.ceil(D.y + r); ty++) for (let tx = Math.floor(D.x - r); tx <= Math.ceil(D.x + r); tx++) {
    if (!inWorld(tx, ty)) continue;
    // the deepest the drift gets anywhere on (or pad tiles around) the tile
    let best = 0;
    for (let j = -pad; j <= 1 + pad; j += 0.5) for (let i = -pad; i <= 1 + pad; i += 0.5) {
      const e = driftDepth(D, tx + i, ty + j); if (e > best) best = e;
    }
    if (best > 0) out.push({ tx, ty, d: best });
  }
  return out;
}
// the whole map, once worldgen has stood everything up (boot.js): the wind,
// the brush, the warrens' pools, the per-tile index, and the lee pads
function layDrifts() {
  drifts.length = 0; brushes.length = 0;
  driftCell = new Array(WORLD * WORLD).fill(null);
  if (PRACTICE) return;
  // the prevailing wind: within DRIFT_WIND_ARC of the creek's line, either
  // way along it, so each side's half of the valley wears its lee pads alike
  const a = Math.PI / 4 + (hash2(9011, 373) - 0.5) * 2 * DRIFT_WIND_ARC + (hash2(17, 9901) < 0.5 ? Math.PI : 0);
  driftWind.ang = a; driftWind.dx = Math.cos(a); driftWind.dy = Math.sin(a);
  // ...and the ground's swells (SNOW_ANG, js/draw/ground.js) lie along it, so
  // every texture the snow wears leans the one way; the bake reads them after
  SNOW_ANG = a; SNOW_C = driftWind.dx; SNOW_S = driftWind.dy;
  layBrush();
  layMeadowDrifts(); // the warrens' own pools: brush too
  // index every drift on each tile its skirt, rim or shade reaches
  for (const D of drifts) for (const q of driftTiles(D, 0.2)) {
    const i = idx(q.tx, q.ty);
    (driftCell[i] || (driftCell[i] = [])).push(D);
  }
  layLees();
}
// THE WARRENS' SNOW (CAMPS.meadow, js/sim/camps.js): each warren's ring of pines
// holds a round pool of deep snow - brush like any other - that fills its clearing to the trees,
// laid in the camp's own frame (campFrame) so both warrens wear the same
// pool, mirrored. MEADOW_POOL in tiles: `r` the pool's radius off the camp's
// centre, `edge` how far in from its rim it takes to reach full depth,
// `ring` the radius of a crust island left in its middle (0: none), `lane`
// the half-width of a crust lane winding in from the mouth to the middle
// (0: none). The rim wanders on a fixed wave even about the camp's own axis,
// so the pool is the same on every seed. Its rabbits never leave it
// (warrenHolds, js/sim/wildlife.js).
const MEADOW_POOL = { r: 6.9, edge: 1.4, ring: 0, lane: 0 };
const MEADOW_AMP = 0.95;
function layMeadowDrifts() {
  for (const C of camps) {
    if (C.key !== 'meadow') continue;
    const F = campFrame(C), P = MEADOW_POOL;
    drifts.push({
      pool: true, x: C.tx + 0.5, y: C.ty + 0.5, ax: F.ax, ay: F.ay, ox: F.ox, oy: F.oy,
      r: P.r, edge: P.edge, ring: P.ring, lane: P.lane, amp: MEADOW_AMP,
      len: P.r + 1, head: 0, wid: 0, bend: 0, // driftTiles' reach: the pool and its rim
    });
  }
}
// one warren's pool at a tile-space point (driftDepth hands a `pool` here)
function poolDepth(D, fx, fy) {
  const m = poolIn(D, fx, fy);
  return m <= 0 ? 0 : D.amp * Math.min(1, m / D.edge);
}
// ...tiles in from its rim (negative outside)
function poolIn(D, fx, fy) {
  const dx = fx - D.x, dy = fy - D.y, a = dx * D.ax + dy * D.ay, o = dx * D.ox + dy * D.oy;
  const d = Math.hypot(a, o), th = Math.atan2(a, o);
  let m = D.r * (1 + 0.05 * Math.cos(5 * th) + 0.03 * Math.cos(3 * th)) - d; // in from the rim
  if (D.ring) m = Math.min(m, d - D.ring);                                      // ...out from the island
  if (D.lane) m = Math.min(m, (o > 0 ? Math.abs(a - 0.9 * Math.sin(o * 0.5)) : d) - D.lane); // ...out from the lane, winding in from the mouth to a round end at the middle
  return m;
}
// Every standing thing out in the open - a pine on the treeline's edge or in
// a stand's fringe, a rock, a bush, a stump, a snag, a den, a hut - holds a
// small pad of snow in its own lee along driftWind: the same drift shape at a
// tile or two long and LEE_AMP tall, so it lives in the MID band and never
// slows anybody. Forest floor (LEE_WOODS breakers round it) gets none: the
// canopy covers it anyway, and a pad per pine would cost the bake for nothing.
function layLees() {
  leeCell = new Array(WORLD * WORLD).fill(null);
  if (PRACTICE) return;
  const wx = driftWind.dx, wy = driftWind.dy;
  for (let ty = 1; ty < WORLD - 1; ty++) for (let tx = 1; tx < WORLD - 1; tx++) {
    const o = objects[idx(tx, ty)];
    if (!o || !(driftBreak(tx, ty) || o.type === 'stump')) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && driftBreak(tx + dx, ty + dy)) n++;
    if (n >= LEE_WOODS) continue;
    const h = hash2(tx * 13 + 7, ty * 11 + 3);
    const D = {
      x: tx + 0.5 + wx * 0.5, y: ty + 0.5 + wy * 0.5, dx: wx, dy: wy,
      len: 1.5 + h, wid: 0.8 + 0.3 * h, head: 0.5, amp: LEE_AMP * (0.8 + 0.2 * h), bend: 0, rag: null,
    };
    const k = Math.ceil((D.len + D.head) / DRIFT_RAG_STEP) + 2;
    D.rag = new Float32Array(k * 2);
    for (let s = 0; s < 2; s++) for (let i = 0; i < k; i++) D.rag[s * k + i] = (vnoise(i * 0.4 + tx * 1.9, s * 5.3 + ty * 1.1) - 0.5) * 2;
    for (const q of driftTiles(D, 0)) {
      const i = idx(q.tx, q.ty);
      (leeCell[i] || (leeCell[i] = [])).push(D);
    }
  }
}
