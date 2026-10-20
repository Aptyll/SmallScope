'use strict';
// The map's own buildings and what they roll out: the barracks bay and its
// soldiers, the merchant's stall, spikes, fire and the torch. The
// generator is the gold pump and the road tower is its own file, both baked
// after this one (js/baked/pump.js, js/baked/tower.js) into the same
// teamBuild sets.
(() => {
  const { bake, TEAM_SKINS, teamBuildPal } = SPR;

  // ---------------------------------------------------------------- barracks bay
  // The barracks' art (STRUCTS.barracks, art: 'spawner'): a 48x38 bot garage on a 3x2 tile footprint
  // w/h), drawn with its snow skirt on the footprint's bottom edge. Steel
  // plate walls; the outline runs along the roof's top edge and a plain two-row snow cap sits on it unoutlined (a few 1px drips),
  // a team-painted lintel band (L/T/t) above a 20px-wide bay with a dark
  // interior and a lit floor lip (doorway cols 14-33, rows 13-35, floor row 36), riveted flanks with a vent grille and a
  // hazard stripe, the mouth open to the ground. One tier -
  // bayTeamPal only paints the band.
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

  // Soldier: a boxy chassis sitting straight on one full-width tread, stub
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

  // The merchant's STALL (OBJECTS.stall, world.js; pitched by updateMerchant,
  // robots.js): D "STALL AND SHELVES" of docs/media/concepts/tent-concepts-2.png,
  // Noah's pick - a snowy awning in the side's stripes (the one team piece)
  // over two shelves of goods, a lantern, a scale and a planked counter.
  // 48 wide over its 3x2 footprint, the art rising above it like a pine.
  const stall = [
    '....oo....oo....oo....oo....oo....oo....oo......',
    '..oossoooossoooossoooossoooossoooossoooossoooo..',
    '.osssssssssssssssssssssssssssssssssssssssssssso.',
    '.ooSoSooSoSooSoSooSoSooSoSooSoSooSoSooSoSooSoSo.',
    'oyyyyccccyyyyccccyyyyccccyyyyccccyyyyccccyyyycco',
    'oyyyyccccyyyyccccyyyyccccyyyyccccyyyyccccyyyycco',
    'oyyyyccccyyyyccccyyyyccccyyyyccccyyyyccccyyyycco',
    'oyyyyccccyyyyccccyyyyccccyyyyccccyyyyccccyyyycco',
    'oyyyyccccyyyyccccyyyyccccyyyyccccyyyyccccyyyycco',
    'oyyyyccccyyyyccccyyyyccccyyyyccccyyyyccccyyyycco',
    'ottttCCCCttttCCCCttttCCCCttttCCCCttttCCCCttttCCo',
    '.ottWoCCooatooCCoottooCCoottooCCoottooCCoottWoCo',
    '..owWdddddaddddddddddddddddddddddddddddddddwWoo.',
    '..owWCCCClllCCCCCCCCppppppCCCCnnCnnCnnCCCCCwWo..',
    '..owWCCCalLlaCaaCCCppppppppCCCfFCfFCfFCCCCCwWo..',
    '..owWCCCjllljCjjCCCpppPppppCCCfFCfFCfFCCCCCwWo..',
    '..owWCCCJaaajCJjCCCppppppppCCCfFCfFCfFCCCCCwWo..',
    '..owWCCCjjCjjCjjCCCPppppppPCCCffCffCffCCCCCwWo..',
    '..owWCwwwwwwwwwwwwwwwwwwwwwwwwfwwfwwfwwwwwCwWo..',
    '..owWCWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWCwWo..',
    '..owWCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCwWo..',
    '..owWCCCCCCCCCCCCCCCCCCCCCCCCakCakCakCakCCCwWo..',
    '..owWCCCCBbCCaaaaaaaggCCggCCCkkCkkCkkCkkCCCwWo..',
    '..owWCCCbbbbaaabaCaaaGGgGGGCCkkCkkCkkCkkCCCwWo..',
    '..owWCwwwwwwwwwwawwwwwwwoowwwwwwwwwwwwwwwwCwWo..',
    '..owWCWWWWWWWWWWaWWWWWWWfFWWWWWWWWWWWWWWWWCwWo..',
    '..owWCCBbCCCCCCCaCCCCCCCfFCCCCCCCCCCCggCCggwWo..',
    '.oowWCbbbbCCCCCCaCCCCCCCfFCCCCCCCCCCgGGGgGGGWoo.',
    'oRRRRRRRRRRRRRRRRRRRRRRRffRRRRRRRRRRRRRRRRRRRRRo',
    'orrrrrrrrrrrrrrrrrrrrrrrfrrrrrrrrrrrrrrrrrrrrrro',
    '.oWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.',
    '.oWwwwwwwwwwwwwWwwwwwwwwwwwwwwwWwwwwwwwwwwwwwWo.',
    '.oWwwwwwwwwwwwwWwwwwwwwwwwwwwwwWwwwwwwwwwwwwwWo.',
    '.oWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.',
    '.oWwwwwwwwwwwwwWwwwwwwwwwwwwwwwWwwwwwwwwwwwwwWo.',
    '.oWwwwwwwwwwwwwWwwwwwwwwwwwwwwwWwwwwwwwwwwwwwWo.',
    '.oWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.',
    '..oooooooooooooooooooooooooooooooooooooooooooo..',
  ];
  const STALLPAL = { o: '#2e2440', c: '#e6d8b8', C: '#c9b38a', d: '#9c8563', n: '#3a2c3a', w: '#7a5a3e', W: '#5a3f2b',
    s: '#f4f7ff', S: '#d6e0ee', g: '#f2cc6a', G: '#c99a3c', f: '#8fa6b8', F: '#b8cad8', b: '#8a2a4a', B: '#c24a6a',
    R: '#9b7550', r: '#7d5a3a', k: '#a8b0c4', a: '#4a4a5a', j: '#7fb0c8', J: '#b8dcef', p: '#a0724a', P: '#7a5236',
    l: '#f2cc6a', L: '#fff2b0' };
  const stallPal = (t) => Object.assign({}, STALLPAL, { y: t.coat, Y: t.coatL, t: t.coatD });

  const bayTeamPal = (t) => Object.assign({}, BAYPAL, { L: t.coatL, T: t.coat, t: t.coatD });
  const teamRobotPal = (t) => Object.assign({}, BOTPAL, { L: t.coatL, T: t.coat, t: t.coatD });
  const teamBuild = [], teamRobots = [];
  SPR.onTeams(() => TEAM_SKINS.forEach((t, i) => {
    teamBuild[i] = {
      spawner: [bake(bay, bayTeamPal(t))],
      stall: bake(stall, stallPal(t)), // the merchant's shop (render.js reads SPRITES.teamBuild[skin(team)].stall)
    };
    teamRobots[i] = [bake(botA, teamRobotPal(t)), bake(botB, teamRobotPal(t))];
  }));

  Object.assign(SPRITES, {
    teamBuild: teamBuild,
    robotTeam: teamRobots,
    robot: teamRobots[0],
    spikes: bake(spikes, SPAL),
    fire: [bake(fire1, FPAL), bake(fire2, FPAL), bake(fire3, FPAL)],
    torch: [bake(torch1, TOPAL), bake(torch2, TOPAL)],
  });
})();
