// ---- the den's yard ---------------------------------------------------------
// A wolf den is lived in, so the snow in front of its mouth says so: a yard
// the pack has trodden flat (two pressed bands with a shaded upper wall and a
// lit lower one, like any hollow in this light), a doorstep of dark earth out
// of the mouth, the pack's trails out to where each wolf waits (the camp's `spots`)
// and on into the open, and a ring of half-buried stones. Pure dressing: one canvas
// a den, a function of the den's tile and hash2/vnoise alone, drawn on the
// snow under every body (render, after the flat pass) the way a tower's
// footing is (js/draw/footings.js).
const DEN_YARD_RX = 70, DEN_YARD_RY = 42;   // px: the yard's half width and half height
const DEN_YARD_RAG = 0.4;                   // how far its edge wanders, as a share of the radius
const DEN_YARD_IN = 0.6;                    // the share of the radius the harder inner band fills
const DEN_STEP_W = 14, DEN_STEP_L = 13;     // px: the doorstep's width and its reach out of the mouth
const DEN_YARD_COL = { out: 'rgba(138,150,178,0.2)', in: 'rgba(124,136,166,0.34)', wall: 'rgba(92,106,142,0.5)', lit: 'rgba(250,253,255,0.75)' };
const DEN_STEP_COL = ['#4c4a52', '#5e5b62']; // dark earth, in two flat tones
const DEN_PRINT_COL = 'rgba(96,110,146,0.6)';
const DEN_TRAIL_STEP = 5;                   // px between prints along a trail
// the yard's stones, half buried, on 1 px grids in the den's palette (DNPAL, js/sprites/terrain.js)
const DEN_STONE_PAL = { o: '#2b3040', y: '#7b8398', Y: '#99a1b6', v: '#5a6176', w: '#eef4fb', s: '#c9dcee', d: '#aab8d2' };
const DEN_STONES = [
  ['...wwwww....', '..wwwwwwww..', '.wwwwwwsswo.', 'owwwsssyyYYo', 'oYyyyyyyyvvo', 'ovyyYyyyvvvo', '.dddddddddd.'], // a boulder's crown under its cap
  ['..wwww...', '.wwwwwwo.', 'owwssyYYo', 'oYyyyyvvo', '.ddddddd.'],
  ['...www..', '.wwwwwo.', 'owssyyYo', 'ovyyyvvo', '.dddddd.'],
  ['.www.', 'owsYo', 'oyvvo', '.ddd.'],                    // a small one
];
const DEN_STONES_AT = [[-52, 2, 0], [44, -8, 1], [60, 16, 3], [-34, 30, 2], [26, 36, 3], [-66, 18, 3], [58, -22, 2], [-8, 42, 1], [-60, -14, 1]]; // px off the mouth, and which stone
const denYardCvs = new Map(); // a den's tile index -> its yard

// the mouth of the den at anchor tile (tx, ty), world px: the middle of its lip row
function denMouth(tx, ty) { return { x: (tx + 1) * TILE, y: (ty + 1) * TILE - 3 }; }
function denYard(C) {
  const key = idx(C.tx, C.ty);
  let c = denYardCvs.get(key);
  if (c) return c;
  const m = denMouth(C.tx, C.ty), cx = m.x, cy = m.y + 8;
  const W = Math.ceil(DEN_YARD_RX * (1 + DEN_YARD_RAG)) * 2 + 24, H = Math.ceil(DEN_YARD_RY * (1 + DEN_YARD_RAG)) * 2 + 24;
  c = document.createElement('canvas'); c.width = W; c.height = H;
  c.wx = cx - (W >> 1); c.wy = cy - (H >> 1);
  const g = c.getContext('2d');
  // open snow only: the yard stops at a pine, at ice and at paving
  const open = (x, y) => {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!inWorld(tx, ty) || ground[idx(tx, ty)] !== 0 || onRoad(tx, ty)) return false;
    const ob = objects[idx(tx, ty)];
    return !(ob && ob.type === 'tree');
  };
  // 0 at the yard's middle, 1 on its ragged edge; each den's edge wanders its own way
  const sx0 = hash2(key, 5) * 97, sy0 = hash2(key, 11) * 97;
  const reach = (x, y) => {
    if (!open(x, y)) return 9;
    const u = (x - cx) / DEN_YARD_RX, w = (y - cy) / DEN_YARD_RY;
    return Math.sqrt(u * u + w * w) + (vnoise(x / 17 + sx0, y / 17 + sy0) - 0.5) * 2 * DEN_YARD_RAG + (vnoise(x / 6 + 40, y / 6) - 0.5) * 0.12;
  };
  const band = (x, y) => { const r = reach(x, y); return r < DEN_YARD_IN ? 2 : r < 1 ? 1 : 0; };
  // the doorstep: a tongue of dark earth straight out of the mouth, about a hero wide, its tip ragged
  const bare = (x, y) => {
    const d = y - m.y, hw = DEN_STEP_W / 2 - Math.max(0, d - DEN_STEP_L * 0.55) * 0.5 + (vnoise(y / 3, key) - 0.5) * 2;
    return d >= 0 && d < DEN_STEP_L + (vnoise(x / 3, key + 5) - 0.5) * 4 && Math.abs(x - m.x) < hw && open(x, y);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = c.wx + x, wy = c.wy + y, b = band(wx, wy);
    let col = null;
    if (bare(wx, wy)) {
      col = DEN_STEP_COL[vnoise(wx / 4 + 7, wy / 3) > 0.52 ? 1 : 0];
    } else if (b) {
      const up = band(wx - 1, wy - 1), dn = band(wx + 1, wy + 1);
      col = up < b ? DEN_YARD_COL.wall : dn < b ? null : b === 2 ? DEN_YARD_COL.in : DEN_YARD_COL.out;
      if (dn < b && b === 1) col = DEN_YARD_COL.lit; // the low side's rim catches the light
      else if (dn < b) col = DEN_YARD_COL.out;
    }
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  // the trails: from the mouth past each wolf's spot and out into the open,
  // a print either side of the line by turns, bending a little off the hash
  g.fillStyle = DEN_PRINT_COL;
  for (let k = 0; k < C.spec.spots.length; k++) {
    const s = C.spec.spots[k], ex = (C.tx + s[0] + 0.5) * TILE, ey = (C.ty + s[1] + 0.5) * TILE;
    const sx = m.x + (ex < m.x ? -6 : 6), sy = m.y + 5;
    const dx = ex - sx, dy = ey - sy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const far = L * (1.5 + hash2(key + k, 31) * 0.5), bend = (hash2(key, k + 3) - 0.5) * 16;
    for (let d = 4, n = 0; d < far; d += DEN_TRAIL_STEP, n++) {
      const t = d / far, off = Math.sin(t * Math.PI) * bend + (n & 1 ? 1.5 : -1.5);
      const px = Math.round(sx + ux * d - uy * off), py = Math.round(sy + uy * d + ux * off);
      if (!open(px, py) || bare(px, py)) continue;
      g.fillRect(px - c.wx, py - c.wy, 2, 1); g.fillRect(px - c.wx + (ux > 0 ? 1 : 0), py - c.wy + 1, 1, 1);
    }
  }
  // the stones, where the ground is open; which side of the mouth each lies flips with the den
  const flip = hash2(key, 77) > 0.5 ? -1 : 1;
  for (const [ox, oy, i] of DEN_STONES_AT) {
    const rows = DEN_STONES[i], x0 = Math.round(m.x + ox * flip - rows[0].length / 2), y0 = Math.round(m.y + oy);
    if (!open(x0, y0) || !open(x0 + rows[0].length, y0 + rows.length)) continue;
    for (let r = 0; r < rows.length; r++) for (let q = 0; q < rows[r].length; q++) {
      const col = DEN_STONE_PAL[rows[r][q]];
      if (col) { g.fillStyle = col; g.fillRect(x0 + q - c.wx, y0 + r - c.wy, 1, 1); }
    }
  }
  denYardCvs.set(key, c);
  return c;
}
function drawDenYards(ex, ey) {
  for (const C of camps) {
    const o = objects[idx(C.tx, C.ty)];
    if (!o || o.type !== 'den') continue;
    const c = denYard(C);
    if (c.wx - ex > WV_W || c.wx + c.width - ex < 0 || c.wy - ey > WV_H || c.wy + c.height - ey < 0) continue;
    ctx.drawImage(c, Math.round(c.wx - ex), Math.round(c.wy - ey));
  }
}
