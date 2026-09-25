'use strict';
// The valley's story landmarks - an abandoned sled, an ice-fishing shack, a
// boat frozen into a lake: scenery placed from the seed where it makes sense,
// and the sled's ride.
// ------------------------------------------------------------ landmarks
// A landmark is one entry here, one sprite (SPRITES.landmark, js/sprites/
// landmarks.js) and nothing else: the entry becomes an OBJECTS row below, the
// draw pass and the cast shade read it (js/draw/landmarks.js), and
// placeLandmarks stands it where its `where` rule allows.
//   w, h     the footprint in tiles; the anchor is the front-left tile and the
//            parts are stamped east and north of it, as the hog hut's are
//   solid    blocks a walker (the shack and the boat) or not (the sled)
//   where    a LM_WHERE rule: which tiles an anchor may take
//   count    how many a map stands, if the seed finds room for them
//   mirror   stood in pairs, one in each side's half, reflected across the
//            diagonal the way the camps are (a thing a player USES is fair)
//   spacing  tiles between two of the same kind
//   art      the SPRITES.landmark key; foot lowers it past the anchor's foot
//            row (a snow bank that spills onto the tile in front)
//   ride     the sled: E beside it gets on (the `the sled` group below)
//   mm       the minimap's colour
const LANDMARKS = {
  sled:  { w: 1, h: 1, solid: false, where: 'path',  count: 2, mirror: true, spacing: 40, art: 'sled',  foot: 0, ride: true, mm: [163, 121, 79] },
  shack: { w: 2, h: 2, solid: true,  where: 'shore', count: 2, spacing: 50, art: 'shack', foot: 2, mm: [142, 90, 72] },
  boat:  { w: 3, h: 1, solid: true,  where: 'lake',  count: 2, spacing: 50, art: 'boat',  foot: 3, mm: [142, 90, 72] },
};
const LM_GAP = 14;       // tiles between any two landmarks, whatever their kind
const LM_CAMP_GAP = 8;   // tiles past a camp's clearing (r + 2) nothing stands
const LM_ROOST_GAP = 16; // tiles past the roost disc (ROOST_R) nothing stands: the eagles land, the merchant builds there
const LM_ZIP_GAP = 48;   // px from either side's cable a sled keeps, so E beside it is never the zipline's
const LM_LAKE_DEEP = 4;  // tiles in from the shore that make a lake, not a river (the rivers are ~5 wide: 3 at most)

// the entries are scenery like any other: inert to E's work verbs (no `tool`)
for (const k in LANDMARKS) {
  const L = LANDMARKS[k];
  OBJECTS[k] = { solid: L.solid, w: L.w, h: L.h, mm: L.mm };
}

// Where an anchor may stand, per rule: (tx, ty, L, depth) -> ok. `depth` is
// the ice's distance from the shore, 1 on the edge (lmIceDepth). Every
// footprint tile is already known to be in the world and empty.
const LM_WHERE = {
  // beside a road or a path: open snow, and a paved tile one or two steps off
  path: (tx, ty) => {
    if (ground[idx(tx, ty)] !== 0) return false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue;
      if (inWorld(tx + dx, ty + dy) && ground[idx(tx + dx, ty + dy)] === 3) return true;
    }
    return false;
  },
  // on a lake's ice along its shore, with deep ice close by (a lake, not a river)
  shore: (tx, ty, L, depth) => {
    for (const [x, y] of lmFoot(tx, ty, L)) { const d = depth[idx(x, y)]; if (d < 1 || d > 2) return false; }
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      if (inWorld(tx + dx, ty + dy) && depth[idx(tx + dx, ty + dy)] >= LM_LAKE_DEEP) return true;
    }
    return false;
  },
  // out on a lake: every footprint tile deep ice
  lake: (tx, ty, L, depth) => {
    for (const [x, y] of lmFoot(tx, ty, L)) if (depth[idx(x, y)] < LM_LAKE_DEEP) return false;
    return true;
  },
};

// the tiles a landmark covers from its anchor: w east, h north
function lmFoot(tx, ty, L) {
  const r = [];
  for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) r.push([tx + i, ty - j]);
  return r;
}

// per tile, how far into the ice it is: 1 on the shore, 0 off the ice. The
// draw's lakeDepth says the same thing for the painter, but it is baked
// later and by the draw; placement is the sim's and reads its own
function lmIceDepth() {
  const N = WORLD * WORLD, depth = new Uint8Array(N), q = new Int32Array(N);
  let head = 0, tail = 0;
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    const i = idx(tx, ty);
    if (ground[i] !== 1) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inWorld(tx + dx, ty + dy) || ground[idx(tx + dx, ty + dy)] !== 1) { depth[i] = 1; q[tail++] = i; break; }
    }
  }
  while (head < tail) {
    const i = q[head++], tx = i % WORLD, ty = (i / WORLD) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = tx + dx, y = ty + dy;
      if (!inWorld(x, y)) continue;
      const j = idx(x, y);
      if (ground[j] === 1 && !depth[j]) { depth[j] = Math.min(255, depth[i] + 1); q[tail++] = j; }
    }
  }
  return depth;
}

// the rules every landmark keeps whatever its kind: the footprint empty and
// the tiles round it clear of anything standing, out of the camps and the
// roosts, and (for a ride) off the zipline
function lmClear(tx, ty, L) {
  for (const [x, y] of lmFoot(tx, ty, L)) if (!inWorld(x, y) || objects[idx(x, y)]) return false;
  for (let y = ty - L.h; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + L.w; x++) {
    if (!inWorld(x, y)) return false;
    const o = objects[idx(x, y)];
    if (o && isSolidTile(x, y)) return false;
  }
  for (const C of camps) if (Math.hypot(tx - C.tx, ty - C.ty) < C.r + 2 + LM_CAMP_GAP) return false;
  const roost = ROOST_R + LM_ROOST_GAP;
  if (Math.hypot(tx, WORLD - 1 - ty) < roost || Math.hypot(WORLD - 1 - tx, ty) < roost) return false;
  if (L.ride) {
    for (const z of zips) if (z && zipNearest(z, (tx + 0.5) * TILE, (ty + 0.5) * TILE).dist < LM_ZIP_GAP) return false;
  }
  return true;
}

const landmarks = []; // every landmark stood this match: { key, tx, ty } (the sled's home for its respawn)

// Worldgen's landmark pass (boot.js, after placeRocks): each kind in table
// order takes its count of anchors from the tiles its rule allows, in an
// order shuffled on a stream of its own - mulberry32(SEED ^ 'LMRK') - so it
// never touches the shared rng() and every existing seed keeps its terrain.
// It writes only `objects`. A seed that has no room for one stands fewer.
function placeLandmarks() {
  const rnd = mulberry32(SEED ^ 0x4c4d524b);
  const depth = lmIceDepth();
  for (const key in LANDMARKS) {
    const L = LANDMARKS[key], ok = LM_WHERE[L.where];
    const cand = [];
    for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
      // a mirrored kind looks in the bottom-left side's half only, and wants
      // its reflection (ty, tx) to pass too
      if (L.mirror && tx >= ty - 4) continue;
      if (lmClear(tx, ty, L) && ok(tx, ty, L, depth) && (!L.mirror || (lmClear(ty, tx, L) && ok(ty, tx, L, depth)))) cand.push(idx(tx, ty));
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
    let stood = 0;
    for (const c of cand) {
      if (stood >= L.count) break;
      const tx = c % WORLD, ty = (c / WORLD) | 0;
      const at = L.mirror ? [[tx, ty], [ty, tx]] : [[tx, ty]];
      // the gaps are read against what has stood so far, and a clear check
      // again, since an earlier pick may have filled the tiles round this one
      if (!at.every(([x, y]) => lmClear(x, y, L) && landmarks.every((m) =>
        Math.hypot(m.tx - x, m.ty - y) >= (m.key === key ? L.spacing : LM_GAP)))) continue;
      for (const [x, y] of at) lmStand(key, x, y);
      stood += at.length;
    }
  }
}
// one landmark onto its anchor, its footprint's other tiles filled with parts
function lmStand(key, tx, ty) {
  const L = LANDMARKS[key];
  const o = placeObj(tx, ty, key, { home: landmarks.length });
  for (const [x, y] of lmFoot(tx, ty, L)) {
    if (x === tx && y === ty) continue;
    objects[idx(x, y)] = { type: 'part', tx: x, ty: y, of: o, flash: 0, shake: 0 };
  }
  landmarks.push({ key, tx, ty, t: 0 });
  return o;
}

// ---- the sled ------------------------------------------------------------
// E beside an abandoned sled gets on: the hop intent every player's step
// reads (updatePlay, js/sim.js), so a remote hand's press lands like a local
// one and a bot could ride it the same way. The sled comes off its tile and
// rides under the body (p.sled); SLED_T seconds later it bursts into
// splinters and throws the rider off for SLED_DMG of their health. Getting
// off early - E again, a dodge - or being knocked off it (any blow, a stun,
// a root, a net, the water) breaks it with no harm done. Either way the sled
// is gone, and a new one stands at its spot SLED_BACK seconds later.
//
// The ride steers like a slide carrying momentum: the heading turns toward
// the stick at SLED_STEER, the speed eases toward the surface's cap while a
// direction is held and coasts down when it is not. The caps sit between a
// walk (PLAYER_SPEED 72) and the zipline (220): SLED_SNOW is 1.6 walks, and
// on ice it runs past a skater's ICE_MAX (150), where a sled belongs. Deep
// snow (the deep-snow map, when this build has one) bogs it down.
const SLED_T = 15;           // s a ride lasts before the sled gives out
const SLED_WARN = 3;         // s before the end it starts to rattle and flash
const SLED_DMG = 0.1;        // of the rider's max health the burst takes (never the last point)
const SLED_KB = 0.5;         // of a blow's usual shove the burst throws the rider
const SLED_BACK = 120;       // s until a new sled stands at the spot
const SLED_SNOW = 115;       // px/s cap on snow
const SLED_ICE = 170;        // px/s cap on ice
const SLED_DEEP = 0.55;      // the cap's share left in deep snow
const SLED_STEER = 2.6;      // rad/s the heading turns (a slide's is 1.7, a walk's 4.5)
const SLED_PUSH = 1.4;       // /s the speed rises toward the cap while a direction is held
const SLED_DRAG = 0.9;       // /s it falls to a lower cap (off the ice, into deep snow)
const SLED_COAST = 0.6;      // /s it bleeds with nothing held, on snow...
const SLED_COAST_ICE = 0.12; // ...and on ice
const SLED_REACH = 22;       // px from the body to the sled's tile centre that E reaches
const SLED_TRAIL = 40;       // px/s past which the runners cut the snow

// the sled a body can get on: one within reach, standing on its tile
function sledNear(p) {
  const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + 4) / TILE);
  let best = null, bd = SLED_REACH;
  for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
    const o = objAt(x, y);
    if (!o || !LANDMARKS[o.type] || !LANDMARKS[o.type].ride) continue;
    const d = Math.hypot((x + 0.5) * TILE - p.x, (y + 0.5) * TILE - (p.y + 4));
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
// the snow's grip on the sled: the deep-snow map's deepest band, if this build has one: the cap's share
function sledSurfaceMul(p) {
  return typeof deepAt === 'function' && deepAt(p.x, p.y + 4) ? SLED_DEEP : 1; // the feet, in world px (js/drifts.js)
}
// the hop intent on the ground, before the zipline's: riding, it gets off;
// beside a sled, it gets on. True when the sled took the press.
function sledToggle(p) {
  if (p.sled) { sledEnd(p, false); return true; }
  if (p.zip >= 0 || p.zipWalk) return false;
  const o = sledNear(p);
  if (!o) return false;
  sledStart(p, o);
  return true;
}
function sledStart(p, o) {
  if (p.dead || p.stunT > 0 || p.rootT > 0 || p.fallT > 0 || p.dodgeT > 0 || p.rushT > 0 || p.castT > 0 || p.shieldT > 0 || inAir(p)) return;
  if (p.grapT > 0) grapEnd(p);
  risePlayer(p);    // up out of the snow first
  breakEat(p);      // both hands on the sled's sides
  cancelCatch(p);
  if (p.charging) { p.charging = false; p.chargeT = 0; }
  p.fireArmed = false;
  p.sliding = false; p.slideT = 0;
  objects[idx(o.tx, o.ty)] = null;
  // it pushes off the way the body faces, at whatever speed it already had
  const f = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[p.dir] || [1, 0];
  p.sled = { t: SLED_T, home: o.home, hx: f[0], hy: f[1], face: f[0] < 0 ? -1 : 1 };
  p.x = (o.tx + 0.5) * TILE; p.y = (o.ty + 0.5) * TILE - 4;
  sfxAt('land', p.x, p.y);
  burst(p.x, p.y + 4, '#dfe8f4', 5, 30, 0.35, true);
}
// Off the sled, which breaks under you either way. `bust` is the sled giving
// out at the end of its time: splinters, SLED_DMG of the rider's health and a
// shove back along the way it was going. Anything else keeps the rider's
// speed for the surface model to spend, like a hop off the zipline.
function sledEnd(p, bust) {
  const s = p.sled;
  if (!s) return;
  p.sled = null;
  const home = landmarks[s.home];
  if (home) home.t = SLED_BACK;
  sfxAt('chop', p.x, p.y);
  burst(p.x, p.y + 5, '#8a6142', 10, 70, 0.6, true);
  burst(p.x, p.y + 5, '#a3794f', 6, 55, 0.5, true);
  burst(p.x, p.y + 6, '#dfe8f4', 6, 40, 0.4, true);
  if (!bust) return;
  p.vx = 0; p.vy = 0;
  const dmg = Math.min(Math.round(p.maxHp * SLED_DMG), p.hp - 1);
  if (dmg > 0) hurtUnit(p, dmg, -s.hx, -s.hy, null, { cause: 'sled', kbMul: SLED_KB });
  shakeFor(p, 3);
}
// one sim step of the ride (updatePlayer's movement ladder, after the
// zipline's): the clock, the steer, the speed, and the move
function sledStep(p, dt, mx, my, len) {
  const s = p.sled;
  s.t -= dt;
  if (s.t <= 0) { sledEnd(p, true); return; }
  p.sliding = false;
  const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + 4) / TILE);
  const onIce = inWorld(tx, ty) && ground[idx(tx, ty)] === 1;
  const cap = (onIce ? SLED_ICE : SLED_SNOW) * sledSurfaceMul(p) * abilityMoveMul(p);
  let sp = Math.hypot(p.vx, p.vy);
  let hx = s.hx, hy = s.hy;
  if (len > 0) {
    // carve toward the stick, never snap
    const cur = Math.atan2(hy, hx), want = Math.atan2(my, mx);
    let da = want - cur;
    if (da > Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    const na = cur + Math.max(-SLED_STEER * dt, Math.min(SLED_STEER * dt, da));
    hx = Math.cos(na); hy = Math.sin(na);
  }
  const target = len > 0 ? cap : 0;
  const rate = len > 0 ? (sp < cap ? SLED_PUSH : SLED_DRAG) : (onIce ? SLED_COAST_ICE : SLED_COAST);
  sp = target + (sp - target) * Math.exp(-rate * dt);
  if (sp > cap && len > 0) sp = cap + (sp - cap) * Math.exp(-SLED_DRAG * dt);
  s.hx = hx; s.hy = hy;
  if (Math.abs(hx) > 0.2) s.face = hx < 0 ? -1 : 1;
  p.vx = hx * sp; p.vy = hy * sp;
  const mv = moveEntity(p, (p.vx + p.kbx) * dt, (p.vy + p.kby) * dt, PLAYER_R);
  if (mv.blockedX) p.vx = 0;
  if (mv.blockedY) p.vy = 0;
  // the water takes the sled: into a hole, it breaks the way a knock does
  if (p.fallT > 0) sledEnd(p, false);
}

// the spots a broken sled comes back to (updatePlay, every step on the host):
// its clock runs down, then a new sled stands there - once the tile is empty
// and nobody is standing on it
function updateLandmarks(dt) {
  for (const m of landmarks) {
    if (m.t <= 0) continue;
    m.t -= dt;
    if (m.t > 0) continue;
    const x = (m.tx + 0.5) * TILE, y = (m.ty + 0.5) * TILE;
    let busy = !!objAt(m.tx, m.ty);
    for (const q of players) if (q.active && !q.dead && !inAir(q) && Math.hypot(q.x - x, q.y + 4 - y) < TILE) busy = true;
    if (busy) { m.t = 1; continue; } // try again in a second
    placeObj(m.tx, m.ty, m.key, { home: landmarks.indexOf(m) });
    burst(x, y + 4, '#dfe8f4', 6, 30, 0.4, true);
  }
}
