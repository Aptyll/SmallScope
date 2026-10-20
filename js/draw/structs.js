'use strict';
// A building's pixels: the gold pump's stroke, the net, and structSprite -
// how a STRUCTS entry finds its sprite and where it is laid.
// ------------------------------------------------------------ the gold pump, the net and a building's sprite
// THE GOLD PUMP'S STROKE (js/baked/pump.js): the frame is read off the
// pump's own payout clock, so every screen that is sent payT draws the same
// nod. A whole number of PUMP_STROKE-long strokes fits one `period`, so the
// pay lands as a stroke ends, and for PUMP_HOP s after it a coin hops out of
// the barrel's mouth (SPRITES.pumpMouth) toward the +N.
const PUMP_STROKE = 1.25; // s a stroke takes, near enough: rounded to fit the period
const PUMP_HOP = 0.6;     // s the payout's coin is in the air
function pumpFrame(o) {
  const t = STRUCTS.generator.tiers[o.tier], set = SPRITES.teamBuild[skin(o.team === undefined ? 0 : o.team)].pumpAnim[o.tier];
  const n = Math.max(1, Math.round(t.period / PUMP_STROKE));
  const u = Math.min(1, Math.max(0, 1 - (o.payT || 0) / t.period)); // 0 just paid, 1 about to
  return set[Math.floor(((u * n) % 1) * set.length) % set.length];
}
function drawPumpCoin(o, sx, sy) {
  const since = STRUCTS.generator.tiers[o.tier].period - (o.payT || 0);
  if (since < 0 || since > PUMP_HOP) return;
  const k = since / PUMP_HOP, m = SPRITES.pumpMouth[o.tier];
  const x = Math.round(sx + m[0] + 7 * k) - 1, y = Math.round(sy + m[1] - 2 - 13 * Math.sin(k * Math.PI)) - 1;
  ctx.fillStyle = '#221c2e'; ctx.fillRect(x - 1, y, 5, 3); ctx.fillRect(x, y - 1, 3, 5);
  ctx.fillStyle = '#d8a850'; ctx.fillRect(x, y, 3, 3);
  ctx.fillStyle = '#f2cc6a'; ctx.fillRect(x, y, 2, 2);
  ctx.fillStyle = '#fff2c0'; ctx.fillRect(x, y, 1, 1);
}

// The fish net, drawn flat on its hole in the pass right after the ground
// instead of y-sorted with the buildings that stand up out of it - a player
// walks OVER this one, so it must never sort in front of them. An unfinished
// net is rope still being paid out into the water (no scaffold: there is
// nothing out there to stand a frame on), and the catch shows through the
// mesh, which is the only thing that says a net is worth walking to.
function drawNet(o, px, py, now) {
  const spr = structSprite(o);
  const sh = o.shake > 0 ? Math.round(Math.sin(o.shake * 55) * 1.4) : 0;
  if (o.building) {
    ctx.globalAlpha = 0.3 + 0.55 * Math.min(1, o.buildT / o.buildTotal);
    ctx.drawImage(spr, px + sh, py);
    ctx.globalAlpha = 1;
    return;
  }
  drawSpriteFlash(spr, px + sh, py, o.flash);
  // the catch: up to NET_CAP fish lying in the mesh, each on its own bob -
  // the first o.sun of them gold sunfish, the rest frost pike
  for (let i = 0; i < o.fish; i++) {
    const fx = px + sh + NET_FISH_AT[i][0], fy = py + NET_FISH_AT[i][1] + (Math.floor(now * 3 + i) % 2);
    const c = i < (o.sun || 0) ? NET_FISH_SUN : NET_FISH_PIKE;
    ctx.fillStyle = c[0];
    ctx.fillRect(fx, fy, 5, 2);
    ctx.fillRect(fx + 5, fy - 1, 1, 1); ctx.fillRect(fx + 5, fy + 2, 1, 1); // tail fork
    ctx.fillStyle = c[1]; ctx.fillRect(fx + 1, fy + 1, 2, 1);
    ctx.fillStyle = '#101d2c'; ctx.fillRect(fx + 1, fy, 1, 1);
  }
  if (o.hp < o.maxHp) drawHealthBar(px + sh + 8, py - 5, o.hp, o.maxHp, 11, o.team, undefined, o); // + sh: rides the shudder, like every other building bar
}
const NET_FISH_AT = [[3, 4], [8, 8], [4, 11]]; // where a held fish lies in the mesh
const NET_FISH_PIKE = ['#7ab0cc', '#eaf8ff'], NET_FISH_SUN = ['#e0a030', '#fbe6a0']; // body, belly (js/baked/fish.js's ramps)

// a building wears its owner's team palette over its tier material
function structSprite(o) {
  const set = SPRITES.teamBuild[skin(o.team === undefined ? 0 : o.team)];
  const S = STRUCTS[o.type];
  // a type wearing another's grid (the barracks, `art`)
  const art = (S && S.art) || o.type;
  return set ? set[art][o.tier] : SPRITES[art][o.tier];
}
// where a building's sprite is laid, in px from its footprint's top-left: the
// skirt on the footprint's bottom edge, centred over its width (a sprite
// wider than its footprint overhangs both sides). The draw and the shot's
// sweep (structShotBox, sim.js) both read it.
function structArtOff(o, spr) {
  return { x: (structW(o) * TILE - spr.width) >> 1, y: structH(o) * TILE - spr.height };
}
