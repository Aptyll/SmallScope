'use strict';
// ------------------------------------------------------------ nix
// NIX's pixels (her rules: js/sim/nix.js): SNOW CLOUD's heap of snow powder on
// the ground, drawn for both sides over the bodies (a rival sees the cloud, never
// her in it), its shadow under them, and the ICE SHARD out and home (HERO_AIR, HERO_GROUND); her body see-through to her own
// side while she is hidden (HERO_FADE); her ICE DIRK in her hands (HERO_BLADES).

const NIX_INK = '#2e2440', NIX_SNOW = '#f4f8fd', NIX_SNOW_D = '#a9bdd6', NIX_ICE = '#bfe6f8', NIX_ICE_D = '#7cc4e8';

// a filled pixel disc, row by row, centre (x, y), on `g` (the frame's ctx by default)
function nixDisc(x, y, r, g = ctx) {
  for (let j = -r; j <= r; j++) {
    const w = Math.floor(Math.sqrt(r * r - j * j + r * 0.8));
    g.fillRect(x - w, y + j, w * 2 + 1, 1);
  }
}
// The cloud is one heap of puffs, painted solid on its own small canvas and laid on the
// frame at one strength, so the puffs never show as overlapping see-through circles.
// Puffs sit where the clock and the spot put them: a big one in the middle, a ring
// round it out to the cloud's whole reach (CLOUD_R), and loose wisps off the edge that
// break the round. Each drifts on its own slow beat; the heap swells in as it is thrown
// and sinks and thins as its time runs down.
const NIX_CLOUD_D = '#8ea3c2', NIX_CLOUD_PAD = 8, nixCloudCv = document.createElement('canvas'), nixCloudG = nixCloudCv.getContext('2d');
nixCloudCv.width = (CLOUD_R + NIX_CLOUD_PAD) * 2; nixCloudCv.height = CLOUD_R + NIX_CLOUD_PAD * 4;
function nixPuffs(c, now) {
  const k0 = (c.x * 7 + c.y * 3) | 0, grow = Math.min(1, c.t / 0.25), left = 1 - c.t / c.life;
  const sink = Math.max(0, 1 - left * 4), out = [];
  const roll = (i, j) => hash2(k0 + i * 31, j * 17 + 5);
  out.push([0, -2, 15]); // the heap's crown
  for (let i = 0; i < 10; i++) { // the ring, uneven: each puff its own size and reach
    const ang = (i + roll(i, 1) * 0.6) / 10 * Math.PI * 2 + now * 0.06 * (i % 2 ? 1 : -1);
    const r = 8 + Math.round(roll(i, 2) * 6), reach = CLOUD_R - r - 1 - roll(i, 3) * 6;
    out.push([Math.cos(ang) * reach, Math.sin(ang) * reach * 0.55, r]);
  }
  for (let i = 0; i < 7; i++) { // the wisps, drifting off and back on their own beat
    const ang = roll(i, 4) * Math.PI * 2 + now * 0.1, breathe = 0.5 + 0.5 * Math.sin(now * 0.9 + i * 2.1);
    const reach = CLOUD_R - 3 + breathe * 3;
    out.push([Math.cos(ang) * reach, Math.sin(ang) * reach * 0.55, 2 + Math.round(roll(i, 5) * 3)]);
  }
  return out.map(([x, y, r]) => [Math.round(x * grow), Math.round(y * grow + sink * 3), Math.max(1, Math.round(r * grow * (1 - sink * 0.35)))]);
}
// the cloud's shadow on the snow, under the bodies: the same heap pressed flat, lobed at
// its edge like the cloud over it
function drawNixCloudShadow(c, ex, ey, now) {
  const left = 1 - c.t / c.life, W = nixCloudCv.width, H = nixCloudCv.height, ox = W >> 1, oy = H >> 1;
  nixCloudG.clearRect(0, 0, W, H); nixCloudG.fillStyle = NIX_INK;
  for (const [x, y, r] of nixPuffs(c, now)) nixDisc(ox + x, oy + Math.round(y * 0.8) + 4, Math.max(1, r - 2), nixCloudG);
  ctx.globalAlpha = 0.16 * Math.min(1, left * 3);
  ctx.drawImage(nixCloudCv, Math.round(c.x - ex) - ox, Math.round(c.y - ey) - oy);
  ctx.globalAlpha = 1;
}
// The cloud, over the bodies: each puff a shaded underside and a lit top, the ones in
// front laid over the ones behind, the crown's top caught white; flecks hang over it
function drawNixCloud(c, ex, ey, now) {
  const left = 1 - c.t / c.life, W = nixCloudCv.width, H = nixCloudCv.height, ox = W >> 1, oy = (H >> 1) - 6;
  const puffs = nixPuffs(c, now).sort((a, b) => a[1] - b[1]); // back to front
  nixCloudG.clearRect(0, 0, W, H);
  for (const [x, y, r] of puffs) {
    if (r < 6) { nixCloudG.fillStyle = NIX_SNOW; nixDisc(ox + x, oy + y, r, nixCloudG); continue; } // a wisp: lit powder, too thin to shade
    nixCloudG.fillStyle = NIX_CLOUD_D; nixDisc(ox + x, oy + y + 1, r, nixCloudG); // its shaded underside
    nixCloudG.fillStyle = NIX_SNOW_D; nixDisc(ox + x, oy + y, r - 1, nixCloudG);
    nixCloudG.fillStyle = NIX_SNOW; nixDisc(ox + x - 1, oy + y - 2, r - 2, nixCloudG); // its lit top, the light from the upper left
    nixCloudG.fillStyle = '#ffffff'; nixDisc(ox + x - (r >> 2) - 1, oy + y - (r >> 1) - 1, r >> 2, nixCloudG);
  }
  ctx.globalAlpha = 0.7 * Math.min(1, left * 3);
  const cx = Math.round(c.x - ex), cy = Math.round(c.y - ey);
  ctx.drawImage(nixCloudCv, cx - ox, cy - (H >> 1));
  // flecks in the air above it
  ctx.globalAlpha = Math.min(1, left * 3);
  ctx.fillStyle = '#ffffff';
  const k0 = (c.x * 7 + c.y * 3) | 0;
  for (let i = 0; i < 10; i++) {
    const t = (now * 0.6 + i * 0.37 + k0 * 0.01) % 1;
    const x = Math.round(cx + Math.sin(i * 2.3 + k0) * CLOUD_R * 0.8), y = Math.round(cy - 4 - t * 26);
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}
// The shard: a short spike of ice along its flight, its shadow on the snow
function drawNixShard(s, ex, ey) {
  const x = Math.round(s.x - ex), y = Math.round(s.y - ey);
  ctx.globalAlpha = 0.3; ctx.fillStyle = NIX_INK; ctx.fillRect(x - 1, y + BOW_Y, 3, 1); ctx.globalAlpha = 1;
  for (let k = 0; k < 6; k++) {
    const px = Math.round(x - s.nx * k), py = Math.round(y - s.ny * k);
    ctx.fillStyle = NIX_INK; ctx.fillRect(px - 1, py, 3, 2);
  }
  for (let k = 0; k < 6; k++) {
    const px = Math.round(x - s.nx * k), py = Math.round(y - s.ny * k);
    ctx.fillStyle = k < 2 ? '#ffffff' : k < 4 ? NIX_ICE : NIX_ICE_D; ctx.fillRect(px, py, 1, 1);
  }
}
// ICE SHARD's wind-up: frost creeping out down the line it will fly, a strip of glaze on
// the snow, white at its broken edge, a few glints on it,
// to the first tree or wall on it
function drawShardTele(p, a, closing, ex, ey) {
  const nx = Math.cos(a), ny = Math.sin(a), L = teleLen(p.x, p.y, nx, ny, SHARD_LEN) * (0.35 + 0.65 * closing);
  fxStrip(p.x + nx * 8 - ex, p.y + 3 + ny * 8 - ey, nx, ny, L - 8, 2, 0, p.id * 29, '#ffffff', NIX_ICE, NIX_ICE_D); // narrow, to a sharp point: a shard's
  for (let k = 0; k < 4; k++) { // glints on the glaze, each where it likes, lit as the throw nears
    const s = 12 + fxRoll(p.id, k, 3) * (L - 20), o = (fxRoll(p.id, k, 6) * 2 - 1) * 1.5;
    if (s > L - 6 || fxRoll(p.id, k, 4) > 0.4 + closing) continue;
    const x = Math.round(p.x + nx * s - ny * o - ex), y = Math.round(p.y + 3 + ny * s + nx * o - ey);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
  }
}
// WHITEOUT's strike: she bursts up out of the snow, a white cut of her dirks and the
// powder thrown up round her
function drawWhiteStrikeFx(f, px, py, now) {
  const u = f.t / f.life;
  drawSwoosh(px, py, f.a, f.r, f.half, u, 5, [NIX_INK, '#ffffff', NIX_ICE_D], 1);
  drawFlung(px, py + 4, 0, Math.PI, 18, 0.3, 12, 12, Math.min(1, u * 1.4), fxSeed(f), (x, y, k) => {
    ctx.fillStyle = NIX_SNOW_D; ctx.fillRect(x, y + 1, 2, 1);
    ctx.fillStyle = k % 3 ? NIX_SNOW : NIX_ICE; ctx.fillRect(x, y, 2, 1);
  });
}
AB_FX_LOOK.white = drawWhiteStrikeFx;
// SQUALL's whirl: where she vanished the snow spins up round the spot she stood on,
// over the bodies (drawNixAir), streaks of powder wheeling round it, the near ones lit
// and the far ones shaded, no taller than she is, wound up fast and then flung loose
// and settling as she comes out; under it (its abFx look) the snow it presses down
function drawSquallWhirl(f, px, py) {
  const u = f.t / f.life, seed = fxSeed(f), spin = 9 * u + 3 * u * u;
  const loose = Math.max(0, (u - 0.6) / 0.4); // the last of it: the whirl breaks up and is flung off
  for (let k = 0; k < 22; k++) {
    const h = fxRoll(seed, k, 1), born = fxRoll(seed, k, 2) * 0.2; // how high on the whirl, when it is caught up
    if (u < born) continue;
    const th = fxRoll(seed, k, 3) * Math.PI * 2 + spin * (1.3 - h * 0.5); // the low snow turns faster
    const r = 5 + h * 7 + fxRoll(seed, k, 4) * 3, up = (1 + h * 14) * Math.min(1, (u - born) * 6);
    const at = (t) => [Math.round(px + Math.cos(t) * r), Math.round(py + 2 + Math.sin(t) * r * 0.4 - up)];
    if (!loose) { // a curved streak of powder along the whirl, its head bright, trailing back the way it turns
      const len = 3 + Math.round(fxRoll(seed, k, 5) * 6), step = 1.1 / r;
      for (let j = 0; j < len; j++) {
        const t = th - j * step, [x, y] = at(t), near = Math.sin(t) > 0;
        ctx.fillStyle = near ? (j < len * 0.6 ? '#ffffff' : NIX_SNOW) : (j < len * 0.6 ? NIX_SNOW_D : NIX_CLOUD_D);
        ctx.fillRect(x, y, 1, 1);
      }
      continue;
    }
    for (let j = 0; j < 3; j++) { // flung off: each streak breaks into specks thrown out on their own lines, falling
      const t = th - j * 0.4 + (fxRoll(seed, k * 3 + j, 6) - 0.5), go = loose * (6 + fxRoll(seed, k * 3 + j, 7) * 12);
      const [x0, y0] = at(t), x = Math.round(x0 + Math.cos(t) * go), y = Math.round(y0 + Math.sin(t) * go * 0.4 + loose * loose * 8);
      ctx.globalAlpha = 1 - loose * 0.7; ctx.fillStyle = Math.sin(t) > 0 ? '#ffffff' : NIX_SNOW_D; ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
function drawSquallFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f);
  ctx.globalAlpha = 0.25 * (1 - u); ctx.fillStyle = NIX_INK; // the pressed snow under it
  for (let k = 0; k < 5; k++) ctx.fillRect(Math.round(px - 7 + fxRoll(seed, k, 7) * 10), py + 2 + Math.round(fxRoll(seed, k, 8) * 3), 3 + Math.round(fxRoll(seed, k, 9) * 3), 1);
  ctx.globalAlpha = 1;
}
AB_FX_LOOK.squall = drawSquallFx;
// DRIFT STEP's path: the drift snow her step sweeps up, low over the ground. Scattered,
// never rows: big curls bunched where she left, thinning to a few flecks where she
// comes out, strays off both sides; thrown up as she passes, settling from the near end
function drawDriftFx(f, px, py, now) {
  const u = f.t / f.life, c = Math.cos(f.a), s = Math.sin(f.a), seed = fxSeed(f);
  const front = Math.min(1, u * 5) * f.r, gone = Math.max(0, (u - 0.35) / 0.65) * f.r; // how far it has been swept, how far it has settled
  for (let k = 0, n = Math.round(f.r / 2.5); k < n; k++) {
    const far = Math.pow(fxRoll(seed, k, 1), 1.7), d = 2 + far * (f.r - 4); // bunched toward where she left
    if (d > front || d < gone || fxRoll(seed, k, 4) < far * 0.5) continue;
    const age = Math.min(1, (front - d) / 30 + u), wide = fxRoll(seed, k, 2) * 2 - 1;
    const side = wide * (3 + 9 * fxRoll(seed, k, 5)) * (0.6 + 0.4 * age); // strays well off either side
    const big = 2 + Math.round(4 * (1 - far) * (0.35 + 0.65 * fxRoll(seed, k, 3))), w = Math.max(1, Math.round(big * (age < 0.7 ? 1 : 0.6))); // 2 to 6 px, smaller as it settles
    const lift = Math.round((2 + big) * Math.sin(Math.PI * Math.min(1, age * 1.3)) * 0.8);
    const x = Math.round(px + c * d - s * side), y = Math.round(py + 3 + s * d + c * side);
    ctx.fillStyle = 'rgba(40,52,90,0.4)'; ctx.fillRect(x - 1, y + 1, w + 2, 1); // its shadow on the snow
    ctx.fillStyle = NIX_SNOW_D; ctx.fillRect(x, y - lift, w, w > 3 ? 2 : 1); // its shaded underside
    ctx.fillStyle = NIX_SNOW; ctx.fillRect(x, y - lift - (w > 3 ? 2 : 1), w, w > 3 ? 2 : 1); // its lit top,
    if (w > 4) { ctx.fillRect(x + 1, y - lift - 3, w - 2, 1); ctx.fillStyle = NIX_ICE_D; ctx.fillRect(x + w, y - lift - 2, 1, 1); } // a big one's curl and a fleck of ice off it
  }
}
AB_FX_LOOK.drift = drawDriftFx;
function drawNixGround(ex, ey, now) { for (const c of nixClouds) drawNixCloudShadow(c, ex, ey, now); }
function drawNixAir(ex, ey, now) {
  for (const c of nixClouds) drawNixCloud(c, ex, ey, now);
  for (const s of nixShards) drawNixShard(s, ex, ey);
  for (const f of abFx) if (f.fx === 'squall') drawSquallWhirl(f, Math.round(f.x - ex), Math.round(f.y - ey));
}
// see-through to her own side while the cloud or SQUALL hides her
function nixFade(p) {
  if (CLASSES[p.cls].passive !== 'nightwatch') return 1;
  return p.nixWhiteT > 0 || (nixCloudOf(p) && !(p.nixOutT > 0)) ? 0.5 : 1;
}

// ---- the dirk in her hands ---------------------------------------------------
// Her ICE DIRK (HERO_BLADES.dirk, js/draw/heroes.js): at rest she holds it at the
// ready, point up and out from the fist at her hip (BLADE_HOLDS.slant), the same in
// every facing; short as it is, the point stays under her brow
let nixDirkArt = null;
function nixDirks() {
  return nixDirkArt || (nixDirkArt = { flat: bakeBladeArt(NIX_DIRK, NIX_DIRK_PAL), diag: bakeBladeArt(NIX_DIRK_DIAG, NIX_DIRK_PAL) });
}
HERO_BLADES.dirk = { smear: 'nick', art: nixDirks, hilt: [18, 11], hip: { down: [13, 10], up: [13, 10] }, grip: NIX_DIRK_GRIP };

HERO_GROUND.push(drawNixGround);
HERO_AIR.push(drawNixAir);
HERO_FADE.push(nixFade);
