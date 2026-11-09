# What a ruler can tell about a sprite before an eye looks at it.
# Measured on today's deer, bear, rabbit, wolf and on the rejected camp and snow beast rounds:
# no number here tells liked art from rejected art (the deer has more lone pixels than the
# rejected boar). What sinks a sprite is its drawing, and only an eye reads that: the SHAPE row
# of the board and the blind read (app/art/blind.py). So a FAIL here is only a fault that is
# certain whoever looks (it melts into snow, it is the wrong size, the side cannot be read), a
# WARN is a place to look, and a pass means nothing more than "now look at it".
#   python3 app/art/check.py sprite.png [--kind big|pack|hero|prop] [--head x0,y0,x1,y1]
#                            [--detail #rrggbb,...] [--team #rrggbb,...] [--json]
# Exit 1 when a FAIL line prints.
import sys, json
import numpy as np
from PIL import Image

SNOW, DIRT = (208, 221, 244), (150, 134, 110)   # the two grounds a sprite stands on, sampled from a frame
HERO_H = 16                                     # a hero's body, px: the game's ruler


def L(rgb):
    rgb = np.asarray(rgb, dtype=float)
    return (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) / 255


def measure(im, head=None, detail=(), team=()):
    a = np.asarray(im.convert('RGBA'))
    op = a[..., 3] > 127
    ys, xs = np.where(op)
    if not len(ys):
        return {'empty': True}
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    H, W = op.shape
    rgb = a[..., :3]
    lum = L(rgb)
    key = (rgb[..., 0].astype(int) << 16) | (rgb[..., 1].astype(int) << 8) | rgb[..., 2]
    key[~op] = -1
    cols = [c for c in np.unique(key) if c >= 0]
    pad = lambda m, v: np.pad(m, 1, constant_values=v)
    opp = pad(op, False)
    n4 = [opp[:-2, 1:-1], opp[2:, 1:-1], opp[1:-1, :-2], opp[1:-1, 2:]]            # up, down, left, right
    edge = op & ~(n4[0] & n4[1] & n4[2] & n4[3])                                     # the shape's own border pixels
    inner = op & ~edge
    # a lone pixel: no neighbour of its colour on any of the 8 sides
    kp = pad(key, -2)
    same = np.zeros_like(op)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            if dy == 1 and dx == 1:
                continue
            same |= kp[dy:dy + H, dx:dx + W] == key
    dkeys = {int(c[1:], 16) for c in detail}
    lone = op & ~same & ~np.isin(key, list(dkeys))
    # distance in from the border, capped: for the pillow test
    dist = np.zeros(op.shape, int)
    cur = edge.copy(); seen = edge.copy(); d = 0
    while cur.any() and d < 6:
        dist[cur] = d
        cp = pad(cur, False)
        grow = (cp[:-2, 1:-1] | cp[2:, 1:-1] | cp[1:-1, :-2] | cp[1:-1, 2:]) & op & ~seen
        seen |= grow; cur = grow; d += 1
    dist[op & ~seen] = d
    dark = lum[op].min()
    ink = edge & (lum <= dark + 0.14)
    m = {
        'w': int(x1 - x0 + 1), 'h': int(y1 - y0 + 1), 'px': int(op.sum()), 'colours': len(cols),
        'heroes_tall': round((y1 - y0 + 1) / HERO_H, 2),
        'outline': round(float(ink.sum() / edge.sum()), 3),
        'lone': int(lone.sum()), 'lone_pct': round(float(lone.sum() / op.sum() * 100), 2),
        'melts_snow': round(float((np.abs(lum[edge] - L(SNOW)) < 0.14).mean()), 3),
        'melts_dirt': round(float((np.abs(lum[edge] - L(DIRT)) < 0.10).mean()), 3),
        'touches_frame': bool(y0 == 0 or x0 == 0 or y1 == H - 1 or x1 == W - 1),
    }
    if inner.sum() > 12:
        li = lum[inner]
        m['value_range'] = round(float(np.percentile(li, 95) - np.percentile(li, 5)), 3)
        # pillow: light climbing with distance from the border on every side (a ball), not from one side
        di = dist[inner].astype(float)
        m['pillow'] = round(float(np.corrcoef(di, li)[0, 1]), 3) if di.std() > 0 and li.std() > 0 else 0.0
        # top light: the upper half of each column lighter than its lower half
        up, lo = [], []
        for x in range(x0, x1 + 1):
            col = np.where(inner[:, x])[0]
            if len(col) >= 4:
                mid = (col.min() + col.max()) / 2
                up.append(lum[col[col <= mid], x].mean()); lo.append(lum[col[col > mid], x].mean())
        m['top_light'] = round(float(np.mean(up) - np.mean(lo)), 3) if up else 0.0
        # tones: colours that each hold a real share of the inside (3% or more)
        ki = key[inner]
        m['tones'] = int(sum((ki == c).mean() >= 0.03 for c in cols))
    if head:
        hx0, hy0, hx1, hy1 = head
        m['head_share'] = round(float(op[hy0:hy1 + 1, hx0:hx1 + 1].sum() / op.sum()), 3)
    if team:
        tk = [int(c[1:], 16) for c in team]
        m['team_px'] = int(np.isin(key, tk).sum())
    return m


# what each kind must hold: (low, high) on a measure; None is open. Set from today's sprites.
SIZE = {'big': (26, 48), 'pack': (11, 22), 'hero': (14, 22), 'prop': (4, 96)}
RULES = [
    # measure, test, FAIL or WARN, what to do about it
    ('touches_frame', lambda v, k: not v, 'FAIL', 'the art touches the canvas edge: widen the canvas, the outline needs a pixel'),
    ('colours', lambda v, k: v <= 24, 'FAIL', 'more than 24 colours: cut to the ramps in the palette (today: deer 11, bear 7, wolf 7)'),
    ('outline', lambda v, k: v >= 0.80, 'FAIL', 'the border is not ink: under 80% of border pixels are the dark outline (today: 0.9-1.0)'),
    ('melts_snow', lambda v, k: v <= 0.10, 'FAIL', 'the border melts into snow: light pixels on the edge with no ink round them'),
    ('melts_dirt', lambda v, k: v <= 0.20, 'WARN', 'the border melts into the road earth: check the dirt frame'),
    ('lone_pct', lambda v, k: v <= 2.5, 'WARN', 'many lone pixels: on flat art they read as noise; join each to a cluster or name it a detail'),
    ('value_range', lambda v, k: v >= 0.18, 'WARN', 'flat: the inside spans too little light to dark; add a real shadow shape and a real light shape'),
    ('pillow', lambda v, k: v <= 0.45, 'WARN', 'pillow shading: light rises from every edge toward the middle; light one side (top-left) instead'),
    ('top_light', lambda v, k: v >= 0.0, 'WARN', 'lit from below: the lower half is lighter than the upper half'),
    ('tones', lambda v, k: v >= 3, 'WARN', 'fewer than 3 working tones: it will read as a flat cut-out beside the bear and deer'),
    ('head_share', lambda v, k: v >= (0.20 if k == 'hero' else 0.11), 'FAIL', 'the head is too small to hold a face at 1x (hero 20%+, beast 11%+ of the painted pixels)'),
    ('team_px', lambda v, k: v >= 16, 'FAIL', 'under 16 team-coloured pixels: the side cannot be read at a glance'),
]


def judge(m, kind):
    out = []
    lo, hi = SIZE[kind]
    if not lo <= m['h'] <= hi:
        out.append(('FAIL', 'h', m['h'], '%s art stands %d-%d px tall (a hero is %d); this is %d' % (kind, lo, hi, HERO_H, m['h'])))
    for name, ok, level, say in RULES:
        if name in m and not ok(m[name], kind):
            out.append((level, name, m[name], say))
    return out


def main(argv):
    if not argv or argv[0].startswith('--'):
        print('usage: python3 app/art/check.py sprite.png [--kind big|pack|hero|prop] [--head x0,y0,x1,y1] [--detail #hex,..] [--team #hex,..] [--json]')
        return 1
    f = argv[0]; o = dict(zip(argv[1::2], argv[2::2])) if '--json' not in argv else dict(zip([a for a in argv[1:] if a != '--json'][0::2], [a for a in argv[1:] if a != '--json'][1::2]))
    kind = o.get('--kind', 'prop')
    head = tuple(int(v) for v in o['--head'].split(',')) if '--head' in o else None
    m = measure(Image.open(f), head, tuple(o.get('--detail', '').split(',')) if o.get('--detail') else (), tuple(o.get('--team', '').split(',')) if o.get('--team') else ())
    bad = judge(m, kind)
    if '--json' in argv:
        print(json.dumps({'measures': m, 'faults': [dict(level=l, measure=n, value=v, fix=s) for l, n, v, s in bad]}))
    else:
        print(f, ' '.join('%s=%s' % kv for kv in m.items()))
        for l, n, v, s in bad:
            print('  %s %s=%s: %s' % (l, n, v, s))
        if not bad:
            print('  ok: nothing a ruler can fault. Now look at it.')
    return 1 if any(l == 'FAIL' for l, *_ in bad) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
