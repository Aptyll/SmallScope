// The montage driver, injected once after the page has booted. It is a classic
// script, so it shares the game's global scope: every DBG cheat and every game
// global is in reach.
//
// MONTAGE 3 IS 16:9. At a 1080-tall viewport fitCanvas picks 3 device px per
// game px and the view lands on exactly 640x360 - the game's own authored
// frame - so the canvas is 1920x1080 with nothing cropped or letterboxed, and
// the zoom rungs are exact thirds (0.6667, 1, 1.3333 ... 4.6667). A shot is
// composed ACROSS the frame rather than up it: M.battle takes axis 'x' and
// stands the two lines left and right of each other.
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
  M.keepUp = false;
  const _sample = sampleHumanInput;
  sampleHumanInput = function (p, dt) {
    _sample(p, dt);
    if (p === player && M.step) {
      try { M.step(dt); } catch (e) { M.err = String((e && e.stack) || e); M.step = null; }
    }
    // The local player is the camera operator. If it goes down, endMatch puts
    // the respawn wait over the frame - RESPAWNING IN 5 at 3x in the upper
    // band - and the clip is of that instead of the battle. Topping it up
    // every step is effectively armour: no single blow in the game comes near
    // a full bar.
    if (p === player && M.keepUp && !player.dead) player.hp = player.maxHp;
  };
  // ------------------------------------------------------------- recorder
  const R = { mr: null, chunks: [], bytes: null, mime: '', track: null, sent: -1 };
  M.mimes = function () {
    return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .filter(function (m) { return MediaRecorder.isTypeSupported(m); });
  };
  M.begin = function (opts) {
    opts = opts || {};
    const st = new MediaStream();
    // frame rate 0: nothing is captured until render() asks (see the hooks)
    R.track = canvas.captureStream(0).getVideoTracks()[0];
    R.sent = M.steps;
    R.step0 = M.steps;
    R.mark = 0;
    M.owed = 0;
    st.addTrack(R.track);
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
    R.steps = M.steps - R.step0; // how many sim steps the clip spanned
    await new Promise(function (res) { mr.onstop = res; mr.stop(); });
    R.mr = null;
    // whatever was still owed is the sim's again: run it now, unrecorded
    while (M.owed > 0) { M.owed--; update(TICK_DT); }
    if (R.track) { R.track.stop(); R.track = null; }
    const blob = new Blob(R.chunks, { type: R.mime });
    R.bytes = new Uint8Array(await blob.arrayBuffer());
    return R.bytes.length;
  };
  // The clip comes home as base64 over CDP in slices: each slice is encoded on
  // its own, so Node decodes and concatenates them without caring where the
  // boundaries fell.
  M.recSteps = function () { return R.steps; };
  // The recorder's encoder stalls the page ~40 ms about 0.2 s after it
  // starts, which costs one state. So the runner starts it a PRE-ROLL early,
  // and marks here - in the same task that arms the scene's hooks - how many
  // steps into the recording the shot really begins; the encode trims every
  // frame before it (runner.js).
  M.mark = function () { R.mark = M.steps - R.step0; };
  M.markAt = function () { return R.mark || 0; };
  M.slice = function (from, n) {
    const b = R.bytes.subarray(from, Math.min(R.bytes.length, from + n));
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  };

  // ONE CAMERA MOVE AND ONE VIDEO FRAME PER SIM STEP. The display this runs
  // on refreshes far faster than the sim's fixed 1/60 (measured ~175 Hz), so
  // most rAFs carry no step at all and some carry two:
  //   - a camera hook run per RENDER eases a different number of times
  //     between two sim states depending on how many rAFs fell between them,
  //     which is an uneven move per step - a judder the recording keeps;
  //   - canvas.captureStream(60) samples on its own clock, which drifts
  //     against the sim's and doubles or drops a step about once a second.
  // So the camera hook runs here, once per update() after the sim has written
  // its own camera, and the recorder is handed a frame by hand (requestFrame)
  // on the first render after a step. Every step is exactly one video frame
  // and moves the camera exactly once; the encode (runner.js) then times
  // frame N at N/60, so a render that ran long costs nothing on the way out.
  // At the title nothing samples input, so M.tstep is the title's per-step hook.
  M.steps = 0;
  M.tstep = null;
  M.owed = 0;
  let stepped = false;
  function hooks(dt) {
    if (state.mode === 'title' && M.tstep) {
      try { M.tstep(dt); } catch (e) { M.err = String((e && e.stack) || e); M.tstep = null; }
    }
    if (M.cam) { try { M.cam(); } catch (e) { M.err = String((e && e.stack) || e); M.cam = null; } }
  }
  // WHILE RECORDING, NEVER TWO STEPS IN ONE rAF. A late rAF makes the loop
  // run two or three updates back to back (TICK_MAX, js/boot.js), and a
  // canvas capture hands over at most ONE frame per composited frame - so
  // the states in between never reach the video, however they are rendered.
  // Instead the extra steps are OWED and paid one per following rAF (the
  // display refreshes about three times a step), so every state is on
  // screen for a composited frame of its own and the sim is back on the wall
  // clock within a few milliseconds. Staging (DBG.step) is never recording,
  // so it runs every step it is asked for.
  const _update = update;
  update = function (dt) {
    if (R.mr && R.track && stepped) { M.owed++; return; }
    _update(dt);
    M.steps++;
    stepped = true;
    hooks(dt);
  };
  const _render = render;
  render = function () {
    if (R.mr && R.track && !stepped && M.owed > 0) {
      M.owed--;
      _update(TICK_DT);
      M.steps++;
      hooks(TICK_DT);
    }
    _render();
    if (R.track && R.mr && R.sent !== M.steps) { R.sent = M.steps; R.track.requestFrame(); }
    stepped = false;
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
  // snapCam written in WHOLE world px - for a hook that pins the camera to a
  // moving thing every frame (the eagle): a float camera under a float target
  // lands statics and movers on different roundings, which is a shimmer
  M.snapCamI = function (x, y) {
    M.snapCam(x, y);
    camX = Math.round(camX);
    camY = Math.round(camY);
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
  M.live = function (list) {
    const out = [];
    for (let i = 0; i < list.length; i++) { const e = list[i]; if (e && !e.dead && e.hp > 0) out.push(e); }
    return out;
  };
  M.nearestFoe = function (from, list) {
    let best = null, bd = 1e9;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e || e.dead || e.hp <= 0) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };

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
    // off the bird and off the cable: an eagle shot leaves the operator
    // aboard, and M.place clears neither
    player.aboard = false;
    player.dropT = 0;
    if (player.zip >= 0) zipEnd(player, true);
    player.dead = false;
    player.eliminated = false;
    player.respawnT = 0;
    player.hp = player.maxHp;
    player.abLv = [o.ab == null ? 3 : o.ab, o.ab == null ? 3 : o.ab, o.ab == null ? 3 : o.ab, o.ab == null ? 3 : o.ab];
    player.abCd = [0, 0, 0, 0];
    player.name = o.name == null ? 'WREN' : o.name;
    M.clearInput(player);
    settings.shake = o.shake === true;
    M.hideUI(!!o.hideUI);
    settings.pixelCursor = o.cursor !== false;
    M.night(!!o.night);
    M.zoom(o.zoom == null ? 2 : o.zoom);
    M.stageEnd();
  };

  // ------------------------------------------------------------ the camera
  // A RIG WITH ITS OWN POSITION. The play camera writes camX/camY itself every
  // sim step (js/sim.js), so a hook that eases from whatever camX currently is
  // is easing off a floor that already moved - and a frame carrying 0 or 2 sim
  // steps moves it a different amount, which is the judder. The rig keeps its
  // own float, eases that at a fixed rate per FRAME, and writes the result
  // ROUNDED: an integer camera puts statics and movers on the same rounding
  // (CLAUDE.md - screen position is round(world - camera), rounded once), and
  // since a rung is a whole number of device px per world px, a whole-world-px
  // camera is a whole-device-px camera too. That is the whole of the fix.
  M.rig = function (x, y, k) {
    const at = { x: x, y: y };
    const to = { x: x, y: y };
    let ease = k == null ? 0.06 : k;
    function apply() {
      at.x += (to.x - at.x) * ease;
      at.y += (to.y - at.y) * ease;
      camX = Math.round(Math.max(0, Math.min(WORLD * TILE - WV_W, at.x - WV_W / 2)));
      camY = Math.round(Math.max(0, Math.min(WORLD * TILE - WV_H, at.y - WV_H / 2)));
      state.intro = 0;
      state.introFrom = { x: camX, y: camY };
    }
    apply.to = function (nx, ny) { to.x = nx; to.y = ny; };
    apply.rate = function (r) { ease = r; };
    apply.snap = function (nx, ny) {
      if (nx != null) { to.x = nx; to.y = ny; }
      at.x = to.x; at.y = to.y;
      apply();
    };
    apply.at = at;
    return apply;
  };
  // a camera that does not move at all: the safest shot there is
  M.lockCam = function (x, y) {
    const r = M.rig(x, y, 1);
    r.snap();
    return r;
  };
  // The centre of a crowd, for a camera that has to hold a whole fight.
  // `at`/`r` bound it to the FIELD: a body that went down respawns at its own
  // eagle eighty tiles away (respawnPlayer), and counting that one drags the
  // camera clean off the battle mid-clip.
  M.centroid = function (list, at, r) {
    const rad = r == null ? 520 : r;
    let n = 0, sx = 0, sy = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e || e.dead || e.active === false) continue;
      if (typeof inAir === 'function' && e.input && inAir(e)) continue;
      if (at && Math.hypot(e.x - at.x, e.y - at.y) > rad) continue;
      sx += e.x; sy += e.y; n++;
    }
    return n ? { x: sx / n, y: sy / n, n: n } : null;
  };

  // ------------------------------------------------------------ wide ears
  // Every cue the sim raises is gated on nearPlayer (180 px - js/structures.js),
  // which is tuned for a camera sitting on one player's shoulder. A wide shot
  // of a ten-body fight would be almost silent under it, so for capture the
  // gate is widened to ABOUT WHAT THE FRAME SHOWS: audible means on screen.
  M.wideEars = function (on) {
    if (!M._near) M._near = nearPlayer;
    if (on === false) { nearPlayer = M._near; return 180; }
    nearPlayer = function (x, y, r) {
      return M._near(x, y, Math.max(r || 180, Math.hypot(WV_W, WV_H) * 0.62));
    };
    return Math.round(Math.hypot(WV_W, WV_H) * 0.62);
  };

  // --------------------------------------------------------------- a roster
  // Names, not slot numbers. The paint flips with settings.teamBlue (your side
  // is always BLUE on your screen), so these are colour-neutral on purpose.
  M.NAMES = [
    ['WREN', 'ALDER', 'JUNIPER', 'BRIAR', 'FINCH'],
    ['ROWAN', 'ASHE', 'LINNET', 'THORNE', 'SABLE'],
  ];

  // How a staged bot fights, overriding the difficulty notch (p.ai.prof, the
  // one hook aiProfile honours). Tuned for a READABLE battle rather than a
  // winnable one: it engages on sight, spends every ability, never breaks for
  // the objective, never harvests, and never burrows - a bot lying down in the
  // snow mid-fight is a clip of nothing.
  M.FIGHTER = {
    name: 'MONTAGE', sight: 320, react: 0, aim: 7, lead: 0.6, draw: 0.85,
    dodge: 1, abil: 1, flee: 0, work: 0, strafe: 0.55, pick: 'near',
    push: { t: 1e9, n: 0 }, guard: 0, support: false,
  };

  // Two named sides put on the field facing each other up the frame. Returns
  // { mine, foes, all } - the lists a camera and a scene read.
  // `axis` is what the 16:9 frame changed: 'x' stands the two lines LEFT and
  // RIGHT of each other and spreads each one up the screen, which is how a
  // ten-body fight fits a wide frame; 'y' is montage 2's up-the-screen
  // composition, kept for a shot that wants depth.
  M.battle = function (o) {
    o = o || {};
    const per = o.per == null ? 5 : o.per;
    const gap = o.gap == null ? 190 : o.gap;      // px between the two lines
    const span = o.span == null ? 150 : o.span;   // px the line is spread over
    const ax = o.axis === 'y' ? 'y' : 'x';
    const cx = o.x, cy = o.y;
    const sides = [[player], []];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p === player) continue;
      if (sides[0].length < per) sides[0].push(p);
      else if (sides[1].length < per) sides[1].push(p);
    }
    const myTeam = player.team;
    for (let s = 0; s < 2; s++) {
      const line = sides[s];
      const team = s === 0 ? myTeam : 1 - myTeam;
      for (let i = 0; i < line.length; i++) {
        const p = line[i];
        const u = line.length === 1 ? 0.5 : i / (line.length - 1);
        // the line runs along the OTHER axis from the one the gap is on, and
        // every second body steps back out of its neighbour's line of fire
        const back = (s === 0 ? 1 : -1) * (i % 2 ? 16 : 0);
        const x = ax === 'x' ? cx + (s === 0 ? gap / 2 : -gap / 2) + back : cx - span / 2 + u * span + (i % 2 ? 9 : -9);
        const y = ax === 'x' ? cy - span / 2 + u * span + (i % 2 ? 9 : -9) : cy + (s === 0 ? gap / 2 : -gap / 2) + back;
        p.active = true;
        p.aboard = false;
        p.dropT = 0;
        p.team = team;
        // three bows and two swords a side: the hunters hold the line and the
        // warriors are what closes it
        const cls = (i === 1 || i === 3) ? 1 : 0;
        setClass(p, cls);
        M.place(x, y, p);
        p.name = (M.NAMES[s] || [])[i] || ('UNIT-' + (i + 1));
        p.dir = ax === 'x' ? (s === 0 ? 'left' : 'right') : (s === 0 ? 'up' : 'down');
        p.nockT = 0;
        p.abLv = [3, 3, 3, 3];
        p.abCd = [0, 0, 0, 0];
        p.skillPts = 0;
        p.spawn = { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
        if (cls === 0) DBG.equip(0, i === 0 ? 'longbow' : 'recurve', ['arrow', 'arrow', 'arrow'], p);
        if (p !== player) {
          p.control = 'ai';
          p.ai.prof = Object.assign({}, M.FIGHTER, o.prof || {});
        }
      }
    }
    M.wideEars(true);
    return { mine: sides[0], foes: sides[1], all: sides[0].concat(sides[1]) };
  };

  // ------------------------------------------------------- the title screen
  // The menu and the wiki are the REAL title screen, not a mock of it: the
  // page boots into mode 'title' and there is no way back to it out of a live
  // match, so a title scene is filmed before the drop flies out (the runner
  // reloads the page to come back to one). Nothing below touches play state.
  //
  // One catch, and it is the whole of the jitter on these two shots: at the
  // title the camera is a float lissajous written straight into camX/camY
  // (js/sim.js, the `camera` block) and it drifts a fraction of a pixel a
  // frame, so the world under the planks shimmers. M.titleCam rounds it -
  // the same fix M.rig is, one frame at a time.
  M.titleStage = function (o) {
    o = o || {};
    M.stageBegin();
    M.step = null;
    M.cam = null;
    M.tstep = null;
    M.err = null;
    const m = state.menu;
    state.mode = 'title';
    state.fade = null;
    state.intro = 0;
    m.screen = o.screen || 'menu';
    m.panel = o.panel || null;
    m.panelT = o.panel ? 1 : 0;
    m.closing = false;
    m.sel = o.sel == null ? 0 : o.sel;
    m.camT = o.camT == null ? 30 : o.camT;   // where the slow drift is parked
    m.wikiTab = o.tab == null ? 0 : o.tab;
    m.wikiT = m.screen === 'wiki' ? 1 : 0;
    settings.shake = false;
    settings.pixelCursor = o.cursor !== false;
    DBG.hideUI = false;
    M.night(!!o.night);
    M.zoom(o.zoom == null ? 2 : o.zoom);
    M.point(o.mx == null ? VIEW_W / 2 : o.mx, o.my == null ? VIEW_H / 2 : o.my);
    M.fast(2);
    M.stageEnd();
    return { mode: state.mode, screen: m.screen, view: [VIEW_W, VIEW_H] };
  };
  M.titleCam = function () { camX = Math.round(camX); camY = Math.round(camY); };
  // the pointer, in VIEW space - which is what menuHit and wikiHit both read.
  // `moved` is the flag updateTitle waits on before it lets the pointer take
  // the selection off the arrow keys.
  M.point = function (x, y) {
    mouse.inside = true;
    mouse.x = x;
    mouse.y = y;
    state.menu.moved = true;
  };
  // where a menu plank sits this frame, so a scene can walk the pointer down
  // the column without a pixel literal (the geometry is menu.js's own)
  M.plank = function (i) {
    const r = menuLayout().rects[i];
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2, r: r } : { x: VIEW_W / 2, y: VIEW_H / 2 };
  };
  // the wiki's scroll, a little every frame: wikiScrollBy is an instant move
  // (the wheel's own), so a smooth read is small steps rather than one jump
  M.wikiScroll = function (d) { wikiScrollBy(d); return wikiLayout().scroll; };
  M.wikiAt = function () { const L = wikiLayout(); return { page: L.page.id, scroll: Math.round(L.scroll), max: Math.round(L.maxScroll) }; };

  // ---------------------------------------------------------- the 16:9 frame
  // What the fit actually gave us, printed by every scene's stage so a bad
  // viewport is caught at the first clip rather than at the encode.
  M.frame = function () {
    return { view: [VIEW_W, VIEW_H], canvas: [canvas.width, canvas.height], dev: devScale,
      tiles: [+(WV_W / TILE).toFixed(1), +(WV_H / TILE).toFixed(1)],
      ratio: +(canvas.width / canvas.height).toFixed(4) };
  };

  M.ok = true;
})();
