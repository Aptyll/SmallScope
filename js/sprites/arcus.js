'use strict';
// ------------------------------------------------------------ arcus icons
// ARCUS's five 32x32 icons (js/sim/arcus.js): his four keys' wells on the strip and the
// tooltip, and the passive's, in the ability icons' own letters (AB32_PAL, js/draw/abilities.js).
// Laid by a script (/mnt/project-files/arcus/icons/icons.py: shapes, then the ink outline); the grids are the source now.
const ARCUS_ICON32 = {
  waste: [ // WASTE NOTHING: two arrows standing in the snow, ready to pull up
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............o.o................',
    '............oWobo...............',
    '............oWbwo....o.o........',
    '.............obwo...oWobo.......',
    '.............owwo....oWbo.......',
    '............owwwo....oWwo.......',
    '............owwo.....owwo.......',
    '............owwo.....owwwo......',
    '............owwo.....owwwo......',
    '............owwo......owwo......',
    '............owwo......owwo......',
    '............owwo......owwo......',
    '............owwo......owwo......',
    '............owwo......owwo......',
    '............owwo......owwo......',
    '............owwo......owwo......',
    '...........owwwo......owwo......',
    '...........owwo.......owwo......',
    '...........oWwo.......owwwo.....',
    '.....ooooooWWWoooooooooWWwoooooo',
    '....oWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    '....obbbbbbCCCbbbbbbbbCCCCbbbbbb',
    '....obbbbbbCCCbbbbbbbbbCCbbbbbbb',
    '....obbbbbbbCbbbbbbbbbbbCbbbbbbb',
    '.....ooooooooooooooooooooooooooo',
    '................................',
  ],
  volley: [ // VOLLEY: five arrows loosed in a fan
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '......................ooo.......',
    '.....................oCCCo......',
    '......................oCCo......',
    '....................oowwCo......',
    '...................owwwwo.......',
    '..................owwwwo........',
    '.................owwwwo...oo....',
    '.................owwwo...oCCoo..',
    '...............oowwwo....ooCCCo.',
    '..............owwwwo..ooowwCCo..',
    '.............owwwwo.oowwwwwwCo..',
    '............owwwwooowwwwwwooo...',
    '...........owwwwoowwwwwwoo......',
    '.......o..owwwwwwwwwwwoo........',
    '......oboowwwwwwwwwooo.......o..',
    '......obbbwwwwwwoooooooooooooCo.',
    '.....obbbwwwwwwwwwwwwwwwwwwwwCCo',
    '.....oWWWbwwwwwwwwwwwwwwwwwwwCo.',
    '.....oWWwwwwwwwwoooooooooooooo..',
    '......ooowwwwwwwwwooo...........',
    '.........oowwwwwwwwwwo..........',
  ],
  twin: [ // TWIN NOCK: two arrows loosed side by side
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........................ooo...',
    '.........................oCCCo..',
    '.........................oCCCo..',
    '........................owwCCo..',
    '.......................owwwwCooo',
    '.....................oowwwwoooCC',
    '....................owwwwoo..oCC',
    '...................owwwwo...oowC',
    '.................oowwwwo...owwww',
    '................owwwwoo...owwwwo',
    '..............oowwwwo....owwwwo.',
    '.............owwwwwo...oowwwoo..',
    '............owwwwoo...owwwwwo...',
    '...........owwwwo....owwwwoo....',
    '.........oowwwwo...oowwwwo......',
    '........owwwwwo...owwwwoo.......',
    '.....ooowwwwoo..oowwwwo.........',
    '....obbbwwwo...owwwwwo..........',
    '.....owWwwo...owwwwoo...........',
    '.....oWwoo..oowwwwo.............',
    '......oo..oowwwwwo..............',
    '.........obbWwwoo...............',
    '.........owWwwo.................',
    '.........owwoo..................',
    '.........oWo....................',
  ],
  gather: [ // GATHER UP: the arrows flying back in from the snow to one point
    '................................',
    '................................',
    '................................',
    '...................o............',
    '..................oWoo..........',
    '...................oobo.........',
    '...................oWbo.........',
    '...................oWwo.........',
    '...................owwo.........',
    '...................owwo.........',
    '..................owwwo.........',
    '..................owwo..........',
    '......oo..........owwo..........',
    '.....obboo........owwo..........',
    '....oWWWbwooo....oCCCo..........',
    '.....owwwwwwwooo.oCCo...........',
    '......ooowwwwwCCoFFFo...........',
    '.........ooowwCCFFWFFoo.........',
    '............oCooFWWWFoCoo.......',
    '.............o.oFFWFFCCwwooo....',
    '................oFFFoCCwwwwwoooo',
    '...............oCCoo.oowwwwwWWWW',
    '...............oCCCo...ooowwwbbw',
    '...............owwo.......ooooww',
    '...............owwo...........oo',
    '..............owwwo.............',
    '..............owwwo.............',
    '..............owwo..............',
    '.............owwwo..............',
    '.............obwwo..............',
    '............obWwo...............',
    '.............owwo...............',
  ],
  quiver: [ // FULL QUIVER: a rain of arrows coming down on a ring in the snow
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '........o.........o.............',
    '.......oWooo.....oWooo..........',
    '........oWbwo.....oWbwo.........',
    '.........obwo......obwo.........',
    '...oooo..oWwo.ooo..oWwo.ooo.....',
    '..oWwbwo.owwooWbwo.owwwoWbwo....',
    '...oWbwo.owwwoWbwo.owwwoWbwo....',
    '....obwo..owwooWwo..owwooWwo....',
    '....owwo..owwoowwo..owwoowwo....',
    '....owwwo.owwwowwwo.owwwowwwo...',
    '....owwwo.owwwoowwo..owwoowwo...',
    '.....owwo..owwoowwo..owwoowwo...',
    '.....owwo..owwoowwo..owwoowwwo..',
    '.....owwwo.owwwowwwo.owwwowwwo..',
    '......owwo.owwwoowwo..owwoowwo..',
    '......owwo..owwoowwo..owwoowwo..',
    '......owwo..owwoowwwo.owwwowwwo.',
    '......owwwooowwCowwwooowwCowwwo.',
    '.......owwoggCCCggwwgggCCCoowwo.',
    '......oowwgggoCooowwooooCgggwwwo',
    '.....oggwwwoo.o..owwwo..oooowwwo',
    '.....ogCCCCo....oCCCCo.....oCCCo',
    '.....oggoCo......ooCo......ooCgo',
    '......ogggooooooo..oooooooogggo.',
    '.......ooggggggggoooggggggggoo..',
    '.........ooogggggggggggggooo....',
    '............ooooooooooooo.......',
  ],
};

// ------------------------------------------------------------ arcus looks
// His standing grids on ARMATOS's frame (heroWalk walks them, js/sprites/armatos.js): a wide
// felt hat with a white goose feather in its band, short brown hair and beard, a quiver on his
// back whose fletching shows over his shoulder, its strap across his side's coat. Picked from
// /mnt/project-files/arcus/round1/arcus-round1.png (C, FEATHER HAT). Both looks are these
// grids; the skin repaints the letters (its row's `pal`).
const ARCUS_BODY = {
  down: [
    '................',
    '.....oooooo.oWo.',
    '....occCCccooFo.',
    '..occccccccccoo.',
    '..ooookekkeooqo.',
    '....okkkkkkoqo..',
    '....oakKKkaoqo..',
    '...omoaaaaomqo..',
    '...omrrrrrsmo...',
    '...otrrrrsrto...',
    '...okrrrsrrko...',
    '....orrsRrro....',
    '....obyybbbo....',
    '.....pp..pp.....',
    '.....bb..bb.....',
    '.....BB..BB.....',
  ],
  up: [
    '..........o.....',
    '.....oooooWo....',
    '....occCCoFWo...',
    '..occcccoqFcco..',
    '..oooaaaoqqooo..',
    '....oaAAoqqo....',
    '....oaaAoqqo....',
    '...omaaoqqamo...',
    '...omrroqqrmo...',
    '...otroqqrrto...',
    '...okroqrRrko...',
    '....oroRRrro....',
    '....obbbbbbo....',
    '.....pp..pp.....',
    '.....bb..bb.....',
    '.....BB..BB.....',
  ],
  side: [
    '................',
    '..o..oooooo.....',
    '.oWoocCCCcoWo...',
    '.oFWcccccccccoo.',
    '..oqoooakeoooo..',
    '..oqoakkkkko....',
    '..oqoaKkkaao....',
    '..oqomooaaao....',
    '...oqrmmrrso....',
    '....ordtrsro....',
    '.....odksrro....',
    '.....orsRrro....',
    '.....obyybbo....',
    '......pp.pp.....',
    '......bb.bb.....',
    '......BB.BB.....',
  ],
};
// his felt (c, C), hair and beard (a, A), quiver (q) and strap (s), the goose feather (W, F)
const ARCUS_PAL = Object.assign({}, ARM_PAL, { a: '#5a3a24', A: '#7a5232', q: '#8a6440', Q: '#5e4128', F: '#b8b2a4', s: '#6e4a2e',
  c: '#5e4a3a', C: '#7e6650', W: '#f4f0e8' });
// The looks he can wear: the first is his own and free, the second is bought with coins on
// the skins screen (js/ui/skins.js, the ARCUS tab): a snow-white felt with a slate goose
// feather and a birch quiver. `run: 'drawn'`: his brim is not the doll's run, so his run is
// his drawn body in every facing (heroRunFront, js/sprites/armatos.js); the doll
// (app/bake-player: fletcher) rolls him in either paint.
const ARCUS_SKINS = [
  { id: 'willow', name: 'WILLOW CUTTER', rarity: 'common', price: 0, grids: ARCUS_BODY, motion: 'fletcher', run: 'drawn' },
  { id: 'snow', name: 'FIRST SNOW', rarity: 'rare', price: 200, grids: ARCUS_BODY, motion: 'fletcher', run: 'drawn',
    pal: { c: '#cfc8b8', C: '#ece6d6', W: '#5f6472', F: '#8a8f9c', q: '#d8c8a0', s: '#a89263' } },
];

// ------------------------------------------------------------ arcus longbow
// His WILLOW LONGBOW as the weapon art the HUD shows and the hands hold (SPRITES.weaponArt,
// js/sprites/weapons.js): a tall willow stave the full height of the grid, its string toward
// him and its belly toward the shot (+x), no arrow on the string at rest. At rest he carries
// its own carried art upright at his side (ARCUS_BOW_CARRY below).
WEAPON_FWD.longbow = 0;
WEAPON_GRIP.icon.longbow = [9, 5];
SPRITES.weaponArt.longbow = SPR.bake([
  '....og......', '....oGg.....', '...F.oGg....', '...F..oGg...', '...F...oGg..', '...F....oGg.',
  '...F...oGg..', '...F..oGg...', '...F.oGg....', '....oGg.....', '....og......', '............',
], { '.': null, o: '#241a12', g: '#6b4a30', G: '#a3794f', F: '#d8d2c4' });

// The same bow as he CARRIES it (arcusCarry, js/draw/arcus.js): strung and at rest it is a
// shallow D, twelve rows tall, the string toward him and the belly away, so it stands beside
// the body in every facing and never lies across his face. Drawn belly right; the hand closes
// on the stave's middle (ARCUS_BOW_GRIP).
const ARCUS_BOW_GRIP = [4, 6];
const ARCUS_BOW_CARRY = SPR.bake([
  '..Go..', '.FGo..', '.F.Go.', '.F.Go.', '.F..Go', '.F..Go',
  '.F..Go', '.F..go', '.F.go.', '.F.go.', '.Fgo..', '..go..',
], { '.': null, o: '#241a12', g: '#8a623e', G: '#a3794f', F: '#9c917c' });

// The bow as he DRAWS it (HERO_AIMED.longbow, js/draw/arcus.js): eight headings, each its
// own pixel frame, never a turned one. Per heading three steps: 0 the string straight just
// after the arrow has gone, 1 half drawn, 2 full drawn with the nock at his chest, the arrow
// on the string in both. Three are set by hand: aimed right (E), down-right (SE) and down
// (S, toward the camera, so it is foreshortened: the stave a wide shallow arc across the
// waist, its tips past the body, the arrow a few pixels of shaft and its head). The other
// five are their mirrors. ARCUS_BOW_AIM[heading][step] is { img, grip, hand }: headings
// clockwise from +x, the grip where the bow hand closes on the stave, `hand` where that fist
// is, px from the chest (out on the aim through the draw, back by the body once it has shot,
// so the fist never leaves the stave and the bow never floats off him).
const ARCUS_BOW_AIM = (() => {
  const pal = { '.': null, o: '#241a12', g: '#8a623e', G: '#a3794f', F: '#9c917c', A: '#c8a46a', h: '#2a3044' };
  const E = [[
    '......Go......', '.....FGo......', '.....F.Go.....', '.....F.Go.....', '.....F..Go....', '.....F..Go....', '.....F..Go....',
    '.....F..go....', '.....F..go....', '.....F.go.....', '.....F.go.....', '.....Fgo......', '......go......',
  ], [
    '.....FGo......', '.....F.Go.....', '....F..Go.....', '....F..Go.....', '...F....Go....', '...F....Go....', '...FAAAAGAAAAh',
    '...F....go....', '...F....go....', '....F..go.....', '....F..go.....', '.....F.go.....', '.....Fgo......',
  ], [
    '....FGo.......', '....F.Go......', '...F...Go.....', '...F...Go.....', '..F.....Go....', '..F.....Go....', '.FAAAAAAGAAh..',
    '..F.....go....', '..F.....go....', '...F...go.....', '...F...go.....', '....F.go......', '....Fgo.......',
  ]];
  const SE = [[
    '..............', '..............', '..............', '..........FGo.', '.........F.Go.', '........F.Go..', '.......F..Go..',
    '......F..Go...', '.....F..Go....', '....F..go.....', '...F.ggo......', '...ggoo.......', '...oo.........', '..............',
  ], [
    '..............', '..............', '..............', '.......FFFFGo.', '....AFF....Go.', '....FA....Go..', '....F.A...Go..',
    '...F...A.Go...', '...F....Go....', '...F...goA....', '...F.ggo..A...', '...ggoo....A..', '...oo.......h.', '..............',
  ], [
    '..............', '..............', '.......FFFGo..', '...AFFF...Go..', '...FA.....Go..', '...F.A....Go..', '...F..A..Go...',
    '..F....A.Go...', '..F.....Goo...', '..F...ggoA....', '..ggggoo..h...', '..oooo........', '..............', '..............',
  ]];
  const S = [[
    '...............', '...............', '.GFFFFFFFFFFFg.', 'oGG.........ggo', '.ooGGGGGggggoo.', '...ooooooooo...', '...............', '...............',
  ], [
    '...............', '...............', '.GFFFFFAFFFFFg.', 'oGG....A....ggo', '.ooGGGGGggggoo.', '...ooooAoooo...', '.......A.......', '.......h.......',
  ], [
    '.......A.......', '....FFFAFFF....', '.GFF...A...FFg.', 'oGG....A....ggo', '.ooGGGGGggggoo.', '...ooooAoooo...', '.......h.......', '...............',
  ]];
  // the bow hand from the chest, by step: [level, down, up] px (a diagonal takes three quarters)
  const REACH = [[7, 5, 2], [10, 5, 2], [10, 5, 2]];
  const out = [[], [], [], [], [], [], [], []];
  for (let f = 0; f < 3; f++) {
    const e = SPR.bake(E[f], pal), s = SPR.bake(S[f], pal), d = SPR.bake(SE[f], pal);
    const eg = [8, 6], sg = [7, 4], dg = [8, 8]; // the stave's middle on each grid
    const row = [
      [e, eg], [d, dg], [s, sg], [SPR.flipH(d), [d.width - 1 - dg[0], dg[1]]],
      [SPR.flipH(e), [e.width - 1 - eg[0], eg[1]]], [SPR.flipV(SPR.flipH(d)), [d.width - 1 - dg[0], d.height - 1 - dg[1]]],
      [SPR.flipV(s), [sg[0], s.height - 1 - sg[1]]], [SPR.flipV(d), [dg[0], d.height - 1 - dg[1]]],
    ];
    row.forEach(([img, grip], h) => {
      const q = h * Math.PI / 4, c = Math.round(Math.cos(q)), sn = Math.round(Math.sin(q)), k = c && sn ? 0.75 : 1;
      // the chest's middle is between two columns: a hand to the left reaches one more, so left mirrors right
      out[h][f] = { img, grip, hand: [Math.round(c * REACH[f][0] * k) - (c < 0 ? 1 : 0), Math.round(sn * REACH[f][sn > 0 ? 1 : 2] * k)] };
    });
  }
  return out;
})();

// ------------------------------------------------------------ arcus registry
// ARCUS in the hero art registry (heroArt, js/sprites/hero-art.js): the looks and
// their paint, the skins tab's 8x8 glyph and the 12x12 emblem
heroArt('arcus', {
  looks: ARCUS_SKINS, pal: ARCUS_PAL,
  glow: ['#121a06', '#20300a', '#344a10', '#4c6a18', '#6a9022'], // hunter green, spring
  glyph: ['.ww.....', '.w.ww...', '.w...w..', '.w....w.', '.w....w.', '.w...w..', '.w.ww...', '.ww.....'],
  emblem: [ // a longbow, string on the left, the belly bowed right
    '............',
    '..oooo......',
    '..oWWWoo....',
    '..oWooWWo...',
    '..oWo.oWWo..',
    '..oWo..oWo..',
    '..oWo..oWo..',
    '..oWo.oWWo..',
    '..oWooWWo...',
    '..oWWWoo....',
    '..oooo......',
    '............',
  ],
});
