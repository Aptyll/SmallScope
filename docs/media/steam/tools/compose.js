'use strict';
// Composite every capsule: the captured frame, the grade, the scrim and the
// wordmark. The layout of each one is here; the painting is in paint.js.
//   node compose.js            # all of them
//   node compose.js header     # just one
const fs = require('fs');
const path = require('path');
const R = require('./rig.js');
const PAINT = require('./paint.js');

const RAW = path.join(R.HERE, 'raw');
// the finished capsules land in the repo, beside the montage's clips
// the finished capsules land one level up, beside this tools folder
const OUT = process.env.STORE_OUT || path.join(R.HERE, '..');
const LOGO = path.join(R.HERE, 'logo-full.png');

// out: the capsule's exact size. anchor: where in the captured frame the band
// is cut from (0 top .. 1 bottom). logo_w/cx/cy are fractions of the capsule.
const LAYOUT = {
  // ---- the store page's own capsules --------------------------------------
  // every capsule carries the word across the top and the roost under it: a
  // 2.1:1 frame has no room beside a bird whose weight is two spread wings
  'header-capsule':   { src: 'header',    out: [920, 430],  anchor: 0.5, grade: 0.06, vig: 0.32,
    logo_w: 0.55, logo_cx: 0.5, logo_cy: 0.20, scrim: { cx: 0.5, cy: 0.17, rx: 0.56, ry: 0.34, a: 0.62 } },
  'library-header':   { src: 'libheader', out: [920, 430],  anchor: 0.5, grade: 0.06, vig: 0.32,
    logo_w: 0.55, logo_cx: 0.5, logo_cy: 0.20, scrim: { cx: 0.5, cy: 0.17, rx: 0.56, ry: 0.34, a: 0.62 } },
  // at 462x174 the art is a texture and the word is the whole job
  'small-capsule':    { src: 'small',     out: [462, 174],  anchor: 0.5,  grade: 0.12, vig: 0.30,
    logo_w: 0.74, logo_cx: 0.5, logo_cy: 0.36,  scrim: { cx: 0.5, cy: 0.34, rx: 0.78, ry: 0.72, a: 0.52 } },
  // the tall ones: word across the top, the roost under it
  'main-capsule':     { src: 'main',      out: [1232, 706], anchor: 0.5,  grade: 0.06, vig: 0.34,
    logo_w: 0.58, logo_cx: 0.5, logo_cy: 0.22, scrim: { cx: 0.5, cy: 0.20, rx: 0.56, ry: 0.34, a: 0.62 } },
  'vertical-capsule': { src: 'vertical',  out: [748, 896],  anchor: 0.5,  grade: 0.06, vig: 0.34,
    logo_w: 0.82, logo_cx: 0.5, logo_cy: 0.14, scrim: { cx: 0.5, cy: 0.12, rx: 0.82, ry: 0.24, a: 0.66 } },
  'library-capsule':  { src: 'libcap',    out: [600, 900],  anchor: 0.5,  grade: 0.06, vig: 0.34,
    logo_w: 0.84, logo_cx: 0.5, logo_cy: 0.13, scrim: { cx: 0.5, cy: 0.11, rx: 0.86, ry: 0.22, a: 0.66 } },
  'page-background':  { src: 'pagebg',    out: [1438, 810], anchor: 0.5,  grade: 0.18, vig: 0.45 },
  // the library logo: the word on nothing at all, trimmed close, with the
  // title screen's halo and only a whisper of the dark bed - it is laid over
  // the hero, which is already dark
  // the canvas is cut wide enough that the halo lands INSIDE it: a glow the
  // edge clips leaves a soft rectangle around the word on a dark hero
  'library-logo':     { bare: true, out: [1280, 470], bed: 0.35, halo: 0.45,
    logo_w: 0.86, logo_cx: 0.5, logo_cy: 0.5 },
  // the hero carries no word: Steam lays the library logo over it itself
  'library-hero':     { src: 'hero',      out: [3840, 1240], anchor: 0.5, grade: 0.12, vig: 0.40,
    // a weighted foot, so whatever position the library logo is given over
    // this art has something to sit on
    foot: { h: 0.45, a: 0.42 } },
};

(async () => {
  const names = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  // the keyed wordmark is generated, not kept: key it on demand
  if (!fs.existsSync(LOGO)) require('child_process').execFileSync(process.execPath, [path.join(R.HERE, 'keylogo.js')], { stdio: 'inherit' });
  const logo = 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64');
  const c = await R.open();
  await c.eval('!!window.PAINT').catch(() => {});
  await c.eval(PAINT);
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, L] of Object.entries(LAYOUT)) {
    if (names.length && !names.includes(name) && !names.includes(L.src)) continue;
    const srcFile = L.bare ? null : path.join(RAW, L.src + '.png');
    if (srcFile && !fs.existsSync(srcFile)) { console.log(name.padEnd(18), 'NO FRAME', srcFile); continue; }
    const job = Object.assign({}, L, {
      bg: srcFile ? 'data:image/png;base64,' + fs.readFileSync(srcFile).toString('base64') : null,
      logo: L.logo_w ? logo : null,
    });
    const b64 = await c.eval('PAINT(' + JSON.stringify(job) + ')');
    const dest = path.join(OUT, name + '.png');
    fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
    console.log(name.padEnd(18), L.out[0] + 'x' + L.out[1],
      (Math.round(fs.statSync(dest).size / 1024) + 'KB').padStart(8),
      L.logo_w ? 'word ' + Math.round(L.logo_w * 100) + '%' : 'no word');
  }
  c.close();
})().catch((e) => { console.error(e); process.exit(1); });
