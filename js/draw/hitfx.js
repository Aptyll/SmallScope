'use strict';
// ------------------------------------------------------------ hit feedback
// What a BIG hit does to the body it lands on, all of it pixels: the body
// holds where it was struck for a beat (the hit-stop) and then catches up,
// sits 1 px back along the blow, a white spark flies off the struck side
// toward whoever landed it, and the snow puffs up at its feet. No red,
// never blood: the blow reads by white and motion (the flash is the
// body's own, drawSpriteFlash).
//
// It is drawn from what the snapshot carries and nothing else, with no
// memory of its own: the last blow's size and tick (tallyLast/tallyTick,
// tallyHit, js/sim/core.js), which way it came (hitNx/hitNy: damagePlayer,
// hurtUnit) and how the body is moving. So a client, a full snapshot and
// the echo harness (DBG.netEcho) all draw the same hit the host does, and
// nothing here can change the match. The hit-stop is a held DRAWING: the
// sim never pauses, the body is drawn where it was when struck (its speed
// played back) and then slides to where it really is.
//
// A hit is big when one blow takes HIT_BIG of the body's health: about
// the top fifth of hero hits (a key, a crit, a tower bolt), not every
// auto. A wave soldier's bar is short, so its bar is higher, or every
// soldier swing in a lane fight would spark.
const HIT_BIG = { P: 0.12, A: 0.2, R: 0.34 }; // share of max health one blow must take: players, beasts, soldiers
const HIT_STOP_T = 0.07;    // s the struck body is held where it was hit
const HIT_CATCH_T = 0.06;   // s it then takes to slide to where it really is
const HIT_STOP_MAX = 6;     // px the held drawing may lag the body
const HIT_RECOIL_T = 0.16;  // s the body sits 1 px back along the blow
const HIT_SPARK_T = [0.04, 0.09, 0.14]; // s each spark frame ends: the star, the streaks, the dots
const HIT_PUFF_T = 0.3;     // s the snow puff lasts
const HIT_INK = '#1b2233';  // the spark's rim, so white reads on snow
const HIT_PUFF_RIM = '#4f6288'; // a snow clump's rim: softer than ink, still dark on snow
const HIT_WHITE = '#ffffff', HIT_PALE = '#cfe6ff', HIT_SNOW_SHADE = '#94a9c8'; // the spark's heart and edge; a snow clump's underside
const HIT_NONE = { x: 0, y: 0 };
const hitOff = { x: 0, y: 0 };
const hitCur = { nx: 0, ny: 0, seed: 0 }; // the hit being drawn (drawHitSpark/drawHitPuff read it)

// how long ago a body took a big hit, in s, or -1 when it has none on show.
// The sim's tick, plus on a client the time since the host's last word
// landed, so the spark plays smoothly between 15 Hz snapshots
function hitAge(u, now) {
  if (u.merchant || !(u.maxHp > 0) || !(u.tallyLast >= HIT_BIG[u instanceof Player ? 'P' : u.bot ? 'R' : 'A'] * u.maxHp)) return -1;
  const sub = NET.role === 'client' && NET.easeAt ? Math.max(0, Math.min(SNAP_EVERY * TICK_DT, now - NET.easeAt / 1000)) : 0;
  const t = (state.tick - u.tallyTick) * TICK_DT + sub;
  return t >= 0 && t <= HIT_PUFF_T ? t : -1;
}
function hitCurOf(u) {
  hitCur.nx = u.hitNx || 0; hitCur.ny = u.hitNy || 0; hitCur.seed = u.tallyTick | 0;
  return hitCur;
}

// where a struck body is drawn off its true spot right now, in whole px:
// held where it was when struck (its walk and shove since, played back),
// sliding back, plus the 1 px recoil along the blow
function hitNudge(u, now) {
  const t = hitAge(u, now);
  if (t < 0 || (t >= HIT_STOP_T + HIT_CATCH_T && t >= HIT_RECOIL_T)) return HIT_NONE;
  let dx = 0, dy = 0;
  if (t < HIT_STOP_T + HIT_CATCH_T) {
    const held = t < HIT_STOP_T ? t : HIT_STOP_T * (1 - (t - HIT_STOP_T) / HIT_CATCH_T);
    dx = -Math.max(-HIT_STOP_MAX, Math.min(HIT_STOP_MAX, ((u.vx || 0) + (u.kbx || 0)) * held));
    dy = -Math.max(-HIT_STOP_MAX, Math.min(HIT_STOP_MAX, ((u.vy || 0) + (u.kby || 0)) * held));
  }
  if (t < HIT_RECOIL_T) { dx += u.hitNx || 0; dy += u.hitNy || 0; }
  hitOff.x = Math.round(dx); hitOff.y = Math.round(dy);
  return hitOff;
}

function hitBodies(fn) {
  for (const p of players) fn(p);
  for (const a of animals) fn(a);
  for (const b of robots) fn(b);
}
// the snow puffs, on the ground under the bodies (render(), before the
// sorted pass), so a body stands in its own snow and the clumps show round it
function drawHitPuffs(ex, ey, now) {
  hitBodies((u) => {
    const t = hitAge(u, now);
    if (t < 0 || !hitShown(u, now) || u.alt || u.fallT > 0) return;
    const n = hitNudge(u, now);
    drawHitPuff(hitCurOf(u), Math.round(u.x + n.x - ex), Math.round(u.y + n.y + (u instanceof Player ? 3 : 2) - ey), t);
  });
}
// the sparks, over the bodies (render(), after the particles)
function drawHitFx(ex, ey, now) {
  hitBodies((u) => {
    const t = hitAge(u, now);
    if (t < 0 || t >= HIT_SPARK_T[2] || !hitShown(u, now)) return;
    const n = hitNudge(u, now), h = hitCurOf(u);
    drawHitSpark(h, Math.round(u.x + n.x - h.nx * 6 - ex), Math.round(u.y + n.y - (u.alt || 0) - 6 - h.ny * 2 - ey), t);
  });
}
function hitShown(u, now) { return fogShown(u, now) && !(u instanceof Player && (!u.active || inAir(u) || u.zip >= 0)); }

// a pixel list drawn with a 1 px rim round all of it (ink unless named), then its colours
function hitInked(pts, rim) {
  ctx.fillStyle = rim || HIT_INK;
  for (const [x, y] of pts) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  for (const [x, y, c] of pts) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
}
// the spark's three directions: a cone back toward the blow, or all round
// when the blow pushed nothing (a soldier's chassis, a beast that held)
function hitAngle(h, i) {
  const j = (hash2(h.seed, i) - 0.5) * 0.4;
  if (!h.nx && !h.ny) return -Math.PI / 2 + i * 2.094 + j;
  return Math.atan2(-h.ny, -h.nx) + (i - 1) * 0.6 + j;
}
function drawHitSpark(h, cx, cy, t) {
  const pts = [];
  if (t < HIT_SPARK_T[0]) {
    // the star: a white heart, three-pixel arms, pale corners
    pts.push([cx, cy, HIT_WHITE]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pts.push([cx + dx, cy + dy, HIT_WHITE], [cx + dx * 2, cy + dy * 2, HIT_WHITE], [cx + dx * 3, cy + dy * 3, HIT_PALE]);
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) pts.push([cx + dx, cy + dy, HIT_PALE]);
  } else if (t < HIT_SPARK_T[1]) {
    // three streaks flying off, white tips
    for (let i = 0; i < 3; i++) {
      const a = hitAngle(h, i), c = Math.cos(a), s = Math.sin(a);
      for (const r of [3, 4, 5]) pts.push([cx + Math.round(c * r), cy + Math.round(s * r), r === 3 ? HIT_PALE : HIT_WHITE]);
    }
  } else {
    // the last of them, one fleck each, further out
    for (let i = 0; i < 3; i++) {
      const a = hitAngle(h, i);
      pts.push([cx + Math.round(Math.cos(a) * 8), cy + Math.round(Math.sin(a) * 8), HIT_WHITE]);
    }
  }
  hitInked(pts);
}
// the snow kicked up at the feet: four clumps thrown out to the sides of
// the push, rising as they go: a lump, a round
// clump, a fleck. White on top, shade under, a dark rim, so a clump reads on snow
const HIT_PUFF_A = [2.0, -2.0, 2.7, -2.7]; // rad off the push each clump flies
const HIT_CLUMP = [['www', 'sss'], ['.ww.', 'wwww', '.ss.'], ['ss']];
function drawHitPuff(h, fx, fy, t) {
  const e = t / HIT_PUFF_T, out = 1 - (1 - e) * (1 - e);
  const push = h.nx || h.ny, g = HIT_CLUMP[e < 0.3 ? 0 : e < 0.7 ? 1 : 2], pts = [];
  for (let i = 0; i < 4; i++) {
    // out to the sides and back toward the blow, where the sliding body is not
    const a = (push ? Math.atan2(h.ny, h.nx) : 0) + HIT_PUFF_A[i] + (hash2(h.seed, i + 3) - 0.5) * 0.3;
    const r = 8 + out * (4 + (i & 1) * 3) + hash2(h.seed, i + 7) * 2;
    const x = fx + Math.round(Math.cos(a) * r), y = fy + Math.round(Math.sin(a) * r * 0.7 - out * (2 + (i & 1) * 2));
    const x0 = x - (g[0].length >> 1), y0 = y - (g.length >> 1);
    for (let row = 0; row < g.length; row++) for (let col = 0; col < g[row].length; col++) {
      const k = g[row][col];
      if (k !== '.') pts.push([x0 + col, y0 + row, k === 'w' ? HIT_WHITE : HIT_SNOW_SHADE]);
    }
  }
  hitInked(pts, HIT_PUFF_RIM);
}
