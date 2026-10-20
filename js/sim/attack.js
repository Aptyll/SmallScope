'use strict';
// The left button: every hero's BASIC ATTACK, League's way - one weapon that
// belongs to the hero's kit, the same every match, never found, bought or
// swapped. What a hero's attack IS lives on its CLASSES row (`attack`,
// js/sim/player.js); this file is how any attack is pressed, drawn, timed and
// landed. Then the fishing the hands do on their own, which shares its clock
// with nothing here but lives beside it since the old weapon file held it.
// Loads after js/sim/actions.js: a shot rides the arrow pipeline and reads its
// tuning (BOW_Y, AMBUSH_MUL) at runtime.
// ------------------------------------------------------------ basic attack
// An `attack` row:
//   name    what the wiki and the tooltip call the weapon
//   art     the weapon in the hand (SPRITES.weaponArt / weaponHeld, js/sprites/weapons.js)
//   cycle   seconds from one attack to the next draw, at the WREN's renock
//           (BOW_NOCK): the kit's own `nock` scales it, ATTACK SPEED divides it
//   kb      the shove a blow lands, a multiplier on whatever the body takes
//           (1 = the ordinary blow, hurtUnit's kbMul)
//   shot    { speed px/s, life s, col }: a shaft flown down the aim, or
//   cut     { reach px, half rad }: a wedge swept off the aim, the blade's
//           length at full draw and its sweep to either side
// The damage is the hero's DAMAGE stat (statOf, js/sim/stats.js), always: a
// level, a card or an item that raises it raises the attack, and the draw
// scales the whole of it (the draw, below).
function attackOf(p) { return CLASSES[p.cls].attack; }
// The cycle a press starts, for THIS player right now - and the one number
// every readout of it divides `p.nockT` by (the reticle's marks, the overhead
// slate bar), so no meter can show a wait a different length from the one
// running.
function attackCycle(p) { return attackOf(p).cycle * (kitOf(p).nock / BOW_NOCK) / asMul(p); }

// ---- the draw ------------------------------------------------------------
// How far back the string is: `chargeT` over the kit's full draw, 0..1. It
// scales the attack three ways at once - how far it reaches, how fast a shot
// flies, and how hard it lands - on straight lines from a floor to the
// weapon's own numbers, so the meter over the head, the ring closing on the
// cursor and the aim line growing out of the bow all read the same quantity.
// A tap still lands, at every floor; that is the whole punishment for
// spamming the button - short, slow and weak, with the cycle still to run
// before the next - and it is dealt by the blow itself rather than by a
// counter. `shotFlight` is the envelope a shot leaves with AND the one
// drawAimLine measures, so the line on the ground is the flight.
const DRAW_RANGE_MIN = 0.22; // a tap flies this fraction of the shot's full flight
const DRAW_SPEED_MIN = 0.6;  // at this fraction of its speed
const DRAW_DMG_MIN = 0.3;    // for this fraction of its damage
// seconds to a full draw for THIS player right now. Every reader of "how far
// back is the string" divides by this, never by the bare `kit.bowCharge`.
function drawTime(p) { return kitOf(p).bowCharge / asMul(p); } // ATTACK SPEED quickens the pull (js/sim/stats.js)
function drawPow(p) { return Math.min(1, Math.max(0, p.chargeT / drawTime(p))); }
function drawSpeedMul(pw) { return DRAW_SPEED_MIN + (1 - DRAW_SPEED_MIN) * pw; }
function drawRangeMul(pw) { return DRAW_RANGE_MIN + (1 - DRAW_RANGE_MIN) * pw; }
function drawDmgMul(pw) { return DRAW_DMG_MIN + (1 - DRAW_DMG_MIN) * pw; }
// speed (px/s) and life (s) a shot `s` ({ speed, life }) leaves with at this
// draw - the range curve applied through the life, so a slow tap also stops
// short instead of just arriving late
function shotFlight(s, pw) {
  const sm = drawSpeedMul(pw);
  return { spd: s.speed * sm, life: s.life * drawRangeMul(pw) / sm };
}
// what the attack lands for at draw `pw`: the hero's DAMAGE, the kit's speed
// bonus on a body that is moving, the draw over the whole sum, the ambush
// what SNOW COVER's rank adds to the shot out of full cover: its row's
// `ambush` over the kit's base AMBUSH_MUL, nothing on a body without the key
function ambushRank(p) { const v = abRk(p, 'snow', 'ambush'); return v === v ? v - AMBUSH_MUL : 0; }
function attackDmg(p, pw, amb) {
  const kit = kitOf(p);
  const spdBonus = kit.spdDmg * Math.min(1, Math.hypot(p.vx, p.vy) / 200);
  let dmg = Math.round((statOf(p, 'dmg') + spdBonus) * drawDmgMul(pw));
  if (amb) dmg = Math.round(dmg * (kit.ambushMul + ambushRank(p)));
  return dmg;
}

// ---- the press -----------------------------------------------------------
// The falling edge of `input.fire`, for every player alike (updatePlayer,
// js/sim/sim.js): the cover is read before anything can break it, the attack
// lands, the cycle starts, and the loose is what stands a crawler up - one
// ambush per burrow.
function basicAttack(p) {
  cancelCatch(p); // a press is a press: the hoist gives way to the attack
  const amb = ambushReady(p);
  const A = attackOf(p);
  if (A.cut) cutAttack(p, A, amb);
  else { shootAttack(p, A, amb); sfxAt('arrow', p.x, p.y); }
  p.nockT = attackCycle(p);
  risePlayer(p);
}

// ---- the shot ------------------------------------------------------------
// One shaft down the aim, from the spawn point (BOW_Y above the feet, not the
// feet, or the flight runs parallel to the aim line and never meets it).
function shootAttack(p, A, amb) {
  const pw = drawPow(p);
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y);
  const a = Math.atan2(dy, dx);
  const { spd, life } = shotFlight(A.shot, pw);
  arrows.push({
    x: p.x, y: p.y - BOW_Y,
    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
    t: 0, life, dmg: attackDmg(p, pw, amb), pow: pw,
    owner: p.id, team: p.team, ambush: amb, trailD: 0,
    solid: true, kb: A.kb, col: A.shot.col, basic: true,
    ang: a, spd, ox: p.x, oy: p.y - BOW_Y,
  });
  faceToward(p, dx, dy, true);
}

// ---- the cut -------------------------------------------------------------
// A blade's press. The draw is still the throttle - a tap is a short, weak
// cut and a full draw the whole blade at its whole worth (SLASH_REACH_MIN is
// the reach floor, drawDmgMul the damage's). What the edge reaches is the
// WEDGE (inCone, js/sim/actions.js) and nothing else: a body behind the caster
// is never cut, and the sweep left on the snow (`slashes`, drawn by
// drawSlashes) is that exact wedge, so what a rival saw is what hit them.
const SLASH_T = 0.28;        // s the sweep lives on the snow - and the hand swings the blade through it
const SLASH_REACH_MIN = 0.6; // a tap reaches this fraction of the blade
const slashes = [];          // {x, y, a, r, half, t, hit}
function slashReach(cut, pw) { return cut.reach * (SLASH_REACH_MIN + (1 - SLASH_REACH_MIN) * pw); }
function cutAttack(p, A, amb) {
  const pw = drawPow(p), cut = A.cut;
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y);
  const a = Math.atan2(dy, dx);
  const r = slashReach(cut, pw);
  const dmg = attackDmg(p, pw, amb);
  const targets = unitsInCone(p, p.x, p.y, a, r, cut.half);
  for (const q of targets) {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    hurtUnit(q, dmg, (q.x - p.x) / d, (q.y - p.y) / d, p, {
      ambush: amb, kb: 30, kbMul: A.kb, basic: true, // a basic attack (passiveDeal, js/sim/heroes.js)
    });
    burst(q.x, unitMidY(q), '#eef4fb', 4, 40, 0.3, true);
  }
  for (const w of structsInCone(p, p.x, p.y, a, r, cut.half)) hurtStruct(w, dmg, p);
  // the practice dummy: the wedge's far half is where a dummy stands to be hit
  if (PRACTICE) abHitDummies(p.x + Math.cos(a) * r * 0.5, p.y + Math.sin(a) * r * 0.5, r * 0.5, dmg);
  slashes.push({ x: p.x, y: p.y - 2, a, r, half: cut.half, t: 0, hit: targets.length > 0 });
  p.slashT = SLASH_T; p.slashA = a; p.slashHalf = cut.half; // the hand swings the blade through the same arc (drawHeldTool)
  faceToward(p, dx, dy, true);
  if (targets.length) { shakeFor(p, 2); for (const t of targets) shakeFor(t, 2); }
  sfxAt('swing', p.x, p.y); if (targets.length) sfxAt('hit', p.x, p.y);
}
function updateSlashes(dt) {
  for (let i = slashes.length - 1; i >= 0; i--) {
    slashes[i].t += dt;
    if (slashes[i].t >= SLASH_T) slashes.splice(i, 1);
  }
}

// ------------------------------------------------------------ fishing
// Fishing is the hands working on their own, like a tree in reach
// (autoWork, js/sim/actions.js): standing on ice with a fish inside FISH_CATCH_R
// takes it through the sheet with no press - once every FISH_AUTO_CD, so a
// walk along a shoal is a stride per fish, not a vacuum. It never touches the
// attack: no cycle is spent and a draw runs on under it. Nothing can refuse
// the catch: fish are a POUCH kind and take no bag cell (the `inventory`
// banner, js/sim/player.js). Two players can reach one fish in a step, so it
// is contested, not first-come.
const FISH_AUTO_CD = 1.2;
function autoFish(p, dt) {
  p.fishCd = Math.max(0, p.fishCd - dt);
  if (p.fishCd > 0 || p.fallT > 0 || p.dodgeT > 0 || p.stunT > 0 || inAir(p) || p.zip >= 0) return;
  const ftx = Math.floor(p.x / TILE), fty = Math.floor((p.y + 4) / TILE);
  if (!inWorld(ftx, fty) || ground[idx(ftx, fty)] !== 1) return;
  let bi = -1, bd = FISH_CATCH_R;
  for (let i = 0; i < fish.length; i++) {
    if (!fish[i].born) continue; // still swimming in from under the shore
    const d = Math.hypot(fish[i].x - p.x, fish[i].y - p.y);
    if (d < bd) { bd = d; bi = i; }
  }
  if (bi < 0) return;
  const f = fish[bi];
  p.fishCd = FISH_AUTO_CD;
  contest('fish:' + bi, p, () => {
    const j = fish.indexOf(f);
    if (j < 0) return;
    fish.splice(j, 1);
    const k = f.kind || 'fish';
    bagAdd(p, k, 1);
    startCatch(p, k);
    addFloater(f.x, f.y - 10, ITEMS[k].name + '!', RES_COLORS[k]);
    burst(f.x, f.y, '#9fc4dd', 8, 45, 0.45, true);
    burst(f.x, f.y, '#ddf1f8', 5, 35, 0.4, true);
    sfxAt('splash', f.x, f.y); sfxAt('stash', f.x, f.y);
  });
}

// The catch is a pose the body performs - CATCH_STOOP s bent to the hole,
// CATCH_HAUL s with the fish coming up, then the trophy hoist for the rest of
// CATCH_T - three DOWN-facing frames whatever the body was facing
// (classSet(p).catch, drawn by drawPlayer). It is shown only by a body that
// is standing still anyway: a step, a fresh press, a roll, a cast, a swing,
// a meal or a hit drops it at once (cancelCatch, from updatePlayer and
// damagePlayer), because an automatic catch may never hold the player.
// A net hands its first fish up the same way (updateStructures, js/sim/structures.js).
const CATCH_T = 2, CATCH_STOOP = 0.16, CATCH_HAUL = 0.22;
function startCatch(p, kind) { p.catchT = CATCH_T; p.catchKind = kind || 'fish'; }
function cancelCatch(p) { p.catchT = 0; }
// which catch frame the body is on: 0 stoop, 1 haul, 2 hoist, -1 not catching
function catchFrame(p) {
  if (p.catchT <= 0) return -1;
  const t = CATCH_T - p.catchT;
  return t < CATCH_STOOP ? 0 : t < CATCH_STOOP + CATCH_HAUL ? 1 : 2;
}
