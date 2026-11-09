# One round of an asset: paint it, measure it, and build the board an eye judges it on.
#   python3 app/art/round.py <asset.py> [--frame] [--keep]
# <asset.py> is a painter written with px.py (see docs/dev/art.md). It holds:
#   KIND = 'big' | 'pack' | 'hero' | 'prop'       which size band it must stand in
#   def views(): return {'side': Art, ...}        each view on its own canvas
#   HEAD = {'side': (x0, y0, x1, y1)}             the head's box per view (optional; checks the face has room)
#   DETAIL = 'ew'                                 letters allowed to be single pixels (eye, glint)
#   TEAM = 'tT'                                   letters that wear the team colour (heroes)
#   VS = [('TODAY', 'old.png')]                   what to show it beside: today's sprite, the rejected one
#   REFS = 'hero,wolf,deer,bear'                  today's sprites standing in the game frame with it
# Writes beside the asset, in <asset>/now/: <view>.png (1x), <view>.txt (the grid, as the game
# takes it), checks.txt, board.png, and with --frame the real game frames (needs app/server.js).
# --keep also copies now/ to the next r<N>/, and the board shows the last kept round beside the
# new one, so each round is judged against the one before it.
import sys, os, glob, shutil, subprocess, importlib.util, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import check
from board import board


def main(argv):
    if not argv or argv[0].startswith('-'):
        print('usage: python3 app/art/round.py <asset.py> [--frame] [--keep]'); return 1
    src = os.path.abspath(argv[0]); name = os.path.splitext(os.path.basename(src))[0]
    spec = importlib.util.spec_from_file_location(name, src); M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
    root = os.path.join(os.path.dirname(src), name); now = os.path.join(root, 'now'); os.makedirs(now, exist_ok=True)
    kind = getattr(M, 'KIND', 'prop'); heads = getattr(M, 'HEAD', {})
    views = M.views()
    rounds = sorted(glob.glob(os.path.join(root, 'r[0-9]*')), key=lambda p: int(os.path.basename(p)[1:]))
    last = rounds[-1] if rounds else None
    report, fails, items, pngs = [], 0, [], []
    for v, a in views.items():
        png = os.path.join(now, v + '.png'); a.image().save(png); pngs.append(png)
        open(os.path.join(now, v + '.txt'), 'w').write(a.js(name + v.capitalize()))
        hexes = lambda letters: tuple(a.pal[c] for c in letters if a.pal.get(c))
        m = check.measure(a.image(), heads.get(v), hexes(getattr(M, 'DETAIL', '')), hexes(getattr(M, 'TEAM', '')))
        bad = check.judge(m, kind)
        fails += sum(l == 'FAIL' for l, *_ in bad)
        report.append('%s  %s' % (v, ' '.join('%s=%s' % kv for kv in m.items())))
        report += ['  %s %s=%s: %s' % b for b in bad] or ['  ok: nothing a ruler can fault. Now look at it.']
        if last and os.path.exists(os.path.join(last, v + '.png')):
            items.append(('%s %s' % (os.path.basename(last), v), os.path.join(last, v + '.png')))
        items.append(('new %s' % v, png))
    vs = [(n, os.path.join(os.path.dirname(src), f)) for n, f in getattr(M, 'VS', [])]
    frames = []
    if '--frame' in argv:
        out = os.path.join(now, 'frame.png')
        art = ','.join([f for _, f in vs if 'TODAY' not in _.upper() or True][:3] + pngs)
        r = subprocess.run(['node', os.path.join(HERE, 'stage.js'), '--out', out, '--art', art, '--refs', getattr(M, 'REFS', 'hero,wolf,deer,bear')], capture_output=True, text=True)
        line = [l for l in r.stdout.splitlines() if l.startswith('{')]
        if line:
            from PIL import Image
            J = json.loads(line[-1]); k = J['k']
            for sh in J['shots']:                     # keep the band the line-up stands in
                g = Image.open(sh['file']); gy = int(g.height * J['ground_y'])
                g.crop((0, max(0, gy - 62 * k), g.width, min(g.height, gy + 16 * k))).save(sh['file']); frames.append(sh['file'])
        else:
            report.append('  no game frame: ' + (r.stderr.strip().splitlines() or ['is node app/server.js running?'])[-1])
    board(os.path.join(now, 'board.png'), vs + items, title=name.upper() + ('  STAGED' if frames else ''), scale=getattr(M, 'SCALE', 8), frames=frames)
    open(os.path.join(now, 'checks.txt'), 'w').write('\n'.join(report) + '\n')
    print('\n'.join(report)); print(os.path.join(now, 'board.png'))
    if '--keep' in argv:
        nxt = os.path.join(root, 'r%d' % (int(os.path.basename(last)[1:]) + 1 if last else 1)); shutil.copytree(now, nxt); print('kept as', nxt)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
