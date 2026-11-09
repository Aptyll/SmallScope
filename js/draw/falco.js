'use strict';
// ------------------------------------------------------------ falco
// FALCO's pixels (his rules: js/sim/falco.js): his hawk over his shoulder, its shadow
// on the snow (HERO_AIR, HERO_GROUND); the hawk out on TALONS, a body in `robots` with
// its own small bar (HERO_MACHINE draw: drawHawkOut); his thrown knives in flight,
// the basic attack's (HERO_SHOTS) and KNIFE FAN's; over a rival his hawk marked, a
// gold talon notch his own side sees (HERO_MARK); up in the sky on STOOP his body is
// gone and only its shadow and a falling dart are drawn (HERO_BODY_DRAW).

const FC_INK = '#2e2440', FC_WING = '#a8794a', FC_WING_D = '#6e4a28', FC_BELLY = '#d9ad72', FC_GOLD = '#f2cc6a', FC_STEEL = '#c8d2e4';

// ---- the hawk -----------------------------------------------------------------------
// a hawk from above at (x, y), wings up or down by the beat, head toward (nx, ny)'s side
function drawHawk(x, y, beat, left) {
  const s = left ? -1 : 1;
  ctx.fillStyle = FC_INK;
  ctx.fillRect(x - 4, y - (beat ? 2 : 0), 9, 2); ctx.fillRect(x - 1, y - 1, 3, 4);
  ctx.fillStyle = FC_WING;
  ctx.fillRect(x - 3, y - (beat ? 2 : 0) + (beat ? 0 : 1) - (beat ? 0 : 1), 3, 1); ctx.fillRect(x + 1, y - (beat ? 2 : 0), 3, 1);
  ctx.fillStyle = FC_BELLY; ctx.fillRect(x, y, 1, 2);
  ctx.fillStyle = FC_WING_D; ctx.fillRect(x, y + 2, 1, 1);
  ctx.fillStyle = FC_GOLD; ctx.fillRect(x + s, y - 1, 1, 1);
}
function hawkShadow(x, y) { ctx.globalAlpha = 0.25; ctx.fillStyle = FC_INK; ctx.fillRect(x - 2, y, 5, 1); ctx.globalAlpha = 1; }
// where the hawk circles over a Falco at home: a slow loop above his shoulder
function hawkHome(p, now) { const a = now * 2.2 + p.id; return { x: p.x + Math.cos(a) * 9, y: p.y - 26 + Math.sin(a) * 3, left: Math.sin(a) > 0 }; }
function falcoHasHawk(p) { return CLASSES[p.cls].passive === 'hawk' && unitAlive(p) && !(p.falcoSkyT > 0) && !(p.falcoDownT > 0) && !falcoHawkOf(p) && !inAir(p); }
function drawFalcoGround(ex, ey, now) {
  for (const p of players) if (falcoHasHawk(p) && fogShown(p, now)) { const h = hawkHome(p, now); hawkShadow(Math.round(h.x - ex), Math.round(p.y - ey) + 4); }
}
function drawFalcoAir(ex, ey, now) {
  const beat = Math.floor(now * 9) % 2;
  for (const p of players) if (falcoHasHawk(p) && fogShown(p, now)) { const h = hawkHome(p, now); drawHawk(Math.round(h.x - ex), Math.round(h.y - ey), beat, h.left); }
  for (const k of falcoKnives) if (fogShown(k, now)) drawThrownKnife(Math.round(k.x - ex), Math.round(k.y - ey) - BOW_Y, k.nx, k.ny, now);
}

// the hawk out (HERO_MACHINE.falcoHawk's draw, in the body pass where its side sees it):
// low over the snow so the disc a blow lands in is where it flies, its shadow under it,
// a rival-or-ally bar over it, white for a blink when struck
function drawHawkOut(b, ex, ey, now) {
  const x = Math.round(b.x - ex), y = Math.round(b.y - ey);
  hawkShadow(x, y + 4);
  drawHawk(x, y - 8, Math.floor(now * 14) % 2, b.face < 0);
  if (b.flash > 0) { ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, y - 10, 9, 5); ctx.globalAlpha = 1; }
  drawHealthBar(b.x - ex, y - 16, b.hp, b.maxHp, 8, b.team, undefined, b);
}

// ---- knives -----------------------------------------------------------------------
// a thrown knife at its tip (x, y) flying along (nx, ny): a short steel line, a dark
// grip behind it, turning end over end every other frame
function drawThrownKnife(x, y, nx, ny, now) {
  const spin = Math.floor(now * 16) % 2;
  const ax = spin ? -ny : nx, ay = spin ? nx : ny;
  for (let k = 0; k < 5; k++) { ctx.fillStyle = FC_INK; ctx.fillRect(Math.round(x - ax * k) - 1, Math.round(y - ay * k), 3, 1); }
  for (let k = 0; k < 5; k++) { ctx.fillStyle = k < 1 ? '#ffffff' : k < 3 ? FC_STEEL : '#6b4a30'; ctx.fillRect(Math.round(x - ax * k), Math.round(y - ay * k), 1, 1); }
}
HERO_SHOTS.knife = (a, sx, sy, now) => drawThrownKnife(Math.round(sx), Math.round(sy), Math.cos(a.ang), Math.sin(a.ang), now);

// ---- over a body -----------------------------------------------------------------------
// a rival the hawk marked, as his own side sees it: a gold talon notch over the head
function drawFalcoMarks(e, px, py, w, h, now) {
  if (!(e.falcoBy >= 0) || !(state.elapsed < e.falcoUntil)) return;
  const o = players[e.falcoBy];
  if (!o || !player || o.team !== player.team) return;
  if (e.falcoUntil - state.elapsed < 1 && Math.floor(now * 8) % 2) return;
  const x = px + (w >> 1), y = py - 6;
  ctx.fillStyle = FC_INK; ctx.fillRect(x - 2, y - 1, 5, 4);
  ctx.fillStyle = FC_GOLD; ctx.fillRect(x - 1, y, 1, 2); ctx.fillRect(x + 1, y, 1, 2); ctx.fillRect(x, y + 1, 1, 1);
}

// ---- STOOP ------------------------------------------------------------------------
// up in the sky: no body on the snow, only its shadow shrinking as he climbs and
// swelling as he falls, and a dark dart high over it
function drawFalcoSky(p, px, py, now) {
  if (!(p.falcoSkyT > 0)) return false;
  const k = 1 - p.falcoSkyT / STOOP_UP; // 0 as he leaves, 1 as he lands
  const up = Math.sin(Math.PI * k);
  ctx.globalAlpha = 0.3; ctx.fillStyle = FC_INK;
  const r = Math.round(5 - 3 * up);
  ctx.fillRect(px + 8 - r, py + 15, r * 2, 1); ctx.fillRect(px + 9 - r, py + 14, r * 2 - 2, 1);
  ctx.globalAlpha = 1;
  const y = Math.round(py + 4 - 60 * up);
  ctx.fillStyle = FC_INK; ctx.fillRect(px + 7, y, 3, 6);
  ctx.fillStyle = FC_WING; ctx.fillRect(px + 8, y + 1, 1, 4);
  return true;
}

HERO_GROUND.push(drawFalcoGround);
HERO_AIR.push(drawFalcoAir);
HERO_MARK.push(drawFalcoMarks);
HERO_BODY_DRAW.push(drawFalcoSky);
