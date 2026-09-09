'use strict';
// Fingers. Two sticks that appear under the thumbs that press them - the
// left walks; the right aims, DRAWS while it is down and LOOSES when it
// lifts, the mouse button's own grammar - a column of plates for what the
// keyboard puts on keys, and everywhere else a finger IS the mouse: it moves
// and presses through pointerMove/pointerPress/pointerRelease (input.js)
// exactly as the button does, so every plank, panel and well already
// answers it. What a plate does is a key (keyPress), so it can never drift
// from the keyboard either. The pixels are drawTouchControls (ui.js); this
// file only decides. Live only in phone mode (MOBILE, js/mobile.js).
// ------------------------------------------------------------ touch
const TOUCH_STICK_R = 24;                     // game px of travel a stick has
const TOUCH_KNOB_R = 9;
const TOUCH_DEAD = 0.12;                      // tilt under this is rest
const TOUCH_AIM_R0 = 30, TOUCH_AIM_R1 = 120;  // world px the aim sits from the body, rest .. full travel
const TOUCH_IDLE = 30;                        // s since the last finger before touch stops counting as in hand
const TOUCH_R = 13;                           // a plate's radius; the roll's is bigger, the top row's smaller
const TOUCH_R_BIG = 17;
const TOUCH_R_SMALL = 10;
const TOUCH_COL_X = 22;                       // the two columns' centres, in from either edge

// What a plate does. `act` presses that action's key (KEY_ACTIONS, input.js:
// whatever it is bound to, held for as long as the finger is down, so WORK
// is the work key held); `key` a fixed key (the menu plate's Escape);
// `latch` flips an action's key on each tap (SLIDE is the slide key, a
// toggle under a thumb); `zoom` steps the camera a rung; a
// `gesture` plate is held and dragged - BUILD opens the wheel and the finger
// picks the wedge, FLAG raises the order and the finger's lift plants it.
// `when` hides a plate that has nothing to do; `menu` is the one plate that
// stays up over every panel and screen, where its glyph is a cross and its
// key backs out (Escape).
const TOUCH_BTNS = {
  dodge: { r: TOUCH_R_BIG, act: 'dodge' },
  work: { r: TOUCH_R, act: 'work' },
  slide: { r: TOUCH_R, latch: 'slide' },
  char: { r: TOUCH_R - 2, act: 'char' },
  build: { r: TOUCH_R, gesture: 'wheel' },
  flag: { r: TOUCH_R, gesture: 'flag', when: () => hasWorkers(player) },
  menu: { r: TOUCH_R_SMALL, key: 'Escape' },
  zoomOut: { r: TOUCH_R_SMALL, zoom: -1 },
  zoomIn: { r: TOUCH_R_SMALL, zoom: 1 },
};

const touch = {
  fingers: new Map(),           // pointerId -> { id, kind, x0, y0, x, y, ly, acc, btn, gesture }
  mx: 0, my: 0,                 // the move stick, folded into the walk by sampleHumanInput
  aimDx: 1, aimDy: 0, aimK: 0,  // the aim stick's last bearing, and its travel 0..1
  lastT: -1e9,                  // performance.now()/1000 of the last finger
  held: {},                     // plate id -> a finger is on it (the plates light off this)
};
function touchActive() { return performance.now() / 1000 - touch.lastT < TOUCH_IDLE; }
function touchFinger(kind) { for (const f of touch.fingers.values()) if (f.kind === kind) return f; return null; }

// something is over the world that wants a pointer, not sticks: every mode
// but play, and play with a panel up (the wheel is not one - a finger is
// still aiming under it, and the sim swallows the shot itself)
function touchOverlay() {
  if (state.mode !== 'play') return true;
  return state.settingsOpen || state.mapOpen || !!state.shop || state.charOpen || !!state.draft || state.paused || player.dead;
}
// the menu plate is a cross over anything Escape backs out of; a cog in free
// play; gone on the title's bare column, where there is nothing to back out of
function touchMenuGlyph() {
  if (state.mode === 'title') return state.menu.panel || state.menu.screen !== 'menu' ? 'x' : null;
  if (state.mode === 'drop') return state.mapOpen ? 'x' : null;
  if (state.mode === 'dead') return state.deadView === 'spec' ? 'x' : null;
  return touchOverlay() || state.wheel || state.flagAim ? 'x' : 'cog';
}

// Where the plates sit: the right column climbs off the pack's top edge (roll,
// work, slide, the sheet - under the right thumb, which is also the aim), the
// left column holds build and the flag (under the walking thumb, and the
// flag only once there is a crew), the top-left row is the menu cog and the
// zoom pair (the top-left is otherwise empty on purpose - renderUI). The
// draw and the hit test both read it, so a plate is exactly its own pixels.
function touchLayout() {
  const out = [];
  const glyph = touchMenuGlyph();
  if (glyph) out.push({ id: 'menu', x: 14, y: 14, r: TOUCH_R_SMALL, glyph });
  if (touchOverlay() || !MOBILE) return out;
  const put = (id, x, y) => { const b = TOUCH_BTNS[id]; if (b.when && !b.when()) return; out.push({ id, x, y, r: b.r, glyph: id }); };
  let y = Math.round(cornerToScreen(0, bagFrameRect().y).y) - 4; // the grid is always up: the column stands on it, at the HUD SIZE it wears
  const col = (id, x) => { const r = TOUCH_BTNS[id].r; y -= r; put(id, x, y); y -= r + 5; };
  col('dodge', VIEW_W - TOUCH_COL_X);
  col('work', VIEW_W - TOUCH_COL_X);
  col('slide', VIEW_W - TOUCH_COL_X);
  col('char', VIEW_W - TOUCH_COL_X);
  y = VIEW_H - 8;
  col('build', TOUCH_COL_X);
  col('flag', TOUCH_COL_X);
  put('zoomOut', 40, 14);
  put('zoomIn', 64, 14);
  return out;
}
function touchBtnAt(x, y) {
  for (const b of touchLayout()) if (Math.hypot(x - b.x, y - b.y) <= b.r + 3) return b;
  return null;
}

// ---- the fingers ----
function touchPos(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
  e.preventDefault(); // no compatibility mouse events behind the finger
  const [x, y] = touchPos(e);
  touchDown(e.pointerId, x, y);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
  const [x, y] = touchPos(e);
  touchMove(e.pointerId, x, y);
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => {
  if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
  touchUp(e.pointerId);
});
// a lifted finger the canvas never heard about (it left the window mid-drag)
window.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') touchUp(e.pointerId); });
// the browser's own double-tap zoom and long-press callout never get a look in
canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
// a finger down when the page loses focus or goes behind another app never
// sends its lift: let every one go (the walk stops, the draw looses, a held
// plate releases) rather than leave a phantom thumb on the glass
function touchReleaseAll() { for (const id of [...touch.fingers.keys()]) touchUp(id); }
window.addEventListener('blur', touchReleaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) touchReleaseAll(); });

function touchDown(id, x, y) {
  touch.lastT = performance.now() / 1000;
  mobileGesture();               // the first finger asks for fullscreen and sideways
  if (mobilePortrait()) return;  // the rotate prompt is up: nothing under it is live
  if (!MOBILE) { touch.fingers.set(id, touchPtr(id, x, y)); return; } // a finger on a desktop is a mouse
  const f = { id, kind: 'none', x0: x, y0: y, x, y, ly: y, acc: 0 };
  const b = touchBtnAt(x, y);
  if (b) { f.kind = 'btn'; f.btn = b.id; touch.fingers.set(id, f); touchBtnPress(f, b.id); return; }
  if (touchOverlay()) { touch.fingers.set(id, touchPtr(id, x, y)); return; }
  // free play: the minimap is the map key, the HUD is the mouse, the two
  // halves of the world are the two sticks
  if (Math.hypot(x - MM_CX, y - MM_CY) <= MM_R + 7) { SFX.unlock(); keyPress({ key: actKey('map'), repeat: false }); touch.fingers.set(id, f); return; }
  if (overHud(x, y)) { touch.fingers.set(id, touchPtr(id, x, y)); return; }
  if (x < VIEW_W / 2) { if (!touchFinger('move')) f.kind = 'move'; }
  else if (!touchFinger('aim')) { f.kind = 'aim'; fireDown(); }
  touch.fingers.set(id, f);
}
// a finger that is the mouse: one at a time, the rest are ignored
function touchPtr(id, x, y) {
  const f = { id, kind: 'none', x0: x, y0: y, x, y, ly: y, acc: 0 };
  if (touchFinger('ptr')) return f;
  f.kind = 'ptr';
  pointerMove(x, y, 'touch');
  pointerPress(0);
  return f;
}
function touchMove(id, x, y) {
  const f = touch.fingers.get(id);
  if (!f) return;
  f.x = x; f.y = y;
  if (f.kind === 'ptr') {
    pointerMove(x, y, 'touch');
    // a drag that grabbed nothing walks the page under it, in whole px
    if (!dragSlider && !state.dragPend && !state.drag) {
      f.acc += f.ly - y;
      const w = Math.trunc(f.acc);
      if (w) { if (panelScrollBy(w)) f.acc -= w; else f.acc = 0; }
    }
  } else if (f.kind === 'btn' && f.gesture) pointerMove(x, y, 'touch'); // the wheel's pick, the flag's target
  f.ly = y;
}
function touchUp(id) {
  const f = touch.fingers.get(id);
  if (!f) return;
  touch.fingers.delete(id);
  if (f.kind === 'aim') fireUp();
  else if (f.kind === 'move') touch.mx = touch.my = 0;
  else if (f.kind === 'ptr') pointerRelease(0);
  else if (f.kind === 'btn') touchBtnRelease(f, f.btn);
}
function touchBtnPress(f, id) {
  const b = TOUCH_BTNS[id];
  touch.held[id] = true;
  SFX.unlock();
  if (b.act || b.key) { const k = b.act ? actKey(b.act) : b.key; keys[k.toLowerCase()] = true; keyPress({ key: k, repeat: false }); }
  else if (b.latch) { const k = actKey(b.latch).toLowerCase(); keys[k] = !keys[k]; }
  else if (b.zoom) kWant = Math.max(kMin(), Math.min(kMax(), kWant + b.zoom));
  else if (b.gesture === 'wheel') { pointerMove(f.x, f.y, 'touch'); f.gesture = openWheelNear(player, f.x, f.y); }
  else if (b.gesture === 'flag') { pointerMove(f.x, f.y, 'touch'); f.gesture = flagDown(); }
}
function touchBtnRelease(f, id) {
  const b = TOUCH_BTNS[id];
  touch.held[id] = false;
  if (b.act || b.key) { const k = b.act ? actKey(b.act) : b.key; keys[k.toLowerCase()] = false; keyRelease({ key: k }); }
  else if (b.gesture === 'wheel' && f.gesture) { if (state.wheel) { resolveWheel(); state.wheel = null; } }
  else if (b.gesture === 'flag' && f.gesture) flagUp();
}

// the sticks, once per frame from loop(): each finger's travel from where it
// landed, and the aim rewritten through the pointer so the reticle rides the
// body at its bearing (as the pad does) - unless a finger IS the mouse just
// now, or the mouse itself moved last
function touchPoll() {
  const stick = (f) => {
    let dx = (f.x - f.x0) / TOUCH_STICK_R, dy = (f.y - f.y0) / TOUCH_STICK_R;
    const k = Math.hypot(dx, dy);
    if (k > 1) { dx /= k; dy /= k; }
    return k < TOUCH_DEAD ? [0, 0, 0] : [dx, dy, Math.min(1, k)];
  };
  const mv = touchFinger('move');
  if (mv) [touch.mx, touch.my] = stick(mv); else touch.mx = touch.my = 0;
  const am = touchFinger('aim');
  if (am) {
    const [dx, dy, k] = stick(am);
    if (k > 0) { touch.aimDx = dx / k; touch.aimDy = dy / k; touch.aimK = k; }
  }
  if (state.mode !== 'play' || !MOBILE) return;
  if (mouse.src !== 'touch' && !am) return;
  if (touchFinger('ptr')) return;
  for (const f of touch.fingers.values()) if (f.kind === 'btn' && f.gesture) return; // the finger on a wheel or a flag has the pointer
  if (state.wheel && !touchFinger('btn')) return;
  const r = TOUCH_AIM_R0 + (TOUCH_AIM_R1 - TOUCH_AIM_R0) * touch.aimK;
  pointerMove(wToSX(player.x + touch.aimDx * r), wToSY(player.y + touch.aimDy * r), 'touch');
}
