'use strict';
// The pixels of a phone's controls - js/touch.js decides, this draws: the
// plates, the two sticks and the rotate prompt.
// ------------------------------------------------------------ touch controls
// The pixels of a phone's controls - js/touch.js decides, this draws: the
// plates (touchLayout), the two floating sticks, and the rotate prompt. The
// glyph set is shared with the CONTROLS page's TOUCH tab (bakeCtrlTouch,
// panels.js) so what is learned there is recognised here.
const TOUCH_PLATE = 'rgba(8,12,28,0.6)';
const TOUCH_RIM = '#35426e', TOUCH_INK = '#cfe0ff', TOUCH_HOT = '#ffd95c';
const TOUCH_STICK_COL = 'rgba(244,247,255,';   // the move stick, white
const TOUCH_AIM_COL = 'rgba(255,217,92,';       // the aim stick wears the draw's gold

// a filled disc and a 1px ring, in scanlines, so they are pixel art and not
// an anti-aliased arc
function touchDisc(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}
function touchRing(g, cx, cy, r, col) {
  g.fillStyle = col;
  const ri = r - 1;
  for (let dy = -r; dy <= r; dy++) {
    const wo = Math.floor(Math.sqrt(r * r - dy * dy));
    const wi = Math.abs(dy) > ri ? -1 : Math.floor(Math.sqrt(ri * ri - dy * dy));
    if (wi < 0) g.fillRect(cx - wo, cy + dy, wo * 2 + 1, 1);
    else { g.fillRect(cx - wo, cy + dy, wo - wi, 1); g.fillRect(cx + wi + 1, cy + dy, wo - wi, 1); }
  }
}

// one glyph, ~9px, centred on cx, cy. `bg` is the plate under it, for the
// one glyph that needs a bite taken out (the roll's arrow gap)
function drawTouchIcon(g, id, cx, cy, col, bg) {
  g.fillStyle = col;
  switch (id) {
    case 'dodge': // a curl with an arrowhead: the roll
      touchRing(g, cx, cy, 4, col);
      g.fillStyle = bg || TOUCH_PLATE; g.fillRect(cx + 1, cy - 5, 4, 4);
      g.fillStyle = col;
      g.fillRect(cx + 3, cy - 4, 1, 3); g.fillRect(cx + 2, cy - 3, 3, 1); g.fillRect(cx + 4, cy - 5, 1, 1);
      break;
    case 'work': // an axe: diagonal haft, blade top-right
      for (let i = 0; i < 6; i++) g.fillRect(cx - 3 + i, cy + 3 - i, 1, 1);
      g.fillRect(cx + 1, cy - 4, 3, 3); g.fillRect(cx + 4, cy - 3, 1, 2); g.fillRect(cx, cy - 3, 1, 2);
      break;
    case 'slide': // a boot on a blade, with the speed behind it
      g.fillRect(cx - 4, cy + 3, 9, 1);
      g.fillRect(cx - 2, cy - 3, 4, 5); g.fillRect(cx + 2, cy, 3, 2);
      g.fillRect(cx - 6, cy - 1, 2, 1); g.fillRect(cx - 7, cy + 1, 2, 1);
      break;
    case 'char': // the sheet's figure
      g.fillRect(cx - 1, cy - 4, 3, 3); g.fillRect(cx - 2, cy, 5, 3);
      g.fillRect(cx - 2, cy + 3, 2, 2); g.fillRect(cx + 1, cy + 3, 2, 2);
      break;
    case 'build': // a hammer
      g.fillRect(cx - 4, cy - 4, 6, 3); g.fillRect(cx - 1, cy - 1, 1, 6); g.fillRect(cx - 2, cy - 1, 3, 1);
      break;
    case 'flag': // a pennant on a pole
      g.fillRect(cx - 3, cy - 4, 1, 9); g.fillRect(cx - 2, cy - 4, 5, 3);
      g.fillStyle = bg || TOUCH_PLATE; g.fillRect(cx + 2, cy - 3, 1, 1);
      break;
    case 'cog': // the ESC slab
      touchRing(g, cx, cy, 3, col);
      g.fillRect(cx - 1, cy - 1, 3, 3);
      g.fillRect(cx - 1, cy - 5, 3, 2); g.fillRect(cx - 1, cy + 4, 3, 2);
      g.fillRect(cx - 5, cy - 1, 2, 3); g.fillRect(cx + 4, cy - 1, 2, 3);
      break;
    case 'x': // back out
      for (let i = -3; i <= 3; i++) { g.fillRect(cx + i, cy + i, 1, 1); g.fillRect(cx + i, cy - i, 1, 1); }
      break;
    case 'zoomOut': case 'zoomIn': // a glass, with the sign in it
      touchRing(g, cx - 1, cy - 1, 3, col);
      g.fillRect(cx + 2, cy + 2, 1, 1); g.fillRect(cx + 3, cy + 3, 1, 1);
      g.fillRect(cx - 3, cy - 1, 5, 1);
      if (id === 'zoomIn') g.fillRect(cx - 1, cy - 3, 1, 5);
      break;
    case 'stick': // a stick: the ring, and the knob off centre
      touchRing(g, cx, cy, 4, col);
      touchDisc(g, cx + 1, cy + 1, 1, col);
      break;
    case 'map': // the minimap disc
      touchRing(g, cx, cy, 4, col); g.fillRect(cx, cy, 1, 1);
      break;
  }
}

function drawTouchPlate(b, now) {
  const on = !!touch.held[b.id] || (b.id === 'slide' && keyHeld('slide'));
  touchDisc(ctx, b.x, b.y, b.r, TOUCH_PLATE);
  touchRing(ctx, b.x, b.y, b.r, on ? TOUCH_HOT : TOUCH_RIM);
  if (on) { ctx.globalAlpha = 0.25; touchDisc(ctx, b.x, b.y, b.r - 1, TOUCH_HOT); ctx.globalAlpha = 1; }
  drawTouchIcon(ctx, b.glyph, b.x, b.y, on ? TOUCH_HOT : TOUCH_INK);
}
function drawTouchStick(f, col) {
  let dx = f.x - f.x0, dy = f.y - f.y0;
  const d = Math.hypot(dx, dy);
  if (d > TOUCH_STICK_R) { dx *= TOUCH_STICK_R / d; dy *= TOUCH_STICK_R / d; }
  const x0 = Math.round(f.x0), y0 = Math.round(f.y0);
  touchRing(ctx, x0, y0, TOUCH_STICK_R, col + '0.35)');
  touchRing(ctx, x0, y0, TOUCH_STICK_R - 1, col + '0.2)');
  touchDisc(ctx, Math.round(f.x0 + dx), Math.round(f.y0 + dy), TOUCH_KNOB_R, col + '0.55)');
}
function drawTouchControls(now) {
  for (const b of touchLayout()) drawTouchPlate(b, now);
  for (const f of touch.fingers.values()) {
    if (f.kind === 'move') drawTouchStick(f, TOUCH_STICK_COL);
    else if (f.kind === 'aim') drawTouchStick(f, TOUCH_AIM_COL);
  }
}

// held upright: the world under a night slab, and a phone turning sideways
// with an arrow curling round it - the game is played the other way
function drawRotatePrompt(now) {
  ctx.fillStyle = 'rgba(6,10,24,0.92)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const cx = Math.round(VIEW_W / 2), cy = Math.round(VIEW_H / 2);
  // the phone, easing between upright and sideways on a slow clock
  const t = (Math.sin(now * 1.6) + 1) / 2;
  const k = t < 0.5 ? 0 : 1; // it snaps: two poses read, a tween of rectangles does not
  const w = k ? 44 : 24, h = k ? 24 : 44;
  ctx.fillStyle = '#35426e'; ctx.fillRect(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4);
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.fillStyle = k ? '#7fa8d8' : '#141c3c'; ctx.fillRect(cx - w / 2 + 3, cy - h / 2 + 3, w - 6, h - 6);
  if (k) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(cx - 2, cy - 2, 4, 4); } // the game, lit, once it lies sideways
  // the arrow: a quarter arc of dots over the top-right, head at the end
  ctx.fillStyle = '#ffd95c';
  const r = 36;
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI * 0.95 + i * (Math.PI * 0.5 / 8);
    ctx.globalAlpha = 0.35 + 0.65 * ((i / 8 + now * 0.8) % 1);
    ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 3, 3);
  }
  ctx.globalAlpha = 1;
  const ax = Math.round(cx + Math.cos(-Math.PI * 0.45) * r), ay = Math.round(cy + Math.sin(-Math.PI * 0.45) * r);
  ctx.fillRect(ax - 2, ay - 5, 5, 2); ctx.fillRect(ax + 1, ay - 3, 2, 3); ctx.fillRect(ax + 3, ay - 1, 2, 5);
}
