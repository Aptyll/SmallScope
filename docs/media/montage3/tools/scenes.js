// Montage 3: the Steam-page cut. One entry per clip - `stage` runs frozen and
// muted, `roll` arms the per-step and per-frame hooks, and the clip is `sec` of
// real time with the canvas and the tapped SFX bus going into one MediaRecorder.
//
// THE FRAME IS 16:9. A 1080-tall viewport makes fitCanvas take 3 device px per
// game px, which lands the view on exactly 640x360 - the game's own authored
// frame - so the canvas is 1920x1080 with nothing cropped, letterboxed or
// rescaled, and every zoom rung is an exact third (0.6667, 1, 1.3333 ... 4.6667).
// Every shot is composed ACROSS the frame rather than up it: the two lines of a
// battle stand left and right of each other (M.battle's axis 'x'), a charge
// crosses the screen, and the widest rung holds 60 x 34 tiles at once.
//
// THE CAMERA NEVER JITTERS, by four rules kept together:
//   - screen shake is off (settings.shake, set in M.reset) - it is a random
//     per-frame offset, and with the widened audio gate every hit in a
//     ten-body fight would raise one;
//   - the camera is a rig with its OWN position (M.rig), so it never eases off
//     camX, which the sim has already moved this step - and a frame carrying 0
//     or 2 sim steps moves it by different amounts, which is the judder;
//   - the rig writes WHOLE world pixels, which on any rung is a whole number of
//     device pixels, so statics and movers round identically;
//   - at the TITLE the camera is not the rig's: it is a float lissajous the sim
//     writes straight into camX/camY, so the title shots round it themselves
//     (M.titleCam) or the world under the planks shimmers.
//
// The first three shots are filmed at the title screen (`title: true`) BEFORE
// the drop flies out, because there is no way back to the menu from a live
// match; the runner reloads the page if one is asked for after a play shot.

// ---------------------------------------------------------------- scouting
// Locations are scouted once into window.__W so a scene can ask for a field, a
// grove, a rock or an arena by name. It is one pass over the interior: a wide
// battlefield wants ROOM and a treeline to read against, a chop wants pines
// close enough to fill a wide frame, and everything wants to be away from the
// two roosts (a cut-off eagle in the corner is a distraction).
const PROLOGUE = `(function(){
  if (window.__W) return 'cached';
  const LO = 58, HI = 174;
  function clear(tx, ty, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (!inWorld(x, y) || !walkable(x, y) || objAt(x, y) || ground[idx(x, y)] !== 0) return false;
    }
    return true;
  }
  function count(tx, ty, r, pred) {
    let n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (inWorld(x, y) && pred(x, y)) n++;
    }
    return n;
  }
  const isTree = function (x, y) { const o = objAt(x, y); return !!o && o.type === 'tree'; };
  const isRock = function (x, y) { const o = objAt(x, y); return !!o && o.type === 'rock'; };
  const eag = (state.drop && state.drop.eagles || []).map(function (e) { return { x: e.x / 16, y: e.y / 16 }; });
  function offEagle(tx, ty) {
    let far = 99;
    for (let i = 0; i < eag.length; i++) far = Math.min(far, Math.hypot(tx - eag[i].x, ty - eag[i].y));
    return far;
  }
  const W = { grove: null, rock: null, open: null, arena: null, field: null };
  let bg = -1, bo = -1, ba = -1, bf = -1e9;
  for (let ty = LO; ty <= HI; ty += 2) {
    for (let tx = LO; tx <= HI; tx += 2) {
      // a GROVE: a clear floor with pines packed round it, for a chop
      if (clear(tx, ty, 2)) {
        const t = count(tx, ty, 6, isTree);
        if (t >= 5 && t <= 20 && t > bg) { bg = t; W.grove = { tx: tx, ty: ty, trees: t }; }
      }
      // an ARENA: a clear floor 8 tiles every way (a 16:9 frame at zoom 2 is
      // 20 x 11 tiles) with a treeline in the ring outside it - a white void
      // reads as nothing at any zoom
      if (clear(tx, ty, 8)) {
        const near = count(tx, ty, 14, isTree);
        const d = Math.abs(tx - 116) + Math.abs(ty - 116);
        if (near === 0 && (bo < 0 || d < bo)) { bo = d; W.open = { tx: tx, ty: ty }; }
        if (near > ba && near <= 46) { ba = near; W.arena = { tx: tx, ty: ty, trees: near }; }
      }
      if (!W.rock) { const r = count(tx, ty, 4, isRock); if (r >= 1 && clear(tx, ty, 1)) W.rock = { tx: tx, ty: ty, rocks: r }; }
    }
  }
  // a FIELD for ten bodies: scored on how much of a wide box a body could
  // stand in, plus a little for the ring of pines behind it
  const R = 12, RING = 20;
  for (let ty = 64; ty <= 168; ty += 2) {
    for (let tx = 64; tx <= 168; tx += 2) {
      let open = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = tx + dx, y = ty + dy;
        if (inWorld(x, y) && walkable(x, y) && !objAt(x, y) && ground[idx(x, y)] === 0) open++;
      }
      if (open < 460) continue;
      let trees = 0;
      for (let dy = -RING; dy <= RING; dy += 2) for (let dx = -RING; dx <= RING; dx += 2) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= R) continue;
        const o = objAt(tx + dx, ty + dy);
        if (o && o.type === 'tree') trees++;
      }
      const score = open + Math.min(trees, 30) * 3 + Math.min(offEagle(tx, ty), 46) * 4
        - (Math.abs(tx - 116) + Math.abs(ty - 116)) * 0.5;
      if (score > bf) { bf = score; W.field = { tx: tx, ty: ty, open: open, trees: trees, eagle: Math.round(offEagle(tx, ty)) }; }
    }
  }
  // a LANE: a strip clear enough to act across (21 x 5 tiles) with a
  // treeline standing just BEHIND it and nothing in front. The close shots'
  // backdrop: at zoom 2-3 a 16:9 frame is only 13-20 tiles wide, so an
  // ARENA's ring of pines is out of shot and the action plays on white.
  // Pines in front are what is punished hardest - the y-sort draws them over
  // the bodies.
  function clearBox(tx, ty, rx, ry) {
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      const x = tx + dx, y = ty + dy;
      if (!inWorld(x, y) || !walkable(x, y) || objAt(x, y) || ground[idx(x, y)] !== 0) return false;
    }
    return true;
  }
  let bl = -1e9;
  for (const rx of [10, 8]) {
    for (let ty = 44; ty <= 188; ty += 1) {
      for (let tx = 44; tx <= 188; tx += 1) {
        if (!clearBox(tx, ty, rx, 2)) continue;
        // COLS is how much of the WIDTH has a pine behind it: a clump at
        // one end scores the same trees as a line and fills a corner, not a
        // backdrop
        let back = 0, front = 0, cols = 0;
        for (let dx = -rx - 2; dx <= rx + 2; dx++) {
          let any = false;
          for (let dy = -5; dy <= -3; dy++) if (isTree(tx + dx, ty + dy)) { back++; any = true; }
          if (any) cols++;
          for (let dy = 3; dy <= 6; dy++) if (isTree(tx + dx, ty + dy)) front++;
        }
        const sc = cols * 3 + back - front * 4 + Math.min(offEagle(tx, ty), 30) * 0.5;
        if (sc > bl && cols >= 8) { bl = sc; W.lane = { tx: tx, ty: ty, rx: rx, back: back, cols: cols, front: front }; }
      }
    }
    if (W.lane) break;
  }
  if (!W.open) W.open = W.arena;
  if (!W.field) W.field = W.arena;
  if (!W.lane) W.lane = { tx: W.arena.tx, ty: W.arena.ty, rx: 8, back: 0, front: 0 };
  window.__W = W;
  return JSON.stringify(W);
})()`;

// A rival body to shoot, stomp, rush or loot. `remote` is the control mode
// that matters: 'none' is a GHOST at its camp (js/player.js) and draws as a
// pale silhouette with no plate, while a remote human with no inputs arriving
// is a solid, named, inert body - exactly what a staged scene wants.
const RIVAL = `function rival(x, y, opts) {
  opts = opts || {};
  const q = players[opts.slot == null ? 6 : opts.slot];
  q.control = opts.ai ? 'ai' : 'remote';
  q.active = true;
  q.aboard = false;
  q.dropT = 0;
  q.team = opts.team == null ? 1 - player.team : opts.team;
  setClass(q, opts.cls == null ? 1 : opts.cls);
  __M.place(x, y, q);
  // a real name off the rival roster, one per slot (5 ROWAN ... 9 SABLE),
  // never a placeholder plate over the body
  q.name = opts.name || __M.NAMES[1][Math.max(0, Math.min(4, (opts.slot == null ? 6 : opts.slot) - 5))];
  q.dir = opts.dir || 'down';
  q.nockT = opts.armed ? 0 : 1e9;
  q.hp = opts.hp == null ? q.maxHp : opts.hp;
  q.abLv = [1, 1, 1, 1];
  q.abCd = [0, 0, 0, 0];
  q.spawn = { tx: Math.floor(x / 16), ty: Math.floor(y / 16) };
  if (opts.bag) for (const k in opts.bag) bagAdd(q, k, opts.bag[k]);
  return q;
}`;

// A barracks off in the treeline is all makeSoldier needs for its chassis and
// its hit points; the column itself is lifted onto the scene by hand and its
// march cleared, so the only rung left is "a rival unit in aggro range".
const BOTS = `function barracksFor(team, tx, ty) {
  const o = DBG.buildStruct(tx, ty, 'barracks', 0);
  o.team = team;
  o.owner = team === player.team ? player.id : 6;
  DBG.finishBuild(o);
  o.building = false;
  return o;
}
function soldierAt(bar, x, y, team) {
  const b = makeSoldier(bar);
  b.team = team;
  b.x = x; b.y = y;
  b.way = [];
  b.wayI = 99;
  robots.push(b);
  return b;
}`;

// Open a team battle: the field, the roster, the rig. Every battle shot starts
// here so the ten bodies, the names and the camera are set up one way. The axis
// defaults to 'x' - the two lines stand LEFT and RIGHT of each other, which is
// what fits a wide frame.
const OPEN = `window.openBattle = function (o) {
  o = o || {};
  const W = window.__W;
  __M.reset({ zoom: o.zoom == null ? 1 : o.zoom, night: !!o.night, cls: o.cls == null ? 0 : o.cls,
    hideUI: !!o.hideUI, cursor: o.cursor !== false, name: 'WREN' });
  __M.stageBegin();
  settings.aiLevel = 2;
  const c = __M.tile(W.field.tx, W.field.ty);
  const B = __M.battle({ x: c.x, y: c.y, axis: o.axis || 'x', gap: o.gap == null ? 210 : o.gap,
    span: o.span == null ? 130 : o.span, prof: o.prof });
  __M.wideEars(true);
  __M.keepUp = true;
  const R = __M.rig(c.x, c.y, o.ease == null ? 0.05 : o.ease);
  R.snap();
  window.__S = { c: c, B: B, R: R };
  if (o.warm) __M.fast(o.warm);
  __M.stageEnd();
  return window.__S;
};
// the camera every battle shot uses: hold the middle of whoever is still up,
// eased by the rig and written as whole pixels
window.holdFight = function (bias) {
  return function () {
    const S = window.__S;
    const m = __M.centroid(S.B.all, S.c, 560);
    if (m) S.R.to(m.x + (bias || 0), m.y);
    S.R();
  };
};
// the local player fights like everyone else: nearest foe, draw, loose
window.fightOn = function (t, dt, period) {
  const S = window.__S;
  const f = __M.nearestFoe(player, S.B.foes);
  if (f) __M.aim(f.x, f.y - 4);
  __M.walk(0, 0);
  __M.fire(t % (period || 1.1) < (period || 1.1) - 0.2);
};`;

const scenes = [
  // ==================================================== the title screen ===
  // Filmed on the real menu before the drop flies out. These are the only two
  // shots in the run where the music layer is even asked for (beginWiki starts
  // WHISPERING WOODS) - it sits at volume 0 and, being HTMLAudioElement, has
  // never been in the WebAudio graph the tap mirrors.
  {
    name: '01-main-menu-the-frost-planks',
    title: true,
    sec: 5,
    stage: `(function () {
      const r = __M.titleStage({ zoom: 2, camT: 26, sel: 0 });
      return JSON.stringify(Object.assign(r, __M.frame(), { planks: MENU_ITEMS }));
    })()`,
    roll: `(function(){
      let t = 0;
      // the pointer walks down the column and each plank lifts as it arrives -
      // the hover ease is the menu's own (updateTitle), so this is a hand on
      // the mouse and nothing else
      __M.tstep = function (dt) {
        t += dt;
        const n = MENU_ITEMS.length;
        const u = Math.min(0.999, t / 4.4);
        const i = Math.floor(u * n);
        const a = __M.plank(i);
        const b = __M.plank(Math.min(n - 1, i + 1));
        const q = (u * n) % 1;
        __M.point(a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q);
      };
      __M.cam = __M.titleCam;
    })()`,
  },

  {
    name: '02-the-wiki-classes-page-scrolls',
    title: true,
    sec: 5,
    stage: `(function () {
      __M.titleStage({ zoom: 2, camT: 62, screen: 'wiki', tab: 0 });
      __M.stageBegin();
      wikiScroll[WIKI_PAGES[0].id] = 0;
      __M.fast(30); // the surface eased all the way in before the clip opens
      __M.stageEnd();
      return JSON.stringify(Object.assign(__M.wikiAt(), { tabs: WIKI_PAGES.map(function(p){return p.label;}) }));
    })()`,
    roll: `(function(){
      let t = 0, want = 0;
      __M.cam = __M.titleCam;
      __M.tstep = function (dt) {
        t += dt;
        // the whole CLASSES page inside the clip - both classes, their stat
        // pips and all eight abilities - at 62 px a second, moved in WHOLE
        // pixels so the text never lands between two rows of the grid
        if (t > 0.5) want += 62 / 60;
        const L = wikiLayout();
        const d = Math.floor(want) - Math.round(L.scroll);
        if (d > 0) __M.wikiScroll(d);
        // the hand rides the rail, which is what reads as scrolling - over a
        // row it would raise that row's tooltip card
        __M.point(L.rail.x + 2, L.thumb.y + (L.thumb.h >> 1));
      };
    })()`,
  },

  {
    name: '03-the-wiki-arsenal-and-beasts-tabs',
    title: true,
    sec: 5,
    stage: `(function () {
      __M.titleStage({ zoom: 2, camT: 88, screen: 'wiki', tab: 2 });
      __M.stageBegin();
      for (const p of WIKI_PAGES) wikiScroll[p.id] = 0;
      __M.fast(30);
      __M.stageEnd();
      return JSON.stringify(__M.wikiAt());
    })()`,
    roll: `(function(){
      let t = 0, at = 2, want = 0;
      __M.cam = __M.titleCam;
      __M.tstep = function (dt) {
        t += dt;
        // the ARSENAL table scrolled, then the pointer goes up to the BEASTS
        // tab and clicks it (wikiClick - the tab's own press and its cue),
        // and the beast cards scroll in under it
        const L = wikiLayout();
        if (at === 2) {
          if (t > 0.4) want += 80 / 60;
          const d = Math.floor(want) - Math.round(L.scroll);
          if (d > 0) __M.wikiScroll(d);
          if (t < 2.3) __M.point(L.rail.x + 2, L.thumb.y + (L.thumb.h >> 1));
          else {
            // the hand travels to the tab over half a second, then presses
            const tab = L.tabs[1];
            const u = Math.min(1, (t - 2.3) / 0.5);
            const ex = tab.x + (tab.w >> 1), ey = tab.y + 4;
            const sx = L.rail.x + 2, sy = L.thumb.y + (L.thumb.h >> 1);
            __M.point(sx + (ex - sx) * u, sy + (ey - sy) * u);
            if (u >= 1) { wikiClick(); at = 1; want = 0; }
          }
        } else {
          if (t > 3.2) want += 60 / 60;
          const d = Math.floor(want) - Math.round(L.scroll);
          if (d > 0) __M.wikiScroll(d);
        }
      };
    })()`,
  },

  // ======================================================== the way in ====
  {
    name: '04-the-eagle-carries-the-team-in',
    sec: 5,
    stage: `(function () {
      // the whole side rides: nobody parked, every body named, so the wing
      // seats fill and the bots leap on their own spread across the window
      __M.reset({ hideUI: true, cursor: false, keep: players.slice() });
      __M.stageBegin();
      const seat = [0, 0];
      for (const p of players) {
        p.active = true;
        p.dead = false;
        const side = p.team === player.team ? 0 : 1;
        p.name = p === player ? 'WREN' : side === 0 ? __M.NAMES[0][1 + (seat[0]++ % 4)] : __M.NAMES[1][seat[1]++ % 5];
        if (p !== player && p.control !== 'ai') p.control = 'ai';
      }
      beginDrop();
      player.aboard = true;
      state.dropBrief = null;
      __M.fast(70);
      state.dropBrief = null;
      __M.stageEnd();
      return 'mode=' + state.mode + ' aboard=' + player.aboard + ' ' + JSON.stringify(__M.frame());
    })()`,
    roll: `__M.step = function () { state.dropBrief = null; __M.clearInput(player); };
    __M.cam = function () {
      // the ride pins DROP_ZOOM every step (applyZoom, js/sim.js); at 16:9 the
      // widest rung is 60 x 34 tiles and the bird crosses a vista, so the shot
      // takes that framing rather than fighting it
      __M.forceZoom(0.6667);
      const e = state.drop.eagles[player.team];
      __M.snapCamI(e.x, e.y);
    };`,
  },

  {
    name: '05-the-team-leaps-off-into-the-fall',
    sec: 4,
    stage: `(function () {
      // the whole side rides: nobody parked, every body named, so the wing
      // seats fill and the bots leap on their own spread across the window
      __M.reset({ hideUI: true, cursor: false, keep: players.slice() });
      __M.stageBegin();
      const seat = [0, 0];
      for (const p of players) {
        p.active = true;
        p.dead = false;
        const side = p.team === player.team ? 0 : 1;
        p.name = p === player ? 'WREN' : side === 0 ? __M.NAMES[0][1 + (seat[0]++ % 4)] : __M.NAMES[1][seat[1]++ % 5];
        if (p !== player && p.control !== 'ai') p.control = 'ai';
      }
      beginDrop();
      player.aboard = true;
      __M.fast(170);
      state.dropBrief = null;
      __M.stageEnd();
      return 'mode=' + state.mode + ' aboard=' + player.aboard;
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        state.dropBrief = null;
        t += dt;
        if (t > 0.8 && player.aboard) DBG.dropJump(player);
        if (player.aboard) __M.clearInput(player);
      };
      // locked to the bird while aboard, then eased down onto the falling
      // body - a camera left at the midpoint drifts off after the bird
      const e0 = state.drop.eagles[player.team];
      const R = __M.rig(e0.x, e0.y, 1);
      __M.cam = function () {
        __M.forceZoom(1.3333);
        const e = state.drop.eagles[player.team];
        if (player.aboard) { R.rate(1); R.to(e.x, e.y); }
        else { R.rate(0.08); R.to(player.x, player.y - 20); }
        R();
      };
    })()`,
  },

  // =================================================== work on the land ===
  {
    name: '06-chop-a-pine-down-to-the-stump',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 3 });
      __M.stageBegin();
      const t = __M.nearObj(W.grove.tx, W.grove.ty, 'tree', 9);
      const c = __M.tile(t.tx, t.ty);
      // Out of reach to begin with: a tree in reach is struck with no key at
      // all (auto-work, js/actions.js), so a body standing beside one has it
      // down before the clip has a beat to breathe. It walks in from the left
      // instead, and stops a stride short of the trunk.
      __M.place(c.x - 58, c.y + 2);
      player.dir = 'right';
      DBG.setSwing(1);
      window.__S = { c: c, R: __M.lockCam(c.x - 10, c.y - 6) };
      __M.stageEnd();
      return 'tree ' + t.tx + ',' + t.ty + ' hp=' + t.o.hp + ' rare=' + !!t.o.rare;
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.c.x, S.c.y);
        // walk in from 0.6 s until the body stands in the tile beside the
        // trunk - WORK_REACH is one tile, Chebyshev - and the hands take over
        const near = Math.floor(player.x / TILE) >= Math.floor(S.c.x / TILE) - 1;
        __M.walk(t > 0.6 && !near ? 1 : 0, 0);
        player.input.work = near;
      };
      __M.cam = function () { window.__S.R(); };
    })()`,
  },

  {
    name: '07-mine-a-rock-to-rubble',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 3.3333 });
      __M.stageBegin();
      const r = __M.nearObj(W.rock.tx, W.rock.ty, 'rock', 9);
      const c = __M.tile(r.tx, r.ty);
      __M.place(c.x - 20, c.y + 4);
      player.dir = 'right';
      DBG.setSwing(1);
      window.__S = { c: c, R: __M.lockCam(c.x - 6, c.y - 22) };
      __M.stageEnd();
      return 'rock ' + r.tx + ',' + r.ty;
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.c.x, S.c.y);
        __M.walk(0, 0);
        player.input.work = t > 0.6;
      };
      __M.cam = function () { window.__S.R(); };
    })()`,
  },

  // ==================================================== the weapon well ===
  {
    name: '08-swap-the-tool-for-a-loaded-longbow',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 2 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      // The walk crosses a locked frame left to right, in front of the
      // treeline, over a built longbow and then two piles of fittings: the
      // tool takes the hand (the swap icons rise off it) and each bit loads
      // itself into a free cell. M.walk presses the real keys, so it is a
      // full walk (measured ~76 px/s), and a pickup is pulled in from about
      // 40 px: 90 px apart is one every 1.2 s, and the walk stops at 3.8 s
      // with the last one in and the whole body still in frame.
      __M.place(c.x - 190, c.y + 6);
      player.dir = 'right';
      DBG.equip(0, 'shortbow', ['arrow']);
      const it = DBG.makeTool('longbow');
      it.bits[0] = 'lance'; it.bits[1] = 'heft'; it.bits[2] = 'twin';
      spawnDrop(c.x - 110, c.y + 7, 'tool:longbow', 1, it);
      spawnDrop(c.x - 20, c.y + 4, 'bit:pyre', 3);
      spawnDrop(c.x + 70, c.y + 9, 'bit:cinder', 2);
      window.__S = { c: c, R: __M.lockCam(c.x - 25, c.y - 20) };
      __M.stageEnd();
      return 'drops=' + drops.length + ' tool=' + player.tools[0].type;
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        t += dt;
        __M.aim(player.x + 60, player.y);
        // stop by POSITION once the last pile is in: a body slides on after
        // the keys come up, so a timed stop lands wherever the snow leaves it
        __M.walk(player.x < window.__S.c.x + 50 ? 1 : 0, 0);
      };
      __M.cam = function () { window.__S.R(); };
    })()`,
  },

  // ======================================================== the big gun ===
  {
    name: '09-hefty-wand-fans-burning-shots',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 2 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      __M.place(c.x - 120, c.y + 6);
      player.dir = 'right';
      // the heaviest body in the game packed to its tensile limit: HEFT under
      // a SPLITTER under a CINDER BURST is one press throwing a fan of fat
      // burning shots that leave a ring of embers where they land
      DBG.equip(0, 'longbow', ['heft', 'fan', 'cinder', 'lance', 'lance']);
      const foes = [];
      for (let i = 0; i < 5; i++) {
        const a = DBG.spawnAnimal('wolf', c.x + 10 + (i % 2) * 54, c.y - 26 + i * 15);
        a.dir = 'left';
        foes.push(a);
      }
      window.__S = { c: c, foes: foes, R: __M.lockCam(c.x - 34, c.y - 22) };
      __M.stageEnd();
      return 'foes=' + foes.length + ' bits=' + JSON.stringify(player.tools[0].bits);
    })()`,
    roll: `(function(){
      let t = 0, phase = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        const live = S.foes.filter(function (f) { return !f.dead; });
        const f = live.length ? live[phase % live.length] : { x: S.c.x + 40, y: S.c.y };
        __M.aim(f.x, f.y - 4);
        __M.walk(0, 0);
        const u = t % 1.15;
        __M.fire(u < 0.9);
        if (u >= 0.9 && u < 0.9 + dt) phase++;
      };
      __M.cam = function () { window.__S.R(); };
    })()`,
  },

  // ======================================================= the abilities ==
  {
    name: '10-warrior-bull-rush-carries-a-body',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 1, zoom: 2.6667 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      // the charge crosses the frame left to right, with the telegraph line on
      // the snow ahead of it
      __M.place(c.x - 104, c.y + 4);
      player.dir = 'right';
      const a = rival(c.x - 14, c.y + 4, { hp: 90, dir: 'left' });
      window.__S = { c: c, a: a, R: __M.lockCam(c.x - 36, c.y - 22) };
      __M.stageEnd();
      return 'ab=' + DBG.CLASS_AB[1][1].name;
    })()`,
    roll: `(function(){
      let t = 0, cast = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.c.x + 90, S.c.y + 4);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.45) ? 1 : -1;
        if (t > 0.45) cast = true;
      };
      __M.cam = function () { window.__S.R(); };
    })()`,
  },

  {
    name: '11-warrior-stomp-cracks-the-snow',
    sec: 3,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 1, zoom: 2.6667 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      __M.place(c.x, c.y + 4);
      player.dir = 'right';
      const a = rival(c.x - 26, c.y - 12, { hp: 60, dir: 'right' });
      const b = rival(c.x + 30, c.y - 4, { slot: 7, hp: 60, dir: 'left' });
      const d = rival(c.x + 10, c.y + 30, { slot: 8, hp: 60, dir: 'up' });
      window.__S = { c: c, a: a, b: b, d: d, R: __M.lockCam(c.x + 2, c.y - 22) };
      __M.stageEnd();
      return 'ab=' + DBG.CLASS_AB[1][2].name;
    })()`,
    roll: `(function(){
      let t = 0, cast = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.b.x, S.b.y);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.4) ? 2 : -1;
        if (t > 0.4) cast = true;
      };
      __M.cam = function () { window.__S.R(); };
    })()`,
  },

  {
    name: '12-warrior-shield-wall-then-slam',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 1, zoom: 3 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      __M.place(c.x - 30, c.y + 4);
      player.dir = 'right';
      const a = rival(c.x + 4, c.y - 6, { hp: 70, armed: true, dir: 'left' });
      const b = rival(c.x + 22, c.y + 16, { slot: 7, hp: 70, dir: 'left' });
      window.__S = { c: c, a: a, b: b, R: __M.lockCam(c.x - 8, c.y - 22) };
      __M.stageEnd();
      return 'ab=' + DBG.CLASS_AB[1][0].name;
    })()`,
    roll: `(function(){
      let t = 0, up = false, slam = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.a.x, S.a.y - 4);
        __M.walk(0, 0);
        player.input.ability = -1;
        if (!up && t > 0.35) { player.input.ability = 0; up = true; }
        else if (up && !slam && t > 1.9) { player.input.ability = 0; slam = true; }
      };
      __M.cam = function () { window.__S.R(); };
    })()`,
  },

  {
    name: '13-hunter-piercing-shot-down-the-rank',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 1.6667 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      // the rank runs off across the widest axis there is: one arrow through
      // four stacked bodies, all of them in frame
      __M.place(c.x - 148, c.y + 4);
      player.dir = 'right';
      DBG.equip(0, 'longbow', ['arrow', 'arrow', 'arrow']);
      const line = [];
      for (let i = 0; i < 4; i++) line.push(rival(c.x - 44 + i * 54, c.y + 4 + (i % 2 ? 5 : -5), { slot: 6 + i, hp: 55, dir: 'left' }));
      window.__S = { c: c, line: line, R: __M.lockCam(c.x - 24, c.y - 22) };
      __M.stageEnd();
      return 'line=' + line.length + ' ab=' + DBG.CLASS_AB[0][0].name;
    })()`,
    roll: `(function(){
      let t = 0, cast = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.c.x + 200, S.c.y + 4);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.5) ? 0 : -1;
        if (t > 0.5) cast = true;
      };
      __M.cam = function () { window.__S.R(); };
    })()`,
  },

  {
    name: '14-hunter-net-shot-drops-a-drape',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 2.6667 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      __M.place(c.x - 60, c.y + 4);
      player.dir = 'right';
      DBG.equip(0, 'longbow', ['arrow', 'arrow']);
      const a = rival(c.x + 26, c.y - 2, { hp: 80, dir: 'left' });
      window.__S = { c: c, a: a, R: __M.lockCam(c.x - 14, c.y - 22) };
      __M.stageEnd();
      return 'ab=' + DBG.CLASS_AB[0][1].name;
    })()`,
    roll: `(function(){
      let t = 0, cast = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.a.x, S.a.y - 2);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.5) ? 1 : -1;
        if (t > 0.5) cast = true;
      };
      __M.cam = function () { window.__S.R(); };
    })()`,
  },

  {
    name: '15-hunter-grapple-reels-into-the-pines',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 2.3333 });
      __M.stageBegin();
      const t = __M.nearObj(W.grove.tx, W.grove.ty, 'tree', 9);
      const c = __M.tile(t.tx, t.ty);
      __M.place(c.x - 150, c.y + 8);
      player.dir = 'right';
      window.__S = { c: c, R: __M.rig(c.x - 80, c.y + 4, 0.12) };
      window.__S.R.snap();
      __M.stageEnd();
      return 'tree ' + t.tx + ',' + t.ty + ' ab=' + DBG.CLASS_AB[0][2].name;
    })()`,
    roll: `(function(){
      let t = 0, cast = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.c.x - 4, S.c.y + 4);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.5) ? 2 : -1;
        if (t > 0.5) cast = true;
        player.input.grapple = t > 0.5;
      };
      __M.cam = function () { const S = window.__S; S.R.to(player.x + 30, player.y); S.R(); };
    })()`,
  },

  {
    name: '16-dodge-roll-through-a-charging-wolf',
    sec: 3,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 2.6667 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      // a roll carries a body a long way and the snow slides it further
      // (measured: ~190 px from the press to rest), so the frame is centred
      // on where it ends up, not where it starts
      __M.place(c.x - 80, c.y + 4);
      player.dir = 'right';
      const w = DBG.spawnAnimal('wolf', c.x - 30, c.y + 4);
      w.dir = 'left';
      window.__S = { c: c, w: w, R: __M.rig(c.x - 20, c.y - 22, 0.07) };
      window.__S.R.snap();
      __M.stageEnd();
      return 'wolf hp=' + Math.round(w.hp);
    })()`,
    roll: `(function(){
      let t = 0, rolled = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.w.x, S.w.y);
        __M.walk(t < 0.5 ? 1 : 0, 0);
        player.input.dodge = false;
        if (!rolled && t > 0.35) { player.input.dodge = true; rolled = true; }
      };
      // the roll's hit and the wolf's answer both shove the body, so the rig
      // follows it - eased, and in whole pixels
      __M.cam = function () { const S = window.__S; S.R.to(player.x - 10, S.c.y - 22); S.R(); };
    })()`,
  },

  // ====================================================== what spills ======
  {
    name: '17-three-chests-burst-their-hoard-into-the-snow',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 2.3333 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      // Three buried caches out of the treeline, stood in a row on open snow
      // in front of it so each spill reads: gold straight into the purse, a
      // card, and the one place a TOP-tier tool or bit is found (hitObject's
      // chest branch, js/actions.js). A chest is an AUTO target, so the hands
      // spring each one the moment it is in reach.
      const row = [-6, -1, 4];
      for (const dx of row) placeObj(W.lane.tx + dx, W.lane.ty, 'chest', { hp: 1 });
      __M.place(c.x - 136, c.y + 2);
      player.dir = 'right';
      DBG.setSwing(1);
      window.__S = { c: c, row: row, R: __M.lockCam(c.x - 18, c.y - 20) };
      __M.stageEnd();
      return 'chests=' + row.map(function (dx) { return (objAt(W.lane.tx + dx, W.lane.ty) || {}).type; }).join(',') + ' gold=' + player.inv.gold;
    })()`,
    roll: `(function(){
      let t = 0, hold = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S, W = window.__W;
        // walk to the next chest still shut, stop in reach and let the hands
        // spring it, hold a beat on the spill, then on to the next. M.walk
        // presses the real keys, so a walk is always a full walk - the rhythm
        // is in the stops.
        let next = null;
        for (const dx of S.row) {
          const o = objAt(W.lane.tx + dx, W.lane.ty);
          if (o && o.type === 'chest') { next = __M.tile(W.lane.tx + dx, W.lane.ty); break; }
        }
        if (hold > 0) hold -= dt;
        if (next) {
          __M.aim(next.x, next.y);
          const far = next.x - player.x > 22;
          __M.walk(far && hold <= 0 ? 1 : 0, 0);
          if (!far) hold = 0.7;
        } else {
          __M.aim(player.x + 40, player.y);
          __M.walk(0, 0);
        }
        player.input.work = true;
      };
      __M.cam = function () { window.__S.R(); };
    })()`,
  },

  {
    name: '18-a-kill-bursts-the-body-in-team-colour',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 2.6667 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      __M.place(c.x - 74, c.y + 4);
      player.dir = 'right';
      DBG.equip(0, 'longbow', ['lance', 'heft', 'lance']);
      const a = rival(c.x + 22, c.y - 2, { hp: 34, dir: 'left', name: 'THORNE' });
      window.__S = { c: c, a: a, hold: __M.pin(a), R: __M.rig(c.x - 26, c.y - 12, 0.1) };
      window.__S.R.snap();
      __M.stageEnd();
      return 'mark=' + a.name + ' hp=' + Math.round(a.hp) + ' bounty=' + DBG.KILL_BOUNTY;
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        if (!S.a.dead) __M.aim(S.a.x, S.a.y - 4);
        __M.walk(0, 0);
        __M.fire(t % 0.95 < 0.75);
      };
      __M.cam = function () { const S = window.__S; const h = S.hold(); S.R.to((player.x + h.x) / 2, h.y - 12); S.R(); };
    })()`,
  },

  // ======================================================== robot war =====
  {
    name: '19-robot-war-two-columns-collide',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE}; ${BOTS};
      const W = window.__W;
      __M.reset({ zoom: 1.6667 });
      __M.stageBegin();
      const c = __M.tile(W.field.tx, W.field.ty);
      for (let i = robots.length - 1; i >= 0; i--) if (!robots[i].merchant) robots.splice(i, 1);
      const b0 = barracksFor(0, 62, 62);
      const b1 = barracksFor(1, 66, 62);
      const made = [];
      // one column in from the left of the frame and one from the right,
      // meeting in the middle of it
      // a soldier with nothing in reach walks its waypoints (updateSoldier's
      // march rung), so each column is handed the far side of the frame as
      // its road and SOLDIER_AGGRO does the rest where they meet
      for (let i = 0; i < 5; i++) {
        const a = soldierAt(b0, c.x - 150 - (i % 2) * 20, c.y - 44 + i * 22, 0);
        a.way = [{ x: c.x + 260, y: a.y }]; a.wayI = 0; made.push(a);
        const b = soldierAt(b1, c.x + 150 + (i % 2) * 20, c.y - 44 + i * 22, 1);
        b.way = [{ x: c.x - 260, y: b.y }]; b.wayI = 0; made.push(b);
      }
      __M.place(c.x, c.y + 150);
      player.dir = 'up';
      __M.wideEars(true);
      window.__S = { c: c, made: made, R: __M.lockCam(c.x, c.y) };
      __M.stageEnd();
      return 'robots=' + robots.length + ' made=' + made.length;
    })()`,
    roll: `__M.step = function () { __M.walk(0, 0); __M.aim(window.__S.c.x, window.__S.c.y); };
    __M.cam = function () { window.__S.R(); };`,
  },

  {
    name: '20-a-turret-cuts-down-an-intruder',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ zoom: 2 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      const t = DBG.buildStruct(W.lane.tx, W.lane.ty, 'turret', 1);
      DBG.finishBuild(t);
      t.building = false;
      t.team = player.team;
      t.owner = player.id;
      const wall = DBG.buildStruct(W.lane.tx, W.lane.ty + 2, 'wall', 0);
      wall.team = player.team; wall.owner = player.id;
      DBG.finishBuild(wall); wall.building = false;
      __M.place(c.x - 40, c.y + 34);
      player.dir = 'right';
      // A rival walking onto the mark: the turret's bolts ride the arrow
      // pipeline, so the mark, the flight and the hit are one path. It is
      // driven REMOTE, not ai - updateAI rewrites an ai body's input every
      // step, so a hand-steered walk on one goes nowhere.
      const a = rival(c.x + 116, c.y - 6, { hp: 160, dir: 'left' });
      window.__S = { c: c, a: a, t: t, R: __M.lockCam(c.x + 30, c.y - 22) };
      __M.stageEnd();
      return 'turret=' + t.type + ' tier=' + t.tier;
    })()`,
    roll: `__M.step = function () {
      const S = window.__S;
      __M.walk(0, 0);
      __M.aim(S.c.x + 40, S.c.y);
      // walk the rival in onto the turret's mark and keep it there
      const dx = (S.c.x + 34) - S.a.x;
      __M.walk(dx < -3 ? -0.75 : 0, 0, S.a);
      __M.aim(S.c.x, S.c.y, S.a);
    };
    __M.cam = function () { window.__S.R(); };`,
  },

  // ==================================================== the team battle ===
  {
    name: '21-two-lines-close-across-the-snow',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1, gap: 300, span: 150 });
      return 'field ' + JSON.stringify(window.__W.field) + ' mine=' + S.B.mine.map(function(p){return p.name;}).join(',')
        + ' foes=' + S.B.foes.map(function(p){return p.name;}).join(',') + ' ' + JSON.stringify(__M.frame());
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.3); };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '22-the-lines-collide-in-the-middle',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      // warmed 120 steps: the lines have already closed, so the clip opens on
      // contact instead of on two ranks walking
      const S = openBattle({ zoom: 1.3333, gap: 230, span: 140, warm: 120 });
      return 'up=' + __M.live(S.B.all).length;
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.0); };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '23-arrow-volley-across-the-gap',
    sec: 4,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      // every body a bow, held apart: the shot is the air between the lines
      const S = openBattle({ zoom: 1.3333, gap: 260, span: 160,
        prof: { strafe: 0.2, draw: 0.95, abil: 0 } });
      __M.stageBegin();
      for (const p of S.B.all) { setClass(p, 0); DBG.equip(0, 'longbow', ['arrow', 'arrow', 'arrow'], p); p.hp = p.maxHp; }
      __M.stageEnd();
      return 'bows=' + S.B.all.length;
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.2); };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '24-the-melee-closes-to-swords',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      // every body a blade and the gap almost shut: no arcs, just bodies
      const S = openBattle({ zoom: 1.3333, gap: 120, span: 90, cls: 1,
        prof: { strafe: 0.85, abil: 1 }, warm: 50 });
      __M.stageBegin();
      for (const p of S.B.all) { setClass(p, 1); p.hp = p.maxHp; }
      setClass(player, 1);
      __M.stageEnd();
      return 'swords=' + S.B.all.length;
    })()`,
    roll: `(function(){ let t = 0, n = 0;
      __M.step = function (dt) { t += dt;
        const S = window.__S;
        const f = __M.nearestFoe(player, S.B.foes);
        if (f) { __M.aim(f.x, f.y - 4);
          const d = Math.hypot(f.x - player.x, f.y - player.y);
          __M.walk(d > 34 ? Math.sign(f.x - player.x) * 0.6 : 0, d > 34 ? Math.sign(f.y - player.y) * 0.6 : 0);
        }
        __M.fire(t % 0.75 < 0.55);
        if (t > 1.2 && t % 1.6 < dt) { player.input.ability = (n++ % 2) ? 3 : 2; }
        else player.input.ability = -1;
      };
      // a melee sheds a straggler or two across the field, and a centroid of
      // everyone lands between the pile and them: hold only what stands
      // within 150 px of WREN, who is always in the thick of it
      __M.cam = function () {
        const S = window.__S;
        const m = __M.centroid(S.B.all, player, 150);
        if (m) S.R.to(m.x, m.y);
        S.R();
      };
    })()`,
  },

  {
    name: '25-a-soldier-column-marches-into-the-fight',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1, gap: 230, span: 150, warm: 70 });
      __M.stageBegin();
      function barracksFor(team, tx, ty) {
        const o = DBG.buildStruct(tx, ty, 'barracks', 0);
        o.team = team; o.owner = team === player.team ? player.id : 6;
        DBG.finishBuild(o); o.building = false;
        return o;
      }
      const b0 = barracksFor(player.team, 62, 62);
      const b1 = barracksFor(1 - player.team, 66, 62);
      const made = [];
      for (let i = 0; i < 4; i++) {
        const a = makeSoldier(b0); a.team = player.team;
        a.x = S.c.x + 290; a.y = S.c.y - 40 + i * 26; a.way = [{ x: S.c.x - 200, y: a.y }]; a.wayI = 0; robots.push(a); made.push(a);
        const b = makeSoldier(b1); b.team = 1 - player.team;
        b.x = S.c.x - 290; b.y = S.c.y - 40 + i * 26; b.way = [{ x: S.c.x + 200, y: b.y }]; b.wayI = 0; robots.push(b); made.push(b);
      }
      window.__S.made = made;
      __M.stageEnd();
      return 'soldiers=' + made.length + ' robots=' + robots.length;
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.2); };
      __M.cam = holdFight(0);
    })()`,
  },

  // ============================================================ night =====
  {
    name: '26-night-battle-lit-by-care-arrows',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1.3333, gap: 230, span: 150, night: true, warm: 90 });
      __M.stageBegin();
      // CARE ARROWS light the snow where they land - nothing on the map emits
      // any light of its own, so the tracers are the whole of it
      for (const p of S.B.mine) { setClass(p, 0); DBG.equip(0, 'longbow', ['care', 'care', 'care'], p); p.hp = p.maxHp; }
      for (const p of S.B.foes) { setClass(p, 0); DBG.equip(0, 'recurve', ['care', 'care'], p); p.hp = p.maxHp; }
      __M.stageEnd();
      return 'dark=' + state.darkness.toFixed(2) + ' up=' + __M.live(S.B.all).length;
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.05); };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '27-night-in-the-dire-wolf-hollow',
    sec: 5,
    stage: `(function () {
      __M.reset({ night: true, zoom: 2, hideUI: true, cursor: false });
      __M.stageBegin();
      // the epic camp: a ring of dead trees round a den, the one camp that
      // reads as a PLACE in the dark instead of as more snow
      let camp = DBG.camps[0];
      for (const c of DBG.camps) if (__M.nearObj(c.tx, c.ty, 'deadTree', 8)) camp = c;
      const c = __M.tile(camp.tx, camp.ty);
      __M.place(c.x - 92, c.y + 10);
      player.dir = 'right';
      DBG.equip(0, 'longbow', ['wisp', 'care', 'care', 'care']);
      const dire = DBG.spawnAnimal('dire', c.x + 10, c.y + 4);
      dire.dir = 'left';
      __M.wideEars(true);
      window.__S = { c: c, dire: dire, R: __M.rig(c.x - 40, c.y + 4, 0.06) };
      window.__S.R.snap();
      __M.stageEnd();
      return 'camp ' + camp.tx + ',' + camp.ty + ' dark=' + state.darkness.toFixed(2) + ' dire=' + Math.round(dire.hp);
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.dire.x, S.dire.y - 8);
        __M.walk(t < 1.6 ? 0.5 : 0, 0);
        __M.fire(t > 0.6 && t % 1.15 < 0.9);
      };
      __M.cam = function () { const S = window.__S; S.R.to((player.x + S.dire.x) / 2, S.dire.y); S.R(); };
    })()`,
  },

  {
    name: '28-nightfall-over-the-widest-view',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ night: true, zoom: 0.6667, hideUI: true, cursor: false });
      __M.stageBegin();
      const c = __M.tile(W.field.tx, W.field.ty);
      // a hunter walking into the middle of a grazing herd: the deer bolt
      // off it on their own (FLEE_SIGHT) while the camera drifts across
      __M.place(c.x - 150, c.y - 20);
      for (let i = 0; i < 14; i++) {
        const a = DBG.spawnAnimal(i % 4 === 0 ? 'wolf' : 'deer', c.x - 260 + (i % 7) * 80 + (i % 2) * 18, c.y - 120 + Math.floor(i / 7) * 150 + (i % 3) * 14);
        a.dir = i % 2 ? 'left' : 'right';
      }
      __M.wideEars(true);
      window.__S = { c: c, R: __M.rig(c.x - 110, c.y - 30, 0.04) };
      window.__S.R.snap();
      __M.stageEnd();
      return 'wv=' + WV_W + 'x' + WV_H + ' tiles=' + (WV_W / 16).toFixed(1) + 'x' + (WV_H / 16).toFixed(1) + ' dark=' + state.darkness.toFixed(2);
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) { t += dt; __M.walk(0.8, 0); };
      // a slow dolly, 28 px a second across the field, eased by the rig
      __M.cam = function () { const S = window.__S; S.R.to(S.c.x - 110 + t * 28, S.c.y - 30); S.R(); };
    })()`,
  },

  // ======================================================= the wide shots ==
  {
    name: '29-zoomed-all-the-way-out-over-the-field',
    sec: 4,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 0.6667, gap: 320, span: 220, hideUI: true, cursor: false, warm: 70 });
      return 'wv=' + WV_W + 'x' + WV_H + ' tiles=' + (WV_W / 16).toFixed(1) + 'x' + (WV_H / 16).toFixed(1) + ' ears=' + __M.wideEars(true);
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.2); };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '30-the-camera-pulls-back-off-the-fight',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 2, gap: 190, span: 130, warm: 100 });
      return 'start=' + JSON.stringify(DBG.getZoom().applied) + ' rungs=' + JSON.stringify(DBG.getZoom().rungs);
    })()`,
    roll: `(function(){ let t = 0, at = 0;
      // the rungs are whole device px per world px; anything between them tears
      // the pixel grid, so the pull-back STEPS the ladder
      const rungs = [2, 1.6667, 1.3333, 1, 0.6667];
      __M.step = function (dt) { t += dt;
        fightOn(t, dt, 1.15);
        const want = Math.min(rungs.length - 1, Math.floor(t / 1.0));
        if (want !== at) { at = want; __M.zoom(rungs[at]); __M.wideEars(true); }
      };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '31-zoom-punch-from-wide-into-the-kill',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 0.6667 });
      __M.stageBegin();
      const c = __M.tile(W.lane.tx, W.lane.ty);
      __M.place(c.x - 150, c.y + 4);
      player.dir = 'right';
      DBG.equip(0, 'longbow', ['heft', 'lance', 'lance', 'lance']);
      const a = rival(c.x + 30, c.y - 2, { hp: 90, dir: 'left', name: 'SABLE' });
      __M.wideEars(true);
      window.__S = { c: c, a: a, hold: __M.pin(a), R: __M.rig(c.x - 60, c.y - 10, 0.1) };
      window.__S.R.snap();
      __M.stageEnd();
      return 'mark=' + a.name;
    })()`,
    roll: `(function(){
      let t = 0, at = 0;
      // the punch stops at 2 - 320 px of frame, which still holds the shooter
      // and a body the heavy arrows have shoved 60 px further back
      const rungs = [0.6667, 1, 1.3333, 1.6667, 2];
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        if (!S.a.dead) __M.aim(S.a.x, S.a.y - 4);
        __M.walk(0, 0);
        __M.fire(t > 1.1 && (t - 1.1) % 1.0 < 0.8);
        const want = Math.min(rungs.length - 1, Math.floor(t / 0.7));
        if (want !== at) { at = want; __M.zoom(rungs[at]); __M.wideEars(true); }
      };
      __M.cam = function () { const S = window.__S; const h = S.hold(); S.R.to((player.x + h.x) / 2, h.y); S.R(); };
    })()`,
  },

  // ========================================================= the road =====
  {
    name: '32-the-zipline-runs-the-road',
    sec: 5,
    stage: `(function () {
      __M.reset({ cls: 0, zoom: 1.6667, cursor: false });
      __M.stageBegin();
      const z = DBG.zips[player.team];
      // dropped under its own side's cable a sixth of the way along it, so five seconds at ZIP_SPD ends short of the terminus: the
      // ride is the same E press a hand makes (input.jump, read by updatePlay)
      const a = DBG.zipPoint(z, z.len * 0.15);
      __M.place(a.x, a.y);
      player.dir = 'right';
      __M.wideEars(true);
      window.__S = { z: z, R: __M.rig(a.x, a.y, 0.35) };
      window.__S.R.snap();
      __M.stageEnd();
      return 'zip len=' + Math.round(z.len) + ' at=' + Math.round(z.len * 0.15) + ' pts=' + z.pts.length;
    })()`,
    roll: `(function(){
      let t = 0, on = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        const q = DBG.zipPoint(S.z, player.zip >= 0 ? player.zipD : 0);
        if (!on && t > 0.35) { player.input.jump = true; on = true; }
        // the stick held ALONG the cable, toward the front: that is what picks
        // the direction (zipStart / zipStep, js/world.js)
        if (player.zip >= 0) __M.walk(q.tx, q.ty);
        __M.aim(player.x + q.tx * 80, player.y + q.ty * 80);
      };
      __M.cam = function () { const S = window.__S; S.R.to(player.x, player.y); S.R(); };
    })()`,
  },

  {
    name: '33-the-rival-roost-under-siege',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1.6667, gap: 200, span: 130 });
      __M.stageBegin();
      // the whole point of the match in one shot: the rival bird on its roost
      // with a side at its feet and its nerve running down
      const e = DBG.eagles[1 - player.team];
      const B = S.B;
      for (let i = 0; i < B.mine.length; i++) {
        const p = B.mine[i];
        __M.place(e.x - 104 + (i % 2) * 22, e.y + 26 + i * 16, p);
        p.dir = 'right';
        setClass(p, i % 2);
        if (i % 2 === 0) DBG.equip(0, 'longbow', ['lance', 'heft', 'lance'], p);
        p.hp = p.maxHp;
      }
      for (let i = 0; i < B.foes.length; i++) {
        const q = B.foes[i];
        __M.place(e.x + 76 + (i % 2) * 20, e.y + 16 + i * 18, q);
        q.dir = 'left';
        q.hp = q.maxHp;
      }
      __M.place(e.x - 86, e.y + 36);
      player.dir = 'right';
      DBG.equip(0, 'longbow', ['lance', 'heft', 'lance']);
      __M.wideEars(true);
      const R = __M.rig(e.x - 20, e.y + 14, 0.05);
      R.snap();
      window.__S.R = R;
      window.__S.e = e;
      __M.stageEnd();
      return 'eagle nerve=' + Math.round(e.hp) + '/' + Math.round(e.maxHp);
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt;
        const S = window.__S;
        __M.aim(S.e.x, S.e.y - 10);
        __M.walk(0, 0);
        __M.fire(t % 0.95 < 0.75);
      };
      __M.cam = function () { const S = window.__S; S.R.to(S.e.x - 10, S.e.y + 12); S.R(); };
    })()`,
  },
];

module.exports = { scenes, PROLOGUE };
