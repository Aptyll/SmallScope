'use strict';
// ------------------------------------------------------------ lanes
// THE SIDE LANES: besides the mid road down the diagonal, two more lanes
// join the bases - the TOP lane round the top-left side of the valley and
// the BOT lane round the bottom-right - each out of its own mouth in either
// hollow (baseGate, js/sim/base.js), along the inside of the treeline, to a
// ford over the creek at the map's middle. They are fixed cuts, the same on
// every seed: control points in the road's frame (baseTile), smoothed, so
// RED's half and BLUE's mirror along the road and the bot lane mirrors the
// top across it.
//
// A lane IS road, like a path: roadDist mins over sideLaneDist, so placeRoad
// paves it with the mid road in its one pass (fells the pines and rocks on it,
// turns ice to road), both maps ink it and every reader of the road reads it.
// Only it has no ruts (those are measured off the diagonal), and each side
// strings its own cable down it (laneZipTiles, below). Laid by
// layLanes at boot after the paths and before placeRoad (js/app/boot.js), so
// neither genWorld's carve rules nor the paths' search ever saw it.
const LANE_HW = 3;        // tiles either side of the centreline: a six-tile lane, a tile narrower than the mid road across the field
const LANE_RAG = 0.5;     // tiles its edge wanders either way on the position noise
const LANE_SEG = 3;       // tiles of centreline per registered segment
const LANE_FORD_HW = 1.5; // tiles either side of the centreline the creek is forded where a lane crosses it: a three-stone ford
const LANE_ZIP_SPAN = 14;  // tiles along the lane between a side cable's pylons: the mid road's ZIP_SPAN
const LANE_ZIP_MID = 28;   // tiles short of the lane's middle its front terminus stands: the mid road's ZIP_MID_GAP
const LANE_HOLD = 0.6;     // share of the way from a side's mouth to a lane's middle its laner waits at with no column on the lane (laneHold)
const LANE_ZIP_S = 7;      // tiles off the road beside the perch its base pylon stands, on the lane's side: past the crash pad and the mid road's own pylon
// RED's half of the TOP lane, [u, s]: out of the hollow's centre, through the
// top mouth, bending along the treeline, to the creek at the middle
const LANE_HALF = [[BASE_U, 0], [BASE_SIDE_U, -BASE_SIDE_S], [40, -21], [50, -26], [62, -30], [78, -37], [91.5, -41], [104, -49], [(WORLD - 1) / 2, -56]];

// a side lane's centreline, RED's hollow to BLUE's, a point about every
// tile (tile-index space) with `at`, the tiles along it to each. Pure
// geometry, so cached
const laneLineC = [null, null, null];
function laneLine(lane) {
  if (laneLineC[lane]) return laneLineC[lane];
  const side = lane === 0 ? 1 : -1;
  const half = LANE_HALF.map(([u, s]) => [u, s * side]);
  const ctl = half.concat(half.slice(0, -1).reverse().map(([u, s]) => [WORLD - 1 - u, s])).map(([u, s]) => baseTile(0, u, s));
  const pts = [];
  for (let i = 0; i < ctl.length - 1; i++) { // Catmull-Rom through the control points
    const p0 = ctl[Math.max(0, i - 1)], p1 = ctl[i], p2 = ctl[i + 1], p3 = ctl[Math.min(ctl.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2.tx - p1.tx, p2.ty - p1.ty)));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      pts.push({ x: cr(p0.tx, p1.tx, p2.tx, p3.tx), y: cr(p0.ty, p1.ty, p2.ty, p3.ty) });
    }
  }
  const last = ctl[ctl.length - 1];
  pts.push({ x: last.tx, y: last.ty });
  const at = [0];
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return (laneLineC[lane] = { pts, at });
}
// the point `d` tiles along a lane's centreline
function laneAt(L, d) {
  let i = 1;
  while (i < L.at.length - 1 && L.at[i] < d) i++;
  const a = L.pts[i - 1], b = L.pts[i], k = Math.max(0, Math.min(1, (d - L.at[i - 1]) / ((L.at[i] - L.at[i - 1]) || 1)));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}
// how far along a lane's centreline its point nearest (tx, ty) lies
function laneAlong(L, tx, ty) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < L.pts.length; i++) {
    const d = Math.hypot(L.pts[i].x - tx, L.pts[i].y - ty);
    if (d < bd) { bd = d; best = L.at[i]; }
  }
  return best;
}

// the registry roadDist reads: both lanes' segments, and the per-tile index
// over them (indexSegs, js/sim/world.js); null until laid
const laneSegs = [];
let laneA = null, laneB = null;
// signed distance (tiles) from the nearest side lane's ragged edge, negative
// inside - 99 before layLanes, and on the practice field
function sideLaneDist(fx, fy) {
  if (!laneA) return 99;
  const lat = segsLat(laneSegs, laneA, laneB, fx, fy);
  if (lat >= 99) return 99;
  return lat - (LANE_HW + (vnoise(fx * 0.3 + 13.1, fy * 0.3 + 77.2) - 0.5) * 2 * LANE_RAG);
}
// Runs at boot after layPaths, before placeRoad (js/app/boot.js): registers
// both lanes, and fords the creek where each crosses it. No rng(): no seed moves.
function layLanes() {
  laneSegs.length = 0; laneA = laneB = null;
  if (PRACTICE) return;
  for (const lane of [0, 2]) {
    const P = laneLine(lane).pts;
    for (let i = 0; i < P.length - 1; i += LANE_SEG) {
      const j = Math.min(P.length - 1, i + LANE_SEG);
      addSeg(laneSegs, P[i].x, P[i].y, P[j].x, P[j].y);
    }
  }
  const ix = indexSegs(laneSegs, LANE_HW + LANE_RAG + ROAD_SHOULDER + 2.4); // past this no pixel of a tile is the lane's or its shoulder's
  laneA = ix.A; laneB = ix.B;
  // the fords: stones on the creek LANE_FORD_HW either side of the
  // centreline, laid along the lane whichever way the water bends there
  for (let i = 0; i < WORLD * WORLD; i++) {
    if (ground[i] === 4 && segsLat(laneSegs, laneA, laneB, i % WORLD, (i / WORLD) | 0) < LANE_FORD_HW) ground[i] = 5;
  }
}
// the march down a side lane: from the side's own mouth to the rival's every
// ROAD_STEP tiles along the centreline (px), then into the rival hollow's
// centre - the bird past it is read live (soldierGoal, js/sim/robots.js)
function laneWaypoints(team, lane) {
  const L = laneLine(lane), g0 = baseGate(team, lane), g1 = baseGate(1 - team, lane);
  const a = laneAlong(L, g0.tx, g0.ty), b = laneAlong(L, g1.tx, g1.ty), pts = [];
  const n = Math.max(1, Math.round(Math.abs(b - a) / ROAD_STEP));
  for (let i = 0; i <= n; i++) {
    const p = laneAt(L, a + (b - a) * i / n);
    pts.push({ x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE });
  }
  const c = baseCentre(1 - team);
  pts.push({ x: (c.tx + 0.5) * TILE, y: (c.ty + 0.5) * TILE });
  return pts;
}
// a side's cable down a side lane (placeZips, js/sim/zipline.js), as pylon
// points in continuous tile-index space, base first: beside the perch on the
// lane's side of the road, then the lane's outer verge from its mouth every
// LANE_ZIP_SPAN to LANE_ZIP_MID short of the middle - the shoulder, never the lane
function laneZipTiles(team, lane) {
  const L = laneLine(lane), sgn = lane - 1; // -1 the top side, +1 the bot
  const b = baseTile(team, PERCH_U, sgn * LANE_ZIP_S), tiles = [{ x: b.tx, y: b.ty }];
  const g = baseGate(team, lane), a = laneAlong(L, g.tx, g.ty), mid = L.at[L.at.length - 1] / 2;
  const dir = team === 0 ? 1 : -1, end = mid - dir * LANE_ZIP_MID, off = LANE_HW + LANE_RAG + ZIP_OUT;
  for (let d = a; ; d += dir * LANE_ZIP_SPAN) {
    const last = (end - d) * dir < LANE_ZIP_SPAN * 0.4; // a stub of a span at the end joins the one before it
    if (last) d = end;
    const p = laneAt(L, d), q = laneAt(L, d + 1), r = laneAt(L, d - 1);
    let nx = r.y - q.y, ny = q.x - r.x;
    const nl = Math.hypot(nx, ny) || 1;
    if ((nx + ny) * sgn < 0) { nx = -nx; ny = -ny; } // the outer side: away from the road
    tiles.push({ x: p.x + nx / nl * off, y: p.y + ny / nl * off });
    if (last) break;
  }
  return tiles;
}
// where a side's laner waits on a lane with no column of its own on it
// (aiLaneSpot, js/ai/ai-farm.js): LANE_HOLD of the way from the side's own
// mouth to the lane's middle, in px - the mid road's on its centreline
function laneHold(team, lane) {
  if (lane === 1) {
    const u = roadNest(team).u;
    return roadPoint(u + ((WORLD - 1) / 2 - u) * LANE_HOLD);
  }
  const L = laneLine(lane), g = baseGate(team, lane), a = laneAlong(L, g.tx, g.ty), mid = L.at[L.at.length - 1] / 2;
  const p = laneAt(L, a + (mid - a) * LANE_HOLD);
  return { x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE };
}
