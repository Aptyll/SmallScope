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
// ...and at 32 px for her fine body (MARIS_HARPOON_FINE), the grips the same world px
let marisHarpoonFine = null;
function marisHarpoonsFine() {
  if (marisHarpoonFine) return marisHarpoonFine;
  const tag = (c) => { c.dens = 2; return c; };
  return (marisHarpoonFine = { flat: tag(bakeBladeArt(MARIS_HARPOON_FINE, MARIS_HARPOON_PAL)), diag: tag(bakeBladeArt(MARIS_HARPOON_DIAG_FINE, MARIS_HARPOON_PAL)) });
}
HERO_BLADES.harpoon = { smear: 'thrust', art: marisHarpoons, fine: marisHarpoonsFine, hilt: [14, 9], hip: { down: [13, 11], up: [11, 10] }, grip: MARIS_HARPOON_GRIP };

// ---- a line: one px, unbroken, from (x0, y0) to (x1, y1), ink under, sagging a little ----------
function drawMarisLine(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d));
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
// the ice crusted on her while she braces. (ax, ay) is the 16 px cell's top-left.
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
  if (p.braceT > 0) drawBraceIce(p, ax, ay, now); // braced: ice crusted over her (BRACE FOR COLD, below)
}
HERO_BODY_FX.push(drawMarisFx);

// ---- the keys' wind-ups -------------------------------------------------------------
// HARPOON's: her line paid out along the snow down the throw, lying in loose waves,
// out further as she draws back, its barbed head at the end of it
function drawHarpoonTele(p, a, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = teleLen(p.x, p.y, nx, ny, HARPOON_RANGE) * (0.3 + 0.7 * closing);
  for (let s = 8; s < L; s++) {
    const w = Math.sin(s * 0.12 - now * 3) * 2 * (1 - s / (L + 20));
    const x = Math.round(p.x + nx * s - ny * w - ex), y = Math.round(p.y + 3 + ny * s + nx * w - ey);
    ctx.fillStyle = MA_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = MA_LINE; ctx.fillRect(x, y, 1, 1);
  }
  const x = Math.round(p.x + nx * L - ex), y = Math.round(p.y + 3 + ny * L - ey); // the head, barbs back
  for (const [dx, dy] of [[0, 0], [-ny * 2 - nx * 2, nx * 2 - ny * 2], [ny * 2 - nx * 2, -nx * 2 - ny * 2]]) {
    ctx.fillStyle = MA_INK; ctx.fillRect(Math.round(x + dx) - 1, Math.round(y + dy) - 1, 3, 3);
  }
  ctx.fillStyle = '#c3ccd8'; ctx.fillRect(x, y, 1, 1); ctx.fillRect(Math.round(x - ny * 2 - nx * 2), Math.round(y + nx * 2 - ny * 2), 1, 1); ctx.fillRect(Math.round(x + ny * 2 - nx * 2), Math.round(y - nx * 2 - ny * 2), 1, 1);
}
// BREACH's: the spot she will come up, her fin cutting a circle through the snow round
// it and the crust over it heaving and starting to crack
function drawBreachTele(p, x, y, closing, now) {
  ctx.fillStyle = 'rgba(40,52,90,0.25)'; fillEllipsePx(x, y + 2, Math.round(BREACH_R * 0.5 * (0.5 + 0.5 * closing)), Math.round(BREACH_R * 0.2 * (0.5 + 0.5 * closing)));
  drawCracks(x, y + 2, 7, BREACH_R, 0.15 + 0.55 * closing, p.id * 29, MA_INK, '#ffffff');
  const t = now * 4, r = BREACH_R * 0.7, fx = Math.round(x + Math.cos(t) * r), fy = Math.round(y + 2 + Math.sin(t) * r * 0.5);
  for (let k = 1; k <= 6; k++) { // the furrow behind it
    const b = t - k * 0.12;
    ctx.fillStyle = MA_SNOW_D; ctx.fillRect(Math.round(x + Math.cos(b) * r), Math.round(y + 3 + Math.sin(b) * r * 0.5), 2, 1);
  }
  const dir = Math.cos(t + Math.PI / 2) >= 0 ? 1 : -1; // its edge leading the way it swims
  ctx.fillStyle = MA_INK; ctx.fillRect(fx - 2, fy - 1, 5, 2); ctx.fillRect(fx - (dir > 0 ? 1 : 0), fy - 4, 2, 3); ctx.fillRect(fx + dir, fy - 6, 1, 2);
  ctx.fillStyle = MA_SNOW; ctx.fillRect(fx - 3, fy, 7, 1);
}
// its landing: the crust burst up round her in slabs, cracks to the reach, and on ice
// the dark water showing through it
function drawBreachFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f), wet = f.col === '#7cc4e8';
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
  ctx.fillStyle = wet ? MA_WATER : MA_SNOW_D; fillEllipsePx(px, py + 3, 12, 5);
  if (wet) { ctx.fillStyle = MA_WATER_L; fillEllipsePx(px, py + 2, 8, 3); }
  drawCracks(px, py + 3, 9, f.r, Math.min(1, u * 5), seed, MA_INK, '#ffffff');
  drawFlung(px, py + 3, 0, Math.PI, f.r, 0.4, 20, 14, Math.min(1, u * 1.3), seed, (x, y, k) => {
    ctx.fillStyle = MA_INK; ctx.fillRect(x - 2, y - 1, 5, 4);
    ctx.fillStyle = k % 3 ? MA_SNOW : MA_SNOW_M; ctx.fillRect(x - 1, y, 3, 2);
    if (wet && k % 4 === 0) { ctx.fillStyle = MA_WATER_L; ctx.fillRect(x - 1, y + 1, 3, 1); }
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.breach = drawBreachFx;

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

// ---- UNDERTOW -----------------------------------------------------------------------
// The water under the snow, never a ring: through the wind-up three dark
// seams of it spiral out from her feet to the reach; then the water breaks
// up through them as a whirl whose crests sweep in toward her, foam on the
// leading edge, which is the pull the blow is.
const TOW_ARMS = 3;
function drawUndertowTele(px, py, closing, now) {
  const len = UNDERTOW_R * Math.min(1, closing * 1.2 + 0.1);
  for (let k = 0; k < TOW_ARMS; k++) {
    for (let s = 6; s < len; s += 1.5) {
      const a = k * Math.PI * 2 / TOW_ARMS + s / UNDERTOW_R * 1.6 + now * 0.5;
      const x = Math.round(px + Math.cos(a) * s), y = Math.round(py + 2 + Math.sin(a) * s);
      ctx.globalAlpha = 0.45 + 0.45 * closing;
      ctx.fillStyle = (s | 0) % 5 ? MA_WATER : MA_WATER_L;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
function drawUndertowFx(f, px, py, now) {
  const life = f.life || TOW_FX_LIFE, u = f.t / life;
  const rc = 6 + (UNDERTOW_R - 6) * (1 - u * (2 - u)); // the crests close in, fast then slow
  const spin = u * 3.2;
  ctx.globalAlpha = Math.min(1, 1.6 * (1 - u));
  for (let k = 0; k < TOW_ARMS; k++) {
    const a0 = k * Math.PI * 2 / TOW_ARMS + spin;
    for (let j = 0; j <= 26; j++) {
      const da = j / 26 * 1.7, r = rc + da * 10; // each crest trails out into a spiral
      const a = a0 - da;
      const x = Math.round(px + Math.cos(a) * r), y = Math.round(py + 2 + Math.sin(a) * r);
      const thick = j < 18 ? 2 : 1;
      ctx.fillStyle = MA_INK; ctx.fillRect(x, y + 1, thick, thick);
      ctx.fillStyle = MA_WATER; ctx.fillRect(x, y, thick, thick);
      if (j < 20) { // foam on the inner, leading lip
        const fx = Math.round(px + Math.cos(a) * (r - 2)), fy = Math.round(py + 2 + Math.sin(a) * (r - 2));
        ctx.fillStyle = j % 3 ? MA_SNOW : MA_WATER_L; ctx.fillRect(fx, fy, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.undertow = drawUndertowFx;

// ---- BRACE FOR COLD -------------------------------------------------------------------
// Ice crusts over her: plates grow onto her shoulders, hips and shins one by
// one as she sets, sit there while the brace holds, and crack off at the end.
// Each plate is inked, so it reads on snow as armour, not as a glow.
const BRACE_PLATES = [ // [x, y, w, h] in her 16 px cell, in the order they grow: shoulders, the spikes off them, hips, shins
  [2, 7, 3, 2], [11, 7, 3, 2], [1, 3, 1, 4], [14, 3, 1, 4], [0, 8, 2, 2], [14, 8, 2, 2], [3, 11, 2, 2], [11, 11, 2, 2], [4, 14, 2, 1], [10, 14, 2, 1],
];
const BRACE_GROW = 0.25; // s the crust takes to cover her
function drawBraceIce(p, ax, ay, now) {
  const grown = Math.min(1, (BRACE_T - p.braceT) / BRACE_GROW);
  const n = Math.ceil(grown * BRACE_PLATES.length);
  const cracking = p.braceT < 0.3 && Math.floor(now * 12) % 2;
  for (let i = 0; i < n; i++) {
    const [x, y, w, h] = BRACE_PLATES[i];
    const sx = ax + x + (cracking ? (i % 2 ? 1 : -1) : 0), sy = ay + y;
    ctx.fillStyle = MA_INK; ctx.fillRect(sx - 1, sy - 1, w + 2, h + 2);
    ctx.fillStyle = '#a8dcf7'; ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, 1, 1);
  }
  if ((now * 1.6) % 1 < 0.25) { // her breath, white in the cold
    ctx.fillStyle = MA_SNOW;
    ctx.fillRect(ax + (p.dir === 'left' ? 3 : 12), ay + 5, 1, 1);
  }
}
