// Contact sheets of the RECORDED clips, not the staged stills: four frames of
// each mp4 (at 15%, 40%, 65% and 90% of it) in a row, six clips a sheet, into
// tools/shots/review-N.png.   node review.js [name-fragment,...]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const frags = process.argv[2] ? process.argv[2].split(',') : null;
const clips = fs.readdirSync(DIR)
  .filter((f) => f.endsWith('.mp4') && (!frags || frags.some((x) => f.includes(x))))
  .sort();

for (let s = 0; s * 6 < clips.length; s++) {
  const group = clips.slice(s * 6, s * 6 + 6);
  const args = ['-y', '-loglevel', 'error'];
  let filt = '';
  let stack = '';
  group.forEach((f, i) => {
    const n = +execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0',
      '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', path.join(DIR, f)]).toString().trim();
    const at = [0.15, 0.4, 0.65, 0.9].map((u) => Math.floor(n * u));
    // inside the filtergraph's single quotes a comma still has to be escaped
    const sel = at.map((k) => 'eq(n\\,' + k + ')').join('+');
    args.push('-i', path.join(DIR, f));
    filt += '[' + i + ":v]select='" + sel + "',scale=480:270,tile=4x1[r" + i + '];';
    stack += '[r' + i + ']';
  });
  filt += stack + (group.length > 1 ? 'vstack=inputs=' + group.length : 'null') + '[o]';
  const out = path.join(OUT, 'review-' + s + '.png');
  execFileSync('ffmpeg', args.concat(['-filter_complex', filt, '-map', '[o]', '-frames:v', '1', out]));
  console.log(path.basename(out) + ': ' + group.join(' '));
}
