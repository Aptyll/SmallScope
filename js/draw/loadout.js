'use strict';
// ------------------------------------------------------------ loadout tells
// What the pre-game picks leave on a body (js/sim/loadout.js), drawn with the
// states every unit wears (HERO_MARK, drawUnitStates): BOLAS's cord round
// the legs while a body is tangled (weakT), streaks behind a body running on a
// SPRINT, a BANDAGE's step or an OUTRIDER's burst, and a gold pip on the
// hero a DUELIST has marked. Every one blinks out over its last half second.
const LO_INK = '#1a1418', LO_ROPE = '#d8c09a', LO_ROPE_D = '#9a7a58', LO_STREAK = '#e8eef6', LO_STONE = '#8a8f9c';
function loBlink(t, now) { return t > 0 && (t >= 0.5 || Math.floor(now * 8) % 2 === 0); }
function drawLoadoutMarks(e, px, py, w, h, now) {
  const cx = px + (w >> 1);
  if (loBlink(e.weakT, now)) { // the cord, wound twice round the shins, its lay showing, a stone weight hung off each end
    const y = py + h - 6;
    ctx.fillStyle = LO_INK; ctx.fillRect(cx - 3, y + 1, 7, 1); ctx.fillRect(cx - 3, y + 3, 7, 1);
    for (let k = -3; k <= 3; k++) {
      ctx.fillStyle = k & 1 ? LO_ROPE_D : LO_ROPE; ctx.fillRect(cx + k, y, 1, 1);
      ctx.fillStyle = k & 1 ? LO_ROPE : LO_ROPE_D; ctx.fillRect(cx + k, y + 2, 1, 1);
    }
    for (const [wx, wy] of [[cx - 5, y + 2], [cx + 4, y + 1]]) {
      ctx.fillStyle = LO_INK; ctx.fillRect(wx - 1, wy, 4, 2); ctx.fillRect(wx, wy - 1, 2, 4);
      ctx.fillStyle = LO_STONE; ctx.fillRect(wx, wy, 2, 2);
      ctx.fillStyle = LO_STREAK; ctx.fillRect(wx, wy, 1, 1);
    }
  }
  if (e instanceof Player && !e.dead) {
    const run = e.sprintT > 0 || e.runT > 0 || (e.ks && e.ks.on > 0 && callingOf(e) === 'outrider');
    const sp = Math.hypot(e.vx, e.vy);
    if (run && sp > 20) { // three streaks trailing the run
      const nx = -e.vx / sp, ny = -e.vy / sp;
      ctx.fillStyle = LO_STREAK;
      for (let k = 0; k < 3; k++) {
        const o = (k - 1) * 4, back = 7 + ((now * 30 + k * 3) % 5);
        ctx.fillRect(Math.round(cx + nx * back - ny * o), Math.round(py + h - 8 + ny * back + nx * o), 2, 1);
      }
    }
  }
  for (const q of players) { // a DUELIST's mark on this hero
    if (q.ks && q.ks.on > 0 && q.ks.mark === e.id && callingOf(q) === 'duelist' && e instanceof Player && loBlink(q.ks.on, now)) {
      const x = cx - 8, y = py + h - 16;
      ctx.fillStyle = LO_INK; ctx.fillRect(x - 1, y - 1, 4, 4);
      ctx.fillStyle = SEL_GOLD; ctx.fillRect(x, y, 2, 2);
      break;
    }
  }
}
HERO_MARK.push(drawLoadoutMarks);
