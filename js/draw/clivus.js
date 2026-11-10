'use strict';
// ------------------------------------------------------------ clivus
// CLIVUS's pixels (his rules: js/sim/clivus.js): his ice axe in his hands
// (HERO_BLADES), his rope out and tied (HERO_AIR), the rope ring on its stakes
// (HERO_GROUND), and the foothold readied on him (HERO_BODY_FX).

const CL_INK = '#141a2c', CL_ROPE = '#d2b07a', CL_ROPE_D = '#8a6a40', CL_STAKE = '#6e4a28', CL_STEEL = '#c8d2e4';

// ---- the ice axe in his hands ----------------------------------------------------------
let clivusAxeArt = null;
function clivusAxeArtOf() {
  return clivusAxeArt || (clivusAxeArt = { flat: bakeBladeArt(CLIVUS_AXE, CLIVUS_AXE_PAL), diag: bakeBladeArt(CLIVUS_AXE_DIAG, CLIVUS_AXE_PAL) });
}
HERO_BLADES.iceaxe = { art: clivusAxeArtOf, hilt: [13, 9], hip: { down: [13, 12], up: [11, 10] }, grip: CLIVUS_AXE_GRIP };

// ---- the rope: from his hands to its weight, or to the hero it is tied to ----------------------
// one pixel wide, light and dark in turn so it reads as twisted; it sags while it flies and
// pulls straight once tied, and blinks as the tie runs out
function drawClivusRope(w, ex, ey, now) {
  const o = players[w.owner];
  if (!o || o.dead) return;
  const x0 = o.x - ex, y0 = o.y - BOW_Y - ey, x1 = w.x - ex, y1 = w.y - ey;
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(len));
  const sag = w.on >= 0 ? 0 : Math.min(6, len * 0.05);
  if (w.on >= 0 && w.t > ROPE_TIE - 0.5 && Math.floor(now * 10) % 2 === 0) return; // about to root
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * sag);
    ctx.fillStyle = CL_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = k % 3 === 0 ? CL_ROPE_D : CL_ROPE; ctx.fillRect(x, y, 1, 1);
  }
  if (w.on < 0) { // the weighted end
    const x = Math.round(x1), y = Math.round(y1);
    ctx.fillStyle = CL_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = CL_STEEL; ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x - 1, y, 2, 1);
  }
}
function drawClivusAir(ex, ey, now) { for (const w of clivusRopes) drawClivusRope(w, ex, ey, now); }

// ---- the rope ring ---------------------------------------------------------------------------
// the rope round on the snow one pixel wide, eight stakes standing out of it; it goes up over
// CL_UP, and blinks its last half second
const CL_UP = 0.15;
function drawClivusRing(g, ex, ey, now) {
  const left = g.life - g.t;
  if (left < 0.5 && Math.floor(now * 10) % 2 === 0) return;
  const cx = g.x - ex, cy = g.y - ey, r = g.r * Math.min(1, 0.4 + 0.6 * g.t / CL_UP);
  const n = Math.ceil(2 * Math.PI * r);
  for (let k = 0; k < n; k++) {
    const a = k / n * 2 * Math.PI, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
    ctx.fillStyle = CL_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = k % 3 === 0 ? CL_ROPE_D : CL_ROPE; ctx.fillRect(x, y, 1, 1);
  }
  const col = TEAMS[skin(g.team)].mark;
  for (let k = 0; k < 8; k++) { // the stakes, each with its side's colour tied on
    const a = k * Math.PI / 4, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
    ctx.fillStyle = CL_INK; ctx.fillRect(x - 1, y - 5, 3, 6);
    ctx.fillStyle = CL_STAKE; ctx.fillRect(x, y - 4, 1, 5);
    ctx.fillStyle = col; ctx.fillRect(x, y - 3, 1, 1);
  }
}
function drawClivusGround(ex, ey, now) { for (const g of clivusRings) drawClivusRing(g, ex, ey, now); }

// ---- on his body -------------------------------------------------------------------------------
// the foothold readied: a glint running up the rope over his chest
function drawClivusFx(p, ax, ay, now, front) {
  if (!front || !(p.clFootT > 0) || !isClivus(p)) return;
  const k = Math.floor(now * 8) % 4;
  ctx.fillStyle = '#f4f7ff';
  ctx.fillRect(ax + (p.dir === 'up' ? 4 + k : 10 - k), ay + 8 + k, 1, 1);
}

HERO_AIR.push(drawClivusAir);
HERO_GROUND.push(drawClivusGround);
HERO_BODY_FX.push(drawClivusFx);
