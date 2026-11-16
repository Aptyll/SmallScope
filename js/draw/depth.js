'use strict';
// How deep snow looks: the DEEP band's raised drift baked into the ground,
// and the frosted reeds standing in it that make it read as brush. The map
// itself is js/sim/depth.js; who it hides, js/sim/fog.js.
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
// the depth at world pixel (x, y)'s centre. deepTone reads each pixel's
// neighbours up to DEEP_SHADE_PX up-left and two down-right, so a tile alone
// asked for each depth about six times: snowTile opens a window over its own
// tile (deepTileOpen) and each depth in it is worked out once
const DEEP_WIN = TILE + DEEP_SHADE_PX + 2;
const deepWin = new Float64Array(DEEP_WIN * DEEP_WIN);
let deepX0 = 0, deepY0 = 0, deepOpen = false;
function deepTileOpen(px, py) { deepX0 = px - DEEP_SHADE_PX; deepY0 = py - DEEP_SHADE_PX; deepWin.fill(NaN); deepOpen = true; }
function deepTileClose() { deepOpen = false; }
function deepPx(x, y) {
  if (deepOpen) {
    const i = x - deepX0, j = y - deepY0;
    if (i >= 0 && j >= 0 && i < DEEP_WIN && j < DEEP_WIN) {
      const k = j * DEEP_WIN + i;
      let d = deepWin[k];
      if (d !== d) d = deepWin[k] = deepRagAt(x, y);
      return d;
    }
  }
  return deepRagAt(x, y);
}
// ...ragged by a small noise (DEEP_RAG, in depth), so a drift's edge wanders
// a few pixels off the sim's smooth outline instead of ruling an oval on the
// snow. Only the paint moves: who is hidden reads the sim's own depth.
const DEEP_RAG = 0.22, DEEP_RAG_PX = 7;
function deepRag(x, y) { return (vnoise(x / DEEP_RAG_PX + 5.5, y / DEEP_RAG_PX + 13.5) - 0.5) * DEEP_RAG; }
function deepRagAt(x, y) { return driftsDepth((x + 0.5) / TILE, (y + 0.5) / TILE) + deepRag(x, y); }
const deepIn = (x, y) => deepPx(x, y) >= DEPTH_DEEP;
// the tone for world pixel (x, y) given the plain snow's tone t, on a tile
// whose driftCell is not empty
function deepTone(x, y, t) {
  const d = deepPx(x, y);
  if (d < DEPTH_DEEP) {
    // off the drift: the fine line round its sunlit side, so the edge
    // reads even where white meets white...
    if (deepIn(x + 1, y + 1) || deepIn(x + 1, y) || deepIn(x, y + 1)) return DEEP_T0 + 7;
    // ...else in its shade? A taller drift throws a longer one
    for (let k = 1; k <= DEEP_SHADE_PX; k++) {
      const e = deepPx(x - k, y - k);
      if (e >= DEPTH_DEEP && (e - DEPTH_DEEP) * 2.5 * DEEP_SHADE_PX + 1 >= k) return DEEP_T0 + 6;
    }
    return t;
  }
  if (!deepIn(x - 1, y - 1) || !deepIn(x, y - 1) && !deepIn(x - 1, y)) return DEEP_T0 + 3; // the crest
  if (!deepIn(x + 1, y + 1) || !deepIn(x + 1, y) && !deepIn(x, y + 1)) return DEEP_T0 + 4; // the lip
  if (!deepIn(x + 2, y + 2)) return DEEP_T0 + 5;
  // the top: lit by its slope toward the sun, barely dithered - smoother than the snow round it
  const s = (deepPx(x + 2, y + 2) - deepPx(x - 2, y - 2)) * 9 + BAYER4[(y & 3) * 4 + (x & 3)] * 0.35;
  // wind ripples: faint lines across the drift, on the lee tone
  const u = x * driftWind.dx + y * driftWind.dy, v = -x * driftWind.dy + y * driftWind.dx;
  const r = u / DEEP_RIPPLE + vnoise(v / 11, u / 23) * 1.6;
  if (d > DEPTH_DEEP + 0.08 && r - Math.floor(r) < 0.13) return DEEP_T0;
  return s > 0.5 ? DEEP_T0 + 2 : s < -0.5 ? DEEP_T0 : DEEP_T0 + 1;
}

// ---- the reeds -----------------------------------------------------------------
// Every patch of brush (a deep drift: brushOf, js/sim/depth.js) is a stand of
// dead reeds poking out of the drift, frost on their tips: what says "hide
// here" at a glance. Each reed is a small sprite y-sorted with the bodies
// (gatherDraws, js/draw/passes.js), so a body standing among them is half
// behind the ones in front of it. Round the viewed hero they thin to
// REED_SEE, so your own body in the brush is never lost in it. Placed on a
// staggered REED_STEP grid jittered off the position hash, wherever the snow
// is deep: pure position, so every screen stands the same reeds.
const REED_PAL = { root: '#6b5f47', blade: '#a8955f', lit: '#d6c48c', tip: '#ffffff' };
// a stand is not one straw: whole CLUMPS of it (REED_CLUMP px across, a slow
// noise cut in flat steps) are the straw above, an older umber, or bleached
// pale - a row of the atlas each
const REED_TONES = [REED_PAL, { root: '#574a38', blade: '#86703f', lit: '#ad9558' }, { root: '#7d745c', blade: '#c2b488', lit: '#ebe0b8' }];
const REED_CLUMP = 30, REED_UMBER = 0.4, REED_PALE = 0.62; // px across a clump; the noise under which it is umber, and over which pale
const REED_REST = 13;  // px round where a camp's beast rests that no reed stands: it lies in a form it has pressed, in plain sight
const REED_STEP = 6;   // px between tufts on the grid: under a tuft's width, so the stand is one mass, not a field of tufts
const REED_JIT = 4;    // px either way a tuft wanders off its grid point
const REED_IN = 0.03;  // depth past DEPTH_DEEP a reed's foot needs: none on the rim's own line
const REED_GAP = 0.27; // the noise under which a stand's inside is left as open drift (never on its rim)
const REED_GLADE = 9;  // px across one of those openings
const REED_RIM = 0.14; // depth past DEPTH_DEEP inside which the stand is whole: the rim says where the brush is
const REED_LOW = 0.07; // depth past DEPTH_DEEP inside which a tuft is the short kind: the stand rises from its rim to its middle
const REED_SWALE = 14, REED_DIP = 0.3; // px across a low swale inside the stand, and the noise under which its tufts are short: a thicket has a rhythm, not one flat top
const REED_FADE = 16;  // px from the viewed hero's feet the reeds thin...
const REED_SEE = 0.3;  // ...to this alpha
const REED_FADE_BEAST = 10; // px either way from a shown beast's feet they thin the same
const REED_VARS = 8, REED_W = 15, REED_H = 20; // the atlas: variants, and each cell's size
let reedCv = null;
// the atlas: REED_VARS TUFTS in each straw, a tall row and a short row of
// each. A tuft is 5 to 11 blades rooted along five pixels of drift over a
// soft blue shade, fanning out and curving over at the top. The back blades
// are drawn first, darker and from a dark foot; the front ones over them, lit
// on the sun's (left) side, so the overlap makes a body with a shaded base and
// a bright top edge. A few tips carry a pale plume or frost. Tufts this wide
// on a grid this close overlap, so a stand reads as one thicket.
function reedAtlas() {
  if (reedCv) return reedCv;
  reedCv = document.createElement('canvas'); reedCv.width = REED_W * REED_VARS; reedCv.height = REED_H * REED_TONES.length * 2;
  const g = reedCv.getContext('2d');
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  for (let t = 0; t < REED_TONES.length; t++) for (let h = 0; h < 2; h++) for (let v = 0; v < REED_VARS; v++) {
    const P = REED_TONES[t], low = h === 1;
    const x0 = v * REED_W + (REED_W >> 1), y0 = (t * 2 + h) * REED_H + REED_H - 3;
    const n = low ? 5 + (v % 2) : 8 + (v % 4), tall = low ? 6 + (v & 1) : REED_H - 9 + ((v * 5) % 4);
    const wind = ((v * 3) % 5 - 2) * 0.18; // the tuft's own lean
    // the tuft's body first: a solid wedge of the dark straw, widening up from
    // the foot and ragged at its sides, so no drift shows through the stand
    const body = Math.round(tall * 0.6);
    for (let j = 0; j <= body; j++) {
      const w = Math.min(4, 1.6 + j * 0.45) * (j > body - 2 ? 0.6 : 1), sx = Math.round(wind * j * 0.6);
      const l = Math.round(-w + (hash2(v * 7 + j, t + 3) - 0.5)), r = Math.round(w + (hash2(j + 13, v * 5 + t) - 0.5));
      for (let i = l; i <= r; i++) px(x0 + sx + i, y0 - j, P.root);
    }
    // back blades (odd k), then the front ones over them
    for (const back of [true, false]) for (let k = back ? 1 : 0; k < n; k += 2) {
      const off = k - (n - 1) / 2, edge = Math.abs(off) / ((n - 1) / 2); // 0 the middle blade .. 1 the outermost
      const rnd = hash2(v * 17 + k * 5, t * 11 + h * 29); // this blade's own length and bend
      const len = Math.max(3, Math.round(tall * (1 - edge * 0.5) * (0.8 + rnd * 0.3)));
      const foot = Math.round(off * 4 / Math.max(1, n - 1) * 1.2); // rooted along five px of drift
      const bend = off * 0.35 + wind + (rnd - 0.5) * 0.5;
      let lx = null;
      for (let j = 0; j <= len; j++) {
        const u = j / len, x = x0 + foot + Math.round(bend * u * u * len * 0.6), y = y0 - j;
        const c = j === len && edge < 0.3 && rnd > 0.85 ? REED_PAL.tip
          : back ? (j <= len * 0.5 ? P.root : P.blade)
          : j <= 1 ? P.root : off < 0 && j > len * 0.3 ? P.lit : P.blade;
        px(x, y, c);
        if (lx !== null && Math.abs(x - lx) > 1) px((x + lx) >> 1, y, c); // never a gap in a blade that bends fast
        lx = x;
      }
      // a plume on a few of the tall front blades: two pale pixels across the tip
      if (!back && !low && rnd > 0.72 && edge < 0.7) { const x = x0 + foot + Math.round(bend * len * 0.6); px(x + (bend < 0 ? -1 : 1), y0 - len + 1, P.lit); }
    }
  }
  return reedCv;
}
// a deep drift's reeds, laid on its first draw and kept on it
function reedsOf(D) {
  if (D.reeds) return D.reeds;
  const out = D.reeds = [];
  const r = (D.len + 1) * TILE, X = D.x * TILE, Y = D.y * TILE;
  // where the camps' beasts rest (a drawn camp's spots, or its spec's), in px
  const rest = [];
  for (const C of camps) for (const q of C.spots || C.spec.spots) rest.push([(C.tx + q[0] + 0.5) * TILE, (C.ty + q[1] + 0.5) * TILE]);
  const y0 = Math.floor((Y - r) / REED_STEP), y1 = Math.ceil((Y + r) / REED_STEP);
  const x0 = Math.floor((X - r) / REED_STEP), x1 = Math.ceil((X + r) / REED_STEP);
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const gx = i * REED_STEP + (j & 1 ? REED_STEP / 2 : 0), gy = j * REED_STEP;
    const x = Math.round(gx + (hash2(gx, gy) - 0.5) * REED_JIT), y = Math.round(gy + (hash2(gy + 9, gx + 3) - 0.5) * REED_JIT);
    const dd = driftDepth(D, x / TILE, y / TILE);
    if (dd < DEPTH_DEEP + REED_IN) continue;
    // inside the rim the stand opens in a few small glades, REED_GLADE px across: a noise
    // finer than the patch, so the middle is clumps and openings, never one bare floor in a wreath
    if (dd > DEPTH_DEEP + REED_RIM && vnoise(x / REED_GLADE + 5.5, y / (REED_GLADE * 0.8) + 2.5) < REED_GAP) continue;
    if (rest.some((q) => Math.hypot(x - q[0], (y - q[1]) * 1.4) < REED_REST)) continue;
    const tone = vnoise(x / REED_CLUMP + 31.5, y / REED_CLUMP + 12.5);
    const t = tone < REED_UMBER ? 1 : tone > REED_PALE ? 2 : 0;
    out.push({ x, y, v: (hash2(x * 3, y * 7) * REED_VARS) | 0, row: t * 2 + (dd < DEPTH_DEEP + REED_LOW || vnoise(x / REED_SWALE + 8.5, y / REED_SWALE + 1.5) < REED_DIP ? 1 : 0) });
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}
// the reeds over the view, into the frame's y-sorted draws (gatherDraws)
function reedDraws(draws, ox, oy) {
  reedBeasts = draws.filter((d) => d.a).map((d) => d.a); // the beasts this frame shows: the reeds thin round each (drawReed)
  for (const D of drifts) {
    const r = (D.len + 1) * TILE, X = D.x * TILE, Y = D.y * TILE;
    if (X + r < ox || Y + r < oy - REED_H || X - r > ox + WV_W || Y - r > oy + WV_H + REED_H) continue;
    for (const q of reedsOf(D)) {
      if (q.x < ox - REED_W || q.x > ox + WV_W + REED_W || q.y < oy || q.y > oy + WV_H + REED_H) continue;
      if (ground[idx(q.x >> 4, q.y >> 4)] !== 0) continue; // paved or holed since: no snow, no reeds
      draws.push({ y: q.y, reed: q });
    }
  }
}
// one reed, thinned round the viewed hero (null while dead or airborne) and,
// closer in, round every beast the frame shows: a rabbit in its own brush is
// a thing to hunt, not to lose
let reedBeasts = [];
function drawReed(q, ex, ey, hero) {
  let near = hero && Math.hypot(q.x - hero.x, q.y - hero.y - 4) < REED_FADE;
  for (let i = 0; !near && i < reedBeasts.length; i++) near = Math.abs(q.x - reedBeasts[i].x) < REED_FADE_BEAST && Math.abs(q.y - reedBeasts[i].y - 4) < REED_FADE_BEAST;
  if (near) ctx.globalAlpha = REED_SEE;
  ctx.drawImage(reedAtlas(), q.v * REED_W, q.row * REED_H, REED_W, REED_H, Math.round(q.x - ex) - (REED_W >> 1), Math.round(q.y - ey) - REED_H + 3, REED_W, REED_H);
  if (near) ctx.globalAlpha = 1;
}
