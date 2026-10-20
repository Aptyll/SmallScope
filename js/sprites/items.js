'use strict';
// Goods and their icons: wood, the health potion, the gold piece and its
// live icon, the merchant's sack, and the axe and bow a drop shows on the snow.
(() => {
  const { bake, liveIcon } = SPR;

  // ---------------------------------------------------------------- items
  const ITPAL = {
    '.': null,
    'o': '#3c2a1e',
    'u': '#8a6142',
    'U': '#a3794f',
    'v': '#6b4a30',
    'c': '#d9ad72',
    'C': '#b9884f',
  };

  const itemWood = [
    '........',
    '..oooo..',
    '.oUUUuo.',
    'oCcuUuvo',
    'occuuvo.',
    '.ovvvo..',
    '..ooo...',
    '........',
  ];
  // THE HEALTH POTION (BUILD_ITEMS.potion, js/sim/items.js): a round red
  // flask on a short neck under a cork, 11 wide so it mirrors on one middle
  // column. Flat planes - the lit red, its shade down the right and along the
  // bottom, a lighter band where the drink meets the glass - one glint on
  // the upper left, and the dark outline every item icon wears.
  const POTPAL = {
    '.': null,
    'o': '#1c1218', // outline
    'C': '#c8945a', // cork
    'c': '#8a6142', // cork, shade
    'G': '#cfe3f0', // the empty glass of the neck
    'L': '#ff7b7b', // the drink's top
    'R': '#e0303a', // the drink
    'r': '#991a26', // the drink, shade
    'W': '#ffffff', // glint
  };
  const itemPotion = [
    '....ooo....',
    '...oCCco...',
    '...ooooo...',
    '....oGo....',
    '...oGLGo...',
    '..oLLLLLo..',
    '.oWRRRRRro.',
    '.oWRRRRRro.',
    '.oRRRRRRro.',
    '.orRRRRrro.',
    '..orrrrro..',
    '...ooooo...',
  ];

  // ---------------------------------------------------------------- gold nugget
  // The gold piece, everywhere gold is shown: the purse, a price, a sale
  // row, a lifetime total, and a piece lying on the snow. Eight frames off
  // docs/media/new_media3/gold_nugget.png, resampled from 16x16 to the 8x8
  // every other item icon is and snapped onto NUGPAL - so what changed is
  // the art, not the fit. A shine crossing the face is the loop.
  const NUGPAL = {
    '.': null,
    'q': '#5a2a01', // matrix, deepest
    'Q': '#713901', // matrix, deep
    'm': '#764f00', // matrix
    'o': '#905a01', // outline
    'M': '#aa6e03', // matrix, light
    'a': '#d48804', // gold, deep
    'e': '#e9970c', // gold, ember
    'r': '#fd9401', // gold, orange
    'A': '#faaa09', // gold, amber
    'h': '#fcba06', // gold, warm
    'g': '#feca05', // gold
    'y': '#f9f623', // gold, bright
    'l': '#fbfab7', // shine
    'w': '#fefefc', // shine, hottest
  };

  const nugget = [
    [
      '...oo...',
      '...hlA..',
      '..Agygh.',
      '.agggggh',
      'MaAhMMaM',
      'omQmmmM.',
      '.mQQmM..',
      '........',
    ],
    [
      '...oo...',
      '...hgh..',
      '..Aggyh.',
      '.agggggh',
      'MaAhMMaM',
      'omQomoa.',
      '.mQQoM..',
      '........',
    ],
    [
      '...yl...',
      '...lwl..',
      '..ywwwy.',
      '.Ayyyyyg',
      'aegyMMAa',
      'omQomoa.',
      '.mQoMM..',
      '........',
    ],
    [
      '...ee...',
      '...lly..',
      '..yylly.',
      '.Ayyyyyg',
      'aegyMMAa',
      'MoooMoa.',
      '.mQoMa..',
      '........',
    ],
    [
      '...oo...',
      '...hgA..',
      '..Agggh.',
      '.agggggA',
      'MaAhMMaM',
      'omQmomM.',
      '.mQooM..',
      '........',
    ],
    [
      '...oo...',
      '...hgA..',
      '..Agggh.',
      '.agggggA',
      'MaAhMMaM',
      'omQmmmM.',
      '.mQoMM..',
      '........',
    ],
    [
      '...oo...',
      '...hyg..',
      '..Aggyg.',
      '.agggggg',
      'MaAhMMaM',
      'omQmmmM.',
      '.mQQoM..',
      '........',
    ],
    [
      '...oo...',
      '...hll..',
      '..Agyyh.',
      '.agggggh',
      'MaAhMMaM',
      'omQmmmM.',
      '.mQQmM..',
      '........',
    ]
  ];

  // ---------------------------------------------------------------- gold sack
  // The merchant's mark, and GOLD's figure on the wiki's world page: a
  // cinched sack with the hoard glowing in its neck. Ten frames off docs/media/new_media3/bag_of_gold_bouncing.png,
  // resampled from 32x32 to 16x16 and snapped
  // onto SACKPAL - the cloth barely moves and the coin does, so the loop
  // reads as gold catching the light rather than as a bag being jostled.
  const SACKPAL = {
    '.': null,
    'o': '#040102', // outline
    'q': '#402521', // cloth, deepest
    'k': '#613411', // cord, deep
    'd': '#624235', // cloth, shade
    'c': '#72503b', // cloth
    't': '#947436', // cord
    'C': '#9d7752', // cloth, light
    'n': '#ab865f', // cloth, highlight
    'e': '#d98717', // coin, deep
    'a': '#f8b91c', // coin, amber
    'y': '#fbe523', // coin, gold
    'l': '#fdfa9b', // shine
  };

  const sack = [
    [
      '................',
      '....o.qqqoo.....',
      '...oqodqqoqo....',
      '....qddcddq.....',
      '....qqoqqqcd....',
      '....oqdqqqqod...',
      '...oqqqdqqcood..',
      '...qdqcccddooq..',
      '..odcctnecddo...',
      '..qcctyyyaccq...',
      '.oqccayyaeccqo..',
      '.oqdceaeetcdqo..',
      '..qqdcttcccqq...',
      '...oqddddqqo....',
      '....ooooooo.....',
      '................',
    ],
    [
      '................',
      '.......oo.......',
      '....ooddqoo.....',
      '...odqdddqdo....',
      '....odqddqqo....',
      '....qqdqqdqqc...',
      '....qooooocood..',
      '...odqccdqdo.q..',
      '..oqcdccccqqo...',
      '..occcayytcdo...',
      '.odccyyyyaccqo..',
      '.oqdceyaetcdqo..',
      '.oqqctttttcqqo..',
      '..oqqccccdqqo...',
      '...ooqqqqqoo....',
      '................',
    ],
    [
      '................',
      '.......oo.......',
      '....ooddqoo.....',
      '...odqdddqdo....',
      '....odqddqqo....',
      '....qqdqqdqdq...',
      '....qooooocoqq..',
      '...odqccdqdood..',
      '..oqcdccccqqo...',
      '..occcayytcdo...',
      '.odccnyyyaccqo..',
      '.oqccayaeaccqo..',
      '.oqdctaetccqqo..',
      '..oqdcccccdqo...',
      '...ooqqqqqoo....',
      '................',
    ],
    [
      '................',
      '....o.qqqoo.....',
      '...oqodqqoqo....',
      '....qddcddq.....',
      '....qqoqqqqo....',
      '....oqdqqdqdq...',
      '...oqqqdqocoqq..',
      '...qdqcccddood..',
      '..odcctnecqqo...',
      '..qcctyyyaccq...',
      '.oqccayyaeccqo..',
      '.oqdceaeetcdqo..',
      '..qqdcttcccqq...',
      '...oqddddqqo....',
      '....ooooooo.....',
      '................',
    ],
    [
      '................',
      '....o.qqqoo.....',
      '...oqodqqoqo....',
      '....qddcddq.....',
      '....qqoqqqcd....',
      '....oqdqqqqod...',
      '...oqqqdqqcood..',
      '...qdqcccddooq..',
      '..odcctnecddo...',
      '..qcctyyyaccq...',
      '.oqccayyaeccqo..',
      '.oqdceaeetcdqo..',
      '..qqdcttcccqq...',
      '...oqddddqqo....',
      '....ooooooo.....',
      '................',
    ],
    [
      '................',
      '....o.qqqoo.....',
      '...oqodqqoqo....',
      '....qddcddq.....',
      '....qqoqqqcd....',
      '....oqdqqqqod...',
      '...oqqqdqqcood..',
      '...qdqcccddooq..',
      '..odcctnecddo...',
      '..qcctyyyaccq...',
      '.oqccayyaeccqo..',
      '.oqdceaeetcdqo..',
      '..qqdcttcccqq...',
      '...oqddddqqo....',
      '....ooooooo.....',
      '................',
    ],
    [
      '................',
      '....o.qqqoo.....',
      '...oqodqqoqo....',
      '....qddcddq.....',
      '....qqoqqqcd....',
      '....oqdqqqqod...',
      '...oqqqqqqdood..',
      '...qdqcccddooq..',
      '..odcctnecddo...',
      '..qcctyyyaccq...',
      '.oqccayyaecdqo..',
      '.oqdceaeetcdqo..',
      '..qqdcttcccqq...',
      '...oqddddqqo....',
      '....ooooooo.....',
      '................',
    ],
    [
      '................',
      '.......oo.......',
      '....ooddqoo.....',
      '...odqdddqdo....',
      '....odqddqqo....',
      '....qqdqqdqdq...',
      '....qooooocoqq..',
      '...odqcccqdood..',
      '..oqcdccccqqo...',
      '..qcccayytccq...',
      '.oqctnyyyacdqo..',
      '.oqdceyaettdqo..',
      '..qqdtaettcqq...',
      '...oqdkcdqqo....',
      '....ooooooo.....',
      '................',
    ],
    [
      '................',
      '.......oo.......',
      '....oodqqoo.....',
      '...odqdddqdo....',
      '....oqqqqqqo....',
      '....qcndcdqdq...',
      '....qooooocoqq..',
      '...qdqcccqdood..',
      '..oqcdccccqqo...',
      '..qcctayytccq...',
      '.oqccyyyyacdqo..',
      '.oqdceyaeecdqo..',
      '..qqdtaettcqq...',
      '...oqdqkdqqo....',
      '....ooooooo.....',
      '................',
    ],
    [
      '................',
      '....o.qqqoo.....',
      '...oqodqqoqo....',
      '....qddcddq.....',
      '....qqoqqqcd....',
      '....oqdqqqqod...',
      '...oqqqdqqcood..',
      '...qdqcccddooq..',
      '..odcctnecddo...',
      '..qcctyyyaccq...',
      '.oqccayyaeccqo..',
      '.oqdceaeetcdqo..',
      '..qqdcttcccqq...',
      '...oqddddqqo....',
      '....ooooooo.....',
      '................',
    ]
  ];

  // ---------------------------------------------------------------- axe icon
  const AXPAL = {
    '.': null,
    'o': '#3c2a1e',
    'u': '#8a6142',
    'U': '#a3794f',
    'y': '#8b93a8',
    'Y': '#c4ccdd',
  };
  const itemAxe = [
    '........',
    '..oooo..',
    '.oYYyo..',
    '.oYyyoo.',
    '..oyouo.',
    '...ouUo.',
    '..ouUo..',
    '..oo....',
  ];

  // the bow tool icon, same palette as the axe (y/Y double as string/steel)
  const itemBow = [
    '...ou...',
    '..ou.y..',
    '.oU..y..',
    '.oU..y..',
    '.oU..y..',
    '.oU..y..',
    '..ou.y..',
    '...ou...',
  ];

  // The good that MOVES. Its frames bake like anything else; what
  // ships beside them is a blank canvas of the same size per icon, which
  // stepItemIcons (js/render.js) redraws each frame. It starts on frame 0 so
  // anything that bakes an item icon into a still panel at boot gets a
  // picture rather than a hole.
  const goldFrames = nugget.map((f) => bake(f, NUGPAL));

  Object.assign(SPRITES, {
    itemWood: bake(itemWood, ITPAL),
    // THE ANIMATED GOODS. `itemAnim[key]` is the frames; `SPRITES[key]`
    // is one LIVE canvas per icon that stepItemIcons (js/render.js) stamps the
    // current frame into, once a frame, off one clock. That indirection is the
    // point: an item icon is reached generically all over the game
    // (`SPRITES[icon]` - the purse, a price, a sale row, a tooltip), and
    // handing those reads an ARRAY would mean
    // teaching every one of them which goods are special. They are not
    // special: they are icons that happen to move.
    itemAnim: { itemGold: goldFrames },
    itemGold: liveIcon(goldFrames),
    itemPotion: bake(itemPotion, POTPAL),
    // the merchant's sack, ten frames of coin catching the light: 16x16
    goldSack: sack.map((f) => bake(f, SACKPAL)),
    itemAxe: bake(itemAxe, AXPAL),
    itemBow: bake(itemBow, AXPAL),
  });
})();
