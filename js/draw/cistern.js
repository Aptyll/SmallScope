'use strict';
// ------------------------------------------------------------ the cistern's pixels
// The cistern (js/sim/cistern.js) is baked art, SPRITES.cistern (js/baked/cistern.js,
// app/bake-cistern/paint.py), drawn in two places:
//   the flat layer  the gates' sills and every shadow it throws, laid into
//                   the ground canvas a tile at a time like the creek
//                   (paintCisternFlat, from paintGroundTile), under
//                   everything that walks
//   the stone       the wall, the piers and the fallen blocks, cut by the
//                   ground row each px stands on into pieces two rows deep,
//                   each in render's y-sorted pass at the key of a body whose
//                   feet stand on its middle row (pushMiddleDraws). So a body
//                   is drawn over every stone standing north of its feet and
//                   under every stone standing south of them: behind the wall
//                   only a hat shows over it
// '.' draws the footprint's edge over the art (drawCisternHitbox): the line
// a body's feet are held off by its radius.
function cistOrigin() { return cisternC() - SPRITES.cistern.rb; }

// one tile's share of the flat layer into the ground canvas (g at world px)
function paintCisternFlat(g, tx, ty, px, py) {
  if (!cistOn) return;
  const F = SPRITES.cistern.flat, o = cistOrigin();
  const sx = px - (o + F.x), sy = py - (o + F.y), w = F.c.width, h = F.c.height;
  if (sx + TILE <= 0 || sy + TILE <= 0 || sx >= w || sy >= h) return;
  const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(w, sx + TILE), y1 = Math.min(h, sy + TILE);
  penFlush();
  g.drawImage(F.c, x0, y0, x1 - x0, y1 - y0, px + x0 - sx, py + y0 - sy, x1 - x0, y1 - y0);
}

// what stands at the middle, into render's y-sorted list: every piece of
// the cistern's stone the view reaches, and the orca while it is up out of
// its ice (sorted by its hole's waterline, js/draw/orca.js)
function pushMiddleDraws(draws, ox, oy) {
  if (orca.on && orca.mode === 'up') draws.push({ y: orca.hy + 2, fn: drawOrcaUp });
  if (!cistOn) return;
  const o = cistOrigin();
  for (const s of SPRITES.cistern.segs) {
    const x = o + s.x, y = o + s.y;
    if (x + s.c.width <= ox || y + s.c.height <= oy || x >= ox + WV_W || y >= oy + WV_H) continue;
    draws.push({ y: o + s.k, fn: drawCisternSeg, s });
  }
}
function drawCisternSeg(d, ex, ey) { const o = cistOrigin(); ctx.drawImage(d.s.c, o + d.s.x - ex, o + d.s.y - ey); }
function drawOrcaUp(d, ex, ey) { drawOrcaBreach(ex, ey); }

// the hitbox view: the footprint's edge px, and each body near it its feet's
// ring (the circle cisternReach holds off the stone, CIST_FOOT under its x, y)
function drawCisternHitbox(ox, oy, ex, ey, col, bodyCol) {
  const f = cistField;
  if (!cistOn || !f) return;
  ctx.fillStyle = col;
  const x0 = Math.max(f.x, ox), y0 = Math.max(f.y, oy), x1 = Math.min(f.x + f.w, ox + WV_W), y1 = Math.min(f.y + f.h, oy + WV_H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const d = f.d[(y - f.y) * f.w + x - f.x];
    if (d === 0 && (cisternDist(x - 1, y) || cisternDist(x + 1, y) || cisternDist(x, y - 1) || cisternDist(x, y + 1))) ctx.fillRect(x - ox, y - oy, 1, 1);
  }
  const near = (u, r) => cisternDist(u.x, u.y + CIST_FOOT) < r + 24;
  for (const p of players) if (p.active && !p.dead && !inAir(p) && near(p, PLAYER_R)) hbRing(p.x - ex, p.y + CIST_FOOT - ey, PLAYER_R, bodyCol);
  for (const a of animals) if (!a.dead && near(a, unitRadius(a))) hbRing(a.x - ex, a.y + CIST_FOOT - ey, unitRadius(a), bodyCol);
  for (const b of robots) if (unitAlive(b) && near(b, unitRadius(b))) hbRing(b.x - ex, b.y + CIST_FOOT - ey, unitRadius(b), bodyCol);
}
