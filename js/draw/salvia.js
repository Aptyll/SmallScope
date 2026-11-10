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
    svMeltEdge(px, py, THAW_R, a, now); // the melt's ragged edge, never a drawn line
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

// ---- the keys' own looks -----------------------------------------------------------------
// THAW's edge: where the melt meets the snow, ragged and wet, bare earth showing through
function svMeltEdge(px, py, r, alpha, now) {
  const n = Math.ceil(r * 2 * Math.PI);
  for (let k = 0; k < n; k++) {
    const t = k / n * Math.PI * 2, rr = r + Math.round(Math.sin(t * 7) * 2 + Math.sin(t * 13 + 1) * 1.5);
    const x = Math.round(px + Math.cos(t) * rr), y = Math.round(py + Math.sin(t) * rr);
    ctx.globalAlpha = alpha * 0.8; ctx.fillStyle = '#7f98bc'; ctx.fillRect(x, y, 1, 2);
    if (k % 5 === 0) { ctx.fillStyle = '#6b5a48'; ctx.fillRect(x, y, 2, 1); } // earth through the melt
    if (k % 9 === 0 && Math.floor(now * 3 + k) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 1, 1, 1); } // a wet glint
  }
  ctx.globalAlpha = 1;
}
// a herb leaf at (x, y), pointing along t: two px of sage, its vein darker
function svLeaf(x, y, t) {
  const c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t));
  ctx.fillStyle = SV_INK; ctx.fillRect(x - 1, y, 4, 2);
  ctx.fillStyle = SV_SAGE; ctx.fillRect(x, y, 2, 1);
  ctx.fillStyle = SV_SAGE_D; ctx.fillRect(x + (c > 0 ? 1 : 0), y + (s > 0 ? 1 : 0), 1, 1);
}
// POULTICE's wind-up: herb leaves shaken loose, scattered down the line it will fly
function drawPoulticeTele(p, a, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = POULTICE_RANGE * (0.25 + 0.75 * closing);
  for (let s = 14, k = 0; s < L; s += 13, k++) {
    const side = Math.sin(k * 2.3 + now * 3) * 3;
    svLeaf(Math.round(p.x + nx * s - ny * side - ex), Math.round(p.y + ny * s + nx * side - ey), a + k);
  }
}
// SNOWDROPS' wind-up: a green shoot pushing up on each spot she will plant, a white bud on it
function drawDropsTele(x, y, closing) {
  const h = 1 + Math.round(3 * closing);
  for (let k = 0; k < DROP_N; k++) {
    const t = -Math.PI / 2 + k * Math.PI * 2 / DROP_N, fx = Math.round(x + Math.cos(t) * DROP_SPREAD), fy = Math.round(y + Math.sin(t) * DROP_SPREAD);
    ctx.fillStyle = '#9fb6d8'; ctx.fillRect(fx - 1, fy, 3, 1); // the snow parted
    ctx.fillStyle = SV_INK; ctx.fillRect(fx - 1, fy - h - 1, 3, h + 1);
    ctx.fillStyle = SV_SAGE_D; ctx.fillRect(fx, fy - h, 1, h);
    if (closing > 0.5) { ctx.fillStyle = SV_WHITE; ctx.fillRect(fx, fy - h - 1, 1, 1); }
  }
}
// WARM CLOAK's wind-up: warm air gathering round the one she wraps, motes wheeling up
function drawCloakTele(x, y, closing, now) {
  for (let k = 0; k < 8; k++) {
    const t = now * 5 + k * Math.PI / 4, rise = (k / 8 + now * 1.2) % 1;
    ctx.globalAlpha = (0.5 + 0.5 * closing) * (1 - rise);
    ctx.fillStyle = k % 2 ? SV_GOLD : SV_LINEN;
    ctx.fillRect(Math.round(x + Math.cos(t) * 7), Math.round(y - 4 + Math.sin(t) * 3 - rise * 14), 1, 2);
  }
  ctx.globalAlpha = 1;
}
// THAW's wind-up: the snow melting out from her feet, wet patches and steam spreading
function drawThawTele(px, py, closing, now) {
  for (const [ux, uy, r] of fxSpots(28)) {
    if (r > closing) continue;
    const x = Math.round(px + ux * THAW_R * 0.9), y = Math.round(py + uy * THAW_R * 0.9);
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#7f98bc'; fillEllipsePx(x, y, 3, 1);
    ctx.globalAlpha = 0.8; ctx.fillStyle = SV_GOLD; ctx.fillRect(x, y - 2 - Math.round(((now * 2 + r * 5) % 1) * 6), 1, 2);
  }
  ctx.globalAlpha = 1;
}

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
HERO_STAVES.snowdrop = { art: salviaStaff, grip: SALVIA_STAFF_GRIP, hold: 'far' };
