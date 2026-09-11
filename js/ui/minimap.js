'use strict';
// The minimap: the rebuilt ground disc, its masks, chrome and view arc,
// and renderMinimap. The map marks it stamps come from js/draw/marks.js.
// ------------------------------------------------------------ minimap
// The terrain image is a full WORLD x WORLD sweep with a structOf() call per
// tile - far too much to pay every frame for a picture that only changes when
// something is built or the ground is cut. It rebuilds at most twice a
// second; at one map pixel per tile nothing can be seen arriving late.
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
    } else if (ground[i] === 2) { r = 58; g = 92; b = 128; } // open water hole
    else if (ground[i] === 1) { r = 145; g = 188; b = 212; } // ice
    else if (ground[i] === 3) { r = 188; g = 168; b = 138; } // the road
    else { r = 205; g = 216; b = 232; } // snow
    const j = i * 4;
    d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255;
  }
  mmCtx.putImageData(mmImg, 0, 0);
}

// Every curve of the minimap is rasterised a pixel at a time: canvas arc()
// anti-aliases, and at game resolution a 1 px rim smeared over two pixels
// reads as blur. mmRing paints every pixel whose centre lies in [r0, r1)
// from the disc centre, optionally only between angles a0..a1 (clockwise
// from a0, in canvas terms), and mmMask(r) is a cached pixel disc used to
// clip the map view with destination-in instead of an anti-aliased clip().
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
const mmMasks = new Map();
function mmMask(r) {
  let m = mmMasks.get(r);
  if (!m) {
    m = document.createElement('canvas'); m.width = m.height = r * 2;
    mmRing(m.getContext('2d'), r, r, 0, r, '#000');
    mmMasks.set(r, m);
  }
  return m;
}
const mmView = document.createElement('canvas'); // the clipped map view, rebuilt each frame
const mmViewCtx = mmView.getContext('2d');

// The disc's chrome - the opaque silhouette, its rim, the day ring's track
// and the dusk tick - and the day/night arcs are all mmRing, and mmRing is a
// per-pixel hypot/atan2 loop issuing a fillRect per lit pixel. Run every
// frame that was ~1.6 ms - a third of the whole frame, the largest single
// cost in the game - for pixels that never change. So the chrome is baked
// per radius and the arc band per (radius, progress step): the arcs
// only move as fast as the clock, so quantising the cycle to MM_ARC_STEPS
// repaints the band every couple of real seconds instead of every frame.
const mmChromes = new Map();
function mmChrome() {
  const key = MM_R;
  let c = mmChromes.get(key);
  if (!c) {
    const R = MM_R + 7, S = R * 2 + 2;
    c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), cc = R + 1;
    // a strong black outline, two crisp pixels, and NO hover state - the
    // disc is the same shape whatever the pointer is doing; no halo, no
    // second ring outside it
    mmRing(g, cc, cc, MM_R + 5, MM_R + 7, '#000000');                   // outline
    mmRing(g, cc, cc, 0, MM_R + 5, '#0f1632');                          // silhouette disc
    mmRing(g, cc, cc, MM_R + 2, MM_R + 5, '#2a3358');                   // day ring track
    mmChromes.set(key, c);
  }
  return c;
}
const MM_ARC_STEPS = 512; // day-ring granularity: ~a pixel of arc per step
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
    if (p > 0) mmRing(g, cc, cc, r0, r1, '#ffd95c', a0, a0 + Math.min(p, dayFrac) * Math.PI * 2);
    if (p > dayFrac) mmRing(g, cc, cc, r0, r1, '#7a90d8', a0 + dayFrac * Math.PI * 2, a0 + p * Math.PI * 2);
    // dusk boundary tick: one pixel column across the band, a little past it,
    // over the arcs exactly as the per-frame draw laid it
    const ba = a0 + dayFrac * Math.PI * 2;
    mmRing(g, cc, cc, r0 - 1, r1, '#8f9cc4', ba - 0.03, ba + 0.03); // stops short of the outline
  }
  return mmArc.cv;
}

// the world point under a screen point on the disc (null off it): the
// inverse of the projection renderMinimap draws with, for the CLICK scheme's
// walk-across-the-map (ckPoint, input.js)
function mmWorldAt(sx, sy) {
  const vp = viewPlayer(), s = mmScale();
  const dx = sx - MM_CX, dy = sy - MM_CY;
  if (Math.hypot(dx, dy) > MM_R) return null;
  return { x: (vp.x / TILE + dx / s) * TILE, y: (vp.y / TILE + dy / s) * TILE };
}
function renderMinimap(now) {
  updateMinimap();
  const vp = viewPlayer();
  const ptx = vp.x / TILE, pty = vp.y / TILE;
  const s = mmScale(); // px per tile: the wheel over the disc changes it

  // silhouette: an opaque dark disc under everything, in a black outline so
  // the whole control reads as one solid shape on the snow (baked, above)
  ctx.drawImage(mmChrome(), MM_CX - MM_R - 8, MM_CY - MM_R - 8);

  // pixel-clipped map view centered on the player
  const half = MM_R / s; // tiles from the centre to the edge
  if (mmView.width !== MM_R * 2) { mmView.width = mmView.height = MM_R * 2; }
  mmViewCtx.imageSmoothingEnabled = false;
  mmViewCtx.globalCompositeOperation = 'source-over';
  mmViewCtx.clearRect(0, 0, MM_R * 2, MM_R * 2);
  mmViewCtx.drawImage(mmCv, ptx - half, pty - half, half * 2, half * 2, 0, 0, MM_R * 2, MM_R * 2);
  mmViewCtx.globalCompositeOperation = 'destination-in';
  mmViewCtx.drawImage(mmMask(MM_R), 0, 0);
  ctx.drawImage(mmView, MM_CX - MM_R, MM_CY - MM_R);
  // every body inside the view in the grammar both maps share (drawMap*,
  // draw-world.js), in its side's ink: the robots first - every worker,
  // soldier and merchant standing, none of them hides - then the players. A
  // rival buried past PRONE_MAP drops off it entirely - a dot that survived
  // the cover would make the whole thing pointless. Your own side never does.
  for (const r of robots) {
    if (r.dead) continue;
    const dx = (r.x / TILE - ptx) * s, dy = (r.y / TILE - pty) * s;
    if (Math.hypot(dx, dy) > MM_R - 1) continue;
    drawMapUnit(ctx, MM_CX + dx, MM_CY + dy, TEAMS[skin(r.team)].mark, '#0f1632', 1, true);
  }
  for (const p of players) {
    if (p === vp || !p.active || p.dead || inAir(p)) continue;
    if (p.team !== vp.team && p.markT <= 0 && concealOf(p) >= PRONE_MAP) continue; // a falcon-marked rival stays on it
    const dx = (p.x / TILE - ptx) * s, dy = (p.y / TILE - pty) * s;
    if (Math.hypot(dx, dy) > MM_R - 1) continue;
    drawMapUnit(ctx, MM_CX + dx, MM_CY + dy, TEAMS[skin(p.team)].mark, '#0f1632', 1, false);
  }
  // flags on your side, as the same pennant and ring the chart draws: where
  // the side was sent is exactly the kind of thing you check without opening
  // a map (the disc clips the ring, so a flag off its edge shows as its rim)
  for (const q of players) {
    if (!q.active || q.team !== vp.team || !q.flag) continue;
    const dx = (q.flag.tx + 0.5 - ptx) * s, dy = (q.flag.ty + 0.5 - pty) * s;
    if (Math.hypot(dx, dy) > MM_R - 2 + FLAG_R / TILE * s) continue;
    ctx.save();
    ctx.beginPath(); ctx.arc(MM_CX, MM_CY, MM_R - 1, 0, Math.PI * 2); ctx.clip();
    drawFlagMark(ctx, MM_CX + dx, MM_CY + dy + 3, q.flag, TEAMS[skin(q.team)].mark, undefined, s);
    ctx.restore();
  }
  // the downed eagles: both objectives, always on the disc - keeping yours
  // alive (and finding theirs) is the match
  if (state.drop) for (const e of state.drop.eagles) {
    if (e.state !== 'down') continue;
    const dx = (e.x / TILE - ptx) * s, dy = (e.y / TILE - pty) * s;
    if (Math.hypot(dx, dy) > MM_R - 2) continue;
    drawMapBird(ctx, MM_CX + dx, MM_CY + dy, TEAMS[skin(e.team)].mark, '#0f1632');
  }
  // the camps, glyph only - a name would not fit inside the disc (the
  // world map and the arrival toast are where they are read by name)
  for (const L of camps) {
    const dx = (L.tx + 0.5 - ptx) * s, dy = (L.ty + 0.5 - pty) * s;
    if (Math.hypot(dx, dy) > MM_R - 2) continue;
    drawCampIcon(ctx, L, MM_CX + dx, MM_CY + dy, L.spec.mark, '#0f1632');
  }
  // the centre: the watched body - you, or a player you are watching - as
  // the white heart in its side's ink, the mark the chart gives it too
  drawMapYou(ctx, MM_CX, MM_CY, TEAMS[skin(vp.team)].mark, '#0f1632', 1);

  // day/night cycle ring: a 3 px band of pixels, the elapsed part painted
  // clockwise from 12 o'clock in the day colour, then the night colour
  // (the track is in the baked chrome; the arcs come from the cached band)
  const prog = state.time / CYCLE;
  const a0 = -Math.PI / 2; // start at 12 o'clock
  const r0 = MM_R + 2;
  ctx.drawImage(mmArcBand(prog), MM_CX - MM_R - 7, MM_CY - MM_R - 7);
  // progress tip: a 3x3 pixel block on the band
  const ta = a0 + prog * Math.PI * 2;
  const pulse = state.darkness > 0.5 ? (Math.sin(now * 6) * 0.15 + 0.85) : 1;
  ctx.fillStyle = state.darkness > 0.5 ? '#cfd8f2' : '#fff2b0';
  ctx.globalAlpha = pulse;
  ctx.fillRect(Math.round(MM_CX + Math.cos(ta) * (r0 + 1)) - 1, Math.round(MM_CY + Math.sin(ta) * (r0 + 1)) - 1, 3, 3);
  ctx.globalAlpha = 1;

  // beneath the minimap, the elapsed play-time alone, centred on the disc's
  // axis so the two read as one column. (The alive count that used to share the row
  // went in 3.23: a match no longer ends on bodies, so it was a number that
  // decided nothing.)
  const clock = clockTxt(state.elapsed);
  drawPixelTextOutline(ctx, clock, Math.round(MM_CX - pixelTextWidth(clock) / 2), MM_CY + MM_R + 9, '#f4f7ff', '#0f1632');
}
