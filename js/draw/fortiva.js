'use strict';
// ------------------------------------------------------------ fortiva
// FORTIVA's pixels (her rules: js/sim/fortiva.js): the shapes her keys put on the
// snow while they wind up, and what her state wears on her body - resolve high
// as gold glints circling her, DEFIANT HEART's shield as a gold shell round
// her, NO KNEELING's after as embers off her shoulders.

// SEVER THE CHAINS' wind-up: the arc, and its outer edge - where it cuts harder
// and heals - hashed in solid as the blade comes round
function drawSeverTele(px, py, a, col, closing) {
  drawWedge(px, py, a, SEVER_R, SEVER_HALF, col, 0.55 + 0.4 * closing, 0);
  ctx.globalAlpha = 0.35 + 0.5 * closing;
  ctx.fillStyle = TELE_HOT;
  for (let r = SEVER_EDGE; r <= SEVER_R - 1; r += 2) {
    const steps = Math.ceil(r * SEVER_HALF);
    for (let k = -steps; k <= steps; k += 2) {
      if ((r / 2 + k / 2) % 2) continue;
      const t = a + k / r;
      ctx.fillRect(Math.round(px + Math.cos(t) * r), Math.round(py + Math.sin(t) * r), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// BREAK THE YOKE's wind-up: the lunge's line, and the ring it strikes at its end
function drawYokeTele(p, a, col, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a);
  const len = teleLen(p.x, p.y, nx, ny, YOKE_SPD * YOKE_T);
  drawTeleLine(p.x, p.y, nx, ny, len, col, 0.5 + 0.45 * closing, now, ex, ey);
  drawRing(Math.round(p.x + nx * (len + 8) - ex), Math.round(p.y + ny * (len + 8) - ey) + 2, YOKE_R, col, 0.5 + 0.4 * closing, closing * 0.5);
}
// NO KNEELING's wind-up: the spot she comes down on, its heart (where bodies
// are thrown up) filling in, and the line of the leap to it
function drawNoKneelTele(p, col, closing, ex, ey) {
  const [tx, ty, d] = noKneelAt(p);
  const px = Math.round(tx - ex), py = Math.round(ty - ey);
  drawRing(px, py + 2, NOKNEEL_R, col, 0.5 + 0.45 * closing, 0);
  drawRing(px, py + 2, NOKNEEL_UP_R, TELE_HOT, 0.4 + 0.5 * closing, closing);
  if (d > 4) drawTeleLine(p.x, p.y, (tx - p.x) / d, (ty - p.y) / d, d, col, 0.3 + 0.3 * closing, 0, ex, ey);
}

// ---- on her body ------------------------------------------------------------------
function drawFortBody(p, ax, ay, now, front) {
  if (CLASSES[p.cls].passive !== 'unbroken' || p.prone) return;
  const cx = ax + 8, cy = ay + 10;
  // resolve high: two glints circling her waist, the near one drawn over her, the far behind
  if (p.resolve >= UNB_HIGH) {
    for (let k = 0; k < 2; k++) {
      const t = now * 3 + k * Math.PI, near = Math.sin(t) > 0;
      if (near !== front) continue;
      ctx.fillStyle = Math.floor(now * 8 + k) % 3 ? '#f2cc6a' : '#ffffff';
      ctx.fillRect(Math.round(cx + Math.cos(t) * 8), Math.round(cy + Math.sin(t) * 3), 1, 1);
    }
  }
  if (!front) return;
  // DEFIANT HEART: the shell, thinning as its clock runs out
  if (p.defyT > 0 && p.wardHp > 0) {
    ctx.globalAlpha = 0.35 + 0.5 * Math.min(1, p.defyT / DEFY_T);
    ctx.fillStyle = '#f2cc6a';
    for (let i = 0; i < 20; i++) {
      if ((i + Math.floor(now * 10)) % 5 === 0) continue;
      const t = (i / 20) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(t) * 9), Math.round(ay + 8 + Math.sin(t) * 10), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  // NO KNEELING's after: embers rising off her shoulders
  if (p.nkT > 0) {
    for (let k = 0; k < 3; k++) {
      const u = (now * 1.5 + k / 3) % 1;
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = k % 2 ? '#f2cc6a' : '#ffd95c';
      ctx.fillRect(ax + (k === 1 ? 12 : 3 + k), Math.round(ay + 4 - u * 8), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
HERO_BODY_FX.push(drawFortBody);
