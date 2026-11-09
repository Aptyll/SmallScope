'use strict';
// ------------------------------------------------------------ weapon art
// The heroes' basic-attack weapons as the hand holds them. A weapon is named by the `art` its hero's
// attack gives (CLASSES[c].attack, js/sim/player.js): SPRITES.weaponArt[art] is
// its 12 px icon (most are held at that size), SPRITES.weaponHeld[art] the
// blade at its real 22 px length where it has one (drawHeldTool,
// js/draw/bodies.js). WEAPON_FWD says which way each art's business end points
// as drawn (radians, 0 = +x), so the hand turns it onto the facing or the aim.
// The sword lies flat, point left; a hero's own art says its own (e.g. WEAPON_FWD.horn).
const WEAPON_FWD = { sword: Math.PI, staff: Math.PI };
// WEAPON_GRIP says where the hand closes on each art, [x, y] on its grid: the
// hand turns the weapon about that point, so a blade reaches OUT of the fist
// and its hilt never swings back across the body (drawHeldTool,
// js/draw/bodies.js). `held` is the long art, `icon` the 12 px one.
const WEAPON_GRIP = { held: { sword: [20, 11] }, icon: { sword: [10, 5], staff: [2, 6] } };
(() => {
  // the wood and steel every weapon here is painted in
  const PAL = {
    '.': null, o: '#241a12', W: '#ffffff', g: '#6b4a30', G: '#a3794f', e: '#c8d2e4', E: '#8b93a8',
    m: '#6b4a30', M: '#a3794f',
    f: '#ff9a3a', F: '#ffe07a', y: '#f2cc6a', Y: '#b98a2e',
  };
  const ART = {
    // the LONGSWORD the blade heroes carry (art: 'sword'): a white point, the lit edge over the shaded
    // flat, the cross-guard, a wooden grip and a dark pommel
    sword: [
      '............', '............', '............', '........mM..',
      '..eeeeeemM..', 'WeeeeeeemMgo', '..EEEEEEmM..', '........mM..',
      '............', '............', '............', '............',
    ],
    // IGNIA's CROOK AND LANTERN: the crook upright, the fire hung from its hook
    staff: [
      '...oooo.....', '..oGggGo....', '.oGo..oGo...', '.oGo..oyo...',
      '.oGo.oYyYo..', '.oGo.ofFfo..', '.oGo.oFWFo..', '.oGo.oYyYo..',
      '.oGo..ooo...', '.oGo........', '.ogo........', '..o.........',
    ],
  };
  // the sword at its real length: a 22 px blade, point left like the icon
  const HELD = {
    sword: [
      '......................', '......................', '......................', '......................',
      '......................', '......................', '......................', '......................',
      '..................mM..', '..................mM..', '..eeeeeeeeeeeeeeeemMG.', 'WeeeeeeeeeeeeeeeeemMgo',
      '..EEEEEEEEEEEEEEEEmMG.', '..................mM..', '..................mM..', '......................',
      '......................', '......................', '......................', '......................',
      '......................', '......................',
    ],
  };
  SPRITES.weaponArt = { sword: SPR.bake(ART.sword, PAL), staff: SPR.bake(ART.staff, PAL) };
  SPRITES.weaponHeld = { sword: SPR.bake(HELD.sword, PAL) };
})();
