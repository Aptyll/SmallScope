'use strict';
// The valley's story landmarks - a boat frozen into a lake: scenery placed
// from the seed where it makes sense.
// ------------------------------------------------------------ landmarks
// A landmark is one entry here, one sprite (SPRITES.landmark, js/sprites/
// landmarks.js) and nothing else: the entry becomes an OBJECTS row below, the
// draw pass and the cast shade read it (js/draw/landmarks.js), and
// placeLandmarks stands it where its `where` rule allows.
//   w, h     the footprint in tiles; the anchor is the front-left tile and the
//            parts are stamped east and north of it, as the hog hut's are
//   solid    blocks a walker or not
//   where    a LM_WHERE rule: which tiles an anchor may take
//   count    how many a map stands, if the seed finds room for them
//   mirror   stood in pairs, one in each side's half, reflected across the
//            diagonal the way the camps are (a thing a player USES is fair)
//   spacing  tiles between two of the same kind
//   art      the SPRITES.landmark key; foot lowers it past the anchor's foot
//            row (a snow bank that spills onto the tile in front)
//   mm       the minimap's colour
const LANDMARKS = {
  boat:  { w: 3, h: 1, solid: true,  where: 'lake',  count: 2, spacing: 50, art: 'boat',  foot: 3, mm: [142, 90, 72] },
};
const LM_GAP = 14;       // tiles between any two landmarks, whatever their kind
const LM_CAMP_GAP = 8;   // tiles past a camp's clearing (r + 2) nothing stands
const LM_ROOST_GAP = 16; // tiles past the roost disc (ROOST_R) nothing stands: the eagles land, the merchant builds there
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
// roosts
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
  return true;
}

const landmarks = []; // every landmark stood this match: { key, tx, ty } (placeLandmarks' spacing reads it)

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
  const o = placeObj(tx, ty, key);
  for (const [x, y] of lmFoot(tx, ty, L)) {
    if (x === tx && y === ty) continue;
    objects[idx(x, y)] = { type: 'part', tx: x, ty: y, of: o, flash: 0, shake: 0 };
  }
  landmarks.push({ key, tx, ty });
  return o;
}
