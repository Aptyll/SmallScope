// "I added deer riding to my game": a hunter gallops a deer up the road to the felled
// log, shoots two targets on the way, and on the leap over the log looses one arrow
// through a narrow cut in the pines at a third target. Each target says a gold word
// (WISHLIST, ON, STEAM). The leap slows to a freeze (snow still falling), holds, then
// runs on: the cut opens on that frozen frame and rewinds to the start.
//   node app/media/rec.js app/media/scenes/deer-gap.js <take> [--dry]
// Staged: the cut through the pines is cleared by hand and the targets are the
// practice range's, stood in the valley. Never call it real gameplay.
window.SCENE = {
  o: { seed: 6, w: 540, h: 960, dpr: 2, k: 4, weather: 'snow', time: 0.42, max: 1400, earR: 300, mute: ['overheadPlate'] },

  setup(M) {
    const T = TILE, c = (tx, ty) => [(tx + 0.5) * T, (ty + 0.5) * T];
    // the felled log across the road nearest the north-east nest; the road runs
    // up and right through it (u), the cut opens off its north-west shoulder
    let L = null;
    for (let i = 0; i < objects.length && !L; i++) {
      const o = objects[i];
      if (o && o.type === 'log' && o.tx > WORLD / 2 && o.ty < WORLD / 2) {
        const run = []; for (let j = 0; j < 9; j++) { const q = objects[idx(o.tx + j, o.ty + j)]; if (q && q.type === 'log') run.push(q); }
        L = run[Math.floor(run.length / 2)];
      }
    }
    const u = [Math.SQRT1_2, -Math.SQRT1_2];
    const [lx, ly] = c(L.tx, L.ty);
    M.data.log = [lx, ly];
    // the leap's apex sits on the log; the third target stands up and to the left
    // of it, behind the treeline, and the cut is every pine within CUT px of the line
    const apex = [lx + 6, ly - 6], tgt3 = [lx - 32, ly - 54];
    const CUT = 12;
    const seg = (x, y, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
    };
    const cleared = [];
    for (let ty = L.ty - 10; ty <= L.ty + 2; ty++) for (let tx = L.tx - 8; tx <= L.tx + 2; tx++) {
      const o = objects[idx(tx, ty)];
      if (!o || o.type !== 'tree') continue;
      const [x, y] = c(tx, ty);
      // the line, and a little room round the target's face and post
      if (seg(x, y, apex, [tgt3[0], tgt3[1] - 18]) < CUT || Math.hypot(x - tgt3[0], y - tgt3[1] + 10) < 12) { objects[idx(tx, ty)] = null; cleared.push([tx, ty]); }
    }
    // the targets: two on the road's shoulders on the way in, the third in the cut
    const along = (d, side) => [lx - u[0] * d + u[1] * side * -1, ly - u[1] * d + u[0] * side];
    const t1p = along(430, -34), t2p = along(260, 34);
    const stand = (p, word) => { const t = addPTarget('still', 0, { word }); t.x = p[0]; t.y = p[1]; return t; };
    M.t1 = stand(t1p, 'WISHLIST'); M.t2 = stand(t2p, 'ON'); M.t3 = stand(tgt3, 'STEAM');
    // the hunter, the deer, everyone else away
    const p = M.p = player;
    setClass(p, 0); p.zip = -1; p.invuln = 0;
    const a = M.a = animals.find((q) => q.kind === 'deer' && !q.dead);
    M.park(players.filter((q) => q !== p), 400, 400);
    M.park(animals.filter((q) => q !== a), 400, 600);
    const start = [lx - u[0] * 560, ly - u[1] * 560];
    a.x = start[0]; a.y = start[1]; a.vx = a.vy = 0;
    p.x = a.x - 6; p.y = a.y; p.vx = p.vy = 0;
    p.input.jump = true;
    for (let i = 0; i < 4; i++) update(1 / 60);
    state.time = M.o.time * DAY_LEN;
    M.ears = [p];
    M.track('rider', p); M.track('deer', a);
    M.track('t1', () => ptFace(M.t1)); M.track('t2', () => ptFace(M.t2)); M.track('t3', () => ptFace(M.t3));
    M.track('arrow', () => { const r = arrows.find((q) => q.owner === p.id); return r ? [r.x, r.y] : null; });
    M.cam = [p.x, p.y - 40];
    M.data.shots = [];
    return { log: [L.tx, L.ty], mounted: !!p.mount, cleared: cleared.length, t3: tgt3, start };
  },

  tick(M) {
    const p = M.p, i = p.input, D = M.data, [lx, ly] = D.log;
    const u = [Math.SQRT1_2, -Math.SQRT1_2];
    // how far up the road from the log (negative: still coming)
    const s = (p.x - lx) * u[0] + (p.y - ly) * u[1];
    // the weave: the road's centre line, swung side to side, straight for the leap
    const side = s < -90 ? Math.sin((s + 560) / 62) * 22 : 0;
    const gx = lx + u[0] * (s + 60) + u[1] * side * -1, gy = ly + u[1] * (s + 60) + u[0] * side;
    if (!D.end) M.drive(p, gx, gy, 0);
    else { i.mx = i.my = 0; }
    // the three shots: draw as the target comes up, loose at full draw
    const next = [M.t1, M.t2, M.t3].find((t) => !t.gone && !D.shots.includes(t));
    i.dodge = false;
    if (next) {
      const f = ptFace(next);
      i.aimX = f.x; i.aimY = f.y;
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      const ready = next === M.t3 ? s > -120 : d < 120;
      if (ready && !p.charging && !D.loosed) i.fire = true;
      if (p.charging && drawPow(p) >= 1 && (next !== M.t3 || (p.leapT > 0 && s > 4))) {
        i.fire = false; D.shots.push(next); M.mark('loose'); if (next === M.t3) { D.loose3 = M.frame; }
      }
    }
    // the leap over the log
    if (!D.leapt && s > -26) { i.dodge = true; D.leapt = M.frame; M.mark('leap'); }
    // hits: each word lands the frame its face breaks
    for (const [t, n] of [[M.t1, 'hit1'], [M.t2, 'hit2'], [M.t3, 'hit3']]) if (t.gone && !D[n]) { D[n] = M.frame; M.mark(n); }
    // the freeze: from the third loose the sim slows to a stop with the arrow on
    // its way, holds (weather only), then runs on at full speed
    if (D.leapt != null && !D.frozen) {
      // into slow motion on the leap, then glide to a stop once the arrow is away
      M.speed = D.loose3 == null ? Math.max(0.4, M.speed - 0.03) : Math.max(0, M.speed - 0.0103);
      if (M.speed === 0) { D.frozen = M.frame; M.mark('freeze'); }
    } else if (D.frozen && !D.thaw && M.frame - D.frozen >= 150) { D.thaw = M.frame; M.mark('thaw'); }
    if (D.thaw && M.speed < 1) M.speed = Math.min(1, M.speed + 0.05);
    if (D.hit3 && !D.end) D.end = M.frame;
    // the camera rides a little ahead and above, and holds still through the freeze
    if (M.speed > 0) {
      const want = [p.x + u[0] * 20, p.y - 46];
      M.cam = [M.cam[0] + (want[0] - M.cam[0]) * 0.12 * M.speed, M.cam[1] + (want[1] - M.cam[1]) * 0.12 * M.speed];
    }
  },

  done(M) { return M.data.end != null && M.frame - M.data.end > 200; },
};
