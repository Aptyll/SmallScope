'use strict';
// FABER, THE TINKER - a named hero (CLASSES, js/sim/player.js) and the zone
// mage: he holds a spot with machines he winds himself. A spark that jumps to a
// second rival, small machines that shoot whoever comes near, a clockspring
// trap that roots a hero who steps on it, and the old engine: a big machine
// that walks where he points and slams the ground. He kept the empire's water
// clocks; every machine here is clockwork somebody built, mended and wound.
// His machines are bodies in `robots` (HERO_MACHINE, js/sim/heroes.js), so every
// weapon, tower and soldier already meets them. Loaded before abilities.js,
// whose CLASS_AB takes FABER_AB as his row of keys; draws no rng().
// ------------------------------------------------------------ faber

// ---- tuning --------------------------------------------------------------
// SPARE PARTS (the passive): a machine of the works scrapped near him (a
// soldier of either side, or a machine of his or a rival's) leaves a spare
// part on the snow; walking over it takes PART_CUT off each of his keys' waits
const PART_NEAR = 180;          // px from him a wreck must fall to leave a part
const PART_LIFE = 8;            // s a part lies before the snow has it
const PART_GRAB = 12;           // px from his feet he picks one up
const PART_CUT = 1;             // s off each of keys 1-3's waits
const PART_MAX = 6;             // parts of his lying at once (the oldest goes first)
// Q SPARK: a spark down the aim; the first rival takes it, and it jumps to the
// nearest other rival near them for a share of the blow
const SPARK_SPD = 300;          // px/s
const SPARK_RANGE = 165;        // px of flight
const ARC_R = 70;               // px from the first rival the jump reaches
const ARC_SHARE = 0.6;          // of the blow the jump lands
const ARC_SHOW = 0.15;          // s the jump is drawn
// W WIND A MACHINE: a small clockwork gun set down at the aim; it shoots the
// nearest rival in reach until it runs down or is scrapped. Two at once
const WINDER_PLACE = 100;       // px from him it may be set
const WINDER_RANGE = 115;       // px it shoots
const WINDER_CD = 1.1;          // s between its shots
const WINDER_LIFE = 25;         // s it runs
const WINDER_HP = 70;           // health...
const WINDER_HP_LV = 9;         // ...and this more for each of his levels
const WINDER_MAX = 2;           // his at once (a third winds down the oldest)
const WINDER_BOLT_SPD = 260;    // px/s its bolt flies (it follows its mark: a lob, not a dodgeable shot)
// E CLOCKSPRING: a trap set at the aim; once wound, the first rival hero to
// step on it is rooted and hurt
const SPRING_RANGE = 110;       // px from him it may be set
const SPRING_R = 11;            // px round it that springs it
const SPRING_ARM = 0.6;         // s it takes to wind
const SPRING_LIFE = 30;         // s it waits
const SPRING_MAX = 3;           // his at once
// R THE OLD ENGINE: a big machine wound up beside him; it walks to where he
// points, slams the ground to stun rivals round it, and while it runs his
// small machines shoot twice as fast
const ENGINE_LIFE = 9;          // s it runs
const ENGINE_HP = 260;          // health...
const ENGINE_HP_LV = 25;        // ...and this more for each of his levels
const ENGINE_SPD = 46;          // px/s it walks
const ENGINE_LEASH = 190;       // px from him the spot it walks to may be
const ENGINE_SLAM_R = 36;       // px round it a slam reaches
const ENGINE_SLAM_FIRST = 1;    // s before its first slam
const ENGINE_SLAM_EVERY = 2;    // s between slams (only with a rival in reach)
const ENGINE_HASTE = 2;         // his small machines' shots come this much faster while it runs

const faberParts = [];  // {x, y, team, owner, t} - SPARE PARTS lying on the snow
const faberArcs = [];   // {x0, y0, x1, y1, tg, team, owner, dmg, t} - Q's jump, landed the step after the spark
const faberBolts = [];  // {x, y, tg, team, owner, dmg} - the small machines' bolts in flight
const faberSprings = [];// {x, y, team, owner, t, dmg, root} - E's traps

// ---- the keys ---------------------------------------------------------------
// His row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const FABER_AB = [
  {
    id: 'spark', name: 'SPARK', cd: [7, 6.5, 6, 5.5, 5], ap: 0.5, cast: 0.2, aim: { line: SPARK_RANGE },
    rank: { dmg: [16, 24, 32, 40, 48] },
    tip: 'A SPARK THAT JUMPS TO ONE MORE RIVAL',
    blurb: 'A SPARK FLIES DOWN A LINE. THE FIRST RIVAL IT HITS IS HURT, AND IT JUMPS TO THE NEAREST OTHER RIVAL FOR PART OF THE DAMAGE.',
    use: (p) => faberSpark(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), teleLen(p.x, p.y, Math.cos(a), Math.sin(a), SPARK_RANGE), col, 0.5 + 0.45 * closing, now, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.7 ? -1 : 1, rot: 0 }),
    icon: FABER_ICON32.spark,
    bot: (p, foe, d, clear) => clear && d < SPARK_RANGE - 10,
  },
  {
    id: 'winder', name: 'WIND A MACHINE', cd: [14, 13, 12, 11, 10], ap: 0.2, cast: 0.35, aim: { ring: WINDER_PLACE },
    rank: { dmg: [9, 12, 15, 18, 21] }, // dmg: each of its shots
    tip: 'A SMALL GUN THAT SHOOTS NEARBY RIVALS',
    blurb: 'SET DOWN A SMALL CLOCKWORK MACHINE. IT SHOOTS THE NEAREST RIVAL UNTIL IT RUNS DOWN OR IS BROKEN. YOU CAN HAVE TWO AT ONCE.',
    use: (p) => faberWinder(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = faberSpot(p, WINDER_PLACE); drawRing(Math.round(c.x - ex), Math.round(c.y - ey), 6, col, 0.5 + 0.45 * closing, closing * 0.5); drawRing(Math.round(c.x - ex), Math.round(c.y - ey), WINDER_RANGE, col, 0.2 + 0.2 * closing, 0); },
    pose: () => ({ dx: 0, dy: 2, rot: 0 }), // stooped to set it down
    icon: FABER_ICON32.winder,
    bot: (p, foe, d) => d < WINDER_RANGE + 20,
  },
  {
    id: 'spring', name: 'CLOCKSPRING', cd: [16, 15, 14, 13, 12], ap: 0.4, cast: 0.25, aim: { ring: SPRING_RANGE },
    rank: { dmg: 20, root: [1, 1.15, 1.3, 1.45, 1.6] },
    tip: 'A TRAP. THE FIRST RIVAL HERO IS ROOTED',
    blurb: 'SET A CLOCKSPRING TRAP ON THE GROUND. ONCE WOUND, THE FIRST RIVAL HERO TO STEP ON IT IS HELD IN PLACE AND HURT. UP TO THREE WAIT AT ONCE.',
    use: (p) => faberSpring(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = faberSpot(p, SPRING_RANGE); drawRing(Math.round(c.x - ex), Math.round(c.y - ey), SPRING_R, col, 0.5 + 0.45 * closing, closing * 0.5); },
    pose: () => ({ dx: 0, dy: 2, rot: 0 }),
    icon: FABER_ICON32.spring,
    bot: (p, foe, d) => foe instanceof Player && d < SPRING_RANGE,
  },
  {
    id: 'engine', name: 'THE OLD ENGINE', cd: [110, 95, 80], ap: 0.45, cast: 0.5, aim: { ring: ENGINE_LEASH },
    rank: { dmg: [50, 85, 120], stun: 0.75 }, // dmg: each slam
    tip: 'A BIG MACHINE WALKS WHERE YOU POINT',
    blurb: 'WIND UP THE OLD ENGINE FOR A FEW SECONDS. IT WALKS WHERE YOU POINT AND SLAMS THE GROUND, HURTING AND STUNNING RIVALS NEAR IT. YOUR SMALL MACHINES SHOOT TWICE AS FAST WHILE IT RUNS.',
    use: (p) => faberEngine(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = faberSpot(p, ENGINE_LEASH); drawRing(Math.round(c.x - ex), Math.round(c.y - ey), ENGINE_SLAM_R, col, 0.45 + 0.45 * closing, closing * 0.3); },
    pose: () => ({ dx: 0, dy: -2, rot: 0 }), // the staff raised to wind it
    icon: FABER_ICON32.engine,
    bot: (p, foe, d) => foe instanceof Player && d < ENGINE_LEASH - 40 && (unitsNear(p, foe.x, foe.y, 90).filter((q) => q instanceof Player).length >= 2 || foe.hp < foe.maxHp * 0.6),
  },
];

// ---- shared -----------------------------------------------------------------
// the spot at his aim, no further than `range`
function faberSpot(p, range) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const r = Math.min(d, range);
  return { x: p.x + dx / d * r, y: p.y + dy / d * r };
}
// the maker of something he left in the world, while it is still his to credit
function faberSrc(w) { const o = players[w.owner]; return o && o.team === w.team ? o : null; }
// keep only his newest `max` of a list's entries (`L` oldest first): the rest go with `off`
function faberCap(L, owner, max, off) {
  let n = 0;
  for (let i = L.length - 1; i >= 0; i--) if (L[i].owner === owner && !L[i].dead && ++n > max) off(L[i], i);
}

// ---- SPARE PARTS --------------------------------------------------------------
// A wreck (HERO_WRECK, robotDies): the nearest FABER inside PART_NEAR gets a part on the snow
function faberWreck(b) {
  let best = null, bd = PART_NEAR;
  for (const q of players) {
    if (!q.active || q.dead || inAir(q) || CLASSES[q.cls].passive !== 'spareparts') continue;
    const d = Math.hypot(q.x - b.x, q.y - b.y);
    if (d <= bd) { bd = d; best = q; }
  }
  if (!best) return;
  faberParts.push({ x: b.x, y: b.y + 2, team: best.team, owner: best.id, t: 0 });
  faberCap(faberParts, best.id, PART_MAX, (w, i) => faberParts.splice(i, 1));
}
function updateParts(dt) {
  for (let i = faberParts.length - 1; i >= 0; i--) {
    const w = faberParts[i], p = faberSrc(w);
    w.t += dt;
    if (w.t >= PART_LIFE || !p) { faberParts.splice(i, 1); continue; }
    if (p.dead || inAir(p) || Math.hypot(p.x - w.x, p.y - w.y) > PART_GRAB) continue;
    for (let k = 0; k < 3; k++) if (p.abCd[k] > 0) p.abCd[k] = Math.max(0, p.abCd[k] - PART_CUT);
    burst(w.x, w.y - 2, '#f2cc6a', 6, 35, 0.35, true);
    sfxAt('pickup', w.x, w.y);
    faberParts.splice(i, 1);
  }
}

// ---- Q SPARK --------------------------------------------------------------------
// The spark rides the shots in flight (arrows, js/sim/sim.js) and lands its blow
// there; the blow queues its jump (faberDeal), landed the next step.
function faberSpark(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y);
  const a = Math.atan2(dy, dx);
  arrows.push({
    x: p.x, y: p.y - BOW_Y,
    vx: Math.cos(a) * SPARK_SPD, vy: Math.sin(a) * SPARK_SPD,
    t: 0, life: SPARK_RANGE / SPARK_SPD, dmg: abDmg(p, 'spark', abRk(p, 'spark', 'dmg')), pow: 1,
    owner: p.id, team: p.team, trailD: 0,
    solid: true, kb: 0.4, col: '#ffe08a', ab: 'spark',
    look: 'spark', // drawn as the spark (HERO_SHOTS, js/draw/faber.js)
    ang: a, spd: SPARK_SPD, ox: p.x, oy: p.y - BOW_Y,
  });
  burst(p.x + Math.cos(a) * 7, p.y - BOW_Y + Math.sin(a) * 7, '#ffe08a', 6, 45, 0.3, true);
  sfxAt('arrow', p.x, p.y);
}
// his blow about to land (HERO_PASSIVE deal): a spark's first blow picks the nearest
// other rival near the one it struck, and the jump lands on it the next step
function faberDeal(p, e, dmg, o) {
  if (o.ab !== 'spark' || o.arc) return dmg;
  let tg = null, bd = ARC_R;
  for (const q of unitsHit(p, e.x, e.y, ARC_R)) {
    if (q === e) continue;
    const d = Math.hypot(q.x - e.x, q.y - e.y);
    if (d < bd) { bd = d; tg = q; }
  }
  if (tg) faberArcs.push({ x0: e.x, y0: unitMidY(e), x1: tg.x, y1: unitMidY(tg), tg, team: p.team, owner: p.id, dmg: Math.round(dmg * ARC_SHARE), t: -1 });
  return dmg;
}
function updateArcs(dt) {
  for (let i = faberArcs.length - 1; i >= 0; i--) {
    const w = faberArcs[i];
    if (w.t < 0) { // the step after the spark: the jump lands
      w.t = 0;
      const src = faberSrc(w), q = w.tg;
      w.tg = null;
      if (src && unitAlive(q)) {
        w.x1 = q.x; w.y1 = unitMidY(q);
        const d = Math.hypot(w.x1 - w.x0, w.y1 - w.y0) || 1;
        hurtUnit(q, w.dmg, (w.x1 - w.x0) / d, (w.y1 - w.y0) / d, src, { ab: 'spark', arc: true, kb: 10 });
        burst(w.x1, w.y1, '#ffe08a', 6, 40, 0.3, true);
        sfxAt('hit', w.x1, w.y1);
      }
      continue;
    }
    w.t += dt;
    if (w.t >= ARC_SHOW) faberArcs.splice(i, 1);
  }
}

// ---- his machines (HERO_MACHINE: bodies in `robots`) ---------------------------------
// a machine of his set down at (x, y): a robot body (robotBody, js/sim/robots.js)
// carrying his side, his id and its kind's brain
function faberMachine(p, kind, x, y, hp, life) {
  const b = robotBody(x, y, hp, p.team, p.id, 0);
  b.kind = kind; b.life = life; b.lifeMax = life;
  b.face = p.input.aimX < x ? -1 : 1;
  robots.push(b);
  return b;
}
// a machine that has run down (or whose maker has left the side): it stops, no
// wreck and no pay
function faberRunDown(b) {
  b.dead = true;
  burst(b.x, b.y - 4, '#b98a2e', 8, 35, 0.4, true);
  sfxAt('place', b.x, b.y);
}
// is one of his old engines running (his small machines shoot faster)
function faberEngineOn(owner) {
  for (const b of robots) if (b.kind === 'faberEngine' && b.owner === owner && unitAlive(b)) return true;
  return false;
}

// ---- W WIND A MACHINE ---------------------------------------------------------------
function faberWinder(p) {
  const c = faberSpot(p, WINDER_PLACE);
  const b = faberMachine(p, 'faberWinder', c.x, c.y, WINDER_HP + WINDER_HP_LV * p.level, WINDER_LIFE);
  b.dmg = abDmg(p, 'winder', abRk(p, 'winder', 'dmg'));
  b.atkCd = 0.4; // a moment to wind before its first shot
  faberCap(robots.filter((r) => r.kind === 'faberWinder'), p.id, WINDER_MAX, faberRunDown);
  burst(c.x, c.y, '#f2cc6a', 10, 40, 0.4, true);
  sfxAt('place', c.x, c.y);
}
// a small machine's step: it stands, turns to the nearest rival in reach and shoots
function stepWinder(b, dt) {
  b.kbx = 0; b.kby = 0; b.moving = false;
  b.life -= dt;
  if (b.life <= 0 || !faberSrc(b)) { faberRunDown(b); return; }
  b.animT += dt;
  if (faberEngineOn(b.owner)) b.atkCd = Math.max(0, b.atkCd - dt * (ENGINE_HASTE - 1)); // the engine's run: its clock wound faster
  const foe = robotFoeUnit(b, WINDER_RANGE);
  b.atkAim = foe ? { x: foe.x, y: foe.y - 6 } : null;
  if (!foe) return;
  b.face = foe.x < b.x ? -1 : 1;
  if (b.atkCd > 0) return;
  b.atkCd = WINDER_CD;
  faberBolts.push({ x: b.x, y: b.y - 6, tg: foe, team: b.team, owner: b.owner, dmg: b.dmg });
  sfxAt('arrow', b.x, b.y);
}
function updateBolts(dt) {
  for (let i = faberBolts.length - 1; i >= 0; i--) {
    const w = faberBolts[i], q = w.tg;
    if (!unitAlive(q)) { faberBolts.splice(i, 1); continue; }
    const tx = q.x, ty = unitMidY(q), dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy) || 1;
    const step = WINDER_BOLT_SPD * dt;
    if (d > step) { w.x += dx / d * step; w.y += dy / d * step; continue; }
    hurtUnit(q, w.dmg, dx / d, dy / d, faberSrc(w), { ab: 'winder', kb: 8 });
    faberBolts.splice(i, 1);
  }
}

// ---- E CLOCKSPRING -------------------------------------------------------------------
function faberSpring(p) {
  const c = faberSpot(p, SPRING_RANGE);
  faberSprings.push({ x: c.x, y: c.y, team: p.team, owner: p.id, t: 0,
    dmg: abDmg(p, 'spring', abRk(p, 'spring', 'dmg')), root: abRk(p, 'spring', 'root') });
  faberCap(faberSprings, p.id, SPRING_MAX, (w, i) => faberSprings.splice(i, 1));
  burst(c.x, c.y, '#b98a2e', 6, 25, 0.3, true);
  sfxAt('place', c.x, c.y);
}
function updateSprings(dt) {
  for (let i = faberSprings.length - 1; i >= 0; i--) {
    const w = faberSprings[i];
    w.t += dt;
    if (w.t >= SPRING_LIFE) { faberSprings.splice(i, 1); continue; }
    if (w.t < SPRING_ARM) continue;
    const q = unitsHit(sideOf(w), w.x, w.y - 4, SPRING_R).find((e) => e instanceof Player);
    if (!q) continue;
    const src = faberSrc(w);
    rootUnit(q, w.root, src);
    hurtUnit(q, w.dmg, 0, 0, src, { ab: 'spring', kb: 0 });
    burst(w.x, w.y - 2, '#f2cc6a', 10, 45, 0.4, true);
    burst(w.x, w.y - 2, '#c3c9d3', 6, 35, 0.35, true);
    sfxAt('break_', w.x, w.y);
    faberSprings.splice(i, 1);
  }
}

// ---- R THE OLD ENGINE -------------------------------------------------------------------
function faberEngine(p) {
  const c = faberSpot(p, 14); // wound up at his side, toward his aim
  const b = faberMachine(p, 'faberEngine', c.x, c.y, ENGINE_HP + ENGINE_HP_LV * p.level, ENGINE_LIFE);
  b.dmg = abDmg(p, 'engine', abRk(p, 'engine', 'dmg'));
  b.stun = abRk(p, 'engine', 'stun');
  b.slamT = ENGINE_SLAM_FIRST; b.slamFx = 0;
  burst(c.x, c.y - 6, '#f2cc6a', 16, 60, 0.5, true);
  burst(c.x, c.y - 6, '#c3c9d3', 10, 45, 0.45, true);
  shakeFor(p, 2);
  sfxAt('break_', c.x, c.y);
}
// the engine's step: it walks to the spot he points at (no further than
// ENGINE_LEASH from him) and slams whenever a rival stands in reach
function stepEngine(b, dt) {
  const src = faberSrc(b);
  b.life -= dt;
  if (b.life <= 0 || !src || src.dead) { faberRunDown(b); return; }
  b.slamFx = Math.max(0, b.slamFx - dt);
  b.slamT -= dt;
  const g = faberSpot(src, ENGINE_LEASH);
  let moving = false;
  if (Math.hypot(g.x - b.x, g.y - b.y) > 6) {
    const n = navStep(b, g.x, g.y, 6, ENGINE_SPD, dt, 1);
    if (n.ok) { moving = true; if (Math.abs(n.dx) > 0.2) b.face = n.dx < 0 ? -1 : 1; } else navClear(b);
  }
  b.moving = moving;
  b.animT += dt * (moving ? 6 : 0);
  if (b.slamT > 0) return;
  const hit = unitsHit(src, b.x, b.y, ENGINE_SLAM_R);
  if (!hit.length) return;
  b.slamT = ENGINE_SLAM_EVERY; b.slamFx = 0.35;
  for (const q of hit) {
    const d = Math.hypot(q.x - b.x, q.y - b.y) || 1;
    stunUnit(q, b.stun, src);
    hurtUnit(q, b.dmg, (q.x - b.x) / d, (q.y - b.y) / d, src, { ab: 'engine', kb: 30 });
  }
  for (const s of structsNear(src, b.x, b.y, ENGINE_SLAM_R)) hurtStruct(s, b.dmg, src);
  if (PRACTICE) abHitDummies(b.x, b.y, ENGINE_SLAM_R, b.dmg);
  abFx.push({ kind: 'ring', x: b.x, y: b.y, r: ENGINE_SLAM_R, t: 0, col: '#f2cc6a' });
  burst(b.x, b.y, '#e6e1d6', 18, 70, 0.5, true);
  shakeFor(src, 3);
  sfxAt('break_', b.x, b.y);
}

// what he leaves in the world, one sim step (HERO_TICK)
function updateFaberWorld(dt) { updateParts(dt); updateArcs(dt); updateBolts(dt); updateSprings(dt); }

// ---- the hooks he registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.spareparts = { deal: faberDeal,
  name: 'SPARE PARTS', blurb: 'MACHINES BROKEN NEAR YOU DROP A SPARE PART. PICK IT UP TO SHORTEN THE WAIT ON YOUR FIRST THREE KEYS.',
  icon: FABER_ICON32.spareparts };
HERO_TICK.push(updateFaberWorld);
HERO_WRECK.push(faberWreck);
// his machines, by kind: r is the body's room (separateUnits), hitR the disc a shot lands in,
// mass how hard it is to push, sight how far its side sees from it, pay a rival's for breaking it
HERO_MACHINE.faberWinder = { step: stepWinder, draw: (b, ex, ey, now) => drawFaberWinder(b, ex, ey, now), r: 4, hitR: 6, mass: 40, sight: 90, pay: { gold: 20, xp: 10 } };
HERO_MACHINE.faberEngine = { step: stepEngine, draw: (b, ex, ey, now) => drawFaberEngine(b, ex, ey, now), r: 7, hitR: 10, mass: 6, sight: 110, pay: { gold: 50, xp: 40 } };
