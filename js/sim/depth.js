'use strict';
// The field's one map of how deep the snow lies, and the deep snow that is
// the field's BRUSH: hand-placed patches a body hides in.
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
// of the map and the scenery worldgen stood up: hash2/vnoise only, not one
// rng() call, so every client lays the same map.
const DEPTH_DEEP = 0.6;     // snowDepth at and above which snow is DEEP: the brush
const DEPTH_MID = 0.25;     // ...and the band under it: a drift you see but do not hide in
const DRIFT_HOLLOW = 0.2;   // the deepest a hollow's dusting gets: under DEPTH_MID, a dusting and never a drift
const DRIFT_WIND_ARC = 0.4; // rad either side of the field's diagonal the prevailing wind may blow
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
// the shallow dusting in the field's hollows: low on the position noise
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
// is this world point in DEEP snow - in the brush? Only open snow holds it:
// a runtime paving or a hole takes it away with the ground.
function deepAt(x, y) { return !!brushOf(x, y); }
// ...and WHICH patch (a drift of `drifts`), or null: the one the fog of war
// hides a body in (js/sim/fog.js). The same depth the ground bake draws, bar
// the few pixels its painted edge wanders (DEEP_RAG, js/draw/depth.js).
function brushOf(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (!inWorld(tx, ty) || ground[idx(tx, ty)] !== 0) return null;
  const L = driftCell && driftCell[idx(tx, ty)];
  if (L) for (let k = 0; k < L.length; k++) if (driftDepth(L[k], x / TILE, y / TILE) >= DEPTH_DEEP) return L[k];
  return null;
}

// ---- the brush ---------------------------------------------------------------
// THE BRUSH: deep snow, hand-placed - the same patches every match, each a
// stand of frosted reeds in a drift (js/draw/depth.js draws both) that hides
// whoever is in it from the other side (brushHide, js/sim/fog.js). The patches
// are the field's FIELD_BRUSH (js/sim/field.js): stadiums listed for RED's top
// quarter and laid in all four (fieldFour), a patch on the middle row or
// column laid once as its own twin. Its rim wanders, and the wander reads the
// quarter's own folded point (fieldFold), so the four copies are mirror images
// by construction.
const BRUSH_AMP = 0.95;   // the depth in a patch past its rim's slope
const BRUSH_EDGE = 0.6;   // tiles in from the rim it takes to reach BRUSH_AMP
const BRUSH_SKIRT = 1;    // tiles out from the rim its skirt (the MID band) runs
const BRUSH_WOB = 0.16;   // how far the rim wanders in two or three slow lobes, as a share of the radius...
const BRUSH_WOB2 = 0.07;  // ...and in smaller bays and bulges on top, so no patch reads as a drawn oval
const BRUSH_CLEAR = 1;    // tiles out from the rim the scenery is cleared and the ice turned to snow
const brushes = [];       // the patches, as drifts with brush: true (also in drifts)
// tiles in from a deep drift's rim at a tile-space point (negative outside):
// how the fog of war asks whether an eye is in a patch or right next to it
function brushIn(D, fx, fy) {
  if (D.pool) return poolIn(D, fx, fy) - DEPTH_DEEP / D.amp * D.edge; // a pool is deep from there in
  const x = fieldFold(fx), y = fieldFold(fy), r = Math.min(D.hx, D.hy);
  const th = Math.atan2(y - D.qy, x - D.qx);
  const wob = BRUSH_WOB * (vnoise(Math.cos(th) * 2 + D.key * 7.3, Math.sin(th) * 2 + D.key * 3.1) - 0.5) * 2
    + BRUSH_WOB2 * (vnoise(Math.cos(th) * 5 + D.key * 11.7, Math.sin(th) * 5 + D.key * 5.9) - 0.5) * 2;
  return wob * r - fieldBox(x, y, D.qx - D.hx, D.qy - D.hy, D.qx + D.hx, D.qy + D.hy, r);
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
// lay the patches, all four quarters', and clear what stands in them: the
// pines, stumps and snags inside BRUSH_CLEAR of the rim (never a wall pine:
// the field's edge stands), and the ice (to snow). Anything else on a tile
// there - a camp's prop - stands, and the reeds round it. No rng(): placed,
// never rolled.
function layBrush() {
  brushes.length = 0;
  FIELD_BRUSH.forEach(([qx, qy, hx, hy], k) => {
    const seen = new Set();
    for (const [x, y] of fieldFour(qx, qy)) {
      if (seen.has(x + ',' + y)) continue; // on the middle row or column: its own twin
      seen.add(x + ',' + y);
      const D = {
        brush: true, key: k, qx, qy, hx, hy, x, y,
        len: Math.max(hx, hy) * (1 + BRUSH_WOB + BRUSH_WOB2) + BRUSH_SKIRT, head: 0, wid: 0, bend: 0, // driftTiles' reach
      };
      brushes.push(D); drifts.push(D);
      const R = Math.ceil(D.len + BRUSH_CLEAR);
      for (let ty = Math.floor(D.y - R); ty <= D.y + R; ty++) for (let tx = Math.floor(D.x - R); tx <= D.x + R; tx++) {
        if (!inWorld(tx, ty) || brushIn(D, tx + 0.5, ty + 0.5) < -BRUSH_CLEAR) continue;
        const i = idx(tx, ty), o = objects[i];
        if (ground[i] === 1) ground[i] = 0;
        if (o && BRUSH_FELLS[o.type] && !o.wall) objects[i] = null;
      }
    }
  });
}
const BRUSH_FELLS = { tree: true, stump: true, snag: true };

// ---- laying the drifts ----------------------------------------------------
// what breaks the wind: anything worldgen stood up that stands above the
// snow (a pine, a snag, a den) - each holds a lee pad (layLees)
function driftBreak(tx, ty) {
  const o = objAt(tx, ty);
  return !!o && (!!(OBJECTS[o.type] && OBJECTS[o.type].solid) || o.type === 'part');
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
  // the prevailing wind: within DRIFT_WIND_ARC of the field's diagonal,
  // either way along it (the lee pads are dress, never cover: LEE_AMP)
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
// THE WARRENS' SNOW (CAMPS.meadow, js/sim/camps.js): each warren holds a
// round pool of deep snow - brush like any other - that fills its clearing,
// its rim wandering on a fixed wave in the camp's own mirrored frame (C.fx,
// C.fy), so all four warrens wear the same pool, mirrored. MEADOW_POOL in
// tiles: `r` the pool's radius off the camp's centre, `edge` how far in from
// its rim it takes to reach full depth. Its rabbits never leave it
// (warrenHolds, js/sim/wildlife.js).
const MEADOW_POOL = { r: 4.6, edge: 1.2 };
const MEADOW_AMP = 0.95;
function layMeadowDrifts() {
  for (const C of camps) {
    if (C.key !== 'meadow') continue;
    const P = MEADOW_POOL;
    drifts.push({
      pool: true, x: C.tx + 0.5, y: C.ty + 0.5, fx: C.fx, fy: C.fy, r: P.r, edge: P.edge, amp: MEADOW_AMP,
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
  const a = (fx - D.x) * D.fx, o = (fy - D.y) * D.fy, th = Math.atan2(a, o);
  return D.r * (1 + 0.05 * Math.cos(5 * th) + 0.03 * Math.cos(3 * th)) - Math.hypot(a, o);
}

// Every standing thing out in the open - a pine on the treeline's edge or in
// a stand's fringe, a stump, a snag, a den - holds a
// small pad of snow in its own lee along driftWind: the same drift shape at a
// tile or two long and LEE_AMP tall, so it lives in the MID band and never
// slows anybody. Forest floor (LEE_WOODS breakers round it) gets none: the
// canopy covers it anyway, and a pad per pine would cost the bake for nothing.
function layLees() {
  leeCell = new Array(WORLD * WORLD).fill(null);
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
