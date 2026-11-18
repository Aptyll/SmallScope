'use strict';
// The camps: the neutral monsters' fixed, mirrored sites, stood up and
// stocked at boot, and the clock that fills them again.
// ------------------------------------------------------------ camps
// The jungle: named places at FIXED spots where neutral monsters stand - a
// camp minds its own business until somebody hits it, and then the whole
// camp comes for whoever did (updateCampMonster, wildlife.js). One entry in
// CAMPS is one kind of camp - what stands there, what lives there, what the
// kill is worth and the glyph the maps mark it with - and CAMP_SITES is
// where each one goes, in the field's own quarter (js/sim/field.js), folded
// to the other three like the field itself (campSites), so the layout is
// symmetric by construction and nothing rolls.
//
//   name        what the M map prints (the minimap shows the glyph alone)
//   r           footprint radius in tiles: how close you must be to be
//               "here" (campAt), and where the leash is measured from
//   mark/icon   map ink, and a glyph as rects in a 7x7 box (drawCampIcon)
//   kind/pop    the monster kind (ANIMAL_HP etc., wildlife.js) and how many
//   repop       seconds after the LAST one dies before the whole camp is
//               back - a camp is cleared or it is not; nothing trickles
//   first       match seconds before a camp is out the first time (the bear
//               and the orca: the timed objectives); none means it stands from the start
//   props       what stands in it: [dx, dy, type, extra] off the centre
//   spots       where each monster stands, [dx, dy] off the centre
//   farm        a jungler farms it (aiDenSpot, js/ai/ai-farm.js)
//   epic        the camp is an epic objective: its clock rides the top rail
//               (railEpic, js/ui/rail.js), and its first coming is public
//               (updateCampSight)
//   pool        the camp is the ORCA'S POOL: its pit is a frozen pond
//               (orcaLakeAt, js/sim/field.js), and what lives there is the
//               orca under the ice (js/sim/orca.js) until its camp monster,
//               the orca up in its hole, is out (`first`)
//
// scrap:    a stray robot pack (brass walkers), the jungle's farm - gold per head
//           (each robot a FARM, js/sim/farm.js), in the bottom half
// buff:     the black bear in its den below the bottom lane: first out at 5:00,
//           the whole team paid and given the BLACK BUFF for the kill, and the
//           side's black bears count up (state.bearStacks, wildlife.js)
// orca:     the orca's pool in its cove above the top lane, the epic camp
// meadow:   the WARREN: three rabbits in a round pool of deep snow (layMeadowDrifts,
//           depth.js), brush the rabbits never leave, and snowdrops that each
//           shield the picker's whole company and then rest on their own
//           cooldown (OBJECTS.snowdrop). The only rabbits on the map; one
//           warren each side, by its base mouth
const CAMPS = {
  // the stray robots' pack: three walkers (SPRITES.scrap, js/sprites/beasts.js)
  scrap: {
    name: 'SCRAP PILE',
    r: 4, mark: '#c9b48c',
    icon: [[2, 0, 3, 1], [1, 1, 5, 3], [0, 2, 1, 1], [6, 2, 1, 1], [1, 4, 1, 2], [5, 4, 1, 2], [2, 6, 3, 1]], // a robot's head
    kind: 'scrap', pop: 3, repop: 75, farm: true, // a jungler's round (aiDenSpot): about one lap of a side's camps on the clock
    restRing: true, // its leash ring lies faint on the snow while it sleeps too (drawCampLeashes, js/draw/marks.js)
    ground: 2, // its leash: 2 tiles past r, 6 from the middle, so the whole ring fits a player's screen (campGroundPad, wildlife.js)
    props: [],
    spots: [[-2, -1], [2, -1], [0, 1]],
  },
  buff: {
    name: 'BLACK BEAR DEN',
    r: 4, mark: '#c2a6ff',
    icon: [[3, 1, 1, 1], [2, 2, 3, 1], [1, 3, 5, 1], [2, 4, 3, 1], [3, 5, 1, 1]], // a cut stone
    kind: 'alpha', pop: 1, repop: 300, first: 300, // first out at 5:00, then 5:00 after each kill
    props: [],
    spots: [],
  },
  orca: {
    name: "ORCA'S POOL",
    r: 6, mark: '#7fd4ff', pool: true, // the pit's pond and a tile of shore
    icon: [[3, 0, 1, 1], [3, 1, 2, 1], [3, 2, 3, 1], [0, 3, 7, 1], [1, 4, 5, 1], [0, 5, 7, 1]], // a fin over the water
    epic: true, // its clock rides the top rail (railEpic, js/ui/rail.js)
    kind: 'orca', pop: 1, repop: 360, first: 360, // up at 6:00, then 6:00 after each kill; under the ice until then (js/sim/orca.js)
    props: [],
    spots: [],
  },
  meadow: {
    name: 'SNOWDROP WARREN',
    r: 4, mark: '#e8eef8',
    icon: [[1, 0, 1, 3], [4, 0, 1, 3], [1, 3, 4, 3], [0, 4, 1, 2], [5, 4, 1, 2], [2, 6, 2, 1]], // a rabbit's head
    kind: 'rabbit', pop: 3, repop: 40,
    props: [[-2, -3, 'snowdrop', 0], [2, -3, 'snowdrop', 1], [0, 3, 'snowdrop', 2]],
    spots: [[-2, 0], [2, 0], [0, 1]],
  },
};
// Where the camps are, as tiles in RED's top quarter of the field (tx, ty:
// the camp's middle tile). campSites() folds each to the other quarters like
// the field (fieldFour): `top` a camp whose bottom-half twin is `bot`'s kind
// (null: no camp there; the robots stand below, the top half's halls are
// open snow), and a site on the middle row or
// column is its own twin there. The orca and the bear are each one camp:
// the orca's pit above the top lane, the bear's den below the bottom one.
const CAMP_SITES = [
  { top: 'scrap', bot: 'scrap', tx: 28, ty: 54 },   // the hall's outer end, backed into the pocket in the grove wall
  { top: 'scrap', bot: 'scrap', tx: 69, ty: 51 },   // the hollow's, out on its pool: one up top, one below, both sides' to fight for
  { top: 'orca', bot: null, tx: 69, ty: 24 },       // the orca's cove above the top lane (COVE, js/sim/field.js): on the middle column, its own twin, and none below
];
function campSites() {
  const out = [];
  for (const c of CAMP_SITES) fieldFour(c.tx, c.ty).forEach(([x, y], k) => {
    const key = k >= 2 ? c.bot : c.top, tx = k % 2 ? x - 1 : x, ty = k >= 2 ? y - 1 : y; // a tile's twin is WORLD - 1 - it
    if (!key || (k % 2 && tx - c.tx <= 1) || (k >= 2 && ty - c.ty <= 1)) return; // on the middle column or row: its own twin
    out.push({ key, tx, ty, fx: k % 2 ? -1 : 1, fy: k >= 2 ? -1 : 1 }); // fx/fy: its props and spots mirrored with it
  });
  return out;
}

// where the maps stamp a camp's glyph, in tile coordinates: its site
function campMark(C) { return { tx: C.tx, ty: C.ty }; }
// whether tile coordinates (tx, ty) are within `pad` tiles of a camp's
// ground, its round footprint: the camp's own reach (campAt, the leash) asks this
function campNear(C, tx, ty, pad) {
  return Math.hypot(tx - C.tx, ty - C.ty) <= C.r + pad;
}

// stand every camp up at its site and stamp its props: boot, after genWorld.
// The field leaves every site open ground, so nothing is cleared
function placeCamps() {
  for (const site of campSites()) {
    const spec = CAMPS[site.key];
    const C = { key: site.key, spec, name: spec.name, tx: site.tx, ty: site.ty, fx: site.fx, fy: site.fy, r: spec.r, repopT: spec.repop, seen: [0, 0], look: [-1, -1] };
    camps.push(C);
    for (const [dx, dy, type, variant] of spec.props) {
      const extra = type === 'snowdrop' ? { variant, readyAt: 0 } : {};
      // a prop bigger than a tile (OBJECTS' w, h) fills the rest with parts, as a
      // building does: east of the anchor, and north of it, so the anchor stays
      // the footprint's front row - mirrored, its anchor is the far end
      const w = OBJECTS[type].w || 1, ax = C.tx + (C.fx > 0 ? dx : -dx - (w - 1)), ay = C.ty + dy * C.fy;
      const o = placeObj(ax, ay, type, extra);
      for (let j = 0; j < (OBJECTS[type].h || 1); j++) for (let k = 0; k < w; k++) {
        if (!j && !k) continue;
        const x = ax + k, y = ay - j;
        objects[idx(x, y)] = { type: 'part', tx: x, ty: y, of: o, flash: 0, shake: 0 };
      }
    }
  }
}

// one monster into its slot - the slot's own tile, or the nearest free one
function spawnCampMonster(C, i) {
  const spots = C.spec.spots;
  const [dx, dy] = !spots.length ? [0, 0] : spots[i % spots.length];
  let tx = C.tx + dx * C.fx, ty = C.ty + dy * C.fy;
  if (objAt(tx, ty)) {
    let found = null;
    for (let r = 1; r <= C.r && !found; r++) for (let oy = -r; oy <= r && !found; oy++) for (let ox = -r; ox <= r && !found; ox++) {
      if (Math.abs(ox) !== r && Math.abs(oy) !== r) continue;
      if (inWorld(tx + ox, ty + oy) && !objAt(tx + ox, ty + oy)) found = { tx: tx + ox, ty: ty + oy };
    }
    if (!found) return null;
    tx = found.tx; ty = found.ty;
  }
  const a = makeAnimal(C.spec.kind, (tx + 0.5) * TILE, (ty + 0.5) * TILE);
  if (isCampKind(C.spec.kind)) { a.home = C; a.spawnX = a.x; a.spawnY = a.y; } // the spot it runs back to when a hunt ends (campRunHome)
  else a.meadow = C; // prey stays prey: it keeps to its warren (preyWander) and is never a camp fight (ckAcquire)
  animals.push(a);
  return a;
}

// stock every camp, once the world (and the ordinary wildlife) is down -
// and by hand from DBG: it tops each camp up to strength, never past it
function stockCamps() {
  for (const C of camps) {
    // a timed camp is not out yet: its clock runs to its first appearance (updateCamps)
    if (C.spec.first && state.elapsed < C.spec.first) { C.repopT = C.spec.first - state.elapsed; continue; }
    for (let i = campPop(C); i < C.spec.pop; i++) spawnCampMonster(C, i);
  }
}

function campPop(C) {
  let n = 0;
  for (const a of animals) if (!a.dead && (a.home === C || a.meadow === C)) n++;
  return n;
}

// the camp a world position is standing in, if any
function campAt(x, y) {
  const tx = x / TILE - 0.5, ty = y / TILE - 0.5;
  for (const C of camps) if (campNear(C, tx, ty, 0)) return C;
  return null;
}

// The respawn clock, honest enough to be worn: a camp with anything alive in
// it holds the clock at the top - a camp is cleared or it is not, and a
// half-killed pack never trickles back; cleared, it counts down; and due, it
// holds at zero for as long as someone is standing in the site (CAMP_HOLD
// px), then the whole camp is back at once. A cleared camp wears its seconds
// over its ground and on both maps (drawCampClock, js/draw/marks.js), but
// only to a side that knows them (campLeft, below).
const CAMP_HOLD = 96;
function updateCamps(dt) {
  for (const C of camps) {
    if (campPop(C) > 0) { C.repopT = C.spec.repop; C.out = true; continue; }
    C.repopT = Math.max(0, C.repopT - dt);
    if (C.repopT > 0) continue;
    const px = (C.tx + 0.5) * TILE, py = (C.ty + 0.5) * TILE;
    if (players.some((p) => p.active && !p.dead && Math.hypot(p.x - px, p.y - py) < CAMP_HOLD)) continue;
    for (let i = 0; i < C.spec.pop; i++) spawnCampMonster(C, i);
    C.repopT = C.spec.repop;
  }
}

// whether a camp is cleared and counting: the clock is held at the top while
// anything in it lives (updateCamps), so this reads the clock alone and
// holds on a client too, which has no say over a body in the fog
function campCleared(C) { return C.spec.pop > 0 && C.repopT > 0 && (C.repopT < C.spec.repop || (C.spec.first > 0 && !C.out)); }
// What each side KNOWS of a camp's clock - League's rule: a side times a
// camp only from a clear it SAW, the camp in its sight as it fell (sight
// held from the tick before the clear on). Walking into an empty camp it did
// not see cleared tells it the camp is empty, never when it is back: the
// glyph greys with no number (campEmpty) until the longest it could still be
// out (its full repop) has run, or the side sees it again. Seeing the camp up
// forgets both. Out of sight a known clock keeps running down.
// `C.seen[team]`: > 0 the tick the side expects it back, < 0 minus the tick
// an empty-but-untimed camp is surely back by, 0 nothing known (up, or
// never looked). `C.look[team]`: the last tick the side saw the camp.
// Run after updateCamps, so the tick the last one dies is seen with the clock
// already started. The bots ask it (aiDenSpot), the draws ask it
// (drawCampClock, drawCampMark) and the wire sends each side only its own
// `seen` (snapFogCamps, js/net/snapshot.js)
function updateCampSight() {
  for (const C of camps) {
    if (!C.spec.pop) continue;
    if (!C.seen) C.seen = [0, 0];
    if (!C.look) C.look = [-1, -1];
    // a timed camp's first coming is the match clock's, so every side knows
    // it (`pub`); once it is out, that is forgotten like any sighting
    if (C.spec.first > 0 && !C.out) { const due = state.tick + Math.ceil(C.repopT / TICK_DT); C.seen[0] = C.seen[1] = due; C.pub = true; continue; }
    if (C.pub) { C.seen[0] = C.seen[1] = 0; C.pub = false; }
    const m = campMark(C), x = (m.tx + 0.5) * TILE, y = (m.ty + 0.5) * TILE;
    for (const team of [0, 1]) {
      if (!sightAt(team, x, y)) continue;
      const was = C.seen[team], watched = C.look[team] === state.tick - 1;
      C.look[team] = state.tick;
      if (!campCleared(C)) { C.seen[team] = 0; continue; }
      const due = state.tick + Math.ceil(C.repopT / TICK_DT);
      if (was > 0 || (watched && was === 0)) C.seen[team] = due; // timed: seen falling, or already timed
      else if (was === 0) C.seen[team] = -(state.tick + Math.ceil(C.spec.repop / TICK_DT)); // found empty
    }
  }
}
// seconds until camp C is back as `team` knows it (0: up, or not known);
// any other team (a screen watching from no side) reads the true clock
function campLeft(C, team) {
  if (team !== 0 && team !== 1) return campCleared(C) ? C.repopT : 0;
  const due = C.seen ? C.seen[team] : 0;
  return due > state.tick ? (due - state.tick) * TICK_DT : 0;
}
// whether `team` found camp C empty without seeing it cleared, so knows no time
function campEmpty(C, team) {
  const v = C.seen && (team === 0 || team === 1) ? C.seen[team] : 0;
  return v < 0 && -v > state.tick;
}
