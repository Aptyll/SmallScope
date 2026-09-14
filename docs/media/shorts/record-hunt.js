// Deer-only hunt short: seven beats of one chase, then a comments CTA.
// Injected as a classic script so it shares the game's globals.
(async function recordHunt() {
  const STEPS = 2;
  const W = 1080, H = 1920;
  const CROP_GW = Math.round(360 * 9 / 16);
  const rec = window.__REC = {
    phase: 'boot', clip: 0, frame: 0, total: 0, done: false, error: null, clips: [],
  };

  const cropCv = document.createElement('canvas');
  const outCv = document.createElement('canvas');
  outCv.width = W; outCv.height = H;
  const outCtx = outCv.getContext('2d');
  outCtx.imageSmoothingEnabled = false;

  function actionFocus(ax, ay) {
    const src = canvas;
    const ds = src.width / VIEW_W;
    const ch = src.height;
    const cw = Math.max(1, Math.round(CROP_GW * ds));
    const sx = wToSX(ax) * ds;
    const x = Math.max(0, Math.min(src.width - cw, Math.round(sx - cw / 2)));
    cropCv.width = cw; cropCv.height = ch;
    const c = cropCv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(src, x, 0, cw, ch, 0, 0, cw, ch);
    outCtx.imageSmoothingEnabled = false;
    outCtx.clearRect(0, 0, W, H);
    outCtx.drawImage(cropCv, 0, 0, W, H);
  }

  async function saveFrame() {
    const n = String(rec.total).padStart(4, '0');
    const data = outCv.toDataURL('image/png');
    const res = await fetch('/shot?f=docs/media/shorts/frames/' + n + '.png', {
      method: 'POST', body: data,
    });
    if (!res.ok) throw new Error('shot ' + n + ' ' + res.status);
    rec.total++;
    rec.frame++;
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

  function aimWorld(wx, wy) {
    mouse.inside = true;
    mouse.x = wToSX(wx);
    mouse.y = wToSY(wy);
    player.input.aimX = wx;
    player.input.aimY = wy;
  }

  function walk(mx, my) {
    for (const k of ['w', 'a', 's', 'd']) keys[k] = false;
    if (my < -0.05) keys.w = true;
    if (my > 0.05) keys.s = true;
    if (mx < -0.05) keys.a = true;
    if (mx > 0.05) keys.d = true;
    player.input.mx = mx;
    player.input.my = my;
  }

  function fire(on) { player.input.fire = !!on; }

  function clearShots() {
    arrows.length = 0;
    player.charging = false;
    player.chargeT = 0;
    player.fireArmed = false;
    player.firePrev = false;
    player.input.fire = false;
  }

  function keepDeer(a, x, y, hp) {
    a.dead = false;
    const pin = hp == null ? 12 : hp;
    if ((a.maxHp || 0) < pin) a.maxHp = pin;
    a.hp = Math.max(a.hp || 0, pin);
    a.x = x; a.y = y;
    a.vx = a.vy = 0;
    a.goal = null;
    a.fleeT = 0;
    a.sprint = 0;
    if (animals.indexOf(a) < 0) animals.push(a);
  }

  function parkOthers() {
    for (const p of players) {
      if (p === player) continue;
      p.control = 'none';
      p.x = 40; p.y = 40; p.vx = p.vy = 0;
      p.nockT = 1e9;
    }
  }

  function wipePrey() {
    for (const a of animals) {
      if (a.kind === 'deer' || a.kind === 'rabbit') { a.dead = true; a.x = 32; a.y = 32; }
    }
  }

  function snowAt(tx, ty) {
    return inWorld(tx, ty) && walkable(tx, ty) && !objAt(tx, ty) && ground[idx(tx, ty)] === 0;
  }

  function findMeadow() {
    for (let ty = 70; ty < WORLD - 70; ty += 3) {
      for (let tx = 70; tx < WORLD - 80; tx += 3) {
        let ok = true;
        for (let dy = -5; dy <= 5 && ok; dy++) {
          for (let dx = -6; dx <= 10 && ok; dx++) {
            if (!snowAt(tx + dx, ty + dy)) ok = false;
          }
        }
        if (ok) return { tx, ty };
      }
    }
    return { tx: 90, ty: 100 };
  }

  function spawnDeer(x, y) {
    const a = makeAnimal('deer', x, y);
    a.dir = 'left';
    a.goal = null;
    a.idleT = 99;
    a.fleeT = 0;
    a.alertT = 0;
    a.wary = 0;
    a.senseT = 0;
    a.sprint = 0;
    setClip(a, 'graze');
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
    a.sprint = 0;
    setClip(a, 'graze');
  }

  function placeHunter(x, y) {
    player.x = x; player.y = y;
    player.vx = player.vy = 0;
    player.prone = false; player.hide = 0; player.riseT = 0;
    player.charging = false; player.chargeT = 0;
    player.fireArmed = false; player.firePrev = false;
    player.nockT = 0; player.castT = 0; player.fallT = 0; player.dodgeT = 0;
    player.input.fire = false; player.input.ability = -1;
    player.dir = 'right';
    player.name = '';
    walk(0, 0);
    snapCam();
  }

  async function tick(n, focus, before, after, holdFire) {
    for (let i = 0; i < n; i++) {
      if (before) before(i, n);
      DBG.step(1 / 60, STEPS);
      if (after) after(i, n);
      const f = focus();
      snapCam(f.x, f.y);
      render();
      actionFocus(f.x, f.y);
      await saveFrame();
    }
    walk(0, 0);
    if (!holdFire) fire(false);
  }

  try {
    DBG.freeze = true;
    settings.scheme = 'wasd';
    settings.info = false;
    settings.hitbox = 0;
    settings.pixelCursor = false;
    DBG.hideUI = true;
    DBG.showPaths = false;
    if (typeof ckClear === 'function') ckClear();
    if (typeof PROFILE !== 'undefined' && PROFILE.markDropped) PROFILE.markDropped();
    if (state.menu && state.menu.screen === 'create' && typeof createCommit === 'function') {
      try { createCommit(); } catch (e) { /* already a character */ }
    }

    rec.phase = 'drop';
    startGame();
    dropJump(player, true);
    for (let i = 0; i < 200 && (player.aboard || player.dropT > 0 || state.mode !== 'play'); i++) {
      DBG.step(1 / 60, 1);
    }
    state.dropBrief = null;
    if (player.aboard) { player.aboard = false; player.dropT = 0; state.mode = 'play'; }

    parkOthers();
    setClass(player, 0);
    DBG.equip(0, 'longbow', ['arrow', 'arrow', 'arrow', 'arrow']);
    player.hp = player.maxHp;
    player.dead = false;
    player.name = '';
    state.time = DAY_LEN + 22;
    state.darkness = 1;
    state.dayPop = null;
    state.fade = null;
    state.shake = 0;
    state.intro = 0;
    DBG.setZoom(1.5, true);
    DBG.hideUI = true;
    drawHealthBar = function () {};
    drawLevelBadge = function () {};

    const meadow = findMeadow();
    const ox = (meadow.tx + 0.5) * TILE;
    const oy = (meadow.ty + 0.5) * TILE;
    rec.meadow = meadow;
    wipePrey();

    const _dies = animalDies;
    animalDies = function (a) {
      if (a === deer && rec.clip < 6) {
        a.dead = false;
        a.hp = Math.max(a.hp, 16);
        return;
      }
      _dies(a);
    };

    // ---- 1 Spot 1.4s — deer already on the right third; hunter walks in
    rec.phase = 'spot'; rec.clip = 1; rec.frame = 0;
    placeHunter(ox - 70, oy + 4);
    const deer = spawnDeer(ox + 22, oy - 2);
    snapCam(ox - 16, oy);
    rec.clips.push({ name: 'spot', frames: 42, sec: 1.4 });
    await tick(42, () => mid(deer, 0.62), () => {
      walk(0.28, 0);
      aimWorld(ox + 22, oy - 6);
    }, () => {
      deer.x = ox + 22; deer.y = oy - 2;
      keepGrazing(deer);
    });

    // ---- 2 Draw 1.8s — still at stalk range, head down
    rec.phase = 'draw'; rec.clip = 2; rec.frame = 0;
    placeHunter(ox - 48, oy + 4);
    deer.x = ox + 22; deer.y = oy - 2; deer.maxHp = 80; deer.hp = 80; deer.dead = false;
    keepGrazing(deer);
    rec.clips.push({ name: 'draw', frames: 54, sec: 1.8 });
    await tick(54, () => mid(deer, 0.6), () => {
      walk(0, 0);
      aimWorld(ox + 22, oy - 8);
      fire(true);
    }, () => {
      deer.x = ox + 22; deer.y = oy - 2;
      keepGrazing(deer);
    }, true);

    // ---- 3 Loose 1.2s — arrow, hit, flinch (does not die)
    rec.phase = 'loose'; rec.clip = 3; rec.frame = 0;
    clearShots();
    placeHunter(ox - 46, oy + 4);
    deer.x = ox + 22; deer.y = oy - 2; deer.maxHp = 80; deer.hp = 70; deer.dead = false;
    keepGrazing(deer);
    player.charging = true; player.chargeT = 1.2; player.fireArmed = true; player.firePrev = true;
    rec.clips.push({ name: 'loose', frames: 36, sec: 1.2 });
    await tick(36, () => mid(deer, 0.58), (i) => {
      aimWorld(ox + 22, oy - 8);
      fire(i < 3);
      walk(0, 0);
    }, (i) => {
      keepDeer(deer, i < 14 ? ox + 22 : Math.min(ox + 30, deer.x), oy - 2, 40);
    });

    // ---- 4 Bolt 1.3s — deer runs right, hunter follows, both stay in frame
    rec.phase = 'bolt'; rec.clip = 4; rec.frame = 0;
    clearShots();
    keepDeer(deer, ox + 20, oy - 2, 12);
    deer.fleeT = 0; deer.sprint = 0;
    deer.dir = 'right'; setClip(deer, 'run');
    placeHunter(ox - 36, oy + 4);
    rec.clips.push({ name: 'bolt', frames: 39, sec: 1.3 });
    await tick(39, () => mid(deer, 0.55), (i) => {
      aimWorld(ox + 20 + (i / 38) * 16, oy - 8);
      walk(0.22, 0);
    }, (i) => {
      keepDeer(deer, ox + 20 + (i / 38) * 16, oy - 2, 10);
      deer.dir = 'right';
      setClip(deer, 'run');
    });

    // ---- 5 Draw again 0.9s — second draw on the runner
    rec.phase = 'draw2'; rec.clip = 5; rec.frame = 0;
    clearShots();
    placeHunter(ox - 28, oy + 4);
    keepDeer(deer, ox + 32, oy - 2, 10);
    deer.fleeT = 1.2; deer.sprint = 0; deer.dir = 'right';
    setClip(deer, 'run');
    rec.clips.push({ name: 'draw2', frames: 27, sec: 0.9 });
    await tick(27, () => mid(deer, 0.55), (i) => {
      walk(0.08, 0);
      aimWorld(ox + 34 + (i / 26) * 6, oy - 8);
      fire(true);
    }, (i) => {
      keepDeer(deer, ox + 34 + (i / 26) * 6, oy - 2, 8);
      deer.dir = 'right';
      setClip(deer, 'run');
    }, true);

    // ---- 6 Down 1.3s — second arrow drops it
    rec.phase = 'down'; rec.clip = 6; rec.frame = 0;
    clearShots();
    placeHunter(ox - 24, oy + 4);
    keepDeer(deer, ox + 30, oy - 2, 8);
    deer.hp = 8;
    deer.sprint = 0; deer.dir = 'right'; setClip(deer, 'run');
    player.charging = true; player.chargeT = 1.2; player.fireArmed = true; player.firePrev = true;
    rec.clips.push({ name: 'down', frames: 39, sec: 1.3 });
    await tick(39, () => mid(deer, 0.5), (i) => {
      aimWorld(ox + 30, oy - 8);
      fire(i < 2);
      walk(0, 0);
    }, () => {
      if (!deer.dead) {
        deer.x = ox + 30;
        deer.y = oy - 2;
        deer.vx = deer.vy = 0;
        deer.goal = null;
        deer.fleeT = 0;
        deer.sprint = 0;
      }
    });

    // ---- 7 Gold 0.7s — hold the kill
    rec.phase = 'gold'; rec.clip = 7; rec.frame = 0;
    placeHunter(ox - 20, oy + 4);
    floaters.length = 0;
    keepDeer(deer, ox + 30, oy - 2, 1);
    deer.hp = 1;
    setClip(deer, 'idle');
    deer.dir = 'right';
    addFloater(deer.x, deer.y - 22, '+14', '#ffd95c');
    addFloater(deer.x + 8, deer.y - 30, '+8', '#ffd95c');
    rec.clips.push({ name: 'gold', frames: 21, sec: 0.7 });
    await tick(21, () => mid(deer, 0.48), () => {
      walk(0, 0);
      aimWorld(deer.x, deer.y - 4);
    }, () => {
      keepDeer(deer, ox + 30, oy - 2, 1);
      setClip(deer, 'idle');
    });

    const gameplayFrames = rec.total;
    rec.clips.push({ name: 'cta', frames: 30, sec: 1.0 });
    rec.clips.push({ name: 'loop', frames: 12, sec: 0.4 });

    rec.phase = 'cta'; rec.clip = 8; rec.frame = 0;
    const firstImg = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = '/docs/media/shorts/frames/0000.png';
    });

    const CTA_W = 270, CTA_H = 480;
    const ctaLow = document.createElement('canvas');
    ctaLow.width = CTA_W; ctaLow.height = CTA_H;
    const ct = ctaLow.getContext('2d');
    ct.imageSmoothingEnabled = false;
    const ctaCv = document.createElement('canvas');
    ctaCv.width = W; ctaCv.height = H;
    const ctaHi = ctaCv.getContext('2d');
    ctaHi.imageSmoothingEnabled = false;

    function paintCta() {
      ct.fillStyle = '#0b1338';
      ct.fillRect(0, 0, CTA_W, CTA_H);
      ct.globalAlpha = 0.34;
      ct.imageSmoothingEnabled = false;
      ct.drawImage(firstImg, 0, 0, CTA_W, CTA_H);
      ct.globalAlpha = 1;
      const veil = ct.createLinearGradient(0, 0, 0, CTA_H);
      veil.addColorStop(0, 'rgba(11,19,56,0.25)');
      veil.addColorStop(0.4, 'rgba(11,19,56,0.68)');
      veil.addColorStop(1, 'rgba(11,19,56,0.9)');
      ct.fillStyle = veil;
      ct.fillRect(0, 0, CTA_W, CTA_H);

      const l1 = 'JOIN THE DISCORD';
      const l2 = 'LOOK IN THE COMMENTS';
      const s1 = 3, s2 = 2;
      const y1 = 200;
      drawPixelTextOutline(ct, l1, Math.round((CTA_W - pixelTextWidth(l1, s1)) / 2), y1, '#ffd95c', '#0a0e23', s1);
      const rw = 78, ry = y1 + s1 * 5 + 12, cx = CTA_W >> 1;
      ct.fillStyle = '#ffd95c';
      ct.fillRect(cx - rw, ry, rw * 2, 1);
      ct.fillRect(cx - 1, ry - 2, 3, 5);
      drawPixelTextOutline(ct, l2, Math.round((CTA_W - pixelTextWidth(l2, s2)) / 2), ry + 16, '#f4f7ff', '#0a0e23', s2);

      ctaHi.imageSmoothingEnabled = false;
      ctaHi.clearRect(0, 0, W, H);
      ctaHi.drawImage(ctaLow, 0, 0, W, H);
    }

    for (let i = 0; i < 30; i++) {
      paintCta();
      outCtx.imageSmoothingEnabled = false;
      outCtx.drawImage(ctaCv, 0, 0);
      await saveFrame();
    }

    rec.phase = 'loop'; rec.clip = 9; rec.frame = 0;
    paintCta();
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      outCtx.imageSmoothingEnabled = false;
      outCtx.drawImage(ctaCv, 0, 0);
      outCtx.globalAlpha = t;
      outCtx.drawImage(firstImg, 0, 0, W, H);
      outCtx.globalAlpha = 1;
      await saveFrame();
    }

    rec.gameplayFrames = gameplayFrames;
    rec.phase = 'done';
    rec.done = true;
  } catch (err) {
    rec.error = String(err && err.stack || err);
    rec.done = true;
    rec.phase = 'error';
    console.error(err);
  }
})();
