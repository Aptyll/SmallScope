// The media kit's page side: injected into a served game page by rec.js and
// still.js, never loaded by index.html. It turns the live game into a film set:
// the local machine stops driving anyone, the HUD goes, the camera holds where
// the scene puts it, and every frame logs what an edit needs (tracked bodies,
// named beats, hits and the sound cues heard near the camera).
// A scene file (see app/media/scenes/) sets window.SCENE = { o, setup(M), tick(M), done(M) }.
window.MEDIA = (function () {
  const D = window.DBG, DT = 1 / 60;
  const M = { frame: 0, t: 0, cam: null, draw: true, marks: {}, ev: [], hits: [], tracks: {}, data: {} };

  // the drop flown out, everyone landed, the local input cut off, the HUD gone
  M.boot = function (o) {
    M.o = o = Object.assign({ k: 6, weather: 'calm', earR: 260, teamBlue: true }, o || {});
    D.freeze = true;
    D.beginDrop();
    for (let i = 0; i < 60 * 90; i++) {
      if (state.dropBrief) state.dropBrief = null;
      if (player.aboard) D.dropJump(player);
      update(DT);
      if (state.mode === 'play' && players.every((p) => !p.active || !inAir(p))) break;
    }
    // nothing on this machine steers a body, aims a line or works on its own
    sampleHumanInput = function () {}; drawAimLine = function () {};
    autoWork = function () {}; drawWorkHint = function () {};
    for (const n of o.mute || []) window[n] = function () {};
    for (const p of players) { p.control = 'human'; p.name = o.names ? p.name : ''; p.flag = null; }
    settings.teamBlue = !!o.teamBlue;
    D.hideUI = true; D.setK(o.k, true);
    if (o.weather) D.weather(o.weather);
    if (o.time != null) state.time = o.time * DAY_LEN;
    // the ears: a cue rung within earR of the camera, or by a body in M.ears
    const heard = (x, y) => M.cam && Math.hypot(x - M.cam[0], y - M.cam[1]) < o.earR;
    const log = (cue, arg) => M.ev.push([M.frame, cue, arg == null || typeof arg === 'object' ? null : arg]);
    const at0 = sfxAt, for0 = sfxFor, own0 = sfxOwn;
    sfxAt = function (cue, x, y, r, arg) { if (heard(x, y)) log(cue, arg); return at0.apply(this, arguments); };
    sfxFor = function (p, cue, arg) { if ((M.ears || []).includes(p) || p === player) log(cue, arg); return for0.apply(this, arguments); };
    sfxOwn = function (p, own, other) { if ((M.ears || []).includes(p)) log(own); else if (heard(p.x, p.y)) log(other); return own0.apply(this, arguments); };
    const hu = hurtUnit;
    hurtUnit = function (e, dmg, nx, ny, src) { M.hits.push([M.frame, e && (e.id ?? e.kind), src && (src.id ?? src.kind), Math.round(dmg)]); return hu.apply(this, arguments); };
    return { k: D.getZoom().k, exact: D.getZoom().exact, view: [WV_W, WV_H] };
  };

  // out of the shot and out of harm (never deleted: an empty team ends the match)
  M.park = function (list, x, y) { let i = 0; for (const b of list) { b.x = (x ?? 40) + (i++ % 20) * 24; b.y = y ?? 40; b.vx = b.vy = 0; if (b.goal !== undefined) b.goal = null; } };
  // a named beat on this frame (an edit cuts on these: cut.json says "roar", "down#2+12")
  M.mark = function (name) { (M.marks[name] = M.marks[name] || []).push(M.frame); };
  // a body (or a function returning [x, y]) whose position every frame logs
  M.track = function (name, b) { M.tracks[name] = b; };
  // a player's stick for this frame: move toward (x, y), aim at (ax, ay)
  M.drive = function (p, x, y, stop) {
    const i = p.input, dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    i.mx = i.my = 0; if (d > (stop ?? 2)) { i.mx = dx / d; i.my = dy / d; }
  };
  M.fix = (v) => Math.round(v * 100) / 100;

  // one frame: the scene writes inputs, the sim steps, the camera holds still
  M.tick = function () {
    const S = window.SCENE;
    if (S && S.tick) S.tick(M);
    update(DT);
    if (S && S.after) S.after(M);
    const c = M.cam || [player.x, player.y];
    camX = Math.round(c[0] - WV_W / 2); camY = Math.round(c[1] - WV_H / 2);
    if (M.draw) render();
    const row = { f: M.frame, cam: [camX, camY], tr: {} };
    for (const n in M.tracks) {
      const b = M.tracks[n], p = typeof b === 'function' ? b() : b;
      if (p) row.tr[n] = Array.isArray(p) ? p.map(M.fix) : [M.fix(p.x), M.fix(p.y), p.dead ? 1 : 0];
    }
    if (S && S.row) Object.assign(row, S.row(M));
    M.frame++; M.t += DT;
    row.done = !!(S && S.done && S.done(M));
    return row;
  };
  M.summary = () => ({ marks: M.marks, ev: M.ev, hits: M.hits, data: M.data, k: D.getZoom().k, view: [WV_W, WV_H] });
  return M;
})();
