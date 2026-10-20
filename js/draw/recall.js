// ------------------------------------------------------------ recall's pixels
// Flat on the snow, under everything that walks it (drawn in the world
// flat pass, drawFlatPass in js/draw/passes.js): each roost's healing ring, and the recall's channel
// closing on the feet of whoever is leaving (js/sim/recall.js).
//
// THE ROOST RING is a soft glowing edge in the bird's side's colour round the
// packed-earth disc (BOOM_R, js/sim/eagle.js): four one-pixel circles stepping
// in from the rim, bright to faint, so the edge reads without a hard line. One
// mirrored step pattern (circlePts), baked once per colour and size into a
// canvas, since the rim is hundreds of pixels.
// THE CHANNEL is a dotted ring at the start radius and a solid ring closing
// from it to the feet as the channel runs, squashed to the ground's 3/4 view
// like every footprint ring; the bar over the head fills with it (drawPlayer,
// js/draw/bodies.js).
const ROOST_GLOW = [0.85, 0.5, 0.28, 0.14]; // the rim's four rings, outside in
const RECALL_R = 16, RECALL_R_MIN = 3;      // px: the channel ring's start and end
const RECALL_SQ = 0.6;                      // its squash onto the ground

// a midpoint circle's pixels, each once: the eight octants mirror one step pattern
const circleMemo = new Map();
function circlePts(r) {
  if (circleMemo.has(r)) return circleMemo.get(r);
  const s = new Set(), out = [];
  let x = r, y = 0, e = 1 - r;
  while (x >= y) {
    for (const [a, b] of [[x, y], [y, x], [-x, y], [-y, x], [x, -y], [y, -x], [-x, -y], [-y, -x]]) {
      const k = a + ',' + b;
      if (!s.has(k)) { s.add(k); out.push([a, b]); }
    }
    y++;
    if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; }
  }
  circleMemo.set(r, out);
  return out;
}

const roostRingCv = new Map(); // 'colour|r' -> the baked rim, (2r+1) px square
function roostRingArt(col, r) {
  const key = col + '|' + r;
  let cv = roostRingCv.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = 2 * r + 1;
  const g = cv.getContext('2d');
  g.fillStyle = col;
  ROOST_GLOW.forEach((a, k) => {
    g.globalAlpha = a;
    for (const [x, y] of circlePts(r - k)) g.fillRect(r + x, r + y, 1, 1);
  });
  roostRingCv.set(key, cv);
  return cv;
}

function drawRecallGround(ex, ey) {
  if (!state.drop) return;
  const r = Math.round(BOOM_R * TILE);
  for (const e of state.drop.eagles) {
    if (e.state !== 'down') continue;
    const x = Math.round(e.x - ex) - r, y = Math.round(e.y - ey) - r;
    if (x > WV_W || y > WV_H || x + 2 * r < 0 || y + 2 * r < 0) continue;
    ctx.drawImage(roostRingArt(TEAMS[skin(e.team)].mark, r), x, y);
  }
  for (const p of players) {
    if (!p.active || p.dead || !(p.recallT > 0) || !fogShown(p)) continue; // a rival in the fog leaves no ring either
    const t = TEAMS[skin(p.team)], q = 1 - p.recallT / RECALL_T;
    const cx = Math.round(p.x - ex), cy = Math.round(p.y - ey) + 6;
    if (cx < -RECALL_R || cy < -RECALL_R || cx > WV_W + RECALL_R || cy > WV_H + RECALL_R) continue;
    const a = 1 - concealOf(p);
    ctx.fillStyle = t.coatD;
    ctx.globalAlpha = 0.7 * a;
    for (const [x, y] of circlePts(RECALL_R)) if (((x + y) & 1) === 0) ctx.fillRect(cx + x, cy + Math.round(y * RECALL_SQ), 1, 1);
    const rr = Math.max(RECALL_R_MIN, Math.round(RECALL_R - (RECALL_R - RECALL_R_MIN) * q));
    for (const [x, y] of circlePts(rr)) {
      const yy = cy + Math.round(y * RECALL_SQ);
      ctx.globalAlpha = a; ctx.fillStyle = t.mark; ctx.fillRect(cx + x, yy, 1, 1);
      ctx.globalAlpha = 0.8 * a; ctx.fillStyle = t.coatD; ctx.fillRect(cx + x, yy + 1, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
