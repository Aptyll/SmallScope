'use strict';
// HUD art: the cursor set with its shadow. (The item icons are
// js/sprites/item-icons.js.)
(() => {
  const { bake } = SPR;

  // ---------------------------------------------------------------- cursors
  // Custom in-canvas pointer set, lit from the top-left like the rest of the
  // art: white body, icy right-edge bevel, deep navy outline. Each is drawn
  // over a baked one-colour shadow (same grids, CUSHADOW) offset by a pixel.
  const CUPAL = {
    '.': null,
    'o': '#1c1a30', // outline
    'w': '#f4f7ff', // body
    'b': '#c2d8ee', // icy bevel
    'B': '#8fb3d6', // deep bevel
    's': '#8b93a8', // steel
    'S': '#c4ccdd', // steel light
    'h': '#8a6142', // wood
    'H': '#a3794f', // wood light
  };
  const CUSHADOW = {};
  for (const k in CUPAL) CUSHADOW[k] = CUPAL[k] ? '#0a0e23' : null;

  // plain pointer: menus, overlays, the title screen. Hotspot = tip (0,0).
  const cursorArrow = [
    'o.........',
    'oo........',
    'owo.......',
    'owwo......',
    'owwbo.....',
    'owwwbo....',
    'owwwwbo...',
    'owwwwwbo..',
    'owwwwwwbo.',
    'owwwwwwwbo',
    'owwwbbbBBo',
    'owbowbo...',
    'owo.owbo..',
    'oo...owbo.',
    '.....oBBo.',
    '......oo..',
  ];
  // pointing hand: something under the cursor will react to a click.
  // Hotspot = fingertip (4,0).
  const cursorHand = [
    '....oo.......',
    '...owbo......',
    '...owbo......',
    '...owbooo....',
    '...owbowbooo.',
    '...owbowbowbo',
    '.ooowbowbowbo',
    'owwowbowbowbo',
    'owwwwwwwwwwbo',
    'owwwwwwwwwwbo',
    '.owwwwwwwwbBo',
    '..owwwwwwbBo.',
    '...owwwwbBo..',
    '...oooooooo..',
  ];
  // closed fist: dragging a slider. Hotspot = centre (5,4).
  const cursorGrab = [
    '...oooooo..',
    '..owbwbwbo.',
    '.owbowbowbo',
    'oowwowwowbo',
    'owwwwwwwwbo',
    'owwwwwwwwbo',
    '.owwwwwwbBo',
    '..owwwwbBo.',
    '...oooooo..',
  ];
  Object.assign(SPRITES, {
    cursor: {
      arrow: bake(cursorArrow, CUPAL), hand: bake(cursorHand, CUPAL),
      grab: bake(cursorGrab, CUPAL),
    },
    cursorShadow: {
      arrow: bake(cursorArrow, CUSHADOW), hand: bake(cursorHand, CUSHADOW),
      grab: bake(cursorGrab, CUSHADOW),
    },
  });
})();
