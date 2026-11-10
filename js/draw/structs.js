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
  const t = STRUCTS.pump, set = pumpSet(o).pumpAnim;
  const n = Math.max(1, Math.round(t.period / PUMP_STROKE));
  const u = Math.min(1, Math.max(0, 1 - (o.payT || 0) / t.period)); // 0 just paid, 1 about to
  return set[Math.floor(((u * n) % 1) * set.length) % set.length];
}
function drawPumpCoin(o, sx, sy) {
  if (o.hold < 0 || !o.paid) return; // only a pay hops a coin (a fresh flip has paid nothing yet)
  const since = STRUCTS.pump.period - (o.payT || 0);
  if (since < 0 || since > PUMP_HOP) return;
  const k = since / PUMP_HOP, m = SPRITES.pumpMouth;
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
    if (o.type !== 'pump') continue;
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

// a building's still sprite: its own `sprite(o)` when its entry has one (a
// pump wears its holder's paint, not an owner's), else its owner's team set,
// under its type's name or the grid it wears (`art`: the barracks)
function structSprite(o) {
  const S = STRUCTS[o.type];
  if (S.sprite) return S.sprite(o);
  return SPRITES.teamBuild[skin(o.team === undefined ? 0 : o.team)][S.art || o.type];
}
// where a building's sprite is laid, in px from its footprint's top-left: the
// skirt on the footprint's bottom edge, centred over its width (a sprite
// wider than its footprint overhangs both sides). The draw and the shot's
// sweep (structShotBox, sim.js) both read it.
function structArtOff(o, spr) {
  return { x: (structW(o) * TILE - spr.width) >> 1, y: structH(o) * TILE - spr.height };
}

// THE HOUR ON A BUILDING. The hour's grade warms the bright snow and lifts
// the shade toward blue (todGrade, js/draw/light.js), so at dawn and dusk a
// grey stone tower stood cold in a gold valley. While the hour has a colour
// (crownHour, js/draw/ground.js: the pines' own share) a building's sunward
// grey and pale pixels (never its team's paint) are lifted toward the drifts'
// white, and the grade then warms them with the snow. A ROUND building
// (HOUR_ROUND: the tower) takes it on its sunward side, the left of its
// sprite, so it turns a lit face and a shaded one; a flat front takes it
// evenly, at HOUR_FLAT. One more blit a building, off a mask kept per sprite.
const HOUR_LIT = [246, 242, 238]; // the warm white the lit side is lifted toward
const HOUR_SHARE = 0.55;          // how far, at the hour's full colour
const HOUR_GREY = 70;             // a pixel whose channels spread wider than this is paint, not stone
const HOUR_FLAT = 0.6;            // a flat front's share of what a round one's lit side takes
const HOUR_ROUND = { tower: true };
const hourLitCv = new WeakMap();  // sprite -> its lit pixels in HOUR_LIT
function hourLitOf(spr, round) {
  let c = hourLitCv.get(spr);
  if (c) return c;
  const w = spr.width, h = spr.height;
  c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(spr, 0, 0);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = d[i], gr = d[i + 1], b = d[i + 2];
    const luma = 0.3 * r + 0.59 * gr + 0.11 * b, grey = Math.max(r, gr, b) - Math.min(r, gr, b) < HOUR_GREY;
    // round: the sunward half whole, a narrow step past the middle at half, the lee none
    const a = !d[i + 3] || !grey || luma < 105 ? 0 : !round ? HOUR_FLAT : x < w * 0.5 ? 1 : x < w * 0.68 && luma >= 140 ? 0.5 : 0;
    d[i] = HOUR_LIT[0]; d[i + 1] = HOUR_LIT[1]; d[i + 2] = HOUR_LIT[2]; d[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  hourLitCv.set(spr, c);
  return c;
}
// over a building's sprite just laid at (x, y)
function drawHourLit(spr, x, y, round) {
  const a = crownHour();
  if (a < 0.03) return;
  ctx.globalAlpha = a * HOUR_SHARE;
  ctx.drawImage(hourLitOf(spr, round), x, y);
  ctx.globalAlpha = 1;
}
