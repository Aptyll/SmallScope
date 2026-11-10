'use strict';
// ------------------------------------------------------------ idle
// A hero standing still is not a statue: it breathes, two frames a pixel apart
// (heroBreath, js/sprites/armatos.js), and the loose cloth on it - hair, a braid, a
// cape, a skirt's hem - hangs one frame behind after it stops or turns (heroCloth).
// Draw only: read off what drawPlayer already shows (the facing and whether the body
// strides), kept per body on this screen, never in the sim.

const IDLE_BREATH_T = 0.8; // s each breath frame holds: a slow breath, one in about a second and a half
const CLOTH_LAG_T = 0.12;  // s the cloth hangs a pixel behind: one step of the body's stepped motion
const DIR_X = { left: -1, right: 1, up: 0, down: 0 }, DIR_Y = { left: 0, right: 0, up: -1, down: 1 };

const idleOf = new WeakMap();
// once a frame, from drawPlayer: what the body did since the last frame. A stop
// swings the cloth on along the way it was going; a turn leaves it on the side it
// turned from. A second paint of the same instant changes nothing: only time passing
// moves the cloth, so a repaint (the snapshot's proof, netEcho) draws the same body.
function idleTick(p, striding, now) {
  let s = idleOf.get(p);
  if (!s) idleOf.set(p, (s = { dir: p.dir, striding, mx: 0, my: 0, t: -1e9, dx: 0, dy: 0, now }));
  s.b = 0; s.lag = null;
  if (now === s.now) return;
  s.now = now;
  if (striding) {
    const sp = Math.hypot(p.vx, p.vy) || 1;
    s.mx = Math.abs(p.vx / sp) > 0.38 ? Math.sign(p.vx) : 0;
    s.my = Math.abs(p.vy / sp) > 0.38 ? Math.sign(p.vy) : 0;
  } else if (s.striding && (s.mx || s.my)) {
    s.t = now; s.dx = s.mx; s.dy = s.my;
  } else if (s.dir !== p.dir) {
    s.t = now; s.dx = DIR_X[s.dir] - DIR_X[p.dir]; s.dy = DIR_Y[s.dir] - DIR_Y[p.dir];
    s.dx = Math.sign(s.dx); s.dy = Math.sign(s.dy);
  }
  s.striding = striding; s.dir = p.dir;
}
// the breath frame (0 or 1) for a body standing still: each body on its own phase,
// so a line of heroes never breathes in step
function idleBreath(p, now) {
  const s = idleOf.get(p);
  if (s && s.striding) return 0;
  return Math.floor(now / IDLE_BREATH_T + (p.id || 0) * 0.37) % 2;
}
// where the cloth hangs this frame: { dx, dy } a pixel off, or null when it rests
function idleCloth(p, now) {
  const s = idleOf.get(p);
  return s && !s.striding && now - s.t < CLOTH_LAG_T && now >= s.t && (s.dx || s.dy) ? s : null;
}
// the standing frame drawPlayer shows: the breath, with the cloth behind when it lags
function idleFrame(p, now, look = classSet(p)) {
  const b = idleBreath(p, now), c = idleCloth(p, now), s = idleOf.get(p);
  if (s) { s.b = b; s.lag = c; }
  return (c && look.cloth(p.dir, c.dx, c.dy, b)) || look.breath[p.dir][b];
}
// what the body shows this frame, for what rides on it (ARMATOS's standard, js/draw/armatos.js):
// `b` 1 while the shoulders are down a pixel, `lag` the cloth's { dx, dy } or null
function idleShown(p) { return idleOf.get(p) || { b: 0, lag: null }; }
