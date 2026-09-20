'use strict';
// Attach to the standing page and evaluate an expression against it.
//   node q.js "JSON.stringify(SA.tileOf(SA.mine()))"
//   node q.js -f map.js          # read the expression from a file
const fs = require('fs');
const R = require('./rig.js');

(async () => {
  const a = process.argv.slice(2);
  const expr = a[0] === '-f' ? fs.readFileSync(a[1], 'utf8') : a.join(' ');
  const c = await R.open();
  console.log('#', await R.ready(c, process.argv.includes('-r')));
  console.log(await c.eval('(function(){' + (expr.includes('return') ? expr : 'return (' + expr + ')') + '})()'));
  if (c.errors.length) console.log('# errors', JSON.stringify(c.errors));
  c.close();
})().catch((e) => { console.error(e); process.exit(1); });
