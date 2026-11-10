'use strict';
// ------------------------------------------------------------ hiems
// HIEMS's pixels (her rules: js/sim/hiems.js): her staff's frost bolt and the
// ICICLE in flight (HERO_SHOTS); on the snow (HERO_GROUND) CLEAR ICE's glazed
// disc and WHITEOUT's blizzard riding her; on any body (HERO_MARK) its chills
// as small ice pips over the head and, while frozen, the ice round it; and
// the SNOWFLAKE STAFF in her hand (HERO_STAVES). Both sides see all of it.

const HI_INK = '#0a0e23', HI_ICE = '#7cc4e8', HI_PALE = '#e6f8ff', HI_MID = '#a8dcf0', HI_DEEP = '#2f5f8f', HI_WHITE = '#ffffff';

// ---- shots -----------------------------------------------------------------------
// her staff's FROST BOLT: a snowflake, six arms on a diamond of deep ice so it holds on snow, its heart glinting; a cold streak behind it
function drawFrostBolt(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang), x = Math.round(sx), y = Math.round(sy);
  fxTail(sx, sy, nx, ny, 7, HI_ICE, HI_DEEP);
  ctx.fillStyle = HI_DEEP; for (let d = -4; d <= 4; d++) ctx.fillRect(x - (4 - Math.abs(d)), y + d, 2 * (4 - Math.abs(d)) + 1, 1); // deep ice, not black
  ctx.fillStyle = HI_PALE; ctx.fillRect(x, y - 3, 1, 7); // six arms: one upright, two slanted
  for (const d of [-2, -1, 1, 2]) { ctx.fillRect(x + d, y + d, 1, 1); ctx.fillRect(x + d, y - d, 1, 1); }
  ctx.fillStyle = HI_WHITE; if (Math.floor(now * 10 + a.ox) % 2) { ctx.fillRect(x - 1, y - 1, 3, 3); } else ctx.fillRect(x, y, 1, 1);
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
    // the glaze: a sheet of clear ice with a broken edge, its lip a shade deeper on
    // the near side, and shine streaks that slide across it
    const seed = (Math.round(g.x) * 7 + Math.round(g.y) * 13) | 0, ry = GLAZE_R;
    ctx.globalAlpha = 0.6 * a; fxPatch(px, py + 2, GLAZE_R, 1, 6, seed, HI_DEEP);
    ctx.globalAlpha = 0.85 * a; fxPatch(px, py, GLAZE_R, 1, 6, seed, HI_MID);
    ctx.globalAlpha = 0.5 * a; fxPatch(px - 4, py - 5, GLAZE_R * 0.45, 0.7, 4, seed + 3, HI_PALE); // where it lies thickest
    ctx.globalAlpha = 0.9 * a; ctx.fillStyle = HI_WHITE;
    const sh = Math.floor(now * 8) % 12;
    for (let k = -1; k <= 1; k++) {
      const x0 = px + k * 11 - 4 + (sh - 6), y0 = py - k * 5 + 2;
      for (let s = 0; s < 8; s++) { const x = x0 + s, y = y0 - Math.round(s / 2); if (Math.abs(x - px) / GLAZE_R + Math.abs(y - py) / ry < 0.8) ctx.fillRect(x, y, 1, 1); }
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
    for (let k = 0; k < 36; k++) { // its edge: gusts racing round the rim, never a drawn line
      const ang = k / 36 * Math.PI * 2 + now * 2.2, r = WHITE_R - 1 - (k % 3) * 2, tx = -Math.sin(ang), ty = Math.cos(ang);
      ctx.globalAlpha = 0.85 * a;
      for (let s = 0; s < 5; s++) {
        const x = Math.round(px + Math.cos(ang) * r - tx * s), y = Math.round(py + Math.sin(ang) * r - ty * s);
        ctx.fillStyle = '#5f7aa0'; ctx.fillRect(x, y + 1, 1, 1);
        ctx.fillStyle = s < 2 ? HI_WHITE : '#c8d8e8'; ctx.fillRect(x, y, 1, 1);
      }
    }
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

// ---- the keys' own looks -------------------------------------------------------------
// a frost crystal on the snow: a plus of ice, its heart white, s 1 or 2 px of arm
function hiCrystal(x, y, s) {
  ctx.fillStyle = HI_INK; ctx.fillRect(x - s, y + 1, s * 2 + 1, 1);
  ctx.fillStyle = HI_ICE; ctx.fillRect(x - s, y, s * 2 + 1, 1); ctx.fillRect(x, y - s, 1, s * 2 + 1);
  ctx.fillStyle = HI_WHITE; ctx.fillRect(x, y, 1, 1);
}
// ICICLE's wind-up: frost creeping out down the line from her feet, broad and thick by
// her and thinning to a point, its edge broken, a few crystals where it has taken hold
function drawIcicleTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = teleLen(p.x, p.y, nx, ny, ICICLE_RANGE) * (0.25 + 0.75 * closing);
  for (let s = 8; s < L; s++) {
    const w = Math.max(0, Math.round(3.2 * (1 - s / L) + (fxRoll(p.id, s, 1) - 0.5) * 1.6));
    for (let k = -w; k <= w; k++) {
      if (w && Math.abs(k) === w && fxRoll(p.id, s, 5 + k) < 0.45) continue;
      ctx.fillStyle = k === 0 && fxRoll(p.id, s, 2) < 0.5 ? HI_WHITE : Math.abs(k) === w ? HI_ICE : HI_MID;
      ctx.fillRect(Math.round(p.x + nx * s - ny * k - ex), Math.round(p.y + 3 + ny * s + nx * k - ey), 1, 1);
    }
  }
  for (let k = 0; k < 5; k++) {
    const f = fxRoll(p.id, k, 9) ** 2, s = 10 + f * (L - 14), o = (fxRoll(p.id, k, 10) * 2 - 1) * 6;
    if (s < L - 4) hiCrystal(Math.round(p.x + nx * s - ny * o - ex), Math.round(p.y + 3 + ny * s + nx * o - ey), f < 0.35 ? 2 : 1);
  }
}
// CLEAR ICE's wind-up: plates of ice forming from the middle out over the patch it glazes
const GLAZE_PLATES = 30;
function drawGlazeTele(px, py, closing) {
  for (const [ux, uy, r] of fxSpots(GLAZE_PLATES)) {
    if (r > closing * 1.15) continue;
    const x = Math.round(px + ux * (GLAZE_R - 3)), y = Math.round(py + uy * (GLAZE_R - 3));
    ctx.fillStyle = HI_DEEP; ctx.fillRect(x - 3, y - 1, 7, 3);
    ctx.fillStyle = HI_MID; ctx.fillRect(x - 2, y - 1, 5, 2);
    ctx.fillStyle = HI_WHITE; ctx.fillRect(x - 2, y - 1, 1, 1);
  }
}
// COLD SNAP's wind-up: the ground freezing at the spot, cracks of frost running out to
// the burst's reach, the spikes' tips breaking the crust at the last
function drawSnapTele(px, py, closing, seed) {
  drawCracks(px, py, 8, SNAP_R, 0.2 + 0.8 * closing, seed * 17, HI_DEEP, HI_PALE);
  if (closing < 0.6) return;
  for (const [ux, uy] of fxSpots(SNAP_SPIKES)) {
    const x = Math.round(px + ux * SNAP_R * 0.85), y = Math.round(py + uy * SNAP_R * 0.85);
    ctx.fillStyle = HI_INK; ctx.fillRect(x, y - 1, 1, 2);
    ctx.fillStyle = HI_WHITE; ctx.fillRect(x, y - 2, 1, 1);
  }
}
// COLD SNAP landing: a crown of ice spikes bursts up out of the snow over the spot, stands,
// and shatters into shards
const SNAP_SPIKES = 14;
function hiSpike(x, y, h) {
  for (let r = 0; r < h; r++) {
    const w = Math.max(0, Math.round((1 - r / h) * 2));
    ctx.fillStyle = HI_INK; ctx.fillRect(x - w - 1, y - r, w * 2 + 3, 1);
  }
  for (let r = 0; r < h - 1; r++) {
    const w = Math.max(0, Math.round((1 - r / h) * 2));
    ctx.fillStyle = HI_MID; ctx.fillRect(x - w, y - r, w * 2 + 1, 1);
    ctx.fillStyle = HI_WHITE; ctx.fillRect(x - w, y - r, 1, 1);
  }
}
function drawSnapFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  ctx.globalAlpha = Math.min(1, 3 * (1 - u));
  drawCracks(px, py, 8, f.r, 1, seed, HI_DEEP, HI_PALE);
  ctx.globalAlpha = 1;
  if (u < 0.62) {
    const up = Math.min(1, u * 7);
    fxSpots(SNAP_SPIKES).map(([ux, uy], k) => [Math.round(px + ux * f.r * 0.85), Math.round(py + uy * f.r * 0.85), k])
      .sort((m, n) => m[1] - n[1]) // the far ones first, so the near stand over them
      .forEach(([x, y, k]) => hiSpike(x, y, Math.round((7 + 9 * fxRoll(seed, k, 7)) * up)));
    return;
  }
  drawFlung(px, py, 0, Math.PI, f.r + 6, 0.3, 12, 22, (u - 0.62) / 0.38, seed, (x, y) => {
    ctx.fillStyle = HI_INK; ctx.fillRect(x, y + 1, 2, 1);
    ctx.fillStyle = HI_MID; ctx.fillRect(x, y, 2, 1);
    ctx.fillStyle = HI_WHITE; ctx.fillRect(x, y, 1, 1);
  });
}
AB_FX_LOOK.snap = drawSnapFx;
// WHITEOUT's wind-up: the wind gathering in round her, streaks of snow drawn in on a spiral
function drawWhiteoutTele(px, py, closing, now) {
  for (let k = 0; k < 40; k++) {
    const f = (k * 0.618 + now * 1.4) % 1, r = WHITE_R * (1 - f) * (0.6 + 0.4 * closing) + 6;
    const ang = fxRoll(7, k, 1) * Math.PI * 2 + f * 2.2, tx = -Math.sin(ang), ty = Math.cos(ang);
    ctx.globalAlpha = (0.4 + 0.5 * closing) * Math.min(1, f * 4);
    for (let s = 0; s < 4; s++) {
      const x = Math.round(px + Math.cos(ang) * r - tx * s * 1.5), y = Math.round(py + Math.sin(ang) * r - ty * s * 1.5);
      ctx.fillStyle = '#5f7aa0'; ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillStyle = s ? '#c8d8e8' : HI_WHITE; ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ---- on a body --------------------------------------------------------------------
// its chills as ice pips over the head (two at most), and while frozen the ice round it
function drawHiemsMarks(e, px, py, w, h, now) {
  if (e.frozeT > 0) {
    ctx.globalAlpha = 0.55; ctx.fillStyle = HI_MID; ctx.fillRect(px - 1, py + 1, w + 2, h - 1);
    ctx.globalAlpha = 0.9; ctx.fillStyle = HI_PALE;
    ctx.fillRect(px - 1, py + 1, w + 2, 1); ctx.fillRect(px - 1, py + 1, 1, h - 1); ctx.fillRect(px + w, py + 1, 1, h - 1);
    ctx.fillStyle = HI_WHITE; ctx.fillRect(px + 2, py + 3, 1, 3); ctx.fillRect(px + 3, py + 3, 1, 1);
    ctx.globalAlpha = 1;
  }
}
// the chill count, over the stack (HERO_OVER): one ice bead a stack, blinking one short of the freeze
HERO_OVER.push({
  w: (e) => (!(e.frozeT > 0) && e.chillN > 0 && e.chillT > 0 ? e.chillN * 4 - 1 : 0),
  draw: (e, x0, y, now) => {
    for (let k = 0; k < e.chillN; k++) {
      const x = x0 + 1 + k * 4;
      ctx.fillStyle = HI_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = e.chillN >= CHILL_FREEZE - 1 && Math.floor(now * 6) % 2 ? HI_WHITE : HI_ICE; ctx.fillRect(x, y, 1, 1);
    }
  },
});
HERO_MARK.push(drawHiemsMarks);

// ---- the SNOWFLAKE STAFF ------------------------------------------------------------
// Her staff (CLASSES' `staff: 'flake'`; HERO_STAVES, js/draw/heroes.js): a six-pointed flake
// of ice, white on a deep blue hexagon boss, on a pale birch staff, carried upright; the flake's heart glints between two frames.
// The hand closes on the shaft at HIEMS_FLAKE_GRIP.
const HIEMS_FLAKE = [
  '...ooo...',
  '..odddo..',
  '.ocdddco.',
  '.odcdcdo.',
  'occcSccco',
  '.odcdcdo.',
  '.ocdddco.',
  '..odddo..',
  '..oGoo...',
  '..oGo....',
  '..oGo....',
  '..oGo....',
  '..oGo....',
  '..oGo....',
  '..oGo....',
  '..oGo....',
  '..oGo....',
  '..ogo....',
  '..ogo....',
  '...o.....',
];
// The snowflake staff at 32 px (dens 2) for her fine body (HERO_STAVES' `fine`): the flake laid from its shape on
// twice the px, six barbed arms of white ice on the deep blue boss, the heart flaring between the two frames
// (/mnt/project-files/visuals-loop/heroes-a/fine/hiems.py); the grip stays HIEMS_FLAKE_GRIP, in world px
const HIEMS_FLAKE_FINE = [
  '.....o......o.....',
  '....oco....oco....',
  '...occoooooocco...',
  '....occDDDDcco....',
  '...oDDccddccDDo...',
  '...occccddcccco...',
  '..ocdddcddcdddco..',
  '.oDDcddcSScddcDDo.',
  'occccccSSSScccccco',
  'occccccSSSScccccco',
  '.oddcddcSScddcddo.',
  '..ocdddcddcdddco..',
  '...occccddcccco...',
  '...oddccddccddo...',
  '....occddddcco....',
  '...occGgoooocco...',
  '....ocGGo..oco....',
  '.....oGGo...o.....',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGgo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGgo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGgo.........',
  '.....oGgo.........',
  '.....oGgo.........',
  '.....oGgo.........',
  '.....oGgo.........',
  '......oo..........',
];
const HIEMS_FLAKE_GLINT_FINE = [
  '.....o......o.....',
  '....oco....oco....',
  '...occoooooocco...',
  '....occDDDDcco....',
  '...oDDccddccDDo...',
  '...occccddcccco...',
  '..ocdddSddSdddco..',
  '.oDDcddSSSSddcDDo.',
  'occcccSSSSSSccccco',
  'occcccSSSSSSccccco',
  '.oddcddSSSSddcddo.',
  '..ocdddSddSdddco..',
  '...occccddcccco...',
  '...oddccddccddo...',
  '....occddddcco....',
  '...occGgoooocco...',
  '....ocGGo..oco....',
  '.....oGGo...o.....',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGgo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGgo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGGo.........',
  '.....oGgo.........',
  '.....oGgo.........',
  '.....oGgo.........',
  '.....oGgo.........',
  '.....oGgo.........',
  '......oo..........',
];
const HIEMS_FLAKE_GRIP = [3, 11];
const HIEMS_FLAKE_PAL = { o: '#2e2440', c: '#e6f8ff', d: '#2f5f8f', D: '#5a9ad0', S: '#ffffff', g: '#8a95a8', G: '#c3ccd8' };
let hiemsFlakeArt = null;
function hiemsFlake() {
  if (hiemsFlakeArt) return hiemsFlakeArt;
  const glint = HIEMS_FLAKE.map((r, y) => (y === 4 ? 'occSSScco' : r));
  hiemsFlakeArt = [bakeBladeArt(HIEMS_FLAKE, HIEMS_FLAKE_PAL), bakeBladeArt(glint, HIEMS_FLAKE_PAL)];
  return hiemsFlakeArt;
}
let hiemsFlakeFineArt = null;
function hiemsFlakeFine() {
  if (hiemsFlakeFineArt) return hiemsFlakeFineArt;
  const tag = (c) => { c.dens = 2; return c; };
  return (hiemsFlakeFineArt = [tag(bakeBladeArt(HIEMS_FLAKE_FINE, HIEMS_FLAKE_PAL)), tag(bakeBladeArt(HIEMS_FLAKE_GLINT_FINE, HIEMS_FLAKE_PAL))]);
}
HERO_STAVES.flake = { art: hiemsFlake, fine: hiemsFlakeFine, grip: HIEMS_FLAKE_GRIP, hold: 'far' };

// ---- the status plate -------------------------------------------------------------
// her two controls on the frame's plate (statusIcon, js/draw/overhead.js): FROZEN, a
// stun in ice that outranks the bare sparks, and BLINDED inside a rival's WHITEOUT, the
// closed eye, draining with the storm's own clock
statusIcon({ id: 'frozen', rank: 30, on: (e) => e.frozeT > 0, left: (e) => e.frozeT, max: (e) => e.stunMax,
  ink: HI_MID, lit: HI_WHITE, deep: HI_DEEP,
  px: ['...#...', '.#.#.#.', '..###..', '###+###', '..###..', '.#.#.#.', '...#...'] });
function whiteoutLeft(e) {
  const t = unitTeam(e);
  let left = 0;
  for (const s of hiemsStorms) if (s.team !== t && Math.hypot(e.x - s.x, e.y - s.y) <= WHITE_R) left = Math.max(left, s.life - s.t);
  return left;
}
statusIcon({ id: 'blind', rank: 60, on: (e) => e instanceof Player && hiemsStorms.length > 0 && inRivalStorm(e),
  left: whiteoutLeft, max: () => WHITE_T,
  ink: HI_PALE, lit: HI_WHITE, deep: '#5a6688',
  px: ['x......', '.x###..', '.#x..#.', '#.+x..#', '.#..x#.', '..###x.', '......x'] });
