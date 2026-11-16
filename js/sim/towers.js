'use strict';
// The towers: two stone towers on each lane a side, stood by the map at boot,
// each with a great crossbow on its deck (drawn by js/draw/towers.js).
// ------------------------------------------------------------ towers
// THE TOWERS (STRUCTS.tower, structures.js): placeTowers stands four a side
// at boot, two on each lane - the OUTER one on the lane's straight, the INNER
// one on its bend by the perch (TOWER_SPOTS) - on the lane's centreline, so
// the waves walk round its foot. A tower is the map's, not a wallet's:
// `fixed` (nobody upgrades, repairs or pulls it down), owner -1, never on the
// build wheel. It holds its stretch of lane:
//
// THE GUN is a crossbow on a turntable. It turns at TOWER_TRAVERSE onto its
// mark, WINDS for TOWER_WIND once it is on it - the string coming back is the
// warning, and a hero under it sees the line it is aimed down (the aim line,
// drawTowerFx) - and looses ONE bolt, which strikes its mark TOWER_BOLT_T
// later wherever it has run to (a bolt is never dodged by a step, only by
// leaving the ring before the loose), and stands in the snow beside it.
// Then TOWER_RELOAD of winding before the next.
//
// WHAT IT SHOOTS, in this order (towerMark), so it punishes a dive without
// freezing the lane: (1) a rival hero who has just hurt one of the tower's
// own side's heroes standing inside its ring (TOWER_CALL_T, read off the
// victim's foeHits, player.js) - the dive answered at once, mid-wind or not;
// (2) the mark it already holds, while it stays in the ring; (3) the nearest
// rival bot (a wave's soldier); (4) the nearest rival hero.
// A wave walking in under it soaks the bolts, so the heroes with it may hit
// the tower freely; a hero alone under it is shot, and every bolt in a row
// into the same hero hits harder (TOWER_HEAT).
const TOWER_RANGE = 112;        // px from the tower's foot a mark is taken and held inside
const TOWER_TRAVERSE = 3.2;     // rad/s the gun turns
const TOWER_LOCK = 0.2;         // rad: inside this of the mark's bearing, it winds
const TOWER_WIND = 0.7;         // s from on the mark to the loose: the warning
const TOWER_RELOAD = 1.6;       // s after a loose before it can wind again
const TOWER_BOLT_T = 0.2;       // s a bolt is in the air
const TOWER_DMG_BOT = 15;       // a bolt into a bot: two scrap a soldier
const TOWER_DMG = 24;           // the first bolt into a hero...
const TOWER_HEAT = 0.4;         // ...and this much more for each one before it in a row into the same hero
const TOWER_HEAT_MAX = 2;       // ...up to three times the first
const TOWER_CALL_T = 1.2;       // s: a rival who hurt one of the side's heroes in the ring this recently is the mark
const TOWER_GUN_Z = 80;         // px above the foot the gun stands: where a bolt leaves, for the spent bolt's lean
const TOWER_PIN_T = 4;          // s a spent bolt stands in the snow
// RED's two on the top lane, as the 3x2 footprint's top-left tile: the outer
// on the straight (its middle at field x 54.5, on the centreline), the inner
// on the bend by the perch. The bottom lane's are these mirrored across the
// middle row, BLUE's across the middle column (fieldFour), so all eight
// stand on the lane's centreline. `lane`: which lane each holds (aiRally).
const TOWER_SPOTS = [[53, 36], [11, 47]];

// where a tower's ring is measured from: the middle of its foot
function towerFoot(o) { return { x: (o.tx + structW(o) / 2) * TILE, y: (o.ty + structH(o)) * TILE - 6 }; }

function placeTowers() {
  const w = structW('tower'), h = structH('tower');
  for (const [ax, ay] of TOWER_SPOTS) {
    fieldFour(ax, ay).forEach(([x, y], k) => {
      const tx = k % 2 ? x - w : x, ty = k >= 2 ? y - h : y; // a mirrored corner is the far one of its footprint
      for (const [fx, fy] of footprint('tower', tx, ty)) objects[idx(fx, fy)] = null;
      const o = createStruct(tx, ty, 'tower', { id: -1, team: k % 2 }, false);
      o.lane = k >= 2 ? 1 : 0;
    });
  }
}

// ---- the gun ----------------------------------------------------------------
// a body that may be a tower's mark: alive, a rival's, and (a hero) seen by its side (seenAt)
function towerHolds(o, tg, foot) {
  if (!unitAlive(tg) || tg.team === undefined || tg.team === o.team) return false;
  const d = Math.hypot(tg.x - foot.x, tg.y - foot.y);
  return tg instanceof Player ? d <= seenAt(tg, TOWER_RANGE, o.team) : d <= TOWER_RANGE;
}
// the dive: a rival hero in the ring who hurt one of this side's heroes in
// the ring inside TOWER_CALL_T - the latest of them
function towerCall(o, foot) {
  let best = null, bt = -1;
  for (const q of players) {
    if (!q.active || q.dead || q.team !== o.team || !q.foeHits) continue;
    if (Math.hypot(q.x - foot.x, q.y - foot.y) > TOWER_RANGE) continue;
    for (const id in q.foeHits) {
      const t = q.foeHits[id], r = players[id];
      if (state.elapsed - t <= TOWER_CALL_T && t > bt && r && towerHolds(o, r, foot)) { bt = t; best = r; }
    }
  }
  return best;
}
// WHAT IT SHOOTS: the order in the banner above
function towerMark(o, foot) {
  const call = towerCall(o, foot);
  if (call) return call;
  if (o.tgt && towerHolds(o, o.tgt, foot)) return o.tgt;
  let best = null, bd = Infinity;
  for (const b of robots) {
    if (!towerHolds(o, b, foot)) continue;
    const d = Math.hypot(b.x - foot.x, b.y - foot.y);
    if (d < bd) { bd = d; best = b; }
  }
  if (best) return best;
  for (const q of players) {
    if (!towerHolds(o, q, foot)) continue;
    const d = Math.hypot(q.x - foot.x, q.y - foot.y);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
// one step of a tower (updateStructures): the mark, the turn, the wind, the
// loose, the bolt in the air and the spent one in the snow
function updateTower(o, dt) {
  const foot = towerFoot(o);
  if (o.pin && (o.pin.t -= dt) <= 0) o.pin = null;
  if (o.bolt) towerBolt(o, foot, dt);
  o.cd = Math.max(0, (o.cd || 0) - dt);
  const tg = towerMark(o, foot);
  if (tg !== o.tgt) { o.tgt = tg; o.chg = 0; }
  if (!tg) { o.chg = Math.max(0, (o.chg || 0) - dt * 2); return; }
  const want = Math.atan2(tg.y - foot.y, tg.x - foot.x);
  let da = want - (o.ang || 0);
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const step = TOWER_TRAVERSE * dt;
  o.ang = (o.ang || 0) + Math.max(-step, Math.min(step, da));
  if (Math.abs(da) > TOWER_LOCK || o.cd > 0) return;
  o.chg = Math.min(1, (o.chg || 0) + dt / TOWER_WIND);
  if (o.chg < 1) return;
  // THE LOOSE: one bolt, worth more for every one before it into the same hero
  const hero = tg instanceof Player;
  o.heat = hero && o.heatId === tg.id ? Math.min(TOWER_HEAT_MAX, (o.heat || 0) + TOWER_HEAT) : 0;
  o.heatId = hero ? tg.id : -1;
  o.bolt = { tg, t: 0, dmg: hero ? Math.round(TOWER_DMG * (1 + o.heat)) : TOWER_DMG_BOT };
  o.chg = 0; o.cd = TOWER_RELOAD; o.loose = state.elapsed;
  sfxAt('turretFire', foot.x, foot.y - TOWER_GUN_Z);
  burst(foot.x + Math.cos(o.ang) * 12, foot.y - TOWER_GUN_Z + Math.sin(o.ang) * 6, '#eef4fb', 5, 45, 0.3, true);
}
// the bolt in the air: it strikes its mark when its time is up, through the
// one blow every body takes, and stands in the snow at its feet
function towerBolt(o, foot, dt) {
  const b = o.bolt;
  b.t += dt;
  if (b.t < TOWER_BOLT_T) return;
  o.bolt = null;
  if (!unitAlive(b.tg)) return;
  const tg = b.tg, dx = tg.x - foot.x, dy = tg.y - foot.y, d = Math.hypot(dx, dy) || 1;
  hurtUnit(tg, b.dmg, dx / d, dy / d, null, { cause: 'tower', kb: 40 });
  o.pin = { x: tg.x + dx / d * 7, y: tg.y + 3 + dy / d * 3, fx: foot.x, fy: foot.y - TOWER_GUN_Z, t: TOWER_PIN_T };
  sfxAt('rockLand', o.pin.x, o.pin.y);
  burst(o.pin.x, o.pin.y, '#eef4fb', 8, 50, 0.45, true);
  burst(tg.x, tg.y - 6, '#cfd8e8', 6, 45, 0.4, true);
}
// the nearest rival road tower inside r of (x, y), or null: what a wave
// turns on before it marches on (updateSoldier, robots.js) and what a bot
// pushing with it takes down (aiLaneFort, js/ai/ai.js)
function towerNear(team, x, y, r) {
  let best = null, bd = r;
  for (const o of structures) {
    if (o.type !== 'tower' || o.team === team) continue;
    const f = towerFoot(o), d = Math.hypot(f.x - x, f.y - y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
// is a bot of `team` standing in the tower's ring - the wave it will shoot
// first (towerMark), so a hero with it can hit the tower
function towerTanked(o, team) {
  const f = towerFoot(o);
  for (const b of robots) if (b.team === team && unitAlive(b) && Math.hypot(b.x - f.x, b.y - f.y) <= TOWER_RANGE) return true;
  return false;
}
