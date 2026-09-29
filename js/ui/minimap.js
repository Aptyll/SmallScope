'use strict';
// The minimap: a square of the whole valley on a HUD plate in the bottom
// right corner, League's minimap in Softfall's pixels, and renderMinimap.
// The map marks it stamps come from js/draw/marks.js.
// ------------------------------------------------------------ minimap
// The per-tile terrain picture a save slot wears (saveThumb, js/ui/saves.js):
// a full WORLD x WORLD sweep with a structOf() call per tile - far too much to
// pay every frame for a picture that only changes when something is built or
// the ground is cut. It rebuilds at most twice a second, and MM_REBUILD
// throttles the minimap's own picture (and the chart's) the same way.
const MM_REBUILD = 30; // sim ticks between terrain sweeps (half a second)
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
    } else if (ground[i] === 2 || ground[i] === 4) { r = 58; g = 92; b = 128; } // open water: a hole, the creek (a ford reads as a gap in it)
    else if (ground[i] === 1) { r = 145; g = 188; b = 212; } // ice
    else if (ground[i] === 3) { r = 188; g = 168; b = 138; } // the road
    else { r = 205; g = 216; b = 232; } // snow
    const j = i * 4;
    d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255;
  }
  mmCtx.putImageData(mmImg, 0, 0);
}

// Where the plate stands. It is a HUD corner piece like the strip: flush to
// the bottom edge and to its side's edge (settings.mmCorner, 'right' by
// default), the one corner toward the screen's middle cut. The map inside is
// settings.mmSide px square - the whole valley, so a pixel is a few tiles -
// and a 2 px day/night band runs along its top. When the hud strip is drawn
// wide enough to reach under it (a big HUD SIZE on a narrow view) the plate
// stands on the strip's shoulder instead of under it. Live every call: the
// HUD SIZE dial moves the strip without a relayout.
const MM_IN = 3;      // the plate's outline, edge line and 1 px of ground before the map
const MM_BAND = 3;    // the day/night band (2 px) and the ground under it
const MM_SIDES = [80, 88, 96, 104, 112, 120, 128, 136, 144, 152, 160]; // the MINIMAP SIZE dial's notches
function mmSide() { const v = settings.mmSide | 0; return MM_SIDES.includes(v) ? v : 112; }
function mmRect() {
  const S = mmSide(), w = S + MM_IN * 2, h = S + MM_IN * 2 + MM_BAND;
  const left = settings.mmCorner === 'left';
  const x = left ? 0 : VIEW_W - w;
  let y = VIEW_H - h;
  const R = hudStripRect(), hs = hudSc();
  const half = (R.w / 2 + 3) * hs; // the strip's half-width, its outline included
  const lift = left ? x + w > VIEW_W / 2 - half - MM_GAP : x < VIEW_W / 2 + half + MM_GAP;
  if (lift) y = Math.round(VIEW_H - (R.h + HUD_BAKE_HEAD) * hs) - MM_GAP - h;
  return { x, y, w, h, left, lift, S, mx: x + MM_IN, my: y + MM_IN + MM_BAND };
}
// pointer over the plate
function overMinimap() {
  const R = mmRect();
  return mouse.inside && mouse.x >= R.x && mouse.x < R.x + R.w && mouse.y >= R.y && mouse.y < R.y + R.h;
}
// the world point under a screen point on the map (null off it): the inverse
// of the projection renderMinimap draws with, for the CLICK scheme's
// walk-across-the-map (ckPoint, input.js)
function mmWorldAt(sx, sy) {
  const R = mmRect();
  const px = sx - R.mx, py = sy - R.my;
  if (px < 0 || py < 0 || px >= R.S || py >= R.S) return null;
  const k = WORLD * TILE / R.S;
  return { x: (px + 0.5) * k, y: (py + 0.5) * k };
}

// The map's picture is the chart's (chartClasses/inkChart, js/ui/panels.js)
// at the plate's size: the same classes, the same inks, the same flatten, so
// the minimap and the M chart are one map at two sizes. Each pixel is the
// highest class of the tiles under it, so a road, a building or a bird is
// never averaged away however small the plate is.
const mmSq = { cv: document.createElement('canvas'), img: null, out: null, span: null, W: 0, at: -1e9 };
function mmSquare(S) {
  const q = mmSq;
  if (q.W !== S) {
    q.W = S; q.cv.width = q.cv.height = S;
    const g = q.cv.getContext('2d');
    q.img = g.createImageData(S, S); q.out = new Uint8Array(S * S); q.span = chartSpans(S);
    q.at = -1e9;
  }
  if (state.tick - q.at >= MM_REBUILD || state.tick < q.at) {
    q.at = state.tick;
    chartClasses();
    inkChart(S, q.span, q.out, q.img, q.cv.getContext('2d'));
  }
  return q.cv;
}

function renderMinimap(now) {
  const R = mmRect(), S = R.S, s = S / WORLD; // px per tile
  const vp = viewPlayer();
  // the corner toward the middle is cut; both are when it stands lifted off the bottom
  drawHudFrame(R.x, R.y, R.w, R.h, { corners: R.left ? { tr: true, br: R.lift } : { tl: true, bl: R.lift } });

  // the day/night band along the top: the elapsed part of the cycle from the
  // left in the day's gold, then the night's blue, a tick where dusk falls
  // and a bright pixel at now
  const prog = state.time / CYCLE, dayFrac = DAY_LEN / CYCLE, by = R.y + MM_IN;
  ctx.fillStyle = '#2a3358'; ctx.fillRect(R.mx, by, S, 2);
  ctx.fillStyle = '#ffd95c'; ctx.fillRect(R.mx, by, Math.round(Math.min(prog, dayFrac) * S), 2);
  if (prog > dayFrac) { ctx.fillStyle = '#7a90d8'; ctx.fillRect(R.mx + Math.round(dayFrac * S), by, Math.round((prog - dayFrac) * S), 2); }
  ctx.fillStyle = '#8f9cc4'; ctx.fillRect(R.mx + Math.round(dayFrac * S), by, 1, 2);
  ctx.fillStyle = state.darkness > 0.5 ? '#cfd8f2' : '#fff2b0';
  ctx.fillRect(R.mx + Math.min(S - 1, Math.round(prog * S)), by, 1, 2);

  // the valley, and night falling over it as it does over the chart
  ctx.drawImage(mmSquare(S), R.mx, R.my);
  if (state.darkness > 0.01) {
    ctx.globalAlpha = state.darkness * 0.22;
    ctx.fillStyle = '#2c3c6e';
    ctx.fillRect(R.mx, R.my, S, S);
    ctx.globalAlpha = 1;
  }

  // everything over it stays inside the square (a rect clip on whole
  // pixels is exact, unlike the disc's old arc)
  ctx.save();
  ctx.beginPath(); ctx.rect(R.mx, R.my, S, S); ctx.clip();
  const mx = (x) => R.mx + Math.floor(x / TILE * s), my = (y) => R.my + Math.floor(y / TILE * s);

  // the camera's view, League's white box: what is on screen now
  const vx = mx(camX), vy = my(camY);
  ctx.strokeStyle = 'rgba(244,247,255,0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(vx + 0.5, vy + 0.5, Math.max(2, Math.round(WV_W / TILE * s)) - 1, Math.max(2, Math.round(WV_H / TILE * s)) - 1);

  // the ziplines, each a thread in its side's ink along the road's verge
  // (the chart strokes the same lines): where the fast way out runs
  for (const z of zips) {
    if (!z) continue;
    ctx.strokeStyle = TEAMS[skin(z.team)].mark;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    z.pts.forEach((pt, i) => ctx[i ? 'lineTo' : 'moveTo'](R.mx + pt.x / TILE * s, R.my + pt.y / TILE * s));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // the camps, glyph only and in the chart's own quiet ink - a name would not
  // fit (the chart and the arrival toast are where they are read by name)
  for (const L of camps) drawCampIcon(ctx, L, R.mx + Math.floor((L.tx + 0.5) * s), R.my + Math.floor((L.ty + 0.5) * s), '#2c3448', 'rgba(240,244,250,0.9)');
  // every body in the grammar both maps share (drawMap*, js/draw/marks.js),
  // in its side's ink: the robots first - every worker, soldier and merchant
  // standing, none of them hides - then the players. A rival buried past
  // PRONE_MAP drops off it entirely - a dot that survived the cover would
  // make the whole thing pointless. Your own side never does.
  for (const r of robots) {
    if (r.dead) continue;
    drawMapUnit(ctx, mx(r.x), my(r.y), TEAMS[skin(r.team)].mark, CHART_DARK, 1, true, foeCue(r.team));
  }
  for (const p of players) {
    if (p === vp || !p.active || p.dead || inAir(p)) continue;
    if (p.team !== vp.team && p.markT <= 0 && concealOf(p) >= PRONE_MAP) continue; // a falcon-marked rival stays on it
    drawMapUnit(ctx, mx(p.x), my(p.y), TEAMS[skin(p.team)].mark, CHART_DARK, 1, false, foeCue(p.team));
  }
  // flags on your side, as the same pennant and ring the chart draws: where
  // the side was sent is exactly the kind of thing you check without opening
  // the chart
  for (const q of players) {
    if (!q.active || q.team !== vp.team || !q.flag) continue;
    drawFlagMark(ctx, R.mx + Math.floor((q.flag.tx + 0.5) * s), R.my + Math.floor((q.flag.ty + 0.5) * s) + 3, q.flag, TEAMS[skin(q.team)].mark, undefined, s);
  }
  // the downed eagles: both objectives, always on the map - keeping yours
  // alive (and finding theirs) is the match
  if (state.drop) for (const e of state.drop.eagles) {
    if (e.state === 'down') drawMapBird(ctx, mx(e.x), my(e.y), TEAMS[skin(e.team)].mark, CHART_DARK);
  }
  // the watched body - you, or a player you are watching - as the white
  // heart in its side's ink, the mark the chart gives it too, over the rest
  drawMapYou(ctx, mx(vp.x), my(vp.y), TEAMS[skin(vp.team)].mark, CHART_DARK, 1);
  ctx.restore();

  // over the plate, the elapsed play-time alone, centred on it - but only
  // with no team rail up: a match's clock sits between the two kill totals
  // there (drawRailScore, rail.js), and one clock is enough
  if (!mmClockShown()) return;
  const clock = clockTxt(state.elapsed);
  drawPixelTextOutline(ctx, clock, Math.round(R.x + (R.w - pixelTextWidth(clock)) / 2), R.y - 9, '#f4f7ff', '#0f1632');
}
// whether the clock hangs over the plate: only where the rail is not up
function mmClockShown() { return !railLayout(); }
