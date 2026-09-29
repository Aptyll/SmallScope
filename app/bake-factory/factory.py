# The factory: the building each company defends (lore.md). Concept A, the
# FURNACE, from the 2026-09-29 concept round - a PLACEHOLDER until its final
# art is picked. Built from flat cel plates (style.py) in the game's own
# camera: the ground seen from above, heights standing straight up the screen
# (ZK = 1, like the pines), so only tops and south-facing walls show. Units
# are world px; the origin is the footprint's centre on the ground.
import math
import style
from style import P, ramp

style.AIR_ZK = 1.0

PAL = {
    'stone': ramp('#3a3a4c', '#5c5e72', '#8a8ea2', '#b6bccb'),
    'brick': ramp('#3e2630', '#6a3a3a', '#94544a', '#b8765e'),
    'iron':  ramp('#262a38', '#3e4458', '#62708a', '#98a6bc'),
    'snow':  ramp('#9aa8c4', '#c4d0e4', '#e4ecf6', '#fbfdff'),
    'slit':  ramp('#120e18', '#120e18', '#120e18', '#120e18'),
    'brass': ramp('#553620', '#8a5c2e', '#bd8a44', '#eecb78'),
}
# the two team ramps are painted in the game (TEAM_SKINS, js/sprites/core.js),
# so the bake draws them in marker colours and writes them as their own keys
TEAM_KEYS = {'team': 'ABCD', 'glow': 'EFGH'}
def palette():
    p = dict(PAL)
    for m, keys in TEAM_KEYS.items():
        p[m] = [(250, 0, i + (0 if m == 'team' else 8)) for i in range(4)]
    return p


def wall_tone(nx, ny):
    """a standing face: west-facing catches the light, east falls in shade"""
    return max(0, min(2, 1 + round(-nx * 1.4)))


def box(x0, y0, x1, y1, z0, z1, mat, L, top=2, south=None, top_mat=None, **kw):
    """a block: its south wall and its top (the only faces the camera sees)"""
    return [P([(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)], mat, L, tone=1 if south is None else south, **kw),
            P([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], top_mat or mat, L + 0.001, tone=top, **kw)]


def prism(cx, cy, r, z0, z1, mat, L, n=12, top=2, top_mat=None, **kw):
    """a round tower as n facets; only the south-facing half draws"""
    out = []
    pts = [(cx + r * math.cos(2 * math.pi * (i + 0.5) / n), cy + r * math.sin(2 * math.pi * (i + 0.5) / n)) for i in range(n)]
    for i in range(n):
        (ax, ay), (bx, by) = pts[i], pts[(i + 1) % n]
        mxn, myn = math.cos(2 * math.pi * (i + 1) / n), math.sin(2 * math.pi * (i + 1) / n)
        if myn <= 0.02: continue
        out.append(P([(ax, ay, z1), (bx, by, z1), (bx, by, z0), (ax, ay, z0)], mat, L + (1 - abs(mxn)) * 0.0001, tone=wall_tone(mxn, myn), **kw))
    if top is not None:
        out.append(P([(x, y, z1) for x, y in pts], top_mat or mat, L + 0.001, tone=top, **kw))
    return out


def snowcap(pts, z, L):
    """a soft drift of snow lying on a roof: a wobbly blob inside the given area"""
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    rx = (max(p[0] for p in pts) - min(p[0] for p in pts)) * 0.42
    ry = (max(p[1] for p in pts) - min(p[1] for p in pts)) * 0.42
    blob = [(cx + rx * (1 + 0.18 * math.sin(3 * i + cx)) * math.cos(2 * math.pi * i / 11),
             cy + ry * (1 + 0.18 * math.cos(2 * i + cy)) * math.sin(2 * math.pi * i / 11), z + 0.1) for i in range(11)]
    return [P(blob, 'snow', L, tone=2, line=False)]


def furnace():
    """a brick hall round a great iron crucible that glows in the side's colour"""
    F = []
    F += box(-40, -12, 40, 22, 0, 18, 'brick', 1.0, top=2, top_mat='iron')
    F += box(-40, -12, -18, 22, 18, 20, 'iron', 1.1, top=2)
    F += box(18, -12, 40, 22, 18, 20, 'iron', 1.1, top=2)
    F += snowcap([(-38, -10), (-24, -10), (-26, 4), (-38, 8)], 20, 1.2)
    F += snowcap([(22, -10), (38, -10), (38, 0), (28, 2)], 20, 1.2)
    # doors: three arches along the south wall, the middle one lit
    for dx in (-28, 0, 28):
        mat, tone = ('glow', 1) if dx == 0 else ('slit', 0)
        F.append(P([(dx - 5, 22.2, 0), (dx + 5, 22.2, 0), (dx + 5, 22.2, 9), (dx + 3, 22.2, 11), (dx - 3, 22.2, 11), (dx - 5, 22.2, 9)], mat, 1.3, tone=tone, keep=True))
    # the crucible: an iron drum rising out of the roof, banded in the side's
    # colour, its molten core on top
    F += prism(0, 0, 16, 18, 42, 'iron', 2.0, n=16, top=None)
    for z in (24, 34):
        F += prism(0, 0, 16.6, z, z + 2, 'team', 2.1 + z * 0.001, n=16, top=None)
    F += prism(0, 0, 16, 42, 44, 'iron', 2.2, n=16, top=3, top_mat='iron')
    F += prism(0, 0, 12.5, 44, 44.2, 'glow', 2.3, n=16, top=2, top_mat='glow')
    F += prism(-2, -2, 6, 44.2, 44.4, 'glow', 2.31, n=12, top=3, top_mat='glow')
    for cx in (-30, 30):
        F += prism(cx, 12, 3.5, 18, 36, 'brick', 1.5, n=8, top=1, top_mat='slit')
    return F


def ruin():
    """the same hall once it has fallen: the walls broken low, the crucible a
    cold stump, snow already settling in"""
    F = []
    F += box(-40, -12, 40, 22, 0, 6, 'brick', 1.0, top=0, top_mat='iron')
    F += box(-36, -8, -14, 20, 6, 10, 'brick', 1.05, top=1, top_mat='brick')
    F += box(20, -6, 38, 18, 6, 8, 'brick', 1.05, top=1, top_mat='brick')
    for dx in (-28, 28):
        F.append(P([(dx - 5, 22.2, 0), (dx + 5, 22.2, 0), (dx + 5, 22.2, 5), (dx - 5, 22.2, 5)], 'slit', 1.3, tone=0, keep=True))
    F += prism(0, 0, 16, 6, 16, 'iron', 2.0, n=16, top=1, top_mat='iron')
    F += prism(0, 0, 11, 16, 16.2, 'slit', 2.05, n=16, top=0, top_mat='slit')
    F += prism(0, 0, 16.6, 10, 12, 'team', 2.1, n=16, top=None)
    F += snowcap([(-38, -10), (-22, -10), (-24, 2), (-38, 6)], 10, 1.2)
    F += snowcap([(26, 10), (36, 10), (36, 18), (28, 18)], 8, 1.2)
    # the chimneys came down across the roof
    F += box(-34, 12, -10, 17, 6, 9, 'brick', 1.4, top=2)
    F += box(14, -4, 18, 16, 8, 11, 'brick', 1.4, top=2)
    return F
