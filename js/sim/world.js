'use strict';
// The frozen world: the tile grid and its objects, worldgen (rivers, ponds),
// the road and the creek. The zipline, the camps and the
// practice arena load right after it (js/sim/zipline.js, js/sim/camps.js, js/sim/practice.js).
// ------------------------------------------------------------ world
const ground = new Uint8Array(WORLD * WORLD); // 0 snow, 1 ice, 2 hole (open water), 3 the road (placeRoad)
const objects = new Array(WORLD * WORLD).fill(null);

function idx(tx, ty) { return ty * WORLD + tx; }
function inWorld(tx, ty) { return tx >= 0 && ty >= 0 && tx < WORLD && ty < WORLD; }
function objAt(tx, ty) { return inWorld(tx, ty) ? objects[idx(tx, ty)] : null; }

// Every scenery object that can stand on a tile, and everything generic code
// needs to know about one without naming its type: whether it blocks a walker,
// which tool E reaches for (`tool`) and which one a swing must already be
// holding (`needs`, null = any), whether the hands go to it on their own the
// moment it is in reach (`auto` - a tree, a snowdrop, a rival's eagle:
// autoWork, js/sim/actions.js - the dummy waits for E), the verb the key prompt prints and how far
// above the tile it sits, and the colour each of the two maps paints it.
// Buildings are NOT in here - they are STRUCTS entries carrying the same
// mm/map fields, and every site below asks that table first. Adding a scenery
// type is one entry here, plus its draw branch in render() and what a swing
// does to it in hitObject(): checklists.md#common-changes.
//
// THE CHART'S CLASSES (3.32). The minimap paints a tile the `mm` colour of
// what stands on it, but the parchment world map (renderWorldMap, panels.js)
// is not a picture of the tiles: every tile names one of these CLASSES and
// the chart flattens them into MASSES - a lone tile of anything is dropped,
// a pinhole is filled, each mass is inked with a rim - so it reads as a
// drawn chart, not a photograph of the ground. `map` on an OBJECTS/STRUCTS
// entry is a class, or a function of the object returning one; an entry
// with none lets the ground show through (a stump, a camp's
// props - the glyph marks those): at the chart's scale a thing that stands
// alone on its tile is a speck, and a speck is noise. The ORDER is the paint priority: where one chart
// pixel covers two tiles (WORLD tiles into MAP_W px) the higher class wins,
// so a one-tile wall never drops out of its run. A side's buildings and
// its eagle are two depths of the same ink, so a base reads as a shape in
// its colour with the bird bright at its heart - and both go through skin()
// like every other team paint. The cistern's stone (cisternTouches) inks last.
const CH_SNOW = 0, CH_FOREST = 1, CH_ROAD = 2, CH_ICE = 3, CH_HOLE = 4,
      CH_RED = 5, CH_BLUE = 6, CH_EAGLE_RED = 7, CH_EAGLE_BLUE = 8, CH_STONE = 9;
const chTeam = (o) => skin(o.team === undefined ? 0 : o.team) ? CH_BLUE : CH_RED;   // a side's building
const chPump = (o) => o.hold >= 0 ? (skin(o.hold) ? CH_BLUE : CH_RED) : CH_STONE; // a gold pump: its holder's, or nobody's grey (js/sim/pumps.js)
const chEagle = (o) => skin(o.team === undefined ? 0 : o.team) ? CH_EAGLE_BLUE : CH_EAGLE_RED; // its bird, its gate
const OBJECTS = {
  // lift 33: the pine's canopy reaches 21 px above its own tile (drawn at
  // py - 21), and the prompt clears it by the same 12 px everything else gets
  tree:     { solid: true,  work: true, verb: 'CHOP', lift: 33, auto: true,
              mm: [52, 100, 82],   map: CH_FOREST },
  // a SNOWDROP clump, stamped only by the warren camp (CAMPS.meadow): open
  // until someone picks it, when one pick shields the picker's whole company
  // (pickSnowdrop, js/sim/actions.js), and then resting SNOWDROP_CD seconds
  // (`readyAt`, the match second it opens again: snowdropLeft, below).
  // `ready` is what makes E and the hands reach for an open clump only. Off
  // both maps: a speck on the snow is noise.
  snowdrop: { solid: false, work: true, verb: 'PICK', lift: 14, auto: true,
              ready: (o) => snowdropLeft(o) <= 0 },
  // a camp's cave (the wolf den): inert scenery, two
  // tiles wide - `w` stamps a `part` filler per extra tile, east of the
  // anchor (placeCamps), so both tiles are solid and read back as the den
  den:      { solid: true,  w: 2, mm: [92, 86, 100] },
  // the HOG HUT camp's building (CAMPS.hut, js/sim/camps.js): 2x2, the anchor its
  // bottom-left tile - `h` stamps the parts NORTH of it, so the anchor is
  // the front row the y-sort reads - drawing the whole 35x35 sprite
  // (SPRITES.hogHut) centred over the pair. Inert to E like the den.
  hut:      { solid: true,  w: 2, h: 2, mm: [134, 97, 69] },
  // the merchant's STALL (pitched by updateMerchant, robots.js): 3x2 laid
  // out like the hut (anchor bottom-left, parts east and north), carrying
  // its `team` and its `merch`. No `tool` and no hp: nothing swings at it,
  // nothing shoots it, and it is in no `structures` list for a wave to
  // siege - the counter is as untouchable as its keeper. E in front of it
  // opens the shop (merchNear, js/ui/shop.js). `sight`: px of fog its side
  // sees round it (sightSources, js/sim/fog.js).
  stall:    { solid: true,  w: 3, h: 2, sight: 176, mm: (o) => mmTeam(o) },
  // the practice arena's target (the `practice arena` banner, js/sim/practice.js): any tool
  // hits it, it never falls, and it mends itself between combos. E swings,
  // every attack and the roll's tackle all land through hitDummy (js/sim/actions.js).
  dummy:    { solid: true,  work: true, verb: 'HIT', lift: 28,
              mm: [216, 178, 122] },
  // The training field's dressing (practice arena only): inert scenery like
  // the den - no `tool`, so E never offers them - drawn in the y-sorted pass.
  // the parkour gate's flag - and, carrying a `team`, the two pennant poles
  // at each of the road's mouths (placeRoad), which paint the maps in that
  // side's ink the way a roosting eagle does
  banner:   { solid: true,
              mm: (o) => o.team === undefined ? MM_BANNER : skin(o.team) ? MM_EAGLE_BLUE : MM_EAGLE_RED,
              map: (o) => o.team === undefined ? null : chEagle(o) },
  // the felled trunk across each forest road's far end (placeRoad): one
  // piece per tile along the cross-diagonal, `seg` 0/1/2 the up-left end,
  // the trunk, the down-right end. Solid and inert to E; its pixels are baked
  // flat into the ground (paintLog under paintGroundTile, draw-world.js),
  // never drawn in the y-sorted pass - a trunk on the ground is ground.
  // `leap`: a deer's leap clears it (rideLeap, js/sim/wildlife.js)
  log:      { solid: true,  leap: true, mm: [124, 94, 62] },
  // a zipline's pylon (placeZips, the `zipline` banner, js/sim/zipline.js): solid, inert
  // to E, carrying its `team`. Its pixels are PYLON_SPRS in render()'s
  // object pass (js/draw/zipline.js); the cable itself is not an object at
  // all - it hangs between the pylons' points (zips) and is drawn by drawZips.
  pylon:    { solid: true,  mm: [150, 156, 170] },
  // the parkour roll station (practice arena only): the die that rerolls the
  // track. Inert to E's work verbs like the rack - holding E beside it opens
  // the roll wheel (pkDieNear, the practice arena banner, js/sim/practice.js).
  pkdie:    { solid: true,  mm: [242, 204, 100] },
  // the archery range's bell (practice arena only): E beside it rings the
  // timed round on and off. Inert to E's work verbs like the die - the press
  // resolves through agBellNear (the practice arena banner, js/sim/practice.js).
  agbell:   { solid: true,  mm: [216, 158, 74] },
  stump:    { solid: false, mm: [188, 200, 218] },
  // a roosting team eagle's hitbox tiles (placed by eagleCrash, js/sim/eagle.js):
  // solid to walkers and a work target for RIVAL E swings only - workTarget
  // reads the `team` an object carries. Drawn by drawEagle, never the object
  // pass; the swing itself lands in hitObject's eagle branch (hurtEagle).
  eagle:    { solid: true,  work: true, verb: 'STRIKE', lift: 16, auto: true,
              mm: (o) => skin(o.team) ? MM_EAGLE_BLUE : MM_EAGLE_RED, map: chEagle },
  // a multi-tile building's (or a wide prop's) filler tiles: solid, and
  // structOf() has resolved them to their anchor long before either map sees one
  part:     { solid: true },
};
// A SNOWDROP's rest: a picked clump is a snapped stem for the first stretch
// of SNOWDROP_CD, a shut bud once it is within SNOWDROP_BUD_T of opening,
// and open again at zero - the plant is the clock, and a
// look under the pointer reads it exactly. A pure read of the match clock
// (state.elapsed against the clump's `readyAt`), so every machine agrees.
const SNOWDROP_CD = 90;     // s from a pick to the clump opening again
const SNOWDROP_BUD_T = 25;  // s left when the shut bud shows
function snowdropLeft(o) { return Math.max(0, (o.readyAt || 0) - state.elapsed); }
// the minimap's team inks: a roosting bird (and the road-mouth pennant) in
// the side's bright mark, its buildings a step deeper, so a base is a shape
// in its colour with the bird lit at the middle
const MM_EAGLE_RED = [224, 85, 72], MM_EAGLE_BLUE = [106, 168, 232];
const MM_TEAM_RED = [172, 68, 60], MM_TEAM_BLUE = [78, 128, 188];
const mmTeam = (o) => skin(o.team === undefined ? 0 : o.team) ? MM_TEAM_BLUE : MM_TEAM_RED; // STRUCTS' mm (structures.js)
const MM_PUMP = [150, 156, 172]; // a gold pump nobody holds
const mmPump = (o) => o.hold >= 0 ? (skin(o.hold) ? MM_TEAM_BLUE : MM_TEAM_RED) : MM_PUMP;
const MM_BANNER = [214, 88, 76]; // the practice gate's own red

// What stands on a tile, on each map: objMapColor is the `mm` colour the
// minimap disc paints it (an [r, g, b]), objChart the CH_* class the
// parchment chart files it under. One lookup each across both tables, so
// neither map carries a list of type names and a new type is coloured by its
// own entry alone. null = nothing here to paint, and the caller shows the
// ground underneath instead.
function objMapColor(o) {
  const d = OBJECTS[o.type] || STRUCTS[o.type];
  const c = d && d.mm;
  return typeof c === 'function' ? c(o) : (c || null);
}
function objChart(o) {
  const d = OBJECTS[o.type] || STRUCTS[o.type];
  const c = d && d.map;
  const v = typeof c === 'function' ? c(o) : c;
  return v == null ? null : v;
}
// what the minimap paints an object whose entry has no `mm` at all
const MM_UNKNOWN = [188, 200, 218];

// `e`, when given, is who is walking (a deer in mid-leap goes over what it
// would meet). `swept`: the caller holds the body to
// the cistern's stone by the pixel itself (moveEntity), so its tiles do not
// count here; to everyone else a tile whose middle is its stone is a wall
// (cisternTile, js/sim/cistern.js).
function isSolidTile(tx, ty, e, swept) {
  if (!inWorld(tx, ty)) return true;
  if (!swept && cisternTile(tx, ty)) return true;
  if (e && e.dash && heroDashOver(e)) { const o = objects[idx(tx, ty)]; return !!(o && STRUCTS[o.type]); } // a hero's dash over it all but a building (HERO_DASH `over`)
  if (heroSolid(tx, ty, e)) return true; // a wall a hero's kit lays for a while (HERO_SOLID, js/sim/heroes.js)
  const o = objects[idx(tx, ty)];
  if (!o) return false;
  // Two tables, no list: any STRUCTS entry (tower/barracks/pump)
  // is solid for free, and everything else answers from its OBJECTS
  // entry - so neither a new building nor a new kind of scenery ever needs
  // this function touched.
  if (STRUCTS[o.type]) return true;
  const d = OBJECTS[o.type];
  if (d && d.leap && e && e.leapT > 0) return false; // a deer in mid-leap goes over (js/sim/wildlife.js)
  return !!(d && d.solid);
}

// open water on a tile: a carved ice hole (ground 2). The one read for
// "nothing walks in here":
// every walker but a player treats it as a wall (moveEntity), no route
// crosses it (walkable), nothing spawns, lands or climbs out onto it. A
// player may step in, and plunges (updatePlayer).
function waterAt(tx, ty) {
  if (!inWorld(tx, ty)) return false;
  const g = ground[idx(tx, ty)];
  return g === 2;
}

// Multi-tile buildings. STRUCTS[type].w/h > 1 means the anchor tile (top-left)
// holds the building object and every other footprint tile holds a 'part'
// filler { type: 'part', of } pointing back at it, so objAt() on any covered
// tile is solid and structOf() resolves to the building. One object per tile
// still holds - the fillers are the object on their tile. structW/structH
// take the OBJECT or a bare type name.
function structW(x) { const S = STRUCTS[typeof x === 'string' ? x : x.type]; return (S && S.w) || 1; }
function structH(x) { const S = STRUCTS[typeof x === 'string' ? x : x.type]; return (S && S.h) || 1; }
function structOf(o) { return o && o.type === 'part' ? o.of : o; }
function footprint(type, tx, ty) {
  const r = [];
  for (let dy = 0; dy < structH(type); dy++) for (let dx = 0; dx < structW(type); dx++) r.push([tx + dx, ty + dy]);
  return r;
}
function structCenter(o) {
  return { x: (o.tx + structW(o) / 2) * TILE, y: (o.ty + structH(o) / 2) * TILE };
}
// where a building meets the ground in front: soldiers roll out of this point
function structMouth(o) {
  return { x: (o.tx + structW(o) / 2) * TILE, y: (o.ty + structH(o)) * TILE + 6 };
}
function placeObj(tx, ty, type, extra) {
  const o = Object.assign({ type, tx, ty, hp: 1, flash: 0, shake: 0 }, extra || {});
  return setTile(idx(tx, ty), o);
}
// a tile written during a match: the host's wire looks at it on its next flush
// (snapTouch, js/net/snapshot.js) instead of finding it on its slow sweep
function setTile(i, o) { objects[i] = o; snapTouch(i); return o; }

const cx = WORLD / 2, cy = WORLD / 2;

// six evenly spaced points on a ring 55 tiles in from the world edge (at the
// treeline): the frozen rivers run from each to the centre and round from one
// to the next, and the ponds and rivers keep clear of them (genWorld).
// RING_N is frozen at six ON PURPOSE: it stopped tracking the player count when
// the roster grew to ten, because player count must never reshape the terrain.
const SPAWN_D = WORLD / 2 - 55 * MAP_K;
const RING_N = 6;
const ringPts = [];
for (let i = 0; i < RING_N; i++) {
  const a = -Math.PI / 2 + (i / RING_N) * Math.PI * 2;
  ringPts.push({
    tx: Math.round(cx + Math.cos(a) * SPAWN_D),
    ty: Math.round(cy + Math.sin(a) * SPAWN_D),
  });
}

const BORDER_MIN = 30 * MAP_K, BORDER_MAX = 70 * MAP_K; // forest boundary depth range (avg ~50 at the old scale)
// The two ROOST corners - bottom-left and top-right, where the eagles always
// come down (makeEagles, eagle.js) - are forested to ROOST_R outright: a
// quarter-disc of woods UNIONED with the noise border, so whatever the seed
// grew there the corner holds one solid block for the bird to bury itself in,
// and the treeline its lane cuts to is at least the disc's arc (ROOST_R along
// the diagonal is ROOST_R / sqrt 2 ~ 48 tiles in). The union only ever ADDS
// trees: past the disc the border keeps every seed's own noise, and the arc
// itself wobbles ROOST_WOBBLE on the fine noise so it never reads as a compass
// stroke. Not under ARENA - the training field is its own collar.
const ROOST_R = 68 * MAP_K; // tiles from the corner
const ROOST_WOBBLE = 3;  // +- tiles the arc wanders

// depth of the forest boundary at a given tile: smooth irregular inner edge,
// always solid from the world edge inward (variation eats into the interior).
// borderNoise is the seed's own border alone; borderDepth is that OR the roost
// disc, and is what everything reads - genWorld's tree rule, the eagles'
// line, the lane. Neither rolls anything.
function borderNoise(tx, ty) {
  const K = MAP_K; // the noise stretches with the layout, so a bigger valley keeps the treeline's shapes
  let n = vnoise(tx / (22 * K), ty / (22 * K)) * 0.65 + vnoise(tx / (9 * K) + 40, ty / (9 * K) + 40) * 0.35;
  n = Math.max(0, Math.min(1, (n - 0.5) * 1.6 + 0.5)); // stretch toward full range
  return BORDER_MIN + (BORDER_MAX - BORDER_MIN) * n;
}
function borderDepth(tx, ty) {
  const d = warrenGrove(tx, ty, borderNoise(tx, ty));
  if (ARENA) return d;
  const c = Math.min(Math.hypot(tx, WORLD - 1 - ty), Math.hypot(WORLD - 1 - tx, ty)); // to the nearer roost corner
  if (c >= ROOST_R + ROOST_WOBBLE) return d;
  const R = ROOST_R + (vnoise(tx / 9 + 40, ty / 9 + 40) - 0.5) * 2 * ROOST_WOBBLE;
  if (c >= R) return d;
  // inside the disc: deeper than this tile's own edge distance by the tile's
  // depth into the disc, so genWorld's `edge < borderDepth` plants it and
  // the arc reads as one solid block round the base (js/sim/base.js)
  return Math.max(d, Math.min(tx, ty, WORLD - 1 - tx, WORLD - 1 - ty) + R - c);
}

// The WARREN GROVES (CAMPS.meadow, a `treeline` camp): the seed's border
// wanders 30-70 tiles deep, so on a shallow seed a warren would sit out in the
// open field. Each warren's stretch of treeline is grown out to meet it - a
// tongue of pines from the border to GROVE_IN tiles past the warren's centre,
// as wide as its clearing and three more, tapering GROVE_TAPER a tile either
// side back into the seed's own edge with a wobble on the fine noise - and clearCamp then cuts the clearing out of it, so the
// warren is dug into the treeline on every seed. Like the roost discs it only
// ever ADDS trees, and they roll nothing. Pure
// position: the sites, the fine noise.
const GROVE_IN = 3;       // tiles past the warren's centre the tongue reaches
const GROVE_TAPER = 1.4;  // tiles of depth lost per tile either side of the clearing
let groveSites = null;    // [{ tx, ty, e, side, r }] (e: the site's depth from its nearest edge, `side` which edge), once - CAMP_SITES is further down this file
function warrenGrove(tx, ty, d) {
  if (ARENA) return d;
  if (!groveSites) groveSites = campSites().filter((s) => CAMPS[s.key].treeline).map((s) => {
    const t = campTile(s.u, s.s), es = [t.tx, t.ty, WORLD - 1 - t.tx, WORLD - 1 - t.ty], e = Math.min(...es);
    return { tx: t.tx, ty: t.ty, e, side: es.indexOf(e), r: CAMPS[s.key].r };
  });
  for (const G of groveSites) {
    const lat = G.side % 2 ? Math.abs(tx - G.tx) : Math.abs(ty - G.ty); // along the edge
    const base = G.e + GROVE_IN - Math.max(0, lat - G.r - 3) * GROVE_TAPER;
    if (base + 1.5 <= d) continue; // not even the wobble reaches past the seed's own edge here
    const deep = base + (vnoise(tx / 4 + 70, ty / 4 + 70) - 0.5) * 3;
    if (deep <= d) continue;
    const own = [tx, ty, WORLD - 1 - tx, WORLD - 1 - ty][G.side]; // the tile's depth from the warren's edge
    if (own === Math.min(tx, ty, WORLD - 1 - tx, WORLD - 1 - ty)) d = deep;
  }
  return d;
}

// swings to fell a pine, everywhere one is planted (the border, the practice
// arena's forest, the regrown treeline): three at 0.34 s is a one-second tree,
// and what it pays is YIELD.treeFall, or treeRare on a gold pine (js/sim/core.js)
const TREE_HP = 3;
// per-tile roll for a gold pine (YIELD.treeRare on the fell, js/sim/core.js):
// hash-based, so it stays stable for a tile regardless of generation order,
// and spends no rng() draw
const TREE_RARE_CHANCE = 0.25;
function treeRare(tx, ty) {
  return hash2(tx * 5 + 11, ty * 7 + 23) < TREE_RARE_CHANCE;
}

// ---- the valley's centre ---------------------------------------------------
// One map: the valley is one wide interior inside a ring of pines. (Other
// map shapes, THICKET and FROZEN ISLES, stood here until PATCH 0.554; the
// PR that removed them names the commit to recover them from.)
const CENTER_R = 8; // tiles of open ground kept at the world's centre, so the river spokes still meet in the open

function genWorld() {
  // solid irregular forest boundary - players carve their base out of this
  for (let ty = 0; ty < WORLD; ty++) {
    for (let tx = 0; tx < WORLD; tx++) {
      const d = Math.min(tx, ty, WORLD - 1 - tx, WORLD - 1 - ty);
      if (d < borderDepth(tx, ty)) placeObj(tx, ty, 'tree', { hp: TREE_HP, rare: treeRare(tx, ty) });
    }
  }

  // frozen ponds - carved only into the open snow interior, away from the ring
  // points and out of the central clearing (CENTER_R), on their own stream
  const P = worldRng('ponds');
  const nearAnySpawn = (tx, ty, r) => ringPts.some((p) => Math.hypot(tx - p.tx, ty - p.ty) < r);
  for (let l = 0; l < 14; l++) {
    let px = 0, py = 0, ok = false;
    for (let tries = 0; tries < 40 && !ok; tries++) {
      px = P.randi(BORDER_MIN + 6, WORLD - 1 - BORDER_MIN - 6);
      py = P.randi(BORDER_MIN + 6, WORLD - 1 - BORDER_MIN - 6);
      ok = !objects[idx(px, py)] && ground[idx(px, py)] === 0 &&
        Math.hypot(px - cx, py - cy) > 16 && !nearAnySpawn(px, py, 16);
    }
    if (!ok) continue;
    let n = P.randi(70, 160);
    let wx = px, wy = py;
    while (n-- > 0) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const tx = wx + dx, ty = wy + dy;
        if (inWorld(tx, ty) && !objects[idx(tx, ty)] && ground[idx(tx, ty)] === 0 &&
          Math.hypot(tx - cx, ty - cy) > CENTER_R + 3 && !nearAnySpawn(tx, ty, 10) &&
          roadDist(tx, ty) >= ROAD_ICE_KEEP) ground[idx(tx, ty)] = 1; // never near the road (the `the road` group below)
      }
      wx += P.randi(-1, 1); wy += P.randi(-1, 1);
      wx = Math.max(4, Math.min(WORLD - 5, wx));
      wy = Math.max(4, Math.min(WORLD - 5, wy));
    }
  }

  // frozen rivers: winding ~5-tile-wide ribbons that link each ring point to
  // the central clearing plus a ring around it — ice is the map's travel network.
  // Same carve rules as the ponds, so rivers gap politely around the ring points,
  // the clearing, and anything already standing (border trees leave natural gaps)
  // - and around THE ROAD: no ice inside ROAD_ICE_KEEP of its edge, so the lane
  // never meets ice, and a river running at it narrows to nothing over
  // ROAD_ICE_TAPER tiles first (the disc below) rather than ending in a cut.
  // Neither test rolls anything. The rivers draw on a stream of their own.
  const R = worldRng('rivers');
  const carveIce = (tx, ty) => {
    if (inWorld(tx, ty) && !objects[idx(tx, ty)] && ground[idx(tx, ty)] === 0 &&
      Math.hypot(tx - cx, ty - cy) > CENTER_R + 3 && !nearAnySpawn(tx, ty, 9) &&
      roadDist(tx, ty) >= ROAD_ICE_KEEP) ground[idx(tx, ty)] = 1;
  };
  const carveRiver = (x0, y0, x1, y1) => {
    let wx = x0, wy = y0;
    let a = Math.atan2(y1 - wy, x1 - wx) + R.rand(-0.4, 0.4);
    const phase = R.rand(0, Math.PI * 2), wig = R.rand(0.06, 0.12);
    for (let s = 0; s < 320; s++) {
      // home in on the target while serpentining around the straight line
      const home = Math.atan2(y1 - wy, x1 - wx);
      let da = home - a;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      a += Math.max(-0.15, Math.min(0.15, da * 0.08)) + Math.sin(s * 0.09 + phase) * wig;
      wx += Math.cos(a); wy += Math.sin(a);
      const rx = Math.round(wx), ry = Math.round(wy);
      const taper = Math.max(0, Math.min(1, (roadDist(rx, ry) - ROAD_ICE_KEEP) / ROAD_ICE_TAPER)); // 1 in the open, 0 at the road's keep-out
      if (taper > 0) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy <= 4.5 * taper * taper) carveIce(rx + dx, ry + dy);
      }
      if (Math.hypot(wx - x1, wy - y1) < 3) break;
    }
  };
  for (const p of ringPts) carveRiver(p.tx, p.ty, cx, cy); // spokes
  for (let i = 0; i < ringPts.length; i++) { // ring, point to neighbouring point
    const a = ringPts[i], b = ringPts[(i + 1) % ringPts.length];
    carveRiver(a.tx, a.ty, b.tx, b.ty);
  }
}

// Taking a piece of scenery off the map at runtime (the landing's
// lane, the merchant's axe): the whole footprint goes, so a wide piece
// never leaves half of itself behind. Returns what stood there, or null.
function fellScenery(tx, ty) {
  const o = structOf(objAt(tx, ty));
  if (!o) return null;
  for (let k = 0; k < (OBJECTS[o.type] && OBJECTS[o.type].w || 1); k++) {
    if (structOf(objAt(o.tx + k, o.ty)) === o) objects[idx(o.tx + k, o.ty)] = null;
  }
  return o;
}

// ---- the road -------------------------------------------------------------
// THE ROAD: one straight lane down the map's diagonal, from one side's
// perch to the other's (the bases, js/sim/base.js: each a fixed hollow in its
// roost corner's woods, the road coming in through its mouth and ending on
// the bird). Across the open field it is ROAD_HW tiles either side of the
// centreline, room for a whole side and a wave to fight in; where it enters
// each roost corner's woods (the GATE - roadSpan, the treeline on the
// diagonal, two pennant poles in the side's colour) it narrows to
// ROAD_HW_WOOD, a forest road with the pines closing in. Ground 3, packed
// earth showing through the snow, clean of ruts and specks. It walks like
// snow (only ice and holes are special-cased in updatePlayer's momentum
// block) but it is not snow: nothing grows on it. Laid by placeRoad AFTER genWorld and BEFORE the camps, on pure
// reads, so it neither moves the shared rng stream nor differs run to run.
// Its EDGE is ragged, not a tile staircase: roadEdgeAt wanders the half-width
// along the lane on the position noise, per side, and roadMainDist measures
// any point - a tile centre for the ground array, a pixel for the ground bake
// (paintRoadOverlay, js/draw/ground.js) - against that wandering edge, so the
// two agree. roadMainDist has no ends: genWorld's carve rules read it whole
// (every pond and river ROAD_ICE_KEEP tiles off its edge, a river running at
// it petering out over ROAD_ICE_TAPER first), as they always did, so no
// seed's ice moves; the road as laid (laneDist) is that line ended on the two
// perches and the cistern's gates. Every camp
// site (CAMP_SITES) is written well off its centreline. Its centre is open
// ground. Under each bird lies a PAD, the crash's packed-earth disc (the
// `pads` registry below), so the road, the pad and the roost are one ground.
// The waves (the `soldiers` banner, robots.js) march its waypoints from one
// side's JUNCTION (where the road leaves its base, roadNest) to the rival's.
const ROAD_HW = 3.5;        // tiles either side of the centreline across the field: a seven-tile lane
const ROAD_HW_WOOD = 2.5;   // ...and through each corner's woods: a five-tile forest road
const ROAD_GATE_BLEND = 2;  // u either side of a gate the width eases from one to the other
const ROAD_RAG = 0.8;       // tiles the edge wanders either way - the organic verge
const ROAD_SHOULDER = 1.4;  // tiles of dirty snow past the edge (the bake only)
const ROAD_ICE_KEEP = 6;    // tiles past the edge no pond or river reaches (genWorld's carve rules)
const ROAD_ICE_TAPER = 7;   // ...and the tiles over which a river narrows to nothing on its way in
const ROAD_STEP = 20;       // tiles between a wave's waypoints along it
const ROAD_POLE_OUT = 0.9;  // tiles past the edge a pennant pole stands
// the diagonal in tile space: tx + ty = WORLD - 1, `u` running 0 at the
// bottom-left corner to WORLD - 1 at the top-right. All three take a tile
// index (the tile's centre) or a continuous tile coordinate alike.
// roadOffS is signed (+ toward the bottom-right side).
function roadAlong(fx, fy) { return (fx - fy + WORLD - 1) / 2; }
function roadOffS(fx, fy) { return (fx + fy - (WORLD - 1)) / Math.SQRT2; }
function roadPoint(u) { return { x: (u + 0.5) * TILE, y: (WORLD - 1 - u + 0.5) * TILE }; }
// the nominal half-width at u: ROAD_HW across the field, ROAD_HW_WOOD in
// the woods, eased between over ROAD_GATE_BLEND either side of a gate
function roadHW(u) {
  const s = roadSpan();
  const w = Math.min(u - s.u0, s.u1 - u); // u into the field from the nearer gate, negative in the woods
  const k = Math.max(0, Math.min(1, (w + ROAD_GATE_BLEND) / (2 * ROAD_GATE_BLEND)));
  return ROAD_HW_WOOD + (ROAD_HW - ROAD_HW_WOOD) * k * k * (3 - 2 * k);
}
// the half-width at u along, on one side: a slow wander of +-ROAD_RAG and a
// fine ripple, each side its own - pure position noise, the same every run
function roadEdgeAt(u, side) {
  const n = vnoise(u * 0.16 + side * 37.7, 11.5) - 0.5;
  const r = vnoise(u * 0.75 + side * 90.2, 4.2) - 0.5;
  return roadHW(u) + n * 2 * ROAD_RAG + r * 0.5;
}
// signed distance (tiles) from the diagonal road's ragged edge: negative
// inside it. No ends: genWorld reads the line whole (the road as laid ends on
// the perches - roadDist's `laid`)
function roadMainDist(fx, fy) {
  if (ARENA) return 99;
  const o = roadOffS(fx, fy);
  return Math.abs(o) - roadEdgeAt(roadAlong(fx, fy), o < 0 ? -1 : 1);
}
// THE PADS: the blown disc under each roost, packed earth from the crash
// (eagleCrash, js/sim/eagle.js) - a pad is road to every reader. Continuous
// tile-index coordinates (an integer is a tile's centre), named tx/ty, never
// x/y: the snapshot quantizes every x and y as px (SNAP_QUANT), which on a
// tile-unit centre off the grid (a perch at u 25.2) moved the client's pad
// edge a pixel off the host's. A team crashing twice on one page (a rematch)
// re-registers its pad in place.
const pads = [];
function addPad(team, cx, cy, r) {
  const sp = { team, tx: cx, ty: cy, hw: r };
  const i = pads.findIndex((s) => s.team === team);
  if (i >= 0) pads[i] = sp; else pads.push(sp);
  return sp;
}
// signed distance (tiles) from the nearest road edge - the diagonal's, a
// pad's or a side lane's: negative inside. `laid` is the road as it stands, ended
// on the two perches (baseRoadEnd, js/sim/base.js); without it the diagonal
// runs whole, which is what genWorld's carve rules have always read.
function roadDist(fx, fy, laid) {
  let d = roadMainDist(fx, fy);
  if (laid) d = Math.max(d, baseRoadEnd(fx, fy));
  for (const sp of pads) { const e = Math.hypot(fx - sp.tx, fy - sp.ty) - sp.hw; if (e < d) d = e; }
  const l = sideLaneDist(fx, fy); // the top and bot lanes (js/sim/lanes.js); 99 until layLanes
  return l < d ? l : d;
}
// the GATES: where the road crosses each corner's treeline on the diagonal -
// the first open tile past the last wooded one. u0 is
// the bottom-left corner's (RED's), u1 the top-right's (BLUE's); the field
// lies between them, the forest roads outside.
let roadSpanC = null;
function roadSpan() {
  if (roadSpanC) return roadSpanC;
  const last = (fromLeft) => {
    let k = 0;
    for (let i = 0; i < WORLD / 2 - 3; i++) {
      const x = fromLeft ? i : WORLD - 1 - i, y = fromLeft ? WORLD - 1 - i : i;
      if (i < borderDepth(x, y)) k = i;
    }
    return k + 1;
  };
  roadSpanC = { u0: last(true), u1: WORLD - 1 - last(false) };
  return roadSpanC;
}
// the road as it is LAID and DRAWN: roadDist ended on the perches, and
// straight on through the cistern's gates and over its floor. Not genWorld's:
// its carve rules ask the whole line, before the creek is in, so no seed's
// ponds move
function laneDist(fx, fy) { return roadDist(fx, fy, true); }
function onRoad(tx, ty) { return laneDist(tx, ty) < 0; }
// where a side's bird roosts and where its road leaves home: the NEST is the
// perch at the back of the side's base, on the centreline (basePerch,
// js/sim/base.js), and the JUNCTION the point on the centreline where the
// road goes out through the hollow's mouth (baseGateU). Fixed, so cached:
// u (the junction's), side (the bird's own right: RED's the top-left side,
// roadOffS < 0, BLUE's the bottom-right), both points in tile-index space
// (jx/jy, nx/ny) and the junction in px.
const roadNestC = [null, null];
function roadNest(team) {
  if (roadNestC[team]) return roadNestC[team];
  const u = baseGateU(team), n = basePerch(team), jx = u, jy = WORLD - 1 - u;
  return (roadNestC[team] = { u, side: team === 0 ? -1 : 1, jx, jy, nx: n.tx, ny: n.ty, x: (jx + 0.5) * TILE, y: (jy + 0.5) * TILE });
}
function placeRoad() {
  if (ARENA) return;
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    if (!onRoad(tx, ty)) continue;
    const i = idx(tx, ty);
    ground[i] = 3; // the lane is never ice: genWorld keeps the ponds ROAD_ICE_KEEP away, and it paves over the frozen creek where it crosses it
    objects[i] = null; // only worldgen's scenery stands here yet: a pine of the woods it cuts through
  }
  // the furniture: a point `out` tiles past the ragged edge on one side of u,
  // if that tile is on dry ground (a pennant pole takes the pine on its spot -
  // the gate stands in the treeline)
  const s = roadSpan();
  const mark = (u, side, out, type, extra) => {
    const e = roadEdgeAt(u, side) + out;
    const tx = Math.round(u + side * e / Math.SQRT2), ty = Math.round(WORLD - 1 - u + side * e / Math.SQRT2);
    if (!inWorld(tx, ty) || waterAt(tx, ty)) return null;
    const o = objects[idx(tx, ty)];
    if (o && !laneFells(o)) return null;
    return placeObj(tx, ty, type, extra);
  };
  for (const side of [-1, 1]) {
    mark(s.u0 + 2, side, ROAD_POLE_OUT, 'banner', { team: 0 }); // RED roosts bottom-left (game.md)
    mark(s.u1 - 2, side, ROAD_POLE_OUT, 'banner', { team: 1 });
  }
}
// the march: the centreline every ROAD_STEP tiles from a side's own junction
// to the rival's (team 0 roosts bottom-left, team 1 top-right - game.md)
function roadWaypoints(team) {
  const a = roadNest(team).u, b = roadNest(1 - team).u, pts = [];
  const n = Math.max(1, Math.round(Math.abs(b - a) / ROAD_STEP));
  for (let i = 0; i <= n; i++) pts.push(roadPoint(a + (b - a) * i / n));
  return pts;
}

// ---- segment index ----------------------------------------------------
// A polyline of straight segments and a per-tile index of its nearest two,
// so a distance to it costs one array read and at most two segments per
// PIXEL of the ground bake instead of a walk down the whole line. The side
// lanes are laid on it (sideLaneDist, js/sim/lanes.js).
function segLat(t, fx, fy) {
  const px = fx - t.x, py = fy - t.y;
  let a = px * t.dx + py * t.dy;
  a = a < 0 ? 0 : a > t.len ? t.len : a;
  return Math.hypot(px - t.dx * a, py - t.dy * a);
}
// tiles from (fx, fy) to the nearest of `segs` by an index's two stamped
// segments (indexSegs), or 99 off every one's reach
function segsLat(segs, A, B, fx, fy) {
  const tx = fx < 0 ? 0 : fx > WORLD - 1 ? WORLD - 1 : Math.round(fx);
  const ty = fy < 0 ? 0 : fy > WORLD - 1 ? WORLD - 1 : Math.round(fy);
  const i = ty * WORLD + tx;
  const a = A[i];
  if (a < 0) return 99;
  let lat = segLat(segs[a], fx, fy);
  const b = B[i];
  if (b >= 0) { const e = segLat(segs[b], fx, fy); if (e < lat) lat = e; }
  return lat;
}
function addSeg(segs, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (L < 0.001) return;
  segs.push({ x: x0, y: y0, dx: dx / L, dy: dy / L, len: L });
}
// every tile's nearest segment of `segs` and its next, out to R tiles off
// it (-1 past): one array read per lookup instead of a walk down the list
function indexSegs(segs, R) {
  const N = WORLD * WORLD;
  const A = new Int16Array(N).fill(-1), B = new Int16Array(N).fill(-1);
  const dA = new Float32Array(N).fill(Infinity), dB = new Float32Array(N).fill(Infinity);
  for (let s = 0; s < segs.length; s++) {
    const t = segs[s];
    const ex = t.x + t.dx * t.len, ey = t.y + t.dy * t.len;
    const x0 = Math.max(0, Math.floor(Math.min(t.x, ex) - R)), x1 = Math.min(WORLD - 1, Math.ceil(Math.max(t.x, ex) + R));
    const y0 = Math.max(0, Math.floor(Math.min(t.y, ey) - R)), y1 = Math.min(WORLD - 1, Math.ceil(Math.max(t.y, ey) + R));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const d = segLat(t, tx, ty);
      if (d > R) continue;
      const i = ty * WORLD + tx;
      if (d < dA[i]) { dB[i] = dA[i]; B[i] = A[i]; dA[i] = d; A[i] = s; }
      else if (d < dB[i]) { dB[i] = d; B[i] = s; }
    }
  }
  return { A, B };
}

// ---- the creek ------------------------------------------------------------
// One creek runs down the CROSS-diagonal (tx = ty) - the top-left corner
// toward the bottom-right, the road's opposite - and it is FROZEN, the
// Rift's river in winter: it starts where the top side lane crosses its line
// and ends where the bottom one does (creekSpan), so past the lanes the
// border woods stand unbroken, and it meets the mid road once, at the
// middle, where the waves meet, running in under the cistern's wall by a
// culvert each way (js/sim/cistern.js).
//
// It is GROUND 1, ice, laid over whatever genWorld stood there (placeCreek),
// and it is rough ice that holds a foot like snow (slickUnder, js/sim/sim.js):
// every body walks on it and every route crosses it, so it is a way through
// the jungle, not a wall between the halves.
//
// The BENDS: the two spots on the mirror line (the ORCA'S POOL and the
// BLACK BEAR BEND) each have the creek swing round them in a half-loop, so
// each falls on one side's bank: the upstream one (the orca's pool) to RED,
// the downstream one (the bear) to BLUE - each side nearer one objective, as
// a Rift's river is. The line is point-symmetric about the crossing, as the
// roosts are.
//
// Geometry, in tiles, off the road's own frame: `w` along the creek is
// roadOffS (+ downstream, toward the bottom-right) and `p` across it is
// (fx - fy) / SQRT2 (+ toward the top-right, BLUE's half). creekAt measures
// any point against the wandering banks; the tiles in it are lake ice, so
// the lake painter draws its shore (bakeLakes, js/draw/ground.js). Pure
// position noise: nothing rolls, so no seed reshuffles - but it writes
// ground after genWorld, so every seed's ground hash moves (placeCreek).
const CREEK_HW = 1.6;       // tiles either side of the creek's line the ice runs: about three tiles across
const CREEK_HW_RAG = 0.22;   // ...that each bank wanders on the position noise
const CREEK_WANDER = 2.5;    // tiles the line itself wanders off the cross-diagonal, either way
const CREEK_CALM = 10;       // tiles over which the wander eases to nothing at the cistern or a bend
const CREEK_REACH = CREEK_WANDER + CREEK_HW + CREEK_HW_RAG + 0.4; // the farthest a bank ever stands off the line's bend
const CREEK_BEND_GAP = 4.2;  // tiles of snow bank between a bend's camp's cleared ground (r) and the ice
const CREEK_BEND_LONG = 2.2; // a bend runs this many times its reach along the creek either way (2 or more keeps the camp clear)
const CREEK_LANE_PAST = 1;   // tiles past a side lane's middle the ice runs on, under the lane's far edge (creekSpan)
function creekP(fx, fy) { return (fx - fy) / Math.SQRT2; }
// the bends: every camp site on the mirror line, with how far the water's
// centre swings off the diagonal at the camp (R, out past the camp's
// ground), how far along it the swing runs either way (L) and which
// way it swings (side: + toward BLUE's half, which leaves the camp RED's)
let creekBendsC = null;
function creekBends() {
  if (creekBendsC) return creekBendsC;
  creekBendsC = [];
  for (const site of campSites()) {
    if (Math.abs(site.u - (WORLD - 1) / 2) > 0.01) continue;
    const t = campTile(site.u, site.s), w = roadOffS(t.tx, t.ty);
    const R = CAMPS[site.key].r + CREEK_BEND_GAP + CREEK_HW;
    creekBendsC.push({ tx: t.tx, ty: t.ty, w, R, L: R * CREEK_BEND_LONG, side: w < 0 ? 1 : -1 });
  }
  return creekBendsC;
}
// the line's swing off the diagonal at w: R (1 - t^2)^2 over each bend, flat
// at both ends so it leaves the diagonal smoothly, and never nearer the camp
// than R while L >= 2R
function creekBend(w) {
  let p = 0;
  for (const B of creekBends()) {
    const t = (w - B.w) / B.L;
    if (t > -1 && t < 1) p += B.side * B.R * (1 - t * t) * (1 - t * t);
  }
  return p;
}
// 0 through the cistern and a little past its culverts, and at a bend's
// camp, easing to 1 CREEK_CALM tiles out: the wander and the banks' rag are
// held still where the ice must meet a fixed thing square - the cistern's
// culverts are baked art, so there the creek is CREEK_HW either side of the
// cross-diagonal exactly
function creekCalm(w) {
  let k = 1;
  const at = (w0, r) => { const t = Math.max(0, Math.min(1, (Math.abs(w - w0) - r) / CREEK_CALM)); k = Math.min(k, t * t * (3 - 2 * t)); };
  at(0, CIST_RO + 4); // the culverts
  for (const B of creekBends()) at(B.w, B.L / 2);
  return k;
}
function creekMid(w) {
  return creekBend(w) + ((vnoise(w * 0.045 + 7.3, 3.1) - 0.5) * 2 * CREEK_WANDER + (vnoise(w * 0.21 + 1.7, 8.7) - 0.5) * 0.5) * creekCalm(w);
}
function creekHW(w, side) {
  return CREEK_HW + (vnoise(w * 0.13 + side * 31.7, 5.5) - 0.5) * 2 * CREEK_HW_RAG * creekCalm(w);
}
// Signed distance (tiles) from the nearer bank: negative in the water. Also
// leaves where the point is in CQ, so a caller asking for more than the
// distance does not pay twice: `a` along the water (tiles) and `n` across it
// (signed, from the water's own centre, + toward BLUE's half).
const CQ = { d: 99, a: 0, n: 0 };
function creekAt(fx, fy) {
  const q = CQ;
  q.d = 99;
  if (ARENA) return 99;
  const p = creekP(fx, fy), w = roadOffS(fx, fy);
  if (Math.abs(p - creekBend(w)) - CREEK_REACH >= q.d) return q.d;
  const n = p - creekMid(w);
  q.d = n < 0 ? -n - creekHW(w, -1) : n - creekHW(w, 1);
  q.a = w; q.n = n;
  return q.d;
}
// where along the creek it starts and ends (w, tiles): CREEK_LANE_PAST past
// the middle of each side lane where the lane crosses its line, found by
// walking the line out from the cistern. Fixed, so cached
let creekSpanC = null;
function creekSpan() {
  if (creekSpanC) return creekSpanC;
  const end = (dir) => {
    let least = 0; // how deep in the lane the line has got: it is at the lane's middle once that stops growing
    for (let w = dir * (CIST_RO + 6); Math.abs(w) < WORLD; w += dir * 0.25) {
      const p = creekMid(w), tx = ((w + p) * Math.SQRT2 + WORLD - 1) / 2, ty = ((w - p) * Math.SQRT2 + WORLD - 1) / 2;
      const d = roadDist(tx, ty, true);
      if (d < least) least = d;
      else if (least < 0 && d > least + 0.05) return w + dir * CREEK_LANE_PAST;
    }
    return dir * WORLD;
  };
  creekSpanC = { w0: end(-1), w1: end(1) };
  return creekSpanC;
}
// the frozen creek at a point (tiles): in its banks and within its span. What
// the walk asks (slickUnder), the lake painter seeds (bakeLakes) and the
// jungle keeps clear (layJungle)
function creekIceAt(fx, fy) {
  if (creekAt(fx, fy) >= 0) return false;
  const S = creekSpan();
  return CQ.a >= S.w0 && CQ.a <= S.w1;
}
// THE ORCA'S POOL: its own frozen pond on the creek's upstream bend, the top
// side of the middle (CAMPS.orca, js/sim/camps.js), and the orca lives under
// it (the `orca` banner, js/sim/orca.js). A disc ORCA_LAKE_R tiles round the
// site with a rim that wanders ORCA_LAKE_RAG on the position noise, on the
// mirror line, so both sides walk the same way to it; every tile in it is ice
// (ground 1, layOrcaPool). Pure position: nothing rolls.
const ORCA_LAKE_R = 8;      // tiles from the pool's middle to its ice's rim
const ORCA_LAKE_RAG = 0.7;  // tiles the rim wanders either way
let orcaPoolC = null;
function orcaPool() {
  if (!orcaPoolC) { const s = campSites().find((c) => CAMPS[c.key].pool); orcaPoolC = campTile(s.u, s.s); }
  return orcaPoolC;
}
// signed tiles from the rim (negative inside); 99 well clear of it
function orcaLakeEdge(fx, fy) {
  if (ARENA) return 99;
  const P = orcaPool(), dx = fx - P.tx, dy = fy - P.ty, a = Math.atan2(dy, dx);
  const d = Math.hypot(dx, dy) - ORCA_LAKE_R - (vnoise(Math.cos(a) * 1.8 + 31.7, Math.sin(a) * 1.8 + 5.3) - 0.5) * 2 * ORCA_LAKE_RAG;
  return d > 4 ? 99 : d;
}
function orcaLakeAt(fx, fy) { return orcaLakeEdge(fx, fy) < 0; }
// Runs at boot after layLanes (js/app/boot.js), which it ends the creek under,
// and before the road, which paves over it where they cross: the
// ice fells whatever grew on it (its banks keep their pines). Last, the
// cistern stands round the middle (placeCistern, js/sim/cistern.js).
function placeCreek() {
  if (ARENA) { placeCistern(); return; } // ...which stands down in the practice arena
  creekBendsC = null; creekSpanC = null;
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    if (!creekIceAt(tx, ty)) continue;
    const i = idx(tx, ty);
    ground[i] = 1;
    objects[i] = null;
  }
  placeCistern();
}

// a heal taken off the world, said the one way: the number in the heal green
// over the body and the heal's sound
function healFx(p, n) {
  if (n <= 0) return;
  addFloater(p.x, p.y - 14, '+' + Math.round(n), '#8fe08a');
  sfxAt('heal', p.x, p.y);
}
