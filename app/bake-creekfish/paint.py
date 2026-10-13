# Paints the creek's two catchable fish, the LAKE WHITEFISH and the SNOW CHAR,
# and writes js/sprites/creekfish.js (never hand-edit it: repaint and rebake).
#
#   python3 app/bake-creekfish/paint.py   (needs numpy and Pillow)
#
# The look Noah picked from winter-fish round 2 (E and F, 0.429): white winter
# fish built from app/media/paint.py's parts - a leaf-profile body, forked
# tail lobes, petal fins - in snow and frost ramps, the char with pink fins
# and spots. Two sets per fish:
#   swim  top-down, SWIM_HD headings round from +x (east) clockwise, 2 tail
#         frames each; the ink edge is the water's own shade, so drawn at
#         part alpha the fish sits UNDER the water (drawCreekFish)
#   icon  side-on, head right, the pouch / well / tooltip icon
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'media'))
import numpy as np
from paint import Canvas, ramp, lint, hx, INK

OUT = os.path.join(HERE, '..', '..', 'js', 'sprites', 'creekfish.js')
SWIM_HD = 16   # headings
CELL = 28      # px square per swim frame, the fish centred on (14, 14)
WATER_EDGE = '#1d3649'   # CREEK_COL.under: the rim a submerged fish wears

ramp('whiteB', ['#6f86a8', '#9fb2cc', '#cfdcec', '#eef4fb'])   # whitefish back, silver blue
ramp('snowF',  ['#9eaed6', '#bccbea', '#e6eefb', '#ffffff'])   # snow white flank and belly
ramp('finW',   ['#7f93b4', '#a9bad4', '#d6e1f6'])              # a pale fin
ramp('charB',  ['#5f7488', '#8ea2b6', '#c3d2e2', '#eef4fb'])   # the char's frost-grey back
ramp('charF',  ['#a8566a', '#d47e8e', '#f2b4bc'])              # its pink fins
PINK, SNOW, EYE = '#d47e8e', '#ffffff', '#221c2e'

FISH = {
    'whitefish': dict(back='whiteB', flank='snowF', fin='finW', len=19, wid=6.4, tail=4.6, tlen=15, twid=4.4,
                      ilen=11, iwid=4.6, itail=2.8, spots=[], tspots=[], ispots=[]),
    'snowChar': dict(back='charB', flank='snowF', fin='finW', lfin='charF', len=19, wid=6, tail=4.4, tlen=15, twid=4.2,
                     ilen=11, iwid=4.4, itail=2.7,
                     tspots=[(-4, -0.8, PINK), (-1, 0.9, PINK), (2, -0.6, PINK), (4, 0.7, SNOW)],
                     ispots=[(-2.5, 0.2, PINK), (0.5, -0.6, PINK), (2.5, 0.4, PINK)]),
}

def rot(u, v, a):
    c, s = math.cos(a), math.sin(a); return (u * c - v * s, u * s + v * c)

def at(cx, cy, a):
    return lambda u, v: (cx + rot(u, v, a)[0], cy + rot(u, v, a)[1])

def stamp(img, P, spots):
    for (u, v, col) in spots:
        x, y = P(u, v); x, y = int(round(x)), int(round(y))
        if img[y, x, 3] and tuple(img[y, x, :3]) != INK: img[y, x, :3] = hx(col)

def swim(f, ang, wag):
    """top-down, head along `ang`; wag bends the tail lobes across (-1..1)"""
    c = Canvas(CELL); P = at(CELL / 2, CELL / 2, ang)
    L, W = f['tlen'], f['twid']; h = L / 2; t = f['tail'] * 0.85; fin = f['fin']
    sw = wag * 1.4
    c.lens(P(-h + 1, -0.2), P(-h - t, -t * 0.6 + sw), t * 0.5, mat=fin, prof='leaf')
    c.lens(P(-h + 1, 0.2), P(-h - t, t * 0.6 + sw), t * 0.5, mat=fin, prof='leaf')
    pf = f.get('lfin', fin)
    c.lens(P(h * 0.35, -W * 0.3), P(h * 0.05, -W * 0.5 - 1.6), 1.8, mat=pf, prof='petal')
    c.lens(P(h * 0.35, W * 0.3), P(h * 0.05, W * 0.5 + 1.6), 1.8, mat=pf, prof='petal')
    c.lens(P(-h, 0), P(h, 0), W, mat=f['back'], prof='leaf', fold=0.2, cup=0.9)
    img = c.render()
    stamp(img, P, f['tspots'])
    return img

def icon(f):
    """side-on, head right: the item icon"""
    c = Canvas(20); P = at(10, 10, 0)
    L, W = f['ilen'], f['iwid']; h = L / 2; T = f['itail']; fin = f['fin']
    c.lens(P(-h + 0.8, -0.2), P(-h - T, -T * 0.9), T * 0.7, bend=0.1, mat=fin, prof='leaf')
    c.lens(P(-h + 0.8, 0.2), P(-h - T, T * 0.9), T * 0.7, bend=-0.1, mat=fin, prof='leaf')
    c.lens(P(0.5, -W * 0.3), P(-0.8, -W * 0.5 - 1.4), 2, mat=fin, prof='petal')
    c.lens(P(-h, W * 0.12), P(h, W * 0.1), W, mat=f['flank'], prof='leaf', fold=0.3, cup=0.6)
    c.lens(P(-h, -W * 0.1), P(h - 0.5, -W * 0.08), W * 0.68, mat=f['back'], prof='leaf', fold=0.3, cup=0.6)
    if 'lfin' in f: c.lens(P(h * 0.3, W * 0.25), P(h * 0.05, W * 0.6), 1.4, mat=f['lfin'], prof='petal')
    img = c.render()
    ex, ey = P(h - 2.2, 0)
    img[int(ey), int(ex), :3] = hx(EYE)
    stamp(img, P, f['ispots'])
    return img

def trim(img):
    a = img[..., 3] > 0; ys, xs = np.nonzero(a)
    return img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

# ---- the bake ---------------------------------------------------------------
CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
pal = {}
def ch(rgb):
    h = '#%02x%02x%02x' % tuple(int(v) for v in rgb)
    if h not in pal: pal[h] = CHARS[len(pal)]
    return pal[h]
def grid(img, under=False):
    rows = []
    for y in range(img.shape[0]):
        s = ''
        for x in range(img.shape[1]):
            if img[y, x, 3] < 128: s += '.'; continue
            rgb = tuple(img[y, x, :3])
            s += ch(hx(WATER_EDGE) if under and rgb == INK else rgb)
        rows.append(s)
    return rows

out = {}
for k, f in FISH.items():
    sw = []
    for hd in range(SWIM_HD):
        ang = hd * 2 * math.pi / SWIM_HD
        fr = []
        for wag in (-1, 1):
            img = swim(f, ang, wag)
            r = lint(img)
            if r['off'] or r['clip']: raise SystemExit(f'{k} hd {hd}: {r}')
            fr.append(grid(img, True))
        sw.append(fr)
    ic = icon(f); r = lint(ic)
    if r['off'] or r['clip']: raise SystemExit(f'{k} icon: {r}')
    out[k] = (sw, grid(trim(ic)))
    print(k, 'icon', trim(ic).shape[1::-1])

js = ["'use strict';",
      "// The creek's two catchable fish (CREEK_FISH, js/world.js): SPRITES.creekFish[kind] =",
      "// { swim: [heading][frame], icon }. swim is top-down, " + str(SWIM_HD) + " headings round from +x (east)",
      "// clockwise, 2 tail frames each, " + str(CELL) + "x" + str(CELL) + " cells centred on the fish, rimmed in the",
      "// water's own shade so drawCreekFish can sink it under the surface; icon is side-on,",
      "// head right, the pouch icon (ITEMS.whitefish / ITEMS.snowChar).",
      "// GENERATED by app/bake-creekfish/paint.py - repaint and rebake, never edit these grids.",
      "(() => {",
      "  const { bake } = SPR;",
      "  const PAL = { '.': null, " + ', '.join(f"'{c}': '{h}'" for h, c in pal.items()) + " };",
      "  const b = (g) => bake(g, PAL);",
      "  SPRITES.creekFish = {};"]
for k, (sw, ic) in out.items():
    js.append(f"  SPRITES.creekFish.{k} = {{")
    js.append("    swim: [")
    for fr in sw:
        js.append("      [" + ', '.join('b([' + ', '.join(f"'{r}'" for r in g) + '])' for g in fr) + "],")
    js.append("    ],")
    js.append("    icon: b([" + ', '.join(f"'{r}'" for r in ic) + "]),")
    js.append("  };")
js += ["  SPRITES.itemWhitefish = SPRITES.creekFish.whitefish.icon;",
       "  SPRITES.itemSnowChar = SPRITES.creekFish.snowChar.icon;",
       "})();", ""]
open(OUT, 'w', newline='\n').write('\n'.join(js))
print(OUT, len(pal), 'colours')
