'use strict';
// Director mode: the live game as a film set, for Shorts and longform. F7
// turns it on; then the arrows fly a free camera, HOME hands it back to the
// player, PAGE UP / PAGE DOWN glide the zoom (the wheel still steps it), F8
// hides the HUD, F9 swaps the 16:9 window for a 9:16 Short frame, and F2
// records the canvas itself to a video file. Everything here is the local
// machine's view of the match: the sim never reads it (CLAUDE.md, rule 2),
// so it works as host, client or alone, and nothing joins SAVE_ROOTS.
// Loaded right after core.js because fitCanvas() (canvas.js) asks dirTall()
// at load. Freeze, slow motion and rewind would join `director` here.
// ------------------------------------------------------------ director
const DIR_PAN = 360;        // screen px per second an arrow flies the free camera, at any zoom
const DIR_PAN_EASE = 5;     // per second: how fast a pan gathers speed and settles (a drift, not a jerk)
const DIR_FOLLOW = 4;       // per second: the follow camera's lerp while directing, with no aim lean (play: 7, leaning)
const DIR_ZOOM_EASE = 4;    // per second: the zoom's glide while directing (play: ZOOM_EASE)
const DIR_TALL_W = 1080, DIR_TALL_H = 1920; // the 9:16 frame's canvas in DEVICE px, whatever the window: a Short's size
const DIR_FLASH = 1.6;      // seconds the strip stays up after a director key while the HUD is hidden

const director = {
  on: false,
  free: false,   // the camera flies on the arrows instead of following the player
  tall: false,   // the 9:16 frame (fitCanvas)
  vx: 0, vy: 0,  // the free camera's drift, world px per second
  flash: 0,      // the strip's linger while the HUD is hidden
  rec: null,     // the take being recorded (the `recorder` banner)
};
function dirTall() { return director.on && director.tall; }
function dirReframe() { fitCanvas(); relayout(); }

// The director's keys, asked by keyPress (input.js) before any mode takes the
// key. F7 works everywhere; the rest only while directing. The arrows are
// read held, by dirCam, and never walk the body while directing
// (sampleHumanInput); their press only cuts the camera loose.
function directorKey(e) {
  if (e.key === 'F7') {
    director.on = !director.on;
    if (!director.on) {
      dirRecStop();
      window.DBG.hideUI = false;
      director.free = false; director.vx = director.vy = 0;
    }
    if (director.tall) dirReframe();
    director.flash = DIR_FLASH; SFX.ui(director.on);
    return true;
  }
  if (!director.on) return false;
  const k = e.key;
  if (k.startsWith('Arrow')) { // ...but the menus and the ESC slab keep theirs
    if (state.mode !== 'title' && !state.settingsOpen) { director.free = true; director.flash = DIR_FLASH; }
    return false;
  }
  if (k === 'Home') { director.free = false; director.flash = DIR_FLASH; return true; }
  if (k === 'PageUp' || k === 'PageDown') {
    const k0 = kWant;
    kWant = Math.max(kMin(), Math.min(kMax(), kWant + (k === 'PageUp' ? 1 : -1)));
    if (kWant !== k0) SFX.notch();
    return true;
  }
  if (e.repeat) return false;
  if (k === 'F8') { window.DBG.hideUI = !window.DBG.hideUI; director.flash = DIR_FLASH; return true; }
  if (k === 'F9') { dirRecStop(); director.tall = !director.tall; dirReframe(); director.flash = DIR_FLASH; return true; }
  if (k === 'F2') { if (director.rec) dirRecStop(); else dirRecStart(); director.flash = DIR_FLASH; return true; }
  return false;
}

// The camera while directing, run by update() (sim.js) in place of the play
// camera. `free` flies on the held arrows with an eased drift, its speed in
// SCREEN px so a pan feels the same at every zoom; following holds the
// viewed player dead centre on a slower lerp than play's, with no lean toward
// the pointer, so aiming never shakes the shot. Returns false when the scene
// owns the camera (the title, and following through the drop or a ceremony),
// and update() runs its own branches.
function dirCam(dt) {
  if (!director.on || state.mode === 'title') return false;
  director.flash = Math.max(0, director.flash - dt);
  if (!director.free) {
    if (state.mode !== 'play' && state.mode !== 'dead') return false;
    if (state.intro > 0 || state.eagleCine || state.dropBrief) return false;
    const vp = viewPlayer(), a = Math.min(1, dt * DIR_FOLLOW);
    camX += (vp.x - WV_W / 2 - camX) * a;
    camY += (vp.y - WV_H / 2 - camY) * a;
    return true;
  }
  let mx = 0, my = 0;
  const held = (k) => !state.settingsOpen && !!keys[k]; // the ESC slab pages on them
  if (held('arrowleft')) mx -= 1;
  if (held('arrowright')) mx += 1;
  if (held('arrowup')) my -= 1;
  if (held('arrowdown')) my += 1;
  const n = Math.hypot(mx, my) || 1, s = DIR_PAN / zoomCur / n;
  const e = 1 - Math.exp(-DIR_PAN_EASE * dt);
  director.vx += (mx * s - director.vx) * e;
  director.vy += (my * s - director.vy) * e;
  camX += director.vx * dt; camY += director.vy * dt;
  return true;
}

// ---- the strip --------------------------------------------------------------
// At the left edge, halfway down (clear of the party frames and the
// tooltip's corner), over everything: the camera (the player's mark following, the
// four arrows flying), the HUD (an eye, shut when hidden), the frame (wide or
// tall) and the record dot with the take's clock. Each wears its key. It is
// drawn AFTER the recorder copies the frame (render.js), so a take never
// carries it; with the HUD hidden it shows only a moment after a key, and
// while recording only the dot and clock.
const DIR_INK = '#c2d8ee', DIR_LIT = '#f4f7ff', DIR_DIM = '#5d6b86', DIR_REC = '#e0453a';
function dirIcon(g, kind, x, y, lit) {
  const c = lit ? DIR_LIT : DIR_INK, px = (dx, dy, w, h) => g.fillRect(x + dx, y + dy, w || 1, h || 1);
  g.fillStyle = c;
  if (kind === 'film') { px(0, 2, 9, 6); px(0, 0, 9, 1); g.fillStyle = '#0a0e23'; px(2, 0, 1, 1); px(5, 0, 1, 1); px(1, 3, 2, 1); }
  else if (kind === 'follow') { px(3, 0, 3, 3); px(2, 4, 5, 4); px(4, 8, 1, 1); }
  else if (kind === 'free') { px(4, 0, 1, 9); px(0, 4, 9, 1); px(3, 1, 3, 1); px(3, 7, 3, 1); px(1, 3, 1, 3); px(7, 3, 1, 3); }
  else if (kind === 'eye') { px(2, 2, 5, 1); px(1, 3, 1, 1); px(7, 3, 1, 1); px(0, 4, 1, 1); px(8, 4, 1, 1); px(1, 5, 1, 1); px(7, 5, 1, 1); px(2, 6, 5, 1); px(3, 3, 3, 3); }
  else if (kind === 'shut') { px(0, 4, 1, 1); px(8, 4, 1, 1); px(1, 5, 7, 1); px(2, 6, 1, 1); px(4, 6, 1, 1); px(6, 6, 1, 1); }
  else if (kind === 'wide') { g.strokeStyle = c; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 2.5, 8, 4); }
  else if (kind === 'tall') { g.strokeStyle = c; g.lineWidth = 1; g.strokeRect(x + 2.5, y + 0.5, 4, 8); }
  else if (kind === 'rec') {
    g.fillStyle = lit ? DIR_REC : DIR_INK;
    px(3, 1, 3, 7); px(2, 2, 5, 5); px(1, 3, 7, 3);
    if (!lit) { g.fillStyle = '#0a0e23'; px(3, 3, 3, 3); }
  }
}
function drawDirector(now) {
  if (!director.on) return;
  const hidden = window.DBG.hideUI, rec = director.rec;
  const a = hidden ? Math.min(1, director.flash / 0.4) : 1;
  if (a <= 0 && !rec) return;
  const g = ctx;
  const cells = hidden && a <= 0 ? [] : [
    ['film', 'F7', true],
    [director.free ? 'free' : 'follow', director.free ? 'HOME' : '', director.free],
    [hidden ? 'shut' : 'eye', 'F8', !hidden],
    [director.tall ? 'tall' : 'wide', 'F9', director.tall],
  ];
  const clock = rec ? ((now - rec.t0) | 0) : -1;
  const tc = clock >= 0 ? Math.floor(clock / 60) + ':' + String(clock % 60).padStart(2, '0') : '';
  let w = 4;
  for (const c of cells) w += Math.max(13, c[1] ? pixelTextWidth(c[1]) + 6 : 0) + 2;
  w += 13 + (tc ? pixelTextWidth(tc) + 3 : pixelTextWidth('F2') + 8);
  const h = cells.length ? 26 : 15, x0 = 4, y0 = Math.round((VIEW_H - 26) / 2);
  g.globalAlpha = cells.length ? a : 1;
  g.fillStyle = 'rgba(10,14,35,0.82)'; g.fillRect(x0, y0, w, h);
  g.fillStyle = DIR_DIM;
  g.fillRect(x0, y0, w, 1); g.fillRect(x0, y0 + h - 1, w, 1); g.fillRect(x0, y0, 1, h); g.fillRect(x0 + w - 1, y0, 1, h);
  let x = x0 + 3;
  for (const [icon, cap, lit] of cells) {
    const cw = Math.max(13, cap ? pixelTextWidth(cap) + 6 : 0);
    dirIcon(g, icon, x + Math.round((cw - 9) / 2), y0 + 3, lit);
    if (cap) drawKeyCap(g, x, y0 + 14, cap, false, 0, now);
    x += cw + 2;
  }
  dirIcon(g, 'rec', x + 2, y0 + 3, !!rec && (now % 1) < 0.6);
  if (tc) drawPixelText(g, tc, x + 14, y0 + 5, DIR_LIT);
  else if (cells.length) drawKeyCap(g, x, y0 + 14, 'F2', false, 0, now);
  g.globalAlpha = 1;
}

// ------------------------------------------------------------ recorder
// F2 films the canvas itself, so a 9:16 take is exactly DIR_TALL_W x
// DIR_TALL_H at whole pixels on any monitor - what a screen recorder cannot
// promise once the frame is shown smaller than it is. Each frame render()
// hands over the finished picture BEFORE the strip goes on it (dirRecFrame),
// into a canvas of the take's own whose stream the recorder encodes; the
// sounds come off the master dial (SFX.tap), the music is not in it. Ending
// the take saves the file the way the browser saves a download. A frame
// change or a resize ends the take, since a take has one size.
const DIR_REC_FPS = 60;
const DIR_REC_BPS = 40e6;   // bits per second: pixel edges survive the encoder
// the first the browser can make: an H.264 mp4 where it has the encoder (Chrome,
// the Electron build), else VP9. Named in full, codecs and all - a bare
// 'video/mp4' on a browser without H.264 wrote a file with no picture in it
const DIR_REC_TYPES = ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/mp4;codecs=avc1.640033,opus',
  'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
function dirRecStart() {
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) { SFX.deny(); return; }
  const cv = document.createElement('canvas');
  cv.width = canvas.width; cv.height = canvas.height;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(canvas, 0, 0);
  const stream = cv.captureStream(DIR_REC_FPS);
  const sound = SFX.tap && SFX.tap();
  if (sound) for (const t of sound.getAudioTracks()) stream.addTrack(t);
  const type = DIR_REC_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  let r;
  try { r = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: DIR_REC_BPS }); } catch (err) { return; }
  const parts = [];
  r.ondataavailable = (ev) => { if (ev.data && ev.data.size) parts.push(ev.data); };
  r.onstop = () => {
    for (const t of stream.getVideoTracks()) t.stop();
    if (!parts.length) return;
    const blob = new Blob(parts, { type: r.mimeType || type || 'video/webm' });
    const d = new Date(), two = (n) => String(n).padStart(2, '0');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'softfall-' + d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + '-' +
      two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds()) + '-' + cv.width + 'x' + cv.height +
      (/mp4/.test(blob.type) ? '.mp4' : '.webm');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };
  r.start(1000);
  director.rec = { r, cv, g, t0: performance.now() / 1000 };
}
function dirRecStop() {
  const rec = director.rec;
  if (!rec) return;
  director.rec = null;
  if (rec.r.state !== 'inactive') rec.r.stop();
}
// the finished frame into the take: called by render() before drawDirector
function dirRecFrame() {
  const rec = director.rec;
  if (!rec) return;
  if (rec.cv.width !== canvas.width || rec.cv.height !== canvas.height) { dirRecStop(); return; }
  rec.g.drawImage(canvas, 0, 0);
}
