'use strict';
// ------------------------------------------------------------ the orca, drawn
// The pixels of the orca (the thing itself, its hunt and its clock:
// js/orca.js; its art: SPRITES.orca, js/sprites/orca.js).
//   the shadow   under the ice with the lake's fish (render, after them): the
//                baked heading nearest its own, never turned off the pixel
//                grid, and cut to the ice's own pixels (orcaMask) so it never
//                shows over a sill it swims under or past the shore. It
//                darkens as it comes up (ORCA_SHADE_UP over the last
//                ORCA_SHADE_T of the line) and is gone while it is out.
//   the breach   y-sorted with the bodies at the hole's waterline: the lunge
//                anchored by its jaws on the bitten spot, cut at the
//                waterline, rising ORCA_DEPTH px over ORCA_RISE, the jaws
//                shut at ORCA_BITE, a bob, then the slide back down. The
//                hole, its plates and its cracks are the ice break's
//                (js/draw/icebreak.js), flat on the ground under it.
//   the line     over the hunted head (drawOrcaLine, js/draw/overhead.js)
const ORCA_SHADE = 0.42;      // the shadow's alpha cruising: the fish's own (render)
const ORCA_SHADE_UP = 0.78;   // ...and coming up under its quarry
const ORCA_SHADE_T = 0.8;     // s of line it darkens over
const ORCA_DEPTH = 46;        // px under the waterline the lunge starts from
const ORCA_DROP = 70;         // px it slides down going back under
const ORCA_JAW_AT = [6, -4];  // px from the bitten spot to where the jaws close: its chest, a little to the hole's side
const orcaSh = document.createElement('canvas'); // one shadow frame, cut to the ice
const orcaShG = orcaSh.getContext('2d');
let orcaMask = null; // { cv, x0, y0 }: the disc's ice pixels (opaque) over its box, built once

// the ice the shadow may show through: every ice pixel of the disc and a
// tile round it (iceAtPx: the sheet as the ground drew it)
function orcaMaskBuild() {
  const R = Math.ceil((ORCA_LAKE_R + 3) * TILE), c = Math.round(((WORLD - 1) / 2 + 0.5) * TILE);
  const x0 = c - R, y0 = c - R, w = 2 * R, cv = document.createElement('canvas');
  cv.width = cv.height = w;
  const g = cv.getContext('2d'), im = g.createImageData(w, w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + i, y = y0 + j;
    if (orcaLakeEdge(x / TILE - 0.5, y / TILE - 0.5) < 1 && iceAtPx(x, y)) im.data[(j * w + i) * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  orcaMask = { cv, x0, y0 };
}

function drawOrcaShadow(ex, ey, now) {
  if (!orca.on || orca.mode === 'up') return;
  const rx = Math.round(orca.x), ry = Math.round(orca.y), S = SPRITES.orca, h = S.cell >> 1;
  if (rx - ex < -h || ry - ey < -h || rx - ex > WV_W + h || ry - ey > WV_H + h) return;
  if (!orcaMask) orcaMaskBuild();
  const n = S.shadow.length, hd = ((Math.round(orca.a / (Math.PI * 2) * n) % n) + n) % n;
  const f = S.shadow[hd][Math.sin(now * (orca.mode === 'hunt' ? 12 : 5)) > 0 ? 1 : 0]; // the tail's wag, quicker on the run
  if (orcaSh.width !== S.cell) orcaSh.width = orcaSh.height = S.cell;
  orcaShG.globalCompositeOperation = 'source-over';
  orcaShG.clearRect(0, 0, S.cell, S.cell);
  orcaShG.drawImage(f, f.ox, f.oy);
  orcaShG.globalCompositeOperation = 'destination-in';
  orcaShG.drawImage(orcaMask.cv, rx - h - orcaMask.x0, ry - h - orcaMask.y0, S.cell, S.cell, 0, 0, S.cell, S.cell);
  orcaShG.globalCompositeOperation = 'source-over';
  const left = orca.mode === 'crack' ? 0 : orca.mode === 'hunt' ? ORCA_LINE - orcaAge() : ORCA_SHADE_T;
  ctx.globalAlpha = ORCA_SHADE + (ORCA_SHADE_UP - ORCA_SHADE) * Math.max(0, Math.min(1, (ORCA_SHADE_T - left) / ORCA_SHADE_T));
  ctx.drawImage(orcaSh, rx - h - ex, ry - h - ey);
  ctx.globalAlpha = 1;
}

// out of the water: the y-sorted list's entry (render) while orca.mode is 'up'
function drawOrcaBreach(ex, ey) {
  const S = SPRITES.orca, B = S.breach, age = orcaAge(), right = orca.side < 0; // the hole left of the spot: the lunge goes right, mirrored
  const img = age < ORCA_BITE ? (right ? B.openR : B.open) : (right ? B.shutR : B.shut);
  let off;
  if (age < ORCA_RISE) { const u = age / ORCA_RISE; off = ORCA_DEPTH * (1 - u) * (1 - u); }
  else if (age < ORCA_SINK_AT) off = age > ORCA_BITE && Math.floor((age - ORCA_BITE) / (8 * TICK_DT)) % 2 ? 1 : 0; // a heave as it chews
  else off = ORCA_DROP * Math.pow((age - ORCA_SINK_AT) / (ORCA_UP - ORCA_SINK_AT), 1.6);
  const jx = right ? S.bcell - 1 - S.jaw[0] : S.jaw[0];
  const cx = orca.jx + (right ? -1 : 1) * ORCA_JAW_AT[0] - jx, cy = orca.jy + ORCA_JAW_AT[1] - S.jaw[1] + Math.round(off);
  const wl = orca.hy + 2 - ey; // the waterline: nothing under it is drawn
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - ex - 8, wl - S.bcell - 80, S.bcell + 16, S.bcell + 80); ctx.clip();
  ctx.drawImage(img, cx + img.ox - ex, cy + img.oy - ey);
  ctx.restore();
}
