# The sound for a cut: the take's own cues on the output frames they land on, rendered
# through the game's audio (audio.js), optionally under a song, muxed into the mp4.
#   python3 app/media/mix.py <take dir> <cut out.mp4> <final.mp4> [--song s.mp3] [--under 5] [--skip boom] [--add 7.5:defeat]
# A take frame shown twice rings once. --under puts the game that many dB under the song.
# --add t:cue adds a cue at t seconds of output (a defeat sting on the freeze).
import sys, os, json, argparse, subprocess
import imageio_ffmpeg
ap = argparse.ArgumentParser()
ap.add_argument('take'); ap.add_argument('video'); ap.add_argument('out')
ap.add_argument('--song'); ap.add_argument('--under', type=float, default=5.0)
ap.add_argument('--skip', default='boom'); ap.add_argument('--add', action='append', default=[])
A = ap.parse_args()
HERE = os.path.dirname(os.path.abspath(__file__)); W = os.path.dirname(os.path.abspath(A.video))
J = json.load(open(os.path.join(A.take, 'log.json'))); M = json.load(open(os.path.join(W, 'map.json')))
MAP, FPS, SKIP = M['map'], M['fps'], set(A.skip.split(','))
by = {}
for f, cue, arg in J['ev']:
    if cue not in SKIP: by.setdefault(f, []).append([cue, arg])
seen, cues = set(), []
for n, f in enumerate(MAP):
    if f is None or f in seen: continue
    seen.add(f)
    for cue, arg in by.get(f, []): cues.append([n / FPS, cue, arg])
for a in A.add:
    t, cue = a.split(':'); cues.append([float(t), cue, None])
cues.sort(key=lambda c: c[0])
cj, gw = os.path.join(W, 'cues.json'), os.path.join(W, 'game.wav')
json.dump(cues, open(cj, 'w'))
dur = len(MAP) / FPS
subprocess.run(['node', os.path.join(HERE, 'audio.js'), cj, gw, str(dur)], check=True)
ff = imageio_ffmpeg.get_ffmpeg_exe()
cmd = [ff, '-y', '-loglevel', 'error', '-i', A.video, '-i', gw]
if A.song:
    cmd += ['-i', A.song, '-filter_complex', f'[1:a]volume=-{A.under}dB[g];[2:a][g]amix=inputs=2:duration=first:normalize=0[a]', '-map', '0:v', '-map', '[a]']
else:
    cmd += ['-map', '0:v', '-map', '1:a']
cmd += ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', f'{dur:.3f}', A.out]
subprocess.run(cmd, check=True)
print('cues', len(cues), sorted({c[1] for c in cues}), '->', A.out)
