'use strict';
// The story landmarks' art (LANDMARKS, js/landmarks.js): the abandoned sled,
// the ice-fishing shack and the boat frozen into a lake. One palette for all
// three, weathered wood and a faded rust paint - never a saturated red or
// blue, which are the teams' inks, so nothing here reads as anybody's.
// Picked from docs/media/concepts/landmarks-concepts-1.png: A, C and E.
(() => {
  const { bake, flipH } = SPR;

  // ---------------------------------------------------------------- landmarks
  const LMPAL = {
    '.': null,
    'o': '#2a1f1a', // outline
    'W': '#a3794f', // wood light
    'w': '#8a6142', // wood mid
    'd': '#6b4a34', // wood dark
    'D': '#4a3226', // wood deep (frames, fascia)
    's': '#eef4fb', // snow
    'S': '#c9dcee', // snow shade
    'L': '#fbfdff', // snow lit
    'r': '#9a6450', // the sled's rail, faded rust
    'R': '#6e4638', // ...its shade
    'p': '#8e5a48', // weathered rust paint (the shack, the hull)
    'P': '#a8715a', // ...lit
    'q': '#634036', // ...shade
    'i': '#5f6677', // iron
    'I': '#9aa2b2', // iron lit
    'b': '#a6cde2', // ice
    'B': '#dcecff', // frost, broken ice
    'k': '#16141c', // the dark inside
    'y': '#c9b27a', // rope
    'Y': '#a38c58', // rope shade
  };
  // A, SLAT SLED: slats on iron runners, the front curled up, snow on the
  // tail. 22x11, facing right (the ride flips it for a left-facing rider).
  const sled = [
    '..ooo.................',
    '.ossLoooooooooooo.....',
    '.ossssssWWWWWWWWWoo...',
    '.osssssddddddddddIio..',
    '.osSWWWWWWWWWWWWWooio.',
    '.odddddddddddddddooiio',
    '.orrrrrrrrrrrrrrrooiIo',
    '.oRRRRRRRRRRRRRRRooio.',
    '.oooDooooDooooDooooio.',
    'oiiIiiiiiiIiiiiiiiio..',
    '.oooooooooooooooooo...',
  ];
  // C, RED SHANTY (in rust, not red): a plywood box under a slab of snow, a
  // stovepipe, a frosted window and a plank door, banked in snow at the
  // foot. 34x32 over a 2x2 footprint.
  const shack = [
    '......................oiiiiio.....',
    '.......................oIiio......',
    '.......................oIiio......',
    '..ooooooooooooooooooooooIiiooooo..',
    '.oLLLLLLLLLLLLLLLLLLLLLLIiiLLLLLo.',
    'oLLLLLLLLLLLLLLLLLLLLLLLssSLLLLLLo',
    'oLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLo',
    'osssssssssssssssssssssssssssssssso',
    'osssssssssssssssssssssssssssssssso',
    'osssssssssssssssssssssssssssssssso',
    'oSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSo',
    'oSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSo',
    'oDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDo',
    '.ooqBBqqqBqqqqBBqqBqqqqqqqBqqBBoo.',
    '..oqqBqqqqqqqqqBqqqqqqqqqqqqqBqo..',
    '..oqPpppqPpppqPpppqPpppqPpppqPpo..',
    '..oqPppDDDDDDqPpppqPDDDDDDDpqPpo..',
    '..oqPppDBBbbDqPpppqPDWWdWWDpqPpo..',
    '..oqPppDBbDbDqPpppqPDwwdwwDpqPpo..',
    '..oqPppDbbbbDqPpppqPDwwdwwDpqPpo..',
    '..oqPppDDDDDDqPpppqPDwwdwwDpqPpo..',
    '..oqPpppqPpppqPpppqPDwwdwwDpqPpo..',
    '..oqPpppqPpppqPpppqPDwwdwIDpqPpo..',
    'o.oqPpppqPpppqPpppqPDwwdwwDpqPpo..',
    'sooqPpppqPpppqPpppqPDwwdwwDpqPsso.',
    'SssqPpppqPpppqPpppqPDwwdwwDpssSSso',
    'SSSsssppqPpppqPpppqPDwwdwwssSSSSSs',
    'SSSSSSsssssppsssppqPDwwsssSSSSSSSS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    'oSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSo',
    '.oooooooooooooooooooooooooooooooo.',
  ];
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

  const sledR = bake(sled, LMPAL);
  Object.assign(SPRITES, {
    landmark: { sled: sledR, sledL: flipH(sledR), shack: bake(shack, LMPAL), boat: bake(boat, LMPAL) },
  });
})();
