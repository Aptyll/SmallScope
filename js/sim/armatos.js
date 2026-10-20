'use strict';
// ARMATOS, THE LAST STANDARD - the first named hero (CLASSES, js/sim/player.js):
// the warrior's body and sword, his own five pieces. A defensive initiator:
// he takes the hit for his side, answers it, and turns a lost fight into a
// last stand. Loaded before abilities.js, whose CLASS_AB takes ARM_AB as his
// row of keys; everything here is called at runtime and draws no rng().
// ------------------------------------------------------------ armatos

// ---- tuning --------------------------------------------------------------
// LEGION'S RESOLVE (the passive): the hits he takes fill it; full, the next
// key he casts lays a shield on him. It drains away out of a fight.
const RESOLVE_FULL = 0.3;       // share of his most health taken (after armor) to fill it
const RESOLVE_IDLE_T = 6;       // s without a hit before it starts to drain...
const RESOLVE_DRAIN = 0.15;     // ...this much of it a second
const RESOLVE_SHIELD = 0.14;    // the shield: this share of his most health...
const RESOLVE_SHIELD_T = 4;     // ...held for this long
// Q IRON VERDICT: the sword slammed down a line ahead
const VERDICT_LEN = 64;         // px of line
const VERDICT_HALF = 9;         // px either side of it
const VERDICT_MID = [0.4, 0.75]; // the stretch of the line that is its centre: knocked up there
// W HOLD THE LINE: braced behind the shield, the front takes less; a hero who
// strikes the front primes the bash, the key again
const BASH_R = 30, BASH_HALF = 0.85; // the bash's wedge, the slam's shape
const BASH_KB = 150;
// E VETERAN'S MARCH: a charge that shoulders soldiers and beasts aside and
// stops dead on the first hero, stunning them
const MARCH_SPD = 280;
const MARCH_T = 0.45;           // s of charge (~8 tiles)
const MARCH_RAMP = 0.08;
const MARCH_SHOVE = 160;        // px/s a lesser body is thrown off the line
// R THE OLD GUARD: the standard planted; a ring his side stands in
const GUARD_R = 72;             // px
const GUARD_EDGE = 80;          // px past the rim a fleeing rival is still caught by it (a dodge roll out included)

const guards = []; // {x, y, team, owner, t, n, life, armor, ten, slow, slowT} - the planted standards, stepped by updateGuards, each carrying its planter's rank
let guardN = 0;    // a standard's number, so a rival remembers WHICH ring it stood in

// ---- the keys ---------------------------------------------------------------
// His row in CLASS_AB (js/sim/abilities.js). Beyond the shared fields a row
// carries what its key IS: `rank` (its numbers at each rank, read by abRk -
// the per-rank tuning; a `cd` list is its cooldown at each rank), `wall` (the
// key raises the shieldT state, and the key again is its second half), `tele` (the wind-up's shape on the snow), `pose` (the body's), `icon`
// (its 32x32 grid, js/sprites/armatos.js) and `bot` (when a bot reaches for it,
// js/ai/ai-ladder.js).
const ARM_AB = [
  {
    id: 'verdict', name: 'IRON VERDICT', cd: [8, 7.5, 7, 6.5, 6], ap: 0.6, cast: 0.32, aim: { line: VERDICT_LEN },
    rank: { dmg: [14, 19, 24, 29, 34], slow: 0.6, slowT: 1.5, up: 0.6 }, // slow: walk x0.6; up: s in the air (the line's middle)
    blurb: 'THE SWORD COMES DOWN IN A LINE. SLOWS ALL IT HITS. THE MIDDLE OF THE LINE THROWS THEM UP.',
    use: (p) => armVerdict(p),
    tele: (p, px, py, a, col, closing) => drawVerdictTele(px, py, a, col, closing),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.75 ? -Math.round(3 * prog / 0.75) : 2, rot: 0 }), // up, then down
    icon: ARM_ICON32.verdict,
    bot: (p, foe, d, clear) => clear && d < VERDICT_LEN - 6,
  },
  {
    id: 'hold', name: 'HOLD THE LINE', cd: [12, 11.5, 11, 10.5, 10], ap: 0.5, cast: 0.12, wall: true, recast: (p) => p.shieldT > 0,
    rank: { t: 2.5, cut: 0.6, dmg: [10, 14, 18, 22, 26], stun: 1 }, // t: the brace; cut: off a front hit; dmg/stun: the bash (stun only primed)
    blurb: 'BRACE BEHIND THE SHIELD: THE FRONT TAKES LESS. A HERO WHO STRIKES IT PRIMES THE BASH. PRESS AGAIN TO BASH.',
    use: (p) => (p.castSlam ? armBash(p) : armBrace(p)),
    tele: (p, px, py, a, col, closing) => { if (p.castSlam) drawWedge(px, py, a, BASH_R, BASH_HALF, p.holdHit ? TELE_HOT : col, 0.55 + 0.4 * closing, closing); }, // the bash's wedge; the raise shows none
    acol: '#f2cc6a', activeF: (p) => (p.shieldT > 0 && p.hold ? p.shieldT / abRk(p, 'hold', 't') : 0),
    icon: ARM_ICON32.hold,
    bot: (p, foe, d) => (p.shieldT > 0 && p.hold
      ? d < BASH_R - 4 && (p.holdHit || p.shieldT < 0.4) // the bash: primed, or before the brace drops anyway
      : d < 110 && foe instanceof Player),
  },
  {
    id: 'march', name: "VETERAN'S MARCH", cd: [14, 13, 12, 11, 10], ap: 0.5, cast: 0.25, aim: { line: MARCH_SPD * MARCH_T },
    rank: { dmg: [12, 16, 20, 24, 28], stun: 1, shove: [5, 7, 9, 11, 13] }, // dmg/stun: the hero it stops on; shove: each lesser body
    blurb: 'CHARGE. SOLDIERS AND BEASTS ARE SHOVED ASIDE. THE FIRST HERO IN THE WAY STOPS YOU AND IS STUNNED.',
    use: (p) => armMarch(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawMarchTele(p, a, col, closing, now, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.5 ? 1 : 0, rot: 0.14 * (p.dir === 'left' ? -1 : 1) }), // head down
    icon: ARM_ICON32.march,
    bot: (p, foe, d, clear) => clear && foe instanceof Player && d > 34 && d < MARCH_SPD * MARCH_T - 10,
  },
  {
    id: 'guard', name: 'THE OLD GUARD', cd: [80, 70, 60], cast: 0.45, aim: { ring: GUARD_R },
    rank: { armor: [40, 60, 80], ten: 0.5, slow: 0.5, slowT: 2, t: 6 }, // allies inside: armor, tenacity; a rival leaving: slowed; t: s it stands
    blurb: 'PLANT THE STANDARD. YOUR SIDE INSIDE TAKES LESS AND SHRUGS OFF STUNS. RIVALS WHO RUN FROM IT ARE SLOWED.',
    use: (p) => armGuard(p),
    tele: (p, px, py, a, col, closing) => drawRing(px, py + 2, GUARD_R, col, 0.45 + 0.4 * closing, closing * 0.5),
    pose: () => ({ dx: 0, dy: 1, rot: 0 }), // the standard driven down
    icon: ARM_ICON32.guard,
    bot: (p, foe, d) => d < GUARD_R && (guardAllies(p) >= 2 || p.hp < p.maxHp * 0.5),
  },
];

// the passive, by the name his CLASSES entry gives (`passive`; HERO_PASSIVE, js/sim/heroes.js)
HERO_PASSIVE.resolve = { hurt: resolveHurt, cast: resolveCast, tick: resolveTick,
  name: "LEGION'S RESOLVE", blurb: 'THE HITS YOU TAKE BUILD RESOLVE. FULL, YOUR NEXT KEY GIVES YOU A SHIELD.', icon: ARM_ICON32.resolve };

// ---- LEGION'S RESOLVE -------------------------------------------------------
function resolveHurt(p, dmg) {
  if (p.resolve >= 1 || dmg <= 0) return;
  p.resolve = Math.min(1, p.resolve + dmg / (p.maxHp * RESOLVE_FULL));
  p.resolveIdle = 0;
  if (p.resolve >= 1) { burst(p.x, p.y - 12, '#f2cc6a', 10, 45, 0.5, true); sfxFor(p, 'pickup'); }
}
function resolveCast(p) {
  if (p.resolve < 1) return;
  p.resolve = 0;
  shieldUnit(p, Math.round(p.maxHp * RESOLVE_SHIELD), RESOLVE_SHIELD_T);
  burst(p.x, p.y - 8, '#f2cc6a', 12, 55, 0.5, true);
  sfxAt('place', p.x, p.y);
}
function resolveTick(p, dt) {
  if (p.resolve <= 0 || p.resolve >= 1) return; // full, it waits for the cast
  p.resolveIdle += dt;
  if (p.resolveIdle > RESOLVE_IDLE_T) p.resolve = Math.max(0, p.resolve - RESOLVE_DRAIN * dt);
}

// ---- Q IRON VERDICT ---------------------------------------------------------
// every rival body along the line ahead: [unit, how far along it, 0..1]
function unitsInLine(p, a, len, half) {
  const nx = Math.cos(a), ny = Math.sin(a), out = [];
  for (const q of unitsHit(p, p.x + nx * len / 2, p.y + ny * len / 2, len / 2 + half + 8)) {
    const qx = q.x - p.x, qy = q.y - (q.alt || 0) - p.y;
    const along = qx * nx + qy * ny, perp = Math.abs(qx * ny - qy * nx);
    if (along >= -4 && along <= len + unitRadius(q) && perp <= half + unitRadius(q)) out.push([q, Math.max(0, along) / len]);
  }
  return out;
}
function armVerdict(p) {
  const a = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
  const nx = Math.cos(a), ny = Math.sin(a);
  const dmg = abDmg(p, 'verdict', abRk(p, 'verdict', 'dmg'));
  const slow = abRk(p, 'verdict', 'slow'), slowT = abRk(p, 'verdict', 'slowT'), up = abRk(p, 'verdict', 'up');
  for (const [q, f] of unitsInLine(p, a, VERDICT_LEN, VERDICT_HALF)) {
    hurtUnit(q, dmg, nx, ny, p, { kb: 40 });
    if (q.dead) continue;
    slowUnit(q, slowT, slow);
    if (f >= VERDICT_MID[0] && f <= VERDICT_MID[1]) knockUp(q, up, p);
    burst(q.x, unitMidY(q), '#cfd8e8', 8, 50, 0.45);
  }
  const seen = [];
  for (let s = 8; s <= VERDICT_LEN; s += 12) {
    for (const st of structsNear(p, p.x + nx * s, p.y + ny * s, VERDICT_HALF)) if (!seen.includes(st)) { seen.push(st); hurtStruct(st, dmg, p); }
  }
  if (PRACTICE) abHitDummies(p.x + nx * VERDICT_LEN / 2, p.y + ny * VERDICT_LEN / 2, VERDICT_LEN / 2, dmg);
  abFx.push({ kind: 'line', x: p.x, y: p.y - 2, a, r: VERDICT_LEN, half: VERDICT_HALF, t: 0, col: '#f4f7ff' });
  // the crack running down the line
  for (let s = 6; s < VERDICT_LEN; s += 6) burst(p.x + nx * s, p.y + 2 + ny * s, s % 12 ? '#eef4fb' : '#cfd8e8', 2, 30, 0.35, true);
  shakeFor(p, 4);
  sfxAt('break_', p.x, p.y);
}

// ---- W HOLD THE LINE ----------------------------------------------------------
function armBrace(p) {
  abShieldUp(p);
  p.shieldT = abRk(p, 'hold', 't');
  p.hold = true;
  p.holdHit = false;
}
// a blow on a braced body: the share the shield takes off a FRONT hit, and the
// bash primed when a rival hero landed it. `dx, dy` is the way the blow
// travels (damagePlayer's shove direction); a blow with none (a burn) is no
// blow to the face.
function holdTaken(p, dmg, dx, dy, src) {
  if (!(p.shieldT > 0) || !p.hold || (!dx && !dy)) return dmg;
  if (dx * Math.cos(p.shieldA) + dy * Math.sin(p.shieldA) >= -SHIELD_ARC) return dmg; // from the side or behind
  if (src instanceof Player && src.team !== p.team && !p.holdHit) {
    p.holdHit = true;
    burst(p.x + Math.cos(p.shieldA) * 7, p.y - 6 + Math.sin(p.shieldA) * 5, '#ffd95c', 8, 45, 0.4, true);
    sfxFor(p, 'pickup');
  }
  burst(p.x + Math.cos(p.shieldA) * 7, p.y - 6 + Math.sin(p.shieldA) * 5, '#c8d2e4', 4, 30, 0.3, true);
  return Math.max(1, Math.round(dmg * (1 - abRk(p, 'hold', 'cut'))));
}
HERO_TAKEN.push(holdTaken);
// the key again: the shield's face driven into the wedge ahead. Primed (a
// hero struck the brace) it stuns; unprimed it is a shove and a knock.
function armBash(p) {
  p.castSlam = false;
  const a = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
  const nx = Math.cos(a), ny = Math.sin(a), primed = p.holdHit;
  const dmg = abDmg(p, 'hold', abRk(p, 'hold', 'dmg')), stun = abRk(p, 'hold', 'stun');
  for (const q of unitsInCone(p, p.x, p.y, a, BASH_R, BASH_HALF)) {
    hurtUnit(q, dmg, nx, ny, p, { kb: BASH_KB });
    if (!q.dead) { if (primed) stunUnit(q, stun, p); q.kbx += nx * BASH_KB * 0.5; q.kby += ny * BASH_KB * 0.5; }
    burst(q.x, unitMidY(q), primed ? '#ffd95c' : '#cfd8e8', 8, 50, 0.45, true);
    shakeFor(p, primed ? 5 : 3, q);
  }
  for (const s of structsInCone(p, p.x, p.y, a, BASH_R, BASH_HALF)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x + nx * BASH_R * 0.5, p.y + ny * BASH_R * 0.5, BASH_R * 0.5, dmg);
  abFx.push({ kind: 'wedge', x: p.x, y: p.y - 2, a, r: BASH_R, half: BASH_HALF, t: 0, col: primed ? '#ffd95c' : '#c8d2e4' });
  burst(p.x + nx * 8, p.y - 4 + ny * 6, '#9aa3ad', 8, 45, 0.4, true);
  abShieldDown(p, true);
  sfxAt('hit', p.x, p.y);
}

// ---- E VETERAN'S MARCH --------------------------------------------------------
// The charge rides the rush's state (rushT, rushNX/NY: the movement branch in
// playerMove, js/sim/sim.js, and every gate that already knows a charging body),
// with p.dash = 'march' saying it is this one (HERO_DASH, js/sim/heroes.js).
function armMarch(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y;
  const d = Math.hypot(dx, dy) || 1;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = MARCH_T;
  p.rushVictim = null;
  p.dash = 'march';
  p.marchHit.length = 0;
  p.sliding = false;
  faceToward(p, dx, dy, true);
  burst(p.x, p.y + 4, '#dfe8f4', 8, 45, 0.4, true);
  sfxAt('dodge', p.x, p.y);
}
HERO_DASH.march = { spd: MARCH_SPD, t: MARCH_T, ramp: MARCH_RAMP, step: (p, mv, dt) => marchStep(p, mv, dt) };
function marchStep(p, mv, dt) {
  p.rushFxT = (p.rushFxT || 0) - dt;
  if (p.rushFxT <= 0) { p.rushFxT = 0.04; burst(p.x + p.rushNX * 5, p.y + 4, '#eef4fb', 2, 30, 0.35, true); }
  for (const q of unitsHit(p, p.x + p.rushNX * 3, p.y + p.rushNY * 3, ROLL_HIT_R + PLAYER_R + 2)) {
    // a hero - or a bear nothing shoves - stops the march dead
    if (q instanceof Player || isAnchored(q)) { marchEnd(p, q); return; }
    if (p.marchHit.includes(q)) continue;
    // a lesser body is shouldered off the line, to whichever side it stood
    p.marchHit.push(q);
    const side = (q.x - p.x) * -p.rushNY + (q.y - p.y) * p.rushNX >= 0 ? 1 : -1;
    const sx = -p.rushNY * side, sy = p.rushNX * side;
    hurtUnit(q, abDmg(p, 'march', abRk(p, 'march', 'shove')), sx, sy, p, { kb: MARCH_SHOVE });
    burst(q.x, unitMidY(q), '#eef4fb', 5, 40, 0.35, true);
  }
  if (mv.blockedX || mv.blockedY || p.rushT <= 0) marchEnd(p, null);
}
// the end of the march: against a body (the stun), a wall, or the clock
function marchEnd(p, q) {
  p.rushT = 0;
  p.dash = '';
  p.marchHit.length = 0;
  p.vx = p.rushNX * 40; p.vy = p.rushNY * 40;
  if (!q) return;
  p.vx = -p.rushNX * 30; p.vy = -p.rushNY * 30; // the collision rocks him back
  hurtUnit(q, abDmg(p, 'march', abRk(p, 'march', 'dmg')), p.rushNX, p.rushNY, p, { kb: 60 });
  if (!q.dead) stunUnit(q, abRk(p, 'march', 'stun'), p);
  burst(q.x, unitMidY(q), '#ffd95c', 10, 55, 0.5, true);
  shakeFor(p, 5, q);
  sfxAt('hit', q.x, q.y);
}

// ---- R THE OLD GUARD ------------------------------------------------------------
function armGuard(p) {
  for (let i = guards.length - 1; i >= 0; i--) if (guards[i].owner === p.id) guards.splice(i, 1); // one standard each
  const rk = (k) => abRk(p, 'guard', k); // the rank he planted it at stays with the standard
  guards.push({ x: p.x, y: p.y, team: p.team, owner: p.id, t: 0, n: ++guardN,
    life: rk('t'), armor: rk('armor'), ten: rk('ten'), slow: rk('slow'), slowT: rk('slowT') });
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: GUARD_R, t: 0, col: '#f2cc6a' });
  burst(p.x, p.y + 2, '#eef4fb', 14, 60, 0.5, true);
  shakeFor(p, 4);
  sfxAt('break_', p.x, p.y);
}
// the standard an ally of `e` stands inside, or null - a player of either kind
// of control; the buildings, the beasts and the bay's soldiers are not rallied
function guardFor(e) {
  if (!(e instanceof Player) || !guards.length || e.dead) return null;
  for (const g of guards) if (g.team === e.team && Math.hypot(e.x - g.x, e.y - g.y) <= GUARD_R) return g;
  return null;
}
// what standing in one adds to a stat (statOf, js/sim/stats.js), and the
// tenacity it gives (ccMul, js/sim/actions.js)
function guardStat(p, key) { const g = key === 'armor' && guardFor(p); return g ? g.armor : 0; }
function guardTen(e) { const g = guardFor(e); return g ? g.ten : 0; }
HERO_STAT.push({ name: 'THE OLD GUARD', add: guardStat });
HERO_TEN.push(guardTen);
// allies (him included) a standard planted here would cover: the bot's reason to plant one
function guardAllies(p) {
  let n = 0;
  for (const q of players) if (q.team === p.team && unitAlive(q) && Math.hypot(q.x - p.x, q.y - p.y) <= GUARD_R) n++;
  return n;
}
// The ring's clock, and the rim: a rival who stood inside and steps out past
// it is slowed - every kind of rival body, walked through unitsNear. A body
// remembers the ring it was in by number (guardIn), so leaving one standard
// for another's ground is still leaving.
function updateGuards(dt) {
  for (let i = guards.length - 1; i >= 0; i--) {
    const g = guards[i];
    g.t += dt;
    if (g.t >= g.life) { guards.splice(i, 1); continue; }
    for (const q of unitsNear(sideOf(g), g.x, g.y, GUARD_R + GUARD_EDGE)) {
      if (unitTeam(q) === g.team) continue;
      const inside = Math.hypot(q.x - g.x, q.y - g.y) <= GUARD_R;
      if (inside) q.guardIn = g.n;
      else if (q.guardIn === g.n) {
        q.guardIn = 0;
        slowUnit(q, g.slowT, g.slow);
        burst(q.x, unitMidY(q), '#f2cc6a', 6, 35, 0.4, true);
      }
    }
  }
}
HERO_TICK.push(updateGuards);
// does `p` have a standard in the ground right now (his back is bare while it stands)
function guardPlanted(p) { return guards.some((g) => g.owner === p.id); }

// ---- bots -------------------------------------------------------------------------
// the key a bot casts at `foe`, `d` px off with a clear line or not: the first
// whose row's `bot` says now - ready, or (a wall key) up and waiting on its
// second half - or -1. A hero without `bot` rows is the ladder's own business.
function abBotKey(p, foe, d, clear) {
  for (let i = 0; i < AB_KEYS; i++) {
    const ab = abOf(p, i);
    if (!ab.bot || !abUnlocked(p, i)) continue;
    const up = abRecast(p, ab);
    if ((up || abReady(p, i)) && ab.bot(p, foe, d, clear)) return i;
  }
  return -1;
}
