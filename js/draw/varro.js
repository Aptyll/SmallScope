'use strict';
// ------------------------------------------------------------ varro
// VARRO's pixels (his rules: js/sim/varro.js): LUNGE's mark over whoever wears
// it, seen by both sides; and the HUNTING SPEAR in his hands.

const VARRO_INK = '#141a2c', VARRO_FUR = '#cfd8e8';

// a 5 px paw print, its pad's centre at (x, y)
function varroPaw(x, y, col) {
  ctx.fillStyle = VARRO_INK;
  ctx.fillRect(x - 2, y - 1, 5, 4); ctx.fillRect(x - 3, y - 3, 7, 2);
  ctx.fillStyle = col;
  ctx.fillRect(x - 1, y, 3, 2);
  ctx.fillRect(x - 2, y - 2, 1, 1); ctx.fillRect(x, y - 3, 1, 1); ctx.fillRect(x + 2, y - 2, 1, 1);
}
// over a body (HERO_MARK, js/sim/heroes.js), in its own box at (px, py), w x h:
// a paw over the head of a body he marked (his called wolves wear their side's
// bar instead: drawBeastFrame, js/draw/bodies.js)
// (HERO_OVER: in the row over its stack, never on the head under the frame)
HERO_OVER.push({
  w: (e) => (e.packBy >= 0 && state.elapsed < e.packUntil ? 7 : 0),
  draw: (e, x, y, now) => varroPaw(x + 3, y - (Math.floor(now * 3) % 2), VARRO_FUR),
});

// ---- the spear in his hands -----------------------------------------------------
// HERO_BLADES.spear (js/draw/heroes.js): flat for the side, the swing and the
// wind-up; slanted facing down (the grip at his right hip, the head up past the
// shoulder) or up (rising behind that shoulder)
let varroSpearArt = null;
function varroSpears() {
  return varroSpearArt || (varroSpearArt = { flat: bakeBladeArt(VARRO_SPEAR, VARRO_SPEAR_PAL), diag: bakeBladeArt(VARRO_SPEAR_DIAG, VARRO_SPEAR_PAL) });
}
// ...and at 32 px for his fine body (VARRO_SPEAR_FINE), the grips the same world px
let varroSpearFine = null;
function varroSpearsFine() {
  if (varroSpearFine) return varroSpearFine;
  const tag = (c) => { c.dens = 2; return c; };
  return (varroSpearFine = { flat: tag(bakeBladeArt(VARRO_SPEAR_FINE, VARRO_SPEAR_PAL)), diag: tag(bakeBladeArt(VARRO_SPEAR_DIAG_FINE, VARRO_SPEAR_PAL)) });
}
HERO_BLADES.spear = { smear: 'thrust', art: varroSpears, fine: varroSpearsFine, hilt: [18, 11], hip: { down: [13, 11], up: [11, 10] }, grip: VARRO_GRIP };

// ---- HOWL -----------------------------------------------------------------------------
// No ring and no warning on the snow: his head goes up (the row's pose), and
// the howl lands as the snow round him blown flat - spokes of spray racing
// out from his feet to the reach, a clod thrown at each tip - so how far it
// carried is written on the ground for a beat after.
const HOWL_SPOKES = 16;
function drawHowlFx(f, px, py, now) {
  const life = f.life || HOWL_FX_LIFE, u = f.t / life;
  const go = Math.min(1, u / 0.4 * (2 - u / 0.4)); // out fast, then held
  ctx.globalAlpha = Math.min(1, 2.4 * (1 - u));
  for (let i = 0; i < HOWL_SPOKES; i++) {
    const a = i * Math.PI * 2 / HOWL_SPOKES + Math.sin(i * 7.3) * 0.15;
    const tip = HOWL_R * go * (0.7 + 0.3 * Math.abs(Math.sin(i * 3.1)));
    const tail = Math.max(9, tip - 18); // a streak of spray, not a spoke from his feet
    const ca = Math.cos(a), sa = Math.sin(a), y0 = py + 2;
    for (let s = tail; s < tip; s += 1) {
      const x = Math.round(px + ca * s), y = Math.round(y0 + sa * s);
      const head = s > tip - 7;
      ctx.fillStyle = '#9fb6d8'; ctx.fillRect(x, y + 1, 1, 1); // its shadow on the snow
      ctx.fillStyle = head ? '#ffffff' : '#e6eefa'; ctx.fillRect(x, y, head ? 2 : 1, 1);
    }
    for (let k = 0; k < 2; k++) { // clods thrown on past it
      const s = tip + 3 + k * 5 + u * 10;
      const x = Math.round(px + ca * s + Math.sin(i + k) * 2), y = Math.round(y0 + sa * s);
      ctx.fillStyle = VARRO_INK; ctx.fillRect(x, y + 1, 2, 1);
      ctx.fillStyle = '#f4f7ff'; ctx.fillRect(x, y, 2, 1);
    }
  }
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.howl = drawHowlFx;
