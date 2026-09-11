'use strict';
// Goods and their icons: wood, stone, the bag, the three animated goods and
// their live icons, the merchant's sack and crate, the cards, and the axe,
// bow and pick a drop shows on the snow.
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
    'y': '#8b93a8',
    'Y': '#a8b0c4',
    'k': '#666d84',
    'O': '#3a3f52',
    'n': '#d8a850', // the bag's buckle
    'N': '#f2cc6a', // ...and its light
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
  const itemStone = [
    '........',
    '..OOO...',
    '.OYYyO..',
    'OYYyyyO.',
    'OYyyykO.',
    '.OykkO..',
    '..OOO...',
    '........',
  ];
  // The berry and the fish are LOOPS rather than stamps, and the only item
  // icons that are: a berry cluster with a sparkle crossing its stalks
  // (docs/media/new_media3/berries.png, ten frames) and a fish whose fins
  // work (fish.png, eight), each a 16x16 strip resampled to the 8x8 every
  // other item icon is and snapped onto its own palette. They are exposed
  // the way the gold piece is - one LIVE canvas per icon that stepItemIcons
  // (js/render.js) stamps the frame into - so `SPRITES[ITEMS[type].icon]`
  // stays one generic read everywhere in the game.
  const BERPAL = {
    '.': null,
    'o': '#120a0d', // outline
    'k': '#421101', // stalk, and the deep rim
    'd': '#711102', // berry, deepest
    'D': '#a00001', // berry, shade
    'r': '#fc0201', // berry
    'g': '#02b602', // leaf
    'G': '#1ee302', // leaf, light
    'y': '#f7ec1c', // the sparkle
    'w': '#fdfbfb', // highlight
  };

  const berry = [
    [
      'kkgk....',
      'kgggk...',
      '.og.kk..',
      '.d.kk.d.',
      'DrDkkrrd',
      'drDrrDrd',
      '.ddrrkd.',
      '...dd...',
    ],
    [
      '.kgk....',
      'kgggk...',
      '.og.kk..',
      '.d.kk.d.',
      'DrDkkrrd',
      'drDrrDrd',
      '.ddrrkd.',
      '...dd...',
    ],
    [
      '.kg.....',
      'ggggk...',
      '.okDdd..',
      '..dkdyd.',
      '.rrkdrrD',
      'krrrrdrd',
      '.ddrrkd.',
      '...dd...',
    ],
    [
      '.kkk....',
      'kgggk...',
      '.kk.kd..',
      '..drkDd.',
      '.rrdDrrD',
      'krDDrDrd',
      '.dkrrdd.',
      '...dd...',
    ],
    [
      '.kgk....',
      'kgggk...',
      '.og.kk..',
      '.d..k.d.',
      'DrDkkrrd',
      'drDrrDrd',
      '.ddrrkd.',
      '...dd...',
    ],
    [
      'kkgk....',
      'kgggk...',
      '.og.kk..',
      '.d.kk.d.',
      'DrDkkrrd',
      'drDrrDrd',
      '.ddrrkd.',
      '...dd...',
    ],
    [
      'kkgk....',
      'kgggk...',
      '.og.kk..',
      '.d.kk.d.',
      'DrDkkrrd',
      'drDrrDrd',
      '.ddrrkd.',
      '...dd...',
    ],
    [
      '.kg.....',
      'kgggk...',
      '.gg.kk..',
      '.d..k.d.',
      'Drrkkrrd',
      'DrDrrDrd',
      '.ddrrkd.',
      '...dd...',
    ],
    [
      '.kgk....',
      'kgggk...',
      '.og.kk..',
      '.d.kk.d.',
      'DrDkkrrd',
      'drDrrDrd',
      '.ddrrkd.',
      '...dd...',
    ],
    [
      'kkgk....',
      'kgggk...',
      '.og.kk..',
      '.d.kk.d.',
      'DrDkkrrd',
      'drDrrDrd',
      '.ddrrkd.',
      '...dd...',
    ]
  ];

  // The fish arrived SALMON, and the fish in this game is blue - the market's
  // fish line, its price graph, the pickup floater and RES_COLORS.fish are all
  // one cold blue, and a pink icon under a blue number reads as two different
  // goods. So the palette is HUE-SHIFTED and the grids are not: every entry
  // keeps the lightness it had (which is what carries the shading) and lands in
  // a tight band around 205 deg, the family the old hand-drawn fish and
  // RES_COLORS.fish (#7ac0e8) already lived in. Only `c` is off that rule: the
  // source told its two bellies apart by HUE at the same lightness (a peach and
  // a cream), which one hue cannot carry, so the cream is lifted to be the
  // highlight above the pale instead.
  //
  // docs/media/new_media3/fish.png is UNTOUCHED and still salmon: the shift
  // lives here, in the twelve numbers below, and a regenerated grid set would
  // need it reapplied. The grids themselves are the sheet, pixel for pixel.
  const FIPAL = {
    '.': null,
    'o': '#010000', // outline, deepest
    'd': '#21628f', // back, deep
    'b': '#387099', // back and fins
    'r': '#658cab', // tail and fin, mid
    'K': '#7a9db9', // the underside
    'k': '#69b3dc', // the stripe along the flank
    's': '#a1a9b2', // the eye
    'p': '#94c9e6', // flank, light
    'P': '#b9d9ee', // belly, pale
    'c': '#d5e1f0', // belly, highlight
  };

  const fish = [
    [
      '........',
      '....b...',
      'b..rrbb.',
      'bbbkkkrr',
      'bpPPPPsr',
      'brKKKrb.',
      '........',
      '........',
    ],
    [
      '........',
      '....b...',
      'b..rrbb.',
      'bbbkkprr',
      'bpPPPPsr',
      'brKKKKK.',
      '........',
      '........',
    ],
    [
      '........',
      '........',
      '...rrbb.',
      'rbbkkprr',
      'bpPPPsPr',
      '.rrKKKK.',
      '..b.....',
      '........',
    ],
    [
      '........',
      '....b...',
      '...brbb.',
      'bbbkkkrr',
      'bpPPPsPr',
      '.rrKKKb.',
      '........',
      '........',
    ],
    [
      '........',
      '....b...',
      'b..rrbb.',
      'bbbkkkrr',
      'bpPPPPsr',
      'brKKKrb.',
      '........',
      '........',
    ],
    [
      '........',
      '....b...',
      'b..rrbb.',
      'bbbkkprr',
      'bpPPPspr',
      'brKKKKK.',
      '........',
      '........',
    ],
    [
      '........',
      '........',
      'b..rrbb.',
      'bbbkkkrr',
      'bpPPPPPr',
      'brKKKKK.',
      '........',
      '........',
    ],
    [
      '........',
      '....b...',
      '...brbb.',
      'rbbkkkrr',
      'bpPPPPsr',
      '.rrKKrb.',
      '........',
      '........',
    ]
  ];

  // Roguelike cards: one shared silhouette (a card face with a sparkle pip),
  // five palettes - the rarity IS the card's colour, the way GEAR_MATS tints
  // one gear icon across levels instead of drawing four. 'C' carries the
  // rarity hex, 'G' is a shared white sparkle, 'o' a shared dark rim.
  const itemCard = [
    '........',
    '.oooooo.',
    '.oCCCCo.',
    '.oCCCCo.',
    '.oCGGCo.',
    '.oCGGCo.',
    '.oCCCCo.',
    '.oooooo.',
  ];
  const CARD_PAL = (hex) => ({ '.': null, 'o': '#141c30', 'C': hex, 'G': '#ffffff' });
  const CARD_PALS = {
    white: CARD_PAL('#d9dfe8'), green: CARD_PAL('#5fd18a'), blue: CARD_PAL('#4a90e2'),
    purple: CARD_PAL('#a259e6'), gold: CARD_PAL('#e8a33d'),
  };

  // The backpack's own glyph: 12x12 like a gear icon, because it sits in the
  // same 18px HUD well. Dark flap over a lighter body with a gold buckle.
  const itemBag = [
    '....oooo....',
    '...ovvvvo...',
    '..ovvvvvvo..',
    '.ovvvvvvvvo.',
    '.oovvvvvvoo.',
    '.oUUonnoUUo.',
    '.oUUoNNoUUo.',
    '.oUUUUUUUUo.',
    '.ouUUUUUUuo.',
    '.ouuuuuuuuo.',
    '..ouuuuuuo..',
    '...oooooo...',
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
  // The merchant's mark, and the face of every market notice (the `market
  // notices` banner, js/shop.js): a cinched sack with the hoard glowing in
  // its neck. Ten frames off docs/media/new_media3/bag_of_gold_bouncing.png,
  // resampled from 32x32 to the 16x16 the market plate reads at and snapped
  // onto SACKPAL - the cloth barely moves and the coin does, so the loop
  // reads as gold catching the light rather than as a bag being jostled.
  // It sits beside the hand-drawn crate on that plate and has to be as crisp
  // as one.
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

  // ------------------------------------------------------------------- crate
  // What a TURNOVER looks like: the mark on the market's `NEW STOCK` plate
  // (the `market notices` banner, js/shop.js), where the gold sack says the
  // PRICE of a thing and this says there is new stock on the counter. Authored
  // at the 16 it is drawn at rather than at 32 like the sack - it is a still
  // object with no sparkle to lose, and native pixels keep its braces crisp.
  // Lit from above: a hot top rail, an X of pale bracing over mid plank, and
  // the base rail dropping into shade.
  const CRATE_PAL = {
    '.': null,
    'o': '#2a1a08', // outline and the rails' seams
    'd': '#6b4620', // plank, in shade
    'm': '#9c7038', // plank
    'l': '#caa25c', // the bracing, and the lit base rail
    'h': '#e8c47e', // the top rail catching the light
  };
  const crate = [
    '.oooooooooooooo.',
    '.ohhhhhhhhhhhho.',
    '.ollllllllllllo.',
    '.oooooooooooooo.',
    '.olmmmmmmmmmmlo.',
    '.ommlmmmmmmlmmo.',
    '.ommmlmmmmlmmmo.',
    '.ommmmmllmmmmmo.',
    '.ommmmmllmmmmmo.',
    '.ommmlmmmmlmmmo.',
    '.ommlmmmmmmlmmo.',
    '.olmmmmmmmmmmlo.',
    '.oooooooooooooo.',
    '.ollllllllllllo.',
    '.oddddddddddddo.',
    '.oooooooooooooo.',
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

  // bow + pickaxe tool icons, same palette as the axe (y/Y double as string/steel)
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
  const itemPick = [
    '..oooo..',
    '.oYyyYo.',
    'oYouuoYo',
    '.o.uu.o.',
    '..ouuo..',
    '..ouuo..',
    '..ouuo..',
    '...oo...',
  ];

  // The three goods that MOVE. Their frames bake like anything else; what
  // ships beside them is a blank canvas of the same size per icon, which
  // stepItemIcons (js/render.js) redraws each frame. It starts on frame 0 so
  // anything that bakes an item icon into a still panel at boot (the control
  // primer) gets a picture rather than a hole.
  const goldFrames = nugget.map((f) => bake(f, NUGPAL));
  const berryFrames = berry.map((f) => bake(f, BERPAL));
  const fishFrames = fish.map((f) => bake(f, FIPAL));

  Object.assign(SPRITES, {
    itemWood: bake(itemWood, ITPAL),
    itemStone: bake(itemStone, ITPAL),
    itemBag: bake(itemBag, ITPAL),
    // THE THREE ANIMATED GOODS. `itemAnim[key]` is the frames; `SPRITES[key]`
    // is one LIVE canvas per icon that stepItemIcons (js/render.js) stamps the
    // current frame into, once a frame, off one clock. That indirection is the
    // point: an item icon is reached generically all over the game
    // (`SPRITES[ITEMS[type].icon]` - the bag, a price, a sale row, a drop on
    // the snow, a tooltip), and handing those reads an ARRAY would mean
    // teaching every one of them which three goods are special. They are not
    // special: they are icons that happen to move.
    itemAnim: { itemGold: goldFrames, itemBerry: berryFrames, itemFish: fishFrames },
    itemGold: liveIcon(goldFrames),
    itemBerry: liveIcon(berryFrames),
    itemFish: liveIcon(fishFrames),
    // the merchant's sack, ten frames of coin catching the light: 16x16, the
    // size the market plate reads at, beside the crate on the same plate
    goldSack: sack.map((f) => bake(f, SACKPAL)),
    // the same 16px stamp, but for the plate that is about STOCK not price
    crate: bake(crate, CRATE_PAL),
    itemCardWhite: bake(itemCard, CARD_PALS.white),
    itemCardGreen: bake(itemCard, CARD_PALS.green),
    itemCardBlue: bake(itemCard, CARD_PALS.blue),
    itemCardPurple: bake(itemCard, CARD_PALS.purple),
    itemCardGold: bake(itemCard, CARD_PALS.gold),
    itemAxe: bake(itemAxe, AXPAL),
    itemBow: bake(itemBow, AXPAL),
    itemPick: bake(itemPick, AXPAL),
  });
})();
