'use strict';
// What a player builds and what a bay rolls out: the wall, turret, generator
// and spawner in three tier materials and each side's fittings, the net, the
// scaffold, the bot bay and its worker bots, spikes, fire and the torch.
(() => {
  const { bake, TEAM_SKINS, teamBuildPal } = SPR;

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
    'oUUUUUUUUUUUUUUo',
    'ovvvvvvvvvvvvvvo',
    'ouUv.ouUvouUv.uv',
    'ouUv.ouUvouUv.uv',
    'ouUv.ouUvouUv.uv',
    'ouUv.ouUvouUv.uv',
    'ovUv.ovUvovUv.Uv',
    'ovvo.ovvoovvo.vo',
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

  const bayTeamPal = (t) => Object.assign({}, BAYPAL, { L: t.coatL, T: t.coat, t: t.coatD });
  const teamRobotPal = (t) => Object.assign({}, BOTPAL, { L: t.coatL, T: t.coat, t: t.coatD });
  const TIER_PALS = [WPAL, WPAL_STONE, WPAL_GOLD];
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

  Object.assign(SPRITES, {
    teamBuild: teamBuild,
    robotTeam: teamRobots,
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
  });
})();
