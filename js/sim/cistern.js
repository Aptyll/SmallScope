'use strict';
// ------------------------------------------------------------ the cistern
// THE CISTERN at the middle of the map: the works' ring of dressed stone
// round the creek's pool, whose water froze over and is the orca's lake
// (orcaLakeAt, js/sim/world.js). The road comes in at two GATES, each paved
// with a stone sill, and the wall is down in four BREACHES on the
// diagonals, the blocks that fell lying round them. The creek runs in and
// out under it, a culvert each way (in the wall's face: nobody goes
// through), and just outside each culvert a FORD of stepping stones crosses
// it: the way the waves go round (cisternWayRound). Look H CUT BLOCKS,
// baked with its footprint by app/bake-cistern/paint.py into
// js/baked/cistern.js, and the ring's
// measures are the bake's (SPRITES.cistern.geo), so the sim can never stand
// off the art. The pixels are js/draw/cistern.js.
//
// SOLID TO THE PIXEL. The wall, the piers and every fallen block stand on a
// footprint baked per world px (a sill is walked over). moveEntity holds
// every body to it exactly (cisternReach): a circle of the body's radius
// round its feet (CIST_FOOT under its x, y: where the sprite's soles are),
// swept along the step, so no roll, rush or haul goes through a block, and a
// body already touching the stone (shoved there, put down there) may move
// any way but deeper. The tile grid gets three coarser reads: isSolidTile a
// tile whose middle is stone (shots, sight lines, what lands there),
// walkable one where no body fits at the middle (every route and spawn,
// and every tile a body is put down on: nearestDryTile, landPlayer), and
// findPath refuses a step between two tiles' middles that a block lies
// across (cisternCuts); a route's straight lines ask the px (navLineClear),
// canPlaceAt one with any stone on it. Every way in stays open: the bake
// keeps the fallen blocks LANE px off each breach's middle line (two tiles
// clear) and checks the gates and the breaches before it writes.
// Pure position: nothing rolls and nothing changes, so there is no sim
// state to save, and the footprint is the same every seed and every client.
// Laid by placeCreek (placeCistern), before the paths and the road.
const CIST_GEO = SPRITES.cistern.geo;
const CIST_RI = CIST_GEO.ri;         // tiles from the crossing to the wall's inner face...
const CIST_RO = CIST_GEO.ro;         // ...and its outer face
const CIST_GH = CIST_GEO.gh;         // a gate's half-width, tiles
const CIST_SILL = [CIST_GEO.sillIn, CIST_GEO.sillOut]; // the gates' sills run radially from .. to (tiles): road to walk
const CIST_ICE = CIST_GEO.ice;       // the pool's ice reaches here, under the inner face
const CIST_FROZEN = CIST_GEO.frozen; // the creek is ice to here (under the wall) and open water past it
const CIST_CLEAR = CIST_GEO.reach + 1.5; // tiles round the crossing placeCistern clears of what worldgen stood, all other ice and every path
const CIST_FOOT = 4;                 // px under a body's x, y that its soles stand (drawPlayer's feet)
const CIST_STAND = PLAYER_R + 1;     // px of room round the feet a route's tile must have (walkable)
const CIST_LANE_IN = 0.1;            // tiles past the outer face the road's earth stops, under the sill
const CIST_LANE_TAPER = 4;           // tiles over which the road narrows onto a gate's width
const CIST_STEP = 2;                 // px between the points a step is swept at
const CIST_PAD = 24;                 // px of field kept round the footprint: past any body's reach
const CIST_FORD = 13;                // tiles down the creek from the crossing to the middle of each culvert's ford: its stones just clear of the wall, the whole row on the cleared ground
// per world tile: 1 its middle is stone, 2 no body fits at its middle, 4 any stone on it
const CIST_MID = 1, CIST_NOFIT = 2, CIST_ANY = 4;
let cistTiles = null;  // the flags above (placeCistern)
let cistCuts = null;   // per world tile, bit k: the step NAV_DX[k], NAV_DY[k] from its middle meets the stone
let cistField = null;  // { x, y, w, h, d }: world px box, px from each px to the nearest stone (0 on it)
let cistFords = [];    // the culverts' fords as laid (creekFord's rows): [0] upstream, top-left; [1] downstream, bottom-right
let cistOn = false;    // a match with the cistern standing (never the practice arena)

// tiles from the crossing, of a continuous tile coordinate
function cisternR(fx, fy) { return Math.hypot(roadOffS(fx, fy), creekP(fx, fy)); }
// the crossing in world px: the bake's box is centred on it
function cisternC() { return ((WORLD - 1) / 2 + 0.5) * TILE; }
// inside the cistern's whole ground (CIST_CLEAR): where nothing else may be put
function cisternIn(tx, ty) { return cistOn && cisternR(tx, ty) < CIST_CLEAR; }
function cisternTile(tx, ty) { return cistOn && inWorld(tx, ty) && (cistTiles[idx(tx, ty)] & CIST_MID) !== 0; }
function cisternBlocks(tx, ty) { return cistOn && inWorld(tx, ty) && (cistTiles[idx(tx, ty)] & CIST_NOFIT) !== 0; }
function cisternTouches(tx, ty) { return cistOn && inWorld(tx, ty) && (cistTiles[idx(tx, ty)] & CIST_ANY) !== 0; }
function cisternCuts(i, k) { return cistOn && ((cistCuts[i] >> k) & 1) === 1; } // tile index i, NAV_DX/NAV_DY's k

// the road ends on the gates' sills: a cap on its distance (laneDist,
// js/sim/world.js), nothing inside the ring and the lane eased from its own
// width down to a gate's over CIST_LANE_TAPER tiles out. -99 well clear
function cisternLane(fx, fy) {
  if (!cistOn) return -99;
  const w = roadOffS(fx, fy), p = creekP(fx, fy), r = Math.hypot(w, p);
  if (r > CIST_RO + CIST_LANE_TAPER + 2) return -99;
  if (r < CIST_RO + CIST_LANE_IN) return 99;
  let t = Math.max(0, Math.min(1, (Math.abs(p) - CIST_RO) / CIST_LANE_TAPER));
  t = t * t * (3 - 2 * t);
  return Math.abs(w) - (CIST_GH + (ROAD_HW + ROAD_SHOULDER + 0.2 - CIST_GH) * t);
}

// px from a world point to the nearest stone (Infinity off the field)
function cisternDist(x, y) {
  const f = cistField;
  if (!cistOn || !f) return Infinity;
  const i = Math.floor(x) - f.x, j = Math.floor(y) - f.y;
  if (i < 0 || j < 0 || i >= f.w || j >= f.h) return Infinity;
  return f.d[j * f.w + i];
}
// would a body of radius r standing at x, y be in the stone? (what puts a
// body down somewhere - a warp, a hop off a cable or a deer - asks this)
function cisternCrowds(x, y, r) { return cisternDist(x, y + CIST_FOOT) < r + 0.5; }
// how much of a step (x0, y0) -> (x1, y1) a body of radius r takes before
// its feet meet the stone: 1 the whole step, less and it stops against it
// (to a quarter px, so a roll lands on the stone, not short of it). Swept
// every CIST_STEP px; a body already touching it is refused only a step
// that takes it deeper, so nothing is ever pinned against it
function cisternReach(x0, y0, x1, y1, r) {
  const f = cistField;
  if (!cistOn || !f) return 1;
  const k = CIST_FOOT, lim = r + 0.5; // a stone px is a square: its centre half a px past its edge
  if (Math.max(x0, x1) + lim < f.x || Math.min(x0, x1) - lim > f.x + f.w ||
    Math.max(y0, y1) + k + lim < f.y || Math.min(y0, y1) + k - lim > f.y + f.h) return 1;
  const d0 = cisternDist(x0, y0 + k);
  if (d0 < lim) return cisternDist(x1, y1 + k) < d0 ? 0 : 1;
  const hits = (t) => cisternDist(x0 + (x1 - x0) * t, y0 + k + (y1 - y0) * t) < lim;
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / CIST_STEP));
  for (let s = 1; s <= n; s++) {
    if (!hits(s / n)) continue;
    let lo = (s - 1) / n, hi = s / n;
    for (let i = 0; i < 3; i++) { const m = (lo + hi) / 2; if (hits(m)) hi = m; else lo = m; }
    return lo;
  }
  return 1;
}

// the footprint into a distance field, once a page: the baked runs into a
// px mask CIST_PAD wider all round, then the exact distance from every px
// to the nearest stone px (two passes of the lower envelope of parabolas)
function cisternField() {
  if (cistField) return cistField;
  const S = SPRITES.cistern.solid, o = cisternC() - SPRITES.cistern.rb;
  const w = S.w + 2 * CIST_PAD, h = S.h + 2 * CIST_PAD, BIG = 1e12;
  const g = new Float64Array(w * h).fill(BIG);
  S.runs.forEach((row, j) => {
    let x = 0, on = false;
    for (const n of row ? row.split(',') : []) {
      if (on) for (let i = x; i < x + +n; i++) g[(j + CIST_PAD) * w + i + CIST_PAD] = 0;
      x += +n; on = !on;
    }
  });
  const n = Math.max(w, h), fl = new Float64Array(n), dl = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const pass = (len, get, set) => {
    for (let q = 0; q < len; q++) fl[q] = get(q);
    let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < len; q++) {
      let s = ((fl[q] + q * q) - (fl[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((fl[q] + q * q) - (fl[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; dl[q] = (q - v[k]) * (q - v[k]) + fl[v[k]]; }
    for (let q = 0; q < len; q++) set(q, dl[q]);
  };
  for (let j = 0; j < h; j++) pass(w, (i) => g[j * w + i], (i, d) => { g[j * w + i] = d; });
  for (let i = 0; i < w; i++) pass(h, (j) => g[j * w + i], (j, d) => { g[j * w + i] = d; });
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = Math.sqrt(g[i]);
  cistField = { x: o + S.x - CIST_PAD, y: o + S.y - CIST_PAD, w, h, d };
  return cistField;
}

// placeCreek's last step (js/sim/world.js): the ground round the crossing made
// the cistern's - the pool ice to CIST_ICE (the orca's lake), the creek
// frozen under the wall, the gates' sills road to walk, every other lake
// and everything standing cleared off CIST_CLEAR - and the tiles' flags
// and cuts - and last a ford just outside each culvert
function placeCistern() {
  cistTiles = new Uint8Array(WORLD * WORLD);
  cistCuts = new Uint8Array(WORLD * WORLD);
  cistFords = [];
  cistOn = !PRACTICE;
  if (!cistOn) return;
  const f = cisternField(), c = (WORLD - 1) / 2, r = Math.ceil(CIST_CLEAR + 1);
  for (let ty = Math.floor(c - r); ty <= Math.ceil(c + r); ty++) for (let tx = Math.floor(c - r); tx <= Math.ceil(c + r); tx++) {
    if (!inWorld(tx, ty)) continue;
    const R = cisternR(tx, ty), i = idx(tx, ty), g = ground[i];
    if (R >= CIST_CLEAR) continue;
    objects[i] = null;
    if (R < CIST_ICE) ground[i] = 1;
    else if ((g === 4 && R < CIST_FROZEN) || g === 1) ground[i] = 0;
    if (R >= CIST_SILL[0] && R <= CIST_SILL[1] && Math.abs(roadOffS(tx, ty)) < CIST_GH) ground[i] = 3;
    const x = tx * TILE, y = ty * TILE;
    let fl = 0;
    if (cisternDist(x + 8, y + 8) < 1) fl |= CIST_MID;
    if (Math.min(cisternDist(x + 8, y + 8), cisternDist(x + 8, y + 8 + CIST_FOOT)) < CIST_STAND + 0.5) fl |= CIST_NOFIT; // feet at the middle or a body's centre there
    if (x + TILE > f.x && y + TILE > f.y && x < f.x + f.w && y < f.y + f.h) {
      for (let j = 0; j < TILE && !(fl & CIST_ANY); j++) for (let k = 0; k < TILE; k++) if (cisternDist(x + k, y + j) < 0.5) { fl |= CIST_ANY; break; }
    }
    cistTiles[i] = fl;
    for (let k = 0; k < 8; k++) if (cisternReach(x + 8, y + 8, x + 8 + NAV_DX[k] * TILE, y + 8 + NAV_DY[k] * TILE, CIST_STAND) < 1) cistCuts[i] |= 1 << k;
  }
  // on the creek's line CIST_FORD up and down it, where creekCalm holds the water square
  cistFords = [-1, 1].map((s) => { const m = (s * CIST_FORD * Math.SQRT2 + WORLD - 1) / 2; return creekFord(m, m); });
}

// a wave's way past the middle (makeSoldier): the road's waypoints on the
// cistern's ground dropped, and where the route crosses the creek the road
// just short of its own gate, ford `side`'s two banks (cistFords) and the
// road just past the rival's gate spliced in. So a column comes up the road,
// forks round the ring and over the stones, never across the orca's ice
function cisternWayRound(way, team, side) {
  const f = cistOn && cistFords[side];
  if (!f) return;
  const s = team === 1 ? 1 : -1; // the soldier's own half: + BLUE's (+p), the row's east end
  const bank = (tx) => ({ x: (tx + 0.5) * TILE, y: (f.ty + 0.5) * TILE });
  const gate = (k) => roadPoint((WORLD - 1) / 2 + k * (CIST_CLEAR + 1) / Math.SQRT2);
  const round = [gate(s), bank(s > 0 ? f.x1 + 1 : f.x0 - 1), bank(s > 0 ? f.x0 - 1 : f.x1 + 1), gate(-s)];
  const fx = (q) => q.x / TILE - 0.5, fy = (q) => q.y / TILE - 0.5;
  const kept = way.filter((q) => cisternR(fx(q), fy(q)) >= CIST_CLEAR + 1);
  let i = kept.findIndex((q) => creekP(fx(q), fy(q)) * s < 0); // the first on the rival's half
  if (i < 0) i = kept.length;
  kept.splice(i, 0, ...round);
  way.splice(0, way.length, ...kept);
}
