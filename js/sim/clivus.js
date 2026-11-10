'use strict';
// CLIVUS, THE GUIDE - a named hero (CLASSES, js/sim/player.js) and a melee
// fighter who climbs. He led a column of exiles over the pass roped together,
// and he fights the way he climbed: every key he lands readies a FOOTHOLD, a
// heavier swing of his ice axe. His pick strike hits twice as hard on a rival
// he holds; his rope ties to a rival hero and, if they stay near him, roots
// them; he vaults over whatever stands in his way (a pine, a rock, a hut, a
// felled trunk, the creek); and for his ultimate he stakes a rope ring around
// himself that no rival walks across. Loaded before abilities.js, whose
// CLASS_AB takes CLIVUS_AB as his row of keys; he registers into the shared
// hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ clivus

// ---- tuning --------------------------------------------------------------
// FOOTHOLD (the passive): a key landing readies the next basic strike
const FOOT_T = 3;               // s the foothold waits for a basic strike
const FOOT_DMG = 0.4;           // its extra share
// Q PICK STRIKE: a swing of the ice axe through the wedge ahead
const PICK_R = 30;              // px of wedge
const PICK_HALF = 0.85;         // rad either side of the aim
const PICK_HELD = 2;            // times the damage on a rival he holds (roped or rooted)
// W ROPE: a weighted rope down the aim; it ties to the first rival hero it meets
const ROPE_SPD = 400;           // px/s
const ROPE_RANGE = 190;         // px of flight
const ROPE_R = 6;               // px it hits from
const ROPE_TIE = 2;             // s the tie holds before it roots
const ROPE_SNAP = 230;          // px apart the rope snaps (the rival got away)
// E VAULT: a hop down the aim over anything that is not a building
const VAULT_LEN = 72;           // px he hops
const VAULT_SPD = 330;          // px/s
const VAULT_REACH = 32;         // px past VAULT_LEN he may land, where the spot is taken
const VAULT_HIT_R = 20;         // px around his landing a rival is struck
const VAULT_SLOW_T = 1;         // s the landing slows for
const VAULT_UP = 8;             // px the body rises at the top of the hop
// R ROPE RING: a ring staked around him that rivals cannot cross
const RING_R = 52;              // px from him to the rope
const RING_CAST_R = RING_R + 6; // px a rival is struck within as it goes up
const clivusRopes = []; // {x, y, nx, ny, d, team, owner, dmg, root, on, t} - W's ropes in flight (on -1) and tied (on: the hero tied)
const clivusRings = []; // {x, y, r, team, owner, t, life, tiles} - R's rings (tiles: the tile indices they wall to rivals)

// ---- the keys ---------------------------------------------------------------
// His row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const CLIVUS_AB = [
  {
    id: 'pick', name: 'PICK STRIKE', cd: [7, 6.5, 6, 5.5, 5], ap: 0.5, cast: 0.14, aim: { cone: PICK_R, half: PICK_HALF },
    rank: { dmg: [30, 45, 60, 75, 90] },
    tip: 'TWICE AS HARD ON A RIVAL YOU HOLD',
    blurb: 'SWING YOUR ICE AXE THROUGH THE WEDGE AHEAD. A RIVAL YOUR ROPE HOLDS, OR WHO CANNOT MOVE, TAKES TWICE AS MUCH.',
    use: (p) => clivusPick(p),
    tele: (p, px, py, a, col, closing) => drawWedge(px, py, a, PICK_R, PICK_HALF, col, 0.5 + 0.4 * closing, closing * 0.5),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? -1 : 1, rot: 0 }), // up, then down
    icon: CLIVUS_ICON32.pick,
    bot: (p, foe, d) => d < PICK_R - 4,
  },
  {
    id: 'rope', name: 'ROPE', cd: [14, 13, 12, 11, 10], ap: 0.4, cast: 0.2, aim: { line: ROPE_RANGE },
    rank: { dmg: [35, 50, 65, 80, 95], root: [1, 1.1, 1.2, 1.3, 1.4] }, // root: what the tie ends in
    tip: 'TIE A RIVAL. STAY CLOSE TO ROOT THEM',
    blurb: 'THROW A WEIGHTED ROPE DOWN A LINE. IT TIES TO THE FIRST RIVAL HERO IT MEETS. IF THEY ARE STILL NEAR YOU WHEN THE TIE ENDS, THEY ARE ROOTED. THEY CAN RUN FAR ENOUGH TO SNAP IT.',
    use: (p) => clivusThrow(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), teleLen(p.x, p.y, Math.cos(a), Math.sin(a), ROPE_RANGE), col, 0.5 + 0.45 * closing, now, ex, ey),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.7 ? -1 : 1, rot: 0 }), // swung back, then thrown
    icon: CLIVUS_ICON32.rope,
    bot: (p, foe, d, clear) => clear && foe instanceof Player && d < ROPE_RANGE - 12,
  },
  {
    id: 'vault', name: 'VAULT', cd: [16, 15, 14, 13, 12], ap: 0.4, cast: 0.1, aim: { line: VAULT_LEN },
    rank: { dmg: [30, 45, 60, 75, 90], slow: 0.7 },
    tip: 'HOP OVER PINES, ROCKS AND WATER',
    blurb: 'VAULT DOWN THE AIM OVER ANYTHING IN THE WAY BUT A BUILDING: PINES, ROCKS, A FELLED TRUNK, THE CREEK. RIVALS WHERE YOU LAND ARE STRUCK AND SLOWED.',
    use: (p) => clivusVault(p),
    ok: (p) => !!vaultSpot(p, clivusAim(p)),
    tele: (p, px, py, a, col, closing, now, ex, ey) => {
      const s = vaultSpot(p, a);
      if (!s) return;
      drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), s.d, col, 0.45 + 0.4 * closing, now, ex, ey);
      drawRing(Math.round(s.x - ex), Math.round(s.y - ey), VAULT_HIT_R, col, 0.4 + 0.4 * closing, closing * 0.4);
    },
    pose: () => ({ dx: 0, dy: 1, rot: 0 }), // crouched to spring
    icon: CLIVUS_ICON32.vault,
    bot: (p, foe, d) => foe instanceof Player && d > 36 && d < VAULT_LEN + 16,
  },
  {
    id: 'ring', name: 'ROPE RING', cd: [110, 95, 80], ap: 0.7, cast: 0.35, // no aim: it is staked around him
    rank: { dmg: [80, 125, 170], t: [3, 3.5, 4] }, // t: s the ring stands
    tip: 'STAKE A RING NO RIVAL CAN CROSS',
    blurb: 'DRIVE YOUR STAKES AND STRING A ROPE RING AROUND YOU. RIVALS INSIDE ARE STRUCK, AND FOR A FEW SECONDS NO RIVAL CAN WALK ACROSS THE ROPE, IN OR OUT. YOUR SIDE STEPS OVER IT.',
    use: (p) => clivusRing(p),
    tele: (p, px, py, a, col, closing) => drawRing(px, py + 2, RING_R, col, 0.45 + 0.4 * closing, closing * 0.3),
    pose: (p, prog) => ({ dx: 0, dy: prog < 0.6 ? -1 : 2, rot: 0 }), // the axe up, then driven down
    icon: CLIVUS_ICON32.ring,
    bot: (p, foe, d) => foe instanceof Player && d < RING_R - 12,
  },
];

function isClivus(p) { return CLASSES[p.cls] && CLASSES[p.cls].passive === 'foothold'; }
function clivusAim(p) { return Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x); }

// ---- FOOTHOLD -----------------------------------------------------------------------
function clivusCast(p) { p.clFootT = FOOT_T; }
function clivusTick(p, dt) {
  if (p.clFootT > 0) p.clFootT = Math.max(0, p.clFootT - dt);
  if (p.clAir && !(p.rushT > 0 && p.dash === 'vault')) vaultSettle(p); // a vault a stun cut short in the air
}
// the ready strike: the next basic attack after a key lands hits harder
function clivusDeal(p, e, dmg, o) {
  if (!o.basic || !(p.clFootT > 0)) return dmg;
  p.clFootT = 0;
  burst(e.x, unitMidY(e), '#cfe0f2', 8, 45, 0.4, true);
  return Math.round(dmg * (1 + FOOT_DMG));
}
function clivusOut(p) {
  p.clFootT = 0; p.clAir = false;
  for (let i = clivusRopes.length - 1; i >= 0; i--) if (clivusRopes[i].owner === p.id) clivusRopes.splice(i, 1);
}

// ---- Q PICK STRIKE ---------------------------------------------------------------------
// a rival he holds: tied by one of his ropes, or unable to move at all
function clivusHolds(p, q) {
  if (q.rootT > 0 || q.stunT > 0) return true;
  if (!(q instanceof Player)) return false;
  for (const w of clivusRopes) if (w.owner === p.id && w.on === q.id) return true;
  return false;
}
function clivusPick(p) {
  const a = clivusAim(p), nx = Math.cos(a), ny = Math.sin(a);
  const dmg = abDmg(p, 'pick', abRk(p, 'pick', 'dmg'));
  for (const q of unitsInCone(p, p.x, p.y, a, PICK_R, PICK_HALF)) {
    const held = clivusHolds(p, q);
    hurtUnit(q, held ? dmg * PICK_HELD : dmg, nx, ny, p, { kb: 25 });
    burst(q.x, unitMidY(q), held ? '#f2cc6a' : '#cfe0f2', held ? 9 : 6, 45, 0.4, true);
  }
  for (const s of structsInCone(p, p.x, p.y, a, PICK_R, PICK_HALF)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x + nx * PICK_R * 0.5, p.y + ny * PICK_R * 0.5, PICK_R * 0.5, dmg);
  abFx.push({ kind: 'wedge', x: p.x, y: p.y - 2, a, r: PICK_R, half: PICK_HALF, t: 0, col: '#e6ebf2' });
  sfxAt('swing', p.x, p.y);
}

// ---- W ROPE -------------------------------------------------------------------------------
function clivusSrc(w) { const o = players[w.owner]; return o && o.team === w.team && unitAlive(o) ? o : null; }
function clivusThrow(p) {
  for (let i = clivusRopes.length - 1; i >= 0; i--) if (clivusRopes[i].owner === p.id) clivusRopes.splice(i, 1); // one rope out at a time
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y), d = Math.hypot(dx, dy) || 1;
  clivusRopes.push({ x: p.x, y: p.y - BOW_Y, nx: dx / d, ny: dy / d, d: 0, team: p.team, owner: p.id,
    dmg: abDmg(p, 'rope', abRk(p, 'rope', 'dmg')), root: abRk(p, 'rope', 'root'), on: -1, t: 0 });
  sfxAt('arrow', p.x, p.y);
}
function updateClivusRopes(dt) {
  for (let i = clivusRopes.length - 1; i >= 0; i--) {
    const w = clivusRopes[i], o = clivusSrc(w);
    if (!o) { clivusRopes.splice(i, 1); continue; }
    if (w.on >= 0) { // tied: it holds while they stay near, and roots them when it ends
      const q = players[w.on];
      if (!q || !unitAlive(q)) { clivusRopes.splice(i, 1); continue; }
      w.x = q.x; w.y = q.y - BOW_Y;
      if (Math.hypot(q.x - o.x, q.y - o.y) > ROPE_SNAP) { // they ran far enough: it snaps
        burst((q.x + o.x) / 2, (q.y + o.y) / 2 - BOW_Y, '#c8a874', 6, 35, 0.35, true);
        clivusRopes.splice(i, 1);
        continue;
      }
      if ((w.t += dt) >= ROPE_TIE) {
        rootUnit(q, w.root, o);
        burst(q.x, q.y, '#c8a874', 8, 35, 0.4, true);
        sfxAt('hit', q.x, q.y);
        clivusRopes.splice(i, 1);
      }
      continue;
    }
    const step = Math.min(ROPE_SPD * dt, ROPE_RANGE - w.d);
    w.x += w.nx * step; w.y += w.ny * step; w.d += step;
    const q = unitsHit(sideOf(w), w.x, w.y + BOW_Y, ROPE_R + PLAYER_R)[0];
    if (q) {
      hurtUnit(q, w.dmg, w.nx, w.ny, o, { kb: 10, ab: 'rope' });
      burst(w.x, w.y, '#c8a874', 6, 40, 0.35, true);
      sfxAt('hit', w.x, w.y);
      if (q instanceof Player && !q.dead) { w.on = q.id; w.t = 0; } // a hero is tied
      else clivusRopes.splice(i, 1);                               // anything smaller only takes the blow
      continue;
    }
    const st = structsNear(sideOf(w), w.x, w.y + BOW_Y, ROPE_R)[0];
    if (st) { hurtStruct(st, w.dmg, o); clivusRopes.splice(i, 1); continue; }
    const tx = Math.floor(w.x / TILE), ty = Math.floor((w.y + BOW_Y) / TILE);
    if (w.d >= ROPE_RANGE || isSolidTile(tx, ty)) {
      if (PRACTICE) abHitDummies(w.x, w.y + BOW_Y, ROPE_R + 4, w.dmg);
      burst(w.x, w.y, '#c8a874', 4, 30, 0.3, true);
      clivusRopes.splice(i, 1);
    }
  }
}

// ---- E VAULT -----------------------------------------------------------------------------------
// Where a vault down angle a lands: VAULT_LEN out, or the first spot past it
// (to VAULT_REACH more) his body fits on dry ground, else the last one short
// of it. Null when every spot down the line is taken or off the world.
function vaultFits(p, x, y) {
  const r = PLAYER_R;
  for (let ty = Math.floor((y - r) / TILE); ty <= Math.floor((y + r) / TILE); ty++) {
    for (let tx = Math.floor((x - r) / TILE); tx <= Math.floor((x + r) / TILE); tx++) {
      if (isSolidTile(tx, ty, p, true) || waterAt(tx, ty)) return false;
    }
  }
  return !cisternCrowds(x, y, r);
}
function vaultSpot(p, a) {
  const nx = Math.cos(a), ny = Math.sin(a);
  for (let d = VAULT_LEN; d <= VAULT_LEN + VAULT_REACH; d += 4) if (vaultFits(p, p.x + nx * d, p.y + ny * d)) return { x: p.x + nx * d, y: p.y + ny * d, d };
  for (let d = VAULT_LEN - 4; d >= 16; d -= 4) if (vaultFits(p, p.x + nx * d, p.y + ny * d)) return { x: p.x + nx * d, y: p.y + ny * d, d };
  return null;
}
function clivusVault(p) {
  const a = clivusAim(p), s = vaultSpot(p, a);
  if (!s) return;
  p.rushNX = Math.cos(a); p.rushNY = Math.sin(a);
  p.rushT = p.clVaultT = s.d / VAULT_SPD;
  p.dash = 'vault';
  p.reelX = Math.round(s.x); p.reelY = Math.round(s.y);
  p.clVaultDmg = abDmg(p, 'vault', abRk(p, 'vault', 'dmg')); // copied as cast: the rank it was sprung at
  p.clVaultSlow = abRk(p, 'vault', 'slow');
  p.sliding = false;
  p.clAir = true;
  faceToward(p, p.rushNX, p.rushNY, true);
  burst(p.x, p.y + 4, '#dfe8f4', 6, 35, 0.35, true);
  sfxAt('dodge', p.x, p.y);
}
// in the air over whatever is under him (`over`: isSolidTile lets scenery by,
// playerPlunge the water); he lands on the spot vaultSpot found
HERO_DASH.vault = { spd: VAULT_SPD, t: 0.4, ramp: 0.001, through: true, over: true, step: (p, mv) => vaultStep(p, mv),
  pose: (p) => ({ dx: 0, dy: -Math.round(VAULT_UP * Math.sin(Math.PI * Math.min(1, 1 - p.rushT / (p.clVaultT || 1)))), rot: 0 }) }; // up and over, and down
function vaultStep(p, mv) {
  const there = Math.hypot(p.reelX - p.x, p.reelY - p.y) <= 3;
  if (!there && !mv.blockedX && !mv.blockedY && p.rushT > 0) return;
  if (there || p.rushT <= 0) { p.x = p.reelX; p.y = p.reelY; } // down on the spot it was aimed at
  else vaultSettle(p);                                          // stopped short by a building: down clear of what he was over
  p.rushT = 0; p.dash = '';
  p.vx = p.rushNX * 20; p.vy = p.rushNY * 20;
  vaultLand(p);
}
// Down off a vault cut short (a building ahead, a stun in the air) while over a
// pine, a rock or the water: back along the line he came to the nearest spot
// his body fits, else the spot he was headed for, so nothing pins him inside it.
function vaultSettle(p) {
  p.clAir = false;
  if (vaultFits(p, p.x, p.y)) return;
  for (let d = 4; d <= VAULT_LEN + VAULT_REACH; d += 4) {
    const x = p.x - p.rushNX * d, y = p.y - p.rushNY * d;
    if (vaultFits(p, x, y)) { p.x = x; p.y = y; return; }
  }
  p.x = p.reelX; p.y = p.reelY;
}
function vaultLand(p) {
  p.clAir = false;
  for (const q of unitsHit(p, p.x, p.y, VAULT_HIT_R)) {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    hurtUnit(q, p.clVaultDmg, (q.x - p.x) / d, (q.y - p.y) / d, p, { kb: 20, ab: 'vault' });
    if (!q.dead) slowUnit(q, VAULT_SLOW_T, p.clVaultSlow);
  }
  for (const s of structsNear(p, p.x, p.y, VAULT_HIT_R)) hurtStruct(s, p.clVaultDmg, p);
  if (PRACTICE) abHitDummies(p.x, p.y, VAULT_HIT_R, p.clVaultDmg);
  burst(p.x, p.y + 4, '#f4f7ff', 10, 50, 0.45, true);
  sfxAt('hit', p.x, p.y);
}

// ---- R ROPE RING -------------------------------------------------------------------------------
function clivusRing(p) {
  const dmg = abDmg(p, 'ring', abRk(p, 'ring', 'dmg'));
  for (const q of unitsHit(p, p.x, p.y, RING_CAST_R)) { // struck, and thrown inward off the rope
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    hurtUnit(q, dmg, -(q.x - p.x) / d, -(q.y - p.y) / d, p, { kb: d > RING_R - 12 ? 40 : 0, ab: 'ring' });
  }
  for (const s of structsNear(p, p.x, p.y, RING_CAST_R)) hurtStruct(s, dmg, p);
  if (PRACTICE) abHitDummies(p.x, p.y, RING_CAST_R, dmg);
  // the rope: every open tile on a circle half a tile past it is a wall to rivals while it
  // stands, so the tiles' inner edges, where a body stops, fall about on the rope as drawn
  const tiles = [], wr = RING_R + TILE / 2;
  for (let k = 0, n = Math.ceil(2 * Math.PI * wr / 3); k < n; k++) {
    const a = k / n * 2 * Math.PI;
    const tx = Math.floor((p.x + Math.cos(a) * wr) / TILE), ty = Math.floor((p.y + Math.sin(a) * wr) / TILE);
    if (!inWorld(tx, ty) || objects[idx(tx, ty)]) continue;
    const t = idx(tx, ty);
    if (!tiles.includes(t)) tiles.push(t);
  }
  clivusRings.push({ x: Math.round(p.x), y: Math.round(p.y), r: RING_R, team: p.team, owner: p.id, t: 0, life: abRk(p, 'ring', 't'), tiles });
  for (let k = 0; k < 8; k++) burst(p.x + Math.cos(k * Math.PI / 4) * RING_R, p.y + Math.sin(k * Math.PI / 4) * RING_R, '#f4f7ff', 3, 40, 0.4, true);
  sfxAt('chop', p.x, p.y);
}
function updateClivusRings(dt) {
  for (let i = clivusRings.length - 1; i >= 0; i--) if ((clivusRings[i].t += dt) >= clivusRings[i].life) clivusRings.splice(i, 1);
}
// a tile under a ring's rope is a wall to every body not of its side (HERO_SOLID,
// isSolidTile); a shot, or a path asked with no body, goes over it
function ringSolid(tx, ty, e) {
  if (!clivusRings.length || !e) return false;
  const k = idx(tx, ty);
  for (const g of clivusRings) if (unitTeam(e) !== g.team && g.tiles.includes(k)) return true;
  return false;
}

// ---- the hooks he registers (js/sim/heroes.js) ------------------------------------------
HERO_PASSIVE.foothold = { cast: clivusCast, deal: clivusDeal, tick: clivusTick, out: clivusOut,
  name: 'FOOTHOLD', blurb: 'EVERY ABILITY YOU USE GIVES YOU A FOOTHOLD: YOUR NEXT BASIC ATTACK WITHIN A FEW SECONDS HITS HARDER.', icon: CLIVUS_ICON32.foothold };
HERO_SOLID.push(ringSolid);
HERO_TICK.push((dt) => { updateClivusRopes(dt); updateClivusRings(dt); });
