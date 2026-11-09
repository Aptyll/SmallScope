'use strict';
// SALVIA, THE MENDER - a named hero (CLASSES, js/sim/player.js) and the
// first healer: the only real heals in the roster, speed for her side, and the
// slows taken off them. Almost no damage and little control of her own; under
// focus her heals are spent fast. Loaded before abilities.js, whose CLASS_AB
// takes SALVIA_AB as her row of keys; she registers into the shared hero hooks
// (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ salvia

// ---- tuning --------------------------------------------------------------
// WARM BROTH (the passive): every heal of hers also lends the healed a little
// speed for a moment and takes their slows off
const BROTH_T = 2;              // s of speed
const BROTH_WALK = 1.15;        // walk x this
// Q POULTICE: a tossed bundle down the aim; the first body it meets, ally or rival, takes it
const POULTICE_RANGE = 210;     // px it flies
const POULTICE_SPD = 240;       // px/s
const POULTICE_R = 7;           // px round it a body is met
const POULTICE_SLOW = 0.65;     // a rival's walk x this...
const POULTICE_SLOW_T = 1.5;    // ...for this long
// W SNOWDROPS: a few snowdrops planted round a spot near her; an ally who walks over one picks it
const DROP_RANGE = 80;          // px from her the spot may be set
const DROP_N = 3;               // planted each cast
const DROP_SPREAD = 11;         // px from the spot to each flower
const DROP_R = 7;               // px round a flower an ally picks it
const DROP_LIFE = 10;           // s before an unpicked flower wilts
const DROP_MAX = 6;             // of hers in the world at once: the oldest wilts first
// E WARM CLOAK: the ally nearest the aim (or herself) is wrapped: a shield and a burst of speed
const CLOAK_RANGE = 150;        // px from her the ally may stand
const CLOAK_PICK = 30;          // px from the aim the ally may stand
const CLOAK_T = 2.5;            // s the shield holds
const CLOAK_RUN_T = 1.5;        // s of speed...
const CLOAK_WALK = 1.3;         // ...walk x this
// R THAW: a ring of warm air where she stood: allies inside heal each second and shed every slow
const THAW_R = 80;              // px of ring
const THAW_T = 4;               // s it lasts
const THAW_EVERY = 1;           // s between heals (the first comes at once)

const salviaBundles = []; // {x, y, nx, ny, d, team, owner, heal} - Q's poultices in flight
const salviaDrops = [];   // {x, y, team, owner, t, heal} - W's snowdrops, waiting to be picked
const salviaThaws = [];   // {x, y, team, owner, t, next, heal} - R's rings of warm air
// (each carries its caster's rank and power from the moment it was cast)

// ---- the keys ---------------------------------------------------------------
// Her row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
// `heal` rides abDmg (the base and its ability power share), like a blow.
const SALVIA_AB = [
  {
    id: 'poultice', name: 'POULTICE', cd: [9, 8.5, 8, 7.5, 7], ap: 0.4, cast: 0.2, aim: { line: POULTICE_RANGE },
    rank: { hp: [45, 65, 85, 105, 125] }, // the first ally it meets is healed this much
    tip: 'HEALS THE FIRST ALLY. SLOWS A RIVAL',
    blurb: 'A TOSSED BUNDLE OF HERBS FLIES IN A LINE. THE FIRST ALLY IT MEETS IS HEALED; THE FIRST RIVAL IT MEETS IS SLOWED.',
    use: (p) => salviaPoultice(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), POULTICE_RANGE, col, 0.5 + 0.45 * closing, now, ex, ey),
    icon: SALVIA_ICON32.poultice,
    bot: (p, foe, d, clear) => !!salviaNeedy(p, POULTICE_RANGE * 0.85, 0.75, false) || (clear && d < POULTICE_RANGE * 0.8),
    botAim: (p, foe) => salviaAimAt(salviaNeedy(p, POULTICE_RANGE * 0.85, 0.75, false) || foe),
  },
  {
    id: 'drops', name: 'SNOWDROPS', cd: [14, 13, 12, 11, 10], ap: 0.25, cast: 0.25, aim: { line: DROP_RANGE },
    rank: { hp: [30, 40, 50, 60, 70] }, // each flower heals the ally who picks it this much
    tip: 'PLANT SNOWDROPS. ALLIES PICK THEM FOR LIFE',
    blurb: 'PLANT A FEW SNOWDROPS NEAR YOU. AN ALLY WHO WALKS OVER ONE PICKS IT AND IS HEALED. THEY WILT AFTER A WHILE.',
    use: (p) => salviaPlant(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = salviaSpot(p, DROP_RANGE); drawRing(Math.round(c.x - ex), Math.round(c.y - ey), DROP_SPREAD + DROP_R, col, 0.45 + 0.45 * closing, 0); },
    icon: SALVIA_ICON32.drops,
    bot: (p, foe, d) => !!salviaNeedy(p, DROP_RANGE, 0.8, true) && d < 220,
    botAim: (p, foe) => salviaAimAt(salviaNeedy(p, DROP_RANGE, 0.8, true) || p),
  },
  {
    id: 'cloak', name: 'WARM CLOAK', cd: [16, 15, 14, 13, 12], ap: 0.35, cast: 0.1, aim: { line: CLOAK_RANGE },
    rank: { shield: [40, 60, 80, 100, 120] }, // the shield round the ally wrapped
    tip: 'SHIELD AN ALLY AND SPEED THEM UP',
    blurb: 'WRAP THE ALLY NEAREST THE AIM, OR YOURSELF, IN A WARM CLOAK: A SHIELD FOR A FEW SECONDS AND A BURST OF SPEED.',
    use: (p) => salviaCloak(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const q = cloakTarget(p); drawRing(Math.round(q.x - ex), Math.round(q.y - ey), 10, col, 0.5 + 0.45 * closing, 0); },
    icon: SALVIA_ICON32.cloak,
    bot: (p, foe, d) => !!salviaNeedy(p, CLOAK_RANGE, 0.5, true) && d < 200,
    botAim: (p, foe) => salviaAimAt(salviaNeedy(p, CLOAK_RANGE, 0.5, true) || p),
  },
  {
    id: 'thaw', name: 'THAW', cd: [100, 85, 70], ap: 0.2, cast: 0.3,
    rank: { hps: [30, 45, 60] }, // what each second inside the ring heals
    tip: 'A WARM RING. ALLIES HEAL, CANNOT BE SLOWED',
    blurb: 'A LARGE RING OF WARM AIR WHERE YOU STAND, FOR A FEW SECONDS. ALLIES INSIDE HEAL EVERY SECOND AND CANNOT BE SLOWED.',
    use: (p) => salviaThaw(p),
    tele: (p, px, py, a, col, closing) => drawRing(px, py, THAW_R, col, 0.35 + 0.45 * closing, closing * 0.3),
    icon: SALVIA_ICON32.thaw,
    bot: (p, foe, d) => d < 170 && salviaAllies(p, p.x, p.y, THAW_R).some((q, i, all) => q.hp < q.maxHp * 0.3 || all.filter((o) => o.hp < o.maxHp * 0.6).length >= 2), // a fight going badly: one ally nearly down, or two hurt
  },
];

// ---- her side -------------------------------------------------------------------
// every living ally player (herself too) within `r` of (x, y): the heal's own list,
// the other side's unitsNear (js/sim/actions.js). unitAlive keeps out the riders in the air.
function salviaAllies(p, x, y, r) {
  const out = [];
  for (const q of players) if (q.team === p.team && unitAlive(q) && Math.hypot(q.x - x, q.y - y) <= r) out.push(q);
  return out;
}
// the most hurt ally within `r` of her below `frac` of their life (herself only when `self`), or null: what a bot heals
function salviaNeedy(p, r, frac, self) {
  let best = null, bestK = frac;
  for (const q of salviaAllies(p, p.x, p.y, r)) {
    if (q === p && !self) continue;
    const k = q.hp / (q.maxHp || 1);
    if (k < bestK) { best = q; bestK = k; }
  }
  return best;
}
function salviaAimAt(q) { return { x: q.x, y: q.y - 6 }; }
// the spot at her aim, no further than `range`
function salviaSpot(p, range) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  const r = Math.min(d, range);
  return { x: p.x + dx / d * r, y: p.y + dy / d * r };
}
// the caster of something she left in the world, while it is still hers to credit
function salviaSrc(w) { const o = players[w.owner]; return o && o.team === w.team ? o : null; }
// THE ONE WAY HER KEYS HEAL: healPlayer, the green number, and WARM BROTH on top
// (her passive, while the healer is still hers): a moment of speed and the slows off
function salviaHeal(src, q, n) {
  if (!(q instanceof Player) || !unitAlive(q)) return 0;
  const h = healPlayer(q, itemMend(src, q, n)); // MEND (js/sim/items.js)
  healFx(q, h);
  if (src && CLASSES[src.cls].passive === 'warmbroth') {
    q.brothT = Math.max(q.brothT, BROTH_T);
    salviaUnslow(q);
  }
  burst(q.x, q.y - 8, '#9cc87a', 6, 35, 0.45, true);
  return h;
}
// every slow off a body
function salviaUnslow(q) { q.slowT = 0; q.slowMul = 1; }

// ---- Q POULTICE ---------------------------------------------------------------------
function salviaPoultice(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y), d = Math.hypot(dx, dy) || 1;
  salviaBundles.push({ x: p.x, y: p.y - BOW_Y, nx: dx / d, ny: dy / d, d: 0, team: p.team, owner: p.id,
    heal: abDmg(p, 'poultice', abRk(p, 'poultice', 'hp')) });
  burst(p.x + dx / d * 6, p.y - BOW_Y + dy / d * 6, '#9cc87a', 5, 40, 0.3, true);
  sfxAt('arrow', p.x, p.y);
}
// what the bundle meets at (x, y): an ally player but its thrower, or a rival body
// (feet at y + BOW_Y, the bundle flies at bow height)
function poulticeMeets(b, x, y) {
  const fy = y + BOW_Y;
  for (const q of players) {
    if (q.id === b.owner || q.team !== b.team || !unitAlive(q)) continue;
    if (Math.hypot(q.x - x, q.y - fy) <= POULTICE_R + PLAYER_R) return q;
  }
  const foes = unitsHit(sideOf(b), x, fy, POULTICE_R + PLAYER_R);
  return foes.length ? foes[0] : null;
}
// The bundles fly on in short steps so nothing is skipped: a wall or a tree ends one,
// the first body ends it with its heal or its slow.
function updateBundles(dt) {
  for (let i = salviaBundles.length - 1; i >= 0; i--) {
    const b = salviaBundles[i];
    let left = Math.min(POULTICE_SPD * dt, POULTICE_RANGE - b.d), done = false;
    while (left > 0 && !done) {
      const s = Math.min(4, left);
      b.x += b.nx * s; b.y += b.ny * s; b.d += s; left -= s;
      if (isSolidTile(Math.floor(b.x / TILE), Math.floor((b.y + BOW_Y) / TILE))) { burst(b.x, b.y, '#d8cfb8', 4, 30, 0.3, true); done = true; break; }
      const q = poulticeMeets(b, b.x, b.y);
      if (!q) continue;
      if (unitTeam(q) === b.team) salviaHeal(salviaSrc(b), q, b.heal);
      else { slowUnit(q, POULTICE_SLOW_T, POULTICE_SLOW); burst(q.x, unitMidY(q), '#d8cfb8', 6, 40, 0.35, true); sfxAt('hit', q.x, q.y); }
      done = true;
    }
    if (done || b.d >= POULTICE_RANGE) salviaBundles.splice(i, 1);
  }
}

// ---- W SNOWDROPS ----------------------------------------------------------------------
function salviaPlant(p) {
  const c = salviaSpot(p, DROP_RANGE);
  const heal = abDmg(p, 'drops', abRk(p, 'drops', 'hp'));
  for (let k = 0; k < DROP_N; k++) {
    const a = -Math.PI / 2 + k * Math.PI * 2 / DROP_N;
    let x = c.x + Math.cos(a) * DROP_SPREAD, y = c.y + Math.sin(a) * DROP_SPREAD;
    if (isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE)) || waterAt(Math.floor(x / TILE), Math.floor(y / TILE))) { x = c.x; y = c.y; } // never inside a trunk or the creek
    salviaDrops.push({ x, y, team: p.team, owner: p.id, t: 0, heal });
    burst(x, y - 2, '#f8f8ff', 4, 25, 0.4, true);
  }
  // the oldest of hers wilt first past DROP_MAX
  let mine = 0;
  for (let i = salviaDrops.length - 1; i >= 0; i--) if (salviaDrops[i].owner === p.id && ++mine > DROP_MAX) salviaDrops.splice(i, 1);
  sfxAt('place', c.x, c.y);
}
// An ally (herself too) who walks over a flower picks it, but only when it would heal them.
function updateDrops(dt) {
  for (let i = salviaDrops.length - 1; i >= 0; i--) {
    const f = salviaDrops[i];
    f.t += dt;
    if (f.t >= DROP_LIFE) { salviaDrops.splice(i, 1); continue; }
    for (const q of players) {
      if (q.team !== f.team || !unitAlive(q) || q.hp >= q.maxHp || Math.hypot(q.x - f.x, q.y - f.y) > DROP_R + PLAYER_R) continue;
      salviaHeal(salviaSrc(f), q, f.heal);
      burst(f.x, f.y - 2, '#f8f8ff', 6, 30, 0.4, true);
      salviaDrops.splice(i, 1);
      break;
    }
  }
}

// ---- E WARM CLOAK -----------------------------------------------------------------------
// the ally the cloak goes to: the one nearest the aim within CLOAK_PICK of it and CLOAK_RANGE of her, else herself
function cloakTarget(p) {
  let best = p, bestD = CLOAK_PICK;
  for (const q of salviaAllies(p, p.x, p.y, CLOAK_RANGE)) {
    const d = Math.hypot(q.x - p.input.aimX, q.y - 6 - p.input.aimY);
    if (d < bestD) { best = q; bestD = d; }
  }
  return best;
}
function salviaCloak(p) {
  const q = cloakTarget(p);
  shieldUnit(q, Math.round(itemMend(p, q, abDmg(p, 'cloak', abRk(p, 'cloak', 'shield')))), CLOAK_T);
  q.cloakT = Math.max(q.cloakT, CLOAK_RUN_T);
  burst(q.x, q.y - 8, '#9cc87a', 10, 40, 0.45, true);
  burst(q.x, q.y - 8, '#f0ead8', 6, 30, 0.4, true);
  sfxAt('pickup', q.x, q.y);
}

// ---- R THAW ---------------------------------------------------------------------------------
function salviaThaw(p) {
  salviaThaws.push({ x: p.x, y: p.y, team: p.team, owner: p.id, t: 0, next: 0,
    heal: abDmg(p, 'thaw', abRk(p, 'thaw', 'hps')) });
  burst(p.x, p.y - 6, '#f2cc6a', 16, 60, 0.5, true);
  sfxAt('pickup', p.x, p.y);
}
// Every step the allies inside shed their slows; every THAW_EVERY s they are healed.
function updateThaws(dt) {
  for (let i = salviaThaws.length - 1; i >= 0; i--) {
    const w = salviaThaws[i];
    const src = salviaSrc(w);
    const inside = salviaAllies(w, w.x, w.y, THAW_R);
    for (const q of inside) salviaUnslow(q);
    if (w.t >= w.next) {
      w.next += THAW_EVERY;
      for (const q of inside) if (q.hp < q.maxHp) salviaHeal(src, q, w.heal);
    }
    w.t += dt;
    if (w.t >= THAW_T) salviaThaws.splice(i, 1);
  }
}

// ---- her clocks and the speed she lends (HERO_PASSIVE tick, HERO_MOVE) --------------------
// WARM BROTH and the cloak's run sit on whoever she helped, so every player ages them
function salviaWorld(dt) {
  for (const q of players) {
    if (q.brothT > 0) q.brothT = Math.max(0, q.brothT - dt);
    if (q.cloakT > 0) q.cloakT = Math.max(0, q.cloakT - dt);
  }
  updateBundles(dt);
  updateDrops(dt);
  updateThaws(dt);
}
function salviaMoveMul(p) { return (p.brothT > 0 ? BROTH_WALK : 1) * (p.cloakT > 0 ? CLOAK_WALK : 1); }
function salviaOut(p) { p.brothT = 0; p.cloakT = 0; }

// ---- the hooks she registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.warmbroth = { out: salviaOut,
  name: 'WARM BROTH', blurb: 'YOUR HEALS ALSO GIVE THE ALLY A LITTLE SPEED AND TAKE OFF THEIR SLOWS.',
  icon: SALVIA_ICON32.broth,
};
HERO_MOVE.push(salviaMoveMul);
HERO_TICK.push(salviaWorld);
