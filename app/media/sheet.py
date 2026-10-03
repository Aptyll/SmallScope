# A concept pick sheet: each candidate big on snow with its letter and name, its 1x and 2x
# sizes, then all of them pasted into a real game frame beside a player, at each size asked.
#   python3 app/media/sheet.py <sheet.json> <out.png>
# sheet.json:
#   {"title": "WINTER FLOWERS  32X32  ROUND 1", "scale": 8,
#    "items": [{"letter": "A", "name": "SNOWDROP", "png": "A.png"}, ...],        # 1x RGBA sprites
#    "game": {"still": "still.png", "info": "still.json",                          # still.js output and its JSON line
#             "foot": [0, 0], "gap": 36,                                           # first item's feet, world px from the centre
#             "sizes": [{"label": "1 TILE  2X DETAIL", "art": 0.5}, {"label": "TODAY'S PIXEL SIZE", "art": 1}]}}
# "art" is world px per art px; with the still at k device px per world px each art px is k * art
# screen px, which must be a whole number. Paths are relative to the json.
# Letters continue across rounds (A-C, then D-F). Hand it over with your pick, then wait.
import sys, os, json
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from look import glyphs, rgb

J = json.load(open(sys.argv[1])); OUT = sys.argv[2]; HERE = os.path.dirname(os.path.abspath(sys.argv[1]))
P = lambda p: os.path.join(HERE, p)
BG, SNOW, PAD, S = (18, 22, 34), rgb(J.get('bg', '#d0ddf4')), 28, J.get('scale', 8)
items = [(it['letter'], it['name'], Image.open(P(it['png'])).convert('RGBA')) for it in J['items']]
cw = max(im.width for _, _, im in items) * S; chh = max(im.height for _, _, im in items) * S
def on(im, s):
    b = Image.new('RGBA', im.size, SNOW + (255,)); b.alpha_composite(im); return b.convert('RGB').resize((im.width * s, im.height * s), Image.NEAREST)
def label(t, col='white', s=4): return glyphs([[(t, col)]], s)

blocks = []   # (image, label) rows under the candidates
G = J.get('game')
if G:
    still = Image.open(P(G['still'])).convert('RGB'); info = json.loads(open(P(G['info'])).read().strip().splitlines()[-1])
    k, cam, cen = info['k'], info['cam'], info['centre']
    for sz in G['sizes']:
        px = k * sz['art']
        if abs(px - round(px)) > 1e-6: raise SystemExit(f'size {sz["label"]}: {k} x {sz["art"]} is not a whole screen px per art px')
        px = int(round(px)); g = still.copy()
        xs = []
        for n, (_, _, im) in enumerate(items):
            fx = cen[0] + G['foot'][0] + n * G['gap']; fy = cen[1] + G['foot'][1]
            sx, sy = round((fx - cam[0]) * k), round((fy - cam[1]) * k)
            big = im.resize((im.width * px, im.height * px), Image.NEAREST)
            g.paste(big, (sx - big.width // 2, sy - big.height), big); xs.append(sx)
        top = min(round((cen[1] + G['foot'][1] - cam[1]) * k) - max(im.height for _, _, im in items) * px - 40, g.height)
        box = (max(0, min(xs) - 120 - (G['gap'] * k if info.get('player') else 0)), max(0, top), min(g.width, max(xs) + 120), min(g.height, round((cen[1] + G['foot'][1] - cam[1]) * k) + 40))
        crop = g.crop(box); blocks.append((crop.resize((crop.width * 2, crop.height * 2), Image.NEAREST), 'IN GAME  ' + sz['label']))

W = max(PAD + len(items) * (cw + PAD), max([b.width + 2 * PAD for b, _ in blocks] or [0]))
H = 80 + chh + 40 + max(im.height for _, _, im in items) * 2 + 60 + sum(b.height + 50 for b, _ in blocks) + PAD
sheet = Image.new('RGB', (W, H), BG)
t = label(J.get('title', ''), 'white', 5); sheet.paste(t, (PAD, 24), t)
y = 80
for n, (L, name, im) in enumerate(items):
    x = PAD + n * (cw + PAD)
    sheet.paste(on(im, S), (x, y))
    l = label(f'{L}  {name}', 'gold', 4); sheet.paste(l, (x, y + chh + 12), l)
    sheet.paste(on(im, 1), (x, y + chh + 48)); sheet.paste(on(im, 2), (x + im.width + 16, y + chh + 48))
y += chh + 48 + max(im.height for _, _, im in items) * 2 + 40
for b, lab in blocks:
    l = label(lab, 'grey', 3); sheet.paste(l, (PAD, y), l); y += 28
    sheet.paste(b, (PAD, y)); y += b.height + 22
sheet.crop((0, 0, W, y + PAD - 22)).save(OUT); print(OUT, (W, y + PAD - 22))
