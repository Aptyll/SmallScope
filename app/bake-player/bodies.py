# The two class bodies on the doll (doll.py): the HUNTER (pom beanie) and the WARRIOR
# (fur hood with goggles, a trailing scarf, skate blades). Their sizes are measured off the
# hand-drawn 16 px frames in js/sprites/characters.js, so the doll's idle lands on those
# frames pixel for pixel and the run and the roll it paints wear the same body.
#
# A pose (anim.py) is a dict: bob (body up, true px), lean (torso pitch), roll, head (yaw,
# pitch), feet {+1 left, -1 right: ground point, z = lift}, hands {side: offset from this
# body's resting hand}, pom (offset), toe {side: boot pitch}, kpole/epole (knee and elbow
# bend), leg (leg length scale), view ('side' or 'front') and snap (limbs on the pixel grid).
import math
import numpy as np
from doll import Canvas, Cam, Spun, v3, rot, Z, ik, decal, ink

TURNED = -0.42          # side-on the head turns toward the viewer, so the near eye shows


class Body:
    HIP_Y = 1.5
    LEG = (Z(1.3), Z(1.35))
    ARM = (Z(0.95), Z(0.9))
    HEAD_R = (2.85, 3.0, 2.7)
    HEAD_P = 3.0
    lift = 0.0          # how much higher this body stands than the hunter (the blades)

    def __init__(self):
        L = self.lift
        self.HIP_Z = Z(3.4 + L)
        self.ANKLE = Z(1.05 + L)
        self.SHOULDER = (0.0, 2.6, Z(5.2 + L))
        self.REST_HAND = v3(0.3, 3.2, Z(3.75 + L))
        self.REST_FEET = {1: v3(0.2, 2.0, 0), -1: v3(0.2, -2.0, 0)}
        parts = ['coat', 'hem', 'scarf', 'head', 'pom', 'tail', 'armL', 'armR', 'mittL', 'mittR',
                 'thighL', 'thighR', 'shinL', 'shinR', 'bootL', 'bootR', 'bladeL', 'bladeR', 'endL', 'endR']
        group = {'coat': 'body', 'hem': 'body', 'scarf': 'body', 'tail': 'body', 'endL': 'armL', 'endR': 'armR',
                 'head': 'head', 'pom': 'head'}
        for s in 'LR':
            for k in ('arm', 'mitt'): group[k + s] = 'arm' + s
            for k in ('thigh', 'shin', 'boot', 'blade'): group[k + s] = 'leg' + s
        # no ink inside one piece of clothing, between the head and the body (the scarf meets
        # the chin), or between a leg and the hem it hangs out of
        self.SOFT = {frozenset((a, b)) for a in parts for b in parts
                     if a != b and (group[a] == group[b] or {group[a], group[b]} == {'head', 'body'}
                                    or (group[a].startswith('leg') and group[b] == 'body')
                                    or (group[b].startswith('leg') and group[a] == 'body'))}
        # legs carry no outline, but where one crosses in front of the other the far one takes
        # an inner line, so a scissoring pair reads as two
        # the pom and the scarf's tail are bare, as on the hand-drawn frames
        self.NOOUT = {'thighL', 'thighR', 'shinL', 'shinR', 'bootL', 'bootR', 'bladeL', 'bladeR', 'pom', 'tail'}
        legs = ('thigh', 'shin', 'boot', 'blade')
        self.CROSS = {frozenset((a + 'L', b + 'R')) for a in legs for b in legs}
        self.TOPINK = set()
        self.FACE = [decal(np.eye(3), self.HEAD_R, self.HEAD_P, dx, dy) + (ch,) for dx, dy, ch in self.MARKS]

    # ---- the standing doll
    def paint(self, pose, cam):
        cv = Canvas()
        if pose.get('off') is not None:
            cam = Spun(cam, np.eye(3), v3(0, 0, 0), pose['off'])
        hip_c = v3(0, 0, self.HIP_Z + pose.get('bob', 0.0))
        R = rot('y', pose.get('lean', 0.0)) @ rot('x', pose.get('roll', 0.0))
        U = lambda v: hip_c + R @ (v - v3(0, 0, self.HIP_Z))     # torso points, authored standing
        grid = pose.get('snap', False)

        def snap(v, odd_x=False, odd_y=False):
            """put v's screen point on the pixel grid: a 2 px part straddles a pixel edge, a
            1 or 3 px part sits on a pixel's centre, so limbs land as clean columns"""
            if not grid: return v
            sp = cam.p(v)
            tx = math.floor(sp[0]) + 0.5 if odd_x else round(sp[0])
            ty = math.floor(sp[1]) + 0.5 if odd_y else round(sp[1])
            return v + cam.R.T @ np.array([tx - sp[0], ty - sp[1], 0.0])

        feet = pose.get('feet', self.REST_FEET)
        for s in (1, -1):
            side = 'L' if s > 0 else 'R'
            hip = hip_c + R @ v3(0, self.HIP_Y * s, -0.2)
            ankle_t = feet[s] + v3(-0.15, 0, self.ANKLE)
            kp = R @ pose['kpole'] if 'kpole' in pose else v3(1, 0, 0)
            lk = pose.get('leg', 1.0)
            knee, ankle = ik(hip, ankle_t, self.LEG[0] * lk, self.LEG[1] * lk, kp + v3(0, 0.1 * s, 0))
            hip, knee, ankle = snap(hip), snap(knee), snap(ankle)
            cv.tube(cam, hip, knee, 1.05, 0.98, 'thigh' + side, 'pants')
            cv.tube(cam, knee, ankle, 0.98, 0.92, 'shin' + side, 'pants')
            # the boot hangs off the ankle the leg reached, pitched by the pose (toe down on a push)
            Rf = rot('y', pose.get('toe', {}).get(s, 0.0))
            bc = snap(ankle + Rf @ v3(0.45, 0, -Z(0.45)), odd_x=pose.get('view') == 'side', odd_y=True)
            cv.blob(cam, bc, Rf, (1.5, 1.02, Z(0.66)), 'boot' + side, 'boot', bias=0.6)
            self.under_boot(cv, cam, bc, Rf, side, snap)
        self.coat(cv, cam, U, R)
        for s in (1, -1):
            side = 'L' if s > 0 else 'R'
            sh = U(v3(self.SHOULDER[0], self.SHOULDER[1] * s, self.SHOULDER[2]))
            off = pose.get('hands', {}).get(s, v3(0, 0, 0))     # authored for the left hand; mirrored
            hand_t = hip_c + R @ ((self.REST_HAND + off) * v3(1, s, 1) - v3(0, 0, self.HIP_Z))
            ep = pose.get('epole', v3(-1, 0, 0))
            el, hand = ik(sh, hand_t, *self.ARM, pole=R @ (ep + v3(0, 0.5 * s, 0)))
            el, hand = snap(el), snap(hand)
            cv.tube(cam, sh, el, 0.8, 0.74, 'arm' + side, 'coat')
            cv.tube(cam, el, hand, 0.74, 0.7, 'arm' + side, 'coat')
            cv.ball(cam, snap(hand + R @ v3(0.05, 0, -0.3)), 0.86, 'mitt' + side, 'trim', bias=0.2)
        hy, hp = pose.get('head', (0.0, 0.0))
        Rh = R @ rot('z', hy) @ rot('y', hp)
        hc = U(v3(0, 0, self.HEAD_C))
        self.head(cv, cam, hc, Rh, pose, snap)
        self.extras(cv, cam, U, R, pose)
        return cv

    def coat(self, cv, cam, U, R):
        L = self.lift
        cv.blob(cam, U(v3(0, 0, Z(4.95 + L))), R, (2.75, 3.05, Z(1.85)), 'coat', 'coat', p=2.2)
        cv.blob(cam, U(v3(0, 0, Z(3.0 + L))), R, (2.6, 3.1, Z(0.6)), 'hem', 'hem', bias=-0.3)
        cv.blob(cam, U(v3(0.1, 0, Z(6.75 + L))), R, (2.45, 2.85, Z(0.42)), 'scarf', 'trim', bias=0.2)

    def under_boot(self, cv, cam, bc, Rf, side, snap):
        pass

    def extras(self, cv, cam, U, R, pose):
        pass

    def face_marks(self, cv, cam, hc, Rh):
        for p, n, ch in self.FACE:
            cv.sticker(cam, hc + Rh @ p, Rh @ n, ch, 'head')

    # ---- the ball: the body tucked for the roll, centred on the origin. Angle 0 is curled up
    # sitting (head on top, seat on the snow); a positive angle pitches it forward, so 90 is
    # the dive's end (head tucked under at the front, back on top), 180 the feet going over,
    # 270 the feet coming down ahead, 360 sitting again, ready to stand.
    BALL_LIFT = 4.3

    def paint_ball(self, theta, cam):
        cv = Canvas()
        cam = Spun(cam, rot('y', theta), v3(0, 0, 0), v3(0, 0, self.BALL_LIFT))
        # the back of the coat is most of the ball
        cv.blob(cam, v3(-0.55, 0, -0.1), np.eye(3), (3.55, 3.85, 3.85), 'coat', 'coat', p=2.2)
        cv.blob(cam, v3(-0.9, 0, -2.75), np.eye(3), (2.3, 3.0, 1.1), 'hem', 'hem', bias=0.1)
        # legs folded up the front: thighs to the chest, shins down to the boots under the seat
        for s in (1, -1):
            side = 'L' if s > 0 else 'R'
            hip, knee, ankle = v3(-0.4, 1.45 * s, -2.0), v3(2.45, 1.5 * s, -0.25), v3(1.75, 1.4 * s, -2.75)
            cv.tube(cam, hip, knee, 1.05, 0.98, 'thigh' + side, 'pants')
            cv.tube(cam, knee, ankle, 0.98, 0.92, 'shin' + side, 'pants')
            Rf = rot('y', 0.35)
            bc = ankle + v3(0.45, 0, -0.4)
            cv.blob(cam, bc, Rf, (1.45, 1.0, 0.72), 'boot' + side, 'boot', bias=0.3)
            self.under_boot(cv, cam, bc, Rf, side, lambda v, **k: v)
            # arms round the shins
            sh, hand = v3(0.15, 2.75 * s, 1.15), v3(2.95, 2.15 * s, -1.25)
            el, hand = ik(sh, hand, self.ARM[0] * 1.15, self.ARM[1] * 1.15, v3(-0.3, 0.6 * s, 0.6))
            cv.tube(cam, sh, el, 0.8, 0.74, 'arm' + side, 'coat')
            cv.tube(cam, el, hand, 0.74, 0.7, 'arm' + side, 'coat')
            cv.ball(cam, hand + v3(0.15, 0, -0.1), 0.88, 'mitt' + side, 'trim', bias=0.25)
        # head tucked down into the knees: the crown faces forward, the face is hidden
        Rh = rot('y', 1.05)
        hc = v3(1.15, 0, 1.95)
        cv.blob(cam, v3(0.45, 0, 0.95), rot('y', 0.7), (1.9, 2.9, 0.75), 'scarf', 'trim', bias=0.1)
        self.ball_head(cv, cam, hc, Rh)
        return cv

    def ball_head(self, cv, cam, hc, Rh):
        cv.blob(cam, hc, Rh, (2.6, 2.85, 2.5), 'head', 'hat', p=self.HEAD_P, region=self.face_region)

    # ---- to letters
    def far_side(self, heading):
        """the limbs on the side turned away from the camera, side-on views only"""
        if abs(abs(heading) - 90) < 30: return set()
        away = 'L' if -90 < heading < 90 else 'R'      # facing right, the left side is the far one
        return {k + away for k in ('arm', 'mitt', 'thigh', 'shin', 'boot', 'blade')}

    def render(self, pose, heading, edge='sides'):
        g, _ = ink(self.paint(pose, Cam(heading)), self.NOOUT, self.SOFT, self.CROSS, edge,
                   self.far_side(heading), self.TOPINK)
        return g

    def render_ball(self, theta, heading):
        g, _ = ink(self.paint_ball(theta, Cam(heading)), self.NOOUT, self.SOFT, self.CROSS, 'full',
                   self.far_side(heading), self.TOPINK)
        return g


class Hunter(Body):
    """the pom beanie pulled down over the ears, a round face under it, cream scarf and mittens"""
    HEAD_C = Z(10.2)
    JAW_C = v3(0.25, 0, -1.55)          # the hand-drawn head is flat along the bottom
    JAW_R = (2.45, 2.95, 1.1)
    # where each mark sits on today's front frame, px from the head's centre on screen; the
    # eyes go last so they win a pixel they share with the mouth's shade
    MARKS = [(-0.5, 2.5, 'K'), (0.5, 2.5, 'K'), (-2.3, 2.35, 'x'), (2.3, 2.35, 'x'), (-1.5, 1.4, 'e'), (1.5, 1.4, 'e')]

    @staticmethod
    def face_region(n, q):
        """the face is the front of the head below the brim (by where on the head, not which
        way the surface faces, so a head pitched over never shows skin round its sides)"""
        return np.where((q[0] > 0.15) & (n[2] < 0.08), 'skin', 'hat')

    def head(self, cv, cam, hc, Rh, pose, snap):
        cv.blob(cam, hc, Rh, self.HEAD_R, 'head', 'hat', p=self.HEAD_P, region=self.face_region)
        cv.blob(cam, hc + Rh @ self.JAW_C, Rh, self.JAW_R, 'head', 'hat', p=4.0, region=self.face_region)
        cv.ball(cam, snap(hc + Rh @ v3(-0.35, 0, Z(3.45)) + pose.get('pom', v3(0, 0, 0))), 1.0, 'pom', 'trim')
        self.face_marks(cv, cam, hc, Rh)

    def ball_head(self, cv, cam, hc, Rh):
        super().ball_head(cv, cam, hc, Rh)
        cv.ball(cam, hc + Rh @ v3(-0.35, 0, Z(3.2)), 1.0, 'pom', 'trim')


class Warrior(Body):
    """a fur-lined hood with the goggles over the eyes, a scarf whose tail streams out behind,
    and skate blades under the boots that stand her a row taller"""
    lift = 1.0
    HEAD_C = Z(11.5)
    HEAD_R = (2.7, 3.0, 2.5)
    # the goggles' lenses and frame across the face, then the mouth's shade; the lenses last
    MARKS = [(-0.5, 2.2, 'K'), (0.5, 2.2, 'K'),
             (-1.5, 1.2, 'g'), (0.5, 1.2, 'g'), (-2.5, 1.2, 'G'), (-0.5, 1.2, 'G'), (1.5, 1.2, 'G')]

    def __init__(self):
        super().__init__()
        self.TOPINK = {'head'}          # the hood's crown is inked across the top
        self.SHOULDER = (0.0, 2.6, Z(6.5))

    def coat(self, cv, cam, U, R):
        # a row longer in the body than the hunter's: the scarf two rows up, the hem one
        cv.blob(cam, U(v3(0, 0, Z(6.1))), R, (2.75, 3.05, Z(2.05)), 'coat', 'coat', p=2.2)
        cv.blob(cam, U(v3(0, 0, Z(4.0))), R, (2.6, 3.1, Z(0.6)), 'hem', 'hem', bias=-0.3)
        cv.blob(cam, U(v3(0.1, 0, Z(8.75))), R, (2.45, 2.85, Z(0.42)), 'scarf', 'trim', bias=0.2)

    @staticmethod
    def face_region(n, q):
        """an opening in the hood: narrower than the hunter's face, framed by the fur"""
        return np.where((q[0] > 0.15) & (np.abs(q[1]) < 0.8) & (q[2] < 0.42) & (q[2] > -0.95), 'skin', 'hat')

    def head(self, cv, cam, hc, Rh, pose, snap):
        cv.blob(cam, hc, Rh, self.HEAD_R, 'head', 'hat', p=self.HEAD_P, region=self.face_region)
        self.face_marks(cv, cam, hc, Rh)

    def under_boot(self, cv, cam, bc, Rf, side, snap):
        # the blade: a thin bright plate under the sole
        cv.blob(cam, snap(bc + Rf @ v3(0.05, 0, -Z(1.0)), odd_y=True), Rf, (1.75, 0.7, Z(0.42)), 'blade' + side, 'blade', bias=0.8)

    def extras(self, cv, cam, U, R, pose):
        # the scarf's tail: out of the back of the collar, hanging, or streaming behind her
        # in the run's wind (pose['tail'] is its blow: 0 hangs, 1 streams straight back)
        blow = pose.get('tail', 0.0); flap = pose.get('flap', 0.0)
        p = U(v3(-2.0, 0.4, Z(6.7 + self.lift)))
        d0 = v3(-0.35 - 0.9 * blow, 0.0, -1.0 + 0.85 * blow)
        for i in range(3):
            k = i / 2
            d = d0 + v3(0, 0.35 * math.sin(flap + i * 1.4) * blow, 0.25 * math.sin(flap + i * 1.9) * blow)
            d = d / np.linalg.norm(d)
            q = p + d * 1.1
            cv.tube(cam, p, q, 1.0 - 0.1 * k, 0.95 - 0.1 * k, 'tail', 'trim', bias=-0.4)
            p = q
        # and its two short ends over the front of the coat, high on one side, low on the other
        L = self.lift
        cv.blob(cam, U(v3(2.2, -2.45, Z(6.75 + L))), R, (0.7, 0.95, Z(0.6)), 'endR', 'trim', bias=0.3)
        cv.blob(cam, U(v3(2.2, 2.45, Z(4.85 + L))), R, (0.7, 0.95, Z(0.6)), 'endL', 'trim', bias=0.3)

    def ball_head(self, cv, cam, hc, Rh):
        super().ball_head(cv, cam, hc, Rh)
        # the tail flies off the back of the hood as the ball turns
        p = hc + Rh @ v3(-2.4, 0, -0.6)
        for i, d in enumerate((v3(-1, 0, -0.2), v3(-1, 0, 0.3), v3(-0.8, 0, 0.7))):
            q = p + d / np.linalg.norm(d) * 1.1
            cv.tube(cam, p, q, 0.75 - 0.1 * i, 0.7 - 0.1 * i, 'tail', 'trim', bias=-0.2)
            p = q


BODIES = {'hunter': Hunter(), 'warrior': Warrior()}
