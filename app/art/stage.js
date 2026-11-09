// New art in a real game frame, at the game's own zoom, beside today's hero and beasts.
// Each PNG stands in the world as a beast would: the game draws it, its shade, its health
// frame and the light over it, so nothing is pasted on afterwards. The frame is STAGED: the
// art is not in the game yet. Needs `node app/server.js` up.
//   node app/art/stage.js --out frame.png --art a.png,b.png [--refs hero,wolf,deer,bear] [--hero ARMATOS]
//        [--ground snow|dirt|both] [--k 4] [--time 0.45] [--bars 0] [--face left|right] [--cut refs/]
// --art PNGs are 1x, drawn facing --face (default left; the other way is mirrored).
// --cut DIR also saves today's sprites as 1x PNGs (hero.png, wolf.png, deer.png, bear.png,
// rabbit.png) for the board and the checks to measure against.
// Prints one JSON line: the crop of the frame that holds the line-up.
'use strict';
const fs = require('fs');
const path = require('path');
const { openGame, args } = require('../media/browser');

(async () => {
  const A = args(process.argv.slice(2));
  if (!A.out && !A.cut) { console.log('usage: node app/art/stage.js --out frame.png --art a.png[,b.png] [--refs hero,wolf,deer,bear] [--ground snow|dirt|both] [--cut DIR]'); process.exit(1); }
  const art = String(A.art || '').split(',').filter(Boolean).map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
  const refs = String(A.refs == null ? 'hero,wolf,deer,bear' : A.refs).split(',').filter(Boolean);
  const grounds = A.ground === 'both' || !A.ground ? ['snow', 'dirt'] : [A.ground];
  const k = +(A.k || 4);
  const pg = await openGame({ seed: +(A.seed || 7), width: 1280, height: 720, dpr: 1 });
  await pg.inject(path.join(__dirname, '..', 'media', 'stage.js'));
  const info = await pg.eval(async (o) => {
    const M = MEDIA; M.boot({ k: o.k, time: o.time });
    M.park(animals, -4000, -4000);
    // the art as game sprites: a canvas each way, as bake() makes them
    const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = src; });
    const canv = (im, flip) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); if (flip) { g.scale(-1, 1); g.drawImage(im, -im.width, 0); } else g.drawImage(im, 0, 0); return c; };
    const sets = [];
    for (const src of o.art) { const im = await load(src); const a = canv(im, false), b = canv(im, true); sets.push(o.face === 'right' ? { right: a, left: b } : { left: a, right: b }); }
    const base = clipFrame;
    clipFrame = (set, a) => (a.staged ? a.staged[a.dir] : base(set, a)); // a staged beast wears its PNG
    // a strip of one ground wide enough for the line-up: snow is ground 0, the worn dirt is the lanes'
    const widths = o.refs.map((r) => (r === 'bear' ? 76 : r === 'deer' ? 44 : 26)).concat(sets.map((s) => s.left.width + 14));
    const total = widths.reduce((a, b) => a + b, 0);
    const tilesW = Math.ceil(total / TILE) + 4;
    // a strip of open ground wide enough for the line-up: clean snow, or the road's worn earth
    // (ground 3, placeRoad), where most of the strip's own row must be road
    const spot = (road) => {
      for (let ty = 24; ty < WORLD - 24; ty++) for (let tx = 24; tx < WORLD - 24 - tilesW; tx++) {
        let ok = true, on = 0;
        for (let dy = -3; dy <= 2 && ok; dy++) for (let dx = 0; dx < tilesW && ok; dx++) {
          const i = (ty + dy) * WORLD + tx + dx, g = ground[i];
          if (objects[i] || waterAt(tx + dx, ty + dy) || g === 1 || g === 2) ok = false;
          else if (!road && g !== 0) ok = false;
          else if (road && dy >= -1 && dy <= 0 && g === 3) on++;
        }
        if (ok && (!road || on >= tilesW * 2 * 0.9)) return [tx * TILE, (ty + 0.5) * TILE];
      }
      return null;
    };
    const rows = [];
    const hero = Math.max(0, CLASSES.findIndex((c) => c.name === o.hero));
    for (const gname of o.grounds) {
      const at = spot(gname === 'dirt'); if (!at) continue;
      rows.push({ ground: gname, x: at[0], y: at[1], w: total + 2 * TILE });
    }
    if (!rows.length) return { error: 'no open ground found' };
    // the whole line-up in one view: step the zoom down by whole numbers until it fits
    for (let kk = o.k; kk > 1 && total + TILE > WV_W; ) { DBG.setK(--kk, true); M.tick(); }
    // the camera can hold one row: the first ground is the frame, the others are further frames
    const out = [];
    for (const R of rows) {
      M.park(animals.filter((a) => a.staged || a.ref), -4000, -4000);
      for (let i = animals.length - 1; i >= 0; i--) if (animals[i].staged || animals[i].ref) animals.splice(i, 1);
      let x = R.x + TILE;
      const place = (w, fn) => { fn(x + w / 2); x += w; };
      o.refs.forEach((r, i) => place(widths[i], (cx) => {
        if (r === 'hero') { setClass(player, hero); player.x = cx; player.y = R.y; player.dir = 'down'; player.vx = player.vy = 0; return; }
        const a = makeAnimal(r === 'bear' ? 'dire' : r, cx, R.y, { dir: 'left' }); a.idleT = 1e9; a.ref = true; animals.push(a);
      }));
      sets.forEach((s, i) => place(widths[o.refs.length + i], (cx) => {
        const a = makeAnimal('wolf', cx, R.y, { dir: 'left' }); a.idleT = 1e9; a.staged = s; a.home = null; animals.push(a);
      }));
      if (!o.refs.includes('hero')) { player.x = -4000; player.y = -4000; }
      M.cam = [R.x + R.w / 2, R.y - 8];
      M.speed = 0; for (let i = 0; i < 12; i++) M.tick();
      R.cam = [camX, camY]; R.view = [WV_W, WV_H];
      out.push(R);
      if (out.length === 1 && rows.length > 1) window.__rows = rows;
    }
    // today's sprites at 1x, for the board
    const cut = {};
    if (o.cut) {
      const url = (c) => { const d = document.createElement('canvas'); d.width = c.width; d.height = c.height; d.getContext('2d').drawImage(c, 0, 0); return d.toDataURL(); };
      for (const [name, kind] of [['wolf', 'wolf'], ['deer', 'deer'], ['bear', 'dire'], ['rabbit', 'rabbit']]) cut[name] = url(SPRITES[kind].left.idle[0]);
    }
    return { rows: out, k: DBG.getZoom().k, cut, heroName: CLASSES[hero].name };
  }, { art, refs, grounds, k, time: A.time != null ? +A.time : 0.45, hero: String(A.hero || 'ARMATOS').toUpperCase(), face: A.face || 'left', cut: !!A.cut });
  if (info.error) { console.error(info.error); process.exit(1); }
  // one shot per ground: move the camera, tick, shoot
  const shots = [];
  for (let i = 0; i < info.rows.length; i++) {
    const R = info.rows[i];
    if (i > 0) await pg.eval((R) => { MEDIA.cam = [R.x + R.w / 2, R.y - 8]; for (let j = 0; j < 12; j++) MEDIA.tick(); return true; }, R);
    if (A.out) { const f = A.out.replace(/\.png$/, '-' + R.ground + '.png'); await pg.shot(f); shots.push({ ground: R.ground, file: f }); }
  }
  if (A.cut) {
    fs.mkdirSync(A.cut, { recursive: true });
    for (const n in info.cut) fs.writeFileSync(path.join(A.cut, n + '.png'), Buffer.from(info.cut[n].split(',')[1], 'base64'));
  }
  console.log(JSON.stringify({ shots, k: info.k, hero: info.heroName, ground_y: 0.5 + 8 * info.k / 720 }));
  await pg.close();
})();
