'use strict';
// ------------------------------------------------------------ arcus
// ARCUS's pixels (his rules: js/sim/arcus.js): his arrows standing in the snow and
// FULL QUIVER's shadows on it (HERO_GROUND), the quiver's arrows falling (HERO_AIR),
// his keys' wind-ups (their rows' `tele`), WASTE NOTHING's stacks
// over him (HERO_OVER), and his longbow upright at his side at rest
// (HERO_CARRY). Both sides see all of it, but a rival's arrow in the fog is not there.

const AC_PALE = '#f6e2a0'; // a flight path's pale gold
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
// VOLLEY: the five arrows fanned on the string, each with the path of its flight laid
// out down its bearing as he draws: one px of soft pale gold, solid (never dashes), that
// fades to nothing by two thirds of the volley's reach, so the fan shows and no body is
// buried under it
const VOLLEY_PATH = 2 / 3; // the share of the reach a path is drawn over
function drawVolleyTele(p, a0, closing, ex, ey) {
  const x0 = p.x - ex, y0 = p.y - BOW_Y - ey, L = VOLLEY_RANGE * closing * VOLLEY_PATH;
  ctx.fillStyle = AC_PALE;
  for (let k = 0; k < VOLLEY_N; k++) {
    const a = a0 - VOLLEY_HALF + (2 * VOLLEY_HALF * k) / (VOLLEY_N - 1), nx = Math.cos(a), ny = Math.sin(a);
    for (let s = 18; s < L; s++) {
      ctx.globalAlpha = (0.35 + 0.4 * closing) * (1 - (s - 18) / (L - 18));
      ctx.fillRect(Math.round(x0 + nx * s), Math.round(y0 + ny * s), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
  // on the string, three of the five (the wind-up only has to say several): the middle and the two outermost bearings,
  // three px apart along the string, only the head and fore shaft of each showing ahead of the bow, clear of his
  // body, painted as one
  // (every rim first, then every shaft) so each keeps its own rim with snow between
  AC_PX.length = 0;
  const slant = Math.min(Math.abs(Math.cos(a0)), Math.abs(Math.sin(a0))) > 0.38; // on a diagonal three stepped shafts tangle: only the middle one shows
  for (let k = slant ? 0 : -1; k <= (slant ? 0 : 1); k++) {
    const a = a0 + k * VOLLEY_HALF, nx = Math.cos(a), ny = Math.sin(a), off = k * 3;
    arrowBodyPx(AC_PX, Math.round(x0 + nx * 18 - Math.sin(a0) * off), Math.round(y0 + ny * 18 + Math.cos(a0) * off), nx, ny, 0, 7, AC_WHITE, AC_SHAFT, AC_SHAFT, 0); // head and fore shaft only: the rest is behind the bow
  }
  paintArrowPx(AC_PX);
}
// GATHER UP: every arrow of his in the snow shakes loose and turns tail first toward him,
// working a short furrow in the snow the way it will fly and kicking up snow at its foot,
// so a rival standing on one sees it coming
function drawGatherTele(p, closing, now, ex, ey) {
  for (const s of arcusShafts) {
    if (s.owner !== p.id || s.team !== p.team) continue;
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    const jig = Math.floor(now * 30) % 2, x = Math.round(s.x - ex) + jig, y = Math.round(s.y - ey);
    const L = Math.min(d, 3 + 7 * closing), sx = Math.round(s.x - ex), sy = Math.round(s.y - ey);
    ctx.fillStyle = '#8fa4c4'; // the furrow: pressed snow, a value or two darker, ragged at its end
    for (let k = 1; k < L; k++) ctx.fillRect(Math.round(sx + nx * k), Math.round(sy + ny * k), 1 + (k < L - 2 && Math.abs(nx) > 0.5 ? 1 : 0), 1);
    ctx.fillStyle = AC_WHITE; // snow kicked up off its foot
    for (let k = 0; k < 3; k++) { const t = (now * 3 + k * 0.37) % 1; ctx.fillRect(Math.round(sx + (k - 1) * 2 - nx * t * 3), Math.round(sy - t * 4), 1, 1); }
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
  const img = lead ? ARCUS_BOW_CARRY : heldFlip(ARCUS_BOW_CARRY);
  ctx.drawImage(img, hx - (lead ? ARCUS_BOW_GRIP[0] : img.width - 1 - ARCUS_BOW_GRIP[0]), hy - ARCUS_BOW_GRIP[1], img.width, img.height);
  if (p.twinT > 0 && p.dir !== 'up') { // TWIN NOCK: two arrows pinched in the bow hand, heads up on the stave's far side (clear of his face), ready to go on the string together
    const o = lead ? 2 : -2;
    acArrow(hx + o, hy - 8, -Math.PI / 2, 10, p.team);
    acArrow(hx + o * 2, hy - 6, -Math.PI / 2, 9, p.team);
  }
  if (p.dir !== 'up') heroFist(p, hx, hy, lead ? 1 : -1);
  return true;
}
HERO_CARRY.push(arcusCarry);
// drawn, it is one of eight set frames on the aim (ARCUS_BOW_AIM, js/sprites/arcus.js)
HERO_AIMED.longbow = (heading, step) => ARCUS_BOW_AIM[heading][step];
