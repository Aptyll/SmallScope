'use strict';
// ------------------------------------------------------------ the orca, drawn
// The pixels of the orca (the thing itself, its hunt and its clock:
// js/sim/orca.js; its art: SPRITES.orca, js/baked/orca.js).
//   the shadow   under the ice (render): the
//                baked heading nearest its own (64 round, so a turn rolls
//                through them), never turned off the pixel grid, and cut to the ice's own pixels (orcaMask) so it never
//                shows over a sill it swims under or past the shore. Locked
//                on, it drops a little deeper (ORCA_SHADE_DEEP) and rises
//                through the countdown to ORCA_SHADE_UP: always in sight,
//                only darker. Its flukes beat up and down through the
//                baked steps, quicker the faster it goes: the beat is
//                kept as a phase (orcaBeat) that only ever moves on, so a
//                change of speed never jumps the tail. It is gone while
//                it is out.
//   the breach   y-sorted with the bodies at the hole's waterline: the lunge
//                anchored by its jaws on the bitten spot, cut at the
//                waterline, rising ORCA_DEPTH px over ORCA_RISE, the jaws
//                shut at ORCA_BITE, a bob, then the slide back down. The
//                hole, its plates and its cracks are the ice break's
//                (js/draw/icebreak.js), flat on the ground under it.
//   the count    over the hunted head (drawOrcaCount, js/draw/overhead.js)
//   up           THE ORCA UP (js/sim/orca.js) is a camp monster drawn by
//                drawAnimal like a bear, off SPRITES.orca.left/right: the
//                breach's cells cut at the waterline (orcaUpFrame), so it
//                stands in its hole to the chest - shut at rest, open on a
//                lunge's wind-up and on the wake. Its hole (drawOrcaPool) is
//                dark water flat on the ground under it, and each spout in
//                the air is a ring filling at its landing spot under a
//                lump of the pool's ice arcing onto it.
const ORCA_SHADE = 0.42;      // the shadow's alpha cruising: the under-ice ink at part strength (render)
const ORCA_SHADE_DEEP = 0.34; // ...the moment it locks on, a little deeper
const ORCA_SHADE_UP = 0.78;   // ...and come up under its quarry when the count runs out
const ORCA_WAG = [4, 1 / 16]; // the tail's beat: rad/s at rest, and more per px/s of speed
const ORCA_DEPTH = 46;        // px under the waterline the lunge starts from
const ORCA_DROP = 70;         // px it slides down going back under
const ORCA_JAW_AT = [6, -4];  // px from the bitten spot to where the jaws close: its chest, a little to the hole's side
const ORCA_UP_WL = ORCA_LEAN[1] + 2 - ORCA_JAW_AT[1] + SPRITES.orca.jaw[1]; // the waterline's row in a breach cell: the hole sits ORCA_LEAN[1] under the bite, its waterline 2 under that (drawOrcaBreach)
const ORCA_HOLE = [22, 7];    // px: the hole's half-width and half-height round the up orca's feet
const ORCA_HOLE_INK = ['#15263f', '#24406a']; // its water, and the rim's wet edge
const ORCA_SPOUT_ARC = 40;    // px a spout rises at the middle of its flight
const ORCA_SPOUT_INK = ['#0f1632', '#cfe8f7', '#ffffff', '#2f6aa8', '#7fd4ff']; // the lump's dark rim, its ice, its glint; the ring's line and its fill
// a breach cell cut at the waterline: one frame of the orca up
function orcaUpFrame(img) {
  const c = document.createElement('canvas');
  c.width = SPRITES.orca.bcell; c.height = ORCA_UP_WL;
  c.getContext('2d').drawImage(img, img.ox, img.oy);
  return c;
}
// its clips, the keys ANIM_CLIPS.orca names: the lunge's jaws open through
// its wind-up (BEAR_STRIKE) and shut on the blow
(() => {
  const B = SPRITES.orca.breach;
  const set = (shut, open) => {
    const s = orcaUpFrame(shut), o = orcaUpFrame(open), lunge = [];
    for (let i = 0; i < BEAR_ATTACK_FRAMES; i++) lunge.push(i < BEAR_STRIKE ? o : s);
    return { idle: [s], bite: lunge, paw: lunge, roar: new Array(BEAR_ROAR_FRAMES).fill(o) };
  };
  SPRITES.orca.left = set(B.shut, B.open);
  SPRITES.orca.right = set(B.shutR, B.openR);
})();
// flat on the ground pass: the up orca's hole, and the spouts' rings and lumps
function drawOrcaPool(ex, ey) {
  const up = orcaUp();
  if (up) {
    const cx = Math.round(up.x - ex), cy = Math.round(up.y + 2 - ey), [w, h] = ORCA_HOLE;
    if (cx > -w && cy > -h && cx < WV_W + w && cy < WV_H + h) {
      ctx.fillStyle = ORCA_HOLE_INK[1]; ctx.beginPath(); ctx.ellipse(cx, cy, w + 1, h + 1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ORCA_HOLE_INK[0]; ctx.beginPath(); ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const s of orcaSpouts) {
    const k = Math.min(1, s.t / ORCA_SPOUT_T), px = Math.round(s.x - ex), py = Math.round(s.y - ey);
    if (px < -60 || py < -60 || px > WV_W + 60 || py > WV_H + 60) continue;
    // the ring: the hit's own size, filling as the lump comes down
    ctx.globalAlpha = 0.55 + 0.4 * k;
    ctx.strokeStyle = ORCA_SPOUT_INK[3]; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(px + 0.5, py + 0.5, ORCA_SPOUT_HIT, ORCA_SPOUT_HIT * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.35 * k; ctx.fillStyle = ORCA_SPOUT_INK[4];
    ctx.beginPath(); ctx.ellipse(px, py, ORCA_SPOUT_HIT * k, ORCA_SPOUT_HIT * 0.6 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // the lump, on its arc from the hole to the ring
    const lx = Math.round(s.sx + (s.x - s.sx) * k - ex), ly = Math.round(s.sy + (s.y - s.sy) * k - 18 * (1 - k) - ORCA_SPOUT_ARC * 4 * k * (1 - k) - ey);
    ctx.fillStyle = ORCA_SPOUT_INK[0]; ctx.fillRect(lx - 2, ly - 2, 5, 5);
    ctx.fillStyle = ORCA_SPOUT_INK[1]; ctx.fillRect(lx - 1, ly - 1, 3, 3);
    ctx.fillStyle = ORCA_SPOUT_INK[2]; ctx.fillRect(lx - 1, ly - 1, 1, 1);
  }
}
const orcaSh = document.createElement('canvas'); // one shadow frame, cut to the ice
const orcaShG = orcaSh.getContext('2d');
let orcaMask = null; // { cv, x0, y0 }: the disc's ice pixels (opaque) over its box, built once
let orcaBeat = 0, orcaBeatAt = 0; // the tail's phase (rad) and the draw it was last moved on (s)

// the ice the shadow may show through: every ice pixel of the disc and a
// tile round it (iceAtPx: the sheet as the ground drew it)
function orcaMaskBuild() {
  const R = Math.ceil((ORCA_LAKE_R + ORCA_LAKE_RAG + 3) * TILE), P = orcaPool();
  const x0 = Math.round((P.tx + 0.5) * TILE) - R, y0 = Math.round((P.ty + 0.5) * TILE) - R, w = 2 * R, cv = document.createElement('canvas');
  cv.width = cv.height = w;
  const g = cv.getContext('2d'), im = g.createImageData(w, w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + i, y = y0 + j;
    if (orcaLakeEdge(x / TILE - 0.5, y / TILE - 0.5) < 1 && iceAtPx(x, y)) im.data[(j * w + i) * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  orcaMask = { cv, x0, y0 };
}

function drawOrcaShadow(ex, ey, now) {
  if (!orca.on || orca.mode === 'up') return;
  const rx = Math.round(orca.x), ry = Math.round(orca.y), S = SPRITES.orca, h = S.cell >> 1;
  if (rx - ex < -h || ry - ey < -h || rx - ex > WV_W + h || ry - ey > WV_H + h) return;
  if (!orcaMask) orcaMaskBuild();
  const n = S.hds, hd = ((Math.round(orca.a / (Math.PI * 2) * n) % n) + n) % n;
  orcaBeat = (orcaBeat + Math.min(0.1, Math.max(0, now - orcaBeatAt)) * (ORCA_WAG[0] + orca.v * ORCA_WAG[1])) % (Math.PI * 2);
  orcaBeatAt = now;
  const f = S.shade(hd, Math.floor(orcaBeat / (Math.PI * 2) * S.phs) % S.phs);
  if (orcaSh.width !== S.cell) orcaSh.width = orcaSh.height = S.cell;
  orcaShG.globalCompositeOperation = 'source-over';
  orcaShG.clearRect(0, 0, S.cell, S.cell);
  orcaShG.drawImage(f, f.ox, f.oy);
  orcaShG.globalCompositeOperation = 'destination-in';
  orcaShG.drawImage(orcaMask.cv, rx - h - orcaMask.x0, ry - h - orcaMask.y0, S.cell, S.cell, 0, 0, S.cell, S.cell);
  orcaShG.globalCompositeOperation = 'source-over';
  // the rise: from a little deeper at the lock to just under the ice at the strike
  const u = orca.mode === 'crack' ? 1 : orca.mode === 'hunt' ? Math.min(1, orcaAge() / ORCA_LINE) : -1;
  ctx.globalAlpha = u < 0 ? ORCA_SHADE : ORCA_SHADE_DEEP + (ORCA_SHADE_UP - ORCA_SHADE_DEEP) * u * u;
  ctx.drawImage(orcaSh, rx - h - ex, ry - h - ey);
  ctx.globalAlpha = 1;
}

// out of the water: the y-sorted list's entry (render) while orca.mode is 'up'
function drawOrcaBreach(ex, ey) {
  const S = SPRITES.orca, B = S.breach, age = orcaAge(), right = orca.side < 0; // the hole left of the spot: the lunge goes right, mirrored
  const img = age < ORCA_BITE ? (right ? B.openR : B.open) : (right ? B.shutR : B.shut);
  let off;
  if (age < ORCA_RISE) { const u = age / ORCA_RISE; off = ORCA_DEPTH * (1 - u) * (1 - u); }
  else if (age < ORCA_SINK_AT) off = age > ORCA_BITE && Math.floor((age - ORCA_BITE) / (8 * TICK_DT)) % 2 ? 1 : 0; // a heave as it chews
  else off = ORCA_DROP * Math.pow((age - ORCA_SINK_AT) / (ORCA_UP - ORCA_SINK_AT), 1.6);
  const jx = right ? S.bcell - 1 - S.jaw[0] : S.jaw[0];
  const cx = orca.jx + (right ? -1 : 1) * ORCA_JAW_AT[0] - jx, cy = orca.jy + ORCA_JAW_AT[1] - S.jaw[1] + Math.round(off);
  const wl = orca.hy + 2 - ey; // the waterline: nothing under it is drawn
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - ex - 8, wl - S.bcell - 80, S.bcell + 16, S.bcell + 80); ctx.clip();
  ctx.drawImage(img, cx + img.ox - ex, cy + img.oy - ey);
  ctx.restore();
}
