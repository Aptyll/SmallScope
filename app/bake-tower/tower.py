# The ROAD TOWER painter: the Sentinel, a cut-stone tower with a gun deck, and
# its gun, a great crossbow on a turntable, painted in code with the 2D cutout
# painter (app/media/paint.py) - never typed by hand. The bake (bake.py) swaps
# the team paint for sentinels and writes the grids to js/baked/tower.js.
#   body()             the tower and its deck, everything behind the gun
#   front()            the deck's front parapet, laid over the gun
#   gun(th, draw, ...) the crossbow at heading th (rad, 0 = east, clockwise as
#                      the world's y runs down), wound back by draw (1 loaded,
#                      0 loosed), its bolt in the slider or not
#   bolt(a)            the bolt in flight, laid along a screen angle a
# The gun is posed in 3D (u forward, v to its left, z up), turned to its
# heading and laid out by the game's own 3/4 rule (screen y = ground y - z),
# then painted part by part, far parts first.
import os, sys, math, numpy as np
sys.path.insert(0, os.path.normpath(os.path.dirname(os.path.abspath(__file__)) + '/../media'))
from paint import Canvas, ramp, lint, SS, nrm

ramp('wood', ['#412a1a', '#5a3f28', '#7a5636', '#966e46', '#a3794f'])
ramp('woodD', ['#2c1d12', '#412a1a', '#5a3f28', '#6b4a30'])
ramp('gwood', ['#5a3f28', '#7a5636', '#966e46', '#b8895a', '#d4a874'])
ramp('plank', ['#4e3421', '#6b4a30', '#8a6142', '#a3794f', '#c9a27a'])
ramp('stone', ['#3a3f4f', '#6b7486', '#8a93a4', '#959eaf', '#a9b2c1'])
ramp('stoneD', ['#30343f', '#4f5666', '#6b7486', '#8a93a4'])
ramp('iron', ['#1c2130', '#2a2e3a', '#4a5060', '#737b8c', '#9aa2b2'])
ramp('bow', ['#2a2e3a', '#4a5060', '#737b8c', '#a8b0c0', '#d6dce8'])
ramp('steel', ['#2a2e3a', '#737b8c', '#b9c2d2', '#e6eefb'])
ramp('ash', ['#7a5636', '#b8895a', '#e0c08a', '#f4dcae'])
ramp('string', ['#3a3226', '#6a5c48'], outline='none')
def team(cols):
    # the side's paint, dark to light: five tones (the bake hands sentinels)
    ramp('coat', cols)
TEAM = {'blue': ['#2a3a56', '#2b4d7d', '#3f6fb0', '#5e93d8', '#5e93d8'],
        'red':  ['#5a3340', '#96393f', '#c9524e', '#df7358', '#df7358']}

N = 128            # the body's canvas
FX, FY = 64, 124   # the foot's middle, px
D = 8              # the shaft's depth, px
ZD = 72            # the deck's floor, px up
DW = 40            # the deck's width (corbelled out past the shaft)
LIFT = 4           # px the gun's turntable stands over the deck's middle, clear of the parapet
GN = 80            # the gun's canvas
GC = (40, 44)      # the turntable's centre in it
GS = 1.3           # px a gun unit is drawn at
NTOP = np.array([0, -0.85, 0.5])

class C(Canvas):
    def pts(s, X, Y, n, mat, bias=0.0):
        if X.size == 0: return
        tone = s.light(nrm(np.asarray(n, float))) + bias
        s._put(X.ravel(), Y.ravel(), np.broadcast_to(tone, X.shape).ravel(), mat)
    def grid(s, x0, x1, y0, y1):
        xs = np.arange(x0, x1, 1 / SS) + 0.5 / SS; ys = np.arange(y0, y1, 1 / SS) + 0.5 / SS
        return np.meshgrid(xs, ys)
    def quad(s, x0, x1, y0, y1, n, mat, bias=0.0, mask=None):
        X, Y = s.grid(x0, x1, y0, y1)
        m = np.ones_like(X, bool) if mask is None else mask(X, Y)
        s.pts(X[m], Y[m], np.broadcast_to(n, X[m].shape + (3,)), mat, bias)
    def prism(s, xc, yf, wb, wt, d, h, mat, z0=0, bias=0.0, top=True, front=True, side=0.55, xr=None):
        # a box tapering from wb (bottom) to wt (top), d deep; the front face lit left, its right third turned away
        if front:
            def m(X, Y):
                z = (yf - z0 - Y) / h
                hw = (wb + (wt - wb) * z) / 2
                ok = (np.abs(X - xc) <= hw) & (z >= 0) & (z <= 1)
                if xr is not None: ok &= (X >= xr[0]) & (X < xr[1])
                return ok
            X, Y = s.grid(xc - wb / 2 - 1, xc + wb / 2 + 1, yf - z0 - h, yf - z0)
            k = m(X, Y)
            u = (X[k] - xc) / (wb / 2)
            n = np.stack([np.clip(u, -1, 1) * side * 0.6, np.full_like(u, 0.2), np.ones_like(u)], -1)
            n[u > 0.62] = [0.75, 0.15, 0.62]
            s.pts(X[k], Y[k], n, mat, bias)
        if top:
            yt = yf - z0 - h
            s.quad(xc - wt / 2, xc + wt / 2, yt - d, yt, NTOP, mat, bias + 0.03,
                   mask=(lambda X, Y: (X >= xr[0]) & (X < xr[1])) if xr else None)
    def disc(s, cx, cy, rx, ry, mat, bias=0.0, n=NTOP):
        X, Y = s.grid(cx - rx, cx + rx, cy - ry, cy + ry)
        m = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1
        s.pts(X[m], Y[m], np.broadcast_to(n, X[m].shape + (3,)), mat, bias)
    def banner(s, x, y0, w, h, notch=3.5):
        # a hanging cloth in the side's colour: square top on its pole, a swallowtail foot, a pale band
        m = lambda X, Y: (Y < y0 + h - notch + np.abs(X - x) / (w / 2) * notch) & (np.abs(X - x) <= w / 2)
        X, Y = s.grid(x - w / 2, x + w / 2, y0, y0 + h)
        k = m(X, Y)
        u = (X[k] - x) / (w / 2)
        n = np.stack([u * 0.35, np.full_like(u, 0.1) + np.sin((Y[k] - y0) * 0.5) * 0.15, np.ones_like(u)], -1)
        s.pts(X[k], Y[k], n, 'coat', 0.0)
        s.quad(x - w / 2, x + w / 2, y0 + h * 0.3, y0 + h * 0.3 + 1.6, np.array([-0.2, -0.3, 0.93]), 'coat', 0.45)
        s.tube((x - w / 2 - 1.5, y0), (x + w / 2 + 1.5, y0), 0.7, mat='iron')

def courses(c, xc, yf, wb, wt, d, h, mat, ch=6, nb=4, z0=0, seed=1, quoin=True, jitter=0.05):
    # dressed stone laid in courses, every other one offset half a block
    rng = np.random.default_rng(seed)
    z, k = z0, 0
    while z < z0 + h - 0.2:
        hh = min(ch, z0 + h - z)
        f0 = (z - z0) / h; f1 = (z + hh - z0) / h
        wb_ = wb + (wt - wb) * f0; wt_ = wb + (wt - wb) * f1
        bw = wb_ / nb; off = bw / 2 if k % 2 else 0
        xs = [xc - wb_ / 2] + [xc - wb_ / 2 + off + bw * i for i in range(1, nb + 1) if xc - wb_ / 2 + off + bw * i < xc + wb_ / 2 - 0.5] + [xc + wb_ / 2]
        for j, (a, b) in enumerate(zip(xs[:-1], xs[1:])):
            edge = quoin and (j == 0 or j == len(xs) - 2) and k % 2 == 0
            c.prism(xc, yf, wb_ + 0.01, wt_ + 0.01, d, hh, mat, z0=z, top=False, xr=(a, b),
                    bias=(0.06 if edge else rng.uniform(-jitter, jitter * 0.6)))
        z += hh; k += 1

def body(cols):
    team(cols); c = C(N)
    # plinth: one clean step
    courses(c, FX, FY, 40, 40, D + 2, 7, 'stoneD', ch=7, nb=5, seed=2, quoin=False, jitter=0.03)
    c.prism(FX, FY, 40, 40, D + 2, 7, 'stoneD', front=False, bias=0.03)
    # the shaft: dressed stone, quoins, gently tapering
    courses(c, FX, FY - 2, 30, 26, D, 57, 'stone', ch=6, nb=4, z0=7, seed=5, jitter=0.04)
    # the door with its arch and two iron straps
    dz = 7
    c.prism(FX, FY - 2.01, 10, 10, 0, 12, 'stoneD', z0=dz, top=False, bias=0.12)
    c.prism(FX, FY - 2.02, 7, 7, 0, 9.5, 'plank', z0=dz, top=False, bias=-0.1)
    c.disc(FX, FY - 2 - dz - 9.5, 3.5, 2.0, 'plank', -0.1, n=np.array([0, 0.2, 1.0]))
    for z in (dz + 2.5, dz + 6.5):
        c.prism(FX, FY - 2.03, 7, 7, 0, 0.9, 'iron', z0=z, top=False, bias=0.1)
    # two arrow slits, one above the other
    for z in (30, 48):
        c.prism(FX, FY - 2.04, 1.8, 1.8, 0, 6, 'iron', z0=z, top=False, bias=-0.65)
    # the side's banners hung under the deck
    c.banner(FX - 9, FY - 2 - 62, 7, 16, notch=3)
    c.banner(FX + 9, FY - 2 - 62, 7, 16, notch=3)
    # the corbels stepping out to carry the deck
    for i in range(7):
        c.prism(FX - 15 + i * 5, FY - 2.06, 2.6, 3.4, 0, 4, 'stoneD', z0=64, top=False, bias=0.06)
    # the deck: a course of stone out to DW, the side's colour painted round it, its floor of planks
    courses(c, FX, FY - 2, DW, DW, D + 6, 5, 'stone', ch=5, nb=6, z0=67, seed=8, quoin=False, jitter=0.03)
    c.prism(FX, FY - 2.07, DW + 0.2, DW + 0.2, 0, 1.4, 'coat', z0=68.5, top=False)
    yd = FY - 2 - ZD
    c.quad(FX - DW / 2 + 1.5, FX + DW / 2 - 1.5, yd - D - 6 + 1.5, yd, np.array([0, -0.8, 0.6]), 'plank', -0.12)
    # the back parapet (seen over the deck)
    for i in range(5):
        c.prism(FX - DW / 2 + 2.5 + i * (DW - 5) / 4, yd - D - 6 + 2.5, 4, 4, 2, 4, 'stone', bias=0.02)
    return c.render()

def deck():
    # the deck's middle, where the turntable stands, px in the body's canvas
    return (FX, FY - 2 - ZD - (D + 6) / 2 + 1)

def front(cols):
    team(cols); c = C(N)
    yd = FY - 2 - ZD
    for i in range(5):   # merlons on the deck's front edge, crenels between
        c.prism(FX - DW / 2 + 2.5 + i * (DW - 5) / 4, yd + 0.5, 5, 5, 2.5, 4.5, 'stone', bias=0.05)
    for s_ in (-1, 1):   # the side merlons
        c.prism(FX + s_ * (DW / 2 - 2.5), yd - 6, 4, 4, 2.5, 4.5, 'stone', bias=0.0)
    return c.render()

# ---- the gun ---------------------------------------------------------------
def pose(draw=1.0, bolt=True, recoil=0.0):
    # parts in gun space: (kind, args, radius, material). draw 1 = string wound back, 0 = loosed
    P = []; s = -recoil
    P.append(('tube', ((0, 0, 0), (0, 0, 5)), 2.6, 'woodD'))          # the post (first: it never tilts)
    P.append(('tube', ((-2.5, 0, 5.4), (3, 0, 5.4)), 1.7, 'iron'))    # the yoke
    P.append(('tube', ((-14 + s, 0, 6.6), (11 + s, 0, 6.6)), 2.0, 'gwood'))   # the stock
    P.append(('tube', ((-12 + s, 0, 8.2), (9 + s, 0, 8.2)), 1.1, 'woodD'))    # the slider
    # the lever folded along the stock's back, raised as it winds the string in
    lift = 0.15 if draw >= 1 else 0.3 + 0.9 * (1 - draw)
    P.append(('tube', ((-13 + s, 0, 8.6), (-13 + s - 6 * math.cos(lift), 0, 8.6 + 6 * math.sin(lift))), 0.7, 'iron'))
    hu = 9 + s
    # the bow: an iron block on the stock's nose, a stirrup under it, two steel limbs bending back
    P.append(('tube', ((hu - 1.2, 0, 7.6), (hu + 1.4, 0, 7.6)), 1.9, 'iron'))
    P.append(('tube', ((hu + 1.6, -1.6, 6.0), (hu + 1.6, 1.6, 6.0)), 0.6, 'iron'))
    back = 1.2 + 5.0 * draw; tips = []
    for v in (-1, 1):
        root = (hu, v * 1.0, 7.6); tip = (hu - back, v * 13.0, 7.6)
        P.append(('stem', (root, (hu + 0.6 - back * 0.25, v * 7.5, 7.6), tip), (1.5, 0.7), 'bow'))
        P.append(('tube', (tip, (tip[0] + 0.9, tip[1] + v * 0.9, tip[2])), 0.6, 'bow'))   # the nock's recurve
        tips.append(tip)
    claw = (hu - 3 - 15 * draw, 0, 8.6)
    P.append(('tube', ((claw[0] - 1, 0, 8.6), (claw[0] + 0.6, 0, 8.6)), 0.8, 'iron'))
    if bolt:
        P += bolt_parts(claw[0] + 0.5, claw[0] + 25.5, 9.4)
    for tip in tips:
        P.append(('line', (tip, claw), 0.4, 'string'))
    return P

def bolt_parts(u0, u1, z):
    # a heavy bolt: ash shaft, a steel head, three vanes in the side's colour
    P = [('tube', ((u0 + 3, 0, z), (u1 - 3.5, 0, z)), 0.65, 'ash')]
    # the head is the read: big and dark, so the tip is never mistaken for the vanes
    P.append(('lens', ((u1 - 6.0, 0, z), (u1 + 1.2, 0, z)), 2.8, 'iron'))
    for v, dz in ((1, 0), (-1, 0), (0, 1)):
        P.append(('lens', ((u0 + 0.5, v * 0.3, z + dz * 0.3), (u0 + 3.6, v * 1.0, z + dz * 1.0)), 1.0, 'coat'))
    return P

def lay(c, parts, pr):
    # project every part, then paint far ones first (a part's depth: its points' mean ground y)
    items = []
    for i, (kind, g, r, mat) in enumerate(parts):
        pts = [pr(x) for x in g]
        items.append((sum(q[1] for q in pts) / len(pts), i, kind, [q[0] for q in pts], r, mat))
    for _, _, kind, g, r, mat in sorted(items, key=lambda x: (x[0], x[1])):
        if kind in ('tube', 'line'): c.tube(g[0], g[1], r, mat=mat)
        elif kind == 'stem': c.stem(g[0], g[1], g[2], r[0], r[1], mat=mat)
        elif kind == 'lens': c.lens(g[0], g[1], r, mat=mat, prof='shard' if mat == 'steel' else 'petal', fold=0.4)

def gun(cols, th, draw=1.0, bolt=True, recoil=0.0):
    team(cols); c = Canvas(GN)
    ct, st = math.cos(th), math.sin(th)
    def pr(p):
        u, v, z = p; gx = u * ct - v * st; gy = u * st + v * ct
        return (GC[0] + gx * GS, GC[1] + gy * GS - z * GS), gy + z * 0.02
    c.dome((GC[0], GC[1] + 0.5), 7 * GS, 3.4 * GS, mat='iron', flat=0.15)   # the turntable (it does not turn)
    lay(c, [(k, g, (r[0] * GS, r[1] * GS) if isinstance(r, tuple) else r * GS, m) for k, g, r, m in pose(draw, bolt, recoil)], pr)
    return c.render()

def bolt(cols, a, n=40):
    team(cols); c = Canvas(n)
    ca, sa = math.cos(a), math.sin(a)
    pr = lambda p: ((n / 2 + p[0] * ca - p[1] * sa, n / 2 + p[0] * sa + p[1] * ca - p[2]), 0)
    lay(c, bolt_parts(-12.5, 12.5, 0), pr)
    return c.render()
