'use strict';
// The pointer's pixels: the look cursorInfo() (render.js) resolves each frame,
// worn by the SYSTEM cursor. The look is baked once into a small image at the
// game's own pixel size and handed to the OS as a CSS cursor, so the pointer
// is the desktop's own: it moves the instant the mouse does, at the desktop's
// speed, to the device pixel. A cursor painted into the canvas instead trails
// the hand by the frames between an event and the screen, and snaps to whole
// game px, and both read as a slow, heavy mouse (Noah, 11-16).

// sprite hotspots (the pixel that sits under the true mouse position)
const CUR_HOT = { arrow: [0, 0], hand: [4, 0], grab: [5, 4] };
// reticle looks: colour, tick gap from centre, corner dots
const RETICLE = {
  idle: { col: '#f4f7ff', gap: 3 },
  lock: { col: '#ffd95c', gap: 3, diag: true },
  hunt: { col: '#f2cc6a', gap: 4, diag: true },
  ice:  { col: '#a8e0f8', gap: 3, diag: true },
  bow:  { col: '#ffd95c', gap: 6, diag: true },
  amove: { col: '#ff6a5c', gap: 4, diag: true }, // the CLICK scheme's armed attack-move
};
const NOCK_STEPS = 6; // game px the renock marks fall in from, one look per px
let lastCssCursor = null;

// What the pointer looks like this frame: every value that changes a pixel,
// and a key made of exactly those, so one look is baked once.
function cursorLook(info, now) {
  const base = info.dim ? 0.5 : 1;
  if (info.kind !== 'reticle') return { key: info.kind + base, kind: info.kind, base };
  const R = RETICLE[info.mode];
  let gap = R.gap, col = R.col;
  if (info.mode === 'bow') {
    // the ring closes as the draw fills and goes pale gold at full, like the meter
    gap = Math.round(6 - 3 * info.frac);
    if (info.frac >= 1) col = DRAW_FULL_COL;
  } else if (info.mode === 'hunt') {
    gap = 4 + (((now * 3) | 0) % 2); // slow breathing
  }
  // the bow's renock: how many px out the four corner marks still are, or -1
  // with the bow ready (there is nothing left of them at rest)
  const nock = info.nock === undefined ? 1 : info.nock;
  const fall = nock < 1 ? Math.round((1 - nock) * NOCK_STEPS) : -1;
  const diag = !!R.diag;
  const core = ['r', gap, col, diag ? 1 : 0, base].join();
  return { key: core + ',' + fall, ringKey: core + ',-1', kind: 'reticle', base, gap, col, diag, fall };
}

// Paint a look with its hotspot on game px (mx, my) through `ctx`. `part` is
// 'all', or 'marks' for the renock marks alone (see applyCursorStyle).
function drawLook(look, mx, my, part) {
  const base = look.base;
  if (look.kind !== 'reticle') {
    const [hx, hy] = CUR_HOT[look.kind];
    ctx.globalAlpha = base * 0.45;
    ctx.drawImage(SPRITES.cursorShadow[look.kind], mx - hx + 1, my - hy + 1);
    ctx.globalAlpha = base;
    ctx.drawImage(SPRITES.cursor[look.kind], mx - hx, my - hy);
    ctx.globalAlpha = 1;
    return;
  }
  const gap = look.gap;
  if (part !== 'marks') {
    const L = 3; // tick length
    const rects = [
      [mx - gap - L + 1, my, L, 1], [mx + gap, my, L, 1],
      [mx, my - gap - L + 1, 1, L], [mx, my + gap, 1, L],
    ];
    if (look.diag) { // corner dots one step outside the ring so they never fuse with the ticks
      const g = gap + 1;
      rects.push([mx - g, my - g, 1, 1], [mx + g, my - g, 1, 1], [mx - g, my + g, 1, 1], [mx + g, my + g, 1, 1]);
    }
    rects.push([mx, my, 1, 1]);
    drawOutlinedRects(rects, look.col, base);
  }
  // The bow's own state, on top of whatever the pointer is over. While the
  // renock runs, four corner marks fall inward from far out and land on the
  // ring at the moment the bow is ready, so a ready bow is still the clean
  // crosshair it has always been.
  if (look.fall >= 0) {
    const g = gap + 2 + look.fall;
    drawOutlinedRects([
      [mx - g, my - g, 2, 1], [mx - g, my - g, 1, 2],
      [mx + g - 1, my - g, 2, 1], [mx + g, my - g, 1, 2],
      [mx - g, my + g, 2, 1], [mx - g, my + g - 1, 1, 2],
      [mx + g - 1, my + g, 2, 1], [mx + g, my + g - 1, 1, 2],
    ], '#ffd95c', base * (0.35 + 0.55 * (1 - look.fall / NOCK_STEPS)));
  }
}

// ---- the system cursor ----
// Chromium refuses a custom cursor wider or taller than this many CSS px and
// shows the fallback instead (measured on Electron 33's Chromium)
const HW_CUR_MAX = 128;
// game px of room round the hotspot a look is baked into: the widest one (the
// bow's open ring with the renock marks at their farthest) reaches 16
const HW_PAD = 18;
const hwArt = document.createElement('canvas'); // the look at 1 px per game px, hotspot at (HW_PAD, HW_PAD)
hwArt.width = hwArt.height = HW_PAD * 2 + 1;
const hwArtCtx = hwArt.getContext('2d', { willReadFrequently: true });
const hwOut = document.createElement('canvas'); // ...cropped and blown up to device px
const hwOutCtx = hwOut.getContext('2d');
const hwCursors = new Map(); // CSS cursor value (or null: too big) by look key, for one pixel size
let hwSize = '';             // the device px per game px and the DPR hwCursors was baked for
let hwSupported = null;      // can this browser take an image-set cursor at all

// the nearest stock cursor to a look: the BROWSER setting, and the fallback
// inside every baked value
function stockCursor(kind) {
  return kind === 'reticle' ? 'crosshair' : kind === 'grab' ? 'grabbing' : kind === 'arrow' ? 'default' : 'pointer';
}

// The CSS cursor that wears this look, or null when it cannot be worn (too
// big for the OS cursor at this pixel size, or an old browser).
function hwCursor(look) {
  if (hwSupported === null) hwSupported = CSS.supports('cursor', 'image-set(url("a.png") 1x) 0 0, auto');
  if (!hwSupported) return null;
  const dpr = window.devicePixelRatio || 1;
  // device px per game px: devScale, or the director's fitted 9:16 preview
  const k = Math.max(1, Math.round(scale * dpr));
  const size = k + '@' + dpr;
  if (size !== hwSize) { hwCursors.clear(); hwSize = size; }
  if (!hwCursors.has(look.key)) hwCursors.set(look.key, bakeHwCursor(look, k, dpr));
  return hwCursors.get(look.key);
}

// the whole CSS px to name for a hotspot at image px `at`, and the image px of
// padding that puts the look's hotspot exactly where Chromium will then read it
function hwHot(at, dpr) {
  let c = Math.floor(at / dpr);
  while (Math.round(c * dpr) < at) c++;
  return [c, Math.round(c * dpr) - at];
}

function bakeHwCursor(look, k, dpr) {
  // paint the look at 1:1 through the one `ctx` every draw call writes to
  hwArtCtx.clearRect(0, 0, hwArt.width, hwArt.height);
  const was = ctx;
  ctx = hwArtCtx;
  try { drawLook(look, HW_PAD, HW_PAD, 'all'); } finally { ctx = was; }
  // crop to the painted pixels
  const n = hwArt.width, px = hwArtCtx.getImageData(0, 0, n, n).data;
  let x0 = n, y0 = n, x1 = -1, y1 = -1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!px[(y * n + x) * 4 + 3]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  // the hotspot in image px: an arrow's tip is its pixel's top-left corner,
  // as the OS's own; a reticle's centre dot is that pixel's middle
  const mid = look.kind === 'reticle' ? k >> 1 : 0;
  const hx = (HW_PAD - x0) * k + mid, hy = (HW_PAD - y0) * k + mid;
  // Chromium reads the hotspot as WHOLE CSS px and multiplies it by the
  // image's density, rounding (4 at 1.5x is image px 6), so on a fractional DPR
  // a hotspot can only land on some image px. Transparent px on the top and
  // left shift the look onto the nearest one that can be named.
  const [cx, padX] = hwHot(hx, dpr), [cy, padY] = hwHot(hy, dpr);
  if (Math.max(w * k + padX, h * k + padY) / dpr > HW_CUR_MAX) return null;
  hwOut.width = w * k + padX; hwOut.height = h * k + padY; // (resizing resets the context, smoothing too)
  hwOutCtx.imageSmoothingEnabled = false;
  hwOutCtx.drawImage(hwArt, x0, y0, w, h, padX, padY, w * k, h * k);
  return 'image-set(url("' + hwOut.toDataURL() + '") ' + dpr + 'x) ' + cx + ' ' + cy + ', ' + stockCursor(look.kind);
}

// Dress the pointer for this frame. Returns what render() must still paint
// in-canvas: null when the system cursor wears all of it.
//   - BROWSER (settings.pixelCursor off): the nearest stock cursor.
//   - a take being recorded (js/app/director.js): painted, so the footage holds it.
//   - a look too big for the OS cursor at this pixel size (a 4K screen at 100%
//     during a renock): the system cursor wears the ring and only the falling
//     marks are painted; failing that, all of it.
function applyCursorStyle(info, now) {
  let css = 'none', paint = null;
  if (!settings.pixelCursor) css = stockCursor(info.kind);
  else {
    const look = cursorLook(info, now);
    const hw = director.rec ? null : hwCursor(look);
    if (hw) css = hw;
    else {
      const ring = look.fall >= 0 && !director.rec ? hwCursor(Object.assign({}, look, { fall: -1, key: look.ringKey })) : null;
      if (ring) { css = ring; paint = { look, part: 'marks' }; } else paint = { look, part: 'all' };
    }
  }
  if (css !== lastCssCursor) { canvas.style.cursor = css; lastCssCursor = css; }
  return paint;
}
