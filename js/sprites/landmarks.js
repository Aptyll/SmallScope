'use strict';
// The story landmarks' art (LANDMARKS, js/landmarks.js): the boat frozen into
// a lake. Weathered wood and a faded rust paint - never a saturated red or
// blue, which are the teams' inks, so nothing here reads as anybody's.
// Picked from docs/media/concepts/landmarks-concepts-1.png: E.
(() => {
  const { bake } = SPR;

  // ---------------------------------------------------------------- landmarks
  const LMPAL = {
    '.': null,
    'o': '#2a1f1a', // outline
    'W': '#a3794f', // wood light
    'w': '#8a6142', // wood mid
    'd': '#6b4a34', // wood dark
    's': '#eef4fb', // snow
    'L': '#fbfdff', // snow lit
    'p': '#8e5a48', // weathered rust paint (the hull)
    'P': '#a8715a', // ...lit
    'q': '#634036', // ...shade
    'b': '#a6cde2', // ice
    'B': '#dcecff', // frost, broken ice
  };
  // E, ROWBOAT: the hull listing toward the bow, snow drifted into the stern,
  // one oar left standing in its rowlock, and a ring of heaved ice where the
  // lake closed round it. 50x24 over a 3x1 footprint.
  const boat = [
    '..........oWwWo...................................',
    '..........oWWWwo..................................',
    '...........oooWwo.................................',
    '..............oWwo................................',
    '...............oWwo..o.oooo.oo.oo.oooo.o..........',
    '...............ooWwoosossssossossossssoso.........',
    '.........oo.ooososWwsWWWWWWWWWWWWWWWWWWWooo.......',
    '....o.ooossosssWWWWWwwwwwwwwwwWwwwwwwwwwWWWooo....',
    '...osossoWWWWWWwwwwWWwwwwwwwwwWwwwwwwwwwwwwWWWo...',
    '..oqWWWWWwwwwwwwwwwWwwwwwwwwwwWwwwwwwwwwddddddWo..',
    '..oqLLLLwwwwwwwwwwwWwwwwwwddddWwddddddddddddWWpo..',
    '..oqssssLLLwwwwwdddWwdddddddddWwdddddddddddWppPo..',
    '..oqsssssssLLLdddddWwdddddddddWwddddddddWWWpPPpoo.',
    '..oqssssssssssLLLLdWwdddddddddWwddddddWWpppPpBBBBo',
    '..oqssssssssssssssLLwdddddddddWwdddWWWppPPPpBBooo.',
    '..oqssssssssssssssssLdddddddddWWWWWpppPPBppBoo....',
    '..oqssssssssssssWWWWWWWWWWWWWWpppppPPPppBBbo......',
    '..oqWWWWWWWWWWWWppppppppppppppPPPPPBppBBooo.......',
    '..oqppppppppppppPPPPPPPPPPPPPPBppppbBBoo..........',
    '..oqPPPPPPPPPPPPppppBppppBppppBBBBBooo............',
    '.ooqpBppppBppppBBBBBBbBBBBBBbBooooo...............',
    'oBBBBBBbBBBBBBbBoooooooooooooo....................',
    '.ooooooooooooooo..................................',
    '..................................................',
  ];

  Object.assign(SPRITES, {
    landmark: { boat: bake(boat, LMPAL) },
  });
})();
