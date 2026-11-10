'use strict';
// ------------------------------------------------------------ rupes
// RUPES's pixels (his rules: js/sim/rupes.js): the HEAVE's block in flight
// (HERO_SHOTS), the snowpack crusting his shoulders and head layer by layer
// (HERO_BODY_FX), and the AVALANCHE's snowball rolling in place of his body,
// growing as it goes (HERO_BODY_DRAW).

const RU_INK = '#141a2c', RU_SNOW = '#f4f7ff', RU_SNOW_M = '#cfe0f2', RU_SNOW_D = '#9fb6d8';

// ---- the maul in his hands ----------------------------------------------------------
// His ICE MAUL (HERO_BLADES.maul, js/draw/heroes.js): flat for the side, the swing and the
// wind-up; slanted, head up and out, for a body facing down or up.
let rupesMaulArt = null;
function rupesMauls() {
  return rupesMaulArt || (rupesMaulArt = { flat: bakeBladeArt(RUPES_MAUL, RUPES_MAUL_PAL), diag: bakeBladeArt(RUPES_MAUL_DIAG, RUPES_MAUL_PAL) });
}
HERO_BLADES.maul = { art: rupesMauls, hilt: [14, 9], hip: { down: [13, 11], up: [11, 10] }, grip: RUPES_MAUL_GRIP, hold: 'rest' };

// ---- shots -------------------------------------------------------------------------
// HEAVE's block: a 5 px cube of packed snow, its lit top and shaded face, tumbling
function drawSnowBlock(a, sx, sy, now) {
  const x = Math.round(sx) - 2, y = Math.round(sy) - 2;
  const turn = Math.floor(a.t * 12) % 2;
  ctx.fillStyle = RU_INK; ctx.fillRect(x - 1, y - 1, 7, 7);
  ctx.fillStyle = RU_SNOW_M; ctx.fillRect(x, y, 5, 5);
  ctx.fillStyle = RU_SNOW; ctx.fillRect(x, y, 5, 2 + turn);
  ctx.fillStyle = RU_SNOW_D; ctx.fillRect(x + 4 - turn * 4, y + 2, 1, 3);
}
HERO_SHOTS.snowblock = drawSnowBlock;

// ---- the snowpack on him ----------------------------------------------------------------
// One crust per layer, over the body: the shoulders, then the arms' tops, then the
// head's crown. (ax, ay) is the 16 px cell's top-left.
const PACK_CRUST = [
  [[2, 8, 3], [11, 8, 3]],                          // layer 1: the shoulders, inside the ink
  [[2, 9, 2], [12, 9, 2], [2, 10, 1], [13, 10, 1]], // layer 2: down the arms
  [[5, 2, 6], [4, 9, 1], [11, 9, 1]],               // layer 3: the crown, and the shoulders thicker
];
function drawPackCrust(p, ax, ay, now, front) {
  if (!front || CLASSES[p.cls].passive !== 'snowpack' || !(p.pack > 0)) return;
  const n = packLayers(p);
  for (let k = 0; k < n; k++) for (const [x, y, w] of PACK_CRUST[k]) {
    ctx.fillStyle = RU_SNOW; ctx.fillRect(ax + x, ay + y, w, 1);
  }
  if (p.pack >= 1 && Math.floor(now * 3) % 4 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(ax + 7, ay + 1, 1, 1); }
}
HERO_BODY_FX.push(drawPackCrust);

// ---- the avalanche ----------------------------------------------------------------------
// The snowball in his place while he rolls: a disc as wide as the roll has grown,
// ink-rimmed, lit from the top left, with flecks of grit turning over as it goes
// and his side's colour in the snow he swept up.
function drawSnowball(p, px, py, now) {
  if (!(p.rushT > 0) || p.dash !== 'avalanche') return false;
  const r = avaRadius(p), cx = px + 8, cy = py + 16 - r; // its foot on the cell's floor
  ctx.fillStyle = 'rgba(40,52,90,0.28)'; // its own shadow
  ctx.fillRect(cx - r + 1, py + 15, r * 2 - 2, 2);
  for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = Math.hypot(x + 0.5, y + 0.5);
    if (d > r + 0.6) continue;
    ctx.fillStyle = d > r - 0.6 ? RU_INK : x + y > r * 0.5 ? RU_SNOW_D : x + y > -r * 0.4 ? RU_SNOW_M : RU_SNOW;
    ctx.fillRect(cx + x, cy + y, 1, 1);
  }
  // flecks on the turning surface: they travel across the face the way it rolls
  const spin = (p.avaD || 0) / Math.max(4, r);
  const mark = TEAMS[skin(p.team)].mark;
  for (let k = 0; k < 4; k++) {
    const a = spin + k * Math.PI / 2, f = Math.cos(a);
    if (f < 0) continue; // the far side
    const along = Math.sin(a) * (r - 2);
    const fx = Math.round(cx + p.rushNX * along - p.rushNY * (k - 1.5) * r * 0.35);
    const fy = Math.round(cy + p.rushNY * along * 0.7 + p.rushNX * (k - 1.5) * r * 0.25);
    ctx.fillStyle = k === 1 ? mark : RU_SNOW_D;
    ctx.fillRect(fx, fy, 1, 1);
  }
  return true;
}
HERO_BODY_DRAW.push(drawSnowball);
