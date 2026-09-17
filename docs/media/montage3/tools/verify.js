// Check every recorded clip the way the README promises, from the FILES:
//   - 1920x1080, 60 fps, every frame exactly 1/60 s after the last, AAC audio
//   - no skipped sim state in the kept frames (the webm's own capture stamps:
//     a gap plus the frame after it spanning three slots is a lost state)
//   - no cut on frame 0 (a pre-roll frame kept by the trim shows up as a first
//     frame-to-frame difference far above the rest of the clip's)
//   - the audio peak and mean
// node verify.js [name-fragment,...]
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const DIR = path.join(__dirname, '..');
const RAW = path.join(DIR, '_raw');
const report = JSON.parse(fs.readFileSync(path.join(DIR, '_report.json'), 'utf8'));
const TRIM_MARGIN = 2; // runner.js
const frags = process.argv[2] ? process.argv[2].split(',') : null;

function ff(args) { return execFileSync('ffprobe', ['-v', 'error'].concat(args)).toString(); }
function stamps(file) {
  return ff(['-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file])
    .split(/\r?\n/).filter(Boolean).map(Number).sort((a, b) => a - b);
}

let bad = 0;
for (const r of report.results) {
  if (frags && !frags.some((f) => r.name.includes(f))) continue;
  const mp4 = path.join(DIR, r.name + '.mp4');
  const issues = [];
  const st = JSON.parse(ff(['-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate', '-of', 'json', mp4])).streams;
  const v = st.find((s) => s.codec_type === 'video');
  const a = st.find((s) => s.codec_type === 'audio');
  if (!v || v.width !== 1920 || v.height !== 1080 || v.r_frame_rate !== '60/1') issues.push('format ' + JSON.stringify(v));
  if (!a || a.codec_name !== 'aac') issues.push('no aac audio');

  const t = stamps(mp4);
  let uneven = 0;
  for (let i = 1; i < t.length; i++) { const d = (t[i] - t[i - 1]) * 1000; if (d < 16 || d > 17.4) uneven++; }
  if (uneven) issues.push(uneven + ' uneven mp4 frames');

  // A lost state is a PERMANENT step: frame i lands at i/60 plus an offset,
  // and every frame after a lost one lands 16.7 ms later than before it. A
  // merely late frame only lifts its own offset, so the floor of the offset
  // over a block of frames steps up for a loss and never for lateness. The
  // blocks do not overlap: a sliding window lets the floor climb in pieces
  // too small to see.
  const w = stamps(path.join(RAW, r.name + '.webm'));
  const k = (r.skip || 0) + TRIM_MARGIN;
  const off = w.map((x, i) => (x - i / 60) * 1000);
  // Blocks at two phases, half a block apart: a loss that lands right on a
  // block edge splits its step between two blocks at one phase, never both.
  const BLOCK = 20;
  let lost = 0;
  for (const phase of [0, BLOCK >> 1]) {
    let n = 0, floor = null;
    for (let b = k + phase; b + BLOCK <= off.length; b += BLOCK) {
      let m = Infinity;
      for (let j = b; j < b + BLOCK; j++) m = Math.min(m, off[j]);
      if (floor != null && m - floor > 12) n++;
      floor = m;
    }
    lost = Math.max(lost, n);
  }
  if (lost) issues.push(lost + ' skipped state(s)');

  // compared at 96x54: the encoder's keyframe speckle in a dense texture
  // averages away at that size, and a camera cut cannot
  const diff = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', mp4, '-frames:v', '24',
    '-vf', 'scale=96:54:flags=area,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-',
    '-f', 'null', '-'], { encoding: 'utf8' }).stdout.match(/YAVG=([\d.]+)/g) || [];
  const ys = diff.map((m) => +m.split('=')[1]);
  const rest = ys.slice(1).sort((p, q) => p - q);
  const med = rest.length ? rest[rest.length >> 1] : 0;
  if (ys.length && ys[0] > Math.max(4, med * 4)) issues.push('cut on frame 0 (' + ys[0].toFixed(1) + ' vs ' + med.toFixed(1) + ')');

  const vol = spawnSync('ffmpeg', ['-hide_banner', '-i', mp4, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const peak = (/max_volume:\s*(-?[\d.]+)/.exec(vol) || [])[1];
  const mean = (/mean_volume:\s*(-?[\d.]+)/.exec(vol) || [])[1];

  if (issues.length) bad++;
  console.log(r.name.padEnd(50) + ' ' + String(t.length).padStart(3) + 'f  peak ' + String(peak).padStart(5)
    + ' dB  mean ' + String(mean).padStart(5) + ' dB  ' + (issues.length ? 'PROBLEM: ' + issues.join('; ') : 'ok'));
}
console.log(bad ? bad + ' clip(s) with problems' : 'all clips pass');
