// Bakes docs/media/logos/mainMenuSoftfall.png into js/logodata.js as a PNG
// data URL, keyed out of its sky, trimmed and shrunk SHRINK times, so the
// title's logo works with no server at all - opening index.html
// off the disk is a first-class way to run this game, and an <img> read off a
// file:// path taints the canvas it is drawn on (the /shot sink and every
// getImageData would die), where a data: URL taints nothing.
//
//   node app/bake-logo.js          # rerun after replacing the picture
//   node app/bake-logo.js --probe  # print what it sees (size, the key's box)
//
// The picture is the word on an opaque painted sky. The KEY is a flood from
// the four corners over everything that is not the letters' dark outline
// (OUTLINE_MAX per channel): the sky, the clouds and the glow all go, the
// fill stops dead at the outline, and whatever it never reached - the outline,
// the faces, the counters, the inner shade - is the logo. The picture is
// painted big and not on a clean pixel grid, so the bake box-filters it down
// SHRINK times (colour and coverage averaged per cell, so an edge lands soft)
// to the size the 640-wide view draws it at 1:1 (js/ui/menu.js).
//
// No packages: PNG decode/encode is zlib + the five filters, below.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'media', 'logos', 'mainMenuSoftfall.png');
const OUT = path.join(ROOT, 'js', 'logodata.js');
const OUTLINE_MAX = 70; // a channel above this is not outline navy
const SHRINK = 4;       // source px per baked px
const PROBE = process.argv.includes('--probe');

// ---- PNG in ---------------------------------------------------------------
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; if (data[12]) throw new Error('interlaced PNG'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error('bit depth ' + depth);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  if (!ch) throw new Error('colour type ' + ctype);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0, x = line[i];
      let v;
      if (f === 0) v = x;
      else if (f === 1) v = x + a;
      else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const s = x * ch, d = (y * w + x) * 4;
      if (ch === 1) { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = 255; }
      else if (ch === 2) { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = cur[s + 1]; }
      else if (ch === 3) { out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = 255; }
      else { out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = cur[s + 3]; }
    }
    [prev, cur] = [cur, prev];
  }
  return { w, h, px: out };
}

// ---- PNG out --------------------------------------------------------------
const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; }
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // RGBA, no interlace
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- the bake -------------------------------------------------------------
const img = decodePNG(fs.readFileSync(SRC));
const { w, h, px } = img;
const outline = (x, y) => { const d = (y * w + x) * 4; return px[d] <= OUTLINE_MAX && px[d + 1] <= OUTLINE_MAX && px[d + 2] <= OUTLINE_MAX; };

// flood from the corners over everything that is not outline
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
// the bounding box of what survived
let x0 = w, y0 = h, x1 = -1, y1 = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!sky[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
if (x1 < 0) throw new Error('nothing survived the key');

const gw = Math.ceil((x1 - x0 + 1) / SHRINK), gh = Math.ceil((y1 - y0 + 1) / SHRINK);

if (PROBE) {
  const sample = (x, y) => { const d = (y * w + x) * 4; return [px[d], px[d + 1], px[d + 2]].join(','); };
  console.log('picture ' + w + 'x' + h + '; word box ' + x0 + ',' + y0 + ' - ' + x1 + ',' + y1 + ' (' + (x1 - x0 + 1) + 'x' + (y1 - y0 + 1) + ')');
  console.log('shrink ' + SHRINK + ' -> ' + gw + 'x' + gh);
  console.log('corner ' + sample(0, 0) + '; centre ' + sample(w >> 1, h >> 1) + '; box centre ' + sample((x0 + x1) >> 1, (y0 + y1) >> 1));
  process.exit(0);
}

// box filter: each baked px averages its SHRINK x SHRINK cell's logo pixels,
// with coverage as alpha; a sky px adds nothing
const out = Buffer.alloc(gw * gh * 4);
for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
  let r = 0, g = 0, b = 0, n = 0, tot = 0;
  for (let dy = 0; dy < SHRINK; dy++) for (let dx = 0; dx < SHRINK; dx++) {
    const sx = x0 + gx * SHRINK + dx, sy = y0 + gy * SHRINK + dy;
    if (sx > x1 || sy > y1) continue;
    tot++;
    if (sky[sy * w + sx]) continue;
    const s = (sy * w + sx) * 4;
    r += px[s]; g += px[s + 1]; b += px[s + 2]; n++;
  }
  if (!n) continue;
  const d = (gy * gw + gx) * 4;
  out[d] = Math.round(r / n); out[d + 1] = Math.round(g / n); out[d + 2] = Math.round(b / n); out[d + 3] = Math.round(255 * n / tot);
}
const png = encodePNG(gw, gh, out);
const lines = [
  '// GENERATED by app/bake-logo.js - do not edit by hand.',
  '// docs/media/logos/mainMenuSoftfall.png keyed out of its sky and dropped to',
  '// shrunk ' + SHRINK + 'x to ' + gw + 'x' + gh + ', as a data URL so the title needs no',
  '// server and taints no canvas. Rerun `node app/bake-logo.js` after replacing it.',
  "window.LOGO_PNG = 'data:image/png;base64," + png.toString('base64') + "';",
  '',
];
fs.writeFileSync(OUT, lines.join('\r\n'));
console.log('baked ' + gw + 'x' + gh + ' (shrink ' + SHRINK + ') -> ' + (png.length / 1024).toFixed(1) + ' KB at ' + path.relative(ROOT, OUT));
