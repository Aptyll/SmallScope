'use strict';
// ------------------------------------------------------------ pops
// What rises off the world after a hit, stamped above the night grade with
// the tags (the `ink over the world` banner, js/draw/light.js): the floaters
// (damage words and gold, drifting sideways, rising, and sometimes 2x) and
// the farm's coins (coinPop, js/sim/farm.js).
//
// A LAST HIT's coin hops up off the body, spinning, and falls back as it
// fades: gold, seen by everyone near. A MISS's coin is grey, drops a few px
// and fades: only the side that could have farmed the soldier sees it, and
// only near it (COIN_MISS_R), so a fight's misses read to the players in
// it and nobody across the map, and a rival's gold coin in the fog is not
// drawn (inSight, js/sim/fog.js). Both are COIN_PX art at world 1x, on the
// pixel grid - a coin is the farm's whole word, so it carries no text.
const COIN_MISS_R = 200;   // px from the watched body a miss's coin is shown inside
const COIN_HOP = 90, COIN_FALL = 220; // px/s up off a last hit, and px/s/s back down
const COIN_SIDE = 12;      // px left of the body a last hit's coin hops from, clear of the gold number over it
const COIN_DROP = 10;      // px a miss's coin sinks over its life
const COIN_SPIN = 12;      // frames a second of the spin
// the coin's turn: face on, three-quarter, edge, three-quarter. Rows of
// r (rim), g (face), h (shine), . clear; each frame centred on the pop
const COIN_PX = [
  ['.rrr.', 'rghgr', 'rgggr', 'rgggr', '.rrr.'],
  ['.r.', 'rhr', 'rgr', 'rgr', '.r.'],
  ['r', 'g', 'g', 'g', 'r'],
  ['.r.', 'rhr', 'rgr', 'rgr', '.r.'],
];
const COIN_INK = { gold: { r: '#8a5a14', g: '#f2cc6a', h: '#fff2b0' }, miss: { r: '#3b4150', g: '#8a93a8', h: '#b8c0d0' } };

function drawCoin(grid, ink, x, y) {
  const x0 = x - (grid[0].length >> 1), y0 = y - 2;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const k = row[c];
      if (k === '.') continue;
      ctx.fillStyle = ink[k];
      ctx.fillRect(x0 + c, y0 + r, 1, 1);
    }
  }
}

function drawPops(ex, ey) {
  for (const f of floaters) {
    const s = f.scale || 1;
    drawWorldText(f.txt,
      Math.round(f.x + (f.vx || 0) * f.t - ex - pixelTextWidth(f.txt, s) / 2),
      Math.round(f.y - ey - f.t * (f.rise || 14)), f.color, s, 1 - f.t / (f.life || 0.9));
  }
  const vp = viewPlayer();
  for (const c of coinPops) {
    const t = (state.tick - c.tick) * TICK_DT;
    if (t < 0 || t > COIN_POP_T) continue;
    if (c.miss && (!vp || vp.team !== c.team || Math.hypot(vp.x - c.x, vp.y - c.y) > COIN_MISS_R)) continue;
    if (!c.miss && vp && !inSight(vp.team, c)) continue; // a rival's last hit in the fog is not seen (js/sim/fog.js)
    const a = Math.min(1, 3 * (1 - t / COIN_POP_T)); // full for most of its life, then out
    const lift = c.miss ? -COIN_DROP * t / COIN_POP_T : COIN_HOP * t - COIN_FALL * t * t / 2;
    const grid = c.miss ? COIN_PX[0] : COIN_PX[Math.floor(t * COIN_SPIN) % COIN_PX.length];
    const x = Math.round(c.x - ex - (c.miss ? 0 : COIN_SIDE)), y = Math.round(c.y - ey - lift);
    overheadPlate(() => {
      const was = ctx.globalAlpha;
      ctx.globalAlpha = was * a;
      drawCoin(grid, c.miss ? COIN_INK.miss : COIN_INK.gold, x, y);
      ctx.globalAlpha = was;
    });
  }
}
