# Walk and attack poses for the bear puppet.
import math
from bear import HIPS

WALK_N = 8
OFFS = {'NH': 0.0, 'NF': 0.25, 'FH': 0.5, 'FF': 0.75}   # lateral-sequence gait

def walk(f, n=WALK_N, stride=2.0, lift=1.6):
    ph = f / n
    feet = {}
    for k, o in OFFS.items():
        t = (ph + o) % 1.0
        rx, ry = HIPS[k]['foot']
        if t < 0.6:                       # planted, sliding back under the body
            u = t / 0.6
            feet[k] = (rx - stride + 2 * stride * u, ry)
        else:                             # swinging forward, lifted
            u = (t - 0.6) / 0.4
            feet[k] = (rx + stride - 2 * stride * u, ry - lift * math.sin(math.pi * u))
    w = 2 * math.pi * ph
    return dict(feet=feet,
                by=0.45 * math.cos(2 * w),             # two dips per cycle
                hump=0.5 * math.sin(w + 0.8),          # shoulder rolls with the front legs
                tilt=0.025 * math.sin(w),
                hx=-0.3 * math.sin(w + 1.6), hy=0.5 * math.cos(2 * w + 0.6),
                ha=0.05 * math.sin(w))

def F(k, x, y): return (k, (x, y))

ATTACK = [  # rear up, swipe the near paw down, bite, recover
    dict(),
    dict(bx=1.0, by=-0.3, tilt=0.10, hy=-1.2, ha=0.18, jaw=0.4, feet=dict([F('NF', 14.0, 17.5)])),
    dict(bx=1.6, by=-0.6, tilt=0.20, hy=-1.8, ha=0.28, jaw=1.0, hump=0.6, feet=dict([F('NF', 11.0, 10.0)])),
    dict(bx=-1.8, by=0.4, tilt=-0.04, hx=-1.2, hy=0.6, ha=-0.12, jaw=1.3, paw_front=True, feet=dict([F('NF', 5.0, 19.5)])),
    dict(bx=-2.4, by=0.6, tilt=-0.07, hx=-1.6, hy=1.2, ha=-0.18, jaw=1.0, paw_front=True, feet=dict([F('NF', 4.5, 23.0)])),
    dict(bx=-1.6, by=0.4, tilt=-0.04, hx=-0.8, hy=0.8, ha=-0.08, jaw=0.4, feet=dict([F('NF', 9.5, 23.0)])),
    dict(bx=-0.7, by=0.2, hy=0.3, jaw=0.1, feet=dict([F('NF', 13.0, 22.2)])),
    dict(bx=-0.2, feet=dict([F('NF', 15.5, 23.0)])),
]
ATTACK_MS = [160, 110, 180, 60, 140, 110, 100, 120]
