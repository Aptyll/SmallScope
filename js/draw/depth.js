'use strict';
// How deep snow looks: the DEEP band's raised drift baked into the ground,
// and the frosted reeds standing in it that make it read as brush. The map
// itself is js/sim/depth.js; who it hides, js/sim/fog.js.
// ------------------------------------------------------------ deep snow's look
// A deep drift has to read as HIGHER than the snow round it at a glance, in
// the game's own light (the sun is top-left, like every cast shade): a white
// crest where its edge faces the sun, a smooth bright top, a dark lip two
// pixels thick where it faces away, and its own short shade thrown on the
// snow down-right of it, longest at the tall crest. Painted per pixel into
// the ground bake by snowTile (js/draw/ground.js) through deepTone, from the
// same drift depth the sim reads (driftsDepth), so what is drawn deep IS deep to the pixel.
// Loaded before ground.js: SNOW_INK appends DEEP_PAL at load.
const DEEP_PAL = [
  '#e6eef8', // 5  top, the lee slope
  '#f6f9fd', // 6  top
  '#fdfeff', // 7  top, the slope facing the sun
  '#ffffff', // 8  the sunlit crest
  '#a4b8d2', // 9  the lip, facing away
  '#c2d1e4', // 10 ...its upper row
  '#cfdbea', // 11 the drift's shade on the snow
  '#d3dfed', // 12 the thin line round its sunlit edge
];
const DEEP_T0 = 5;           // DEEP_PAL[0]'s index in SNOW_INK
const DEEP_SHADE_PX = 4;     // the longest shade a drift throws, at full height
const DEEP_RIPPLE = 7;       // px between the wind ripples across a drift's top
// the depth at world pixel (x, y)'s centre. deepTone reads each pixel's
// neighbours up to DEEP_SHADE_PX up-left and two down-right, so a tile alone
// asked for each depth about six times: snowTile opens a window over its own
// tile (deepTileOpen) and each depth in it is worked out once
const DEEP_WIN = TILE + DEEP_SHADE_PX + 2;
const deepWin = new Float64Array(DEEP_WIN * DEEP_WIN);
let deepX0 = 0, deepY0 = 0, deepOpen = false;
function deepTileOpen(px, py) { deepX0 = px - DEEP_SHADE_PX; deepY0 = py - DEEP_SHADE_PX; deepWin.fill(NaN); deepOpen = true; }
function deepTileClose() { deepOpen = false; }
function deepPx(x, y) {
  if (deepOpen) {
    const i = x - deepX0, j = y - deepY0;
    if (i >= 0 && j >= 0 && i < DEEP_WIN && j < DEEP_WIN) {
      const k = j * DEEP_WIN + i;
      let d = deepWin[k];
      if (d !== d) d = deepWin[k] = driftsDepth((x + 0.5) / TILE, (y + 0.5) / TILE);
      return d;
    }
  }
  return driftsDepth((x + 0.5) / TILE, (y + 0.5) / TILE);
}
const deepIn = (x, y) => deepPx(x, y) >= DEPTH_DEEP;
// the tone for world pixel (x, y) given the plain snow's tone t, on a tile
// whose driftCell is not empty
function deepTone(x, y, t) {
  const d = deepPx(x, y);
  if (d < DEPTH_DEEP) {
    // off the drift: the fine line round its sunlit side, so the edge
    // reads even where white meets white...
    if (deepIn(x + 1, y + 1) || deepIn(x + 1, y) || deepIn(x, y + 1)) return DEEP_T0 + 7;
    // ...else in its shade? A taller drift throws a longer one
    for (let k = 1; k <= DEEP_SHADE_PX; k++) {
      const e = deepPx(x - k, y - k);
      if (e >= DEPTH_DEEP && (e - DEPTH_DEEP) * 2.5 * DEEP_SHADE_PX + 1 >= k) return DEEP_T0 + 6;
    }
    return t;
  }
  if (!deepIn(x - 1, y - 1) || !deepIn(x, y - 1) && !deepIn(x - 1, y)) return DEEP_T0 + 3; // the crest
  if (!deepIn(x + 1, y + 1) || !deepIn(x + 1, y) && !deepIn(x, y + 1)) return DEEP_T0 + 4; // the lip
  if (!deepIn(x + 2, y + 2)) return DEEP_T0 + 5;
  // the top: lit by its slope toward the sun, barely dithered - smoother than the snow round it
  const s = (deepPx(x + 2, y + 2) - deepPx(x - 2, y - 2)) * 9 + BAYER4[(y & 3) * 4 + (x & 3)] * 0.35;
  // wind ripples: faint lines across the drift, on the lee tone
  const u = x * driftWind.dx + y * driftWind.dy, v = -x * driftWind.dy + y * driftWind.dx;
  const r = u / DEEP_RIPPLE + vnoise(v / 11, u / 23) * 1.6;
  if (d > DEPTH_DEEP + 0.08 && r - Math.floor(r) < 0.13) return DEEP_T0;
  return s > 0.5 ? DEEP_T0 + 2 : s < -0.5 ? DEEP_T0 : DEEP_T0 + 1;
}

// ---- the reeds -----------------------------------------------------------------
// Every patch of brush (a deep drift: brushOf, js/sim/depth.js) is a stand of
// dead reeds poking out of the drift, frost on their tips: what says "hide
// here" at a glance. Each reed is a small sprite y-sorted with the bodies
// (gatherDraws, js/draw/passes.js), so a body standing among them is half
// behind the ones in front of it. Round the viewed hero they thin to
// REED_SEE, so your own body in the brush is never lost in it. Placed on a
// staggered REED_STEP grid jittered off the position hash, wherever the snow
// is deep: pure position, so every screen stands the same reeds.
const REED_PAL = { root: '#8d8270', blade: '#c9bc9c', lit: '#e4dccb', tip: '#ffffff', foot: '#c6d4e8' };
const REED_STEP = 6;   // px between reeds on the grid
const REED_JIT = 4;    // px either way a reed wanders off its grid point
const REED_IN = 0.03;  // depth past DEPTH_DEEP a reed's foot needs: none on the rim's own line
const REED_FADE = 16;  // px from the viewed hero's feet the reeds thin...
const REED_SEE = 0.3;  // ...to this alpha
const REED_VARS = 8, REED_W = 11, REED_H = 12; // the atlas: variants, and each cell's size
let reedCv = null;
// the atlas: REED_VARS clumps of 3 to 5 blades fanning up from one root,
// dark at the root, lit on the sun's (left) side, a white frost tip each
function reedAtlas() {
  if (reedCv) return reedCv;
  reedCv = document.createElement('canvas'); reedCv.width = REED_W * REED_VARS; reedCv.height = REED_H;
  const g = reedCv.getContext('2d');
  for (let v = 0; v < REED_VARS; v++) {
    const h = (v + 0.5) / REED_VARS, n = 3 + (v % 3), tall = REED_H - 4 + ((v * 5) % 4);
    const x0 = v * REED_W + (REED_W >> 1), y0 = REED_H - 2;
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    px(x0 - 1, y0 + 1, REED_PAL.foot); px(x0, y0 + 1, REED_PAL.foot); px(x0 + 1, y0 + 1, REED_PAL.foot);
    for (let k = 0; k < n; k++) {
      const lean = (k - (n - 1) / 2) * 0.55 + (h - 0.5) * 0.6, len = tall - Math.abs(k - (n - 1) / 2) - (k & 1);
      for (let j = 0; j < len; j++) {
        const c = j === len - 1 ? REED_PAL.tip : j < 2 ? REED_PAL.root : k === 0 ? REED_PAL.lit : REED_PAL.blade;
        px(x0 + Math.round(lean * j * 0.6), y0 - j, c);
      }
    }
  }
  return reedCv;
}
// a deep drift's reeds, laid on its first draw and kept on it
function reedsOf(D) {
  if (D.reeds) return D.reeds;
  const out = D.reeds = [];
  const r = (D.len + 1) * TILE, X = D.x * TILE, Y = D.y * TILE;
  const y0 = Math.floor((Y - r) / REED_STEP), y1 = Math.ceil((Y + r) / REED_STEP);
  const x0 = Math.floor((X - r) / REED_STEP), x1 = Math.ceil((X + r) / REED_STEP);
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const gx = i * REED_STEP + (j & 1 ? REED_STEP / 2 : 0), gy = j * REED_STEP;
    const x = Math.round(gx + (hash2(gx, gy) - 0.5) * REED_JIT), y = Math.round(gy + (hash2(gy + 9, gx + 3) - 0.5) * REED_JIT);
    if (driftDepth(D, x / TILE, y / TILE) < DEPTH_DEEP + REED_IN) continue;
    out.push({ x, y, v: (hash2(x * 3, y * 7) * REED_VARS) | 0 });
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}
// the reeds over the view, into the frame's y-sorted draws (gatherDraws)
function reedDraws(draws, ox, oy) {
  for (const D of drifts) {
    const r = (D.len + 1) * TILE, X = D.x * TILE, Y = D.y * TILE;
    if (X + r < ox || Y + r < oy - REED_H || X - r > ox + WV_W || Y - r > oy + WV_H + REED_H) continue;
    for (const q of reedsOf(D)) {
      if (q.x < ox - REED_W || q.x > ox + WV_W + REED_W || q.y < oy || q.y > oy + WV_H + REED_H) continue;
      if (ground[idx(q.x >> 4, q.y >> 4)] !== 0) continue; // paved or holed since: no snow, no reeds
      draws.push({ y: q.y, reed: q });
    }
  }
}
// one reed, thinned round the viewed hero (null while dead or airborne)
function drawReed(q, ex, ey, hero) {
  const near = hero && Math.hypot(q.x - hero.x, q.y - hero.y - 4) < REED_FADE;
  if (near) ctx.globalAlpha = REED_SEE;
  ctx.drawImage(reedAtlas(), q.v * REED_W, 0, REED_W, REED_H, Math.round(q.x - ex) - (REED_W >> 1), Math.round(q.y - ey) - REED_H + 2, REED_W, REED_H);
  if (near) ctx.globalAlpha = 1;
}
