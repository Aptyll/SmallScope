'use strict';
// ------------------------------------------------------------ bella
// BELLA's pixels (her rules: js/sim/bella.js): the precision she has built,
// as gold pips beside her head; the parry's stance, a blade held crosswise in
// front; OUTMANEUVER's mark and THE FINAL GAMBIT's duel on whoever wears them,
// seen by both sides; the duel's ring on the snow under the called-out hero;
// and the EAGLE SPATHA in her hands.

const BELLA_GOLD = '#f2cc6a', BELLA_GOLD_D = '#b98a2e', BELLA_INK = '#141a2c';

// a 3 px diamond, its centre at (x, y)
function bellaPip(x, y, col) {
  ctx.fillStyle = BELLA_INK;
  ctx.fillRect(x - 1, y - 2, 3, 5); ctx.fillRect(x - 2, y - 1, 5, 3);
  ctx.fillStyle = col;
  ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1);
}
// What she and her marks wear over a body (HERO_MARK, js/sim/heroes.js), in
// the body's own box at (px, py), w x h:
// - on her: one pip per stack up her far side (all three white-hot when
//   full), and the parry's crosswise blade while the stance holds;
// - on a body she marked with OUTMANEUVER: a gold diamond over its head;
// - on the hero she called out: the same diamond, ringed and pulsing.
function drawBellaMarks(e, px, py, w, h, now) {
  if (e instanceof Player && CLASSES[e.cls].passive === 'calculated') {
    const full = e.prec >= PREC_MAX;
    for (let k = 0; k < e.prec; k++) bellaPip(px + w + 1, py + h - 6 - k * 4, full && Math.floor(now * 6) % 2 ? '#ffffff' : BELLA_GOLD);
    if (e.parryT > 0) {
      const a = aimAngle(e);
      const cx = px + 8 + Math.round(Math.cos(a) * 6), cy = py + 8 + Math.round(Math.sin(a) * 4);
      const nx = -Math.sin(a), ny = Math.cos(a); // the blade lies across the aim
      const age = PARRY_T - e.parryT, run = Math.floor(now * 14) % 16 - 7; // a glint walks the edge
      for (let s = -7; s <= 7; s++) { const x = Math.round(cx + nx * s), y = Math.round(cy + ny * s); ctx.fillStyle = BELLA_INK; ctx.fillRect(x - 1, y - 1, 3, 3); }
      for (let s = -6; s <= 6; s++) {
        const x = Math.round(cx + nx * s), y = Math.round(cy + ny * s);
        ctx.fillStyle = s === run ? '#ffffff' : Math.abs(s) < 2 ? BELLA_GOLD : '#dfe6f0'; ctx.fillRect(x, y, 1, 1);
      }
      if (age < 0.18) { // the blade snapped into guard: one glint off it
        const k = Math.round(5 * (1 - age / 0.18));
        ctx.fillStyle = BELLA_INK; ctx.fillRect(cx - k - 1, cy - 1, 2 * k + 3, 3); ctx.fillRect(cx - 1, cy - k - 1, 3, 2 * k + 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - k, cy, 2 * k + 1, 1); ctx.fillRect(cx, cy - k, 1, 2 * k + 1);
      }
    }
  }
}
// over the stack (HERO_OVER): the pip of a body she marked OUT, flanked when it is her duel's
const bellaDuelOn = (e) => e instanceof Player && players.some((b) => b.duelT > 0 && b.duelId === e.id);
HERO_OVER.push({
  w: (e) => (bellaDuelOn(e) ? 9 : e.outBy >= 0 && state.elapsed < e.outUntil ? 5 : 0),
  draw: (e, x, y, now) => {
    const duel = bellaDuelOn(e), mx = x + (duel ? 4 : 2), my = y - (Math.floor(now * 3) % 2);
    bellaPip(mx, my, duel ? BELLA_GOLD : BELLA_GOLD_D);
    if (duel) { ctx.fillStyle = BELLA_GOLD; ctx.fillRect(mx - 4, my, 2, 1); ctx.fillRect(mx + 3, my, 2, 1); }
  },
});
// the duel on the snow round the hero called out: two spathas planted point down
// either side of them, hilts up, the duelling ground; they stand nearer as the duel
// runs out (HERO_GROUND)
function drawDuelBlade(x, y) {
  ctx.fillStyle = '#9fb6d8'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - 1, y - 1, 3, 1); // the snow heaped at its point
  ctx.fillStyle = BELLA_INK; ctx.fillRect(x - 1, y - 12, 3, 12); ctx.fillRect(x - 3, y - 13, 7, 3); ctx.fillRect(x - 1, y - 17, 3, 4);
  ctx.fillStyle = '#eef2f8'; ctx.fillRect(x, y - 11, 1, 10);
  ctx.fillStyle = '#a9b6c9'; ctx.fillRect(x, y - 4, 1, 3);
  ctx.fillStyle = BELLA_GOLD; ctx.fillRect(x - 2, y - 12, 5, 1); ctx.fillRect(x, y - 16, 1, 1);
  ctx.fillStyle = BELLA_GOLD_D; ctx.fillRect(x, y - 15, 1, 3);
}
function drawBellaDuels(ex, ey, now) {
  for (const b of players) {
    if (!(b.duelT > 0)) continue;
    const q = players[b.duelId];
    if (!q || !unitAlive(q)) continue;
    const px = Math.round(q.x - ex), py = Math.round(q.y - ey) + 5;
    const gap = 10 + Math.round(6 * b.duelT / DUEL_T);
    drawDuelBlade(px - gap, py);
    drawDuelBlade(px + gap, py);
  }
}
// PERFECT PARRY's riposte: the answering thrust, a gold streak to the one it
// struck and a flash where its point went in
function drawRiposteFx(f, px, py, now) {
  const u = f.t / f.life, nx = Math.cos(f.a), ny = Math.sin(f.a), run = f.r * Math.min(1, u * 5);
  ctx.globalAlpha = u < 0.5 ? 1 : 2 * (1 - u);
  for (let s = 6; s < run; s++) {
    const x = Math.round(px + nx * s), y = Math.round(py + ny * s);
    ctx.fillStyle = BELLA_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
  }
  for (let s = 6; s < run; s++) {
    const x = Math.round(px + nx * s), y = Math.round(py + ny * s);
    ctx.fillStyle = s > run - 6 ? '#ffffff' : s % 3 ? BELLA_GOLD : '#ffd95c'; ctx.fillRect(x, y, 1, 1);
  }
  if (u * 5 >= 1) { // the flash at its point
    const x = Math.round(px + nx * f.r), y = Math.round(py + ny * f.r), k = Math.round(5 * (1 - u));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - k, y, 2 * k + 1, 1); ctx.fillRect(x, y - k, 1, 2 * k + 1);
    ctx.fillStyle = BELLA_GOLD; ctx.fillRect(x - 1, y - 1, 3, 3);
  }
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.riposte = drawRiposteFx;
// GRAND GAMBIT's strikes: each a quick cut, swung from the other side to the last,
// the finish wide and gold
function drawFlurryFx(f, px, py, now) {
  const gold = f.col === '#ffd95c';
  drawSwoosh(px, py, f.a, f.r, f.half, f.t / f.life, gold ? 7 : 4, [BELLA_INK, gold ? '#ffd95c' : '#ffffff', gold ? BELLA_GOLD_D : '#a9b6c9'], f.n % 2 ? 1 : -1);
}
AB_FX_LOOK.flurry = drawFlurryFx;
// ---- the spatha in her hands ---------------------------------------------------
// Her EAGLE SPATHA (HERO_BLADES.spatha, js/draw/heroes.js): flat for the swing and
// the wind-up, slanted at the ready in her leading hand at rest in every facing
let bellaSpathaArt = null;
function bellaSpathas() {
  if (bellaSpathaArt) return bellaSpathaArt;
  return (bellaSpathaArt = { flat: bakeBladeArt(BELLA_SPATHA, BELLA_SPATHA_PAL), diag: bakeBladeArt(BELLA_SPATHA_DIAG, BELLA_SPATHA_PAL) });
}
// ...and at 32 px for her fine body (BELLA_SPATHA_FINE), the grips the same world px
let bellaSpathaFine = null;
function bellaSpathasFine() {
  if (bellaSpathaFine) return bellaSpathaFine;
  const tag = (c) => { c.dens = 2; return c; };
  return (bellaSpathaFine = { flat: tag(bakeBladeArt(BELLA_SPATHA_FINE, BELLA_SPATHA_PAL)), diag: tag(bakeBladeArt(BELLA_SPATHA_DIAG_FINE, BELLA_SPATHA_PAL)) });
}
HERO_BLADES.spatha = { away: (p) => p.parryT > 0, art: bellaSpathas, fine: bellaSpathasFine, hilt: [18, 11], hip: { down: [13, 11], up: [11, 10] }, grip: BELLA_SPATHA_GRIP };

HERO_MARK.push(drawBellaMarks);
HERO_GROUND.push(drawBellaDuels);
