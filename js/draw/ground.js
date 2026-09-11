'use strict';
// The ground's pixels: hash2/vnoise (the per-tile noise every draw file
// reads), the prerendered ground canvas and its runtime repaints, the road,
// and the scenery bakes that ride on it (the pine's wind frame, the chest,
// the cairn). First of the js/draw/ files: everything after it calls hash2.
// ------------------------------------------------------------ ground prerender
const groundCv = document.createElement('canvas');
groundCv.width = WORLD * TILE; groundCv.height = WORLD * TILE;

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263 + SEED) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0), b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1), d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// paints one tile into the pre-rendered ground canvas; used by the boot-time
// full render and by repaintGround() when a tile changes at runtime (ice holes)
function paintGroundTile(g, tx, ty) {
      const px = tx * TILE, py = ty * TILE;
      const gv = ground[idx(tx, ty)];
      const h = hash2(tx, ty);
      // soft tone variation sampled per 8px quad so no tile grid shows
      const quad = (g2, colA, colB) => {
        for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) {
          const gx = tx * 2 + qx, gy = ty * 2 + qy;
          const nz = vnoise(gx / 13, gy / 13);
          g2.fillStyle = nz > 0.5 ? colA : colB;
          g2.fillRect(px + qx * 8, py + qy * 8, 8, 8);
        }
      };
      if (gv === 2) {
        // pick-carved hole: dark open water, drifting glints, chipped ice rim
        quad(g, '#1e3a54', '#234159');
        g.fillStyle = '#2e5573';
        const n = 2 + ((h * 5) | 0) % 2;
        for (let i = 0; i < n; i++) {
          g.fillRect(px + ((h * (37 + i * 53)) | 0) % 12 + 1, py + ((h * (71 + i * 31)) | 0) % 12 + 2, 3, 1);
        }
        // broken-ice chips on every edge that still borders frozen ground
        g.fillStyle = '#d6ecf4';
        const chip = (x0, y0, sx, sy) => {
          for (let i = 0; i < TILE; i += 2) {
            if (hash2(tx * 31 + x0 + sx * i, ty * 37 + y0 + sy * i) > 0.4) {
              g.fillRect(px + x0 + sx * i, py + y0 + sy * i, sx ? 2 : 1, sy ? 2 : 1);
            }
          }
        };
        if (!inWorld(tx, ty - 1) || ground[idx(tx, ty - 1)] !== 2) chip(0, 0, 1, 0);
        if (!inWorld(tx, ty + 1) || ground[idx(tx, ty + 1)] !== 2) chip(0, TILE - 1, 1, 0);
        if (!inWorld(tx - 1, ty) || ground[idx(tx - 1, ty)] !== 2) chip(0, 0, 0, 1);
        if (!inWorld(tx + 1, ty) || ground[idx(tx + 1, ty)] !== 2) chip(TILE - 1, 0, 0, 1);
      } else if (gv === 1) {
        quad(g, '#b9dcec', '#c4e3f0');
        // cracks
        if (h > 0.55) {
          g.fillStyle = '#a3cbe0';
          const n = 2 + ((h * 7) | 0) % 3;
          let lx = px + 3 + ((h * 100) | 0) % 9, ly = py + 3 + ((h * 53) | 0) % 9;
          for (let i = 0; i < n; i++) {
            g.fillRect(lx, ly, 2, 1);
            lx += (((h * (13 + i * 7)) | 0) % 3) - 1 + 2;
            ly += (((h * (29 + i * 5)) | 0) % 3) - 1;
          }
        }
        if (h < 0.12) { g.fillStyle = '#ddf1f8'; g.fillRect(px + ((h * 210) | 0) % 12, py + ((h * 87) | 0) % 12, 2, 2); }
        // rim where ice meets snow
        g.fillStyle = '#d6ecf4';
        if (!inWorld(tx, ty - 1) || ground[idx(tx, ty - 1)] === 0) g.fillRect(px, py, TILE, 1);
        if (!inWorld(tx, ty + 1) || ground[idx(tx, ty + 1)] === 0) g.fillRect(px, py + TILE - 1, TILE, 1);
        if (!inWorld(tx - 1, ty) || ground[idx(tx - 1, ty)] === 0) g.fillRect(px, py, 1, TILE);
        if (!inWorld(tx + 1, ty) || ground[idx(tx + 1, ty)] === 0) g.fillRect(px + TILE - 1, py, 1, TILE);
      } else {
        quad(g, '#ebf2fa', '#e7eff8');
        // dither speckles
        const n = (h * 4) | 0;
        g.fillStyle = '#d5e2f0';
        for (let i = 0; i < n; i++) {
          g.fillRect(px + ((h * (31 + i * 47)) | 0) % 15, py + ((h * (17 + i * 73)) | 0) % 15, 1, 1);
        }
        // sparkles
        if (h > 0.93) {
          g.fillStyle = '#ffffff';
          g.fillRect(px + ((h * 211) | 0) % 14, py + ((h * 131) | 0) % 14, 1, 1);
        }
        // buried grass tufts
        if (h > 0.80 && h < 0.84) {
          g.fillStyle = '#9db8a6';
          const gx = px + ((h * 500) | 0) % 12 + 2, gy = py + ((h * 300) | 0) % 12 + 2;
          g.fillRect(gx, gy, 1, 2); g.fillRect(gx + 2, gy + 1, 1, 1); g.fillRect(gx - 1, gy + 1, 1, 1);
        }
        // tiny pebble
        if (h > 0.60 && h < 0.615) {
          g.fillStyle = '#b6c2d4';
          g.fillRect(px + ((h * 700) | 0) % 12 + 2, py + ((h * 900) | 0) % 12 + 2, 2, 1);
        }
        // the road (ground 3, and the snow beside it) is painted OVER the
        // snow per pixel, against its ragged edge - never per tile
        if (gv === 3 || roadDist(tx, ty) < ROAD_SHOULDER + 1.2) paintRoadOverlay(g, tx, ty, px, py);
      }
      // the felled trunk across a forest road (placeRoad, world.js) lies flat
      // on the ground, so it is ground: baked here over whatever the tile is.
      // A piece's band spills past its tile's corners into the four tiles
      // beside it (the trunk is wider than the diagonal it runs on), so a
      // tile paints its neighbours' pieces too, shifted, and its own last.
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]]) {
        const lo = objAt(tx + dx, ty + dy);
        if (lo && lo.type === 'log') paintLog(g, lo.seg, px, py, -dx * TILE, -dy * TILE);
      }
}

// ---- the road's pixels ----------------------------------------------------
// The road (placeRoad, world.js) is not a kind of tile but a BAND laid over
// the snow at pixel precision: every pixel of a tile near it asks roadDist
// for its distance to the ragged edge and is painted by that - inside, packed
// earth in two tones by 8 px quad, the two ruts (broken, wandering a little
// along the lane), the odd stone, a hoof-dark spot, and snow melting in over
// the last half tile of the verge; outside, ROAD_SHOULDER tiles of dirtied
// snow, mud dithered in at the edge and thinning to grey and then to the
// field. So the edge is one wandering line and never a tile staircase, and
// a 16 px tile can be half road and half snow. A ford is skipped whole: ice
// tiles never come here (paintGroundTile's ice branch), so the ruts stop at
// the bank. The per-u noise (the edge, the ruts' wander) is cached by
// quarter-tile, since a tile's 256 pixels share a handful of u values.
const ROAD_COL_A = '#cdbfa8', ROAD_COL_B = '#c5b7a0'; // the two tones of packed earth
const ROAD_COL_RUT = '#a08d70';                        // the ruts
const ROAD_COL_STONE = '#9c8d74', ROAD_COL_DARK = '#b5a68c', ROAD_COL_LIGHT = '#dbcfba';
const ROAD_COL_MUD = '#ded8cc', ROAD_COL_GREY = '#dde3ec'; // the shoulder's dirty snow, then grey snow
const ROAD_COL_SNOW = '#e7eff8';                       // snow melting in over the verge
// The felled trunk across each forest road's far end (placeRoad, world.js):
// one 16 px piece per tile along the cross-diagonal, running from the
// tile's top-left corner to its bottom-right so the pieces meet corner to
// corner in one line. `seg` 0 is the up-left end and 2 the down-right end,
// each stopping short to show its sawn face and rings; 1 is the trunk. A
// real trunk, eleven pixels across the diagonal: snow lies along its spine,
// bark shows down the lower side with the odd knot, a dark rim holds it
// against the packed earth like every other thing on the ground, and a soft
// shadow falls off its lower flank.
const LOG_COL = { rim: '#2a1c10', dark: '#4a3218', mid: '#6b4a2a', light: '#8a6142', face: '#c9a070', ring: '#7a5634', snow: '#f4f7ff', snowD: '#d8e4f2' };
// ox/oy shift the piece's own frame: 0 for the tile it stands on, +-TILE
// when a neighbour paints the part of it that spills over the tile edge
function paintLog(g, seg, px, py, ox, oy) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const lx = x + ox, ly = y + oy;
    const t = lx - ly, a = lx + ly; // across the trunk (0 on its spine, + toward the lower-right flank) and along it (0 at the piece's up-left corner)
    const inEnd = (seg === 0 && a < 4) || (seg === 2 && a > 26); // past the sawn end: nothing
    if (inEnd) continue;
    // the ends round off: the band narrows over the last three pixels
    const half = (seg === 0 && a < 7) ? 2 + (a - 4) : (seg === 2 && a > 23) ? 2 + (26 - a) : 5;
    const h = hash2(seg * 16 + lx, ly); // this pixel's own roll, the same every bake
    // the lower-side stubs of two lopped branches on the trunk piece
    const stub = seg === 1 && (Math.abs(a - 9) <= 1 || Math.abs(a - 21) <= 1) && t >= 6 && t <= 8 + (Math.abs(a - 9) <= 1 ? 1 : 0);
    if (stub) { g.fillStyle = t === 6 ? LOG_COL.mid : t === 7 ? LOG_COL.dark : LOG_COL.rim; g.fillRect(px + x, py + y, 1, 1); continue; }
    if ((t === 6 || t === 7) && Math.abs(t - 6) < half - 3) { // the shadow off the lower flank
      g.fillStyle = 'rgba(40,60,100,0.22)'; g.fillRect(px + x, py + y, 1, 1);
      continue;
    }
    if (t < -half || t > half) continue;
    let c;
    if ((seg === 0 && a <= 6) || (seg === 2 && a >= 24)) { // the sawn face, seen edge-on: pale wood under a dark rim
      c = Math.abs(t) === half ? LOG_COL.rim : Math.abs(t) <= 1 ? LOG_COL.ring : LOG_COL.face;
    } else if (Math.abs(t) === half) c = LOG_COL.rim;
    else if (t <= -1) { // the top: snow lying in patches, bark where it has slid off
      const snowy = vnoise(a / 5 + seg * 7, t + 3.3) > 0.42 - t * 0.06;
      c = snowy ? (h < 0.18 ? LOG_COL.snowD : LOG_COL.snow) : (t === -4 ? LOG_COL.light : LOG_COL.mid);
    } else if (t === 0) c = h < 0.5 ? LOG_COL.light : LOG_COL.snowD;
    else if (t <= 2) c = h < 0.08 ? LOG_COL.rim : h < 0.35 ? LOG_COL.dark : LOG_COL.mid; // bark grain, a knot now and then
    else c = h < 0.3 ? LOG_COL.mid : LOG_COL.dark;
    g.fillStyle = c; g.fillRect(px + x, py + y, 1, 1);
  }
}
const roadRutCache = new Map();
function roadRutAt(u) {
  const k = Math.round(u * 4);
  let r = roadRutCache.get(k);
  if (r === undefined) { r = ROAD_RUT + (vnoise(k / 4 * 0.45, 8.8) - 0.5) * 0.35; roadRutCache.set(k, r); }
  return r;
}
function paintRoadOverlay(g, tx, ty, px, py) {
  for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    const fx = tx + (i + 0.5) / TILE - 0.5, fy = ty + (j + 0.5) / TILE - 0.5;
    const d = roadDist(fx, fy);
    if (d >= ROAD_SHOULDER) continue;
    const hp = hash2(px + i, py + j); // this pixel's own roll
    // the drift field: snow lies on the verge and mud spreads off it in
    // CLUMPS, not as per-pixel static - a low-frequency noise read per pixel,
    // so the melt reads as patches of snow and mud rather than sand
    const clump = vnoise((px + i) / 6 + 3.1, (py + j) / 6 + 7.7);
    let c = null;
    if (d < 0) {
      c = vnoise(((px + i) >> 3) / 13, ((py + j) >> 3) / 13) > 0.5 ? ROAD_COL_A : ROAD_COL_B;
      const o = roadOff(fx, fy);
      if (Math.abs(o - roadRutAt(roadAlong(fx, fy))) < 0.08 && hp > 0.12) c = ROAD_COL_RUT; // a rut: ~2 px, broken
      else if (hp > 0.992) c = ROAD_COL_STONE;
      else if (hp > 0.975) c = ROAD_COL_DARK;
      else if (hp < 0.006) c = ROAD_COL_LIGHT;
      // the verge: drifts of snow lying over the earth, more of them toward the edge
      if (d > -0.7 && clump + hp * 0.25 > 1.02 - (d + 0.7) / 0.7 * 0.55) c = ROAD_COL_SNOW;
    } else {
      // the shoulder: mud spread off the road in patches, thinning to greyed snow, then the field
      const k = 1 - d / ROAD_SHOULDER;
      if (clump - hp * 0.2 < k * k * 0.55 - 0.05) c = d < 0.45 ? ROAD_COL_B : ROAD_COL_MUD;
      else if (clump < 0.45 + k * 0.3 && hp > 0.35) c = ROAD_COL_GREY;
    }
    if (c) { g.fillStyle = c; g.fillRect(px + i, py + j, 1, 1); }
  }
}

function renderGround() {
  const g = groundCv.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let ty = 0; ty < WORLD; ty++) {
    for (let tx = 0; tx < WORLD; tx++) paintGroundTile(g, tx, ty);
  }
}

// runtime ground change (hole opened / refrozen): repaint the tile plus its
// four neighbors so edge rims recompute
function repaintGround(tx, ty) {
  const g = groundCv.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (inWorld(tx + dx, ty + dy)) paintGroundTile(g, tx + dx, ty + dy);
  }
}

// ------------------------------------------------------------ the scenery bakes
// Which of a pine's twenty-four bend frames it is wearing - and which half of
// the atlas it takes it from. A tree does not animate on a clock of its own:
// the wind field (the `wind` banner, js/sim.js) is sampled at the tree's own
// tile, so a gust crossing the field lays one band of trees over at a time and
// the treeline works in order.
//
// The frames are a LADDER of leans, not a cycle of phases (js/sprites.js), so
// the map is direct: sway -1 is frame 0 thrown fully left, +1 is frame 23
// thrown fully right, and the middle of the ladder is a tree standing up. That
// is what makes a gust read as one body of moving air - every tree inside it
// leaning the same way, instead of each wandering off around a rest pose of
// its own - and it is why the index CLAMPS rather than wraps: at the end of
// its travel a crown stops, it does not snap back the other way.
//
// Every frame being the same tree, two things off the tile's hash keep a stand
// from reading as one stamp repeated. Half the forest is mirrored - the atlas
// holds the 24 frames again flipped, and a mirrored tree's ladder runs
// backwards, hence the reversed index - and each tree keeps a standing lean of
// up to TREE_REST frames, which is what it is still wearing after dark when
// windSway() returns 0.
const TREE_FRAMES = 24;
const TREE_REST = 2.5; // frames of standing lean a tile keeps through the calm
function treeFrame(tx, ty) {
  const h = hash2(tx * 3 + 1, ty * 3 + 2) * 2;
  const flip = h >= 1;                        // the mirrored half of the atlas
  const mid = (TREE_FRAMES - 1) / 2;
  const rest = TREE_REST * ((flip ? h - 1 : h) * 2 - 1);
  let i = Math.round(mid + rest + windSway(tx, ty) * mid);
  if (i < 0) i = 0; else if (i > TREE_FRAMES - 1) i = TREE_FRAMES - 1;
  return flip ? TREE_FRAMES * 2 - 1 - i : i;
}

// The treasure chest's sprite bakes HERE, from its own grid - js/sprites.js
// is byte-fragile (BOM, mangled-byte repair) and is never rewritten, so a
// new scenery sprite bakes beside its draw pass instead. Snow-capped lid,
// gold banding and lock: the same gold the payout floater speaks in.
const CHEST_SPR = (() => {
  const pal = { o: '#241a12', w: '#8a6142', W: '#a3794f', d: '#6b4a34', g: '#f2cc6a', G: '#c9a23f', s: '#eef4fb' };
  const rows = [
    '..oooooooooooo..',
    '.osssssssssssso.',
    '.oWwwwwwwwwwwWo.',
    '.oWwwwddwwwwwWo.',
    '.oggggggggggggo.',
    '.owwwwwGGwwwwwo.',
    '.owwwwwggwwwwwo.',
    '.owwdwwwwwwdwwo.',
    '.oddddddddddddo.',
    '..oooooooooooo..',
  ];
  const c = document.createElement('canvas');
  c.width = 16; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => {
    for (let x = 0; x < 16; x++) if (pal[r[x]]) { g.fillStyle = pal[r[x]]; g.fillRect(x, y, 1, 1); }
  });
  return c;
})();
// The road's centre cairn (placeRoad, world.js), baked here like the chest:
// a heap of river stones under snow, the one solid thing on the road, where
// the two waves meet.
const CAIRN_SPR = (() => {
  const pal = { o: '#2a2e3a', G: '#9aa2b2', g: '#737b8c', d: '#596072', s: '#f4f7ff', S: '#d8e4f2' };
  const rows = [
    '.....sssss....',
    '....oGGGGSo...',
    '...oGggggGdo..',
    '...oGgggggdo..',
    '..ossoooooosss',
    '..oGGGGGGGGgo.',
    '.oGggggGGgggdo',
    '.oGgggggggggdo',
    '.oggggGGGggddo',
    'oooooooooooooo',
    'oGGgggGGgggGdo',
    '.oooooooooooo.',
  ];
  const c = document.createElement('canvas');
  c.width = 14; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => {
    for (let x = 0; x < 14; x++) if (pal[r[x]]) { g.fillStyle = pal[r[x]]; g.fillRect(x, y, 1, 1); }
  });
  return c;
})();
// The practice dummy (the `practice arena` banner, js/world.js), baked here
// for the same reason the chest is. A big target you read across the arena:
// a burlap sack head with stitched eyes under a snow cap, arms lashed to a
// crossbar with rope, a sack torso wearing a painted red ring, straw leaking
// out of the cinch, and a post into crossed skids in the drift. 26x42 - a
// head taller than a player, drawn up off its one solid tile like a tree.
