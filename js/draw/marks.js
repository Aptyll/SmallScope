'use strict';
// The glyph grammar both maps and the world share: a camp's icon and
// clock, and what a body looks like as a dot on the
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
// the seconds left until the whole camp is back (updateCamps, camps.js) as
// the watched side knows them (campLeft: League's rule, a side times only a
// clear it saw happen), plain seconds under a minute and m:ss above. In
// the world it hangs over the camp: its anchor prop (the den's mouth, the
// one carrying `site`) or, for a camp with none, its mark (a warren's
// middle, a bear's bank, campClockDraws). On both maps the number takes the
// under its glyph (drawCampMark, drawCampMapClock). A camp with anything alive in it wears none,
// and so does one that is due and only waiting for you to leave its ground.
const CAMP_CLOCK_INK = '#e8eef8';
const CAMP_EMPTY_INK = '#8a93a8'; // a camp's glyph when it is known empty but not when it is back
function campClockShown(C) {
  const vp = viewPlayer();
  return C ? Math.ceil(campLeft(C, vp ? vp.team : -1)) : 0;
}
function campClockTxt(n) { return n < 60 ? String(n) : clockTxt(n); }
function drawCampClock(C, cx, topY) {
  const n = campClockShown(C);
  if (!n) return;
  const t = campClockTxt(n);
  drawWorldText(t, Math.round(cx - pixelTextWidth(t) / 2), Math.round(topY) - 6, CAMP_CLOCK_INK);
}
// whether a camp stamps an anchor prop (CAMPS' props: one at 0, 0) to wear its clock
function campAnchored(C) { return C.spec.props.some(([dx, dy]) => !dx && !dy); }
// the world clocks of the camps with no anchor to wear them, into the
// y-sorted list (gatherDraws, js/draw/passes.js) at their mark
function campClockDraws(draws, tx0, ty0, tx1, ty1) {
  for (const C of camps) {
    if (!C.spec.pop || campAnchored(C)) continue;
    const m = campMark(C);
    if (m.tx < tx0 || m.tx > tx1 || m.ty < ty0 || m.ty > ty1) continue;
    draws.push({ y: (m.ty + 1) * TILE, fn: drawCampSpotClock, C });
  }
}
function drawCampSpotClock(d, ex, ey) {
  const m = campMark(d.C);
  drawCampClock(d.C, (m.tx + 0.5) * TILE - ex, (m.ty + 0.5) * TILE - ey);
}
// a camp on a map: its glyph in its ink, always (grey when the watched side
// found it empty without seeing it cleared, so knows no time: campEmpty);
// cleared and timed, the seconds until it is back under it, stamped by the map
// last, over every dot, so a clock is never hidden under the body that
// cleared it
function drawCampMark(g, C, x, y) {
  const vp = viewPlayer();
  drawCampIcon(g, C, x, y, vp && campEmpty(C, vp.team) ? CAMP_EMPTY_INK : C.spec.mark, HUD_INK);
}
function drawCampMapClock(g, C, x, y) {
  const n = campClockShown(C);
  if (!n) return;
  const t = campClockTxt(n);
  drawPixelTextOutline(g, t, Math.round(x - pixelTextWidth(t) / 2), Math.round(y) + 5, CAMP_CLOCK_INK, HUD_INK);
}

// ---- the camp's leash ------------------------------------------------------
// While a camp is awake (any of its monsters on a hunt) the edge of its ground
// lies on the snow: the line the leash bar holds inside and drains past
// (campGround, wildlife.js), baked once per camp from that same test, so the
// ring is the leash to the pixel whatever shape a camp's ground takes. It
// comes up as the camp wakes (off the monsters' senseT, so every screen draws
// the same ring), its dashes run round it, and it turns the leash bar's red
// while every hunter's bar drains: the camp is about to give up and go home.
// Only a side that sees one of the hunters sees it, so it tells nobody in the
// fog that a camp is being taken.
const LEASH_INK = '#2f3238'; // the Graphite edge (HUD_EDGE): a dark line reads on snow, ice and dirt
const LEASH_ALPHA = 0.55;
const LEASH_DASH = 6, LEASH_GAP = 4; // px on, px off, round the edge
const LEASH_FLOW = 0.35; // dashes a second that pass a point: the slow run round
const LEASH_IN = 0.3;    // s the ring takes to come up as the camp wakes
const leashEdges = new Map(); // camp -> { r, px: [dx, dy, turn 0..1] } off its centre px
function campLeashEdge(C) {
  let E = leashEdges.get(C);
  if (E) return E;
  const P = C.spec.plan, cx = (C.tx + 0.5) * TILE, cy = (C.ty + 0.5) * TILE;
  const R = (C.r + CAMP_GROUND + (P ? Math.max(P.length, P[0].length) : 0) + 1) * TILE, W = 2 * R + 1;
  // which px are on the ground, tested at each px's centre
  const on = new Uint8Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) on[y * W + x] = campGround(C, cx - R + x + 0.5, cy - R + y + 0.5) ? 1 : 0;
  // the edge: a ground px with open snow beside it (four ways), a clean 8-connected line
  const px = [];
  for (let y = 1; y < W - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!on[i] || (on[i - 1] && on[i + 1] && on[i - W] && on[i + W])) continue;
    const dx = x - R, dy = y - R;
    px.push(dx, dy, (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1);
  }
  E = { r: R, px, n: Math.max(1, Math.round(px.length / 3 / (LEASH_DASH + LEASH_GAP))) }; // a whole number of dashes, so none breaks at the seam
  leashEdges.set(C, E);
  return E;
}
// how awake camp C is to this screen: null while it is asleep or its hunters
// are out of sight, else how far up the ring is and whether every bar drains
function campLeashState(C, now) {
  let up = 0, drain = true;
  for (const a of animals) {
    if (a.dead || a.home !== C || !a.target || !fogShown(a, now)) continue;
    up = Math.max(up, Math.min(1, a.senseT / LEASH_IN));
    if (a.threat >= 1) drain = false;
  }
  return up > 0 ? { up, drain } : null;
}
function drawCampLeashes(ex, ey, now) {
  for (const C of camps) {
    if (!C.spec.pop) continue;
    const S = campLeashState(C, now);
    if (!S) continue;
    const E = campLeashEdge(C), x0 = (C.tx + 0.5) * TILE - ex, y0 = (C.ty + 0.5) * TILE - ey;
    if (x0 + E.r < 0 || y0 + E.r < 0 || x0 - E.r > WV_W || y0 - E.r > WV_H) continue;
    const on = LEASH_DASH / (LEASH_DASH + LEASH_GAP), run = now * LEASH_FLOW;
    ctx.globalAlpha = LEASH_ALPHA * S.up;
    ctx.fillStyle = S.drain ? THREAT_COL : LEASH_INK;
    for (let k = 0; k < E.px.length; k += 3) {
      const t = E.px[k + 2] * E.n - run;
      if (t - Math.floor(t) < on) ctx.fillRect(x0 + E.px[k], y0 + E.px[k + 1], 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ---- the click marks -------------------------------------------------------
// Flat on the snow under everything that walks, in both schemes: where the
// last order landed - a ring that blooms out and fades over CK_MARK_T, white
// for a walk, gold for a job, red for a fight (CK_COL) - and, while the
// basic attack has a MARK (the `attack order` banner, input.js), the two
// things League shows of it: a red ring under the mark's feet (a building's:
// round its footing) and this hero's weapon range round its own, a dotted
// circle that goes solid while the mark stands inside it. Both are places,
// so they scale with the tile.
const ATK_MARK_COL = '#ff6a5c'; // the mark's ring: CK_COL's fight red
const ATK_RANGE_COL = '#eef4fb'; // the range circle: snow-white on a dark step
const ATK_RANGE_ALPHA = 0.8;
const atkRingCache = new Map(); // 'rx,ry' -> [[dx, dy], ...] the rim's pixels, once each
// the whole-pixel rim of an ellipse, each pixel once (heroRingShape's way)
function atkRingPts(rx, ry) {
  const k = rx + ',' + ry;
  let pts = atkRingCache.get(k);
  if (pts) return pts;
  pts = []; const seen = new Set();
  const half = (v, r, q) => Math.round(r * Math.sqrt(Math.max(0, 1 - ((v + 0.5) / q) ** 2)) - 0.5);
  const add = (x, y) => { const s = x + ',' + y; if (!seen.has(s)) { seen.add(s); pts.push([x, y]); } };
  for (let x = -rx; x < rx; x++) { const y = half(x, ry, rx); add(x, y); add(x, -y - 1); }
  for (let y = -ry; y < ry; y++) { const x = half(y, rx, ry); add(x, y); add(-x - 1, y); }
  pts.sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0])); // round the rim, so a dotted ring dots evenly
  atkRingCache.set(k, pts);
  return pts;
}
function drawAtkRing(cx, cy, rx, ry, col, alpha, dot) {
  const pts = atkRingPts(rx, ry);
  ctx.globalAlpha = alpha * 0.7; ctx.fillStyle = '#0a0e23';
  for (let i = 0; i < pts.length; i++) if (!dot || i % dot === 0) ctx.fillRect(cx + pts[i][0], cy + pts[i][1] + 1, 1, 1);
  ctx.globalAlpha = alpha; ctx.fillStyle = col;
  for (let i = 0; i < pts.length; i++) if (!dot || i % dot === 0) ctx.fillRect(cx + pts[i][0], cy + pts[i][1], 1, 1);
  ctx.globalAlpha = 1;
}
function drawClickMarks(ex, ey, now) {
  const m = ck.mark;
  if (m && m.t > 0) {
    const f = m.t / CK_MARK_T, r = Math.round(3 + (1 - f) * 6);
    drawAtkRing(Math.round(m.x - ex), Math.round(m.y - ey), r, Math.max(1, Math.round(r * 0.6)), m.col, f, 0);
  }
  if (!player || player.dead || state.mode !== 'play' || window.DBG.hideUI && !window.DBG.showMarks) return;
  const t = ck.lock && atkGood(player, ck.lock) ? ck.lock : null;
  if (t) drawAtkMark(t, ex, ey, 0.9);
  // the range, while it is the question: the mark is out of it (the feet are
  // walking in), or the pointer is on a rival a press would make the mark
  const hov = !overHud(mouse.x, mouse.y) && !state.mapOpen ? atkPick(player, mouseWX(), mouseWY()) : null;
  if (hov && hov !== t) drawAtkMark(hov, ex, ey, 0.45);
  const q = hov || t;
  if (!q || (q === t && atkIn(player, t))) return;
  // a true circle (the sim measures plain distance), dotted while what it is
  // asked about stands out of reach, whole once it is in
  const R = Math.round(attackOf(player).range);
  drawAtkRing(Math.round(player.x - ex), Math.round(player.y - ey), R, R, ATK_RANGE_COL, ATK_RANGE_ALPHA, atkIn(player, q) ? 0 : 2);
}
// the ring under a mark's feet, a step wider than the hero ring (a building's: round its footing)
function drawAtkMark(t, ex, ey, alpha) {
  if (atkIsStruct(t)) {
    const w = structW(t) * TILE, h = structH(t) * TILE;
    drawAtkRing(Math.round(t.tx * TILE + w / 2 - ex), Math.round(t.ty * TILE + h / 2 - ey), Math.round(w / 2) + 3, Math.round(h / 2) + 2, ATK_MARK_COL, alpha, 0);
    return;
  }
  if (atkIsEagle(t)) { drawAtkRing(Math.round(t.x - ex), Math.round(t.y - ey) + 2, 22, 9, ATK_MARK_COL, alpha, 0); return; }
  const r = Math.max(HERO_RING_RX + 2, Math.round(unitRadius(t) + 5));
  drawAtkRing(Math.round(t.x - ex), Math.round(t.y - ey) + 4, r, Math.max(3, Math.round(r * 0.45)), ATK_MARK_COL, alpha, 0);
}
// ---- what a body looks like on a map ------------------------------------
// ONE GRAMMAR FOR BOTH MAPS (3.32). The minimap disc (renderMinimap, ui.js)
// and the parchment chart (renderWorldMap, panels.js) draw every moving thing
// through these three, so a shape learnt on one is read on the other:
//   a SQUARE in the side's ink is a body, and its size says which - a player
//   k + 1 px, a robot (a soldier, the merchant) k px, so a base's
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
// A LANDMARK: a building whose STRUCTS entry names a `glyph` (the road tower, a bay)
// wears it on both maps over its own tiles, in its side's ink on the map's
// dark rim. A tower is a rook: a merlon either side of a gap over a solid
// body, 3 x 5 px on the disc (k 1) and 5 x 7 on the chart (k 2), so where a
// lane is held reads before any body on it does. Standing ones only: a
// felled tower leaves `structures`, and its glyph goes with it.
const MAP_GLYPHS = {
  tower(g, x, y, col, rim, k) {
    const w = 2 * k + 1, h = 2 * k + 3, x0 = Math.round(x) - k, y0 = Math.round(y) - h + 1 + k;
    g.fillStyle = rim; g.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    g.fillStyle = col; g.fillRect(x0, y0 + k, w, h - k);
    g.fillRect(x0, y0, k, k); g.fillRect(x0 + w - k, y0, k, k); // the two merlons
  },
  // a soldiers' bay: a low block with its door open in the map's dark
  bay(g, x, y, col, rim, k) {
    const w = 2 * k + 1, h = 2 * k, x0 = Math.round(x) - k, y0 = Math.round(y) - k;
    g.fillStyle = rim; g.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    g.fillStyle = col; g.fillRect(x0, y0, w, h);
    g.fillStyle = rim; g.fillRect(x0 + k, y0 + h - k, 1, k);
  },
};
// every standing landmark through `put(o, cx, cy)` -> its map px, or null to skip it
function drawMapStructs(g, put, rim, k) {
  for (const o of structures) {
    const fn = MAP_GLYPHS[STRUCTS[o.type] && STRUCTS[o.type].glyph];
    if (!fn) continue;
    const at = put((o.tx + structW(o) / 2) * TILE, (o.ty + structH(o) / 2) * TILE);
    if (at) fn(g, at[0], at[1], TEAMS[skin(o.team)].mark, rim, k);
  }
}
// the objective is the biggest mark on a map: a solid diamond in its side's
// ink, 7 px across on the disc (k 1) and 9 on the chart (k 2), over a tower's rook
function drawMapBird(g, x, y, col, rim, k) {
  const gx = Math.round(x), gy = Math.round(y), r = k + 2;
  for (const [c, q] of [[rim, r + 1], [col, r]]) {
    g.fillStyle = c;
    for (let dy = -q; dy <= q; dy++) { const h = q - Math.abs(dy); g.fillRect(gx - h, gy + dy, 2 * h + 1, 1); }
  }
}
