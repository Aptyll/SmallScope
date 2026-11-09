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
// the cloud's shadow on the snow, under the bodies
function drawNixCloudShadow(c, ex, ey) {
  const left = 1 - c.t / c.life, grow = Math.min(1, c.t / 0.25);
  ctx.globalAlpha = 0.14 * Math.min(1, left * 3); ctx.fillStyle = NIX_INK;
  nixDisc(Math.round(c.x - ex), Math.round(c.y - ey) + 2, Math.round(CLOUD_R * 0.9 * grow));
  ctx.globalAlpha = 1;
}
// The cloud, over the bodies: puffs of powder heaped round its middle, each on its own slow
// drift from the clock (never a roll), thinning out as its time runs down
function drawNixCloud(c, ex, ey, now) {
  const cx = Math.round(c.x - ex), cy = Math.round(c.y - ey);
  const left = 1 - c.t / c.life, grow = Math.min(1, c.t / 0.25);
  const k0 = (c.x * 7 + c.y * 3) | 0;
  const a = 0.5 * Math.min(1, left * 3);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 9; i++) {
      const ang = i * 0.7 + k0 * 0.13 + now * 0.25 * (i % 2 ? 1 : -1);
      const rr = (i === 0 ? 0 : CLOUD_R * 0.55) * grow;
      const x = Math.round(cx + Math.cos(ang) * rr), y = Math.round(cy - 6 + Math.sin(ang) * rr * 0.6);
      const r = Math.round((i === 0 ? 16 : 11 + (i % 3) * 2) * grow);
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
function drawNixGround(ex, ey) { for (const c of nixClouds) drawNixCloudShadow(c, ex, ey); }
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
// Her ICE DIRK (HERO_BLADES.dirk, js/draw/heroes.js): no slanted carry, so facing
// down or up she holds it upright in the leading hand like any sword
let nixDirkArt = null;
function nixDirks() {
  if (nixDirkArt) return nixDirkArt;
  const flat = bakeBladeArt(NIX_DIRK, NIX_DIRK_PAL);
  return (nixDirkArt = { flat, diag: flat });
}
HERO_BLADES.dirk = { art: nixDirks, hilt: [18, 11], hip: {}, grip: [0, 0] };

HERO_GROUND.push(drawNixGround);
HERO_AIR.push(drawNixAir);
HERO_FADE.push(nixFade);
