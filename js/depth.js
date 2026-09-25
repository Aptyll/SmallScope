'use strict';
// The valley's one map of how deep the snow lies, and the deep snow that
// slows a body in its deepest band.
// ------------------------------------------------------------ snow depth
// Snow piles where the wind drops it: in the lee of whatever breaks the wind.
// layDrifts (boot, after every worldgen pass has stood the scenery up) picks
// the seed's prevailing wind, finds the obstacles that shelter the most open
// snow behind them - the treeline, a stand, a rock pile, a camp's hut - and
// lays a DRIFT in each one's lee: a blunt crest against the obstacle and a
// long tail tapering downwind, every drift on the map leaning the same way.
// snowDepth(fx, fy) is the whole map - the tallest drift at a point, over a
// shallow dusting in the hollows - and every system that cares how deep the
// snow is asks it: the sim's slowdown reads the DEEP band (deepAt), the
// ground bake draws that band's rim (js/draw/depth.js), and the lighter bands
// are there for anything that dresses the snow. A pure function of the seed
// and the scenery worldgen stood up: hash2/vnoise only, not one rng() call,
// so no seed's world moves and every client lays the same map.
const DEPTH_DEEP = 0.6;     // snowDepth at and above which snow is DEEP: the slow band
const DEPTH_MID = 0.25;     // ...and the band under it: a drift you see but do not wade
const DEEP_WALK = 0.7;      // share of walking speed left fully in deep snow
const DEEP_DODGE = 0.85;    // ...of a dodge roll's travel
const DEEP_SLIDE = 2;       // a slide's friction is multiplied by this in deep snow...
const DEEP_SLIDE_BAR = 0.5; // ...and one cannot START with the wade past this
const DEEP_EASE = 12;       // 1/s the wade eases in and out: ~95% of the way in a quarter second
const DEEP_PUFF_T = 0.14;   // s between the puffs a body wading at speed kicks up
const DEEP_COVER = 0.085;   // share of the interior's open snow the deep band may cover
const DRIFT_GAP = 2;        // tiles of undrifted snow kept between two drifts' deep cores
const DRIFT_HEAD = 6;       // tiles two drift crests stand apart at the least
const DRIFT_KEEP_ROAD = 3;  // tiles off the road's (and a path's) edge
const DRIFT_KEEP_CAMP = 5;  // ...past a camp's cleared ground (r + 2)
const DRIFT_KEEP_ROOST = 8; // ...past each roost corner's woods (ROOST_R)
const DRIFT_KEEP_WET = 2;   // ...from ice, a hole, the creek or a ford
const DRIFT_HOLLOW = 0.2;   // the deepest a hollow's dusting gets: under DEPTH_MID, a dusting and never a drift
const DRIFT_FAIR = 1.25;    // the most deep snow one side's half may hold, as a multiple of the other's
const DRIFT_WIND_ARC = 0.4; // rad either side of the creek's line the prevailing wind may blow
const DRIFT_RAG = 0.16;     // how far a drift's edge wanders either way, as a share of its width
const LEE_AMP = 0.42;       // the tallest pad of snow in one object's own lee: the MID band, never DEPTH_DEEP
const LEE_WOODS = 4;        // breakers among its eight neighbours past which an object is forest floor and gets no pad
const DRIFT_RAG_STEP = 0.25; // tiles along a drift per sample of its edge's wander
const drifts = [];          // { x, y, dx, dy, head, len, wid, amp, bend, rag } in tile space
let driftCell = null;       // per tile: the drifts whose skirt reaches it (null for none)
let leeCell = null;         // per tile: the lee pads (below) that reach it (null for none)
const driftWind = { ang: 0, dx: 1, dy: 0 }; // the prevailing wind, blowing toward (dx, dy)

// ---- the shape --------------------------------------------------------------
// One drift's depth at a tile-space point. In the drift's own frame u runs
// downwind from the crest and v across it; the half-width is a rounded head
// upwind of the crest and a tail tapering to nothing at `len`, bent a little
// on `bend` and wandering on the pre-sampled `rag`. Depth falls off across
// the width as 1 - q^2, so a drift is a smooth mound: its DEEP core is the
// inner part of a wider skirt, and a drift whose amp is under DEPTH_DEEP is a
// skirt alone.
function driftDepth(D, fx, fy) {
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
// ...the drifts' share of it alone: the only share that reaches DEPTH_DEEP
// (a hollow tops out at DRIFT_HOLLOW), so what asks after the deep band
// alone skips the hollows' noise
function driftsDepth(fx, fy) {
  const tx = Math.floor(fx), ty = Math.floor(fy);
  const L = driftCell && inWorld(tx, ty) ? driftCell[idx(tx, ty)] : null;
  let d = 0;
  if (L) for (let k = 0; k < L.length; k++) { const e = driftDepth(L[k], fx, fy); if (e > d) d = e; }
  return d;
}
function snowDepthPx(x, y) { return snowDepth(x / TILE, y / TILE); }
// is this world point in DEEP snow? Only open snow holds it - a runtime
// paving or a hole takes it away with the ground.
function deepAt(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (!inWorld(tx, ty) || ground[idx(tx, ty)] !== 0 || !driftCell[idx(tx, ty)]) return false;
  return driftsDepth(x / TILE, y / TILE) >= DEPTH_DEEP;
}

// ---- laying the drifts ----------------------------------------------------
// what breaks the wind: anything worldgen stood up that stands above the
// snow (a pine, a snag, a rock, a chest, a den, a hut) and the berry bushes,
// which trap it the way a hedge does
function driftBreak(tx, ty) {
  const o = objAt(tx, ty);
  return !!o && (o.type === 'bush' || !!(OBJECTS[o.type] && OBJECTS[o.type].solid) || o.type === 'part');
}
// ...and what it drifts over: a rock or a bush goes under a drift's tail, a
// pine or a chest stops it
function driftBury(tx, ty) {
  const o = objAt(tx, ty);
  return !o || o.type === 'rock' || o.type === 'bush';
}
// may a drift's skirt lie on this tile at all?
function driftFree(tx, ty) {
  if (!inWorld(tx, ty) || ground[idx(tx, ty)] !== 0) return false;
  if (roadDist(tx, ty) < DRIFT_KEEP_ROAD) return false;
  if (Math.hypot(tx - cx, ty - cy) < CENTER_R + 4) return false;
  if (Math.hypot(tx, ty - (WORLD - 1)) < ROOST_R + DRIFT_KEEP_ROOST) return false;
  if (Math.hypot(tx - (WORLD - 1), ty) < ROOST_R + DRIFT_KEEP_ROOST) return false;
  for (const C of camps) if (Math.hypot(tx - C.tx, ty - C.ty) < C.r + 2 + DRIFT_KEEP_CAMP) return false;
  for (let dy = -DRIFT_KEEP_WET; dy <= DRIFT_KEEP_WET; dy++) for (let dx = -DRIFT_KEEP_WET; dx <= DRIFT_KEEP_WET; dx++) {
    const g = inWorld(tx + dx, ty + dy) ? ground[idx(tx + dx, ty + dy)] : 0;
    if (g === 1 || g === 2 || g === 4 || g === 5) return false;
  }
  return true;
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
function layDrifts() {
  drifts.length = 0;
  driftCell = new Array(WORLD * WORLD).fill(null);
  if (PRACTICE) return;
  // the prevailing wind: within DRIFT_WIND_ARC of the creek's line, either
  // way along it. The upwind treeline is then the one the creek cuts in two,
  // so each side's half of the valley gets its share of drifts - a wind down
  // the road would bury one roost's approach and leave the other bare.
  const a = Math.PI / 4 + (hash2(9011, 373) - 0.5) * 2 * DRIFT_WIND_ARC + (hash2(17, 9901) < 0.5 ? Math.PI : 0);
  driftWind.ang = a; driftWind.dx = Math.cos(a); driftWind.dy = Math.sin(a);
  // ...and the ground's swells (SNOW_ANG, js/draw/ground.js) lie along it, so
  // every texture the snow wears leans the one way; the bake reads them after
  SNOW_ANG = a; SNOW_C = driftWind.dx; SNOW_S = driftWind.dy;
  const wx = driftWind.dx, wy = driftWind.dy;
  // every obstacle with open snow in its lee, scored by how much wind it breaks:
  // the solid tiles in the half-disc upwind of it
  let open = 0;
  const cand = [];
  for (let ty = BORDER_MIN - 8; ty < WORLD - BORDER_MIN + 8; ty++) for (let tx = BORDER_MIN - 8; tx < WORLD - BORDER_MIN + 8; tx++) {
    if (ground[idx(tx, ty)] === 0 && !objects[idx(tx, ty)] && tx >= BORDER_MIN && ty >= BORDER_MIN &&
      tx < WORLD - BORDER_MIN && ty < WORLD - BORDER_MIN) open++;
    if (!driftBreak(tx, ty)) continue;
    const lx = Math.round(tx + wx * 1.3), ly = Math.round(ty + wy * 1.3);
    if (!inWorld(lx, ly) || !driftBury(lx, ly) || !driftFree(lx, ly)) continue;
    let shelter = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      if (dx * dx + dy * dy > 16 || dx * wx + dy * wy > 0.5) continue;
      if (driftBreak(tx + dx, ty + dy)) shelter++;
    }
    // the lee's open run: how far downwind the snow stays clear
    let run = 0;
    while (run < 22) {
      const rx = Math.round(tx + wx * (run + 1.5)), ry = Math.round(ty + wy * (run + 1.5));
      if (!inWorld(rx, ry) || !driftBury(rx, ry) || !driftFree(rx, ry)) break;
      run++;
    }
    if (run < 4) continue;
    // drifts gather in groups with open lanes between: a low noise over the
    // valley decides where the wind has been dropping its load
    const grp = vnoise(tx / 24 + 7.3, ty / 24 + 19.1);
    if (grp < 0.3) continue;
    const h = hash2(tx * 7 + 3, ty * 13 + 5);
    cand.push({ tx, ty, shelter, run, score: shelter * (0.55 + 0.45 * h) * (0.6 + grp) });
  }
  window.DRDBG = { cand: cand.length, spaced: 0, bad: 0 };
  cand.sort((p, q) => q.score - p.score || p.ty - q.ty || p.tx - q.tx);
  const goal = open * DEEP_COVER;
  const taken = new Uint8Array(WORLD * WORLD); // 1 = a drift's skirt, 2 = its deep core or the gap round it
  let deep = 0;
  for (const c of cand) {
    if (deep >= goal) break;
    const h1 = hash2(c.tx * 31 + 1, c.ty * 29 + 2), h2 = hash2(c.tx * 5 + 9, c.ty * 3 + 4), h3 = hash2(c.tx + 77, c.ty * 7 + 1);
    const big = Math.min(1, c.shelter / 22);
    const D = {
      x: c.tx + 0.5 + wx * 1.1, y: c.ty + 0.5 + wy * 1.1, dx: wx, dy: wy,
      len: Math.min(c.run + 1, 8 + 12 * big + 5 * h1), wid: 1.7 + 1.5 * big + 0.6 * h2,
      amp: 0.5 + 0.6 * Math.min(1, c.shelter / 10) + 0.12 * h3, bend: (h2 - 0.5) * 0.22, head: 0, rag: null,
    };
    D.head = D.wid * 0.6;
    if (drifts.some((E) => Math.hypot(E.x - D.x, E.y - D.y) < DRIFT_HEAD)) { DRDBG.spaced++; continue; }
    // the edge's wander, sampled along the drift for both sides
    const n = Math.ceil((D.len + D.head) / DRIFT_RAG_STEP) + 2;
    D.rag = new Float32Array(n * 2);
    for (let s = 0; s < 2; s++) for (let i = 0; i < n; i++) {
      D.rag[s * n + i] = (vnoise(i * DRIFT_RAG_STEP * 0.8 + c.tx * 1.7, s * 5.3 + c.ty * 1.3) - 0.5) * 2;
    }
    // shorten a drift that runs into what it may not cover, rather than cut it
    let tiles = null;
    for (let tries = 0; tries < 3 && D.len >= 4; tries++) {
      const T = driftTiles(D, 0);
      const bad = T.some((q) => (q.d > 0.05 && !driftFree(q.tx, q.ty) && !driftBreak(q.tx, q.ty)) ||
        (q.d >= DEPTH_DEEP && taken[idx(q.tx, q.ty)] === 2));
      if (!bad) { tiles = T; break; }
      D.len *= 0.72; D.wid *= 0.88; D.head = D.wid * 0.6;
    }
    if (!tiles) { DRDBG.bad++; continue; }
    drifts.push(D);
    D.deep = 0; D.side = D.x < D.y ? 0 : 1; // which side's half of the valley (the creek's line splits them)
    for (const q of tiles) if (q.d >= DEPTH_DEEP) {
      deep++; D.deep++;
      for (let dy = -DRIFT_GAP; dy <= DRIFT_GAP; dy++) for (let dx = -DRIFT_GAP; dx <= DRIFT_GAP; dx++) {
        if (inWorld(q.tx + dx, q.ty + dy)) taken[idx(q.tx + dx, q.ty + dy)] = 2;
      }
    }
  }
  // FAIR SHARES: the valley's two halves are the two sides' approaches, so
  // neither may hold more than DRIFT_FAIR times the other's deep snow - the
  // richer half gives up its weakest drifts (the last taken) until it doesn't
  const half = [0, 0];
  for (const D of drifts) half[D.side] += D.deep;
  for (let i = drifts.length - 1; i >= 0; i--) {
    const D = drifts[i], o = half[1 - D.side];
    if (half[D.side] > DRIFT_FAIR * o && D.deep > 0 && half[D.side] - D.deep >= o / DRIFT_FAIR) {
      half[D.side] -= D.deep; drifts.splice(i, 1);
    }
  }
  // index every drift on each tile its skirt, rim or shade reaches
  for (const D of drifts) for (const q of driftTiles(D, 0.2)) {
    const i = idx(q.tx, q.ty);
    (driftCell[i] || (driftCell[i] = [])).push(D);
  }
  layLees();
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

// ---- wading -------------------------------------------------------------------
// e.wade is how deep in it a body is, 0..1, easing toward where its feet are
// at DEEP_EASE: every unit, a player included, ages it in updateUnitStatus
// (js/actions.js), so the slowdown eases in over a step or two instead of
// stopping anyone at a line. A body in the air, on the cable or in the water
// is in none of it.
function wadeStep(e, dt) {
  const air = e instanceof Player ? (inAir(e) || e.zip >= 0 || e.fallT > 0 || e.dead) : (e.kind === 'bird' || e.dead);
  const want = !air && deepAt(e.x, e.y + 4) ? 1 : 0;
  const w0 = e.wade || 0;
  e.wade = want + (w0 - want) * Math.exp(-DEEP_EASE * dt);
  if (e.wade < 0.01) e.wade = 0;
  // the snow a wading body shoves aside: a puff at the feet while it is moving
  const px = e.wadeX === undefined ? e.x : e.wadeX, py = e.wadeY === undefined ? e.y : e.wadeY;
  const sp = dt > 0 ? Math.hypot(e.x - px, e.y - py) / dt : 0;
  e.wadeX = e.x; e.wadeY = e.y;
  if (e.wade > 0.5 && sp > 12) {
    e.wadePuffT = (e.wadePuffT || 0) - dt;
    if (e.wadePuffT <= 0) {
      e.wadePuffT = DEEP_PUFF_T;
      burst(e.x + (hash2(state.tick, e.x | 0) - 0.5) * 6, e.y + 4, '#f2f7fc', 2, 18, 0.35, true);
    }
  }
}
// what is left of a body's walking speed for the snow it is standing in
function wadeMul(e) { return 1 - (1 - DEEP_WALK) * (e.wade || 0); }
