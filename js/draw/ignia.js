'use strict';
// ------------------------------------------------------------ ignia
// IGNIA's pixels (her rules: js/sim/ignia.js): the FIREBRAND in flight and her
// staff's ember shot (HERO_SHOTS), BRUSHFIRE's line on the snow and the strip it
// melts (HERO_GROUND), its wind-up, and WARM HANDS' sparks at her hands while
// the warmth waits (HERO_BODY_FX). A body she set burning wears the shared
// flames (drawUnitStates); the wildfire's jumps flash as lines (abFx).

const IG_INK = '#2e2440', IG_EMBER = '#d8502e', IG_FLAME = '#ff9a3a', IG_CORE = '#ffe07a';

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
// her staff's EMBER: a hot mote and two cooling behind it
function drawEmberShot(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang);
  const x = Math.round(sx), y = Math.round(sy);
  ctx.fillStyle = IG_EMBER;
  ctx.fillRect(Math.round(sx - nx * 4), Math.round(sy - ny * 4), 1, 1);
  ctx.fillStyle = IG_FLAME;
  ctx.fillRect(Math.round(sx - nx * 2), Math.round(sy - ny * 2), 1, 1);
  ctx.fillStyle = IG_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = Math.sin(now * 20 + a.ox) > 0 ? IG_CORE : IG_FLAME; ctx.fillRect(x, y, 1, 1);
}
HERO_SHOTS.brand = drawBrandShot;
HERO_SHOTS.ember = drawEmberShot;

// ---- on the snow ------------------------------------------------------------------
// the wind-up: the line the fire will lie along, its two ends marked
function drawBrushTele(cx, cy, nx, ny, col, alpha) {
  ctx.globalAlpha = alpha;
  const h = BRUSH_LEN / 2;
  for (let s = -h; s <= h; s += 3) {
    const x = Math.round(cx + nx * s), y = Math.round(cy + ny * s);
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y + 1, 2, 2);
    ctx.fillStyle = col; ctx.fillRect(x, y, 2, 2);
  }
  for (const e of [-h, h]) {
    const x = Math.round(cx + nx * e), y = Math.round(cy + ny * e);
    ctx.fillStyle = col; ctx.fillRect(x - 1, y - 2, 3, 5);
  }
  ctx.globalAlpha = 1;
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
