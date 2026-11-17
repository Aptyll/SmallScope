# The pixel painter: an asset is drawn straight on the game's own pixel grid, in the game's own
# format (a palette of letters and rows of text), by flat shapes the author places on purpose.
# Nothing is lit by a formula and nothing is painted big and shrunk: every edge lands on a pixel
# the first time, so what the author sees at 8x is exactly what the game bakes.
#
#   from px import Art
#   a = Art(40, 28, PAL)                    # PAL: {'.': None, 'o': '#1a1420', 'f': '#8a5a3a', ...}
#   a.blob('f', [(4, 12), (10, 6), ...])    # a smooth closed shape through points (the mass)
#   a.blob('d', [...], only='f')            # a shadow shape, kept inside the fur it shades
#   a.rim('h', of='fF', side='top')         # one row of light where a mass meets the sky
#   a.patch(3, 8, ['.oo.', 'oeFo'])         # a hand-set block (faces); ' ' keeps what is there
#   a.outline('o')                          # ink round the whole shape, one pixel, outside it
#
# Order is paint order. `only` is the letters a shape may cover; without it, it covers anything.
# A pose is the same function called with other points, so a walk is redrawn, never rotated.
import math
from PIL import Image


def _hex(c):
    return tuple(int(c[k:k + 2], 16) for k in (1, 3, 5))


def lum(c):
    r, g, b = (_hex(c) if isinstance(c, str) else c)[:3]
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255


class Art:
    def __init__(self, w, h, pal, ox=0, oy=0):
        self.w, self.h, self.pal = w, h, dict(pal)
        self.ox, self.oy = ox, oy                    # added to every coordinate drawn: room to grow leftward
        self.pal.setdefault('.', None)
        self.g = [['.'] * w for _ in range(h)]

    # ------------------------------------------------------------ pixels
    def get(self, x, y):
        x, y = x + self.ox, y + self.oy
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'

    def put(self, ch, x, y, only=None):
        x, y = int(round(x)) + self.ox, int(round(y)) + self.oy
        if not (0 <= x < self.w and 0 <= y < self.h):
            return
        if ch not in self.pal:
            raise KeyError('letter %r is not in the palette' % ch)
        if only is None or self.g[y][x] in only:
            self.g[y][x] = ch

    # ------------------------------------------------------------ shapes
    def poly(self, ch, pts, only=None):
        """A filled straight-edged shape. A pixel is in when its centre is."""
        ys = [p[1] for p in pts]
        n = len(pts)
        for y in range(max(0, int(math.floor(min(ys)))), min(self.h, int(math.ceil(max(ys))) + 1)):
            cy = y + 0.5
            xs = []
            for i in range(n):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
                if (y0 <= cy < y1) or (y1 <= cy < y0):
                    xs.append(x0 + (cy - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for k in range(0, len(xs) - 1, 2):
                for x in range(int(math.ceil(xs[k] - 0.5)), int(math.floor(xs[k + 1] - 0.5)) + 1):
                    self.put(ch, x, y, only)
        return self

    @staticmethod
    def smooth(pts, closed=True, steps=10):
        """Points on the round curve through pts (Catmull-Rom). A point given twice is a corner."""
        n = len(pts)
        out = []
        rng = range(n) if closed else range(n - 1)
        for i in rng:
            p0, p1, p2, p3 = (pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]) if closed else \
                (pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, n - 1)])
            for s in range(steps):
                t = s / steps
                out.append(tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
                                        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t) for k in (0, 1)))
        if not closed:
            out.append(tuple(pts[-1]))
        return out

    def blob(self, ch, pts, only=None):
        """A filled round shape through the points, in order round the shape."""
        return self.poly(ch, self.smooth(pts), only)

    def ell(self, ch, cx, cy, rx, ry, only=None):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    self.put(ch, x, y, only)
        return self

    def rect(self, ch, x0, y0, x1, y1, only=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(ch, x, y, only)
        return self

    def line(self, ch, pts, only=None, curve=False):
        """A one-pixel line through pixel coordinates, with no doubled corners."""
        if curve:
            pts = self.smooth(pts, closed=False)
        px = []
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
            dx, dy = abs(x1 - x0), -abs(y1 - y0)
            sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
            err = dx + dy
            while True:
                if not px or px[-1] != (x0, y0):
                    px.append((x0, y0))
                if (x0, y0) == (x1, y1):
                    break
                e2 = 2 * err
                if e2 >= dy:
                    err += dy; x0 += sx
                if e2 <= dx:
                    err += dx; y0 += sy
        i = 1
        while i < len(px) - 1:  # drop the middle pixel of an L so a diagonal stays one pixel thick
            (ax, ay), (bx, by), (cx, cy) = px[i - 1], px[i], px[i + 1]
            if abs(ax - cx) == 1 and abs(ay - cy) == 1 and (bx == ax or bx == cx) and (by == ay or by == cy):
                del px[i]
            else:
                i += 1
        for x, y in px:
            self.put(ch, x, y, only)
        return self

    def patch(self, x, y, rows):
        """A hand-set block, top-left at x, y. A space keeps the pixel under it."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != ' ':
                    self.put(ch, x + i, y + j)
        return self

    # ------------------------------------------------------------ edges
    SIDES = {'top': (0, -1), 'bottom': (0, 1), 'left': (-1, 0), 'right': (1, 0)}

    def rim(self, ch, of, side='top', only=None, beyond=None):
        """One pixel of `ch` on the pixels of `of` whose neighbour on `side` is not `of`
        (or is one of `beyond`). The top rim of a mass is where the light lands."""
        dx, dy = self.SIDES[side]
        hit = []
        for y in range(-self.oy, self.h - self.oy):
            for x in range(-self.ox, self.w - self.ox):
                if self.get(x, y) in of:
                    nb = self.get(x + dx, y + dy)
                    if (nb in beyond) if beyond is not None else (nb not in of):
                        hit.append((x, y))
        for x, y in hit:
            self.put(ch, x, y, only)
        return self

    def outline(self, ch='o', diagonal=False):
        """Ink on every empty pixel that touches the shape: the outline sits outside the art."""
        nb = [(1, 0), (-1, 0), (0, 1), (0, -1)] + ([(1, 1), (-1, 1), (1, -1), (-1, -1)] if diagonal else [])
        hit = [(x, y) for y in range(-self.oy, self.h - self.oy) for x in range(-self.ox, self.w - self.ox)
               if self.get(x, y) == '.' and any(self.get(x + dx, y + dy) != '.' for dx, dy in nb)]
        for x, y in hit:
            self.put(ch, x, y)
        return self

    def top(self, x):
        """The highest painted row in column x (None if the column is empty)."""
        for y in range(-self.oy, self.h - self.oy):
            if self.get(x, y) != '.':
                return y
        return None

    def swap(self, pairs):
        """A copy with letters traded ({'t': 'r'}): the other team, a second coat."""
        b = Art(self.w, self.h, self.pal)
        b.g = [[pairs.get(c, c) for c in row] for row in self.g]
        b.ramps = dict(getattr(self, 'ramps', {}))
        return b

    def flip(self):
        b = Art(self.w, self.h, self.pal)
        b.g = [row[::-1] for row in self.g]
        b.ramps = dict(getattr(self, 'ramps', {}))
        return b

    def trim(self, pad=0):
        """Cut to the painted pixels, with `pad` clear pixels all round (added if the art ran to the canvas edge)."""
        ys = [y for y in range(self.h) if any(c != '.' for c in self.g[y])]
        xs = [x for x in range(self.w) if any(self.g[y][x] != '.' for y in range(self.h))]
        if not ys:
            return self
        x0, x1, y0, y1 = min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad
        b = Art(x1 - x0 + 1, y1 - y0 + 1, self.pal)
        b.g = [[self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.' for x in range(x0, x1 + 1)] for y in range(y0, y1 + 1)]
        b.ramps = dict(getattr(self, 'ramps', {}))
        return b

    # ------------------------------------------------------------ tone
    # A material is a ramp: its letters from dark to light. Once a mass is set flat in the ramp's
    # middle letter, light is laid over it by moving pixels along the ramp, so a shadow is always
    # the material's own darker colour and never a hex typed for the occasion.
    def ramp(self, name, letters, colours=None):
        """Name a ramp: its letters dark to light. With no colours it is the game's own material of
        that name (GAME, below); or give the colours, or one base colour for mkramp to build round."""
        if colours is None:
            if name not in GAME:
                raise KeyError('no game material %r: one of %s, or give the colours' % (name, ', '.join(sorted(GAME))))
            colours = GAME[name]
        elif isinstance(colours, str):
            colours = mkramp(colours, len(letters))
        if len(colours) != len(letters):
            raise ValueError('ramp %s: %d letters, %d colours' % (name, len(letters), len(colours)))
        for ch, c in zip(letters, colours):
            self.pal[ch] = c
        self.ramps = dict(getattr(self, 'ramps', {})); self.ramps[name] = letters
        return self

    def _ramp_of(self, ch):
        for letters in getattr(self, 'ramps', {}).values():
            if ch in letters:
                return letters
        return None

    def tone(self, ch, d):
        """The letter d steps lighter (d > 0) or darker than ch in its ramp; ch itself if it has none."""
        r = self._ramp_of(ch)
        return ch if r is None else r[max(0, min(len(r) - 1, r.index(ch) + d))]

    def _mass(self, of):
        """The pixels of a mass: `of` is a ramp name or a string of letters."""
        letters = getattr(self, 'ramps', {}).get(of, of)
        return letters, [(x, y) for y in range(-self.oy, self.h - self.oy) for x in range(-self.ox, self.w - self.ox) if self.get(x, y) in letters]

    def step(self, of, d, side=None, where=None, depth=1):
        """Move pixels of a mass d steps along their ramp.
        side='top'|'bottom'|'left'|'right': only the pixels within `depth` of that edge of the mass
        (the lit rim, the shadow under a belly). where=(x0, y0, x1, y1) or a function (x, y) -> bool."""
        letters, px = self._mass(of)
        inside = set(px)
        if side:
            dx, dy = self.SIDES[side]
            px = [(x, y) for x, y in px if any((x + dx * k, y + dy * k) not in inside for k in range(1, depth + 1))]
        if where is not None:
            f = where if callable(where) else (lambda x, y, b=where: b[0] <= x <= b[2] and b[1] <= y <= b[3])
            px = [(x, y) for x, y in px if f(x, y)]
        for x, y in px:
            self.put(self.tone(self.get(x, y), d), x, y)
        return self

    def model(self, of, fn, where=None):
        """Lay a form's light over a mass: fn(x, y) gives 0 (darkest) to 1 (lightest) and each pixel
        takes that step of its own ramp. The mask stays what you drew; only its tones change.
        Use the forms below (cyl_h, cyl_v, ball, slope) or your own function."""
        letters, px = self._mass(of)
        f = where if callable(where) or where is None else (lambda x, y, b=where: b[0] <= x <= b[2] and b[1] <= y <= b[3])
        for x, y in px:
            if f is not None and not f(x, y):
                continue
            r = self._ramp_of(self.get(x, y))
            if r:
                t = max(0.0, min(0.999, fn(x + 0.5, y + 0.5)))
                self.put(r[int(t * len(r))], x, y)
        return self

    def glint(self, pts, d=1):
        """Named pixels one step (or d) lighter: the hand-set highlights that finish a surface."""
        for x, y in pts:
            self.put(self.tone(self.get(x, y), d), x, y)
        return self

    def outline_by(self, default='o', own=None, lit=None, bare=()):
        """An outline that knows what it wraps. `own` maps a ramp name to its outline letter
        ({'leaf': 'd'}: a pine is ringed in dark green, not ink). With lit='top', ink that sits on
        top of a ramp in `own` takes that letter and the rest stays `default`: the top edge
        catches light, the underside stays heavy. `bare` names ramps that get no outline at all:
        snow lying on snow has no edge, and a line round it turns a drift into a plate."""
        own = own or {}
        skip = ''.join(self.ramps[n] for n in bare)
        by = {}
        for name, ch in own.items():
            for l in self.ramps[name]:
                by[l] = ch
        hit = []
        for y in range(-self.oy, self.h - self.oy):
            for x in range(-self.ox, self.w - self.ox):
                if self.get(x, y) != '.':
                    continue
                near = [(dx, dy, self.get(x + dx, y + dy)) for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1))]
                near = [n for n in near if n[2] != '.' and n[2] not in skip]
                if not near:
                    continue
                ch = default
                for dx, dy, c in near:
                    if c in by and (lit is None or (lit == 'top' and dy == 1)):
                        ch = by[c]; break
                hit.append((x, y, ch))
        for x, y, ch in hit:
            self.put(ch, x, y)
        return self

    # ------------------------------------------------------------ out
    def rows(self):
        return [''.join(r) for r in self.g]

    def image(self):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        px = im.load()
        for y in range(self.h):
            for x in range(self.w):
                c = self.pal[self.g[y][x]]
                if c:
                    px[x, y] = _hex(c) + (255,)
        return im

    def js(self, name):
        """The grid as the game takes it (js/sprites/): paste, then bake() with the palette."""
        used = sorted({c for r in self.g for c in r})
        pal = ',\n'.join("  '%s': %s" % (c, 'null' if self.pal[c] is None else "'%s'" % self.pal[c]) for c in used)
        return 'const %sPAL = {\n%s,\n};\nconst %s = [\n%s\n];\n' % (name.upper(), pal, name, '\n'.join("  '%s'," % r for r in self.rows()))

    @staticmethod
    def from_rows(rows, pal):
        a = Art(len(rows[0]), len(rows), pal)
        a.g = [list(r) for r in rows]
        return a


    @staticmethod
    def from_png(path, letters='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'):
        """Today's sprite as an Art you can edit: letters are given dark to light (app/art/cut.js saves the PNG)."""
        im = Image.open(path).convert('RGBA'); px = im.load()
        cols = sorted({px[x, y][:3] for y in range(im.height) for x in range(im.width) if px[x, y][3] > 127}, key=lum)
        if len(cols) > len(letters):
            raise ValueError('%s has %d colours: not a hand-set sprite' % (path, len(cols)))
        m = {c: letters[i] for i, c in enumerate(cols)}
        pal = {'.': None}; pal.update({m[c]: '#%02x%02x%02x' % c for c in cols})
        return Art.from_rows([''.join(m[px[x, y][:3]] if px[x, y][3] > 127 else '.' for x in range(im.width)) for y in range(im.height)], pal)


# ---------------------------------------------------------------- the game's materials
# Ramps the game already wears, dark to light, read off its own sprites and painters. A new sprite
# takes its colours from here before any hex is typed: that is what makes it belong to the frame
# it stands in. Where each comes from is beside it; if that source changes, change this.
GAME = {
    'pine':  ['#052122', '#0e3c36', '#184b3e', '#2e6c44', '#3a7c4d', '#67a584'],   # js/sprites/terrain.js TSPAL
    'snow':  ['#9db6cc', '#d3deed', '#f5f9fd', '#ffffff'],                         # js/draw/lakes.js: lee shade, drift, sunlit edge
    'ice':   ['#2f5578', '#4d7a99', '#78a2bf', '#a6cde2', '#c9e7f3', '#ffffff'],   # js/draw/lakes.js cracks, js/draw/ground.js ICE_*; the first is the outline
    'wood':  ['#412a1a', '#5a3f28', '#7a5636', '#966e46', '#a3794f', '#c9a27a'],   # app/bake-tower/tower.py wood, plank
    'stone': ['#30343f', '#4f5666', '#6b7486', '#8a93a4', '#a9b2c1'],              # app/bake-tower/tower.py stone
    'iron':  ['#1c2130', '#2a2e3a', '#4a5060', '#737b8c', '#9aa2b2'],              # app/bake-tower/tower.py iron
    'brass': ['#3e2a1e', '#5e4226', '#7a5a2e', '#b08a48', '#d8b870', '#f6e6a6'],   # js/sprites/beasts.js HLPAL h g G, a step added each end
    'fur':   ['#371c0f', '#512c1c', '#73472d', '#9a6a45', '#b27f57', '#c29068'],   # docs/media/new_media3, the rabbit Noah supplied
    'lamp':  ['#2c7f93', '#8ff0ff', '#eaffff'],                                     # HLPAL e, its glow on iron and its core
}


# ---------------------------------------------------------------- forms for Art.model
# Each returns fn(x, y) -> 0..1. The light is the world's: from above, and for things that never
# face the other way (props, buildings, terrain) from the left as well. A sprite the game mirrors
# to face left (every beast) is lit from straight above, or its light would swap sides with it.
def cyl_h(y0, y1, peak=0.25, lo=0.15, hi=0.8):
    """A barrel lying on its side between rows y0 and y1: lightest `peak` of the way down, darkest
    just above the bottom, a little light bounced back on the last row. hi stops short of the
    ramp's top letter on purpose: that one is the glint, and a glint is placed by hand."""
    def f(x, y):
        t = (y - y0) / max(1e-6, (y1 + 1 - y0))
        d = (t - peak) / (peak if t < peak else 1 - peak)          # -1 at the top, 0 at the peak, 1 at the bottom
        v = max(0.0, math.cos(d * math.pi / 2 * (0.75 if d < 0 else 1.0))) ** 1.3
        if t > 1 - 1.2 / (y1 + 1 - y0):
            v += 0.2
        return lo + (hi - lo) * v
    return f


def cyl_v(x0, x1, peak=0.25, lo=0.15, hi=0.8):
    """A standing post or trunk between columns x0 and x1, lit from the left."""
    g = cyl_h(x0, x1, peak, lo, hi)
    return lambda x, y: g(y, x)


def ball(cx, cy, r, lx=-0.5, ly=-0.65, lo=0.1, hi=0.85):
    """A sphere at (cx, cy): light from (lx, ly), up-left by default; lx=0 for a sprite that flips."""
    lz = 0.6; n = math.sqrt(lx * lx + ly * ly + lz * lz); lx, ly, lz = lx / n, ly / n, lz / n
    def f(x, y):
        u, v = (x - cx) / r, (y - cy) / r
        w = math.sqrt(max(0.0, 1 - u * u - v * v))
        return lo + (hi - lo) * max(0.0, u * lx + v * ly + w * lz)
    return f


def slope(x0, y0, x1, y1, a=0.2, b=0.9):
    """A flat face that runs from tone a at (x0, y0) to tone b at (x1, y1)."""
    dx, dy = x1 - x0, y1 - y0; L = dx * dx + dy * dy
    return lambda x, y: a + (b - a) * max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / L))


def mkramp(base, n=5, cool=250, warm=48):
    """A ramp of n colours, dark to light, round one base colour, the way the kept art's ramps run:
    shadows turn toward blue-violet and gain colour, lights turn toward yellow and lose it. Never
    a straight darken: that is what makes a sprite muddy. The base sits just above the middle."""
    import colorsys
    r, g, b = [v / 255 for v in _hex(base)]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    mid = (n - 1) // 2 if n % 2 else n // 2
    out = []
    def toward(h0, target, amt):
        d = ((target / 360 - h0 + 0.5) % 1) - 0.5
        return (h0 + d * amt) % 1
    for i in range(n):
        k = i - mid
        if k < 0:
            hh = toward(h, cool, 0.05 * -k); ss = min(1, s + 0.06 * -k); vv = v * (0.72 ** -k)
        else:
            hh = toward(h, warm, 0.06 * k); ss = s * (0.82 ** k); vv = min(1, v + (1 - v) * (1 - 0.62 ** k))
        out.append('#%02x%02x%02x' % tuple(int(round(c * 255)) for c in colorsys.hsv_to_rgb(hh, max(0, ss), max(0, min(1, vv)))))
    return out
