'use strict';
// ------------------------------------------------------------ falls
// A soldier or a beast going down (the record: `falls`, unitFall, js/sim/farm.js),
// drawn from the body's own pixels where it stood, sorted with the bodies. A white
// blink, then: a machine comes apart in blocks thrown the way the blow went, which
// land, lie on the snow and are gone one by one; a beast tips over away from the
// blow, lands in a puff of snow, and the snow takes it from the ground up.
const FALL_FLASH = 0.07, FALL_TIP = 0.16, FALL_LIE = 0.5;
const fallTipOf = new WeakMap(); // frame -> its pixels tipped 45 and 90 degrees, each way

// the frame a fall was standing in
function fallSpr(f) {
  if (f.k === 'R') {
    const type = f.spr, set = (SPRITES[type] || SPRITES.robotTeam)[skin(f.team)] || SPRITES.robot;
    return set[f.left && set.length > 4 ? 4 : 0];
  }
  const kind = f.spr, set = SPRITES[kind] && SPRITES[kind][f.dir];
  return set && set.idle ? set.idle[0] : null;
}
// a frame's pixels turned about its feet, by sampling back into the frame so no
// turn leaves holes: [x, y, col] off the feet's centre, lowest pixel on the ground
function fallTipped(spr, side) {
  let T = fallTipOf.get(spr);
  if (!T) fallTipOf.set(spr, (T = {}));
  if (T[side]) return T[side];
  const px = downPixels(spr), w = spr.width, h = spr.height, at = new Map();
  for (const q of px) at.set(q.y * w + q.x, q.col);
  const R = Math.ceil(Math.hypot(w, h)), out = [];
  for (const deg of [45, 90]) {
    const a = side * deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), pts = [];
    let low = -1e9;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const sx = Math.round(c * x + s * y + w / 2 - 0.5), sy = Math.round(-s * x + c * y + h - 1);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const col = at.get(sy * w + sx);
      if (col) { pts.push([x, y, col]); if (y > low) low = y; }
    }
    for (const q of pts) q[1] -= low;
    out.push(pts);
  }
  return (T[side] = out);
}

function fallDraws(draws, now) {
  const vp = viewPlayer();
  for (const f of falls) {
    const t = (state.tick - f.tick) * TICK_DT;
    if (t < 0 || t > FALL_T || (vp && !inSight(vp.team, f))) continue; // one in the fog is not seen (js/sim/fog.js)
    draws.push({ y: f.y + 4, fall: f });
  }
}

function drawFall(f, ex, ey) {
  const spr = fallSpr(f);
  if (!spr) return;
  const t = (state.tick - f.tick) * TICK_DT, w = spr.width, h = spr.height, px = downPixels(spr), seed = (Math.round(f.x) * 7 + Math.round(f.y) * 13 + f.tick) | 0;
  const ax = f.k === 'R' ? (f.left && w > 0 ? w - (SPRITES.robotAx[f.spr] || 6) : SPRITES.robotAx[f.spr] || 6) : w / 2;
  const ox = Math.round(f.x - ex - ax), gy = Math.round(f.y + 4 - ey), oy = gy - h;
  if (t < FALL_FLASH) { ctx.fillStyle = '#ffffff'; for (const q of px) ctx.fillRect(ox + q.x, oy + q.y, 1, 1); return; }
  const tt = t - FALL_FLASH;
  if (f.k === 'R') { // a machine: blocks of three, thrown, landed, gone one by one
    const ux = Math.cos(f.ang), uy = Math.sin(f.ang);
    for (const q of px) {
      const bx = (q.x / 3) | 0, by = (q.y / 3) | 0, r1 = fxRoll(seed, bx, by), r2 = fxRoll(seed, by + 40, bx);
      if (t > FALL_LIE + r1 * (FALL_T - FALL_LIE - 0.05)) continue; // this block has gone into the snow
      if (q.y >= h - 4) { ctx.fillStyle = q.col; ctx.fillRect(ox + q.x, oy + q.y, 1, 1); continue; } // the treads stay where they stopped
      const vx = (bx * 3 + 1.5 - w / 2) * 2.2 + ux * 12 + (r1 - 0.5) * 14, up = 30 + r2 * 36;
      const off = Math.abs(q.x + vx * 0.35 - w / 2); // how far from the middle it lands: the middle heaps up on the treads
      const rest = gy - 1 + Math.round(uy * 3 + (r2 - 0.5) * 4) - Math.max(0, Math.round(5 - off * 0.8)) - (2 - (q.y % 3)); // where its block comes to rest
      const air = (up + Math.sqrt(up * up + 2 * 260 * Math.max(0, rest - (oy + q.y)))) / 260; // s until it lands
      const a = Math.min(tt, air);
      const x = ox + q.x + vx * a, y = tt >= air ? rest : oy + q.y - up * a + 130 * a * a;
      ctx.fillStyle = q.col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    return;
  }
  // a beast: tipped over away from the blow, then the snow takes it
  const side = Math.cos(f.ang) < 0 ? -1 : 1, T = fallTipped(spr, side), cx = Math.round(f.x - ex);
  const pts = tt < FALL_TIP / 2 ? T[0] : T[1];
  const lie = h * 0.5, slide = Math.round(side * Math.min(1, tt / FALL_TIP) * Math.min(4, h / 4));
  let low = 0; for (const q of T[1]) low = Math.min(low, q[1]);
  const sink = t < FALL_LIE ? 0 : Math.ceil(((t - FALL_LIE) / (FALL_T - FALL_LIE)) * (-low + 1));
  for (const q of pts) {
    if (q[1] + sink > 0) continue; // under the snow now
    ctx.fillStyle = sink && q[1] + sink > -2 ? '#dfe9f7' : q[2]; // the row at the snow line pales
    ctx.fillRect(cx + slide + q[0], gy + q[1] + sink, 1, 1);
  }
  if (tt >= FALL_TIP / 2 && tt < FALL_TIP / 2 + 0.3) { // the snow it lands in, thrown up either side and settling
    const u = (tt - FALL_TIP / 2) / 0.3, n = Math.max(3, Math.round(lie / 3));
    ctx.globalAlpha = 1 - u * 0.6;
    for (let k = 0; k < n; k++) {
      const d = (k % 2 ? 1 : -1) * (2 + fxRoll(seed, k, 5) * (h * 0.5 + 3)), r = Math.max(1, Math.round((1 - u) * (1 + fxRoll(seed, k, 6) * 2)));
      const x = cx + slide + side * lie * 0.5 + d * (0.6 + 0.4 * u), y = gy - Math.round(Math.sin(u * Math.PI) * (3 + fxRoll(seed, k, 7) * 5));
      fxPatch(Math.round(x), y + 1, r, 0.7, 1, seed + k, '#9fb4d6');
      fxPatch(Math.round(x), y, r, 0.7, 1, seed + k, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }
}
