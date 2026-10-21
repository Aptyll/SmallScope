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
// What a hero wears on or around its body beyond its sprite: fn(p, ax, ay, now,
// front), called by drawPlayer (js/draw/bodies.js) once behind the body
// (front false) and once over it (front true); (ax, ay) is the 16 px cell's
// top-left. ARMATOS's standard on his back registers here.
const HERO_BODY_FX = [];
// A shot in flight with a `look` (a hero's thrown thing, a staff's bolt) is drawn
// by HERO_SHOTS[look](a, sx, sy, now) in place of the arrow's shaft
// (drawArrows, js/draw/passes.js); (sx, sy) is its tip on the screen.
const HERO_SHOTS = {};
// A hero whose CLASSES row names a `staff` carries it upright in the leading hand
// in every facing, drawn or not (a mage's staff is held, never swung or aimed):
// HERO_STAVES[name] = { art() -> [frame, frame] canvases (the flame's two beats),
// grip: [x, y] where the hand closes on the art }. Facing left or up it is held in
// the far hand, mirrored, so whatever hangs off it hangs outward.
const HERO_STAVES = {};
function heroStaffOf(p) { const c = CLASSES[p.cls]; return c && c.staff ? HERO_STAVES[c.staff] : null; }
const staffFlips = new Map();
function heroStaff(p, px, py) {
  const s = heroStaffOf(p);
  if (!s) return false;
  const back = p.dir === 'left' || p.dir === 'up';
  let img = s.art()[Math.floor(state.elapsed * 5) % 2];
  if (back) {
    if (!staffFlips.has(img)) {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.scale(-1, 1); g.drawImage(img, -img.width, 0);
      staffFlips.set(img, c);
    }
    img = staffFlips.get(img);
  }
  const gx = back ? img.width - 1 - s.grip[0] : s.grip[0];
  const hx = back ? px + 2 : px + 13, hy = py + 10 - (p.charging ? 1 : 0); // a draw lifts it
  ctx.drawImage(img, Math.round(hx - gx), Math.round(hy - s.grip[1]));
  return true;
}
function heroBodyFx(p, ax, ay, now, front) { for (const f of HERO_BODY_FX) f(p, ax, ay, now, front); }
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
