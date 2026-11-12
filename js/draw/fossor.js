'use strict';
// ------------------------------------------------------------ fossor
// FOSSOR's pixels (his rules: js/sim/fossor.js): his spade in his hands
// (HERO_BLADES, HERO_CARRY), his snow banks and his broken ground on the snow (HERO_GROUND),
// the mound he runs under and his planted feet (HERO_BODY_FX, HERO_FADE).

const FS_INK = '#141a2c', FS_SNOW = '#f4f7ff', FS_SNOW_M = '#cfe0f2', FS_SNOW_D = '#9fb6d8';
const FS_EARTH = '#8a6d50', FS_EARTH_L = '#d9ad72', FS_EARTH_D = '#5c4a38';

// ---- the spade in his hands ----------------------------------------------------------------
let fossorSpadeArt = null;
function fossorSpadeArtOf() {
  return fossorSpadeArt || (fossorSpadeArt = { flat: bakeBladeArt(FOSSOR_SPADE, FOSSOR_SPADE_PAL), diag: bakeBladeArt(FOSSOR_SPADE_DIAG, FOSSOR_SPADE_PAL) });
}
// no `hip`: at rest he carries it his own way (fossorCarry), not on a shared hold
HERO_BLADES.spade = { art: fossorSpadeArtOf, hilt: [16, 9], hip: {}, grip: FOSSOR_SPADE_GRIP };
// At rest his fist closes on the spade's haft right at his hand on the body, so only a stub of
// haft shows under it and nothing hangs below him. Facing down or up he holds it at the ready,
// blade up beside his head on his right (behind him facing away); side-on his fist is at the
// front of his body and the blade leans the way he faces, out ahead of his lamp, never across it.
const FOSSOR_HAND_X = { down: 12, up: 12, left: 5, right: 10 }; // the fist's column on the 16 px cell
const FOSSOR_HAND_Y = 10;                                          // and its row: the mitts' row
function fossorCarry(p, px, py) {
  if (!isFossor(p)) return false;
  const img = fossorSpadeArtOf().diag, g = FOSSOR_SPADE_GRIP, flip = p.dir === 'left'; // the blade up and left
  const gx = flip ? img.width - 1 - g[0] : g[0];
  ctx.drawImage(flip ? heldFlip(img) : img, Math.round(px + FOSSOR_HAND_X[p.dir] - gx), Math.round(py + FOSSOR_HAND_Y - g[1]));
  return true;
}
HERO_CARRY.push(fossorCarry);

// ---- the bank: packed snow blocks on each tile it walls --------------------------------------
// each block rises over FS_UP, stands with a lit top and a shaded face, and blinks its last half second
const FS_UP = 0.15;
function drawFossorBank(g, ex, ey, now) {
  const left = g.life - g.t;
  if (left < 0.5 && Math.floor(now * 10) % 2 === 0) return;
  const h = Math.round(6 * Math.min(1, g.t / FS_UP));
  for (const k of g.tiles) {
    const x = (k % WORLD) * TILE - Math.round(ex), y = Math.floor(k / WORLD) * TILE - Math.round(ey);
    ctx.fillStyle = FS_INK; ctx.fillRect(x, y + 4 - h, TILE, TILE - 4 + h);
    ctx.fillStyle = FS_SNOW_M; ctx.fillRect(x + 1, y + 5 - h, TILE - 2, TILE - 6);
    ctx.fillStyle = FS_SNOW; ctx.fillRect(x + 1, y + 5 - h, TILE - 2, 3);
    ctx.fillStyle = FS_SNOW_D; ctx.fillRect(x + 1, y + TILE - 1 - Math.min(h, 4), TILE - 2, Math.min(h, 4));
  }
}

// ---- the broken ground: a crack down the line, slabs heaving up at its front -------------------
function drawFossorQuake(g, ex, ey) {
  const px = -g.ny, py = g.nx;
  for (let s = 6; s <= g.d; s += 1) {
    const w = Math.round(Math.sin(s * 0.7) * 1.5);
    const x = Math.round(g.x0 + g.nx * s + px * w - ex), y = Math.round(g.y0 + g.ny * s + py * w - ey);
    ctx.fillStyle = FS_EARTH_D; ctx.fillRect(x, y, 1, 1);
  }
  for (let s = Math.max(12, g.d - 48); s <= g.d; s += 12) { // the slabs heaving at its front, highest at the front itself
    const lift = Math.max(0, 3 - Math.floor((g.d - s) / 16));
    for (const side of [-1, 1]) {
      const x = Math.round(g.x0 + g.nx * s + px * side * 5 - ex), y = Math.round(g.y0 + g.ny * s + py * side * 5 - ey) - lift;
      ctx.fillStyle = FS_INK; ctx.fillRect(x - 3, y - 2, 6, 5);
      ctx.fillStyle = FS_EARTH; ctx.fillRect(x - 2, y - 1, 4, 3);
      ctx.fillStyle = FS_EARTH_L; ctx.fillRect(x - 2, y - 1, 4, 1);
      ctx.fillStyle = FS_SNOW; ctx.fillRect(x - 1, y - 2, 2, 1);
    }
  }
}
function drawFossorGround(ex, ey, now) {
  for (const g of fossorBanks) drawFossorBank(g, ex, ey, now);
  for (const g of fossorQuakes) drawFossorQuake(g, ex, ey);
}

// ---- his keys' own looks ------------------------------------------------------------------------
// SPADEFUL: clods of snow flung out across the wedge and falling back, no swish (a spade is no blade)
function drawSpadeFx(f, px, py) {
  const u = f.t / f.life;
  drawFlung(px, py + 2, f.a, f.half, f.r + 6, 0.35, 9, 11, Math.min(1, u * 1.3), fxSeed(f), (x, y, k) => fxChip(x, y, k, FS_SNOW, FS_SNOW_M, FS_SNOW_D));
}
AB_FX_LOOK.spade = drawSpadeFx;
// BANK UP's wind-up: lumps of snow heaping where the bank will stand, across the aim
// at its full width, taller as the heave comes
function drawBankTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), cx = p.x + nx * BANK_AHEAD, cy = p.y + ny * BANK_AHEAD;
  const h = 1 + Math.round(closing * 3);
  for (let s = -BANK_HALF, k = 0; s <= BANK_HALF; s += 6, k++) {
    const x = Math.round(cx - ny * s - ex), y = Math.round(cy + nx * s - ey), w = 3 + (k % 2), hk = Math.max(1, h - (k % 3 === 2 ? 1 : 0));
    ctx.fillStyle = FS_SNOW_D; ctx.fillRect(x - w, y + 1, w * 2 + 1, 1);
    ctx.fillStyle = FS_SNOW_M; ctx.fillRect(x - w + 1, y + 1 - hk, w * 2 - 1, hk);
    ctx.fillStyle = FS_SNOW; ctx.fillRect(x - w + 2, y + 1 - hk, w * 2 - 3, 1);
  }
}
// BREAK GROUND's wind-up: the ground splitting from his spade down the whole line,
// the split running out as the spade comes down, and the snow lifting in flakes at
// the edges it will throw from
function drawQuakeTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = teleLen(p.x, p.y, nx, ny, QUAKE_LEN), run = L * (0.3 + 0.7 * closing);
  const ox = -ny, oy = nx, seed = p.id * 29 + 5;
  for (let s = 8; s <= run; s += 0.5) { // the split: a wandering dark line with its lit lip under it
    const w = Math.round((fxRoll(seed, s >> 2, 3) - 0.5) * 3);
    const x = Math.round(p.x + nx * s + ox * w - ex), y = Math.round(p.y + 3 + ny * s + oy * w - ey);
    ctx.fillStyle = FS_EARTH_L; ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = FS_EARTH_D; ctx.fillRect(x, y, 1, 1);
  }
  for (let s = 16, k = 0; s <= L; s += 14, k++) { // its throw's width: the snow lifting off both edges, the whole length, nearer up first
    if (s > run + 10) break;
    for (const side of [-1, 1]) {
      const o = QUAKE_W * side + Math.round((fxRoll(seed, k, side + 7) - 0.5) * 3);
      const x = Math.round(p.x + nx * s + ox * o - ex), y = Math.round(p.y + 3 + ny * s + oy * o - ey);
      fxChip(x, y - (s <= run ? 1 : 0), k + side, FS_SNOW, FS_SNOW_M, FS_SNOW_D);
    }
  }
}

// ---- on his body ------------------------------------------------------------------------------
// under the snow: a mound of snow running over him, his lamp glinting out of its front;
// planted: snow kicked up round his feet
function drawFossorFx(p, ax, ay, now, front) {
  if (!isFossor(p)) return;
  if (front && isBurrowing(p)) {
    const a0 = ctx.globalAlpha; ctx.globalAlpha = 1; // the mound is solid over his faded body
    ctx.fillStyle = FS_INK; ctx.fillRect(ax + 2, ay + 9, 12, 7); ctx.fillRect(ax + 3, ay + 8, 10, 1);
    ctx.fillStyle = FS_SNOW_M; ctx.fillRect(ax + 3, ay + 10, 10, 5);
    ctx.fillStyle = FS_SNOW; ctx.fillRect(ax + 4, ay + 9, 8, 2);
    ctx.fillStyle = FS_SNOW_D; ctx.fillRect(ax + 3, ay + 14, 10, 1);
    if (Math.floor(now * 8) % 2 === 0) { ctx.fillStyle = '#ffd24a'; ctx.fillRect(ax + (p.dir === 'left' ? 4 : 11), ay + 11, 1, 1); }
    ctx.globalAlpha = a0;
    return;
  }
  if (!front && fossorPlanted(p) && !p.moving) {
    ctx.fillStyle = FS_SNOW_D; ctx.fillRect(ax + 3, ay + 15, 10, 1);
    ctx.fillStyle = FS_SNOW; ctx.fillRect(ax + 3, ay + 14, 2, 1); ctx.fillRect(ax + 11, ay + 14, 2, 1);
  }
}
// under the snow only the top of him shows through, under the mound
function fossorFade(p) { return isFossor(p) && isBurrowing(p) ? 0.3 : 1; }

HERO_GROUND.push(drawFossorGround);
HERO_BODY_FX.push(drawFossorFx);
HERO_FADE.push(fossorFade);
