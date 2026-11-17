// The seeing kit's page side: injected after app/media/stage.js into a served game
// page by see.js, never loaded by index.html. It names the places on the map off the
// game's own registries, stands heroes and unbuilt art in the world so the game itself
// draws them (shade, light, sort, health frame), and hands back exact pixels: the world
// layer at one image px a world px, the screen as a player has it, the whole map in one
// piece, and sheets that set two looks side by side with what differs between them.
window.SEE = (function () {
  const D = window.DBG, M = window.MEDIA;
  const S = { puts: [], hold: false, focus: [0, 0] };
  // the hours worth a look, in state.time's seconds (the darkness curve, js/sim/sim.js)
  S.TIMES = { dawn: CYCLE - 5, morning: DAY_LEN * 0.15, day: DAY_LEN * 0.35, noon: DAY_LEN * 0.5, dusk: DAY_LEN - 5, night: DAY_LEN + NIGHT_LEN * 0.4 };
  const INK = '#12161f', PAPER = '#e8eef8', GOLD = '#f2cc6a', MARK = '#ff2ee6';

  // ---- the clock ---------------------------------------------------------------
  // see.js pins performance.now before the game loads (window.__seeT), so a pine
  // sways only when a tick is run: two shots of one moment are the same pixels
  const tick0 = M.tick;
  M.tick = function () { if (!S.hold && window.__seeT != null) window.__seeT += 1000 / 60; return tick0(); };
  S.run = function (n, speed) { M.speed = speed == null ? 1 : speed; for (let i = 0; i < n; i++) M.tick(); M.speed = 0; };
  // one frame painted with nothing stepped, not even the wind: what a capture reads
  S.frame = function () { const c = M.cam || [player.x, player.y]; camX = Math.round(c[0] - WV_W / 2); camY = Math.round(c[1] - WV_H / 2); render(); };

  // ---- the places ----------------------------------------------------------------
  // Every name comes off a live registry (camps, structures, the lanes, the perches,
  // the merchants), so a moved camp moves its name with it. A name that several
  // things share takes the quarter it stands in (nw, e ...) and counts outward.
  S.spots = function () {
    const raw = [], mid = WORLD * TILE / 2;
    const slug = (s) => String(s).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const add = (base, x, y, r, also) => raw.push({ base, x: Math.round(x), y: Math.round(y), r: r || 64, also: (also || []).filter(Boolean).map(slug) });
    for (const C of camps) add(slug(C.name), (C.tx + 0.5) * TILE, (C.ty + 0.5) * TILE, C.r * TILE, [C.key, C.spec.kind]);
    for (const o of structures) add(o.type, (o.tx + structW(o) / 2) * TILE, (o.ty + structH(o) / 2) * TILE, 48);
    for (const b of robots) if (b.merchant) add('shop', b.x, b.y, 48, ['merchant']);
    for (const team of [0, 1]) { const b = basePerchPx(team); add('base', b.x, b.y, BASE_R * TILE, ['perch', 'eagle']); }
    for (const lane of [0, 1]) { // a lane at its two quarters and its middle, by distance walked
      const pts = [basePerchPx(0)].concat(laneWaypoints(0, lane)), len = [0];
      for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      for (const [f, end] of [[0.25, 'w'], [0.5, 'mid'], [0.75, 'e']]) {
        const want = len[len.length - 1] * f, p = pts[len.reduce((b, l, i) => (Math.abs(l - want) < Math.abs(len[b] - want) ? i : b), 0)];
        raw.push({ name: (lane === 0 ? 'lane-top-' : 'lane-bot-') + end, base: 'lane', x: Math.round(p.x), y: Math.round(p.y), r: 80, also: [] });
      }
    }
    add('centre', mid, mid, 96, ['center', 'middle']);
    const by = {};
    const out = raw.filter((s) => s.name);
    for (const s of raw) if (!s.name) (by[s.base] = by[s.base] || []).push(s);
    for (const base in by) {
      const g = by[base];
      if (g.length === 1) { g[0].name = base; out.push(g[0]); continue; }
      // west or east is enough when it tells them apart; else north or south joins it; else count outward
      const side = (s, ns) => (ns ? (Math.abs(s.y - mid) < 2 * TILE ? '' : s.y < mid ? 'n' : 's') : '') + (Math.abs(s.x - mid) < 2 * TILE ? '' : s.x < mid ? 'w' : 'e');
      const split = (list, f) => { const o = {}; for (const s of list) (o[f(s)] = o[f(s)] || []).push(s); return o; };
      const halves = split(g, (s) => side(s, false));
      for (const hk in halves) {
        let quarters = split(halves[hk], (s) => side(s, true));
        if (Object.keys(quarters).length === 1) quarters = { [hk]: halves[hk] }; // all one side of the middle: north or south says nothing
        for (const q in quarters) {
          quarters[q].sort((a, b) => Math.hypot(a.x - mid, a.y - mid) - Math.hypot(b.x - mid, b.y - mid));
          quarters[q].forEach((s, i) => { s.name = base + '-' + (q || 'mid') + (i ? i + 1 : ''); out.push(s); });
        }
      }
    }
    return out.map((s) => ({ name: s.name, x: s.x, y: s.y, tile: [Math.floor(s.x / TILE), Math.floor(s.y / TILE)], r: s.r, also: s.also }));
  };
  // 'orca', 'wolf-den-nw+40,-16', '@1104,400' (world px), 't69,25' (a tile)
  S.find = function (q) {
    const m = /^(.*?)([+-]\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(String(q)), name = (m ? m[1] : String(q)).toLowerCase();
    const dx = m ? +m[2] : 0, dy = m ? +m[3] : 0;
    let s = null;
    const at = /^@(-?[\d.]+),(-?[\d.]+)$/.exec(name), tile = /^t(-?[\d.]+),(-?[\d.]+)$/.exec(name);
    if (at) s = { name, x: +at[1], y: +at[2], r: 64 };
    else if (tile) s = { name, x: (+tile[1] + 0.5) * TILE, y: (+tile[2] + 0.5) * TILE, r: 64 };
    else {
      const all = S.spots();
      s = all.find((p) => p.name === name) || all.find((p) => p.name.startsWith(name)) || all.find((p) => p.also.includes(name)) ||
        all.find((p) => p.name.includes(name) || p.also.some((a) => a.includes(name)));
    }
    if (!s) throw new Error('no spot "' + q + '": node app/see/see.js --spots lists them');
    return { name: s.name, x: s.x + dx, y: s.y + dy, r: s.r };
  };

  // ---- the stage -------------------------------------------------------------------
  const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('an image would not load')); im.src = src; });
  const canv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
  const sprite = (im, flip) => { const [c, g] = canv(im.width, im.height); if (flip) { g.scale(-1, 1); g.drawImage(im, -im.width, 0); } else g.drawImage(im, 0, 0); return c; };
  const isCanvas = (v) => v instanceof HTMLCanvasElement;

  S.boot = function (o) {
    M.boot({ k: 2 * devScale, weather: o.weather || 'calm', names: true, fog: !!o.fog, mute: o.mute || [] });
    D.hideUI = false;
    state.intro = 0; // the title's fade out and the HUD's slide in are wall time: done
    // unbuilt art joins the passes it would join once built: flat art over the ground and
    // under every body, standing art in the sort with its shade, a beast as a beast
    const foot0 = drawFootprints, clock0 = campClockDraws, clip0 = clipFrame;
    drawFootprints = function (ox, oy) {
      for (const p of S.puts) if (p.mode === 'ground') ctx.drawImage(p.cv, Math.round(p.x - p.cv.width / 2) - ox, Math.round(p.y - p.cv.height / 2) - oy);
      return foot0.apply(this, arguments);
    };
    campClockDraws = function (draws) {
      for (const p of S.puts) if (p.mode === 'stand') {
        const bx = Math.round(p.x - p.cv.width / 2), by = Math.round(p.y - p.cv.height);
        draws.push({ y: p.y, bx: bx - 8, by: by - 8, bw: p.cv.width + 16, bh: p.cv.height + 24, fn: (d, ex, ey) => { drawCastShade(p.cv, bx - ex, by - ey, true); ctx.drawImage(p.cv, bx - ex, by - ey); } });
      }
      return clock0.apply(this, arguments);
    };
    clipFrame = (set, a) => (a.staged ? a.staged[a.dir] || a.staged.left : clip0(set, a));
    if (o.stocked) { // every camp out, the timed ones too (the orca, the bear)
      for (const C of camps) if (C.spec.first) state.elapsed = Math.max(state.elapsed, C.spec.first + 1);
      for (const C of camps) C.repopT = 0;
      stockCamps();
    }
    return { k: D.getZoom().k, devScale, view: [VIEW_W, VIEW_H], world: WORLD * TILE };
  };

  // open ground beside a point: the nearest of a few offsets with no scenery on it or
  // hanging over it, no water, and no beast or hero already standing there
  S.open = function (at, taken) {
    const free = (x, y) => {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (!inWorld(tx + dx, ty + dy) || objects[idx(tx + dx, ty + dy)] || waterAt(tx + dx, ty + dy)) return false;
      return !animals.some((a) => Math.hypot(a.x - x, a.y - y) < 28) && !taken.some((h) => Math.hypot(h.x - x, h.y - y) < 28);
    };
    for (const [dx, dy] of [[-40, 16], [40, 16], [-56, 0], [56, 0], [-24, 32], [24, 32], [0, 36], [-56, 28], [56, 28], [-40, -20], [40, -20], [-64, 12], [64, 12]]) if (free(at[0] + dx, at[1] + dy)) return [at[0] + dx, at[1] + dy];
    return [at[0] - 40, at[1] + 16];
  };
  // heroes round the focus: 'ARMATOS' (on open ground beside it), 'VELOX@40,0:foe:left'. The first is the
  // local player (the HUD is theirs); every seat nobody asked for leaves the frame.
  S.heroes = function (list, at) {
    const used = new Set();
    const seat = (foe) => (!used.size ? player : players.find((p) => p !== player && !used.has(p) && (p.team !== player.team) === foe));
    const out = [];
    for (const h of list) {
      const m = /^([A-Za-z]+)(?:@(-?[\d.]+),(-?[\d.]+))?((?::\w+)*)$/.exec(h);
      if (!m) throw new Error('a hero is NAME@dx,dy[:foe][:left|right|up|down], not "' + h + '"');
      const flags = m[4].split(':').filter(Boolean), cls = CLASSES.findIndex((c) => c.name === m[1].toUpperCase());
      if (cls < 0) throw new Error('no hero "' + m[1] + '": ' + CLASSES.map((c) => c.name).join(' '));
      const p = seat(flags.includes('foe'));
      if (!p) throw new Error('no free seat for ' + h);
      used.add(p); setClass(p, cls);
      const spot = m[2] == null ? S.open(at, out) : [at[0] + +m[2], at[1] + +m[3]];
      p.x = spot[0]; p.y = spot[1]; p.vx = p.vy = 0;
      p.dir = ['left', 'right', 'up', 'down'].find((d) => flags.includes(d)) || 'down';
      p.invuln = 0; p.dead = false; p.hp = p.maxHp;
      out.push({ hero: CLASSES[cls].name, id: p.id, team: p.team, x: p.x, y: p.y });
    }
    M.park(players.filter((p) => !used.has(p)), -4000, -4000);
    return out;
  };

  // a PNG into the world at the focus + (dx, dy): 'ground' lies flat on its centre,
  // 'stand' stands on its bottom centre in the sort, 'beast' is a camp beast wearing it
  S.put = async function (src, dx, dy, mode, face) {
    const im = await load(src), x = S.focus[0] + dx, y = S.focus[1] + dy;
    if (mode === 'beast') {
      const a = makeAnimal('wolf', x, y, { dir: 'left' }), other = face === 'right' ? 'left' : 'right';
      a.idleT = 1e9; a.home = null; a.staged = { [face || 'left']: sprite(im, false), [other]: sprite(im, true) };
      animals.push(a);
    } else S.puts.push({ cv: sprite(im, false), x, y, mode });
    return { w: im.width, h: im.height, x, y, mode };
  };

  // a PNG in place of a sprite the game already draws: 'den', 'wolf', 'teamBuild.0.stall'.
  // One canvas takes the art; a set of frames (a beast) takes it on every frame, mirrored
  // on the side that faces the other way. A new canvas, so every cache keyed on the old
  // one (the shade, the kept pixels) is made again from the art.
  S.swap = async function (key, src, face) {
    const im = await load(src), parts = key.split('.');
    let host = SPRITES;
    for (const k of parts.slice(0, -1)) host = host && host[k];
    const leaf = parts[parts.length - 1];
    if (!host || host[leaf] == null) throw new Error('no sprite SPRITES.' + key);
    let n = 0;
    const walk = (h, k, side) => {
      const v = h[k];
      if (isCanvas(v)) { const c = sprite(im, side != null && side !== (face || 'left')); for (const p of ['top', 'fw', 'fh', 'cols']) if (v[p] != null) c[p] = v[p]; h[k] = c; n++; }
      else if (v && typeof v === 'object') for (const kk of Object.keys(v)) walk(v, kk, kk === 'left' || kk === 'right' ? kk : side);
    };
    walk(host, leaf, null);
    if (!n) throw new Error('SPRITES.' + key + ' holds no canvas');
    if (typeof castAt !== 'undefined' && castAt) castAt.fill(-1); // the ground repaints what the old art shaded
    return { key, frames: n, w: im.width, h: im.height };
  };

  // ---- the look --------------------------------------------------------------------
  S.time = function (name) {
    const t = S.TIMES[name] != null ? S.TIMES[name] : +name;
    if (!(t >= 0)) throw new Error('no hour "' + name + '": ' + Object.keys(S.TIMES).join(' ') + ', or seconds into the cycle');
    state.time = t % CYCLE; M.speed = 1e-6; M.tick(); M.speed = 0; // the darkness is the sim's to set
    return { time: state.time, dark: +state.darkness.toFixed(2) };
  };
  // the camera on a world point at k device px a world px, with or without the HUD
  S.aim = function (x, y, k, hud) {
    D.setK(k, true); D.hideUI = !hud; M.cam = [x, y]; S.frame(); S.frame();
    return { k: D.getZoom().k, cam: [wOX, wOY], view: [WV_W, WV_H] };
  };
  // The world layer (ground to light: no HUD, no falling snow, no bird in flight, and
  // nothing that belongs to a view: the noon shafts, the night's dark rim) over
  // any world rect, one image px a world px. A rect wider than a view is stitched from
  // views that overlap, each kept only well inside its own edge (a pine or a tower whose
  // foot is off the view is not drawn at all, and the tallest stands 144 px over its
  // foot), all on one held clock, at the farthest zoom the world buffer holds.
  const EDGE = { l: 96, r: 96, t: 48, b: 168 };
  const farK = () => Math.max(kMin(), Math.ceil(ZOOM_FLOOR * devScale - 1e-6));
  // the view whose kept piece starts at world (x, y): where that piece sits in worldCv
  const view = (x, y) => { M.cam = [x - EDGE.l + WV_W / 2, y - EDGE.t + WV_H / 2]; S.frame(); return [x - wOX, y - wOY]; };
  // what belongs to a view and not to the world (the noon shafts, the night's dark rim)
  // is left out while `fn` runs: laid view by view it would stripe a stitched picture
  const worldOnly = (fn) => {
    const keep = [godRays, nightEdge];
    godRays = nightEdge = function () {};
    try { return fn(); } finally { [godRays, nightEdge] = keep; }
  };
  S.rect = function (x0, y0, w, h) {
    D.setK(farK(), true); D.hideUI = true; M.cam = [x0, y0]; S.frame();
    const iw = WV_W - 1 - EDGE.l - EDGE.r, ih = WV_H - 1 - EDGE.t - EDGE.b, [out, g] = canv(w, h);
    worldOnly(() => {
      for (let y = 0; y < h; y += ih) for (let x = 0; x < w; x += iw) {
        const [sx, sy] = view(x0 + x, y0 + y), pw = Math.min(iw, w - x), ph = Math.min(ih, h - y);
        g.drawImage(worldCv, sx, sy, pw, ph, x, y, pw, ph);
      }
    });
    return out;
  };
  // w x h world px centred on (x, y), each `scale` image px
  S.world = function (x, y, w, h, scale) {
    const x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2), src = S.rect(x0, y0, w, h), [c, g] = canv(w * scale, h * scale);
    g.drawImage(src, 0, 0, w, h, 0, 0, w * scale, h * scale);
    return { url: c.toDataURL('image/png'), rect: [x0, y0, w, h], scale };
  };
  // the screen as a player has it, in device px
  S.screen = function () { return { url: document.getElementById('game').toDataURL('image/png'), k: D.getZoom().k, rect: [wOX, wOY, WV_W, WV_H] }; };

  // ---- the whole map ----------------------------------------------------------------
  // The map is one stitched rect. Then a second set of views, each centred where four
  // pieces meet, is laid over the result: `seam` counts the pixels where the stitched
  // map and a view across a join disagree, so a pass that draws by the view shows up.
  S.map = function () {
    const size = WORLD * TILE, out = S.rect(0, 0, size, size), g = out.getContext('2d'), wg = worldCv.getContext('2d');
    const iw = WV_W - 1 - EDGE.l - EDGE.r, ih = WV_H - 1 - EDGE.t - EDGE.b;
    let seam = 0, joins = 0;
    worldOnly(() => {
      for (let y = ih >> 1; y < size; y += ih) for (let x = iw >> 1; x < size; x += iw) {
        const [sx, sy] = view(x, y), w = Math.min(iw, size - x), h = Math.min(ih, size - y);
        const a = wg.getImageData(sx, sy, w, h).data, b = g.getImageData(x, y, w, h).data;
        for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) seam++;
        joins++;
      }
    });
    S.mapCv = out;
    return { size, joins, seam };
  };
  S.mapPart = function (x, y, w, h) { const [c, g] = canv(w, h); g.drawImage(S.mapCv, x, y, w, h, 0, 0, w, h); return c.toDataURL('image/png'); };
  // the map at half size with every place named: for finding a spot, not for judging pixels
  S.mapSpots = function () {
    const n = S.mapCv.width >> 1, [c, g] = canv(n, n);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(S.mapCv, 0, 0, n, n); g.imageSmoothingEnabled = false;
    for (const s of S.spots()) {
      const x = Math.round(s.x / 2), y = Math.round(s.y / 2), w = pixelTextWidth(s.name, 1);
      g.fillStyle = INK; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = GOLD; g.fillRect(x - 1, y - 1, 3, 3);
      drawPixelTextOutline(g, s.name, Math.max(1, Math.min(n - w - 1, x - (w >> 1))), y + 5, PAPER, INK, 1);
    }
    return c.toDataURL('image/png');
  };

  // ---- sheets -------------------------------------------------------------------------
  // panels in a grid on a dark ground, each under its own label in the game's font:
  // [{ url, label, crop: [x, y, w, h], scale }]; nothing is ever resampled off whole px
  S.sheet = async function (panels, cols, title) {
    const ims = [];
    for (const p of panels) { const im = await load(p.url), c = p.crop || [0, 0, im.width, im.height], s = p.scale || 1; ims.push({ im, c, s, w: Math.round(c[2] * s), h: Math.round(c[3] * s), label: p.label || '' }); }
    cols = cols || ims.length;
    const PAD = 4, LAB = 14, cw = Math.max(...ims.map((p) => p.w)), ch = Math.max(...ims.map((p) => p.h)), rows = Math.ceil(ims.length / cols), top = title ? 18 : 0;
    const [c, g] = canv(cols * cw + (cols + 1) * PAD, top + rows * (ch + LAB) + (rows + 1) * PAD);
    g.fillStyle = INK; g.fillRect(0, 0, c.width, c.height);
    if (title) drawPixelText(g, title, PAD, 5, GOLD, 2);
    ims.forEach((p, i) => {
      const x = PAD + (i % cols) * (cw + PAD), y = top + PAD + Math.floor(i / cols) * (ch + LAB + PAD);
      drawPixelText(g, p.label, x, y + 2, PAPER, 2);
      g.drawImage(p.im, p.c[0], p.c[1], p.c[2], p.c[3], x, y + LAB, p.w, p.h);
    });
    return { url: c.toDataURL('image/png'), w: c.width, h: c.height };
  };
  // what differs between two same-sized pictures (inside `rect` when given): how many px,
  // the box that holds them, and the second picture greyed with only the changed pixels
  // left in colour, boxed
  S.diff = async function (urlA, urlB, rect) {
    const A = await load(urlA), B = await load(urlB);
    if (A.width !== B.width || A.height !== B.height) return { sized: [[A.width, A.height], [B.width, B.height]] };
    const [rx, ry, rw, rh] = rect || [0, 0, A.width, A.height];
    const [, ga] = canv(A.width, A.height), [cb, gb] = canv(B.width, B.height);
    ga.drawImage(A, 0, 0); gb.drawImage(B, 0, 0);
    const a = ga.getImageData(rx, ry, rw, rh).data, im = gb.getImageData(rx, ry, rw, rh), b = im.data;
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0, p = 0; i < b.length; i += 4, p++) {
      if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) { const l = (b[i] * 0.3 + b[i + 1] * 0.6 + b[i + 2] * 0.1) * 0.45 + 20; b[i] = b[i + 1] = b[i + 2] = l; continue; }
      const x = p % rw, y = (p / rw) | 0;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (!n) return { changed: 0 };
    const [co, go] = canv(rw, rh);
    go.putImageData(im, 0, 0);
    go.fillStyle = MARK;
    const bx = Math.max(0, x0 - 3), by = Math.max(0, y0 - 3), bw = Math.min(rw, x1 + 4) - bx, bh = Math.min(rh, y1 + 4) - by;
    go.fillRect(bx, by, bw, 1); go.fillRect(bx, by + bh - 1, bw, 1); go.fillRect(bx, by, 1, bh); go.fillRect(bx + bw - 1, by, 1, bh);
    return { changed: n, box: [rx + x0, ry + y0, x1 - x0 + 1, y1 - y0 + 1], url: co.toDataURL('image/png') };
  };
  return S;
})();
