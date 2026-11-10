'use strict';
// VARRO, THE WOLF-KEPT - a named hero (CLASSES, js/sim/player.js): a diver who
// picks one rival and closes the ring on them. His spear leaps in and marks,
// his blows on the mark land harder, his howl throws the crowd back, and at
// level six he calls three wolves out of the woods to run that one rival
// down. The wolves are real wolves (animals, js/sim/wildlife.js) on his side,
// walked by HERO_SUMMON. Loaded before abilities.js, whose CLASS_AB takes
// VARRO_AB as his row of keys; he registers into the shared hero hooks
// (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ varro

// ---- tuning --------------------------------------------------------------
// THE PACK (the passive): every wolf near him, his own or a den's, quickens
// his attacks; his blows on the valley's beasts land harder (he knows where
// to strike), which is his way through the woods.
const WOLVES_R = 96;              // px a wolf counts from
const WOLVES_AS = 0.08;           // attack speed each wolf adds...
const WOLVES_MAX = 4;             // ...counting this many at most
const WOLVES_BEAST = 1.25;        // x his blows on a beast (not a summoned one)
// Q LUNGE: a short leap at the rival at the aim; it lands a blow and marks
// them, and his basic attacks on the mark hit harder while it holds
const LEAP_RANGE = 80;          // px from him to the body he leaps at
const LEAP_PICK = 30;           // px from the aim a body may stand and still be the one
const LEAP_SPD = 380;           // px/s
const LEAP_MARK_T = 4;          // s the mark holds
const LEAP_BONUS_AD = 0.2;      // each marked blow's extra (its rank's markDmg) adds this share of his DAMAGE
// W HOWL: the ring around him; rivals in it are slowed and thrown back, and
// his wolves run faster for a while
const HOWL_R = 56;
const HOWL_FX_LIFE = 0.5;       // s the blown snow lies on the ground (drawHowlFx, js/draw/varro.js)
const HOWL_KB = 260;            // px/s of shove, out from him
const HOWL_PACK_T = 3;          // s his wolves run at HOWL_PACK_MUL
const HOWL_PACK_MUL = 1.3;
// E SNAP: two quick strikes on the marked rival (or the one at the aim); the second slows
const SNAP_REACH = 34;          // px
const SNAP_GAP = 0.18;          // s between the strikes
// R CALL THE PACK: three wolves run in from the nearest woods and hunt the hero at the aim
const CALL_RANGE = 220;         // px from him to the hero he calls them on
const CALL_PICK = 44;           // px from the aim
const CALL_N = 3;
const CALL_WOODS = 8;           // tiles round the hero the pines are looked for in
const CALL_SPD = 108;           // px/s a called wolf runs (a walk is PLAYER_SPEED)
const CALL_REACH = 12;          // px a bite reaches
const CALL_BITE_CD = 1;         // s between one wolf's bites
const CALL_LEAVE_T = 0.8;       // s a wolf whose hunt is over runs off before it is gone

// ---- the keys ---------------------------------------------------------------
// His row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const VARRO_AB = [
  {
    id: 'leap', name: 'LUNGE', cd: [8, 7.5, 7, 6.5, 6], ap: 0.5, cast: 0.1, aim: { line: LEAP_RANGE },
    rank: { dmg: [14, 19, 24, 29, 34], markDmg: [5, 7, 9, 11, 13], mark: LEAP_MARK_T }, // markDmg: each basic attack on the mark, + LEAP_BONUS_AD of his DAMAGE
    tip: 'LEAP IN AND MARK. HIT THE MARK HARDER',
    blurb: 'LEAP AT THE RIVAL AT THE AIM AND STRIKE. THEY ARE MARKED: YOUR ATTACKS ON THEM HIT HARDER WHILE IT HOLDS.',
    use: (p) => varroLeap(p),
    ok: (p) => !!leapTarget(p),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? 1 : 0, rot: 0.16 * (p.dir === 'left' ? -1 : 1) }), // crouched to spring
    icon: VARRO_ICON32.leap,
    bot: (p, foe, d) => d > 18 && d < LEAP_RANGE - 6,
  },
  {
    id: 'howl', name: 'HOWL', cd: [14, 13, 12, 11, 10], cast: 0.2, aim: { ring: HOWL_R },
    rank: { slowT: [1, 1.25, 1.5, 1.75, 2], slow: 0.65 }, // rivals in the ring: walk x0.65, thrown back
    tip: 'RIVALS NEAR ARE THROWN BACK AND SLOWED',
    blurb: 'A HOWL THAT CARRIES. RIVALS NEAR YOU ARE THROWN BACK AND SLOWED, AND YOUR WOLVES RUN FASTER.',
    use: (p) => varroHowl(p),
    pose: () => ({ dx: 0, dy: -1, rot: 0 }), // head up
    icon: VARRO_ICON32.howl,
    bot: (p, foe, d) => d < HOWL_R - 10 && (foe instanceof Player || p.hp < p.maxHp * 0.4),
  },
  {
    id: 'snap', name: 'SNAP', cd: [9, 8.5, 8, 7.5, 7], ap: 0.35, cast: 0.08, aim: { line: SNAP_REACH },
    rank: { dmg: [10, 14, 18, 22, 26], slow: 0.5, slowT: 1.5 }, // dmg: each of the two strikes; the second slows
    tip: 'TWO QUICK STRIKES. THE SECOND SLOWS',
    blurb: 'TWO QUICK SPEAR STRIKES ON YOUR MARK, OR THE RIVAL AT THE AIM. THE SECOND SLOWS THEM.',
    use: (p) => varroSnap(p),
    ok: (p) => !!snapTarget(p),
    icon: VARRO_ICON32.snap,
    bot: (p, foe, d) => d < SNAP_REACH - 4,
  },
  {
    id: 'call', name: 'CALL THE PACK', cd: [90, 75, 60], ap: 0.15, cast: 0.35, aim: { ring: CALL_RANGE },
    rank: { dmg: [5, 7, 9], wolfHp: [40, 60, 80], t: [5, 5.5, 6] }, // dmg: each bite; wolfHp: each wolf's; t: s they hunt
    tip: 'THREE WOLVES HUNT THE HERO AT THE AIM',
    blurb: 'THREE WOLVES RUN IN FROM THE NEAREST WOODS AND HUNT THE RIVAL HERO AT THE AIM. THEY LEAVE WHEN IT FALLS OR THE HUNT RUNS OUT.',
    use: (p) => varroCall(p),
    ok: (p) => !!callTarget(p),
    pose: () => ({ dx: 0, dy: -1, rot: 0 }),
    icon: VARRO_ICON32.call,
    bot: (p, foe, d) => foe instanceof Player && d < CALL_RANGE - 30 && (foe.hp < foe.maxHp * 0.75 || lungeMarked(p, foe)), // a hurt hero, or the one he just marked
  },
];

// ---- THE PACK -------------------------------------------------------------------
// the wolves near him that count, his own or a den's (never a rival's pack)
function wolvesNear(p) {
  let n = 0;
  for (const a of animals) {
    if (a.dead || a.kind !== 'wolf' || (a.team !== undefined && a.team !== p.team)) continue;
    if (Math.hypot(a.x - p.x, a.y - p.y) <= WOLVES_R && ++n >= WOLVES_MAX) break;
  }
  return n;
}
// attack speed (HERO_STAT 'as', a share like an item's: asMul, js/sim/stats.js)
function wolvesStat(p, key) { return key === 'as' && CLASSES[p.cls].passive === 'pack' && !p.dead ? wolvesNear(p) * WOLVES_AS : 0; }
HERO_STAT.push({ name: 'THE PACK', add: wolvesStat });
// the blow hook (HERO_PASSIVE `deal`): a beast takes more; a basic attack on his mark more again
function wolvesDeal(p, q, dmg, o) {
  if (animals.includes(q) && !q.summon) dmg = Math.round(dmg * WOLVES_BEAST);
  if (o.basic && q.packBy === p.id && state.elapsed < q.packUntil) {
    dmg += Math.round(abRk(p, 'leap', 'markDmg') + statOf(p, 'dmg') * LEAP_BONUS_AD);
    burst(q.x, unitMidY(q), '#cfd8e8', 5, 40, 0.35, true);
  }
  return dmg;
}
// his clocks, one sim step: the second strike of SNAP
function varroTick(p, dt) {
  if (p.snapN > 0 && (p.snapT -= dt) <= 0) varroStrike(p);
}
function varroOut(p) {
  p.snapN = 0; p.leapQ = null;
  if (p.dash === 'vleap') { p.rushT = 0; p.dash = ''; }
}
// is `q` wearing his mark
function lungeMarked(p, q) { return q.packBy === p.id && state.elapsed < q.packUntil && unitAlive(q); }

// ---- Q LUNGE --------------------------------------------------------------------
// the rival body nearest the aim within LEAP_PICK of it and LEAP_RANGE of him
function leapTarget(p) {
  let best = null, bd = LEAP_PICK;
  for (const q of unitsHit(p, p.x, p.y, LEAP_RANGE)) {
    const d = Math.hypot(q.x - p.input.aimX, q.y - (q.alt || 0) - p.input.aimY);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
// The leap rides the charge state (rushT, HERO_DASH) at its own pace, steering
// for the body as it goes; it lands when it reaches them.
function varroLeap(p) {
  const q = leapTarget(p);
  if (!q) { burst(p.x, p.y + 2, '#cfd8e8', 4, 25, 0.3, true); return; } // it stepped away mid-cast
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = (d + 12) / LEAP_SPD;
  p.dash = 'vleap';
  p.leapQ = q;
  p.sliding = false;
  faceToward(p, dx, dy, true);
  burst(p.x, p.y + 4, '#dfe8f4', 8, 45, 0.4, true);
  sfxAt('dodge', p.x, p.y);
}
function leapStep(p, mv) {
  const q = p.leapQ;
  if (q && unitAlive(q)) {
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d <= PLAYER_R + unitRadius(q) + 4) { leapLand(p, q); return; }
    p.rushNX = dx / d; p.rushNY = dy / d; // steers for them
  }
  if (mv.blockedX || mv.blockedY || p.rushT <= 0) leapEnd(p);
}
function leapLand(p, q) {
  const nx = p.rushNX, ny = p.rushNY;
  leapEnd(p);
  p.vx = p.vy = 0;
  const dmg = abDmg(p, 'leap', abRk(p, 'leap', 'dmg'));
  hurtUnit(q, dmg, nx, ny, p, { kb: 30, ab: 'leap' });
  if (!q.dead) { q.packBy = p.id; q.packUntil = state.elapsed + abRk(p, 'leap', 'mark'); }
  if (PRACTICE) abHitDummies(q.x, q.y, 10, dmg);
  p.slashT = SLASH_T; p.slashA = Math.atan2(ny, nx); p.slashHalf = 0.5; // the spear driven in
  burst(q.x, unitMidY(q), '#eef4fb', 8, 50, 0.4, true);
  sfxAt('hit', q.x, q.y);
}
function leapEnd(p) {
  p.rushT = 0;
  p.dash = '';
  p.leapQ = null;
  p.vx = p.rushNX * 40; p.vy = p.rushNY * 40;
}

// ---- W HOWL ---------------------------------------------------------------------
function varroHowl(p) {
  const slow = abRk(p, 'howl', 'slow'), slowT = abRk(p, 'howl', 'slowT');
  for (const q of unitsNear(p, p.x, p.y, HOWL_R)) {
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    slowUnit(q, slowT, slow);
    if (!isAnchored(q)) { q.kbx = (q.kbx || 0) + dx / d * HOWL_KB; q.kby = (q.kby || 0) + dy / d * HOWL_KB; }
    burst(q.x, unitMidY(q), '#cfd8e8', 5, 35, 0.35, true);
  }
  for (const a of animals) if (a.summon === 'pack' && a.owner === p.id) a.howlT = HOWL_PACK_T;
  abFx.push({ kind: 'ring', x: p.x, y: p.y, r: HOWL_R, t: 0, col: '#cfd8e8', fx: 'howl', life: HOWL_FX_LIFE });
  burst(p.x, p.y - 12, '#eef4fb', 12, 55, 0.5, true);
  sfxAt('howl', p.x, p.y);
}

// ---- E SNAP ---------------------------------------------------------------------
// his mark if it stands in reach, else the rival body nearest the aim in reach
function snapTarget(p) {
  let best = null, bd = Infinity;
  for (const q of unitsHit(p, p.x, p.y, SNAP_REACH + PLAYER_R)) {
    if (lungeMarked(p, q)) return q;
    const d = Math.hypot(q.x - p.input.aimX, q.y - (q.alt || 0) - p.input.aimY);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function varroSnap(p) {
  p.snapN = 2; p.snapT = 0;
  varroStrike(p);
}
function varroStrike(p) {
  const q = snapTarget(p);
  p.snapN--;
  p.snapT = SNAP_GAP;
  if (!q) { p.snapN = 0; return; } // they got away
  const d = Math.hypot(q.x - p.x, q.y - p.y) || 1, nx = (q.x - p.x) / d, ny = (q.y - p.y) / d;
  const last = p.snapN === 0;
  const dmg = abDmg(p, 'snap', abRk(p, 'snap', 'dmg'));
  faceToward(p, nx, ny, true);
  hurtUnit(q, dmg, nx, ny, p, { kb: last ? 40 : 10, ab: 'snap' });
  if (last && !q.dead) slowUnit(q, abRk(p, 'snap', 'slowT'), abRk(p, 'snap', 'slow'));
  if (PRACTICE) abHitDummies(q.x, q.y, 10, dmg);
  p.slashT = SLASH_T; p.slashA = Math.atan2(ny, nx) + (last ? -0.3 : 0.3); p.slashHalf = 0.5;
  burst(q.x, unitMidY(q), last ? '#cfd8e8' : '#eef4fb', last ? 8 : 5, 45, 0.4, true);
  sfxAt('hit', q.x, q.y);
}

// ---- R CALL THE PACK ------------------------------------------------------------
function callTarget(p) {
  let best = null, bd = CALL_PICK;
  for (const q of players) {
    if (!enemyOf(p, q) || !unitAlive(q) || Math.hypot(q.x - p.x, q.y - p.y) > CALL_RANGE) continue;
    const d = Math.hypot(q.x - p.input.aimX, q.y - p.input.aimY);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
// where the wolves come from: the open tiles beside the pine nearest the
// hero (inside CALL_WOODS), or beside Varro when the hunt is out in the open.
// Pure position: the same ground always gives the same spots.
function callSpots(p, q) {
  const free = (tx, ty) => inWorld(tx, ty) && !objects[idx(tx, ty)] && !waterAt(tx, ty);
  const qx = Math.floor(q.x / TILE), qy = Math.floor(q.y / TILE);
  let tree = null, bd = Infinity;
  for (let dy = -CALL_WOODS; dy <= CALL_WOODS; dy++) for (let dx = -CALL_WOODS; dx <= CALL_WOODS; dx++) {
    const o = inWorld(qx + dx, qy + dy) && objects[idx(qx + dx, qy + dy)];
    if (!o || o.type !== 'tree') continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; tree = [qx + dx, qy + dy]; }
  }
  const at = tree || [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
  const out = [];
  for (let r = 1; r <= 3 && out.length < CALL_N; r++) {
    for (let dy = -r; dy <= r && out.length < CALL_N; dy++) for (let dx = -r; dx <= r && out.length < CALL_N; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !free(at[0] + dx, at[1] + dy)) continue;
      out.push([(at[0] + dx + 0.5) * TILE, (at[1] + dy + 0.5) * TILE]);
    }
  }
  while (out.length < CALL_N) out.push([p.x + (out.length - 1) * 8, p.y + 6]); // nowhere open: at his heels
  return out;
}
function varroCall(p) {
  const q = callTarget(p);
  if (!q) return;
  const rk = (k) => abRk(p, 'call', k); // the rank he called them at stays with the pack
  const bite = abDmg(p, 'call', rk('dmg')), hp = rk('wolfHp'), life = rk('t');
  for (const [x, y] of callSpots(p, q)) {
    const a = makeAnimal('wolf', x, y, { dir: q.x > x ? 'right' : 'left' });
    Object.assign(a, { team: p.team, owner: p.id, summon: 'pack', target: q, threat: 1, hp, maxHp: hp,
      bite, life, lifeMax: life, leaveT: 0, howlT: 0, level: p.level });
    animals.push(a);
    burst(x, y - 4, '#eef4fb', 8, 40, 0.45, true);
  }
  burst(q.x, q.y - 18, '#cfd8e8', 10, 45, 0.5, true);
  sfxFor(q, 'marked');
  sfxAt('howl', p.x, p.y, 320);
}
// One called wolf, one step (HERO_SUMMON.pack): run the hunted hero down and
// bite on its own rhythm; when the hero falls, leaves the ground, or the hunt
// runs out, run off and go. Its bites are his (hurtUnit with him as `src`):
// they count for his kills and name CALL THE PACK in the recap.
function wolfStep(a, dt) {
  const o = players[a.owner], q = a.target;
  a.biteCd = Math.max(0, a.biteCd - dt);
  a.howlT = Math.max(0, (a.howlT || 0) - dt);
  if (!(a.leaveT > 0) && ((a.life -= dt) <= 0 || !o || !unitAlive(q) || q.team === a.team)) { a.leaveT = CALL_LEAVE_T; navClear(a); }
  if (a.leaveT > 0) {
    if ((a.leaveT -= dt) <= 0) { a.dead = true; burst(a.x, a.y - 4, '#eef4fb', 6, 35, 0.4, true); return; }
    const away = q && q.x !== undefined ? Math.atan2(a.y - q.y, a.x - q.x) : (a.dir === 'left' ? Math.PI : 0);
    a.mvx = Math.cos(away); a.mvy = Math.sin(away);
    moveEntity(a, a.mvx * CALL_SPD * dt, a.mvy * CALL_SPD * dt, unitRadius(a));
    a.dir = a.mvx > 0 ? 'right' : 'left';
    setClip(a, 'run'); stepClip(a, dt, 1.5);
    return;
  }
  const spd = CALL_SPD * (a.howlT > 0 ? HOWL_PACK_MUL : 1);
  const near = Math.hypot(q.x - a.x, q.y - a.y);
  const n = near < CALL_REACH ? { ok: false, d: near } : navStep(a, q.x, q.y, unitRadius(a), spd, dt);
  const d = n.d || 1;
  if (!n.ok) { a.mvx = (q.x - a.x) / d; a.mvy = (q.y - a.y) / d; }
  if (d < CALL_REACH && a.biteCd <= 0) {
    a.biteCd = CALL_BITE_CD;
    if (o) hurtUnit(q, a.bite, a.mvx, a.mvy, o, { kb: 20, ab: 'call' });
    burst(a.x + a.mvx * 6, a.y - 4, '#cfd8e8', 5, 40, 0.35);
    sfxAt('bite', a.x, a.y);
  }
  if (Math.abs(a.mvx) > 0.05) a.dir = a.mvx > 0 ? 'right' : 'left';
  setClip(a, n.ok ? 'run' : 'idle');
  stepClip(a, dt, n.ok ? 1.5 : 1);
}
HERO_SUMMON.pack = { step: wolfStep };

// ---- the hooks he registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.pack = { deal: wolvesDeal, tick: varroTick, out: varroOut,
  name: 'THE PACK', blurb: 'EVERY WOLF NEAR YOU QUICKENS YOUR ATTACKS. YOUR BLOWS LAND HARDER ON THE VALLEY\'S BEASTS.', icon: VARRO_ICON32.pack };
HERO_DASH.vleap = { spd: LEAP_SPD, t: (LEAP_RANGE + 12) / LEAP_SPD, ramp: 0.03, step: leapStep, through: true };
