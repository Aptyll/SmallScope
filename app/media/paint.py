# The 2D painted cutout painter: concept art and sprites painted in code, never typed.
# Parts (tubes, lens leaves/petals/blades, domes) are painted at SS x resolution into
# material / tone / part buffers, then each art pixel takes the nearest part covering it,
# its tone is banded into that material's locked palette ramp, a far part touching a
# near part of the same material gets an inner line, and the edge gets an ink outline
# (a soft one in its own darkest tone for snow, none for thin stems).
#   from paint import Canvas, ramp, lint
#   c = Canvas(32); c.dome((16, 27), 6, 2.4, mat='snow'); c.lens((16, 27), (16, 12), 3, mat='leaf')
#   rgba = c.render(); print(lint(rgba))     # numpy (n, n, 4)
# ramp('fur', ['#2a1c18', '#4a3226', '#6e4c34'], outline='ink') adds a material.
# Light is from the top-left toward the viewer. Lessons: thin stems with an ink outline read
# as dark bars; same-coloured parts fuse unless spaced; an ink ring under a drift reads as a plate.
import numpy as np, math

SS = 8
L3 = np.array([-0.5, -0.62, 0.6]); L3 /= np.linalg.norm(L3)   # light from top-left, toward viewer

INK = (0x22, 0x1c, 0x2e)

def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

# material -> ramp dark..light, plus outline colour
RAMPS = {
    'leaf':   ['#0e3c36', '#184b3e', '#2e6c44', '#3a7c4d', '#67a584'],
    'leafD':  ['#0b2f2c', '#143f36', '#1f5240', '#2e6c44', '#4f8e66'],   # evergreen hellebore leaves, darker
    'stem':   ['#265c47', '#3a7c4d', '#67a584', '#8fc19a'],
    'white':  ['#8e9cc4', '#b9c7e6', '#e6eefb', '#ffffff'],
    'snow':   ['#9eaed6', '#bccbea', '#d6e1f6', '#eef4fb'],
    'blush':  ['#8c4a6a', '#c27a98', '#e8b8c8', '#fbe6ea'],
    'yellow': ['#a8761e', '#d8a83a', '#f4d468'],
    'violet': ['#2e2058', '#48348a', '#6a50b8', '#9a80dc', '#c4b2f0'],
    'frost':  ['#1f3d6e', '#2f64a8', '#4f98d8', '#8fd4f4', '#e6fbff'],
    'stamen': ['#f08a2a'],
    'stemD':  ['#2c4258', '#43607a', '#6f8fae'],
}
RAMPS = {k: [hx(c) for c in v] for k, v in RAMPS.items()}
SOFT = {'snow'}   # outlined with their own darkest tone, not ink
NOOUT = {'stem', 'stemD'}   # thin stems stay a single line of their own green

def ramp(name, colours, outline='ink'):
    # a material: colours dark to light (hex), outline 'ink', 'soft' (own darkest) or 'none'
    RAMPS[name] = [hx(c) if isinstance(c, str) else tuple(c) for c in colours]
    SOFT.discard(name); NOOUT.discard(name)
    if outline == 'soft': SOFT.add(name)
    if outline == 'none': NOOUT.add(name)

def nrm(v):
    n = np.linalg.norm(v, axis=-1, keepdims=True); return v / np.maximum(n, 1e-6)

def bez(p0, p1, p2, t):
    p0, p1, p2 = map(np.asarray, (p0, p1, p2))
    t = t[:, None]
    P = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2
    T = 2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1)
    return P, nrm(T)

class Canvas:
    def __init__(s, n=32):
        s.n = N = n
        W = N * SS
        s.mat = np.full((W, W), -1, np.int16)
        s.tone = np.zeros((W, W), np.float32)
        s.part = np.full((W, W), -1, np.int32)
        s.mats = list(RAMPS)  # materials registered after this canvas exists are added on use
        s.np = 0
        s.stickers = []

    def _put(s, x, y, tone, mat):
        N = s.n
        s.np += 1
        ix = np.floor(x * SS).astype(int); iy = np.floor(y * SS).astype(int)
        ok = (ix >= 0) & (iy >= 0) & (ix < N * SS) & (iy < N * SS)
        ix, iy, tone = ix[ok], iy[ok], tone[ok]
        if mat not in s.mats: s.mats.append(mat)
        s.mat[iy, ix] = s.mats.index(mat)
        s.tone[iy, ix] = np.clip(tone, 0, 1)
        s.part[iy, ix] = s.np

    @staticmethod
    def light(n, amb=0.3):
        return amb + (1 - amb) * np.clip(n @ L3, 0, 1)

    def stem(s, p0, p1, p2, r0, r1, mat='stem', bias=0.0):
        ln = sum(np.hypot(*np.subtract(b, a)) for a, b in ((p0, p1), (p1, p2)))
        t = np.linspace(0, 1, int(ln * SS * 3) + 2)
        P, T = bez(p0, p1, p2, t)
        Pp = np.stack([-T[:, 1], T[:, 0]], 1)
        r = r0 + (r1 - r0) * t
        sv = np.linspace(-1, 1, max(3, int(max(r0, r1) * 2 * SS * 2)))
        S_, I = np.meshgrid(sv, np.arange(len(t)))
        pos = P[I] + Pp[I] * (S_ * r[I])[..., None]
        n = np.concatenate([Pp[I] * S_[..., None], np.sqrt(np.clip(1 - S_ ** 2, 0, 1))[..., None]], -1)
        tone = s.light(nrm(n)) + bias
        s._put(pos[..., 0].ravel(), pos[..., 1].ravel(), tone.ravel(), mat)

    def lens(s, base, tip, width, bend=0.0, mat='leaf', fold=0.6, cup=0.0, prof='leaf',
             nbase=(0, 0, 1), bias=0.0, base_dark=0.2, facets=False):
        base, tip = np.asarray(base, float), np.asarray(tip, float)
        d = tip - base; ln = np.hypot(*d)
        mid = (base + tip) / 2 + np.array([-d[1], d[0]]) / ln * bend * ln
        t = np.linspace(0, 1, int(ln * SS * 3) + 2)
        P, T = bez(base, mid, tip, t)
        Pp = np.stack([-T[:, 1], T[:, 0]], 1)
        if prof == 'leaf':      # pointed both ends, widest at 40%
            hw = np.sin(np.pi * t ** 0.75) ** 0.8
        elif prof == 'petal':   # narrow base, round tip
            hw = np.sin(np.pi * np.clip(t, 0, 1) ** 0.55) ** 0.55
        elif prof == 'strap':   # grass blade
            hw = np.clip(1.15 - t ** 2, 0, 1) * np.minimum(1, t * 6 + 0.4)
        elif prof == 'shard':   # straight-sided crystal, point at tip
            hw = np.minimum(1, t * 4) * (1 - t) ** 0.9
        hw = hw * width / 2
        sv = np.linspace(-1, 1, max(3, int(width * SS * 2.5)))
        S_, I = np.meshgrid(sv, np.arange(len(t)))
        pos = P[I] + Pp[I] * (S_ * hw[I])[..., None]
        sg = np.sign(S_)
        if facets:
            sideways = sg * fold
        else:
            sideways = S_ * cup + sg * fold
        nb = np.asarray(nbase, float)
        n = np.concatenate([Pp[I] * sideways[..., None], np.ones_like(S_)[..., None]], -1) + nb * 0.6
        tone = s.light(nrm(n)) + bias - base_dark * (1 - t[I])
        s._put(pos[..., 0].ravel(), pos[..., 1].ravel(), tone.ravel(), mat)

    def dome(s, c, rx, ry, mat='snow', bias=0.0, flat=0.6, half=None):
        N = s.n; W = N * SS
        y0, y1 = int((c[1] - ry) * SS), int((c[1] + ry) * SS) + 1
        x0, x1 = int((c[0] - rx) * SS), int((c[0] + rx) * SS) + 1
        ys, xs = np.mgrid[y0:y1, x0:x1]
        X = (xs + 0.5) / SS; Y = (ys + 0.5) / SS
        u = (X - c[0]) / rx; v = (Y - c[1]) / ry
        inside = u * u + v * v <= 1
        if half == 'top': inside &= v <= 0.25
        u, v = u[inside], v[inside]
        n = np.stack([u * flat, v * flat, np.sqrt(np.clip(1 - u * u - v * v, 0, 1))], -1)
        tone = s.light(nrm(n), 0.45) + bias
        s._put(X[inside], Y[inside], tone, mat)

    def tube(s, p0, p1, r, mat='stem', bias=0.0):
        # a straight capsule-ish limb from p0 to p1 (a stem with its bend at the middle)
        s.stem(p0, ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2), p1, r, r, mat, bias)

    def sticker(s, x, y, col):
        s.stickers.append((int(x), int(y), hx(col) if isinstance(col, str) else col))

    # ------------------------------------------------------------ pixel post
    def render(s, cover=0.38, inner=True):
        N = s.n; W = N * SS
        mat = s.mat.reshape(N, SS, N, SS).transpose(0, 2, 1, 3).reshape(N, N, SS * SS)
        tone = s.tone.reshape(N, SS, N, SS).transpose(0, 2, 1, 3).reshape(N, N, SS * SS)
        part = s.part.reshape(N, SS, N, SS).transpose(0, 2, 1, 3).reshape(N, N, SS * SS)
        out = np.zeros((N, N, 4), np.uint8)
        PM = np.full((N, N), -1, int); MM = np.full((N, N), -1, int); TB = np.zeros((N, N), int)
        for y in range(N):
            for x in range(N):
                pp = part[y, x]; m = pp >= 0
                if m.mean() < cover: continue
                ids, cnt = np.unique(pp[m], return_counts=True)
                # nearest part that covers a fair share, else the biggest
                good = ids[cnt >= 0.3 * SS * SS]
                pid = good.max() if len(good) else ids[cnt.argmax()]
                sel = pp == pid
                mi = int(mat[y, x][sel][0]); mname = s.mats[mi]
                ramp = RAMPS[mname]
                tv = float(tone[y, x][sel].mean())
                b = int(np.clip(tv * len(ramp), 0, len(ramp) - 1))
                PM[y, x] = pid; MM[y, x] = mi; TB[y, x] = b
        # inner lines: far part touching a nearer part of the same material, on the far side
        if inner:
            TB2 = TB.copy()
            for y in range(N):
                for x in range(N):
                    if PM[y, x] < 0 or s.mats[MM[y, x]] in SOFT: continue
                    for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                        X, Y = x + dx, y + dy
                        if 0 <= X < N and 0 <= Y < N and PM[Y, X] > PM[y, x] and MM[Y, X] == MM[y, x] \
                                and PM[Y, X] - PM[y, x] >= 1:
                            TB2[y, x] = max(0, TB[y, x] - 2)
            TB = TB2
        for y in range(N):
            for x in range(N):
                if PM[y, x] < 0: continue
                out[y, x, :3] = RAMPS[s.mats[MM[y, x]]][TB[y, x]]; out[y, x, 3] = 255
        # outline
        o2 = out.copy()
        for y in range(N):
            for x in range(N):
                if out[y, x, 3]: continue
                near = []
                for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                    X, Y = x + dx, y + dy
                    if 0 <= X < N and 0 <= Y < N and PM[Y, X] >= 0: near.append(s.mats[MM[Y, X]])
                near = [m for m in near if m not in NOOUT]
                if not near: continue
                if all(m in SOFT for m in near):
                    o2[y, x, :3] = RAMPS[near[0]][0]
                else:
                    o2[y, x, :3] = INK
                o2[y, x, 3] = 255
        for x, y, c in s.stickers:
            o2[y, x, :3] = c; o2[y, x, 3] = 255
        return o2

def lint(img, allowed=None):
    allowed = allowed or ({INK} | {c for r in RAMPS.values() for c in r})
    a = img[..., 3] > 0
    cols = {tuple(c) for c in img[a][:, :3]}
    off = [c for c in cols if c not in allowed]
    edge = a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any()
    return dict(off=len(off), clip=bool(edge), px=int(a.sum()))

