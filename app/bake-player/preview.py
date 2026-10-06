# A contact sheet of what bake.py would write: every run and roll frame of both classes in
# each facing, in both team paints, on snow, big. For judging a rig change before baking.
#
#   python app/bake-player/preview.py out.png [scale]
import sys
from PIL import Image
from bodies import BODIES
from bake import frames, CELL_X, CELL_Y

# the palettes the grids bake through in the game (js/sprites/characters.js, core.js)
PPAL = {
    'o': '#2e2440', 'k': '#f2c69b', 'K': '#d69f72', 'e': '#2e2440', 'x': '#e8967f', 'p': '#463c5c',
    'b': '#6f4d38', 'B': '#4a3324', 'S': '#c8d8e8', 'g': '#203a52', 'G': '#8fd8ff', 'h': '#5c3b20',
}
TEAMS = [
    dict(r='#c9524e', R='#df7358', d='#96393f', t='#3e8c81', T='#58ab98', m='#f6ecd4', M='#d9c5a0'),
    dict(r='#3f6fb0', R='#5e93d8', d='#2b4d7d', t='#cfe4f2', T='#f4faff', m='#e8f2fb', M='#bcd0e4'),
]
SNOW = (208, 221, 244, 255)


def image(grid, team):
    pal = dict(PPAL); pal.update(TEAMS[team])
    im = Image.new('RGBA', (len(grid[0]), len(grid)), SNOW); px = im.load()
    for y, row in enumerate(grid):
        for x, c in enumerate(row):
            if c != '.':
                v = pal[c]; px[x, y] = (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16), 255)
    return im


if __name__ == '__main__':
    out = sys.argv[1]; sc = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    rows = []
    for cls in BODIES:
        for kind in ('run', 'hold', 'roll'):
            for d in ('right', 'down', 'up'):
                for team in (0, 1):
                    rows.append([image(g, team) for g in frames(cls, kind, d)])
    fw, fh = rows[0][0].size
    n = max(len(r) for r in rows)
    sheet = Image.new('RGBA', (n * (fw + 2) + 2, len(rows) * (fh + 2) + 2), (18, 22, 34, 255))
    for j, r in enumerate(rows):
        for i, im in enumerate(r):
            sheet.paste(im, (2 + i * (fw + 2), 2 + j * (fh + 2)))
            # the 16 x 16 cell's corner, so the frame's anchoring can be read off the sheet
            sheet.putpixel((2 + i * (fw + 2) + CELL_X, 2 + j * (fh + 2) + CELL_Y), (255, 60, 200, 255))
    sheet.resize((sheet.width * sc, sheet.height * sc), Image.NEAREST).save(out)
    print(out, sheet.size)
