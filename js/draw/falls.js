'use strict';
// ------------------------------------------------------------ falls
// A soldier or a beast going down, or a building wrecked (the record: `falls`, unitFall, js/sim/farm.js),
// drawn from the body's own pixels where it stood, sorted with the bodies. A white
// blink, then: a machine comes apart into grey plates thrown a little the way the
// blow went (one or two still in its side's paint until they land), its treads left
// standing, and they are gone one by one; a beast drops where it stands, slumped away
// from the blow in a puff of snow, and the snow takes it from the ground up. Whole
// pixels only: nothing is turned.
const FALL_FLASH = 0.07, FALL_DROP = 0.14, FALL_LIE = 0.55;
const FALL_PLATE = ['#c3ccd8', '#8a94a8', '#1c2130']; // a wreck's plate: lit, shade, ink
const fallPlatesOf = new WeakMap(); // frame -> its body cut into plates, and the pixels of its treads

// the frame a fall was standing in
function fallSpr(f) {
  if (f.k === 'R') {
    const type = f.spr, set = (SPRITES[type] || SPRITES.robotTeam)[skin(f.team)] || SPRITES.robot;
    return set[f.left && set.length > 4 ? 4 : 0];
  }
  const kind = f.spr, set = SPRITES[kind] && SPRITES[kind][f.dir];
  return set && set.idle ? set.idle[0] : null;
}
// a machine's frame as what it breaks into: the treads' own pixels (its lowest rows,
// which stay), and the body over them as plates three px square, each remembering
// whether it was painted (its side's colour) or bare
function fallPlates(spr) {
  let P = fallPlatesOf.get(spr);
  if (P) return P;
  const h = spr.height, tread = [], cell = new Map();
  for (const q of downPixels(spr)) {
    if (q.y >= h - 4) { tread.push(q); continue; }
    const k = ((q.y / 3) | 0) * 64 + ((q.x / 3) | 0), m = q.col.match(/\d+/g).map(Number);
    const c = cell.get(k) || { x: ((q.x / 3) | 0) * 3, y: ((q.y / 3) | 0) * 3, n: 0, hot: 0, col: q.col };
    c.n++;
    if (Math.max(m[0], m[1], m[2]) - Math.min(m[0], m[1], m[2]) > 70) { c.hot++; c.col = q.col; }
    cell.set(k, c);
  }
  const plates = [...cell.values()].filter((c) => c.n >= 5);
  for (const c of plates) c.paint = c.hot >= 5;
  fallPlatesOf.set(spr, (P = { tread, plates }));
  return P;
}

function fallDraws(draws, now) {
  const vp = viewPlayer();
  for (const f of falls) {
    const t = (state.tick - f.tick) * TICK_DT;
    if (t < 0 || t > fallLife(f) || (vp && !inSight(vp.team, f))) continue; // one in the fog is not seen (js/sim/fog.js)
    draws.push({ y: f.y + 4, fall: f });
  }
}

function drawFall(f, ex, ey) {
  if (f.k === 'S') { drawWreck(f, ex, ey); return; }
  const spr = fallSpr(f);
  if (!spr) return;
  const t = (state.tick - f.tick) * TICK_DT, w = spr.width, h = spr.height, px = downPixels(spr), seed = (Math.round(f.x) * 7 + Math.round(f.y) * 13 + f.tick) | 0;
  const ax = f.k === 'R' ? (f.left && w > 0 ? w - (SPRITES.robotAx[f.spr] || 6) : SPRITES.robotAx[f.spr] || 6) : w / 2;
  const ox = Math.round(f.x - ex - ax), gy = Math.round(f.y + 4 - ey), oy = gy - h;
  if (t < FALL_FLASH) { ctx.fillStyle = '#ffffff'; for (const q of px) ctx.fillRect(ox + q.x, oy + q.y, 1, 1); return; }
  const tt = t - FALL_FLASH, side = Math.cos(f.ang) < 0 ? -1 : 1;
  if (f.k === 'R') { // a machine: its plates thrown a little way, landed, greyed, gone one by one; the treads stay
    const P = fallPlates(spr), reach = Math.min(w, 14) * 0.75;
    for (const q of P.tread) { if (t < FALL_T - 0.12 || fxRoll(seed, q.x, 9) > 0.5) { ctx.fillStyle = q.col; ctx.fillRect(ox + q.x, oy + q.y, 1, 1); } }
    const every = Math.max(1, Math.ceil(P.plates.length / 5)); // five plates at most: the rest are under them
    let painted = 0;
    P.plates.forEach((c, i) => {
      const r1 = fxRoll(seed, i, 1), r2 = fxRoll(seed, i, 2), r3 = fxRoll(seed, i, 3);
      const keep = c.paint && painted < 2; // one or two plates keep their paint in the air, never more
      if (keep) painted++;
      else if (i % every) return;
      if (t > FALL_LIE + r1 * (FALL_T - FALL_LIE - 0.05)) return; // this one has gone into the snow
      const x0 = ox + c.x, y0 = oy + c.y, lx = ox + w / 2 - 2 + (r1 * 2 - 1) * reach + side * reach * 0.5, ly = gy - 4 + Math.round((r2 - 0.5) * 4);
      const air = 0.2 + r2 * 0.12, u = Math.min(1, tt / air), up = 4 + r3 * 5;
      const x = Math.round(x0 + (lx - x0) * u), y = Math.round(y0 + (ly - y0) * u - Math.sin(u * Math.PI) * up);
      ctx.fillStyle = FALL_PLATE[2]; ctx.fillRect(x - 1, y - 1, 6, 6);
      ctx.fillStyle = FALL_PLATE[1]; ctx.fillRect(x, y, 4, 4);
      ctx.fillStyle = keep && tt < air + 0.12 ? c.col : FALL_PLATE[0]; ctx.fillRect(x, y, 4, 3);
    });
    return;
  }
  // a beast: it drops where it stands, slumped away from the blow, never turned; its legs
  // go under it, and then the snow takes the rest. Whole rows moved whole pixels.
  const cx = Math.round(f.x - ex), leg = Math.max(2, Math.round(h * 0.3));
  const drop = tt < FALL_DROP / 2 ? 1 : tt < FALL_DROP ? Math.ceil(leg / 2) : leg;
  const sink = t < FALL_LIE ? 0 : Math.ceil(((t - FALL_LIE) / (FALL_T - FALL_LIE)) * (h - leg + 1));
  const lean = tt < FALL_DROP ? 0 : Math.min(3, Math.max(1, Math.round(h / 8)));
  for (const q of px) {
    const y = q.y + drop + sink;
    if (y >= h) continue; // under the snow now
    const sx = Math.round(side * lean * (1 - q.y / h));
    ctx.fillStyle = sink && y >= h - 1 ? '#dfe9f7' : q.col; // the row at the snow line pales
    ctx.fillRect(ox + q.x + sx, oy + y, 1, 1);
  }
  if (tt >= FALL_DROP / 2 && tt < FALL_DROP / 2 + 0.32) { // the snow it drops into, thrown up either side and settling
    const u = (tt - FALL_DROP / 2) / 0.32, n = Math.max(4, Math.round(w / 3));
    for (let k = 0; k < n; k++) {
      const d = (k % 2 ? 1 : -1) * (w * 0.3 + fxRoll(seed, k, 5) * (w * 0.3 + 2)) * (0.7 + 0.3 * u), r = Math.max(1, Math.round((1 - u) * (1.5 + fxRoll(seed, k, 6) * 2)));
      const x = Math.round(cx + d), y = gy - Math.round(Math.sin(u * Math.PI) * (2 + fxRoll(seed, k, 7) * 4));
      fxPatch(x, y + 1, r, 0.7, 1, seed + k, '#7f98bc');
      fxPatch(x, y, r, 0.7, 1, seed + k, '#b8c8e2');
    }
  }
}

// ---- a building coming down ------------------------------------------------------
// A wrecked building (k 'S': f.spr its type, (f.x, f.y) its footprint's bottom-left)
// does not blink out. Its own picture shudders, then drops straight down into the dust
// it raises, band by band a step out of line; stones are thrown clear and lie in the
// snow; then the dust thins and the stones go.
// Whole pixels, nothing turned. WRECK_ART is the standing picture by type.
const WRECK_ART = { tower: (f) => towerFigure(skin(f.team)) };
const WRECK_SHAKE = 0.22, WRECK_DROP = 0.75, WRECK_BAND = 9, WRECK_STONES = 9;
const WRECK_DUST = ['#6f86ad', '#9fb2d2', '#c3d0e6']; // the dust, dark to light: steps under the snow so it holds on it
function drawWreck(f, ex, ey) {
  const art = WRECK_ART[f.spr];
  if (!art) return;
  const fig = art(f), w = fig.width, h = fig.height, t = (state.tick - f.tick) * TICK_DT;
  const fw = STRUCTS[f.spr].w * TILE, x0 = Math.round(f.x - ex) + ((fw - w) >> 1), gy = Math.round(f.y - ey), cx = x0 + (w >> 1);
  const seed = (Math.round(f.x) * 7 + Math.round(f.y) * 13 + f.tick) | 0;
  // the body: shuddering where it stands, then dropping into the ground line, faster as it goes
  const u = Math.max(0, Math.min(1, (t - WRECK_SHAKE) / WRECK_DROP)), sink = Math.round(h * u * u);
  if (u < 1) {
    const beat = Math.floor(t * 30);
    for (let b = 0; b * WRECK_BAND < h; b++) {
      const by = b * WRECK_BAND, rows = Math.min(WRECK_BAND, h - by, h - sink - by); // what of this band is still over the ground
      if (rows <= 0) break;
      const jx = (t < WRECK_SHAKE ? 1 : 1 + Math.round(u * 2)) * (((b + beat) % 3) - 1); // each band a step out of line, more as it breaks up
      ctx.drawImage(fig, 0, by, w, rows, x0 + jx, gy - h + by + sink, w, rows);
    }
  }
  // the dust it raises: rolling out from the foot both ways and up, thinning at the end
  const du = Math.max(0, (t - WRECK_SHAKE * 0.6) / (FALL_T_WRECK - WRECK_SHAKE * 0.6));
  if (du > 0) for (let k = 0; k < 14; k++) {
    const r1 = fxRoll(seed, k, 21), r2 = fxRoll(seed, k, 22), side = k % 2 ? 1 : -1;
    const grow = Math.min(1, du * 2.2), fade = Math.max(0, (du - 0.55) / 0.45);
    const r = Math.round((3 + r1 * 5) * grow * (1 - fade));
    if (r < 1) continue;
    const x = Math.round(cx + side * (r2 * w * 0.5 + grow * (6 + r1 * 14))), y = gy - 2 - Math.round(grow * r2 * 14 + du * 6 * r1);
    fxPatch(x, y + 1, r + 1, 0.7, 1, seed + k, WRECK_DUST[0]);
    fxPatch(x, y, r, 0.7, 1, seed + k + 50, WRECK_DUST[1]);
    if (r > 3) fxPatch(x - 1, y - 1, r - 2, 0.7, 1, seed + k + 90, WRECK_DUST[2]);
  }
  // the stones thrown clear: up and out, down, lying, then gone one by one
  if (t > WRECK_SHAKE) for (let i = 0; i < WRECK_STONES; i++) {
    const r1 = fxRoll(seed, i, 1), r2 = fxRoll(seed, i, 2), r3 = fxRoll(seed, i, 3), side = i % 2 ? 1 : -1;
    const t0 = WRECK_SHAKE + r3 * 0.35, air = 0.3 + r2 * 0.15, v = Math.min(1, (t - t0) / air);
    if (v < 0 || t > FALL_T_WRECK - 0.5 + r1 * 0.45) continue;
    const lx = cx + side * (w * 0.35 + r1 * 22), ly = gy - 1 + Math.round((r2 - 0.5) * 8), sy0 = gy - h * (0.25 + r3 * 0.4);
    const x = Math.round(cx + (lx - cx) * v) - 2, y = Math.round(sy0 + (ly - sy0) * v - Math.sin(v * Math.PI) * (8 + r1 * 8)) - 2, big = i % 3 === 0 ? 5 : 4;
    ctx.fillStyle = FALL_PLATE[2]; ctx.fillRect(x - 1, y - 1, big + 2, big + 2);
    ctx.fillStyle = FALL_PLATE[1]; ctx.fillRect(x, y, big, big);
    ctx.fillStyle = FALL_PLATE[0]; ctx.fillRect(x, y, big, big - 1); // bare stone, never its side's paint: a red square in the air reads wrong
  }
}
