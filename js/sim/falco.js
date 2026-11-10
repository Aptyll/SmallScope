'use strict';
// FALCO, THE KESTREL - a named hero (CLASSES, js/sim/player.js): the old hunt's
// falconer, an assassin who dives. His one hawk finds a rival and marks it; his
// thrown knives bite harder on what it marked, and he falls out of the sky on a
// marked hero. Loaded before abilities.js, whose CLASS_AB takes FALCO_AB as his
// row of keys; he registers into the shared hero hooks (js/sim/heroes.js) and
// draws no rng().
// ------------------------------------------------------------ falco

// ---- tuning --------------------------------------------------------------
// THE HAWK (the passive): a rival the hawk marked takes more from his thrown
// knives (his basic attack and KNIFE FAN) and is shown through the fog a moment
const HAWK_MARK_T = 4;          // s a mark holds for his knives and his STOOP
const HAWK_SEE_T = 2;           // s it shows the rival through the fog (markUnit)
const HAWK_BONUS = 0.25;        // his knives deal x (1 + this) to a marked rival
// Q TALONS: the hawk flies to a spot, marks the first rival there, and comes back
const TALON_RANGE = 240;        // px the spot may be from him
const TALON_SPD = 320;          // px/s out
const TALON_BACK = 380;         // px/s home
const TALON_R = 36;             // px round the spot it finds a rival
const TALON_PATH = 14;          // px round itself it takes a rival on the way out
const TALON_SIGHT = 70;         // px the hawk sees round itself while it is out (HERO_MACHINE sight)
const TALON_HP = 30;            // the hawk out is a body a rival can cut down (HERO_MACHINE.falcoHawk)...
const TALON_HP_LV = 6;          // ...with this more for each of his levels
const HAWK_DOWN_T = 10;         // s a hawk cut down is gone: no TALONS and none over his shoulder
const TALON_HOME = 10;          // px from him it is home
// W KNIFE FAN: three knives in a narrow fan
const FAN_LEN = 150;            // px each flies
const FAN_SPD = 380;            // px/s
const FAN_SPREAD = 0.09;        // rad between knives
const FAN_R = 5;                // px round a knife a body is struck
const FAN_SLOW = 0.55;          // a marked rival struck by all three walks x this...
const FAN_SLOW_T = 1.5;         // ...for this long
// E GLIDE: a long leap forward over soldiers and rivals
const GLIDE_LEN = 130;          // px
const GLIDE_SPD = 300;          // px/s
const GLIDE_LIFT = 5;           // px his body rises at the top of the leap (the draw)
// R STOOP: up out of reach, then down on a marked hero
const STOOP_REACH = 260;        // px from him a marked hero may be
const STOOP_UP = 0.7;           // s in the sky: untouchable, unseen, still
const STOOP_UP_AD = 0.9;        // the drop adds this share of his DAMAGE
const STOOP_KNOCK = 0.75;       // s the hero struck is knocked up
const STOOP_FX_LIFE = 0.6;      // s the drop's mark shows (drawn: AB_FX_LOOK.stoop)

const falcoKnives = []; // {x, y, nx, ny, d, len, team, owner, dmg, cast} - W's knives in flight, (x, y) on the snow under them

// ---- the keys ---------------------------------------------------------------
// His row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const FALCO_AB = [
  {
    id: 'talons', name: 'TALONS', cd: [12, 11, 10, 9, 8], ap: 0.3, cast: 0.12, aim: { line: TALON_RANGE },
    rank: { dmg: [20, 35, 50, 65, 80] },
    tip: 'SEND THE HAWK. IT MARKS A RIVAL',
    blurb: 'SEND YOUR HAWK TO A SPOT. IT STRIKES THE FIRST RIVAL THERE AND MARKS THEM, THEN FLIES BACK TO YOU. WHILE IT IS OUT IT SEES FOR YOUR SIDE, AND RIVALS CAN CUT IT DOWN: THEN IT IS GONE A WHILE.',
    use: (p) => falcoTalons(p),
    ok: (p) => !falcoHawkOf(p) && !(p.falcoDownT > 0),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = falcoSpot(p, TALON_RANGE); drawTalonsTele(Math.round(c.x - ex), Math.round(c.y - ey), closing, now); }, // the hawk's shadow wheeling over the spot (js/draw/falco.js)
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? -1 : 0, rot: 0 }), // the glove up, the hawk off it
    icon: FALCO_ICON32.talons,
    bot: (p, foe, d) => d > 40 && d < TALON_RANGE && !falcoMarked(foe, p),
    botAim: (p, foe) => ({ x: foe.x, y: foe.y }),
  },
  {
    id: 'fan', name: 'KNIFE FAN', cd: [9, 8.5, 8, 7.5, 7], ap: 0.25, cast: 0.15, aim: { cone: FAN_LEN, half: FAN_SPREAD },
    rank: { dmg: [16, 24, 32, 40, 48] }, // each knife
    tip: 'THREE KNIVES. ALL THREE SLOW A MARK',
    blurb: 'THROW THREE KNIVES IN A NARROW FAN. A RIVAL YOUR HAWK MARKED WHO IS HIT BY ALL THREE IS SLOWED.',
    use: (p) => falcoFan(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawFanTele(p, a, closing, ex, ey), // three blades fanned in his hand, their glint down each line
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? -1 : 1, rot: 0 }), // the arm back, then the throw
    icon: FALCO_ICON32.fan,
    bot: (p, foe, d, clear) => clear && d < FAN_LEN - 10,
  },
  {
    id: 'glide', name: 'GLIDE', cd: [16, 15, 14, 13, 12], cast: 0.05, aim: { line: GLIDE_LEN },
    rank: {}, // a rank is the leap back sooner
    tip: 'A LONG LEAP OVER ANYONE IN THE WAY',
    blurb: 'LEAP FAR FORWARD, GLIDING OVER SOLDIERS AND RIVALS IN YOUR WAY.',
    use: (p) => falcoGlide(p),
    icon: FALCO_ICON32.glide,
    // a bot leaps in on a marked rival it can finish, or away when it is losing
    bot: (p, foe, d) => (falcoMarked(foe, p) && d > 60 && d < GLIDE_LEN + 40) || (p.hp < p.maxHp * 0.3 && d < 70),
    botAim: (p, foe) => (p.hp < p.maxHp * 0.3 ? { x: 2 * p.x - foe.x, y: 2 * p.y - foe.y } : { x: foe.x, y: foe.y }),
  },
  {
    id: 'stoop', name: 'STOOP', cd: [90, 75, 60], ap: 0.9, cast: 0.05,
    rank: { dmg: [120, 180, 240] }, // the drop, + STOOP_UP_AD of his DAMAGE
    tip: 'INTO THE SKY, THEN DOWN ON A MARK',
    blurb: 'LEAP INTO THE SKY, OUT OF REACH FOR A MOMENT, THEN DROP ON A HERO YOUR HAWK MARKED, KNOCKING THEM UP AND DEALING HEAVY DAMAGE.',
    use: (p) => falcoStoop(p),
    ok: (p) => !!stoopTarget(p),
    acol: '#f2cc6a', activeF: (p) => (p.falcoSkyT > 0 ? p.falcoSkyT / STOOP_UP : 0),
    icon: FALCO_ICON32.stoop,
    bot: (p, foe, d) => foe instanceof Player && falcoMarked(foe, p) && d < STOOP_REACH && foe.hp < foe.maxHp * 0.7,
  },
];

// ---- the mark ---------------------------------------------------------------------
function falcoMarked(q, p) { return !!q && q.falcoBy === p.id && state.elapsed < q.falcoUntil; }
function falcoMark(p, q) {
  if (!unitAlive(q)) return;
  q.falcoBy = p.id; q.falcoUntil = state.elapsed + HAWK_MARK_T;
  markUnit(q, HAWK_SEE_T);
}
function falcoSrc(w) { const o = players[w.owner]; return o && o.team === w.team && unitAlive(o) ? o : null; }
function falcoHawkOf(p) { for (const b of robots) if (b.kind === 'falcoHawk' && b.owner === p.id && b.team === p.team && !b.dead) return b; return null; }
function falcoSpot(p, range) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const r = Math.min(d, range);
  return { x: p.x + dx / d * r, y: p.y + dy / d * r };
}

// ---- THE HAWK -----------------------------------------------------------------------
// The blow hook (HERO_PASSIVE `deal`): a thrown knife (his basic attack or the
// fan) bites harder on a rival his hawk marked
function hawkDeal(p, q, dmg, o) {
  if (!(o.basic || o.ab === 'fan') || !falcoMarked(q, p)) return dmg;
  return Math.round(dmg * (1 + HAWK_BONUS));
}
// his clocks, one sim step: up in the sky, then the drop
function falcoTick(p, dt) {
  if (p.falcoDownT > 0) p.falcoDownT = Math.max(0, p.falcoDownT - dt);
  if (p.falcoSkyT > 0 && (p.falcoSkyT -= dt) <= 0) { p.falcoSkyT = 0; falcoDrop(p); }
}
// still in the sky: he does not walk
function falcoMoveMul(p) { return p.falcoSkyT > 0 ? 0 : 1; }
function falcoOut(p) {
  p.falcoSkyT = 0; p.falcoStoopId = -1; p.falcoDownT = 0;
  for (const b of robots) if (b.kind === 'falcoHawk' && b.owner === p.id) b.dead = true;
}
// up in the sky he is hidden from every side (HERO_COVER, js/sim/heroes.js)
function falcoCover(srcs, x, y, u) { return u instanceof Player && u.falcoSkyT > 0; }

// ---- Q TALONS ----------------------------------------------------------------------
function falcoTalons(p) {
  const c = falcoSpot(p, TALON_RANGE);
  const b = robotBody(p.x, p.y, TALON_HP + TALON_HP_LV * p.level, p.team, p.id, 0);
  Object.assign(b, { kind: 'falcoHawk', tx: c.x, ty: c.y, back: false, face: c.x < p.x ? -1 : 1,
    dmg: abDmg(p, 'talons', abRk(p, 'talons', 'dmg')) });
  robots.push(b);
  burst(p.x + 5, p.y - 12, '#a8794a', 6, 40, 0.35, true);
  sfxAt('dodge', p.x, p.y);
}
// The hawk out is a body in `robots` (HERO_MACHINE.falcoHawk), so every blow,
// shot, tower and soldier can cut it down; its step flies straight over walls.
// Out to the spot; the first rival hero it passes close over (a wave in the way
// does not stop it), or the first rival round the spot (a hero before anything
// else), it strikes and marks, and turns for home
function stepHawk(h, dt) {
  h.kbx = 0; h.kby = 0; h.moving = true;
  h.animT += dt;
  const o = falcoSrc(h);
  if (!o) { h.dead = true; burst(h.x, h.y - 10, '#a8794a', 4, 30, 0.3, true); return; }
  const tx = h.back ? o.x : h.tx, ty = h.back ? o.y : h.ty;
  const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
  const step = Math.min((h.back ? TALON_BACK : TALON_SPD) * dt, d);
  h.x += dx / d * step; h.y += dy / d * step;
  if (Math.abs(dx) > 0.5) h.face = dx < 0 ? -1 : 1;
  if (h.back) { if (d - step <= TALON_HOME) h.dead = true; return; } // home: back over his shoulder, no pay
  const there = d - step <= 0.5;
  const near = unitsHit(sideOf(h), h.x, h.y, (there ? TALON_R : TALON_PATH) + PLAYER_R).filter((e) => there || e instanceof Player);
  if (!there && !near.length) return;
  const q = near.find((e) => e instanceof Player) || near[0];
  if (q) {
    const nx = (q.x - o.x) / (Math.hypot(q.x - o.x, q.y - o.y) || 1), ny = (q.y - o.y) / (Math.hypot(q.x - o.x, q.y - o.y) || 1);
    hurtUnit(q, h.dmg, nx, ny, o, { kb: 10, ab: 'talons' });
    falcoMark(o, q);
    burst(q.x, unitMidY(q), '#f2cc6a', 8, 45, 0.4, true);
    sfxAt('hit', q.x, q.y);
  } else if (PRACTICE) abHitDummies(h.x, h.y, TALON_R, h.dmg);
  h.back = true;
}
// cut down (HERO_MACHINE `fall`, robotDies): feathers, and he is without it a while
function hawkFall(h) {
  burst(h.x, h.y - 6, '#a8794a', 10, 45, 0.5, true);
  burst(h.x, h.y - 6, '#efe8d6', 5, 35, 0.4, true);
  sfxAt('hit', h.x, h.y);
  const o = players[h.owner];
  if (o && o.team === h.team) o.falcoDownT = HAWK_DOWN_T;
}

// ---- W KNIFE FAN --------------------------------------------------------------------
function falcoFan(p) {
  const a = Math.atan2(p.input.aimY - p.y, p.input.aimX - p.x), dmg = abDmg(p, 'fan', abRk(p, 'fan', 'dmg'));
  p.falcoFanN = (p.falcoFanN + 1) % 1000;
  const cast = p.id * 1000 + p.falcoFanN; // which throw a knife is from, so all three can be counted
  for (const k of [-1, 0, 1]) {
    const b = a + k * FAN_SPREAD;
    falcoKnives.push({ x: p.x, y: p.y, nx: Math.cos(b), ny: Math.sin(b), d: 0, len: FAN_LEN,
      team: p.team, owner: p.id, dmg, cast });
  }
  sfxAt('dodge', p.x, p.y);
}
function updateFalcoKnives(dt) {
  for (let i = falcoKnives.length - 1; i >= 0; i--) {
    const k = falcoKnives[i], o = falcoSrc(k);
    const step = Math.min(FAN_SPD * dt, k.len - k.d);
    k.x += k.nx * step; k.y += k.ny * step; k.d += step;
    const q = unitsHit(sideOf(k), k.x, k.y, FAN_R + PLAYER_R)[0];
    const st = q ? null : structsNear(sideOf(k), k.x, k.y, FAN_R)[0];
    if (q) {
      hurtUnit(q, k.dmg, k.nx, k.ny, o, { kb: 0, ab: 'fan' }); // no shove: the next knife still finds them
      if (q.falcoFanId === k.cast) q.falcoFanHits++; else { q.falcoFanId = k.cast; q.falcoFanHits = 1; }
      if (q.falcoFanHits >= 3 && o && falcoMarked(q, o)) { slowUnit(q, FAN_SLOW_T, FAN_SLOW); burst(q.x, q.y + 2, '#c8d2e4', 8, 40, 0.4, true); }
    }
    if (st) hurtStruct(st, k.dmg, o);
    if (q || st) { burst(k.x, k.y, '#c8d2e4', 5, 35, 0.3, true); sfxAt('hit', k.x, k.y); }
    const solid = isSolidTile(Math.floor(k.x / TILE), Math.floor(k.y / TILE));
    if (q || st || solid || k.d >= k.len) {
      if (PRACTICE && !q && !st) abHitDummies(k.x, k.y, FAN_R + 4, k.dmg);
      falcoKnives.splice(i, 1);
    }
  }
}

// ---- E GLIDE ------------------------------------------------------------------------
function falcoGlide(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = GLIDE_LEN / GLIDE_SPD;
  p.dash = 'glide';
  p.sliding = false;
  faceToward(p, p.rushNX, p.rushNY, true);
  burst(p.x, p.y + 4, '#eef4fb', 10, 45, 0.4, true);
  sfxAt('dodge', p.x, p.y);
}
function glideEnd(p) {
  p.rushT = 0; p.dash = '';
  p.vx = p.rushNX * 40; p.vy = p.rushNY * 40;
  burst(p.x, p.y + 4, '#eef4fb', 8, 40, 0.35, true);
}
// how high the leap carries him, px (the body's pose while it runs)
function glideLift(p) { const k = 1 - p.rushT / (GLIDE_LEN / GLIDE_SPD); return Math.round(GLIDE_LIFT * Math.sin(Math.PI * Math.max(0, Math.min(1, k)))); }

// ---- R STOOP ------------------------------------------------------------------------
// the marked rival hero he can fall on: the nearest one his hawk marked
function stoopTarget(p) {
  let best = null, bd = STOOP_REACH;
  for (const q of players) {
    if (!enemyOf(p, q) || !unitAlive(q) || !falcoMarked(q, p)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function falcoStoop(p) {
  const q = stoopTarget(p);
  if (!q) return;
  p.falcoStoopId = q.id;
  p.falcoSkyT = STOOP_UP;
  p.invuln = Math.max(p.invuln, STOOP_UP + 0.05);
  p.vx = 0; p.vy = 0;
  burst(p.x, p.y + 2, '#eef4fb', 18, 70, 0.5, true);
  sfxAt('splash', p.x, p.y);
}
// down out of the sky on the marked hero, wherever it went; on the snow where
// he rose if it is gone
function falcoDrop(p) {
  if (!unitAlive(p)) return;
  const q = p.falcoStoopId >= 0 ? players[p.falcoStoopId] : null;
  p.falcoStoopId = -1;
  burst(p.x, p.y + 2, '#eef4fb', 10, 50, 0.4, true);
  if (!q || !unitAlive(q) || q.team === p.team || Math.hypot(q.x - p.x, q.y - p.y) > STOOP_REACH * 1.5) return;
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
  p.x = q.x - nx * (PLAYER_R * 2); p.y = q.y - ny * (PLAYER_R * 2);
  if (isSolidTile(Math.floor(p.x / TILE), Math.floor(p.y / TILE))) { p.x = q.x; p.y = q.y; }
  faceToward(p, nx, ny, true);
  hurtUnit(q, abDmg(p, 'stoop', abRk(p, 'stoop', 'dmg')) + Math.round(statOf(p, 'dmg') * STOOP_UP_AD), nx, ny, p, { kb: 0, ab: 'stoop', crit: true });
  knockUp(q, STOOP_KNOCK, p);
  abFx.push({ kind: 'ring', x: q.x, y: q.y, r: 24, t: 0, col: '#f2cc6a', fx: 'stoop', life: STOOP_FX_LIFE });
  burst(q.x, q.y + 2, '#eef4fb', 22, 80, 0.55, true);
  sfxAt('break_', q.x, q.y);
}

// ---- the hooks he registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.hawk = { deal: hawkDeal, tick: falcoTick, out: falcoOut,
  name: 'THE HAWK', blurb: 'RIVALS YOUR HAWK MARKS TAKE MORE FROM YOUR THROWN KNIVES AND ARE SHOWN THROUGH THE FOG FOR A MOMENT.', icon: FALCO_ICON32.hawk };
HERO_MOVE.push(falcoMoveMul);
HERO_COVER.push(falcoCover);
HERO_TICK.push(updateFalcoKnives);
// the hawk out: r its room, hitR the disc a shot lands in, sight its eye; `fly` - nothing
// pushes it and it pushes nothing; `puff` its hit colours; `fall` its own end, no wreck
HERO_MACHINE.falcoHawk = { step: stepHawk, draw: (b, ex, ey, now) => drawHawkOut(b, ex, ey, now), r: 3, hitR: 7, mass: 1, sight: TALON_SIGHT,
  pay: { gold: 25, xp: 15 }, fly: true, puff: ['#a8794a', '#efe8d6'], fall: hawkFall };
HERO_DASH.glide = { spd: GLIDE_SPD, t: GLIDE_LEN / GLIDE_SPD, ramp: 0.01, through: true,
  pose: (p) => ({ dx: 0, dy: -glideLift(p), rot: 0 }),
  step: (p, mv) => { if (mv.blockedX || mv.blockedY || p.rushT <= 0) glideEnd(p); } };
