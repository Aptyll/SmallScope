# Brown bear puppet: part layout fitted to the reference, poses for walk and attack.
import math
from rig import E, seg

HIPS = {  # hip in body frame (crop coords at rest), rest foot, lengths, knee bend, layer, material
    'FF': dict(hip=(8.5, 15.0), foot=(6.5, 23.0), L=(4.5, 4.2), bend=-1, layer=0.2, mat='far', r=(2.6, 2.0)),
    'FH': dict(hip=(24.5, 15.0), foot=(24.5, 23.0), L=(4.5, 4.2), bend=1, layer=0.3, mat='far', r=(2.8, 2.0)),
    'NF': dict(hip=(16.5, 14.0), foot=(16.5, 23.0), L=(5.0, 4.6), bend=-1, layer=2.2, mat='fur', r=(3.0, 2.2)),
    'NH': dict(hip=(30.0, 14.0), foot=(31.5, 23.0), L=(5.0, 4.6), bend=1, layer=2.1, mat='fur', r=(3.2, 2.1)),
}

def ik(hx, hy, fx, fy, L1, L2, bend):
    dx, dy = fx - hx, fy - hy
    d = max(1e-3, min(math.hypot(dx, dy), L1 + L2 - 1e-3))
    a = math.atan2(dy, dx)
    c = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)
    t = math.acos(max(-1, min(1, c)))
    ka = a + bend * t
    return hx + L1 * math.cos(ka), hy + L1 * math.sin(ka)

def rot(px, py, cx, cy, ang):
    c, s = math.cos(ang), math.sin(ang)
    return cx + (px - cx) * c - (py - cy) * s, cy + (px - cx) * s + (py - cy) * c

def pix(rows, col='BN'):
    """sticker pixels from a little text grid, '#' = bone, 's' = bone shade"""
    return [(x, y, col if c == '#' else 'BS') for y, r in enumerate(rows) for x, c in enumerate(r) if c in '#s']

ANTLER_L = pix(['.#..', '..##', '.##.', '##..', '.#..', '.##.', '..ss'])   # measured off the reference
ANTLER_R = pix(['.#..', '.###', '..#.', '..#.', '..##', '..#.', '##..'])
RUNE = pix(['.##.', '#..#', '#..#', '.##.'])

def pose(P=None, dark=False):
    P = dict(P or {})
    bx, by = P.get('bx', 0.0), P.get('by', 0.0)          # body offset
    tilt = P.get('tilt', 0.0)                             # body pitch around (20,13)
    hump = P.get('hump', 0.0)                             # shoulder rise
    hx, hy, ha = P.get('hx', 0.0), P.get('hy', 0.0), P.get('ha', 0.0)
    jaw = P.get('jaw', 0.0)
    feet = P.get('feet', {})
    pr = []
    def B(x, y):  # body-frame point to world
        x, y = rot(x, y, 20, 13, tilt)
        return x + bx, y + by
    # torso: shoulder hump, middle, rump, belly, chest
    for (x, y, rx, ry, a, sd, lay, lf) in [
        (15.0, 9.8 - hump, 6.6, 6.6, -0.3, 1, 1.00, 0.05),
        (21.5, 11.3, 7.0, 6.5, 0.1, 2, 0.97, -0.12),
        (27.0, 12.3, 5.8, 6.0, 0.10, 3, 1.02, 0.05),
        (19.5, 15.2, 9.0, 3.8, 0.0, 4, 0.96, -0.1),
        (10.8, 12.0 - hump * 0.5, 5.0, 5.8, 0.7, 5, 0.99, 0.0),
    ]:
        wx, wy = B(x, y)
        pr.append(E(wx, wy, rx, ry, a + tilt, 'fur', lay, seed=sd, lift=lf))
    # legs
    for k, L in HIPS.items():
        hxw, hyw = B(*L['hip'])
        fx, fy = feet.get(k, L['foot'])
        if k == 'NF' and P.get('paw_front'):   # swiping paw passes in front of the face
            L = dict(L, layer=3.2)
        kx, ky = ik(hxw, hyw, fx, fy - 0.8, L['L'][0], L['L'][1], L['bend'])
        pr += seg(hxw, hyw, kx, ky, L['r'][0], L['r'][1] + 0.3, L['mat'], L['layer'], seed=10 + len(pr))
        pr += seg(kx, ky, fx, fy - 0.8, L['r'][1] + 0.2, L['r'][1], L['mat'], L['layer'] + 0.01, seed=20 + len(pr), n=2)
        pr.append(E(fx - 0.7, fy - 0.2, 2.4, 1.1, 0, L['mat'], L['layer'] + 0.02, fur=0.3, seed=30))
        if L['mat'] == 'fur':
            for q in pr[-6:-1]: q['lift'] = 0.25
    # head: pivot at neck (11,13) in body frame
    nx, ny = B(11.0, 13.0)
    def Hd(x, y):  # head-frame point (crop coords at rest) to world
        x, y = rot(x, y, 11.0, 13.0, ha)
        return x - 11.0 + nx + hx, y - 13.0 + ny + hy
    def add(x, y, rx, ry, mat, lay, a=0.0, fur=1.0, sd=40, lift=0.0):
        wx, wy = Hd(x, y); pr.append(E(wx, wy, rx, ry, a + ha, mat, lay, fur=fur, seed=sd, lift=lift))
    add(7.0, 14.6, 4.2, 4.4, 'fur', 3.0, sd=41, lift=0.3)
    add(6.8, 12.8, 3.6, 2.2, 'fur', 3.01, sd=45, lift=0.25)   # brow
    add(6.8, 14.5, 3.2, 1.5, 'fur', 3.02, fur=0.5, sd=46, lift=0.45)   # face plane around the eyes
    if not dark:
        add(3.9, 11.4, 1.2, 1.1, 'ear', 2.95, fur=0)
        add(9.6, 11.4, 1.2, 1.1, 'ear', 2.95, fur=0)
    else:
        for (x, y, px) in ((2.0, 6.0, ANTLER_L), (10.0, 6.0, ANTLER_R)):
            wx, wy = Hd(x, y); pr.append(dict(E(wx, wy, 1, 1, mat='sticker', layer=9), px=px))
        for (x, y) in ((16.0, 8.0), (24.0, 8.0)):
            wx, wy = B(x, y); pr.append(dict(E(wx, wy, 1, 1, mat='sticker', layer=9), px=RUNE, on_body=True))
    if jaw > 0:   # open mouth: dark gap, lower jaw swings down, a tooth
        add(6.0, 17.6 + jaw * 0.6, 2.4, 0.6 + jaw * 0.6, 'mouth', 3.05, fur=0)
        add(6.3, 17.8 + jaw * 1.4, 2.4, 1.1, 'muz', 3.06, a=0.2 * jaw, fur=0.2, sd=44)
        add(5.2, 17.4, 0.5, 0.5 + jaw * 0.3, 'tooth', 3.07, fur=0)
    add(6.0, 17.2, 2.2, 1.6, 'muz', 3.04, fur=0.2, sd=42, lift=0.3)
    add(4.6, 15.4, 0.55, 0.55, 'eye', 3.1, fur=0)
    add(8.6, 15.4, 0.55, 0.55, 'eye', 3.1, fur=0)
    return pr
