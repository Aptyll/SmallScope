'use strict';
// The bots: the body a wave's soldier and each side's merchant share, the
// merchant, the waves and the soldiers' march. Everything here is sim.
// ------------------------------------------------------------ bots
// The body every bot stands in, wherever it came from: a wave's soldier
// (makeSoldier) or a hero's own machine (faberMachine, js/sim/faber.js)
function robotBody(sx, sy, hp, team, owner, animT) {
  const b = {
    bot: true, // a machine, not wildlife: what isAnimalUnit (js/sim/actions.js) reads
    x: sx, y: sy, hp, maxHp: hp, vx: 0, vy: 0, // vx/vy: a bot never drifts, but a rival's aim leads by them (updateAI)
    team, owner,
    tgt: null, atkCd: 0, nav: null,
    atkAim: null, // what a soldier is swinging at right now (drawRobot reads it)
    animT, flash: 0, kbx: 0, kby: 0, dead: false, moving: false,
    zip: -1, zipD: 0, zipDir: 1, zipLast: 0, // the zipline (js/sim/zipline.js), the player's own fields: a soldier rides it (soldierBoard)
  };
  // a bot takes every state a player can be put under - snared, netted,
  // marked, alight - written by the same setters (`status effects`,
  // js/sim/actions.js). A soldier is not a different rulebook.
  clearUnitStatus(b);
  return b;
}

// A bot is a 12x10 body standing on its treads at b.y + 4, so the disc a
// shot lands in is centred a pixel above the anchor. The arrow loop sweeps a
// shot's step against it (sweepDisc, js/sim/sim.js).
const ROBOT_HIT_R = 7;
function robotHitY(b) { return b.y - 1; }
function robotHitR(b) { const M = heroMachine(b); return M ? M.hitR : ROBOT_HIT_R; } // a hero's machine (HERO_MACHINE) is its own size

// px/s a chassis is shoved by an ordinary blow. hurtUnit writes over it for
// anything carrying a shove of its own or a KNOCKBACK multiplier.
const ROBOT_KB = 40;
// a blow landing on a bot. src is the shooter, for the feed line on the kill. Reached
// only through hurtUnit, which asks unitAlive first, so a merchant never
// arrives here - the guard below is the same question asked twice on purpose,
// since this is a named function and nothing stops a later caller finding it.
function hurtRobot(b, dmg, nx, ny, src, cue) {
  if (!unitAlive(b)) return;
  b.hp -= dmg;
  b.flash = 0.12;
  b.kbx = nx * ROBOT_KB; b.kby = ny * ROBOT_KB;
  tallyHit(b, dmg);
  // whether a hero's blow is in the total it is running (b.tallyBy): a soldier wears its number only then,
  // or two waves meeting bury the lane in each other's sums (queueTally, js/draw/overhead.js)
  if (b.tallyN === b.tallyLast) b.tallyBy = false;
  if (src instanceof Player) b.tallyBy = true;
  aiFarmLearn(src, dmg); // a bot remembers its blow for the next last hit (js/ai/ai-farm.js)
  const puff = (heroMachine(b) && heroMachine(b).puff) || ['#c3c9d3', '#ffb347']; // sparks off the plating, or a hero body's own (HERO_MACHINE `puff`)
  burst(b.x, b.y - 2, puff[0], 6, 45, 0.35, true);
  burst(b.x, b.y - 2, puff[1], 3, 40, 0.3, true);
  sfxAt(cue || 'hit', b.x, b.y); // a soldier's own blow lands quieter (waveHit, js/app/audio.js)
  if (b.hp <= 0) robotDies(b, src);
}

// The wreck. A merchant cannot be downed (unitAlive, js/sim/actions.js), so
// nothing reaches here but a soldier or a hero's machine (HERO_MACHINE, which
// pays its own `pay` and counts no farm).
function robotDies(b, src) {
  b.dead = true;
  const M = heroMachine(b);
  if (M && M.fall) M.fall(b, src); // a hero's body that is no machine (FALCO's hawk) ends its own way and leaves no wreck
  else {
    sfxAt('break_', b.x, b.y);
    unitFall('R', soldierType(b).spr, '', b.team, b.x, b.y, b.faceL, fallAng(b, src)); // it comes apart where it stood (js/sim/farm.js)
    heroWreck(b, src); // what a hero makes of a wreck near them (HERO_WRECK: FABER's spare parts)
  }
  if (M) {
    if (src instanceof Player && src.team !== b.team) awardGold(src, M.pay.gold, b.x, b.y);
    shareXp(b, M.pay.xp, 1 - b.team, src);
    return;
  }
  // a soldier carries a bounty: the rival who lands the
  // LAST HIT is paid it on the spot (soldierBounty, the `farm` banner of
  // js/sim/farm.js) and counts a farm, and every rival hero standing near
  // shares its SOLDIER_XP whoever scrapped it (shareXp, js/sim/player.js) -
  // the road pays, which is what makes walking out to meet a wave worth the walk. One the waves, a tower or a
  // beast finish pays nobody, and its rivals near it see the coin go grey.
  // Six or seven a wave, so no feed line: the fight is the news, not each wreck.
  if (src instanceof Player && src.team !== b.team) { awardGold(src, soldierBounty(b), b.x, b.y); farmHit(src, b.x, b.y - 6); }
  else coinPop(b.x, b.y - 6, true, 1 - b.team);
  shareXp(b, Math.round(SOLDIER_XP * soldierType(b).xp), 1 - b.team, src);
}

function updateRobot(b, dt) {
  b.flash = Math.max(0, b.flash - dt);
  b.atkCd = Math.max(0, b.atkCd - dt);
  b.kbx *= Math.pow(0.02, dt);
  b.kby *= Math.pow(0.02, dt);
  // every timed state on the chassis first - a burn can scrap it, and a wreck
  // must not then drive on (js/sim/actions.js, `status effects`)
  updateUnitStatus(b, dt);
  if (b.dead) return;
  if (b.stunT > 0) {
    // rattled: the brain is off, but a shove still slides the chassis
    b.stunT = Math.max(0, b.stunT - dt);
    b.moving = false;
    if (Math.abs(b.kbx) + Math.abs(b.kby) > 1) moveEntity(b, b.kbx * dt, b.kby * dt, 3);
    b.x = Math.max(8, Math.min(WORLD * TILE - 8, b.x));
    b.y = Math.max(8, Math.min(WORLD * TILE - 8, b.y));
    return;
  }
  if (b.zip >= 0) {
    // on the zipline's handle: the cable carries it (zipRide, js/sim/zipline.js), the
    // brain waits for the end, and nothing is swung on the way
    zipRide(b, dt);
    b.moving = false; b.atkAim = null;
    return;
  }
  if (b.merchant) { updateMerchant(b, dt); return; } // the eagle's driver: its own brain, the shared body above
  const M = heroMachine(b);
  if (M) { M.step(b, dt); return; } // a hero's machine: its kind's brain (HERO_MACHINE, js/sim/heroes.js)
  updateSoldier(b, dt); // a wave's soldier: the march (the `soldiers` banner below)
}

// ------------------------------------------------------------ merchant
// Each side's MERCHANT keeps its market STALL beside its perch - the shop
// players walk to (the `shop` banner, js/ui/shop.js). The stall stands from
// boot (placeStalls), the same spot every match; the merchant is at its
// counter from the first second of a match (spawnMerchants, at beginMatch)
// and keeps to it, a stroll now and then, turning to whoever it serves. Its
// stall and its own body are both counters: walk up to either team's and E
// opens the shop.
//
// It is a unit in `robots` with `merchant: true`: the same separation and
// draw pipelines a soldier rides, dispatched to updateMerchant/drawMerchant by
// that flag (updateRobot's status/stun handling is shared). owner -1.
//
// It CANNOT BE KILLED, and it has no hp at all rather than a large number:
// unitAlive (js/sim/actions.js) answers false for a merchant, which takes it out
// of every arrow, blow, sweep, tower mark and soldier's foe in one place.
// Both sides trade at both counters, so neither side may shoot one, and
// nothing may stand between a player and the shop they walked to.
const MERCH_STALL = [6, 62];  // RED's stall: its 3x2 footprint's top-left tile, behind the perch on the top lane's side (inside the pine border, FIELD_EDGE) (BLUE's mirrored across the middle column)
// set each side's stall on its spot: the anchor is the FRONT-left tile (the
// row the y-sort reads), parts east and north of it. Boot, after genWorld
const stalls = [null, null];
function placeStalls() {
  for (const team of [0, 1]) {
    const tx = team === 0 ? MERCH_STALL[0] : WORLD - MERCH_STALL[0] - 3, ty = MERCH_STALL[1];
    const o = placeObj(tx, ty + 1, 'stall', { team });
    for (let j = 0; j < 2; j++) for (let k = 0; k < 3; k++) {
      if (!j && !k) continue;
      objects[idx(tx + k, ty + 1 - j)] = { type: 'part', tx: tx + k, ty: ty + 1 - j, of: o, flash: 0, shake: 0 };
    }
    stalls[team] = o;
  }
}
// where a merchant keeps to: a step in front of its stall's counter
function merchPost(team) { const s = stalls[team]; return { x: (s.tx + 1.5) * TILE, y: (s.ty + 1) * TILE + 10 }; }
// the match's two merchants, at their posts (beginMatch, js/sim/eagle.js)
function spawnMerchants() {
  for (const team of [0, 1]) {
    const at = merchPost(team), e = state.drop.eagles[team];
    e.merchant = makeMerchant(team, at, stalls[team]);
  }
}
function makeMerchant(team, at, stall) {
  const b = {
    merchant: true, bot: true, kind: 'merchant', team, owner: -1, home: null,
    x: at.x, y: at.y, // no hp: nothing can hurt it (unitAlive)
    stall, tgt: null, nav: null,
    dir: 'down', moving: false, animT: 0, mvx: 0, mvy: 0, moveT: 0, idleT: 1,
    atkAim: null, atkCd: 0, flash: 0, kbx: 0, kby: 0, dead: false,
  };
  clearUnitStatus(b);
  robots.push(b);
  return b;
}

// the merchant's frame: serve whoever has its counter open, else keep to
// its post - a short stroll now and then, back toward it once it has
// drifted two tiles off
function updateMerchant(b, dt) {
  const from = { x: b.x, y: b.y };
  let moving = false;
  // The shop IS this body and its reach is measured off it (the `shop`
  // banner, js/ui/shop.js), so a merchant that walked off mid-sale would shut
  // its own counter in the customer's face: it stands and turns to them
  const cust = shopServing(b);
  if (cust) {
    b.moveT = 0;
    const cdx = cust.x - b.x, cdy = cust.y - b.y;
    b.dir = Math.abs(cdx) > Math.abs(cdy) ? (cdx > 0 ? 'right' : 'left') : (cdy > 0 ? 'down' : 'up');
    b.moving = false;
    b.animT = 0;
    return;
  }
  const post = merchPost(b.team);
  if (b.moveT > 0) {
    b.moveT -= dt;
    moving = true;
    const drag = unitMoveMul(b);
    const mv = moveEntity(b, (b.mvx * 24 * drag + b.kbx) * dt, (b.mvy * 24 * drag + b.kby) * dt, PLAYER_R);
    if (mv.blockedX || mv.blockedY) b.moveT = 0;
  } else {
    b.idleT -= dt;
    if (Math.abs(b.kbx) + Math.abs(b.kby) > 1) moveEntity(b, b.kbx * dt, b.kby * dt, PLAYER_R);
    if (b.idleT <= 0) {
      let ang = rng() * Math.PI * 2;
      if (Math.hypot(post.x - b.x, post.y - b.y) > 2 * TILE) ang = Math.atan2(post.y - b.y, post.x - b.x) + rand(-0.5, 0.5);
      b.mvx = Math.cos(ang); b.mvy = Math.sin(ang);
      b.moveT = rand(0.4, 1); b.idleT = rand(1.5, 3.5);
    }
  }
  const mvx = b.x - from.x, mvy = b.y - from.y;
  if (moving && (Math.abs(mvx) > 0.01 || Math.abs(mvy) > 0.01)) b.dir = Math.abs(mvx) > Math.abs(mvy) ? (mvx > 0 ? 'right' : 'left') : (mvy > 0 ? 'down' : 'up');
  b.animT += dt * (moving ? 8 : 0);
  b.moving = moving;
}

// ------------------------------------------------------------ waves
// THE WAVES: each side sends a column of soldiers down each lane, out of its
// own perch, on the match's beat - `first` seconds of match clock, then every
// `waveT` - so every lane rolls out together. A wave is its `mix` of soldier
// kinds (SOLDIER_TYPES, below) in door order - melee in front, ranged behind
// - one more melee for every `grow` seconds of the match, and a SIEGE
// soldier last on every n-th wave, n read off `siege` ([from s of match
// clock, n]: every 3rd early, every 2nd from 15:00, every wave from 25:00,
// League's). `cap` is the most soldiers a lane holds for a side, queued or
// out: a side nobody fights back against does not fill the map, it waits for
// its column to spend itself. A wave leaves its perch one soldier every
// WAVE_ROLL, so it reads as a column, not a heap.
const WAVE = { mix: ['melee', 'melee', 'melee', 'ranged', 'ranged', 'ranged'], siege: [[0, 3], [900, 2], [1500, 1]], first: 60, waveT: 30, grow: 180, cap: 16 };
const WAVE_ROLL = 0.5;   // s between the soldiers of one wave leaving the perch
const WAVE_OUT = 4;      // tiles along its lane from the perch a soldier steps out at: clear of the bird
// per side, per lane: { team, lane, kinds (still to leave, in order), rollT }
const waves = [];
function wavesReset() {
  waves.length = 0;
  soldierShots.length = 0; // nothing of the last match's lanes still in the air
  for (const team of [0, 1]) for (const lane of [0, 1]) waves.push({ team, lane, kinds: [], rollT: 0 });
}
// s to the next wave on the match's beat
function waveBeat() {
  const past = state.elapsed - WAVE.first;
  return past < 0 ? -past : WAVE.waveT - (past % WAVE.waveT);
}
// the kinds of the wave a lane queues now, in door order, cut from the back
// to what its lane's `cap` leaves room for
function waveKinds(w) {
  const n = Math.round((state.elapsed - WAVE.first) / WAVE.waveT) + 1;
  let every = 0;
  for (const [from, k] of WAVE.siege) if (state.elapsed >= from) every = k;
  const extra = Math.floor(state.elapsed / WAVE.grow);
  const at = WAVE.mix.lastIndexOf('melee') + 1; // the grown melee join the front rank
  const kinds = WAVE.mix.slice(0, at).concat(Array(extra).fill('melee'), WAVE.mix.slice(at));
  if (every && n % every === 0) kinds.push('siege');
  let load = w.kinds.length;
  for (const b of robots) if (b.kind === 'soldier' && b.team === w.team && b.lane === w.lane && !b.dead) load++;
  return kinds.slice(0, Math.max(0, WAVE.cap - load));
}
// the sim's step for the waves: on the beat every lane queues its wave (a
// side whose bird is gone sends none), and each queue leaves the perch one
// soldier every WAVE_ROLL
function updateWaves(dt) {
  const prev = state.elapsed - dt, beat = state.elapsed >= WAVE.first && (prev < WAVE.first || Math.floor((prev - WAVE.first) / WAVE.waveT) < Math.floor((state.elapsed - WAVE.first) / WAVE.waveT));
  for (const w of waves) {
    const e = state.drop && state.drop.eagles[w.team];
    if (!e || e.state !== 'down') { w.kinds.length = 0; continue; }
    if (beat) w.kinds = w.kinds.concat(waveKinds(w));
    w.rollT -= dt;
    if (w.kinds.length && w.rollT <= 0) {
      w.rollT = WAVE_ROLL;
      const b = makeSoldier(w.team, w.lane, w.kinds.shift());
      robots.push(b);
      burst(b.x, b.y - 4, '#c3c9d3', 6, 35, 0.4, true);
      burst(b.x, b.y + 2, '#e4e8ee', 5, 30, 0.45, true);
    }
  }
}

// ------------------------------------------------------------ soldiers
// A wave's SOLDIER (the `waves` banner above) is a bot's chassis in its
// side's paint (drawRobot) that marches its lane (b.lane) to the rival bird
// and strikes it. It is allowed to FIGHT and nothing else: nobody owns it
// (owner -1), and it lands its kind's blow (robotStrike; SOLDIER_TYPES) on
// any rival unit inside SOLDIER_AGGRO, any rival building inside
// SOLDIER_SIEGE, a rival tower from SOLDIER_TOWER_R, and then the bird
// itself, its kind's `eagle` a blow through hurtEagle - which is why two
// waves meeting on a lane grind each other down until somebody breaks the
// tie. It carries a bounty paid to the rival who lands its last hit
// (robotDies, soldierBounty in js/sim/farm.js), and it takes every hit,
// state and gust like any other body. Its route is its lane's waypoints from
// its own perch to the rival's (laneWaypoints, js/sim/field.js), then the
// roost itself. A waypoint it cannot reach is skipped, not waited on, so a
// wave never stands still on a blocked tile.
const SOLDIER_SPD = 44;        // px/s, a step slower than a walking player
const SOLDIER_AGGRO = 96;      // px it turns on a rival unit inside
const SOLDIER_SIEGE = 40;      // px it turns on a rival building inside - what is in its way, not the whole ring round a roost
const SOLDIER_TOWER_R = 160;   // px it turns on a rival road tower inside: the road's own stretch of it, so no column marches past one
const SOLDIER_XP = 20;         // XP a melee soldier is worth to the rival heroes standing near (shareXp); a kind's `xp` scales it
const SOLDIER_WP_R = 28;       // px from a waypoint that counts as reached

// THE KINDS of soldier a wave is made of, League's three (WAVE's `mix` and
// `siege`, above, say how many of each).
// What a kind IS lives here, never in an `if`: its health at the start (`hp`,
// and `grow` more for every WAVE `grow` of the match), its blow (`dmg`
// every `cd` s from `reach` px away; a building takes `struct` times it, the
// rival bird `eagle` nerve), the shot that carries a blow from range (`shot`:
// s in the air, 0 for an axe, `look`, what flies: SOLDIER_SHOTS, and `hand`, px off its
// feet where the shot leaves, facing right, mirrored when `turns` and it aims left), its bounty as a share of SOLDIER_BOUNTY
// (soldierBounty, js/sim/farm.js) and its share of SOLDIER_XP, and its
// sprite set (`spr`, SPRITES). MELEE walks in front, tanky and slow-hitting;
// RANGED stands back and throws a packed snowball, about half a melee's
// health; SIEGE is the ballista cart that walks last, shoots a bolt far,
// takes several tower bolts and hits buildings hard: it is what lets a wave
// push a tower.
const SOLDIER_TYPES = {
  melee:  { hp: 60,  grow: 10, dmg: 5,  cd: 1.1, reach: 15, struct: 1, eagle: 8,  shot: 0,    look: null,   hand: null,     bounty: 1,    xp: 1,   spr: 'robotTeam' },
  ranged: { hp: 34,  grow: 6,  dmg: 6,  cd: 1.5, reach: 72, struct: 1, eagle: 6,  shot: 0.35, look: 'ball', hand: [4, -7],  bounty: 0.65, xp: 0.7, spr: 'robotRanged' }, // the ball in its raised claw (js/baked/soldiers.js)
  siege:  { hp: 150, grow: 25, dmg: 10, cd: 2.4, reach: 96, struct: 3, eagle: 20, shot: 0.45, look: 'bolt', hand: [16, -12], turns: true, bounty: 3.2,  xp: 2,   spr: 'robotSiege' },  // the bolt's head on the loaded stock
};
function soldierType(b) { return SOLDIER_TYPES[b.type] || SOLDIER_TYPES.melee; }


function makeSoldier(team, lane, type) {
  const at = laneOut(team, lane, WAVE_OUT);
  const b = robotBody(at.x, at.y, 1, team, -1, rng() * 2);
  b.kind = 'soldier';
  b.type = SOLDIER_TYPES[type] ? type : 'melee';
  // its kind's health, tougher every `grow`, like its bounty (soldierBounty,
  // js/sim/farm.js), so a hero's grown blow never makes every hit on one a last hit
  const T = soldierType(b);
  b.hp = b.maxHp = T.hp + T.grow * Math.floor(state.elapsed / WAVE.grow);
  b.faceL = team === 1; // facing left (updateSoldier turns it): toward the rival base first
  b.lane = lane; // the lane it marches: 0 the top, 1 the bottom
  b.wayI = 0;
  b.rode = false; // boarded a zipline since the route was last read (soldierRejoin)
  b.way = laneWaypoints(team, lane); // the rival roost itself is read live
  return b;
}

// the ride: its own side's cable of its own lane within SOLDIER_ZIP_REACH of
// the soldier, whose end nearer the rival bird is SOLDIER_ZIP_GAIN nearer it
// than the soldier stands. Under it (inside ZIP_GRAB) it clips on, riding
// toward that end; short of it, it walks to the mount (zipMount,
// js/sim/zipline.js - the point a player's walk and a bot's stand on too).
// True while the cable has the soldier, walking or on
const SOLDIER_ZIP_GAIN = 96;   // px nearer the rival bird a ride's end must be than the soldier stands before it clips on: six tiles, so never a hop on and straight off
const SOLDIER_ZIP_REACH = 96;  // px off a cable's track a marching soldier turns aside to it: the lane's width, so a column on the lane finds the line beside it
function soldierGoal(b) {
  const rival = state.drop && state.drop.eagles[1 - b.team];
  return rival || (b.way.length ? b.way[b.way.length - 1] : null);
}
function soldierBoard(b, walkToward) {
  const g = soldierGoal(b);
  if (!g) return false;
  const here = Math.hypot(g.x - b.x, g.y - b.y);
  for (const z of zips) {
    if (!z || z.lane !== b.lane || z.team !== b.team) continue; // never off to another lane, and never the rival's, which would skip its towers
    const n = zipNearest(z, b.x, b.y);
    if (n.dist > SOLDIER_ZIP_REACH) continue;
    const p0 = z.pts[0], p1 = z.pts[z.pts.length - 1];
    const d0 = Math.hypot(g.x - p0.x, g.y - p0.y), d1 = Math.hypot(g.x - p1.x, g.y - p1.y);
    if (Math.min(d0, d1) > here - SOLDIER_ZIP_GAIN) continue;
    if (n.dist <= ZIP_GRAB) {
      zipBoard(b, z, n.d, d1 < d0 ? 1 : -1);
      b.rode = true;
      b.moving = false;
      return true;
    }
    const m = zipMount(z, n.d);
    if (m && walkToward(m.x, m.y, 0) >= 0) return true;
  }
  return false;
}
// off the cable - at its end, or knocked off - the route is read again from
// where the soldier now stands: the leg of it (waypoint to waypoint, the last
// one on to the bird) it stands nearest is the leg it is on, and the
// waypoint ending that leg is next. Never back down the route
function soldierRejoin(b) {
  b.rode = false;
  const g = soldierGoal(b), pts = g ? b.way.concat([g]) : b.way;
  let best = b.wayI, bd = Infinity;
  for (let k = Math.max(1, b.wayI); k < pts.length; k++) {
    const a = pts[k - 1], c = pts[k], lx = c.x - a.x, ly = c.y - a.y, L2 = lx * lx + ly * ly || 1;
    const t = Math.max(0, Math.min(1, ((b.x - a.x) * lx + (b.y - a.y) * ly) / L2));
    const d = Math.hypot(b.x - a.x - lx * t, b.y - a.y - ly * t);
    if (d < bd) { bd = d; best = k; }
  }
  b.wayI = Math.max(b.wayI, Math.min(best, b.way.length));
}
function updateSoldier(b, dt) {
  let moving = false;
  const walkToward = (px, py, reach) => {
    const n = navStep(b, px, py, 3, SOLDIER_SPD, dt, reach);
    if (!n.ok) return -1;
    moving = true;
    return n.d;
  };
  b.atkAim = null; b.hitFoe = null;
  if (b.rode) soldierRejoin(b); // just off a zipline (the ride branch in updateRobot carries it while it is on)
  const T = soldierType(b), x0 = b.x, y0 = b.y;
  const swing = (pt, hit) => { b.atkAim = pt; if (b.atkCd <= 0) { b.atkCd = T.cd; hit(); } };
  const rival = state.drop && state.drop.eagles[1 - b.team];
  const roost = rival && rival.state === 'down' ? rival : null;
  let busy = false;
  // 1. a rival unit in reach: close and swing (players through seenAt, so a
  //    hidden hero lets a column walk past)
  const foe = robotFoeUnit(b, SOLDIER_AGGRO);
  if (foe) {
    const pt = foePoint(foe, b.x, b.y - 1);
    if (Math.hypot(pt.x - b.x, pt.y - (b.y - 1)) > T.reach) busy = walkToward(pt.x, pt.y, 0) >= 0;
    else { b.hitFoe = foe; swing(pt, () => robotStrike(b, foe, pt)); busy = true; }
  }
  // 2. the rival bird, once the road has brought it close: a swing on the
  //    nearest roost tile (hurtEagle) - ahead of any building, since what
  //    a side builds round its bird stands within a step of it
  if (!busy && roost && Math.hypot(roost.x - b.x, roost.y - b.y) < 6 * TILE) {
    const t = aiEagleTile(roost, b);
    if (t) {
      const pt = { x: t.tx * TILE + 8, y: t.ty * TILE + 8 };
      if (Math.hypot(pt.x - b.x, pt.y - (b.y - 1)) > T.reach + 6) busy = walkToward(pt.x, pt.y, 1) >= 0;
      else {
        swing(pt, () => robotStrike(b, roost, pt));
        busy = true;
      }
    }
  }
  // 3. a rival building in its way - and a rival TOWER from further off, since one holds
  //    the lane and a column that walked past it would leave it standing
  //    (towerNear, js/sim/towers.js)
  if (!busy) {
    const st = enemyStructNear(b.team, b.x, b.y - 1, SOLDIER_SIEGE) || towerNear(b.team, b.x, b.y - 1, SOLDIER_TOWER_R);
    if (st) {
      const pt = foePoint(st, b.x, b.y - 1);
      if (Math.hypot(pt.x - b.x, pt.y - (b.y - 1)) > T.reach) busy = walkToward(pt.x, pt.y, 1) >= 0;
      else { swing(pt, () => robotStrike(b, st, pt)); busy = true; }
    }
  }
  // 4. the march: by a zipline that carries it closer, else the next
  //    waypoint down its lane, then the roost
  if (!busy) busy = soldierBoard(b, walkToward);
  if (!busy) {
    if (b.wayI < b.way.length) {
      const w = b.way[b.wayI];
      const d = walkToward(w.x, w.y, 2);
      if (d < 0 || d < SOLDIER_WP_R) b.wayI++; // reached, or unreachable: the next one
    } else if (roost) {
      if (walkToward(roost.x, roost.y, 3) < 0) navClear(b); // pinned in the lane: try afresh next frame
    }
  }
  b.animT += dt * (moving ? 8 : 0);
  b.moving = moving;
  // which way it faces (the ballista cart's bow, drawRobot): at what it aims, else the
  // way it drives, held through a step that is mostly up or down the screen
  if (b.atkAim) b.faceL = b.atkAim.x < b.x;
  else if (moving && Math.abs(b.x - x0) > Math.abs(b.y - y0) * 0.5) b.faceL = b.x < x0;
  b.x = Math.max(8, Math.min(WORLD * TILE - 8, b.x));
  b.y = Math.max(8, Math.min(WORLD * TILE - 8, b.y));
  if (b.hp <= 0 && !b.dead) robotDies(b, null);
}

// ------------------------------------------------------------ soldier blows
// What a wave's soldier lands (the `soldiers` banner above): a melee one's axe,
// a ranged or siege one's snowball. The numbers are its kind's (SOLDIER_TYPES).
// what a shot is (SOLDIER_TYPES' `look`; drawn by drawSoldierShots, js/draw/soldiershots.js):
// the sound it leaves with and lands with, and the puff where it hits
const SOLDIER_SHOTS = {
  ball: { fire: 'waveSwing', land: 'rockLand', puff: '#eef4fb', n: 5 },  // a packed snowball, thrown
  bolt: { fire: 'arrow', land: 'waveHit',  puff: '#a3794f', n: 10 }, // a ballista bolt: splinters off the shaft
};

// nearest building belonging to any other team, within r px of (x, y)
function enemyStructNear(team, x, y, r) {
  let best = null, bd = r;
  for (const o of structures) {
    if (o.team === undefined || o.team === team) continue;
    const c = structCenter(o);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
// ---- a soldier's simple attack ------------------------------------------
// One blow on its kind's flat cooldown. Nothing here scales with anything yet;
// that is the balance pass.
// Where a soldier aims. A body is a point a little above its feet; a building
// is the nearest point on its FOOTPRINT, not its centre - a tower is
// 3x2, and a soldier measuring to the middle of it could never reach its own
// axe past the wall it is standing against.
function foePoint(e, fx, fy) {
  if (e.tx === undefined) return { x: e.x, y: e.y - 4 };
  if (fx === undefined) return structCenter(e);
  const x0 = e.tx * TILE, y0 = e.ty * TILE;
  return {
    x: Math.max(x0, Math.min(x0 + structW(e) * TILE, fx)),
    y: Math.max(y0, Math.min(y0 + structH(e) * TILE, fy)),
  };
}
// nearest enemy UNIT (player or bot) inside range. Players are noticed through
// seenAt, so a body under the snow is as invisible to a soldier as to a wolf.
function robotFoeUnit(b, range) {
  let best = null, bd = range;
  for (const q of players) {
    if (!q.active || q.dead || q.team === b.team) continue;
    const d = Math.hypot(q.x - b.x, q.y - 6 - b.y);
    if (d < bd && d <= seenAt(q, range)) { bd = d; best = q; }
  }
  for (const r of robots) {
    if (r.team === b.team) continue;
    const dx = r.x - b.x, dy = r.y - 1 - b.y;
    if (dx >= bd || dx <= -bd || dy >= bd || dy <= -bd) continue; // (too far on one axis alone: most of the lane)
    if (r === b || !unitAlive(r)) continue;
    const d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
// the blow itself, its kind's: an axe lands now, a snowball or a bolt is
// thrown and lands when its time in the air is up (updateSoldierShots) on
// whatever it was thrown at, even if that has stepped away - a lob, not a
// dodgeable shot
function robotStrike(b, e, pt) {
  const T = soldierType(b);
  if (T.shot) { soldierThrow(b, T, e, pt); return; }
  sfxAt('waveSwing', b.x, b.y); // the lane's fight sits under the heroes' (js/app/audio.js)
  soldierLand(soldierBlow(b), e, pt, b.x, b.y - 1);
}
// what a soldier's blow does, fixed the moment it is swung or thrown: whose
// side, whose credit (a soldier's is nobody's), and how hard on a body, a
// building (orcaPushMul: the orca's push, read where the thrower stands) and
// the rival bird. A shot carries this, so it lands the same once its thrower is a wreck
function soldierBlow(b) {
  const T = soldierType(b);
  return { team: b.team, owner: b.owner, dmg: T.dmg, sdmg: T.dmg * T.struct * orcaPushMul(b), eagle: T.eagle };
}
// where a soldier's blow lands, come from (fx, fy): a building goes through
// hurtStruct (the same path an E swing takes), the rival bird through
// hurtEagle, any BODY through the one blow every unit takes (hurtUnit,
// js/sim/actions.js), credited to the blow's owner (a soldier's is nobody)
function soldierLand(w, e, pt, fx, fy) {
  const src = players[w.owner] || null;
  const d = Math.hypot(pt.x - fx, pt.y - fy) || 1;
  const nx = (pt.x - fx) / d, ny = (pt.y - fy) / d;
  if (state.drop && state.drop.eagles.indexOf(e) >= 0) { if (e.state === 'down') hurtEagle(e, w.eagle, null, pt.x, pt.y); }
  else if (e.tx !== undefined) { if (structures.indexOf(e) >= 0) hurtStruct(e, w.sdmg, src, true); } // a soldier swung it, so STRUCT_DR stays off: a kind's dmg is already a building number
  else if (unitAlive(e)) hurtUnit(e, w.dmg, nx, ny, src, { cause: 'soldier' });
}

// ---- a soldier's shot in the air ------------------------------------------
// A thrown snowball or a ballista bolt is its own thing in the world, not a
// field on its thrower: it leaves the hand (SOLDIER_TYPES' `hand`), flies its
// kind's `shot` s and lands on its mark, whether or not the thrower is still
// standing, stunned or scrapped by then. After it lands it stays SOLDIER_SPLAT_T
// s more, `hit` counting up, for the splat its pixels show (drawSoldierShots,
// js/draw/soldiershots.js). A SAVE_ROOTS list that rides the snapshot.
const SOLDIER_SPLAT_T = 0.18;
const soldierShots = []; // { look, tg, live, x, y, x0, y0, t, fly, hit, ...soldierBlow }
function soldierThrow(b, T, e, pt) {
  sfxAt(SOLDIER_SHOTS[T.look].fire, b.x, b.y);
  const left = T.turns && pt.x < b.x; // the cart swings round to its mark (updateSoldier's faceL); the thrower's claw stays where it is drawn
  soldierShots.push(Object.assign(soldierBlow(b), {
    look: T.look, tg: e,
    // `live`: a body is hit where it stands when the shot lands; a building or the bird where it was aimed
    live: e.tx === undefined && !(state.drop && state.drop.eagles.indexOf(e) >= 0),
    x: pt.x, y: pt.y, x0: b.x + (left ? -T.hand[0] : T.hand[0]), y0: b.y + T.hand[1],
    t: 0, fly: T.shot, hit: -1,
  }));
}
function updateSoldierShots(dt) {
  for (let i = soldierShots.length - 1; i >= 0; i--) {
    const s = soldierShots[i];
    if (s.hit >= 0) { s.hit += dt; if (s.hit >= SOLDIER_SPLAT_T) soldierShots.splice(i, 1); continue; }
    s.t += dt;
    if (s.live && unitAlive(s.tg)) { s.x = s.tg.x; s.y = unitMidY(s.tg); } // the shot follows a body (drawn to where it is)
    if (s.t < s.fly) continue;
    s.t = s.fly; s.hit = 0;
    const pt = { x: s.x, y: s.y };
    soldierLand(s, s.tg, pt, s.x0, s.y0);
    s.tg = null; // landed: nothing more to follow
    const L = SOLDIER_SHOTS[s.look];
    burst(pt.x, pt.y, L.puff, L.n, 45, 0.4, true);
    sfxAt(L.land, pt.x, pt.y);
  }
}
