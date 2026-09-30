'use strict';
// The story landmarks on the ground (LANDMARKS, js/landmarks.js).
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
