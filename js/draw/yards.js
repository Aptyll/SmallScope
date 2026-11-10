// ---- yards ------------------------------------------------------------------
// A camp is lived in, so the snow round it says so. A wolf den has a yard the
// pack has trodden flat, a doorstep of dark earth out of the mouth, the
// pack's trails out past where each wolf waits (the camp's `spots`) and a
// ring of half-buried stones; a hog hut has a smaller trodden yard, a packed
// path from its door out into the clearing, a woodpile against its wall and a
// chopping block; the black bear's bend and the gold pump, a building, have
// yards of their own (their rows). A yard is two pressed bands of snow with a shaded upper
// wall and a lit lower rim, like any hollow in this light. Pure dressing: one
// canvas a camp, a function of its tile and hash2/vnoise alone, on open snow
// only, drawn under every body (render, after the flat pass) the way a
// building's footing is (js/draw/footings.js). What a kind's yard is lives
// in its YARDS row.
const YARD_IN = 0.6;                        // the share of the radius the harder inner band fills
const YARD_COL = { out: 'rgba(138,150,178,0.2)', in: 'rgba(124,136,166,0.34)', wall: 'rgba(92,106,142,0.5)', lit: 'rgba(250,253,255,0.75)' };
const YARD_STEP_COL = ['#4c4a52', '#5e5b62']; // a doorstep's dark earth, in two flat tones
const YARD_BED_COL = ['#6e6052', '#807060', '#a08c58']; // a bed's scraped earth in two flat tones, and the dry grass lining it
const YARD_PRINT_COL = 'rgba(96,110,146,0.6)';
const YARD_TRAIL_STEP = 5;                  // px between prints along a trail
const YARD_TRACK_STEP = 9;                  // ...and between a heavy beast's
const YARD_PATH_HW = 4.5;                   // px: half the width of a packed path
// what lies in a yard, on 1 px grids: the den's rock (DNPAL, js/sprites/terrain.js), the hut's wood
const YARD_PAL = { o: '#2b3040', y: '#7b8398', Y: '#99a1b6', v: '#5a6176', w: '#eef4fb', s: '#c9dcee', d: '#aab8d2',
  k: '#2a2018', l: '#6f4d38', L: '#4a3324', c: '#d9ad72', C: '#b9884f', m: '#aab4c4', h: '#8a6a48',
  e: '#4c4a52', E: '#5e5b62', g: '#e8b23a', p: '#6d7689', f: '#3f6a5a', F: '#2f5348', t: '#cfc8b4', T: '#aea690' };
const YARD_THINGS = {
  rockA: ['...wwwww....', '..wwwwwwww..', '.wwwwwwsswo.', 'owwwsssyyYYo', 'oYyyyyyyyvvo', 'ovyyYyyyvvvo', '.dddddddddd.'], // a boulder's crown under its cap
  rockB: ['..wwww...', '.wwwwwwo.', 'owwssyYYo', 'oYyyyyvvo', '.ddddddd.'],
  rockC: ['...www..', '.wwwwwo.', 'owssyyYo', 'ovyyyvvo', '.dddddd.'],
  rockD: ['.www.', 'owsYo', 'oyvvo', '.ddd.'],
  pile: ['....sswwwwwss....', '...swwwwwwwwws...', '..kkkkkkkkkkkkk..', '..kcCckcCckcCck..', '..kcLckcLckcLck..', 'kkkkkkkkkkkkkkkkk', 'kcCckcCckcCckcCck', 'kcLckcLckcLckcLck', 'kkkkkkkkkkkkkkkkk', '.ddddddddddddddd.'], // split logs stacked end on, two rows under a cap of snow
  block: ['.....mm..', '....mmh..', '.....h...', '.kkkhkk..', 'kccchcck.', 'kcCCCCck.', 'kLlllLLk.', '.kkkkkk..', '..ddddd..'],          // the chopping block, the axe left in it
  log: ['.kkkk.', 'kclLLk', '.kkkd.'],
  // the pump's works, all lying flat (a hero walks over them): a coil of rope, a sheet over the stores, spare boards, pipe lengths, and the spoil dug from the bore, gold in it
  rope: ['..kkkkk..', '.khchhhk.', 'khkkkkkhk', 'khk...khk', 'khkkkkkLk', '.khhLLLk.', '..kkkkk..', '..ddddd..'],
  tarp: ['.kkkkkkkkkkkkkk.', 'ktttttwwwwtttttk', 'kttTtttttwwttTtk', 'ktTttttTttttTttk', 'kttttTTtttTTtttk', 'kTtttttttTttttTk', 'kTTttTTtttttTTTk', '.kkkkkkkkkkkkkk.', '.dddddddddddddd.'], // a sheet pegged over the stores
  boards: ['.kkkkkkkkkkkkkkkk.', '.kwwwscCCcCCCCsck.', 'kkkkkkkkkkkkkkkkkk', 'kcCCcCCCwwsCCCCCck', 'kkkkkkkkkkkkkkkkkk', 'klLLlLLLLlLLLLLLlk', 'kkkkkkkkkkkkkkkkkk', '.dddddddddddddddd.'],
  pipes: ['..kkkkkkkkkkkkkk', '.kmmmmmmmmmmmmpk', 'kkkppppppppppkkk', 'kmmmmmmmmmmmmpk.', 'kpppppppppppppk.', '.kkkkkkkkkkkkk..', '.ddddddddddddd..'],
  spoil: ['.....wEEe.......', '...wEEEEEee.....', '..EEEgEEEEeee...', '.EEEEEEeEEgeee..', 'EEeEEeeeEeeeeee.', '.eeeeegeeeeeeee.', '..ddddddddddddd.'],
  spoilB: ['..wEe...', '.EEgEee.', 'EEeeeeee', '.dddddd.'],
  // the trunk the bear rubs and rakes: a fallen pine under snow, its bark torn pale by three claws
  clawlog: ['....wwwwww.......wwwwwww....', '.kkkwwwwwwkkkkkkkwwwwwwwkkk.', 'kclLLLLLLLLLcLcLcLLLLLLLLLLk', 'kcCLLlLLLLLcLcLcLLLLlLLLLLLk', 'kclLLLLLLLcLcLcLLLLLLLlLLLLk', '.kkkkkkkkkkkkkkkkkkkkkkkkkk.', '.dddddddddddddddddddddddddd.'],
  bough: ['..f.f...', '.fFfFf.f', 'fFFfFFfF', '.fFfFf.f', '..f.f...'], // a pine bough dragged in for the bed
};
const YARDS = {
  den: {
    rx: 70, ry: 42, rag: 0.4, dy: 8, mid: 0, step: [14, 13], trails: true,
    door: (C) => ({ x: (C.tx + 1) * TILE, y: (C.ty + 1) * TILE - 3 }), // the middle of the mouth's lip row
    things: [[-52, 2, 'rockA'], [44, -8, 'rockB'], [60, 16, 'rockD'], [-34, 30, 'rockC'], [26, 36, 'rockD'], [-66, 18, 'rockD'], [58, -22, 'rockC'], [-8, 42, 'rockB'], [-60, -14, 'rockB']],
  },
  hut: {
    rx: 50, ry: 28, rag: 0.3, dy: 12, mid: 10,
    door: (C) => ({ x: C.tx * TILE + 6, y: (C.ty + 1) * TILE - 4 }),  // the door in its left wall (SPRITES.hogHut)
    path: [[0, 0], [-7, 12], [-9, 34], [8, 58], [14, 84]],              // px off the door: out, and down into the clearing
    // the woodpile stands against the right wall (`true`: it stays put when the yard flips)
    things: [[33, -1, 'pile', true], [-24, 10, 'block'], [-33, 22, 'log'], [-13, 24, 'log'], [46, 12, 'rockD'], [-40, 2, 'rockC']],
  },
  // the black bear's bend (a camp with no prop: its row goes by the camp's
  // key): a wide yard the bear has worn, its bed a scrape of bare earth lined
  // with boughs (`bed`: px off the middle, and its half sizes), its own heavy
  // tracks out to the creek and the trees (`tracks`: px off the middle), the
  // fallen trunk it rubs and claws, and the bend's boulders. No bones.
  buff: {
    rx: 88, ry: 52, rag: 0.35, dy: 0, mid: 0, bed: [-10, 8, 16, 8],
    door: (C) => ({ x: (C.tx + 0.5) * TILE, y: (C.ty + 0.5) * TILE }),
    tracks: [[-118, 34], [96, -30], [22, 92], [-40, -84]],
    things: [[40, -34, 'clawlog', true], [-56, -16, 'rockA'], [-70, 2, 'rockD'], [58, 22, 'rockB'], [-30, 0, 'bough'], [8, 16, 'bough'], [30, 34, 'rockC'], [-44, 30, 'log']],
  },
  // the gold pump (a building, not a camp: drawYards asks `structures` too):
  // a worked yard inside its ring, a walk of boards laid from the deck to the
  // lane it stands beside (`walk`: yardWalk), its stores against the deck's
  // far end (the yard flips so they are never on the walk) and the spoil
  // heaped out in front
  pump: {
    rx: 60, ry: 34, rag: 0.25, dy: -8, mid: 0, walk: true,
    door: (o) => ({ x: (o.tx + structW(o) / 2) * TILE, y: (o.ty + structH(o)) * TILE }), // the middle of the deck's front edge
    things: [[-43, -20, 'tarp'], [-50, -8, 'rope'], [-52, 5, 'pipes'], [-27, 10, 'spoil'], [-22, 20, 'spoilB'], [34, 8, 'boards']],
  },
};
const YARD_WALK_BOARD = 6; // px a board takes along the walk, its hairline seam with it
const YARD_WALK_HW = 10, YARD_WALK_FAR = 104; // px: half a board walk's width (wider than a hero), and as far as one is laid to reach paving
const YARD_WALK_ASKEW = 0.16; // the share of boards knocked well out of line
const YARD_WALK_COL = { seam: '#6a4a36', lit: ['#b98d62', '#ad8058'], face: ['#a2764f', '#976b49'], end: '#7a573f', snow: '#f4f8fd', shade: 'rgba(92,106,142,0.5)' }; // the deck's own browns
const yardCvs = new Map(); // a camp's tile index -> its yard

function yardOf(C, Y) {
  const key = idx(C.tx, C.ty);
  let c = yardCvs.get(key);
  if (c) return c;
  const m = Y.door(C), cx = m.x, cy = m.y + Y.dy;
  const path = Y.path, walk = Y.walk ? yardWalk(C, m) : null;
  let reachX = Y.rx * (1 + Y.rag), reachY = Math.max(Y.ry * (1 + Y.rag), path ? path[path.length - 1][1] : 0);
  if (walk) { reachX = Math.max(reachX, Math.abs(walk.x + walk.dx * walk.len - cx)); reachY = Math.max(reachY, Math.abs(walk.y + walk.dy * walk.len - cy)); }
  for (const t of Y.tracks || []) { reachX = Math.max(reachX, Math.abs(t[0])); reachY = Math.max(reachY, Math.abs(t[1] - Y.dy)); }
  const W = Math.ceil(reachX) * 2 + 24, H = Math.ceil(reachY) * 2 + 24;
  c = document.createElement('canvas'); c.width = W; c.height = H;
  c.wx = cx - (W >> 1); c.wy = cy - (H >> 1);
  const g = c.getContext('2d'), flip = walk ? walk.x < m.x : hash2(key, 81) > 0.5; // (a walk on the left sends the stores to the right end)
  // open snow only: the yard stops at a pine, at ice and at paving
  const open = (x, y) => {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!inWorld(tx, ty) || ground[idx(tx, ty)] !== 0 || onRoad(tx, ty)) return false;
    const ob = objects[idx(tx, ty)];
    return !(ob && ob.type === 'tree');
  };
  // a board may lie on the verge too, up to the lane's first stone
  const walkOn = (x, y) => {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), ob = inWorld(tx, ty) && objects[idx(tx, ty)];
    return inWorld(tx, ty) && ground[idx(tx, ty)] === 0 && !(ob && ob.type === 'tree') && !roadPavedAt(x, y);
  };
  // px from the packed path's line (99 with none), the line bending a little on the noise
  const pathAt = (x, y) => {
    if (!path) return 99;
    let best = 99;
    const bx = x - m.x - (vnoise(y / 11, key) - 0.5) * 5, by = y - m.y;
    for (let k = 1; k < path.length; k++) {
      const sg = (q) => (flip && q > 1 ? -1 : 1); // past its first step out of the door the path bends the other way at a flipped camp
      const ax = path[k - 1][0] * sg(k - 1), ay = path[k - 1][1], qx = path[k][0] * sg(k), qy = path[k][1], vx = qx - ax, vy = qy - ay;
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
    if (Y.bed) { // a bed: a ragged scrape
      const u = (x - m.x - Y.bed[0]) / Y.bed[2], w = (y - m.y - Y.bed[1]) / Y.bed[3];
      return u * u + w * w + (vnoise(x / 4 + 5, y / 4 + key) - 0.5) * 0.7 < 1 && open(x, y);
    }
    if (!Y.step) return false;
    const d = y - m.y, hw = Y.step[0] / 2 - Math.max(0, d - Y.step[1] * 0.55) * 0.5 + (vnoise(y / 3, key) - 0.5) * 2;
    return d >= 0 && d < Y.step[1] + (vnoise(x / 3, key + 5) - 0.5) * 4 && Math.abs(x - m.x) < hw && open(x, y);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = c.wx + x, wy = c.wy + y, b = band(wx, wy);
    let col = null;
    if (bare(wx, wy)) {
      col = (Y.bed ? YARD_BED_COL : YARD_STEP_COL)[vnoise(wx / 4 + 7, wy / 3) > 0.52 ? 1 : 0];
      if (Y.bed && hash2(wx * 5 + 3, wy * 3 + key) < 0.14) col = YARD_BED_COL[2]; // dry grass in the lining
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
  // the board walk: boards laid tight across its line, YARD_WALK_BOARD px each
  // with a hairline seam, every board a little out of true and a few knocked
  // askew, one of two woods; snow lies on the boards' ends and drifts over
  // the walk in patches; its low side throws a line of shade
  for (let i = 0; walk && i < walk.len; i++) {
    const n = Math.floor(i / YARD_WALK_BOARD), r = i % YARD_WALK_BOARD, seam = r === YARD_WALK_BOARD - 1, wood = hash2(key + n, 19) > 0.5 ? 1 : 0;
    const off = Math.round((hash2(key + n, 7) - 0.5) * (hash2(key + n, 43) < YARD_WALK_ASKEW ? 7 : 2.4));
    for (let j = -YARD_WALK_HW + off; j <= YARD_WALK_HW + off; j++) {
      const wx = Math.round(walk.x + walk.dx * i + walk.dy * j), wy = Math.round(walk.y + walk.dy * i + walk.dx * j);
      if (!open(wx, wy) && !walkOn(wx, wy)) continue;
      const end = j === -YARD_WALK_HW + off || j === YARD_WALK_HW + off, tip = Math.min(j + YARD_WALK_HW - off, YARD_WALK_HW + off - j);
      if (j === YARD_WALK_HW + off && !seam) { g.fillStyle = YARD_WALK_COL.shade; g.fillRect(wx - c.wx + walk.dy, wy - c.wy + walk.dx, 1, 1); }
      const snowy = tip < 2 && hash2(n * 3 + 1, (j < off ? 7 : 11) + key) < 0.5 - tip * 0.2; // snow on a board's ends
      if (!seam && !snowy && vnoise(wx / 6 + 21.5, wy / 6 + key) > 0.78) continue;      // under the drift
      g.fillStyle = snowy ? YARD_WALK_COL.snow : seam ? YARD_WALK_COL.seam : end ? YARD_WALK_COL.end : r === 0 ? YARD_WALK_COL.lit[wood] : YARD_WALK_COL.face[wood];
      g.fillRect(wx - c.wx, wy - c.wy, 1, 1);
    }
  }
  // a heavy beast's own tracks, from its bed out past the yard: a broad pad
  // and the toes ahead of it, left and right by turns, wandering off the hash
  for (let k = 0; Y.tracks && k < Y.tracks.length; k++) {
    const sx = m.x + (Y.bed ? Y.bed[0] : 0), sy = m.y + (Y.bed ? Y.bed[1] : 0), dx = m.x + Y.tracks[k][0] - sx, dy = m.y + Y.tracks[k][1] - sy;
    const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, bend = (hash2(key, k + 3) - 0.5) * 22;
    for (let d = 14, n = 0; d < L; d += YARD_TRACK_STEP, n++) {
      const off = Math.sin(d / L * Math.PI) * bend + (n & 1 ? 3 : -3);
      const px = Math.round(sx + ux * d - uy * off), py = Math.round(sy + uy * d + ux * off);
      if (!open(px, py) || !open(px + 3, py + 2) || bare(px, py)) continue;
      g.fillRect(px - c.wx - 1, py - c.wy - 1, 3, 2); // the pad
      for (const t of [-2, 0, 2]) g.fillRect(Math.round(px + ux * 3 - uy * t) - c.wx, Math.round(py + uy * 3 + ux * t) - c.wy, 1, 1); // the toes
    }
  }
  // what lies in it, where the ground is open; which side of the yard's middle (`mid`, px off the door) each lies flips with the camp
  for (const [ox, oy, name, stays] of Y.things) {
    const rows = YARD_THINGS[name], x0 = Math.round(m.x + (flip && !stays ? 2 * Y.mid - ox : ox) - rows[0].length / 2), y0 = Math.round(m.y + oy);
    if (!open(x0, y0 + rows.length - 1) || !open(x0 + rows[0].length, y0 + rows.length - 1)) continue;
    for (let r = 0; r < rows.length; r++) for (let q = 0; q < rows[r].length; q++) {
      const col = YARD_PAL[rows[r][q]];
      if (col) { g.fillStyle = col; g.fillRect(x0 + q - c.wx, y0 + r - c.wy, 1, 1); }
    }
  }
  yardCvs.set(key, c);
  return c;
}
// where a building's board walk is laid: from the middle of its deck's
// front straight down, or up or out along either end of it (beside the deck,
// never behind the works on it), to the nearest paving within YARD_WALK_FAR,
// the shortest of them; null with no paving near
function yardWalk(o, m) {
  const hw = structW(o) * TILE / 2, hh = structH(o) * TILE / 2, out = hw + YARD_WALK_HW + 1;
  let best = null;
  for (const [x, y, dx, dy] of [[m.x, m.y, 0, 1], [m.x - out, m.y - 4, 0, -1], [m.x + out, m.y - 4, 0, -1], [m.x - hw, m.y - hh, -1, 0], [m.x + hw - 1, m.y - hh, 1, 0]]) {
    for (let len = 1; len <= YARD_WALK_FAR + (dx ? 0 : hh) && !(best && len >= best.len); len++) {
      if (roadPavedAt(x + dx * len, y + dy * len)) { best = { x, y, dx, dy, len: len + YARD_WALK_HW }; break; } // on past the first stone: the ragged edge takes each board where it will
    }
  }
  return best;
}
function drawYard(C, Y, ex, ey) {
  const c = yardOf(C, Y);
  if (c.wx - ex > WV_W || c.wx + c.width - ex < 0 || c.wy - ey > WV_H || c.wy + c.height - ey < 0) return;
  ctx.drawImage(c, Math.round(c.wx - ex), Math.round(c.wy - ey));
}
function drawYards(ex, ey) {
  for (const C of camps) {
    const o = objects[idx(C.tx, C.ty)], Y = (o && YARDS[o.type]) || YARDS[C.key]; // by its prop, or a camp with none by its key
    if (Y) drawYard(C, Y, ex, ey);
  }
  for (const o of structures) if (YARDS[o.type] && !o.dead) drawYard(o, YARDS[o.type], ex, ey);
}
