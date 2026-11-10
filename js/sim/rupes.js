'use strict';
// RUPES, THE AVALANCHE - a named hero (CLASSES, js/sim/player.js) and a tank who
// engages: slow to start, impossible to stop once he is rolling. The hits he
// takes pack snow onto him, the pack takes a share of every hit, and he can
// shed it in one burst. His ultimate is the slope itself: a snowball that grows
// the further it rolls and bursts on the first hero. Loaded before
// abilities.js, whose CLASS_AB takes RUPES_AB as his row of keys; he registers
// into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ rupes

// ---- tuning --------------------------------------------------------------
// SNOWPACK (the passive): p.pack 0..1, PACK_LAYERS layers of it. Hits taken pack it;
// full, it takes a share of every hit. Out of a fight it melts; deep snow packs it.
const PACK_LAYERS = 3;          // layers in a full pack (SHED pays per layer)
const PACK_FILL = 0.25;         // share of his most health taken (after armor) to fill it
const PACK_CUT = 0.15;          // full: this share of every hit is the snow's
const PACK_IDLE_T = 5;          // s without a hit before it melts...
const PACK_MELT = 0.2;          // ...this much of it a second
const PACK_DEEP = 0.12;         // a second walking through deep snow packs this much
// Q HEAVE: a block of packed snow thrown down the aim
const HEAVE_SPD = 250;          // px/s
const HEAVE_RANGE = 150;        // px of flight
const HEAVE_PACK = 0.34;        // pack gained when it hits a hero (a layer)
// W SHED: the pack shaken off in a ring
const SHED_R = 36;              // px of ring
const SHED_FX_LIFE = 0.65;      // s the shed snow flies and lies (drawn: AB_FX_LOOK.shed)
// E SHOULDER: a short charge; the first rival body met is thrown the way he ran
const SHOULDER_SPD = 300;
const SHOULDER_T = 0.24;        // s of charge (~4.5 tiles)
const SHOULDER_RAMP = 0.05;
const SHOULDER_KB = 240;        // px/s the body is thrown
const SHOULDER_PIN = 30;        // px behind the body a tree, a rock or a wall pins it: stunned
// R AVALANCHE: the roll. Speed climbs as it goes; the ring and the hold grow
// with the distance rolled, full at AVA_FULL px
const AVA_SPD0 = 140, AVA_SPD1 = 270; // px/s at the start, and at full
const AVA_T = 1.6;              // s it rolls at most (~350 px)
const AVA_STEER = 1.5;          // rad/s it bends toward the aim
const AVA_FULL = 300;           // px rolled for the biggest burst
const AVA_R0 = 26, AVA_R1 = 58; // px of the burst's ring, unrolled and at full
const AVA_UP_GROW = 0.8;        // the knock-up at full is (1 + this) x the rank's
const AVA_FX_LIFE = 0.8;        // s the burst's powder hangs (drawn: AB_FX_LOOK.powder)
const AVA_SHOVE = 180;          // px/s a lesser body is thrown off the line

// ---- the keys ---------------------------------------------------------------
// His row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const RUPES_AB = [
  {
    id: 'heave', name: 'HEAVE', cd: [8, 7.5, 7, 6.5, 6], ap: 0.5, cast: 0.25, aim: { line: HEAVE_RANGE },
    rank: { dmg: [14, 20, 26, 32, 38], slow: 0.65, slowT: 1.5 },
    tip: 'THROW SNOW. SLOWS. A HERO HIT PACKS YOU',
    blurb: 'THROW A BLOCK OF PACKED SNOW. THE FIRST RIVAL HIT IS SLOWED. HIT A HERO AND YOU PACK ON A LAYER OF SNOW.',
    use: (p) => rupesHeave(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawHeaveTele(p, a, closing, ex, ey), // the block torn up, its flight's shadow (js/draw/rupes.js)
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.7 ? -2 : 1, rot: 0 }), // the block lifted overhead, then thrown
    icon: RUPES_ICON32.heave,
    bot: (p, foe, d, clear) => clear && d < HEAVE_RANGE - 10,
  },
  {
    id: 'shake', name: 'SHED', cd: [10, 9.5, 9, 8.5, 8], ap: 0.5, cast: 0.2, aim: { ring: SHED_R },
    rank: { dmg: [10, 14, 18, 22, 26], layer: [8, 11, 14, 17, 20], slow: 0.6, slowT: 1 }, // dmg: the ring's own; layer: more for each layer shed; slowT: +half for each layer
    tip: 'BURST OF SNOW. MORE FOR EACH LAYER SHED',
    blurb: 'SHAKE OFF YOUR SNOWPACK IN A BURST. RIVALS NEAR ARE HURT AND SLOWED, MORE FOR EACH LAYER YOU SHED. IT COSTS THE PACK.',
    use: (p) => rupesShed(p),
    tele: (p, px, py, a, col, closing, now) => drawShedTele(p, px, py, closing, now), // the snow shaking loose round him
    pose: (p, prog) => ({ dx: Math.round(Math.sin(prog * 30)), dy: 0, rot: 0 }), // the shake
    icon: RUPES_ICON32.shake,
    bot: (p, foe, d) => d < SHED_R - 4 && (packLayers(p) >= 2 || foe.hp < foe.maxHp * 0.3),
  },
  {
    id: 'shoulder', name: 'SHOULDER', cd: [13, 12, 11, 10, 9], ap: 0.4, cast: 0.15, aim: { line: SHOULDER_SPD * SHOULDER_T },
    rank: { dmg: [12, 18, 24, 30, 36], stun: 1 }, // stun: thrown into a tree or a wall (isSolidTile: trees, the map's edge, buildings)
    tip: 'CHARGE. INTO A TREE OR WALL, STUNS',
    blurb: 'A SHORT CHARGE. THE FIRST RIVAL IN THE WAY IS THROWN BACK THE WAY YOU RAN. THROWN INTO A TREE OR A WALL, THEY ARE STUNNED.',
    use: (p) => rupesShoulder(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawShoulderTele(p, a, closing, ex, ey), // the furrow he will plough
    pose: (p, prog) => ({ dx: 0, dy: 1, rot: 0.12 * (p.dir === 'left' ? -1 : 1) }), // the shoulder dropped
    icon: RUPES_ICON32.shoulder,
    bot: (p, foe, d, clear) => clear && foe instanceof Player && d < SHOULDER_SPD * SHOULDER_T - 6,
  },
  {
    id: 'avalanche', name: 'AVALANCHE', cd: [100, 85, 70], ap: 0.8, cast: 0.5, aim: { line: AVA_FULL },
    rank: { dmg: [50, 85, 120], up: [0.6, 0.75, 0.9] }, // the burst; up: s in the air unrolled (grows with the roll)
    tip: 'ROLL AS A SNOWBALL. BIGGER THE FURTHER',
    blurb: 'CURL UP AND ROLL AS A SNOWBALL THAT GROWS THE FURTHER IT GOES. YOU CAN STEER A LITTLE. ON THE FIRST HERO, OR AT THE END, IT BURSTS AND KNOCKS UP EVERYONE AROUND IT.',
    use: (p) => rupesAvalanche(p),
    tele: (p, px, py, a, col, closing, now) => drawAvalancheTele(p, px, py, a, closing, now), // the snow rolling up round him
    pose: () => ({ dx: 0, dy: 2, rot: 0 }), // curled down
    icon: RUPES_ICON32.avalanche,
    bot: (p, foe, d, clear) => foe instanceof Player && d > 60 && d < AVA_FULL && clear,
  },
];

// ---- SNOWPACK ---------------------------------------------------------------------
function packLayers(p) { return Math.floor(p.pack * PACK_LAYERS + 1e-6); }
function packGain(p, n) {
  const was = packLayers(p);
  p.pack = Math.min(1, p.pack + n);
  if (packLayers(p) > was) { burst(p.x, p.y - 8, '#f4f7ff', 6, 35, 0.4, true); if (p.pack >= 1) sfxFor(p, 'pickup'); }
}
function packHurt(p, dmg, src) {
  if (dmg <= 0 || !src || src === p) return;
  p.packIdle = 0;
  packGain(p, dmg / (p.maxHp * PACK_FILL));
}
// full, the snow takes its share of every hit (HERO_TAKEN, after armor)
function packTaken(p, dmg) {
  if (!(p.pack >= 1) || dmg <= 0 || CLASSES[p.cls].passive !== 'snowpack') return dmg;
  burst(p.x, p.y - 8, '#f4f7ff', 2, 30, 0.3, true);
  return Math.max(1, Math.round(dmg * (1 - PACK_CUT)));
}
HERO_TAKEN.push(packTaken);
function packTick(p, dt) {
  if (p.rushT > 0 && p.dash === 'avalanche') return; // the snowball is all pack
  if (p.moving && deepAt(p.x, p.y + 4)) { packGain(p, PACK_DEEP * dt); p.packIdle = 0; return; }
  p.packIdle += dt;
  if (p.packIdle > PACK_IDLE_T && p.pack > 0) p.pack = Math.max(0, p.pack - PACK_MELT * dt);
}
// HEAVE on a hero packs him a layer (o.ab names the key that landed the blow)
function packDeal(p, e, dmg, o) {
  if (o.ab === 'heave' && e instanceof Player && e.team !== p.team) packGain(p, HEAVE_PACK);
  return dmg;
}
function packOut(p) { p.pack = 0; p.packIdle = 0; p.avaD = 0; p.shoulderHit = false; }

// ---- Q HEAVE ------------------------------------------------------------------------
// The block rides the shots in flight (arrows, js/sim/sim.js) and lands its
// blow there with its own slow (hurtUnit's `slow`), at the rank it was thrown with.
function rupesHeave(p) {
  const a = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
  arrows.push({
    x: p.x, y: p.y - BOW_Y,
    vx: Math.cos(a) * HEAVE_SPD, vy: Math.sin(a) * HEAVE_SPD,
    t: 0, life: HEAVE_RANGE / HEAVE_SPD, dmg: abDmg(p, 'heave', abRk(p, 'heave', 'dmg')), pow: 1,
    owner: p.id, team: p.team, trailD: 0,
    solid: true, kb: 0.8, col: '#f4f7ff', ab: 'heave',
    slow: [abRk(p, 'heave', 'slowT'), abRk(p, 'heave', 'slow')], // [s, walk x]: put on as the blow lands
    look: 'snowblock', // drawn as the block (HERO_SHOTS, js/draw/rupes.js)
    ang: a, spd: HEAVE_SPD, ox: p.x, oy: p.y - BOW_Y,
  });
  burst(p.x + Math.cos(a) * 7, p.y - BOW_Y + Math.sin(a) * 7, '#f4f7ff', 6, 45, 0.3, true);
  sfxAt('arrow', p.x, p.y);
}

// ---- W SHED --------------------------------------------------------------------------
function rupesShed(p) {
  const n = packLayers(p);
  p.pack = 0;
  const dmg = abDmg(p, 'shake', abRk(p, 'shake', 'dmg') + n * abRk(p, 'shake', 'layer'));
  const slowT = abRk(p, 'shake', 'slowT') * (1 + 0.5 * n), slow = abRk(p, 'shake', 'slow');
  for (const q of unitsHit(p, p.x, p.y, SHED_R)) {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    hurtUnit(q, dmg, (q.x - p.x) / d, (q.y - p.y) / d, p, { kb: 60 + 30 * n });
    if (!q.dead) slowUnit(q, slowT, slow);
    burst(q.x, unitMidY(q), '#f4f7ff', 6, 45, 0.4, true);
  }
  for (const s of structsNear(p, p.x, p.y, SHED_R)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x, p.y, SHED_R, dmg);
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: SHED_R, t: 0, col: '#f4f7ff', fx: 'shed', life: SHED_FX_LIFE, n });
  burst(p.x, p.y - 6, '#f4f7ff', 10 + 8 * n, 70 + 15 * n, 0.5, true);
  burst(p.x, p.y - 6, '#cfd8e8', 6 + 4 * n, 50, 0.5, true);
  sfxAt('break_', p.x, p.y);
}

// ---- E SHOULDER ------------------------------------------------------------------------
// The charge rides the rush's state (HERO_DASH, js/sim/heroes.js), as ARMATOS's march.
function rupesShoulder(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = SHOULDER_T;
  p.dash = 'shoulder';
  p.sliding = false;
  faceToward(p, dx, dy, true);
  burst(p.x, p.y + 4, '#dfe8f4', 6, 40, 0.4, true);
  sfxAt('dodge', p.x, p.y);
}
HERO_DASH.shoulder = { spd: SHOULDER_SPD, t: SHOULDER_T, ramp: SHOULDER_RAMP, step: (p, mv, dt) => shoulderStep(p, mv) };
function shoulderStep(p, mv) {
  const q = unitsHit(p, p.x + p.rushNX * 3, p.y + p.rushNY * 3, ROLL_HIT_R + PLAYER_R + 2)[0];
  if (q) { shoulderEnd(p, q); return; }
  if (mv.blockedX || mv.blockedY || p.rushT <= 0) shoulderEnd(p, null);
}
// is there a tree or a wall within `r` px of (x, y) along (nx, ny)
function solidBehind(x, y, nx, ny, r) {
  for (let s = 6; s <= r; s += 4) if (isSolidTile(Math.floor((x + nx * s) / TILE), Math.floor((y + ny * s) / TILE))) return true;
  return false;
}
function shoulderEnd(p, q) {
  p.rushT = 0;
  p.dash = '';
  p.vx = p.rushNX * 40; p.vy = p.rushNY * 40;
  if (!q) return;
  const nx = p.rushNX, ny = p.rushNY;
  const pinned = !isAnchored(q) && solidBehind(q.x, q.y, nx, ny, SHOULDER_PIN);
  hurtUnit(q, abDmg(p, 'shoulder', abRk(p, 'shoulder', 'dmg')), nx, ny, p, { kb: isAnchored(q) ? 0 : SHOULDER_KB, ab: 'shoulder' });
  if (!q.dead && !isAnchored(q)) {
    if (q instanceof Player) { q.kbx += nx * SHOULDER_KB * 0.6; q.kby += ny * SHOULDER_KB * 0.6; }
    if (pinned) {
      stunUnit(q, abRk(p, 'shoulder', 'stun'), p);
      burst(q.x + nx * 8, unitMidY(q) + ny * 6, '#ffd95c', 10, 50, 0.5, true);
      sfxAt('break_', q.x, q.y);
    }
  }
  p.vx = -nx * 30; p.vy = -ny * 30; // the blow rocks him back
  burst(q.x, unitMidY(q), '#eef4fb', 8, 50, 0.45, true);
  sfxAt('hit', q.x, q.y);
}

// ---- R AVALANCHE ------------------------------------------------------------------------
// The roll rides the rush's state too, at a pace it sets itself each step (the
// dash's own `spd` is its top speed; avaStep rescales the step it was given).
// p.avaD is the px rolled: what sizes the ball and the burst.
function rupesAvalanche(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = AVA_T;
  p.dash = 'avalanche';
  p.marchHit.length = 0;
  p.avaD = 0;
  p.sliding = false;
  faceToward(p, dx, dy, true);
  burst(p.x, p.y + 2, '#f4f7ff', 12, 50, 0.5, true);
  sfxAt('dodge', p.x, p.y);
}
// how big the roll has grown, 0..1
function avaGrow(p) { return Math.min(1, (p.avaD || 0) / AVA_FULL); }
// the ball's radius on the snow, px (drawn, and what it meets)
function avaRadius(p) { return 6 + Math.round(6 * avaGrow(p)); }
HERO_DASH.avalanche = { spd: AVA_SPD1, t: AVA_T, ramp: 0.2, step: (p, mv, dt) => avaStep(p, mv, dt), pose: () => ({ dx: 0, dy: 2, rot: 0 }) };
function avaStep(p, mv, dt) {
  // it picks up speed as it goes: the step the rush state just took at the
  // dash's top speed is walked back to the pace the roll has grown to
  const pace = (AVA_SPD0 + (AVA_SPD1 - AVA_SPD0) * avaGrow(p)) / AVA_SPD1;
  const back = 1 - pace;
  if (back > 0) moveEntity(p, -p.vx * dt * back, -p.vy * dt * back, PLAYER_R);
  p.avaD += Math.hypot(p.vx, p.vy) * dt * pace;
  // the aim bends it, a little
  const want = Math.atan2(p.input.aimY - p.y, p.input.aimX - p.x), have = Math.atan2(p.rushNY, p.rushNX);
  let da = want - have;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const turn = Math.max(-AVA_STEER * dt, Math.min(AVA_STEER * dt, da));
  p.rushNX = Math.cos(have + turn); p.rushNY = Math.sin(have + turn);
  faceToward(p, p.rushNX, p.rushNY, true);
  p.rushFxT = (p.rushFxT || 0) - dt;
  if (p.rushFxT <= 0) { p.rushFxT = 0.04; burst(p.x - p.rushNX * avaRadius(p), p.y + 4, '#f4f7ff', 2 + Math.round(2 * avaGrow(p)), 30, 0.4, true); }
  const r = avaRadius(p);
  for (const q of unitsHit(p, p.x + p.rushNX * 3, p.y + p.rushNY * 3, r + PLAYER_R)) {
    if (q instanceof Player || isAnchored(q)) { avaBurst(p); return; } // a hero, or a bear nothing shoves: it bursts
    if (p.marchHit.includes(q)) continue;
    p.marchHit.push(q); // a lesser body is thrown off the line, to whichever side it stood
    const side = (q.x - p.x) * -p.rushNY + (q.y - p.y) * p.rushNX >= 0 ? 1 : -1;
    hurtUnit(q, Math.round(abDmg(p, 'avalanche', abRk(p, 'avalanche', 'dmg')) * 0.25), -p.rushNY * side, p.rushNX * side, p, { kb: AVA_SHOVE, ab: 'avalanche' });
  }
  if (mv.blockedX || mv.blockedY || p.rushT <= 0) avaBurst(p);
}
// the end of the roll, wherever it is: the ball bursts and throws up everyone round it
function avaBurst(p) {
  const g = avaGrow(p);
  p.rushT = 0;
  p.dash = '';
  p.marchHit.length = 0;
  p.vx = p.rushNX * 30; p.vy = p.rushNY * 30;
  const R = Math.round(AVA_R0 + (AVA_R1 - AVA_R0) * g);
  const dmg = abDmg(p, 'avalanche', abRk(p, 'avalanche', 'dmg'));
  const up = abRk(p, 'avalanche', 'up') * (1 + AVA_UP_GROW * g);
  for (const q of unitsHit(p, p.x, p.y, R)) {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    hurtUnit(q, dmg, (q.x - p.x) / d, (q.y - p.y) / d, p, { kb: 50, ab: 'avalanche' });
    if (!q.dead) knockUp(q, up, p);
    burst(q.x, unitMidY(q), '#f4f7ff', 8, 55, 0.5, true);
  }
  for (const s of structsNear(p, p.x, p.y, R)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x, p.y, R, dmg);
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: R, t: 0, col: '#f4f7ff', fx: 'powder', life: AVA_FX_LIFE });
  burst(p.x, p.y - 4, '#f4f7ff', 20 + Math.round(24 * g), 70 + 50 * g, 0.6, true);
  burst(p.x, p.y - 4, '#cfd8e8', 10 + Math.round(10 * g), 50, 0.6, true);
  packGain(p, 1); // he comes out of it packed in snow
  p.avaD = 0;
  sfxAt('break_', p.x, p.y);
}

// ---- the hooks he registers (js/sim/heroes.js) ------------------------------------------
HERO_PASSIVE.snowpack = { hurt: packHurt, deal: packDeal, tick: packTick, out: packOut,
  name: 'SNOWPACK', blurb: 'HITS YOU TAKE PACK SNOW ONTO YOU. FULL, THE SNOW TAKES A SHARE OF EVERY HIT. DEEP SNOW PACKS IT FASTER. OUT OF A FIGHT IT MELTS.', icon: RUPES_ICON32.snowpack };
