// The montage: one entry per clip. `stage` runs frozen and muted, `roll` arms
// the per-step and per-frame hooks, and the clip is `sec` of real time with the
// canvas and the tapped SFX bus going into one MediaRecorder.
//
// The frame is 9:16 and the world view is 13-24 tiles TALL against 7-13 wide,
// so every scene is composed UP THE SCREEN: the shooter low, what it is
// shooting high, and a charge or a column running toward the camera rather
// than across it.
//
// Locations are scouted once into window.__W by PROLOGUE so a scene can ask for
// a grove, a rock or an arena by name instead of hunting for one itself.

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
  const isIce = function (x, y) { return ground[idx(x, y)] === 1; };
  const W = { grove: null, rock: null, ice: null, open: null, arena: null };
  let bg = -1, bi = -1, bo = -1, ba = -1;
  for (let ty = LO; ty <= HI; ty += 2) {
    for (let tx = LO; tx <= HI; tx += 2) {
      if (clear(tx, ty, 2)) {
        const t = count(tx, ty, 6, isTree);
        if (t >= 5 && t <= 20 && t > bg) { bg = t; W.grove = { tx: tx, ty: ty, trees: t }; }
      }
      // an ARENA is a clear floor deep enough to stage a charge up the frame,
      // with a treeline close enough to back it - a white void reads as nothing
      if (clear(tx, ty, 8)) {
        const near = count(tx, ty, 13, isTree);
        const d = Math.abs(tx - 116) + Math.abs(ty - 116);
        if (near === 0 && (bo < 0 || d < bo)) { bo = d; W.open = { tx: tx, ty: ty }; }
        if (near > ba && near <= 40) { ba = near; W.arena = { tx: tx, ty: ty, trees: near }; }
      }
      const ic = count(tx, ty, 7, isIce);
      if (ic > bi) { bi = ic; W.ice = { tx: tx, ty: ty, ice: ic }; }
      if (!W.rock) { const r = count(tx, ty, 4, isRock); if (r >= 1 && clear(tx, ty, 1)) W.rock = { tx: tx, ty: ty, rocks: r }; }
    }
  }
  if (!W.open) W.open = W.arena;
  window.__W = W;
  return JSON.stringify(W);
})()`;

// A rival body to shoot, stomp, rush or loot. `remote` is the control mode that
// matters: 'none' is a GHOST at its camp (js/player.js) and draws as a pale
// silhouette with no plate, while a remote human with no inputs arriving is a
// solid, named, inert body - exactly what a staged scene wants.
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
  q.name = opts.name || 'RIVAL';
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
// march cleared, so rung 1 (a rival unit in aggro range) is the only rung left.
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

const scenes = [
  // ------------------------------------------------------------- the way in
  {
    name: '01-eagle-ride-in-over-the-treeline',
    sec: 5,
    stage: `(function () {
      __M.reset({ hideUI: true, cursor: false });
      __M.stageBegin();
      beginDrop();
      player.aboard = true;
      state.dropBrief = null;
      __M.fast(60);
      state.dropBrief = null;
      __M.stageEnd();
      return 'mode=' + state.mode + ' aboard=' + player.aboard;
    })()`,
    roll: `__M.step = function () { state.dropBrief = null; __M.clearInput(player); };
    __M.cam = function () {
      // the ride pins DROP_ZOOM every step: write a closer rung back over it,
      // and put the bird itself in the middle of the tall frame
      __M.forceZoom(1.6667);
      const e = state.drop.eagles[player.team];
      __M.snapCam(e.x, e.y);
    };`,
  },

  {
    name: '02-eagle-leap-off-into-the-fall',
    sec: 4,
    stage: `(function () {
      __M.reset({ hideUI: true, cursor: false });
      __M.stageBegin();
      beginDrop();
      player.aboard = true;
      __M.fast(150);
      state.dropBrief = null;
      __M.stageEnd();
      return 'mode=' + state.mode + ' aboard=' + player.aboard;
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        state.dropBrief = null;
        t += dt;
        if (t > 0.7 && player.aboard) DBG.dropJump(player);
        if (player.aboard) __M.clearInput(player);
      };
      __M.cam = function () {
        __M.forceZoom(1.6667);
        const e = state.drop.eagles[player.team];
        __M.snapCam(player.aboard ? e.x : (player.x + e.x) / 2, player.aboard ? e.y : player.y);
      };
    })()`,
  },

  // ------------------------------------------------------- work on the land
  {
    name: '03-chop-a-pine-until-it-falls',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 3.3333 });
      __M.stageBegin();
      const t = __M.nearObj(W.grove.tx, W.grove.ty, 'tree', 9);
      const c = __M.tile(t.tx, t.ty);
      // Under the tree, looking up at it: the fall comes down the frame. The
      // gap is 20 px and not a pixel more - WORK_REACH is ONE TILE, Chebyshev
      // (js/actions.js), so a tile centre + 26 is two tiles down and the swing
      // never starts.
      __M.place(c.x - 2, c.y + 20);
      player.dir = 'up';
      DBG.setSwing(1);
      window.__S = { c: c };
      __M.snapCam(c.x, c.y + 8);
      __M.stageEnd();
      return 'tree ' + t.tx + ',' + t.ty;
    })()`,
    roll: `__M.step = function () {
      const S = window.__S;
      __M.aim(S.c.x, S.c.y);
      __M.walk(0, 0);
      player.input.work = true;
    };
    __M.cam = function () { __M.easeCam(window.__S.c.x, window.__S.c.y + 10, 0.26); };`,
  },

  {
    name: '04-mine-a-rock-to-rubble',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 3.6667 });
      __M.stageBegin();
      const r = __M.nearObj(W.rock.tx, W.rock.ty, 'rock', 9);
      const c = __M.tile(r.tx, r.ty);
      __M.place(c.x, c.y + 22);
      player.dir = 'up';
      DBG.setSwing(1);
      window.__S = { c: c };
      __M.snapCam(c.x, c.y + 8);
      __M.stageEnd();
      return 'rock ' + r.tx + ',' + r.ty;
    })()`,
    roll: `__M.step = function () {
      const S = window.__S;
      __M.aim(S.c.x, S.c.y);
      __M.walk(0, 0);
      player.input.work = true;
    };`,
  },

  // -------------------------------------------------------- the weapon well
  {
    name: '05-swap-the-tool-for-a-loaded-longbow',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 3.3333 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 62);
      player.dir = 'up';
      DBG.equip(0, 'shortbow', ['arrow']);
      const it = DBG.makeTool('longbow');
      it.bits[0] = 'lance'; it.bits[1] = 'heft'; it.bits[2] = 'twin';
      spawnDrop(c.x, c.y + 6, 'tool:longbow', 1, it);
      spawnDrop(c.x - 14, c.y - 20, 'bit:pyre', 3);
      spawnDrop(c.x + 14, c.y - 34, 'bit:cinder', 2);
      window.__S = { c: c };
      __M.snapCam(c.x, c.y + 30);
      __M.stageEnd();
      return 'drops=' + drops.length;
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.c.x, S.c.y - 60);
        __M.walk(0, t < 3 ? -0.8 : 0);
      };
      __M.cam = function () { __M.easeCam(player.x, player.y - 26, 0.1); };
    })()`,
  },

  // ------------------------------------------------------------- the big gun
  {
    name: '06-hefty-wand-fires-a-fan-of-fire',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 2.3333 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 104);
      player.dir = 'up';
      // the heaviest body in the game packed to its tensile limit: HEFT under
      // a SPLITTER under a CINDER BURST is one press throwing a fan of fat
      // burning shots that leave a ring of embers where they land
      DBG.equip(0, 'longbow', ['heft', 'fan', 'cinder', 'lance', 'lance']);
      const foes = [];
      for (let i = 0; i < 4; i++) {
        const a = DBG.spawnAnimal('wolf', c.x - 36 + (i % 2) * 58 + (i > 1 ? 14 : 0), c.y - 20 - i * 24);
        a.dir = i % 2 ? 'left' : 'right';
        foes.push(a);
      }
      window.__S = { c: c, foes: foes };
      __M.snapCam(c.x, c.y + 40);
      __M.stageEnd();
      return 'foes=' + foes.length + ' bits=' + JSON.stringify(player.tools[0].bits);
    })()`,
    roll: `(function(){
      let t = 0, phase = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        const live = S.foes.filter(function (f) { return !f.dead; });
        const f = live.length ? live[phase % live.length] : { x: S.c.x, y: S.c.y - 60 };
        __M.aim(f.x, f.y - 4);
        __M.walk(0, 0);
        const u = t % 1.15;
        __M.fire(u < 0.9);
        if (u >= 0.9 && u < 0.9 + dt) phase++;
      };
      __M.cam = function () { __M.easeCam(window.__S.c.x, window.__S.c.y + 16, 0.28); };
    })()`,
  },

  // -------------------------------------------------------------- abilities
  {
    name: '07-warrior-stomp-cracks-the-snow',
    sec: 3,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 1, zoom: 3 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 10);
      player.dir = 'up';
      const a = rival(c.x - 18, c.y - 14, { hp: 60, dir: 'down' });
      const b = rival(c.x + 20, c.y - 6, { slot: 7, hp: 60, dir: 'down' });
      const d = rival(c.x + 4, c.y + 30, { slot: 8, hp: 60, dir: 'up' });
      window.__S = { c: c, a: a, b: b, d: d };
      __M.snapCam(c.x, c.y + 4);
      __M.stageEnd();
      return 'ab=' + DBG.CLASS_AB[1][2].name;
    })()`,
    roll: `(function(){
      let t = 0, cast = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.a.x, S.a.y);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.45) ? 2 : -1;
        if (t > 0.45) cast = true;
      };
    })()`,
  },

  {
    name: '08-warrior-bull-rush-carries-a-body',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 1, zoom: 2.6667 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 96);
      player.dir = 'up';
      const a = rival(c.x - 2, c.y + 10, { hp: 90, dir: 'down' });
      window.__S = { c: c, a: a };
      __M.snapCam(c.x, c.y + 56);
      __M.stageEnd();
      return 'ok';
    })()`,
    roll: `(function(){
      let t = 0, cast = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.c.x, S.c.y - 60);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.4) ? 1 : -1;
        if (t > 0.4) cast = true;
      };
      __M.cam = function () { __M.easeCam(player.x, (player.y + window.__S.a.y) / 2, 0.24); };
    })()`,
  },

  {
    name: '09-warrior-shield-wall-then-slam',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 1, zoom: 3.3333 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 26);
      player.dir = 'up';
      const a = rival(c.x - 10, c.y - 8, { hp: 70, armed: true, dir: 'down' });
      const b = rival(c.x + 16, c.y - 20, { slot: 7, hp: 70, dir: 'down' });
      window.__S = { c: c, a: a, b: b };
      __M.snapCam(c.x, c.y + 6);
      __M.stageEnd();
      return 'ok';
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
    })()`,
  },

  {
    name: '10-warrior-execute-finishes-a-body',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 1, zoom: 3.3333 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 26);
      player.dir = 'up';
      // most of its life already gone, which is the half EXECUTE doubles down on
      const a = rival(c.x - 4, c.y - 6, { hp: 22, dir: 'down' });
      a.inv.gold = 120;
      bagAdd(a, 'bit:lance', 5);
      bagAdd(a, 'berry', 3);
      window.__S = { c: c, a: a };
      __M.snapCam(c.x, c.y + 6);
      __M.stageEnd();
      return 'hp=' + a.hp + '/' + a.maxHp;
    })()`,
    roll: `(function(){
      let t = 0, cast = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.a.x, S.a.y - 4);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.4) ? 3 : -1;
        if (t > 0.4) cast = true;
      };
    })()`,
  },

  {
    name: '11-hunter-piercing-shot-up-the-line',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 2 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 96);
      player.dir = 'up';
      DBG.equip(0, 'longbow', ['arrow', 'arrow', 'arrow']);
      const line = [];
      for (let i = 0; i < 3; i++) line.push(rival(c.x + (i % 2 ? 4 : -4), c.y + 22 - i * 52, { slot: 6 + i, hp: 55, dir: 'down' }));
      window.__S = { c: c, line: line };
      __M.snapCam(c.x, c.y + 6);
      __M.stageEnd();
      return 'line=' + line.length;
    })()`,
    roll: `(function(){
      let t = 0, cast = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.c.x, S.c.y - 140);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.5) ? 0 : -1;
        if (t > 0.5) cast = true;
      };
      __M.cam = function () { __M.easeCam(window.__S.c.x, window.__S.c.y + 6, 0.1); };
    })()`,
  },

  {
    name: '12-hunter-net-shot-drops-a-drape',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 2.6667 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 54);
      player.dir = 'up';
      DBG.equip(0, 'longbow', ['arrow', 'arrow']);
      const a = rival(c.x + 6, c.y - 10, { hp: 80, dir: 'down' });
      window.__S = { c: c, a: a };
      __M.snapCam(c.x, c.y + 22);
      __M.stageEnd();
      return 'ok';
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
      __M.cam = function () { __M.easeCam((player.x + window.__S.a.x) / 2, (player.y + window.__S.a.y) / 2, 0.1); };
    })()`,
  },

  {
    name: '13-hunter-grapple-reels-into-the-pines',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 2.6667 });
      __M.stageBegin();
      const t = __M.nearObj(W.grove.tx, W.grove.ty, 'tree', 9);
      const c = __M.tile(t.tx, t.ty);
      __M.place(c.x - 6, c.y + 138);
      player.dir = 'up';
      window.__S = { c: c };
      __M.snapCam(player.x, player.y - 40);
      __M.stageEnd();
      return 'tree ' + t.tx + ',' + t.ty;
    })()`,
    roll: `(function(){
      let t = 0, cast = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.c.x, S.c.y + 4);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.5) ? 2 : -1;
        if (t > 0.5) cast = true;
        player.input.grapple = t > 0.5;
      };
      __M.cam = function () { __M.easeCam(player.x, player.y - 46, 0.24); };
    })()`,
  },

  // --------------------------------------------------------------- the spill
  {
    name: '14-a-death-spills-the-whole-backpack',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 3.3333 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 52);
      player.dir = 'up';
      DBG.equip(0, 'longbow', ['lance', 'heft', 'lance']);
      const a = rival(c.x + 2, c.y - 10, { hp: 30, dir: 'down' });
      a.inv.gold = 240;
      // a loaded body: a built weapon in the pack, fittings, food - death
      // empties every one of them into the snow as separate pickups
      const it = DBG.makeTool('recurve');
      it.bits[0] = 'flame'; it.bits[1] = 'barb';
      bagAdd(a, 'tool:recurve', 1);
      for (let i = 0; i < a.bag.length; i++) if (a.bag[i] && a.bag[i].type === 'tool:recurve') a.bag[i] = it;
      bagAdd(a, 'bit:pyre', 4);
      bagAdd(a, 'bit:lance', 6);
      bagAdd(a, 'bit:twin', 3);
      bagAdd(a, 'bit:barb', 9);
      bagAdd(a, 'berry', 5);
      bagAdd(a, 'fish', 4);
      window.__S = { c: c, a: a };
      __M.snapCam(c.x, c.y + 24);
      __M.stageEnd();
      return 'bag=' + DBG.bagUsed(a) + ' gold=' + a.inv.gold;
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.a.x, S.a.y - 4);
        __M.walk(0, 0);
        __M.fire(t % 0.95 < 0.75);
      };
      const hold = __M.pin(window.__S.a);
      __M.cam = function () { const h = hold(); __M.easeCam(h.x, h.y + 14, 0.1); };
    })()`,
  },

  // ------------------------------------------------------------- robot war
  {
    name: '15-robot-war-two-columns-collide',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE}; ${BOTS};
      const W = window.__W;
      __M.reset({ zoom: 2 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      for (let i = robots.length - 1; i >= 0; i--) if (!robots[i].merchant) robots.splice(i, 1);
      const b0 = barracksFor(0, 62, 62);
      const b1 = barracksFor(1, 66, 62);
      const made = [];
      // one column up the frame, one down it, meeting in the middle
      for (let i = 0; i < 4; i++) made.push(soldierAt(b0, c.x - 26 + (i % 2) * 34, c.y + 74 + Math.floor(i / 2) * 20, 0));
      for (let i = 0; i < 4; i++) made.push(soldierAt(b1, c.x - 26 + (i % 2) * 34, c.y - 70 - Math.floor(i / 2) * 20, 1));
      __M.place(c.x - 74, c.y + 8);
      player.dir = 'right';
      window.__S = { c: c, made: made };
      __M.snapCam(c.x, c.y);
      __M.stageEnd();
      return 'robots=' + robots.length + ' made=' + made.length;
    })()`,
    roll: `__M.step = function () { __M.walk(0, 0); __M.aim(window.__S.c.x, window.__S.c.y); };
    __M.cam = function () { __M.easeCam(window.__S.c.x, window.__S.c.y, 0.28); };`,
  },

  // ------------------------------------------------------------------ night
  {
    name: '16-night-falls-over-a-wolf-pack',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ night: true, zoom: 2.3333 });
      __M.stageBegin();
      const c = __M.tile(W.grove.tx, W.grove.ty);
      __M.place(c.x, c.y + 96);
      player.dir = 'up';
      // CARE ARROWS light the snow where they land, which is the only light
      // there is out here - nothing on the map emits any
      DBG.equip(0, 'longbow', ['care', 'care', 'wisp', 'care']);
      const pack = [];
      for (let i = 0; i < 4; i++) {
        const a = DBG.spawnAnimal(i === 0 ? 'alpha' : 'wolf', c.x - 30 + (i % 2) * 56, c.y - 10 - i * 22);
        a.dir = i % 2 ? 'left' : 'right';
        pack.push(a);
      }
      window.__S = { c: c, pack: pack };
      __M.snapCam(c.x, c.y + 40);
      __M.stageEnd();
      return 'time=' + state.time.toFixed(1) + ' dark=' + state.darkness.toFixed(2) + ' pack=' + pack.length;
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        const live = S.pack.filter(function (w) { return !w.dead; });
        const w = live[0] || S.pack[0];
        __M.aim(w.x, w.y - 4);
        __M.walk(0, 0);
        __M.fire(t % 1.05 < 0.82);
      };
      __M.cam = function () { __M.easeCam(player.x, player.y - 46, 0.28); };
    })()`,
  },

  {
    name: '17-night-in-the-dire-wolf-hollow',
    sec: 5,
    stage: `(function () {
      __M.reset({ night: true, zoom: 2, hideUI: true, cursor: false });
      __M.stageBegin();
      // the epic camp: a ring of dead trees round a den, the one camp that
      // reads as a PLACE in the dark instead of as more snow
      let camp = DBG.camps[0];
      for (const c of DBG.camps) if (__M.nearObj(c.tx, c.ty, 'deadTree', 8)) camp = c;
      const c = __M.tile(camp.tx, camp.ty);
      __M.place(c.x, c.y + 78);
      player.dir = 'up';
      DBG.equip(0, 'longbow', ['wisp', 'care', 'care', 'care']);
      const dire = DBG.spawnAnimal('dire', c.x + 8, c.y + 6);
      dire.dir = 'left';
      window.__S = { c: c, dire: dire };
      __M.snapCam(c.x, c.y + 36);
      __M.stageEnd();
      return 'camp ' + camp.tx + ',' + camp.ty + ' dark=' + state.darkness.toFixed(2) + ' dire=' + Math.round(dire.hp);
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.dire.x, S.dire.y - 8);
        __M.walk(0, t < 1.6 ? -0.5 : 0);
        __M.fire(t > 0.6 && t % 1.15 < 0.9);
      };
      __M.cam = function () { __M.easeCam(window.__S.c.x, window.__S.c.y + 26, 0.28); };
    })()`,
  },

  // -------------------------------------------------------- the wide shots
  {
    name: '18-zoomed-all-the-way-out-over-the-snow',
    sec: 4,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 0.6667, hideUI: true, cursor: false });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 60);
      for (let i = 0; i < 10; i++) {
        const a = DBG.spawnAnimal(i % 3 === 0 ? 'wolf' : 'deer', c.x - 130 + (i % 5) * 62, c.y - 150 + Math.floor(i / 5) * 90);
        a.dir = i % 2 ? 'left' : 'right';
      }
      __M.snapCam(c.x, c.y);
      window.__S = { c: c };
      __M.stageEnd();
      return 'wv=' + WV_W + 'x' + WV_H + ' tiles=' + (WV_W / 16).toFixed(1) + 'x' + (WV_H / 16).toFixed(1);
    })()`,
    roll: `(function(){
      let t = 0;
      __M.step = function (dt) { t += dt; __M.walk(Math.cos(t * 0.7) * 0.6, -0.55); };
      __M.cam = function () { __M.easeCam(player.x, player.y - 20, 0.28); };
    })()`,
  },

  {
    name: '19-zoom-punch-from-wide-into-the-kill',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 0, zoom: 1 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 110);
      player.dir = 'up';
      DBG.equip(0, 'longbow', ['heft', 'lance', 'lance', 'lance']);
      const a = rival(c.x + 4, c.y - 10, { hp: 80, dir: 'down' });
      window.__S = { c: c, a: a };
      __M.snapCam(c.x, c.y + 50);
      __M.stageEnd();
      return 'ok';
    })()`,
    roll: `(function(){
      let t = 0;
      // the rungs are whole device pixels per world pixel, so the punch STEPS
      // the ladder rather than easing off it - anything between them tears the
      // pixel grid
      const rungs = [1, 1.3333, 1.6667, 2, 2.3333, 2.6667, 3, 3.3333];
      let at = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.a.x, S.a.y - 4);
        __M.walk(0, 0);
        __M.fire(t > 1.2 && (t - 1.2) % 1.0 < 0.8);
        const want = Math.min(rungs.length - 1, Math.floor(t / 0.5));
        if (want !== at) { at = want; __M.zoom(rungs[at]); }
      };
      const hold = __M.pin(window.__S.a);
      __M.cam = function () { const h = hold(); __M.easeCam(h.x, (player.y + h.y) / 2, 0.24); };
    })()`,
  },

  // ---------------------------------------------------------------- the roll
  {
    name: '20-dodge-roll-through-a-wolf',
    sec: 3,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 3.3333 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 52);
      player.dir = 'up';
      const w = DBG.spawnAnimal('wolf', c.x, c.y + 4);
      w.dir = 'left';
      window.__S = { c: c, w: w };
      __M.snapCam(c.x, c.y + 26);
      __M.stageEnd();
      return 'ok';
    })()`,
    roll: `(function(){
      let t = 0, rolled = false;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        __M.aim(S.w.x, S.w.y);
        __M.walk(0, -1);
        player.input.dodge = false;
        if (!rolled && t > 0.4) { player.input.dodge = true; rolled = true; }
      };
      __M.cam = function () { __M.easeCam(player.x, player.y - 16, 0.12); };
    })()`,
  },

  // ------------------------------------------------------------- the base
  {
    name: '21-a-bot-bay-rises-from-its-site',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE};
      const W = window.__W;
      __M.reset({ zoom: 2.6667 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      // A site raises ITSELF - buildT climbs in updateStruct with a dust burst
      // and a hammer tick every 0.8 s (js/structures.js). E is for taking a
      // RIVAL'S building down; you never swing at your own.
      const bay = DBG.buildStruct(W.arena.tx - 1, W.arena.ty - 1, 'spawner', 0);
      bay.team = player.team;
      bay.owner = player.id;
      bay.building = true;
      bay.buildT = 0;
      bay.buildTotal = 3.4;   // inside the clip, so the finish lands in shot
      bay.hp = bay.maxHp * 0.3;
      // one finished wall beside it, to read the rising one against
      const wall = DBG.buildStruct(W.arena.tx + 2, W.arena.ty, 'wall', 0);
      wall.team = player.team;
      wall.owner = player.id;
      DBG.finishBuild(wall);
      wall.building = false;
      __M.place(c.x + 4, c.y + 44);
      player.dir = 'up';
      player.inv.gold = 400;
      window.__S = { c: c, bay: bay };
      __M.snapCam(c.x, c.y + 12);
      __M.stageEnd();
      return 'bay=' + bay.type + ' total=' + bay.buildTotal + ' building=' + bay.building;
    })()`,
    roll: `__M.step = function () {
      const S = window.__S;
      __M.aim(S.c.x, S.c.y);
      __M.walk(0, 0);
    };
    __M.cam = function () { __M.easeCam(window.__S.c.x, window.__S.c.y + 14, 0.28); };`,
  },

  {
    name: '22-a-turret-cuts-down-an-intruder',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ zoom: 2.3333 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      const t = DBG.buildStruct(W.arena.tx, W.arena.ty, 'turret', 1);
      DBG.finishBuild(t);
      t.building = false;
      t.team = player.team;
      t.owner = player.id;
      __M.place(c.x - 34, c.y + 46);
      player.dir = 'up';
      // A rival walking onto the mark: the turret's bolts ride the arrow
      // pipeline, so the mark, the flight and the hit are one path. It is
      // driven REMOTE, not ai - updateAI rewrites an ai body's input every
      // step, so a hand-steered walk on one goes nowhere.
      const a = rival(c.x + 12, c.y - 58, { hp: 160, dir: 'down' });
      window.__S = { c: c, a: a, t: t };
      __M.snapCam(c.x, c.y - 6);
      __M.stageEnd();
      return 'turret=' + t.type + ' tier=' + t.tier;
    })()`,
    roll: `__M.step = function () {
      const S = window.__S;
      __M.walk(0, 0);
      __M.aim(S.c.x, S.c.y - 40);
      // walk the rival down onto the turret's mark and keep it there
      const dy = (S.c.y - 26) - S.a.y;
      __M.walk(0, dy > 3 ? 0.75 : 0, S.a);
      __M.aim(S.c.x, S.c.y, S.a);
    };
    __M.cam = function () { __M.easeCam(window.__S.c.x, window.__S.c.y - 6, 0.28); };`,
  },

  {
    name: '23-pyre-arrows-set-three-bodies-alight',
    sec: 5,
    stage: `(function () {
      ${PROLOGUE}; ${RIVAL};
      const W = window.__W;
      __M.reset({ cls: 0, night: true, zoom: 2.3333 });
      __M.stageBegin();
      const c = __M.tile(W.arena.tx, W.arena.ty);
      __M.place(c.x, c.y + 86);
      player.dir = 'up';
      // PYRE under a SPLITTER: one press throws three burning shots, and the
      // burn is the damage - the bodies keep taking it after the arrow is gone
      DBG.equip(0, 'longbow', ['pyre', 'fan', 'cinder', 'arrow']);
      const line = [];
      for (let i = 0; i < 3; i++) line.push(rival(c.x - 34 + i * 34, c.y - 20 - (i % 2) * 22, { slot: 6 + i, hp: 90, dir: 'down' }));
      window.__S = { c: c, line: line };
      __M.snapCam(c.x, c.y + 24);
      __M.stageEnd();
      return 'line=' + line.length + ' dark=' + state.darkness.toFixed(2);
    })()`,
    roll: `(function(){
      let t = 0, phase = 0;
      __M.step = function (dt) {
        t += dt;
        const S = window.__S;
        const live = S.line.filter(function (q) { return !q.dead; });
        const f = live.length ? live[phase % live.length] : S.line[0];
        __M.aim(f.x, f.y - 6);
        __M.walk(0, 0);
        const u = t % 1.2;
        __M.fire(u < 0.95);
        if (u >= 0.95 && u < 0.95 + dt) phase++;
      };
      __M.cam = function () { __M.easeCam(window.__S.c.x, window.__S.c.y + 4, 0.28); };
    })()`,
  },
];

module.exports = { scenes, PROLOGUE };