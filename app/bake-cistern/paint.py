# Paints the cistern at the middle of the map (the `cistern` banner, js/sim/cistern.js)
# and writes js/baked/cistern.js (never hand-edit it: repaint and rebake).
#
#   python3 app/bake-cistern/paint.py   (needs numpy; Pillow too for --png)
#   python3 app/bake-cistern/paint.py --png out.png   (also saves the whole overlay, for a look)
#
# Look H CUT BLOCKS (docs/media/concepts/cistern-concepts-4.png, 2026-10-14):
# the works' ring cistern round the creek's pool, all ice inside, two gates
# where the road comes in, each with a stone sill, and four breaches on the
# diagonals. Dressed stone in tall courses; each breach steps down course by
# course, every break on a joint, the inner and outer skins breaking apart,
# and the blocks that came down lie where they rolled, most of them outside.
# Everything random is drawn from (w, |p|), so BLUE's half is RED's mirrored.
#
# A HEIGHTFIELD per world px round the crossing, seen in the game's 3/4 view
# (screen y = ground y - z): each screen px is the first thing a ray down it
# meets, its top or its south face, shaded by the face's normal against the
# sun (LIGHT). The bake writes three things off one paint:
#   flat   what lies on the ground: the gates' sills and every shadow. The
#          ground bake lays it into the ground canvas (js/draw/cistern.js)
#   segs   everything standing (the wall, the piers, the fallen blocks) cut by
#          the GROUND ROW each px stands on into bands BAND rows deep, each
#          band split into its separate pieces, every piece with the y-sort
#          key of a body whose feet stand on the band's middle row. So a body
#          south of a stone is drawn over it and one north of it behind it,
#          whatever its height (render's y-sorted pass)
#   solid  the footprint: every ground px the wall or a block stands on (a
#          sill is walked over). The sim's collision is exact to this px
#          (cisternReach, js/sim/cistern.js)
# Box coordinates are world px less (cx - RB, cy - RB): the crossing (cx, cy)
# is the box's centre, so the art follows the crossing if WORLD changes.
import math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'js', 'baked', 'cistern.js')

T = 16                        # TILE
C = 115.5                     # the crossing's tile coordinate, (WORLD - 1) / 2 (WORLD 232); the textures hash world px off it
CX = (C + 0.5) * T            # ...and its world px
RB = 288                      # px from the crossing to the box's edge
X0 = Y0 = int(CX - RB)
N = 2 * RB
S2 = math.sqrt(2)
BAND = 2                      # ground rows per y-sorted band
FOOT = 5                      # a band's key: its first row + FOOT (BAND / 2 to its middle, + 4 to a player's sort key off their feet)
LANE = 16                     # px either side of a breach's middle line no fallen block lies in

# the ring, in tiles off the crossing (w along the creek, p along the road)
RI, RO, HWALL = 9.5, 10.6, 16  # inner and outer face, wall height px
RM = (RI + RO) / 2
GH = 3.0                      # the gates' half-width
SILL = (RI - 0.35, RO + 0.25) # the gates' sills run radially from .. to
PIER_H = HWALL + 5            # the gate piers stand a head taller
CREEK_HW = 1.6                # the creek's half-width where it meets the culverts (CREEK_HW, js/sim/world.js: calm here)
ICE_R = 9.55                  # the pool's ice reaches under the inner face
FROZEN_R = 10.45              # the creek is frozen to here (under the wall), open past it

def hx(s):
    s = s.lstrip('#'); return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)

# the game's own inks (js/draw/ground.js STONE_COL, CREEK_COL)
COL = {k: hx(v) for k, v in {
    'rim': '#3a3f4f', 'dark': '#6b7486', 'mid': '#8a93a4', 'lit': '#a9b2c1', 'mid2': '#959eaf', 'jt': '#7a8396',
    'snow': '#eef4fb', 'snowD': '#d3dfec', 'wet': '#1f3a4e', 'foam': '#dcecf5',
    'under': '#1d3649', 'deep': '#2c5068', 'icicle': '#c6e6fb',
}.items()}
SHADE = (0x46, 0x5f, 0xa5, 64)  # the cast shade's ink and alpha (the scenery's, SHADE in ground.js)

# ground px centres -> tile coords -> w (along the creek, + downstream), p (along the road, + BLUE)
gx = np.arange(N) + X0 + 0.5
FX = (gx / T - 0.5)[None, :].repeat(N, 0)
FY = (gx / T - 0.5)[:, None].repeat(N, 1)
W = (FX + FY - 2 * C) / S2
P = (FX - FY) / S2
R = np.hypot(W, P)
XI = np.arange(N)[None, :].repeat(N, 0) + X0
YI = np.arange(N)[:, None].repeat(N, 1) + Y0
CN = P                         # across the creek: its line is the road's cross-diagonal here (creekCalm holds it still)

def h2(a, b):
    v = np.sin(a * 12.9898 + b * 78.233) * 43758.5453
    return v - np.floor(v)

def vnoise(x, y):
    x0 = np.floor(x); y0 = np.floor(y); fx = x - x0; fy = y - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a = h2(x0, y0); b = h2(x0 + 1, y0); c = h2(x0, y0 + 1); d = h2(x0 + 1, y0 + 1)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

PA = np.abs(P)
BM = np.arctan2(W, PA)                     # 0 on the gates' line, +-pi/2 on the creek's
QB = math.pi / 4                           # the breaches sit on the diagonals: screen north, east, south, west
BI = (BM > 0).astype(np.int8)              # which pair: 0 screen north / west, 1 screen east / south
SB = (BM - np.where(BI == 1, QB, -QB)) * RM * T   # px along the arc from the breach's middle
AB = np.abs(SB)
SIDE = (SB > 0).astype(np.int8)
RR = (R - RM) * T                          # px out from the wall's middle line
GATE = np.abs(BM) < math.asin(GH / RM)

M_CAP, M_SILL, M_STONE, M_BLOCK = 2, 6, 7, 8

def rng(*k):
    return np.random.default_rng([int(x) for x in k])

def blur(a, r):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    b = np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 1, a)
    return np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 0, b)

class Field:
    # one heightfield for everything (wall, piers, blocks) so it all occludes itself:
    # H height px, M top material, ID which part (an inner line where two meet), HF the
    # smooth height a top is lit by
    def __init__(s):
        s.H = np.zeros((N, N), np.int16); s.M = np.zeros((N, N), np.int8); s.ID = np.zeros((N, N), np.int32)
        s.HF = np.zeros((N, N), np.float32)
        s.nid = 10
    def new_id(s):
        s.nid += 1; return s.nid
    def put(s, iy, ix, h, mat, eid=0, hf=None):
        h = np.broadcast_to(np.asarray(h, np.float32), iy.shape)
        hi = np.round(h).astype(np.int16)
        m = hi > s.H[iy, ix]
        iy, ix = iy[m], ix[m]
        s.H[iy, ix] = hi[m]; s.M[iy, ix] = mat; s.ID[iy, ix] = eid
        s.HF[iy, ix] = np.broadcast_to(hf, m.shape)[m] if hf is not None else h[m]

class Zone:
    # the px round one pair of breaches, in a flat local frame: x along the wall,
    # y out from its middle line (px); mirrored on RED's half by construction
    def __init__(s, bi, rad=7.5):
        a = (-1, 1)[bi] * QB
        wc, pc = RM * math.sin(a), RM * math.cos(a)
        dw, dp = W - wc, PA - pc
        sel = np.hypot(dw, dp) < rad
        s.iy, s.ix = np.nonzero(sel)
        s.x = ((dw * math.cos(a) - dp * math.sin(a)) * T)[sel]
        s.y = ((dw * math.sin(a) + dp * math.cos(a)) * T)[sel]

def rect(z, x0, y0, hl, hw, th, chip=1.0):
    c, s_ = math.cos(th), math.sin(th)
    u = (z.x - x0) * c + (z.y - y0) * s_
    v = -(z.x - x0) * s_ + (z.y - y0) * c
    m = (np.abs(u) <= hl) & (np.abs(v) <= hw)
    m &= ~((np.abs(u) > hl - chip) & (np.abs(v) > hw - chip))          # the corners knocked off
    return m, u, v

def raycast(g):
    zmax = int(g.H.max())
    hit = np.zeros((N, N), bool); top = np.zeros((N, N), bool)
    GY = np.full((N, N), -1, np.int32); Z = np.zeros((N, N), np.int16)
    sy = np.arange(N)[:, None].repeat(N, 1); sx = np.arange(N)[None, :].repeat(N, 0)
    for z in range(zmax, -1, -1):
        gy = sy + z
        ok = (gy < N) & ~hit
        gyc = np.clip(gy, 0, N - 1)
        h = g.H[gyc, sx]
        m = ok & (h > 0) & (h >= z)
        hit |= m; GY[m] = gyc[m]; Z[m] = z; top[m] = h[m] == z
    return hit, top, GY, Z

# ---------------------------------------------------------------- the ring
def ring_base(g):
    ring = (R >= RI) & (R <= RO) & ~GATE
    g.H[ring] = HWALL; g.M[ring] = M_CAP; g.HF[ring] = HWALL
    for sgn in (-1, 1):
        for sp in (-1, 1):
            a0 = sp * (math.asin(GH / RM) + 0.5 / RM)
            w0, p0 = RM * math.sin(a0), sgn * RM * math.cos(a0)
            pier = (np.abs(W - w0) <= 0.7) & (np.abs(P - p0) <= 0.75)
            g.H[pier] = PIER_H; g.M[pier] = M_CAP; g.HF[pier] = PIER_H; g.ID[pier] = 1
    sill = (R >= SILL[0]) & (R <= SILL[1]) & GATE
    g.H[sill] = 2; g.M[sill] = M_SILL; g.HF[sill] = 2
    return ring

# ---------------------------------------------------------------- H: the breaches and the fallen blocks
CH, LB, G0 = 4, 13.0, 20.0    # course height, block length along the wall, where the lowest course stops off the breach's middle

def breaches(g, ring):
    # the stepped ends: each course stops at a joint, further back the higher it is
    ends = {}
    for bi in (0, 1):
        for side in (0, 1):
            for half in (0, 1):
                m = ring & (BI == bi) & (SIDE == side) & ((RR >= 0) == bool(half)) & (AB < 110)
                r = rng(bi, side, half, 11)
                alive = m.copy(); h = np.zeros((N, N), np.int16)
                es = []
                for cc in range(4):
                    off = (cc % 2) * LB / 2
                    e = G0 + cc * 5 + r.uniform(0, 7) + (3 if half == 0 else 0)
                    e = math.ceil((e - off) / LB) * LB + off
                    es.append(e)
                    alive &= AB >= e
                    h[alive] = (cc + 1) * CH
                ends[(bi, side, half)] = es
                # a top block knocked off further along
                if r.uniform() < 0.75:
                    off = LB / 2
                    j = math.ceil((es[3] + 14 + r.uniform(0, 20) - off) / LB)
                    a0 = j * LB + off
                    h[m & (AB >= a0) & (AB < a0 + LB)] = 3 * CH
                g.H[m] = h[m]
    g.HF[ring] = g.H[ring]
    g.M[ring & (g.H < HWALL)] = M_STONE
    return ends

def fallen(g, ends):
    for bi in (0, 1):
        z = Zone(bi)
        for side in (0, 1):
            sg = 1 if side else -1
            r = rng(bi, side, 23)
            eo = ends[(bi, side, 1)]; ei = ends[(bi, side, 0)]
            def drop(x0, y0, hl, hw, th, bh):
                # the way in stays open: a block that would lie in the lane is rolled
                # off it, along the wall, to its own side
                for _ in range(8):
                    mk, u, v = rect(z, x0, y0, hl, hw, th)
                    inn = sg * z.x[mk]
                    if not inn.size or inn.min() >= LANE: break
                    x0 += sg * (LANE - inn.min() + 0.5)
                if not mk.any(): return
                under = g.H[z.iy[mk], z.ix[mk]]
                low = under[under <= 9]
                base = int(low.max()) if low.size else 0
                if base > 0 and r.uniform() < 0.5: base = max(0, base - 1)
                tilt = (u[mk] / hl) * r.uniform(-0.8, 0.8)
                g.put(z.iy[mk], z.ix[mk], base + bh, M_BLOCK, g.new_id(), hf=base + bh + tilt)
            # the pile at the foot of each end, outside: a block on a block
            for k in range(5):
                x0 = sg * (eo[0] - 4 + r.uniform(-2, 18)); y0 = 13 + r.uniform(0, 10)
                drop(x0, y0, r.uniform(4.5, 6.5), r.uniform(2.6, 3.6), r.uniform(-0.8, 0.8), 4)
            # ...and inside, against the inner face
            for k in range(2):
                x0 = sg * (ei[0] + r.uniform(-2, 12)); y0 = -(13 + r.uniform(0, 5))
                drop(x0, y0, r.uniform(4.5, 6.0), r.uniform(2.6, 3.2), r.uniform(-0.6, 0.6), 4)
            # two that rolled further out
            for k in range(2):
                x0 = sg * r.uniform(14, 40); y0 = r.uniform(28, 44)
                drop(x0, y0, r.uniform(4.5, 6.0), r.uniform(2.6, 3.4), r.uniform(-1.2, 1.2), 4)

# ---------------------------------------------------------------- shading
LIGHT = np.array([-0.88, -0.48])
L3 = np.array([-0.55, -0.45, 0.70]); L3 = L3 / np.linalg.norm(L3)

def stone_tone(lum):
    return np.where((lum > 0.25)[:, None], COL['lit'], np.where((lum > -0.3)[:, None], COL['mid'], COL['dark']))

def arch(out, sel, u, z, aw, ah, water):
    # u: px across the opening from its centre, z: px up the face from its foot
    e = (u / aw) ** 2 + (z / ah) ** 2
    mouth = sel & (e <= 1)
    ring = sel & (e > 1) & ((u / (aw + 2)) ** 2 + (z / (ah + 2)) ** 2 <= 1)
    key = ring & (np.mod(np.round(np.degrees(np.arctan2(z, u)) / 22.5), 2) == 0)
    out[ring] = COL['lit']; out[key] = COL['mid']
    out[mouth] = COL['under']
    out[mouth & ((u / aw) ** 2 + ((z - 1) / max(ah - 2, 1)) ** 2 <= 0.55) & (z > 2)] = COL['wet']
    wet = np.broadcast_to(np.asarray(water, bool), mouth.shape)
    out[mouth & wet & (z <= 1)] = COL['deep']
    out[mouth & wet & (z <= 1) & (h2(u * 1.0, z * 3.0) > 0.55)] = COL['foam']

def culverts(c, out):
    # an arch the creek's width wherever the wall crosses the water: the inner
    # face upstream (the side seen from inside, its foot on the ice), the outer
    # face down, the current running out of it
    gy, sx, z = c['gy'], c['sx'], c['z']
    n = CN[gy, sx]
    sel = ~c['top'] & (np.abs(n) < CREEK_HW + 0.4) & (R[gy, sx] > RI - 0.3)
    arch(out, sel, n * T, z * 1.0, CREEK_HW * T + 1, 12.0, W[gy, sx] > 0)
    ic = ~c['top'] & (z >= HWALL - 4) & (z < HWALL - 1) & (h2(sx * 1.0, 5.0) > 0.82)
    out[ic] = COL['icicle']

def paint_tops(c, out):
    mt, mat = c['top'], c['mat']
    # the snow on the wall's top, a stone peeking where it thins
    th = vnoise(c['xw'] / 5.0 + 1.3, c['yw'] / 5.0 + 9.1)
    peek = (th > 0.82) & (c['hh'] < 0.5)
    col = np.where(peek[:, None], COL['lit'], np.where((c['hh'] < 0.05)[:, None], COL['snowD'], COL['snow']))
    m = mt & (mat == M_CAP); out[m] = col[m]
    # the sills: big quiet slabs, snow lying in clumps
    xw, yw = c['xw'], c['yw']
    d1, d2 = xw - yw, xw + yw
    row = np.floor_divide(d2, 12)
    joint = (np.mod(d1 + (row % 2) * 9, 18) == 0) | (np.mod(d2, 12) == 0)
    slab = h2(np.floor_divide(d1 + (row % 2) * 9, 18) * 1.0, row * 1.0)
    col = np.where((slab < 0.35)[:, None], COL['mid2'], COL['mid'])
    col = np.where(joint[:, None], COL['jt'], col)
    sn = vnoise(xw / 7.0 + 3.1, yw / 7.0 + 7.7) * 0.75 + c['hh'] * 0.12
    col = np.where((sn > 0.86)[:, None], COL['snow'], col)
    m = mt & (mat == M_SILL); out[m] = col[m]
    # a broken course's top: the cut blocks, their joints, snow lying on every step
    cc = np.clip(c['h'] // CH - 1, 0, 3)
    off = (cc % 2) * LB / 2
    jt = (np.mod(np.floor(c['a'] - off), LB) == 0) | (np.abs(c['rr']) < 0.6)
    sn = vnoise(c['xw'] / 4.0 + 2.1, c['yw'] / 4.0 + 6.3)
    col = np.where((sn < 0.3)[:, None], COL['lit'], np.where((c['hh'] < 0.1)[:, None], COL['snowD'], COL['snow']))
    col = np.where(jt[:, None], COL['jt'], col)
    m = mt & (mat == M_STONE); out[m] = col[m]
    # a fallen block: snow on its top, darker where it tilts from the sun
    col = np.where((c['hh'] < 0.08)[:, None], COL['snowD'], COL['snow'])
    col = np.where((c['lumT'] < 0.55)[:, None], COL['snowD'], col)
    m = mt & (mat == M_BLOCK); out[m] = col[m]

def paint_faces(c, out):
    mf, mat = ~c['top'], c['mat']
    z, lum = c['z'], c['lum']
    cc = z // CH
    off = (cc % 2) * LB / 2
    course = np.mod(z, CH) == 0
    jnt = np.mod(np.floor(c['a'] - off), LB) == 0
    tone = h2(np.floor((c['a'] - off) / LB) * 1.0 + cc * 7.0, (c['rr'] > 0) * 3.0 + c['sb'] // 200)
    col = stone_tone(lum)
    col = np.where(((tone < 0.35) & (lum > -0.3) & (lum <= 0.25))[:, None], COL['mid2'], col)
    col = np.where((np.mod(z, CH) == CH - 1)[:, None] & (lum > -0.3)[:, None], COL['lit'], col)  # each course's arris catches the light
    col = np.where(((course | jnt) & (lum > -0.3))[:, None], COL['dark'], col)
    col = np.where(((course | jnt) & (lum <= -0.3))[:, None], COL['rim'], col)
    col = np.where(((z == c['h'] - 1) & (c['h'] >= HWALL))[:, None], COL['snow'], col)
    m = mf & ((mat == M_CAP) | (mat == M_STONE)); out[m] = col[m]
    # a fallen block's sides: the stone, dark at its foot, snow along its top edge
    col = stone_tone(lum)
    col = np.where((z == 0)[:, None], COL['rim'], col)
    col = np.where((z == c['h'] - 1)[:, None], COL['snow'], col)
    m = mf & (mat == M_BLOCK); out[m] = col[m]
    # the sill's two-px edge
    m = mf & (mat == M_SILL); out[m] = stone_tone(lum)[m]
    culverts(c, out)

def shade(g):
    img = np.zeros((N, N, 4), np.uint8)
    hit, top, GY, Z = raycast(g)
    b = blur(g.H.astype(np.float32), 2)
    gy_, gx_ = np.gradient(b)
    nf = np.stack([-gx_, -gy_], -1); nf /= np.maximum(np.linalg.norm(nf, axis=-1, keepdims=True), 1e-6)
    hf = blur(g.HF, 1)
    ty_, tx_ = np.gradient(hf)
    n3 = np.stack([-tx_, -ty_, np.ones_like(tx_)], -1); n3 /= np.linalg.norm(n3, axis=-1, keepdims=True)
    sy, sx = np.nonzero(hit)
    gy = GY[sy, sx]; z = Z[sy, sx]
    c = dict(sy=sy, sx=sx, gy=gy, z=z, top=top[sy, sx], mat=g.M[gy, sx], h=g.H[gy, sx],
             lum=nf[gy, sx] @ LIGHT, lumT=n3[gy, sx] @ L3, xw=sx + X0, yw=gy + Y0,
             a=AB[gy, sx], sb=SB[gy, sx], rr=RR[gy, sx])
    c['hh'] = h2(c['xw'] * 1.0, c['yw'] * 1.0)
    out = np.zeros((len(sy), 3), np.uint8)
    paint_tops(c, out); paint_faces(c, out)
    img[sy, sx, :3] = out; img[sy, sx, 3] = 255
    # inner lines: where two parts meet on screen, ink the one further back
    SID = np.full((N, N), -1, np.int32); SID[sy, sx] = g.ID[gy, sx]
    SGY = np.full((N, N), -1, np.int32); SGY[sy, sx] = gy
    a, b_ = SID[1:, :], SID[:-1, :]
    d = (a != b_) & (a >= 0) & (b_ >= 0)
    back_up = d & (SGY[:-1, :] < SGY[1:, :])
    img[:-1, :][back_up, :3] = COL['rim']
    img[1:, :][d & ~back_up, :3] = COL['rim']
    a, b_ = SID[:, 1:], SID[:, :-1]
    d = (a != b_) & (a >= 0) & (b_ >= 0)
    back_l = d & (SGY[:, :-1] < SGY[:, 1:])
    img[:, :-1][back_l, :3] = COL['rim']
    img[:, 1:][d & ~back_l, :3] = COL['rim']
    # ink round everything
    edge = np.zeros_like(hit)
    edge[1:, :] |= hit[1:, :] & ~hit[:-1, :]
    edge[:-1, :] |= hit[:-1, :] & ~hit[1:, :]
    edge[:, 1:] |= hit[:, 1:] & ~hit[:, :-1]
    edge[:, :-1] |= hit[:, :-1] & ~hit[:, 1:]
    img[edge, :3] = COL['rim']
    # a shadow on the ground to the south-east, as long as each thing is tall
    sh = np.zeros((N, N), bool)
    for k in range(1, int(int(g.H.max()) * 0.62) + 1):
        dx, dy = int(round(k * 0.9)), int(round(k * 0.5))
        src = g.H > k / 0.62
        s = np.zeros_like(src); s[dy:, dx:] = src[:N - dy, :N - dx]; sh |= s
    sh &= ~hit
    img[sh] = SHADE
    return img, hit, GY, sh

# ---------------------------------------------------------------- the bake
def paint():
    g = Field()
    ring = ring_base(g)
    fallen(g, breaches(g, ring))
    img, hit, GY, sh = shade(g)
    flat = sh | (hit & (g.M[np.clip(GY, 0, N - 1), np.arange(N)[None, :]] == M_SILL))
    solid = (g.H > 0) & (g.M != M_SILL)
    return img, hit, GY, flat, solid

def check_ways(solid):
    # every way in is open to a body: along each breach's and each gate's middle
    # line, from outside the rubble to the ice, the nearest solid px stays clear
    ys, xs = np.nonzero(solid)
    out = []
    for name, ang, need in (('north', -QB, LANE), ('east', QB, LANE), ('south', math.pi - QB, LANE), ('west', -math.pi + QB, LANE),
                            ('BLUE gate', 0.0, 2 * T), ('RED gate', math.pi, 2 * T)):
        worst = 1e9
        for rr in np.arange(RI - 1.5, RO + 3.5, 0.05):
            w, p = rr * math.sin(ang), rr * math.cos(ang)
            fx, fy = (w + p) / S2 + C, (w - p) / S2 + C
            x, y = (fx + 0.5) * T - X0, (fy + 0.5) * T - Y0
            worst = min(worst, float(np.min(np.hypot(xs + 0.5 - x, ys + 0.5 - y))))
        out.append((name, round(worst, 1)))
        if worst < need: raise SystemExit('the %s way in is %.1f px from the stone, wants %d' % (name, worst, need))
    return out

# ---- the writer: rows of palette chars, run-length coded ("3a" = aaa, "." = nothing)
CH_SET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+/:;<=>?@^_~'

def css(c):
    return '#%02x%02x%02x' % tuple(c[:3]) if c[3] == 255 else 'rgba(%d,%d,%d,%s)' % (c[0], c[1], c[2], ('%.3f' % (c[3] / 255)).rstrip('0'))

def rle(row):
    s, i = [], 0
    while i < len(row):
        j = i
        while j < len(row) and row[j] == row[i]: j += 1
        s.append((j - i, row[i]))
        i = j
    if s and s[-1][1] == '.': s.pop()          # a row's trailing nothing is left off
    return ''.join((str(n) if n > 1 else '') + ch for n, ch in s)

def grid(img, mask, pal, x0, y0, x1, y1):
    rows = []
    for y in range(y0, y1):
        r = []
        for x in range(x0, x1):
            r.append(pal[tuple(img[y, x])] if mask[y, x] else '.')
        rows.append(rle(''.join(r)))
    return rows

def pieces(cols, gap=6):
    # the separate runs of occupied columns, merged across gaps narrower than `gap`
    xs = np.nonzero(cols)[0]
    if not xs.size: return []
    out, a, b = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - b > gap: out.append((a, b + 1)); a = x
        b = x
    out.append((a, b + 1))
    return out

def write(img, hit, GY, flat, solid):
    stand = hit & ~flat
    keys = sorted({tuple(img[y, x]) for y, x in zip(*np.nonzero(stand | flat))})
    if len(keys) > len(CH_SET): raise SystemExit('too many inks: %d' % len(keys))
    pal = {k: CH_SET[i] for i, k in enumerate(keys)}
    lines = []
    # the flat layer, cut to its own box
    ys, xs = np.nonzero(flat)
    fb = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    flat_rows = grid(img, flat, pal, *fb)
    # the standing pieces: by ground band, then by separate run of columns
    segs = []
    for g0 in range(0, N, BAND):
        m = stand & (GY >= g0) & (GY < g0 + BAND)
        if not m.any(): continue
        for a, b in pieces(m.any(0)):
            mm = np.zeros_like(m); mm[:, a:b] = m[:, a:b]
            ys = np.nonzero(mm.any(1))[0]
            y0, y1 = int(ys.min()), int(ys.max()) + 1
            segs.append((g0 + FOOT, int(a), y0, grid(img, mm, pal, int(a), y0, int(b), y1)))
    # the footprint, as runs: off, on, off, on, ... per row of its box
    ys, xs = np.nonzero(solid)
    sb = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    runs = []
    for y in range(sb[1], sb[3]):
        d = np.diff(np.concatenate([[0], solid[y, sb[0]:sb[2]].astype(np.int8), [0]]))
        edges = np.nonzero(d)[0]
        runs.append(','.join(str(int(n)) for n in np.diff(np.concatenate([[0], edges]))))
    q = lambda s: "'" + s + "'"
    out = [
        "'use strict';",
        '// THE CISTERN at the middle of the map (the `cistern` banner, js/sim/cistern.js), look H CUT',
        '// BLOCKS (docs/media/concepts/cistern-concepts-4.png). SPRITES.cistern =',
        '//   rb     px from the crossing to the box every x, y below is measured from',
        '//   geo    the ring the art was painted on, in tiles (reach: the farthest stone or shadow): the sim reads it here',
        '//   flat   { x, y, c }: what lies on the ground (the sills, every shadow), laid into the ground canvas',
        '//   segs   [{ k, x, y, c }]: the standing stone cut by ground row; k is its y-sort key, box px',
        '//   solid  { x, y, w, h, runs }: the footprint, per row the runs off, on, off, ... (js/sim/cistern.js)',
        '// The canvases are run-length rows of palette chars: "3a" is three of ink a, "." nothing.',
        '// GENERATED by app/bake-cistern/paint.py - repaint and rebake, never edit these rows.',
        '(() => {',
        '  const PAL = { ' + ', '.join("'%s': '%s'" % (ch, css(k)) for k, ch in pal.items()) + ' };',
        '  // one canvas off its rows, a run at a time',
        '  const bake = (rows) => {',
        '    let w = 1;',
        '    const runs = rows.map((r) => {',
        '      const o = [];',
        '      let x = 0;',
        '      for (let i = 0; i < r.length;) {',
        '        let n = 0;',
        '        while (r.charCodeAt(i) >= 48 && r.charCodeAt(i) <= 57) n = n * 10 + r.charCodeAt(i++) - 48;',
        '        n = n || 1;',
        "        if (r[i] !== '.') o.push(x, n, PAL[r[i]]);",
        '        x += n; i++;',
        '      }',
        '      if (x > w) w = x;',
        '      return o;',
        '    });',
        "    const c = document.createElement('canvas');",
        "    c.width = w; c.height = rows.length;",
        "    const g = c.getContext('2d');",
        '    runs.forEach((o, y) => { for (let i = 0; i < o.length; i += 3) { g.fillStyle = o[i + 2]; g.fillRect(o[i], y, o[i + 1], 1); } });',
        '    return c;',
        '  };',
        '  const seg = (k, x, y, rows) => ({ k, x, y, c: bake(rows) });',
        '  SPRITES.cistern = {',
        '    rb: %d,' % RB,
        '    geo: { ri: %s, ro: %s, gh: %s, sillIn: %s, sillOut: %s, ice: %s, frozen: %s, creekHW: %s, lane: %d, reach: %s },' % (
            RI, RO, GH, round(SILL[0], 3), round(SILL[1], 3), ICE_R, FROZEN_R, CREEK_HW, LANE, round(float(R[solid | flat].max()), 2)),
        '    flat: { x: %d, y: %d, c: bake([' % (fb[0], fb[1]),
    ]
    for r in flat_rows: out.append('      ' + q(r) + ',')
    out.append('    ]) },')
    out.append('    segs: [')
    for k, x, y, rows in segs:
        out.append('      seg(%d, %d, %d, [%s]),' % (k, x, y, ', '.join(q(r) for r in rows)))
    out.append('    ],')
    out.append('    solid: { x: %d, y: %d, w: %d, h: %d, runs: [' % (sb[0], sb[1], sb[2] - sb[0], sb[3] - sb[1]))
    for r in runs: out.append('      ' + q(r) + ',')
    out.append('    ] },')
    out.append('  };')
    out.append('})();')
    with open(OUT, 'w', newline='\n') as f: f.write('\n'.join(out) + '\n')
    return len(pal), len(segs), fb, sb

if __name__ == '__main__':
    img, hit, GY, flat, solid = paint()
    ways = check_ways(solid)
    npal, nseg, fb, sb = write(img, hit, GY, flat, solid)
    print('wrote', os.path.relpath(OUT), '-', npal, 'inks,', nseg, 'pieces, flat', fb, 'solid', sb)
    print('ways in (px clear of stone):', ', '.join('%s %s' % w for w in ways))
    if '--png' in sys.argv:
        from PIL import Image
        Image.fromarray(img, 'RGBA').save(sys.argv[sys.argv.index('--png') + 1])
