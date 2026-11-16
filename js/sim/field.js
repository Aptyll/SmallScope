'use strict';
// ------------------------------------------------------------ field
// THE FIELD (3v3): the one map, a Twisted Treeline in the snow. Two lanes
// are the two halves of one rounded rectangle round the middle, each side's
// perch sits on it at the middle of its own end, and a jungle of pine groves
// fills the inside, a creek of rough ice down its middle. Out past the lanes
// the woods close in, but for two pits that open off them: the orca's above
// the top lane, the black bear's below the bottom one.
//
// The whole field is ONE signed distance (fieldOpen): negative on ground a
// body can walk, written for the top-left quarter and folded four ways
// (fieldFold), and the groves' edges then wander on the map's noise read
// folded left to right only (fieldWander): the two sides are mirror images,
// the two halves differ like real woods. The design's ways through
// (FIELD_WAYS) and a clearing round each camp stay open whatever the wander
// does, and fieldGrid closes any sliver under FIELD_PATH wide. Nothing rolls
// and nothing reads the seed: one map, the same on every screen (CLAUDE.md,
// rule 3).
//
// FIELD UNITS: the functions here take field coordinates, where tile (tx,
// ty) covers [tx, tx + 1) and its middle is tx + 0.5 - a px over TILE. The
// readers the rest of the game asks (laneDist, onRoad, baseAt) take tile-index
// coordinates instead, an integer being a tile's middle, as the grid's do.
// RED (team 0) holds the west end, BLUE the east, mirrored across x = WORLD / 2.
const FIELD_C = WORLD / 2;      // the field's middle, both ways
const LANE_HX = 60, LANE_HY = 33; // the lanes' loop: half its width and height round the middle...
const LANE_R = 22;              // ...and its corners' radius
const LANE_HALF = 3.5;          // tiles either side of a lane's centreline that are open: the lane
const ROAD_HALF = 1.4;          // ...and the packed road down the middle of it
const ROAD_SHOULDER = 1.4; // tiles of dirty snow past a lane's edge (the ground's bake only, js/draw/ground.js)
const BASE_X = 10, BASE_R = 12; // a side's perch: RED's x (on the loop, at the middle of its end) and the open disc round it
const PLAZA_R = 6;              // tiles round the perch the plaza's stones are laid
// THE MERCHANT'S COURT, behind each perch on its centre line (the stall stands in it: placeStalls,
// js/sim/robots.js): a bay of the plaza's stones cut back into the woods, and two wings of pines
// that close round it from the base's rim, so the shop sits in a pocket of the trees with both
// lanes the same walk away. Field units from the west edge, mirrored for the east base.
const COURT = [4.6, 3.4, 3.1];  // the paved bay: its middle's x, and its radii along and across the centre line
const COURT_CLEAR = [3.7, 3.5, 0.7, 2]; // the pocket the pines leave round it: radii, tiles its middle sits south of the line (a pine is drawn up from its foot, so the pocket looks even), and the x its back wall of pines keeps
const COURT_WING = [6.4, 6.5, 0.55]; // the wings: the x they come out to (short of the lanes' open band), tiles off the line they hold it to, and how fast they fall back from there to the rim
const JUNGLE_BOX = [22, 40, 70, 70]; // the jungle's open box, x0 y0 x1 y1 (the quarter: it folds to the whole inside)
const LAIR = [70, 25, 11, 7];   // the pit off the top lane: middle and radii (it folds to the bear's below)
const LAIR_MOUTH = [64, 25, 70, 44]; // the cut from the pit through the lane to the jungle
const FIELD_EDGE = 4;           // tiles of pines at the least between any open ground and the world's edge (the perches' discs reach past it)
// THE GROVES: the jungle's woods, each a stand of pines with a ragged edge,
// in the quarter. A 'cap' is a stroke from (ax, ay) to (bx, by) whose
// half-width runs r0 to r1 (a long stand that thins at one end); an 'oval'
// is a stand round (cx, cy), half rx by ry, turned `ang` radians. They meet
// in smooth unions (fieldSmin), then their edge wanders (fieldWander).
const FIELD_GROVES = [
  ['cap', 21, 42, 34, 41.6, 2.6, 2.0],   // the lane's wood, west of the door...
  ['cap', 44.5, 41.6, 63, 42, 2.0, 2.6], // ...and east of it
  ['cap', 24, 42, 25, 57.5, 2.8, 2.2],   // the jungle's west wood
  ['cap', 58, 44, 58.6, 53.5, 2.0, 2.4], // the hollow's side wood...
  ['oval', 61.2, 54.4, 3.0, 2.0, 0.3],   // ...and its foot
  ['cap', 30.5, 56.6, 49.5, 54.8, 2.6, 1.7], // the long wood under the hall, thinning east
  ['cap', 33, 57, 34.6, 61.6, 2.2, 1.5],  // its hook
  ['oval', 24.6, 63.4, 3.6, 3.0, 0.5],   // the base mouth's jaw
  ['oval', 44.2, 64.2, 4.2, 2.1, -0.4],  // the stand by the pump
  ['oval', 58.2, 63.2, 4.0, 2.5, 0.45],  // the stand between the pump and the middle
  ['oval', 70, 70, 3.8, 7.8, 0],         // the middle's wood (on the middle: it is its own twin)
];
const FIELD_BRUSH = [[39, 46, 5, 2], [28, 61, 2, 3], [66, 58, 4, 2], [43, 70, 3, 4]]; // the brush (layBrush, js/sim/depth.js): stadiums, middle x y and half w h, in the quarter
// THE WAYS: the ways through that the design is built on, kept open
// whatever the wander does: strokes from (ax, ay) to (bx, by) in the quarter
const FIELD_WAYS = [
  [39, 39, 39, 47],             // the lane's door into the hall
  [66.2, 56, 64.4, 70],         // the creek's arm round the middle's wood
];
const WAY_HALF = 2.4;           // tiles either side of a way's line kept open
const GROVE_CLEAR = 4.5;        // tiles round a camp's middle no grove reaches (CAMP_SITES, js/sim/camps.js; the pump's ring, js/sim/pumps.js)
const GROVE_K = 2.2;            // tiles of fillet where two groves meet
const WANDER_BIG = 1.5;         // tiles a grove's edge wanders in slow lobes...
const WANDER_SMALL = 0.5;       // ...and in small bays and bulges on top
// THE CREEK: rough ice that runs from the orca's pool down the middle
// column, through the top hollow, splits round the middle's wood, and on
// through the bottom hollow into the bear's den, where it pools (ground 1,
// fieldIce). It holds a foot like the orca's pool (fieldRough, slickUnder).
const CREEK_HALF = 1.9;         // tiles either side of the middle column the creek runs
const CREEK_ROUND = 2.4;        // tiles out from the middle's wood its two arms run
const DEN_POOL = [70, 115, 4.5, 2.6]; // the bear's frozen pool: middle (field units) and radii

function fieldFold(v) { return Math.min(v, WORLD - v); }
// the four copies of a quarter's point, [x, y] in field units: RED's top,
// BLUE's top, RED's bottom, BLUE's bottom
function fieldFour(x, y) { return [[x, y], [WORLD - x, y], [x, WORLD - y], [WORLD - x, WORLD - y]]; }
function fieldBox(x, y, x0, y0, x1, y1, r) {
  const qx = Math.abs(x - (x0 + x1) / 2) - ((x1 - x0) / 2 - r), qy = Math.abs(y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
// the smooth union: k tiles of fillet where two shapes meet
function fieldSmin(a, b, k) {
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k));
  return b + (a - b) * h - k * h * (1 - h);
}
// a stroke whose half-width runs r0 at (ax, ay) to r1 at (bx, by): signed tiles
function fieldCap(x, y, ax, ay, bx, by, r0, r1) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t) - (r0 + (r1 - r0) * t);
}
function fieldOval(x, y, cx, cy, rx, ry, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), u = (x - cx) * c + (y - cy) * s, v = -(x - cx) * s + (y - cy) * c;
  return (Math.hypot(u / rx, v / ry) - 1) * Math.min(rx, ry);
}
// how far a grove's edge wanders at a point: two octaves of the map's noise
// read at the point folded LEFT TO RIGHT only, so the two sides are mirror
// images but the top and the bottom halves wander their own ways
function fieldWander(x, y) {
  const fx = fieldFold(x);
  const calm = Math.min(1, Math.max(0.25, (Math.abs(x - FIELD_C) - 5) / 3)); // the middle's ways keep their shape
  return calm * WANDER_BIG * (vnoise(fx / 7 + 3.1, y / 7 + 7.7) - 0.5) * 2 + calm * WANDER_SMALL * (vnoise(fx / 2.4 + 17.3, y / 2.4 + 5.9) - 0.5) * 2;
}
// THE GROVES as one distance: signed tiles from the nearest grove's edge, negative in the pines
function fieldGroves(x, y) {
  const fx = fieldFold(x), fy = fieldFold(y);
  let d = 1e9;
  for (const g of FIELD_GROVES) d = fieldSmin(d, g[0] === 'cap' ? fieldCap(fx, fy, g[1], g[2], g[3], g[4], g[5], g[6]) : fieldOval(fx, fy, g[1], g[2], g[3], g[4], g[5]), GROVE_K);
  d -= fieldWander(x, y);
  // ...the ways through stay open, and every camp and the pump stand in a clearing, however the edges wander
  for (const w of FIELD_WAYS) d = Math.max(d, -fieldCap(fx, fy, w[0], w[1], w[2], w[3], WAY_HALF, WAY_HALF));
  for (const c of CAMP_SITES) d = Math.max(d, GROVE_CLEAR - Math.hypot(fx - c.tx - 0.5, fy - c.ty - 0.5));
  return Math.max(d, PUMP_R + 1 - Math.hypot(fx - PUMP_SPOT[0] - 2, fy - PUMP_SPOT[1] - 1));
}
// the creek and the bear's pool: where open ground off the road is ice,
// field units (fieldIce asks it of a tile)
function fieldCreek(x, y) {
  if (y < LAIR[1] || y > WORLD - LAIR[1] + 3) return false;
  const pool = Math.hypot((x - DEN_POOL[0]) / DEN_POOL[2], (y - DEN_POOL[1]) / DEN_POOL[3]) < 1;
  if (pool) return true;
  if (y > WORLD - LAIR[1]) return false;
  const M = FIELD_GROVES[FIELD_GROVES.length - 1], mid = fieldOval(fieldFold(x), fieldFold(y), M[1], M[2], M[3], M[4], M[5]);
  const swell = 0.55 * Math.sin(y / 3.3) + 0.35 * Math.sin(y / 1.9 + 1.3); // its banks swell and narrow down its length
  if (Math.abs(y - FIELD_C) < M[4] + CREEK_ROUND) return mid > 0 && mid < CREEK_ROUND + swell * 0.6 && Math.abs(x - FIELD_C) < M[3] + CREEK_ROUND + 1;
  return Math.abs(x - FIELD_C) < CREEK_HALF + swell;
}
// signed tiles from the lanes' centreline loop (either sign: inside or out)
function laneLoop(x, y) {
  const qx = Math.abs(x - FIELD_C) - (LANE_HX - LANE_R), qy = Math.abs(y - FIELD_C) - (LANE_HY - LANE_R);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - LANE_R;
}
// THE FIELD: signed tiles from the nearest edge of walkable ground, negative on it
function fieldOpen(x, y) {
  const fx = fieldFold(x), fy = fieldFold(y);
  const jungle = Math.max(fieldBox(fx, fy, JUNGLE_BOX[0], JUNGLE_BOX[1], JUNGLE_BOX[2], JUNGLE_BOX[3], 0), -fieldGroves(x, y));
  const band = Math.abs(laneLoop(x, y)) - LANE_HALF;
  const base = Math.hypot(fx - BASE_X, fy - FIELD_C) - BASE_R;
  const lair = (Math.hypot((fx - LAIR[0]) / LAIR[2], (fy - LAIR[1]) / LAIR[3]) - 1) * Math.min(LAIR[2], LAIR[3]);
  const mouth = fieldBox(fx, fy, LAIR_MOUTH[0], LAIR_MOUTH[1], LAIR_MOUTH[2], LAIR_MOUTH[3], 0);
  let d = fieldSmin(jungle, band, 2);
  d = fieldSmin(d, base, 2);
  d = fieldSmin(d, fieldSmin(lair, mouth, 2), 1.5);
  // ...and never within FIELD_EDGE of the world's edge: a pine border stands
  // round everything, met in a smooth corner like any other wall
  d = -fieldSmin(-d, -(FIELD_EDGE - Math.min(fx, fy)), 2);
  // ...but for the merchant's court behind the perch: its wings of pines close, its pocket opens
  const cy = y - FIELD_C, wingX = COURT_WING[0] - Math.max(0, Math.abs(cy) - COURT_WING[1]) * COURT_WING[2];
  if (fx < wingX && Math.hypot(fx - BASE_X, cy) > PLAZA_R + 0.6) d = Math.max(d, 0.5);
  if (fx >= COURT_CLEAR[3] && Math.hypot((fx - COURT[0]) / COURT_CLEAR[0], (cy - COURT_CLEAR[2]) / COURT_CLEAR[1]) < 1) d = Math.min(d, -0.5);
  return d;
}
// signed tiles from the rim of the court's paved bay, negative on its stones. Tile-index coordinates, as laneDist
function courtDist(fx, fy) {
  return (Math.hypot((fieldFold(fx + 0.5) - COURT[0]) / COURT[1], (fy + 0.5 - FIELD_C) / COURT[2]) - 1) * COURT[2];
}
// ---- the lanes ----------------------------------------------------------
// Lane 0 is the TOP, lane 1 the BOTTOM: each the half of the loop on its
// side of the middle, from RED's perch to BLUE's. A lane is road to every
// reader (laneDist): the packed road down its middle, ROAD_HALF either side
// of the centreline, and the plaza round each perch.
const LANE_STEP = 16;      // tiles between a wave's waypoints along it
const LANE_HOLD = 0.6;     // share of the way from a side's perch to a lane's middle its laner waits at with no column on the lane (laneHold)
// a lane's centreline from RED's perch to BLUE's, a point about every tile,
// in tile-index space, with `at`, the tiles along it to each. Pure
// geometry, so cached
const laneLineC = [null, null];
function laneLine(lane) {
  if (laneLineC[lane]) return laneLineC[lane];
  const sy = lane === 0 ? -1 : 1, y0 = FIELD_C + sy * (LANE_HY - LANE_R), cx0 = FIELD_C - LANE_HX + LANE_R, cx1 = FIELD_C + LANE_HX - LANE_R;
  const raw = [[FIELD_C - LANE_HX, FIELD_C]];
  const arc = (cx, a0, a1) => { const n = Math.ceil(LANE_R * Math.abs(a1 - a0)); for (let k = 1; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; raw.push([cx + Math.cos(a) * LANE_R, y0 + sy * Math.sin(a) * LANE_R]); } };
  raw.push([FIELD_C - LANE_HX, y0]);
  arc(cx0, Math.PI, Math.PI / 2);   // up (or down) round RED's corner
  for (let x = cx0 + 1; x < cx1; x++) raw.push([x, y0 + sy * LANE_R]);
  arc(cx1, Math.PI / 2, 0);         // round BLUE's
  raw.push([FIELD_C + LANE_HX, FIELD_C]);
  const pts = [], at = [0];
  for (const [x, y] of raw) {
    const last = pts[pts.length - 1], d = last ? Math.hypot(x - 0.5 - last.x, y - 0.5 - last.y) : 0;
    if (last && d < 0.25) continue;
    pts.push({ x: x - 0.5, y: y - 0.5 });
    if (pts.length > 1) at.push(at[at.length - 1] + d);
  }
  return (laneLineC[lane] = { pts, at });
}
// the point `d` tiles along a lane's centreline
function laneAt(L, d) {
  let i = 1;
  while (i < L.at.length - 1 && L.at[i] < d) i++;
  const a = L.pts[i - 1], b = L.pts[i], k = Math.max(0, Math.min(1, (d - L.at[i - 1]) / ((L.at[i] - L.at[i - 1]) || 1)));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}
// how far along lane `lane` a side's own perch is: RED's at the line's start, BLUE's at its end
function laneFrom(team, lane) { return team === 0 ? 0 : laneLine(lane).at[laneLine(lane).at.length - 1]; }
function lanePx(p) { return { x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE }; }
// the point `d` tiles along lane `lane` out from a side's own perch, in px
function laneOut(team, lane, d) {
  const L = laneLine(lane), a = laneFrom(team, lane);
  return lanePx(laneAt(L, a + (team === 0 ? d : -d)));
}
// the march down a lane: from the side's own perch to the rival's, a point
// every LANE_STEP tiles along the centreline, in px
function laneWaypoints(team, lane) {
  const L = laneLine(lane), a = laneFrom(team, lane), b = laneFrom(1 - team, lane), pts = [];
  const n = Math.max(1, Math.round(Math.abs(b - a) / LANE_STEP));
  for (let i = 1; i <= n; i++) pts.push(lanePx(laneAt(L, a + (b - a) * i / n)));
  return pts;
}
// where a side's laner waits on a lane with no column of its own on it
// (aiLaneSpot, js/ai/ai-farm.js): LANE_HOLD of the way from the side's own
// perch to the lane's middle, in px
function laneHold(team, lane) {
  const L = laneLine(lane), a = laneFrom(team, lane), mid = L.at[L.at.length - 1] / 2;
  return lanePx(laneAt(L, a + (mid - a) * LANE_HOLD));
}
// the walk to that spot along the lane, in px, a point about every `step`
// px (the FIRST MATCH's LANE lesson draws it: drawGuideTrail, js/ui/guide.js)
function laneHoldRoute(team, lane, step) {
  const L = laneLine(lane), a = laneFrom(team, lane), mid = L.at[L.at.length - 1] / 2, a1 = a + (mid - a) * LANE_HOLD;
  const n = Math.max(1, Math.round(Math.abs(a1 - a) * TILE / step)), pts = [];
  for (let k = 0; k <= n; k++) pts.push(lanePx(laneAt(L, a + (a1 - a) * k / n)));
  return pts;
}
// signed tiles from the road's edge, negative on it: the packed road down
// both lanes and each perch's plaza. Tile-index coordinates (an integer is
// a tile's middle), so a tile's centre and a pixel bake's point alike
function laneDist(fx, fy) {
  const x = fx + 0.5, y = fy + 0.5;
  return Math.min(Math.abs(laneLoop(x, y)) - ROAD_HALF, Math.hypot(fieldFold(x) - BASE_X, y - FIELD_C) - PLAZA_R, courtDist(fx, fy));
}
function onRoad(tx, ty) { return laneDist(tx, ty) < 0; }

// ---- the bases ----------------------------------------------------------
// A side's home is its PERCH, where its eagle sits from the first second
// (eagleRoost, js/sim/eagle.js), on the loop at the middle of its end; the
// waves walk out of it both ways. Field units.
function basePerch(team) { return { x: team === 0 ? BASE_X : WORLD - BASE_X, y: FIELD_C }; }
function basePerchPx(team) { const b = basePerch(team); return { x: b.x * TILE, y: b.y * TILE }; }
// the side whose base disc holds tile (tx, ty), `pad` tiles past its rim counted in, or -1
function baseAt(tx, ty, pad) {
  for (const team of [0, 1]) {
    const b = basePerch(team);
    if (Math.hypot(tx + 0.5 - b.x, ty + 0.5 - b.y) <= BASE_R + pad) return team;
  }
  return -1;
}

// ---- worldgen -----------------------------------------------------------
// The whole map from the one distance: every tile off the field a wall pine
// (`wall`: none of them ever falls, treeFells), the lanes' road packed earth,
// the orca's pit a frozen pool. Runs first at boot (js/app/boot.js); the
// camps, the towers and the pumps stand on it after.
const LAIR_POOL = [7.5, 4.5]; // the orca's frozen pool: radii round the pit's middle (orcaLakeEdge)
const ORCA_LAKE_R = LAIR_POOL[0]; // ...the longer of them: what a reach round the pool is sized by
function genWorld() {
  ground.fill(0); objects.fill(null);
  const open = fieldGrid();
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    const x = tx + 0.5, y = ty + 0.5, i = idx(tx, ty);
    if (!open[i]) { objects[i] = { type: 'tree', tx, ty, hp: 1, flash: 0, shake: 0, wall: true }; continue; }
    if (laneDist(tx, ty) < 0) ground[i] = 3;
    else if (orcaLakeAt(tx, ty) || fieldCreek(x, y)) ground[i] = 1;
  }
}
// the open tiles (1) off the one distance, and then NO SLIVERS: a tile of
// open ground that no FIELD_PATH-wide square of open ground covers is pines
// too, so wherever the groves' edges wander, every way through is a path a
// body and a fight fit in. Reads only the field, so the same on every screen
const FIELD_PATH = 4;            // tiles: the narrowest way through anywhere
function fieldGrid() {
  const N = WORLD, k = FIELD_PATH, open = new Uint8Array(N * N), keep = new Uint8Array(N * N);
  for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) open[ty * N + tx] = fieldOpen(tx + 0.5, ty + 0.5) < 0 ? 1 : 0;
  // a summed table, so each square's count is four reads
  const S = new Int32Array((N + 1) * (N + 1));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) S[(y + 1) * (N + 1) + x + 1] = open[y * N + x] + S[y * (N + 1) + x + 1] + S[(y + 1) * (N + 1) + x] - S[y * (N + 1) + x];
  for (let y = 0; y + k <= N; y++) for (let x = 0; x + k <= N; x++) {
    const n = S[(y + k) * (N + 1) + x + k] - S[y * (N + 1) + x + k] - S[(y + k) * (N + 1) + x] + S[y * (N + 1) + x];
    if (n === k * k) for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) keep[(y + j) * N + x + i] = 1;
  }
  // ...and no pocket a wander walled off: open ground no walk from RED's
  // perch reaches is pines as well
  const seen = new Uint8Array(N * N), q = new Int32Array(N * N), b = basePerch(0);
  let n = 0; q[n++] = Math.floor(b.y) * N + Math.floor(b.x); seen[q[0]] = 1;
  while (n) {
    const j = q[--n], x = j % N, y = (j / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy, a = Y * N + X;
      if (X >= 0 && Y >= 0 && X < N && Y < N && keep[a] && !seen[a]) { seen[a] = 1; q[n++] = a; }
    }
  }
  return seen;
}
// the orca's pool, its middle in tile-index coordinates
function orcaPool() { return { tx: FIELD_C - 0.5, ty: LAIR[1] - 0.5 }; }
// ...and signed tiles from its rim (negative inside), in tile-index
// coordinates; 99 well clear of it
function orcaLakeEdge(fx, fy) {
  const x = fx + 0.5 - FIELD_C, y = fy + 0.5 - LAIR[1];
  const d = (Math.hypot(x / LAIR_POOL[0], y / LAIR_POOL[1]) - 1) * LAIR_POOL[1];
  return d > 4 ? 99 : d;
}
function orcaLakeAt(fx, fy) { return orcaLakeEdge(fx, fy) < 0; }
// whether a tile's ice is ROUGH, crusted with rime, holding a foot like snow
// (slickUnder): the orca's pool, the creek and the bear's pool are; a
// rival hero's ice glides
function fieldRough(tx, ty) { return orcaLakeAt(tx, ty) || fieldCreek(tx + 0.5, ty + 0.5); }
