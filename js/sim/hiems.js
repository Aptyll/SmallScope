'use strict';
// HIEMS, THE LONG WINTER - a named hero (CLASSES, js/sim/player.js) and the
// control mage: she slowly freezes a fight. Every blow she lands chills a
// rival; the third chill in a few seconds freezes them in place. She lays
// clear ice her rivals slide on, snaps the chilled into roots, and walks in a
// whiteout that blinds whoever is caught in it. Her cold is the weather's own:
// she kept the court's weather records and knows the winter better than anyone.
// Loaded before abilities.js, whose CLASS_AB takes HIEMS_AB as her row of keys;
// she registers into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ hiems

// ---- tuning --------------------------------------------------------------
// DEEP CHILL (the passive): each of her blows (keys and staff) chills a rival
// body; chills stack inside a window, each slowing more; the third freezes
// the body in place, and a body just frozen cannot be frozen again for a while
// (its chills stop at two until then)
const CHILL_WINDOW = 3.5;       // s a chill holds; a fresh chill refreshes it
const CHILL_SLOW = [0.85, 0.7]; // walk x this at one chill, at two
const CHILL_FREEZE = 3;         // chills that freeze
const FREEZE_T = 1;             // s frozen (a stun: tenacity cuts it)
const FREEZE_IMMUNE = 6;        // s after a freeze before the next one can land
// Q ICICLE: a shard of ice down the aim; the first rival takes it and is slowed
const ICICLE_SPD = 320;         // px/s
const ICICLE_RANGE = 170;       // px of flight
const ICICLE_SLOW = 0.7;        // walk x this...
const ICICLE_SLOW_T = 1.5;      // ...for this long
// W CLEAR ICE: a disc of ground glazed to ice at the aim; rival heroes on it
// skate (the creek ice's own slide and slow turn), everything of the other
// side on it is slowed a little; her own side walks it as snow
const GLAZE_RANGE = 140;        // px from her the disc's middle may be set
const GLAZE_R = 30;             // px of disc
const GLAZE_SLOW = 0.8;         // walk x this on it (refreshed while they stand there)
const GLAZE_FADE = 0.6;         // s the glaze takes to melt back to snow after its time (drawn only)
// E COLD SNAP: a burst at the aim: every rival already chilled is rooted, then
// every rival inside takes the blow (which chills them)
const SNAP_RANGE = 130;         // px from her the burst's middle may be set
const SNAP_R = 34;              // px of burst
const SNAP_ROOT = 1;            // s a chilled rival is rooted
// R WHITEOUT: a blizzard that follows her: rivals inside are slowed, chilled
// and stung once a second, and a rival hero inside sees only WHITE_SEE of their reach
// round themselves (their side's other eyes still see; HERO_SIGHT, js/sim/heroes.js)
const WHITE_R = 72;             // px of storm round her
const WHITE_T = 5;              // s it lasts
const WHITE_EVERY = 1;          // s between its stings
const WHITE_SLOW = 0.75;        // walk x this inside
const WHITE_SEE = 0.2;          // a blinded hero sees this share of their reach (32 px)

const hiemsGlazes = []; // {x, y, team, owner, t, life} - W's discs of ice
const hiemsStorms = []; // {x, y, team, owner, t, life, tick, dmg} - R's blizzards, each riding its caster (each carries its rank from the cast)

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const HIEMS_AB = [
  {
    id: 'icicle', name: 'ICICLE', cd: [8, 7.5, 7, 6.5, 6], ap: 0.55, cast: 0.2, aim: { line: ICICLE_RANGE },
    rank: { dmg: [20, 25, 30, 35, 40] },
    tip: 'AN ICE SHARD. SLOWS AND CHILLS',
    blurb: 'A SHARD OF ICE FLIES DOWN A LINE. THE FIRST RIVAL IT HITS IS HURT, SLOWED AND CHILLED.',
    use: (p) => hiemsIcicle(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), teleLen(p.x, p.y, Math.cos(a), Math.sin(a), ICICLE_RANGE), col, 0.5 + 0.45 * closing, now, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.7 ? -1 : 1, rot: 0 }),
    icon: HIEMS_ICON32.icicle,
    bot: (p, foe, d, clear) => clear && d < ICICLE_RANGE - 10,
  },
  {
    id: 'glaze', name: 'CLEAR ICE', cd: [15, 14, 13, 12, 11], cast: 0.25, aim: { ring: GLAZE_RANGE },
    rank: { t: [3, 3.5, 4, 4.5, 5] }, // t: s the ice holds
    tip: 'GLAZE THE GROUND. RIVALS SLIDE ON IT',
    blurb: 'TURN A PATCH OF GROUND TO CLEAR ICE. RIVALS ON IT SLIDE AND TURN SLOWLY. YOUR OWN SIDE WALKS IT AS SNOW.',
    use: (p) => hiemsGlaze(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = hiemsSpot(p, GLAZE_RANGE); drawRing(Math.round(c.x - ex), Math.round(c.y - ey), GLAZE_R, col, 0.45 + 0.45 * closing, closing * 0.4); },
    pose: () => ({ dx: 0, dy: 1, rot: 0 }), // the staff swept low
    icon: HIEMS_ICON32.glaze,
    bot: (p, foe, d) => d < GLAZE_RANGE && foe instanceof Player,
  },
  {
    id: 'snap', name: 'COLD SNAP', cd: [12, 11.5, 11, 10.5, 10], ap: 0.45, cast: 0.3, aim: { ring: SNAP_RANGE },
    rank: { dmg: [18, 24, 30, 36, 42], root: SNAP_ROOT },
    tip: 'A BURST. ROOTS EVERY CHILLED RIVAL',
    blurb: 'A BURST OF COLD AROUND A SPOT. EVERY CHILLED RIVAL INSIDE IS ROOTED, AND EVERY RIVAL INSIDE IS HURT AND CHILLED.',
    use: (p) => hiemsSnap(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = hiemsSpot(p, SNAP_RANGE); drawRing(Math.round(c.x - ex), Math.round(c.y - ey), SNAP_R, col, 0.45 + 0.45 * closing, closing * 0.5); },
    pose: () => ({ dx: 0, dy: -2, rot: 0 }), // the staff raised
    icon: HIEMS_ICON32.snap,
    bot: (p, foe, d) => d < SNAP_RANGE && (foe.chillN > 0 || unitsNear(p, foe.x, foe.y, SNAP_R).length >= 3),
  },
  {
    id: 'whiteout', name: 'WHITEOUT', cd: [100, 85, 70], ap: 0.25, cast: 0.4,
    rank: { dmg: [10, 16, 22] }, // dmg: each sting
    tip: 'A BLIZZARD. RIVALS IN IT ARE BLINDED',
    blurb: 'A BLIZZARD FOLLOWS YOU FOR A FEW SECONDS. RIVALS INSIDE SEE ALMOST NOTHING BEYOND THEMSELVES, ARE SLOWED, AND ARE STUNG AND CHILLED EVERY SECOND.',
    use: (p) => hiemsWhiteout(p),
    tele: (p, px, py, a, col, closing) => drawRing(px, py, WHITE_R, col, 0.4 + 0.45 * closing, closing * 0.3),
    pose: () => ({ dx: 0, dy: -2, rot: 0 }),
    icon: HIEMS_ICON32.whiteout,
    bot: (p, foe, d) => foe instanceof Player && d < WHITE_R && (unitsNear(p, p.x, p.y, WHITE_R).filter((q) => q instanceof Player).length >= 2 || foe.hp < foe.maxHp * 0.6),
  },
];

// ---- DEEP CHILL -----------------------------------------------------------------
// The one way she chills a body: a stack (refreshing the window) and its slow;
// the third freezes it unless a freeze is still wearing off. `src` is her (or
// null for a storm whose caster has left the side).
function hiemsChill(e, src) {
  if (!unitAlive(e)) return;
  e.chillT = CHILL_WINDOW;
  if (e.chillImm > 0) e.chillN = Math.min(CHILL_FREEZE - 1, (e.chillN || 0) + 1);
  else e.chillN = (e.chillN || 0) + 1;
  if (e.chillN >= CHILL_FREEZE) {
    e.chillN = 0; e.chillT = 0;
    e.chillImm = FREEZE_IMMUNE;
    stunUnit(e, FREEZE_T, src);
    e.frozeT = e.stunT || 0; // the ice drawn round it, as long as the freeze holds (tenacity cut it)
    burst(e.x, unitMidY(e), '#e6f8ff', 12, 50, 0.45, true);
    sfxAt('break_', e.x, e.y);
    return;
  }
  slowUnit(e, CHILL_WINDOW, CHILL_SLOW[e.chillN - 1]);
  burst(e.x, unitMidY(e), '#a8dcf0', 5, 30, 0.35, true);
}
// every blow of hers that lands chills it: her keys and her staff, never a
// burn's bite or an item's (HERO_PASSIVE deal, before the blow lands)
function hiemsDeal(p, e, dmg, o) {
  if (!(o.basic || (o.ab && HIEMS_AB.some((ab) => ab.id === o.ab)))) return dmg;
  if (o.ab === 'icicle') slowUnit(e, ICICLE_SLOW_T, ICICLE_SLOW);
  hiemsChill(e, p);
  return dmg;
}
// the chill clocks on every body in the world, one sim step
function updateChill(dt) {
  for (const L of [players, animals, robots]) for (const e of L) {
    if (e.chillT > 0) { e.chillT = Math.max(0, e.chillT - dt); if (e.chillT <= 0) e.chillN = 0; }
    if (e.chillImm > 0) e.chillImm = Math.max(0, e.chillImm - dt);
    if (e.frozeT > 0) e.frozeT = Math.max(0, Math.min(e.frozeT - dt, e.stunT || 0)); // a cleanse or a death thaws it
  }
}

// the spot at her aim, no further than `range`
function hiemsSpot(p, range) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const r = Math.min(d, range);
  return { x: p.x + dx / d * r, y: p.y + dy / d * r };
}
// the caster of something she left in the world, while it is still hers to credit
function hiemsSrc(w) { const o = players[w.owner]; return o && o.team === w.team ? o : null; }

// ---- Q ICICLE --------------------------------------------------------------------
// The shard rides the shots in flight (arrows, js/sim/sim.js) and lands its
// blow there; DEEP CHILL slows and chills on the blow (hiemsDeal).
function hiemsIcicle(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y);
  const a = Math.atan2(dy, dx);
  arrows.push({
    x: p.x, y: p.y - BOW_Y,
    vx: Math.cos(a) * ICICLE_SPD, vy: Math.sin(a) * ICICLE_SPD,
    t: 0, life: ICICLE_RANGE / ICICLE_SPD, dmg: abDmg(p, 'icicle', abRk(p, 'icicle', 'dmg')), pow: 1,
    owner: p.id, team: p.team, trailD: 0,
    solid: true, kb: 0.5, col: '#a8dcf0', ab: 'icicle',
    look: 'icicle', // drawn as the shard (HERO_SHOTS, js/draw/hiems.js)
    ang: a, spd: ICICLE_SPD, ox: p.x, oy: p.y - BOW_Y,
  });
  burst(p.x + Math.cos(a) * 7, p.y - BOW_Y + Math.sin(a) * 7, '#e6f8ff', 6, 45, 0.3, true);
  sfxAt('arrow', p.x, p.y);
}

// ---- W CLEAR ICE -------------------------------------------------------------------
function hiemsGlaze(p) {
  const c = hiemsSpot(p, GLAZE_RANGE);
  hiemsGlazes.push({ x: c.x, y: c.y, team: p.team, owner: p.id, t: 0, life: abRk(p, 'glaze', 't') });
  burst(c.x, c.y, '#e6f8ff', 16, 50, 0.5, true);
  sfxAt('place', c.x, c.y);
}
// is a body standing on a rival's clear ice (by its feet)
function onRivalGlaze(e) {
  const t = unitTeam(e);
  for (const g of hiemsGlazes) if (g.t < g.life && g.team !== t && Math.hypot(e.x - g.x, e.y + 4 - g.y) <= GLAZE_R) return true;
  return false;
}
// a hero on a rival's clear ice skates as on the creek's (HERO_ICE, js/sim/heroes.js)
function hiemsIceUnder(p) { return hiemsGlazes.length > 0 && onRivalGlaze(p); }
function updateGlazes(dt) {
  for (let i = hiemsGlazes.length - 1; i >= 0; i--) {
    const g = hiemsGlazes[i];
    g.t += dt;
    if (g.t >= g.life + GLAZE_FADE) { hiemsGlazes.splice(i, 1); continue; }
    if (g.t >= g.life) continue;
    for (const q of unitsNear(sideOf(g), g.x, g.y - 4, GLAZE_R + 2)) {
      if (unitTeam(q) === g.team || !onRivalGlaze(q)) continue;
      slowUnit(q, 0.2, GLAZE_SLOW);
    }
  }
}

// ---- E COLD SNAP --------------------------------------------------------------------
function hiemsSnap(p) {
  const c = hiemsSpot(p, SNAP_RANGE);
  const dmg = abDmg(p, 'snap', abRk(p, 'snap', 'dmg')), root = abRk(p, 'snap', 'root');
  for (const q of unitsHit(p, c.x, c.y, SNAP_R)) {
    if (q.chillN > 0) { rootUnit(q, root, p); burst(q.x, q.y, '#e6f8ff', 8, 35, 0.4, true); } // the chilled first, before the blow chills the rest
    const d = Math.hypot(q.x - c.x, q.y - c.y) || 1;
    hurtUnit(q, dmg, (q.x - c.x) / d, (q.y - c.y) / d, p, { kb: 10 });
  }
  for (const s of structsNear(p, c.x, c.y, SNAP_R)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(c.x, c.y, SNAP_R, dmg);
  abFx.push({ kind: 'ring', x: c.x, y: c.y, r: SNAP_R, t: 0, col: '#e6f8ff' });
  burst(c.x, c.y, '#e6f8ff', 20, 70, 0.5, true);
  burst(c.x, c.y, '#7cc4e8', 10, 50, 0.45, true);
  sfxAt('break_', c.x, c.y);
}

// ---- R WHITEOUT ------------------------------------------------------------------------
function hiemsWhiteout(p) {
  hiemsStorms.push({ x: p.x, y: p.y, team: p.team, owner: p.id, t: 0, life: WHITE_T, tick: 0,
    dmg: abDmg(p, 'whiteout', abRk(p, 'whiteout', 'dmg')) });
  burst(p.x, p.y - 8, '#ffffff', 24, 80, 0.6, true);
  sfxAt('pickup', p.x, p.y);
}
// is a body inside a rival's whiteout
function inRivalStorm(e) {
  const t = unitTeam(e);
  for (const s of hiemsStorms) if (s.team !== t && Math.hypot(e.x - s.x, e.y - s.y) <= WHITE_R) return true;
  return false;
}
// how far a hero sees inside a rival's whiteout, as a share (HERO_SIGHT, js/sim/heroes.js)
function hiemsSight(p) { return hiemsStorms.length > 0 && inRivalStorm(p) ? WHITE_SEE : 1; }
function updateStorms(dt) {
  for (let i = hiemsStorms.length - 1; i >= 0; i--) {
    const s = hiemsStorms[i], src = hiemsSrc(s);
    s.t += dt;
    if (s.t >= s.life || !src || src.dead) { hiemsStorms.splice(i, 1); continue; }
    s.x = src.x; s.y = src.y; // it rides her
    const sting = (s.tick -= dt) <= 0;
    if (sting) s.tick += WHITE_EVERY;
    for (const q of unitsNear(src, s.x, s.y, WHITE_R)) {
      slowUnit(q, 0.2, WHITE_SLOW);
      if (!sting || q.invuln > 0) continue;
      const d = Math.hypot(q.x - s.x, q.y - s.y) || 1;
      hurtUnit(q, s.dmg, (q.x - s.x) / d, (q.y - s.y) / d, src, { kb: 0, ab: 'whiteout' }); // chills through hiemsDeal
    }
    if (sting) for (const st of structsNear(src, s.x, s.y, WHITE_R)) hurtStruct(st, s.dmg, src);
    if (sting && PRACTICE) abHitDummies(s.x, s.y, WHITE_R, s.dmg);
  }
}

// what she leaves in the world, one sim step (HERO_TICK)
function updateHiemsWorld(dt) { updateChill(dt); updateGlazes(dt); updateStorms(dt); }

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.deepchill = { deal: hiemsDeal,
  name: 'DEEP CHILL', blurb: 'YOUR HITS CHILL RIVALS. A THIRD CHILL WITHIN A FEW SECONDS FREEZES THEM IN PLACE FOR A MOMENT. THEN THEY CANNOT BE FROZEN AGAIN FOR A WHILE.',
  icon: HIEMS_ICON32.deepchill };
HERO_TICK.push(updateHiemsWorld);
HERO_ICE.push(hiemsIceUnder);
HERO_SIGHT.push(hiemsSight);
