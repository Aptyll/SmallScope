// Hunt-short capture driver. Injected via CDP. Not shipped.
(function () {
  const FPS = 30;
  const DT = 1 / 60;
  const STEPS = 2;
  const DISCORD = 'DISCORD.GG/XE5WZVZ9ZK';
  const CLIP_DIR = 'docs/media/shorts/_raw';

  const _drawHealthBar = drawHealthBar;
  const _drawLevelBadge = drawLevelBadge;

  function cinemaOn() {
    drawHealthBar = function () {};
    drawLevelBadge = function () {};
    player.name = '';
    DBG.hideUI = true;
    settings.info = false;
    settings.hitbox = 0;
    settings.pixelCursor = false;
    DBG.showPaths = false;
  }

  function snapCam(fx, fy) {
    const x = fx == null ? player.x : fx;
    const y = fy == null ? player.y : fy;
    camX = Math.max(0, Math.min(WORLD * TILE - WV_W, x - WV_W / 2));
    camY = Math.max(0, Math.min(WORLD * TILE - WV_H, y - WV_H / 2));
    state.intro = 0;
    state.introFrom = { x: camX, y: camY };
  }

  function mid(a, t) {
    t = t == null ? 0.5 : t;
    return { x: player.x + (a.x - player.x) * t, y: player.y + (a.y - player.y) * t };
  }

  function clearWalk() {
    keys.w = keys.a = keys.s = keys.d = false;
    keys.arrowup = keys.arrowdown = keys.arrowleft = keys.arrowright = false;
    player.input.mx = player.input.my = 0;
    player.input.dodge = false;
    player.input.ability = -1;
    player.input.work = false;
  }

  function walk(mx, my) {
    clearWalk();
    if (my < -0.05) { keys.w = true; keys.arrowup = true; }
    if (my > 0.05) { keys.s = true; keys.arrowdown = true; }
    if (mx < -0.05) { keys.a = true; keys.arrowleft = true; }
    if (mx > 0.05) { keys.d = true; keys.arrowright = true; }
    player.input.mx = mx;
    player.input.my = my;
  }

  function aimWorld(wx, wy) {
    mouse.inside = true;
    mouse.x = wToSX(wx);
    mouse.y = wToSY(wy);
    player.input.aimX = wx;
    player.input.aimY = wy;
  }

  function fire(on) { player.input.fire = !!on; }

  function findGrove() {
    let best = null, score = -1;
    for (let ty = 64; ty < WORLD - 64; ty += 2) {
      for (let tx = 64; tx < WORLD - 64; tx += 2) {
        let clear = true, trees = 0;
        for (let dy = -9; dy <= 9 && clear; dy++) {
          for (let dx = -9; dx <= 9 && clear; dx++) {
            const x = tx + dx, y = ty + dy;
            if (!inWorld(x, y)) { clear = false; break; }
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            const o = objAt(x, y);
            if (d <= 4) {
              if (!walkable(x, y) || o || ground[idx(x, y)] !== 0) clear = false;
            } else if (o && (o.type === 'tree' || o.type === 'deadTree')) trees++;
          }
        }
        if (clear && trees > score) { score = trees; best = { tx, ty, trees }; }
      }
    }
    return best || { tx: 110, ty: 110, trees: 0 };
  }

  function parkOthers() {
    for (const p of players) {
      if (p === player) continue;
      p.control = 'none';
      p.active = false;
      p.aboard = false;
      p.x = 48; p.y = 48;
      p.nockT = 1e9;
    }
  }

  function wipePrey() {
    for (const a of animals) {
      if (a.kind === 'deer' || a.kind === 'rabbit') { a.dead = true; a.x = 32; a.y = 32; }
    }
  }

  function spawn(kind, x, y, clip, dir) {
    const a = makeAnimal(kind, x, y);
    a.dir = dir || 'left';
    a.goal = null;
    a.idleT = 99;
    a.fleeT = 0;
    a.alertT = 0;
    a.wary = 0;
    a.senseT = 0;
    a.sprint = 1;
    a.dodge = 0;
    setClip(a, clip);
    animals.push(a);
    return a;
  }

  function keepGrazing(a) {
    if (!a || a.dead) return;
    a.goal = null;
    a.fleeT = 0;
    a.alertT = 0;
    a.wary = 0;
    a.senseT = 0;
    a.idleT = 99;
    setClip(a, a.kind === 'deer' ? 'graze' : 'idle');
  }

  function placeHunter(x, y) {
    player.x = x; player.y = y;
    player.vx = player.vy = 0;
    player.prone = false; player.hide = 0;
    player.charging = false; player.chargeT = 0;
    player.fireArmed = false; player.firePrev = false;
    player.nockT = 0; player.castT = 0; player.dodgeT = 0;
    player.input.fire = false; player.input.ability = -1;
    player.dir = 'right';
    walk(0, 0);
    snapCam();
  }

  function skipToPlay() {
    try {
      if (PROFILE && PROFILE.hasChar && !PROFILE.hasChar()) DBG.createCommit();
      if (PROFILE && PROFILE.markDropped) PROFILE.markDropped();
    } catch (e) {}
    settings.scheme = 'wasd';
    DBG.startGame();
    if (typeof dropJump === 'function') dropJump(player, true);
    for (let i = 0; i < 180 && (player.aboard || player.dropT > 0 || state.mode !== 'play'); i++) {
      DBG.step(DT, 1);
    }
    state.dropBrief = null;
    player.aboard = false;
    player.dropT = 0;
    state.mode = 'play';
    state.fade = null;
    state.paused = false;
    state.eagleCine = false;
    state.dayPop = null;
    state.mapOpen = false;
    state.settingsOpen = false;
    state.wheel = null;
    state.shake = 0;
    state.intro = 0;
    state.time = 18;
    parkOthers();
    setClass(player, 0);
    DBG.equip(0, 'longbow', ['arrow', 'arrow', 'arrow']);
    player.abLv = [1, 1, 1, 1];
    player.abCd = [0, 0, 0, 0];
    player.hp = player.maxHp;
    player.dead = false;
    cinemaOn();
    DBG.freeze = true;
    DBG.setZoom(3, true);
    snapCam();
    DBG.step(DT, 2);
  }

  function grabPng() {
    const snap = document.createElement('canvas');
    snap.width = VIEW_W;
    snap.height = VIEW_H;
    const s = snap.getContext('2d');
    s.imageSmoothingEnabled = false;
    s.drawImage(canvas, 0, 0, VIEW_W, VIEW_H);
    return { canvas: snap, b64: snap.toDataURL('image/png').replace(/^data:image\/png;base64,/, '') };
  }

  async function saveFrame(name, i, b64) {
    const f = CLIP_DIR + '/' + name + '/' + String(i).padStart(4, '0') + '.png';
    const res = await fetch('/shot?f=' + encodeURIComponent(f), {
      method: 'POST',
      body: 'data:image/png;base64,' + b64,
    });
    if (!res.ok) throw new Error('shot ' + res.status + ' ' + f);
  }

  async function recordClip(name, n, each) {
    const pending = [];
    let first = null;
    for (let i = 0; i < n; i++) {
      if (each) each(i, n);
      DBG.step(DT, STEPS);
      const g = grabPng();
      if (!first) first = g.canvas;
      pending.push(saveFrame(name, i, g.b64));
      if (pending.length >= 8) await Promise.all(pending.splice(0, pending.length));
    }
    if (pending.length) await Promise.all(pending);
    clearWalk();
    fire(false);
    return first;
  }

  function paintCta(g, alpha, pulse) {
    if (alpha <= 0.01) return;
    g.save();
    g.globalAlpha = alpha;
    const veil = g.createLinearGradient(0, 0, 0, VIEW_H);
    veil.addColorStop(0, 'rgba(8,12,32,0.15)');
    veil.addColorStop(0.45, 'rgba(8,12,32,0.45)');
    veil.addColorStop(1, 'rgba(8,12,32,0.78)');
    g.fillStyle = veil;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    const title = 'SOFTFALL';
    const ts = 5;
    const tx = Math.round((VIEW_W - pixelTextWidth(title, ts)) / 2);
    const ty = 210;
    drawPixelText(g, title, tx + 1, ty + 1, '#3c2a1e', ts);
    drawPixelText(g, title, tx, ty, '#ffd95c', ts);

    const rw = 70, ry = ty + ts * 5 + 10, cx = VIEW_W >> 1;
    g.fillStyle = '#ffd95c';
    g.fillRect(cx - rw, ry, rw * 2, 2);
    g.fillRect(cx - 3, ry - 3, 6, 8);

    const line = 'JOIN THE DISCORD';
    const ls = 2;
    drawPixelTextOutline(g, line, Math.round((VIEW_W - pixelTextWidth(line, ls)) / 2), ry + 18, '#f4f7ff', '#0a0e23', ls);

    const plateW = VIEW_W - 28, plateH = 28;
    const px = 14, py = ry + 40;
    g.fillStyle = '#1a2750';
    g.fillRect(px, py, plateW, plateH);
    g.fillStyle = '#5865f2';
    g.fillRect(px, py, 4, plateH);
    g.fillStyle = '#ffd95c';
    g.fillRect(px, py, plateW, 2);
    g.fillRect(px, py + plateH - 2, plateW, 2);
    const us = 2;
    drawPixelTextOutline(g, DISCORD, Math.round((VIEW_W - pixelTextWidth(DISCORD, us)) / 2), py + 8, '#cfe0ff', '#0a0e23', us);
    g.restore();
  }

  window.__HUNT_SHORT = async function () {
    skipToPlay();
    const G = findGrove();
    const ox = (G.tx + 0.5) * TILE, oy = (G.ty + 0.5) * TILE;
    const log = { grove: G, view: [VIEW_W, VIEW_H], zoom: DBG.getZoom() };

    wipePrey();

    // 1 stalk 1.5s
    placeHunter(ox - 44, oy + 8);
    const deer = spawn('deer', ox + 22, oy - 4, 'graze', 'left');
    await recordClip('c1', 45, () => {
      keepGrazing(deer);
      walk(0.32, -0.05);
      aimWorld(deer.x, deer.y - 4);
      const m = mid(deer, 0.55);
      snapCam(m.x, m.y);
    });

    // 2 draw 1.8s
    placeHunter(ox - 34, oy + 4);
    deer.x = ox + 20; deer.y = oy - 2; deer.hp = deer.maxHp; deer.dead = false;
    keepGrazing(deer);
    await recordClip('c2', 54, () => {
      keepGrazing(deer);
      walk(0, 0);
      aimWorld(deer.x, deer.y - 6);
      fire(true);
      const m = mid(deer, 0.5);
      snapCam(m.x, m.y);
    });

    // 3 loose + hit 1.5s
    placeHunter(ox - 32, oy + 4);
    deer.x = ox + 18; deer.y = oy - 2; deer.hp = 9; deer.dead = false;
    keepGrazing(deer);
    player.charging = true; player.chargeT = 1.2; player.fireArmed = true; player.firePrev = true;
    await recordClip('c3', 45, (i) => {
      aimWorld(deer.x, deer.y - 6);
      fire(i < 2);
      walk(0, 0);
      const m = mid(deer, 0.55);
      snapCam(m.x, m.y);
    });

    // 4 rabbit sit-up 0.8s
    placeHunter(ox - 16, oy + 6);
    const rabbit = spawn('rabbit', ox + 8, oy - 2, 'idle', 'left');
    await recordClip('c4', 24, (i) => {
      if (i < 8) walk(0.3, 0); else walk(0, 0);
      aimWorld(rabbit.x, rabbit.y - 2);
      if (i >= 6) {
        rabbit.alertT = Math.max(rabbit.alertT, 0.25);
        rabbit.fleeT = 0;
        setClip(rabbit, 'rise');
      }
      const m = mid(rabbit, 0.5);
      snapCam(m.x, m.y);
    });

    // 5 rabbit shot 1.2s
    placeHunter(ox - 20, oy + 4);
    rabbit.x = ox + 12; rabbit.y = oy - 2; rabbit.hp = 8; rabbit.dead = false;
    rabbit.dodge = 0; rabbit.alertT = 0; rabbit.fleeT = 1.1;
    rabbit.dir = 'right'; setClip(rabbit, 'hop');
    player.charging = true; player.chargeT = 1.0; player.fireArmed = true; player.firePrev = true;
    await recordClip('c5', 36, (i) => {
      aimWorld(rabbit.x, rabbit.y - 2);
      fire(i < 2);
      walk(0.12, 0);
      const m = mid(rabbit, 0.55);
      snapCam(m.x, m.y);
    });

    // 6 deer sprint 1.4s
    if (deer.dead) { deer.dead = false; deer.hp = 8; }
    deer.x = ox + 6; deer.y = oy; deer.fleeT = 2; deer.sprint = 1;
    deer.dir = 'right'; setClip(deer, 'run');
    placeHunter(ox - 18, oy + 8);
    await recordClip('c6', 42, () => {
      aimWorld(deer.x + 8, deer.y - 6);
      walk(0.55, 0);
      fire(true);
      const m = mid(deer, 0.6);
      snapCam(m.x, m.y);
    });
    fire(false);

    // 7 CTA 1.8s — restage the stalk, burn the Discord card, crossfade to frame 0
    placeHunter(ox - 44, oy + 8);
    deer.x = ox + 22; deer.y = oy - 4; deer.hp = deer.maxHp; deer.dead = false;
    keepGrazing(deer);
    const loop0 = document.createElement('canvas');
    loop0.width = VIEW_W; loop0.height = VIEW_H;
    await recordClip('c7', 54, (i, n) => {
      keepGrazing(deer);
      walk(0.32, -0.05);
      aimWorld(deer.x, deer.y - 4);
      const m = mid(deer, 0.55);
      snapCam(m.x, m.y);
    });

    // rewrite c7 with CTA + loop using the just-captured gameplay, plus c1/0000
    const first = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = '/docs/media/shorts/_raw/c1/0000.png';
    });
    const overlay = document.createElement('canvas');
    overlay.width = VIEW_W; overlay.height = VIEW_H;
    const og = overlay.getContext('2d');
    og.imageSmoothingEnabled = false;
    const pending = [];
    for (let i = 0; i < 54; i++) {
      const u = i / 53;
      const src = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = '/docs/media/shorts/_raw/c7/' + String(i).padStart(4, '0') + '.png?' + Date.now();
      });
      og.clearRect(0, 0, VIEW_W, VIEW_H);
      og.drawImage(src, 0, 0);
      let a = 0, fadeToFirst = 0;
      if (u < 0.12) a = u / 0.12;
      else if (u < 0.62) a = 1;
      else {
        a = Math.max(0, 1 - (u - 0.62) / 0.18);
        fadeToFirst = Math.max(0, (u - 0.72) / 0.28);
      }
      paintCta(og, a, u);
      if (fadeToFirst > 0) {
        og.globalAlpha = fadeToFirst;
        og.drawImage(first, 0, 0);
        og.globalAlpha = 1;
      }
      const b64 = overlay.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
      pending.push(saveFrame('c7', i, b64));
      if (pending.length >= 6) await Promise.all(pending.splice(0, pending.length));
    }
    if (pending.length) await Promise.all(pending);

    log.clips = [
      { id: 'c1', sec: 1.5 }, { id: 'c2', sec: 1.8 }, { id: 'c3', sec: 1.5 },
      { id: 'c4', sec: 0.8 }, { id: 'c5', sec: 1.2 }, { id: 'c6', sec: 1.4 },
      { id: 'c7', sec: 1.8 },
    ];
    log.total = 10;
    drawHealthBar = _drawHealthBar;
    drawLevelBadge = _drawLevelBadge;
    return log;
  };
})();
