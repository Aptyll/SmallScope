'use strict';
// The war eagles: the drop bird's first cosmetic skins. Five
// armoured birds (GREAT HELM, BEAK GUARD, HORNED, CRESTED, IRONCLAD), each
// PAINTED IN CODE rather than typed as grids: flat plates in bird space
// (x forward, y toward the right wing, z up, units = world px at the roost),
// seen from above and cel-shaded, one tone per plate, then shrunk to whole
// pixels and inked. A frame is painted at the heading it flies, so it is
// never rotated on screen (no smeared pixels), and the helm's walls draw only
// while they face the camera: flying at you shows the visor, flying away the
// back of the helm. Frames are painted on first use and kept.
// The concept sheets and the Python the plates were designed in live in the
// project files (bird-concept/src/eagle2.py, style.py).
(() => {
  const { TEAM_SKINS } = SPR;

  // ---------------------------------------------------------------- palettes
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const ramp = (...h) => h.map(hex);
  const PLUME = {
    umber: ramp('#261c28', '#43303a', '#654638', '#8a6446'),
    slate: ramp('#1f2234', '#343a52', '#525c78', '#76829e'),
    char:  ramp('#1b1926', '#2e2a3c', '#474258', '#655e76'),
    gold:  ramp('#33231f', '#5e3e2c', '#8e6236', '#bd8c4a'),
  };
  const LIGHTER = { // the covert band: one step lighter, the stylized two-tone wing
    umber: ramp('#43303a', '#654638', '#8a6446', '#b08660'),
    slate: ramp('#343a52', '#525c78', '#76829e', '#a0aac0'),
    char:  ramp('#2e2a3c', '#474258', '#655e76', '#8a849a'),
    gold:  ramp('#5e3e2c', '#8e6236', '#bd8c4a', '#e0b466'),
  };
  const METAL = {
    steel:  ramp('#464b62', '#7a869e', '#afbbcd', '#eaf0f8'),
    bronze: ramp('#553620', '#8a5c2e', '#bd8a44', '#eecb78'),
    iron:   ramp('#2f3342', '#505870', '#7c869c', '#b8c2d2'),
  };
  const COMMON = {
    beak:  ramp('#7c5a1a', '#c8962c', '#eec246', '#fae696'),
    slit:  ramp('#120e18', '#120e18', '#120e18', '#120e18'),
    bone:  ramp('#8a7c6a', '#b8a88e', '#ddd0b4', '#f6eed8'),
    white: ramp('#8e9ab6', '#bcc8dc', '#e0e8f4', '#f8fbff'),
    strap: ramp('#2a1e1e', '#4a3228', '#6a4a36', '#8a6448'),
  };
  const INK = hex('#2e2440'); // the characters' outline

  // what each war eagle wears, by its BIRD_SKINS id (js/sprites/eagle.js,
  // where its name and price live). Every one seats its merchant at
  // MERCH_SEAT_WAR (EAGLE_SEATS' units), behind the helm instead of on it
  const LOOKS = {
    helm: { plume: 'umber', metal: 'steel', helm: 'cross', crown: null, armour: 'pauldron', team: 'saddle' },
    beak: { plume: 'slate', metal: 'steel', helm: 'beakguard', crown: 'plume', armour: 'edge', team: null, whitetail: true },
    horned: { plume: 'gold', metal: 'bronze', helm: 'grille', crown: 'horns', armour: 'pauldron', team: 'straps' },
    crested: { plume: 'char', metal: 'bronze', helm: 'slit', crown: 'fin', armour: 'edge', team: null },
    ironclad: { plume: 'slate', metal: 'iron', helm: 'glow', crown: null, armour: 'lames', team: 'plate' },
  };
  const MERCH_SEAT_WAR = [3, 0];

  function palette(cfg, t) {
    const T = TEAM_SKINS[t];
    return Object.assign({}, COMMON, {
      plume: PLUME[cfg.plume], cov: LIGHTER[cfg.plume], metal: METAL[cfg.metal],
      tail: cfg.whitetail ? COMMON.white : PLUME[cfg.plume],
      team: ramp(T.fit, T.coatD, T.coat, T.coatL),
      glow: ramp(T.coatD, T.mark, T.glow, T.trim),
    });
  }

  // ---------------------------------------------------------------- plates
  // P: one flat plate. tone 0..3 by hand, or null = from the way it faces
  const P = (pts, mat, layer, tone, o) => Object.assign({ pts, mat, layer, tone, cull: null, line: true, shine: false }, o);
  const PX = (x, y, z, mat, tone, layer) => ({ pts: [[x, y, z]], mat, tone, layer, px: true });
  const mirror = (parts) => parts.map((p) => Object.assign({}, p, { pts: p.pts.map(([x, y, z]) => [x, -y, z]).reverse() }));
  const circle = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
  const rad = (d) => d * Math.PI / 180;

  // the right wing, spread, seen from above: dark flight feathers (scalloped
  // edge, five fingers), mid greater coverts, the light leading band
  function wing(cfg) {
    const Z = 2, W = [];
    for (let i = 0; i < 6; i++) {
      const y0 = 7 + i * 5.6, y1 = y0 + 6.2, back = -19 - 1.2 * Math.sin(Math.PI * (i + 0.5) / 6);
      W.push(P([[-4, y0, Z], [-4, y1, Z], [back + 2.2, y1, Z], [back, (y0 + y1) / 2, Z], [back + 2.2, y0, Z]], 'plume', 1 + i * 0.01, 0));
    }
    const roots = [[3, 47], [0, 46], [-3.5, 44.5], [-7, 42.5], [-10.5, 40]], fan = [-12, 4, 18, 32, 46], lens = [13, 15, 15, 14, 12];
    roots.forEach(([x, y], i) => {
      const a = rad(fan[i]), dx = -Math.sin(a), dy = Math.cos(a), px = dy, py = -dx, wd = 2.9, L = lens[i];
      const tx = x + dx * L, ty = y + dy * L;
      W.push(P([[x + px * wd, y + py * wd, Z], [tx + px * wd * 0.7, ty + py * wd * 0.7, Z], [tx + dx * 2, ty + dy * 2, Z],
        [tx - px * wd * 0.7, ty - py * wd * 0.7, Z], [x - px * wd, y - py * wd, Z]], 'plume', 1.2 - i * 0.01, 0, { seam: true }));
    });
    W.push(P([[6, 7, Z], [8, 32, Z], [4, 46, Z], [-12, 42, Z], [-8, 7, Z]], 'plume', 0.9, 0));
    const ys = [7, 13.5, 20, 26.5, 33, 39.5];
    for (let i = 0; i < ys.length - 1; i++) {
      const y0 = ys[i], y1 = ys[i + 1] + 0.6, back = -9.5 - i * 0.6;
      W.push(P([[3, y0, Z + 1], [3, y1, Z + 1], [back + 2.6, y1, Z + 1], [back, (y0 + y1) / 2, Z + 1], [back + 2.6, y0, Z + 1]], 'cov', 1.5 + i * 0.01, 1));
    }
    W.push(P([[7, 34, Z + 1], [4, 45, Z + 1], [-2, 46, Z + 1], [-7, 42, Z + 1], [-8, 38, Z + 1], [-3, 34, Z + 1]], 'cov', 1.6, 1));
    W.push(P([[6, 7, Z + 2], [9.5, 18, Z + 2], [10, 30, Z + 2], [7.5, 38, Z + 2], [4, 45, Z + 2], [1.5, 43, Z + 2], [3, 36, Z + 2], [3, 24, Z + 2], [1, 7, Z + 2]],
      'cov', 1.8, 2, { shine: true }));
    if (cfg.armour === 'pauldron' || cfg.armour === 'lames') {
      const n = cfg.armour === 'pauldron' ? 1 : 3;
      for (let k = 0; k < n; k++) {
        const y0 = 7 + k * 8.5;
        W.push(P([[8.5, y0, Z + 3 + k * 0.1], [10.5, y0 + 10, Z + 3], [6, y0 + 12, Z + 3], [-2, y0 + 11, Z + 3], [-3, y0, Z + 3]], 'metal', 2 + k * 0.01, k === 0 ? 2 : 1, { shine: true }));
      }
      W.push(PX(4, 11, Z + 4, 'metal', 3, 2.1));
    }
    if (cfg.armour === 'edge') {
      W.push(P([[6, 7, Z + 3], [10, 18, Z + 3], [10.5, 30, Z + 3], [8, 38, Z + 3], [5.5, 37, Z + 3], [7.5, 30, Z + 3], [7, 18, Z + 3], [4, 7, Z + 3]], 'metal', 2, 2, { shine: true }));
    }
    for (const p of W) p.wing = true;
    return W;
  }

  function tail() {
    const T = [];
    for (let i = 0; i < 5; i++) {
      const u = i / 4 - 0.5, a = Math.PI + rad(56) * u, L = 24 - 3 * Math.abs(u) * 2, wd = 4.2, x0 = -12;
      const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx, tx = x0 + dx * L, ty = dy * L;
      T.push(P([[x0 + px * wd, py * wd, 1], [tx + px * wd, ty + py * wd, 1], [tx + dx * 2.5, ty + dy * 2.5, 1], [tx - px * wd, ty - py * wd, 1], [x0 - px * wd, -py * wd, 1]],
        'tail', 0.5 + (0.5 - Math.abs(u)) * 0.02, i === 2 ? 2 : 1, { seam: true, tail: true }));
    }
    return T;
  }

  // the helm: a faceted shell. Each wall draws only while it faces the camera
  function helm(cfg) {
    const H = [], h = cfg.helm, zt = 10, zb = 3.5;
    const loop = [[12, -6], [16, -7.2], [21, -6.4], [25, -4], [27, 0], [25, 4], [21, 6.4], [16, 7.2], [12, 6]];
    if (h === 'beakguard') {
      H.push(P([[24, -3, 5], [31, -1.6, 4.4], [33.5, 0, 3.6], [31, 1.6, 4.4], [24, 3, 5]], 'metal', 4.8, 2, { shine: true }));
      H.push(P([[31, -1.4, 4], [33.5, 0, 3.6], [31, 1.4, 4], [34, 0, 1.4]], 'beak', 4.81, 2));
    } else {
      H.push(P([[24, -3, 4], [30.5, -1.6, 3.5], [33, 0, 2.6], [30.5, 1.6, 3.5], [24, 3, 4]], 'beak', 4.8, 2));
      H.push(P([[30.5, -1.4, 3.5], [33, 0, 2.6], [30.5, 1.4, 3.5], [33.3, 0, 1]], 'beak', 4.81, 0));
    }
    for (let k = 0; k < loop.length; k++) {
      const [x0, y0] = loop[k], [x1, y1] = loop[(k + 1) % loop.length];
      const ex = x1 - x0, ey = y1 - y0, nl = Math.hypot(ex, ey), nx = ey / nl, ny = -ex / nl;
      const cull = [nx, ny, 0.15];
      H.push(P([[x0, y0, zt], [x1, y1, zt], [x1, y1, zb], [x0, y0, zb]], 'metal', 5 + nx * 0.01, null, { cull }));
      if (nx > 0.3) { // a front facet: the visor band over the eyes
        const za = 8.2, zb2 = 6.8, o = (x, y, z) => [x + nx * 0.2, y + ny * 0.2, z];
        if (h === 'grille') {
          for (const f of [0.2, 0.55]) {
            const g0 = [x0 + ex * f, y0 + ey * f], g1 = [x0 + ex * (f + 0.25), y0 + ey * (f + 0.25)];
            H.push(P([o(g0[0], g0[1], za + 0.4), o(g1[0], g1[1], za + 0.4), o(g1[0], g1[1], zb2 - 0.4), o(g0[0], g0[1], zb2 - 0.4)], 'slit', 5.2, 0, { cull, keep: true }));
          }
        } else {
          H.push(P([o(x0, y0, za), o(x1, y1, za), o(x1, y1, zb2), o(x0, y0, zb2)], h === 'glow' ? 'glow' : 'slit', 5.2, h === 'glow' ? 2 : 0, { cull, keep: true }));
        }
      }
    }
    if (h === 'cross') H.push(P([[27.2, -0.7, 8.2], [27.2, 0.7, 8.2], [27.2, 0.7, 4.2], [27.2, -0.7, 4.2]], 'slit', 5.25, 0, { cull: [1, 0, 0.15], keep: true }));
    H.push(P(loop.map(([x, y]) => [x, y, zt]), 'metal', 5.4, 2, { shine: true }));
    H.push(P([[12, -0.9, zt + 0.2], [26, -0.9, zt + 0.2], [26, 0.9, zt + 0.2], [12, 0.9, zt + 0.2]], 'metal', 5.45, 3, { line: false }));
    const x0 = 12, x1 = 25;
    if (cfg.crown === 'plume') {
      H.push(P([[x1 - 3, -1.8, zt + 1], [x1 - 3, 1.8, zt + 1], [x0 - 6, 3.2, zt + 3], [x0 - 12, 0, zt + 2], [x0 - 6, -3.2, zt + 3]], 'team', 5.6, 2));
      H.push(P([[x0 - 2, -1.2, zt + 3], [x0 - 2, 1.2, zt + 3], [x0 - 11, 0, zt + 2.5]], 'team', 5.61, 1, { line: false }));
    } else if (cfg.crown === 'fin') {
      H.push(P([[x1 + 1, 0.01, zt + 7], [x1, 0.01, zt], [x0 - 7, 0.01, zt + 1], [x0 - 5, 0.01, zt + 9]], 'team', 5.62, 2, { cull: [0, -1, 0.05] }));
      H.push(P([[x0 - 5, -0.01, zt + 9], [x0 - 7, -0.01, zt + 1], [x1, -0.01, zt], [x1 + 1, -0.01, zt + 7]], 'team', 5.62, 1, { cull: [0, 1, 0.05] }));
      H.push(P([[x1 + 1, -1, zt + 7], [x1 + 1, 1, zt + 7], [x0 - 5, 1, zt + 9], [x0 - 5, -1, zt + 9]], 'team', 5.63, 3));
    } else if (cfg.crown === 'horns') {
      for (const s of [-1, 1]) {
        H.push(P([[x0 + 5, s * 5.5, zt], [x0 + 1, s * 8.5, zt + 1], [x0 - 6, s * 12, zt + 4], [x0 - 9, s * 11.5, zt + 5], [x0 - 2, s * 7, zt + 2], [x0 + 2, s * 4, zt]], 'bone', 5.6, s < 0 ? 2 : 1));
      }
    }
    return H;
  }

  function body(cfg) {
    const B = [];
    B.push(P([[16, -6, 4], [16, 6, 4], [10, 10, 4], [0, 11, 4], [-10, 9, 4], [-15, 5, 4], [-15, -5, 4], [-10, -9, 4], [0, -11, 4], [10, -10, 4]], 'plume', 3, 1));
    B.push(P([[14, -5, 5], [14, 5, 5], [8, 8, 5], [0, 9, 5], [-6, 7, 5], [-6, -7, 5], [0, -9, 5], [8, -8, 5]], 'plume', 3.05, 2, { line: false }));
    if (cfg.team === 'saddle') {
      B.push(P([[7, -12, 6], [7, 12, 6], [-12, 13, 6], [-15, 0, 6], [-12, -13, 6]], 'team', 3.5, 1));
      B.push(P([[6, -10, 6.2], [6, 10, 6.2], [-4, 11, 6.2], [-4, -11, 6.2]], 'team', 3.51, 2, { line: false }));
      B.push(P([[-12, -13, 6.3], [-15, 0, 6.3], [-12, 13, 6.3], [-13, 13, 6.3], [-16.4, 0, 6.3], [-13, -13, 6.3]], 'metal', 3.52, 2));
    } else if (cfg.team === 'plate') {
      B.push(P([[9, -10, 6], [9, 10, 6], [-8, 12, 6], [-14, 6, 6], [-14, -6, 6], [-8, -12, 6]], 'metal', 3.5, 1, { shine: true }));
      B.push(P([[7.5, -8.5, 6.2], [7.5, 8.5, 6.2], [-7.5, 10.4, 6.2], [-12.5, 5.2, 6.2], [-12.5, -5.2, 6.2], [-7.5, -10.4, 6.2]], 'team', 3.51, 2));
      B.push(P([[7.5, -8.5, 6.3], [7.5, 8.5, 6.3], [0, 9.5, 6.3], [0, -9.5, 6.3]], 'team', 3.52, 3, { line: false }));
    } else if (cfg.team === 'straps') {
      for (const s of [-1, 1]) B.push(P([[10, s * 9, 6], [12, s * 6, 6], [-10, -s * 9, 6], [-12, -s * 6, 6]], 'strap', 3.5, 1, { keep: true }));
      B.push(P(circle(-1, 0, 6.5, 12).map(([x, y]) => [x, y, 6]), 'team', 3.55, 2));
      B.push(P(circle(-1, 0, 3, 8).map(([x, y]) => [x, y, 6.2]), 'metal', 3.56, 2, { shine: true }));
    } else { // the team shows on the helm: a metal collar on the plumage
      B.push(P([[14, -7, 6], [14, 7, 6], [11, 9, 6], [11, -9, 6]], 'metal', 3.5, 2, { shine: true }));
    }
    return B;
  }

  // the three wingbeat frames, as the old sprite's: spread (the downstroke),
  // mid, back - the wing hinges up at the shoulder and the hand sweeps back
  const BEATS = [{ up: -6, fold: 0 }, { up: 14, fold: 0.3 }, { up: 32, fold: 0.8 }];
  function beat(parts, fi) {
    const { up, fold } = BEATS[fi], th = rad(up), c = Math.cos(th), s = Math.sin(th);
    return parts.map((p) => !p.wing ? p : Object.assign({}, p, {
      pts: p.pts.map(([x, y, z]) => {
        let ay = Math.abs(y), sg = Math.sign(y) || 1;
        if (ay > 34) { const d = ay - 34; x -= d * 0.55 * fold; ay = 34 + d * (1 - 0.25 * fold); }
        if (ay <= 7) return [x, sg * ay, z];
        const a = ay - 7;
        return [x, sg * (7 + a * c), z + a * s];
      }),
    }));
  }

  // the pose on top of the wingbeat: the tail and the bird's bank. The tail
  // dips on the downstroke and lifts on the upstroke; in a turn it swings
  // behind the bend and fans out, and the bank rolls every plate about the
  // body's long axis, the inside wing down. The camera looks straight down,
  // so a roll shows as the span narrowing and the two wings taking the light
  // differently - the plates' tones read the rolled plate (`lit`), while the
  // shape only narrows, never lifts up the screen (ZK would stretch one bank
  // and squash the other). bank: -1 (hard left) .. 1 (right)
  const TAIL_PITCH = [-1.4, 0.2, 1.6]; // tail tip's lift per beat, bird units
  const TAIL_YAW = rad(16), TAIL_FAN = 0.2, BANK_ROLL = rad(24);
  function pose(parts, fi, bank) {
    const r = bank * BANK_ROLL, cr = Math.cos(r), sr = Math.sin(r);
    const ty = bank * TAIL_YAW, ct = Math.cos(ty), st = Math.sin(ty), fan = 1 + Math.abs(bank) * TAIL_FAN, tp = TAIL_PITCH[fi];
    const roll = ([x, y, z]) => [x, y * cr + z * sr, z * cr - y * sr];
    return parts.map((p) => {
      let pts = p.pts, lit = null;
      if (p.tail) pts = pts.map(([x, y, z]) => {
        const dx = x + 12, k = Math.min(1, Math.max(0, -dx) / 26), yy = y * (1 + (fan - 1) * k); // 0 at the root, 1 at the tip
        return [-12 + dx * ct - yy * st, dx * st + yy * ct, z + tp * k];
      });
      if (r) { lit = pts.map(roll); pts = pts.map(([x, y, z]) => [x, y * cr, z]); }
      const cull = p.cull && r ? roll(p.cull) : p.cull;
      return pts === p.pts && cull === p.cull ? p : Object.assign({}, p, { pts, cull, lit });
    });
  }

  function plates(cfg) {
    const w = wing(cfg);
    return tail().concat(w, mirror(w), body(cfg), helm(cfg));
  }

  // ---------------------------------------------------------------- painter
  const SS = 4;           // subpixels a side
  const ZK = 0.55;        // how far height lifts a point up the screen
  const L0 = [-0.45, -0.55, 0.70], LN = Math.hypot(...L0), LIGHT = L0.map((v) => v / LN);
  const FLY = 1.5;        // painted at the flight's size: screen px per bird unit
  const REST = 0.8;       // ...and at the roost's: today's bird's footprint on the ground
  const SIZE = 216;       // frame canvas, the bird's centre in the middle
  const ICON_FLY = 0.85;  // the skins screen's card: 1x fits its art box
  const ICON_SIZE = 128;  // its canvas, before the crop: a third of the pixels to paint

  function facingTone(pts, c, s) {
    const [a, b, d] = pts;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const L = Math.hypot(...n);
    if (L < 1e-9) return 2;
    n = n.map((q) => q / L);
    if (n[2] < 0) n = n.map((q) => -q);
    const r = [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
    const l = r[0] * LIGHT[0] + r[1] * LIGHT[1] + r[2] * LIGHT[2];
    return l > 0.93 ? 3 : l > 0.72 ? 2 : l > 0.35 ? 1 : 0;
  }

  // fill one polygon (subpixel coords) into the id map: even-odd, pixel centres
  function fill(ids, W, H, pts, id) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const ja = Math.max(0, Math.ceil(y0 - 0.5)), jb = Math.min(H - 1, Math.floor(y1 - 0.5));
    const xs = [];
    for (let j = ja; j <= jb; j++) {
      const yc = j + 0.5;
      xs.length = 0;
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length];
        if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const ia = Math.max(0, Math.ceil(xs[k] - 0.5)), ib = Math.min(W - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
        for (let i = ia; i <= ib; i++) ids[j * W + i] = id;
      }
    }
  }

  // one finished frame: cel tones, inner lines, lit edges, stickers, outline
  function paint(parts, pal, hd, fly, size) {
    const c = Math.cos(hd), s = Math.sin(hd), W = size, H = size, o = size / 2;
    const proj = ([x, y, z]) => [(x * c - y * s) * fly + o, ((x * s + y * c) - z * ZK) * fly + o];
    const SW = W * SS, SH = H * SS, ids = new Int32Array(SW * SH).fill(-1);
    const order = parts.map((_, i) => i).sort((a, b) => parts[a].layer - parts[b].layer);
    const tones = new Int8Array(parts.length).fill(-1);
    for (const i of order) {
      const p = parts[i];
      if (p.px) continue;
      if (p.cull) {
        const [nx, ny, nz] = p.cull;
        if ((nx * s + ny * c) * ZK + nz <= 0.05) continue;
      }
      fill(ids, SW, SH, p.pts.map((q) => proj(q).map((v) => v * SS)), i);
      tones[i] = p.tone == null ? facingTone(p.lit || p.pts, c, s) : p.tone;
    }
    // shrink: the part holding most of each cell, if the cell is half full;
    // a thin part (a slit, a strap) keeps a cell it holds a third of
    const best = new Int32Array(W * H).fill(-1), cnt = new Int32Array(parts.length), seen = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      seen.length = 0; let full = 0;
      for (let v = 0; v < SS; v++) for (let u = 0; u < SS; u++) {
        const id = ids[(y * SS + v) * SW + x * SS + u];
        if (id >= 0) { full++; if (!cnt[id]++) seen.push(id); }
      }
      if (!full) continue;
      let b = -1, bc = 0, kb = -1, kl = -Infinity;
      for (const id of seen) {
        const n = cnt[id]; cnt[id] = 0;
        if (n > bc) { b = id; bc = n; }
        if (parts[id].keep && n >= SS * SS * 0.3 && parts[id].layer > kl) { kb = id; kl = parts[id].layer; }
      }
      if (full < SS * SS * 0.5) b = -1;
      if (kb >= 0) b = kb;
      best[y * W + x] = b;
    }
    const tone = new Int8Array(W * H).fill(-1);
    for (let k = 0; k < W * H; k++) if (best[k] >= 0) tone[k] = tones[best[k]];
    const out = Int8Array.from(tone);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : best[y * W + x];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = best[y * W + x];
      if (a < 0) continue;
      const pa = parts[a];
      for (const [dx, dy] of [[0, -1], [-1, 0], [0, 1], [1, 0]]) {
        const b = at(x + dx, y + dy);
        if (b < 0 || b === a) continue;
        const pb = parts[b];
        if (pb.layer > pa.layer && pa.line && (pa.mat !== pb.mat || pa.seam || pb.seam)) {
          out[y * W + x] = Math.min(out[y * W + x], Math.max(0, tones[a] - 1));
        }
      }
      if (pa.shine && (at(x, y - 1) !== a || at(x - 1, y) !== a)) out[y * W + x] = Math.min(3, tones[a] + 1);
    }
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const put = (k, rgb) => { d[k * 4] = rgb[0]; d[k * 4 + 1] = rgb[1]; d[k * 4 + 2] = rgb[2]; d[k * 4 + 3] = 255; };
    for (let k = 0; k < W * H; k++) if (best[k] >= 0) put(k, pal[parts[best[k]].mat][Math.max(0, out[k])]);
    for (const p of parts) {
      if (!p.px) continue;
      const [x, y] = proj(p.pts[0]).map(Math.floor);
      if (x >= 0 && y >= 0 && x < W && y < H) put(y * W + x, pal[p.mat][p.tone]);
    }
    // the outline: one ink pixel round the whole silhouette, outside it
    const on = new Uint8Array(W * H);
    for (let k = 0; k < W * H; k++) on[k] = d[k * 4 + 3] ? 1 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (on[k]) continue;
      if ((x > 0 && on[k - 1]) || (x < W - 1 && on[k + 1]) || (y > 0 && on[k - W]) || (y < H - 1 && on[k + W])) put(k, INK);
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  // ---------------------------------------------------------------- cache
  // 64 headings round the circle, so a bird swaying off its line turns in
  // steps too small to see, and five banks (level, half, full either way).
  // A frame paints on first use, or ahead of it from the warm queue.
  const TURNS = 64;
  const turnOf = (hd) => ((Math.round(hd / (2 * Math.PI) * TURNS) % TURNS) + TURNS) % TURNS;
  const bankOf = (bank) => Math.max(-2, Math.min(2, Math.round((bank || 0) * 2))) / 2;
  let frames = new Map(), queue = [];
  SPR.onTeams(() => { frames = new Map(); queue = []; }); // the colour-blind palettes repaint the team plates
  const keyOf = (id, team, t, fi, b, fly) => id + '|' + team + '|' + t + '|' + fi + '|' + b + '|' + fly;

  // one frame: skin `id` in palette set `team`, flying `hd`, beat `fi` (0
  // spread, 1 mid, 2 back), banked `bank`, at `fly` screen px per bird unit
  // (FLY in flight, REST at the roost)
  function frame(id, team, hd, fi, bank, fly) {
    const cfg = LOOKS[id], t = turnOf(hd), b = bankOf(bank), f = fly || FLY, key = keyOf(id, team, t, fi, b, f);
    let cv = frames.get(key);
    if (!cv) {
      cv = paint(pose(beat(plates(cfg), fi), fi, b), palette(cfg, team), t * 2 * Math.PI / TURNS, f, SIZE);
      frames.set(key, cv);
    }
    return cv;
  }
  // paint frames before they are needed: warm() queues one, tick(ms) paints
  // queued ones for up to ms each call (drawEagle's frame budget)
  function warm(id, team, hd, fi, bank, fly) {
    const key = keyOf(id, team, turnOf(hd), fi, bankOf(bank), fly || FLY);
    if (!frames.has(key) && !queue.some((q) => q.key === key)) queue.push({ key, a: [id, team, hd, fi, bank, fly] });
  }
  function tick(ms) {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < ms) frame(...queue.shift().a);
  }
  // a frame's flat copy, drawn fresh into one scratch canvas per kind (it is
  // drawn at once, so no copy is kept): the soft shadow on the snow, one wash
  // in the ground's shade, and the all-white hit flash
  const scratch = {};
  function wash(src, kind) {
    const cv = scratch[kind] || (scratch[kind] = document.createElement('canvas'));
    if (cv.width !== src.width || cv.height !== src.height) { cv.width = src.width; cv.height = src.height; }
    const g = cv.getContext('2d');
    g.globalCompositeOperation = 'copy';
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = kind === 'shadow' ? 'rgba(40,60,100,0.30)' : '#f4f7ff';
    g.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }
  // how far the painted bird reaches above and below the frame's centre, in
  // canvas px: what the roost's nameplate hangs over
  const reaches = new WeakMap();
  function reach(src) {
    let r = reaches.get(src);
    if (!r) {
      const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
      let y0 = src.height, y1 = -1;
      for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (d[(y * src.width + x) * 4 + 3]) { if (y < y0) y0 = y; y1 = y; break; }
      reaches.set(src, r = { up: src.height / 2 - y0, down: y1 + 1 - src.height / 2 });
    }
    return r;
  }
  // the skins screen's card art: the wingbeat nose-up at ICON_FLY (spread,
  // mid, back, mid, so a card can loop it), cropped to one box so the bird
  // holds still while its wings beat
  function icons(id, team) {
    const key = id + '|' + team + '|icon';
    let set = frames.get(key);
    if (set) return set;
    const cfg = LOOKS[id], full = [0, 1, 2].map((fi) => paint(pose(beat(plates(cfg), fi), fi, 0), palette(cfg, team), -Math.PI / 2, ICON_FLY, ICON_SIZE));
    const N = ICON_SIZE;
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (const cv of full) {
      const d = cv.getContext('2d').getImageData(0, 0, N, N).data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!d[(y * N + x) * 4 + 3]) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    set = full.map((cv) => {
      const out = document.createElement('canvas');
      out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(cv, -x0, -y0);
      return out;
    });
    set.push(set[1]);
    frames.set(key, set);
    return set;
  }
  // which skin a bird wears is birdSkinFor (js/ui/skins.js); drawEagle asks
  // has(id) and draws today's eagle for any id without a look here
  SPRITES.warBirds = {
    has: (id) => !!LOOKS[id], frame, warm, tick, reach, FLY, REST, merchSeat: MERCH_SEAT_WAR,
    shadow: (src) => wash(src, 'shadow'), flash: (src) => wash(src, 'flash'),
  };
  // the skins screen's cards: SPRITES.birdSkinIcon[id][skin(team)], painted
  // the first time a card asks
  SPRITES.birdSkinIcon = {};
  for (const id in LOOKS) {
    const per = {};
    for (const t of [0, 1]) Object.defineProperty(per, t, { get: () => icons(id, t) });
    Object.defineProperty(SPRITES.birdSkinIcon, id, { value: per, enumerable: true });
  }
})();
