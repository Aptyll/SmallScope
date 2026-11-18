'use strict';
// Everything that roams a camp on its own legs: the rabbit, the wolf and the
// bottom jungle's stray robot. The camps' bear is js/baked/bears.js.
(() => {
  const { flipH, bakeClips, mapClips } = SPR;

  // ---------------------------------------------------------------- rabbit
  // The meadow's bunny, side view facing right: a chunky brown hare with a
  // pink inner ear and one white glint in the eye. Three sheets out of
  // docs/media/new_media3/ split at 32 px into the three CLIPS a behaviour
  // plays (ANIM_CLIPS, js/sim/wildlife.js): `idle` is
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

  // ---------------------------------------------------------------- wolf
  // The wolf den's pack: a low-slung side-view predator, amber-eyed, in the
  // same 3-frame stand/run set the rabbit uses (left = flipH).
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

  // ---------------------------------------------------------------- stray robot
  // The scrap pile's stray robot (CAMPS.scrap, js/sim/camps.js): a brass box on
  // two stilt legs, side view facing right, a slim iron face plate the way it walks.
  // No lights (Noah 11-18: "just the bot with legs"). Its `down` frame, legs
  // folded, is the one it falls in (fallSpr, js/draw/falls.js). Drawn on the game
  // grid with app/art (robot camps rounds 4 and 5 in the project files); the grids are
  // the source now, edited by hand.
  const HLPAL = {
    '.': null,
    'o': '#26222a', // ink
    'k': '#363a46', // dark iron: the face plate, far leg, joints
    'i': '#6b7282', // iron: near leg
    'h': '#7a5a2e', // brass shade, the panel seam
    'g': '#b08a48', // brass
    'G': '#d8b870', // brass, lit from above
  };
  const hlStand = [
    '..oooooooooo...',
    '.oGGGGGGGGkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ohhhhhhhhkko..',
    '..okooooiooo...',
    '..oko..oio.....',
    '..okko.oiio....',
    '...oko..oio....',
    '...oko..oio....',
    '..okko.oiio....',
    '...oo...oo.....',
  ];
  const hlRunA = [
    '..oooooooooo...',
    '.oGGGGGGGGkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ohhhhhhhhkko..',
    '..ookoooiooo...',
    '..oko...oio....',
    '..oko...oio....',
    '.oko.....oio...',
    '.oko.....oio...',
    'okko.....oiio..',
    '.oo.......oo...',
  ];
  const hlRunB = [
    '..oooooooooo...',
    '.oGGGGGGGGkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ohhhhhhhhkko..',
    '..oookooiooo...',
    '....okooio.....',
    '....okkoiio....',
    '.....okooio....',
    '.....okooio....',
    '....okkoiio....',
    '.....oo.oo.....',
  ];
  const hlLunge = [
    '...oooooooooo..',
    '..oGGGGGGGGkko.',
    '..ogggghgggkko.',
    '..ogggghgggkko.',
    '..ogggghgggkko.',
    '..ogggghgggkko.',
    '..ohhhhhhhhkko.',
    '...okoooioooo..',
    '..oko...oio....',
    '..oko...oio....',
    '.oko.....oio...',
    '.oko.....oio...',
    'okko.....oiio..',
    '.oo.......oo...',
  ];
  const hlDown = [
    '...............',
    '..oooooooooo...',
    '.oGGGGGGGGkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ogggghgggkko..',
    '.ohhhhhhhhkko..',
    '..okikokikoo...',
    '.okkookkoo.....',
    '..oo..oo.......',
    '...............',
    '...............',
    '...............',
  ];
  const hlClips = { idle: [hlStand], run: [hlRunA, hlRunB], lunge: [hlLunge], down: [hlDown] };
  const hlSet = bakeClips(hlClips, HLPAL);

  const rabbitSet = bakeClips({ idle: rabbitIdle, hop: rabbitHop, rise: rabbitRise }, RBPAL);
  const wolfSet = bakeClips({ idle: [wolfStand], run: [wolfRunA, wolfRunB] }, WOPAL);

  Object.assign(SPRITES, {
    rabbit: { right: rabbitSet, left: mapClips(rabbitSet, flipH) },
    wolf: { right: wolfSet, left: mapClips(wolfSet, flipH) },
    scrap: { right: hlSet, left: mapClips(hlSet, flipH) },
  });
})();
