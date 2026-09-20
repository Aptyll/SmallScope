'use strict';
// The wordmark on transparency, at the resolution it was painted at - the
// same key the game's own app/bake-logo.js runs (a flood from the corners
// over everything that is not the letters' dark outline), but with no shrink,
// because a capsule wants the big copy and the title bar wants the small one.
//   node keylogo.js            -> logo-full.png (the word box, tight)
const fs = require('fs');
const path = require('path');
const { decodePNG, encodePNG } = require('./png.js');

const SRC = path.join(__dirname, '..', '..', 'logos', 'mainMenuSoftfall.png');
const OUT = path.join(__dirname, 'logo-full.png');
const OUTLINE_MAX = 70; // a channel above this is not outline navy

const { w, h, px } = decodePNG(fs.readFileSync(SRC));
const outline = (x, y) => { const d = (y * w + x) * 4; return px[d] <= OUTLINE_MAX && px[d + 1] <= OUTLINE_MAX && px[d + 2] <= OUTLINE_MAX; };

const sky = new Uint8Array(w * h);
const stack = [];
for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) if (!outline(x, y)) { sky[y * w + x] = 1; stack.push(x, y); }
while (stack.length) {
  const y = stack.pop(), x = stack.pop();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const i = ny * w + nx;
    if (sky[i] || outline(nx, ny)) continue;
    sky[i] = 1; stack.push(nx, ny);
  }
}
let x0 = w, y0 = h, x1 = -1, y1 = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!sky[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
if (x1 < 0) throw new Error('nothing survived the key');

const gw = x1 - x0 + 1, gh = y1 - y0 + 1;
const out = Buffer.alloc(gw * gh * 4);
for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
  const s = ((y0 + y) * w + (x0 + x)) * 4, d = (y * gw + x) * 4;
  if (sky[(y0 + y) * w + (x0 + x)]) continue;
  out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = 255;
}
fs.writeFileSync(OUT, encodePNG(gw, gh, out));
console.log('word box ' + x0 + ',' + y0 + ' - ' + x1 + ',' + y1 + '  ->  ' + gw + 'x' + gh + '  ' +
  (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB  ' + OUT);
