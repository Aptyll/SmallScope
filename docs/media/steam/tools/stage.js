'use strict';
// The page-side rig for the store art, injected once after the game has
// booted. It is evaluated in the game's own global scope, so every DBG cheat
// and every game global is in reach.
//
// Two things make a staged still possible at all:
//   - `render` and `updateAI` are function DECLARATIONS, so they are window
//     properties and can be wrapped. Wrapping render puts a camera override
//     AFTER update() has moved the camera and BEFORE the frame is drawn, which
//     is the only place a locked framing can sit. Wrapping updateAI lets a
//     shot hold a body's brain while it stays LIVE - active, shootable and
//     drawn - instead of the ghost `control: 'none'` makes.
//   - DBG.freeze + DBG.step make the sim the clock, so a frame is reached by
//     counting steps and is identical on every run of the same seed.
//
// (The montage rig at R:/bongit/softfall-montage/rig does the same two things
// for video; this is the slice of it a capsule needs, plus SA.)
module.exports = `
(function(){
  if (!window.__saRender) {
    var _render = window.render;
    window.render = function(){ if (window.SA && SA.camHook) SA.camHook(); return _render.apply(null, arguments); };
    window.__saRender = true;
  }
  if (!window.__saAI) {
    var _ai = window.updateAI;
    window.updateAI = function(p, dt){
      if (window.SA && SA.still[p.id]) { var q = p.input; q.mx = q.my = 0; q.fire = false; q.work = false; q.slide = false; q.dodge = false; q.ability = -1; q.cmd = null; return; }
      return _ai.apply(null, arguments);
    };
    window.__saAI = true;
  }

  // what a clean frame costs, kept so it can be handed back
  var dressed = {};

  window.SA = {
    rig: 'store-2',   // bumped when this file changes, so a live page is not reused stale
    camHook: null,
    still: {},          // player id -> its brain is held (the updateAI wrap)

    // ---- a clean frame ----------------------------------------------------
    // The game's own "a composition somebody is looking AT" path, widened.
    // DBG.hideUI drops the HUD, the cursor and the info stack. endScreen()
    // forced true drops every overhead tell - name tag, health and stamina
    // bars, level badge - because bodies.js already takes that branch on a
    // victory screen. drawWorldText nulled drops the MERCH/PERCH plates, the
    // damage floaters and the sense mark. The bird's nerve bar is the one
    // thing drawn inline with fillRect and gated by nothing, so it comes out
    // of a copy of drawEagle's own source.
    clean: function(on){
      window.DBG.hideUI = on !== false;
      if (on === false) {
        if (dressed.end) { window.endScreen = dressed.end; window.drawWorldText = dressed.wt; window.drawEagle = dressed.eagle; dressed = {}; }
        return 'dressed';
      }
      if (dressed.end) return 'already';
      dressed.end = window.endScreen; dressed.wt = window.drawWorldText; dressed.eagle = window.drawEagle;
      window.endScreen = function(){ return true; };
      window.drawWorldText = function(){};
      var src = window.drawEagle.toString();
      var cut = src.replace(/const vh = Math\\.abs[\\s\\S]*?drawWorldText\\('PERCH'[\\s\\S]*?\\.mark\\);/, '');
      if (cut === src) throw new Error('the eagle nerve bar moved - reread drawEagle, js/boot.js');
      window.drawEagle = eval('(' + cut + ')');
      return 'clean';
    },

    // ---- the camera -------------------------------------------------------
    // camX/camY are the world view's TOP-LEFT (wToSX subtracts them), so a
    // centred shot backs off half a view.
    snap: function(wx, wy){ camX = wx - WV_W / 2; camY = wy - WV_H / 2; },
    free: function(wx, wy){ SA.camHook = function(){ camX = wx - WV_W / 2; camY = wy - WV_H / 2; }; SA.snap(wx, wy); },
    follow: function(){ SA.camHook = null; },
    // A framing by the one number a capsule cares about: kWant IS image pixels
    // per world pixel, so the whole frame is a whole-number blow-up and no
    // resample ever touches the art.
    shotK: function(wx, wy, k){ DBG.setK(k, true); SA.free(wx, wy); },
    kpx: function(){ return zoomCur * devScale; },

    // ---- the two birds ----------------------------------------------------
    // your side is always painted blue, so SA.mine() is the blue one
    eagle: function(team){ return state.drop.eagles[team]; },
    mine: function(){ return state.drop.eagles[player.team]; },
    theirs: function(){ return state.drop.eagles[1 - player.team]; },
    tileOf: function(e){ return [Math.round(e.x / TILE), Math.round(e.y / TILE)]; },

    // ---- staging ----------------------------------------------------------
    at: function(p, tx, ty){ p.x = (tx + 0.5) * TILE; p.y = (ty + 0.5) * TILE; p.vx = p.vy = 0; return p; },
    // a clean body: full life, no status, no draw held, nothing on cooldown
    fresh: function(p){
      p.dead = false; p.eliminated = false; p.respawnT = 0;
      refreshKit(p); p.hp = p.maxHp;
      clearUnitStatus(p);
      p.charging = false; p.chargeT = 0; p.nockT = 0; p.castT = 0; p.castMax = 0; p.castAb = -1;
      p.dodgeT = 0; p.sliding = false; p.swingT = 0; p.swingCd = 0; p.riseT = 0; p.fallT = 0;
      p.eatT = 0; p.eatType = null; p.prone = false; p.hide = 0; p.aboard = false; p.dropT = 0;
      p.abCd = [0,0,0,0]; p.shieldT = 0; p.rushT = 0; p.rushVictim = null; p.castSlam = false;
      p.grapT = 0; p.hopT = 0; p.buffT = 0;
      p.vx = p.vy = 0; p.kbx = 0; p.kby = 0; p.flash = 0;
      return p;
    },
    // a body posed and placed, alive and drawn: the capsule's cast. The local
    // player (id 0) keeps its own control; anybody else is a live AI whose
    // brain the caller can hold with SA.still.
    cast: function(id, tx, ty, cls, face){
      var q = id === 0 ? player : players[id];
      SA.fresh(q); SA.at(q, tx, ty);
      if (cls != null) setClass(q, cls);
      if (id !== 0) { q.control = 'ai'; SA.still[id] = true; }
      if (face) q.dir = face;   // 'up' 'down' 'left' 'right' (sim.js sets it from the walk or the aim)
      return q;
    },
    // every ability key bought to the cap, so nobody presses a dark one
    maxAbilities: function(p){
      p.skillPts = 99;
      for (var i = 0; i < 4; i++) while (abLvCanBuy(p, i)) buyAbilityLv(p, i);
      p.skillPts = 0; p.abCd = [0,0,0,0]; floaters.length = 0;
    },
    // a loaded weapon straight onto the slot, right-aligned the way a loadout
    // is: the shot last, the modifiers reaching forward onto it
    arm: function(p, id, bits){
      var cell = makeTool(id), off = Math.max(0, cell.bits.length - bits.length);
      for (var i = 0; i < bits.length && off + i < cell.bits.length; i++) cell.bits[off + i] = bits[i];
      p.tools[0] = cell; p.toolSel = 0; return cell;
    },
    // park every body not in the shot out in the far forest corner
    stash: function(keep){
      for (var i = 1; i < players.length; i++) {
        if (keep && keep.indexOf(i) >= 0) continue;
        var q = players[i]; q.dead = false; q.control = 'none';
        SA.at(q, 8, 8);
      }
    },

    // ---- driving the local body ------------------------------------------
    // the aim is the POINTER: put it on a world point through the one bridge
    look: function(wx, wy){ mouse.inside = true; mouse.src = 'mouse'; mouse.x = wToSX(wx); mouse.y = wToSY(wy); },
    fire: function(v){ if (v) clickAction(player); else player.input.fire = false; },
    hour: function(t){ state.time = t; },

    // wipe what the last shot left lying about the world
    clearFx: function(){
      SA.still = {};
      floaters.length = 0;
      state.msg = null; state.msgT = 0; events.length = 0;
      animals.length = 0;
      for (var r = robots.length - 1; r >= 0; r--) if (!robots[r].merchant) robots.splice(r, 1);
      arrows.length = 0; tracers.length = 0; warps.length = 0; swaps.length = 0;
      DBG.abNets.length = 0; DBG.abCraters.length = 0;
      slashes.length = 0; drops.length = 0;
      state.wheel = null; state.build = null; state.mapOpen = false; state.shop = null;
      state.settingsOpen = false; state.paused = false; state.charOpen = false;
      state.bagOpen = false; state.drag = null; state.dragPend = null;
      actHeld.work = false; actHeld.slide = false;
      pad.mx = 0; pad.my = 0;
      player.input.fire = false; player.input.dodge = false; player.input.ability = -1;
      player.firePrev = false; player.fireArmed = false;
    },
  };
  return 'ok';
})()`;
