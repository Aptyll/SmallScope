'use strict';
// HUD art: the twelve gear glyphs in four materials, the hearts, and the
// cursor set with its shadow.
(() => {
  const { bake } = SPR;

  // ---------------------------------------------------------------- gear icons
  // One 12x12 glyph PER VARIANT (12 total), baked once per material - leather /
  // iron / steel / gold - into SPRITES.gearIcons[slot][variant][material], so
  // the icon carries WHICH piece you chose and its material carries the level.
  // Shared accent chars across every material: w ice-white, r hearth-red.
  const GEAR_MAT_PALS = [
    { '.': null, 'o': '#141a2c', 'm': '#8a6a4a', 'h': '#b08a5e', 'd': '#5f4830', 'w': '#ddf1f8', 'r': '#f2707a' }, // leather
    { '.': null, 'o': '#141a2c', 'm': '#9aa3ad', 'h': '#c8ccd4', 'd': '#646c76', 'w': '#ddf1f8', 'r': '#f2707a' }, // iron
    { '.': null, 'o': '#141a2c', 'm': '#9fc4dd', 'h': '#ddf1f8', 'd': '#5f87a8', 'w': '#ffffff', 'r': '#f2707a' }, // steel
    { '.': null, 'o': '#141a2c', 'm': '#f2cc6a', 'h': '#ffedb0', 'd': '#b8912f', 'w': '#ffffff', 'r': '#f2707a' }, // gold
  ];
  // helmet 0 LONGSIGHT: closed helm, one long glowing sight slit
  const gearLongsight = [
    '...oooooo...',
    '..ommhhmmo..',
    '.ommmmmmmmo.',
    '.ommmmmmmmo.',
    '.oddddddddo.',
    '.owwwwwwwdo.',
    '.oddddddddo.',
    '.ommmmmmmmo.',
    '.ommmmmmmmo.',
    '..odo..odo..',
    '..oo....oo..',
    '............',
  ];
  // helmet 1 QUICKDRAW: winged cap, white wings flared at the temples
  const gearQuickdraw = [
    '............',
    '....oooo....',
    '...ommmmo...',
    '..ommhhmmo..',
    '.oommmmmmoo.',
    'owwommmmowwo',
    'owwwodmowwwo',
    '.oowod.dowo.',
    '...o.oo.o...',
    '............',
    '............',
    '............',
  ];
  // helmet 2 HUNTSMAN: peaked hood with a white feather
  const gearHuntsman = [
    '.........ww.',
    '......o.ww..',
    '.....oowwo..',
    '....ommwo...',
    '...ommmmo...',
    '..ommmmmmo..',
    '.ommmmmmmdo.',
    '.omdddddddo.',
    '.odo.....do.',
    '..oo.....o..',
    '............',
    '............',
  ];
  // chest 0 BULWARK: a kite shield
  const gearBulwark = [
    '.oooooooooo.',
    'omhhhhhhmmdo',
    'ommmmmmmmmdo',
    'ommmmmmmmmdo',
    'ommmmmmmmmdo',
    '.ommmmmmmdo.',
    '.ommmmmmmdo.',
    '..ommmmmdo..',
    '...ommmdo...',
    '....omdo....',
    '.....oo.....',
    '............',
  ];
  // chest 1 IRONHIDE: riveted breastplate with shoulder caps
  const gearIronhide = [
    'ooo......ooo',
    'omdo.oo.omdo',
    '.oommmmmmoo.',
    '.ohmmmmmmdo.',
    '.ommhmmhmmo.',
    '.ommmmmmmdo.',
    '.ommhmmhmmo.',
    '.odmmmmmmdo.',
    '..ommmmmmo..',
    '..oddddddo..',
    '...oooooo...',
    '............',
  ];
  // chest 2 HEARTHWEAVE: quilted tunic with a hearth-red heart
  const gearHearthweave = [
    '.oo......oo.',
    '.omoooooomo.',
    '..ommmmmmo..',
    '.ommmmmmmmo.',
    '.omrrmrrmmo.',
    '.omrrrrrmmo.',
    '.ommrrrmmmo.',
    '.ommmrmmmmo.',
    '..ommmmmmo..',
    '..oddddddo..',
    '...oooooo...',
    '............',
  ];
  // legs 0 STRIDER: greaves with speed ticks streaming off
  const gearStrider = [
    '..oooo.oooo.',
    '..ohmo.ohmo.',
    '..ohmo.ohmo.',
    'w.ommo.ommo.',
    '..oddo.oddo.',
    'w.ommo.ommo.',
    '..ommo.ommo.',
    'w.oddo.oddo.',
    '..oooo.oooo.',
    '............',
    '............',
    '............',
  ];
  // legs 1 SLIDEWORN: greaves riding a slide board, spray behind
  const gearSlideworn = [
    '..oooo.oooo.',
    '..ohmo.ohmo.',
    '..ommo.ommo.',
    '..ommo.ommo.',
    '..oddo.oddo.',
    '..oooo.oooo.',
    '.owwwwwwwwo.',
    '..oooooooo..',
    'w.w.........',
    '............',
    '............',
    '............',
  ];
  // legs 2 PACKMULE: a work belt with two hanging pouches
  const gearPackmule = [
    '............',
    '.oooooooooo.',
    '.ohmmhhmmho.',
    '.oooooooooo.',
    '..oooo.oooo.',
    '..ommo.ommo.',
    '..ommo.ommo.',
    '..oddo.oddo.',
    '...oo...oo..',
    '............',
    '............',
    '............',
  ];
  // boots 0 SKATES: a boot on a white blade
  const gearSkates = [
    '....oooo....',
    '....ohmo....',
    '....ohmo....',
    '....ommo....',
    '....ommo....',
    '....ommooo..',
    '....ommmmdo.',
    '....oddddo..',
    '....o..o....',
    '...wwwwwww..',
    '............',
    '............',
  ];
  // boots 1 DANCER: a light boot mid-step, motion ticks trailing
  const gearDancer = [
    '.....oo.....',
    '.....omo....',
    '....oomo....',
    '....omo.w...',
    '...oomo.....',
    '...omoo.w...',
    '..oommdo....',
    '..ommmdo.w..',
    '..odddo.....',
    '...ooo......',
    '............',
    '............',
  ];
  // boots 2 GHOSTSTEP: a boot beside its fading afterimage
  const gearGhoststep = [
    '.oooo.......',
    '.ohmo..d.d..',
    '.ohmo.......',
    '.ommo..d.d..',
    '.ommoo......',
    '.ommmdo.dd..',
    '.odddo..d.d.',
    '..ooo...dd..',
    '............',
    '............',
    '............',
    '............',
  ];

  // ---------------------------------------------------------------- heart
  const HPAL = {
    '.': null,
    'o': '#5c1f2e',
    'r': '#e04a54',
    'R': '#f78a8a',
    'W': '#ffd9d9',
    'g': '#3a3448', // empty
    'G': '#4a4460',
  };
  const heartFull = [
    '.oo.oo..',
    'orRoRro.',
    'orWRrro.',
    'orrrrro.',
    '.orrro..',
    '..oro...',
    '...o....',
  ];
  const heartHalf = [
    '.oo.oo..',
    'orRoGgo.',
    'orWogGo.',
    'orrogGo.',
    '.orogo..',
    '..oro...',
    '...o....',
  ];
  const heartEmpty = [
    '.oo.oo..',
    'oGgggGo.',
    'oGgggGo.',
    'ogggggo.',
    '.ogggo..',
    '..ogo...',
    '...o....',
  ];
  const HEPAL = { '.': null, 'o': '#2a2438', 'g': '#3a3448', 'G': '#4a4460', 'r': '#e04a54', 'R': '#f78a8a', 'W': '#ffd9d9' };

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
  // builder's mallet: a stump or structure you can right-click. The head sits
  // top-right so the handle trails away from the hotspot at the face (6,5).
  const cursorHammer = [
    '......oooo..',
    '.....oSSSso.',
    '....oSSSsso.',
    '...oSSSssso.',
    '...ossssssso',
    '..oHoossssso',
    '.oHho.oooooo',
    'oHho........',
    'ohho........',
    'oho.........',
    'oo..........',
  ];

  Object.assign(SPRITES, {
    // gearIcons[slot][variant][material]: 12 distinct variant glyphs, each in
    // leather / iron / steel / gold
    gearIcons: [
      [gearLongsight, gearQuickdraw, gearHuntsman],
      [gearBulwark, gearIronhide, gearHearthweave],
      [gearStrider, gearSlideworn, gearPackmule],
      [gearSkates, gearDancer, gearGhoststep],
    ].map((row) => row.map((g) => GEAR_MAT_PALS.map((pal) => bake(g, pal)))),
    heartFull: bake(heartFull, HPAL),
    heartHalf: bake(heartHalf, HEPAL),
    heartEmpty: bake(heartEmpty, HEPAL),
    cursor: {
      arrow: bake(cursorArrow, CUPAL), hand: bake(cursorHand, CUPAL),
      grab: bake(cursorGrab, CUPAL), hammer: bake(cursorHammer, CUPAL),
    },
    cursorShadow: {
      arrow: bake(cursorArrow, CUSHADOW), hand: bake(cursorHand, CUSHADOW),
      grab: bake(cursorGrab, CUSHADOW), hammer: bake(cursorHammer, CUSHADOW),
    },
  });
})();
