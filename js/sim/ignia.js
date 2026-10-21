'use strict';
// IGNIA, THE FIREMAGE - a named hero (CLASSES, js/sim/player.js) and the first
// mage: she burns a fight down. Her keys light rivals; a burning rival who
// stands by another passes the flame on; deep snow and water put it out.
// Loaded before abilities.js, whose CLASS_AB takes IGNIA_AB as her row of keys;
// she registers into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// Every fire here is the shared burn (igniteUnit, js/sim/actions.js): she only
// says who lit it (`kindleBy`) and whether the wildfire lets it ignore the snow.
// ------------------------------------------------------------ ignia

// ---- tuning --------------------------------------------------------------
// KINDLING (the passive): a rival burning on her fire passes it to the rival
// bodies around it, for what is left of its own clock (so a crowd burns as
// long as the first light, never longer); deep snow and water put her fire out
const SPREAD_R = 22;            // px from a burning body that the flame reaches
const SPREAD_EVERY = 15;        // sim steps between the passes a burning body makes (a quarter second)
const IGNIA_BURN_AP = 0.06;     // what a burn's rate gains per point of ABILITY POWER...
const IGNIA_BURN_AD = 0.15;     // ...and per point of her DAMAGE (the stat items give today)
// Q FIREBRAND: a burning stick thrown down the aim; the first rival takes it
const BRAND_SPD = 300;          // px/s
const BRAND_RANGE = 150;        // px of flight
const BRAND_BURN_T = 3;         // s the stick leaves its rival burning
// W BRUSHFIRE: a line of fire laid across the aim, at the aim
const BRUSH_RANGE = 120;        // px from her the line's middle may be set
const BRUSH_LEN = 56;           // px of fire, across the aim
const BRUSH_HALF = 5;           // px either side of the line a body touches it
const BRUSH_BURN_T = 2.5;       // s a touch keeps a rival burning
const BRUSH_MELT = 3;           // s the melted strip lingers after the fire is gone (drawn only)
// E WARM HANDS: her next key is cast twice as hot; while it waits she walks faster
const WARM_T = 5;               // s it waits for a key before the warmth goes
const WARM_HOT = 2;             // the next key's burn rate, times this
// R WILDFIRE: a ring at the aim catches fire; for a while after, the flames
// jump further and the snow cannot put them out. Never across the creek.
const WILD_RANGE = 160;         // px from her the ring's middle may be set
const WILD_R = 56;              // px of ring
const WILD_BURN_T = 5;          // s the ring leaves each rival burning
const WILD_JUMP_R = 40;         // px a wildfire flame jumps
const WILD_T = 4;               // s the jumping lasts, and the snow is ignored

const brushfires = []; // {x, y, nx, ny, team, owner, t, life, dps} - the lit lines, stepped by updateBrushfires, each carrying its caster's rank and heat

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
// `burn` in a rank is the fire's rate, hp a second (the hit's own `dmg` lands once).
const IGNIA_AB = [
  {
    id: 'brand', name: 'FIREBRAND', cd: [7, 6.5, 6, 5.5, 5], ap: 0.4, cast: 0.2, aim: { line: BRAND_RANGE },
    rank: { burn: [5, 7, 9, 11, 13], dmg: 10, t: BRAND_BURN_T },
    tip: 'THROW A BRAND. THE FIRST RIVAL BURNS',
    blurb: 'THROW A BURNING STICK DOWN A LINE. THE FIRST RIVAL IT HITS TAKES THE BLOW AND CATCHES FIRE.',
    use: (p) => igniaBrand(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), teleLen(p.x, p.y, Math.cos(a), Math.sin(a), BRAND_RANGE), col, 0.5 + 0.45 * closing, now, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.7 ? -1 : 1, rot: 0 }), // the arm back, then the throw
    icon: IGNIA_ICON32.brand,
    bot: (p, foe, d, clear) => clear && d < BRAND_RANGE - 10,
  },
  {
    id: 'brushfire', name: 'BRUSHFIRE', cd: [12, 11.5, 11, 10.5, 10], ap: 0, cast: 0.3, aim: { line: BRUSH_RANGE },
    rank: { burn: [6, 8, 10, 12, 14], t: 4 }, // t: s the line burns
    tip: 'A LINE OF FIRE. RIVALS WHO CROSS BURN',
    blurb: 'LAY A LINE OF FIRE ACROSS THE GROUND FOR A FEW SECONDS. RIVALS WHO CROSS IT BURN. IT MELTS THE SNOW UNDER IT.',
    use: (p) => igniaBrushfire(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = brushAt(p); drawBrushTele(c.x - ex, c.y - ey, c.nx, c.ny, col, 0.5 + 0.45 * closing); },
    pose: () => ({ dx: 0, dy: 1, rot: 0 }), // the staff swept low
    icon: IGNIA_ICON32.brushfire,
    bot: (p, foe, d) => d < BRUSH_RANGE && (foe instanceof Player || unitsNear(p, foe.x, foe.y, 40).length >= 3),
  },
  {
    id: 'warm', name: 'WARM HANDS', cd: [14, 13, 12, 11, 10], cast: 0.05,
    rank: { walk: [1.15, 1.2, 1.25, 1.3, 1.35], hot: WARM_HOT, t: WARM_T }, // walk: her walk while it waits; hot: the next key's burn
    tip: 'NEXT KEY BURNS TWICE AS HOT',
    blurb: 'YOUR NEXT ABILITY IS CAST TWICE AS HOT. WHILE IT IS READY, YOU WALK FASTER.',
    use: (p) => igniaWarm(p),
    acol: '#ff9a3a', activeF: (p) => (p.warmT > 0 ? p.warmT / WARM_T : 0),
    icon: IGNIA_ICON32.warm,
    bot: (p, foe, d) => d < WILD_RANGE && (abReady(p, 0) || abReady(p, 3)),
  },
  {
    id: 'wildfire', name: 'WILDFIRE', cd: [90, 75, 60], ap: 0.5, cast: 0.5, aim: { ring: WILD_RANGE },
    rank: { burn: [16, 24, 32], dmg: [20, 35, 50], t: WILD_T }, // dmg: the ring's blow; t: s the flames jump
    tip: 'A RING CATCHES FIRE. FLAMES JUMP',
    blurb: 'A LARGE RING AROUND A SPOT CATCHES FIRE. EVERY RIVAL INSIDE BURNS HARD, AND THE FLAMES JUMP BETWEEN RIVALS FOR A FEW SECONDS, SNOW OR NOT. IT CANNOT CROSS THE CREEK.',
    use: (p) => igniaWildfire(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = wildAt(p); drawRing(Math.round(c.x - ex), Math.round(c.y - ey), WILD_R, col, 0.45 + 0.45 * closing, closing * 0.5); },
    pose: () => ({ dx: 0, dy: -2, rot: 0 }), // the staff raised
    icon: IGNIA_ICON32.wildfire,
    bot: (p, foe, d) => foe instanceof Player && d < WILD_RANGE && (unitsNear(p, foe.x, foe.y, WILD_R).filter((q) => q instanceof Player).length >= 2 || foe.hp < foe.maxHp * 0.6),
  },
];

// ---- the fire she lights -------------------------------------------------------
// The one way her keys set a body burning: the shared burn, at the key's rate
// (and her ABILITY POWER's share), marked as hers so KINDLING carries it on.
// `wild`: the wildfire's flame, which jumps further and ignores the snow.
function igniaBurnRate(p, base, hot) { return (base + statOf(p, 'ap') * IGNIA_BURN_AP + statOf(p, 'dmg') * IGNIA_BURN_AD) * (hot || 1); }
function igniaLight(p, e, t, dps, wild) {
  if (!unitAlive(e)) return;
  igniteUnit(e, t, dps, p);
  e.kindleBy = p.id;
  if (wild) e.wildT = Math.max(e.wildT || 0, wild);
}
// a blow carrying her fire (hurtUnit's `burn`, lit after it lands) is hers to
// carry on (HERO_PASSIVE deal, before the blow lands)
function igniaDeal(p, e, dmg, o) {
  if (o.burn) { e.kindleBy = p.id; if (o.burn[2] > 0) e.wildT = Math.max(e.wildT || 0, o.burn[2]); }
  return dmg;
}
// E's heat, spent by the key that reads it: WARM_HOT once, then 1
function igniaHeat(p) {
  if (!(p.warmT > 0)) return 1;
  p.warmT = 0;
  burst(p.x, p.y - 10, '#ffd95c', 10, 50, 0.45, true);
  return abRk(p, 'warm', 'hot');
}
// is there open water between two points (the creek, an ice hole): the wildfire
// never crosses it. Walked in steps a quarter tile long.
function waterBetween(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / (TILE / 4));
  for (let k = 0; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / Math.max(1, n), y = y0 + (y1 - y0) * k / Math.max(1, n);
    if (waterAt(Math.floor(x / TILE), Math.floor(y / TILE))) return true;
  }
  return false;
}
// what puts her fire out where a body stands: water always, deep snow unless
// the wildfire burns in it or a brushfire has melted the snow there
function igniaDoused(e) {
  const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
  if (waterAt(tx, ty)) return true;
  if (e.wildT > 0 || !deepAt(e.x, e.y)) return false;
  return !brushfires.some((b) => brushTouch(b, e.x, e.y, BRUSH_HALF + 4));
}

// ---- KINDLING ------------------------------------------------------------------
// Every burning body on her fire, every few steps: put out where it stands in
// the wet, else passing the flame to the rivals it stands by. Called once a
// step (HERO_TICK), for every body in the world: soldiers and beasts burn too.
function updateKindling(dt) {
  const bodies = [players, animals, robots];
  for (const L of bodies) for (const e of L) if (e.wildT > 0) e.wildT = Math.max(0, e.wildT - dt);
  if (state.tick % SPREAD_EVERY) return; // the passes ride the match's own step count: nothing to save
  for (const L of bodies) for (const e of L) {
    if (!(e.burnT > 0) || e.kindleBy == null || e.kindleBy < 0 || e.burnBy !== e.kindleBy || !unitAlive(e)) continue;
    if (igniaDoused(e)) { douseUnit(e); e.kindleBy = -1; e.wildT = 0; burst(e.x, unitMidY(e), '#eef4fb', 6, 35, 0.4, true); sfxAt('splash', e.x, e.y); continue; }
    const p = players[e.kindleBy];
    if (!p || CLASSES[p.cls].passive !== 'kindling') { e.kindleBy = -1; continue; }
    const wild = e.wildT > 0;
    for (const q of unitsNear(p, e.x, e.y, wild ? WILD_JUMP_R : SPREAD_R)) {
      if (q === e || unitTeam(q) === p.team || q.burnT > 0) continue; // a body already alight is not lit twice
      if (wild ? waterBetween(e.x, e.y, q.x, q.y) : igniaDoused(q)) continue;
      igniaLight(p, q, e.burnT, e.burnDps, wild ? e.wildT : 0);
      if (wild) abFx.push({ kind: 'line', x: e.x, y: unitMidY(e), a: Math.atan2(q.y - e.y, q.x - e.x), r: Math.hypot(q.x - e.x, q.y - e.y), half: 2, t: 0, col: '#ff9a3a' });
    }
  }
}

// ---- Q FIREBRAND ----------------------------------------------------------------
// The stick rides the shots in flight (arrows, js/sim/sim.js) and lands its
// blow there with its own fire (hurtUnit's `burn`), at the rank and heat it
// was thrown with.
function igniaBrand(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y);
  const a = Math.atan2(dy, dx);
  const hot = igniaHeat(p);
  arrows.push({
    x: p.x, y: p.y - BOW_Y,
    vx: Math.cos(a) * BRAND_SPD, vy: Math.sin(a) * BRAND_SPD,
    t: 0, life: BRAND_RANGE / BRAND_SPD, dmg: abDmg(p, 'brand', abRk(p, 'brand', 'dmg')), pow: 1,
    owner: p.id, team: p.team, ambush: false, trailD: 0,
    solid: true, kb: 0.6, col: '#ff9a3a', ab: 'brand',
    burn: [abRk(p, 'brand', 't'), igniaBurnRate(p, abRk(p, 'brand', 'burn'), hot), 0], // [s, hp/s, wild s]: lit as the blow lands
    look: 'brand', // drawn as the burning stick (HERO_SHOTS, js/draw/ignia.js)
    ang: a, spd: BRAND_SPD, ox: p.x, oy: p.y - BOW_Y,
  });
  burst(p.x + Math.cos(a) * 7, p.y - BOW_Y + Math.sin(a) * 7, '#ff9a3a', 6, 45, 0.3, true);
  sfxAt('arrow', p.x, p.y);
}

// ---- W BRUSHFIRE ----------------------------------------------------------------
// where the line would go now: its middle at the aim (held to BRUSH_RANGE),
// lying across the aim's bearing
function brushAt(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const r = Math.min(d, BRUSH_RANGE);
  return { x: p.x + dx / d * r, y: p.y + dy / d * r, nx: -dy / d, ny: dx / d };
}
// is a point within `half` px of a line's fire
function brushTouch(b, x, y, half) {
  const ux = x - b.x, uy = y - b.y, s = ux * b.nx + uy * b.ny;
  if (Math.abs(s) > BRUSH_LEN / 2 + half) return false;
  return Math.abs(ux * -b.ny + uy * b.nx) <= half && b.t < b.life;
}
function igniaBrushfire(p) {
  const c = brushAt(p);
  const hot = igniaHeat(p);
  brushfires.push({ x: c.x, y: c.y, nx: c.nx, ny: c.ny, team: p.team, owner: p.id, t: 0,
    life: abRk(p, 'brushfire', 't'), dps: igniaBurnRate(p, abRk(p, 'brushfire', 'burn'), hot) });
  burst(c.x, c.y, '#ff9a3a', 14, 50, 0.5, true);
  sfxAt('place', c.x, c.y);
}
// The lines' clocks and their touch: every rival body on the fire is lit
// (refreshed while it stands there). A line lingers BRUSH_MELT s as a melted
// strip after its fire is out (drawn only).
function updateBrushfires(dt) {
  for (let i = brushfires.length - 1; i >= 0; i--) {
    const b = brushfires[i];
    b.t += dt;
    if (b.t >= b.life + BRUSH_MELT) { brushfires.splice(i, 1); continue; }
    if (b.t >= b.life) continue;
    const src = sideOf(b), p = players[b.owner];
    for (const q of unitsNear(src, b.x, b.y, BRUSH_LEN / 2 + BRUSH_HALF + PLAYER_R)) {
      if (unitTeam(q) === b.team || !brushTouch(b, q.x, q.y, BRUSH_HALF + 2)) continue;
      if (p && p.team === b.team) igniaLight(p, q, BRUSH_BURN_T, b.dps, 0);
      else igniteUnit(q, BRUSH_BURN_T, b.dps, null);
    }
  }
}

// ---- E WARM HANDS ----------------------------------------------------------------
function igniaWarm(p) {
  p.warmT = abRk(p, 'warm', 't');
  burst(p.x, p.y - 6, '#ff9a3a', 10, 40, 0.45, true);
  sfxAt('pickup', p.x, p.y);
}
// her walk while the warmth waits (HERO_MOVE)
function igniaMoveMul(p) { return p.warmT > 0 && CLASSES[p.cls].passive === 'kindling' ? abRk(p, 'warm', 'walk') : 1; }

// ---- R WILDFIRE -------------------------------------------------------------------
function wildAt(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const r = Math.min(d, WILD_RANGE);
  return { x: p.x + dx / d * r, y: p.y + dy / d * r };
}
function igniaWildfire(p) {
  const c = wildAt(p);
  const hot = igniaHeat(p);
  const dps = igniaBurnRate(p, abRk(p, 'wildfire', 'burn'), hot), dmg = abDmg(p, 'wildfire', abRk(p, 'wildfire', 'dmg'));
  for (const q of unitsHit(p, c.x, c.y, WILD_R)) {
    if (waterBetween(c.x, c.y, q.x, q.y)) continue; // the creek holds it
    const d = Math.hypot(q.x - c.x, q.y - c.y) || 1;
    hurtUnit(q, dmg, (q.x - c.x) / d, (q.y - c.y) / d, p, { kb: 20 });
    igniaLight(p, q, WILD_BURN_T, dps, abRk(p, 'wildfire', 't'));
  }
  for (const s of structsNear(p, c.x, c.y, WILD_R)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(c.x, c.y, WILD_R, dmg);
  abFx.push({ kind: 'ring', x: c.x, y: c.y, r: WILD_R, t: 0, col: '#ff9a3a' });
  burst(c.x, c.y, '#ff9a3a', 24, 80, 0.6, true);
  burst(c.x, c.y, '#ffd95c', 12, 60, 0.5, true);
  shakeFor(p, 4);
  sfxAt('break_', c.x, c.y);
}

// her clocks, one sim step (HERO_PASSIVE tick)
function igniaTick(p, dt) { if (p.warmT > 0) p.warmT = Math.max(0, p.warmT - dt); }
function igniaOut(p) { p.warmT = 0; }
function igniaWorld(dt) { updateBrushfires(dt); updateKindling(dt); }

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.kindling = { deal: igniaDeal, tick: igniaTick, out: igniaOut,
  name: 'KINDLING', blurb: 'YOUR ABILITIES SET RIVALS BURNING. A BURNING RIVAL PASSES THE FLAME TO RIVALS NEAR THEM. DEEP SNOW AND WATER PUT IT OUT.', icon: IGNIA_ICON32.kindling };
HERO_MOVE.push(igniaMoveMul);
HERO_TICK.push(igniaWorld);
