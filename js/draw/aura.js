'use strict';
// ------------------------------------------------------------ aura
// AURA's pixels (her rules: js/sim/aura.js): her staff's star bolt in flight
// (HERO_SHOTS), and on the snow (HERO_GROUND) the FALLING STAR's light pooling
// as the strike nears, the DRIFTING LIGHT's orb and its glow, and THE
// CURTAIN's ribbons rising until it falls. Both sides see all of it: the
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
// a four-point twinkle at (x, y), `r` px out each way
function auTwinkle(x, y, r, col) {
  ctx.fillStyle = col === AU_STAR ? '#a8771c' : '#3f73b0'; ctx.fillRect(x - r, y - 1, 2 * r + 1, 3); ctx.fillRect(x - 1, y - r, 3, 2 * r + 1); // rimmed in its own colour's shade, never black
  ctx.fillStyle = col; ctx.fillRect(x - r + 1, y, 2 * r - 1, 1); ctx.fillRect(x, y - r + 1, 1, 2 * r - 1);
  ctx.fillStyle = AU_WHITE; ctx.fillRect(x, y, 1, 1);
}
// the FALLING STAR's light on the snow at (px, py), `k` 0..1 the fall's nearness: the
// snow under it catching the starlight in sparkles, more of them and nearer the
// heart as it comes down, and a glint growing where it strikes
function drawStarPool(px, py, k, now) {
  const n = 10 + Math.round(22 * k);
  for (let i = 0; i < n; i++) {
    if ((Math.floor(now * 7) + i * 3) % 5 === 0) continue; // each one winks
    const t = fxRoll(4099, i, 1) * Math.PI * 2, d = STAR_R * Math.sqrt(fxRoll(4099, i, 2)) * (1 - 0.3 * k);
    const x = Math.round(px + Math.cos(t) * d), y = Math.round(py + Math.sin(t) * d);
    if (i % 3) fxMote(x, y, i % 2 ? AU_STAR : '#c6ecff', i % 2 ? '#d9a93a' : '#4f9bd6');
    else { ctx.fillStyle = '#b98a2e'; ctx.fillRect(x, y + 1, 2, 1); ctx.fillStyle = '#e8c25a'; ctx.fillRect(x, y, 2, 1); }
  }
  if (k > 0.12) auTwinkle(px, py, 2 + Math.round(3 * k), AU_STAR);
}
// its strike: a flash at the heart, rays of light out to the reach, sparks thrown
function drawStarFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f), go = Math.min(1, u * 4);
  ctx.globalAlpha = Math.max(0, 1 - u);
  ctx.fillStyle = AU_WHITE; fillEllipsePx(px, py, Math.round(STAR_CORE * (1 - u)), Math.round(STAR_CORE * (1 - u)));
  for (let i = 0; i < 8; i++) {
    const t = i * Math.PI / 4 + 0.2, c = Math.cos(t), sn = Math.sin(t);
    for (let r = STAR_CORE * go; r < f.r * go; r++) {
      ctx.fillStyle = r > f.r * go - 4 ? AU_WHITE : AU_STAR; ctx.fillRect(Math.round(px + c * r), Math.round(py + sn * r), 1, 1);
    }
  }
  drawFlung(px, py, 0, Math.PI, f.r + 6, 0.5, 12, 12, Math.min(1, u * 1.3), seed, (x, y, k) => fxMote(x, y, k % 2 ? AU_STAR : '#c6ecff', k % 2 ? '#d9a93a' : '#4f9bd6'));
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.star = drawStarFx;
// a band of light laid from (px, py) out along (nx, ny), `len` px, `h` either side:
// drawn as one span a column (or a row) so it is solid, with no seams
function auBand(px, py, nx, ny, len, h, col, alpha) {
  const flat = Math.abs(nx) >= Math.abs(ny), w = Math.round(h / Math.max(Math.abs(nx), Math.abs(ny)));
  ctx.globalAlpha = alpha; ctx.fillStyle = col;
  const step = 1 / Math.max(Math.abs(nx), Math.abs(ny));
  for (let s = 6; s <= len; s += step) {
    const x = Math.round(px + nx * s), y = Math.round(py + ny * s);
    if (x < -w - 2 || y < -w - 2 || x > WV_W + w + 2 || y > WV_H + w + 2) continue;
    if (flat) ctx.fillRect(x, y - w, 1, 2 * w + 1); else ctx.fillRect(x - w, y, 2 * w + 1, 1);
  }
  ctx.globalAlpha = 1;
}
// DRIFTING LIGHT's wind-up: a glint running out along the snow the way the orb will
// drift, further each time as she readies it, and the orb gathering at her staff
function drawOrbTele(p, px, py, a, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), len = auraReach(p, ORB_LEN) * (0.3 + 0.7 * closing);
  const u = (now * 1.6) % 1, gx = p.x - ex, gy = p.y + 6 - ey;
  for (let j = 3; j >= 0; j--) { // the glint and the light it leaves behind it
    const s = 10 + (len - 10) * (u - j * 0.07);
    if (s < 10) continue;
    const x = Math.round(gx + nx * s), y = Math.round(gy + ny * s);
    if (j === 0) auTwinkle(x, y, 2, AU_PALE); else fxMote(x, y, '#c6ecff', '#4f9bd6');
  }
  const r = 1 + Math.round(2 * closing), x = Math.round(px + nx * 10), y = Math.round(py - 8 + ny * 6);
  auDisc(x, y, r + 1, AU_INK); auDisc(x, y, r, '#7cc4e8'); if (r > 1) auDisc(x, y, r - 1, AU_WHITE);
}
// STEP OF LIGHT's going: motes of light left rising off the snow where she stood
function drawStepFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  for (let k = 0; k < 16; k++) {
    const t = fxRoll(seed, k, 1) * Math.PI * 2, d = f.r * Math.sqrt(fxRoll(seed, k, 2));
    const x = Math.round(px + Math.cos(t) * d), y = Math.round(py + Math.sin(t) * d - u * (14 + 10 * fxRoll(seed, k, 3)));
    ctx.globalAlpha = Math.max(0, 1 - u * (0.8 + 0.4 * fxRoll(seed, k, 4)));
    if (k % 4) { ctx.fillStyle = '#7cc4e8'; ctx.fillRect(x, y + 1, 2, 1); ctx.fillStyle = k % 3 ? AU_WHITE : AU_STAR; ctx.fillRect(x, y, 2, 1); }
    else fxMote(x, y, '#c6ecff', '#4f9bd6');
  }
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.step = drawStepFx;
// THE CURTAIN gathering over its band from (px, py) out along (nx, ny), `len` px,
// `k` 0..1 the fall's nearness: the snow under it lit, and short ribbons of light
// beginning to stand up off it, taller as the fall nears
function drawCurtainRise(px, py, nx, ny, len, k, now) {
  auBand(px, py, nx, ny, len, CURTAIN_HALF, AU_GREEN, 0.12 + 0.18 * k);
  const h = Math.round(8 + 18 * k);
  for (let s = 6, i = 0; s <= len; s += 6, i++) {
    const bx = px + nx * s, by = py + ny * s;
    if (bx < -10 || bx > WV_W + 10 || by < -4 || by > WV_H + h + 4) continue;
    const sway = Math.sin(now * 3 + i * 0.7);
    for (let y = 0; y < h; y++) {
      const t = y / h;
      ctx.globalAlpha = (0.6 + 0.4 * k) * (1 - t * 0.7);
      ctx.fillStyle = t < 0.3 ? AU_PALE : i % 3 ? AU_GREEN : AU_TEAL;
      ctx.fillRect(Math.round(bx + sway * t), Math.round(by - y - (i % 3) * 2), 2, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// its fall: the band's snow flashed white, gone in a beat
function drawCurtainFx(f, px, py, now) {
  const u = f.t / f.life;
  auBand(px, py, Math.cos(f.a), Math.sin(f.a), f.r, f.half, AU_WHITE, 0.6 * (1 - u));
}
AB_FX_LOOK.curtain = drawCurtainFx;
// a round blot of `r` px at (px, py), one row at a time
function auDisc(px, py, r, col) {
  ctx.fillStyle = col;
  for (let y = -Math.floor(r); y <= Math.floor(r); y++) { const w = Math.floor(Math.sqrt(r * r - y * y) + 0.35); ctx.fillRect(px - w, py + y, w * 2 + 1, 1); }
}
// THE CURTAIN coming down: ribbons of light standing up off the band, swaying,
// fading out over CURTAIN_GLOW (`k` 0..1 through it)
function drawCurtainFall(c, ex, ey, now, k) {
  const a = 1 - k, h = Math.round(30 + 26 * (1 - k));
  for (let s = 6, i = 0; s <= c.len; s += 7, i++) {
    const bx = c.x + c.nx * s - ex, by = c.y + c.ny * s - ey;
    if (bx < -10 || bx > WV_W + 10 || by < -4 || by > WV_H + h + 4) continue;
    const sway = Math.sin(now * 3 + i * 0.7) * 2;
    for (let y = 0; y < h; y += 1) {
      const t = y / h, x = Math.round(bx + sway * t);
      ctx.globalAlpha = a * (1 - t) * 0.8;
      ctx.fillStyle = t < 0.25 ? AU_PALE : i % 3 ? AU_GREEN : AU_TEAL;
      ctx.fillRect(x, Math.round(by - y), i % 2 ? 1 : 2, 1);
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
    drawStarPool(px, py, k, now);
    // the star itself, coming down onto its ring
    const h = Math.round(36 * (1 - k)), sx = px + Math.round(10 * (1 - k)), sy = py - h;
    for (let j = 2; j <= 16; j++) { // its streak, back up the way it came, thinning
      const tx = sx + Math.round(j * 0.3), ty = sy - j;
      ctx.fillStyle = '#3f73b0'; ctx.fillRect(tx - 1, ty, j < 9 ? 3 : 2, 1);
      ctx.fillStyle = j < 6 ? AU_STAR : j < 11 ? AU_PALE : '#7cc4e8'; ctx.fillRect(tx, ty, 1, 1);
    }
    auTwinkle(sx, sy, 3, AU_STAR);
  }
  for (const o of auraOrbs) {
    const px = Math.round(o.x - ex), py = Math.round(o.y - ey);
    if (px < -ORB_R - 4 || py < -ORB_R - 4 || px > WV_W + ORB_R + 4 || py > WV_H + ORB_R + 4) continue;
    // its glow on the snow under it, then the orb, breathing
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = AU_PALE;
    for (let y = -4; y <= 4; y++) { const w = Math.round(ORB_R * Math.sqrt(1 - (y / 5) ** 2)); ctx.fillRect(px - w, py + 8 + y, w * 2 + 1, 1); }
    ctx.globalAlpha = 1;
    const r = 3 + (Math.sin(now * 6 + o.x) > 0 ? 1 : 0);
    auDisc(px, py, r + 1, AU_INK); auDisc(px, py, r, '#7cc4e8'); auDisc(px, py, r - 1, AU_PALE); auDisc(px, py, r - 2.5, AU_WHITE);
  }
  for (const c of auraCurtains) {
    if (c.t >= c.delay) { drawCurtainFall(c, ex, ey, now, (c.t - c.delay) / CURTAIN_GLOW); continue; }
    const k = Math.min(1, c.t / c.delay);
    drawCurtainRise(c.x - ex, c.y - ey, c.nx, c.ny, c.len, k, now);
  }
}
HERO_GROUND.push(drawAuraGround);

// ---- the STAR-GLASS ------------------------------------------------------------------
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
