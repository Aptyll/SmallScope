'use strict';
// ------------------------------------------------------------ lucerna
// LUCERNA's pixels (her rules: js/sim/lucerna.js): her lantern's spark in flight
// (HERO_SHOTS), and on the snow (HERO_GROUND) her LAMPLIGHT round her, the crook flying on
// its line, the thrown LANTERN with its pool of light, and the CIRCLE OF LIGHT's rim. Both
// sides see all of it. The lantern she carries hangs from her hand (HERO_STAVES).

const LU_INK = '#2e2440', LU_BRASS = '#f2cc6a', LU_BRASS_D = '#b98a2e', LU_LIGHT = '#fff1b8', LU_WHITE = '#ffffff',
  LU_WOOD = '#a3794f', LU_WOOD_D = '#6b4a30';

// ---- shots -----------------------------------------------------------------------
// her lantern's SPARK: a warm point, a pale tail
function drawLampSpark(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang);
  const x = Math.round(sx), y = Math.round(sy);
  ctx.fillStyle = LU_BRASS_D; ctx.fillRect(Math.round(sx - nx * 4), Math.round(sy - ny * 4), 1, 1);
  ctx.fillStyle = LU_BRASS; ctx.fillRect(Math.round(sx - nx * 2), Math.round(sy - ny * 2), 1, 1);
  ctx.fillStyle = LU_INK; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = Math.sin(now * 20 + a.ox) > 0 ? LU_WHITE : LU_LIGHT; ctx.fillRect(x, y, 1, 1);
}
HERO_SHOTS.lampspark = drawLampSpark;

// ---- on the snow --------------------------------------------------------------------
// a soft pool of lamplight `r` px round (px, py), in rows, every other pixel
function luPool(px, py, r, alpha) {
  ctx.globalAlpha = alpha; ctx.fillStyle = LU_LIGHT;
  for (let y = -Math.floor(r * 0.5); y <= Math.floor(r * 0.5); y++) {
    const w = Math.floor(r * Math.sqrt(1 - (y / (r * 0.5 + 0.5)) ** 2));
    for (let x = -w + ((y & 1)); x <= w; x += 2) ctx.fillRect(px + x, py + y, 1, 1);
  }
  ctx.globalAlpha = 1;
}
// the small lantern at (px, py) (its foot), lit
function luLantern(px, py, now) {
  ctx.fillStyle = LU_INK; ctx.fillRect(px - 3, py - 8, 7, 8); ctx.fillRect(px - 1, py - 10, 3, 2);
  ctx.fillStyle = LU_BRASS_D; ctx.fillRect(px - 2, py - 7, 5, 6);
  ctx.fillStyle = LU_BRASS; ctx.fillRect(px - 2, py - 7, 5, 1); ctx.fillRect(px - 2, py - 2, 5, 1);
  ctx.fillStyle = Math.sin(now * 9) > -0.2 ? LU_LIGHT : LU_BRASS; ctx.fillRect(px - 1, py - 6, 3, 4);
  ctx.fillStyle = LU_WHITE; ctx.fillRect(px, py - 5, 1, 2);
}
function drawLucernaGround(ex, ey, now) {
  // her own LAMPLIGHT: a faint pool round every LUCERNA standing
  for (const p of players) {
    if (!unitAlive(p) || CLASSES[p.cls].passive !== 'lamplight') continue;
    const px = Math.round(p.x - ex), py = Math.round(p.y - ey);
    if (px < -LAMP_R || py < -LAMP_R || px > WV_W + LAMP_R || py > WV_H + LAMP_R) continue;
    luPool(px, py + 2, LAMP_R * 0.6, 0.12 + 0.03 * Math.sin(now * 3));
  }
  for (const c of lucernaCircles) {
    const px = Math.round(c.x - ex), py = Math.round(c.y - ey);
    if (px < -CIRCLE_R - 4 || py < -CIRCLE_R - 4 || px > WV_W + CIRCLE_R + 4 || py > WV_H + CIRCLE_R + 4) continue;
    const k = c.t / CIRCLE_T, a = k > 0.85 ? (1 - k) / 0.15 : 1;
    drawRing(px, py, CIRCLE_R, LU_BRASS, 0.9 * a, 0);
    drawRing(px, py, CIRCLE_R - 3, LU_LIGHT, 0.5 * a, 0);
    // light standing up off the rim, a stroke at a time, walking round it
    for (let i = 0; i < 24; i++) {
      const ang = i / 24 * Math.PI * 2 + now * 0.4;
      const x = Math.round(px + Math.cos(ang) * CIRCLE_R), y = Math.round(py + Math.sin(ang) * CIRCLE_R);
      const h = 3 + ((i * 7) % 4);
      ctx.globalAlpha = a * 0.6; ctx.fillStyle = i % 3 ? LU_LIGHT : LU_WHITE; ctx.fillRect(x, y - h, 1, h);
    }
    ctx.globalAlpha = 1;
  }
  for (const l of lucernaLanterns) {
    const px = Math.round(l.x - ex), py = Math.round(l.y - ey);
    if (px < -LANTERN_SEE || py < -LANTERN_SEE || px > WV_W + LANTERN_SEE || py > WV_H + LANTERN_SEE) continue;
    const left = l.life - l.t;
    luPool(px, py, LANTERN_SEE * 0.8, 0.22);
    drawRing(px, py, LANTERN_R, LU_BRASS, left < 1 && Math.floor(now * 8) % 2 ? 0.3 : 0.75, 0);
    luLantern(px, py, now);
  }
  for (const h of lucernaHooks) {
    const o = players[h.owner];
    const px = Math.round(h.x - ex), py = Math.round(h.y - ey);
    // the line back to her hand, then the hook
    if (o) {
      const ox = o.x - ex, oy = o.y - BOW_Y - ey, n = Math.max(1, Math.round(Math.hypot(px - ox, py - oy) / 3));
      ctx.fillStyle = LU_WOOD;
      for (let i = 1; i < n; i++) ctx.fillRect(Math.round(ox + (px - ox) * i / n), Math.round(oy + (py - oy) * i / n), 1, 1);
    }
    ctx.fillStyle = LU_INK; ctx.fillRect(px - 2, py - 3, 5, 6);
    ctx.fillStyle = LU_WOOD; ctx.fillRect(px - 1, py - 2, 3, 1); ctx.fillRect(px + 1, py - 2, 1, 3); ctx.fillRect(px - 1, py - 1, 1, 3);
    ctx.fillStyle = LU_WOOD_D; ctx.fillRect(px - 1, py + 1, 1, 1);
  }
}
HERO_GROUND.push(drawLucernaGround);

// ---- the LANTERN ----------------------------------------------------------------------
// What she carries (CLASSES' `staff: 'lantern'`; HERO_STAVES, js/draw/heroes.js): a brass
// lamplighter's lantern hung from her hand by its ring, lit; the flame breathes between two
// frames. The hand closes on the ring at LUCERNA_LANTERN_GRIP.
const LUCERNA_LANTERN = [
  '..ooo..',
  '..o.o..',
  '.ooooo.',
  '.oyYyo.',
  'oyFWFyo',
  'oyFFFyo',
  'oyfFfyo',
  '.oYyYo.',
  '..ooo..',
];
const LUCERNA_LANTERN_GRIP = [3, 1];
const LUCERNA_LANTERN_PAL = { o: '#2e2440', y: '#f2cc6a', Y: '#b98a2e', f: '#f2cc6a', F: '#fff1b8', W: '#ffffff' };
let lucernaLanternArt = null;
function lucernaLantern() {
  if (lucernaLanternArt) return lucernaLanternArt;
  const beat = LUCERNA_LANTERN.map((r) => r.replace('oyFWFyo', 'oyWFWyo'));
  lucernaLanternArt = [bakeBladeArt(LUCERNA_LANTERN, LUCERNA_LANTERN_PAL), bakeBladeArt(beat, LUCERNA_LANTERN_PAL)];
  return lucernaLanternArt;
}
HERO_STAVES.lantern = { art: lucernaLantern, grip: LUCERNA_LANTERN_GRIP };

// ---- the status plate -------------------------------------------------------------
// PULLED (lucernaPull, js/sim/lucerna.js) on the frame's plate (statusIcon,
// js/draw/overhead.js): a rival caught on the crook's line, stunned for the trip, wears
// the crook; an ally carried by the lantern is not stunned and wears nothing
statusIcon({ id: 'pull', rank: 20, on: (e) => e.pullT > 0 && e.stunT > 0, left: (e) => e.stunT, max: (e) => e.stunMax,
  ink: LU_BRASS, lit: LU_LIGHT, deep: LU_WOOD_D,
  px: ['...##..', '...#...', '...#...', '...#...', '+..#...', '#..#...', '.##....'] });
