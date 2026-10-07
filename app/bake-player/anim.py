# The two motions the doll paints for every class: the run (C SPRINT off
# docs/media/concepts/run-roll-concepts-1.png) and the dodge roll (A TUCK TUMBLE). Poses are
# bodies.py dicts; hands are offsets from the body's own resting hand, so one set of poses
# drives both bodies although the warrior stands a row taller on her blades.
import math
from doll import v3, Z, CE
from bodies import TURNED

TAU = 2 * math.pi


def smooth(u):
    u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)


# ---- the run: eight frames, two steps; the right foot strikes at frame 0, the left at 4
# (contact, down, pass, float, then the same off the other foot). Per view, because a 16 px
# body cannot show one stride both ways: side-on the legs scissor out past the coat on a
# narrow track; head-on they mostly lift, since a long stride toward the camera would step
# the near boot below the ground line.
RUN_N = 8
STANCE = 0.36                  # share of a foot's cycle on the snow
GAIT = {
    'side': dict(stride=2.6, lift=Z(1.5), lean=0.14, leg=1.2, track=0.55),
    'front': dict(stride=0.8, lift=Z(2.1), lean=0.05, leg=1.0, track=1.95),
}
# the body's bob in whole screen px, frame by frame: down onto each strike, a pixel of float
# off each push. Whole pixels, so the coat and the face never re-shade between frames.
BOB = [0, -1, 0, 1, 0, -1, 0, 1]


def foot_path(u, stride, lift):
    """one foot through its cycle from the strike: (fwd, up)"""
    if u < STANCE:
        return stride - 1.9 * stride * u / STANCE, 0.0
    k = (u - STANCE) / (1 - STANCE)
    x = -0.9 * stride + 1.9 * stride * smooth((k - 0.12) / 0.88)      # the heel kicks up first, then the knee drives
    z = lift * math.sin(math.pi * k) ** 0.8 * (1.0 if k < 0.5 else 1 - 0.7 * (k - 0.5))
    return x, z


def run(i, view):
    g = GAIT[view]
    ph = i / RUN_N
    p = dict(view=view, snap=True, lean=g['lean'], leg=g['leg'], bob=BOB[i % RUN_N] / CE,
             feet={}, hands={}, toe={}, epole=v3(-1, 0, -0.4), head=(TURNED if view == 'side' else 0.0, -0.12))
    for s in (1, -1):
        u = (ph + (0.5 if s > 0 else 0.0)) % 1.0
        x, z = foot_path(u, g['stride'], g['lift'])
        p['feet'][s] = v3(x + 0.25, g['track'] * s, z)
        # toe down as a foot leaves the snow behind, toe up as it reaches for the next strike
        p['toe'][s] = (0.55 * max(0.0, -x / g['stride']) * (1 if z > 0.05 else 0.4)
                       - 0.25 * max(0.0, x / g['stride']) * (z > 0.05)) if view == 'side' else 0.0
        # the arm swings against its leg: forward while that leg is back
        a = -math.cos(TAU * u)
        p['hands'][s] = v3(0.2 - 1.7 * a, -0.35, Z(0.3) + 0.7 * max(0.0, -a))
    # the pom lags a frame: up after a drop, squashed down after a rise
    lag = (BOB[(i - 1) % RUN_N] - BOB[i % RUN_N]) / CE
    # (side-on it trails behind the hat, as the standing frame wears it)
    p['pom'] = v3(-1.7 if view == 'side' else 0.0, 0, max(-0.8, min(0.8, 0.8 * lag)) - (0.35 if view == 'side' else 0.0))
    # a scarf tail streams out behind on the run, flapping a beat a step
    p['tail'] = 1.0 if view == 'side' else 0.6
    p['flap'] = TAU * 2 * ph
    return p


# ---- the run with the hands held: the same legs under a body whose hands are busy - a drawn
# bow or a wound-up blade, a meal, a cast, the shield. The arms rest at the sides as they do
# standing (the held thing is drawn in front of the body, as it is over the standing frame),
# and the body only dips onto each strike.
HOLD_BOB = [0, -1, 0, 0, 0, -1, 0, 0]


def hold(i, view):
    p = run(i, view)
    p['bob'] = HOLD_BOB[i % RUN_N] / CE
    p['lean'] = 0.06 if view == 'side' else 0.02
    p['head'] = (p['head'][0], -0.04)
    p['tail'] = 0.6 if view == 'side' else 0.4
    for s in (1, -1):
        p['hands'][s] = v3(0.5, -0.15, Z(0.2))
    p['epole'] = v3(-1, 0, 0)
    lag = (HOLD_BOB[(i - 1) % RUN_N] - HOLD_BOB[i % RUN_N]) / CE
    p['pom'] = v3(-1.7 if view == 'side' else 0.0, 0, max(-0.8, min(0.8, 0.8 * lag)) - (0.35 if view == 'side' else 0.0))
    return p


# ---- the roll: a crouch, a dive, the tucked ball (bodies.paint_ball) turning over once, and
# up out of a squat, spread over DODGE_T (js/player.js). The ball frames are the tucked body
# turned about its centre, so the light stays put while the body goes over under it.
BALL_ANGLES = list(range(90, 361, 30))          # the dive's end .. sitting curled again
# prog (0..1 through the roll) at which each beat starts: crouch, dive, the ball, the landing
BEAT = {'crouch': 0.0, 'dive': 0.09, 'ball': 0.2, 'squat': 0.84, 'rise': 0.92}


def crouch(view):
    """the wind-up: down over the knees, leaning in, the arms swinging through"""
    return dict(view=view, snap=True, bob=-1.2 / CE, lean=0.6, head=(TURNED if view == 'side' else 0.0, -0.35),
                feet={1: v3(-0.5, 1.7, 0), -1: v3(1.0, -1.7, 0)},
                hands={1: v3(2.1, -0.5, -Z(0.15)), -1: v3(2.1, -0.5, -Z(0.15))},
                epole=v3(-1, 0, 0.3), pom=v3(-0.5, 0, 0.3), tail=0.5)


def dive(view):
    """thrown forward off the back foot, flat out, the arms reaching for the snow ahead"""
    return dict(view=view, snap=True, bob=-1.6 / CE, lean=1.15, leg=1.2, head=(0.0, 0.35),
                feet={1: v3(-2.2, 1.5, 1.2), -1: v3(0.9, -1.5, 0)}, toe={1: 0.6, -1: 0.3},
                hands={1: v3(3.9, -0.8, -Z(1.15)), -1: v3(3.9, -0.8, -Z(1.15))},
                epole=v3(-0.5, 0, 1.0), pom=v3(-0.7, 0, 0.5), tail=0.9)


def squat(k, view):
    """landing out of the ball onto both feet, k from deep (1) to nearly up (0)"""
    return dict(view=view, snap=True, bob=-round(2.2 * k) / CE, lean=0.55 * k,
                head=(TURNED if view == 'side' else 0.0, -0.2 * k),
                feet={1: v3(0.45 * k + 0.2, 1.9, 0), -1: v3(0.45 * k + 0.2, -1.9, 0)},
                hands={1: v3(0.1 + 2.2 * k, -0.1, 0.3 * k), -1: v3(0.1 + 2.2 * k, -0.1, 0.3 * k)},
                epole=v3(-1, 0, 0.1), pom=v3(0.5 * k, 0, -0.4 * k), tail=0.3 * k)


def roll_poses(view):
    """the roll's frames in order, as ('pose', dict) or ('ball', angle in radians)"""
    return ([('pose', crouch(view)), ('pose', dive(view))] +
            [('ball', math.radians(a)) for a in BALL_ANGLES] +
            [('pose', squat(0.8, view)), ('pose', squat(0.35, view))])


def roll_starts():
    """the prog each roll frame starts at, frame for frame with roll_poses"""
    n = len(BALL_ANGLES)
    span = BEAT['squat'] - BEAT['ball']
    return ([BEAT['crouch'], BEAT['dive']] + [BEAT['ball'] + span * i / n for i in range(n)] +
            [BEAT['squat'], BEAT['rise']])
