'use strict';
// ------------------------------------------------------------ jungle
// THE JUNGLE WALLS: pine walls planted in the four quarters between the
// lanes, so the open field reads as a Rift jungle - paths between the camps,
// a wall between the mid road and the camps, a wall between the camps and
// the river - with gaps where you walk in. Fixed cuts like the lanes: each
// wall is a capsule in the road's frame (baseTile), written once for RED's
// top quarter and mirrored onto the other three (across the road, s -> -s,
// and across the creek, u -> WORLD - 1 - u), so both sides walk the same
// paths. Laid at boot after placeTowers and before placeCamps
// (js/app/boot.js), on no rng(): no seed moves. A camp clears its own site
// after, and a brush patch fells what stands in it (layBrush, depth.js).
const JUNGLE_WALLS = [ // [u0, s0, u1, s1, r]: a capsule from (u0, s0) to (u1, s1), r tiles thick each side
  [80, -15, 99, -15, 1.8],   // the mid wall: between the mid road's brush and the den
  [106, -17, 109, -27, 2],   // the river wall: between the den and the creek
  [55, -14, 64, -18, 1.8],   // the base wall: the near camp's door off the mid road
  [82, -36, 92, -36, 1.5],   // between the den and the warren, joining the warren's ring
  [105, -68, 112, -76, 3],   // the corner block: the lane's corner gank paths round it
].map(([u0, s0, u1, s1, r]) => [u0 * MAP_K, s0 * MAP_K, u1 * MAP_K, s1 * MAP_K, r]); // MAP_K spreads where they stand, never their thickness
const JUNGLE_RAG = 0.8;       // tiles a wall's edge wanders either way, on the position hash
const JUNGLE_ROAD_KEEP = 4;   // tiles off any road's edge a wall keeps: the lanes, their shoulders and the cables stay clear

// the four copies of every wall, in tile space
function jungleWalls() {
  const out = [];
  for (const [u0, s0, u1, s1, r] of JUNGLE_WALLS) {
    for (const [fu, fs] of [[0, 1], [0, -1], [1, 1], [1, -1]]) {
      const U = (u) => fu ? WORLD - 1 - u : u;
      const a = baseTile(0, U(u0), s0 * fs), b = baseTile(0, U(u1), s1 * fs);
      out.push({ ax: a.tx, ay: a.ty, bx: b.tx, by: b.ty, r });
    }
  }
  return out;
}
// tiles from a wall's centre segment to a tile-space point
function jungleLat(w, fx, fy) {
  const dx = w.bx - w.ax, dy = w.by - w.ay, L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((fx - w.ax) * dx + (fy - w.ay) * dy) / L));
  return Math.hypot(fx - w.ax - t * dx, fy - w.ay - t * dy);
}
// plant the walls: a pine on every free snow or ice tile inside a capsule's
// ragged edge, nowhere near a road, the water, the cistern or a base
function layJungle() {
  if (PRACTICE) return;
  for (const w of jungleWalls()) {
    const R = w.r + JUNGLE_RAG + 1;
    const x0 = Math.floor(Math.min(w.ax, w.bx) - R), x1 = Math.ceil(Math.max(w.ax, w.bx) + R);
    const y0 = Math.floor(Math.min(w.ay, w.by) - R), y1 = Math.ceil(Math.max(w.ay, w.by) + R);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!inWorld(tx, ty)) continue;
      const d = jungleLat(w, tx + 0.5, ty + 0.5);
      if (d > w.r + (hash2(tx * 5 + 11, ty * 5 + 7) - 0.5) * 2 * JUNGLE_RAG) continue;
      const i = idx(tx, ty);
      if (objects[i] || (ground[i] !== 0 && ground[i] !== 1) || waterAt(tx, ty) || cisternTouches(tx, ty)) continue;
      if (roadDist(tx, ty, true) < JUNGLE_ROAD_KEEP || baseAt(tx, ty, BASE_KEEP) >= 0) continue;
      ground[i] = 0;
      placeObj(tx, ty, 'tree', { hp: TREE_HP, rare: treeRare(tx, ty) });
    }
  }
}
