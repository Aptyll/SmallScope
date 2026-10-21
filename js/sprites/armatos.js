'use strict';
// ------------------------------------------------------------ armatos icons
// ARMATOS's five 32x32 icons (js/sim/armatos.js): his four keys' wells on the
// strip and the tooltip, and the passive's, in the ability icons' own letters
// (AB32_PAL, js/sim/abilities.js; baked by classAbIcon from each row's `icon`).
// Made by a script that lays shapes on the 32 grid (pole, cloth, blade, rim)
// and outlines them; the grids are the source now, edited by hand.
const ARM_ICON32 = {
  verdict: [ // IRON VERDICT: the sword driven down, the crack running forward, the throw at its middle
    '......ogggo.....................',
    '......ogggo.....................',
    '......owwuo.....................',
    '......owwuo.....................',
    '......owwuo.....................',
    '......owwuo.....................',
    '....ooowwuooo...................',
    '...ogggggggggo..................',
    '...oGGGGGGGGGo..................',
    '....oooCCsooo...................',
    '......oCWso.....................',
    '......oCWso.....................',
    '......oCWso.....................',
    '......oCWso.....................',
    '......oCWso.......g.............',
    '......oCWso......gGg............',
    '......oCWso.....gG.Gg...........',
    '......oCWso....gG...Gg..........',
    '......oCWso....G..g..G..........',
    '......oCWso......gGg............',
    '......oCWso.....gG.Gg...........',
    '..b...oCCso....gG...Gg........b.',
    '.......oso.....G.....G..........',
    '........oWW...WWW...WWW...WWW...',
    '...b.....SSWWWSSSWWWSSSWWWSSSWW.',
    '...........SSS...SSS...SSS...SS.',
    '.....b..........................',
    '............b...............b...',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  hold: [ // HOLD THE LINE: the heater shield braced, a strike flashing off its face, the bash about to answer
    '................................',
    '.g.....g........................',
    '......g.........................',
    '..g.g...........................',
    '....Wg.oooooooooooooooooo.......',
    '.....WgCCCCCCCCCCCCCCCCCCo......',
    '..gg..oCsssssssgGsssssssSo......',
    '......oCsssssssgGsssssssSo......',
    '......oCsssssssgGsssssssSo.b....',
    '......oCssssssggggssssssSo.b....',
    '......oCgggggggWWgggggggSo..b...',
    '......oCGGGGGGgWWgGGGGGGSo..bB..',
    '......oCssssssggggssssssSo..bB..',
    '......oCsssssssgGsssssssSo...B..',
    '......oCsssssssgGsssssssSo...bB.',
    '......oCsssssssgGsssssssSo...bB.',
    '......oCsssssssgGsssssssSo...bB.',
    '......oCsssssssgGsssssssSo...bB.',
    '......oCsssssssgGsssssssSo...B..',
    '.......oCssssssgGssssssSo...bB..',
    '........oCsssssgGsssssSo....bB..',
    '.........oCssssgGssssSo.....b...',
    '..........oCsssgGsssSo.....b....',
    '..........oCsssgGsssSo.....b....',
    '...........oCssgGssSo...........',
    '............oCsgGsSo............',
    '.............oCssSo.............',
    '..............oCSo..............',
    '...............oo...............',
    '................................',
    '................................',
    '................................',
  ],
  march: [ // VETERAN'S MARCH: the charge as a ram's head, the speed behind it, the stun where it lands
    '................................',
    '................................',
    '................................',
    '........oooooo..................',
    '.......oCssssso.................',
    '........oCssssso................',
    '.........oCssssso...............',
    '..........oCssssso..............',
    '...........oCssssso.............',
    '.bbbbb......oCssssso............',
    '.............oCssssso...........',
    '..............oCssssso..........',
    '...bbbb........oCssssso....g...g',
    '................oCssssso........',
    '.................oCssssso....g..',
    'bbbbb.............osCCCCCo..gWg.',
    '..bbbbb...........osssssso...g..',
    '.................osssssSo.......',
    '................osssssSo........',
    '...bbbb........osssssSo....g...g',
    '..............osssssSo..........',
    '.............osssssSo...........',
    '.bbbbb......osssssSo............',
    '...........osssssSo.............',
    '..........osssssSo..............',
    '.........osssssSo...............',
    '........osssssSo................',
    '.......osssssSo.................',
    '........oooooo..................',
    '................................',
    '................................',
    '................................',
  ],
  guard: [ // THE OLD GUARD: the standard planted, its cloth flying, the rally ring round its foot
    '.............ogGo...............',
    '............oggggo..............',
    '............oggggo..............',
    '............oggggooooooooooo....',
    '.............owuppppppppppppo...',
    '.............owurrrrrrrrrrrRo...',
    '.............owurrrrrrrrrrrRo...',
    '.............owurrrgggggrrrRo...',
    '.............owurrrgGGGgrrrRo...',
    '.............owurrrgGGGgrrrRo...',
    '.............owurrrgggggrrrRo...',
    '.............owurrrrrrrrrrrRo...',
    '.............owurrrrrrrrrRoo....',
    '.............owurrrrrrrRoo......',
    '.............owurrrrrRoo........',
    '.............owurrrRoo..........',
    '.............owuoooo............',
    '.............owuo...............',
    '.............owuo...............',
    '.............owuo...............',
    '.............owuo...............',
    '.............owuo...............',
    '..........g..Gwuog..G...........',
    '.....g..G....owuo.....g..G......',
    '...G.........owuo..........g....',
    '..g..........owuo...........G...',
    '..G.........WWWWWW..........g...',
    '..g..........bbbb...........G...',
    '...G.......................g....',
    '.....g..G.............g..G......',
    '..........g..G...g..G...........',
    '................................',
  ],
  resolve: [ // LEGION'S RESOLVE: the broken standard, gold rising up its cloth
    '................................',
    '................................',
    '........o.......................',
    '.......owo......................',
    '........ouo.....................',
    '.......owo......................',
    '.......owuooooooooooooooo.......',
    '.......owupppppppppppppppo......',
    '.......owurrrrrrrrrrrrRoo..g....',
    '.......owurrrrrrrrrrrrrRo.......',
    '.......owurrrrrrrrrrrrrRo.g.....',
    '.......owurrrrrrrrrrrrrRo.......',
    '.......owurrrrrrrrrrrrrrRo..g...',
    '.......owurrrrrrrrrrrrrrRo......',
    '....g..owurrrrrrrrrrrrrrRo......',
    '.......owuggggggggggggggGo......',
    '.......owuggggggggggggggGo......',
    '.......owugggggggggggggGo..g....',
    '...g...owugggggggggggggGo.......',
    '.......owugggggggggggggGo.......',
    '.......owuggggggggggggoo........',
    '.......owuggggogggogggGo........',
    '.......owuoooo.ooo.oooo.........',
    '.......owuo.....................',
    '.......owuo.....................',
    '.......owuo.....................',
    '.......owuo.....................',
    '.......owuo.....................',
    '.......owuo.....................',
    '........oo......................',
    '................................',
    '................................',
  ],
};

// ------------------------------------------------------------ armatos bodies
// ARMATOS's own 16 px body in each of his looks (ARM_SKINS): the standing
// frame for each facing, hand-drawn in the player letters plus his own (n dark
// iron, y/Y gold, w/W the beard), the walk's two frames lifted off it
// (heroWalk), and the run, held run and roll baked off a doll of the same body
// (app/bake-player/, `standard` and `oath` in js/baked/motion.js).
// characters.js bakes a look in any team's paint (heroSkinSet); the coat
// letters r/R/d stay the side's.
const ARM_BODY = {
  standard: {
    down: [
      '................',
      '.....oooooo.....',
      '....otTTTTto....',
      '....otTTTtto....',
      '....onyyyyno....',
      '....oketteko....',
      '....owkttkwo....',
      '....owwwwwwo....',
      '...omtwwwwtmo...',
      '...otrwwwwrto...',
      '...omrrwwrrmo...',
      '...otrrRRrrto...',
      '....oddyyddo....',
      '.....pp..pp.....',
      '.....bb..bb.....',
      '.....BB..BB.....',
    ],
    up: [
      '................',
      '.....oooooo.....',
      '....otTTTTto....',
      '....otTTTtto....',
      '....onyyyyno....',
      '....otttttto....',
      '....onnnnnno....',
      '...omttmmttmo...',
      '...otrrrrrrto...',
      '...omrrRRrrmo...',
      '...omrrRRrrmo...',
      '...otrrrrrrto...',
      '....oddyyddo....',
      '.....pp..pp.....',
      '.....bb..bb.....',
      '.....BB..BB.....',
    ],
    side: [
      '................',
      '.....oooooo.....',
      '....otTTTTto....',
      '....otTTTTTo....',
      '....onnyyyyo....',
      '....otttkeyo....',
      '....otttkkwo....',
      '....omtwwwwwo...',
      '...omttrwwwo....',
      '....otrrRRro....',
      '....omrrRRro....',
      '....otrrrrto....',
      '....oddyyddo....',
      '......pp.pp.....',
      '......bb.bb.....',
      '......BB.BB.....',
    ],
  },
  oath: {
    down: [
      '................',
      '.....oooooo.....',
      '....onttTTno....',
      '....ontTTTno....',
      '....onnyynno....',
      '....oeeyyeeo....',
      '....onnyynno....',
      '..oooonnnnoooo..',
      '..oTTtommotTTo..',
      '..ontomrromtno..',
      '...odmrRRrmdo...',
      '...odtrRRrtdo...',
      '...odoyyyyodo...',
      '....odp..pdo....',
      '.....nn..nn.....',
      '.....MM..MM.....',
    ],
    up: [
      '................',
      '.....oooooo.....',
      '....onttTTno....',
      '....ontTTTno....',
      '....onttttno....',
      '....onttttno....',
      '....onnnnnno....',
      '..oooonnnnoooo..',
      '..oTTtoddotTTo..',
      '..ontodrrdotno..',
      '...odrrRRrrdo...',
      '...odrrRRrrdo...',
      '...odrrRRrrdo...',
      '....oddddddo....',
      '.....nn..nn.....',
      '.....MM..MM.....',
    ],
    side: [
      '................',
      '.....oooooo.....',
      '....onttTTTo....',
      '....onttTTTo....',
      '....onnnnyyo....',
      '....onnneeyo....',
      '....onnnnyyo....',
      '...oooonnno.....',
      '..doTTtomro.....',
      '..dontomrRro....',
      '..ddotrrRRro....',
      '...dotrrRRro....',
      '...doodyyydo....',
      '......nn.nn.....',
      '......nn.nn.....',
      '......MM.MM.....',
    ],
  },
};
// his iron: helm, mail, gauntlets, gold and beard (and the letters the borrowed
// catch and prone frames still use: g/G visor, S steel, x/h/H the face)
const ARM_PAL = {
  o: '#2e2440', t: '#7d8699', T: '#b4bdcc', n: '#4f5668', y: '#f2cc6a', Y: '#b98a2e', k: '#fbe0c4', K: '#e2b898',
  e: '#2e2440', w: '#e6e1d6', W: '#f4f0e8', m: '#5c6478', M: '#454c5e', p: '#463c5c', b: '#6f4d38', B: '#4a3324',
  g: '#1c2232', G: '#9aa3b8', S: '#c8d8e8', x: '#f0a89a', h: '#f4f0e8', H: '#ffffff',
};
// The looks he can wear: the first is his own and free, the rest are bought
// with coins on the skins screen (js/ui/skins.js, the ARMATOS tab; the profile
// keeps the pick under `slot`). `motion` names the doll body in js/baked/motion.js.
const ARM_SKINS = [
  { id: 'standard', name: 'LAST STANDARD', rarity: 'common', price: 0, grids: ARM_BODY.standard, motion: 'standard' },
  { id: 'oath', name: 'IRON OATH', rarity: 'rare', price: 200, grids: ARM_BODY.oath, motion: 'oath' },
];
// the walk off a standing frame: down and up lift one foot then the other
// (split at the body's middle column), the side spreads the feet then closes them
function heroWalk(b) {
  const lift = (g, s) => {
    const r = g.slice(), a = r[14], c = r[15];
    if (s > 0) { r[14] = a.slice(0, 8) + c.slice(8); r[15] = c.slice(0, 8) + '........'; }
    else { r[14] = c.slice(0, 8) + a.slice(8); r[15] = '........' + c.slice(8); }
    return r;
  };
  const spread = (row) => { let o = ''; for (let x = 0; x < 16; x++) o += (x < 8 ? row[x + 1] : x > 8 ? row[x - 1] : '.') || '.'; return o; };
  const sideA = (g) => g.slice(0, 14).concat([spread(g[14]), spread(g[15])]);
  const sideB = (g) => g.slice(0, 14).concat(['.......' + g[14].slice(6, 8) + '.......', '.......' + g[15].slice(6, 8) + '.......']);
  return {
    down: [b.down, lift(b.down, 1), lift(b.down, -1)],
    up: [b.up, lift(b.up, 1), lift(b.up, -1)],
    side: [b.side, sideA(b.side), sideB(b.side)],
  };
}
// The run and the held run seen side-on, off the hero's own standing side frame
// rather than the doll's (app/bake-player): the doll's side run is a head and a
// coat narrower than the hand-drawn body, so a hero shrank the moment it ran left
// or right. Here the body above the legs is the standing frame itself, bobbed in
// whole pixels by `bob` (SPR.motion's RUN_BOB / HOLD_BOB: up, the feet leave the snow
// with it; down, the hips sink over the legs), and the legs - the
// bottom rows that stand as two apart - scissor fore and aft, the near one over
// the far one. Frames come out in SPR.motion's box (the 16 px cell at BOX.x, BOX.y).
const HERO_STRIDE = [2, 1, 0, -1, -2, -1, 0, 1]; // px the near foot is ahead, a frame at a time (the far one behind by as much)
function heroRunSide(side, bob) {
  const B = SPR.motion.BOX;
  const runs = (row) => { const out = []; let x0 = -1; for (let x = 0; x <= 16; x++) { const on = x < 16 && row[x] !== '.'; if (on && x0 < 0) x0 = x; if (!on && x0 >= 0) { out.push([x0, x]); x0 = -1; } } return out; };
  let legTop = 16;
  while (legTop > 0 && runs(side[legTop - 1]).length >= 2) legTop--; // the rows that stand as two legs
  return HERO_STRIDE.map((step, f) => {
    const g = Array.from({ length: B.h }, () => Array(B.w).fill('.'));
    const put = (x, y, c) => { if (c !== '.' && y >= 0 && y < B.h && x >= 0 && x < B.w) g[y][x] = c; };
    for (let y = legTop; y < 16; y++) { // the legs: the far (first) one, then the near over it
      const r = runs(side[y]), deep = y === legTop && 16 - legTop > 2 ? 0.5 : 1;
      const legs = [[r[0], -1], [r[r.length - 1], 1]];
      for (const [[x0, x1], sgn] of legs) for (let x = x0; x < x1; x++) put(B.x + x + Math.round(sgn * step * deep), B.y + y + Math.min(0, bob[f]), side[y][x]); // up: the whole body leaves the snow
    }
    for (let y = 0; y < legTop; y++) for (let x = 0; x < 16; x++) put(B.x + x, B.y + y + bob[f], side[y][x]); // the body, over the hips
    return g.map((r) => r.join(''));
  });
}
// ...and head-on or from behind, for a look whose doll does not match its drawn
// body (a skin row's `run: 'drawn'`): the standing frame bobbed the same way, one
// foot lifted and then the other (heroWalk's step) while the stride is out
function heroRunFront(grid, bob) {
  const B = SPR.motion.BOX, w = heroWalk({ down: grid, up: grid, side: grid }).down;
  return HERO_STRIDE.map((step, f) => {
    const src = step > 0 ? w[1] : step < 0 ? w[2] : w[0];
    const g = Array.from({ length: B.h }, () => Array(B.w).fill('.'));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const c = src[y][x], yy = B.y + y + (y < 13 ? bob[f] : Math.min(0, bob[f]));
      if (c !== '.' && yy >= 0 && yy < B.h) g[yy][B.x + x] = c;
    }
    return g.map((r) => r.join(''));
  });
}

// ------------------------------------------------------------ armatos greatsword
// The OATH GREATSWORD as he holds it (drawArmSword, js/draw/armatos.js): laid
// flat with the point left like every held blade (SPRITES.weaponHeld, js/sprites/weapons.js),
// for the side, the swing and the wind-up; and at 45 degrees with the point up
// and right, for a body facing down or up, the grip in his hands at ARM_GRIP.
const ARM_SWORD = [
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '................oo....',
  '...............oYYo...',
  '.oooooooooooooooyYo..o',
  'oeTTTTTTTTTTTTTTyYoooy',
  'WWeEEEEEEEEEEEeeyYGgGy',
  'oeeeeeeeeeeeeeeeyYoooy',
  '.oooooooooooooooyYo..o',
  '...............oYYo...',
  '................oo....',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
];
const ARM_SWORD_DIAG = [
  '........................',
  '........................',
  '...................oo...',
  '..................oTWo..',
  '.................oTEeo..',
  '................oTEeo...',
  '...............oTEeo....',
  '..............oTEeo.....',
  '.............oTEeo......',
  '............oTEeo.......',
  '...........oTEeo........',
  '..........oTEeo.........',
  '.........oTEeo..........',
  '.....o..oTEeo...........',
  '....oyooTEeo............',
  '.....oyTEeo.............',
  '......oyeo..............',
  '.....ogoYo..............',
  '....oGo.oYo.............',
  '...ogo...o..............',
  '..oyo...................',
  '...o....................',
  '........................',
  '........................',
];
const ARM_GRIP = [5, 18];   // where the hands close on the slanted grid
const ARM_SWORD_PAL = { o: '#241a12', e: '#c8d2e4', E: '#8b93a8', W: '#ffffff', T: '#eef2f8', g: '#6b4a30', G: '#a3794f', y: '#f2cc6a', Y: '#b98a2e' };
