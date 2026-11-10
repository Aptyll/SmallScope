// ---- yards ------------------------------------------------------------------
// A camp is lived in, so the snow round it says so. A wolf den has a yard the
// pack has trodden flat, a doorstep of dark earth out of the mouth, the
// pack's trails out past where each wolf waits (the camp's `spots`) and a
// ring of half-buried stones; a hog hut has a smaller trodden yard, a packed
// path from its door out into the clearing, a woodpile against its wall and a
// chopping block. A yard is two pressed bands of snow with a shaded upper
// wall and a lit lower rim, like any hollow in this light. Pure dressing: one
// canvas a camp, a function of its tile and hash2/vnoise alone, on open snow
// only, drawn under every body (render, after the flat pass) the way a
// building's footing is (js/draw/footings.js). What a kind's yard is lives
// in its YARDS row.
const YARD_IN = 0.6;                        // the share of the radius the harder inner band fills
const YARD_COL = { out: 'rgba(138,150,178,0.2)', in: 'rgba(124,136,166,0.34)', wall: 'rgba(92,106,142,0.5)', lit: 'rgba(250,253,255,0.75)' };
const YARD_STEP_COL = ['#4c4a52', '#5e5b62']; // a doorstep's dark earth, in two flat tones
const YARD_PRINT_COL = 'rgba(96,110,146,0.6)';
const YARD_TRAIL_STEP = 5;                  // px between prints along a trail
const YARD_PATH_HW = 4.5;                   // px: half the width of a packed path
// what lies in a yard, on 1 px grids: the den's rock (DNPAL, js/sprites/terrain.js), the hut's wood
const YARD_PAL = { o: '#2b3040', y: '#7b8398', Y: '#99a1b6', v: '#5a6176', w: '#eef4fb', s: '#c9dcee', d: '#aab8d2',
  k: '#2a2018', l: '#6f4d38', L: '#4a3324', c: '#d9ad72', C: '#b9884f', m: '#aab4c4', h: '#8a6a48' };
const YARD_THINGS = {
  rockA: ['...wwwww....', '..wwwwwwww..', '.wwwwwwsswo.', 'owwwsssyyYYo', 'oYyyyyyyyvvo', 'ovyyYyyyvvvo', '.dddddddddd.'], // a boulder's crown under its cap
  rockB: ['..wwww...', '.wwwwwwo.', 'owwssyYYo', 'oYyyyyvvo', '.ddddddd.'],
  rockC: ['...www..', '.wwwwwo.', 'owssyyYo', 'ovyyyvvo', '.dddddd.'],
  rockD: ['.www.', 'owsYo', 'oyvvo', '.ddd.'],
  pile: ['....sswwwwwss....', '...swwwwwwwwws...', '..kkkkkkkkkkkkk..', '..kcCckcCckcCck..', '..kcLckcLckcLck..', 'kkkkkkkkkkkkkkkkk', 'kcCckcCckcCckcCck', 'kcLckcLckcLckcLck', 'kkkkkkkkkkkkkkkkk', '.ddddddddddddddd.'], // split logs stacked end on, two rows under a cap of snow
  block: ['.....mm..', '....mmh..', '.....h...', '.kkkhkk..', 'kccchcck.', 'kcCCCCck.', 'kLlllLLk.', '.kkkkkk..', '..ddddd..'],          // the chopping block, the axe left in it
  log: ['.kkkk.', 'kclLLk', '.kkkd.'],
};
const YARDS = {
  den: {
    rx: 70, ry: 42, rag: 0.4, dy: 8, flip: true, step: [14, 13], trails: true,
    door: (C) => ({ x: (C.tx + 1) * TILE, y: (C.ty + 1) * TILE - 3 }), // the middle of the mouth's lip row
    things: [[-52, 2, 'rockA'], [44, -8, 'rockB'], [60, 16, 'rockD'], [-34, 30, 'rockC'], [26, 36, 'rockD'], [-66, 18, 'rockD'], [58, -22, 'rockC'], [-8, 42, 'rockB'], [-60, -14, 'rockB']],
  },
  hut: {
    rx: 50, ry: 28, rag: 0.3, dy: 12, flip: false,
    door: (C) => ({ x: C.tx * TILE + 6, y: (C.ty + 1) * TILE - 4 }),  // the door in its left wall (SPRITES.hogHut)
    path: [[0, 0], [-7, 12], [-5, 34], [6, 58], [2, 84]],              // px off the door: out, and down into the clearing
    things: [[33, -1, 'pile'], [-24, 10, 'block'], [-33, 22, 'log'], [-13, 24, 'log'], [40, 14, 'rockD']],
  },
};
const yardCvs = new Map(); // a camp's tile index -> its yard

function yardOf(C, Y) {
  const key = idx(C.tx, C.ty);
  let c = yardCvs.get(key);
  if (c) return c;
  const m = Y.door(C), cx = m.x, cy = m.y + Y.dy;
  const reachY = Math.max(Y.ry * (1 + Y.rag), Y.path ? Y.path[Y.path.length - 1][1] : 0);
  const W = Math.ceil(Y.rx * (1 + Y.rag)) * 2 + 24, H = Math.ceil(reachY) * 2 + 24;
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
  // px from the packed path's line (99 with none), the line bending a little on the noise
  const pathAt = (x, y) => {
    if (!Y.path) return 99;
    let best = 99;
    const bx = x - m.x - (vnoise(y / 11, key) - 0.5) * 5, by = y - m.y;
    for (let k = 1; k < Y.path.length; k++) {
      const [ax, ay] = Y.path[k - 1], [qx, qy] = Y.path[k], vx = qx - ax, vy = qy - ay;
      const t = Math.max(0, Math.min(1, ((bx - ax) * vx + (by - ay) * vy) / (vx * vx + vy * vy)));
      best = Math.min(best, Math.hypot(bx - ax - vx * t, by - ay - vy * t));
    }
    return best;
  };
  // 0 at the yard's middle, 1 on its ragged edge; each camp's edge wanders its own way
  const sx0 = hash2(key, 5) * 97, sy0 = hash2(key, 11) * 97;
  const band = (x, y) => {
    if (!open(x, y)) return 0;
    const u = (x - cx) / Y.rx, w = (y - cy) / Y.ry, p = pathAt(x, y);
    const r = Math.sqrt(u * u + w * w) + (vnoise(x / 17 + sx0, y / 17 + sy0) - 0.5) * 2 * Y.rag + (vnoise(x / 6 + 40, y / 6) - 0.5) * 0.12;
    return r < YARD_IN || p < YARD_PATH_HW ? 2 : r < 1 ? 1 : 0;
  };
  // the doorstep: a tongue of dark earth straight out of the mouth, about a hero wide, its tip ragged
  const bare = (x, y) => {
    if (!Y.step) return false;
    const d = y - m.y, hw = Y.step[0] / 2 - Math.max(0, d - Y.step[1] * 0.55) * 0.5 + (vnoise(y / 3, key) - 0.5) * 2;
    return d >= 0 && d < Y.step[1] + (vnoise(x / 3, key + 5) - 0.5) * 4 && Math.abs(x - m.x) < hw && open(x, y);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = c.wx + x, wy = c.wy + y, b = band(wx, wy);
    let col = null;
    if (bare(wx, wy)) {
      col = YARD_STEP_COL[vnoise(wx / 4 + 7, wy / 3) > 0.52 ? 1 : 0];
    } else if (b) {
      const up = band(wx - 1, wy - 1), dn = band(wx + 1, wy + 1);
      col = up < b ? YARD_COL.wall : dn < b ? (b === 1 ? YARD_COL.lit : YARD_COL.out) : b === 2 ? YARD_COL.in : YARD_COL.out;
      if (dn < b && b === 2 && dn === 0) col = YARD_COL.lit; // a path's low side out on the open snow
    }
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  // the trails: from the mouth past each wolf's spot and out into the open,
  // a print either side of the line by turns, bending a little off the hash
  g.fillStyle = YARD_PRINT_COL;
  for (let k = 0; Y.trails && k < C.spec.spots.length; k++) {
    const s = C.spec.spots[k], ex = (C.tx + s[0] + 0.5) * TILE, ey = (C.ty + s[1] + 0.5) * TILE;
    const sx = m.x + (ex < m.x ? -6 : 6), sy = m.y + 5;
    const dx = ex - sx, dy = ey - sy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const far = L * (1.5 + hash2(key + k, 31) * 0.5), bend = (hash2(key, k + 3) - 0.5) * 16;
    for (let d = 4, n = 0; d < far; d += YARD_TRAIL_STEP, n++) {
      const t = d / far, off = Math.sin(t * Math.PI) * bend + (n & 1 ? 1.5 : -1.5);
      const px = Math.round(sx + ux * d - uy * off), py = Math.round(sy + uy * d + ux * off);
      if (!open(px, py) || bare(px, py)) continue;
      g.fillRect(px - c.wx, py - c.wy, 2, 1); g.fillRect(px - c.wx + (ux > 0 ? 1 : 0), py - c.wy + 1, 1, 1);
    }
  }
  // what lies in it, where the ground is open; a den's lie either side of the mouth by its tile
  const flip = Y.flip && hash2(key, 77) > 0.5 ? -1 : 1;
  for (const [ox, oy, name] of Y.things) {
    const rows = YARD_THINGS[name], x0 = Math.round(m.x + ox * flip - rows[0].length / 2), y0 = Math.round(m.y + oy);
    if (!open(x0, y0 + rows.length - 1) || !open(x0 + rows[0].length, y0 + rows.length - 1)) continue;
    for (let r = 0; r < rows.length; r++) for (let q = 0; q < rows[r].length; q++) {
      const col = YARD_PAL[rows[r][q]];
      if (col) { g.fillStyle = col; g.fillRect(x0 + q - c.wx, y0 + r - c.wy, 1, 1); }
    }
  }
  yardCvs.set(key, c);
  return c;
}
function drawYards(ex, ey) {
  for (const C of camps) {
    const o = objects[idx(C.tx, C.ty)], Y = o && YARDS[o.type];
    if (!Y) continue;
    const c = yardOf(C, Y);
    if (c.wx - ex > WV_W || c.wx + c.width - ex < 0 || c.wy - ey > WV_H || c.wy + c.height - ey < 0) continue;
    ctx.drawImage(c, Math.round(c.wx - ex), Math.round(c.wy - ey));
  }
}
