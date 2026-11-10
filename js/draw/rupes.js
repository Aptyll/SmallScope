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
HERO_BLADES.maul = { art: rupesMauls, hilt: [14, 9], hip: { down: [13, 12], up: [11, 10] }, grip: RUPES_MAUL_GRIP, hold: 'rest' };

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

// ---- the keys' own looks -----------------------------------------------------------------
// a lump of packed snow s px across, inked, lit on top
function ruLump(x, y, s) {
  ctx.fillStyle = RU_INK; ctx.fillRect(x - 1, y, s + 2, s); ctx.fillRect(x, y - 1, s, s + 2); // the corners cut: a lump, not a box
  ctx.fillStyle = RU_SNOW_D; ctx.fillRect(x, y, s, s); // shaded, or it reads as a hole on the snow
  ctx.fillStyle = RU_SNOW; ctx.fillRect(x, y, s - 1, Math.max(1, s >> 1));
}
// HEAVE's wind-up: the block torn up out of the snow at his side, growing as he lifts it,
// a scraped hole where it came from, and its shadow sliding out to its reach
function drawHeaveTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), hx = Math.round(p.x + nx * 9 - ex), hy = Math.round(p.y + 4 + ny * 5 - ey);
  ctx.fillStyle = RU_SNOW_D; fillEllipsePx(hx, hy, 4, 2);
  ruLump(hx - 2, hy - 4 - Math.round(10 * closing), 2 + Math.round(3 * closing));
  const L = teleLen(p.x, p.y, nx, ny, HEAVE_RANGE) * (0.4 + 0.6 * closing); // its shadow, sliding out to the reach
  ctx.fillStyle = 'rgba(30,40,80,0.35)'; fillEllipsePx(Math.round(p.x + nx * L - ex), Math.round(p.y + 3 + ny * L - ey), 3, 1);
}
// SHED's wind-up: the pack shaking loose, lumps of it hopping on the snow round his feet
// and spreading out toward the burst's reach
function drawShedTele(p, px, py, closing, now) {
  const n = 8 + packLayers(p) * 4, hop = Math.floor(now * 20) % 2;
  fxSpots(n).forEach(([ux, uy], k) => {
    const x = Math.round(px + ux * SHED_R * (0.3 + 0.6 * closing)), y = Math.round(py + 4 + uy * SHED_R * (0.3 + 0.6 * closing) * 0.8);
    ruLump(x, y - ((k + hop) % 2) * 2, k % 3 ? 2 : 3);
  });
}
// SHED landing: the whole pack thrown off him in lumps that fly out, land and lie, a bare
// scuffed patch where he stood; the more layers shed, the more and the bigger
function drawShedFx(f, px, py, now) {
  const u = f.t / f.life, n = f.n || 0, seed = fxSeed(f);
  ctx.globalAlpha = Math.min(1, 3 * (1 - u));
  ctx.fillStyle = RU_SNOW_D; fillEllipsePx(px, py + 4, 8, 4);
  drawFlung(px, py + 4, 0, Math.PI, f.r, 0.55, 14 + 4 * n, 12 + 6 * n, Math.min(1, u * 1.6), seed, (x, y, k) => ruLump(x - 1, y - 1, k % 3 ? 2 + (n > 1 ? 1 : 0) : 3 + (n > 0 ? 1 : 0)));
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.shed = drawShedFx;
// SHOULDER's wind-up: the furrow he is about to plough, a berm of snow either side of his
// path heaped up to where the charge ends
function drawShoulderTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = teleLen(p.x, p.y, nx, ny, SHOULDER_SPD * SHOULDER_T) * (0.4 + 0.6 * closing);
  for (let s = 8; s < L; s++) for (const side of [-1, 1]) {
    const w = side * (6 + Math.sin(s * 0.5)), x = Math.round(p.x + nx * s - ny * w - ex), y = Math.round(p.y + 4 + ny * s + nx * w - ey);
    ctx.fillStyle = RU_INK; ctx.fillRect(x, y + 1, 2, 2);
    ctx.fillStyle = RU_SNOW_D; ctx.fillRect(x, y + 1, 2, 1);
    ctx.fillStyle = RU_SNOW; ctx.fillRect(x, y, 2, 1);
  }
  const x = Math.round(p.x + nx * L - ex), y = Math.round(p.y + 4 + ny * L - ey);
  ruLump(x - 2, y - 2, 4); // the snow banked up at its end
}
// AVALANCHE's wind-up: the snow rolling up round him into the ball, lumps drawn in on a
// spiral, and powder kicked out ahead the way he will go
function drawAvalancheTele(p, px, py, a, closing, now) {
  for (let k = 0; k < 16; k++) {
    const f = (k / 16 + now * 1.8) % 1, r = 6 + 30 * (1 - f) * (1 - 0.5 * closing), t = k * 2.399 + f * 4;
    ruLump(Math.round(px + Math.cos(t) * r) - 1, Math.round(py + 4 + Math.sin(t) * r * 0.7) - 1, f > 0.6 ? 3 : 2);
  }
  const nx = Math.cos(a), ny = Math.sin(a);
  for (let k = 0; k < 10; k++) {
    const s = 12 + ((k * 9 + now * 90) % (40 * closing + 8)), w = (k - 4.5) * 2;
    ctx.fillStyle = RU_SNOW_D; ctx.fillRect(Math.round(px + nx * s - ny * w), Math.round(py + 4 + ny * s + nx * w), 2, 1);
  }
}
// AVALANCHE's burst: a cloud of powder blown out over the reach, puffs swelling and
// thinning as they go, and lumps of the ball thrown through it
const POWDER_PUFFS = 16;
function drawPowderFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f), go = 1 - (1 - u) * (1 - u);
  drawFlung(px, py + 2, 0, Math.PI, f.r, 0.5, 18, 14, Math.min(1, u * 1.3), seed, (x, y) => ruLump(x - 1, y - 1, 3));
  fxSpots(POWDER_PUFFS).forEach(([ux, uy], k) => {
    const x = px + ux * f.r * go * 0.9, y = py + uy * f.r * go * 0.75 - 4 * u, r = Math.round(4 + 7 * go * (0.6 + 0.4 * fxRoll(seed, k, 8)));
    ctx.globalAlpha = Math.min(1, 1.6 * (1 - u));
    ctx.fillStyle = '#7f98bc'; fillEllipsePx(x, y + 2, r, Math.round(r * 0.7));
    ctx.fillStyle = RU_SNOW; fillEllipsePx(x, y, r - 1, Math.round(r * 0.6));
  });
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.powder = drawPowderFx;
