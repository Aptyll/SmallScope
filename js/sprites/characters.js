'use strict';
// The people: the player body plan in every team paint, the skater, the prone
// poses, the fish catch, the raider, and the merchant who drives the eagle.
(() => {
  const { bake, bakeSpan, flipH, TEAM_SKINS } = SPR;

  // ---------------------------------------------------------------- player
  const PPAL = {
    '.': null,
    'o': '#2e2440', // outline
    't': '#3e8c81', // hat teal
    'T': '#58ab98', // hat light
    'm': '#f6ecd4', // cream (pom, scarf, mittens)
    'M': '#d9c5a0', // cream shade
    'k': '#f2c69b', // skin
    'K': '#d69f72', // skin shade
    'e': '#2e2440', // eye
    'x': '#e8967f', // blush
    'r': '#c9524e', // coat red
    'R': '#df7358', // coat light
    'd': '#96393f', // coat dark
    'p': '#463c5c', // pants
    'b': '#6f4d38', // boots
    'B': '#4a3324', // boots dark
  };

  const downBody = [
    '................',
    '.......mm.......',
    '.......mM.......',
    '.....otttto.....',
    '....otTTTTto....',
    '....otttttto....',
    '....okkkkkko....',
    '....okekkeko....',
    '....oxkKKkxo....',
    '....ommmmmmo....',
    '...orrrRRrrro...',
    '...orrrRRrrro...',
    '...omorrrromo...',
    '....oddddddo....',
  ];
  const playerDownIdle = downBody.concat([
    '.....pp..pp.....',
    '.....bb..bb.....',
  ]);
  const playerDownA = downBody.concat([
    '.....pp..bb.....',
    '.....bb.........',
  ]);
  const playerDownB = downBody.concat([
    '.....bb..pp.....',
    '.........bb.....',
  ]);

  const upBody = [
    '................',
    '.......mm.......',
    '.......mM.......',
    '.....otttto.....',
    '....otTTTTto....',
    '....otttttto....',
    '....otttttto....',
    '....otttttto....',
    '....otttttto....',
    '....ommmmmmo....',
    '...orrrrrrrro...',
    '...orrrrrrrro...',
    '...omorrrromo...',
    '....oddddddo....',
  ];
  const playerUpIdle = upBody.concat([
    '.....pp..pp.....',
    '.....bb..bb.....',
  ]);
  const playerUpA = upBody.concat([
    '.....pp..bb.....',
    '.....bb.........',
  ]);
  const playerUpB = upBody.concat([
    '.....bb..pp.....',
    '.........bb.....',
  ]);

  // side = facing right
  const sideBody = [
    '................',
    '.....mm.........',
    '.....mM.........',
    '.....otttto.....',
    '....otTTTtto....',
    '....otttttto....',
    '....ottkkkko....',
    '....ottkkeko....',
    '....otkKKKko....',
    '....ommmmmmo....',
    '....orrrRRro....',
    '....orrrRRro....',
    '....orrommro....',
    '....odddddo.....',
  ];
  const playerSideIdle = sideBody.concat([
    '......pp.pp.....',
    '......bb.bb.....',
  ]);
  const playerSideA = sideBody.concat([
    '.....pp...pp....',
    '.....bb...bb....',
  ]);
  const playerSideB = sideBody.concat([
    '.......pp.......',
    '.......bb.......',
  ]);

  // ---------------------------------------------------------------- the fish catch
  // Three DOWN-facing frames the catch plays through whichever way the body
  // faces (catchFrame, js/tools.js; drawn by drawPlayer): a STOOP to the hole,
  // the fish HAULED up tail-first with the water flying off it, and the trophy
  // HOIST - both arms straight up, the fish flat above the hat - which is why
  // the hold frame is 16x20 and draws four rows higher on the same feet. Look
  // A off docs/media/concepts/fish-catch-concepts-1.png. The fish letters
  // (CATCHPAL_EXTRA): n outline, f/F body, w belly, i eye, c a flying drop.
  const CATCHPAL_EXTRA = { 'n': '#243b52', 'f': '#4f7ea3', 'F': '#6f9fc0', 'w': '#c9dded', 'i': '#101d2c', 'c': '#9fd6f2' };
  const catchStoop = [
    '................',
    '................',
    '................',
    '.......mm.......',
    '.......mM.......',
    '.....otttto.....',
    '....otTTTTto....',
    '....otttttto....',
    '....okkkkkko....',
    '....okekkeko....',
    '....oxkKKkxo....',
    '....ommmmmmo....',
    '...orrrRRrrro...',
    '..morrrRRrrrom..',
    '....oddddddo....',
    '.....bb..bb.....',
  ];
  const catchHaul = [
    '................',
    '.......mm.......',
    '.......mM.......',
    '.....otttto.....',
    '....otTTTTto....',
    '....otttttto....',
    '....okkkkkko....',
    '....okekkeko....',
    '....oxkKKkxo....',
    '..c.ommnnmmo.c..',
    '...orrnFFnrro...',
    '..c.omnFfFnmo.c.',
    '...orrnFwFnro...',
    '....odnFiFndo...',
    '.....pnnnnpp....',
    '.....bb..bb.....',
  ];
  const catchHold = [
    '.......nnnn.....',
    '..n..nFFFFFn....',
    '..nnnFfFFiFFn...',
    '..n..nFwwFFn....',
    '..mm...nnnn.mm..',
    '..or...mm...ro..',
    '..or...mM...ro..',
    '..or.otttto.ro..',
    '..orotTTTTtoro..',
    '..orottttttoro..',
    '..orokkkkkkoro..',
    '..orokekkekoro..',
    '..oroxkKKkxoro..',
    '..orommmmmmoro..',
    '..orrrrRRrrrro..',
    '...orrrRRrrro...',
    '...orrrrrrrro...',
    '....oddddddo....',
    '.....pp..pp.....',
    '.....bb..bb.....',
  ];

  // ---------------------------------------------------------------- skater (champion 2)
  // Same 16x16 body plan as the player so every pose/frame lines up, but a
  // hood instead of the pom hat, goggles, a long trailing scarf and skate
  // blades under the boots. Extra palette chars: S blade, g/G goggles.
  const SKPAL_EXTRA = { 'S': '#c8d8e8', 'g': '#203a52', 'G': '#8fd8ff' };
  const skDownBody = [
    '................',
    '.....oooooo.....',
    '....otttttto....',
    '....otTTTTto....',
    '....otkkkkto....',
    '....oGgGgGto....',
    '....otkKKkto....',
    '....ommmmmmo....',
    '...ommrrRRrro...',
    '...orrrRRrrro...',
    '...orrrRRrmmo...',
    '...omorrrromo...',
    '....oddddddo....',
    '.....pp..pp.....',
  ];
  const skDownIdle = skDownBody.concat(['.....bb..bb.....', '.....SS..SS.....']);
  const skDownA = skDownBody.concat(['.....bb..SS.....', '.....SS.........']);
  const skDownB = skDownBody.concat(['.....SS..bb.....', '.........SS.....']);
  // the skater's catch: the same three beats on her body plan (hood, goggles,
  // the scarf's trailing ends, blades under the boots)
  const skCatchStoop = [
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '....otttttto....',
    '....otTTTTto....',
    '....otkkkkto....',
    '....oGgGgGto....',
    '....otkKKkto....',
    '....ommmmmmo....',
    '...ommrrRRrro...',
    '...orrrRRrrro...',
    '..morrrRRrmmom..',
    '....oddddddo....',
    '.....bb..bb.....',
    '.....SS..SS.....',
  ];
  const skCatchHaul = [
    '................',
    '.....oooooo.....',
    '....otttttto....',
    '....otTTTTto....',
    '....otkkkkto....',
    '....oGgGgGto....',
    '....otkKKkto....',
    '..c.ommnnmmo.c..',
    '...ommnFFnrro...',
    '..c.omnFfFnmo.c.',
    '...orrnFwFnmo...',
    '...omonFiFnomo..',
    '....odnnnndo....',
    '.....pp..pp.....',
    '.....bb..bb.....',
    '.....SS..SS.....',
  ];
  const skCatchHold = [
    '.......nnnn.....',
    '..n..nFFFFFn....',
    '..nnnFfFFiFFn...',
    '..n..nFwwFFn....',
    '..mm...nnnn.mm..',
    '..or.oooooo.ro..',
    '..orottttttoro..',
    '..orotTTTTtoro..',
    '..orotkkkktoro..',
    '..oroGgGgGtoro..',
    '..orotkKKktoro..',
    '..orommmmmmoro..',
    '..ormmrrRRrrro..',
    '...orrrRRrrro...',
    '...orrrRRrmmo...',
    '...orrrrrrrro...',
    '....oddddddo....',
    '.....pp..pp.....',
    '.....bb..bb.....',
    '.....SS..SS.....',
  ];
  const skUpBody = [
    '................',
    '.....oooooo.....',
    '....otttttto....',
    '....otTTTTto....',
    '....otttttto....',
    '....otttttto....',
    '....otttttto....',
    '....ommmmmmo....',
    '...orrrmmrrro...',
    '...orrrmmrrro...',
    '...orrrmmrrro...',
    '...omorrmromo...',
    '....oddddddo....',
    '.....pp..pp.....',
  ];
  const skUpIdle = skUpBody.concat(['.....bb..bb.....', '.....SS..SS.....']);
  const skUpA = skUpBody.concat(['.....bb..SS.....', '.....SS.........']);
  const skUpB = skUpBody.concat(['.....SS..bb.....', '.........SS.....']);
  const skSideBody = [
    '................',
    '.....oooooo.....',
    '....otttttto....',
    '....otTTTtto....',
    '....ottttkko....',
    '....otttGgGo....',
    '....otttkKko....',
    '..mmommmmmmo....',
    '.mmmorrrRRro....',
    '....orrrRRro....',
    '....orrommro....',
    '....odddddo.....',
    '....odddddo.....',
    '......pp.pp.....',
  ];
  const skSideIdle = skSideBody.concat(['......bb.bb.....', '......SS.SS.....']);
  const skSideA = skSideBody.concat(['.....bb...bb....', '.....SS...SS....']);
  const skSideB = skSideBody.concat(['.......bb.......', '.......SS.......']);

  // ---------------------------------------------------------------- prone
  // Belly-down in the snow. The same 16x16 cell as every other pose, but the
  // body lies ACROSS it rather than standing up through it, so a player's
  // ground contact stays where the standing feet were and the y-sort never
  // jumps when they drop. Foreshortened, not shrunk - head-on the figure is
  // twelve rows to the standing sixteen - and the whole read comes from
  // segmenting it: boots at the trailing end, a split pair of calves, thighs
  // that widen into the coat hem, elbows out to the full width of the cell, and a
  // small head at the front. Side-on the same body is eight rows deep and fifteen
  // long, with the head propped up and looking where it is going.
  //
  // Three frames a direction - settled, and two of the crawl, which alternates
  // the reaching arm AND the drawn-up knee, because a belly crawl hauls with
  // one arm and pushes off the opposite leg. The 1px inch forward between
  // frames is applied by the renderer, not baked into a second set of grids.
  const pnSideIdle = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '........ommoooo.',
    '.....oooooottTo.',
    '..oooodrrrttTkKo',
    '.oBbbprrrRrtkeko',
    '.oBbbprrrRrtkKko',
    '..obbpdrrrrokKo.',
    '...oooodrroommmo',
    '......oooooooo..',
    '................',
  ];
  const pnSideA = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '........ommoooo.',
    '...oppooooottTo.',
    '..oooodrrrttTkKo',
    '.oBbbprrrRrtkeko',
    '.oBbbprrrRrtkKko',
    '..obbpdrrrrokKo.',
    '...oooodrrommmmo',
    '......oooooooo..',
    '................',
  ];
  const pnSideB = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '........ommoooo.',
    '.....oooooottTo.',
    '..oooodrrrttTkKo',
    '.oBbbprrrRrtkeko',
    '.oBbbprrrRrtkKko',
    '..obbpdrrrrokKo.',
    '...oooodrrooommo',
    '...oppoooooooo..',
    '................',
  ];
  const pnDownIdle = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....oooooooo....',
    '....obboobbo....',
    '....oppooppo....',
    '...oppppppppo...',
    '...oddddddddo...',
    'ommorrrrrrrrommo',
    'ommorrrrrrrrommo',
    '...orrrrrrrro...',
    '....otttttto....',
    '....otTTTTto....',
    '....okekkeko....',
  ];
  const pnDownA = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....oooooooo....',
    '....obboobbo....',
    '....oppooppo....',
    '...oppppppppo...',
    '...oddddddddommo',
    '...orrrrrrrrommo',
    'ommorrrrrrrro...',
    'ommorrrrrrrro...',
    '....otttttto....',
    '....otTTTTto....',
    '....okekkeko....',
  ];
  const pnDownB = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....oooooooo....',
    '....obboobbo....',
    '....oppooppo....',
    '...oppppppppo...',
    'ommoddddddddo...',
    'ommorrrrrrrro...',
    '...orrrrrrrrommo',
    '...orrrrrrrrommo',
    '....otttttto....',
    '....otTTTTto....',
    '....okekkeko....',
  ];
  const pnUpIdle = [
    '................',
    '................',
    '................',
    '................',
    '......ommo......',
    '....oooooooo....',
    '....otttttto....',
    '....otTTTTto....',
    '...ommmmmmmmo...',
    'ommorrrrrrrrommo',
    'ommorrrrrrrrommo',
    '...orrrrrrrro...',
    '...oddddddddo...',
    '...oppppppppo...',
    '....oppooppo....',
    '....obboobbo....',
  ];
  const pnUpA = [
    '................',
    '................',
    '................',
    '................',
    '......ommo......',
    '....oooooooo....',
    '....otttttto....',
    '....otTTTTto....',
    'ommommmmmmmmo...',
    'ommorrrrrrrro...',
    '...orrrrrrrrommo',
    '...orrrrrrrrommo',
    '...oddddddddo...',
    '...oppppppppo...',
    '....oppooppo....',
    '....obboobbo....',
  ];
  const pnUpB = [
    '................',
    '................',
    '................',
    '................',
    '......ommo......',
    '....oooooooo....',
    '....otttttto....',
    '....otTTTTto....',
    '...ommmmmmmmommo',
    '...orrrrrrrrommo',
    'ommorrrrrrrro...',
    'ommorrrrrrrro...',
    '...oddddddddo...',
    '...oppppppppo...',
    '....oppooppo....',
    '....obboobbo....',
  ];

  // The skater lies down the same way: hood instead of the pom hat, the goggle
  // band where the eye is, the scarf flicked out behind her, and the blade
  // showing as a bright plate under each boot.
  const pnSkSideIdle = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....ommmo.oooo.',
    '.....oooooottTo.',
    '..oooodrrrttTkKo',
    '.oBbbprrrRrtGgko',
    '.oBbbprrrRrtkKko',
    '..obbpdrrrrokKo.',
    '...SSSodrroommmo',
    '......oooooooo..',
    '................',
  ];
  const pnSkSideA = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....ommmo.oooo.',
    '...oppooooottTo.',
    '..oooodrrrttTkKo',
    '.oBbbprrrRrtGgko',
    '.oBbbprrrRrtkKko',
    '..obbpdrrrrokKo.',
    '...SSSodrrommmmo',
    '......oooooooo..',
    '................',
  ];
  const pnSkSideB = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....ommmo.oooo.',
    '.....oooooottTo.',
    '..oooodrrrttTkKo',
    '.oBbbprrrRrtGgko',
    '.oBbbprrrRrtkKko',
    '..obbpdrrrrokKo.',
    '...SSSodrrooommo',
    '...oppoooooooo..',
    '................',
  ];
  const pnSkDownIdle = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....oooooooo....',
    '....oSSooSSo....',
    '....obboobbo....',
    '...oppppppppo...',
    '...oddddddddo...',
    'ommorrrrrrrrommo',
    'ommorrrrrrrrommo',
    '...orrrrrrrro...',
    '....otttttto....',
    '....otTTTTto....',
    '....oGgGgGgo....',
  ];
  const pnSkDownA = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....oooooooo....',
    '....oSSooSSo....',
    '....obboobbo....',
    '...oppppppppo...',
    '...oddddddddommo',
    '...orrrrrrrrommo',
    'ommorrrrrrrro...',
    'ommorrrrrrrro...',
    '....otttttto....',
    '....otTTTTto....',
    '....oGgGgGgo....',
  ];
  const pnSkDownB = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....oooooooo....',
    '....oSSooSSo....',
    '....obboobbo....',
    '...oppppppppo...',
    'ommoddddddddo...',
    'ommorrrrrrrro...',
    '...orrrrrrrrommo',
    '...orrrrrrrrommo',
    '....otttttto....',
    '....otTTTTto....',
    '....oGgGgGgo....',
  ];
  const pnSkUpIdle = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....oooooooo....',
    '....otttttto....',
    '..mmotTTTTto....',
    '...ommmmmmmmo...',
    'ommorrrrrrrrommo',
    'ommorrrrrrrrommo',
    '...orrrrrrrro...',
    '...oddddddddo...',
    '...oppppppppo...',
    '....obboobbo....',
    '....oSSooSSo....',
  ];
  const pnSkUpA = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....oooooooo....',
    '....otttttto....',
    '..mmotTTTTto....',
    'ommommmmmmmmo...',
    'ommorrrrrrrro...',
    '...orrrrrrrrommo',
    '...orrrrrrrrommo',
    '...oddddddddo...',
    '...oppppppppo...',
    '....obboobbo....',
    '....oSSooSSo....',
  ];
  const pnSkUpB = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....oooooooo....',
    '....otttttto....',
    '..mmotTTTTto....',
    '...ommmmmmmmommo',
    '...orrrrrrrrommo',
    'ommorrrrrrrro...',
    'ommorrrrrrrro...',
    '...oddddddddo...',
    '...oppppppppo...',
    '....obboobbo....',
    '....oSSooSSo....',
  ];

  // ---------------------------------------------------------------- raider
  // Player-like night raider: same body grids, hostile palette.
  const RDPAL = {
    '.': null,
    'o': '#1c1826', // outline
    't': '#3c3450', // hood dark
    'T': '#544a70', // hood light
    'm': '#8f8ba0', // wraps gray
    'M': '#6e6a80', // wraps shade
    'k': '#b8c2d2', // pale skin
    'K': '#8c99b0', // skin shade
    'e': '#ff5555', // eyes red
    'x': '#8c99b0', // no blush
    'r': '#3f3a52', // cloak
    'R': '#555070', // cloak light
    'd': '#2c2840', // cloak dark
    'p': '#242032', // pants
    'b': '#3a3040', // boots
    'B': '#241c28', // boots dark
  };

  const teamPlayerPal = (t) => Object.assign({}, PPAL, {
    r: t.coat, R: t.coatL, d: t.coatD, t: t.hat, T: t.hatL, m: t.trim, M: t.trimD,
  });
  // the three catch frames in a class's team paint (the fish keeps its own colours)
  const catchSet = (pal, stoop, haul, hold) => {
    const cp = Object.assign({}, pal, CATCHPAL_EXTRA);
    return [bake(stoop, cp), bake(haul, cp), bake(hold, cp)];
  };
  const playerSet = (pal) => ({
    down: [bake(playerDownIdle, pal), bake(playerDownA, pal), bake(playerDownB, pal)],
    up: [bake(playerUpIdle, pal), bake(playerUpA, pal), bake(playerUpB, pal)],
    right: [bake(playerSideIdle, pal), bake(playerSideA, pal), bake(playerSideB, pal)],
    left: [flipH(bake(playerSideIdle, pal)), flipH(bake(playerSideA, pal)), flipH(bake(playerSideB, pal))],
    catch: catchSet(pal, catchStoop, catchHaul, catchHold),
    // belly-down: a sibling of the four walking directions, same frame order
    prone: {
      down: [bakeSpan(pnDownIdle, pal), bakeSpan(pnDownA, pal), bakeSpan(pnDownB, pal)],
      up: [bakeSpan(pnUpIdle, pal), bakeSpan(pnUpA, pal), bakeSpan(pnUpB, pal)],
      right: [bakeSpan(pnSideIdle, pal), bakeSpan(pnSideA, pal), bakeSpan(pnSideB, pal)],
      left: [flipH(bakeSpan(pnSideIdle, pal)), flipH(bakeSpan(pnSideA, pal)), flipH(bakeSpan(pnSideB, pal))],
    },
  });
  const teamPlayers = TEAM_SKINS.map((t) => playerSet(teamPlayerPal(t)));
  const skaterSet = (pal) => {
    const sp = Object.assign({}, pal, SKPAL_EXTRA);
    return {
      down: [bake(skDownIdle, sp), bake(skDownA, sp), bake(skDownB, sp)],
      up: [bake(skUpIdle, sp), bake(skUpA, sp), bake(skUpB, sp)],
      right: [bake(skSideIdle, sp), bake(skSideA, sp), bake(skSideB, sp)],
      left: [flipH(bake(skSideIdle, sp)), flipH(bake(skSideA, sp)), flipH(bake(skSideB, sp))],
      catch: catchSet(sp, skCatchStoop, skCatchHaul, skCatchHold),
      prone: {
        down: [bakeSpan(pnSkDownIdle, sp), bakeSpan(pnSkDownA, sp), bakeSpan(pnSkDownB, sp)],
        up: [bakeSpan(pnSkUpIdle, sp), bakeSpan(pnSkUpA, sp), bakeSpan(pnSkUpB, sp)],
        right: [bakeSpan(pnSkSideIdle, sp), bakeSpan(pnSkSideA, sp), bakeSpan(pnSkSideB, sp)],
        left: [flipH(bakeSpan(pnSkSideIdle, sp)), flipH(bakeSpan(pnSkSideA, sp)), flipH(bakeSpan(pnSkSideB, sp))],
      },
    };
  };
  // champ[c][team] - one full pose set per champion per team colour
  const champPlayers = [teamPlayers, TEAM_SKINS.map((t) => skaterSet(teamPlayerPal(t)))];

  // ---------------------------------------------------------------- looks
  // A CHARACTER's paint on the class body: its skin tone (k/K/x) and, on the
  // front and side walking frames, a FRINGE of its hair colour (h/H) under the
  // hat's brim - the first face row is the one place at 16 px where hair
  // reads, so a style is a mask over that row (and the next, for long hair)
  // and everything else the style says is the 48 px model's business
  // (js/sprites/looks.js). Body type, beard and face shape do not touch the
  // 16 px body at all until the 32 px rework. The tables are the ONE list of
  // looks: profile.js stores an index into each and asserts the counts.
  const LOOK = {
    // [k skin, K shade, x blush]
    tones: [
      ['#f2c69b', '#d69f72', '#e8967f'], ['#fbe0c4', '#e2b898', '#f0a89a'], ['#e0a97a', '#bd8354', '#d88a70'],
      ['#b97a4e', '#94582f', '#c2764f'], ['#8a5533', '#663a1f', '#9a5a3a'], ['#5a3a26', '#3f2718', '#6a4230'],
    ],
    // [h hair, H hair light]
    hairCols: [
      ['#2a2118', '#3d3226'], ['#5c3b20', '#7a5230'], ['#a8702f', '#c48b43'], ['#d9a441', '#f0c766'],
      ['#c8452a', '#e0653f'], ['#b8bcc4', '#dfe3ea'], ['#f4f0e8', '#ffffff'], ['#4a6fb8', '#6f93d8'],
    ],
    // the six styles' fringes: [the face's first row, the row under it], six
    // wide across the front face; the side and the hooded body take a slice
    hairs: [
      ['hhhhhh', '......'], // CROP
      ['hhhh..', '......'], // PART
      ['hhhhhh', 'h....h'], // LONG - it hangs beside the eyes
      ['.hhhh.', '......'], // TAIL
      ['h.hh.h', '......'], // SPIKE
      ['......', '......'], // BALD
    ],
    beardN: 4, faceN: 3, sexN: 2,
  };
  // mask chars over skin only, so a hood or a hat never gets hair painted on
  const fringed = (rows, r, x0, mask) => rows.map((row, i) => {
    const m = i === r ? mask[0] : i === r + 1 ? mask[1] : null;
    if (!m) return row;
    let out = row;
    for (let j = 0; j < m.length; j++) {
      if (m[j] === 'h' && out[x0 + j] === 'k') out = out.slice(0, x0 + j) + 'h' + out.slice(x0 + j + 1);
    }
    return out;
  });
  const lookPal = (pal, look) => {
    const t = LOOK.tones[look.tone] || LOOK.tones[0], h = LOOK.hairCols[look.hairCol] || LOOK.hairCols[0];
    return Object.assign({}, pal, { k: t[0], K: t[1], x: t[2], h: h[0], H: h[1] });
  };
  // the same builders as the class sets, with the fringe cut into the front
  // and side walking frames (the site differs per body: the pom-hat body
  // shows six skin pixels under its brim, the hood four)
  const lookSet = (cls, pal, look) => {
    const f = LOOK.hairs[look.hair] || LOOK.hairs[0];
    if (cls === 1) {
      const sp = Object.assign({}, pal, SKPAL_EXTRA);
      const dn = (g) => fringed(g, 4, 6, [f[0].slice(1, 5), f[1].slice(1, 5)]);
      const sd = (g) => fringed(g, 4, 9, [f[0].slice(4), '..']);
      return Object.assign(skaterSet(sp), {
        down: [bake(dn(skDownIdle), sp), bake(dn(skDownA), sp), bake(dn(skDownB), sp)],
        right: [bake(sd(skSideIdle), sp), bake(sd(skSideA), sp), bake(sd(skSideB), sp)],
        left: [flipH(bake(sd(skSideIdle), sp)), flipH(bake(sd(skSideA), sp)), flipH(bake(sd(skSideB), sp))],
      });
    }
    const dn = (g) => fringed(g, 6, 5, f);
    const sd = (g) => fringed(g, 6, 7, [f[0].slice(2), '....']);
    return Object.assign(playerSet(pal), {
      down: [bake(dn(playerDownIdle), pal), bake(dn(playerDownA), pal), bake(dn(playerDownB), pal)],
      right: [bake(sd(playerSideIdle), pal), bake(sd(playerSideA), pal), bake(sd(playerSideB), pal)],
      left: [flipH(bake(sd(playerSideIdle), pal)), flipH(bake(sd(playerSideA), pal)), flipH(bake(sd(playerSideB), pal))],
    });
  };
  // champLook(cls, look, team): the full pose set for one character in one
  // team's paint, baked on first ask and kept - ten players and a menu or two
  // is all that ever asks, so the cache stays small. Every reader of a
  // player's body goes through classSet(p) (js/player.js), which asks here.
  const lookCache = new Map();
  function champLook(cls, look, team) {
    if (!look) return champPlayers[cls][team];
    const key = cls + '|' + team + '|' + look.tone + '|' + look.hair + '|' + look.hairCol;
    let set = lookCache.get(key);
    if (!set) {
      set = lookSet(cls, lookPal(teamPlayerPal(TEAM_SKINS[team]), look), look);
      lookCache.set(key, set);
    }
    return set;
  }

  // the MERCHANT who drives each team's eagle and works its roost (the
  // `merchant` banner, js/robots.js): the player body plan in a trader's tan
  // coat, with the hat and the trim in the team's colour so the side reads
  // Not another player: its own grids, 16 x 18 - two rows taller than a slot
  // - picked off a concept sheet (docs/media/concepts/merchant-concepts-2,
  // look D; the `concept-art` skill is how such a sheet is made): an old
  // trader in a wide flat FUR HAT with a team-cloth crown (the one team ink,
  // and all of it), a white beard down the chest, a khaki wool coat hanging
  // straight to the hem, boots under it. Three directions like a slot (the
  // side grid faces right and flips), three frames each: the feet walk, the
  // coat hangs. Chars: y/Y the team crown, f/F fur, w/W beard, r/R/d coat,
  // k/K skin, e eye, b boots, o outline.
  const merchDown = [
    '.....oyyyyo.....',
    '....oyyYYyyo....',
    '..offffffffffo..',
    '..oFFffffffFFo..',
    '..offffffffffo..',
    '....okkkkkko....',
    '....okekkeko....',
    '....owkKKkwo....',
    '....owwwwwwo....',
    '...orwwwwwwro...',
    '...orrrwwrrro...',
    '...orrrrrrrro...',
    '...orRrrrrRro...',
    '...orrrrrrrro...',
    '...orrrrrrrro...',
    '...orrrrrrrro...',
    '...oddddddddo...',
  ];
  const merchUp = [
    '.....oyyyyo.....',
    '....oyyYYyyo....',
    '..offffffffffo..',
    '..oFFffffffFFo..',
    '..offffffffffo..',
    '....offffffo....',
    '....offffffo....',
    '....oFFFFFFo....',
    '....orrrrrro....',
    '...orrrrrrrro...',
    '...orrrrrrrro...',
    '...orrrrrrrro...',
    '...orRrrrrRro...',
    '...orrrrrrrro...',
    '...orrrrrrrro...',
    '...orrrrrrrro...',
    '...oddddddddo...',
  ];
  const merchSide = [ // facing right: the hat's flap covers the back of the head, the beard hangs at the front
    '....oyyyyo......',
    '....oyyYyyo.....',
    '...offffffffo...',
    '...oFFffffffo...',
    '...offffffffo...',
    '....offkkkko....',
    '....offkkeko....',
    '....offkKwwo....',
    '....oFFwwwwo....',
    '...orrrrrwwo....',
    '...orrrrrrwo....',
    '...orrrrrrro....',
    '...orRrrrrro....',
    '...orrrrrrro....',
    '...orrrrrrro....',
    '...orrrrrrro....',
    '...odddddddo....',
  ];
  const merchFeet = { // the walk is the boots under the hem: planted, the far foot up, the near foot up
    front: [['.....bb..bb.....'], ['.....bb.........'], ['.........bb.....']],
    side:  [['.....bb.bb......'], ['....bb...bb.....'], ['......bbbb......']],
  };
  const merchantPal = (t) => Object.assign({}, PPAL, {
    y: t.coat, Y: t.coatL, f: '#4a3626', F: '#5e4836', w: '#d8d2c4', W: '#b8b0a0',
    r: '#6a5a48', R: '#857460', d: '#473a2d', b: '#4a3324',
  });
  const merchantSet = (pal) => {
    const f = (body, feet) => [0, 1, 2].map((i) => bake(body.concat(feet[i]), pal));
    return {
      down: f(merchDown, merchFeet.front), up: f(merchUp, merchFeet.front),
      right: f(merchSide, merchFeet.side), left: f(merchSide, merchFeet.side).map(flipH),
    };
  };
  const teamMerchants = TEAM_SKINS.map((t) => merchantSet(merchantPal(t)));

  Object.assign(SPRITES, {
    playerTeam: teamPlayers,
    champ: champPlayers,
    LOOK, champLook, // a character's paint on a class body (the `looks` section above)
    merchant: teamMerchants, // merchant[team] - the eagle's driver, a full walking pose set per team colour
    player: teamPlayers[0],
    raider: {
      down: [bake(playerDownIdle, RDPAL), bake(playerDownA, RDPAL), bake(playerDownB, RDPAL)],
      up: [bake(playerUpIdle, RDPAL), bake(playerUpA, RDPAL), bake(playerUpB, RDPAL)],
      right: [bake(playerSideIdle, RDPAL), bake(playerSideA, RDPAL), bake(playerSideB, RDPAL)],
      left: [flipH(bake(playerSideIdle, RDPAL)), flipH(bake(playerSideA, RDPAL)), flipH(bake(playerSideB, RDPAL))],
    },
  });
})();
