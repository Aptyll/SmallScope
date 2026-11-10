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
// a strip of ice from (x0, y0) along (nx, ny), `len` px, at alpha a: the polished
// sheet, a frost edge that breaks up either side, and the lines her skates cut in it
function vxIce(x0, y0, nx, ny, len, a, seed) {
  const w = LANE_W / 2 - 2, steps = Math.ceil(len);
  ctx.globalAlpha = 0.7 * a; ctx.fillStyle = VX_ICE;
  for (let s = 0; s <= steps; s++) {
    const cx = Math.round(x0 + nx * s), cy = Math.round(y0 + ny * s);
    ctx.fillRect(cx - Math.round(w * Math.abs(ny)), cy - Math.round(w * Math.abs(nx)), Math.round(w * 2 * Math.abs(ny)) + 1, Math.round(w * 2 * Math.abs(nx)) + 1);
  }
  for (let s = 0; s <= steps; s++) for (const side of [-1, 1]) { // the frost edge, a few px of it, never a ruled line
    const n = Math.round(fxRoll(seed, s, side + 2) * 3.4);
    for (let k = 1; k <= n; k++) {
      ctx.globalAlpha = (k === n ? 0.9 : 0.6) * a; ctx.fillStyle = k === n ? VX_WHITE : '#cfeaf8';
      ctx.fillRect(Math.round(x0 + nx * s - ny * side * (w + k)), Math.round(y0 + ny * s + nx * side * (w + k)), 1, 1);
    }
  }
  ctx.globalAlpha = 0.55 * a; ctx.fillStyle = VX_DEEP;
  for (let j = 0; j < 4; j++) { // skate cuts: long, thin, each its own stretch, crossing a little
    const o0 = [-4, -1, 2, 4][j], s0 = len * fxRoll(seed, j, 7) * 0.3, s1 = len * (0.6 + 0.4 * fxRoll(seed, j, 8));
    for (let s = s0; s < s1; s++) {
      const o = o0 + Math.sin(s * 0.07 + j * 2) * 1.5;
      ctx.fillRect(Math.round(x0 + nx * s - ny * o), Math.round(y0 + ny * s + nx * o), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
function drawVeloxGround(ex, ey, now) {
  for (const L of veloxLanes) {
    const a = L.t < L.life ? Math.min(1, L.t / 0.15) : Math.max(0, 1 - (L.t - L.life) / LANE_FADE);
    const vx = L.x1 - L.x0, vy = L.y1 - L.y0, len = Math.hypot(vx, vy) || 1, nx = vx / len, ny = vy / len;
    vxIce(L.x0 - ex, L.y0 - ey, nx, ny, len, a, (Math.round(L.x0) * 7 + Math.round(L.y0) * 13) | 0);
    const sh = (now * 60) % 24;
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

// ---- the keys' wind-ups -------------------------------------------------------------------
// SKIP STONE: only where it will touch down: a scuff in the snow at each skip and the
// snow it kicks up, the nearest the biggest (on the snow's spacing; ice carries it further)
function drawSkipTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), n = Math.max(1, Math.ceil(SKIP_N * closing));
  for (let k = 0; k < n; k++) {
    const s = (k + 1) * SKIP_GAP, x = Math.round(p.x + nx * s - ex), y = Math.round(p.y + ny * s - ey), r = Math.max(2, 4 - k);
    ctx.globalAlpha = 0.5 + 0.4 * closing;
    fxPatch(x, y + 1, r + 1, 0.4, 1, k + 3, '#6f86ad'); // the scuff
    for (let j = 0; j < r + 1; j++) { // the snow thrown up off it, forward
      const fx = Math.round(x + nx * (1 + j) + (j % 2 ? 2 : -2)), fy = y - 2 - (j % 3) - (r - 2);
      ctx.fillStyle = '#6f86ad'; ctx.fillRect(fx, fy + 1, 1, 1);
      ctx.fillStyle = VX_WHITE; ctx.fillRect(fx, fy, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// ICE LANE: the strip freezing out from her feet down the aim, as wide as it will lie
function drawLaneTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = LANE_LEN * closing, w = LANE_W / 2;
  vxIce(p.x - ex, p.y + 4 - ey, nx, ny, L, 0.6, p.id * 37);
  ctx.globalAlpha = 0.9; ctx.fillStyle = VX_WHITE; // the freezing front, broken
  for (let k = -w; k <= w; k++) if (fxRoll(p.id, k + 20, 3) < 0.6) ctx.fillRect(Math.round(p.x + nx * (L + fxRoll(p.id, k + 20, 4) * 3) - ny * k - ex), Math.round(p.y + 4 + ny * L + nx * k - ey), 1, 1);
  ctx.globalAlpha = 1;
}

// ---- on her ------------------------------------------------------------------------
// KEEP MOVING's stacks as gold chevrons over her head, pointing the way she goes;
// LONG RUN while it lasts: the lines her skates cut and the ice thrown off her heels
// as she goes, frost glinting off the skates when she stands
function drawVeloxMarks(e, px, py, w, h, now) {
  if (!isVelox(e)) return;
  if (e.runT > 0) {
    const sp = Math.hypot(e.vx, e.vy), cx = px + (w >> 1), fy = py + h - 1, beat = Math.floor(now * 14);
    if (sp > 20) {
      const nx = e.vx / sp, ny = e.vy / sp;
      const hid = (x, y) => x >= px && x < px + w && y < fy - 1; // behind her own body (going down the screen)
      // the two lines her skates cut in the ice, broken and fading behind her
      for (const o of [-2, 2]) for (let d = 2; d < 30; d++) {
        if ((d + beat + (o > 0 ? 3 : 0)) % 6 > 3) continue;
        ctx.globalAlpha = 1 - d / 30; ctx.fillStyle = d < 12 ? VX_DEEP : '#5f7fae';
        const x = Math.round(cx - nx * d - ny * o), y = Math.round(fy - ny * d + nx * o);
        if (!hid(x, y)) ctx.fillRect(x, y, 1, 1);
      }
      // the ice thrown up off her heels: shavings fanning back, lit white over a shaded foot,
      // never higher than her knees (nothing of it crosses the body going down the screen)
      for (let k = 0; k < 6; k++) {
        const t = ((beat + k * 3) % 9) / 9, side = (k - 2.5) * (2 + Math.max(0, ny)) * (0.5 + t), back = (4 + t * 12) * (1 - 0.7 * Math.max(0, ny)), up = Math.round(4 * Math.sin(Math.PI * t));
        const x = Math.round(cx - nx * back - ny * side), y = Math.round(fy - ny * back + nx * side);
        if (hid(x, y - up) || (ny > 0.3 && y - up < py + (h >> 1))) continue; // ...nor flies up beside her head
        ctx.globalAlpha = 1 - t * 0.5;
        ctx.fillStyle = '#5f7fae'; ctx.fillRect(x, y - up + 1, 2, 1);
        ctx.fillStyle = k % 3 ? VX_WHITE : VX_ICE; ctx.fillRect(x, y - up - 1, 2, 2);
      }
    } else { // standing: frost glinting off each skate
      ctx.fillStyle = beat % 4 < 2 ? VX_WHITE : VX_ICE;
      for (const o of [-4, 4]) { const x = cx + o + (beat % 8 < 4 ? 0 : (o > 0 ? 1 : -1)); ctx.fillRect(x, fy - 1, 1, 3); ctx.fillRect(x - 1, fy, 3, 1); }
    }
    ctx.globalAlpha = 1;
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
// staff carried upright, shorter than a mage's, the sling's thin cord swung out off the hook
// and its leather pouch hanging low on it; the stone in the pouch glints between two frames. The hand closes on the shaft at VELOX_SLING_GRIP.
const VELOX_SLING = [
  '..oo.......',
  '.oGGo......',
  '.oGoGo.....',
  '.obo.o.....',
  '.obo..o....',
  '.obo..o....',
  '.obo...o...',
  '.obo..ocoo.',
  '.obo.ocSSco',
  '.obo..occo.',
  '.obo...oo..',
  '.obo.......',
  '.obo.......',
  '.obo.......',
  '.oBo.......',
  '..o........',
];
const VELOX_SLING_GRIP = [2, 9];
const VELOX_SLING_PAL = { o: '#241a12', G: '#c3ccd8', b: '#8a6440', B: '#5e4128', c: '#d8c49a', q: '#6f4d38', S: '#c3ccd8', W: '#ffffff' };
let veloxSlingArt = null;
function veloxSling() {
  if (veloxSlingArt) return veloxSlingArt;
  const glint = VELOX_SLING.map((r, y) => (y === 8 ? '.obo.ocWSco' : r));
  veloxSlingArt = [bakeBladeArt(VELOX_SLING, VELOX_SLING_PAL), bakeBladeArt(glint, VELOX_SLING_PAL)];
  return veloxSlingArt;
}
// The staff sling at 32 px for her fine body (HERO_STAVES.sling's `fine`), drawn, not doubled: the iron
// hook, a one px cord in the haft's dark brown and the stone sat in its leather cup; the grip the same world px
const VELOX_SLING_FINE = [
  '....oooo..............',
  '...oGGGGo.............',
  '...oGGoGGo............',
  '...obBo.oGo...........',
  '...obBo.oGo...........',
  '...obBo..oBo..........',
  '...obBo...B...........',
  '...obBo...B...........',
  '...obBo....B..........',
  '...obBo....B..........',
  '...obBo.....B.........',
  '...obBo.....B.........',
  '...obBo......B........',
  '...obBo......B........',
  '...obBo.....oBooo.....',
  '...obBo....occccco....',
  '...obBo...ocSSSScco...',
  '...obBo...ocSSSScco...',
  '...obBo....occccco....',
  '...obBo.....ooooo.....',
  '...obBo...............',
  '...obBo...............',
  '...obBo...............',
  '...obBo...............',
  '...obBo...............',
  '...obBo...............',
  '...obBo...............',
  '...obBo...............',
  '...obBo...............',
  '...obBo...............',
  '...oBBo...............',
  '....oo................',
];
let veloxSlingFineArt = null;
function veloxSlingFine() {
  if (veloxSlingFineArt) return veloxSlingFineArt;
  const tag = (c) => { c.dens = 2; return c; };
  const glint = VELOX_SLING_FINE.map((r, y) => (y === 16 ? r.replace('ocSSSS', 'ocWSSS') : r));
  return (veloxSlingFineArt = [tag(bakeBladeArt(VELOX_SLING_FINE, VELOX_SLING_PAL)), tag(bakeBladeArt(glint, VELOX_SLING_PAL))]);
}
HERO_STAVES.sling = { art: veloxSling, fine: veloxSlingFine, grip: VELOX_SLING_GRIP, lean: 'right' }; // the pouch hangs low and out, the hook still leans right
