'use strict';
// ------------------------------------------------------------ falls
// A soldier or a beast going down (the record: `falls`, unitFall, js/sim/farm.js),
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
    if (t < 0 || t > FALL_T || (vp && !inSight(vp.team, f))) continue; // one in the fog is not seen (js/sim/fog.js)
    draws.push({ y: f.y + 4, fall: f });
  }
}

function drawFall(f, ex, ey) {
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
