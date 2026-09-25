'use strict';
// How deep snow looks: the DEEP band's raised drift baked into the ground,
// and a body wading through it. The map itself is js/depth.js.
// ------------------------------------------------------------ deep snow's look
// A deep drift has to read as HIGHER than the snow round it at a glance, in
// the game's own light (the sun is top-left, like every cast shade): a white
// crest where its edge faces the sun, a smooth bright top, a dark lip two
// pixels thick where it faces away, and its own short shade thrown on the
// snow down-right of it, longest at the tall crest. Painted per pixel into
// the ground bake by snowTile (js/draw/ground.js) through deepTone, from the
// same drift depth the sim reads (driftsDepth), so what is drawn deep IS deep to the pixel.
// Loaded before ground.js: SNOW_INK appends DEEP_PAL at load.
const DEEP_PAL = [
  '#e6eef8', // 5  top, the lee slope
  '#f6f9fd', // 6  top
  '#fdfeff', // 7  top, the slope facing the sun
  '#ffffff', // 8  the sunlit crest
  '#a4b8d2', // 9  the lip, facing away
  '#c2d1e4', // 10 ...its upper row
  '#cfdbea', // 11 the drift's shade on the snow
  '#d3dfed', // 12 the thin line round its sunlit edge
];
const DEEP_T0 = 5;           // DEEP_PAL[0]'s index in SNOW_INK
const DEEP_SHADE_PX = 4;     // the longest shade a drift throws, at full height
const DEEP_RIPPLE = 7;       // px between the wind ripples across a drift's top
const deepPx = (x, y) => driftsDepth(x / TILE, y / TILE); // the deep band's depth at a world px
const deepIn = (x, y) => deepPx(x + 0.5, y + 0.5) >= DEPTH_DEEP;
// the tone for world pixel (x, y) given the plain snow's tone t, on a tile
// whose driftCell is not empty
function deepTone(x, y, t) {
  const d = deepPx(x + 0.5, y + 0.5);
  if (d < DEPTH_DEEP) {
    // off the drift: the fine line round its sunlit side, so the edge
    // reads even where white meets white...
    if (deepIn(x + 1, y + 1) || deepIn(x + 1, y) || deepIn(x, y + 1)) return DEEP_T0 + 7;
    // ...else in its shade? A taller drift throws a longer one
    for (let k = 1; k <= DEEP_SHADE_PX; k++) {
      const e = deepPx(x - k + 0.5, y - k + 0.5);
      if (e >= DEPTH_DEEP && (e - DEPTH_DEEP) * 2.5 * DEEP_SHADE_PX + 1 >= k) return DEEP_T0 + 6;
    }
    return t;
  }
  if (!deepIn(x - 1, y - 1) || !deepIn(x, y - 1) && !deepIn(x - 1, y)) return DEEP_T0 + 3; // the crest
  if (!deepIn(x + 1, y + 1) || !deepIn(x + 1, y) && !deepIn(x, y + 1)) return DEEP_T0 + 4; // the lip
  if (!deepIn(x + 2, y + 2)) return DEEP_T0 + 5;
  // the top: lit by its slope toward the sun, barely dithered - smoother than the snow round it
  const s = (deepPx(x + 2.5, y + 2.5) - deepPx(x - 1.5, y - 1.5)) * 9 + BAYER4[(y & 3) * 4 + (x & 3)] * 0.35;
  // wind ripples: faint lines across the drift, on the lee tone
  const u = x * driftWind.dx + y * driftWind.dy, v = -x * driftWind.dy + y * driftWind.dx;
  const r = u / DEEP_RIPPLE + vnoise(v / 11, u / 23) * 1.6;
  if (d > DEPTH_DEEP + 0.08 && r - Math.floor(r) < 0.13) return DEEP_T0;
  return s > 0.5 ? DEEP_T0 + 2 : s < -0.5 ? DEEP_T0 : DEEP_T0 + 1;
}

// ---- a body wading -----------------------------------------------------------
// In deep snow a body sinks to the shins: drawn WADE_SINK rows lower and cut
// off at the snow's surface, with a collar of drift round the cut. The look
// eases on the frame's own clock toward what is under the feet now, so a
// client (whose sim never runs) draws the same thing the host does.
const WADE_SINK = 2;         // rows the body drops at full depth...
const WADE_CUT = 3;          // ...and rows over the feet the surface stands
function wadeLook(e, now) {
  const dt = e.wadeAt === undefined ? 0 : Math.max(0, Math.min(0.1, now - e.wadeAt));
  e.wadeAt = now;
  e.wadeMv = e.wadeDX !== undefined && Math.abs(e.x - e.wadeDX) + Math.abs(e.y - e.wadeDY) > 0.05; // moved since the last frame
  e.wadeDX = e.x; e.wadeDY = e.y;
  const want = deepAt(e.x, e.y + 4) ? 1 : 0;
  e.wadeV = want + ((e.wadeV || 0) - want) * Math.exp(-DEEP_EASE * dt);
  return e.wadeV;
}
// how wide a body's collar is - 0 for one that is not standing in the snow:
// a player lying under it (the cover is its own look), in the water, on the
// cable or in the air, a bird, and the merchant, who never leaves the road
function wadeWidth(e) {
  if (e instanceof Player) return e.prone || e.fallT > 0 || e.zip >= 0 || inAir(e) || e.dead ? 0 : 10;
  if (e.kind === 'bird' || e.merchant) return 0;
  return e.kind === 'rabbit' ? 6 : e.kind === 'deer' ? 12 : MONSTER[e.kind] && MONSTER[e.kind].big ? 20 : 10;
}
// draw a body through fn() as it stands in the snow
function drawWading(e, ex, ey, now, fn) {
  const w = wadeWidth(e), k = w ? wadeLook(e, now) : 0;
  if (k < 0.05) { fn(); return; }
  const fy = Math.round(e.y + 4 - ey), sx = Math.round(e.x - ex);
  const sink = Math.round(WADE_SINK * k), cut = fy - Math.round(WADE_CUT * k);
  ctx.save();
  ctx.beginPath(); ctx.rect(sx - 64, fy - 128, 128, cut - (fy - 128)); ctx.clip();
  ctx.translate(0, sink);
  fn();
  ctx.restore();
  // the collar: a mound of the drift round the shins - a sunlit crest over
  // the body, the hole's own shade where the legs go in, the drift's top
  // either side and its dark lip at the foot. It shivers a pixel while the
  // body is pushing through.
  const hw = Math.round(w / 2 * k) + 1;
  const m = e.wadeMv ? ((now * 8) | 0) & 1 : 0;
  const row = (c, x0, x1, y) => { ctx.fillStyle = DEEP_PAL[c]; ctx.fillRect(sx + x0, y, x1 - x0, 1); };
  row(7, -hw, -hw + 1, cut); row(7, hw - 1 + m, hw + m, cut); // the thin line round its ends
  row(3, -hw + 1, hw - 1 + m, cut);       // the crest
  row(1, -hw, hw + m, cut + 1);           // the top
  row(5, -hw + 2, hw - 2 + m, cut + 1);   // ...and the hole the legs go into
  row(1, -hw, hw + m, cut + 2);
  row(4, -hw + 1, hw - 1 + m, cut + 3);   // the lip
  row(6, -hw + 2, hw - 2 + m, cut + 4);   // ...and its shade
}
