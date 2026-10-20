'use strict';
// BELLA, THE IMPERIAL GENERAL - a named hero (CLASSES, js/sim/player.js): a
// duelist who finds one weakness and spends it before the rival can answer.
// Her basic attacks on heroes build PRECISION; her keys dash, parry, slip
// through a rival and call a duel. Loaded before abilities.js, whose CLASS_AB
// takes BELLA_AB as her row of keys; she registers into the shared hero hooks
// (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ bella

// ---- tuning --------------------------------------------------------------
// CALCULATED STRIKES (the passive): her basic attacks on rival heroes stack
// it; full, the first blow her next key lands consumes it for bonus damage
// and a burst of speed. It drops away out of a fight.
const PREC_MAX = 3;             // hero hits to fill it
const PREC_IDLE = 5;            // s without a hero hit before the stacks fall away
const EDGE_DMG = 8;             // the bonus on a consuming key's blows...
const EDGE_AD = 0.3;            // ...plus this share of her DAMAGE stat
const EDGE_T = 0.4;             // s every blow of that key keeps the bonus (a dash's whole path, a flurry's start)
const EDGE_MS = 1.35, EDGE_MS_T = 1.5; // the burst: walk x1.35 for 1.5 s
// Q FIRST CUT: a short dash, slashing every rival body on its path
const LUNGE_LEN = 56;           // px
const LUNGE_SPD = 360;          // px/s
const LUNGE_R = 9;              // px either side of the path that the blade reaches
const LUNGE_REFUND = 0.6;       // share of the cooldown a hero hit gives back
// W PERFECT PARRY: a short stance; the first rival hero blow inside it is
// mostly turned aside and answered with a riposte that stuns
const PARRY_T = 0.75;           // s the stance holds
const PARRY_CUT = 0.75;         // share of that blow the parry takes off
const PARRY_REACH = 56;         // px the riposte reaches (a shot from further is only turned)
const PARRY_STUN = 0.9;
// E OUTMANEUVER: slip through a rival body near the aim, cut it, mark it;
// her next basic attack on the mark hits harder
const OUT_RANGE = 72;           // px from her to the body she slips through
const OUT_PICK = 28;            // px from the aim a body may stand and still be the one
const OUT_PAST = 14;            // px past it she comes out
const OUT_SPD = 420;
const OUT_DMG = 8;
const OUT_MARK_T = 4;           // s the mark waits for her blade
const OUT_BONUS_AD = 0.4;        // the marked blow's extra (its rank's markDmg) adds this share of her DAMAGE
// R THE FINAL GAMBIT: mark a rival hero for a duel; running at them is quicker,
// and the key again lunges in and lands the flurry, its finish worth more the
// less life they have left
const DUEL_RANGE = 140;         // px to the hero she can call out
const DUEL_PICK = 40;           // px from the aim
const DUEL_T = 5;               // s the duel lasts
const DUEL_MS = 1.3;            // walk toward them x1.3
const FLURRY_REACH = 64;        // px the key again can close (a short lunge in)
const FLURRY_N = 3, FLURRY_GAP = 0.12; // three strikes, this far apart
const FLURRY_DMG = 9;
const FINISH_MISSING = 0.3;     // ...plus this share of the life they are missing

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js):
// `ok` says whether a press may start at all (E and R need a body at the aim),
// `recast` that the key pressed again is the second half (the flurry).
const BELLA_AB = [
  {
    id: 'lunge', name: 'FIRST CUT', cd: [7, 6.5, 6, 5.5, 5], ap: 0.5, cast: 0.12, aim: { line: LUNGE_LEN },
    rank: { dmg: [12, 17, 22, 27, 32] },
    tip: 'DASH AND CUT. A HERO HIT CUTS THE WAIT',
    blurb: 'DASH A SHORT LINE AND CUT EVERY RIVAL IN THE PATH. HITTING A HERO GIVES BACK MOST OF THE COOLDOWN.',
    use: (p) => bellaLunge(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), teleLen(p.x, p.y, Math.cos(a), Math.sin(a), LUNGE_LEN), col, 0.5 + 0.45 * closing, now, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? 1 : 0, rot: 0.18 * (p.dir === 'left' ? -1 : 1) }), // low, coiled
    icon: BELLA_ICON32.firstcut,
    bot: (p, foe, d, clear) => clear && d > 14 && d < LUNGE_LEN + 4,
  },
  {
    id: 'parry', name: 'PERFECT PARRY', cd: [10, 9.5, 9, 8.5, 8], ap: 0.5, cast: 0.05,
    rank: { dmg: [14, 19, 24, 29, 34], stun: PARRY_STUN, t: PARRY_T, cut: PARRY_CUT }, // dmg/stun: the riposte
    tip: 'PARRY A HERO. RIPOSTE AND STUN',
    blurb: 'A SHORT STANCE. THE FIRST HERO WHO STRIKES YOU IN IT IS TURNED ASIDE AND ANSWERED: A RIPOSTE THAT STUNS.',
    use: (p) => bellaParry(p),
    acol: '#f2cc6a', activeF: (p) => (p.parryT > 0 ? p.parryT / PARRY_T : 0),
    icon: BELLA_ICON32.parry,
    bot: (p, foe, d) => foe instanceof Player && d < PARRY_REACH && bellaThreat(foe),
  },
  {
    id: 'slip', name: 'OUTMANEUVER', cd: [9, 8.5, 8, 7.5, 7], ap: 0.4, cast: 0.1, aim: { line: OUT_RANGE },
    rank: { markDmg: [12, 18, 24, 30, 36], dmg: OUT_DMG, mark: OUT_MARK_T }, // markDmg: the marked blow's extra, + OUT_BONUS_AD of her DAMAGE
    tip: 'SLIP THROUGH AND MARK. HIT THE MARK',
    blurb: 'SLIP THROUGH THE RIVAL AT THE AIM, CUTTING AND MARKING THEM. YOUR NEXT ATTACK ON THE MARK HITS HARDER.',
    use: (p) => bellaSlip(p),
    ok: (p) => !!slipTarget(p),
    pose: () => ({ dx: 0, dy: 1, rot: 0 }),
    icon: BELLA_ICON32.outmaneuver,
    bot: (p, foe, d) => d < OUT_RANGE - 8 && !(p.duelT > 0 && foe.id !== p.duelId),
  },
  {
    id: 'gambit', name: 'THE FINAL GAMBIT', cd: [70, 60, 50], cast: 0.2, aim: { ring: DUEL_RANGE },
    rank: { dmg: [18, 30, 42], missing: FINISH_MISSING, t: DUEL_T }, // dmg/missing: the finisher; each strike before it FLURRY_DMG
    tip: 'DUEL A HERO. AGAIN TO FINISH THEM',
    blurb: 'CALL OUT THE RIVAL HERO AT THE AIM. YOU RUN AT THEM FASTER. PRESS AGAIN TO LUNGE IN AND STRIKE: THE LAST BLOW IS WORTH MORE THE LESS LIFE THEY HAVE.',
    use: (p) => (p.castSlam ? bellaFlurry(p) : bellaDuel(p)),
    ok: (p) => (p.duelT > 0 ? !!flurryTarget(p) : !!duelTarget(p)),
    recast: (p) => p.duelT > 0,
    acol: '#f2cc6a', activeF: (p) => (p.duelT > 0 ? p.duelT / DUEL_T : 0),
    pose: () => ({ dx: 0, dy: 1, rot: 0 }),
    icon: BELLA_ICON32.gambit,
    bot: (p, foe, d) => (p.duelT > 0
      ? foe.id === p.duelId && d < FLURRY_REACH - 6
      : foe instanceof Player && d < DUEL_RANGE - 20 && foe.hp < foe.maxHp * 0.65),
  },
];
// is this rival mid-blow (the moment a parry pays): a swing, a draw or a cast
function bellaThreat(q) { return q.slashT > 0 || q.charging || q.castT > 0 || q.rushT > 0; }

// ---- CALCULATED STRIKES -------------------------------------------------------
// The blow hook (HERO_PASSIVE `deal`, js/sim/heroes.js): every blow she lands
// passes through here before it lands, and leaves with what it is worth.
function precisionDeal(p, q, dmg, o) {
  if (o.basic) {
    if (q instanceof Player && q.team !== p.team) {
      p.precIdle = 0;
      if (p.prec < PREC_MAX && ++p.prec === PREC_MAX) { burst(p.x, p.y - 12, '#f2cc6a', 8, 40, 0.45, true); sfxFor(p, 'pickup'); }
    }
    if (q.outBy === p.id && state.elapsed < q.outUntil) { // OUTMANEUVER's mark, spent
      q.outBy = -1;
      dmg += Math.round(abRk(p, 'slip', 'markDmg') + statOf(p, 'dmg') * OUT_BONUS_AD);
      burst(q.x, unitMidY(q), '#f2cc6a', 8, 50, 0.4, true);
    }
    return dmg;
  }
  if (!o.ab) return dmg;
  if (!(p.edgeT > 0) && p.prec >= PREC_MAX) { // the key's first blow consumes the stacks
    p.prec = 0;
    p.edgeT = EDGE_T;
    p.edgeMsT = EDGE_MS_T;
    burst(p.x, p.y - 8, '#f2cc6a', 10, 55, 0.45, true);
    sfxAt('nock', p.x, p.y);
  }
  return p.edgeT > 0 ? dmg + Math.round(EDGE_DMG + statOf(p, 'dmg') * EDGE_AD) : dmg;
}
// her clocks, one sim step: the stacks falling away, the edge and the burst,
// the parry's stance and its riposte, the duel and its flurry
function bellaTick(p, dt) {
  if (p.prec > 0 && (p.precIdle += dt) > PREC_IDLE) p.prec = 0;
  if (p.edgeT > 0) p.edgeT = Math.max(0, p.edgeT - dt);
  if (p.edgeMsT > 0) p.edgeMsT = Math.max(0, p.edgeMsT - dt);
  if (p.parryT > 0) p.parryT = Math.max(0, p.parryT - dt);
  if (p.riposteId >= 0) bellaRiposte(p);
  if (p.duelT > 0) {
    const q = players[p.duelId];
    p.duelT = q && unitAlive(q) ? Math.max(0, p.duelT - dt) : 0;
  }
  if (p.flurryArm && !(p.rushT > 0)) p.flurryArm = false; // the lunge in was cut short (a stun, the water): no flurry
  if (p.flurryN > 0 && (p.flurryT -= dt) <= 0) bellaStrike(p);
}
// what her walk is worth (HERO_MOVE): the passive's burst, and running at the
// hero she called out
function bellaMoveMul(p) {
  if (CLASSES[p.cls].passive !== 'calculated') return 1;
  let m = p.edgeMsT > 0 ? EDGE_MS : 1;
  if (p.duelT > 0) {
    const q = players[p.duelId], mx = p.input.mx, my = p.input.my;
    if (q && (mx || my) && (q.x - p.x) * mx + (q.y - p.y) * my > 0.5 * Math.hypot(q.x - p.x, q.y - p.y) * Math.hypot(mx, my)) m *= DUEL_MS;
  }
  return m;
}

// ---- Q FIRST CUT ----------------------------------------------------------------
// The dash rides the charge state (rushT, HERO_DASH: js/sim/heroes.js) at its
// own pace; every rival body (and building) the blade passes is cut once.
function bellaLunge(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  bellaDash(p, 'lunge', dx / d, dy / d, LUNGE_LEN / LUNGE_SPD);
  p.lungeKey = abKeyOf(p, 'lunge');
  burst(p.x, p.y + 4, '#dfe8f4', 6, 40, 0.35, true);
  sfxAt('dodge', p.x, p.y);
}
function bellaDash(p, kind, nx, ny, t) {
  p.rushNX = nx; p.rushNY = ny;
  p.rushT = t;
  p.rushVictim = null;
  p.dash = kind;
  p.lungeHit.length = 0;
  p.sliding = false;
  faceToward(p, nx, ny, true);
}
function lungeStep(p, mv, dt) {
  p.rushFxT = (p.rushFxT || 0) - dt;
  if (p.rushFxT <= 0) { p.rushFxT = 0.03; burst(p.x - p.rushNX * 4, p.y + 3, '#eef4fb', 2, 25, 0.3, true); }
  for (const q of unitsHit(p, p.x + p.rushNX * 4, p.y + p.rushNY * 4, LUNGE_R + PLAYER_R)) {
    if (p.lungeHit.includes(q)) continue;
    p.lungeHit.push(q);
    hurtUnit(q, abDmg(p, 'lunge', abRk(p, 'lunge', 'dmg')), p.rushNX, p.rushNY, p, { kb: 40, ab: 'lunge' });
    burst(q.x, unitMidY(q), '#eef4fb', 6, 45, 0.4, true);
    sfxAt('hit', q.x, q.y);
    if (q instanceof Player && p.lungeKey >= 0) { // a hero cut: most of the wait given back, once
      p.abCd[p.lungeKey] *= 1 - LUNGE_REFUND;
      p.lungeKey = -1;
      burst(p.x, p.y - 10, '#f2cc6a', 6, 40, 0.35, true);
    }
  }
  for (const s of structsNear(p, p.x + p.rushNX * 6, p.y + p.rushNY * 6, LUNGE_R)) {
    if (p.lungeHit.includes(s)) continue;
    p.lungeHit.push(s);
    hurtStruct(s, abDmg(p, 'lunge', abRk(p, 'lunge', 'dmg')), p);
  }
  if (mv.blockedX || mv.blockedY || p.rushT <= 0) bellaDashEnd(p);
}
function bellaDashEnd(p) {
  if (PRACTICE && p.dash === 'lunge') abHitDummies(p.x, p.y, LUNGE_R + 6, abDmg(p, 'lunge', abRk(p, 'lunge', 'dmg')));
  const slip = p.dash === 'slip';
  p.rushT = 0;
  p.dash = '';
  p.lungeHit.length = 0;
  p.vx = p.rushNX * 50; p.vy = p.rushNY * 50;
  if (slip && p.flurryArm) { p.flurryArm = false; p.flurryN = FLURRY_N; p.flurryT = 0; } // the gambit's lunge in, landed: strike
}

// ---- W PERFECT PARRY -------------------------------------------------------------
function bellaParry(p) {
  p.parryT = PARRY_T;
  burst(p.x, p.y - 8, '#eef4fb', 6, 30, 0.3, true);
}
// a blow on her in the stance (HERO_TAKEN, js/sim/heroes.js): a rival hero's is
// mostly turned aside and ends the stance, and the riposte is owed to them
// (bellaTick pays it, outside the blow that is still landing)
function parryTaken(p, dmg, dx, dy, src) {
  if (!(p.parryT > 0) || !(src instanceof Player) || src.team === p.team || dmg <= 0) return dmg;
  p.parryT = 0;
  p.riposteId = src.id;
  burst(p.x, p.y - 10, '#ffffff', 8, 50, 0.35, true);
  burst(p.x, p.y - 10, '#f2cc6a', 6, 40, 0.4, true);
  sfxAt('shieldBreak', p.x, p.y);
  return Math.max(1, Math.round(dmg * (1 - PARRY_CUT)));
}
function bellaRiposte(p) {
  const q = players[p.riposteId];
  p.riposteId = -1;
  if (!q || !unitAlive(q) || q.team === p.team || Math.hypot(q.x - p.x, q.y - p.y) > PARRY_REACH + PLAYER_R) return;
  const d = Math.hypot(q.x - p.x, q.y - p.y) || 1, nx = (q.x - p.x) / d, ny = (q.y - p.y) / d;
  faceToward(p, nx, ny, true);
  hurtUnit(q, abDmg(p, 'parry', abRk(p, 'parry', 'dmg')), nx, ny, p, { kb: 60, ab: 'parry' });
  if (!q.dead) stunUnit(q, PARRY_STUN, p);
  p.slashT = SLASH_T; p.slashA = Math.atan2(ny, nx); p.slashHalf = 0.9; // the blade answers through the arc
  abFx.push({ kind: 'line', x: p.x, y: p.y - 2, a: p.slashA, r: d, half: 3, t: 0, col: '#ffd95c' });
  burst(q.x, unitMidY(q), '#ffd95c', 10, 55, 0.45, true);
  shakeFor(p, 4, q);
  sfxAt('hit', q.x, q.y);
}

// ---- E OUTMANEUVER -----------------------------------------------------------------
// the rival body her slip would go through: the nearest to the aim within
// OUT_PICK of it and OUT_RANGE of her - any kind of body unitsHit lists
function slipTarget(p) {
  let best = null, bd = OUT_PICK;
  for (const q of unitsHit(p, p.x, p.y, OUT_RANGE)) {
    const d = Math.hypot(q.x - p.input.aimX, q.y - (q.alt || 0) - p.input.aimY);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function bellaSlip(p) {
  const q = slipTarget(p);
  if (!q) { burst(p.x, p.y + 2, '#cfd8e8', 4, 25, 0.3, true); return; } // it stepped away mid-cast: the slip finds nothing
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
  hurtUnit(q, abDmg(p, 'slip', OUT_DMG), nx, ny, p, { kb: 0, ab: 'slip' });
  if (!q.dead) { q.outBy = p.id; q.outUntil = state.elapsed + OUT_MARK_T; }
  p.flurryArm = false;
  bellaDash(p, 'slip', nx, ny, (d + OUT_PAST) / OUT_SPD);
  burst(q.x, unitMidY(q), '#eef4fb', 8, 45, 0.4, true);
  sfxAt('dodge', p.x, p.y);
}
function slipStep(p, mv) { if (mv.blockedX || mv.blockedY || p.rushT <= 0) bellaDashEnd(p); }

// ---- R THE FINAL GAMBIT -------------------------------------------------------------
function duelTarget(p) {
  let best = null, bd = DUEL_PICK;
  for (const q of players) {
    if (!enemyOf(p, q) || !unitAlive(q) || Math.hypot(q.x - p.x, q.y - p.y) > DUEL_RANGE) continue;
    const d = Math.hypot(q.x - p.input.aimX, q.y - p.input.aimY);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function flurryTarget(p) {
  const q = players[p.duelId];
  return q && unitAlive(q) && Math.hypot(q.x - p.x, q.y - p.y) <= FLURRY_REACH ? q : null;
}
function bellaDuel(p) {
  const q = duelTarget(p);
  if (!q) return;
  p.duelId = q.id;
  p.duelT = DUEL_T;
  burst(q.x, q.y - 18, '#f2cc6a', 10, 45, 0.5, true);
  sfxFor(q, 'marked');
  sfxAt('place', p.x, p.y);
}
// the key again: a short lunge in beside them (the slip's pace), then the
// flurry, struck from bellaTick
function bellaFlurry(p) {
  p.castSlam = false;
  const q = flurryTarget(p);
  p.duelT = 0;
  if (!q) return;
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
  const go = Math.max(0, d - PLAYER_R * 2 - 2);
  if (go < 6) { p.flurryN = FLURRY_N; p.flurryT = 0; p.flurryId = q.id; return; }
  p.flurryArm = true; p.flurryId = q.id;
  bellaDash(p, 'slip', dx / d, dy / d, go / OUT_SPD);
}
function bellaStrike(p) {
  const q = players[p.flurryId];
  p.flurryN--;
  p.flurryT = FLURRY_GAP;
  if (!q || !unitAlive(q) || Math.hypot(q.x - p.x, q.y - p.y) > FLURRY_REACH / 2) { p.flurryN = 0; return; } // they got away
  const d = Math.hypot(q.x - p.x, q.y - p.y) || 1, nx = (q.x - p.x) / d, ny = (q.y - p.y) / d;
  const last = p.flurryN === 0;
  const dmg = last
    ? abDmg(p, 'gambit', abRk(p, 'gambit', 'dmg')) + Math.round(Math.max(0, q.maxHp - q.hp) * FINISH_MISSING)
    : abDmg(p, 'gambit', FLURRY_DMG);
  faceToward(p, nx, ny, true);
  hurtUnit(q, dmg, nx, ny, p, { kb: last ? 90 : 0, kbMul: last ? 1 : 0, ab: 'gambit', crit: last }); // (held in place until the finish throws them)
  p.slashT = SLASH_T; p.slashA = Math.atan2(ny, nx) + (p.flurryN % 2 ? 0.5 : -0.5); p.slashHalf = 0.8;
  abFx.push({ kind: 'wedge', x: p.x, y: p.y - 2, a: Math.atan2(ny, nx), r: d + 6, half: last ? 0.6 : 0.35, t: 0, col: last ? '#ffd95c' : '#eef4fb' });
  burst(q.x, unitMidY(q), last ? '#ffd95c' : '#eef4fb', last ? 12 : 6, last ? 60 : 45, 0.45, true);
  shakeFor(p, last ? 5 : 2, q);
  sfxAt(last ? 'break_' : 'hit', q.x, q.y);
}

// her stacks and stances, off a body that leaves the fight (passiveOut, bodyOut)
function bellaOut(p) {
  p.prec = 0; p.edgeT = 0; p.edgeMsT = 0; p.lungeHit.length = 0; p.parryT = 0; p.riposteId = -1;
  p.duelT = 0; p.flurryN = 0; p.flurryArm = false;
}

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.calculated = { deal: precisionDeal, tick: bellaTick, out: bellaOut,
  name: 'CALCULATED STRIKES', blurb: 'YOUR ATTACKS ON HEROES BUILD PRECISION. FULL, YOUR NEXT KEY HITS HARDER AND YOU RUN FASTER FOR A MOMENT.', icon: BELLA_ICON32.precision };
HERO_TAKEN.push(parryTaken);
HERO_MOVE.push(bellaMoveMul);
HERO_DASH.lunge = { spd: LUNGE_SPD, t: LUNGE_LEN / LUNGE_SPD, ramp: 0.03, step: lungeStep, through: true };
HERO_DASH.slip = { spd: OUT_SPD, t: 0.2, ramp: 0.02, step: slipStep, through: true };
