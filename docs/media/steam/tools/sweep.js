'use strict';
// A sweep at one capsule size, tiled into a sheet to pick from.
//   node sweep.js main -k 3 4 5 6      # zoom rungs
//   node sweep.js main -s 24 32 40 48  # frames into the action
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const R = require('./rig.js');
const SHOTS = require('./shots.js');

const FFMPEG = 'R:/ffmpeg/bin/ffmpeg.exe';
const OUT = path.join(R.HERE, 'shots', 'sweep');

(async () => {
  const argv = process.argv.slice(2);
  const name = argv.shift();
  const mode = argv.shift();                 // -k or -s
  const vals = argv.map(Number);
  const base = SHOTS.find((s) => s.name === name);
  if (!base) throw new Error('no shot ' + name);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(R.HERE, 'shots'), { recursive: true });
  const c = await R.open();
  console.log('#', await R.ready(c, process.argv.includes('-r')));
  const files = [];
  for (const v of vals) {
    const s = Object.assign({}, base, { name: name + mode[1] + v });
    if (mode === '-k') s.stage = base.stage.replace(/SA\.shotK\(([^;]*), \d+\);/, 'SA.shotK($1, ' + v + ');');
    else if (mode === '-t') s.stage = base.stage.replace(/state\.time = [\d.]+;/, 'state.time = ' + v + ';');
    else if (mode === '-x') s.stage = base.stage.replace(/\.x \+ -?\d+,/, '.x + ' + v + ',');
    else if (mode === '-y') s.stage = base.stage.replace(/\.y \+ -?\d+,/, '.y + ' + v + ',');
    else s.settle = v;
    const r = await R.shoot(c, s, OUT);
    files.push(r.file);

    console.log(s.name.padEnd(14), 'kpx ' + r.kpx, 'settle ' + s.settle,
      'world ' + Math.round(r.dims[3] / r.kpx) + 'x' + Math.round(r.dims[4] / r.kpx),
      r.errors.length ? JSON.stringify(r.errors) : '');
  }
  c.close();
  const listFile = path.join(OUT, 'in.txt');
  fs.writeFileSync(listFile, files.map((s) => "file '" + s.replace(/\\/g, '/') + "'").join('\n'));
  const sheet = path.join(R.HERE, 'shots', 'sweep-' + name + '.png');
  const cols = files.length <= 2 ? files.length : (files.length <= 6 ? 2 : 3);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', 'scale=' + (cols === 3 ? 420 : 620) + ':-1,tile=' + cols + 'x' + Math.ceil(files.length / cols) + ':padding=4:color=0x202838',
    '-frames:v', '1', sheet]);
  console.log('->', sheet);
})().catch((e) => { console.error(e); process.exit(1); });
