'use strict';
// A building's pixels: the gold pump's stroke and ring, and structSprite -
// how a STRUCTS entry finds its sprite and where it is laid.
// ------------------------------------------------------------ the gold pump and a building's sprite
// THE GOLD PUMP'S STROKE (js/baked/pump.js): the frame is read off the
// pump's own payout clock, so every screen that is sent payT draws the same
// nod. A whole number of PUMP_STROKE-long strokes fits one `period`, so the
// pay lands as a stroke ends, and for PUMP_HOP s after it a coin hops out of
// the barrel's mouth (SPRITES.pumpMouth) toward the +N.
const PUMP_STROKE = 1.25; // s a stroke takes, near enough: rounded to fit the period
const PUMP_HOP = 0.6;     // s the payout's coin is in the air
const PUMP_GREY = '#8e97ac'; // the ring of a pump nobody holds
// the pump's paint: its holder's set, or the grey one held by nobody
function pumpSet(o) { return o.hold >= 0 ? SPRITES.teamBuild[skin(o.hold)] : SPRITES.pumpNeutral; }
function pumpFrame(o) {
  const t = STRUCTS.generator.tiers[o.tier], set = pumpSet(o).pumpAnim[o.tier];
  const n = Math.max(1, Math.round(t.period / PUMP_STROKE));
  const u = Math.min(1, Math.max(0, 1 - (o.payT || 0) / t.period)); // 0 just paid, 1 about to
  return set[Math.floor(((u * n) % 1) * set.length) % set.length];
}
function drawPumpCoin(o, sx, sy) {
  if (o.hold < 0 || !o.paid) return; // only a pay hops a coin (a fresh flip has paid nothing yet)
  const since = STRUCTS.generator.tiers[o.tier].period - (o.payT || 0);
  if (since < 0 || since > PUMP_HOP) return;
  const k = since / PUMP_HOP, m = SPRITES.pumpMouth[o.tier];
  const x = Math.round(sx + m[0] + 7 * k) - 1, y = Math.round(sy + m[1] - 2 - 13 * Math.sin(k * Math.PI)) - 1;
  ctx.fillStyle = '#221c2e'; ctx.fillRect(x - 1, y, 5, 3); ctx.fillRect(x, y - 1, 3, 5);
  ctx.fillStyle = '#d8a850'; ctx.fillRect(x, y, 3, 3);
  ctx.fillStyle = '#f2cc6a'; ctx.fillRect(x, y, 2, 2);
  ctx.fillStyle = '#fff2c0'; ctx.fillRect(x, y, 1, 1);
}

// THE PUMP'S RING (js/sim/pumps.js), flat on the snow under everything: the
// roost's glowing rim in the holder's mark, or grey held by nobody, and the
// fill of whichever side is taking it as an arc of its mark running round
// from the top. No text: the colours are the whole read. The fill shows only
// where the viewer's side can see (a rival's take in the fog stays hidden).
const pumpArcC = new Map(); // r -> the rim's pixels, three deep, with their angle from the top
function pumpArc(r) {
  let a = pumpArcC.get(r);
  if (a) return a;
  a = [];
  for (const rr of [r, r - 1, r - 2]) for (const [x, y] of circlePts(rr)) a.push([x, y, (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2)]);
  pumpArcC.set(r, a);
  return a;
}
function drawPumpRings(ex, ey) {
  const r = Math.round(PUMP_R * TILE);
  for (const o of structures) {
    if (o.type !== 'generator') continue;
    const c = structCenter(o);
    const cx = Math.round(c.x - ex), cy = Math.round(c.y - ey);
    if (cx + r < 0 || cy + r < 0 || cx - r > WV_W || cy - r > WV_H) continue;
    ctx.drawImage(roostRingArt(o.hold >= 0 ? TEAMS[skin(o.hold)].mark : PUMP_GREY, r), cx - r, cy - r);
    if (o.capBy < 0 || !(o.cap > 0) || !(fogTeam < 0 || fogMargin(c.x, c.y) >= 0)) continue;
    const t = TEAMS[skin(o.capBy)], end = o.cap * Math.PI * 2;
    for (const [x, y, a] of pumpArc(r)) {
      if (a > end) continue;
      ctx.fillStyle = (x * x + y * y) >= (r - 1.5) * (r - 1.5) ? t.mark : t.coatD;
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

// a building wears its owner's team palette over its tier material
function structSprite(o) {
  if (o.type === 'generator') return pumpSet(o).generator[o.tier]; // a pump wears its holder's paint, not an owner's
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
