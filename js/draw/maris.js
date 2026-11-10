'use strict';
// ------------------------------------------------------------ maris
// MARIS's pixels (her rules: js/sim/maris.js): her harpoon in her hands
// (HERO_BLADES), the harpoon in flight on its line (HERO_SHOTS), the line
// while she reels in, the water round her while she swims and the frost while
// she braces (HERO_BODY_FX), and the snow heaving over her while she is under
// it (HERO_BODY_DRAW).

const MA_INK = '#141a2c', MA_SNOW = '#f4f7ff', MA_SNOW_M = '#cfe0f2', MA_SNOW_D = '#9fb6d8';
const MA_WATER = '#2c5478', MA_WATER_L = '#5f9cc8', MA_LINE = '#e8dcb4';

// ---- the harpoon in her hands ----------------------------------------------------------
let marisHarpoonArt = null;
function marisHarpoons() {
  return marisHarpoonArt || (marisHarpoonArt = { flat: bakeBladeArt(MARIS_HARPOON, MARIS_HARPOON_PAL), diag: bakeBladeArt(MARIS_HARPOON_DIAG, MARIS_HARPOON_PAL) });
}
HERO_BLADES.harpoon = { art: marisHarpoons, hilt: [14, 9], hip: { down: [13, 11], up: [11, 10] }, grip: MARIS_HARPOON_GRIP };

// ---- a line: one px dots from (x0, y0) to (x1, y1), ink under, sagging a little ---------------
function drawMarisLine(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / 2));
  for (let k = 1; k < n; k++) {
    const t = k / n, sag = Math.sin(t * Math.PI) * Math.min(4, d / 30);
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t + sag);
    ctx.fillStyle = MA_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = MA_LINE; ctx.fillRect(x, y, 1, 1);
  }
}

// ---- shots -------------------------------------------------------------------------
// HARPOON in flight: its barbed head on the bearing, its line back to her hands
function drawHarpoonShot(a, sx, sy, now) {
  const o = players[a.owner], nx = Math.cos(a.ang), ny = Math.sin(a.ang);
  const ex = a.x - sx, ey = a.y - sy;
  if (o && o.active && !o.dead) drawMarisLine(Math.round(o.x - ex), Math.round(o.y - BOW_Y - ey), Math.round(sx - nx * 8), Math.round(sy - ny * 8));
  for (let s = 0; s <= 8; s++) { // the shaft
    const x = Math.round(sx - nx * s), y = Math.round(sy - ny * s);
    ctx.fillStyle = MA_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = s < 3 ? '#c8d2e4' : '#a8794a'; ctx.fillRect(x, y, 1, 1);
  }
  for (const side of [-1, 1]) { // the barbs
    const x = Math.round(sx - nx * 3 - ny * side * 2), y = Math.round(sy - ny * 3 + nx * side * 2);
    ctx.fillStyle = MA_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = '#8b93a8'; ctx.fillRect(x, y, 1, 1);
  }
}
HERO_SHOTS.harpoon = drawHarpoonShot;

// ---- on her body -----------------------------------------------------------------------
// the line while she reels herself in; the water round her shins while she swims;
// frost flickering on her while she braces. (ax, ay) is the 16 px cell's top-left.
function drawMarisFx(p, ax, ay, now, front) {
  if (CLASSES[p.cls].passive !== 'coldwater') return;
  const ex = p.x - 8 - ax, ey = p.y - 12 - ay;
  if (!front && p.rushT > 0 && p.dash === 'reel') drawMarisLine(ax + 8, ay + 8, Math.round(p.reelX - ex), Math.round(p.reelY - 6 - ey));
  if (!front) return;
  const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + 4) / TILE);
  if (waterAt(tx, ty)) { // swimming: the water over her legs, a ring at the waterline
    const bob = Math.floor(now * 3) % 2;
    ctx.fillStyle = MA_WATER; ctx.fillRect(ax + 3, ay + 12 + bob, 10, 4 - bob);
    ctx.fillStyle = MA_WATER_L; ctx.fillRect(ax + 2, ay + 12 + bob, 12, 1);
    ctx.fillStyle = MA_SNOW; ctx.fillRect(ax + 1 + ((now * 6) | 0) % 3, ay + 12 + bob, 1, 1);
  }
  if (p.braceT > 0 && Math.floor(now * 8) % 3 === 0) { // braced: frost on her shoulders
    ctx.fillStyle = '#cfeeff'; ctx.fillRect(ax + 4, ay + 8, 1, 1); ctx.fillRect(ax + 11, ay + 8, 1, 1); ctx.fillRect(ax + 7, ay + 2, 2, 1);
  }
}
HERO_BODY_FX.push(drawMarisFx);

// ---- under the snow ----------------------------------------------------------------------
// BREACH: no body, only the snow heaving over her as she goes, cracks running ahead
function drawMarisUnder(p, px, py, now) {
  if (!(p.underT > 0) || p.dash !== 'breach') return false;
  const cx = px + 8, cy = py + 14, w = 5 + (Math.floor(now * 10) % 2);
  ctx.fillStyle = 'rgba(40,52,90,0.28)'; ctx.fillRect(cx - w, cy + 1, w * 2, 2);
  ctx.fillStyle = MA_INK; ctx.fillRect(cx - w, cy - 1, w * 2, 2); ctx.fillRect(cx - w + 2, cy - 3, w * 2 - 4, 2);
  ctx.fillStyle = MA_SNOW_M; ctx.fillRect(cx - w + 1, cy - 1, w * 2 - 2, 1);
  ctx.fillStyle = MA_SNOW; ctx.fillRect(cx - w + 3, cy - 2, w * 2 - 6, 1);
  ctx.fillStyle = MA_SNOW_D;
  for (let k = 1; k <= 3; k++) ctx.fillRect(Math.round(cx + p.rushNX * (w + k * 2)), Math.round(cy + p.rushNY * (w + k * 2) * 0.7), 1, 1);
  return true;
}
HERO_BODY_DRAW.push(drawMarisUnder);
