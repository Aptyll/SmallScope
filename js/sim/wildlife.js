'use strict';
// Everything wild: prey and the shared animal lifecycle, the fish under the
// ice, and the camps' monsters - each with its own tuning above it.
// ------------------------------------------------------------ animals
// Rabbits are the passive half (updatePrey); the three wolves are
// the camps' monsters (updateCampMonster), and go in this same array so
// arrows, the draw list, the kill payouts and the cursor all treat them as
// what they are: things you shoot.
const ANIMAL_HP = { rabbit: 8, wolf: 30, scrap: 30, alpha: 640, orca: 1560 };
// Every animal wears a hero-style level: the table's average hero level
// (animalLevel), never under a camp monster's MONSTER.lv. It is dealt at
// spawn (makeAnimal) and follows the table after (relevelAnimal) while the
// body is unhurt and hunts nobody - never mid-fight, so a blow never lands on
// more hp than the last one did. What grows with it is hp, ANIMAL_LV_HP a
// level over ANIMAL_HP, and a monster's bite (MONSTER.lvBite, above the camp
// monsters banner) - so the number on a body is what it costs to take, the
// way a hero's is, and the bear that sat out the early game is as tough as
// the table when it is finally pulled. The kill pays for it:
// ANIMAL_LV_GOLD of the YIELD payout more a level (animalDies), a tenth, so
// a level-12 beast is worth a little over twice a level-1 one - about what
// its hp grew by. Its XP (YIELD's `xp`, shared by the hunter's side standing
// near: shareXp, js/sim/player.js) grows the same tenth a level.
const ANIMAL_LV_HP = { rabbit: 1, wolf: 3, scrap: 3, alpha: 50, orca: 100 };
const ANIMAL_LV_GOLD = 0.1;
const ANIMAL_LV_XP = 0.1;
function animalLevel() {
  let n = 0, s = 0;
  for (const p of players) if (p.active) { n++; s += p.level; }
  return n ? Math.max(1, Math.min(LEVEL_MAX, Math.round(s / n))) : 1;
}
// the level a kind wears right now, and its full hp at a level
function animalLevelOf(kind) { return Math.max(animalLevel(), (MONSTER[kind] && MONSTER[kind].lv) || 1); }
function animalHpAt(kind, level) { return (ANIMAL_HP[kind] || 8) + (ANIMAL_LV_HP[kind] || 0) * (level - 1); }
// an unhurt body that hunts nobody takes the table's level, and the full hp
// that comes with it (updateAnimal, every tick)
function relevelAnimal(a) {
  if (a.hp < a.maxHp || a.target) return;
  const level = animalLevelOf(a.kind);
  if (level !== a.level) { a.level = level; a.hp = a.maxHp = animalHpAt(a.kind, level); }
}
// what a hit knocks off a body: its own coat, so a puff says which beast
// took the blow.
const HIT_PUFF = { rabbit: '#9a6a45', wolf: '#6f778c', scrap: '#9a5f36', alpha: '#3b3b53', orca: '#2b3550' };
// Prey: how close a player gets before it bolts, how long it runs, and its
// two speeds: a rabbit sits tight and then goes off like a spring. The ring
// resolves through seenAt, so a hero's stealth is what gets inside it.
const FLEE_SIGHT = 36;
const FLEE_TIME = [1.6, 2.6];
const PREY_SPD = 42;   // px/s grazing
const PREY_RUN = 104;  // px/s bolting
// A rabbit's jink: the same bar under its health (a.dodge, 0..1) holds ONE
// charge, ready only when full, and spends it the instant a shot is coming
// at it - an arrow inside RABBIT_DODGE_SIGHT, still flying toward the rabbit,
// on a line that passes within RABBIT_DODGE_MISS of its body - on a dash
// straight off that line, sideways, at RABBIT_DODGE_SPD for RABBIT_DODGE_T,
// and then a bolt away from the shooter: the zig, then the zag. The charge
// comes back over RABBIT_DODGE_CD, and until it does the rabbit is the shot
// it always was - so the second arrow is the one that lands.
const RABBIT_DODGE_SIGHT = 90; // px an arrow is noticed from (the fastest bit, 620 px/s, still gives the dash time)
const RABBIT_DODGE_MISS = 14;  // px off the body's centre a shot's line must pass inside to be coming AT it
const RABBIT_DODGE_SPD = 260;  // px/s of the jink
const RABBIT_DODGE_T = 0.11;   // s it lasts: ~29 px, well clear of the 8 px disc an arrow lands in
const RABBIT_DODGE_CD = 6;     // s for the charge to come back
// The beat a rabbit sits up for before it goes: it hears you, rocks back onto
// its haunches (the `rise` clip) and only then bolts. It is what the meadow's
// oldest line - "a rabbit sits tight and then goes off like a spring" - looks
// like, and it is the one still shot anyone is ever offered at one. A hit
// skips it (hurtAnimal), so a rabbit already running never stops to pose.
const RABBIT_ALERT = 0.3;
// A warren's rabbit never runs out of its snow: every leg of a flight and
// every graze must end on its warren's deep snow (warrenHolds), and a flight
// is a chain of RABBIT_LEG-tile legs, each picked away from the threat, so at
// PREY_RUN it circles a hero rather than leaving the circle.
const RABBIT_LEG = 3.5;
function warrenHolds(C, x, y) { return campNear(C, x / TILE - 0.5, y / TILE - 0.5, 0) && deepAt(x, y); }
// The head-up window: seconds a rabbit keeps WATCHING after the last sign
// of a player - the beat it sits up in when a flight ends, before it settles. It costs nothing (no speed, no sight, no bolt of its
// own; a.senseT and the mark over the head are unchanged) and buys the one
// thing that cannot be said in words: grazing MEANS "has not seen you", so a
// meadow of heads-down is a meadow you can still walk into.
const PREY_WARY_T = 3;

// What a beast is DOING, drawn: the sprite clip it plays and the frames a
// second it plays at. The imported bunny came in AS behaviours - a
// graze, a gallop, a sit-up - so a beast's animation is not a walk flag any
// more but a name, chosen from its state by the `setClip` calls at the end of
// updatePrey / updateCampMonster / updateBird (and by the stun branch of
// updateAnimal) and played by `clipFrame`, js/draw-world.js - which is the
// ONLY thing that turns a clip and an animT into a canvas, so nothing else
// needs to know a clip's length. A kind's clips are the keys of its SPRITES entry
// (js/sprites.js); `idle` is the one every kind has, and the fallback.
// A one-frame clip's rate is moot, hence the zeroes.
const ANIM_CLIPS = {
  rabbit: { idle: 6, rise: 8, hop: 14 },
  wolf: { idle: 0, run: 8 },
  scrap: { idle: 0, run: 8, lunge: 0, down: 0, sleep: 0.7 }, // the stray robot: `lunge` is the ram (MONSTER.scrap.lunge), `sleep` its breath at rest (MONSTER.scrap.sleeps)
  alpha: { idle: 5, walk: 8, run: 12, bite: 14, paw: 14, roar: 10 }, // the bear: patrols at a walk, charges at a gallop
  orca: { idle: 0, bite: 12, paw: 12, roar: 10 }, // the orca up in its hole: a lunge either way, and the breach it wakes with
};
// A clip change restarts the loop, so a sit-up always begins on the frame it
// was drawn to begin on rather than wherever the last one had got to.
function setClip(a, clip) {
  if (a.clip === clip) return;
  a.clip = clip;
  a.animT = 0;
}
// one clip's worth of time, `rate` the caller's own gait multiplier (a wander
// is the same gallop, slower)
function stepClip(a, dt, rate) {
  a.animT += dt * ((ANIM_CLIPS[a.kind] || {})[a.clip] || 0) * (rate === undefined ? 1 : rate);
}

// `fix` (a hero's summon, js/sim/varro.js) gives the facing and draws no rng();
// without it the draws are the world's, in the world's order
function makeAnimal(kind, x, y, fix) {
  const level = animalLevelOf(kind), hp = animalHpAt(kind, level);
  const a = {
    kind, x, y, hp, maxHp: hp, level,
    senseT: 0,                           // s it has had a player in sight (0: it has not) - the mark over its head (drawAnimal)
    dir: fix ? fix.dir : rng() < 0.5 ? 'left' : 'right',
    goal: null, idleT: fix ? 0 : rand(0.5, 2.5), mvx: 0, mvy: 0,
    clip: 'idle', animT: fix ? 0 : rng() * 2, flash: 0, kbx: 0, kby: 0, // the clip it plays, and how far into it (ANIM_CLIPS)
    alertT: 0, wary: 0,                  // rabbit: the sit-up before the bolt (RABBIT_ALERT); both: the head-up window after one (PREY_WARY_T)
    fleeT: 0, fleeGoal: null, nav: null,  // prey: its flight; any walker: its route (see pathfinding)
    dodge: 1, dashT: 0, dashX: 0, dashY: 0, // rabbit: its one jink charge (0..1, ready at 1) and the dash it is on
    home: null,                          // the camp it belongs to, if any
    target: null, biteCd: 0, threat: 0, // camp monster: its quarry, its bite rhythm, and the leash bar (0..1) that ends the hunt
    homing: false, homeT: 0, invuln: 0,  // camp monster: running back to its spot after a hunt, untouchable on the way (campRunHome)
    dead: false,
  };
  // stun, root, slow, a mark, fire: an animal wears
  // the identical set a player does, written by the same setters
  // (`status effects`, js/sim/actions.js) - a rabbit is not a different rulebook
  clearUnitStatus(a);
  return a;
}

// the body an arrow tests against. The disc is animalHitR round (a.x, animalHitY): the arrow loop sweeps a
// shot's whole step against it (sweepDisc, js/sim/sim.js); a homing shot just lands.
// A bear is wider (its 112x76 frame, js/baked/bears.js), so its disc is
// wider and sits up on the flank.
function animalHitR(a) { return isBigBeast(a) ? 28 : 8; }
function animalHitY(a) { return a.y - (isBigBeast(a) ? 10 : 3); }

// One animal taking a hit, from an arrow or from a body rolled into it. Both
// come through here so a swipe reacts exactly like a shot does - the den
// wakes, prey bolts, the flock scatters - and `lastHit` (the player whose
// wallet the kill pays, see animalDies) is stamped in one place.
function hurtAnimal(a, dmg, nx, ny, kb, owner) {
  a.hp -= dmg;
  a.flash = 0.12;
  a.lastHit = owner;
  // a camp monster does not run from a hit - the whole camp comes for you,
  // and a hit is the ONLY thing that wakes one
  if (isCampKind(a.kind)) wakeCamp(a, players[owner]);
  else { a.fleeT = 1.4; a.alertT = 0; } // a hit rabbit goes NOW; it does not stop to sit up
  tallyHit(a, dmg);
  a.kbx = nx * kb; a.kby = ny * kb;
  burst(a.x, a.y - 4, HIT_PUFF[a.kind] || '#8f582f', 6, 40, 0.4);
  sfxAt('hit', a.x, a.y); if (a.hp > 0) sfxAt('yelp', a.x, a.y);
}

// ------------------------------------------------------------ open water
const HOLE_FALL_DMG = 15;  // falling into open water hurts
const HOLE_FALL_T = 1.1;   // seconds floundering before climbing back out

// shortest signed turn from a to b - the one steering helper the lure needs
function angDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function nearestObj(x, y, rTiles, pred) {
  const ctx0 = Math.floor(x / TILE), cty = Math.floor(y / TILE);
  let best = null, bd = 1e9;
  for (let ty = cty - rTiles; ty <= cty + rTiles; ty++) {
    for (let tx = ctx0 - rTiles; tx <= ctx0 + rTiles; tx++) {
      const o = objAt(tx, ty);
      if (o && pred(o)) {
        const d = Math.hypot(tx * TILE + 8 - x, ty * TILE + 8 - y);
        if (d < bd) { bd = d; best = o; }
      }
    }
  }
  return best;
}

// the title's ambient world: the wildlife and the shoal live on behind the
// menu (updateTitle, js/ui/menu.js) - but stand still once the room is
// shared. A client's animals are the host's (its own steps would turn a
// rabbit the host never turned), and the host's clock does not tick at the
// title, so every guest's full sync shares one ring entry: a rabbit turned and
// turned back between two joins would never reach the second (snapHistoryPush)
function titleWild(dt) {
  if (netShared()) return;
  for (const a of animals) updateAnimal(a, dt);
  for (let i = animals.length - 1; i >= 0; i--) if (animals[i].dead) animals.splice(i, 1);
}

function updateAnimal(a, dt) {
  a.flash = Math.max(0, a.flash - dt);
  a.kbx *= Math.pow(0.02, dt);
  a.kby *= Math.pow(0.02, dt);
  if (isAnchored(a)) a.kbx = a.kby = 0; // a shove from anything never moves it (MONSTER.anchor)
  // every timed state on the body first - the burn can kill, and a corpse
  // must not then take a step (js/sim/actions.js, `status effects`)
  // a camp monster running home wears nothing: no stun, slow, root or fire
  // keeps it out of its camp (campRunHome)
  if (a.homing) { clearUnitStatus(a); a.kbx = a.kby = 0; }
  updateUnitStatus(a, dt);
  if (a.hp <= 0 && !a.dead) { animalDies(a); return; }
  relevelAnimal(a);
  if (a.stunT > 0) {
    // seeing stars: no brain for the window, and the route it was walking is
    // dropped rather than resumed - a tackle can slide a body a long way from
    // the leg it was on. A shove still moves it, same as any idle animal.
    a.stunT = Math.max(0, a.stunT - dt);
    setClip(a, 'idle'); // stars over a still body: the standing clip, held
    if (Math.abs(a.kbx) + Math.abs(a.kby) > 1) moveEntity(a, a.kbx * dt, a.kby * dt, unitRadius(a));
    if (a.stunT <= 0) { a.goal = null; a.fleeGoal = null; a.dashT = 0; a.alertT = 0; navClear(a); a.idleT = 0.3; }
  } else if (a.summon) heroSummonStep(a, dt); // a hero's own beast (HERO_SUMMON, js/sim/heroes.js)
  else if (isCampKind(a.kind)) updateCampMonster(a, dt);
  else updatePrey(a, dt);
  a.x = Math.max(8, Math.min(WORLD * TILE - 8, a.x));
  a.y = Math.max(8, Math.min(WORLD * TILE - 8, a.y));
  if (a.hp <= 0 && !a.dead) animalDies(a);
}

// where a frightened animal runs next: ~6 tiles off, as straight away from
// the threat as the ground allows (fanning out, then sideways, then past it),
// the first open tile it can actually route to
function fleeGoal(a, from) {
  const base = Math.atan2(a.y - from.y, a.x - from.x) + rand(-0.4, 0.4);
  // a warren's rabbit runs short legs that never leave its snow (warrenHolds):
  // pinned to the circle it zigzags round the chaser instead of out of reach
  const C = a.meadow, dist = (C ? RABBIT_LEG : 6) * TILE;
  for (const k of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6, Math.PI]) {
    const gx = a.x + Math.cos(base + k) * dist, gy = a.y + Math.sin(base + k) * dist;
    const tx = Math.floor(gx / TILE), ty = Math.floor(gy / TILE);
    if (!walkable(tx, ty)) continue;
    const front = inWorld(tx, ty + 1) && objects[idx(tx, ty + 1)];
    if (front && front.type === 'tree') continue; // never to stand behind a pine: the one in front of it would hide it
    const x = tx * TILE + 8, y = ty * TILE + 8;
    if (C && !warrenHolds(C, x, y)) continue;
    if (navLineClear(a.x, a.y, x, y, 5) || findPath(a.x, a.y, x, y, 0, 250)) return { x, y };
  }
  return null;
}

// Where an animal drifts next while nothing is chasing it: an open tile
// `near`-`far` tiles off, inside `spread` of `base`, that it can route to.
// Idling used to be a random heading held on a timer, which walked animals
// into trees and stopped them mid-stride wherever the clock ran out. A
// wander is a goal like any other now, so it goes around what is in the way,
// it ends where the animal actually stops, and the debug overlay has a real
// route to draw instead of a stub pointing off into nothing. It never ends on
// a tile with a pine just south of it, where the pine would hide the body.
// null means boxed in - the caller waits a beat and picks again.
function wanderGoal(a, base, spread, near, far, C) {
  for (let k = 0; k < 8; k++) {
    const ang = base + rand(-spread, spread);
    const d = rand(near, far) * TILE;
    const tx = Math.floor((a.x + Math.cos(ang) * d) / TILE), ty = Math.floor((a.y + Math.sin(ang) * d) / TILE);
    if (!walkable(tx, ty)) continue;
    const front = inWorld(tx, ty + 1) && objects[idx(tx, ty + 1)];
    if (front && front.type === 'tree') continue; // never to stand behind a pine: the one in front of it would hide it
    const x = tx * TILE + 8, y = ty * TILE + 8;
    if (C && !warrenHolds(C, x, y)) continue; // a warren's rabbit grazes inside its snow
    if (navLineClear(a.x, a.y, x, y, 5) || findPath(a.x, a.y, x, y, 0, 250)) return { x, y };
  }
  return null;
}

// a rabbit keeps to its warren's deep snow (warrenHolds): off it, it hops
// back toward the middle, and on it takes short hops of a tile or three any
// way that stays on it; everyone else just picks an open way out
function preyWander(a) {
  const C = a.meadow;
  if (C) {
    const hx = (C.tx + 0.5) * TILE, hy = (C.ty + 0.5) * TILE;
    if (!warrenHolds(C, a.x, a.y)) return wanderGoal(a, Math.atan2(hy - a.y, hx - a.x), 0.5, 2, 4);
    return wanderGoal(a, rng() * Math.PI * 2, Math.PI, 1, 3, C);
  }
  return wanderGoal(a, rng() * Math.PI * 2, Math.PI, 3, 6);
}

// the shot a rabbit jinks from: the nearest arrow in flight inside
// RABBIT_DODGE_SIGHT that is still flying toward it, on a line that passes
// within RABBIT_DODGE_MISS of its body (the animalHitR disc, 3 px above
// the feet). A shot already past, or flying wide, is nothing to it.
function arrowAtRabbit(a) {
  let best = null, bd = RABBIT_DODGE_SIGHT;
  for (const s of arrows) {
    const dx = a.x - s.x, dy = a.y - 3 - s.y;
    const d = Math.hypot(dx, dy);
    if (d >= bd) continue;
    const vd = Math.hypot(s.vx, s.vy);
    if (vd < 1) continue;
    if (dx * s.vx + dy * s.vy <= 0) continue;                 // past it, or flying away
    if (Math.abs(dx * s.vy - dy * s.vx) / vd > RABBIT_DODGE_MISS) continue; // wide of it
    best = s; bd = d;
  }
  return best;
}

// the jink itself: the charge goes, the rabbit dashes straight off the
// shot's line - to the side it already leans to, or the other if that one
// is a wall - and the bolt that follows the dash is the ordinary flight
// (updatePrey), so the whole thing reads as a zig-zag from the bow
function rabbitDodge(a, s) {
  const vd = Math.hypot(s.vx, s.vy);
  const px = -s.vy / vd, py = s.vx / vd;                      // one perpendicular to the shot
  const cross = (a.x - s.x) * s.vy - (a.y - 3 - s.y) * s.vx;  // which side of the line the body sits
  let side = Math.abs(cross) < 1 ? (rng() < 0.5 ? 1 : -1) : cross < 0 ? 1 : -1;
  const len = RABBIT_DODGE_SPD * RABBIT_DODGE_T;
  if (!navLineClear(a.x, a.y, a.x + px * side * len, a.y + py * side * len, 2.5) &&
      navLineClear(a.x, a.y, a.x - px * side * len, a.y - py * side * len, 2.5)) side = -side;
  a.dashX = px * side; a.dashY = py * side; a.dashT = RABBIT_DODGE_T;
  a.dodge = 0;
  a.fleeT = rand(FLEE_TIME[0], FLEE_TIME[1]);
  a.fleeGoal = null; a.goal = null; navClear(a);
  burst(a.x, a.y, '#eef2fa', 5, 30, 0.3); // the snow it kicks off
}

// rabbits: wander, nibble, and bolt from anyone who gets close
function updatePrey(a, dt) {
  const r = 2.5;

  // the jink charge comes back on the clock whatever it is doing, and a
  // rabbit holding one spends it on the first shot coming at it (a rooted or
  // netted one cannot move, so it does not waste the charge trying)
  a.dodge = Math.min(1, a.dodge + dt / RABBIT_DODGE_CD);
  if (a.dodge >= 1 && a.dashT <= 0 && unitMoveMul(a) > 0) {
    const s = arrowAtRabbit(a);
    if (s) rabbitDodge(a, s);
  }

  // it bolts from a player who gets close. The ring is what the player is
  // SEEN at, so stealth is how a hero closes on one at all.
  let scare = null, sd = 1e9;
  for (const p of players) {
    if (!p.active || p.dead) continue;
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    if (d < sd) { sd = d; scare = p; }
  }
  const seen = !!scare && sd < seenAt(scare, FLEE_SIGHT);
  if (a.fleeT <= 0 && seen) {
    // a rabbit that has only just noticed you sits up first (RABBIT_ALERT);
    // one whose beat is spent goes
    if (a.senseT <= 0 && a.alertT <= 0) a.alertT = RABBIT_ALERT;
    else if (a.alertT <= 0) a.fleeT = rand(FLEE_TIME[0], FLEE_TIME[1]);
    a.goal = null; navClear(a); // the graze is off either way
  }

  let moving = false, dashing = false;
  if (a.dashT > 0) {
    // the jink: a hand-steered dash, so unitMoveMul is folded in here the
    // way navStep folds it into every routed step
    a.dashT -= dt;
    const spd = RABBIT_DODGE_SPD * unitMoveMul(a);
    a.mvx = a.dashX; a.mvy = a.dashY;
    moveEntity(a, (a.dashX * spd + a.kbx) * dt, (a.dashY * spd + a.kby) * dt, r);
    moving = dashing = true;
  } else if (a.alertT > 0) {
    // up on its haunches, wound and not yet let go: nothing walks, and the
    // clip below is the whole tell
    a.alertT -= dt;
  } else if (a.fleeT > 0) {
    a.fleeT -= dt;
    // the flight is a chain of routed legs a few tiles long, each picked
    // away from the threat; a leg that fails or arrives hands over to the next.
    // With no threat on the ground (every hero dead) the leg under way is run
    // out and the flight ends there
    if (!a.fleeGoal && scare) a.fleeGoal = fleeGoal(a, scare);
    if (a.fleeGoal) {
      const n = navStep(a, a.fleeGoal.x, a.fleeGoal.y, r, PREY_RUN, dt);
      if (!n.ok || n.d < 6) a.fleeGoal = null;
      moving = true;
    } else {
      a.fleeT = 0; // cornered: nowhere to run
    }
    if (a.fleeT <= 0) { a.fleeGoal = null; navClear(a); a.idleT = rand(0.4, 1); }
  } else if (a.goal) {
    // grazing is a routed walk to a real tile: it rounds the trees instead of
    // bumping them, and it ends on the spot the animal was heading for
    const n = navStep(a, a.goal.x, a.goal.y, r, PREY_SPD, dt);
    if (!n.ok || n.d < 6) { a.goal = null; navClear(a); a.idleT = rand(0.8, 2.2); }
    else moving = true;
  } else {
    a.idleT -= dt;
    // a shove (arrow or unit collision) still moves an idle animal
    if (Math.abs(a.kbx) + Math.abs(a.kby) > 1) moveEntity(a, a.kbx * dt, a.kby * dt, r);
    if (a.idleT <= 0) {
      a.goal = preyWander(a);
      if (!a.goal) a.idleT = rand(1.5, 3); // nibbling where it stands, or boxed in
    }
  }

  // the mark over its head (drawAnimal): up from the frame it has a player
  // inside its ring or is running from one, down the frame neither is true -
  // so a rabbit wearing it has seen you, and one without has not
  a.senseT = seen || a.fleeT > 0 ? a.senseT + dt : 0;
  // ...and the softer one under it: the mark snaps off the moment it loses
  // you, but the animal keeps its head up a while longer (PREY_WARY_T)
  a.wary = seen || a.fleeT > 0 || a.alertT > 0 ? PREY_WARY_T : Math.max(0, a.wary - dt);

  if (moving && Math.abs(a.mvx) > 0.05) a.dir = a.mvx > 0 ? 'right' : 'left';
  // Which clip, and that IS the read on what the animal knows (ANIM_CLIPS):
  // low over its paws when settled, rocked back on its haunches when WARY -
  // it has you in sight, or it has just finished running from you - and the
  // hop when it moves, run slower for a wander than for a flight. So a
  // settled rabbit has not seen you, told without a word.
  if (moving) setClip(a, 'hop');
  else if (a.wary > 0) setClip(a, 'rise');
  else setClip(a, 'idle');
  stepClip(a, dt, dashing ? 1.4 : moving ? (a.fleeT > 0 ? 1 : 0.6) : 1);
}

// what a kill pays: one profile per kind out of the YIELD table, grown
// ANIMAL_LV_GOLD a level for the animal's own level (the top of the banner),
// straight into the wallet of whoever landed the final blow (a.lastHit,
// stamped by hurtAnimal) - gold is never a physical drop. A kill nobody is left
// alive to credit pays nobody. A camp monster's `xp` is the
// hunter's side's, shared by whoever of it stands near (shareXp), the
// hunter too if they are still up; a rabbit teaches nobody anything.
function animalDies(a) {
  a.dead = true;
  sfxAt('monsterDie', a.x, a.y, 0, a.kind);
  // a hero's summon (HERO_SUMMON) is no quarry: it pays nobody and counts for nothing
  const hunter = a.lastHit !== undefined && !a.summon ? players[a.lastHit] : null;
  if (hunter) hunter.beasts++; // the post-game record (js/ui/lobby.js)
  if (hunter && a.home) farmHit(hunter, a.x, a.y - 8); // a camp monster is farm (the `farm` banner, js/sim/farm.js)
  const y = YIELD[a.kind];
  if (hunter && !hunter.dead && y && y.coins) {
    awardGold(hunter, Math.round(y.coins * y.each * (1 + ANIMAL_LV_GOLD * ((a.level || 1) - 1))), a.x, a.y);
  }
  if (hunter && y && y.xp) shareXp(a, y.xp * (1 + ANIMAL_LV_XP * ((a.level || 1) - 1)), hunter.team, hunter);
  // the body tips over where it stood and the snow takes it (unitFall, js/sim/farm.js);
  // the orca goes back under its ice instead. A wolf says nothing over its head: a den is
  // four of them, and the coin already said it
  const pool = !!(MONSTER[a.kind] && MONSTER[a.kind].still);
  if (!pool) unitFall('A', a.kind, a.dir, -1, a.x, a.y, false, fallAng(a, a.lastHit !== undefined ? players[a.lastHit] : null));
  if (isBigBeast(a)) {
    burst(a.x, a.y - 16, HIT_PUFF[a.kind], 20, 60, 0.7);
    if (pool) burst(a.x, a.y - 16, '#ffb04a', 14, 55, 0.6);
    addFloater(a.x, a.y - 68, MONSTER[a.kind].feed + ' DOWN', '#ffb04a');
  }
  // a teamPay kill (the bear's, the orca's): the whole team is paid and given
  // its buff, wherever they are - the bear's counts one more black bear for the
  // side - and the feed says who did it: the kills that are news to both sides
  if (MONSTER[a.kind] && MONSTER[a.kind].teamPay) {
    if (hunter) {
      for (const q of players) {
        if (!q.active || q.team !== hunter.team) continue;
        if (q !== hunter && !q.dead) awardGold(q, EPIC_TEAM_GOLD, q.x, q.y);
        if (MONSTER[a.kind].push) q.pushT = Math.max(q.pushT || 0, ORCA_PUSH_T); // the orca's: the push (orcaPushMul)
        else campBuff(q, CAMP_BUFF_EPIC_T, a.kind);
      }
      if (MONSTER[a.kind].stack && (hunter.team === 0 || hunter.team === 1)) state.bearStacks[hunter.team] = Math.min(BLACK_STACK_MAX, state.bearStacks[hunter.team] + 1);
      logEvent(boardName(hunter) + ' SLEW THE ' + MONSTER[a.kind].feed, hunter);
      callBeast(a, hunter); // ...and the announcer calls it (the `calls` banner, js/sim/player.js)
    }
  }
}

// The camps' monsters (the places themselves are the CAMPS table in the
// camps banner, js/sim/camps.js): the den's wolves and the black bear, all
// of them NEUTRAL - nothing in the world hunts a player who has not hit it.
// What each is, in one row: the bite and what it grows a level (the level:
// animalLevel, the animals banner), the reach of a bite, the seconds between
// ONE monster's bites (nothing caps a PACK - a hit grants no i-frames, so
// four wolves on you is four bites a second), the hunting speed, and the
// body's radius and mass (unitRadius/UNIT_MASS read these, nav.js) - a
// bear is a big sprite and a body a roll does NOT pass through - and
// `teamPay` for the bear (`alpha`, on its bend of the creek: creekBends,
// world.js), whose kill pays the killer's whole team, gives it the bear's own
// `buff` (animalDies, worn in `buffCol`), adds one to the side's black bears
// (state.bearStacks) and names it as `feed` in the feed and the announcer's
// call (callBeast). The ORCA (`orca`, the ORCA'S POOL, first up at 6:00:
// CAMPS.orca) is the other: `still`, it keeps the hole it broke in the middle
// of its pool (`hole`, drawn under it) and never walks - its lunge reaches
// across the ice (`reach`) and past that it SPOUTS at whoever it hunts inside
// `spout` px (orcaSpout, js/sim/orca.js) - and `push`: its kill gives the side
// the ORCA BUFF (p.pushT, ORCA_PUSH_T) in place of a bear buff, under which
// the side's soldiers near a hero wearing it hit buildings ORCA_PUSH_STRUCT
// times as hard (orcaPushMul). `stack`: the bear's kill counts one more
// black bear for the side. `cause` is the
// DEATH_CAUSE a bite writes (player.js). `foot` is the box a bear walks the
// tiles with, far smaller than its body: a box near a tile wide jams on the
// first tree beside the lane its route runs down, so the 2x bear (r 18) still
// walks a 5 px one. `anchor`: nothing a
// player does moves it - no body pushes it (separateUnits gives it right of way),
// no hit shoves it (updateAnimal drops its knockback), a roll into it is a tackle
// that stuns only the roller, and a dash stops against it (each HERO_DASH step) - so a bear
// always walks where it means to, roar and attacks included.
// `lv`: the least level it spawns at, over the table's average (makeAnimal) -
// a bear is never a level-1 kill. `frame`: its frame over the body (drawBeastFrame,
// js/draw/bodies.js) - drawn `s` px to its pixel to match the 2x body, a
// `w`-pixel bar cut into `segs` (dividing w + 1), and centred whole on the body.
const BEAR_LV = 6;
const ORCA_LV = 12;
const ORCA_SPOUT_R = 15 * TILE; // px the orca spouts at whoever it hunts past its lunge's reach: its pool and the shore round it (orcaSpout, js/sim/orca.js)
const BEAR_FRAME = { s: 2, w: 24, segs: 5, centre: true };
const MONSTER = {
  wolf:  { bite: 9,  lvBite: 1, reach: 13, cd: 1,   spd: 96, r: 4.5, mass: 2,   big: false, cause: 'wolf' }, // the pack: faster than a walk, slower than a slide
  scrap: { bite: 9,  lvBite: 1, reach: 13, cd: 1,   spd: 96, r: 4.5, mass: 2,   big: false, cause: 'scrap', lunge: 0.18, sleeps: true }, // the stray robots: the wolves' numbers, the jungle's farm; `lunge`: seconds its ram frame shows after each blow; `sleeps`: it lies at its spot until hit, no patrol
  alpha: { bite: 22, lvBite: 3, reach: 44, cd: 1.4, spd: 100, r: 18,  foot: 5, mass: 5,   big: true,  teamPay: true, feed: 'BLACK BEAR', buff: 'BLACK BUFF', buffCol: '#c2a6ff', anchor: true, cause: 'bear', lv: BEAR_LV, frame: BEAR_FRAME, stack: true }, // a midline camp's: a wall of hp, and a swipe that takes a quarter of you
  orca:  { bite: 28, lvBite: 3, reach: 80, cd: 1.8, spd: 0, r: 20, foot: 5, mass: 9, big: true, teamPay: true, feed: 'ORCA', buff: 'ORCA BUFF', buffCol: '#7fd4ff', anchor: true, cause: 'orca', lv: ORCA_LV, frame: BEAR_FRAME, still: true, hole: true, spout: ORCA_SPOUT_R, push: true }, // the late fight: up in its pool, a lunge across the ice and a spout at range
};
// the causes a beast's bite names, which is how damagePlayer (js/sim/player.js)
// tells a bite apart from the world's other blows for the post-game record
const BEAST_CAUSES = new Set(Object.values(MONSTER).map((m) => m.cause));
function isCampKind(k) { return !!MONSTER[k]; }
function isBigBeast(a) { return !!(MONSTER[a.kind] && MONSTER[a.kind].big); }
function isAnchored(e) { return !!(MONSTER[e.kind] && MONSTER[e.kind].anchor); }
// A bear's set pieces, played out whole where it stands (updateCampMonster):
// the ROAR when its camp wakes, the one time it stands up on its hinds, and
// its ATTACKS, on all fours - a lunging BITE or a sweep of the PAW, taken in
// turn so no two blows in a row look alike. A blow once begun is committed,
// like a moba's auto attack: nothing but a stun cuts it (the stun branch of
// updateAnimal), the bear turns with its quarry through the wind-up, and the
// blow lands on BEAR_STRIKE on that quarry wherever it has walked, inside
// BEAR_COMMIT_REACH x its reach - only a roll or a dash gets clear. The
// wind-up is the tell. Frame counts are the clips' in js/baked/bears.js
// (app/bake-bears/anim.py).
const BEAR_ATTACKS = ['bite', 'paw'];
const BEAR_ATTACK_FRAMES = 10;
const BEAR_STRIKE = 4;
const BEAR_COMMIT_REACH = 1.5; // x reach: a blow lands up to 22 px past it, one walking step out of the wind-up
const BEAR_ROAR_FRAMES = 8;
const CAMP_GROUND = 7;     // tiles past a camp's r that are its ground, unless its CAMPS entry says `ground`: the leash bar holds on it, drains anywhere off it
const CAMP_LEASH_T = 3;    // s for a full leash bar to drain off the ground - then the monster goes home
const CAMP_REGEN_T = 6;    // s for a monster with nobody to hunt to heal from nothing to full - a camp you leave is a camp reset
const CAMP_HOME_MUL = 2;   // x the kind's hunting speed a monster runs home at once its hunt ends
const CAMP_HOME_HEAL_T = 1; // s to heal from nothing to full on the run home
const CAMP_HOME_MAX_T = 6; // s the run home may take before it settles where it is
const CAMP_SEE = 9 * TILE; // px an awake monster spots a player across (seenAt shortens it for the hidden)
// The kills' rewards past the gold (YIELD, core.js). A bear buff is what a
// midline camp's kill wears (MONSTER's `buff` and `buffCol`: the BLACK
// BUFF): CAMP_BUFF_DMG on every blow the player lands
// (hurtUnit, actions.js) and CAMP_BUFF_SPD on the walk (abilityMoveMul,
// abilities.js), worn as motes rising round the feet that thin out as it
// runs out, in the bear's colour (drawBuffRing, js/draw/bodies.js). The bear pays
// EVERY player on the killer's team EPIC_TEAM_GOLD and gives the whole team
// the buff for CAMP_BUFF_EPIC_T - the kill in the game that pays people who were not
// there, which is what makes it worth walking to as five. And it keeps
// counting: each black bear a side slays is BLACK_STACK_DMG more on every
// blow its heroes land for the rest of the match, up to BLACK_STACK_MAX
// (state.bearStacks; statStackMul, js/sim/stats.js). It is first out at
// 5:00 and back 5:00 after each kill (CAMPS.buff `first`, js/sim/camps.js).
const CAMP_BUFF_EPIC_T = 120; // s the black buff runs
const BLACK_STACK_DMG = 0.05; // each black bear a side has slain: this much more on every blow, for the rest of the match
const BLACK_STACK_MAX = 4;    // ...up to this many
const CAMP_BUFF_DMG = 1.25;
const CAMP_BUFF_SPD = 1.15;
const EPIC_TEAM_GOLD = 280;
const ORCA_PUSH_T = 180;          // s the orca buff runs: long enough to take a base with
const ORCA_PUSH_R = 10 * TILE;    // px from a hero wearing it its own side's soldiers hit buildings harder inside
const ORCA_PUSH_STRUCT = 2;       // ...this many times as hard
// the orca buff's push: a soldier with a hero of its own side wearing it near
// hits buildings ORCA_PUSH_STRUCT times as hard (soldierLand, robots.js)
function orcaPushMul(b) {
  for (const p of players) {
    if (p.team !== b.team || !p.active || p.dead || !(p.pushT > 0)) continue;
    if (Math.hypot(p.x - b.x, p.y - b.y) < ORCA_PUSH_R) return ORCA_PUSH_STRUCT;
  }
  return 1;
}
// a fresh grant only extends what is left, and the latest bear is the one worn
function campBuff(p, t, kind) { if (p && p.active) { p.buffT = Math.max(p.buffT || 0, t); p.buffKind = kind || p.buffKind || 'alpha'; } }

// ------------------------------------------------------------ camp monsters
// A camp monster holds station at its camp and minds its own business: no
// sight, no threat bar filling while you linger - you can walk through a den
// and nothing happens. A HIT is the whole trigger: it wakes the camp
// (wakeCamp), every monster in it takes the hitter as its quarry at a full
// leash bar, and they run them down at the kind's speed, biting on the
// kind's own cooldown. The bar holds while the quarry is on the camp's
// ground (campGroundPad past its r) and drains anywhere off it, whether or not
// the monster is at its heels, and it keeps coming while the bar drains;
// the hunt ends when the bar is empty, and then it goes home and HEALS
// (CAMP_REGEN_T) - so a fight you break off is a fight reset, never a
// chip-away. Awake, each monster goes for WHOEVER HIT IT, League's way: the
// waker for the whole camp, and after that the last player whose blow landed
// on that one monster, so a robot you hit is a robot on you. Only when its
// quarry is gone (dead, or off on its eagle) does it take whoever is nearest
// on its ground (campQuarry). Waking one wakes the camp, which is what makes
// it a place instead of four animals. A kind that `sleeps` (the stray robots)
// waits folded on the snow at its spot until then, and lies down again once
// it is home.
function wakeCamp(w, t) {
  if (!t) return;
  if (!w.home) { if (!w.target) { w.target = t; w.threat = 1; } return; }
  // the one that took the blow turns on whoever dealt it, mid-hunt or not
  // (one running home is untouchable and stays out of it)
  if (w.target && w.target !== t && !w.homing && unitAlive(t)) { w.target = t; w.threat = 1; navClear(w); }
  // the cue a waking camp gives: a bear roars (the sound lands with its roar
  // clip), a pack howls. Only a monster not already hunting wakes, so a
  // camp mid-chase stays quiet however often it is hit
  let cue = null;
  for (const o of animals) {
    if (o.dead || !isCampKind(o.kind) || o.home !== w.home || o.target || o.homing) continue; // one running home stays out of it
    if (ANIM_CLIPS[o.kind].roar) { setClip(o, 'roar'); cue = 'roar'; }
    else if (!cue) cue = 'howl';
    o.target = t; o.threat = 1;
  }
  if (cue) sfxAt(cue, w.x, w.y, 260);
}
// The quarry an awake monster takes when the one it had is gone (dead, or
// off on its eagle): the nearest player standing on its camp's ground that
// it can see (seenAt). With nobody there the hunt is over.
function campQuarry(a, onGround) {
  let best = null, bd = Infinity;
  for (const p of players) {
    if (!unitAlive(p) || !onGround(p)) continue;
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    if (d < bd && d <= seenAt(p, CAMP_SEE)) { bd = d; best = p; }
  }
  return best;
}

// tiles past a camp's clearing that are its ground: its kind's own `ground`
// (CAMPS, camps.js), else CAMP_GROUND
function campGroundPad(C) { return C.spec.ground === undefined ? CAMP_GROUND : C.spec.ground; }
// whether world position (x, y) is on camp C's ground: the leash, campGroundPad
// tiles past its clearing (campNear, camps.js). The leash bar holds inside it
// and drains outside (updateCampMonster), and the ring an awake camp wears on
// the snow is its edge, baked from this same test (drawCampLeashes, js/draw/marks.js)
function campGround(C, x, y) { return campNear(C, x / TILE - 0.5, y / TILE - 0.5, campGroundPad(C)); }

function updateCampMonster(a, dt) {
  const M = MONSTER[a.kind], C = a.home, foot = M.foot || M.r;
  const hx = C ? (C.tx + 0.5) * TILE : a.x, hy = C ? (C.ty + 0.5) * TILE : a.y;
  const groundR = ((C ? C.r : 5) + (C ? campGroundPad(C) : CAMP_GROUND)) * TILE;
  a.biteCd = Math.max(0, a.biteCd - dt);
  // the camp's ground: its clearing (campGround)
  const onGround = (p) => (C ? campGround(C, p.x, p.y) : Math.hypot(p.x - hx, p.y - hy) < groundR);

  let t = a.target;
  const awake = !!t;
  if (t && (!t.active || t.dead)) { t = null; a.threat = 0; navClear(a); }
  // a quarry that falls hands the hunt on at once, to the nearest on the
  // ground (a new hitter is taken in wakeCamp, the moment the blow lands)
  if (awake && !t) {
    t = campQuarry(a, onGround);
    if (t) a.threat = 1;
  }
  if (t) {
    // hunting: the bar holds while the quarry is on the ground and drains
    // once it is off - the monster at its heels or not; the chase goes on
    // either way until the bar is empty
    if (onGround(t)) a.threat = 1;
    else {
      a.threat = Math.max(0, a.threat - dt / CAMP_LEASH_T);
      if (a.threat <= 0) { t = null; navClear(a); } // the quarry got away; home
    }
  } else {
    a.threat = 0;
    // nobody to hunt: the camp mends. The bar is the kind's own hp, so a
    // level's extra health heals at the same pace
    if (a.hp < a.maxHp && a.burnT <= 0) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * dt / CAMP_REGEN_T);
  }
  a.target = t;
  // a hunt that ends, leashed or with nobody left, sends it straight home
  if (awake && !t && !M.still) campRunHome(a, true);
  // the mark over its head (drawAnimal): a monster on a hunt, and nothing else
  a.senseT = t ? a.senseT + dt : 0;

  // a bear mid set piece: planted, facing its quarry, an attack's blow
  // landing on its strike frame
  const attack = BEAR_ATTACKS.includes(a.clip);
  if (a.clip === 'roar' || attack) {
    const was = a.animT;
    stepClip(a, dt);
    if (t) {
      const d = Math.hypot(t.x - a.x, t.y - a.y) || 1;
      // the roar, and an attack's wind-up, turn with the quarry
      if (a.clip === 'roar' || (attack && was < BEAR_STRIKE)) { a.mvx = (t.x - a.x) / d; a.mvy = (t.y - a.y) / d; if (Math.abs(t.x - a.x) > 2) a.dir = t.x > a.x ? 'right' : 'left'; }
      if (attack && was < BEAR_STRIKE && a.animT >= BEAR_STRIKE && d < M.reach * BEAR_COMMIT_REACH) monsterBite(a, t, M);
    }
    if (a.animT < (attack ? BEAR_ATTACK_FRAMES : BEAR_ROAR_FRAMES)) return;
    setClip(a, 'idle');
  }

  let moving = false;
  if (a.homing) {
    // the reset: straight back to its own spot at a run, healing as it goes
    a.homeT += dt;
    if (a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * dt / CAMP_HOME_HEAL_T);
    const sx = a.spawnX === undefined ? hx : a.spawnX, sy = a.spawnY === undefined ? hy : a.spawnY;
    const n = navStep(a, sx, sy, foot, M.spd * CAMP_HOME_MUL, dt);
    if (!n.ok || n.d < 8 || a.homeT > CAMP_HOME_MAX_T) campRunHome(a, false);
    else moving = true;
  } else if (t) {
    if (a.goal) { a.goal = null; navClear(a); } // the patrol is off; the quarry is the route now
    // run the route to the quarry; in reach (a route step there only shoves
    // at the body it is already touching), or with no route (it is out over
    // water, or the camp has it pinned), hold and face it
    const near = Math.hypot(t.x - a.x, t.y - a.y);
    const n = near < M.reach || M.still ? { ok: false, d: near } : navStep(a, t.x, t.y, foot, M.spd, dt);
    const d = n.d || 1;
    if (!n.ok) { a.mvx = (t.x - a.x) / d; a.mvy = (t.y - a.y) / d; }
    moving = n.ok;
    if (d < M.reach && a.biteCd <= 0) {
      a.biteCd = M.cd;
      if (ANIM_CLIPS[a.kind].bite) { // a bear winds up first: the blow lands later, on the strike frame
        a.atkN = ((a.atkN === undefined ? randi(0, 1) : a.atkN) + 1) % BEAR_ATTACKS.length;
        setClip(a, BEAR_ATTACKS[a.atkN]);
        if (Math.abs(t.x - a.x) > 2) a.dir = t.x > a.x ? 'right' : 'left'; // at the quarry, not the last step of the route
        return;
      }
      monsterBite(a, t, M);
    } else if (M.spout && d < M.spout && a.biteCd <= 0) { a.biteCd = M.cd; orcaSpout(a, t, M); } // out of its lunge's reach: it spouts
  } else if (M.still || M.sleeps) {
    // nobody to hunt: it keeps its hole, or sleeps on its spot (a shove still moves it)
    if (M.sleeps && Math.abs(a.kbx) + Math.abs(a.kby) > 1) moveEntity(a, a.kbx * dt, a.kby * dt, foot);
  } else if (a.goal) {
    // patrolling its camp, on a route like any other walk
    const n = navStep(a, a.goal.x, a.goal.y, foot, 34, dt);
    if (!n.ok || n.d < 6) { a.goal = null; navClear(a); a.idleT = rand(0.8, 2.6); }
    else moving = true;
  } else {
    a.idleT -= dt;
    if (Math.abs(a.kbx) + Math.abs(a.kby) > 1) moveEntity(a, a.kbx * dt, a.kby * dt, foot);
    if (a.idleT <= 0) {
      // pick the next patrol leg, but never far from the camp it belongs to:
      // out past the ring and the only way it will walk is back toward home
      const ring = (C ? C.r : 4) * TILE * 0.8;
      const out = Math.hypot(a.x - hx, a.y - hy) > ring;
      a.goal = wanderGoal(a, out ? Math.atan2(hy - a.y, hx - a.x) : rng() * Math.PI * 2,
        out ? 0.5 : Math.PI, 2, 5);
      if (!a.goal) a.idleT = rand(0.8, 2.6);
    }
  }

  if ((moving || t) && Math.abs(a.mvx) > 0.05) a.dir = a.mvx > 0 ? 'right' : 'left';
  // standing, and coming for you; a kind with a walk (a bear) walks its
  // patrol and gallops the hunt, a wolf runs both at two paces
  const walks = !!ANIM_CLIPS[a.kind].walk;
  // a kind that rams (`lunge`) is thrown forward for a beat after each blow
  const ram = M.lunge && t && a.biteCd > M.cd - M.lunge;
  setClip(a, ram ? 'lunge' : moving ? (t || a.homing || !walks ? 'run' : 'walk') : M.sleeps && !t ? 'sleep' : 'idle');
  stepClip(a, dt, moving && !walks ? (a.homing ? 2 : t ? 1.5 : 0.75) : a.homing ? CAMP_HOME_MUL * 0.75 : 1);
}

// The reset, League's way: the moment a hunt ends a monster turns and RUNS
// back to the spot it was stocked on (spawnCampMonster), CAMP_HOME_MUL its
// hunting speed, healing to full on the way and untouchable while it goes -
// invuln, so a blow (hurtUnit), a sweep (unitsHit) and a shot (homingLand)
// all pass it, nothing it wears holds it (updateAnimal), and a hit on the
// camp does not wake it. A camp you leave cannot be kited home or chipped
// on the way. `on` false: it is there (or its route is lost), and it settles.
function campRunHome(a, on) {
  a.homing = on; a.homeT = 0; a.invuln = on ? 1 : 0;
  a.goal = null; navClear(a);
  if (on) { a.threat = 0; clearUnitStatus(a); }
  else { a.hp = a.maxHp; a.idleT = rand(0.8, 2.6); }
}

// one camp monster's blow on its quarry: the hurt, the spray, the sound
function monsterBite(a, t, M) {
  damagePlayer(t, M.bite + M.lvBite * (a.level - 1), a.mvx, a.mvy, null, M.cause);
  burst(a.x + a.mvx * (M.big ? 28 : 6), a.y - (M.big ? 8 : 4), '#cfd8e8', M.big ? 9 : 5, 40, 0.35);
  sfxAt('bite', a.x, a.y);
}



