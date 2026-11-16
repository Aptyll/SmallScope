'use strict';
// ------------------------------------------------------------ soldier shots
// A wave soldier's shot in the air and where it lands (soldierShots,
// js/sim/robots.js), drawn over the bodies with the heroes' arrows: a packed
// snowball lobbed from the ranged soldier's raised claw, the same ball it
// held, onto its mark, then a splat of snow on whatever it struck; or a
// ballista bolt shot flat off the cart's stock. Never inside a body's own
// pass: a body's light layer is clipped to that body's box, and the y-sort
// puts the mark over a shot that reaches it, so a shot drawn there was gone
// a few px out of the hand. No red, never blood: a hit reads by white snow
// (or the bolt's splinters) and motion.

const SHOT_INK = '#1c2130';                   // the rim, the soldiers' own outline
const SHOT_SHADE = 'rgba(40,52,90,0.25)';     // a shot's shadow on the snow
const BALL_PX = [                             // the ball, the size and light of the one in the claw (js/baked/soldiers.js): lit top left
  [-1, -2, '#ffffff'], [0, -2, '#ffffff'], [1, -2, '#ffffff'],
  [-2, -1, '#ffffff'], [-1, -1, '#ffffff'], [0, -1, '#ffffff'], [1, -1, '#ffffff'], [2, -1, '#d6e1f6'],
  [-2, 0, '#ffffff'], [-1, 0, '#ffffff'], [0, 0, '#ffffff'], [1, 0, '#d6e1f6'], [2, 0, '#d6e1f6'],
  [-1, 1, '#d6e1f6'], [0, 1, '#d6e1f6'], [1, 1, '#9eaed6'],
];
const BALL_AT = [];          // the ball's pixels this frame, placed (drawBallFlight)
const BALL_LIFT = [10, 9];   // px over the ground the ball leaves the claw at, and lands on a body at
const BALL_ARC = [2, 0.07, 6]; // its lob: px over the straight line at the top, at least, per px thrown, at most;
                               // kept low, so a ball thrown at a body from above it is under the body's bar for a frame at most
// the splat each look leaves (SOLDIER_SPLAT_T s): its heart, its chips, its last flecks
const SHOT_SPLAT = { ball: ['#ffffff', '#d6e1f6', '#9eaed6'], bolt: ['#e4e8ee', '#a3794f', '#6b4a30'] };
const SPLAT_RIM = '#4f6288'; // a snow clump's rim (HIT_PUFF_RIM): dark on snow, never a black spot on a face
const SPLAT_BACK = 3;        // px back along its flight from the mark's middle: on the struck side

function drawSoldierShots(ex, ey, now) {
  const since = netSince(now);
  for (const s of soldierShots) {
    const at = soldierShotAt(s, since);
    if (at.x - ex < -24 || at.x - ex > WV_W + 24 || at.y - ey < -24 || at.y - ey > WV_H + 24) continue;
    if (!fogShown({ team: s.team, x: at.x, y: at.y }, now)) continue; // a rival's shot out of sight is not there
    if (at.hit >= 0) drawShotSplat(s, at, ex, ey);
    else if (s.look === 'bolt') drawBoltFlight(s, at, ex, ey);
    else drawBallFlight(at, ex, ey);
  }
}

// where a shot is drawn right now: f of its flight (0 at the hand, 1 on the
// mark), its point in the air and the snow under it, or `hit` s since it landed
function soldierShotAt(s, since) {
  const hit = s.hit >= 0 ? s.hit + since : (s.t + since >= s.fly ? 0 : -1);
  const f = hit >= 0 ? 1 : Math.min(1, (s.t + since) / s.fly);
  const dx = s.x - s.x0, dy = s.y - s.y0, d = Math.hypot(dx, dy);
  if (s.look === 'bolt') return { f, hit, x: s.x0 + dx * f, y: s.y0 + dy * f, gy: s.y0 + dy * f + 16 - 8 * f, d };
  const lift = BALL_LIFT[0] + (BALL_LIFT[1] - BALL_LIFT[0]) * f;
  const arc = Math.sin(f * Math.PI) * Math.max(BALL_ARC[0], Math.min(BALL_ARC[2], d * BALL_ARC[1]));
  const gx = s.x0 + dx * f, gy = s.y0 + BALL_LIFT[0] + (dy + BALL_LIFT[1] - BALL_LIFT[0]) * f;
  return { f, hit, x: gx, y: gy - lift - arc, gy, d };
}

// the snowball: its shadow on the snow, then the ball, rimmed so white reads on white
function drawBallFlight(at, ex, ey) {
  const x = Math.round(at.x - ex), y = Math.round(at.y - ey);
  ctx.fillStyle = SHOT_SHADE;
  ctx.fillRect(x - 2, Math.round(at.gy - ey), 5, 1);
  BALL_AT.length = 0;
  for (const [px, py, c] of BALL_PX) BALL_AT.push([x + px, y + py, c]);
  hitInked(BALL_AT, SHOT_INK);
}

// the bolt: 7 px of shaft along its flight, a steel head, its side's fletching
function drawBoltFlight(s, at, ex, ey) {
  const d = at.d || 1, ux = (s.x - s.x0) / d, uy = (s.y - s.y0) / d;
  const px = (k) => [Math.round(at.x - ux * k - ex), Math.round(at.y - uy * k - ey)];
  ctx.fillStyle = SHOT_SHADE; // its shadow on the snow, under the line it flies
  ctx.fillRect(Math.round(at.x - ux * 3 - ex) - 2, Math.round(at.gy - ey), 5, 1);
  ctx.fillStyle = SHOT_INK;
  for (let k = 0; k <= 6; k++) { const [x, y] = px(k); ctx.fillRect(x - 1, y - 1, 3, 3); }
  ctx.fillStyle = '#8a6142';
  for (let k = 1; k <= 4; k++) { const [x, y] = px(k); ctx.fillRect(x, y, 1, 1); }
  ctx.fillStyle = TEAMS[skin(s.team)].mark;
  for (let k = 5; k <= 6; k++) { const [x, y] = px(k); ctx.fillRect(x, y, 1, 1); }
  ctx.fillStyle = '#e4e8ee';
  const [hx, hy] = px(0); ctx.fillRect(hx, hy, 1, 1);
}

// the splat where it struck, in three beats, sprayed on along the way it was
// flying: a burst of the ball's own snow, chips flying off it, the last flecks
// dropping. Each pixel is rimmed (hitInked, js/draw/hitfx.js)
function drawShotSplat(s, at, ex, ey) {
  const C = SHOT_SPLAT[s.look] || SHOT_SPLAT.ball;
  const u = soldierShotDir(s);
  const cx = Math.round(at.x - Math.cos(u) * SPLAT_BACK - ex), cy = Math.round(at.y - Math.sin(u) * SPLAT_BACK - ey);
  const k = at.hit / SOLDIER_SPLAT_T, pts = [];
  if (k < 0.34) {
    // the ball flattened on what it struck: as wide as it was and more, squashed to three rows
    for (let x = -2; x <= 2; x++) pts.push([cx + x, cy - 1, C[0]]);
    for (let x = -3; x <= 3; x++) pts.push([cx + x, cy, Math.abs(x) === 3 ? C[1] : C[0]]);
    for (let x = -1; x <= 1; x++) pts.push([cx + x, cy + 1, C[1]]);
  } else {
    const r = k < 0.67 ? 4 : 6, c = k < 0.67 ? C[1] : C[2], drop = k < 0.67 ? 0 : 1;
    for (const a of [-1.3, -0.45, 0.45, 1.3]) {
      const ang = u + a + (Math.abs(a) > 1 ? 0 : 0.1);
      pts.push([cx + Math.round(Math.cos(ang) * r), cy + Math.round(Math.sin(ang) * r * 0.8) + drop, c]);
    }
    if (k < 0.67) pts.push([cx, cy, C[0]]);
  }
  hitInked(pts, SPLAT_RIM);
}
// the way a shot was flying when it landed (radians): its splat sprays on along it
function soldierShotDir(s) { return Math.atan2(s.y - s.y0, s.x - s.x0); }
