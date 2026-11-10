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
HERO_BLADES.felling = { art: lignumAxeArtOf, hilt: [14, 9], hip: { down: [13, 12], up: [11, 10] }, grip: LIGNUM_AXE_GRIP, hold: 'shoulder' };

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
// a trunk 5 px thick from the stump end to the crown, bark ridges along it and the crown's
// green at its far end; it falls over LG_FALL and sinks into the snow at the end of its life
function drawLignumLog(g, ex, ey) {
  const len = g.len * Math.min(1, g.t / LG_FALL), px = -g.ny, py = g.nx;
  const left = g.life - g.t, alpha = Math.min(1, left * 3);
  ctx.globalAlpha = alpha;
  const pass = (half, col, from, to) => {
    for (let s = from; s <= to; s += 1) {
      for (let k = -half; k <= half; k++) {
        const x = Math.round(g.x0 + g.nx * s + px * k - ex), y = Math.round(g.y0 + g.ny * s + py * k - ey);
        ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
      }
    }
  };
  const crown = Math.max(0, len - 26);
  pass(3, LG_INK, 0, crown); pass(2, LG_BARK, 0, crown);
  for (let s = 3; s < crown; s += 5) { // the bark's ridges
    const x = Math.round(g.x0 + g.nx * s - px - ex), y = Math.round(g.y0 + g.ny * s - py - ey);
    ctx.fillStyle = LG_BARK_L; ctx.fillRect(x, y, 2, 1);
  }
  if (len > crown) { pass(5, LG_INK, crown, len); pass(4, LG_PINE, crown, len); pass(2, LG_PINE_L, crown + 2, len - 2); }
  ctx.globalAlpha = 1;
}
function drawLignumGround(ex, ey) { for (const g of lignumLogs) drawLignumLog(g, ex, ey); }

// ---- on his body ----------------------------------------------------------------------------
// BARK SKIN: bark grows over him plate by plate as he hardens, upright strips with the
// grain cut into them (wood, never ice: no spikes, no shine), and sheds at the end;
// beside a pine, needles sprout from it
const BARK_PLATES = [ // [x, y, w, h] in his 16 px cell, in the order they grow: chest, shoulders, arms, hips, shins
  [6, 8, 4, 3], [3, 7, 2, 3], [11, 7, 2, 3], [2, 10, 2, 2], [12, 10, 2, 2], [4, 11, 3, 2], [9, 11, 3, 2], [5, 14, 2, 1], [9, 14, 2, 1],
];
const BARK_GROW = 0.3; // s the bark takes to cover him
function drawLignumFx(p, ax, ay, now, front) {
  if (!front || CLASSES[p.cls].passive !== 'treeline' || !(p.barkT > 0)) return;
  const n = Math.ceil(Math.min(1, (BARK_T - p.barkT) / BARK_GROW) * BARK_PLATES.length);
  const shed = p.barkT < 0.3 ? Math.round((0.3 - p.barkT) * 10) : 0; // the plates drop as it wears off
  for (let i = 0; i < n; i++) {
    const [x, y, w, h] = BARK_PLATES[i], sx = ax + x, sy = ay + y + (i % 2 ? shed : 0);
    ctx.fillStyle = LG_INK; ctx.fillRect(sx - 1, sy - 1, w + 2, h + 2);
    ctx.fillStyle = LG_BARK; ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = LG_BARK_L; for (let c = 0; c < w; c += 2) ctx.fillRect(sx + c, sy, 1, h); // the grain
  }
  if (pineBeside(p) && n >= 3) { // needles: twice as hard by a pine
    ctx.fillStyle = LG_PINE_L; ctx.fillRect(ax + 2, ay + 6, 1, 1); ctx.fillRect(ax + 13, ay + 6, 1, 1);
    if (Math.floor(now * 4) % 2) { ctx.fillStyle = LG_PINE; ctx.fillRect(ax + 7, ay + 7, 2, 1); }
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
// TIMBER's wind-up: the pine's shadow tipping out across the snow where it will lie, the
// trunk's lengthening as it leans and the crown's spreading at its end
function drawTimberTele(L, closing, now, ex, ey) {
  const len = L.len * Math.pow(closing, 0.7), px = -L.ny, py = L.nx;
  ctx.fillStyle = `rgba(30,40,70,${(0.25 + 0.3 * closing).toFixed(2)})`;
  for (let s = 0; s < len; s++) {
    const crown = s > L.len - 30, half = crown ? Math.round(TIMBER_W * 0.8 * Math.sin(Math.PI * (s - L.len + 30) / 30)) + 2 : 2;
    const x = L.x0 + L.nx * s - ex, y = L.y0 + L.ny * s - ey;
    for (let k = -half; k <= half; k++) ctx.fillRect(Math.round(x + px * k), Math.round(y + py * k), 1, 1);
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
