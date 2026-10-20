'use strict';
// ------------------------------------------------------------ armatos
// ARMATOS's pixels (his rules: js/sim/armatos.js): the standard he carries on
// his back - its torn cloth filling gold as his resolve builds - the same
// standard planted as THE OLD GUARD with its rally ring, and the shapes his
// keys put on the snow while they wind up and where they land.

const STD_POLE = '#a8794a', STD_POLE_D = '#6e4a28', STD_GOLD = '#f2cc6a', STD_GOLD_D = '#b98a2e';
const STD_INK = '#141a2c';

// the cloth: 4 x 5 off the pole's head, torn up the bottom, `dir` +1 flying
// right of the pole and -1 left. `fill` 0..1 is how much of it (from the bottom)
// is gold; full, it glints.
function drawStdCloth(x, y, dir, col, fill, now) {
  const rows = [4, 4, 4, 3, 2]; // the tear: shorter toward the bottom
  const gold = Math.round(fill * rows.length);
  for (let r = 0; r < rows.length; r++) {
    const g = r >= rows.length - gold;
    for (let c = 0; c < rows[r]; c++) {
      const cx = dir > 0 ? x + 1 + c : x - 1 - c;
      ctx.fillStyle = g ? (c === rows[r] - 1 ? STD_GOLD_D : STD_GOLD) : col;
      ctx.fillRect(cx, y + r, 1, 1);
    }
  }
  if (fill >= 1 && Math.floor(now * 4) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(dir > 0 ? x + 2 : x - 2, y + 1, 1, 1); }
}
// the pole and its cloth, its foot at (fx, fy), `h` px tall
function drawStandard(fx, fy, h, dir, col, fill, now) {
  ctx.fillStyle = STD_INK;
  ctx.fillRect(fx - 1, fy - h - 1, 3, h + 1);
  ctx.fillStyle = STD_POLE;
  ctx.fillRect(fx, fy - h, 1, h);
  ctx.fillStyle = STD_GOLD;   // the finial
  ctx.fillRect(fx, fy - h - 1, 1, 1);
  drawStdCloth(fx, fy - h + 1, dir, col, fill, now);
}
// The standard on his back, at the body's cell (ax, ay, its top-left).
// Facing away it is drawn over the body (the back is what shows); otherwise
// behind it, over the far shoulder. While it stands planted in the snow the
// back is bare. `front` says which pass this is.
function drawHeroBack(p, ax, ay, now, front) {
  if (!CLASSES[p.cls].passive || guardPlanted(p) || p.prone) return;
  const up = p.dir === 'up';
  if (front !== up) return;
  const fx = ax + (p.dir === 'left' ? 11 : 4); // over the shoulder the sword is not in
  const dir = p.dir === 'left' ? 1 : -1; // the cloth streams out away from the body
  drawStandard(fx, ay + 10, 11, dir, TEAMS[skin(p.team)].mark, p.resolve, now); // its head beside his, under the plate
}

// ---- the greatsword in his hands -----------------------------------------------
// His blade replaces the sword's held art wherever a hand holds it (drawHeldTool,
// js/draw/bodies.js): flat for the side, the swing and the wind-up, and slanted
// for a body facing down (the grip at his right hip, the blade up and out past
// the shoulder, his face clear) or up (the same blade rising behind that
// shoulder: drawn before the body, which covers the grip).
let armSwordArt = null;
function armSwords() {
  if (armSwordArt) return armSwordArt;
  const bake = (rows) => {
    const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = ARM_SWORD_PAL[r[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
    return c;
  };
  return (armSwordArt = { flat: bake(ARM_SWORD), diag: bake(ARM_SWORD_DIAG) });
}
// the blade a hero's hands hold in place of a melee tool's own, or null
function heroBlade(p, wDef) { return wDef.melee && CLASSES[p.cls].blade === 'oath' ? armSwords().flat : null; }
const ARM_HIP = { down: [13, 12], up: [11, 10] }; // where the grip sits on the 16 px cell, by facing
// the carried blade facing down or up; false where the side's level carry stands
function heroCarry(p, px, py) {
  const at = ARM_HIP[p.dir], w = heldTool(p), def = w ? TOOLS[toolIdOf(w.type)] : null;
  if (!at || !def || !heroBlade(p, def)) return false;
  ctx.drawImage(armSwords().diag, Math.round(px + at[0] - ARM_GRIP[0]), Math.round(py + at[1] - ARM_GRIP[1]));
  return true;
}

// ---- on the snow --------------------------------------------------------------
// a box laid down a bearing: the IRON VERDICT's line, (px, py) its near end
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
// the verdict's wind-up: the line, and its middle - where a body is thrown up -
// hashed in solid as the blade comes down
function drawVerdictTele(px, py, a, col, closing) {
  drawLineBox(px, py, a, VERDICT_LEN, VERDICT_HALF, col, 0.55 + 0.4 * closing, closing);
  const nx = Math.cos(a), ny = Math.sin(a);
  ctx.globalAlpha = 0.35 + 0.5 * closing;
  ctx.fillStyle = TELE_HOT;
  for (let s = VERDICT_LEN * VERDICT_MID[0]; s <= VERDICT_LEN * VERDICT_MID[1]; s += 2) {
    for (let k = -VERDICT_HALF + 2; k <= VERDICT_HALF - 2; k += 2) {
      if ((Math.round(s / 2) + Math.round(k / 2)) % 2) continue;
      ctx.fillRect(Math.round(px + nx * s - ny * k), Math.round(py + ny * s + nx * k), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// the march's wind-up: the charge's own dashed line to where it would end
function drawMarchTele(p, a, col, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a);
  const len = teleLen(p.x, p.y, nx, ny, MARCH_SPD * MARCH_T);
  drawTeleLine(p.x, p.y, nx, ny, len, col, 0.5 + 0.45 * closing, now, ex, ey);
  drawTeleLine(p.x - ny * 4, p.y + nx * 4, nx, ny, len, col, 0.3 + 0.3 * closing, now, ex, ey);
  drawTeleLine(p.x + ny * 4, p.y - nx * 4, nx, ny, len, col, 0.3 + 0.3 * closing, now, ex, ey);
}
// THE OLD GUARD: the ring in the side's colour, the standard planted at its
// heart, both thinning out over its last second. Drawn on the snow with the
// other ability shapes (drawAbilityGround, js/sim/abilities.js), for both sides.
function drawGuards(ex, ey, now) {
  for (const g of guards) {
    const px = Math.round(g.x - ex), py = Math.round(g.y - ey);
    if (px < -GUARD_R - 8 || py < -GUARD_R - 20 || px > WV_W + GUARD_R + 8 || py > WV_H + GUARD_R + 8) continue;
    const fade = Math.min(1, (GUARD_T - g.t) / 1, g.t / 0.2);
    const col = TEAMS[skin(g.team)].mark;
    drawRing(px, py + 2, GUARD_R, col, 0.75 * fade, 0);
    // the inner ring breathes, so the zone reads as alive
    drawRing(px, py + 2, GUARD_R - 5 - Math.round(2 * Math.sin(now * 3)), col, 0.25 * fade, 0);
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(160,182,214,0.7)'; // the snow broken at its foot
    ctx.fillRect(px - 2, py + 2, 5, 1);
    drawStandard(px, py + 2, 16, 1, col, 0, now);
    ctx.globalAlpha = 1;
  }
}
