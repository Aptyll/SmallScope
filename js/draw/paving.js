'use strict';
// The road's pixels: the flagstone band paintRoadOverlay lays over a ground
// tile (js/draw/ground.js calls it from paintGroundTile), its stones, its
// edge and lip, and the per-tile memo they share. Loaded right after ground.js.
// ---- the road's pixels ----------------------------------------------------
// The road (placeRoad, world.js) is not a kind of tile but a BAND laid over
// the snow at pixel precision: every pixel of a tile near it asks roadDist
// for its distance to the ragged edge and is painted by that - inside, a
// FLAGSTONE path (roadStoneAt: big flat greys, a lit rim toward the light and
// a shaded one away from it, packed earth in the joints), a full value step
// under the snow so it reads without colour and at night. The path ends on
// WHOLE stones: a stone is laid if its middle is inside the edge (roadStoneIn),
// so the edge steps from stone to stone along the wandering line, never
// through one. The snow stands a little higher than the stones: round the
// last of them runs the joint, then a LIP of snow two pixels wide, lit where
// it faces the light and shaded where it faces away (ROAD_LIP), and a drift
// laps over a stone here and there under its own shade. Past the lip, snow
// greyed by the march and dry grass through it. A 16 px tile can be half road
// and half snow. On an ICE tile - which only
// a PATH ever crosses, never the diagonal - `onIce` paints the earth and its
// snowy verge the same way but leaves the water alone outside it, under a
// pale rim a pixel or two wide that follows the same ragged edge: a lake has
// a shoreline, not a muddy shoulder. 
const ROAD_COL_DEEP = '#8a7556';                       // the earth in shade (the wiki mound's rim), and in the flagstones' joints
const ROAD_FLAG = 12;                                  // px a flagstone's cell spans
const ROAD_COL_GREY = '#d5dce6';                       // the snow beside the lane, greyed by the march
const ROAD_COL_GRASS = '#a08c58', ROAD_COL_GRASS_D = '#73643c'; // dry grass through the verge snow
const ROAD_LIP = 3.2;                                  // px of gap out from the last stone the snow's lip is drawn over
const ROAD_COL_LIP = '#ffffff', ROAD_COL_LIP_SHD = '#b4c5dc'; // the lip facing the light, and facing away
const ROAD_COL_LAP_SHD = '#7f8794';                    // the shade a drift lapping over the stones throws on them
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
const LOG_NBR = [0, -1, -1, 0, 1, 0, 0, 1, 0, 0]; // dx, dy: the four neighbours whose piece can spill onto a tile, then its own last
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
    if (stub) { penDot(g, t === 6 ? LOG_COL.mid : t === 7 ? LOG_COL.dark : LOG_COL.rim, px + x, py + y); continue; }
    if ((t === 6 || t === 7) && Math.abs(t - 6) < half - 3) { // the shadow off the lower flank
      penDot(g, 'rgba(40,60,100,0.22)', px + x, py + y);
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
    penDot(g, c, px + x, py + y);
  }
  penFlush();
}
// a fallen pine, painted into one tile's px from the trunk's line (x0, y0 the
// root plate, x1, y1 the broken top): bark under a snow cap on its upper
// side, a root plate of earth standing up at its foot, a splintered top,
// three lopped branch stubs, a drift banked on its upper side and its shade
// off the lower one, so it lies in the snow and has a top and a bottom
const TRUNK_COL = { rim: '#2a1c10', dark: '#4a3218', mid: '#6b4a2a', light: '#8a6142', wood: '#d9b382', earth: '#3b2c22', root: '#5a4330', snow: '#f4f7ff', snowD: '#d8e4f2', capRim: '#6f86a8', capSide: '#a9bcd9', drift: '#cfdbea' };
const TRUNK_R = [6.5, 4.5];   // px half-thickness at the foot and at the broken top
const TRUNK_PLATE = [5, 13];  // px the root plate stands along the line and across it
const TRUNK_STUBS = [[0.34, -1], [0.55, 1], [0.78, -1]]; // [along, side]: a lopped branch (side -1 the upper)
const TRUNK_SHADE = 'rgba(40,60,100,0.24)';
const TRUNK_CREST = 3;         // px of that cap, along the spine, that are its white crest: the line that holds in shade and at night
const TRUNK_CAP = 0.1;        // how far past the trunk's middle, in half-thicknesses, its snow cap comes down: most of what is seen from above is snow
const TRUNK_CAP_IN = 0.3;     // of a half-thickness: how far a trunk lying straight up the screen draws its cap in from each side
function paintTrunk(g, tr, px, py) {
  const vx = tr.x1 - tr.x0, vy = tr.y1 - tr.y0, L = Math.hypot(vx, vy), ux = vx / L, uy = vy / L;
  let nx = -uy, ny = ux;
  if (ny < 0) { nx = -nx; ny = -ny; } // n points down the screen: d < 0 is the trunk's upper side
  const seed = tr.x0 * 3 + tr.y0, steep = uy * uy;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const wx = px + x + 0.5 - tr.x0, wy = py + y + 0.5 - tr.y0;
    const a = wx * ux + wy * uy, d = wx * nx + wy * ny, h = hash2(px + x, py + y);
    const r = TRUNK_R[0] + (TRUNK_R[1] - TRUNK_R[0]) * Math.max(0, Math.min(1, a / L));
    const ad = Math.abs(d), f = a / L;
    let c = null;
    // the root plate: a disc of earth and torn roots standing on edge at the foot
    const pa = (a + 1) / TRUNK_PLATE[0], pd = d / (TRUNK_PLATE[1] + (hash2(seed, Math.round(d)) - 0.5) * 3);
    if (pa * pa + pd * pd <= 1 && a < 2) {
      c = ad > TRUNK_PLATE[1] - 3 && h < 0.5 ? TRUNK_COL.root : d < -TRUNK_PLATE[1] * 0.45 ? (h < 0.25 ? TRUNK_COL.snowD : TRUNK_COL.snow) : h < 0.2 ? TRUNK_COL.root : TRUNK_COL.earth;
      if (pa * pa + pd * pd > 0.8) c = TRUNK_COL.rim;
    } else if (a >= 0 && a <= L + 3) {
      // the broken top: splinters of pale wood of their own lengths
      const end = L - 2 + hash2(seed + 7, Math.round(d)) * 5;
      const stub = TRUNK_STUBS.find(([sf, side]) => Math.abs(a - sf * L) <= 1 && d * side > r - 1 && d * side < r + 4);
      if (stub) c = ad >= r + 3 ? TRUNK_COL.rim : stub[1] < 0 ? TRUNK_COL.snowD : TRUNK_COL.dark;
      else if (ad <= r && a <= end) {
        // the load lies on top of the trunk: on one lying across the screen that is its upper half, on one
        // lying up the screen its middle, bark showing down both sides
        const cap = r * (TRUNK_CAP + TRUNK_CAP_IN * steep) + (vnoise(a / 4 + seed, 1.7) - 0.5) * 3 * (1 - steep * 0.6); // the snow cap's lower edge
        const capTop = -r + r * TRUNK_CAP_IN * steep; // and its upper one
        if (ad > r - 1.4) c = d < 0 ? (capTop < -r + 1.5 ? TRUNK_COL.capRim : TRUNK_COL.dark) : TRUNK_COL.rim; // an unbroken edge all the way round: the snow's own is blue, never the bark's dark
        else if (d < capTop) c = h < 0.3 ? TRUNK_COL.light : TRUNK_COL.mid; // the bark of its upper side, lit
        else if (a > end - 2) c = h < 0.3 ? TRUNK_COL.light : TRUNK_COL.wood; // the break's raw wood
        else if (d < cap) c = d > cap - TRUNK_CREST ? TRUNK_COL.snow : h < 0.12 ? TRUNK_COL.snow : TRUNK_COL.capSide; // the load's crest along the spine, white; its far side rounding away in shade
        else if (d < cap + 1.5) c = TRUNK_COL.light;
        else c = h < 0.08 ? TRUNK_COL.rim : d > r * 0.55 ? TRUNK_COL.dark : h < 0.35 ? TRUNK_COL.dark : TRUNK_COL.mid;
      } else if (a <= end && d > r && d < r + 5 - f * 2) c = TRUNK_SHADE; // its shade, off the lower side
      else if (a <= end && d < -r) {
        // the drift banked on its upper side, highest at the middle
        const top = r + 1 + 4 * Math.sin(Math.PI * Math.min(1, a / L)) * (0.7 + vnoise(a / 6, seed) * 0.5);
        if (-d < r + 1.5) c = TRUNK_COL.snowD; // the crease where the drift meets the bark
        else if (-d < top - 1.5) c = TRUNK_COL.snow;
        else if (-d < top) c = TRUNK_COL.drift;
      }
    }
    if (c) penDot(g, c, px + x, py + y);
  }
  penFlush();
}
// the flagstone a pixel lies on: a jittered grid of `cell` px,
// each pixel the nearest point's stone. Returns that stone's roll, the gap
// to the next stone (px: under 1 is the joint) and which way the pixel lies
// from the stone's middle (lx + ly < 0 faces the light, up-left)
// The road's own grid (ROAD_FLAG, jitter ROAD_FLAG_JIT) keeps each cell's
// middle and roll once worked out (roadCellAt): a bake asks every cell's
// hashes for each of the nine pixels round it many times over
const ROAD_FLAG_JIT = 0.8, ROAD_CELLS = Math.ceil(WORLD * TILE / ROAD_FLAG) + 3;
const roadCells = new Float64Array(ROAD_CELLS * ROAD_CELLS * 3).fill(NaN);
function roadCellAt(cx, cy) {
  const k = ((cy + 1) * ROAD_CELLS + cx + 1) * 3;
  if (roadCells[k] !== roadCells[k]) {
    const h = hash2(cx + 501, cy + 907), h2 = hash2(cx + 133, cy + 71);
    roadCells[k] = h;
    roadCells[k + 1] = (cx + 0.5 + (h - 0.5) * ROAD_FLAG_JIT) * ROAD_FLAG;
    roadCells[k + 2] = (cy + 0.5 + (h2 - 0.5) * ROAD_FLAG_JIT) * ROAD_FLAG;
  }
  return k;
}
function roadStoneAt(wx, wy, cell, jit) {
  const cx = Math.floor(wx / cell), cy = Math.floor(wy / cell), X = wx + 0.5, Y = wy + 0.5;
  const own = cell === ROAD_FLAG && jit === ROAD_FLAG_JIT && cx >= 0 && cy >= 0 && cx < ROAD_CELLS - 3 && cy < ROAD_CELLS - 3;
  // the nearest two middles by their squared distance; the root is taken of those two alone
  let q1 = 1e18, q2 = 1e18, id = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    let h, fx, fy;
    if (own) { const k = roadCellAt(cx + i, cy + j); h = roadCells[k]; fx = roadCells[k + 1]; fy = roadCells[k + 2]; } else {
      h = hash2(cx + i + 501, cy + j + 907);
      const h2 = hash2(cx + i + 133, cy + j + 71);
      fx = (cx + i + 0.5 + (h - 0.5) * jit) * cell; fy = (cy + j + 0.5 + (h2 - 0.5) * jit) * cell;
    }
    const q = (X - fx) * (X - fx) + (Y - fy) * (Y - fy);
    if (q < q1) { q2 = q1; q1 = q; id = h; x2 = x1; y2 = y1; x1 = fx; y1 = fy; } else if (q < q2) { q2 = q; x2 = fx; y2 = fy; }
  }
  return { id, gap: Math.hypot(X - x2, Y - y2) - Math.hypot(X - x1, Y - y1), lx: X - x1, ly: Y - y1, x1, y1, x2, y2 };
}
// ONE TILE'S MEMO. A tile's bake asks the same thing many times over: every
// pixel of a stone asks whether that stone is laid and whether it is trodden,
// and a pixel beside the path asks a dozen neighbours whether they are paved
// (roadLipAt). paintRoadOverlay opens the memo for the tile it paints and
// shuts it after, so each answer is worked out once a tile and none outlives
// the tile: a pad laid later (addPad) is never read stale. A chunk's bake
// (bakeGroundChunk, js/draw/ground.js) holds one memo open over the whole
// chunk instead (roadMemoChunk), so a stone or a lip pixel shared by two
// tiles is worked out once. Outside a bake every reader gets the plain answer.
const ROAD_MEMO_PAD = 3, ROAD_MEMO_MAX = GROUND_CHUNK * TILE + 2 * ROAD_MEMO_PAD; // px round the tile a lip pixel reaches (ROAD_LIP_LIT, ROAD_LIP_SHD)
const roadMemo = { on: false, chunk: false, x: 0, y: 0, w: 0, h: 0, paved: new Uint8Array(ROAD_MEMO_MAX * ROAD_MEMO_MAX), dist: new Float64Array(ROAD_MEMO_MAX * ROAD_MEMO_MAX), laid: new Map(), worn: new Map() };
// open the memo over a w x h px box from (px, py)
function roadMemoOpen(px, py, w, h) {
  roadMemo.on = true; roadMemo.x = px - ROAD_MEMO_PAD; roadMemo.y = py - ROAD_MEMO_PAD;
  roadMemo.w = w + 2 * ROAD_MEMO_PAD; roadMemo.h = h + 2 * ROAD_MEMO_PAD;
  const n = roadMemo.w * roadMemo.h;
  roadMemo.paved.fill(0, 0, n); roadMemo.dist.fill(NaN, 0, n); roadMemo.laid.clear(); roadMemo.worn.clear();
}
// a chunk's bake: open over its tiles (on), or shut (off)
function roadMemoChunk(on, px, py, w, h) {
  roadMemo.chunk = on;
  if (on) roadMemoOpen(px, py, w, h); else roadMemo.on = false;
}
// world pixel (wx, wy)'s place in the open memo, -1 outside it or with none open
function roadMemoAt(wx, wy) {
  const i = wx - roadMemo.x, j = wy - roadMemo.y;
  return roadMemo.on && i >= 0 && j >= 0 && i < roadMemo.w && j < roadMemo.h ? j * roadMemo.w + i : -1;
}
// a world pixel's lane distance (tiles, at its middle)
function roadPxDist(wx, wy) {
  const m = roadMemoAt(wx, wy);
  if (m < 0) return laneDist((wx + 0.5) / TILE - 0.5, (wy + 0.5) / TILE - 0.5);
  let d = roadMemo.dist[m];
  if (d !== d) d = roadMemo.dist[m] = laneDist((wx + 0.5) / TILE - 0.5, (wy + 0.5) / TILE - 0.5);
  return d;
}
// a stone's answer by its middle, (x, y) world px: once a tile while the memo is open
function roadMemoStone(map, f, x, y) {
  if (!roadMemo.on) return f(x, y);
  const k = x * 8192 + y; // a stone's middle is its own: no two share one
  let v = map.get(k);
  if (v === undefined) { v = f(x, y); map.set(k, v); }
  return v;
}
// is the stone whose middle is (x, y) world px part of the path: its middle inside the edge
function roadStoneIn(x, y) { return laneDist(x / TILE - 0.5, y / TILE - 0.5) < -0.12; }
// is this world pixel paved: the path's last stones are laid WHOLE, each in
// by its middle (roadStoneIn), so the edge goes round a stone and never cuts
// through one. No stone reaches ROAD_STONE_REACH tiles from the lane's line
// (the farthest on the map is 0.875), so past it the side of the line answers
const ROAD_STONE_REACH = 1;
function roadPavedAt(wx, wy) {
  const m = roadMemoAt(wx, wy);
  if (m >= 0 && roadMemo.paved[m]) return roadMemo.paved[m] === 1;
  const pv = roadPavedBy(roadPxDist(wx, wy), wx, wy, null);
  if (m >= 0) roadMemo.paved[m] = pv ? 1 : 2;
  return pv;
}
// ...for a caller that already holds the pixel's lane distance (and its stone, or null)
function roadPavedBy(d, wx, wy, st) {
  if (d <= -ROAD_STONE_REACH) return true;
  if (d >= ROAD_STONE_REACH) return false;
  if (!st) st = roadStoneAt(wx, wy, ROAD_FLAG, 0.8);
  return roadMemoStone(roadMemo.laid, roadStoneIn, st.x1, st.y1);
}
// what an unpaved pixel beside the path wears: 1 the earth round the last
// stone (a paved pixel touches it), 2 the snow's lip facing the light (paving
// within ROAD_LIP down-right of it), 3 the lip facing away, 0 nothing
const ROAD_LIP_LIT = [[2, 2], [3, 0], [0, 3], [2, 0], [0, 2]], ROAD_LIP_SHD = [[-2, -2], [-3, 0], [0, -3], [-2, 0], [0, -2], [2, -2], [-2, 2]];
function roadLipAt(wx, wy) {
  if (roadPavedAt(wx + 1, wy) || roadPavedAt(wx - 1, wy) || roadPavedAt(wx, wy + 1) || roadPavedAt(wx, wy - 1)) return 1;
  for (const [i, j] of ROAD_LIP_LIT) if (roadPavedAt(wx + i, wy + j)) return 2;
  for (const [i, j] of ROAD_LIP_SHD) if (roadPavedAt(wx + i, wy + j)) return 3;
  return 0;
}
// a stone's own pixel: three greys by its roll, a lit rim toward the light
// and a shaded one away from it, the joint dark. Paving WEARS with use, a
// whole stone at a time and in flat tones: `worn` (the caller's, for a stone
// in a lane's trodden middle: roadWorn) sits its face a step darker; one
// stone in a few dozen is CRACKED (a dark line through its middle, on a
// bearing of its own) and one SUNKEN (its face a step darker, its lit rim
// in shade), both off the stone's own roll, so the same stone is the same on
// every screen
const ROAD_CRACKED = 0.035, ROAD_SUNKEN = 0.03; // the share of stones cracked, and sunken
function roadStonePx(st, joint, worn) {
  if (st.gap < 1.1) return joint;
  const base = st.id < 0.33 ? 0 : st.id < 0.66 ? 1 : 2, w = hash2(st.x1 * 3.7 + 11, st.y1 * 5.3 + 29);
  if (w < ROAD_CRACKED) {
    const a = w / ROAD_CRACKED * Math.PI; // the crack's bearing
    if (Math.abs(st.lx * Math.sin(a) - st.ly * Math.cos(a)) < 0.6 && st.gap >= 2.1) return ROAD_STONE_SHD[base];
  }
  const sunk = w > 1 - ROAD_SUNKEN;
  if (st.gap < 2.1) return st.lx + st.ly < 0 && !sunk ? ROAD_STONE_LIT[base] : ROAD_STONE_SHD[base];
  return sunk || worn ? ROAD_STONE_WORN[base] : ROAD_STONE_MID[base];
}
// is the stone whose middle is (x, y) world px in a lane's trodden middle:
// ROAD_WORN_IN tiles inside the edge, the track's own edge wandering on a
// slow noise so it is a path worn by feet, not a stripe
const ROAD_WORN_IN = 1.5, ROAD_WORN_RAG = 0.9;
function roadWorn(x, y) {
  return laneDist(x / TILE - 0.5, y / TILE - 0.5) + (vnoise(x / 45 + 3.5, y / 45 + 8.5) - 0.5) * ROAD_WORN_RAG < -ROAD_WORN_IN;
}
// snow dusted into the joints by the path's edge: within ROAD_DUST tiles of
// it, in patches
const ROAD_DUST = 0.9;
function roadDusted(wx, wy, d) { return d > -ROAD_DUST && vnoise(wx / 5 + 1.5, wy / 5 + 6.5) > 0.42 + (-d / ROAD_DUST) * 0.3; }
const ROAD_STONE_LIT = ['#b9b4aa', '#b2ab9c', '#c0bab0'];
const ROAD_STONE_MID = ['#9f9a90', '#999283', '#a7a197'];
const ROAD_STONE_SHD = ['#7f7a71', '#7a7365', '#86817a'];
const ROAD_STONE_WORN = ['#928d83', '#8c8577', '#99938a']; // a trodden stone's face: between the mid and the shade
// dry grass through the snow at the verge, in cells of 8 px. It comes up in
// CLUMPS (a slow noise ROAD_TUFT_CLUMP cells across: thick where it is high,
// a stray sprig elsewhere), and each cell's sprig is one of ROAD_TUFTS, mirrored
// on half of them: a full tuft, a tall one, and two small ones
const ROAD_TUFTS = [['.g..', '.g.g', 'gdgd', '.dd.'], ['..g.', 'g.g.', 'gdg.', '.dd.', '.d..'], ['g.g', '.d.'], ['.g.', 'gd.']];
const ROAD_TUFT_CLUMP = 4;                       // cells across a clump
const ROAD_TUFT_THICK = 0.5, ROAD_TUFT_THIN = 0.04; // share of cells holding a sprig, in a clump and out of one
function roadTuftAt(wx, wy) {
  const cx = Math.floor(wx / 8), cy = Math.floor(wy / 8), h = hash2(cx * 8 + 11, cy * 8 + 1);
  const thick = vnoise(cx / ROAD_TUFT_CLUMP + 9.5, cy / ROAD_TUFT_CLUMP + 2.5) > 0.56;
  if (h > (thick ? ROAD_TUFT_THICK : ROAD_TUFT_THIN)) return null;
  const r = hash2(cx * 8 + 3, cy * 8 + 17), T = ROAD_TUFTS[(r * 97 | 0) % ROAD_TUFTS.length], w = T[0].length;
  const ox = wx - cx * 8 - 1 - (r * 900 | 0) % 3, oy = wy - cy * 8 - 1 - (r * 2100 | 0) % 3;
  const ch = ox >= 0 && ox < w && oy >= 0 && oy < T.length ? T[oy][r < 0.5 ? ox : w - 1 - ox] : '.';
  return ch === 'g' ? ROAD_COL_GRASS : ch === 'd' ? ROAD_COL_GRASS_D : null;
}
const ROAD_INNER = 2.4; // tiles inside the edge a tile's middle and corners must all lie for its paint to skip the edge's work
function roadInner(tx, ty) {
  for (const [i, j] of [[0, 0], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) if (laneDist(tx + i, ty + j) >= -ROAD_INNER) return false;
  return true;
}
function paintRoadOverlay(g, tx, ty, px, py, onIce) {
  const own = !roadMemo.chunk; // a chunk's bake holds its own memo open
  if (own) roadMemoOpen(px, py, TILE, TILE);
  // a tile deep in the paving (its middle and corners all ROAD_INNER inside the
  // edge) has no pixel the edge reaches: every one is a stone, and none asks its own distance
  const inner = roadInner(tx, ty);
  for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    const wx = px + i, wy = py + j;
    const d = inner ? -ROAD_INNER : roadPxDist(wx, wy); // ...which ends on the cistern's gates (js/sim/world.js)
    if (d >= ROAD_SHOULDER) continue;
    let c = null;
    // the stone under the pixel; near the edge the path's own line decides (roadPavedAt)
    const near = d > -1.1 && d < 1.1;
    const st = d < 1.1 ? roadStoneAt(wx, wy, ROAD_FLAG, 0.8) : null;
    const pv = near ? roadPavedBy(d, wx, wy, st) : d < 0, lipAt = near && !pv ? roadLipAt(wx, wy) : 0;
    if (pv) {
      // a flagstone, earth in its joints
      c = roadStonePx(st, !onIce && roadDusted(wx, wy, d) ? ROAD_COL_SNOW : ROAD_COL_DEEP, roadMemoStone(roadMemo.worn, roadWorn, st.x1, st.y1));
      // a drift lapping over the stones by the edge: a clean clump of snow,
      // its shade on the stone below and right of it
      if (near && !onIce && st.gap >= 1.1) {
        const lap = (x, y) => vnoise(x / 7 + 3.1, y / 7 + 7.7) > 0.8 - (laneDist(x / TILE - 0.5, y / TILE - 0.5) + 1.1) * 0.12;
        if (d > -0.5 && lap(wx, wy)) c = ROAD_COL_SNOW;
        else if (d > -0.6 && lap(wx - 1, wy - 1)) c = ROAD_COL_LAP_SHD;
      }
    } else if (lipAt === 1) {
      c = ROAD_COL_DEEP; // the earth round the path's last stones
    } else if (lipAt) {
      // the snow's lip (on ice, the broken rim): it faces the light where the stone lies down-right of it
      c = onIce ? ROAD_COL_RIM : lipAt === 2 ? ROAD_COL_LIP : ROAD_COL_LIP_SHD;
    } else if (!onIce) { // (open ice past the crossing's rim is the lake's own pixels)
      // the shoulder: snow greyed by the march in patches thinning to the
      // field, dry grass poking through it
      // the drift field: snow lies on the verge and mud spreads off it in
      // CLUMPS, not as per-pixel static - a low-frequency noise read per pixel,
      // so the melt reads as patches of snow and mud rather than sand
      const k = 1 - Math.max(0, d) / ROAD_SHOULDER;
      if (vnoise(wx / 6 + 3.1, wy / 6 + 7.7) < k * k * 0.7 - 0.05) c = ROAD_COL_GREY;
      if (d < 0.9) c = roadTuftAt(wx, wy) || c;
    }
    if (c) penDot(g, c, wx, wy);
  }
  if (own) roadMemo.on = false;
  penFlush();
}

