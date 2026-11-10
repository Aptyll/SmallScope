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
// A hero whose CLASSES row names a `staff` carries it upright, its foot by the
// hero's own, in every facing, drawn or not (a mage's staff is held, never swung
// or aimed): HERO_STAVES[name] = { art() -> [frame, frame] canvases (the flame's
// two beats), grip: [x, y] where the hand closes on the art, hold }. `hold` is
// which hand THIS hero carries it in at rest (STAFF_HOLDS; none is 'lead'), so two
// staff heroes side by side are not one shape. A draw or a cast brings it into the
// leading hand: the staff coming across is part of the tell.
const HERO_STAVES = {};
// the leading hand (facing left or up that is the far hand, mirrored, so whatever
// hangs off the staff hangs outward) or the other one
const STAFF_HOLDS = { lead: { far: false }, far: { far: true } };
// A hero its own kit hides draws see-through for the screens that still see it
// (its own side): HERO_FADE fns(p) -> alpha 0..1, the lowest wins (NIX in her cloud).
const HERO_FADE = [];
function heroFade(p) { let a = 1; for (const f of HERO_FADE) a = Math.min(a, f(p)); return a; }
function heroStaffOf(p) { const c = CLASSES[p.cls]; return c && c.staff ? HERO_STAVES[c.staff] : null; }
// a held art mirrored left to right, or top to bottom, baked once
const heldFlips = new Map(), heldDrops = new Map();
function heldBaked(cache, img, lay) {
  if (!cache.has(img)) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    lay(c.getContext('2d')); cache.set(img, c);
  }
  return cache.get(img);
}
function heldFlip(img) { return heldBaked(heldFlips, img, (g) => { g.scale(-1, 1); g.drawImage(img, -img.width, 0); }); }
function heldDrop(img) { return heldBaked(heldDrops, img, (g) => { g.scale(1, -1); g.drawImage(img, 0, -img.height); }); }
// THE CAST POSE: a key's cast, and the beat a shot leaves the staff, raise it
// up and out from the body (STAFF_RAISE, STAFF_OUT px) while the body rises a
// pixel with it (attackLean, js/draw/bodies.js); a draw lifts it 1 px. Drawn
// only, off the cast and the cycle the sim keeps (castT, nockT).
const STAFF_RAISE = 2, STAFF_OUT = 1; // out 1, so the hand stays on it
const STAFF_SHOT_T = 1 / 6; // s the staff stays raised after a shot leaves it (two body frames)
function staffCasting(p) { return p.castT > 0 || (p.nockT > 0 && attackCycle(p) - p.nockT < STAFF_SHOT_T); }
function heroStaff(p, px, py) {
  const s = heroStaffOf(p);
  if (!s) return false;
  const busy = p.charging || staffCasting(p); // in use it stands in the leading hand
  let back = p.dir === 'left' || p.dir === 'up';
  if (STAFF_HOLDS[!busy && s.hold || 'lead'].far) back = !back;
  let img = s.art()[Math.floor(state.elapsed * 5) % 2];
  if (back) img = heldFlip(img);
  const gx = back ? img.width - 1 - s.grip[0] : s.grip[0];
  const up = staffCasting(p), rc = heroReach(p) + (up ? STAFF_OUT : 0);
  const hx = back ? px + 2 - rc : px + 13 + rc, hy = py + 10 - (up ? STAFF_RAISE : p.charging ? 1 : 0); // a draw lifts it, a cast or a shot raises it
  ctx.drawImage(img, Math.round(hx - gx), Math.round(hy - s.grip[1]));
  if (p.dir !== 'up') heroFist(p, hx, hy, back ? -1 : 1);
  return true;
}
// A look on a larger cell stands taller and wider than the 16 px one every offset
// here was first set for: `heroRise` rows over it (the overhead frame lifts by
// as much), a hand `heroReach` px further out from the body's middle.
function heroRise(p) { return classSet(p).rise || 0; }
function heroReach(p) { return classSet(p).reach || 0; }
// THE GRIP RULE: whatever a hero carries, a hand is seen closed on it. The
// fist is drawn over the weapon at its grip, (x, y) on the screen, reaching
// one pixel back toward the body so it closes the sleeve's end: FIST px square
// in the look's hand colour, its outline on the side away from the body and
// under it (`out` +1 when the grip is right of the body, -1 left of it).
const FIST = 2;
function heroFist(p, x, y, out) {
  const set = classSet(p), gx = Math.round(x), gy = Math.round(y);
  const x0 = out > 0 ? gx - FIST + 1 : gx, y0 = gy - FIST + 1;
  ctx.fillStyle = set.ink;
  ctx.fillRect(out > 0 ? x0 + FIST : x0 - 1, y0, 1, FIST + 1); // the outer edge
  ctx.fillRect(x0, y0 + FIST, FIST, 1);                         // under the knuckles
  ctx.fillStyle = set.hand;
  ctx.fillRect(x0, y0, FIST, FIST);
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
// A hero's own way of carrying its weapon at rest, where a blade row's hold would
// not read: HERO_CARRY fns(p, px, py) -> true once drawn (SAGITTA's crossbow on
// her shoulder); (px, py) is the 16 px cell's top-left.
const HERO_CARRY = [];
// HOW A BLADE IS HELD AT REST. A HERO_BLADES row with a slanted grid (`hip.down`)
// holds it the same way in EVERY facing, so a hero keeps one shape as it turns
// and nothing heavy is ever held out level at arm's length. Its `hold` names how
// (none is 'slant'):
//   slant     up and out from the leading hand, at the ready
//   far       the same in the other hand facing down
//   shoulder  back over the shoulder, behind the head (an axe's head rides there)
//   rest      the head down on the snow beside the foot, the haft up in the hand
// Every one is the row's own drawn slanted grid, mirrored left to right or top to
// bottom; none rises past the head, where the health frame sits.
const BLADE_HOLDS = { slant: {}, far: { far: true }, shoulder: { shoulder: true }, rest: { rest: true } };
// the carried blade in drawHeldTool's pass (`back`: behind the body); true when
// this hero holds it its own way in this facing, drawn in this pass or the other
function heroCarry(p, px, py, back) {
  const pass = (p.dir === 'up') === back; // a carried thing is behind a body facing away
  const b = heroBladeOf(p);
  if (b && b.hip.down && attackOf(p).cut) {
    const hold = BLADE_HOLDS[b.hold || 'slant'], img = b.art().diag, up = p.dir === 'up';
    const rc = heroReach(p);
    const lead = p.dir === 'down' || p.dir === 'right'; // the leading hand is on the right
    // (ax, ay) the grip on the screen; `out` the blade runs right of it
    const put = (im, out, ax, ay, gy) => ctx.drawImage(im, Math.round(ax - (out ? b.grip[0] : img.width - 1 - b.grip[0])), Math.round(ay - gy));
    if (hold.shoulder) {
      if (back === up) return true; // behind the head; over the back of a body facing away
      const sx = lead ? px + 13 + rc : px + 2 - rc;
      put(lead ? heldFlip(img) : img, !lead, sx, py + 9, b.grip[1]);
      heroFist(p, sx, py + 9, lead ? 1 : -1);
    } else if (hold.rest) {
      if (!pass) return true;
      const sx = lead ? px + 13 + rc : px + 2 - rc;
      put(lead ? heldDrop(img) : heldFlip(heldDrop(img)), lead, sx, py + 9, img.height - 1 - b.grip[1]);
      heroFist(p, sx, py + 9, lead ? 1 : -1);
    } else {
      if (!pass) return true;
      const at = up ? b.hip.up : b.hip.down;
      const out = up ? true : hold.far && p.dir === 'down' ? false : lead;
      const sx = out ? px + at[0] + rc : px + 15 - at[0] - rc;
      put(out ? img : heldFlip(img), out, sx, py + at[1], b.grip[1]);
      if (!up) heroFist(p, sx, py + at[1], out ? 1 : -1); // facing away the hand is the body's far side
    }
    return true;
  }
  if (!pass) return false;
  for (const f of HERO_CARRY) if (f(p, px, py)) return true;
  return false;
}
