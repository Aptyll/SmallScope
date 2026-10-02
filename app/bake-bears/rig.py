# Bear as a 2D cutout puppet: painted ellipse parts with analytic normals,
# posed per frame, rendered at SS x, downsampled, banded to the reference palette.
import numpy as np, math

SS = 8
CW, CH = 60, 46          # 1x canvas: room for the rear-up above and the swipe out front
OX, OY = 12, 16          # where the reference crop origin sits in the canvas

PAL = {                  # measured from the reference (k-means on 5px cells)
    'D0': (43, 30, 30), 'D1': (71, 45, 35), 'M3': (106, 67, 38),
    'L6': (149, 98, 60), 'H8': (187, 136, 91), 'G7': (137, 109, 102),
    'EY': (214, 160, 102),
    'FL': (214, 226, 236), 'FM': (128, 150, 170),  # the fish: silver over a slate belly
    'SM': (250, 252, 255), 'SD': (58, 66, 96),   # the swipe's claw trail: white slashes, ink edges so they read on snow
}
# the antlered bear in the reference is the same sprite recoloured: map band by band
PAL_DARK = {
    'D0': (35, 36, 39), 'D1': (49, 51, 61), 'M3': (59, 59, 83),
    'L6': (89, 87, 117), 'H8': (89, 87, 117), 'G7': (124, 118, 113),
    'EY': (198, 163, 118), 'BN': (188, 169, 165), 'BS': (124, 118, 113),
    'FL': (214, 226, 236), 'FM': (128, 150, 170),
    'SM': (250, 252, 255), 'SD': (58, 66, 96),
}
RAMPS = {
    'fur':  ['D0', 'D1', 'M3', 'L6', 'H8'],
    'far':  ['D0', 'D0', 'D1', 'D1', 'M3'],
    'muz':  ['D0', 'D1', 'G7', 'G7', 'G7'],
    'ear':  ['D1', 'G7', 'G7', 'G7', 'G7'],
    'eye':  ['EY'] * 5,
    'mouth': ['D0'] * 5,
    'tooth': ['H8'] * 5,
}
MATS = list(RAMPS)
LIGHT = np.array([0.3, -0.65, 0.7]); LIGHT /= np.linalg.norm(LIGHT)
AO = 0.035
DECALS = {'eye', 'ear', 'tooth', 'mouth'}

def vnoise(x, y, seed):
    xi, yi = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - xi, y - yi
    def h(a, b):
        v = np.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453
        return v - np.floor(v)
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    return (h(xi, yi) * (1 - sx) + h(xi + 1, yi) * sx) * (1 - sy) + \
           (h(xi, yi + 1) * (1 - sx) + h(xi + 1, yi + 1) * sx) * sy

def E(cx, cy, rx, ry, ang=0.0, mat='fur', layer=1.0, fur=1.0, seed=0, lift=0.0):
    return dict(cx=cx, cy=cy, rx=rx, ry=ry, ang=ang, mat=mat, layer=layer,
                fur=fur, seed=seed, lift=lift)

def seg(ax, ay, bx, by, r0, r1, mat, layer, seed, n=3):
    """a limb segment as n overlapping ellipses along a->b"""
    ang = math.atan2(by - ay, bx - ax)
    L = math.hypot(bx - ax, by - ay)
    out = []
    for i in range(n):
        t = (i + 0.5) / n
        r = r0 + (r1 - r0) * t
        out.append(E(ax + (bx - ax) * t, ay + (by - ay) * t, max(r, L / n * 0.9), r,
                     ang, mat, layer + i * 0.001, seed=seed + i))
    return out

def render(prims):
    W, H = CW * SS, CH * SS
    mat = np.full((H, W), -1, int)
    shade = np.zeros((H, W))
    layer = np.full((H, W), -1e9)
    ys, xs = np.mgrid[0:H, 0:W]
    wx, wy = (xs + 0.5) / SS, (ys + 0.5) / SS
    for p in sorted(prims, key=lambda p: p['layer']):
        cx, cy = p['cx'] + OX, p['cy'] + OY
        r = max(p['rx'], p['ry']) + 1
        x0, x1 = int(max(0, (cx - r) * SS)), int(min(W, (cx + r) * SS))
        y0, y1 = int(max(0, (cy - r) * SS)), int(min(H, (cy + r) * SS))
        if x0 >= x1 or y0 >= y1: continue
        dx, dy = wx[y0:y1, x0:x1] - cx, wy[y0:y1, x0:x1] - cy
        c, s = math.cos(p['ang']), math.sin(p['ang'])
        lx, ly = dx * c + dy * s, -dx * s + dy * c
        u, v = lx / p['rx'], ly / p['ry']
        d2 = u * u + v * v
        m = d2 <= 1
        if not m.any(): continue
        z = np.sqrt(np.clip(1 - d2, 0, 1))
        rz = min(p['rx'], p['ry'])
        nx, ny, nz = u / p['rx'], v / p['ry'], z / rz
        wnx, wny = nx * c - ny * s, nx * s + ny * c
        nn = np.sqrt(wnx ** 2 + wny ** 2 + nz ** 2) + 1e-9
        sh = (wnx * LIGHT[0] + wny * LIGHT[1] + nz * LIGHT[2]) / nn
        if p['fur']:   # clumpy fur streaks stuck to the part
            n1 = vnoise(dx * 0.7, dy * 0.3, p['seed'])  # streaks run up and down, like the reference's fur clumps
            sh = sh + (n1 - 0.5) * 0.35 * p['fur']
        sh = sh + p['lift'] - AO * (wy[y0:y1, x0:x1] - OY - 8)
        sub = (slice(y0, y1), slice(x0, x1))
        mat[sub] = np.where(m, MATS.index(p['mat']), mat[sub])
        shade[sub] = np.where(m, sh, shade[sub])
    return mat, shade

# band thresholds on shade: calibrate() fitted them once so each shade's share of
# the idle bear matches Noah's reference sheet (D0 97, D1 108, M3 143, L6 88, H8 7 px)
TH = [0.025, 0.488, 0.842, 1.101]

def downsample(mat, shade):
    H, W = CH, CW
    m = mat.reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
    s = shade.reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
    out = np.full((H, W), -1, int); sv = np.zeros((H, W))
    for y in range(H):
        for x in range(W):
            mm = m[y, x]; cov = (mm >= 0).mean()
            if cov < 0.5: continue
            # decals win if they hold a real share of the cell
            best = None
            for d in ('eye', 'tooth', 'mouth', 'ear'):
                k = MATS.index(d)
                if (mm == k).mean() >= 0.3: best = k; break
            if best is None:
                vals, cnt = np.unique(mm[mm >= 0], return_counts=True)
                best = vals[cnt.argmax()]
            out[y, x] = best
            sv[y, x] = s[y, x][mm == best].mean()
    return out, sv

def outline(out, band):
    """selective outline like the reference: lower and side edges go darkest,
    upper edges step one band down"""
    H, W = out.shape
    on = out >= 0
    b = band.copy()
    for y in range(H):
        for x in range(W):
            if not on[y, x]: continue
            dn = y + 1 >= H or not on[y + 1, x]
            up = y == 0 or not on[y - 1, x]
            lf = x == 0 or not on[y, x - 1]
            rt = x + 1 >= W or not on[y, x + 1]
            if MATS[out[y, x]] in DECALS: continue
            if dn or ((lf or rt) and not up): b[y, x] = 0
            elif up or lf or rt: b[y, x] = max(0, b[y, x] - 1)
    return b

def despeckle(out):
    """drop lone pixels that stick out of the silhouette by one"""
    on = out >= 0; o = out.copy()
    H, W = out.shape
    for y in range(H):
        for x in range(W):
            if not on[y, x]: continue
            n = sum(on[yy, xx] for yy, xx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)) if 0 <= yy < H and 0 <= xx < W)
            if n <= 1: o[y, x] = -1
    return o

def to_rgba(out, band, pal=None):
    pal = pal or PAL
    H, W = out.shape
    img = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        for x in range(W):
            if out[y, x] < 0: continue
            name = RAMPS[MATS[out[y, x]]][min(4, band[y, x])]
            img[y, x, :3] = pal[name]; img[y, x, 3] = 255
    return img

def stamp_stickers(prims, img, pal):
    """pixel-exact markings (antlers, runes) ride their bone: each sticker is a
    list of 1x pixels placed at its snapped anchor"""
    for p in prims:
        if p['mat'] != 'sticker': continue
        ax, ay = int(round(p['cx'] + OX)), int(round(p['cy'] + OY))
        for (dx, dy, col) in p['px']:
            x, y = ax + dx, ay + dy
            if not (0 <= y < img.shape[0] and 0 <= x < img.shape[1]): continue
            if p.get('on_body') and img[y, x, 3] == 0: continue
            img[y, x, :3] = pal[col]; img[y, x, 3] = 255
    return img

def bands(sv, th=TH):
    return np.searchsorted(th, sv)

def stamp_eyes(prims, out):
    """eyes are one exact pixel each, snapped, so they never blur away or flicker"""
    for p in prims:
        if p['mat'] == 'eye':
            x, y = int(math.floor(p['cx'] + OX)), int(math.floor(p['cy'] + OY))
            if 0 <= y < out.shape[0] and 0 <= x < out.shape[1] and out[y, x] >= 0:
                out[y, x] = MATS.index('eye')
    return out

def draw(prims, th=None, pal=None):
    body = [p for p in prims if p['mat'] not in ('eye', 'sticker')]
    mat, shade = render(body)
    out, sv = downsample(mat, shade)
    out = stamp_eyes(prims, despeckle(out))
    band = outline(out, bands(sv, th if th is not None else TH))
    img = stamp_stickers(prims, to_rgba(out, band, pal), pal or PAL)
    return img, out, band

def calibrate(prims, target):
    """pick band thresholds so the fur band shares after outlining match the
    reference's (target: counts for bands 0..4)"""
    mat, shade = render([p for p in prims if p['mat'] not in ('eye', 'sticker')])
    out, sv = downsample(mat, shade)
    out = despeckle(out)
    fur = out == MATS.index('fur')
    tgt = np.array(target, float) / sum(target)
    vals = np.sort(sv[fur])
    q = np.cumsum(tgt)[:4]
    th = [vals[int(min(len(vals) - 1, qq * len(vals)))] for qq in q]
    for _ in range(60):
        b = outline(out, bands(sv, th))[fur]
        got = np.bincount(b, minlength=5)[:5] / fur.sum()
        err = np.cumsum(got)[:4] - np.cumsum(tgt)[:4]
        if np.abs(err).max() < 0.01: break
        th = [t - e * 0.6 for t, e in zip(th, err)]
        th = list(np.maximum.accumulate(th))
    return [float(t) for t in th]
