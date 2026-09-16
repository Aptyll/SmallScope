const { main } = require('./runner');
const { scenes } = require('./scenes');
const pick = process.argv[2] ? scenes.filter(s => s.name.includes(process.argv[2])) : scenes;
main(pick).then((r) => {
  const bad = r.filter(x => x.error || !x.audio);
  console.log('\nclips:', r.length, 'problems:', bad.length);
  if (bad.length) console.log(JSON.stringify(bad, null, 1));
  process.exit(0);
}).catch(e => { console.error('FAIL', e.stack); process.exit(1); });
