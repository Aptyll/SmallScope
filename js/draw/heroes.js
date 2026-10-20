'use strict';
// ------------------------------------------------------------ hero blades
// A named hero's own blade in place of its sword's held art (drawHeldTool,
// js/draw/bodies.js), by the name its CLASSES row gives (`blade`). Each hero's
// draw file registers HERO_BLADES[name] = { art() -> { flat, diag } canvases,
// hip: { down, up } where the grip sits on the 16 px cell by facing, grip:
// where the hands close on the slanted grid }.
const HERO_BLADES = {};
// a grid of palette letters baked to a canvas, once
function bakeBladeArt(rows, pal) {
  const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = pal[r[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  return c;
}
function heroBladeOf(p) { const c = CLASSES[p.cls]; return c && c.blade ? HERO_BLADES[c.blade] : null; }
// the blade a hero's hands hold in place of its sword's own art, or null
function heroBlade(p) { const b = attackOf(p).cut ? heroBladeOf(p) : null; return b ? b.art().flat : null; }
// the carried blade facing down or up; false where the side's level carry stands
function heroCarry(p, px, py) {
  const b = heroBladeOf(p), at = b && b.hip[p.dir];
  if (!at || !attackOf(p).cut) return false;
  ctx.drawImage(b.art().diag, Math.round(px + at[0] - b.grip[0]), Math.round(py + at[1] - b.grip[1]));
  return true;
}
