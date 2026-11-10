'use strict';
// ------------------------------------------------------------ falco
// FALCO's pixels (his rules: js/sim/falco.js): his hawk on his glove (HERO_BODY_FX);
// the hawk out on TALONS, a body in `robots` with
// its own small bar (HERO_MACHINE draw: drawHawkOut); his thrown knives in flight,
// the basic attack's (HERO_SHOTS) and KNIFE FAN's; over a rival his hawk marked, a
// gold talon notch his own side sees (HERO_MARK); up in the sky on STOOP his body is
// gone: his hawk carries him over to the marked hero, their shadow under them (HERO_BODY_DRAW).

const FC_INK = '#2e2440', FC_WING = '#a8794a', FC_WING_D = '#6e4a28', FC_BELLY = '#d9ad72', FC_GOLD = '#f2cc6a', FC_STEEL = '#c8d2e4';

// ---- the hawk -----------------------------------------------------------------------
// a hawk from above at (x, y), wings up or down by the beat, head toward (nx, ny)'s side
function drawHawk(x, y, beat, left) {
  const s = left ? -1 : 1, span = beat ? 5 : 7;
  const wy = (d) => (beat ? -Math.round(d * 0.6) : d > 4 ? d - 4 : 0), th = (d) => (d <= 2 ? 3 : d <= span - 2 ? 2 : 1);
  ctx.fillStyle = FC_INK;
  for (let dx = -span - 1; dx <= span + 1; dx++) { const d = Math.min(span, Math.abs(dx)); ctx.fillRect(x + dx, y + wy(d) - 1, 1, th(d) + 2); }
  ctx.fillRect(x - 2, y - 4, 5, 8); ctx.fillRect(x - 3, y + 3, 7, 3); // head, body, the tail's fan
  for (let dx = -span; dx <= span; dx++) { const d = Math.abs(dx); ctx.fillStyle = d >= span - 1 ? FC_WING_D : FC_WING; ctx.fillRect(x + dx, y + wy(d), 1, th(d)); }
  ctx.fillStyle = FC_WING; ctx.fillRect(x - 1, y - 3, 3, 6);
  ctx.fillStyle = FC_WING_D; ctx.fillRect(x - 2, y + 4, 5, 1); ctx.fillRect(x - 1, y + 3, 3, 1);
  ctx.fillStyle = FC_BELLY; ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 2, y + 4, 1, 1); ctx.fillRect(x + 2, y + 4, 1, 1);
  ctx.fillStyle = FC_GOLD; ctx.fillRect(x + s, y - 3, 1, 1);
}
function hawkShadow(x, y) { ctx.globalAlpha = 0.3; ctx.fillStyle = FC_INK; ctx.fillRect(x - 6, y, 13, 1); ctx.fillRect(x - 3, y - 1, 7, 1); ctx.fillRect(x - 1, y - 2, 3, 5); ctx.globalAlpha = 1; }
function falcoHasHawk(p) { return CLASSES[p.cls].passive === 'hawk' && unitAlive(p) && !(p.falcoSkyT > 0) && !(p.falcoDownT > 0) && !falcoHawkOf(p) && !inAir(p); }
// At home the hawk sits on his glove (THE GRIP RULE's other hand): a tan gauntlet raised on
// the side away from the knife, in every facing, and the hawk on it, outside the body's
// box, looking outward in every facing, so its pale breast always shows. The glove stays up,
// empty, while the hawk is out on TALONS or cut down. HERO_BODY_FX, over the body.
function drawFalcoPerch(p, ax, ay, now, front) {
  if (!front || CLASSES[p.cls].passive !== 'hawk' || p.zip >= 0 || p.falcoSkyT > 0 || p.dodgeT > 0 || inAir(p)) return;
  const lead = p.dir === 'down' || p.dir === 'right', side = p.dir === 'left' || p.dir === 'right', rc = heroReach(p);
  const bob = !p.moving ? 0 : -runBob(p);
  // the glove: 3 px of tan on the off side, its outline outside and under it; the hawk stands on its outer px, so its head clears his hat
  const gx = lead ? ax + (side ? 1 : 0) - rc : ax + (side ? 12 : 13) + rc, gy = ay + (heroAimed(p) ? 12 : 10) + bob; // the bird's head at his eye line; down at the hip while the knife arm is up, so only one arm is raised
  const fine = bodySet(p).dens > 1; // his fine body's glove and hawk are fine too (FALCO_FINE_ART)
  if (fine) ctx.drawImage(FALCO_FINE_ART.glove, gx - 1, gy - 1, 5, 4);
  else { ctx.fillStyle = FC_INK; ctx.fillRect(gx, gy - 1, 3, 4); ctx.fillRect(gx - 1, gy, 5, 2); ctx.fillStyle = FALCO_GLOVE; ctx.fillRect(gx, gy, 3, 1); ctx.fillStyle = FALCO_GLOVE_D; ctx.fillRect(gx, gy + 1, 3, 1); } // a round fist, darker under, never a box
  if (!falcoHasHawk(p)) return;
  const right = !lead, hawk = fine ? FALCO_FINE_ART.hawk : FALCO_HAWK; // which way the hawk looks
  const img = right ? hawk : heldFlip(hawk);
  const fx = right ? FALCO_HAWK_FOOT[0] : heldW(img) - 1 - FALCO_HAWK_FOOT[0];
  ctx.drawImage(img, gx + 1 + (lead ? -1 : 1) - fx, gy - 1 - FALCO_HAWK_FOOT[1] - (Math.floor(now * 1.2 + p.id) % 5 === 0 ? 1 : 0), heldW(img), heldH(img)); // now and then it shifts its feet
}
HERO_BODY_FX.push(drawFalcoPerch);
function drawFalcoAir(ex, ey, now) {
  for (const k of falcoKnives) if (fogShown(k, now)) drawThrownKnife(Math.round(k.x - ex), Math.round(k.y - ey) - BOW_Y, k.nx, k.ny, now);
  for (const p of players) if (p.falcoSkyT > 0 && fogShown(p, now)) drawFalcoStoop(p, Math.round(p.x - 8 - ex), Math.round(p.y - 12 - ey), now); // the body's own box corner
}

// the hawk out (HERO_MACHINE.falcoHawk's draw, in the body pass where its side sees it):
// low over the snow so the disc a blow lands in is where it flies, its shadow under it,
// a rival-or-ally bar over it
function drawHawkOut(b, ex, ey, now) {
  const x = Math.round(b.x - ex), y = Math.round(b.y - ey);
  hawkShadow(x, y + 4);
  drawHawk(x, y - 8, Math.floor(now * 14) % 2, b.face < 0);
  drawHealthBar(b.x - ex, y - 16, b.hp, b.maxHp, 8, b.team, undefined, b);
}

// ---- knives -----------------------------------------------------------------------
// a thrown knife at its tip (x, y) flying along (nx, ny): the knife his hand carries (FALCO_KNIFE), pale steel,
// a gold guard and the tan grip behind it, turning end over end every other frame
function drawThrownKnife(x, y, nx, ny, now) {
  const spin = Math.floor(now * 16) % 2;
  const ax = spin ? -ny : nx, ay = spin ? nx : ny;
  for (let k = 2; k <= 6; k++) { ctx.fillStyle = k < 5 ? '#4f6288' : '#7f98bc'; ctx.fillRect(Math.round(x - nx * (5 + k)), Math.round(y - ny * (5 + k)), 1, 1); } // the air it cut
  for (let k = 0; k < 7; k++) { ctx.fillStyle = FC_INK; ctx.fillRect(Math.round(x - ax * k) - 1, Math.round(y - ay * k) - 1, 3, 3); }
  for (let k = 0; k < 7; k++) { ctx.fillStyle = k < 2 ? '#ffffff' : k < 4 ? FC_STEEL : k < 5 ? FC_GOLD : '#a3794f'; ctx.fillRect(Math.round(x - ax * k), Math.round(y - ay * k), 1, 1); }
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
// up in the sky: no body on the snow. His hawk carries him up off his spot and over to the hero it marked (where
// this screen can see that hero), wings beating on the climb and folded on the fall, his knife out under him on
// the way down; their shadow runs along the snow beneath, small at the top of the arc and wide as he lands
function drawFalcoSky(p) { return p.falcoSkyT > 0; } // HERO_BODY_DRAW: nothing where he stood
function drawFalcoStoop(p, px, py, now) { // HERO_AIR, over the field: the body pass keeps a body to its own box
  const k = 1 - p.falcoSkyT / STOOP_UP; // 0 as he leaves, 1 as he lands
  const up = Math.sin(Math.PI * k), e = k * k * (3 - 2 * k), fall = k > 0.5;
  const q = p.falcoStoopId >= 0 ? players[p.falcoStoopId] : null, seen = q && unitAlive(q) && fogShown(q, now);
  const gx = Math.round(px + 8 + (seen ? (q.x - p.x) * e : 0)), gy = Math.round(py + 15 + (seen ? (q.y - p.y) * e : 0)); // the snow under him
  const s = seen && q.x < p.x ? -1 : 1, y = gy - 13 - Math.round(60 * up), tm = TEAMS[skin(p.team)];
  // the shadow: the bird's spread wings high up, closing to a body's width as he comes down
  const r = Math.round(9 - 4 * up);
  ctx.globalAlpha = 0.3; ctx.fillStyle = FC_INK;
  ctx.fillRect(gx - r, gy, r * 2 + 1, 1); ctx.fillRect(gx - r + 2, gy - 1, r * 2 - 3, 1); ctx.fillRect(gx - r + 2, gy + 1, r * 2 - 3, 1); ctx.fillRect(gx - 1, gy - 2, 3, 5);
  ctx.globalAlpha = 1;
  if (fall) for (let j = 0; j < 3; j++) { // the air he falls through, behind him
    ctx.fillStyle = j ? '#7f98bc' : '#4f6288'; ctx.fillRect(gx - 3 + j * 3, y - 14 - j * 2, 1, 5 - j);
  }
  drawHawk(gx, y - 4, fall || Math.floor(now * 14) % 2, s < 0); // the hawk over him: beating up, folded down
  // him under it: hat, face, coat in his side's colour, boots, all inked
  ctx.fillStyle = FC_INK; ctx.fillRect(gx - 3, y + 1, 7, 9); ctx.fillRect(gx - 2, y + 10, 5, 1);
  ctx.fillStyle = '#56784e'; ctx.fillRect(gx - 2, y + 2, 5, 1); ctx.fillRect(gx - 1, y + 1, 3, 1);
  ctx.fillStyle = '#3c5a3a'; ctx.fillRect(gx - 2, y + 3, 5, 1);
  ctx.fillStyle = '#e8b890'; ctx.fillRect(gx - 1 + (s > 0 ? 1 : 0), y + 4, 2, 1);
  ctx.fillStyle = tm.mark; ctx.fillRect(gx - 2, y + 5, 5, 3);
  ctx.fillStyle = tm.coatD; ctx.fillRect(gx - 2, y + 7, 5, 1);
  ctx.fillStyle = '#5a4030'; ctx.fillRect(gx - 2, y + 8, 2, 2); ctx.fillRect(gx + 1, y + 8, 2, 2);
  if (fall) { // the knife leads the fall
    ctx.fillStyle = FC_INK; ctx.fillRect(gx + s * 4 - 1, y + 5, 3, 8);
    ctx.fillStyle = FC_GOLD; ctx.fillRect(gx + s * 4, y + 6, 1, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(gx + s * 4, y + 7, 1, 5);
  }
}

// ---- the keys' own looks -------------------------------------------------------------
// TALONS' wind-up: the hawk's own shadow, wings spread, wheeling over the spot it is
// sent to and tightening its turn; at the last it folds and its dive streaks down
function drawTalonsTele(x, y, closing, now) {
  const r = TALON_R * (1 - 0.7 * closing), t = now * 4.5;
  const sx = Math.round(x + Math.cos(t) * r), sy = Math.round(y + Math.sin(t) * r * 0.6), s = Math.sin(t) > 0 ? -1 : 1;
  ctx.globalAlpha = 0.4 + 0.3 * closing; ctx.fillStyle = FC_INK;
  ctx.fillRect(sx - 7, sy, 15, 1); ctx.fillRect(sx - 6, sy - 1, 5, 1); ctx.fillRect(sx + 2, sy - 1, 5, 1); // the wings, swept
  ctx.fillRect(sx - 4, sy + 1, 3, 1); ctx.fillRect(sx + 2, sy + 1, 3, 1);
  ctx.fillRect(sx - 1, sy - 2, 3, 5); ctx.fillRect(sx - 2, sy + 3, 5, 1); ctx.fillRect(sx + s, sy - 3, 1, 1); // body, tail, head
  ctx.globalAlpha = 1;
  if (closing > 0.7) { // the dive
    const k = (closing - 0.7) / 0.3;
    for (let j = 0; j < 12; j++) {
      const f = j / 12, dx = Math.round(x + 14 * (1 - k) + 10 * f), dy = Math.round(y - 30 * (1 - k) - 22 * f);
      ctx.fillStyle = j < 3 ? FC_WING_D : j < 7 ? '#4f6288' : '#7f98bc'; ctx.fillRect(dx, dy, j < 3 ? 2 : 1, 1);
    }
  }
}
// KNIFE FAN's wind-up: the three blades fanned out of his hand, each with a glint
// running out along the line it will fly
function drawFanTele(p, a0, closing, now, ex, ey) {
  for (let k = -1; k <= 1; k++) {
    const a = a0 + k * FAN_SPREAD, nx = Math.cos(a), ny = Math.sin(a), x0 = p.x - ex, y0 = p.y - BOW_Y - ey;
    drawThrownKnife(Math.round(x0 + nx * 15), Math.round(y0 + ny * 15), nx, ny, 0);
    const s = 20 + (FAN_LEN * closing - 20) * ((now * 2.2 + (k + 1) * 0.17) % 1);
    if (s <= 20) continue;
    const gx = Math.round(x0 + nx * s), gy = Math.round(y0 + ny * s);
    ctx.fillStyle = '#4f6288'; ctx.fillRect(gx - 2, gy, 5, 1); ctx.fillRect(gx, gy - 2, 1, 5);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(gx - 1, gy, 3, 1); ctx.fillRect(gx, gy - 1, 1, 3);
  }
}
// TALONS' strike: three rakes torn across the snow under the body it took, opening one
// after the other either side of its feet, and a feather or two knocked loose
function drawRakeFx(f, px, py, now) {
  const u = f.t / f.life;
  ctx.globalAlpha = u < 0.6 ? 1 : Math.max(0, (1 - u) / 0.4);
  for (let k = -1; k <= 1; k++) {
    const n = Math.round(15 * Math.min(1, Math.max(0, u * 5 - (k + 1) * 0.5)));
    for (let s = 0; s < n; s++) {
      const x = px + k * 7 + 5 - Math.round(s * 0.7), y = py - 4 + s;
      ctx.fillStyle = FC_INK; ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillStyle = s > n - 3 ? FC_GOLD : '#ffffff'; ctx.fillRect(x, y, 1, 1);
    }
  }
  drawFlung(px, py + 6, 0, Math.PI, 16, 0.5, 9, 3, Math.min(1, u * 1.4), fxSeed(f), (x, y) => {
    ctx.fillStyle = FC_WING_D; ctx.fillRect(x - 1, y + 1, 3, 1); // a feather, turning down
    ctx.fillStyle = FC_WING; ctx.fillRect(x, y, 3, 1);
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.rake = drawRakeFx;
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

HERO_AIR.push(drawFalcoAir);
HERO_BODY_DRAW.push(drawFalcoSky);

// ---- the knife in his hand -----------------------------------------------------------
// At rest it hangs point down from the fist at his side, forward of him side-on
// (FALCO_KNIFE, js/sprites/falco.js; HERO_CARRY): a short blade, never held out level.
// Thrown, the hand cocks it back over the shoulder and flings empty (HERO_AIMED).
function falcoCarry(p, px, py) {
  if (attackOf(p).art !== 'knife') return false;
  const lead = p.dir === 'down' || p.dir === 'right', side = p.dir === 'left' || p.dir === 'right', rc = heroReach(p);
  const K = falcoKnifeArt(p), k = side ? K.fwd : K.down, img = lead ? k.img : heldFlip(k.img);
  const hx = lead ? px + (side ? 12 : 13) + rc : px + (side ? 3 : 2) - rc, hy = py + 11;
  ctx.drawImage(img, hx - (lead ? k.grip[0] : heldW(img) - 1 - k.grip[0]), hy - k.grip[1], heldW(img), heldH(img));
  if (p.dir !== 'up') heroFist(p, hx, hy, lead ? 1 : -1);
  return true;
}
HERO_CARRY.push(falcoCarry);
// the knife art for this body: the 32 px one for a body drawn fine
function falcoKnifeArt(p) { return bodySet(p).dens > 1 ? FALCO_FINE_ART.knife : FALCO_KNIFE; }
// the knife hand is the leading one, the side away from the glove, so a raised knife never
// crosses the hawk; a hand on the left reaches one more (the chest's middle is between two columns)
HERO_AIMED.knife = (heading, step, p) => {
  const lead = p.dir === 'down' || p.dir === 'right', t = FALCO_THROW[step];
  const up = falcoKnifeArt(p).up;
  return { img: step ? up.img : null, grip: up.grip, hand: [lead ? t.hand[0] : -t.hand[0] - 1, t.hand[1]] };
};
