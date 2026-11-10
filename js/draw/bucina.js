'use strict';
// ------------------------------------------------------------ bucina
// BUCINA's pixels (her rules: js/sim/bucina.js): her horn's note in flight (HERO_SHOTS), on
// the snow (HERO_GROUND) the ECHO's wave out and back and SHAKE THE PINES' call going out,
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
    drawEchoFront(px, py, w.nx, w.ny, 1);
  }
  // the call: two rings running out to the edge of her reach and fading as they go
  for (const c of bucinaCalls) {
    const px = Math.round(c.x - ex), py = Math.round(c.y - ey);
    if (px < -PINES_R - 8 || py < -PINES_R - 8 || px > WV_W + PINES_R + 8 || py > WV_H + PINES_R + 8) continue;
    const k = c.t / HORN_CALL_T;
    buWave(px, py, PINES_R * Math.min(1, 0.35 + k), 0, 0.85 * (1 - k));
    buWave(px, py, PINES_R * Math.min(1, 0.15 + k), 0.5, 0.6 * (1 - k));
  }
}
// an inked front of sound at (px, py) running along (nx, ny): its bright edge, its brass
// body, and a fainter wash of sound trailing it
function drawEchoFront(px, py, nx, ny, alpha) {
  const tx = -ny, ty = nx;
  for (const [back, col, al] of [[-1, BU_INK, 1], [0, '#ffffff', 1], [1, BU_BRASS, 1], [4, BU_SOUND, 0.75]]) {
    ctx.globalAlpha = al * alpha; ctx.fillStyle = col;
    for (let s = -6; s <= 6; s++) {
      const bow = 3 - (s * s) / 12 - back;
      ctx.fillRect(Math.round(px + tx * s + nx * bow), Math.round(py + ty * s + ny * bow), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// a wave of the call going out: arcs of sound round (px, py) at radius r, broken into
// pieces (a call, never a drawn ring), turned by `turn` of a piece
const BU_WAVE_N = 7;
function buWave(px, py, r, turn, alpha) {
  const n = Math.ceil(r * 2 * Math.PI / BU_WAVE_N * 0.55);
  ctx.globalAlpha = alpha;
  for (let k = 0; k < BU_WAVE_N; k++) {
    const a0 = (k + turn) / BU_WAVE_N * Math.PI * 2;
    for (let i = 0; i <= n; i++) {
      const a = a0 + i / r, bow = Math.sin(Math.PI * i / n) * 3, x = Math.round(px + Math.cos(a) * (r + bow)), y = Math.round(py + Math.sin(a) * (r + bow));
      ctx.fillStyle = BU_INK; ctx.fillRect(x, y + 1, 2, 1);
      ctx.fillStyle = i % 4 ? BU_BRASS : '#ffffff'; ctx.fillRect(x, y, 2, 1);
    }
  }
  ctx.globalAlpha = 1;
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

// ---- the keys' own looks ----------------------------------------------------------------
// HORN BLAST's wind-up: the sound swelling in the horn's bell, fronts pulsing out of it
// from where she holds it at her lips: BU_BELL_Y px over her feet, and BU_BELL_X px to the
// hand's side when she faces the camera or away (the horn is beside her head then)
const BU_BELL_Y = 10, BU_BELL_X = 9;
function drawBlastTele(px, py, a, closing, now) {
  const nx = Math.cos(a), ny = Math.sin(a);
  for (let k = 0; k < 3; k++) {
    const d = 8 + ((now * 40 + k * 7) % 21) * (0.5 + 0.5 * closing);
    drawEchoFront(Math.round(px + ny * BU_BELL_X + nx * d), Math.round(py - BU_BELL_Y + ny * d), nx, ny, 0.4 + 0.5 * closing);
  }
}
// HORN BLAST landing: three fronts of sound sweep out through the wedge, wide as it is,
// driving streaks of snow ahead of them: the shove
function drawBlastFx(f, px, py, now) {
  const u = f.t / f.life, go = 1 - (1 - u) * (1 - u), seed = fxSeed(f);
  for (let w = 0; w < 3; w++) {
    const r = 10 + (f.r - 10) * Math.max(0, go - w * 0.12), n = Math.ceil(r * f.half * 2);
    if (r <= 10) continue;
    ctx.globalAlpha = Math.max(0, 1 - u) * (1 - w * 0.25);
    for (let i = 0; i <= n; i++) {
      const a = f.a - f.half + 2 * f.half * i / n, bow = Math.sin(Math.PI * i / n) * 4;
      const x = Math.round(px + Math.cos(a) * (r + bow)), y = Math.round(py - 4 + Math.sin(a) * (r + bow));
      ctx.fillStyle = BU_INK; ctx.fillRect(x, y + 1, 2, 2);
      ctx.fillStyle = i % 5 ? BU_BRASS : '#ffffff'; ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = BU_PALE; ctx.fillRect(x, y + 1, 2, 1);
    }
  }
  ctx.globalAlpha = Math.max(0, 1 - u);
  for (let k = 0; k < 10; k++) { // the snow blown ahead
    const a = f.a + (fxRoll(seed, k, 1) * 2 - 1) * f.half, d = 12 + (f.r - 8) * go * (0.6 + 0.4 * fxRoll(seed, k, 2));
    const x = px + Math.cos(a) * d, y = py + 2 + Math.sin(a) * d;
    for (let s = 0; s < 6; s++) { ctx.fillStyle = s < 2 ? '#ffffff' : '#9fb6d8'; ctx.fillRect(Math.round(x - Math.cos(a) * s), Math.round(y - Math.sin(a) * s), 1, 1); }
  }
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.blast = drawBlastFx;
// a note of music, its head at (x, y): an inked brass head and its stem with a flag
function buNote(x, y) {
  ctx.fillStyle = BU_INK; // a pixel of ink round each part: the head, the stem, the flag
  ctx.fillRect(x - 2, y - 2, 5, 4); ctx.fillRect(x - 1, y - 3, 3, 6); ctx.fillRect(x, y - 9, 3, 8); ctx.fillRect(x + 1, y - 9, 3, 4);
  ctx.fillStyle = BU_BRASS; ctx.fillRect(x - 1, y - 1, 3, 2); ctx.fillRect(x, y - 2, 1, 4); ctx.fillRect(x + 1, y - 8, 1, 7); ctx.fillRect(x + 2, y - 7, 1, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 1, 1);
}
// RALLYING NOTE: notes rise off the snow all over the ground it carries to, and drift up
function drawRallyFx(f, px, py, now) {
  const u = f.t / f.life;
  fxSpots(12).forEach(([ux, uy], k) => {
    const t = Math.max(0, Math.min(1, u * 1.4 - (k % 4) * 0.08));
    if (t <= 0) return;
    ctx.globalAlpha = Math.min(1, 3 * (1 - t));
    buNote(Math.round(px + ux * f.r * 0.8 + Math.sin(t * 6 + k) * 2), Math.round(py + uy * f.r * 0.6 - 18 * t));
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.rally = drawRallyFx;
// ECHO's wind-up: faint fronts of the wave down its line, as far as it will run
function drawEchoTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = ECHO_RANGE * (0.3 + 0.7 * closing);
  for (let s = 24; s < L; s += 36) drawEchoFront(Math.round(p.x + nx * s - ex), Math.round(p.y - BOW_Y + ny * s - ey), nx, ny, 0.25 + 0.35 * closing * (1 - s / L / 2));
}
// SHAKE THE PINES' wind-up, over the trees (HERO_AIR): every pine the call will reach
// starts to drop its snow, so a rival under one sees it coming
function drawPinesTele(ex, ey, now) {
  for (const p of players) {
    if (!p.active || p.dead || !(p.castT > 0)) continue;
    const ab = abOf(p, p.castAb);
    if (!ab || ab.id !== 'pines') continue;
    const closing = castProg(p);
    const t0x = Math.floor((p.x - PINES_R) / TILE), t1x = Math.floor((p.x + PINES_R) / TILE);
    const t0y = Math.floor((p.y - PINES_R) / TILE), t1y = Math.floor((p.y + PINES_R) / TILE);
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      const o = inWorld(tx, ty) && objects[ty * WORLD + tx];
      if (!o || o.type !== 'tree' || Math.hypot((tx + 0.5) * TILE - p.x, (ty + 0.5) * TILE - p.y) > PINES_R) continue;
      const x = Math.round((tx + 0.5) * TILE - ex), y = Math.round((ty + 1) * TILE - ey);
      if (x < -16 || y < -40 || x > WV_W + 16 || y > WV_H + 16) continue;
      for (let k = 0; k < 3 + Math.round(3 * closing); k++) { // flakes shaken off the boughs, falling to the foot
        const f = ((now * 1.6 + k * 0.29 + tx * 0.13) % 1), fx = x + Math.round(Math.sin(k * 2.1 + tx) * 6);
        ctx.fillStyle = BU_INK; ctx.fillRect(fx, Math.round(y - 26 + 26 * f) + 1, 2, 1);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(fx, Math.round(y - 26 + 26 * f), 2, 1);
      }
    }
  }
}
HERO_AIR.push(drawPinesTele);

// ---- the HORN ----------------------------------------------------------------------
// What she carries (CLASSES' `staff: 'horn'`; HERO_STAVES, js/draw/heroes.js): a brass bucina,
// its tube coiled in one loop and the bell flaring up and out past it; the bell's light
// glints between two frames. The hand closes on the loop's near side at BUCINA_HORN_GRIP,
// so the whole horn stands outside the body.
const BUCINA_HORN = [
  '.....oooo.',
  '....oyFFFo',
  '....oyyyo.',
  '.oooooyo..',
  'oyyyyoyo..',
  'oyoooyYo..',
  'oyo.oyo...',
  'oYyooyo...',
  '.oYyyo....',
  '..ooo.....',
];
const BUCINA_HORN_GRIP = [1, 6];
const BUCINA_HORN_PAL = { o: '#2e2440', y: '#f2cc6a', Y: '#b98a2e', F: '#fff1b8', W: '#ffffff' };
let bucinaHornArt = null;
function bucinaHorn() {
  if (bucinaHornArt) return bucinaHornArt;
  const glint = BUCINA_HORN.map((r, y) => (y === 1 ? '....oyWFFo' : r));
  bucinaHornArt = [bakeBladeArt(BUCINA_HORN, BUCINA_HORN_PAL), bakeBladeArt(glint, BUCINA_HORN_PAL)];
  return bucinaHornArt;
}
HERO_STAVES.horn = { art: bucinaHorn, grip: BUCINA_HORN_GRIP, cast: { up: 4, out: 0, keep: true } }; // sounded, the mouthpiece comes up to her lips and stays there while she blows
