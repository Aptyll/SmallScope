// Stills of ONE scene at several moments of a single roll, with the local
// player's position and the camera read out at each: node timeline.js 16- 300,800,1500
const { run } = require('./probe');
const { scenes } = require('./scenes');
const s = scenes.find(x => x.name.includes(process.argv[2]));
const at = (process.argv[3] || '500,1000,2000').split(',').map(Number);
const READ = `JSON.stringify({ p: [Math.round(player.x), Math.round(player.y)], dead: player.dead, dodge: +player.dodgeT.toFixed(2),
  cam: [camX, camY], wv: [WV_W, WV_H], zip: player.zip, gold: player.inv.gold, drops: drops.length, err: __M.err })`;
const jobs = [{ name: 'tl-' + s.name + '-0', stage: s.stage, roll: s.roll, title: s.title, wait: at[0], full: true }];
for (let i = 1; i < at.length; i++) jobs.push({ name: 'tl-' + s.name + '-' + i, stage: READ, title: s.title, keep: true, wait: at[i] - at[i - 1], full: true });
jobs.push({ name: 'tl-' + s.name + '-end', stage: READ, title: s.title, keep: true, wait: 10, full: true });
run(jobs);
