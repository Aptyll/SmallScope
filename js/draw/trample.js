'use strict';
// Trampled snow: the snowfield as a record of the match. A coarse grid over
// the world holds how PACKED and how CHURNED each 4 px patch of snow is;
// every body that walks packs it, every blow, knockback, roll and death
// churns it, and fresh snow fills all of it back in, faster while it snows.
// Visual only, and fed from what every peer already has (positions, hp, the
// knockback), so a client's field is its own and costs nothing on the wire.
// The footprints and slide trails (sim.js) stay the crisp, short-lived
// detail drawn over it; this is the slow memory under them.
// ------------------------------------------------------------ trampled snow
const TR_CELL = 4;                          // world px per grid cell
const TR_W = WORLD * TILE / TR_CELL;        // cells per side
const TR_CH = 32;                           // cells per chunk side (a chunk is 128 world px)
const TR_CPX = TR_CH * TR_CELL;             // ...in world px
const TR_NCH = Math.ceil(TR_W / TR_CH);     // chunks per side
const TR_STEP = 4;                          // px a body travels between stamps
const TR_WALK = 0.05;                       // pack per stamp: one pass ~0.1, twenty make a hard path
const TR_SLIDE = 0.04;                      // a slide's two runners press less than a stride
const TR_CRAWL = 0.07;                      // a belly drags a broad trough
const TR_ROLL = 0.05;                       // churn per stamp of a roll
const TR_SHOVE = 0.04;                      // churn per stamp while knocked back
const TR_SHOVE_V = 40;                      // knockback speed (px/s) that throws snow about
const TR_HIT = 0.025;                       // churn per point of damage taken...
const TR_HIT_MAX = 0.45;                    // ...up to this for one blow
const TR_DEATH = 0.7;                       // a body going down
// Refill is LINEAR, the way snowfall fills a hollow: a constant depth per
// second. At light snow a one-pass trail (~0.1) is gone in about ninety
// seconds and a packed road (1.0) takes a quarter of an hour, so what a
// match walks keeps showing for as long as it keeps walking it.
const TR_FILL = 0.0011;                     // pack refilled per second at light snow
const TR_FILL_CHURN = 1.6;                  // churned snow slumps back faster than packed snow lifts
const TR_REFILL_T = 1.5;                    // s between refill passes over one chunk
const TR_SNOW_LIGHT = 0.35;                 // the snowfall level (0 calm .. 1 blizzard) until weather sets one
const TR_POOL = 72;                         // chunk canvases kept at most
const TR_BUILDS = 2;                        // chunk repaints a frame may spend
const TR_REPAINT = 12;                      // frames a chunk waits between repaints

const trPack = new Float32Array(TR_W * TR_W);
const trChurn = new Float32Array(TR_W * TR_W);
const trChunks = new Array(TR_NCH * TR_NCH).fill(null); // { live, t, dirty, mask, cv, img, seen }
const trLive = [];                                      // chunk indices holding any trample
const trSeen = new WeakMap();                           // body -> { x, y, d, hp, dead }
let trTurn = 0, trFrame = 0, trCanvases = 0;

// How hard it is snowing, 0 (calm) .. 1 (blizzard): the one seam the
// weather feeds. Calm still refills slowly (wind drift); a blizzard ~2.3x.
function trampleSnowfall() { return TR_SNOW_LIGHT; }
function trFillMul() { return (0.3 + 2 * trampleSnowfall()) / (0.3 + 2 * TR_SNOW_LIGHT); }

function trChunk(ci) {
  let c = trChunks[ci];
  if (!c) {
    c = trChunks[ci] = { live: false, t: 0, dirty: true, mask: null, cv: null, img: null, seen: 0, painted: 0 };
  }
  if (!c.live) { c.live = true; c.t = 0; trLive.push(ci); }
  c.dirty = true;
  trDustHot.add(ci);
  return c;
}

// press a disc of radius r (world px) round (x, y): pack and churn at its
// centre, falling off to nothing at its rim
function trStamp(x, y, r, pack, churn) {
  const c0 = Math.max(0, Math.floor((x - r) / TR_CELL)), c1 = Math.min(TR_W - 1, Math.floor((x + r) / TR_CELL));
  const r0 = Math.max(0, Math.floor((y - r) / TR_CELL)), r1 = Math.min(TR_W - 1, Math.floor((y + r) / TR_CELL));
  const rr = r + TR_CELL * 0.5;
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const d = Math.hypot((cx + 0.5) * TR_CELL - x, (cy + 0.5) * TR_CELL - y);
    if (d >= rr) continue;
    const k = 1 - d / rr, i = cy * TR_W + cx;
    if (pack) trPack[i] = Math.min(1, trPack[i] + pack * k);
    if (churn) trChurn[i] = Math.min(1, trChurn[i] + churn * k);
    trChunk(((cy / TR_CH) | 0) * TR_NCH + ((cx / TR_CH) | 0));
  }
}

// one body's share of the frame: how far it went, and whether it was hurt,
// shoved or felled since the last look. `foot` is where its feet are.
function trBody(e, foot, r, pack) {
  let s = trSeen.get(e);
  const fy = e.y + foot;
  if (!s) { trSeen.set(e, { x: e.x, y: fy, d: 0, hp: e.hp, dead: !!e.dead }); return; }
  if (e.dead) {
    if (!s.dead) trStamp(s.x, s.y, r + 5, TR_DEATH * 0.4, TR_DEATH);
    s.dead = true; s.hp = e.hp;
    return;
  }
  s.dead = false;
  if (typeof e.hp === 'number' && typeof s.hp === 'number' && e.hp < s.hp) {
    trStamp(e.x, fy, r + 4, 0, Math.min(TR_HIT_MAX, (s.hp - e.hp) * TR_HIT));
  }
  s.hp = e.hp;
  const dx = e.x - s.x, dy = fy - s.y, d = Math.hypot(dx, dy);
  if (d > 40) { s.x = e.x; s.y = fy; s.d = 0; return; } // a teleport, a landing, a respawn: no smear between
  s.d += d; s.x = e.x; s.y = fy;
  if (s.d < TR_STEP) return;
  s.d -= TR_STEP;
  if (s.d > TR_STEP) s.d = 0; // a long frame stamps once, not a line of them
  const kb = Math.hypot(e.kbx || 0, e.kby || 0);
  const roll = e.dodgeT > 0;
  trStamp(e.x, fy, roll ? r + 2 : r, roll ? pack * 0.5 : pack, (roll ? TR_ROLL : 0) + (kb > TR_SHOVE_V ? TR_SHOVE : 0));
}

// every body on the snow, every frame the world moves (both sides of the
// wire: a client reads the same positions it draws)
function trampleStep(dt) {
  if (state.mode === 'title') return;
  for (const p of players) {
    if (!p.active || inAir(p) || p.zip >= 0) continue;
    // the same reads the footprint emitter makes (updatePlayer, sim.js): a
    // crawl drags wide, a slide rides two runners, a walk presses a stride
    const pack = p.prone ? TR_CRAWL : p.sliding ? TR_SLIDE : TR_WALK;
    trBody(p, 5, p.prone ? PLAYER_R + 2 : PLAYER_R, pack);
  }
  for (const a of animals) {
    if (a.kind === 'bird') continue;
    const r = unitRadius(a), big = a.kind === 'deer' || (MONSTER[a.kind] && MONSTER[a.kind].big);
    trBody(a, 0, r, big ? TR_WALK * 1.4 : r < 3 ? TR_WALK * 0.35 : TR_WALK);
  }
  for (const b of robots) trBody(b, 0, unitRadius(b), TR_WALK * 0.8);
  trRefill(dt);
  trDustSync(dt);
}

// fresh snow over a few live chunks a frame, round-robin: each chunk is
// refilled every TR_REFILL_T with the time it waited, and drops off the live
// list once it is all white again
function trRefill(dt) {
  for (const ci of trLive) trChunks[ci].t += dt;
  let n = Math.min(trLive.length, 4);
  while (n-- > 0 && trLive.length) {
    trTurn = trTurn % trLive.length;
    const ci = trLive[trTurn], c = trChunks[ci];
    if (c.t < TR_REFILL_T) { trTurn++; continue; }
    const fp = TR_FILL * trFillMul() * c.t, fc = fp * TR_FILL_CHURN;
    c.t = 0;
    const x0 = (ci % TR_NCH) * TR_CH, y0 = ((ci / TR_NCH) | 0) * TR_CH;
    const x1 = Math.min(TR_W, x0 + TR_CH), y1 = Math.min(TR_W, y0 + TR_CH);
    let any = false;
    for (let y = y0; y < y1; y++) for (let i = y * TR_W + x0, e = y * TR_W + x1; i < e; i++) {
      if (trPack[i] > 0) { trPack[i] = trPack[i] > fp ? trPack[i] - fp : 0; any = true; }
      if (trChurn[i] > 0) { trChurn[i] = trChurn[i] > fc ? trChurn[i] - fc : 0; any = true; }
    }
    c.dirty = true;
    if (!any) { c.live = false; trLive.splice(trTurn, 1); trDustLast.push(ci); } else trTurn++;
  }
}

// how trodden world pixel (x, y) is, 0 .. 1: packed or churned, whichever
// is more, read bilinearly like the pixels are. The one read another layer
// takes (the snow dusting the ice thins under it, and comes back as this
// refills)
function trampleAt(x, y) {
  const u = Math.max(0, (x + 0.5) / TR_CELL - 0.5), v = Math.max(0, (y + 0.5) / TR_CELL - 0.5);
  const cx = Math.min(TR_W - 1, Math.floor(u)), cy = Math.min(TR_W - 1, Math.floor(v));
  const cx1 = Math.min(TR_W - 1, cx + 1), cy1 = Math.min(TR_W - 1, cy + 1), fu = u - cx, fv = v - cy;
  const rd = (g) => (g[cy * TR_W + cx] * (1 - fu) + g[cy * TR_W + cx1] * fu) * (1 - fv) + (g[cy1 * TR_W + cx] * (1 - fu) + g[cy1 * TR_W + cx1] * fu) * fv;
  return Math.min(1, Math.max(rd(trPack), rd(trChurn)));
}

// ---- the dust on the ice ------------------------------------------------------
// The snow lying on the ice is the lakes' layer (iceDust, js/draw/lakes.js),
// baked into the ground. It reads `trampleAt` per pixel and thins under it,
// so this side only says WHEN: being baked, a tile shows the change once
// the lakes repaint it (`iceDustInvalidate`). A few chunks a scan, each lake tile
// in them (every chunk stamped since the last scan, and a couple more for
// the refill) sums the trample over a 4 px lattice, and a tile whose sum moved
// a step goes on the repaint queue, handed over TR_DUST_PAINTS a frame. A
// chunk that refills to white is scanned once more, so its dust comes back.
const TR_DUST_T = 0.25;                     // s between scans
const TR_DUST_CHUNKS = 2;                   // live chunks a scan looks over
const TR_DUST_PAINTS = 2;                   // tiles repainted a frame
const trDustSig = new Map();                // lake tile index -> the trample sum it was baked at
const trDustQ = [], trDustLast = [];
const trDustHot = new Set();              // chunks stamped since the last scan
let trDustT = 0, trDustTurn = 0;
const trDustLayer = () => typeof iceDustInvalidate === 'function'; // the lakes' dust is on this build
function trDustScan(ci) {
  const tx0 = (ci % TR_NCH) * (TR_CPX / TILE), ty0 = ((ci / TR_NCH) | 0) * (TR_CPX / TILE);
  for (let ty = ty0; ty < ty0 + TR_CPX / TILE; ty++) for (let tx = tx0; tx < tx0 + TR_CPX / TILE; tx++) {
    if (!isLake(tx, ty)) continue;
    let n = 0;
    for (let j = 2; j < TILE; j += 4) for (let i = 2; i < TILE; i += 4) n += trampleAt(tx * TILE + i, ty * TILE + j);
    n = Math.round(n * 4); // how trodden, in steps fine enough that any new scuff moves it
    const ti = idx(tx, ty), was = trDustSig.get(ti) || 0;
    if (n === was) continue;
    if (n) trDustSig.set(ti, n); else trDustSig.delete(ti);
    if (!trDustQ.includes(ti)) trDustQ.push(ti);
  }
}
function trDustSync(dt) {
  if (!trDustLayer()) return;
  if ((trDustT += dt) >= TR_DUST_T) {
    trDustT = 0;
    while (trDustLast.length) trDustScan(trDustLast.pop());
    for (const ci of trDustHot) trDustScan(ci);
    trDustHot.clear();
    for (let k = 0; k < Math.min(TR_DUST_CHUNKS, trLive.length); k++) trDustScan(trLive[trDustTurn++ % trLive.length]);
  }
  for (let k = 0; k < TR_DUST_PAINTS && trDustQ.length; k++) {
    const ti = trDustQ.shift(), x = (ti % WORLD) * TILE, y = ((ti / WORLD) | 0) * TILE;
    iceDustInvalidate(x, y, x + TILE, y + TILE);
  }
}

// a tile's ground was repainted (an ice hole opened or froze): the chunks
// over it re-read what their pixels are standing on
function trampleGroundChanged(tx, ty) {
  const x0 = Math.floor(((tx - 1) * TILE) / TR_CPX), x1 = Math.floor(((tx + 2) * TILE - 1) / TR_CPX);
  const y0 = Math.floor(((ty - 1) * TILE) / TR_CPX), y1 = Math.floor(((ty + 2) * TILE - 1) / TR_CPX);
  for (let cy = Math.max(0, y0); cy <= Math.min(TR_NCH - 1, y1); cy++)
    for (let cx = Math.max(0, x0); cx <= Math.min(TR_NCH - 1, x1); cx++) {
      const c = trChunks[cy * TR_NCH + cx];
      if (c) { c.mask = null; c.dirty = true; }
    }
}

// What each pixel of a chunk stands on, read the way the bake painted it:
// 1 snow, 2 ice (the lake's own ragged edge, iceAtPx), 0 anything that
// does not trample - open water, the creek and its deck, the road's earth.
// Most tiles are open snow with nothing near, and answer for all 256 pixels
// at once; only a tile by a lake, the creek or a road asks per pixel.
function trMask(ci) {
  const m = new Uint8Array(TR_CPX * TR_CPX);
  const px0 = (ci % TR_NCH) * TR_CPX, py0 = ((ci / TR_NCH) | 0) * TR_CPX;
  const T = TR_CPX / TILE;
  for (let tj = 0; tj < T; tj++) for (let ti = 0; ti < T; ti++) {
    const tx = px0 / TILE + ti, ty = py0 / TILE + tj;
    if (!inWorld(tx, ty)) continue;
    let lake = false;
    for (let dy = -1; dy <= 1 && !lake; dy++) for (let dx = -1; dx <= 1; dx++) if (isLake(tx + dx, ty + dy)) { lake = true; break; }
    const creek = creekNear(tx, ty), road = ground[idx(tx, ty)] === 3 || roadDist(tx, ty) < 1.5;
    const plain = !lake && !creek && !road;
    for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
      const o = (tj * TILE + j) * TR_CPX + ti * TILE + i;
      if (plain) { m[o] = 1; continue; }
      const x = px0 + ti * TILE + i, y = py0 + tj * TILE + j;
      const fx = tx + (i + 0.5) / TILE - 0.5, fy = ty + (j + 0.5) / TILE - 0.5;
      if (creek && (creekAt(fx, fy) < 0.15 || paintsDeck(tx, ty))) continue;
      if (road && roadDist(fx, fy) < 0) continue;
      if (lake && iceAtPx(x, y)) { if (ground[idx(Math.floor(x / TILE), Math.floor(y / TILE))] !== 2) m[o] = 2; continue; }
      m[o] = 1;
    }
  }
  return m;
}
function paintsDeck(tx, ty) { return Math.abs(creekP(tx, ty)) < BRIDGE_L + 1.2 && Math.abs(roadOffS(tx, ty)) < BRIDGE_W + 1.6; }

// ---- the trample's pixels ----------------------------------------------------
// Drawn at the world's own pixel, in flat shades, dithered on the world's
// 4x4 Bayer grid (BAYER4, ground.js) so the edge of a path breaks up into
// the same pattern the drifts do and never smears. Snow packs through three
// shades of pressed grey-blue laid over the drift (so the drift's own
// shading still reads through a path); churned snow is thrown clods, each a
// dark pit with the lit lump it threw up on its top side, lit from the
// top-left like the rest of the art. Ice has no snow to pack: a body on it
// only scuffs frost into the sheet (the skate scratch's colour, sim.js),
// sparse and capped, so a lake never greys over. Water shows nothing.
const TR_PACK_COL = [null, [146, 158, 184, 0.2], [134, 146, 174, 0.32], [120, 132, 162, 0.44]];
const TR_PIT = [92, 114, 156, 0.5], TR_LUMP = [252, 254, 255, 0.7];
const TR_FROST = [238, 250, 255, 0.5];
const trRowAny = new Uint8Array(TR_CH + 2);
function trPut(d, o, c) {
  // premultiply-free over: the chunk is transparent everywhere else
  d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = (c[3] * 255) | 0;
}
function trPaint(ci, c) {
  if (!c.mask) c.mask = trMask(ci);
  if (!c.cv) {
    c.cv = document.createElement('canvas');
    c.cv.width = c.cv.height = TR_CPX;
    c.img = new ImageData(TR_CPX, TR_CPX);
    trCanvases++;
  }
  const d = c.img.data, m = c.mask;
  d.fill(0);
  const gx0 = (ci % TR_NCH) * TR_CH, gy0 = ((ci / TR_NCH) | 0) * TR_CH;
  const px0 = gx0 * TR_CELL, py0 = gy0 * TR_CELL;
  // which cell rows round the chunk hold anything, so a pixel row whose two
  // rows are both white is skipped whole (most of a chunk, most of the time)
  const cx0 = Math.max(0, gx0 - 1), cx1 = Math.min(TR_W, gx0 + TR_CH + 1);
  for (let r = 0; r < TR_CH + 2; r++) {
    const cy = gy0 - 1 + r;
    let any = 0;
    if (cy >= 0 && cy < TR_W) for (let i = cy * TR_W + cx0, e = cy * TR_W + cx1; i < e && !any; i++) any = trPack[i] > 0.01 || trChurn[i] > 0.01 ? 1 : 0;
    trRowAny[r] = any;
  }
  for (let j = 0; j < TR_CPX; j++) {
    const y = py0 + j;
    // the cell centres either side of this row, for the bilinear read
    const v = (y + 0.5) / TR_CELL - 0.5, cy = Math.max(0, Math.floor(v)), cy1 = Math.min(TR_W - 1, cy + 1), fv = Math.max(0, v - cy);
    if (!trRowAny[cy - gy0 + 1] && !trRowAny[cy1 - gy0 + 1]) continue;
    for (let i = 0; i < TR_CPX; i++) {
      const o = j * TR_CPX + i, s = m[o];
      if (!s) continue;
      const x = px0 + i;
      const u = (x + 0.5) / TR_CELL - 0.5, cx = Math.max(0, Math.floor(u)), cx1 = Math.min(TR_W - 1, cx + 1), fu = Math.max(0, u - cx);
      const a = cy * TR_W + cx, b = cy * TR_W + cx1, e = cy1 * TR_W + cx, f = cy1 * TR_W + cx1;
      const p = (trPack[a] * (1 - fu) + trPack[b] * fu) * (1 - fv) + (trPack[e] * (1 - fu) + trPack[f] * fu) * fv;
      const ch = (trChurn[a] * (1 - fu) + trChurn[b] * fu) * (1 - fv) + (trChurn[e] * (1 - fu) + trChurn[f] * fu) * fv;
      if (p < 0.01 && ch < 0.01) continue;
      const t = BAYER4[(y & 3) * 4 + (x & 3)] + 0.47; // 0 .. 15/16
      if (s === 2) {
        if (trDustLayer()) continue; // the lakes' dust shows it: thinned where trodden
        const w = Math.min(0.35, p * 0.3 + ch * 0.5);
        if (hash2(x * 3 + 7, y * 5 + 1) < w) trPut(d, o * 4, TR_FROST);
        continue;
      }
      // a clod: a pit where the roll lands under the churn, the lump over it
      const cw = ch * 0.4;
      if (hash2(x * 13 + 5, y * 7 + 3) < cw) { trPut(d, o * 4, TR_PIT); continue; }
      if (hash2(x * 13 + 5, (y + 1) * 7 + 3) < cw) { trPut(d, o * 4, TR_LUMP); continue; }
      // pressed: the churned snow is trodden too, a little
      // the bands climb as p^0.6, so a few passes already read and a road
      // still has somewhere to go
      const band = Math.min(3, Math.floor(Math.pow(Math.max(p, ch * 0.5), 0.6) * 3 + t));
      if (band > 0) trPut(d, o * 4, TR_PACK_COL[band]);
    }
  }
  c.cv.getContext('2d').putImageData(c.img, 0, 0);
  c.dirty = false;
}

// under the footprints (render.js): every live chunk in view, repainted
// when its grid moved, a few a frame; the chunk canvases are pooled
function drawTrample(ox, oy) {
  trFrame++;
  const cx0 = Math.max(0, Math.floor(ox / TR_CPX)), cy0 = Math.max(0, Math.floor(oy / TR_CPX));
  const cx1 = Math.min(TR_NCH - 1, Math.floor((ox + WV_W) / TR_CPX)), cy1 = Math.min(TR_NCH - 1, Math.floor((oy + WV_H) / TR_CPX));
  let builds = TR_BUILDS;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const c = trChunks[cy * TR_NCH + cx];
    if (!c || (!c.live && !c.cv)) continue;
    // a chunk repaints at most every TR_REPAINT frames: the footprints carry
    // the moment, this only has to catch up with it
    if (c.dirty && builds > 0 && (!c.cv || trFrame - c.painted >= TR_REPAINT)) {
      builds--;
      if (!c.live) { c.cv = null; c.img = null; c.dirty = false; trCanvases--; continue; } // all white again
      trPaint(cy * TR_NCH + cx, c);
      c.painted = trFrame;
    }
    if (!c.cv) continue;
    c.seen = trFrame;
    ctx.drawImage(c.cv, cx * TR_CPX - ox, cy * TR_CPX - oy);
  }
  if (trCanvases > TR_POOL) trEvict();
}
// drop the canvases looked at longest ago (their grid stays; they repaint on return)
function trEvict() {
  const held = [];
  for (const c of trChunks) if (c && c.cv) held.push(c);
  held.sort((a, b) => a.seen - b.seen);
  for (let k = 0; k < held.length - TR_POOL; k++) {
    const c = held[k];
    c.cv = null; c.img = null; c.dirty = true; trCanvases--;
  }
}
