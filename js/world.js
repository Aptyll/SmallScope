'use strict';
// The frozen world: the tile grid and its objects, worldgen (rivers, ponds,
// rocks), the road, the paths and the creek. The zipline, the camps and the
// practice arena load right after it (js/zipline.js, js/camps.js, js/practice.js).
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
// moment it is in reach (`auto` - a tree, a rock, a chest, a rival's eagle:
// autoWork, js/actions.js - bare ice and the dummy wait for E), the verb the key prompt prints and how far
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
// with none lets the ground show through (a bush, a rock, a stump, a camp's
// props - the glyph marks those): at the chart's scale a thing that stands
// alone on its tile is a speck, and a speck is noise. The ORDER is the paint priority: where one chart
// pixel covers two tiles (WORLD tiles into MAP_W px) the higher class wins,
// so a one-tile wall never drops out of its run. A side's buildings and
// its eagle are two depths of the same ink, so a base reads as a shape in
// its colour with the bird bright at its heart - and both go through skin()
// like every other team paint. The cistern's stone (cisternTouches) inks last.
const CH_SNOW = 0, CH_FOREST = 1, CH_ROAD = 2, CH_ICE = 3, CH_HOLE = 4, CH_CHEST = 5,
      CH_RED = 6, CH_BLUE = 7, CH_EAGLE_RED = 8, CH_EAGLE_BLUE = 9, CH_STONE = 10;
const chTeam = (o) => skin(o.team === undefined ? 0 : o.team) ? CH_BLUE : CH_RED;   // a side's building
const chEagle = (o) => skin(o.team === undefined ? 0 : o.team) ? CH_EAGLE_BLUE : CH_EAGLE_RED; // its bird, its gate
const OBJECTS = {
  // lift 33: the pine's canopy reaches 21 px above its own tile (drawn at
  // py - 21), and the prompt clears it by the same 12 px everything else gets
  tree:     { solid: true,  tool: 'axe',  needs: 'axe',  verb: 'CHOP', lift: 33, auto: true,
              mm: [52, 100, 82],   map: CH_FOREST },
  deadTree: { solid: true,  tool: 'axe',  needs: 'axe',  verb: 'CHOP', lift: 20, auto: true,
              mm: [138, 128, 116], map: CH_FOREST },
  // a rock (ROCK_KINDS, js/mining.js): two tiles wide, the anchor its west
  // tile and a `part` on the east one (placeRocks). It mines itself for
  // whoever stands by it (updateMine), so it has no `tool`: E never reaches
  // for it and the hands never swing at it.
  rock:     { solid: true,  w: 2,
              mm: [122, 131, 153] },
  // a picked bush is still a bush: `ready` is what decides whether E offers it
  // (a bush is on the minimap and off the chart: one tile of anything is
  // noise at the chart's scale)
  bush:     { solid: false, tool: 'axe',  needs: null,   verb: 'PICK', lift: 10, auto: true,
              ready: (o) => o.berries > 0,
              mm: [88, 148, 108] },
  // a SNOWDROP clump, stamped only by the warren camp (CAMPS.meadow): open
  // until someone picks it, when one pick shields the picker's whole company
  // (pickSnowdrop, js/actions.js), and then resting SNOWDROP_CD seconds
  // (`readyAt`, the match second it opens again: snowdropLeft, below).
  // `ready` is what makes E and the hands reach for an open clump only. Off
  // both maps: a speck on the snow is noise.
  snowdrop: { solid: false, tool: 'axe', needs: null,   verb: 'PICK', lift: 14, auto: true,
              ready: (o) => snowdropLeft(o) <= 0 },
  // one end of a burrow's tunnel (js/tunnel.js): `mate` the other end (null
  // while it is still being dug), `owner` the digger's id, `team` the side a
  // rival's boots cave it for, `crumble` the s of that so far. Flat, walked
  // over, nothing for a tool - the work key on it is the way down
  // (tunnelEnter), drawn in the flat pass (drawTunnelHole, js/draw/tunnel.js).
  tunnel:   { solid: false, tool: null, needs: null },
  // a buried cache swapped in for an inner-edge border tree (placeChests):
  // one free E press springs it - hitObject's chest branch pays the gold and
  // rolls the card. Any tool opens it, so `needs` stays null.
  chest:    { solid: true,  tool: 'axe',  needs: null,   verb: 'OPEN', lift: 12, auto: true,
              mm: [242, 204, 100], map: CH_CHEST },
  // a camp's cave (the wolf den and the brown bear den): inert scenery, two
  // tiles wide - `w` stamps a `part` filler per extra tile, east of the
  // anchor (placeCamps), so both tiles are solid and read back as the den
  den:      { solid: true,  w: 2, mm: [92, 86, 100] },
  // the HOG HUT camp's building (CAMPS.hut, js/camps.js): 2x2, the anchor its
  // bottom-left tile - `h` stamps the parts NORTH of it, so the anchor is
  // the front row the y-sort reads - drawing the whole 35x35 sprite
  // (SPRITES.hogHut) centred over the pair. Inert to E like the den.
  hut:      { solid: true,  w: 2, h: 2, mm: [134, 97, 69] },
  // the merchant's STALL (pitched by updateMerchant, robots.js): 3x2 laid
  // out like the hut (anchor bottom-left, parts east and north), carrying
  // its `team` and its `merch`. No `tool` and no hp: nothing swings at it,
  // nothing shoots it, and it is in no `structures` list for a wave to
  // siege - the counter is as untouchable as its keeper. E in front of it
  // opens the shop (merchNear, js/ui/shop.js).
  stall:    { solid: true,  w: 3, h: 2, mm: (o) => mmTeam(o) },
  // the practice arena's target (the `practice arena` banner, js/practice.js): any tool
  // hits it, it never falls, and it mends itself between combos. E swings,
  // every bit and the roll's tackle all land through hitDummy (js/actions.js).
  dummy:    { solid: true,  tool: 'axe',  needs: null,   verb: 'HIT', lift: 28,
              mm: [216, 178, 122] },
  // The training field's dressing (practice arena only): inert scenery like
  // the den - no `tool`, so E never offers them - drawn in the y-sorted pass.
  // The banner is the parkour gate's flag; the rack spans TWO tiles - the
  // left one carries `lead` and draws the whole sprite, the right tile is a
  // plain solid follower the draw pass skips.
  // the parkour gate's flag - and, carrying a `team`, the two pennant poles
  // at each of the road's mouths (placeRoad), which paint the maps in that
  // side's ink the way a roosting eagle does
  banner:   { solid: true,
              mm: (o) => o.team === undefined ? MM_BANNER : skin(o.team) ? MM_EAGLE_BLUE : MM_EAGLE_RED,
              map: (o) => o.team === undefined ? null : chEagle(o) },
  rack:     { solid: true,  mm: [168, 132, 92] },
  // the BLACK BEAR STONE camp's old anchor: a heap of stones, solid. No
  // camp stamps one since the bears moved to the river (CAMPS' `river`);
  // kept so a save from before still loads what stood in it. Inert to E (no `tool`); its pixels are CAIRN_SPR in
  // render()'s object pass (js/draw/render.js).
  cairn:    { solid: true,  mm: [150, 156, 170] },
  // the felled trunk across each forest road's far end (placeRoad): one
  // piece per tile along the cross-diagonal, `seg` 0/1/2 the up-left end,
  // the trunk, the down-right end. Solid and inert to E; its pixels are baked
  // flat into the ground (paintLog under paintGroundTile, draw-world.js),
  // never drawn in the y-sorted pass - a trunk on the ground is ground.
  // `leap`: a deer's leap clears it (rideLeap, js/wildlife.js)
  log:      { solid: true,  leap: true, mm: [124, 94, 62] },
  // a zipline's pylon (placeZips, the `zipline` banner, js/zipline.js): solid, inert
  // to E, carrying its `team`. Its pixels are PYLON_SPRS in render()'s
  // object pass (js/draw/zipline.js); the cable itself is not an object at
  // all - it hangs between the pylons' points (zips) and is drawn by drawZips.
  pylon:    { solid: true,  mm: [150, 156, 170] },
  // the parkour roll station (practice arena only): the die that rerolls the
  // track. Inert to E's work verbs like the rack - holding E beside it opens
  // the roll wheel (pkDieNear, the practice arena banner, js/practice.js).
  pkdie:    { solid: true,  mm: [242, 204, 100] },
  // the archery range's bell (practice arena only): E beside it rings the
  // timed round on and off. Inert to E's work verbs like the die - the press
  // resolves through agBellNear (the practice arena banner, js/practice.js).
  agbell:   { solid: true,  mm: [216, 158, 74] },
  stump:    { solid: false, mm: [188, 200, 218] },
  // a roosting team eagle's hitbox tiles (placed by eagleCrash, js/eagle.js):
  // solid to walkers and a work target for RIVAL E swings only - workTarget
  // reads the `team` an object carries. Drawn by drawEagle, never the object
  // pass; the swing itself lands in hitObject's eagle branch (hurtEagle).
  eagle:    { solid: true,  tool: 'axe',  needs: null,   verb: 'STRIKE', lift: 16, auto: true,
              mm: (o) => skin(o.team) ? MM_EAGLE_BLUE : MM_EAGLE_RED, map: chEagle },
  // a multi-tile building's (or a wide prop's) filler tiles: solid, and
  // structOf() has resolved them to their anchor long before either map sees one
  part:     { solid: true },
};
// A picked bush regrows on its own clock (`regrow`, counted down with the
// object timers in js/sim.js; the pick sets it, hitObject in js/actions.js),
// and the plant IS the clock: bare for the first stretch, pale BUDS where
// the berries will be once ripening is within BUSH_BUD_T seconds, the
// berries back but dull inside BUSH_RIPEN_T, ripe at zero (the frames:
// bushEmpty / bushBud / bushRipen / bush, picked in render.js) - so a player
// reads "wait" or "move on" off the bush itself, with no bar and no number.
const BUSH_REGROW = 70;   // s from a pick to the next two berries
const BUSH_BUD_T = 35;    // s left when the buds show
const BUSH_RIPEN_T = 12;  // s left when the berries come in dull
// A SNOWDROP's rest: a picked clump is a snapped stem for the first stretch
// of SNOWDROP_CD, a shut bud once it is within SNOWDROP_BUD_T of opening,
// and open again at zero - the plant is the clock, the way a bush is, and a
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

// `e`, when given, is who is walking: a `gate` stands open to its own side
// and to nobody else (the rest of the world - shots, wildlife, the maps -
// asks without one and meets a wall). `swept`: the caller holds the body to
// the cistern's stone by the pixel itself (moveEntity), so its tiles do not
// count here; to everyone else a tile whose middle is its stone is a wall
// (cisternTile, js/cistern.js).
function isSolidTile(tx, ty, e, swept) {
  if (!inWorld(tx, ty)) return true;
  if (!swept && cisternTile(tx, ty)) return true;
  const o = objects[idx(tx, ty)];
  if (!o) return false;
  if (e && o.team !== undefined && e.team === o.team && STRUCTS[o.type] && STRUCTS[o.type].gate) return false;
  // Two tables, no list: any STRUCTS entry (wall/turret/generator/spawner/
  // keep/...) is solid for free, and everything else answers from its OBJECTS
  // entry - so neither a new building nor a new kind of scenery ever needs
  // this function touched. A `water` building (the fish net) is the one
  // exception: it lies flat on the surface and is walked over, not into.
  if (STRUCTS[o.type]) return !STRUCTS[o.type].water;
  const d = OBJECTS[o.type];
  if (d && d.leap && e && e.leapT > 0) return false; // a deer in mid-leap goes over (js/wildlife.js)
  return !!(d && d.solid);
}

// open water on a tile: a carved ice hole (ground 2) or the creek (ground 4,
// the `the creek` group below). The one read for "nothing walks in here":
// every walker but a player treats it as a wall (moveEntity), no route
// crosses it (walkable), nothing spawns, lands or climbs out onto it. A
// player may step in, and plunges (updatePlayer).
function waterAt(tx, ty) {
  if (!inWorld(tx, ty)) return false;
  const g = ground[idx(tx, ty)];
  return g === 2 || g === 4;
}

// the fish net on a tile, if one stands there - the single read that says
// "this open water is planked over": the dawn refreeze skips it, the plunge
// check skips it, and drawing it is a flat pass
function netAt(tx, ty) {
  const o = objAt(tx, ty);
  return o && o.type === 'net' ? o : null;
}

// A bare open hole is the one SITE left in the game: the `water` building
// (the net) goes on it, and everything else stands on any open snow or road
// tile the build list's ghost is over (canPlaceAt, structures.js - the one
// placement rule). Kept for the pad's wheel (buildOptionsAt), which offers
// the net over a hole and the land list anywhere else.
function buildSiteAt(tx, ty) {
  const o = objAt(tx, ty);
  if (o) return null;
  return inWorld(tx, ty) && ground[idx(tx, ty)] === 2 ? 'water' : null;
}
function buildOptionsAt(tx, ty) {
  return buildSiteAt(tx, ty) === 'water' ? WATER_STRUCT_ORDER : STRUCT_ORDER;
}

// Multi-tile buildings. STRUCTS[type].w/h > 1 means the anchor tile (top-left)
// holds the building object and every other footprint tile holds a 'part'
// filler { type: 'part', of } pointing back at it, so objAt() on any covered
// tile is solid and structOf() resolves to the building. One object per tile
// still holds - the fillers are the object on their tile. A type that
// `rotates` may stand TURNED (`o.rot` 1): its w and h swap, and that is the
// whole of rotation - such a type is `tiled` (each footprint tile wears one
// tile of art), so nothing in the art has to turn. structW/structH take the
// OBJECT, so a turned one answers turned, or a bare type name (unturned).
function structW(x) { const S = STRUCTS[typeof x === 'string' ? x : x.type]; if (!S) return 1; return (typeof x !== 'string' && x.rot ? S.h : S.w) || 1; }
function structH(x) { const S = STRUCTS[typeof x === 'string' ? x : x.type]; if (!S) return 1; return (typeof x !== 'string' && x.rot ? S.w : S.h) || 1; }
function structOf(o) { return o && o.type === 'part' ? o.of : o; }
function footprint(type, tx, ty, rot) {
  const r = [], f = { type, rot: rot ? 1 : 0 };
  for (let dy = 0; dy < structH(f); dy++) for (let dx = 0; dx < structW(f); dx++) r.push([tx + dx, ty + dy]);
  return r;
}
function structCenter(o) {
  return { x: (o.tx + structW(o) / 2) * TILE, y: (o.ty + structH(o) / 2) * TILE };
}
// where a building meets the ground in front: bots roll out of, and return to, this point
function structMouth(o) {
  return { x: (o.tx + structW(o) / 2) * TILE, y: (o.ty + structH(o)) * TILE + 6 };
}
// The anchor for a w x h building that covers the tile at (tx, ty) - the
// pad's wheel and the AI order a big building by ONE tile: every candidate
// placement containing it is tried through canPlaceAt (reach aside, unturned),
// and the one covering the most stumps wins. Null when none stands.
function findSite(type, tx, ty) {
  const w = structW(type), h = structH(type);
  let best = null, bs = -1;
  for (let ay = ty - h + 1; ay <= ty; ay++) for (let ax = tx - w + 1; ax <= tx; ax++) {
    if (!canPlaceAt(type, ax, ay, 0, null).ok) continue;
    let stumps = 0;
    for (const [x, y] of footprint(type, ax, ay)) { const o = objects[idx(x, y)]; if (o && o.type === 'stump') stumps++; }
    if (stumps > bs) { bs = stumps; best = { tx: ax, ty: ay }; }
  }
  return best;
}

function placeObj(tx, ty, type, extra) {
  const o = Object.assign({ type, tx, ty, hp: 1, flash: 0, shake: 0 }, extra || {});
  objects[idx(tx, ty)] = o;
  return o;
}

const cx = WORLD / 2, cy = WORLD / 2;

// six evenly spaced points on a ring 55 tiles in from the world edge (at the
// treeline). These were the spawn camps before the eagle drop; they still
// anchor the river spokes and the keep-clear rules so existing seeds keep
// their terrain. Nobody starts here any more - every player lands from the eagle.
// RING_N is frozen at six ON PURPOSE: it stopped tracking the player count when
// the roster grew to ten, because player count must never reshape the terrain.
const SPAWN_D = WORLD / 2 - 55;
const RING_N = 6;
const ringPts = [];
for (let i = 0; i < RING_N; i++) {
  const a = -Math.PI / 2 + (i / RING_N) * Math.PI * 2;
  ringPts.push({
    tx: Math.round(cx + Math.cos(a) * SPAWN_D),
    ty: Math.round(cy + Math.sin(a) * SPAWN_D),
  });
}

const BORDER_MIN = 30, BORDER_MAX = 70; // forest boundary depth range (avg ~50)
// The two ROOST corners - bottom-left and top-right, where the eagles always
// come down (makeEagleRoute, eagle.js) - are forested to ROOST_R outright: a
// quarter-disc of woods UNIONED with the noise border, so whatever the seed
// grew there the corner holds one solid block for the bird to bury itself in,
// and the treeline its lane cuts to is at least the disc's arc (ROOST_R along
// the diagonal is ROOST_R / sqrt 2 ~ 48 tiles in). The union only ever ADDS
// trees: past the disc the border keeps every seed's own noise, and the arc
// itself wobbles ROOST_WOBBLE on the fine noise so it never reads as a compass
// stroke. Not under PRACTICE - the training field is its own collar.
const ROOST_R = 68;      // tiles from the corner
const ROOST_WOBBLE = 3;  // +- tiles the arc wanders

// depth of the forest boundary at a given tile: smooth irregular inner edge,
// always solid from the world edge inward (variation eats into the interior).
// borderNoise is the seed's own border alone; borderDepth is that OR the roost
// disc, and is what everything reads - genWorld's tree rule, the eagles'
// line, the lane. genWorld spends its per-tree rng()
// only under borderNoise (the disc's extra pines roll nothing), so a seed's
// interior is exactly what it was before the corners were guaranteed.
function borderNoise(tx, ty) {
  let n = vnoise(tx / 22, ty / 22) * 0.65 + vnoise(tx / 9 + 40, ty / 9 + 40) * 0.35;
  n = Math.max(0, Math.min(1, (n - 0.5) * 1.6 + 0.5)); // stretch toward full range
  return BORDER_MIN + (BORDER_MAX - BORDER_MIN) * n;
}
function borderDepth(tx, ty) {
  const d = warrenGrove(tx, ty, borderNoise(tx, ty));
  if (PRACTICE) return d;
  const c = Math.min(Math.hypot(tx, WORLD - 1 - ty), Math.hypot(WORLD - 1 - tx, ty)); // to the nearer roost corner
  if (c >= ROOST_R + ROOST_WOBBLE) return d;
  const R = ROOST_R + (vnoise(tx / 9 + 40, ty / 9 + 40) - 0.5) * 2 * ROOST_WOBBLE;
  if (c >= R) return d;
  // inside the disc: deeper than this tile's own edge distance by the tile's
  // depth into the disc, so genWorld's `edge < borderDepth` plants it and
  // forestDepth (eagle.js) reads how far inside the arc it sits
  return Math.max(d, Math.min(tx, ty, WORLD - 1 - tx, WORLD - 1 - ty) + R - c);
}

// The WARREN GROVES (CAMPS.meadow, a `treeline` camp): the seed's border
// wanders 30-70 tiles deep, so on a shallow seed a warren would sit out in the
// open field. Each warren's stretch of treeline is grown out to meet it - a
// tongue of pines from the border to GROVE_IN tiles past the warren's centre,
// as wide as its clearing and three more, tapering GROVE_TAPER a tile either
// side back into the seed's own edge with a wobble on the fine noise - and clearCamp then cuts the clearing out of it, so the
// warren is dug into the treeline on every seed. Like the roost discs it only
// ever ADDS trees, and they roll nothing (genWorld's variant rule). Pure
// position: the sites, the fine noise.
const GROVE_IN = 3;       // tiles past the warren's centre the tongue reaches
const GROVE_TAPER = 1.4;  // tiles of depth lost per tile either side of the clearing
let groveSites = null;    // [{ tx, ty, e, side, r }] (e: the site's depth from its nearest edge, `side` which edge), once - CAMP_SITES is further down this file
function warrenGrove(tx, ty, d) {
  if (PRACTICE) return d;
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
// and what it pays is YIELD.treeFall (js/core.js)
const TREE_HP = 3;
// per-tile jackpot roll for trees: hash-based, so it stays stable for a tile
// regardless of generation order, and reshuffles with the run seed
const TREE_RARE_CHANCE = 0.08;
function treeRare(tx, ty) {
  return hash2(tx * 5 + 11, ty * 7 + 23) < TREE_RARE_CHANCE;
}

// ---- the map types -------------------------------------------------------
// The valley comes out from under the snow a different shape each winter
// (lore.md), and MAPS is the shapes it comes out in. One entry is one
// INTERIOR: the border forest and the two roost corners are every shape's
// alike, because the road's gates, both nests and the crash rule are all
// measured off borderDepth and nothing may move them.
//
// `mapTerrain(k, tx, ty)` IS a shape - one pure function of the position
// noise saying what shape k makes of a tile. genWorld plants from it and the
// class screen's map draws from it (mapChip, js/ui/menu.js), so the
// picture on the chip is this seed's own valley in that shape rather than an
// illustration of one. Nothing in here rolls: the shared rng stream every
// later pass draws from is exactly what OPEN FIELD's always was, so an
// existing seed's ponds, rivers, ore and berries are where they always were
// (CLAUDE.md's rule about genWorld's stream).
//
// MAP_TYPE is the shape this page booted on - `?map=N`, else the profile's
// pick. Picking one is a PAGE, the way a reroll is (pickMap, js/ui/menu.js):
// SEED is a const every deterministic value closes over, and so is the
// ground grown from it.
const MT_SNOW = 0, MT_ICE = 1, MT_FOREST = 2;
const CENTER_R = 8; // tiles of open ground kept at the world's centre on every shape, so the river spokes still meet in the open
const MAPS = [
  // OPEN FIELD - one wide interior inside a ring of pines. The only wood is
  // the border's; `scale` missing is what says "the interior is open".
  { name: 'OPEN FIELD' },
  // THICKET - the woods took the whole valley in stands, and what is left
  // between them are the pathways. `scale` is how big a stand runs, `wood`
  // how much of the noise is one.
  { name: 'THICKET', scale: 15, wood: 0.52 },
  // FROZEN ISLES - one frozen lake with wooded islands standing out of it.
  // `land` is an island's shore, the ring of snow round its pines that ore,
  // berries and anything built have to stand on - ice takes no building and
  // grows nothing, so the shore is the whole of an island's dry ground.
  // `shore` is how far the lake laps INTO the treeline: an island within it
  // is drowned, so the woods' own edge is always water and no island is
  // reached dry-shod from the border. The band wobbles on the fine noise,
  // like the roost discs' arc, so it never reads as a traced outline.
  { name: 'FROZEN ISLES', scale: 16, wood: 0.605, land: 0.56, shore: 9 },
];
let MAP_TYPE = 0;                   // set at boot (js/boot.js), never after
function mapName(k) { return (MAPS[k] || MAPS[0]).name; }
function mapGrown(k) { return !!(MAPS[k] && MAPS[k].scale); } // does this shape grow an interior of its own?
// three octaves of the position noise, so a stand has a shape and a coast
// rather than a blob's outline
function mapFbm(tx, ty, s) {
  return vnoise(tx / s + 5.1, ty / s + 9.7) * 0.55
    + vnoise(tx / (s * 0.45) + 21.3, ty / (s * 0.45) + 43.9) * 0.3
    + vnoise(tx / (s * 0.19) + 71.7, ty / (s * 0.19) + 13.3) * 0.15;
}
function mapTerrain(k, tx, ty) {
  const bd = borderDepth(tx, ty), edge = Math.min(tx, ty, WORLD - 1 - tx, WORLD - 1 - ty);
  if (edge < bd) return MT_FOREST;
  const M = MAPS[k];
  if (!M || !M.scale) return MT_SNOW;
  if (Math.hypot(tx - cx, ty - cy) <= CENTER_R + 3) return MT_SNOW;
  // the lake stops at the road's own dry keep-out, so the lane is dry end to
  // end on every shape (the road, below) - roadMainDist and not roadDist,
  // because a shape must read the same before a spur or a path exists
  const wet = M.land !== undefined && roadMainDist(tx, ty) >= ROAD_ICE_KEEP;
  if (M.shore && edge - bd < M.shore + (vnoise(tx / 7 + 3.3, ty / 7 + 9.1) - 0.5) * 8) return wet ? MT_ICE : MT_SNOW;
  const n = mapFbm(tx, ty, M.scale);
  if (n > M.wood) return MT_FOREST;
  if (wet && n < M.land) return MT_ICE;
  return MT_SNOW;
}
// A shape that swallows the open field would also starve it: the ore and the
// berries are scattered over the interior on rolls that do not care what
// stands there, so most of them land in wood or on the lake and are dropped.
// Each grown shape is topped back up to OPEN FIELD's own strength afterwards
// (the `top-up` pass in genWorld) - a shape is a shape, never a famine.
const MAP_ROCKS = 120;  // rocks a grown shape is put back up to (OPEN FIELD's own passes leave 95-122 standing,
const MAP_BUSHES = 48;  // ...and 25-47 bushes) - a little over, since a grown shape's paths pave more away after this

function genWorld() {
  // solid irregular forest boundary - players carve their base out of this
  for (let ty = 0; ty < WORLD; ty++) {
    for (let tx = 0; tx < WORLD; tx++) {
      const d = Math.min(tx, ty, WORLD - 1 - tx, WORLD - 1 - ty);
      // `variant` picks no art any more - there is one pine in twenty-four bend
      // frames and treeFrame() reads the wind for the lean it wears (the tile's
      // own hash only mirrors it and gives it a standing lean) - but the ROLL
      // stays: dropping an rng() call here reshuffles every
      // existing seed (the hard rule in CLAUDE.md). It is rolled exactly where
      // the seed's own border (borderNoise) plants a pine; the roost discs'
      // extra pines (borderDepth) take variant 0 and roll nothing, so the
      // stream past this loop is what it always was.
      if (d < borderDepth(tx, ty)) placeObj(tx, ty, 'tree', { hp: TREE_HP, variant: d < borderNoise(tx, ty) ? randi(0, 1) : 0, rare: treeRare(tx, ty) });
    }
  }

  // central clearing (the old ore field); CENTER_R (the map types, above)
  // keeps other worldgen out of it so the river spokes still meet in open
  // ground. Its rng() draws are kept so existing seeds still produce the same world.
  for (let i = 0; i < 8; i++) { rand(-0.25, 0.25); rand(3.6, 6.2); }

  // frozen ponds - carved only into the open snow interior, away from the ring points
  const nearAnySpawn = (tx, ty, r) => ringPts.some((p) => Math.hypot(tx - p.tx, ty - p.ty) < r);
  for (let l = 0; l < 14; l++) {
    let px = 0, py = 0, ok = false;
    for (let tries = 0; tries < 40 && !ok; tries++) {
      px = randi(BORDER_MIN + 6, WORLD - 1 - BORDER_MIN - 6);
      py = randi(BORDER_MIN + 6, WORLD - 1 - BORDER_MIN - 6);
      ok = !objects[idx(px, py)] && ground[idx(px, py)] === 0 &&
        Math.hypot(px - cx, py - cy) > 16 && !nearAnySpawn(px, py, 16);
    }
    if (!ok) continue;
    let n = randi(70, 160);
    let wx = px, wy = py;
    while (n-- > 0) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const tx = wx + dx, ty = wy + dy;
        if (inWorld(tx, ty) && !objects[idx(tx, ty)] && ground[idx(tx, ty)] === 0 &&
          Math.hypot(tx - cx, ty - cy) > CENTER_R + 3 && !nearAnySpawn(tx, ty, 10) &&
          roadDist(tx, ty) >= ROAD_ICE_KEEP) ground[idx(tx, ty)] = 1; // never near the road (the `the road` group below)
      }
      wx += randi(-1, 1); wy += randi(-1, 1);
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
  // Neither test rolls anything: the rng stream a seed draws is untouched.
  const carveIce = (tx, ty) => {
    if (inWorld(tx, ty) && !objects[idx(tx, ty)] && ground[idx(tx, ty)] === 0 &&
      Math.hypot(tx - cx, ty - cy) > CENTER_R + 3 && !nearAnySpawn(tx, ty, 9) &&
      roadDist(tx, ty) >= ROAD_ICE_KEEP) ground[idx(tx, ty)] = 1;
  };
  const carveRiver = (x0, y0, x1, y1) => {
    let wx = x0, wy = y0;
    let a = Math.atan2(y1 - wy, x1 - wx) + rand(-0.4, 0.4);
    const phase = rand(0, Math.PI * 2), wig = rand(0.06, 0.12);
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

  // THE SHAPE'S OWN INTERIOR (mapTerrain, the map types above): the stands
  // of THICKET, the lake and islands of FROZEN ISLES. It runs AFTER the
  // ponds and rivers, whose retries read what stands on a tile, and BEFORE
  // the ore and the berries, whose rolls do not - so every shape draws the
  // same numbers in the same order and OPEN FIELD's world is bit-identical
  // to what it always was. Pure position noise: not one rng() call here.
  if (mapGrown(MAP_TYPE)) {
    for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
      const i = idx(tx, ty);
      if (objects[i] || ground[i] !== 0) continue;
      const t = mapTerrain(MAP_TYPE, tx, ty);
      if (t === MT_ICE) ground[i] = 1;
      else if (t === MT_FOREST) placeObj(tx, ty, 'tree', { hp: TREE_HP, variant: 0, rare: treeRare(tx, ty) });
    }
  }

  function free(tx, ty) {
    return inWorld(tx, ty) && !objects[idx(tx, ty)] && ground[idx(tx, ty)] === 0;
  }
  function nearSpawn(tx, ty) {
    return ringPts.some((p) => Math.hypot(tx - p.tx, ty - p.ty) < 8);
  }

  // no interior trees: wood only grows at the forest boundary.
  // rocks
  for (let c = 0; c < 110; c++) {
    const ox = randi(BORDER_MIN, WORLD - 1 - BORDER_MIN), oy = randi(BORDER_MIN, WORLD - 1 - BORDER_MIN);
    const n = randi(1, 4);
    for (let i = 0; i < n; i++) {
      const tx = ox + Math.round(rand(-1.6, 1.6));
      const ty = oy + Math.round(rand(-1.6, 1.6));
      if (free(tx, ty) && !nearSpawn(tx, ty) && Math.hypot(tx - cx, ty - cy) > CENTER_R + 3) {
        placeObj(tx, ty, 'rock', { hp: 5, variant: randi(0, 1) });
      }
    }
  }
  // berry bushes
  for (let c = 0; c < 96; c++) {
    const tx = randi(BORDER_MIN, WORLD - 1 - BORDER_MIN), ty = randi(BORDER_MIN, WORLD - 1 - BORDER_MIN);
    if (free(tx, ty) && !nearSpawn(tx, ty) && Math.hypot(tx - cx, ty - cy) > CENTER_R + 3) {
      placeObj(tx, ty, 'bush', { berries: 2, regrow: 0 });
    }
  }

  // the TOP-UP (MAP_ROCKS / MAP_BUSHES, the map types above): the two loops
  // over it roll positions across the whole interior and drop whatever fell
  // in wood or on the lake, so a grown shape ends with a fraction of the ore
  // and berries OPEN FIELD gets. Each is put back to strength here, on tries
  // of its own at the END of genWorld - so nothing before this line moves.
  if (mapGrown(MAP_TYPE)) {
    let rocks = 0, bushes = 0;
    for (const o of objects) if (o) { if (o.type === 'rock') rocks++; else if (o.type === 'bush') bushes++; }
    const spot = () => {
      const tx = randi(BORDER_MIN, WORLD - 1 - BORDER_MIN), ty = randi(BORDER_MIN, WORLD - 1 - BORDER_MIN);
      return free(tx, ty) && !nearSpawn(tx, ty) && Math.hypot(tx - cx, ty - cy) > CENTER_R + 3 ? { tx, ty } : null;
    };
    for (let c = 0; c < 4000 && rocks < MAP_ROCKS; c++) {
      const t = spot();
      if (t) { placeObj(t.tx, t.ty, 'rock', { hp: 5, variant: randi(0, 1) }); rocks++; }
    }
    for (let c = 0; c < 4000 && bushes < MAP_BUSHES; c++) {
      const t = spot();
      if (t) { placeObj(t.tx, t.ty, 'bush', { berries: 2, regrow: 0 }); bushes++; }
    }
  }
}

// Treasure chests: a handful of border trees swapped for buried caches,
// always on the forest's inner edge so E can reach one from open ground.
// Opening is hitObject's chest branch (js/actions.js); what one pays is the
// three constants here. Placement rolls on its own seeded stream (chRng)
// AFTER genWorld and placeCamps have finished, so it can never reshuffle
// the terrain a seed already produces.
const CHEST_COUNT = 14;
const CHEST_SPACING = 22;                       // min tiles between two chests
const CHEST_GOLD_MIN = 8, CHEST_GOLD_MAX = 20;  // the free gold inside
const CHEST_ODDS = { white: 0.55, green: 0.28, blue: 0.12, purple: 0.04, gold: 0.01 };
const CHEST_BURIED = 0.3;  // ...of them, on a shape that grows its own woods, stand buried inside a stand instead of on its edge
function placeChests() {
  const chRng = mulberry32((SEED ^ 0x43484553) >>> 0);
  const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const edge = [], deep = [];
  // a camp dug into the woods (CAMPS.hut) brings its own chests, and the rim
  // of its clearing is not the forest's inner edge: no cache stands on it -
  // nor in a drawn camp's wall of pines (CAMPS' `plan`)
  const dug = camps.filter((C) => C.spec.woods), drawn = camps.filter((C) => C.spec.plan);
  for (let ty = 1; ty < WORLD - 1; ty++) for (let tx = 1; tx < WORLD - 1; tx++) {
    const o = objects[idx(tx, ty)];
    if (!o || o.type !== 'tree') continue;
    if (dug.some((C) => Math.hypot(tx - C.tx, ty - C.ty) <= C.r + 4) || drawn.some((C) => campNear(C, tx, ty, 1))) continue;
    // the forest's inner edge: at least one cardinal neighbour is open snow
    if (SIDES.some(([dx, dy]) => !objects[idx(tx + dx, ty + dy)] &&
      ground[idx(tx + dx, ty + dy)] === 0)) edge.push({ tx, ty });
    // ...and, on a shape that grows woods over the valley, a pine with pines
    // on all four sides and more behind them: a cache nobody walks past
    else if (mapGrown(MAP_TYPE) && SIDES.every(([dx, dy]) => {
      const q = objAt(tx + dx * 2, ty + dy * 2);
      return q && q.type === 'tree';
    })) deep.push({ tx, ty });
  }
  const placed = [];
  // a BURIED chest is the same cache dug in deeper: standing in a stand with
  // no open ground touching it, so the only way to it is to chop one down.
  // Only a grown shape has such a place (OPEN FIELD's wood is one treeline
  // and everything in it is on the inner edge), so only a grown shape keeps
  // any back for it - and the edge chests are rolled FIRST off the same
  // stream, exactly as they always were.
  const nBury = mapGrown(MAP_TYPE) && deep.length ? Math.round(CHEST_COUNT * CHEST_BURIED) : 0;
  const take = (cands, want) => {
    for (let tries = 0; tries < 400 && placed.length < want; tries++) {
      const c = cands[Math.floor(chRng() * cands.length)];
      if (!c || placed.some((q) => Math.hypot(q.tx - c.tx, q.ty - c.ty) < CHEST_SPACING)) continue;
      placed.push(c);
      placeObj(c.tx, c.ty, 'chest', { hp: 1 });
    }
  };
  take(edge, CHEST_COUNT - nBury);
  if (nBury) take(deep, CHEST_COUNT);
}

// Rocks: they stand in CLUSTERS, a few mining spots a player goes to, each
// on the open snow just out from the border forest - a band ROCK_BAND_MIN..
// ROCK_BAND_MAX tiles (walked, 4-way) from its nearest pine, a border pine,
// one standing on borderDepth's side of the line, so a grown shape's inner
// woods draw no band of their own - never touching a pine and never in a
// camp's clearing, so the middle stays open ground.
// Every rock is two tiles wide (OBJECTS.rock's w): both tiles must be open
// snow, and the east one takes a `part` pointing at the anchor.
// genWorld still rolls its own rock passes (the interior scatter and a grown
// shape's top-up): taking their rng() calls out would reshuffle every seed,
// so they run as they always did and placeRocks lifts what they stood before
// placing its own, on its own stream (rkRng) AFTER the camps and the chests.
//
// Where the clusters go (ROCK_CLUSTERS): each is a direction from the
// valley's centre, turned `turn` degrees off RED's roost toward the
// top-left corner (+) or the bottom-right (-), and it stands on the rim
// that way. The centre is mirrored (ty, tx), the camps' mirror, and each
// side stands the same kinds round its own, so BLUE has the same spot: a side cluster (turned
// less than 90) is two spots, one per side, and a corner cluster (turned
// 90, one of the two corners neither side owns) is one spot, each side's
// share of it on its own bank of the creek. `kinds` goes down the rocks
// a side stands there, in order (ROCK_KINDS, js/mining.js): the sunstone
// and the frostglass are out at the contested corners, the plain stone
// nearer home.
const ROCK_CLUSTERS = [
  { turn: 50,  kinds: [0, 0, 0, 0, 0] },
  { turn: -50, kinds: [0, 0, 0, 0, 0] },
  { turn: 90,  kinds: [2, 1, 0] },
  { turn: -90, kinds: [2, 1, 0] },
];
const ROCK_CLUSTER_R = 6;     // tiles from a cluster's centre its rocks stand within
// how far off its heading a cluster's centre may slide to find room (the
// cosine), and how many rocks more than it stands that room must hold:
// tried in order, so a cramped rim takes a spot further round, and a shape
// with no dry rim that way (FROZEN ISLES) the nearest that has one
const ROCK_CLUSTER_SLACK = [[Math.cos(25 * Math.PI / 180), 2], [Math.cos(45 * Math.PI / 180), 0], [Math.cos(70 * Math.PI / 180), 0], [-1, 0]];
const ROCK_BAND_MIN = 2;      // tiles out from the border's pines the band starts...
const ROCK_BAND_MAX = 8;      // ...and ends
const ROCK_BAND_GROW = 8;     // a shape whose rim cannot hold a cluster (FROZEN ISLES: the rim is lake) widens the band by this...
const ROCK_BAND_LIMIT = 40;   // ...a step at a time, out to here
const ROCK_SPACING = 3;       // min tiles between two rocks' anchors
function placeRocks() {
  for (let i = 0; i < objects.length; i++) if (objects[i] && objects[i].type === 'rock') objects[i] = null;
  const rkRng = mulberry32((SEED ^ 0x524f434b) >>> 0);
  // distance from the border pines, flooded out across everything else
  const dist = new Int16Array(WORLD * WORLD).fill(-1), q = [];
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    const o = objects[idx(tx, ty)];
    if (o && o.type === 'tree' && Math.min(tx, ty, WORLD - 1 - tx, WORLD - 1 - ty) < borderDepth(tx, ty)) { dist[idx(tx, ty)] = 0; q.push(idx(tx, ty)); }
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % WORLD, y = (i / WORLD) | 0, d = dist[i] + 1;
    if (d > ROCK_BAND_LIMIT) continue;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (!inWorld(nx, ny) || dist[idx(nx, ny)] >= 0) continue;
      dist[idx(nx, ny)] = d; q.push(idx(nx, ny));
    }
  }
  // a tile a rock may cover: open snow, holding nothing, touching no pine
  const open = (tx, ty) => {
    if (!inWorld(tx, ty)) return false;
    const i = idx(tx, ty);
    if (objects[i] || ground[i] !== 0 || dist[i] < ROCK_BAND_MIN) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const o = objAt(tx + dx, ty + dy);
      if (o && o.type === 'tree') return false;
    }
    return true;
  };
  // an anchor a rock may take, `hi` tiles out at most: both tiles open, out of the camps
  const fits = (tx, ty, hi) => open(tx, ty) && open(tx + 1, ty) && dist[idx(tx, ty)] <= hi &&
    !camps.some((C) => campNear(C, tx + 0.5, ty, 2.5));
  const placed = [];
  const clear = (tx, ty) => !placed.some((c) => Math.hypot(c.tx - tx, c.ty - ty) < ROCK_SPACING);
  const stand = (tx, ty, kind) => {
    const o = placeObj(tx, ty, 'rock', { kind, regrow: 0, crack: 0, miner: -1 });
    objects[idx(tx + 1, ty)] = { type: 'part', tx: tx + 1, ty, of: o, flash: 0, shake: 0 };
    placed.push({ tx, ty });
  };
  // the halves: RED's below the mirror line (tx < ty), BLUE's above it, a
  // rock's two tiles wholly on its own side
  const half = (tx, ty, side) => side ? tx > ty : tx + 1 < ty;
  const c0 = (WORLD - 1) / 2, rx = -Math.SQRT1_2, ry = Math.SQRT1_2; // toward RED's roost
  for (const K of ROCK_CLUSTERS) {
    // RED's roost direction turned toward the top-left corner (+) or the bottom-right (-)
    const a = Math.abs(K.turn) * Math.PI / 180, cn = K.turn > 0 ? -Math.SQRT1_2 : Math.SQRT1_2;
    const vx = rx * Math.cos(a) + cn * Math.sin(a), vy = ry * Math.cos(a) + cn * Math.sin(a);
    // the centre: RED's rim anchor nearest the heading, whose mirror fits too
    // and with room round both for the cluster (a spot where the rim is a
    // thin strip between the pines and a lake holds too few). A corner
    // cluster straddles the line, so its centre is on it - unless it had to
    // slide far enough round to be two spots, one per side.
    const corner = Math.abs(K.turn) >= 90;
    // how many rocks a centre can hold, ROCK_SPACING apart
    const room = (kx, ky, side, hi) => {
      const got = [];
      for (let ty = Math.floor(ky) - ROCK_CLUSTER_R; ty <= ky + ROCK_CLUSTER_R; ty++) for (let tx = Math.floor(kx) - ROCK_CLUSTER_R; tx <= kx + ROCK_CLUSTER_R; tx++) {
        if (inWorld(tx, ty) && Math.hypot(tx - kx, ty - ky) <= ROCK_CLUSTER_R && half(tx, ty, side) && fits(tx, ty, hi) &&
          clear(tx, ty) && got.every((g) => Math.hypot(g.tx - tx, g.ty - ty) >= ROCK_SPACING)) got.push({ tx, ty });
      }
      return got.length;
    };
    let best = null;
    for (const [slide, spare] of ROCK_CLUSTER_SLACK) for (let hi = ROCK_BAND_MAX; hi <= ROCK_BAND_LIMIT && !best; hi += ROCK_BAND_GROW) {
      const heads = [];
      for (let ty = 1; ty < WORLD - 1; ty++) for (let tx = 1; tx < WORLD - 2; tx++) {
        const ox = tx - c0, oy = ty - c0, l = Math.hypot(ox, oy) || 1, cosA = (ox * vx + oy * vy) / l;
        if (cosA > slide && half(tx, ty, 0) && fits(tx, ty, hi) && fits(ty, tx, hi)) heads.push({ tx, ty, cosA });
      }
      heads.sort((u, v) => v.cosA - u.cosA);
      for (const h of heads) {
        const m = (h.tx + h.ty) / 2;
        h.straddle = corner && Math.abs(h.tx - h.ty) <= 2 * ROCK_CLUSTER_R;
        const ok = h.straddle ? room(m, m, 0, hi) >= K.kinds.length + spare && room(m, m, 1, hi) >= K.kinds.length + spare
          : room(h.tx, h.ty, 0, hi) >= K.kinds.length + spare && room(h.ty, h.tx, 1, hi) >= K.kinds.length + spare;
        if (ok) { best = h; break; }
      }
    }
    if (!best) continue;
    const m = (best.tx + best.ty) / 2, stood = [[], []];
    for (const side of [0, 1]) {
      const kx = best.straddle ? m : side ? best.ty : best.tx, ky = best.straddle ? m : side ? best.tx : best.ty;
      let n = 0;
      // each side fills its own spot with the same kinds, reaching further
      // in only when the rim near the centre cannot hold them
      for (let hi = ROCK_BAND_MAX; hi <= ROCK_BAND_LIMIT && n < K.kinds.length; hi += ROCK_BAND_GROW) {
        const cand = [];
        const R = Math.ceil(ROCK_CLUSTER_R);
        for (let ty = Math.floor(ky) - R; ty <= ky + R; ty++) for (let tx = Math.floor(kx) - R; tx <= kx + R; tx++) {
          if (inWorld(tx, ty) && Math.hypot(tx - kx, ty - ky) <= ROCK_CLUSTER_R && half(tx, ty, side) && fits(tx, ty, hi)) cand.push({ tx, ty });
        }
        // shuffled first, then in reading order for any a crowded shuffle left out
        const order = cand.slice();
        for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rkRng() * (i + 1)); const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
        for (const c of cand.concat(order)) {
          if (n >= K.kinds.length) break;
          if (!fits(c.tx, c.ty, hi) || !clear(c.tx, c.ty)) continue;
          stand(c.tx, c.ty, K.kinds[n++]);
          stood[side].push(placed[placed.length - 1]);
        }
      }
    }
    // a side that got fewer leaves the other its count, never more: the
    // last-stood (plainest) go
    const keep = Math.min(stood[0].length, stood[1].length);
    for (const st of stood) for (const c of st.slice(keep)) {
      objects[idx(c.tx, c.ty)] = objects[idx(c.tx + 1, c.ty)] = null;
      placed.splice(placed.indexOf(c), 1);
    }
  }
}
// Taking a piece of scenery off the map at runtime (a crater, the landing's
// lane, the merchant's axe): the whole footprint goes, so a two-tile rock
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
// THE ROAD: one straight lane down the map's whole diagonal, corner to
// corner, world edge to world edge - a route that comes from somewhere
// beyond and goes on past us, not a thing that starts and ends on this map.
// Across the open field it is ROAD_HW tiles either side of the centreline,
// room for a whole side and a wave to fight in; where it enters each roost
// corner's woods (the GATE - roadSpan, the treeline on the diagonal, two
// pennant poles in the side's colour) it narrows to ROAD_HW_WOOD, a forest
// road with the pines closing in, and ROAD_LOG_IN past its nest's junction a
// felled trunk lies across it (`log`): the way on is blocked, and the road
// running on under it to the edge says the route does not end here. Ground
// 3, packed earth showing through the snow, two ruts down its length. It
// walks like snow (only ice and holes are special-cased in updatePlayer's
// momentum block) but it is not snow: nothing digs into it (tryProne, the
// hunter's burrow), nothing grows or is built on it (every `ground === 0`
// site test refuses it), and a fish never counts it as water (fishWater).
// Laid by placeRoad AFTER genWorld and BEFORE the camps, on pure reads of
// the same treeline rule diagEnd (eagle.js) flies the eagles by, so it
// neither moves the shared rng stream nor differs run to run. Its EDGE is
// ragged, not a tile staircase: roadEdgeAt wanders the half-width along the
// lane on the position noise, per side, and roadDist measures any point - a
// tile centre for the ground array, a pixel for the ground bake
// (paintRoadOverlay, draw-world.js) - against that wandering edge, so the
// two agree. It never meets ice: genWorld's carve rules keep every pond and
// river ROAD_ICE_KEEP tiles off its edge (a river running at it peters out
// over ROAD_ICE_TAPER first), so the lane is dry end to end and the ice
// network lives further out. A rock or a bush on it is gone. Every camp site
// (CAMP_SITES) is written well off its centreline, so the wolves are never
// on it. Its centre is open ground.
// THE NESTS sit beside it, not on it: each bird flies the road home and
// banks off to its own right into the woods (roadNest - RED's to the
// top-left side of the bottom-left corner's road, BLUE's to the bottom-right
// of the top-right's, mirrored through the centre like the camps), and its
// crash cuts a SPUR from the crater straight back to the road, paved behind
// the felling front (planLane/laneStep, eagle.js) into a narrower track
// (SPUR_HW) that joins the road at the JUNCTION. So from the road the way to
// a bird is one straight sightline down its spur. roadDist is the min over
// the diagonal AND the paved spurs (the `spurs` registry below), so the
// ground bake, the ice rules and every `onRoad` read see one road system.
// The waves (the `soldiers` banner, robots.js) march its waypoints from
// junction to junction, then the rival's spur.
const ROAD_HW = 3.5;        // tiles either side of the centreline across the field: a seven-tile lane
const ROAD_HW_WOOD = 2.5;   // ...and through each corner's woods: a five-tile forest road
const ROAD_GATE_BLEND = 2;  // u either side of a gate the width eases from one to the other
const ROAD_RAG = 0.8;       // tiles the edge wanders either way - the organic verge
const ROAD_RUT = 1.0;       // tiles off the centreline the two ruts run
const ROAD_SHOULDER = 1.4;  // tiles of dirty snow past the edge (the bake only)
const ROAD_ICE_KEEP = 6;    // tiles past the edge no pond or river reaches (genWorld's carve rules)
const ROAD_ICE_TAPER = 7;   // ...and the tiles over which a river narrows to nothing on its way in
const ROAD_STEP = 20;       // tiles between a wave's waypoints along it
const ROAD_POLE_OUT = 0.9;  // tiles past the edge a pennant pole stands
const ROAD_NEST_IN = 8;     // u past a gate, into the woods, the nest's junction sits at least...
const ROAD_NEST_MAX = 40;   // ...and at most: roadNest walks inward until the nest is deep enough (roadNestDeep)
const ROAD_NEST_OFF = 13;   // tiles off the centreline, to the bird's own right, the nest itself sits
const ROAD_LOG_IN = 10;     // u past the junction the felled trunk lies across the road
const ROAD_LOG_HALF = 2;    // tiles of trunk either side of the centreline along the cross-diagonal: five pieces, a little over the forest road's width
const SPUR_HW = 1.25;       // tiles either side of a spur's centreline that are felled and paved - so the paved track stays clear of the crash's stumps
// the diagonal in tile space: tx + ty = WORLD - 1, `u` running 0 at the
// bottom-left corner to WORLD - 1 at the top-right. All three take a tile
// index (the tile's centre) or a continuous tile coordinate alike.
// roadOffS is signed (+ toward the bottom-right side), roadOff its size.
function roadAlong(fx, fy) { return (fx - fy + WORLD - 1) / 2; }
function roadOffS(fx, fy) { return (fx + fy - (WORLD - 1)) / Math.SQRT2; }
function roadOff(fx, fy) { return Math.abs(roadOffS(fx, fy)); }
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
// inside it. No ends: the road runs off both edges of the world.
function roadMainDist(fx, fy) {
  if (PRACTICE) return 99;
  const o = roadOffS(fx, fy);
  return Math.abs(o) - roadEdgeAt(roadAlong(fx, fy), o < 0 ? -1 : 1);
}
// THE SPURS: one per roost, cut and paved by the bird's own felling front
// (planLane/laneStep, eagle.js) from the crater back to the road. Continuous
// tile-index coordinates (an integer is a tile's centre, like planLane's):
// the junction on the road's centreline, the unit direction toward the
// crater, the track's length (it stops `end` tiles short of the crater, at
// the rim of the blast) and how much is paved so far, measured back from
// the crater end - the front walks crater -> road, so the paved stretch is
// [len - paved, len]. A spur is only a road where it is paved: spurDist
// answers 99 for the unpaved rest, so the bake, the maps and onRoad all
// turn to earth exactly as the front passes. A team crashing twice on one
// page (a rematch) re-registers its spur (and its pad, addPad) in place.
const spurs = [];
function addSpur(team, jx, jy, cx, cy, end) {
  const dx = cx - jx, dy = cy - jy, L = Math.hypot(dx, dy) || 1;
  const sp = { team, x: jx, y: jy, dx: dx / L, dy: dy / L, len: Math.max(0, L - end), paved: 0 };
  const i = spurs.findIndex((s) => s.team === team);
  if (i >= 0) spurs[i] = sp; else spurs.push(sp);
  return sp;
}
// THE PADS: the blown disc under each roost, packed earth from the crash
// (eagleCrash, eagle.js) - the same registry, so a pad is a road to every
// reader, and the spur starts at its rim
function addPad(team, cx, cy, r) {
  const sp = { team, pad: true, x: cx, y: cy, hw: r, paved: 1 };
  const i = spurs.findIndex((s) => s.team === team && s.pad);
  if (i >= 0) spurs[i] = sp; else spurs.push(sp);
  return sp;
}
function spurDist(sp, fx, fy) {
  if (sp.pad) return Math.hypot(fx - sp.x, fy - sp.y) - sp.hw;
  if (sp.paved <= 0) return 99;
  const px = fx - sp.x, py = fy - sp.y;
  const a = px * sp.dx + py * sp.dy, lat = Math.abs(px * sp.dy - py * sp.dx);
  const c = Math.max(sp.len - sp.paved, Math.min(sp.len, a));
  return Math.hypot(lat, a - c) - SPUR_HW;
}
// signed distance (tiles) from the nearest road edge - the diagonal's or a
// paved spur's: negative inside. What a tile IS (onRoad) and what a pixel
// looks like (paintRoadOverlay) both ask this one function.
function roadDist(fx, fy) {
  let d = roadMainDist(fx, fy);
  for (const sp of spurs) { const e = spurDist(sp, fx, fy); if (e < d) d = e; }
  const t = pathDist(fx, fy); // a grown shape's own paths (below); 99 on every shape that lays none
  return t < d ? t : d;
}
// the GATES: where the road crosses each corner's treeline on the diagonal -
// the first open tile past the last wooded one, diagEnd's own rule. u0 is
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
// the road as it is LAID and DRAWN: roadDist, ended on the cistern's gates
// (cisternLane, js/cistern.js) - the road through the middle is the orca's
// ice. Not genWorld's: its carve rules ask roadDist itself, before the creek
// is in, so no seed's ponds move
function laneDist(fx, fy) { return Math.max(roadDist(fx, fy), cisternLane(fx, fy)); }
function onRoad(tx, ty) { return laneDist(tx, ty) < 0; }
// where a side's bird roosts, off its own forest road: the JUNCTION on the
// centreline at least ROAD_NEST_IN past the gate, and the NEST ROAD_NEST_OFF
// tiles off it to the bird's own right - RED (team 0) flies down to the
// bottom-left and its right is the top-left side (roadOffS < 0), BLUE's the
// bottom-right - so the two nests mirror through the map's centre like the
// camps. The junction walks inward from the gate until the nest is DEEP
// (roadNestDeep) with MIN_CRASH_TREES round it (eagle.js's crash rule: trees
// all round, never the tree edge or a bay), the deepest, densest spot seen
// standing in if none qualifies. Pure reads, cached - a seed's nests are
// where they always are. Returns the junction u, the side, both points in
// tile-index space (jx/jy, nx/ny) and the junction in px.
// Deep means two things at once: CRASH_DEPTH inside the treeline by the
// border's own measure (forestDepth, eagle.js - the nearest world edge's
// woods) AND CRASH_DEPTH inside the corner's roost disc (ROOST_R less its
// wobble), because forestDepth only knows the nearest edge and a spot can
// be deep in the right-hand border's pines with the open field five tiles
// off it across the disc's arc.
function roadNestDeep(tx, ty) {
  const c = Math.min(Math.hypot(tx, WORLD - 1 - ty), Math.hypot(WORLD - 1 - tx, ty)); // to the nearer roost corner
  return forestDepth(tx, ty) >= CRASH_DEPTH && c <= ROOST_R - ROOST_WOBBLE - CRASH_DEPTH;
}
const roadNestC = [null, null];
function roadNest(team) {
  if (roadNestC[team]) return roadNestC[team];
  const s = roadSpan(), side = team === 0 ? -1 : 1, dir = team === 0 ? -1 : 1; // dir: u toward this side's corner
  const gate = team === 0 ? s.u0 : s.u1, off = side * ROAD_NEST_OFF / Math.SQRT2;
  const treesAt = (tx, ty) => {
    let n = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const o = objAt(tx + dx, ty + dy);
      if (o && (o.type === 'tree' || o.type === 'deadTree')) n++;
    }
    return n;
  };
  let pick = null, best = null, bestScore = -Infinity;
  for (let i = ROAD_NEST_IN; i <= ROAD_NEST_MAX; i++) {
    const u = gate + dir * i, tx = Math.round(u + off), ty = Math.round(WORLD - 1 - u + off);
    if (tx < 4 || ty < 4 || tx >= WORLD - 4 || ty >= WORLD - 4) break;
    const n = treesAt(tx, ty);
    if (roadNestDeep(tx, ty) && n >= MIN_CRASH_TREES) { pick = u; break; }
    const score = Math.min(forestDepth(tx, ty), CRASH_DEPTH) * 4 + n + i;
    if (score > bestScore) { bestScore = score; best = u; }
  }
  const u = pick != null ? pick : best != null ? best : gate + dir * ROAD_NEST_IN;
  const jx = u, jy = WORLD - 1 - u;
  return (roadNestC[team] = { u, side, jx, jy, nx: jx + off, ny: jy + off, x: (jx + 0.5) * TILE, y: (jy + 0.5) * TILE });
}
function placeRoad() {
  if (PRACTICE) return;
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    if (!onRoad(tx, ty)) continue;
    const i = idx(tx, ty);
    if (ground[i] === 4 || ground[i] === 5) continue; // the lane never paves the creek, and a path stops at its water
    ground[i] = 3; // the lane is never ice (genWorld keeps it ROAD_ICE_KEEP away); a PATH crossing a frozen lake is

    objects[i] = null; // only worldgen's scenery stands here yet: a pine of the woods it cuts through, a rock, a bush
  }
  // the furniture: a point `out` tiles past the ragged edge on one side of u,
  // if that tile is on dry ground (a pennant pole takes the pine on its spot -
  // the gate stands in the treeline - but gives way to a rock or a bush)
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
  // the felled trunk across each forest road, ROAD_LOG_IN past its junction:
  // one `log` per tile along the cross-diagonal, the pieces touching corner
  // to corner so nothing squeezes between them; a pine on the verge gives
  // way to the ends. Its pixels are the ground's (paintLog, draw-world.js).
  for (const team of [0, 1]) {
    const uc = Math.round(roadNest(team).u + (team === 0 ? -1 : 1) * ROAD_LOG_IN);
    for (let k = -ROAD_LOG_HALF; k <= ROAD_LOG_HALF; k++) {
      const tx = uc + k, ty = WORLD - 1 - uc + k;
      if (!inWorld(tx, ty) || waterAt(tx, ty)) continue;
      objects[idx(tx, ty)] = null;
      placeObj(tx, ty, 'log', { seg: k === -ROAD_LOG_HALF ? 0 : k === ROAD_LOG_HALF ? 2 : 1 });
    }
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

// ---- the paths ----------------------------------------------------------
// A shape that grows woods over the whole valley (MAPS, above) would else be
// a wall, so it lays PATHS through them: packed earth about a pine wide,
// cut where the shape's own gaps run. A path IS road - roadDist mins over
// the paths, so placeRoad paves them with the lane in its one pass, the
// ground array says 3, both maps ink them, nothing grows on one, a building
// stands on one and nobody digs into one - only narrower than the lane and
// without its ruts, which paintRoadOverlay measures off the diagonal a path
// is nowhere near.
//
// The network, laid by layPaths() between genWorld and placeRoad: ONE route
// from a side's junction on the road to the rival's, and a BRANCH off it to
// every camp, so the woods can never wall a camp in. Each is a Dijkstra over
// the tiles on a cost field where WOOD IS A WALL (pathCost): open snow 1, the
// frozen lake PATH_ICE, the road's own corridor PATH_LANE, and anything
// standing refused outright. So what a route IS, is the SHORTEST WAY BETWEEN
// THE TWO ROOSTS THROUGH THE GROUND THAT IS ALREADY CLEAR - the gaps the
// noise left, threaded, never a line driven through a stand - and it CROSSES
// the lane instead of joining it, a path being the way the road is not: a
// flank, walked, with no cable on it. Only if a shape leaves no clear route
// at all does layPaths search again with the axe (`cut`), because a route is
// also the promise that there is one.
//
// The PAVING is a tile or so wider than the route either side, so a path
// running down a gap trims the edge of the stands beside it - that is a
// cleared verge, not the route breaking through: where a path GOES never
// needed an axe.
const PATH_HW = 1.15;   // tiles either side of a path's centreline
const PATH_RAG = 0.3;   // ...that the half-width wanders on the position noise
const PATH_WOOD = 9;    // a tile of pines costs a route this many tiles of open snow - in the `cut` fallback ONLY; a route normally refuses one
const PATH_ICE = 1.3;   // ...and a tile of frozen lake this many
const PATH_LANE = 18;   // ...and a tile inside the road's corridor this many
const PATH_CAMP = 3;    // tiles past a camp's cleared ground (r + 2) a branch stops, so clearCamp never eats the path's end
const PATH_SEG = 4;     // tiles of route per registered segment: the polyline that smooths the search's staircase
const paths = [];       // { x, y, dx, dy, len } in tile-index space, like a spur
// which segment is nearest a tile's centre, and which is next - stamped once
// by indexPaths, so roadDist costs one array read and at most two segments
// per PIXEL of the ground bake instead of a walk down the whole network
let pathA = null, pathB = null;

function pathLat(t, fx, fy) {
  const px = fx - t.x, py = fy - t.y;
  let a = px * t.dx + py * t.dy;
  a = a < 0 ? 0 : a > t.len ? t.len : a;
  return Math.hypot(px - t.dx * a, py - t.dy * a);
}
// signed distance (tiles) from the nearest path's ragged edge, negative
// inside - roadDist's third term. 99 where no path was ever laid.
function pathDist(fx, fy) {
  if (!pathA) return 99;
  const tx = fx < 0 ? 0 : fx > WORLD - 1 ? WORLD - 1 : Math.round(fx);
  const ty = fy < 0 ? 0 : fy > WORLD - 1 ? WORLD - 1 : Math.round(fy);
  const i = ty * WORLD + tx;
  const a = pathA[i];
  if (a < 0) return 99;
  let lat = pathLat(paths[a], fx, fy);
  const b = pathB[i];
  if (b >= 0) { const e = pathLat(paths[b], fx, fy); if (e < lat) lat = e; }
  return lat - (PATH_HW + (vnoise(fx * 0.42 + 61.3, fy * 0.42 + 17.9) - 0.5) * 2 * PATH_RAG);
}
function addPathSeg(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (L < 0.001) return;
  paths.push({ x: x0, y: y0, dx: dx / L, dy: dy / L, len: L });
}
// a searched route (tiles) as segments every PATH_SEG tiles: consecutive
// segments share an end, so the polyline is continuous and a bend is eased
// rather than walked as an eight-way staircase
function addPathRoute(path) {
  for (let i = 0; i < path.length - 1; i += PATH_SEG) {
    const j = Math.min(path.length - 1, i + PATH_SEG);
    addPathSeg(path[i][0], path[i][1], path[j][0], path[j][1]);
  }
  // ...and wherever it crosses the creek (the `the creek` group below), a
  // ford of stepping stones at the middle of the crossing: placeRoad paves
  // the path up to the water and leaves the water be
  const wetOrFord = (t) => waterAt(t[0], t[1]) || ground[idx(t[0], t[1])] === 5;
  for (let i = 0; i < path.length; i++) {
    if (!wetOrFord(path[i])) continue;
    let j = i;
    while (j + 1 < path.length && wetOrFord(path[j + 1])) j++;
    const m = path[(i + j) >> 1];
    if (ground[idx(m[0], m[1])] === 4) creekFord(m[0], m[1]);
    i = j;
  }
}
function indexPaths() {
  if (!paths.length) return;
  const N = WORLD * WORLD;
  pathA = new Int16Array(N).fill(-1); pathB = new Int16Array(N).fill(-1);
  const dA = new Float32Array(N).fill(Infinity), dB = new Float32Array(N).fill(Infinity);
  const R = PATH_HW + PATH_RAG + ROAD_SHOULDER + 2.4; // past this a pixel of the tile can no longer be painted by the segment
  for (let s = 0; s < paths.length; s++) {
    const t = paths[s];
    const ex = t.x + t.dx * t.len, ey = t.y + t.dy * t.len;
    const x0 = Math.max(0, Math.floor(Math.min(t.x, ex) - R)), x1 = Math.min(WORLD - 1, Math.ceil(Math.max(t.x, ex) + R));
    const y0 = Math.max(0, Math.floor(Math.min(t.y, ey) - R)), y1 = Math.min(WORLD - 1, Math.ceil(Math.max(t.y, ey) + R));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const d = pathLat(t, tx, ty);
      if (d > R) continue;
      const i = ty * WORLD + tx;
      if (d < dA[i]) { dB[i] = dA[i]; pathB[i] = pathA[i]; dA[i] = d; pathA[i] = s; }
      else if (d < dB[i]) { dB[i] = d; pathB[i] = s; }
    }
  }
}

// What one tile costs a route, in tiles of open snow; -1 refuses it outright.
//
// WOOD IS A WALL, NOT A PRICE. Anything standing that a walker would have to
// break is refused, so the route the search returns is the shortest one
// through the ground that is ALREADY CLEAR - the gaps between the stands, the
// lake, the open snow - and never a line bulldozed through a stand. A bush is
// not one of those: it is walked past, and the paving takes it like the lane
// does. `cut` is the fallback layPaths falls back to when a shape leaves no
// clear route at all, and then wood costs PATH_WOOD instead of refusing.
//
// The lane's own tiles are read as CLEAR whatever stands on them, because
// placeRoad fells and paves the whole diagonal a moment after this runs -
// which is also what lets a route start at a junction buried in the corner's
// woods. It still pays PATH_LANE to be there, so it crosses and never joins.
// The camps are not standing yet either (placeCamps runs after the road), so
// their ground is kept off by geometry - `block`, the discs layPaths hands in.
function pathCost(tx, ty, block, cut) {
  if (Math.min(tx, ty, WORLD - 1 - tx, WORLD - 1 - ty) < 4 || cisternIn(tx, ty)) return -1; // a path goes round the cistern
  const i = idx(tx, ty);
  const g = ground[i];
  if (g === 2) return -1;
  if (block) for (const b of block) if (Math.hypot(tx - b.tx, ty - b.ty) < b.r) return -1;
  const lane = roadMainDist(tx, ty);
  const o = lane < 0 ? null : objects[i];
  const wall = !!o && isSolidTile(tx, ty);
  if (wall && (!cut || !laneFells(o))) return -1;
  let c = g === 1 ? PATH_ICE : g === 4 ? CREEK_COST : 1; // the creek is crossed, briefly; a ford (5) is dry ground
  if (wall) c += PATH_WOOD;
  if (lane < ROAD_HW + 1) c += PATH_LANE;
  return c;
}
let pathD = null, pathFrom = null, pathDone = null;
// Dijkstra over the tile grid on pathCost, start tile to goal tile, or null
// if the goal cannot be reached at any price. Runs at boot, a handful of
// times, over the world's 53,824 tiles.
function pathRoute(sx, sy, gx, gy, block, cut) {
  const N = WORLD * WORLD;
  if (!pathD) { pathD = new Float32Array(N); pathFrom = new Int32Array(N); pathDone = new Uint8Array(N); }
  pathD.fill(Infinity); pathFrom.fill(-1); pathDone.fill(0);
  const hn = [], hc = [];
  const push = (n, c) => {
    let i = hn.length; hn.push(n); hc.push(c);
    while (i > 0) { const p = (i - 1) >> 1; if (hc[p] <= c) break; hn[i] = hn[p]; hc[i] = hc[p]; i = p; }
    hn[i] = n; hc[i] = c;
  };
  const pop = () => {
    const n = hn[0], ln = hn.pop(), lc = hc.pop();
    if (hn.length) {
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= hn.length) break;
        if (c + 1 < hn.length && hc[c + 1] < hc[c]) c++;
        if (hc[c] >= lc) break;
        hn[i] = hn[c]; hc[i] = hc[c]; i = c;
      }
      hn[i] = ln; hc[i] = lc;
    }
    return n;
  };
  if (!inWorld(sx, sy) || !inWorld(gx, gy)) return null;
  const s = idx(sx, sy), g = idx(gx, gy);
  pathD[s] = 0; push(s, 0);
  while (hn.length) {
    const n = pop();
    if (pathDone[n]) continue;
    pathDone[n] = 1;
    if (n === g) break;
    const tx = n % WORLD, ty = (n / WORLD) | 0, d = pathD[n];
    for (let k = 0; k < 8; k++) {
      const nx = tx + NAV_DX[k], ny = ty + NAV_DY[k];
      if (!inWorld(nx, ny)) continue;
      const m = ny * WORLD + nx;
      if (pathDone[m]) continue;
      const c = pathCost(nx, ny, block, cut);
      if (c < 0) continue;
      const nd = d + c * NAV_COST[k];
      if (nd >= pathD[m]) continue;
      pathD[m] = nd; pathFrom[m] = n; push(m, nd);
    }
  }
  if (!pathDone[g]) return null;
  const out = [];
  for (let n = g; n >= 0; n = pathFrom[n]) out.push([n % WORLD, (n / WORLD) | 0]);
  out.reverse();
  return out;
}
// Runs at boot between genWorld() and placeRoad() (js/boot.js). A shape that
// grows no interior of its own lays nothing at all, so OPEN FIELD - and the
// practice arena, which has no road to hang one off - are untouched.
function layPaths() {
  if (PRACTICE || !mapGrown(MAP_TYPE)) return;
  paths.length = 0; pathA = pathB = null;
  // every camp's ground, kept off the route: placeCamps clears r + 2 back to
  // snow afterwards and would eat a path that ran through one
  const block = campSites().map((site) => {
    const t = campTile(site.u, site.s);
    return { tx: t.tx, ty: t.ty, r: CAMPS[site.key].r + PATH_CAMP, woods: CAMPS[site.key].woods };
  });
  // the STRICT search first - the shortest way through the clear ground - and
  // the axe only if this shape left no clear way at all, because a route is
  // also the promise that there IS one (world.md#the-paths)
  const route = (sx, sy, gx, gy, bl) => pathRoute(sx, sy, gx, gy, bl, false) || pathRoute(sx, sy, gx, gy, bl, true);
  const a = roadNest(0), b = roadNest(1);
  const main = route(Math.round(a.jx), Math.round(a.jy), Math.round(b.jx), Math.round(b.jy), block);
  if (!main) return;
  addPathRoute(main);
  // a branch to each camp: off the route's nearest point, out to the rim of
  // the ground clearCamp will clear, and no further - but none to a camp in
  // the border woods (CAMPS.hut), which is meant to be dug out with an axe
  for (const c of block) {
    if (c.woods) continue;
    let sx = -1, sy = -1, bd = Infinity;
    for (const pt of main) {
      const d = Math.hypot(pt[0] - c.tx, pt[1] - c.ty);
      if (d < bd) { bd = d; sx = pt[0]; sy = pt[1]; }
    }
    if (sx < 0 || bd <= c.r + 1) continue;
    const an = Math.atan2(sy - c.ty, sx - c.tx);
    const gx = Math.round(c.tx + Math.cos(an) * c.r), gy = Math.round(c.ty + Math.sin(an) * c.r);
    const br = route(sx, sy, gx, gy, block.filter((o) => o !== c));
    if (br) addPathRoute(br);
  }
  indexPaths();
}

// ---- the creek ------------------------------------------------------------
// One creek that never freezes runs the whole map, world edge to world edge,
// down the CROSS-diagonal (tx = ty) - the top-left corner to the
// bottom-right, the road's opposite - so it cuts the valley into RED's half
// and BLUE's, the roosts one either side, and it meets the road once, at the
// middle, where the waves meet. Like the road it comes from beyond and goes
// on past us: through the border woods too, where the pines stand to the
// water's edge.
//
// It is GROUND 4, open water: every walker but a player treats it as a wall,
// no route crosses it (waterAt), and a player who steps in plunges exactly as
// into an ice hole (updatePlayer) - a roll started at the bank carries over it, and the
// scramble out is back onto the bank they went in from (nearestDryTile). The
// ways over, all of them ground that walks like snow:
//   - THE CISTERN at the middle (js/cistern.js): the creek pools inside its
//     ring and the pool is frozen over, the orca's lake (below), so the road
//     goes in at one gate and out at the other across the ice;
//   - an outer FORD on each stretch between a bend and the treeline;
//   - a ford wherever a grown shape's path crosses (addPathRoute).
// A ford is a row of stepping stones (ground 5) along one tile row across
// the water, so it is always four-connected and nobody's feet cut a corner
// through the current.
//
// The BENDS: the two camps on the mirror line (the BROWN BEAR DEN and the
// BLACK BEAR STONE, whose bears walk the bend's bank: riverPath) each have the creek swing round them in a half-loop, so
// each falls on one side's bank: the upstream one (the brown bear) to RED,
// the downstream one (the black bear) to BLUE. The line is point-symmetric
// about the crossing, as the roosts are. The other side reaches its rival's
// camp across the cistern's ice or by the outer ford past it.
//
// Geometry, in tiles, off the road's own frame: `w` along the creek is
// roadOffS (+ downstream, toward the bottom-right) and `p` across it is
// (fx - fy) / SQRT2 (+ toward the top-right, BLUE's half). creekAt measures
// any point - a tile centre for the ground array, a pixel for the bake
// (paintCreek, js/draw/ground.js) - against the wandering banks, so what a
// tile IS and what it LOOKS like agree to within the bank, as the road's do.
// Pure position noise: nothing rolls, so no seed reshuffles - but it writes
// ground after genWorld, so every seed's ground hash moves (placeCreek).
const CREEK_HW = 1.6;       // tiles either side of the creek's line the water runs: about three tiles across, which a roll from the bank still clears
const CREEK_HW_RAG = 0.22;   // ...that each bank wanders on the position noise
const CREEK_WANDER = 2.5;    // tiles the line itself wanders off the cross-diagonal, either way
const CREEK_CALM = 10;       // tiles over which the wander eases to nothing at the cistern, a bend or a ford
const CREEK_REACH = CREEK_WANDER + CREEK_HW + CREEK_HW_RAG + 0.4; // the farthest a bank ever stands off the line's bend
const CREEK_COST = 6;        // what a tile of creek costs a path's route (pathCost): it crosses, and short
const CREEK_BEND_GAP = 1.2;  // tiles of dry bank between a path's end at a bend's camp (r + PATH_CAMP) and the water
const CREEK_BEND_LONG = 2.2; // a bend runs this many times its reach along the creek either way (2 or more keeps the camp clear)
const CREEK_FORD_GAP = 14;   // tiles of creek an outer ford needs between a bend and the treeline
function creekP(fx, fy) { return (fx - fy) / Math.SQRT2; }
// the bends: every camp site on the mirror line, with how far the water's
// centre swings off the diagonal at the camp (R, out past the ground a path
// to it stops on), how far along it the swing runs either way (L) and which
// way it swings (side: + toward BLUE's half, which leaves the camp RED's)
let creekBendsC = null;
function creekBends() {
  if (creekBendsC) return creekBendsC;
  creekBendsC = [];
  for (const site of campSites()) {
    if (Math.abs(site.u - (WORLD - 1) / 2) > 0.01) continue;
    const t = campTile(site.u, site.s), w = roadOffS(t.tx, t.ty);
    const R = CAMPS[site.key].r + PATH_CAMP + CREEK_BEND_GAP + CREEK_HW;
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
// 0 through the cistern, at a bend's camp or a ford, easing to 1 CREEK_CALM
// tiles out: the wander and the banks' rag are held still where the water
// must meet a fixed thing square - the cistern's culverts are baked art, so
// there the creek is CREEK_HW either side of the cross-diagonal exactly
function creekCalm(w) {
  let k = 1;
  const at = (w0, r) => { const t = Math.max(0, Math.min(1, (Math.abs(w - w0) - r) / CREEK_CALM)); k = Math.min(k, t * t * (3 - 2 * t)); };
  at(0, CIST_RO + 1);
  for (const B of creekBends()) at(B.w, B.L / 2);
  for (const f of creekOuterFords()) at(f.w, 1);
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
const CQ = { d: 99, a: 0, n: 0, fdx: 0, fdy: 0 };
function creekAt(fx, fy) {
  const q = CQ;
  q.d = 99;
  if (PRACTICE) return 99;
  const p = creekP(fx, fy), w = roadOffS(fx, fy);
  if (Math.abs(p - creekBend(w)) - CREEK_REACH >= q.d) return q.d;
  const n = p - creekMid(w);
  q.d = n < 0 ? -n - creekHW(w, -1) : n - creekHW(w, 1);
  q.a = w; q.n = n;
  return q.d;
}
// the way the current runs at a point (CQ.fdx/fdy, a unit vector): along
// the line, bent by its bends and its wander, top-left to bottom-right
function creekFlow(fx, fy) {
  creekAt(fx, fy);
  const q = CQ;
  const w = roadOffS(fx, fy), s = creekMid(w + 0.5) - creekMid(w - 0.5), l = Math.hypot(1 + s, 1 - s);
  q.fdx = (1 + s) / l; q.fdy = (1 - s) / l;
  return q;
}
// in the water, as drawn: what the plunge asks of the feet, so nobody goes
// in off a pixel of bank, or off the ice where the creek runs on under the
// orca's lake
function creekWet(fx, fy) { return creekAt(fx, fy) < 0 && !creekIced(fx, fy); }
// THE ORCA'S LAKE: at the middle the creek pools inside the cistern's ring
// (js/cistern.js), and the pool is frozen over. The outfall still runs under
// the ice, and the orca lives in it (the `orca` banner, js/orca.js). A disc
// ORCA_LAKE_R tiles round the crossing, so each side's half of the valley
// gets the same ice: every tile in it is ice (ground 1) and the rim lies
// under the wall's inner face. The creek is frozen a little further, under
// the wall (CIST_FROZEN), and runs out of a culvert in the wall each way
// (creekIced: creekWet, paintCreek, creekFishAt). The road stops at the
// gates' sills (laneDist), so the way across is the orca's ice. Pure
// position: nothing rolls, laid by placeCistern.
const ORCA_LAKE_R = CIST_ICE; // tiles from the crossing to the ice's rim
// signed tiles from the rim (negative inside); 99 well clear of it
function orcaLakeEdge(fx, fy) {
  if (PRACTICE) return 99;
  const d = cisternR(fx, fy) - ORCA_LAKE_R;
  return d > 4 ? 99 : d;
}
function orcaLakeAt(fx, fy) { return orcaLakeEdge(fx, fy) < 0; }
// does this tile hold any of the disc or the frozen creek (a tile's whole square, for the painters)
function orcaLakeNear(tx, ty) { return !PRACTICE && cisternR(tx, ty) < CIST_FROZEN + 2; }
// the creek frozen here: inside the ring and on in under the wall
function creekIced(fx, fy) { return !PRACTICE && cisternR(fx, fy) < CIST_FROZEN; }
// the outer fords: on the diagonal, halfway between a bend's end (or the
// cistern, on a side with no bend) and where the border woods close over
// the creek - where the stretch is long enough to want one
let creekFordsC = null;
function creekOuterFords() {
  if (creekFordsC) return creekFordsC;
  creekFordsC = [];
  for (const dir of [-1, 1]) {
    let t = dir < 0 ? 0 : WORLD - 1;
    while (t >= 0 && t <= WORLD - 1 && Math.min(t, WORLD - 1 - t) < borderDepth(t, t)) t -= dir;
    const wT = roadOffS(t, t);
    let wIn = dir * (CIST_RO + 1);
    for (const B of creekBends()) if (Math.sign(B.w) === dir && Math.abs(B.w) + B.L > Math.abs(wIn)) wIn = B.w + dir * B.L;
    if ((wT - wIn) * dir < CREEK_FORD_GAP) continue;
    const w = (wT + wIn) / 2, c = (w * Math.SQRT2 + WORLD - 1) / 2;
    creekFordsC.push({ w, x: c, y: c });
  }
  return creekFordsC;
}
// a row of stepping stones across the water through (fx, fy): the nearest
// creek tile on that tile row and the whole run of water it sits in, and a
// tile of open ground cleared past either end so a ford never ends in a pine
function creekFord(fx, fy) {
  const ty = Math.round(fy);
  let tx = Math.round(fx);
  const wet = (x) => inWorld(x, ty) && (ground[idx(x, ty)] === 4 || ground[idx(x, ty)] === 5);
  if (!wet(tx)) {
    const k = [1, -1, 2, -2, 3, -3].find((d) => wet(tx + d));
    if (k === undefined) return;
    tx += k;
  }
  let x0 = tx, x1 = tx;
  while (wet(x0 - 1)) x0--;
  while (wet(x1 + 1)) x1++;
  for (let x = x0; x <= x1; x++) ground[idx(x, ty)] = 5;
  for (const x of [x0 - 1, x1 + 1]) {
    const o = objAt(x, ty);
    if (o && laneFells(o)) objects[idx(x, ty)] = null;
  }
}
// Runs at boot right after genWorld() (js/boot.js), before the paths and the
// road: the water fells whatever grew on it (its banks keep their pines) and
// the fixed fords go down. A path's own fords follow in layPaths (addPathRoute).
// Last, the cistern stands round the middle and its pool freezes over: the
// orca's lake (placeCistern, js/cistern.js).
function placeCreek() {
  if (PRACTICE) { placeCistern(); return; } // ...which stands down in the practice arena
  creekBendsC = null; creekFordsC = null;
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) {
    const i = idx(tx, ty);
    if (creekAt(tx, ty) >= 0) continue;
    ground[i] = 4;
    objects[i] = null;
  }
  for (const f of creekOuterFords()) creekFord(f.x, f.y);
  placeCistern();
}

// THE CREEK'S FISH: a LAKE WHITEFISH or a SNOW CHAR every CREEK_FISH_GAP
// tiles of creek, swimming downstream under the water, now and then down out
// of sight and back, in under the cistern's wall and its ice and never over
// a ford. Each one
// is a pure function of its index and the field's clock (state.windT), so
// nothing has to move them and every client places them alike; the one thing
// the match keeps is which were caught: state.creekGone maps an index to the
// windT it swims back at. A body ROLLING over the water onto one catches it
// (creekFishCatch, from the roll in updatePlayer) - the only way to them, since
// walking in is a plunge - and it goes in the pouch (ITEMS.whitefish /
// ITEMS.snowChar) to be eaten off the fish well. They are not the `fish` an
// ice hole or a net gives up (the `fish` banner, js/wildlife.js). The pixels:
// drawCreekFish, js/draw/ground.js.
const CREEK_FISH_GAP = 5;        // tiles of creek per fish
const CREEK_FISH_SPD = [18, 34]; // px/s downstream, the slowest fish .. the fastest
const CREEK_FISH_CHAR = 0.35;    // the share of them that are snow char (the bigger meal); the rest are whitefish
const CREEK_FISH_LANE = CREEK_HW - 0.9; // tiles either side of the water's middle a fish keeps to: its body clear of the banks
const CREEK_FISH_R = 11;         // px from a roller's feet that a fish is caught
const CREEK_FISH_BACK = 45;      // s before a caught fish's place in the shoal swims back
const CF = { x: 0, y: 0, w: 0, kind: 'whitefish', show: 0, fdx: 1, fdy: 0 };
function creekFishN() { return PRACTICE ? 0 : Math.ceil((WORLD - 1) * Math.SQRT2 / CREEK_FISH_GAP); }
// where fish i is now, into CF: world px, w along the creek, its kind, how
// much of it shows (0 gone or dived, 1 plain to see) and its heading
function creekFishAt(i) {
  const now = state.windT, span = (WORLD - 1) * Math.SQRT2, half = span / 2;
  const h = hash2(i * 13 + 7, 41), h2 = hash2(i * 5 + 3, 77), h3 = hash2(i + 19, i * 3 + 11);
  const v = (CREEK_FISH_SPD[0] + (CREEK_FISH_SPD[1] - CREEK_FISH_SPD[0]) * h) / TILE;
  const w = ((i * CREEK_FISH_GAP + h3 * CREEK_FISH_GAP + now * v) % span + span) % span - half; // wraps world edge to edge, where the woods hide it
  let show = Math.max(0, Math.min(1, (vnoise(now * 0.12 + i * 7.3, i * 1.9) - 0.28) * 5));
  show *= Math.max(0, Math.min(1, (Math.abs(w) - CIST_RO) / 1.2)); // swims out of a culvert
  const back = state.creekGone[i];
  if (back !== undefined) show *= Math.max(0, Math.min(1, now - back));
  const p = creekMid(w) + (h2 - 0.5) * 2 * CREEK_FISH_LANE + Math.sin(now * 1.3 + i) * 0.25;
  const fx = ((w + p) * Math.SQRT2 + WORLD - 1) / 2, fy = ((w - p) * Math.SQRT2 + WORLD - 1) / 2;
  if (show > 0 && creekIced(fx, fy)) show = 0; // under the orca's lake's ice
  if (show > 0) { // ...and never shows over a ford's stones
    const tx = Math.round(fx), ty = Math.round(fy);
    for (let dy = -1; dy <= 1 && show > 0; dy++) for (let dx = -1; dx <= 1; dx++) if (inWorld(tx + dx, ty + dy) && ground[idx(tx + dx, ty + dy)] === 5) { show = 0; break; }
  }
  const f = creekFlow(fx, fy);
  CF.fdx = f.fdx; CF.fdy = f.fdy;
  CF.x = (fx + 0.5) * TILE; CF.y = (fy + 0.5) * TILE; CF.w = w; CF.show = show;
  CF.kind = hash2(i * 3 + 101, 59) < CREEK_FISH_CHAR ? 'snowChar' : 'whitefish';
  return CF;
}
// A roll over the creek takes any fish it passes over (from the roll in
// updatePlayer, js/sim.js). Two rollers can reach one fish in a step, so it is
// contested, not first-come.
function creekFishCatch(p) {
  if (PRACTICE || creekAt(p.x / TILE - 0.5, (p.y + 4) / TILE - 0.5) > 0.6) return;
  const n = creekFishN(), g = state.creekGone;
  for (const k in g) if (state.windT > g[k] + 1) delete g[k]; // swum back in: forgotten
  for (let i = 0; i < n; i++) {
    const f = creekFishAt(i);
    if (f.show < 0.5 || Math.hypot(f.x - p.x, f.y - (p.y + 4)) > CREEK_FISH_R) continue;
    const kind = f.kind, x = f.x, y = f.y;
    contest('creekfish:' + i, p, () => {
      if (g[i] !== undefined && state.windT < g[i] + 1) return;
      g[i] = state.windT + CREEK_FISH_BACK;
      bagAdd(p, kind, 1);
      addFloater(x, y - 10, ITEMS[kind].name + '!', RES_COLORS[kind]);
      burst(x, y, '#9fc4dd', 8, 45, 0.45, true);
      burst(x, y, '#ddf1f8', 5, 35, 0.4, true);
      sfxAt('splash', x, y); sfxAt('stash', x, y);
    });
  }
}
