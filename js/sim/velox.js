'use strict';
// VELOX, THE SKATER - a named hero (CLASSES, js/sim/player.js) and the kiting
// marksman: she shoots her sling while she skates and never stands still. Her
// blows quicken her, she lays a strip of polished ice she flies along and her
// rivals skid on, she darts a step and is ready to throw again, and her long
// run doubles every throw. She once carried the empire's messages down its
// frozen canals; the day she read an order to burn a village, she skated to
// warn it instead.
// Loaded before abilities.js, whose CLASS_AB takes VELOX_AB as her row of keys;
// she registers into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ velox

// ---- tuning --------------------------------------------------------------
// KEEP MOVING (the passive): each basic blow she lands adds a stack of speed for
// a moment; a fresh one refreshes the clock. On ice the stacks hold longer (her
// steady skating on it is her kit's: iceSteer on her CLASSES row).
const KEEP_MAX = 3;             // stacks at most
const KEEP_MS = 0.06;           // walk x (1 + this) per stack
const KEEP_T = 2;               // s the stacks hold off ice...
const KEEP_ICE_T = 4;           // ...and on it
// Q SKIP STONE: a stone thrown low down the aim; it lands, skips and lands
// again, up to SKIP_N times, hurting every rival body where it lands
const SKIP_SPD = 260;           // px/s along the ground
const SKIP_GAP = 52;            // px between landings...
const SKIP_ICE_GAP = 78;        // ...from a landing on ice (creek ice or a lane)
const SKIP_N = 3;               // landings
const SKIP_R = 16;              // px round a landing it hits
// W ICE LANE: a strip of polished ice from her feet down the aim. She skates it
// faster; a rival body on it skates like the creek's ice (skids, turns slowly);
// her own side walks it as snow.
const LANE_LEN = 130;           // px long
const LANE_W = 18;              // px wide
const LANE_FAST = 1.25;         // her walk x this on her own lane
const LANE_FADE = 0.5;          // s it takes to melt back after its time (drawn only)
// E QUICK STEP: a short skate dash down the aim; her next basic attack is
// ready at once, at full draw, and lands harder
const QSTEP_SPD = 330;           // px/s
const QSTEP_D = 56;              // px
const QSTEP_READY_T = 3;         // s the readied throw waits
// R LONG RUN: for a few seconds she skates faster and shrugs off slows, and
// each basic blow she lands throws a second stone at the next rival near it
const RUN_MS = 0.3;             // walk x (1 + this)
const RUN_TEN = 0.5;            // slows, roots and stuns on her last this much less
const RUN_ECHO_R = 120;         // px round the body hit to find the next
const RUN_ECHO_SPD = 300;       // px/s of the second stone

const veloxStones = []; // {x, y, nx, ny, team, owner, left, n, dmg, gap} - Q's stones skipping
const veloxLanes = [];  // {x0, y0, x1, y1, team, owner, t, life} - W's strips of ice

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const VELOX_AB = [
  {
    id: 'skip', name: 'SKIP STONE', cd: [7, 6.5, 6, 5.5, 5], ap: 0.5, cast: 0.12, aim: { line: SKIP_GAP * SKIP_N },
    rank: { dmg: [18, 26, 34, 42, 50] }, // dmg: each landing
    tip: 'A STONE THAT SKIPS. HITS AT EACH LANDING',
    blurb: 'A SLING STONE SKIPS ALONG THE GROUND, HITTING EVERY RIVAL WHERE IT LANDS, UP TO THREE TIMES. ON ICE IT SKIPS FURTHER.',
    use: (p) => veloxSkip(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawSkipTele(p, a, closing, ex, ey), // the stone's hops, a mark where each lands (js/draw/velox.js)
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? -1 : 1, rot: 0 }),
    icon: VELOX_ICON32.skip,
    bot: (p, foe, d, clear) => clear && d < SKIP_GAP * SKIP_N - 6,
  },
  {
    id: 'lane', name: 'ICE LANE', cd: [16, 15, 14, 13, 12], cast: 0.15, aim: { line: LANE_LEN },
    rank: { t: [3, 3.5, 4, 4.5, 5] }, // t: s the ice holds
    tip: 'A STRIP OF ICE. YOU FLY ON IT, RIVALS SKID',
    blurb: 'LAY A STRIP OF POLISHED ICE FROM YOUR FEET. YOU SKATE IT MUCH FASTER. RIVALS ON IT SKID AND TURN SLOWLY. YOUR OWN SIDE WALKS IT AS SNOW.',
    use: (p) => veloxLane(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawLaneTele(p, a, closing, ex, ey), // the ice freezing out from her feet
    pose: () => ({ dx: 0, dy: 1, rot: 0 }), // the staff swept low
    icon: VELOX_ICON32.lane, mark: 'speed',
    bot: (p, foe, d) => foe instanceof Player && d < LANE_LEN,
  },
  {
    id: 'step', name: 'QUICK STEP', cd: [9, 8.5, 8, 7.5, 7], cast: 0.05, aim: { line: QSTEP_D },
    rank: { dmg: [6, 10, 14, 18, 22] }, // dmg: added to the readied throw
    tip: 'A SHORT DASH. YOUR NEXT THROW IS READY',
    blurb: 'SKATE A SHORT DASH. YOUR NEXT SLING THROW IS READY AT ONCE, AT FULL DRAW, AND LANDS HARDER.',
    use: (p) => veloxStep(p),
    pose: () => ({ dx: 0, dy: 0, rot: 0 }),
    icon: VELOX_ICON32.step,
    bot: (p, foe, d) => d < 70,
  },
  {
    id: 'run', name: 'LONG RUN', cd: [100, 85, 70], ap: 0.3, cast: 0.1,
    rank: { t: [4, 5, 6], dmg: [14, 22, 30] }, // t: s it lasts; dmg: each second stone
    tip: 'SKATE FAST. EACH THROW THROWS TWO',
    blurb: 'FOR A FEW SECONDS YOU SKATE AT FULL SPEED AND SLOWS BARELY HOLD YOU. EACH SLING THROW THAT LANDS THROWS A SECOND STONE AT THE NEXT RIVAL NEAR IT.',
    use: (p) => veloxRun(p),
    pose: () => ({ dx: 0, dy: -1, rot: 0 }),
    icon: VELOX_ICON32.run, mark: 'speed',
    bot: (p, foe, d) => foe instanceof Player && d < 170 && (foe.hp < foe.maxHp * 0.6 || p.hp < p.maxHp * 0.4),
  },
];

// the caster of something she left in the world, while it is still hers to credit
function veloxSrc(w) { const o = players[w.owner]; return o && o.team === w.team ? o : null; }
function isVelox(p) { return p instanceof Player && CLASSES[p.cls].passive === 'keepmoving'; }

// ---- KEEP MOVING -----------------------------------------------------------------
// the blow hook (HERO_PASSIVE `deal`): a basic blow quickens her, the readied throw
// lands harder, and in her long run it throws a second stone
function veloxDeal(p, e, dmg, o) {
  if (!o.basic) return dmg;
  p.keepN = Math.min(KEEP_MAX, (p.keepN || 0) + 1);
  p.keepT = iceUnder(p) ? KEEP_ICE_T : KEEP_T;
  if (p.quickT > 0) { dmg += abDmg(p, 'step', abRk(p, 'step', 'dmg')); p.quickT = 0; burst(e.x, unitMidY(e), '#f4f7ff', 5, 40, 0.3, true); }
  if (p.runT > 0) veloxEcho(p, e);
  return dmg;
}
// her clocks, one sim step: the stacks, the readied throw (a held draw is full
// at once), the long run
function veloxTick(p, dt) {
  if (p.keepT > 0 && (p.keepT -= dt) <= 0) p.keepN = 0;
  if (p.quickT > 0) {
    p.quickT = Math.max(0, p.quickT - dt);
    if (p.charging) p.chargeT = Math.max(p.chargeT, drawTime(p));
  }
  if (p.runT > 0) p.runT = Math.max(0, p.runT - dt);
}
function veloxOut(p) {
  p.keepN = 0; p.keepT = 0; p.quickT = 0; p.runT = 0;
  if (p.dash === 'vstep') { p.rushT = 0; p.dash = ''; }
}
// what her walk is worth (HERO_MOVE): the stacks, her own lane, the long run
function veloxMoveMul(p) {
  if (!isVelox(p)) return 1;
  let m = 1 + (p.keepN || 0) * KEEP_MS;
  if (p.runT > 0) m *= 1 + RUN_MS;
  if (veloxLanes.length && onVeloxLane(p, true)) m *= LANE_FAST;
  return m;
}
// her tenacity in the long run (HERO_TEN)
function veloxTen(e) { return e instanceof Player && e.runT > 0 && isVelox(e) ? RUN_TEN : 0; }

// ---- Q SKIP STONE ------------------------------------------------------------------
function veloxSkip(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  veloxStones.push({ x: p.x, y: p.y, nx: dx / d, ny: dy / d, team: p.team, owner: p.id,
    left: SKIP_GAP, gap: SKIP_GAP, n: 0, dmg: abDmg(p, 'skip', abRk(p, 'skip', 'dmg')) });
  faceToward(p, dx, dy, true);
  sfxAt('arrow', p.x, p.y);
}
// is the ground at a point ice: the creek's, or a lane of hers
function veloxIceAt(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (inWorld(tx, ty) && ground[idx(tx, ty)] === 1) return true;
  for (const L of veloxLanes) if (L.t < L.life && veloxLaneDist(L, x, y) <= LANE_W / 2) return true;
  return false;
}
function skipLand(s) {
  const src = veloxSrc(s);
  s.n++;
  if (src) {
    for (const q of unitsHit(src, s.x, s.y, SKIP_R)) hurtUnit(q, s.dmg, s.nx, s.ny, src, { kb: 12, ab: 'skip' });
    for (const st of structsNear(src, s.x, s.y, SKIP_R)) hurtStruct(st, s.dmg, src);
    if (PRACTICE) abHitDummies(s.x, s.y, SKIP_R, s.dmg);
  }
  const ice = veloxIceAt(s.x, s.y);
  burst(s.x, s.y, ice ? '#e6f8ff' : '#dfe8f4', 6, 35, 0.3, true);
  sfxAt('hit', s.x, s.y);
  s.gap = ice ? SKIP_ICE_GAP : SKIP_GAP;
  s.left = s.gap;
}
function updateStones(dt) {
  for (let i = veloxStones.length - 1; i >= 0; i--) {
    const s = veloxStones[i];
    const step = Math.min(s.left, SKIP_SPD * dt);
    s.x += s.nx * step; s.y += s.ny * step; s.left -= step;
    if (isSolidTile(Math.floor(s.x / TILE), Math.floor(s.y / TILE))) { burst(s.x, s.y, '#8b93a8', 4, 30, 0.3, true); veloxStones.splice(i, 1); continue; }
    if (s.left <= 0) { skipLand(s); if (s.n >= SKIP_N) veloxStones.splice(i, 1); }
  }
}

// ---- W ICE LANE ---------------------------------------------------------------------
function veloxLane(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const y0 = p.y + 4; // laid under her feet
  veloxLanes.push({ x0: p.x, y0, x1: p.x + dx / d * LANE_LEN, y1: y0 + dy / d * LANE_LEN, team: p.team, owner: p.id, t: 0, life: abRk(p, 'lane', 't') });
  burst(p.x + dx / d * LANE_LEN * 0.5, y0 + dy / d * LANE_LEN * 0.5, '#e6f8ff', 14, 50, 0.45, true);
  sfxAt('place', p.x, p.y);
}
// how far a ground point is from a lane's middle line
function veloxLaneDist(L, x, y) {
  const vx = L.x1 - L.x0, vy = L.y1 - L.y0, l2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - L.x0) * vx + (y - L.y0) * vy) / l2));
  return Math.hypot(x - (L.x0 + vx * t), y - (L.y0 + vy * t));
}
// is a body on a live lane by its feet: `own` asks for a lane she laid herself,
// otherwise a lane of the other side's
function onVeloxLane(e, own) {
  const t = unitTeam(e);
  for (const L of veloxLanes) {
    if (L.t >= L.life || (own ? L.owner !== e.id || L.team !== t : L.team === t)) continue;
    if (veloxLaneDist(L, e.x, e.y + 4) <= LANE_W / 2) return true;
  }
  return false;
}
// her own lane and a rival's lane skate like the creek's ice (HERO_ICE, js/sim/heroes.js)
function veloxIceUnder(p) { return veloxLanes.length > 0 && (onVeloxLane(p, false) || (isVelox(p) && onVeloxLane(p, true))); }
function updateLanes(dt) {
  for (let i = veloxLanes.length - 1; i >= 0; i--) {
    const L = veloxLanes[i];
    L.t += dt;
    if (L.t >= L.life + LANE_FADE) veloxLanes.splice(i, 1);
  }
}

// ---- E QUICK STEP -------------------------------------------------------------------
// The step rides the charge state (rushT, HERO_DASH) at its own pace; she comes
// out of it gliding, the next throw ready.
function veloxStep(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = QSTEP_D / QSTEP_SPD;
  p.dash = 'vstep';
  p.sliding = false;
  p.nockT = 0;
  p.quickT = QSTEP_READY_T;
  burst(p.x, p.y + 4, '#dfe8f4', 8, 45, 0.35, true);
  sfxAt('dodge', p.x, p.y);
}
function stepStep(p, mv) {
  if (mv.blockedX || mv.blockedY || p.rushT <= 0) {
    p.rushT = 0; p.dash = '';
    p.vx = p.rushNX * 110; p.vy = p.rushNY * 110; // she glides out of it
  }
}

// ---- R LONG RUN -----------------------------------------------------------------------
function veloxRun(p) {
  p.runT = abRk(p, 'run', 't');
  burst(p.x, p.y + 2, '#f4f7ff', 14, 60, 0.45, true);
  sfxAt('pickup', p.x, p.y);
}
// the second stone: from her at the rival body nearest the one just hit
function veloxEcho(p, e) {
  let best = null, bd = RUN_ECHO_R;
  for (const q of unitsHit(p, e.x, e.y, RUN_ECHO_R)) {
    if (q === e) continue;
    const d = Math.hypot(q.x - e.x, q.y - e.y);
    if (d < bd) { bd = d; best = q; }
  }
  if (!best) return;
  const dx = best.x - p.x, dy = best.y - (p.y - BOW_Y), d = Math.hypot(dx, dy) || 1;
  arrows.push({
    x: p.x, y: p.y - BOW_Y,
    vx: dx / d * RUN_ECHO_SPD, vy: dy / d * RUN_ECHO_SPD,
    t: 0, life: (d + 20) / RUN_ECHO_SPD, dmg: abDmg(p, 'run', abRk(p, 'run', 'dmg')), pow: 1,
    owner: p.id, team: p.team, trailD: 0,
    solid: true, kb: 0.5, col: '#9aa3b8', ab: 'run',
    look: 'slingstone', // drawn as her stone (HERO_SHOTS, js/draw/velox.js)
    ang: Math.atan2(dy, dx), spd: RUN_ECHO_SPD, ox: p.x, oy: p.y - BOW_Y,
  });
}

// what she leaves in the world, one sim step (HERO_TICK)
function updateVeloxWorld(dt) { updateStones(dt); updateLanes(dt); }

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.keepmoving = { deal: veloxDeal, tick: veloxTick, out: veloxOut,
  name: 'KEEP MOVING', blurb: 'EACH SLING THROW THAT LANDS QUICKENS YOU FOR A MOMENT, UP TO THREE TIMES. ON ICE YOU SKATE WITH FULL CONTROL, AND THE SPEED HOLDS LONGER.',
  icon: VELOX_ICON32.keep };
HERO_DASH.vstep = { spd: QSTEP_SPD, t: QSTEP_D / QSTEP_SPD, ramp: 0.03, step: stepStep };
HERO_MOVE.push(veloxMoveMul);
HERO_TEN.push(veloxTen);
HERO_TICK.push(updateVeloxWorld);
HERO_ICE.push(veloxIceUnder);
