'use strict';
// The viewed hero seen through the canopies standing over it.
// ------------------------------------------------------------ canopy window
// A pine's canopy hangs over the tile above its trunk, so a hero walking
// behind a treeline goes under the leaves. Whatever of the hero's model a
// canopy actually covers - pixel for pixel, the frame as drawn against the
// tree's - opens a window in that canopy: the model's silhouette cut out of
// the leaves with a two-pixel falloff round it (CANOPY_CUT), so the body
// reads crisp and the forest round it stays whole. A tree that is merely
// close changes nothing: a pine beside the hero or in front of it covers none
// of it and draws untouched. The window opens with the share of the model
// under the canopy (full at CANOPY_FULL), so it eases in and out with every
// step, and like the rest of the frame it is a pure function of where things
// stand - nothing is stored per tree.
//
// How: render() names the hero (canopyFrame), drawPlayer draws that hero's
// model - the body in any pose, what the hands hold, what an ability left on
// it, the snow over a buried body; never its shade or the rings at its feet -
// through heroLayerOpen/heroLayerClose into heroCv as well as onto the world,
// and the model's coverage mask and the cut are read off that layer once a
// frame, on first need. Every canopy drawn AFTER the hero in the y-sort (one
// drawn before it stands behind it by construction) asks canopyOver how far
// to open, and an open one composes on winCv with the cut taken out
// (drawWindowed).
const CANOPY_FULL = 0.25; // share of the hero's model under one canopy at which its window is fully open
const CANOPY_CUT = [0.95, 0.7, 0.4]; // how much of the canopy a full window takes: over the model, 1 px out, 2 px out
const HERO_LW = 96, HERO_LH = 96, HERO_FOOT = 72; // the hero layer, the feet at (HERO_LW / 2, HERO_FOOT)

const heroCv = document.createElement('canvas');
heroCv.width = HERO_LW; heroCv.height = HERO_LH;
const hctx = heroCv.getContext('2d', { willReadFrequently: true }); // read back for the mask, one small layer a frame
hctx.imageSmoothingEnabled = false;
const holeCv = document.createElement('canvas');
holeCv.width = HERO_LW; holeCv.height = HERO_LH;
const holeCtx = holeCv.getContext('2d');
const winCv = document.createElement('canvas');
winCv.width = 64; winCv.height = 64; // a pine (27x37) and its 1 px work-target rim
const winCtx = winCv.getContext('2d');
winCtx.imageSmoothingEnabled = false;

let canopyHero = null; // whose model opens windows this frame: the viewed hero standing on the ground, or null
let heroAt = null;     // where heroCv sits in the world buffer, once that hero has drawn this frame
let heroMask = null;   // { a: alpha > 0 per layer px, n: how many } off heroCv, on first need
let holeOn = false;    // holeCv holds this frame's cut

function canopyFrame(p) { canopyHero = p; heroAt = null; heroMask = null; holeOn = false; }

// drawPlayer's model pass, (px, py) its 16x16 cell's top-left: from here to
// heroLayerClose the global ctx is the hero layer, lined up with the world
// buffer, so the layer holds exactly what the world shows
function heroLayerOpen(p, px, py) {
  if (p !== canopyHero || ctx !== wctx) return false;
  const T = wctx.getTransform();
  const lx = px + 8 - (HERO_LW >> 1), ly = py + 16 - HERO_FOOT;
  heroAt = { x: lx + T.e, y: ly + T.f };
  hctx.setTransform(1, 0, 0, 1, 0, 0);
  hctx.clearRect(0, 0, HERO_LW, HERO_LH);
  hctx.save();
  hctx.setTransform(1, 0, 0, 1, -lx, -ly);
  ctx = hctx;
  return true;
}
function heroLayerClose(open) {
  if (!open) return;
  hctx.restore();
  ctx = wctx;
  wctx.save();
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  wctx.drawImage(heroCv, heroAt.x, heroAt.y);
  wctx.restore();
}

function heroMaskNow() {
  if (heroMask) return heroMask;
  const d = hctx.getImageData(0, 0, HERO_LW, HERO_LH).data, a = new Uint8Array(HERO_LW * HERO_LH);
  let n = 0;
  for (let i = 0; i < a.length; i++) if (d[i * 4 + 3]) { a[i] = 1; n++; }
  return (heroMask = { a, n });
}

// which pixels of a sprite (or one atlas cell) are ink, cached per source
const inkMasks = new WeakMap(); // canvas -> Map('sx,sy' -> Uint8Array)
const inkCv = document.createElement('canvas');
inkCv.width = 64; inkCv.height = 64;
const inkCtx = inkCv.getContext('2d', { willReadFrequently: true });
function inkMask(src, sx, sy, w, h) {
  let m = inkMasks.get(src);
  if (!m) inkMasks.set(src, m = new Map());
  const key = sx + ',' + sy;
  let a = m.get(key);
  if (!a) {
    inkCtx.clearRect(0, 0, 64, 64);
    inkCtx.drawImage(src, sx, sy, w, h, 0, 0, w, h);
    const d = inkCtx.getImageData(0, 0, w, h).data;
    a = new Uint8Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] ? 1 : 0;
    m.set(key, a);
  }
  return a;
}

// how far a canopy drawn now, (sx, sy, w, h) of src at (x, y) in the world
// buffer, opens its window: 0 for one the hero stands in front of (the hero
// has not drawn yet) or that covers none of the model, 1 from CANOPY_FULL up
function canopyOver(src, sx, sy, w, h, x, y) {
  if (!heroAt) return 0;
  const x0 = Math.max(0, x - heroAt.x), x1 = Math.min(HERO_LW, x + w - heroAt.x);
  const y0 = Math.max(0, y - heroAt.y), y1 = Math.min(HERO_LH, y + h - heroAt.y);
  if (x0 >= x1 || y0 >= y1) return 0;
  const M = heroMaskNow();
  if (!M.n) return 0;
  const t = inkMask(src, sx, sy, w, h);
  let hit = 0;
  for (let ly = y0; ly < y1; ly++) for (let lx = x0; lx < x1; lx++) {
    if (M.a[ly * HERO_LW + lx] && t[(ly + heroAt.y - y) * w + lx + heroAt.x - x]) hit++;
  }
  return Math.min(1, hit / M.n / CANOPY_FULL);
}

// the cut: each layer px takes CANOPY_CUT by its distance to the model
function holeNow() {
  if (holeOn) return;
  holeOn = true;
  const M = heroMaskNow(), W = HERO_LW, H = HERO_LH;
  const ring = new Uint8Array(W * H).fill(3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!M.a[y * W + x]) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const d2 = dx * dx + dy * dy, r = d2 === 0 ? 0 : d2 <= 2 ? 1 : d2 <= 5 ? 2 : 3;
      const qx = x + dx, qy = y + dy;
      if (r < 3 && qx >= 0 && qy >= 0 && qx < W && qy < H && r < ring[qy * W + qx]) ring[qy * W + qx] = r;
    }
  }
  const img = holeCtx.createImageData(W, H), d = img.data;
  for (let i = 0; i < ring.length; i++) if (ring[i] < 3) d[i * 4 + 3] = Math.round(CANOPY_CUT[ring[i]] * 255);
  holeCtx.putImageData(img, 0, 0);
}

// draw(), a canopy's whole look - the gold work-target rim, the frame, its hit
// flash - spanning (x, y, w, h) in the world buffer, with its window cut out
// as far as `open` (canopyOver) says
function drawWindowed(open, x, y, w, h, draw) {
  holeNow();
  const P = 1; // the rim's px either side
  winCtx.setTransform(1, 0, 0, 1, 0, 0);
  winCtx.clearRect(0, 0, w + 2 * P, h + 2 * P);
  winCtx.setTransform(1, 0, 0, 1, P - x, P - y);
  const was = ctx;
  ctx = winCtx;
  draw();
  ctx = was;
  winCtx.setTransform(1, 0, 0, 1, 0, 0);
  winCtx.globalCompositeOperation = 'destination-out';
  winCtx.globalAlpha = open;
  winCtx.drawImage(holeCv, heroAt.x - x + P, heroAt.y - y + P);
  winCtx.globalAlpha = 1;
  winCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(winCv, 0, 0, w + 2 * P, h + 2 * P, x - P, y - P, w + 2 * P, h + 2 * P);
}
