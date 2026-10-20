# The GOLD PUMP painter: the generator, a pump jack on a pad, painted in code
# with the 2D cutout painter (app/media/paint.py) - never typed by hand.
# pump(tier, f) is one 64x64 frame of the stroke: the crank turns, the
# pitman arm rocks the walking beam, the horse head nods, the gold level in
# the barrel bobs and a glint runs down the pipe on the down-stroke. The team paint is the 'team' material; the
# bake (bake.py) swaps it for sentinels and writes the grids.
import os, sys, math, numpy as np
sys.path.insert(0, os.path.normpath(os.path.dirname(os.path.abspath(__file__)) + '/../media'))
from paint import Canvas, ramp, lint, SS

ramp('wood',  ['#3c2a1e', '#6b4a30', '#8a6142', '#a3794f'])
ramp('stone', ['#4a5068', '#666d84', '#8b93a8', '#a8b0c4'])
ramp('iron',  ['#3a4056', '#5c6884', '#8b93a8'])
ramp('gold',  ['#6b4a1e', '#b9884f', '#d8a850', '#f2cc6a', '#fff2c0'])
ramp('dark',  ['#221c2e', '#3a4056'], outline='none')
ramp('rope',  ['#3a4056', '#5c6884'], outline='none')
GLINT = (0xff, 0xf2, 0xc0)

def team(colours): ramp('team', colours)

def box(c, x0, y0, w, top, front, mat, bias=0.0, tt=0.95, ft=0.6):
    # 3/4 box: a top face `top` px deep over a front face `front` px tall
    for (ya, yb, t0, t1) in ((y0, y0 + top, tt, tt - 0.1), (y0 + top, y0 + top + front, ft, ft - 0.25)):
        ys, xs = np.mgrid[int(ya * SS):int(yb * SS), int(x0 * SS):int((x0 + w) * SS)]
        X = (xs + 0.5) / SS; Y = (ys + 0.5) / SS
        f = (Y - ya) / max(yb - ya, 1e-6); side = 0.08 * (1 - 2 * (X - x0) / w)
        c._put(X.ravel(), Y.ravel(), (t0 + (t1 - t0) * f + side + bias).ravel(), mat)

def cyl(c, cx, y0, r, h, mat, bias=0.0, cap=True):
    # upright cylinder: a body with round shading and an elliptic top
    ys, xs = np.mgrid[int(y0 * SS):int((y0 + h) * SS), int((cx - r) * SS):int((cx + r) * SS)]
    X = (xs + 0.5) / SS; Y = (ys + 0.5) / SS; u = (X - cx) / r
    tone = 0.25 + 0.6 * np.clip(np.sqrt(np.clip(1 - u * u, 0, 1)) * 0.8 - u * 0.45, 0, 1) + bias
    c._put(X.ravel(), Y.ravel(), tone.ravel(), mat)
    if cap: c.dome((cx, y0), r, r * 0.45, mat=mat, bias=0.35 + bias, flat=0.2)

def pump(tier=0, f=0, frames=8):
    th = 2 * math.pi * f / frames                 # crank angle
    c = Canvas(64)
    pad = ['wood', 'stone', 'stone'][tier]
    trim = ['iron', 'iron', 'gold'][tier]
    # the pad: the 4x2 tile footprint's ground plate
    box(c, 5, 31, 54, 23, 4, pad, tt=1.0 if tier else 0.95, ft=0.55)
    if tier == 0:
        for x in (14, 23, 32, 41, 50): box(c, x, 31, 1, 23, 4, 'wood', tt=0.55, ft=0.3)   # plank seams
    else:
        box(c, 5, 42.5, 54, 0, 1, 'stone', ft=0.62)                                       # one flag course
        for r, y0 in enumerate((31, 43.5)):
            for x in range(17 + r * 9, 58, 18): box(c, x, y0, 1, 0, 11.5 if r == 0 else 10.5, 'stone', ft=0.62)
        box(c, 5, 54, 54, 0, 1.6, 'team', ft=0.75)                                         # team band
    c.dome((9, 52.5), 3.5, 1.6, mat='snow', flat=0.4)                                      # a drift on the corner
    # crank and gearbox at the back
    ccx, ccy, cr = 15, 38, 5.5
    pin = (ccx + cr * math.cos(th), ccy + cr * math.sin(th))
    # the beam follows the pitman
    px, py, L, R = 33, 13, 17, 19
    a = math.asin(max(-0.9, min(0.9, (pin[1] - 25 - py) / L)))
    bx, by = px - L * math.cos(a), py + L * math.sin(a)     # back end
    hx, hy = px + R * math.cos(a), py - R * math.sin(a)     # head end
    # samson post: far legs first
    c.tube((29, 34), (px - 1, py), 1.4, mat='wood', bias=-0.15)
    c.tube((38, 34), (px + 1, py), 1.4, mat='wood', bias=-0.25)
    box(c, 8.5, 32, 13, 3, 10, 'iron', tt=0.55, ft=0.3)                # gearbox
    box(c, 8.5, 40.5, 13, 0, 1.2, trim if tier else 'iron', ft=0.7)    # its seam
    c.dome((ccx, ccy), 2.2, 2.2, mat=trim, bias=0.1)                    # crank hub
    c.tube((ccx, ccy), pin, 1.4, mat='iron', bias=0.1)                  # crank arm
    c.dome((ccx - (pin[0] - ccx) * 0.9, ccy - (pin[1] - ccy) * 0.9), 4.2, 4.2, mat='iron', bias=-0.2, flat=0.4)  # counterweight
    c.tube(pin, (bx, by), 0.9, mat='wood', bias=0.2)                    # pitman arm
    c.tube((bx, by), (hx, hy), 1.8, mat=trim if tier == 2 else 'iron', bias=0.15)  # walking beam
    c.dome((bx, by), 1.6, 1.6, mat='iron', bias=0.1)                    # equalizer
    c.lens((hx - 2.0, hy - 3.5), (hx + 3.0, hy + 12), 9.0, bend=-0.14, mat='gold' if tier == 2 else 'team', prof='petal', fold=0.45)  # horse head
    rod_x = hx + 4.0
    c.tube((rod_x, hy + 11), (rod_x, 39), 0.55, mat='rope', bias=0.3)  # bridle
    c.tube((rod_x, 39), (rod_x, 44), 0.7, mat='gold', bias=0.4)        # polished rod
    box(c, rod_x - 3.5, 43, 7, 2, 6, trim, tt=0.8, ft=0.5)              # wellhead
    c.dome((rod_x, 47.5), 2.2, 1.6, mat='team', bias=0.1)               # valve wheel
    c.tube((26, 34), (px - 1, py), 1.5, mat='wood', bias=0.2)           # near legs
    c.tube((40, 34), (px + 1, py), 1.5, mat='wood', bias=0.05)
    c.tube((28.5, 26), (38, 26), 0.8, mat='wood', bias=0.1)             # brace
    c.dome((px, py), 2.0, 2.0, mat=trim, bias=0.25)                     # saddle bearing
    if tier >= 1:                                                       # pennant on the post
        c.tube((px, py - 1), (px, 3), 0.4, mat='wood', bias=0.2)
        c.lens((px, 3.5), (px - 7, 5), 3, mat='team', prof='strap', fold=0.2)
    c.tube((rod_x - 3.5, 49), (33, 49), 0.9, mat='iron', bias=0.1)     # the gold run to the barrel
    bw = [4.6, 5.2, 5.6][tier]
    cyl(c, 28, 41 - tier, bw, 10 + tier, 'wood' if tier < 2 else 'gold', bias=-0.1, cap=False)   # barrel
    c.dome((28, 41 - tier), bw, bw * 0.42, mat='dark', flat=0.2)                                    # its mouth
    fill = 0.55 + 0.45 * (0.5 - 0.5 * math.cos(th))                                                 # the gold level bobs as it fills
    c.dome((28, 41 - tier + 0.3), bw * 0.8 * fill, bw * 0.32 * fill, mat='gold', bias=0.35, flat=0.2)
    for y in (44, 48): box(c, 28 - bw, y - tier, 2 * bw, 0, 1, trim if tier < 2 else 'wood', ft=0.45)  # hoops
    if tier == 2:
        for (x, y) in ((15, 51), (19, 52), (17, 50)): c.dome((x, y), 2.0, 1.2, mat='gold', bias=0.2)  # coin heap
    img = c.render()
    if math.sin(th) < 0:   # the glint slides down the pipe on the down-stroke
        gx = int(round(rod_x - 4 - (rod_x - 35) * (-math.sin(th))))
        for dx in (0, 1):
            if img[49, gx + dx, 3]: img[49, gx + dx, :3] = GLINT
    return img

# where the barrel's mouth is, in the 64 px frame, per tier: the payout's coin hops from here
def barrel_mouth(tier): return (28, 41 - tier)

