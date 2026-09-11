'use strict';
// The 48 px CHARACTER MODEL: the big front-facing figure the create screen,
// the roster and class select's stage show. In-world bodies stay 16 px
// (characters.js paints a character's tone and fringe onto them); this is
// where the whole look reads - body type, face shape, hair style, beard - as
// LAYERS stamped in order onto one canvas: body, head, beard, hair, then the
// class outfit over the lot (the hunter's coat and pom hat, the warrior's
// hooded coat and goggles), so a hat covers the crown and the hair shows
// under its brim. Every layer is a grid placed at an offset in the 48 x 48
// cell; the letters are the player palette's (characters.js PPAL) plus
// h/H hair, u undershirt, W eye white, g/G goggles, S the hood's fur. The
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
  const OUTFIT = [
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
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
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
    { x: 12, y: 0, rows: [
      '........................',
      '........................',
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
      '..oooommSSSSSSSSmmoooo..',
      '.orrrommSSSSSSSSmmorrro.',
      '.orrrrommmSSSSmmmorrrro.',
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
  ];
  check('BODY', BODY.length, N.sex);
  check('HEAD', HEAD.length, N.face);
  check('BEARD', BEARD.length, N.beard);
  check('HAIR', HAIR.length, N.hair);
  check('LOOK.tones', LOOK.tones.length, N.tone);
  check('LOOK.hairCols', LOOK.hairCols.length, N.hairCol);
  check('LOOK.hairs', LOOK.hairs.length, N.hair);
  check('OUTFIT', OUTFIT.length, PROFILE.CLASS_N);
  for (const L of [].concat(BODY, HEAD, BEARD, HAIR, OUTFIT)) {
    if (!L) continue;
    for (const r of L.rows) if (r.length !== L.rows[0].length) throw new Error('looks.js: ragged grid row "' + r + '"');
  }

  const MODEL_PAL = {
    '.': null, 'o': '#2e2440', 'e': '#2e2440', 'W': '#f4f0e8', 'u': '#8c8674', 'p': '#463c5c',
    'b': '#6f4d38', 'B': '#4a3324', 'g': '#203a52', 'G': '#8fd8ff', 'S': '#e8e2d4',
  };
  const modelPal = (look, team) => {
    const t = TEAM_SKINS[team], tone = LOOK.tones[look.tone] || LOOK.tones[0], hc = LOOK.hairCols[look.hairCol] || LOOK.hairCols[0];
    return Object.assign({}, MODEL_PAL, {
      k: tone[0], K: tone[1], x: tone[2], h: hc[0], H: hc[1],
      r: t.coat, R: t.coatL, d: t.coatD, t: t.hat, T: t.hatL, m: t.trim, M: t.trimD,
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
  // team's paint, composed on first ask and kept (a handful of characters is
  // all that ever asks). `bare` leaves the outfit off - the create screen's
  // head-and-shoulders read while a face is being chosen is the same model.
  const cache = new Map();
  function portrait(cls, look, team, bare) {
    const key = cls + '|' + team + '|' + (bare ? 1 : 0) + '|' + [look.sex, look.tone, look.hair, look.hairCol, look.beard, look.face].join(',');
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
    if (!bare) stamp(g, OUTFIT[cls] || OUTFIT[0], pal);
    cache.set(key, c);
    return c;
  }

  Object.assign(SPRITES, { portrait, MODEL_LAYERS: { BODY, HEAD, BEARD, HAIR, OUTFIT } });
})();
