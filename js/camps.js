'use strict';
// The camps: the neutral monsters' fixed, mirrored sites, stood up and
// stocked at boot, and the clock that fills them again.
// ------------------------------------------------------------ camps
// The jungle: named places at FIXED spots where neutral monsters stand - a
// camp minds its own business until somebody hits it, and then the whole
// camp comes for whoever did (updateCampMonster, wildlife.js). One entry in
// CAMPS is one kind of camp - what stands there, what lives there, what the
// kill is worth and the glyph the maps mark it with - and CAMP_SITES is
// where each one goes, in the road's own coordinates, so the layout is
// symmetric by construction: every site is written once for the RED half
// and mirrored for BLUE (campSites), and nothing rolls. Terrain still comes
// from the seed; a camp's footprint is cleared out of whatever grew there.
//
//   name/tag    what the maps and the arrival toast print
//   r           footprint radius in tiles: the clearing, the props, and how
//               close you must be to be "here" (campAt)
//   mark/icon   map ink, and a glyph as rects in a 7x7 box (drawCampIcon)
//   kind/pop    the monster kind (ANIMAL_HP etc., wildlife.js) and how many
//   repop       seconds after the LAST one dies before the whole camp is
//               back - a camp is cleared or it is not; nothing trickles
//   props       what stands in it: [dx, dy, type, extra] off the centre
//   spots       where each monster stands, [dx, dy] off the centre
//   plan        a camp DRAWN, not scattered (the treeline camps): rows of
//               characters from the back of the clearing (into the woods) to
//               its front (out in the field), centre at the middle of the
//               middle row, turned to face the field from whichever edge the
//               site is nearest (campFrame) - so the mirrored site gets the
//               mirrored drawing. It replaces clearCamp, props and spots:
//                 -  left as the seed grew it    .  cleared snow
//                 T  a pine, the clearing's wall f  a snowdrop clump
//                 r  a monster's spot
//   woods       the site is IN the border forest, not the open valley:
//               placeCamps checks it is, and layPaths cuts no branch to it
//   treeline    the site is ON the border forest's edge, in the band between
//               the shallowest and the deepest treeline any seed grows, and
//               the border is grown out round it (warrenGrove) so its
//               clearing is cut out of the pines on every seed; layPaths cuts
//               it a branch like any valley camp (no CAMP_EDGE, see placeCamps)
//   river       the camp is a stretch of RIVERBANK, not a den: no props and
//               no spots - its one monster walks `river` tiles of its own bank
//               either way along the creek's bend round the site, up and
//               down, and stops at the water to fish (riverPath; the walk,
//               updateCampMonster, wildlife.js)
//
// resource: the pack - gold per head, the biggest steady payout on the map
// buff:     the black bear - the brown bear's match, paid as it is (MONSTER's teamPay, wildlife.js);
//           it walks BLUE's bank of the downstream bend
// epic:     the brown bear - the whole team is paid and given the BROWN BUFF for the kill;
//           it walks RED's bank of the upstream bend
// hut:      no monster - three chests round a hut buried in the treeline,
//           worth the chopping it takes to reach
// meadow:   the WARREN, drawn by hand (its `plan`): a round clearing in a
//           ring of pines, open to the field at one mouth, three rabbits in
//           the middle, three snowdrops at the back that each shield the
//           picker's whole company and then rest on their own cooldown
//           (OBJECTS.snowdrop), and the whole clearing filled to the trees
//           with deep snow (layMeadowDrifts, depth.js) - the rabbits run on
//           the crust, a scout wades. The only rabbits on the map; one
//           warren each side, halfway out along the treeline
const CAMPS = {
  resource: {
    name: 'WOLF DEN', tag: 'THE PACK PAYS IN GOLD',
    r: 5, mark: '#d8c0c4',
    icon: [[2, 3, 3, 3], [1, 4, 5, 2], [0, 1, 1, 2], [2, 0, 1, 2], [4, 0, 1, 2], [6, 1, 1, 2]], // paw print
    kind: 'wolf', pop: 4, repop: 60,
    props: [[0, 0, 'den']],
    spots: [[-2, -1], [2, -1], [-2, 2], [2, 2]],
  },
  buff: {
    name: 'BLACK BEAR STONE', tag: 'THE BLACK BEAR FISHES HERE',
    r: 4, mark: '#c2a6ff', river: 9,
    icon: [[3, 1, 1, 1], [2, 2, 3, 1], [1, 3, 5, 1], [2, 4, 3, 1], [3, 5, 1, 1]], // a cut stone
    kind: 'alpha', pop: 1, repop: 300,
    props: [],
    spots: [],
  },
  epic: {
    name: 'BROWN BEAR DEN', tag: 'THE BROWN BEAR FISHES HERE',
    r: 6, mark: '#ffb04a', river: 9,
    icon: [[0, 0, 2, 2], [5, 0, 2, 2], [0, 1, 7, 2], [1, 3, 1, 1], [3, 3, 1, 1], [5, 3, 1, 1], [1, 4, 5, 1], [2, 5, 3, 1]], // a bear's head, the eyes left dark
    kind: 'dire', pop: 1, repop: 300,
    props: [],
    spots: [],
  },
  hut: {
    name: 'HOG HUT', tag: 'THE STOVE IS STILL WARM',
    r: 4, mark: '#c9925a', woods: true,
    icon: [[3, 0, 1, 1], [2, 1, 3, 1], [1, 2, 5, 1], [0, 3, 7, 1], [1, 4, 5, 1], [1, 5, 2, 2], [4, 5, 2, 2]], // a hut
    kind: null, pop: 0, repop: 0,
    props: [[0, 0, 'hut'], [-2, -1, 'chest'], [3, -1, 'chest'], [0, 2, 'chest']],
    spots: [],
  },
  meadow: {
    name: 'SNOWDROP WARREN', tag: 'A SNOWDROP SHIELDS YOUR SIDE',
    r: 6, mark: '#e8eef8', treeline: true,
    icon: [[1, 0, 1, 3], [4, 0, 1, 3], [1, 3, 4, 3], [0, 4, 1, 2], [5, 4, 1, 2], [2, 6, 2, 1]], // a rabbit's head
    kind: 'rabbit', pop: 3, repop: 40,
    props: [],
    spots: [],
    // the back row is the woods, the front the open field: a round clearing
    // in a ring of pines with one mouth out to the field, three snowdrops at
    // the back, the rabbits' spots in the middle, and the clearing filled to
    // the trees with deep snow (MEADOW_POOL)
    plan: [
      '------TTTTTTTTT------',
      '----TTTTTTTTTTTTT----',
      '---TTTTT.....TTTTT---',
      '---TTT....f....TTT---',
      '--TTT..f.....f..TTT--',
      '--TTT...........TTT--',
      '-TTT.............TTT-',
      '-TTT.............TTT-',
      '-TTT.............TTT-',
      '-TTT....r...r....TTT-',
      '-TTT.............TTT-',
      '--TTT.....r.....TTT--',
      '--TTT...........TTT--',
      '---TTT.........TTT---',
      '---TTTTT.....TTTTT---',
      '----TTTT.....TTTT----',
      '------TT.....TT------',
    ],
  },
};
// Where the camps are, for the RED half of the map (u < WORLD / 2), in the
// road's coordinates (roadAlong / roadOffS): `u` tiles along the diagonal
// from RED's corner, `s` tiles off the centreline, + toward the bottom-right
// half. campSites() mirrors each across the map's middle (u -> WORLD-1-u,
// same s) for BLUE, so both teams walk the same distance to the same camp -
// and a site ON the middle (u = (WORLD-1)/2) is its own mirror and placed
// once: the epic is contested at equal reach from either roost. Every site
// sits at least CAMP_EDGE tiles from the world's edge, past the deepest
// treeline the border noise grows (BORDER_MAX, 70), and clear of the road by
// more than the pack's ground. A `woods` camp is the exception, and the
// other way round: its whole clearing (r + 2) must sit inside BORDER_MIN,
// the shallowest treeline any seed grows, so it is buried in pines on every
// seed and reached with an axe.
const CAMP_EDGE = 72;
const CAMP_SITES = [
  { key: 'resource', u: 90, s: -25 },  // one den each side of the road, out from the lane mouth
  { key: 'resource', u: 90, s: 25 },
  // THREE CAMPS A SIDE OF THE ROAD, six in all: a mirrored pair of dens on
  // each side, and one contested camp on the mirror line to finish each side
  // - the brown bear top-left, the black bear bottom-right, facing it across the road
  { key: 'buff', u: (WORLD - 1) / 2, s: 44 },  // the black bear, bottom-right of the middle, on the mirror line
  { key: 'epic', u: (WORLD - 1) / 2, s: -40 }, // the brown bear, top-left of the middle, on the mirror line
  // the hog huts, 20 tiles in from the world's edge, deep in the border woods
  { key: 'hut', u: 100.5, s: -114 },   // by the top-left corner, on the left edge
  { key: 'hut', u: 100.5, s: 114 },    // by the bottom-right corner, on the bottom edge
  { key: 'hut', u: 63, s: -61 },       // halfway up the left edge
  // the warrens, halfway out from each roost along the left-hand treeline
  { key: 'meadow', u: 91.5, s: -56 },
];
function campTile(u, s) {
  return { tx: Math.round(u + s / Math.SQRT2), ty: Math.round(WORLD - 1 - u + s / Math.SQRT2) };
}
function campSites() {
  const out = [];
  for (const c of CAMP_SITES) {
    out.push({ key: c.key, u: c.u, s: c.s });
    if (Math.abs(c.u - (WORLD - 1) / 2) > 0.01) out.push({ key: c.key, u: WORLD - 1 - c.u, s: c.s });
  }
  return out;
}

// A river camp's stretch (CAMPS' `river`): one point a tile along the creek,
// on the camp's own side of the water (the bend swings the water away from
// the site, creekBends), RIVER_BANK tiles of dry snow back from the bank, and
// beside each the water's edge it fishes at (wx, wy). Pure position: the
// creek's line, never the rng.
const RIVER_BANK = 0.6; // tiles between the bear's line and the water's nominal bank
const RIVER_REACH = 0.35; // tiles into the water from its bank that the scoop lands (wx, wy)
const RIVER_BAND = 2;   // tiles either side of the line that are the camp's ground (campNear)
function riverPath(C) {
  const B = creekBends().find((b) => b.tx === C.tx && b.ty === C.ty), out = [];
  if (!B) return out;
  // (w along, p across) back to tile coordinates (creekP, roadOffS)
  const at = (w, p) => ({ tx: ((w + p) * Math.SQRT2 + WORLD - 1) / 2, ty: ((w - p) * Math.SQRT2 + WORLD - 1) / 2 });
  for (let k = -C.spec.river; k <= C.spec.river; k++) {
    const w = B.w + k, m = creekMid(w);
    const bank = at(w, m - B.side * (CREEK_HW + CREEK_HW_RAG + RIVER_BANK)), edge = at(w, m - B.side * (CREEK_HW - RIVER_REACH));
    out.push({ tx: bank.tx, ty: bank.ty, x: (bank.tx + 0.5) * TILE, y: (bank.ty + 0.5) * TILE, wx: (edge.tx + 0.5) * TILE, wy: (edge.ty + 0.5) * TILE });
  }
  return out;
}
// where the maps stamp a camp's glyph, in tile coordinates: its site, or the
// middle of a river camp's stretch of bank
function campMark(C) {
  const q = C.path && C.path[C.path.length >> 1];
  return q ? { tx: q.tx, ty: q.ty } : { tx: C.tx, ty: C.ty };
}
// whether tile coordinates (tx, ty) are within `pad` tiles of a camp's
// ground: its round clearing, a river camp's stretch of bank too, and a
// drawn camp's whole drawing (CAMPS' `plan`, turned to its site). Every
// keep-out and the camp's own reach (campAt, the leash) ask this, so the
// bank counts wherever the clearing does, and nothing a later pass stands
// up (a rock, a landmark, a drift) lands inside a drawing.
function campNear(C, tx, ty, pad) {
  const P = C.spec.plan;
  if (P) {
    const F = campFrame(C), dx = tx - C.tx, dy = ty - C.ty, a = dx * F.ax + dy * F.ay, o = dx * F.ox + dy * F.oy;
    const back = P.length >> 1, mid = P[0].length >> 1;
    return Math.abs(a) <= mid + pad && o >= -back - pad && o <= P.length - 1 - back + pad;
  }
  if (Math.hypot(tx - C.tx, ty - C.ty) <= C.r + pad) return true;
  if (C.path) for (const q of C.path) if (Math.hypot(tx - q.tx, ty - q.ty) <= RIVER_BAND + pad) return true;
  return false;
}

// A treeline camp's own axes, in tile steps: `o` OUT from the edge its site is
// nearest into the field, `a` ALONG that edge - always `o` with its x and y
// swapped, so the two mirrored warrens (whose sites swap tx and ty) get axes
// that swap too, and anything laid out in (a, o) comes out each other's
// mirror image. `hand` is -1 where the pair is a mirror of (x, y): a curved
// shape laid in this frame bends the other way there (layMeadowDrifts).
function campFrame(C) {
  const es = [C.tx, C.ty, WORLD - 1 - C.tx, WORLD - 1 - C.ty], side = es.indexOf(Math.min(...es));
  const o = [[1, 0], [0, 1], [-1, 0], [0, -1]][side], a = [o[1], o[0]];
  return { ax: a[0], ay: a[1], ox: o[0], oy: o[1], hand: a[0] * o[1] - a[1] * o[0] };
}
// (a, o) in a camp's frame to tile coordinates
function campLocal(C, F, a, o) { return { tx: C.tx + F.ax * a + F.ox * o, ty: C.ty + F.ay * a + F.oy * o }; }
// A drawn camp (CAMPS' `plan`) onto the ground: every character is one
// tile, so the clearing, its wall of pines, its props and its monsters'
// spots are the drawing on every seed. Pines plant the way the border's do,
// variant off the tile's hash so they roll nothing.
function layCampPlan(C) {
  const P = C.spec.plan, F = campFrame(C), back = P.length >> 1, mid = P[0].length >> 1;
  C.spots = [];
  let k = 0;
  P.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c], t = campLocal(C, F, c - mid, r - back);
      if (ch === '-' || !inWorld(t.tx, t.ty)) continue;
      const i = idx(t.tx, t.ty);
      if (ground[i] === 1) ground[i] = 0;
      objects[i] = null;
      if (ch === 'T') placeObj(t.tx, t.ty, 'tree', { hp: TREE_HP, variant: hash2(t.tx * 3 + 1, t.ty * 3 + 2) > 0.5 ? 1 : 0, rare: treeRare(t.tx, t.ty) });
      else if (ch === 'f') placeObj(t.tx, t.ty, 'snowdrop', { variant: k++ % 4, readyAt: 0 });
      else if (ch === 'r') C.spots.push([t.tx - C.tx, t.ty - C.ty]);
    }
  });
}

// the ground a camp stands on: everything inside r + 2 of the centre is
// cleared - a pine, a rock, a bush goes, ice becomes snow - so a camp is the
// same clearing on every seed, and what the props then stamp is the same too
function clearCamp(C) {
  const R = C.r + 2;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy > R * R) continue;
    const x = C.tx + dx, y = C.ty + dy;
    if (!inWorld(x, y)) continue;
    const i = idx(x, y);
    objects[i] = null;               // only worldgen's scenery stands here yet
    if (ground[i] === 1) ground[i] = 0;
  }
}

// worldgen's last pass: stand every camp up at its site and stamp its props
function placeCamps() {
  for (const site of campSites()) {
    const spec = CAMPS[site.key];
    const t = campTile(site.u, site.s);
    const edge = Math.min(t.tx, t.ty, WORLD - 1 - t.tx, WORLD - 1 - t.ty);
    const bad = spec.woods ? edge + spec.r + 2 > BORDER_MIN || edge < spec.r + 4
      : spec.treeline ? edge - spec.r - 2 < BORDER_MIN || edge > CAMP_EDGE : edge < CAMP_EDGE;
    if (bad) throw new Error('camp ' + site.key + (spec.woods ? ' not in the woods' : spec.treeline ? ' not on the treeline' : ' too near the edge'));
    const C = { key: site.key, spec, name: spec.name, tag: spec.tag, tx: t.tx, ty: t.ty, r: spec.r, repopT: spec.repop };
    camps.push(C);
    if (spec.plan) layCampPlan(C);
    else clearCamp(C);
    if (spec.river) { // the bank it walks: nothing standing on the line or a tile either side of it
      C.path = riverPath(C);
      for (const q of C.path) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = Math.round(q.tx) + dx, y = Math.round(q.ty) + dy;
        if (inWorld(x, y) && objects[idx(x, y)] && ground[idx(x, y)] !== 4) objects[idx(x, y)] = null;
      }
    }
    for (const [dx, dy, type, variant] of spec.props) {
      const extra = type === 'deadTree' ? { hp: 3, variant } : type === 'chest' ? { hp: 1 } : type === 'snowdrop' ? { variant, readyAt: 0 } : {};
      if (dx === 0 && dy === 0) extra.site = C; // the anchor knows its camp: a hover reads the clock off it (drawCampClock)
      const o = placeObj(C.tx + dx, C.ty + dy, type, extra);
      // a prop bigger than a tile (OBJECTS' w, h) fills the rest with parts, as a
      // building does: east of the anchor, and north of it, so the anchor stays
      // the footprint's front row
      for (let j = 0; j < (OBJECTS[type].h || 1); j++) for (let k = 0; k < (OBJECTS[type].w || 1); k++) {
        if (!j && !k) continue;
        const x = C.tx + dx + k, y = C.ty + dy - j;
        objects[idx(x, y)] = { type: 'part', tx: x, ty: y, of: o, flash: 0, shake: 0 };
      }
    }
  }
}

// one monster into its slot - the slot's own tile, or the nearest free one
function spawnCampMonster(C, i) {
  // a river camp's monster comes back in the middle of its stretch
  const q = C.path && C.path[C.path.length >> 1];
  const spots = C.spots || C.spec.spots; // a drawn camp's spots are its plan's, turned to the site (layCampPlan)
  const [dx, dy] = q || !spots.length ? [0, 0] : spots[i % spots.length]; // a save from before the river keeps no path: the old site
  let tx = q ? Math.round(q.tx) : C.tx + dx, ty = q ? Math.round(q.ty) : C.ty + dy;
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
  if (isCampKind(C.spec.kind)) a.home = C;
  else a.meadow = C; // prey stays prey: it keeps to its warren (preyWander) and is never a camp fight (ckAcquire)
  animals.push(a);
  return a;
}

// stock every camp, once the world (and the ordinary wildlife) is down -
// and by hand from DBG: it tops each camp up to strength, never past it
function stockCamps() {
  for (const C of camps) for (let i = campPop(C); i < C.spec.pop; i++) spawnCampMonster(C, i);
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
// px), then the whole camp is back at once. The anchor prop wears the count
// under the pointer (drawCampClock, draw-world.js).
const CAMP_HOLD = 96;
function updateCamps(dt) {
  for (const C of camps) {
    if (campPop(C) > 0) { C.repopT = C.spec.repop; continue; }
    C.repopT = Math.max(0, C.repopT - dt);
    if (C.repopT > 0) continue;
    const px = (C.tx + 0.5) * TILE, py = (C.ty + 0.5) * TILE;
    if (players.some((p) => p.active && !p.dead && !inAir(p) && Math.hypot(p.x - px, p.y - py) < CAMP_HOLD)) continue;
    for (let i = 0; i < C.spec.pop; i++) spawnCampMonster(C, i);
    C.repopT = C.spec.repop;
  }
}
