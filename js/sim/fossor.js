'use strict';
// FOSSOR, THE DIGGER - a named hero (CLASSES, js/sim/player.js) and a melee
// fighter: a brass machine of the works, made to dig, who fights the way it
// digs. Standing its ground it plants its feet and shrugs off part of every
// hit; its spade flings snow that slows; it goes under the snow and comes up
// beneath a rival, throwing them; it heaps a bank of snow across the way that
// nobody walks through; and for its ultimate it breaks the ground in a line
// that runs out from it, throwing every rival it passes. Loaded before
// abilities.js, whose CLASS_AB takes FOSSOR_AB as its row of keys; it
// registers into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ fossor

// ---- tuning --------------------------------------------------------------
// DIG IN (the passive): standing still plants him
const DIGIN_T = 0.75;           // s standing still before he is planted
const DIGIN_STILL = 6;          // px/s under which he counts as standing
const DIGIN_CUT = 0.15;         // share of every hit he shrugs off planted
// Q SPADEFUL: a swing of the spade through the wedge ahead, flinging snow
const SPADE_R = 34;             // px of wedge
const SPADE_HALF = 0.75;        // rad either side of the aim
const SPADE_SLOW_T = 1.5;       // s the snow slows for
const SPADE_FX_LIFE = 0.45;     // s the flung snow is in the air (its look: js/draw/fossor.js)
// W UNDER THE SNOW: under the snow down the aim, up beneath whoever is there
const BURROW_LEN = 110;         // px he travels
const BURROW_SPD = 300;         // px/s
const BURROW_HIT_R = 24;        // px around where he comes up a rival is thrown
// E BANK UP: a bank of snow across the aim, a wall to everyone
const BANK_AHEAD = 30;          // px ahead of him its middle stands
const BANK_HALF = 24;           // px either side of the middle it reaches
const BANK_CLEAR = 10;          // px a body keeps a tile open (nobody is walled in)
// R BREAK GROUND: a line of heaving ground runs out down the aim
const QUAKE_LEN = 160;          // px it runs
const QUAKE_SPD = 320;          // px/s
const QUAKE_W = 14;             // px either side of its line it throws
const fossorBanks = [];  // {x, y, nx, ny, team, owner, t, life, tiles} - E's banks on the snow (tiles: the tile indices they wall)
const fossorQuakes = []; // {x0, y0, nx, ny, d, team, owner, dmg, up, n} - R's broken ground running (n: the serial a body it threw keeps)

// ---- the keys ---------------------------------------------------------------
// His row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const FOSSOR_AB = [
  {
    id: 'spade', name: 'SPADEFUL', cd: [8, 7.5, 7, 6.5, 6], ap: 0.5, cast: 0.14, aim: { cone: SPADE_R, half: SPADE_HALF },
    rank: { dmg: [30, 45, 60, 75, 90], slow: 0.6 },
    tip: 'FLING SNOW AHEAD. IT SLOWS',
    blurb: 'SWING YOUR SPADE THROUGH THE WEDGE AHEAD AND FLING SNOW. RIVALS IT HITS ARE STRUCK AND SLOWED.',
    use: (p) => fossorSpade(p),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? 1 : -1, rot: 0 }), // dug in, then flung up
    icon: FOSSOR_ICON32.spade,
    bot: (p, foe, d) => d < SPADE_R - 4,
  },
  {
    id: 'burrow', name: 'UNDER THE SNOW', cd: [15, 14, 13, 12, 11], ap: 0.5, cast: 0.15, aim: { line: BURROW_LEN },
    rank: { dmg: [40, 60, 80, 100, 120], up: 0.6 }, // up: s in the air
    tip: 'GO UNDER. COME UP AND THROW THEM',
    blurb: 'DIG DOWN AND RUN UNDER THE SNOW DOWN THE AIM, PAST ANYONE IN THE WAY. WHERE YOU COME UP, RIVALS ARE STRUCK AND THROWN INTO THE AIR.',
    use: (p) => fossorBurrow(p),
    pose: () => ({ dx: 0, dy: 2, rot: 0 }), // ducked to dig
    icon: FOSSOR_ICON32.burrow,
    bot: (p, foe, d) => foe instanceof Player && d > 30 && d < BURROW_LEN,
  },
  {
    id: 'bank', name: 'BANK UP', cd: [18, 17, 16, 15, 14], ap: 0, cast: 0.2, aim: { line: BANK_AHEAD },
    rank: { t: [2.5, 2.75, 3, 3.25, 3.5] }, // t: s the bank stands
    tip: 'HEAP A WALL OF SNOW ACROSS THE WAY',
    blurb: 'HEAP A BANK OF SNOW ACROSS THE AIM, JUST AHEAD OF YOU. FOR A FEW SECONDS NOBODY WALKS THROUGH IT, YOUR SIDE OR THEIRS.',
    use: (p) => fossorBank(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawBankTele(p, a, closing, ex, ey), // the snow heaping up across the way (js/draw/fossor.js)
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.5 ? 1 : 0, rot: 0 }), // a heave of the spade
    icon: FOSSOR_ICON32.bank,
    bot: (p, foe, d) => foe instanceof Player && p.hp < p.maxHp * 0.45 && d < 80, // between him and a rival when he is losing
  },
  {
    id: 'quake', name: 'BREAK GROUND', cd: [100, 85, 70], ap: 0.8, cast: 0.5, aim: { line: QUAKE_LEN },
    rank: { dmg: [100, 150, 200], up: [0.9, 1, 1.1] }, // up: s in the air
    tip: 'BREAK THE GROUND. IT THROWS ALL IT PASSES',
    blurb: 'DRIVE YOUR SPADE IN AND BREAK THE GROUND. A LINE OF HEAVING EARTH RUNS OUT DOWN THE AIM, STRIKING EVERY RIVAL IT PASSES AND THROWING THEM INTO THE AIR.',
    use: (p) => fossorQuake(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawQuakeTele(p, a, closing, ex, ey), // the ground splitting down the line (js/draw/fossor.js)
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.7 ? -1 : 2, rot: 0 }), // the spade up, then driven down
    icon: FOSSOR_ICON32.quake,
    bot: (p, foe, d) => foe instanceof Player && d < QUAKE_LEN - 20,
  },
];

function isFossor(p) { return CLASSES[p.cls] && CLASSES[p.cls].passive === 'digin'; }
function fossorAim(p) { return Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x); }

// ---- DIG IN ---------------------------------------------------------------------------
// standing still (and not under the snow) for DIGIN_T plants him; any step lifts him
function fossorTick(p, dt) {
  const still = Math.hypot(p.vx, p.vy) < DIGIN_STILL && !(p.rushT > 0);
  p.fsStillT = still ? Math.min(DIGIN_T, (p.fsStillT || 0) + dt) : 0;
}
function fossorPlanted(p) { return p.fsStillT >= DIGIN_T; }
// planted, a share of every hit is shrugged off (HERO_TAKEN, after armor)
function diginTaken(p, dmg) {
  if (dmg <= 0 || !isFossor(p) || !fossorPlanted(p)) return dmg;
  return Math.max(1, Math.round(dmg * (1 - DIGIN_CUT)));
}
function fossorOut(p) { p.fsStillT = 0; }

// ---- Q SPADEFUL ------------------------------------------------------------------------
function fossorSpade(p) {
  const a = fossorAim(p), nx = Math.cos(a), ny = Math.sin(a);
  const dmg = abDmg(p, 'spade', abRk(p, 'spade', 'dmg')), slow = abRk(p, 'spade', 'slow');
  for (const q of unitsInCone(p, p.x, p.y, a, SPADE_R, SPADE_HALF)) {
    hurtUnit(q, dmg, nx, ny, p, { kb: 25 });
    if (!q.dead) slowUnit(q, SPADE_SLOW_T, slow);
    burst(q.x, unitMidY(q), '#f4f7ff', 7, 45, 0.4, true);
  }
  for (const s of structsInCone(p, p.x, p.y, a, SPADE_R, SPADE_HALF)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x + nx * SPADE_R * 0.5, p.y + ny * SPADE_R * 0.5, SPADE_R * 0.5, dmg);
  abFx.push({ kind: 'wedge', x: p.x, y: p.y - 2, a, r: SPADE_R, half: SPADE_HALF, t: 0, col: '#f4f7ff', fx: 'spade', life: SPADE_FX_LIFE });
  for (let k = 0; k < 3; k++) burst(p.x + nx * (12 + k * 8), p.y + ny * (12 + k * 8) - 4, '#f4f7ff', 3, 40, 0.35, true); // the flung snow
  sfxAt('swing', p.x, p.y);
}

// ---- W UNDER THE SNOW ---------------------------------------------------------------------
// He runs under the snow, through bodies (`through`), stopped only by what
// stops a walker; where the run ends he comes up.
function fossorBurrow(p) {
  const a = fossorAim(p);
  p.rushNX = Math.cos(a); p.rushNY = Math.sin(a);
  p.rushT = BURROW_LEN / BURROW_SPD;
  p.dash = 'burrow';
  p.fsUpDmg = abDmg(p, 'burrow', abRk(p, 'burrow', 'dmg')); // copied as cast: the rank it dug at
  p.fsUpT = abRk(p, 'burrow', 'up');
  p.sliding = false;
  faceToward(p, p.rushNX, p.rushNY, true);
  burst(p.x, p.y + 4, '#f4f7ff', 8, 40, 0.4, true);
  sfxAt('dodge', p.x, p.y);
}
HERO_DASH.burrow = { spd: BURROW_SPD, t: BURROW_LEN / BURROW_SPD, ramp: 0.001, through: true, step: (p, mv) => burrowStep(p, mv),
  pose: () => ({ dx: 0, dy: 3, rot: 0 }) }; // down in the snow
function burrowStep(p, mv) {
  if (!mv.blockedX && !mv.blockedY && p.rushT > 0) return;
  p.rushT = 0; p.dash = '';
  p.vx = p.rushNX * 20; p.vy = p.rushNY * 20;
  fossorSurface(p);
}
function fossorSurface(p) {
  for (const q of unitsHit(p, p.x, p.y, BURROW_HIT_R)) {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    hurtUnit(q, p.fsUpDmg || 0, (q.x - p.x) / d, (q.y - p.y) / d, p, { kb: 15, ab: 'burrow' });
    if (!q.dead) knockUp(q, p.fsUpT || 0, p);
  }
  for (const s of structsNear(p, p.x, p.y, BURROW_HIT_R)) hurtStruct(s, p.fsUpDmg || 0, p);
  if (PRACTICE) abHitDummies(p.x, p.y, BURROW_HIT_R, p.fsUpDmg || 0);
  burst(p.x, p.y + 2, '#f4f7ff', 12, 55, 0.5, true);
  sfxAt('hit', p.x, p.y);
}
function isBurrowing(p) { return p.rushT > 0 && p.dash === 'burrow'; }

// ---- E BANK UP -----------------------------------------------------------------------------
function fossorBank(p) {
  const a = fossorAim(p), nx = Math.cos(a), ny = Math.sin(a);
  const cx = p.x + nx * BANK_AHEAD, cy = p.y + ny * BANK_AHEAD;
  // every open tile under the bank's line that no body stands on is a wall while it stands
  const tiles = [];
  for (let s = -BANK_HALF; s <= BANK_HALF; s += 4) {
    const x = cx - ny * s, y = cy + nx * s, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!inWorld(tx, ty) || objects[idx(tx, ty)] || waterAt(tx, ty)) continue;
    const k = idx(tx, ty);
    if (tiles.includes(k)) continue;
    if (bankCrowded(tx, ty)) continue;
    tiles.push(k);
  }
  fossorBanks.push({ x: Math.round(cx), y: Math.round(cy), nx, ny, team: p.team, owner: p.id, t: 0, life: abRk(p, 'bank', 't'), tiles });
  for (let s = -BANK_HALF; s <= BANK_HALF; s += 8) burst(cx - ny * s, cy + nx * s, '#f4f7ff', 3, 35, 0.4, true);
  sfxFor(p, 'place');
}
// a body on or beside a tile keeps it open, so the bank never shuts anyone inside it
function bankCrowded(tx, ty) {
  const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE, r = TILE / 2 + BANK_CLEAR;
  return unitsNear(null, x, y, r).length > 0;
}
function updateFossorBanks(dt) {
  for (let i = fossorBanks.length - 1; i >= 0; i--) {
    const g = fossorBanks[i];
    if ((g.t += dt) >= g.life) {
      for (let s = -BANK_HALF; s <= BANK_HALF; s += 8) burst(g.x - g.ny * s, g.y + g.nx * s, '#dfe8f4', 3, 30, 0.4, true);
      fossorBanks.splice(i, 1);
    }
  }
}
// a tile a bank stands on is a wall to everyone (HERO_SOLID, isSolidTile)
function bankSolid(tx, ty) {
  if (!fossorBanks.length) return false;
  const k = idx(tx, ty);
  for (const g of fossorBanks) if (g.tiles.includes(k)) return true;
  return false;
}

// ---- R BREAK GROUND ------------------------------------------------------------------------
// The broken ground runs out at QUAKE_SPD; each rival its front passes is struck
// and thrown once (the quake's serial, kept on the body it threw: his own count of
// quakes, by his id, so two FOSSORs never share one).
function fossorQuake(p) {
  p.fsQuakeN = (p.fsQuakeN || 0) + 1;
  const a = fossorAim(p);
  fossorQuakes.push({ x0: Math.round(p.x), y0: Math.round(p.y), nx: Math.cos(a), ny: Math.sin(a), d: 0, team: p.team, owner: p.id,
    dmg: abDmg(p, 'quake', abRk(p, 'quake', 'dmg')), up: abRk(p, 'quake', 'up'), n: p.fsQuakeN * 64 + p.id });
  sfxAt('chop', p.x, p.y);
}
function updateFossorQuakes(dt) {
  for (let i = fossorQuakes.length - 1; i >= 0; i--) {
    const g = fossorQuakes[i], o = players[g.owner];
    const d0 = g.d;
    g.d = Math.min(QUAKE_LEN, g.d + QUAKE_SPD * dt);
    if (o && o.team === g.team) {
      for (let s = d0; s <= g.d; s += 6) {
        const x = g.x0 + g.nx * s, y = g.y0 + g.ny * s;
        for (const q of unitsHit(o, x, y, QUAKE_W + 4)) {
          if (q.fsQuake === g.n) continue;
          q.fsQuake = g.n;
          const sd = (q.x - g.x0) * -g.ny + (q.y - g.y0) * g.nx >= 0 ? 1 : -1; // thrown off the side it stood on
          hurtUnit(q, g.dmg, -g.ny * sd, g.nx * sd, o, { kb: 40, ab: 'quake' });
          if (!q.dead) knockUp(q, g.up, o);
        }
        for (const st of structsNear(o, x, y, QUAKE_W)) if (st.fsQuake !== g.n) { st.fsQuake = g.n; hurtStruct(st, g.dmg, o); }
        if (PRACTICE) abHitDummies(x, y, QUAKE_W, g.dmg);
      }
      if (Math.floor(g.d / 16) > Math.floor(d0 / 16)) burst(g.x0 + g.nx * g.d, g.y0 + g.ny * g.d, '#8a6d50', 4, 45, 0.45, true);
    }
    if (g.d >= QUAKE_LEN) fossorQuakes.splice(i, 1);
  }
}

// ---- the hooks he registers (js/sim/heroes.js) ------------------------------------------
HERO_PASSIVE.digin = { tick: fossorTick, out: fossorOut,
  name: 'DIG IN', blurb: 'STAND YOUR GROUND FOR A MOMENT AND YOU PLANT YOUR FEET: YOU TAKE LESS FROM EVERY HIT UNTIL YOU MOVE.', icon: FOSSOR_ICON32.digin };
HERO_TAKEN.push(diginTaken);
HERO_SOLID.push(bankSolid);
HERO_TICK.push((dt) => { updateFossorBanks(dt); updateFossorQuakes(dt); });
