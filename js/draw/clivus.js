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
HERO_BLADES.iceaxe = { smear: 'chop', art: clivusAxeArtOf, hilt: [13, 9], hip: { down: [13, 11], up: [11, 10] }, grip: CLIVUS_AXE_GRIP };

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
// the rope round (cx, cy) at radius r from bearing a0 to a1, a pixel wide, twisted
function drawRopeArc(cx, cy, r, a0, a1) {
  const n = Math.ceil(Math.abs(a1 - a0) * r);
  for (let k = 0; k <= n; k++) {
    const a = a0 + (a1 - a0) * k / Math.max(1, n), x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
    ctx.fillStyle = CL_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = k % 3 === 0 ? CL_ROPE_D : CL_ROPE; ctx.fillRect(x, y, 1, 1);
  }
}
// a stake standing on (x, y) with its side's colour tied on, h px out of the snow
function drawClivusStake(x, y, col, h) {
  ctx.fillStyle = CL_INK; ctx.fillRect(x - 1, y - h - 1, 3, h + 2);
  ctx.fillStyle = CL_STAKE; ctx.fillRect(x, y - h, 1, h + 1);
  if (h > 2) { ctx.fillStyle = col; ctx.fillRect(x, y - h + 1, 1, 1); }
}
function drawClivusRing(g, ex, ey, now) {
  const left = g.life - g.t;
  if (left < 0.5 && Math.floor(now * 10) % 2 === 0) return;
  const cx = g.x - ex, cy = g.y - ey, r = g.r * Math.min(1, 0.4 + 0.6 * g.t / CL_UP);
  drawRopeArc(cx, cy, r, 0, 2 * Math.PI);
  const col = TEAMS[skin(g.team)].mark;
  for (let k = 0; k < 8; k++) drawClivusStake(Math.round(cx + Math.cos(k * Math.PI / 4) * r), Math.round(cy + Math.sin(k * Math.PI / 4) * r), col, 4);
}
// ROPE RING's wind-up: he drives the stakes one by one round him, each going in with a
// puff of snow, and the rope is strung from each to the next as it stands
function drawRingTele(p, px, py, closing) {
  const col = TEAMS[skin(p.team)].mark, cy = py + 2, n = Math.min(8, Math.floor(closing * 9));
  for (let k = 0; k < n; k++) {
    const a = k * Math.PI / 4, x = Math.round(px + Math.cos(a) * RING_R), y = Math.round(cy + Math.sin(a) * RING_R);
    if (k > 0) drawRopeArc(px, cy, RING_R, (k - 1) * Math.PI / 4, a);
    const fresh = closing * 9 - k < 1;
    drawClivusStake(x, y, col, fresh ? 6 : 4); // a fresh one stands tall till it is driven home
    if (fresh) { ctx.fillStyle = '#f4f7ff'; ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); }
  }
}

// ---- ROPE ------------------------------------------------------------------------------
// the wind-up: the weighted end whirled over his head, and the rope paid out loose on the
// snow down the aim, straightening and reaching its full throw as he lets go
function drawRopeTele(p, a, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a);
  const hx = Math.round(p.x + nx * 12 - ex), hy = Math.round(p.y - 4 + ny * 8 - ey);
  for (let k = 0; k < 24; k++) { // the loop he whirls at his side
    const t = k / 24 * Math.PI * 2, x = Math.round(hx + Math.cos(t) * 8), y = Math.round(hy + Math.sin(t) * 4);
    ctx.fillStyle = CL_INK; ctx.fillRect(x, y + 1, 2, 1);
    ctx.fillStyle = k % 3 ? CL_ROPE : CL_ROPE_D; ctx.fillRect(x, y, 2, 1);
  }
  const w = now * 16, wx = Math.round(hx + Math.cos(w) * 8), wy = Math.round(hy + Math.sin(w) * 4);
  ctx.fillStyle = CL_INK; ctx.fillRect(wx - 2, wy - 2, 4, 4);
  ctx.fillStyle = CL_STEEL; ctx.fillRect(wx - 1, wy - 1, 2, 2);
  const L = teleLen(p.x, p.y, nx, ny, ROPE_RANGE) * (0.3 + 0.7 * closing);
  const loose = 3 * (1 - closing);
  ctx.globalAlpha = 0.5 + 0.45 * closing;
  for (let s = 8; s < L; s++) {
    const wig = Math.sin(s * 0.22 + now * 6) * loose;
    const x = Math.round(p.x + nx * s - ny * wig - ex), y = Math.round(p.y + ny * s + nx * wig - ey);
    ctx.fillStyle = CL_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = s % 3 ? CL_ROPE : CL_ROPE_D; ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

// ---- VAULT -----------------------------------------------------------------------------
// while he is up: his shadow on the spot he comes down on, growing as he falls, and the
// snow there cracking out as far as the landing strikes
function drawVaultMark(p, ex, ey) {
  const prog = Math.min(1, 1 - p.rushT / (p.clVaultT || 1)), x = Math.round(p.reelX - ex), y = Math.round(p.reelY + 3 - ey);
  ctx.fillStyle = 'rgba(30,40,80,0.45)'; fillEllipsePx(x, y, 4 + Math.round(5 * prog), 2 + Math.round(2 * prog));
  drawCracks(x, y, 7, VAULT_HIT_R, 0.3 + 0.7 * prog, p.id * 31, '#2f5f8f', '#ffffff');
}
// the landing: the snow splashed up and out where he struck, cracks through the crust
const VAULT_SPLASH = 14;
function drawVaultFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  ctx.globalAlpha = Math.min(1, 2 * (1 - u));
  ctx.fillStyle = '#9fb6d8'; fillEllipsePx(px, py + 3, 7, 3);
  drawCracks(px, py + 3, 7, f.r, 1, seed, '#2f5f8f', '#ffffff');
  drawFlung(px, py + 3, 0, Math.PI, f.r + 4, 0.45, 10, VAULT_SPLASH, Math.min(1, u * 1.4), seed, (x, y) => {
    ctx.fillStyle = CL_INK; ctx.fillRect(x - 1, y - 1, 4, 4);
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(x, y - 1, 2, 2);
    ctx.fillStyle = '#9fb6d8'; ctx.fillRect(x, y + 1, 2, 1);
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.vault = drawVaultFx;

// ---- PICK STRIKE ------------------------------------------------------------------------
// the ice axe's cut: a steel crescent swept through the wedge, ice chips knocked out of
// it, and the pick's three bites left in the crust at the end of its reach
function drawPickFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  if (u > 0.2) {
    ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
    for (const da of [-0.4, 0, 0.4]) {
      const c = Math.cos(f.a + da), s = Math.sin(f.a + da);
      for (let k = f.r - 9; k <= f.r - 3; k++) {
        ctx.fillStyle = '#2f5f8f'; ctx.fillRect(Math.round(px + c * k), Math.round(py + 2 + s * k), 2, 1);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px + c * k), Math.round(py + 3 + s * k), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  drawSwoosh(px, py, f.a, f.r, f.half, u, 8, [CL_INK, '#ffffff', '#8fb4dc'], 1);
  drawFlung(px, py, f.a, f.half * 0.8, f.r + 8, 0.6, 7, 8, Math.min(1, u * 1.5), seed, (x, y) => {
    ctx.fillStyle = CL_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = '#a8dcf7'; ctx.fillRect(x, y, 1, 1);
  });
}
AB_FX_LOOK.pick = drawPickFx;

function drawClivusGround(ex, ey, now) {
  for (const g of clivusRings) drawClivusRing(g, ex, ey, now);
  for (const p of players) if (p.active && !p.dead && p.rushT > 0 && p.dash === 'vault') drawVaultMark(p, ex, ey);
}

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
