'use strict';
// SAGITTA, THE BOLT-THROWER - a named hero (CLASSES, js/sim/player.js) and the
// siege marksman: a heavy crossbow with the longest reach of any marksman and
// a slow, hard loose. Every third bolt is a heavy one that shoves and breaks
// towers; she pins rivals to the trees, plants a pavise to shoot from behind,
// cranks herself back out of a dive, and kneels for one long bolt across the
// screen. She built the empire's siege engines and was thrown out when one was
// turned on the city that paid for it.
// Loaded before abilities.js, whose CLASS_AB takes SAGITTA_AB as her row of keys;
// she registers into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ sagitta

// ---- tuning --------------------------------------------------------------
// HEAVY BOLTS (the passive): every third basic bolt she looses is a heavy one -
// it lands harder, shoves the body it hits, and a building takes extra from it
const HEAVY_EVERY = 3;          // the third bolt
const HEAVY_DMG = 1.4;          // its damage x this
const HEAVY_KB = 2.6;           // its shove x this
const HEAVY_SIEGE = 1.6;        // ...and a building takes x this on top
// Q PIN: a bolt down the aim; the first body it meets is shoved back, and pinned
// (stunned) when a tree, a rock or a wall stands close behind it
const PIN_SPD = 520;            // px/s
const PIN_RANGE = 230;          // px
const PIN_KB = 3.5;             // the shove, x a shot's
const PIN_WALL = 40;            // px behind the body that pins it
// W PAVISE: a tall shield planted in front of her, facing the aim. It is a body
// (HERO_MACHINE): a rival's shot that meets its face ends on it (from behind it goes by),
// and rivals break it
const PAV_D = 14;               // px in front of her feet
const PAV_T = 4;                // s it stands
const PAV_FRONT = 0.3;          // a shot it stops flies at least this much against its facing (cos of ~72 deg off head-on)
// E CRANK BACK: a bolt into the snow at her feet throws her back, away from the
// aim, and slows whoever is near
const CRANK_SPD = 330;          // px/s
const CRANK_D = 72;             // px thrown
const CRANK_R = 40;             // px round her feet it slows
const CRANK_SLOW = 0.55;        // walk x this
const CRANK_DMG = 25;           // to each body near
const CRANK_FX_LIFE = 0.55;     // s the crater shows (drawn: AB_FX_LOOK.crank)
// R THE LONG BOLT: she kneels and draws (the towers' dashed line on the snow),
// then looses one bolt across most of the screen: through soldiers and beasts,
// ending on the first hero, who is thrown far back
const LONG_SPD = 760;           // px/s
const LONG_RANGE = 540;         // px
const LONG_KB = 4;              // the shove, x a shot's
const LONG_WIND = 1;            // s she kneels

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const SAGITTA_AB = [
  {
    id: 'pin', name: 'PIN', cd: [11, 10.5, 10, 9.5, 9], ap: 0.6, cast: 0.25, aim: { line: PIN_RANGE }, aimHeld: true, // the crossbow on the aim through the wind-up (castAims, js/draw/bodies.js)
    rank: { dmg: [50, 80, 110, 140, 170], stun: 1.2 }, // dmg: the bolt; stun: s pinned
    tip: 'A BOLT THAT PINS RIVALS TO TREES',
    blurb: 'A BOLT DOWN THE LINE. THE FIRST RIVAL IT HITS IS SHOVED BACK, AND PINNED IN PLACE IF A TREE, A ROCK OR A WALL IS BEHIND THEM.',
    use: (p) => sagittaPin(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawSightLine(p, a, PIN_RANGE, closing, now, ex, ey, false), // her sight down the bolt's line (js/draw/sagitta.js)
    pose: () => ({ dx: 0, dy: 0, rot: 0 }),
    icon: SAGITTA_ICON32.pin,
    bot: (p, foe, d, clear) => clear && d < PIN_RANGE - 10,
  },
  {
    id: 'pavise', name: 'PAVISE', cd: [16, 15, 14, 13, 12], cast: 0.2, aim: { line: PAV_D + 10 },
    rank: { shield: [120, 170, 220, 270, 320] }, // shield: the pavise's health
    tip: 'PLANT A SHIELD THAT STOPS RIVAL SHOTS',
    blurb: 'PLANT A TALL SHIELD IN FRONT OF YOU FOR A FEW SECONDS. RIVAL SHOTS THAT MEET ITS FACE STOP ON IT. RIVALS CAN BREAK IT.',
    use: (p) => sagittaPavise(p),
    tele: (p, px, py, a, col, closing) => drawPaviseTele(p, Math.round(px + Math.cos(a) * PAV_D), Math.round(py + 2 + Math.sin(a) * PAV_D), a, closing), // the shield coming up where it plants
    pose: () => ({ dx: 0, dy: 1, rot: 0 }),
    icon: SAGITTA_ICON32.pavise,
    bot: (p, foe, d) => foe instanceof Player && d > 70 && d < 260 && p.hp < p.maxHp * 0.8, // cover once the trade is going against her
  },
  {
    id: 'crank', name: 'CRANK BACK', cd: [14, 13, 12, 11, 10], cast: 0.05,
    rank: { slowT: [1, 1.25, 1.5, 1.75, 2] }, // slowT: s the slow holds
    tip: 'SHOOT YOUR FEET. JUMP BACK, SLOW THOSE NEAR',
    blurb: 'FIRE A BOLT INTO THE SNOW AT YOUR FEET. YOU ARE THROWN BACK, AWAY FROM YOUR AIM, AND RIVALS NEAR YOU ARE HIT AND SLOWED.',
    use: (p) => sagittaCrank(p),
    pose: () => ({ dx: 0, dy: 0, rot: 0 }),
    icon: SAGITTA_ICON32.crank,
    bot: (p, foe, d) => d < 50,
  },
  {
    id: 'longbolt', name: 'THE LONG BOLT', cd: [110, 95, 80], ap: 0.9, cast: LONG_WIND, aim: { line: LONG_RANGE }, aimHeld: true,
    rank: { dmg: [180, 280, 380] }, // dmg: the first hero hit
    tip: 'KNEEL. ONE BOLT ACROSS THE SCREEN',
    blurb: 'KNEEL AND DRAW, THEN LOOSE ONE BOLT ACROSS MOST OF THE SCREEN. IT GOES THROUGH SOLDIERS AND BEASTS. THE FIRST HERO IT HITS TAKES HEAVY DAMAGE AND IS THROWN FAR BACK.',
    use: (p) => sagittaLong(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawSightLine(p, a, LONG_RANGE, closing, now, ex, ey, true), // her sight drawn tight across the field
    pose: () => ({ dx: 0, dy: 2, rot: 0 }), // down on one knee
    icon: SAGITTA_ICON32.longbolt,
    bot: (p, foe, d, clear) => foe instanceof Player && clear && d > 90 && d < LONG_RANGE - 40 && foe.hp < foe.maxHp * 0.55,
  },
];

function isSagitta(p) { return p instanceof Player && CLASSES[p.cls].passive === 'heavybolts'; }
// a bolt of hers in flight: the shaft every shot is (arrows, js/sim/sim.js) from her
// crossbow at the aim, `look` how it is drawn (HERO_SHOTS, js/draw/sagitta.js)
function sagittaBolt(p, spd, range, o) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y), a = Math.atan2(dy, dx);
  const b = Object.assign({
    x: p.x, y: p.y - BOW_Y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
    t: 0, life: range / spd, pow: 1, owner: p.id, team: p.team, trailD: 0,
    solid: true, kb: 1, col: '#c3ccd8', ang: a, spd, ox: p.x, oy: p.y - BOW_Y,
  }, o);
  arrows.push(b);
  faceToward(p, dx, dy, true);
  return b;
}

// ---- HEAVY BOLTS -------------------------------------------------------------------
// the loose hook (HERO_PASSIVE `shot`): every third basic bolt is a heavy one
function sagittaShot(p, a) {
  p.boltN = ((p.boltN || 0) + 1) % HEAVY_EVERY;
  if (p.boltN !== 0) return;
  a.dmg = Math.round(a.dmg * HEAVY_DMG);
  a.kb *= HEAVY_KB;
  a.siege = HEAVY_SIEGE;
  a.look = 'heavybolt';
}
function sagittaOut(p) {
  if (p.dash === 'crank') { p.rushT = 0; p.dash = ''; }
}
// she stands still to kneel for the long bolt (HERO_MOVE)
function sagittaMoveMul(p) {
  if (!isSagitta(p) || !(p.castT > 0)) return 1;
  const ab = abOf(p, p.castAb);
  return ab && ab.id === 'longbolt' ? 0 : 1;
}

// ---- Q PIN ----------------------------------------------------------------------
function sagittaPin(p) {
  sagittaBolt(p, PIN_SPD, PIN_RANGE, { dmg: abDmg(p, 'pin', abRk(p, 'pin', 'dmg')), kb: PIN_KB, ab: 'pin',
    hit: 'pin', stun: abRk(p, 'pin', 'stun'), look: 'pinbolt' });
  sfxAt('arrow', p.x, p.y);
}
// the bolt landed on a body (HERO_SHOT_HIT): pinned where something solid stands behind it
function pinHit(a, t, nx, ny) {
  if (!unitAlive(t) || isAnchored(t) || !solidBehind(t.x, t.y, nx, ny, PIN_WALL)) return;
  stunUnit(t, a.stun, players[a.owner]);
  if (t instanceof Player) { t.kbx = 0; t.kby = 0; } else { t.kbx = 0; t.kby = 0; t.vx = 0; t.vy = 0; }
  burst(t.x + nx * 6, unitMidY(t) + ny * 4, '#ffd95c', 10, 50, 0.5, true);
  sfxAt('break_', t.x, t.y);
}

// ---- W PAVISE ---------------------------------------------------------------------
// a robot body (robotBody, js/sim/robots.js) of her side: hit, shot at, pushed
// apart and fogged like a soldier; it stands until its time runs out
function sagittaPavise(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  let x = p.x + dx / d * PAV_D, y = p.y + dy / d * PAV_D;
  if (isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE))) { x = p.x; y = p.y; }
  // one pavise of hers at a time: the old one comes down
  for (const b of robots) if (b.kind === 'sagPavise' && b.owner === p.id && !b.dead) pavDown(b);
  const hp = abRk(p, 'pavise', 'shield');
  const b = robotBody(x, y, hp, p.team, p.id, 0);
  b.kind = 'sagPavise'; b.life = PAV_T; b.lifeMax = PAV_T;
  b.ang = Math.atan2(dy, dx);
  robots.push(b);
  faceToward(p, dx, dy, true);
  burst(x, y, '#dfe8f4', 10, 40, 0.4, true);
  sfxAt('place', x, y);
}
function pavDown(b) {
  b.dead = true;
  burst(b.x, b.y - 6, '#a3794f', 8, 35, 0.4, true);
  sfxAt('place', b.x, b.y);
}
// a shot is stopped only flying into its face; from behind or along its edge it goes by
// (HERO_MACHINE `passes`, shotContacts in js/sim/sim.js)
function pavPasses(b, nx, ny) { return nx * Math.cos(b.ang) + ny * Math.sin(b.ang) > -PAV_FRONT; }
// it stands: no shove moves it, no brain turns it, and its time runs down
function stepPavise(b, dt) {
  b.kbx = 0; b.kby = 0; b.moving = false;
  const o = players[b.owner];
  if ((b.life -= dt) <= 0 || !o || o.team !== b.team) pavDown(b);
}

// ---- E CRANK BACK ---------------------------------------------------------------------
// The jump rides the charge state (rushT, HERO_DASH) at its own pace, away from the aim.
function sagittaCrank(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const slowT = abRk(p, 'crank', 'slowT');
  for (const q of unitsHit(p, p.x, p.y, CRANK_R)) {
    const qd = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    hurtUnit(q, abDmg(p, 'crank', CRANK_DMG), (q.x - p.x) / qd, (q.y - p.y) / qd, p, { kb: 20, slow: [slowT, CRANK_SLOW] });
  }
  if (PRACTICE) abHitDummies(p.x, p.y, CRANK_R, CRANK_DMG);
  p.rushNX = -dx / d; p.rushNY = -dy / d;
  p.rushT = CRANK_D / CRANK_SPD;
  p.dash = 'crank';
  p.sliding = false;
  faceToward(p, dx, dy, true); // she lands still facing what she shot at
  burst(p.x, p.y + 4, '#eef4fb', 14, 60, 0.45, true);
  burst(p.x, p.y + 4, '#a3794f', 5, 40, 0.35, true);
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: CRANK_R, t: 0, col: '#eef4fb', fx: 'crank', life: CRANK_FX_LIFE });
  sfxAt('hit', p.x, p.y);
}
function crankStep(p, mv) {
  if (mv.blockedX || mv.blockedY || p.rushT <= 0) {
    p.rushT = 0; p.dash = '';
    p.vx = p.rushNX * 50; p.vy = p.rushNY * 50;
  }
}

// ---- R THE LONG BOLT -------------------------------------------------------------------
function sagittaLong(p) {
  sagittaBolt(p, LONG_SPD, LONG_RANGE, { dmg: abDmg(p, 'longbolt', abRk(p, 'longbolt', 'dmg')), kb: LONG_KB, ab: 'longbolt',
    hit: 'longbolt', pierce: true, pierceHit: [], look: 'longbolt' });
  burst(p.x, p.y - BOW_Y, '#f4f7ff', 10, 60, 0.4, true);
  sfxAt('arrow', p.x, p.y);
}
// it ends on the first hero it meets (HERO_SHOT_HIT): the soldiers and beasts before it are pierced
function longHit(a, t) {
  if (!(t instanceof Player)) return;
  a.pierce = false;
  burst(t.x, unitMidY(t), '#f4f7ff', 12, 70, 0.5, true);
}

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.heavybolts = { shot: sagittaShot, out: sagittaOut,
  name: 'HEAVY BOLTS', blurb: 'EVERY THIRD BOLT YOU LOOSE IS A HEAVY ONE: IT HITS HARDER, SHOVES WHAT IT HITS BACK A STEP, AND TOWERS TAKE EXTRA FROM IT.',
  icon: SAGITTA_ICON32.heavy };
HERO_DASH.crank = { spd: CRANK_SPD, t: CRANK_D / CRANK_SPD, ramp: 0.02, step: crankStep };
HERO_MACHINE.sagPavise = { step: stepPavise, draw: (b, ex, ey, now) => drawSagittaPavise(b, ex, ey, now), r: 7, hitR: 10, mass: 400, sight: 40, pay: { gold: 15, xp: 10 }, passes: pavPasses };
HERO_SHOT_HIT.pin = pinHit;
HERO_SHOT_HIT.longbolt = longHit;
HERO_MOVE.push(sagittaMoveMul);
