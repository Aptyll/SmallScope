'use strict';
// ------------------------------------------------------------ armatos icons
// ARMATOS's five 32x32 icons (js/sim/armatos.js): his four keys' wells on the
// strip and the tooltip, and the passive's, in the ability icons' own letters
// (AB32_PAL, js/draw/abilities.js; baked by classAbIcon from each row's `icon`).
// Laid by a script in the icon rules (one bold shape inside the well's open box, under the
// rank pips and right of the key digit: `the strip icons`, js/draw/abilities.js), then the
// ink outline; the grids are the source now, edited by hand.
const ARM_ICON32 = {
  verdict: [ // IRON VERDICT: sword driven down, the rival thrown up off the line (gold chevrons)
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............ooooo..............',
    '............ogggggo.............',
    '............ogggggo.............',
    '............owwuuo..............',
    '............owwuuo.......oo.....',
    '............owwuuo......oWWo....',
    '........ooooowwuuoooooooWWBWo...',
    '.......ogggggggggggggggWWWBBWo..',
    '.......oGGGGGGGGGGGGGGWWWooBBWo.',
    '........ooooCWCsssoooWWoo..ooBWo',
    '...........oCWCssso.oWo..oo..oBo',
    '...........oCWCssso..o..oWWo..o.',
    '...........oCWCssso....oWWBWo...',
    '...........oCWCssso...oWWooBWo..',
    '...........oCWCssso..oWWo..oBWo.',
    '...........oCWCssso.oWWo....oBWo',
    '...........oCWCsssoooWo......oBo',
    '..........obCWCsssoboo........o.',
    '..........oboCCssoobo......o....',
    '.........obboCCssoobbo....oBo...',
    '.........obbooCsoobbbo...oBBBo..',
    '........obbbo.osoobbbbo..oBBBo..',
    '.....oooobbboooooobbbboooBBBBBoo',
    '....oBBBbbbbbBBBBBbbbbbBBBBBBBBB',
    '....oSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    '.....ooooooooooooooooooooooooooo',
    '................................',
  ],
  hold: [ // HOLD THE LINE: the steel heater shield braced, gold cross and rim
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '........ooooooooooooooooooooo...',
    '.......ogggggggggggggggggggggo..',
    '.......ogggggggggggggggggggggo..',
    '.......oggCCCCCCCggGGsssssgggo..',
    '.......oggCCWWCCCggGGsssssgggo..',
    '.......oggCCWCCCCggGGsssssgggo..',
    '.......oggCCCCCCCggGGsssssgggo..',
    '.......oggCCCCCCCggGGsssssgggo..',
    '.......ogggggggggggGGggggggggo..',
    '.......ogggggggggggGGggggggggo..',
    '.......oggGGGGGGGGGGGGGGGGGggo..',
    '........ogGGGGGGGGGGGGGGGGGgo...',
    '........oggCCCCCCggGGsssssggo...',
    '........oggCCCCCCggGGssssggo....',
    '.........oggCCCCCggGGssssggo....',
    '.........oggCCCCCggGGssssggo....',
    '..........oggCCCCggGGsssggo.....',
    '..........oggCCCCggGGssgggo.....',
    '...........ogggCCggGGsgggo......',
    '............ogggCggGGgggo.......',
    '.............ogggggGGggo........',
    '..............oggggGGoo.........',
    '...............ooggGGo..........',
    '.................ogoo...........',
    '..................o.............',
    '................................',
  ],
  march: [ // VETERAN'S MARCH: the shield-first charge, stun star where it lands
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............ooooooooooo........',
    '............ogggggggggggo.......',
    '............ogggggggggggo.......',
    '............ogCCCCggsssgo..o....',
    '............ogCCCCggsssgo.oFo...',
    '......ooooooogCCCCggsssgoooFo.oo',
    '.....oWWWWWWWgCCCCggsssgFFFFFoFF',
    '.....oWWWWWWWgggggggggggoFFWFFFo',
    '......oooooooggggggggggFFFWFWFFF',
    '............ogCCCCggsssgFFWFFFFF',
    '.....oooooooogCCCCggsssgooFFFFoo',
    '....oWWWWWWWoggCCCggssggoFFFFFFo',
    '....oWWWWWWWoggCCCggssggFFoFooFF',
    '.....ooooooo.ogCCCggssgooooFo.oo',
    '.............oggCCggsggo...o....',
    '.......oooooooggCCggsggo........',
    '......oWWWWWWooggCggggo.........',
    '......oWWWWWWo.ogggggo..........',
    '.......oooooo...ogggo...........',
    '................oggo............',
    '.................ogo............',
    '..................o.............',
    '................................',
    '................................',
    '................................',
  ],
  guard: [ // THE OLD GUARD: the standard planted, its ring round it
    '................................',
    '................................',
    '................................',
    '................................',
    '............ooo.................',
    '...........ogggo................',
    '..........oggggo................',
    '..........oggggooooooooooooo....',
    '...........ogggrrrrrrrrrrrrro...',
    '............owurrrrrrrrrrrrro...',
    '............owurrrrrrrrrrrro....',
    '............owurrrrrggrrrrro....',
    '............owurrrrrggrrrro.....',
    '............owurrrrrggrrrro.....',
    '............owuRRRRRRRRRRRRo....',
    '............owuRRRRRRRRRRRRo....',
    '............owuRRRRRRRRRRRRRo...',
    '............owuRRRRRRRRRRRRRo...',
    '............owuooooooooooooo....',
    '............owuo................',
    '............owuo................',
    '............owuo................',
    '............owuooooooooo........',
    '.........oooowugggggggggoooo....',
    '.......ooggggwugggggggggggggo...',
    '......oggggoowuooooooooooogggo..',
    '......ogooo.owuo..........ooggo.',
    '......oggoooowuo.........oooggo.',
    '.......oggggowuooooooooooggggo..',
    '........oogggggggggggggggggoo...',
    '..........oooooogggggoooooo.....',
    '................ooooo...........',
  ],
  resolve: [ // LEGION'S RESOLVE: the old veteran himself, helm and white beard, set jaw
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............ooooooooo.........',
    '............ooCCCCCCCCCo........',
    '...........oCCCCCsssssssoo......',
    '..........oCCCCCsssssssssso.....',
    '.........oCCCCCsssssssssssso....',
    '.........oCCCCCsssssssssssso....',
    '........oCCCCCsssssssssssssso...',
    '........oCCCCCsssssssssssssso...',
    '.......oCCCCCCsssssssssssssso...',
    '.......ogggggggggggggggggggggo..',
    '.......ogggggggggggggggggggggo..',
    '.......oGGGGGGGGGGGGGGGGGGGGGo..',
    '.......oCCCCCHHHHHHhhhhhhsssso..',
    '.......oCCCCCooooHHhhooohsssso..',
    '.......oCCCCCooooHHhhooohsssso..',
    '.......oCCCCCHHHHHHhhhhhhsssso..',
    '.......oCCCWWWWWWWbbbbbbbbssso..',
    '........oooWWWWWBBBBBBbbbbooo...',
    '..........oWWWWWWWbbbbbbbbo.....',
    '..........oWWWWWWWbbbbbbbo......',
    '...........oWWWWWWbbbbbbbo......',
    '............oWWWWWbbbbbbo.......',
    '.............oWWWWbbbbbo........',
    '..............ooWWbbboo.........',
    '................ooboo...........',
    '..................o.............',
  ],
};

// ------------------------------------------------------------ armatos bodies
// ARMATOS's own 16 px body in each of his looks (ARM_SKINS): the standing
// frame for each facing, hand-drawn in the player letters plus his own (n dark
// iron, y/Y gold, w/W the beard), the walk's two frames lifted off it
// (heroWalk), and the run, held run and roll baked off a doll of the same body
// (app/bake-player/, `standard` and `oath` in js/baked/motion.js).
// characters.js bakes a look in any team's paint (champLook); the coat
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
// (split at the body's middle column), the side spreads the feet then closes them.
// A frame is a square cell of any even size (16 px, or the larger 20): every
// column and row here is counted off the grid's own size, feet on its last rows.
// `d` is the grid's density, art px a world px (a look's `dens`): every step is d px, so a
// finer body walks the same world distance as the rest.
function heroWalk(b, d = 1) {
  const N = b.down.length, H = N >> 1, blank = '.'.repeat(N), leg = Math.round(N / 8); // a leg's width
  // one foot off the snow (s > 0 the right half's, else the left's): its bottom d rows up by d
  const lift = (g, s) => {
    const r = g.slice(), half = (row, from) => (s > 0 ? row.slice(0, H) + from.slice(H) : from.slice(0, H) + row.slice(H));
    for (let y = N - d; y < N; y++) r[y - d] = half(r[y - d], g[y]);
    for (let y = N - d; y < N; y++) r[y] = half(r[y], blank);
    return r;
  };
  const spread = (row) => { let o = ''; for (let x = 0; x < N; x++) o += (x < H - d + 1 ? row[x + d] : x > H + d - 1 ? row[x - d] : '.') || '.'; return o; };
  const close = (row) => ('.'.repeat(H - d) + row.slice(H - leg, H)).padEnd(N, '.');
  const sideA = (g) => g.slice(0, N - 2 * d).concat(g.slice(N - 2 * d).map(spread));
  const sideB = (g) => g.slice(0, N - 2 * d).concat(g.slice(N - 2 * d).map(close));
  return {
    down: [b.down, lift(b.down, 1), lift(b.down, -1)],
    up: [b.up, lift(b.up, 1), lift(b.up, -1)],
    side: [b.side, sideA(b.side), sideB(b.side)],
  };
}
// The box a hero's run frames come out in: SPR.motion's for the 16 px cell (the
// doll's frames share it), the same margins round a larger cell. Every frame is
// drawn centred on its cell with its floor on the cell's (drawPlayer).
function heroRunBox(N, d = 1) { const B = SPR.motion.BOX; return N === 16 && d === 1 ? B : { w: N + (B.w - 16) * d, h: N + (B.h - 16) * d, x: B.x * d, y: B.y * d }; }
// The run and the held run seen side-on, off the hero's own standing side frame
// rather than the doll's (app/bake-player): the doll's side run is a head and a
// coat narrower than the hand-drawn body, so a hero shrank the moment it ran left
// or right. Here the body above the legs is the standing frame itself, bobbed in
// whole pixels by `bob` (SPR.motion's RUN_BOB / HOLD_BOB: up, the feet leave the snow
// with it; down, the hips sink over the legs), and the legs - the
// bottom rows that stand as two apart - scissor fore and aft, the near one over
// the far one, a foot lifting off the snow behind the stride and as it swings through
// (THE STRIDE), the head leans a pixel into the run (HERO_LEAN), and the look's loose
// cloth (its `cloth` boxes and `hem`, heroCloth) trails a frame late. Frames come out
// in the cell's run box (heroRunBox).
const HERO_LEAN = 7 / 16; // the share of the cell, from its top, that is the head: a runner's head leads its hips by a pixel
const HERO_STRIDE = [2, 1, 0, -1, -2, -1, 0, 1]; // px the near foot is ahead, a frame at a time (the far one behind by as much)
function heroRunSide(side, bob, look, d = 1) {
  const N = side.length, B = heroRunBox(N, d);
  const runs = (row) => { const out = []; let x0 = -1; for (let x = 0; x <= N; x++) { const on = x < N && row[x] !== '.'; if (on && x0 < 0) x0 = x; if (!on && x0 >= 0) { out.push([x0, x]); x0 = -1; } } return out; };
  const legTop = heroLegTop(side); // the rows that stand as two legs
  const lean = Math.round(N * HERO_LEAN); // the head's rows, carried a pixel ahead of the hips
  return HERO_STRIDE.map((step, f) => {
    // the loose cloth (heroCloth) rides a frame late: a pixel behind as the body rises,
    // and where the body was the frame before
    const was = bob[(f + bob.length - 1) % bob.length], late = Math.max(-1, Math.min(1, was - bob[f]));
    const body = (look && (bob[f] < was || late) && heroCloth(side, look, 'side', (bob[f] < was ? -1 : 0) * d, late * d, d)) || side;
    const g = Array.from({ length: B.h }, () => Array(B.w).fill('.'));
    const put = (x, y, c) => { if (c !== '.' && y >= 0 && y < B.h && x >= 0 && x < B.w) g[y][x] = c; };
    for (let y = legTop; y < N; y++) { // the legs: the far (first) one, then the near over it
      const r = runs(side[y]), deep = y < legTop + d && N - legTop > 2 * d ? 0.5 : 1;
      const legs = [[r[0], -1], [r[r.length - 1], 1]];
      for (const [[x0, x1], sgn] of legs) {
        // THE STRIDE: at full reach the rear foot has left the snow, and as the legs pass
        // under the hips the one swinging forward is lifted (the far leg, then the near one)
        const lift = step ? (Math.abs(step) === 2 && sgn * step < 0 ? 1 : 0) : (sgn < 0) === (f < HERO_STRIDE.length / 2) ? 1 : 0;
        for (let x = x0; x < x1; x++) put(B.x + x + Math.round(sgn * step * deep) * d, B.y + y + (Math.min(0, bob[f]) - lift) * d, side[y][x]); // up: the whole body leaves the snow
      }
    }
    for (let y = 0; y < legTop; y++) for (let x = 0; x < N; x++) put(B.x + x + (y < lean ? d : 0), B.y + y + bob[f] * d, body[y][x]); // the body, over the hips, the head leaning into the run
    return g.map((r) => r.join(''));
  });
}
// ...and head-on or from behind, for a look whose doll does not match its drawn
// body (a skin row's `run: 'drawn'`): the standing frame bobbed the same way, one
// foot lifted and then the other (heroWalk's step) while the stride is out
function heroRunFront(grid, bob, d = 1) {
  const N = grid.length, B = heroRunBox(N, d), w = heroWalk({ down: grid, up: grid, side: grid }, d).down;
  return HERO_STRIDE.map((step, f) => {
    const src = step > 0 ? w[1] : step < 0 ? w[2] : w[0];
    const g = Array.from({ length: B.h }, () => Array(B.w).fill('.'));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const c = src[y][x], yy = B.y + y + (y < N - 3 * d ? bob[f] : Math.min(0, bob[f])) * d;
      if (c !== '.' && yy >= 0 && yy < B.h) g[yy][B.x + x] = c;
    }
    return g.map((r) => r.join(''));
  });
}

// the first row of the legs: the bottom rows that stand as two apart
function heroLegTop(g) {
  const two = (row) => /[^.]\.+[^.]/.test(row.replace(/^\.+|\.+$/g, ''));
  let y = g.length;
  while (y > 0 && two(g[y - 1])) y--;
  return y;
}

// ------------------------------------------------------------ idle
// THE BREATH: a standing body's second frame (drawPlayer's idle, js/draw/idle.js).
// The head and shoulders sink one pixel: a chest row above the hands goes and the rows
// over it step down, so the hands, the weapon in them and the feet hold still. The row
// that goes is the one most like a neighbour, so the drop reads as a breath and not a
// change of costume. Counted from the grid's own size (the hands sit 6 rows over the floor).
function heroBreath(g, d = 1) {
  const h = g.length, w = g[0].length, hand = h - 6 * d;
  const diff = (a, b) => { let n = 0; for (let x = 0; x < w; x++) n += a[x] !== b[x]; return n; };
  const cost = (y) => Math.min(diff(g[y], g[y - 1]), diff(g[y], g[y + 1]));
  const cut = cost(hand - 1 - d) < cost(hand - d) ? hand - 1 - d : hand - d; // the first of the d rows that go
  return Array(d).fill('.'.repeat(w)).concat(g.slice(0, cut), g.slice(cut + d));
}
// THE CLOTH: a look's loose parts (its `cloth` boxes, [x0, y0, x1, y1] on a facing's grid,
// and its `hem`, the rows of skirt over the legs) one pixel along (dx, dy) for the beat
// after a stop or a turn. A part pushed off the body grows from its seam; one pushed into
// the body tucks behind it. A hem only swings sideways.
function heroCloth(g, look, face, dx, dy, d = 1) {
  const h = g.length, w = g[0].length, boxes = [];
  for (const b of (look.cloth && look.cloth[face]) || []) boxes.push([b, dy]);
  if (look.hem && dx) { const top = heroLegTop(g); boxes.push([[0, top - look.hem * d, w - 1, top - 1], 0]); }
  if (!boxes.length) return null;
  const sway = (x, y) => { for (const [[x0, y0, x1, y1], vy] of boxes) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return vy; return null; };
  const out = g.map((r) => r.split('')), loose = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const vy = g[y][x] === '.' ? null : sway(x, y);
    if (vy !== null) { loose.push([x, y, vy]); out[y][x] = '.'; }
  }
  if (!loose.length) return null;
  const fixed = (x, y) => x >= 0 && y >= 0 && x < w && y < h && g[y][x] !== '.' && sway(x, y) === null;
  for (const [x, y, vy] of loose) {
    const tx = x + dx, ty = y + vy;
    if (tx >= 0 && ty >= 0 && tx < w && ty < h && out[ty][tx] === '.') out[ty][tx] = g[y][x];
  }
  for (const [x, y, vy] of loose) if (out[y][x] === '.' && fixed(x - dx, y - vy)) out[y][x] = g[y][x]; // the seam
  return out.map((r) => r.join(''));
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

// ------------------------------------------------------------ armatos registry
// ARMATOS in the hero art registry (heroArt, js/sprites/hero-art.js): the looks and
// their paint, the skins tab's 8x8 glyph and the 12x12 emblem
heroArt('armatos', {
  looks: ARM_SKINS, pal: ARM_PAL,
  glow: ['#1a0a10', '#3a1220', '#621a2c', '#90283a', '#c4404c'], // legion crimson to a rose core
  glyph: ['.wwww...', '.w..ww..', '.wwww...', '.w......', '.w......', '.w......', '.w......', 'www.....'],
  emblem: [ // the broken standard - the pole, the torn cloth off its head
    '..o.........',
    '.ogooooo....',
    '.oGrrrrro...',
    '.owrRRrrro..',
    '.owrrrrro...',
    '.owrrRro....',
    '.owrro.o....',
    '.owro.......',
    '.owo........',
    '.owo........',
    '.owo........',
    '..o.........',
  ],
});
