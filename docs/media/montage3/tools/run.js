const { main } = require('./runner');
const { scenes } = require('./scenes');
// one fragment, or several comma-separated: node run.js 05-,19-,32-
const frags = process.argv[2] ? process.argv[2].split(',').filter(Boolean) : null;
const pick = frags ? scenes.filter(s => frags.some(f => s.name.includes(f))) : scenes;
main(pick).then((r) => {
  const bad = r.filter(x => x.error || !x.audio);
  console.log('\nclips:', r.length, 'problems:', bad.length);
  if (bad.length) console.log(JSON.stringify(bad, null, 1));
  process.exit(0);
}).catch(e => { console.error('FAIL', e.stack); process.exit(1); });
