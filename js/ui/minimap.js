'use strict';
// Both maps' chart - the class map, its flatten, its resample into a square
// of any size and the marks over it - and the minimap, the square of the
// whole map in the bottom-right corner. The M map's slab is js/ui/panels.js;
// the marks' glyphs come from js/draw/marks.js.
// ------------------------------------------------------------ chart
// THE CHART IS A DRAWN MAP, NOT A PHOTOGRAPH OF THE TILES (3.32). Every tile
// files under one CH_* class (objChart for what stands on it, else the
// ground array), and the class map is FLATTENED before it is painted: a lone
// tile of forest or ice is dropped (fewer than CHART_NEED neighbours of its
// own kind and it is ground again), a snow pinhole with three sides of one
// mass is that mass. Then it is RESAMPLED into a square of W px by priority -
// a chart's span says which tiles each of its pixels covers, and the pixel
// takes the highest class among them, so a one-tile wall never drops out of
// its run where the tiles fold into W px - and PAINTED one flat ink per
// class (CHART_INK) - A FLAT CHART in quiet greys: the open ground pale
// snow, the woods a deep slate, the lakes and the creek cold blue, the road
// a track through it. Nothing is painted over the inks: the marks and the
// team inks are the read.
// The class map is taken at most every MM_REBUILD ticks (a wall going up
// half a second late on a chart is invisible) and on the tick a fresh match
// resets the clock, ONCE for both maps; each chart (chartNew: the minimap's
// and the M map's, at their own sizes) re-inks only when it is newer.
const MM_REBUILD = 30; // sim ticks between class sweeps (half a second)
const chartCls = new Uint8Array(WORLD * WORLD);  // the class of every tile
const chartTmp = new Uint8Array(WORLD * WORLD);  // the flatten's scratch
let chartClsAt = -1e9; // tick of the last sweep; > tick means a fresh match reset the clock
let chartClsVer = 0;   // bumped by every sweep: a chart inked off an older one re-inks
// the square of tiles worth showing: every tile that is not woods (the
// lanes, the jungle's corridors, the huts' clearings) and CHART_PAD more,
// centred, so both maps spend their pixels on the played map, not the border wood
const CHART_PAD = 5;
let chartFitted = false; // the world grows once a page (boot), so the fit is taken once, the first time a chart is drawn
function chartFit() {
  if (chartFitted) return;
  chartFitted = true;
  let x0 = WORLD, y0 = WORLD, x1 = -1, y1 = -1;
  for (let i = 0; i < WORLD * WORLD; i++) {
    const o = structOf(objects[i]), c = o ? objChart(o) : null;
    if ((c == null ? chartGround(i) : c) === CH_FOREST) continue;
    const x = i % WORLD, y = (i / WORLD) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) { MAP_T0 = 0; MAP_N = WORLD; } else {
    MAP_N = Math.min(WORLD, Math.max(x1 - x0, y1 - y0) + 1 + CHART_PAD * 2);
    MAP_T0 = Math.max(0, Math.min(WORLD - MAP_N, Math.round((x0 + x1 + y0 + y1) / 4 - MAP_N / 2)));
  }
  relayout(); // the slab's size and the chart's origin follow the square
}
// one flat ink per class, indexed by CH_* (world.js) - the snow, the
// woods, the road, the ice, open water, then a side's buildings
// and its bird in the two depths of each team's ink, the cistern's stone
const CHART_INK = [
  [214, 219, 226], [44, 60, 62], [150, 136, 116], [124, 182, 222], [52, 74, 98],
  [168, 66, 58], [74, 114, 174], [224, 85, 72], [106, 168, 232],
  [104, 112, 128],
];
const CHART_NEED = []; // neighbours of its own class a tile needs to stay on the chart
CHART_NEED[CH_FOREST] = 2; CHART_NEED[CH_ICE] = 2;
const CHART_DARK = HUD_INK; // every mark's rim on either map, so a mark reads the same on both
function chartGround(i) { // a hole inks as open water
  const g = ground[i]; return g === 2 ? CH_HOLE : g === 3 ? CH_ROAD : g === 1 ? CH_ICE : CH_SNOW;
}
// the class map, flattened (above), at most every MM_REBUILD ticks
function chartClasses() {
  if (state.tick - chartClsAt < MM_REBUILD && state.tick >= chartClsAt) return;
  chartClsAt = state.tick; chartClsVer++;
  const N = WORLD, cls = chartCls, tmp = chartTmp;
  for (let i = 0; i < N * N; i++) {
    const o = structOf(objects[i]); // resolves a multi-tile building's 'part' fillers to the anchor
    const c = o ? objChart(o) : null;
    cls[i] = c == null ? chartGround(i) : c;
  }
  // flatten: a lone tile of a mass is ground again (the road under it stays a road)...
  tmp.set(cls);
  for (let ty = 1; ty < N - 1; ty++) for (let tx = 1; tx < N - 1; tx++) {
    const i = ty * N + tx, c = cls[i], need = CHART_NEED[c];
    if (!need) continue;
    const n = (cls[i - 1] === c) + (cls[i + 1] === c) + (cls[i - N] === c) + (cls[i + N] === c);
    if (n < need) tmp[i] = ground[i] === 3 ? CH_ROAD : CH_SNOW;
  }
  // ...and a snow pinhole with three sides of one mass is that mass
  cls.set(tmp);
  for (let ty = 1; ty < N - 1; ty++) for (let tx = 1; tx < N - 1; tx++) {
    const i = ty * N + tx;
    if (tmp[i] !== CH_SNOW) continue;
    const a = tmp[i - 1], b = tmp[i + 1], u = tmp[i - N], d = tmp[i + N];
    const three = (c) => CHART_NEED[c] && (a === c) + (b === c) + (u === c) + (d === c) >= 3;
    if (three(a)) cls[i] = a; else if (three(u)) cls[i] = u;
  }
}
// a chart: its picture W px a side of the MAP_T0/MAP_N square, the class of
// each of its pixels and the tiles each pixel row and column covers
function chartNew() {
  const cv = document.createElement('canvas');
  return { cv, g: cv.getContext('2d'), img: null, out: null, span: null, W: 0, key: '', inked: -1 };
}
// size a chart's buffers to W px (a no-op while W and the square stand);
// true when they were remade
function chartSize(ch, W) {
  chartFit();
  const key = W + ':' + MAP_T0 + ':' + MAP_N;
  if (ch.key === key) return false;
  ch.key = key; ch.W = W; ch.inked = -1;
  ch.cv.width = ch.cv.height = W;
  ch.img = ch.g.createImageData(W, W);
  ch.out = new Uint8Array(W * W);
  ch.span = [];
  const S = W / MAP_N;
  for (let p = 0; p < W; p++) ch.span.push([MAP_T0 + Math.floor(p / S), Math.min(MAP_T0 + MAP_N - 1, MAP_T0 + Math.floor((p + 1) / S - 1e-6))]);
  return true;
}
// resample the class map into the chart and paint it (only when the class
// map is newer than the chart's picture)
function chartInk(ch) {
  chartClasses();
  if (ch.inked === chartClsVer) return;
  ch.inked = chartClsVer;
  const W = ch.W, out = ch.out, cls = chartCls, N = WORLD;
  // resample: each chart pixel is the highest class of the tiles it covers
  for (let py = 0; py < W; py++) {
    const [ty0, ty1] = ch.span[py];
    for (let px = 0; px < W; px++) {
      const [tx0, tx1] = ch.span[px];
      let best = 0;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const c = cls[ty * N + tx]; if (c > best) best = c; }
      out[py * W + px] = best;
    }
  }
  // paint: one flat ink per class, nothing over it
  const dd = ch.img.data;
  for (let i = 0; i < W * W; i++) {
    const ink = CHART_INK[out[i]];
    const j = i * 4;
    dd[j] = ink[0]; dd[j + 1] = ink[1]; dd[j + 2] = ink[2]; dd[j + 3] = 255;
  }
  ch.g.putImageData(ch.img, 0, 0);
}
// A VIEW is where a chart lands on the screen: its square { x, y, w } and
// the projection every mark takes, screen = o + tile * s. chartView makes one
// for a chart w px a side with its top-left at (x, y).
function chartView(x, y, w) {
  const s = w / MAP_N;
  return { x, y, w, s, ox: x - MAP_T0 * s, oy: y - MAP_T0 * s };
}
function chartX(v, wx) { return v.ox + Math.round((wx / TILE) * v.s); }
function chartY(v, wy) { return v.oy + Math.round((wy / TILE) * v.s); }
// the ground of a chart in its view: the picture, the fog of war over it,
// the night over that, then the camera's frame and the landmarks (the road
// towers), every one under the camps and the bodies
function drawChartGround(ch, v, now, k) {
  chartInk(ch);
  ctx.drawImage(ch.cv, v.x, v.y);
  fogOverMap(ctx, now, MAP_T0, MAP_T0, MAP_N, MAP_N, v.x, v.y, v.w, v.w); // the fog of war (js/draw/fog.js)
  if (state.darkness > 0.01) {
    ctx.globalAlpha = state.darkness * 0.22;
    ctx.fillStyle = '#2c3c6e';
    ctx.fillRect(v.x, v.y, v.w, v.w);
    ctx.globalAlpha = 1;
  }
  // what the camera sees: a quiet frame, one pixel, inside the square
  // (filled rows and columns, never a stroked path, so it stays on the grid)
  const x0 = Math.max(v.x, v.ox + Math.round((camX / TILE) * v.s)), y0 = Math.max(v.y, v.oy + Math.round((camY / TILE) * v.s));
  const x1 = Math.min(v.x + v.w, v.ox + Math.round(((camX + WV_W) / TILE) * v.s)), y1 = Math.min(v.y + v.w, v.oy + Math.round(((camY + WV_H) / TILE) * v.s));
  if (x1 - x0 > 2 && y1 - y0 > 2) {
    ctx.fillStyle = 'rgba(244,247,255,0.7)';
    ctx.fillRect(x0, y0, x1 - x0, 1); ctx.fillRect(x0, y1 - 1, x1 - x0, 1);
    ctx.fillRect(x0, y0 + 1, 1, y1 - y0 - 2); ctx.fillRect(x1 - 1, y0 + 1, 1, y1 - y0 - 2);
  }
  drawMapStructs(ctx, (x, y) => [chartX(v, x), chartY(v, y)], CHART_DARK, k);
}
// the camps: the glyph in its camp's ink (a cleared one's gives way to its
// seconds, drawChartClocks). The camp under the pointer lights white and
// wears its name on a small graphite tag that runs away from the chart's
// middle (a name on every camp crowded the map and still read badly; the
// glyph says what a camp is, the hover says which).
const CHART_HOVER_R = 7; // px from a glyph the pointer still names it
function chartTagRect(lx, ly, L, right) {
  const w = pixelTextWidth(L.name) + 13, h = 11;
  return { x: right ? lx - w + 5 : lx - 5, y: ly - 5, w, h };
}
function chartTag(lx, ly, L, right) {
  const { x, y, w, h } = chartTagRect(lx, ly, L, right);
  ctx.fillStyle = HUD_INK; chamRect(x, y, w, h);
  ctx.fillStyle = AB_BG; chamRect(x + 1, y + 1, w - 2, h - 2);
  drawCampIcon(ctx, L, lx, ly, '#f4f7ff', HUD_INK);
  drawPixelText(ctx, L.name, right ? x + 3 : x + 10, y + 3, '#f4f7ff');
}
function campPt(v, L) {
  const m = campMark(L);
  return { lx: v.ox + Math.round((m.tx + 0.5) * v.s), ly: v.oy + Math.round((m.ty + 0.5) * v.s) };
}
function drawChartCamps(v) {
  let hov = null, hd = CHART_HOVER_R;
  const pts = camps.map((L) => {
    const { lx, ly } = campPt(v, L);
    const d = Math.hypot(mouse.x - lx, mouse.y - ly);
    if (mouse.inside && d < hd) { hd = d; hov = { L, lx, ly }; }
    return { L, lx, ly };
  });
  for (const { L, lx, ly } of pts) drawCampMark(ctx, L, lx, ly);
  if (hov) chartTag(hov.lx, hov.ly, hov.L, hov.lx > v.x + v.w / 2);
}
// the cleared camps' seconds, stamped over every body (drawCampMapClock)
function drawChartClocks(v) {
  for (const L of camps) { const { lx, ly } = campPt(v, L); drawCampMapClock(ctx, L, lx, ly); }
}
// every body on a chart wears the one grammar both maps share (drawMap*,
// js/draw/marks.js), in its side's ink: the robots first - every soldier and
// merchant standing - then the players, then the birds over all of them,
// since the objective is the read; then your side's calls and pings, and
// last the watched body - you, or whoever the camera rides - as the white
// heart in its side's ink under a pulse ring in the same ink
function drawChartBodies(v, now, k) {
  const vp = viewPlayer();
  for (const r of robots) {
    if (r.dead || !fogShown(r, now)) continue;
    drawMapUnit(ctx, chartX(v, r.x), chartY(v, r.y), TEAMS[skin(r.team)].mark, CHART_DARK, k, true, foeCue(r.team));
  }
  for (const p of players) {
    if (p === vp || !p.active || p.dead || !fogShown(p, now)) continue;
    drawMapUnit(ctx, chartX(v, p.x), chartY(v, p.y), TEAMS[skin(p.team)].mark, CHART_DARK, k, false, foeCue(p.team));
  }
  // the eagles: the two roosted objectives, and mid-flight each bird on its
  // own line, dashed across the chart
  if (state.drop) for (const e of state.drop.eagles) {
    if (e.state === 'fly' || e.state === 'dive') {
      ctx.save();
      ctx.strokeStyle = TEAMS[skin(e.team)].mark;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(v.ox + (e.x0 / TILE) * v.s, v.oy + (e.y0 / TILE) * v.s);
      ctx.lineTo(v.ox + (e.x1 / TILE) * v.s, v.oy + (e.y1 / TILE) * v.s);
      ctx.stroke();
      ctx.restore();
    } else if (e.state !== 'down') continue;
    drawMapBird(ctx, chartX(v, e.x), chartY(v, e.y), TEAMS[skin(e.team)].mark, CHART_DARK, k);
  }
  if (callouts.length) drawCalloutsMap(v, vp); // the bots' calls pulsing where they are about, and your side's pings (js/draw/callouts.js)
  const ink = TEAMS[skin(vp.team)].mark;
  const pmx = chartX(v, vp.x), pmy = chartY(v, vp.y);
  const ph = (now * 0.9) % 1;
  ctx.globalAlpha = (1 - ph) * 0.5;
  ctx.strokeStyle = ink;
  ctx.beginPath(); ctx.arc(pmx, pmy, 2 + ph * 6, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  drawMapYou(ctx, pmx, pmy, ink, CHART_DARK, k);
}
// a screen point over a view -> the world point under it (null off it): the
// inverse every press on a map needs (a ping, a walk ordered on it)
function chartWorldAt(v, sx, sy) {
  if (sx < v.x || sy < v.y || sx >= v.x + v.w || sy >= v.y + v.w) return null;
  const x = (sx - v.ox) / v.s * TILE, y = (sy - v.oy) / v.s * TILE;
  return inWorld(Math.floor(x / TILE), Math.floor(y / TILE)) ? { x, y } : null;
}

// ------------------------------------------------------------ minimap
// THE MINIMAP is the whole played map, always, as a square in the
// bottom-right corner - the League habit: one glance says where everyone is,
// and nothing scrolls or zooms under the eye. It is the M map's own chart
// (above) at MM_W px, on the HUD's graphite frame (drawHudFrame, strip.js):
// the outline, the faint edge, and the chart's own dark rim, flat and with
// no hover state. Along its top runs the DAY BAND: the day's elapsed part
// left to right in the day's gold, then the night's blue, on the edge's
// grey track, a white tip where the clock stands. The size is the MINIMAP
// SIZE dial (settings.mmSize, applyMinimapSize, core.js).
const mmChart = chartNew();
const mmFrameCv = document.createElement('canvas'); // the frame, baked per size
let mmFrameKey = '';
const MM_DAY = '#ffd95c', MM_NIGHT = '#7a90d8';
// the minimap's whole box on the screen, its frame included
function mmFrameRect() {
  return { x: MM_X - MM_PAD, y: MM_Y - MM_PAD_TOP, w: MM_W + MM_PAD * 2, h: MM_W + MM_PAD + MM_PAD_TOP };
}
function mmView() { return chartView(MM_X, MM_Y, MM_W); }
function mmFrame() {
  const r = mmFrameRect(), key = r.w + 'x' + r.h;
  if (mmFrameKey !== key) {
    mmFrameKey = key;
    mmFrameCv.width = r.w; mmFrameCv.height = r.h;
    const keep = ctx; ctx = mmFrameCv.getContext('2d'); // drawHudFrame paints on ctx
    try { drawHudFrame(0, 0, r.w, r.h, { corners: { tl: true, tr: true, bl: true, br: true } }); } finally { ctx = keep; }
    const g = mmFrameCv.getContext('2d');
    g.fillStyle = HUD_EDGE; g.fillRect(MM_PAD - 1, 1, MM_W + 2, 3); // the day band's track
    g.fillStyle = CHART_DARK; g.fillRect(MM_PAD - 1, MM_PAD_TOP - 1, MM_W + 2, MM_W + 2); // the chart's rim
  }
  return mmFrameCv;
}
// the world point under a screen point on the minimap (null off it): for
// the CLICK scheme's walk across the map (ckPoint, input.js) and a ping
function mmWorldAt(sx, sy) { return chartWorldAt(mmView(), sx, sy); }
function renderMinimap(now) {
  chartSize(mmChart, MM_W);
  const r = mmFrameRect(), v = mmView();
  ctx.drawImage(mmFrame(), r.x, r.y);
  // the day band: elapsed day in gold, then night in blue, and the tip
  const prog = state.time / CYCLE, dayFrac = DAY_LEN / CYCLE;
  const bx = MM_X - 1, bw = MM_W + 2, by = r.y + 1;
  const dayW = Math.round(Math.min(prog, dayFrac) * bw), nowW = Math.round(prog * bw), duskX = Math.round(dayFrac * bw);
  ctx.fillStyle = MM_DAY; ctx.fillRect(bx, by, dayW, 3);
  if (nowW > duskX) { ctx.fillStyle = MM_NIGHT; ctx.fillRect(bx + duskX, by, nowW - duskX, 3); }
  ctx.fillStyle = '#8a8e96'; ctx.fillRect(bx + duskX, by, 1, 3); // dusk
  ctx.fillStyle = state.darkness > 0.5 ? '#cfd8f2' : '#fff2b0';
  ctx.fillRect(bx + Math.max(0, Math.min(bw - 1, nowW - 1)), by, 1, 3);
  // the chart and every mark on it, clipped to the square so a mark at the
  // map's edge stops at the rim (a whole-pixel rect: the clip never blurs)
  ctx.save();
  ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.w); ctx.clip();
  drawChartGround(mmChart, v, now, 1);
  drawChartCamps(v);
  drawChartBodies(v, now, 1);
  drawChartClocks(v);
  ctx.restore();
  // over the square, the elapsed play-time alone, on its right edge - but
  // only with no team rail up: a match's clock sits between the two kill
  // totals there (drawRailScore, rail.js), and one clock is enough
  if (!mmClockShown()) return;
  const clock = clockTxt(state.elapsed);
  drawPixelTextOutline(ctx, clock, r.x + r.w - pixelTextWidth(clock) - 1, r.y - 8, '#f4f7ff', HUD_INK);
}
// whether the clock stands over the square: only where the rail is not up
function mmClockShown() { return !railLayout(); }

// The terrain as one pixel a tile (mmCv, canvas.js): not the minimap's
// picture any more, but the bot log's map (botLogExport, js/ui/botview.js)
// and the arena's (app/arena/match.js) - taken when they ask for it.
let mmBuiltAt = -1e9;  // tick of the last sweep; > tick means a fresh match reset the clock
function updateMinimap() {
  if (state.tick - mmBuiltAt < MM_REBUILD && state.tick >= mmBuiltAt) return;
  mmBuiltAt = state.tick;
  const d = mmImg.data;
  for (let i = 0; i < WORLD * WORLD; i++) {
    let r, g, b;
    const o = structOf(objects[i]); // resolves a multi-tile building's 'part' fillers to the anchor
    if (o) {
      const c = objMapColor(o) || MM_UNKNOWN;
      r = c[0]; g = c[1]; b = c[2];
    } else if (ground[i] === 2) { r = 58; g = 92; b = 128; } // open water: a hole
    else if (ground[i] === 1) { r = 124; g = 182; b = 222; } // ice
    else if (ground[i] === 3) { r = 188; g = 168; b = 138; } // the road
    else { r = 205; g = 216; b = 232; } // snow
    const j = i * 4;
    d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255;
  }
  mmCtx.putImageData(mmImg, 0, 0);
}
