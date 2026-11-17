# The bench: the sprite you are drawing, big enough to count its pixels, beside the art it must
# stand next to. Every tile is the same zoom on the same real snow, with a ruler down two sides,
# so "row 7, column 12" in the picture is row 7, column 12 of the grid you edit.
#   python3 app/art/bench.py out.png [--scale 16] [--ground snow.png] [--grid 0] name=sprite.png ...
# from px import Art;  bench.save('out.png', [('today', art_or_png), ('new', art)])
# A name ending in '!' gets no ruler (a neighbour you only look at).
import sys, os
from PIL import Image, ImageDraw

SNOW, BG, TICK = (208, 221, 244), (18, 22, 34), (120, 132, 160)


def _text(d, xy, s, fill):
    """tiny digits for the rulers: a 3x5 font, so the bench needs nothing installed"""
    G = {'0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
         '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111'}
    x, y = xy
    for ch in str(s):
        g = G.get(ch)
        if g:
            for i, b in enumerate(g):
                if b == '1':
                    d.point((x + i % 3, y + i // 3), fill)
        x += 4


def _img(a):
    if isinstance(a, str):
        return Image.open(a).convert('RGBA')
    return a.image() if hasattr(a, 'image') else a.convert('RGBA')


def tile(a, scale=16, ground=None, ruler=True, grid=True, gy=0):
    im = _img(a); pad = 2
    W, H = im.width + 2 * pad, im.height + 2 * pad
    if ground is not None:
        g = ground.crop((0, gy, W, gy + H)).convert('RGBA')
    else:
        g = Image.new('RGBA', (W, H), SNOW + (255,))
    g.alpha_composite(im, (pad, pad))
    big = g.convert('RGB').resize((W * scale, H * scale), Image.NEAREST)
    m = 12 if ruler else 0
    out = Image.new('RGB', (big.width + m, big.height + m), BG); out.paste(big, (m, m))
    if grid and scale >= 8:                                    # a faint line every pixel, a firmer one every five
        ov = Image.new('RGBA', out.size, (0, 0, 0, 0)); do = ImageDraw.Draw(ov)
        for x in range(W + 1):
            do.line([(m + x * scale, m), (m + x * scale, m + big.height)], fill=(40, 50, 90, 60 if (x - pad) % 5 == 0 else 22))
        for y in range(H + 1):
            do.line([(m, m + y * scale), (m + big.width, m + y * scale)], fill=(40, 50, 90, 60 if (y - pad) % 5 == 0 else 22))
        out = Image.alpha_composite(out.convert('RGBA'), ov).convert('RGB')
    d = ImageDraw.Draw(out)
    if ruler:
        for x in range(im.width):
            if x % 2 == 0:
                _text(d, (m + (x + pad) * scale + scale // 2 - 3, 3), x, TICK)
        for y in range(im.height):
            _text(d, (1, m + (y + pad) * scale + scale // 2 - 2), y, TICK)
    return out


def save(out, items, scale=16, ground=None, grid=True, small=(1, 2, 4)):
    """items: [(name, Art | png path | Image)]. Under the big tiles, every sprite at the sizes a player sees."""
    g = Image.open(ground).convert('RGB') if isinstance(ground, str) else ground
    ims = [(n, _img(a)) for n, a in items]
    tiles = [tile(im, scale, g, ruler=not n.endswith('!'), grid=grid and not n.endswith('!')) for n, im in ims]
    gap = 14
    W = sum(t.width + gap for t in tiles) + gap
    rows = []
    for k in small:
        w = sum(im.width * k + 6 * k for _, im in ims) + 8 * k; h = max(im.height for _, im in ims) * k + 6 * k
        base = (g.crop((0, 0, w // k + 1, h // k + 1)).resize(((w // k + 1) * k, (h // k + 1) * k), Image.NEAREST).crop((0, 0, w, h)) if g is not None else Image.new('RGB', (w, h), SNOW)).convert('RGBA')
        x = 4 * k
        for _, im in ims:
            b = im.resize((im.width * k, im.height * k), Image.NEAREST); base.alpha_composite(b, (x, h - 3 * k - b.height)); x += b.width + 6 * k
        rows.append(base.convert('RGB'))
    W = max(W, max(r.width for r in rows) + 2 * gap)
    H = gap + max(t.height for t in tiles) + gap + sum(r.height + gap for r in rows)
    B = Image.new('RGB', (W, H), BG); x = gap
    top = max(t.height for t in tiles)
    for t in tiles:
        B.paste(t, (x, gap + top - t.height)); x += t.width + gap
    y = gap + top + gap
    for r in rows:
        B.paste(r, (gap, y)); y += r.height + gap
    B.save(out)
    return out


if __name__ == '__main__':
    argv = sys.argv[1:]
    if not argv:
        print('usage: python3 app/art/bench.py out.png [--scale 16] [--ground snow.png] name=sprite.png ...'); sys.exit(1)
    out, scale, ground, items = argv[0], 16, None, []
    i = 1
    while i < len(argv):
        if argv[i] == '--scale': scale = int(argv[i + 1]); i += 2
        elif argv[i] == '--ground': ground = argv[i + 1]; i += 2
        else:
            n, f = argv[i].split('=', 1); items.append((n, f)); i += 1
    print(save(out, items, scale, ground))
