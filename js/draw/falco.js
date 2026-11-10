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
// (HERO_OVER: in the row over its stack, never on the head under the frame)
const falcoSees = (e) => {
  if (!(e.falcoBy >= 0) || !(state.elapsed < e.falcoUntil)) return false;
  const o = players[e.falcoBy];
  return !!(o && player && o.team === player.team);
};
HERO_OVER.push({
  w: (e) => (falcoSees(e) ? 5 : 0),
  draw: (e, x0, y, now) => {
    if (e.falcoUntil - state.elapsed < 1 && Math.floor(now * 8) % 2) return;
    const x = x0 + 2;
    ctx.fillStyle = FC_INK; ctx.fillRect(x - 2, y - 1, 5, 4);
    ctx.fillStyle = FC_GOLD; ctx.fillRect(x - 1, y, 1, 2); ctx.fillRect(x + 1, y, 1, 2); ctx.fillRect(x, y + 1, 1, 1);
  },
});

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

// ---- the keys' own looks -------------------------------------------------------------
// TALONS' wind-up: the hawk's shadow already wheeling over the spot it is sent to,
// tightening its turn as he lets it go
function drawTalonsTele(x, y, closing, now) {
  const r = TALON_R * (1 - 0.6 * closing);
  for (let k = 0; k < 2; k++) {
    const t = now * 4 + k * Math.PI;
    ctx.globalAlpha = 0.25 + 0.3 * closing; ctx.fillStyle = FC_INK;
    const sx = Math.round(x + Math.cos(t) * r), sy = Math.round(y + Math.sin(t) * r * 0.6);
    ctx.fillRect(sx - 4, sy, 9, 1); ctx.fillRect(sx - 1, sy - 1, 3, 3); // wings out, the body
  }
  ctx.globalAlpha = 1;
}
// KNIFE FAN's wind-up: the three blades fanned in his hand, each sending a glint down
// its line as far as it flies
function drawFanTele(p, a0, closing, ex, ey) {
  for (let k = -1; k <= 1; k++) {
    const a = a0 + k * FAN_SPREAD, nx = Math.cos(a), ny = Math.sin(a), x0 = p.x - ex, y0 = p.y - BOW_Y - ey;
    ctx.globalAlpha = 0.25 + 0.35 * closing; ctx.fillStyle = FC_STEEL;
    for (let s = 16; s < FAN_LEN * closing; s += 1) if (s % 3) ctx.fillRect(Math.round(x0 + nx * s), Math.round(y0 + ny * s), 1, 1);
    ctx.globalAlpha = 1;
    drawThrownKnife(Math.round(x0 + nx * 12), Math.round(y0 + ny * 12), nx, ny, 0);
  }
}
// STOOP's landing: three talon rakes torn across the snow where he dropped, feathers
// and snow thrown up round them
function drawStoopFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - u));
  ctx.fillStyle = '#7f98bc'; fillEllipsePx(px, py + 3, 10, 4);
  for (let k = -1; k <= 1; k++) for (let s = -9; s <= 9; s++) { // the rakes, down and across
    const x = px + k * 5 + Math.round(s * 0.5), y = py + 3 + s;
    if (Math.abs(s) > 9 - Math.abs(k) * 2) continue;
    ctx.fillStyle = FC_INK; ctx.fillRect(x, y, 2, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y, 1, 1);
  }
  drawFlung(px, py, 0, Math.PI, f.r + 10, 0.4, 16, 12, Math.min(1, u * 1.3), seed, (x, y, k) => {
    if (k % 3) { ctx.fillStyle = '#f4f7ff'; ctx.fillRect(x, y, 2, 2); return; }
    ctx.fillStyle = FC_INK; ctx.fillRect(x - 1, y, 4, 2); // a feather, turning down
    ctx.fillStyle = FC_WING; ctx.fillRect(x, y, 2, 1);
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.stoop = drawStoopFx;

HERO_GROUND.push(drawFalcoGround);
HERO_AIR.push(drawFalcoAir);
HERO_BODY_DRAW.push(drawFalcoSky);

// ---- the knife in his hand -----------------------------------------------------------
// At rest it hangs point down from the fist at his side, forward of him side-on
// (FALCO_KNIFE, js/sprites/falco.js; HERO_CARRY): a short blade, never held out level.
// Thrown, the hand cocks it back over the shoulder and flings empty (HERO_AIMED).
function falcoCarry(p, px, py) {
  if (attackOf(p).art !== 'knife') return false;
  const lead = p.dir === 'down' || p.dir === 'right', side = p.dir === 'left' || p.dir === 'right', rc = heroReach(p);
  const k = side ? FALCO_KNIFE.fwd : FALCO_KNIFE.down, img = lead ? k.img : heldFlip(k.img);
  const hx = lead ? px + (side ? 12 : 13) + rc : px + (side ? 3 : 2) - rc, hy = py + 11;
  ctx.drawImage(img, hx - (lead ? k.grip[0] : img.width - 1 - k.grip[0]), hy - k.grip[1]);
  if (p.dir !== 'up') heroFist(p, hx, hy, lead ? 1 : -1);
  return true;
}
HERO_CARRY.push(falcoCarry);
HERO_AIMED.knife = (heading, step) => FALCO_KNIFE_AIM[heading][step];
