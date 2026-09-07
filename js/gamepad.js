'use strict';
// A gamepad, as the keyboard and the mouse it stands in for. Every button
// presses a KEY through keyPress/keyRelease (input.js), so what a key does is
// written once and a pad can never drift from the keyboard; the right stick
// carries the POINTER (the aim in play, the hand over a panel) through
// pointerMove, so every reticle, hover and hit test already answers it; and
// the left stick's tilt folds into the input struct beside WASD
// (sampleHumanInput). Polled once per frame from loop() - the Gamepad API
// has no events for sticks. Nothing here draws; the CONTROLS page's GAMEPAD
// tab (panels.js) is the picture of this table.
// ------------------------------------------------------------ gamepad
const PAD_DEAD = 0.22;                    // stick tilt under this is rest
const PAD_TRIG = 0.45;                    // a trigger past this is down; up again under half of it
const PAD_AIM_R0 = 30, PAD_AIM_R1 = 120;  // world px from the body the aim sits, rest .. full tilt
const PAD_CUR_SPD = 220;                  // game px/s the pointer walks under the left stick over a panel
const PAD_SCROLL_SPD = 90;                // game px/s the right stick walks a page
const PAD_REP0 = 0.4, PAD_REP = 0.13;     // a held stick over a key-driven menu re-fires on this clock
const PAD_WHEEL_R = 36;                   // game px the right stick reaches from a wheel's press point
const PAD_TAP = 0.3;                      // s: BACK let go sooner is the map; held longer was the standings
const PAD_IDLE = 30;                      // s since its last input before a pad stops counting as in hand

// STANDARD mapping (w3c): 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 BACK,
// 9 START, 10 L3, 11 R3, 12 up, 13 down, 14 left, 15 right.
// In PLAY every button is a key - the names keyPress reads: A rolls, X works,
// Y / B / LB / RB are the four abilities in strip order (LB held is the
// grapple, the one held ability), START is the ESC slab, L3 the pack, up the
// character sheet, left and right the two meals. Four are gestures rather
// than keys and are handled by hand in padPress/padRelease: RT is the draw
// (held) and LT the slide, R3 holds the worker flag, down holds the build
// wheel, and BACK is the standings while held and the map on a tap.
const PAD_PLAY = { 0: ' ', 1: '2', 2: 'e', 3: '1', 4: '3', 5: '4', 9: 'Escape', 10: 'b', 12: 'g', 14: 'q', 15: 'f' };
// Over a menu or a panel: A takes (whatever the pointer is on, or the
// selection where a menu is key-driven - padTake), B, BACK and START back
// out, the dpad and the bumpers are the arrow keys every menu already answers.
const PAD_MENU = { 1: 'Escape', 8: 'Escape', 9: 'Escape', 4: 'ArrowLeft', 5: 'ArrowRight',
  12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

const pad = {
  id: '',                       // the connected pad's name; '' for none
  lastT: -1e9,                  // performance.now()/1000 of its last press or tilt
  mx: 0, my: 0,                 // the left stick, folded into the walk by sampleHumanInput
  aimDx: 1, aimDy: 0, aimK: 0,  // the right stick's last bearing, and its tilt 0..1
  down: {},                     // button index -> held (this frame's edges come off it)
  rep: { k: null, t: 0 },       // the held direction over a key menu, and its repeat clock
  scroll: 0,                    // the right stick's fractional scroll, spent in whole px
  lt: false, rt: false,
  backT: -1,                    // seconds BACK has been held; -1 while it is up
  wheel: false,                 // dpad down is holding the build wheel open
  flag: false,                  // R3 is holding the worker flag
  click: false,                 // A is holding the pointer's button down over a panel
  menu: false,                  // last poll's mode, so a flip mid-hold releases cleanly
};
// a pad is in hand: one is plugged in and was touched lately. The CONTROLS
// page opens on its tab when this reads true.
function padActive() { return !!pad.id && performance.now() / 1000 - pad.lastT < PAD_IDLE; }

// where the buttons are the menu set: any mode but play (the drop's jump and
// map are play keys), and play with something over it
function padMenuMode() {
  if (state.mode !== 'play' && state.mode !== 'drop') return true;
  return state.settingsOpen || state.mapOpen || !!state.shop || state.charOpen || !!state.draft || state.paused;
}
// ...and where, within that, the left stick is a pointer rather than the
// arrow keys: the surfaces only a pointer can work (a panel's rows, the
// shop, the sheet, the chart, the wiki). The title's plank column and the
// death planks are key-driven, so there the stick is the arrows.
function padPointerMode() {
  if (state.mode === 'title') return !!state.menu.panel || state.menu.screen !== 'menu';
  if (state.mode === 'dead') return false;
  return true;
}

function padPoll(dt) {
  const gps = navigator.getGamepads ? navigator.getGamepads() : null;
  let g = null;
  if (gps) for (const c of gps) if (c && c.connected && c.mapping === 'standard') { g = c; break; }
  if (!g && gps) for (const c of gps) if (c && c.connected) { g = c; break; } // an unmapped pad beats none
  if (!g) { if (pad.id) padDrop(); return; }
  pad.id = g.id;
  const now = performance.now() / 1000;
  const ax = (i) => { const v = g.axes[i] || 0; return Math.abs(v) < PAD_DEAD ? 0 : (v - Math.sign(v) * PAD_DEAD) / (1 - PAD_DEAD); };
  const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3);
  const tv = (i) => { const b = g.buttons[i]; return b ? Math.max(b.value || 0, b.pressed ? 1 : 0) : 0; };
  const menu = padMenuMode();
  if (menu !== pad.menu) { padReleaseAll(); pad.menu = menu; }
  // the buttons' edges; the triggers are read as values below
  for (let i = 0; i < 16; i++) {
    if (i === 6 || i === 7) continue;
    const on = tv(i) > PAD_TRIG, was = !!pad.down[i];
    if (on === was) continue;
    pad.down[i] = on;
    pad.lastT = now;
    if (on) padPress(i, menu); else padRelease(i, menu);
  }
  const lt = tv(6) > (pad.lt ? PAD_TRIG * 0.5 : PAD_TRIG);
  const rt = tv(7) > (pad.rt ? PAD_TRIG * 0.5 : PAD_TRIG);
  if (lt !== pad.lt) { pad.lt = lt; pad.lastT = now; if (!menu) keys['shift'] = lt; }
  if (rt !== pad.rt) {
    pad.rt = rt; pad.lastT = now;
    if (!menu) { if (rt) fireDown(); else fireUp(); }
    else if (rt) padTake(); else if (pad.click) { pointerRelease(0); pad.click = false; }
  }
  if (lx || ly || rx || ry) pad.lastT = now;
  if (pad.backT >= 0) pad.backT += dt;

  if (menu) {
    pad.mx = pad.my = 0;
    if (padPointerMode()) {
      if (lx || ly) pointerMove(
        Math.max(0, Math.min(VIEW_W - 1, mouse.x + lx * PAD_CUR_SPD * dt)),
        Math.max(0, Math.min(VIEW_H - 1, mouse.y + ly * PAD_CUR_SPD * dt)), 'pad');
    } else padRepeat(lx, ly, dt);
    // the right stick walks the open page, in whole pixels so the blit stays crisp
    pad.scroll += ry * PAD_SCROLL_SPD * dt;
    const w = Math.trunc(pad.scroll);
    if (w) { pad.scroll -= w; panelScrollBy(w); }
    return;
  }
  pad.mx = lx; pad.my = ly;
  const k = Math.hypot(rx, ry);
  if (k > 0) { pad.aimDx = rx / k; pad.aimDy = ry / k; pad.aimK = Math.min(1, k); }
  // the aim rides the body: once the pad owns the pointer it is rewritten
  // every frame, so the reticle keeps its bearing while you walk. A tilt
  // takes the pointer back from the mouse; the mouse takes it back by moving.
  if (mouse.src === 'pad' || k > 0) padAim(rx, ry);
}

// the pointer, from the right stick: over an open wheel it is the pick's
// travel from the press point; otherwise the aim, a bearing off the body
function padAim(rx, ry) {
  if (state.mode !== 'play') return;
  if (state.wheel && pad.wheel) { pointerMove(state.wheel.ax + rx * PAD_WHEEL_R, state.wheel.ay + ry * PAD_WHEEL_R, 'pad'); return; }
  const r = PAD_AIM_R0 + (PAD_AIM_R1 - PAD_AIM_R0) * pad.aimK;
  pointerMove(wToSX(player.x + pad.aimDx * r), wToSY(player.y + pad.aimDy * r), 'pad');
}

// a held stick over a key-driven menu: the arrow once, then on the repeat clock
function padRepeat(lx, ly, dt) {
  const k = !lx && !ly ? null : Math.abs(ly) > Math.abs(lx) ? (ly < 0 ? 'ArrowUp' : 'ArrowDown') : (lx < 0 ? 'ArrowLeft' : 'ArrowRight');
  if (k !== pad.rep.k) {
    pad.rep.k = k; pad.rep.t = PAD_REP0;
    if (k) keyPress({ key: k, repeat: false });
    return;
  }
  if (!k) return;
  pad.rep.t -= dt;
  if (pad.rep.t <= 0) { pad.rep.t = PAD_REP; keyPress({ key: k, repeat: true }); }
}

// A over a menu: the thing under the pointer if there is one (the hand
// cursor already knows), otherwise the selection - Enter, which every
// key-driven menu answers
function padTake() {
  const c = cursorInfo();
  if (c.kind === 'hand' || c.kind === 'grab') { pointerPress(0); pad.click = true; }
  else keyPress({ key: 'Enter', repeat: false });
}

function padPress(i, menu) {
  if (menu) {
    if (i === 0) { padTake(); return; }
    const k = PAD_MENU[i];
    if (k) keyPress({ key: k, repeat: false });
    return;
  }
  if (i === 8) { keys['tab'] = true; pad.backT = 0; return; }
  if (i === 11) { pad.flag = flagDown(); return; }
  if (i === 13) { pad.wheel = openWheelNear(player, mouse.x, mouse.y); return; }
  const k = PAD_PLAY[i];
  if (!k) return;
  keys[k.toLowerCase()] = true;
  keyPress({ key: k, repeat: false });
}
function padRelease(i, menu) {
  if (menu) {
    if (i === 0) { if (pad.click) pointerRelease(0); pad.click = false; return; }
    const k = PAD_MENU[i];
    if (k) keyRelease({ key: k });
    return;
  }
  if (i === 8) {
    keys['tab'] = false;
    if (pad.backT >= 0 && pad.backT < PAD_TAP) keyPress({ key: 'm', repeat: false });
    pad.backT = -1;
    return;
  }
  if (i === 11) { if (pad.flag) flagUp(); pad.flag = false; return; }
  if (i === 13) { if (pad.wheel && state.wheel) { resolveWheel(); state.wheel = null; } pad.wheel = false; return; }
  const k = PAD_PLAY[i];
  if (!k) return;
  keys[k.toLowerCase()] = false;
  keyRelease({ key: k });
}
// the mode flipped under held buttons (START opened the slab, a death): let
// go of everything in the mode it was pressed in, and keep the buttons
// marked down so the same hold does not press again in the new one
function padReleaseAll() {
  for (const i in pad.down) if (pad.down[i]) padRelease(+i, pad.menu);
  if (pad.lt) { keys['shift'] = false; }
  if (pad.rt) { if (pad.menu) { if (pad.click) pointerRelease(0); } else fireUp(); }
  pad.lt = pad.rt = false;
  pad.click = pad.flag = pad.wheel = false;
  pad.backT = -1;
  pad.rep.k = null;
}
function padDrop() {
  padReleaseAll();
  pad.down = {};
  pad.id = '';
  pad.mx = pad.my = 0;
}
