'use strict';
// The SCOUT: a player's body in the world, 16 x 24, in eight facings with a
// run cycle, dressed in the character's own hat and coat. It is LAYERS on one
// body plan, not a grid per outfit - legs, the arms, the coat, the head, the
// hat, the coat's back item - stamped as letters onto one 16 x 24 char grid
// and baked through one palette, so a hat and a coat mix freely and a new
// one is five grids (one per drawn facing), never a grid per combination.
// Looks A, B and C off docs/media/concepts/scout-concepts-1.png (the
// `concept-art` skill), every one of them, split into wearable pieces.
//
// The body plan (every layer is drawn against it): the face is the box rows
// 7-11, cols 4-11 seen from the front; the collar row 12; the torso rows
// 13-18; the legs rows 19-22 and the soles row 23. Five facings are drawn -
// S (front), SE, E (side, facing right), NE and N (back) - and the other
// three are their mirrors. A run is four frames (contact, pass, the other
// contact, pass); on a pass frame everything above the legs rides 1 px up.
//
// Letters are the game's (characters.js PPAL / looks.js MODEL_PAL) where they
// exist - o outline, e eye, k/K/x skin, h/H hair, p/P trousers, b/B boots,
// t/T the head's team ink, r/R/d the coat's, m/M the trim, g/G goggles -
// plus l/L/n leather, w wood, f feather, S/s/j fur, i/I iron, v/V wool. The
// arms are painted with u/U/z (sleeve) and q/Q (hand), which each coat maps
// onto its own letters (`sleeve`), so one set of arm shapes wears every coat.
(() => {
  const { bake, flipH, TEAM_SKINS } = SPR;

  // ---------------------------------------------------------------- palette
  const SCOUT_PAL = {
    '.': null, o: '#2e2440', e: '#2e2440', k: '#f2c69b', K: '#d69f72', x: '#e8967f',
    h: '#5c3b20', H: '#7a5230', p: '#463c5c', P: '#5a4f74', b: '#6f4d38', B: '#4a3324',
    l: '#7a5034', L: '#9c6a44', n: '#4f3322', w: '#c9a26b', f: '#ece6d8',
    S: '#d8cfc0', s: '#ab9f8e', j: '#7d7264', i: '#8c99b0', I: '#c3cad6', g: '#203a52', G: '#8fd8ff',
    v: '#6f7a5c', V: '#8f9a76',
  };
  const teamScoutPal = (t) => ({ t: t.head, T: t.headL, r: t.coat, R: t.coatL, d: t.coatD, m: t.trim, M: t.trimD });

  // a part: rows of 16 chars stamped from row y
  const P = (y, ...rows) => ({ y, rows });

  // ---------------------------------------------------------------- heads
  // the bare head per drawn facing, skull and all (a hat covers what it covers)
  const HEAD = {
    S: P(3,
      '.....oooooo.....',
      '....ohhhhhho....',
      '....ohhhhhho....',
      '....ohhhhhho....',
      '....okkkkkko....',
      '....okekkeko....',
      '....oxkKKkxo....',
      '....okkkkkko....',
      '.....okkkko.....'),
    SE: P(3,
      '.....oooooo.....',
      '....ohhhhhho....',
      '....ohhhhhho....',
      '....ohhhhhho....',
      '....ohkkkkko....',
      '....ohkekkeo....',
      '....ohxkkKxo....',
      '....ohkkkkko....',
      '.....ookkkko....'),
    E: P(3,
      '.....ooooooo....',
      '....ohhhhhhho...',
      '....ohhhhhhho...',
      '....ohhhhhhhho..',
      '....ohhhkkkkko..',
      '....ohhhkkkeko..',
      '....ohhkkkxkkko.',
      '....ohhkkkkkko..',
      '.....ohkkkkko...'),
    NE: P(3,
      '.....oooooo.....',
      '....ohhhhhho....',
      '....ohhhhhho....',
      '....ohhhhhho....',
      '....ohhhhhko....',
      '....ohhhhhko....',
      '....ohhhhkko....',
      '....ohhhhkko....',
      '.....okkkko.....'),
    N: P(3,
      '.....oooooo.....',
      '....ohhhhhho....',
      '....ohhhhhho....',
      '....ohhhhhho....',
      '....ohhhhhho....',
      '....ohhhhhho....',
      '....ohhHHhho....',
      '....ohhhhhho....',
      '.....okkkko.....'),
  };

  // ---------------------------------------------------------------- hats
  // HATS[cls][i][facing]. A facing a hat does not draw falls back: SE to S,
  // NE to N. Hunter: the pom beanie (A), the knit earflap (B), the hood (C).
  // Warrior: the fur-ruffed hood with the goggles up (A), the parka hood (B),
  // the painted helm with its crest and cheek guards (C).
  const BEANIE_S = P(0,
    '......oooo......',
    '.....ommmmo.....',
    '.....oMmmMo.....',
    '....oottttoo....',
    '...ottTTTTtto...',
    '...otttttttto...',
    '...oTTTTTTTTo...');
  const EARFLAP_N = P(1,
    '.....oooooo.....',
    '...ootTTTTtoo...',
    '..otTTTTTTTTto..',
    '..otttttttttto..',
    '.oTmTmTmmTmTmTo.',
    '.otttttttttttto.',
    '.otto......otto.',
    '.otto......otto.',
    '.otto......otto.',
    '.otto......otto.',
    '.ottoo....ootto.');
  const HATS = [[
    { // HUNTER A: POM BEANIE
      S: BEANIE_S, N: BEANIE_S,
      E: P(0,
        '.......oooo.....',
        '......ommmmo....',
        '......oMmmMo....',
        '.....oottttoo...',
        '....ottTTTTtto..',
        '....otttttttto..',
        '....oTTTTTTTTo..'),
    },
    { // HUNTER B: KNIT EARFLAP
      S: P(1,
        '.....oooooo.....',
        '...ootTTTTtoo...',
        '..otTTTTTTTTto..',
        '..otttttttttto..',
        '.oTmTmTmmTmTmTo.',
        '.otttttttttttto.',
        '.otto......otto.',
        '.otto......otto.',
        '.otto......otto.',
        '.otto......otto.',
        '.ottoo....ootto.',
        '.oomoo....oomoo.',
        '...m........m...',
        '...M........M...'),
      N: EARFLAP_N,
      E: P(1,
        '......oooooo....',
        '....ootTTTTtoo..',
        '...otTTTTTTTTo..',
        '...ottttttttto..',
        '..oTmTmTmTmTmTo.',
        '..ottttttttttto.',
        '....otttoo......',
        '....otttoo......',
        '....otttoo......',
        '....otttoo......',
        '.....otto.......',
        '......om........',
        '.......m........',
        '.......M........'),
    },
    { // HUNTER C: HOOD
      S: P(1,
        '......oooo......',
        '....oottttoo....',
        '...ottTTTTtto...',
        '..ottTTTTTTtto..',
        '..otttttttttto..',
        '..otooooooooto..',
        '..otoKKKKKKoto..',
        '..oto......oto..',
        '..oto......oto..',
        '..oto......oto..',
        '..otto....otto..',
        '.ottttooootttto.'),
      N: P(1,
        '......oooo......',
        '....oottttoo....',
        '...ottTTTTtto...',
        '..ottTTTTTTtto..',
        '..otttttttttto..',
        '..otttttttttto..',
        '..otttTTTTttto..',
        '..otttttttttto..',
        '..otttttttttto..',
        '..otttttttttto..',
        '..otttttttttto..',
        '.otttttttttttto.'),
      E: P(1,
        '......oooo......',
        '....oottttoo....',
        '...ottTTTTTto...',
        '..ottTTTTTTtto..',
        '..ottttttttttto.',
        '.ottttttoooooto.',
        '.otttttoKKKKKo..',
        '.ottttto........',
        '.ottttto........',
        '.ottttto........',
        '..otttto........',
        '.otttttttoooo...'),
    },
  ], [
    { // WARRIOR A: FUR HOOD
      S: P(1,
        '.....oooooo.....',
        '...oottttttoo...',
        '..ottTTTTTTtto..',
        '.ottgGGggGGgtto.',
        '.otSSSSSSSSSSto.',
        '.oSSooooooooSSo.',
        '.oSSo......oSSo.',
        '.oSso......osSo.',
        '.oSso......osSo.',
        '.oSSo......oSSo.',
        '..oSSo....oSSo..',
        '.oSSSSooooSSSSo.'),
      N: P(1,
        '.....oooooo.....',
        '...oottttttoo...',
        '..ottTTTTTTtto..',
        '.otttTTTTTTttto.',
        '.otggggggggggto.',
        '.oSttttttttttSo.',
        '.oSttttttttttSo.',
        '.oStttTTTTtttSo.',
        '.oSttttttttttSo.',
        '.oSSttttttttSSo.',
        '..oSSttttttSSo..',
        '.oSSSSttttSSSSo.'),
      E: P(1,
        '.....oooooo.....',
        '...oottttttoo...',
        '..ottttttTTTto..',
        '.ottttttgGGGgo..',
        '.otttttSSSSSSSo.',
        '.otttttSoooooSo.',
        '.ottttSo.....So.',
        '.ottttSo........',
        '.ottttSo........',
        '.ottttSo........',
        '..otttSSo.......',
        '.ossSSSSSSSSSo..'),
    },
    { // WARRIOR B: PARKA HOOD
      S: P(1,
        '....oooooooo....',
        '..oottTTTTttoo..',
        '.ottTTTTTTTTtto.',
        'ottgGGggggGGgtto',
        'otSSSSSSSSSSSSto',
        'otSSooooooooSSto',
        'otSSo......oSSto',
        'otSso......osSto',
        'otSso......osSto',
        'otSSo......oSSto',
        'ottSSo....oSStto',
        'otSSSSooooSSSSto',
        '.....SSSSSS.....'),
      N: P(1,
        '....oooddooo....',
        '..oottTddTttoo..',
        '.ottTTTddTTTtto.',
        'otggggggggggggto',
        'oSttttTddTttttSo',
        'oSttttTddTttttSo',
        'oSttttTddTttttSo',
        'oSStttTddTtttSSo',
        'oSStttTddTtttSSo',
        '.oSSttTddTttSSo.',
        'ooSSSttddttSSSoo'),
      E: P(1,
        '....oooooo......',
        '..oottTTTTo.....',
        '.ottTTTTTTTo....',
        'ottttttgGGGGgo..',
        'otttttSSSSSSSSo.',
        'otttttSoooooSSo.',
        'otttttSo.....So.',
        'otttttSo.....So.',
        'otttttSo......So',
        'otttttSo.....So.',
        'ottttttSSo...So.',
        'otttttttSSSSSo..'),
    },
    { // WARRIOR C: CRESTED HELM
      S: P(0,
        '.......oo.......',
        '......ommo......',
        '......oMMo......',
        '....ooommooo....',
        '...ottTmmTtto...',
        '...otttttttto...',
        '...oiiiiiiiio...',
        '..oio......oio..',
        '..oio......oio..',
        '..oio......oio..',
        '..oio......oio..',
        '...oooo..oooo...'),
      N: P(0,
        '.......oo.......',
        '......ommo......',
        '......oMMo......',
        '....ooommooo....',
        '...ottTmmTtto...',
        '...otttmmttto...',
        '...oiiiiiiiio...',
        '..oio......oio..',
        '..oio......oio..',
        '..oio......oio..',
        '..oio......oio..',
        '...oooo..oooo...'),
      E: P(1,
        '..ooooo.........',
        '.ommmmMoo.......',
        '..ooMMmmmoo.....',
        '....ottTmmTto...',
        '....otttttttto..',
        '....oiiiiiiiio..',
        '....oiito.......',
        '....oiito.......',
        '....oiito.......',
        '....oiito.......',
        '.....oooo.......'),
    },
  ]];

  // ---------------------------------------------------------------- coats
  // COATS[cls][i]: `sleeve` maps the arms' letters onto this coat's, and per
  // drawn facing `under` (the coat itself, under the arms), `over` (what
  // lies over the arms: a mantle, a cape, a pauldron) and `back` (the item
  // slung on the back: under the body from the side, over it from behind).
  const COAT_N_PLAIN = P(12,
    '...ommmmmmmmo...',
    '....orrrrrro....',
    '....odrrrrdo....',
    '....odrrrrdo....',
    '....odlllldo....',
    '....odrrrrdo....',
    '....oddddddo....');
  const COATS = [[
    { // HUNTER A: SCARF COAT, and the quiver
      sleeve: { u: 'r', U: 'R', z: 'd', q: 'm', Q: 'M' },
      S: { under: P(12,
        '...ommmmmmmmo...',
        '....ormMMmro....',
        '....odrmmrdo....',
        '....odrmmrdo....',
        '....odlllldo....',
        '....odrrrrdo....',
        '....oddddddo....') },
      SE: { under: P(12,
        '...ommmmmmmmo...',
        '....orrmMMmo....',
        '....odrrmmdo....',
        '....odrrmmdo....',
        '....odlllldo....',
        '....odrrrrdo....',
        '....oddddddo....') },
      E: { under: P(12,
        '....ommmmmmmo...',
        '.....odrrrRRo...',
        '.....odrrrRRo...',
        '.....odrrrRRo...',
        '.....ollllllo...',
        '.....odrrrRro...',
        '.....oddddddo...'),
      back: P(8,
        '.oo.............',
        'offo............',
        'owfo............',
        '.onlo...........',
        '.onlo...........',
        '..onlo..........',
        '..onlo..........',
        '..onlo..........',
        '..onlo..........',
        '...oo...........') },
      N: { under: COAT_N_PLAIN,
        back: P(9,
          '...........ooo..',
          '...........offo.',
          '............ffo.',
          '............nlo.',
          '...........nlo..',
          '..........nl....',
          '.........nl.....',
          '........nl......',
          '.......nl.......') },
    },
    { // HUNTER B: PACK JACKET, and the frame pack under its bedroll
      sleeve: { u: 'r', U: 'R', z: 'd', q: 'm', Q: 'M' },
      S: { under: P(12,
        '....oommmmoo....',
        '....olrRRrlo....',
        '....olrRRrlo....',
        '....olrRRrlo....',
        '....odlllldo....',
        '....odrrrrdo....',
        '....oddddddo....') },
      SE: { under: P(12,
        '....oommmmoo....',
        '....olrrRRlo....',
        '....olrrRRlo....',
        '....olrrRRlo....',
        '....odlllldo....',
        '....odrrrrdo....',
        '....oddddddo....') },
      E: { under: P(12,
        '.....oommmmo....',
        '.....odrrrRlo...',
        '.....odrrrRlo...',
        '.....odrrrRlo...',
        '.....ollllllo...',
        '.....odrrrRro...',
        '.....oddddddo...'),
      back: P(10,
        '..oo............',
        'oVvVvo..........',
        'ovvvvo..........',
        'onLLno..........',
        'onLLno..........',
        'onllno..........',
        'onllno..........',
        'onnnno..........',
        '.oooo...........') },
      N: { under: P(12,
        '....oommmmoo....',
        '....orrrrrro....',
        '....odrrrrdo....',
        '....odrrrrdo....',
        '....odlllldo....',
        '....odrrrrdo....',
        '....oddddddo....'),
      back: P(11,
        '.oVvVvVvvVvVvVo.',
        '.ovvvvvvvvvvvvo.',
        '...onLLLLLLno...',
        '...onLLiiLLno...',
        '...onllllllno...',
        '...onlnllnlno...',
        '...onllllllno...',
        '....onnnnnno....') },
    },
    { // HUNTER C: SHORT CAPE, and the bow slung across the back
      sleeve: { u: 'r', U: 'R', z: 'd', q: 'L', Q: 'l' },
      S: { under: P(12,
        '....oottttoo....',
        '....orrRRrro....',
        '....orrRRrro....',
        '....odrRRrdo....',
        '....odlllldo....',
        '....odrrrrdo....',
        '....oddddddo....'),
      over: P(13,
        'otttTTttttTTttto',
        'otttttttttttttto',
        'ommmmmmmmmmmmmmo') },
      SE: { under: P(12,
        '....oottttoo....',
        '....orrrRRro....',
        '....orrrRRro....',
        '....odrrRRdo....',
        '....odlllldo....',
        '....odrrrrdo....',
        '....oddddddo....'),
      over: P(13,
        'ottttTTttttTTtto',
        'otttttttttttttto',
        'ommmmmmmmmmmmmmo') },
      E: { under: P(12,
        '.....otttttto...',
        '.....odrrrRRo...',
        '.....odrrrRRo...',
        '.....odrrrRRo...',
        '.....ollllllo...',
        '.....odrrrRro...',
        '.....oddddddo...'),
      over: P(13,
        '..otttttTTttto..',
        '..otttttttttto..',
        '..ommmmmmmmmmo..'),
      back: P(9,
        '...o............',
        '..owo...........',
        '..owo...........',
        '..owo...........',
        '..owo...........',
        '..owo...........',
        '..owo...........',
        '..owo...........',
        '..owo...........',
        '..owo...........',
        '..owo...........',
        '..owo...........',
        '...o............') },
      N: { under: P(12,
        '....oottttoo....',
        '....orrrrrro....',
        '....odrrrrdo....',
        '....odrrrrdo....',
        '....odlllldo....',
        '....odrrrrdo....',
        '....oddddddo....'),
      over: P(13,
        'otttTTttttTTttto',
        'otttttttttttttto',
        'ommmmmmmmmmmmmmo'),
      back: P(5,
        '.o..............',
        'owo.............',
        '.ow.............',
        '..ww............',
        '...ww...........',
        '.....ww.........',
        '......ww........',
        '.......ww.......',
        '.........ww.....',
        '..........ww....',
        '...........ww...',
        '............ww..',
        '.............wwo',
        '..............wo',
        '..............o.') },
    },
  ], [
    { // WARRIOR A: FUR MANTLE
      sleeve: { u: 'l', U: 'L', z: 'n', q: 'L', Q: 'l' },
      S: { under: P(13,
        '....orrRRrro....',
        '....orrRRrro....',
        '....orrRRrro....',
        '....odrRRrdo....',
        '....ollIIllo....',
        '....oddddddo....'),
      over: P(12,
        '.oSSSSSSSSSSSSo.',
        'oSSSSSSSSSSSSSSo',
        'osssssssssssssso',
        'ojsjo......ojsjo',
        '.ojjo......ojjo.') },
      SE: { under: P(13,
        '....orrrRRro....',
        '....orrrRRro....',
        '....orrrRRro....',
        '....odrrRRdo....',
        '....olllIIlo....',
        '....oddddddo....') },
      E: { under: P(13,
        '.....odrrrRRo...',
        '.....odrrrRRo...',
        '.....odrrrRRo...',
        '.....odrrrRRo...',
        '.....ollIIllo...',
        '.....oddddddo...'),
      over: P(12,
        '.ossSSSSSSSSSSo.',
        'oSSSSSSSSSSSSSso',
        'osssssssssssssso',
        'ojsjo......ojsjo',
        '.ojjo......ojjo.') },
      N: { under: P(13,
        '....orrrrrro....',
        '....orrrrrro....',
        '....orrrrrro....',
        '....odrrrrdo....',
        '....ollllllo....',
        '....oddddddo....'),
      over: P(12,
        '.oSSSSSSSSSSSSo.',
        'oSSSSSSSSSSSSSSo',
        'osssssssssssssso',
        'ojsjo......ojsjo',
        '.ojjo......ojjo.') },
    },
    { // WARRIOR B: QUILTED PARKA
      sleeve: { u: 'r', U: 'R', z: 'd', q: 'm', Q: 'M' },
      S: { under: P(13,
        '....drrrrrrd....',
        '....drrRRrrd....',
        '....dddddddd....',
        '....drrRRrrd....',
        '....dllIIlld....',
        '....dddddddd....') },
      SE: { under: P(13,
        '....drrrrrrd....',
        '....drrrRRrd....',
        '....dddddddd....',
        '....drrrRRrd....',
        '....dlllIIld....',
        '....dddddddd....') },
      E: { under: P(13,
        '..orrrrrrRRRo...',
        '..orrrrrrRRRo...',
        '..odddddddddo...',
        '..orrrrrrRRRo...',
        '..olllllllllo...',
        '...oddddddddo...') },
      N: { under: P(12,
        '....rrrddrrr....',
        '....drrrrrrd....',
        '....dddddddd....',
        '....drrrrrrd....',
        '....dddddddd....',
        '....dlllllld....',
        '....dddddddd....') },
    },
    { // WARRIOR C: PAULDRONS & TABARD
      sleeve: { u: 'd', U: 'r', z: 'o', q: 'L', Q: 'l' },
      S: { under: P(12,
        '.....ommmmo.....',
        '....odrrrrdo....',
        '....odrRRrdo....',
        '....odrRRrdo....',
        '....odrRRrdo....',
        '....ollIIllo....',
        '....oddrrddo....',
        '.....orRRro.....',
        '.......dd.......'),
      over: P(12,
        '.oiIio....oiIio.',
        'oiIIio....oiIIio',
        'oiiiio....oiiiio',
        '.ooooo....ooooo.') },
      E: { under: P(12,
        '........ommo....',
        '.....odddrrro...',
        '.....odddRRro...',
        '.....odddRRro...',
        '.....odddRRro...',
        '.....olllIIlo...',
        '.....oddddrdo...',
        '.........oRRo...'),
      over: P(12,
        '....oiIio.......',
        '...oiIIio.......',
        '...oiiiio.......',
        '....oooo........') },
      N: { under: P(12,
        '.....oooooo.....',
        '....odrrrrdo....',
        '....odrrrrdo....',
        '....odrrrrdo....',
        '....odrrrrdo....',
        '....ollllllo....',
        '....oddrrddo....',
        '.....orrrro.....',
        '.......dd.......'),
      over: P(12,
        '.oiIio....oiIio.',
        'oiIIio....oiIIio',
        'oiiiio....oiiiio',
        '.ooooo....ooooo.') },
    },
  ]];

  // ---------------------------------------------------------------- arms
  // ARMS[cls][family][frame] = { both } or { far, near }, family F (front and
  // back), D (the diagonals) or E (the side). Frames: idle, contact, pass,
  // the other contact, pass. A hunter's arm is two px of sleeve, a
  // warrior's three. Seen from the front a swing is foreshortening: the arm
  // coming at the camera hangs a px longer, the one going back a px shorter.
  const ARM_F_H = {
    idle: P(13,
      '..ouu......uuo..',
      '..oUu......uUo..',
      '..oUu......uUo..',
      '..oUu......uUo..',
      '..oqq......qqo..',
      '...oo......oo...'),
    a: P(13,
      '..ouu......uuo..',
      '..oUu......uUo..',
      '..oUu......uUo..',
      '..oqq......uUo..',
      '...oo......uUo..',
      '...........qqo..',
      '...........oo...'),
  };
  const ARM_F_W = {
    idle: P(13,
      'ouuu........uuuo',
      'oUuu........uuUo',
      'oUuu........uuUo',
      'oUuu........uuUo',
      'oqqq........qqqo',
      '.ooo........ooo.'),
    a: P(13,
      'ouuu........uuuo',
      'oUuu........uuUo',
      'oUuu........uuUo',
      'oqqq........uuUo',
      '.ooo........uuUo',
      '............qqqo',
      '............ooo.'),
  };
  // the diagonal: the near arm (the body's right, seen from the front-right)
  // at the left, the far arm a sliver past the body's right edge
  const ARM_D_H = {
    idle: { near: P(13,
      '..ouu...........',
      '..oUu...........',
      '..oUu...........',
      '..oUu...........',
      '..oqq...........',
      '...oo...........'),
    far: P(13,
      '...........zzo..',
      '...........zzo..',
      '...........zzo..',
      '...........zzo..',
      '...........QQo..',
      '...........oo...') },
    a: { near: P(13,
      '..ouu...........',
      '..oUu...........',
      '..oUu...........',
      '..oUu...........',
      '..oUu...........',
      '..oqq...........',
      '...oo...........'),
    far: P(13,
      '...........zzo..',
      '...........zzo..',
      '...........QQo..',
      '...........oo...') },
    b: { near: P(13,
      '..ouu...........',
      '..oUu...........',
      '..oqq...........',
      '...oo...........'),
    far: P(13,
      '...........zzo..',
      '...........zzo..',
      '...........zzo..',
      '...........zzo..',
      '...........zzo..',
      '...........QQo..',
      '...........oo...') },
  };
  const ARM_D_W = {
    idle: { near: P(13,
      'ouuu............',
      'oUuu............',
      'oUuu............',
      'oUuu............',
      'oqqq............',
      '.ooo............'),
    far: P(13,
      '...........zzzo.',
      '...........zzzo.',
      '...........zzzo.',
      '...........zzzo.',
      '...........QQQo.',
      '............oo..') },
    a: { near: P(13,
      'ouuu............',
      'oUuu............',
      'oUuu............',
      'oUuu............',
      'oUuu............',
      'oqqq............',
      '.ooo............'),
    far: P(13,
      '...........zzzo.',
      '...........zzzo.',
      '...........QQQo.',
      '............oo..') },
    b: { near: P(13,
      'ouuu............',
      'oUuu............',
      'oqqq............',
      '.ooo............'),
    far: P(13,
      '...........zzzo.',
      '...........zzzo.',
      '...........zzzo.',
      '...........zzzo.',
      '...........zzzo.',
      '...........QQQo.',
      '............oo..') },
  };
  // the side: the near arm hangs over the body and swings fore and aft, the
  // far arm swings the other way behind it and only its hand shows past the
  // body's edge
  const ARM_E_H = {
    idle: { near: P(13,
      '.......oUuo.....',
      '.......oUuo.....',
      '.......oUuo.....',
      '.......oUuo.....',
      '.......oqqo.....',
      '........oo......') },
    fwd: { near: P(13,
      '.......oUuo.....',
      '.......oUuuo....',
      '........oUuuo...',
      '.........oUuqo..',
      '..........oqqo..',
      '...........oo...'),
    far: P(13,
      '.......ozzo.....',
      '......ozzzo.....',
      '.....ozzzo......',
      '...oQQzo........',
      '...oQQo.........',
      '....oo..........') },
    back: { near: P(13,
      '.......oUuo.....',
      '......oUuuo.....',
      '.....oUuuo......',
      '....oqUuo.......',
      '....oqqo........',
      '.....oo.........'),
    far: P(13,
      '.......ozzo.....',
      '.......ozzzo....',
      '........ozzzo...',
      '.........ozzQQo.',
      '..........oQQo..',
      '...........oo...') },
  };
  const ARM_E_W = {
    idle: { near: P(13,
      '.......oUuuo....',
      '.......oUuuo....',
      '.......oUuuo....',
      '.......oUuuo....',
      '.......oqqqo....',
      '........ooo.....') },
    fwd: { near: P(13,
      '.......oUuuo....',
      '.......oUuuuo...',
      '........oUuuuo..',
      '.........oUuqqo.',
      '..........oqqqo.',
      '...........ooo..'),
    far: P(13,
      '.......ozzzo....',
      '......ozzzzo....',
      '.....ozzzzo.....',
      '..oQQzzo........',
      '..oQQQo.........',
      '...ooo..........') },
    back: { near: P(13,
      '.......oUuuo....',
      '......oUuuuo....',
      '.....oUuuuo.....',
      '...oqqUuo.......',
      '...oqqqo........',
      '....ooo.........'),
    far: P(13,
      '.......ozzzo....',
      '.......ozzzzo...',
      '........ozzzzo..',
      '.........ozzQQo.',
      '..........oQQQo.',
      '...........ooo..') },
  };

  // ---------------------------------------------------------------- legs
  // LEGS[cls][family][frame]. The top two rows sit under the coat and show
  // only on a pass frame, when the body has risen a px off them. Front and
  // back share a set (the other contact is its mirror), and so do the two
  // diagonals; the side draws all four, the far leg a shade darker.
  const LEG_F_H = {
    idle: P(17,
      '....oppooppo....',
      '....oppooppo....',
      '....oppooppo....',
      '....oppooppo....',
      '...obbboobbbo...',
      '...oBBBooBBBo...',
      '...oooo..oooo...'),
    a: P(17,
      '....oppooppo....',
      '....oppooppo....',
      '....oppoobbbo...',
      '....oppooBBBo...',
      '...obbbo.ooo....',
      '...oBBBo........',
      '...oooo.........'),
  };
  const LEG_F_W = {
    idle: P(17,
      '...opppoopppo...',
      '...opppoopppo...',
      '...opppoopppo...',
      '...opppoopppo...',
      '..obbbboobbbbo..',
      '..oBBBBooBBBBo..',
      '..oIIIIooIIIIo..'),
    a: P(17,
      '...opppoopppo...',
      '...opppoopppo...',
      '...opppoobbbbo..',
      '...opppooBBBBo..',
      '..obbbbo.IIII...',
      '..oBBBBo........',
      '..oIIIIo........'),
  };
  const LEG_E_H = {
    idle: P(17,
      '......opppo.....',
      '......opppo.....',
      '......oPPpo.....',
      '......oPPpo.....',
      '......obbbbo....',
      '......oBBBBo....',
      '......oooooo....'),
    a: P(17,
      '......opppo.....',
      '.....oppppo.....',
      '....oppooPPo....',
      '...oppo..oPPo...',
      '..oBBo...obbbo..',
      '..oBBo...oBBBBo.',
      '..ooo....oooooo.'),
    pa: P(17,
      '......opppo.....',
      '......opppo.....',
      '...ooo.oPPo.....',
      '..oBBBooPPo.....',
      '...ooo.oPPo.....',
      '.......obbbbo...',
      '.......oooooo...'),
    b: P(17,
      '......opppo.....',
      '.....oppppo.....',
      '....oPPoopppo...',
      '...oPPo..oppo...',
      '..obbo...oBBBo..',
      '..obbo...oBBBBo.',
      '..ooo....oooooo.'),
    pb: P(17,
      '......opppo.....',
      '......opppo.....',
      '...ooo.oppo.....',
      '..obbbooppo.....',
      '...ooo.oppo.....',
      '.......oBBBBo...',
      '.......oooooo...'),
  };
  const LEG_E_W = {
    idle: P(17,
      '.....oppppo.....',
      '.....oppppo.....',
      '.....oPPPpo.....',
      '.....oPPPpo.....',
      '.....obbbbbo....',
      '.....oBBBBBo....',
      '.....oIIIIIIo...'),
    a: P(17,
      '.....oppppo.....',
      '....opppppo.....',
      '...opppooPPPo...',
      '..opppo..oPPPo..',
      '.oBBBo...obbbbo.',
      '.oBBBo...oBBBBBo',
      '.oIIIo...oIIIIIo'),
    pa: P(17,
      '.....oppppo.....',
      '.....oppppo.....',
      '..oooo.oPPPo....',
      '.oBBBBooPPPo....',
      '..oooo.oPPPo....',
      '.......obbbbbo..',
      '.......oIIIIIIo.'),
    b: P(17,
      '.....oppppo.....',
      '....opppppo.....',
      '...oPPPoopppo...',
      '..oPPPo..opppo..',
      '.obbbo...oBBBBo.',
      '.obbbo...oBBBBBo',
      '.oIIIo...oIIIIIo'),
    pb: P(17,
      '.....oppppo.....',
      '.....oppppo.....',
      '..oooo.opppo....',
      '.obbbbooppppo...',
      '..oooo.opppo....',
      '.......oBBBBBo..',
      '.......oIIIIIIo.'),
  };

  // ---------------------------------------------------------------- looks
  // A character's hair style and beard, per drawn facing, in profile.js's
  // order (CROP PART LONG TAIL SPIKE BALD / none stubble short full): `h`
  // turns skin to hair (a hat or hood is never painted over), `#` lays hair
  // on cloth (long hair on the collar, a full beard past the chin). Rows are
  // keyed by grid row. BALD also turns the head's own hair to skin.
  const HAIR = {
    S: [{ 7: '.....hhhhhh.....' }, { 7: '.....hhhh.......' },
      { 7: '.....hhhhhh.....', 8: '.....h....h.....', 9: '.....h....h.....', 10: '.....h....h.....', 12: '....##....##....' },
      { 7: '......hhhh......' }, { 7: '.....h.hh.h.....' }, {}],
    SE: [{ 7: '......hhhhh.....' }, { 7: '......hhh.......' },
      { 7: '......hhhhh.....', 8: '......h.........', 9: '......h.........', 10: '......h.........', 12: '....###.........' },
      { 7: '.......hhh......' }, { 7: '......h.hh......' }, {}],
    E: [{ 7: '........hhh.....' }, { 7: '........hh......' },
      { 7: '........hhh.....', 11: '....##..........', 12: '....###.........', 13: '....##..........' },
      { 7: '.........hh.....', 11: '...##...........', 12: '...##...........' }, { 7: '........h.h.....' }, {}],
    NE: [{}, {}, { 12: '....######......', 13: '.....####.......' }, { 12: '......##........', 13: '......##........' }, {}, {}],
    N: [{}, {}, { 12: '....########....', 13: '.....######.....' }, { 12: '.......##.......', 13: '.......##.......' }, {}, {}],
  };
  const BEARD = {
    S: [{}, { 10: '.....h.hh.h.....', 11: '......h..h......' }, { 10: '.....hh..hh.....', 11: '......hhhh......' },
      { 9: '.....h....h.....', 10: '.....hhhhhh.....', 11: '......hhhh......', 12: '......####......' }],
    SE: [{}, { 10: '......h.hh......', 11: '.......h.h......' }, { 10: '......hh.hh.....', 11: '.......hhhh.....' },
      { 9: '......h...h.....', 10: '......hhhhh.....', 11: '.......hhhh.....', 12: '.......####.....' }],
    E: [{}, { 10: '........h.h.....', 11: '.......h.h......' }, { 10: '.......hhhhh....', 11: '.......hhhh.....' },
      { 9: '.......hh.......', 10: '.......hhhhhh...', 11: '.......hhhhh....', 12: '........###.....' }],
    NE: [{}, {}, { 10: '.........h......' }, { 10: '.........h......', 11: '..........h.....' }],
    N: [{}, {}, {}, {}],
  };

  // ---------------------------------------------------------------- compose
  const FACINGS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']; // p.face's order: clockwise from east, y down
  const DRAWN = { E: ['E', false], SE: ['SE', false], S: ['S', false], SW: ['SE', true], W: ['E', true], NW: ['NE', true], N: ['N', false], NE: ['NE', false] };
  const FAMILY = { S: 'F', N: 'F', SE: 'D', NE: 'D', E: 'E' };
  const RUN_N = 4; // contact, pass, the other contact, pass
  // the canvas is one row taller than the body plan: on a pass frame the body
  // rises a px, and a pom or a crest on the plan's top row must not lose its
  // own top to the edge. Every part stamps OY rows down; the soles are row H - 1.
  const W = 16, OY = 1, H = 24 + OY;

  const flipRows = (rows) => rows.map((r) => r.split('').reverse().join(''));
  const flipPart = (p) => p && { y: p.y, rows: flipRows(p.rows) };
  function stamp(g, part, dy, remap) {
    if (!part) return;
    for (let r = 0; r < part.rows.length; r++) {
      const y = part.y + r + dy + OY;
      if (y < 0 || y >= H) continue;
      const row = part.rows[r];
      for (let x = 0; x < W; x++) {
        let c = row[x];
        if (c === '.') continue;
        if (remap && remap[c]) c = remap[c];
        g[y][x] = c;
      }
    }
  }
  // the legs, arms for one drawn facing and one frame of the run (0 idle,
  // 1 contact, 2 pass, 3 the other contact, 4 pass)
  function limbs(cls, art, frame) {
    const fam = FAMILY[art];
    let legs, arms;
    if (fam === 'E') {
      const L = cls ? LEG_E_W : LEG_E_H, A = cls ? ARM_E_W : ARM_E_H;
      legs = [L.idle, L.a, L.pa, L.b, L.pb][frame];
      // the near arm swings against the near leg: forward when the near leg is back
      arms = frame === 1 ? A.back : frame === 3 ? A.fwd : A.idle;
    } else if (fam === 'F') {
      const L = cls ? LEG_F_W : LEG_F_H, A = cls ? ARM_F_W : ARM_F_H;
      legs = frame === 1 ? L.a : frame === 3 ? flipPart(L.a) : L.idle;
      const a = frame === 1 ? A.a : frame === 3 ? flipPart(A.a) : A.idle;
      arms = { near: art === 'N' ? flipPart(a) : a };
    } else {
      const L = cls ? LEG_F_W : LEG_F_H, A = cls ? ARM_D_W : ARM_D_H;
      legs = frame === 1 ? L.a : frame === 3 ? flipPart(L.a) : L.idle;
      const a = frame === 1 ? A.a : frame === 3 ? A.b : A.idle;
      // from behind (NE) the near arm is the one at the right
      arms = art === 'NE' ? { near: flipPart(a.near), far: flipPart(a.far) } : a;
    }
    return { legs, arms };
  }
  function applyMask(g, M, dy, bald) {
    for (const r in M) {
      const y = +r + dy + OY;
      if (y < 0 || y >= H) continue;
      const m = M[r];
      for (let x = 0; x < W; x++) {
        const c = g[y][x];
        if ((m[x] === 'h' && (c === 'k' || c === 'K' || c === 'x')) || (m[x] === '#' && c !== 'o' && c !== '.' && c !== 'e')) g[y][x] = 'h';
      }
    }
  }
  // one frame as a char grid
  function compose(cls, look, art, frame) {
    const hat = HATS[cls][look.hat] || HATS[cls][0];
    const coat = COATS[cls][look.coat] || COATS[cls][0];
    // a diagonal a piece does not draw is its front (SE) or its back (NE), and
    // a diagonal it does draw overrides those layer by layer
    const pick = (o) => {
      const base = art === 'SE' ? o.S : art === 'NE' ? o.N : null;
      if (!base) return o[art] || o.S;
      if (!o[art]) return base;
      return o[art].rows ? o[art] : Object.assign({}, base, o[art]);
    };
    const hatP = pick(hat), coatP = pick(coat);
    const g = []; for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'));
    const bob = frame === 2 || frame === 4 ? -1 : 0;
    const { legs, arms } = limbs(cls, art, frame);
    const sl = coat.sleeve;
    let head = HEAD[art];
    if (look.hair === 5) head = { y: head.y, rows: head.rows.map((r) => r.replace(/h/g, 'k').replace(/H/g, 'K')) };
    stamp(g, legs, 0);
    const front = art === 'S' || art === 'SE' || art === 'E';
    if (art === 'E') stamp(g, coatP.back, bob);
    stamp(g, arms.far, bob, sl);
    stamp(g, coatP.under, bob);
    stamp(g, arms.near, bob, sl);
    stamp(g, coatP.over, bob);
    stamp(g, head, bob);
    stamp(g, hatP, bob);
    if (!front) stamp(g, coatP.back, bob);
    applyMask(g, HAIR[art][look.hair] || {}, bob);
    applyMask(g, BEARD[art][look.beard] || {}, bob);
    return g.map((r) => r.join(''));
  }

  // the set a body draws from: per facing (FACINGS order) an idle and the
  // four run frames, baked on first ask and kept per look and side
  const MARKS = { hat: 4 + OY, chest: 15 + OY, hips: 18 + OY, boots: 21 + OY }; // the gear marks' canvas rows (drawGearMarks), before the bob
  const cache = new Map();
  function scoutSet(cls, look, team) {
    look = look || {};
    const L = { hat: look.hat | 0, coat: look.coat | 0, hair: look.hair | 0, beard: look.beard | 0, tone: look.tone | 0, hairCol: look.hairCol | 0 };
    const key = cls + '|' + team + '|' + [L.hat, L.coat, L.hair, L.beard, L.tone, L.hairCol].join(',');
    let set = cache.get(key);
    if (set) return set;
    const tone = SPRITES.LOOK.tones[L.tone] || SPRITES.LOOK.tones[0], hc = SPRITES.LOOK.hairCols[L.hairCol] || SPRITES.LOOK.hairCols[0];
    const pal = Object.assign({}, SCOUT_PAL, teamScoutPal(TEAM_SKINS[team]), { k: tone[0], K: tone[1], x: tone[2], h: hc[0], H: hc[1] });
    const drawn = {};
    for (const art of ['S', 'SE', 'E', 'NE', 'N']) {
      const frames = [];
      for (let f = 0; f <= RUN_N; f++) {
        const c = bake(compose(cls, L, art, f), pal);
        c.bob = f === 2 || f === 4 ? -1 : 0; // the pass frames ride a px up (the gear marks ride with them)
        frames.push(c);
      }
      drawn[art] = frames;
    }
    // runRate: run frames per unit of p.animT, which a stride runs at 9 a
    // second (js/sim.js) - a whole four-frame cycle about every 0.45 s
    set = { dirs: [], sc: 1, top: 0, foot: H - 1, marks: MARKS, w: W, h: H, runRate: 1 };
    for (const name of FACINGS) {
      const [art, mirror] = DRAWN[name];
      const fr = mirror ? drawn[art].map((c) => Object.assign(flipH(c), { bob: c.bob })) : drawn[art];
      set.dirs.push({ idle: [fr[0]], run: fr.slice(1) });
    }
    // the four-way names the rest of the game speaks (a worn body's shape)
    set.down = set.dirs[2]; set.right = set.dirs[0]; set.up = set.dirs[6]; set.left = set.dirs[4];
    // ...and as a pose set (a frame list per four-way name: idle, then the run),
    // for the readers that take one - a rider seated on the bird, a body falling off it
    set.poses = {};
    for (const [k, d] of [['down', 2], ['right', 0], ['up', 6], ['left', 4]]) set.poses[k] = [set.dirs[d].idle[0]].concat(set.dirs[d].run);
    // the topmost painted row of the front idle: where the overhead stack hangs
    const top = compose(cls, L, 'S', 0).findIndex((r) => /[^.]/.test(r));
    set.top = top < 0 ? 0 : top;
    if (cache.size > 256) cache.clear();
    cache.set(key, set);
    return set;
  }
  SPR.onTeams(() => cache.clear()); // a repaint (setTeamPal) rebakes every set on its next ask

  // what a character may wear, per class: the names the create screen's
  // tooltip and the wiki would print; the count is profile.js's LOOK_N
  const WEAR = {
    hat: [['POM BEANIE', 'KNIT EARFLAP', 'HOOD'], ['FUR HOOD', 'PARKA HOOD', 'CRESTED HELM']],
    coat: [['SCARF COAT', 'PACK JACKET', 'SHORT CAPE'], ['FUR MANTLE', 'QUILTED PARKA', 'PAULDRONS']],
  };

  // every grid 16 wide, every table as long as profile.js says it is
  for (const L of [].concat(Object.values(HEAD),
    ...HATS.flat().map((h) => Object.values(h)),
    ...COATS.flat().map((c) => Object.values(c).filter((v) => v && v.under).flatMap((v) => [v.under, v.over, v.back].filter(Boolean))))) {
    for (const r of L.rows) if (r.length !== W) throw new Error('scouts.js: a row is ' + r.length + ' wide: "' + r + '"');
  }
  for (const k of ['hat', 'coat']) for (let c = 0; c < 2; c++) {
    const n = (k === 'hat' ? HATS : COATS)[c].length;
    if (n !== PROFILE.LOOK_N[k] || WEAR[k][c].length !== n) throw new Error('scouts.js: ' + k + ' has ' + n + ' entries, profile.js says ' + PROFILE.LOOK_N[k]);
  }

  Object.assign(SPRITES, { scout: scoutSet, SCOUT_WEAR: WEAR, SCOUT_FACINGS: FACINGS, scoutCompose: compose });
})();
