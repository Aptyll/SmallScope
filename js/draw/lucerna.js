'use strict';
// ------------------------------------------------------------ lucerna
// LUCERNA's pixels (her rules: js/sim/lucerna.js): her lantern's spark in flight
// (HERO_SHOTS), and on the snow (HERO_GROUND) her LAMPLIGHT round her, the crook flying on
// its line, the thrown LANTERN with its pool of light, and the CIRCLE OF LIGHT's rim. Both
// sides see all of it. The lantern she carries hangs from her hand (HERO_STAVES).

const LU_INK = '#2e2440', LU_BRASS = '#f2cc6a', LU_BRASS_D = '#b98a2e', LU_LIGHT = '#fff1b8', LU_WHITE = '#ffffff',
  LU_WOOD = '#a3794f', LU_WOOD_D = '#6b4a30';

// ---- shots -----------------------------------------------------------------------
// her lantern's SPARK: a warm ball of lamplight with four short rays that come and go, a brass streak behind it
function drawLampSpark(a, sx, sy, now) {
  const nx = Math.cos(a.ang), ny = Math.sin(a.ang), x = Math.round(sx), y = Math.round(sy), k = Math.floor(now * 12 + a.ox) % 2;
  fxTail(sx, sy, nx, ny, 6, LU_BRASS, LU_BRASS_D);
  fxHeadInk(x, y, 2, LU_INK);
  ctx.fillStyle = LU_BRASS; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = LU_LIGHT; ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.fillStyle = LU_WHITE; ctx.fillRect(x, y, 1, 1);
  ctx.fillStyle = LU_BRASS_D; // the rays: upright, then slanted
  for (const [dx, dy] of k ? [[3, 3], [-3, 3], [3, -3], [-3, -3]] : [[4, 0], [-4, 0], [0, 4], [0, -4]]) ctx.fillRect(x + dx, y + dy, 1, 1);
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
// lamplight lying on the snow `r` px round (px, py): the snow warmed amber, deeper at its
// heart, its edge broken so it reads as light spilt and never as a ring
function luWarm(px, py, r, alpha, seed) {
  ctx.globalAlpha = alpha * 0.55; fxPatch(px, py, r, 0.55, 7, seed, '#f0b24a');
  ctx.globalAlpha = alpha * 0.6; fxPatch(px, py, Math.round(r * 0.6), 0.55, 5, seed + 1, '#ffd27a');
  ctx.globalAlpha = 1;
}
// the small lantern at (px, py) (its foot), lit
function luLantern(px, py, now) {
  ctx.fillStyle = LU_INK; ctx.fillRect(px - 3, py - 8, 7, 8); ctx.fillRect(px - 1, py - 10, 3, 2);
  ctx.fillStyle = LU_BRASS_D; ctx.fillRect(px - 2, py - 7, 5, 6);
  ctx.fillStyle = LU_BRASS; ctx.fillRect(px - 2, py - 7, 5, 1); ctx.fillRect(px - 2, py - 2, 5, 1);
  ctx.fillStyle = Math.sin(now * 9) > -0.2 ? LU_LIGHT : LU_BRASS; ctx.fillRect(px - 1, py - 6, 3, 4);
  ctx.fillStyle = LU_WHITE; ctx.fillRect(px - 1, py - 5, 3, 2); ctx.fillRect(px, py - 6, 1, 4); // its flame, a bright core
  const b = Math.floor(now * 6) % 2; // and the light it throws, four short rays that breathe
  ctx.fillStyle = LU_BRASS; ctx.fillRect(px - 6 - b, py - 4, 2, 1); ctx.fillRect(px + 5 + b, py - 4, 2, 1); ctx.fillRect(px, py - 13 - b, 1, 2);
  ctx.fillStyle = LU_LIGHT; ctx.fillRect(px - 5, py - 9, 1, 1); ctx.fillRect(px + 5, py - 9, 1, 1);
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
    // its edge is the posts of light standing round it and the warm snow at each one's
    // foot, bead by bead and uneven: no line is drawn
    for (let i = 0; i < 24; i++) {
      const ang = i / 24 * Math.PI * 2 + now * 0.4;
      const x = Math.round(px + Math.cos(ang) * CIRCLE_R), y = Math.round(py + Math.sin(ang) * CIRCLE_R);
      ctx.globalAlpha = a * 0.45; fxPatch(x, y + 1, 4 + (i * 5) % 4, 0.5, 3, i, i % 2 ? '#f0b24a' : '#ffd27a');
    }
    for (let i = 0; i < 24; i++) {
      const ang = i / 24 * Math.PI * 2 + now * 0.4;
      const x = Math.round(px + Math.cos(ang) * CIRCLE_R), y = Math.round(py + Math.sin(ang) * CIRCLE_R);
      const h = 4 + ((i * 7) % 5);
      ctx.globalAlpha = a * 0.9; ctx.fillStyle = LU_BRASS_D; ctx.fillRect(x, y - h, 2, h + 1);
      ctx.fillStyle = i % 3 ? LU_BRASS : LU_LIGHT; ctx.fillRect(x, y - h, 1, h);
      ctx.fillStyle = LU_WHITE; ctx.fillRect(x, y - h, 2, 1);
    }
    ctx.globalAlpha = 1;
  }
  for (const l of lucernaLanterns) {
    const px = Math.round(l.x - ex), py = Math.round(l.y - ey);
    if (px < -LANTERN_SEE || py < -LANTERN_SEE || px > WV_W + LANTERN_SEE || py > WV_H + LANTERN_SEE) continue;
    const left = l.life - l.t;
    const seed = (Math.round(l.x) * 7 + Math.round(l.y) * 13) | 0;
    luWarm(px, py, Math.round(LANTERN_SEE * 0.8), 0.7, seed);
    if (!(left < 1 && Math.floor(now * 8) % 2)) { ctx.globalAlpha = 0.6; fxPatch(px, py, LANTERN_R, 0.6, 3, seed + 2, LU_LIGHT); ctx.globalAlpha = 1; } // the bright heart an ally steps on
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
// ---- the keys' own looks -----------------------------------------------------------------
// SHEPHERD'S CROOK's wind-up: the hook's line run out down the aim, a glint of her lamp
// running along it to the hook at the end of its throw
function drawCrookTele(p, a, closing, now, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = CROOK_RANGE * (0.3 + 0.7 * closing), x0 = p.x - ex, y0 = p.y - BOW_Y - ey;
  const glint = ((now * 260) % L);
  ctx.globalAlpha = 0.5 + 0.45 * closing;
  for (let s = 8; s < L; s++) {
    const x = Math.round(x0 + nx * s), y = Math.round(y0 + ny * s);
    ctx.fillStyle = LU_INK; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = Math.abs(s - glint) < 3 ? LU_LIGHT : LU_WOOD; ctx.fillRect(x, y, 1, 1);
  }
  const hx = Math.round(x0 + nx * L), hy = Math.round(y0 + ny * L);
  ctx.fillStyle = LU_INK; ctx.fillRect(hx - 2, hy - 3, 5, 6);
  ctx.fillStyle = LU_WOOD; ctx.fillRect(hx - 1, hy - 2, 3, 1); ctx.fillRect(hx + 1, hy - 2, 1, 3); ctx.fillRect(hx - 1, hy - 1, 1, 3);
  ctx.globalAlpha = 1;
}
// LANTERN's wind-up: the light gathering on the spot it will land, brightest at its heart
function drawLanternTele(x, y, closing) {
  luWarm(x, y, Math.round(LANTERN_SEE * 0.8 * (0.3 + 0.7 * closing)), 0.4 + 0.4 * closing, 11);
}
// CIRCLE OF LIGHT's wind-up: strokes of light standing up round her one after another,
// round the whole rim it will light, before the light fills in between
function drawCircleTele(px, py, closing, now) {
  const n = Math.floor(24 * closing);
  for (let i = 0; i < n; i++) {
    const ang = i / 24 * Math.PI * 2 - Math.PI / 2, x = Math.round(px + Math.cos(ang) * CIRCLE_R), y = Math.round(py + Math.sin(ang) * CIRCLE_R);
    const h = 3 + ((i * 7) % 4) + (i === n - 1 ? 3 : 0);
    ctx.fillStyle = LU_BRASS_D; ctx.fillRect(x, y - h, 2, h + 1); // light, so never inked: brass under, bright on top
    ctx.fillStyle = LU_BRASS; ctx.fillRect(x, y - h, 1, h);
    ctx.fillStyle = LU_WHITE; ctx.fillRect(x, y - h, 2, 1);
  }
}
// SHOO landing: the crook swept through in a wooden arc, a puff of snow off its end and a
// scatter of lamplight
function drawShooFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  drawSwoosh(px, py, f.a, f.r, f.half, u, 6, [LU_INK, LU_LIGHT, LU_WOOD], 1);
  drawFlung(px, py, f.a, f.half, f.r + 8, 0.6, 6, 9, Math.min(1, u * 1.5), seed, (x, y, k) => {
    ctx.fillStyle = k % 3 ? '#ffffff' : LU_BRASS; ctx.fillRect(x, y, k % 3 ? 2 : 1, 1);
  });
}
AB_FX_LOOK.shoo = drawShooFx;

// ---- the LANTERN ----------------------------------------------------------------------
// What she carries (CLASSES' `staff: 'lantern'`; HERO_STAVES, js/draw/heroes.js): a brass
// lamplighter's lantern hung from her hand by its ring, lit behind dark corner posts under a
// brass eave; the flame breathes between two
// frames. The hand closes on the ring at LUCERNA_LANTERN_GRIP.
const LUCERNA_LANTERN = [
  '..ooo..',
  '..o.o..',
  '.ooooo.',
  'oYyyyYo',
  'onFWFno',
  'onFFFno',
  'onfFfno',
  'oYyyyYo',
  '.ooooo.',
];
const LUCERNA_LANTERN_GRIP = [3, 1];
const LUCERNA_LANTERN_PAL = { o: '#2e2440', y: '#f2cc6a', Y: '#b98a2e', f: '#f2cc6a', F: '#fff1b8', W: '#ffffff', n: '#5a4a3c' };
let lucernaLanternArt = null;
function lucernaLantern() {
  if (lucernaLanternArt) return lucernaLanternArt;
  const beat = LUCERNA_LANTERN.map((r) => r.replace('onFWFno', 'onWFWno'));
  lucernaLanternArt = [bakeBladeArt(LUCERNA_LANTERN, LUCERNA_LANTERN_PAL), bakeBladeArt(beat, LUCERNA_LANTERN_PAL)];
  return lucernaLanternArt;
}
HERO_STAVES.lantern = { art: lucernaLantern, grip: LUCERNA_LANTERN_GRIP, cast: { up: 5, out: 1 } }; // gathering a cast she holds it aloft

// ---- the status plate -------------------------------------------------------------
// PULLED (lucernaPull, js/sim/lucerna.js) on the frame's plate (statusIcon,
// js/draw/overhead.js): a rival caught on the crook's line, stunned for the trip, wears
// the crook; an ally carried by the lantern is not stunned and wears nothing
statusIcon({ id: 'pull', rank: 20, on: (e) => e.pullT > 0 && e.stunT > 0, left: (e) => e.stunT, max: (e) => e.stunMax,
  ink: LU_BRASS, lit: LU_LIGHT, deep: LU_WOOD_D,
  px: ['...##..', '...#...', '...#...', '...#...', '+..#...', '#..#...', '.##....'] });
