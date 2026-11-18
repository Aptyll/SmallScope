'use strict';
// Both maps' chart - the class map, its flatten, its resample into a square
// of any size and the marks over it - and the minimap, the round disc round
// you in a bottom corner. The M map's slab is js/ui/panels.js;
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
  // the ziplines under everything that moves: each side's cable pylon to
  // pylon in its ink, clipped to the square
  const inV = (x, y) => x >= v.x && y >= v.y && x < v.x + v.w && y < v.y + v.w;
  for (const z of zips) if (z) drawMapZip(ctx, z, (x) => chartX(v, x), (y) => chartY(v, y), TEAMS[skin(z.team)].mark, inV);
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
// later = the caller lays the hovered camp's tag itself (the disc, over its
// rim): it gets { L, lx, ly } back, or null
function drawChartCamps(v, later) {
  let hov = null, hd = CHART_HOVER_R;
  const pts = camps.map((L) => {
    const { lx, ly } = campPt(v, L);
    const d = Math.hypot(mouse.x - lx, mouse.y - ly);
    if (mouse.inside && d < hd) { hd = d; hov = { L, lx, ly }; }
    return { L, lx, ly };
  });
  for (const { L, lx, ly } of pts) drawCampMark(ctx, L, lx, ly);
  if (later) return hov;
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
// THE MINIMAP is a round disc of the map round the watched body (you, or
// whoever the camera rides), in a bottom corner (MM_CX/MM_CY, MM_R,
// applyMinimapSize, core.js). It is the M map's own chart (above) at the
// disc's zoom (mmScale: the wheel over the disc steps it), with the same
// layers and marks, clipped to a pixel disc. Round it runs the DAY RING: the
// day's elapsed part clockwise from 12 o'clock in the day's gold, then the
// night's blue, on the edge's grey track, a grey dusk tick and a bright tip
// where the clock stands; then a two-pixel outline and no hover state. The
// size is the MINIMAP SIZE dial (settings.mmSize).
const mmChart = chartNew();
const MM_DAY = '#ffd95c', MM_NIGHT = '#7a90d8';
// Every curve here is laid a pixel at a time: canvas arc() anti-aliases, and
// at game resolution a 1 px rim smeared over two pixels reads as blur.
// mmRing paints every pixel whose centre lies in [r0, r1) from the centre,
// optionally only between angles a0..a1 (clockwise from a0, canvas terms).
function mmRing(g, cx, cy, r0, r1, col, a0, a1) {
  const span = a1 === undefined ? 7 : ((a1 - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const R = Math.ceil(r1);
  g.fillStyle = col;
  for (let py = -R; py <= R; py++) for (let px = -R; px <= R; px++) {
    const dx = px + 0.5, dy = py + 0.5, d = Math.hypot(dx, dy);
    if (d < r0 || d >= r1) continue;
    if (a1 !== undefined) {
      const a = ((Math.atan2(dy, dx) - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (a > span) continue;
    }
    g.fillRect(cx + px, cy + py, 1, 1);
  }
}
// the disc's clip: the same pixel disc as one whole-pixel rect a row, about
// (0, 0) - a clip made of whole-pixel rects never blurs (cached per radius)
const mmClips = new Map();
function mmClip(r) {
  let c = mmClips.get(r);
  if (!c) {
    c = new Path2D();
    for (let py = -r; py < r; py++) {
      let w = 0;
      for (let px = 0; px < r; px++) if (Math.hypot(px + 0.5, py + 0.5) < r) w = px + 1;
      if (w) c.rect(-w, py, w * 2, 1);
    }
    mmClips.set(r, c);
  }
  return c;
}
// The chrome (the outline, the silhouette, the ring's track) never changes,
// and the arcs only as fast as the clock, so both are baked: per radius, and
// per (radius, step of MM_ARC_STEPS) - a per-pixel ring every frame was a
// third of the whole frame once.
const mmChromes = new Map();
function mmChrome() {
  let c = mmChromes.get(MM_R);
  if (!c) {
    const R = MM_R + MM_OUT, S = R * 2 + 2;
    c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), cc = R + 1;
    mmRing(g, cc, cc, MM_R + 5, MM_R + 7, HUD_INK);  // the outline, two crisp pixels
    mmRing(g, cc, cc, 0, MM_R + 5, AB_BG);          // the silhouette, under the map
    mmRing(g, cc, cc, MM_R + 2, MM_R + 5, HUD_EDGE); // the day ring's track
    mmChromes.set(MM_R, c);
  }
  return c;
}
const MM_ARC_STEPS = 512; // the ring's grain: about a pixel of arc a step
const mmArc = { key: '', cv: document.createElement('canvas') };
function mmArcBand(prog) {
  const q = Math.min(MM_ARC_STEPS, Math.floor(prog * MM_ARC_STEPS));
  const key = MM_R + ':' + q;
  if (mmArc.key !== key) {
    mmArc.key = key;
    const R = MM_R + 6, S = R * 2 + 2;
    if (mmArc.cv.width !== S) mmArc.cv.width = mmArc.cv.height = S;
    const g = mmArc.cv.getContext('2d'), cc = R + 1;
    g.clearRect(0, 0, S, S);
    const p = q / MM_ARC_STEPS, dayFrac = DAY_LEN / CYCLE, a0 = -Math.PI / 2;
    const r0 = MM_R + 2, r1 = MM_R + 5;
    if (p > 0) mmRing(g, cc, cc, r0, r1, MM_DAY, a0, a0 + Math.min(p, dayFrac) * Math.PI * 2);
    if (p > dayFrac) mmRing(g, cc, cc, r0, r1, MM_NIGHT, a0 + dayFrac * Math.PI * 2, a0 + p * Math.PI * 2);
    const ba = a0 + dayFrac * Math.PI * 2; // the dusk tick, a little past the band, short of the outline
    mmRing(g, cc, cc, r0 - 1, r1, '#8a8e96', ba - 0.03, ba + 0.03);
  }
  return mmArc.cv;
}
// the disc's whole box on the screen, its ring and outline included
function mmFrameRect() {
  const e = MM_R + MM_OUT;
  return { x: MM_CX - e, y: MM_CY - e, w: e * 2, h: e * 2 };
}
// the chart's view for the disc: the chart at the disc's zoom, laid so the
// watched body stands on the disc's centre
function mmView() {
  const vp = viewPlayer(), W = Math.max(1, Math.round(MAP_N * mmScale())), s = W / MAP_N;
  return chartView(MM_CX - Math.round((vp.x / TILE - MAP_T0) * s), MM_CY - Math.round((vp.y / TILE - MAP_T0) * s), W);
}
function inDisc(sx, sy) { return Math.hypot(sx + 0.5 - MM_CX, sy + 0.5 - MM_CY) < MM_R; }
// the world point under a screen point on the disc (null off it): for the
// CLICK scheme's walk across the map (ckPoint, input.js) and a ping
function mmWorldAt(sx, sy) { return inDisc(sx, sy) ? chartWorldAt(mmView(), sx, sy) : null; }
function renderMinimap(now) {
  const v = mmView();
  chartSize(mmChart, v.w);
  ctx.drawImage(mmChrome(), MM_CX - MM_R - MM_OUT - 1, MM_CY - MM_R - MM_OUT - 1);
  // the chart and every mark on it, clipped to the pixel disc; a hovered
  // camp's name tag goes on after, over the ring, so the rim never cuts it
  ctx.save();
  ctx.translate(MM_CX, MM_CY); ctx.clip(mmClip(MM_R)); ctx.translate(-MM_CX, -MM_CY);
  // past the chart's square (a wide zoom, or near the map's edge) the woods
  // run on in their own ink, so the square's edge never shows
  ctx.fillStyle = 'rgb(' + CHART_INK[CH_FOREST].join(',') + ')';
  ctx.fillRect(MM_CX - MM_R, MM_CY - MM_R, MM_R * 2, MM_R * 2);
  drawChartGround(mmChart, v, now, 1);
  const hov = drawChartCamps(v, true);
  drawChartBodies(v, now, 1);
  drawChartClocks(v);
  ctx.restore();
  if (hov && inDisc(hov.lx, hov.ly)) chartTag(hov.lx, hov.ly, hov.L, hov.lx > MM_CX);
  // the day ring (the track is in the chrome; the arcs come baked) and its
  // tip: a 3x3 block that breathes at night
  const prog = state.time / CYCLE, ta = -Math.PI / 2 + prog * Math.PI * 2;
  ctx.drawImage(mmArcBand(prog), MM_CX - MM_R - 7, MM_CY - MM_R - 7);
  ctx.fillStyle = state.darkness > 0.5 ? '#cfd8f2' : '#fff2b0';
  ctx.globalAlpha = state.darkness > 0.5 ? Math.sin(now * 6) * 0.15 + 0.85 : 1;
  ctx.fillRect(Math.round(MM_CX + Math.cos(ta) * (MM_R + 3)) - 1, Math.round(MM_CY + Math.sin(ta) * (MM_R + 3)) - 1, 3, 3);
  ctx.globalAlpha = 1;
  // over the disc, the elapsed play-time alone, centred on its axis - but
  // only with no team rail up: a match's clock sits between the two kill
  // totals there (drawRailScore, rail.js), and one clock is enough
  if (!mmClockShown()) return;
  const clock = clockTxt(state.elapsed);
  drawPixelTextOutline(ctx, clock, Math.round(MM_CX - pixelTextWidth(clock) / 2), MM_CY - MM_R - MM_OUT - 9, '#f4f7ff', HUD_INK);
}
// the world point a press on the disc points the camera at: the pointer
// pulled onto the disc, so a drag that runs off its edge keeps the edge
function mmCamAt(sx, sy) {
  const dx = sx + 0.5 - MM_CX, dy = sy + 0.5 - MM_CY, d = Math.hypot(dx, dy), k = d > MM_R - 1 ? (MM_R - 1) / d : 1;
  return chartWorldAt(mmView(), Math.floor(MM_CX + dx * k), Math.floor(MM_CY + dy * k));
}
// whether the clock stands over the disc: only where the rail is not up
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
