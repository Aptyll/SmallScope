// ---- footings ---------------------------------------------------------------
// What is built stands ON something: a road tower, a bay and the merchant's
// stall each stand on a round of the lane's own flagstones - the same stones
// on the same grid (roadStoneAt, js/draw/ground.js), so where a round meets
// the lane or the base's paving it is one piece - laid whole under a lip of
// snow like the lane's edge. Drawn on the snow under every body (render,
// after the flat pass) while the building stands; one canvas a building, made
// when it is first in view. A kind's round is its FOOTINGS row: the half
// width and half height in px, and where its foot is. A `kerb` round is
// built, not laid: its flagstones are cut on one clean ellipse and ringed by
// a kerb of dressed blocks (FOOT_KERB px wide), lit up-left and shaded
// down-right, under a pixel of snow lip, opening where it meets the lane.
const FOOTINGS = {
  tower: { rx: 50, ry: 25, at: (o) => towerFoot(o), kerb: true },
  barracks: { rx: 42, ry: 23, at: (o) => ({ x: (o.tx + structW(o) / 2) * TILE, y: (o.ty + structH(o)) * TILE - 8 }), kerb: true },
  roost: { rx: 88, ry: 76, kerb: true, over: true, kerbW: 6, block: 15 }, // round a roost's pad, wide of its stones, drawn over the paving (roostFootingOf)
  stall: { rx: 56, ry: 24, at: (o) => ({ x: (o.tx + OBJECTS.stall.w / 2) * TILE, y: (o.ty + 1) * TILE - 8 }) }, // its anchor is the front-left tile
};
const FOOT_PAD = 4; // px round the round for its lip
const FOOT_KERB = 3; // px a kerbed round's ring of blocks is wide...
const FOOT_KERB_BLOCK = 9; // ...and px a block runs along it
const FOOT_KERB_COL = { lit: '#c3beb4', mid: '#a49f95', shd: '#7d786f', joint: '#6b6459' };
const FOOT_JOIN = 8; // px of snow between a kerb and the lane's paving that are paved over, so the two meet
const footingCvs = new Map(); // a building's tile index -> its round
function footingOf(o) {
  const key = idx(o.tx, o.ty);
  let c = footingCvs.get(key);
  if (c && c.kind === o.type) return c;
  const F = FOOTINGS[o.type], f = F.at(o), W = (F.rx + FOOT_PAD) * 2, H = (F.ry + FOOT_PAD) * 2;
  c = document.createElement('canvas'); c.width = W; c.height = H; c.kind = o.type;
  c.wx = Math.round(f.x) - (W >> 1); c.wy = Math.round(f.y) - (H >> 1) + 1; // its top-left, world px
  const g = c.getContext('2d');
  // a stone is laid inside the round, on open ground: none under a pine, so the lip closes before the trees
  const round = (x, y) => {
    const u = (x - c.wx - W / 2) / (F.rx - 5), w = (y - c.wy - H / 2) / (F.ry - 4);
    if (u * u + w * w >= 1) return false;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), ob = inWorld(tx, ty) && objects[idx(tx, ty)];
    return !(ob && ob.type === 'tree');
  };
  if (F.kerb) paintKerbRound(g, F, c, W, H, [{ cx: c.wx + W / 2, cy: c.wy + H / 2, ax: F.rx - FOOT_PAD, ay: F.ry - FOOT_PAD }]);
  else for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = c.wx + x, wy = c.wy + y, st = roadStoneAt(wx, wy, ROAD_FLAG, 0.8);
    const r1 = round(st.x1, st.y1), r2 = round(st.x2, st.y2);
    const ob = objects[idx(Math.floor(wx / TILE), Math.floor(wy / TILE))];
    if (ob && ob.type === 'tree') continue; // under a pine: the forest's ground
    let col = null;
    if (r1) col = roadStonePx(st, ROAD_COL_DEEP);
    else if (roadPavedAt(wx, wy)) continue; // the lane's own paving: the ground's
    else if (r2 && st.gap < 1.1) col = ROAD_COL_DEEP;
    else if (r2 && st.gap < ROAD_LIP) col = (st.x2 - wx) + (st.y2 - wy) > 0 ? ROAD_COL_LIP : ROAD_COL_LIP_SHD;
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  footingCvs.set(key, c);
  return c;
}
// a kerbed round (FOOTINGS .kerb): the ellipse's own px, not its stones'
// middles. `rounds` is one ellipse or several joined into one place (a
// roost and the stall at its edge): each {cx, cy} its middle in world px,
// {ax, ay} its kerb's outer half axes. A pixel answers to the round it lies
// deepest in, so where two meet the kerb turns the corner between them
function paintKerbRound(g, F, c, W, H, rounds) {
  const KW = F.kerbW || FOOT_KERB, KB = F.block || FOOT_KERB_BLOCK; // the ring's width and a block's length, px
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = c.wx + x, wy = c.wy + y;
    const ob = objects[idx(Math.floor(wx / TILE), Math.floor(wy / TILE))];
    if (ob && ob.type === 'tree') continue; // under a pine: the forest's ground
    let r = null, out = 1e9, dx = 0, dy = 0;
    for (const q of rounds) {
      const qx = wx + 0.5 - q.cx, qy = wy + 0.5 - q.cy, o = (Math.hypot(qx / q.ax, qy / q.ay) - 1) * Math.min(q.ax, q.ay); // px out from its kerb's edge (about)
      if (o < out) { out = o; r = q; dx = qx; dy = qy; }
    }
    const ax = r.ax, ay = r.ay;
    // the lane's own paving runs on into it: the ground's. An `over` round
    // paves its whole inside and rings it, the lanes leaving through mouths
    if (roadPavedAt(wx, wy) && !(F.over && out < 0)) continue;
    let col = null;
    const along = Math.atan2(dy / ay, dx / ax) * (ax + ay) / 2;
    const mouth = F.over && out < 2 && kerbMouth(r, along, KW, KB);
    // an END block, the last before a mouth, stands a pixel proud and dressed
    // light, so the kerb finishes there instead of just stopping
    const end = F.over && !mouth && out < 2 && (kerbMouth(r, along - KB, KW, KB) || kerbMouth(r, along + KB, KW, KB));
    if (out < -KW || (out < 0 && mouth)) col = roadStonePx(roadStoneAt(wx, wy, ROAD_FLAG, 0.8), ROAD_COL_DEEP);
    else if (end && out < 1) {
      const a0 = ((along % KB) + KB) % KB, face = kerbMouth(r, along + KB, KW, KB) ? a0 > KB - 2 : a0 < 1; // its face toward the mouth
      col = face || out >= 0 ? FOOT_KERB_COL.shd : out < -KW + 1 ? FOOT_KERB_COL.mid : FOOT_KERB_COL.lit;
    } else if (out < 0) {
      // the kerb: blocks along the ring, a joint between each, the light from the up-left
      const lit = -(dx / ax + dy / ay); // > 0 on the side facing the light
      if (Math.abs(((along % KB) + KB) % KB) < 1) col = FOOT_KERB_COL.joint;
      else if (out < -KW + 1) col = lit < 0 ? FOOT_KERB_COL.lit : FOOT_KERB_COL.mid; // its inner face: raised, never a pit's rim
      else col = lit > 0.35 ? FOOT_KERB_COL.lit : lit < -0.35 ? FOOT_KERB_COL.shd : FOOT_KERB_COL.mid;
    } else if (!F.over && out < FOOT_JOIN && kerbMeetsLane(wx, wy, dx / (ax * ax), dy / (ay * ay), FOOT_JOIN - out)) {
      col = roadStonePx(roadStoneAt(wx, wy, ROAD_FLAG, 0.8), ROAD_COL_DEEP); // a sliver of snow to the lane: paved over
    } else if (out < 1.5) col = (dx + dy) < 0 ? ROAD_COL_LIP : ROAD_COL_LIP_SHD; // the snow's lip over it
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
}
// is round r's kerb block at `along` (px round the ring) a MOUTH: a lane's paving
// crosses its middle, so the whole block is left out and the kerb ends on whole blocks
function kerbMouth(r, along, KW, KB) {
  const a = (Math.floor(along / KB) + 0.5) * KB / ((r.ax + r.ay) / 2), e = 1 - KW / 2 / Math.min(r.ax, r.ay);
  return roadPavedAt(Math.round(r.cx - 0.5 + Math.cos(a) * r.ax * e), Math.round(r.cy - 0.5 + Math.sin(a) * r.ay * e));
}
// does the lane's paving start within `reach` px straight out from the kerb (nx, ny: the way out)
function kerbMeetsLane(wx, wy, nx, ny, reach) {
  const n = Math.hypot(nx, ny);
  for (let k = 1; k <= reach + 1; k++) if (roadPavedAt(Math.round(wx + nx / n * k), Math.round(wy + ny / n * k))) return true;
  return false;
}
// A ROOST's round: the pad's, joined with the round of a stall pitched at its
// edge (the stall's own is then not drawn), one canvas a pad, made again when
// the stall it holds comes or goes
function roostStalls(sp) {
  const R = FOOTINGS.roost, S = FOOTINGS.stall, cx = (sp.tx + 0.5) * TILE, cy = (sp.ty + 0.5) * TILE, o = [];
  for (const b of robots) if (b.merchant && stallUp(b.stall)) {
    const f = S.at(b.stall);
    if (Math.abs(f.x - cx) < R.rx + S.rx && Math.abs(f.y - cy) < R.ry + S.ry) o.push(b.stall);
  }
  return o;
}
function roostFootingOf(sp, stalls) {
  const key = 'roost' + sp.team, kind = sp.tx + ',' + sp.ty + stalls.map((s) => ';' + s.tx + ',' + s.ty).join('');
  let c = footingCvs.get(key);
  if (c && c.kind === kind) return c;
  const R = FOOTINGS.roost, S = FOOTINGS.stall, M = FOOT_PAD + FOOT_JOIN;
  const rounds = [{ cx: (sp.tx + 0.5) * TILE, cy: (sp.ty + 0.5) * TILE, ax: R.rx - FOOT_PAD, ay: R.ry - FOOT_PAD }];
  for (const s of stalls) { const f = S.at(s); rounds.push({ cx: f.x, cy: f.y, ax: S.rx - FOOT_PAD, ay: S.ry - FOOT_PAD }); }
  const x0 = Math.floor(Math.min(...rounds.map((q) => q.cx - q.ax)) - M), y0 = Math.floor(Math.min(...rounds.map((q) => q.cy - q.ay)) - M);
  const x1 = Math.ceil(Math.max(...rounds.map((q) => q.cx + q.ax)) + M), y1 = Math.ceil(Math.max(...rounds.map((q) => q.cy + q.ay)) + M);
  c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0; c.kind = kind; c.wx = x0; c.wy = y0;
  paintKerbRound(c.getContext('2d'), R, c, c.width, c.height, rounds);
  footingCvs.set(key, c);
  return c;
}
function drawRoostFooting(sp, stalls, ex, ey) {
  const R = FOOTINGS.roost, cx = (sp.tx + 0.5) * TILE, cy = (sp.ty + 0.5) * TILE, m = R.rx + FOOTINGS.stall.rx * 2;
  if (cx - ex < -m || cx - ex > WV_W + m || cy - ey < -m || cy - ey > WV_H + m) return;
  const c = roostFootingOf(sp, stalls);
  ctx.drawImage(c, Math.round(c.wx - ex), Math.round(c.wy - ey));
}
// Round a roost (a pad, within BOOM_STUMP_R2 of it) the blast's stumps were
// felled on the forest's own grid, so drawn as cut they stand in rows. There
// each draws by its tile's own roll and how far out it lies: cut at the
// round's edge, thinning to a stump drifted under (cut 3) further
// out, and here and there a broken trunk lying (cuts 4 and 5); one under the
// round's own paving is paved over (cut 6, nothing). Draw only:
// every stump is still the sim's, on its tile.
const STUMP_LAIN = 0.12;   // the share of a roost's stumps drawn as a trunk lying
const STUMP_BURIED = 0.7;  // the share drifted under at the blast's outer edge (none at the round's)...
const STUMP_THIN = 0.3;    // ...which lies this far out past the round, as a share of its size
const STUMP_SHELF_LAIN = 0.35; // the share of a lane shelf's stumps drawn as a trunk lying
function stumpLook(tx, ty) {
  let v = Math.floor(hash2(tx * 23 + 7, ty * 29 + 3) * 3);
  for (const sp of pads) {
    const d = Math.hypot(tx - sp.tx, ty - sp.ty);
    if (d > BOOM_STUMP_R2 + 0.5) continue;
    // how far out from the roost's kerbed round (FOOTINGS.roost): a stump on its paving stands cut
    const R = FOOTINGS.roost, e = Math.hypot((tx - sp.tx) * TILE / (R.rx - FOOT_PAD), (ty - sp.ty) * TILE / (R.ry - FOOT_PAD));
    if (e < 1) { v = 6; break; }
    const f = Math.min(1, (e - 1) / STUMP_THIN), h = hash2(tx * 13 + 5, ty * 17 + 9);
    if (h < STUMP_LAIN) v = 4 + (hash2(tx * 7 + 1, ty * 5 + 2) < 0.5 ? 1 : 0);
    else if (hash2(tx * 31 + 4, ty * 11 + 6) < STUMP_BURIED * f) v = 3;
    break;
  }
  // on a lane's shelf (JUNGLE_SHELF, js/sim/jungle.js) some lie where the lane's cutters left them
  if (v < 3 && hash2(tx * 13 + 5, ty * 17 + 9) < STUMP_SHELF_LAIN) {
    const d = roadDist(tx, ty, true);
    if (d >= JUNGLE_SHELF[0] && d <= JUNGLE_SHELF[1]) v = 4 + (hash2(tx * 7 + 1, ty * 5 + 2) < 0.5 ? 1 : 0);
  }
  return { v, dx: treeNudgeX(tx, ty), dy: Math.min(0, treeNudgeY(tx, ty)) };
}
function drawFooting(o, ex, ey) {
  const F = FOOTINGS[o.type], f = F.at(o), rx = F.rx + FOOT_PAD, ry = F.ry + FOOT_PAD;
  if (f.x - ex < -rx || f.x - ex > WV_W + rx || f.y - ey < -ry || f.y - ey > WV_H + ry) return;
  const c = footingOf(o);
  ctx.drawImage(c, Math.round(c.wx - ex), Math.round(c.wy - ey));
}
// the roosts' rounds go down before the flat pass, so the flat objects lie on the
// paving, not under it
function drawRoostFootings(ex, ey) {
  for (const sp of pads) drawRoostFooting(sp, roostStalls(sp), ex, ey);
}
function drawFootings(ex, ey) {
  const held = new Set(); // a stall a roost's round holds is drawn with it (drawRoostFootings)
  for (const sp of pads) for (const q of roostStalls(sp)) held.add(q);
  for (const o of structures) if (FOOTINGS[o.type] && !o.dead) drawFooting(o, ex, ey);
  for (const b of robots) if (b.merchant && stallUp(b.stall) && !held.has(b.stall)) drawFooting(b.stall, ex, ey);
}
