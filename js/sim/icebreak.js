'use strict';
// ------------------------------------------------------------ ice breaks
// Something big coming up through a lake (the orca, js/sim/orca.js) breaks
// the ice in ITS OWN SHAPE, never a tile's. The shape is a FOOTPRINT on the
// ice plane (ICE_BREAK_SHAPES: ellipses and polygons in world px about the
// centre, nose to +x, turned by the break's angle and squashed by `sq` the
// way the 3/4 view lays ground), and every pixel of the break is worked out
// from that footprint, the break's spot and its seed by hash2: no rng(), so
// a client or a save rebuilds the same break from the few numbers a break
// is (`iceBreaks` holds them; the pixels are cached off them in breakCache).
//
// A break's life, by its age off state.tick (iceBreakAge):
//   0 .. warn      the cracks trace its outline (the pixels: js/draw/icebreak.js)
//   warn           it OPENS: the footprint, one px proud and chipped, is open
//                  water; its plates fly out and land round it
//   + hold         the hole stays wide open
//   + ICE_BREAK_FREEZE   it freezes back over from its rim inward, each
//                  pixel at its own time (ft: 0 at the rim, 1 in the middle)
//   + ICE_BREAK_SKIM     the new ice thickens from dark to the sheet's tone
//
// Only tiles that were bare ice when the break was born (`cov`) can break.
// For everything that reads tiles, a tile is OPEN WATER (ground 2, waterAt:
// no walker, route or spawn on it) while at least half its pixels are open,
// and freezes back (ground 1) at its own `open` time. A PLAYER's feet read
// the pixels instead (iceBreakWet, in the plunge and the climb out), so you
// go in exactly where the water shows and walk on the new ice beside it. A
// tile a break holds open is painted as ice under the break's pixels
// (paintGroundTile asks iceBreakHolds), never as a square hole.
//
// iceBreak(x, y, shape, ang, { warn, hold }) breaks the ice (null where
// there is no bare ice under the footprint); the orca (orcaStrike, js/sim/orca.js)
// is what calls it in a match. iceBreakCovers(b, x, y) is the same footprint
// as a hit test.
const ICE_BREAK_FREEZE = 20;  // s the hole takes to freeze back over, rim to middle
const ICE_BREAK_SKIM = 6;     // s a pixel of new ice takes to thicken to the sheet's tone
const ICE_BREAK_HOLD = 2.5;   // s the hole stays wide open before it freezes (the default `hold`)
const ICE_BREAK_BURST = 0.7;  // s the plates fly before they land
const ICE_BREAK_PAD = 26;     // px of box round the footprint: the crack band and the radial cracks
const ICE_BREAK_PROUD = 0.8;  // px the hole stands proud of the footprint before the chipping
const ICE_BREAK_FRONT = 1.08; // the freeze front's overshoot, so the middle closes before the clock ends
// what each footprint IS. `orca` is the orca's own (js/sim/orca.js); `breach`
// and `lunge` were the first sketches of it, kept for staged scenes.
const breakLens = (x0, x1, hw, n) => { // a body seen from above: a pointed lens from tail (x0) to nose (x1)
  const top = [], bot = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = x0 + (x1 - x0) * t, w = hw * Math.sin(Math.PI * (0.15 + 0.85 * t)) + 0.5;
    top.push(x, -w); bot.unshift(x, w);
  }
  return top.concat(bot);
};
const ICE_BREAK_SHAPES = {
  // the orca lunging up at a slant, nose toward the spot it bites: its body
  // where it crosses the sheet (D BOLD's girth, R 8.5, drawn out by the slant),
  // the head shoving the ice ahead of it and both pectorals cutting out
  orca: { sq: 0.72, parts: [
    { e: [0, 0, 15, 10] }, { e: [10, 0, 8, 7] },
    { p: [2, 8, -6, 17, -9, 8] }, { p: [2, -8, -6, -17, -9, -8] },
  ] },
  // straight up out of the ice: the body's cross-section at the waterline, both flippers and the fin
  breach: { sq: 0.72, parts: [
    { e: [0, 0, 13, 9] },
    { p: [-9, 4, -19, 12, -6, 8] }, { p: [9, 4, 19, 12, 6, 8] }, { p: [-3, -8, 0, -17, 3, -8] },
  ] },
  // up through the sheet at a slant: the whole body, the flukes, a flipper and the fin
  lunge: { sq: 0.72, parts: [
    { p: breakLens(-24, 22, 7.5, 14) },
    { p: [-22, 0, -32, -9, -27, 0, -32, 9] }, { p: [6, 5, 0, 14, -2, 5] }, { p: [4, -5, 0, -11, -4, -5] },
  ] },
};
const iceBreaks = []; // the live breaks: { x, y, shape, ang, seed, tick0, warn, hold, st, cov, open, next }
const breakCache = new Map(); // breakKey -> its pixels, built on first ask, on every screen

const breakKey = (b) => b.seed + ':' + b.tick0;
const iceBreakAge = (b) => (state.tick - b.tick0) * TICK_DT;
const iceBreakLife = (b) => b.warn + b.hold + ICE_BREAK_FREEZE + ICE_BREAK_SKIM;
// the break's own roll at a pixel (hash2 off the world seed, the pixel and the break's seed)
const breakHash = (x, y, s) => hash2(x * 7 + (s & 0xffff) * 131, y * 13 + (s >>> 16) * 71);

// shape space: the footprint's own frame (unsquashed, unturned)
function breakInside(sh, u, v) {
  for (const pt of sh.parts) {
    if (pt.e) { const a = (u - pt.e[0]) / pt.e[2], c = (v - pt.e[1]) / pt.e[3]; if (a * a + c * c <= 1) return true; continue; }
    const p = pt.p; let inside = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const yi = p[i + 1], yj = p[j + 1];
      if ((yi > v) !== (yj > v) && u < (p[j] - p[i]) * (v - yi) / (yj - yi) + p[i]) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}
function breakReach(sh) {
  let r = 0;
  for (const pt of sh.parts) {
    if (pt.e) r = Math.max(r, Math.hypot(pt.e[0], pt.e[1]) + Math.max(pt.e[2], pt.e[3]));
    else for (let i = 0; i < pt.p.length; i += 2) r = Math.max(r, Math.hypot(pt.p[i], pt.p[i + 1]));
  }
  return Math.ceil(r);
}
// chamfer distance (px) from every cell to the nearest set one; 0 on them
function breakDist(m, w, h) {
  const D = new Float32Array(w * h), BIG = 1e6, R2 = Math.SQRT2;
  for (let k = 0; k < w * h; k++) D[k] = m[k] ? 0 : BIG;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; let d = D[k];
    if (x > 0) d = Math.min(d, D[k - 1] + 1);
    if (y > 0) { d = Math.min(d, D[k - w] + 1); if (x > 0) d = Math.min(d, D[k - w - 1] + R2); if (x < w - 1) d = Math.min(d, D[k - w + 1] + R2); }
    D[k] = d;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const k = y * w + x; let d = D[k];
    if (x < w - 1) d = Math.min(d, D[k + 1] + 1);
    if (y < h - 1) { d = Math.min(d, D[k + w] + 1); if (x < w - 1) d = Math.min(d, D[k + w + 1] + R2); if (x > 0) d = Math.min(d, D[k + w - 1] + R2); }
    D[k] = d;
  }
  return D;
}
// signed: negative inside the set
function breakSdf(m, w, h) {
  const out = breakDist(m, w, h), inv = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) inv[k] = m[k] ? 0 : 1;
  const inn = breakDist(inv, w, h);
  for (let k = 0; k < w * h; k++) out[k] -= inn[k];
  return out;
}

// the footprint on its box: F (in or out) and D (signed px to its edge)
function breakFoot(b) {
  const c = breakCache.get(breakKey(b));
  if (c && c.foot) return c.foot;
  const sh = ICE_BREAK_SHAPES[b.shape], R = breakReach(sh) + ICE_BREAK_PAD;
  const x0 = b.x - R, y0 = b.y - Math.ceil(R * sh.sq) - 6, w = 2 * R + 1, h = 2 * Math.ceil(R * sh.sq) + 13;
  const F = new Uint8Array(w * h), ca = Math.cos(b.ang), sa = Math.sin(b.ang);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = x0 + i + 0.5 - b.x, dy = (y0 + j + 0.5 - b.y) / sh.sq;
    if (breakInside(sh, dx * ca + dy * sa, -dx * sa + dy * ca)) F[j * w + i] = 1;
  }
  const foot = { x0, y0, w, h, F, D: breakSdf(F, w, h) };
  breakCache.set(breakKey(b), Object.assign(c || {}, { foot }));
  return foot;
}
// the hole on that box: where the water is (the footprint, one px proud,
// chipped, cut to the tiles that were bare ice), each pixel's freeze time
// (ft, 0..1 rim to middle, -1 off the hole) and the hole's own signed
// distance (Dh) the pixels shade the rim by
function breakGeom(b) {
  const c = breakCache.get(breakKey(b));
  if (c && c.geom) return c.geom;
  const ft0 = breakFoot(b), { x0, y0, w, h, D } = ft0;
  const cov = new Set(b.cov), hole = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + i, y = y0 + j, k = j * w + i;
    if (!cov.has(idx(Math.floor(x / TILE), Math.floor(y / TILE)))) continue;
    const jag = (breakHash(x >> 1, y >> 1, b.seed) - 0.5) * 2.2 + (breakHash(x, y, b.seed + 1) - 0.5) * 0.8;
    if (D[k] + jag < ICE_BREAK_PROUD) hole[k] = 1;
  }
  const Dh = breakSdf(hole, w, h), ft = new Float32Array(w * h).fill(-1);
  let top = 1e-6;
  for (let k = 0; k < w * h; k++) if (hole[k]) {
    const x = x0 + k % w, y = y0 + ((k / w) | 0);
    ft[k] = Math.max(0, -Dh[k]) + breakHash(x >> 1, y >> 1, b.seed + 11) * 1.6 + breakHash(x, y, b.seed + 12) * 0.6;
    top = Math.max(top, ft[k]);
  }
  for (let k = 0; k < w * h; k++) if (ft[k] >= 0) ft[k] /= top;
  const geom = { x0, y0, w, h, D, hole, Dh, ft };
  breakCache.set(breakKey(b), Object.assign(breakCache.get(breakKey(b)) || {}, { geom }));
  return geom;
}
// the footprint as a hit test (world px), for whatever came up through it
function iceBreakCovers(b, x, y) {
  const f = breakFoot(b), i = Math.floor(x) - f.x0, j = Math.floor(y) - f.y0;
  return i >= 0 && j >= 0 && i < f.w && j < f.h && f.F[j * f.w + i] === 1;
}
// how far the freeze has come at age `a`: a hole pixel is open while its ft is past this
function breakFront(b, a) {
  return Math.max(0, Math.min(1, (a - b.warn - b.hold) / ICE_BREAK_FREEZE)) * ICE_BREAK_FRONT;
}
// is this world pixel a live break's open water - the one read a player's
// feet take on a tile a break holds (the plunge, playerPlunge; the climb
// out, nearestDryTile)
function iceBreakWet(x, y) {
  for (const b of iceBreaks) {
    if (!b.st) continue;
    const g = breakGeom(b), i = Math.floor(x) - g.x0, j = Math.floor(y) - g.y0;
    if (i < 0 || j < 0 || i >= g.w || j >= g.h) continue;
    const ft = g.ft[j * g.w + i];
    if (ft >= 0 && ft > breakFront(b, iceBreakAge(b))) return true;
  }
  return false;
}
// is this tile held open by a live break (and so painted as ice under it)
function iceBreakHolds(i) {
  for (const b of iceBreaks) {
    if (!b.st) continue;
    for (let n = b.next; n < b.open.length; n++) if (b.open[n][0] === i) return true;
  }
  return false;
}

// break the ice at (x, y). `shape` names an ICE_BREAK_SHAPES row, `ang` turns
// it (radians, 0 = nose east); `o.warn` s of cracks before it opens, `o.hold`
// s it stays open before it freezes. null when no bare ice lies under it.
function iceBreak(x, y, shape, ang, o) {
  if (!ICE_BREAK_SHAPES[shape]) return null;
  o = o || {};
  x = Math.round(x); y = Math.round(y);
  const seed = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(state.tick + 1, 83492791);
  const b = { x, y, shape, ang: Math.round((ang || 0) * 1000) / 1000, seed: seed >>> 0, tick0: state.tick,
    warn: Math.max(0, o.warn || 0), hold: o.hold === undefined ? ICE_BREAK_HOLD : Math.max(0, o.hold),
    st: 0, cov: [], open: [], next: 0 };
  // cov: every tile the chipped footprint can reach that is bare ice right now
  const f = breakFoot(b), seen = new Set();
  for (let k = 0; k < f.w * f.h; k++) {
    if (f.D[k] > 2) continue;
    const tx = Math.floor((f.x0 + k % f.w) / TILE), ty = Math.floor((f.y0 + ((k / f.w) | 0)) / TILE);
    if (!inWorld(tx, ty)) continue;
    const i = idx(tx, ty);
    if (seen.has(i)) continue;
    seen.add(i);
    if (ground[i] === 1 && !objects[i]) b.cov.push(i);
  }
  if (!b.cov.length) { breakCache.delete(breakKey(b)); return null; }
  b.cov.sort((p, q) => p - q);
  // open: the tiles at least half open water, each with the age it freezes
  // back at - when the front passes its own half-way pixel
  const g = breakGeom(b), per = new Map();
  for (let k = 0; k < g.w * g.h; k++) {
    if (g.ft[k] < 0) continue;
    const i = idx(Math.floor((g.x0 + k % g.w) / TILE), Math.floor((g.y0 + ((k / g.w) | 0)) / TILE));
    (per.get(i) || per.set(i, []).get(i)).push(g.ft[k]);
  }
  const half = (TILE * TILE) >> 1;
  for (const [i, fts] of per) {
    if (fts.length < half) continue;
    fts.sort((p, q) => q - p);
    const t = b.warn + b.hold + ICE_BREAK_FREEZE * Math.min(1, fts[half - 1] / ICE_BREAK_FRONT);
    b.open.push([i, Math.round(t * 60) / 60]);
  }
  b.open.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  iceBreaks.push(b);
  return b;
}

// the hole opening: its tiles go to open water, the noise scatters the fish
function breakOpen(b) {
  b.st = 1;
  for (const [i] of b.open) {
    if (ground[i] !== 1 || objects[i]) continue; // something changed under it since: left as it is
    ground[i] = 2;
    repaintGround(i % WORLD, (i / WORLD) | 0);
  }
  sfxAt('splash', b.x, b.y);
  sfxAt('mine', b.x, b.y);
  burst(b.x, b.y, '#3a6080', 14, 60, 0.6, true);
  burst(b.x, b.y, '#ddf1f8', 16, 75, 0.6, true);
  for (const f of fish) {
    if (f.born && Math.hypot(f.x - b.x, f.y - b.y) < 60) { f.a = Math.atan2(f.y - b.y, f.x - b.x); f.spook = 1.2; }
  }
}
// one tile frozen back: ice again, unless another break holds it or it is a listed hole
function breakClose(b, i) {
  if (ground[i] !== 2 || holes.includes(i) || iceBreakHolds(i)) return; // (b has let go of it: another break still holds it)
  ground[i] = 1;
  repaintGround(i % WORLD, (i / WORLD) | 0);
}
// every step, from updatePlay (js/sim/sim.js)
function updateIceBreaks() {
  for (let n = iceBreaks.length - 1; n >= 0; n--) {
    const b = iceBreaks[n], a = iceBreakAge(b);
    if (!b.st && a >= b.warn) breakOpen(b);
    if (b.st) while (b.next < b.open.length && (a >= b.open[b.next][1] || a >= iceBreakLife(b))) breakClose(b, b.open[b.next++][0]);
    if (a >= iceBreakLife(b)) { iceBreaks.splice(n, 1); breakCache.delete(breakKey(b)); }
  }
}
// the pixels of breaks no longer live (a client's list replaced by a snapshot, a load)
function breakCacheSweep() {
  if (breakCache.size <= iceBreaks.length) return;
  const live = new Set(iceBreaks.map(breakKey));
  for (const k of breakCache.keys()) if (!live.has(k)) breakCache.delete(k);
}
