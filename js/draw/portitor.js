'use strict';
// ------------------------------------------------------------ portitor
// PORTITOR's pixels (its rules: js/sim/portitor.js): its walking pole in its hands
// (HERO_BLADES), the supply crate in the air (HERO_AIR) and the ring where it will land
// (HERO_GROUND), and BEDROLL's mend on an ally resting beside it (HERO_MARK). The ally it
// carries is drawn up on its back by drawPlayer itself (HERO_HELD; heldSeat, js/draw/bodies.js).

const PT_INK = '#141a2c', PT_WOOD = '#a8794a', PT_WOOD_D = '#6e4a28', PT_MEND = '#9cc87a';

// ---- the walking pole in its hands ------------------------------------------------------
let portitorPoleArt = null;
function portitorPoleArtOf() {
  return portitorPoleArt || (portitorPoleArt = { flat: bakeBladeArt(PORTITOR_POLE, PORTITOR_POLE_PAL), diag: bakeBladeArt(PORTITOR_POLE_DIAG, PORTITOR_POLE_PAL) });
}
// no slanted carry (`hip` names no facing): at rest it stands the pole upright on the snow
// in every facing, its hand closed round it (portitorCarry); flat for the swing and the wind-up
HERO_BLADES.pole = { art: portitorPoleArtOf, hilt: [18, 11], hip: {}, grip: PORTITOR_POLE_GRIP };
// The pole at rest, upright: its foot on the snow by the leading foot, the copper hook at
// head height and turned in toward the head, never over it (the health frame sits there),
// and its hand closed round the haft at the hip in the look's own copper, over the pole.
// Facing up it stands on the far side, behind the body (HERO_CARRY).
const PT_POLE_UP = [
  '.oo..',
  'oHHo.',
  'oHoHo',
  'oHo.o',
  '.oHo.',
  '.oGo.',
  '.oGo.',
  '.ogo.',
  '.oGo.',
  '.oGo.',
  '.oGo.',
  '.ogo.',
  '.oGo.',
  '.oGo.',
  '.ooo.',
];
let portitorPoleUp = null;
function portitorCarry(p, px, py) {
  if (!isPortitor(p)) return false;
  const img = portitorPoleUp || (portitorPoleUp = bakeBladeArt(PT_POLE_UP, PORTITOR_POLE_PAL));
  const left = p.dir === 'left' || p.dir === 'up', x = left ? px - 1 : px + 12, y = py + 16 - img.height;
  ctx.drawImage(left ? heldFlip(img) : img, x, y);
  const look = heroArtOf(p.cls).looks.find((r) => r.id === heroSkinOf(p)) || heroArtOf(p.cls).looks[0];
  const pal = Object.assign({}, PORT_PAL, look.pal);
  const hx = x + 1, hy = py + 9;
  ctx.fillStyle = PT_INK; ctx.fillRect(hx - (left ? 1 : 0), hy - 1, 4, 4);
  ctx.fillStyle = pal.T; ctx.fillRect(hx, hy, 2, 1);
  ctx.fillStyle = pal.m; ctx.fillRect(hx, hy + 1, 2, 1);
  return true;
}
HERO_CARRY.push(portitorCarry);

// ---- the supply crate --------------------------------------------------------------------
// a small crate, 7 px square: planks, the cross brace, ink round it
function drawCrateAt(x, y) {
  ctx.fillStyle = PT_INK; ctx.fillRect(x - 4, y - 4, 9, 9);
  ctx.fillStyle = PT_WOOD; ctx.fillRect(x - 3, y - 3, 7, 7);
  ctx.fillStyle = PT_WOOD_D;
  ctx.fillRect(x - 3, y - 3, 7, 1); ctx.fillRect(x - 3, y + 3, 7, 1);
  for (let k = -2; k <= 2; k++) { ctx.fillRect(x + k, y + k, 1, 1); ctx.fillRect(x + k, y - k, 1, 1); }
}
// in the air: an arc from its hands to the spot, its shadow on the snow growing as it nears
function drawPortitorAir(ex, ey, now) {
  for (const w of portitorCrates) {
    if (!fogShown(w, now)) continue;
    const k = Math.min(1, w.t / CRATE_T);
    const x = w.ox + (w.x - w.ox) * k, y = w.oy + (w.y - w.oy) * k - Math.sin(Math.PI * k) * 34;
    drawCrateAt(Math.round(x - ex), Math.round(y - ey) - 3);
  }
}
// where it will land: a ring in its side's colour, and the shadow under the crate
function drawPortitorGround(ex, ey, now) {
  for (const w of portitorCrates) {
    if (!fogShown(w, now)) continue;
    const k = Math.min(1, w.t / CRATE_T), x = Math.round(w.x - ex), y = Math.round(w.y - ey);
    drawRing(x, y, CRATE_R, TEAMS[skin(w.team)].mark, 0.5, 0.1 + 0.15 * k);
    const sx = Math.round(w.ox + (w.x - w.ox) * k - ex), sy = Math.round(w.oy + BOW_Y + (w.y - w.oy - BOW_Y) * k - ey), r = 1 + Math.round(3 * k);
    ctx.globalAlpha = 0.3; ctx.fillStyle = PT_INK; ctx.fillRect(sx - r, sy, r * 2 + 1, 1); ctx.globalAlpha = 1;
  }
}
HERO_AIR.push(drawPortitorAir);
HERO_GROUND.push(drawPortitorGround);

// ---- BEDROLL on a body ------------------------------------------------------------------
// an ally mending beside it, or up on its back: two small green crosses rising off them
function drawPortitorMark(e, px, py, w, h, now) {
  if (!(e instanceof Player) || !(e.bedT > 0 || portCarrier(e))) return;
  const t = (now * 1.2) % 1, x = Math.round(px + w / 2), y0 = Math.round(py + 2);
  for (let k = 0; k < 2; k++) {
    const u = (t + k * 0.5) % 1, x1 = x + (k ? 4 : -5), y1 = y0 - Math.round(u * 8);
    if (u > 0.8 && Math.floor(now * 12) % 2) continue;
    ctx.fillStyle = PT_MEND; ctx.fillRect(x1 - 1, y1, 3, 1); ctx.fillRect(x1, y1 - 1, 1, 3);
  }
}
HERO_MARK.push(drawPortitorMark);
