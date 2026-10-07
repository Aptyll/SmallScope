# The player as a jointed doll: soft parts posed in 3D, seen through the game's camera,
# rasterised at S x, shrunk to the game's pixel and banded into the class palette's
# letters (js/sprites/characters.js), so the frames bake through the same team and look
# palettes as every hand-drawn pose.
#
# A part is a superellipsoid (exponent 2 is an ellipsoid; a higher one is boxier, which is
# how the hand-drawn head's rounded square is kept) in its own frame, so a region of its
# surface can wear another material: the face is the front of the head. Single pixels that
# must land exactly - eyes, blush, goggle lenses - are stickers, placed where they sit on
# today's front frame and carried by the part they belong to (decal).
#
# Body frame is (fwd, left, up) in art px; the feet stand on z 0 under the canvas point
# (OX, OY). The camera looks down at ELEV, under a light that comes mostly from the viewer,
# so a round part's highlight runs down its middle the way the hand-drawn art's does.
import math
import numpy as np

S = 8                       # subpixels per art pixel
W, H = 24, 24               # the work canvas; the bake crops every frame to one shared box
OX, OY = 12.0, 21.0         # canvas point under the body's root: x 12 is the 16 px cell's x 8
ELEV = math.radians(20)
SE, CE = math.sin(ELEV), math.cos(ELEV)
LIGHT = np.array([-0.12, -0.30, 0.95]); LIGHT = LIGHT / np.linalg.norm(LIGHT)
GROUND = int(OY) - 1        # the last row above the snow: where the soles stand


def Z(h):
    """a height authored as it reads on screen, in true body px"""
    return h / CE


def v3(*a):
    return np.array(a, float)


def rot(axis, ang):
    c, s = math.cos(ang), math.sin(ang)
    if axis == 'x': return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'y': return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def ik(root, target, l1, l2, pole):
    """two-bone limb: the middle joint and the reached end, bending toward pole"""
    n = target - root
    d = min(l1 + l2 - 1e-3, max(abs(l1 - l2) + 1e-3, np.linalg.norm(n))); n = n / (np.linalg.norm(n) + 1e-9)
    p = pole - n * pole.dot(n); p = p / (np.linalg.norm(p) + 1e-9)
    x = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h = math.sqrt(max(0.0, l1 * l1 - x * x))
    return root + n * x + p * h, root + n * d


class Cam:
    """the game's camera turned to a facing: heading 0 faces screen right, 90 the viewer,
    -90 away. Camera space is x right, y down, z toward the viewer."""
    def __init__(self, heading, elev=ELEV):
        a = math.radians(heading)
        f = (math.cos(a), math.sin(a)); l = (math.sin(a), -math.cos(a))
        s, c = math.sin(elev), math.cos(elev)
        self.R = np.array([[f[0], l[0], 0], [f[1] * s, l[1] * s, -c], [f[1] * c, l[1] * c, s]])

    def p(self, v):
        q = self.R @ v
        return np.array((OX + q[0], OY + q[1], q[2]))


class Spun(Cam):
    """the same camera on a body turned by M about pivot and moved by off: the roll is the
    whole tucked doll pitched over about its centre while the light stays where it was"""
    def __init__(self, cam, M, pivot, off=None):
        self.cam, self.M, self.pivot = cam, M, pivot
        self.off = off if off is not None else np.zeros(3)
        self.R = cam.R @ M

    def p(self, v):
        return self.cam.p(self.pivot + self.M @ (v - self.pivot) + self.off)


# materials: a letter ramp dark..light, and the two cuts on the light value between them
RAMP = {
    'hem': ('d', 'd', 'd'), 'coat': ('d', 'r', 'R'), 'hat': ('t', 't', 'T'), 'trim': ('M', 'm', 'm'),
    'skin': ('K', 'k', 'k'), 'pants': ('p', 'p', 'p'), 'boot': ('B', 'b', 'b'),
    'goggle': ('g', 'G', 'G'), 'blade': ('S', 'S', 'S'),
}
CUTS = {
    'hem': (9, 9), 'coat': (0.3, 0.9), 'hat': (0.0, 0.86), 'trim': (0.30, 2), 'skin': (0.12, 2),
    'pants': (9, 9), 'boot': (0.30, 2), 'goggle': (0.55, 2), 'blade': (9, 9),
}
MATS = list(RAMP)
# a limb on the far side of a side-on body wears the next tone down (its pants stay pants:
# ink would melt it into the coat's outline)
DARKER = {'R': 'r', 'r': 'd', 'd': 'd', 'm': 'M', 'M': 'M', 'b': 'B', 'T': 't', 'k': 'K'}


def band(mat, lam):
    r = RAMP[mat]; c1, c2 = CUTS[mat]
    return r[0] if lam < c1 else r[1] if lam < c2 else r[2]


class Canvas:
    def __init__(self):
        self.h, self.w = H * S, W * S
        self.depth = np.full((self.h, self.w), -1e9)
        self.part = np.zeros((self.h, self.w), np.int16)
        self.lam = np.zeros((self.h, self.w))
        self.mat = np.zeros((self.h, self.w), np.int16)
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        self.xx = (xx + 0.5) / S; self.yy = (yy + 0.5) / S
        self.parts = {}          # name -> id
        self.pinfo = {}          # id -> name
        self.stickers = []

    def pid(self, name):
        if name not in self.parts:
            i = len(self.parts) + 1; self.parts[name] = i; self.pinfo[i] = name
        return self.parts[name]

    def blob(self, cam, c, Rp, radii, part, mat, p=2.0, bias=0.0, region=None):
        """a superellipsoid: centre c and frame Rp in the body frame, semi-axes radii along
        Rp's columns, exponent p. region(n, q) -> a material per hit, from the normal n in
        the part's frame and the point q in its unit coordinates"""
        radii = np.asarray(radii, float)
        C = cam.p(c); A = cam.R @ Rp                    # part frame -> camera
        Minv = np.diag(1 / radii) @ A.T                  # camera offset -> unit coordinates
        ext = np.sqrt(np.sum((A * radii) ** 2, axis=1)) * (1.0 if p <= 2 else 3 ** 0.5)
        x0 = int(max(0, (C[0] - ext[0] - 0.5) * S)); x1 = min(self.w, int((C[0] + ext[0] + 0.5) * S) + 1)
        y0 = int(max(0, (C[1] - ext[1] - 0.5) * S)); y1 = min(self.h, int((C[1] + ext[1] + 0.5) * S) + 1)
        if x0 >= x1 or y0 >= y1: return
        sub = (slice(y0, y1), slice(x0, x1))
        dx = (self.xx[sub] - C[0]).ravel(); dy = (self.yy[sub] - C[1]).ravel()
        q0 = Minv[:, 0:1] * dx + Minv[:, 1:2] * dy      # (3, N) at camera depth 0
        dq = Minv[:, 2:3].copy()                         # per unit of depth toward the viewer
        dq[np.abs(dq) < 1e-9] = 1e-9
        if p == 2.0:
            a = float(np.sum(dq * dq)); b = np.sum(q0 * dq, 0); cc = np.sum(q0 * q0, 0) - 1
            disc = b * b - a * cc
            hit = disc >= 0
            t = (-b + np.sqrt(np.clip(disc, 0, None))) / a
        else:
            # clip the ray to the unit cube, march in from its near end to the first sample
            # inside, then bisect onto the surface
            ta = (-1 - q0) / dq; tb = (1 - q0) / dq
            tlo = np.max(np.minimum(ta, tb), 0); thi = np.min(np.maximum(ta, tb), 0)
            hit = thi > tlo
            n = 40
            ts = thi[None, :] - (thi - tlo)[None, :] * (np.arange(n)[:, None] / (n - 1))
            inside = np.empty((n, q0.shape[1]), bool)
            for k in range(n):
                inside[k] = np.sum(np.abs(q0 + dq * ts[k]) ** p, 0) <= 1
            first = np.argmax(inside, 0)
            hit &= inside.any(0)
            cols = np.arange(ts.shape[1])
            hi = ts[np.maximum(first - 1, 0), cols]; lo = ts[first, cols]
            for _ in range(10):
                mid = (hi + lo) / 2
                ins = np.sum(np.abs(q0 + dq * mid) ** p, 0) <= 1
                lo = np.where(ins, mid, lo); hi = np.where(ins, hi, mid)
            t = lo
        q = q0 + dq * t
        g = np.sign(q) * np.abs(q) ** (p - 1)            # gradient in unit coordinates
        npart = g / radii[:, None]                       # normal in the part's frame
        npart = npart / (np.linalg.norm(npart, axis=0, keepdims=True) + 1e-9)
        lam = LIGHT @ (A @ npart)
        shp = (y1 - y0, x1 - x0)
        hit2 = hit.reshape(shp); zz = (C[2] + t + bias).reshape(shp)
        win = hit2 & (zz > self.depth[sub])
        if not win.any(): return
        if region is not None:
            mi = np.array([MATS.index(m) for m in region(npart, q)]).reshape(shp)
        else:
            mi = np.full(shp, MATS.index(mat))
        self.depth[sub][win] = zz[win]; self.part[sub][win] = self.pid(part)
        self.lam[sub][win] = lam.reshape(shp)[win]; self.mat[sub][win] = mi[win]

    def ball(self, cam, c, r, part, mat, bias=0.0):
        self.blob(cam, c, np.eye(3), (r, r, r), part, mat, 2.0, bias)

    def tube(self, cam, a, b, ra, rb, part, mat, bias=0.0):
        """a soft limb from a to b: a chain of spheres"""
        L = np.linalg.norm(b - a); n = max(2, int(math.ceil(L / (0.3 * min(ra, rb)))) + 1)
        for i in range(n):
            t = i / (n - 1)
            self.ball(cam, a + (b - a) * t, ra + (rb - ra) * t, part, mat, bias)

    def sticker(self, cam, at, nrm, ch, part):
        """one exact pixel on a part's surface, if that surface faces us and owns the pixel;
        a later sticker wins a pixel two of them share"""
        self.stickers.append((cam.p(at), cam.R @ nrm, ch, part))


def decal(Rp, radii, p, dx, dy, elev=ELEV):
    """the point of a part centred on the origin (frame Rp, radii, exponent p) that the rest
    front camera sees dx, dy screen px from its centre, and the normal there - both in the
    body frame, so a mark painted on today's front frame rides the part afterwards"""
    cam = Cam(90, elev)
    A = cam.R @ Rp; radii = np.asarray(radii, float)
    Minv = np.diag(1 / radii) @ A.T
    q0 = Minv @ np.array([dx, dy, 0.0]); dq = Minv[:, 2]
    ts = np.linspace(8, -8, 3201)
    F = np.sum(np.abs(q0[:, None] + dq[:, None] * ts) ** p, 0) - 1
    k = int(np.argmax(F <= 0))
    if F[k] > 0:                       # just off the edge: walk it in toward the centre
        return decal(Rp, radii, p, dx * 0.93, dy * 0.93, elev)
    q = q0 + dq * ts[k]
    P = cam.R.T @ np.array([dx, dy, ts[k]])
    g = np.sign(q) * np.abs(q) ** (p - 1); n = Rp @ (g / radii); n /= np.linalg.norm(n)
    return P, n


def ink(cv, noout=(), soft=(), cross=(), edge='sides', far=(), topink=(), gap=1.6, cover=0.42):
    """shrink to art pixels and ink them. A cell goes to the nearest part holding a fair
    share of it, banded by that part's mean light. Then the outline: beside the silhouette
    only, left and right, the way the standing hand art is inked (edge 'sides'), or all four
    sides for the compact roll shapes (edge 'full'), or the top too for a part in topink. An
    inner line goes on the far side wherever one part passes in front of another with a real
    step in depth, unless the pair is soft (one piece of clothing); parts in noout carry no
    ink of their own but still take a line where a pair in cross crosses. Returns the char
    grid and the part-id grid."""
    h, w = H, W
    blk = lambda a: a.reshape(h, S, w, S).transpose(0, 2, 1, 3).reshape(h, w, S * S)
    P = blk(cv.part); D = blk(cv.depth); L = blk(cv.lam); Mt = blk(cv.mat)
    G = np.zeros((h, w), np.int16); Dm = np.full((h, w), -1e9)
    out = np.full((h, w), '.', dtype='<U1')
    for y in range(h):
        for x in range(w):
            p = P[y, x]; on = p > 0
            if on.mean() < cover: continue
            ids, cnt = np.unique(p[on], return_counts=True)
            good = ids[cnt >= 0.3 * S * S]
            if len(good) > 1:
                pid = max(good, key=lambda i: D[y, x][p == i].mean())
            elif len(good) == 1:
                pid = good[0]
            else:
                pid = ids[cnt.argmax()]
            sel = p == pid
            G[y, x] = pid; Dm[y, x] = D[y, x][sel].mean()
            mv, mc = np.unique(Mt[y, x][sel], return_counts=True)
            mi = mv[np.argmax(mc)]
            ch = band(MATS[mi], float(L[y, x][sel & (Mt[y, x] == mi)].mean()))
            if cv.pinfo[pid] in far: ch = DARKER.get(ch, ch)
            out[y, x] = ch
    res = out.copy()
    nm = lambda i: cv.pinfo[i] if i else None
    for y in range(h):
        for x in range(w):
            if G[y, x]:
                pa = nm(G[y, x])
                for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                    yy, xx = y + dy, x + dx
                    if not (0 <= yy < h and 0 <= xx < w) or not G[yy, xx] or G[yy, xx] == G[y, x]: continue
                    pb = nm(G[yy, xx])
                    if Dm[yy, xx] <= Dm[y, x] + gap: continue
                    pair = frozenset((pa, pb))
                    if pair in cross or (pa not in noout and pb not in noout and pair not in soft):
                        res[y, x] = 'o'; break
                continue
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                yy, xx = y + dy, x + dx
                if not (0 <= yy < h and 0 <= xx < w) or not G[yy, xx]: continue
                pb = nm(G[yy, xx])
                if pb in noout: continue
                if dy == 0 or edge == 'full' or (dy == 1 and pb in topink):
                    res[y, x] = 'o'; break
    for at, n, ch, part in cv.stickers:
        if n[2] <= 0.25: continue          # turned away (a profile's far eye sits near 0.1, its near one near 0.5)
        x, y = int(math.floor(at[0])), int(math.floor(at[1]))
        if 0 <= y < h and 0 <= x < w and G[y, x] and nm(G[y, x]) == part and res[y, x] != 'o':
            res[y, x] = ch
    return [''.join(r) for r in res], G


def grounded(g):
    """set a frame down so its lowest pixel stands on the ground row"""
    low = max(y for y, r in enumerate(g) if r.strip('.'))
    d = GROUND - low
    if d == 0: return g
    blank = '.' * len(g[0])
    return ([blank] * d + g[:len(g) - d]) if d > 0 else (g[-d:] + [blank] * -d)
