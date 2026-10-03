# GIFs, pixel-exact.
#   python3 app/media/gif.py <out.gif> f0.png f1.png ... [--scale 8] [--ms 110] [--crop x,y,w,h] [--bg #d0ddf4]
#   python3 app/media/gif.py <out.gif> --strip walk-1x.png --fw 48 [--scale 8] [--ms 110]   (a 1x frame strip)
#   python3 app/media/gif.py <out.gif> --mp4 cut.mp4 --from 2.0 --to 4.5 [--fps 20] [--width 540]   (a piece of a cut)
# Sprite frames scale whole-pixel (nearest); --bg flattens transparency onto a colour (snow by default
# for sprites, so the outline reads as it will in game). An mp4 piece goes through ffmpeg's palette pass.
import sys, os, argparse, subprocess
from PIL import Image
ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('frames', nargs='*')
ap.add_argument('--scale', type=int, default=8); ap.add_argument('--ms', type=int, default=110)
ap.add_argument('--crop'); ap.add_argument('--bg', default='#d0ddf4')
ap.add_argument('--strip'); ap.add_argument('--fw', type=int)
ap.add_argument('--mp4'); ap.add_argument('--from', dest='t0', type=float, default=0); ap.add_argument('--to', dest='t1', type=float)
ap.add_argument('--fps', type=int, default=20); ap.add_argument('--width', type=int, default=540)
A = ap.parse_args()

if A.mp4:
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    span = ['-ss', str(A.t0)] + (['-t', str(A.t1 - A.t0)] if A.t1 else [])
    vf = f'fps={A.fps},scale={A.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none'
    subprocess.run([ff, '-y', '-loglevel', 'error'] + span + ['-i', A.mp4, '-filter_complex', vf, '-loop', '0', A.out], check=True)
    print(A.out); sys.exit()

ims = [Image.open(f).convert('RGBA') for f in A.frames]
if A.strip:
    s = Image.open(A.strip).convert('RGBA'); fw = A.fw or s.height
    ims = [s.crop((x, 0, x + fw, s.height)) for x in range(0, s.width - fw + 1, fw)]
if A.crop:
    x, y, w, h = map(int, A.crop.split(',')); ims = [im.crop((x, y, x + w, y + h)) for im in ims]
bg = tuple(int(A.bg[k:k + 2], 16) for k in (1, 3, 5)) + (255,)
out = []
for im in ims:
    flat = Image.new('RGBA', im.size, bg); flat.alpha_composite(im)
    out.append(flat.convert('RGB').resize((im.width * A.scale, im.height * A.scale), Image.NEAREST))
out[0].save(A.out, save_all=True, append_images=out[1:], duration=A.ms, loop=0, disposal=1)
print(A.out, len(out), 'frames', out[0].size)
