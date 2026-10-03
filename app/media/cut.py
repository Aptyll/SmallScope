# Cut a recorded take into a finished video, driven by a cut.json.
#   python3 app/media/cut.py <take dir> <cut.json> <out.mp4> [--keep 0,60,240] [--preview 30]
# Shots name their ends by the take's own beats (rec.js log: marks), so a re-record re-cuts
# itself: "roar" is the first roar mark, "down#3" the third down, "roar+14" / "end-30" offsets,
# a bare number a take frame, "end" the last frame recorded.
# A focus is a tracked name ("bear"), a tracked name pinned at a beat ("bear@roar"), a fixed
# world point [x, y], or "mix:a,b,0.3" (30% from a toward b); ox/oy nudge it in world px.
# --keep saves those output frames as keep_NNNN.png (storyboard and thumbnail); --preview N
# saves every Nth as a small prev_NNNN.png to check a cut without watching it.
# Writes map.json beside the mp4: the take frame behind every output frame, for the sound.
import sys, json, os, math, argparse
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from look import text, stamp, drain, card_bg, game_logo, steam_mark
from view import view
import imageio_ffmpeg

ap = argparse.ArgumentParser()
ap.add_argument('take'); ap.add_argument('cut'); ap.add_argument('out')
ap.add_argument('--keep', default=''); ap.add_argument('--preview', type=int, default=0)
A = ap.parse_args()
J = json.load(open(os.path.join(A.take, 'log.json'))); R = J['rows']
C = json.load(open(A.cut))
S = C.get('S', J['S'])                     # canvas px per world px in the take
SIZE = tuple(C.get('size', [1080, 1920])); FPS = C.get('fps', 60)
OUTDIR = os.path.dirname(os.path.abspath(A.out))

def F(x):
    if isinstance(x, (int, float)): return int(x)
    s = x.replace(' ', '')
    for sep in ('+', '-'):
        i = s.rfind(sep)
        if i > 0: return F(s[:i]) + (1 if sep == '+' else -1) * int(s[i + 1:])
    if s == 'end': return len(R) - 1
    name, _, n = s.partition('#')
    if name not in J['marks']: raise SystemExit(f'no beat "{name}" in the take (marks: {", ".join(J["marks"])})')
    return J['marks'][name][int(n or 1) - 1]

def focus(spec, i):
    if isinstance(spec, list) and len(spec) == 2 and all(isinstance(v, (int, float)) for v in spec): return tuple(spec)
    if spec.startswith('mix:'):
        a, b, w = spec[4:].split(','); pa, pb = focus(a, i), focus(b, i); w = float(w)
        return (pa[0] + (pb[0] - pa[0]) * w, pa[1] + (pb[1] - pa[1]) * w)
    name, _, at = spec.partition('@')
    j = F(at) if at else i
    tr = R[j]['tr']
    if name not in tr: raise SystemExit(f'"{name}" is not tracked on frame {j} (tracked: {", ".join(tr)})')
    return tuple(tr[name][:2])

def pair(v, d=0):
    v = d if v is None else v
    return (v[0], v[1]) if isinstance(v, list) else (v, v)

def ease(kind, u):
    u = min(1, max(0, u))
    return u if kind == 'linear' else 1 - (1 - u) ** 2 if kind == 'out' else u * u * (3 - 2 * u)

cache = {}
def frame(i):
    if i not in cache:
        if len(cache) > 16: cache.clear()
        p = os.path.join(A.take, f'f{i:04d}.png')
        if not os.path.exists(p): raise SystemExit(f'take frame {i} was not recorded ({p})')
        cache[i] = Image.open(p).convert('RGB')
    return cache[i]

# sprites painted INTO the take frame at the game's pixel size (a "!" over a head):
# they then scale with every camera exactly as the world under them does
PAINT = []
for p in C.get('paint', []):
    g = Image.open(os.path.join(os.path.dirname(os.path.abspath(A.cut)), p['png'])).convert('RGBA')
    PAINT.append((F(p['from']), F(p['to']), g.resize((g.width * S, g.height * S), Image.NEAREST), p['on'], p.get('dx', 0), p.get('dy', -32)))
def painted(i):
    im = frame(i)
    for f0, f1, g, on, dx, dy in PAINT:
        if f0 <= i < f1:
            x, y = focus(on, i); cam = R[i]['cam']
            im = im.copy(); im.paste(g, (round((x + dx - cam[0]) * S - g.width / 2), round((y + dy - cam[1]) * S - g.height)), g)
    return im

wr = imageio_ffmpeg.write_frames(A.out, SIZE, fps=FPS, codec='libx264', pix_fmt_out='yuv420p', macro_block_size=8,
                                 output_params=['-preset', 'slow', '-crf', str(C.get('crf', 14))])
wr.send(None)
MAP, KEEP = [], {int(x) for x in A.keep.split(',') if x}
def emit(im, src=None):
    n = len(MAP)
    wr.send(np.ascontiguousarray(np.asarray(im)))
    MAP.append(src)
    if A.preview and n % A.preview == 0: im.resize((SIZE[0] // 4, SIZE[1] // 4), Image.BOX).save(os.path.join(OUTDIR, f'prev_{n:04d}.png'))
    if n in KEEP: im.save(os.path.join(OUTDIR, f'keep_{n:04d}.png'))

TEXTS = C.get('texts', [])   # {"shot": name, "from": out frames into it, "to": ..., "lines": ..., "s", "y"}
def overlay(im, shot, j):
    for t in TEXTS:
        if t['shot'] != shot or not (t.get('from', 0) <= j < t.get('to', 10 ** 9)): continue
        card = text(t['lines'], s=t.get('s', 16), gap=2)
        im = stamp(im, card, SIZE[0] / 2, t.get('y', 300), min(1, (j - t.get('from', 0) + 1) / 3))
    return im

last = None
for sh in C['shots']:
    i0, i1 = F(sh['from']), F(sh['to'])
    fc = sh.get('focus', sh.get('c'))
    f0, f1 = fc if isinstance(fc, list) and len(fc) == 2 and not all(isinstance(v, (int, float)) for v in fc) else (fc, fc)
    p0, p1 = focus(f0, i0), focus(f1, max(i0, i1 - 1))
    k0, k1 = pair(sh['k']); ox0, ox1 = pair(sh.get('ox'), 0); oy0, oy1 = pair(sh.get('oy'), 0)
    n = i1 - i0
    if n <= 0: raise SystemExit(f'shot {sh.get("name")} runs backward: {sh["from"]}={i0} to {sh["to"]}={i1}')
    for j in range(n):
        i = i0 + j; e = ease(sh.get('ease', 'smooth'), j / max(1, n - 1))
        k = math.exp(math.log(k0) + (math.log(k1) - math.log(k0)) * e)     # zoom in log space: an even push
        cx = p0[0] + ox0 + (p1[0] + ox1 - p0[0] - ox0) * e; cy = p0[1] + oy0 + (p1[1] + oy1 - p0[1] - oy0) * e
        emit(overlay(view(painted(i), R[i]['cam'], S, cx, cy, k, SIZE), sh.get('name'), j), i)
    last = (i1 - 1, cx, cy, k)
    print('shot', sh.get('name', ''), i0, i1, 'out', len(MAP))
NG = len(MAP)

E = C.get('end', {})
if last and 'freeze' in E:
    fz = E['freeze']; i, cx, cy, k = last; base = painted(i)
    for j in range(fz.get('frames', 126)):
        im = drain(view(base, R[i]['cam'], S, cx, cy, k * (1 + 0.03 * j / max(1, fz.get('frames', 126) - 1)), SIZE), min(1, j / 10))
        for t in fz.get('texts', []):
            if j >= t.get('at', 6): im = stamp(im, text(t['lines'], s=t.get('s', 26), gap=2), SIZE[0] / 2, t.get('y', 330), min(1, (j - t.get('at', 6) + 1) / 3))
        emit(im)
if last and 'card' in E:
    cd = E['card']; i, cx, cy, k = last
    bg = card_bg(view(painted(i), R[i]['cam'], S, cx, cy, k, SIZE))
    LOGO, STEAM = game_logo(4), steam_mark(11); Y = SIZE[1] / 1920   # laid out on a 1920-tall frame
    WL = text([[('WISHLIST', 'gold')], [('ON STEAM', 'gold')]], s=18, gap=2); LC = text(cd.get('line', 'LINK IN COMMENTS'), s=12)
    for j in range(cd.get('frames', 270)):
        im = stamp(bg, LOGO, SIZE[0] / 2, 300 * Y, min(1, (j + 1) / 4))
        if j >= 6: im = stamp(im, STEAM, SIZE[0] / 2, 700 * Y, min(1, (j - 5) / 3), 1 + 0.25 * max(0, 1 - (j - 6) / 6))
        if j >= 12: im = stamp(im, WL, SIZE[0] / 2, 1120 * Y, min(1, (j - 11) / 3))
        if j >= 24 and cd.get('line', 1): im = stamp(im, LC, SIZE[0] / 2, 1330 * Y, min(1, (j - 23) / 3))
        emit(im)
wr.close()
json.dump({'map': MAP, 'gameplay': NG, 'fps': FPS}, open(os.path.join(OUTDIR, 'map.json'), 'w'))
print('frames', len(MAP), 'seconds', round(len(MAP) / FPS, 2), 'gameplay', round(NG / FPS, 2))
