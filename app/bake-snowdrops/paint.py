# Paints the meadow snowdrops' three atlases beside this file, for bake.js:
#
#   python3 app/bake-snowdrops/paint.py   (needs numpy and Pillow)
#
# The look Noah picked (M GOLD GLOW, 0.400): one bold crook, flat. Every part
# is a distance field at 8x supersampling - two leaf blades, the arch, the
# bell hung off its end, a cool shadow pool under the clump - filled in two
# flat tones lit from the upper left, with no ink line. The bloom is gold so
# it reads on snow at a distance, the shut bud a dull bronze so the opening is
# the event, and an open bell wears a halo of pale sparks that turns round it.
#
#   snowdrop16-atlas.png       4 variant rows x (closed, open, picked)
#   snowdrop16-sway-atlas.png  4 rows x (closed leaning -1, 0, +1, open -1, 0, +1)
#   snowdrop16-glow-atlas.png  4 rows x (lean -1, 0, +1) x GLOW_N phases: the
#                              halo's pixels alone, drawn over the open bloom
#
# The four variants are two shapes (a tall crook, a short one), each also
# mirrored, so a scatter never repeats one plant. 16x16 cells, feet at (8, 15).
import math
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CELL = 16
S = 8  # supersampling
GLOW_N = 6  # halo phases: six sparks a sixth of a turn apart, stepping a twelfth, lit two in three

def hx(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
LEAF = (hx('#1f5240'), hx('#4f8e66'))
STEM = (hx('#2e6c44'), hx('#4f8e66'))
SHADOW = (hx('#8e9cc4'), hx('#a9b4d6'))
OPEN = (hx('#f0961e'), hx('#ffd84a'))
SHUT = (hx('#8a5a24'), hx('#b8843a'))
GOLD = hx('#f4cf6a')      # the inner lip
GLINT = hx('#fff4b8')     # one pale pixel on the lit shoulder
HALO = hx('#ffe9a0')
THROAT = hx('#4f8e66')    # the green at the bell's mouth

# (arch top y, arch radius, leaf blades [(foot x, tip x, tip y)])
SHAPES = [
    (3.6, 1.9, ((7.4, 3.8, 8.0), (8.6, 12.6, 9.4))),
    (5.0, 1.7, ((7.2, 4.4, 9.2), (8.4, 11.8, 8.6))),
]
VARIANTS = [(0, False), (0, True), (1, False), (1, True)]

def paint(variant, state, sway=0.0):
    """state: 'closed', 'open' or 'picked'. Returns (rgba, bell centre or None)."""
    shape, mirror = VARIANTS[variant]
    ay, R, blades = SHAPES[shape]
    N = CELL * S
    ys, xs = (np.mgrid[0:N, 0:N] + 0.5) / S
    if mirror: xs = CELL - xs   # the masks are built mirrored, then lit from the upper left like the rest
    m = {}
    m['shad'] = ((xs - 8.5) / 6.0) ** 2 + ((ys - 14.0) / 1.5) ** 2 <= 1
    leaf = np.zeros_like(xs, bool)
    for (x0, x1, top) in blades:
        t = np.clip((14 - ys) / (14 - top), 0, 1); cx = x0 + (x1 - x0) * t ** 1.4
        leaf |= (np.abs(xs - cx) < 0.95 * (1 - t) + 0.35) & (ys <= 14) & (ys >= top)
    m['leaf'] = leaf
    ax = 9.2 + sway * 0.6
    foot = ax - R
    bx, by = ax + R, ay + 0.6
    if state == 'picked':
        # the snapped stalk: straight up from its foot to a ragged end, no bell
        m['stem'] = (np.abs(xs - foot) < 0.45) & (ys >= 8.0) & (ys <= 14) | (np.abs(xs - foot - 0.9) < 0.45) & (ys >= 7.0) & (ys < 8.0)
        m['bell'] = np.zeros_like(leaf)
    else:
        d = np.hypot(xs - ax, ys - ay)
        m['stem'] = (np.abs(d - R) < 0.45) & (ys <= ay) | ((np.abs(xs - foot) < 0.45) & (ys >= ay) & (ys <= 14))
        if state == 'open':
            t = (ys - by) / 5.6
            w = np.where(t < 0.5, 0.8 + 2.6 * t, 2.1 + (t - 0.5) * 1.4)
            m['bell'] = (t > 0) & (t < 1) & (np.abs(xs - bx) < w) & ~((t > 0.85) & (np.abs(xs - bx) < 0.6))
        else:
            dd = np.hypot((xs - bx) / 1.7, (ys - by - 3.0) / 2.6)
            m['bell'] = (dd < 1) | ((ys > by) & (ys < by + 1.2) & (np.abs(xs - bx) < 0.5))
    a = np.zeros((CELL, CELL, 4), np.uint8)
    bxs = CELL - bx if mirror else bx   # the bell's centre in screen space
    tones = {'shad': SHADOW, 'leaf': LEAF, 'stem': STEM, 'bell': OPEN if state == 'open' else SHUT}
    for name in ('shad', 'leaf', 'stem', 'bell'):
        mk = m[name]; dark, lite = tones[name]
        for y in range(CELL):
            for x in range(CELL):
                if mk[y * S:(y + 1) * S, x * S:(x + 1) * S].mean() < 0.4: continue
                if name == 'shad': lit = y < 14
                elif name == 'stem': lit = True
                elif name == 'bell': lit = (x + 0.5) < bxs + 1.3
                else: lit = not mk[y * S + S // 2, max(0, x * S - S // 2)]  # a pixel whose left neighbour is the shape is in its shade
                a[y, x, :3] = lite if lit else dark; a[y, x, 3] = 255
    if state != 'open': return a, None
    px = lambda x: (CELL - 1 - int(round(x))) if mirror else int(round(x))
    def put(x, y, c):
        y = int(round(y))
        if 0 < x < CELL - 1 and 0 < y < CELL - 1: a[y, x, :3] = c; a[y, x, 3] = 255
    put(px(bx), by + 4, THROAT)
    put(px(bx - 1), by + 1, GOLD)
    gold = set(OPEN)
    pts = [(y, x) for y in range(CELL) for x in range(CELL) if a[y, x, 3] and tuple(a[y, x, :3]) in gold]
    ty, tx = min(pts)
    a[ty + 1, tx, :3] = GLINT
    cy = sum(p[0] for p in pts) / len(pts); cx = sum(p[1] for p in pts) / len(pts)
    return a, (cx, cy)

def halo(a, centre, phase):
    """the open bloom's halo at one phase, as its own layer over sprite a"""
    out = np.zeros_like(a)
    cx, cy = centre
    for k in range(6):
        if (k + phase) % 3 == 0: continue
        ang = (k / 6 + phase / 12) * math.tau
        x, y = int(round(cx + math.cos(ang) * 3.6)), int(round(cy + math.sin(ang) * 3.0))
        if 0 < x < CELL - 1 and 0 < y < CELL - 1 and not a[y, x, 3]:
            out[y, x, :3] = HALO; out[y, x, 3] = 255
    return out

LEANS = (-1.5, 0.0, 1.5)
still = Image.new('RGBA', (3 * CELL, 4 * CELL))
sway = Image.new('RGBA', (6 * CELL, 4 * CELL))
glow = Image.new('RGBA', (3 * GLOW_N * CELL, 4 * CELL))
for v in range(len(VARIANTS)):
    for i, st in enumerate(('closed', 'open', 'picked')):
        still.paste(Image.fromarray(paint(v, st)[0]), (i * CELL, v * CELL))
    for j, lean in enumerate(LEANS):
        sway.paste(Image.fromarray(paint(v, 'closed', lean)[0]), (j * CELL, v * CELL))
        a, c = paint(v, 'open', lean)
        sway.paste(Image.fromarray(a), ((3 + j) * CELL, v * CELL))
        for f in range(GLOW_N):
            glow.paste(Image.fromarray(halo(a, c, f)), ((j * GLOW_N + f) * CELL, v * CELL))
still.save(os.path.join(HERE, 'snowdrop16-atlas.png'))
sway.save(os.path.join(HERE, 'snowdrop16-sway-atlas.png'))
glow.save(os.path.join(HERE, 'snowdrop16-glow-atlas.png'))
print('painted', len(VARIANTS), 'variants')
