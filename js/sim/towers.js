'use strict';
// The road towers: two stone towers on each zipline, stood by the map at
// boot, each with a great crossbow on its deck; and each cable cut back to
// its furthest standing tower (drawn by js/draw/towers.js).
// ------------------------------------------------------------ road towers
// THE ROAD TOWERS (STRUCTS.tower, structures.js): placeTowers stands two on
// every cable at boot (a side with a cable per lane gets two a lane) - the OUTER one on the cable's front end, the
// INNER one on the pylon halfway home - after placeZips and before
// anything else claims the shoulder, on pure reads like the cable's own
// pylons, so genWorld and every seed's ground are untouched. A tower is the
// map's, not a wallet's: `fixed` (nobody upgrades, repairs or pulls it
// down), owner -1, never on the build wheel. It holds its stretch of road:
//
// THE GUN is a crossbow on a turntable. It turns at TOWER_TRAVERSE onto its
// mark, WINDS for TOWER_WIND once it is on it - the string coming back is the
// warning, and a scout under it sees the line it is aimed down (the aim line,
// drawTowerFx) - and looses ONE bolt, which strikes its mark TOWER_BOLT_T
// later wherever it has run to (a bolt is never dodged by a step, only by
// leaving the ring before the loose), and stands in the snow beside it.
// Then TOWER_RELOAD of winding before the next.
//
// WHAT IT SHOOTS, in this order (towerMark), so it punishes a dive without
// freezing the lane: (1) a rival scout who has just hurt one of the tower's
// own side's scouts standing inside its ring (TOWER_CALL_T, read off the
// victim's foeHits, player.js) - the dive answered at once, mid-wind or not;
// (2) the mark it already holds, while it stays in the ring; (3) the nearest
// rival bot (a wave's soldier); (4) the nearest rival scout.
// A wave walking in under it soaks the bolts, so the scouts with it may hit
// the tower freely; a scout alone under it is shot, and every bolt in a row
// into the same scout hits harder (TOWER_HEAT).
//
// THE CABLE: each line runs from its bird only as far as its furthest
// standing tower (o.zl is the line, o.zi its point) - the outer one while it stands, then the inner one, then
// no cable at all (towersSync). Losing a tower shortens your ride and
// lengthens your walk to the fight. zips[line] is cut IN PLACE from the
// whole line placeZips laid (zipWhole), so every reader of the cable -
// the ride, the hover, the bots' worth, the soldiers' boarding, both maps,
// the draw - reads the cut one and nothing else has to know.
const TOWER_AT = [0.5, 1];      // share of a side's cable, base -> front, the inner and the outer tower stand at
const TOWER_RANGE = 112;        // px from the tower's foot a mark is taken and held inside
const TOWER_TRAVERSE = 3.2;     // rad/s the gun turns
const TOWER_LOCK = 0.2;         // rad: inside this of the mark's bearing, it winds
const TOWER_WIND = 0.7;         // s from on the mark to the loose: the warning
const TOWER_RELOAD = 1.6;       // s after a loose before it can wind again
const TOWER_BOLT_T = 0.2;       // s a bolt is in the air
const TOWER_DMG_BOT = 15;       // a bolt into a bot: two scrap a soldier
const TOWER_DMG = 24;           // the first bolt into a scout...
const TOWER_HEAT = 0.4;         // ...and this much more for each one before it in a row into the same scout
const TOWER_HEAT_MAX = 2;       // ...up to three times the first
const TOWER_CALL_T = 1.2;       // s: a rival who hurt one of the side's scouts in the ring this recently is the mark
const TOWER_GUN_Z = 80;         // px above the foot the gun stands: where a bolt leaves, for the spent bolt's lean
const TOWER_PIN_T = 4;          // s a spent bolt stands in the snow
const zipWhole = [];            // [line] -> that cable as placeZips laid it, uncut (a line is its index in zips)

// where a tower's ring is measured from: the middle of its foot
function towerFoot(o) { return { x: (o.tx + structW(o) / 2) * TILE, y: (o.ty + structH(o)) * TILE - 6 }; }

function placeTowers() {
  zipWhole.length = 0;
  // every cable gets its own two: a side with a cable per lane gets two a lane
  zips.forEach((z, L) => {
    if (!z) return;
    const w = zipWhole[L] = Object.assign({}, z, { pts: z.pts.slice(), cum: z.cum.slice() }); // every field the line carries (team, lane)
    const n = z.pts.length - 1;
    for (const f of TOWER_AT) {
      const i = Math.max(1, Math.min(n, Math.round(n * f)));
      const o = towerStand(z.team, z.pts[i]);
      if (!o) continue;
      o.zl = L; o.zi = i; // the cable and its point it holds: the line is cut here once it is the furthest standing
      const c = structCenter(o);
      w.pts[i] = { x: c.x, y: c.y - 4 }; // the cable ties into the tower's wall
    }
    w.cum = [0];
    for (let i = 1; i < w.pts.length; i++) w.cum.push(w.cum[i - 1] + Math.hypot(w.pts[i].x - w.pts[i - 1].x, w.pts[i].y - w.pts[i - 1].y));
    w.len = w.cum[w.cum.length - 1];
  });
  towersSync();
}
// a tower on the cable's point `at` (a pylon's): the 3x2 footprint nearest
// it (inside TOWER_SEEK tiles) whose every tile is in the world, clear of
// the cistern's stone and holding nothing but the pylon or scenery the lane
// fells - the pylon and the scenery give way. Plain snow first; only if no
// footprint of snow is near does one take road tiles (never ice, water or a
// ford). Null if none will stand.
const TOWER_SEEK = 6;   // tiles from its pylon a tower's footprint is looked for
const TOWER_CLEAR = 1;  // tiles round a tower (one more in front) the lane's pines and rocks give way
function towerStand(team, at) {
  const tx0 = Math.floor(at.x / TILE), ty0 = Math.floor((at.y + 4) / TILE);
  const w = structW('tower'), h = structH('tower'), offs = [];
  for (let dy = -TOWER_SEEK; dy <= TOWER_SEEK; dy++) for (let dx = -TOWER_SEEK; dx <= TOWER_SEEK; dx++) offs.push([dx, dy]);
  offs.sort((a, b) => a[0] * a[0] + a[1] * a[1] - b[0] * b[0] - b[1] * b[1] || a[1] - b[1] || a[0] - b[0]);
  for (const road of [false, true]) for (const [dx, dy] of offs) {
    const ax = tx0 + dx - (w >> 1), ay = ty0 + dy - (h - 1);
    const tiles = footprint('tower', ax, ay);
    const ok = tiles.every(([x, y]) => {
      if (!inWorld(x, y) || waterAt(x, y) || cisternTouches(x, y)) return false;
      const g = ground[idx(x, y)], o = objects[idx(x, y)];
      return (g === 0 || (road && g === 3)) && (!o || o.type === 'pylon' || laneFells(o));
    });
    if (!ok) continue;
    for (const [x, y] of tiles) objects[idx(x, y)] = null;
    // the pylon it replaces gives way (the cable ties into the tower), and
    // so does the lane's scenery round it, TOWER_CLEAR tiles out and more in
    // front, so no pine stands over the tower's face
    const pq = objects[idx(tx0, ty0)];
    if (inWorld(tx0, ty0) && pq && pq.type === 'pylon') objects[idx(tx0, ty0)] = null;
    for (let y = ay - TOWER_CLEAR; y < ay + h + TOWER_CLEAR + 1; y++) for (let x = ax - TOWER_CLEAR; x < ax + w + TOWER_CLEAR; x++) {
      if (inWorld(x, y) && objects[idx(x, y)] && laneFells(objects[idx(x, y)])) objects[idx(x, y)] = null;
    }
    return createStruct(ax, ay, 'tower', 0, { id: -1, team }, false);
  }
  return null;
}
// THE CUT: each cable, from its bird to the furthest standing tower on it,
// or none. Asked every step by the sim (updateStructures) and every
// frame by the draw (drawZips), since a client never steps the sim - the
// towers it reads come over the wire with the tiles. A rider past the new
// end lets go on its next step (zipRide).
function towersSync() {
  zipWhole.forEach((w, L) => {
    if (!w) return;
    let far = -1;
    for (const o of structures) if (o.type === 'tower' && o.zl === L && o.zi > far) far = o.zi;
    const z = zips[L];
    if (far < 0) { zips[L] = null; return; }
    if (z && z.cut === far) return;
    zips[L] = Object.assign({}, w, { pts: w.pts.slice(0, far + 1), cum: w.cum.slice(0, far + 1), len: w.cum[far], cut: far });
  });
}

// ---- the gun ----------------------------------------------------------------
// a body that may be a tower's mark: alive, a rival's, and (a scout) seen by its side (seenAt)
function towerHolds(o, tg, foot) {
  if (!unitAlive(tg) || tg.team === undefined || tg.team === o.team) return false;
  const d = Math.hypot(tg.x - foot.x, tg.y - foot.y);
  return tg instanceof Player ? d <= seenAt(tg, TOWER_RANGE, o.team) : d <= TOWER_RANGE;
}
// the dive: a rival scout in the ring who hurt one of this side's scouts in
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
  // THE LOOSE: one bolt, worth more for every one before it into the same scout
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
// first (towerMark), so a scout with it can hit the tower
function towerTanked(o, team) {
  const f = towerFoot(o);
  for (const b of robots) if (b.team === team && unitAlive(b) && Math.hypot(b.x - f.x, b.y - f.y) <= TOWER_RANGE) return true;
  return false;
}
