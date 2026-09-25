'use strict';
// The rocks: three rarities, each with its own silhouette so the kind reads
// by SHAPE before colour (the colour-blind palettes change the ink, never the
// outline) - STONE is a pair of leaning slabs, a FROSTGLASS SPIRE is ice
// prisms thrust up through the slabs, a SUNSTONE is a black obelisk seamed
// with amber and ringed with amber shards. Look B of
// docs/media/concepts/rock-concepts-1.png (A boulders, B standing crags,
// C strata ledge). Every rock is two tiles wide (OBJECTS.rock's w, js/world.js)
// and drawn from its anchor, the footprint's west tile, feet on the tile's
// bottom edge. The grids came off the concept generator (faceted stone lit
// from the upper left, the sun's side) and are kept here verbatim.
//
// Each kind has three more things baked beside it:
//   rockSpent[k]  - the rubble it leaves while it regrows (ROCK_KINDS, js/mining.js)
//   rockCracks[k] - three overlays the mining channel draws in stages
//   rockGlints[k] - the pixels a glint may flash on (the crystal's and the
//                   amber's brightest), which the draw pass picks among
(() => {
  const { bake } = SPR;
  const RKPAL = {
    '.': null,
    'o': '#3a3f52', // outline
    'V': '#4e5266', 'v': '#666d84', 'y': '#8b93a8', 'Y': '#a8b0c4', 'L': '#c4cad8', // stone, dark to lit
    'q': '#dfe4ee', // a quartz fleck
    'W': '#ffffff', 'w': '#eef4fb', 's': '#c9dcee', // snow, and the snow in shade
    'k': '#1f3d6e', 'j': '#2f64a8', 'i': '#4f98d8', 'I': '#8fd4f4', 'J': '#e6fbff', // frostglass: outline, dark to glint
    'm': '#5c2c0c', 'n': '#9a4e16', 'a': '#d8862a', 'A': '#f4bc44', 'N': '#fff1b0', // sunstone: outline, dark to hot
    'b': '#2a2c3a', 'B': '#3d4052', // the obelisk's black stone
  };
  // COMMON: 32x22
  const common = [
    '..............o.................',
    '............ooo.................',
    '..........oosso.................',
    '........oosssso.................',
    '.......owwwssso.................',
    '.....oowwwwssso............o....',
    '....owwLwwwssso..........ooo....',
    '....owwwwywvvso........oosso....',
    '....oYYLyyyvvvo......oowssso....',
    '....oYYYLyyyvvo...ooowwssso.....',
    '.....oYYLyyyvvvo.owwLwwssso.....',
    '.....oYYLyyyvvvo.owYLwyssso.....',
    '.....oYYLyyyvvvo.oYYLyyvvvo.....',
    '.....oYYLyyyvvvo.oYYLyyvvvo.....',
    '.....oYYLyyyvvvooooYLyyvvvo.....',
    '.....oYYLyyooooowwwooyyvvvo.....',
    '.....oYYLyoWWWwwwwwwwoyvvo......',
    '.....oYYLyoYYYYwwvvVVoyvvo......',
    '.....oYYYLoyyyyvvvvVVoyvvo......',
    '.....ooooooovyyvvvVVoooooo......',
    '.....sssssssoooooooossssss......',
    '............ssssssss............',
  ];
  const commonSpent = [
    '.......ooo...........o..........',
    '.....oowwwoo......ooowoooo......',
    '....oWWwwsso.....oWWWWwwwo......',
    '...oyyyywsso.ooo.oWWWyyyyVoo....',
    '..oyyyyyvVVVoWWwooYyyyyyyVVVo...',
    '..sooyyvvVVoWWwwvvoyvvvvvvVoo...',
    '...ssooooooooyvvvVoooooooooss...',
    '.....sssssssoooooosssssssss.....',
    '............ssssss..............',
  ];
  // RARE: 32x27
  const rare = [
    '.................kk.............',
    '................kJik............',
    '...............kJJik............',
    '...............kJJijk...........',
    '..............kIJiijk...........',
    '..............kIJiijk...........',
    '..............kIJiijk...........',
    '..............kIJiijk...........',
    '..............kIJiijk....kk.....',
    '...........o..kIJiijk...kJik....',
    '.........ooo..kIJiijk..kJijk....',
    '.......oosso..kIJiijk.kIJijk....',
    '......owssso..kIJiijk.kIJijk....',
    '....oowwsskk..kIJijjk.kJiijk....',
    '...owwLwwskik.kIiijjk.kJiijk....',
    '...owYLwykJik.kIJijjk.kJijjk....',
    '...oYYLyykJijkkIJijjkkIJijk.....',
    '....oYLyykIijkkIJijjkkIJijk.....',
    '....oYYyykIijkkIiijjkkIJijk.....',
    '....oYLyykJijkkIiijjkkJiioo.....',
    '....oYLyykJijkkJiijjkkJoowwoo...',
    '....oYYLykJijkkJiijjkkoWwwwwwo..',
    '....oYYLykJiikkJiijjkoLWwwwwVo..',
    '....oYYLykIJikkJiijjoyyyyyyVVVo.',
    '....oooookkkkkkkkkkkkoooooooooo.',
    '....sssssssssssssssssssssssssss.',
    '................................',
  ];
  const rareSpent = [
    '......................o.........',
    '....ooooooookk......ooWooo......',
    '...oWWWwwwsskk..ooooWWwwwwo.....',
    '...oLLWwwwVkJjkooyYYYYwwwVVo....',
    '...oyyvvvVVkkkkwwoyyYYYVVkko....',
    '...sovvvvVVooWwwvVoyyyVVVkk.....',
    '....soooooooyyvvvoooooookkkk....',
    '.....sssssssooooooosssssssss....',
    '............sssssss.............',
  ];
  // LEGENDARY: 32x34
  const legendary = [
    '...............oo...............',
    '..............oyBo..............',
    '.............oyyBBo.............',
    '............oyyyBBbo............',
    '............oyyyBBbo............',
    '...........oyyyyBBbbo...........',
    '..........oBAByBBBbbbo..........',
    '..........oBaAyBBBbbbo..........',
    '..........oBaayBBBbbbo..........',
    '..........oBBayBBBbbbo..........',
    '..........oBBaABBBbbbo..........',
    '..........oBBBaBBBbbbo..........',
    '..........oBBBaBBBbbbo..........',
    '..........oBBBaBBNbbbo..........',
    '..........oBBBaABabbbo..........',
    '..........oBBByaNabbbo..........',
    '..........oBBByaaBbbbo..........',
    '..........oBBByaaBbbbo..........',
    '..........oBBBBaABbbbo..........',
    '..........oBBByaaBbbbo.....mm...',
    '..........oBBBNaaBbbbo....mNm...',
    '...mm.....oBBBaaaAbbbo...mNam...',
    '...mNm....oBBBaBaabbbo...maanm..',
    '...mNam...oBBNaBBaAbbo..mNaam...',
    '...mNanm..oBBaaBBBabbo..mNanm...',
    '...mNanm..oBBaBBBBaAbo..mAanm...',
    '...mAanm..oBBByBBBaabo..mNanm...',
    '...mANamooooooooooooooomANam....',
    '....mNanmyyWWWWwwwwwwbbmNanm....',
    '....mNanmBBBBBBBBBBBBbbmNanm....',
    '....mNanmBBBBBBBBBBbbbbmaanm....',
    '....mmmmmmoooooooooooommmmmm....',
    '....ssssssssssssssssssssssss....',
    '................................',
  ];
  const legendarySpent = [
    '......ooo............o..........',
    '....ooWwwoo.mm....oooWoo........',
    '....oWWYwwwomm...oWWWWwwoooo....',
    '....oWyYwyymNnm.oWYWWyyyysVo....',
    '....oyyyvvVmmmmooooYWyyyVmmo....',
    '...oyyvvvvVoYYwywvoyvvvvVmmo....',
    '...oooooooooyyvvVVoooooommmm....',
    '...sssssssssoooooossssssssss....',
    '............ssssss..............',
  ];

  // A crack is a walk down the rock from its top: a seeded stagger that only
  // cuts what is stone or crystal (never the outline, never the snow skirt),
  // dark on stone and white on the crystal and the amber, where a fracture
  // catches the light. Stage s draws the first s thirds of the walk, so the
  // channel's cracks grow rather than swap.
  const CUT_DARK = 'VvyYLqbBwW', CUT_LIGHT = 'jiIJnaAN';
  function cracks(rows, seed) {
    let r = seed >>> 0;
    const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
    const H = rows.length, W = rows[0].length, marks = [];
    let top = -1, lo = W, hi = -1;
    for (let y = 0; y < H && top < 0; y++) for (let x = 0; x < W; x++) if (rows[y][x] !== '.' && rows[y][x] !== 'o') { top = y; break; }
    for (const row of rows) for (let x = 0; x < W; x++) if (CUT_DARK.includes(row[x]) || CUT_LIGHT.includes(row[x])) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    // three runs from three starts across the body, each a third of the damage
    for (let n = 0; n < 3; n++) {
      let x = Math.round(lo + (hi - lo) * (0.25 + 0.25 * n + (rnd() - 0.5) * 0.15)), y = top + 1 + Math.floor(rnd() * 4);
      const run = [];
      for (let step = 0; step < H * 2 && y < H - 2; step++) {
        const c = rows[y] && rows[y][x];
        if (c && (CUT_DARK.includes(c) || CUT_LIGHT.includes(c))) run.push([x, y, CUT_LIGHT.includes(c)]);
        y += rnd() < 0.75 ? 1 : 0;
        x += rnd() < 0.3 ? -1 : rnd() < 0.45 ? 1 : 0;
      }
      marks.push(run);
    }
    return [1, 2, 3].map((s) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      for (let n = 0; n < s; n++) for (const [x, y, light] of marks[n]) { g.fillStyle = light ? '#f4fbff' : '#262a38'; g.fillRect(x, y, 1, 1); }
      return c;
    });
  }
  // the glint's sites: the brightest crystal and amber pixels, thinned to a
  // handful spread over the body (every third, from the top down)
  function glints(rows) {
    const out = [];
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === 'J' || row[x] === 'N') out.push([x, y]); });
    return out.filter((_, i) => i % 3 === 0).slice(0, 6);
  }
  const kinds = [common, rare, legendary], spent = [commonSpent, rareSpent, legendarySpent];
  Object.assign(SPRITES, {
    rock: kinds.map((g) => bake(g, RKPAL)),
    rockSpent: spent.map((g) => bake(g, RKPAL)),
    rockCracks: kinds.map((g, k) => cracks(g, 0x5eed + k * 977)),
    rockGlints: kinds.map(glints),
  });
})();
