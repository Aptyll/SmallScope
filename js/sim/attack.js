'use strict';
// The left button: every hero's BASIC ATTACK, League's way - one weapon that
// belongs to the hero's kit, the same every match, never found, bought or
// swapped. What a hero's attack IS lives on its CLASSES row (`attack`,
// js/sim/player.js); this file is how any attack picks its mark, winds up,
// lands and times itself.
// Loads after js/sim/actions.js: a shot rides the arrow pipeline and reads its
// tuning (BOW_Y) at runtime.
// ------------------------------------------------------------ basic attack
// An `attack` row:
//   name    what the wiki and the tooltip call the weapon
//   art     the weapon in the hand (SPRITES.weaponArt / weaponHeld, js/sprites/weapons.js)
//   as      base attacks a second (ATTACK SPEED's level-1 number, classAs)
//   range   px from the hero's centre to the target's edge it lands from
//   wind    the share of each attack spent winding up before the blow leaves
//   shot    { speed px/s, col, look }: a ranged attack, a missile that flies
//           at its mark and cannot miss it, or
//   cut     { half rad }: a melee attack, a blow that lands on the frame the
//           wind-up ends; `half` is only the arc the hand swings through
// The damage is the hero's DAMAGE stat (statOf, js/sim/stats.js), always.
//
// THE ATTACK, League's: a player (or a bot) names a MARK in `p.input.atk` -
// a rival body or a rival building, never a point. While that mark is good
// (atkGood) and inside the weapon's range (atkIn), and the feet are still,
// the hero winds up (p.charging, p.chargeT over atkWind) facing it; the wind-up's
// end lands the blow (basicAttack) and the attack's clock (p.nockT) runs
// out the rest of the attack. Walking during the wind-up CANCELS it and costs
// nothing - the League rhythm of "stop, hit, step" - and walking after the
// blow has left is free. A blade lands its blow on that frame; a shot flies
// to the mark and lands on arrival (the arrow loop, js/sim/sim.js), so a
// ranged attack can be outrun but never sidestepped, and a roll's i-frames
// let it pass. Nothing a basic attack lands shoves anything.
function attackOf(p) { return CLASSES[p.cls].attack; }
// one whole attack for THIS player right now: one over ATTACK SPEED (the
// wind-up and the rest after the blow, together)
function attackCycle(p) { return 1 / Math.max(0.1, statOf(p, 'as')); }
// seconds of wind-up before the blow leaves: the weapon's share of the cycle,
// so ATTACK SPEED quickens the wind-up with the rest of the attack
function atkWind(p) { return attackOf(p).wind * attackCycle(p); }
// ...and the rest of it, after the blow leaves: what p.nockT counts down from,
// so every readout of the attack's clock divides by this (and atkSince is
// how long ago the blow left, for a pose drawn off it)
function atkRest(p) { return Math.max(0.01, attackCycle(p) - atkWind(p)); }
function atkSince(p) { return atkRest(p) - p.nockT; }
// (the readers that still say "draw": the wind-up IS the draw - the bow
// coming back, the blade cocked - so every pose already drawn off it reads
// the wind-up for free)
function drawTime(p) { return atkWind(p); }
function drawPow(p) { return Math.min(1, Math.max(0, p.chargeT / drawTime(p))); }
// what one attack lands for: the DAMAGE stat and the kit's speed bonus on a
// body that is moving
function attackDmg(p) {
  const kit = kitOf(p);
  const spdBonus = kit.spdDmg * Math.min(1, Math.hypot(p.vx, p.vy) / 200);
  return Math.round(statOf(p, 'dmg') + spdBonus);
}

// ---- the mark ------------------------------------------------------------
const ATK_LEASH = 6;  // px past the range a wind-up already begun still lands from
// a building as a mark: the anchor while it still stands
function atkIsStruct(t) { return !!t && t.tx !== undefined && !!STRUCTS[t.type]; }
function atkStands(t) { return inWorld(t.tx, t.ty) && structOf(objAt(t.tx, t.ty)) === t && t.hp > 0; }
// ...and the rival bird on its roost, the match's objective: struck like a
// body, its nerve chipped EAGLE_ARROW_DMG a blow whatever the weapon (hurtEagle)
function atkIsEagle(t) { return !!state.drop && state.drop.eagles.includes(t); }
function atkEagleUp(p, e) { return e.state === 'down' && !state.eagleCine && (!p || e.team !== p.team); }
// Can p attack t at all right now: a rival body its side can see, or a
// rival building still standing. Every picker asks this - the sim before a
// wind-up, the pointer before a lock, a bot before it names a mark.
function atkGood(p, t) {
  if (!t) return false;
  if (atkIsStruct(t)) return structFoe(p, t) && atkStands(t);
  if (atkIsEagle(t)) return atkEagleUp(p, t);
  if (t.tx !== undefined && t.type !== undefined) return false; // a tile's thing (a pine, a rock) is work, never a mark
  return unitFoe(p, t) && inSight(p.team, t);
}
// px from p to the mark's edge: a body's centre less its radius, a
// building's nearest footprint point
function atkGap(p, t) {
  if (atkIsStruct(t)) {
    const x0 = t.tx * TILE, y0 = t.ty * TILE, x1 = x0 + structW(t) * TILE, y1 = y0 + structH(t) * TILE;
    const dx = Math.max(x0 - p.x, 0, p.x - x1), dy = Math.max(y0 - p.y, 0, p.y - y1);
    return Math.hypot(dx, dy);
  }
  if (atkIsEagle(t)) return Math.max(0, Math.hypot(t.x - p.x, t.y - p.y) - EAGLE_TILE_R * TILE);
  return Math.max(0, Math.hypot(t.x - p.x, t.y - p.y) - unitRadius(t));
}
function atkIn(p, t, slack) { return atkGap(p, t) <= attackOf(p).range + (slack || 0); }
// where on the mark a blow is aimed: a body's middle, a building's centre
function atkPt(t) {
  if (atkIsStruct(t)) { const c = structCenter(t); return { x: c.x, y: c.y - 4 }; }
  if (atkIsEagle(t)) return { x: t.x, y: t.y - 8 };
  return { x: t.x, y: unitMidY(t) };
}

// ---- the step ------------------------------------------------------------
// One step of the attack for every player alike (playerAttack, js/sim/sim.js):
// the wind-up starts, runs, cancels or lands. `free` is whether the hands are
// (no cast, no roll, no fall, no cable).
function attackStep(p, dt, free) {
  const inp = p.input, t = inp.atk;
  const still = !inp.mx && !inp.my;
  if (p.charging) {
    // a wind-up ends early - and costs nothing - when the feet move, the
    // hands are wanted, or the mark is gone, swapped or out of reach
    if (!free || !still || t !== p.atkOn || !atkGood(p, t) || !atkIn(p, t, ATK_LEASH)) { atkCancel(p); return; }
    p.chargeT += dt;
    atkFace(p, t);
    if (p.chargeT >= atkWind(p)) {
      p.charging = false;
      basicAttack(p, t);
      p.chargeT = 0;
      p.nockT = atkRest(p);
    }
    return;
  }
  if (!free || !still || p.nockT > 0 || !atkGood(p, t) || !atkIn(p, t)) return;
  p.charging = true; p.chargeT = 0; p.atkOn = t;
  breakRecall(p); // an attack ends the walk home, League's way (js/sim/recall.js)
  atkFace(p, t);
}
function atkCancel(p) { p.charging = false; p.chargeT = 0; p.atkOn = null; }
// turned to the mark, and the hands' aim on it (p.aimA: drawHeldTool, js/draw/bodies.js)
function atkFace(p, t) {
  const q = atkPt(t);
  faceToward(p, q.x - p.x, q.y - p.y, true);
  p.aimA = Math.atan2(q.y - (p.y - BOW_Y), q.x - p.x);
}

// ---- the blow ------------------------------------------------------------
// The wind-up's end, for every player alike: a blade lands now, a shot leaves.
function basicAttack(p, t) {
  const A = attackOf(p);
  if (A.cut) cutAttack(p, A, t);
  else { shootAttack(p, A, t); sfxAt('arrow', p.x, p.y); }
}

// ---- the shot ------------------------------------------------------------
// One missile at the mark from the hands (BOW_Y above the feet). It flies at
// where the mark IS every step (`homing`, the arrow loop) and lands only on it.
function shootAttack(p, A, t) {
  const q = atkPt(t);
  const dx = q.x - p.x, dy = q.y - (p.y - BOW_Y);
  const a = Math.atan2(dy, dx);
  const spd = A.shot.speed;
  arrows.push({
    x: p.x, y: p.y - BOW_Y,
    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
    t: 0, life: 6, dmg: attackDmg(p), pow: 1,
    owner: p.id, team: p.team, homing: t,
    solid: true, kb: 0, col: A.shot.col, basic: true, look: A.shot.look, // `look`: drawn as a hero's own shot (HERO_SHOTS, js/draw/heroes.js)
    ang: a, spd, ox: p.x, oy: p.y - BOW_Y,
  });
  passiveShot(p, arrows[arrows.length - 1]); // a hero's passive may make more of it (HERO_PASSIVE shot, js/sim/heroes.js)
}
// One step of a homing shot (the arrow loop, js/sim/sim.js): turned onto
// the mark, and true on the step it arrives. A mark that died or went into
// the fog ends the shot where it is (`gone`).
function homingStep(a, dt) {
  const t = a.homing;
  if (atkIsStruct(t) ? !atkStands(t) : atkIsEagle(t) ? !atkEagleUp(null, t) : !unitAlive(t)) return 'gone';
  const q = atkPt(t);
  const dx = q.x - a.x, dy = q.y - a.y, d = Math.hypot(dx, dy) || 1;
  const step = a.spd * dt;
  a.ang = Math.atan2(dy, dx);
  a.vx = dx / d * a.spd; a.vy = dy / d * a.spd;
  if (d <= step + 2) { a.x = q.x; a.y = q.y; return 'hit'; }
  a.x += a.vx * dt; a.y += a.vy * dt;
  return null;
}
// what a homing shot does on arrival: the one blow, to the one mark
function homingLand(a) {
  const t = a.homing, src = players[a.owner];
  if (atkIsStruct(t)) { if (structFoe(sideOf(a), t)) hurtStruct(t, Math.round(a.dmg * (a.siege || 1)), src); return; }
  if (atkIsEagle(t)) { if (t.team !== a.team) hurtEagle(t, EAGLE_ARROW_DMG, src, a.x, a.y + 8); return; }
  if (t.invuln > 0) return; // a roll's i-frames let it pass
  const d = Math.hypot(a.vx, a.vy) || 1;
  hurtUnit(t, a.dmg, a.vx / d, a.vy / d, src, { kb: 0, kbMul: 0, basic: true, ab: a.ab, burn: a.burn, slow: a.slow });
  a.struck = true;
  heroShotHit(a, t, a.vx / d, a.vy / d); // what a hero's shot does once it lands (HERO_SHOT_HIT, js/sim/heroes.js)
}

// ---- the cut -------------------------------------------------------------
// A blade's blow: the mark takes it on the wind-up's last frame. The hand
// swings the blade across `half` either side of the mark (p.slashT, drawn by
// drawHeldTool) and the sweep it leaves in the air is the weapon family's own
// (`slashes`, drawSlashes, js/draw/abilities.js).
const SLASH_T = 0.28; // s the sweep lives - and the hand swings the blade through it
const slashes = [];   // {x, y, a, r, half, t, hit, blade}
function cutAttack(p, A, t) {
  const q = atkPt(t);
  const a = Math.atan2(q.y - (p.y - BOW_Y), q.x - p.x);
  const dmg = attackDmg(p);
  if (atkIsStruct(t)) hurtStruct(t, dmg, p);
  else if (atkIsEagle(t)) hurtEagle(t, EAGLE_ARROW_DMG, p, q.x, q.y + 8);
  else {
    const d = Math.hypot(t.x - p.x, t.y - p.y) || 1;
    hurtUnit(t, dmg, (t.x - p.x) / d, (t.y - p.y) / d, p, { kb: 0, kbMul: 0, basic: true }); // a basic attack (passiveDeal, js/sim/heroes.js)
    burst(t.x, unitMidY(t), '#eef4fb', 4, 40, 0.3, true);
  }
  const r = Math.max(14, Math.min(34, Math.hypot(q.x - p.x, q.y - p.y) + 4));
  slashes.push({ x: p.x, y: p.y - 2, a, r, half: A.cut.half, t: 0, hit: true, blade: CLASSES[p.cls].blade || '' }); // `blade`: whose weapon cut it, for its smear (HERO_BLADES' `smear`, drawSlashes)
  p.slashT = SLASH_T; p.slashA = a; p.slashHalf = A.cut.half; // the hand swings the blade through the same arc (drawHeldTool)
  sfxAt('swing', p.x, p.y); sfxAt('hit', p.x, p.y);
}
function updateSlashes(dt) {
  for (let i = slashes.length - 1; i >= 0; i--) {
    slashes[i].t += dt;
    if (slashes[i].t >= SLASH_T) slashes.splice(i, 1);
  }
}
