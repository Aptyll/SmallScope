'use strict';
// Capture every background frame in the shot list, at the capsule's own size.
//   node shoot.js              # all of them
//   node shoot.js hero main    # just those
const path = require('path');
const R = require('./rig.js');
const SHOTS = require('./shots.js');

const OUT = path.join(R.HERE, 'raw');   // the frames stay here; compose.js writes the capsules

(async () => {
  const names = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const list = SHOTS.filter((s) => !names.length || names.includes(s.name));
  const c = await R.open();
  console.log('#', await R.ready(c, process.argv.includes('-r')));
  for (const s of list) {
    const r = await R.shoot(c, s, OUT);
    console.log(s.name.padEnd(11), (r.dims[3] + 'x' + r.dims[4]).padEnd(11),
      'dev ' + r.dims[2], 'kpx ' + r.kpx.toFixed(2) + (r.kpx === s.kpx ? '' : ' WANTED ' + s.kpx),
      'world ' + Math.round(r.dims[3] / r.kpx) + 'x' + Math.round(r.dims[4] / r.kpx),
      (r.kb + 'KB').padStart(7), r.errors.length ? JSON.stringify(r.errors) : '');
  }
  c.close();
})().catch((e) => { console.error(e); process.exit(1); });
