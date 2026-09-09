// All pixel art is defined as character grids and baked to canvases at load.
// This keeps every sprite hand-editable, pixel by pixel.
(function () {
  function bake(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const col = pal[row[x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    }
    return c;
  }

  // Per-row [firstX, lastX] of the painted pixels, taken straight off the grid.
  // The game's snow cover needs to know how wide a prone body is on every row;
  // reading that back off the baked canvas would mean a getImageData per pose,
  // and the char grid already knows. Attached to the canvas as `.spans`.
  function spansOf(rows, pal) {
    return rows.map((r) => {
      let lo = 99, hi = -1;
      for (let x = 0; x < r.length; x++) if (pal[r[x]]) { if (x < lo) lo = x; hi = x; }
      return hi < 0 ? null : [lo, hi];
    });
  }
  function bakeSpan(rows, pal) {
    const c = bake(rows, pal);
    c.spans = spansOf(rows, pal);
    return c;
  }


  function flipH(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    // a mirrored pose's spans mirror with it
    if (src.spans) c.spans = src.spans.map((s) => (s ? [src.width - 1 - s[1], src.width - 1 - s[0]] : null));
    return c;
  }

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

  // ---------------------------------------------------------------- trees
  const TPAL = {
    '.': null,
    'o': '#22383a', // outline
    'g': '#2f5c4b', // pine dark
    'G': '#3f7a5c', // pine mid
    'L': '#549468', // pine light
    'w': '#eef4fb', // snow
    'W': '#ffffff', // snow bright
    's': '#c9dcee', // snow shade
    'u': '#6f4d38', // trunk
    'U': '#4a3324', // trunk dark
    'c': '#d9ad72', // stump cut face
    'C': '#b9884f', // stump ring
    'v': '#503626', // bark dark
  };

  // The living pine: one tree in 24 bend frames, 27x37 on its own palette
  // (TPAL above still dresses the stump it leaves). Wider and taller than the
  // 16x24 pine it replaced, so it draws at (px - 5, py - 21) - base on the
  // tile's bottom edge, canopy overhanging the tile above. Which frame a tree
  // wears is not its own business: treeFrame() in js/draw-world.js reads it off
  // the wind wave crossing the field, so the forest rustles as one.
  const TSPAL = {
    '.': null,
    'o': '#040205', // outline
    'k': '#052122', // deepest shade under a bough
    'd': '#0e3c36', // pine darkest
    'g': '#184b3e', // pine dark
    'h': '#265c47', // pine mid-dark
    'G': '#2e6c44', // pine mid
    'L': '#3a7c4d', // pine light
    'l': '#67a584', // needle highlight
    'm': '#76a9ab', // frosted needle
    's': '#b4dfe6', // snow shade
    'S': '#c7f4e8', // snow mid
    'w': '#d8f8f6', // snow
    'U': '#462422', // trunk dark
    'u': '#6f4a2d', // trunk
  };
  // 24 bend frames of one snowy pine, 27x37 - and every one of them is the
  // SAME tree. They used to be sixteen crops of sixteen variant trees, which
  // meant a swaying pine morphed its own branches from frame to frame and a
  // gust could not push a stand of them anywhere together; these are
  // docs/media/new_media/001.png leaning by different amounts, so a front
  // crossing the treeline lays every tree inside it over the same way.
  // The array is a LADDER, not a cycle: index 0 is the tree thrown fully
  // left, 23 fully right, 11 and 12 are it standing straight up. That is what
  // lets treeFrame() (js/draw-world.js) map the wind's SIGNED sway onto an
  // index directly - a frame here is a lean, not a phase.
  // The lean is a tip-loaded cantilever rounded per row: a row h of the way
  // up from the base moves 2.6 * (3h^2 - h^3) / 2 px, which is zero slope
  // where the trunk meets the snow, all of the curve in the crown, and 6px of
  // travel at the tip from one end of the ladder to the other. Rows round at
  // different heights, so 21 of the 24 frames are distinct pixels.
  const treeSway = [
    [ //  0  tip left  3px
      '..........o................',
      '..........owo..............',
      '..........owo..............',
      '.........oswso.............',
      '.........owwwo.............',
      '........oswwwso............',
      '........owwwwwo............',
      '.......owwwwswwo...........',
      '......oswgswswsso..........',
      '.......okgssggso...........',
      '......ohhggggGggo..........',
      '......owGGGGdGGGGho........',
      '.....owwwGwGGGwwGsso.......',
      '.....ookhwGGGsGwwkko.......',
      '......ohdwdGwskGwho........',
      '......oGdkgGwkdkkLo........',
      '.....owSghwGdgGGGGwo.......',
      '....owwGGwwdgGGGGSwwo......',
      '...owwGwGGGGGggwGGLwwo.....',
      '..oGLLdhwGGdGGwwGGwGGwo....',
      '...ooogwwGwLGGGwwGdsko.....',
      '....odwwhdwwwskGwsddo......',
      '...ogddwdhdGwskddssdGo.....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ //  1  tip left  2px
      '...........o...............',
      '..........owo..............',
      '..........owo..............',
      '.........oswso.............',
      '.........owwwo.............',
      '........oswwwso............',
      '........owwwwwo............',
      '.......owwwwswwo...........',
      '......oswgswswsso..........',
      '.......okgssggso...........',
      '.......ohhggggGggo.........',
      '......owGGGGdGGGGho........',
      '.....owwwGwGGGwwGsso.......',
      '.....ookhwGGGsGwwkko.......',
      '......ohdwdGwskGwho........',
      '......oGdkgGwkdkkLo........',
      '.....owSghwGdgGGGGwo.......',
      '....owwGGwwdgGGGGSwwo......',
      '...owwGwGGGGGggwGGLwwo.....',
      '..oGLLdhwGGdGGwwGGwGGwo....',
      '...ooogwwGwLGGGwwGdsko.....',
      '....odwwhdwwwskGwsddo......',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ //  2  tip left  2px
      '...........o...............',
      '..........owo..............',
      '..........owo..............',
      '.........oswso.............',
      '.........owwwo.............',
      '........oswwwso............',
      '........owwwwwo............',
      '.......owwwwswwo...........',
      '.......oswgswswsso.........',
      '........okgssggso..........',
      '.......ohhggggGggo.........',
      '......owGGGGdGGGGho........',
      '.....owwwGwGGGwwGsso.......',
      '.....ookhwGGGsGwwkko.......',
      '......ohdwdGwskGwho........',
      '......oGdkgGwkdkkLo........',
      '.....owSghwGdgGGGGwo.......',
      '....owwGGwwdgGGGGSwwo......',
      '...owwGwGGGGGggwGGLwwo.....',
      '..oGLLdhwGGdGGwwGGwGGwo....',
      '...ooogwwGwLGGGwwGdsko.....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ //  3  tip left  2px
      '...........o...............',
      '..........owo..............',
      '..........owo..............',
      '.........oswso.............',
      '.........owwwo.............',
      '........oswwwso............',
      '.........owwwwwo...........',
      '........owwwwswwo..........',
      '.......oswgswswsso.........',
      '........okgssggso..........',
      '.......ohhggggGggo.........',
      '......owGGGGdGGGGho........',
      '.....owwwGwGGGwwGsso.......',
      '.....ookhwGGGsGwwkko.......',
      '......ohdwdGwskGwho........',
      '......oGdkgGwkdkkLo........',
      '.....owSghwGdgGGGGwo.......',
      '....owwGGwwdgGGGGSwwo......',
      '...owwGwGGGGGggwGGLwwo.....',
      '..oGLLdhwGGdGGwwGGwGGwo....',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ //  4  tip left  2px
      '...........o...............',
      '..........owo..............',
      '..........owo..............',
      '..........oswso............',
      '..........owwwo............',
      '.........oswwwso...........',
      '.........owwwwwo...........',
      '........owwwwswwo..........',
      '.......oswgswswsso.........',
      '........okgssggso..........',
      '.......ohhggggGggo.........',
      '......owGGGGdGGGGho........',
      '.....owwwGwGGGwwGsso.......',
      '.....ookhwGGGsGwwkko.......',
      '......ohdwdGwskGwho........',
      '......oGdkgGwkdkkLo........',
      '.....owSghwGdgGGGGwo.......',
      '....owwGGwwdgGGGGSwwo......',
      '...owwGwGGGGGggwGGLwwo.....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ //  5  tip left  1px
      '............o..............',
      '...........owo.............',
      '...........owo.............',
      '..........oswso............',
      '..........owwwo............',
      '.........oswwwso...........',
      '.........owwwwwo...........',
      '........owwwwswwo..........',
      '.......oswgswswsso.........',
      '........okgssggso..........',
      '.......ohhggggGggo.........',
      '......owGGGGdGGGGho........',
      '.....owwwGwGGGwwGsso.......',
      '.....ookhwGGGsGwwkko.......',
      '......ohdwdGwskGwho........',
      '......oGdkgGwkdkkLo........',
      '.....owSghwGdgGGGGwo.......',
      '....owwGGwwdgGGGGSwwo......',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ //  6  tip left  1px
      '............o..............',
      '...........owo.............',
      '...........owo.............',
      '..........oswso............',
      '..........owwwo............',
      '.........oswwwso...........',
      '.........owwwwwo...........',
      '........owwwwswwo..........',
      '.......oswgswswsso.........',
      '........okgssggso..........',
      '.......ohhggggGggo.........',
      '......owGGGGdGGGGho........',
      '.....owwwGwGGGwwGsso.......',
      '.....ookhwGGGsGwwkko.......',
      '......ohdwdGwskGwho........',
      '......oGdkgGwkdkkLo........',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ //  7  tip left  1px
      '............o..............',
      '...........owo.............',
      '...........owo.............',
      '..........oswso............',
      '..........owwwo............',
      '.........oswwwso...........',
      '.........owwwwwo...........',
      '........owwwwswwo..........',
      '.......oswgswswsso.........',
      '........okgssggso..........',
      '.......ohhggggGggo.........',
      '......owGGGGdGGGGho........',
      '.....owwwGwGGGwwGsso.......',
      '......ookhwGGGsGwwkko......',
      '.......ohdwdGwskGwho.......',
      '.......oGdkgGwkdkkLo.......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ //  8  tip left  1px
      '............o..............',
      '...........owo.............',
      '...........owo.............',
      '..........oswso............',
      '..........owwwo............',
      '.........oswwwso...........',
      '.........owwwwwo...........',
      '........owwwwswwo..........',
      '.......oswgswswsso.........',
      '........okgssggso..........',
      '........ohhggggGggo........',
      '.......owGGGGdGGGGho.......',
      '......owwwGwGGGwwGsso......',
      '......ookhwGGGsGwwkko......',
      '.......ohdwdGwskGwho.......',
      '.......oGdkgGwkdkkLo.......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ //  9  tip left  1px
      '............o..............',
      '...........owo.............',
      '...........owo.............',
      '...........oswso...........',
      '...........owwwo...........',
      '..........oswwwso..........',
      '..........owwwwwo..........',
      '.........owwwwswwo.........',
      '........oswgswswsso........',
      '.........okgssggso.........',
      '........ohhggggGggo........',
      '.......owGGGGdGGGGho.......',
      '......owwwGwGGGwwGsso......',
      '......ookhwGGGsGwwkko......',
      '.......ohdwdGwskGwho.......',
      '.......oGdkgGwkdkkLo.......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 10  tip upright
      '.............o.............',
      '............owo............',
      '............owo............',
      '...........oswso...........',
      '...........owwwo...........',
      '..........oswwwso..........',
      '..........owwwwwo..........',
      '.........owwwwswwo.........',
      '........oswgswswsso........',
      '.........okgssggso.........',
      '........ohhggggGggo........',
      '.......owGGGGdGGGGho.......',
      '......owwwGwGGGwwGsso......',
      '......ookhwGGGsGwwkko......',
      '.......ohdwdGwskGwho.......',
      '.......oGdkgGwkdkkLo.......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 11  tip upright
      '.............o.............',
      '............owo............',
      '............owo............',
      '...........oswso...........',
      '...........owwwo...........',
      '..........oswwwso..........',
      '..........owwwwwo..........',
      '.........owwwwswwo.........',
      '........oswgswswsso........',
      '.........okgssggso.........',
      '........ohhggggGggo........',
      '.......owGGGGdGGGGho.......',
      '......owwwGwGGGwwGsso......',
      '......ookhwGGGsGwwkko......',
      '.......ohdwdGwskGwho.......',
      '.......oGdkgGwkdkkLo.......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 12  tip upright
      '.............o.............',
      '............owo............',
      '............owo............',
      '...........oswso...........',
      '...........owwwo...........',
      '..........oswwwso..........',
      '..........owwwwwo..........',
      '.........owwwwswwo.........',
      '........oswgswswsso........',
      '.........okgssggso.........',
      '........ohhggggGggo........',
      '.......owGGGGdGGGGho.......',
      '......owwwGwGGGwwGsso......',
      '......ookhwGGGsGwwkko......',
      '.......ohdwdGwskGwho.......',
      '.......oGdkgGwkdkkLo.......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 13  tip upright
      '.............o.............',
      '............owo............',
      '............owo............',
      '...........oswso...........',
      '...........owwwo...........',
      '..........oswwwso..........',
      '..........owwwwwo..........',
      '.........owwwwswwo.........',
      '........oswgswswsso........',
      '.........okgssggso.........',
      '........ohhggggGggo........',
      '.......owGGGGdGGGGho.......',
      '......owwwGwGGGwwGsso......',
      '......ookhwGGGsGwwkko......',
      '.......ohdwdGwskGwho.......',
      '.......oGdkgGwkdkkLo.......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 14  tip right 1px
      '..............o............',
      '.............owo...........',
      '.............owo...........',
      '...........oswso...........',
      '...........owwwo...........',
      '..........oswwwso..........',
      '..........owwwwwo..........',
      '.........owwwwswwo.........',
      '........oswgswswsso........',
      '.........okgssggso.........',
      '........ohhggggGggo........',
      '.......owGGGGdGGGGho.......',
      '......owwwGwGGGwwGsso......',
      '......ookhwGGGsGwwkko......',
      '.......ohdwdGwskGwho.......',
      '.......oGdkgGwkdkkLo.......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 15  tip right 1px
      '..............o............',
      '.............owo...........',
      '.............owo...........',
      '............oswso..........',
      '............owwwo..........',
      '...........oswwwso.........',
      '...........owwwwwo.........',
      '..........owwwwswwo........',
      '.........oswgswswsso.......',
      '..........okgssggso........',
      '........ohhggggGggo........',
      '.......owGGGGdGGGGho.......',
      '......owwwGwGGGwwGsso......',
      '......ookhwGGGsGwwkko......',
      '.......ohdwdGwskGwho.......',
      '.......oGdkgGwkdkkLo.......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 16  tip right 1px
      '..............o............',
      '.............owo...........',
      '.............owo...........',
      '............oswso..........',
      '............owwwo..........',
      '...........oswwwso.........',
      '...........owwwwwo.........',
      '..........owwwwswwo........',
      '.........oswgswswsso.......',
      '..........okgssggso........',
      '.........ohhggggGggo.......',
      '........owGGGGdGGGGho......',
      '.......owwwGwGGGwwGsso.....',
      '......ookhwGGGsGwwkko......',
      '.......ohdwdGwskGwho.......',
      '.......oGdkgGwkdkkLo.......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 17  tip right 1px
      '..............o............',
      '.............owo...........',
      '.............owo...........',
      '............oswso..........',
      '............owwwo..........',
      '...........oswwwso.........',
      '...........owwwwwo.........',
      '..........owwwwswwo........',
      '.........oswgswswsso.......',
      '..........okgssggso........',
      '.........ohhggggGggo.......',
      '........owGGGGdGGGGho......',
      '.......owwwGwGGGwwGsso.....',
      '.......ookhwGGGsGwwkko.....',
      '........ohdwdGwskGwho......',
      '........oGdkgGwkdkkLo......',
      '......owSghwGdgGGGGwo......',
      '.....owwGGwwdgGGGGSwwo.....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 18  tip right 1px
      '..............o............',
      '.............owo...........',
      '.............owo...........',
      '............oswso..........',
      '............owwwo..........',
      '...........oswwwso.........',
      '...........owwwwwo.........',
      '..........owwwwswwo........',
      '.........oswgswswsso.......',
      '..........okgssggso........',
      '.........ohhggggGggo.......',
      '........owGGGGdGGGGho......',
      '.......owwwGwGGGwwGsso.....',
      '.......ookhwGGGsGwwkko.....',
      '........ohdwdGwskGwho......',
      '........oGdkgGwkdkkLo......',
      '.......owSghwGdgGGGGwo.....',
      '......owwGGwwdgGGGGSwwo....',
      '....owwGwGGGGGggwGGLwwo....',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 19  tip right 2px
      '...............o...........',
      '..............owo..........',
      '..............owo..........',
      '............oswso..........',
      '............owwwo..........',
      '...........oswwwso.........',
      '...........owwwwwo.........',
      '..........owwwwswwo........',
      '.........oswgswswsso.......',
      '..........okgssggso........',
      '.........ohhggggGggo.......',
      '........owGGGGdGGGGho......',
      '.......owwwGwGGGwwGsso.....',
      '.......ookhwGGGsGwwkko.....',
      '........ohdwdGwskGwho......',
      '........oGdkgGwkdkkLo......',
      '.......owSghwGdgGGGGwo.....',
      '......owwGGwwdgGGGGSwwo....',
      '.....owwGwGGGGGggwGGLwwo...',
      '...oGLLdhwGGdGGwwGGwGGwo...',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 20  tip right 2px
      '...............o...........',
      '..............owo..........',
      '..............owo..........',
      '.............oswso.........',
      '.............owwwo.........',
      '............oswwwso........',
      '...........owwwwwo.........',
      '..........owwwwswwo........',
      '.........oswgswswsso.......',
      '..........okgssggso........',
      '.........ohhggggGggo.......',
      '........owGGGGdGGGGho......',
      '.......owwwGwGGGwwGsso.....',
      '.......ookhwGGGsGwwkko.....',
      '........ohdwdGwskGwho......',
      '........oGdkgGwkdkkLo......',
      '.......owSghwGdgGGGGwo.....',
      '......owwGGwwdgGGGGSwwo....',
      '.....owwGwGGGGGggwGGLwwo...',
      '....oGLLdhwGGdGGwwGGwGGwo..',
      '....ooogwwGwLGGGwwGdsko....',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 21  tip right 2px
      '...............o...........',
      '..............owo..........',
      '..............owo..........',
      '.............oswso.........',
      '.............owwwo.........',
      '............oswwwso........',
      '............owwwwwo........',
      '...........owwwwswwo.......',
      '.........oswgswswsso.......',
      '..........okgssggso........',
      '.........ohhggggGggo.......',
      '........owGGGGdGGGGho......',
      '.......owwwGwGGGwwGsso.....',
      '.......ookhwGGGsGwwkko.....',
      '........ohdwdGwskGwho......',
      '........oGdkgGwkdkkLo......',
      '.......owSghwGdgGGGGwo.....',
      '......owwGGwwdgGGGGSwwo....',
      '.....owwGwGGGGGggwGGLwwo...',
      '....oGLLdhwGGdGGwwGGwGGwo..',
      '.....ooogwwGwLGGGwwGdsko...',
      '.....odwwhdwwwskGwsddo.....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 22  tip right 2px
      '...............o...........',
      '..............owo..........',
      '..............owo..........',
      '.............oswso.........',
      '.............owwwo.........',
      '............oswwwso........',
      '............owwwwwo........',
      '...........owwwwswwo.......',
      '..........oswgswswsso......',
      '...........okgssggso.......',
      '.........ohhggggGggo.......',
      '........owGGGGdGGGGho......',
      '.......owwwGwGGGwwGsso.....',
      '.......ookhwGGGsGwwkko.....',
      '........ohdwdGwskGwho......',
      '........oGdkgGwkdkkLo......',
      '.......owSghwGdgGGGGwo.....',
      '......owwGGwwdgGGGGSwwo....',
      '.....owwGwGGGGGggwGGLwwo...',
      '....oGLLdhwGGdGGwwGGwGGwo..',
      '.....ooogwwGwLGGGwwGdsko...',
      '......odwwhdwwwskGwsddo....',
      '....ogddwdhdGwskddssdGo....',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
    [ // 23  tip right 3px
      '................o..........',
      '..............owo..........',
      '..............owo..........',
      '.............oswso.........',
      '.............owwwo.........',
      '............oswwwso........',
      '............owwwwwo........',
      '...........owwwwswwo.......',
      '..........oswgswswsso......',
      '...........okgssggso.......',
      '..........ohhggggGggo......',
      '........owGGGGdGGGGho......',
      '.......owwwGwGGGwwGsso.....',
      '.......ookhwGGGsGwwkko.....',
      '........ohdwdGwskGwho......',
      '........oGdkgGwkdkkLo......',
      '.......owSghwGdgGGGGwo.....',
      '......owwGGwwdgGGGGSwwo....',
      '.....owwGwGGGGGggwGGLwwo...',
      '....oGLLdhwGGdGGwwGGwGGwo..',
      '.....ooogwwGwLGGGwwGdsko...',
      '......odwwhdwwwskGwsddo....',
      '.....ogddwdhdGwskddssdGo...',
      '....ogddkdGddwLdddkdgdo....',
      '...owGGGdLwGdkkgGdGGGGwo...',
      '..owwwwGGGGGhdgdGGGGGwwoo..',
      '..owwsGGwwGGwGgGGwGdGGswo..',
      '.owLGGhwwwwwwlGwwwGdGwGLwo.',
      'oGLgkGwshwsswwGGGssdwGkLLwo',
      '.oooGwlgdwsGssgGGGsdGSkoooo',
      '...oGGGokGGdGsoddLLodLwo...',
      '...oooo.oLLoGoUooGo.oooo...',
      '.........ooUoUUUoo.........',
      '..........oUUuuUo..........',
      '..........oUuuuUo..........',
      '..........oUuuuUo..........',
      '...........ooooo...........',
    ],
  ];

  const stump = [
    '.....oooooo.....',
    '....occcccco....',
    '....ocCCCCco....',
    '....occCCcco....',
    '....ovuuuuvo....',
    '....ovuUUuvo....',
    '.....ossssÐ¾.....'.replace('Ð¾', 'o'),
    '................',
  ];

  // ---------------------------------------------------------------- rocks
  const RPAL = {
    '.': null,
    'o': '#3a3f52', // outline
    'y': '#8b93a8', // rock mid
    'Y': '#a8b0c4', // rock light
    'v': '#666d84', // rock dark
    'w': '#eef4fb',
    'W': '#ffffff',
    's': '#c9dcee',
  };

  const rock1 = [
    '................',
    '.....owwWo......',
    '....owwwwso.....',
    '...oYwwYyyo.....',
    '..oYYyyyyyvo....',
    '..oYyyyyvvvo....',
    '..oyyyvyvvvo....',
    '...ovvvvvvo.....',
    '....ssssss......',
  ];

  const rock2 = [
    '................',
    '......oWwo......',
    '....owwwwwso....',
    '...oYwwwYyyo....',
    '..oYYwYyyyyvo...',
    '..oYYyyyyvvvo...',
    '..oYyyyvyvvvo...',
    '..oyyvvvvvvvo...',
    '...ovvvvvvvo....',
    '....sssssss.....',
  ];

  // ---------------------------------------------------------------- gold ore
  const GOPAL = {
    '.': null,
    'o': '#3a3f52',
    'y': '#8b93a8',
    'Y': '#a8b0c4',
    'v': '#666d84',
    'w': '#eef4fb',
    'W': '#ffffff',
    's': '#c9dcee',
    'n': '#d8a850', // gold
    'N': '#f2cc6a', // gold bright
  };
  const goldOre = [
    '................',
    '......oWwo......',
    '....owwwwwso....',
    '...oYwwnNYyo....',
    '..oYYwYyNnyvo...',
    '..oYYnNyyvnvo...',
    '..oYynvyNyvvo...',
    '..oyyvnNvyvvo...',
    '...ovvvnvvvo....',
    '....sssssss.....',
  ];

  // ---------------------------------------------------------------- gold mine (32x32, occupies 2x2 tiles)
  const MIPAL = {
    '.': null,
    'o': '#2c2c3c', // outline
    'y': '#8b93a8', // rock mid
    'Y': '#a8b0c4', // rock light
    'v': '#666d84', // rock dark
    'V': '#4e5266', // rock deep
    'k': '#0c0f1e', // shaft black
    'K': '#1d2438', // shaft edge
    'u': '#8a6142', // timber
    'U': '#a3794f', // timber light
    'n': '#d8a850', // gold vein
    'N': '#f2cc6a', // gold bright
    'w': '#eef4fb', // snow
    'W': '#ffffff',
    's': '#c9dcee', // snow shade
  };
  const mine = [
    '..............WWw...............',
    '............owwwwwo.............',
    '...........owwwwwwyo............',
    '..........oYwwwwYyyvo...........',
    '.........oYYwwwYYyyyvo..........',
    '........oYYYwwYYyyyyvvo.........',
    '.......oYYYYYYYyyyyvvvvo........',
    '......oYYYYnYYyyyyyvvvvvo.......',
    '.....oYYYYNnYyyyyyyvvvvvvo......',
    '....oYYYYYnYyyyyyyyyvvvvVVo.....',
    '...oYYYwwYYyyyyNnyyyvvvVVVVo....',
    '..oYYYwwwYyyyyyNyyyyvvvvVVVVo...',
    '..oYYYYYyyyyyyyyyyyyvvvvVVVVo...',
    '.oYYYYYyyyoKKKKKKKKovyvvVVVVVo..',
    '.oYYYnNyyoKkkkkkkkkKovvvVVVVVo..',
    '.oYYYYnyyoUuuuuuuuuUovvVVVVVVo..',
    '.oYYYyyyyoUukkkkkkuUovvvVVVVVo..',
    'oYYYyyyyyoUukkkkkkuUoyvvVVVVVVo.',
    'oYYyyyyyyoUukkkkkkuUovvvVVVVVVo.',
    'oYyyyNnyyoUukkkkkkuUovvVvVVVVVo.',
    'oYyyyynyyoUukkkkkkuUovvvVVVVVVo.',
    'oYyyyyyyyoUukkkkkkuUovvVVVVVVVo.',
    'oyyyyyyyyoUukkkkkkuUonvVVVVVVVo.',
    'oyyyynyyyoUukkkkkkuUoNnVVVVVVVo.',
    'oyyyyyyyyoUukkkkkkuUovvVVVVVVVo.',
    'oyyyyyyyyoUukkkkkkuUovvVVVVVVVo.',
    '.oyyyyyyyoUukkkkkkuUovvVVVVVVo..',
    '.oyyyyyyyoUukkkkkkuUovvVVVVVo...',
    '..ooyyyyyoUukkkkkkuUovvVVVoo....',
    '....ooooooooskkkksoooooooo......',
    '.....ssssssssssssssssssss.......',
    '................................',
  ];

  // ---------------------------------------------------------------- bush
  const BPAL = {
    '.': null,
    'o': '#22383a',
    'g': '#3a6b52',
    'G': '#4c8560',
    'r': '#d6454f', // berry
    'R': '#f2707a', // berry shine
    'w': '#eef4fb',
    's': '#c9dcee',
    'b': '#b9d9a4', // bud: pale, unripe
    'd': '#7b2c3a', // berry coming in: dull, no shine yet
  };

  const bush = [
    '................',
    '....owwwso......',
    '...ogwGgGgo.....',
    '..ogGrGGgrGo....',
    '..oGgRGgGgGgo...',
    '..ogGgGrGRgGo...',
    '...ogGgGgGgo....',
    '....ssssss......',
  ];
  const bushEmpty = [
    '................',
    '....owwwso......',
    '...ogwGgGgo.....',
    '..ogGgGGggGo....',
    '..oGgGGgGgGgo...',
    '..ogGgGgGGgGo...',
    '...ogGgGgGgo....',
    '....ssssss......',
  ];
  // the regrow clock, read off the plant (BUSH_BUD_T / BUSH_RIPEN_T,
  // js/world.js): pale buds where the berries will be, then the berries
  // back but dull, then `bush` again. Same silhouette, only the four berry
  // pixels change, so the stage reads without the bush seeming to move.
  const bushBud = [
    '................',
    '....owwwso......',
    '...ogwGgGgo.....',
    '..ogGbGGgbGo....',
    '..oGgGGgGgGgo...',
    '..ogGgGbGbgGo...',
    '...ogGgGgGgo....',
    '....ssssss......',
  ];
  const bushRipen = [
    '................',
    '....owwwso......',
    '...ogwGgGgo.....',
    '..ogGdGGgdGo....',
    '..oGgdGgGgGgo...',
    '..ogGgGdGdgGo...',
    '...ogGgGgGgo....',
    '....ssssss......',
  ];

  // ---------------------------------------------------------------- imp
  const IPAL = {
    '.': null,
    'o': '#141f3d', // outline
    'i': '#5f8fc0', // ice body mid
    'I': '#8fc2dd', // ice light (top)
    'j': '#41628f', // ice shade
    'e': '#101a33', // eye socket
    'E': '#54f0e6', // eye glow
    'h': '#c6ecf4', // horn
    'H': '#8fc2dd', // horn shade
  };

  const imp1 = [
    '..............',
    '...oo....oo...',
    '..ohho..ohho..',
    '..oHho..oHho..',
    '...oiIIIIio...',
    '..oiIIIIIIio..',
    '.oiIeeIIeeIio.',
    '.oiIeEIIeEIio.',
    '.oiIIIIIIIiÑ˜o.'.replace('Ñ˜', 'j'),
    '.oijIIooIIjjo.',
    '..oijjjjjjjo..',
    '...ooooooÐ¾o...'.replace('Ð¾', 'o'),
    '..ojjo..ojjo..',
    '...oo....oo...',
  ];
  const imp2 = [
    '..............',
    '..............',
    '...oo....oo...',
    '..ohho..ohho..',
    '..oHhooooHho..',
    '..oiIIIIIIio..',
    '.oiIeeIIeeIio.',
    '.oiIeEIIeEIio.',
    '.oiIIIIIIIijo.',
    '.oijIIooIIjjo.',
    '..oijjjjjjjo..',
    '.ojjoooooojjo.',
    '..oo......oo..',
    '..............',
  ];

  // ---------------------------------------------------------------- rabbit
  // The meadow's bunny, side view facing right: a chunky brown hare with a
  // pink inner ear and one white glint in the eye. Three sheets out of
  // docs/media/new_media3/ split at 32 px into the three CLIPS a behaviour
  // plays (ANIM_CLIPS, js/wildlife.js): `idle` is
  // bunny_facing_right_gently_look_around, `hop` is
  // bunny_facing_right_hopping_right, `rise` is
  // bunny_facing_right_stand_up_and_wiggle - the sit-up a rabbit that has
  // noticed you does. The source order IS the animation order in all three.
  //
  // The sheets are drawn far bigger than the meadow wants them - at its own
  // cell size this bunny stands taller than a 16 px player - so the offline
  // pass that made these grids RESAMPLED each frame down to the 11x12 they
  // ship at, snapping every pixel onto RBPAL and every edge to hard alpha.
  // What is written here is therefore what draws: bake() paints it 1:1, and
  // editing a character here changes exactly one pixel in the game. (Baking
  // the big grid and halving it at load - an alpha-weighted 2x2 average, which
  // this file used to do for the gold sack - leaves every edge a soft fringe
  // and invents colours the palette never had: pixel art with the pixels
  // sanded off. Snapping offline keeps both hard.)
  //
  // All three clips share ONE crop of the source, the box every frame of
  // every clip fits inside, or a clip taking over would jump against the one
  // it replaced.
  const RBPAL = {
    '.': null,
    'o': '#040102', // outline
    'e': '#22110a', // eye, and the deepest shadow
    'D': '#371c0f', // fur, deepest
    'd': '#512c1c', // fur, dark
    's': '#73472d', // fur, shade
    'S': '#88593a', // fur, shade light
    'f': '#9a6a45', // fur
    'F': '#b27f57', // fur, light
    'h': '#c29068', // fur, highlight
    'p': '#c9897f', // inner ear
    'w': '#d0c8be', // eye glint
  };

  const rabbitIdle = [
    [
      '...........',
      '....eDDd...',
      '....sSds...',
      '....dFssd..',
      '.....dSfFs.',
      '.....sfSfS.',
      '...ddSfsffD',
      '..dffSSfSs.',
      '.eSfSfSSSD.',
      'DdffSffhhd.',
      '.eSfssfSd..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '.....d.d...',
      '....sfDsD..',
      '....DFsss..',
      '.....dfFFs.',
      '.....sSffS.',
      '...ddSfSfsD',
      '..dffsSfsS.',
      '.eSfSfSSSD.',
      'DdffSffhhd.',
      '.eSfssfSd..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '.....s.DD..',
      '.....SDdd..',
      '.....Ssss..',
      '.....sfFfD.',
      '.....SSffs.',
      '...ddfsffs.',
      '..dfSsffsd.',
      '.eSfSfSSSD.',
      'DdffSffhhd.',
      '.eSfssfSd..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '.....s..d..',
      '.....Sdds..',
      '.....ssss..',
      '.....sfFfD.',
      '.....SSffd.',
      '...dsfSfSs.',
      '..dffsfSSd.',
      '.effSfSffd.',
      'DdffSfFhhd.',
      '.DSfssffd..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '.....dD.D..',
      '.....SDdd..',
      '.....Ssss..',
      '.....sfFfD.',
      '.....SSffd.',
      '...dsfSfSs.',
      '..dffsfSSd.',
      '.eSfSfSffd.',
      'DdffSfFhhd.',
      '.eSfssffd..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '.....dD.D..',
      '.....SdDs..',
      '.....Ssss..',
      '.....sfFfD.',
      '.....SSffd.',
      '...dsfSffs.',
      '..dffSfSSd.',
      '.DffSfSffd.',
      '.dffSfFhhd.',
      '.eSfssffd..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '.....s.DD..',
      '.....Sedd..',
      '.....Sdsd..',
      '.....sfFfD.',
      '.....SSffd.',
      '...ddfSffs.',
      '..dfSsffsd.',
      '.offSfSSSd.',
      'DdffSffhhd.',
      '.dSfssffd..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '.....d.dD..',
      '....dSDsd..',
      '.....Ssss..',
      '.....dffFs.',
      '.....sSffS.',
      '...ddSfSfSD',
      '..dffsSfsS.',
      '.eSfSfSSSD.',
      'DdffSffhhd.',
      '.eSfssfSd..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '....eDDd...',
      '....sSdsD..',
      '....dFssd..',
      '.....dSfFs.',
      '.....sfsfS.',
      '...ddSfsffD',
      '..dffsSfSs.',
      '.eSfSfSSSD.',
      'DdffSffhhd.',
      '.eSfssfSd..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '....eDDd...',
      '....sSds...',
      '....dFssd..',
      '.....dSfFs.',
      '.....sfSfS.',
      '...ddSfsffD',
      '..dffsSfSs.',
      '.eSfSfSSSD.',
      'DdffSffhhd.',
      '.eSfssfSd..',
      '..DddDdDD..',
    ]
  ];

  const rabbitHop = [
    [
      '...........',
      '....eDDd...',
      '....dSds...',
      '....DFssd..',
      '.....dSfFs.',
      '.....sfSfS.',
      '...ddSfsffD',
      '..dffSSfSs.',
      '.eSfSfSSSD.',
      'DsffSffhhd.',
      '.eSfsSfSs..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '...........',
      '....dsDd...',
      '....dFssD..',
      '.....FsSs..',
      '.....dffFs.',
      '...ddsfsfS.',
      '..dfSSfSfSD',
      '.eSfSSSSSd.',
      'DdffSffffd.',
      '.eSfsSsFf..',
      '..DddddDD..',
    ],
    [
      '...........',
      '...........',
      '....DDdD...',
      '....SSdde..',
      '.....SSfFd.',
      '.....dfSfS.',
      '..DsSSfsfS.',
      '..sffSfffSD',
      'DsffffSSsd.',
      '.dffSffFhd.',
      '.ofssssss..',
      '..ddeDee...',
    ],
    [
      '.....e.....',
      '....sddd...',
      '....ffsSs..',
      '.....sffFs.',
      '.....sfsfS.',
      '...ssSfSfSD',
      '.esffSSSSd.',
      'DdffffSSfd.',
      '.dffffSfSd.',
      '.SfSfhfeoD.',
      '.SDDsdD....',
      '.d.eD......',
    ],
    [
      '...........',
      '....dddd...',
      '....sSssD..',
      '.....sSfFd.',
      '....DdfSfS.',
      '..dSSSfsffD',
      'DsSffsSffsD',
      '.dffffSSsD.',
      '.sffSfffhs.',
      'dSsdssdsfse',
      'd..D....Dd.',
      '...........',
    ],
    [
      '...........',
      '...........',
      '....DDDD...',
      '....sSds...',
      '.....FsSs..',
      '.....dffFs.',
      '..DsSsfsfS.',
      '.DSfsSfSfSD',
      'DdffSsSSSd.',
      '.DffSffffd.',
      '..sdsSfFfD.',
      '.....eDdDD.',
    ]
  ];

  const rabbitRise = [
    [
      '...........',
      '....eDDd...',
      '....dSds...',
      '....dFssd..',
      '.....dSfFs.',
      '.....sfSfS.',
      '...ddSfsffD',
      '..dffsSfSs.',
      '.eSfSfSSSD.',
      'DdffSffhhd.',
      '.eSfssfSs..',
      '..DddDdDD..',
    ],
    [
      '...........',
      '....dDdD...',
      '....SSdd...',
      '....dfSSSD.',
      '.....dfffS.',
      '.....sfdfS.',
      '...dsSfffSD',
      '..dffSsSsd.',
      '.oSffffFFd.',
      '.dffSffSSd.',
      '.dsfsfsdeD.',
      '..DddD.....',
    ],
    [
      '.....e.....',
      '....SssD...',
      '....fSsss..',
      '.....sffFs.',
      '.....sfsfS.',
      '....dSfSfSD',
      '...dfSSSSd.',
      '..dfffSffD.',
      '.oSfffSSSd.',
      'DdffSFFd...',
      '.dsfsfs....',
      '..DddD.....',
    ],
    [
      '...........',
      '...dsDdD...',
      '....FSsss..',
      '.....dffFs.',
      '.....sfsfS.',
      '....dSfSfSD',
      '..DsfSSSSd.',
      '..sfffSSfde',
      '.DffffSsSD.',
      'DdffSFhs...',
      '.esfsfs....',
      '...dde.....',
    ],
    [
      '...........',
      '....sdd....',
      '....SSddD..',
      '....dSSfFd.',
      '.....dfSfS.',
      '...DdSfsffD',
      '..sffSSffsD',
      '.effffSSsD.',
      'DdffSffFhd.',
      '.eSfSfSfdD.',
      '..dSse.e...',
      '...DD......',
    ],
    [
      '...........',
      '...........',
      '.....Sdd...',
      '.....Fsde..',
      '.....sSfFs.',
      '....dDSSffD',
      '..sffsfsffd',
      'DdfffSSffSd',
      'ddffSfSsSd.',
      '.DffSffFFD.',
      '..dssdSfS..',
      '.......dDe.',
    ],
    [
      '...........',
      '...........',
      '....DdDD...',
      '....dfdde..',
      '.....fSfFs.',
      '.....eSSffD',
      '..Dsfsfsffd',
      '..sffSfffSd',
      'DsffffSsSd.',
      '.dfffffFhd.',
      '..sfsSfffD.',
      '...DdDDdDe.',
    ],
    [
      '...........',
      '.....DDd...',
      '....dSds...',
      '....dFssd..',
      '.....dSfFs.',
      '.....sfSfS.',
      '...ddSfsffD',
      '..dffsSfSs.',
      '.eSfSffSSD.',
      'DdffSffhhd.',
      '.eSfssfSs..',
      '..DddDdDD..',
    ]
  ];

  // ---------------------------------------------------------------- deer
  // The stag, side view facing right: warm coat, pale antlers, dark slender
  // legs. Three sheets out of docs/media/new_media3/ split at 38 px into the
  // clips (ANIM_CLIPS, js/wildlife.js): `idle` is
  // deer_facing_right_gently_look_around (head up, watching), `graze` is
  // deer_facing_right_grazing_loop (head down into the snow and back) and
  // `run` is deer_facing_right_galloping. Head up against head down is the
  // whole read on whether it has seen you, which is why the two idles are
  // separate clips rather than one longer loop.
  //
  // Resampled to the 19x19 it ships at and snapped onto DEPAL, the same pass
  // and for the same reason as the rabbit above.
  const DEPAL = {
    '.': null,
    'o': '#040202', // outline
    'e': '#27140b', // eye and hoof, deepest
    'D': '#442514', // coat, deepest
    'd': '#5e361f', // coat, dark
    'v': '#6f4224', // coat, shade
    'n': '#6f5136', // antler, deep
    'b': '#8f582f', // coat
    'a': '#7f6446', // antler
    'B': '#9d6639', // coat, light
    'c': '#9b744f', // antler, warm
    'L': '#b47844', // coat, lit
    'A': '#b48a60', // antler, light
    'C': '#b7986d', // antler, lit
  };

  const deerIdle = [
    [
      '......oo.e..e.e....',
      '......nnD....DDo...',
      '.......nDonoDoD.o..',
      '........nndodoDdo..',
      '.........ednDDDD...',
      '..........nnvbe....',
      '...........eBbBo...',
      '..........oddvdD...',
      '.........oDvLao....',
      '....edddvBvbbAd....',
      '...DLBBLBbdnvbD....',
      '..evbbbbbbbDvvo....',
      '..ovbvbbdbBdde.....',
      '...ebDDvdvBDeo.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oooo......',
    ],
    [
      '......oo.e..oDoD...',
      '......nnD....eeD...',
      '.......aDone.odoo..',
      '........nnddooDdo..',
      '.........ednDdDD...',
      '.........DcDvbe....',
      '..........ovaLdo...',
      '..........odvdv....',
      '.........oDvBao....',
      '....edddvBvbbAd....',
      '...DLBBLBbdnvbD....',
      '..evbbbbbbbDvvo....',
      '..ovbvbbdbBdde.....',
      '...ebDDvdvBDeo.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oooo......',
    ],
    [
      '......oD.e..oeoe...',
      '......dnDo...eeD...',
      '.......nDnoD.DDoo..',
      '........naDn.DDD...',
      '.........edaodDo...',
      '.........DBDbvo....',
      '..........obnBo....',
      '..........ovvdD....',
      '.........oDbano....',
      '....edddvBvvALe....',
      '...DLBBLBbdvvbe....',
      '..evbbbbbbbDddo....',
      '..ovbvbbdbBDde.....',
      '...ebDDvdbvDeo.....',
      '...DDeeooveoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oooo......',
    ],
    [
      '.......doe...e.e...',
      '......ocDo....Ddo..',
      '.......dDnoD.DoDo..',
      '........naed.DDD...',
      '.........edaodDo...',
      '.........DBDvve....',
      '..........obano....',
      '..........ovvdD....',
      '.........oDnano....',
      '....edddvBvvALe....',
      '...DLBBLBbdvvbe....',
      '..evbbbbbBBDddo....',
      '..ovbvbbvbBdde.....',
      '...ebDDvvbbDeo.....',
      '...DDeeoebooe......',
      '..eDoe...eeoe......',
      '..Do.o...oDoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oooo......',
    ],
    [
      '.......doe...e.e...',
      '......ocDo....Ddo..',
      '.......dDnoD.DoDo..',
      '........naed.DDd...',
      '.........edaodDo...',
      '.........DBDvve....',
      '..........obano....',
      '..........ovvdD....',
      '.........oDnano....',
      '....edddvBvvALe....',
      '...DLBBLBbdvvbe....',
      '..evbbbbbbbDdDo....',
      '..ovbvbbdbBdde.....',
      '...ebDDvdbbDeo.....',
      '...DDeeoeveoe......',
      '..eDoe...Deoe......',
      '..Do.o...oDoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oooo......',
    ],
    [
      '.......doe...e.e...',
      '......ocDo....Ddo..',
      '.......dDnoD.DoDo..',
      '........naed.DDd...',
      '.........edaodD....',
      '.........DdDbvo....',
      '..........ebano....',
      '..........ovvdD....',
      '.........oDnano....',
      '....edddvBvvALe....',
      '...DLBBLBbdvvbe....',
      '..evbbbbbbbDdDo....',
      '..ovbvbbdbBdde.....',
      '...ebDDvdvBDeo.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oooo......',
    ],
    [
      '.......doe...e.e...',
      '......ocDo....De...',
      '.......dDnoD.DoDo..',
      '........naed.DDD...',
      '.........edaodD....',
      '.........Dvdvve....',
      '..........obbBe....',
      '..........odvdv....',
      '.........oDnano....',
      '....edddvBvvALe....',
      '...DLBBLBbdvvbe....',
      '..evbbbbbbbDdDo....',
      '..ovbvbbdbBdde.....',
      '...ebDDvdvBDeo.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oooo......',
    ],
    [
      '......oo.e..e.e....',
      '......nnD....DDo...',
      '.......nDonoDoD.o..',
      '........nndodoDdo..',
      '.........enaDDDD...',
      '..........nnvbe....',
      '...........eBBBo...',
      '..........odvvdD...',
      '.........oDvLao....',
      '....edddvBvbBAd....',
      '...DLBBLBbdnnbD....',
      '..evbbbbbbBDvvo....',
      '..ovbvbbdbBdde.....',
      '...ebDDddvBDeo.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oooo......',
    ],
    [
      '......oo.e..e.e....',
      '......nnD....DDo...',
      '.......nDonoDoD.o..',
      '........nndodoDdo..',
      '.........edaDDDD...',
      '..........bnvbe....',
      '...........eBbBo...',
      '..........odvvdD...',
      '.........oDvLao....',
      '....edddvBvbbAd....',
      '...DLBBLBbdnvbD....',
      '..evbbbbbbBDvvo....',
      '..ovbvbbdbBdde.....',
      '...ebDDvdvBDeo.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oooo......',
    ],
    [
      '......oo.e..e.e....',
      '......nnD....DDo...',
      '.......nDonoDoD.o..',
      '........nndodoDdo..',
      '.........edaDDDD...',
      '..........nnvbe....',
      '...........eBbBo...',
      '..........oddvdD...',
      '.........oDvLao....',
      '....edddvBvbbAd....',
      '...DLBBLBbdnvbD....',
      '..evbbbbbbBDvvo....',
      '..ovbvbbdbBdde.....',
      '...ebDDvdvBDeo.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oooo......',
    ]
  ];

  const deerGraze = [
    [
      '......oo.D..e.e....',
      '......nnD....DDo...',
      '.......aDonoDoD.o..',
      '........nndonoDdo..',
      '.........ednDDDe...',
      '..........nnvbe....',
      '...........eBbBo...',
      '..........odvvdD...',
      '.........oDvLbo....',
      '....edddvBvbbAd....',
      '...dLBBLBbdvvbD....',
      '..evbbbbbbBDvvo....',
      '..ovbvbbdbBdde.....',
      '...ebDDddvbDeo.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oeoo......',
    ],
    [
      '...................',
      '.......Do.D.oeoe...',
      '.......DaD...eeD...',
      '........DDonoDDe.o.',
      '.........dndovoDno.',
      '..........ednDDDD..',
      '...........bnvbe...',
      '...........eDBabo..',
      '.........oeddvddo..',
      '....edddvBdbBcD....',
      '...dLBBLBbvbvLd....',
      '..evbbbbbbbdvvD....',
      '..ovbvbbdbBdvDo....',
      '...ebDDddvbDee.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oe.o......',
    ],
    [
      '...................',
      '...................',
      '.........o.........',
      '.........dodo.o.e..',
      '..........ae...DDo.',
      '..........DadoDoD..',
      '...........nnDnoDeo',
      '............DnDenn.',
      '.........o.oobddo..',
      '....edddvLvdddnne..',
      '...dLBBLBbvbbvbBco.',
      '..evbbbbbbdbbBDodD.',
      '..ovbvbbvbvvbLD....',
      '...ebDDddbvdvd.....',
      '...DDeeoovDeo......',
      '..eDoe...DDee......',
      '..Do.o...oe.eo.....',
      '..Do.eo..oDoe......',
      '..oo.oo..oe.e......',
    ],
    [
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '.............n.....',
      '............doo.o..',
      '............dde.eoo',
      '............ed..eD.',
      '.....ooooddoon..ovo',
      '...oDLLBLBBvDne.DDD',
      '..edbBbBBbvbvbndDD.',
      '...ebbbbbBvbbvbdDo.',
      '...ebbDvvbDbBvbdD..',
      '...DveeDDbddBvnvD..',
      '..eDeee..evoeoeBdo.',
      '..Do.o....Doeo.eD..',
      '..Do.eo..odoe......',
      '..oo.oo...eoo......',
    ],
    [
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '..............D....',
      '.............no.oo.',
      '.....ooooDd..dnooDe',
      '....DLLBLLLvede..Do',
      '..edbBbBBbbvvvo..Do',
      '...ebbbbbbvbbdD.ede',
      '...ebbdvvBvbbecddee',
      '...evDedvbDvvBvveo.',
      '..edeeeooebdbvBbo..',
      '..Deoe....DeeDnbo..',
      '..Do.eo..odoeovBo..',
      '..oo.oo...eoo..D...',
    ],
    [
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '..............d..o.',
      '.....ooooDd..eaooDe',
      '...oDLLBLBLvedn..eD',
      '..edbBbBBbbvvvo..Do',
      '...ebbbbbBbbbdD..Do',
      '...ebbdvvBvbvenodoD',
      '...evDedvbDbbBnvdo.',
      '..edeeeooebdbdbbo..',
      '..Deoe....Deovabo..',
      '..Do.eo..odoeebBo..',
      '..oo.oo...eoo.DDo..',
    ],
    [
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '.............DD..o.',
      '.............ddooee',
      '.....oooeddo.do..ee',
      '...oDLLBLBBvevo..Do',
      '..edbBbBBbbvvno.ono',
      '...ebbbbbbbbvdnoDeD',
      '...ebbdvvBdbvBndDe.',
      '...evDeDdbdbbvbbe..',
      '..edeee..ebDDvabo..',
      '..Deoe....DeoebBo..',
      '..Do.eo..odoe.DDo..',
      '..oo.oo...eoo......',
    ],
    [
      '...................',
      '...................',
      '...................',
      '...................',
      '..........e.Do.o.o.',
      '..........DnD..eee.',
      '...........noD..DDo',
      '...........DDDonoDo',
      '.........o..DvdDoDd',
      '....eddDdBnDeddDDDo',
      '..odLLBLLbbvvdbnd..',
      '..evbbbbbbvbbvvbLd.',
      '..ovbbbbbBvbbLvdnn.',
      '...ebDdvvBDdbce.o..',
      '...DdeeDebDDDD.....',
      '..eDoDe..edoe......',
      '..Do.o....D.eo.....',
      '..Do.eo..oDoe......',
      '..oo.oo..oeoo......',
    ],
    [
      '...................',
      '...................',
      '........o.Do.oeoD..',
      '.......onnD...een..',
      '........econoD.Doo.',
      '.........eadDnoDed.',
      '..........ondnodD..',
      '...........DBvvv...',
      '.........oooevnLdo.',
      '....edddvLvdvdvnv..',
      '...dLBBLBbvbbLdo...',
      '..evbbbbbbvbbAd....',
      '..ovbvbbbBvdvnD....',
      '...ebDDddbvdde.....',
      '...DDeeoeveeo......',
      '..eDoe...DDee......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oeoo......',
    ],
    [
      '..........o.o......',
      '......oDDn...DoD...',
      '.......dnoD.o.De...',
      '........nDdonoDoe..',
      '.........dandonde..',
      '..........oDnDDo...',
      '...........dbdBe...',
      '...........ovBBao..',
      '.........oedvneo...',
      '....edddvBdvcLd....',
      '...dLBBLBbvbvcd....',
      '..evbbbbbbbdnbe....',
      '..ovbvbbdbBDdD.....',
      '...ebDDddvbDe......',
      '...DDeeooDDee......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oeoo......',
    ],
    [
      '......oo.D..e.e....',
      '......nnD....DDo...',
      '.......aDonoDoD.o..',
      '........nndonoDvo..',
      '.........ednDDDe...',
      '.........onnvbe....',
      '...........eBaBo...',
      '..........odvvdD...',
      '.........oDvLbo....',
      '....edddvBvbbAd....',
      '...dLBBLBbdvvbD....',
      '..evbbbbbbBDvvo....',
      '..ovbvbbdbBdde.....',
      '...ebDDddvbDeo.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oeoo......',
    ],
    [
      '......oo.D..e.e....',
      '......nnD....DDo...',
      '.......aDonoDoD.o..',
      '........nndonoDvo..',
      '.........ednDDDe...',
      '..........nnvbe....',
      '...........eBaBo...',
      '..........odvvdD...',
      '.........oDvLbo....',
      '....edddvBvbbAd....',
      '...dLBBLBbdvvbD....',
      '..evbbbbbbBDvvo....',
      '..ovbvbbdbBdde.....',
      '...ebDDddvbDeo.....',
      '...DDeeooDdoe......',
      '..eDoe...eDoe......',
      '..Do.o...oeoe......',
      '..Do.eo..oDoe......',
      '..oo.oo..oeoo......',
    ]
  ];

  const deerRun = [
    [
      '......oo.D..e.e....',
      '......nnD....DDo...',
      '.......nDonoDoD.o..',
      '........nndonoDdo..',
      '.........ednDDDe...',
      '..........nvvbe....',
      '...........eBbBo...',
      '..........odvvdD...',
      '.........oDvLbo....',
      '....edddvBvbbAd....',
      '...dLBBLBbdvvbD....',
      '..evbbbbbbBDvvo....',
      '..ovbvbbdbbdve.....',
      '...ebDDddvbDeo.....',
      '...DDeeooDdoD......',
      '..eDoe...eDoe......',
      '..Do.o...oDoe......',
      '..Do.eo..odoe......',
      '..oo.oo..oeoo......',
    ],
    [
      '......oo.D..eDe....',
      '......DnD....DDo...',
      '.......nDonoaoDDo..',
      '........dndonend...',
      '.........ednddoe...',
      '..........bbnnd....',
      '...........DbBLD...',
      '..........evbdo....',
      '........ooDvLAo....',
      '....eddnBBvbbAd....',
      '...dLBBLBbdvvbD....',
      '..evbbbbbbBdvvo....',
      '..ovbvbbdbBdve.....',
      '..ovbeeDDvveDe.....',
      '..Ddee..obe.oee....',
      '.oDoe...oD...oe....',
      '.oDoe...oD...oo....',
      '.oe.e...Do...o.....',
      '....oo..o..........',
    ],
    [
      '......DDDD..eeDo...',
      '......Dae.D..eD....',
      '.......eaodonoDeo..',
      '........eaadDend...',
      '.........odDndo....',
      '..........evnnvo...',
      '...........DbBBe...',
      '..........evbdo....',
      '.....oooeddvLcD....',
      '...ebLBLBBdbvcd....',
      '..evBbBBbbvdvve....',
      '..ovbbbbvbBDvD.....',
      '...ebddvdbbDDo.....',
      '..evvDeDDbeeoee....',
      '.oDeee..DD....eo...',
      '.Deee...De....oe...',
      '.e.eo..DD.....oo...',
      '.o.oo.oe...........',
      '...o...............',
    ],
    [
      '......oo.D..e.e....',
      '......nnD....DDo...',
      '.......nDonoDoD.o..',
      '........nndonoDdo..',
      '.........ednDDDe...',
      '..........bnvbe....',
      '...........eBbBo...',
      '..........odvvdD...',
      '.....oo..oDvLbo....',
      '...ebLBdnBvbbAd....',
      '..evBbBLBbdvvbD....',
      '..oDbbbbvBBDvvo....',
      '...evbdvdbbDde.....',
      '..eDvdDddbDDeo.....',
      '..Doooooedo.oee....',
      '.oo.oe..eD....ee...',
      '....oooDD......eo..',
      '......oo........o..',
      '...................',
    ],
    [
      '.........o..o.o....',
      '......DDDD..eeDo...',
      '......Dae.D..eD....',
      '.......eaodonoDeo..',
      '........eaadDend...',
      '..........BDndo....',
      '..........evbnvo...',
      '...........DbBBe...',
      '..........evbdo....',
      '....edooeddvLAD....',
      '...DLBBLBBdbvcd....',
      '..evbbvBbbvdbve....',
      '...DbbdbbBBDvD.....',
      '....DbdvdbbDDe.....',
      '...odeeDevdeeo.....',
      '....DDe..DDoe......',
      '.....eooode.e......',
      '......ooDo..oe.....',
      '.............oo....',
    ],
    [
      '.........o..o.o....',
      '......DDDD..eeDo...',
      '......Dae.D..eD....',
      '.......eaodonoDeo..',
      '........eaadDend...',
      '.........odDndo....',
      '..........evbnvo...',
      '...........DbBBe...',
      '..........evbdo....',
      '.....oooeddvLAD....',
      '...ebLBLBBdbvcd....',
      '..evBbBBbbvdbve....',
      '...DbbvbbbBDvD.....',
      '....DbdvDbbdDe.....',
      '....DeeDDDbDe......',
      '....Doee..edo......',
      '....oD.ee.oDo......',
      '.....Do.eoeeo......',
      '......o..o.oo......',
    ],
    [
      '.........o..o.o....',
      '......DDDD..eeDo...',
      '......Dae.D..eD....',
      '.......eaodonoDeo..',
      '........eaadDend...',
      '.........odDnvo....',
      '..........evnnvo...',
      '...........DbBBe...',
      '..........evbdo....',
      '.....oooDddbLAD....',
      '...ebLBLBBdbvcd....',
      '..evBbBBbbvdbve....',
      '..ovbbbbbbBvve.....',
      '...ebvdvddbvDe.....',
      '...odDeDDedvv......',
      '...eDee...ooDD.....',
      '...eeee...Ded......',
      '...od.e...eo.......',
      '...oo.oo..oo.......',
    ],
    [
      '......oo.D..e.e....',
      '......nnD....DDo...',
      '.......nDonoDoD.o..',
      '........nndonoDdo..',
      '.........ednDDDe...',
      '..........bnvbe....',
      '...........eBbBo...',
      '..........odvvdD...',
      '.........oDvLbo....',
      '....edddnBvbbAd....',
      '...dLBBLBbdvvbD....',
      '..evbbbbbbBdvvo....',
      '..ovbvbbvdbbde.....',
      '..ovbeDddddvbD.....',
      '..DDeeoooooooDo....',
      '.oDoD.....e..oD....',
      '.oDeo....ee..oo....',
      '.ee.Do..oe.........',
      '.o..oo.............',
    ],
    [
      '......oo.D..e.e....',
      '......nnD....DDo...',
      '.......nDonoDoDdo..',
      '........nndonoDDo..',
      '.........ednnDDe...',
      '..........bBvbDo...',
      '..........oDBbBo...',
      '..........evvvdo...',
      '........eddvLbo....',
      '...ebLBBBBdbvcd....',
      '..evBbBBbbvvvbe....',
      '..ovbbbbbbbndD.....',
      '..ovbddvddbbbe.....',
      '..evveeDDDeDDvD....',
      '.edDee...oe..oDe...',
      '.eeee....eo....eo..',
      '.doeo...ee.........',
      'oo.eo...o..........',
      '...o...............',
    ],
    [
      '......oo.D..e.e....',
      '......nnD....DDo...',
      '.......nDonoDoD.o..',
      '........nndonoDdo..',
      '.........ednDDDe...',
      '..........bvvbe....',
      '..........oDBbBo...',
      '..........evvvdD...',
      '.....oooeddvLBD....',
      '...ebLBLBBdbvcd....',
      '..evBbBBbbvdbve....',
      '..ovbbbbbbBbdD.....',
      '..ovbddvdDbbve.....',
      '..DvdeoDDDedbe.....',
      '.eDeeo...eeoeDD....',
      'ed..e...ee....eD...',
      'e...e..e........o..',
      '...oo.o............',
      '...................',
    ],
    [
      '.........o..o.o....',
      '......DDDD..eeDo...',
      '......Dae.D..eD....',
      '.......eaodonoDeo..',
      '........eaadDend...',
      '..........bDndo....',
      '..........evbnvo...',
      '...........DbBBD...',
      '..........evbdo....',
      '....eddoeddvLAD....',
      '..odLBBLBBdbvcd....',
      '..evbbbBbbbdvve....',
      '..ovbvbbvbBdve.....',
      '..evbDDdddbvDo.....',
      '.oDeeeooeevd.......',
      '.oD..eo...DD.......',
      'ooe.oe..oeoD.......',
      '........o..DD......',
      '............eo.....',
    ],
    [
      '.........o..o.o....',
      '......DDDD..eeDo...',
      '......Dae.D..eD....',
      '.......eaodonoDeo..',
      '........eaadDend...',
      '.........odDndo....',
      '..........evbnvo...',
      '...........DbBBe...',
      '..........evbdo....',
      '....oDooeddvLAD....',
      '...DLLBLBBdbvcd....',
      '..evBbBBbBndbbe....',
      '..ovbdbbbbbDdD.....',
      '...DbdvvDvbDDe.....',
      '..eddeeDevdeo......',
      '..Dooeo..Deee......',
      '..D...e..Dee.......',
      '.oo...oe.Do........',
      '........oe.........',
    ]
  ];

  // ---------------------------------------------------------------- wall
  const WPAL = {
    '.': null,
    'o': '#3c2a1e',
    'u': '#8a6142', // wood mid
    'U': '#a3794f', // wood light
    'v': '#6b4a30', // wood dark
    'w': '#eef4fb',
    'W': '#ffffff',
    's': '#c9dcee',
    'k': '#3a4056', // iron fitting dark
    'K': '#5c6884', // iron fitting light
    'e': '#ffd95c', // glow
  };
  // stone + gold tier variants: same grids, remapped material hues
  const WPAL_STONE = {
    '.': null,
    'o': '#2a3040',
    'u': '#8b93a8',
    'U': '#a8b0c4',
    'v': '#666d84',
    'w': '#eef4fb',
    'W': '#ffffff',
    's': '#c9dcee',
    'k': '#3a4056',
    'K': '#5c6884',
    'e': '#8fd8ff',
  };
  const WPAL_GOLD = {
    '.': null,
    'o': '#6b4a1e',
    'u': '#d8a850',
    'U': '#f2cc6a',
    'v': '#b9884f',
    'w': '#fff2c0',
    'W': '#ffffff',
    's': '#c9dcee',
    'k': '#4a3a26',
    'K': '#8a6a3a',
    'e': '#fff2c0',
  };

  const wall = [
    '.Ww.......Ww....',
    'owwo.....owwo...',
    'ouUv..Ww.ouUv...',
    'ouUv.owwoouUv.Ww',
    'ouUvoouUvouUvoww',
    'ouUv.ouUvouUvouv',
    'ouUv.ouUvouUv.uv',
    'oUUUUUUUUUUUUUUÐ¾'.replace('Ð¾', 'o'),
    'ovvvvvvvvvvvvvvo',
    'ouUv.ouUvouUv.uv',
    'ouUv.ouUvouUv.uv',
    'ouUv.ouUvouUv.uv',
    'ouUv.ouUvouUv.uv',
    'ovUv.ovUvovUv.Uv',
    'ovvÐ¾.ovvoovvÐ¾.vÐ¾'.replace(/Ð¾/g, 'o'),
    'ssssssssssssssss',
  ];

  // ------------------------------------------------- tiered structures
  // One 16x16 grid per building, baked with WPAL / WPAL_STONE / WPAL_GOLD.
  // wheel glyph only: the live turret is the 32x32 mount below, too big for a segment
  const turretIcon = [
    '................',
    '.....okkko......',
    '....okKKKko.....',
    '...okKuuKkkkkko.',
    '...okKueKkkkkKo.',
    '...okKuuKkkkkko.',
    '....okKKKko.....',
    '.....okkko......',
    '.....ouUvo......',
    '.....ouUvo......',
    '....oouUvoo.....',
    '....ouuUUvo.....',
    '...oouuUUvoo....',
    '...ouuuUUuvo....',
    '...ovvvvvvvvo...',
    '..ssssssssssss..',
  ];
  // The live turret: a 32x32 armoured mount. Rows 0-15 are deliberately empty -
  // that is where drawTurretHead() rasterises the rotating housing and barrel,
  // pivoting on sprite-local (16, 14) just above the collar. Baking the barrel
  // into the grid would lock the gun to one angle.
  const turret = [
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
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........oooooooooooo..........',
    '.........okkkkkkkkkkkko.........',
    '........okKKKKKKKKKKKKko........',
    '........okKwwwwwwwwwwKko........',
    '........okKKKKKKKKKKKKko........',
    '.........okkkkkkkkkkkko.........',
    '..........oUUUUUUUUUUo..........',
    '..........oUuuuuuuuuUo..........',
    '.........ooUuvvvvvvuUoo.........',
    '.........oUUuveeeevuUUo.........',
    '.........oUuuvvvvvvuuUo.........',
    '........ooUuuuuuuuuuuUoo........',
    '........oUUuukkkkkkuuUUo........',
    '.......ooUvvvvvvvvvvvvUoo.......',
    '.......ovvvvvvvvvvvvvvvvo.......',
    '......ssssssssssssssssssss......',
  ];
  const generator = [
    '................',
    '......kk........',
    '.....okko.......',
    '..oooooooooooo..',
    '.ouUUUUUUUUUUvo.',
    '.ouKkkKuuKkkKvo.',
    '.ouKuuKuuKuuKvo.',
    '.ouKkkKeeKkkKvo.',
    '.ouuuuuuuuuuuvo.',
    '.ouvkkkkkkkkvvo.',
    '.ouvkKKKKKKkvvo.',
    '.ouvkkkkkkkkvvo.',
    '.ovuuuuuuuuuuvo.',
    '.ovvvvvvvvvvvvo.',
    '.oooooooooooooo.',
    '.ssssssssssssss.',
  ];
  const spawner = [
    '................',
    '......oooo......',
    '....ooUUUUoo....',
    '...oUUwwwwUUo...',
    '..oUuuUUUUuuUo..',
    '..ouuUUUUUUuuo..',
    '.ouuUUUUUUUUuuo.',
    '.ouuUUookoUUuuo.',
    '.ouuUUokekoUUuo.',
    '.ouuUuookoUuuuo.',
    '.ovuuookkkoouvo.',
    '.ovuookkkkkouvo.',
    '.ovuokkkkkkovvo.',
    '.ovvokkkkkkovvo.',
    '.oooooooooooooo.',
    '.ssssssssssssss.',
  ];

  // Construction scaffolding, shared by every building. Stage 3 is a mostly
  // transparent lattice drawn over the finished sprite.
  const SCPAL = {
    '.': null,
    'o': '#3c2a1e',
    'u': '#8a6142',
    'U': '#a3794f',
    'v': '#6b4a30',
    's': '#c9dcee',
  };
  const scaffold1 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..o..........o..',
    '..u..........u..',
    '..u..........u..',
    '..v..........v..',
    '..u..........u..',
    '..v..........v..',
    '..u...oooo...u..',
    '..v...uUUu...v..',
    '..u..uUuuUu..u..',
    '..vooUuuuuUoov..',
    '.ssssssssssssss.',
  ];
  const scaffold2 = [
    '................',
    '................',
    '................',
    '..oooooooooooo..',
    '..uUUUUUUUUUUu..',
    '..u..........u..',
    '..u..........u..',
    '..uoooooooooou..',
    '..vUUUUUUUUUUv..',
    '..u..........u..',
    '..v..........v..',
    '..uoooooooooou..',
    '..vuuuuuuuuuuv..',
    '..u..uUuuUu..u..',
    '..vooUuuuuUoov..',
    '.ssssssssssssss.',
  ];
  const scaffold3 = [
    '..oooooooooooo..',
    '..uUUUUUUUUUUu..',
    '..uo........ou..',
    '..u.oo....oo.u..',
    '..u..oo..oo..u..',
    '..u...oooo...u..',
    '..u...oooo...u..',
    '..u..oo..oo..u..',
    '..u.oo....oo.u..',
    '..uo........ou..',
    '..u..........u..',
    '..u..........u..',
    '..u..........u..',
    '..u..........u..',
    '..vooooooooooov.',
    '................',
  ];

  // ---------------------------------------------------------------- fish net
  // A fishing net, laid flat over an open water hole (STRUCTS.net, water: true)
  // instead of standing on the snow: it is the one building drawn under
  // everything rather than y-sorted, because a player walks onto it. 14x14 of
  // rope inside a 16x16 tile - a squared frame on four corner floats, a plain
  // orthogonal mesh (a diagonal one turns to mush at this size), and the water
  // showing through every gap. k/K/e are the team fitting/glow keys
  // teamBuildPal swaps, so the frame and the floats carry the owner's colour.
  const NETPAL = {
    '.': null,
    'n': '#c0ab84', // rope
    'N': '#e6d9b6', // rope knot
    'k': '#3a4056', // frame dark  (team fit)
    'K': '#5c6884', // frame light (team fitL)
    'e': '#ffd95c', // corner float (team glow)
  };
  const net = [
    '................',
    '.ekKKKKKKKKKKke.',
    '..k..n..n..n.k..',
    '..K..n..n..n.K..',
    '..k..n..n..n.k..',
    '..knnNnnNnnNnk..',
    '..K..n..n..n.K..',
    '..k..n..n..n.k..',
    '..KnnNnnNnnNnK..',
    '..k..n..n..n.k..',
    '..K..n..n..n.K..',
    '..knnNnnNnnNnk..',
    '..K..n..n..n.K..',
    '..k..n..n..n.k..',
    '.ekKKKKKKKKKKke.',
    '................',
  ];

  // ---------------------------------------------------------------- bot bay
  // The spawner: a 48x38 bot garage on a 3x2 tile footprint (see STRUCTS.spawner
  // w/h), drawn with its snow skirt on the footprint's bottom edge. Steel
  // plate walls; the outline runs along the roof's top edge and a plain two-row snow cap sits on it unoutlined (a few 1px drips),
  // a team-painted lintel band (L/T/t) above a 20px-wide bay with a dark
  // interior and a lit floor lip (doorway cols 14-33, rows 13-35, floor row 36), riveted flanks with a vent grille and a
  // hazard stripe, the mouth open to the ground. One tier, so no WPAL swap -
  // bayTeamPal only paints the band. bayIcon is the 16x16 wheel glyph.
  const BAYPAL = {
    '.': null,
    'o': '#1c2130', // outline
    'S': '#f4f7fc', // snow
    's': '#dce5f0', // snow shade
    'z': '#b9c9db', // snow edge / icicle
    'P': '#b9c1cd', // plate light
    'p': '#98a1b0', // plate
    'q': '#7d8696', // plate shade
    'n': '#5b6473', // seam
    'r': '#d3d9e2', // rivet
    'g': '#3f4755', // grille slot
    'k': '#2c3340', // bay wall
    'K': '#1b202a', // bay deep
    'f': '#3b4150', // bay floor
    'F': '#6c7486', // floor lip
    'y': '#e0b83f', // hazard yellow
    'Y': '#2a2f3a', // hazard dark
    'L': '#df7358', // team light
    'T': '#c9524e', // team
    't': '#96393f', // team dark
    'w': '#c9dcee', // snow skirt
  };
  const bay = [
    '...SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS...',
    '...ssssssssssssssssssssssssssssssssssssssssss...',
    '..oooooooooooooooooooooooooooooooooooooooooooo..',
    '..ozPPPPPPPPPzPPPPPPPPPPPPPPPPzPPPPPPPPPPPPPzo..',
    '..oqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo..',
    '..oPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPo..',
    '..opLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLpo..',
    '..opTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTpo..',
    '..opTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTpo..',
    '..opTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTpo..',
    '..opttttttttttttttttttttttttttttttttttttttttpo..',
    '..onnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnno..',
    '..oPPPPPPPPPPooooooooooooooooooooooPPPPPPPPPPo..',
    '..orpppppppproKKKKKKKKKKKKKKKKKKKKorqqqqqqqqro..',
    '..oppppppppppoKKKKKKKKKKKKKKKKKKKKoqqqqqqqqqqo..',
    '..oppppppppppokkkkkkKkkkkkkKkkkkkkoqqqqqqqqqqo..',
    '..oppppppppppokkkkkkKkkkkkkKkkkkkkoqqqqqqqqqqo..',
    '..oppggggggppokkkkkkKkkkkkkKkkkkkkoqqggggggqqo..',
    '..oppnnnnnnppokkkkkkKkkkkkkKkkkkkkoqqnnnnnnqqo..',
    '..oppggggggppokkkkkkKkkkkkkKkkkkkkoqqggggggqqo..',
    '..oppnnnnnnppokkkkkkKkkkkkkKkkkkkkoqqnnnnnnqqo..',
    '..oppggggggppokkkkkkKkkkkkkKkkkkkkoqqggggggqqo..',
    '..oppppppppppokkkkkkKkkkkkkKkkkkkkoqqqqqqqqqqo..',
    '..oppppppppppokkkkkkKkkkkkkKkkkkkkoqqqqqqqqqqo..',
    '..oppppppppppokkkkkkKkkkkkkKkkkkkkoqqqqqqqqqqo..',
    '..opnnnnnnnnpokkkkkkKkkkkkkKkkkkkkoqnnnnnnnnqo..',
    '..oppppppppppokkkkkkKkkkkkkKkkkkkkoqqqqqqqqqqo..',
    '..oppppppppppokkkkkkKkkkkkkKkkkkkkoqqqqqqqqqqo..',
    '..oppppppppppokkkkkkKkkkkkkKkkkkkkoqqqqqqqqqqo..',
    '..oppppppppppokkkkkkKkkkkkkKkkkkkkoqqqqqqqqqqo..',
    '..oyyYYyyYYyyokkkkkkKkkkkkkKkkkkkkoyyYYyyYYyyo..',
    '..oyYYyyYYyyYokkkkkkKkkkkkkKkkkkkkoyYYyyYYyyYo..',
    '..oYYyyYYyyYYoKKKKKKKKKKKKKKKKKKKKoYYyyYYyyYYo..',
    '..oYyyYYyyYYyoFFFFFFFFFFFFFFFFFFFFoYyyYYyyYYyo..',
    '..oppppppppppoffffffffffffffffffffoqqqqqqqqqqo..',
    '..orpppppppprofffffffffffffffffffforqqqqqqqqro..',
    '..oooooooooooffffffffffffffffffffffooooooooooo..',
    '..wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww..',
  ];
  const bayIcon = [
    '..ssssssssssss..',
    '.oooooooooooooo.',
    '.oqqqqqqqqqqqqo.',
    '.oPPPPPPPPPPPPo.',
    '.oLLLLLLLLLLLLo.',
    '.oTTTTTTTTTTTTo.',
    '.oPPPooooooPPPo.',
    '.opppoKKKKoqqqo.',
    '.opppokkkkoqqqo.',
    '.opppokkkkoqqqo.',
    '.oyYyokkkkoyYyo.',
    '.oYyYokkkkoYyYo.',
    '.opppoffffoqqqo.',
    '.ooooffffffoooo.',
    '.wwwwwwwwwwwwww.',
    '................',
  ];

  // Worker bot: a boxy chassis sitting straight on one full-width tread, stub
  // arms at the sides, no face. One 12x10 grid, two frames (the tread notches
  // shift so it rolls); drawRobot() bobs the whole sprite so body and tread
  // never part. The body (L/T/t) is painted in the team colour.
  const BOTPAL = {
    '.': null,
    'o': '#1c2130', // outline
    'L': '#df7358', // top plate (team light)
    'T': '#c9524e', // body (team)
    't': '#96393f', // body shade (team dark)
    'a': '#b5bcc8', // arm
    'A': '#7d8595', // claw
    'k': '#3b4150', // tread
    'n': '#6c7486', // tread notch
  };
  const botA = [
    '..oooooooo..',
    '.oLLLLLLLLo.',
    'oaoTTTTTToao',
    'oaoTTTTTToao',
    'oAoTTTTTToAo',
    '.oottttttoo.',
    'oooooooooooo',
    'okkkkkkkkkko',
    'oknkknkknkko',
    'oooooooooooo',
  ];
  const botB = botA.slice(0, 8).concat([
    'okknkknkknko',
    'oooooooooooo',
  ]);

  // ---------------------------------------------------------------- spikes
  const SPAL = {
    '.': null,
    'o': '#3c2a1e',
    'u': '#8a6142',
    'U': '#a3794f',
    'v': '#6b4a30',
    's': '#c9dcee',
  };
  const spikes = [
    '................',
    '..o....o....o...',
    '.oUo..oUo..oUo..',
    '.oUv..oUv..oUv..',
    '.oUv..oUv..oUv..',
    '.sos..sos..sos..',
    '................',
    '....o.....o.....',
    '...oUo...oUo....',
    '...oUv...oUv....',
    '...oUv...oUv....',
    '...sos...sos....',
    '................',
    '................',
    '................',
    '................',
  ];

  // ---------------------------------------------------------------- fire
  const FPAL = {
    '.': null,
    'o': '#3c2a1e',
    'u': '#8a6142',
    'U': '#a3794f',
    'v': '#6b4a30',
    'f': '#f2a63c', // flame orange
    'F': '#f6d35c', // flame yellow
    'h': '#e2622e', // flame deep
    'W': '#fff7d9', // flame core
    'y': '#8b93a8', // stone ring
    'Y': '#a8b0c4',
    's': '#c9dcee',
  };

  const fire1 = [
    '................',
    '................',
    '.......f........',
    '......hf........',
    '......hff.......',
    '.....hfFf.......',
    '.....hfFFf......',
    '....hffFWFf.....',
    '....hfFWWFf.....',
    '....hfFWFFfh....',
    '.....ffFFfh.....',
    '..ovuuffuuvo....',
    '.ovuUuUuUuuvo...',
    '..oyossssoyo....',
    '...ssssssss.....',
    '................',
  ];
  const fire2 = [
    '................',
    '................',
    '........f.......',
    '........fh......',
    '.......ffh......',
    '.......fFfh.....',
    '......fFFfh.....',
    '.....ffWFffh....',
    '.....fFWWFfh....',
    '....hfFFWFf.....',
    '.....hfFFff.....',
    '..ovuuffuuvo....',
    '.ovuUuUuUuuvo...',
    '..oyossssoyo....',
    '...ssssssss.....',
    '................',
  ];
  const fire3 = [
    '................',
    '................',
    '................',
    '.......f........',
    '......fFh.......',
    '......fFfh......',
    '.....hfFFf......',
    '.....fFWFfh.....',
    '....hfFWWFf.....',
    '....hffFWFfh....',
    '.....hffFff.....',
    '..ovuuffuuvo....',
    '.ovuUuUuUuuvo...',
    '..oyossssoyo....',
    '...ssssssss.....',
    '................',
  ];

  // fire embers only (for burnt-out look during day it still burns; unused for now)

  // ---------------------------------------------------------------- torch
  const TOPAL = {
    '.': null,
    'o': '#3c2a1e',
    'u': '#8a6142',
    'U': '#a3794f',
    'f': '#f2a63c',
    'F': '#f6d35c',
    'h': '#e2622e',
    'W': '#fff7d9',
    's': '#c9dcee',
  };
  const torch1 = [
    '........',
    '...ff...',
    '..hfFf..',
    '..fFWf..',
    '..hfFh..',
    '...oo...',
    '..ouUo..',
    '...oUo..',
    '...ouo..',
    '...oUo..',
    '...ouo..',
    '...oUo..',
    '..s..s..',
    '........',
  ];
  const torch2 = [
    '........',
    '...f....',
    '..fFfh..',
    '..fWFf..',
    '..hfFh..',
    '...oo...',
    '..ouUo..',
    '...oUo..',
    '...ouo..',
    '...oUo..',
    '...ouo..',
    '...oUo..',
    '..s..s..',
    '........',
  ];

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

  // ---------------------------------------------------------------- gear icons
  // One 12x12 glyph PER VARIANT (12 total), baked once per material - leather /
  // iron / steel / gold - into SPRITES.gearIcons[slot][variant][material], so
  // the icon carries WHICH piece you chose and its material carries the level.
  // Shared accent chars across every material: w ice-white, r hearth-red.
  const GEAR_MAT_PALS = [
    { '.': null, 'o': '#141a2c', 'm': '#8a6a4a', 'h': '#b08a5e', 'd': '#5f4830', 'w': '#ddf1f8', 'r': '#f2707a' }, // leather
    { '.': null, 'o': '#141a2c', 'm': '#9aa3ad', 'h': '#c8ccd4', 'd': '#646c76', 'w': '#ddf1f8', 'r': '#f2707a' }, // iron
    { '.': null, 'o': '#141a2c', 'm': '#9fc4dd', 'h': '#ddf1f8', 'd': '#5f87a8', 'w': '#ffffff', 'r': '#f2707a' }, // steel
    { '.': null, 'o': '#141a2c', 'm': '#f2cc6a', 'h': '#ffedb0', 'd': '#b8912f', 'w': '#ffffff', 'r': '#f2707a' }, // gold
  ];
  // helmet 0 LONGSIGHT: closed helm, one long glowing sight slit
  const gearLongsight = [
    '...oooooo...',
    '..ommhhmmo..',
    '.ommmmmmmmo.',
    '.ommmmmmmmo.',
    '.oddddddddo.',
    '.owwwwwwwdo.',
    '.oddddddddo.',
    '.ommmmmmmmo.',
    '.ommmmmmmmo.',
    '..odo..odo..',
    '..oo....oo..',
    '............',
  ];
  // helmet 1 QUICKDRAW: winged cap, white wings flared at the temples
  const gearQuickdraw = [
    '............',
    '....oooo....',
    '...ommmmo...',
    '..ommhhmmo..',
    '.oommmmmmoo.',
    'owwommmmowwo',
    'owwwodmowwwo',
    '.oowod.dowo.',
    '...o.oo.o...',
    '............',
    '............',
    '............',
  ];
  // helmet 2 HUNTSMAN: peaked hood with a white feather
  const gearHuntsman = [
    '.........ww.',
    '......o.ww..',
    '.....oowwo..',
    '....ommwo...',
    '...ommmmo...',
    '..ommmmmmo..',
    '.ommmmmmmdo.',
    '.omdddddddo.',
    '.odo.....do.',
    '..oo.....o..',
    '............',
    '............',
  ];
  // chest 0 BULWARK: a kite shield
  const gearBulwark = [
    '.oooooooooo.',
    'omhhhhhhmmdo',
    'ommmmmmmmmdo',
    'ommmmmmmmmdo',
    'ommmmmmmmmdo',
    '.ommmmmmmdo.',
    '.ommmmmmmdo.',
    '..ommmmmdo..',
    '...ommmdo...',
    '....omdo....',
    '.....oo.....',
    '............',
  ];
  // chest 1 IRONHIDE: riveted breastplate with shoulder caps
  const gearIronhide = [
    'ooo......ooo',
    'omdo.oo.omdo',
    '.oommmmmmoo.',
    '.ohmmmmmmdo.',
    '.ommhmmhmmo.',
    '.ommmmmmmdo.',
    '.ommhmmhmmo.',
    '.odmmmmmmdo.',
    '..ommmmmmo..',
    '..oddddddo..',
    '...oooooo...',
    '............',
  ];
  // chest 2 HEARTHWEAVE: quilted tunic with a hearth-red heart
  const gearHearthweave = [
    '.oo......oo.',
    '.omoooooomo.',
    '..ommmmmmo..',
    '.ommmmmmmmo.',
    '.omrrmrrmmo.',
    '.omrrrrrmmo.',
    '.ommrrrmmmo.',
    '.ommmrmmmmo.',
    '..ommmmmmo..',
    '..oddddddo..',
    '...oooooo...',
    '............',
  ];
  // legs 0 STRIDER: greaves with speed ticks streaming off
  const gearStrider = [
    '..oooo.oooo.',
    '..ohmo.ohmo.',
    '..ohmo.ohmo.',
    'w.ommo.ommo.',
    '..oddo.oddo.',
    'w.ommo.ommo.',
    '..ommo.ommo.',
    'w.oddo.oddo.',
    '..oooo.oooo.',
    '............',
    '............',
    '............',
  ];
  // legs 1 SLIDEWORN: greaves riding a slide board, spray behind
  const gearSlideworn = [
    '..oooo.oooo.',
    '..ohmo.ohmo.',
    '..ommo.ommo.',
    '..ommo.ommo.',
    '..oddo.oddo.',
    '..oooo.oooo.',
    '.owwwwwwwwo.',
    '..oooooooo..',
    'w.w.........',
    '............',
    '............',
    '............',
  ];
  // legs 2 PACKMULE: a work belt with two hanging pouches
  const gearPackmule = [
    '............',
    '.oooooooooo.',
    '.ohmmhhmmho.',
    '.oooooooooo.',
    '..oooo.oooo.',
    '..ommo.ommo.',
    '..ommo.ommo.',
    '..oddo.oddo.',
    '...oo...oo..',
    '............',
    '............',
    '............',
  ];
  // boots 0 SKATES: a boot on a white blade
  const gearSkates = [
    '....oooo....',
    '....ohmo....',
    '....ohmo....',
    '....ommo....',
    '....ommo....',
    '....ommooo..',
    '....ommmmdo.',
    '....oddddo..',
    '....o..o....',
    '...wwwwwww..',
    '............',
    '............',
  ];
  // boots 1 DANCER: a light boot mid-step, motion ticks trailing
  const gearDancer = [
    '.....oo.....',
    '.....omo....',
    '....oomo....',
    '....omo.w...',
    '...oomo.....',
    '...omoo.w...',
    '..oommdo....',
    '..ommmdo.w..',
    '..odddo.....',
    '...ooo......',
    '............',
    '............',
  ];
  // boots 2 GHOSTSTEP: a boot beside its fading afterimage
  const gearGhoststep = [
    '.oooo.......',
    '.ohmo..d.d..',
    '.ohmo.......',
    '.ommo..d.d..',
    '.ommoo......',
    '.ommmdo.dd..',
    '.odddo..d.d.',
    '..ooo...dd..',
    '............',
    '............',
    '............',
    '............',
  ];

  // ---------------------------------------------------------------- heart
  const HPAL = {
    '.': null,
    'o': '#5c1f2e',
    'r': '#e04a54',
    'R': '#f78a8a',
    'W': '#ffd9d9',
    'g': '#3a3448', // empty
    'G': '#4a4460',
  };
  const heartFull = [
    '.oo.oo..',
    'orRoRro.',
    'orWRrro.',
    'orrrrro.',
    '.orrro..',
    '..oro...',
    '...o....',
  ];
  const heartHalf = [
    '.oo.oo..',
    'orRoGgo.'.replace('g', 'g'),
    'orWogGo.',
    'orrogGo.',
    '.orogo..',
    '..oro...',
    '...o....',
  ];
  const heartEmpty = [
    '.oo.oo..',
    'oGgÐ¾gGo.'.replace('Ð¾', 'g'),
    'oGgggGo.',
    'ogggggo.',
    '.ogggo..',
    '..ogo...',
    '...o....',
  ];
  const HEPAL = { '.': null, 'o': '#2a2438', 'g': '#3a3448', 'G': '#4a4460', 'r': '#e04a54', 'R': '#f78a8a', 'W': '#ffd9d9' };

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

  // ---------------------------------------------------------------- cursors
  // Custom in-canvas pointer set, lit from the top-left like the rest of the
  // art: white body, icy right-edge bevel, deep navy outline. Each is drawn
  // over a baked one-colour shadow (same grids, CUSHADOW) offset by a pixel.
  const CUPAL = {
    '.': null,
    'o': '#1c1a30', // outline
    'w': '#f4f7ff', // body
    'b': '#c2d8ee', // icy bevel
    'B': '#8fb3d6', // deep bevel
    's': '#8b93a8', // steel
    'S': '#c4ccdd', // steel light
    'h': '#8a6142', // wood
    'H': '#a3794f', // wood light
  };
  const CUSHADOW = {};
  for (const k in CUPAL) CUSHADOW[k] = CUPAL[k] ? '#0a0e23' : null;

  // plain pointer: menus, overlays, the title screen. Hotspot = tip (0,0).
  const cursorArrow = [
    'o.........',
    'oo........',
    'owo.......',
    'owwo......',
    'owwbo.....',
    'owwwbo....',
    'owwwwbo...',
    'owwwwwbo..',
    'owwwwwwbo.',
    'owwwwwwwbo',
    'owwwbbbBBo',
    'owbowbo...',
    'owo.owbo..',
    'oo...owbo.',
    '.....oBBo.',
    '......oo..',
  ];
  // pointing hand: something under the cursor will react to a click.
  // Hotspot = fingertip (4,0).
  const cursorHand = [
    '....oo.......',
    '...owbo......',
    '...owbo......',
    '...owbooo....',
    '...owbowbooo.',
    '...owbowbowbo',
    '.ooowbowbowbo',
    'owwowbowbowbo',
    'owwwwwwwwwwbo',
    'owwwwwwwwwwbo',
    '.owwwwwwwwbBo',
    '..owwwwwwbBo.',
    '...owwwwbBo..',
    '...oooooooo..',
  ];
  // closed fist: dragging a slider. Hotspot = centre (5,4).
  const cursorGrab = [
    '...oooooo..',
    '..owbwbwbo.',
    '.owbowbowbo',
    'oowwowwowbo',
    'owwwwwwwwbo',
    'owwwwwwwwbo',
    '.owwwwwwbBo',
    '..owwwwbBo.',
    '...oooooo..',
  ];
  // builder's mallet: a stump or structure you can right-click. The head sits
  // top-right so the handle trails away from the hotspot at the face (6,5).
  const cursorHammer = [
    '......oooo..',
    '.....oSSSso.',
    '....oSSSsso.',
    '...oSSSssso.',
    '...ossssssso',
    '..oHoossssso',
    '.oHho.oooooo',
    'oHho........',
    'ohho........',
    'oho.........',
    'oo..........',
  ];

  // ---------------------------------------------------------------- teams
  // Two team presets, RED vs BLUE. A team's colour drives its CHARACTERS
  // (coat, hat, trim), its BUILDINGS (fittings + glow accent, painted over the
  // tier material) and its EAGLE's armour, so a side reads as one side at a
  // glance. The game code reads the names/markers back out of SPRITES.teams -
  // this table is the only place the team palette is written down.
  const TEAM_SKINS = [
    { name: 'RED', mark: '#e05548', // slot 0 - the original red/teal look
      coat: '#c9524e', coatL: '#df7358', coatD: '#96393f', hat: '#3e8c81', hatL: '#58ab98',
      trim: '#f6ecd4', trimD: '#d9c5a0', fit: '#5a3340', fitL: '#8c4f52', glow: '#ff9440' },
    { name: 'BLUE', mark: '#6aa8e8',
      coat: '#3f6fb0', coatL: '#5e93d8', coatD: '#2b4d7d', hat: '#cfe4f2', hatL: '#f4faff',
      trim: '#e8f2fb', trimD: '#bcd0e4', fit: '#2a3a56', fitL: '#4c6a94', glow: '#8fd8ff' },
  ];
  const teamPlayerPal = (t) => Object.assign({}, PPAL, {
    r: t.coat, R: t.coatL, d: t.coatD, t: t.hat, T: t.hatL, m: t.trim, M: t.trimD,
  });
  const teamBuildPal = (base, t) => Object.assign({}, base, { k: t.fit, K: t.fitL, e: t.glow });
  const bayTeamPal = (t) => Object.assign({}, BAYPAL, { L: t.coatL, T: t.coat, t: t.coatD });
  const teamRobotPal = (t) => Object.assign({}, BOTPAL, { L: t.coatL, T: t.coat, t: t.coatD });
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
  const TIER_PALS = [WPAL, WPAL_STONE, WPAL_GOLD];
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
  const teamBuild = TEAM_SKINS.map((t) => ({
    wall: TIER_PALS.map((b) => bake(wall, teamBuildPal(b, t))),
    turret: TIER_PALS.map((b) => bake(turret, teamBuildPal(b, t))),
    generator: TIER_PALS.map((b) => bake(generator, teamBuildPal(b, t))),
    spawner: [bake(bay, bayTeamPal(t))],
    net: [bake(net, teamBuildPal(NETPAL, t))],
    // wheel glyphs for sprites too big to be their own icon
    icon: {
      spawner: bake(bayIcon, bayTeamPal(t)), turret: bake(turretIcon, teamBuildPal(WPAL, t)),
    },
  }));
  const teamRobots = TEAM_SKINS.map((t) => [bake(botA, teamRobotPal(t)), bake(botB, teamRobotPal(t))]);
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

  // ---------------------------------------------------------------- eagle
  // The drop eagle, seen from above, flying along +x (the game rotates it to
  // its heading). 32x48: three wing frames cycled spread -> mid -> back -> mid.
  // Drawn at 2x in-game (it is far above the ground), never through
  // drawSpriteFlash (it is taller than the 32x32 scratch).
  const EGPAL = {
    '.': null,
    'o': '#4e5c82', // outline
    'w': '#f6f8ff', // plumage
    'W': '#d2dbea', // plumage shade (trailing feathers, belly)
    'g': '#8c9ab8', // primaries / tail band
    'c': '#fff6dd', // head
    'y': '#e9b23c', // beak
    'e': '#2e2440', // eye
  };
  // the same silhouette as a soft ground shadow
  const EGSHADOW = { '.': null, 'o': 'rgba(40,60,100,0.30)', 'w': 'rgba(40,60,100,0.30)', 'W': 'rgba(40,60,100,0.30)',
    'g': 'rgba(40,60,100,0.30)', 'c': 'rgba(40,60,100,0.30)', 'y': 'rgba(40,60,100,0.30)', 'e': 'rgba(40,60,100,0.30)' };
  const eagleSpread = [
    '.......og.gg.gW.o...............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.WWo.............',
    '.......oWWWWwwwwwwo.............',
    '.......oWWWWwwwwwwo.............',
    '.......oWWWWWwwwwwo.............',
    '.......oWWWWWwwwwwo.............',
    '.......oWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwo............',
    '......oWWWWWWwwwwwwo............',
    '......oWWWWWWwwwwwwo............',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '..oo..oWWWWWWwwwwwwwwo.ooo......',
    '.oggoooWwwwwwwwwwwwwwooccco.....',
    '.oggwwwwwwwwwwwwwwwwooccccco....',
    '.oggwwwwwwwwwwwwwwwwwcccecccoo..',
    '.oggwwwwwwwwwwwwwwwwwccccccyyyo.',
    '.oggwwwwwwwwwwwwwwwwwccccccyyo..',
    '.oggwwWWWWWWWWWWWWWWoocceccoo...',
    '.oggoooWWWWWWWWWWWwwwooccco.....',
    '..oo..oWWWWWWwwwwwwwwo.ooo......',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwo............',
    '......oWWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwo.............',
    '.......oWWWWWwwwwwo.............',
    '.......oWWWWwwwwwwo.............',
    '.......oWWWWwwwwwwo.............',
    '.......og.gg.gW.WWo.............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.Wo..............',
    '.......og.gg.gW.o...............',
    '........o.oo.oo.................',
  ];
  const eagleMid = [
    '................................',
    '.....o.oo.oo....................',
    '....og.gg.gW....................',
    '.....og.gg.WW...................',
    '.....og.gg.WW...................',
    '.....og.gg.gW.o.................',
    '.....og.gg.gW.Wo................',
    '.....oWWWWwwwwwo................',
    '.....oWWWWWwwwwwo...............',
    '.....oWWWWWwwwwwo...............',
    '......oWWWWwwwwwwo..............',
    '......oWWWWwwwwwwo..............',
    '......oWWWWWwwwwwo..............',
    '......oWWWWWwwwwwwo.............',
    '......oWWWWWwwwwwwo.............',
    '......oWWWWWwwwwwwwo............',
    '......oWWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwwo...........',
    '.......oWWWWWwwwwwwwo...........',
    '..oo...oWWWWWWwwwwwwo..ooo......',
    '.oggoooowwwwwwwwwwwwwooccco.....',
    '.oggwwwwwwwwwwwwwwwwooccccco....',
    '.oggwwwwwwwwwwwwwwwwwcccecccoo..',
    '.oggwwwwwwwwwwwwwwwwwccccccyyyo.',
    '.oggwwwwwwwwwwwwwwwwwccccccyyo..',
    '.oggwwWWWWWWWWWWWWWWoocceccoo...',
    '.oggooooWWWWWWWWWWwwwooccco.....',
    '..oo...oWWWWWWwwwwwwo..ooo......',
    '.......oWWWWWwwwwwwwo...........',
    '.......oWWWWWwwwwwwwo...........',
    '......oWWWWWWwwwwwwo............',
    '......oWWWWWwwwwwwwo............',
    '......oWWWWWwwwwwwo.............',
    '......oWWWWWwwwwwwo.............',
    '......oWWWWWwwwwwo..............',
    '......oWWWWwwwwwwo..............',
    '......oWWWWwwwwwwo..............',
    '.....oWWWWWwwwwwo...............',
    '.....oWWWWWwwwwwo...............',
    '.....oWWWWwwwwwo................',
    '.....og.gg.gW.Wo................',
    '.....og.gg.gW.o.................',
    '.....og.gg.WW...................',
    '.....og.gg.WW...................',
    '....og.gg.gW....................',
    '.....o.oo.oo....................',
    '................................',
    '................................',
  ];
  const eagleBack = [
    '................................',
    '................................',
    '................................',
    '................................',
    '....o.oo.oo.....................',
    '...og.gg.WWo....................',
    '...og.gg.WWo....................',
    '...og.gg.gW.....................',
    '....og.gg.WW....................',
    '....oWWWWwwwwo..................',
    '....oWWWWwwwwwo.................',
    '.....oWWWWwwwwwo................',
    '.....oWWWWwwwwwo................',
    '.....oWWWWWwwwwwo...............',
    '......oWWWWwwwwwwo..............',
    '......oWWWWWwwwwwo..............',
    '......oWWWWWwwwwwwo.............',
    '.......oWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwo............',
    '..oo...oWWWWWWwwwwwwo..ooo......',
    '.oggoooowwwwwwwwwwwwwooccco.....',
    '.oggwwwwwwwwwwwwwwwwooccccco....',
    '.oggwwwwwwwwwwwwwwwwwcccecccoo..',
    '.oggwwwwwwwwwwwwwwwwwccccccyyyo.',
    '.oggwwwwwwwwwwwwwwwwwccccccyyo..',
    '.oggwwWWWWWWWWWWWWWWoocceccoo...',
    '.oggooooWWWWWWWWWWwwwooccco.....',
    '..oo...oWWWWWWwwwwwwo..ooo......',
    '.......oWWWWWwwwwwwo............',
    '.......oWWWWWwwwwwwo............',
    '......oWWWWWwwwwwwo.............',
    '......oWWWWWwwwwwo..............',
    '......oWWWWwwwwwwo..............',
    '.....oWWWWWwwwwwo...............',
    '.....oWWWWwwwwwo................',
    '.....oWWWWwwwwwo................',
    '....oWWWWwwwwwo.................',
    '....oWWWWwwwwo..................',
    '....og.gg.WW....................',
    '...og.gg.gW.....................',
    '...og.gg.WWo....................',
    '...og.gg.WWo....................',
    '....o.oo.oo.....................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ];

  // Team armour as a pure palette swap: the torso band - the rows the head
  // sits in, which hold still across the flap frames (only the wings move) -
  // is re-lettered to plate (P/p) and helm (H) and baked in team colour.
  // Armour only recolours pixels the bird already has, so the silhouette is
  // untouched and the plating follows the body's contours exactly.
  const armorize = (grid) => grid.map((row) => row.includes('c')
    ? row.replace(/w/g, 'P').replace(/W/g, 'p').replace(/c/g, 'H')
    : row);
  const eagleTeamPal = (t) => Object.assign({}, EGPAL, { P: t.coatL, p: t.coatD, H: t.mark });
  // an all-white body for the downed bird's hit flash (it is taller than the
  // 64x64 drawSpriteFlash scratch, so it gets a baked silhouette instead)
  const EGFLASH = Object.keys(EGPAL).reduce((o, k) => (o[k] = k === '.' ? null : '#f4f7ff', o), {});

  // ---------------------------------------------------------------- wolf
  // The wolf den's pack: a low-slung side-view predator, amber-eyed, in the
  // same 3-frame stand/run set the deer and rabbit use (left = flipH).
  const WOPAL = {
    '.': null,
    'o': '#262b38', // outline
    'y': '#6f778c', // coat mid
    'Y': '#8f97ac', // coat light (lit from above)
    'd': '#4d5468', // coat shade (flank)
    'c': '#dfe4ef', // pale throat / belly / muzzle
    'e': '#f2b03c', // eye
    'n': '#171a22', // nose
  };
  const wolfBody = [
    '...........o.o..',
    '..........oYoYo.',
    '.o........oYYYo.',
    'oYo....ooooYYYYo',
    'oYYo..oYYYYYYYeo',
    '.oYYooYYYYYYYccn',
    '..oYYdddddYYcco.',
    '...oddddddddco..',
    '...oddddddddco..',
    '...ocddcccddco..',
  ];
  const wolfStand = wolfBody.concat([
    '...oyo...oyyo...',
    '...oyo...oyyo...',
    '...ooo...ooo....',
  ]);
  const wolfRunA = wolfBody.concat([
    '..oyo....oyyo...',
    '.oyo......oyyo..',
    '.ooo......ooo...',
  ]);
  const wolfRunB = wolfBody.concat([
    '....oyo.oyyo....',
    '....oyo..oyyo...',
    '....ooo..ooo....',
  ]);

  // ---------------------------------------------------------------- rookery
  // Dead trees: the rookery's bare snags. Same 16x24 footprint as a pine so
  // they draw at py-8 in the same band, but stripped to grey wood and snow.
  const DTPAL = {
    '.': null,
    'o': '#2a2018', // outline
    'u': '#6b5a48', // dead wood
    'U': '#4b3d30', // dead wood dark
    'v': '#8a7761', // lit bark
    'w': '#eef4fb', // snow
    's': '#c9dcee', // snow shade
  };
  const deadTree1 = [
    '................',
    '.......ow.......',
    '..w....ou.......',
    '.ouo...ov...w...',
    '..ovo..ov..ouo..',
    '...ovo.ov.ovo...',
    '....ovoovoovo...',
    '.....ovuvuvo....',
    '..w...ouvuo.....',
    '.ouo..ouvuo.ww..',
    '..ovo.ouvuo.ou..',
    '...ovooUvUoovo..',
    '....ovuUvUuvo...',
    '......ouvUo.....',
    '......ouvUo.....',
    '......ouUUo.....',
    '.....oouUUoo....',
    '.....ovuUUvo....',
    '.....ovuUUvo....',
    '.....ouUUUuo....',
    '....oouUUUuoo...',
    '....owwUUUwwo...',
    '....osswwwsso...',
    '.....ssssss.....',
  ];
  const deadTree2 = [
    '................',
    '...........w....',
    '....w.....ou....',
    '...ouo....ov....',
    '....ovo..ovo....',
    '.....ovooovo....',
    '..w...ovuvo.....',
    '.ouo..ouvuo.....',
    '..ovo.ouvuo.w...',
    '...ovooUvUoouo..',
    '....ovuUvUuovo..',
    '......ouvUuvo...',
    '......ouvUo.....',
    '......ouUUo.....',
    '......ouUUo.....',
    '.....oouUUo.....',
    '.....ovuUUoo....',
    '.....ovuUUvo....',
    '.....ouUUUvo....',
    '.....ouUUUuo....',
    '....oouUUUuoo...',
    '....owwUUUwwo...',
    '....osswwwsso...',
    '.....ssssss.....',
  ];

  // Birds: the rookery's flock. Tiny, so a perched frame plus two wing frames
  // is the whole set; the game draws them above the ground on their own alt.
  const BIPAL = {
    '.': null,
    'o': '#232734', // outline
    'y': '#4d5566', // feather mid
    'Y': '#77809a', // feather light
    'c': '#cfd6e4', // pale breast
    'n': '#e0a63c', // beak
  };
  const birdPerch = [
    '..oo.....',
    '.oYYo....',
    'oyYYyon..',
    'oyyyyco..',
    '.oyyco...',
    '..o.o....',
  ];
  const birdFlyA = [
    'oo.....oo',
    '.oy...yo.',
    '.oyYYYyon',
    '..oyccyo.',
    '...ooo...',
  ];
  const birdFlyB = [
    '.........',
    '..oo.oo..',
    '.oyYYYyon',
    'oyyyccyo.',
    '.oo...oo.',
  ];

  // ---------------------------------------------------------------- den
  // The wolf den's mouth: a snow-capped rock mound with a black throat and a
  // picked-over bone at the lip. 16x12, drawn at py+4 like a rock.
  const DNPAL = {
    '.': null,
    'o': '#2b3040', // outline
    'y': '#7b8398', // rock mid
    'Y': '#99a1b6', // rock light
    'v': '#5a6176', // rock dark
    'k': '#12151f', // the dark inside
    'b': '#e6e2d4', // bone
    'w': '#eef4fb', // snow
    's': '#c9dcee', // snow shade
  };
  const den = [
    '................',
    '.....owwwwo.....',
    '...oowwwwwwoo...',
    '..owwwwwwwwwwo..',
    '.oswwwwwwwwwwso.',
    'oYsswyyyyywsssYo',
    'oYyyyokkkoyyyyYo',
    'oYyyokkkkkoyyyYo',
    'ovyyokkkkkoyyyvo',
    'ovvyokkkkkoyyvvo',
    '.ovvokkkkkovvvo.',
    '..ooobkkkboooo..',
  ];
  // baked once, up here, because both the array and the atlas below need it
  const treeSpr = treeSway.map((f) => bake(f, TSPAL));

  // A beast's frames are named CLIPS, one array per behaviour, so
  // `SPRITES[kind][dir]` is an object rather than a flat list and every kind
  // wears the same two names at least: `idle` is what it does standing still
  // and is the frame anything asking for "the beast" takes (the wiki's cards
  // read `.right.idle[0]`). Which clip is playing is the animal's business,
  // not the sprite's - js/wildlife.js sets `a.clip`, drawAnimal plays it.
  function bakeClips(clips, pal) {
    const out = {};
    for (const k in clips) out[k] = clips[k].map((f) => bake(f, pal));
    return out;
  }
  function mapClips(set, fn) {
    const out = {};
    for (const k in set) out[k] = set[k].map(fn);
    return out;
  }
  // the four beasts, right-facing; left is every clip mirrored
  const rabbitSet = bakeClips({ idle: rabbitIdle, hop: rabbitHop, rise: rabbitRise }, RBPAL);
  const deerSet = bakeClips({ idle: deerIdle, graze: deerGraze, run: deerRun }, DEPAL);
  const wolfSet = bakeClips({ idle: [wolfStand], run: [wolfRunA, wolfRunB] }, WOPAL);
  const birdSet = bakeClips({ idle: [birdPerch], fly: [birdFlyA, birdFlyB] }, BIPAL);

  // The three goods that MOVE. Their frames bake like anything else; what
  // ships beside them is a blank canvas of the same size per icon, which
  // stepItemIcons (js/render.js) redraws each frame. It starts on frame 0 so
  // anything that bakes an item icon into a still panel at boot (the control
  // primer) gets a picture rather than a hole.
  const goldFrames = nugget.map((f) => bake(f, NUGPAL));
  const berryFrames = berry.map((f) => bake(f, BERPAL));
  const fishFrames = fish.map((f) => bake(f, FIPAL));
  function liveIcon(frames) {
    const c = document.createElement('canvas');
    c.width = frames[0].width; c.height = frames[0].height;
    c.getContext('2d').drawImage(frames[0], 0, 0);
    c.frame = 0;
    return c;
  }

  window.SPRITES = {
    teams: TEAM_SKINS,
    playerTeam: teamPlayers,
    champ: champPlayers,
    teamBuild: teamBuild,
    robotTeam: teamRobots,
    merchant: teamMerchants, // merchant[team] - the eagle's driver, a full walking pose set per team colour
    player: teamPlayers[0],
    raider: {
      down: [bake(playerDownIdle, RDPAL), bake(playerDownA, RDPAL), bake(playerDownB, RDPAL)],
      up: [bake(playerUpIdle, RDPAL), bake(playerUpA, RDPAL), bake(playerUpB, RDPAL)],
      right: [bake(playerSideIdle, RDPAL), bake(playerSideA, RDPAL), bake(playerSideB, RDPAL)],
      left: [flipH(bake(playerSideIdle, RDPAL)), flipH(bake(playerSideA, RDPAL)), flipH(bake(playerSideB, RDPAL))],
    },
    // 24 bend frames, not 2 variants: treeFrame() picks one off the wind wave.
    // They are drawn through `treeAtlas` below, never from this array - it is
    // kept because the atlas is built out of it and a single frame is handy.
    tree: treeSpr,
    // ONE texture for every pine on screen. A wide-open view holds a thousand
    // trees, and a drawImage whose source canvas differs from the last one
    // cannot be batched: on a GTX 1060 the sixteen separate canvases cost 97
    // fps against 199 for the same sprites drawn from a single source. So the
    // frames are laid out side by side and render() blits sub-rects of this.
    // FORTY-EIGHT of them: the second run of 24 is the first run mirrored, and
    // treeFrame() sends half the forest into it off the tile's hash. Now that
    // every frame is one tree rather than sixteen variants, that mirror is the
    // only thing left keeping a stand from reading as one stamp repeated - and
    // it is free, because a wider atlas is still a single texture. A mirrored
    // tree leans the other way, so the ladder runs backwards over there and
    // treeFrame() reverses the index when it crosses.
    // `fw`/`fh` ride on the canvas so the caller needs no second constant.
    treeAtlas: (() => {
      const fr = treeSpr.concat(treeSpr.map(flipH));
      const fw = fr[0].width, fh = fr[0].height;
      const c = document.createElement('canvas');
      c.width = fw * fr.length; c.height = fh;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      fr.forEach((f, i) => g.drawImage(f, i * fw, 0));
      c.fw = fw; c.fh = fh;
      return c;
    })(),
    stump: bake(stump, TPAL),
    rock: [bake(rock1, RPAL), bake(rock2, RPAL)],
    goldOre: bake(goldOre, GOPAL),
    mine: bake(mine, MIPAL),
    bush: bake(bush, BPAL),
    bushEmpty: bake(bushEmpty, BPAL),
    bushBud: bake(bushBud, BPAL),
    bushRipen: bake(bushRipen, BPAL),
    rabbit: { right: rabbitSet, left: mapClips(rabbitSet, flipH) },
    wolf: { right: wolfSet, left: mapClips(wolfSet, flipH) },
    bird: { right: birdSet, left: mapClips(birdSet, flipH) },
    deadTree: [bake(deadTree1, DTPAL), bake(deadTree2, DTPAL)],
    den: bake(den, DNPAL),
    deer: { right: deerSet, left: mapClips(deerSet, flipH) },
    imp: [bake(imp1, IPAL), bake(imp2, IPAL)],
    eagle: [bake(eagleSpread, EGPAL), bake(eagleMid, EGPAL), bake(eagleBack, EGPAL)],
    // eagleTeam[team] - the same three flap frames in that team's armour
    eagleTeam: TEAM_SKINS.map((t) => [bake(armorize(eagleSpread), eagleTeamPal(t)),
      bake(armorize(eagleMid), eagleTeamPal(t)), bake(armorize(eagleBack), eagleTeamPal(t))]),
    eagleFlash: bake(eagleBack, EGFLASH), // the downed pose, all white, for the hit flash
    eagleShadow: bake(eagleSpread, EGSHADOW),
    wall: [bake(wall, WPAL), bake(wall, WPAL_STONE), bake(wall, WPAL_GOLD)],
    turret: [bake(turret, WPAL), bake(turret, WPAL_STONE), bake(turret, WPAL_GOLD)],
    generator: [bake(generator, WPAL), bake(generator, WPAL_STONE), bake(generator, WPAL_GOLD)],
    spawner: [bake(spawner, WPAL), bake(spawner, WPAL_STONE), bake(spawner, WPAL_GOLD)],
    net: [bake(net, NETPAL)],
    scaffold: [bake(scaffold1, SCPAL), bake(scaffold2, SCPAL), bake(scaffold3, SCPAL)],
    robot: teamRobots[0],
    spikes: bake(spikes, SPAL),
    fire: [bake(fire1, FPAL), bake(fire2, FPAL), bake(fire3, FPAL)],
    torch: [bake(torch1, TOPAL), bake(torch2, TOPAL)],
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
    // gearIcons[slot][variant][material]: 12 distinct variant glyphs, each in
    // leather / iron / steel / gold
    gearIcons: [
      [gearLongsight, gearQuickdraw, gearHuntsman],
      [gearBulwark, gearIronhide, gearHearthweave],
      [gearStrider, gearSlideworn, gearPackmule],
      [gearSkates, gearDancer, gearGhoststep],
    ].map((row) => row.map((g) => GEAR_MAT_PALS.map((pal) => bake(g, pal)))),
    itemAxe: bake(itemAxe, AXPAL),
    itemBow: bake(itemBow, AXPAL),
    itemPick: bake(itemPick, AXPAL),
    heartFull: bake(heartFull, HPAL),
    heartHalf: bake(heartHalf, HEPAL),
    heartEmpty: bake(heartEmpty, HEPAL),
    cursor: {
      arrow: bake(cursorArrow, CUPAL), hand: bake(cursorHand, CUPAL),
      grab: bake(cursorGrab, CUPAL), hammer: bake(cursorHammer, CUPAL),
    },
    cursorShadow: {
      arrow: bake(cursorArrow, CUSHADOW), hand: bake(cursorHand, CUSHADOW),
      grab: bake(cursorGrab, CUSHADOW), hammer: bake(cursorHammer, CUSHADOW),
    },
  };

  // ---------------------------------------------------------------- the camps' wolves
  // PLACEHOLDER LOOKS, derived from the wolf rather than drawn: the buff
  // camp's ALPHA is the same grids washed toward silver, the epic camp's
  // DIRE WOLF is them washed toward a dark red and doubled to 32x26 with
  // nearest-neighbour, so it reads as twice the animal at any zoom. Each
  // wants its own grid one day (the concept-art skill); until then
  // drawAnimal (draw-world.js) treats them as a wolf with a bigger frame.
  function wash(src, col, amt) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = amt;
    g.fillStyle = col;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function double(src) {
    const c = document.createElement('canvas');
    c.width = src.width * 2; c.height = src.height * 2;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  const W = window.SPRITES.wolf;
  const alphaSkin = (s) => wash(s, '#dfe6f4', 0.45);
  const direSkin = (s) => double(wash(s, '#5a1e2c', 0.5));
  window.SPRITES.alpha = { right: mapClips(W.right, alphaSkin), left: mapClips(W.left, alphaSkin) };
  window.SPRITES.dire = { right: mapClips(W.right, direSkin), left: mapClips(W.left, direSkin) };
})();
