'use strict';
// LUCERNA, THE LANTERN - a named hero (CLASSES, js/sim/player.js) and the catch-and-save
// support: the only pull of a rival in the game, a lantern that brings an ally to her,
// and a light that shows what hides near her. Little damage; a missed crook leaves her
// open. Loaded before abilities.js, whose CLASS_AB takes LUCERNA_AB as her row of keys;
// she registers into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ lucerna

// ---- tuning --------------------------------------------------------------
// LAMPLIGHT (the passive): her lantern lights a ring round her; a rival inside is shown
// (markUnit: through the fog, the woods and the brush) a moment after they leave it, and an
// ally inside (her too) sees further the darker it is (HERO_SIGHT, lucernaSight)
const LAMP_R = 56;              // px of ring
const LAMP_SEE_T = 0.5;         // s a rival stays shown after the light last touched them
const LAMP_NIGHT = 0.35;        // an ally in the ring sees x(1 + this x the dark) further: a third more at full night
// a pull, hers alone: a body is drawn along the snow to a spot, held (stunned) while it travels
const PULL_SPD = 360;           // px/s
// Q SHEPHERD'S CROOK: a hook down the aim; the first rival body it meets is pulled to her
const CROOK_RANGE = 170;        // px it flies
const CROOK_SPD = 420;          // px/s
const CROOK_R = 6;              // px round the hook a body is met
const CROOK_STOP = 18;          // px from her the pulled body is set down
const CROOK_SLOW = 0.6;         // walk x this once set down...
const CROOK_SLOW_T = 1.25;      // ...for this long
// W LANTERN: thrown to a spot; an ally who walks onto it is drawn to her side
const LANTERN_RANGE = 170;      // px from her the spot may be set
const LANTERN_R = 12;           // px round it an ally takes it
const LANTERN_SEE = 40;         // px round it a rival is shown while it lies there
// E SHOO: a swing of the crook in front of her that pushes rivals back
const SHOO_REACH = 34;          // px
const SHOO_HALF = 0.95;         // rad either side of the aim
const SHOO_FX_LIFE = 0.4;       // s its sweep shows (drawn: AB_FX_LOOK.shoo)
const SHOO_KB = 260;            // px/s of shove, the robots' and beasts' own scale (hurtUnit kb)
// R CIRCLE OF LIGHT: a wide ring of lamplight where she stood; a rival on its edge is slowed hard and shown
const CIRCLE_R = 92;            // px of ring
const CIRCLE_T = 4;             // s it stands
const CIRCLE_EDGE = 6;          // px either side of the rim that counts as crossing it
const CIRCLE_SLOW_T = 1.5;      // s the slow holds

const lucernaHooks = [];    // {x, y, nx, ny, d, team, owner, dmg} - Q's crooks in flight
const lucernaLanterns = []; // {x, y, team, owner, t} - W's lanterns lying on the snow
const lucernaCircles = [];  // {x, y, team, owner, t, slow} - R's rings of light
// (each carries its caster's rank from the moment it was cast)

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const LUCERNA_AB = [
  {
    id: 'crook', name: "SHEPHERD'S CROOK", cd: [14, 13, 12, 11, 10], ap: 0.4, cast: 0.25, aim: { line: CROOK_RANGE },
    rank: { dmg: [20, 35, 50, 65, 80] }, // the hook's blow on the rival it catches
    tip: 'HOOK A RIVAL AND PULL THEM TO YOU',
    blurb: 'A HOOK THROWN IN A LINE. THE FIRST RIVAL IT CATCHES IS PULLED TO HER AND SLOWED.',
    use: (p) => lucernaCrook(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawCrookTele(p, a, closing, now, ex, ey), // the hook's line run out, a glint along it (js/draw/lucerna.js)
    icon: LUCERNA_ICON32.crook, mark: 'pull',
    bot: (p, foe, d, clear) => foe instanceof Player && clear && d > 45 && d < CROOK_RANGE * 0.85,
  },
  {
    id: 'lantern', name: 'LANTERN', cd: [18, 17, 16, 15, 14], cast: 0.2, aim: { line: LANTERN_RANGE },
    rank: { t: [4, 4.5, 5, 5.5, 6] }, // s it lies there waiting for an ally
    tip: 'AN ALLY WHO TAKES IT COMES TO YOU',
    blurb: 'SHE THROWS HER LANTERN TO A SPOT. AN ALLY WHO WALKS ONTO IT IS DRAWN TO HER SIDE. IT COMES BACK AFTER A FEW SECONDS.',
    use: (p) => lucernaThrow(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = lucernaSpot(p, LANTERN_RANGE); drawLanternTele(Math.round(c.x - ex), Math.round(c.y - ey), closing); }, // light gathering where it lands
    icon: LUCERNA_ICON32.lantern,
    bot: (p, foe, d) => !!lucernaInDanger(p) && d < 220,
    botAim: (p, foe) => { const q = lucernaInDanger(p) || p; return { x: q.x, y: q.y }; },
  },
  {
    id: 'shoo', name: 'SHOO', cd: [10, 9.5, 9, 8.5, 8], ap: 0.3, cast: 0.15,
    rank: { dmg: [15, 25, 35, 45, 55] }, // the swing's blow
    tip: 'A SWING OF THE CROOK PUSHES RIVALS BACK',
    blurb: 'A SWING OF THE CROOK IN FRONT OF HER. RIVALS IT CATCHES ARE PUSHED BACK.',
    use: (p) => lucernaShoo(p),
    icon: LUCERNA_ICON32.shoo,
    bot: (p, foe, d) => d < SHOO_REACH,
  },
  {
    id: 'circle', name: 'CIRCLE OF LIGHT', cd: [100, 85, 70], cast: 0.3,
    rank: { slow: [0.45, 0.35, 0.25] }, // walk x this for a rival crossing its edge
    tip: 'A RING OF LIGHT: RIVALS CROSSING SLOW',
    blurb: 'A WIDE RING OF LAMPLIGHT AROUND HER FOR A FEW SECONDS. RIVALS WHO CROSS ITS EDGE ARE SLOWED HARD AND SHOWN.',
    use: (p) => lucernaCircle(p),
    tele: (p, px, py, a, col, closing, now) => drawCircleTele(px, py, closing, now), // light rising round her, stroke by stroke
    icon: LUCERNA_ICON32.circle, mark: 'slow',
    bot: (p, foe, d) => foe instanceof Player && d < CIRCLE_R && d > CIRCLE_R * 0.4,
  },
];

// ---- her light and her side ------------------------------------------------------------
function lucernaSpot(p, range) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const r = Math.min(d, range);
  return { x: p.x + dx / d * r, y: p.y + dy / d * r };
}
function lucernaSrc(w) { const o = players[w.owner]; return o && o.team === w.team ? o : null; }
// an ally hero in reach of her lantern, hurt and with a rival hero close: the one a bot saves
function lucernaInDanger(p) {
  let best = null, bestK = 0.45;
  for (const q of players) {
    if (q === p || q.team !== p.team || !unitAlive(q)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < 50 || d > LANTERN_RANGE) continue;
    const k = q.hp / (q.maxHp || 1);
    if (k >= bestK) continue;
    if (!players.some((f) => f.team !== p.team && unitAlive(f) && Math.hypot(f.x - q.x, f.y - q.y) < 70)) continue;
    best = q; bestK = k;
  }
  return best;
}
// every rival body in a ring at (x, y) is shown a moment (her passive's light, the lantern's, the circle's)
function lucernaShow(src, x, y, r) { for (const q of unitsNear(src, x, y, r)) markUnit(q, LAMP_SEE_T); }

// ---- the pull ---------------------------------------------------------------------------
// A body on the way to (x, y): p.pullT/pullX/pullY on any kind of unit, stepped below.
// Stunned for the trip (a pull is a hard catch: tenacity does not shorten it); an ally drawn
// by the lantern is not stunned, only carried.
function lucernaPull(e, x, y, hold) {
  const d = Math.hypot(x - e.x, y - e.y);
  if (d < 2 || !unitAlive(e)) return;
  const t = d / PULL_SPD + 0.1;
  e.pullX = x; e.pullY = y; e.pullT = t;
  if (hold) stunUnit(e, t, null, true);
  if (e instanceof Player) { e.vx = 0; e.vy = 0; e.sliding = false; if (e.zip >= 0) zipEnd(e, true); }
}
function stepPulls(dt) {
  for (const L of [players, animals, robots]) for (const e of L) {
    if (!(e.pullT > 0)) continue;
    e.pullT = Math.max(0, e.pullT - dt);
    const dx = e.pullX - e.x, dy = e.pullY - e.y, d = Math.hypot(dx, dy);
    if (!unitAlive(e) || d < 1.5) { e.pullT = 0; continue; }
    const s = Math.min(d, PULL_SPD * dt);
    const x0 = e.x, y0 = e.y;
    moveEntity(e, dx / d * s, dy / d * s, unitRadius(e));
    if (Math.hypot(e.x - x0, e.y - y0) < s * 0.2) e.pullT = 0; // a wall: it stops there
  }
}

// ---- Q SHEPHERD'S CROOK --------------------------------------------------------------------
function lucernaCrook(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y), d = Math.hypot(dx, dy) || 1;
  lucernaHooks.push({ x: p.x, y: p.y - BOW_Y, nx: dx / d, ny: dy / d, d: 0, team: p.team, owner: p.id,
    dmg: abDmg(p, 'crook', abRk(p, 'crook', 'dmg')) });
  sfxAt('arrow', p.x, p.y);
}
function updateHooks(dt) {
  for (let i = lucernaHooks.length - 1; i >= 0; i--) {
    const h = lucernaHooks[i];
    let left = Math.min(CROOK_SPD * dt, CROOK_RANGE - h.d), done = false;
    while (left > 0 && !done) {
      const s = Math.min(4, left);
      h.x += h.nx * s; h.y += h.ny * s; h.d += s; left -= s;
      if (isSolidTile(Math.floor(h.x / TILE), Math.floor((h.y + BOW_Y) / TILE))) { burst(h.x, h.y, '#cfd8e8', 4, 30, 0.3, true); done = true; break; }
      const got = unitsHit(sideOf(h), h.x, h.y + BOW_Y, CROOK_R + PLAYER_R);
      if (!got.length) continue;
      const q = got[0], src = lucernaSrc(h), o = players[h.owner];
      hurtUnit(q, h.dmg, -h.nx, -h.ny, src, { kb: 0, ab: 'crook' });
      if (o && unitAlive(o) && unitAlive(q)) {
        const ux = q.x - o.x, uy = q.y - o.y, ud = Math.hypot(ux, uy) || 1;
        lucernaPull(q, o.x + ux / ud * CROOK_STOP, o.y + uy / ud * CROOK_STOP, true);
        slowUnit(q, CROOK_SLOW_T + q.pullT, CROOK_SLOW);
      }
      burst(q.x, unitMidY(q), '#f2cc6a', 8, 45, 0.4, true);
      done = true;
    }
    if (done || h.d >= CROOK_RANGE) lucernaHooks.splice(i, 1);
  }
}

// ---- W LANTERN -------------------------------------------------------------------------
function lucernaThrow(p) {
  const c = lucernaSpot(p, LANTERN_RANGE);
  for (let i = lucernaLanterns.length - 1; i >= 0; i--) if (lucernaLanterns[i].owner === p.id) lucernaLanterns.splice(i, 1); // one lantern
  lucernaLanterns.push({ x: c.x, y: c.y, team: p.team, owner: p.id, t: 0, life: abRk(p, 'lantern', 't') });
  burst(c.x, c.y - 4, '#fff1b8', 8, 35, 0.4, true);
  sfxAt('place', c.x, c.y);
}
function updateLanterns(dt) {
  for (let i = lucernaLanterns.length - 1; i >= 0; i--) {
    const l = lucernaLanterns[i];
    l.t += dt;
    const o = lucernaSrc(l);
    if (l.t >= l.life || !o || !unitAlive(o)) { lucernaLanterns.splice(i, 1); continue; }
    lucernaShow(o, l.x, l.y, LANTERN_SEE);
    for (const q of players) {
      if (q === o || q.team !== l.team || !unitAlive(q) || q.pullT > 0 || Math.hypot(q.x - l.x, q.y - l.y) > LANTERN_R + PLAYER_R) continue;
      const ux = q.x - o.x, uy = q.y - o.y, ud = Math.hypot(ux, uy) || 1;
      lucernaPull(q, o.x + ux / ud * 14, o.y + uy / ud * 14, false);
      burst(q.x, q.y - 6, '#fff1b8', 10, 40, 0.45, true);
      sfxAt('pickup', q.x, q.y);
      lucernaLanterns.splice(i, 1);
      break;
    }
  }
}

// ---- E SHOO -----------------------------------------------------------------------------
function lucernaShoo(p) {
  const a = Math.atan2(p.input.aimY - p.y, p.input.aimX - p.x);
  const dmg = abDmg(p, 'shoo', abRk(p, 'shoo', 'dmg'));
  for (const q of unitsHit(p, p.x, p.y, SHOO_REACH + PLAYER_R)) {
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > SHOO_HALF && d > 8) continue;
    hurtUnit(q, dmg, dx / d, dy / d, p, { kb: SHOO_KB, kbMul: q instanceof Player ? 2.2 : 1 });
  }
  for (const s of structsNear(p, p.x + Math.cos(a) * SHOO_REACH / 2, p.y + Math.sin(a) * SHOO_REACH / 2, SHOO_REACH / 2)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x + Math.cos(a) * SHOO_REACH / 2, p.y + Math.sin(a) * SHOO_REACH / 2, SHOO_REACH / 2, dmg);
  abFx.push({ kind: 'wedge', x: p.x, y: p.y - 4, a, r: SHOO_REACH, half: SHOO_HALF, t: 0, col: '#f2cc6a', fx: 'shoo', life: SHOO_FX_LIFE });
  sfxAt('swing', p.x, p.y);
}

// ---- R CIRCLE OF LIGHT ---------------------------------------------------------------------
function lucernaCircle(p) {
  lucernaCircles.push({ x: p.x, y: p.y, team: p.team, owner: p.id, t: 0, slow: abRk(p, 'circle', 'slow') });
  burst(p.x, p.y - 8, '#fff1b8', 18, 60, 0.5, true);
  sfxAt('pickup', p.x, p.y);
}
function updateCircles(dt) {
  for (let i = lucernaCircles.length - 1; i >= 0; i--) {
    const c = lucernaCircles[i];
    c.t += dt;
    if (c.t >= CIRCLE_T) { lucernaCircles.splice(i, 1); continue; }
    const side = sideOf(c);
    for (const q of unitsNear(side, c.x, c.y, CIRCLE_R + CIRCLE_EDGE)) {
      const d = Math.hypot(q.x - c.x, q.y - c.y);
      markUnit(q, LAMP_SEE_T); // inside the light: shown
      if (Math.abs(d - CIRCLE_R) <= CIRCLE_EDGE) slowUnit(q, CIRCLE_SLOW_T, c.slow);
    }
  }
}

// ---- her clocks (HERO_PASSIVE tick, HERO_TICK) -------------------------------------------
function lucernaTick(p, dt) { if (unitAlive(p)) lucernaShow(p, p.x, p.y, LAMP_R); }
// how much further p sees for standing in an allied LUCERNA's lamplight at night
function lucernaSight(p) {
  const dark = state.darkness || 0;
  if (dark <= 0) return 1;
  for (const q of players) {
    if (q.team !== p.team || !unitAlive(q) || CLASSES[q.cls].passive !== 'lamplight') continue;
    if (Math.hypot(q.x - p.x, q.y - p.y) <= LAMP_R) return 1 + LAMP_NIGHT * dark;
  }
  return 1;
}
function lucernaWorld(dt) { stepPulls(dt); updateHooks(dt); updateLanterns(dt); updateCircles(dt); }

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.lamplight = { tick: lucernaTick,
  name: 'LAMPLIGHT', blurb: 'YOUR LANTERN LIGHTS A RING AROUND YOU. ALLIES INSIDE IT SEE FURTHER AT NIGHT. RIVALS INSIDE IT ARE SHOWN, EVEN IN THE WOODS.',
  icon: LUCERNA_ICON32.lamp,
};
HERO_TICK.push(lucernaWorld);
HERO_SIGHT.push(lucernaSight);
