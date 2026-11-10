'use strict';
// ------------------------------------------------------------ lignum
// LIGNUM's pixels (his rules: js/sim/lignum.js): his felling axe in his hands
// (HERO_BLADES), the hand axe out and stuck (HERO_AIR), the felled trunk on
// the snow (HERO_GROUND), and the bark on him while he hardens (HERO_BODY_FX).

const LG_INK = '#141a2c', LG_BARK = '#6e4a28', LG_BARK_L = '#a8794a', LG_PINE = '#2f5c4b', LG_PINE_L = '#3f7a5c';
const LG_FALL = 0.15; // s the trunk takes to come down

// ---- the felling axe in his hands -------------------------------------------------------
let lignumAxeArt = null;
function lignumAxeArtOf() {
  return lignumAxeArt || (lignumAxeArt = { flat: bakeBladeArt(LIGNUM_AXE, LIGNUM_AXE_PAL), diag: bakeBladeArt(LIGNUM_AXE_DIAG, LIGNUM_AXE_PAL) });
}
// ...and at 32 px for his fine body (LIGNUM_AXE_FINE), the grips the same world px
let lignumAxeFine = null;
function lignumAxeFineOf() {
  if (lignumAxeFine) return lignumAxeFine;
  const tag = (c) => { c.dens = 2; return c; };
  return (lignumAxeFine = { flat: tag(bakeBladeArt(LIGNUM_AXE_FINE, LIGNUM_AXE_PAL)), diag: tag(bakeBladeArt(LIGNUM_AXE_DIAG_FINE, LIGNUM_AXE_PAL)) });
}
HERO_BLADES.felling = { smear: 'chop', art: lignumAxeArtOf, fine: lignumAxeFineOf, hilt: [14, 9], hip: { down: [13, 11], up: [11, 10] }, grip: LIGNUM_AXE_GRIP, hold: 'shoulder' };

// ---- the hand axe: turning in flight, still in what it struck ------------------------------
// the axe at (x, y) turned to bearing a: its haft, and the steel bit across its head
function drawAxeAt(x, y, a) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let k = -2; k <= 3; k++) { // the haft
    const px = Math.round(x - c * k), py = Math.round(y - s * k);
    ctx.fillStyle = LG_INK; ctx.fillRect(px, py + 1, 1, 1);
    ctx.fillStyle = LG_BARK_L; ctx.fillRect(px, py, 1, 1);
  }
  for (let k = -1; k <= 1; k++) { // the bit, across the haft's head
    const px = Math.round(x + c * 2 - s * k), py = Math.round(y + s * 2 + c * k);
    ctx.fillStyle = LG_INK; ctx.fillRect(px, py + 1, 1, 1);
    ctx.fillStyle = k === 0 ? '#e6ebf2' : '#c8d2e4'; ctx.fillRect(px, py, 1, 1);
  }
}
function drawLignumAxe(w, ex, ey, now) {
  const x = Math.round(w.x - ex), y = Math.round(w.y - ey);
  if (!w.stuck) { ctx.globalAlpha = 0.3; ctx.fillStyle = LG_INK; ctx.fillRect(x - 1, y + BOW_Y, 3, 1); ctx.globalAlpha = 1; }
  drawAxeAt(x, y, w.stuck ? Math.atan2(w.ny, w.nx) : now * 18);
  if (w.stuck && Math.floor(now * 4) % 2 === 0) { ctx.fillStyle = '#d9a648'; ctx.fillRect(x, y - 4, 1, 1); } // waiting for the pull
}
function drawLignumAir(ex, ey, now) { for (const w of lignumAxes) drawLignumAxe(w, ex, ey, now); }

// ---- the felled trunk ---------------------------------------------------------------------
// A whole pine lying where it fell: a bare bark trunk from the stump end, then tier on
// tier of boughs as wide as the blow lands, closing to a blunt top, lit and snow-tipped along its upper side.
// `pineHalf` is its outline (px either side of the trunk's line, `s` px along a pine
// `L` long): TIMBER's shadow is cut to the same shape (drawTimberTele).
const LG_SNOW = '#f4f7ff', LG_SNOW_D = '#b9c8e2', LG_PINE_T = '#5a9a6c'; // the boughs' lit tops
const PINE_BARE = 0.28, PINE_TIER = 8, PINE_WIDE = 9, PINE_TOP = 0.8; // the bare trunk's share, a tier's px, the lowest tier's half-width, where the top starts to close
const PINE_PUFF = 0.4; // s the snow it lands in hangs
function pineHalf(s, L) {
  const bare = L * PINE_BARE;
  if (s < bare) return 2;
  const f = ((s - bare) % PINE_TIER) / PINE_TIER, top = L * PINE_TOP;
  // as wide as the blow lands (TIMBER_W) nearly to the end, then closing to a blunt top
  const env = s < top ? PINE_WIDE - 1.5 * (s - bare) / (top - bare) : PINE_WIDE - 1.5 - (PINE_WIDE - 5) * (s - top) / (L - top);
  return Math.max(2, Math.round((env + 0.5) * (1 - 0.28 * f)));
}
// it comes down over LG_FALL (seen from above, its length growing as it tips), throws
// up the snow it lands in, and sinks into the snow at the end of its life
function drawLignumLog(g, ex, ey) {
  const fall = Math.min(1, g.t / LG_FALL), px = -g.ny, py = g.nx, L = g.len;
  const lit = py < 0 || (py === 0 && px < 0) ? 1 : -1; // the side of the trunk that is up the screen
  ctx.globalAlpha = Math.min(1, (g.life - g.t) * 3);
  const dot = (s, k, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(g.x0 + g.nx * s * fall + px * k - ex), Math.round(g.y0 + g.ny * s * fall + py * k - ey), 1, 1); };
  for (let s = -1; s <= L + 1; s += 0.5) { // the ink under everything, one px past the outline
    const h = Math.max(pineHalf(Math.max(0, s - 1), L), pineHalf(Math.min(L, s + 1), L)) + 1;
    for (let k = -h; k <= h; k++) dot(s, k, LG_INK);
  }
  const bare = L * PINE_BARE;
  for (let s = 0; s <= L; s += 0.5) {
    const h = pineHalf(s, L), green = s >= bare, f = ((s - bare) % PINE_TIER) / PINE_TIER;
    for (let k = -h; k <= h; k++) {
      const up = k * lit; // > 0 on the lit side
      let col;
      if (!green) col = up > 0 ? LG_BARK_L : LG_BARK;
      else if (h > 2 && (up === h ? f < 0.5 : up === h - 1 && f < 0.25)) col = LG_SNOW; // snow lying on each tier's tip
      else if (k === 0 && f > 0.6) col = LG_BARK; // the trunk showing between the tiers
      else col = up > h / 2 ? LG_PINE_T : up > 0 ? LG_PINE_L : LG_PINE;
      dot(s, k, col);
    }
  }
  for (let s = 3; s < bare - 1; s += 4) dot(s, 0, LG_INK); // the bark's ridges
  dot(0, 0, '#e6c896'); dot(0, lit, '#e6c896'); // the fresh cut
  ctx.globalAlpha = 1;
  const u = (g.t - LG_FALL) / PINE_PUFF; // the snow it lands in, thrown off both sides
  if (u < 0 || u >= 1) return;
  const out = 1 - (1 - u) * (1 - u), r = u < 0.5 ? 2 : 1;
  for (let i = 0, s = 6; s <= L; s += 9, i++) for (const side of [-1, 1]) {
    const k = side * (pineHalf(s, L) + 3 + out * (7 + (i * 5 + (side > 0 ? 3 : 0)) % 6)), lift = Math.round(4 * Math.sin(Math.PI * u));
    const x = Math.round(g.x0 + g.nx * (s + (i % 2) * 3) + px * k - ex), y = Math.round(g.y0 + g.ny * (s + (i % 2) * 3) + py * k - ey) - lift;
    ctx.fillStyle = LG_SNOW_D; ctx.fillRect(x - r, y - r + 1, r * 2 + 1, r * 2);
    ctx.fillStyle = LG_SNOW; ctx.fillRect(x - r, y - r, r * 2 + 1, r * 2 - (u > 0.7 ? 1 : 0) || 1);
  }
}
function drawLignumGround(ex, ey) { for (const g of lignumLogs) drawLignumLog(g, ex, ey); }

// ---- on his body ----------------------------------------------------------------------------
// BARK SKIN: bark grows over him as he hardens (wood, never ice: no spikes, no shine):
// not a brown block but rough plates that follow his body, each an uneven slab with a
// lit edge, a dark split between it and the next, and a knot or a ridge cut in it; they
// climb from his shins to his shoulders, and drop off as it wears away. Beside a pine,
// sprigs of needles sprout from his shoulders.
const BARK_PLATES = [ // rows of px in his 16 px cell, in the order they grow (shins, hips, chest, arms, shoulders): [x, y, 'pattern'] where L lit, B bark, D dark, . bare
  [5, 13, ['LB', 'BD']], [9, 13, ['LB', 'BD']],
  [4, 11, ['LBB', '.BD']], [9, 11, ['LBB', 'BD.']],
  [6, 8, ['LLB.', 'BDBB', '.BBD']],
  [2, 9, ['LB', 'BD', 'B.']], [12, 9, ['LB', 'BD', '.B']],
  [3, 7, ['.LB', 'LBD']], [10, 7, ['LB.', 'BBD']],
];
const BARK_GROW = 0.3; // s the bark takes to cover him
const LG_BARK_D = '#4a3018';
function drawLignumFx(p, ax, ay, now, front) {
  if (!front || CLASSES[p.cls].passive !== 'treeline' || !(p.barkT > 0)) return;
  const n = Math.ceil(Math.min(1, (BARK_T - p.barkT) / BARK_GROW) * BARK_PLATES.length);
  const shed = p.barkT < 0.3 ? Math.round((0.3 - p.barkT) * 10) : 0; // the plates drop as it wears off
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
    const [x, y, rows] = BARK_PLATES[i], sx = ax + x, sy = ay + y + (i % 2 ? shed : 0);
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      const k = rows[r][c];
      if (k === '.') continue;
      if (!pass) { ctx.fillStyle = LG_INK; ctx.fillRect(sx + c - 1, sy + r, 3, 1); ctx.fillRect(sx + c, sy + r - 1, 1, 3); }
      else { ctx.fillStyle = k === 'L' ? LG_BARK_L : k === 'D' ? LG_BARK_D : LG_BARK; ctx.fillRect(sx + c, sy + r, 1, 1); }
    }
  }
  if (pineBeside(p) && n >= BARK_PLATES.length - 1) { // needles: twice as hard by a pine
    const sw = Math.floor(now * 4) % 2;
    for (const [nx0, d] of [[3, -1], [12, 1]]) {
      ctx.fillStyle = LG_PINE; ctx.fillRect(ax + nx0, ay + 5, 1, 2); ctx.fillRect(ax + nx0 + d, ay + 5 + sw, 1, 1);
      ctx.fillStyle = LG_PINE_L; ctx.fillRect(ax + nx0, ay + 4, 1, 1); ctx.fillRect(ax + nx0 + d, ay + 4 + sw, 1, 1);
    }
  }
}

// ---- the keys' own looks ---------------------------------------------------------------------
// THROWN AXE's wind-up: the axe's spin drawn out down its line, three turning ghosts of it
// running out to its whole flight as he lets fly
function drawAxeTele(p, a, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = teleLen(p.x, p.y - BOW_Y, nx, ny, AXE_RANGE) * (0.3 + 0.7 * closing);
  for (let j = 1; j <= 3; j++) {
    const s = L * j / 3;
    ctx.globalAlpha = (0.35 + 0.45 * closing) * (1.1 - j * 0.2);
    drawAxeAt(Math.round(p.x + nx * s - ex), Math.round(p.y - BOW_Y + ny * s - ey), now * 14 + j * 2);
    ctx.fillStyle = LG_INK; ctx.fillRect(Math.round(p.x + nx * s - ex) - 1, Math.round(p.y + ny * s - ey), 3, 1);
  }
  ctx.globalAlpha = 1;
}
// TIMBER's wind-up: the pine's own shadow tipping out across the snow where it will lie,
// lengthening as it leans, tier by tier to its tip (pineHalf)
function drawTimberTele(L, closing, now, ex, ey) {
  const f = Math.pow(closing, 0.7), px = -L.ny, py = L.nx;
  ctx.fillStyle = `rgba(30,40,70,${(0.25 + 0.3 * closing).toFixed(2)})`;
  const seen = new Set(); // one fill a pixel, so the shadow stays one even tone
  for (let s = 0; s <= L.len; s += 0.5) {
    const h = pineHalf(s, L.len) + 1;
    for (let k = -h; k <= h; k++) {
      const x = Math.round(L.x0 + L.nx * s * f + px * k - ex), y = Math.round(L.y0 + L.ny * s * f + py * k - ey), key = x * 4096 + y;
      if (!seen.has(key)) { seen.add(key); ctx.fillRect(x, y, 1, 1); }
    }
  }
}
// CHOP landing: the felling axe's cleave, a broad crescent with the wood-chips and snow it
// throws, and one deep cleft down its middle; the second blow is heavier and gold
function drawChopFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f), heavy = f.col === '#d9a648';
  if (u > 0.15) {
    ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
    const c = Math.cos(f.a), s = Math.sin(f.a);
    for (let k = 8; k <= f.r - 2; k++) {
      ctx.fillStyle = '#2f3f5f'; ctx.fillRect(Math.round(px + c * k), Math.round(py + 2 + s * k), heavy ? 2 : 1, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px + c * k), Math.round(py + 3 + s * k), heavy ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  drawSwoosh(px, py, f.a, f.r, f.half, u, heavy ? 11 : 8, heavy ? [LG_INK, '#ffe9a8', '#d9a648'] : [LG_INK, '#ffffff', '#c8a874'], -1);
  drawFlung(px, py, f.a, f.half * 0.7, f.r + 10, 0.55, 8, heavy ? 12 : 8, Math.min(1, u * 1.5), seed, (x, y, k) => {
    ctx.fillStyle = LG_INK; ctx.fillRect(x - 1, y, 4, 2);
    ctx.fillStyle = k % 2 ? LG_BARK_L : '#e6c896'; ctx.fillRect(x, y, 2, 1);
  });
}
AB_FX_LOOK.chop = drawChopFx;

HERO_AIR.push(drawLignumAir);
HERO_GROUND.push(drawLignumGround);
HERO_BODY_FX.push(drawLignumFx);
