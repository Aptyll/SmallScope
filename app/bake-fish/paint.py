# Paints every fish a player can catch and writes js/baked/fish.js (never
# hand-edit it: repaint and rebake).
#
#   python3 app/bake-fish/paint.py   (needs numpy and Pillow)
#
# All of them are app/media/paint.py's parts - a leaf-profile body, forked
# tail lobes, petal fins - in their own ramps.
#   THE CREEK'S: the LAKE WHITEFISH and the SNOW CHAR (winter-fish round 2, E
#   and F, 0.433): white winter fish, the char with pink fins and spots.
#     swim    top-down, SWIM_HD headings round from +x (east) clockwise, 2 tail
#             frames each; the ink edge is the water's own shade, so drawn at
#             part alpha the fish sits UNDER the water (drawCreekFish)
#   THE LAKE'S: the FROST PIKE (the `fish` item) and the rare GOLD SUNFISH
#   (round 3, K and I, 0.439), caught through a hole in the ice.
#     swim    as above: the fish crisp in an open hole
#     shadow  the same headings as a SHADOW under the ice (round 4, N, the deep
#             rim): no colour of the fish's own, only the under-ice ink, solid
#             round its edge and half as strong in its core, so the body is
#             felt through thick ice and told apart by its shape
#   icon  side-on, head right, the pouch / well / tooltip icon
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'media'))
import numpy as np
from paint import Canvas, ramp, lint, hx, INK

OUT = os.path.join(HERE, '..', '..', 'js', 'baked', 'fish.js')
SWIM_HD = 16   # headings
CELL = 28      # px square per swim frame, the fish centred on (14, 14)
WATER_EDGE = '#1d3649'   # CREEK_COL.under: the rim a submerged fish wears
SHADOW = '#4a708c'           # the under-ice ink every fish shadow is made of: its rim
SHADOW_CORE = 'rgba(74,112,140,0.52)'  # ...and its core, about half the rim (render draws both at 0.42)

ramp('whiteB', ['#6f86a8', '#9fb2cc', '#cfdcec', '#eef4fb'])   # whitefish back, silver blue
ramp('snowF',  ['#9eaed6', '#bccbea', '#e6eefb', '#ffffff'])   # snow white flank and belly
ramp('finW',   ['#7f93b4', '#a9bad4', '#d6e1f6'])              # a pale fin
ramp('charB',  ['#5f7488', '#8ea2b6', '#c3d2e2', '#eef4fb'])   # the char's frost-grey back
ramp('charF',  ['#a8566a', '#d47e8e', '#f2b4bc'])              # its pink fins
ramp('sunB',   ['#6a3a12', '#a8641c', '#e0a030', '#f6d46a'])   # gold sunfish back
ramp('sunF',   ['#a85a1c', '#e08a34', '#f6c25a', '#fbe6a0'])   # its warm flank
ramp('sunFin', ['#8a3a1c', '#c8602a', '#ee9440'])              # its orange fins
ramp('frostB', ['#4a7a9a', '#7ab0cc', '#b4dcec', '#eaf8ff'])   # frost pike, ice cyan to white
ramp('frostF', ['#8ab8d0', '#bcdcec', '#e4f4fb', '#ffffff'])   # its pale belly
ramp('frostFin', ['#6aa4c4', '#a4d4ea', '#dcf2fb'])            # its glassy fins
PINK, SNOW, EYE = '#d47e8e', '#ffffff', '#221c2e'
SUND = '#6a3a12'

FISH = {
    'whitefish': dict(back='whiteB', flank='snowF', fin='finW', len=19, wid=6.4, tail=4.6, tlen=15, twid=4.4,
                      ilen=11, iwid=4.6, itail=2.8, spots=[], tspots=[], ispots=[]),
    'snowChar': dict(back='charB', flank='snowF', fin='finW', lfin='charF', len=19, wid=6, tail=4.4, tlen=15, twid=4.2,
                     ilen=11, iwid=4.4, itail=2.7,
                     tspots=[(-4, -0.8, PINK), (-1, 0.9, PINK), (2, -0.6, PINK), (4, 0.7, SNOW)],
                     ispots=[(-2.5, 0.2, PINK), (0.5, -0.6, PINK), (2.5, 0.4, PINK)]),
}
ICE = {
    'fish': dict(back='frostB', flank='frostF', fin='frostFin', len=18, wid=4.2, tail=3.6, tlen=17, twid=3.4,
                 ilen=13, iwid=3.8, itail=2.6,
                 tspots=[(-6, -0.8, SNOW), (-2, 0.8, SNOW), (2, -0.8, SNOW)],
                 ispots=[(-3.5, -0.4, SNOW), (-0.5, 0.3, SNOW), (2.5, -0.3, SNOW)]),
    'sunfish': dict(back='sunB', flank='sunF', fin='sunFin', len=12, wid=6.4, tail=3.8, tlen=12, twid=6.4,
                    ilen=9, iwid=7, itail=2.8,
                    tspots=[(-2, 0, SUND), (1, -0.8, SUND), (1, 0.8, SUND)],
                    ispots=[(-2.5, -1.2, SUND), (0, -1.6, SUND), (2, -1.2, SUND)]),
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
    c = Canvas(24); P = at(12, 12, 0)
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
    h = rgb if isinstance(rgb, str) else '#%02x%02x%02x' % tuple(int(v) for v in rgb)
    if h not in pal: pal[h] = CHARS[len(pal)]
    return pal[h]
def grid(img, under=False, shadow=False):
    body = img[..., 3] >= 128
    pad = np.pad(body, 1)
    rim = body & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])  # a body pixel by open water
    rows = []
    for y in range(img.shape[0]):
        s = ''
        for x in range(img.shape[1]):
            if not body[y, x]: s += '.'; continue
            rgb = tuple(int(v) for v in img[y, x, :3])
            if shadow: rgb = SHADOW if rim[y, x] else SHADOW_CORE
            elif under and rgb == INK: rgb = hx(WATER_EDGE)
            s += ch(rgb)
        rows.append(s)
    return rows

def swims(k, f, sets):
    """every heading's two tail frames, as each grid set asks (under / shadow)"""
    out = {n: [] for n in sets}
    for hd in range(SWIM_HD):
        ang = hd * 2 * math.pi / SWIM_HD
        fr = {n: [] for n in sets}
        for wag in (-1, 1):
            img = swim(f, ang, wag)
            r = lint(img)
            if r['off'] or r['clip']: raise SystemExit(f'{k} hd {hd}: {r}')
            for n, kw in sets.items(): fr[n].append(grid(img, **kw))
        for n in sets: out[n].append(fr[n])
    return out

def iconOf(k, f):
    ic = icon(f); r = lint(ic)
    if r['off'] or r['clip']: raise SystemExit(f'{k} icon: {r}')
    print(k, 'icon', trim(ic).shape[1::-1])
    return grid(trim(ic))

creek = {k: (swims(k, f, {'swim': {'under': True}}), iconOf(k, f)) for k, f in FISH.items()}
ice = {k: (swims(k, f, {'swim': {'under': True}, 'shadow': {'shadow': True}}), iconOf(k, f)) for k, f in ICE.items()}

def gridsJs(name, sw):
    out = [f"    {name}: ["]
    for fr in sw:
        out.append("      [" + ', '.join('b([' + ', '.join(f"'{r}'" for r in g) + '])' for g in fr) + "],")
    out.append("    ],")
    return out

js = ["'use strict';",
      "// Every fish a player can catch. SPRITES.creekFish[kind] = { swim, icon } for the creek's",
      "// (CREEK_FISH, js/sim/world.js) and SPRITES.iceFish[kind] = { swim, shadow, icon } for the lake's",
      "// (the `fish` shoal, js/sim/wildlife.js). swim / shadow are top-down, " + str(SWIM_HD) + " headings round from",
      "// +x (east) clockwise, 2 tail frames each, " + str(CELL) + "x" + str(CELL) + " cells centred on the fish: swim rimmed",
      "// in the water's own shade, shadow the under-ice ink, solid rim over a half-strength core.",
      "// icon is side-on, head right, the pouch icon (ITEMS.whitefish / snowChar / fish / sunfish).",
      "// GENERATED by app/bake-fish/paint.py - repaint and rebake, never edit these grids.",
      "(() => {",
      "  const { bake } = SPR;",
      "  const PAL = { '.': null, " + ', '.join(f"'{c}': '{h}'" for h, c in pal.items()) + " };",
      "  const b = (g) => bake(g, PAL);",
      "  SPRITES.creekFish = {};",
      "  SPRITES.iceFish = {};"]
for root, table in (('creekFish', creek), ('iceFish', ice)):
    for k, (sets, ic) in table.items():
        js.append(f"  SPRITES.{root}.{k} = {{")
        for n, sw in sets.items(): js += gridsJs(n, sw)
        js.append("    icon: b([" + ', '.join(f"'{r}'" for r in ic) + "]),")
        js.append("  };")
js += ["  SPRITES.itemWhitefish = SPRITES.creekFish.whitefish.icon;",
       "  SPRITES.itemSnowChar = SPRITES.creekFish.snowChar.icon;",
       "  SPRITES.itemFrostPike = SPRITES.iceFish.fish.icon;",
       "  SPRITES.itemSunfish = SPRITES.iceFish.sunfish.icon;",
       "})();", ""]
open(OUT, 'w', newline='\n').write('\n'.join(js))
print(OUT, len(pal), 'colours')
