# The media kit's look: the game's 3x5 pixel font as video text, the game logo,
# the pixel Steam mark, and the frame treatments the Shorts use. Needs Pillow + numpy.
# Text rule: the game font at a whole-number scale, coloured, dark rim and a hard drop
# shadow, no box, at most two lines, never over a kill.
import re, os, io, base64
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FONT = dict(re.findall(r"'(.)': '([01]{15})'", open(os.path.join(ROOT, 'js', 'font.js'), encoding='utf8').read()))
for ch, g in {'"': '101101000000000', "'": '010010000000000', ':': '000010000010000', ',': '000000000010100', '.': '000000000000010'}.items():
    FONT.setdefault(ch, g)
COL = {'white': '#f4f7ff', 'gold': '#ffd34d', 'red': '#ff5a4a', 'cyan': '#7fe8ff', 'blue': '#6aa8e8', 'grey': '#b8c0cc'}
RIM = (14, 20, 44, 255)

def rgb(c):
    c = COL.get(c, c)
    return tuple(int(c[k:k + 2], 16) for k in (1, 3, 5))

def glyphs(lines, s, gap=1):
    # lines: [[(text, colour), ...], ...], each line centred; s: screen px per font px
    flat = [''.join(t for t, _ in l) for l in lines]
    wpx = max(len(l) * 4 - 1 for l in flat); hpx = len(lines) * 5 + (len(lines) - 1) * gap
    m = Image.new('RGBA', (wpx, hpx), (0, 0, 0, 0)); px = m.load()
    for li, l in enumerate(lines):
        ox = (wpx - (len(flat[li]) * 4 - 1)) // 2; oy = li * (5 + gap); i = 0
        for t, col in l:
            c = rgb(col) + (255,)
            for ch in t.upper():
                g = FONT.get(ch, FONT.get('?', '0' * 15))
                for p in range(15):
                    if g[p] == '1': px[ox + i * 4 + p % 3, oy + p // 3] = c
                i += 1
    return m.resize((wpx * s, hpx * s), Image.NEAREST)

def rimmed(g, rim=7, shadow=True):
    # a dark rim all round and a hard drop shadow carry an image over bright snow
    P = rim + 12; w, h = g.width + 2 * P, g.height + 2 * P
    a = Image.new('L', (w, h), 0); a.paste(g.split()[3], (P, P))
    ol = a.filter(ImageFilter.MaxFilter(2 * rim + 1))
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    if shadow:
        sh = Image.new('L', (w, h), 0); sh.paste(ol, (0, rim + 2)); im.paste((6, 10, 24, 150), (0, 0), sh)
    im.paste(RIM, (0, 0), ol)
    gl = Image.new('RGBA', (w, h), (0, 0, 0, 0)); gl.paste(g, (P, P))
    return Image.alpha_composite(im, gl)

def text(lines, s=16, gap=1, rim=7):
    # text([[('MISSION', 'red')], [('FAILED', 'red')]], s=26): a card to stamp() on a frame
    if isinstance(lines, str): lines = [[(lines, 'white')]]
    return rimmed(glyphs(lines, s, gap), rim)

def stamp(img, card, x, y, al=1.0, scale=1.0):
    # card centred on (x, y); al fades it; scale pops it (nearest, so pixels stay hard)
    if scale != 1.0: card = card.resize((max(1, int(card.width * scale)), max(1, int(card.height * scale))), Image.NEAREST)
    if al < 1: card = Image.merge('RGBA', card.split()[:3] + (card.split()[3].point(lambda v: int(v * max(0, al))),))
    b = img.convert('RGBA'); b.alpha_composite(card, (int(x - card.width // 2), int(y - card.height // 2)))
    return b.convert('RGB')

def game_logo(scale=4):
    src = open(os.path.join(ROOT, 'js', 'logodata.js'), encoding='utf8').read()
    lg = Image.open(io.BytesIO(base64.b64decode(re.search(r"base64,([^'\"]+)", src).group(1)))).convert('RGBA')
    return lg.resize((lg.width * scale, lg.height * scale), Image.NEAREST)

def steam_mark(scale=10):
    m = Image.open(os.path.join(HERE, 'steam-mark.png')).convert('RGBA')
    return rimmed(m.resize((m.width * scale, m.height * scale), Image.NEAREST), 6, shadow=False)

def drain(img, u):
    # colour and light leave the frame (u 0..1): the MISSION FAILED freeze
    return ImageEnhance.Brightness(ImageEnhance.Color(img).enhance(1 - 0.85 * u)).enhance(1 - 0.45 * u)

def card_bg(img):
    # the end card's background: the last frame drained, blurred and darkened
    return ImageEnhance.Brightness(drain(img, 1).filter(ImageFilter.GaussianBlur(14))).enhance(0.6)

def freeze(img, u=1.0):
    # a flash-forward freeze: colour drains toward a cold blue, a vignette closes in
    a = np.asarray(ImageEnhance.Color(img).enhance(1 - 0.7 * u)).astype(np.float32)
    a = a * (1 - 0.18 * u) + np.array([10, 18, 40]) * 0.18 * u
    H, W = a.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
    v = ((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2
    a *= (1 - 0.45 * u * np.clip(v - 0.35, 0, 1))[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
