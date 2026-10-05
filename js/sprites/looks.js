'use strict';
// The 48 px CHARACTER MODEL: the big front-facing figure the create screen,
// the roster and the lobby's stage show. The body in the world is the 24 px
// scout (js/sprites/scouts.js), which carries the tone, the hair, the beard
// and the clothes; this is where the whole look reads - body type and face
// shape too - as
// LAYERS stamped in order onto one canvas: body, head, beard, hair, then the
// character's coat and hat over the lot (three of each per class, the same
// wardrobe the scout wears in the world), so a hat covers the crown and the
// hair shows under its brim. Every layer is a grid placed at an offset in the 48 x 48
// cell; the letters are the player palette's (characters.js PPAL) plus
// h/H hair, u undershirt, W eye white, g/G goggles, S/s/j fur, l/L/n leather
// and i/I iron. The
// tone and hair tables are SPRITES.LOOK (characters.js) - the one list.
(() => {
  const { TEAM_SKINS } = SPR;
  const LOOK = SPRITES.LOOK;
  const N = PROFILE.LOOK_N;
  const check = (name, n, want) => { if (n !== want) throw new Error('looks.js: ' + name + ' has ' + n + ' entries, profile.js says ' + want); };

  // ---------------------------------------------------------------- bodies
  // two body types, 24 wide at x = 12, rows 20-47: neck, shoulders, arms and
  // hands in skin, an undershirt, pants and boots. The male plan is square
  // across the shoulders; the female narrows through the waist and stands a
  // shade slighter in the arm.
  const BODY = [
    { x: 12, y: 20, rows: [
      '........okkkkkko........',
      '........okkkkkko........',
      '..ooooooookkkkoooooooo..',
      '.ouuuuuuuokkkkouuuuuuuo.',
      '.ouuuuuuuuoooouuuuuuuuo.',
      'ouuuuouuuuuuuuuuuuouuuuo',
      'ouuuuouuuuuuuuuuuuouuuuo',
      'okkkkouuuuuuuuuuuuokkkko',
      'okkkkouuuuuuuuuuuuokkkko',
      'okkkkouuuuuuuuuuuuokkkko',
      'okkkkouuuuuuuuuuuuokkkko',
      'okkkkouuuuuuuuuuuuokkkko',
      '.okkkouuuuuuuuuuuuokkko.',
      '.okkooooooooooooooookko.',
      '..oo.oppppppppppppo.oo..',
      '.....oppppppppppppo.....',
      '.....opppppoopppppo.....',
      '.....opppppoopppppo.....',
      '.....opppppoopppppo.....',
      '.....opppppoopppppo.....',
      '.....opppppoopppppo.....',
      '.....opppppoopppppo.....',
      '.....obbbbboobbbbbo.....',
      '....obbbbbboobbbbbbo....',
      '....oBBBBBBooBBBBBBo....',
      '.....oooooo..oooooo.....',
    ] },
    { x: 12, y: 20, rows: [
      '.........okkkko.........',
      '.........okkkko.........',
      '...oooooookkkkooooooo...',
      '..ouuuuuuokkkkouuuuuuo..',
      '..ouuuuuuuoooouuuuuuuo..',
      '.ouuuouuuuuuuuuuuuouuuo.',
      '.okkkouuuuuuuuuuuuokkko.',
      '.okkkouuuuuuuuuuuuokkko.',
      '.okkkouuuuuuuuuuuuokkko.',
      '.okkkouuuuuuuuuuuuokkko.',
      '.okkkoouuuuuuuuuuookkko.',
      '.okkko.ouuuuuuuuo.okkko.',
      '..okko.ouuuuuuuuo.okko..',
      '..oo..ouuuuuuuuuuo..oo..',
      '.....oppppppppppppo.....',
      '.....oppppppppppppo.....',
      '.....opppppoopppppo.....',
      '.....opppppoopppppo.....',
      '.....opppppoopppppo.....',
      '.....opppppoopppppo.....',
      '.....opppppoopppppo.....',
      '.....opppppoopppppo.....',
      '.....obbbbboobbbbbo.....',
      '....obbbbbboobbbbbbo....',
      '....oBBBBBBooBBBBBBo....',
      '.....oooooo..oooooo.....',
    ] },
  ];
  const HEAD = [
    { x: 16, y: 4, rows: [
      '....oooooooo....',
      '..ookkkkkkkkoo..',
      '.okkkkkkkkkkkko.',
      '.okkkkkkkkkkkko.',
      'okkkkkkkkkkkkkko',
      'okkkkkkkkkkkkkko',
      'okkkkkkkkkkkkkko',
      'okkWeekkkkeeWkko',
      'okkkkkkkkkkkkkko',
      'oxxkkkkKKkkkkxxo',
      '.okkkkkKKkkkkko.',
      '.okkkkkkkkkkkko.',
      '.okkkkkkkkkkkko.',
      '..okkkeeeekkko..',
      '..ookkkkkkkkoo..',
      '....ookkkkoo....',
      '......oooo......',
    ] },
    { x: 16, y: 4, rows: [
      '....oooooooo....',
      '..ookkkkkkkkoo..',
      '.okkkkkkkkkkkko.',
      '.okkkkkkkkkkkko.',
      'okkkkkkkkkkkkkko',
      'okkkkkkkkkkkkkko',
      'okkkkkkkkkkkkkko',
      'okkWeekkkkeeWkko',
      'okkkkkkkkkkkkkko',
      'oxxkkkkKKkkkkxxo',
      'okkkkkkKKkkkkkko',
      'okkkkkkkkkkkkkko',
      '.okkkkkkkkkkkko.',
      '.okkkkeeeekkkko.',
      '.okkkkkkkkkkkko.',
      '.oookkkkkkkkooo.',
      '...oookkkkooo...',
    ] },
    { x: 16, y: 4, rows: [
      '.....oooooo.....',
      '...ookkkkkkoo...',
      '..okkkkkkkkkko..',
      '..okkkkkkkkkko..',
      '.okkkkkkkkkkkko.',
      '.okkkkkkkkkkkko.',
      '.okkkkkkkkkkkko.',
      '.okWeekkkkeeWko.',
      '.okkkkkkkkkkkko.',
      '.oxkkkkKKkkkkxo.',
      '.okkkkkKKkkkkko.',
      '.okkkkkkkkkkkko.',
      '..okkkkkkkkkko..',
      '..okkkeeeekkko..',
      '..okkkkkkkkkko..',
      '...ookkkkkkoo...',
      '.....oooooo.....',
    ] },
  ];
  const BEARD = [
    null,
    { x: 16, y: 15, rows: [
      '...h.h....h.h...',
      '....h.h..h.h....',
      '...h.h....h.h...',
      '....h.h..h.h....',
      '......h..h......',
    ] },
    { x: 16, y: 15, rows: [
      '...hhh....hhh...',
      '...hhhh..hhhh...',
      '...hhh....hhh...',
      '....hhhhhhhh....',
      '......hhhh......',
    ] },
    { x: 16, y: 15, rows: [
      '...hhh....hhh...',
      '...hhhh..hhhh...',
      '...hhh....hhh...',
      '...hhhhhhhhhh...',
      '..ohhhhhhhhhho..',
      '..ohhhhhhhhhho..',
      '..ohhhHhhHhhho..',
      '...ohhhhhhhho...',
      '....ohhhhhho....',
      '.....ohhhho.....',
      '......oooo......',
    ] },
  ];
  const HAIR = [
    { x: 14, y: 4, rows: [
      '......oooooooo......',
      '....oohhhhhhhhoo....',
      '...ohhhhhhhhhhhho...',
      '..ohhhhhhhhhhhhhho..',
      '..ohhhhhhhhhhhhhho..',
      '..ohhhhhhhhhhhhhho..',
      '.ohh............hho.',
      '.ohh............hho.',
    ] },
    { x: 14, y: 4, rows: [
      '......oooooooo......',
      '....oohhhhhhhhoo....',
      '...ohhhhhhhhhhhho...',
      '..ohhhhhhhhhhhhhho..',
      '..ohhhhhhhhhhhhhho..',
      '..ohhhhhhhhhhhhhho..',
      '.ohhhhhhhhhhh.......',
      '.ohhhhhhhh..........',
      '..ohhhhh............',
    ] },
    { x: 14, y: 4, rows: [
      '......oooooooo......',
      '....oohhhhhhhhoo....',
      '...ohhhhhhhhhhhho...',
      '..ohhhhhhhhhhhhhho..',
      '..ohhhhhhhhhhhhhho..',
      '..ohhhhhhhhhhhhhho..',
      '.ohhh..........hhho.',
      '.ohhh..........hhho.',
      '.ohhh..........hhho.',
      '.ohhh..........hhho.',
      '.ohhh..........hhho.',
      '.ohhh..........hhho.',
      '.ohhh..........hhho.',
      '.ohhh..........hhho.',
      '.ohHh..........hHho.',
      '.ohhh..........hhho.',
      '.ohhh..........hhho.',
      '..ooo..........ooo..',
    ] },
    { x: 14, y: 4, rows: [
      '......oooooooo......',
      '....oohhhhhhhhoo....',
      '...ohhhhhhhhhhhho...',
      '..ohhhhhhhhhhhhhho..',
      '..ohhhhhhhhhhhhhho..',
      '..ohhhhhhhhhhhhhho..',
      '...hhhhhhhhhhhhhh...',
    ] },
    { x: 14, y: 4, rows: [
      '......oo.oo.oo......',
      '....oohhohhohhoo....',
      '...ohhhhhhhhhhhho...',
      '..ohhhhhhhhhhhhhho..',
      '..ohhhhhhhhhhhhhho..',
      '..ohhhhhhhhhhhhhho..',
      '.ohh.hh.hhhh.hh.hho.',
    ] },
    null,
  ];
  // the WARDROBE, laid over everything else: per class three hats and three
  // coats, the same pieces the scout wears in the world (js/sprites/scouts.js),
  // picked by the look's `hat` and `coat`. A hat is drawn after its coat, so a
  // hood or an earflap's ties hang over the collar. The hunter's: the pom
  // beanie, the knit earflap, the hood; the scarf coat, the pack jacket, the
  // short cape. The warrior's: the fur hood with the goggles up, the parka
  // hood, the crested helm; the fur mantle, the quilted parka, the pauldrons
  // over a tabard. Hats stop at row 8 or frame the face, so hair shows under
  // a brim and a beard inside a hood.
  const HATS48 = [[
    { x: 12, y: 0, rows: [
      '..........mmmm..........',
      '.........mmmmmm.........',
      '.........mmmmmm.........',
      '..........mmmm..........',
      '........oottttoo........',
      '......oottTTTTttoo......',
      '.....otttTTTTTTttto.....',
      '....otttttttttttttto....',
      '...oooooooooooooooooo...',
    ] },
    { x: 12, y: 1, rows: [
      '..........oooo..........',
      '........oottttoo........',
      '......oottTTTTttoo......',
      '.....otttTTTTTTttto.....',
      '....ottttTTTTTTtttto....',
      '...otttttttttttttttto...',
      '...otttttttttttttttto...',
      '..oTmTmTmTmTTmTmTmTmTo..',
      '..otttttttttttttttttto..',
      '..ottto..........ottto..',
      '..ottto..........ottto..',
      '..ottto..........ottto..',
      '..ottto..........ottto..',
      '..ottto..........ottto..',
      '..ottto..........ottto..',
      '..ottto..........ottto..',
      '..ottto..........ottto..',
      '...ooo............ooo...',
      '....m..............m....',
      '....m..............m....',
      '....m..............m....',
      '....M..............M....',
    ] },
    { x: 12, y: 1, rows: [
      '.........oooooo.........',
      '.......oottttttoo.......',
      '.....oottTTTTTTttoo.....',
      '....ottTTTTTTTTTTtto....',
      '...ottTTTTTTTTTTTTtto...',
      '...otttttttttttttttto...',
      '..otttttttttttttttttto..',
      '..otttoooooooooooottto..',
      '..ottoKKKKKKKKKKKKotto..',
      '..otto............otto..',
      '..otto............otto..',
      '..otto............otto..',
      '..otto............otto..',
      '..otto............otto..',
      '..otto............otto..',
      '..otto............otto..',
      '..otto............otto..',
      '..ottto..........ottto..',
      '..otttto........otttto..',
      '.ottttttoo....ootttttto.',
      'otttttttttoooottttttttto',
      'otttTTtttttttttttttTTtto',
    ] },
  ], [
    { x: 12, y: 2, rows: [
      '........oooooooo........',
      '......ooSSSSSSSSoo......',
      '.....oSSttttttttSSo.....',
      '....oSttGGGGGGGGttSo....',
      '....oStGggggggggGtSo....',
      '....oStGGGGGGGGGGtSo....',
      '...oSSooooooooooooSSo...',
      '...oSSo..........oSSo...',
      '...oSo............oSo...',
      '...oSo............oSo...',
      '...oSo............oSo...',
      '...oSo............oSo...',
      '...oSo............oSo...',
      '...oSo............oSo...',
      '...oSo............oSo...',
      '...oSo............oSo...',
      '...oSo............oSo...',
      '...oSo............oSo...',
      '....oSo..........oSo....',
      '.....oSSo......oSSo.....',
    ] },
    { x: 12, y: 0, rows: [
      '.......oooooooooo.......',
      '.....oottTTTTTTttoo.....',
      '....ottTTTTTTTTTTTTo....',
      '...ottTTTTTTTTTTTTTTo...',
      '..ottttGGGGGGGGGGtttto..',
      '..otttGggggggggggGttto..',
      '.otttttGGGGGGGGGGttttto.',
      '.ottSSSSSSSSSSSSSSSStto.',
      'otSSSSooooooooooooSSSSto',
      'otSSso............osSSto',
      'otSSo..............oSSto',
      'otSso..............osSto',
      'otSSo..............oSSto',
      'otSso..............osSto',
      'otSSo..............oSSto',
      'otSso..............osSto',
      'otSSo..............oSSto',
      'otSSso............osSSto',
      'ottSSSo..........oSSStto',
      'ottSSSSoo......ooSSSStto',
      '.otSSSSSSSSSSSSSSSSSSto.',
      '..ooSSSSSSSSSSSSSSSSoo..',
    ] },
    { x: 12, y: 0, rows: [
      '..........oooo..........',
      '.........ommmMo.........',
      '.........ommmMo.........',
      '.........ommmMo.........',
      '........oommmMoo........',
      '......oottTmmTttoo......',
      '.....otttTTmmTTttto.....',
      '....otttttTmmTttttto....',
      '....otttttttttttttto....',
      '...oiiiiiiiiiiiiiiiio...',
      '...oIiIiIiIiIiIiIiIio...',
      '...oiiiio......oiiiio...',
      '...oiIiio......oiiIio...',
      '...oiIiio......oiiIio...',
      '...oiIiio......oiiIio...',
      '...oiIiio......oiiIio...',
      '...oiiiio......oiiiio...',
      '....oiiio......oiiio....',
      '.....oiio......oiio.....',
      '......oo........oo......',
    ] },
  ]];
  const COATS48 = [[
    { x: 12, y: 22, rows: [
      '..ooooommmmmmmmmmooooo..',
      '.orrrommmmmmmmmmmmorrro.',
      '.orrrrommmmmmmmmmorrrro.',
      'orrrrrrommmmmmmmorrrrrro',
      'orrrrrrrommmmmmorrrrrrro',
      'orrrrRrrroooooorrrRrrrro',
      'orrrrRrrrrrrrrrrrrRrrrro',
      'omrrrorrrrrRRrrrrrorrrmo',
      'ommrrorrrrrRRrrrrrorrmmo',
      'ommmorrrrrrRRrrrrrrommmo',
      'ommmorrrrrrRRrrrrrrommmo',
      '.oooorrrrrrrrrrrrrroooo.',
      '....oddddddddddddddo....',
      '....orrrrrrrrrrrrrro....',
      '....orrrrrrrrrrrrrro....',
      '....orrrrrrrrrrrrrro....',
      '....oddddddddddddddo....',
      '.....oooooooooooooo.....',
    ] },
    { x: 12, y: 22, rows: [
      '..oooooommmmmmmmoooooo..',
      '.orrrrrlommmmmmolrrrrro.',
      '.orrrrrLlommmmolLrrrrro.',
      'orrrrrrLlrooooorlLrrrrro',
      'orrrrrrLlrrrrrrrlLrrrrro',
      'orrrrRrLlrrrrrrrlLRrrrro',
      'orrrrRrLlrrRRrrrlLRrrrro',
      'omrrrorLlrrRRrrrlLorrrmo',
      'ommrrorLlrrRRrrrlLorrmmo',
      'ommmorrLlrrRRrrrlLrommmo',
      'ommmorrnllllllllnnrommmo',
      '.oooorrrrrrrrrrrrrroooo.',
      '....oddddddddddddddo....',
      '....orrrrrrRRrrrrrro....',
      '....orrrrrrRRrrrrrro....',
      '....orrrrrrRRrrrrrro....',
      '....oddddddddddddddo....',
      '.....oooooooooooooo.....',
    ] },
    { x: 12, y: 21, rows: [
      '.......oottttttoo.......',
      '....oottttttttttttoo....',
      '..ootttTTttttttTTtttoo..',
      '.otttttTTttttttTTttttto.',
      'otttttttttttttttttttttto',
      'otttttttttttttttttttttto',
      'otttttttttttttttttttttto',
      'otttttttttttttttttttttto',
      'ommmmmmmmmmmmmmmmmmmmmmo',
      '.ooomorrrrrRRrrrrromooo.',
      '...oLorrrrrRRrrrrroLo...',
      '...oLorrrrrRRrrrrroLo...',
      '...ooorrrrrrrrrrrrrooo..',
      '....oddddddddddddddo....',
      '....orrrrrrrrrrrrrro....',
      '....orrrrrrrrrrrrrro....',
      '....orrrrrrrrrrrrrro....',
      '....oddddddddddddddo....',
      '.....oooooooooooooo.....',
    ] },
  ], [
    { x: 12, y: 21, rows: [
      '.....oSSSSSSSSSSSSSSo...',
      '..ooSSSSSSSSSSSSSSSSSSoo',
      '.oSSSSSSSSSSSSSSSSSSSSSo',
      'oSSSSSSSSSSSSSSSSSSSSSSo',
      'osssssssssssssssssssssso',
      'osjsssjsssjsssjsssjsssjo',
      'ojjsjjjsjjrrrrjjsjjjsjjo',
      '.ojjoojjoorRRrojjoojjoo.',
      'ollloorrrrrRRrrrrrrollo.',
      'oLLLorrrrrrRRrrrrrroLLLo',
      'oLLLorrrrrrRRrrrrrroLLLo',
      'oLLLorrrrrrRRrrrrrroLLLo',
      '.ooolllllllIIllllllooo..',
      '....oddddddddddddddo....',
      '....orrrrrrrrrrrrrro....',
      '....orrrrrrrrrrrrrro....',
      '....orrrrrrrrrrrrrro....',
      '....oddddddddddddddo....',
      '.....oooooooooooooo.....',
    ] },
    { x: 12, y: 21, rows: [
      '...oooooooooooooooooo...',
      '.oorrrrrrrrrrrrrrrrrroo.',
      'orrrrrrrrrrrrrrrrrrrrrro',
      'oRRrrrrrrrrRRrrrrrrrrRRo',
      'oRRrrrrrrrrRRrrrrrrrrRRo',
      'oddddddddddddddddddddddo',
      'orrrrrrrrrrRRrrrrrrrrrro',
      'oRRrrrrrrrrRRrrrrrrrrRRo',
      'oRRrrrrrrrrRRrrrrrrrrRRo',
      'oddddddddddddddddddddddo',
      'orrrrrrrrrrRRrrrrrrrrrro',
      'ommmmolllllIIlllllommmmo',
      'ommmmorrrrrRRrrrrrommmmo',
      '.oooodddddddddddddoooo..',
      '....odrrrrrRRrrrrrdo....',
      '....odrrrrrRRrrrrrdo....',
      '....oddddddddddddddo....',
      '.....oooooooooooooo.....',
    ] },
    { x: 12, y: 21, rows: [
      '.oooooo.ommmmmmo.oooooo.',
      'oiIIIIio.ommmmo.oiIIIIio',
      'oIIiiiIio.oo..oiIiiiIIo.',
      'oiiiiiiiorrrrrroiiiiiiio',
      'oiiiiiiiorrRRrroiiiiiiio',
      '.oiiiiiorrrRRrrroiiiiio.',
      '..ooooodrrrRRrrrdooooo..',
      '...oddodrrrRRrrrdodddo..',
      '...oddodrrrRRrrrdoddo...',
      '...oddodrrrRRrrrdoddo...',
      '...ollodrrrRRrrrdollo...',
      '...oLLodrrrRRrrrdoLLo...',
      '...oLLoollllIIllloLLo...',
      '....oooddrrRRrrddooo....',
      '.....odddrrRRrrdddo.....',
      '.....oddrrrRRrrrddo.....',
      '.....oddrrrRRrrrddo.....',
      '......ooorrRRrrooo......',
      '.........rRRRRr.........',
      '..........dddd..........',
    ] },
  ]];
  check('BODY', BODY.length, N.sex);
  check('HEAD', HEAD.length, N.face);
  check('BEARD', BEARD.length, N.beard);
  check('HAIR', HAIR.length, N.hair);
  check('LOOK.tones', LOOK.tones.length, N.tone);
  check('LOOK.hairCols', LOOK.hairCols.length, N.hairCol);
  check('LOOK.hairs', LOOK.hairs.length, N.hair);
  check('HATS48', HATS48.length, PROFILE.CLASS_N);
  check('COATS48', COATS48.length, PROFILE.CLASS_N);
  for (const c of HATS48) check('HATS48 per class', c.length, N.hat);
  for (const c of COATS48) check('COATS48 per class', c.length, N.coat);
  for (const L of [].concat(BODY, HEAD, BEARD, HAIR, ...HATS48, ...COATS48)) {
    if (!L) continue;
    for (const r of L.rows) if (r.length !== L.rows[0].length) throw new Error('looks.js: ragged grid row "' + r + '"');
  }

  const MODEL_PAL = {
    '.': null, 'o': '#2e2440', 'e': '#2e2440', 'W': '#f4f0e8', 'u': '#8c8674', 'p': '#463c5c',
    'b': '#6f4d38', 'B': '#4a3324', 'g': '#203a52', 'G': '#8fd8ff', 'S': '#e8e2d4',
    // the wardrobe's leather, iron and fur shades (the scout's own: js/sprites/scouts.js)
    'l': '#7a5034', 'L': '#9c6a44', 'n': '#4f3322', 'i': '#8c99b0', 'I': '#c3cad6', 's': '#bdb2a2', 'j': '#8d8274',
  };
  const modelPal = (look, team) => {
    const t = TEAM_SKINS[team], tone = LOOK.tones[look.tone] || LOOK.tones[0], hc = LOOK.hairCols[look.hairCol] || LOOK.hairCols[0];
    return Object.assign({}, MODEL_PAL, {
      k: tone[0], K: tone[1], x: tone[2], h: hc[0], H: hc[1],
      r: t.coat, R: t.coatL, d: t.coatD, t: t.head, T: t.headL, m: t.trim, M: t.trimD,
    });
  };
  const stamp = (g, L, pal) => {
    if (!L) return;
    for (let y = 0; y < L.rows.length; y++) {
      const row = L.rows[y];
      for (let x = 0; x < row.length; x++) {
        const c = pal[row[x]];
        if (c) { g.fillStyle = c; g.fillRect(L.x + x, L.y + y, 1, 1); }
      }
    }
  };
  // portrait(cls, look, team): the 48 x 48 model of one character in one
  // team's paint, composed on first ask and kept. The create screen asks for
  // one per option cell per click, so the cache is emptied past PORTRAIT_KEEP
  // rather than growing with every roll of the die. `bare` leaves the outfit off - the create screen's
  // head-and-shoulders read while a face is being chosen is the same model.
  const PORTRAIT_KEEP = 512;
  const cache = new Map();
  SPR.onTeams(() => cache.clear()); // a repaint (setTeamPal) rebakes every model on its next ask
  function portrait(cls, look, team, bare) {
    const key = cls + '|' + team + '|' + (bare ? 1 : 0) + '|' + [look.sex, look.tone, look.hair, look.hairCol, look.beard, look.face, look.hat, look.coat].join(',');
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const g = c.getContext('2d');
    const pal = modelPal(look, team);
    stamp(g, BODY[look.sex] || BODY[0], pal);
    stamp(g, HEAD[look.face] || HEAD[0], pal);
    stamp(g, BEARD[look.beard], pal);
    stamp(g, HAIR[look.hair], pal);
    if (!bare) {
      const hats = HATS48[cls] || HATS48[0], coats = COATS48[cls] || COATS48[0];
      stamp(g, coats[look.coat | 0] || coats[0], pal);
      stamp(g, hats[look.hat | 0] || hats[0], pal);
    }
    if (cache.size >= PORTRAIT_KEEP) cache.clear();
    cache.set(key, c);
    return c;
  }

  Object.assign(SPRITES, { portrait, MODEL_LAYERS: { BODY, HEAD, BEARD, HAIR, HATS48, COATS48 } });
})();
