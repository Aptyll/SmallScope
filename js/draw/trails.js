'use strict';
// ------------------------------------------------------------ animal trails
// The open snow between the tree walls is walked by more than heroes: from
// each jungle camp a line of prints runs to the camps nearest it, the way a
// beast would go - down the middle of the corridors, wandering a little,
// never through a pine. Prints only, pressed one tone under the snow: no
// path, no outline, nothing with height, so a trail is plainly ground. They
// are baked into the ground (paintTrails, from paintGroundTile) on open snow
// alone: a trail breaks at a lane, at ice and inside a camp's own yard, which
// has its own. Laid once from the map (bakeTrails, from prepGround): every
// roll is hash2/vnoise of the tiles, so every screen lays the same trails.
const TRAIL_LINKS = 2;        // nearest camps each camp's trail runs to
const TRAIL_YARD = 7;         // tiles round a camp its trails keep out of
const TRAIL_WALL = 2.5;       // extra cost of a tile beside a pine: a trail keeps to the middle
const TRAIL_WANDER = 3;       // ...and of the noise that makes it wander
const TRAIL_LANE = 8, TRAIL_ICE = 5; // ...and of crossing paving and ice, where it leaves no prints
const TRAIL_COL = ['#aebbd3', '#c0cbdf']; // a print: pressed snow in its own shade (a den's own prints' tone on snow), and a shallower one
// a gait: px between its prints along the trail, and each print as [along, across, tone]; a print is three pixels (a den's own, js/draw/yards.js)
const TRAIL_GAITS = [
  { step: 9,  px: [[0, -2, 0], [0, 2, 0]] },                           // deer: two slots side by side
  { step: 6,  px: [[0, 0, 0]], zig: 1.5 },                             // wolf: one line, a foot each side
  { step: 14, px: [[0, -2, 0], [0, 2, 0], [-4, 0, 1], [-7, 0, 1]] },   // hare: the hind feet land ahead, side by side
];
let trailPx = null; // tile index -> [x, y, tone, ...] world px of the prints on it

function trailOpen(tx, ty) { return inWorld(tx, ty) && !objects[idx(tx, ty)]; }
// the cheapest walk from one tile to another over open tiles (eight ways), or null
function trailWalk(sx, sy, gx, gy) {
  const N = WORLD * WORLD, cost = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1);
  const heap = [], goal = idx(gx, gy);
  const push = (c, i) => { let k = heap.length; heap.push([c, i]); while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= c) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; }
    }
    return top;
  };
  cost[idx(sx, sy)] = 0; push(0, idx(sx, sy));
  while (heap.length) {
    const [c, i] = pop();
    if (i === goal) break;
    if (c > cost[i]) continue;
    const x = i % WORLD, y = (i / WORLD) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((!dx && !dy) || !trailOpen(nx, ny) || (dx && dy && (!trailOpen(nx, y) || !trailOpen(x, ny)))) continue;
      const j = idx(nx, ny), gv = ground[j];
      let w = 1 + vnoise(nx / 4 + 13.7, ny / 4 + 5.1) * TRAIL_WANDER + (gv === 3 ? TRAIL_LANE : gv ? TRAIL_ICE : 0);
      if (!trailOpen(nx + 1, ny) || !trailOpen(nx - 1, ny) || !trailOpen(nx, ny + 1) || !trailOpen(nx, ny - 1)) w += TRAIL_WALL;
      const nc = c + w * (dx && dy ? 1.414 : 1);
      if (nc < cost[j]) { cost[j] = nc; from[j] = i; push(nc, j); }
    }
  }
  if (from[goal] < 0) return null;
  const path = [];
  for (let i = goal; i >= 0; i = from[i]) path.push([(i % WORLD + 0.5) * TILE, (((i / WORLD) | 0) + 0.5) * TILE]);
  return path;
}
// the open tile nearest a camp's middle (a den stands on its own)
function trailFoot(C) {
  for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && trailOpen(C.tx + dx, C.ty + dy) && !ground[idx(C.tx + dx, C.ty + dy)]) return [C.tx + dx, C.ty + dy];
  }
  return null;
}
function bakeTrails() {
  trailPx = new Map();
  const done = new Set();
  const dot = (x, y, tone) => {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!trailOpen(tx, ty) || ground[idx(tx, ty)] || laneDist(tx, ty) < ROAD_SHOULDER + 1.2) return;
    for (const C of camps) if (Math.hypot(C.tx - tx, C.ty - ty) < TRAIL_YARD) return;
    const k = idx(tx, ty);
    if (!trailPx.has(k)) trailPx.set(k, []);
    trailPx.get(k).push(Math.floor(x), Math.floor(y), tone);
  };
  camps.forEach((A, ai) => {
    const near = camps.map((B, bi) => [Math.hypot(A.tx - B.tx, A.ty - B.ty), bi]).filter((e) => e[1] !== ai).sort((p, q) => p[0] - q[0] || p[1] - q[1]).slice(0, TRAIL_LINKS);
    for (const [, bi] of near) {
      const key = Math.min(ai, bi) * 64 + Math.max(ai, bi);
      if (done.has(key)) continue;
      done.add(key);
      const a = trailFoot(A), b = trailFoot(camps[bi]), path = a && b && trailWalk(a[0], a[1], b[0], b[1]);
      if (!path) continue;
      // the tiles' middles rounded off (each point the mean of itself and its two neighbours), then walked a gait's step at a time
      const P = path.map((p, i) => { const q = path[Math.max(0, i - 2)], r = path[Math.min(path.length - 1, i + 2)]; return [(p[0] * 2 + q[0] + r[0]) / 4, (p[1] * 2 + q[1] + r[1]) / 4]; });
      const G = TRAIL_GAITS[(hash2(key * 7 + 3, 41) * TRAIL_GAITS.length) | 0];
      let left = G.step, n = 0;
      for (let i = 1; i < P.length; i++) {
        const dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        for (; left <= L; left += G.step, n++) {
          const x = P[i - 1][0] + ux * left, y = P[i - 1][1] + uy * left, z = G.zig ? (n % 2 ? G.zig : -G.zig) : 0;
          for (const [al, ac, tone] of G.px) {
            const fx = Math.round(x + ux * al - uy * (ac + z)), fy = Math.round(y + uy * al + ux * (ac + z));
            dot(fx, fy, tone); dot(fx + 1, fy, tone); dot(fx + (ux > 0 ? 1 : 0), fy + 1, tone);
          }
        }
        left -= L;
      }
    }
  });
}
// a snow tile's prints, over its drifts
function paintTrails(g, tx, ty) {
  const T = trailPx && trailPx.get(idx(tx, ty));
  if (!T) return;
  for (let i = 0; i < T.length; i += 3) penDot(g, TRAIL_COL[T[i + 2]], T[i], T[i + 1]);
  penFlush();
}
