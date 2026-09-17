// ------------------------------------------------------------ zipline
// The zipline's pixels (the `zipline` banner, js/world.js, owns the thing
// itself): a pylon's sprite in each side's colour, the cable pass that
// hangs the line between the pylons over everything but the night, and the
// rider's handle and rope. The pylon bakes here, beside its draw pass, the
// way the chest and the cairn do (js/draw/ground.js) - never under
// js/sprites/. Two bakes, one per team skin, looked up by skin(o.team) like
// every other team-coloured thing on the map.
const PYLON_H = 40;
const PYLON_SPRS = (() => {
  const rows = [
    'oooooooooo',  // the crossarm the cable hangs from
    'oGGGGGGGGo',
    'oGggggggGo',
    'oooooooooo',
    '....oo....',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...otTo...',  // the side's band
    '...otTo...',
    '...otTo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '...opPo...',
    '..oppPPo..',  // the foot flares
    '..oppPPo..',
    '.oppppPPo.',
    '.osssssso.',  // snow banked against it
    '..ossssso.',
    '...oooo...',
  ];
  return [0, 1].map((t) => {
    const k = SPRITES.teams[t];
    const pal = { o: '#241a12', p: '#5c4226', P: '#8a6142', G: '#9aa2b2', g: '#737b8c', t: k.coat, T: k.coatL, s: '#f4f7ff' };
    const c = document.createElement('canvas');
    c.width = 10; c.height = PYLON_H;
    const g = c.getContext('2d');
    rows.forEach((r, y) => {
      for (let x = 0; x < 10; x++) if (pal[r[x]]) { g.fillStyle = pal[r[x]]; g.fillRect(x, y, 1, 1); }
    });
    return c;
  });
})();
// a pylon in render()'s y-sorted object pass: bottom-aligned on its tile
// like the cairn, its foot's shadow first
function drawPylon(o, px, py) {
  ctx.fillStyle = 'rgba(40,60,100,0.25)'; ctx.fillRect(px + 2, py + TILE - 2, 12, 2);
  drawSpriteFlash(PYLON_SPRS[skin(o.team)], px + 3, py + TILE - PYLON_H, o.flash);
}
// the cable's colours: steel in shadow, and the lit strand under it
const ZIP_INK = '#1c2030', ZIP_LIT = '#6a7488';
// The cable pass, between drawDropAir and renderLighting in render(): over
// every body and canopy, under the night grade. A span is a 1 px dark line
// with a 1 px lit line under it, rasterised pixel by pixel (a stroked path
// would blur across the pixel grid), sagging ZIP_SAG at its middle and
// leaning windSway(mid tile) px sideways so the line moves with the pines
// and stills at dusk. Bounds against WV_*: a span whose box misses the frame
// is skipped, and only a few are ever in it. (A rider's handle and rope are
// drawPlayer's - drawZipHandle, below - so the frame over its head covers
// the rope rather than the rope crossing the name.)
function drawZips(ex, ey) {
  for (const z of zips) {
    if (!z) continue;
    for (let i = 1; i < z.pts.length; i++) {
      const a = z.pts[i - 1], b = z.pts[i];
      const ax = a.x - ex, ay = a.y + 4 - ZIP_H - ey, bx = b.x - ex, by = b.y + 4 - ZIP_H - ey;
      if (Math.max(ax, bx) < -2 || Math.min(ax, bx) > WV_W + 2 || Math.max(ay, by) + ZIP_SAG < -2 || Math.min(ay, by) > WV_H + 2) continue;
      const sway = windSway((a.x + b.x) / (2 * TILE), (a.y + b.y) / (2 * TILE));
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      let lx = -1, ly = -1;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = Math.round(ax + (bx - ax) * t + sway * 4 * t * (1 - t));
        const y = Math.round(ay + (by - ay) * t + ZIP_SAG * 4 * t * (1 - t));
        if (x === lx && y === ly) continue;
        lx = x; ly = y;
        ctx.fillStyle = ZIP_INK; ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = ZIP_LIT; ctx.fillRect(x, y + 1, 1, 1);
      }
    }
  }
}
// a rider's handle over its head and the rope up to the cable, drawn by
// drawPlayer between the body and the frame over it: `hx` the body's centre
// column, `top` the lifted sprite's top row, both in world-view px
function drawZipHandle(p, hx, top, ey) {
  const z = zips[p.zip];
  if (!z) return;
  const cy = Math.round(p.y + 4 - zipLift(z, p.zipD) - ey);
  ctx.fillStyle = ZIP_INK; ctx.fillRect(hx, cy + 1, 1, Math.max(0, top - 3 - cy)); // the rope, cable to handle
  ctx.fillStyle = '#241a12'; ctx.fillRect(hx - 2, top - 4, 5, 3);                    // the handle
  ctx.fillStyle = '#8a6142'; ctx.fillRect(hx - 1, top - 3, 3, 1);
}
