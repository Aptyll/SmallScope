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
  barracks: { rx: 42, ry: 23, at: (o) => ({ x: (o.tx + structW(o) / 2) * TILE, y: (o.ty + structH(o)) * TILE - 8 }) },
  stall: { rx: 56, ry: 24, at: (o) => ({ x: (o.tx + OBJECTS.stall.w / 2) * TILE, y: (o.ty + 1) * TILE - 8 }) }, // its anchor is the front-left tile
};
const FOOT_PAD = 4; // px round the round for its lip
const FOOT_KERB = 3; // px a kerbed round's ring of blocks is wide...
const FOOT_KERB_BLOCK = 9; // ...and px a block runs along it
const FOOT_KERB_COL = { lit: '#c3beb4', mid: '#a49f95', shd: '#7d786f', joint: '#6b6459' };
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
  if (F.kerb) paintKerbRound(g, F, c, W, H);
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
// a kerbed round (FOOTINGS .kerb): the ellipse's own px, not its stones' middles
function paintKerbRound(g, F, c, W, H) {
  const ax = F.rx - FOOT_PAD, ay = F.ry - FOOT_PAD; // the kerb's outer edge
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = c.wx + x, wy = c.wy + y, dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2;
    const ob = objects[idx(Math.floor(wx / TILE), Math.floor(wy / TILE))];
    if (ob && ob.type === 'tree') continue; // under a pine: the forest's ground
    if (roadPavedAt(wx, wy)) continue; // the lane's own paving runs on into it: the ground's
    const e = Math.hypot(dx / ax, dy / ay), out = (e - 1) * Math.min(ax, ay); // px out from the kerb's edge (about)
    let col = null;
    if (out < -FOOT_KERB) col = roadStonePx(roadStoneAt(wx, wy, ROAD_FLAG, 0.8), ROAD_COL_DEEP);
    else if (out < 0) {
      // the kerb: blocks along the ring, a joint between each, the light from the up-left
      const along = Math.atan2(dy / ay, dx / ax) * (ax + ay) / 2;
      const lit = -(dx / ax + dy / ay); // > 0 on the side facing the light
      if (Math.abs(((along % FOOT_KERB_BLOCK) + FOOT_KERB_BLOCK) % FOOT_KERB_BLOCK) < 1) col = FOOT_KERB_COL.joint;
      else if (out < -FOOT_KERB + 1) col = FOOT_KERB_COL.joint; // its inner seam against the paving
      else col = lit > 0.35 ? FOOT_KERB_COL.lit : lit < -0.35 ? FOOT_KERB_COL.shd : FOOT_KERB_COL.mid;
    } else if (out < 1.5) col = (dx + dy) < 0 ? ROAD_COL_LIP : ROAD_COL_LIP_SHD; // the snow's lip over it
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
}
function drawFooting(o, ex, ey) {
  const F = FOOTINGS[o.type], f = F.at(o), rx = F.rx + FOOT_PAD, ry = F.ry + FOOT_PAD;
  if (f.x - ex < -rx || f.x - ex > WV_W + rx || f.y - ey < -ry || f.y - ey > WV_H + ry) return;
  const c = footingOf(o);
  ctx.drawImage(c, Math.round(c.wx - ex), Math.round(c.wy - ey));
}
function drawFootings(ex, ey) {
  for (const o of structures) if (FOOTINGS[o.type] && !o.dead) drawFooting(o, ex, ey);
  for (const b of robots) if (b.merchant && stallUp(b.stall)) drawFooting(b.stall, ex, ey);
}
