'use strict';
// Phones. Whether this is one, the fit a phone asks for (the biggest game
// pixel the overlays allow, and no 16:9 cap - fitCanvas, canvas.js reads
// these), the camera it opens at, the portrait prompt and the fullscreen
// request the first finger makes. The fingers themselves are js/touch.js.
// ------------------------------------------------------------ mobile

// The overlays' footprint, in game px: the world map slab is 308x226 and the
// settings slab 240x218, so a view shorter than this cannot show them. A
// phone takes the LARGEST whole device-pixel scale that keeps the view above
// it - fewer rows than a monitor's 270, so a sprite is thumb-sized and the
// HUD's 3x5 font is legible on six inches of glass. Both halves of the pair
// are read by fitCanvas().
const MOBILE_MIN_W = 320;
const MOBILE_MIN_H = 232;
// the camera a phone opens at, applied the moment phone mode comes on (a
// whole rung at every devScale a phone can reach, 4 and up)
const MOBILE_ZOOM = 1.5;
// a screen whose SHORT side is under this many CSS px is a phone; a tablet
// is a bigger canvas with the same fingers, and gets the desktop fit
const MOBILE_SHORT = 520;

let MOBILE = false; // the live answer; only mobileRefresh() writes it

// what the device says, before the setting has its word: a coarse primary
// pointer (a finger, not a mouse), touch events, and a phone-sized screen
function mobileAuto() {
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const touch = 'ontouchstart' in window || (navigator.maxTouchPoints | 0) > 0;
  const short = Math.min(screen.width || 1e9, screen.height || 1e9);
  return coarse && touch && short <= MOBILE_SHORT;
}

// re-read the answer (the TOUCH MODE row, a resize, boot); true when it
// changed, which is fitCanvas()'s cue to re-fit the view and reset the camera
function mobileRefresh() {
  const m = settings.mobile === 'on' ? true : settings.mobile === 'off' ? false : mobileAuto();
  const changed = m !== MOBILE;
  MOBILE = m;
  return changed;
}

// held upright: the game is played sideways, so the rotate prompt covers the
// view (drawRotatePrompt, ui.js) and touch.js swallows every finger under it
function mobilePortrait() { return MOBILE && window.innerHeight > window.innerWidth; }
// a turn of the phone is a resize that some browsers report only as this;
// the pair is the same one the resize listener calls (canvas.js)
window.addEventListener('orientationchange', () => { setTimeout(() => { fitCanvas(); relayout(); }, 50); });
if (screen.orientation && screen.orientation.addEventListener)
  screen.orientation.addEventListener('change', () => { setTimeout(() => { fitCanvas(); relayout(); }, 50); });

// The first finger asks for the whole screen and a sideways lock. Browsers
// only grant either inside a gesture, and some (iPhone Safari) grant neither,
// so it is asked on every press until it lands and every refusal is silent.
let mobileFsAsked = 0; // wall-clock ms of the last ask, so a burst of taps is one ask
function mobileGesture() {
  if (!MOBILE) return;
  const now = performance.now();
  if (now - mobileFsAsked < 1000) return;
  mobileFsAsked = now;
  const el = document.documentElement;
  const lock = () => {
    try {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { });
    } catch (e) { }
  };
  if (document.fullscreenElement) { lock(); return; }
  try {
    const req = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) :
      el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
    if (req && req.then) req.then(lock).catch(() => { });
    else lock();
  } catch (e) { }
}
