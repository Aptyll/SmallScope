'use strict';
// The ground's pixels: hash2/vnoise (the per-tile noise every draw file
// reads), the prerendered ground canvas and its runtime repaints, the road,
// the lakes' shores, the cast shadows (baked for the scenery, drawn per
// frame for bodies), and the scenery bakes that ride on it (the pine's wind
// frame, the chest, the cairn). First of the js/draw/ files: everything
// after it calls hash2.
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
        // per pixel, against the lake's own ragged edge (the `ice shore`
        // banner below): the tone, the depth, the bank and any snow the
        // edge leaves on this tile
        const inner = paintIceTile(g, tx, ty, px, py);
        // cracks - only well inside the ice, so none lands on the bank
        if (inner && h > 0.55) {
          g.fillStyle = '#a3cbe0';
          const n = 2 + ((h * 7) | 0) % 3;
          let lx = px + 3 + ((h * 100) | 0) % 9, ly = py + 3 + ((h * 53) | 0) % 9;
          for (let i = 0; i < n; i++) {
            g.fillRect(lx, ly, 2, 1);
            lx += (((h * (13 + i * 7)) | 0) % 3) - 1 + 2;
            ly += (((h * (29 + i * 5)) | 0) % 3) - 1;
          }
        }
        if (inner && h < 0.12) { g.fillStyle = '#ddf1f8'; g.fillRect(px + ((h * 210) | 0) % 12, py + ((h * 87) | 0) % 12, 2, 2); }
        // ...and, where a PATH crosses the lake (the paths, js/world.js), the
        // earth spilling over this tile's share of the crossing, rimmed along
        // its own ragged edge rather than along the tile's sides. The diagonal
        // road never meets ice on any shape (ROAD_ICE_KEEP); a path does.
        if (roadDist(tx, ty) < ROAD_SHOULDER + 1.2) paintRoadOverlay(g, tx, ty, px, py, true);
      } else {
        // the drifts, every pixel (the `snow's pixels` banner below)
        paintSnowTile(g, px, py);
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
        // a lake's edge reaching over onto this snow, and the lip of its bank
        paintSnowShore(g, tx, ty, px, py);
        // the road (ground 3, and the snow beside it) is painted OVER the
        // snow per pixel, against its ragged edge - never per tile
        if (gv === 3 || roadDist(tx, ty) < ROAD_SHOULDER + 1.2) paintRoadOverlay(g, tx, ty, px, py, false);
      }
      // the creek (ground 4, its fords 5, its deck 3) is painted OVER whatever
      // the tile is, per pixel against its wandering banks, like the road
      if (creekNear(tx, ty)) paintCreek(g, tx, ty, px, py);
      // the felled trunk across a forest road (placeRoad, world.js) lies flat
      // on the ground, so it is ground: baked here over whatever the tile is.
      // A piece's band spills past its tile's corners into the four tiles
      // beside it (the trunk is wider than the diagonal it runs on), so a
      // tile paints its neighbours' pieces too, shifted, and its own last.
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]]) {
        const lo = objAt(tx + dx, ty + dy);
        if (lo && lo.type === 'log') paintLog(g, lo.seg, px, py, -dx * TILE, -dy * TILE);
      }
      // last, over everything lying on the ground: the shade the scenery
      // standing around this tile throws across it (the `cast shadows` banner)
      paintCastShade(g, tx, ty, px, py);
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
// a 16 px tile can be half road and half snow. On an ICE tile - which only
// a PATH ever crosses, never the diagonal - `onIce` paints the earth and its
// snowy verge the same way but leaves the water alone outside it, under a
// pale rim a pixel or two wide that follows the same ragged edge: a lake has
// a shoreline, not a muddy shoulder. The per-u noise (the edge, the ruts'
// wander) is cached by quarter-tile, since a tile's 256 pixels share a
// handful of u values.
const ROAD_COL_A = '#cdbfa8', ROAD_COL_B = '#c5b7a0'; // the two tones of packed earth
const ROAD_COL_RUT = '#a08d70';                        // the ruts
const ROAD_COL_STONE = '#9c8d74', ROAD_COL_DARK = '#b5a68c', ROAD_COL_LIGHT = '#dbcfba';
const ROAD_COL_MUD = '#ded8cc', ROAD_COL_GREY = '#dde3ec'; // the shoulder's dirty snow, then grey snow
const ROAD_COL_RIM = '#d6ecf4';                        // the broken-ice rim where a path crosses a frozen lake
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
function paintRoadOverlay(g, tx, ty, px, py, onIce) {
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
    } else if (onIce) {
      // the bank: broken ice along the crossing's own edge, and open water past it
      if (d < 0.09) c = ROAD_COL_RIM;
    } else {
      // the shoulder: mud spread off the road in patches, thinning to greyed snow, then the field
      const k = 1 - d / ROAD_SHOULDER;
      if (clump - hp * 0.2 < k * k * 0.55 - 0.05) c = d < 0.45 ? ROAD_COL_B : ROAD_COL_MUD;
      else if (clump < 0.45 + k * 0.3 && hp > 0.35) c = ROAD_COL_GREY;
    }
    if (c) { g.fillStyle = c; g.fillRect(px + i, py + j, 1, 1); }
  }
}

// ---- the creek's pixels ----------------------------------------------------
// The creek (the `the creek` group, js/world.js) is look A of
// docs/media/concepts/creek-concepts-1.png, SNOWBANK CUT: dark open water
// sunk between snow banks, deepening toward its middle. The sun's shade
// falls down-right (SUN_DX/SUN_DY, the cast shadows), so the bank the light
// comes over wears a white lip and throws a band of shade across the water
// under it, and the far bank shows its pale face - which bank that is comes
// off the slope of creekAt, so the ring round an island reads the same as
// the straight run. Faint streaks drift along the current (the bake's are
// still; drawCreekFlow moves more over them every frame). A FORD tile
// (ground 5) is a snow-capped boulder in the current, foam heaped on its
// upstream side. The BRIDGE is look A of bridge-concepts-1.png, PLANK DECK:
// planks laid across the way on the two diagonals, a stringer down each open
// side, snow drifted onto the edges and trodden off the middle, a post at
// each corner and three pilings in the water upstream; the creek comes out
// from under it in shade. Every pixel is a function of its position alone,
// so any repaint lays back exactly what the bake laid.
const CREEK_COL = {
  deep: '#2c5068', mid: '#335a73', shal: '#3f6c84', shade: '#24435a', under: '#1d3649',
  glint: '#5d8aa2', glint2: '#88b3c6', lip: '#ffffff', face: '#dbe8f3', faceD: '#c3d5e6', foam: '#dcecf5',
};
const STONE_COL = { rim: '#3a3f4f', dark: '#6b7486', mid: '#8a93a4', lit: '#a9b2c1', snow: '#eef4fb', snowL: '#ffffff', wet: '#1f3a4e', foam: '#dcecf5' };
const DECK_COL = {
  gap: '#3b2716', a: '#8a6142', b: '#7c5639', c: '#95704f', dark: '#5a3d24', rim: '#2a1c10',
  snow: '#eef4fb', snowD: '#d3dfec', beam: '#6b4a2a', beamL: '#8f6a48', post: '#4a3218', postL: '#8a6142', cap: '#f4f7ff',
};
const CREEK_SUN_X = 0.88, CREEK_SUN_Y = 0.48; // the way the light runs (SUN_DX/SUN_DY, normalised): a bank facing against it is the lit lip
const DECK_LK = BRIDGE_L * TILE * Math.SQRT2, DECK_WM = BRIDGE_W * TILE * Math.SQRT2; // the deck's half-sizes on the pixel diagonals
const DECK_C = ((WORLD - 1) / 2 + 0.5) * TILE;  // world px of the crossing
// does this tile hold any of the creek's pixels (water, bank, deck, post)?
function creekNear(tx, ty) {
  if (PRACTICE) return false;
  return creekAt(tx, ty) < 1.25 || (Math.abs(creekP(tx, ty)) < BRIDGE_L + 1.2 && Math.abs(roadOffS(tx, ty)) < BRIDGE_W + 1.6);
}
// a post (s = 2, 5x5, on the deck's corners) or a piling (s = 1, in the
// water): an upright stub seen from above, its top capped with snow
function deckPost(ax, ay, s, water) {
  const m = Math.max(Math.abs(ax), Math.abs(ay));
  if (m > s) return water && m === s + 1 && ax + ay <= 0 ? CREEK_COL.foam : null; // the current heaps against its upstream face
  if (m === s) return DECK_COL.rim;
  return ay < 0 && ax < s - 1 ? DECK_COL.cap : ax + ay < 0 ? DECK_COL.postL : DECK_COL.post;
}
function paintCreek(g, tx, ty, px, py) {
  const deck = Math.abs(creekP(tx, ty)) < BRIDGE_L + 1.2 && Math.abs(roadOffS(tx, ty)) < BRIDGE_W + 1.6;
  const posts = [];
  if (deck) {
    for (const sk of [-1, 1]) for (const sm of [-1, 1]) posts.push([sk * (DECK_LK - 1), sm * (DECK_WM - 1), 2]);
    for (const k of [-20, 0, 20]) posts.push([k, -DECK_WM - 7, 1]);
  }
  for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    const x = px + i, y = py + j;
    const fx = tx + (i + 0.5) / TILE - 0.5, fy = ty + (j + 0.5) / TILE - 0.5;
    const hp = hash2(x * 7 + 13, y * 11 + 5), dith = BAYER4[(y & 3) * 4 + (x & 3)] + 0.5;
    let c = null;
    // the deck's own lattice: k across the creek (along the road), m along it
    const k = x - y, m = x + y + 1 - 2 * DECK_C;
    if (deck) {
      for (const [pk, pm, s] of posts) {
        const ax = x - Math.round(DECK_C + (pk + pm - 1) / 2), ay = y - Math.round(DECK_C + (pm - 1 - pk) / 2);
        if (Math.abs(ax) <= s + 1 && Math.abs(ay) <= s + 1) { c = deckPost(ax, ay, s, s === 1); if (c) break; }
      }
      if (!c && Math.abs(k) <= DECK_LK && Math.abs(m) <= DECK_WM) {
        const em = DECK_WM - Math.abs(m), ek = DECK_LK - Math.abs(k);
        if (em < 2 || ek < 2) c = DECK_COL.rim;
        else if (em < 8) c = em >= 6 ? DECK_COL.dark : m < 0 ? DECK_COL.beamL : DECK_COL.beam; // the stringer down each open side
        else {
          const r = (k + 1000) % 6, tone = hash2(Math.floor((k + 1000) / 6), 17);
          c = r === 0 ? DECK_COL.gap : tone < 0.33 ? DECK_COL.a : tone < 0.66 ? DECK_COL.b : DECK_COL.c;
          if (r !== 0 && hp > 0.985) c = DECK_COL.dark; // a nail, a knot
          const drift = vnoise(x / 4 + 1.3, y / 4 + 2.1) * 0.5 + (Math.abs(m) / DECK_WM) * 0.75;
          if (drift > 0.93) c = drift > 0.99 ? DECK_COL.snow : DECK_COL.snowD;
          else if (r === 0 && Math.abs(m) > DECK_WM * 0.55 && hp > 0.4) c = DECK_COL.snowD;
        }
      }
      if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); continue; }
    }
    const d = creekAt(fx, fy);
    if (d > 0.3) continue;
    const e = -d * TILE, a = CQ.a, n = CQ.n; // px into the water; where along and across it
    // which bank: the slope of the distance points out of the water, and a
    // bank facing back against the light is the lit lip
    let lip = false;
    if (e < 6) {
      const gx = creekAt(fx + 0.04, fy) - creekAt(fx - 0.04, fy), gy = creekAt(fx, fy + 0.04) - creekAt(fx, fy - 0.04);
      lip = gx * CREEK_SUN_X + gy * CREEK_SUN_Y < 0;
    }
    if (e > 0) {
      const depth = Math.min(1, e / 7);
      c = depth > 0.75 + (dith - 0.5) * 0.3 ? CREEK_COL.deep : depth > 0.3 ? CREEK_COL.mid : CREEK_COL.shal;
      if (lip && e < 3 + vnoise(a * TILE / 6, 2) * 2) c = CREEK_COL.shade;
      const fl = vnoise(a * TILE / 11 + 5, n * TILE / 1.6 + 9); // a noise stretched along the current: its peaks are the streaks
      if (e > 2.5 && fl > 0.8 && hp > 0.15) c = fl > 0.9 ? CREEK_COL.glint2 : CREEK_COL.glint;
      if (deck && Math.abs(k) <= DECK_LK) {
        if (m > DECK_WM && m < DECK_WM + (5 + vnoise(k / 6, 7) * 3) * Math.SQRT2) c = CREEK_COL.under; // coming out from under the deck
        else if (m < -DECK_WM && m > -DECK_WM - 3 && hp > 0.3) c = CREEK_COL.foam;            // ...and heaped against it going in
      }
    } else if (e > -2.2) c = lip ? CREEK_COL.lip : (e > -1 ? CREEK_COL.faceD : CREEK_COL.face);
    else if (!lip && e > -4 && dith > 0.5) c = CREEK_COL.face;
    if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  }
  if (ground[idx(tx, ty)] === 5) paintFordStone(g, tx, ty, px, py);
}
// one stepping stone, a rough disc lit from the top-left with snow on its
// crown, a dark wet ring low-right and foam heaped on its upstream side
function paintFordStone(g, tx, ty, px, py) {
  const h = hash2(tx * 3 + 71, ty * 5 + 29);
  const cx = px + 8 + Math.round((h - 0.5) * 2), cy = py + 8 + Math.round((hash2(tx + 13, ty + 91) - 0.5) * 2);
  const r = 4.4 + h * 0.9;
  const f = creekFlow(tx, ty), fdx = f.fdx, fdy = f.fdy;
  for (let y = py; y < py + TILE; y++) for (let x = px; x < px + TILE; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dl = Math.hypot(dx, dy) || 1;
    const wob = (vnoise((Math.atan2(dy, dx) + 4) * 1.6 + cx, cy) - 0.5) * 1.6;
    const d = dl - (r + wob);
    const hp = hash2(x * 7 + 13, y * 11 + 5);
    let c = null;
    if (d > 0 && d < 3.2) {
      const up = -(dx * fdx + dy * fdy) / dl;
      if (d < 1.3 + Math.max(0, up) * 1.8 && hp > 0.25) c = STONE_COL.foam;
      if (d < 2.2 && dx + dy > r * 0.6) c = STONE_COL.wet;
    }
    if (d <= 0) {
      const lx = dx / r, ly = dy / r, lit = -(lx * 0.7 + ly * 0.7);
      if (d > -1) c = STONE_COL.rim;
      else if (ly < -0.05 + (vnoise(x / 3, y / 3) - 0.5) * 0.6 && lx + ly < 0.5) c = ly < -0.55 ? STONE_COL.snowL : STONE_COL.snow;
      else c = lit > 0.35 ? STONE_COL.lit : lit > -0.25 ? STONE_COL.mid : STONE_COL.dark;
    }
    if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  }
}
// The current, moving: over the still streaks the bake laid, a couple of
// glints per tile of open creek drift downstream along creekFlow and fade,
// every frame, for the tiles in view, on the sim's clock (windT). World pass,
// right after the ground.
const FLOW_SPD = 16;  // px/s the current carries a glint
const FLOW_RUN = 20;  // px a glint drifts from appearing to gone
const FLOW_A = 0.7;   // its alpha at the middle of its run
function drawCreekFlow(ox, oy, tx0, ty0, tx1, ty1) {
  if (PRACTICE) return;
  const T = FLOW_RUN / FLOW_SPD, now = state.windT; // the field's own clock, so DBG.step and the wire's echo reproduce it
  ctx.fillStyle = CREEK_COL.glint2;
  for (let ty = Math.max(0, ty0); ty <= Math.min(WORLD - 1, ty1); ty++) for (let tx = Math.max(0, tx0); tx <= Math.min(WORLD - 1, tx1); tx++) {
    if (ground[idx(tx, ty)] !== 4) continue;
    for (let q = 0; q < 2; q++) {
      const h = hash2(tx * 7 + q * 131, ty * 13 + 5), h2 = hash2(tx + 57, ty * 3 + q * 17);
      const t = ((now + h * T * 7) % T) / T;
      const f = creekFlow(tx - 0.3 + h2 * 0.6, ty - 0.3 + h * 0.6), fdx = f.fdx, fdy = f.fdy;
      const wx = (tx + 0.2 + h2 * 0.6) * TILE + fdx * (t - 0.5) * FLOW_RUN;
      const wy = (ty + 0.2 + h * 0.6) * TILE + fdy * (t - 0.5) * FLOW_RUN;
      if (!creekWet(wx / TILE - 0.5, wy / TILE - 0.5) || CQ.d > -0.15) continue; // only out on the water, clear of the banks
      ctx.globalAlpha = Math.sin(t * Math.PI) * FLOW_A;
      const sx = Math.round(wx - ox), sy = Math.round(wy - oy);
      ctx.fillRect(sx, sy, 1, 1);
      ctx.fillRect(sx - Math.round(fdx * 1.4), sy - Math.round(fdy * 1.4), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

function renderGround() {
  const g = groundCv.getContext('2d');
  g.imageSmoothingEnabled = false;
  bakeLakes();
  shadeBulk = true;
  const strip = new ImageData(WORLD * TILE, TILE);
  for (let ty = 0; ty < WORLD; ty++) {
    snowStrip(g, ty, strip);
    snowBulk = true;
    for (let tx = 0; tx < WORLD; tx++) paintGroundTile(g, tx, ty);
    snowBulk = false;
  }
  shadeBulk = false;
  shadeWorld(g);
  noteCasts();
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

// ------------------------------------------------------------ the ice shore
// A lake is a SHAPE, not a run of tiles. Whether a pixel is ice is read off
// the four tile centres around it (1 for a lake tile - ice or an open hole -
// 0 for anything else), blended bilinearly and pushed across 0.5 by two
// octaves of noise, so the edge wanders through the tiles instead of
// stepping round them. The tile grid still says where the ice IS for every
// rule in the game; the pixels only say where it looks like it ends, a few
// pixels either way. The noise never reaches half a unit (amp + amp2 < 1 in
// every style), which is what keeps a tile whose whole 3x3 is lake solid ice
// and a tile with no lake in its 3x3 plain snow - so only the band along an
// edge pays for the per-pixel test.
//
// The light comes from the top-left, as it does on the map chart and for
// every cast shadow: the snow's lip over a lake's north and west sides
// catches the sun, throws a band of shade (`band` px) onto the ice under it,
// and the far bank's face is lit.
//
// Each lake rolls ONE style for its whole body off its first tile's hash
// (bakeLakes), so a seed paints the same lakes on every screen and nothing in
// genWorld rolls for it; FROZEN ISLES, one lake, is one style a seed.
//   LIP    a soft bank, the edge wandering gently
//   DEEP   pale shallows at the shore darkening in two steps to the middle
//          (lakeDepth: tiles in from the edge), the bank's shade a deeper band
// `w` is the roll's weight. Noise periods are in tiles.
const ICE_STYLES = [
  { id: 'lip',   w: 1, amp: 0.42, fr: 0.56, amp2: 0.14, fr2: 0.19, band: 2 },
  { id: 'deep',  w: 2, amp: 0.5,  fr: 0.75, amp2: 0.1,  fr2: 0.25, band: 3, deep: true },
];
const ICE_W = ICE_STYLES.reduce((a, s) => a + s.w, 0);
const rgbOf = (h) => { const a = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; a.css = h; return a; };
const ICE_TONE = [rgbOf('#b9dcec'), rgbOf('#c4e3f0')];     // the sheet, in two tones by a dithered low noise
const ICE_SHALLOW = [rgbOf('#c9e7f3'), rgbOf('#d0ebf5')];  // DEEP: the shelf along the shore
const ICE_MID = [rgbOf('#a6cde2'), rgbOf('#add2e6')];      // ...the water deepening
const ICE_DEEP = [rgbOf('#8fbcd8'), rgbOf('#96c1db')];     // ...the middle
const BANK_SHADE = rgbOf('#9ec5da'), BANK_SHADE_DEEP = rgbOf('#8db6d0'), BANK_SHADE2 = rgbOf('#aacfe2');
const BANK_LIP = rgbOf('#ffffff'), BANK_FACE = rgbOf('#e0f2f9');

let lakeStyle = null; // per tile: its lake's index into ICE_STYLES, 255 off the ice
let lakeDepth = null; // per tile: tiles in from the lake's edge (1 = on it), 0 off the ice
function isLake(tx, ty) {
  if (!inWorld(tx, ty)) return false;
  const v = ground[idx(tx, ty)];
  return v === 1 || v === 2;
}
function rollIceStyle(tx, ty) {
  let r = hash2(tx * 7 + 3, ty * 13 + 5) * ICE_W;
  for (let s = 0; s < ICE_STYLES.length; s++) if ((r -= ICE_STYLES[s].w) < 0) return s;
  return 0;
}
// label every lake (flood fill, rolled off its first tile in scan order) and
// sweep its depth in from the edge. Runs once, before the bake: ground only
// ever flips ice <-> hole at runtime, and both are lake.
function bakeLakes() {
  const N = WORLD * WORLD, q = new Int32Array(N), D4 = [1, 0, -1, 0, 0, 1, 0, -1];
  lakeStyle = new Uint8Array(N).fill(255); lakeDepth = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (lakeStyle[i] !== 255 || !isLake(i % WORLD, (i / WORLD) | 0)) continue;
    const s = rollIceStyle(i % WORLD, (i / WORLD) | 0);
    let n = 0; q[n++] = i; lakeStyle[i] = s;
    while (n) {
      const j = q[--n], x = j % WORLD, y = (j / WORLD) | 0;
      for (let k = 0; k < 8; k += 2) {
        if (!isLake(x + D4[k], y + D4[k + 1])) continue;
        const a = idx(x + D4[k], y + D4[k + 1]);
        if (lakeStyle[a] === 255) { lakeStyle[a] = s; q[n++] = a; }
      }
    }
  }
  // one mirror slot per tile an edge can cross (a lake and a non-lake in its
  // 3x3), in a single atlas: night's mirror stamps these instead of the tile
  let slots = 0;
  mirrorSlot = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const n = lakesAround(i % WORLD, (i / WORLD) | 0);
    if (n > 0 && n < 9) mirrorSlot[i] = slots++;
  }
  mirrorCv.width = MIRROR_COLS * TILE; mirrorCv.height = Math.max(1, Math.ceil(slots / MIRROR_COLS)) * TILE;
  let head = 0, tail = 0;
  for (let i = 0; i < N; i++) {
    const x = i % WORLD, y = (i / WORLD) | 0;
    if (!isLake(x, y)) continue;
    for (let k = 0; k < 8; k += 2) if (!isLake(x + D4[k], y + D4[k + 1])) { lakeDepth[i] = 1; q[tail++] = i; break; }
  }
  while (head < tail) {
    const j = q[head++], x = j % WORLD, y = (j / WORLD) | 0, d = lakeDepth[j];
    for (let k = 0; k < 8; k += 2) {
      if (!isLake(x + D4[k], y + D4[k + 1])) continue;
      const a = idx(x + D4[k], y + D4[k + 1]);
      if (!lakeDepth[a]) { lakeDepth[a] = Math.min(255, d + 1); q[tail++] = a; }
    }
  }
}

// is world pixel (x, y) ice, as painted - the edge test described above
function iceAtPx(x, y) {
  const u = (x + 0.5) / TILE - 0.5, v = (y + 0.5) / TILE - 0.5;
  const i = Math.floor(u), j = Math.floor(v);
  const a = isLake(i, j), b = isLake(i + 1, j), c = isLake(i, j + 1), d = isLake(i + 1, j + 1);
  if (a && b && c && d) return true;
  if (!(a || b || c || d)) return false;
  const fu = u - i, fv = v - j;
  const f = (a ? (1 - fu) * (1 - fv) : 0) + (b ? fu * (1 - fv) : 0) + (c ? (1 - fu) * fv : 0) + (d ? fu * fv : 0);
  const s = ICE_STYLES[lakeStyle[a ? idx(i, j) : b ? idx(i + 1, j) : c ? idx(i, j + 1) : idx(i + 1, j + 1)]];
  const fr = s.fr * TILE, fr2 = s.fr2 * TILE;
  return f + (vnoise(x / fr, y / fr) - 0.5) * s.amp + (vnoise(x / fr2 + 50, y / fr2 + 50) - 0.5) * s.amp2 > 0.5;
}
// tiles in from the edge at a pixel, blended like the edge (0 off the ice)
function depthAtPx(x, y) {
  const u = (x + 0.5) / TILE - 0.5, v = (y + 0.5) / TILE - 0.5;
  const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
  const at = (a, b) => inWorld(a, b) ? lakeDepth[idx(a, b)] : 0;
  return at(i, j) * (1 - fu) * (1 - fv) + at(i + 1, j) * fu * (1 - fv) + at(i, j + 1) * (1 - fu) * fv + at(i + 1, j + 1) * fu * fv;
}
// the sheet's colour at a pixel (hp: the pixel's own roll)
function iceTone(x, y, s, hp) {
  const k = vnoise(x / 37 + 3, y / 29 + 5) + (hp - 0.5) * 0.18 > 0.5 ? 0 : 1;
  if (s.deep) {
    const d = depthAtPx(x, y) + (hp - 0.5) * 0.6;
    if (d < 0.9) return ICE_SHALLOW[k];
    if (d > 4.2) return ICE_DEEP[k];
    if (d > 2.4) return ICE_MID[k];
  }
  return ICE_TONE[k];
}

// one tile's edge, and the pixels round it the bank reads: SHORE_M before
// (the shade band looks up and left), 1 after (the lip and face look down
// and right)
const SHORE_M = 3, SHORE_W = TILE + SHORE_M + 1;
const shoreMask = new Uint8Array(SHORE_W * SHORE_W);
function fillShoreMask(px, py) {
  for (let j = 0; j < SHORE_W; j++) for (let i = 0; i < SHORE_W; i++) {
    shoreMask[j * SHORE_W + i] = iceAtPx(px - SHORE_M + i, py - SHORE_M + j) ? 1 : 0;
  }
}
const iceMk = (i, j) => shoreMask[(j + SHORE_M) * SHORE_W + i + SHORE_M];

// Night's mirror (drawIceStars, light.js) darkens the ice under the reflected
// sky. A tile no edge crosses is darkened whole; one the edge crosses stamps
// its own slot of mirrorCv - the ice pixels of the mask the bake just read,
// in MIRROR_INK - so the dark follows the shore instead of the tiles.
const MIRROR_COLS = 64, MIRROR_INK = [7, 13, 40];
const mirrorCv = document.createElement('canvas');
let mirrorSlot = null; // per tile: its slot in mirrorCv, -1 for none
const mirrorImg = new ImageData(TILE, TILE);
function markMirror(tx, ty) {
  const s = mirrorSlot[idx(tx, ty)], D = mirrorImg.data;
  for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    const k = (j * TILE + i) * 4;
    D[k] = MIRROR_INK[0]; D[k + 1] = MIRROR_INK[1]; D[k + 2] = MIRROR_INK[2]; D[k + 3] = iceMk(i, j) ? 255 : 0;
  }
  mirrorCv.getContext('2d').putImageData(mirrorImg, (s % MIRROR_COLS) * TILE, ((s / MIRROR_COLS) | 0) * TILE);
}
// the bank at tile pixel (i, j): shade under the lip, the lit far face, the
// lip itself - or null where the pixel is not on a bank
function bankAt(i, j, s) {
  if (iceMk(i, j)) {
    for (let k = 1; k <= s.band; k++) {
      if (!iceMk(i, j - k) || (k === 1 && !iceMk(i - 1, j))) return k === 1 ? (s.deep ? BANK_SHADE_DEEP : BANK_SHADE) : BANK_SHADE2;
    }
    return !iceMk(i, j + 1) || !iceMk(i + 1, j) ? BANK_FACE : null;
  }
  return iceMk(i, j + 1) || iceMk(i + 1, j) ? BANK_LIP : null;
}
function lakesAround(tx, ty) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isLake(tx + dx, ty + dy)) n++;
  return n;
}

// an ice tile, every pixel: returns whether the whole 3x3 is lake (no edge
// crosses it, so the tile's cracks and glints can go anywhere)
const iceImg = new ImageData(TILE, TILE);
function paintIceTile(g, tx, ty, px, py) {
  const s = ICE_STYLES[lakeStyle[idx(tx, ty)]];
  const inner = lakesAround(tx, ty) === 9;
  if (!inner) { fillShoreMask(px, py); markMirror(tx, ty); snowTile(px, py); }
  const D = iceImg.data;
  for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    const x = px + i, y = py + j, hp = hash2(x * 3 + 7, y * 5 + 11);
    let c;
    if (inner) c = iceTone(x, y, s, hp);
    else if (iceMk(i, j)) c = bankAt(i, j, s) || iceTone(x, y, s, hp);
    else c = bankAt(i, j, s) || SNOW_INK[snowTone[j * TILE + i]];
    const k = (j * TILE + i) * 4;
    D[k] = c[0]; D[k + 1] = c[1]; D[k + 2] = c[2]; D[k + 3] = 255;
  }
  g.putImageData(iceImg, px, py);
  return inner;
}
// a snow tile beside a lake: only the pixels the edge or the lip claims
function paintSnowShore(g, tx, ty, px, py) {
  let st = 255;
  for (let dy = -1; dy <= 1 && st === 255; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (isLake(tx + dx, ty + dy)) { st = lakeStyle[idx(tx + dx, ty + dy)]; break; }
  }
  if (st === 255) return;
  const s = ICE_STYLES[st];
  fillShoreMask(px, py);
  markMirror(tx, ty);
  for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    const c = iceMk(i, j) ? bankAt(i, j, s) || iceTone(px + i, py + j, s, hash2((px + i) * 3 + 7, (py + j) * 5 + 11)) : bankAt(i, j, s);
    if (c) { g.fillStyle = c.css; g.fillRect(px + i, py + j, 1, 1); }
  }
}

// ------------------------------------------------------------ the snow's pixels
// Open snow wears a soft relief of wind-laid drifts: long swells stretched
// along SNOW_ANG, lit on the side facing the sun (top-left, the one the cast
// shadows fall from) and shaded blue on the lee, in four close tones under a
// Bayer dither. The valley is not one field of it: a very low noise
// (SNOW_REGION) lays out regions of three LOOKS - fine drifts, broad swells,
// and lee-only (bright flat snow with shade only behind each swell) -
// blended across a soft band, so no seam shows. Every pixel is a function of
// its world position alone (hash2/vnoise, no rng), so any repaint - a hole,
// a crater, a cast shade, a felled pine - lays back exactly the snow that
// was there. Kept quiet on purpose: the darkest tone stays well above
// SHADE_TINT so a cast shadow still reads over the deepest drift.
const SNOW_PAL = ['#dfe8f4', '#e8f0f9', '#eef4fb', '#f5f9fd'].map(rgbOf); // lee .. lit
const SNOW_BASE = 1;                           // the flat snow's tone
const SNOW_GLINT = rgbOf('#ffffff'), SNOW_GLINT_P = 0.996; // a crystal, only on the lit tone
let SNOW_ANG = -0.33, SNOW_C = Math.cos(SNOW_ANG), SNOW_S = Math.sin(SNOW_ANG); // a match turns it onto the seed's prevailing wind (layDrifts, js/depth.js)
const SNOW_LOOKS = [
  { sc: 1,   rel: 7, dith: 0.8 },              // fine drifts
  { sc: 1.8, rel: 8, dith: 0.6 },              // broad swells
  { sc: 1.5, rel: 9, dith: 0.6, lee: true },   // lee only
];
const SNOW_REGION = 22 * TILE;       // world px per step of the region noise
const SNOW_CUT = [0.41, 0.6];        // region noise thresholds between the looks (~thirds of the map)
const SNOW_BLEND = 0.05;             // half-width of the blend across each threshold
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.47);

// drift height at a world pixel, for swells sc times the fine look's size
function snowH(x, y, sc) {
  const u = x * SNOW_C + y * SNOW_S, v = -x * SNOW_S + y * SNOW_C;
  return vnoise(u / (70 * sc), v / (26 * sc)) * 0.62 + vnoise(u / (30 * sc) + 9.3, v / (12 * sc) + 4.1) * 0.38;
}
const smooth01 = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
// The heights are sampled on a lattice every 2 world px (aligned to the
// world, not the tile) and read bilinearly, so a tile costs 12x12 samples a
// look instead of several per pixel - and every tile, a shore tile included,
// reads the same lattice, so no seam can open.
const SNOW_LAT = 12;                                  // lattice points a tile reads, per side
const snowLatH = SNOW_LOOKS.map(() => new Float32Array(SNOW_LAT * SNOW_LAT)); // heights
const snowLatS = SNOW_LOOKS.map(() => new Float32Array(SNOW_LAT * SNOW_LAT)); // slopes toward the sun
const snowTone = new Uint8Array(TILE * TILE);         // the tile's pixels: a SNOW_PAL index, 4 = glint
const latAt = (a, fx, fy) => {
  const ix = fx | 0, iy = fy | 0, ux = fx - ix, uy = fy - iy, k = iy * SNOW_LAT + ix;
  const top = a[k] + (a[k + 1] - a[k]) * ux, bot = a[k + SNOW_LAT] + (a[k + SNOW_LAT + 1] - a[k + SNOW_LAT]) * ux;
  return top + (bot - top) * uy;
};
const snowW = new Float32Array(SNOW_LOOKS.length);
// fill snowTone for the tile whose top-left world pixel is (px, py). The
// region noise moves over ~22 tiles, so it is read at the tile's four
// corners (world-aligned too) and blended across the tile.
function snowTile(px, py) {
  const X0 = (px >> 1) - 1, Y0 = (py >> 1) - 1; // lattice index of the first point (2 px up-left of the tile)
  const rq = (x, y) => vnoise(x / SNOW_REGION + 71.3, y / SNOW_REGION + 37.7);
  const q00 = rq(px, py), q10 = rq(px + TILE, py), q01 = rq(px, py + TILE), q11 = rq(px + TILE, py + TILE);
  // a look only pays for its heights where its region reaches the tile
  const qlo = Math.min(q00, q10, q01, q11), qhi = Math.max(q00, q10, q01, q11);
  const on0 = qlo < SNOW_CUT[0] + SNOW_BLEND, on2 = qhi > SNOW_CUT[1] - SNOW_BLEND;
  const on1 = qhi > SNOW_CUT[0] - SNOW_BLEND && qlo < SNOW_CUT[1] + SNOW_BLEND;
  const on = [on0, on1, on2];
  // each look's slope toward the sun at every lattice point - its height one
  // point (2 px) down-right less one up-left - pre-scaled by its relief; a
  // bilinear read of it is exactly the difference of two bilinear heights
  let only = -1;
  for (let l = 0; l < SNOW_LOOKS.length; l++) {
    if (!on[l]) continue;
    only = only === -1 ? l : -2;
    const H = snowLatH[l], S = snowLatS[l], L = SNOW_LOOKS[l], k = L.rel * L.sc;
    for (let b = 0; b < SNOW_LAT; b++) for (let a = 0; a < SNOW_LAT; a++) H[b * SNOW_LAT + a] = snowH((X0 + a) * 2, (Y0 + b) * 2, L.sc);
    for (let b = 1; b < SNOW_LAT - 1; b++) for (let a = 1; a < SNOW_LAT - 1; a++) {
      S[b * SNOW_LAT + a] = (H[(b + 1) * SNOW_LAT + a + 1] - H[(b - 1) * SNOW_LAT + a - 1]) * k;
    }
  }
  const deep = driftCell && driftCell[idx(px / TILE, py / TILE)]; // a deep drift reaches this tile (js/depth.js)
  for (let j = 0; j < TILE; j++) {
    const v = j / TILE, qa = q00 + (q01 - q00) * v, qb = q10 + (q11 - q10) * v, y = py + j, fy = y / 2 - Y0;
    for (let i = 0; i < TILE; i++) {
      const x = px + i, fx = x / 2 - X0;
      let d = 0, dith = 0;
      if (only >= 0) { // the whole tile inside one look's region: no blend to weigh
        const L = SNOW_LOOKS[only], s = latAt(snowLatS[only], fx, fy);
        d = L.lee ? Math.min(0, s) + 1 : s; dith = L.dith;
      } else {
        const q = qa + (qb - qa) * (i / TILE);
        snowW[0] = on0 ? smooth01(SNOW_CUT[0] + SNOW_BLEND, SNOW_CUT[0] - SNOW_BLEND, q) : 0;
        snowW[2] = on2 ? smooth01(SNOW_CUT[1] - SNOW_BLEND, SNOW_CUT[1] + SNOW_BLEND, q) : 0;
        snowW[1] = 1 - snowW[0] - snowW[2];
        for (let l = 0; l < SNOW_LOOKS.length; l++) {
          const w = snowW[l];
          if (w <= 0) continue;
          const L = SNOW_LOOKS[l], s = latAt(snowLatS[l], fx, fy);
          d += w * (L.lee ? Math.min(0, s) + 1 : s); dith += w * L.dith;
        }
      }
      const t = Math.round(SNOW_BASE + d + BAYER4[(y & 3) * 4 + (x & 3)] * dith);
      const tone = t >= 3 ? (hash2(x * 3 + 7, y * 5 + 11) > SNOW_GLINT_P ? 4 : 3) : t < 0 ? 0 : t;
      snowTone[j * TILE + i] = deep ? deepTone(x, y, tone) : tone;
    }
  }
}
const SNOW_INK = SNOW_PAL.concat([SNOW_GLINT], DEEP_PAL.map(rgbOf)); // 5.. deep snow (js/draw/depth.js)
// ink snowTone into an ImageData at pixel column ox
function inkSnow(img, ox) {
  const D = img.data, W = img.width;
  for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    const c = SNOW_INK[snowTone[j * TILE + i]], k = (j * W + ox + i) * 4;
    D[k] = c[0]; D[k + 1] = c[1]; D[k + 2] = c[2]; D[k + 3] = 255;
  }
}
const snowImg = new ImageData(TILE, TILE);
let snowBulk = false; // renderGround has already laid this row's snow in one strip
function paintSnowTile(g, px, py) {
  if (snowBulk) return;
  snowTile(px, py);
  inkSnow(snowImg, 0);
  g.putImageData(snowImg, px, py);
}
// the boot bake's snow: one strip per row of tiles, one putImageData each
// (per tile, putImageData alone costs the bake half a second)
function snowStrip(g, ty, strip) {
  for (let tx = 0; tx < WORLD; tx++) {
    const gv = ground[idx(tx, ty)];
    if (gv !== 0 && gv !== 3) continue; // ice and holes paint every pixel of their own
    snowTile(tx * TILE, ty * TILE);
    inkSnow(strip, tx * TILE);
  }
  g.putImageData(strip, 0, ty * TILE);
}

// ------------------------------------------------------------ the wind's sweep
// The wind's sweep (windSweep, the `wind` banner, js/sim.js) drawn: every
// fifteen seconds a few faint streaks of loose snow drift slowly downwind,
// each a thin white line of drift over its own soft shadow a few px
// down-right (the one sun), rolling gently as it goes. The streaks live in
// the WORLD, not on the screen: the valley is cut into SWEEP_CELL_W x
// SWEEP_CELL_H cells, each sweep lays one or two streaks in every cell at a
// spot off the cell and the sweep's number (hash2 - nothing rolls), and each
// drifts SWEEP_RUN px downwind from there - so a streak stays where it is as
// the camera pans, and two players looking at the same field see the same
// snow blowing across it. Each sets off at its own moment and pace and fades
// in and out along its run, and all of it is only as strong as the day's
// air. Drawn in the air - over the pines and everything standing, under the
// eagle and the night grade. Kept faint on purpose: a breath of wind, not a
// gust.
const SWEEP_CELL_W = 360, SWEEP_CELL_H = 240; // world px of the grid the streaks are laid on
const SWEEP_STREAKS = [1, 2];                 // streaks a cell carries each sweep, fewest..most
const SWEEP_LEN = [40, 80];                   // world px a streak runs, shortest..longest
const SWEEP_RUN = 420;                        // world px a streak drifts over its run
const SWEEP_LAG = 0.3;                        // the share of the sweep the latest streak waits to set off
const SWEEP_WAVE = 18, SWEEP_WAVE_A = 1.5;    // px per radian and px of the drift's roll in the air
const SWEEP_SHADE_DX = 2, SWEEP_SHADE_DY = 3; // where its shadow falls: down-right, off the one sun
const SWEEP_SHADE = '#b9c8e0', SWEEP_SHADE_A = 0.35; // multiplied under a streak, at full strength
const SWEEP_BODY = '#ffffff', SWEEP_BODY_A = 0.5;    // the drift itself, at full strength
const SWEEP_FULL = 0.6;                       // the air's strength at which a sweep is at full strength
const SWEEP_STRANDS = [[0, 0, 1], [-16, 4, 0.5]]; // a streak's strands: px behind the head, px down, share of its length
function drawSweep(ex, ey) {
  const sw = windSweep();
  if (!sw) return;
  const air = Math.min(1, sw.w / SWEEP_FULL), reach = SWEEP_RUN + SWEEP_LEN[1] + 20;
  // every cell a streak could have drifted into the view from
  const cx0 = Math.floor((ex - reach) / SWEEP_CELL_W), cx1 = Math.floor((ex + WV_W + reach) / SWEEP_CELL_W);
  const cy0 = Math.floor((ey - 8) / SWEEP_CELL_H), cy1 = Math.floor((ey + WV_H + 8) / SWEEP_CELL_H);
  ctx.save();
  for (let pass = 0; pass < 2; pass++) { // the shadows first, all of them, then the drifts
    ctx.globalCompositeOperation = pass ? 'source-over' : 'multiply';
    ctx.fillStyle = pass ? SWEEP_BODY : SWEEP_SHADE;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const cell = sw.n * 7919 + cx * 131 + cy * 977; // the cell's roll this sweep
      const n = SWEEP_STREAKS[0] + ((hash2(cell, 17) * (SWEEP_STREAKS[1] - SWEEP_STREAKS[0] + 1)) | 0);
      for (let i = 0; i < n; i++) {
        const h1 = hash2(cell + i * 13, 31), h2 = hash2(cell + i * 13, 47), h3 = hash2(cell + i * 13, 59), h4 = hash2(cell + i * 13, 71);
        const lag = SWEEP_LAG * h3, span = (1 - SWEEP_LAG) * (0.75 + 0.25 * h2); // its own moment and pace
        const k = (sw.k - lag) / span;
        if (k <= 0 || k >= 1) continue;
        const len = Math.round(SWEEP_LEN[0] + (SWEEP_LEN[1] - SWEEP_LEN[0]) * h2);
        // where it sets off in the world, and where its head is now
        const wx0 = cx * SWEEP_CELL_W + h4 * SWEEP_CELL_W, wy = Math.round(cy * SWEEP_CELL_H + h1 * SWEEP_CELL_H);
        const head = wx0 + sw.dir * SWEEP_RUN * k;
        if (head + len < ex - 4 || head - len > ex + WV_W + 4) continue;
        ctx.globalAlpha = Math.sin(Math.PI * k) * air * (pass ? SWEEP_BODY_A : SWEEP_SHADE_A);
        for (const [bx, by, share] of SWEEP_STRANDS) for (let j = 0, sl = Math.round(len * share); j < sl; j++) {
          // j counts back from the head: solid for the front half, then flecks thinning out
          const t = j / sl;
          if (t > 0.5 && (j % (t > 0.8 ? 4 : 2))) continue;
          const wx = head - sw.dir * (j - bx), x = Math.round(wx - ex); // trailing upwind of the head; moving, so off the exact camera
          if (x < -4 || x > WV_W + 4) continue;
          // the roll rides the ground, so the drift rolls as it runs
          const y = Math.round(wy + by + Math.round(Math.sin(wx / SWEEP_WAVE + i * 2.1) * SWEEP_WAVE_A) - ey);
          if (y < -8 || y > WV_H + 8) continue;
          if (pass) ctx.fillRect(x, y, 1, 1);
          else ctx.fillRect(x + SWEEP_SHADE_DX * sw.dir, y + SWEEP_SHADE_DY, 1, 1);
        }
      }
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------ cast shadows
// One sun, top-left, for everything standing on the snow: a sprite throws its
// own silhouette down-right, each row of it landing SUN_DX/SUN_DY per row of
// height from its foot (shadeMask bakes that once per frame of art).
//
// The scenery never moves, so its shade is GROUND: paintCastShade paints it
// into groundCv with the tile it falls on - every caster within CAST_REACH
// of the tile, unioned in one scratch tile and then multiplied down by
// SHADE_TINT at SHADE_A, so two pines' shade overlapping is one shade, not a
// darker one. What stands is CASTERS, by object type: its art (the pine's
// standing frame, never the wind's) and where the art sits on its tile.
// Every tile remembers the caster it was painted with (castAt) and
// syncCasts - run by render() over the view - repaints a caster's reach the
// moment what stands on its tile changes, so a felled pine takes its shade
// with it however it fell (an axe, the spur, a crater, a snapshot) with
// nothing calling anything.
//
// What moves draws its own each frame under its sprite (drawCastShade): the
// same silhouette in SHADE_BODY, flat and translucent, which reads the same
// on the snow as the multiply does.
const SUN_DX = 0.62, SUN_DY = 0.34;        // per row of height: 0.8 of (0.78, 0.42), mid-morning
const SHADE_A = 0.3, SHADE_TINT = '#465fa5';
const SHADE_BODY = '#3e59a7', SHADE_BODY_A = 0.3;
const CAST_REACH = [-1, -1, 3, 2];          // tiles a caster's shade can land on from its own: x0, y0, x1, y1 (shadeFor checks)
const whole = (cv, x, y) => [cv, 0, cv.width, cv.height, x, y];
const CASTERS = {
  // a pine's code is its standing frame AND its nudge (treeNudgeX/Y), so a
  // shade is cut once per pair and lands under the art where it was nudged;
  // every palette row has the same silhouette, so the art is row 0's
  tree:     { code: (o, tx, ty) => 1000 + treeRestFrame(tx, ty) + SPRITES.treeAtlas.cols *
                ((treeNudgeX(tx, ty) + TREE_NUDGE_X) * (TREE_NUDGE_Y * 2 + 1) + treeNudgeY(tx, ty) + TREE_NUDGE_Y),
              art: (c) => {
                const A = SPRITES.treeAtlas, f = (c - 1000) % A.cols, n = Math.floor((c - 1000) / A.cols);
                const nx = Math.floor(n / (TREE_NUDGE_Y * 2 + 1)) - TREE_NUDGE_X, ny = n % (TREE_NUDGE_Y * 2 + 1) - TREE_NUDGE_Y;
                return [A, f * A.fw, A.fw, A.fh, -5 + nx, -21 + ny];
              } },
  deadTree: { code: (o) => 100 + o.variant, art: (c) => whole(SPRITES.deadTree[c - 100], 0, -8) },
  rock:     { code: (o) => 110 + o.variant, art: (c) => whole(SPRITES.rock[c - 110], 0, 4) },
  bush:     { code: () => 120, art: () => whole(SPRITES.bush, 0, 4) },
  stump:    { code: () => 121, art: () => whole(SPRITES.stump, 0, 4) },
  den:      { code: () => 122, art: () => whole(SPRITES.den, 0, -4) },
  chest:    { code: () => 123, art: () => whole(CHEST_SPR, 0, TILE - CHEST_SPR.height) },
  cairn:    { code: () => 124, art: () => whole(CAIRN_SPR, 1, TILE - CAIRN_SPR.height + 1) },
  hut:      { code: () => 125, art: () => { const s = SPRITES.hogHut[0]; return whole(s, TILE - (s.width >> 1), TILE - s.height); } },
};

// a frame's shade: an opaque silhouette thrown down-right in `col`, its top
// row on the art's foot row (cv.oy rows below the art's top); copied at
// `alpha` when the caller wants it translucent
const artAlpha = new WeakMap(); // a source canvas's pixels, read back once (the pine atlas holds 48 frames)
function shadeMask(src, sx, sw, sh, col, alpha) {
  let px = artAlpha.get(src);
  if (!px) { px = src.getContext('2d').getImageData(0, 0, src.width, src.height).data; artAlpha.set(src, px); }
  const op = (i, j) => px[(j * src.width + sx + i) * 4 + 3] > 100;
  let bot = -1;
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) if (op(i, j)) bot = j;
  if (bot < 0) return null;
  const cv = document.createElement('canvas');
  cv.width = sw + Math.ceil(bot * SUN_DX) + 2; cv.height = Math.ceil(bot * SUN_DY) + 3;
  const g = cv.getContext('2d');
  g.fillStyle = col;
  const rw = Math.ceil(SUN_DX) + 1, rh = Math.ceil(SUN_DY) + 1;
  for (let j = 0; j <= bot; j++) for (let i = 0; i < sw; i++) {
    if (!op(i, j)) continue;
    const hgt = bot - j;
    g.fillRect(Math.round(i + hgt * SUN_DX), Math.round(hgt * SUN_DY), rw, rh);
  }
  let out = cv;
  if (alpha < 1) {
    out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height;
    const o = out.getContext('2d'); o.globalAlpha = alpha; o.drawImage(cv, 0, 0);
  }
  out.oy = bot;
  return out;
}
const shadeByCode = new Map();
function shadeFor(C, c) {
  let m = shadeByCode.get(c);
  if (m !== undefined) return m;
  const [src, sx, sw, sh, ax, ay] = C.art(c);
  m = shadeMask(src, sx, sw, sh, SHADE_TINT, 1);
  if (m) {
    m.ax = ax; m.ay = ay + m.oy;
    if (Math.floor(ax / TILE) < CAST_REACH[0] || Math.floor(m.ay / TILE) < CAST_REACH[1] ||
        Math.floor((ax + m.width - 1) / TILE) > CAST_REACH[2] || Math.floor((m.ay + m.height - 1) / TILE) > CAST_REACH[3]) {
      console.warn('cast shadow outruns CAST_REACH', c);
    }
  }
  shadeByCode.set(c, m);
  return m;
}
function castCode(tx, ty) {
  const o = objects[idx(tx, ty)], C = o && CASTERS[o.type];
  return C ? C.code(o, tx, ty) : 0;
}
const shadeCv = document.createElement('canvas');
shadeCv.width = TILE; shadeCv.height = TILE;
const shadeG = shadeCv.getContext('2d');
let shadeBulk = false; // true through renderGround: the whole map's shade goes down in chunks after the tiles
function paintCastShade(g, tx, ty, px, py) {
  if (shadeBulk) return;
  let any = false;
  for (let cy = ty - CAST_REACH[3]; cy <= ty - CAST_REACH[1]; cy++) for (let cx = tx - CAST_REACH[2]; cx <= tx - CAST_REACH[0]; cx++) {
    if (!inWorld(cx, cy)) continue;
    const o = objects[idx(cx, cy)], C = o && CASTERS[o.type];
    if (!C) continue;
    const m = shadeFor(C, C.code(o, cx, cy));
    if (!m) continue;
    if (!any) { shadeG.clearRect(0, 0, TILE, TILE); any = true; }
    shadeG.drawImage(m, cx * TILE + m.ax - px, cy * TILE + m.ay - py);
  }
  if (!any) return;
  g.save();
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = SHADE_A;
  g.drawImage(shadeCv, px, py);
  g.restore();
}
// the boot bake's shade: one multiply per SHADE_CHUNK square instead of one
// per tile - a composite onto the 3712 px canvas costs the same for 16 px as
// for 512, and forty thousand of them took five seconds
const SHADE_CHUNK = 512;
function shadeWorld(g) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = SHADE_CHUNK;
  const c = cv.getContext('2d'), span = SHADE_CHUNK / TILE;
  for (let y0 = 0; y0 < WORLD * TILE; y0 += SHADE_CHUNK) for (let x0 = 0; x0 < WORLD * TILE; x0 += SHADE_CHUNK) {
    const tx0 = x0 / TILE, ty0 = y0 / TILE;
    let any = false;
    for (let cy = Math.max(0, ty0 - CAST_REACH[3]); cy <= Math.min(WORLD - 1, ty0 + span - 1 - CAST_REACH[1]); cy++) {
      for (let cx = Math.max(0, tx0 - CAST_REACH[2]); cx <= Math.min(WORLD - 1, tx0 + span - 1 - CAST_REACH[0]); cx++) {
        const o = objects[idx(cx, cy)], C = o && CASTERS[o.type];
        if (!C) continue;
        const m = shadeFor(C, C.code(o, cx, cy));
        if (!m) continue;
        if (!any) { c.clearRect(0, 0, SHADE_CHUNK, SHADE_CHUNK); any = true; }
        c.drawImage(m, cx * TILE + m.ax - x0, cy * TILE + m.ay - y0);
      }
    }
    if (!any) continue;
    g.save();
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = SHADE_A;
    g.drawImage(cv, x0, y0);
    g.restore();
  }
}
let castAt = null; // per tile: the caster code its reach was last painted with
function noteCasts() {
  castAt = new Int16Array(WORLD * WORLD);
  for (let ty = 0; ty < WORLD; ty++) for (let tx = 0; tx < WORLD; tx++) castAt[idx(tx, ty)] = castCode(tx, ty);
}
// every tile whose shade can reach the view: a caster that changed repaints its reach
// (a crater fells dozens at once: their reaches overlap, so each tile once)
const castDirty = new Set();
function syncCasts(tx0, ty0, tx1, ty1) {
  if (!castAt) return;
  for (let cy = Math.max(0, ty0 - CAST_REACH[3]); cy <= Math.min(WORLD - 1, ty1 - CAST_REACH[1]); cy++) {
    for (let cx = Math.max(0, tx0 - CAST_REACH[2]); cx <= Math.min(WORLD - 1, tx1 - CAST_REACH[0]); cx++) {
      const i = idx(cx, cy), c = castCode(cx, cy);
      if (c === castAt[i]) continue;
      castAt[i] = c;
      for (let y = cy + CAST_REACH[1]; y <= cy + CAST_REACH[3]; y++) for (let x = cx + CAST_REACH[0]; x <= cx + CAST_REACH[2]; x++) {
        if (inWorld(x, y)) castDirty.add(idx(x, y));
      }
    }
  }
  if (!castDirty.size) return;
  const g = groundCv.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (const i of castDirty) paintGroundTile(g, i % WORLD, (i / WORLD) | 0);
  castDirty.clear();
}
// a body's shade, under its sprite drawn at (x, y) in the frame being drawn
const bodyShade = new WeakMap();
function drawCastShade(spr, x, y) {
  let m = bodyShade.get(spr);
  if (m === undefined) { m = shadeMask(spr, 0, spr.width, spr.height, SHADE_BODY, SHADE_BODY_A); bodyShade.set(spr, m); }
  if (m) ctx.drawImage(m, x, y + m.oy);
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
function treeFrame(tx, ty) { return treeLean(tx, ty, windSway(tx, ty)); }
// the frame it stands in with no wind at all - what its cast shadow is cut from
function treeRestFrame(tx, ty) { return treeLean(tx, ty, 0); }
function treeLean(tx, ty, sway) {
  const h = hash2(tx * 3 + 1, ty * 3 + 2) * 2;
  const flip = h >= 1;                        // the mirrored half of the atlas
  const mid = (TREE_FRAMES - 1) / 2;
  const rest = TREE_REST * ((flip ? h - 1 : h) * 2 - 1);
  let i = Math.round(mid + rest + sway * mid);
  if (i < 0) i = 0; else if (i > TREE_FRAMES - 1) i = TREE_FRAMES - 1;
  return flip ? TREE_FRAMES * 2 - 1 - i : i;
}

// Which of the atlas's palette rows a pine wears, and where on its tile it
// stands - all off the tile, at draw time, so none of it is world state: no
// rng, no snapshot, nothing a client could disagree with.
//
// The ROW is a variant (B, C or D of docs/media/concepts/tree-filters-2.png,
// a third of the forest each off the tile's hash) and a TONE for how deep in
// the forest the tree stands: 0 lighter on the edge (an open tile among its 8
// neighbours), 2 darker deep inside (every tile two rings out is forest too),
// 1 between. It is read live, so felling a pine brightens the ones it opens.
// A stand is anything woody - a dead snag walls a forest in like a pine - and
// the world's border counts as forest.
const TREE_TONES = 3;
function woody(tx, ty) {
  if (!inWorld(tx, ty)) return true;
  const o = objects[idx(tx, ty)];
  return !!o && (o.type === 'tree' || o.type === 'deadTree');
}
function treeTone(tx, ty) {
  for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (!woody(x, y)) return 0;
  for (let x = tx - 2; x <= tx + 2; x++) if (!woody(x, ty - 2) || !woody(x, ty + 2)) return 1;
  for (let y = ty - 1; y <= ty + 1; y++) if (!woody(tx - 2, y) || !woody(tx + 2, y)) return 1;
  return 2;
}
// the cell in SPRITES.treeAtlas: column (treeFrame's lean) + palette row
function treeCell(tx, ty, col) {
  const v = Math.floor(hash2(tx * 5 + 3, ty * 7 + 1) * 3);
  return col + (v * TREE_TONES + treeTone(tx, ty)) * SPRITES.treeAtlas.cols;
}
// The nudge that breaks the grid: up to TREE_NUDGE_X px either side of the
// tile's centre line and TREE_NUDGE_Y up or down. Only the art moves - the
// tree's tile, its collision and its chop reach stay where they are - so the
// sprite, its cast shade (CASTERS.tree), the work-target rim and the hit
// flash all read it from here.
const TREE_NUDGE_X = 2, TREE_NUDGE_Y = 1;
function treeNudgeX(tx, ty) { return Math.floor(hash2(tx * 11 + 5, ty * 13 + 9) * (TREE_NUDGE_X * 2 + 1)) - TREE_NUDGE_X; }
function treeNudgeY(tx, ty) { return Math.floor(hash2(tx * 17 + 2, ty * 19 + 4) * (TREE_NUDGE_Y * 2 + 1)) - TREE_NUDGE_Y; }

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
