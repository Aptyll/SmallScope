// Stage a battle scene and take a STILL, without recording it: the fast loop
// for getting a shot framed before it costs a clip's worth of wall time.
//   node shot.js            every scene
//   node shot.js 05-stomp   one, by name fragment
//   WAIT=3200 node shot.js  ...held this many ms into the roll first
// Stills land in tools/shots/ (gitignored).
const { run } = require('./probe');
const { scenes } = require('./scenes');
// one fragment, or several comma-separated: node run.js 05-,19-,32-
const frags = process.argv[2] ? process.argv[2].split(',').filter(Boolean) : null;
const pick = frags ? scenes.filter(s => frags.some(f => s.name.includes(f))) : scenes;
run(pick.map(s => ({ name: s.name, stage: s.stage, roll: s.roll, title: s.title, wait: +(process.env.WAIT || 2500), full: true })));
