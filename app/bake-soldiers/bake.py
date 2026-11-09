# Bakes the RANGED and SIEGE wave soldiers into js/baked/soldiers.js as char grids.
#
#   python3 app/bake-soldiers/bake.py     # needs numpy and pillow
#
# Both are built on the melee soldier's own grid (botA, js/sprites/buildings.js),
# copied here as the base layer, with their new parts painted over it by the
# shared painter (app/media/paint.py): the RANGED soldier's raised stub arm
# holding a packed snowball (look B of docs/media/concepts/wave-soldiers-concepts-1.png),
# the SIEGE soldier's wider chassis carrying a throwing arm with a big snowball
# in its cup (look C). Each has four frames: the two tread notches with the
# ball in hand, then the same two with it thrown (drawRobot shows those while
# the ball is in the air). The body paint (L/T/t) is the team's, baked inside onTeams.
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(HERE + '/../media'))
import paint
from paint import Canvas, ramp, hx

OUT = os.path.normpath(HERE + '/../../js/baked/soldiers.js')
paint.INK = hx('#1c2130')   # the soldier's own outline ('o')

# the melee soldier (botA/botB, js/sprites/buildings.js): keep in step with it
BOT = {'o': '#1c2130', 'a': '#b5bcc8', 'A': '#7d8595', 'k': '#3b4150', 'n': '#6c7486'}
TEAM = {'L': '#df7358', 'T': '#c9524e', 't': '#96393f'}   # stand-ins, swapped for the team's at bake time
botA = ['..oooooooo..', '.oLLLLLLLLo.', 'oaoTTTTTToao', 'oaoTTTTTToao', 'oAoTTTTTToAo',
        '.oottttttoo.', 'oooooooooooo', 'okkkkkkkkkko', 'oknkknkknkko', 'oooooooooooo']
botB = botA[:8] + ['okknkknkknko', 'oooooooooooo']

ramp('steel', ['#7d8595', '#b5bcc8', '#e4e8ee'])
ramp('wood', ['#6b4a30', '#8a6142', '#a3794f'])
ramp('snowball', ['#9eaed6', '#d6e1f6', '#ffffff'])
CH = {}
for ch, c in list(BOT.items()) + list(TEAM.items()): CH[hx(c)] = ch
for mat, chars in (('steel', 'xyz'), ('wood', 'vwW'), ('snowball', 'qQe')):
    for c, ch in zip(paint.RAMPS[mat], chars): CH[c] = ch
CH[paint.INK] = 'o'
BASE = {'o': '#1c2130', 'a': '#b5bcc8', 'A': '#7d8595', 'k': '#3b4150', 'n': '#6c7486',
        'x': '#7d8595', 'y': '#b5bcc8', 'z': '#e4e8ee', 'v': '#6b4a30', 'w': '#8a6142', 'W': '#a3794f',
        'q': '#9eaed6', 'Q': '#d6e1f6', 'e': '#ffffff'}

def widen(g, add, rows):
    # the same chassis `add` columns wider (its middle column repeated) and `rows` taller
    out = [r[:len(r) // 2] + r[len(r) // 2 - 1] * add + r[len(r) // 2:] for r in g]
    return out[:3] + [out[3]] * rows + out[3:]

def layer(g, W, H, ox, oy):
    im = np.zeros((H, W, 4), np.uint8)
    pal = dict(BOT); pal.update(TEAM)
    for y, r in enumerate(g):
        for x, ch in enumerate(r):
            if ch != '.': im[oy + y, ox + x, :3] = hx(pal[ch]); im[oy + y, ox + x, 3] = 255
    return im

def ranged(tread, ball):
    # the right stub arm raised over the roof's corner, the claw up, a snowball in it
    g = [tread[0], '.oLLLLLLLLoa', 'oaoTTTTTToAo', 'oaoTTTTTToo.', 'oAoTTTTTTo..'] + tread[5:]
    W, H = 16, 15
    base = layer(g, W, H, 1, H - len(g))
    if ball:
        c = Canvas(max(W, H)); c.dome((1 + 12 - 1.5, H - len(g) - 1.2), 2.1, 2.1, mat='snowball')
        top = c.render()[:H, :W]; base = np.where(top[..., 3:4] > 0, top, base)
    return base

def siege(tread, ball):
    # the chassis six columns wider and a row taller, a throwing arm on a steel
    # axle across the roof, cocked back with a big snowball in its wooden cup;
    # thrown, the arm lies forward and the cup is empty
    g = widen(tread, 6, 1)
    W, H = 22, 26
    ox, oy = 2, H - len(g)
    base = layer(g, W, H, ox, oy)
    c = Canvas(max(W, H))
    cx, cy, s = ox + len(g[0]) / 2, oy + 2.7, 1.25
    c.tube((cx - 3 * s, cy + 0.5), (cx + 3 * s, cy + 0.5), 0.8 * s, mat='steel')
    if ball:
        tip = (cx - 1.2 * s, cy - 6.5 * s)
        c.tube((cx, cy + 0.5), tip, 0.9 * s, mat='wood')
        c.dome((tip[0], tip[1] - 0.2 * s), 2.3 * s, 1.6 * s, mat='wood')
        c.dome((tip[0], tip[1] - 1.4 * s), 2.0 * s, 2.0 * s, mat='snowball')
    else:
        tip = (cx + 1.0 * s, cy - 3.2 * s)
        c.tube((cx, cy + 0.5), tip, 0.9 * s, mat='wood')
        c.dome((tip[0], tip[1] - 0.2 * s), 2.3 * s, 1.6 * s, mat='wood')
    top = c.render()[:H, :W]
    return np.where(top[..., 3:4] > 0, top, base)

def grid(im):
    rows = []
    for y in range(im.shape[0]):
        rows.append(''.join('.' if im[y, x, 3] == 0 else CH[tuple(int(v) for v in im[y, x, :3])] for x in range(im.shape[1])))
    return rows

def frames(fn):
    ims = [fn(botA, True), fn(botB, True), fn(botA, False), fn(botB, False)]
    # one box for all four, trimmed to what any frame paints, bottom kept (the tread's foot row)
    m = np.any([im[..., 3] > 0 for im in ims], axis=0)
    ys, xs = np.nonzero(m)
    # AX: columns from the box's left edge to the chassis' middle, where b.x stands
    base = fn(botA, False); ch = np.nonzero(base[-1, :, 3] > 0)[0]
    return [grid(im[ys.min():, xs.min():xs.max() + 1]) for im in ims], int((ch.min() + ch.max() + 1) // 2 - xs.min())

made = {'ranged': frames(ranged), 'siege': frames(siege)}
sets = {k: v[0] for k, v in made.items()}
out = ["'use strict';",
       "// The RANGED and SIEGE wave soldiers (SOLDIER_TYPES, js/sim/robots.js): the melee",
       "// soldier's chassis with a raised arm holding a snowball, and a wider one carrying a",
       "// throwing arm. GENERATED by app/bake-soldiers/bake.py - edit the painter and rebake,",
       "// never these grids. Frames: two tread notches with the ball in hand, then the same",
       "// two thrown. The body (L/T/t) is the team paint, baked inside onTeams.",
       "(() => {",
       "  const { bake, onTeams, TEAM_SKINS } = SPR;",
       "  const BASE = { " + ', '.join(f"'{k}': '{v}'" for k, v in BASE.items()) + ", '.': null };",
       "  const GRIDS = {"]
for k, fr in sets.items():
    out.append(f"    {k}: [")
    for f in fr:
        out.append("      [")
        out += [f"        '{r}'," for r in f]
        out.append("      ],")
    out.append("    ],")
out += ["  };",
        "  const ranged = [], siege = [];",
        "  onTeams(() => TEAM_SKINS.forEach((t, i) => {",
        "    const pal = Object.assign({}, BASE, { L: t.coatL, T: t.coat, t: t.coatD });",
        "    ranged[i] = GRIDS.ranged.map((g) => bake(g, pal));",
        "    siege[i] = GRIDS.siege.map((g) => bake(g, pal));",
        "  }));",
        "  SPRITES.robotRanged = ranged; // by skin(team): [in hand x2, thrown x2]",
        "  SPRITES.robotSiege = siege;",
        f"  // px from a frame's left edge to the chassis' middle (where the body's x stands)",
        f"  SPRITES.robotAx = {{ robotTeam: 6, robotRanged: {made['ranged'][1]}, robotSiege: {made['siege'][1]} }};",
        "})();"]
open(OUT, 'w').write('\n'.join(out) + '\n')
print('wrote', OUT, {k: (len(v[0][0]), len(v[0]), made[k][1]) for k, v in sets.items()})
