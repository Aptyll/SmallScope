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
function drawVarroMarks(e, px, py, w, h, now) {
  if (!(e.packBy >= 0) || !(state.elapsed < e.packUntil)) return;
  varroPaw(px + (w >> 1), py - 6 - (Math.floor(now * 3) % 2), VARRO_FUR);
}
HERO_MARK.push(drawVarroMarks);

// ---- the spear in his hands -----------------------------------------------------
// HERO_BLADES.spear (js/draw/heroes.js): flat for the side, the swing and the
// wind-up; slanted facing down (the grip at his right hip, the head up past the
// shoulder) or up (rising behind that shoulder)
let varroSpearArt = null;
function varroSpears() {
  return varroSpearArt || (varroSpearArt = { flat: bakeBladeArt(VARRO_SPEAR, VARRO_SPEAR_PAL), diag: bakeBladeArt(VARRO_SPEAR_DIAG, VARRO_SPEAR_PAL) });
}
HERO_BLADES.spear = { art: varroSpears, hilt: [18, 11], hip: { down: [13, 12], up: [11, 10] }, grip: VARRO_GRIP };
