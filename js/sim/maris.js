'use strict';
// MARIS, THE ICE DIVER - a named hero (CLASSES, js/sim/player.js) and a tank who
// catches one rival. Near the creek and on ice she is quick and her strikes
// chill; she swims open water where everyone else goes in. She harpoons a rival
// and reels herself to them, braces against a crowd, pulls the water's cold round
// her, and for her ultimate goes under the snow to burst up beneath them - on
// ice, breaking it in the orca's shape. Loaded before abilities.js, whose
// CLASS_AB takes MARIS_AB as her row of keys; she registers into the shared
// hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ maris

// ---- tuning --------------------------------------------------------------
// COLD WATER (the passive): on ice, in open water or beside it she is "cold"
// (p.coldT), and keeps it COLD_KEEP s after she leaves
const COLD_KEEP = 3;            // s it lasts off the water
const COLD_NEAR = 1;            // tiles from open water that still count
const COLD_WALK = 1.12;         // her walk while cold
const COLD_SLOW = 0.8;          // a basic strike's slow while cold (walk x)...
const COLD_SLOW_T = 1;          // ...for this long
// Q HARPOON: a harpoon on a line; the first rival hit is rooted and she reels in
const HARPOON_SPD = 420;        // px/s
const HARPOON_RANGE = 230;      // px of flight
const REEL_SPD = 460;           // px/s she is reeled
const REEL_STOP = 14;           // px short of the body she stops
// W BRACE FOR COLD: a share off every hit, more for each rival hero near
const BRACE_T = 3;              // s
const BRACE_NEAR = 110;         // px a rival hero counts from
const BRACE_PER = 0.06;         // more off for each one near...
const BRACE_CAP = 0.5;          // ...up to this share
// E UNDERTOW: a ring of cold water round her
const TOW_FX_LIFE = 0.6;        // s the whirl's crests take to close in (drawUndertowFx, js/draw/maris.js)
const UNDERTOW_R = 56;          // px
const UNDERTOW_T = 1.6;         // s of slow
// R BREACH: under the snow to a spot, then up through it
const BREACH_RANGE = 320;       // px she can go
const BREACH_SPD = 300;         // px/s under the snow
const BREACH_R = 40;            // px of ring she comes up in
const BREACH_HOLD = 2.5;        // s a hole she breaks stays open before it freezes

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const MARIS_AB = [
  {
    id: 'harpoon', name: 'HARPOON', cd: [12, 11.5, 11, 10.5, 10], ap: 0.6, cast: 0.25, aim: { line: HARPOON_RANGE },
    rank: { dmg: [30, 45, 60, 75, 90], root: 0.6 },
    tip: 'HARPOON A RIVAL. ROOTS. REEL YOURSELF IN',
    blurb: 'THROW A HARPOON ON A LINE. THE FIRST RIVAL HIT IS ROOTED IN PLACE AND YOU REEL YOURSELF TO THEM.',
    use: (p) => marisHarpoon(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), teleLen(p.x, p.y, Math.cos(a), Math.sin(a), HARPOON_RANGE), col, 0.5 + 0.45 * closing, now, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.7 ? -1 : 1, rot: 0 }), // drawn back, then thrown
    icon: MARIS_ICON32.harpoon, mark: 'root',
    bot: (p, foe, d, clear) => clear && foe instanceof Player && d < HARPOON_RANGE - 12,
  },
  {
    id: 'brace', name: 'BRACE FOR COLD', cd: [16, 15, 14, 13, 12], ap: 0, cast: 0.1, // no aim: it is on her
    rank: { ward: [0.15, 0.18, 0.21, 0.24, 0.27] }, // the share off every hit, before any rival is near
    tip: 'TAKE LESS FROM HITS, MORE IF CROWDED',
    blurb: 'BRACE FOR A FEW SECONDS: TAKE LESS FROM EVERY HIT, AND LESS STILL FOR EACH RIVAL HERO NEAR YOU.',
    use: (p) => marisBrace(p),
    pose: () => ({ dx: 0, dy: 1, rot: 0 }), // set low
    icon: MARIS_ICON32.brace, mark: 'shield',
    bot: (p, foe, d) => d < BRACE_NEAR && p.hp < p.maxHp * 0.75,
  },
  {
    id: 'undertow', name: 'UNDERTOW', cd: [11, 10.5, 10, 9.5, 9], ap: 0.5, cast: 0.2, aim: { ring: UNDERTOW_R },
    rank: { dmg: [20, 32, 44, 56, 68], slow: 0.7, ice: 0.45 }, // slow: walk x; ice: walk x for one on ice
    tip: 'COLD RING. SLOWS, MORE ON ICE',
    blurb: 'A RING OF COLD WATER WELLS UP ROUND YOU. RIVALS INSIDE ARE HURT AND SLOWED, AND SLOWED MUCH MORE ON ICE.',
    use: (p) => marisUndertow(p),
    tele: (p, px, py, a, col, closing, now) => drawUndertowTele(px, py, closing, now), // the water's seams spiralling out (js/draw/maris.js)
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? 0 : 1, rot: 0 }),
    icon: MARIS_ICON32.undertow, mark: 'slow',
    bot: (p, foe, d) => d < UNDERTOW_R - 6,
  },
  {
    id: 'breach', name: 'BREACH', cd: [110, 95, 80], ap: 0.8, cast: 0.4, aim: { ring: BREACH_RANGE }, // how far she can go
    rank: { dmg: [60, 100, 140], up: [0.8, 1, 1.2] }, // up: s in the air
    tip: 'DIVE UNDER, BURST UP. ON ICE, BREAKS IT',
    blurb: 'DIVE UNDER THE SNOW AND GO, UNHITTABLE, TO A SPOT. BURST UP THERE: RIVALS OVER IT ARE KNOCKED UP. ON ICE YOU BREAK IT IN THE ORCA\'S SHAPE, AND THEY GO IN THE WATER.',
    use: (p) => marisBreach(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const s = breachSpot(p, p.input.aimX, p.input.aimY); drawRing(Math.round(s[0] - ex), Math.round(s[1] - ey), BREACH_R, col, 0.4 + 0.4 * closing, closing * 0.5); }, // where she comes up
    pose: () => ({ dx: 0, dy: 2, rot: 0 }), // crouched to dive
    icon: MARIS_ICON32.breach, mark: 'up',
    bot: (p, foe, d) => foe instanceof Player && d > 70 && d < BREACH_RANGE,
  },
];

// ---- COLD WATER ---------------------------------------------------------------------
function isMaris(p) { return CLASSES[p.cls] && CLASSES[p.cls].passive === 'coldwater'; }
// open water on or beside her feet, or ice under them
function coldUnder(p) {
  if (iceUnder(p)) return true;
  const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + 4) / TILE);
  for (let dy = -COLD_NEAR; dy <= COLD_NEAR; dy++) for (let dx = -COLD_NEAR; dx <= COLD_NEAR; dx++) if (waterAt(tx + dx, ty + dy)) return true;
  return false;
}
function coldTick(p, dt) {
  if (p.underT > 0) return; // under the snow the clock holds
  if (coldUnder(p)) p.coldT = COLD_KEEP;
  else p.coldT = Math.max(0, p.coldT - dt);
  if (p.braceT > 0) p.braceT = Math.max(0, p.braceT - dt);
}
// a cold basic strike chills; HARPOON roots and reels her in (o.ab names the key that landed it)
function coldDeal(p, e, dmg, o) {
  if (o.basic && p.coldT > 0) slowUnit(e, COLD_SLOW_T, COLD_SLOW);
  if (o.ab === 'harpoon' && e !== p) harpoonCatch(p, e);
  return dmg;
}
function coldMove(p) { return p.coldT > 0 && isMaris(p) ? COLD_WALK : 1; }
// she swims: open water never takes her (HERO_SWIM, js/sim/heroes.js)
function coldSwim(p) { return isMaris(p); }
function coldOut(p) { p.coldT = 0; p.braceT = 0; p.underT = 0; }

// ---- Q HARPOON ------------------------------------------------------------------------
// The harpoon rides the shots in flight (arrows, js/sim/sim.js); the blow it
// lands roots the body and starts her reel (coldDeal, above).
function marisHarpoon(p) {
  const a = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
  arrows.push({
    x: p.x, y: p.y - BOW_Y,
    vx: Math.cos(a) * HARPOON_SPD, vy: Math.sin(a) * HARPOON_SPD,
    t: 0, life: HARPOON_RANGE / HARPOON_SPD, dmg: abDmg(p, 'harpoon', abRk(p, 'harpoon', 'dmg')), pow: 1,
    owner: p.id, team: p.team, trailD: 0,
    solid: true, kb: 0, col: '#b4bdcc', ab: 'harpoon',
    look: 'harpoon', // drawn as the harpoon and its line (HERO_SHOTS, js/draw/maris.js)
    ang: a, spd: HARPOON_SPD, ox: p.x, oy: p.y - BOW_Y,
  });
  sfxAt('arrow', p.x, p.y);
}
// the harpoon is in: the body is held and she is reeled to where it stands
function harpoonCatch(p, e) {
  if (!unitAlive(e) || p.dead || p.fallT > 0) return;
  rootUnit(e, abRk(p, 'harpoon', 'root'), p);
  const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
  if (d <= REEL_STOP + 2) return;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = Math.min(0.8, (d - REEL_STOP) / REEL_SPD);
  p.dash = 'reel';
  p.reelX = Math.round(e.x); p.reelY = Math.round(e.y);
  p.sliding = false;
  faceToward(p, dx, dy, true);
  sfxAt('swing', p.x, p.y);
}
HERO_DASH.reel = { spd: REEL_SPD, t: 0.8, ramp: 0.001, through: true, step: (p, mv) => reelStep(p, mv), pose: () => ({ dx: 0, dy: -1, rot: 0 }) };
function reelStep(p, mv) {
  const d = Math.hypot(p.reelX - p.x, p.reelY - p.y);
  if (d <= REEL_STOP || mv.blockedX || mv.blockedY || p.rushT <= 0) {
    p.rushT = 0; p.dash = '';
    p.vx = p.rushNX * 30; p.vy = p.rushNY * 30;
    burst(p.x + p.rushNX * 6, p.y, '#dfe8f4', 5, 35, 0.35, true);
  }
}

// ---- W BRACE FOR COLD ------------------------------------------------------------------------
function marisBrace(p) {
  p.braceT = BRACE_T;
  p.braceCut = abRk(p, 'brace', 'ward'); // copied as cast: the rank it was braced at
  burst(p.x, p.y - 6, '#cfeeff', 8, 40, 0.4, true);
  sfxFor(p, 'place');
}
function braceNear(p) {
  let n = 0;
  for (const q of players) if (q !== p && q.team !== p.team && unitAlive(q) && Math.hypot(q.x - p.x, q.y - p.y) < BRACE_NEAR) n++;
  return n;
}
// braced, a share of every hit is shrugged off (HERO_TAKEN, after armor)
function braceTaken(p, dmg) {
  if (!(p.braceT > 0) || dmg <= 0 || !isMaris(p)) return dmg;
  const cut = Math.min(BRACE_CAP, (p.braceCut || 0) + BRACE_PER * braceNear(p));
  return Math.max(1, Math.round(dmg * (1 - cut)));
}
HERO_TAKEN.push(braceTaken);

// ---- E UNDERTOW --------------------------------------------------------------------------
function marisUndertow(p) {
  const dmg = abDmg(p, 'undertow', abRk(p, 'undertow', 'dmg'));
  const slow = abRk(p, 'undertow', 'slow'), ice = abRk(p, 'undertow', 'ice');
  for (const q of unitsHit(p, p.x, p.y, UNDERTOW_R)) {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const onIce = q instanceof Player ? iceUnder(q) : coldTileIce(q.x, q.y);
    hurtUnit(q, dmg, (p.x - q.x) / d, (p.y - q.y) / d, p, { kb: 30 }); // the water draws them in a little
    if (!q.dead) slowUnit(q, UNDERTOW_T, onIce ? ice : slow);
    burst(q.x, q.y + 2, '#7cc4e8', 5, 35, 0.4, true);
  }
  for (const s of structsNear(p, p.x, p.y, UNDERTOW_R)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x, p.y, UNDERTOW_R, dmg);
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: UNDERTOW_R, t: 0, col: '#7cc4e8', fx: 'undertow', life: TOW_FX_LIFE });
  burst(p.x, p.y + 2, '#3a6080', 10, 60, 0.5, true);
  burst(p.x, p.y + 2, '#cfeeff', 10, 70, 0.5, true);
  sfxAt('splash', p.x, p.y);
}
function coldTileIce(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor((y + 4) / TILE);
  return inWorld(tx, ty) && ground[idx(tx, ty)] === 1;
}

// ---- R BREACH ------------------------------------------------------------------------------
// Under the snow she rides the rush's state (HERO_DASH) untouchable (invuln, so
// every weapon's unitsHit passes her by) and drawn as the snow heaving over her
// (HERO_BODY_DRAW, js/draw/maris.js). p.underT is the s left under.
function breachSpot(p, ax, ay) {
  const dx = ax - p.x, dy = ay - p.y, d = Math.hypot(dx, dy) || 1, r = Math.min(d, BREACH_RANGE);
  return [p.x + dx / d * r, p.y + dy / d * r];
}
function marisBreach(p) {
  const s = breachSpot(p, p.input.aimX, p.input.aimY);
  const dx = s[0] - p.x, dy = s[1] - p.y, d = Math.hypot(dx, dy);
  p.rushNX = d > 0 ? dx / d : 0; p.rushNY = d > 0 ? dy / d : 1;
  p.rushT = Math.max(0.12, d / BREACH_SPD);
  p.underT = p.rushT;
  p.invuln = Math.max(p.invuln, p.rushT + 0.05);
  p.dash = 'breach';
  p.sliding = false;
  p.reelX = Math.round(s[0]); p.reelY = Math.round(s[1]);
  faceToward(p, dx, dy, true);
  burst(p.x, p.y + 4, '#f4f7ff', 14, 60, 0.5, true);
  sfxAt('dodge', p.x, p.y);
}
HERO_DASH.breach = { spd: BREACH_SPD, t: BREACH_RANGE / BREACH_SPD, ramp: 0.001, through: true, step: (p, mv, dt) => breachStep(p, mv, dt), pose: () => ({ dx: 0, dy: 2, rot: 0 }) };
function breachStep(p, mv, dt) {
  p.underT = p.rushT;
  p.invuln = Math.max(p.invuln, p.rushT + 0.05);
  p.rushFxT = (p.rushFxT || 0) - dt;
  if (p.rushFxT <= 0) { p.rushFxT = 0.05; burst(p.x, p.y + 4, '#eef4fb', 2, 25, 0.4, true); }
  if (Math.hypot(p.reelX - p.x, p.reelY - p.y) <= 4 || mv.blockedX || mv.blockedY || p.rushT <= 0) breachUp(p);
}
// she comes up: everyone over the spot is thrown up; on ice it breaks under them
function breachUp(p) {
  p.rushT = 0; p.dash = ''; p.underT = 0; p.invuln = 0;
  p.vx = p.vy = 0;
  const dmg = abDmg(p, 'breach', abRk(p, 'breach', 'dmg')), up = abRk(p, 'breach', 'up');
  for (const q of unitsHit(p, p.x, p.y, BREACH_R)) {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    hurtUnit(q, dmg, (q.x - p.x) / d, (q.y - p.y) / d, p, { kb: 40, ab: 'breach' });
    if (!q.dead) knockUp(q, up, p);
  }
  for (const s of structsNear(p, p.x, p.y, BREACH_R)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x, p.y, BREACH_R, dmg);
  const broke = iceBreak(p.x, p.y + 4, 'breach', Math.atan2(p.rushNY, p.rushNX), { warn: 0.1, hold: BREACH_HOLD });
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: BREACH_R, t: 0, col: broke ? '#7cc4e8' : '#f4f7ff' });
  burst(p.x, p.y - 4, '#f4f7ff', 24, 85, 0.6, true);
  burst(p.x, p.y - 4, broke ? '#3a6080' : '#cfd8e8', 12, 60, 0.6, true);
  sfxAt(broke ? 'splash' : 'break_', p.x, p.y);
}

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------------
HERO_PASSIVE.coldwater = { deal: coldDeal, tick: coldTick, out: coldOut,
  name: 'COLD WATER', blurb: 'ON ICE AND BY OPEN WATER YOU MOVE FASTER AND YOUR STRIKES SLOW. IT LASTS A FEW SECONDS AFTER YOU LEAVE. YOU SWIM WHERE OTHERS GO IN.', icon: MARIS_ICON32.cold, mark: 'speed' };
HERO_MOVE.push(coldMove);
HERO_SWIM.push(coldSwim);
