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
// blade up beside his head on his right (behind him facing away); side-on it rides back over
// his shoulder, the blade behind his head, never across his lamp.
const FOSSOR_HAND_X = { down: 12, up: 12, left: 10, right: 5 }; // the fist's column on the 16 px cell
const FOSSOR_HAND_Y = 10;                                          // and its row: the mitts' row
function fossorCarry(p, px, py) {
  if (!isFossor(p)) return false;
  const img = fossorSpadeArtOf().diag, g = FOSSOR_SPADE_GRIP, back = p.dir === 'right'; // the blade behind him
  const gx = back ? img.width - 1 - g[0] : g[0];
  ctx.drawImage(back ? heldFlip(img) : img, Math.round(px + FOSSOR_HAND_X[p.dir] - gx), Math.round(py + FOSSOR_HAND_Y - g[1]));
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
