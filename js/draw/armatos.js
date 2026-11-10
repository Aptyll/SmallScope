'use strict';
// ------------------------------------------------------------ armatos
// ARMATOS's pixels (his rules: js/sim/armatos.js): the standard he carries on
// his back - its torn cloth filling gold as his resolve builds - the same
// standard planted as THE OLD GUARD with its rally ring, and the shapes his
// keys put on the snow while they wind up and where they land.

const STD_POLE = '#a8794a', STD_GOLD = '#f2cc6a', STD_GOLD_D = '#b98a2e';
const STD_INK = '#141a2c';

// the cloth: 4 x 5 off the pole's head, torn up the bottom, `dir` +1 flying
// right of the pole and -1 left. `fill` 0..1 is how much of it (from the bottom)
// is gold; full, it glints. `sway` +1 streams it a pixel further out, -1 a pixel in
// (the cloth a beat behind his stop or turn, idleShown, js/draw/idle.js).
function drawStdCloth(x, y, dir, col, fill, now, sway) {
  const rows = [4, 4, 4, 3, 2]; // the tear: shorter toward the bottom
  const gold = Math.round(fill * rows.length);
  for (let r = 0; r < rows.length; r++) {
    const g = r >= rows.length - gold;
    const n = Math.max(1, rows[r] + (sway || 0));
    for (let c = 0; c < n; c++) {
      const cx = dir > 0 ? x + 1 + c : x - 1 - c;
      ctx.fillStyle = g ? (c === n - 1 ? STD_GOLD_D : STD_GOLD) : col;
      ctx.fillRect(cx, y + r, 1, 1);
    }
  }
  if (fill >= 1 && Math.floor(now * 4) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(dir > 0 ? x + 2 : x - 2, y + 1, 1, 1); }
}
// the pole and its cloth, its foot at (fx, fy), `h` px tall
function drawStandard(fx, fy, h, dir, col, fill, now, sway) {
  ctx.fillStyle = STD_INK;
  ctx.fillRect(fx - 1, fy - h - 1, 3, h + 1);
  ctx.fillStyle = STD_POLE;
  ctx.fillRect(fx, fy - h, 1, h);
  ctx.fillStyle = STD_GOLD;   // the finial
  ctx.fillRect(fx, fy - h - 1, 1, 1);
  drawStdCloth(fx, fy - h + 1, dir, col, fill, now, sway);
}
// ...and on a body drawn fine (bodySet's `dens` 2): the same pole and cloth on half px, the
// pole lit and shaded down its two art px and inked either side, the cloth's tear in ten rows
const STD_TEAR_FINE = [8, 8, 8, 8, 8, 8, 7, 6, 4, 3];
function drawStandardFine(fx, fy, h, dir, col, fill, now, sway) {
  const u = 0.5;
  ctx.fillStyle = STD_INK;
  ctx.fillRect(fx - u, fy - h - 2 * u, u, h + 2 * u); ctx.fillRect(fx + 1, fy - h - 2 * u, u, h + 2 * u);
  ctx.fillRect(fx, fy - h - 2 * u, 1, u);
  ctx.fillStyle = STD_POLE; ctx.fillRect(fx, fy - h, u, h);
  ctx.fillStyle = STD_GOLD_D; ctx.fillRect(fx + u, fy - h, u, h);
  ctx.fillStyle = STD_GOLD; ctx.fillRect(fx, fy - h - u, 1, u); // the finial
  const y = fy - h + 1, rows = STD_TEAR_FINE, gold = Math.round(fill * rows.length);
  for (let r = 0; r < rows.length; r++) {
    const g = r >= rows.length - gold, n = Math.max(2, rows[r] + 2 * (sway || 0));
    for (let c = 0; c < n; c++) {
      ctx.fillStyle = g ? (c >= n - 1 ? STD_GOLD_D : STD_GOLD) : c >= n - 1 ? STD_INK : col;
      ctx.fillRect(dir > 0 ? fx + 1 + u + c * u : fx - u - (c + 1) * u, y + r * u, u, u);
    }
  }
  if (fill >= 1 && Math.floor(now * 4) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(dir > 0 ? fx + 2.5 : fx - 3, y + 1, u, u); }
}
// The standard on his back, at the body's cell (ax, ay, its top-left).
// Facing away it is drawn over the body (the back is what shows); otherwise
// behind it, over the far shoulder. While it stands planted in the snow the
// back is bare. `front` says which pass this is.
function drawHeroBack(p, ax, ay, now, front) {
  if (CLASSES[p.cls].passive !== 'resolve' || guardPlanted(p)) return;
  const up = p.dir === 'up';
  if (front !== up) return;
  const fx = ax + (p.dir === 'left' ? 11 : 4); // over the shoulder the sword is not in
  const dir = p.dir === 'left' ? 1 : -1; // the cloth streams out away from the body
  const idle = idleShown(p); // it rides his shoulders' breath, and its cloth hangs behind his stop or turn
  const draw = bodySet(p).dens > 1 ? drawStandardFine : drawStandard; // the body's own pixel size
  draw(fx, ay + 10, 11 - idle.b, dir, TEAMS[skin(p.team)].mark, p.resolve, now, idle.lag ? idle.lag.dx * dir : 0); // its head beside his, under the plate
}

// ---- the greatsword in his hands -----------------------------------------------
// His blade (HERO_BLADES.oath, js/draw/heroes.js): flat for the side, the swing
// and the wind-up, and slanted for a body facing down (the grip at his right
// hip, the blade up and out past the shoulder, his face clear) or up (the same
// blade rising behind that shoulder: drawn before the body, which covers the grip).
let armSwordArt = null;
function armSwords() {
  if (armSwordArt) return armSwordArt;
  return (armSwordArt = { flat: bakeBladeArt(ARM_SWORD, ARM_SWORD_PAL), diag: bakeBladeArt(ARM_SWORD_DIAG, ARM_SWORD_PAL) });
}
// ...and at 32 px for his fine body (ARM_SWORD_FINE), the grips the same world px
let armSwordFine = null;
function armSwordsFine() {
  if (armSwordFine) return armSwordFine;
  const tag = (c) => { c.dens = 2; return c; };
  return (armSwordFine = { flat: tag(bakeBladeArt(ARM_SWORD_FINE, ARM_SWORD_PAL)), diag: tag(bakeBladeArt(ARM_SWORD_DIAG_FINE, ARM_SWORD_PAL)) });
}
HERO_BLADES.oath = { art: armSwords, fine: armSwordsFine, hilt: [19, 11], hip: { down: [13, 11], up: [11, 10] }, grip: ARM_GRIP };

// ---- on the snow --------------------------------------------------------------
// a box laid down a bearing, (px, py) its near end: a landing's line with no look of its own
function drawLineBox(px, py, a, len, half, col, alpha, fill) {
  const nx = Math.cos(a), ny = Math.sin(a);
  ctx.globalAlpha = alpha;
  for (let s = 4; s <= len; s += 3) {
    for (const k of [-half, half]) {
      const x = Math.round(px + nx * s - ny * k), y = Math.round(py + ny * s + nx * k);
      ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y + 1, 2, 2);
      ctx.fillStyle = col; ctx.fillRect(x, y, 2, 2);
    }
  }
  for (let k = -half; k <= half; k += 2) {
    const x = Math.round(px + nx * len - ny * k), y = Math.round(py + ny * len + nx * k);
    ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
  }
  if (fill > 0) {
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = col;
    for (let s = 6; s < len * fill; s += 3) for (let k = -half + 2; k < half - 1; k += 3) {
      if ((Math.round(s / 3) + Math.round(k / 3)) % 2) continue;
      ctx.fillRect(Math.round(px + nx * s - ny * k), Math.round(py + ny * s + nx * k), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// IRON VERDICT's wind-up: the sword's shadow thrown down the line as he lifts it,
// longer as it rises, and in its middle - where a body is thrown up - the snow
// already jumping under it
function drawVerdictTele(p, px, py, a, closing, now) {
  const nx = Math.cos(a), ny = Math.sin(a), len = VERDICT_LEN * (0.35 + 0.65 * closing);
  ctx.fillStyle = 'rgba(40,52,90,0.32)';
  for (let s = 6; s < len; s++) {
    const w = Math.max(0, Math.round((VERDICT_HALF - 3) * (1 - s / (len + 6)))); // broad at the hilt, to a point
    for (let k = -w; k <= w; k++) ctx.fillRect(Math.round(px + nx * s - ny * k), Math.round(py + 2 + ny * s + nx * k), 1, 1);
  }
  if (closing > 0.75) { // the edge catches the light as it comes down
    ctx.fillStyle = '#ffffff';
    for (let s = 8; s < len - 2; s++) ctx.fillRect(Math.round(px + nx * s), Math.round(py + 2 + ny * s), 1, 1);
  }
  const seed = p.id * 31;
  for (let k = 0; k < 9; k++) { // flecks hopping in the middle stretch
    const s = VERDICT_LEN * (VERDICT_MID[0] + (VERDICT_MID[1] - VERDICT_MID[0]) * fxRoll(seed, k, 1));
    const o = (fxRoll(seed, k, 2) * 2 - 1) * (VERDICT_HALF - 2);
    const z = Math.round(Math.abs(Math.sin(now * 14 + k * 1.7)) * (1 + 3 * closing));
    const x = Math.round(px + nx * s - ny * o), y = Math.round(py + 2 + ny * s + nx * o);
    ctx.fillStyle = 'rgba(40,52,90,0.3)'; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - z, 1, 1);
  }
}
// its landing: the snow split down the line, banks thrown up either side, and
// the middle stretch thrown into the air
function drawVerdictFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f), nx = Math.cos(f.a), ny = Math.sin(f.a), y0 = py + 4;
  const run = f.r * Math.min(1, u * 6);
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
  for (let s = 4, o = 0; s < run; s++) {
    if (fxRoll(seed, s, 11) < 0.35) o = Math.max(-2, Math.min(2, o + (fxRoll(seed, s, 12) < 0.5 ? -1 : 1))); // a jagged split, not a wave
    const x = px + nx * s - ny * o, y = y0 + ny * s + nx * o;
    ctx.fillStyle = STD_INK; ctx.fillRect(Math.round(x), Math.round(y), 2, 1); // the split
    ctx.fillStyle = '#9fb6d8'; ctx.fillRect(Math.round(x), Math.round(y) + 1, 2, 1);
    if (s % 2) continue;
    for (const side of [-1, 1]) { // the banks it threw up
      const b = side * (f.half - 4 + Math.round(fxRoll(seed, s, side + 3) * 2));
      const bx = Math.round(px + nx * s - ny * b), by = Math.round(y0 + ny * s + nx * b);
      ctx.fillStyle = '#9fb6d8'; ctx.fillRect(bx, by + 1, 2, 1);
      ctx.fillStyle = '#f4f7ff'; ctx.fillRect(bx, by, 2, 1);
    }
  }
  const z0 = 14 * 4 * u * (1 - u);
  for (let k = 0; k < 10; k++) { // the middle thrown up
    const s = f.r * (VERDICT_MID[0] + (VERDICT_MID[1] - VERDICT_MID[0]) * fxRoll(seed, k, 7));
    const o = (fxRoll(seed, k, 8) * 2 - 1) * f.half * (0.4 + u);
    const x = Math.round(px + nx * s - ny * o), y = Math.round(y0 + ny * s + nx * o);
    ctx.fillStyle = 'rgba(40,52,90,0.3)'; ctx.fillRect(x, y + 1, 2, 1);
    const z = Math.round(z0 * (0.6 + 0.4 * fxRoll(seed, k, 9)));
    fxChip(x, y - z - 1, k, k % 3 ? '#f4f7ff' : '#cfd8e8', '#7f98bc', STD_INK); // lumps of the crust
  }
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.verdict = drawVerdictFx;
// HOLD THE LINE's bash: the shield's face swept round in front of him, gold when
// a hero had primed it, and the snow thrown off its rim
function drawBashFx(f, px, py, now) {
  const u = f.t / f.life, gold = f.col === '#ffd95c';
  drawSwoosh(px, py, f.a, f.r, f.half, u, 7, [STD_INK, gold ? '#ffd95c' : '#ffffff', gold ? STD_GOLD_D : '#8796ad'], 1);
  drawFlung(px, py + 2, f.a, f.half, f.r + 10, 0.7, 6, 8, Math.min(1, u * 1.5), fxSeed(f), (x, y, k) => {
    ctx.fillStyle = STD_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = gold && k % 2 ? '#ffd95c' : '#ffffff'; ctx.fillRect(x, y, 1, 1);
  });
}
AB_FX_LOOK.bash = drawBashFx;
// VETERAN'S MARCH's wind-up: the snow down the line he will charge already trodden
// flat, a packed strip as wide as he is, and his boot prints stamped into it left and
// right, out further as he lowers his head, the newest in his side's mark
function drawMarchTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), len = teleLen(p.x, p.y, nx, ny, MARCH_SPD * MARCH_T);
  const reach = len * (0.4 + 0.6 * closing), col = TEAMS[skin(p.team)].mark;
  fxStrip(p.x + nx * 8 - ex, p.y + 3 + ny * 8 - ey, nx, ny, reach - 6, 5, 4, p.id * 19, '#c9d4e8', '#b3c0da');
  for (let s = 12, k = 0; s < reach; s += 7, k++) { // left, right, left: a stride, not a row
    const o = k % 2 ? 3 : -3, x = Math.round(p.x + nx * s - ny * o - ex), y = Math.round(p.y + 3 + ny * s + nx * o - ey);
    const hx = Math.round(x - nx * 3), hy = Math.round(y - ny * 3);
    ctx.fillStyle = s + 7 >= reach ? col : '#5f7aa3'; // the print: a sole and its heel behind
    ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillRect(hx - 1, hy, 2, 2);
  }
}
// THE OLD GUARD: a shield stood in the snow, in the side's colour, its boss gold
const GUARD_SHIELDS = 20;
function drawGuardShield(x, y, col, colD) {
  ctx.fillStyle = STD_INK; ctx.fillRect(x - 3, y - 7, 7, 8); ctx.fillRect(x - 2, y + 1, 5, 1); ctx.fillRect(x - 1, y + 2, 3, 1);
  ctx.fillStyle = col; ctx.fillRect(x - 2, y - 6, 5, 7); ctx.fillRect(x - 1, y + 1, 3, 1);
  ctx.fillStyle = colD; ctx.fillRect(x + 1, y - 6, 1, 7);
  ctx.fillStyle = STD_GOLD; ctx.fillRect(x, y - 3, 1, 1);
}
// its wind-up: the shields coming up round the reach, one by one
function drawGuardTele(p, px, py, closing) {
  const tm = TEAMS[skin(p.team)], n = Math.ceil(GUARD_SHIELDS * closing);
  for (let i = 0; i < n; i++) {
    const t = i * Math.PI * 2 / GUARD_SHIELDS - Math.PI / 2;
    const x = Math.round(px + Math.cos(t) * GUARD_R), y = Math.round(py + 2 + Math.sin(t) * GUARD_R * 0.62);
    const rise = i === n - 1 ? Math.round(3 * (1 - (GUARD_SHIELDS * closing - i))) : 0; // the newest still coming up
    ctx.fillStyle = 'rgba(160,182,214,0.7)'; ctx.fillRect(x - 3, y + 1, 7, 1);
    drawGuardShield(x, y + rise, tm.mark, tm.coatD);
  }
}
// the standard planted: the ring of shields in the side's colour round its reach, a
// gap of snow broken at each one's foot, the standard at its heart, all thinning out
// over its last second. Drawn on the snow with the other ability shapes
// (HERO_GROUND, js/sim/heroes.js), for both sides.
function drawGuards(ex, ey, now) {
  for (const g of guards) {
    const px = Math.round(g.x - ex), py = Math.round(g.y - ey);
    if (px < -GUARD_R - 8 || py < -GUARD_R - 20 || px > WV_W + GUARD_R + 8 || py > WV_H + GUARD_R + 8) continue;
    const fade = Math.min(1, (g.life - g.t) / 1, g.t / 0.2), tm = TEAMS[skin(g.team)];
    ctx.globalAlpha = fade;
    for (let i = 0; i < GUARD_SHIELDS; i++) {
      const t = i * Math.PI * 2 / GUARD_SHIELDS - Math.PI / 2;
      const x = Math.round(px + Math.cos(t) * GUARD_R), y = Math.round(py + 2 + Math.sin(t) * GUARD_R * 0.62);
      ctx.fillStyle = 'rgba(160,182,214,0.7)'; ctx.fillRect(x - 3, y + 1, 7, 1);
      drawGuardShield(x, y, tm.mark, tm.coatD);
    }
    ctx.fillStyle = 'rgba(160,182,214,0.7)'; // the snow broken at its foot
    ctx.fillRect(px - 2, py + 2, 5, 1);
    drawStandard(px, py + 2, 16, 1, tm.mark, 0, now);
    ctx.globalAlpha = 1;
  }
}
// its landing: the standard driven in, cracks run out from its foot and snow thrown round
function drawGuardFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
  drawCracks(px, py + 3, 7, 22, Math.min(1, u * 5), seed, STD_INK, '#ffffff');
  drawFlung(px, py + 3, 0, Math.PI, 30, 0.4, 10, 16, Math.min(1, u * 1.4), seed, (x, y, k) => {
    fxChip(x, y - 1, k, k % 4 ? '#f4f7ff' : STD_GOLD, k % 4 ? '#7f98bc' : STD_GOLD_D, STD_INK);
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.guard = drawGuardFx;
HERO_GROUND.push(drawGuards);
HERO_BODY_FX.push(drawHeroBack);
