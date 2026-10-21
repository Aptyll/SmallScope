'use strict';
// ------------------------------------------------------------ weapon art
// The heroes' basic-attack weapons as the hand holds them. A weapon is named by the `art` its hero's
// attack gives (CLASSES[c].attack, js/sim/player.js): SPRITES.weaponArt[art] is
// its 12 px icon (the bow is held at that size), SPRITES.weaponHeld[art] the
// blade at its real 22 px length where it has one (drawHeldTool,
// js/draw/bodies.js). WEAPON_FWD says which way each art's business end points
// as drawn (radians, 0 = +x), so the hand turns it onto the facing or the aim.
// A bow is drawn the way it is held: string toward the archer, belly and
// arrowhead toward the target; the sword lies flat, point left.
const WEAPON_FWD = { bow: 0, sword: Math.PI, staff: Math.PI };
(() => {
  // the wood and steel every weapon here is painted in
  const PAL = {
    '.': null, o: '#241a12', s: '#e8dcb4', W: '#ffffff', g: '#6b4a30', G: '#a3794f', e: '#c8d2e4', E: '#8b93a8',
    q: '#9a917c', h: '#efe3c4', H: '#b39a6e', m: '#6b4a30', M: '#a3794f',
    f: '#ff9a3a', F: '#ffe07a', y: '#f2cc6a', Y: '#b98a2e',
  };
  const ART = {
    // the HUNTER's SHORTBOW: a small plain D, seven px of limb
    bow: [
      '............', '............', '....mM......', '...q..mM....',
      '...q....Gge.', '..hqsssssssW', '...q....Gge.', '...q..mM....',
      '....mM......', '............', '............', '............',
    ],
    // the WARRIOR's LONGSWORD: a white point, the lit edge over the shaded
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
  SPRITES.weaponArt = { bow: SPR.bake(ART.bow, PAL), sword: SPR.bake(ART.sword, PAL), staff: SPR.bake(ART.staff, PAL) };
  SPRITES.weaponHeld = { sword: SPR.bake(HELD.sword, PAL) };
})();
