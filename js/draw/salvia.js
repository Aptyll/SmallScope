'use strict';
// ------------------------------------------------------------ salvia
// SALVIA's pixels (her rules: js/sim/salvia.js): her staff's sprig in flight
// (HERO_SHOTS), and on the snow (HERO_GROUND) the POULTICE's bundle flying, the
// SNOWDROPS nodding until picked (shut and flickering as they wilt) and THAW's melted ground with
// the warmth rising off it. Both sides see all of it.

const SV_MELT = '#c5d3e8', SV_MELT_LIP = '#93a9cc', SV_WET = '#7f95b8'; // THAW: the wet snow, its slush lip, a soaked spot
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
    // the melted ground: a sheet of wet snow, wetter toward the middle, and at its true
    // edge a broken lip of slush (never stripes, never a drawn outline: the lip has gaps
    // and marks the limit); on it a few small wet spots where shoots have come up, a
    // white snowdrop or two among them (small, not her SNOWDROPS: nothing to pick). No
    // spots on ice or water: there only the wet sheen.
    const seed = (Math.round(w.x) * 7 + Math.round(w.y) * 13) | 0;
    ctx.globalAlpha = 0.4 * a; fxSheet(px, py, THAW_R * 0.97, 0.03, seed, SV_MELT);
    ctx.globalAlpha = 0.35 * a; fxSheet(px + 6, py - 4, THAW_R * 0.55, 0.25, seed + 1, SV_MELT_LIP);
    ctx.globalAlpha = 0.9 * a; ctx.fillStyle = SV_MELT_LIP;
    for (let k = 0, n = Math.ceil(THAW_R * 2 * Math.PI); k < n; k++) {
      const sec = Math.floor(k / 9);
      if (fxRoll(seed, sec, 6) < 0.28) continue; // a gap
      const t = k / n * Math.PI * 2, th = 2 + (fxRoll(seed, sec, 7) < 0.5 ? 1 : 0), off = Math.round(fxRoll(seed, sec, 8) * 3 + Math.sin(t * 9) * 1.2); // each stretch slumped its own way
      for (let q = 0; q < th; q++) ctx.fillRect(Math.round(px + Math.cos(t) * (THAW_R - off - q)), Math.round(py + Math.sin(t) * (THAW_R - off - q)), 1, 1);
    }
    for (let i = 0; i < 6; i++) {
      const ang = (i + fxRoll(seed, i, 2) * 0.8) / 6 * Math.PI * 2, rr = THAW_R * (0.2 + 0.6 * fxRoll(seed, i, 3));
      const wx = w.x + Math.cos(ang) * rr, wy = w.y + Math.sin(ang) * rr;
      if (iceAtPx(wx, wy) || waterAt(Math.floor(wx / TILE), Math.floor(wy / TILE))) continue;
      const x = Math.round(wx - ex), y = Math.round(wy - ey);
      ctx.globalAlpha = 0.8 * a; fxSheet(x, y, 4, 0.3, seed + i * 7, SV_WET, null, 0.6);
      ctx.globalAlpha = a;
      for (let j = 0; j < 3; j++) { // a tuft of shoots, swaying
        const sx = x - 3 + j * 3, sw = Math.round(Math.sin(now * 2 + i + j * 2));
        ctx.fillStyle = SV_SAGE_D; ctx.fillRect(sx, y - 1, 1, 2);
        ctx.fillStyle = SV_SAGE; ctx.fillRect(sx + sw, y - 3, 1, 2);
        if (j === 1 || (j === 2 && i % 2)) { ctx.fillStyle = SV_WHITE; ctx.fillRect(sx + sw, y - 5, 2, 2); ctx.fillStyle = SV_SAGE_D; ctx.fillRect(sx + sw, y - 3, 1, 1); } // a small snowdrop, nodding
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
    // its shadow on the snow at the feet, a loose leaf or two dropping behind it, then the bundle tumbling
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#9fb6d8'; ctx.fillRect(px - 2, py + BOW_Y, 5, 1); ctx.globalAlpha = 1;
    for (let k = 1; k <= 2; k++) {
      const back = 9 * k + (b.d % 9); if (back > b.d) break;
      svLeaf(Math.round(px - b.nx * back), Math.round(py - b.ny * back + k * 2 + (back >> 3)), b.d * 0.3 + k);
    }
    svBundle(px, py, Math.floor(b.d / 7) % 4);
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
// the poultice: a round linen bundle tied with twine, the knot's two ears and a sprig of sage
// standing out of the tie; `turn` (0..3) is the quarter it has tumbled to
const SV_TIE = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function svBundle(x, y, turn) {
  ctx.fillStyle = SV_INK; ctx.fillRect(x - 2, y - 3, 5, 7); ctx.fillRect(x - 3, y - 2, 7, 5);
  ctx.fillStyle = SV_LINEN; ctx.fillRect(x - 1, y - 2, 3, 5); ctx.fillRect(x - 2, y - 1, 5, 3);
  ctx.fillStyle = SV_LINEN_D; ctx.fillRect(x + 1, y + 1, 2, 1); ctx.fillRect(x + 1, y + 2, 1, 1); ctx.fillRect(x - 1, y + 2, 2, 1); // its under side in shade
  ctx.fillStyle = SV_WHITE; ctx.fillRect(x - 1, y - 2, 2, 1);
  const [tx, ty] = SV_TIE[turn], sx = -ty, sy = tx;
  ctx.fillStyle = SV_GOLD_D; // the twine round it, and the knot where it is tied
  for (let k = -2; k <= 2; k++) ctx.fillRect(x + sx * k + tx, y + sy * k + ty, 1, 1);
  ctx.fillStyle = SV_INK; ctx.fillRect(x + tx * 4 - 1, y + ty * 4 - 1, 3, 3); // the gathered neck above the knot
  ctx.fillStyle = SV_LINEN; ctx.fillRect(x + tx * 4 - sx, y + ty * 4 - sy, 1, 1); ctx.fillRect(x + tx * 4 + sx, y + ty * 4 + sy, 1, 1);
  ctx.fillStyle = SV_SAGE_D; ctx.fillRect(x + tx * 4, y + ty * 4, 1, 1);
  ctx.fillStyle = SV_INK; ctx.fillRect(x + tx * 6 - 1, y + ty * 6 - 1, 3, 3); // the sprig
  ctx.fillStyle = SV_SAGE; ctx.fillRect(x + tx * 5, y + ty * 5, 1, 1); ctx.fillRect(x + tx * 6, y + ty * 6, 1, 1);
  ctx.fillStyle = SV_SAGE_D; ctx.fillRect(x + tx * 6 + sx, y + ty * 6 + sy, 1, 1);
}
// POULTICE's wind-up: no line down the snow; the bundle itself, drawn out of her satchel and
// held out the way it will fly
function drawPoulticeTele(p, a, closing, now, ex, ey) {
  const r = 10 + 3 * closing;
  svBundle(Math.round(p.x + Math.cos(a) * r - ex), Math.round(p.y - BOW_Y + Math.sin(a) * r - ey) + (closing < 0.5 ? 1 : 0), 0);
}
// POULTICE landing: the bundle burst open where it met a body, a wall or its reach: the linen
// square dropping flat and its sage leaves thrown out and settling
function drawPoulticeFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  ctx.globalAlpha = Math.min(1, 3 * (1 - u));
  const cy = py + Math.round(BOW_Y * Math.min(1, u * 2.5)); // the cloth falls to the snow
  ctx.fillStyle = SV_INK; ctx.fillRect(px - 3, cy - 1, 7, 4);
  ctx.fillStyle = SV_LINEN; ctx.fillRect(px - 2, cy, 5, 2);
  ctx.fillStyle = SV_LINEN_D; ctx.fillRect(px, cy + 1, 3, 1);
  drawFlung(px, py + BOW_Y, 0, Math.PI, f.r, 0.3, 9, 9, Math.min(1, u * 1.8), seed, (x, y, k) => svLeaf(x, y, k * 1.7));
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.poultice = drawPoulticeFx;
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
// WARM CLOAK on the one wrapped (HERO_BODY_FX, any ally's body): a short linen cape
// over the shoulders, a gold clasp at the throat and a sage hem, open down the chest
// facing the screen (the side's colour stays seen) and whole across the back facing
// away; it falls into place row by row over CLOAK_FALL and fades as the speed runs out
const CLOAK_FALL = 0.2;
const CLOAK_ROWS = [ // [y, x0, x1] in the 16 px cell, top row first; the last is the hem
  [7, 4, 11], [8, 3, 12], [9, 3, 12], [10, 3, 12],
];
function drawSalviaCloak(p, ax, ay, now, front) {
  if (!front || !(p.cloakT > 0)) return;
  const n = Math.max(1, Math.ceil(CLOAK_ROWS.length * Math.min(1, (CLOAK_RUN_T - p.cloakT) / CLOAK_FALL)));
  const back = p.dir === 'up';
  ctx.globalAlpha = Math.min(1, p.cloakT * 4);
  for (let i = 0; i < n; i++) {
    const [y, x0, x1] = CLOAK_ROWS[i], hem = i === CLOAK_ROWS.length - 1, open = !back && i >= 2; // open: the chest shows between its two sides
    ctx.fillStyle = SV_INK; ctx.fillRect(ax + x0 - 1, ay + y, 1, 1); ctx.fillRect(ax + x1 + 1, ay + y, 1, 1);
    for (let x = x0; x <= x1; x++) {
      if (open && x > x0 + 2 && x < x1 - 2) continue;
      const fold = x === x0 + 2 || x === x1 - 2 || (back && (x === 7 || x === 8) && i > 0);
      ctx.fillStyle = hem ? ((x + (back ? 0 : 1)) % 2 ? SV_SAGE : SV_SAGE_D) : fold ? SV_LINEN_D : SV_LINEN;
      ctx.fillRect(ax + x, ay + y, 1, 1);
    }
    if (hem) { ctx.fillStyle = SV_INK; for (let x = x0; x <= x1; x++) if (!(open && x > x0 + 2 && x < x1 - 2)) ctx.fillRect(ax + x, ay + y + 1, 1, 1); }
  }
  if (!back) { ctx.fillStyle = SV_GOLD; ctx.fillRect(ax + 7, ay + 7, 2, 1); } // the clasp
  for (let k = 0; k < 3; k++) { // warmth rising off it
    const t = (now * 1.4 + k / 3) % 1;
    ctx.fillStyle = k % 2 ? SV_GOLD : SV_LINEN; ctx.fillRect(ax + [2, 13, 8][k], ay + 6 - Math.round(t * 5), 1, 1);
  }
  ctx.globalAlpha = 1;
}
HERO_BODY_FX.push(drawSalviaCloak);
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
HERO_STAVES.snowdrop = { art: salviaStaff, grip: SALVIA_STAFF_GRIP, hold: 'far' };
