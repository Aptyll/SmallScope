'use strict';
// ------------------------------------------------------------ salvia
// SALVIA's pixels (her rules: js/sim/salvia.js): her staff's sprig in flight
// (HERO_SHOTS), and on the snow (HERO_GROUND) the POULTICE's bundle flying, the
// SNOWDROPS nodding until picked (shut and flickering as they wilt) and THAW's melted ground with
// the warmth rising off it. Both sides see all of it.

const SV_MELT = '#c5d3e8', SV_MELT_LIP = '#93a9cc', SV_EARTH = '#8a7458', SV_EARTH_D = '#6b5a48'; // THAW: the wet snow and its slumped lip, the bare earth and its damp edge
const SV_INK = '#2e2440', SV_LINEN = '#e8dcb4', SV_LINEN_D = '#a89263', SV_SAGE = '#9cc87a', SV_SAGE_D = '#4f8a46',
  SV_WHITE = '#f8f8ff', SV_GOLD = '#f2cc6a', SV_GOLD_D = '#b98a2e';

// ---- shots -----------------------------------------------------------------------
// her staff's SPRIG: one green leaf with a pale rib, tumbling end over end (lying, then standing), a short green wake
function drawSprigShot(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang), x = Math.round(sx), y = Math.round(sy), up = Math.floor(now * 9 + a.ox) % 2 === 1;
  fxTail(sx, sy, nx, ny, 5, SV_SAGE, SV_SAGE_D);
  const w = up ? 1 : 2, h = up ? 2 : 1; // the leaf's half-length each way
  ctx.fillStyle = SV_INK; ctx.fillRect(x - w - 1, y - h, 2 * w + 3, 2 * h + 1); ctx.fillRect(x - w, y - h - 1, 2 * w + 1, 2 * h + 3);
  ctx.fillStyle = SV_SAGE_D; ctx.fillRect(x - w, y - h, 2 * w + 1, 2 * h + 1);
  ctx.fillStyle = SV_SAGE; ctx.fillRect(x - w, y - h, 2 * w + (up ? 0 : 1), 2 * h + (up ? 1 : 0)); // lit from the top-left
  ctx.fillStyle = SV_WHITE; if (up) ctx.fillRect(x, y - 1, 1, 3); else ctx.fillRect(x - 1, y, 3, 1); // the rib
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
    // the melted ground: a sheet of wet snow with a shore of its own and a slumped lip
    // (never stripes, never a drawn outline), bare earth showing through in patches,
    // and green shoots coming up in them
    const seed = (Math.round(w.x) * 7 + Math.round(w.y) * 13) | 0;
    ctx.globalAlpha = 0.4 * a; fxSheet(px, py, THAW_R * 0.94, 0.08, seed, SV_MELT, SV_MELT_LIP);
    ctx.globalAlpha = 0.35 * a; fxSheet(px + 6, py - 4, THAW_R * 0.55, 0.25, seed + 1, SV_MELT_LIP); // wetter toward the middle
    for (let i = 0; i < 13; i++) {
      const ang = (i + fxRoll(seed, i, 2) * 0.8) / 13 * Math.PI * 2, rr = THAW_R * (0.12 + 0.72 * fxRoll(seed, i, 3));
      const x = Math.round(px + Math.cos(ang) * rr), y = Math.round(py + Math.sin(ang) * rr), er = 4 + Math.round(fxRoll(seed, i, 4) * 7);
      ctx.globalAlpha = 0.85 * a; fxSheet(x, y, er, 0.3, seed + i * 7, SV_EARTH, SV_EARTH_D, 0.6);
      ctx.globalAlpha = a; // a shoot or two in it, swaying
      for (let j = 0; j < 2; j++) {
        const sx = x + Math.round((fxRoll(seed, i, 5 + j) - 0.5) * er), sw = Math.round(Math.sin(now * 2 + i + j * 2));
        ctx.fillStyle = SV_SAGE_D; ctx.fillRect(sx, y - 1, 1, 2);
        ctx.fillStyle = SV_SAGE; ctx.fillRect(sx + sw, y - 3, 1, 2); ctx.fillRect(sx + sw + (j ? 1 : -1), y - 2, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
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
// Her staff (CLASSES' `staff: 'snowdrop'`; HERO_STAVES, js/draw/heroes.js): a green sprig of
// snowdrop leaves on a pale alder shaft wound with a vine, one small white bud at its tip,
// carried upright; the bud nods between two frames. The hand closes on the shaft at
// SALVIA_STAFF_GRIP.
const SALVIA_STAFF = [
  '....o....',
  '...oWo...',
  '..oWWWo..',
  '.ooosooo.',
  '.oLoUoLo.',
  '.oLLULLo.',
  '.olLULlo.',
  '..olUlo..',
  '...oUo...',
  '...ouo...',
  '...oUo...',
  '...ouo...',
  '...oUo...',
  '...ouo...',
  '...oUo...',
  '...ouo...',
  '...oUo...',
  '...obo...',
  '....o....',
];
const SALVIA_STAFF_GRIP = [4, 11];
const SALVIA_STAFF_PAL = { o: '#2e2440', W: '#f8f8ff', s: '#c8d8e8', l: '#3f7240', L: '#7cb864', U: '#4f8a46', u: '#b08a62', b: '#7a5a40' };
let salviaStaffArt = null;
function salviaStaff() {
  if (salviaStaffArt) return salviaStaffArt;
  const sway = SALVIA_STAFF.map((r, y) => (y === 0 ? '.....o...' : y === 1 ? '....oWo..' : y === 2 ? '...oWWWo.' : r));
  salviaStaffArt = [bakeBladeArt(SALVIA_STAFF, SALVIA_STAFF_PAL), bakeBladeArt(sway, SALVIA_STAFF_PAL)];
  return salviaStaffArt;
}
// The staff at 32 px for her fine body (HERO_STAVES.snowdrop's `fine`), drawn, not doubled: the bud a
// drooping bell, two lance leaves, the vine wound round the alder; the grip the same world px
const SALVIA_STAFF_FINE = [
  '........oo........',
  '.......oWWo.......',
  '......oWWWWo......',
  '......oWWWso......',
  '......oWWsso......',
  '.......oWso.......',
  '..oo...oUUo...oo..',
  '.oLLo..oUUo..oLLo.',
  '.oLLLo.oUUo.oLLLo.',
  '.oLLLLooUUooLLLlo.',
  '..oLLLLoUUoLLLlo..',
  '..olLLLLUULLLllo..',
  '...olLLLUULLllo...',
  '....ollLUULllo....',
  '.....oolUUloo.....',
  '.......oUUo.......',
  '.......oUbo.......',
  '.......ouUo.......',
  '.......oubo.......',
  '.......oubo.......',
  '.......oUbo.......',
  '.......ouUo.......',
  '.......oubo.......',
  '.......oubo.......',
  '.......oUbo.......',
  '.......ouUo.......',
  '.......oubo.......',
  '.......oubo.......',
  '.......oUbo.......',
  '.......ouUo.......',
  '.......oubo.......',
  '.......oubo.......',
  '.......oUbo.......',
  '.......ouUo.......',
  '.......oubo.......',
  '.......oubo.......',
  '.......obbo.......',
  '........oo........',
];
let salviaStaffFineArt = null;
function salviaStaffFine() {
  if (salviaStaffFineArt) return salviaStaffFineArt;
  const tag = (c) => { c.dens = 2; return c; };
  const sway = SALVIA_STAFF_FINE.map((r, y) => (y < 6 ? '.' + r.slice(0, -1) : r)); // the bud nods a px
  return (salviaStaffFineArt = [tag(bakeBladeArt(SALVIA_STAFF_FINE, SALVIA_STAFF_PAL)), tag(bakeBladeArt(sway, SALVIA_STAFF_PAL))]);
}
HERO_STAVES.snowdrop = { art: salviaStaff, fine: salviaStaffFine, grip: SALVIA_STAFF_GRIP, hold: 'far' };
