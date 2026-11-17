// ---- footings ---------------------------------------------------------------
// What is built stands ON something: a road tower stands on a round of the
// lane's own flagstones - the same stones
// on the same grid (roadStoneAt, js/draw/ground.js), so where a round meets
// the lane or the base's paving it is one piece - laid whole under a lip of
// snow like the lane's edge. Drawn on the snow under every body (render,
// after the flat pass) while the building stands; one canvas a building, made
// when it is first in view. A kind's round is its FOOTINGS row: the half
// width and half height in px, and where its foot is. A `kerb` round is
// built, not laid: its flagstones are cut on one clean ellipse and ringed by
// a kerb of dressed blocks (FOOT_KERB px wide), lit up-left and shaded
// down-right, under a pixel of snow lip, the lane's paving meeting it.
const FOOTINGS = {
  tower: { rx: 50, ry: 25, at: (o) => towerFoot(o), kerb: true },
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
// middles. `rounds` is one ellipse or several joined into one place: each
// {cx, cy} its middle in world px, {ax, ay} its kerb's outer half axes. A
// pixel answers to the round it lies deepest in, so where two meet the kerb
// turns the corner between them
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
    // the lane's own paving runs on into it: the ground's
    if (roadPavedAt(wx, wy)) continue;
    let col = null;
    const along = Math.atan2(dy / ay, dx / ax) * (ax + ay) / 2;
    if (out < -KW) col = roadStonePx(roadStoneAt(wx, wy, ROAD_FLAG, 0.8), ROAD_COL_DEEP);
    else if (out < 0) {
      // the kerb: blocks along the ring, a joint between each, the light from the up-left
      const lit = -(dx / ax + dy / ay); // > 0 on the side facing the light
      if (Math.abs(((along % KB) + KB) % KB) < 1) col = FOOT_KERB_COL.joint;
      else if (out < -KW + 1) col = lit < 0 ? FOOT_KERB_COL.lit : FOOT_KERB_COL.mid; // its inner face: raised, never a pit's rim
      else col = lit > 0.35 ? FOOT_KERB_COL.lit : lit < -0.35 ? FOOT_KERB_COL.shd : FOOT_KERB_COL.mid;
    } else if (out < FOOT_JOIN && kerbMeetsLane(wx, wy, dx / (ax * ax), dy / (ay * ay), FOOT_JOIN - out)) {
      col = roadStonePx(roadStoneAt(wx, wy, ROAD_FLAG, 0.8), ROAD_COL_DEEP); // a sliver of snow to the lane: paved over
    } else if (out < 1.5) col = (dx + dy) < 0 ? ROAD_COL_LIP : ROAD_COL_LIP_SHD; // the snow's lip over it
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
}
// does the lane's paving start within `reach` px straight out from the kerb (nx, ny: the way out)
function kerbMeetsLane(wx, wy, nx, ny, reach) {
  const n = Math.hypot(nx, ny);
  for (let k = 1; k <= reach + 1; k++) if (roadPavedAt(Math.round(wx + nx / n * k), Math.round(wy + ny / n * k))) return true;
  return false;
}
// A stump draws by its tile's own roll: one of the three cuts, stood off its
// tile's middle. Draw only: every stump is still the sim's, on its tile.
const STUMP_SCATTER = [6, 6]; // px every stump stands off its tile's middle, across and up, so a felled stand loses the forest's grid
function stumpLook(tx, ty) {
  const v = Math.floor(hash2(tx * 23 + 7, ty * 29 + 3) * 3);
  const dx = Math.round((hash2(tx * 19 + 6, ty * 23 + 1) * 2 - 1) * STUMP_SCATTER[0]);
  const dy = -Math.floor(hash2(tx * 29 + 2, ty * 31 + 5) * (STUMP_SCATTER[1] + 1));
  return { v, dx, dy };
}
function drawFooting(o, ex, ey) {
  const F = FOOTINGS[o.type], f = F.at(o), rx = F.rx + FOOT_PAD, ry = F.ry + FOOT_PAD;
  if (f.x - ex < -rx || f.x - ex > WV_W + rx || f.y - ey < -ry || f.y - ey > WV_H + ry) return;
  const c = footingOf(o);
  ctx.drawImage(c, Math.round(c.wx - ex), Math.round(c.wy - ey));
}
function drawFootings(ex, ey) {
  for (const o of structures) if (FOOTINGS[o.type] && !o.dead) drawFooting(o, ex, ey);
  for (const s of stalls) if (stallUp(s)) drawStallRug(s, ex, ey);
}
// The merchant's RUG: rolled out before its counter once the tent is open,
// on the stones of its court (the court is the map's own paving: COURT,
// js/sim/field.js), its middle where a customer stands (counterPt,
// js/ui/shop.js). Under every body, like a footing.
function drawStallRug(o, ex, ey) {
  if (stallBuilt(o.team) < MERCH_BUILT) return;
  const spr = SPRITES.teamBuild[skin(o.team)].rug, c = counterPt(o);
  const x = Math.round(c.x - ex) - (spr.width >> 1), y = Math.round(c.y - ey) - (spr.height >> 1);
  if (x < -spr.width || x > WV_W || y < -spr.height || y > WV_H) return;
  ctx.drawImage(spr, x, y);
}
// The tent throws the shade of the step it stands at, and the ground bakes a
// caster's shade into its tiles (paintCastShade, js/draw/ground.js): when the
// step this screen last painted is not the step it stands at now, the tiles
// its shade can reach are painted again
const stallShaded = [-1, -1];
function stallShade(o, st) {
  if (stallShaded[o.team] === st) return;
  stallShaded[o.team] = st;
  const d = OBJECTS.stall;
  for (let ty = o.ty - d.h + 1 + CAST_REACH[1]; ty <= o.ty + CAST_REACH[3]; ty += 2) {
    for (let tx = o.tx + CAST_REACH[0]; tx <= o.tx + d.w - 1 + CAST_REACH[2]; tx += 2) if (inWorld(tx, ty)) repaintGround(tx, ty);
  }
}
