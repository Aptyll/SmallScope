// The montage driver, injected once after the page has booted. It is a classic
// script, so it shares the game's global scope: every DBG cheat and every game
// global is in reach.
(function () {
  const M = {};
  window.__M = M;
  M.err = null;

  // ---------------------------------------------------------------- hooks
  // One hook per SIM STEP (the fixed 1/60) and one per FRAME just before
  // render, which is where a hand-held camera has to be written: update()
  // moves camX/camY itself, so a scene that wants its own framing sets it
  // after the step and before the draw.
  // A scene's hook has to land AFTER sampleHumanInput and before the step
  // reads the struct: sampleHumanInput rebuilds the local player's input from
  // the keyboard every step (js/input.js), so anything written earlier - work,
  // and every field the live path assigns - is gone before updatePlay sees it.
  // Exactly one call per update (js/sim.js), so this is once per sim step.
  M.step = null;
  M.cam = null;
  const _sample = sampleHumanInput;
  sampleHumanInput = function (p, dt) {
    _sample(p, dt);
    if (p === player && M.step) {
      try { M.step(dt); } catch (e) { M.err = String((e && e.stack) || e); M.step = null; }
    }
  };
  const _render = render;
  render = function () {
    if (M.cam) { try { M.cam(); } catch (e) { M.err = String((e && e.stack) || e); M.cam = null; } }
    _render();
  };

  // ------------------------------------------------------------- recorder
  const R = { mr: null, chunks: [], bytes: null, mime: '' };
  M.mimes = function () {
    return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .filter(function (m) { return MediaRecorder.isTypeSupported(m); });
  };
  M.begin = function (opts) {
    opts = opts || {};
    const st = new MediaStream();
    st.addTrack(canvas.captureStream(opts.fps || 60).getVideoTracks()[0]);
    const tap = window.__AUDIOTAP;
    if (!tap || !tap.dest) throw new Error('no audio tap - the context never came up');
    st.addTrack(tap.dest.stream.getAudioTracks()[0]);
    R.mime = opts.mime || M.mimes()[0];
    R.chunks = [];
    R.bytes = null;
    R.mr = new MediaRecorder(st, {
      mimeType: R.mime,
      videoBitsPerSecond: opts.vbr || 20000000,
      audioBitsPerSecond: 192000,
    });
    R.mr.ondataavailable = function (e) { if (e.data && e.data.size) R.chunks.push(e.data); };
    R.mr.start();
    return R.mime;
  };
  M.end = async function () {
    const mr = R.mr;
    if (!mr) throw new Error('not recording');
    await new Promise(function (res) { mr.onstop = res; mr.stop(); });
    R.mr = null;
    const blob = new Blob(R.chunks, { type: R.mime });
    R.bytes = new Uint8Array(await blob.arrayBuffer());
    return R.bytes.length;
  };
  // The clip comes home as base64 over CDP in slices: each slice is encoded on
  // its own, so Node decodes and concatenates them without caring where the
  // boundaries fell.
  M.slice = function (from, n) {
    const b = R.bytes.subarray(from, Math.min(R.bytes.length, from + n));
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  };

  // --------------------------------------------------------------- basics
  M.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  M.wait = function (secs) { return M.sleep(secs * 1000); };

  M.snapCam = function (x, y) {
    const fx = x == null ? player.x : x;
    const fy = y == null ? player.y : y;
    camX = Math.max(0, Math.min(WORLD * TILE - WV_W, fx - WV_W / 2));
    camY = Math.max(0, Math.min(WORLD * TILE - WV_H, fy - WV_H / 2));
    state.intro = 0;
    state.introFrom = { x: camX, y: camY };
  };
  // ease the camera toward a point instead of snapping: a hand on the wheel
  M.easeCam = function (x, y, k) {
    const tx = Math.max(0, Math.min(WORLD * TILE - WV_W, x - WV_W / 2));
    const ty = Math.max(0, Math.min(WORLD * TILE - WV_H, y - WV_H / 2));
    // the play camera's own lerp is dt*7 - about 0.117 a frame (js/sim.js) -
    // and it is pulling toward the PLAYER. A hook easing slower than that never
    // wins its own framing: the shot settles somewhere between the two
    const a = Math.max(0.16, k == null ? 0.25 : k);
    camX += (tx - camX) * a;
    camY += (ty - camY) * a;
    state.intro = 0;
  };
  M.mid = function (a, t) {
    const u = t == null ? 0.5 : t;
    return { x: player.x + (a.x - player.x) * u, y: player.y + (a.y - player.y) * u };
  };

  M.clearInput = function (p) {
    const q = p || player;
    const ks = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    if (q === player) for (let i = 0; i < ks.length; i++) keys[ks[i]] = false;
    q.input.mx = 0;
    q.input.my = 0;
    q.input.fire = false;
    q.input.dodge = false;
    q.input.work = false;
    q.input.ability = -1;
    q.input.grapple = false;
  };
  M.walk = function (mx, my, p) {
    const q = p || player;
    if (q === player) {
      keys.w = keys.a = keys.s = keys.d = false;
      if (my < -0.05) keys.w = true;
      if (my > 0.05) keys.s = true;
      if (mx < -0.05) keys.a = true;
      if (mx > 0.05) keys.d = true;
    }
    q.input.mx = mx;
    q.input.my = my;
  };
  M.aim = function (wx, wy, p) {
    const q = p || player;
    q.input.aimX = wx;
    q.input.aimY = wy;
    if (q === player) { mouse.inside = true; mouse.x = wToSX(wx); mouse.y = wToSY(wy); }
  };
  M.aimAng = function (ang, dist, p) {
    const q = p || player;
    M.aim(q.x + Math.cos(ang) * (dist || 60), q.y + Math.sin(ang) * (dist || 60), q);
  };
  M.fire = function (on, p) { (p || player).input.fire = !!on; };
  M.place = function (x, y, p) {
    const q = p || player;
    q.x = x; q.y = y; q.vx = 0; q.vy = 0;
    q.prone = false; q.hide = 0; q.riseT = 0;
    q.charging = false; q.chargeT = 0;
    q.fireArmed = false; q.firePrev = false;
    q.nockT = 0; q.castT = 0; q.dodgeT = 0; q.fallT = 0;
    q.dead = false; q.respawnT = 0; q.eliminated = false;
    q.hp = q.maxHp;
    M.clearInput(q);
    return q;
  };
  M.tile = function (tx, ty) { return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }; };
  // A camera target that follows a body until it goes down and then HOLDS
  // where it fell: a dead player is moved to its bird by respawnPlayer, so a
  // hook reading e.x live rides the corpse off into the treeline mid-clip.
  M.pin = function (e) {
    const at = { x: e.x, y: e.y };
    let gone = false;
    return function () {
      // ONCE it has gone down it stays pinned: respawnPlayer clears p.dead and
      // sets the body back down at its bird, so a pin that only asks "is it
      // dead right now" starts tracking again mid-clip and flies to the roost
      if (e.dead || e.hp <= 0) gone = true;
      if (!gone) { at.x = e.x; at.y = e.y; }
      return at;
    };
  };
  M.at = function (e) { return { x: e.x, y: e.y }; };

  // every other player off the board and out of the sim's way
  M.parkOthers = function (keep) {
    const live = keep || [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p === player || live.indexOf(p) >= 0) continue;
      p.control = 'none';
      p.active = false;
      p.aboard = false;
      p.x = 48; p.y = 48;
      p.nockT = 1e9;
    }
  };
  M.wipeAnimals = function () {
    for (let i = 0; i < animals.length; i++) { animals[i].dead = true; animals[i].x = 32; animals[i].y = 32; }
    animals.length = 0;
  };
  M.clearFx = function () {
    arrows.length = 0;
    floaters.length = 0;
    tracers.length = 0;
    state.shake = 0;
  };

  // ------------------------------------------------------------ the world
  // A clear, walkable patch with nothing on it: where a staged scene can
  // stand without a rock in the shot.
  M.openAt = function (tx, ty, r) {
    const rad = r || 5;
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const x = tx + dx, y = ty + dy;
        if (!inWorld(x, y) || !walkable(x, y) || objAt(x, y)) return false;
      }
    }
    return true;
  };
  M.findOpen = function (r, near) {
    const c = near || { tx: WORLD >> 1, ty: WORLD >> 1 };
    for (let ring = 0; ring < 120; ring += 2) {
      for (let a = 0; a < 24; a++) {
        const th = (a / 24) * Math.PI * 2;
        const tx = Math.round(c.tx + Math.cos(th) * ring);
        const ty = Math.round(c.ty + Math.sin(th) * ring);
        if (M.openAt(tx, ty, r || 5)) return { tx, ty };
      }
    }
    return c;
  };
  // a clear patch with a stand of trees around it: what a chop or a fell wants
  M.findTrees = function () {
    let best = null, score = -1;
    for (let ty = 40; ty < WORLD - 40; ty += 3) {
      for (let tx = 40; tx < WORLD - 40; tx += 3) {
        if (!M.openAt(tx, ty, 3)) continue;
        let trees = 0;
        for (let dy = -7; dy <= 7; dy++) {
          for (let dx = -7; dx <= 7; dx++) {
            const o = objAt(tx + dx, ty + dy);
            if (o && (o.type === 'tree' || o.type === 'deadTree')) trees++;
          }
        }
        if (trees > score) { score = trees; best = { tx, ty, trees }; }
        if (score >= 26) return best;
      }
    }
    return best || { tx: 110, ty: 110, trees: 0 };
  };
  // the nearest object of a type to a tile, searched outward
  M.nearObj = function (tx, ty, type, max) {
    for (let r = 0; r <= (max || 14); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const o = objAt(tx + dx, ty + dy);
          if (o && o.type === type) return { o, tx: tx + dx, ty: ty + dy };
        }
      }
    }
    return null;
  };

  // ----------------------------------------------------------- the camera
  M.zoom = function (z) { DBG.setZoom(z, true); };
  // Hold a scale the sim would otherwise take back - the eagle ride pins
  // DROP_ZOOM every frame in applyZoom (js/sim.js), so a close ride has to be
  // written back after the step and before the draw. z must stay on a rung
  // (a whole number of device px per world px) or the pixel grid tears.
  M.forceZoom = function (z) {
    const k = Math.max(kMin(), Math.min(kMax(), Math.round(z * devScale)));
    zoomCur = k / devScale;
    sizeWorldView();
  };
  M.rung = function (n) { return Math.round(n * devScale) / devScale; };
  M.hideUI = function (on) {
    DBG.hideUI = !!on;
    settings.info = false;
    settings.hitbox = 0;
    DBG.showPaths = false;
  };
  M.night = function (on) {
    state.time = on ? DAY_LEN + 22 : 30;
    state.dayPop = null;
    // state.darkness is DERIVED from the clock inside update (js/sim.js), so
    // a scene that only writes the time is still standing in broad daylight
    const was = DBG.freeze;
    DBG.freeze = true;
    DBG.step(1 / 60, 2);
    DBG.freeze = was;
    state.dayPop = null;
    SFX.setAmbience(true, !!on);
    return state.darkness;
  };

  // -------------------------------------------------------------- staging
  // Staging is done FROZEN and MUTED: DBG.step runs the sim as fast as the
  // loop will take it, and the mute is on the master gain - which is upstream
  // of the tap - so nothing a staged step raises can bleed into the clip.
  M.stageBegin = function () { SFX.setMuted(true); DBG.freeze = true; };
  M.stageEnd = function () { DBG.freeze = false; SFX.setMuted(false); };
  M.fast = function (n, dt) { for (let i = 0; i < n; i++) DBG.step(dt || 1 / 60, 1); };

  // Into a match: fly the drop out frozen and land on the map in play mode.
  M.toPlay = function () {
    M.stageBegin();
    startGame();
    dropJump(player, true);
    for (let i = 0; i < 400 && (player.aboard || player.dropT > 0 || state.mode !== 'play'); i++) DBG.step(1 / 60, 1);
    state.dropBrief = null;
    player.aboard = false;
    player.dropT = 0;
    state.mode = 'play';
    M.baseStructs = structures.slice();
    M.stageEnd();
    return state.mode;
  };

  // everything this driver put on the map, off it again
  M.clearStaged = function () {
    const base = M.baseStructs || [];
    for (let i = structures.length - 1; i >= 0; i--) {
      if (base.indexOf(structures[i]) < 0) removeStruct(structures[i]);
    }
    for (let i = robots.length - 1; i >= 0; i--) if (!robots[i].merchant) robots.splice(i, 1);
    if (typeof craters !== 'undefined') craters.length = 0;
    if (typeof nets !== 'undefined') nets.length = 0;
  };

  // The clean slate every scene opens from: nothing left over in the world,
  // the local player whole and armed, the camera on it, day, HUD up.
  M.reset = function (o) {
    o = o || {};
    M.stageBegin();
    M.step = null;
    M.cam = null;
    M.err = null;
    state.mode = 'play';
    state.fade = null;
    state.paused = false;
    state.eagleCine = false;
    state.mapOpen = false;
    state.settingsOpen = false;
    state.scoreOpen = false;
    state.wheel = null;
    state.dayPop = null;
    state.deadTimer = 0;
    state.shake = 0;
    state.intro = 0;
    M.clearFx();
    M.clearStaged();
    drops.length = 0;
    if (o.wipe !== false) M.wipeAnimals();
    M.parkOthers(o.keep);
    setClass(player, o.cls == null ? 0 : o.cls);
    player.dead = false;
    player.eliminated = false;
    player.respawnT = 0;
    player.hp = player.maxHp;
    player.abLv = [o.ab == null ? 3 : o.ab, o.ab == null ? 3 : o.ab, o.ab == null ? 3 : o.ab, o.ab == null ? 3 : o.ab];
    player.abCd = [0, 0, 0, 0];
    player.name = o.name == null ? 'SOFTFALL' : o.name;
    M.clearInput(player);
    M.hideUI(!!o.hideUI);
    settings.pixelCursor = o.cursor !== false;
    M.night(!!o.night);
    M.zoom(o.zoom == null ? 2 : o.zoom);
    M.stageEnd();
  };

  M.ok = true;
})();
