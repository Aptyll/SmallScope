// Today's sprites out of the running game, as 1x PNGs: the place every redraw starts from.
// The game bakes its sprites at load (js/sprites/, js/baked/), so what this saves is exactly what
// a player sees, team paint and all. Needs `node app/server.js` up.
//   node app/art/cut.js --list [pattern]            every sprite's name and size (SPRITES.<name>)
//   node app/art/cut.js --out DIR pattern [...]     save the sprites whose name holds a pattern
// A name is the path under SPRITES: scrap.left.idle.0, tree.0, teamBuild.0.stall, orca.right.idle.0.
// Then `Art.from_png('DIR/scrap.left.idle.0.png')` (app/art/px.py) is that sprite as a grid to edit.
'use strict';
const fs = require('fs');
const path = require('path');
const { openGame, args } = require('../media/browser');

(async () => {
  const argv = process.argv.slice(2);
  const A = args(argv);
  const pats = argv.filter((v, i) => !v.startsWith('--') && !(i > 0 && argv[i - 1] === '--out'));
  if (!A.list && !A.out) { console.log('usage: node app/art/cut.js --list [pattern] | --out DIR pattern [...]'); process.exit(1); }
  const pg = await openGame({ seed: 7, width: 640, height: 360, dpr: 1 });
  const list = await pg.eval((pats, want) => {
    const seen = new Set(), res = [];
    const isCv = (v) => v instanceof HTMLCanvasElement || (typeof OffscreenCanvas !== 'undefined' && v instanceof OffscreenCanvas);
    const walk = (v, name, depth) => {
      if (!v || typeof v !== 'object' || seen.has(v) || depth > 7) return;
      seen.add(v);
      if (isCv(v)) {
        if (!v.width || v.width * v.height > 512 * 512) return;
        if (pats.length && !pats.some((p) => name.includes(p))) return;
        const row = { name, w: v.width, h: v.height };
        if (want) { const c = document.createElement('canvas'); c.width = v.width; c.height = v.height; c.getContext('2d').drawImage(v, 0, 0); row.url = c.toDataURL('image/png'); }
        res.push(row); return;
      }
      if (Array.isArray(v)) { v.forEach((x, i) => walk(x, name + '.' + i, depth + 1)); return; }
      for (const k of Object.keys(v)) walk(v[k], name ? name + '.' + k : k, depth + 1);
    };
    walk(SPRITES, '', 0);
    return res;
  }, pats, !!A.out);
  if (A.out) {
    fs.mkdirSync(A.out, { recursive: true });
    for (const s of list) fs.writeFileSync(path.join(A.out, s.name + '.png'), Buffer.from(s.url.split(',')[1], 'base64'));
  }
  for (const s of list) console.log(s.name + ' ' + s.w + 'x' + s.h);
  if (!list.length) console.log('no sprite matches: try --list');
  await pg.close();
})();
