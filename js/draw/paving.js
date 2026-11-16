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

