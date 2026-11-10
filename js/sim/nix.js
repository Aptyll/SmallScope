'use strict';
// NIX, THE SNOWBLIND - a named hero (CLASSES, js/sim/player.js): the valley's
// night scout, an assassin of skill and weather, never of magic. She throws
// down a cloud of snow powder and moves unseen inside it, closes on a rival
// she has marked with a thrown shard, and is fastest when the night comes.
// Loaded before abilities.js, whose CLASS_AB takes NIX_AB as her row of keys;
// she registers into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ nix

// ---- tuning --------------------------------------------------------------
// NIGHT WATCH (the passive): she walks faster the darker it is, and the first
// blow she lands on a rival hero after being hidden (her cloud, SQUALL, or
// simply out of their side's sight) hits harder, more at night
const WATCH_MS = 0.12;          // walk x (1 + this x darkness)
const WATCH_DMG = 10;           // the hidden blow's extra...
const WATCH_AD = 0.45;          // ...plus this share of her DAMAGE...
const WATCH_NIGHT = 0.5;        // ...all x (1 + this x darkness)
// Q ICE SHARD: a shard thrown down the aim; the first rival takes it, and it
// flies back to her hand. Caught, its wait is shorter.
const SHARD_LEN = 120;          // px out
const SHARD_SPD = 330;          // px/s out
const SHARD_BACK = 300;         // px/s home
const SHARD_R = 6;              // px round it a body is struck
const SHARD_CATCH = 12;         // px from her it is caught
const SHARD_REFUND = 0.4;       // share of the wait a catch gives back
// W SNOW CLOUD: a cloud of snow powder thrown down at her feet. Inside it she
// is hidden from a side unless one of its heroes or soldiers stands in it too;
// a blow struck from inside shows her for a moment.
const CLOUD_R = 38;             // px of cloud
const CLOUD_OUT = 1;            // s a blow from inside shows her
// E DRIFT STEP: a quick step to a rival she struck in the last few seconds,
// coming out behind them
const DRIFT_STEP_RANGE = 110;        // px to the rival
const DRIFT_STEP_PICK = 30;          // px from the aim it may stand
const DRIFT_STEP_MEM = 3;         // s a struck rival stays one she can step to
const DRIFT_STEP_SPD = 520;          // px/s
const DRIFT_STEP_PAST = 12;          // px past them she comes out
// R SQUALL: she vanishes into a burst of snow, untouchable for a moment,
// then strikes the nearest rival hero. If that hero falls within a few
// seconds, the key is ready again, once.
const WHITEOUT_T = 0.9;            // s untouchable and hidden
const WHITE_REACH = 130;        // px the strike finds a hero from
const WHITE_AD = 0.7;           // the strike adds this share of her DAMAGE
const WHITE_RESET = 3;          // s the struck hero has to fall for the key to come back

const nixShards = []; // {x, y, nx, ny, d, len, back, team, owner, dmg, hit} - Q's shards in flight
const nixClouds = []; // {x, y, team, owner, t, life} - W's clouds on the ground (each carries its caster's rank)

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const NIX_AB = [
  {
    id: 'shard', name: 'ICE SHARD', cd: [7, 6.5, 6, 5.5, 5], ap: 0.5, cast: 0.15, aim: { line: SHARD_LEN },
    rank: { dmg: [18, 27, 36, 45, 54] },
    tip: 'THROW A SHARD. CATCH IT TO THROW SOONER',
    blurb: 'THROW A SHARD OF ICE DOWN A LINE. THE FIRST RIVAL IT HITS TAKES THE BLOW, AND THE SHARD FLIES BACK TO YOU. CATCH IT AND ITS COOLDOWN IS SHORTER.',
    use: (p) => nixShard(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), teleLen(p.x, p.y, Math.cos(a), Math.sin(a), SHARD_LEN), col, 0.5 + 0.45 * closing, now, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? -1 : 1, rot: 0 }), // the arm back, then the throw
    icon: NIX_ICON32.shard,
    bot: (p, foe, d, clear) => clear && d > 20 && d < SHARD_LEN - 6,
  },
  {
    id: 'cloud', name: 'SNOW CLOUD', cd: [18, 17, 16, 15, 14], cast: 0.1,
    rank: { t: [3.5, 4, 4.5, 5, 5.5] }, // s the cloud stands
    tip: 'A SNOW CLOUD. INSIDE IT YOU ARE HIDDEN',
    blurb: 'THROW DOWN A CLOUD OF SNOW POWDER AT YOUR FEET. INSIDE IT YOU ARE HIDDEN FROM RIVALS WHO ARE NOT IN IT TOO. STRIKING FROM IT SHOWS YOU FOR A MOMENT.',
    use: (p) => nixCloud(p),
    acol: '#dfe8f4', activeF: (p) => { const c = nixCloudOf(p); return c ? 1 - c.t / c.life : 0; },
    pose: () => ({ dx: 0, dy: 1, rot: 0 }),
    icon: NIX_ICON32.cloud,
    bot: (p, foe, d) => foe instanceof Player && d < 90 && !nixCloudOf(p),
  },
  {
    id: 'drift', name: 'DRIFT STEP', cd: [12, 11, 10, 9, 8], ap: 0.4, cast: 0.05, aim: { line: DRIFT_STEP_RANGE },
    rank: { dmg: [10, 16, 22, 28, 34] },
    tip: 'STEP BEHIND A RIVAL YOU JUST HIT',
    blurb: 'STEP QUICKLY TO A RIVAL YOU HIT IN THE LAST FEW SECONDS AND COME OUT BEHIND THEM WITH A CUT.',
    use: (p) => nixDrift(p),
    ok: (p) => !!driftTarget(p),
    pose: () => ({ dx: 0, dy: 1, rot: 0 }),
    icon: NIX_ICON32.drift,
    bot: (p, foe, d) => d > 24 && d < DRIFT_STEP_RANGE && foe.nixBy === p.id && state.elapsed < foe.nixUntil,
    botAim: (p, foe) => ({ x: foe.x, y: foe.y }),
  },
  {
    id: 'whiteout', name: 'SQUALL', cd: [80, 65, 50], ap: 0.8, cast: 0.05,
    rank: { dmg: [60, 95, 130] }, // the strike, + WHITE_AD of her DAMAGE
    tip: 'VANISH, THEN STRIKE THE NEAREST HERO',
    blurb: 'VANISH INTO A BURST OF SNOW, HIDDEN AND UNTOUCHABLE FOR A MOMENT, THEN STRIKE THE NEAREST RIVAL HERO. IF THEY FALL SOON AFTER, SQUALL IS READY AGAIN, ONCE.',
    use: (p) => nixWhiteout(p),
    acol: '#ffffff', activeF: (p) => (p.nixWhiteT > 0 ? p.nixWhiteT / WHITEOUT_T : 0),
    icon: NIX_ICON32.whiteout,
    bot: (p, foe, d) => foe instanceof Player && d < WHITE_REACH - 20 && (foe.hp < foe.maxHp * 0.6 || p.hp < p.maxHp * 0.3),
  },
];

// ---- hidden -----------------------------------------------------------------------
// the cloud she stands in, if one of hers stands round her
function nixCloudOf(p) {
  for (const c of nixClouds) if (c.owner === p.id && c.team === p.team && Math.hypot(p.x - c.x, p.y - c.y) <= CLOUD_R) return c;
  return null;
}
// The cover rule she adds to the fog (HERO_COVER, js/sim/heroes.js): a Nix
// vanishing is hidden from every side; one in her own cloud is hidden from a
// side none of whose heroes or soldiers stands inside it, unless she struck a
// blow a moment ago
function nixCover(srcs, x, y, u) {
  if (!(u instanceof Player) || CLASSES[u.cls].passive !== 'nightwatch') return false;
  if (u.nixWhiteT > 0) return true;
  if (u.nixOutT > 0) return false;
  const c = nixCloudOf(u);
  if (!c) return false;
  for (const s of srcs) if (s.near && Math.hypot(s.x - c.x, s.y - c.y) <= CLOUD_R) return false;
  return true;
}
// is she hidden from the other side right now (what NIGHT WATCH's blow waits for)
function nixHidden(p) {
  if (p.nixWhiteT > 0) return true;
  if (nixCloudOf(p) && !(p.nixOutT > 0)) return true;
  return fogUp() && !inSight(1 - p.team, p);
}

// ---- NIGHT WATCH ------------------------------------------------------------------
// The blow hook (HERO_PASSIVE `deal`): any blow she lands from her cloud shows
// her for a moment; the first on a rival hero after being hidden hits harder.
function watchDeal(p, q, dmg, o) {
  if (!(o.basic || o.ab)) return dmg;
  if (nixCloudOf(p)) p.nixOutT = CLOUD_OUT;
  if (p.nixAmbush && q instanceof Player && q.team !== p.team) {
    p.nixAmbush = false;
    burst(q.x, unitMidY(q), '#ffffff', 10, 55, 0.45, true);
    sfxAt('nock', q.x, q.y);
    dmg += Math.round((WATCH_DMG + statOf(p, 'dmg') * WATCH_AD) * (1 + WATCH_NIGHT * (state.darkness || 0)));
  }
  // a rival she struck is one her DRIFT STEP can reach, for a few seconds
  if (unitTeam(q) !== p.team) { q.nixBy = p.id; q.nixUntil = state.elapsed + DRIFT_STEP_MEM; }
  return dmg;
}
// her clocks, one sim step
function nixTick(p, dt) {
  if (p.nixOutT > 0) p.nixOutT = Math.max(0, p.nixOutT - dt);
  if (nixHidden(p)) p.nixAmbush = true; // hidden once is enough: the blow keeps until it lands
  if (p.nixWhiteT > 0 && (p.nixWhiteT -= dt) <= 0) { p.nixWhiteT = 0; nixWhiteStrike(p); }
  if (p.nixResetT > 0) {
    p.nixResetT = Math.max(0, p.nixResetT - dt);
    const q = players[p.nixStrikeId];
    if (q && q.dead) { // the hero SQUALL struck has fallen: the key comes back, once
      p.nixResetT = 0;
      const k = abKeyOf(p, 'whiteout');
      if (k >= 0) p.abCd[k] = 0;
      p.nixRecast = true;
      burst(p.x, p.y - 12, '#ffffff', 12, 50, 0.5, true);
      sfxFor(p, 'pickup');
    }
  }
}
// what her walk is worth (HERO_MOVE): more the darker the valley
function nixMoveMul(p) {
  if (CLASSES[p.cls].passive !== 'nightwatch') return 1;
  return 1 + WATCH_MS * (state.darkness || 0);
}
function nixOut(p) {
  p.nixOutT = 0; p.nixWhiteT = 0; p.nixAmbush = false; p.nixResetT = 0; p.nixRecast = false;
  for (let i = nixClouds.length - 1; i >= 0; i--) if (nixClouds[i].owner === p.id) nixClouds.splice(i, 1);
}

// ---- Q ICE SHARD -----------------------------------------------------------------
function nixShard(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y), d = Math.hypot(dx, dy) || 1;
  nixShards.push({ x: p.x, y: p.y - BOW_Y, nx: dx / d, ny: dy / d, d: 0, len: SHARD_LEN, back: false,
    team: p.team, owner: p.id, dmg: abDmg(p, 'shard', abRk(p, 'shard', 'dmg')), hit: false });
  sfxAt('dodge', p.x, p.y);
}
function nixSrc(w) { const o = players[w.owner]; return o && o.team === w.team && unitAlive(o) ? o : null; }
// out down the aim until it strikes the first rival, a tree or a rock, or runs
// its length; then home to her hand, and caught there
function updateNixShards(dt) {
  for (let i = nixShards.length - 1; i >= 0; i--) {
    const s = nixShards[i], o = nixSrc(s);
    if (!s.back) {
      const step = Math.min(SHARD_SPD * dt, s.len - s.d);
      s.x += s.nx * step; s.y += s.ny * step; s.d += step;
      const q = unitsHit(sideOf(s), s.x, s.y + BOW_Y, SHARD_R + PLAYER_R)[0];
      const st = q ? null : structsNear(sideOf(s), s.x, s.y + BOW_Y, SHARD_R)[0];
      if (q) hurtUnit(q, s.dmg, s.nx, s.ny, o, { kb: 30, ab: 'shard' });
      if (st) hurtStruct(st, s.dmg, o);
      if (q || st) { s.hit = true; burst(s.x, s.y, '#bfe6f8', 8, 45, 0.4, true); sfxAt('hit', s.x, s.y); }
      if (s.hit || s.d >= s.len || isSolidTile(Math.floor(s.x / TILE), Math.floor((s.y + BOW_Y) / TILE))) {
        s.back = true;
        if (PRACTICE && !s.hit) abHitDummies(s.x, s.y + BOW_Y, SHARD_R + 4, s.dmg);
      }
      continue;
    }
    if (!o) { burst(s.x, s.y, '#bfe6f8', 4, 30, 0.3, true); nixShards.splice(i, 1); continue; }
    const tx = o.x - s.x, ty = o.y - BOW_Y - s.y, d = Math.hypot(tx, ty) || 1;
    if (d <= SHARD_CATCH) { // caught: the wait is shorter
      const k = abKeyOf(o, 'shard');
      if (k >= 0) o.abCd[k] *= 1 - SHARD_REFUND;
      burst(o.x, o.y - 10, '#bfe6f8', 6, 35, 0.35, true);
      sfxFor(o, 'pickup');
      nixShards.splice(i, 1);
      continue;
    }
    const step = Math.min(SHARD_BACK * dt, d);
    s.nx = tx / d; s.ny = ty / d;
    s.x += s.nx * step; s.y += s.ny * step;
  }
}

// ---- W SNOW CLOUD -----------------------------------------------------------------
function nixCloud(p) {
  for (let i = nixClouds.length - 1; i >= 0; i--) if (nixClouds[i].owner === p.id) nixClouds.splice(i, 1); // one cloud at a time
  nixClouds.push({ x: p.x, y: p.y, team: p.team, owner: p.id, t: 0, life: abRk(p, 'cloud', 't') });
  p.nixOutT = 0;
  burst(p.x, p.y - 4, '#eef4fb', 22, 70, 0.6, true);
  burst(p.x, p.y, '#dfe8f4', 12, 45, 0.7, true);
  sfxAt('splash', p.x, p.y);
}
function updateNixClouds(dt) {
  for (let i = nixClouds.length - 1; i >= 0; i--) {
    const c = nixClouds[i];
    if ((c.t += dt) >= c.life) { burst(c.x, c.y, '#eef4fb', 10, 30, 0.5, true); nixClouds.splice(i, 1); }
  }
}

// ---- E DRIFT STEP -----------------------------------------------------------------
// the rival she can step to: one she struck in the last few seconds, nearest the aim
function driftTarget(p) {
  let best = null, bd = DRIFT_STEP_PICK;
  for (const q of unitsHit(p, p.x, p.y, DRIFT_STEP_RANGE)) {
    if (q.nixBy !== p.id || !(state.elapsed < q.nixUntil)) continue;
    const d = Math.hypot(q.x - p.input.aimX, q.y - (q.alt || 0) - p.input.aimY);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function nixDrift(p) {
  const q = driftTarget(p);
  if (!q) { burst(p.x, p.y + 2, '#cfd8e8', 4, 25, 0.3, true); return; }
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
  hurtUnit(q, abDmg(p, 'drift', abRk(p, 'drift', 'dmg')), nx, ny, p, { kb: 0, ab: 'drift' });
  p.rushNX = nx; p.rushNY = ny;
  p.rushT = (d + DRIFT_STEP_PAST) / DRIFT_STEP_SPD;
  p.nixDriftId = q instanceof Player ? q.id : -1; // a hero may move: she comes out behind where it is then
  p.nixDriftX = q.x + nx * DRIFT_STEP_PAST; p.nixDriftY = q.y + ny * DRIFT_STEP_PAST;
  p.dash = 'drift';
  p.sliding = false;
  faceToward(p, nx, ny, true);
  burst(p.x, p.y - 4, '#eef4fb', 10, 45, 0.4, true);
  sfxAt('dodge', p.x, p.y);
}
function driftEnd(p) {
  p.rushT = 0; p.dash = '';
  // out behind them: a body between her and the spot does not stop the step
  // (a wall or the water does, where the dash itself stopped)
  const q = p.nixDriftId >= 0 ? players[p.nixDriftId] : null;
  const bx = q && unitAlive(q) ? q.x + p.rushNX * DRIFT_STEP_PAST : p.nixDriftX, by = q && unitAlive(q) ? q.y + p.rushNY * DRIFT_STEP_PAST : p.nixDriftY;
  if (Math.hypot(bx - p.x, by - p.y) < DRIFT_STEP_PAST * 3 && !isSolidTile(Math.floor(bx / TILE), Math.floor(by / TILE)) && !waterAt(Math.floor(bx / TILE), Math.floor(by / TILE))) { p.x = bx; p.y = by; }
  p.vx = -p.rushNX * 20; p.vy = -p.rushNY * 20;
  faceToward(p, -p.rushNX, -p.rushNY, true); // out behind them, turned to face them
  burst(p.x, p.y - 4, '#eef4fb', 8, 40, 0.4, true);
}

// ---- R SQUALL ------------------------------------------------------------------
function nixWhiteout(p) {
  const again = p.nixRecast; // the cast the reset gave back cannot give itself back
  p.nixRecast = false;
  p.nixWhiteT = WHITEOUT_T;
  p.invuln = Math.max(p.invuln, WHITEOUT_T);
  p.nixStrikeOnce = !again;
  burst(p.x, p.y - 6, '#ffffff', 26, 80, 0.6, true);
  burst(p.x, p.y, '#dfe8f4', 14, 50, 0.7, true);
  sfxAt('splash', p.x, p.y);
}
// the nearest rival hero she can reach, out of the snow
function whiteTarget(p) {
  let best = null, bd = WHITE_REACH;
  for (const q of players) {
    if (!enemyOf(p, q) || !unitAlive(q)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function nixWhiteStrike(p) {
  if (!unitAlive(p)) return;
  const q = whiteTarget(p);
  burst(p.x, p.y - 6, '#ffffff', 10, 50, 0.45, true);
  if (!q) return;
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
  // out of the snow beside them, on her side of them
  p.x = q.x - nx * (PLAYER_R * 2 + 2); p.y = q.y - ny * (PLAYER_R * 2 + 2);
  if (isSolidTile(Math.floor(p.x / TILE), Math.floor(p.y / TILE))) { p.x = q.x; p.y = q.y; }
  faceToward(p, nx, ny, true);
  hurtUnit(q, abDmg(p, 'whiteout', abRk(p, 'whiteout', 'dmg')) + Math.round(statOf(p, 'dmg') * WHITE_AD), nx, ny, p, { kb: 60, ab: 'whiteout', crit: true });
  if (p.nixStrikeOnce) { p.nixStrikeId = q.id; p.nixResetT = WHITE_RESET; }
  p.slashT = SLASH_T; p.slashA = Math.atan2(ny, nx); p.slashHalf = 0.9;
  abFx.push({ kind: 'wedge', x: p.x, y: p.y - 2, a: Math.atan2(ny, nx), r: 20, half: 0.6, t: 0, col: '#ffffff' });
  burst(q.x, unitMidY(q), '#ffffff', 14, 60, 0.45, true);
  sfxAt('break_', q.x, q.y);
}

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.nightwatch = { deal: watchDeal, tick: nixTick, out: nixOut,
  name: 'NIGHT WATCH', blurb: 'YOU WALK FASTER THE DARKER IT IS. YOUR FIRST HIT ON A HERO AFTER BEING HIDDEN HITS HARDER, MORE AT NIGHT.', icon: NIX_ICON32.watch };
HERO_MOVE.push(nixMoveMul);
HERO_COVER.push(nixCover);
HERO_TICK.push((dt) => { updateNixShards(dt); updateNixClouds(dt); });
HERO_DASH.drift = { spd: DRIFT_STEP_SPD, t: 0.2, ramp: 0.01, through: true,
  step: (p, mv) => { if (mv.blockedX || mv.blockedY || p.rushT <= 0) driftEnd(p); } };
