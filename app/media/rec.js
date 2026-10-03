// Record one take of a scene: every frame (or only some) as a PNG plus log.json.
//   node app/media/rec.js <scene.js> <out dir> [--dry] [--at 0,60,120] [--seed N] [--max F]
// --dry runs the sim with no drawing and no screenshots (cheap: stage it until the
// log says every hit lands, then record). --at grabs only those frames (storyboard stills).
// The page size comes from the scene's o: w x h CSS px at dpr; the canvas is then
// o.k device px per world px, which is the S an edit needs.
'use strict';
const fs = require('fs');
const path = require('path');
const { openGame, args } = require('./browser');

(async () => {
  const A = args(process.argv.slice(2));
  const [sceneFile, out] = A._;
  if (!sceneFile || !out) { console.log('usage: node app/media/rec.js <scene.js> <out dir> [--dry] [--at f,f] [--seed N] [--max F]'); process.exit(1); }
  const src = fs.readFileSync(sceneFile, 'utf8');
  // the scene's options, read without a browser: the first `o: {...}` JSON literal
  const O = Function('window', src + '\n;return window.SCENE.o')({});
  const seed = +(A.seed || O.seed || 6);
  fs.mkdirSync(out, { recursive: true });
  const pg = await openGame({ seed, width: O.w || 540, height: O.h || 960, dpr: O.dpr || 2 });
  await pg.inject(path.join(__dirname, 'stage.js'));
  await pg.eval(src + '\n;true');
  const boot = await pg.eval((o) => MEDIA.boot(o), O);
  const setup = await pg.eval(() => SCENE.setup ? SCENE.setup(MEDIA) : null);
  console.log('boot', JSON.stringify(boot), 'setup', JSON.stringify(setup));
  if (!boot.exact) console.log('WARNING: zoom is not a whole device px per world px; pixels will not be exact');
  const at = new Set(String(A.at || '').split(',').filter(Boolean).map(Number));
  const dry = !!A.dry, all = !dry && !at.size;
  if (dry) await pg.eval(() => { MEDIA.draw = false; });
  const max = +(A.max || O.max || 1800), rows = [], t0 = Date.now();
  for (let f = 0; f < max; f++) {
    if (at.size && !dry) await pg.eval((d) => { MEDIA.draw = d; }, at.has(f));
    const r = await pg.eval(() => MEDIA.tick());
    rows.push(r);
    if (all || at.has(f)) await pg.shot(path.join(out, `f${String(f).padStart(4, '0')}.png`));
    if (f % 60 === 0) console.log(`frame ${f}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (r.done) break;
    if (at.size && f >= Math.max(...at)) break;
  }
  const sum = await pg.eval(() => MEDIA.summary());
  fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify({ o: O, seed, S: sum.k, setup, rows, ...sum }));
  console.log('frames', rows.length, 'marks', JSON.stringify(Object.fromEntries(Object.entries(sum.marks).map(([k, v]) => [k, v.length]))),
    'hits', sum.hits.length, 'cues', sum.ev.length, 'S', sum.k);
  await pg.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
