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
        return b

    def flip(self):
        b = Art(self.w, self.h, self.pal)
        b.g = [row[::-1] for row in self.g]
        return b

    def trim(self, pad=0):
        ys = [y for y in range(self.h) if any(c != '.' for c in self.g[y])]
        xs = [x for x in range(self.w) if any(self.g[y][x] != '.' for y in range(self.h))]
        if not ys:
            return self
        x0, x1, y0, y1 = max(0, min(xs) - pad), min(self.w - 1, max(xs) + pad), max(0, min(ys) - pad), min(self.h - 1, max(ys) + pad)
        b = Art(x1 - x0 + 1, y1 - y0 + 1, self.pal)
        b.g = [row[x0:x1 + 1] for row in self.g[y0:y1 + 1]]
        return b

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
