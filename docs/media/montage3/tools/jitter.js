const { run } = require('./probe');
const { scenes } = require('./scenes');
const pick = ['01-', '03-', '04-', '05-', '15-', '16-', '22-', '24-', '28-', '30-', '31-', '32-', '33-'];
const jobs = [];
for (const n of pick) {
  const s = scenes.find(x => x.name.startsWith(n));
  jobs.push({ name: 'jit-' + s.name, title: s.title, full: true, wait: s.sec * 1000, stage: s.stage,
    roll: s.roll + `;(function(){
      window.__J = [];
      const c = __M.cam;
      __M.cam = function () { c(); window.__J.push([camX, camY]); };
    })()` });
  jobs.push({ name: 'jit-' + s.name + '-r', title: s.title, keep: true, full: true, wait: 20, stage: `(function(){
    const J = window.__J;
    let frac = 0, flipX = 0, flipY = 0, maxStep = 0, moved = 0, flick = 0;
    let px = 0, py = 0;
    for (let i = 0; i < J.length; i++) {
      if (J[i][0] % 1 !== 0 || J[i][1] % 1 !== 0) frac++;
      if (i === 0) continue;
      const dx = J[i][0] - J[i-1][0], dy = J[i][1] - J[i-1][1];
      if (dx || dy) moved++;
      maxStep = Math.max(maxStep, Math.abs(dx), Math.abs(dy));
      // a FLICKER is the jitter itself: a move undone on the very next frame
      // (+1 then -1), which a follow camera drifting never does
      if (i >= 2) {
        const ex = J[i-1][0] - J[i-2][0], ey = J[i-1][1] - J[i-2][1];
        if ((dx && ex && dx === -ex) || (dy && ey && dy === -ey)) flick++;
      }
      // a SIGN FLIP between consecutive non-zero moves is what reads as jitter
      if (dx && px && Math.sign(dx) !== Math.sign(px)) flipX++;
      if (dy && py && Math.sign(dy) !== Math.sign(py)) flipY++;
      if (dx) px = dx;
      if (dy) py = dy;
    }
    return JSON.stringify({ frames: J.length, fractional: frac, movedFrames: moved,
      reversals: flipX + flipY, flickers: flick, maxStepPx: maxStep, shake: settings.shake, stateShake: +state.shake.toFixed(2) });
  })()` });
}
run(jobs);
