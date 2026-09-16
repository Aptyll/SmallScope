// Stage a battle scene and take a STILL, without recording it: the fast loop
// for getting a shot framed before it costs a clip's worth of wall time.
//   node shot.js            every scene
//   node shot.js 05-stomp   one, by name fragment
//   WAIT=3200 node shot.js  ...held this many ms into the roll first
// Stills land in tools/shots/ (gitignored).
const { run } = require('./probe');
const { scenes } = require('./scenes');
const pick = process.argv[2] ? scenes.filter(s => s.name.includes(process.argv[2])) : scenes;
run(pick.map(s => ({ name: s.name, stage: s.stage, roll: s.roll, wait: +(process.env.WAIT || 2500), full: true })));
