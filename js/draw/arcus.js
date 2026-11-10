'use strict';
// ------------------------------------------------------------ arcus
// ARCUS's pixels (his rules: js/sim/arcus.js): his arrows standing in the snow and
// FULL QUIVER's ring on it (HERO_GROUND), the quiver's arrows falling (HERO_AIR),
// GATHER UP's lines while he calls them (its row's `tele`), WASTE NOTHING's stacks
// over him (HERO_OVER), and his longbow upright at his side facing down or up
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
// where FULL QUIVER falls: a ring in the snow for as long as arrows are still coming
function drawArcusGround(ex, ey, now) {
  for (const r of arcusRains) {
    if (!fogShown(r, now)) continue;
    const x = Math.round(r.x - ex), y = Math.round(r.y - ey);
    const col = TEAMS[skin(r.team)].mark;
    drawRing(x, y, RAIN_R, col, 0.55, 0.12);
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

// ---- GATHER UP's lines ---------------------------------------------------------------
// While he calls them: a dotted line from each of his arrows to him, so the rival
// standing on one can see it coming
function drawGatherLines(p, col, closing, ex, ey) {
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.35 + 0.5 * closing;
  for (const s of arcusShafts) {
    if (s.owner !== p.id || s.team !== p.team) continue;
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1, n = Math.floor(d / 4);
    for (let i = 1; i < n; i++) ctx.fillRect(Math.round(s.x + dx * i / n - ex), Math.round(s.y + dy * i / n - ey), 1, 1);
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
// Facing down or up the level carry would lay the bow across his feet; he carries it
// upright in his leading hand instead, the string toward him (HERO_CARRY)
function arcusCarry(p, px, py) {
  if (!isArcus(p) || (p.dir !== 'down' && p.dir !== 'up')) return false;
  const A = attackOf(p), img = SPRITES.weaponArt[A.art];
  if (!img) return false;
  if (p.dir === 'down') drawGripped(img, WEAPON_GRIP.icon[A.art], px + 16, py + 10, 0);
  else drawGripped(img, WEAPON_GRIP.icon[A.art], px + 0, py + 10, Math.PI);
  return true;
}
HERO_CARRY.push(arcusCarry);
