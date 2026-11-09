'use strict';
// ------------------------------------------------------------ sagitta
// SAGITTA's pixels (her rules: js/sim/sagitta.js): her bolts in flight
// (HERO_SHOTS), the PAVISE standing on the snow (HERO_MACHINE's draw), THE
// LONG BOLT's crawling line while she kneels (its row's `tele`), HEAVY BOLTS'
// count over her (HERO_MARK), and her arbalest on her shoulder facing down or
// up (HERO_CARRY). Both sides see all of it.

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
// While she kneels, the line the bolt will fly: the towers' crawling dashes (drawTowerFx,
// js/draw/towers.js), in her side's mark, white in the last quarter, out to the first
// tree or wall on it
function drawLongBoltLine(p, a, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), y0 = p.y + 4;
  const L = teleLen(p.x, y0, nx, ny, LONG_RANGE), n = Math.floor(L / 2), crawl = Math.floor(now * 14);
  const col = closing > 0.75 ? SG_WHITE : TEAMS[skin(p.team)].mark;
  ctx.globalAlpha = 0.35 + 0.6 * closing;
  for (let i = 6; i < n; i++) {
    if ((i - crawl) % 4 >= 2) continue;
    const x = Math.round(p.x + nx * i * 2 - ex), y = Math.round(y0 + ny * i * 2 - ey);
    if (x < -2 || y < -2 || x > WV_W + 2 || y > WV_H + 2) continue;
    ctx.fillStyle = TOWER_RIM; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

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

// ---- the arbalest on her shoulder ----------------------------------------------------
// Facing down or up the level carry would lay the crossbow across her feet; she
// shoulders it instead, prod up beside her head and clear of her face (HERO_CARRY)
function sagittaCarry(p, px, py) {
  if (!isSagitta(p) || (p.dir !== 'down' && p.dir !== 'up')) return false;
  const A = attackOf(p), img = SPRITES.weaponArt[A.art];
  if (!img) return false;
  drawGripped(img, WEAPON_GRIP.icon[A.art], p.dir === 'down' ? px + 17 : px - 1, py + 11, -Math.PI / 2 - WEAPON_FWD[A.art]);
  return true;
}
HERO_CARRY.push(sagittaCarry);
