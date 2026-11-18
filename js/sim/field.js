'use strict';
// ------------------------------------------------------------ field
// THE FIELD (3v3): the one map, a Twisted Treeline in the snow. Two lanes
// are the two halves of one rounded rectangle round the middle, each side's
// perch sits on it at the middle of its own end, and a walled jungle fills
// the inside. Out past the lanes the woods close in, but for two pits that
// open off them: the orca's above the top lane, the black bear's below the
// bottom one.
//
// The whole field is ONE signed distance (fieldOpen): negative on ground a
// body can walk, written for the top-left quarter and folded four ways
// (fieldFold), so the two sides AND the two halves are the same shape by
// construction. A wall is a rounded box on a 2-tile module, the open shapes
// meet in smooth unions (fieldSmin), so every inside corner gets the same
// fillet. Nothing rolls and nothing reads the seed: one map, the same on every
// screen (CLAUDE.md, rule 3).
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
const WALL_R = 1.5;             // a wall's corner radius
const FIELD_EDGE = 4;           // tiles of pines at the least between any open ground and the world's edge (the perches' discs reach past it)
const FIELD_WALLS = [           // x0 y0 x1 y1, each 4 tiles thick, in the quarter
  [22, 40, 36, 44], [42, 40, 64, 44], // the lane's wall, the door between them
  [22, 40, 26, 60],             // the jungle's west wall
  [56, 44, 60, 56], [60, 52, 64, 56], // the hollow's side wall and its foot
  [30, 54, 50, 58],             // the long divider under the hall
  [32, 58, 36, 62],             // its hook
  [22, 60, 28, 66],             // the base mouth's jaw
  [40, 62, 48, 66],             // the pillar by the pump
  [54, 60, 62, 66],             // the block between the pump and the middle
  [66, 62, 70, 70],             // the middle's wall (folds to 8 by 16)
];
const FIELD_BRUSH = [[39, 46, 5, 2], [28, 61, 2, 3], [66, 58, 4, 2], [43, 70, 3, 4]]; // the brush (layBrush, js/sim/depth.js): stadiums, middle x y and half w h, in the quarter

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
// signed tiles from the lanes' centreline loop (either sign: inside or out)
function laneLoop(x, y) {
  const qx = Math.abs(x - FIELD_C) - (LANE_HX - LANE_R), qy = Math.abs(y - FIELD_C) - (LANE_HY - LANE_R);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - LANE_R;
}
// THE FIELD: signed tiles from the nearest edge of walkable ground, negative on it
function fieldOpen(x, y) {
  const fx = fieldFold(x), fy = fieldFold(y);
  let walls = 1e9;
  for (const w of FIELD_WALLS) walls = fieldSmin(walls, fieldBox(fx, fy, w[0], w[1], w[2], w[3], WALL_R), 1);
  const jungle = Math.max(fieldBox(fx, fy, JUNGLE_BOX[0], JUNGLE_BOX[1], JUNGLE_BOX[2], JUNGLE_BOX[3], 0), -walls);
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
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    const x = tx + 0.5, y = ty + 0.5, i = idx(tx, ty);
    if (fieldOpen(x, y) >= 0) { objects[i] = { type: 'tree', tx, ty, hp: 1, flash: 0, shake: 0, wall: true }; continue; }
    if (laneDist(tx, ty) < 0) ground[i] = 3;
    else if (orcaLakeAt(tx, ty)) ground[i] = 1;
  }
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
