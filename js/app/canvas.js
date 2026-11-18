'use strict';
// The canvas stack: screen + world buffers, pixel-exact world zoom,
// fitCanvas(), the pillarbox frost bars, and the panel layout anchors that
// relayout() (core.js) assigns on every resize.
// ------------------------------------------------------------ canvas
const canvas = document.getElementById('game');
// `ctx` is NOT a fixed binding: render() points it at the world buffer for
// the world layer and back at the screen for the UI layer (see the world
// buffer note below). Every draw call in the file writes through it, which is
// what lets one pass order span two different pixel spaces untouched.
const uictx = canvas.getContext('2d');
let ctx = uictx;
ctx.imageSmoothingEnabled = false;

// The world buffer. Everything up to and including lighting draws into this
// at 1:1 world pixels, and render() then blits the WV_W x WV_H corner of it
// over the whole canvas in one nearest-neighbour step. Two things fall out of
// that, and both are the point:
//   - the canvas never resizes when you zoom, so the HUD, the panels and the
//     cursor are the same size on screen at every zoom level;
//   - the world is composed at one scale and resampled ONCE as a single
//     image, so the pixel grid stays coherent across ground, sprites and
//     particles instead of each sprite rounding its own way.
// It is allocated at the most zoomed-OUT size once per canvas size, never
// per frame - resizing a canvas reallocates it and resets its context state.
const worldCv = document.createElement('canvas');
const wctx = worldCv.getContext('2d');
// THE AIR LAYER: what flies above the valley (a bird in flight and anyone
// falling from it), drawn at 1:1 like the world but off the EXACT camera and
// blitted with no sub-pixel shift (render()). The camera rides a bird, so a
// bird on the ground's grid wandered half a world px against the sliding
// screen every frame - that is the jitter this layer exists to remove.
// airMask holds the layer's own shape while the day's grade is laid over it
// (lightAir, js/draw/light.js). Sized with worldCv.
const airCv = document.createElement('canvas');
const actx = airCv.getContext('2d');
const airMask = document.createElement('canvas');
const amctx = airMask.getContext('2d');
// THE GRADE'S COPY: the midday crisp multiplies a frame by itself (todGrade,
// js/draw/light.js), and a canvas drawn onto ITSELF makes the browser copy
// its whole backing store first and again on the next stroke - 4 ms a frame
// on a CPU-drawn canvas. The frame is copied here instead, only its used
// corner. Sized with worldCv.
const gradeCv = document.createElement('canvas');
const grctx = gradeCv.getContext('2d');
let airOn = false; // the air layer holds something this frame (the replay banks it too)
const airRiders = []; // this frame's players on a zipline's handle or in the air on a hero's dash over the scenery (CLIVUS's vault), held out of the y-sorted pass for the air layer (render())
const airBox = { x0: 0, y0: 0, x1: 0, y1: 0 }; // the air layer's used box this frame, in its own px: all that is graded and blitted
const AIR_PAD = 56; // px round a body in the air the box keeps: the name tag's half-width and the frame
const AIR_TOP = 72; // px above a rider's feet the box reaches: the body, the frame and the name over it
function airGrow(x0, y0, x1, y1) {
  if (x0 < airBox.x0) airBox.x0 = x0; if (y0 < airBox.y0) airBox.y0 = y0;
  if (x1 > airBox.x1) airBox.x1 = x1; if (y1 > airBox.y1) airBox.y1 = y1;
}

// full-window canvas behind the game: the pillarbox bars' frost frame
const barsCv = document.getElementById('bars');
const bctx = barsCv.getContext('2d');

// One camera for every player (the SC2/LoL model): the CANVAS always shows
// ~TARGET_ROWS rows — monitor resolution buys sharpness, never zoom.
// Heights that don't divide cleanly "breathe" a few percent rather than
// letterbox or blur (the Terraria/Stardew trade), and width is capped at
// 16:9 so ultrawides get slim pillarbox bars instead of extra vision.
// 360 rows is 640x360 at 16:9: 720p at 2x, 1080p at 3x, 1440p at exactly 4x
// and 4K at 6x - every common monitor lands on a whole pixel with no breathe.
// index.html's boot mark works the same scale out before any script runs: a
// change to this number or to fitCanvas's pick of `dev` changes it there too.
const TARGET_ROWS = 360;

// ---- world zoom ----
// Zoom scales the WORLD LAYER ONLY. The canvas keeps its VIEW_W x VIEW_H
// layout at every zoom, so the HUD, the baked panels and the cursor are the
// same size on screen whatever the camera is doing: zooming in moves the
// camera closer, it does not magnify the interface.
//
// THE RESTING ZOOM IS ALWAYS PIXEL-EXACT, and that is an arithmetic fact, not
// a preference. A world pixel ends up covering `zoom * devScale` DEVICE
// pixels; unless that is a whole number some world pixels get an extra row of
// device pixels and their neighbours do not, which is what "stretched" looks
// like on a 16x16 sprite. So the zoom the player actually plays at is stored
// as that whole number - kWant, device px per world px - and the float scale
// is derived from it. The canvas backing store is therefore sized in DEVICE
// pixels (VIEW * devScale) and the UI draws through a devScale transform:
// that is what buys the fine steps, because k only has to be whole in device
// pixels, not in canvas pixels. At devScale 3 (a 1080p fullscreen) the rungs
// are thirds (0.67, 1, 1.33, 1.67 ...), at 4 (1440p) quarters; a smaller
// devScale has fewer, coarser rungs, which is the honest answer on a display
// that has fewer pixels to spend.
//
// zoomCur eases toward kWant/devScale, so a notch is a glide rather than a
// jump. In motion the blit is briefly fractional (nobody reads pixel edges
// mid-zoom); it lands exact. ZOOM_EASE is deliberately steep - with steps
// this fine a slow ease reads as lag, and a spun wheel must keep up.
//
// The range is authored in ROWS OF WORLD on screen, not in scale: what the
// camera shows at either end is the design, and the scale that shows it
// follows the frame (TARGET_ROWS), so a taller frame does not quietly hand
// out more vision at max-out or lose the face at max-in.
const ZOOM_OUT_ROWS = 540;  // the whole clearing and then some
const ZOOM_IN_ROWS = 75;    // close enough to read a face
const ZOOM_MAX = TARGET_ROWS / ZOOM_IN_ROWS;  // 4.8 at 360 rows
const ZOOM_EASE = 16;     // per second, frame-rate independent
// The view a match opens at: every world pixel two canvas pixels, so the
// 16px art reads twice its old size and the screen holds 180 rows of world.
// Whole, so it is a rung on every display; the wheel still zooms out from it.
const ZOOM_REST = 2;
// ...and the shots that frame the valley instead of you - the
// roost tour, the driven-off ceremony - hold the view they were composed at
// (applyZoom, js/sim/sim.js): 360 rows of world, half as close as play.
const ZOOM_SHOW = 1;
// ...and the title frames its ten heroes at the match's own view, so the landing page
// shows them the size they are played at (js/ui/titlescene.js)
const ZOOM_TITLE = ZOOM_REST;
let kWant = 0;            // device px per world px - a WHOLE number, the wheel steps it by 1 (0 until fitCanvas first rungs ZOOM_REST)
let zoomCur = ZOOM_TITLE;  // applied scale, eased toward the wanted zoom every update (applyZoom, js/sim/sim.js); the game boots on the title
let WV_W = 640, WV_H = 360; // the world view in world px
let wOX = 0, wOY = 0;       // this frame's world buffer corner in world px: the camera floored, the shake folded in (render())

// the rungs kWant may sit on. The far end is the nearest rung that shows no
// more than ZOOM_OUT_ROWS of the frame's real rows: CEIL, never round, or a
// frame between the 360-row steps (720p, 1200p, 1800p) is handed a rung past
// the authored range - more vision than a 1080p rival in a ranked match. The
// near end is kept a rung past it so the wheel always has somewhere to go.
let frameRows = 360; // device rows the frame shows (fitCanvas)
function kMin() { return Math.max(1, Math.ceil(frameRows / ZOOM_OUT_ROWS - 1e-9)); }
function kMax() { return Math.max(kMin() + 1, Math.round(ZOOM_MAX * worldDev)); }
// every way to set kWant lands it on the ladder through this
function rungK(k) { return Math.max(kMin(), Math.min(kMax(), k)); }
// a zoom authored as canvas px per world px at the default UI SIZE (every
// ZOOM_* above, the ride's DROP_*), in this canvas's px: a smaller UI makes
// the canvas more px across, and the world must cover the same device px
function zu(z) { return z * worldDev / devScale; }
function zoomWantOf() { return kWant / devScale; }
// the widest scale anything may ask for, in canvas px per world px: the far
// rung, or the shows' fixed framing (the title's is nearer) on a frame so narrow its
// worldDev sits under that rung. The world buffer is sized off it, and the
// view never asks past it, so the buffer always covers the canvas.
function zoomFloor() { return Math.min(kMin() / devScale, zu(ZOOM_SHOW)); }

// WV from the current scale, in world px. CEIL, never round: WV * k must
// COVER the canvas or a sliver of stale pixels survives down the right edge.
// Width and height ceil independently, so the effective scale can differ
// between the axes by a fraction of a device pixel while the ease is running;
// at rest both land on exactly k device px per world px. One world px more
// on each axis is the SPARE the sub-pixel camera shifts into: the blit lands
// up to a world px up-left of the corner (render()), and the frame must still
// cover the canvas after it.
function sizeWorldView() {
  zoomCur = Math.max(zoomCur, zoomFloor()); // a resize or a loaded save can leave it past the new floor
  const k = zoomCur * devScale;
  WV_W = Math.max(16, Math.ceil(VIEW_W * devScale / k) + 1);
  WV_H = Math.max(16, Math.ceil(VIEW_H * devScale / k) + 1);
}
// world point -> canvas point, for the few UI-layer things anchored to a tile
function wToSX(wx) { return (wx - camX) * zoomCur; }
function wToSY(wy) { return (wy - camY) * zoomCur; }
// ...and back: the ONLY way a pointer position becomes a world position.
// Every aim, hover and right-click target goes through these two, so the
// zoom can never be applied in one place and forgotten in another.
function mouseWX() { return mouse.x / zoomCur + camX; }
function mouseWY() { return mouse.y / zoomCur + camY; }

let scale = 2;    // CSS px per game px
let devScale = 2; // DEVICE px per game px (the integer fitCanvas picks): the UI's scale
// DEVICE px per game px at the default UI SIZE: the one TARGET_ROWS asks for.
// The world's zoom ladder is measured against it, never against devScale, so
// the VIDEO page's UI SIZE (settings.uiSize) moves the interface alone and
// every screen still sees the same rows of world
let worldDev = 2;
// UI SIZE's steps: the UI's scale as a share of worldDev, rounded onto a whole
// device px and at least one px off the default, so every display gets a real
// step each way (1080p: 2x, 3x, 4x; 1440p: 3x, 4x, 5x; 4K: 4x, 6x, 8x)
const UI_SIZES = { '-1': 2 / 3, '0': 1, '1': 4 / 3 };
function uiDevFor(wd, devW, devH) {
  const f = UI_SIZES[settings.uiSize] || 1;
  let d = f < 1 ? Math.min(wd - 1, Math.round(wd * f)) : f > 1 ? Math.max(wd + 1, Math.round(wd * f)) : wd;
  d = Math.max(1, d);
  // the same floor as the world's: never a view smaller than the UI panels' footprint
  while (d > 1 && (devW / d < 320 || devH / d < 240)) d--;
  return d;
}
function fitCanvas() {
  // pick an integer scale in DEVICE pixels, not CSS pixels: on fractional
  // display scaling (125%/150% Windows) a CSS-integer scale lands game pixels
  // on fractional device pixels, which smears and shimmers during scrolling.
  const dpr = window.devicePixelRatio || 1;
  const winW = Math.max(1, Math.round(window.innerWidth * dpr));
  const winH = Math.max(1, Math.round(window.innerHeight * dpr));
  // director mode's 9:16 frame (js/app/director.js) lays out as if the window were
  // a Short, DIR_TALL_W x DIR_TALL_H device px, whatever the window really is;
  // the canvas is then shown fitted inside it (below)
  const tall = dirTall();
  const devW = tall ? DIR_TALL_W : winW, devH = tall ? DIR_TALL_H : winH;
  let wd = Math.max(1, Math.round(devH / TARGET_ROWS));
  // never shrink the view below the UI panels' footprint
  while (wd > 1 && (devW / wd < 320 || devH / wd < 240)) wd--;
  // the UI's own scale off it (UI SIZE); a Short's frame is always the default
  const dev = tall ? wd : uiDevFor(wd, devW, devH);
  scale = dev / dpr; // CSS px per game px; mouse mapping divides by this
  const zWas = kWant ? kWant / worldDev : ZOOM_REST; // the wheel's zoom before this fit, as a default-UI scale
  devScale = dev;    // the replay window captures at this resolution
  worldDev = wd;
  frameRows = devH;
  // cover the window exactly: ceil leaves at most one game px of overflow,
  // which the body's flex centering splits and overflow:hidden clips
  VIEW_H = Math.ceil(devH / dev);
  FULL_W = Math.ceil(devW / dev);
  VIEW_W = Math.min(FULL_W, Math.ceil(VIEW_H * 16 / 9));
  // The backing store is in DEVICE pixels, not game pixels: the world blit
  // needs that resolution to land a whole number of device pixels on every
  // world pixel at the in-between zoom rungs (see the world zoom block). The
  // UI still draws in VIEW space - render() puts a devScale transform under
  // it - so no layout code changes, and text and 1px rects scale by a whole
  // number too and stay crisp.
  canvas.width = VIEW_W * dev; canvas.height = VIEW_H * dev;
  uictx.imageSmoothingEnabled = false; // resizing the canvas resets ctx state
  // worldDev may have just changed (resize, fullscreen, a different monitor):
  // re-rung the wheel's zoom onto the new ladder at the nearest scale to what
  // it was - off kWant, never zoomCur, which a ride or a show is holding
  // elsewhere. A UI SIZE change leaves worldDev, so kWant stays put
  kWant = rungK(Math.round(zWas * wd));
  // world buffer at the most zoomed-out size we can ever ask for, so it is
  // never reallocated mid-play; each frame uses the WV_W x WV_H corner.
  // imageSmoothing off: the scale-up must be nearest-neighbour or the pixel
  // art turns to soup.
  // Sized by sizeWorldView's own sum at zoomFloor(), so the two cannot drift apart.
  const wMax = Math.ceil(VIEW_W / zoomFloor()) + 1, hMax = Math.ceil(VIEW_H / zoomFloor()) + 1; // + the sub-pixel camera's spare (sizeWorldView)
  worldCv.width = wMax; worldCv.height = hMax;
  wctx.imageSmoothingEnabled = false;
  airCv.width = airMask.width = gradeCv.width = wMax; airCv.height = airMask.height = gradeCv.height = hMax;
  actx.imageSmoothingEnabled = false;
  sizeWorldView();
  // The 9:16 canvas keeps its Short-sized backing store and is SHOWN fitted to
  // the window: a whole multiple when it fits, else shrunk smoothly - a
  // preview, since the recorder (js/app/director.js) takes the backing store.
  // `scale` follows what is shown, so the pointer maps through it as ever.
  canvas.style.imageRendering = '';
  if (tall) {
    let f = Math.min(winW / devW, winH / devH);
    if (f >= 1) f = Math.floor(f); else canvas.style.imageRendering = 'auto';
    scale = dev * f / dpr;
    FULL_W = Math.max(VIEW_W, Math.ceil(window.innerWidth / scale));
  }
  canvas.style.width = (VIEW_W * scale) + 'px';
  canvas.style.height = (VIEW_H * scale) + 'px';
  // bars canvas spans the whole window at the same pixel scale; painted by
  // renderBars() via relayout() (it needs hash2, so never before boot)
  barsCv.width = FULL_W; barsCv.height = tall ? Math.max(VIEW_H, Math.ceil(window.innerHeight / scale)) : VIEW_H;
  barsCv.style.width = (FULL_W * scale) + 'px';
  barsCv.style.height = (barsCv.height * scale) + 'px';
}
pageListen(window, 'resize', () => { fitCanvas(); relayout(); });
pageListen(document, 'fullscreenchange', () => { fitCanvas(); relayout(); });
fitCanvas();

// FULLSCREEN, the VIDEO page's DISPLAY row. Under the wrapper it is the
// window's own (desktop/main.js keeps it between launches, and F11 or
// Alt+Enter flips it there too); in a browser it is the Fullscreen API, which
// only answers a click - the row's is one. Either way the window's resize
// refits the canvas, as any resize does.
let winFull = null; // the wrapper's window as it last said (null: no wrapper, or no answer yet)
if (window.steamBridge && steamBridge.fullscreen) {
  steamBridge.isFullscreen().then((on) => { winFull = !!on; }).catch(() => {});
  steamBridge.onFullscreen((on) => { winFull = !!on; });
}
function fullscreenOn() { return winFull != null ? winFull : !!document.fullscreenElement; }
function setFullscreen(on) {
  if (on === fullscreenOn()) return;
  if (window.steamBridge && steamBridge.fullscreen) { winFull = on; steamBridge.fullscreen(on).catch(() => {}); return; }
  try {
    const p = on ? document.documentElement.requestFullscreen() : document.exitFullscreen();
    if (p && p.catch) p.catch(() => {}); // refused (no click behind it): the row keeps showing the truth
  } catch (e) { }
}

// Frost-panel art for the pillarbox bars (wider-than-16:9 screens), in the
// game's palette instead of dead black. Purely decorative and deliberately
// darker than the world so the eye stays on the game; the game canvas sits
// on top and covers everything between the bars. Static — baked once per
// canvas size by relayout(), never per frame.
function renderBars() {
  const g = bctx, W = barsCv.width, H = barsCv.height;
  const barW = (W - VIEW_W) / 2;
  if (barW < 2) { g.clearRect(0, 0, W, H); return; }
  const inBar = (x) => x < barW - 1 || x > W - barW - 2;
  // deep night slab
  g.fillStyle = '#050814'; g.fillRect(0, 0, W, H);
  // frost mottling
  for (let y = 0; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      if (!inBar(x)) continue;
      const h = hash2(x * 5 + 7, y * 13 + 3);
      if (h > 0.86) g.fillStyle = '#0b1226';
      else if (h < 0.10) g.fillStyle = '#03050d';
      else continue;
      g.fillRect(x, y, 3, 3);
    }
  }
  // sparse ice crystals, dimmer toward the outer edge
  for (let y = 12; y < H - 20; y += 14) {
    for (let x = 6; x < W - 6; x += 14) {
      if (!inBar(x) || !inBar(x + 5)) continue;
      const h = hash2(x * 3 + 11, y * 7 + 29);
      if (h < 0.86) continue;
      const cx = x + ((hash2(x + 1, y + 1) * 7) | 0) - 3;
      const cy = y + ((hash2(x + 2, y + 5) * 9) | 0) - 4;
      g.fillStyle = h > 0.95 ? '#35426e' : '#1c2646';
      g.fillRect(cx - 2, cy, 5, 1); g.fillRect(cx, cy - 2, 1, 5);
      if (h > 0.95) { g.fillStyle = '#5a7fb8'; g.fillRect(cx, cy, 1, 1); }
    }
  }
  // icicle fringe hanging from the top edge
  for (let x = 0; x < W; x += 4) {
    if (!inBar(x)) continue;
    const h = hash2(x * 9 + 5, 71);
    const len = 2 + ((h * 7) | 0);
    g.fillStyle = '#141c3c'; g.fillRect(x, 0, 2, len);
    g.fillStyle = '#232f52'; g.fillRect(x, 0, 1, len - 1);
    if (h > 0.75) { g.fillStyle = '#35426e'; g.fillRect(x, len - 1, 1, 1); }
  }
  // matching icicle fringe rising from the bottom edge (different hash row
  // so it isn't a literal mirror)
  for (let x = 0; x < W; x += 4) {
    if (!inBar(x)) continue;
    const h = hash2(x * 9 + 5, 113);
    const len = 2 + ((h * 7) | 0);
    g.fillStyle = '#141c3c'; g.fillRect(x, H - len, 2, len);
    g.fillStyle = '#232f52'; g.fillRect(x, H - len + 1, 1, len - 1);
    if (h > 0.75) { g.fillStyle = '#35426e'; g.fillRect(x, H - len, 1, 1); }
  }
  // icy bevel hugging the game view on both sides
  const xL = Math.floor(barW), xR = Math.ceil(W - barW);
  g.fillStyle = '#0a0e23'; g.fillRect(xL - 3, 0, 3, H); g.fillRect(xR, 0, 3, H);
  g.fillStyle = '#141c3c'; g.fillRect(xL - 2, 0, 1, H); g.fillRect(xR + 1, 0, 1, H);
  g.fillStyle = '#35426e'; g.fillRect(xL - 1, 0, 1, H); g.fillRect(xR, 0, 1, H);
}

// scratch canvas for white hit-flash sprites
const scratch = document.createElement('canvas');
scratch.width = 128; scratch.height = 128; // the biggest thing that flashes is a bear's 112x76 frame
const sctx = scratch.getContext('2d');

// the minimap disc: its centre and radius in view px (applyMinimapSize,
// core.js, sets the real ones)
let MM_R = 24;
let MM_CX = VIEW_W - 35;
let MM_CY = VIEW_H - 35;

// Panel layout anchors. These live here rather than in the map/settings
// sections because relayout() assigns them on every canvas resize —
// declaring them 2800 lines further down left relayout() reaching forward
// into a TDZ, safe only while nothing called it before boot finished. The
// offsets *within* each baked panel stay in their own sections.
// The map slab FITS THE VIEW: the chart takes every row the view gives it,
// up to CHART_MAX (what a monitor's 360 rows seat under the header; the
// match's WORLD tiles fold into it by priority, chartSize), while a window at fitCanvas()'s
// 240-row floor still seats the whole slab with a 200 chart.
// fitMapSlab() sizes it (relayout, core.js); the chart's buffers and the
// slab's bake follow the size (mapAlloc, panels.js).
const CHART_MAX = 232;  // px: the chart's most (and never past MAP_N, so it never outgrows a tile a pixel)
const MAP_SIDE = 10;    // the parchment either side of the chart
const MAP_HEAD = 26;    // rows over it: the header row and its margins
const MAP_FOOT = 8;     // rows under it
let MAP_W = 192;             // the chart's slot — the played part of the world scales into it
let MAP_T0 = 0, MAP_N = WORLD; // the square of tiles the chart shows: from MAP_T0, MAP_N a side (chartFit, minimap.js)
let PANEL_W = MAP_W + MAP_SIDE * 2, PANEL_H = MAP_HEAD + MAP_W + MAP_FOOT;
let PANEL_X = Math.round((VIEW_W - PANEL_W) / 2);   // relayout() recenters these
let PANEL_Y = Math.round((VIEW_H - PANEL_H) / 2);
let MAP_X = PANEL_X + MAP_SIDE, MAP_Y = PANEL_Y + MAP_HEAD;
function fitMapSlab() {
  MAP_W = Math.max(96, Math.min(CHART_MAX, MAP_N, VIEW_H - MAP_HEAD - MAP_FOOT - 6));
  PANEL_W = MAP_W + MAP_SIDE * 2; PANEL_H = MAP_HEAD + MAP_W + MAP_FOOT;
}

// 200 rows fits under the 240-row floor fitCanvas() keeps - the bake is
// once, so it never grows
const SET_W = 320, SET_H = 200;
let SET_X = Math.round((VIEW_W - SET_W) / 2);       // relayout() recenters these
let SET_Y = Math.round((VIEW_H - SET_H) / 2);
let SL_X = SET_X + 130;
const SL_W = 100;  // slider track
// The panel's rows have no fixed anchors any more: the ESC slab is tabbed and
// each page lays its rows out (and scrolls them) through settingsLayout()
// in panels.js, off SET_X/SET_Y/SL_X alone.
let SET_MUTE_X = SL_X - 14; // the speaker button: 9x9, hard against the master track

// offscreen terrain picture, 1px per world tile (updateMinimap): the bot
// log's and the arena's map, not the minimap's (the minimap is a chart)
const mmCv = document.createElement('canvas');
mmCv.width = WORLD; mmCv.height = WORLD;
const mmCtx = mmCv.getContext('2d');
const mmImg = mmCtx.createImageData(WORLD, WORLD);


// ------------------------------------------------------------ camera modes
// LOCKED or FREE, League's two cameras (settings.camFree; the camLock key
// flips it, as does the CAMERA row on the ESC menu's GAME page). LOCKED rides the
// body you are watching, as it always has. FREE stays where it is put: the
// pointer against an edge of the screen pans it (camEdge), the centre key
// cuts back to the body (a tap) or holds it there (held), and a press on the
// minimap carries it anywhere on the map (camDrag; under LOCKED it springs
// back on the release). While you are down the watched body is an ally or
// your own fall; a FREE camera rides it too until an edge pan takes it off
// (camLoose), and the centre key or a new ally puts it back on.
//
// The camera is this screen's alone: none of it is the sim's, so a client
// pans and drags exactly as a host does.
const CAM_EDGE = 3;      // game px from a screen edge (or past it, in a pillarbox bar) that pans a free camera
const CAM_PAN = 420;     // game px of screen a second the edge pans: the same speed on screen at any zoom
let camLoose = false;    // a free camera panned off the body it was riding while you are down
let camDrag = false;     // the left button went down on the minimap and is still held
// the camera answers to the pointer and its keys: in a match, yours or a respawn wait
function camLive() { return state.mode === 'play' || (state.mode === 'dead' && state.over === 'respawning' && !state.eagleCine); }
function camFreeOn() { return !!settings.camFree && camLive(); }
function camFlip() { settings.camFree = !settings.camFree; camLoose = false; saveSettings(); SFX.ui(settings.camFree); }
// -1, 0 or 1 a side: the pointer against an edge, or past it in the window's
// bar. Never under a panel the pointer is working (the ESC slab, the chart,
// a wheel) or with the window out of focus
function camEdge() {
  if (!camFreeOn() || camDrag || !mouse.inWin || state.settingsOpen || state.mapOpen || state.wheel || state.paused || !document.hasFocus()) return [0, 0];
  const x = mouse.rawX, y = mouse.rawY;
  return [x <= CAM_EDGE ? -1 : x >= VIEW_W - 1 - CAM_EDGE ? 1 : 0, y <= CAM_EDGE ? -1 : y >= VIEW_H - 1 - CAM_EDGE ? 1 : 0];
}
// One frame of the camera's mode, before the follow (update, js/sim/sim.js):
// true when the follow should run, false when the camera is held where it is
// (FREE, panned by the edge, or the minimap under the pointer)
function camStep(dt) {
  if (!camLive()) { camDrag = false; camLoose = false; return true; }
  if (camDrag) {
    const w = mmCamAt(mouse.x, mouse.y); // the minimap's point under the pointer, clamped onto it (js/ui/minimap.js)
    if (w) { camX = w.x - WV_W / 2; camY = w.y - WV_H / 2; }
    return false;
  }
  if (keyHeld('camCentre')) { camLoose = false; return true; }
  if (!player.dead) camLoose = false;
  if (!camFreeOn()) return true;
  if (state.intro > 0) return true; // the glide onto a fresh or respawned body plays out first
  const [ex, ey] = camEdge();
  if (ex || ey) {
    const v = CAM_PAN * dt / zoomCur;
    camX += ex * v; camY += ey * v;
    if (player.dead) camLoose = true;
  }
  return player.dead && !camLoose; // down: ride the watched ally (or your fall) until panned off
}
// the centre key's tap: straight onto the body you are watching, no sweep
function camCentre() {
  camLoose = false;
  const vp = viewPlayer();
  camX = vp.x - WV_W / 2; camY = vp.y - WV_H / 2;
}
// a left press on the minimap takes the camera; the release lets it go
function camDragStart() { camDrag = true; if (player.dead) camLoose = true; }
function camDragEnd() { if (!camDrag) return; camDrag = false; if (!camFreeOn()) camLoose = false; }
