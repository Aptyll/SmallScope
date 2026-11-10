'use strict';
// ------------------------------------------------------------ lignum
// LIGNUM's pixels (his rules: js/sim/lignum.js): his felling axe in his hands
// (HERO_BLADES), the hand axe out and stuck (HERO_AIR), the felled trunk on
// the snow (HERO_GROUND), and the bark on him while he hardens (HERO_BODY_FX).

const LG_INK = '#141a2c', LG_BARK = '#6e4a28', LG_BARK_L = '#a8794a', LG_PINE = '#2f5c4b', LG_PINE_L = '#3f7a5c';
const LG_FALL = 0.15; // s the trunk takes to come down

// ---- the felling axe in his hands -------------------------------------------------------
let lignumAxeArt = null;
function lignumAxeArtOf() {
  return lignumAxeArt || (lignumAxeArt = { flat: bakeBladeArt(LIGNUM_AXE, LIGNUM_AXE_PAL), diag: bakeBladeArt(LIGNUM_AXE_DIAG, LIGNUM_AXE_PAL) });
}
HERO_BLADES.felling = { art: lignumAxeArtOf, hilt: [14, 9], hip: { down: [13, 12], up: [11, 10] }, grip: LIGNUM_AXE_GRIP, hold: 'shoulder' };

// ---- the hand axe: turning in flight, still in what it struck ------------------------------
function drawLignumAxe(w, ex, ey, now) {
  const x = Math.round(w.x - ex), y = Math.round(w.y - ey);
  if (!w.stuck) { ctx.globalAlpha = 0.3; ctx.fillStyle = LG_INK; ctx.fillRect(x - 1, y + BOW_Y, 3, 1); ctx.globalAlpha = 1; }
  const a = w.stuck ? Math.atan2(w.ny, w.nx) : now * 18, c = Math.cos(a), s = Math.sin(a);
  for (let k = -2; k <= 3; k++) { // the haft
    const px = Math.round(x - c * k), py = Math.round(y - s * k);
    ctx.fillStyle = LG_INK; ctx.fillRect(px, py + 1, 1, 1);
    ctx.fillStyle = LG_BARK_L; ctx.fillRect(px, py, 1, 1);
  }
  for (let k = -1; k <= 1; k++) { // the bit, across the haft's head
    const px = Math.round(x + c * 2 - s * k), py = Math.round(y + s * 2 + c * k);
    ctx.fillStyle = LG_INK; ctx.fillRect(px, py + 1, 1, 1);
    ctx.fillStyle = k === 0 ? '#e6ebf2' : '#c8d2e4'; ctx.fillRect(px, py, 1, 1);
  }
  if (w.stuck && Math.floor(now * 4) % 2 === 0) { ctx.fillStyle = '#d9a648'; ctx.fillRect(x, y - 4, 1, 1); } // waiting for the pull
}
function drawLignumAir(ex, ey, now) { for (const w of lignumAxes) drawLignumAxe(w, ex, ey, now); }

// ---- the felled trunk ---------------------------------------------------------------------
// a trunk 5 px thick from the stump end to the crown, bark ridges along it and the crown's
// green at its far end; it falls over LG_FALL and sinks into the snow at the end of its life
function drawLignumLog(g, ex, ey) {
  const len = g.len * Math.min(1, g.t / LG_FALL), px = -g.ny, py = g.nx;
  const left = g.life - g.t, alpha = Math.min(1, left * 3);
  ctx.globalAlpha = alpha;
  const pass = (half, col, from, to) => {
    for (let s = from; s <= to; s += 1) {
      for (let k = -half; k <= half; k++) {
        const x = Math.round(g.x0 + g.nx * s + px * k - ex), y = Math.round(g.y0 + g.ny * s + py * k - ey);
        ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
      }
    }
  };
  const crown = Math.max(0, len - 26);
  pass(3, LG_INK, 0, crown); pass(2, LG_BARK, 0, crown);
  for (let s = 3; s < crown; s += 5) { // the bark's ridges
    const x = Math.round(g.x0 + g.nx * s - px - ex), y = Math.round(g.y0 + g.ny * s - py - ey);
    ctx.fillStyle = LG_BARK_L; ctx.fillRect(x, y, 2, 1);
  }
  if (len > crown) { pass(5, LG_INK, crown, len); pass(4, LG_PINE, crown, len); pass(2, LG_PINE_L, crown + 2, len - 2); }
  ctx.globalAlpha = 1;
}
function drawLignumGround(ex, ey) { for (const g of lignumLogs) drawLignumLog(g, ex, ey); }

// ---- on his body ----------------------------------------------------------------------------
// bark plates over his shoulders and chest while he hardens; brighter beside a pine
function drawLignumFx(p, ax, ay, now, front) {
  if (!front || CLASSES[p.cls].passive !== 'treeline' || !(p.barkT > 0)) return;
  ctx.globalAlpha = Math.min(1, p.barkT * 3) * 0.85;
  ctx.fillStyle = LG_BARK; ctx.fillRect(ax + 3, ay + 8, 2, 3); ctx.fillRect(ax + 11, ay + 8, 2, 3);
  ctx.fillStyle = LG_BARK_L; ctx.fillRect(ax + 3, ay + 8, 1, 2); ctx.fillRect(ax + 11, ay + 8, 1, 2);
  if (pineBeside(p) && Math.floor(now * 6) % 2 === 0) { ctx.fillStyle = LG_PINE_L; ctx.fillRect(ax + 7, ay + 9, 2, 1); }
  ctx.globalAlpha = 1;
}

HERO_AIR.push(drawLignumAir);
HERO_GROUND.push(drawLignumGround);
HERO_BODY_FX.push(drawLignumFx);
