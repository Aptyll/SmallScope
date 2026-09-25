'use strict';
// The wind's leavings: the low drifts it piles in the lee of whatever
// stands, and the frozen lakes' dressing - snow dusted over the ice, a bank
// along each lake's downwind shore, long cracks through the big lakes,
// frozen reeds poking out along the shores - plus the few things on the ice
// the weather moves every frame. All of it is SCENERY: laid off the seed at
// the ground bake (every pixel a function of the world and its position, so
// a repaint lays back exactly what the bake laid), and nothing here is a
// rule - no walker, route or slide reads it. The tile grid still says where
// the ice is, and the ice's own shine shows through everything laid on it,
// so a lake always reads as slippery.

// ------------------------------------------------------------ the snow's depth
// How deep the snow lies is ONE seeded map, owned by the deep snow layer:
// its deepest band is the deep snow that slows a walker, and this file
// draws the two shallower bands - the mid band as the drifts in the lee of
// what stands, the shallow band as the dust on the ice and the banks on a
// lake's downwind shore. Read only through the doors below, so the shapes
// always agree: no drift is ever drawn on a tile the deep band owns (it
// draws its own), so nothing that looks deep walks shallow.
// The map is js/depth.js's: snowDepth at a tile-space point, DEPTH_MID and
// DEPTH_DEEP its bands, deepAt the slowing test, driftWind the prevailing
// wind.
const DRIFT_MID = () => DEPTH_MID;  // depth from which a drift piles in a lee
const DEEP_TOP = () => DEPTH_DEEP;
function snowDepthAt(tx, ty) {
  return inWorld(tx, ty) ? snowDepth(tx + 0.5, ty + 0.5) : 0;
}
function deepSnowAt(tx, ty) {
  return deepAt((tx + 0.5) * TILE, (ty + 0.5) * TILE);
}
// the prevailing wind: the way it blows TOWARD, one answer for the map
let LW_X = 1, LW_Y = 0;
function rollPrevailing() { LW_X = driftWind.dx; LW_Y = driftWind.dy; }

// ------------------------------------------------------------ lake bodies
// Every lake (ice and holes, as the shore reads it) labelled by flood fill
// with its area, so the dressing can tell a big lake from a pond. Runs once
// at the bake, after bakeLakes; like it, it never needs redoing.
const BIG_LAKE = 70;          // tiles a lake needs to count as big (streaks, long cracks)
let lakeId = null;            // per tile: its lake's label, -1 off the ice
let lakeTiles = [];           // per label: its tile indices
function bakeLakeBodies() {
  const N = WORLD * WORLD, q = new Int32Array(N), D4 = [1, 0, -1, 0, 0, 1, 0, -1];
  lakeId = new Int32Array(N).fill(-1); lakeTiles = [];
  for (let i = 0; i < N; i++) {
    if (lakeId[i] >= 0 || !isLake(i % WORLD, (i / WORLD) | 0)) continue;
    const id = lakeTiles.length, list = [];
    let n = 0; q[n++] = i; lakeId[i] = id;
    while (n) {
      const j = q[--n], x = j % WORLD, y = (j / WORLD) | 0;
      list.push(j);
      for (let k = 0; k < 8; k += 2) {
        if (!isLake(x + D4[k], y + D4[k + 1])) continue;
        const a = idx(x + D4[k], y + D4[k + 1]);
        if (lakeId[a] < 0) { lakeId[a] = id; q[n++] = a; }
      }
    }
    lakeTiles.push(list);
  }
}
function bigLakeAt(tx, ty) {
  const id = lakeId[idx(tx, ty)];
  return id >= 0 && lakeTiles[id].length >= BIG_LAKE;
}

// ------------------------------------------------------------ the dressing's stamps
// Cracks, reeds, the downwind banks and the lee drifts are worked out ONCE,
// at the bake, into per-tile lists of pixels (packed: i | j << 4 | ink << 8),
// and every paint of a tile - the bake's, or a repaint's - stamps its own
// list. So a reed rooted in the tile below still pokes up into this one, a
// drift reaching across a tile edge carries on, and a hole that opens and
// refreezes lays back the same crack it cut.
const DRESS_INK = [
  '#5d8cab', // 0 a long crack
  '#78a2bf', // 1 ...its branches, fainter
  '#c6e3f1', // 2 the pale lip under a crack, the ice's thickness catching the light
  '#6b5a3c', // 3 a reed, low
  '#98855c', // 4 a reed, high
  '#4f3f2a', // 5 a seed head
  '#f5f9fd', // 6 snow: a reed's cap, a drift's body
  '#ffffff', // 7 a drift's or a bank's sunlit edge
  '#d3deed', // 8 the shade on a drift's lee
  '#e4ecf6', // 9 a bank's face turned from the sun
  '#fbfdff', // 10 a bank's face turned to it
];
let dressPx = null;           // Map: tile index -> packed pixels, in paint order
let crackPx = null;           // Map: tile index -> packed crack pixels (frost re-inks them)
function stampAt(map, x, y, ink) {
  const tx = x >> 4, ty = y >> 4;
  if (!inWorld(tx, ty)) return;
  const k = idx(tx, ty);
  let a = map.get(k);
  if (!a) map.set(k, a = []);
  a.push((x & 15) | ((y & 15) << 4) | (ink << 8));
}
// the whole bake of the dressing: before the ground's first tile paints
function bakeDressing() {
  rollPrevailing();
  bakeLakeBodies();
  bakeDustLee();
  dustK = -1;
  dressPx = new Map(); crackPx = new Map();
  if (PRACTICE) return;
  bakeDrifts();
  bakeBanks();
  bakeCracks();
  bakeReeds();
}
// stamp a tile's dressing: called by paintGroundTile over the snow or the
// ice, under the road, the creek and the cast shade. Nothing lands on an
// open hole (ground 2 paints its own water).
function paintDressing(g, tx, ty, px, py) {
  const a = dressPx && dressPx.get(idx(tx, ty));
  if (!a) return;
  let ink = -1;
  for (const p of a) {
    const c = p >> 8;
    if (c !== ink) { ink = c; g.fillStyle = DRESS_INK[c]; }
    g.fillRect(px + (p & 15), py + ((p >> 4) & 15), 1, 1);
  }
}
// is this world pixel free for the dressing: not the road's band, not the
// creek, not a tile the deep band owns
function dressFree(tx, ty) {
  return inWorld(tx, ty) && ground[idx(tx, ty)] !== 3 && !creekNear(tx, ty) && !objAt(tx, ty)
    && roadDist(tx, ty) >= ROAD_SHOULDER + 1.2 && !deepSnowAt(tx, ty);
}

// ------------------------------------------------------------ drifts in the lee
// The mid band of the depth map, drawn: every pixel where the snow lies at
// least DEPTH_MID deep but short of the deep band is a low, flat pile - the
// pads the map lays in the lee of a pine, a rock or the hut, and the skirt
// round each deep drift. The shape IS the map's (leeDepth/driftsDepth read
// per pixel, not per tile, since a pad is smaller than a tile), so a pile
// is exactly where the map says the snow is, and it stops where the deep
// band's own look begins. Its sunward rim is lit and a pixel of shade lies
// past its lee; its thin edge is dithered into the field. Kept well below
// the deep band's look (no raised lip, no deep shadow), so it never reads
// as snow that slows you. Nothing is drawn on ice, the road, the creek or
// a tile something stands on.
const DRIFT_FADE = 0.06;      // depth over DEPTH_MID across which a pile's edge dithers in
function bakeDrifts() {
  if (!leeCell) return; // no depth map laid (the practice arena)
  const mid = DRIFT_MID(), top = DEEP_TOP();
  const band = (x, y) => { // 0 outside the mid band, else how far in (0..1]
    const fx = x / TILE, fy = y / TILE, d = Math.max(leeDepth(fx, fy), driftsDepth(fx, fy));
    return d < mid || d >= top ? 0 : Math.min(1, (d - mid) / DRIFT_FADE + 0.01);
  };
  const H = new Float32Array((TILE + 2) * (TILE + 2)), W = TILE + 2;
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    const k = idx(tx, ty);
    if (!leeCell[k] && !driftCell[k]) continue;
    if (ground[k] !== 0 || !dressFree(tx, ty)) continue;
    const edge = lakesAround(tx, ty) > 0;
    // the tile's band and a pixel round it, for the rim and the shade
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) H[j * W + i] = band(tx * TILE + i - 1, ty * TILE + j - 1);
    for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
      const x = tx * TILE + i, y = ty * TILE + j, h = H[(j + 1) * W + i + 1];
      if (edge && iceAtPx(x, y)) continue;
      const up = H[j * W + i + 1], left = H[(j + 1) * W + i];
      if (h) {
        if (h < 1 && BAYER4[(y & 3) * 4 + (x & 3)] + 0.47 > h) continue;
        const down = H[(j + 2) * W + i + 1], right = H[(j + 1) * W + i + 2];
        stampAt(dressPx, x, y, !up || !left ? 7 : !down || !right ? 9 : 6);
      } else if (up >= 1 || H[j * W + i] >= 1) {
        stampAt(dressPx, x, y, 8);
      }
    }
  }
}

// ------------------------------------------------------------ the downwind bank
// The wind sweeps the loose snow off a lake and drops it where the ice
// ends: a low bank along each lake's downwind shore, a few px of face
// rising off the ice, a lit crest, then its lee. Its width rides the
// shallow band's depth on the shore; the face is lit or shaded by which way
// it looks against the one sun (top-left), so a bank reads the same as
// every other relief in the valley. The shore's own lip (bankAt, ground.js)
// stays under it: the bank starts a pixel further out.
const BANK_W = [5, 9];        // px of bank at a shallow..mid shore
const SUN_TO_X = -0.88, SUN_TO_Y = -0.48; // toward the sun, the way every lit face looks
function bakeBanks() {
  const faceLit = -LW_X * SUN_TO_X - LW_Y * SUN_TO_Y > 0;
  const face = faceLit ? 10 : 9, lee = faceLit ? 9 : 10, top = DEEP_TOP();
  const sx = LW_X > 0.3 ? 1 : LW_X < -0.3 ? -1 : 0, sy = LW_Y > 0.3 ? 1 : LW_Y < -0.3 ? -1 : 0;
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    const n = lakesAround(tx, ty);
    if (n === 0 || n === 9 || !dressFree(tx, ty)) continue;
    // only a shore that looks back up the wind at its lake
    if (!isLake(tx - sx, ty - sy) && !isLake(tx - sx, ty) && !isLake(tx, ty - sy)) continue;
    const s = Math.min(1, snowDepthAt(tx, ty) / Math.max(0.01, top));
    const B = Math.round(BANK_W[0] + (BANK_W[1] - BANK_W[0]) * s);
    // the ice round the tile, read once: the tile plus B px up the wind
    const mx0 = tx * TILE - Math.max(0, Math.ceil(LW_X * B)), my0 = ty * TILE - Math.max(0, Math.ceil(LW_Y * B));
    const mw = TILE + Math.ceil(Math.abs(LW_X) * B) + 1, mh = TILE + Math.ceil(Math.abs(LW_Y) * B) + 1;
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) bankMask[j * BANK_MW + i] = iceAtPx(mx0 + i, my0 + j) ? 1 : 0;
    const ice = (x, y) => bankMask[(y - my0) * BANK_MW + x - mx0];
    for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
      const x = tx * TILE + i, y = ty * TILE + j;
      if (ice(x, y)) continue;
      let d = 0;
      for (let k = 1; k <= B; k++) if (ice(Math.round(x - LW_X * k), Math.round(y - LW_Y * k))) { d = k; break; }
      if (d < 2) continue; // the shore's own lip
      // the bank's end wanders so it never reads as a ruled line
      const end = B - 1.5 + vnoise(x / 6 + 5, y / 6 + 11) * 3;
      if (d > end) continue;
      const t = d / end;
      stampAt(dressPx, x, y, t < 0.45 ? face : t < 0.62 ? 7 : t > 0.88 ? (faceLit ? 8 : 6) : lee);
    }
  }
}
const BANK_MW = TILE + BANK_W[1] + 2, bankMask = new Uint8Array(BANK_MW * BANK_MW);

// ------------------------------------------------------------ long cracks
// A big lake is cut by long branching cracks: thin dark lines wandering
// across the sheet, each with a pale pixel under it where the ice's
// thickness catches the light, branching once or twice. Laid off the lake's
// own tiles by hash (the lake's label and the crack's number), kept off the
// shore's shelf (lakeDepth 2 and in), so a crack never climbs a bank.
const CRACK_EVERY = 110;      // tiles of big lake per long crack
const CRACK_MAX = 36;         // cracks on the biggest lake (FROZEN ISLES)
const CRACK_LEN = [50, 150];  // px a main crack runs
const CRACK_TURN = 0.55;      // radians it can wander per step
const CRACK_FORK = 0.16;      // chance a step forks a branch
function bakeCracks() {
  for (let id = 0; id < lakeTiles.length; id++) {
    const list = lakeTiles[id];
    if (list.length < BIG_LAKE) continue;
    const n = Math.min(CRACK_MAX, 1 + Math.floor(list.length / CRACK_EVERY));
    for (let c = 0; c < n; c++) {
      const key = id * 977 + c * 131;
      let at = -1;
      for (let tr = 0; tr < 8 && at < 0; tr++) {
        const j = list[(hash2(key + tr, 401) * list.length) | 0];
        if (lakeDepth[j] >= 3) at = j;
      }
      if (at < 0) continue;
      const x = (at % WORLD) * TILE + hash2(key, 409) * TILE, y = ((at / WORLD) | 0) * TILE + hash2(key, 419) * TILE;
      const L = CRACK_LEN[0] + (CRACK_LEN[1] - CRACK_LEN[0]) * hash2(key, 421);
      walkCrack(x, y, hash2(key, 431) * Math.PI * 2, L, 0, id, key);
    }
  }
}
function walkCrack(x, y, a, len, gen, id, key) {
  let s = 0, step = 0;
  while (s < len) {
    const h1 = hash2(key + step * 7, 433 + gen), h2 = hash2(key + step * 7, 439 + gen), h3 = hash2(key + step * 7, 443 + gen);
    a += (h1 - 0.5) * CRACK_TURN * 2;
    const seg = 3 + ((h2 * 4) | 0);
    const nx = x + Math.cos(a) * seg, ny = y + Math.sin(a) * seg;
    const tx = Math.floor(nx / TILE), ty = Math.floor(ny / TILE);
    if (!inWorld(tx, ty) || lakeId[idx(tx, ty)] !== id || lakeDepth[idx(tx, ty)] < 2) break;
    crackLine(Math.round(x), Math.round(y), Math.round(nx), Math.round(ny), gen);
    if (gen < 2 && h3 < CRACK_FORK) {
      walkCrack(nx, ny, a + (h3 < CRACK_FORK / 2 ? -1 : 1) * (0.6 + h2 * 0.6), (len - s) * 0.5, gen + 1, id, key * 3 + step + 1);
    }
    x = nx; y = ny; s += seg; step++;
  }
}
function crackLine(x0, y0, x1, y1, gen) {
  if (objAt(x0 >> 4, y0 >> 4) || objAt(x1 >> 4, y1 >> 4)) return; // under a landmark standing on the ice
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    const ink = gen ? 1 : 0;
    stampAt(dressPx, x0, y0, ink);
    stampAt(crackPx, x0, y0, ink);
    if (!gen) stampAt(dressPx, x0, y0 + 1, 2);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}

// ------------------------------------------------------------ frozen reeds
// Reeds poke out of the ice along the shores in clumps: a low noise lays out
// the stretches that grow them, so a shore has a stand here and bare banks
// there, never an even fringe. A clump is a few stalks of two browns rising
// out of a pinch of snow at the ice's edge, leaning a pixel downwind, some
// with a seed head, some capped with snow.
const REED_NOISE = 6;         // tiles per step of the noise that lays out the stands
const REED_CUT = 0.6;         // the noise above which a shore grows reeds
const REED_CLUMPS = 2;        // most clumps on one shore tile
const REED_EDGE = 3;          // px from the snow a clump's root may be
function bakeReeds() {
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    const n = lakesAround(tx, ty);
    if (n === 0 || n === 9 || !isLake(tx, ty) || ground[idx(tx, ty)] !== 1 || !dressFree(tx, ty)) continue;
    const q = vnoise(tx / REED_NOISE + 13.7, ty / REED_NOISE + 7.1);
    if (q < REED_CUT) continue;
    const clumps = 1 + ((hash2(tx * 5 + 1, ty * 7 + 3) * REED_CLUMPS * (q - REED_CUT) / (1 - REED_CUT) * 2) | 0);
    for (let c = 0; c < Math.min(REED_CLUMPS, clumps); c++) {
      for (let tr = 0; tr < 6; tr++) {
        const h = hash2(tx * 31 + c * 7 + tr, ty * 17 + 5);
        const x = tx * TILE + 2 + ((h * 12) | 0), y = ty * TILE + 2 + ((hash2(tx * 13 + tr, ty * 29 + c) * 12) | 0);
        if (!iceAtPx(x, y)) continue;
        if (iceAtPx(x, y + REED_EDGE) && iceAtPx(x, y - REED_EDGE) && iceAtPx(x + REED_EDGE, y) && iceAtPx(x - REED_EDGE, y)) continue;
        reedClump(x, y, tx * 101 + ty * 7 + c);
        break;
      }
    }
  }
}
function reedClump(x, y, key) {
  // the pinch of snow it stands in
  for (let i = -3; i <= 3; i++) stampAt(dressPx, x + i, y, Math.abs(i) === 3 ? 6 : 7);
  const n = 2 + ((hash2(key, 503) * 3) | 0), lean = LW_X > 0 ? 1 : -1;
  for (let s = 0; s < n; s++) {
    const h = hash2(key + s, 509), dx = (s - (n >> 1)) * 2 + (hash2(key + s, 521) < 0.3 ? 1 : 0);
    const tall = 4 + ((h * 6) | 0);
    for (let k = 1; k <= tall; k++) {
      const bx = x + dx + (k > tall * 0.6 && h > 0.4 ? lean : 0);
      stampAt(dressPx, bx, y - k, k <= tall / 2 ? 3 : 4);
      if (k === tall) {
        if (h > 0.62) { stampAt(dressPx, bx, y - k - 1, 5); stampAt(dressPx, bx, y - k - 2, 5); }
        else if (h < 0.3) stampAt(dressPx, bx, y - k - 1, 6);
      }
    }
  }
}

// ------------------------------------------------------------ dust on the ice
// A light, see-through dusting lies on every lake: grains of snow in faint
// streaks along the prevailing wind, heavier toward the downwind shore where
// the wind drops what it carried. A grain only lightens the ice under it -
// the shine and the sheet's two tones show through - and most of the ice
// carries none, so a lake still reads as slippery. Its amount rides the
// shallow band's depth on the ice. Feet scuff it: trampled snow's
// `trampleAt(x, y)` (0..1, refilling as snow falls) thins the grains, and
// it calls iceDustInvalidate over what changed so those tiles repaint.
const DUST_LONG = 26, DUST_WIDE = 4; // px per step of the dust's noise along and across the wind
const DUST_BASE = 0.1;        // the share of the noise that reads as dust on bare ice
const DUST_DEPTH = 0.25;      // ...added at the shallow band's full depth
const DUST_LEE = 0.2;         // ...added within DUST_LEE_PX of the downwind shore
const DUST_LEE_PX = 10;
const DUST_GRAIN = 0.5;       // how much each pixel's own roll breaks the streaks into grains
const DUST_MIX = [0, 0.28, 0.5]; // how far a grain pulls the ice toward the snow
const DUST_SNOW = rgbOf('#f2f7fc');
const DUST_TRAMPLE = 0.9;      // how much a fully trodden spot takes off the amount
const trodden = (x, y) => trampleAt(x, y);
// repaint the ice in a rect of world px whose trampling changed (called by trampled snow)
function iceDustInvalidate(x0, y0, x1, y1) {
  if (!lakeId) return;
  const g = groundCv.getContext('2d');
  for (let ty = Math.max(0, y0 >> 4); ty <= Math.min(WORLD - 1, y1 >> 4); ty++)
    for (let tx = Math.max(0, x0 >> 4); tx <= Math.min(WORLD - 1, x1 >> 4); tx++)
      if (ground[idx(tx, ty)] === 1 || (lakeId[idx(tx, ty)] < 0 && lakesAround(tx, ty) > 0)) paintGroundTile(g, tx, ty);
}
let dustLee = null;           // per tile: a lake tile whose shore is near enough downwind to heap dust
function bakeDustLee() {
  dustLee = new Uint8Array(WORLD * WORLD);
  const r = DUST_LEE_PX / TILE + 0.8;
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    if (!isLake(tx, ty)) continue;
    const x = (tx + 0.5 + LW_X * r), y = (ty + 0.5 + LW_Y * r);
    if (!isLake(Math.floor(x), Math.floor(y)) || !isLake(tx + Math.sign(Math.round(LW_X)), ty) || !isLake(tx, ty + Math.sign(Math.round(LW_Y)))) dustLee[idx(tx, ty)] = 1;
  }
}
const dustCache = new Map();
let dustK = -1, dustAmt = 0; // the last tile's amount, since a tile's pixels ask in a row
function iceDust(x, y) {
  const k = idx(x >> 4, y >> 4);
  if (k !== dustK) { dustK = k; dustAmt = DUST_BASE + DUST_DEPTH * Math.min(1, snowDepthAt(x >> 4, y >> 4) / DRIFT_MID()); }
  let amt = dustAmt - DUST_TRAMPLE * trodden(x, y);
  if (amt <= 0) return 0;
  if (dustLee[k] && !iceAtPx(Math.round(x + LW_X * DUST_LEE_PX), Math.round(y + LW_Y * DUST_LEE_PX))) amt += DUST_LEE;
  // the grain's own roll first: most pixels can't reach dust whatever the streak says
  const g = hash2(x * 7 + 3, y * 11 + 5) * DUST_GRAIN;
  if (g + 1 - DUST_GRAIN <= 1 - amt) return 0;
  const u = x * LW_X + y * LW_Y, v = -x * LW_Y + y * LW_X;
  const r = vnoise(u / DUST_LONG + 41, v / DUST_WIDE + 17) * (1 - DUST_GRAIN) + g;
  return r > 1 - amt * 0.35 ? 2 : r > 1 - amt ? 1 : 0;
}
// the ice's colour c at (x, y), with any dust on it
function dustIce(x, y, c) {
  const d = iceDust(x, y);
  if (!d) return c;
  const k = c.css + d;
  let m = dustCache.get(k);
  if (!m) {
    const f = DUST_MIX[d];
    m = [0, 1, 2].map((i) => Math.round(c[i] + (DUST_SNOW[i] - c[i]) * f));
    m.css = 'rgb(' + m.join(',') + ')'; // the shore's snow-tile painter fills by css
    dustCache.set(k, m);
  }
  return m;
}

// ------------------------------------------------------------ the weather on the ice
// What the day's weather does to the lakes, every frame, over the baked ice
// and under everything that stands: the wind drives thin streaks of blown
// snow across the big lakes (a blizzard thickens them), a frosty night makes
// the sheet glint and its long cracks stand out, and falling snow lays a
// fresh dusting that the wind carries off again. The weather's dials come in
// through lakeSky() alone.
function lakeSky() {
  // weatherNow() (the `weather` banner, sim.js): `drift` is the ground
  // blizzard, `frost` the clear cold, `snow` the share of flakes falling
  // (a calm day's 0.4 lays nothing new)
  const w = weatherNow();
  if (!w) return { blizzard: 0, frost: 0, snow: 0 }; // before the first step
  return { blizzard: w.drift || 0, frost: (w.frost || 0) * (0.35 + 0.65 * state.darkness), snow: Math.max(0, ((w.snow || 0) - 0.4) / 0.6) };
}
const LSTREAK_CELL = 72;      // world px of the grid the lake streaks are laid on
const LSTREAK_LEN = [28, 72]; // px a streak runs, shortest..longest
const LSTREAK_RUN = 180;      // px a streak drifts from appearing to gone
const LSTREAK_SPD = 34;       // px/s it drifts at full wind
const LSTREAK_A = 0.85;       // its alpha at the middle of its run, at full wind
const LSTREAK_PER = [1, 3];   // streaks a cell carries, calm day..blizzard
const LSTREAK_WAVE = 22, LSTREAK_WAVE_A = 2; // px per radian and px of a streak's roll over the ice
const LSTREAK_SHADE = '#9db6cc', LSTREAK_SHADE_A = 0.45; // its shadow, a px or two down and downwind
const LSTREAK_MIN = 0.08;     // the air below which no streak blows
const GLINT_P = 0.3;          // share of inner ice tiles that can glint on a frosty night
const GLINT_A = 0.9;          // a glint's alpha at full frost
const CRACK_FROST_A = 0.55;   // how much a full frost darkens the long cracks again
const CRACK_FROST = '#4d7a99';
let lakeDrift = 0, lakeDriftT = 0; // how far the air has carried the streaks, and when last read
// a tile of ice no shore crosses: where the weather may draw
const openIce = (tx, ty) => inWorld(tx, ty) && ground[idx(tx, ty)] === 1 && mirrorSlot[idx(tx, ty)] < 0;
function drawLakeSky(ox, oy, tx0, ty0, tx1, ty1) {
  if (!lakeId || PRACTICE) return;
  const sky = lakeSky(), t = state.windT;
  const now = performance.now() / 1000, dt = Math.min(0.1, lakeDriftT ? now - lakeDriftT : 0);
  lakeDriftT = now;
  const air = state.wind * (1 + sky.blizzard * 1.5);
  lakeDrift += dt * LSTREAK_SPD * (0.35 + 0.65 * Math.min(1, air)) * (state.windDir < 0 ? -1 : 1);
  ctx.save();
  // the fresh dusting: the atlas's grains, thicker as the snow falls harder
  if (sky.snow > 0.05) {
    const lv = Math.min(DUST_LEVELS - 1, Math.floor(sky.snow * DUST_LEVELS));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!openIce(tx, ty) || trodden(tx * TILE + 8, ty * TILE + 8) > 0.5) continue;
      const v = (hash2(tx * 3 + 1, ty * 5 + 2) * DUST_VARS) | 0;
      ctx.drawImage(dustCv, v * TILE, lv * TILE, TILE, TILE, tx * TILE - ox, ty * TILE - oy, TILE, TILE);
    }
  }
  // the cracks and glints of a frosty night
  if (sky.frost > 0.05) {
    ctx.fillStyle = CRACK_FROST; ctx.globalAlpha = sky.frost * CRACK_FROST_A;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const a = crackPx.get(idx(tx, ty));
      if (!a || ground[idx(tx, ty)] !== 1) continue;
      for (const p of a) ctx.fillRect(tx * TILE - ox + (p & 15), ty * TILE - oy + ((p >> 4) & 15), 1, 1);
    }
    ctx.fillStyle = '#ffffff';
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const h = hash2(tx * 29 + 1, ty * 31 + 3);
      if (h > GLINT_P || !openIce(tx, ty)) continue;
      const q = h / GLINT_P, tw = Math.sin(t * (1.1 + q * 2.3) + q * 47);
      if (tw < 0.75) continue;
      const a = sky.frost * GLINT_A * (tw - 0.75) / 0.25;
      const x = tx * TILE - ox + 2 + ((q * 977) | 0) % 12, y = ty * TILE - oy + 2 + ((q * 613) | 0) % 12;
      ctx.globalAlpha = a; ctx.fillRect(x, y, 1, 1);
      if (a > 0.45) { ctx.globalAlpha = a * 0.45; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
  }
  // blown snow over the big lakes: every streak's soft shadow first, then
  // the snow itself, so white reads on the pale ice the way the sweep does
  if (air > LSTREAK_MIN) {
    const aa = Math.pow(Math.min(1, air), 1.5), per = LSTREAK_PER[0] + Math.round(Math.min(1, sky.blizzard) * (LSTREAK_PER[1] - LSTREAK_PER[0]));
    const dir = state.windDir < 0 ? -1 : 1;
    const c0 = Math.floor((ox - LSTREAK_RUN) / LSTREAK_CELL), c1 = Math.floor((ox + WV_W + LSTREAK_RUN) / LSTREAK_CELL);
    const d0 = Math.floor(oy / LSTREAK_CELL), d1 = Math.floor((oy + WV_H) / LSTREAK_CELL);
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalCompositeOperation = pass ? 'source-over' : 'multiply';
      ctx.fillStyle = pass ? '#ffffff' : LSTREAK_SHADE;
      for (let cy = d0; cy <= d1; cy++) for (let cx = c0; cx <= c1; cx++) {
        const mx = Math.floor((cx + 0.5) * LSTREAK_CELL / TILE), my = Math.floor((cy + 0.5) * LSTREAK_CELL / TILE);
        if (!inWorld(mx, my) || !bigLakeAt(mx, my)) continue;
        for (let i = 0; i < per; i++) {
          const k = cx * 131 + cy * 977 + i * 13;
          const h1 = hash2(k, 601), h2 = hash2(k, 607), h3 = hash2(k, 613);
          const o = ((lakeDrift * (0.8 + 0.4 * h3) + h1 * LSTREAK_RUN) % LSTREAK_RUN + LSTREAK_RUN) % LSTREAK_RUN;
          const f = Math.sin(Math.PI * o / LSTREAK_RUN);
          const head = cx * LSTREAK_CELL + h2 * LSTREAK_CELL + dir * (o - LSTREAK_RUN / 2), wy = cy * LSTREAK_CELL + h3 * LSTREAK_CELL;
          const len = LSTREAK_LEN[0] + (LSTREAK_LEN[1] - LSTREAK_LEN[0]) * h2;
          ctx.globalAlpha = aa * f * (pass ? LSTREAK_A : LSTREAK_SHADE_A);
          // one rect per run of pixels sharing a row, so a long streak is a few calls
          let rx = 0, ry = 0, rn = 0;
          const flush = () => { if (rn) ctx.fillRect(pass ? rx : rx + dir, pass ? ry : ry + 2, rn, 1); rn = 0; };
          for (let j = 0; j < len; j++) {
            // solid behind the head, then flecks thinning out upwind
            const tt = j / len;
            if (tt > 0.6 && (j % (tt > 0.85 ? 4 : 2))) { flush(); continue; }
            const wx = head - dir * j, x = Math.round(wx - ox);
            const y = Math.round(wy + Math.sin(wx / LSTREAK_WAVE + i * 2.3) * LSTREAK_WAVE_A - oy);
            if (x < -2 || y < -3 || x >= WV_W || y >= WV_H || !openIce(Math.floor(wx / TILE), Math.floor(wy / TILE))) { flush(); continue; }
            // the run grows toward the head's side: extend it while the row holds
            if (rn && y === ry && (dir > 0 ? x === rx - 1 : x === rx + rn)) { if (dir > 0) rx = x; rn++; }
            else { flush(); rx = x; ry = y; rn = 1; }
          }
          flush();
        }
      }
    }
  }
  ctx.restore();
}
// the fresh dusting's atlas: DUST_VARS tiles of grains a row, each row
// holding the one above it and more (so the dusting thickens, never jumps)
const DUST_VARS = 4, DUST_LEVELS = 3;
const dustCv = (() => {
  const cv = document.createElement('canvas');
  cv.width = DUST_VARS * TILE; cv.height = DUST_LEVELS * TILE;
  const g = cv.getContext('2d');
  for (let v = 0; v < DUST_VARS; v++) for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    // a grain's rank: low ranks show first, clumped a little by a noise
    const r = hash2(i * 7 + v * 131 + 5, j * 13 + 3);
    const clump = Math.sin(i * 0.9 + v * 2) * Math.cos(j * 0.7 + v) * 0.5 + 0.5;
    const rank = r * 0.7 + (1 - clump) * 0.3;
    for (let lv = 0; lv < DUST_LEVELS; lv++) {
      if (rank > 0.06 + lv * 0.07) continue;
      g.fillStyle = rank < 0.03 ? 'rgba(248,251,254,0.9)' : 'rgba(242,247,252,0.6)';
      g.fillRect(v * TILE + i, lv * TILE + j, 1, 1);
    }
  }
  return cv;
})();
