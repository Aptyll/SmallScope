'use strict';
// ------------------------------------------------------------ salvia
// SALVIA's pixels (her rules: js/sim/salvia.js): her staff's sprig in flight
// (HERO_SHOTS), and on the snow (HERO_GROUND) the POULTICE's bundle flying, the
// SNOWDROPS nodding until picked (shut and flickering as they wilt) and THAW's warm ring with
// the warmth rising off it. Both sides see all of it.

const SV_INK = '#2e2440', SV_LINEN = '#e8dcb4', SV_LINEN_D = '#a89263', SV_SAGE = '#9cc87a', SV_SAGE_D = '#4f8a46',
  SV_WHITE = '#f8f8ff', SV_GOLD = '#f2cc6a', SV_GOLD_D = '#b98a2e';

// ---- shots -----------------------------------------------------------------------
// her staff's SPRIG: a green mote with a pale leaf behind it
function drawSprigShot(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang);
  const x = Math.round(sx), y = Math.round(sy);
  ctx.fillStyle = SV_SAGE_D; ctx.fillRect(Math.round(sx - nx * 4), Math.round(sy - ny * 4), 1, 1);
  ctx.fillStyle = SV_SAGE; ctx.fillRect(Math.round(sx - nx * 2), Math.round(sy - ny * 2), 1, 1);
  ctx.fillStyle = SV_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = Math.sin(now * 20 + a.ox) > 0 ? SV_WHITE : SV_SAGE; ctx.fillRect(x, y, 1, 1);
}
HERO_SHOTS.sprig = drawSprigShot;

// ---- on the snow --------------------------------------------------------------------
// one of her snowdrops with its feet at (px, py): the warren's own clump (SPRITES.snowdrop,
// js/draw/passes.js), nodding with the wind; shut as it wilts
function drawSnowdropAt(px, py, now, seed, shut) {
  const V = SPRITES.snowdrop[Math.abs(Math.round(seed)) % SPRITES.snowdrop.length];
  const lean = Math.sin(now * 1.6 + seed) > 0.5 ? 1 : 0;
  const spr = (shut > 0.8 ? V.closed : V.open)[lean + 1];
  ctx.drawImage(spr, px - (spr.width >> 1), py + 2 - spr.height);
}
// the poultices flying, the snowdrops waiting, the warm rings
function drawSalviaGround(ex, ey, now) {
  for (const f of salviaDrops) {
    const px = Math.round(f.x - ex), py = Math.round(f.y - ey);
    if (px < -8 || py < -10 || px > WV_W + 8 || py > WV_H + 8) continue;
    const k = f.t / DROP_LIFE;
    if (k > 0.9 && Math.floor(now * 6) % 2) continue; // flickers as it wilts
    drawSnowdropAt(px, py, now, f.x * 0.1, k);
  }
  for (const w of salviaThaws) {
    const px = Math.round(w.x - ex), py = Math.round(w.y - ey);
    if (px < -THAW_R - 4 || py < -THAW_R - 30 || px > WV_W + THAW_R + 4 || py > WV_H + THAW_R + 4) continue;
    const k = w.t / THAW_T, a = k > 0.85 ? (1 - k) / 0.15 : 1;
    // the melted ground inside, then the rim
    ctx.globalAlpha = 0.12 * a; ctx.fillStyle = SV_GOLD;
    for (let y = -THAW_R; y <= THAW_R; y += 2) { const hw = Math.floor(Math.sqrt(THAW_R * THAW_R - y * y)); ctx.fillRect(px - hw, py + y, hw * 2 + 1, 1); }
    ctx.globalAlpha = 1;
    drawRing(px, py, THAW_R, SV_GOLD, 0.8 * a, 0);
    // warmth rising off it, a mote at a time round the ring
    for (let i = 0; i < 14; i++) {
      const ang = i / 14 * Math.PI * 2 + i * 0.37, rr = THAW_R * (0.25 + 0.7 * ((i * 0.618) % 1));
      const rise = ((now * 0.9 + i * 0.29) % 1);
      const x = Math.round(px + Math.cos(ang) * rr), y = Math.round(py + Math.sin(ang) * rr - rise * 18);
      ctx.globalAlpha = a * (1 - rise);
      ctx.fillStyle = i % 3 ? SV_GOLD : SV_GOLD_D; ctx.fillRect(x, y, 1, 2);
    }
    ctx.globalAlpha = 1;
  }
  for (const b of salviaBundles) {
    const px = Math.round(b.x - ex), py = Math.round(b.y - ey);
    if (px < -6 || py < -6 || px > WV_W + 6 || py > WV_H + 6) continue;
    // its shadow on the snow at the feet, then the bundle spinning
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#9fb6d8'; ctx.fillRect(px - 1, py + BOW_Y, 3, 1); ctx.globalAlpha = 1;
    ctx.fillStyle = SV_INK; ctx.fillRect(px - 2, py - 2, 5, 5);
    ctx.fillStyle = SV_LINEN; ctx.fillRect(px - 1, py - 1, 3, 3);
    ctx.fillStyle = SV_LINEN_D; ctx.fillRect(px + 1, py + 1, 1, 1);
    const spin = Math.floor(b.d / 6) % 2;
    ctx.fillStyle = SV_GOLD; if (spin) ctx.fillRect(px - 1, py, 3, 1); else ctx.fillRect(px, py - 1, 1, 3);
    ctx.fillStyle = SV_SAGE; ctx.fillRect(px + (spin ? -1 : 1), py - 3, 1, 1);
  }
}
HERO_GROUND.push(drawSalviaGround);

// ---- the SNOWDROP STAFF ----------------------------------------------------------------
// Her staff (CLASSES' `staff: 'snowdrop'`; HERO_STAVES, js/draw/heroes.js): a snowdrop's
// white bell nodding off the top of a pale alder shaft, two leaves under it, carried
// upright; the bell sways between two frames. The hand closes on the shaft at SALVIA_STAFF_GRIP.
const SALVIA_STAFF = [
  '...o...',
  '..olo..',
  '.oWWWo.',
  'oWWWWWo',
  'oWsWsWo',
  'oWoWoWo',
  '.o.o.o.',
  '..oUo..',
  'olouolo',
  '.oouoo.',
  '..ouo..',
  '..ouo..',
  '..ouo..',
  '..ouo..',
  '..ouo..',
  '..ouo..',
  '..obo..',
  '..obo..',
  '...o...',
];
const SALVIA_STAFF_GRIP = [3, 11];
const SALVIA_STAFF_PAL = { o: '#2e2440', W: '#f8f8ff', s: '#c8d8e8', l: '#4f8a46', U: '#4f8a46', u: '#b08a62', b: '#7a5a40' };
let salviaStaffArt = null;
function salviaStaff() {
  if (salviaStaffArt) return salviaStaffArt;
  const sway = SALVIA_STAFF.map((r, y) => (y === 4 ? 'oWWsWWo' : y === 5 ? 'oWWoWWo' : y === 6 ? '.oo.oo.' : r));
  salviaStaffArt = [bakeBladeArt(SALVIA_STAFF, SALVIA_STAFF_PAL), bakeBladeArt(sway, SALVIA_STAFF_PAL)];
  return salviaStaffArt;
}
HERO_STAVES.snowdrop = { art: salviaStaff, grip: SALVIA_STAFF_GRIP };
