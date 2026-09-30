"""Robot hero at 64x64: a lean, sharp robot painted as flat-shaded facets on a 3D-jointed puppet.

Same family as the bear and wolf rigs (paint at S x, majority-downsample, band into a palette,
outline per part), but the parts are faceted prisms instead of round capsules, so every plane
gets one crisp tone: that is where the sharp look comes from. Body frame is (fwd, left, up) in
art pixels; the game camera (35 degrees) projects it, and light comes from the top left.
"""
import math
import numpy as np
from PIL import Image, ImageDraw

S = 6
W, H = 64, 64
OX, OY = 32, 58
ELEV = math.radians(35)
SE, CE = math.sin(ELEV), math.cos(ELEV)
LIGHT = np.array([-0.5, -0.55, 0.67]); LIGHT = LIGHT / np.linalg.norm(LIGHT)

TEAMS = {
    'red':  dict(TL='#e8876a', TM='#c9524e', TD='#96393f', TX='#6e2a36'),
    'blue': dict(TL='#78a8e4', TM='#3f6fb0', TD='#2b4d7d', TX='#1f3558'),
}
BASE = {
    'OUT': '#221a30',
    'M1': '#eef2f8', 'M2': '#c3cad6', 'M3': '#949cae', 'M4': '#666e82',   # steel, light to dark
    'J1': '#4a5264', 'J2': '#323846',                                      # joints and frame
    'GL': '#161a26', 'E1': '#fff4c2', 'E2': '#ffc94a', 'E3': '#e08a2a',   # visor glass, lamp eyes
    'SN': '#f4f8ff', 'SD': '#c9d6ea',                                      # snow spray (GIF only)
}
STEEL, TEAM, JOINT, GLASS, EYE = range(5)
RAMP = {STEEL: ['M1', 'M2', 'M3', 'M4'], TEAM: ['TL', 'TM', 'TD', 'TX'], JOINT: ['J1', 'J1', 'J2', 'J2'],
        GLASS: ['GL'] * 4, EYE: ['E1', 'E2', 'E2', 'E3']}
CUTS = {STEEL: (0.95, 0.35, 0.0), TEAM: (0.7, 0.25, -0.1), JOINT: (0.9, 0.3, 0.3), GLASS: (9, 9, 9), EYE: (0.8, 0.3, -1)}   # light above a cut picks the brighter tone


def palette(team):
    p = dict(BASE); p.update(TEAMS[team]); return p


def tone(mat, lam):
    r = RAMP[mat]
    for i, c in enumerate(CUTS[mat]):
        if lam > c:
            return r[i]
    return r[3]


def v3(*a):
    return np.array(a, float)


def rot(axis, ang):
    """rotation matrix about a body axis ('x' fwd, 'y' left, 'z' up)"""
    c, s = math.cos(ang), math.sin(ang)
    if axis == 'x': return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'y': return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


class Cam:
    """heading in degrees: 0 = screen right (E), 90 = toward the viewer (S)"""
    def __init__(self, heading, sc=1.0):
        a = math.radians(heading)
        self.f = np.array((math.cos(a), math.sin(a))); self.l = np.array((math.sin(a), -math.cos(a))); self.sc = sc

    def p(self, v):
        g = self.f * v[0] + self.l * v[1]
        return np.array((OX + self.sc * g[0], OY + self.sc * (g[1] * SE - v[2] * CE), self.sc * (g[1] * CE + v[2] * SE)))

    def n(self, d):
        """a body-frame direction in screen space (x right, y down, z toward the viewer)"""
        g = self.f * d[0] + self.l * d[1]
        v = np.array((g[0], g[1] * SE - d[2] * CE, g[1] * CE + d[2] * SE))
        return v / (np.linalg.norm(v) + 1e-9)


class Canvas:
    def __init__(self):
        self.h, self.w = H * S, W * S
        self.depth = np.full((self.h, self.w), -1e9)
        self.group = np.zeros((self.h, self.w), np.int16)
        self.shade = np.zeros((self.h, self.w))
        self.mat = np.zeros((self.h, self.w), np.int8)
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        self.xx = (xx + 0.5) / S; self.yy = (yy + 0.5) / S

    def poly(self, pts, g, mat, lam, bias=0.0, plane=True):
        """flat polygon of projected points; depth follows the polygon's plane so crossing parts sort right"""
        img = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(img).polygon([(p[0] * S, p[1] * S) for p in pts], fill=1)
        m = np.asarray(img).astype(bool)
        if not m.any():
            return
        P = np.array(pts)
        if plane and len(P) >= 3:
            A = np.c_[P[:, 0], P[:, 1], np.ones(len(P))]
            coef, *_ = np.linalg.lstsq(A, P[:, 2], rcond=None)
            d = coef[0] * self.xx + coef[1] * self.yy + coef[2] + bias
        else:
            d = np.full(m.shape, P[:, 2].mean() + bias)
        win = m & (d > self.depth)
        self.depth[win] = d[win]; self.group[win] = g; self.shade[win] = lam; self.mat[win] = mat

    def ball(self, c, r, g, mat, bias=0.0):
        """a round joint; banded like a sphere"""
        x0 = int(max(0, (c[0] - r - 1) * S)); x1 = int(min(self.w, (c[0] + r + 1) * S))
        y0 = int(max(0, (c[1] - r - 1) * S)); y1 = int(min(self.h, (c[1] + r + 1) * S))
        X = self.xx[y0:y1, x0:x1]; Y = self.yy[y0:y1, x0:x1]
        ox, oy = (X - c[0]) / r, (Y - c[1]) / r; m = ox * ox + oy * oy < 1
        nz = np.sqrt(np.clip(1 - ox * ox - oy * oy, 0, 1))
        lam = ox * LIGHT[0] + oy * LIGHT[1] + nz * LIGHT[2]; d = c[2] + nz * r + bias
        sub = (slice(y0, y1), slice(x0, x1)); win = m & (d > self.depth[sub])
        self.depth[sub][win] = d[win]; self.group[sub][win] = g; self.shade[sub][win] = lam[win]; self.mat[sub][win] = mat


def ring_pts(c, rx, ry, n, rot0, M=np.eye(3)):
    return [c + M @ v3(rx * math.cos(rot0 + 2 * math.pi * i / n), ry * math.sin(rot0 + 2 * math.pi * i / n), 0) for i in range(n)]


def prism(cv, cam, bot, top, g, mat, bias=0.0, cull=True):
    """faceted solid between two same-sized rings of body-frame points (bottom and top). Each side
    face and the top cap is one flat plane with one light value: crisp, hand-pixelled looking tones"""
    n = len(bot); P = cam.p
    ctr = (sum(bot) + sum(top)) / (2 * n)
    faces = [[bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i]] for i in range(n)]
    faces.append(list(top)); faces.append(list(reversed(bot)))
    for f in faces:
        c = sum(f) / len(f)
        nrm = np.cross(f[1] - f[0], f[2] - f[0]) if len(f) > 3 else np.cross(f[1] - f[0], f[2] - f[1])
        if np.linalg.norm(nrm) < 1e-9:
            nrm = np.cross(f[2] - f[1], f[3] - f[1])
        nrm = nrm / (np.linalg.norm(nrm) + 1e-9)
        if nrm.dot(c - ctr) < 0: nrm = -nrm
        ns = cam.n(nrm)
        if cull and ns[2] < -0.02:
            continue
        cv.poly([P(p) for p in f], g, mat, float(ns.dot(LIGHT)), bias)


def limb(cv, cam, a, b, ra, rb, g, mat, sides=6, twist=0.0, bias=0.0):
    """a tapered faceted limb from a to b (body frame)"""
    ax = b - a; L = np.linalg.norm(ax); z = ax / (L + 1e-9)
    x = np.cross(z, v3(0, 0, 1)) if abs(z[2]) < 0.95 else np.cross(z, v3(1, 0, 0)); x /= np.linalg.norm(x); y = np.cross(z, x)
    M = np.c_[x, y, z]
    bot = [a + M @ v3(ra * math.cos(twist + 2 * math.pi * i / sides), ra * math.sin(twist + 2 * math.pi * i / sides), 0) for i in range(sides)]
    top = [b + M @ v3(rb * math.cos(twist + 2 * math.pi * i / sides), rb * math.sin(twist + 2 * math.pi * i / sides), 0) for i in range(sides)]
    prism(cv, cam, bot, top, g, mat, bias)


def ik(root, target, l1, l2, pole):
    n = target - root; d = min(l1 + l2 - 1e-3, max(abs(l1 - l2) + 1e-3, np.linalg.norm(n))); n = n / np.linalg.norm(n)
    p = pole - n * pole.dot(n); p = p / (np.linalg.norm(p) + 1e-9)
    x = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h = math.sqrt(max(0.0, l1 * l1 - x * x))
    return root + n * x + p * h, root + n * d


# ------ skeleton (art pixels at size 1)
LEG = (12.0, 12.2)
ARM = (10.0, 10.2)
HIP_Z, HIP_Y = 27.0, 3.4
SHOULDER = (0.0, 9.6, 43.6)
HEAD_C = 52.8                     # head centre height
# head footprint: an octagon with a wide flat front for the visor (fwd, left)
HEAD_OCT = [(6.2, 5.2), (3.4, 8.0), (-3.8, 8.0), (-6.2, 5.0), (-6.2, -5.0), (-3.8, -8.0), (3.4, -8.0), (6.2, -5.2)]
HEAD_H = 10.4
HEAD_S = 0.84                     # head scale: heroic, not a bobblehead


def act_idle(t):
    ph = t * 2 * math.pi
    br = (1 - math.cos(ph)) / 2
    sway = 0.9 * math.sin(ph)                               # weight rolls from foot to foot
    return dict(drop=0.3 * br, lean=0.0, sway=sway, yaw=0, head=(0.12 * math.sin(ph - 0.8), 0.07 * math.sin(ph), 0.0),
                eyes='blink' if 0.46 < t < 0.54 else 'calm',
                feet={1: v3(0.8, 5.4, 0), -1: v3(-0.6, -5.4, 0)},
                hands={1: v3(-1.0, 8.8, 27.5 + br * 0.4),                      # fist on the hip: a bit of swagger
                       -1: v3(1.4 + 0.4 * math.sin(ph), -11.4, 22.5 + br * 0.5)},
                poles={1: v3(-0.4, 1, 0.1), -1: v3(-1, -0.3, 0)}, wind=v3(-0.35, 0.25 * math.sin(ph), 0), flap=0.4)


def act_run(t):
    ph = t * 2 * math.pi
    out = dict(drop=1.2 - 1.8 * abs(math.cos(ph)), lean=0.24, sway=0.0, yaw=0, head=(0.0, 0.0, -0.1), eyes='focus',
               feet={}, hands={}, poles={1: v3(-1, 0.3, -0.5), -1: v3(-1, -0.3, -0.5)}, wind=v3(-2.2, 0, 0.35), flap=1.0)
    for s in (1, -1):
        q = ph + (0 if s > 0 else math.pi)
        out['feet'][s] = v3(8.5 * math.sin(q), 3.6 * s, 6.5 * max(0.0, math.cos(q)) ** 1.6)
        sw = -math.sin(q)
        out['hands'][s] = v3(1.5 + 8.0 * sw, 8.4 * s, 32 + 6.0 * max(0.0, sw) + 2.0 * max(0.0, -sw))
    return out


def act_slide(t):
    ph = t * 2 * math.pi
    sw = 0.8 * math.sin(ph)
    return dict(drop=5.5 + 0.4 * math.sin(2 * ph), lean=0.18, sway=0.0, yaw=90, head=(0.95, 0.0, 0.05), eyes='happy',
                feet={1: v3(1.0, 9.6, 0), -1: v3(-0.6, -9.0, 0)},
                hands={1: v3(4.0, 20.5 + sw, 40 + sw), -1: v3(-3.0, -20.0 + sw, 37.5 - sw)},
                poles={1: v3(-0.4, 0.3, -1), -1: v3(-0.4, -0.3, -1)}, wind=v3(0, -2.4, 0.3), flap=1.0)


ACTS = {'idle': act_idle, 'run': act_run, 'slide': act_slide}


def pose(act, t):
    a = ACTS[act](t)
    hip_c = v3(0, a['sway'] * 0.5, HIP_Z - a['drop'])
    R = rot('y', a['lean'])                                 # lean pitches the upper body about the hips
    U = lambda v: hip_c + R @ (v - v3(0, 0, HIP_Z))        # upper body points (authored at rest)
    j = dict(a=a, U=U, R=R, hip_c=hip_c, legs={}, arms={})
    for s in (1, -1):
        hip = hip_c + v3(0, HIP_Y * s, -1.0)
        foot = a['feet'][s]
        ankle_t = foot + v3(-0.6, 0, 3.2)
        knee, ankle = ik(hip, ankle_t, *LEG, pole=v3(1, 0.12 * s, 0))
        j['legs'][s] = (hip, knee, ankle, foot)
        sh = U(v3(SHOULDER[0], SHOULDER[1] * s, SHOULDER[2]))
        hand_t = a['hands'][s]
        hand_t = hip_c + R @ (hand_t - v3(0, 0, HIP_Z))     # hands ride the lean too
        el, hand = ik(sh, hand_t, *ARM, pole=R @ a['poles'][s])
        j['arms'][s] = (sh, el, hand)
    hy, hr, hp = a['head']
    j['Rh'] = R @ rot('z', hy) @ rot('x', hr) @ rot('y', hp)
    j['head_c'] = U(v3(0, 0, HEAD_C))
    return j


EYES = {
    'calm':  lambda s: [[(s * 1.3, 1.6), (s * 3.5, 1.6), (s * 3.5, -1.6), (s * 1.3, -1.6)]],
    'blink': lambda s: [[(s * 1.2, -0.2), (s * 3.6, -0.2), (s * 3.6, -1.0), (s * 1.2, -1.0)]],
    'focus': lambda s: [[(s * 1.2, -0.2), (s * 3.9, 2.0), (s * 3.9, -1.5), (s * 1.2, -1.5)]],
    'happy': lambda s: [[(s * 0.9, -1.6), (s * 2.4, 2.0), (s * 3.9, -1.6), (s * 2.8, -1.6), (s * 2.4, -0.5), (s * 2.0, -1.6)]],
}


def paint(j, cam):
    cv = Canvas(); P = cam.p; a = j['a']; U = j['U']; R = j['R']
    G_BODY, G_HEAD, G_ARM_L, G_ARM_R, G_LEG_L, G_LEG_R, G_SCARF, G_NECK = range(1, 9)
    # legs: slim thigh, knee joint, armoured shin, pointed boot
    for s, g in ((1, G_LEG_L), (-1, G_LEG_R)):
        hip, knee, ankle, foot = j['legs'][s]
        limb(cv, cam, hip, knee, 2.3, 1.8, g, JOINT)
        limb(cv, cam, knee, ankle, 2.6, 1.7, g, STEEL, sides=5, twist=math.pi / 2)
        cv.ball(P(knee), 2.4 * cam.sc, g, STEEL, bias=1.2)
        fw = v3(1, 0.12 * s, 0); fw /= np.linalg.norm(fw); sd = np.cross(v3(0, 0, 1), fw)
        base = foot + v3(0, 0, 0.2)
        sole = [base + fw * -2.8 + sd * 2.0, base + fw * 3.0 + sd * 2.2, base + fw * 7.0, base + fw * 3.0 - sd * 2.2, base + fw * -2.8 - sd * 2.0]
        top = [p + v3(0, 0, 3.0) - fw * (0.0 if i != 2 else 2.4) for i, p in enumerate(sole)]
        prism(cv, cam, sole, top, g, STEEL)
    # pelvis, thin waist, V chest
    hc = j['hip_c']
    prism(cv, cam, ring_pts(hc + v3(0, 0, -2.6), 3.2, 4.6, 6, math.pi / 6), ring_pts(hc + v3(0, 0, 1.6), 3.6, 5.2, 6, math.pi / 6), G_BODY, JOINT)
    limb(cv, cam, U(v3(0, 0, HIP_Z + 1)), U(v3(0, 0, HIP_Z + 6.5)), 2.3, 2.3, G_BODY, JOINT)
    chest_b = [U(v3(x * 0.7, y * 0.52, 31.5)) for x, y in [(4.2, 3.0), (2.2, 5.0), (-2.6, 5.0), (-4.0, 3.0), (-4.0, -3.0), (-2.6, -5.0), (2.2, -5.0), (4.2, -3.0)]]
    chest_t = [U(v3(x, y, 45.0)) for x, y in [(6.0, 4.0), (3.4, 9.0), (-3.8, 8.8), (-5.6, 4.0), (-5.6, -4.0), (-3.8, -8.8), (3.4, -9.0), (6.0, -4.0)]]
    prism(cv, cam, chest_b, chest_t, G_BODY, TEAM)
    # chest core: a steel plate on the sternum
    core = [U(v3(5.4, y, z)) for y, z in [(0, 40.4), (1.3, 38.6), (0, 36.8), (-1.3, 38.6)]]
    if cam.n(R @ v3(1, 0, 0.1))[2] > 0.05:                  # a small steel badge on the sternum
        cv.poly([P(p) for p in core], G_BODY, STEEL, 0.5, bias=0.6)
    # neck and scarf
    limb(cv, cam, U(v3(0, 0, 44.5)), U(v3(0, 0, 49.0)), 1.6, 1.4, G_NECK, JOINT)
    prism(cv, cam, ring_pts(U(v3(0, 0, 44.4)), 4.2, 4.8, 8, math.pi / 8, R), ring_pts(U(v3(0, 0, 47.4)), 3.4, 4.0, 8, math.pi / 8, R), G_SCARF, TEAM)
    wind = a['wind']; pts = [U(v3(-3.8, -1.0, 46.0))]
    for i in range(6):
        k = (i + 1) / 6
        d = wind * (0.6 + 0.4 * k) + v3(0, 0, -1.0 * (1 - 0.6 * min(1, np.linalg.norm(wind) / 2)))
        d = d + v3(0, 0.35 * math.sin(i * 1.3 + a['flap'] * 3 + a.get('drop', 0)), 0.3 * math.cos(i * 1.7)) * a['flap']
        d = d / (np.linalg.norm(d) + 1e-9)
        pts.append(pts[-1] + d * 3.4)
    for i in range(len(pts) - 1):                          # tail: a flat, tapering diamond section, twisting as it goes
        limb(cv, cam, pts[i], pts[i + 1], 1.9 - 0.18 * i, 1.9 - 0.18 * (i + 1), G_SCARF, TEAM, sides=4, twist=0.5 * i + a['flap'])
    # head: octagonal prism, lighter top, visor band and lamp eyes on the flat front
    Rh = j['Rh']; hc3 = j['head_c']
    hp = lambda v: hc3 + Rh @ (v * HEAD_S)
    bot = [hp(v3(x, y, -HEAD_H / 2)) for x, y in HEAD_OCT]
    top = [hp(v3(x * 0.9, y * 0.92, HEAD_H / 2)) for x, y in HEAD_OCT]
    prism(cv, cam, bot, top, G_HEAD, STEEL)
    fnorm = cam.n(Rh @ v3(1, 0, 0))
    if fnorm[2] > 0.0:
        fx = 6.25
        vis = [hp(v3(fx, u, v)) for u, v in [(-4.9, 2.6), (4.9, 2.6), (4.9, -2.4), (-4.9, -2.4)]]
        cv.poly([P(p) for p in vis], G_HEAD, GLASS, 0.0, bias=0.3)
        for s in (1, -1):
            for shape in EYES[a['eyes']](s):
                cv.poly([P(hp(v3(fx, u, v + 0.3))) for u, v in shape], G_HEAD, EYE, 0.5, bias=0.6)
            if a['eyes'] == 'calm':
                cv.poly([P(hp(v3(fx, s * u, v + 0.3))) for u, v in [(1.6, 1.3), (2.5, 1.3), (2.5, 0.3), (1.6, 0.3)]], G_HEAD, EYE, 0.95, bias=0.8)
    for s in (1, -1):                                      # visor wraps onto the front corner facets
        n_d = cam.n(Rh @ v3(0.72, 0.7 * s, 0))
        if n_d[2] > 0.0:
            wrap = [hp(v3(x, s * y, v)) for x, y, v in [(6.2, 5.2, 2.6), (4.6, 6.8, 2.4), (4.6, 6.8, -2.2), (6.2, 5.2, -2.4)]]
            cv.poly([P(p) for p in wrap], G_HEAD, GLASS, 0.0, bias=0.3)
            if fnorm[2] < 0.45:                             # side-on: one lamp shows on the corner
                eye = [hp(v3(x, s * y, v)) for x, y, v in [(5.9, 5.5, 1.7), (5.1, 6.3, 1.6), (5.1, 6.3, -1.2), (5.9, 5.5, -1.2)]]
                cv.poly([P(p) for p in eye], G_HEAD, EYE, 0.5 if a['eyes'] != 'blink' else 0.0, bias=0.6)
    # arms: angular pauldron, dark upper arm, steel gauntlet, fist
    for s, g in ((1, G_ARM_L), (-1, G_ARM_R)):
        sh, el, hand = j['arms'][s]
        out = R @ v3(0, s, 0)
        pb = ring_pts(sh + out * 0.4 + R @ v3(0, 0, -1.6), 3.4, 3.0, 6, 0.0, R); pt = ring_pts(sh + out * 0.8 + R @ v3(0, 0, 1.8), 2.4, 2.4, 6, 0.0, R)
        prism(cv, cam, pb, pt, g, STEEL, bias=0.3)
        limb(cv, cam, sh, el, 1.7, 1.4, g, JOINT)
        cv.ball(P(el), 1.8 * cam.sc, g, JOINT, bias=0.2)
        limb(cv, cam, el + (hand - el) * 0.08, hand, 2.6, 1.9, g, STEEL, sides=5, twist=math.pi / 2, bias=0.2)
        cv.ball(P(hand), 2.1 * cam.sc, g, JOINT, bias=0.5)
    return cv


SOFT = {frozenset((2, 8)), frozenset((1, 8)), frozenset((7, 8))}


def to_pixels(cv, line_gap=1.6):
    h, w = H, W
    blk = lambda a: a.reshape(h, S, w, S).transpose(0, 2, 1, 3).reshape(h, w, S * S)
    grp = blk(cv.group); dep = blk(cv.depth); sh = blk(cv.shade); mt = blk(cv.mat)
    filled = (grp > 0).sum(2) > (S * S) * 0.42
    G = np.zeros((h, w), np.int16); D = np.full((h, w), -1e9)
    res = np.empty((h, w), object); res[:] = None
    for y, x in zip(*np.nonzero(filled)):
        g = grp[y, x]; sel = g > 0
        vals, cnt = np.unique(g[sel], return_counts=True)
        gg = vals[np.argmax(cnt + 0.01 * np.array([dep[y, x][g == v].mean() for v in vals]))]
        s2 = g == gg
        mv, mc = np.unique(mt[y, x][s2], return_counts=True)
        # small bright parts (eyes) win their pixel if they cover a fair share of it
        m = EYE if (EYE in mv and mc[list(mv).index(EYE)] >= S * S * 0.25) else mv[np.argmax(mc)]
        G[y, x] = gg; D[y, x] = dep[y, x][s2].mean()
        res[y, x] = tone(m, float(np.median(sh[y, x][s2 & (mt[y, x] == m)])))
    out = res.copy()
    for y, x in zip(*np.nonzero(G)):
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            yy, xx = y + dy, x + dx
            if not (0 <= yy < h and 0 <= xx < w) or not G[yy, xx]:
                out[y, x] = 'OUT'; break
            if G[yy, xx] != G[y, x] and D[yy, xx] > D[y, x] + line_gap and frozenset((G[y, x], G[yy, xx])) not in SOFT:
                out[y, x] = 'OUT'
    for _ in range(2):
        f = np.vectorize(lambda c: c is not None)(out)
        nb = np.zeros(f.shape, int); nb[1:] += f[:-1]; nb[:-1] += f[1:]; nb[:, 1:] += f[:, :-1]; nb[:, :-1] += f[:, 1:]
        out[f & (nb <= 1)] = None
    return out, G


FACINGS = [('S', 90), ('SE', 45), ('E', 0), ('NE', -45), ('N', -90), ('NW', -135), ('W', 180), ('SW', 135)]


def render(heading, act='idle', t=0.0, sc=1.0, eyes=None):
    j = pose(act, t)
    if eyes: j['a']['eyes'] = eyes
    return to_pixels(paint(j, Cam(heading + j['a']['yaw'], sc)))


def rgba(res, team, scale=1):
    pal = palette(team); h, w = res.shape
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); px = img.load()
    for y in range(h):
        for x in range(w):
            c = res[y, x]
            if c is not None:
                v = pal[c]; px[x, y] = (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16), 255)
    return img.resize((w * scale, h * scale), Image.NEAREST) if scale > 1 else img
