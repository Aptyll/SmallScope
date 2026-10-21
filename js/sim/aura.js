'use strict';
// AURA, THE NORTHERN LIGHT - a named hero (CLASSES, js/sim/player.js) and the
// far, patient mage: artillery. She strikes from further than anyone, slowly
// and in plain view, and what her light touches cannot hide. Caught up close
// she has one step and nothing else. Loaded before abilities.js, whose
// CLASS_AB takes AURA_AB as her row of keys; she registers into the shared hero
// hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ aura

// ---- tuning --------------------------------------------------------------
// STARLIGHT (the passive): in the dark her keys reach further, up to this
// much more at full night (state.darkness, js/sim/sim.js); a rival her keys
// touch is revealed (markUnit: seen through the fog and the woods) for a while
const STARLIGHT_REACH = 0.25;   // reach x (1 + this x darkness)
const STARLIGHT_T = 3;          // s a rival she touched stays revealed
// Q FALLING STAR: a spot far off is struck after a beat; its ring shows on the snow the whole time
const STAR_RANGE = 300;         // px from her the spot may be set (by day)
const STAR_R = 26;              // px of ring
const STAR_CORE = 9;            // px of its very centre...
const STAR_CORE_MUL = 1.5;      // ...where the blow lands this much harder
const STAR_DELAY = 0.8;         // s from the cast to the strike
// W DRIFTING LIGHT: an orb drifting slowly down the aim, through walls (it is light)
const ORB_LEN = 220;            // px it drifts (by day)
const ORB_SPD = 70;             // px/s
const ORB_R = 16;               // px round it a body is touched
const ORB_SLOW_T = 1;           // s the slow holds after the orb has passed
// E STEP OF LIGHT: a blink down the aim; rivals at the spot she left are slowed
const STEP_LEN = 72;            // px (by day)
const STEP_SPD = 900;           // px/s: a few frames, so a wall still stops it (HERO_DASH)
const STEP_R = 26;              // px round the spot she left
const STEP_SLOW = 0.5;          // walk x this
// R THE CURTAIN: a long band of light falls down the aim from where she stands, after a delay
const CURTAIN_LEN = 900;        // px of band (by day): most of the way across the field
const CURTAIN_HALF = 12;        // px either side of its middle a body is struck
const CURTAIN_SEE = 40;         // px either side of it the hidden are revealed
const CURTAIN_DELAY = 1.6;      // s from the cast to the fall

const auraStars = [];    // {x, y, team, owner, t, delay, dmg} - Q's spots waiting to be struck
const auraOrbs = [];     // {x, y, nx, ny, d, len, team, owner, slow} - W's drifting lights
const auraCurtains = []; // {x, y, nx, ny, len, team, owner, t, delay, dmg} - R's bands waiting to fall
// (each carries its caster's rank and reach from the moment it was cast)

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
// `aim` is the reach by day: the night's extra is read live (auraReach).
const AURA_AB = [
  {
    id: 'star', name: 'FALLING STAR', cd: [9, 8.5, 8, 7.5, 7], ap: 0.7, cast: 0.3, aim: { line: STAR_RANGE },
    rank: { dmg: [16, 24, 32, 40, 48] }, // the ring's blow; its centre takes STAR_CORE_MUL of it
    tip: 'A SPOT FAR OFF IS STRUCK. CENTRE HURTS MORE',
    blurb: 'A SPOT FAR AWAY IS STRUCK AFTER A SHORT DELAY, ITS RING SHOWN ON THE SNOW. RIVALS INSIDE ARE HURT, MORE IN THE VERY CENTRE.',
    use: (p) => auraStar(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = auraSpot(p, STAR_RANGE); drawStarRing(Math.round(c.x - ex), Math.round(c.y - ey), col, 0.45 + 0.45 * closing, closing * 0.4); },
    pose: () => ({ dx: 0, dy: -2, rot: 0 }), // the staff raised to the sky
    icon: AURA_ICON32.star,
    bot: (p, foe, d) => d < auraReach(p, STAR_RANGE) - 10,
  },
  {
    id: 'orb', name: 'DRIFTING LIGHT', cd: [13, 12.5, 12, 11.5, 11], cast: 0.25, aim: { line: ORB_LEN },
    rank: { slow: [0.7, 0.65, 0.6, 0.55, 0.5] }, // walk x this while it passes them
    tip: 'A SLOW ORB. SLOWS AND REVEALS',
    blurb: 'A SLOW ORB OF LIGHT DRIFTS ALONG A LINE, THROUGH TREES AND WALLS. RIVALS IT PASSES ARE SLOWED AND REVEALED.',
    use: (p) => auraOrb(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), auraReach(p, ORB_LEN), col, 0.5 + 0.45 * closing, now, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? -1 : 0, rot: 0 }),
    icon: AURA_ICON32.orb,
    bot: (p, foe, d) => foe instanceof Player && d < auraReach(p, ORB_LEN) * 0.8,
  },
  {
    id: 'step', name: 'STEP OF LIGHT', cd: [18, 17, 16, 15, 14], cast: 0.05, aim: { line: STEP_LEN },
    rank: { slowT: [1, 1.25, 1.5, 1.75, 2] }, // s the rivals at the spot she left are slowed
    tip: 'BLINK. RIVALS WHERE YOU STOOD ARE SLOWED',
    blurb: 'A SHORT BLINK. RIVALS AT THE SPOT YOU LEFT ARE SLOWED.',
    use: (p) => auraStep(p),
    icon: AURA_ICON32.step,
    bot: (p, foe, d) => foe instanceof Player && d < 44, // reached: her one way out
    botAim: (p, foe) => { const dx = p.x - foe.x, dy = p.y - foe.y, d = Math.hypot(dx, dy) || 1; return { x: p.x + dx / d * 60, y: p.y + dy / d * 60 }; }, // away from them
  },
  {
    id: 'curtain', name: 'THE CURTAIN', cd: [110, 95, 80], ap: 0.9, cast: 0.5, aim: { line: CURTAIN_LEN },
    rank: { dmg: [70, 110, 150] }, // the band's blow
    tip: 'A BAND OF LIGHT FALLS ACROSS THE MAP',
    blurb: 'A LONG BAND OF LIGHT FALLS ACROSS THE MAP IN A LINE AFTER A DELAY. RIVALS UNDER IT TAKE HEAVY DAMAGE, AND EVERYONE HIDDEN ALONG IT IS REVEALED.',
    use: (p) => auraCurtain(p),
    tele: (p, px, py, a, col, closing) => drawCurtainBand(px, py, Math.cos(a), Math.sin(a), auraReach(p, CURTAIN_LEN), col, 0.35 + 0.4 * closing, 0),
    pose: () => ({ dx: 0, dy: -2, rot: 0 }),
    icon: AURA_ICON32.curtain,
    bot: (p, foe, d) => foe instanceof Player && d < auraReach(p, CURTAIN_LEN) * 0.6 && (foe.hp < foe.maxHp * 0.6 || foe.slowT > 0 || foe.stunT > 0),
  },
];

// ---- STARLIGHT ------------------------------------------------------------------
// what a reach becomes for her right now: longer the darker it is
function auraReach(p, base) { return base * (1 + STARLIGHT_REACH * (state.darkness || 0)); }
// the spot at her aim, no further than `range` (stretched by the night)
function auraSpot(p, range) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const r = Math.min(d, auraReach(p, range));
  return { x: p.x + dx / d * r, y: p.y + dy / d * r };
}
// a rival her light touched: revealed, through the fog and the woods (markUnit)
function auraReveal(e) { if (unitTeam(e) >= 0) markUnit(e, STARLIGHT_T); }
// the caster of something she left in the world, while it is still hers to credit
function auraSrc(w) { const o = players[w.owner]; return o && o.team === w.team ? o : null; }

// ---- Q FALLING STAR ---------------------------------------------------------------
function auraStar(p) {
  const c = auraSpot(p, STAR_RANGE);
  auraStars.push({ x: c.x, y: c.y, team: p.team, owner: p.id, t: 0, delay: STAR_DELAY,
    dmg: abDmg(p, 'star', abRk(p, 'star', 'dmg')) });
  burst(p.x, p.y - 18, '#fff3b0', 6, 40, 0.4, true);
  sfxAt('pickup', p.x, p.y);
}
function starStrike(s) {
  const side = sideOf(s), src = auraSrc(s);
  for (const q of unitsHit(side, s.x, s.y, STAR_R)) {
    const d = Math.hypot(q.x - s.x, q.y - s.y);
    const dmg = d <= STAR_CORE ? Math.round(s.dmg * STAR_CORE_MUL) : s.dmg;
    hurtUnit(q, dmg, (q.x - s.x) / (d || 1), (q.y - s.y) / (d || 1), src, { kb: 30, ab: 'star' });
    auraReveal(q);
    burst(q.x, unitMidY(q), d <= STAR_CORE ? '#ffffff' : '#fff3b0', 8, 50, 0.45, true);
  }
  for (const st of structsNear(side, s.x, s.y, STAR_R)) hurtStruct(st, s.dmg, src);
  if (PRACTICE) abHitDummies(s.x, s.y, STAR_R, s.dmg);
  abFx.push({ kind: 'ring', x: s.x, y: s.y, r: STAR_R, t: 0, col: '#fff3b0' });
  abFx.push({ kind: 'ring', x: s.x, y: s.y, r: STAR_CORE, t: 0, col: '#ffffff' });
  burst(s.x, s.y, '#fff3b0', 18, 70, 0.5, true);
  burst(s.x, s.y, '#ffffff', 8, 40, 0.4, true);
  shakeAt(s.x, s.y, 3, 80);
  sfxAt('break_', s.x, s.y);
}

// ---- W DRIFTING LIGHT ---------------------------------------------------------------
function auraOrb(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  auraOrbs.push({ x: p.x, y: p.y - 6, nx: dx / d, ny: dy / d, d: 0, len: auraReach(p, ORB_LEN),
    team: p.team, owner: p.id, slow: abRk(p, 'orb', 'slow') });
  burst(p.x, p.y - 8, '#e6f8ff', 8, 40, 0.4, true);
  sfxAt('pickup', p.x, p.y);
}
// The orbs drift on; every rival body round one is slowed (refreshed while it
// passes) and revealed. Light, not a body: trees and walls do not stop it.
function updateAuraOrbs(dt) {
  for (let i = auraOrbs.length - 1; i >= 0; i--) {
    const o = auraOrbs[i];
    const step = Math.min(ORB_SPD * dt, o.len - o.d);
    o.x += o.nx * step; o.y += o.ny * step; o.d += step;
    for (const q of unitsNear(sideOf(o), o.x, o.y + 6, ORB_R)) {
      if (unitTeam(q) === o.team) continue;
      slowUnit(q, ORB_SLOW_T, o.slow);
      auraReveal(q);
    }
    if (o.d >= o.len) { burst(o.x, o.y, '#e6f8ff', 8, 35, 0.4, true); auraOrbs.splice(i, 1); }
  }
}

// ---- E STEP OF LIGHT ----------------------------------------------------------------
// The blink is a hero dash (HERO_DASH.step) so fast it lasts a few frames: a
// wall or the water's edge still stops it short. The spot she left flashes, and
// every rival standing there is slowed.
function auraStep(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const len = Math.min(d, auraReach(p, STEP_LEN));
  const slowT = abRk(p, 'step', 'slowT');
  for (const q of unitsNear(p, p.x, p.y, STEP_R)) {
    slowUnit(q, slowT, STEP_SLOW);
    auraReveal(q);
    burst(q.x, unitMidY(q), '#e6f8ff', 5, 35, 0.4, true);
  }
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: STEP_R, t: 0, col: '#e6f8ff' });
  burst(p.x, p.y - 6, '#e6f8ff', 14, 55, 0.45, true);
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = Math.max(TICK_DT, len / STEP_SPD);
  p.rushVictim = null;
  p.dash = 'step';
  p.sliding = false;
  faceToward(p, dx, dy, true);
  sfxAt('dodge', p.x, p.y);
}
function stepEnd(p) {
  p.rushT = 0; p.dash = '';
  p.vx = p.rushNX * 30; p.vy = p.rushNY * 30;
  burst(p.x, p.y - 6, '#e6f8ff', 10, 45, 0.4, true);
}
HERO_DASH.step = { spd: STEP_SPD, t: STEP_LEN / STEP_SPD, ramp: 0.001, through: true,
  step: (p, mv) => { if (mv.blockedX || mv.blockedY || p.rushT <= 0) stepEnd(p); } };

// ---- R THE CURTAIN -------------------------------------------------------------------
function auraCurtain(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  auraCurtains.push({ x: p.x, y: p.y, nx: dx / d, ny: dy / d, len: auraReach(p, CURTAIN_LEN),
    team: p.team, owner: p.id, t: 0, delay: CURTAIN_DELAY, dmg: abDmg(p, 'curtain', abRk(p, 'curtain', 'dmg')) });
  burst(p.x, p.y - 18, '#86f0bf', 12, 50, 0.5, true);
  sfxAt('pickup', p.x, p.y);
}
// every body of the other side within `half` px of a band (and along it)
function curtainBodies(c, half) {
  const out = [];
  const mx = c.x + c.nx * c.len / 2, my = c.y + c.ny * c.len / 2;
  for (const q of unitsNear(sideOf(c), mx, my, c.len / 2 + half + 8)) {
    const qx = q.x - c.x, qy = q.y - c.y;
    const along = qx * c.nx + qy * c.ny, perp = Math.abs(qx * c.ny - qy * c.nx);
    if (along >= -half && along <= c.len + half && perp <= half + unitRadius(q)) out.push(q);
  }
  return out;
}
function curtainFall(c) {
  const side = sideOf(c), src = auraSrc(c);
  // the hidden along it first: anyone in the wider glow is revealed, struck or not
  for (const q of curtainBodies(c, CURTAIN_SEE)) if (unitTeam(q) !== c.team) auraReveal(q);
  for (const q of curtainBodies(c, CURTAIN_HALF)) {
    if (q.invuln > 0) continue; // a roll under it is a roll under it
    const s = (q.x - c.x) * -c.ny + (q.y - c.y) * c.nx >= 0 ? 1 : -1;
    hurtUnit(q, c.dmg, -c.ny * s, c.nx * s, src, { kb: 40, ab: 'curtain' });
    burst(q.x, unitMidY(q), '#86f0bf', 10, 55, 0.5, true);
  }
  const seen = [];
  for (let s = 0; s <= c.len; s += 12) {
    for (const st of structsNear(side, c.x + c.nx * s, c.y + c.ny * s, CURTAIN_HALF)) if (!seen.includes(st)) { seen.push(st); hurtStruct(st, c.dmg, src); }
  }
  if (PRACTICE) for (let s = 0; s <= c.len; s += CURTAIN_HALF * 2) abHitDummies(c.x + c.nx * s, c.y + c.ny * s, CURTAIN_HALF, c.dmg);
  abFx.push({ kind: 'line', x: c.x, y: c.y, a: Math.atan2(c.ny, c.nx), r: c.len, half: CURTAIN_HALF, t: 0, col: '#86f0bf' });
  for (let s = 8; s < c.len; s += 16) burst(c.x + c.nx * s, c.y + c.ny * s, s % 32 ? '#86f0bf' : '#e6f8ff', 2, 30, 0.45, true);
  if (src) shakeFor(src, 4);
  sfxAt('break_', c.x + c.nx * c.len / 2, c.y + c.ny * c.len / 2);
}

// ---- what she leaves in the world, one sim step (HERO_TICK) ----------------------------
function updateAuraWorld(dt) {
  for (let i = auraStars.length - 1; i >= 0; i--) {
    const s = auraStars[i];
    s.t += dt;
    if (s.t >= s.delay) { auraStars.splice(i, 1); starStrike(s); }
  }
  updateAuraOrbs(dt);
  for (let i = auraCurtains.length - 1; i >= 0; i--) {
    const c = auraCurtains[i];
    c.t += dt;
    if (c.t >= c.delay) { auraCurtains.splice(i, 1); curtainFall(c); }
  }
}

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.starlight = {
  name: 'STARLIGHT', blurb: 'AT NIGHT YOUR ABILITIES REACH FURTHER. A RIVAL YOUR ABILITIES TOUCH IS REVEALED FOR A FEW SECONDS, EVEN IN THE WOODS.',
  icon: AURA_ICON32.starlight,
};
HERO_TICK.push(updateAuraWorld);
