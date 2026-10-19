# Bakes the ROAD TOWER into js/baked/tower.js as char grids.
#
#   python3 app/bake-tower/bake.py     # needs numpy and pillow; rerun after changing tower.py
#
# tower.py paints every piece; this renders them with the team paint swapped
# for sentinel colours, crops each set to one shared box, gives each colour a
# char and writes the grids. The team paint becomes k/K/e/E (fit, coatD, coat,
# coatL), so js/baked/tower.js paints it inside onTeams. The grids this writes
# are the game's only copy.
import os, math, numpy as np
from tower import body, front, gun, bolt, deck, lint, GC, LIFT

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(HERE + '/../../js/baked/tower.js')
HEADS = 16                       # the gun's headings, from east, clockwise
FRAMES = [dict(draw=1.0), dict(draw=0.0, bolt=False, recoil=1.4), dict(draw=0.35, bolt=False), dict(draw=0.7, bolt=False)]
SENT = ['#ff00f0', '#ff00f1', '#ff00f2', '#ff00f3', '#ff00f3']
TEAMCH = {(255, 0, 0xf0): 'k', (255, 0, 0xf1): 'K', (255, 0, 0xf2): 'e', (255, 0, 0xf3): 'E'}

B = body(SENT); F = front(SENT)
G = [[gun(SENT, 2 * math.pi * h / HEADS, **f) for f in FRAMES] for h in range(HEADS)]
BO = [bolt(SENT, 2 * math.pi * h / HEADS) for h in range(HEADS)]
for im in [B, F] + [f for h in G for f in h] + BO:
    assert not lint(im, allowed=None)['clip'], 'a piece touches its canvas edge'

def box(ims):
    on = np.any([im[..., 3] > 0 for im in ims], axis=0)
    ys, xs = np.nonzero(on)
    return xs.min(), xs.max() + 1, ys.min(), ys.max() + 1

chars = {}
POOL = [c for c in 'abcdfghijlmnopqrstuvwxyzABCDFGHIJLMNOPQRSTUVWXYZ0123456789#$%&*+-=?@^~']
def ch(px):
    if px[3] == 0: return '.'
    rgb = tuple(int(v) for v in px[:3])
    if rgb in TEAMCH: return TEAMCH[rgb]
    if rgb not in chars: chars[rgb] = POOL[len(chars)]
    return chars[rgb]
def grid(im, b):
    a, b_, c, d = b
    return [''.join(ch(im[y, x]) for x in range(a, b_)) for y in range(c, d)]

bb = box([B, F])
gb = box([f for h in G for f in h])
ob = box(BO)
dk = deck()
# the turntable's centre in the body's cropped grid, and the gun grid's corner relative to it
turn = (int(dk[0] - bb[0]), int(dk[1] - LIFT - bb[2]))
gun_off = (int(gb[0] - GC[0]), int(gb[2] - GC[1]))
bolt_off = (int(ob[0] - BO[0].shape[1] // 2), int(ob[2] - BO[0].shape[0] // 2))

def js(g, ind):
    return '[\n' + ''.join(ind + "  '" + r + "',\n" for r in g) + ind + ']'

out = ["'use strict';",
       "// THE ROAD TOWER (STRUCTS.tower, js/sim/towers.js): the Sentinel, a cut-stone",
       "// tower with a gun deck, and its gun, a great crossbow on a turntable. GENERATED",
       "// by app/bake-tower/bake.py from the painter in app/bake-tower/tower.py - edit",
       "// the painter and rebake, never these grids. k/K/e/E are the team paint (fit,",
       "// coatD, coat, coatL), baked inside onTeams. Per side, SPRITES.teamBuild[i]:",
       "//   tower      [body]: the tower and its deck, everything behind the gun (structSprite)",
       "//   towerFront the deck's front parapet, laid over the gun at the body's corner",
       "//   towerGun   [heading][frame]: " + str(HEADS) + " headings from east, clockwise; frames LOADED,",
       "//              LOOSED, WINDING, WOUND (drawTower, js/draw/towers.js)",
       "//   towerBolt  [heading]: the bolt in flight along that screen bearing",
       "// SPRITES.towerAt: the turntable in the body's grid, the gun grid's corner",
       "// from the turntable, and the bolt grid's corner from the bolt's middle.",
       "(() => {",
       "  const { bake, onTeams, TEAM_SKINS } = SPR;",
       None]  # BASE, once the grids have named every colour
out.append("  const BODY = " + js(grid(B, bb), '  ') + ";")
out.append("  const FRONT = " + js(grid(F, bb), '  ') + ";")
out.append("  const GUN = [")
for h in G:
    out.append("    [")
    for f in h: out.append("      " + js(grid(f, gb), '      ') + ",")
    out.append("    ],")
out.append("  ];")
out.append("  const BOLT = [")
for im in BO: out.append("    " + js(grid(im, ob), '    ') + ",")
out.append("  ];")
out[out.index(None)] = "  const BASE = { " + ', '.join(f"'{c}': '#{r:02x}{g:02x}{b:02x}'" for (r, g, b), c in chars.items()) + ", '.': null };"
out += ["  onTeams(() => TEAM_SKINS.forEach((t, i) => {",
        "    const pal = Object.assign({}, BASE, { k: t.fit, K: t.coatD, e: t.coat, E: t.coatL }), set = SPRITES.teamBuild[i];",
        "    set.tower = [bake(BODY, pal)];",
        "    set.towerFront = bake(FRONT, pal);",
        "    set.towerGun = GUN.map((h) => h.map((g) => bake(g, pal)));",
        "    set.towerBolt = BOLT.map((g) => bake(g, pal));",
        "    if (i === 0) SPRITES.tower = set.tower;",
        "  }));",
        "  SPRITES.towerAt = { turn: [%s, %s], gun: [%s, %s], bolt: [%s, %s] };" % (turn[0], turn[1], gun_off[0], gun_off[1], bolt_off[0], bolt_off[1]),
        "})();", ""]
open(OUT, 'w').write('\n'.join(out))
print('wrote', OUT, 'body', bb, 'gun', gb, 'bolt', ob, 'colours', len(chars))
