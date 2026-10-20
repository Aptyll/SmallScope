'use strict';
// FORTIVA, THE UNBROKEN - the second named hero (CLASSES, js/sim/player.js): a
// juggernaut who forged her chains into a greatsword. She wins the long fight:
// every blow traded with a hero builds her resolve, and high, it makes her
// hard to stop and heals her off her own cuts. Loaded before abilities.js,
// whose CLASS_AB takes FORT_AB as her row of keys; she reaches the shared sim
// only through the hero hooks (js/sim/heroes.js). Draws no rng().
// ------------------------------------------------------------ fortiva

// ---- tuning --------------------------------------------------------------
// UNBROKEN (the passive): hero damage dealt AND taken builds resolve (p.resolve,
// 0..1). High, she shrugs off control and her basic attacks heal her.
const UNB_FULL = 0.5;          // share of her most health, traded with heroes, that fills it
const UNB_HIGH = 0.6;          // "high": from here the two gifts are on
const UNB_TEN = 0.3;           // tenacity while high
const UNB_HEAL = 0.25;         // share of a basic attack's blow healed back while high
const UNB_IDLE_T = 5;          // s without hero damage before it drains...
const UNB_DRAIN = 0.15;        // ...this much of it a second
// Q SEVER THE CHAINS: a wide arc; its outer edge cuts harder and heals her off heroes
const SEVER_R = 44;            // px reach
const SEVER_HALF = 1.2;        // rad either side of the aim (a ~140 degree arc)
const SEVER_EDGE = 26;         // px out from her where the edge begins
const SEVER_EDGE_MUL = 1.5;    // the edge's blow
const SEVER_HEAL = 6, SEVER_HEAL_HP = 0.04; // heal per hero the edge catches: flat + share of her most health
const SEVER_HEAL_N = 3;        // heroes that count toward it
// W DEFIANT HEART: a shield; when it breaks or runs out, the shockwave pays back what it took
const DEFY_T = 2.5;            // s the shield is held (its size is the row's `rank`)
const DEFY_R = 40;             // px of shockwave
const DEFY_PAY = 0.8;          // share of what the shield absorbed added to the wave
// E BREAK THE YOKE: a lunge, then the ground struck; a hero caught gives back the cooldown
const YOKE_SPD = 300;
const YOKE_T = 0.15;           // s of lunge (~45 px)
const YOKE_R = 28;             // px of the strike at its end
const YOKE_REFUND = 0.45;      // share of the cooldown a hero hit gives back
// R NO KNEELING: the leap onto a spot, the sword brought down; after, harder to stop and hitting harder
const NOKNEEL_RANGE = 110;     // px the leap may reach
const NOKNEEL_SPD = 280;       // px/s through the air
const NOKNEEL_R = 40;          // px of the impact
const NOKNEEL_UP_R = 22;       // px about the heart of it that throws bodies up...
const NOKNEEL_T = 4;           // s of the after
const NOKNEEL_TEN = 0.5;       // tenacity in the after
const NOKNEEL_AD = 8, NOKNEEL_AD_LV = 1.5; // attack damage in the after: flat + per level

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), the ARM_AB shape (js/sim/armatos.js):
// `rank` holds each key's numbers by rank, read through abRk.
const FORT_AB = [
  {
    id: 'sever', name: 'SEVER THE CHAINS', cd: [7, 6.5, 6, 5.5, 5], ap: 0.6, cast: 0.3, aim: { cone: SEVER_R, half: SEVER_HALF },
    rank: { dmg: [14, 19, 24, 29, 34] }, // the inner arc's; the edge cuts SEVER_EDGE_MUL harder
    tip: 'WIDE SWING. THE EDGE HEALS YOU',
    blurb: 'A WIDE SWING. THE OUTER EDGE HITS HARDER, AND HEALS YOU FOR EVERY HERO IT CATCHES.',
    use: (p) => fortSever(p),
    tele: (p, px, py, a, col, closing) => drawSeverTele(px, py, a, col, closing),
    pose: (p, prog) => ({ dx: p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0, dy: prog < 0.7 ? 0 : 1, rot: 0 }), // wound back, then through
    icon: FORT_ICON32.sever,
    bot: (p, foe, d) => d > SEVER_EDGE - 8 && d < SEVER_R - 2,
  },
  {
    id: 'defy', name: 'DEFIANT HEART', cd: [13, 12, 11, 10, 9], ap: 0.4, cast: 0.1,
    rank: { shieldHp: [0.12, 0.14, 0.16, 0.18, 0.2], t: DEFY_T, dmg: [8, 12, 16, 20, 24] }, // dmg: the wave, + DEFY_PAY of what the shield took
    tip: 'A SHIELD, THEN A SHOCKWAVE',
    blurb: 'A SHIELD. WHEN IT BREAKS OR FADES, A SHOCKWAVE HITS AROUND YOU, HARDER FOR ALL IT TOOK.',
    use: (p) => fortDefy(p),
    acol: '#f2cc6a', activeF: (p) => (p.defyT > 0 ? p.defyT / DEFY_T : 0),
    pose: () => ({ dx: 0, dy: 1, rot: 0 }), // braced
    icon: FORT_ICON32.defy,
    bot: (p, foe, d) => foe instanceof Player && d < 70 && p.hp < p.maxHp * 0.9,
  },
  {
    id: 'yoke', name: 'BREAK THE YOKE', cd: [10, 9.5, 9, 8.5, 8], ap: 0.5, cast: 0.15, aim: { line: YOKE_SPD * YOKE_T },
    rank: { dmg: [12, 16, 20, 24, 28], slow: 0.5, slowT: 1 },
    tip: 'LUNGE AND SLOW. A HERO HIT CUTS THE WAIT',
    blurb: 'LUNGE AND STRIKE THE GROUND. SLOWS ALL IT HITS. A HERO HIT GIVES BACK MUCH OF THE WAIT.',
    use: (p) => fortYoke(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawYokeTele(p, a, col, closing, now, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.5 ? 1 : 0, rot: 0.12 * (p.dir === 'left' ? -1 : 1) }), // low, coiled
    icon: FORT_ICON32.yoke,
    bot: (p, foe, d, clear) => clear && d > 18 && d < YOKE_SPD * YOKE_T + YOKE_R - 10,
  },
  {
    id: 'nokneel', name: 'NO KNEELING', cd: [90, 80, 70], ap: 0.8, cast: 0.3, aim: { ring: NOKNEEL_R },
    rank: { dmg: [30, 45, 60], up: 0.6, t: NOKNEEL_T, ten: NOKNEEL_TEN }, // up: the heart of it; t/ten: the after
    tip: 'LEAP IN AND KNOCK UP',
    blurb: 'LEAP AND BRING THE SWORD DOWN. THE HEART OF THE BLOW THROWS THEM UP. AFTER, YOU ARE HARD TO STOP AND HIT HARDER.',
    use: (p) => fortNoKneel(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawNoKneelTele(p, col, closing, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: Math.round(2 * prog), rot: 0 }), // the crouch before the jump
    icon: FORT_ICON32.nokneel,
    bot: (p, foe, d) => foe instanceof Player && d > 30 && d < NOKNEEL_RANGE && (foe.hp < foe.maxHp * 0.6 || p.resolve >= UNB_HIGH),
  },
];

HERO_PASSIVE.unbroken = { hurt: unbHurt, deal: unbDeal, tick: unbTick, out: unbOut,
  name: 'UNBROKEN', blurb: 'BLOWS TRADED WITH HEROES BUILD RESOLVE. HIGH, YOU SHRUG OFF CONTROL AND YOUR ATTACKS HEAL YOU.', icon: FORT_ICON32.unbroken };

// ---- UNBROKEN -----------------------------------------------------------------
function isFort(p) { return p instanceof Player && CLASSES[p.cls].passive === 'unbroken'; }
function unbHigh(p) { return isFort(p) && p.resolve >= UNB_HIGH; }
function unbFeed(p, dmg) {
  if (dmg <= 0 || p.dead) return;
  const was = p.resolve;
  p.resolve = Math.min(1, p.resolve + dmg / (p.maxHp * UNB_FULL));
  p.resolveIdle = 0;
  if (was < UNB_HIGH && p.resolve >= UNB_HIGH) { burst(p.x, p.y - 10, '#f2cc6a', 10, 45, 0.5, true); sfxFor(p, 'pickup'); }
}
function unbHurt(p, dmg, src) { if (src instanceof Player && src.team !== p.team) unbFeed(p, dmg); }
function unbDeal(p, e, dmg, o) {
  if (e instanceof Player && e.team !== p.team) unbFeed(p, dmg);
  if (o.basic && p.resolve >= UNB_HIGH && dmg > 0) healPlayer(p, dmg * UNB_HEAL);
  return dmg;
}
function unbTick(p, dt) {
  if (p.resolve > 0) {
    p.resolveIdle += dt;
    if (p.resolveIdle > UNB_IDLE_T) p.resolve = Math.max(0, p.resolve - UNB_DRAIN * dt);
  }
  if (p.nkT > 0) p.nkT = Math.max(0, p.nkT - dt);
  if (p.defyT > 0) {
    p.defyT = Math.max(0, p.defyT - dt);
    if (p.defyT <= 0 || p.wardHp <= 0) defyRelease(p);
  }
}
// a body leaving the world drops all of it (bodyOut, js/sim/player.js)
function unbOut(p) { p.resolve = 0; p.resolveIdle = 0; p.defyT = 0; p.defyHp = 0; p.nkT = 0; }
// the tenacity high resolve and the leap's after give, and the after's attack damage
HERO_TEN.push((e) => (unbHigh(e) ? UNB_TEN : 0));
HERO_TEN.push((e) => (isFort(e) && e.nkT > 0 ? NOKNEEL_TEN : 0));
HERO_STAT.push({ name: 'NO KNEELING', add: (p, key) => (key === 'dmg' && isFort(p) && p.nkT > 0 ? NOKNEEL_AD + NOKNEEL_AD_LV * (p.level - 1) : 0) });

// ---- Q SEVER THE CHAINS ---------------------------------------------------------
function fortSever(p) {
  const a = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
  const dmg = abDmg(p, 'sever', abRk(p, 'sever', 'dmg'));
  let heroes = 0;
  for (const q of unitsInCone(p, p.x, p.y, a, SEVER_R, SEVER_HALF)) {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const edge = d >= SEVER_EDGE;
    hurtUnit(q, edge ? Math.round(dmg * SEVER_EDGE_MUL) : dmg, (q.x - p.x) / d, (q.y - p.y) / d, p, { kb: edge ? 70 : 40 });
    burst(q.x, unitMidY(q), edge ? '#f2cc6a' : '#cfd8e8', edge ? 8 : 5, 45, 0.4, true);
    if (edge && q instanceof Player && q.team !== p.team) heroes++;
  }
  for (const s of structsInCone(p, p.x, p.y, a, SEVER_R, SEVER_HALF)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x + Math.cos(a) * SEVER_R * 0.6, p.y + Math.sin(a) * SEVER_R * 0.6, SEVER_R * 0.5, Math.round(dmg * SEVER_EDGE_MUL));
  if (heroes) {
    healPlayer(p, Math.min(heroes, SEVER_HEAL_N) * (SEVER_HEAL + p.maxHp * SEVER_HEAL_HP));
    burst(p.x, p.y - 10, '#9fd6a0', 8, 35, 0.45, true);
  }
  abFx.push({ kind: 'wedge', x: p.x, y: p.y - 2, a, r: SEVER_R, half: SEVER_HALF, t: 0, col: '#f4f7ff' });
  p.slashT = SLASH_T; p.slashA = a; p.slashHalf = SEVER_HALF; // the blade swept through the arc in her hands
  shakeFor(p, heroes ? 4 : 2);
  sfxAt('swing', p.x, p.y);
}

// ---- W DEFIANT HEART ----------------------------------------------------------
// The shield is the shared timed one (shieldUnit); what it took is what is gone
// from it when it breaks or runs out (defyHp, its size, less wardHp).
function fortDefy(p) {
  const hp = Math.round(p.maxHp * abRk(p, 'defy', 'shieldHp') + abAp(p, 'defy'));
  shieldUnit(p, hp, DEFY_T + 0.25); // (a beat longer than the heart's clock, so what is left of it at the release is read before it fades)
  p.defyHp = p.wardHp;
  p.defyT = DEFY_T;
  burst(p.x, p.y - 8, '#f2cc6a', 10, 45, 0.45, true);
  sfxAt('place', p.x, p.y);
}
function defyRelease(p) {
  const took = Math.max(0, p.defyHp - p.wardHp);
  p.defyT = 0; p.defyHp = 0;
  if (p.wardHp > 0) { p.wardHp = 0; p.wardT = 0; } // the wave spends what is left of it
  const dmg = Math.round(abRk(p, 'defy', 'dmg') + took * DEFY_PAY + abAp(p, 'defy'));
  for (const q of unitsHit(p, p.x, p.y, DEFY_R)) {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    hurtUnit(q, dmg, (q.x - p.x) / d, (q.y - p.y) / d, p, { kb: 90 });
    burst(q.x, unitMidY(q), '#f2cc6a', 6, 45, 0.4, true);
  }
  for (const s of structsNear(p, p.x, p.y, DEFY_R)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x, p.y, DEFY_R, dmg);
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: DEFY_R, t: 0, col: took > 0 ? '#f2cc6a' : '#cfd8e8' });
  shakeFor(p, took > 0 ? 4 : 2);
  sfxAt('shieldBreak', p.x, p.y);
}

// ---- E BREAK THE YOKE -----------------------------------------------------------
// The lunge rides the rush's state as a hero dash (HERO_DASH.yoke), stops on the
// first rival hero, and ends in the strike.
function fortYoke(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = YOKE_T;
  p.rushVictim = null;
  p.dash = 'yoke';
  p.sliding = false;
  faceToward(p, dx, dy, true);
  burst(p.x, p.y + 4, '#dfe8f4', 6, 40, 0.35, true);
  sfxAt('dodge', p.x, p.y);
}
HERO_DASH.yoke = { spd: YOKE_SPD, t: YOKE_T, ramp: 0.03, step: (p, mv) => {
  let stop = mv.blockedX || mv.blockedY || p.rushT <= 0;
  for (const q of unitsHit(p, p.x + p.rushNX * 6, p.y + p.rushNY * 6, PLAYER_R + 4)) if (q instanceof Player) stop = true;
  if (stop) yokeStrike(p);
} };
function yokeStrike(p) {
  p.rushT = 0; p.dash = '';
  p.vx = p.rushNX * 30; p.vy = p.rushNY * 30;
  const cx = p.x + p.rushNX * 8, cy = p.y + p.rushNY * 8;
  const dmg = abDmg(p, 'yoke', abRk(p, 'yoke', 'dmg'));
  let hero = false;
  for (const q of unitsHit(p, cx, cy, YOKE_R)) {
    const d = Math.hypot(q.x - cx, q.y - cy) || 1;
    hurtUnit(q, dmg, (q.x - cx) / d, (q.y - cy) / d, p, { kb: 60 });
    if (!q.dead) slowUnit(q, abRk(p, 'yoke', 'slowT'), abRk(p, 'yoke', 'slow'));
    burst(q.x, unitMidY(q), '#cfd8e8', 6, 45, 0.4, true);
    if (q instanceof Player && q.team !== p.team) hero = true;
  }
  for (const s of structsNear(p, cx, cy, YOKE_R)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(cx, cy, YOKE_R, dmg);
  const i = abKeyOf(p, 'yoke');
  if (hero && i >= 0) { p.abCd[i] *= 1 - YOKE_REFUND; burst(p.x, p.y - 12, '#f2cc6a', 6, 35, 0.4, true); }
  abFx.push({ kind: 'ring', x: cx, y: cy, r: YOKE_R, t: 0, col: '#f4f7ff' });
  for (let s = -10; s <= 10; s += 5) burst(cx - p.rushNY * s, cy + 2 + p.rushNX * s, '#eef4fb', 2, 30, 0.35, true); // the crack across the line
  shakeFor(p, 4);
  sfxAt('break_', cx, cy);
}

// ---- R NO KNEELING ----------------------------------------------------------------
// where the leap comes down: the aim, no further than its reach
function noKneelAt(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy);
  const k = d > NOKNEEL_RANGE ? NOKNEEL_RANGE / d : 1;
  return [p.x + dx * k, p.y + dy * k, Math.min(d, NOKNEEL_RANGE)];
}
// The leap is a hero dash too (HERO_DASH.vault): straight at the spot at its own
// speed, for as long as the spot is away. A wall stops it short, a stun drops her
// where she is (stunUnit ends any dash) and nothing lands.
function fortNoKneel(p) {
  const [tx, ty, d] = noKneelAt(p);
  const n = d || 1;
  p.rushNX = (tx - p.x) / n; p.rushNY = (ty - p.y) / n;
  p.rushT = Math.max(TICK_DT, d / NOKNEEL_SPD);
  p.vaultMax = p.rushT;
  p.rushVictim = null;
  p.dash = 'vault';
  p.sliding = false;
  faceToward(p, tx - p.x, ty - p.y, true);
  burst(p.x, p.y + 4, '#dfe8f4', 10, 50, 0.4, true);
  sfxAt('dodge', p.x, p.y);
}
HERO_DASH.vault = { spd: NOKNEEL_SPD, t: NOKNEEL_RANGE / NOKNEEL_SPD, ramp: 0.001,
  step: (p, mv) => { if (mv.blockedX || mv.blockedY || p.rushT <= 0) noKneelLand(p); },
  pose: (p) => ({ dx: 0, dy: -Math.round(12 * Math.sin(Math.PI * Math.min(1, 1 - p.rushT / (p.vaultMax || 1)))), rot: 0 }) }; // the arc through the air
function noKneelLand(p) {
  p.rushT = 0; p.dash = ''; p.vaultMax = 0;
  p.vx = p.vy = 0;
  const dmg = abDmg(p, 'nokneel', abRk(p, 'nokneel', 'dmg'));
  for (const q of unitsHit(p, p.x, p.y, NOKNEEL_R)) {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    hurtUnit(q, dmg, (q.x - p.x) / d, (q.y - p.y) / d, p, { kb: 80 });
    if (!q.dead && d <= NOKNEEL_UP_R) knockUp(q, abRk(p, 'nokneel', 'up'), p);
    burst(q.x, unitMidY(q), '#f2cc6a', 8, 50, 0.45, true);
  }
  for (const s of structsNear(p, p.x, p.y, NOKNEEL_R)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x, p.y, NOKNEEL_R, dmg);
  p.nkT = NOKNEEL_T;
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: NOKNEEL_R, t: 0, col: '#f2cc6a' });
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: NOKNEEL_UP_R, t: 0, col: '#f4f7ff' });
  for (let i = 0; i < 18; i++) { // the snow thrown off the impact
    const an = (i / 18) * Math.PI * 2;
    burst(p.x + Math.cos(an) * 10, p.y + 2 + Math.sin(an) * 6, i % 3 ? '#eef4fb' : '#cfd8e8', 1, 60, 0.4, true);
  }
  shakeFor(p, 7);
  sfxAt('break_', p.x, p.y);
}
