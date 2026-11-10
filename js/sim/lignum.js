'use strict';
// LIGNUM, THE FELLER - a named hero (CLASSES, js/sim/player.js) and a melee
// skirmisher who owns the treeline. He waits in the woods, steps out, chops
// hard and steps back in: leaving the woods readies a heavy first blow and a
// burst of speed. He chops twice, throws a hand axe he can pull himself to,
// hardens his skin (twice as well beside a pine), and for his ultimate fells a
// pine across a fight: the trunk knocks up whoever it lands on and lies there
// a few seconds as a wall. Loaded before abilities.js, whose CLASS_AB takes
// LIGNUM_AB as his row of keys; he registers into the shared hero hooks
// (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ lignum

// ---- tuning --------------------------------------------------------------
// TREELINE (the passive): stepping out of the woods (inWoods, js/sim/fog.js)
const TREELINE_T = 3;           // s the ready blow waits after he leaves the woods
const TREELINE_DMG = 0.5;       // the ready basic strike's extra share
const TREELINE_RUN = 1.3;       // his walk after it lands...
const TREELINE_RUN_T = 1.5;     // ...for this long
// Q CHOP: a cut, then (the key again) a heavier chop
const CHOP_R = 30;              // px of wedge
const CHOP_HALF = 0.9;          // rad either side of the aim
const CHOP_WAIT = 3;            // s the second blow waits for the key
const CHOP_SLOW_T = 1.5;        // s the chop slows for
// W THROWN AXE: a hand axe down the aim; it sticks in the first rival or tree
const AXE_SPD = 380;            // px/s
const AXE_RANGE = 200;          // px of flight
const AXE_R = 6;                // px it hits from
const AXE_STUCK = 3;            // s it stays stuck, the key again pulling him to it
const AXE_PULL_SPD = 440;       // px/s he is pulled
const AXE_PULL_STOP = 12;       // px short of it he stops
// E BARK SKIN: a share off every hit, twice beside a pine
const BARK_T = 3;               // s
const BARK_NEAR = 1;            // tiles from his feet a pine counts
// R TIMBER: a pine felled across the aim (or his felling axe's swing where none stands)
const TIMBER_PICK = 40;         // px from him a pine can be felled
const TIMBER_LEN = 104;         // px the trunk reaches
const TIMBER_W = 10;            // px either side of its line it lands on
const TIMBER_T = 3;             // s the trunk lies there as a wall
const lignumAxes = []; // {x, y, nx, ny, d, team, owner, dmg, stuck, on, t} - W's axes out and stuck (on: the hero it is in, -1 a tree or a smaller body)
const lignumLogs = []; // {x0, y0, nx, ny, len, team, owner, t, life, tiles} - R's trunks on the snow (tiles: the tile indices they wall)

// ---- the keys ---------------------------------------------------------------
// His row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const LIGNUM_AB = [
  {
    id: 'chop', name: 'CHOP', cd: [9, 8.5, 8, 7.5, 7], ap: 0.5, cast: 0.12, aim: { cone: CHOP_R, half: CHOP_HALF },
    rank: { dmg: [18, 26, 34, 42, 50], chop: [24, 34, 44, 54, 64], slow: 0.65 }, // dmg: the cut; chop: the second blow
    tip: 'CUT, THEN AGAIN TO CHOP AND SLOW',
    blurb: 'SWING YOUR AXE THROUGH THE WEDGE AHEAD. PRESS AGAIN WITHIN A FEW SECONDS TO CHOP: IT HITS HARDER AND SLOWS.',
    use: (p) => (p.castSlam ? lignumChop(p, true) : lignumChop(p, false)),
    recast: (p) => p.chopT > 0,
    acol: '#d9a648', activeF: (p) => (p.chopT > 0 ? p.chopT / CHOP_WAIT : 0),
    tele: (p, px, py, a, col, closing) => drawWedge(px, py, a, CHOP_R, CHOP_HALF, col, 0.5 + 0.4 * closing, closing * 0.5),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? -1 : 1, rot: 0 }), // up, then down
    icon: LIGNUM_ICON32.chop, mark: 'slow',
    bot: (p, foe, d) => d < CHOP_R - 4,
  },
  {
    id: 'axe', name: 'THROWN AXE', cd: [13, 12, 11, 10, 9], ap: 0.6, cast: 0.2, aim: { line: AXE_RANGE },
    rank: { dmg: [40, 60, 80, 100, 120] },
    tip: 'THROW AN AXE. AGAIN TO PULL TO IT',
    blurb: 'THROW A HAND AXE DOWN A LINE. IT STICKS IN THE FIRST RIVAL OR TREE IT MEETS. PRESS AGAIN TO PULL YOURSELF TO IT.',
    use: (p) => (p.castSlam ? lignumPull(p) : lignumThrow(p)),
    recast: (p) => !!lignumStuck(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { if (!p.castSlam) drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), teleLen(p.x, p.y, Math.cos(a), Math.sin(a), AXE_RANGE), col, 0.5 + 0.45 * closing, now, ex, ey); },
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.7 ? -1 : 1, rot: 0 }), // drawn back, then thrown
    icon: LIGNUM_ICON32.axe,
    bot: (p, foe, d, clear) => (lignumStuck(p) ? d > 40 : clear && foe instanceof Player && d < AXE_RANGE - 12),
  },
  {
    id: 'bark', name: 'BARK SKIN', cd: [15, 14, 13, 12, 11], ap: 0, cast: 0.1, // no aim: it is on him
    rank: { ward: [0.15, 0.17, 0.19, 0.21, 0.23] }, // the share off every hit; beside a pine twice it
    tip: 'TAKE LESS FROM HITS. TWICE BY A PINE',
    blurb: 'YOUR SKIN HARDENS LIKE BARK FOR A FEW SECONDS: TAKE LESS FROM EVERY HIT. STANDING BESIDE A PINE, TWICE AS LITTLE.',
    use: (p) => lignumBark(p),
    tele: (p, px, py, a, col, closing) => drawRing(px, py + 2, 12, col, 0.45 + 0.4 * closing, closing * 0.5),
    pose: () => ({ dx: 0, dy: 1, rot: 0 }), // set low
    icon: LIGNUM_ICON32.bark, mark: 'shield',
    bot: (p, foe, d) => d < 90 && p.hp < p.maxHp * 0.8,
  },
  {
    id: 'timber', name: 'TIMBER', cd: [100, 85, 70], ap: 0.8, cast: 0.6, aim: { line: TIMBER_LEN },
    rank: { dmg: [90, 140, 190], up: [0.9, 1, 1.15] }, // up: s in the air
    tip: 'FELL A PINE ACROSS THEM. A WALL',
    blurb: 'FELL THE NEAREST PINE TOWARD THE AIM, OR SWING YOUR FELLING AXE WHERE NONE STANDS. THE TRUNK KNOCKS UP EVERY RIVAL IT LANDS ON AND LIES THERE A FEW SECONDS AS A WALL NOBODY WALKS THROUGH.',
    use: (p) => lignumTimber(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const L = timberLine(p, a); drawLineBox(Math.round(L.x0 - ex), Math.round(L.y0 - ey), a, L.len, TIMBER_W, col, 0.45 + 0.4 * closing, closing * 0.5); },
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.7 ? -1 : 2, rot: 0 }), // the felling axe up, then down
    icon: LIGNUM_ICON32.timber, mark: 'up',
    bot: (p, foe, d) => foe instanceof Player && d < TIMBER_LEN - 16,
  },
];

// ---- TREELINE ---------------------------------------------------------------------
function isLignum(p) { return CLASSES[p.cls] && CLASSES[p.cls].passive === 'treeline'; }
function lignumTick(p, dt) {
  const w = inWoods(p.x, p.y);
  if (p.lgWoods && !w) { p.lgEdgeT = TREELINE_T; burst(p.x, p.y - 8, '#3f7a5c', 5, 30, 0.35, true); }
  else if (w) p.lgEdgeT = 0; // back in, the blow waits for the next step out
  else p.lgEdgeT = Math.max(0, p.lgEdgeT - dt);
  p.lgWoods = w;
  if (p.lgRunT > 0) p.lgRunT = Math.max(0, p.lgRunT - dt);
  if (p.chopT > 0) p.chopT = Math.max(0, p.chopT - dt);
  if (p.barkT > 0) p.barkT = Math.max(0, p.barkT - dt);
}
// the ready blow: the first basic strike out of the woods hits harder and quickens him
function lignumDeal(p, e, dmg, o) {
  if (!o.basic || !(p.lgEdgeT > 0)) return dmg;
  p.lgEdgeT = 0;
  p.lgRunT = TREELINE_RUN_T;
  burst(e.x, unitMidY(e), '#d9a648', 8, 45, 0.4, true);
  return Math.round(dmg * (1 + TREELINE_DMG));
}
function lignumMove(p) { return p.lgRunT > 0 && isLignum(p) ? TREELINE_RUN : 1; }
function lignumOut(p) {
  p.lgWoods = false; p.lgEdgeT = 0; p.lgRunT = 0; p.chopT = 0; p.barkT = 0;
  for (let i = lignumAxes.length - 1; i >= 0; i--) if (lignumAxes[i].owner === p.id) lignumAxes.splice(i, 1);
}

// ---- Q CHOP ------------------------------------------------------------------------
function lignumChop(p, second) {
  p.castSlam = false;
  const a = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
  const nx = Math.cos(a), ny = Math.sin(a);
  const dmg = abDmg(p, 'chop', abRk(p, 'chop', second ? 'chop' : 'dmg')), slow = abRk(p, 'chop', 'slow');
  for (const q of unitsInCone(p, p.x, p.y, a, CHOP_R, CHOP_HALF)) {
    hurtUnit(q, dmg, nx, ny, p, { kb: second ? 40 : 20 });
    if (second && !q.dead) slowUnit(q, CHOP_SLOW_T, slow);
    burst(q.x, unitMidY(q), second ? '#d9a648' : '#cfd8e8', 6, 45, 0.4, true);
  }
  for (const s of structsInCone(p, p.x, p.y, a, CHOP_R, CHOP_HALF)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x + nx * CHOP_R * 0.5, p.y + ny * CHOP_R * 0.5, CHOP_R * 0.5, dmg);
  abFx.push({ kind: 'wedge', x: p.x, y: p.y - 2, a, r: CHOP_R, half: CHOP_HALF, t: 0, col: second ? '#d9a648' : '#e6ebf2' });
  p.chopT = second ? 0 : CHOP_WAIT;
  sfxAt(second ? 'chop' : 'swing', p.x, p.y);
}

// ---- W THROWN AXE -------------------------------------------------------------------
function lignumSrc(w) { const o = players[w.owner]; return o && o.team === w.team && unitAlive(o) ? o : null; }
function lignumStuck(p) { for (const w of lignumAxes) if (w.owner === p.id && w.stuck) return w; return null; }
function lignumThrow(p) {
  for (let i = lignumAxes.length - 1; i >= 0; i--) if (lignumAxes[i].owner === p.id) lignumAxes.splice(i, 1); // one axe out at a time
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y), d = Math.hypot(dx, dy) || 1;
  lignumAxes.push({ x: p.x, y: p.y - BOW_Y, nx: dx / d, ny: dy / d, d: 0, team: p.team, owner: p.id,
    dmg: abDmg(p, 'axe', abRk(p, 'axe', 'dmg')), stuck: false, on: -1, t: 0 });
  sfxAt('arrow', p.x, p.y);
}
// where a stuck axe is now: in a body it rides it
function axeAt(w) {
  if (w.on >= 0) { const q = players[w.on]; if (q && unitAlive(q)) return [q.x, q.y - BOW_Y]; }
  return [w.x, w.y];
}
function updateLignumAxes(dt) {
  for (let i = lignumAxes.length - 1; i >= 0; i--) {
    const w = lignumAxes[i], o = lignumSrc(w);
    if (!o) { lignumAxes.splice(i, 1); continue; }
    if (w.stuck) {
      if (w.on >= 0) { const q = players[w.on]; if (!q || !unitAlive(q)) w.on = -1; else { w.x = q.x; w.y = q.y - BOW_Y; } }
      if ((w.t += dt) >= AXE_STUCK) lignumAxes.splice(i, 1);
      continue;
    }
    const step = Math.min(AXE_SPD * dt, AXE_RANGE - w.d);
    w.x += w.nx * step; w.y += w.ny * step; w.d += step;
    const q = unitsHit(sideOf(w), w.x, w.y + BOW_Y, AXE_R + PLAYER_R)[0];
    const st = q ? null : structsNear(sideOf(w), w.x, w.y + BOW_Y, AXE_R)[0];
    if (q) {
      hurtUnit(q, w.dmg, w.nx, w.ny, o, { kb: 25, ab: 'axe' });
      w.stuck = true; w.t = 0;
      if (q instanceof Player && !q.dead) w.on = q.id; // a hero carries it with them
      burst(w.x, w.y, '#cfd8e8', 6, 40, 0.35, true);
      sfxAt('hit', w.x, w.y);
      continue;
    }
    if (st) { hurtStruct(st, w.dmg, o); lignumAxes.splice(i, 1); continue; }
    const tx = Math.floor(w.x / TILE), ty = Math.floor((w.y + BOW_Y) / TILE), ob = inWorld(tx, ty) && objects[idx(tx, ty)];
    if (ob && ob.type === 'tree') { // in the trunk: it holds
      w.stuck = true; w.t = 0;
      burst(w.x, w.y, '#8a6448', 5, 30, 0.35, true);
      sfxAt('chop', w.x, w.y);
      continue;
    }
    if (w.d >= AXE_RANGE || isSolidTile(tx, ty)) {
      if (PRACTICE) abHitDummies(w.x, w.y + BOW_Y, AXE_R + 4, w.dmg);
      burst(w.x, w.y, '#cfd8e8', 4, 30, 0.3, true);
      lignumAxes.splice(i, 1);
    }
  }
}
// the key again: he is pulled to the axe and takes it back
function lignumPull(p) {
  p.castSlam = false;
  const w = lignumStuck(p);
  if (!w) return;
  const [ax, ay] = axeAt(w);
  const gy = ay + BOW_Y, dx = ax - p.x, dy = gy - p.y, d = Math.hypot(dx, dy) || 1;
  lignumAxes.splice(lignumAxes.indexOf(w), 1);
  if (d <= AXE_PULL_STOP + 2) return;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = Math.min(0.8, (d - AXE_PULL_STOP) / AXE_PULL_SPD);
  p.dash = 'axepull';
  p.reelX = Math.round(ax); p.reelY = Math.round(gy);
  p.sliding = false;
  faceToward(p, dx, dy, true);
  sfxAt('swing', p.x, p.y);
}
HERO_DASH.axepull = { spd: AXE_PULL_SPD, t: 0.8, ramp: 0.001, through: true, step: (p, mv) => pullStep(p, mv), pose: () => ({ dx: 0, dy: -1, rot: 0 }) };
function pullStep(p, mv) {
  if (Math.hypot(p.reelX - p.x, p.reelY - p.y) <= AXE_PULL_STOP || mv.blockedX || mv.blockedY || p.rushT <= 0) {
    p.rushT = 0; p.dash = '';
    p.vx = p.rushNX * 30; p.vy = p.rushNY * 30;
    burst(p.x + p.rushNX * 6, p.y, '#dfe8f4', 5, 35, 0.35, true);
  }
}

// ---- E BARK SKIN ------------------------------------------------------------------------
function lignumBark(p) {
  p.barkT = BARK_T;
  p.barkCut = abRk(p, 'bark', 'ward'); // copied as cast: the rank it was hardened at
  burst(p.x, p.y - 6, '#8a6448', 8, 40, 0.4, true);
  sfxFor(p, 'place');
}
function pineBeside(p) {
  const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + 4) / TILE);
  for (let dy = -BARK_NEAR; dy <= BARK_NEAR; dy++) for (let dx = -BARK_NEAR; dx <= BARK_NEAR; dx++) {
    const o = inWorld(tx + dx, ty + dy) && objects[idx(tx + dx, ty + dy)];
    if (o && o.type === 'tree') return true;
  }
  return false;
}
// hardened, a share of every hit is shrugged off (HERO_TAKEN, after armor)
function barkTaken(p, dmg) {
  if (!(p.barkT > 0) || dmg <= 0 || !isLignum(p)) return dmg;
  const cut = (p.barkCut || 0) * (pineBeside(p) ? 2 : 1);
  return Math.max(1, Math.round(dmg * (1 - cut)));
}
HERO_TAKEN.push(barkTaken);

// ---- R TIMBER ------------------------------------------------------------------------------
// The pine he fells: the nearest standing within TIMBER_PICK of him. The
// trunk falls from it down the aim; with none, his felling axe's swing lays
// it from his own feet.
function timberPine(p) {
  let best = null, bd = TIMBER_PICK;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE), R = Math.ceil(TIMBER_PICK / TILE);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const o = inWorld(tx + dx, ty + dy) && objects[idx(tx + dx, ty + dy)];
    if (!o || o.type !== 'tree') continue;
    const d = Math.hypot((o.tx + 0.5) * TILE - p.x, (o.ty + 0.5) * TILE - p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function timberLine(p, a) {
  const o = timberPine(p), nx = Math.cos(a), ny = Math.sin(a);
  const x0 = o ? (o.tx + 0.5) * TILE + nx * 6 : p.x + nx * 8, y0 = o ? (o.ty + 0.5) * TILE + ny * 6 : p.y + ny * 8;
  return { x0, y0, nx, ny, len: TIMBER_LEN, tree: o };
}
function lignumTimber(p) {
  const a = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
  const L = timberLine(p, a);
  if (L.tree) { // the pine comes down: a stump where it stood
    const o = L.tree;
    setTile(idx(o.tx, o.ty), { type: 'stump', tx: o.tx, ty: o.ty, flash: 0, shake: 0 });
    burst((o.tx + 0.5) * TILE, o.ty * TILE, '#2f5c4b', 10, 45, 0.6, true);
  }
  const dmg = abDmg(p, 'timber', abRk(p, 'timber', 'dmg')), up = abRk(p, 'timber', 'up');
  const hit = new Set(), px = -L.ny, py = L.nx;
  for (let s = 0; s <= L.len; s += 8) {
    for (const q of unitsHit(p, L.x0 + L.nx * s, L.y0 + L.ny * s, TIMBER_W + 4)) {
      if (hit.has(q)) continue;
      hit.add(q);
      const side = (q.x - L.x0) * px + (q.y - L.y0) * py >= 0 ? 1 : -1; // thrown off the side it stood on
      hurtUnit(q, dmg, px * side, py * side, p, { kb: 60, ab: 'timber' });
      if (!q.dead) knockUp(q, up, p);
    }
    for (const st of structsNear(p, L.x0 + L.nx * s, L.y0 + L.ny * s, TIMBER_W)) if (!hit.has(st)) { hit.add(st); hurtStruct(st, dmg, p); }
    if (PRACTICE) abHitDummies(L.x0 + L.nx * s, L.y0 + L.ny * s, TIMBER_W, dmg);
  }
  // the trunk on the snow: every open tile under its line is a wall for TIMBER_T
  const tiles = [];
  for (let s = 0; s <= L.len; s += 4) {
    const tx = Math.floor((L.x0 + L.nx * s) / TILE), ty = Math.floor((L.y0 + L.ny * s) / TILE);
    if (!inWorld(tx, ty) || objects[idx(tx, ty)]) continue;
    const k = idx(tx, ty);
    if (!tiles.includes(k)) tiles.push(k);
  }
  lignumLogs.push({ x0: L.x0, y0: L.y0, nx: L.nx, ny: L.ny, len: L.len, team: p.team, owner: p.id, t: 0, life: TIMBER_T, tiles });
  for (let s = 0; s <= L.len; s += 12) burst(L.x0 + L.nx * s, L.y0 + L.ny * s, '#f4f7ff', 4, 50, 0.5, true);
  sfxAt('treeFall', L.x0, L.y0);
}
function updateLignumLogs(dt) {
  for (let i = lignumLogs.length - 1; i >= 0; i--) {
    const g = lignumLogs[i];
    if ((g.t += dt) >= g.life) {
      for (let s = 0; s <= g.len; s += 16) burst(g.x0 + g.nx * s, g.y0 + g.ny * s, '#8a6448', 3, 30, 0.4, true);
      lignumLogs.splice(i, 1);
    }
  }
}
// a tile a trunk lies on is a wall to everyone (HERO_SOLID, isSolidTile)
function logSolid(tx, ty) {
  if (!lignumLogs.length) return false;
  const k = idx(tx, ty);
  for (const g of lignumLogs) if (g.tiles.includes(k)) return true;
  return false;
}

// ---- the hooks he registers (js/sim/heroes.js) ------------------------------------------
HERO_PASSIVE.treeline = { deal: lignumDeal, tick: lignumTick, out: lignumOut,
  name: 'TREELINE', blurb: 'STEPPING OUT OF THE WOODS, YOUR NEXT BASIC ATTACK WITHIN A FEW SECONDS HITS HARDER AND GIVES YOU A BURST OF SPEED.', icon: LIGNUM_ICON32.treeline, mark: 'speed' };
HERO_MOVE.push(lignumMove);
HERO_SOLID.push(logSolid);
HERO_TICK.push((dt) => { updateLignumAxes(dt); updateLignumLogs(dt); });
