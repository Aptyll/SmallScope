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
  if (e instanceof Player && CLASSES[e.cls].passive === 'calculated' && !e.prone) {
    const full = e.prec >= PREC_MAX;
    for (let k = 0; k < e.prec; k++) bellaPip(px + w + 1, py + h - 6 - k * 4, full && Math.floor(now * 6) % 2 ? '#ffffff' : BELLA_GOLD);
    if (e.parryT > 0) {
      const a = Math.atan2(e.input.aimY - (e.y - BOW_Y), e.input.aimX - e.x);
      const cx = px + 8 + Math.round(Math.cos(a) * 6), cy = py + 8 + Math.round(Math.sin(a) * 4);
      const nx = -Math.sin(a), ny = Math.cos(a); // the blade lies across the aim
      for (let s = -5; s <= 5; s++) {
        const x = Math.round(cx + nx * s), y = Math.round(cy + ny * s);
        ctx.fillStyle = BELLA_INK; ctx.fillRect(x, y + 1, 1, 1);
        ctx.fillStyle = Math.abs(s) < 2 ? BELLA_GOLD : '#eef2f8'; ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  const out = e.outBy >= 0 && state.elapsed < e.outUntil;
  const duel = e instanceof Player && players.some((b) => b.duelT > 0 && b.duelId === e.id);
  if (!out && !duel) return;
  const mx = px + (w >> 1), my = py - 5 - (Math.floor(now * 3) % 2);
  bellaPip(mx, my, duel ? BELLA_GOLD : BELLA_GOLD_D);
  if (duel) { ctx.fillStyle = BELLA_GOLD; ctx.fillRect(mx - 4, my, 2, 1); ctx.fillRect(mx + 3, my, 2, 1); }
}
// the duel's ring on the snow under the hero called out, in the caller's
// side's colour, closing in as the duel runs out (HERO_GROUND)
function drawBellaDuels(ex, ey, now) {
  for (const b of players) {
    if (!(b.duelT > 0)) continue;
    const q = players[b.duelId];
    if (!q || !unitAlive(q)) continue;
    const px = Math.round(q.x - ex), py = Math.round(q.y - ey);
    const r = 9 + Math.round(3 * b.duelT / DUEL_T);
    drawRing(px, py + 3, r, TEAMS[skin(b.team)].mark, 0.7, 0);
    drawRing(px, py + 3, r - 2 - Math.round(Math.sin(now * 8)), BELLA_GOLD, 0.35, 0);
  }
}
// ---- the spatha in her hands ---------------------------------------------------
// Her EAGLE SPATHA (HERO_BLADES.spatha, js/draw/heroes.js): no slanted carry, so
// facing down or up she holds it upright in the leading hand like any sword
let bellaSpathaArt = null;
function bellaSpathas() {
  if (bellaSpathaArt) return bellaSpathaArt;
  const flat = bakeBladeArt(BELLA_SPATHA, BELLA_SPATHA_PAL);
  return (bellaSpathaArt = { flat, diag: flat });
}
HERO_BLADES.spatha = { art: bellaSpathas, hip: {}, grip: [0, 0] };

HERO_MARK.push(drawBellaMarks);
HERO_GROUND.push(drawBellaDuels);
