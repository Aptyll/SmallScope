'use strict';
// The fog of war on the screen and both maps: the viewed side's sight
// (js/sim/fog.js says what is seen) lit, the rest dimmed, never black. Terrain
// and buildings stay; a rival body or a creature out of sight is not drawn
// (fogShown, asked by every place that draws a body or its map dot).
// ------------------------------------------------------------ fog of war (draw)
// How: once a frame (fogView, on first need) each of the side's eyes is
// traced as a fan of sight lines; an eye with no stone in reach needs none.
// The edge's distance is taken on world-locked FOG_CELL px corners, and a mask
// at FOG_STEP px per mask px is filled - whole cells in one run, the cells the
// edge crosses px by px - then laid over the world with ONE multiply, under
// the night (renderLighting calls drawFog first). The cells sit on the world's
// grid, so the stepped rim holds still while the camera slides.
const FOG_TINT = [158, 160, 168]; // the multiply: a flat grey dim, cooler than nothing and far lighter than the night
const FOG_CELL = 4;   // world px between the corners the edge is measured at
const FOG_STEP = 2;   // world px per step of the rim
const FOG_ARC = 3;    // world px of arc between two sight lines at the end of their reach
const FOG_CLAMP = 16; // px either side of the edge a corner's distance is kept to

const fogEyesDraw = [];
let fogNow = -1, fogTeam = -1, fogLines = new Map();
const fogShownMap = new Map();
const fogMaskCv = document.createElement('canvas'), fogMaskCtx = fogMaskCv.getContext('2d');
let fogImg = null, fogPx = null, fogGrid = null, fogGW = 0, fogGH = 0;
// the side's sight by tile, for both maps: WORLD x WORLD, dim where unseen
const fogMapCv = document.createElement('canvas'), fogMapCtx = fogMapCv.getContext('2d');
let fogMapImg = null, fogMapPx = null, fogMapKey = '';

// whether the fog is drawn this frame, for whom, and each eye's sight lines
function fogView(now) {
  if (now === fogNow) return fogTeam >= 0;
  fogNow = now; fogShownMap.clear();
  fogTeam = fogUp() ? viewPlayer().team : -1;
  if (fogTeam < 0) return false;
  sightSources(fogTeam, fogEyesDraw);
  // an eye that has not moved a px since the last frame keeps its lines
  // (unless something was built or knocked down: the walls are structures)
  const was = fogLines, ver = structures.length;
  fogLines = new Map();
  for (const s of fogEyesDraw) {
    s.n = Math.ceil(Math.PI * 2 * s.r / FOG_ARC);
    if (s.open) continue;
    const key = Math.round(s.x) + ',' + Math.round(s.y) + ',' + s.r + ',' + ver;
    let d = was.get(key);
    if (!d) {
      d = new Float32Array(s.n);
      for (let i = 0; i < s.n; i++) {
        const a = i / s.n * Math.PI * 2, t = sightReach(s.x, s.y, Math.cos(a), Math.sin(a), s.r, s.walls, s.stone);
        d[i] = t >= s.r ? s.r : Math.min(s.r, t + FOG_FACE);
      }
    }
    s.d = d; fogLines.set(key, d);
  }
  return true;
}

// which of eye s's sight lines points along (dx, dy)
function fogRay(s, dx, dy) {
  let a = Math.atan2(dy, dx);
  if (a < 0) a += Math.PI * 2;
  return ((a * s.n / (Math.PI * 2)) | 0) % s.n;
}

// signed px from (x, y) to the side's nearest fog edge, up to FOG_CLAMP: >= 0 lit
function fogMargin(x, y) {
  let best = -FOG_CLAMP;
  for (const s of fogEyesDraw) {
    const dx = x - s.x, dy = y - s.y;
    if (dx > s.r || dx < -s.r || dy > s.r || dy < -s.r) continue;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let m;
    if (s.open) m = s.r - dist;
    else m = s.d[fogRay(s, dx, dy)] - dist;
    if (m > best) best = m;
  }
  return best > FOG_CLAMP ? FOG_CLAMP : best;
}

// Whether body u is drawn this frame: always with no fog up, on the viewed
// side, or falcon-marked; otherwise inside the side's sight and not hidden in
// the woods or the brush (coverHide). The one question every body draw and map dot asks.
// With no `now` (a pass outside the frame's draw: the trample) it asks the
// frame the screen last drew.
function fogShown(u, now) {
  if (now !== undefined) fogView(now);
  if (u.fogHid) return false; // a client: the host said this body is out of the side's sight, and what is held of it is stale
  if (fogTeam < 0 || u.team === fogTeam || u.markT > 0) return true;
  let v = fogShownMap.get(u);
  if (v === undefined) { v = fogMargin(u.x, u.y) >= 0 && !coverHide(fogEyesDraw, u.x, u.y); fogShownMap.set(u, v); }
  return v;
}

// the corners' distances for the cells over the world view, eye by eye: an
// open eye's circle by its radius, a stopped one through its sight lines
function fogCorners(gx0, gy0) {
  fogGW = Math.ceil(WV_W / FOG_CELL) + 3; fogGH = Math.ceil(WV_H / FOG_CELL) + 3;
  if (!fogGrid || fogGrid.length < fogGW * fogGH) fogGrid = new Float32Array(fogGW * fogGH);
  const g = fogGrid, W = fogGW;
  g.fill(-FOG_CLAMP, 0, W * fogGH);
  for (const s of fogEyesDraw) {
    const r = s.r + FOG_CLAMP, inner = s.open ? s.r - FOG_CLAMP : -1;
    const i0 = Math.max(0, Math.floor((s.x - r) / FOG_CELL) - gx0), i1 = Math.min(W - 1, Math.ceil((s.x + r) / FOG_CELL) - gx0);
    const j0 = Math.max(0, Math.floor((s.y - r) / FOG_CELL) - gy0), j1 = Math.min(fogGH - 1, Math.ceil((s.y + r) / FOG_CELL) - gy0);
    for (let j = j0; j <= j1; j++) {
      const dy = (gy0 + j) * FOG_CELL - s.y, row = j * W;
      for (let i = i0; i <= i1; i++) {
        if (g[row + i] >= FOG_CLAMP) continue;
        const dx = (gx0 + i) * FOG_CELL - s.x, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r) continue;
        let m;
        if (dist <= inner) m = FOG_CLAMP;
        else if (s.open) m = s.r - dist;
        else m = s.d[fogRay(s, dx, dy)] - dist;
        if (m > g[row + i]) g[row + i] = m > FOG_CLAMP ? FOG_CLAMP : m;
      }
    }
  }
}

// the mask over the world view: FOG_STEP world px per mask px, its corner on
// the world's FOG_STEP grid, cells whole in runs and the edge's cells stepped
function fogMask(ox, oy) {
  const R = FOG_STEP, per = FOG_CELL / R;
  const W = Math.ceil(WV_W / R) + 2, H = Math.ceil(WV_H / R) + 2;
  if (fogMaskCv.width !== W || fogMaskCv.height !== H || !fogImg) {
    fogMaskCv.width = W; fogMaskCv.height = H;
    fogImg = fogMaskCtx.createImageData(W, H); fogPx = new Uint32Array(fogImg.data.buffer);
  }
  const mx0 = Math.floor(ox / R), my0 = Math.floor(oy / R);
  const gx0 = Math.floor(mx0 / per), gy0 = Math.floor(my0 / per);
  fogCorners(gx0, gy0);
  const g = fogGrid, GW = fogGW, px = fogPx;
  const FOG = (255 << 24) | (FOG_TINT[2] << 16) | (FOG_TINT[1] << 8) | FOG_TINT[0]; // RGBA bytes, little-endian
  for (let j = 0; j < fogGH - 1; j++) {
    const py0 = (gy0 + j) * per - my0;
    if (py0 >= H || py0 + per <= 0) continue;
    for (let yy = 0; yy < per; yy++) {
      const y = py0 + yy;
      if (y < 0 || y >= H) continue;
      const row = y * W, fy = (yy + 0.5) / per;
      let i = 0;
      while (i < GW - 1) {
        const px0 = (gx0 + i) * per - mx0;
        if (px0 >= W) break;
        const a = g[j * GW + i], b = g[j * GW + i + 1], c = g[(j + 1) * GW + i], d = g[(j + 1) * GW + i + 1];
        const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
        if (lo >= 0 || hi < 0) {
          // a run of whole cells all lit or all fog, filled at once
          const v = lo >= 0 ? 0 : FOG;
          let e = i + 1;
          while (e < GW - 1) {
            const a2 = g[j * GW + e], b2 = g[j * GW + e + 1], c2 = g[(j + 1) * GW + e], d2 = g[(j + 1) * GW + e + 1];
            if (v ? Math.max(a2, b2, c2, d2) >= 0 : Math.min(a2, b2, c2, d2) < 0) break;
            e++;
          }
          const x0 = Math.max(0, px0), x1 = Math.min(W, (gx0 + e) * per - mx0);
          if (x1 > x0) px.fill(v, row + x0, row + x1);
          i = e;
          continue;
        }
        for (let xx = 0; xx < per; xx++) {
          const x = px0 + xx;
          if (x < 0 || x >= W) continue;
          const fx = (xx + 0.5) / per;
          const m = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
          px[row + x] = m >= 0 ? 0 : FOG;
        }
        i++;
      }
    }
  }
  fogMaskCtx.putImageData(fogImg, 0, 0);
  return { x: mx0 * R - ox, y: my0 * R - oy, w: W * R, h: H * R };
}

// the fog over the world view (ctx is the world buffer), under the night
function drawFog(ox, oy, now) {
  if (!fogView(now)) return;
  const at = fogMask(ox, oy);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(fogMaskCv, at.x, at.y, at.w, at.h);
  ctx.restore();
}

// The maps' fog: one px a tile over the whole world, the tile lit when its
// centre is, rebuilt only when that changes. Both maps lay it over their
// ground with the same multiply (fogOverMap)
function fogMapFrame(now) {
  if (!fogView(now)) return false;
  if (!fogMapImg) {
    fogMapCv.width = fogMapCv.height = WORLD;
    fogMapImg = fogMapCtx.createImageData(WORLD, WORLD); fogMapPx = new Uint32Array(fogMapImg.data.buffer);
  }
  // the key: every eye's tile and reach (a stopped eye's lines change only as it moves)
  let key = structures.length + ':';
  for (const s of fogEyesDraw) key += ((s.x / 4) | 0) + ',' + ((s.y / 4) | 0) + ',' + s.r + ';';
  if (key === fogMapKey) return true;
  fogMapKey = key;
  const FOG = (255 << 24) | (FOG_TINT[2] << 16) | (FOG_TINT[1] << 8) | FOG_TINT[0];
  fogMapPx.fill(FOG);
  for (const s of fogEyesDraw) {
    const t0x = Math.max(0, Math.floor((s.x - s.r) / TILE)), t1x = Math.min(WORLD - 1, Math.floor((s.x + s.r) / TILE));
    const t0y = Math.max(0, Math.floor((s.y - s.r) / TILE)), t1y = Math.min(WORLD - 1, Math.floor((s.y + s.r) / TILE));
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      if (fogMapPx[ty * WORLD + tx] && fogMargin((tx + 0.5) * TILE, (ty + 0.5) * TILE) >= 0) fogMapPx[ty * WORLD + tx] = 0;
    }
  }
  fogMapCtx.putImageData(fogMapImg, 0, 0);
  return true;
}
// lay the maps' fog on g: the world's tiles (tx0, ty0, tw, th) onto the box (x, y, w, h)
function fogOverMap(g, now, tx0, ty0, tw, th, x, y, w, h) {
  if (!fogMapFrame(now)) return;
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(fogMapCv, tx0, ty0, tw, th, x, y, w, h);
  g.restore();
}
