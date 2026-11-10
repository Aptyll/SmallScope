'use strict';
// The people: every hero's pose set in every team paint (its looks' grids, the
// baked run and roll, the lying-down frames), and the merchant who drives the eagle.
(() => {
  const { bake, flipH, TEAM_SKINS } = SPR;

  // ---------------------------------------------------------------- paint
  // the letters every body starts from; a team's coat goes over r/R/d, t/T, m/M
  // (teamPlayerPal) and a hero's own paint over that
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

  // ---------------------------------------------------------------- run and roll
  // The run cycle and the dodge roll are not drawn here: js/baked/motion.js carries them as
  // grids painted off a doll of each hero look (app/bake-player/), in the hero's letters,
  // so they bake through the same team palettes as the hand-drawn poses. Each is a
  // sibling of the walking directions - `run[dir]`, `hold[dir]` (the run with the hands at
  // the sides, for a body whose hands are busy) and `roll[dir]` - frames in order; a frame
  // is wider than the 16 x 16 cell (SPRITES.motionBox says where the cell sits inside it).
  // A facing's frames bake the first time they are asked for, not with the set: a set is a
  // hundred-odd canvases, every hero look and team paint has one, and few bodies ever show
  // all of them - baked up front they made the drop's start and a palette repaint stall.
  const motionSet = (name, pal) => {
    const M = SPR.motion, out = {};
    const once = (fn) => { let v = null; return () => v || (v = fn()); };
    for (const kind of ['run', 'hold', 'roll']) {
      const grids = M.GRIDS[name][kind];
      const one = (d) => once(() => grids[d].map((g) => bake(g, pal)));
      const right = one('right');
      const dirs = { down: one('down'), up: one('up'), right, left: once(() => right().map(flipH)) };
      out[kind] = Object.defineProperties({}, Object.fromEntries(Object.entries(dirs).map(([d, get]) => [d, { get, enumerable: true }])));
    }
    return out;
  };

  const teamPlayerPal = (t) => Object.assign({}, PPAL, {
    r: t.coat, R: t.coatL, d: t.coatD, t: t.hat, T: t.hatL, m: t.trim, M: t.trimD,
  });

  // ---------------------------------------------------------------- lying down
  // `prone[dir]`: a hero flat in the snow, for the emotes and the loss's stage
  // (js/ui/screens.js, js/ui/endscreens.js). No grid of its own: a standing frame
  // turned a quarter clockwise (exact, so pixels stay pixels) and dropped to the
  // cell's floor, where the standing feet were. The side frame turned so lies
  // belly-down with the head toward `right`, the front frame on its side facing
  // out, the back frame facing in: four bodies for a turn on the ground.
  const lie = (g) => {
    const h = g.length, w = g[0].length, r = [];
    for (let y = 0; y < w; y++) { let row = ''; for (let x = 0; x < h; x++) row += g[h - 1 - x][y]; r.push(row); }
    let floor = r.length - 1;
    while (floor > 0 && !/[^.]/.test(r[floor])) floor--;
    const drop = r.length - 1 - floor, blank = '.'.repeat(h);
    return Array(drop).fill(blank).concat(r.slice(0, r.length - drop));
  };

  // ---------------------------------------------------------------- heroes
  // champLook(cls, team, skinId): the full pose set for one hero in one team's
  // paint, in one of its looks (heroArtOf(cls).looks, e.g. ARM_SKINS: `skinId`,
  // the free first one for none), baked on first ask and kept - ten players and
  // a menu or two is all that ever asks, so the cache stays small. Every reader
  // of a player's body goes through classSet(p) (js/sim/player.js), which asks
  // here. The look's own grids and doll, in its own paint over the team's coat.
  const lookCache = new Map();
  function champLook(cls, team, skinId) {
    const art = heroArtOf(cls), rows = art.looks, row = rows.find((r) => r.id === skinId) || rows[0];
    const key = cls + '|' + team + '|' + row.id;
    let set = lookCache.get(key);
    if (set) return set;
    const sp = Object.assign({}, teamPlayerPal(TEAM_SKINS[team]), art.pal, row.pal); // a look may repaint the hero's letters (`pal`: NIX's MOONLESS)
    const w = heroWalk(row.grids);
    const side = w.side.map((g) => bake(g, sp)), flat = (gs) => gs.map((g) => bake(lie(g), sp)), pside = flat(w.side);
    set = Object.assign({
      down: w.down.map((g) => bake(g, sp)), up: w.up.map((g) => bake(g, sp)), right: side, left: side.map(flipH),
      prone: { right: pside, left: pside.map(flipH), down: flat(w.down), up: flat(w.up) },
    }, motionSet(row.motion, sp));
    // side-on the run and the held run are the hero's own standing frame, legs stepping
    // (heroRunSide, js/sprites/armatos.js): the doll's are narrower than the hand-drawn body
    for (const kind of ['run', 'hold']) {
      const mo = set[kind], bob = kind === 'run' ? SPR.motion.RUN_BOB : SPR.motion.HOLD_BOB;
      let r = null;
      const right = () => r || (r = heroRunSide(row.grids.side, bob).map((g) => bake(g, sp)));
      let l = null;
      // ...and head-on and from behind too, for a look that says its doll does not match it
      const drawn = row.run === 'drawn', fr = {};
      const front = (d) => (drawn ? () => fr[d] || (fr[d] = heroRunFront(row.grids[d], bob).map((g) => bake(g, sp))) : () => mo[d]);
      set[kind] = Object.defineProperties({}, {
        down: { get: front('down'), enumerable: true }, up: { get: front('up'), enumerable: true },
        right: { get: right, enumerable: true }, left: { get: () => l || (l = right().map(flipH)), enumerable: true },
      });
    }
    // how far this look's body stands over and out past the 16 px cell's 15-row one
    // (a larger cell's): the overhead frame lifts by `rise`, a hand sits `reach` px
    // further out (heroRise, heroReach, js/draw/heroes.js)
    const more = row.grids.down.length - 16; // a 20 px cell: 3 rows taller (one more is headroom), 1 px wider a side
    set.rise = (more * 3) >> 2; set.reach = more >> 2;
    // standing still: the breath's two frames a facing (heroBreath, js/sprites/armatos.js),
    // and the loose cloth a pixel behind for the beat after a stop or a turn (heroCloth),
    // baked on first ask (drawPlayer's idle, js/draw/idle.js)
    const FACE = { down: 'down', up: 'up', right: 'side', left: 'side' }, breaths = {}, cloths = new Map();
    const breathOf = (d) => breaths[d] || (breaths[d] = [row.grids[FACE[d]], heroBreath(row.grids[FACE[d]])]);
    const facing = (d, g) => (d === 'left' ? flipH(bake(g, sp)) : bake(g, sp));
    set.breath = Object.defineProperties({}, Object.fromEntries(Object.keys(FACE).map((d) => {
      let fr = null;
      return [d, { get: () => fr || (fr = d === 'left' ? set.breath.right.map(flipH) : breathOf(d).map((g) => bake(g, sp))), enumerable: true }];
    })));
    set.cloth = (d, dx, dy, b) => {
      const k = d + dx + ',' + dy + b;
      if (!cloths.has(k)) {
        const g = heroCloth(breathOf(d)[b], row, FACE[d], d === 'left' ? -dx : dx, dy);
        cloths.set(k, g && facing(d, g));
      }
      return cloths.get(k);
    };
    lookCache.set(key, set);
    return set;
  }

  // portrait(cls, team, skinId): the 48 x 48 face of one hero in one look and
  // team's paint, for the lobby, the hero grid and the cards - its own standing
  // front at 3x, the body the world draws, composed on first ask and kept
  // (emptied past PORTRAIT_KEEP, so a ladder card's look or a repaint never
  // grows it without bound).
  const PORTRAIT_KEEP = 512;
  const faces = new Map();
  function portrait(cls, team, skinId) {
    const key = cls + '|' + team + '|' + (skinId || '');
    let c = faces.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(champLook(cls, team, skinId || null).down[0], 0, 0, 48, 48);
    if (faces.size >= PORTRAIT_KEEP) faces.clear();
    faces.set(key, c);
    return c;
  }

  // the MERCHANT who drives each team's eagle and works its roost (the
  // `merchant` banner, js/sim/robots.js): a trader in a tan
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
  const teamMerchants = [];
  // every team-painted set above, (re)baked into the SAME arrays so a repaint
  // (setTeamPal, js/sprites/core.js) reaches every holder; a cached look is
  // thrown away and rebakes on its next ask
  SPR.onTeams(() => {
    TEAM_SKINS.forEach((t, i) => { teamMerchants[i] = merchantSet(merchantPal(t)); });
    lookCache.clear();
    faces.clear();
  });

  Object.assign(SPRITES, {
    champLook, portrait, // a hero's pose set and its 48 px face in a team's paint and one of its looks (the `heroes` section above)
    // the run and roll frames' size and where the 16 x 16 cell sits in one, the body's bob per
    // frame of the run and the held run (whole px up) and the share of the roll at which each
    // roll frame starts
    motionBox: SPR.motion.BOX, runBob: SPR.motion.RUN_BOB, holdBob: SPR.motion.HOLD_BOB, rollAt: SPR.motion.ROLL_AT,
    merchant: teamMerchants, // merchant[team] - the eagle's driver, a full walking pose set per team colour
  });
})();
