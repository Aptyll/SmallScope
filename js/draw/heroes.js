'use strict';
// ------------------------------------------------------------ hero blades
// A named hero's own blade in place of its sword's held art (drawHeldTool,
// js/draw/bodies.js), by the name its CLASSES row gives (`blade`). Each hero's
// draw file registers HERO_BLADES[name] = { art() -> { flat, diag } canvases,
// hilt: [x, y] where the hands close on the flat art (the blade turns about it,
// WEAPON_GRIP's rule), hip: { down, up } where the grip sits on the 16 px cell
// by facing, grip: where the hands close on the slanted grid }.
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
// A hero whose CLASSES row names a `staff` carries it in every facing, drawn or not
// (a mage's staff is held, never swung or aimed):
// HERO_STAVES[name] = { art() -> [frame, frame] canvases (the flame's two beats),
// grip: [x, y] where the hand closes on the art, hold }. `hold` is how THIS hero
// carries it at rest, so two staff heroes are two shapes on the snow
// (STAFF_HOLDS; none is 'lead'). A draw or a cast brings any hold upright into the
// leading hand: the staff coming forward is part of the tell.
const HERO_STAVES = {};
// the holds: upright in the leading hand (facing left or up that is the far hand,
// mirrored, so whatever hangs off it hangs outward), upright in the other hand,
// level behind the shoulders, level at the hip. The level ones are the upright
// art a quarter turn over, head toward the leading hand: every pixel the drawn one.
const STAFF_HOLDS = { lead: { far: false }, far: { far: true }, yoke: { level: 7 }, hip: { level: 9 } };
// A hero its own kit hides draws see-through for the screens that still see it
// (its own side): HERO_FADE fns(p) -> alpha 0..1, the lowest wins (NIX in her cloud).
const HERO_FADE = [];
function heroFade(p) { let a = 1; for (const f of HERO_FADE) a = Math.min(a, f(p)); return a; }
function heroStaffOf(p) { const c = CLASSES[p.cls]; return c && c.staff ? HERO_STAVES[c.staff] : null; }
// a staff frame mirrored, or laid a quarter turn over (its head to the right), baked once
const staffFlips = new Map(), staffTurns = new Map();
function staffBaked(cache, img, w, h, lay) {
  if (!cache.has(img)) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    lay(c.getContext('2d')); cache.set(img, c);
  }
  return cache.get(img);
}
function staffFlip(img) { return staffBaked(staffFlips, img, img.width, img.height, (g) => { g.scale(-1, 1); g.drawImage(img, -img.width, 0); }); }
function staffTurn(img) { return staffBaked(staffTurns, img, img.height, img.width, (g) => { g.translate(img.height, 0); g.rotate(Math.PI / 2); g.drawImage(img, 0, 0); }); }
function heroStaff(p, px, py) {
  const s = heroStaffOf(p);
  if (!s) return false;
  const busy = p.charging || p.castT > 0; // in use it stands in the leading hand
  const hold = STAFF_HOLDS[!busy && s.hold || 'lead'];
  let back = p.dir === 'left' || p.dir === 'up';
  let img = s.art()[Math.floor(state.elapsed * 5) % 2];
  if (hold.level != null) {
    // level across the body, which draws over its middle: the grip on the
    // body's centre line, the head out past the leading arm
    let t = staffTurn(img);
    if (back) t = staffFlip(t);
    const gx = back ? s.grip[1] : t.width - 1 - s.grip[1];
    ctx.drawImage(t, px + 8 - gx, py + hold.level - s.grip[0]);
    return true;
  }
  if (hold.far) back = !back;
  if (back) img = staffFlip(img);
  const gx = back ? img.width - 1 - s.grip[0] : s.grip[0];
  const hx = back ? px + 2 : px + 13, hy = py + 10 - (p.charging ? 1 : 0); // a draw lifts it
  ctx.drawImage(img, Math.round(hx - gx), Math.round(hy - s.grip[1]));
  return true;
}
function heroBodyFx(p, ax, ay, now, front) { for (const f of HERO_BODY_FX) f(p, ax, ay, now, front); }
// A hero that is, for a while, not its body at all: fn(p, px, py, now) -> true
// when it drew what stands there in its place (the held tool and the body's
// sprite are skipped; the marks over the body still draw). (px, py) is the
// 16 px cell's top-left. RUPES's AVALANCHE rolls as a snowball here.
const HERO_BODY_DRAW = [];
function heroBodyDraw(p, px, py, now) { for (const f of HERO_BODY_DRAW) if (f(p, px, py, now)) return true; return false; }
function heroBladeOf(p) { const c = CLASSES[p.cls]; return c && c.blade ? HERO_BLADES[c.blade] : null; }
// the blade a hero's hands hold in place of its sword's own art and where the
// hands close on it ({ img, grip }), or null
function heroBlade(p) { const b = attackOf(p).cut ? heroBladeOf(p) : null; return b ? { img: b.art().flat, grip: b.hilt } : null; }
// A hero's own way of carrying its weapon at rest facing down or up, where the
// level carry would not read: HERO_CARRY fns(p, px, py) -> true once drawn
// (SAGITTA's crossbow on her shoulder); (px, py) is the 16 px cell's top-left.
const HERO_CARRY = [];
// the carried blade facing down or up; false where the side's level carry stands
function heroCarry(p, px, py) {
  for (const f of HERO_CARRY) if (f(p, px, py)) return true;
  const b = heroBladeOf(p), at = b && b.hip[p.dir];
  if (!at || !attackOf(p).cut) return false;
  ctx.drawImage(b.art().diag, Math.round(px + at[0] - b.grip[0]), Math.round(py + at[1] - b.grip[1]));
  return true;
}
