'use strict';
// ------------------------------------------------------------ fortiva
// FORTIVA's pixels (her rules: js/sim/fortiva.js): the shapes her keys put on the
// snow while they wind up, her greatsword, and what her state wears on her body - resolve high
// as gold glints circling her, DEFIANT HEART's shield as a gold shell round
// her, NO KNEELING's after as embers off her shoulders.

const FT_INK = '#141a2c', FT_GOLD = '#f2cc6a', FT_STEEL = '#c3ccd8', FT_SNOW_D = '#9fb6d8';
// a link of chain, 3 x 3 with its eye, steel or gold
function ftLink(x, y, col) {
  ctx.fillStyle = FT_INK; ctx.fillRect(x - 1, y - 1, 5, 5);
  ctx.fillStyle = col; ctx.fillRect(x, y, 3, 3);
  ctx.fillStyle = FT_INK; ctx.fillRect(x + 1, y + 1, 1, 1);
}
// SEVER THE CHAINS' wind-up: the greatsword's shadow swung back across the arc,
// and round its outer edge - where it cuts harder and heals - a chain laid out
// link by link as the blade comes round
function drawSeverTele(p, px, py, a, closing) {
  ctx.fillStyle = 'rgba(40,52,90,0.22)';
  const reach = SEVER_HALF * 2 * closing; // swept in from her back side
  for (let dy = -SEVER_R; dy <= SEVER_R; dy++) for (let dx = -SEVER_R; dx <= SEVER_R; dx++) {
    const d = Math.hypot(dx, dy / 0.9);
    if (d < SEVER_EDGE || d > SEVER_R) continue;
    let t = Math.atan2(dy / 0.9, dx) - (a - SEVER_HALF);
    t -= Math.floor(t / (Math.PI * 2)) * Math.PI * 2;
    if (t <= reach) ctx.fillRect(px + dx, py + 2 + dy, 1, 1);
  }
  const n = 11, lit = Math.ceil(n * closing), r = SEVER_R - 3;
  for (let i = 0; i < lit; i++) {
    const t = a - SEVER_HALF + (i + 0.5) / n * SEVER_HALF * 2;
    ftLink(Math.round(px + Math.cos(t) * r) - 1, Math.round(py + 2 + Math.sin(t) * r * 0.9) - 1, closing > 0.75 ? FT_GOLD : FT_STEEL);
  }
}
// its landing: the cut swept through the arc, gold at its edge, and the chain broken
// at the rim, links thrown off it
function drawSeverFx(f, px, py, now) {
  const u = f.t / f.life;
  drawSwoosh(px, py, f.a, f.r, f.half, u, 9, [FT_INK, '#ffffff', FT_GOLD], 1);
  drawFlung(px, py + 2, f.a, f.half, f.r + 14, 0.8, 8, 9, Math.min(1, u * 1.5), fxSeed(f), (x, y, k) => ftLink(x - 1, y - 1, k % 3 ? FT_STEEL : FT_GOLD));
}
AB_FX_LOOK.sever = drawSeverFx;
// DEFIANT HEART's wave: the gold shell round her burst, its shards thrown out to
// the reach, grey when it took nothing, and the snow blown back behind them
function drawDefyFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f), gold = f.col === FT_GOLD;
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
  drawFlung(px, py, 0, Math.PI, f.r, 0.7, 6, 18, Math.min(1, u * 1.6), seed, (x, y, k) => {
    ctx.fillStyle = FT_INK; ctx.fillRect(x - 1, y - 1, 4, 3);
    ctx.fillStyle = gold ? (k % 3 ? FT_GOLD : '#ffffff') : (k % 3 ? '#cfd8e8' : '#ffffff'); ctx.fillRect(x, y, 2, 1);
  });
  drawFlung(px, py + 3, 0, Math.PI, f.r + 6, 0.9, 2, 14, Math.min(1, u * 1.2), seed + 5, (x, y) => {
    ctx.fillStyle = FT_SNOW_D; ctx.fillRect(x, y + 1, 2, 1);
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(x, y, 2, 1);
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.defy = drawDefyFx;
// BREAK THE YOKE's wind-up: the sword's point lowered at the spot she strikes, and the
// cracks already starting from it
function drawYokeTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), len = teleLen(p.x, p.y, nx, ny, YOKE_SPD * YOKE_T);
  const x = Math.round(p.x + nx * (len + 8) - ex), y = Math.round(p.y + ny * (len + 8) - ey) + 2;
  ctx.fillStyle = 'rgba(40,52,90,0.35)'; fillEllipsePx(x, y, 4 + Math.round(4 * closing), 2 + Math.round(closing));
  drawCracks(x, y, 6, YOKE_R, 0.25 + 0.5 * closing, p.id * 17, FT_INK, '#ffffff');
}
// its landing: the ground struck, the crust broken out to the reach and across her line
function drawYokeFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
  ctx.fillStyle = '#7f98bc'; fillEllipsePx(px, py + 2, 5, 2);
  drawCracks(px, py + 2, 7, f.r, Math.min(1, u * 5), seed, FT_INK, '#ffffff');
  drawFlung(px, py + 2, 0, Math.PI, f.r * 0.8, 0.4, 8, 10, Math.min(1, u * 1.4), seed, (x, y) => {
    ctx.fillStyle = FT_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(x, y, 1, 1);
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.yoke = drawYokeFx;
// NO KNEELING's wind-up: her shadow on the spot she comes down on, darker and wider as
// she crouches, its heart (where bodies are thrown up) already splitting
function drawNoKneelTele(p, closing, ex, ey) {
  const [tx, ty] = noKneelAt(p), x = Math.round(tx - ex), y = Math.round(ty - ey) + 2;
  ctx.fillStyle = 'rgba(40,52,90,0.3)'; fillEllipsePx(x, y, Math.round(NOKNEEL_UP_R * (0.4 + 0.6 * closing)), Math.round(NOKNEEL_UP_R * 0.45 * (0.4 + 0.6 * closing)));
  drawCracks(x, y, 8, NOKNEEL_R, 0.2 + 0.4 * closing, p.id * 23, FT_INK, closing > 0.75 ? FT_GOLD : '#ffffff');
}
// its landing: a crater blown out where the sword came down, cracks out to the reach,
// snow and gold sparks thrown round
function drawNoKneelFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
  ctx.fillStyle = '#7f98bc'; fillEllipsePx(px, py + 3, NOKNEEL_UP_R - 6, Math.round(NOKNEEL_UP_R * 0.4));
  ctx.fillStyle = FT_SNOW_D; fillEllipsePx(px, py + 2, NOKNEEL_UP_R - 10, Math.round(NOKNEEL_UP_R * 0.3));
  drawCracks(px, py + 3, 9, f.r, Math.min(1, u * 5), seed, FT_INK, '#ffffff');
  drawFlung(px, py + 3, 0, Math.PI, f.r, 0.5, 16, 20, Math.min(1, u * 1.3), seed, (x, y, k) => {
    ctx.fillStyle = FT_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = k % 4 ? '#f4f7ff' : FT_GOLD; ctx.fillRect(x, y, 1, 1);
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.nokneel = drawNoKneelFx;

// ---- the greatsword in her hands -----------------------------------------------
// Her CHAIN GREATSWORD (HERO_BLADES.chain, js/draw/heroes.js), carried the way
// ARMATOS carries his: flat for the side, the swing and the wind-up, slanted
// from the right hip facing down, rising behind the shoulder facing up.
let fortSwordArt = null;
function fortSwords() {
  if (fortSwordArt) return fortSwordArt;
  return (fortSwordArt = { flat: bakeBladeArt(FORT_SWORD, FORT_SWORD_PAL), diag: bakeBladeArt(FORT_SWORD_DIAG, FORT_SWORD_PAL) });
}
HERO_BLADES.chain = { art: fortSwords, hilt: [19, 11], hip: { down: [13, 11], up: [11, 10] }, grip: FORT_GRIP, hold: 'far' };

// ---- on her body ------------------------------------------------------------------
function drawFortBody(p, ax, ay, now, front) {
  if (CLASSES[p.cls].passive !== 'unbroken') return;
  const cx = ax + 8, cy = ay + 10;
  // resolve high: two glints circling her waist, the near one drawn over her, the far behind
  if (p.resolve >= UNB_HIGH) {
    for (let k = 0; k < 2; k++) {
      const t = now * 3 + k * Math.PI, near = Math.sin(t) > 0;
      if (near !== front) continue;
      ctx.fillStyle = Math.floor(now * 8 + k) % 3 ? '#f2cc6a' : '#ffffff';
      ctx.fillRect(Math.round(cx + Math.cos(t) * 8), Math.round(cy + Math.sin(t) * 3), 1, 1);
    }
  }
  if (!front) return;
  // DEFIANT HEART: the shell, thinning as its clock runs out
  if (p.defyT > 0 && shieldOf(p, 'ward') > 0) {
    ctx.globalAlpha = 0.35 + 0.5 * Math.min(1, p.defyT / DEFY_T);
    ctx.fillStyle = '#f2cc6a';
    for (let i = 0; i < 20; i++) {
      if ((i + Math.floor(now * 10)) % 5 === 0) continue;
      const t = (i / 20) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(t) * 9), Math.round(ay + 8 + Math.sin(t) * 10), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  // NO KNEELING's after: embers rising off her shoulders
  if (p.nkT > 0) {
    for (let k = 0; k < 3; k++) {
      const u = (now * 1.5 + k / 3) % 1;
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = k % 2 ? '#f2cc6a' : '#ffd95c';
      ctx.fillRect(ax + (k === 1 ? 12 : 3 + k), Math.round(ay + 4 - u * 8), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
HERO_BODY_FX.push(drawFortBody);
