'use strict';
// What a player builds and what a bay rolls out: the wall, generator and
// spawner in three tier materials and each side's fittings, the turret's three
// timber bases, the net, the scaffold, the bot bay and its worker bots, spikes,
// fire and the torch.
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

  // THE GATE: a wall piece its own side walks through (STRUCTS.gate). Concept
  // round 1 pick C, "raised portcullis" (docs/media/concepts/gate-concepts-1.png):
  // a snowy beam on two posts, the grille hauled up under it in the side's
  // coat (y/Y/t, gatePal below), the passage open underneath.
  const gate = [
    '.Ww..........wW.',
    'owwowwwwwwwwowwo',
    'oUUUUUUUUUUUUUUo',
    'ovvvvvvvvvvvvvvo',
    'ouUvttttttttvUuo',
    'ouUvoYoYYoYovUuo',
    'ouUvoyoyyoyovUuo',
    'ouUvyyyyyyyyvUuo',
    'ouUvoyoyyoyovUuo',
    'ouUv.t.tt.t.vUuo',
    'ouUv........vUuo',
    'ouUv........vUuo',
    'ouUv........vUuo',
    'ovUv........vUvo',
    'ovvo........ovvo',
    'ssssssssssssssss',
  ];

  // ------------------------------------------------- tiered structures
  // One 16x16 grid each for the wall, the gate and the generator, baked with
  // WPAL / WPAL_STONE / WPAL_GOLD. The TURRET is the exception: three grids of
  // its own in three timbers, below.
  // the wheel glyph: the sling over a stump in the side's own paint. The live
  // bases are the three 32x32 grids below, far too big for a wheel segment.
  const turretIcon = [
    '................',
    '..o..........o..',
    '..oK........Ko..',
    '..oK.w....w.Ko..',
    '...oK.w..w.Ko...',
    '...ou..ee..uo...',
    '....ou.ee.uo....',
    '.....ouoouo.....',
    '......ouuo......',
    '.....oUuuUo.....',
    '....oyyyyyyo....',
    '....oYymmyyo....',
    '....oyyyyyyo....',
    '...ovuvvvvuvo...',
    '..ovvoovvoovvo..',
    '..ssssssssssss..',
  ];

  // THE TURRET'S BASE IS TIMBER AT EVERY TIER (STRUCTS.turret, js/structures.js)
  // and it is ONE PIECE OF TIMBER growing up: a sawn stump, the same stump
  // CARVED, and a carved pedestal that has left the forest behind. That is the
  // whole of the upgrade's picture, so the three tiers are three GRIDS instead
  // of one grid remapped to stone and gold, and they widen with the tier -
  // 16, 18 and 20 px on a 16 px footprint - so a raider reads which one it is
  // from across the snow before the fork has moved.
  // Each is 32x32 whose top 16 rows are deliberately empty: that is where
  // drawTurretHead() rasterises the sling at the live bearing
  // (js/draw/structs.js), pivoting on sprite-local (16, 12) just above the
  // collar. Baking the fork in would lock it to one angle.
  // THE SIDE'S PAINT IS ON ALL THREE (turretPal): a band in its coat (y/Y/t)
  // carrying its own mark (m) between the iron straps (k/K) every building
  // wears, lit by the glow (e) on the two carved tiers.
  // TIER 1: a sawn stump - a cut face, bark, and roots with gaps between them
  const turretT1 = [
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
    '...........oooooooooo...........',
    '..........oUUUUUUUUUUo..........',
    '..........oUuUUuUuUUuo..........',
    '.........ovuUuUuuUuUuvo.........',
    '.........ovuvvuvvuvvuvo.........',
    '.........oYYyyyyyyyytto.........',
    '.........oYyyyymmyyyyto.........',
    '.........oYYyyyyyyyytto.........',
    '.........ovuvvuvvuvvuvo.........',
    '.........ovvuvvuuvvuvvo.........',
    '........oovuvvuvvuvvuvoo........',
    '........ovvuvvvuuvvvuvvo........',
    '........ovvvuvvvvvvuvvvo........',
    '........ovvoovvvvvvoovvo........',
    '........ovo.oovvvvoo.ovo........',
    '........ssssssssssssssss........',
  ];
  // TIER 2: the stump CARVED - a snow rim over straight, faceted sides cut with
  // niches, iron pegs holding a painted panel, and the roots it still grows on
  const turretT2 = [
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
    '.........oUUUUUUUUUUUUo.........',
    '........oUuUUuUuUUuUUuUo........',
    '.......ovuUuUuuuuuuUuUuvo.......',
    '.......owvvvvvvvvvvvvvvwo.......',
    '.......ovkvvvvvvvvvvvvkvo.......',
    '.......oYYyyyyyyyyyyyytto.......',
    '.......oYyyemmmmmmmmeytto.......',
    '.......oYYyyyyyyyyyyyytto.......',
    '.......ovkvvvvvvvvvvvvkvo.......',
    '.......ovuUvvuvvvvuvvUuvo.......',
    '.......ovuUvoovvvvoovUuvo.......',
    '.......ovuUvvuvvvvuvvUuvo.......',
    '.......ovvuuvvvvvvvvuuvvo.......',
    '.......ovvoovvvvvvvvoovvo.......',
    '.......ssssssssssssssssss.......',
  ];
  // TIER 3: a carved PEDESTAL, no roots at all - a wide cornice on two painted
  // corner posts, a narrow shaft wearing the side's frieze between iron bands,
  // and a stepped plinth. Its outline alone says which one it is.
  const turretT3 = [
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
    '......oyo.oooooooooooo.oyo......',
    '......oYo.oUUUUUUUUUUo.oYo......',
    '......omo.ouUuUuuuuUuo.omo......',
    '......ovuUuUuuuuuuUuUuUuvo......',
    '......owwvvvvvvvvvvvvvvwwo......',
    '......ooovvvvvvvvvvvvvvooo......',
    '.........okKKKKKKKKKKko.........',
    '.........oYYyyyyyyyytto.........',
    '.........oYyemmmmmmeyto.........',
    '.........oYYyyyyyyyytto.........',
    '.........okKKKKKKKKKKko.........',
    '.........ovuUvvvvvvUuvo.........',
    '........oovuUvvvvvvUuvoo........',
    '.......oovuUvvvvvvvvUuvoo.......',
    '......oUUUUUUUUUUUUUUUUUUo......',
    '......ssssssssssssssssssss......',
  ];
  const turretBases = [turretT1, turretT2, turretT3];
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
  const TIER_PALS = [WPAL, WPAL_STONE, WPAL_GOLD];
  // ...and the TURRET's own three, because its tiers are three timbers rather
  // than wood/stone/gold. They keep WPAL's letters, so the team fittings (k/K)
  // and the glow (e) ride exactly as they do on every other building, and the
  // wood darkens with the tier the way the sling above it does (SLING_WOOD,
  // js/draw/structs.js).
  const TUR_PALS = [
    WPAL,
    Object.assign({}, WPAL, { o: '#33241a', u: '#7a5636', U: '#966e46', v: '#5a3f28' }),
    Object.assign({}, WPAL, { o: '#241a12', u: '#5f4028', U: '#7d5638', v: '#412a1a' }),
  ];
  // The turret wears MORE of its side than any other building, because it is
  // the one piece that shoots back and whose it is has to read at a glance:
  // besides the shared fittings (k/K) and glow (e), its painted band takes the
  // side's COAT (y/Y/t - the gate's own three letters) and its MARK (m), the
  // brightest ink a side owns.
  const turretPal = (b, tm) => Object.assign(teamBuildPal(b, tm),
    { y: tm.coat, Y: tm.coatL, t: tm.coatD, m: tm.mark });
  const gatePal = (b, t) => Object.assign(teamBuildPal(b, t), { y: t.coat, Y: t.coatL, t: t.coatD });
  const teamBuild = [], teamRobots = [];
  SPR.onTeams(() => TEAM_SKINS.forEach((t, i) => {
    teamBuild[i] = {
      wall: TIER_PALS.map((b) => bake(wall, teamBuildPal(b, t))),
      gate: TIER_PALS.map((b) => bake(gate, gatePal(b, t))),
      turret: TUR_PALS.map((b, i) => bake(turretBases[i], turretPal(b, t))),
      generator: TIER_PALS.map((b) => bake(generator, teamBuildPal(b, t))),
      spawner: [bake(bay, bayTeamPal(t))],
      net: [bake(net, teamBuildPal(NETPAL, t))],
      stall: bake(stall, stallPal(t)), // the merchant's shop (render.js reads SPRITES.teamBuild[skin(team)].stall)
      // wheel glyphs for sprites too big to be their own icon
      icon: {
        spawner: bake(bayIcon, bayTeamPal(t)), turret: bake(turretIcon, turretPal(TUR_PALS[0], t)),
      },
    };
    teamRobots[i] = [bake(botA, teamRobotPal(t)), bake(botB, teamRobotPal(t))];
  }));

  Object.assign(SPRITES, {
    teamBuild: teamBuild,
    robotTeam: teamRobots,
    wall: [bake(wall, WPAL), bake(wall, WPAL_STONE), bake(wall, WPAL_GOLD)],
    turret: TUR_PALS.map((b, i) => bake(turretBases[i], turretPal(b, TEAM_SKINS[0]))),
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
