'use strict';
// ------------------------------------------------------------ aura
// AURA's pixels (her rules: js/sim/aura.js): her staff's star bolt in flight
// (HERO_SHOTS), and on the snow (HERO_GROUND) the FALLING STAR's ring filling
// in as the strike nears, the DRIFTING LIGHT's orb and its glow, and THE
// CURTAIN's band brightening until it falls. Both sides see all of it: the
// telegraph is the whole fairness of a strike from that far.

const AU_INK = '#0a0e23', AU_STAR = '#fff3b0', AU_WHITE = '#ffffff', AU_PALE = '#e6f8ff', AU_GREEN = '#86f0bf', AU_TEAL = '#2fae7c';

// ---- shots -----------------------------------------------------------------------
// her staff's STAR BOLT: a pale point with a short cooling tail
function drawStarBolt(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang);
  const x = Math.round(sx), y = Math.round(sy);
  ctx.fillStyle = '#7cc4e8';
  ctx.fillRect(Math.round(sx - nx * 5), Math.round(sy - ny * 5), 1, 1);
  ctx.fillStyle = AU_PALE;
  ctx.fillRect(Math.round(sx - nx * 3), Math.round(sy - ny * 3), 1, 1);
  ctx.fillStyle = AU_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = Math.sin(now * 22 + a.ox) > 0 ? AU_WHITE : AU_STAR;
  ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1);
}
HERO_SHOTS.starbolt = drawStarBolt;

// ---- on the snow --------------------------------------------------------------------
// the FALLING STAR's ring at (px, py): the rim, the small centre ring, and the
// hatch filling in as `fill` runs 0..1
function drawStarRing(px, py, col, alpha, fill) {
  drawRing(px, py, STAR_R, col, alpha, fill);
  drawRing(px, py, STAR_CORE, AU_WHITE, alpha * 0.9, 0);
}
// THE CURTAIN's band from (px, py) out along (nx, ny), `len` px: its two edges
// dashed, and lit between them as `fill` runs 0..1 (the fall's nearness)
function drawCurtainBand(px, py, nx, ny, len, col, alpha, fill) {
  const h = CURTAIN_HALF;
  ctx.globalAlpha = alpha;
  for (let s = 6; s <= len; s += 4) {
    const cx = px + nx * s, cy = py + ny * s;
    if (cx < -h - 4 || cy < -h - 4 || cx > WV_W + h + 4 || cy > WV_H + h + 4) continue;
    for (const k of [-h, h]) {
      const x = Math.round(cx - ny * k), y = Math.round(cy + nx * k);
      ctx.fillStyle = AU_INK; ctx.fillRect(x, y + 1, 2, 1);
      ctx.fillStyle = col; ctx.fillRect(x, y, 2, 1);
    }
  }
  if (fill > 0) {
    ctx.globalAlpha = alpha * 0.45 * fill;
    ctx.fillStyle = col;
    for (let s = 6; s <= len; s += 3) {
      const cx = px + nx * s, cy = py + ny * s;
      if (cx < -h - 4 || cy < -h - 4 || cx > WV_W + h + 4 || cy > WV_H + h + 4) continue;
      for (let k = -h + 2; k <= h - 2; k += 3) {
        if ((Math.round(s / 3) + Math.round(k / 3)) % 2) continue;
        ctx.fillRect(Math.round(cx - ny * k), Math.round(cy + nx * k), 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
// the stars waiting to fall, the orbs drifting, the curtains waiting to come down
function drawAuraGround(ex, ey, now) {
  for (const s of auraStars) {
    const px = Math.round(s.x - ex), py = Math.round(s.y - ey);
    if (px < -STAR_R - 4 || py < -STAR_R - 40 || px > WV_W + STAR_R + 4 || py > WV_H + STAR_R + 4) continue;
    const k = Math.min(1, s.t / s.delay);
    drawStarRing(px, py, AU_STAR, 0.55 + 0.4 * k, k);
    // the star itself, coming down onto its ring
    const h = Math.round(36 * (1 - k)), sx = px + Math.round(10 * (1 - k)), sy = py - h;
    ctx.fillStyle = AU_INK; ctx.fillRect(sx - 1, sy - 2, 3, 5); ctx.fillRect(sx - 2, sy - 1, 5, 3);
    ctx.fillStyle = AU_STAR; ctx.fillRect(sx, sy - 1, 1, 3); ctx.fillRect(sx - 1, sy, 3, 1);
    ctx.fillStyle = AU_WHITE; ctx.fillRect(sx, sy, 1, 1);
    ctx.fillStyle = AU_PALE; ctx.fillRect(sx + 1, sy - 2, 1, 1); ctx.fillRect(sx + 2, sy - 3, 1, 1);
  }
  for (const o of auraOrbs) {
    const px = Math.round(o.x - ex), py = Math.round(o.y - ey);
    if (px < -ORB_R - 4 || py < -ORB_R - 4 || px > WV_W + ORB_R + 4 || py > WV_H + ORB_R + 4) continue;
    // its glow on the snow under it, then the orb, breathing
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = AU_PALE;
    for (let y = -4; y <= 4; y++) { const w = Math.round(ORB_R * Math.sqrt(1 - (y / 5) ** 2)); ctx.fillRect(px - w, py + 8 + y, w * 2 + 1, 1); }
    ctx.globalAlpha = 1;
    const r = 2 + (Math.sin(now * 6 + o.x) > 0 ? 1 : 0);
    ctx.fillStyle = AU_INK; ctx.fillRect(px - r - 1, py - r, (r + 1) * 2 + 1, r * 2 + 1); ctx.fillRect(px - r, py - r - 1, r * 2 + 1, (r + 1) * 2 + 1);
    ctx.fillStyle = '#7cc4e8'; ctx.fillRect(px - r, py - r + 1, r * 2 + 1, r * 2 - 1); ctx.fillRect(px - r + 1, py - r, r * 2 - 1, r * 2 + 1);
    ctx.fillStyle = AU_PALE; ctx.fillRect(px - r + 1, py - r + 1, r * 2 - 1, r * 2 - 1);
    ctx.fillStyle = AU_WHITE; ctx.fillRect(px - 1, py - 1, 2, 2);
  }
  for (const c of auraCurtains) {
    const k = Math.min(1, c.t / c.delay);
    drawCurtainBand(c.x - ex, c.y - ey, c.nx, c.ny, c.len, AU_GREEN, 0.55 + 0.4 * k, k);
  }
}
HERO_GROUND.push(drawAuraGround);

// ---- the STAR SHARD ------------------------------------------------------------------
// Her staff (CLASSES' `staff: 'shard'`; HERO_STAVES, js/draw/heroes.js): a fallen star's
// pale shard bound in gold to a dark staff, carried upright; a glint walks up the shard
// between two frames. The hand closes on the shaft at AURA_SHARD_GRIP.
const AURA_SHARD = [
  '...o...',
  '..oCo..',
  '..oCco.',
  '.oCCco.',
  '.oCcco.',
  '.ocCco.',
  '..occo.',
  '..oco..',
  '.oyYyo.',
  '..oGo..',
  '..oGo..',
  '..oGo..',
  '..oGo..',
  '..oGo..',
  '..oGo..',
  '..oGo..',
  '..oGo..',
  '..oGo..',
  '..ogo..',
  '..ogo..',
  '...o...',
];
const AURA_SHARD_GRIP = [3, 12];
const AURA_SHARD_PAL = { o: '#2e2440', C: '#e6f8ff', c: '#7cc4e8', W: '#ffffff', y: '#f2cc6a', Y: '#b98a2e', g: '#3a2c40', G: '#5c4868' };
let auraShardArt = null;
function auraShard() {
  if (auraShardArt) return auraShardArt;
  const glint = AURA_SHARD.map((r, y) => (y === 3 ? '.oCWco.' : y === 1 ? '..oWo..' : r));
  auraShardArt = [bakeBladeArt(AURA_SHARD, AURA_SHARD_PAL), bakeBladeArt(glint, AURA_SHARD_PAL)];
  return auraShardArt;
}
HERO_STAVES.shard = { art: auraShard, grip: AURA_SHARD_GRIP };
