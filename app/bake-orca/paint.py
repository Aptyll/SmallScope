# Paints the orca of the orca's lake (js/orca.js) and writes js/sprites/orca.js
# (never hand-edit it: repaint and rebake).
#
#   python3 app/bake-orca/paint.py   (needs numpy and Pillow)
#
# Look D BOLD (docs/media/concepts/orca-concepts-2.png, 2026-10-14): the camps' painted look, round and
# heavy, four tones off the black bear's palette (js/sprites/bears.js), a gold
# eye like the bears', three blunt teeth a jaw. Built from app/media/paint.py's
# parts round one bent spine: the body swept along it, the jaws two shorter
# spines hinged at the head, the fins lenses off it.
#   breach   side-on, the spine stood steeply up out of the water, head up and
#            to the LEFT (the right-hand lunge is the mirror, SPR.flipH): `open`
#            as it rises, `shut` once it has bitten. `jaw` is the pixel of the
#            cell between the jaws, the point the draw lays on the bitten spot.
#   shadow   top-down, SHADOW_HD headings round from +x (east) clockwise, 2 tail
#            frames each, as a SHADOW under the ice the way the lake's fish are
#            one (js/sprites/fish.js): no colour of its own, the under-ice ink
#            solid round its edge and half strength in its core
# Each frame is trimmed to its pixels and carries where it sits in its CELL
# (canvas.ox / canvas.oy), so a draw still lays the cell's centre on the spot.
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'media'))
import numpy as np
from paint import Canvas, ramp, lint, bez, nrm, hx

OUT = os.path.join(HERE, '..', '..', 'js', 'sprites', 'orca.js')
CELL = 64          # px square of every shadow frame before the trim
BCELL = 80         # ...and of a breach frame (the flukes hang under the waterline)
SHADOW_HD = 16     # headings
SHADOW = '#4a708c'                     # the under-ice ink every shadow is made of (js/sprites/fish.js): its rim
SHADOW_CORE = 'rgba(74,112,140,0.52)'  # ...and its core, about half the rim

# tones from the black bear's own palette (BLACK_PAL) so it sits with the camps
B4 = ['#31333d', '#3b3b53', '#4a4964', '#595775']; W4 = ['#8096aa', '#b4c4d6', '#d6e2ec', '#fafcff']
ramp('orca', B4); ramp('orcaH', B4); ramp('orcaJ', B4)
ramp('white', W4); ramp('whiteJ', W4)
ramp('saddle', ['#595775', '#7c7a96', '#9a98b2'])
ramp('maw', ['#232427', '#3a2030'], outline='none')
ramp('eye', ['#c6a376'], outline='none')
ramp('sh', ['#000000', '#101010', '#202020'])
EYE, INKC, TOOTH = hx('#c6a376'), hx('#221c2e'), hx('#fafcff')

# D BOLD's shape: body radius, where it is widest, the dorsal fin, the eye
# patch, the pectorals; `sp` is the spine (tail, middle, head) in the cell,
# here stood up out of the water for the breach
D = dict(R=8.5, peak=0.6, fin=12, finw=6.5, finbend=0.1, sp=((48, 65), (42, 42), (28, 14)),
         teeth=3, patch=(4.4, 3.4), pec=(5, 7.5, 5), open=(26, -26))

def rot(p, h, a):
    d = p - h; c, s = math.cos(a), math.sin(a)
    return h + np.array([c * d[0] - s * d[1], s * d[0] + c * d[1]])

class Spine:
    def __init__(s, c, p0, p1, p2):
        s.c = c; s.p = [np.asarray(p0, float), np.asarray(p1, float), np.asarray(p2, float)]
    @staticmethod
    def thru(c, a, m, b):      # a quadratic through a, m (its middle) and b
        a, m, b = map(np.asarray, (a, m, b)); return Spine(c, a, 2 * m - (a + b) / 2, b)
    def at(s, u, t=0.0):
        P, T = bez(*s.p, np.array([u], float)); P, T = P[0], T[0]
        B = np.array([-T[1], T[0]])                # head to the left: B is the back (up)
        return P + B * t, T, B
    def sweep(s, u0, u1, hw, mat, toff=0.0, cup=1.0, bias=0.0):
        u = np.linspace(u0, u1, 400)
        P, T = bez(*s.p, u); B = np.stack([-T[:, 1], T[:, 0]], 1)
        w = np.array([hw(x) for x in u]); off = np.array([toff(x) if callable(toff) else toff for x in u])
        sv = np.linspace(-1, 1, 160)
        S_, I = np.meshgrid(sv, np.arange(len(u)))
        pos = P[I] + B[I] * (off[I] + S_ * w[I])[..., None]
        n = np.concatenate([B[I] * (S_ * cup)[..., None], np.ones_like(S_)[..., None]], -1)
        s.c._put(pos[..., 0].ravel(), pos[..., 1].ravel(), (s.c.light(nrm(n)) + bias).ravel(), mat)
    def fin(s, u, t, dx, dy, w, mat, prof='leaf', bend=0.0, fold=0.6, bias=0.0):
        base, T, B = s.at(u, t)
        s.c.lens(tuple(base), tuple(base + T * dx + B * dy), w, bend=bend, mat=mat, prof=prof, fold=fold, bias=bias)
    def px(s, u, t=0.0):
        p, _, _ = s.at(u, t); return int(math.floor(p[0])), int(math.floor(p[1]))

def prof(R, peak=0.55, nose=0.9, tail=0.1):
    def hw(u):
        a = math.sin(math.pi * 0.5 * min(u, peak) / peak) if u < peak else 1.0
        v = R * max(tail, a ** 0.7) if u < peak else R * (1 - 0.25 * ((min(u, nose) - peak) / (nose - peak)) ** 2)
        if u > nose: v = R * 0.75 * math.sqrt(max(0.0, 1 - ((u - nose) / (1 - nose)) ** 2))
        return v
    return hw

def breach(bite):
    """side-on, head up and to the left; bite = the jaws open. -> (img, jaw)"""
    st = D; c = Canvas(BCELL); o = Spine(c, *st['sp']); hw = prof(st['R'], st['peak'])
    jaw = lambda u: math.sqrt(max(0.05, 1 - u ** 3))
    o.fin(0.02, 0, -6, 6, 4.5, 'orca', bias=-0.1); o.fin(0.02, 0, -6, -6, 4.5, 'orca', bias=-0.25)   # flukes
    o.fin(0.50, hw(0.5) - 1.2, -4.5, st['fin'], st['finw'], 'orca', prof='shard', bend=st['finbend'], fold=0.5)  # dorsal, swept back
    pa, pb, pw = st['pec']
    o.fin(0.70, -hw(0.7) + 2, -pa + 1, -pb + 1.5, pw * 0.9, 'orca', bias=-0.3)                    # far pectoral
    HU = 0.74
    o.sweep(0.0, HU + 0.03, hw, 'orca')
    o.sweep(0.30, HU + 0.03, lambda u: 2.4 * math.sin(math.pi * min(1, (u - 0.30) / 0.5)) ** 0.4,
            'white', toff=lambda u: -hw(u) + 2.2, cup=0.6, bias=0.1)                              # belly band
    o.fin(0.30, -hw(0.3) + 1.5, -9, 3.5, 3.6, 'white', bend=-0.15, fold=0.3, bias=0.1)            # flank swoosh
    o.fin(0.47, hw(0.47) - 2.5, -6, 0.5, 3.2, 'saddle', fold=0.3)                                 # grey saddle
    h = o.at(HU, -1.0)[0]
    a = math.radians(st['open'][0] if bite else 0); b = math.radians(st['open'][1] if bite else 0)
    hh = hw(HU)
    wu, wl = hh * 0.56, hh * 0.36; tU, tL = -1.0 + wu, -1.0 - wl     # the jaws meet on the hinge line
    up = Spine.thru(c, rot(o.at(HU, tU)[0], h, a), rot(o.at((HU + 1) / 2, tU)[0], h, a), rot(o.at(1.0, tU)[0], h, a))
    lo = Spine.thru(c, rot(o.at(HU, tL)[0], h, b), rot(o.at((HU + 0.97) / 2, tL)[0], h, b), rot(o.at(0.95, tL)[0], h, b))
    ut = up.at(0.97, -wu * 0.2)[0]; lt = lo.at(0.97, wl * 0.2)[0]
    if bite:   # the open maw: a dark triangle filling the gap between the jaws, from the hinge out
        g = np.random.default_rng(0).random((60000, 2)); g = np.where(g.sum(1, keepdims=True) > 1, 1 - g, g)
        P = h[None] + g[:, :1] * (ut - h)[None] + g[:, 1:] * (lt - h)[None]
        c._put(P[:, 0], P[:, 1], np.full(len(P), 0.2), 'maw')
    lo.sweep(0.0, 1.0, lambda u: wl * jaw(u), 'whiteJ', cup=0.6, bias=0.1)
    up.sweep(0.0, 1.0, lambda u: wu * jaw(u), 'orcaH')
    pw_, ph_ = st['patch']; up.fin(0.34, wu * 0.45, -pw_, 0.9, ph_, 'white', fold=0.3, bias=0.15)  # eye patch
    o.fin(0.66, -hw(0.66) + 2.2, -pa, -pb, pw, 'orca', bias=0.0)                                # near pectoral
    img = c.render()
    def dot(p, col): x, y = p; img[y, x, :3] = col; img[y, x, 3] = 255
    if not bite: [dot(up.px(t, -wu * jaw(t) + 0.3), INKC) for t in np.linspace(0.2, 0.9, 6)]   # the closed mouth line
    else:
        for t in np.linspace(0.3, 0.85, st['teeth']):
            dot(up.px(t, -wu * jaw(t) - 0.9), TOOTH); dot(lo.px(t, wl * jaw(t) + 0.9), TOOTH)
    dot(up.px(0.42, -wu * 0.15), EYE)
    # the bitten spot: the middle of the open maw (hinge and both tips), the same pixel shut
    m = (h + ut + lt) / 3
    return img, (int(round(m[0])), int(round(m[1])))

def shadow(a, wag):
    """top-down, head along `a`; the tail swung to one side or the other"""
    def at(u, v):
        c, s = math.cos(a), math.sin(a)
        return (CELL / 2 + u * c - v * s, CELL / 2 + u * s + v * c)
    c = Canvas(CELL)
    w = 0.35 if wag else -0.35
    tail = at(-21, w * 4)
    for side in (-1, 1):                                                   # flukes off the tail stock
        c.lens(tail, at(-27, side * 8 + w * 6), 4.2, mat='sh', bend=-0.25 * side)
    c.lens(at(-22, w * 3), at(-4, 0), 6, mat='sh', prof='leaf')            # tail stock
    c.lens(at(-8, 0), at(22, 0), 13, mat='sh', prof='leaf')                # body, widest behind the head
    c.dome(at(16, 0), 5.4, 5.4, mat='sh')                                  # round head
    for side in (-1, 1):                                                   # paddle pectorals
        c.lens(at(10, side * 4.5), at(3, side * 13), 5, mat='sh', prof='petal')
    return c.render(inner=False)

# ---- the bake ---------------------------------------------------------------
CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
pal = {}
def ch(h):
    if h not in pal: pal[h] = CHARS[len(pal)]
    return pal[h]
def grid(img, as_shadow=False):
    """the frame trimmed to its pixels: (ox, oy, rows)"""
    body = img[..., 3] >= 128
    ys, xs = np.nonzero(body)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    pad = np.pad(body, 1)
    rim = body & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    rows = []
    for y in range(y0, y1 + 1):
        s = ''
        for x in range(x0, x1 + 1):
            if not body[y, x]: s += '.'; continue
            if as_shadow: s += ch(SHADOW if rim[y, x] else SHADOW_CORE)
            else: s += ch('#%02x%02x%02x' % tuple(int(v) for v in img[y, x, :3]))
        rows.append(s)
    return int(x0), int(y0), rows

def check(name, img):
    r = lint(img)
    if r['off'] or r['clip']: raise SystemExit(f'{name}: {r}')

frames = {}
for bite, name in ((1, 'open'), (0, 'shut')):
    img, jaw = breach(bite); check('breach ' + name, img)
    frames[name] = (grid(img), jaw)
jaw = frames['open'][1]
print('breach jaw', jaw, 'shut jaw', frames['shut'][1])
shadows = []
for hd in range(SHADOW_HD):
    pair = []
    for wag in (0, 1):
        img = shadow(hd / SHADOW_HD * 2 * math.pi, wag); check(f'shadow {hd}/{wag}', img)
        pair.append(grid(img, as_shadow=True))
    shadows.append(pair)

def g(t):
    ox, oy, rows = t
    return f"t({ox}, {oy}, [" + ', '.join(f"'{r}'" for r in rows) + "])"

js = ["'use strict';",
      "// The orca of the orca's lake (js/orca.js), look D BOLD. SPRITES.orca =",
      "//   breach  { open, shut }: side-on, the steep lunge up out of the ice, head",
      "//           up and to the LEFT (the lunge to the right is SPR.flipH of it);",
      "//           `jaw` is the cell's pixel between the jaws, laid on the bitten spot",
      "//   shadow  [" + str(SHADOW_HD) + " headings round from +x (east) clockwise][2 tail frames]: top-down,",
      "//           the under-ice ink, solid rim over a half-strength core, like the",
      "//           lake's fish (js/sprites/fish.js); drawn at part alpha under the ice",
      "// Every frame is cut from its cell (cell: a shadow's, bcell: a breach's) and keeps where it sat in it",
      "// (canvas.ox / .oy), so the cell's centre still lands where the draw puts it.",
      "// GENERATED by app/bake-orca/paint.py - repaint and rebake, never edit these grids.",
      "(() => {",
      "  const { bake, flipH } = SPR;",
      "  const PAL = { '.': null, " + ', '.join(f"'{c}': '{h}'" for h, c in pal.items()) + " };",
      "  const t = (ox, oy, rows) => Object.assign(bake(rows, PAL), { ox, oy });",
      "  // the mirror keeps its place in the mirrored cell",
      "  const m = (c) => Object.assign(flipH(c), { ox: " + str(BCELL) + " - c.ox - c.width, oy: c.oy });",
      "  const open = " + g(frames['open'][0]) + ";",
      "  const shut = " + g(frames['shut'][0]) + ";",
      "  SPRITES.orca = {",
      f"    cell: {CELL}, bcell: {BCELL},",
      f"    jaw: [{jaw[0]}, {jaw[1]}],",
      "    breach: { open, shut, openR: m(open), shutR: m(shut) },",
      "    shadow: ["]
for pair in shadows:
    js.append("      [" + ', '.join(g(t) for t in pair) + "],")
js += ["    ],", "  };", "})();", ""]
open(OUT, 'w', newline='\n').write('\n'.join(js))
print(OUT, len(pal), 'colours', os.path.getsize(OUT), 'bytes')
