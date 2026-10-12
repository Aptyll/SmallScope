// "I added deer riding to my game", take two: the practice field's deer ride.
// The hunter gallops the trail through the forest wing on the tame deer, breaks
// the three posts along it at full gallop (they say JOIN, THE, DISCORD) and
// leaps the felled log on the climb out. Nothing is cleared or stood by hand:
// the trail, the posts, the log and the deer are the practice field's own.
//   node app/media/rec.js app/media/scenes/deer-ride.js <take> [--dry]
window.SCENE = {
  o: { practice: true, w: 540, h: 960, dpr: 2, k: 4, weather: 'blizzard', max: 1500, earR: 300, mute: ['overheadPlate'] },

  setup(M) {
    const T = TILE, curve = rdCurve().map(([x, y]) => [x * T, y * T]);
    // the trail as one polyline in world px, and how far along it each sample sits
    const along = [0];
    for (let i = 1; i < curve.length; i++) along.push(along[i - 1] + Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]));
    M.data.curve = curve; M.data.along = along;
    const near = (x, y) => { let b = 0, bd = 1e9; for (let i = 0; i < curve.length; i++) { const d = Math.hypot(curve[i][0] - x, curve[i][1] - y); if (d < bd) { bd = d; b = i; } } return b; };
    // the posts, in the order the trail meets them, each saying its word
    const posts = ptargets.filter((t) => t.at).sort((a, b) => near(a.x, a.y) - near(b.x, b.y));
    ['JOIN', 'THE', 'DISCORD'].forEach((w, i) => { posts[i].word = w; });
    M.posts = posts;
    // the log's middle piece, as a distance along the trail
    M.data.logS = along[near((RD_LOG.tx + 0.5) * T, (RD_LOG.ty + 0.5) * T)];
    // start at a full gallop's run-up before the first post
    const s0 = along[near(posts[0].x, posts[0].y)] - 330;
    let i0 = 0; while (along[i0] < s0) i0++;
    const p = M.p = player, a = M.a = prDeer;
    setClass(p, 0); p.invuln = 0;
    a.x = curve[i0][0]; a.y = curve[i0][1]; a.vx = a.vy = 0;
    p.x = a.x - 6; p.y = a.y; p.vx = p.vy = 0;
    p.input.jump = true;
    for (let i = 0; i < 3; i++) update(1 / 60);
    p.input.jump = false;
    M.ears = [p];
    M.track('rider', p); M.track('deer', a);
    posts.forEach((t, i) => M.track('t' + (i + 1), () => ptFace(t)));
    M.track('arrow', () => { const r = arrows.find((q) => q.owner === p.id); return r ? [r.x, r.y] : null; });
    M.cam = [p.x, p.y - 30];
    M.data.shots = [];
    return { mounted: !!p.mount, start: i0, posts: posts.map((t) => [Math.round(t.x), Math.round(t.y)]), logS: Math.round(M.data.logS), s0: Math.round(s0) };
  },

  tick(M) {
    const p = M.p, i = p.input, D = M.data, C = D.curve, A = D.along;
    // where the rider is along the trail, and the point a little way ahead to steer for
    let k = D.k || 0;
    while (k < C.length - 1 && Math.hypot(C[k + 1][0] - p.x, C[k + 1][1] - p.y) < Math.hypot(C[k][0] - p.x, C[k][1] - p.y)) k++;
    D.k = k;
    const s = A[k];
    let j = k; while (j < C.length - 1 && A[j] < s + 22) j++;
    if (!D.end) M.drive(p, C[j][0], C[j][1], 0); else { i.mx = i.my = 0; }
    // the shots: draw as a post comes up, loose at full draw
    i.dodge = false;
    const next = M.posts.find((t) => !D.shots.includes(t));
    if (next) {
      const f = ptFace(next), d = Math.hypot(f.x - p.x, f.y - p.y);
      i.aimX = f.x; i.aimY = f.y;
      if (d < 150 && !p.charging) i.fire = true;
      if (p.charging && drawPow(p) >= 1 && d < 120) { i.fire = false; D.shots.push(next); M.mark('loose'); }
    }
    // the leap over the log
    if (!D.leapt && s > D.logS - 30) { i.dodge = true; D.leapt = M.frame; M.mark('leap'); }
    M.posts.forEach((t, n) => { if (t.broken > 0 && !D['hit' + (n + 1)]) { D['hit' + (n + 1)] = M.frame; M.mark('hit' + (n + 1)); } });
    if (D.leapt && !D.end && M.frame - D.leapt > 70) { D.end = M.frame; M.mark('end'); }
    // the camera rides a little ahead of the rider, along its heading
    const want = [p.x + (C[j][0] - p.x) * 1.4, p.y + (C[j][1] - p.y) * 1.4 - 30];
    M.cam = [M.cam[0] + (want[0] - M.cam[0]) * 0.1, M.cam[1] + (want[1] - M.cam[1]) * 0.1];
  },

  row(M) { const p = M.p; return { dbg: [p.charging ? 1 : 0, M.fix(drawPow(p)), M.fix(p.leapT || 0), p.mount ? 1 : 0] }; },

  done(M) { return M.data.end != null && M.frame - M.data.end > 40; },
};
