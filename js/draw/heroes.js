'use strict';
// ------------------------------------------------------------ hero blades
// A named hero's own blade in place of its sword's held art (drawHeldTool,
// js/draw/bodies.js), by the name its CLASSES row gives (`blade`). Each hero's
// draw file registers HERO_BLADES[name] = { art() -> { flat, diag } canvases,
// hilt: [x, y] where the hands close on the flat art (the blade turns about it,
// WEAPON_GRIP's rule), hip: { down, up } where the grip sits on the 16 px cell
// by facing, grip: where the hands close on the slanted grid, and optionally fine() ->
// the same pair at `dens` px a world px for a body drawn fine (bladeArt) }.
const HERO_BLADES = {};
// a grid of palette letters baked to a canvas, once
function bakeBladeArt(rows, pal) { return SPR.bake(rows, pal); } // the shared bake, which keeps the art's pixels (SPR.pixelsOf)
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
// two beats), grip: [x, y] where the hand closes on the art, hold, lean, cast }. `hold` is
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
// a held art mirrored left to right, or top to bottom, baked once (SPR's flips keep its pixels)
const heldFlips = new Map(), heldDrops = new Map();
function heldBaked(cache, img, flip) {
  if (!cache.has(img)) { const f = flip(img); if (img.dens) f.dens = img.dens; cache.set(img, f); }
  return cache.get(img);
}
// true when an art, as drawn, leans left (its top left of its foot), read once off
// its painted pixels, so every staff can be turned to lean the way its holder looks
const heldLeans = new WeakMap();
function heldLeansLeft(img) {
  if (!heldLeans.has(img)) {
    const d = SPR.pixelsOf(img);
    let n = 0, sx = 0, sy = 0, sxy = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (d[(y * img.width + x) * 4 + 3]) { n++; sx += x; sy += y; sxy += x * y; }
    heldLeans.set(img, n > 0 && sxy / n - (sx / n) * (sy / n) > 0);
  }
  return heldLeans.get(img);
}
function heldFlip(img) { return heldBaked(heldFlips, img, SPR.flipH); }
function heldDrop(img) { return heldBaked(heldDrops, img, SPR.flipV); }
// THE CAST POSE, two beats. GATHER: the first half of a key's cast raises the staff
// up and out from the body (STAFF_CAST px, or the row's own `cast`: BUCINA's horn goes
// to her lips, LUCERNA holds her lantern aloft) while the body rises a pixel with it.
// LOOSE: the second half, and the beat a shot leaves the staff, thrusts it the way she
// faces (STAFF_THRUST) with the body leaning in behind it (attackLean,
// js/draw/bodies.js). A draw lifts it 1 px. Drawn only, off the cast and the cycle
// the sim keeps (castT and castMax, nockT).
const STAFF_CAST = { up: 2, out: 1 }; // out 1, so the hand stays on it; a row's own `cast` replaces it
const STAFF_SHOT_T = 1 / 6; // s the staff stays thrust after a shot leaves it (two body frames)
const STAFF_GATHER = 0.5; // the share of a cast spent gathering before the thrust
const STAFF_THRUST = { right: [2, 0], left: [-2, 0], down: [0, 2], up: [0, -1] }; // px; up 1, under the health frame
// 0 carried, 1 gathering, 2 loosing
function staffBeat(p) {
  if (p.castT > 0) return castProg(p) < STAFF_GATHER ? 1 : 2;
  return p.nockT > 0 && attackCycle(p) - p.nockT < STAFF_SHOT_T ? 2 : 0;
}
function staffCasting(p) { return staffBeat(p) > 0; }
function heroStaff(p, px, py) {
  const s = heroStaffOf(p);
  if (!s) return false;
  const busy = p.charging || staffCasting(p); // in use it stands in the leading hand
  let back = p.dir === 'left' || p.dir === 'up';
  if (STAFF_HOLDS[!busy && s.hold || 'lead'].far && p.dir === 'down') back = !back; // side-on it is always out in front
  // whichever hand holds it, it leans the way the face looks (THE GRIP RULE): the
  // art is drawn leaning right, mirrored for a body facing left or away; facing the
  // camera it leans out from the body, so its head never hides behind hers
  let img = s.art()[Math.floor(state.elapsed * 5) % 2];
  const mirror = (p.dir === 'down' ? back : p.dir === 'left' || p.dir === 'up') !== (s.lean ? s.lean === 'left' : heldLeansLeft(img)); // `lean` says it when a thing hung low off the staff would fool the reading
  if (mirror) img = heldFlip(img);
  const gx = mirror ? img.width - 1 - s.grip[0] : s.grip[0];
  const beat = staffBeat(p), use = beat === 1 ? s.cast || STAFF_CAST : null, rc = heroReach(p) + (use ? use.out : 0), th = beat === 2 ? STAFF_THRUST[p.dir] : [0, 0];
  const hx = (back ? px + 2 - rc : px + 13 + rc) + th[0];
  const hy = py + 10 - (use ? use.up : p.charging ? 1 : 0) + th[1]; // a draw lifts it, a cast gathers it up, then looses it forward
  ctx.drawImage(img, Math.round(hx - gx), Math.round(hy - s.grip[1]));
  if (th[0]) heroSleeve(p, px, hy, back ? -1 : 1); // the arm reaches out behind the thrust
  if (p.dir !== 'up') heroFist(p, hx, hy, back ? -1 : 1);
  return true;
}
// the sleeve between a side-on body and a fist thrust out past it: SLEEVE px of the
// side's coat at the fist's height, ink over and under, from the cell's column 12
// (or 3, mirrored) outward
const SLEEVE = 2;
function heroSleeve(p, px, y, out) {
  const set = classSet(p), x0 = Math.round(out > 0 ? px + 12 : px + 4 - SLEEVE), y0 = Math.round(y) - FIST + 1;
  ctx.fillStyle = set.ink; ctx.fillRect(x0, y0 - 1, SLEEVE, FIST + 2);
  ctx.fillStyle = set.sleeve; ctx.fillRect(x0, y0, SLEEVE, FIST);
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
  const fine = bodySet(p);
  if (fine.dens > 1) { heroFistFine(fine, Math.round(x), Math.round(y), out); return; }
  const set = classSet(p), gx = Math.round(x), gy = Math.round(y);
  const x0 = out > 0 ? gx - FIST + 1 : gx, y0 = gy - FIST + 1;
  ctx.fillStyle = set.ink;
  ctx.fillRect(out > 0 ? x0 + FIST : x0 - 1, y0, 1, FIST + 1); // the outer edge
  ctx.fillRect(x0, y0 + FIST, FIST, 1);                         // under the knuckles
  ctx.fillStyle = set.hand;
  ctx.fillRect(x0, y0, FIST, FIST);
}
// ...and a body drawn fine's (bodySet, `dens` art px a world px): the same fist on the art's
// own px, FIST_FINE of them square, its edge one art px, so the hand is the
// body's pixel size; it closes on the same grip (its far corner where the coarse one's is)
const FIST_FINE = 3;
function heroFistFine(set, gx, gy, out) {
  const u = 1 / set.dens, f = FIST_FINE * u;
  const x0 = out > 0 ? gx + 1 - f : gx, y0 = gy + 1 - f;
  ctx.fillStyle = set.ink;
  ctx.fillRect(out > 0 ? x0 + f : x0 - u, y0, u, f + u); // the outer edge
  ctx.fillRect(x0, y0 + f, f, u);                         // under the knuckles
  ctx.fillStyle = set.hand;
  ctx.fillRect(x0, y0, f, f);
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
function heroBlade(p) { const b = attackOf(p).cut ? heroBladeOf(p) : null; return b ? { img: bladeArt(p, b).flat, grip: b.hilt } : null; }
// a blade row's art for this body: its finer pair (`fine`, the art at `dens` px a world px,
// its grips still in world px) for a body drawn fine (bodySet), else its own
function bladeArt(p, b) { return b.fine && bodySet(p).dens > 1 ? b.fine() : b.art(); }
// an art's size in world px: a finer one's (`dens`) at 1/dens
function heldW(img) { return img.width / (img.dens || 1); }
function heldH(img) { return img.height / (img.dens || 1); }
// A shot weapon with its own DRAWN aim frames (a bow's string and arrow, a knife cocked
// back): HERO_AIMED[art] = fn(heading, step, p) -> { img, grip, hand }. `heading` is the aim
// snapped to eight, 0..7 clockwise from +x (aimHeading); `step` is 0 the beat after the shot
// has left (AIMED_LOOSE_T), 1 half drawn, 2 full drawn. `img` may be null (an empty hand);
// `hand` is where the fist is, px from the chest. heroAimed (js/draw/bodies.js) is the one
// place every drawn-heading aim is resolved: these rows, and a rigid weapon's slanted grid
// (SPRITES.weaponDiag) where a hero has no row.
const HERO_AIMED = {};
const AIMED_LOOSE_T = 1 / 6; // s the weapon stays up on the aim after its shot (two body frames)
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
//   shoulder  over the shoulder (an axe's head rides there): behind the head facing
//             down or up, forward over the shoulder side-on
//   rest      the head down on the snow beside the foot, the haft up in the hand,
//             facing down or up; side-on it is carried slanted
//   low       point down and out from the fist at the hip (a short blade held the
//             knife fighter's way)
// Every one is the row's own drawn slanted grid, mirrored left to right or top to
// bottom; none rises past the head, where the health frame sits. Side-on every
// one leans the way the face looks (THE GRIP RULE, heroFist).
const BLADE_HOLDS = { slant: {}, far: { far: true }, shoulder: { shoulder: true }, rest: { rest: true }, low: { low: true } };
// the carried blade in drawHeldTool's pass (`back`: behind the body); true when
// this hero holds it its own way in this facing, drawn in this pass or the other
function heroCarry(p, px, py, back) {
  const pass = (p.dir === 'up') === back; // a carried thing is behind a body facing away
  const b = heroBladeOf(p);
  if (b && b.hip.down && attackOf(p).cut) {
    const hold = BLADE_HOLDS[b.hold || 'slant'], img = bladeArt(p, b).diag, up = p.dir === 'up';
    const rc = heroReach(p);
    const lead = p.dir === 'down' || p.dir === 'right'; // the leading hand is on the right
    // (ax, ay) the grip on the screen; `out` the blade runs right of it
    const put = (im, out, ax, ay, gy) => ctx.drawImage(im, Math.round(ax - (out ? b.grip[0] : heldW(img) - 1 - b.grip[0])), Math.round(ay - gy), heldW(im), heldH(im));
    if (hold.shoulder) {
      if (back === up) return true; // behind the head; over the back of a body facing away
      const sx = lead ? px + 13 + rc : px + 2 - rc;
      // the haft leans the way the face looks, the head forward over the shoulder; facing
      // the screen the head stands clear beside his own, never hidden behind it
      const m = p.dir === 'left';
      put(m ? heldFlip(img) : img, !m, sx, py + 9, b.grip[1]);
      heroFist(p, sx, py + 9, lead ? 1 : -1);
    } else if (hold.rest && (p.dir === 'down' || p.dir === 'up')) { // side-on it is carried slanted like any haft
      if (!pass) return true;
      const sx = lead ? px + 13 + rc : px + 2 - rc;
      put(lead ? heldDrop(img) : heldFlip(heldDrop(img)), lead, sx, py + 9, heldH(img) - 1 - b.grip[1]);
      heroFist(p, sx, py + 9, lead ? 1 : -1);
    } else {
      if (!pass) return true;
      const at = up ? b.hip.up : b.hip.down;
      const out = up ? true : hold.far && p.dir === 'down' ? false : lead;
      const sx = out ? px + at[0] + rc : px + 15 - at[0] - rc;
      const im = hold.low ? heldDrop(img) : img; // the point down
      put(out ? im : heldFlip(im), out, sx, py + at[1], hold.low ? heldH(img) - 1 - b.grip[1] : b.grip[1]);
      if (!up) heroFist(p, sx, py + at[1], out ? 1 : -1); // facing away the hand is the body's far side
    }
    return true;
  }
  if (!pass) return false;
  for (const f of HERO_CARRY) if (f(p, px, py)) return true;
  return false;
}
