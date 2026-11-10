'use strict';
// ------------------------------------------------------------ arcus
// ARCUS's pixels (his rules: js/sim/arcus.js): his arrows standing in the snow and
// FULL QUIVER's shadows on it (HERO_GROUND), the quiver's arrows falling (HERO_AIR),
// his keys' wind-ups (their rows' `tele`), WASTE NOTHING's stacks
// over him (HERO_OVER), and his longbow upright at his side at rest
// (HERO_CARRY). Both sides see all of it, but a rival's arrow in the fog is not there.

const AC_INK = '#141a2c', AC_GOLD = '#f2cc6a', AC_WHITE = '#ffffff', AC_SHAFT = '#c8a46a';

// ---- on the snow --------------------------------------------------------------------
// An arrow standing in the snow, small beside a body: a willow shaft five pixels up out of
// the drift, its team vanes at the top, leaning a pixel the way it flew; painted through the
// arrows' rim (paintArrowPx, js/draw/overhead.js) so it wears the same dark edge.
const AC_PX = [];
function drawShaftStanding(x, y, ang, team) {
  const tm = TEAMS[skin(team)], c = Math.cos(ang), lean = c > 0.5 ? -1 : c < -0.5 ? 1 : 0; // the tail leans back toward where it came from
  AC_PX.length = 0;
  for (let k = 0; k < 5; k++) AC_PX.push(x + (k >= 3 ? lean : 0), y - k, AC_SHAFT);
  const tx = x + lean;
  AC_PX.push(tx - 1, y - 5, tm.coatD, tx, y - 5, AC_SHAFT, tx + 1, y - 5, tm.coatD);
  AC_PX.push(tx - 1, y - 6, tm.mark, tx + 1, y - 6, tm.mark);
  paintArrowPx(AC_PX);
}
// where FULL QUIVER falls: the shadow of every arrow still to come, darkening as it nears
function drawArcusGround(ex, ey, now) {
  for (const r of arcusRains) {
    if (!fogShown(r, now)) continue;
    for (let k = r.n; k < RAIN_N; k++) {
      const at = rainPoint(r, k), near = Math.max(0, 1 - (rainAt(k) - r.t) / RAIN_T);
      ctx.globalAlpha = 0.15 + 0.35 * near; ctx.fillStyle = AC_INK;
      fillEllipsePx(at.x - ex, at.y - ey, 1 + Math.round(near * 2), 1);
    }
    ctx.globalAlpha = 1;
  }
  for (const s of arcusShafts) {
    if (!fogShown(s, now)) continue;
    const x = Math.round(s.x - ex), y = Math.round(s.y - ey);
    if (x < -20 || y < -20 || x > WV_W + 20 || y > WV_H + 20) continue;
    // a dent in the snow where it went in, and the arrow over it, sinking at its end
    ctx.globalAlpha = 0.35; ctx.fillStyle = AC_INK; ctx.fillRect(x - 1, y + 1, 3, 1); ctx.globalAlpha = 1;
    const fade = SHAFT_LIFE - s.t;
    if (fade < 0.6 && Math.floor(now * 10) % 2) continue; // about to go: it blinks
    drawShaftStanding(x, y, s.ang, s.team);
  }
}
// FULL QUIVER's arrows in the air: each one seen dropping out of the sky for RAIN_FALL
function drawArcusAir(ex, ey, now) {
  for (const r of arcusRains) {
    if (!fogShown(r, now)) continue;
    const tm = TEAMS[skin(r.team)];
    for (let k = r.n; k < RAIN_N; k++) {
      const left = rainAt(k) - r.t;
      if (left > RAIN_FALL) break;
      const at = rainPoint(r, k), h = Math.round(90 * (left / RAIN_FALL));
      AC_PX.length = 0;
      arrowBodyPx(AC_PX, at.x - ex, at.y - ey - h, 0, 1, 0, ARROW_LEN, tm.mark, tm.coatD, AC_SHAFT, 0);
      paintArrowPx(AC_PX);
      ctx.globalAlpha = 0.3 + 0.4 * (1 - left / RAIN_FALL); ctx.fillStyle = AC_INK; // its shadow, growing as it nears
      ctx.fillRect(Math.round(at.x - ex) - 1, Math.round(at.y - ey), 3, 1);
      ctx.globalAlpha = 1;
    }
  }
}
HERO_GROUND.push(drawArcusGround);
HERO_AIR.push(drawArcusAir);

// ---- the keys' wind-ups ---------------------------------------------------------------
// an arrow in flight's pixels at (x, y) on bearing a, `len` long, in his side's colours
function acArrow(x, y, a, len, team) {
  const tm = TEAMS[skin(team)];
  AC_PX.length = 0;
  arrowBodyPx(AC_PX, x, y, Math.cos(a), Math.sin(a), 0, len, tm.mark, tm.coatD, AC_SHAFT, 0);
  paintArrowPx(AC_PX);
}
// VOLLEY: the five arrows fanned on the string, each sending a streak of its flight out
// down its bearing as he draws, to the volley's whole reach as he looses
function drawVolleyTele(p, a0, closing, ex, ey) {
  const x0 = p.x - ex, y0 = p.y - BOW_Y - ey;
  for (let k = 0; k < VOLLEY_N; k++) {
    const a = a0 - VOLLEY_HALF + (2 * VOLLEY_HALF * k) / (VOLLEY_N - 1), nx = Math.cos(a), ny = Math.sin(a);
    const L = VOLLEY_RANGE * closing;
    ctx.globalAlpha = 0.25 + 0.35 * closing;
    for (let s = 18; s < L; s += 1) { // the streak: thin, solid, thinning out with distance
      if (s > L * 0.6 && s % 2) continue;
      ctx.fillStyle = s < L * 0.6 ? AC_GOLD : AC_WHITE;
      ctx.fillRect(Math.round(x0 + nx * s), Math.round(y0 + ny * s), 1, 1);
    }
    ctx.globalAlpha = 1;
    acArrow(Math.round(x0 + nx * 14), Math.round(y0 + ny * 14), a, ARROW_LEN, p.team);
  }
}
// GATHER UP: every arrow of his in the snow shakes loose and leans out toward him, a short
// streak behind it showing the way it will fly, so a rival standing on one sees it coming
function drawGatherTele(p, closing, now, ex, ey) {
  for (const s of arcusShafts) {
    if (s.owner !== p.id || s.team !== p.team) continue;
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    const jig = Math.floor(now * 30) % 2, x = Math.round(s.x - ex) + jig, y = Math.round(s.y - ey);
    const L = Math.min(d, 10 + 30 * closing);
    ctx.globalAlpha = 0.45 + 0.45 * closing;
    for (let k = 3; k < L; k++) { ctx.fillStyle = k < 8 ? AC_WHITE : AC_GOLD; ctx.fillRect(Math.round(x + nx * k), Math.round(y - 3 + ny * k), 1, 1); }
    ctx.globalAlpha = 1;
    acArrow(x, y - 3, Math.atan2(ny, nx) + Math.PI, ARROW_LEN - 2, p.team); // turned to come home, tail first
  }
}
// FULL QUIVER: arrows going up off his bow, and on the far spot their shadows gathering
// one by one in the very places they will land
function drawQuiverTele(p, px, py, c, closing, now, ex, ey) {
  for (let k = 0; k < 3; k++) {
    const h = ((now * 220 + k * 30) % 90);
    ctx.globalAlpha = 1 - h / 90;
    acArrow(px + (k - 1) * 3, py - 14 - Math.round(h), -Math.PI / 2, ARROW_LEN, p.team);
  }
  ctx.globalAlpha = 1;
  const n = Math.ceil(closing * RAIN_N), r = { x: c.x, y: c.y };
  for (let k = 0; k < n; k++) {
    const at = rainPoint(r, k);
    ctx.globalAlpha = 0.2 + 0.3 * closing; ctx.fillStyle = AC_INK;
    fillEllipsePx(at.x - ex, at.y - ey, 2, 1);
  }
  ctx.globalAlpha = 1;
}

// ---- on him ------------------------------------------------------------------------
// WASTE NOTHING's stacks over the stack (HERO_OVER): a small gold arrow pointing up for
// each, white while TWIN NOCK is drawn
HERO_OVER.push({
  w: (e) => (isArcus(e) && e.arcN > 0 ? e.arcN * 4 - 1 : 0),
  draw: (e, x0, my) => {
    const col = e.twinT > 0 ? AC_WHITE : AC_GOLD;
    for (let k = 0; k < e.arcN; k++) {
      const x = x0 + 1 + k * 4;
      for (const [dy, c] of [[1, AC_INK], [0, col]]) {
        ctx.fillStyle = c;
        ctx.fillRect(x, my - 2 + dy, 1, 4); ctx.fillRect(x - 1, my - 1 + dy, 3, 1);
      }
    }
  },
});

// ---- the longbow at his side ---------------------------------------------------------
// At rest he carries it upright in his leading hand, clear of the body in every facing
// (ARCUS_BOW_CARRY, js/sprites/arcus.js): the string toward him and a pixel off his coat,
// the belly away, forward of him side-on (THE GRIP RULE). Never across the face.
function arcusCarry(p, px, py) {
  if (!isArcus(p)) return false;
  const lead = p.dir === 'down' || p.dir === 'right', rc = heroReach(p); // the leading hand is on the right
  const side = p.dir === 'left' || p.dir === 'right';
  const hx = lead ? px + (side ? 15 : 16) + rc : px + (side ? 0 : -1) - rc, hy = py + 10;
  const art = bodySet(p).dens > 1 ? arcusBowsFine().carry : ARCUS_BOW_CARRY; // his fine body's bow is fine too
  const img = lead ? art : heldFlip(art);
  ctx.drawImage(img, hx - (lead ? ARCUS_BOW_GRIP[0] : heldW(img) - 1 - ARCUS_BOW_GRIP[0]), hy - ARCUS_BOW_GRIP[1], heldW(img), heldH(img));
  if (p.dir !== 'up') heroFist(p, hx, hy, lead ? 1 : -1);
  return true;
}
HERO_CARRY.push(arcusCarry);
// drawn, it is one of eight set frames on the aim (ARCUS_BOW_AIM, js/sprites/arcus.js)
HERO_AIMED.longbow = (heading, step, p) => (bodySet(p).dens > 1 ? arcusBowsFine().aim : ARCUS_BOW_AIM)[heading][step];
