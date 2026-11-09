'use strict';
// ------------------------------------------------------------ bucina
// BUCINA's pixels (her rules: js/sim/bucina.js): her horn's note in flight (HERO_SHOTS), on
// the snow (HERO_GROUND) the ECHO's wave out and back and SHAKE THE PINES' ring going out,
// and over a body (HERO_MARK) the RALLYING NOTE's gold notch while it holds. Both sides see
// all of it. The horn she carries rides in her hand (HERO_STAVES).

const BU_INK = '#2e2440', BU_BRASS = '#f2cc6a', BU_BRASS_D = '#b98a2e', BU_PALE = '#fff1b8', BU_SOUND = '#cfe0f2';

// ---- shots -----------------------------------------------------------------------
// her horn's NOTE: a bright point with two small arcs of sound behind it
function drawHornNote(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang), x = Math.round(sx), y = Math.round(sy);
  ctx.fillStyle = BU_SOUND;
  for (const back of [3, 5]) for (const s of [-1, 1]) ctx.fillRect(Math.round(sx - nx * back - ny * s * (back - 1)), Math.round(sy - ny * back + nx * s * (back - 1)), 1, 1);
  ctx.fillStyle = BU_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = Math.sin(now * 20 + a.ox) > 0 ? '#ffffff' : BU_BRASS; ctx.fillRect(x, y, 1, 1);
}
HERO_SHOTS.hornnote = drawHornNote;

// ---- on the snow --------------------------------------------------------------------
function drawBucinaGround(ex, ey, now) {
  // the echo: a short bowed front across its path, its shadow on the snow under it
  for (const w of bucinaEchoes) {
    const px = Math.round(w.x - ex), py = Math.round(w.y - ey);
    if (px < -16 || py < -16 || px > WV_W + 16 || py > WV_H + 24) continue;
    const tx = -w.ny, ty = w.nx;
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#9fb6d8';
    for (let s = -4; s <= 4; s++) ctx.fillRect(Math.round(px + tx * s), Math.round(py + BOW_Y + ty * s), 1, 1);
    // an inked front, its bright edge, and a fainter ring of sound trailing it
    for (const [back, col, al] of [[-1, BU_INK, 1], [0, '#ffffff', 1], [1, BU_BRASS, 1], [4, BU_SOUND, 0.75]]) {
      ctx.globalAlpha = al; ctx.fillStyle = col;
      for (let s = -6; s <= 6; s++) {
        const bow = 3 - (s * s) / 12 - back;
        ctx.fillRect(Math.round(px + tx * s + w.nx * bow), Math.round(py + ty * s + w.ny * bow), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  // the call: two rings running out to the edge of her reach and fading as they go
  for (const c of bucinaCalls) {
    const px = Math.round(c.x - ex), py = Math.round(c.y - ey);
    if (px < -PINES_R - 8 || py < -PINES_R - 8 || px > WV_W + PINES_R + 8 || py > WV_H + PINES_R + 8) continue;
    const k = c.t / HORN_CALL_T;
    drawRing(px, py, Math.round(PINES_R * Math.min(1, 0.35 + k)), BU_BRASS, 0.85 * (1 - k), 0);
    drawRing(px, py, Math.round(PINES_R * Math.min(1, 0.15 + k)), BU_PALE, 0.6 * (1 - k), 0);
  }
}
HERO_GROUND.push(drawBucinaGround);

// ---- over a body -----------------------------------------------------------------------
// the RALLYING NOTE holding on a body: a gold notch at its shoulder, blinking out at the end
function drawBucinaMarks(e, px, py, w, h, now) {
  if (!(e.rallyT > 0) || (e.rallyT < 1 && Math.floor(now * 8) % 2)) return;
  const x = px - 2, y = py + h - 12;
  ctx.fillStyle = BU_INK; ctx.fillRect(x - 1, y - 1, 3, 5);
  ctx.fillStyle = BU_BRASS; ctx.fillRect(x, y, 1, 3);
  ctx.fillStyle = BU_BRASS_D; ctx.fillRect(x, y + 2, 1, 1);
}
HERO_MARK.push(drawBucinaMarks);

// ---- the HORN ----------------------------------------------------------------------
// What she carries (CLASSES' `staff: 'horn'`; HERO_STAVES, js/draw/heroes.js): a brass signal
// horn held upright, the bell at the top; the bell's light glints between two frames. The
// hand closes on the tube at BUCINA_HORN_GRIP.
const BUCINA_HORN = [
  '...oooo',
  '..oyFFo',
  '..oyyyo',
  '..oYyo.',
  '.oyYo..',
  '.oyo...',
  '.oYo...',
  '.oyo...',
  '..oYo..',
  '...oo..',
];
const BUCINA_HORN_GRIP = [2, 6];
const BUCINA_HORN_PAL = { o: '#2e2440', y: '#f2cc6a', Y: '#b98a2e', F: '#fff1b8', W: '#ffffff' };
let bucinaHornArt = null;
function bucinaHorn() {
  if (bucinaHornArt) return bucinaHornArt;
  const glint = BUCINA_HORN.map((r, y) => (y === 1 ? '..oyWFo' : r));
  bucinaHornArt = [bakeBladeArt(BUCINA_HORN, BUCINA_HORN_PAL), bakeBladeArt(glint, BUCINA_HORN_PAL)];
  return bucinaHornArt;
}
HERO_STAVES.horn = { art: bucinaHorn, grip: BUCINA_HORN_GRIP };
