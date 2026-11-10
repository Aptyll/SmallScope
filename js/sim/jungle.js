'use strict';
// ------------------------------------------------------------ jungle
// THE JUNGLE: the field inside the lanes is a Rift jungle, laid out by hand.
// Everything between the mid road and the side lanes is planted solid with
// pines, and the walk space is CUT out of it: the paths between the camps,
// the clearings round them and round the brush, a strip along every road,
// the creek and its banks, and the open ground round the cistern. So what
// stands is a set of designed walls with rounded edges, not worldgen's
// scatter, and the corridors are where a League jungler would walk: a spine
// from the base side through the den to the river, a mid entrance and a lane
// entrance into each den, a corner path from the side lane to the river, and
// a river mouth beside mid.
//
// Fixed cuts like the lanes: every path and clearing is written once in the
// road's frame (baseTile: u along the road from RED's corner, s across it,
// at the old 232-tile scale, spread by MAP_K like the camps) for RED's top
// quarter and mirrored onto the other three (across the road, s -> -s, and
// across the creek, u -> WORLD - 1 - u), so both sides walk the same routes. Laid at boot after placeTowers and before
// placeCamps (js/app/boot.js): a camp clears its own site after, and a
// brush patch's drift lies on ground kept open for it. The edges wander on
// vnoise alone and nothing rolls: one map, the same on every screen.
const JUNGLE_PATHS = [ // [[u, s], ...] a path through these points (old 232-tile scale, MAP_K spreads them), and its half-width (tiles)
  [[[58.33, 11.67], [79.17, 18.33], [90, 25], [103.33, 28.33], [115, 30]], 3.6], // the spine: base side, the den, the river
  [[[80, 5], [86.67, 18.33]], 3.4], // the mid entrance into the den
  [[[86.67, 30], [80, 41.67], [77.5, 48.33]], 3.4], // the den out to the side lane
  [[[100, 75], [108.33, 63.33], [115, 58.33]], 3.6], // the corner: the side lane to the river
  [[[93.33, 31.67], [99.17, 44.17], [105, 51.67], [108.33, 63.33]], 3.4], // the den past the warren to the corner
  [[[103.33, 6.67], [110, 15], [115, 18.33]], 3.6], // the river mouth beside mid
].map(([pts, hw]) => [pts.map(([u, s]) => [u * MAP_K, s * MAP_K]), hw]);
const JUNGLE_CLEARINGS = [ // [u, s, r]: an open disc: where it stands spread by MAP_K, never its size
  [90, 25, 9], // the den's
  [(WORLD - 1) / 2 / MAP_K, 35, 15], // the two objectives on the mirror line: the orca's pool and the bear's bend
  [103.33, 28.33, 6], // the spine meets the warren's path
  [108.33, 63.33, 6], // the corner
].map(([u, s, r]) => [u * MAP_K, s * MAP_K, r]);
const JUNGLE_RAG = 1.4;        // tiles a wall's edge wanders either way, on a slow noise: rounded bays and bulges, never a ragged pixel line
const JUNGLE_RAG_FREQ = 1 / 5; // ...the noise's frequency, per tile
const JUNGLE_ROAD_KEEP = 5;    // tiles off any road's edge nothing is planted: the lanes, their shoulders and the cables stay clear
const JUNGLE_CREEK_KEEP = 4.5; // tiles off the frozen creek's banks: its walkable banks
const JUNGLE_CIST_KEEP = 6;    // tiles past the cistern's outer face: the open ground round the middle
const JUNGLE_BRUSH_KEEP = 2;   // tiles round a brush patch's long axis: the drift lies in the open
const JUNGLE_WARREN_KEEP = 11; // tiles round a warren's site: its own drawn ring of pines (CAMPS.meadow's plan) stands alone
const JUNGLE_LANE_S = 12;      // tiles off the mid road past which a road tile walls the inside off (the side lanes)

// the four copies of a point in the road's frame, in tile space
function jungleMirror(u, s) {
  return [[u, s], [WORLD - 1 - u, s], [u, -s], [WORLD - 1 - u, -s]].map(([a, b]) => { const t = baseTile(0, a, b); return [t.tx, t.ty]; });
}
// every cut, in tile space: segments with a half-width, and discs
function jungleCuts() {
  const segs = [], discs = [];
  for (const [pts, hw] of JUNGLE_PATHS) for (let k = 0; k < 4; k++) {
    const q = pts.map(([u, s]) => jungleMirror(u, s)[k]);
    for (let i = 0; i + 1 < q.length; i++) segs.push([q[i], q[i + 1], hw]);
  }
  for (const [u, s, r] of JUNGLE_CLEARINGS) for (const m of jungleMirror(u, s)) discs.push([m[0], m[1], r]);
  for (const [u, s, a] of BRUSH_PATCHES) for (const m of jungleMirror(u, s)) discs.push([m[0], m[1], a + JUNGLE_BRUSH_KEEP]);
  return { segs, discs };
}
// tiles from a segment to a point
function jungleSegD(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L));
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}
// the inside of the lanes: a flood from the middle that the side lanes and
// the bases stop (the mid road it crosses)
function jungleInside() {
  const inside = new Uint8Array(WORLD * WORLD), c = Math.round((WORLD - 1) / 2), q = [idx(c, c)];
  inside[q[0]] = 1;
  while (q.length) {
    const i = q.pop(), x = i % WORLD, y = (i / WORLD) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (!inWorld(X, Y)) continue;
      const j = idx(X, Y);
      if (inside[j] || baseAt(X, Y, BASE_KEEP + 3) >= 0) continue;
      if (roadDist(X, Y, true) < 0.5 && Math.abs(X + Y - (WORLD - 1)) / Math.SQRT2 > JUNGLE_LANE_S) continue; // s across the road (baseTile's frame)
      inside[j] = 1; q.push(j);
    }
  }
  return inside;
}
function layJungle() {
  if (PRACTICE) return;
  const inside = jungleInside(), { segs, discs } = jungleCuts();
  const warrens = campSites().filter((c) => CAMPS[c.key].plan).map((c) => campTile(c.u, c.s));
  const span = creekSpan();
  const open = (tx, ty) => {
    const px = tx + 0.5, py = ty + 0.5, e = (vnoise(tx * JUNGLE_RAG_FREQ + 3.7, ty * JUNGLE_RAG_FREQ + 9.1) - 0.5) * 2 * JUNGLE_RAG;
    for (const [a, b, hw] of segs) if (jungleSegD(px, py, a, b) < hw + e) return true;
    for (const [x, y, r] of discs) if (Math.hypot(px - x, py - y) < r + e) return true;
    if (creekAt(px, py) < JUNGLE_CREEK_KEEP + e * 0.5 && CQ.a >= span.w0 && CQ.a <= span.w1) return true;
    if (roadDist(tx, ty, true) < JUNGLE_ROAD_KEEP + e * 0.5) return true;
    return cisternR(px, py) < CIST_RO + JUNGLE_CIST_KEEP + e * 0.5;
  };
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    const i = idx(tx, ty);
    if (!inside[i]) continue;
    // worldgen's ponds go (the creek's ice stays), and its pines and dead
    // wood, but round a warren, whose ring is its own drawing
    if ((ground[i] === 1 || ground[i] === 2) && !creekIceAt(tx, ty)) ground[i] = 0;
    if (warrens.some((w) => Math.hypot(tx - w.tx, ty - w.ty) < JUNGLE_WARREN_KEEP)) continue;
    const o = objects[i];
    if (o && JUNGLE_FELLS[o.type]) objects[i] = null;
    if (objects[i] || ground[i] !== 0 || open(tx, ty)) continue;
    if (baseAt(tx, ty, BASE_KEEP) >= 0 || cisternTouches(tx, ty)) continue;
    placeObj(tx, ty, 'tree', { hp: TREE_HP, rare: treeRare(tx, ty) });
  }
}
const JUNGLE_FELLS = { tree: true, stump: true, snag: true };
