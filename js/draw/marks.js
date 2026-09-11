'use strict';
// The glyph grammar both maps and the world share: a camp's icon and
// clock, the flag family (icon, pennant, ring, mark, the planted banner),
// and what a body looks like as a dot on the minimap or the chart.
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
// A cleared camp's respawn clock, worn by its anchor prop (the den's mouth,
// the alpha stone - the one carrying `site`) under the pointer: the same
// neutral bar a picked bush wears, filling toward the camp coming back
// (updateCamps, world.js) - full and holding is a camp that is due and
// waiting for you to leave. A camp with anything alive in it wears none.
function drawCampClock(o, cx, topY) {
  const C = o.site;
  if (!C || campPop(C) > 0) return;
  drawHealthBar(cx, topY, C.spec.repop - C.repopT, C.spec.repop, 12);
}

// ---- what a flag looks like ---------------------------------------------
// the order's glyph, 7x7 about (x, y) at scale s (1 on a banner, 2 on the
// wheel), stamped with the 1px dark rim a camp's icon uses so it reads on
// snow, on parchment and on team cloth alike
function drawFlagIcon(g, type, x, y, col, rim, s) {
  const spec = FLAG_TYPES[type];
  if (!spec) return;
  s = s || 1;
  const x0 = Math.round(x) - 3 * s, y0 = Math.round(y) - 3 * s;
  g.fillStyle = rim || '#0f1632';
  for (const [rx, ry, rw, rh] of spec.icon) g.fillRect(x0 + rx * s - 1, y0 + ry * s - 1, rw * s + 2, rh * s + 2);
  g.fillStyle = col || spec.col;
  for (const [rx, ry, rw, rh] of spec.icon) g.fillRect(x0 + rx * s, y0 + ry * s, rw * s, rh * s);
}
// the small marker - a pole and a pennant, (x, y) is its FOOT. Both maps and
// the wheel's lift hub draw the same one, so a flag is the same shape
// whatever it is standing on.
function drawFlagPennant(g, x, y, col, rim) {
  const px = Math.round(x), py = Math.round(y);
  const rects = [[px, py - 7, 1, 8], [px + 1, py - 7, 4, 3]];
  g.fillStyle = rim || '#0f1632';
  for (const [rx, ry, rw, rh] of rects) g.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
  g.fillStyle = col;
  for (const [rx, ry, rw, rh] of rects) g.fillRect(rx, ry, rw, rh);
}
// THE RING: the ground an order covers, FLAG_R about the flag, drawn flat on
// the snow under everything that walks it. A dark line under a dashed one
// in THE SIDE'S INK (3.32: it wore FLAG_MINE before, and white on snow was a
// ring nobody saw - the glyph on the pennant says which order, the ring
// says whose ground), two pixels wide, the dashes crawling round it so a
// standing order reads as live and not as a boundary painted on the map;
// `a` fades the one a held wheel previews, which keeps the lit wedge's
// colour since it is the wheel's, not yet an order. g is the world canvas at
// whatever zoom, so the ring scales with the tile - it is a place, not a HUD
// element.
function drawFlagRing(g, cx, cy, col, now, a) {
  g.save();
  g.globalAlpha = a;
  g.lineWidth = 2;
  g.setLineDash([4, 4]);
  g.lineDashOffset = -((now * 6) % 8);
  g.strokeStyle = '#0f1632';
  g.beginPath(); g.arc(cx, cy + 1, FLAG_R, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = col;
  g.beginPath(); g.arc(cx, cy, FLAG_R, 0, Math.PI * 2); g.stroke();
  g.restore();
}
// every standing ring on your side (the y-sorted pole is drawFlag's), and -
// while a flag wheel is held - the ring the pick would lay, in the lit
// wedge's colour, or grey from the hub where nothing is chosen yet
function drawFlagRings(ox, oy, now) {
  const team = viewPlayer().team;
  for (const q of players) {
    if (!q.active || !q.flag || q.team !== team) continue;
    const f = q.flag;
    drawFlagRing(ctx, f.tx * TILE + 8 - ox, f.ty * TILE + 8 - oy, TEAMS[skin(q.team)].mark, now, 0.85);
  }
  const w = state.wheel;
  if (w && w.kind === 'flag' && !state.mapOpen) {
    const L = wheelLayout();
    const col = L.seg >= 0 ? FLAG_TYPES[L.opts[L.seg].id].col : '#8fa4c8';
    drawFlagRing(ctx, w.tx * TILE + 8 - ox, w.ty * TILE + 8 - oy, col, now, L.seg >= 0 ? 0.7 : 0.3);
  }
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
// The planted flag itself, in the world pass (y-sorted with the entities): a
// pole at the tile's centre and a dark banner on it carrying the SAME order
// icon the wheel offered, inked in the team's colour - so what the side was
// told, and who told them, both read from across the field. Dark cloth and a
// bright glyph, not the other way round: at nine pixels square a solid
// colour with a hole punched in it is a blob, and the glyph is the message.
function drawFlag(q, ex, ey, now) {
  const f = q.flag;
  const bx = Math.round(f.tx * TILE + 8 - ex), by = Math.round((f.ty + 1) * TILE - 2 - ey);
  const col = TEAMS[skin(q.team)].mark;
  ctx.fillStyle = 'rgba(110,130,170,0.35)';
  ctx.fillRect(bx - 3, by - 1, 7, 2);
  ctx.fillStyle = '#0f1632'; ctx.fillRect(bx - 1, by - 21, 3, 21);
  ctx.fillStyle = '#c9d0e2'; ctx.fillRect(bx, by - 20, 1, 19);
  ctx.fillStyle = col; ctx.fillRect(bx - 1, by - 4, 3, 3); // a team-coloured collar at the foot
  const w = Math.round(Math.sin(now * 2.4 + f.tx)); // 1px of flutter
  ctx.fillStyle = '#0f1632';
  ctx.fillRect(bx + w, by - 21, 13, 11);
  ctx.fillStyle = '#141c3c';
  ctx.fillRect(bx + 1 + w, by - 20, 11, 9);
  drawFlagIcon(ctx, f.type, bx + 6 + w, by - 16, col, '#141c3c');
}
// a flag on either map: the pennant with the ring it covers about it, at that
// map's px per tile - the ring is the order's whole meaning, so the maps
// carry it too: the ground inside washed in the side's ink, a dark rim under
// a solid line of the same ink (3.32: a lone line at a third alpha was a
// ring nobody saw). (x, y) is the pennant's foot.
function drawFlagMark(g, x, y, f, col, rim, s) {
  const r = FLAG_R / TILE * s, cx = Math.round(x) + 0.5, cy = Math.round(y) - 2.5;
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
  g.globalAlpha = 0.18; g.fillStyle = col; g.fill();
  g.globalAlpha = 0.7; g.lineWidth = 3; g.strokeStyle = rim || '#0f1632'; g.stroke();
  g.globalAlpha = 1; g.lineWidth = 1; g.strokeStyle = col; g.stroke();
  g.restore();
  drawFlagPennant(g, x, y, col, rim);
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
function drawMapUnit(g, x, y, col, rim, k, bot) { drawMapDot(g, x, y, bot ? k : k + 1, col, rim); }
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
