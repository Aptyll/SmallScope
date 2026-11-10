'use strict';
// ------------------------------------------------------------ ignia
// IGNIA's pixels (her rules: js/sim/ignia.js): the FIREBRAND in flight and her
// staff's ember shot (HERO_SHOTS), BRUSHFIRE's line on the snow and the strip it
// melts (HERO_GROUND), its wind-up, and WARM HANDS' sparks at her hands while
// the warmth waits (HERO_BODY_FX). A body she set burning wears the shared
// flames (drawUnitStates); the wildfire's jumps flash as lines (abFx).

const IG_INK = '#2e2440', IG_EMBER = '#d8502e', IG_FLAME = '#ff9a3a', IG_CORE = '#ffe07a', IG_AMBER = '#c8721e';

// one small flame standing at (x, y), `h` px tall, flickering on its own beat
// (`k` keeps neighbours out of step); drawn from the clock, never a roll
function igFlame(x, y, h, now, k) {
  const f = Math.sin(now * 13 + k * 2.1) > 0 ? 1 : 0;
  const t = h + f;
  ctx.fillStyle = IG_INK;
  ctx.fillRect(x - 2, y - t + 2, 5, t - 1); ctx.fillRect(x - 1, y - t, 3, 2);
  ctx.fillStyle = IG_EMBER; ctx.fillRect(x - 1, y - t + 2, 3, t - 2);
  ctx.fillStyle = IG_FLAME; ctx.fillRect(x, y - t + 1, 1, t - 1); ctx.fillRect(x - 1, y - 3, 3, 2);
  ctx.fillStyle = IG_CORE; ctx.fillRect(x, y - 3, 1, 2);
}

// ---- shots ---------------------------------------------------------------------
// the FIREBRAND: a short stick trailing from the tip, burning at the head
function drawBrandShot(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang);
  for (let s = 1; s <= 6; s++) {
    const x = Math.round(sx - nx * s), y = Math.round(sy - ny * s);
    ctx.fillStyle = IG_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = s < 3 ? IG_EMBER : '#a3794f'; ctx.fillRect(x, y, 1, 1);
  }
  igFlame(Math.round(sx), Math.round(sy) + 1, 4, now, a.ox);
}
// her staff's EMBER: a small flame flying point first, a hot core that flickers, its fire streaming behind it
function drawEmberShot(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang), x = Math.round(sx), y = Math.round(sy), k = Math.sin(now * 20 + a.ox) > 0;
  fxTail(sx, sy, nx, ny, k ? 8 : 7, IG_FLAME, IG_AMBER);
  fxHeadInk(x, y, 2, IG_INK);
  ctx.fillStyle = IG_FLAME; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = IG_CORE; ctx.fillRect(x - (k ? 1 : 0), y - 1, k ? 2 : 1, 2); ctx.fillRect(Math.round(sx + nx * 2), Math.round(sy + ny * 2), 1, 1); // the tip, ahead
}
HERO_SHOTS.brand = drawBrandShot;
HERO_SHOTS.ember = drawEmberShot;

// ---- on the snow ------------------------------------------------------------------
// the wind-up: the snow thawing in a wet strip from the middle of where the fire will
// lie, a low flame creeping out at each end of it and embers hopping along it
function drawBrushTele(cx, cy, nx, ny, closing, now) {
  const h = BRUSH_LEN / 2, run = h * (0.25 + 0.75 * closing);
  ctx.fillStyle = '#8fa6c4';
  for (let s = -run; s <= run; s++) ctx.fillRect(Math.round(cx + nx * s), Math.round(cy + ny * s), 1, 2);
  for (const e of [-run, run]) igFlame(Math.round(cx + nx * e), Math.round(cy + ny * e) + 1, 2 + Math.round(2 * closing), now, e);
  for (let k = 0; k < 5; k++) {
    const u = (now * 2 + k / 5) % 1, s = (fxRoll(77, k + Math.floor(now * 2 + k / 5) * 5, 1) * 2 - 1) * run;
    const x = Math.round(cx + nx * s), y = Math.round(cy + ny * s - 4 * 4 * u * (1 - u));
    ctx.fillStyle = IG_EMBER; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = u < 0.5 ? IG_CORE : IG_FLAME; ctx.fillRect(x, y, 1, 1);
  }
}
// BRUSHFIRE: the melted strip (wet, darker snow), and while it burns, flames
// standing along it, the ends lower; both sides see it
function drawBrushfires(ex, ey, now) {
  for (const b of brushfires) {
    const cx = b.x - ex, cy = b.y - ey;
    if (cx < -BRUSH_LEN || cy < -BRUSH_LEN || cx > WV_W + BRUSH_LEN || cy > WV_H + BRUSH_LEN) continue;
    const h = BRUSH_LEN / 2;
    const melt = b.t < b.life ? Math.min(1, b.t / 0.3) : Math.max(0, 1 - (b.t - b.life) / BRUSH_MELT);
    ctx.globalAlpha = 0.45 * melt;
    ctx.fillStyle = '#5f6f96';
    for (let s = -h - 2; s <= h + 2; s++) for (let k = -3; k <= 3; k++) {
      if (Math.abs(k) === 3 && (Math.abs(s) > h - 2 || (s + k) % 2)) continue;
      ctx.fillRect(Math.round(cx + b.nx * s - b.ny * k), Math.round(cy + b.ny * s + b.nx * k), 1, 1);
    }
    ctx.globalAlpha = 1;
    if (b.t >= b.life) continue;
    const fade = Math.min(1, (b.life - b.t) / 0.4, b.t / 0.15);
    ctx.globalAlpha = fade;
    for (let s = -h + 3, k = 0; s <= h - 3; s += 7, k++) {
      const edge = 1 - Math.abs(s) / h;
      igFlame(Math.round(cx + b.nx * s), Math.round(cy + b.ny * s) + 1, 4 + Math.round(4 * edge), now, k + b.x);
    }
    ctx.globalAlpha = 1;
  }
}
// FIREBRAND's wind-up: the snow down its line already thawing to a wet dark streak,
// out further as she draws back, and sparks lifting off it here and there
function drawBrandTele(p, a, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = teleLen(p.x, p.y, nx, ny, BRAND_RANGE) * (0.35 + 0.65 * closing);
  for (let s = 8; s < L; s++) {
    const x = Math.round(p.x + nx * s - ex), y = Math.round(p.y + 3 + ny * s - ey);
    ctx.fillStyle = '#8fa6c4'; ctx.fillRect(x, y, 1, 2);
  }
  drawFlameTongue(p.x + nx * L - ex, p.y + 4 + ny * L - ey, 2 + Math.round(3 * closing), 3, now * 14); // the thaw's warm front
  for (let k = 0; k < 4; k++) { // sparks rising off it, each on its own beat
    const u = (now * 1.6 + k / 4) % 1, s = 10 + (L - 10) * fxRoll(p.id, k + Math.floor(now * 1.6 + k / 4) * 7, 2);
    const x = Math.round(p.x + nx * s - ex + Math.sin(u * 6 + k) * 1.5), y = Math.round(p.y + 2 + ny * s - ey - u * 9);
    ctx.fillStyle = IG_EMBER; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = u < 0.5 ? IG_CORE : IG_FLAME; ctx.fillRect(x, y, 1, 1);
  }
}
// the passive's wild jump: a tongue of fire leaping in an arc from one alight body to
// the next it lights
function drawFireLeapFx(f, px, py, now) {
  const u = f.t / f.life, nx = Math.cos(f.a), ny = Math.sin(f.a), lead = Math.min(1, u * 3);
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    if (t > lead || t < lead - 0.55) continue;
    const z = Math.sin(Math.PI * t) * Math.min(20, f.r * 0.35);
    const x = Math.round(px + nx * f.r * t), y = Math.round(py + ny * f.r * t - z), hot = lead - t < 0.12;
    ctx.globalAlpha = Math.max(0, 1 - u) * (1 - (lead - t) / 0.55);
    ctx.fillStyle = IG_INK; ctx.fillRect(x - 1, y - 1, hot ? 4 : 3, hot ? 4 : 3);
    ctx.fillStyle = hot ? IG_CORE : i % 2 ? IG_FLAME : IG_EMBER; ctx.fillRect(x, y, hot ? 2 : 1, hot ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.leap = drawFireLeapFx;
HERO_GROUND.push(drawBrushfires);

// ---- on her ---------------------------------------------------------------------
// WARM HANDS waiting: sparks rising off her hands, over the body
function drawIgniaHands(p, ax, ay, now, front) {
  if (!front || !(p.warmT > 0) || CLASSES[p.cls].passive !== 'spreadflame') return;
  for (let k = 0; k < 3; k++) {
    const t = (now * 1.6 + k / 3) % 1;
    const x = ax + (k === 1 ? 3 : 13) + Math.round(Math.sin(now * 5 + k) * 1);
    const y = ay + 11 - Math.round(t * 9);
    ctx.fillStyle = t < 0.5 ? IG_CORE : IG_FLAME;
    ctx.fillRect(x, y, 1, 1);
  }
}
HERO_BODY_FX.push(drawIgniaHands);

// ---- the CROOK AND LANTERN ---------------------------------------------------------
// Her staff (CLASSES' `staff: 'crook'`; HERO_STAVES, js/draw/heroes.js): a shepherd's
// crook carried upright, the fire hung in a lantern from its hook, its heart beating
// between two frames. The hand closes on the shaft at IGNIA_CROOK_GRIP.
const IGNIA_CROOK = [
  '..oooo...',
  '.oGggGo..',
  'oGo..oGo.',
  'oGo..oGo.',
  'oGo...o..',
  'oGo..oyo.',
  'oGo.oYyYo',
  'oGo.ofFfo',
  'oGo.oFWFo',
  'oGo.ofFfo',
  'oGo.oYyYo',
  'oGo..ooo.',
  'oGo......',
  'oGo......',
  'ogo......',
  'oGo......',
  'ogo......',
  '.o.......',
];
const IGNIA_CROOK_GRIP = [1, 10];
const IGNIA_CROOK_PAL = { o: '#2e2440', g: '#6b4a30', G: '#a3794f', y: '#f2cc6a', Y: '#b98a2e', f: '#ff9a3a', F: '#ffe07a', W: '#ffffff' };
let igniaCrookArt = null;
function igniaCrook() {
  if (igniaCrookArt) return igniaCrookArt;
  const beat = IGNIA_CROOK.map((r) => r.replace('oFWFo', 'oFFFo').replace('ofFfo', 'oFfFo'));
  igniaCrookArt = [bakeBladeArt(IGNIA_CROOK, IGNIA_CROOK_PAL), bakeBladeArt(beat, IGNIA_CROOK_PAL)];
  return igniaCrookArt;
}
HERO_STAVES.crook = { art: igniaCrook, grip: IGNIA_CROOK_GRIP };

// ---- WILDFIRE -----------------------------------------------------------------------
// Never a ring: the ground under the aim starts to smoulder from its middle
// out through the wind-up (embers waking in the snow, smoke rising), so the
// patch that will burn is the patch already burning; then fire bursts up out
// of every ember, the middle first, and leaves the snow scorched.
const WILD_SPOTS = 30;
const WILD_SPREAD = 0.12; // s the burst takes from the middle to the rim
function drawWildTele(px, py, closing, now) {
  for (const [sx, sy, r] of fxSpots(WILD_SPOTS)) {
    if (r > closing * 1.4 + 0.15) continue; // the smoulder spreads out from the middle
    const x = Math.round(px + sx * WILD_R), y = Math.round(py + sy * WILD_R);
    ctx.globalAlpha = 0.25 + 0.35 * closing; // the snow going soft and dark round each ember
    ctx.fillStyle = '#8a5a44';
    fillEllipsePx(x, y, 1 + Math.round(3 * closing), 1);
    ctx.globalAlpha = 1;
    if (closing > 0.5) drawFlameTongue(x, y, 1 + Math.round(5 * (closing - 0.5) / 0.5), 2, now * 14 + sx * 9);
    else { ctx.fillStyle = Math.floor(now * 9 + r * 20) % 3 ? '#ff7a2e' : '#ffd95c'; ctx.fillRect(x, y - 1, 2, 1); }
    const w = (now * 1.4 + r * 3.7) % 1; // a wisp of smoke off each ember
    ctx.globalAlpha = 0.55 * (1 - w);
    ctx.fillStyle = '#6f7790';
    ctx.fillRect(x + Math.round(Math.sin(now * 3 + sx * 5) * 1.5), y - 3 - Math.round(w * 10), 1, 1);
  }
  ctx.globalAlpha = 1;
}
function drawWildFx(f, px, py, now) {
  const life = f.life || WILD_FX_LIFE, fade = 1 - f.t / life;
  for (const [sx, sy, r] of fxSpots(WILD_SPOTS)) { // the snow melted to wet earth, lit by the fire, once its flame has gone up
    if (f.t < r * WILD_SPREAD) continue;
    const x = px + sx * WILD_R, y = py + sy * WILD_R;
    ctx.globalAlpha = 0.6 * fade;
    ctx.fillStyle = '#5a3f36'; fillEllipsePx(x, y, 4, 2);
    ctx.globalAlpha = 0.5 * fade * fade;
    ctx.fillStyle = '#ff9a3a'; fillEllipsePx(x, y, 2, 1);
  }
  for (const [sx, sy, r] of fxSpots(WILD_SPOTS)) {
    const u = (f.t - r * WILD_SPREAD) / 0.8; // the middle bursts first
    if (u < 0 || u > 1) continue;
    const x = px + sx * WILD_R, y = py + sy * WILD_R;
    const big = r < 0.4;
    const h = Math.round((big ? 22 : 15) * (0.65 + 0.6 * Math.abs(Math.sin(sx * 17 + sy * 29))) * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.3)), 0.5) * (1 - u * 0.4));
    ctx.globalAlpha = 1;
    drawFlameTongue(x, y, h, big ? 6 : 4, now * 16 + sx * 11);
    ctx.fillStyle = '#ffd95c'; // sparks thrown off the top
    ctx.fillRect(Math.round(x + Math.sin(sx * 13 + u * 4) * 4), Math.round(y - h - u * 14), 1, 1);
    ctx.fillStyle = '#ff7a2e';
    ctx.fillRect(Math.round(x - Math.sin(sy * 11 + u * 3) * 3), Math.round(y - h * 0.6 - u * 9), 1, 1);
  }
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.wildfire = drawWildFx;
