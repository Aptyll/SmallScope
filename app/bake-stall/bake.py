# Bakes the merchant's TRADING POST into js/baked/stall.js as char grids.
#
#   python3 app/bake-stall/bake.py     # needs pillow (app/art/px.py)
#
# The shop Merch raises in his court behind the perch (the `merchant` banner, js/sim/robots.js):
# a striped canvas peak over a plank counter, seen side-on, facing the field the way the bird
# does (drawn facing right; the east base wears it mirrored). Four grids, one a step of the
# build: 0 his load set down (a barrel and crates), 1 the counter, 2 the frame, 3 open, with
# Merch seated at the counter in profile (his own side grid, js/sprites/characters.js: keep
# MSIDE in step with merchSide). Beside them the RUG he rolls out before the counter (where a
# customer stands) and his SLED, parked by the tent. The side's cloth is y/Y/t, painted inside
# onTeams. It is the pick of docs/media/concepts/trading-post-concepts-4.png.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(HERE + '/../art'))
from px import Art

OUT = os.path.normpath(HERE + '/../../js/baked/stall.js')
PAL = {
    'o': '#2e2440',
    'f': '#4a3626', 'F': '#5e4836', 'w': '#d8d2c4', 'r': '#6a5a48', 'R': '#857460', 'd': '#473a2d',   # Merch: fur, beard, coat
    'k': '#f2c69b', 'K': '#d69f72', 'e': '#2e2440',
    'p': '#9b7550', 'P': '#7d5a3a', 'q': '#5a3f2b', 'Q': '#b8916a', 'z': '#46301f',                   # wood
    's': '#f4f7ff', 'S': '#d6e0ee',                                                                   # snow
    'c': '#e6d8b8', 'C': '#c9b38a', 'D': '#a8926c',                                                   # canvas
    'n': '#33273a', 'H': '#7a5a52',                                                                   # the dark inside
    'g': '#f2cc6a', 'G': '#c99a3c', 'l': '#fff2b0',                                                   # gold, lamplight
    'm': '#8fa6b8', 'M': '#c4d4e0', 'a': '#4a4a5a',                                                   # steel
    'b': '#8a2a4a', 'B': '#c24a6a', 'j': '#5f9ab8', 'J': '#a8d4ea',                                   # potions
    'y': '#c9524e', 'Y': '#df7358', 't': '#96393f',                                                   # the side's cloth (stand-ins)
}
MSIDE = [
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
]
W, H = 79, 60
OX = 3                               # room left of the wall for the barrel
AX, AY, HW, EY, GY, CT = 34, 9, 30, 27, 58, 44   # the peak, the eave's half width and row, the ground row, the counter top's row
L, R, DOOR = AX - HW + 3, AX + HW - 3, AX - 3    # the wall's back end, the open end's post, where the wall stops


def halfw(y):
    t = (y - AY) / (EY - AY)
    return 2.5 + (HW - 2.5) * (0.35 * t + 0.65 * t ** 1.7)     # the canvas sags between peak and eave


def stripe(u, n=9):
    k = min(n - 1, int((u + 1) / 2 * n))
    return k % 2 == 1, u > 0.38, -0.62 < u < -0.3              # the side's cloth?, in shade?, in the light?


def roof(a):
    for y in range(AY, EY + 1):
        hw = halfw(y)
        for x in range(int(AX - hw), int(AX + hw) + 1):
            u = (x + 0.5 - AX) / hw
            if abs(u) > 1: continue
            team, shade, lit = stripe(u)
            a.put(('t' if shade else 'Y' if lit else 'y') if team else ('C' if shade else 'c'), x, y)
    for x in range(AX - HW, AX + HW + 1):                        # the valance: a scalloped band, the stripes carried down
        team, shade, _ = stripe((x + 0.5 - AX) / HW)
        ch = ('t' if shade else 'y') if team else ('D' if shade else 'C')
        a.put(ch, x, EY + 1); a.put(ch, x, EY + 2)
        seg = (x - (AX - HW)) % 6
        if seg not in (0, 5): a.put(ch, x, EY + 3)
        if seg in (2, 3): a.put(ch, x, EY + 4)
    a.line('D', [(AX - HW, EY), (AX + HW, EY)])
    a.patch(AX - 3, AY - 1, ['..ss..', '.ssss.', 'sssSss'])      # snow: a cap on the peak, drifts caught along the eave
    for x0, n in ((AX - 26, 7), (AX - 12, 5), (AX + 5, 6), (AX + 19, 7)):
        for i in range(n):
            a.put('s', x0 + i, EY - 1)
            if 0 < i < n - 1: a.put('s', x0 + i, EY - 2)
        a.put('S', x0 + n - 1, EY - 1)


def pennant(a):
    a.rect('q', AX, 0, AX, AY - 2)
    a.poly('y', [(AX + 1, 0.5), (AX + 9, 3), (AX + 1, 5.5)])
    a.line('Y', [(AX + 1, 1), (AX + 4, 1)])
    a.line('t', [(AX + 1, 5), (AX + 5, 4)])


def barrel(a, x, y):
    a.patch(x, y - 11, ['.pppppp.', 'pQQQQQQp', 'pPPPPPPp', 'aaaaaaaa', 'pQppppPp', 'pQppppPp', 'pQppppPp', 'pQppppPp', 'aaaaaaaa', 'pQppppPp', '.pppppP.'])
    a.patch(x + 1, y - 13, ['.ssss.', 'ssssSs'])


def crate(a, x, y, w=10, h=9, strap=True):
    a.rect('P', x, y - h + 1, x + w - 1, y); a.rect('p', x + 1, y - h + 2, x + w - 2, y - 1)
    a.line('P', [(x + 1, y - h // 2), (x + w - 2, y - h // 2)]); a.line('P', [(x + w // 2, y - h + 2), (x + w // 2, y - 1)])
    if strap: a.line('y', [(x, y - h + 3), (x + w - 1, y - h + 3)])


def counter(a):
    x0, x1 = DOOR + 13, R + 5
    a.rect('Q', x0, CT, x1, CT); a.rect('p', x0, CT + 1, x1, CT + 2); a.rect('z', x0, CT + 3, x1, CT + 3)
    a.rect('P', x0 + 1, CT + 4, x1 - 1, GY)
    a.line('p', [(x0 + 2, CT + 5), (x1 - 2, CT + 5)]); a.line('p', [(x0 + 2, CT + 10), (x1 - 2, CT + 10)])   # each plank's lit edge
    a.line('q', [(x0 + 1, CT + 8), (x1 - 1, CT + 8)]); a.line('q', [((x0 + x1) // 2, CT + 4), ((x0 + x1) // 2, GY)])
    a.rect('q', x0 + 1, GY, x1 - 1, GY)
    return x0


def post(stage):
    a = Art(W, H, PAL, ox=OX)
    if stage == 3:
        a.rect('n', DOOR, EY + 3, R, GY)                                    # the open end, dark inside
        a.rect('D', DOOR + 1, EY + 5, R - 2, CT - 1)                        # the far canvas wall, lit by his lamp
        for x in range(DOOR + 6, R - 2, 7): a.line('H', [(x, EY + 5), (x, CT - 1)])
        # the south wall: canvas, a band of the side's cloth along its foot
        a.rect('c', L, EY + 3, DOOR - 1, GY)
        a.rect('C', L, GY - 3, DOOR - 1, GY)
        a.rect('y', L, GY - 9, DOOR - 1, GY - 4); a.rect('Y', L, GY - 9, DOOR - 1, GY - 9); a.rect('t', L, GY - 4, DOOR - 1, GY - 4)
        a.rect('C', DOOR - 2, EY + 3, DOOR - 1, GY - 10); a.rect('D', DOOR - 1, EY + 3, DOOR - 1, GY)   # the flap tied back
        # his sign on the wall: the gold sack, the merchant's mark, on the side's cloth
        a.rect('q', L + 3, EY + 5, L + 16, EY + 5)
        a.rect('y', L + 4, EY + 6, L + 15, EY + 19); a.rect('Y', L + 4, EY + 6, L + 15, EY + 7); a.rect('t', L + 14, EY + 8, L + 15, EY + 19)
        a.patch(L + 4, EY + 20, ['yy.yy.yy.ytt'])
        a.patch(L + 6, EY + 9, ['...oo...', '..oGGo..', '..oqqo..', '.oggggo.', 'oggllgGo', 'ogglggGo', 'oggggGGo', '.oooooo.'])
        # a shield hung beside it
        a.patch(L + 17, EY + 9, ['..oooo..', '.oMMMmo.', 'oMMyymmo', 'oMyyyymo', 'omyyyymo', 'ommyymmo', '.ommmmo.', '..oooo..'])
    if stage >= 2: pennant(a)
    if stage == 3:
        roof(a)
        for y in (EY + 5, EY + 6):                                            # the eave's shade on the wall under it
            for x in range(L, DOOR):
                a.put({'c': 'C', 'C': 'D', 'y': 't', 'Y': 'y'}.get(a.get(x, y), a.get(x, y)), x, y)
        for x in range(DOOR + 1, R - 1): a.put('H', x, EY + 5)                # ...and on the far wall inside
    elif stage == 2:                                                          # the frame up, no canvas yet
        a.line('q', [(AX, AY), (L, EY)]); a.line('q', [(AX, AY), (R, EY)]); a.rect('q', AX, AY, AX, GY)
        a.line('D', [(L, EY), (R, EY)])
    if stage >= 2:
        for x in (L - 1, R - 1):
            y0 = EY + 1 if stage == 2 else EY + 3
            a.rect('P', x, y0, x + 2, GY); a.rect('p', x, y0, x, GY)
    if stage == 3:
        a.patch(DOOR + 3, 33, [r.replace('.', ' ') for r in MSIDE])          # Merch, seated in profile
        a.rect('r', DOOR + 7, 46, DOOR + 13, 48); a.rect('d', DOOR + 7, 49, DOOR + 13, 49)   # his coat's hem over the stool
        a.rect('P', DOOR + 6, 50, DOOR + 13, 51); a.rect('q', DOOR + 7, 52, DOOR + 7, 57); a.rect('q', DOOR + 12, 52, DOOR + 12, 57)
    if stage >= 1:
        x0 = counter(a)
    if stage == 3:
        a.patch(DOOR + 13, CT - 1, ['occo', 'oCCo'])                          # his mitten on the counter
        a.patch(x0 + 6, CT - 8, ['.oqo.', '.oMo.', 'oJJjo', 'oJjjo', 'ojjjo', 'ojjjo', '.ooo.'])   # two potions
        a.patch(x0 + 12, CT - 7, ['.oqo.', 'oBBbo', 'oBbbo', 'obbbo', 'obbbo', '.ooo.'])
        a.rect('q', R + 2, EY + 6, R + 8, EY + 6)                             # a lantern on a bracket, beside the customer
        a.patch(R + 6, EY + 7, ['.q.', 'glg', 'glg', 'GgG', '.q.'])
    if stage <= 2:                                                            # his load, not yet unpacked
        crate(a, L + 4, GY); crate(a, L + 6, GY - 9, 8, 7)
        if stage == 0: crate(a, L + 16, GY, 9, 8, False)
        a.patch(L + 6, GY - 17, ['.ssss.', 'ssssSs'])
    barrel(a, L - 9, GY)
    a.outline('o')
    return a


def rug():
    a = Art(18, 44, PAL)
    a.rect('c', 1, 1, 16, 42); a.rect('y', 3, 3, 14, 40); a.rect('t', 3, 40, 14, 40)
    for y in range(6, 38, 8): a.patch(7, y, ['.cc.', 'cggc', 'cggc', '.cc.'])
    for y in range(1, 43, 2): a.put('C', 0, y); a.put('C', 17, y)
    a.outline('o')
    return a


def sled():
    a = Art(19, 24, PAL)
    x, y = 1, 22
    crate(a, x + 3, y - 4, 10, 9); crate(a, x + 5, y - 13, 7, 6)
    a.patch(x + 5, y - 20, ['.sss..', 'ssssss'])
    a.rect('q', x + 2, y - 3, x + 13, y - 3)
    a.rect('q', x + 4, y - 2, x + 5, y - 2); a.rect('q', x + 10, y - 2, x + 11, y - 2)
    a.rect('Q', x + 1, y - 1, x + 14, y - 1); a.rect('q', x + 1, y, x + 14, y)
    a.patch(x + 14, y - 6, ['.qq', 'q.q', '..q', '..q', '.Qq', 'Qq.', 'q..'])
    a.outline('o')
    return a.trim()


def grid(a, ind='      '):
    return '[\n' + '\n'.join("%s  '%s'," % (ind, r) for r in a.rows()) + '\n' + ind + ']'


if __name__ == '__main__':
    stages = [post(i) for i in range(4)]
    used = sorted({c for a in stages + [rug(), sled()] for r in a.rows() for c in r} - set('.ytY'))
    out = ["'use strict';",
           "// The merchant's TRADING POST (OBJECTS.stall, js/sim/world.js; the `merchant` banner,",
           "// js/sim/robots.js): the tent he raises in his court behind the perch, a grid a step of the",
           "// build (0 his load set down, 1 the counter, 2 the frame, 3 open with Merch seated at it),",
           "// the rug he rolls out before the counter and his sled. GENERATED by app/bake-stall/bake.py -",
           "// edit the painter and rebake, never these grids. Drawn facing right, the way the west",
           "// base's bird faces; every set carries its mirror for the east base. The side's cloth",
           "// (y/Y/t) is painted inside onTeams.",
           '(() => {',
           '  const { bake, flipH, onTeams, TEAM_SKINS } = SPR;',
           '  const BASE = { ' + ', '.join("'%s': '%s'" % (c, PAL[c]) for c in used) + ", '.': null };",
           '  const GRIDS = {',
           '    stall: [\n' + ',\n'.join('      ' + grid(a) for a in stages) + ',\n    ],',
           '    rug: ' + grid(rug(), '    ') + ',',
           '    sled: ' + grid(sled(), '    ') + ',',
           '  };',
           '  onTeams(() => TEAM_SKINS.forEach((t, i) => {',
           '    const pal = Object.assign({}, BASE, { y: t.coat, Y: t.coatL, t: t.coatD }), set = SPRITES.teamBuild[i];',
           '    const right = GRIDS.stall.map((g) => bake(g, pal)), sled = bake(GRIDS.sled, pal);',
           '    set.stall = [right, right.map(flipH)]; // [facing right, facing left], each the four steps of the build',
           '    set.rug = bake(GRIDS.rug, pal);',
           '    set.sled = [sled, flipH(sled)];',
           '  }));',
           '  // px from the tent\'s left edge to its wall\'s back end, facing right: the footprint\'s west edge stands here',
           '  SPRITES.stallBack = %d;' % (L + OX),
           '})();']
    open(OUT, 'w').write('\n'.join(out) + '\n')
    print('wrote', OUT, len(stages[0].rows()[0]), 'x', len(stages[0].rows()))
