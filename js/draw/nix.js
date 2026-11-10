'use strict';
// ------------------------------------------------------------ nix
// NIX's pixels (her rules: js/sim/nix.js): SNOW CLOUD's heap of snow powder on
// the ground, drawn for both sides over the bodies (a rival sees the cloud, never
// her in it), its shadow under them, and the ICE SHARD out and home (HERO_AIR, HERO_GROUND); her body see-through to her own
// side while she is hidden (HERO_FADE); her ICE DIRK in her hands (HERO_BLADES).

const NIX_INK = '#2e2440', NIX_SNOW = '#f4f8fd', NIX_SNOW_D = '#a9bdd6', NIX_ICE = '#bfe6f8', NIX_ICE_D = '#7cc4e8';

// a filled pixel disc, row by row, centre (x, y)
function nixDisc(x, y, r) {
  for (let j = -r; j <= r; j++) {
    const w = Math.floor(Math.sqrt(r * r - j * j + r * 0.8));
    ctx.fillRect(x - w, y + j, w * 2 + 1, 1);
  }
}
// where the cloud's nine puffs hang, by the clock: [dx, dy, r] from its middle (shared by the
// cloud and its shadow)
function nixPuffs(c, now, grow) {
  const k0 = (c.x * 7 + c.y * 3) | 0, out = [];
  for (let i = 0; i < 9; i++) {
    const ang = i * 0.7 + k0 * 0.13 + now * 0.25 * (i % 2 ? 1 : -1), rr = (i === 0 ? 0 : CLOUD_R * 0.55) * grow;
    out.push([Math.round(Math.cos(ang) * rr), Math.round(Math.sin(ang) * rr * 0.6), Math.round((i === 0 ? 16 : 11 + (i % 3) * 2) * grow)]);
  }
  return out;
}
// the cloud's shadow on the snow, under the bodies: each puff's own shadow, run together
// into one soft shape with a lobed, ragged rim (never a disc), out to the cloud's reach
function drawNixCloudShadow(c, ex, ey, now) {
  const left = 1 - c.t / c.life, grow = Math.min(1, c.t / 0.25), cx = Math.round(c.x - ex), cy = Math.round(c.y - ey) + 3;
  const puffs = nixPuffs(c, now, grow), seed = (c.x * 7 + c.y * 3) | 0;
  ctx.globalAlpha = 0.16 * Math.min(1, left * 3); ctx.fillStyle = NIX_INK;
  for (let j = -CLOUD_R; j <= CLOUD_R; j++) {
    const spans = [];
    for (const [dx, dy, r] of puffs) {
      const rx = r + 6, ry = r * 0.75 + 4, v = (j - dy * 1.3) / ry;
      if (Math.abs(v) >= 1) continue;
      const w = Math.round(rx * Math.sqrt(1 - v * v));
      spans.push([dx * 1.25 - w, dx * 1.25 + w]);
    }
    spans.sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < spans.length;) {
      let x0 = spans[i][0], x1 = spans[i][1]; i++;
      while (i < spans.length && spans[i][0] <= x1 + 1) { x1 = Math.max(x1, spans[i][1]); i++; }
      x0 = Math.round(x0 + 3 * hash2(seed + j, 1)); x1 = Math.round(x1 - 3 * hash2(seed + j, 2)); // the rim frays row by row
      if (x1 > x0) ctx.fillRect(cx + x0, cy + j, x1 - x0 + 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// The cloud, over the bodies: puffs of powder heaped round its middle, each on its own slow
// drift from the clock (never a roll), thinning out as its time runs down
function drawNixCloud(c, ex, ey, now) {
  const cx = Math.round(c.x - ex), cy = Math.round(c.y - ey);
  const left = 1 - c.t / c.life, grow = Math.min(1, c.t / 0.25);
  const k0 = (c.x * 7 + c.y * 3) | 0;
  const a = 0.5 * Math.min(1, left * 3);
  const puffs = nixPuffs(c, now, grow);
  for (let pass = 0; pass < 2; pass++) {
    for (const [dx, dy, r] of puffs) {
      const x = cx + dx, y = cy - 6 + dy;
      ctx.globalAlpha = pass ? a : a * 0.6;
      ctx.fillStyle = pass ? NIX_SNOW : NIX_SNOW_D;
      nixDisc(x, y + (pass ? 0 : 2), pass ? r - 2 : r);
    }
  }
  // flecks in the air above it
  ctx.globalAlpha = Math.min(1, left * 3);
  ctx.fillStyle = '#ffffff';
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
// SQUALL: the burst of snow she vanishes into, where she stood: a whirl of drift snow thrown
// up and round, clump by clump, ice glinting in it, over a patch swept bare; it turns for as
// long as she is gone and drops when she strikes
function drawSquallFx(f, px, py, now) {
  const u = f.t / f.life, seed = fxSeed(f), up = Math.min(1, u * 6), down = Math.max(0, (u - 0.8) / 0.2);
  ctx.fillStyle = NIX_SNOW_D; fillEllipsePx(px, py + 3, Math.round(9 * up), Math.round(3 * up)); // the snow swept off the ground
  ctx.fillStyle = '#8ea6c6'; fillEllipsePx(px + 1, py + 3, Math.round(5 * up), Math.round(1 * up));
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < 26; k++) {
    const turn = k * 2.399 + u * (7 + 3 * fxRoll(seed, k, 1)), back = Math.sin(turn) < 0;
    if (back !== (pass === 0)) continue; // the far side of the whirl first
    const h = fxRoll(seed, k, 2), r = (4 + 11 * h) * up * (1 + 0.5 * down), z = Math.round((2 + 13 * h) * up * (1 - down));
    const x = Math.round(px + Math.cos(turn) * r), y = Math.round(py + 2 + Math.sin(turn) * r * 0.45 - z);
    const w = 2 + Math.round(3 * fxRoll(seed, k, 3) * (1 - 0.5 * h));
    ctx.fillStyle = back ? NIX_SNOW_D : NIX_SNOW; ctx.fillRect(x, y, w, w > 3 ? 2 : 1); // its lit top (the far ones in shade)
    ctx.fillStyle = back ? '#8ea6c6' : NIX_SNOW_D; ctx.fillRect(x, y + (w > 3 ? 2 : 1), w, 1); // its underside
    if (k % 5 === 0) { ctx.fillStyle = k % 10 ? NIX_ICE : NIX_ICE_D; ctx.fillRect(x + w, y - 1, 1, 2); } // ice in it
  }
}
AB_FX_LOOK.squall = drawSquallFx;
function drawNixGround(ex, ey, now) { for (const c of nixClouds) drawNixCloudShadow(c, ex, ey, now); }
function drawNixAir(ex, ey, now) {
  for (const c of nixClouds) drawNixCloud(c, ex, ey, now);
  for (const s of nixShards) drawNixShard(s, ex, ey);
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
// ...and at 32 px for her fine body (NIX_DIRK_FINE), the grips the same world px
let nixDirkFine = null;
function nixDirksFine() {
  if (nixDirkFine) return nixDirkFine;
  const tag = (c) => { c.dens = 2; return c; };
  return (nixDirkFine = { flat: tag(bakeBladeArt(NIX_DIRK_FINE, NIX_DIRK_PAL)), diag: tag(bakeBladeArt(NIX_DIRK_DIAG_FINE, NIX_DIRK_PAL)) });
}
HERO_BLADES.dirk = { smear: 'nick', art: nixDirks, fine: nixDirksFine, hilt: [18, 11], hip: { down: [13, 10], up: [13, 10] }, grip: NIX_DIRK_GRIP };

HERO_GROUND.push(drawNixGround);
HERO_AIR.push(drawNixAir);
HERO_FADE.push(nixFade);
