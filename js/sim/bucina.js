'use strict';
// BUCINA, THE HORN - a named hero (CLASSES, js/sim/player.js) and the tempo support: her
// horn speeds her side up, steadies it against stuns and slows, and calls the snow down off
// the pines onto rivals sheltering under them. No heals and no shields, little damage of her
// own. Loaded before abilities.js, whose CLASS_AB takes BUCINA_AB as her row of keys; she
// registers into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ bucina

// ---- tuning --------------------------------------------------------------
// HEARD (the passive): each rival body one of her keys strikes sends allies near her running
const HEARD_R = 150;            // px round her an ally hears it (her too)
const HEARD_T = 1.5;            // s of the burst
const HEARD_WALK = 1.2;         // walk x this while it holds
// Q HORN BLAST: a cone of sound in front of her that shoves rivals back and slows them
const BLAST_REACH = 78;         // px
const BLAST_HALF = 0.55;        // rad either side of the aim
const BLAST_KB = 230;           // px/s of shove (hurtUnit kb)
const BLAST_SLOW = 0.7;         // walk x this...
const BLAST_SLOW_T = 1.5;       // ...for this long
const BLAST_FX_LIFE = 0.45;     // s its fronts run (drawn: AB_FX_LOOK.blast)
// W RALLYING NOTE: a ring round her; allies inside attack faster and shrug off part of every stun and slow
const RALLY_R = 110;            // px of ring
const RALLY_T = 4;              // s it holds on each ally
const RALLY_TEN = 0.3;          // tenacity while it holds (HERO_TEN)
const RALLY_FX_LIFE = 0.9;      // s its notes rise (drawn: AB_FX_LOOK.rally)
// E ECHO: a wave down the aim; a wall or a tree throws it back, and a rival struck going and coming is stunned
const ECHO_RANGE = 210;         // px it travels out
const ECHO_SPD = 400;           // px/s
const ECHO_R = 9;               // px round the wave a body is struck
const ECHO_STUN = 1;            // s, for a rival struck by both passes
// R SHAKE THE PINES: every pine in a wide ring sheds its snow; rivals under one are stunned, the woods inside shown
const PINES_R = 190;            // px of ring
const PINES_UNDER = 20;         // px from a pine's foot that counts as under it
const PINES_SEE_T = 3;          // s the woods' rivals stay shown
const PINES_PUFFS = 36;         // most pines that puff for one call (every pine still counts)

const bucinaEchoes = []; // {x, y, nx, ny, d, out, back, team, owner, dmg, h1, h2} - E's waves in flight
const bucinaCalls = [];  // {x, y, team, t} - R's rings, kept a moment for the draw
// (each carries its caster's rank from the moment it was cast)

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const BUCINA_AB = [
  {
    id: 'blast', name: 'HORN BLAST', cd: [10, 9.5, 9, 8.5, 8], ap: 0.3, cast: 0.2,
    rank: { dmg: [15, 25, 35, 45, 55] }, // the blast's blow
    tip: 'A BLAST OF SOUND PUSHES RIVALS BACK',
    blurb: 'A BLAST OF SOUND IN FRONT OF HER. RIVALS IT CATCHES ARE PUSHED BACK AND SLOWED.',
    use: (p) => bucinaBlast(p),
    tele: (p, px, py, a, col, closing, now) => drawBlastTele(px, py, a, closing, now), // the sound swelling in the horn's bell (js/draw/bucina.js)
    icon: BUCINA_ICON32.blast,
    bot: (p, foe, d) => d < BLAST_REACH * 0.8,
  },
  {
    id: 'note', name: 'RALLYING NOTE', cd: [16, 15, 14, 13, 12], cast: 0.25,
    rank: { as: [0.2, 0.25, 0.3, 0.35, 0.4] }, // attack speed added to each ally inside
    tip: 'ALLIES NEAR YOU ATTACK FASTER AND HOLD FIRM',
    blurb: 'A NOTE IN A RING AROUND HER. ALLIES INSIDE ATTACK FASTER AND SHRUG OFF PART OF EVERY STUN AND SLOW FOR A FEW SECONDS.',
    use: (p) => bucinaNote(p),
    icon: BUCINA_ICON32.note,
    bot: (p, foe, d) => foe instanceof Player && d < 220 && bucinaAllies(p, RALLY_R).length >= 2,
  },
  {
    id: 'echo', name: 'ECHO', cd: [13, 12.5, 12, 11.5, 11], ap: 0.35, cast: 0.25, aim: { line: ECHO_RANGE },
    rank: { dmg: [20, 32, 44, 56, 68] }, // each pass's blow
    tip: 'BOUNCES OFF WALLS. HIT TWICE: STUNNED',
    blurb: 'A SOUND WAVE IN A LINE. A WALL OR A TREE THROWS IT BACK. A RIVAL STRUCK GOING AND COMING IS STUNNED.',
    use: (p) => bucinaEcho(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawEchoTele(p, a, closing, ex, ey), // faint fronts of the wave down its line
    icon: BUCINA_ICON32.echo,
    bot: (p, foe, d, clear) => clear && d < ECHO_RANGE * 0.9,
  },
  {
    id: 'pines', name: 'SHAKE THE PINES', cd: [100, 85, 70], cast: 0.4,
    rank: { stun: [0.75, 1, 1.25] }, // s a rival under a pine is stunned
    tip: 'PINES DROP THEIR SNOW. RIVALS UNDER ARE STUNNED',
    blurb: 'A LONG HORN CALL IN A WIDE RING. EVERY PINE INSIDE DROPS ITS SNOW: RIVALS UNDER ONE ARE STUNNED, AND THE WOODS INSIDE ARE SHOWN.',
    use: (p) => bucinaPines(p),
    icon: BUCINA_ICON32.pines,
    bot: (p, foe, d) => foe instanceof Player && d < PINES_R * 0.85 && (bucinaUnderPine(foe.x, foe.y) || inWoods(foe.x, foe.y)),
  },
];

// ---- her side -------------------------------------------------------------------------
function bucinaSrc(w) { const o = players[w.owner]; return o && o.team === w.team ? o : null; }
// the living ally players within r of her (her too)
function bucinaAllies(p, r) {
  const out = [];
  for (const q of players) if (q.team === p.team && unitAlive(q) && Math.hypot(q.x - p.x, q.y - p.y) <= r) out.push(q);
  return out;
}
// HEARD: a rival struck by one of her keys sends every ally near her running
function bucinaHeard(p) {
  if (!p || !unitAlive(p) || CLASSES[p.cls].passive !== 'heard') return;
  for (const q of bucinaAllies(p, HEARD_R)) q.heardT = HEARD_T;
}
// whether (x, y) stands under a pine: a standing tree's foot within PINES_UNDER
function bucinaUnderPine(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), n = Math.ceil(PINES_UNDER / TILE);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const o = inWorld(tx + i, ty + j) && objects[(ty + j) * WORLD + tx + i];
    if (o && o.type === 'tree' && Math.hypot((tx + i + 0.5) * TILE - x, (ty + j + 0.5) * TILE - y) <= PINES_UNDER) return true;
  }
  return false;
}

// ---- Q HORN BLAST -----------------------------------------------------------------------
function bucinaBlast(p) {
  const a = Math.atan2(p.input.aimY - p.y, p.input.aimX - p.x);
  const dmg = abDmg(p, 'blast', abRk(p, 'blast', 'dmg'));
  let struck = false;
  for (const q of unitsHit(p, p.x, p.y, BLAST_REACH + PLAYER_R)) {
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > BLAST_HALF && d > 8) continue;
    hurtUnit(q, dmg, dx / d, dy / d, p, { kb: BLAST_KB, kbMul: q instanceof Player ? 2 : 1 });
    slowUnit(q, BLAST_SLOW_T, BLAST_SLOW);
    struck = true;
  }
  const mx = p.x + Math.cos(a) * BLAST_REACH / 2, my = p.y + Math.sin(a) * BLAST_REACH / 2;
  for (const s of structsNear(p, mx, my, BLAST_REACH / 2)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(mx, my, BLAST_REACH / 2, dmg);
  if (struck) bucinaHeard(p);
  abFx.push({ kind: 'wedge', x: p.x, y: p.y, a, r: BLAST_REACH, half: BLAST_HALF, t: 0, col: '#f2cc6a', fx: 'blast', life: BLAST_FX_LIFE });
  sfxAt('swing', p.x, p.y);
}

// ---- W RALLYING NOTE --------------------------------------------------------------------
function bucinaNote(p) {
  const as = abRk(p, 'note', 'as');
  for (const q of bucinaAllies(p, RALLY_R)) { q.rallyT = RALLY_T; q.rallyAs = as; }
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: RALLY_R, t: 0, col: '#f2cc6a', fx: 'rally', life: RALLY_FX_LIFE });
  burst(p.x, p.y - 8, '#f2cc6a', 12, 55, 0.45, true);
  sfxAt('pickup', p.x, p.y);
}
// what the note adds while it holds: attack speed (HERO_STAT 'as', a share like an item's)
// and tenacity (HERO_TEN)
function bucinaAs(p, key) { return key === 'as' && p.rallyT > 0 ? p.rallyAs || 0 : 0; }
function bucinaTen(e) { return e.rallyT > 0 ? RALLY_TEN : 0; }

// ---- E ECHO -----------------------------------------------------------------------------
function bucinaEcho(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y), d = Math.hypot(dx, dy) || 1;
  bucinaEchoes.push({ x: p.x, y: p.y - BOW_Y, nx: dx / d, ny: dy / d, d: 0, out: ECHO_RANGE, back: false,
    team: p.team, owner: p.id, dmg: abDmg(p, 'echo', abRk(p, 'echo', 'dmg')), h1: [], h2: [] });
  sfxAt('arrow', p.x, p.y);
}
// The wave runs out; a wall or a tree turns it round once, to run back as far as it came.
// Each pass strikes a body once; one struck on both is stunned.
function updateEchoes(dt) {
  for (let i = bucinaEchoes.length - 1; i >= 0; i--) {
    const w = bucinaEchoes[i];
    let left = Math.min(ECHO_SPD * dt, w.out - w.d), done = false;
    while (left > 0 && !done) {
      const s = Math.min(4, left);
      w.x += w.nx * s; w.y += w.ny * s; w.d += s; left -= s;
      if (isSolidTile(Math.floor(w.x / TILE), Math.floor((w.y + BOW_Y) / TILE))) {
        burst(w.x, w.y, '#cfd8e8', 5, 30, 0.3, true);
        if (w.back) { done = true; break; }
        w.back = true; w.nx = -w.nx; w.ny = -w.ny; w.out = w.d * 2; left = 0;
        w.x += w.nx * 4; w.y += w.ny * 4;
        sfxAt('swing', w.x, w.y);
        break;
      }
      const src = bucinaSrc(w), hits = w.back ? w.h2 : w.h1;
      for (const q of unitsHit(sideOf(w), w.x, w.y + BOW_Y, ECHO_R + PLAYER_R)) {
        if (hits.includes(q)) continue;
        hits.push(q);
        hurtUnit(q, w.dmg, w.nx, w.ny, src, { kb: 0, ab: 'echo' });
        if (w.back && w.h1.includes(q)) { stunUnit(q, ECHO_STUN, src); burst(q.x, unitMidY(q), '#fff1b8', 10, 50, 0.45, true); }
        bucinaHeard(src);
      }
    }
    if (done || w.d >= w.out) bucinaEchoes.splice(i, 1);
  }
}

// ---- R SHAKE THE PINES ---------------------------------------------------------------------
function bucinaPines(p) {
  const r = PINES_R, t = abRk(p, 'pines', 'stun');
  // every pine in the ring sheds (shedHit, js/sim/shed.js), a share of them seen to puff
  const trees = [];
  const t0x = Math.floor((p.x - r) / TILE), t1x = Math.floor((p.x + r) / TILE);
  const t0y = Math.floor((p.y - r) / TILE), t1y = Math.floor((p.y + r) / TILE);
  for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
    const o = inWorld(tx, ty) && objects[ty * WORLD + tx];
    if (o && o.type === 'tree' && Math.hypot((tx + 0.5) * TILE - p.x, (ty + 0.5) * TILE - p.y) <= r) trees.push(o);
  }
  const every = Math.max(1, Math.ceil(trees.length / PINES_PUFFS));
  trees.forEach((o, k) => { if (k % every === 0) shedHit(o); else o.shedT = state.windT + SHED_REST; });
  let struck = false;
  for (const q of unitsNear(p, p.x, p.y, r)) {
    if (inWoods(q.x, q.y)) markUnit(q, PINES_SEE_T);
    if (!(q.invuln > 0) && bucinaUnderPine(q.x, q.y)) { stunUnit(q, t, p); burst(q.x, unitMidY(q) - 4, '#ffffff', 10, 30, 0.6, true); struck = true; }
  }
  if (struck) bucinaHeard(p);
  bucinaCalls.push({ x: p.x, y: p.y, team: p.team, t: 0 });
  sfxAt('break_', p.x, p.y);
}
const HORN_CALL_T = 0.8; // s the call's ring stays on the snow
function updateCalls(dt) {
  for (let i = bucinaCalls.length - 1; i >= 0; i--) if ((bucinaCalls[i].t += dt) >= HORN_CALL_T) bucinaCalls.splice(i, 1);
}

// ---- her clocks (HERO_TICK, HERO_MOVE) ---------------------------------------------------
function bucinaWorld(dt) {
  for (const q of players) {
    if (q.heardT > 0) q.heardT = Math.max(0, q.heardT - dt);
    if (q.rallyT > 0) q.rallyT = Math.max(0, q.rallyT - dt);
  }
  updateEchoes(dt); updateCalls(dt);
}
function bucinaMoveMul(p) { return p.heardT > 0 ? HEARD_WALK : 1; }
function bucinaOut(p) { p.heardT = 0; p.rallyT = 0; }

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.heard = { out: bucinaOut,
  name: 'HEARD', blurb: 'EACH RIVAL YOUR KEYS STRIKE SENDS THE ALLIES NEAR YOU RUNNING FASTER.',
  icon: BUCINA_ICON32.heard,
};
HERO_TICK.push(bucinaWorld);
HERO_MOVE.push(bucinaMoveMul);
HERO_TEN.push(bucinaTen);
HERO_STAT.push({ name: 'RALLYING NOTE', add: bucinaAs });
