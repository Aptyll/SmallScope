'use strict';
// ------------------------------------------------------------ ice breaks, drawn
// The pixels of a break (the thing itself, its footprint and its clock:
// js/sim/icebreak.js). Each break owns a small canvas over its box, repainted
// every frame it is on screen from its age, and laid flat over the ground
// right after the ice fish in render(). Under it the ground canvas still
// shows the sheet, even on a tile the break holds open (paintGroundTile asks
// iceBreakHolds), so what reads as water here is exactly the break's shape:
//   the warning   bright cracks tracing the outline round, before it opens
//   open water    the footprint chipped, dark under its far (top) lip, glints
//   the plates    the sheet over the footprint in its own Voronoi cells, flung
//                 out in an arc; the ones that land on ice lie there and melt
//                 into it as it freezes
//   the cracks    cell edges in a band round the hole and a few long ones
//                 walking out from the rim, fading as it freezes
//   the freeze    from the rim inward, a ragged front with a glint on it, the
//                 new ice dark and thin, thickening into the sheet's own tone
// Every pixel is clipped to where the ice is drawn (iceAtPx), so a break at
// the shore never bites the bank.
const IB_WATER = [[0x1e, 0x3a, 0x54], [0x23, 0x41, 0x59]]; // an open hole's two water tones (paintGroundTile)
const IB_GLINT = [0x2e, 0x55, 0x73];
const IB_RIM = [[0x16, 0x2c, 0x40], [0x1a, 0x33, 0x49]];  // the shade under the far lip, two rows
const IB_CHIP = [0xd6, 0xec, 0xf4];                      // the chipped lip, the plates
const IB_LIP = [0xee, 0xf8, 0xfd];                       // a plate's lit top, the warning cracks
const IB_CRACK = [0x8f, 0xbc, 0xd8];
const IB_SKIM = [[0x6f, 0x9a, 0xb8], [0x8d, 0xb6, 0xd0]]; // new ice: thin and dark, then thicker
const IB_BAND = 9;      // px round the footprint the plate cracks reach
const IB_SEEDS = 70;    // plates (Voronoi cells) at most in the footprint and the band
const IB_RADIAL = 14;   // long cracks walking out from the rim
const IB_GLINT_T = 0.25; // s the freeze front glints on a pixel it just took

// the break's pixels that never change: built once a screen, off its geometry
function breakArt(b) {
  const c = breakCache.get(breakKey(b));
  if (c && c.art) return c.art;
  const g = breakGeom(b), { x0, y0, w, h, D, Dh } = g, n = w * h;
  const ice = new Uint8Array(n), hole = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    if (!iceAtPx(x0 + k % w, y0 + ((k / w) | 0))) continue;
    ice[k] = 1;
    if (g.hole[k]) hole[k] = 1;
  }
  // the plates: Voronoi cells seeded in the footprint and the band round it
  const seeds = [];
  for (let s = 0; s < 400 && seeds.length < IB_SEEDS; s++) {
    const sx = breakHash(s, 1, b.seed) * w, sy = breakHash(s, 2, b.seed) * h;
    if (D[(sy | 0) * w + (sx | 0)] < 12) seeds.push([sx, sy]);
  }
  const lab = new Int16Array(n), gap = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const x = k % w + 0.5, y = ((k / w) | 0) + 0.5;
    let d1 = 1e9, d2 = 1e9, l = 0;
    for (let s = 0; s < seeds.length; s++) {
      const d = Math.hypot(x - seeds[s][0], y - seeds[s][1]);
      if (d < d1) { d2 = d1; d1 = d; l = s; } else if (d < d2) d2 = d;
    }
    lab[k] = l; gap[k] = d2 - d1;
  }
  // the cracks: cell edges in the band, and the long ones off the rim
  const crack = new Uint8Array(n), outline = new Uint8Array(n), trace = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    if (!ice[k] || hole[k]) continue;
    if (D[k] > 0 && D[k] < IB_BAND && gap[k] < 1) crack[k] = 1;
  }
  const rim = [];
  for (let k = 0; k < n; k++) if (Dh[k] > 0 && Dh[k] < 1.5) rim.push(k);
  rim.sort((p, q) => breakHash(p, 9, b.seed) - breakHash(q, 9, b.seed) || p - q);
  for (let r = 0; r < Math.min(IB_RADIAL, rim.length); r++) {
    let x = rim[r] % w, y = (rim[r] / w) | 0;
    const len = 6 + breakHash(r, 5, b.seed) * 16;
    for (let s = 0; s < len; s++) {
      const xi = x | 0, yi = y | 0;
      const gx = Dh[yi * w + Math.min(w - 1, xi + 1)] - Dh[yi * w + Math.max(0, xi - 1)];
      const gy = Dh[Math.min(h - 1, yi + 1) * w + xi] - Dh[Math.max(0, yi - 1) * w + xi];
      const gl = Math.hypot(gx, gy) || 1;
      x += gx / gl + (breakHash(r, s, b.seed + 3) - 0.5) * 1.2;
      y += gy / gl * 0.8 + (breakHash(s, r, b.seed + 4) - 0.5) * 1.2;
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const k = (y | 0) * w + (x | 0);
      if (ice[k] && !hole[k]) crack[k] = 1;
    }
  }
  // the warning: the outline traced round from the west, a little ragged
  for (let k = 0; k < n; k++) {
    if (!ice[k]) continue;
    const x = x0 + k % w, y = y0 + ((k / w) | 0);
    if ((D[k] > -1 && D[k] < 2 && gap[k] < 1) || (D[k] > 0 && D[k] < 1.2 && breakHash(x, y, b.seed + 2) > 0.35)) {
      outline[k] = 1;
      trace[k] = ((Math.atan2(y - b.y, x - b.x) + Math.PI) / (Math.PI * 2) + breakHash(x, y, b.seed) * 0.15) % 1;
    }
  }
  // each plate: its pixels, and where it lands (out from the middle, in the
  // ground's squash) - on the ice it lies, back in the water it is gone
  const plates = [];
  const cells = new Map();
  for (let k = 0; k < n; k++) if (hole[k] && gap[k] > 1) (cells.get(lab[k]) || cells.set(lab[k], []).get(lab[k])).push(k);
  for (const [l, ks] of cells) {
    if (ks.length < 4) continue;
    let mx = 0, my = 0, ytop = 1e9, ybot = -1;
    for (const k of ks) { const y = (k / w) | 0; mx += k % w; my += y; ytop = Math.min(ytop, y); ybot = Math.max(ybot, y); }
    mx /= ks.length; my /= ks.length;
    const a = Math.atan2(my + y0 - b.y, mx + x0 - b.x), r = 10 + breakHash(l, 3, b.seed) * 12;
    const lx = Math.round(Math.cos(a) * r), ly = Math.round(Math.sin(a) * r * 0.72);
    let onIce = true;
    for (const k of ks) {
      const x = k % w + lx, y = ((k / w) | 0) + ly;
      if (x < 0 || y < 0 || x >= w || y >= h || hole[y * w + x] || !ice[y * w + x]) { onIce = false; break; }
    }
    plates.push({ ks, ytop, ybot, lx, ly, hgt: 6 + breakHash(l, 4, b.seed) * 8, dl: breakHash(l, 6, b.seed) * 0.25, onIce });
  }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  const art = { cv, cx, img: cx.createImageData(w, h), ice, hole, crack, outline, trace, plates, open: new Uint8Array(n) };
  breakCache.set(breakKey(b), Object.assign(breakCache.get(breakKey(b)) || {}, { art }));
  return art;
}

// one break's pixels at age `a`, into its canvas
function paintIceBreak(b, a) {
  const g = breakGeom(b), A = breakArt(b), { w, h, x0, y0, ft } = g, n = w * h, d = A.img.data, open = A.open;
  d.fill(0);
  const put = (k, c, al) => { const q = k * 4; d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = al; };
  if (a < b.warn) { // the warning: the outline cracking round
    const u = b.warn > 0 ? a / b.warn : 1;
    for (let k = 0; k < n; k++) if (A.outline[k] && A.trace[k] < u) put(k, IB_LIP, 255);
    A.cx.putImageData(A.img, 0, 0);
    return;
  }
  const t0 = b.warn + b.hold, front = breakFront(b, a), fu = front / ICE_BREAK_FRONT;
  for (let k = 0; k < n; k++) open[k] = A.hole[k] && ft[k] > front ? 1 : 0;
  const crackA = Math.round(255 * (1 - fu * fu * (3 - 2 * fu)));
  const glint = Math.floor(a * 2);
  for (let k = 0; k < n; k++) {
    if (!A.ice[k]) continue;
    const i = k % w, j = (k / w) | 0, x = x0 + i, y = y0 + j;
    if (open[k]) {
      if (j > 0 && !open[k - w]) put(k, IB_RIM[0], 255);
      else if (j > 1 && !open[k - 2 * w]) put(k, IB_RIM[1], 255);
      else if (breakHash((x + glint) / 3 | 0, y, b.seed + 5) > 0.94) put(k, IB_GLINT, 255);
      else put(k, IB_WATER[breakHash(x >> 2, y >> 2, b.seed + 7) > 0.5 ? 1 : 0], 255);
      continue;
    }
    if (A.hole[k]) { // frozen back: new ice, thin and dark, thickening to the sheet
      const since = a - (t0 + ft[k] * ICE_BREAK_FREEZE / ICE_BREAK_FRONT);
      if (since < IB_GLINT_T) { put(k, IB_CHIP, 220); continue; }
      const u = since / ICE_BREAK_SKIM;
      if (u >= 1) continue;
      const m = Math.min(1, u * 2), c = IB_SKIM[0].map((v, q) => Math.round(v + (IB_SKIM[1][q] - v) * m));
      put(k, c, u < 0.5 ? 255 : Math.round(255 * (1 - (u - 0.5) * 2)));
      continue;
    }
    // the ice round it: the chipped lip on the open water, the cracks
    if ((i > 0 && open[k - 1]) || (i < w - 1 && open[k + 1]) || (j > 0 && open[k - w]) || (j < h - 1 && open[k + w])) put(k, IB_CHIP, 255);
    else if (A.crack[k] && crackA > 0) put(k, IB_CRACK, crackA);
  }
  // the plates: flung out in an arc; those that land on ice melt as it freezes
  const pa = a - b.warn;
  if (pa < ICE_BREAK_BURST + b.hold + ICE_BREAK_FREEZE * 0.7) {
    const fade = pa < ICE_BREAK_BURST + b.hold ? 1 : 1 - (pa - ICE_BREAK_BURST - b.hold) / (ICE_BREAK_FREEZE * 0.7);
    for (const p of A.plates) {
      const u = Math.max(0, (pa - p.dl) / ICE_BREAK_BURST);
      if (u >= 1 && !p.onIce) continue; // dropped back in the water
      const v = Math.min(1, u), ox = Math.round(p.lx * v), oy = Math.round(p.ly * v - p.hgt * 4 * v * (1 - v));
      const al = Math.round(255 * Math.max(0, fade));
      if (al <= 0) continue;
      for (const k of p.ks) {
        const i = k % w + ox, j = ((k / w) | 0) + oy;
        if (i < 0 || j < 0 || i >= w || j >= h) continue;
        const r = (k / w) | 0;
        put(j * w + i, r === p.ytop ? IB_LIP : r === p.ybot ? IB_CRACK : IB_CHIP, al);
      }
    }
  }
  A.cx.putImageData(A.img, 0, 0);
}

// every break on screen, flat over the ground (render())
function drawIceBreaks(ox, oy) {
  breakCacheSweep();
  for (const b of iceBreaks) {
    const f = breakFoot(b);
    if (f.x0 - ox > WV_W || f.y0 - oy > WV_H || f.x0 + f.w - ox < 0 || f.y0 + f.h - oy < 0) continue;
    paintIceBreak(b, iceBreakAge(b));
    ctx.drawImage(breakArt(b).cv, f.x0 - ox, f.y0 - oy);
  }
}
