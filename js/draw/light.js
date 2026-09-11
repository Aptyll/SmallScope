'use strict';
// Light and weather over the finished world frame: specks, cloud shadows,
// god rays, the reflected sky, and the pass that grades day into night.
// Nothing on the map emits light; this file is where a glow is added.
// ------------------------------------------------------------ light & weather
// Daylight, night, and the two things that make a flat white field read as a
// place with weather over it: SUN SHAFTS and the shadows of drifting CLOUD.
// Both are world-anchored and world-sized, so zooming in walks you under a
// cloud and between two shafts rather than magnifying the sky.
//
// There is no darkness-and-lamps model any more. Nothing on the map emits
// light, nothing punches a hole in a dark overlay, and the player carries no
// personal glow: NIGHT IS A COLOUR. A blue multiply cools and darkens the
// whole frame, the field stays readable at midnight, and the one thing that
// still glows - a shot with a `lit` bit in it - reads as warm against the
// blue instead of being the only thing on screen.
//
// Everything here runs on the SIM clock (state.windT), not on wall time, so
// DBG.step reproduces a gust, a shaft and a twinkle exactly.

// ---- specks ----
// The sun's dust motes and the ice's reflected stars are hundreds of 1-2 px
// dots a frame. Neither changes anything the sim can see, so they are free to
// be drawn however is cheapest - and the cheapest is the lesson the pines
// taught: what costs is STATE CHANGES, not pixels. A fillRect per speck with
// its own fillStyle and globalAlpha is a draw call per speck.
//
// Collecting them into a Path2D per bucket was tried and is worse, not better:
// building and tessellating a path of 1 px rects every frame cost 1.0 ms for
// 240 motes on a GTX 1060, against 0.05 ms through this. So instead every
// speck is BAKED - one texture, one cell per (kind, brightness level), so the
// whole field draws from a single source with globalAlpha pinned at 1 and
// nothing to change between calls, and the driver batches the lot.
const SPECK_CELL = 8;   // px per cell: room for a 2 px core and a +/-3 px catch
const SPECK_LV = 10;    // brightness levels baked per kind

// paint(g, kind, alpha) draws one cell centred on (SPECK_CELL/2, SPECK_CELL/2)
function bakeSpecks(kinds, paint) {
  const c = document.createElement('canvas');
  c.width = SPECK_CELL * SPECK_LV; c.height = SPECK_CELL * kinds;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let k = 0; k < kinds; k++) {
    for (let l = 0; l < SPECK_LV; l++) {
      g.save();
      g.translate(l * SPECK_CELL, k * SPECK_CELL);
      paint(g, k, (l + 1) / SPECK_LV);
      g.restore();
    }
  }
  return c;
}

// one speck, at the level nearest its alpha. Caller keeps globalAlpha at 1.
function drawSpeck(atlas, kind, a, x, y) {
  if (a <= 0.04) return;
  const l = Math.min(SPECK_LV - 1, Math.max(0, Math.round(a * SPECK_LV) - 1));
  ctx.drawImage(atlas, l * SPECK_CELL, kind * SPECK_CELL, SPECK_CELL, SPECK_CELL,
    x - (SPECK_CELL >> 1), y - (SPECK_CELL >> 1), SPECK_CELL, SPECK_CELL);
}

// Snow, baked the same way. A flake is a square of 1..SPECK_CELL px - the
// zoom decides which (renderWeather) - so the kind IS the size, and the whole
// field draws from one texture with nothing to change between flakes. At the
// widest rung that is 240 of them a frame, which as fillRects with their own
// globalAlpha would be 240 draw calls.
const FLAKE_CV = bakeSpecks(SPECK_CELL, (g, kind, a) => {
  const s = kind + 1, o = (SPECK_CELL - s) >> 1;
  g.globalAlpha = a;
  g.fillStyle = '#ffffff';
  g.fillRect(o, o, s, s);
});

// ---- cloud shadows ----
// Two tileable noise fields baked once at their FINAL world size, drawn 1:1
// through repeat patterns: no scaling, so no smoothing question and no seam,
// and their two periods never come round together, so the pattern that
// crosses the field never visibly repeats.
const CLOUD_A = 768, CLOUD_B = 448;       // world px: the two layers' periods
const CLOUD_A_VX = 11, CLOUD_A_VY = 4.5;  // world px/s of drift, layer A
const CLOUD_B_VX = 17, CLOUD_B_VY = 7.5;  // ... and layer B, faster and smaller
const CLOUD_DEEP = 1;                     // ceiling on a layer's baked alpha
const CLOUD_A_STR = 0.60, CLOUD_B_STR = 0.30; // and how much of each layer reaches the ground
// Contrast, not dimming. CLOUD_CURVE bends the thin half of the ramp thinner
// before CLOUD_GAIN pushes the whole thing, so open snow stays open and the
// deep part of a cloud is what actually darkens: the light-to-dark swing over
// the ground roughly doubles while the field's average brightness barely moves.
const CLOUD_CURVE = 1.35, CLOUD_GAIN = 1.9;
const CLOUD_TINT = [126, 143, 186];       // a cool shadow, never a grey one

// Value noise on a WRAPPED lattice: hashing (x mod per) is the whole trick -
// it makes the field seamless at the texture edge, which is what lets one
// small canvas tile the entire 3712px world through a repeat pattern.
function pnoise(x, y, perX, perY) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const xa = ((x0 % perX) + perX) % perX, ya = ((y0 % perY) + perY) % perY;
  const xb = (xa + 1) % perX, yb = (ya + 1) % perY;
  const a = hash2(xa, ya), b = hash2(xb, ya), c = hash2(xa, yb), d = hash2(xb, yb);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// One cloud layer: four octaves on a lattice that wraps on both axes (so the
// sum tiles). Fewer features across than down STRETCHES the shade along the
// drift, which is what keeps it from reading as circles.
//
// **The mapping is the whole look.** A threshold with a narrow ramp gives a
// plateau of full shade inside a visible rim, and a screen of those reads as
// clip-art blobs sliding over the snow. So there is no threshold: `lo`..`hi`
// spans nearly three standard deviations of the field, so almost every pixel
// lands somewhere on the ramp and hardly any reaches either end - what crosses
// the ground is one continuous swell of dimming with no edge anywhere in it.
// CLOUD_CURVE / CLOUD_GAIN then set the CONTRAST of that swell without giving
// it an edge: the curve bends the thin half down so the bright half stays
// bright, and the gain pushes what is left, so the deep part of a cloud is the
// only part that really darkens.
function bakeCloud(size, octX, octY, lo, hi) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const oc = (x, y, m) => pnoise(x / (size / (octX * m)), y / (size / (octY * m)), octX * m, octY * m);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = oc(x, y, 1) * 0.50 + oc(x, y, 2) * 0.27 + oc(x, y, 4) * 0.15 + oc(x, y, 8) * 0.08;
      const r = Math.max(0, Math.min(1, (n - lo) / (hi - lo)));
      const a = Math.min(1, Math.pow(r, CLOUD_CURVE) * CLOUD_GAIN);
      const i = (y * size + x) * 4;
      d[i] = CLOUD_TINT[0]; d[i + 1] = CLOUD_TINT[1]; d[i + 2] = CLOUD_TINT[2];
      d[i + 3] = Math.round(a * (255 * CLOUD_DEEP));
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
// the field sits around 0.45 with a spread of ~0.11, so 0.16..0.78 is roughly
// mean +/- 3 sigma: everything is on the ramp, nothing is on a plateau
const cloudCvA = bakeCloud(CLOUD_A, 4, 7, 0.47, 0.86);
const cloudCvB = bakeCloud(CLOUD_B, 5, 8, 0.50, 0.88);
// the patterns are made against the WORLD buffer's context, which is the only
// one they are ever filled through
let cloudPatA = null, cloudPatB = null;

// One layer, tiled across the view and anchored in world space: a world point
// samples the same texel whatever the camera is doing, and the drift is what
// moves the cloud over the ground.
function cloudLayer(pat, per, vx, vy, ox, oy, alpha) {
  if (alpha <= 0.004) return;
  const t = state.windT;
  const sx = (((ox + t * vx) % per) + per) % per;
  const sy = (((oy + t * vy) % per) + per) % per;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.translate(-sx, -sy);
  ctx.fillStyle = pat;
  ctx.fillRect(sx, sy, WV_W, WV_H);
  ctx.restore();
}

function cloudShade(ox, oy, day) {
  if (!cloudPatA) {
    cloudPatA = ctx.createPattern(cloudCvA, 'repeat');
    cloudPatB = ctx.createPattern(cloudCvB, 'repeat');
  }
  cloudLayer(cloudPatA, CLOUD_A, CLOUD_A_VX, CLOUD_A_VY, ox, oy, day * CLOUD_A_STR);
  cloudLayer(cloudPatB, CLOUD_B, CLOUD_B_VX, CLOUD_B_VY, ox, oy, day * CLOUD_B_STR);
}

// ---- god rays ----
// PARALLEL shafts of low sun: the light source is the sun, which is far enough
// away that its rays arrive on one heading, so nothing here converges. What
// makes them read as beams rather than as striping laid over the picture is
// the LENGTH fade - each shaft swells out of nothing, peaks about a third of
// the way along and trails off before it leaves the view, so it arrives from
// somewhere and dies in the air instead of running edge to edge. They are
// slim, and deliberately faint: on snow already sitting at 0.95 a shaft that
// states itself is a shaft that has blown the ground out.
//
// The set is anchored to the VIEW, not to the world, and every dimension is a
// fraction of WV_W/WV_H. Two reasons: crepuscular rays are air, not ground, so
// nothing about them should slide when you pan; and it means the shafts are
// composed the same at every zoom, which is what an earlier world-anchored
// version needed a whole subdivision ladder to fake. It is not static - the
// heading drifts on a long sine, the set slides gently across its own normal,
// and each shaft wanders and breathes on its own phase.
const RAY_N = 8;            // shafts across the view
const RAY_ANG = 0.72;       // rad: the heading they all run on, down-right
const RAY_SWING = 0.055;    // rad: how far that heading drifts, on a slow sine
const RAY_WOBBLE = 0.012;   // rad: how far a single shaft wanders off it
const RAY_W = 0.030;        // a shaft's half-width at its far end, as a fraction of WV_H
const RAY_SLIDE = 0.55;     // how far the set slides sideways, in gaps
const RAY_A = 0.092;        // peak alpha of a shaft's core
const RAY_MOTES = 30;       // dust motes riding each shaft
const RAY_MOTE_SPD = 0.05;  // fraction of the shaft's length a mote drifts per second
const RAY_MOTE_LIT = 26;    // how much brighter a mote is than the shaft carrying it
const RAY_AFTER = 4;        // s of shafts still owed once the drop's boots land
const RAY_NOON = DAY_LEN * 0.5; // the middle of the daylight half of the cycle
const RAY_NOON_HALF = 7.5;  // s either side of it the shafts are up: a ~15 s window
const RAY_WINDOW_FADE = 2;  // s of ease at every edge of both windows

// Dust, baked: a warm grain, and the bigger one with a white core and a
// four-armed catch. Ten brightness levels each - a twinkle stepping in tenths
// is invisible on a 2 px speck, and it is what lets the whole field draw with
// no state change between motes.
const MOTE_CV = bakeSpecks(2, (g, kind, a) => {
  const c = SPECK_CELL >> 1;
  g.globalAlpha = a;
  g.fillStyle = '#ffd177';
  if (!kind) { g.fillRect(c, c, 1, 1); return; }
  g.fillRect(c, c, 2, 2);
  g.fillStyle = '#fff6d8'; g.fillRect(c, c, 1, 1);
  g.globalAlpha = a * 0.45;
  g.fillStyle = '#ffdf9b';
  g.fillRect(c - 2, c, 1, 1); g.fillRect(c + 3, c, 1, 1);
  g.fillRect(c, c - 2, 1, 1); g.fillRect(c, c + 3, 1, 1);
});

// One shaft, baked once: length across, width down, alpha carrying BOTH fades -
// a soft cross-section, and the swell-and-trail along the length. Baking it is
// what makes the length fade smooth; drawn as gradient strips it bands, and
// two gradients cannot multiply in one fill. Drawn scaled and rotated per
// shaft, so eight drawImages carry the whole pass.
const RAY_CV = (() => {
  const W = 256, H = 64, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  for (let x = 0; x < W; x++) {
    const u = x / (W - 1);
    // swell in fast, hold, then trail off over most of the length
    const lead = Math.min(1, u / 0.22);
    const tail = 1 - Math.max(0, (u - 0.34) / 0.66);
    const along = lead * lead * (3 - 2 * lead) * tail * tail;
    // a parallel shaft barely spreads - just enough taper that the near end is
    // not a blunt stripe. The widening lives in the texture as a half-height.
    const half = (H / 2) * (0.62 + 0.38 * u);
    for (let y = 0; y < H; y++) {
      const v = Math.abs(y - (H - 1) / 2) / half;
      const across = v >= 1 ? 0 : Math.pow(1 - v * v, 1.9); // soft-shouldered, no hard rim
      const i = (y * W + x) * 4;
      d[i] = 255; d[i + 1] = 240; d[i + 2] = 202;          // warm, never white
      d[i + 3] = Math.round(Math.max(0, Math.min(1, along * across)) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
})();

// The shafts are not weather, they are a MOMENT. Low sun is the light of an
// arrival and of the top of the day, and a beam that is always there stops
// being a beam - so they are up for exactly two windows and dark the rest of
// the time: the whole eagle ride and RAY_AFTER seconds past the landing, and a
// ~15 s window around noon. Both ease in and out over RAY_WINDOW_FADE, and the
// practice arena's clock never moves, so its training light never gets them.
function rayLight() {
  const drop = state.mode === 'drop' || inAir(player)
    ? 1 : Math.min(1, state.rayT / RAY_WINDOW_FADE);
  const noon = (RAY_NOON_HALF - Math.abs(state.time - RAY_NOON)) / RAY_WINDOW_FADE;
  return Math.max(0, Math.min(1, Math.max(drop, noon)));
}

function godRays(ox, oy, day) {
  // rayLight() first: outside its two windows this pass - the eight blits and
  // the two hundred motes behind them - never runs at all
  const s = day * day * rayLight();
  if (s <= 0.02) return;
  const t = state.windT;
  const ang = RAY_ANG + Math.sin(t * 0.09) * RAY_SWING;
  const cs = Math.cos(ang), sn = Math.sin(ang);
  // The view's four corners in the ROTATED frame - local x runs along a shaft,
  // local y across them - so the set is laid out over exactly what is on
  // screen: no shaft is placed where it could never be seen.
  const xs = [0, WV_W * cs, WV_H * sn, WV_W * cs + WV_H * sn];
  const ys = [0, -WV_W * sn, WV_H * cs, -WV_W * sn + WV_H * cs];
  const aMin = Math.min.apply(null, xs), aMax = Math.max.apply(null, xs);
  const nMin = Math.min.apply(null, ys), nMax = Math.max.apply(null, ys);
  const span = aMax - aMin, gap = (nMax - nMin) / RAY_N;
  // the whole set breathes sideways on a slow sine rather than drifting and
  // wrapping: a wrap would pop a shaft into existence mid-screen
  const slide = Math.sin(t * 0.07) * gap * RAY_SLIDE;
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true; // the shaft is a soft gradient, not pixel art
  const beams = [];
  for (let i = 0; i < RAY_N; i++) {
    // spread across the view, jittered off the even spacing so the set never
    // reads as a comb, each shaft wandering a little on its own heading
    const across = nMin + (i + 0.5) * gap + (hash2(i, 23) - 0.5) * gap * 0.8 + slide;
    const beamAng = ang + Math.sin(t * (0.19 + hash2(i, 5) * 0.14) + i * 2.1) * RAY_WOBBLE;
    // two rates of shimmer: a slow swell, and a faster flicker over it
    const a = RAY_A * s
      * (0.30 + 0.70 * (0.5 + 0.5 * Math.sin(t * 0.47 + i * 2.3)))
      * (0.74 + 0.26 * Math.sin(t * 1.7 + i * 1.1));
    // staggered along their own length, so they do not all begin and end together
    const start = aMin - span * 0.1 + hash2(i, 41) * span * 0.30;
    const len = span * (0.62 + hash2(i, 67) * 0.42);
    const halfEnd = WV_H * RAY_W * (0.7 + hash2(i, 89) * 0.6);
    // back out of the rotated frame: where this shaft begins, in view pixels
    const x0 = cs * start - sn * across, y0 = sn * start + cs * across;
    beams.push({ i, ang: beamAng, a, x0, y0, len, halfEnd });
    if (a <= 0.004) continue;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(x0, y0);
    ctx.rotate(beamAng);
    ctx.globalAlpha = a;
    // the texture already holds the taper, so this is one plain scaled blit
    ctx.drawImage(RAY_CV, 0, -halfEnd, len, halfEnd * 2);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = prevSmooth;

  // Dust in the light. The motes live in SHAFT coordinates - u along, v across -
  // so they can only ever exist where a shaft does, and they drift DOWN the
  // shaft rather than falling with the snow. The hash keys off the shaft's
  // index, not its angle: the angle wobbles every frame, and a mote whose seed
  // moves teleports instead of drifting.
  //
  // Drawn source-over in warm GOLD, not additively in white. Snow already sits
  // at 0.95, so there is no headroom to brighten it with - a lighter-mode mote
  // over a sunlit drift is invisible - but a warm speck reads on white the way
  // a cold one never could, and the biggest ones get a white core and a
  // four-armed catch so the field is not one repeated dot. They carry most of
  // what the eye reads as "a beam", which is why the shafts can stay this faint.
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1; // the last shaft's blit left its own alpha behind
  for (const b of beams) {
    if (b.a <= 0.006) continue;
    const bc = Math.cos(b.ang), bs = Math.sin(b.ang);
    for (let j = 0; j < RAY_MOTES; j++) {
      const h = hash2(j * 13 + 3, b.i * 977 + 5);
      const h2 = hash2(j * 31 + 7, b.i * 131 + 19);
      const u = (h + t * RAY_MOTE_SPD * (0.5 + h)) % 1;
      const v = Math.sin(t * (0.6 + h2 * 1.3) + h2 * 31) * (0.2 + 0.62 * h2);
      // the same swell-and-trail the shaft has, so a mote fades with its light
      const lead = Math.min(1, u / 0.22);
      const along = lead * lead * (3 - 2 * lead) * Math.pow(Math.max(0, 1 - (u - 0.34) / 0.66), 2);
      const twk = 0.30 + 0.70 * (0.5 + 0.5 * Math.sin(t * (2.1 + h * 3.4) + h * 51));
      const a = Math.min(1, b.a * RAY_MOTE_LIT) * along * Math.pow(1 - v * v, 1.9) * twk;
      if (a <= 0.02) continue;
      const r = u * b.len;
      const off = v * b.halfEnd * (0.62 + 0.38 * u);
      const px = Math.round(b.x0 + bc * r - bs * off);
      const py = Math.round(b.y0 + bs * r + bc * off);
      if (px < -2 || py < -2 || px > WV_W + 2 || py > WV_H + 2) continue;
      drawSpeck(MOTE_CV, h2 > 0.88 ? 1 : 0, a, px, py);
    }
  }
  ctx.restore();
}

// ---- the reflected sky ----
// Night's one bright thing, and the only place the stars are visible in a game
// with no sky in frame: they are IN THE ICE. Two halves, and the first is what
// makes the second work at all.
//
// **The mirror.** Sheet ice is painted at 0.72-0.93 brightness, which is most
// of the way to white - so a white dot on it has almost no contrast, and a
// multiply grades star and ice down together and keeps it that way. There is
// no headroom to fix it with. So the ice itself goes DARK first: intact tiles
// take a deep-blue wash that scales with the darkness curve, which is what a
// frozen lake at night actually looks like from above - a black mirror, darker
// than the snow around it - and it is what gives the stars something to be
// bright against. Filled in horizontal RUNS of adjacent ice, one rect per run
// instead of one per tile.
//
// **The sky.** The stars do not sit on the ice, they sit in a sky reflected in
// it, so they are anchored neither to the world nor to the screen: the field is
// sampled at STAR_PAR of the camera's offset, so it slides against the ground
// as you walk - a long way off, moving slowly, which is the whole read of a
// reflection. The loop therefore runs over SKY CELLS and asks what tile each
// one landed on, not over tiles; a star only draws where it fell on unbroken
// ice, so the field is cut to the shape of the lake and an ice hole is a gap in
// it. Each twinkles on its own rate, and the whole reflection ripples a pixel
// sideways on a slow wave, because ice is not a perfect mirror.
//
// Drawn early - above the fish and the cracks, under everything that walks, so
// a body standing on the ice covers its own reflection - and therefore under
// the night colour too, which cools the stars along with the snow.
const STAR_MIRROR = 0.46;  // how far the darkness sinks intact ice toward black
const STAR_CELL = 13;      // px between sky cells
const STAR_DENS = 0.55;    // share of cells holding a star
const STAR_PAR = 0.22;     // how much of the camera's motion the sky takes: the parallax
const STAR_BRIGHT = 0.90;  // above this a star is big enough to throw a cross
const STAR_RIPPLE = 1.4;   // px the reflection wanders sideways in the ice

// The reflected stars, baked the same way: three tints (a warm one, a cold
// one, and plain white) each as a plain point and as a bright one throwing a
// cross with a soft halo. Six kinds, ten levels - one texture for the whole
// field, which at night is five hundred specks a frame.
const STAR_TINT = ['#ffe9c6', '#cfe0ff', '#f2f7ff'];
const STAR_CV = bakeSpecks(6, (g, kind, a) => {
  const c = SPECK_CELL >> 1, col = STAR_TINT[kind % 3];
  g.fillStyle = col;
  g.globalAlpha = a;
  g.fillRect(c, c, 1, 1);
  if (kind < 3) return;
  g.fillRect(c, c - 1, 1, 1); g.fillRect(c, c + 1, 1, 1);
  g.fillRect(c - 1, c, 1, 1); g.fillRect(c + 1, c, 1, 1);
  g.globalAlpha = a * 0.4;
  g.fillRect(c, c - 2, 1, 1); g.fillRect(c, c + 2, 1, 1);
  g.fillRect(c - 2, c, 1, 1); g.fillRect(c + 2, c, 1, 1);
});

// is this screen pixel over unbroken ice? the mask every reflected pixel
// passes, arms of a cross included - without it a bright star's points spill
// off the lake onto the snow beside it
function overIce(px, py, ox, oy) {
  const tx = ((px + ox) / TILE) | 0, ty = ((py + oy) / TILE) | 0;
  return inWorld(tx, ty) && ground[idx(tx, ty)] === 1;
}

function drawIceStars(ox, oy, tx0, ty0, tx1, ty1) {
  const night = state.darkness;
  if (night <= 0.03) return;
  const t = state.windT;

  // the mirror: every run of unbroken ice on screen, darkened as one rect
  ctx.fillStyle = 'rgba(7,13,40,' + (night * STAR_MIRROR).toFixed(3) + ')';
  for (let ty = ty0; ty <= ty1; ty++) {
    let run = -1;
    for (let tx = tx0; tx <= tx1 + 1; tx++) {
      const ice = tx <= tx1 && ground[idx(tx, ty)] === 1;
      if (ice && run < 0) run = tx;
      else if (!ice && run >= 0) {
        ctx.fillRect(run * TILE - ox, ty * TILE - oy, (tx - run) * TILE, TILE);
        run = -1;
      }
    }
  }

  // the sky over it. The camera only moves the field by STAR_PAR of what it
  // moves the ground, which is the parallax; everything else is per-star.
  const skx = ox * STAR_PAR, sky = oy * STAR_PAR;
  const c0 = Math.floor(skx / STAR_CELL) - 1, c1 = Math.ceil((skx + WV_W) / STAR_CELL) + 1;
  const d0 = Math.floor(sky / STAR_CELL) - 1, d1 = Math.ceil((sky + WV_H) / STAR_CELL) + 1;
  for (let cy = d0; cy <= d1; cy++) {
    // the ice's own shimmer: one slow wave down the field, so the whole
    // reflection breathes sideways rather than every star wobbling alone
    const rip = Math.round(Math.sin(cy * 0.21 + t * 0.9) * STAR_RIPPLE);
    for (let cx = c0; cx <= c1; cx++) {
      const h = hash2(cx * 3 + 11, cy * 5 + 7);
      if (h > STAR_DENS) continue;
      const q = h / STAR_DENS; // 0..1 across the stars, so every dial gets a spread
      const px = Math.round(cx * STAR_CELL - skx + q * (STAR_CELL - 2)) + rip;
      const py = Math.round(cy * STAR_CELL - sky + hash2(cx + 61, cy + 29) * (STAR_CELL - 2));
      if (px < 0 || py < 0 || px >= WV_W || py >= WV_H) continue;
      // what is under it: only unbroken ice reflects, open water does not
      if (!overIce(px, py, ox, oy)) continue;
      const twk = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(t * (0.9 + q * 2.8) + q * 61));
      const a = night * (0.40 + q * 0.60) * twk;
      if (a <= 0.03) continue;
      const tint = q < 0.18 ? 0 : q < 0.34 ? 1 : 2;
      // a bright star's cross reaches 2 px, so it only earns one well inside
      // the sheet - which also keeps every lit pixel over unbroken ice
      const big = q > STAR_BRIGHT && overIce(px - 2, py, ox, oy) && overIce(px + 2, py, ox, oy)
        && overIce(px, py - 2, ox, oy) && overIce(px, py + 2, ox, oy);
      drawSpeck(STAR_CV, big ? tint + 3 : tint, a, px, py);
    }
  }
}

// ---- the pass ----
// Day: shafts first, then the cloud that shades them - a shadow falls across
// a sunbeam, not the other way round. Then the hour's tint, then the night.
const NIGHT_TINT = '#45599c';  // multiply: what full dark does to the snow
const NIGHT_DEEP = '#0b1338';  // and a little of this on top, for depth

function renderLighting(ox, oy, now) {
  const dark = state.darkness;
  const day = 1 - dark;

  if (day > 0.02) {
    // both halves of the day's dressing answer to the ESC panel's VIDEO page
    if (settings.vidRays) godRays(ox, oy, day);
    // The training grounds keep the one fixed hour the rest of that room
    // keeps (sim.js never advances its clock): the shafts stay, because they
    // are a quality of the light, but a cloud shadow drifting over the
    // dummy's meter or the parkour's ice would change what the instruments
    // are measuring between one lap and the next.
    if (!PRACTICE && settings.vidClouds) cloudShade(ox, oy, day);
  }

  // dusk warm tint
  const duskT = state.time > DAY_LEN - 12 && state.time < DAY_LEN + 6 ?
    1 - Math.abs(state.time - (DAY_LEN - 4)) / 9 : 0;
  if (duskT > 0) {
    ctx.globalAlpha = Math.max(0, duskT) * 0.16;
    ctx.fillStyle = '#ff9a5c';
    ctx.fillRect(0, 0, WV_W, WV_H);
    ctx.globalAlpha = 1;
  }
  // dawn pink
  const dawnT = state.time > CYCLE - 10 ? (state.time - (CYCLE - 10)) / 10 :
    state.time < 8 ? 1 - state.time / 8 : 0;
  if (dawnT > 0 && dark < 0.8) {
    ctx.globalAlpha = dawnT * 0.1;
    ctx.fillStyle = '#ff88aa';
    ctx.fillRect(0, 0, WV_W, WV_H);
    ctx.globalAlpha = 1;
  }

  // Night. A multiply carries the whole shift: it cools and darkens what is
  // there instead of laying an opaque slab over it, so snow stays snow, team
  // colours stay legible and the ice keeps its stars. globalAlpha rides the
  // darkness curve, so dusk eases into it with nothing to schedule.
  if (dark > 0.005) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = dark;
    ctx.fillStyle = NIGHT_TINT;
    ctx.fillRect(0, 0, WV_W, WV_H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = dark * 0.17;
    ctx.fillStyle = NIGHT_DEEP;
    ctx.fillRect(0, 0, WV_W, WV_H);
    ctx.globalAlpha = 1;
  }

  litShots(ox, oy, now, dark);
}

// A shot can still carry its own light: the CARE ARROW and the WISP do, and
// anything a FLAME modifier is riding (`lit` in the BITS table, js/tools.js).
// They are read straight off the live shots rather than registered anywhere,
// and they are the only light left in the game - additive, so they warm the
// night blue rather than cutting a clean hole in it.
function litShots(ox, oy, now, dark) {
  let any = false;
  for (const a of arrows) if (a.lit) { any = true; break; }
  if (!any) return;
  const s = 0.20 + dark * 0.55; // barely there at noon, a real lantern at night
  ctx.globalCompositeOperation = 'lighter';
  for (const a of arrows) {
    if (!a.lit) continue;
    const r = a.lit * (1 + Math.sin(now * 11 + a.x) * 0.06);
    const lx = a.x - ox, ly = a.y - oy;
    if (lx < -r || ly < -r || lx > WV_W + r || ly > WV_H + r) continue;
    const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, r);
    g.addColorStop(0, 'rgba(255,214,150,' + (s * 0.5).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(255,192,116,' + (s * 0.2).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,176,86,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

// World-space flakes wrapped into the view (see the flakes block in fx
// updates); a landed flake fades out where it came to rest. This runs on the
// SCREEN, above the world blit, so a flake stays its own crisp size however
// far in the camera is - the drift multiplies by the zoom so the field still
// scrolls with the ground under it.
function renderWeather(ex, ey) {
  if (!settings.vidSnow) return; // the VIDEO page can still the air
  // the wrap is in WORLD px around the exact camera and the scale-up comes
  // after it, so the field is one world view wide however far the camera is
  // in - WV * zoomCur always covers the canvas, since sizeWorldView ceils
  const z = zoomCur;
  for (const f of flakes) {
    const sx = ((((f.x - ex) % WV_W) + WV_W) % WV_W) * z;
    const sy = ((((f.y - ey) % WV_H) + WV_H) % WV_H) * z;
    const s = Math.max(1, Math.min(SPECK_CELL, Math.round(f.size * z)));
    drawSpeck(FLAKE_CV, s - 1, f.rest > 0 ? f.a * (f.rest / FLAKE_REST) : f.a,
      Math.round(sx), Math.round(sy));
  }
}

let vigGrd = null, vigKey = 0; // the frame vignette, rebuilt only on resize
function renderVignettes() {
  // hurt flash
  if (player.hurtT > 0) {
    ctx.globalAlpha = player.hurtT * 0.9;
    ctx.fillStyle = 'rgba(200,40,50,0.35)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
  // soft frame vignette (a VIDEO toggle - the hurt flash above is feedback
  // and never goes); the gradient is rebuilt only when the view resizes
  if (!settings.vidVig) return;
  if (vigKey !== VIEW_W * 4096 + VIEW_H) {
    vigKey = VIEW_W * 4096 + VIEW_H;
    vigGrd = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.5, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    vigGrd.addColorStop(0, 'rgba(10,14,35,0)');
    vigGrd.addColorStop(1, 'rgba(10,14,35,0.35)');
  }
  ctx.fillStyle = vigGrd;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
