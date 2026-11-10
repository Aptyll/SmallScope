'use strict';
// ------------------------------------------------------------ faber
// FABER's pixels (his rules: js/sim/faber.js): the SPARK in flight (HERO_SHOTS);
// on the snow (HERO_GROUND) his spare parts, his clocksprings, the spark's jump
// and his small machines' bolts; his two machines' bodies (HERO_MACHINE draw:
// drawFaberWinder, drawFaberEngine); and the CLOCK STAFF in his hand
// (HERO_STAVES). A clockspring of the other side shows only where its side sees.

const FA_INK = '#2e2440', FA_BRASS = '#f2cc6a', FA_DEEP = '#b98a2e', FA_WHITE = '#fff6d8', FA_STEEL = '#c8d2e4', FA_IRON = '#6a7286';

// ---- shots -----------------------------------------------------------------------
// the SPARK: a bright point with a crackling tail
function drawSparkShot(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang);
  const x = Math.round(sx), y = Math.round(sy);
  for (let s = 6; s > 0; s -= 2) {
    const j = Math.sin(now * 40 + s * 2 + a.ox) > 0 ? 1 : -1; // the tail jitters a pixel side to side
    ctx.fillStyle = s > 3 ? FA_DEEP : FA_BRASS;
    ctx.fillRect(Math.round(sx - nx * s - ny * j), Math.round(sy - ny * s + nx * j), 1, 1);
  }
  ctx.fillStyle = FA_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = Math.sin(now * 30) > 0 ? FA_WHITE : FA_BRASS;
  ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1);
}
HERO_SHOTS.spark = drawSparkShot;

// ---- on the snow --------------------------------------------------------------------
// a crooked line of light from (x0, y0) to (x1, y1), its kinks moving each frame
function faberZig(x0, y0, x1, y1, now) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(d / 6));
  const px = -(y1 - y0) / (d || 1), py = (x1 - x0) / (d || 1);
  let lx = x0, ly = y0;
  for (let i = 1; i <= n; i++) {
    const k = i / n, j = i < n ? Math.round(Math.sin(now * 50 + i * 2.3) * 2) : 0;
    const x = x0 + (x1 - x0) * k + px * j, y = y0 + (y1 - y0) * k + py * j;
    const m = Math.max(Math.abs(x - lx), Math.abs(y - ly)) || 1;
    for (let s = 0; s <= m; s++) {
      const qx = Math.round(lx + (x - lx) * s / m), qy = Math.round(ly + (y - ly) * s / m);
      ctx.fillStyle = FA_INK; ctx.fillRect(qx, qy + 1, 1, 1);
      ctx.fillStyle = s % 2 ? FA_BRASS : FA_WHITE; ctx.fillRect(qx, qy, 1, 1);
    }
    lx = x; ly = y;
  }
}
function drawFaberGround(ex, ey, now) {
  // spare parts: a small brass gear, turning, that blinks out as the snow takes it
  for (const w of faberParts) {
    if (!fogShown(w, now)) continue;
    if (w.t > PART_LIFE - 2 && Math.floor(now * 8) % 2) continue;
    const x = Math.round(w.x - ex), y = Math.round(w.y - ey);
    ctx.fillStyle = FA_INK; ctx.fillRect(x - 2, y - 3, 5, 5); ctx.fillRect(x - 3, y - 2, 7, 3);
    ctx.fillStyle = FA_DEEP; ctx.fillRect(x - 1, y - 2, 3, 3);
    ctx.fillStyle = FA_BRASS;
    const k = Math.floor(now * 4) % 2;
    ctx.fillRect(x - 2 + k, y - 2 + k, 1, 1); ctx.fillRect(x + 2 - k, y - k, 1, 1); ctx.fillRect(x, y - 3 + 2 * k, 1, 1);
    ctx.fillStyle = FA_INK; ctx.fillRect(x, y - 1, 1, 1);
  }
  // clocksprings: steel jaws round a brass coil; still winding it blinks
  for (const w of faberSprings) {
    if (!fogShown(w, now)) continue;
    const x = Math.round(w.x - ex), y = Math.round(w.y - ey);
    if (w.t < SPRING_ARM && Math.floor(now * 10) % 2) continue;
    ctx.fillStyle = FA_INK; ctx.fillRect(x - 5, y - 3, 11, 5); ctx.fillRect(x - 4, y - 4, 9, 7);
    ctx.fillStyle = '#454c5e'; ctx.fillRect(x - 4, y - 2, 9, 3);
    ctx.fillStyle = FA_STEEL;
    for (let k = -4; k <= 4; k += 2) { ctx.fillRect(x + k, y - 3, 1, 1); ctx.fillRect(x + k, y + 1, 1, 1); }
    ctx.fillStyle = FA_BRASS; ctx.fillRect(x - 2, y - 1, 5, 1); ctx.fillRect(x - 1, y - 2, 3, 3);
    ctx.fillStyle = FA_INK; ctx.fillRect(x, y - 1, 1, 1);
  }
  // the spark's jump
  for (const w of faberArcs) {
    if (w.t < 0 || w.x1 === undefined) continue;
    faberZig(Math.round(w.x0 - ex), Math.round(w.y0 - ey), Math.round(w.x1 - ex), Math.round(w.y1 - ey), now);
  }
  // the small machines' bolts: a brass pin
  for (const w of faberBolts) {
    const x = Math.round(w.x - ex), y = Math.round(w.y - ey);
    ctx.fillStyle = FA_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = FA_BRASS; ctx.fillRect(x, y, 1, 1);
  }
}
HERO_GROUND.push(drawFaberGround);

// ---- the keys' own looks -----------------------------------------------------------------
// a brass cog at (x, y): `r` px to its rim, `n` teeth, turned to `a`
function faCog(x, y, r, n, a) {
  ctx.fillStyle = FA_INK; fillEllipsePx(x, y, r + 1, r + 1);
  for (let k = 0; k < n; k++) {
    const t = a + k / n * Math.PI * 2, tx = Math.round(x + Math.cos(t) * (r + 1)), ty = Math.round(y + Math.sin(t) * (r + 1));
    ctx.fillStyle = FA_INK; ctx.fillRect(tx - 1, ty - 1, 3, 3);
    ctx.fillStyle = FA_BRASS; ctx.fillRect(tx, ty, 1, 1);
  }
  ctx.fillStyle = FA_DEEP; fillEllipsePx(x, y, r, r);
  ctx.fillStyle = FA_BRASS; fillEllipsePx(x - 1, y - 1, Math.max(1, r - 2), Math.max(1, r - 2));
  ctx.fillStyle = FA_INK; ctx.fillRect(x, y, 1, 1);
}
// SPARK's wind-up: crackle running out down the line from his clock, bits of it hopping
// further each frame until it reaches the spark's whole flight
function drawSparkTele(p, a, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = teleLen(p.x, p.y, nx, ny, SPARK_RANGE) * (0.3 + 0.7 * closing);
  ctx.globalAlpha = 0.55 + 0.4 * closing;
  for (let s = 12; s < L - 6; s += 18) {
    if ((Math.floor(now * 20) + s) % 3 === 0) continue; // it flickers
    const x0 = Math.round(p.x + nx * s - ex), y0 = Math.round(p.y - BOW_Y + ny * s - ey);
    faberZig(x0, y0, Math.round(x0 + nx * 8), Math.round(y0 + ny * 8), now + s);
  }
  ctx.globalAlpha = 1;
}
// WIND A MACHINE's wind-up: the machine being put together on its spot, its cog turning
// up out of the snow and its key going round
function drawWinderTele(x, y, closing, now) {
  ctx.globalAlpha = 0.5 + 0.5 * closing;
  ctx.fillStyle = 'rgba(30,40,70,0.35)'; fillEllipsePx(x, y + 2, 6, 2);
  faCog(x, y - Math.round(4 * closing), 2 + Math.round(2 * closing), 6, now * 6);
  ctx.globalAlpha = 1;
}
// CLOCKSPRING's wind-up: the trap's steel jaws set open on its spot, its coil winding
function drawSpringTele(x, y, closing, now) {
  const open = Math.round(3 * (1 - closing)) + 1;
  ctx.globalAlpha = 0.55 + 0.45 * closing;
  for (const side of [-1, 1]) {
    const jy = y + side * open - (side < 0 ? 1 : 0);
    ctx.fillStyle = FA_INK; ctx.fillRect(x - 5, jy - 1, 11, 3);
    ctx.fillStyle = FA_STEEL; for (let k = -4; k <= 4; k += 2) ctx.fillRect(x + k, jy, 1, 1);
  }
  ctx.fillStyle = Math.floor(now * 12) % 2 ? FA_BRASS : FA_DEEP; ctx.fillRect(x - 1, y - 1, 3, 2);
  ctx.globalAlpha = 1;
}
// THE OLD ENGINE's wind-up: the big cog turning up at his side where it is wound, steam
// puffing off it, and its tread pressed into the spot it will walk to
function drawEngineTele(p, c, to, closing, now, ex, ey) {
  const x = Math.round(c.x - ex), y = Math.round(c.y - ey);
  faCog(x, y - 6, 3 + Math.round(3 * closing), 8, now * 4);
  for (let k = 0; k < 3; k++) {
    const f = (now * 1.5 + k / 3) % 1;
    ctx.globalAlpha = 0.7 * (1 - f); ctx.fillStyle = '#e6e1d6';
    fillEllipsePx(x + (k - 1) * 4, y - 14 - Math.round(12 * f), 2 + Math.round(2 * f), 1 + Math.round(f));
  }
  ctx.globalAlpha = 0.25 + 0.35 * closing; ctx.fillStyle = FA_INK;
  const tx = Math.round(to.x - ex), ty = Math.round(to.y - ey);
  for (const side of [-1, 1]) { ctx.fillRect(tx + side * 4 - 2, ty - 2, 4, 6); ctx.fillRect(tx + side * 4 - 3, ty - 3, 6, 2); } // its two feet
  ctx.globalAlpha = 1;
}
// THE OLD ENGINE's slam: the ground split under its fist, snow and frozen earth thrown up,
// brass sparks off the iron
function drawSlamFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
  ctx.fillStyle = '#7f98bc'; fillEllipsePx(px, py + 2, 10, 4);
  drawCracks(px, py + 2, 9, f.r, Math.min(1, u * 5), seed, FA_INK, '#ffffff');
  drawFlung(px, py + 2, 0, Math.PI, f.r, 0.5, 14, 16, Math.min(1, u * 1.4), seed, (x, y, k) => {
    ctx.fillStyle = FA_INK; ctx.fillRect(x - 1, y - 1, 4, 4);
    ctx.fillStyle = k % 3 ? '#e6e1d6' : '#8a6a50'; ctx.fillRect(x, y, 2, 2);
  });
  drawFlung(px, py - 4, 0, Math.PI, f.r * 0.6, 0.3, 20, 10, Math.min(1, u * 2), seed + 5, (x, y) => {
    ctx.fillStyle = FA_BRASS; ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = FA_WHITE; ctx.fillRect(x, y - 1, 1, 1);
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.slam = drawSlamFx;

// ---- his machines -------------------------------------------------------------------
// bake a grid once per side (its r is the side's colour) and once mirrored (faces left)
const faberArtCache = {};
function faberArt(name, rows, pal, team, left) {
  const k = name + skin(team) + (left ? 'L' : 'R');
  if (!faberArtCache[k]) {
    const g = left ? rows.map((r) => r.split('').reverse().join('')) : rows;
    faberArtCache[k] = bakeBladeArt(g, Object.assign({ r: TEAMS[skin(team)].mark }, pal));
  }
  return faberArtCache[k];
}
// the small machine (W): a brass body on three legs, a steel barrel to its mark, its key turning
const FABER_WINDER = [
  '..oo........',
  '.oCCo.......',
  '..oso.......',
  '..oooooo....',
  '.oGyyyyGoooo',
  'oGyyWyyyCCCo',
  'oGyyyyyGoooo',
  'oGrrrrrGo...',
  '.ooooooo....',
  '..oDo.oDo...',
  '.oDo...oDo..',
  '.oo.....oo..',
];
const FABER_WINDER_KEY = FABER_WINDER.map((r, y) => (y === 1 ? '..oCo.......' : r)); // the key a quarter turned
const FABER_WINDER_PAL = { o: FA_INK, G: FA_DEEP, y: FA_BRASS, W: FA_WHITE, C: FA_STEEL, s: '#8b93a8', D: '#454c5e' };
// a machine's frame over its body: its side's bar, then how long it has left to run
function faberBars(b, ex, top) {
  drawHealthBar(b.x - ex, top - 4, b.hp, b.maxHp, 8, b.team, undefined, b);
  const w = Math.round(8 * Math.max(0, b.life / b.lifeMax));
  const x = Math.round(b.x - ex) - 4;
  ctx.fillStyle = FA_INK; ctx.fillRect(x - 1, top - 1, 10, 3);
  ctx.fillStyle = FA_BRASS; ctx.fillRect(x, top, w, 1);
}
function drawFaberWinder(b, ex, ey, now) {
  const left = b.face < 0;
  const spr = faberArt(Math.floor(b.animT * 3) % 2 ? 'wk' : 'w', Math.floor(b.animT * 3) % 2 ? FABER_WINDER_KEY : FABER_WINDER, FABER_WINDER_PAL, b.team, left);
  const bx = Math.round(b.x - 6 - ex), by = Math.round(b.y + 4 - ey) - spr.height;
  drawCastShade(spr, bx, by);
  drawSpriteFlash(spr, bx, by, b.flash);
  drawUnitStates(b, bx, by, spr.width, spr.height, now);
  faberBars(b, ex, by - 2);
  if (b.stunT > 0) drawStunStars(Math.round(b.x - ex), by - 9, b, 4);
  heroOver(b, Math.round(b.x - ex), by - 15, now); // a hero's marks, over the bars (HERO_OVER)
}
// the old engine (R): an iron box on two legs, a brass boiler for a chest, two big fists
const FABER_ENGINE = [
  '...oooooooooo...',
  '..oSSSSSSSSSSo..',
  '..oSCCCCCCCCSo..',
  '..oSCGGGGGGCSo..',
  '.ooSCGyyyyGCSoo.',
  'oSoSCGyWyyGCSoSo',
  'oSoSCGyyyyGCSoSo',
  'oSoSCGGGGGGCSoSo',
  'oSoSCCCCCCCCSoSo',
  'oSoSrrrrrrrrSoSo',
  'oCCoSSSSSSSSoCCo',
  'oCCooooooooooCCo',
  '.oo..oDDooDDooo.',
  '.....oDDooDDo...',
  '....oDDDooDDDo..',
  '....oooo..oooo..',
];
const FABER_ENGINE_STEP = FABER_ENGINE.slice(0, 13).concat(['....oDDo..oDDo..', '....oDDDo.oDDDo.', '....ooooo.ooooo.']);
const FABER_ENGINE_PAL = { o: FA_INK, S: FA_IRON, C: '#a9b2c4', G: FA_DEEP, y: FA_BRASS, W: FA_WHITE, D: '#3b4150' };
function drawFaberEngine(b, ex, ey, now) {
  const left = b.face < 0, step = b.moving && Math.floor(b.animT) % 2;
  const spr = faberArt(step ? 'es' : 'e', step ? FABER_ENGINE_STEP : FABER_ENGINE, FABER_ENGINE_PAL, b.team, left);
  const sink = b.slamFx > 0.15 ? 2 : 0; // the slam: it drops its whole weight onto its fists
  const bx = Math.round(b.x - 8 - ex), by = Math.round(b.y + 5 - ey) - spr.height + sink;
  drawCastShade(spr, bx, by - sink);
  drawSpriteFlash(spr, bx, by, b.flash);
  // the boiler's glow ticks while it runs
  if (Math.floor(now * 4) % 2) { ctx.fillStyle = FA_WHITE; ctx.fillRect(bx + (left ? 8 : 7), by + 5, 1, 1); }
  drawUnitStates(b, bx, by, spr.width, spr.height, now);
  faberBars(b, ex, by - 2 - sink);
  if (b.stunT > 0) drawStunStars(Math.round(b.x - ex), by - 9, b, 5);
  heroOver(b, Math.round(b.x - ex), by - 15 - sink, now); // a hero's marks, over the bars (HERO_OVER)
}

// ---- the CLOCK STAFF ------------------------------------------------------------
// His staff (CLASSES' `staff: 'clock'`; HERO_STAVES, js/draw/heroes.js): a brass clock face on
// a walnut staff, carried upright; its hand ticks round between two frames.
// The hand closes on the shaft at FABER_CLOCK_GRIP.
const FABER_CLOCK = [
  '..ooo..',
  '.oyYyo.',
  'oywwwyo',
  'oywowyo',
  'oywooyo',
  'oywwwyo',
  '.oyYyo.',
  '..oyo..',
  '..oAo..',
  '..oAo..',
  '..oAo..',
  '..oAo..',
  '..oAo..',
  '..oAo..',
  '..oAo..',
  '..oAo..',
  '..oao..',
  '..oao..',
  '...o...',
];
const FABER_CLOCK_GRIP = [3, 10];
const FABER_CLOCK_PAL = { o: FA_INK, y: FA_BRASS, Y: FA_DEEP, w: '#f4f0e8', A: '#8a5a34', a: '#5a3a24' };
let faberClockArt = null;
function faberClock() {
  if (faberClockArt) return faberClockArt;
  const tick = FABER_CLOCK.map((r, y) => (y === 3 ? 'oywowyo' : y === 4 ? 'oyoowyo' : r)); // the hand a quarter on
  faberClockArt = [bakeBladeArt(FABER_CLOCK, FABER_CLOCK_PAL), bakeBladeArt(tick, FABER_CLOCK_PAL)];
  return faberClockArt;
}
HERO_STAVES.clock = { art: faberClock, grip: FABER_CLOCK_GRIP };

// his staff's basic bolt: a small brass cog, turning (the CLASSES row's shot `look`)
function drawCogBolt(a, sx, sy, now) {
  const x = Math.round(sx), y = Math.round(sy), k = Math.floor(now * 12 + a.ox) % 2;
  ctx.fillStyle = FA_INK; ctx.fillRect(x - 1, y - 2, 3, 5); ctx.fillRect(x - 2, y - 1, 5, 3);
  ctx.fillStyle = FA_BRASS; ctx.fillRect(x - 1 + k, y - 1, 1 + k, 3 - k); ctx.fillRect(x - 1, y - 1 + k, 3, 1);
  ctx.fillStyle = FA_WHITE; ctx.fillRect(x, y, 1, 1);
}
HERO_SHOTS.cog = drawCogBolt;
