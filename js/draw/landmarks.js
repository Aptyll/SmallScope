'use strict';
// The story landmarks on the ground (LANDMARKS, js/landmarks.js) and the
// sled under its rider.
// ------------------------------------------------------------ landmarks
// A landmark's anchor is the front-left tile of its footprint: the sprite is
// centred over the footprint's width and stands on the anchor's foot row,
// `foot` px lower where its snow bank spills forward. Its parts draw nothing.
function lmArtPos(o, px, py) {
  const L = LANDMARKS[o.type], spr = SPRITES.landmark[L.art];
  return { spr, x: px + ((L.w * TILE - spr.width) >> 1), y: py + TILE - spr.height + L.foot };
}
function drawLandmark(o, px, py) {
  const a = lmArtPos(o, px, py);
  drawSpriteFlash(a.spr, a.x, a.y, o.flash);
}
// ...and each kind throws its shade from the same place (CASTERS, js/draw/ground.js)
Object.keys(LANDMARKS).forEach((k, i) => {
  CASTERS[k] = {
    code: () => 140 + i,
    art: () => { const a = lmArtPos({ type: k }, 0, 0); return whole(a.spr, a.x, a.y); },
  };
});

// The sled under a rider (drawPlayer, js/draw/bodies.js, after the body): it
// covers the legs so the body sits in it, faces the way it is going, and for
// the last SLED_WARN seconds rattles a pixel and flashes on a quickening beat.
// Its clock is the bar under it, emptying toward the break.
function drawSledRide(p, px, py, now) {
  const s = p.sled;
  const spr = s.face < 0 ? SPRITES.landmark.sledL : SPRITES.landmark.sled;
  const warn = s.t < SLED_WARN;
  const beat = warn ? 6 + (SLED_WARN - s.t) * 4 : 0;
  const shake = warn ? (Math.floor(now * 30) % 2 ? 1 : -1) : 0;
  const x = px + ((16 - spr.width) >> 1) + shake, y = py + 16 - spr.height + 6; // the deck at the hips
  drawSpriteFlash(spr, x, y, warn && Math.floor(now * beat) % 2 ? 1 : 0);
  // the clock: a thin bar under the runners
  const w = 14, f = Math.max(0, Math.min(1, s.t / SLED_T));
  const bx = px + 1, by = y + spr.height + 1;
  ctx.fillStyle = '#2a1f1a'; ctx.fillRect(bx - 1, by - 1, w + 2, 4);
  ctx.fillStyle = warn ? (Math.floor(now * beat) % 2 ? '#f4f7ff' : '#d98a5a') : '#c9a23f';
  ctx.fillRect(bx, by, Math.round(w * f), 2);
}
