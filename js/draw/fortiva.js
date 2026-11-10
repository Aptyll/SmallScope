'use strict';
// ------------------------------------------------------------ fortiva
// FORTIVA's pixels (her rules: js/sim/fortiva.js): the shapes her keys put on the
// snow while they wind up, her greatsword, and what her state wears on her body - resolve high
// as gold glints circling her, DEFIANT HEART's shield as her chains worn crossed in gold and a gold heart
// plate on her chest that cracks as it is spent, NO KNEELING's after as embers off her shoulders.

const FT_INK = '#141a2c', FT_GOLD = '#f2cc6a', FT_GOLD_D = '#a9781f', FT_STEEL = '#c3ccd8', FT_SNOW_D = '#9fb6d8';
// a broken piece of chain: a link lying flat (a lit oval) with the next one through it
// edge-on, steel or gold, solid; (x, y) the flat link's top-left
function ftLink(x, y, col) {
  const d = col === FT_GOLD ? FT_GOLD_D : '#6f7f96';
  ctx.fillStyle = col; ctx.fillRect(x, y, 2, 1); ctx.fillRect(x - 1, y + 1, 3, 1);
  ctx.fillStyle = d; ctx.fillRect(x, y + 2, 2, 1); ctx.fillRect(x + 2, y + 1, 2, 1);
  ctx.fillStyle = FT_INK; ctx.fillRect(x + 2, y + 2, 1, 1);
}
// SEVER THE CHAINS' wind-up: the sword is cocked back, and its chain pays out behind
// her along the line the cut starts from, longer as she draws, gold once it is taut
function drawSeverTele(p, px, py, a, closing) {
  const t = a - SEVER_HALF, nx = Math.cos(t), ny = Math.sin(t) * 0.9, len = SEVER_R * (0.3 + 0.7 * closing);
  const col = closing > 0.75 ? FT_GOLD : FT_STEEL, d = closing > 0.75 ? FT_GOLD_D : '#6f7f96';
  for (let s = 9; s < len; s++) {
    const x = Math.round(px + nx * s), y = Math.round(py + 2 + ny * s);
    ctx.fillStyle = FT_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = s % 4 < 2 ? col : d; ctx.fillRect(x, y, 1, 1); // link, link, the next one edge-on
  }
  ftLink(Math.round(px + nx * len) - 1, Math.round(py + 2 + ny * len) - 1, col); // its loose end
}
// its landing: the cut swept through the arc, gold at its edge, and the chain broken
// at the rim, links thrown off it
function drawSeverFx(f, px, py, now) {
  const u = f.t / f.life;
  drawSwoosh(px, py, f.a, f.r, f.half, u, 9, [FT_INK, '#ffffff', FT_GOLD], 1);
  drawFlung(px, py + 2, f.a, f.half, f.r + 14, 0.45, 8, 5, Math.min(1, u * 1.5), fxSeed(f), (x, y, k) => ftLink(x - 1, y - 1, k % 3 ? FT_STEEL : FT_GOLD));
}
AB_FX_LOOK.sever = drawSeverFx;
// DEFIANT HEART's wave: the gold shell round her burst, its shards thrown out to
// the reach, grey when it took nothing, and the snow blown back behind them
function drawDefyFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f), gold = f.col === FT_GOLD;
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
  drawFlung(px, py, 0, Math.PI, f.r, 0.7, 6, 18, Math.min(1, u * 1.6), seed, (x, y, k) => {
    if (gold && k % 3 === 0) ftLink(x - 1, y - 1, FT_GOLD); // a paid shell throws its links
    else fxChip(x, y - 1, k, gold ? '#ffe9a8' : '#f4f7ff', gold ? FT_GOLD_D : '#7f98bc', FT_INK);
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
  drawFlung(px, py + 2, 0, Math.PI, f.r * 0.8, 0.4, 8, 10, Math.min(1, u * 1.4), seed, (x, y, k) => fxChip(x, y - 1, k, '#f4f7ff', '#7f98bc', FT_INK));
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
  // the crust thrown up at every distance out, a few of her links among the lumps: the cracks are the shape
  drawFlung(px, py + 3, 0, Math.PI, f.r, 0.1, 16, 11, Math.min(1, u * 1.3), seed, (x, y, k) => {
    if (k % 5 === 0) ftLink(x - 1, y - 1, FT_GOLD); else fxChip(x, y - 1, k, '#f4f7ff', '#7f98bc', FT_INK);
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
// ...and at 32 px for her fine body (FORT_SWORD_FINE), the grips the same world px
let fortSwordFine = null;
function fortSwordsFine() {
  if (fortSwordFine) return fortSwordFine;
  const tag = (c) => { c.dens = 2; return c; };
  return (fortSwordFine = { flat: tag(bakeBladeArt(FORT_SWORD_FINE, FORT_SWORD_PAL)), diag: tag(bakeBladeArt(FORT_SWORD_DIAG_FINE, FORT_SWORD_PAL)) });
}
HERO_BLADES.chain = { art: fortSwords, fine: fortSwordsFine, hilt: [19, 11], hip: { down: [13, 11], up: [11, 10] }, grip: FORT_GRIP, hold: 'far' };

// ---- on her body ------------------------------------------------------------------
// DEFIANT HEART's plate: a small gold heart, inked, lit on its left lobe, shaded on its right, narrow enough that
// her coat shows her side's colour either side of it; (x, y) its top middle. `cracks` 0-2 ink px run down it as
// the shield is spent; `lit` whitens it for a frame.
const HEART_PLATE = ['.o.o.', 'oWoGo', 'oGGgo', '.oGo.', '..o..'];
function drawHeartPlate(x, y, cracks, lit) {
  const pal = { o: FT_INK, G: lit ? '#fff3b0' : FT_GOLD, g: FT_GOLD_D, W: '#ffffff' };
  for (let r = 0; r < 5; r++) for (let i = 0; i < 5; i++) {
    const ch = HEART_PLATE[r][i];
    if (ch !== '.') { ctx.fillStyle = pal[ch]; ctx.fillRect(x - 2 + i, y + r, 1, 1); }
  }
  ctx.fillStyle = FT_INK;
  if (cracks > 0) ctx.fillRect(x, y + 2, 1, 1); // a crack down from the notch
  if (cracks > 1) ctx.fillRect(x + 1, y + 1, 1, 1); // ...and a lobe gone dark
}
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
  // DEFIANT HEART: her chest thrown out with a flash as it starts and links bursting off her, then, for as
  // long as it holds, her chains worn down from her shoulders in gold, two px thick, and on her chest where
  // they meet a gold heart plate. The plate is the shield: it cracks once it has lost a third and again at two
  // thirds. From behind only the crossed chains show.
  if (p.defyT > 0 && shieldOf(p, 'ward') > 0) {
    const age = DEFY_T - p.defyT, side = p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0, hx = ax + 8 + side, hy = ay + 10;
    const glint = Math.floor(now * 8) % 12; // a light running down the chains now and then
    for (let s = -4; s <= 4; s++) for (const d of [1, -1]) { // the crossed chains
      const x = hx + s, y = hy + s * d;
      if (y > hy && p.dir !== 'up') continue; // in front they run shoulder to plate only, so her coat below it keeps her side's colour
      ctx.fillStyle = FT_INK; ctx.fillRect(x, y + 2, 1, 1);
      ctx.fillStyle = s + 4 === glint ? '#ffffff' : (s & 1) ? FT_GOLD : '#ffe08a'; ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = (s & 1) ? FT_GOLD_D : FT_GOLD; ctx.fillRect(x, y + 1, 1, 1);
    }
    if (p.dir !== 'up') {
      const left = shieldOf(p, 'ward') / Math.max(1, p.defyHp);
      drawHeartPlate(hx, hy - 2, left < 0.67 ? (left < 0.34 ? 2 : 1) : 0, glint === 6);
    }
    if (age < 0.3) {
      const u = age / 0.3, k = Math.round(4 * (1 - u));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(hx - k, hy, 2 * k + 1, 1); ctx.fillRect(hx, hy - k, 1, 2 * k + 1); // the flash on her heart
      drawFlung(hx, hy + 4, 0, Math.PI, 16, 0.5, 7, 5, u, p.id * 29, (x, y) => ftLink(x - 1, y - 1, FT_GOLD));
    }
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
