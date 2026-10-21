'use strict';
// ------------------------------------------------------------ weapon art
// The heroes' basic-attack weapons as the hand holds them, and the three item
// icons drawn in the same ink. A weapon is named by the `art` its hero's
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
    f: '#ff9a3a', F: '#ffe07a', u: '#d8502e', i: '#454c5e', I: '#5c6478',
  };
  // the gilded metal the finished items' icons wear
  const GILT = Object.assign({}, PAL, { m: '#b98a2e', M: '#ffe08a' });
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
    // IGNIA's HEARTH STAFF: an ash staff, an iron cup at its head, the fire in it (head left)
    staff: [
      '............', '............', '............', '.uf.........',
      'ufFfi.......', 'fFFFIgGgGgGo', 'ufFfi.......', '.uf.........',
      '............', '............', '............', '............',
    ],
    // the HORN BOW's shape: limbs bulging forward, horn ears swept back
    horn: [
      '............', '..Hh........', '...qmMM.....', '...q...mMM..',
      '...q...Gg.e.', '..hqsssssssW', '...q...Gg.e.', '...q...mMM..',
      '...qmMM.....', '..Hh........', '............', '............',
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
  // FLINT HEAD's icon: a barbed head on a heavy dark shaft, 8 px
  const FLINT = ['.....Ssx', '......ss', '....Ss.S', '....wS..', '..Sw....', '.hwS....', 'hwh.....', 'w.......'];
  const FLINT_PAL = { '.': null, s: '#cfd8e8', S: '#8b93a8', x: '#ffffff', w: '#6b4a30', h: '#fff2c0' };
  SPRITES.weaponArt = { bow: SPR.bake(ART.bow, PAL), sword: SPR.bake(ART.sword, PAL), staff: SPR.bake(ART.staff, PAL) };
  SPRITES.weaponHeld = { sword: SPR.bake(HELD.sword, PAL) };
  // the item icons (BUILD_ITEMS, js/sim/items.js)
  SPRITES.itemArt_flint = SPR.bake(FLINT, FLINT_PAL);
  SPRITES.itemArt_horn = SPR.bake(ART.horn, GILT);
  SPRITES.itemArt_brand = SPR.bake(ART.sword, GILT);
  // SUNSTONE's icon: a cut gem, amber lit from the top-left (the old sunstone ore's)
  const SUNSTONE = ['..mmmm..', '.mNAAam.', 'mNAAaanm', 'mAAaannm', 'maaannnm', '.mannnm.', '..mnnm..', '...mm...'];
  SPRITES.itemArt_sunstone = SPR.bake(SUNSTONE, { '.': null, m: '#5c2c0c', n: '#9a4e16', a: '#d8862a', A: '#f4bc44', N: '#fff1b0' });
})();
