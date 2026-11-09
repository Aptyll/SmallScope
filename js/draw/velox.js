'use strict';
// ------------------------------------------------------------ velox
// VELOX's pixels (her rules: js/sim/velox.js): her sling stone in flight
// (HERO_SHOTS), on the snow (HERO_GROUND) ICE LANE's strip of polished ice and
// SKIP STONE skipping over it, on her own body (HERO_MARK) KEEP MOVING's
// stacks as small chevrons and LONG RUN's streaks, and the STAFF SLING in her
// hand (HERO_STAVES). Both sides see all of it.

const VX_INK = '#141a2c', VX_STONE = '#9aa3b8', VX_LIT = '#dfe6f0', VX_ICE = '#a8dcf0', VX_DEEP = '#2f5f8f', VX_WHITE = '#ffffff', VX_GOLD = '#f2cc6a';

// ---- shots -----------------------------------------------------------------------
// a sling stone: a small grey pebble with a lit corner, inked so it holds on snow
function drawSlingStone(a, sx, sy) {
  const x = Math.round(sx), y = Math.round(sy);
  ctx.fillStyle = VX_INK; ctx.fillRect(x - 1, y - 2, 3, 4); ctx.fillRect(x - 2, y - 1, 5, 2);
  ctx.fillStyle = VX_STONE; ctx.fillRect(x - 1, y - 1, 3, 2);
  ctx.fillStyle = VX_LIT; ctx.fillRect(x - 1, y - 1, 1, 1);
}
HERO_SHOTS.slingstone = drawSlingStone;

// ---- on the snow --------------------------------------------------------------------
// ICE LANE: a dark rim, the polished ice, shine streaks sliding along it; SKIP STONE:
// the stone over its shadow, high between landings
function drawVeloxGround(ex, ey, now) {
  for (const L of veloxLanes) {
    const a = L.t < L.life ? Math.min(1, L.t / 0.15) : Math.max(0, 1 - (L.t - L.life) / LANE_FADE);
    const vx = L.x1 - L.x0, vy = L.y1 - L.y0, len = Math.hypot(vx, vy) || 1, nx = vx / len, ny = vy / len;
    const steps = Math.ceil(len), sh = (now * 60) % 24;
    for (const [w, col, al] of [[LANE_W / 2, VX_DEEP, 0.6], [LANE_W / 2 - 2, VX_ICE, 0.65]]) {
      ctx.globalAlpha = al * a; ctx.fillStyle = col;
      for (let s = 0; s <= steps; s += 1) {
        const cx = Math.round(L.x0 + nx * s - ex), cy = Math.round(L.y0 + ny * s - ey);
        ctx.fillRect(cx - Math.round(w * Math.abs(ny)), cy - Math.round(w * Math.abs(nx)), Math.round(w * 2 * Math.abs(ny)) + 1, Math.round(w * 2 * Math.abs(nx)) + 1);
      }
    }
    ctx.globalAlpha = 0.85 * a; ctx.fillStyle = VX_WHITE;
    for (let s = sh; s < len; s += 24) for (let k = 0; k < 6; k++) {
      const d = s + k, o = (k >> 1) - 2;
      if (d > len) break;
      ctx.fillRect(Math.round(L.x0 + nx * d - ny * o - ex), Math.round(L.y0 + ny * d + nx * o - ey), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  for (const s of veloxStones) {
    const x = Math.round(s.x - ex), y = Math.round(s.y - ey);
    const h = Math.round(Math.sin(Math.PI * (1 - s.left / s.gap)) * 7);
    ctx.globalAlpha = 0.35; ctx.fillStyle = VX_INK; ctx.fillRect(x - 2, y, 5, 1);
    ctx.globalAlpha = 1;
    drawSlingStone(s, x, y - 2 - h);
  }
}
HERO_GROUND.push(drawVeloxGround);

// ---- on her ------------------------------------------------------------------------
// KEEP MOVING's stacks as gold chevrons over her head, pointing the way she goes;
// LONG RUN as white streaks off her back while it lasts
function drawVeloxMarks(e, px, py, w, h, now) {
  if (!isVelox(e)) return;
  if (e.runT > 0) {
    const sp = Math.hypot(e.vx, e.vy);
    if (sp > 20) {
      const nx = e.vx / sp, ny = e.vy / sp, cx = px + (w >> 1), cy = py + (h >> 1);
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#7f98bc';
      for (let k = 0; k < 3; k++) {
        const o = (k - 1) * 4, back = 8 + ((Math.floor(now * 20) + k * 3) % 6);
        for (let s = 0; s < 4; s++) ctx.fillRect(Math.round(cx - nx * (back + s) - ny * o), Math.round(cy - ny * (back + s) + nx * o), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }
}
// KEEP MOVING's stacks over the stack (HERO_OVER): gold chevrons pointing the way she goes
HERO_OVER.push({
  w: (e) => (isVelox(e) && e.keepN > 0 ? e.keepN * 4 - 1 : 0),
  draw: (e, x0, my) => {
    const right = e.dir !== 'left', f = right ? -1 : 1;
    for (let k = 0; k < e.keepN; k++) {
      const x = x0 + 1 + k * 4;
      for (const [dy, col] of [[1, VX_INK], [0, VX_GOLD]]) {
        ctx.fillStyle = col;
        ctx.fillRect(x + f, my - 1 + dy, 1, 1); ctx.fillRect(x, my + dy, 1, 1); ctx.fillRect(x + f, my + 1 + dy, 1, 1);
      }
    }
  },
});
HERO_MARK.push(drawVeloxMarks);

// ---- the STAFF SLING ------------------------------------------------------------
// Her staff (CLASSES' `staff: 'sling'`; HERO_STAVES, js/draw/heroes.js): a hooked
// staff carried upright, the sling's cords and pouch hanging off the hook; the stone
// in the pouch glints between two frames. The hand closes on the shaft at VELOX_SLING_GRIP.
const VELOX_SLING = [
  '..oo....',
  '.oGGo...',
  '.oGoGo..',
  '.obo.oo.',
  '.obo.oco',
  '.obo.oco',
  '.obo.oqo',
  '.obo.oSo',
  '.obo..o.',
  '.obo....',
  '.obo....',
  '.obo....',
  '.obo....',
  '.obo....',
  '.obo....',
  '.obo....',
  '.obo....',
  '.oBo....',
  '..o.....',
];
const VELOX_SLING_GRIP = [2, 10];
const VELOX_SLING_PAL = { o: '#241a12', G: '#c3ccd8', b: '#8a6440', B: '#5e4128', c: '#d8c49a', q: '#6f4d38', S: '#9aa3b8', W: '#dfe6f0' };
let veloxSlingArt = null;
function veloxSling() {
  if (veloxSlingArt) return veloxSlingArt;
  const glint = VELOX_SLING.map((r, y) => (y === 7 ? '.obo.oWo' : r));
  veloxSlingArt = [bakeBladeArt(VELOX_SLING, VELOX_SLING_PAL), bakeBladeArt(glint, VELOX_SLING_PAL)];
  return veloxSlingArt;
}
HERO_STAVES.sling = { art: veloxSling, grip: VELOX_SLING_GRIP, hold: 'hip' };
