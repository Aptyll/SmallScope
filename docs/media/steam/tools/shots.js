'use strict';
// The store art's shot list. ONE staged moment - a raid coming up the spur at
// a roosted eagle - framed eight ways, so every capsule is plainly the same
// game at the same second. Capture size is chosen so the game itself renders
// at the capsule's exact pixel size: no resampling ever touches the art.
//
//   kpx is IMAGE pixels per WORLD pixel (kWant outright), so the frame shows
//   size/kpx world px. A target WIDER than 16:9 is captured at 16:9 and the
//   band is cut out of it, because fitCanvas caps the view at 16:9 and
//   pillarboxes anything wider.

// The crater at tile 26,189 (seed 7): walls at radius ~5, turrets N/S/E/W, the
// bot bay up at 17,185, the gate and the spur leaving south-east toward the
// road, which runs the map's diagonal past x 34..40.
// The crater floor is small and half of it is stump or wall, so the cast
// stands on the tiles that are actually open: west of the bird at 22-23,
// north at 24-27/185-187, south at 24-26/191 and east at 28.
// The crater floor is small and half of it is stump or wall, so the cast
// stands on the tiles that are actually open: west of the bird at 22-23,
// north at 24-27/185-187, south at 24-26/191 and east at 28. The two pairs
// are LIVE, not held - the AI's own swings, shields and charges are better
// poses than anything set by hand, and a frozen seed makes them repeatable.
// The bird lies with its head west and both wings thrown out to the
// south-east, so it covers tiles 26-31 / 187-193 and anything staged there is
// simply behind it. The fight goes on the open WEST strip (x 22-24, y 185-191)
// instead, which leaves the frame reading action-left, bird-right.
const SCENE = `
  SA.stash();                 // every body not in the shot, parked far away
  state.time = 27;            // 27 mid-morning; 101 dusk, 130 night are the other hours
  // three bodies, no more: the crater floor is six tiles of open ground, a
  // fourth only ever ends up behind a wing or under the wordmark, and the two
  // turrets the merchant raised on 25,184 and 25,192 swallow anything on them
  var me = SA.cast(0, 23, 190, 0);          // the hunter, low and left of the beak
  SA.arm(me, 'longbow', ['fan', 'flame', 'arrow']);
  var ally = SA.cast(2, 22, 187, 1, 'down');   // a warrior, sword out, up the strip
  var foe  = SA.cast(1, 24, 191, 1, 'left');   // the rival they are both between
`;

// The string is DRAWN and never let go. A loosed fan crosses the crater and
// half of it lands in the bird, which flashes white and stops looking like a
// bird at all - and the pose that sells a bow is the draw anyway.
const PER = `
  SA.look(players[1].x, players[1].y - 3);
  if (i === 4) SA.fire(true);
`;
const SETTLE = 32;

const E = 'SA.mine()';  // the bird, in page scope

// dx/dy are world px off the bird; crop is the band cut from the capture.
const SHOTS = [
  { name: 'hero',      size: [3840, 2160], kpx: 6, dx: 120, dy: 0 },
  { name: 'pagebg',    size: [1438, 810],  kpx: 4, dx: 80,  dy: 10 },
  { name: 'main',      size: [1232, 706],  kpx: 5, dx: -8,  dy: -6 },
  { name: 'header',    size: [920, 518],   kpx: 4, dx: 0,   dy: -13 },
  { name: 'libheader', size: [920, 518],   kpx: 4, dx: 0,   dy: -13 },
  { name: 'small',     size: [462, 260],   kpx: 4, dx: -6,  dy: -14 },
  { name: 'vertical',  size: [748, 896],   kpx: 6, dx: 0,   dy: -8 },
  { name: 'libcap',    size: [600, 900],   kpx: 4, dx: 0,   dy: -4 },
];

module.exports = SHOTS.map((s) => Object.assign({
  settle: SETTLE, per: PER,
  stage: SCENE + '\n  SA.shotK(' + E + '.x + ' + s.dx + ', ' + E + '.y + ' + s.dy + ', ' + s.kpx + ');',
}, s));
module.exports.SCENE = SCENE;
