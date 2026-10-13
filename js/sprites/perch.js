'use strict';
// Perch at the roost: the drop bird landed, seen from above with its wings
// half open and the crew's saddle on its back, ready to lift off. NEW CLASSIC
// (white head and tail, a team mantle and covert band, dark slate flight
// feathers) and IRONCLAD (slate plumage, iron lames, an iron cap). The other
// skins roost as their flying frame laid flat (warbirds.js, eagle.js).
// PAINTED IN CODE: a stack of flat shapes (ellipses, feather blades, polygons)
// on a 112 px grid facing left, one world px a cell, shaded the way a hand
// artist would: a flat base tone, a shadow rim away from the top-left light,
// a lit rim on shiny parts, a contact shadow under whatever overlaps from
// above, an inner line where a part passes over the same material, one ink
// outline. A frame is painted at the heading the bird roosts at (the shapes
// are turned, then filled, so no rotated pixels smear) and the light stays
// top-left on screen. Designed in the concept rounds' Python
// (perch-landed/src/styles.py, look D BOLD, head H ARROW), kept in the
// project files, not the repo.
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
    const r = Math.max(rx, ry);
    return box((x, y) => { const u = (x - cx) * c + (y - cy) * s, v = -(x - cx) * s + (y - cy) * c; return (u / rx) ** 2 + (v / ry) ** 2 <= 1; }, cx - r, cy - r, cx + r, cy + r);
  };
  // a feather: a strip from (x0, y0) to (x1, y1), w0 wide at the root, w1 at the tip
  const blade = (x0, y0, x1, y1, w0, w1 = 0.8) => {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, r = Math.max(w0, w1) / 2;
    return box((x, y) => {
      const e = ((x - x0) * dx + (y - y0) * dy) / L2;
      if (e < 0 || e > 1) return false;
      return Math.hypot(x - (x0 + e * dx), y - (y0 + e * dy)) <= (w0 + (w1 - w0) * e) / 2;
    }, Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r);
  };
  const poly = (pts) => box((x, y) => {
    let inside = false;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / ((y2 - y1) || 1e-9) + x1) inside = !inside;
    }
    return inside;
  }, Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])));
  const rect = (x0, y0, x1, y1) => box((x, y) => x >= x0 && x < x1 + 1 && y >= y0 && y < y1 + 1, x0, y0, x1 + 1, y1 + 1); // whole cells, inclusive
  // where a grid box lands after turning by angle (cos c, sin s) about (px, py)
  const turnBox = ([x0, y0, x1, y1], px, py, c, s) => {
    const xs = [], ys = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { xs.push(px + (x - px) * c - (y - py) * s); ys.push(py + (x - px) * s + (y - py) * c); }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };
  // a shape turned by a degrees about (px, py): the wing's beat at the roost
  const turned = (f, px, py, a) => {
    if (!a) return f;
    const c = Math.cos(rad(-a)), s = Math.sin(rad(-a));
    return box((x, y) => f(px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c), ...turnBox(f.bb, px, py, c, -s));
  };
  const interp = (t, P) => {
    if (t <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) if (t <= P[i][0]) return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * (t - P[i - 1][0]) / (P[i][0] - P[i - 1][0]);
    return P[P.length - 1][1];
  };
  const range = (a, b, step) => { const o = []; for (let i = 0; a + i * step < b - 1e-9; i++) o.push(a + i * step); return o; };
  const bround = (v) => { const f = Math.floor(v), d = v - f; return d > 0.5 || (d === 0.5 && f % 2) ? f + 1 : f; }; // half to even, as the concept's Python rounds

  // ---------------------------------------------------------------- the bird
  // one part: sh = shadow rim width, hl = lit rim, seam = false melts it into
  // the same material behind it, lt = the tone of the line where it overlaps
  function build(cfg, spread) {
    const parts = [], dots = [];
    const add = (m, mat, o = {}) => parts.push(Object.assign({ m, mat, sh: 1, hl: false, seam: true, lt: 0 }, o));
    const dot = (x, y, mat, tone = 0) => dots.push([x, y, mat, tone]);
    for (const j of [0, 4, 1, 3, 2]) { // the tail: five fat round feathers
      const u = (j - 2) / 2;
      add(blade(64, C + u * 3, 88 - 2 * Math.abs(u), C + u * 11, 7, 8), 'tail', { lt: 1 });
    }
    for (const e of [-1, 1]) for (const [dx, dy] of [[-6, 2], [-5, 4], [-3, 5]]) { // talons gripping the snow under the chest
      add(blade(44, C + e * 9, 44 + dx, C + e * (9 + dy), 2.4, 1.6), 'beak');
      dot(44 + dx - 1, C + e * (9 + dy), 'talon', 0);
    }
    for (const side of [-1, 1]) {
      const Y = (y) => C + side * y, w = (f) => turned(f, 46, Y(6), side * spread); // the wing turns forward about its shoulder
      [[38, 48], [47, 49], [55, 46], [62, 41]].forEach(([tx, ty], k) => // four broad fingers
        add(w(blade(44 + k * 4, Y(26 - k * 3), tx, Y(ty), 9, 6.5)), 'prim', { lt: 1 }));
      for (let k = 0; k < 3; k++) { // three fat secondaries
        const y0 = 12 + k * 6;
        add(w(blade(46, Y(y0), 72 - k * 4.5, Y(y0 + 2 + k * 1.5), 9, 9)), 'wing', { lt: 1 });
      }
      add(w(poly([[40, Y(6)], [38, Y(16)], [42, Y(28)], [50, Y(29)], [56, Y(18)], [57, Y(8)]])), 'cov', { hl: true });
      add(w(rell(52, Y(14), 5, 4.5)), 'cov', { lt: 1 }); add(w(rell(50, Y(23), 4.5, 4)), 'cov', { lt: 1 });
      if (cfg.lames) for (const [x, y] of [[44, Y(12)], [42, Y(20)]]) // ironclad: iron plates down the arm
        add(w(poly([[x - 4, y - side * 3], [x + 5, y - side * 3], [x + 6, y + side * 3], [x - 3, y + side * 3]])), 'metal', { hl: true });
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

  // ---------------------------------------------------------------- painter
  const SIZE = 132, O = SIZE / 2; // the frame canvas, the bird's centre in the middle
  const SPREAD = [12, 5, 0];      // each beat's wing turn, degrees: 0 thrown open (the gust), 1 the shuffle, 2 at rest
  function paint(id, team, hd, fi) {
    const cfg = LOOKS[id], pal = palette(cfg, team), { parts, dots } = build(cfg, SPREAD[fi]);
    const W = SIZE, N = W * W, th = hd - Math.PI, c = Math.cos(th), s = Math.sin(th); // the grid faces left (heading pi)
    // each canvas cell's centre back on the grid
    const gx = new Float32Array(N), gy = new Float32Array(N);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const u = x + 0.5 - O, v = y + 0.5 - O;
      gx[y * W + x] = OX + u * c + v * s; gy[y * W + x] = OY - u * s + v * c;
    }
    const masks = parts.map((p) => { // each part's cells: only inside its box, carried onto the canvas
      const m = new Uint8Array(N), b = turnBox(p.m.bb.map((v, i) => v - (i % 2 ? OY : OX)), 0, 0, c, s);
      const x0 = Math.max(0, Math.floor(O + b[0]) - 1), y0 = Math.max(0, Math.floor(O + b[1]) - 1);
      const x1 = Math.min(W - 1, Math.ceil(O + b[2]) + 1), y1 = Math.min(W - 1, Math.ceil(O + b[3]) + 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = y * W + x; if (p.m(gx[k], gy[k])) m[k] = 1; }
      p.box = [x0, y0, x1, y1];
      return m;
    });
    const own = new Int16Array(N).fill(-1);
    parts.forEach((_, i) => { const m = masks[i]; for (let k = 0; k < N; k++) if (m[k]) own[k] = i; });
    const tone = new Int8Array(N).fill(2);
    const inM = (M, x, y) => x >= 0 && y >= 0 && x < W && y < W && M[y * W + x];
    parts.forEach((p, i) => {
      // a seamless part shades as one shape with the same material round it
      const with_ = parts.map((q, j) => j !== i && q.mat === p.mat && !(q.seam && p.seam) ? masks[j] : null).filter(Boolean);
      let M = masks[i];
      if (with_.length) { M = Uint8Array.from(M); for (const q of with_) for (let k = 0; k < N; k++) M[k] |= q[k]; }
      const [x0, y0, x1, y1] = p.box;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = y * W + x;
        if (own[k] !== i) continue;
        let rim = false;
        for (let d = 1; d <= p.sh && !rim; d++) rim = !inM(M, x + d, y) || !inM(M, x, y + d);
        if (rim) tone[k] = 1;
        else if (p.hl && (!inM(M, x - 1, y) || !inM(M, x, y - 1))) tone[k] = 3;
      }
    });
    const tone0 = Int8Array.from(tone);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { // contact shadow: just under a part that sits in front
      const k = y * W + x, a = own[k], b = y > 0 ? own[k - W] : -1;
      if (a >= 0 && b > a && parts[b].seam) tone[k] = Math.max(0, tone0[k] - 1);
    }
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { // an inner line where a front part meets the same material
      const k = y * W + x, a = own[k];
      if (a < 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, b = X >= 0 && Y >= 0 && X < W && Y < W ? own[Y * W + X] : -1;
        if (b > a && parts[b].mat === parts[a].mat && parts[b].seam) tone[k] = Math.min(tone[k], parts[b].lt);
      }
    }
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = W;
    const g = cv.getContext('2d'), img = g.createImageData(W, W), d = img.data;
    const put = (k, rgb, a = 255) => { d[k * 4] = rgb[0]; d[k * 4 + 1] = rgb[1]; d[k * 4 + 2] = rgb[2]; d[k * 4 + 3] = a; };
    // it stands ON the snow: the whole bird two px right and three down, under it
    for (let y = 3; y < W; y++) for (let x = 2; x < W; x++) if (own[(y - 3) * W + x - 2] >= 0 && own[y * W + x] < 0) put(y * W + x, SHADE, SHADE[3]);
    for (let k = 0; k < N; k++) if (own[k] >= 0) put(k, pal[parts[own[k]].mat][tone[k]]);
    for (const [x, y, mat, t] of dots) { // a dot sits on its grid cell's centre, carried round with the bird
      const u = x + 0.5 - OX, v = y + 0.5 - OY;
      const X = Math.floor(O + u * c - v * s), Y = Math.floor(O + u * s + v * c);
      if (X >= 0 && Y >= 0 && X < W && Y < W) put(Y * W + X, pal[mat][t]);
    }
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { // one ink line round the whole bird
      const k = y * W + x;
      if (own[k] >= 0) continue;
      if ((x > 0 && own[k - 1] >= 0) || (x < W - 1 && own[k + 1] >= 0) || (y > 0 && own[k - W] >= 0) || (y < W - 1 && own[k + W] >= 0)) put(k, INK);
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  // ---------------------------------------------------------------- cache
  // a roost holds one heading, so a bird wants three frames (its beats); they
  // paint on first use, or ahead of it from the warm queue while the bird dives
  const TURNS = 64, KEEP = 24;
  const turnOf = (hd) => ((Math.round(hd / (2 * Math.PI) * TURNS) % TURNS) + TURNS) % TURNS;
  let frames = new Map(), queue = [];
  SPR.onTeams(() => { frames = new Map(); queue = []; }); // the colour-blind palettes repaint the team parts
  function job(id, team, hd, fi) {
    const t = turnOf(hd);
    return { key: [id, team, t, fi].join('|'), make: () => paint(id, team, t * 2 * Math.PI / TURNS, fi) };
  }
  function cached(j) {
    let cv = frames.get(j.key);
    if (cv) frames.delete(j.key); else cv = j.make();
    frames.set(j.key, cv);
    if (frames.size > KEEP) frames.delete(frames.keys().next().value);
    return cv;
  }
  // one frame: look `id` in palette set `team`, roosting at heading `hd`, beat `fi`
  const frame = (...a) => cached(job(...a));
  function warm(...a) { const j = job(...a); if (!frames.has(j.key) && !queue.some((q) => q.key === j.key)) queue.push(j); }
  function tick(ms) {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < ms) cached(queue.shift());
  }
  // drawEagle asks has(id) for the skin a bird wears and roosts any other id
  // the old way; the shadow, flash and reach of a frame are warbirds.js's
  SPRITES.perchRest = { has: (id) => !!LOOKS[id], frame, warm, tick };
})();
