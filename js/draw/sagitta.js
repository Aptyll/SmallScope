'use strict';
// ------------------------------------------------------------ sagitta
// SAGITTA's pixels (her rules: js/sim/sagitta.js): her bolts in flight
// (HERO_SHOTS), the PAVISE standing on the snow (HERO_MACHINE's draw), THE
// LONG BOLT's crawling line while she kneels (its row's `tele`), HEAVY BOLTS'
// count over her (HERO_MARK), and her arbalest carried low at her hip
// (HERO_CARRY). Both sides see all of it.

const SG_STEEL = '#c3ccd8', SG_WOOD = '#8a6440', SG_BRASS = '#d9a640', SG_INK = '#141a2c', SG_WHITE = '#ffffff';

// ---- bolts --------------------------------------------------------------------------
// A bolt is the arrow's body (arrowBodyPx, js/draw/overhead.js) cut short: the head,
// a steel collar, a walnut shaft and stubby vanes. `thick` lays the shaft twice.
const SG_PX = [];
function drawBoltBody(a, sx, sy, i1, collar, thick) {
  const vd = Math.hypot(a.vx, a.vy) || 1, nx = a.vx / vd, ny = a.vy / vd, tm = TEAMS[skin(a.team)];
  SG_PX.length = 0;
  if (thick) arrowBodyPx(SG_PX, sx - ny, sy + nx, nx, ny, 3, i1 - 3, tm.mark, tm.coatD, collar, SG_WOOD);
  arrowBodyPx(SG_PX, sx, sy, nx, ny, 0, i1, tm.mark, tm.coatD, collar, SG_WOOD);
  paintArrowPx(SG_PX);
}
HERO_SHOTS.bolt = (a, sx, sy) => drawBoltBody(a, sx, sy, 11, SG_STEEL, false);
// the heavy one: thicker, a brass collar, a glint on its head
HERO_SHOTS.heavybolt = (a, sx, sy, now) => {
  drawBoltBody(a, sx, sy, 12, SG_BRASS, true);
  if (Math.floor(now * 16) % 2) { ctx.fillStyle = SG_WHITE; ctx.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 1); }
};
HERO_SHOTS.pinbolt = (a, sx, sy) => drawBoltBody(a, sx, sy, 12, SG_BRASS, true);
// the long bolt: the whole arrow's length, doubled, steel
HERO_SHOTS.longbolt = (a, sx, sy) => drawBoltBody(a, sx, sy, 15, SG_WHITE, true);

// ---- THE LONG BOLT's line -----------------------------------------------------------
// While she draws (PIN) or kneels (THE LONG BOLT), her sight down the line the bolt will
// fly: a taut band in her side's mark, 2 px over a dark underside so it is never a
// hairline, white down its middle in the last quarter, a glint running along it, out to
// the first tree or wall on it, where the bolt's head shows (the long bolt's the bigger)
function drawSightLine(p, a, range, closing, now, ex, ey, long) {
  const nx = Math.cos(a), ny = Math.sin(a), x0 = p.x, y0 = p.y - BOW_Y;
  const L = teleLen(x0, y0, nx, ny, range), glint = (now * (long ? 500 : 300)) % L;
  const col = TEAMS[skin(p.team)].mark, hot = closing > 0.75;
  const on = (x, y) => !(x < -4 || y < -4 || x > WV_W + 4 || y > WV_H + 4);
  ctx.globalAlpha = 0.5 + 0.4 * closing;
  for (let s = 10; s < L; s++) {
    const x = Math.round(x0 + nx * s - ex), y = Math.round(y0 + ny * s - ey);
    if (!on(x, y)) continue;
    const lit = Math.abs(s - glint) < 5;
    ctx.fillStyle = SG_INK; ctx.fillRect(x, y + 2, 2, 1);
    ctx.fillStyle = lit ? SG_WHITE : col; ctx.fillRect(x, y, 2, 2);
    if (hot && !lit) { ctx.fillStyle = SG_WHITE; ctx.fillRect(x, y, 1, 1); }
  }
  ctx.globalAlpha = 1;
  const hx = Math.round(x0 + nx * L - ex), hy = Math.round(y0 + ny * L - ey), n = long ? 5 : 3; // the bolt's head where it will stop
  if (on(hx, hy)) {
    const pts = [];
    for (let k = 0; k <= n; k++) for (let o = -(n - k); o <= n - k; o++) pts.push([Math.round(hx + nx * k - ny * o * 0.7), Math.round(hy + 1 + ny * k + nx * o * 0.7)]);
    ctx.fillStyle = SG_INK; for (const [qx, qy] of pts) ctx.fillRect(qx - 1, qy - 1, 3, 3);
    ctx.fillStyle = SG_STEEL; for (const [qx, qy] of pts) ctx.fillRect(qx, qy, 1, 1);
  }
}
// PAVISE's wind-up: the shield coming up out of the snow where she plants it, a little
// higher each frame, its foot spike's snow thrown up
function drawPaviseTele(p, x, y, a, closing) {
  const view = Math.sin(a) < -Math.abs(Math.cos(a)) * 0.5 ? 'back' : 'face', spr = sgPavArt(view, p.team);
  const h = Math.max(1, Math.round(spr.height * (0.3 + 0.7 * closing)));
  ctx.globalAlpha = 0.5 + 0.5 * closing;
  ctx.drawImage(spr, 0, 0, spr.width, h, x - 6, y + 2 - h, spr.width, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 7, y + 1, 1, 1); ctx.fillRect(x + 7, y + 1, 1, 1);
}
// CRANK BACK's landing: the bolt driven into the snow at her feet, a crater blown out
// round it, snow and grit thrown, the bolt left standing in the middle
function drawCrankFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
  ctx.fillStyle = '#7f98bc'; fillEllipsePx(px, py + 4, 8, 3);
  ctx.fillStyle = '#9fb6d8'; fillEllipsePx(px, py + 3, 6, 2);
  drawCracks(px, py + 4, 6, f.r * 0.7, Math.min(1, u * 5), seed, SG_INK, '#ffffff');
  drawFlung(px, py + 4, 0, Math.PI, f.r, 0.5, 12, 14, Math.min(1, u * 1.4), seed, (x, y, k) => {
    fxChip(x, y - 1, k, k % 4 ? '#f4f7ff' : '#c79a6a', k % 4 ? '#7f98bc' : '#8a5f3a', SG_INK); // snow, and splinters of the bolt
  });
  ctx.fillStyle = SG_INK; ctx.fillRect(px - 1, py - 4, 3, 7); // the bolt standing in it
  ctx.fillStyle = SG_WOOD; ctx.fillRect(px, py - 3, 1, 6);
  ctx.fillStyle = SG_STEEL; ctx.fillRect(px, py - 4, 1, 1);
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.crank = drawCrankFx;

// ---- the PAVISE ----------------------------------------------------------------------
// A tall shield on a foot spike: its face and the side's stripe, or, planted facing up
// the screen, its planks and braces.
const SG_PAV = {
  face: [
    '...oooooo...',
    '..oSSSSSSo..',
    '.oSwwrrwwSo.',
    '.oSwwrrwwSo.',
    '.oSwwrrwwSo.',
    '.oSrrrrrrSo.',
    '.oSrrRRrrSo.',
    '.oSwwrrwwSo.',
    '.oSwwrrwwSo.',
    '.oSwwrrwwSo.',
    '.oSwwrrwwSo.',
    '..oSwrrwSo..',
    '...oSSSSo...',
    '....oBBo....',
    '.....oo.....',
  ],
  back: [
    '...oooooo...',
    '..oSSSSSSo..',
    '.oSbbbbbbSo.',
    '.oSbBbbBbSo.',
    '.oSbBbbBbSo.',
    '.oSBBBBBBSo.',
    '.oSbBbbBbSo.',
    '.oSbBbbBbSo.',
    '.oSbBbbBbSo.',
    '.oSBBBBBBSo.',
    '.oSbBbbBbSo.',
    '..oSbbbbSo..',
    '...oSSSSo...',
    '....oBBo....',
    '.....oo.....',
  ],
};
const SG_PAV_PAL = { o: SG_INK, S: '#9aa3b8', w: '#a8794a', b: '#8a6440', B: '#5e4128' };
const sgPavCache = {};
function sgPavArt(view, team) {
  const k = view + skin(team);
  if (!sgPavCache[k]) {
    const tm = TEAMS[skin(team)];
    sgPavCache[k] = bakeBladeArt(SG_PAV[view], Object.assign({ r: tm.coat, R: tm.coatD }, SG_PAV_PAL));
  }
  return sgPavCache[k];
}
function drawSagittaPavise(b, ex, ey, now) {
  const c = Math.cos(b.ang), s = Math.sin(b.ang);
  const view = s < -Math.abs(c) * 0.5 ? 'back' : 'face'; // planted facing up the screen, its back is to us
  const spr = sgPavArt(view, b.team);
  const bx = Math.round(b.x - 6 - ex), by = Math.round(b.y + 4 - ey) - spr.height;
  drawCastShade(spr, bx, by);
  drawSpriteFlash(spr, bx, by, b.flash);
  drawUnitStates(b, bx, by, spr.width, spr.height, now);
  drawHealthBar(b.x - ex, by - 4, b.hp, b.maxHp, 8, b.team, undefined, b);
  // its time, a brass line under the bar
  const w = Math.round(8 * Math.max(0, b.life / b.lifeMax)), x = Math.round(b.x - ex) - 4;
  ctx.fillStyle = SG_INK; ctx.fillRect(x - 1, by - 2, 10, 3);
  ctx.fillStyle = SG_BRASS; ctx.fillRect(x, by - 1, w, 1);
  heroOver(b, Math.round(b.x - ex), by - 10, now); // a hero's marks, over the bar (HERO_OVER)
}

// ---- on her ------------------------------------------------------------------------
// HEAVY BOLTS: a small mark at her feet for each bolt loosed since the last heavy one
// (over her head is the health bar's), steel for the first, both brass and blinking once
// the next bolt is the heavy one; nothing right after a heavy bolt
function drawSagittaMarks(e, px, py, w, h, now) {
  const n = isSagitta(e) ? e.boltN || 0 : 0;
  if (!n) return;
  const hot = n === HEAVY_EVERY - 1, col = hot && Math.floor(now * 4) % 2 ? SG_WHITE : hot ? SG_BRASS : SG_STEEL;
  const cx = px + (w >> 1), y = py + h + 1;
  for (let k = 0; k < n; k++) {
    const x = cx - (n * 4 - 1 >> 1) + k * 4;
    ctx.fillStyle = SG_INK; ctx.fillRect(x - 1, y - 1, 5, 3);
    ctx.fillStyle = col; ctx.fillRect(x, y, 3, 1);
  }
}
HERO_MARK.push(drawSagittaMarks);

// ---- the arbalest at her hip ----------------------------------------------------------
// At rest she carries it low and ready in the leading hand, the prod down and out from
// her hip, the same in every facing (HERO_CARRY): the slanted grid as drawn, mirrored for
// a body facing left. Facing away it is behind her (heroCarry's pass). THE GRIP RULE:
// her fist closes on the stock behind the lock.
const SG_CARRY = [4, 4]; // where that hand closes on the slanted grid
const SG_TUCK = 3; // grid rows of the butt hidden under her arm
function sagittaCarry(p, px, py) {
  if (!isSagitta(p)) return false;
  const img = shotArt(p, attackOf(p).art).diag;
  if (!img) return false;
  const out = p.dir !== 'left', rc = heroReach(p); // the prod runs right of the hand
  const hx = out ? px + 12 + rc : px + 3 - rc, hy = py + 10;
  // the butt is tucked under her arm: the grid's top rows (SG_TUCK) stay undrawn, or the stock crosses her jaw
  const src = out ? img : heldFlip(img), k = src.dens || 1, t = SG_TUCK * k; // k: a finer body's art px a world px
  ctx.drawImage(src, 0, t, src.width, src.height - t, hx - (out ? SG_CARRY[0] : 12 - SG_CARRY[0]), hy - SG_CARRY[1] + SG_TUCK, src.width / k, (src.height - t) / k);
  if (p.dir !== 'up') heroFist(p, hx, hy, out ? 1 : -1);
  return true;
}
HERO_CARRY.push(sagittaCarry);
