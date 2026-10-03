# A storyboard: frames in a grid on a dark page, a pixel-font timecode and beat under each.
#   python3 app/media/board.py <out.png> "a.png|0.0  CATCH, SPLASH" "b.png|1.1  ROAR !" ... [--cols 3] [--w 360]
#   python3 app/media/board.py <out.png> --keep <dir> --fps 60 "0|CATCH" "68|ROAR" ...   (cut.py --keep frames;
#                                                    the timecode is written from the frame number)
# Before recording, board it from stills (rec.js --at, or still.js); after the cut, from its own frames.
import sys, os, argparse
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from look import glyphs

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('items', nargs='+')
ap.add_argument('--cols', type=int, default=3); ap.add_argument('--w', type=int, default=360)
ap.add_argument('--keep'); ap.add_argument('--fps', type=float, default=60)
A = ap.parse_args()
cells = []
for it in A.items:
    src, _, cap = it.partition('|')
    if A.keep:
        n = int(src); path = os.path.join(A.keep, f'keep_{n:04d}.png'); cap = f'{n / A.fps:.1f}  {cap}'
    else:
        path = src
    cells.append((Image.open(path).convert('RGB'), cap))
pw = A.w; ph = round(pw * cells[0][0].height / cells[0][0].width); capH, pad = 64, 24
rows = (len(cells) + A.cols - 1) // A.cols
page = Image.new('RGB', (pad + A.cols * (pw + pad), pad + rows * (ph + capH + pad)), (18, 22, 34))
for i, (im, cap) in enumerate(cells):
    x = pad + (i % A.cols) * (pw + pad); y = pad + (i // A.cols) * (ph + capH + pad)
    page.paste(im.resize((pw, ph), Image.LANCZOS), (x, y))
    if cap:
        g = glyphs([[(cap, 'grey')]], 3)
        if g.width > pw: g = g.resize((pw, round(g.height * pw / g.width)), Image.NEAREST)
        page.paste(g, (x + 4, y + ph + 20), g)
page.save(A.out); print(A.out, page.size)
