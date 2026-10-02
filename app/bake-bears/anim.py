# The bear's clips as poses for the puppet (bear.py). Each clip is a list of
# pose dicts; a clip's frame rate is the game's (ANIM_CLIPS, js/wildlife.js).
import math
from bear import HIPS

def F(k, x, y): return (k, (x, y))

# ---- idle: slow breathing, the head dipping to sniff and coming back up
IDLE_N = 6
def idle(f, n=IDLE_N):
    w = 2 * math.pi * f / n
    return dict(by=0.25 - 0.25 * math.cos(w), hump=0.35 * math.sin(w),
                hy=0.5 - 0.5 * math.cos(w), ha=-0.04 * (1 - math.cos(w)))

# ---- walk: the patrol pace, a lateral-sequence gait
WALK_N = 8
WALK_OFFS = {'NH': 0.0, 'NF': 0.25, 'FH': 0.5, 'FF': 0.75}
def walk(f, n=WALK_N, stride=2.2, lift=1.6):
    ph = f / n
    feet = {}
    for k, o in WALK_OFFS.items():
        t = (ph + o) % 1.0
        rx, ry = HIPS[k]['foot']
        if t < 0.6:                       # planted, sliding back under the body
            u = t / 0.6
            feet[k] = (rx - stride + 2 * stride * u, ry)
        else:                             # swinging forward, lifted
            u = (t - 0.6) / 0.4
            feet[k] = (rx + stride - 2 * stride * u, ry - lift * math.sin(math.pi * u))
    w = 2 * math.pi * ph
    return dict(feet=feet, by=0.3 * math.cos(2 * w), hump=0.35 * math.sin(w + 0.8),
                hx=-0.2 * math.sin(w + 1.6), hy=0.3 * math.cos(2 * w + 0.6))

# ---- run: the charge, a gallop. Hind pair then front pair, a moment of
# flight, the back rocking like a see-saw and the head held low and level.
RUN_N = 6
RUN_OFFS = {'NH': 0.0, 'FH': 0.1, 'NF': 0.45, 'FF': 0.55}
def run(f, n=RUN_N, stride=4.5, lift=3.0):
    ph = f / n
    feet = {}
    for k, o in RUN_OFFS.items():
        t = (ph + o) % 1.0
        rx, ry = HIPS[k]['foot']
        if t < 0.4:
            u = t / 0.4
            feet[k] = (rx - stride + 2 * stride * u, ry)
        else:
            u = (t - 0.4) / 0.6
            feet[k] = (rx + stride - 2 * stride * u, ry - lift * math.sin(math.pi * u))
    w = 2 * math.pi * ph
    return dict(feet=feet,
                by=-0.9 * max(0.0, math.sin(w + 2.2)),     # airborne between the pushes
                tilt=0.09 * math.sin(w + 0.4),             # front up as the hinds drive
                hump=0.6 * math.sin(w + 0.4),
                bx=-0.6 * math.sin(w),
                hx=-0.8, hy=0.6 - 0.4 * math.sin(w + 0.4), ha=-0.1 - 0.06 * math.sin(w + 0.4),
                jaw=0.25)

# ---- the rear-up: crouch, up on the hinds with a paw over the head and the
# jaw wide. Only the roar plays it (the wake-up), so standing up always means
# the camp has woken; the attacks below stay on all fours.
REAR = (29.0, 15.0)
RISE = [
    dict(by=0.8, tilt=-0.04, hy=0.8, ha=-0.08, jaw=0.3),                                           # crouch
    dict(piv=REAR, tilt=0.55, hy=-0.5, ha=0.35, jaw=0.6, paw_front=True, feet=dict([F('NF', 14, 9), F('FF', 9, 14)])),     # rising
    dict(piv=REAR, tilt=1.00, hy=-0.5, ha=0.80, jaw=1.3, paw_front=True, feet=dict([F('NF', 15, 6), F('FF', 17, 8)])),   # up on the hinds, roar
    dict(piv=REAR, tilt=1.05, hy=-0.8, ha=0.85, jaw=1.5, paw_front=True, feet=dict([F('NF', 14, 2), F('FF', 16, 6)])),   # held
]

# ---- roar: the wake-up. Rears up and roars, and comes back down.
ROAR = [RISE[0], RISE[1], RISE[2], RISE[3], RISE[3], RISE[2], RISE[1], RISE[0]]

# ---- the attacks: two moves on all fours, picked at random per blow
# (BEAR_ATTACKS, js/wildlife.js), each landing on frame ATTACK_STRIKE so
# the fight's timing is the same whichever plays. The wind-up is the tell.
ATTACK_STRIKE = 4

# bite: coils back with the head low, the jaw opens, then the whole bear
# lunges forward and snaps shut, shakes its head, and backs off
BITE = [
    dict(bx=1.6, by=0.6, hx=0.8, hy=1.0, ha=-0.12, jaw=0.3),                                       # 0 coil
    dict(bx=3.2, by=1.0, tilt=-0.05, hump=0.9, hx=1.2, hy=0.2, ha=0.18, jaw=0.9,                    # 1 deeper, head coming up
         feet=dict([F('NF', 19, 23), F('FF', 10, 23)])),
    dict(bx=3.4, by=0.9, tilt=-0.06, hump=1.0, hx=1.0, hy=-0.8, ha=0.38, jaw=1.9,                   # 2 jaw wide: the tell
         feet=dict([F('NF', 19, 23), F('FF', 10, 23)])),
    dict(bx=-2.4, by=-0.6, tilt=0.05, hx=-2.6, hy=0.4, ha=0.05, jaw=2.0,                            # 3 the lunge
         feet=dict([F('NF', 9, 20), F('FF', 3, 23)])),
    dict(bx=-4.6, by=0.3, hx=-3.6, hy=1.4, ha=-0.16, jaw=0.0,                                       # 4 SNAP
         feet=dict([F('NF', 7, 23), F('FF', 0, 23)]), fangs=(-6, 15)),
    dict(bx=-4.3, by=0.4, hx=-3.3, hy=1.0, ha=0.14, jaw=0.15, feet=dict([F('NF', 7, 23), F('FF', 0, 23)])),   # 5 shake
    dict(bx=-4.1, by=0.4, hx=-3.3, hy=1.5, ha=-0.18, jaw=0.15, feet=dict([F('NF', 7, 23), F('FF', 0, 23)])),  # 6 shake
    dict(bx=-2.2, by=0.2, hx=-1.6, hy=0.8, jaw=0.5, feet=dict([F('NF', 11, 23), F('FF', 3, 23)])),          # 7 backs off
    dict(bx=-0.9, hy=0.4, jaw=0.2, feet=dict([F('FF', 5, 23)])),                                             # 8
    dict(bx=-0.2),                                                                                           # 9 settle
]

# paw: the side swipe. Weight back, the near paw drawn up and back to the
# chest, then swept out flat in front with the claw trail, and planted
PAW = [
    dict(bx=1.2, by=0.4, hx=0.4, ha=-0.05, jaw=0.3),                                               # 0 weight back
    dict(bx=1.8, by=0.3, tilt=0.06, hump=0.8, hx=0.6, ha=0.05, jaw=0.6, paw_front=True, feet=dict([F('NF', 11, 8)])),   # 1 paw up and back
    dict(bx=2.2, tilt=0.10, hump=1.0, hx=0.8, hy=-0.2, ha=0.15, jaw=1.0, paw_front=True,                 # 2 cocked high: the tell
         feet=dict([F('NF', 7, 3)])),
    dict(bx=0.2, tilt=0.03, hx=-0.6, ha=0.0, jaw=1.1, paw_front=True, feet=dict([F('NF', 9, 14)]),       # 3 the sweep
         smear=[((16, 5), (8, 2), (4, 10), 1.0)]),
    dict(bx=-2.2, hx=-1.6, hy=0.4, ha=-0.08, jaw=1.2, paw_front=True, feet=dict([F('NF', -3, 17)]),      # 4 STRIKE
         smear=[((15, 3), (-1, 2), (-7, 18), 1.0)]),
    dict(bx=-2.6, by=0.3, hx=-1.8, hy=0.8, ha=-0.12, jaw=0.8, paw_front=True, feet=dict([F('NF', -4, 21)]),    # 5 follow-through
         smear=[((15, 3), (-1, 2), (-7, 18), 0.45)]),
    dict(bx=-2.0, by=0.3, hx=-1.2, hy=0.8, jaw=0.4, feet=dict([F('NF', 1, 23)]), dust=[(1, 23)]),        # 6 plant
    dict(bx=-1.2, by=0.2, hy=0.4, jaw=0.2, feet=dict([F('NF', 8, 23)])),                                 # 7 recover
    dict(bx=-0.4, feet=dict([F('NF', 13, 22.5)])),                                                       # 8
    dict(bx=-0.1),                                                                                       # 9 settle
]

# ---- fish: the river camp's catch. Head low over the water, a front paw up,
# watching; the paw scoops down into the water (the splash is the game's,
# riverFish, on FISH_STRIKE) and flips a fish up; the head snaps it out of
# the air, and the bear sits back and chews it down. The fish is a sticker
# (bear.py's FISH_*), carried by the paw or the jaw.
WATCH = dict(by=0.6, tilt=-0.05, hx=-1.4, hy=1.6, ha=-0.22, jaw=0.0)
POISED = dict(piv=REAR, tilt=0.28, hx=-0.6, hy=1.6, ha=-0.45, paw_front=True)   # front up, looking down its nose
FISH = [
    dict(WATCH, feet=dict([F('NF', 14, 22)])),                                                     # 0 head down, looking
    dict(POISED, feet=dict([F('NF', 8, 9), F('FF', 7, 23)])),                                      # 1 paw up
    dict(POISED, tilt=0.32, feet=dict([F('NF', 9, 7), F('FF', 7, 23)])),                           # 2 held: still as a rock
    dict(WATCH, bx=-1.4, hx=-2.0, hy=2.0, ha=-0.3, paw_front=True,                                 # 3 SCOOP into the water
         feet=dict([F('NF', -1, 22)]), dust=[(-2, 22)]),
    dict(WATCH, bx=-0.6, hx=-1.0, hy=0.6, ha=0.05, paw_front=True, feet=dict([F('NF', 4, 16)]),     # 4 flicked up
         fish=('air', -2, 6, 'V')),
    dict(by=0.2, hx=-0.8, hy=-0.8, ha=0.35, jaw=1.3, feet=dict([F('NF', 10, 22)]),                 # 5 the snap
         fish=('air', -3, 4, 'H')),
    dict(by=0.1, hx=-0.6, hy=-0.8, ha=0.35, jaw=0.4, fish=('jaw', 'H')),                           # 6 caught
    dict(by=0.2, hx=-0.4, hy=-0.6, ha=0.30, jaw=0.8, fish=('jaw', 'H2')),                          # 7 chew, the tail flaps
    dict(by=0.2, hx=-0.4, hy=-0.4, ha=0.24, jaw=0.3, fish=('jaw', 'T')),                           # 8
    dict(by=0.2, hx=-0.4, hy=-0.6, ha=0.30, jaw=0.8, fish=('jaw', 'T')),                           # 9 chew
    dict(by=0.2, hx=-0.2, hy=-0.2, ha=0.15, jaw=0.2),                                              # 10 down it goes
    dict(by=0.1, hy=0.3),                                                                          # 11 settle
]
FISH_STRIKE = 3           # the frame the paw hits the water

CLIPS = {
    'idle': [idle(f) for f in range(IDLE_N)],
    'walk': [walk(f) for f in range(WALK_N)],
    'run': [run(f) for f in range(RUN_N)],
    'bite': BITE,
    'paw': PAW,
    'roar': ROAR,
    'fish': FISH,
}
FPS = {'idle': 5, 'walk': 8, 'run': 12, 'bite': 14, 'paw': 14, 'roar': 10, 'fish': 8}   # what the game plays them at
