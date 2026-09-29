# Stylized cel renderer (from the bird concept rounds, 2026-09-29), used here
# to bake the factory (bake.py).
# Every part is a flat polygon with ONE tone of its material ramp, either
# given by hand or picked from the plate's facing (three steps, no gradients,
# no noise), so the art reads as designed shapes instead of a rendered model.
# Parts carry 3D points: x forward, y right, z up (units = world px at roost
# size). View 'air' looks down on a flying bird (height lifts ZK up the screen);
# view 'flat' takes (x, y) as screen coordinates directly (the landed pose is
# authored straight in screen space). A part flagged cull=True is a face with
# a front and a back: it only draws when it faces the viewer, so a visor shows
# on a bird flying toward you and not on one flying away.
import numpy as np, math
from PIL import Image, ImageDraw

SS = 4
INK = (46, 36, 64)          # #2e2440, the characters' outline
LIGHT = np.array([-0.45, -0.55, 0.70]); LIGHT /= np.linalg.norm(LIGHT)
AIR_ZK = 0.55


def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def ramp(*h): return [hexrgb(x) for x in h]


def P(pts, mat, layer, tone=None, **kw):
    """pts: [(x, y)] or [(x, y, z)]; tone: 0..3 or None = from its facing"""
    pts = [p if len(p) == 3 else (p[0], p[1], 0.0) for p in pts]
    d = dict(pts=pts, mat=mat, layer=layer, tone=tone, cull=False, line=True, shine=False, px=None)
    d.update(kw)
    return d

def PX(x, y, mat, tone, layer, z=0.0):
    """one exact pixel, stamped after the shrink (a glint, a rivet, a slit)"""
    return dict(pts=[(x, y, z)], mat=mat, layer=layer, tone=tone, px=True)

def mirror(parts):
    """the same parts reflected across the bird's spine (y -> -y), windings kept"""
    out = []
    for p in parts:
        q = dict(p); q['pts'] = [(x, -y, z) for x, y, z in p['pts']][::-1]
        out.append(q)
    return out

def circle(cx, cy, r, n=14, rx=None, ry=None, a0=0.0):
    rx = rx or r; ry = ry or r
    return [(cx + rx * math.cos(a0 + 2 * math.pi * i / n), cy + ry * math.sin(a0 + 2 * math.pi * i / n)) for i in range(n)]


def project(p, view, hd, sc):
    x, y, z = p
    if view == 'flat':
        return x * sc, y * sc
    c, s = math.cos(hd), math.sin(hd)
    X, Y = x * c - y * s, x * s + y * c
    return X * sc, (Y - z * AIR_ZK) * sc


def facing_tone(p, hd):
    a, b, c = (np.array(p['pts'][i], float) for i in (0, 1, 2))
    n = np.cross(b - a, c - a)
    if np.linalg.norm(n) < 1e-9: return 2
    n /= np.linalg.norm(n)
    if n[2] < 0: n = -n
    cc, s = math.cos(hd), math.sin(hd)
    n = np.array([n[0] * cc - n[1] * s, n[0] * s + n[1] * cc, n[2]])
    l = float(n @ LIGHT)
    return 3 if l > 0.93 else 2 if l > 0.72 else 1 if l > 0.35 else 0


def draw(parts, pal, view='air', hd=0.0, sc=1.0, W=200, H=160, ox=None, oy=None, outline=True):
    ox = W / 2 if ox is None else ox; oy = H / 2 if oy is None else oy
    w, h = W * SS, H * SS
    idm = Image.new('I', (w, h), 0)
    dr = ImageDraw.Draw(idm)
    order = sorted(range(len(parts)), key=lambda i: parts[i]['layer'])
    tones = {}
    for i in order:
        p = parts[i]
        if p.get('px'): continue
        pts = [project(q, view, hd, sc) for q in p['pts']]
        pts = [((x + ox) * SS, (y + oy) * SS) for x, y in pts]
        if p['cull'] and view == 'air':   # cull = the face's outward normal in bird space
            nx, ny, nz = p['cull']
            c, s = math.cos(hd), math.sin(hd)
            # the camera looks down from the south: toward it is (0, +ZK, 1)
            if (nx * s + ny * c) * AIR_ZK + nz * 1.0 <= 0.05: continue
        dr.polygon(pts, fill=i + 1)
        t = p['tone']
        tones[i] = facing_tone(p, hd if view == 'air' else 0.0) if t is None else t
    ids = np.asarray(idm, dtype=np.int64) - 1
    # shrink: the part holding most of each cell, if the cell is half full
    C = ids.reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
    best = np.full((H, W), -1); bc = np.zeros((H, W))
    for i in np.unique(C[C >= 0]):
        cnt = (C == i).sum(2)
        m = cnt > bc
        best = np.where(m, i, best); bc = np.where(m, cnt, bc)
    best[(C >= 0).sum(2) < SS * SS * 0.5] = -1
    # thin parts (a slit, a strap) keep their pixels even under half cover
    for i in order:
        if not parts[i].get('keep'): continue
        cnt = (C == i).sum(2)
        best = np.where(cnt >= SS * SS * 0.3, i, best)
    lay = np.array([parts[i]['layer'] for i in range(len(parts))] + [-1e9])
    img = np.zeros((H, W, 4), np.uint8)
    tone = np.full((H, W), -1)
    for i in np.unique(best[best >= 0]):
        tone[best == i] = tones[i]
    # inner lines: a part lying under another takes one darker tone along the
    # seam (only parts flagged line; same-material seams only if 'seam')
    out = tone.copy()
    for dy, dx in ((-1, 0), (0, -1), (1, 0), (0, 1)):
        nb = np.roll(np.roll(best, dy, 0), dx, 1)
        m = (best >= 0) & (nb >= 0) & (nb != best)
        ys, xs = np.nonzero(m)
        for y, x in zip(ys, xs):
            a, b = best[y, x], nb[y, x]
            pa, pb = parts[a], parts[b]
            if lay[b] > lay[a] and pa['line'] and (pa['mat'] != pb['mat'] or pa.get('seam') or pb.get('seam')):
                out[y, x] = min(out[y, x], max(0, tones[a] - (2 if pa.get('deep') else 1)))
    # shine: a steel part's top-left edge catches a highlight
    for i in np.unique(best[best >= 0]):
        if not parts[i]['shine']: continue
        m = best == i
        up = np.roll(m, 1, 0); lf = np.roll(m, 1, 1)
        edge = m & (~up | ~lf)
        out[edge] = np.minimum(3, tones[i] + 1)
    # mail: rows of little rings, a darker pixel every other one
    yy, xx = np.mgrid[0:H, 0:W]
    ring = (yy % 2 == 0) & ((xx + yy // 2) % 2 == 0)
    for i in np.unique(best[best >= 0]):
        if parts[i].get('mail'):
            m = (best == i) & ring
            out[m] = np.maximum(0, out[m] - 1)
    for y in range(H):
        for x in range(W):
            i = best[y, x]
            if i < 0: continue
            r = pal[parts[i]['mat']]
            img[y, x, :3] = r[min(len(r) - 1, max(0, out[y, x]))]; img[y, x, 3] = 255
    for p in parts:
        if not p.get('px'): continue
        x, y = project(p['pts'][0], view, hd, sc)
        x, y = int(math.floor(x + ox)), int(math.floor(y + oy))
        if 0 <= y < H and 0 <= x < W:
            img[y, x, :3] = pal[p['mat']][p['tone']]; img[y, x, 3] = 255
    if outline:
        on = img[..., 3] > 0
        ring = np.zeros_like(on)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ring |= np.roll(np.roll(on, dy, 0), dx, 1)
        ring &= ~on
        img[ring, :3] = INK; img[ring, 3] = 255
    return img
