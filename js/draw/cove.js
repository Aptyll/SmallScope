'use strict';
// ------------------------------------------------------------ the orca's cove, drawn
// The pixels of the epic camp's pit (COVE, COVE_FALL: js/sim/field.js).
//   the rim      a face of cut stone hanging down from every pine wall that
//                has the cove's open ground south of it (the 3/4 view shows
//                a wall's face only there), in strata wavering along it,
//                darkening to its foot, a line of its own darkest stone where
//                it meets the ground and a band of shade under that, and
//                icicles off its lip. In the GROTTO - the waterfall's tiles,
//                the notch in the back wall - the face runs all the way down
//                to the plunge pool. Baked once (coveRimBuild) off the
//                tiles as they stand, its edge smoothed between tile centres
//                and roughened a little so it never runs in steps; laid flat
//                under everything that stands (drawCoveRim), so the pines
//                and the bodies cover it.
//   the falls    a curtain of water down the grotto, widening as it falls, its
//                edges frozen, a curl of white over the lip; per column a
//                streak of its own speed, period and length scrolling down;
//                foam churning at its foot; the pool and the stones banked
//                round it as four rules left them (coveFootPaint, off
//                js/sim/covefoot.js), with rings spreading and spray
//                lifting. Every pixel is a pure function of the loop's frame
//                (COVE_FRAMES of them, each period dividing the loop), baked
//                once into its own canvas and drawn y-sorted at the grotto's
//                foot (coveDraws), so a body south of the pool stands over it.
// The view's own clock picks the frame: it is scenery, no sim reads it.
const COVE_FRAMES = 12;      // frames in the falls' loop
const COVE_FRAME_S = 0.09;   // s a frame
const COVE_FALL_V = 2;       // px a frame the slow streaks drop (the fast ones twice it)
const COVE_FACE = 12;        // px of stone face under a wall
const COVE_LIP_WANDER = 0.22; // how far the lip's bays and spurs wander, in the softened open-ness
const COVE_STONE = ['#465066', '#606a84', '#808aa2', '#343a50']; // the face, its lit band, its top edge, its deep (and its foot line)
const COVE_SHADE = 'rgba(16,24,56,0.22)'; // the face's shade on the ground under it
const COVE_ICE = ['#cdeeff', '#96d2f0', '#60a0cd']; // ice: lit, mid, its own dark
const COVE_SNOW = '#f0f5fb';
const COVE_WATER = ['#26548c', '#4a8cc4', '#8ccef0', '#d6f4ff', '#ffffff']; // deep .. foam
const COVE_RGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// the grotto's box in world px: the waterfall's tiles
function coveGrotto() {
  const F = COVE_FALL.tiles;
  return { x0: F[0] * TILE, y0: F[1] * TILE, x1: (F[2] + 1) * TILE, y1: (F[3] + 1) * TILE };
}

// ---- the rim ---------------------------------------------------------------
let coveRimCv = null; // { cv, x0, y0 }
// a tile the face hangs off: a pine of the wall (the grotto counts as open:
// its own face is the back of it)
function coveWall(tx, ty) {
  const o = inWorld(tx, ty) ? objects[idx(tx, ty)] : null;
  return !inWorld(tx, ty) || (!!o && o.type === 'tree');
}
function coveRimBuild() {
  const pad = 3, cx = COVE[0], cy = COVE[1];
  const tx0 = Math.floor(cx - COVE[2] - COVE_LEDGE[0]) - pad, tx1 = Math.ceil(cx + COVE[2] + COVE_LEDGE[0]) + pad;
  const ty0 = Math.floor(COVE_FALL.top) - pad, ty1 = Math.ceil(COVE_CUT_Y) + 1;
  const x0 = tx0 * TILE, y0 = ty0 * TILE, W = (tx1 - tx0) * TILE, H = (ty1 - ty0) * TILE;
  // open ground per pixel: the tiles' open-ness softened over the tiles
  // round each ([1 2 1] each way) and read between their centres, so a wall
  // running on a slant is one clean line and not a stair of tiles; then a
  // slow wander of the map's noise, so the lip has bays and spurs but never
  // a speckled edge
  const open = new Uint8Array(W * H);
  const NT = tx1 - tx0 + 4, MT = ty1 - ty0 + 4, soft = new Float32Array(NT * MT);
  const K = [1, 2, 1];
  for (let b = 0; b < MT; b++) for (let a = 0; a < NT; a++) {
    let v = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) v += (coveWall(tx0 - 2 + a + i, ty0 - 2 + b + j) ? 0 : 1) * K[i + 1] * K[j + 1];
    soft[b * NT + a] = v / 16;
  }
  const op = (tx, ty) => soft[(ty - ty0 + 2) * NT + tx - tx0 + 2];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (x0 + i + 0.5) / TILE - 0.5, y = (y0 + j + 0.5) / TILE - 0.5;
    const a = Math.floor(x), b = Math.floor(y), fx = x - a, fy = y - b;
    const v = op(a, b) * (1 - fx) * (1 - fy) + op(a + 1, b) * fx * (1 - fy) + op(a, b + 1) * (1 - fx) * fy + op(a + 1, b + 1) * fx * fy;
    open[j * W + i] = v + (vnoise((x0 + i) / 9 + 31.7, (y0 + j) / 6 + 8.3) - 0.5) * COVE_LIP_WANDER > 0.5 ? 1 : 0;
  }
  const G = coveGrotto();
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const put = (i, j, c) => { if (i >= 0 && j >= 0 && i < W && j < H) penDot(g, c, i, j); };
  for (let i = 0; i < W; i++) {
    const wx = x0 + i, fl = COVE_FALL.flank * TILE, flank = wx >= G.x0 - fl && wx < G.x1 + fl;
    let n = 999;
    for (let j = 0; j < H; j++) {
      n = open[j * W + i] ? n + 1 : 0;
      const wy = y0 + j, fx = (wx + 0.5) / TILE, fy = (wy + 0.5) / TILE;
      // in the grotto the face runs from wherever its wall stands down to the
      // pool, wherever that is: its foot is the grotto's own
      // (its flanks too, on its bottom row: the grotto's stone flaring out into the rim)
      const grotto = flank && (wx >= G.x0 && wx < G.x1 || wy >= G.y1 - TILE - COVE_FACE);
      const foot = G.y1 + Math.round((vnoise(wx / 7 + 5.5, 2.5) - 0.5) * 5); // its foot wanders a little, never a ruled line
      const face = grotto ? n + foot - 1 - wy : COVE_FACE;
      if (!n || n > face + 3) continue;
      if (!(grotto && wy < foot) && (fy > COVE_CUT_Y || fieldCove(fx, fy) > 1.2)) continue;
      if (n > face + 1) { put(i, j, COVE_SHADE); continue; }       // its shade on the ground
      if (n === face + 1) { put(i, j, COVE_STONE[3]); continue; }  // its foot, in its own darkest stone
      let c;
      if (grotto) c = coveRock(wx, wy, n, face);
      else {
        const stra = (wy + Math.round(3 * Math.sin(wx / 9))) % 5;     // strata, wavering along the wall
        c = n <= 1 ? COVE_SNOW : n === 2 ? COVE_STONE[2] : stra === 0 ? COVE_STONE[1] : COVE_STONE[0]; // the lip: a line of the ledge's snow over its lit edge
        if (n > face * 0.65) c = stra ? COVE_STONE[3] : COVE_STONE[0];
        if ((wx * 7 + wy * 3) % 23 === 0 && n > 2) c = COVE_STONE[3];                       // a chip
        if (wx % 11 === Math.floor(hash2(Math.floor(wx / 11), 1) * 9) && n > 2 && n < face - 1) c = COVE_STONE[3]; // a joint
      }
      put(i, j, c);
    }
  }
  // icicles off the lip, either side of the falls
  for (let k = 0; k < 22; k++) {
    const i = Math.round((cx - 8 + k * 0.75) * TILE) - x0 + Math.floor(hash2(k, 5) * 3);
    if (i < 0 || i >= W || (x0 + i >= G.x0 - 2 && x0 + i < G.x1 + 2)) continue;
    let top = -1;
    for (let j = 1; j < H; j++) if (open[j * W + i] && !open[(j - 1) * W + i]) { top = j; break; }
    if (top < 0 || fieldCove((x0 + i + 0.5) / TILE, (y0 + top + 0.5) / TILE) > 1.2) continue;
    const L = 3 + Math.floor(hash2(k, 6) * 6);
    for (let j = 0; j < L; j++) { put(i, top + j, j < L - 1 ? COVE_ICE[0] : COVE_SNOW); if (j < L - 1) put(i + 1, top + j, COVE_ICE[2]); }
  }
  penFlush();
  coveRimCv = { cv, x0, y0 };
}
// the grotto's back at a world px: broken rock, one block per cell of a
// jittered grid (COVE_ROCK px), each its own tone, a crack of the deep stone
// between two, the lit top edge of each (bare stone: no snow, no ice), the whole
// darkening toward the pool - `n` px down from its wall, of `face`
const COVE_ROCK = [10, 8];
function coveRock(wx, wy, n, face) {
  const [cw, ch] = COVE_ROCK, gx = Math.floor(wx / cw), gy = Math.floor(wy / ch);
  let d1 = 1e9, d2 = 1e9, best = 0, by = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const X = gx + i, Y = gy + j, px = (X + 0.15 + 0.7 * hash2(X + 700, Y + 31)) * cw, py = (Y + 0.15 + 0.7 * hash2(X + 41, Y + 703)) * ch;
    const d = Math.hypot((wx - px) / cw, (wy - py) / ch * 1.3);
    if (d < d1) { d2 = d1; d1 = d; best = X * 7919 + Y; by = py; } else if (d < d2) d2 = d;
  }
  if (n <= 1) return COVE_STONE[2];
  if (d2 - d1 < 0.09) return COVE_STONE[3];                                  // a crack between two blocks
  const k = hash2(best, 88), low = n / face;
  if (wy < by - ch * 0.3 && d2 - d1 < 0.3) return COVE_STONE[2]; // a block's lit top
  const tone = k + low * 0.9 - 0.45;                                       // each its own tone, darker down
  return tone > 0.75 ? COVE_STONE[3] : tone > 0.2 ? COVE_STONE[0] : COVE_STONE[1];
}
// THE PINES STAND BACK from the lip: a wall pine with the cove's open ground
// in front of it (below it, or below beside it) is drawn COVE_PINE_BACK px up
// its own tile, so its trunk stands on the ledge's snow behind the stone
// face rather than on the edge of it (drawSceneryObj, js/draw/passes.js).
// The grotto's frame keeps its pines where they are. Built once off the
// tiles, like the rim
const COVE_PINE_BACK = 6;
let coveBackAt = null; // tile index -> 1 for a pine that stands back
function coveBack(tx, ty) {
  if (!coveBackAt) {
    coveBackAt = new Set();
    for (let ty = Math.floor(COVE_FALL.top) - 3; ty < COVE_CUT_Y; ty++) for (let tx = 0; tx < WORLD; tx++) {
      if (!coveWall(tx, ty) || !inWorld(tx, ty)) continue;
      for (let i = -1; i <= 1; i++) {
        const X = tx + i, Y = ty + 1;
        if (inWorld(X, Y) && Y + 0.5 < COVE_CUT_Y && !objects[idx(X, Y)] && fieldCove(X + 0.5, Y + 0.5) < 1.2) { coveBackAt.add(idx(tx, ty)); break; }
      }
    }
  }
  return coveBackAt.has(idx(tx, ty)) ? COVE_PINE_BACK : 0;
}
// flat, under all that stands (drawFlatPass, js/draw/passes.js)
function drawCoveRim(ex, ey) {
  if (!coveRimCv) coveRimBuild();
  const R = coveRimCv, x = R.x0 - ex, y = R.y0 - ey;
  if (x > WV_W || y > WV_H || x + R.cv.width < 0 || y + R.cv.height < 0) return;
  ctx.drawImage(R.cv, x, y);
}

// ---- the falls -------------------------------------------------------------
const coveFallCvs = [];
let coveFallBox = null; // { x0, y0, w, h }: world px every frame is drawn into
// one frame of the loop, `t` 0..COVE_FRAMES-1, into its own canvas
function coveFallFrame(t) {
  const G = coveGrotto(), B = coveFallBox, W = B.w, H = B.h;
  const rgb = new Float32Array(W * H * 3), al = new Float32Array(W * H);
  const sx = (wx) => Math.round(wx) - B.x0, sy = (wy) => Math.round(wy) - B.y0;
  const ink = COVE_WATER.map(COVE_RGB), ice = COVE_ICE.map(COVE_RGB), stone = COVE_RGB(COVE_STONE[3]);
  const mix = (x, y, c, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const k = y * W + x, oa = al[k], na = a + oa * (1 - a);
    for (let q = 0; q < 3; q++) rgb[k * 3 + q] = (c[q] * a + rgb[k * 3 + q] * oa * (1 - a)) / na;
    al[k] = na;
  };
  const put = (x, y, c) => mix(x, y, c, 1);
  const h = (a, b) => hash2(a + 4111, b + 977);
  const mid = sx(COVE_FALL.x * TILE), top = sy(COVE_FALL.top * TILE), foot = sy(COVE_FALL.foot * TILE);
  const half = Math.round(COVE_FALL.half * TILE), height = foot - top;
  // the curtain
  for (let j = -2; j <= height; j++) {
    const y = top + j, gr = Math.max(0, j) / height;
    const wl = half + Math.floor(gr * 5 + 1.2 * Math.sin(j / 5 + 1)), wr = half + Math.floor(gr * 5 + 1.2 * Math.sin(j / 4 + 2.5)); // it widens as it falls, its sides wavering each its own way
    for (let i = -wl - 1; i <= wr + 1; i++) {
      const x = mid + i, u = (i + wl) / (wl + wr);
      if (i === -wl - 1 || i === wr + 1) { if (j >= 0) put(x, y, (Math.floor(j / 3) + i) % 4 ? stone : ice[2]); continue; } // its ragged frozen edges
      if (i === -wl || i === wr || ((i === -wl + 1 || i === wr - 1) && (j * 7 + i + 99) % 5 === 0)) { if (j >= 0) put(x, y, i < 0 ? ice[0] : ice[1]); continue; }
      const curl = 2 - Math.floor(2 * Math.pow(i / Math.max(wl, wr), 2)); // the lip bulges out in the middle
      if (j < curl) { if (j >= -2 + (Math.abs(i) < half - 3 ? 0 : 2)) put(x, y, j < curl - 1 ? ink[4] : ink[3]); continue; }
      let c = u < 0.3 ? ink[2] : u < 0.72 ? ink[1] : ink[0];
      // long thin streaks, each column its own speed, period and length, all looping on the frames
      const col = i + 40;
      if (h(col, 9) > 0.3) {
        const v = h(col, 10) > 0.5 ? 2 * COVE_FALL_V : COVE_FALL_V;
        const P = v > COVE_FALL_V ? [24, 48][Math.floor(h(col, 11) * 2)] : [12, 24][Math.floor(h(col, 11) * 2)];
        const L = Math.floor(P * (0.3 + 0.25 * h(col, 12)));
        const s = (((j - t * v + Math.floor(h(col, 13) * P)) % P) + P) % P;
        if (s < L) c = s >= L - 1 ? ink[4] : s >= L - 4 || u < 0.3 ? ink[3] : ink[2];
      }
      put(x, y, c);
    }
  }
  // the pool at its foot, the stones banked round it (coveFootPaint)
  const P = coveFootPaint();
  for (let k = 0; k < W * H; k++) if (P.a[k]) put(k % W, (k / W) | 0, [P.c[k * 3], P.c[k * 3 + 1], P.c[k * 3 + 2]]);
  const px = P.ox, py = P.oy, rx = P.orx, ry = P.ory;
  // the foam at its foot, a churn of white blobs, each swelling and settling on the loop
  for (let k = 0; k < 11; k++) {
    const bx = mid + Math.floor((h(k, 21) - 0.5) * 2 * (half + 7)), by = foot + Math.floor(h(k, 22) * 4) - 1;
    const r = 3.5 + 2 * h(k, 24) + 1.4 * Math.sin(2 * Math.PI * t / COVE_FRAMES + h(k, 23) * 2 * Math.PI);
    for (let j = -Math.floor(r) - 1; j <= Math.floor(r) + 1; j++) for (let i = -Math.floor(r) - 1; i <= Math.floor(r) + 1; i++) {
      if ((i * i + j * j) / (r * r) <= 1) put(bx + i, by + j, j < r * 0.3 ? ink[4] : ink[3]);
    }
  }
  // rings spreading from the foot, a third of the loop apart
  for (let k = 0; k < 3; k++) {
    const f = ((t + k * COVE_FRAMES / 3) % COVE_FRAMES) / COVE_FRAMES, rr = 0.25 + f * 0.75;
    for (let n = 0; n < 64; n++) {
      if (h(n, k + 30) < 0.25) continue;
      const a = n / 64 * 2 * Math.PI;
      mix(px + Math.trunc(Math.cos(a) * rx * rr), py - 2 + Math.trunc(Math.sin(a) * ry * rr * 0.8), ink[4], (1 - f) * 0.9);
    }
  }
  // spray: drops lift off the foot, drift and fade on the loop
  for (let k = 0; k < 26; k++) {
    const f = ((t + h(k, 1) * COVE_FRAMES) % COVE_FRAMES) / COVE_FRAMES;
    const x = px + Math.trunc((h(k, 2) - 0.5) * 2 * half + (h(k, 3) - 0.5) * 10 * f), y = foot + 2 - Math.trunc(f * (10 + h(k, 4) * 14));
    mix(x, y, ink[4], (1 - f) * 0.9);
    if (h(k, 5) > 0.6) mix(x + 1, y, ink[3], (1 - f) * 0.6);
  }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), im = g.createImageData(W, H);
  for (let k = 0; k < W * H; k++) {
    if (!al[k]) continue;
    for (let q = 0; q < 3; q++) im.data[k * 4 + q] = Math.round(rgb[k * 3 + q]);
    im.data[k * 4 + 3] = Math.round(al[k] * 255);
  }
  g.putImageData(im, 0, 0);
  return cv;
}
// THE FOOT'S PIXELS, off the four rules' height field (coveFoot, js/sim/covefoot.js),
// once: a stone lit up-left off its own round and ringed in its own darkest
// stone, a dark wet line where it meets the water, one under the water seen
// through it; open water darker where it is deep; still water frozen, with a
// dark edge where the ice meets the churn. Nothing on a stone: no snow, no ice
let coveFootPx = null; // { c, a, ox, oy, orx, ory }: the pixels, and the open water's middle and reach
function coveFootPaint() {
  if (coveFootPx) return coveFootPx;
  const C = coveFoot || coveFootBuild(), { W, H, mid, foot, half, wall, hgt, lvl, rid, rdx, rdy, wet, churn } = C;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], at = (x, y) => Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x));
  const sto = COVE_STONE.map(COVE_RGB), ice = COVE_ICE.map(COVE_RGB), ink = COVE_WATER.map(COVE_RGB);
  const c = new Float32Array(W * H * 3), a = new Float32Array(W * H);
  const set = (k, col) => { c[k * 3] = col[0]; c[k * 3 + 1] = col[1]; c[k * 3 + 2] = col[2]; a[k] = 1; };
  let ox = 0, oy = 0, on = 0, oxa = 0, oya = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (wall[k]) continue;
    if (rid[k] >= 0) {
      const q = C.stones[rid[k]];
      const edge = N4.some(([ex, ey]) => { const X = x + ex, Y = y + ey; return X < 0 || Y < 0 || X >= W || Y >= H || rid[Y * W + X] !== rid[k] && hgt[Y * W + X] < hgt[k] - 0.6; });
      const lit = -rdx[k] * 0.6 - rdy[k] * 0.8 + (vnoise((C.x0 + x) / 3 + 11.3 + q.k, (C.y0 + y) / 3 + 4.7) - 0.5) * 0.25;
      let col = lit > 0.55 ? sto[2] : lit > -0.1 ? sto[1] : lit > -0.6 ? sto[0] : sto[3];
      if (edge || hgt[k] - lvl[k] < 0.9 && N4.some(([ex, ey]) => wet[at(x + ex, y + ey)])) col = sto[3]; // its ring, and the wet line
      if (wet[k] && lvl[k] > hgt[k] + 0.1) col = [36, 66, 108];                                        // a stone under the water
      set(k, col);
      continue;
    }
    if (!wet[k]) continue;
    const d = lvl[k] - hgt[k];
    if (churn[k]) { set(k, d > 3 ? ink[0] : d > 1.2 ? [38, 74, 124] : ink[1]); ox += x; oy += y; on++; oxa = Math.max(oxa, Math.abs(x - mid)); oya = Math.max(oya, y - foot); }
    else set(k, N4.some(([ex, ey]) => churn[at(x + ex, y + ey)]) ? ice[2] : d > 2 ? ice[1] : ice[0]);
  }
  coveFootPx = { c, a, ox: on ? Math.round(ox / on) : mid, oy: on ? Math.round(oy / on) : foot + 3, orx: Math.min(half + 8, Math.max(6, oxa)), ory: Math.max(3, Math.min(6, oya)) };
  return coveFootPx;
}
// the falls' entry in the y-sorted list (gatherDraws, js/draw/passes.js): at
// the grotto's foot, so the pines behind it are covered and a body in front
// stands over its pool
function coveDraws(draws, ox, oy) {
  const G = coveGrotto();
  if (G.x1 + 16 < ox || G.x0 - 16 > ox + WV_W || G.y1 + 16 < oy || G.y0 - 32 > oy + WV_H) return;
  if (!coveFallBox) { const C = coveFoot || coveFootBuild(); coveFallBox = { x0: C.x0, y0: C.y0, w: C.W, h: C.H }; } // the foot's own box
  const B = coveFallBox;
  draws.push({ y: G.y1, fn: drawCoveFall, bx: B.x0, by: B.y0, bw: B.w, bh: B.h });
}
function drawCoveFall(d, ex, ey, now) {
  const t = Math.floor(now / COVE_FRAME_S) % COVE_FRAMES;
  if (!coveFallCvs[t]) coveFallCvs[t] = coveFallFrame(t);
  ctx.drawImage(coveFallCvs[t], coveFallBox.x0 - ex, coveFallBox.y0 - ey);
}
