// ---- footings ---------------------------------------------------------------
// What is built stands ON something: a road tower, a bay and the merchant's
// stall each stand on a round of the lane's own flagstones - the same stones
// on the same grid (roadStoneAt, js/draw/ground.js), so where a round meets
// the lane or the base's paving it is one piece - laid whole under a lip of
// snow like the lane's edge. Drawn on the snow under every body (render,
// after the flat pass) while the building stands; one canvas a building, made
// when it is first in view. A kind's round is its FOOTINGS row: the half
// width and half height in px, and where its foot is.
const FOOTINGS = {
  tower: { rx: 50, ry: 25, at: (o) => towerFoot(o) },
  barracks: { rx: 42, ry: 23, at: (o) => ({ x: (o.tx + structW(o) / 2) * TILE, y: (o.ty + structH(o)) * TILE - 8 }) },
  stall: { rx: 56, ry: 24, at: (o) => ({ x: (o.tx + OBJECTS.stall.w / 2) * TILE, y: (o.ty + 1) * TILE - 8 }) }, // its anchor is the front-left tile
};
const FOOT_PAD = 4; // px round the round for its lip
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
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
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
