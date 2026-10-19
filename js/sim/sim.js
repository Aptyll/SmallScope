'use strict';
// The frame sim: update()/updatePlay() step every player, arrow, drop and
// timer; updatePlayer is the one body every controller drives; updateFx ages
// the cosmetics. Owns the camera (camX/camY) and the world-space snow. The
// day's weather and the wind field it reads are js/sim/weather.js.
// ------------------------------------------------------------ update
let camX = 0, camY = 0;
// the body the play camera followed last frame and where it stood: a body
// that moved further than CAM_CUT in one frame was set down somewhere else (a
// recall, a burrow's far hole), and the camera cuts to it instead of sweeping
// the map. Render-side, so a client's view cuts the same way.
const CAM_CUT = 6 * TILE;
let camVp = null, camVpX = 0, camVpY = 0;

// Ease the world scale toward what is wanted and resize the world view to
// match. Nothing here touches the canvas, so unlike the old applyView() it
// never calls fitCanvas()/relayout() and the overlays no longer have to force
// the zoom back to base to make their fixed-size panels fit. `snap` lands on
// the target immediately, for the two mode changes that must not be seen
// easing (boot, and the eagle's fixed framing).
//
// The zoom is ABOUT THE CENTRE OF THE VIEW. camX/camY name the view's top-left
// corner, so resizing the world view on its own pivots the picture about that
// corner: the point under the middle of the screen slides toward the corner
// as the view shrinks, and the follow camera (its lerp below runs at 7/s
// against this ease's 16/s) chases it back over most of a second - measured
// 55 screen px off centre four frames into a two-notch zoom in. Shifting the
// camera by half the change in the view keeps the world point under the
// screen centre exactly where it is through every frame of the ease, and the
// follow lerp then only has the lean's change to close - and the play camera
// takes that share too, off the scale this returns (the one it started from).
function applyZoom(dt, snap) {
  // the ride's OPENING SHOT: beginDrop's intro starts tight on your seat
  // (DROP_OPEN_ZOOM) and pulls out to the ride's framing as it runs down -
  // fractional in motion like any zoom, landing exact on DROP_ZOOM
  // the title's backdrop and the shows the match puts on (the roost tour, the
  // driven-off ceremony) hold ZOOM_SHOW whatever the wheel says: they frame
  // birds and valley, not your boots, and glide back to the wheel's zoom after
  const show = state.mode === 'title' || (state.drop && (state.dropBrief || state.eagleCine ||
    (state.mode === 'dead' && state.drop.eagles.some((q) => q.state === 'flee'))));
  const want = show ? ZOOM_SHOW
    : state.mode !== 'drop' ? zoomWantOf()
    : state.intro > 0 ? DROP_ZOOM + (DROP_OPEN_ZOOM - DROP_ZOOM) * (1 - easeInOut(1 - state.intro / state.introLen))
      : DROP_ZOOM;
  const k = 1 - Math.exp(-(director.on ? DIR_ZOOM_EASE : ZOOM_EASE) * dt); // a director's zoom glides (js/app/director.js)
  const zPrev = zoomCur;
  if (snap) zoomCur = want;
  else {
    zoomCur += (want - zoomCur) * k;
    if (Math.abs(want - zoomCur) < 0.0008) zoomCur = want; // park it, or WV jitters by a px forever
  }
  const ow = WV_W, oh = WV_H;
  sizeWorldView();
  camX += (ow - WV_W) / 2;
  camY += (oh - WV_H) / 2;
  // the minimap rides the same ease off the same constant, so both zooms
  // under one hand feel like one control
  const mw = mmWant();
  if (snap || mmCur < 0) mmCur = mw;
  else {
    mmCur += (mw - mmCur) * k;
    if (Math.abs(mw - mmCur) < 0.0008) mmCur = mw;
  }
  return zPrev;
}

// WHEN NIGHT COUNTS AS DOWN, in darkness: the owl starts answering instead of
// the wind gust, and the cue below rings once on the way past. One number for
// both, or "night" means two different things ten seconds apart.
const NIGHT_CUE = 0.55;

function update(dt) {
  const zPrev = applyZoom(dt); // the scale this frame started at, for the lean below
  // the wind gusts and the night owl audio.js schedules over its synth bed:
  // on wherever the world is live, off under the death and victory screens,
  // where a song already owns the mix
  SFX.setAmbience(!state.paused && (state.mode !== 'dead' || state.over === 'respawning'),
    state.darkness > NIGHT_CUE);

  // time (the clock starts with the eagle - the match is live while you ride).
  // The practice arena has no clock at all: state.time stays pinned at the
  // boot's early morning, so it is always crisp daylight, no dusk, no dawn
  // refreeze - a training room, not a day
  if ((state.mode === 'play' || state.mode === 'drop') && !PRACTICE) {
    state.time += dt;
    state.elapsed += dt;
    if (state.time >= CYCLE) {
      state.time -= CYCLE;
      state.day++;
      // the profile's days played: each dawn the player is still in the match
      // counts the day it opens (day 1 counted itself at takeoff), so quitting
      // to the lobby mid-match still keeps the days begun. Practice is not a
      // match: its dawns count nothing, like the rest of its stats.
      if (!player.eliminated && !PRACTICE) PROFILE.addDay();
      SFX.dawnChime();
      state.dayPop = { day: state.day, t: 0 }; // the dawn headline, top centre (renderUI)
      // carved ice holes freeze back over during the night; cracks heal too.
      // A hole with a net on it is the exception - the net is what holds that
      // water open - so it stays in the list and refreezes the dawn after
      // whoever wrecks the net.
      const kept = [];
      for (const i of holes) {
        if (netAt(i % WORLD, (i / WORLD) | 0)) { kept.push(i); continue; }
        ground[i] = 1;
        repaintGround(i % WORLD, (i / WORLD) | 0);
      }
      holes.length = 0;
      for (const i of kept) holes.push(i);
      iceCracks.clear();
      // the shoal is not reset here any more: it is a live population now,
      // fished down and refilled a fish at a time by updateFish's trickle
    }
  }
  // darkness curve
  const t = state.time;
  let dark = 0;
  if (t < DAY_LEN - 12) dark = 0;
  else if (t < DAY_LEN) dark = (t - (DAY_LEN - 12)) / 12;
  else if (t < CYCLE - 10) dark = 1;
  else dark = 1 - (t - (CYCLE - 10)) / 10;
  // the cold coming down, dawnChime's opposite number: dawn has a chime and a
  // headline and dusk had neither, though it is the change that decides how
  // far anyone can see. Only the way DOWN speaks - the curve crosses this
  // number again on its way out, and the chime already owns that moment.
  if (dark >= NIGHT_CUE && state.darkness < NIGHT_CUE
    && (state.mode === 'play' || state.mode === 'drop')) SFX.nightFall();
  state.darkness = dark;

  if (state.mode === 'dead') {
    const was = state.deadTimer;
    state.deadTimer += dt; // the overlay's fade-in, and the victory screen's clock
    if (state.over === 'won') winCues(was, state.deadTimer);
    // the defeat summary runs on a clock of its own - it opens off a plank,
    // long after the death this overlay has been timing
    if (state.deadView === 'defeat') {
      const d0 = state.defeatT;
      state.defeatT += dt;
      defCues(d0, state.defeatT);
    }
  }

  // the match runs on while the local player is down - other players are still
  // playing. Only pause and the settings panel stop the sim: the map is read
  // with the world still moving, the same deal the build wheel takes.
  // A CLIENT never steps: it sends what its hands are doing and applies what
  // the host says the match is (netClientStep, js/net/net.js) - in every
  // mode, since the host decides when the ride begins. A host (solo is one
  // with no peers) reads its peers' inputs into their bodies before the step
  // and sends the snapshot after it.
  if (NET.isClient) {
    if (state.mode !== 'title') sampleHumanInput(player, dt);
    netClientStep(dt);
    trampleStep(dt); // the trampled snow reads what the client draws (js/draw/trample.js)
    if (state.mode === 'title') updateTitle(dt); // the waiting room is the title's: its eases and hovers run here too
  } else if ((state.mode === 'play' || state.mode === 'dead' || state.mode === 'drop') &&
    ((!state.paused && !state.settingsOpen) || netShared())) { // a host's menu never stops the match for its peers
    sampleHumanInput(player, dt);
    netHostStep(dt);
    evInStep = true; // the step's cosmetics are the sim's: recorded for a host's clients (js/net/events.js)
    updatePlay(dt);
    evInStep = false;
    trampleStep(dt); // visual only: it runs beside the step, never records (js/draw/trample.js)
    netHostFlush();
  } else if (state.mode === 'play' || state.mode === 'dead' || state.mode === 'drop') {
    sampleHumanInput(player, dt); // still drops a held draw when an overlay opens
  } else if (state.mode === 'title') {
    netHostStep(dt); // a peer may knock while the host is still at the title
    updateTitle(dt); // menu timers, camera drift, and the ambient world behind it
  }
  if (PRACTICE) updateRooms(dt); // a party's guest joining its leader on the field (js/ui/rooms.js)

  // camera: director mode's own first (dirCam, js/app/director.js), when it has
  // the shot - the free camera anywhere but the title, the steady follow in play
  if (dirCam(dt)) {
    // the director holds it
  } else if (state.mode === 'title') {
    const c = titleCamTarget();
    camX = c.x; camY = c.y;
  } else if (state.mode === 'drop') {
    // riding: track the eagle (the rider sits on it); falling: hold over the
    // landing point. The first INTRO_T is the opening shot: held dead on your
    // seat while applyZoom pulls the view out round it.
    const tx = player.x - WV_W / 2, ty = player.y - WV_H / 2;
    if (state.intro > 0) {
      state.intro = Math.max(0, state.intro - dt);
      camX = tx; camY = ty;
    } else {
      camX += (tx - camX) * Math.min(1, dt * 9);
      camY += (ty - camY) * Math.min(1, dt * 9);
    }
  } else if (state.drop && (state.eagleCine ||
      (state.mode === 'dead' && state.drop.eagles.some((q) => q.state === 'flee')))) {
    // the match is decided: every eye goes to the bird that broke. The camera
    // glides over and holds it centred while the takeoff plays out - the end
    // screens wait for it (eagleFleeResolve, js/sim/eagle.js), then rise over the
    // escape still flying underneath. League-style. Only KEEP PLAYING (mode
    // back to 'play' with no ceremony) hands the camera back early.
    const ec = state.eagleCine ? state.drop.eagles[state.eagleCine.team]
      : state.drop.eagles.find((q) => q.state === 'flee');
    camX += (ec.x - WV_W / 2 - camX) * Math.min(1, dt * 3.5);
    camY += (ec.y - WV_H / 2 - camY) * Math.min(1, dt * 3.5);
  } else if (state.drop && state.dropBrief) {
    // the drop brief (updateDrop, js/sim/eagle.js): a forced landing's roost tour.
    // The same glide the driven-off ceremony uses, aimed by the brief's phase
    // - out to your own bird (tracking its dive if it is still falling), the
    // rival's, then home to your boots, where the play camera takes over.
    const bt = dropBriefTarget();
    camX += (bt.x - WV_W / 2 - camX) * Math.min(1, dt * 3.5);
    camY += (bt.y - WV_H / 2 - camY) * Math.min(1, dt * 3.5);
  } else {
    const vp = viewPlayer();
    const look = vp === player ? 0.12 : 0; // the aim lean is the local player's; a watched one is framed dead centre
    // the lean is a FRACTION of the view, so it divides by the zoom: the same
    // pointer offset leans the same share of the screen however close you are
    const lookSX = (mouse.x - VIEW_W / 2) * look, lookSY = (mouse.y - VIEW_H / 2) * look;
    const lookX = lookSX / zoomCur;
    const lookY = lookSY / zoomCur;
    // ...which means a zoom step moves the target by itself, by the lean's
    // change in world px. Take that share at once - applyZoom took the view's
    // half - so the lerp is left only the player's own motion to chase, and a
    // zoom under an off-centre pointer holds the hero where it stood
    camX += lookSX * (1 / zoomCur - 1 / zPrev);
    camY += lookSY * (1 / zoomCur - 1 / zPrev);
    const tx = vp.x - WV_W / 2 + lookX;
    const ty = vp.y - WV_H / 2 + lookY;
    const cut = vp === camVp && Math.hypot(vp.x - camVpX, vp.y - camVpY) > CAM_CUT;
    camVp = vp; camVpX = vp.x; camVpY = vp.y;
    if (cut) { camX = tx; camY = ty; } else if (state.intro > 0) {
      // landing -> play: glide from the touchdown framing onto the play
      // camera with an ease, instead of the play lerp's snap
      state.intro = Math.max(0, state.intro - dt);
      const q = easeInOut(1 - state.intro / state.introLen);
      camX = state.introFrom.x + (tx - state.introFrom.x) * q;
      camY = state.introFrom.y + (ty - state.introFrom.y) * q;
      // the landing anchors the calendar: DAY 1, the same headline every
      // dawn after it re-raises (practice is a training room, not a day). A
      // drop brief owns the top of the screen until it hands back, so it
      // pops the day itself (endBrief, js/sim/eagle.js)
      if (state.intro === 0 && !PRACTICE && !state.dropBrief) state.dayPop = { day: state.day, t: 0 };
    } else {
      camX += (tx - camX) * Math.min(1, dt * 7);
      camY += (ty - camY) * Math.min(1, dt * 7);
    }
  }
  camX = Math.max(0, Math.min(WORLD * TILE - WV_W, camX));
  camY = Math.max(0, Math.min(WORLD * TILE - WV_H, camY));

  // screen fades (the reroll whiteout)
  if (state.fade) {
    const f = state.fade;
    const up = f.to > f.a;
    f.a += (up ? 1 : -1) * f.spd * dt;
    if (up ? f.a >= f.to : f.a <= f.to) {
      f.a = f.to;
      const then = f.then; f.then = null;
      if (f.a === 0) state.fade = null;
      if (then) then();
    }
  }

  state.shake = Math.max(0, state.shake - dt * 12);
  state.msgT = Math.max(0, state.msgT - dt);
  if (state.dayPop && (state.dayPop.t += dt) >= 3.5) state.dayPop = null;

  updateFx(dt);
}

// A shot's reach into a body: the disc round a player's centre an arrow lands
// in, wider than the 4.5 px body a walker collides with. A walking target
// crosses its own width twice in the quarter second a full-draw arrow takes
// to fly 80 px, so at the body's own radius almost nothing lands on a moving
// rival (2.47's playtest: 24 shots at a circling bot, none hit) - and the
// same disc on every side keeps it a fact of arrows, not a hidden handicap.
const ARROW_HIT_R = 10;
// ------------------------------------------------------------ the shot's sweep
// A SHOT MEETS EVERYTHING ITS STEP CROSSED, never only what the step ended
// on. Two SPEEDUPs throw an arrow ~21 px a step and three ~43: wider than a
// rabbit's disc and wider than a wall tile, so a shot asked only at its end
// point stepped clean over both. Each step is a SEGMENT instead: the tiles it
// enters are walked in order (a grid DDA - one or two tiles a step at a bow's
// pace) up to the first that ends it, every body's hit disc is met by the
// segment (sweepDisc), and the contacts are taken in the order the shot met
// them - the rabbit in front of the wall is hit and the one behind it never
// is, and a piercing shot cuts down its line in order until something stops it.
// The step's bounding box turns nearly every body away before the sweep is
// asked, so a body costs a shot four comparisons: less than the hypot the
// point test paid.

// The fraction of a step from (x0, y0) along (dx, dy) at which it first comes
// within r of (cx, cy), or -1 if it never does. A step that STARTS inside the
// disc meets it at 0 while it is closing on the centre or still inside at its
// end - so a shot loosed from inside a hugging rival's disc, away from them,
// flies clear, as it did when only the end point was asked.
function sweepDisc(x0, y0, dx, dy, cx, cy, r) {
  const fx = x0 - cx, fy = y0 - cy;
  const b = fx * dx + fy * dy;          // < 0 while the step closes on the centre
  const c = fx * fx + fy * fy - r * r;  // < 0 when it starts inside
  if (c < 0) {
    if (b < 0) return 0;
    const ex = fx + dx, ey = fy + dy;
    return ex * ex + ey * ey < r * r ? 0 : -1;
  }
  if (b >= 0) return -1;                // outside, and not closing
  const A = dx * dx + dy * dy;
  const disc = b * b - A * c;
  if (disc < 0) return -1;              // the line passes the disc by
  const s = (-b - Math.sqrt(disc)) / A;
  return s <= 1 ? s : -1;               // ...or meets it past the end of this step
}
// The same for a box: the fraction of the step at which it first enters, or
// -1. A step that STARTS inside meets it at 0 only while it is closing on the
// centre - a shot into the building you hug dies on it, one away flies clear
// (the tile walk's own first-step rule, shotContacts).
function sweepBox(x0, y0, dx, dy, b) {
  if (x0 > b.x0 && x0 < b.x1 && y0 > b.y0 && y0 < b.y1) {
    return ((b.x0 + b.x1) / 2 - x0) * dx + ((b.y0 + b.y1) / 2 - y0) * dy > 0 ? 0 : -1;
  }
  let t0 = 0, t1 = 1;
  if (dx) {
    let p = (b.x0 - x0) / dx, q = (b.x1 - x0) / dx;
    if (p > q) { const t = p; p = q; q = t; }
    if (p > t0) t0 = p;
    if (q < t1) t1 = q;
  } else if (x0 <= b.x0 || x0 >= b.x1) return -1;
  if (dy) {
    let p = (b.y0 - y0) / dy, q = (b.y1 - y0) / dy;
    if (p > q) { const t = p; p = q; q = t; }
    if (p > t0) t0 = p;
    if (q < t1) t1 = q;
  } else if (y0 <= b.y0 || y0 >= b.y1) return -1;
  return t0 <= t1 ? t0 : -1;
}

// A STANDING BUILDING stops a shot wherever it is DRAWN, not only on the
// footprint tiles the walk asks: its art stands on the footprint's bottom
// edge and may rise past the top (the bay's roof) or overhang the sides (the
// turret's mount, 32 px on one tile), and a turret's head is rasterised above
// its tile at the pivot (drawTurretHead) - so a shot through any of that flew
// through the building. Its shape is the box its sprite's opaque pixels cover
// where the draw lays them (structArtOff), the footprint included, plus for a
// type with a `head` (STRUCTS) a disc that wide round turretPivot. Null for a
// site still going up, which is its footprint alone (the art is not up yet),
// and for a building a shot never meets (the net lies flat on the water).
// The `.` overlay draws exactly this (drawHitboxes).
const artBoxes = new WeakMap(); // sprite canvas -> the box its opaque pixels cover, read once
function artBox(spr) {
  let b = artBoxes.get(spr);
  if (b) return b;
  const px = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height).data;
  b = { x0: spr.width, y0: spr.height, x1: 0, y1: 0 };
  for (let y = 0; y < spr.height; y++) for (let x = 0; x < spr.width; x++) {
    if (!px[(y * spr.width + x) * 4 + 3]) continue;
    if (x < b.x0) b.x0 = x;
    if (x + 1 > b.x1) b.x1 = x + 1;
    if (y < b.y0) b.y0 = y;
    if (y + 1 > b.y1) b.y1 = y + 1;
  }
  artBoxes.set(spr, b);
  return b;
}
function structShotBox(o) {
  if (o.building || !isSolidTile(o.tx, o.ty)) return null;
  const fx = o.tx * TILE, fy = o.ty * TILE;
  const b = { x0: fx, y0: fy, x1: fx + structW(o) * TILE, y1: fy + structH(o) * TILE, hr: 0, hx: 0, hy: 0 };
  // a `tiled` piece wears one tile of art per footprint tile: its footprint is its art
  if (!STRUCTS[o.type].tiled) {
    const spr = structSprite(o), a = artBox(spr), off = structArtOff(o, spr);
    b.x0 = Math.min(b.x0, fx + off.x + a.x0); b.x1 = Math.max(b.x1, fx + off.x + a.x1);
    b.y0 = Math.min(b.y0, fy + off.y + a.y0); b.y1 = Math.max(b.y1, fy + off.y + a.y1);
  }
  const hr = STRUCTS[o.type].head;
  if (hr) { const pv = turretPivot(o); b.hr = hr; b.hx = pv.x; b.hy = pv.y; }
  return b;
}

// Everything one shot's step meets, in the order it meets it: `{ s, k, t }`,
// `s` the fraction of the step, `k` what was met ('eagle' 'dummy' 'wall'
// 'face' 'player' 'robot' 'animal') and `t` the thing itself (a wall rides as
// its tile, `tx`/`ty`). Nothing past the first contact that must END the shot
// is listed - a wall, a rival roost, a target face, and for any shot but a
// pierce the first body. One array, reused every step; updatePlay reads it.
const shotHits = [];
const byStep = (p, q) => p.s - q.s;
function shotContacts(a, x0, y0, dx, dy) {
  shotHits.length = 0;
  let stop = 2; // where along the step the shot is ended (past 1: nowhere)
  // THE WORLD: every tile the step enters, in order. The tile it starts in
  // was asked by the step before, which ended in it - except on a shot's
  // FIRST step, which starts at the bow, and a bow may overhang the tile its
  // body is standing against. That tile is asked then only if the shot is
  // heading INTO it (still inside it TILE/2 px on), never when it is leaving
  // over the edge: a shot into the tree you hug dies on it, one away flies.
  let tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
  const tx1 = Math.floor((x0 + dx) / TILE), ty1 = Math.floor((y0 + dy) / TILE);
  const ix = dx ? TILE / Math.abs(dx) : Infinity, iy = dy ? TILE / Math.abs(dy) : Infinity;
  let bx = dx > 0 ? ((tx + 1) * TILE - x0) / dx : dx < 0 ? (tx * TILE - x0) / dx : Infinity;
  let by = dy > 0 ? ((ty + 1) * TILE - y0) / dy : dy < 0 ? (ty * TILE - y0) / dy : Infinity;
  let s = 0;
  let ask = !a.flown && Math.min(bx, by) * Math.hypot(dx, dy) > TILE / 2;
  for (;;) {
    if (!ask) {
      if (tx === tx1 && ty === ty1) break;
      if (bx < by) { s = bx; bx += ix; tx += dx > 0 ? 1 : -1; }
      else { s = by; by += iy; ty += dy > 0 ? 1 : -1; }
      if (s > 1) break;
    }
    ask = false;
    // the grounded eagles are the objectives: the roost's own hitbox tiles
    // ARE the hit test, so anywhere a walker collides, an arrow damages - a
    // radius around the bird's centre missed the block's corners. Asked
    // BEFORE solidity, which would eat the shot; a friendly arrow falls
    // through to it and dies on the tile like any other miss.
    const o = objAt(tx, ty);
    if (state.drop && o && o.type === 'eagle' && o.team !== a.team) {
      shotHits.push({ s, k: 'eagle', t: o }); stop = s; break;
    }
    // the practice dummy: nearly three tiles tall on one solid tile, so a
    // shot through the torso or head tiles (one and two above the base)
    // lands too - asked before solidity, which would eat the base hit
    if (PRACTICE) {
      let dm = null;
      for (let dd = 0; dd <= 2 && !dm; dd++) {
        const q = objAt(tx, ty + dd);
        if (q && q.type === 'dummy') dm = q;
      }
      if (dm && !(a.pierce && a.pierceHit.includes(dm))) {
        shotHits.push({ s, k: 'dummy', t: dm });
        if (!a.pierce) { stop = s; break; }
      }
    }
    // a bit whose `solid` is false passes through the world - that is the
    // whole of "never hits ground", and the only reason a wisp can circle you
    // through a treeline
    if (a.solid !== false && isSolidTile(tx, ty)) {
      shotHits.push({ s, k: 'wall', tx, ty }); stop = s; break;
    }
  }
  const lx = Math.min(x0, x0 + dx), hx = Math.max(x0, x0 + dx);
  const ly = Math.min(y0, y0 + dy), hy = Math.max(y0, y0 + dy);
  // ...and every standing building by the shape it is DRAWN in (structShotBox,
  // above) where that reaches past the footprint the walk asked: the first
  // one the step meets ends it, cutting off whatever the walk met beyond it.
  // It rides as its anchor tile, so the wall branch sieges it like any other.
  if (a.solid !== false) for (const o of structures) {
    const b = structShotBox(o);
    if (!b) continue;
    const bx0 = b.hr ? Math.min(b.x0, b.hx - b.hr) : b.x0, bx1 = b.hr ? Math.max(b.x1, b.hx + b.hr) : b.x1;
    const by0 = b.hr ? Math.min(b.y0, b.hy - b.hr) : b.y0, by1 = b.hr ? Math.max(b.y1, b.hy + b.hr) : b.y1;
    if (bx1 < lx || bx0 > hx || by1 < ly || by0 > hy) continue;
    let s = sweepBox(x0, y0, dx, dy, b);
    if (b.hr) { const sh = sweepDisc(x0, y0, dx, dy, b.hx, b.hy, b.hr); if (sh >= 0 && (s < 0 || sh < s)) s = sh; }
    if (s < 0 || s >= stop) continue;
    for (let i = shotHits.length - 1; i >= 0; i--) if (shotHits[i].s > s) shotHits.splice(i, 1);
    shotHits.push({ s, k: 'wall', tx: o.tx, ty: o.ty }); stop = s;
  }
  // ...the archery targets: the shot meets the FACE, wherever its habit has
  // carried it - ptFace is the same geometry the draw uses, and the hit disc
  // scales with the target's size (ptHitR). Practice's track holds them; in a
  // match the list is empty unless a staged scene stood one (app/media/scenes)
  for (const t of ptargets) {
    if (!ptLive(t)) continue;
    const f = ptFace(t);
    const s = sweepDisc(x0, y0, dx, dy, f.x, f.y, ptHitR(t));
    if (s >= 0 && s < stop) { shotHits.push({ s, k: 'face', t }); stop = s; }
  }
  // THE BODIES, all three kinds, each by its own hit disc widened by the
  // bit's `reach`. A bit with friendly fire on skips the team check - but
  // never the shooter, who is not a target of their own tool at any weight.
  // A pierce skips whoever it has already cut (a.pierceHit), so a slow
  // overlap never pays twice.
  const pad = a.reach || 0;
  for (const t of players) {
    if ((a.team === t.team && !a.ff) || t.id === a.owner) continue;
    const r = ARROW_HIT_R + pad, cy = t.y - 6;
    if (t.x + r < lx || t.x - r > hx || cy + r < ly || cy - r > hy) continue;
    if (!t.active || t.dead || inAir(t) || t.invuln > 0) continue;
    if (a.pierce && a.pierceHit.includes(t)) continue;
    const s = sweepDisc(x0, y0, dx, dy, t.x, cy, r);
    if (s >= 0 && s < stop) { shotHits.push({ s, k: 'player', t }); if (!a.pierce) stop = s; }
  }
  // worker bots take the same shot: they are units in the open, on a team
  for (const t of robots) {
    if (a.team === t.team && !a.ff) continue;
    const r = ROBOT_HIT_R + pad, cy = robotHitY(t);
    if (t.x + r < lx || t.x - r > hx || cy + r < ly || cy - r > hy) continue;
    if (!unitAlive(t) || (a.pierce && a.pierceHit.includes(t))) continue;
    const s = sweepDisc(x0, y0, dx, dy, t.x, cy, r);
    if (s >= 0 && s < stop) { shotHits.push({ s, k: 'robot', t }); if (!a.pierce) stop = s; }
  }
  for (const t of animals) {
    if (t.team !== undefined && a.team === t.team && !a.ff) continue; // a deer ridden by the shot's side (js/sim/wildlife.js)
    const r = animalHitR(t) + pad, cy = animalHitY(t);
    if (t.x + r < lx || t.x - r > hx || cy + r < ly || cy - r > hy) continue;
    if (!unitAlive(t) || (a.pierce && a.pierceHit.includes(t))) continue;
    const s = sweepDisc(x0, y0, dx, dy, t.x, cy, r);
    if (s >= 0 && s < stop) { shotHits.push({ s, k: 'animal', t }); if (!a.pierce) stop = s; }
  }
  if (shotHits.length > 1) shotHits.sort(byStep);
  return shotHits;
}
// ------------------------------------------------------------ object timers
// A map object's running clocks: the hit blink (flash), the shiver (shake),
// a picked bush growing back, a rock's crack fading and its rubble regrowing.
// Only the objects with one running are ticked: the map is ~54,000 tiles and
// ~33,000 of them pines, and walking all of them every step to find the few
// that blink cost half the step. So a clock is only ever STARTED through
// joltObj (the blink and shiver) or timeObj (any other), which enrols the
// object; it leaves on its own once every clock has run down. A clock set
// straight on the object never runs. After a load objTimersRescan finds them.
const objTimed = new Set();
function timeObj(o) { objTimed.add(o); }
function joltObj(o, flash, shake) {
  if (flash !== undefined) o.flash = flash;
  if (shake !== undefined) o.shake = shake;
  objTimed.add(o);
}
const objTiming = (o) => o.flash > 0 || o.shake > 0 || (o.type === 'bush' && o.berries === 0) ||
  (o.type === 'rock' && (o.crack > 0 || o.regrow > 0));
function objTimersRescan() {
  objTimed.clear();
  for (const o of objects) if (o && objTiming(o)) objTimed.add(o);
}
const objTickList = [];
function tickObjTimers(dt) {
  // in map order, as the whole-map walk ran them, so a regrowing rock's
  // burst draws off rng() in the same order it always did
  objTickList.length = 0;
  for (const o of objTimed) {
    if (objects[idx(o.tx, o.ty)] === o) objTickList.push(o);
    else objTimed.delete(o); // felled, mined away or a new match: no longer on the map
  }
  if (objTickList.length > 1) objTickList.sort((a, b) => idx(a.tx, a.ty) - idx(b.tx, b.ty));
  for (const o of objTickList) {
    if (o.flash > 0) o.flash -= dt;
    if (o.shake > 0) o.shake -= dt;
    if (o.type === 'bush' && o.berries === 0) {
      o.regrow -= dt;
      if (o.regrow <= 0) o.berries = 2;
    } else if (o.type === 'rock') tickRock(o, dt); // the rubble growing back (js/sim/mining.js)
    if (!objTiming(o)) objTimed.delete(o);
  }
}

// ------------------------------------------------------------ passive income
// The clock pays: every player on the ground draws TRICKLE_GOLD into its
// wallet every TRICKLE_T s, through gainGold so it levels too - the League
// trickle. A floor under everyone's purse, so a player who never swings an
// axe still buys gear and still reaches the mid levels, and a farmer pulls
// ahead only by the fells, never by the clock. Silent on purpose: no floater,
// no blip - the strip's purse and the xp round the portrait are the tell. The practice
// arena has no clock and gets none; the dead and the airborne earn nothing.
const TRICKLE_GOLD = 1;
const TRICKLE_T = 4;      // s per coin: 15 gold a minute, ~225 over a fifteen-minute match
function trickle(p, dt) {
  if (p.dead || PRACTICE) return;
  p.trickleT += dt;
  if (p.trickleT >= TRICKLE_T) { p.trickleT -= TRICKLE_T; gainGold(p, TRICKLE_GOLD); }
}
function updatePlay(dt) {
  state.tick++; // with SEED and the player id, this decides contested orders
  // the surrender votes read their orders before any body runs, since a body
  // that is down or stunned drops every order it is given (js/sim/surrender.js)
  updateVotes(dt);

  // every player steps through the same code, each off its own input struct
  // (players still on or under the eagle are moved by updateDrop instead)
  for (const p of players) {
    // the leap is the one act a rider can take: read here, before the air
    // skips the body, so a remote hand's press lands like a local one
    // ...and on the ground the same intent is the zipline's and the deer's (hopToggle, wildlife.js)
    if (p.input.jump) { p.input.jump = false; if (p.active && p.aboard) dropJump(p); else if (p.active && !p.dead && !inAir(p)) hopToggle(p); }
    if (!p.active || inAir(p)) continue;
    if (p.control === 'ai') (p.botId ? botStep : updateAI)(p, dt); // a bot file's seat, or the built-in brain (js/ai/bot-api.js)
    updatePlayer(p, dt);
    trickle(p, dt);
  }
  updateTunnels(dt); // the burrows: the digs, the rides under the snow and the holes caving (js/sim/tunnel.js)
  updateIceBreaks(); // a break's hole opening and its tiles freezing back (js/sim/icebreak.js)
  botLogStep(dt);    // the bot dev view's recorder: reads what the bots just decided (js/ui/botview.js)
  resolveContests(); // this step's work swings, build orders and fish claims
  if (!PRACTICE) sampleStats(dt); // the post-game lobby's two graphs (js/ui/lobby.js)
  if (!PRACTICE) updateShop(); // the counter shuts when you walk off (js/ui/shop.js)
  updateAbilityWorld(dt); // craters and nets in flight
  if (state.drop) updateDrop(dt);
  shedStep(dt); // the gusts knocking snow off the pines (js/sim/shed.js)
  updateCallouts(dt); // the bots' calls to their side (js/ai/ai-callouts.js)

  // Shots in flight. Everything a tool fires rides this one array, whatever
  // bit it came out of - steerBit() is where the bit's flight path gets to
  // rewrite the velocity before the step is taken, so the trail, the hit
  // tests and the drawn body all just follow wherever it went. A turret's
  // rock rides the 'sling' path: one constant sag onto the point it was
  // thrown at.
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.t += dt;
    steerBit(a, dt);
    const vd = Math.hypot(a.vx, a.vy) || 1;
    const nx = a.vx / vd, ny = a.vy / vd;
    // the step is a SEGMENT, and what it crossed is what it meets (the
    // shot's sweep, above) - never only where it happened to end
    const x0 = a.x, y0 = a.y, dx = a.vx * dt, dy = a.vy * dt;
    a.x += dx; a.y += dy;
    // What the shot does to a BODY, said once for all three kinds: the damage
    // type, the fire it lights and the shove it lands are the bit's, and
    // hurtUnit (js/sim/actions.js) hands them to a player, a deer or a worker bot
    // alike. Only the hit disc differs per kind (shotContacts, above).
    // `base` is the px/s shove this KIND of body takes from a shot; the bit's
    // own KNOCKBACK (a.kb) scales it - and scales a player's HIT_KB too, which
    // is the whole reason it travels as a multiplier (js/sim/tools.js).
    const blow = (t, base, hx, hy) => {
      hurtUnit(t, a.dmg, nx, ny, players[a.owner], {
        type: a.type, burn: a.burn, burnDps: a.burnDps, ambush: a.ambush,
        kb: base, kbMul: a.kb,
      });
      if (a.ambush) ambushFx(hx, hy);
      a.struck = true;
    };
    let dead = a.t > a.life;
    // how much of the step the shot really flew: one that ends ON something
    // ends where it met it, so its burst, its embers and its impact land there
    let end = 1;
    // Every contact in the order the step met it. A PIERCING shot
    // (`a.pierce`, js/sim/abilities.js) takes each body and keeps flying -
    // a.pierceHit is everyone it has already cut - and only a raised shield
    // or the world itself stops it; any other shot ends on the first.
    if (!dead) for (const h of shotContacts(a, x0, y0, dx, dy)) {
      const t = h.t, hx = x0 + dx * h.s, hy = y0 + dy * h.s;
      if (h.k === 'eagle') {
        hurtEagle(state.drop.eagles[t.team], EAGLE_ARROW_DMG, players[a.owner], hx, hy); // a flat spook, not the body damage
        if (a.ambush) ambushFx(hx, hy);
        dead = true;
      } else if (h.k === 'dummy') {
        if (a.pierce && a.pierceHit.includes(t)) continue; // three tiles, one body
        hitDummy(t, a.dmg, hx, hy);
        if (a.ambush) ambushFx(hx, hy);
        a.struck = true;
        if (a.pierce) a.pierceHit.push(t); // the pierce keeps flying
        else dead = true;
      } else if (h.k === 'face') {
        hitPTarget(t); // the face explodes on contact
        a.ptHit = true; // this shot keeps the consecutive-hit run alive
        if (a.ambush) ambushFx(hx, hy);
        dead = true;
      } else if (h.k === 'wall') {
        dead = true;
        // ...and when the wall that stopped it is a RIVAL'S BUILDING, the shot
        // SIEGES it. Every bit a wall stops does, whatever it is, at STRUCT_DR
        // off (hurtStruct, js/sim/actions.js) - and a bit that passes walls
        // (`solid: false`: the care arrow, the wisp, the hook) buys that with
        // its siege, which is the whole of the trade and needs no second flag.
        const st = structOf(objAt(h.tx, h.ty));
        if (structFoe(sideOf(a), st)) hurtStruct(st, a.dmg, players[a.owner]);
        else shedHit(objAt(h.tx, h.ty)); // a shot into a pine knocks its crown's snow loose (js/sim/shed.js)
        burst(hx, hy, '#cfd8e8', 3, 25, 0.25, true);
        if (a.burn > 0) burst(hx, hy, '#ff9440', 7, 50, 0.5);
      } else if (h.k === 'player' && abShieldBlocks(t, nx, ny)) {
        // a raised tower shield eats any shot flying into its front arc -
        // bolts and pierces included - before the body behind it is ever asked
        burst(hx, hy, '#c8d2e4', 6, 45, 0.35, true);
        burst(hx, hy, '#f4f7ff', 3, 30, 0.3, true);
        sfxAt('hit', hx, hy);
        dead = true;
      } else {
        blow(t, h.k === 'robot' ? ROBOT_KB : h.k === 'animal' ? 25 + 45 * a.pow : undefined, hx, hy);
        if (h.k === 'player') burst(hx, hy, '#cfd8e8', 6, 45, 0.4);
        if (a.pierce) a.pierceHit.push(t);
        else dead = true;
      }
      if (dead) { a.struck = true; end = h.s; break; }
    }
    if (end < 1) { a.x = x0 + dx * end; a.y = y0 + dy * end; }
    // a faint mote in the shooter's colour every few px of flight: the shot
    // reads as a streak, and whose shot it is reads from across the map. The
    // step just walked is subdivided (rather than one mote per tick) so the
    // spacing survives both a slow arrow and a long frame; the motes are laid
    // off the TAIL (the body runs ARROW_LEN px behind the tip a shaft flies
    // by, so the trail flows off the fletching, never through the body) at
    // the distance they are owed and left to fade in place - and not before
    // the tail has cleared the bow, or every launch flicks a mote across the
    // archer's back.
    a.trailD += vd * dt * end;
    a.flown = (a.flown || 0) + vd * dt * end;
    const tailB = (a.kind === 'rock' || a.path === 'lob' || a.path === 'orbit') ? 0 : ARROW_LEN;
    while (a.trailD >= ARROW_TRAIL_STEP) {
      a.trailD -= ARROW_TRAIL_STEP;
      if (a.flown < tailB + a.trailD) continue;
      particles.push({
        x: a.x - nx * (tailB + a.trailD), y: a.y - ny * (tailB + a.trailD),
        vx: -nx * 8, vy: -ny * 8,
        life: ARROW_TRAIL_LIFE, maxLife: ARROW_TRAIL_LIFE,
        // the trail says WHOSE shot it is, which is what it is for - except a
        // burning one, where the fire is the more urgent fact about it
        color: a.burn > 0 ? (((a.trailD * 3) | 0) % 2 ? '#ff9440' : '#ffd95c') : TEAMS[skin(a.team)].mark,
        size: 1, grav: 0, alpha: ARROW_TRAIL_A,
      });
    }
    if (dead) {
      // A TURRET'S ROCK comes down where it was thrown rather than simply
      // stopping, and the thump is the only door a rock has to a building -
      // it flies over the world and never meets one in the air (rockLands,
      // js/sim/structures.js).
      if (a.kind === 'rock') rockLands(a);
      // CINDER BURST: the shot ends and its embers go everywhere. Everything
      // alive in the ring catches - the ring is the bit, so it does not care
      // what kind of body is standing in it (unitsNear, js/sim/actions.js).
      if (a.cinder > 0) {
        const src = players[a.owner];
        for (const t of unitsNear(sideOf(a), a.x, a.y, a.cinder)) igniteUnit(t, a.burn, a.burnDps, src);
        burst(a.x, a.y, '#ff9440', 14, 90, 0.5);
        burst(a.x, a.y, '#ffd95c', 10, 70, 0.45);
        sfxAt('break_', a.x, a.y);
      } else if (a.burn > 0) {
        burst(a.x, a.y, '#ff9440', 8, 55, 0.55);
      }
      // ...and what the BIT does where it ends, but only if it ended ON
      // something rather than simply running out over open snow: that
      // distinction is the teleport request's whole rule (js/sim/tools.js).
      if (a.impact && a.struck) bitImpact(a);
      // a practice shot that ends any way but in a target face breaks the
      // range's consecutive-hit run (agStreak, js/sim/practice.js) - minigame or not
      // ...and a run worth mourning says so on the way out: dropping one shot
      // is not news, dropping a milestone run is (AG_RUN_STEP, js/sim/practice.js)
      if (PRACTICE && !a.ptHit) { if (agStreak >= AG_RUN_STEP) SFX.runBroke(); agStreak = 0; }
      // A shot that ends - a miss, a wall, a body, or the end of its life -
      // just vanishes: nothing is ever lying in the snow to walk back over.
      arrows.splice(i, 1);
    }
  }

  updateWildlife(dt); // the animals, the fish, the orca and the camps (below)
  if (PRACTICE) updatePractice(dt); // the dummy mends itself between combos

  // the named place the local player is standing in drives the arrival toast
  if (player.dead || inAir(player)) state.loc = null;
  else {
    const here = campAt(player.x, player.y);
    if (!here) state.loc = null;
    else if (!state.loc || state.loc.L !== here) state.loc = { L: here, t: 0 };
    else state.loc.t += dt;
  }

  // structures + their robots
  updateStructures(dt);
  updateRespawns(dt);
  for (const b of robots) updateRobot(b, dt);
  for (let i = robots.length - 1; i >= 0; i--) if (robots[i].dead) robots.splice(i, 1);
  zipCrash(); // rivals meeting on a cable (js/sim/zipline.js): every rider has stepped

  // everyone has stepped: push overlapping units apart (players, animals, robots)
  separateUnits(dt);

  // drops
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t += dt;
    if (d.lockT > 0) d.lockT = Math.max(0, d.lockT - dt); // what one player threw, still refusing that one hand
    d.vz -= 220 * dt;
    d.z += d.vz * dt;
    if (d.z < 0) { d.z = 0; d.vz = -d.vz * 0.4; if (Math.abs(d.vz) < 15) d.vz = 0; }
    d.x += d.vx * dt; d.y += d.vy * dt;
    d.vx *= Math.pow(0.05, dt); d.vy *= Math.pow(0.05, dt);
    // drops are neutral: they drift toward whoever is closest, and everyone
    // standing on one claims it - the contest decides who actually gets it.
    // A player with no room for it is neither magnetised nor a claimant, so a
    // full bag hands the pickup to whoever else is standing there instead of
    // sitting on it. (Gold never lies here - awardGold pays it on the spot.)
    // ...and "room" counts the free cells of the tool in hand, not just the
    // pack's: a found bit arms itself (fitRoom / fitAdd, js/sim/tools.js), so a
    // full pack with an empty bit cell still pulls a bit in and still claims
    // it - and a body that will SWAP for the one in hand is always room,
    // because that pickup is an exchange and not an addition (toolUpgrade)
    const roomFor = (p) => fitRoom(p, d.type) > 0 || toolUpgrade(p, d.it);
    let near = null, pd = 1e9;
    for (const p of players) {
      if (!p.active || p.dead || inAir(p) || dropLocked(d, p) || !roomFor(p)) continue;
      const dd = Math.hypot(d.x - p.x, d.y - p.y);
      if (dd < pd) { pd = dd; near = p; }
    }
    if (near && d.t > 0.35 && pd < 28) {
      d.x += (near.x - d.x) * dt * 10;
      d.y += (near.y - d.y) * dt * 10;
    }
    if (d.t > 0.35) for (const p of players) {
      if (!p.active || p.dead || inAir(p) || Math.hypot(d.x - p.x, d.y - p.y) >= 7) continue;
      // your own throw, inside its three seconds: not a claimant and not a
      // refusal either - you are standing on something you meant to put down
      if (dropLocked(d, p)) continue;
      // standing on a pickup you cannot carry says so on the HUD and leaves
      // it lying there - the drop is not consumed and not destroyed
      if (!roomFor(p)) { if (p === player) bagDenied(); continue; }
      contest('drop:' + i, p, () => {
        const j = drops.indexOf(d);
        if (j < 0) return;
        // a pickup takes only what fits, and what was taken comes OFF the
        // drop, so a stack that only partly fits leaves its remainder lying
        // there instead of being picked up forever. An instanced drop (a
        // loaded tool) goes in whole or not at all - it cannot be split.
        //
        // A STRICTLY BETTER BODY takes the hand instead, and the build with
        // it (takeUpgrade, js/sim/tools.js). What comes off is then treated
        // exactly as this find was a moment ago: the pack, or the snow it was
        // lying in - so the exchange never needs a cell that is not there.
        let got;
        if (toolUpgrade(p, d.it)) {
          const old = takeUpgrade(p, d.it);
          got = 1;
          if (!bagPut(p, old)) spawnDrop(d.x, d.y, old.type, 1, old);
        } else got = d.it ? (bagPut(p, d.it) ? 1 : 0) : fitAdd(p, d.type, d.n);
        if (got > 0) {
          d.n -= got;
          addFloater(p.x, p.y - 14, '+' + got, RES_COLORS[d.type]);
          noteSeen(p, d.type); // the local player has now held one: mark the tech node
          sfxFor(p, 'stash');
        }
        if (d.n <= 0) drops.splice(j, 1); else d.t = 0;
      });
    }
  }

  tickObjTimers(dt); // the blinks, shivers and regrowth running on map objects (the `object timers` banner)

  resolveContests(); // the drop pickups queued above
}

// wildlife, one step of updatePlay: the animals, the lake's fish, the orca,
// the camps' clocks and the meadow's stock
function updateWildlife(dt) {
  for (const a of animals) updateAnimal(a, dt);
  for (let i = animals.length - 1; i >= 0; i--) if (animals[i].dead) animals.splice(i, 1);
  updateFish(dt);
  updateOrca(dt); // the orca under its lake's ice: the cruise, the hunt and the breach (js/sim/orca.js)
  updateCamps(dt); // a cleared camp counts down and comes back whole
  if (!PRACTICE) updatePreyStock(dt); // and the meadow keeps its rabbits and deer
}

const WADE_SHOVE = 40; // px/s of knockback that carries a bot into open water it would never walk into

// One player's step - movement, tools, timers. A human, an AI fill and (later)
// a network peer all run exactly this; only who wrote p.input differs.
// ------------------------------------------------------------ the player's step
// updatePlayer, at the end of this banner, is every body's step off its own
// input. The walk inside it comes first, in pieces: the surface model's step for a body on its feet: the input accelerates
// vx/vy, the surface sets the friction and the caps, and the body moves
// against the tiles. Then the step's own named stretches (playerIntents to
// playerTool), in the order updatePlayer runs them. playerMove runs the walk whenever nothing else owns the
// velocity (a roll, a rush, the rope, a leap, the cable, the water), and a
// client runs these same functions on its own body ahead of the host's word
// (netPredict, js/net/net.js) - so they read only the body, its input and
// the tiles, and touch nothing but the body.
function kbDecay(p, dt) {
  p.kbx = (p.kbx || 0) * Math.pow(0.01, dt);
  p.kby = (p.kby || 0) * Math.pow(0.01, dt);
}
function iceUnder(p) {
  const ftx = Math.floor(p.x / TILE), fty = Math.floor((p.y + 4) / TILE);
  return inWorld(ftx, fty) && ground[idx(ftx, fty)] === 1;
}
function clampWorld(p) {
  p.x = Math.max(8, Math.min(WORLD * TILE - 8, p.x));
  p.y = Math.max(8, Math.min(WORLD * TILE - 8, p.y));
}
// the input's heading, normalised, and its length before (0: no input); the
// body faces it and remembers it
function walkHeading(p, mx, my, auto) {
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    mx /= len; my /= len;
    if (!auto) { p.lastMx = mx; p.lastMy = my; } // kept across the stop: the zipline's clip-on reads it (zipStart, js/sim/zipline.js)
    if (p.swingT <= 0 && p.faceT <= 0) faceToward(p, mx, my);
  }
  return { mx, my, len };
}
// shift-slide: only engages above walking speed; keeps momentum, drops the tools
function walkSlide(p, slide, dt, onIce, kit) {
  const sp = Math.hypot(p.vx, p.vy);
  const wantSlide = slide && p.dodgeT <= 0 && !p.prone && !p.mount; // nothing glides on its belly, or on deer-back
  if (!p.sliding && wantSlide && sp > kit.slideMin && p.wade <= DEEP_SLIDE_BAR) { // nobody launches a slide out of a drift
    p.sliding = true;
  }
  if (p.sliding && (!wantSlide || sp < SLIDE_EXIT)) p.sliding = false;
  // slide fatigue: builds on snow so long slides run out of glide, recovers on
  // ice so a snow->ice->snow chain starts the snow leg fresh-ish
  if (p.sliding) {
    p.slideT = onIce ? Math.max(0, p.slideT - dt * 1.5) : p.slideT + dt * kit.fatigue;
  } else {
    p.slideT = 0;
  }
}
// mx/my/len: walkHeading's
function walkStep(p, dt, mx, my, len, onIce, kit) {
  let sp = Math.hypot(p.vx, p.vy);
  const chargeMul = p.charging ? kit.chargeMul : 1; // drawn bow slows you
  // every cap an ability may drag on (root, net, crater, cast, shield),
  // folded once - js/sim/abilities.js - with the meal's
  // own drag beside them (js/sim/core.js): a body chewing walks, exactly the way
  // a body mid-cast does
  const abMul = abilityMoveMul(p) * (p.eatT > 0 ? FOOD_SLOW : 1);
  // a belly crawl is a flat crawl on any surface - no ice cap, no draw
  // penalty, nothing to stack. Getting back up costs a moment of it too.
  // a rider goes at the deer's gallop (RIDE, js/sim/wildlife.js): not the
  // hero's stride, and a drawn bow does not slow the deer under it
  const walkMax = (p.mount ? PLAYER_SPEED * RIDE[p.mount.kind].mul
    : p.prone ? PRONE_SPEED
      : p.riseT > 0 ? PLAYER_SPEED * kit.walkMul * 0.45
        : PLAYER_SPEED * kit.walkMul * chargeMul) * abMul * wadeMul(p); // STRIDER lengthens the stride; deep snow drags (js/sim/depth.js)

  if (p.prone || p.rootT > 0 || (!onIce && !p.sliding && sp <= walkMax + 6)) {
    // plain snow walking: near-instant vector approach, tuned so it feels
    // exactly like the old fixed-speed movement (settles in ~3 frames)
    const f = 1 - Math.exp(-25 * dt);
    p.vx += (mx * walkMax - p.vx) * f;
    p.vy += (my * walkMax - p.vy) * f;
  } else {
    // carrying momentum (ice, slide, or overspeed on snow):
    // steer the heading toward the input, ease the speed toward the target
    let dirx = mx, diry = my;
    if (sp > 1) { dirx = p.vx / sp; diry = p.vy / sp; }
    let steer, decay, target;
    if (p.sliding) {
      // snow friction ramps with slide fatigue: early glide is cheap, the
      // tail drops off hard so slides end decisively
      steer = 1.7; target = 0;
      decay = onIce ? 0.15 : Math.min(2.6, 0.35 + 0.45 * p.slideT) * (1 + (DEEP_SLIDE - 1) * p.wade); // a drift eats a slide
    } else if (onIce) {
      const cap = ICE_MAX * kit.iceMax * chargeMul * abMul;
      if (len > 0) { steer = kit.iceSteer; target = cap; decay = sp < cap ? 1.1 : 0.35; }
      else { steer = 0; target = 0; decay = 0.18; } // idle glide
    } else {
      steer = 4.5; target = len > 0 ? walkMax : 0; decay = 3.5; // snow kills overspeed fast unless you slide
    }
    if (len > 0 && steer > 0 && (dirx !== 0 || diry !== 0)) {
      // carve: rotate the travel direction toward the input, never snap it
      const cur = Math.atan2(diry, dirx), want = Math.atan2(my, mx);
      let da = want - cur;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      const na = cur + Math.max(-steer * dt, Math.min(steer * dt, da));
      dirx = Math.cos(na); diry = Math.sin(na);
    }
    sp = target + (sp - target) * Math.exp(-decay * dt);
    p.vx = dirx * sp;
    p.vy = diry * sp;
  }

  // a bot never wades into open water on its own feet - only a shove
  // (knockback past WADE_SHOVE) or already standing in it lets it in
  const wade = p.control !== 'ai' || Math.hypot(p.kbx, p.kby) > WADE_SHOVE ||
    waterAt(Math.floor(p.x / TILE), Math.floor((p.y + 4) / TILE));
  const mv = moveEntity(p,
    (p.vx + p.kbx) * dt,
    (p.vy + p.kby) * dt, PLAYER_R, !wade);
  if (mv.blockedX) p.vx = 0; // a wall kills that axis instead of grinding
  if (mv.blockedY) p.vy = 0;
}

// ---- updatePlayer's steps, in the order it runs them ------------------
// Each is one named stretch of the body's step, and the order IS the step:
// a stretch moved ahead of another changes what each reads, and the rand()
// calls inside them draw on the sim's stream in exactly this order.

// what the controller asked for this step: a stun or a fish hoist first,
// then the edge-triggered intents, each consumed where it lands
function playerIntents(p, dt) {
  const inp = p.input;
  recallIntents(p); // anything the body does itself ends the walk home (js/sim/recall.js)

  // stunned: rolled through, or the wrong end of a tackle. Every intent is
  // dropped where it arrives rather than blocked at each action, so a human
  // and an AI fill are pinned by the identical window through the one input
  // struct they share. Velocity is left alone - whatever hit you still slides
  // you, and the surface spends it like any other momentum.
  if (p.stunT > 0) {
    p.stunT = Math.max(0, p.stunT - dt);
    inp.dodge = inp.eatBerry = inp.eatFish = inp.useCard = false;
    inp.work = inp.fire = inp.slide = false;
    inp.ability = -1;
    inp.cmd = null;
    inp.mx = inp.my = 0;
  }

  // the fish hoist (startCatch, js/sim/tools.js) is a pose the body holds only
  // while it is idle: a step, or any other intent (a fresh press, a roll, a
  // cast, a swing, a meal), ends it at once. The catch is automatic
  // (autoFish), so it must never cost the player a single frame of control.
  if (p.catchT > 0) {
    p.catchT = Math.max(0, p.catchT - dt);
    if (inp.dodge || inp.ability >= 0 || inp.work || inp.slide || inp.mx || inp.my ||
        inp.eatBerry || inp.eatFish || inp.cmd || (inp.fire && !p.firePrev)) cancelCatch(p);
  }

  // edge-triggered intents, consumed here so a controller only has to set them
  // (the burrow lost its own key: SNOW COVER, hunter key 4, is the door in now)
  if (inp.dodge) { inp.dodge = false; tryDodge(p); }
  if (inp.eatBerry) { inp.eatBerry = false; eatBerry(p); }
  if (inp.eatFish) { inp.eatFish = false; eatFish(p); }
  if (inp.useCard) { inp.useCard = false; useCard(p); }
  // an unopened card opens the moment it is held and the body is on the
  // ground (0.426): no key and no strip button, so a card is a buff that
  // lands, never a thing to remember to press
  if (cardsHeld(p) > 0 && !inAir(p)) useCard(p);
  // an ability key with a skill point in hand LEVELS the key instead of
  // casting it (the plate is the same buy for the mouse); the cast waits for
  // the next press. A maxed key casts through an unspent point as ever.
  if (inp.ability >= 0) { const i = inp.ability; inp.ability = -1; if (abLvCanBuy(p, i)) buyAbilityLv(p, i); else tryAbility(p, i); }
  if (inp.cmd) { // what came of it is kept for the body's bot (me.lastCmd, js/ai/bot-api.js)
    const c = inp.cmd; inp.cmd = null;
    const r = runCmd(p, c);
    p.lastCmd = { kind: String(c.kind), tick: state.tick, ok: r === true, why: typeof r === 'string' ? r : null };
  }
}

// what owns the velocity this step, first come: the water, the roll, the
// rush, the rope, the leap, the cable, else the feet (walkStep)
function playerMove(p, dt, mx, my, len, onIce, kit) {
  const inp = p.input;
  if (p.fallT > 0) {
    // floundering in an ice hole: no control until the climb-out
    p.fallT -= dt;
    p.vx = p.vy = 0;
    p.sliding = false;
    p.fallRipT -= dt;
    if (p.fallRipT <= 0) {
      p.fallRipT = 0.16;
      burst(p.x + rand(-3, 3), p.y + 4, '#9fc4dd', 2, 16, 0.3, true);
    }
    if (p.fallT <= 0) {
      // scramble out onto the nearest walkable tile
      const out = nearestDryTile(p.x, p.y, p);
      p.x = (out.tx + 0.5) * TILE;
      p.y = (out.ty + 0.5) * TILE;
      p.invuln = Math.max(p.invuln, 0.8);
      burst(p.x, p.y + 4, '#cfe4f2', 8, 40, 0.45, true);
      sfxAt('dodge', p.x, p.y);
    }
  } else if (p.dodgeT > 0) {
    // rolling: the dash owns the velocity; friction waits until the roll ends,
    // so whatever speed the dash reached is carried out for the surface to spend
    p.dodgeT -= dt;
    const vx0 = p.vx, vy0 = p.vy;
    // deep snow shortens the roll's travel, not its speed: what it hits for
    // and what it carries out are the dash's own
    const rm = 1 - (1 - DEEP_DODGE) * p.wade;
    const mv = moveEntity(p, p.vx * dt * rm, p.vy * dt * rm, PLAYER_R);
    if (mv.blockedX) p.vx = 0; // a wall still kills that axis - see below for when it costs more
    if (mv.blockedY) p.vy = 0;
    // A wall taken head-on is a tackle, not a graze: only the speed actually
    // driven into the blocked axis counts, so brushing past a tree at a run
    // is free while dashing straight into one is not.
    const into = Math.max(mv.blockedX ? Math.abs(vx0) : 0, mv.blockedY ? Math.abs(vy0) : 0);
    if (into > TACKLE_MIN) {
      const d = Math.hypot(vx0, vy0) || 1, tnx = vx0 / d, tny = vy0 / d;
      tackleObject(tackleObjAhead(p, tnx, tny), rollDmg(p, d), p);
      rollTackle(p, d, tnx, tny);
    } else {
      rollSweep(p); // everything small in the way takes a swipe and is rolled through
    }
    creekFishCatch(p); // ...and a fish in the creek under it is taken (js/sim/world.js)
    p.dodgeDustT -= dt;
    if (p.dodgeDustT <= 0) {
      p.dodgeDustT = 0.05;
      burst(p.x, p.y + 5, '#dfe8f4', 2, 22, 0.3, true);
    }
    if (p.dodgeT <= 0) { p.rollHit.length = 0; burst(p.x, p.y + 4, '#cfd8e8', 4, 30, 0.3, true); }
  } else if (p.rushT > 0) {
    // BULL RUSH: the charge owns the velocity the way a roll does - straight
    // down its line, walls and the first body met resolved by rushStep
    p.rushT -= dt;
    // the first RUSH_RAMP seconds come up to speed rather than snapping to
    // it, so the charge leaves the wind-up smooth instead of teleporting a
    // frame down the line
    const ramp = Math.min(1, 0.4 + 0.6 * (RUSH_T - p.rushT) / RUSH_RAMP);
    p.vx = p.rushNX * RUSH_SPD * ramp;
    p.vy = p.rushNY * RUSH_SPD * ramp;
    const mv = moveEntity(p, p.vx * dt, p.vy * dt, PLAYER_R);
    rushStep(p, mv, dt);
  } else if (p.grapT > 0) {
    // GRAPPLE: the rope owns the velocity while the key is held - hauled
    // straight at the anchor at GRAP_REEL. Letting go of the key, arriving,
    // a wall, or the safety timer all end in grapEnd (js/sim/abilities.js), which
    // KEEPS the velocity - so the reel's speed rides out into the surface
    // model, and shift turns it into a slide.
    p.grapT -= dt;
    const gdx = p.grapX - p.x, gdy = p.grapY - p.y;
    const gd = Math.hypot(gdx, gdy) || 1;
    p.vx = gdx / gd * GRAP_REEL;
    p.vy = gdy / gd * GRAP_REEL;
    const mv = moveEntity(p, p.vx * dt, p.vy * dt, PLAYER_R);
    p.grapDustT = (p.grapDustT || 0) - dt;
    if (p.grapDustT <= 0) {
      p.grapDustT = 0.06;
      burst(p.x, p.y + 5, '#dfe8f4', 1, 20, 0.3, true);
    }
    if (!inp.grapple || gd <= GRAP_ARRIVE || mv.blockedX || mv.blockedY || p.grapT <= 0) grapEnd(p);
  } else if (p.leapT > 0) {
    // THE LEAP on deer-back: it owns the velocity the way a roll does, and
    // clears a felled trunk (rideLeapStep, js/sim/wildlife.js)
    rideLeapStep(p, dt);
  } else if (p.zip >= 0) {
    // ZIPLINE: the cable owns the position outright - no moveEntity, so
    // nothing under it stops a rider - and sets the velocity the exit keeps
    // (zipStep/zipEnd, js/sim/zipline.js). Knockback decays above and is never spent.
    zipStep(p, dt, mx, my, len);
  } else {
    walkStep(p, dt, mx, my, len, onIce, kit);
  }
}

function playerPlunge(p) {
  // open water: standing over a carved ice hole plunges you in, and so does
  // the creek. An active dodge roll carries over both: a hole's one tile
  // easily, the creek's three only from its bank, so a roll that runs out over
  // the current goes in. The creek asks the feet against its banks as drawn
  // (creekWet), so nobody goes in off a pixel of snow or the frozen stretch.
  if (p.fallT <= 0) {
    const htx = Math.floor(p.x / TILE), hty = Math.floor((p.y + 4) / TILE);
    const g = inWorld(htx, hty) ? ground[idx(htx, hty)] : 0;
    // a tile an ice break holds open is wet only where its pixels are: the
    // break's own shape says where the water is (iceBreakWet, js/sim/icebreak.js)
    const held = g === 2 && iceBreakHolds(idx(htx, hty));
    // a net is planked over its hole: you stand on it, and that is how the
    // catch comes out of it (see updateStructures' net branch)
    if ((g === 2 && !held && p.dodgeT <= 0 && !netAt(htx, hty)) ||
      (iceBreaks.length && p.dodgeT <= 0 && !netAt(htx, hty) && iceBreakWet(p.x, p.y + 4)) ||
      (g === 4 && p.dodgeT <= 0 && creekWet(p.x / TILE - 0.5, (p.y + 4) / TILE - 0.5))) {
      p.dodgeT = 0; p.rollHit.length = 0; // a roll ends in the water
      p.fallT = HOLE_FALL_T;
      p.fallRipT = 0;
      p.vx = p.vy = 0;
      p.sliding = false;
      p.slideT = 0;
      if (p.rushT > 0) { p.rushT = 0; p.rushVictim = null; } // the charge ends in the water
      if (p.grapT > 0) grapEnd(p);                          // the rope goes slack with you
      p.castT = 0; p.castAb = -1; p.shieldT = 0;           // and so does whatever was being cast
      breakEat(p);                                         // the meal goes in the water with you
      breakMine(p);                                        // ...and the rock is left where it stood
      p.prone = false; p.hide = 0; p.riseT = 0; // crawled off the edge: no cover in the water
      if (p.charging) { p.charging = false; p.chargeT = 0; }
      p.fireArmed = false;
      sfxAt('splash', p.x, p.y);
      burst(p.x, p.y + 4, '#3a6080', 10, 55, 0.5, true);
      burst(p.x, p.y + 2, '#ddf1f8', 8, 60, 0.5, true);
      damagePlayer(p, HOLE_FALL_DMG, 0, 0, null, g === 4 ? 'creek' : 'ice');
    }
  }
}

function playerCover(p, dt, ftx, fty, kit) {
  // ---- the cover -------------------------------------------------------
  // `hide` is the whole stealth state. Lying still on snow pulls it over you
  // over PRONE_BURY; crawling holds what you already have (concealOf discounts
  // a moving mound rather than unpacking it); bare ice hides nothing at all,
  // so the river strips a crawler without forcing them upright; and anything
  // that puts you back on your feet sheds it over the rise window.
  if (p.prone) {
    const snow = inWorld(ftx, fty) && ground[idx(ftx, fty)] === 0;
    if (!snow) p.hide = Math.max(0, p.hide - dt * 2.2);
    else if (!p.moving && p.hide < 1) {
      p.hide = Math.min(1, p.hide + dt / kit.bury);
      if (p.hide >= 1) { p.hideFlash = 0.4; sfxFor(p, 'hidden'); }
    }
    p.crawlT = p.moving ? p.crawlT + dt * 3.6 : 0;
    // One timer, two jobs, and which one it is doing says what state the body
    // is in. While the cover is still building it throws up the snow being
    // pulled over; once it is finished it becomes breath in cold air - the
    // fair tell that makes "almost invisible" true rather than a promise, and
    // the one thing a mound holding perfectly still still does.
    p.puffT -= dt;
    if (p.puffT <= 0) {
      if (p.hide < 1) {
        p.puffT = rand(0.14, 0.26);
        if (!p.moving) burst(p.x + rand(-6, 6), p.y + rand(0, 5), '#eef4fb', 1, 15, 0.34, true);
      } else {
        p.puffT = rand(1.8, 3.2);
        const bx2 = p.dir === 'left' ? -5 : p.dir === 'right' ? 5 : 0;
        const by2 = p.dir === 'up' ? -3 : 2;
        for (let i = 0; i < 3; i++) {
          particles.push({
            x: p.x + bx2 + rand(-1, 1), y: p.y + by2, vx: rand(-4, 4), vy: rand(-12, -6),
            life: rand(0.5, 0.9), maxLife: 0.7, color: '#dbe8f6', size: 1, grav: -8, alpha: 0.5,
          });
        }
      }
    }
  } else if (p.hide > 0) {
    p.hide = 0; // nothing but tryProne can put cover back on; never let it stick
  }
  if (p.riseT > 0) p.riseT = Math.max(0, p.riseT - dt);
  p.hideFlash = Math.max(0, p.hideFlash - dt);
}

function playerStamina(p, dt, kit) {
  // dodge charges refill one at a time
  if (p.dodgeCharges < DODGE_CHARGES) {
    p.dodgeRegenT -= dt;
    if (p.dodgeRegenT <= 0) {
      p.dodgeCharges++;
      p.dodgeRegenT = p.dodgeCharges < DODGE_CHARGES ? kit.dodgeCd : 0;
    }
  }
  // spent-stamina ghost: hold briefly, then drain toward the live fill
  {
    const regenP = p.dodgeCharges < DODGE_CHARGES ? 1 - p.dodgeRegenT / kit.dodgeCd : 0;
    const frac = (p.dodgeCharges + regenP) / DODGE_CHARGES;
    if (p.stamGhostT > 0) p.stamGhostT -= dt;
    else p.stamGhost -= dt * 1.6;
    if (p.stamGhost < frac) p.stamGhost = frac;
  }
}

// the marks the body leaves: the crawl's furrow, the stride's prints (and the
// walk's clock), the slide's carved double trail
function playerTrails(p, dt, onIce) {
  const spNow = Math.hypot(p.vx, p.vy);
  // the crawl leaves a drag furrow instead of footprints: a broad flattened
  // trough with an elbow dimple alternating either side of it. It is a real
  // tell - a line like that leads anyone who reads it straight to the mound at
  // the end - and that is the point. The cover is beatable by someone looking.
  if (p.prone && spNow > 2) {
    p.trailD -= spNow * dt;
    const bx = p.vx / spNow, by = p.vy / spNow;
    let emit = 0;
    while (p.trailD <= 0 && emit++ < 4) {
      const back = -p.trailD;
      p.footSide = 1 - p.footSide;
      footprints.push({
        x: p.x - bx * back, y: p.y + 5 - by * back,
        nx: -by, ny: bx, t: 0, k: 3,
        // an elbow scuff off to one side of the trough on every other mark,
        // swapping sides every few of them, the way a crawl actually alternates
        s: p.footSide ? (Math.floor(p.crawlT) % 2 ? 1 : -1) : 0,
      });
      p.trailD += 2; // marks are two deep, so at this spacing they tile into one trough
    }
    while (footprints.length > 800) footprints.shift();
  }
  if (spNow > 8 && p.dodgeT <= 0 && !p.sliding && !p.prone && p.zip < 0) { // a rider's feet are off the snow
    // the stride keeps time with the snow going by: a drawn bow's creep and a
    // drift's wade step slower, an ice run a little quicker (nothing but the
    // drawn stride reads it: drawPlayer, js/draw/bodies.js)
    p.animT += dt * 9 * Math.max(0.55, Math.min(1.3, spNow / PLAYER_SPEED));
    p.footT -= dt;
    if (p.footT <= 0) {
      p.footT = 0.16;
      p.footSide = 1 - p.footSide;
      const side = p.footSide ? 2 : -2;
      const px = p.dir === 'left' || p.dir === 'right' ? p.x : p.x + side;
      const py = p.dir === 'left' || p.dir === 'right' ? p.y + 6 + (p.footSide ? 1 : -1) : p.y + 6;
      footprints.push({ x: px, y: py, t: 0 });
      sfxFor(p, 'step');
      if (footprints.length > 400) footprints.shift();
    }
  } else {
    p.animT = 0; // sliding/gliding uses the standing pose
  }

  // fast slide: carve a double trail (footprint decals, spaced ~2.5px so the
  // marks overlap into continuous lines) and kick up snow spray. Snow gets
  // two-tone carved grooves (k:1, lip offset toward the outer side); ice gets
  // thin frosted skate scratches (k:2).
  if (p.sliding && spNow > TRAIL_MIN) {
    p.trailD -= spNow * dt;
    const nx = -p.vy / spNow, ny = p.vx / spNow;
    const k = onIce ? 2 : 1;
    let emit = 0;
    while (p.trailD <= 0 && emit++ < 6) {
      // interpolate the mark back along the path so the spacing stays even
      // no matter how far a single frame travelled
      const back = -p.trailD;
      const bx = p.x - ny * back, by = p.y + 6 + nx * back;
      footprints.push({ x: bx + nx * 2, y: by + ny * 2, t: 0, k });
      footprints.push({ x: bx - nx * 2, y: by - ny * 2, t: 0, k });
      p.trailD += 2.5;
    }
    while (footprints.length > 800) footprints.shift();
    p.slideDustT -= dt;
    if (p.slideDustT <= 0) {
      p.slideDustT = 0.1;
      burst(p.x, p.y + 5, '#eef4fb', 1, 18, 0.3, true);
    }
  }
}

// the hands: the swing's clock and its hit, the work key, the hands' own
// work and fishing. True when a fresh press took the body down a tunnel,
// which ends its step there
function playerSwing(p, dt) {
  const inp = p.input;
  // swing
  p.swingCd = Math.max(0, p.swingCd - dt);
  if (p.swingT > 0) {
    p.swingT -= dt;
    if (!p.swingHitDone && p.swingT < 0.12) {
      p.swingHitDone = true;
      swingHit(p);
    }
  }
  // the work tool goes away with the swing cooldown; held E brings it right
  // back, and with no E the hands find their own work (autoWork, js/sim/actions.js:
  // a tree or a berried bush in reach) - and their own fish (autoFish, js/sim/tools.js)
  if (p.swingT <= 0 && p.swingCd <= 0) p.swing = SWING_BOW;
  // a tunnel's hole underfoot takes a FRESH press of the work key ahead of
  // the swing (js/sim/tunnel.js) - a key held since before stays the swing's
  if (inp.work && !p.tunE && tunnelEnter(p)) { p.tunE = true; return true; }
  p.tunE = !!inp.work;
  if (inp.work) tryWork(p); else autoWork(p);
  autoFish(p, dt);
  return false;
}

function playerTool(p, dt) {
  const inp = p.input;
  // the cycle: the cooldown a shot starts (toolCycle, js/sim/tools.js) counts
  // down, and its end is the ONE gate between presses. It runs for every
  // player - dead or alive is already filtered above - so a bot recovers on
  // exactly the human's clock.
  if (p.nockT > 0) {
    p.nockT = Math.max(0, p.nockT - dt);
    if (p.nockT === 0) { p.readyFlash = 0.16; sfxFor(p, 'nock'); }
  }
  p.readyFlash = Math.max(0, p.readyFlash - dt);
  p.dryT = Math.max(0, p.dryT - dt);
  p.slashT = Math.max(0, p.slashT - dt); // the blade's sweep in the hand (slashTool, js/sim/tools.js)

  // The tool: pressing arms the shot, releasing fires it. The press does not
  // have to land on a ready tool - it stays armed, so holding through the
  // cycle draws the moment the wipe clears. Without that, a controller that
  // holds fire down - every bot does - would fire once and then wait
  // forever for an edge it already spent. `toolReady` is the only other
  // refusal: a slot with no tool in it, or a tool with no bit light enough to
  // throw, is dry.
  const armed = toolReady(p);
  if (inp.fire && !p.firePrev) {
    // THE BUTTON IS THE CANCEL. A meal must never trap the hands: deciding
    // mid-chew that the fight matters more drops it on the spot and the draw
    // below arms in the same frame. It costs the 1.5 s and nothing else - the
    // food is only spent when the channel lands (js/sim/core.js) - so a cancelled
    // meal can be started again the moment the shot is away. The roll is the
    // other escape; E and the ability keys stay refused instead, because those
    // spend a cooldown a stray press should not.
    breakEat(p);
    p.fireArmed = true;
    if (!armed && p.dryT <= 0) dryFire(p);
  }
  if (!inp.fire) p.fireArmed = false;
  if (p.fireArmed && !p.charging && p.nockT <= 0 && armed && p.fallT <= 0 && (p.swingT <= 0 || p.autoSwing) &&
    p.castT <= 0 && p.shieldT <= 0 && p.rushT <= 0 && p.eatT <= 0 && p.zip < 0) { // ...and both hands on a zipline's handle // a body mid-ability has no hand free for the draw (a meal is already cancelled by the press above); an auto swing is never in the way
    p.charging = true;
    p.chargeT = 0;
    sfxAt('bowDraw', p.x, p.y);
  }
  if (!inp.fire && p.charging) {
    p.charging = false;
    fireTool(p);
    p.chargeT = 0;
  }
  p.firePrev = inp.fire;

  // bow draw: charge up and keep facing the aim point. chargeT is the raw
  // seconds held, never clamped - every reader takes drawPow() (0..1) off it,
  // and the meter's white blink at the peak (DRAW_FULL_FLASH) needs to see
  // the hold run PAST the full draw
  if (p.charging) {
    p.chargeT += dt;
    faceToward(p, inp.aimX - p.x, inp.aimY - p.y);
  }
}

function updatePlayer(p, dt) {
  const inp = p.input;

  if (p.dead) { // out of the match: nothing it wants gets through
    inp.dodge = inp.eatBerry = inp.eatFish = inp.useCard = false;
    inp.ability = -1;
    inp.cmd = null;
    return;
  }

  playerIntents(p, dt);

  // the class abilities' own clock: cooldowns, the cast landing, and every
  // timed state one leaves on this body (js/sim/abilities.js)
  updateAbilities(p, dt);
  if (p.dead) return; // a burn can finish the player in there; a body takes no more steps
  // ...and the meal's clock beside it: the channel landing its heal, and the
  // one cooldown a berry and a fish share (js/sim/core.js)
  updateEat(p, dt);
  // ...and the recall's, with the roost ring's heal (js/sim/recall.js)
  updateRecall(p, dt);
  // ...and the pick's: the rock in reach mining itself (js/sim/mining.js)
  updateMine(p, dt);

  // a stun, a fall, going prone or the cable takes a rider out of the saddle (js/sim/wildlife.js)
  rideCheck(p);
  if (p.leapCd > 0) p.leapCd = Math.max(0, p.leapCd - dt);

  // input - or the walk to the zipline holding the stick for the player
  // (zipWalkStep, js/sim/zipline.js: any input of their own ends it), which leaves
  // lastMx/lastMy alone so the clip-on still reads the walk before the press
  let mx = inp.mx, my = inp.my, auto = false;
  if (p.zipWalk) { const w = zipWalkStep(p, dt); if (w) { mx = w.mx; my = w.my; auto = true; } }
  const hd = walkHeading(p, mx, my, auto), len = hd.len;
  mx = hd.mx; my = hd.my;

  kbDecay(p, dt);

  // ---- unified momentum: input accelerates vx/vy, the surface sets friction/caps
  // (the tile the step starts on, before anything moves the body: the cover
  // reads the ground the body was lying on), before anything moves the body: the cover
  // reads the ground the body was lying on
  const ftx = Math.floor(p.x / TILE), fty = Math.floor((p.y + 4) / TILE);
  const onIce = iceUnder(p);
  const kit = kitOf(p);
  walkSlide(p, inp.slide, dt, onIce, kit);
  playerMove(p, dt, mx, my, len, onIce, kit);
  clampWorld(p);
  playerPlunge(p);
  playerCover(p, dt, ftx, fty, kit);
  playerStamina(p, dt, kit);
  playerTrails(p, dt, onIce);
  if (playerSwing(p, dt)) return; // gone down a tunnel: under the snow, the step ends
  playerTool(p, dt);

  p.hurtT = Math.max(0, p.hurtT - dt);
  itemsTick(p, dt); // the fight clock and DEN's heal (js/sim/items.js)
  p.faceT = Math.max(0, p.faceT - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  // gentle regen in daylight (HEARTHWEAVE keeps the hearth lit after dark)
  if (p.hp < p.maxHp && (state.darkness < 0.3 || kit.nightHeal)) {
    healPlayer(p, dt * 0.6);
  }
}

// ------------------------------------------------------------ fx updates
// Snow lives in the world, not on the glass: a flake has a world position,
// drifts in world px, and scrolls with the camera like everything else. The
// field is kept exactly one view in size and drawn wrapped modulo VIEW_W/H
// around the camera, so the screen is always covered at constant density
// whatever the zoom or view size (fitFlakes sizes the array) while a pan
// still slides every flake the right way. A flake falls for h world px,
// lands (rests on the ground fading out for FLAKE_REST s) and is reborn
// somewhere in the field - the fall is not screen-top to screen-bottom.
const FLAKE_REST = 0.7;
// The field is ONE WORLD VIEW in size, not one screen: a flake is a real thing
// of a real size falling through the world, so the zoom has to reach it like it
// reaches everything else. Count follows the world AREA on screen (zoom out and
// you are looking at more sky, so more snow is in it) and size follows the zoom
// (up close a flake is a fat crumb, not a pixel) - between them the amount of
// white in frame stays about constant while the grain of it changes, which is
// what "further away" looks like. Both are clamped: physics alone would leave
// six flakes on screen at the closest rung and a blizzard of specks at the
// widest, and neither reads as snow.
const FLAKE_AREA = 480 * 270; // the world view the density was tuned on, in world px
const FLAKE_BASE = 70;       // flakes per FLAKE_AREA of world in frame (a 640x360 view at zoom 1 gets 124)
const FLAKE_MIN = 26, FLAKE_MAX = 240;
const flakes = [];
// a fresh flake somewhere in the field, from the given random stream
function makeFlake(r) {
  return {
    x: r() * WV_W, y: r() * WV_H,      // offset inside the field; the camera adds the rest
    h: 30 + r() * 90,                  // world px left to fall before it lands
    rest: 0,                           // >0: landed, seconds of rest left
    spd: 9 + r() * 17, sway: 0.4 + r(), ph: r() * 9,
    size: r() < 0.75 ? 1 : 2, a: 0.35 + r() * 0.45,
  };
}
// EXACTLY seventy, off the main stream, and that count is load-bearing: this
// runs before genWorld(), so adding or dropping one here shifts the rng prefix
// and every existing seed with it. fitFlakes() does all the resizing, off fxRng.
for (let i = 0; i < 70; i++) flakes.push(makeFlake(rng));

// Keep snow density constant per world area, not per screen. Top-ups draw from
// a separate seeded stream so they never perturb the main rng's worldgen prefix.
// Called every frame from updateFx as well as from relayout(), because the ZOOM
// moves the target as surely as a resize does; both loops are no-ops when the
// count already matches, which is every frame but the ones a zoom is easing
// through.
const fxRng = mulberry32((SEED ^ 0x9e3779b9) >>> 0);
function fitFlakes() {
  const target = Math.max(FLAKE_MIN, Math.min(FLAKE_MAX,
    Math.round(FLAKE_BASE * (WV_W * WV_H) / FLAKE_AREA)));
  while (flakes.length > target) flakes.pop();
  while (flakes.length < target) flakes.push(makeFlake(fxRng));
}

function updateFx(dt) {
  const now = performance.now() / 1000;
  // the wind steps here, above everything that reads it: it is fx, so it runs
  // in every mode, and it runs on the SIM clock so DBG.step reproduces a gust
  state.windT += dt;
  stepWeather(dt);
  state.wind = windAmp();
  state.windDir = windVeer();
  // the sun's shafts are an EVENT, not a constant: this is what is left of the
  // one the eagle drop lit (rayLight, js/draw-world.js, owns the shape of it)
  if (state.rayT > 0) state.rayT = Math.max(0, state.rayT - dt);
  fitFlakes(); // the zoom moves the flake count, so this cannot wait for a resize
  for (const f of flakes) {
    if (f.rest > 0) {
      f.rest -= dt;
      if (f.rest <= 0) { // reborn: same slot, new spot in the field
        const n = makeFlake(fxRng);
        n.x += camX; n.y += camY;
        Object.assign(f, n);
      }
      continue;
    }
    const dy = f.spd * dt;
    f.y += dy; f.h -= dy;
    // the same field the pines read: the sway is the flake's own, the drift
    // is the wind's and runs the way the pines lean, so snow falls almost
    // straight down once the air stills or while the veer crosses the middle
    f.x += Math.sin(now * f.sway + f.ph) * (3 + 7 * state.wind) * dt + state.windDir * (1 + 13 * state.wind) * dt;
    if (f.h <= 0) f.rest = FLAKE_REST;
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += (p.grav || 0) * dt;
    p.x += (p.vx + (p.dx || 0)) * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(0.1, dt);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    if (f.t > (f.life || 0.9)) floaters.splice(i, 1);
  }
  for (let i = wordPops.length - 1; i >= 0; i--) { // a target's word (hitPTarget, js/sim/practice.js)
    wordPops[i].t += dt;
    if (wordPops[i].t > WORD_POP_T) wordPops.splice(i, 1);
  }
  updateWarps(dt); // the silhouettes a teleport request left behind (js/sim/tools.js)
  updateSwaps(dt); // ...and the risen icon a tool that traded itself up leaves
  updateSlashes(dt); // ...and the sword's sweep on the snow (js/sim/tools.js)
  if (bagFlash > 0) bagFlash -= dt; // the backpack's refusal red is chrome: wall time
  // ...and the positive half of the same idiom: the well an item just landed
  // in, and the cursor when a swap changed what the hand is holding (hudFx, ui.js)
  if (wellLit && (wellLit.t -= dt) <= 0) wellLit = null;
  if (dragLit > 0) dragLit -= dt;
  { // ...and so is the drawer's slide (bagEase chases bagOpenNow, ui.js)
    const want = bagOpenNow() ? 1 : 0, d = want - bagEase;
    bagEase += Math.sign(d) * Math.min(Math.abs(d), dt / BAG_SLIDE_T);
  }
  if (toolFlash > 0) toolFlash -= dt; // ... and the weapon well's, beside it
  if (foodFlash > 0) foodFlash -= dt; // ... and the meal button's
  if (abFlash > 0) abFlash -= dt;     // ... and a locked ability well's
  // the shelf's flash is chrome too: what the last press spent, fading (js/sim/tools.js)
  if (bitLit && (bitLit.t -= dt) <= 0) bitLit = null;
  for (let i = footprints.length - 1; i >= 0; i--) {
    const f = footprints[i];
    f.t += dt;
    if (f.t > (f.k === 1 ? SNOW_TRAIL_LIFE : 9)) footprints.splice(i, 1);
  }
  ageNotices(dt); // the news plates under the minimap age here too (js/ui/notices.js)
  updateStatLedger(dt); // ...and the stat sheet that flies into that lane when a number moves
}
