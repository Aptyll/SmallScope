'use strict';
// ------------------------------------------------------------ hiems
// HIEMS's pixels (her rules: js/sim/hiems.js): her staff's frost bolt and the
// ICICLE in flight (HERO_SHOTS); on the snow (HERO_GROUND) CLEAR ICE's glazed
// disc and WHITEOUT's blizzard riding her; on any body (HERO_MARK) its chills
// as small ice pips over the head and, while frozen, the ice round it; and
// the SNOWFLAKE STAFF in her hand (HERO_STAVES). Both sides see all of it.

const HI_INK = '#0a0e23', HI_ICE = '#7cc4e8', HI_PALE = '#e6f8ff', HI_MID = '#a8dcf0', HI_DEEP = '#2f5f8f', HI_WHITE = '#ffffff';

// ---- shots -----------------------------------------------------------------------
// her staff's FROST BOLT: a pale point with a short cold tail
function drawFrostBolt(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang);
  const x = Math.round(sx), y = Math.round(sy);
  ctx.fillStyle = HI_ICE; ctx.fillRect(Math.round(sx - nx * 5), Math.round(sy - ny * 5), 1, 1);
  ctx.fillStyle = HI_MID; ctx.fillRect(Math.round(sx - nx * 3), Math.round(sy - ny * 3), 1, 1);
  ctx.fillStyle = HI_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = Math.sin(now * 20 + a.ox) > 0 ? HI_WHITE : HI_PALE;
  ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1);
}
// the ICICLE: a long shard, point first, along its flight
function drawIcicleShot(a, sx, sy) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang);
  for (let s = 9; s >= 0; s--) {
    const x = Math.round(sx - nx * s), y = Math.round(sy - ny * s);
    ctx.fillStyle = HI_INK; ctx.fillRect(x - 1, y, 3, 2);
  }
  for (let s = 9; s >= 0; s--) {
    const x = Math.round(sx - nx * s), y = Math.round(sy - ny * s);
    ctx.fillStyle = s < 3 ? HI_WHITE : s < 6 ? HI_PALE : HI_ICE;
    ctx.fillRect(x, y, 1, 1);
    if (s > 2 && s < 8) { ctx.fillStyle = HI_MID; ctx.fillRect(x + (Math.abs(nx) > Math.abs(ny) ? 0 : 1), y + (Math.abs(nx) > Math.abs(ny) ? 1 : 0), 1, 1); }
  }
}
HERO_SHOTS.frostbolt = drawFrostBolt;
HERO_SHOTS.icicle = drawIcicleShot;

// ---- on the snow --------------------------------------------------------------------
// a flat ellipse `rx` x `ry` at (px, py), one row at a time
function hiDisc(px, py, rx, ry, col) {
  ctx.fillStyle = col;
  for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(1 - (y / (ry + 0.5)) ** 2)); ctx.fillRect(px - w, py + y, w * 2 + 1, 1); }
}
function drawHiemsGround(ex, ey, now) {
  for (const g of hiemsGlazes) {
    const px = Math.round(g.x - ex), py = Math.round(g.y - ey);
    if (px < -GLAZE_R - 4 || py < -GLAZE_R - 4 || px > WV_W + GLAZE_R + 4 || py > WV_H + GLAZE_R + 4) continue;
    const a = g.t < g.life ? 1 : Math.max(0, 1 - (g.t - g.life) / GLAZE_FADE);
    const ry = GLAZE_R; // a circle on the ground, as every ring is (drawRing) and as the rule reads it
    // the glaze: a blue rim, the clear ice, shine streaks that slide across it
    ctx.globalAlpha = 0.75 * a; hiDisc(px, py, GLAZE_R, ry, HI_DEEP);
    ctx.globalAlpha = 0.7 * a; hiDisc(px, py, GLAZE_R - 2, ry - 1, HI_MID);
    ctx.globalAlpha = 0.85 * a; ctx.fillStyle = HI_WHITE;
    const sh = Math.floor(now * 8) % 12;
    for (let k = -2; k <= 2; k++) {
      const x0 = px + k * 9 - 3 + (sh - 6), y0 = py - k * 2;
      for (let s = 0; s < 5; s++) { const x = x0 + s, y = y0 - Math.round(s / 2); if (Math.abs(x - px) / GLAZE_R + Math.abs(y - py) / ry < 0.85) ctx.fillRect(x, y, 1, 1); }
    }
    ctx.globalAlpha = 1;
  }
  for (const s of hiemsStorms) {
    const px = Math.round(s.x - ex), py = Math.round(s.y - ey);
    if (px < -WHITE_R - 8 || py < -WHITE_R - 8 || px > WV_W + WHITE_R + 8 || py > WV_H + WHITE_R + 8) continue;
    const a = Math.min(1, s.t / 0.3, (s.life - s.t) / 0.4);
    // a grey-blue haze (white alone vanishes on snow), its rim, and the driven snow:
    // streaks of wind and flakes with a dark under-pixel, wheeling round her
    ctx.globalAlpha = 0.3 * a; hiDisc(px, py, WHITE_R, WHITE_R, '#9fb6d8');
    ctx.globalAlpha = 0.25 * a; hiDisc(px, py, WHITE_R - 6, WHITE_R - 6, '#c8d8e8');
    drawRing(px, py, WHITE_R, '#5f7aa0', 0.7 * a, 0);
    for (let k = 0; k < 90; k++) {
      const r = WHITE_R * (0.1 + ((k * 37) % 88) / 100), ang = k * 2.399 + now * (1.6 + (k % 5) * 0.25);
      const x = Math.round(px + Math.cos(ang) * r), y = Math.round(py + Math.sin(ang) * r - 6);
      ctx.globalAlpha = 0.9 * a;
      if (k % 3 === 0) { // a streak of wind, along the turn
        const tx = -Math.sin(ang), ty = Math.cos(ang);
        ctx.fillStyle = '#7f98bc';
        for (let s = 0; s < 4; s++) ctx.fillRect(Math.round(x - tx * s * 1.5), Math.round(y - ty * s * 1.5), 1, 1);
        continue;
      }
      ctx.fillStyle = '#5f7aa0'; ctx.fillRect(x, y + 1, k % 7 ? 1 : 2, 1);
      ctx.fillStyle = HI_WHITE; ctx.fillRect(x, y, k % 7 ? 1 : 2, 1);
    }
    ctx.globalAlpha = 1;
  }
}
HERO_GROUND.push(drawHiemsGround);

// ---- on a body --------------------------------------------------------------------
// its chills as ice pips over the head (two at most), and while frozen the ice round it
function drawHiemsMarks(e, px, py, w, h, now) {
  if (e.frozeT > 0) {
    ctx.globalAlpha = 0.55; ctx.fillStyle = HI_MID; ctx.fillRect(px - 1, py + 1, w + 2, h - 1);
    ctx.globalAlpha = 0.9; ctx.fillStyle = HI_PALE;
    ctx.fillRect(px - 1, py + 1, w + 2, 1); ctx.fillRect(px - 1, py + 1, 1, h - 1); ctx.fillRect(px + w, py + 1, 1, h - 1);
    ctx.fillStyle = HI_WHITE; ctx.fillRect(px + 2, py + 3, 1, 3); ctx.fillRect(px + 3, py + 3, 1, 1);
    ctx.globalAlpha = 1;
    return;
  }
  if (!(e.chillN > 0) || !(e.chillT > 0)) return;
  const mx = px + (w >> 1), my = py - 4;
  for (let k = 0; k < e.chillN; k++) {
    const x = mx - (e.chillN - 1) * 2 + k * 4;
    ctx.fillStyle = HI_INK; ctx.fillRect(x - 1, my - 1, 3, 3);
    ctx.fillStyle = e.chillN >= CHILL_FREEZE - 1 && Math.floor(now * 6) % 2 ? HI_WHITE : HI_ICE; ctx.fillRect(x, my, 1, 1);
  }
}
HERO_MARK.push(drawHiemsMarks);

// ---- the SNOWFLAKE STAFF ------------------------------------------------------------
// Her staff (CLASSES' `staff: 'flake'`; HERO_STAVES, js/draw/heroes.js): a six-pointed flake
// of ice on a pale birch staff, carried upright; the flake's heart glints between two frames.
// The hand closes on the shaft at HIEMS_FLAKE_GRIP.
const HIEMS_FLAKE = [
  '.o.o.o.',
  'oCoCoCo',
  '.oCCCo.',
  'oCCSCCo',
  '.oCCCo.',
  'oCoCoCo',
  '.oocoo.',
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
const HIEMS_FLAKE_GRIP = [3, 10];
const HIEMS_FLAKE_PAL = { o: '#2e2440', C: '#e6f8ff', c: '#7cc4e8', S: '#ffffff', W: '#a8dcf0', g: '#8a95a8', G: '#c3ccd8' };
let hiemsFlakeArt = null;
function hiemsFlake() {
  if (hiemsFlakeArt) return hiemsFlakeArt;
  const glint = HIEMS_FLAKE.map((r, y) => (y === 3 ? 'oCWSWCo' : r));
  hiemsFlakeArt = [bakeBladeArt(HIEMS_FLAKE, HIEMS_FLAKE_PAL), bakeBladeArt(glint, HIEMS_FLAKE_PAL)];
  return hiemsFlakeArt;
}
HERO_STAVES.flake = { art: hiemsFlake, grip: HIEMS_FLAKE_GRIP };
