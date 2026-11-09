# The blind read: the author knows what the sprite is meant to be, so the author's eye cannot
# test whether it reads. This lays sprites out as numbered tiles with no names, shuffled, at
# the size a player sees (and the flat shape under each), for a reader who has never seen the
# brief to name. The key stays in a separate file.
#   python3 app/art/blind.py out.png [--scale 3] [--seed 1] sprite.png ...
# Writes out.png and out.key.json ({"1": "boar/now/side.png", ...}). Hand ONLY out.png to a
# fresh reader (a subagent with no context, or a person) with the questions in
# .claude/skills/pixel-art/SKILL.md, then compare the answers with the key.
import sys, os, json, random
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'media'))
from look import glyphs

SNOW, INK, BG = (208, 221, 244), (26, 20, 32), (18, 22, 34)


def main(a):
    if len(a) < 2:
        print('usage: python3 app/art/blind.py out.png [--scale 3] [--seed 1] sprite.png ...'); return 1
    out, scale, seed, files = a[0], 3, 1, []
    i = 1
    while i < len(a):
        if a[i] == '--scale': scale = int(a[i + 1]); i += 2
        elif a[i] == '--seed': seed = int(a[i + 1]); i += 2
        else: files.append(a[i]); i += 1
    random.Random(seed).shuffle(files)
    ims = [Image.open(f).convert('RGBA') for f in files]
    cw = max(im.width for im in ims) * scale + 24; ch = max(im.height for im in ims) * scale + 20
    cols = min(len(ims), 4); rows = -(-len(ims) // cols)
    B = Image.new('RGB', (cols * cw + 16, rows * (ch * 2 + 34) + 16), BG)
    for n, im in enumerate(ims):
        x = 16 + (n % cols) * cw; y = 16 + (n // cols) * (ch * 2 + 34)
        t = glyphs([[(str(n + 1), 'gold')]], 3); B.paste(t, (x, y), t)
        for row, flat in ((0, False), (1, True)):
            tile = Image.new('RGBA', (cw - 16, ch), SNOW + (255,))
            g = im
            if flat:
                m = np.asarray(im)[..., 3] > 127; arr = np.zeros(m.shape + (4,), np.uint8); arr[m] = INK + (255,); g = Image.fromarray(arr)
            g = g.resize((im.width * scale, im.height * scale), Image.NEAREST)
            tile.alpha_composite(g, ((tile.width - g.width) // 2, tile.height - g.height - 6))
            B.paste(tile.convert('RGB'), (x, y + 20 + row * (ch + 4)))
    B.save(out)
    json.dump({str(n + 1): f for n, f in enumerate(files)}, open(os.path.splitext(out)[0] + '.key.json', 'w'), indent=1)
    print(out)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
