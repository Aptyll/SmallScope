'use strict';
// The eagle: three flap frames, each side's armour over them, the hit flash
// and the shadow it drags across the snow.
(() => {
  const { bake, TEAM_SKINS } = SPR;

  // ---------------------------------------------------------------- eagle
  // The drop eagle, seen from above, flying along +x (the game rotates it to
  // its heading). 32x48: three wing frames cycled spread -> mid -> back -> mid.
  // Drawn at 2x in-game (it is far above the ground), never through
  // drawSpriteFlash (it is taller than the 32x32 scratch).
  const EGPAL = {
    '.': null,
    'o': '#4e5c82', // outline
    'w': '#f6f8ff', // plumage
    'W': '#d2dbea', // plumage shade (trailing feathers, belly)
    'g': '#8c9ab8', // primaries / tail band
    'c': '#fff6dd', // head
    'y': '#e9b23c', // beak
    'e': '#2e2440', // eye
  };
  // the same silhouette as a soft ground shadow
  const EGSHADOW = { '.': null, 'o': 'rgba(40,60,100,0.30)', 'w': 'rgba(40,60,100,0.30)', 'W': 'rgba(40,60,100,0.30)',
    'g': 'rgba(40,60,100,0.30)', 'c': 'rgba(40,60,100,0.30)', 'y': 'rgba(40,60,100,0.30)', 'e': 'rgba(40,60,100,0.30)' };
  const eagleSpread = [
    '.......og.gg.gW.o...............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.WWo.............',
    '.......oWWWWwwwwwwo.............',
    '.......oWWWWwwwwwwo.............',
    '.......oWWWWWwwwwwo.............',
    '.......oWWWWWwwwwwo.............',
    '.......oWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwo............',
    '......oWWWWWWwwwwwwo............',
    '......oWWWWWWwwwwwwo............',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '..oo..oWWWWWWwwwwwwwwo.ooo......',
    '.oggoooWwwwwwwwwwwwwwooccco.....',
    '.oggwwwwwwwwwwwwwwwwooccccco....',
    '.oggwwwwwwwwwwwwwwwwwcccecccoo..',
    '.oggwwwwwwwwwwwwwwwwwccccccyyyo.',
    '.oggwwwwwwwwwwwwwwwwwccccccyyo..',
    '.oggwwWWWWWWWWWWWWWWoocceccoo...',
    '.oggoooWWWWWWWWWWWwwwooccco.....',
    '..oo..oWWWWWWwwwwwwwwo.ooo......',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwo............',
    '......oWWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwo.............',
    '.......oWWWWWwwwwwo.............',
    '.......oWWWWwwwwwwo.............',
    '.......oWWWWwwwwwwo.............',
    '.......og.gg.gW.WWo.............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.o...............',
    '........o.oo.oo.................',
  ];
  const eagleMid = [
    '................................',
    '.....o.oo.oo....................',
    '....og.gg.gW....................',
    '.....og.gg.WW...................',
    '.....og.gg.WW...................',
    '.....og.gg.gW.o.................',
    '.....og.gg.gW.Wo................',
    '.....oWWWWwwwwwo................',
    '.....oWWWWWwwwwwo...............',
    '.....oWWWWWwwwwwo...............',
    '......oWWWWwwwwwwo..............',
    '......oWWWWwwwwwwo..............',
    '......oWWWWWwwwwwo..............',
    '......oWWWWWwwwwwwo.............',
    '......oWWWWWwwwwwwo.............',
    '......oWWWWWwwwwwwwo............',
    '......oWWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwwo...........',
    '.......oWWWWWwwwwwwwo...........',
    '..oo...oWWWWWWwwwwwwo..ooo......',
    '.oggoooowwwwwwwwwwwwwooccco.....',
    '.oggwwwwwwwwwwwwwwwwooccccco....',
    '.oggwwwwwwwwwwwwwwwwwcccecccoo..',
    '.oggwwwwwwwwwwwwwwwwwccccccyyyo.',
    '.oggwwwwwwwwwwwwwwwwwccccccyyo..',
    '.oggwwWWWWWWWWWWWWWWoocceccoo...',
    '.oggooooWWWWWWWWWWwwwooccco.....',
    '..oo...oWWWWWWwwwwwwo..ooo......',
    '.......oWWWWWwwwwwwwo...........',
    '.......oWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwo............',
    '......oWWWWWwwwwwwwo............',
    '......oWWWWWwwwwwwo.............',
    '......oWWWWWwwwwwwo.............',
    '......oWWWWWwwwwwo..............',
    '......oWWWWwwwwwwo..............',
    '......oWWWWwwwwwwo..............',
    '.....oWWWWWwwwwwo...............',
    '.....oWWWWWwwwwwo...............',
    '.....oWWWWwwwwwo................',
    '.....og.gg.gW.Wo................',
    '.....og.gg.gW.o.................',
    '.....og.gg.WW...................',
    '.....og.gg.WW...................',
    '....og.gg.gW....................',
    '.....o.oo.oo....................',
    '................................',
    '................................',
  ];
  const eagleBack = [
    '................................',
    '................................',
    '................................',
    '................................',
    '....o.oo.oo.....................',
    '...og.gg.WWo....................',
    '...og.gg.WWo....................',
    '...og.gg.gW.....................',
    '....og.gg.WW....................',
    '....oWWWWwwwwo..................',
    '....oWWWWwwwwwo.................',
    '.....oWWWWwwwwwo................',
    '.....oWWWWwwwwwo................',
    '.....oWWWWWwwwwwo...............',
    '......oWWWWwwwwwwo..............',
    '......oWWWWWwwwwwo..............',
    '......oWWWWWwwwwwwo.............',
    '.......oWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwo............',
    '..oo...oWWWWWWwwwwwwo..ooo......',
    '.oggoooowwwwwwwwwwwwwooccco.....',
    '.oggwwwwwwwwwwwwwwwwooccccco....',
    '.oggwwwwwwwwwwwwwwwwwcccecccoo..',
    '.oggwwwwwwwwwwwwwwwwwccccccyyyo.',
    '.oggwwwwwwwwwwwwwwwwwccccccyyo..',
    '.oggwwWWWWWWWWWWWWWWoocceccoo...',
    '.oggooooWWWWWWWWWWwwwooccco.....',
    '..oo...oWWWWWWwwwwwwo..ooo......',
    '.......oWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwo............',
    '......oWWWWWwwwwwwo.............',
    '......oWWWWWwwwwwo..............',
    '......oWWWWwwwwwwo..............',
    '.....oWWWWWwwwwwo...............',
    '.....oWWWWwwwwwo................',
    '.....oWWWWwwwwwo................',
    '....oWWWWwwwwwo.................',
    '....oWWWWwwwwo..................',
    '....og.gg.WW....................',
    '...og.gg.gW.....................',
    '...og.gg.WWo....................',
    '...og.gg.WWo....................',
    '....o.oo.oo.....................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ];

  // Team armour as a pure palette swap: the torso band - the rows the head
  // sits in, which hold still across the flap frames (only the wings move) -
  // is re-lettered to plate (P/p) and helm (H) and baked in team colour.
  // Armour only recolours pixels the bird already has, so the silhouette is
  // untouched and the plating follows the body's contours exactly.
  const armorize = (grid) => grid.map((row) => row.includes('c')
    ? row.replace(/w/g, 'P').replace(/W/g, 'p').replace(/c/g, 'H')
    : row);
  const eagleTeamPal = (t) => Object.assign({}, EGPAL, { P: t.coatL, p: t.coatD, H: t.mark });
  // an all-white body for the downed bird's hit flash (it is taller than the
  // 64x64 drawSpriteFlash scratch, so it gets a baked silhouette instead)
  const EGFLASH = Object.keys(EGPAL).reduce((o, k) => (o[k] = k === '.' ? null : '#f4f7ff', o), {});

  Object.assign(SPRITES, {
    eagle: [bake(eagleSpread, EGPAL), bake(eagleMid, EGPAL), bake(eagleBack, EGPAL)],
    // eagleTeam[team] - the same three flap frames in that team's armour
    eagleTeam: TEAM_SKINS.map((t) => [bake(armorize(eagleSpread), eagleTeamPal(t)),
      bake(armorize(eagleMid), eagleTeamPal(t)), bake(armorize(eagleBack), eagleTeamPal(t))]),
    eagleFlash: bake(eagleBack, EGFLASH), // the downed pose, all white, for the hit flash
    eagleShadow: bake(eagleSpread, EGSHADOW),
  });
})();
