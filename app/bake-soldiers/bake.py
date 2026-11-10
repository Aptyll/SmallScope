# Bakes the RANGED and SIEGE wave soldiers into js/baked/soldiers.js as char grids.
#
#   python3 app/bake-soldiers/bake.py     # needs numpy and pillow
#
# Both are built on the melee soldier's own grid (botA, js/sprites/buildings.js),
# copied here as the base layer, with their new parts painted over it by the
# shared painter (app/media/paint.py): the RANGED soldier's raised stub arm
# holding a packed snowball (look B of docs/media/concepts/wave-soldiers-concepts-1.png),
# and the SIEGE soldier, the ballista cart (look D): the chassis a size up, a bow
# on a swivel post over it, worked by the robot's own arm at the winch (drawn
# with app/art's px.Art). Each has four frames: the two tread notches loaded
# (ball in hand, bolt on the stock), then the same two spent (drawRobot shows
# those while the shot is in the air). The body paint (L/T/t) and the bolt's
# fletching (f, the side's mark) are the team's, baked inside onTeams; the
# siege set adds the four mirrored, for facing left (b.faceL).
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(HERE + '/../media'))
import paint
from paint import Canvas, ramp, hx
sys.path.insert(0, os.path.normpath(HERE + '/../art'))
from px import Art

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
# the cart's own letters (px.Art): BASE's, the team's stand-ins and its fletching (f, the team's mark)
CART_PAL = dict(BASE, **TEAM, f='#e05548', **{'.': None})

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

def cart(loaded, notch):
    # THE BALLISTA CART (look D, redrawn 0.6xx): the robot is the gunner. The melee
    # chassis grown a size carries a steel swivel post; the bow stands on a wooden
    # stock across the post's top, and the robot's own stub arm reaches back up to
    # the winch that draws it. Loaded: the string drawn back to a steel bolt with
    # team fletching (f). Fired: the bolt gone, the limbs relaxed, the string
    # straight. Faces right; drawRobot shows the mirror for left.
    a = Art(32, 27, CART_PAL, ox=2, oy=6)
    a.rect('k', 4, 17, 16, 18)                                # the tread, its notches rolling
    for x in range(5 + notch, 16, 3): a.put('n', x, 18)
    a.rect('o', 4, 16, 16, 16)
    a.rect('T', 5, 12, 15, 14); a.rect('t', 5, 15, 15, 15); a.rect('L', 5, 11, 15, 11)
    a.rect('x', 9, 6, 11, 10); a.rect('y', 9, 6, 9, 10)       # the swivel post
    a.rect('w', 2, 5, 21, 5); a.rect('W', 2, 4, 21, 4)        # the stock
    a.rect('y', 0, 3, 2, 6); a.put('z', 0, 3); a.rect('x', 0, 6, 2, 6)   # the winch
    a.line('a', [(5, 11), (3, 9), (2, 8)]); a.put('A', 1, 7)  # the stub arm on the crank
    tip = 18 if loaded else 20
    T0, T1 = -4, 13   # the far limb's tip up the screen, the near one's down it
    a.line('x', [(20, 4), (22, 2), (22, -2), (tip - 1, T0)], curve=True)
    a.line('x', [(20, 5), (22, 7), (22, 11), (tip - 1, T1)], curve=True)
    a.line('y', [(21, 4), (23, 2), (23, -2), (tip, T0)], curve=True)
    a.line('y', [(21, 5), (23, 7), (23, 11), (tip, T1)], curve=True)
    a.line('z', [(23, -2), (23, 2)])
    if loaded:
        a.rect('z', 6, 3, 25, 3)
        a.patch(25, 1, ['z  ', 'zz ', 'zzz', 'zz ', 'z  '])
        a.patch(3, 2, ['fff', 'ff ', 'fff'])
    a.outline('o')
    if loaded:
        a.line('A', [(tip - 2, T0), (7, 3)], only='.o'); a.line('A', [(tip - 2, T1), (7, 4)], only='.o')
    else:
        a.line('A', [(tip - 2, T0), (tip - 2, T1)], only='.oWwvTLtk')
    return a.rows()

def siege_frames():
    fr = [cart(True, 0), cart(True, 1), cart(False, 0), cart(False, 1)]
    # one box for all four, trimmed to what any frame paints, bottom kept (the tread's foot row)
    H, W = len(fr[0]), len(fr[0][0])
    ys = [y for y in range(H) if any(f[y][x] != '.' for f in fr for x in range(W))]
    xs = [x for x in range(W) if any(f[y][x] != '.' for f in fr for y in range(H))]
    y0, x0, x1 = min(ys), min(xs), max(xs)
    foot = max(ys)
    # AX: from the box's left edge to the chassis' middle (where b.x stands)
    row = fr[2][foot]; ch = [x for x, c in enumerate(row) if c != '.']
    return [[r[x0:x1 + 1] for r in f[y0:foot + 1]] for f in fr], (min(ch) + max(ch) + 1) // 2 - x0

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

made = {'ranged': frames(ranged), 'siege': siege_frames()}
sets = {k: v[0] for k, v in made.items()}
out = ["'use strict';",
       "// The RANGED and SIEGE wave soldiers (SOLDIER_TYPES, js/sim/robots.js): the melee",
       "// soldier's chassis with a raised arm holding a snowball, and the ballista cart.",
       "// GENERATED by app/bake-soldiers/bake.py - edit the painter and rebake, never these",
       "// grids. Frames: two tread notches loaded, then the same two spent; the siege set",
       "// adds those four mirrored (facing left). The body (L/T/t) and the fletching (f)",
       "// are the team's, baked inside onTeams.",
       "(() => {",
       "  const { bake, flipH, onTeams, TEAM_SKINS } = SPR;",
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
        "    const pal = Object.assign({}, BASE, { L: t.coatL, T: t.coat, t: t.coatD, f: t.mark });",
        "    ranged[i] = GRIDS.ranged.map((g) => bake(g, pal));",
        "    const right = GRIDS.siege.map((g) => bake(g, pal));",
        "    siege[i] = right.concat(right.map(flipH));",
        "  }));",
        "  SPRITES.robotRanged = ranged; // by skin(team): [in hand x2, thrown x2]",
        "  SPRITES.robotSiege = siege; // [loaded x2, spent x2] facing right, then the same facing left",
        f"  // px from a frame's left edge to the chassis' middle (where the body's x stands; a mirrored frame's is width - this)",
        f"  SPRITES.robotAx = {{ robotTeam: 6, robotRanged: {made['ranged'][1]}, robotSiege: {made['siege'][1]} }};",
        "})();"]
open(OUT, 'w').write('\n'.join(out) + '\n')
print('wrote', OUT, {k: (len(v[0][0]), len(v[0]), made[k][1]) for k, v in sets.items()})
