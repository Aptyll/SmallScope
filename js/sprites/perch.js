'use strict';
// Perch: the drop bird the crew rides in and the objective it roosts as, in
// look D: seen from above, wings open, the crew's saddle on its back, a
// narrow arrow head with no face. NEW CLASSIC (white head and tail, a team
// mantle and covert band, dark slate flight feathers) and IRONCLAD (slate
// plumage, iron lames, an iron cap); the other skins are warbirds.js's.
// PAINTED IN CODE: a stack of flat shapes (ellipses, feather blades, polygons)
// on a 112 px grid facing left, one world px a cell at the roost, shaded the
// way a hand artist would: a flat base tone, a shadow rim away from the
// top-left light, a lit rim on shiny parts, a contact shadow under whatever
// overlaps from above, an inner line where a part passes over the same
// material, one ink outline. A frame is painted at its heading and size, in
// one pose (POSES: the wings turn, lift, fold; the tail lifts), by carrying
// each shape onto the frame before filling it, so no pixel is ever rotated
// or scaled on screen and the light stays top-left. Designed in the concept
// rounds' Python (perch-landed/src/styles.py, look D BOLD, head H ARROW),
// kept in the project files, not the repo.
(() => {
  const { TEAM_SKINS } = SPR;

  // ---------------------------------------------------------------- palettes
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const ramp = (...h) => h.map(hex);
  const mix = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v) * f));
  const INK = hex('#1a1424');
  const SHADE = [40, 50, 110, 70]; // the tight shadow on the snow, light from the top-left
  const WHITE = ramp('#7a86a8', '#b8c4de', '#e6ecf6', '#fbfcff');
  const SLATE = ramp('#1f2234', '#343a52', '#525c78', '#76829e');
  const COMMON = {
    beak: ramp('#6a3c12', '#b07a20', '#e9b23c', '#fadc7a'),
    talon: ramp('#141018', '#2a2230', '#3e3646', '#5a5262'),
    leather: ramp('#2e1a14', '#5a3424', '#8a5634', '#b07a4a'),
    strap: ramp('#24161a', '#3e2a26', '#5a3e30', '#76523c'),
    brass: ramp('#62381a', '#a87226', '#e2b448', '#fae296'),
    metal: ramp('#464b62', '#7a869e', '#afbbcd', '#eaf0f8'),
  };
  // what each roosting look wears, by its BIRD_SKINS id; 'team' = the side's coat
  const LOOKS = {
    classic: { plume: 'team', head: WHITE, nape: WHITE, wing: ramp('#161a28', '#262c40', '#3a4258', '#545e78'), cov: 'team',
      prim: ramp('#0e1018', '#1a1e2c', '#2a3042', '#3e4660'), tail: WHITE },
    ironclad: { plume: SLATE, head: SLATE, nape: ramp('#343a52', '#525c78', '#76829e', '#a0aac0'), wing: SLATE,
      cov: ramp('#343a52', '#525c78', '#76829e', '#a0aac0'), prim: ramp('#12141e', '#1f2234', '#343a52', '#4a5068'), tail: SLATE,
      metal: ramp('#2f3342', '#505870', '#7c869c', '#b8c2d2'), cap: true, lames: true },
  };
  function palette(cfg, t) {
    const T = TEAM_SKINS[t], team = ramp(T.fit, T.coatD, T.coat, T.coatL);
    const p = Object.assign({}, COMMON, { team, trim: [mix(hex(T.trimD), hex(T.fit), 0.3), hex(T.trimD), hex(T.trim), mix(hex(T.trim), [255, 255, 255], 0.7)] });
    for (const k in cfg) if (Array.isArray(cfg[k])) p[k] = cfg[k]; else if (cfg[k] === 'team') p[k] = team;
    return p;
  }

  // ---------------------------------------------------------------- shapes
  // each a test on a point of the 112 grid (cell centres at +0.5), carrying
  // its bounds on the grid (bb) so the painter only asks the cells it covers
  const box = (f, x0, y0, x1, y1) => Object.assign(f, { bb: [x0, y0, x1, y1] });
  const C = 56;                 // the grid's centre line, down the bird's back
  const OX = 54, OY = 56;       // the bird's own centre on the grid: where it stands in the world
  const rad = (d) => d * Math.PI / 180;
  const rell = (cx, cy, rx, ry, a = 0) => {
    const c = Math.cos(rad(a)), s = Math.sin(rad(a));
    const r = Math.max(rx, ry), ax = c / rx, ay = s / rx, bx = -s / ry, by = c / ry;
    return box((x, y) => { const dx = x - cx, dy = y - cy, u = dx * ax + dy * ay, v = dx * bx + dy * by; return u * u + v * v <= 1; }, cx - r, cy - r, cx + r, cy + r);
  };
  // a feather: a strip from (x0, y0) to (x1, y1), w0 wide at the root, w1 at the tip
  const blade = (x0, y0, x1, y1, w0, w1 = 0.8) => {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, r = Math.max(w0, w1) / 2;
    return box((x, y) => {
      const e = ((x - x0) * dx + (y - y0) * dy) / L2;
      if (e < 0 || e > 1) return false;
      const ox = x - x0 - e * dx, oy = y - y0 - e * dy, hw = (w0 + (w1 - w0) * e) / 2;
      return ox * ox + oy * oy <= hw * hw;
    }, Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r);
  };
  const poly = (pts) => {
    const n = pts.length, P = Float64Array.from(pts.concat([pts[0]]).flat());
    return box((x, y) => {
      let inside = false;
      for (let i = 0; i < 2 * n; i += 2) {
        const x1 = P[i], y1 = P[i + 1], x2 = P[i + 2], y2 = P[i + 3];
        if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / ((y2 - y1) || 1e-9) + x1) inside = !inside;
      }
      return inside;
    }, Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])));
  };
  const rect = (x0, y0, x1, y1) => box((x, y) => x >= x0 && x < x1 + 1 && y >= y0 && y < y1 + 1, x0, y0, x1 + 1, y1 + 1); // whole cells, inclusive
  const interp = (t, P) => {
    if (t <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) if (t <= P[i][0]) return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * (t - P[i - 1][0]) / (P[i][0] - P[i - 1][0]);
    return P[P.length - 1][1];
  };
  const range = (a, b, step) => { const o = []; for (let i = 0; a + i * step < b - 1e-9; i++) o.push(a + i * step); return o; };
  const bround = (v) => { const f = Math.floor(v), d = v - f; return d > 0.5 || (d === 0.5 && f % 2) ? f + 1 : f; }; // half to even, as the concept's Python rounds

  // ---------------------------------------------------------------- the bird
  // one part: sh = shadow rim width, hl = lit rim, seam = false melts it into
  // the same material behind it, lt = the tone of the line where it overlaps;
  // side (-1 the top wing on the grid, 1 the bottom) and hand (the fingers)
  // say how a pose moves it, tail that it lifts, foot that it shows only on
  // the ground
  function build(cfg, feet) {
    const parts = [], dots = [];
    const add = (m, mat, o = {}) => parts.push(Object.assign({ m, mat, sh: 1, hl: false, seam: true, lt: 0, side: 0 }, o));
    const dot = (x, y, mat, tone = 0) => dots.push([x, y, mat, tone]);
    for (const j of [0, 4, 1, 3, 2]) { // the tail: five fat round feathers
      const u = (j - 2) / 2;
      add(blade(64, C + u * 3, 88 - 2 * Math.abs(u), C + u * 11, 7, 8), 'tail', { lt: 1, tail: true });
    }
    if (feet) for (const e of [-1, 1]) for (const [dx, dy] of [[-6, 2], [-5, 4], [-3, 5]]) { // talons gripping the snow under the chest
      add(blade(44, C + e * 9, 44 + dx, C + e * (9 + dy), 2.4, 1.6), 'beak');
      dot(44 + dx - 1, C + e * (9 + dy), 'talon', 0);
    }
    for (const side of [-1, 1]) {
      const Y = (y) => C + side * y;
      [[38, 48], [47, 49], [55, 46], [62, 41]].forEach(([tx, ty], k) => // four broad fingers
        add(blade(44 + k * 4, Y(26 - k * 3), tx, Y(ty), 9, 6.5), 'prim', { lt: 1, side, hand: true }));
      for (let k = 0; k < 3; k++) { // three fat secondaries
        const y0 = 12 + k * 6;
        add(blade(46, Y(y0), 72 - k * 4.5, Y(y0 + 2 + k * 1.5), 9, 9), 'wing', { lt: 1, side });
      }
      add(poly([[40, Y(6)], [38, Y(16)], [42, Y(28)], [50, Y(29)], [56, Y(18)], [57, Y(8)]]), 'cov', { hl: true, side });
      add(rell(52, Y(14), 5, 4.5), 'cov', { lt: 1, side }); add(rell(50, Y(23), 4.5, 4), 'cov', { lt: 1, side });
      if (cfg.lames) for (const [x, y] of [[44, Y(12)], [42, Y(20)]]) // ironclad: iron plates down the arm
        add(poly([[x - 4, y - side * 3], [x + 5, y - side * 3], [x + 6, y + side * 3], [x - 3, y + side * 3]]), 'metal', { hl: true, side });
    }
    add(rell(55, C, 17, 11), 'plume', { sh: 2, hl: true });
    saddle(add, dot);
    head(add, dot, cfg);
    return { parts, dots };
  }

  // the crew's saddle: a team blanket with a pale trim, a leather seat with a
  // raised pommel in front and a curved cantle behind, stirrups down the flanks
  function saddle(add, dot) {
    for (const gx of [49, 63]) add(rect(gx, C - 13, gx + 1, C + 13), 'strap', { sh: 0 }); // girths over the back
    add(poly([[45, C - 10], [68, C - 11], [71, C - 7], [71, C + 7], [68, C + 11], [45, C + 10], [43, C + 6], [43, C - 6]]), 'trim');
    add(poly([[46, C - 9], [67, C - 10], [69, C - 6], [69, C + 6], [67, C + 10], [46, C + 9], [44, C + 5], [44, C - 5]]), 'team', { hl: true });
    for (const e of [-1, 1]) {
      add(e < 0 ? rect(56, C - 11, 57, C - 7) : rect(56, C + 6, 57, C + 11), 'strap', { sh: 0 }); // stirrup leathers
      [2, 3, 2, 1].forEach((t, i) => dot(55 + i, C + e * 11, 'brass', t));                        // ...and irons
    }
    add(poly([[51, C - 5], [62, C - 6], [64, C - 3], [64, C + 3], [62, C + 6], [51, C + 5], [49, C + 2], [49, C - 2]]), 'leather', { hl: true });
    add(poly([[62, C - 6.5], [66, C - 5], [67, C], [66, C + 5], [62, C + 6.5], [63.5, C]]), 'leather', { hl: true }); // cantle
    add(rell(49.5, C, 2.2, 3.2), 'leather', { hl: true }); // pommel
    dot(49, C - 1, 'brass', 3);
  }

  // the head seen from above as a sharp, narrow arrow: no eyes, no face. The
  // beak is the wedge's point; the crown is lit down a ridge; the arrow's
  // corners flare just behind the beak; the hackles fan back over the neck
  const HEAD = [[-6, 0], [-3.5, 1.2], [-1, 2.2], [2.5, 4.8], [4, 4.4], [8, 3.9], [11, 3.7], [12.5, 0]]; // half widths, from the beak's tip back
  const BEAK_T = -1;  // where the beak meets the feathers
  const HK = 1.5, HX = 22; // the head's scale and where it sits on the grid
  function head(add, dot, cfg) {
    const X = (t) => HX + t * HK, Y = (y) => C + y * HK;
    const D = (t, y, mat, tone) => dot(bround(X(t)), bround(Y(y)), mat, tone);
    const both = (P) => P.map(([t, y]) => [X(t), Y(-y)]).concat(P.slice().reverse().map(([t, y]) => [X(t), Y(y)]));
    const half = (t) => interp(t, HEAD);
    add(rell(X(13), C, 6 * HK, 6 * HK), 'nape', { seam: false }); // the neck
    for (let j = 0; j < 5; j++) {
      const u = (j - 2) / 2;
      add(blade(X(11), Y(u * 2.4), X(18), Y(u * 6), 3.2 * HK, 1.0), 'nape', { lt: 1 });
    }
    add(poly(both(HEAD)), 'head', { hl: true });
    const bt = range(0, 6, 1).map((i) => HEAD[0][0] + (BEAK_T - HEAD[0][0]) * i / 5);
    add(poly(bt.map((t) => [X(t), Y(-half(t) - 0.2)]).concat(bt.slice().reverse().map((t) => [X(t), Y(half(t) + 0.2)]))), 'beak', { hl: true });
    for (const t of range(HEAD[0][0] + 1.5, BEAK_T, 1 / HK)) D(t, -0.3, 'beak', 3); // the beak's ridge
    D(HEAD[0][0] + 0.6, 0, 'beak', 0);                                               // the hook's dark tip
    for (const t of range(BEAK_T + 1, 12, 1 / HK)) D(t, -0.4, 'head', 3);            // the crown's ridge, lit
    for (const e of [-1, 1]) D(2.6, e * 4.0, 'head', e < 0 ? 3 : 1);                // the arrow's corners
    if (cfg.cap) { // ironclad: an iron cap of the same shape
      const t0 = BEAK_T + 0.6, cap = [[t0, half(t0) + 0.5]].concat(HEAD.filter(([t]) => t > t0).map(([t, y]) => [t, y + 0.6]));
      add(poly(both(cap)), 'metal', { hl: true });
      for (const t of range(BEAK_T + 1.5, 13, 1 / HK)) D(t, -0.2, 'metal', 3);
      for (const t of range(BEAK_T + 1.5, 13, 1 / HK)) D(t, 0.8, 'metal', 1);
    }
  }


  // ---------------------------------------------------------------- poses
  // what a pose does to the wings and tail. spread: the wing turned forward
  // about its shoulder, degrees; up: lifted at the hinge beside the body,
  // degrees (the far end climbs the screen and foreshortens); fold: the hand
  // swept back about the wrist, 0..1 of FOLD; tail: the tail tip's lift, grid
  // px; ground: on the snow (talons out, a tight shadow painted in).
  // A pose is named by a key: r0-r2 the roost's beats (0 thrown open and
  // raised, the gust's telegraph; 1 the shuffle; 2 at rest), s0-s9 level
  // flight's stroke (0 the spread, 5 the top), d0-dDIVE_N the stoop by its
  // progress (it tucks, then flares to land), l0-l2 the takeoff's hard beats
  const HINGE = 7, FOLD = 38, ZK = 0.55;       // ZK: how far a px of height climbs the screen (warbirds.js's camera)
  const SHOULDER = [46, 6], WRIST = [48, 24];  // grid; the lateral half mirrored per side
  const L0 = [-0.45, -0.55, 0.70], LN = Math.hypot(...L0), LIGHT = L0.map((v) => v / LN);
  const P_ = (spread, up, fold, tail, ground = false) => ({ spread, up, fold, tail, ground });
  const mixPose = (a, b, t) => P_(a.spread + (b.spread - a.spread) * t, a.up + (b.up - a.up) * t, a.fold + (b.fold - a.fold) * t, a.tail + (b.tail - a.tail) * t);
  const REST = [P_(12, 16, 0, 1, true), P_(5, 6, 0, 0, true), P_(0, 0, 0, 0, true)];
  const STROKE_N = 10; // level flight's one smooth stroke, cut into phases (EAGLE_BEAT_HZ a second, js/boot.js)
  function stroke(k) { const q = (1 - Math.cos(2 * Math.PI * k / STROKE_N)) / 2; return P_(4 - 8 * q, -4 + 28 * q, 0.3 * q, -1.5 + 3 * q); }
  const TUCK = P_(-26, 8, 0.75, -1), FLARE = P_(14, 24, 0, 2.5); // the stoop's wings swept back, and thrown open to land
  const DIVE_N = 24;
  function dive(i) {
    const u = i / DIVE_N;
    return u < 0.16 ? mixPose(stroke(0), TUCK, u / 0.16) : u < 0.76 ? TUCK : mixPose(TUCK, FLARE, Math.min(1, (u - 0.76) / 0.2));
  }
  const LIFT = [P_(10, -10, 0, -2), P_(2, 16, 0.35, 0.5), P_(-6, 40, 0.7, 2.5)];
  const normKey = (key) => key[0] === 's' ? 's' + Math.min(+key.slice(1), STROKE_N - +key.slice(1)) : key; // the upstroke passes through the downstroke's poses
  function POSE(key) {
    const n = +key.slice(1);
    return key[0] === 'r' ? REST[n] : key[0] === 's' ? stroke(n) : key[0] === 'd' ? dive(n) : LIFT[n];
  }

  // where a pose carries a grid point of one part: [x, y, z], z its height
  const rot = (x, y, px, py, a) => [px + (x - px) * Math.cos(a) - (y - py) * Math.sin(a), py + (x - px) * Math.sin(a) + (y - py) * Math.cos(a)];
  function mover(pose) {
    const up = rad(pose.up);
    return (part) => (x, y) => {
      let z = 0;
      const sd = part.side;
      if (sd) {
        if (part.hand && pose.fold) [x, y] = rot(x, y, WRIST[0], C + sd * WRIST[1], -sd * rad(FOLD * pose.fold));
        if (pose.spread) [x, y] = rot(x, y, SHOULDER[0], C + sd * SHOULDER[1], sd * rad(pose.spread));
        const d = sd * (y - C) - HINGE;
        y -= sd * d * (1 - Math.cos(up)); z = d * Math.sin(up);
      } else if (part.tail) z = pose.tail * (x - 64) / 24;
      return [x, y, z];
    };
  }
  // an affine map read off three points, its inverse, and applying one
  const aff = (f) => { const [ox, oy] = f(0, 0), [ax, ay] = f(1, 0), [bx, by] = f(0, 1); return [ax - ox, bx - ox, ox, ay - oy, by - oy, oy]; };
  const inv = (A) => { const d = A[0] * A[4] - A[1] * A[3]; return [A[4] / d, -A[1] / d, (A[1] * A[5] - A[4] * A[2]) / d, -A[3] / d, A[0] / d, (A[3] * A[2] - A[0] * A[5]) / d]; };
  const ap = (A, x, y) => [A[0] * x + A[1] * y + A[2], A[3] * x + A[4] * y + A[5]];
  const sizeOf = (scale) => 2 * Math.ceil(78 * scale); // the frame canvas: the bird's centre in the middle, room for a raised wing
  // each part's map from the grid onto a frame: posed, turned to heading hd,
  // `scale` frame px a cell, height climbing the screen by zk
  function placer(pose, hd, scale, zk) {
    const th = hd - Math.PI, c = Math.cos(th), s = Math.sin(th), move = mover(pose), O = sizeOf(scale) / 2; // the grid faces left (heading pi)
    return (part) => {
      const f = move(part);
      return aff((x, y) => { const [X, Y, z] = f(x, y), u = X - OX, v = Y - OY; return [O + scale * (u * c - v * s), O + scale * (u * s + v * c) - zk * scale * z]; });
    };
  }
  // a lifted wing turned from the light steps its tones one down. Only down:
  // a wing stepped up washes its team colour out, and on a beat it flickers
  function litStep(pose, side, hd) {
    if (!side || !pose.up) return 0;
    const th = hd - Math.PI, ny = -side * Math.sin(rad(pose.up)), nz = Math.cos(rad(pose.up));
    const l = -ny * Math.sin(th) * LIGHT[0] + ny * Math.cos(th) * LIGHT[1] + nz * LIGHT[2] - LIGHT[2];
    return l < -0.15 ? -1 : 0;
  }

  // ---------------------------------------------------------------- painter
  const SHADOW = [40, 60, 100, 77]; // a flying bird's shadow on the snow, warbirds.js's wash
  // one frame of look `id` for palette set `team`: pose `key` at heading hd,
  // `scale` frame px a grid cell (1 at the roost, 1.5 in flight: the bird is
  // nearer the camera). mask: only its silhouette in the shadow's wash, flat
  // on the ground (no height), for the shadow a flying bird casts
  function paint(id, team, hd, key, scale, mask) {
    const cfg = LOOKS[id], pose = POSE(key), pal = palette(cfg, team), { parts, dots } = build(cfg, pose.ground && !mask);
    const W = sizeOf(scale), N = W * W, place = placer(pose, hd, scale, mask ? 0 : ZK);
    const own = new Int16Array(N).fill(-1), P = parts.length;
    const loc = new Array(P), bx = new Int32Array(P * 4);
    let X0 = W, Y0 = W, X1 = -1, Y1 = -1;
    parts.forEach((p, i) => { // each part filled through its own map, only inside its box
      const A = place(p), I = inv(A), [a, b, c, d] = p.m.bb;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [gx, gy] of [[a, b], [c, b], [a, d], [c, d]]) {
        const [X, Y] = ap(A, gx, gy);
        x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
      }
      x0 = Math.max(0, Math.floor(x0) - 1); y0 = Math.max(0, Math.floor(y0) - 1);
      x1 = Math.min(W - 1, Math.ceil(x1) + 1); y1 = Math.min(W - 1, Math.ceil(y1) + 1);
      const w = Math.max(0, x1 - x0 + 1), m = new Uint8Array(w * Math.max(0, y1 - y0 + 1));
      for (let y = y0; y <= y1; y++) {
        let gx = I[0] * (x0 + 0.5) + I[1] * (y + 0.5) + I[2], gy = I[3] * (x0 + 0.5) + I[4] * (y + 0.5) + I[5];
        for (let x = x0; x <= x1; x++, gx += I[0], gy += I[3]) if (p.m(gx, gy)) { m[(y - y0) * w + x - x0] = 1; own[y * W + x] = i; }
      }
      loc[i] = m; bx[i * 4] = x0; bx[i * 4 + 1] = y0; bx[i * 4 + 2] = x1; bx[i * 4 + 3] = y1;
      if (x1 >= x0) { X0 = Math.min(X0, x0); Y0 = Math.min(Y0, y0); X1 = Math.max(X1, x1); Y1 = Math.max(Y1, y1); }
    });
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = W;
    const g = cv.getContext('2d'), img = g.createImageData(W, W), D = img.data;
    const put = (k, rgb, al = 255) => { D[k * 4] = rgb[0]; D[k * 4 + 1] = rgb[1]; D[k * 4 + 2] = rgb[2]; D[k * 4 + 3] = al; };
    const edge = (x, y) => { // an empty cell beside the bird: the outline's
      const k = y * W + x;
      return own[k] < 0 && ((x > 0 && own[k - 1] >= 0) || (x < W - 1 && own[k + 1] >= 0) || (y > 0 && own[k - W] >= 0) || (y < W - 1 && own[k + W] >= 0));
    };
    const ya = Math.max(0, Y0 - 1), yb = Math.min(W - 1, Y1 + 4), xa = Math.max(0, X0 - 1), xb = Math.min(W - 1, X1 + 3);
    if (mask) {
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (own[y * W + x] >= 0 || edge(x, y)) put(y * W + x, SHADOW, SHADOW[3]);
      g.putImageData(img, 0, 0);
      return cv;
    }
    const inPart = (i, x, y) => {
      const x0 = bx[i * 4], y0 = bx[i * 4 + 1];
      return x >= x0 && y >= y0 && x <= bx[i * 4 + 2] && y <= bx[i * 4 + 3] && loc[i][(y - y0) * (bx[i * 4 + 2] - x0 + 1) + x - x0] === 1;
    };
    // a seamless part shades as one shape with the same material round it
    const grp = parts.map((p, i) => parts.map((q, j) => j !== i && q.mat === p.mat && !(q.seam && p.seam) ? j : -1).filter((j) => j >= 0));
    const inM = (i, x, y) => inPart(i, x, y) || grp[i].some((j) => inPart(j, x, y));
    const tone = new Int8Array(N).fill(2), offs = parts.map((p) => litStep(pose, p.side, hd));
    parts.forEach((p, i) => {
      const off = offs[i], base = Math.max(1, Math.min(3, 2 + off)), dark = Math.max(0, Math.min(2, 1 + off));
      for (let y = bx[i * 4 + 1]; y <= bx[i * 4 + 3]; y++) for (let x = bx[i * 4]; x <= bx[i * 4 + 2]; x++) {
        const k = y * W + x;
        if (own[k] !== i) continue;
        let rim = false;
        for (let d = 1; d <= p.sh && !rim; d++) rim = !inM(i, x + d, y) || !inM(i, x, y + d);
        tone[k] = rim ? dark : p.hl && (!inM(i, x - 1, y) || !inM(i, x, y - 1)) ? 3 : base;
      }
    });
    const tone0 = Int8Array.from(tone);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const k = y * W + x, a = own[k];
      if (a < 0) continue;
      const b = y > 0 ? own[k - W] : -1;
      if (b > a && parts[b].seam) tone[k] = Math.max(0, tone0[k] - 1); // contact shadow: just under a part that sits in front
      // an inner line where a front part meets the same material, stepped
      // with the wing's light so a shaded wing keeps its feathers
      const line = (n) => {
        if (n <= a || parts[n].mat !== parts[a].mat || !parts[n].seam) return;
        const lt = Math.max(0, Math.min(2, parts[n].lt + offs[a]));
        if (lt < tone[k]) tone[k] = lt;
      };
      if (x < W - 1) line(own[k + 1]);
      if (x > 0) line(own[k - 1]);
      if (y < W - 1) line(own[k + W]);
      if (y > 0) line(b);
    }
    if (pose.ground) { // it stands ON the snow: the whole bird two px right and three down, under it
      for (let y = Math.max(3, ya); y <= yb; y++) for (let x = Math.max(2, xa); x <= xb; x++) {
        if (own[(y - 3) * W + x - 2] >= 0 && own[y * W + x] < 0) put(y * W + x, SHADE, SHADE[3]);
      }
    }
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { const k = y * W + x; if (own[k] >= 0) put(k, pal[parts[own[k]].mat][tone[k]]); }
    const body = place({ side: 0 });
    for (const [x, y, mat, t] of dots) { // a dot sits on its grid cell's centre, carried with the body
      const [X, Y] = ap(body, x + 0.5, y + 0.5).map(Math.floor);
      if (X >= 0 && Y >= 0 && X < W && Y < W) put(Y * W + X, pal[mat][t]);
    }
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (edge(x, y)) put(y * W + x, INK); // one ink line round the whole bird
    g.putImageData(img, 0, 0);
    return cv;
  }

  // ---------------------------------------------------------------- cache
  // 64 headings round the circle, sizes in 32nds of a grid cell, so a turn
  // or the stoop's shrink steps too small to see. A frame paints on first
  // use, or ahead of it from the warm queue; painting stays inside BUDGET ms
  // of every WINDOW, and a bird whose frame is not painted yet holds the one
  // it drew last (owner: the bird) while it queues. A frame wanted well
  // ahead (warm's idle: the stoop while the bird still flies its line, the
  // takeoff while it roosts) waits in a slow queue that paints one frame per
  // IDLE_GAP ms, and only once the urgent queue is empty. The least recently
  // drawn go past KEEP, which holds both birds' stoop or takeoff whole.
  const TURNS = 64, KEEP = 280, BUDGET = 6, WINDOW = 14, IDLE_GAP = 90;
  const turnOf = (hd) => ((Math.round(hd / (2 * Math.PI) * TURNS) % TURNS) + TURNS) % TURNS;
  const sizeQ = (scale) => Math.round(scale * 32) / 32;
  let frames = new Map(), queue = [], slow = [], queued = new Set(), last = new WeakMap(), winT = -1e9, spent = 0, idleT = -1e9;
  SPR.onTeams(() => { frames = new Map(); queue = []; slow = []; queued = new Set(); last = new WeakMap(); }); // the colour-blind palettes repaint the team parts
  function job(id, team, hd, key, scale, mask) {
    const t = turnOf(hd), k = normKey(key), q = sizeQ(scale);
    return { key: [id, team, t, k, q, mask ? 'm' : 'c'].join('|'), make: () => paint(id, team, t * 2 * Math.PI / TURNS, k, q, mask) };
  }
  function keep(key, cv) {
    frames.delete(key); frames.set(key, cv); // the Map's order is the draw order
    if (frames.size > KEEP) frames.delete(frames.keys().next().value);
  }
  function make(j) { const t0 = performance.now(), cv = j.make(); spent += performance.now() - t0; keep(j.key, cv); return cv; }
  function afford() { const t = performance.now(); if (t - winT > WINDOW) { winT = t; spent = 0; } return spent < BUDGET; }
  function want(j, idle) {
    if (frames.has(j.key)) return;
    if (!queued.has(j.key)) { queued.add(j.key); (idle ? slow : queue).push(j); }
    else if (!idle && slow.some((q) => q.key === j.key)) { slow = slow.filter((q) => q.key !== j.key); queue.push(j); } // needed sooner now
  }
  function get(j, owner, slot) {
    let cv = frames.get(j.key);
    if (cv) keep(j.key, cv);
    else {
      const held = owner && last.has(owner) && last.get(owner)[slot];
      if (held && !afford()) { want(j); return held; }
      cv = make(j);
    }
    if (owner) { let L = last.get(owner); if (!L) last.set(owner, L = {}); L[slot] = cv; }
    return cv;
  }
  // one frame: look `id` in palette set `team`, heading hd, pose key, scale
  const frame = (id, team, hd, key, scale, owner) => get(job(id, team, hd, key, scale, false), owner, 'c');
  // the shadow it casts: the same pose flat on the snow at the roost's size
  const shadow = (id, team, hd, key, owner) => get(job(id, team, hd, key, 1, true), owner, 'm');
  const warm = (id, team, hd, key, scale, mask, idle) => want(job(id, team, hd, key, scale, mask), idle);
  function tick(ms) {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < ms) { const j = queue.shift(); queued.delete(j.key); if (!frames.has(j.key)) make(j); }
    if (queue.length || !slow.length || t0 - idleT < IDLE_GAP) return;
    idleT = t0;
    const j = slow.shift(); queued.delete(j.key);
    if (!frames.has(j.key)) make(j);
  }
  // where a seat (EAGLE_SEATS' units, js/boot.js: two grid cells each, x
  // forward, y to the bird's right) sits on the frame of the same heading,
  // pose and scale, off the bird's centre: on a wing it rides the wing
  function seat(hd, key, scale, st) {
    const t = turnOf(hd) * 2 * Math.PI / TURNS, q = sizeQ(scale), pose = POSE(normKey(key));
    const gx = OX - 2 * st[0], gy = OY - 2 * st[1], l = gy - C; // the grid faces left: its right wing is on top
    const A = placer(pose, t, q, ZK)({ side: Math.abs(l) > HINGE ? Math.sign(l) : 0 }), O = sizeOf(q) / 2;
    const [X, Y] = ap(A, gx, gy);
    return [X - O, Y - O];
  }
  // frames cropped to the one box that holds them all, so a still bird holds
  // still while its wings beat: the skins screen's card (the stroke nose-up
  // at the roost's size: spread, mid, top, mid, so a card can loop it) and
  // the wiki's figure (spread, facing right, small enough for its column)
  const stills = new Map();
  SPR.onTeams(() => stills.clear());
  function cropped(full) {
    const N = full[0].width;
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (const cv of full) {
      const d = cv.getContext('2d').getImageData(0, 0, N, N).data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!d[(y * N + x) * 4 + 3]) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return full.map((cv) => {
      const out = document.createElement('canvas');
      out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(cv, -x0, -y0);
      return out;
    });
  }
  function icons(id, team) {
    const key = id + '|' + team;
    let set = stills.get(key);
    if (!set) {
      set = cropped(['s0', 's3', 's5'].map((k) => paint(id, team, -Math.PI / 2, k, 1, false)));
      set.push(set[1]);
      stills.set(key, set);
    }
    return set;
  }
  const FIGURE_SCALE = 0.42; // the wiki's figure column is a scout's few widths
  function figure(id, team) {
    const key = id + '|' + team + '|fig';
    if (!stills.has(key)) stills.set(key, cropped([paint(id, team, 0, 's0', FIGURE_SCALE, false)]));
    return stills.get(key)[0];
  }
  // drawEagle asks has(id) for the skin a bird wears; the flash and reach of
  // a frame are warbirds.js's (they read any canvas)
  SPRITES.perch = { has: (id) => !!LOOKS[id], frame, shadow, warm, tick, seat, figure, STROKE_N, DIVE_N, merchSeat: [6, 0] };
  for (const id in LOOKS) { // the skins screen's cards, painted the first time one asks
    const per = {};
    for (const t of [0, 1]) Object.defineProperty(per, t, { get: () => icons(id, t) });
    Object.defineProperty(SPRITES.birdSkinIcon, id, { value: per, enumerable: true });
  }
})();
