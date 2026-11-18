'use strict';
// The frozen world: the tile grid and the objects that stand on it. The
// field that fills it is js/sim/field.js; the camps load after it
// (js/sim/camps.js).
// ------------------------------------------------------------ world
const ground = new Uint8Array(WORLD * WORLD); // 0 snow, 1 ice, 2 hole (open water), 3 the road (genWorld, js/sim/field.js)
const objects = new Array(WORLD * WORLD).fill(null);

function idx(tx, ty) { return ty * WORLD + tx; }
function inWorld(tx, ty) { return tx >= 0 && ty >= 0 && tx < WORLD && ty < WORLD; }
function objAt(tx, ty) { return inWorld(tx, ty) ? objects[idx(tx, ty)] : null; }

// Every scenery object that can stand on a tile, and everything generic code
// needs to know about one without naming its type: whether it blocks a walker,
// which tool E reaches for (`tool`) and which one a swing must already be
// holding (`needs`, null = any), whether the hands go to it on their own the
// moment it is in reach (`auto` - a tree, a snowdrop, a rival's eagle:
// autoWork, js/sim/actions.js), the verb the key prompt prints and how far
// above the tile it sits, and the colour each of the two maps paints it.
// Buildings are NOT in here - they are STRUCTS entries carrying the same
// mm/map fields, and every site below asks that table first. Adding a scenery
// type is one entry here, plus its draw branch in render() and what a swing
// does to it in hitObject(): checklists.md#common-changes. `sorted: false`
// is a type with no pixels in the y-sorted pass (something else draws it).
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
// like every other team paint.
const CH_SNOW = 0, CH_FOREST = 1, CH_ROAD = 2, CH_ICE = 3, CH_HOLE = 4,
      CH_RED = 5, CH_BLUE = 6, CH_EAGLE_RED = 7, CH_EAGLE_BLUE = 8, CH_STONE = 9;
const chTeam = (o) => skin(o.team === undefined ? 0 : o.team) ? CH_BLUE : CH_RED;   // a side's building
const chPump = (o) => o.hold >= 0 ? (skin(o.hold) ? CH_BLUE : CH_RED) : CH_STONE; // a gold pump: its holder's, or nobody's grey (js/sim/pumps.js)
const chEagle = (o) => skin(o.team === undefined ? 0 : o.team) ? CH_EAGLE_BLUE : CH_EAGLE_RED; // its bird, its gate
// whether a pine may be felled in a match - by a swing (E or the hands), a
// bot or LIGNUM's TIMBER. A wall pine (`wall`) holds the field's shape, so
// none of them opens it (every pine genWorld plants is one)
function treeFells(o) { return !!o && o.type === 'tree' && !o.wall; }
const OBJECTS = {
  // lift 33: the pine's canopy reaches 21 px above its own tile (drawn at
  // py - 21), and the prompt clears it by the same 12 px everything else gets
  // `ready`: a pine that holds the field's shape (`wall`, every one genWorld
  // plants, js/sim/field.js) never comes down (treeFells)
  tree:     { solid: true,  work: true, verb: 'CHOP', lift: 33, auto: true, ready: (o) => treeFells(o),
              mm: [52, 100, 82],   map: CH_FOREST },
  // a SNOWDROP clump, stamped only by the warren camp (CAMPS.meadow): open
  // until someone picks it, when one pick shields the picker's whole company
  // (pickSnowdrop, js/sim/actions.js), and then resting SNOWDROP_CD seconds
  // (`readyAt`, the match second it opens again: snowdropLeft, below).
  // `ready` is what makes E and the hands reach for an open clump only. Off
  // both maps: a speck on the snow is noise.
  snowdrop: { solid: false, work: true, verb: 'PICK', lift: 14, auto: true,
              ready: (o) => snowdropLeft(o) <= 0 },
  // the merchant's TRADING POST (placeStalls, robots.js): 4x2, the anchor its
  // front-left tile and the parts east and north of it, carrying its `team`.
  // No `tool` and no hp: nothing swings at it, nothing shoots it, and it is
  // in no `structures` list for a wave to siege - the counter is as
  // untouchable as its keeper. The shop opens from the rug before its
  // counter (merchNear, js/ui/shop.js). `sight`: px of fog its side sees
  // round it (sightSources, js/sim/fog.js). The SLED is the merchant's,
  // parked by the tent: one solid tile of scenery.
  stall:    { solid: true,  w: 4, h: 2, sight: 176, mm: (o) => mmTeam(o) },
  sled:     { solid: true },
  // a zipline's pylon (placeZips, js/sim/zipline.js): solid, inert to E,
  // carrying its `team`. Its pixels are PYLON_SPRS in the object pass
  // (js/draw/zipline.js); the cable itself is not an object at all - it
  // hangs between the pylons' points (zips) and is drawn by drawZips.
  pylon:    { solid: true,  mm: [150, 156, 170] },
  stump:    { solid: false, mm: [188, 200, 218] },
  // a roosting team eagle's hitbox tiles (placed by eagleRoost, js/sim/eagle.js):
  // solid to walkers and a work target for RIVAL E swings only - workTarget
  // reads the `team` an object carries. Drawn by drawEagle, never the object
  // pass; the swing itself lands in hitObject's eagle branch (hurtEagle).
  eagle:    { solid: true,  work: true, verb: 'STRIKE', lift: 16, auto: true,
              mm: (o) => skin(o.team) ? MM_EAGLE_BLUE : MM_EAGLE_RED, map: chEagle },
  // the orca cove's WATERFALL and its plunge pool (COVE_FALL, genWorld,
  // js/sim/field.js): open water down the back wall, solid to everything.
  // No pixels of its own in the object pass - drawCoveFall (js/draw/cove.js)
  // draws the whole curtain at once - and on the chart it is open water
  waterfall: { solid: true, mm: [74, 140, 196], map: CH_HOLE, sorted: false },
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
// the minimap's team inks: a roosting bird in
// the side's bright mark, its buildings a step deeper, so a base is a shape
// in its colour with the bird lit at the middle
const MM_EAGLE_RED = [224, 85, 72], MM_EAGLE_BLUE = [106, 168, 232];
const MM_TEAM_RED = [172, 68, 60], MM_TEAM_BLUE = [78, 128, 188];
const mmTeam = (o) => skin(o.team === undefined ? 0 : o.team) ? MM_TEAM_BLUE : MM_TEAM_RED; // STRUCTS' mm (structures.js)
const MM_PUMP = [150, 156, 172]; // a gold pump nobody holds
const mmPump = (o) => o.hold >= 0 ? (skin(o.hold) ? MM_TEAM_BLUE : MM_TEAM_RED) : MM_PUMP;

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

// `e`, when given, is who is walking (a hero's dash, a deer in mid-leap).
function isSolidTile(tx, ty, e) {
  if (!inWorld(tx, ty)) return true;
  if (e && e.dash && heroDashOver(e)) { const o = objects[idx(tx, ty)]; return !!(o && STRUCTS[o.type]); } // a hero's dash over it all but a building (HERO_DASH `over`)
  if (heroSolid(tx, ty, e)) return true; // a wall a hero's kit lays for a while (HERO_SOLID, js/sim/heroes.js)
  const o = objects[idx(tx, ty)];
  if (!o) return false;
  // Two tables, no list: any STRUCTS entry (tower/pump)
  // is solid for free, and everything else answers from its OBJECTS
  // entry - so neither a new building nor a new kind of scenery ever needs
  // this function touched.
  if (STRUCTS[o.type]) return true;
  const d = OBJECTS[o.type];
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
function placeObj(tx, ty, type, extra) {
  const o = Object.assign({ type, tx, ty, hp: 1, flash: 0, shake: 0 }, extra || {});
  return setTile(idx(tx, ty), o);
}
// a tile written during a match: the host's wire looks at it on its next flush
// (snapTouch, js/net/snapshot.js) instead of finding it on its slow sweep
function setTile(i, o) { objects[i] = o; snapTouch(i); return o; }

// a heal taken off the world, said the one way: the number in the heal green
// over the body and the heal's sound
function healFx(p, n) {
  if (n <= 0) return;
  addFloater(p.x, p.y - 14, '+' + Math.round(n), '#8fe08a');
  sfxAt('heal', p.x, p.y);
}
