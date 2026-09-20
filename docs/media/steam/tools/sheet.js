'use strict';
// Tile finished capsules into one sheet, so a whole set can be judged at once.
// Each one is letterboxed into the same square cell FIRST - ffmpeg's concat
// demuxer will not re-init the filter graph for differently sized stills.
//   node sheet.js out 3 480 header-capsule main-capsule ...
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FFMPEG = 'R:/ffmpeg/bin/ffmpeg.exe';

const dir = process.argv[2];
const cols = Number(process.argv[3] || 3);
const cell = Number(process.argv[4] || 480);
let names = process.argv.slice(5);
if (!names.length) names = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, ''));

const tmp = path.join(__dirname, 'shots', '_cells');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
names.forEach((n, i) => {
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.resolve(dir, n + '.png'),
    '-vf', 'scale=' + cell + ':' + cell + ':force_original_aspect_ratio=decrease,pad=' + cell + ':' + cell +
      ':(ow-iw)/2:(oh-ih)/2:color=0x151b2a',
    path.join(tmp, String(i).padStart(2, '0') + '.png')]);
});
const listFile = path.join(tmp, 'in.txt');
fs.writeFileSync(listFile, names.map((n, i) =>
  "file '" + path.resolve(tmp, String(i).padStart(2, '0') + '.png').replace(/\\/g, '/') + "'").join('\n'));
const out = path.join(__dirname, 'shots', 'contact.png');
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
  '-vf', 'tile=' + cols + 'x' + Math.ceil(names.length / cols) + ':padding=6:color=0x2a3450',
  '-frames:v', '1', out]);
console.log(names.join(' '), '->', out);
