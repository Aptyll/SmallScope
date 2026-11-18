'use strict';
// ------------------------------------------------------------ the falls' foot
// THE POOL AT THE ORCA'S FALLS IS WHAT FOUR RULES LEAVE: nothing in it is
// placed by hand. They run once at worldgen (genWorld, js/sim/field.js), in
// order, over a height field of the grotto's floor in world px round the
// falls (COVE_FALL):
//   1 the floor   falls away south to the lake, and the falls scour a hole
//                 under where they land
//   2 rockfall    stones break off the face (a few big, many small), drop to
//                 its foot and tumble out, the big ones farther; one that hits
//                 another stops against it, and one landing in the scour is
//                 carried out downstream until it sits clear of it, so the
//                 stones bank up in a bar on the pool's lip
//   3 the water   the falls fill the hole to the lowest gap in what holds it:
//                 every px's spill level flooded in from the box's open edges
//                 (a priority flood), and the pool is the water the falls reach
//   4 the cold    water the falls keep churning stays open; still water freezes
// A tile a third or more stone or pool (COVE_FOOT_HOLD) stands as OBJECTS.waterfall with the
// grotto's own: nothing walks over a stone or through the pool. The rolls are
// the pass's own worldRng, the noise hash2/vnoise: the same pool on every
// screen. The pixels: coveFootPaint, js/draw/cove.js.
const COVE_STONES = 26;            // stones that break off the face
const COVE_STONE_R = [3, 13];      // px: the smallest and the biggest
const COVE_SCOUR = [24, 17, 9, 8]; // the plunge hole: px wider than the falls' half, px tall, px deep, px below their foot
const COVE_FOOT_HOLD = 0.33;       // the share of a tile under stone or pool that makes it solid
const COVE_FOOT_PAD = [72, 8, 64]; // px the box reaches past the grotto: either side, above, below
let coveFoot = null; // { x0, y0, W, H (the box, world px), mid, foot, half (the falls in it), wall, hgt, lvl, rid, rdx, rdy, wet, churn (per px), stones }
function coveFootBuild() {
  const F = COVE_FALL.tiles, P = COVE_FOOT_PAD;
  const x0 = F[0] * TILE - P[0], y0 = F[1] * TILE - P[1];
  const W = (F[2] - F[0] + 1) * TILE + 2 * P[0], H = (F[3] - F[1] + 1) * TILE + P[1] + P[2];
  const mid = Math.round(COVE_FALL.x * TILE) - x0, foot = Math.round(COVE_FALL.foot * TILE) - y0;
  const half = Math.round(COVE_FALL.half * TILE), gy1 = (F[3] + 1) * TILE - y0;
  const R = worldRng('coveStones');
  const nz = (x, y, sc, o) => vnoise((x0 + x) / sc + 11.3 + o, (y0 + y) / sc + 4.7) - 0.5;
  const N = W * H, I = (x, y) => y * W + x, N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const at = (x, y) => I(Math.min(W - 1, Math.max(0, x)), Math.min(H - 1, Math.max(0, y)));
  // 1 the floor: from the face's foot (the rim's own wander, less the grotto's shade) down to the lake
  const wallY = (x) => gy1 - 10 + Math.round((vnoise((x0 + x) / 7 + 5.5, 2.5) - 0.5) * 5);
  const [SW, SY, DEEP, SD] = COVE_SCOUR, SX = half + SW;
  const scour = (x, y) => DEEP * Math.exp(-(((x - mid) / SX) ** 2) - (((y - foot - SD) / SY) ** 2)) * (1 + nz(x, y, 6, 2) * 0.6);
  const ground = new Float32Array(N), wall = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wy = wallY(x);
    if (y < wy) { ground[I(x, y)] = 99; wall[I(x, y)] = 1; continue; }
    ground[I(x, y)] = -0.1 * (y - wy) + nz(x, y, 9, 7) * 1.2 - scour(x, y);
  }
  // 2 rockfall
  const stones = [];
  for (let k = 0; k < COVE_STONES; k++) {
    const r = Math.min(COVE_STONE_R[1], COVE_STONE_R[0] * Math.pow(1 - R() * 0.96, -0.5)); // a few big, many small
    let x = mid - half - 34 + R() * (2 * half + 68), y = wallY(Math.round(x)) + 2 + r * 0.4;
    const a = Math.PI / 2 + (R() - 0.5) * 1.2 + (x - mid) / 90, run = r * (1 + R() * 2.2); // out from the face, the big ones farther
    const hits = (cx, cy) => stones.some((q) => Math.hypot(cx - q.x, (cy - q.y) / 0.78) < (r + q.r) * 0.82);
    if (hits(x, y)) continue; // the foot there is taken: it shatters on the one there
    for (let d = 0; d < run; d += 0.5) {
      const nx = x + Math.cos(a) * 0.5, ny = y + Math.sin(a) * 0.39;
      if (hits(nx, ny)) break;
      x = nx; y = ny;
    }
    for (let n = 0; n < 80 && scour(x, y) > 1.6; n++) { // the plunge won't hold it: carried out downstream
      const nx = x + Math.sign(x - mid + 0.01) * 0.35, ny = y + 0.5;
      if (hits(nx, ny)) break;
      x = nx; y = ny;
    }
    if (y > H - r) continue;
    stones.push({ x, y, r, k, base: ground[at(Math.round(x), Math.round(y))] });
  }
  const hgt = Float32Array.from(ground), rid = new Int16Array(N).fill(-1), rdx = new Float32Array(N), rdy = new Float32Array(N);
  stones.forEach((q, n) => {
    for (let y = Math.floor(q.y - q.r - 2); y <= q.y + q.r + 2; y++) for (let x = Math.floor(q.x - q.r - 2); x <= q.x + q.r + 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || wall[I(x, y)]) continue;
      const dx = (x - q.x) / q.r, dy = (y - q.y) / (q.r * 0.78), ang = Math.atan2(dy, dx);
      const rad = 1 + 0.16 * Math.sin(ang * 3 + q.k * 1.7) + 0.08 * Math.sin(ang * 5 + q.k); // never a circle
      const d = Math.hypot(dx, dy) / rad;
      if (d >= 1) continue;
      const h = q.base + q.r * 0.95 * Math.min(1, 1.7 * Math.sqrt(1 - d * d));
      if (h > hgt[I(x, y)]) { hgt[I(x, y)] = h; rid[I(x, y)] = n; rdx[I(x, y)] = dx / rad; rdy[I(x, y)] = dy / rad; }
    }
  });
  // 3 the water
  const lvl = new Float32Array(N).fill(1e9), done = new Uint8Array(N), heap = [];
  const push = (k, v) => { heap.push([v, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const t = heap[0], e = heap.pop(); if (heap.length) { heap[0] = e; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!wall[I(x, y)] && (x === 0 || x === W - 1 || y === H - 1)) { lvl[I(x, y)] = hgt[I(x, y)]; push(I(x, y), hgt[I(x, y)]); }
  while (heap.length) {
    const [v, k] = pop();
    if (done[k]) continue;
    done[k] = 1;
    const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of N4) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const q = I(X, Y);
      if (done[q] || wall[q]) continue;
      const nv = Math.max(hgt[q], v);
      if (nv < lvl[q]) { lvl[q] = nv; push(q, nv); }
    }
  }
  let best = -1;
  for (let y = foot; y < foot + 8 && y < H; y++) for (let x = mid - half; x <= mid + half; x++) if (!wall[I(x, y)] && (best < 0 || hgt[I(x, y)] < hgt[best])) best = I(x, y);
  const wet = new Uint8Array(N), q = [best];
  wet[best] = 1;
  while (q.length) {
    const k = q.pop(), x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of N4) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const n = I(X, Y);
      if (wet[n] || wall[n] || lvl[n] - hgt[n] < 0.25 || Math.abs(lvl[n] - lvl[best]) > 0.01) continue;
      wet[n] = 1; q.push(n);
    }
  }
  // 4 the cold: what the falls keep churning
  const churn = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (wet[I(x, y)] && Math.exp(-Math.hypot((x - mid) / (half + 16), (y - foot - 2) / 11)) > 0.28 + nz(x, y, 3, 9) * 0.25) churn[I(x, y)] = 1;
  }
  coveFoot = { x0, y0, W, H, mid, foot, half, wall, hgt, lvl, rid, rdx, rdy, wet, churn, stones };
  return coveFoot;
}
// the tiles the stones and the pool hold (COVE_FOOT_HOLD of a tile or more), below the grotto's own
function coveFootTiles() {
  const C = coveFoot || coveFootBuild(), out = [];
  const tx0 = Math.floor(C.x0 / TILE), tx1 = Math.floor((C.x0 + C.W - 1) / TILE);
  const ty0 = COVE_FALL.tiles[3] + 1, ty1 = Math.floor((C.y0 + C.H - 1) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    let n = 0;
    for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
      const x = tx * TILE + i - C.x0, y = ty * TILE + j - C.y0;
      if (x < 0 || y < 0 || x >= C.W || y >= C.H) continue;
      const k = y * C.W + x;
      if (C.rid[k] >= 0 || C.wet[k]) n++;
    }
    if (n >= COVE_FOOT_HOLD * TILE * TILE) out.push([tx, ty]);
  }
  return out;
}
