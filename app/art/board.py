# The review board: everything an eye needs to judge a round, in one picture.
#   python3 app/art/board.py out.png [--title T] [--scale 8] [--frame game.png ...] name=sprite.png ...
# For each sprite, left to right in the order given (put today's sprite or last round first):
# the art big on snow, on road earth, as a flat silhouette, and in greys; then every sprite at
# 1x and 2x in one row (the size a player sees). --frame adds real game frames (app/art/stage.js)
# under it, cropped to the middle band. Names are drawn in the game's font.
import sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'media'))
from look import glyphs

SNOW, DIRT, BG, INK = (208, 221, 244), (150, 134, 110), (18, 22, 34), (26, 20, 32)


def on(im, ground, s):
    b = Image.new('RGBA', im.size, ground + (255,)); b.alpha_composite(im)
    return b.convert('RGB').resize((im.width * s, im.height * s), Image.NEAREST)


def silhouette(im, s):
    a = np.asarray(im)[..., 3] > 127
    out = np.zeros(a.shape + (3,), np.uint8); out[:] = SNOW; out[a] = INK
    return Image.fromarray(out).resize((im.width * s, im.height * s), Image.NEAREST)


def greys(im, s):
    a = np.asarray(im).astype(float)
    l = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])
    snow = 0.2126 * SNOW[0] + 0.7152 * SNOW[1] + 0.0722 * SNOW[2]
    l = np.where(a[..., 3] > 127, l, snow).astype(np.uint8)
    return Image.fromarray(np.stack([l, l, l], -1)).resize((im.width * s, im.height * s), Image.NEAREST)


def board(out, items, title='', scale=8, frames=()):
    ims = [(n, Image.open(f).convert('RGBA')) for n, f in items]
    pad = 2
    ims = [(n, ImageOpsPad(im, pad)) for n, im in ims]
    S = scale
    colw = [max(im.width * S, len(n) * 4 * 3) + 16 for n, im in ims]
    rowh = max(im.height for _, im in ims) * S + 12
    views = [('ON SNOW', lambda im: on(im, SNOW, S)), ('ON ROAD', lambda im: on(im, DIRT, S)), ('SHAPE', lambda im: silhouette(im, S)), ('GREYS', lambda im: greys(im, S))]
    left = 88
    small_h = max(im.height for _, im in ims) * 2 + 36
    fr = []
    for f in frames:
        fr.append(Image.open(f).convert('RGB'))
    W = max(left + sum(colw) + 16, max([g.width + 32 for g in fr] + [0]))
    H = 56 + len(views) * rowh + small_h * 2 + sum(g.height + 16 for g in fr) + 24
    B = Image.new('RGB', (W, H), BG)
    if title:
        B.paste(glyphs([[(title, 'white')]], 4), (16, 14), glyphs([[(title, 'white')]], 4))
    y = 48
    x = left
    for (n, im), cw in zip(ims, colw):
        t = glyphs([[(n, 'gold')]], 3); B.paste(t, (x, y - 2), t); x += cw
    y += 22
    for label, fn in views:
        t = glyphs([[(label, 'grey')]], 2); B.paste(t, (12, y + 4), t)
        x = left
        for (n, im), cw in zip(ims, colw):
            B.paste(fn(im), (x, y)); x += cw
        y += rowh
    for s, label, ground in ((1, 'AT 1X', SNOW), (2, 'AT 2X', SNOW), (1, '1X ROAD', DIRT), (2, '2X ROAD', DIRT)):
        if s == 1 and ground == DIRT:
            y += 0
        t = glyphs([[(label, 'grey')]], 2)
        yy = y + (0 if ground == SNOW else small_h) + (0 if s == 1 else 0)
        xx = left if s == 1 else left + sum(im.width + 10 for _, im in ims) + 40
        B.paste(t, (xx, yy), t)
        strip_w = sum(im.width * s + 10 for _, im in ims)
        strip = Image.new('RGB', (strip_w, max(im.height for _, im in ims) * s), ground)
        cx = 4
        for n, im in ims:
            g = on(im, ground, s); strip.paste(g, (cx, strip.height - g.height)); cx += g.width + 10 - (0)
        B.paste(strip, (xx, yy + 14))
    y += small_h * 2
    for g in fr:
        B.paste(g, (16, y)); y += g.height + 16
    B.save(out)
    return out


def ImageOpsPad(im, p):
    b = Image.new('RGBA', (im.width + 2 * p, im.height + 2 * p), (0, 0, 0, 0)); b.paste(im, (p, p)); return b


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) < 2:
        print('usage: python3 app/art/board.py out.png [--title T] [--scale 8] [--frame game.png ...] name=sprite.png ...'); sys.exit(1)
    out, title, scale, frames, items = a[0], '', 8, [], []
    i = 1
    while i < len(a):
        if a[i] == '--title': title = a[i + 1]; i += 2
        elif a[i] == '--scale': scale = int(a[i + 1]); i += 2
        elif a[i] == '--frame': frames.append(a[i + 1]); i += 2
        else:
            n, f = a[i].split('=', 1); items.append((n.upper(), f)); i += 1
    board(out, items, title, scale, frames)
    print(out)
