// Montage 2: one team battle, told in shots. Same format as montage 1 -
// 1080x1920, 60 fps, every SFX and no music - but pulled back: the camera sits
// far enough out to hold ten bodies, and the fight is real (both sides are the
// game's own AI under a staged profile, not puppets on a timeline).
//
// THE CAMERA NEVER JITTERS, by three rules kept together:
//   - screen shake is off (settings.shake, set in M.reset) - it is a random
//     per-frame offset, and with the widened audio gate every hit in a
//     ten-body fight would raise one;
//   - the camera is a rig with its OWN position (M.rig), so it never eases off
//     camX, which the sim has already moved this step - and a frame carrying 0
//     or 2 sim steps moves it by different amounts, which is the judder;
//   - the rig writes WHOLE world pixels, which on any zoom rung is a whole
//     number of device pixels, so statics and movers round identically.

const PROLOGUE = `(function(){
  if (window.__W) return 'cached';
  // A battlefield wants ROOM, and a backdrop. Score a wide box on how much of
  // it a body could stand in, add a little for a treeline in the ring outside
  // it (a white void reads as nothing at this zoom), and push away from the
  // roosts - a cut-off eagle in the corner of the frame is a distraction.
  const R = 11, RING = 19;
  const eag = (state.drop && state.drop.eagles || []).map(function (e) { return { x: e.x / 16, y: e.y / 16 }; });
  let best = null, bs = -1e9;
  for (let ty = 64; ty <= 168; ty += 2) {
    for (let tx = 64; tx <= 168; tx += 2) {
      let open = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = tx + dx, y = ty + dy;
        if (inWorld(x, y) && walkable(x, y) && !objAt(x, y) && ground[idx(x, y)] === 0) open++;
      }
      if (open < 420) continue;
      let trees = 0;
      for (let dy = -RING; dy <= RING; dy += 2) for (let dx = -RING; dx <= RING; dx += 2) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= R) continue;
        const o = objAt(tx + dx, ty + dy);
        if (o && o.type === 'tree') trees++;
      }
      let far = 99;
      for (let i = 0; i < eag.length; i++) far = Math.min(far, Math.hypot(tx - eag[i].x, ty - eag[i].y));
      const score = open + Math.min(trees, 30) * 3 + Math.min(far, 46) * 4 - (Math.abs(tx - 116) + Math.abs(ty - 116)) * 0.5;
      if (score > bs) { bs = score; best = { tx: tx, ty: ty, open: open, trees: trees, eagle: Math.round(far) }; }
    }
  }
  window.__W = { field: best };
  return JSON.stringify(window.__W);
})()`;

// Open a battle scene: the field, the roster, the rig. Every scene starts here
// so the ten bodies, the names and the camera are set up one way.
const OPEN = `window.openBattle = function (o) {
  o = o || {};
  const W = window.__W;
  __M.reset({ zoom: o.zoom == null ? 1 : o.zoom, night: !!o.night, cls: o.cls == null ? 0 : o.cls,
    hideUI: !!o.hideUI, cursor: o.cursor !== false, name: 'WREN' });
  __M.stageBegin();
  settings.aiLevel = 2;
  const c = __M.tile(W.field.tx, W.field.ty);
  const B = __M.battle({ x: c.x, y: c.y + (o.drop || 0), gap: o.gap == null ? 190 : o.gap,
    span: o.span == null ? 150 : o.span, prof: o.prof });
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
    const m = __M.centroid(S.B.all, S.c, 520);
    if (m) S.R.to(m.x, m.y + (bias || 0));
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
  {
    name: '01-the-two-lines-close-across-the-snow',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1, gap: 250, span: 170 });
      return 'field ' + JSON.stringify(window.__W.field) + ' mine=' + S.B.mine.map(function(p){return p.name;}).join(',');
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.3); };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '02-the-lines-collide-in-the-middle',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      // warmed 110 steps: the lines have already closed, so the clip opens on
      // contact instead of on two rows walking
      const S = openBattle({ zoom: 1.3333, gap: 190, span: 140, warm: 110 });
      return 'up=' + __M.live(S.B.all).length;
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.0); };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '03-arrow-volley-across-the-gap',
    sec: 4,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      // every body a bow, held apart: the shot is the air between the lines
      const S = openBattle({ zoom: 1.3333, gap: 210, span: 160,
        prof: { strafe: 0.2, draw: 0.95, abil: 0 } });
      for (const p of S.B.all) { setClass(p, 0); DBG.equip(0, 'longbow', ['arrow', 'arrow', 'arrow'], p); p.hp = p.maxHp; }
      return 'bows=' + S.B.all.length;
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.2); };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '04-bull-rush-breaks-the-line',
    sec: 4,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1.3333, gap: 200, span: 140, cls: 1, warm: 40 });
      setClass(player, 1);
      player.hp = player.maxHp;
      __M.stageBegin();
      // WREN out in front of its own line, facing the gap
      const f = __M.centroid(S.B.foes);
      __M.place(f.x, f.y + 120);
      player.dir = 'up';
      __M.stageEnd();
      return 'cls=' + DBG.CLASSES[player.cls].name;
    })()`,
    roll: `(function(){ let t = 0, cast = false;
      __M.step = function (dt) { t += dt;
        const S = window.__S;
        const f = __M.nearestFoe(player, S.B.foes);
        if (f) __M.aim(f.x, f.y);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.5) ? 1 : -1;
        if (t > 0.5) cast = true;
      };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '05-stomp-scatters-the-cluster',
    sec: 4,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1.6667, gap: 150, span: 110, cls: 1, warm: 130 });
      setClass(player, 1);
      player.hp = player.maxHp;
      __M.stageBegin();
      // into the middle of the pile, which is what a stomp is for
      const m = __M.centroid(S.B.all);
      __M.place(m.x, m.y + 12);
      player.dir = 'up';
      __M.stageEnd();
      return 'up=' + __M.live(S.B.all).length;
    })()`,
    roll: `(function(){ let t = 0, cast = false;
      __M.step = function (dt) { t += dt;
        const S = window.__S;
        const f = __M.nearestFoe(player, S.B.foes);
        if (f) __M.aim(f.x, f.y);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.45) ? 2 : -1;
        if (t > 0.45) cast = true;
      };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '06-the-side-focuses-fire-on-thorne',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1.3333, gap: 200, span: 150, warm: 70 });
      __M.stageBegin();
      // IMPOSSIBLE picks the weakest rival (AI_LEVELS, js/ai.js), so one wounded
      // body is all it takes to turn a whole side onto it
      const mark = S.B.foes.filter(function (p) { return p.name === 'THORNE'; })[0] || S.B.foes[3];
      for (const p of S.B.mine) if (p.ai && p.ai.prof) p.ai.prof.pick = 'weak';
      for (const p of S.B.foes) p.hp = p.maxHp;
      mark.hp = Math.round(mark.maxHp * 0.42);
      window.__S.mark = mark;
      __M.stageEnd();
      return 'mark=' + mark.name + ' hp=' + Math.round(mark.hp);
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt;
        const S = window.__S;
        const m = S.mark;
        if (m && !m.dead) __M.aim(m.x, m.y - 4); else fightOn(t, dt, 1.0);
        __M.walk(0, 0);
        __M.fire(t % 1.0 < 0.8);
      };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '07-a-body-falls-and-the-pack-spills',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1.3333, gap: 150, span: 120, warm: 90 });
      __M.stageBegin();
      const mark = S.B.foes.filter(function (p) { return p.name === 'LINNET'; })[0] || S.B.foes[2];
      mark.hp = 26;
      mark.inv.gold = 310;
      // a loaded body: death empties the wallet, the pack and the weapon slot
      const it = DBG.makeTool('recurve');
      it.bits[0] = 'flame'; it.bits[1] = 'barb';
      bagAdd(mark, 'tool:recurve', 1);
      for (let i = 0; i < mark.bag.length; i++) if (mark.bag[i] && mark.bag[i].type === 'tool:recurve') mark.bag[i] = it;
      bagAdd(mark, 'bit:pyre', 4);
      bagAdd(mark, 'bit:lance', 6);
      bagAdd(mark, 'bit:twin', 3);
      bagAdd(mark, 'berry', 5);
      bagAdd(mark, 'fish', 3);
      DBG.equip(0, 'longbow', ['lance', 'heft', 'lance']);
      __M.place(mark.x, mark.y + 74);
      player.dir = 'up';
      window.__S.mark = mark;
      window.__S.hold = __M.pin(mark);
      __M.stageEnd();
      return 'mark=' + mark.name + ' bag=' + DBG.bagUsed(mark) + ' gold=' + mark.inv.gold;
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt;
        const S = window.__S;
        const m = S.mark;
        if (m && !m.dead) __M.aim(m.x, m.y - 4);
        __M.walk(0, 0);
        __M.fire(t % 0.95 < 0.75);
      };
      __M.cam = function () {
        const S = window.__S;
        const h = S.hold();
        S.R.to(h.x, h.y);
        S.R();
      };
    })()`,
  },

  {
    name: '08-piercing-shot-through-the-front-rank',
    sec: 4,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1.3333, gap: 190, span: 60, warm: 30 });
      __M.stageBegin();
      setClass(player, 0);
      DBG.equip(0, 'longbow', ['arrow', 'arrow', 'arrow']);
      player.hp = player.maxHp;
      // the rival side stacked on one axis, and WREN on the end of it
      const fx = S.c.x;
      for (let i = 0; i < S.B.foes.length; i++) {
        const q = S.B.foes[i];
        __M.place(fx + (i % 2 ? 5 : -5), S.c.y - 40 - i * 34, q);
        q.hp = 70;
      }
      __M.place(fx, S.c.y + 96);
      player.dir = 'up';
      __M.stageEnd();
      return 'line=' + S.B.foes.map(function(p){return p.name;}).join(',');
    })()`,
    roll: `(function(){ let t = 0, cast = false;
      __M.step = function (dt) { t += dt;
        const S = window.__S;
        __M.aim(S.c.x, S.c.y - 220);
        __M.walk(0, 0);
        player.input.ability = (!cast && t > 0.55) ? 0 : -1;
        if (t > 0.55) cast = true;
      };
      __M.cam = holdFight(-10);
    })()`,
  },

  {
    name: '09-shield-wall-holds-the-centre',
    sec: 4,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1.6667, gap: 150, span: 120, cls: 1, warm: 100 });
      setClass(player, 1);
      player.hp = player.maxHp;
      __M.stageBegin();
      const f = __M.centroid(S.B.foes);
      __M.place(f.x, f.y + 58);
      player.dir = 'up';
      __M.stageEnd();
      return 'ok';
    })()`,
    roll: `(function(){ let t = 0, up = false, slam = false;
      __M.step = function (dt) { t += dt;
        const S = window.__S;
        const f = __M.nearestFoe(player, S.B.foes);
        if (f) __M.aim(f.x, f.y - 4);
        __M.walk(0, 0);
        player.input.ability = -1;
        if (!up && t > 0.35) { player.input.ability = 0; up = true; }
        else if (up && !slam && t > 2.1) { player.input.ability = 0; slam = true; }
      };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '10-the-melee-closes-to-swords',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      // every body a blade and the gap almost shut: no arcs, just bodies
      const S = openBattle({ zoom: 1.6667, gap: 110, span: 110, cls: 1,
        prof: { strafe: 0.85, abil: 1 }, warm: 60 });
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
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '11-night-battle-under-the-dark',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1.3333, gap: 180, span: 150, night: true, warm: 80 });
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
    name: '12-a-soldier-column-marches-into-it',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1, gap: 200, span: 150, warm: 60 });
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
        a.x = S.c.x - 40 + i * 26; a.y = S.c.y + 210; a.way = []; a.wayI = 99; robots.push(a); made.push(a);
        const b = makeSoldier(b1); b.team = 1 - player.team;
        b.x = S.c.x - 40 + i * 26; b.y = S.c.y - 210; b.way = []; b.wayI = 99; robots.push(b); made.push(b);
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

  {
    name: '13-the-widest-view-of-the-field',
    sec: 4,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 0.6667, gap: 230, span: 200, hideUI: true, cursor: false, warm: 60 });
      return 'wv=' + WV_W + 'x' + WV_H + ' tiles=' + (WV_W / 16).toFixed(1) + 'x' + (WV_H / 16).toFixed(1) + ' ears=' + __M.wideEars(true);
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.2); };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '14-the-camera-pulls-back-off-the-fight',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 2, gap: 170, span: 130, warm: 90 });
      return 'start=' + JSON.stringify(DBG.getZoom().applied);
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
    name: '15-net-then-execute-a-finisher',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      const S = openBattle({ zoom: 1.6667, gap: 150, span: 120, warm: 80 });
      __M.stageBegin();
      setClass(player, 0);
      DBG.equip(0, 'longbow', ['arrow', 'arrow', 'arrow']);
      player.hp = player.maxHp;
      const mark = S.B.foes.filter(function (p) { return p.name === 'SABLE'; })[0] || S.B.foes[4];
      mark.hp = Math.round(mark.maxHp * 0.5);
      __M.place(mark.x, mark.y + 70);
      player.dir = 'up';
      window.__S.mark = mark;
      __M.stageEnd();
      return 'mark=' + mark.name;
    })()`,
    roll: `(function(){ let t = 0, net = false;
      __M.step = function (dt) { t += dt;
        const S = window.__S;
        const m = S.mark && !S.mark.dead ? S.mark : __M.nearestFoe(player, S.B.foes);
        if (m) __M.aim(m.x, m.y - 4);
        __M.walk(0, 0);
        player.input.ability = -1;
        if (!net && t > 0.45) { player.input.ability = 1; net = true; }
        __M.fire(t > 1.0 && t % 0.95 < 0.75);
      };
      __M.cam = holdFight(0);
    })()`,
  },

  {
    name: '16-what-is-left-of-the-two-sides',
    sec: 5,
    stage: `(function () { ${PROLOGUE}; ${OPEN};
      // run the whole fight out frozen first, then film what is still standing
      const S = openBattle({ zoom: 1, gap: 180, span: 140, warm: 260 });
      __M.stageBegin();
      const up = __M.live(S.B.all);
      window.__S.up = up;
      __M.stageEnd();
      return 'standing=' + up.map(function (p) { return p.name + ':' + Math.round(p.hp); }).join(' ');
    })()`,
    roll: `(function(){ let t = 0;
      __M.step = function (dt) { t += dt; fightOn(t, dt, 1.0); };
      __M.cam = holdFight(0);
    })()`,
  },
];

module.exports = { scenes, PROLOGUE };
