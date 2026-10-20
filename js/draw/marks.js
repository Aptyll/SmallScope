'use strict';
// The glyph grammar both maps and the world share: a camp's icon and
// clock, a soldier's pennant, and what a body looks like as a dot on the
// minimap or the chart.
// ---- the camp glyph both maps and the drop chart stamp -------------------
// a camp's glyph, centred on x,y: a rim pass so it reads on parchment,
// snow and forest alike, then the ink
function drawCampIcon(g, C, x, y, col, rim) {
  const x0 = Math.round(x) - 3, y0 = Math.round(y) - 3;
  g.fillStyle = rim || '#241a10';
  for (const [rx, ry, rw, rh] of C.spec.icon) g.fillRect(x0 + rx - 1, y0 + ry - 1, rw + 2, rh + 2);
  g.fillStyle = col || C.spec.mark;
  for (const [rx, ry, rw, rh] of C.spec.icon) g.fillRect(x0 + rx, y0 + ry, rw, rh);
}
// A cleared camp's respawn clock, so a jungle route can be walked on it:
// the seconds left until the whole camp is back (updateCamps, camps.js),
// worn by its anchor prop (the den's mouth, the black bear stone - the one
// carrying `site`) at all times, and the same seconds under its glyph on
// both maps (drawCampMark). A camp with anything alive in it wears none, and
// so does one that is due and only waiting for you to leave its ground.
// Under the fog (js/sim/fog.js) a side knows a clock only while it can see
// the camp: out of its sight it keeps counting the last clock it saw down
// (this screen's own memory, never the match's), and a camp cleared where
// nobody of the side was looking shows no clock at all - League's rule.
const CAMP_CLOCK_INK = '#e8eef8';
function campClock(C) { return C.spec.pop > 0 && C.repopT > 0 && campPop(C) === 0 ? Math.ceil(C.repopT) : 0; }
const campSeen = new WeakMap(); // camp -> { left, tick, eye }: its clock when the watched side last saw it
function campClockSeen(C) {
  let m = campSeen.get(C);
  if (!m) campSeen.set(C, m = { left: 0, tick: 0, eye: { x: (C.tx + 0.5) * TILE, y: (C.ty + 0.5) * TILE, team: -1 } });
  const vp = viewPlayer();
  if (!vp || inSight(vp.team, m.eye)) { m.left = campClock(C); m.tick = state.tick; return m.left; }
  return m.left ? Math.max(0, Math.ceil(m.left - (state.tick - m.tick) * TICK_DT)) : 0;
}
function drawCampClock(o, cx, topY) {
  const n = o.site ? campClockSeen(o.site) : 0;
  if (!n) return;
  const t = String(n);
  drawWorldText(t, Math.round(cx - pixelTextWidth(t) / 2), Math.round(topY) - 6, CAMP_CLOCK_INK);
}
// a camp on a map: its glyph in its ink, or - cleared - in grey with the
// seconds until it is back under it
function drawCampMark(g, C, x, y) {
  const n = campClockSeen(C);
  drawCampIcon(g, C, x, y, n ? '#8a93a8' : C.spec.mark, HUD_INK);
  if (n) drawPixelTextOutline(g, String(n), Math.round(x - pixelTextWidth(String(n)) / 2), Math.round(y) + 5, CAMP_CLOCK_INK, HUD_INK);
}

// ---- a pennant ------------------------------------------------------------
// a pole and a pennant, (x, y) is its FOOT, rimmed dark: the side's pennant a
// wave's soldier carries (drawRobot, js/draw/bodies.js)
function drawPennant(g, x, y, col, rim) {
  const px = Math.round(x), py = Math.round(y);
  const rects = [[px, py - 7, 1, 8], [px + 1, py - 7, 4, 3]];
  g.fillStyle = rim || '#0f1632';
  for (const [rx, ry, rw, rh] of rects) g.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
  g.fillStyle = col;
  for (const [rx, ry, rw, rh] of rects) g.fillRect(rx, ry, rw, rh);
}
// The CLICK scheme's two rings (the `click to move` banner, input.js), flat
// on the snow under everything that walks: where the last order landed - a
// ring that blooms out and fades over CK_MARK_T, white for a walk, gold for
// a job, red for a fight (CK_COL) - and, while a lock holds, a ring under
// the target's feet in its side's ink (a camp's monster: the hunt's amber),
// breathing, so who the tool is on reads on the body itself. Both are
// places, so they scale with the tile.
function drawClickMarks(ex, ey, now) {
  if (!ckOn()) return;
  const m = ck.mark;
  if (m && m.t > 0) {
    const f = m.t / CK_MARK_T, r = 3 + (1 - f) * 6;
    const x = Math.round(m.x - ex), y = Math.round(m.y - ey);
    ctx.save();
    ctx.globalAlpha = f;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#0f1632';
    ctx.beginPath(); ctx.ellipse(x, y + 1, r, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = m.col;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  const t = ck.lock;
  if (t && unitAlive(t)) {
    const col = t.team !== undefined && TEAMS[skin(t.team)] ? TEAMS[skin(t.team)].mark : '#f2cc6a';
    const r = 7 + Math.sin(now * 7) * 0.8;
    const x = Math.round(t.x - ex), y = Math.round(t.y - ey) + 4;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#0f1632';
    ctx.beginPath(); ctx.ellipse(x, y + 1, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
// The MOUSE scheme's RANGE PREVIEW (the `mouse only` banner, input.js): the
// ground an ability covers, from the body toward where it would be cast -
// the lit wedge of a held action wheel toward its press point, or a readied
// well toward the pointer. The row's own `aim` (CLASS_AB) says the shape: a
// line out to its reach, a cone, or a ring round the body. Gold when it
// will cast, grey while it cannot. A place like the click rings, so it
// scales with the tile.
function drawCastPreview(ex, ey, now) {
  if (!msOn() || player.dead || !player.active) return;
  const w = state.wheel;
  let i = -1, tx = mouseWX(), ty = mouseWY();
  if (w && w.kind === 'kit') { const L = wheelLayout(); i = L.seg >= 0 ? kitAb(MS_WHEEL[L.seg]) : -1; tx = w.wx; ty = w.wy; }
  else if (!w && ms.ready >= 0 && !overHud(mouse.x, mouse.y)) i = ms.ready;
  if (i < 0) return;
  const a = abOf(player, i).aim;
  if (!a) return;
  const col = abReady(player, i) ? '#ffd95c' : '#8fa4c8';
  const px = player.x - ex, py = player.y - ey;
  const ang = Math.atan2(ty - player.y, tx - player.x);
  const shape = (g) => {
    g.beginPath();
    if (a.ring) g.arc(px, py, a.ring, 0, Math.PI * 2);
    else if (a.cone) { g.moveTo(px, py); g.arc(px, py, a.cone, ang - a.half, ang + a.half); g.closePath(); }
    else { g.moveTo(px, py); g.lineTo(px + Math.cos(ang) * a.line, py + Math.sin(ang) * a.line); }
    g.stroke();
  };
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.lineDashOffset = -((now * 8) % 6);
  ctx.translate(0, 1); ctx.strokeStyle = '#0f1632'; shape(ctx);
  ctx.translate(0, -1); ctx.strokeStyle = col; shape(ctx);
  ctx.restore();
}
// ---- what a body looks like on a map ------------------------------------
// ONE GRAMMAR FOR BOTH MAPS (3.32). The minimap disc (renderMinimap, ui.js)
// and the parchment chart (renderWorldMap, panels.js) draw every moving thing
// through these three, so a shape learnt on one is read on the other:
//   a SQUARE in the side's ink is a body, and its size says which - a player
//   k + 1 px, a robot (a worker, a soldier, the merchant) k px, so a base's
//   crew never outweighs the ten that matter (k is 2 on the chart, 1 on the
//   disc);
//   the WATCHED body - you, or whoever the camera rides - is a player's
//   square gone WHITE inside a ring of its side's ink: "me" and "my side" in
//   one mark, never a colour of its own that would read as a third team;
//   the BIRD DIAMOND is an objective, roosted or flying.
// Each sits on a 1 px rim in the map's own dark so it reads on snow, forest,
// ice and parchment alike. (x, y) is the body's centre in that map's px.
function drawMapDot(g, x, y, size, col, rim) {
  const x0 = Math.round(x) - (size >> 1), y0 = Math.round(y) - (size >> 1);
  g.fillStyle = rim; g.fillRect(x0 - 1, y0 - 1, size + 2, size + 2);
  g.fillStyle = col; g.fillRect(x0, y0, size, size);
}
// a rival under a colour-blind palette wears a cross (foeCue, js/sim/player.js)
function drawMapUnit(g, x, y, col, rim, k, bot, foe) {
  if (foe) drawMapCross(g, x, y, bot ? k : k + 1, col, rim);
  else drawMapDot(g, x, y, bot ? k : k + 1, col, rim);
}
// a plus whose arms are `size` thick and 3 x size long, rimmed all round
function drawMapCross(g, x, y, size, col, rim) {
  const len = size * 3, x0 = Math.round(x) - (size >> 1), y0 = Math.round(y) - (size >> 1), a = x0 - size, b = y0 - size;
  g.fillStyle = rim;
  g.fillRect(x0 - 1, b - 1, size + 2, len + 2); g.fillRect(a - 1, y0 - 1, len + 2, size + 2);
  g.fillStyle = col;
  g.fillRect(x0, b, size, len); g.fillRect(a, y0, len, size);
}
function drawMapYou(g, x, y, col, rim, k) {
  drawMapDot(g, x, y, k + 3, col, rim);
  const x0 = Math.round(x) - ((k + 1) >> 1), y0 = Math.round(y) - ((k + 1) >> 1);
  g.fillStyle = '#ffffff'; g.fillRect(x0, y0, k + 1, k + 1);
}
function drawMapBird(g, x, y, col, rim) {
  const gx = Math.round(x), gy = Math.round(y);
  g.fillStyle = rim;
  g.fillRect(gx - 3, gy - 1, 7, 3); g.fillRect(gx - 1, gy - 3, 3, 7);
  g.fillStyle = col;
  g.fillRect(gx - 2, gy, 5, 1); g.fillRect(gx, gy - 2, 1, 5);
}

// ---- a zipline on a map --------------------------------------------------
// A two-pixel ribbon in its side's ink, pylon to pylon (each run doubled one
// pixel to the right, so a diagonal reads as one solid stroke and not a
// stair of dots), and each pylon a pale pixel on it: where the fast way out
// runs and where it can be boarded, under the bodies. No dark rim: a dark
// underline read as a black cable and dark studs as bodies (both tried).
// Rasterised a pixel at a time like the disc's rims - a canvas stroke smears
// a 1px line over two. (sx, sy) map a world point to the map; `keep(x, y)`
// says whether a pixel may land (the disc's clip).
const MAP_ZIP_PYLON = '#f4f7ff';
function drawMapZip(g, z, sx, sy, col, keep) {
  const at = (x, y) => { if (!keep || keep(x, y)) g.fillRect(x, y, 1, 1); };
  g.fillStyle = col;
  for (let i = 1; i < z.pts.length; i++) {
    const x0 = Math.round(sx(z.pts[i - 1].x)), y0 = Math.round(sy(z.pts[i - 1].y));
    const x1 = Math.round(sx(z.pts[i].x)), y1 = Math.round(sy(z.pts[i].y));
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n);
      at(x, y); at(x + 1, y);
    }
  }
  g.fillStyle = MAP_ZIP_PYLON;
  for (const p of z.pts) at(Math.round(sx(p.x)), Math.round(sy(p.y)));
}
