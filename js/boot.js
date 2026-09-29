// Softfall - a cozy winter survival game.
'use strict';
// The last file to load: the eagle drop that opens every match, the boot
// order, window.DBG and the requestAnimationFrame loop.

// ------------------------------------------------------------ eagle drop
// Nobody spawns in a camp: after PLAY's count each TEAM rides its own armoured
// eagle down the map's one DIAGONAL - RED flies it from the top-right corner
// toward its FACTORY in the BOTTOM-LEFT woods, BLUE the other way to the
// TOP-RIGHT, every match and every seed - each keeping EAGLE_LANE to its own
// right so the pass mid-route is a clean fly-by (mode 'drop'). The view zooms
// out to DROP_ZOOM, the flight path is dotted across the snow itself (M
// raises the world map for the wider read), and a rider jumps with
// Space/Enter/E/click - but only inside the JUMP WINDOW: the line's last
// DROP_LOCK_T seconds, pale on the flight bar and on the dotted line both
// (bots jump at their own hashed fraction of the window). A jumper free-falls
// for FALL_T onto the nearest open tile, which becomes its spawn tile (the bot
// brain's home); the human's landing snaps the view back to the player's own
// zoom and runs the HUD slide-in. A rider who never jumps is CARRIED HOME:
// past the line's end the bird banks to its side's factory and CIRCLES it
// (birdAt), a quarter of the way round it drops everyone still aboard - and
// its MERCHANT, the driver on its neck (the `merchant` banner, js/robots.js) -
// onto the factory's clearing (circleDrop, each fall steered in to its own
// spot on the pad), and then it flies on off the map and is gone. It never
// lands. A human set down that way lands into the drop brief, which tours
// both factories. A profile's very first flight is exactly that ride - its
// manual jump is refused - so a new player's first ground is its own factory.
// state.drop outlives mode 'drop' - and the whole match: each side's record
// (state.drop.eagles[team]) is its bird AND its FACTORY. The factory stands
// before anyone lands: at takeoff each side's site (findCrashPoint: the nest
// roadNest picked in its corner's woods, world.js) is cleared, paved and
// joined to the road by its SPUR (buildFactory), and when the bird reaches
// the line's end the factory goes live as its team's OBJECTIVE (e.state
// 'down', e.x/e.y its centre from then on), slowly patching itself between
// hits. Keep it standing: at zero hp it FALLS (hurtFactory / factoryFall),
// and its whole side falls with it.
                            // the ride's framing is DROP_ZOOM (canvas banner): half scale, twice the view
const EAGLE_FLIGHT_T = 10;  // s: every seed's line takes exactly this long (speed derives from length)
const DROP_LOCK_T = 4;      // s: the jump only unlocks over the line's last stretch
const DROP_EDGE_MARGIN = 3; // tiles of open ground a forced drop keeps clear of the treeline
const EAGLE_END = 2;        // tiles inside the corner's treeline each end of the line sits (diagEnd)
// the DROP BRIEF: a local player the bird carries home (the first flight
// always - its manual jump is refused, the ride is fully scripted - or a
// veteran who never jumped) lands into a camera tour: a beat on its own
// boots, then across the map to the RIVAL factory with the win condition,
// then home to finish on YOUR OWN with the lose condition - the last thing
// said is where you are. A real jump is the opt-out, so a veteran never sees
// it twice.
const BRIEF_WAIT = 1;       // s the camera stays on your landing before it leaves
const BRIEF_HOLD = 3;       // s it holds on the rival factory
const BRIEF_HOLD_OURS = 4;  // s it holds on your own to finish
const BRIEF_GO_MIN = 1;     // s a glide leg lasts at least, however close the target
const BRIEF_MAX_T = 24;     // s the whole tour may run before it force-ends (safety)
const BRIEF_PLATE_A = 0.82; // the dark plate under the headline (drawDropBrief): the factory stands in pines edge to edge
// the SPUR from the factory's clearing back to the road - aimed at its
// junction on the road's centreline (e.mouth: roadNest, world.js), run until
// it is inside the road, and PAVED into a track SPUR_HW wide (world.js: what
// is cleared is what is paved)
const LANE_R = SPUR_HW;     // tiles either side of the centreline it clears - the paved track's own half-width
const LANE_MAX = 60;        // tiles the spur may run at most (the nest is ROAD_NEST_OFF off the road: this is a safety)
// the WIND TRAIL: the air the bird tears in level flight - ONE continuous
// ribbon off each wingtip, laid along the flown line where the tip actually
// was and fading out toward its tail (drawEagleTrail - pure reads of the
// flight clock, no particles)
const TRAIL_T = 1.1;        // s of flight a ribbon reaches back
const TRAIL_STEP = 6;       // px between the ribbon's samples along the line
const TRAIL_RIM = 'rgba(40,60,100,0.6)'; // the dark line under the ribbon: white air over white snow needs a rim, like the text does
const MERCH_SEAT = [8, 0];  // where the merchant sits in flight: on the neck, ahead of the back seat (EAGLE_SEATS' frame)
const FALL_T = 1.3;         // seconds of free fall
const DRIFT_SPD = 130;      // px/s a faller steers sideways with WASD (~10 tiles over the fall)
const DROP_ALT = 56;        // screen px between the bird / a faller and its shadow
const EAGLE_SCALE = 3;      // the bird is huge and high above the ground: drawn at 3x in flight
// the riders are drawn as much bigger as the bird itself is for being nearer
// the camera (3/2 of a body's world size), so a body never changes size
// against the feathers under it - riderScale(e)
const RIDER_SCALE = 1.5;
const EAGLE_LANE = 2.5 * TILE; // each bird keeps this far to its own right of the shared line
// past the line's end: the bank to the factory, the CIRCLE round it, and the
// way out (birdAt). One speed the whole way, a little under the line's.
const CIRCLE_R = 7 * TILE;  // px: the circle's radius round the factory's centre
const CIRCLE_SPD = 0.8;     // of the line's speed
const CIRCLE_MIN = 1.2 * Math.PI; // radians the bird goes round at least before it heads out
const CIRCLE_DROP = 0.5 * Math.PI; // radians round where the crew still aboard is set down
const CIRCLE_OUT = 12 * TILE; // px past the world's edge where the bird is gone
// The FACTORY, the objective each side defends: its hp pool, sized as a
// siege now that bots go for it (the ai's objective rung): a lone warrior's
// E swings (three a second, so FACTORY_WORK_DMG is a hundred of them) take a
// minute or more, a pair half that, and an arrow only ever chips
// FACTORY_ARROW_DMG whatever the draw, so archers standing off it take
// minutes - long enough either way for the side to answer the hit (the two
// objectives, ai.js). The numbers are the old roosting eagle's.
const FACTORY_HP = 2000;
const FACTORY_BAR_W = 63;   // px: the factory's hp bar...
const FACTORY_BAR_H = 5;    // ...its height...
const FACTORY_BAR_SEGS = 8; // ...and its blocks: (FACTORY_BAR_W + 1) must divide by this
const FACTORY_WORK_DMG = 20;  // what one rival E swing chips off it
const FACTORY_ARROW_DMG = 12; // what one rival arrow chips, whatever it would do to a body
// its footprint in tiles round its centre tile - the hitbox arrows AND
// walkers test, the building's own walls (the bake's 80 x 34 px hall)
const FACTORY_TX = 2, FACTORY_TY = 1;
// ...and the one thing in the game that shouts from off screen: seconds
// between two "YOUR FACTORY IS UNDER ATTACK" alarms (SFX.alarm,
// hurtFactory). A siege is a hundred blows and one piece of news, and the
// news is worth hearing again only about as often as a side can answer it.
const FACTORY_WARN_GAP = 9;
const CRASH_DEPTH = 14;     // tiles inside the treeline (forestDepth) the factory sits at least - never on the edge, and a proper lane of pines past the stump ring
const MIN_CRASH_TREES = 40; // of the 49 tiles in the site's 7x7 that must still hold a pine (the border is solid, so fewer means an edge or a bay)
const FACTORY_REPAIR_DELAY = 6;     // s unhit before the factory starts patching itself...
const FACTORY_REPAIR_RATE = 8;      // ...recovering this much hp per second
const COLLAPSE_T = 1.6;     // s the fall takes: the building shakes, sinks and is rubble
const EAGLE_CINE_T = 3.2;   // s the camera holds the fall before the end screens queue
const BOOM_R = 3.6;         // tiles of the site cleared outright - and paved: the factory stands on packed earth, one ground with its spur and the road (the pad, addPad)
const BOOM_STUMP_R = 4.8;   // ...the MIDDLE ring beyond cut to stumps: build sites round the factory...
const BOOM_STUMP_R2 = 6.0;  // ...and the OUTER ring beyond that - two layers, so a side can stand guns inside a wall
const BOOM_LIFE = 0.9;      // seconds the fall's shockwave rings run
// where the five riders sit, in the bird's own frame (x along the heading,
// y across the wings, unscaled sprite px): one on its back, two on the inner
// wings, two out on the primaries. Seat 0 is the roster's first player per team
// - the human, on their own bird.
const EAGLE_SEATS = [[-2, 0], [2, -11], [2, 11], [-7, -19], [-7, 19]];

// The line is FIXED: the map's one diagonal, corner to corner - there is no
// randomness in where a team's factory stands. Each end sits EAGLE_END tiles inside the
// corner's treeline as the seed grew it on that diagonal - the LAST wooded
// tile out from the corner, so a bay in the border short of it is still
// forest on the corner side - so the window's end (lastOpenU) is always open
// snow. `mouth` is the
// treeline itself on the diagonal - the first open tile past that last pine,
// the road's GATE (roadSpan, world.js, the same rule). Pure reads of
// borderDepth (world.js) - no rng(), no hash2 -
// so a seed always flies the same line. fromLeft: the bottom-left corner,
// else top-right.
function diagEnd(fromLeft) {
  const at = (k) => fromLeft ? [k, WORLD - 1 - k] : [WORLD - 1 - k, k];
  const wooded = (k) => { const [x, y] = at(k); return k < borderDepth(x, y); }; // genWorld's own tree rule
  let last = 0;
  for (let k = 0; k < WORLD / 2 - 3; k++) if (wooded(k)) last = k;
  const [tx, ty] = at(Math.max(6, last + 1 - EAGLE_END));
  const [mx, my] = at(last + 1);
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, mouth: { x: (mx + 0.5) * TILE, y: (my + 0.5) * TILE } };
}
// team 0 (RED) flies x0 -> x1: from the top-right end down to the bottom-left
function makeEagleRoute() {
  const a = diagEnd(false), b = diagEnd(true);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y, mouth0: a.mouth, mouth1: b.mouth, len, dur: EAGLE_FLIGHT_T, heading: Math.atan2(b.y - a.y, b.x - a.x) };
}
// how far inside the treeline a tile sits, in tiles: positive is woods
// (genWorld's own rule, `edge < borderDepth`), negative the open field
function forestDepth(tx, ty) {
  return borderDepth(tx, ty) - Math.min(tx, ty, WORLD - 1 - tx, WORLD - 1 - ty);
}

// the last point on a bird's line still over open ground: forced drops land
// here, never in the trees. borderDepth (world.js) is the forest boundary
// itself, so the answer moves with the seed's actual treeline, pure reads only.
function lastOpenU(e) {
  const n = Math.ceil(e.len / TILE);
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    const tx = Math.floor((e.x0 + (e.x1 - e.x0) * u) / TILE);
    const ty = Math.floor((e.y0 + (e.y1 - e.y0) * u) / TILE);
    if (!inWorld(tx, ty)) continue;
    const edge = Math.min(tx, ty, WORLD - 1 - tx, WORLD - 1 - ty);
    if (edge > borderDepth(tx, ty) + DROP_EDGE_MARGIN) return u;
  }
  return 0.5;
}

// two birds on the one line, flying it opposite ways: team 0 start-to-end,
// team 1 end-to-start, each shifted EAGLE_LANE along its own right-hand
// perpendicular so they pass beside each other instead of head-on. Each
// record is its side's factory too, built at takeoff (buildFactory).
function makeEagles() {
  const r = makeEagleRoute();
  return [0, 1].map((team) => {
    const h = team === 0 ? r.heading : r.heading + Math.PI;
    const rx = -Math.sin(h) * EAGLE_LANE, ry = Math.cos(h) * EAGLE_LANE; // the bird's own right
    const sx = (team === 0 ? r.x0 : r.x1) + rx, sy = (team === 0 ? r.y0 : r.y1) + ry;
    const ex = (team === 0 ? r.x1 : r.x0) + rx, ey = (team === 0 ? r.y1 : r.y0) + ry;
    const e = {
      team, heading: h, len: r.len, dur: r.dur, spd: r.len / r.dur,
      x0: sx, y0: sy, x1: ex, y1: ey, x: sx, y: sy,
      jumpOpen: 0, jumpEnd: 1,      // the jump window, as fractions of the line
      t: 0, prog: 0, flap: team * 0.4,
      state: 'fly',                 // fly (the bird on its line) -> down (the factory is live: the objective) -> fall -> gone (rubble)
      airT: 0, circ: null,          // the bird past the line's end: seconds since, and the path it flies home and out (beginCircle, birdAt)
      dropped: false, away: false,  // ...the crew still aboard set down (circleDrop), and the bird gone off the map
      crash: null,                  // the factory's centre (findCrashPoint), set at takeoff
      hp: FACTORY_HP, maxHp: FACTORY_HP, flash: 0, boomT: 0,
      hitT: 99, fallT: 0,           // the repair clock, and the collapse's
      mouth: { x: roadNest(team).x, y: roadNest(team).y }, // its spur's JUNCTION on the road (roadNest, world.js): where the spur aims, and the way in for every walker
      laneDir: null,                // the spur's unit direction (buildFactory) - the gate, the merchant's post and the respawn read it
      spur: null, pad: null,        // its road registry entries (addSpur, addPad, world.js)
      merchant: null,               // the driver once it is down (robots.js)
    };
    e.jumpEnd = lastOpenU(e);
    e.jumpOpen = Math.min((e.dur - DROP_LOCK_T) / e.dur, e.jumpEnd - 0.05);
    return e;
  });
}

// how big a body on the bird draws: the bird's own perspective (RIDER_SCALE)
function riderScale() { return RIDER_SCALE; }
// which way a rider on the bird faces: the heading's dominant axis, so a
// crew flying down-left shows its profiles and one flying up its backs -
// bodies ride a bird the way it points, they are not stuck on facing you
function riderDir(h) {
  const c = Math.cos(h), s = Math.sin(h);
  return Math.abs(c) >= Math.abs(s) ? (c > 0 ? 'right' : 'left') : (s > 0 ? 'down' : 'up');
}
// A body SEATED on the bird, drawn at (x, y) = the seat point on the feathers:
// the bottom three rows (the boots) are tucked into the plumage - a rider
// sits, it does not stand on a wing - and the body rises from that point, so
// the hem meets the bird's back and nothing floats. `set` is a pose set
// (classSet(p) or SPRITES.merchant[...]), any height.
function drawSeated(set, dir, x, y, sc, frame) {
  const spr = set[dir][frame || 0];
  const w = spr.width, keep = spr.height - 3;
  ctx.drawImage(spr, 0, 0, w, keep, Math.round(x - w * sc / 2), Math.round(y - (keep - 2) * sc), Math.round(w * sc), Math.round(keep * sc));
}
// ...and the name over a seated body, in its side's paint, two clear rows
// over the head drawSeated just drew - a tag (drawNameTag), so a wing of
// riders sorts its names out instead of stamping them on each other
function seatedName(set, dir, x, y, sc, name, team) {
  const top = Math.round(y - (set[dir][0].height - 5) * sc);
  drawNameTag(name, centreTextX(x, name), top - 8, TEAMS[skin(team)].mark);
}
// where the bird is and which way it points: on its line (e.x/e.y, the
// heading) while its side still flies it, then along its way home and out
// (birdAt) - at `T` seconds past the line's end, the sim's own e.airT when
// omitted (a draw passes its smoothed clock, airShownT)
function birdPose(e, T) {
  if (e.state === 'fly' || !e.circ) return { x: e.x, y: e.y, h: e.heading, a: 0 };
  return birdAt(e, T === undefined ? e.airT : T);
}
// a seat's world position on a bird right now: the seat offset rotated by the
// heading, off the bird's centre, at the bird's scale
function seatPos(e, si) {
  const s = EAGLE_SEATS[si % EAGLE_SEATS.length], b = birdPose(e);
  const dx = s[0] * EAGLE_SCALE, dy = s[1] * EAGLE_SCALE;
  const c = Math.cos(b.h), sn = Math.sin(b.h);
  return { x: b.x + dx * c - dy * sn, y: b.y + dx * sn + dy * c };
}

function beginDrop() {
  PROFILE.addDay(); // day 1 of the days-played stat: the clock starts with the eagle
  PROFILE.addMatch(); // ...and the character's matches: one per takeoff
  // a profile's first flight ever counts itself down and jumps for you -
  // reading the ride is a lot to ask of someone who has never seen it
  state.drop = { eagles: makeEagles(), firstFlight: !PROFILE.hasDropped() };
  for (const e of state.drop.eagles) buildFactory(e); // both factories stand before anyone lands
  const seats = [0, 0]; // next free wing seat per team, dealt in slot order - the first slot of each side sits at seat 0
  for (const p of players) {
    if (!p.active) continue;
    const e = state.drop.eagles[p.team];
    p.aboard = true; p.dropT = 0; p.dropAim = null;
    p.seat = seats[p.team]++;
    const sp = seatPos(e, p.seat);
    p.x = sp.x; p.y = sp.y;
    // bots spread across the jump window; a human is never force-dropped on
    // the line - unless they jump the bird carries them home (circleDrop)
    p.dropU = p.control === 'ai'
      ? e.jumpOpen + (e.jumpEnd - e.jumpOpen) * (0.08 + 0.84 * hash2(p.id * 31 + 5, 9))
      : 2;
  }
  state.mode = 'drop';
  state.menu.panel = null;
  state.menu.screen = 'menu';
  netHostRoom(); // the relay's list: this room is live now
  // the view grows around its centre (applyZoom keeps the point under the
  // screen centre put); ease in from the drift's framing. The eagle's framing
  // is snapped rather than eased: the ride opens on a cross-fade from the
  // menu, and a zoom sliding under that reads as a stumble.
  applyZoom(0, true);
  state.introFrom = { x: camX, y: camY };
  state.intro = INTRO_T; state.introLen = INTRO_T;
  SFX.dawnChime();
  SFX.music.play('eagle');
}

// off the bird: fall straight down from where it is right now. The door only
// opens over the line's last DROP_LOCK_T seconds - a manual jump before that
// is refused (force is the sim's own drops: the window's end, the circle).
function dropJump(p, force) {
  if (!p.aboard || !state.drop) return;
  const d = state.drop.eagles[p.team];
  if (!force && d.state === 'fly' && d.t < d.dur - DROP_LOCK_T) {
    sfxFor(p, 'deny');
    return;
  }
  // the first flight is fully scripted: the door stays shut to a manual leap
  // and the bird sets you down at home - the brief that follows is the lesson
  if (!force && p === player && state.drop.firstFlight) { sfxFor(p, 'deny'); return; }
  p.aboard = false;
  p.dropT = FALL_T; p.dropAlt = DROP_ALT; p.dropSc = riderScale(); // the fall shrinks from the seat's size to 1x
  // the leap starts from the wing seat the rider was sitting on (p.x/p.y are
  // already there - updateDrop keeps every rider glued to its seat), so the
  // fall visibly begins at the wing; drawDropAir adds the hop off it
  if (p.control === 'ai' && d.state === 'fly') { // scatter bots off the line so they don't stack
    const off = (hash2(p.id * 7 + 1, 33) - 0.5) * 8 * TILE;
    p.x += -Math.sin(d.heading) * off;
    p.y += Math.cos(d.heading) * off;
  }
  sfxFor(p, 'dodge');
  if (p === player) {
    PROFILE.markDropped(); // the first-flight countdown never comes back after a real jump
    // a hard cut, not a crossfade: the ride's song is INTERRUPTED by the jump,
    // which then runs to its end and hands over to FOXGLOVE DROP (TRACKS.next)
    SFX.music.play('jump', { out: 0.1, in: 0.05 });
  }
}

// touchdown: the nearest open tile to the fall point becomes the player's
// position and its spawn tile. Only the local landing changes the mode, and
// a local player the bird carried home (p.dropAim) lands into the brief.
function landPlayer(p) {
  const ftx = Math.floor(p.x / TILE), fty = Math.floor(p.y / TILE);
  let best = null;
  for (let r = 0; r <= 80 && !best; r++) {
    let bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = ftx + dx, ty = fty + dy;
      if (!inWorld(tx, ty) || objAt(tx, ty) || waterAt(tx, ty)) continue;
      const dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = { tx, ty }; }
    }
  }
  if (!best) best = { tx: WORLD >> 1, ty: WORLD >> 1 };
  p.spawn = best;
  p.x = (best.tx + 0.5) * TILE; p.y = (best.ty + 0.5) * TILE;
  p.dropT = 0; p.vx = p.vy = 0;
  p.invuln = 2; // a beat of grace while the snow settles
  // the shafts that lit the ride hang on a few seconds past the boots landing,
  // then go: the light of the drop belongs to the drop (RAY_AFTER, draw-world.js)
  if (p === player) state.rayT = RAY_AFTER;
  burst(p.x, p.y - 2, '#f4f7ff', 16, 70, 0.5, true);
  if (p === player) {
    handOver(p);
    state.shake = 5;
    SFX.land();
    if (p.dropAim) state.dropBrief = { ph: 'wait', t: 0, total: 0 }; // carried home: the tour of both factories
  } else {
    addFloater(p.x, p.y - 20, p.name + ' LANDED', TEAMS[skin(p.team)].mark);
  }
  p.dropAim = null;
}

// mode 'drop' -> 'play' for the local player, on its boots after a fall
function handOver(p) {
  state.mode = 'play';
  state.mapOpen = false;            // a chart left up mid-flight comes down for the landing
  applyZoom(0, true);               // back to the player's own zoom, centred on the landing
  camX = Math.max(0, Math.min(WORLD * TILE - WV_W, p.x - WV_W / 2));
  camY = Math.max(0, Math.min(WORLD * TILE - WV_H, p.y - WV_H / 2));
  state.introFrom = { x: camX, y: camY };
  state.intro = HUD_IN_T; state.introLen = HUD_IN_T; // the HUD slides in, the camera settles
  state.menu.screenT = 0;
}

function updateDrop(dt) {
  // the fall ceremony: hold on the collapse, then let the screens come
  const cine = state.eagleCine;
  if (cine) {
    cine.t += dt;
    if (cine.t >= EAGLE_CINE_T) {
      state.eagleCine = null; // cleared first, so the resolve's endMatch path runs clean
      factoryFallResolve(state.drop.eagles[cine.team], cine.srcId >= 0 ? players[cine.srcId] : null);
    }
  }
  for (const e of state.drop.eagles) updateEagle(e, dt);
  // the drop brief: the factory tour a carried-home landing opened on. The
  // match runs on underneath - only the local camera and controls are spoken
  // for (sampleHumanInput zeroes them, the camera branch in js/sim.js follows
  // dropBriefTarget) - and the landing grace holds until the hand-back, so
  // nobody dies watching the lesson. Each glide leg ends when the camera has
  // arrived AND the factory it is looking at is live.
  const brief = state.dropBrief;
  if (brief) {
    if (state.mode !== 'play' || state.eagleCine) endBrief(); // the ceremony (or a death) outranks the lesson
    else {
      brief.t += dt; brief.total += dt;
      player.invuln = Math.max(player.invuln, 0.4);
      const tgt = dropBriefTarget();
      const near = Math.hypot(tgt.x - WV_W / 2 - camX, tgt.y - WV_H / 2 - camY) < 24;
      const live = (t) => state.drop.eagles[t].state !== 'fly';
      const step = (ph) => { brief.ph = ph; brief.t = 0; };
      if (brief.total > BRIEF_MAX_T) endBrief();
      else if (brief.ph === 'wait') { if (brief.t > BRIEF_WAIT) step('theirs-go'); }
      else if (brief.ph === 'theirs-go') { if (near && brief.t > BRIEF_GO_MIN && live(1 - player.team)) step('theirs'); }
      else if (brief.ph === 'theirs') { if (brief.t > BRIEF_HOLD) step('ours-go'); }
      else if (brief.ph === 'ours-go') { if (near && brief.t > BRIEF_GO_MIN && live(player.team)) step('ours'); }
      else if (brief.t > BRIEF_HOLD_OURS) endBrief(); // 'ours': the finish, on the factory you landed at
    }
  }
  for (const p of players) {
    if (!p.active) continue;
    if (p.aboard) {
      const e = state.drop.eagles[p.team];
      const sp = seatPos(e, p.seat);
      p.x = sp.x; p.y = sp.y;
      if (e.prog >= p.dropU) dropJump(p, true); // the window's end drops a bot still riding
      p.input.dodge = false; // a seated roll is spent here, never carried into the landing
    } else if (p.dropT > 0) {
      if (p.dropAim) {
        // set down by the circle: the fall is steered in to its spot on the pad
        const k = Math.min(1, dt / p.dropT);
        p.x += (p.dropAim.x - p.x) * k; p.y += (p.dropAim.y - p.y) * k;
      } else {
        // steer the fall: the input axis drifts the landing point
        const dm = Math.hypot(p.input.mx, p.input.my);
        if (dm > 0) {
          p.x = Math.max(TILE, Math.min(WORLD * TILE - TILE, p.x + p.input.mx / dm * DRIFT_SPD * dt));
          p.y = Math.max(TILE, Math.min(WORLD * TILE - TILE, p.y + p.input.my / dm * DRIFT_SPD * dt));
        }
      }
      p.dropT -= dt;
      if (p.dropT <= 0) landPlayer(p);
    }
  }
}

// one side's whole match: the bird's flight down its line, its way home and
// out past the line's end, and the factory it leaves standing - live from the
// line's end, patching itself between hits, then its fall. state.drop never
// goes null - the factories ARE the match.
function updateEagle(e, dt) {
  e.flap += dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.boomT > 0) e.boomT -= dt;
  if (e.state === 'fly') {
    e.t += dt;
    const dist = Math.min(e.spd * e.t, e.len);
    e.prog = Math.min(1, dist / e.len);
    e.x = e.x0 + Math.cos(e.heading) * dist;
    e.y = e.y0 + Math.sin(e.heading) * dist;
    if (e.prog >= 1) beginCircle(e);
    return;
  }
  if (!e.away && e.circ) {
    e.airT += dt;
    const b = birdAt(e, e.airT);
    if (!e.dropped && b.a >= CIRCLE_DROP) circleDrop(e);
    const W = WORLD * TILE;
    if (b.x < -CIRCLE_OUT || b.y < -CIRCLE_OUT || b.x > W + CIRCLE_OUT || b.y > W + CIRCLE_OUT) e.away = true;
  }
  if (e.state === 'down') {
    // unhit for FACTORY_REPAIR_DELAY, the factory patches itself - the bar visibly
    // refilling is the whole announcement, so chip damage must be pressed
    // home or it evaporates
    e.hitT += dt;
    if (e.hitT > FACTORY_REPAIR_DELAY && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + FACTORY_REPAIR_RATE * dt);
      if (rng() < dt * 3) particles.push({
        x: e.x + rand(-6, 6), y: e.y - 46,
        vx: rand(-3, 3), vy: -rand(8, 14),
        life: 0.8, maxLife: 0.8, color: '#e2e7ef', size: 2, grav: -4, alpha: 0.6,
      });
    }
  } else if (e.state === 'fall' || e.state === 'gone') {
    e.fallT += dt;
    if (e.state === 'fall' && e.fallT >= COLLAPSE_T) e.state = 'gone';
    // dust and sparks through the collapse, then a thin smoke off the rubble
    if (rng() < dt * (e.state === 'fall' ? 40 : 2)) particles.push({
      x: e.x + rand(-36, 36), y: e.y + rand(-10, 18),
      vx: rand(-10, 10), vy: -rand(10, 24),
      life: 1.1, maxLife: 1.1, color: rng() < 0.2 ? TEAMS[skin(e.team)].glow : '#8a93a8', size: 2, grav: -6, alpha: 0.55,
    });
  }
}

// The line's end: the side's factory goes LIVE - the objective from this
// step on, e.x/e.y its centre - and the bird's way home is planned. It banks
// off the line onto a CIRCLE of CIRCLE_R round the factory, joining it on a
// tangent (of the two, the one that turns it least), goes at least
// CIRCLE_MIN round and on until its heading points out of the map (away from
// the world's centre), then flies straight on over the treeline and is gone.
// Plain numbers (e.circ) flown by birdAt from the one clock e.airT, so the
// same path draws on every screen.
function beginCircle(e) {
  const C = e.crash, x0 = e.x, y0 = e.y, R = CIRCLE_R, T2 = Math.PI * 2;
  const wrap = (a) => { while (a > Math.PI) a -= T2; while (a < -Math.PI) a += T2; return a; };
  const D = Math.hypot(x0 - C.x, y0 - C.y), phi = Math.atan2(y0 - C.y, x0 - C.x);
  // the two tangent points seen from the line's end (the near point itself
  // when it is already on the circle), each with the way round it leads into
  let best = null;
  for (const k of [-1, 1]) {
    const th = phi + k * Math.acos(Math.min(1, R / Math.max(D, R)));
    const tx = C.x + Math.cos(th) * R, ty = C.y + Math.sin(th) * R;
    const s = k; // the way round the tangent at th leads into
    const h = th + s * Math.PI / 2;
    const cost = Math.abs(wrap(h - e.heading)) + (D > R ? Math.abs(wrap(Math.atan2(ty - y0, tx - x0) - e.heading)) : 0);
    if (!best || cost < best.cost) best = { th, tx, ty, s, cost };
  }
  const { th: thIn, tx: qx, ty: qy, s } = best;
  const out = Math.atan2(C.y - WORLD * TILE / 2, C.x - WORLD * TILE / 2);
  let sweep = ((s * (out - s * Math.PI / 2 - thIn)) % T2 + T2) % T2;
  while (sweep < CIRCLE_MIN) sweep += T2;
  e.circ = { x0, y0, h0: e.heading, s, thIn, sweep, qx, qy, L: Math.hypot(qx - x0, qy - y0) * 0.4, bl: 1 };
  let bl = 0, px = x0, py = y0;
  for (let i = 1; i <= 24; i++) { const b = circleBankAt(e.circ, i / 24); bl += Math.hypot(b.x - px, b.y - py); px = b.x; py = b.y; }
  e.circ.bl = Math.max(1, bl);
  e.airT = 0;
  e.state = 'down';
  e.hitT = 99;
  e.x = C.x; e.y = C.y;
}
// the bank off the line onto the circle: one cubic from the line's end
// (leaving along the line's heading) to the circle's near point (arriving on
// its tangent), `u` 0..1 along it
function circleBankAt(c, u) {
  const th = c.thIn + c.s * Math.PI / 2;
  const x1 = c.x0 + Math.cos(c.h0) * c.L, y1 = c.y0 + Math.sin(c.h0) * c.L;
  const x2 = c.qx - Math.cos(th) * c.L, y2 = c.qy - Math.sin(th) * c.L;
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, k = 3 * v * u * u, d = u * u * u;
  const dx = 3 * v * v * (x1 - c.x0) + 6 * v * u * (x2 - x1) + 3 * u * u * (c.qx - x2);
  const dy = 3 * v * v * (y1 - c.y0) + 6 * v * u * (y2 - y1) + 3 * u * u * (c.qy - y2);
  return { x: a * c.x0 + b * x1 + k * x2 + d * c.qx, y: a * c.y0 + b * y1 + k * y2 + d * c.qy, h: Math.atan2(dy, dx) };
}
// the bird `T` seconds past the line's end: along the bank, round the circle
// (`a`, the angle it has gone round), then straight out along its tangent
function birdAt(e, T) {
  const c = e.circ, C = e.crash;
  let d = Math.max(0, T) * e.spd * CIRCLE_SPD;
  if (d < c.bl) { const b = circleBankAt(c, d / c.bl); b.a = 0; return b; }
  d -= c.bl;
  const arc = c.sweep * CIRCLE_R, a = Math.min(d, arc) / CIRCLE_R;
  const th = c.thIn + c.s * a, h = th + c.s * Math.PI / 2;
  let x = C.x + Math.cos(th) * CIRCLE_R, y = C.y + Math.sin(th) * CIRCLE_R;
  if (d > arc) { x += Math.cos(h) * (d - arc); y += Math.sin(h) * (d - arc); }
  return { x, y, h, a };
}
// CIRCLE_DROP round: everyone still aboard is set down on the factory's
// clearing - each fall steered in to its own spot on the spur side of the
// pad (p.dropAim, fanned across it by seat so nobody lands on anybody) - and
// the merchant climbs down with them (spawnMerchant, robots.js)
function circleDrop(e) {
  e.dropped = true;
  const d = e.laneDir, out = (FACTORY_TY + 2) * TILE;
  for (const p of players) {
    if (!p.active || !p.aboard || p.team !== e.team) continue;
    const k = (p.seat % EAGLE_SEATS.length) - 2; // -2 .. 2 across the pad
    dropJump(p, true);
    p.dropAim = { x: e.x + d.x * out - d.y * k * TILE, y: e.y + d.y * out + d.x * k * TILE };
  }
  spawnMerchant(e);
}

// the factory stands on the NEST roadNest (world.js) picked for this side -
// ROAD_NEST_OFF tiles off the road to the bird's own right, at the first
// junction inward from the gate where the spot is DEEP (roadNestDeep:
// CRASH_DEPTH inside the treeline by the border's own measure, forestDepth,
// and as far inside the corner's roost disc) AND whose 7x7 still holds
// MIN_CRASH_TREES, so the factory always sits a proper way into the woods
// with trees all round it, never kissing the tree edge or a bay in it. Pure
// reads - no rng(), no hash2 - so the same seed puts the same factory in the
// same trees (landmarks keep clear of it at worldgen, world.js). Should
// something have changed the spot since worldgen (a felled patch, a rock),
// the nearest tile round it that still qualifies takes it, the deepest,
// densest seen standing in; its clearing always stays off the road.
function findCrashPoint(e) {
  const n = roadNest(e.team);
  const ix = Math.round(n.nx), iy = Math.round(n.ny);
  const treesAt = (tx, ty) => {
    let t = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const o = objAt(tx + dx, ty + dy);
      if (o && (o.type === 'tree' || o.type === 'deadTree')) t++;
    }
    return t;
  };
  let best = null, bestScore = -Infinity;
  for (let r = 0; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const tx = ix + dx, ty = iy + dy;
    if (tx < 4 || ty < 4 || tx >= WORLD - 4 || ty >= WORLD - 4) continue;
    if (roadMainDist(tx, ty) < BOOM_STUMP_R + 1) continue;
    const trees = treesAt(tx, ty);
    if (roadNestDeep(tx, ty) && trees >= MIN_CRASH_TREES) return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
    const score = Math.min(forestDepth(tx, ty), CRASH_DEPTH) * 4 + trees - r * 2;
    if (score > bestScore) { bestScore = score; best = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }; }
  }
  return best || { x: (ix + 0.5) * TILE, y: (iy + 0.5) * TILE };
}

// the site, at takeoff: the near trees cleared outright, the ring beyond cut
// to stumps, the disc paved as the pad, the SPUR cleared and paved straight
// back to the road (clearSpur), and the factory's walls stood on its
// footprint - before anyone lands. Quiet on purpose (no dust, no sound): the
// factory has always been there. Pays no gold: a clearing full of free fells
// would warp the economy at minute one.
function buildFactory(e) {
  e.crash = findCrashPoint(e);
  const cx = e.crash.x, cy = e.crash.y;
  const ctx0 = Math.floor(cx / TILE), cty0 = Math.floor(cy / TILE);
  const R = Math.ceil(BOOM_STUMP_R2);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const tx = ctx0 + dx, ty = cty0 + dy;
    if (!inWorld(tx, ty) || Math.hypot(dx, dy) > BOOM_STUMP_R2) continue;
    const o = objAt(tx, ty);
    if (!o) continue;
    const so = structOf(o); // a rock's east tile is the rock
    if (so.type === 'rock' || so.type === 'bush') { fellScenery(tx, ty); continue; } // out to the outer ring: a rock in the wall's band would leave a hole in it
    if (o.type !== 'tree' && o.type !== 'deadTree') continue;
    objects[idx(tx, ty)] = Math.hypot(dx, dy) <= BOOM_R ? null : { type: 'stump', tx, ty, flash: 0, shake: 0 };
  }
  // the building's walls: `factory` objects on its footprint - solid to
  // walkers, a work target for rival E swings (their OBJECTS entry), and
  // drawn by drawFactory, never the object pass
  for (let dy = -FACTORY_TY; dy <= FACTORY_TY; dy++) for (let dx = -FACTORY_TX; dx <= FACTORY_TX; dx++) {
    const tx = ctx0 + dx, ty = cty0 + dy;
    if (inWorld(tx, ty) && !objAt(tx, ty) && !waterAt(tx, ty)) placeObj(tx, ty, 'factory', { team: e.team });
  }
  // the spur back to the road - aimed from the site at its junction on the
  // centreline (e.mouth), back up the line if the junction is somehow under
  // it - registered with the road (addSpur, world.js), and the pad: the
  // cleared disc is packed earth, one ground from the road down the spur to
  // the factory, its ground repainted out to the verge
  const mx = e.mouth.x - cx, my = e.mouth.y - cy, ml = Math.hypot(mx, my);
  e.laneDir = ml > TILE ? { x: mx / ml, y: my / ml } : { x: -Math.cos(e.heading), y: -Math.sin(e.heading) };
  e.spur = addSpur(e.team, e.mouth.x / TILE - 0.5, e.mouth.y / TILE - 0.5, cx / TILE - 0.5, cy / TILE - 0.5, BOOM_R);
  e.pad = addPad(e.team, cx / TILE - 0.5, cy / TILE - 0.5, BOOM_R);
  const g = groundCv.getContext('2d'), PR = Math.ceil(BOOM_R) + 3;
  g.imageSmoothingEnabled = false;
  for (let dy = -PR; dy <= PR; dy++) for (let dx = -PR; dx <= PR; dx++) {
    const tx = ctx0 + dx, ty = cty0 + dy;
    if (!inWorld(tx, ty)) continue;
    if (ground[idx(tx, ty)] === 0 && roadDist(tx, ty) < 0) ground[idx(tx, ty)] = 3;
    paintGroundTile(g, tx, ty);
  }
  clearSpur(e);
}

// The SPUR: the factory's one road out, and a road it is. From the site
// along e.laneDir - straight at its junction on the road's centreline
// (e.mouth: roadNest, world.js), so every factory is one straight sightline
// off the road - to the road's edge, every pine and rock within LANE_R of the
// centreline is cleared, and the band is PAVED: every snow tile from the
// clearing's rim (BOOM_R) to the road turns to packed earth (ground 3, a
// stump lifted off it) and the ground repaints round it (paintGroundTile,
// draw-world.js: the verge is ROAD_SHOULDER wide, so the repaint reaches
// three tiles out). The spur is done when it is inside the road
// (roadMainDist) - LANE_MAX is only a safety. Pure reads - the spur a seed
// gets is the spur it always gets.
function laneFells(o) { o = structOf(o); return !!o && (o.type === 'tree' || o.type === 'deadTree' || o.type === 'rock'); } // a rock's east tile is the rock
function clearSpur(e) {
  const hx = e.laneDir.x, hy = e.laneDir.y, ox = (e.crash.x - 8) / TILE, oy = (e.crash.y - 8) / TILE; // the site, tile-index space
  const seen = new Set(), touched = new Set();
  const reach = Math.ceil(LANE_R);
  for (let s = 0; s < LANE_MAX; s += 1 / 3) {
    const fx = ox + hx * s, fy = oy + hy * s; // like pkPlanCarve
    const cx = Math.round(fx), cy = Math.round(fy);
    if (!inWorld(cx, cy)) break;
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const tx = cx + dx, ty = cy + dy;
      if (!inWorld(tx, ty) || Math.hypot(tx - fx, ty - fy) > LANE_R) continue;
      const i = idx(tx, ty);
      if (seen.has(i)) continue;
      seen.add(i);
      if (laneFells(objects[i])) fellScenery(tx, ty);
      const along = (tx - ox) * hx + (ty - oy) * hy; // this tile's own distance out from the site
      if (along < BOOM_R || ground[i] !== 0 || roadMainDist(tx, ty) < 0) continue;
      ground[i] = 3;
      if (objects[i] && objects[i].type === 'stump') objects[i] = null;
      for (let ky = -3; ky <= 3; ky++) for (let kx = -3; kx <= 3; kx++) if (inWorld(tx + kx, ty + ky)) touched.add(idx(tx + kx, ty + ky));
    }
    if (roadMainDist(cx, cy) < -LANE_R) break; // inside the road: out
  }
  const g = groundCv.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (const i of touched) paintGroundTile(g, i % WORLD, (i / WORLD) | 0);
  if (e.spur) e.spur.paved = e.spur.len;
}

// the fall's language (k scales it): brick dust and snow thrown high, the
// team's colours in it, and a low dust ring rolling out along the ground
// under the shockwave rings
function factoryBoomFx(e, k) {
  e.boomT = BOOM_LIFE;
  burst(e.x, e.y - 10, '#f4f7ff', Math.round(20 * k), 110 * k, 0.7, true);
  burst(e.x, e.y - 10, '#94544a', Math.round(16 * k), 90 * k, 0.7);
  burst(e.x, e.y - 20, TEAMS[skin(e.team)].mark, Math.round(10 * k), 80 * k, 0.6);
  const n = Math.round(26 * k);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    particles.push({
      x: e.x + Math.cos(a) * 20, y: e.y + 10 + Math.sin(a) * 8,
      vx: Math.cos(a) * (70 + rng() * 50) * k, vy: Math.sin(a) * (44 + rng() * 30) * k,
      life: 0.7, maxLife: 0.7, color: '#b6bccb', size: 2, grav: 60,
    });
  }
}

// a rival's arrow or E swing into the live factory. hx/hy is where the hit
// landed (an arrow into a corner puffs at the corner, not the centre);
// callers with no better point omit them.
function hurtFactory(e, dmg, src, hx, hy) {
  if (e.state !== 'down' || state.eagleCine) return; // the ceremony has the match: no second fall under it
  // the objective damage the post-game lobby prints (js/ui/lobby.js), capped
  // at the hp there actually was to take
  if (src instanceof Player) src.dmgBird += Math.min(dmg, Math.max(0, e.hp));
  e.hp -= dmg;
  e.hitT = 0; // struck again: the repair clock starts over
  e.flash = 0.12;
  const px = hx === undefined ? e.x : hx, py = (hy === undefined ? e.y : hy) - 8;
  burst(px, py, '#b6bccb', 5, 45, 0.5, true);
  burst(px, py, TEAMS[skin(e.team)].mark, 3, 40, 0.4);
  // WITHIN EARSHOT it is the blow landing on the walls. OUT OF EARSHOT, and
  // only for YOUR OWN factory, it is a warning instead: it is the one thing
  // you must defend that you cannot see from where you fight, and the
  // minimap only says so if you happen to be looking at it. One alarm per
  // FACTORY_WARN_GAP, never both cues at once - standing there, the blow IS
  // the news.
  sfxAt('hit', px, py);
  if (!nearPlayer(e.x, e.y) && player && e.team === player.team && !player.eliminated
      && state.elapsed - (e.warnT === undefined ? -99 : e.warnT) >= FACTORY_WARN_GAP) {
    e.warnT = state.elapsed;
    // ...and the news arrives where the other things you glance at mid-fight
    // do: a plate top-right under the minimap, on the market's own grammar
    // (the `notices` banner, js/ui/shop.js) - the hp it has left as a
    // number, and the falling tail. The cue turns your head and the plate
    // says what happened; the feed line goes with it, since the log is the
    // match's record.
    logEvent('YOUR FACTORY IS UNDER ATTACK', null, NOTE_KIND.roost);
    raiseNotice('roost', Math.round(Math.max(0, e.hp) / e.maxHp * 100) + '%', null);
    SFX.alarm();
  }
  if (e.hp <= 0) factoryFall(e, src);
}

// the factory's hp is gone: it FALLS. Its walls come down (the footprint
// opens up as rubble), dust and the side's colours go up - and the collapse
// starts the FALL CEREMONY (state.eagleCine): every camera glides to it (the
// camera banner in js/sim.js), the local controls go dead (input.js), and
// it plays for EAGLE_CINE_T before factoryFallResolve puts the side down and
// queues the victory or defeat screen. League-style: watch the nexus fall,
// then read the word.
function factoryFall(e, src) {
  e.state = 'fall';
  e.fallT = 0;
  e.hp = 0;
  const ctx0 = Math.floor(e.x / TILE), cty0 = Math.floor(e.y / TILE);
  for (let dy = -FACTORY_TY; dy <= FACTORY_TY; dy++) for (let dx = -FACTORY_TX; dx <= FACTORY_TX; dx++) {
    const tx = ctx0 + dx, ty = cty0 + dy;
    if (!inWorld(tx, ty)) continue;
    const o = objAt(tx, ty);
    if (o && o.type === 'factory' && o.team === e.team) objects[idx(tx, ty)] = null;
  }
  factoryBoomFx(e, 2);
  shakeAt(e.x, e.y, 4, EV_ANYWHERE); shakeAt(e.x, e.y, 7, 500);
  sfxAt('boom', e.x, e.y, EV_ANYWHERE);
  logEvent('THE ' + TEAMS[skin(e.team)].name + ' FACTORY HAS FALLEN', src || players.find((p) => p.team === e.team));
  state.eagleCine = { team: e.team, t: 0, srcId: src ? src.id : -1 };
}

// the ceremony's last beat, EAGLE_CINE_T after the fall (updateDrop ticks
// it): the whole side falls with its factory - die() and teamInMatch() both
// read teamFactoryDown - and checkLastStanding queues the victory or defeat
// screen while the rubble smokes underneath it (the sim runs on in mode 'dead').
function factoryFallResolve(e, src) {
  for (const p of players) {
    if (!p.active || p.team !== e.team) continue;
    if (!p.dead) die(p, null, 'factory');
    else if (!p.eliminated) {
      p.eliminated = true;
      if (p === player) endMatch('lost');
    }
  }
  checkLastStanding();
}

// the objective test the death/respawn path asks (player.js): a fallen
// factory takes its team out of the match - the one thing that does
function teamFactoryDown(team) {
  const e = state.drop && state.drop.eagles[team];
  return !!e && (e.state === 'fall' || e.state === 'gone');
}

// both factories, both birds, the riders and every faller, above the world
// and below the lighting. Shadows sit `alt` below (and a little right of)
// each body in the air.
function drawDropAir(ex, ey, now) {
  const d = state.drop;
  if (!d) return;
  // the flight path itself, dotted over the snow in each team's colour - the
  // world-space chart. The dots crawl toward the line's end so it reads as a
  // direction, and your own bird's jump window rides it in the flight bar's
  // pale window colour, brightening the moment the lock opens (never on the
  // scripted first flight, which has no door).
  if (state.mode === 'drop') for (const e of d.eagles) {
    if (e.state !== 'fly') continue;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 9]);
    ctx.lineDashOffset = -((now * 30) % 14);
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = TEAMS[skin(e.team)].mark;
    ctx.beginPath();
    ctx.moveTo(e.x0 - ex, e.y0 - ey);
    ctx.lineTo(e.x1 - ex, e.y1 - ey);
    ctx.stroke();
    if (e.team === player.team && player.aboard && !d.firstFlight) {
      const open = e.t >= e.dur - DROP_LOCK_T;
      ctx.globalAlpha = open ? 0.65 + 0.25 * Math.sin(now * 6) : 0.3;
      ctx.strokeStyle = open ? FLIGHT_OPEN : FLIGHT_SHUT; // the flight bar's own window colours
      ctx.beginPath();
      ctx.moveTo(e.x0 + (e.x1 - e.x0) * e.jumpOpen - ex, e.y0 + (e.y1 - e.y0) * e.jumpOpen - ey);
      ctx.lineTo(e.x0 + (e.x1 - e.x0) * e.jumpEnd - ex, e.y0 + (e.y1 - e.y0) * e.jumpEnd - ey);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  for (const e of d.eagles) drawFactory(e, ex, ey, now);
  for (const e of d.eagles) drawEagle(e, ex, ey, now);
  // fallers: a hop off the wing, then the shrink from rider scale to the
  // ground's, shadow growing under them. This is a WORLD pass, so the cull is
  // against WV_*, not VIEW_* - the old VIEW_* bounds were half the zoomed-out
  // frame, which is what made fallers on the far side of it vanish mid-air.
  for (const p of players) {
    if (!p.active || p.dropT <= 0) continue;
    const q = 1 - p.dropT / FALL_T;          // 0 just jumped .. 1 touching down
    const hop = Math.sin(Math.min(1, q * 4) * Math.PI) * 7; // the leap: up and off the wing first
    const alt = p.dropAlt * (1 - q * q) + hop; // then gravity: slow start, fast finish
    const sc = p.dropSc - (p.dropSc - 1) * q;  // from the seat's perspective size down to the ground's 1x
    const px = Math.round(p.x - ex), py = Math.round(p.y - ey);
    if (px < -40 || py < -DROP_ALT - 60 || px > WV_W + 40 || py > WV_H + 40) continue;
    const sw = Math.round(3 + 5 * q);
    ctx.fillStyle = 'rgba(40,60,100,' + (0.12 + 0.28 * q).toFixed(2) + ')';
    ctx.fillRect(px - sw, py - 1, sw * 2, 2);
    const ps = classSet(p).down[1 + (Math.floor(p.dropT * 10) % 2)];
    const dw = Math.round(16 * sc);
    ctx.drawImage(ps, Math.round(px - dw / 2), Math.round(py - alt - 12 * sc), dw, dw);
  }
}

// The WIND TRAIL: level flight tears the air. ONE continuous ribbon streams
// off each wingtip: sampled every TRAIL_STEP px back along the flown line
// for TRAIL_T seconds of flight, each sample where the tip actually WAS on
// that beat (the wing's reach and set follow the flap continuously -
// TRAIL_TIP/TRAIL_TIP_AMP, TRAIL_BACK/TRAIL_BACK_AMP - and the body's bob),
// so the ribbon waves with the wingbeat and hangs where it was torn while
// the bird flies on. It is solid at the tip and fades to nothing at its tail
// (one gradient along it, over a TRAIL_RIM dark line so white air reads over
// white snow). Pure reads of the flight clock - no particle, no sim step, the
// same trail at any dt - and the bank off the line fades the whole ribbon
// out as the bird turns for home. Drawn at the bird's altitude, under the sprite.
const TRAIL_TIP = 19, TRAIL_TIP_AMP = 2;   // sprite px across to the wingtip, and the gentle swing the flap puts on it (the tip itself moves 4, the air behind it half that)
const TRAIL_BACK = -8, TRAIL_BACK_AMP = 3; // ...and how far back along the body it sits, and its swing
function drawEagleTrail(e, ex, ey, S, now) {
  const hc = Math.cos(e.heading), hs = Math.sin(e.heading);
  const fade = e.state === 'fly' ? 0 : Math.min(1, e.airT / 0.5);
  if (fade >= 1) return;
  const T = e.t + (e.state === 'fly' ? 0 : e.airT);     // the flight clock: e.t stops at the line's end
  const head = Math.min(T, e.dur);                       // the ribbon's tip never leaves the line
  const n = Math.ceil(Math.min(TRAIL_T, head) * e.spd / TRAIL_STEP);
  if (n < 2) return;
  // a sample's point on the ribbon: the tip's world position `age` seconds ago
  const at = (side, age, out) => {
    const t = head - age, d = Math.min(e.spd * t, e.len);
    const ph = Math.cos((e.flap - (T - t)) * 7 * Math.PI / 2); // the flap cycle: spread -> mid -> back -> mid over four beats of 1/7 s
    const lat = side * (TRAIL_TIP + TRAIL_TIP_AMP * ph) * S, back = (TRAIL_BACK + TRAIL_BACK_AMP * ph) * S;
    out.x = e.x0 + hc * (d + back) - hs * lat - ex;
    out.y = e.y0 + hs * (d + back) + hc * lat - ey + Math.round(Math.sin((now - age) * 2.4 + e.team * 2.1) * 3);
  };
  const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
  ctx.save();
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    at(side, 0, a); at(side, Math.min(TRAIL_T, head), b);
    if (Math.max(a.x, b.x) < -40 || Math.max(a.y, b.y) < -40 || Math.min(a.x, b.x) > WV_W + 40 || Math.min(a.y, b.y) > WV_H + 40) continue;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      at(side, (i / n) * Math.min(TRAIL_T, head), b);
      if (i === 0) ctx.moveTo(b.x, b.y); else ctx.lineTo(b.x, b.y);
    }
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y); // solid at the tip, gone at the tail
    ctx.globalAlpha = 1 - fade;
    g.addColorStop(0, TRAIL_RIM); g.addColorStop(0.55, 'rgba(40,60,100,0.32)'); g.addColorStop(1, 'rgba(40,60,100,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.stroke();
    const w = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    w.addColorStop(0, 'rgba(255,255,255,0.95)'); w.addColorStop(0.55, 'rgba(255,255,255,0.55)'); w.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = w; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// one bird in its team's armour, on its line and then on its way home and
// out (birdPose, on the smoothed clock airShownT), until it is off the map.
// The sprite sits at the bird's point with its shadow DROP_ALT below it. A
// war eagle skin (birdSkinFor, read here only: the sim never asks) is
// painted at its heading, so it draws unrotated.
function drawEagle(e, ex, ey, now) {
  if (e.away) return;
  const frames = SPRITES.eagleTeam[skin(e.team)];
  const bp = birdPose(e, e.state === 'fly' ? undefined : airShownT(e, now));
  const sx = Math.round(bp.x - ex), sy = Math.round(bp.y - ey);
  const alt = DROP_ALT, S = EAGLE_SCALE;
  const fi = [0, 1, 2, 1][Math.floor(e.flap * 7) % 4];
  const worn = birdSkinFor(e.team), war = SPRITES.warBirds.has(worn) ? worn : null;
  const spr = war ? SPRITES.warBirds.frame(war, skin(e.team), bp.h, fi) : frames[fi];
  const k = war ? 1 : S, w = spr.width * k, h = spr.height * k; // a war frame is already flight-sized
  drawEagleTrail(e, ex, ey, S, now); // before the cull: the trail hangs behind a bird already off the frame
  if (sx < -w - 40 || sy < -h - DROP_ALT - 40 || sx > WV_W + w + 40 || sy > WV_H + h + 40) return;
  const bob = Math.round(Math.sin(now * 2.4 + e.team * 2.1) * 3);
  ctx.save();
  ctx.translate(sx + 10, sy + alt);
  if (!war) ctx.rotate(bp.h);
  ctx.drawImage(war ? SPRITES.warBirds.shadow(war, bp.h) : SPRITES.eagleShadow, -Math.round(w / 2), -Math.round(h / 2), w, h);
  ctx.restore();
  ctx.save();
  ctx.translate(sx, sy + bob);
  if (!war) ctx.rotate(bp.h);
  ctx.drawImage(spr, -Math.round(w / 2), -Math.round(h / 2), w, h);
  ctx.restore();
  // every rider seated on its wing, facing the way the bird flies, at the
  // bird's own perspective size (riderScale); the local player draws last so
  // it is never under a teammate. A wingbeat lifts the whole crew a pixel.
  const hc = Math.cos(bp.h), hs = Math.sin(bp.h);
  const RS = riderScale(), rd = riderDir(bp.h);
  const beat = fi === 0 ? -1 : 0; // the downstroke (spread frame) rides high
  if (!e.merchant) { // the driver first, on the neck: the team's merchant, who climbs down at the circle
    const ms = war ? SPRITES.warBirds.merchSeat : MERCH_SEAT; // behind the war helm, not on it
    const dx = ms[0] * S, dy = ms[1] * S;
    const rx = sx + dx * hc - dy * hs, ry = sy + bob + beat + dx * hs + dy * hc;
    drawSeated(SPRITES.merchant[skin(e.team)], rd, rx, ry, RS);
    seatedName(SPRITES.merchant[skin(e.team)], rd, rx, ry, RS, 'MERCH', e.team);
  }
  for (let pass = 0; pass < 2; pass++) for (const p of players) {
    if (!p.active || !p.aboard || p.team !== e.team || (p === player) !== (pass === 1)) continue;
    const st = EAGLE_SEATS[p.seat % EAGLE_SEATS.length];
    const dx = st[0] * S, dy = st[1] * S;
    const rx = sx + dx * hc - dy * hs, ry = sy + bob + beat + dx * hs + dy * hc;
    drawSeated(classSet(p), rd, rx, ry, RS);
    seatedName(classSet(p), rd, rx, ry, RS, p.name, p.team);
  }
  // where a jump right now would land: a pulsing ring under the bird -
  // only while the jump window is open and never on the scripted first flight,
  // or it promises a jump the lock refuses
  if (player.aboard && player.team === e.team && state.mode === 'drop' && !state.drop.firstFlight &&
    (e.state !== 'fly' || e.t >= e.dur - DROP_LOCK_T)) {
    const ph = (now * 1.2) % 1;
    ctx.globalAlpha = 0.8 - ph * 0.6;
    ctx.strokeStyle = FLIGHT_OPEN; // the flight bar's open window
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx, sy + alt, 6 + ph * 12, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
// The bird's clock past the line's end as the screen shows it: the sim steps
// e.airT at 60 Hz (a client hears it 15 times a second), so the draw carries
// it on by the frame's own clock between updates - never more than about one
// update's gap past the last value seen, never backwards (flightShownT's rule)
const airShown = [{ t: 0, seenT: -1, seenAt: 0, gap: 0 }, { t: 0, seenT: -1, seenAt: 0, gap: 0 }];
function airShownT(e, now) {
  const f = airShown[e.team];
  if (e.airT < f.seenT || f.seenT < 0) { f.t = f.seenT = e.airT; f.seenAt = now; f.gap = 0; return e.airT; }
  if (e.airT !== f.seenT) { f.gap = Math.min(0.25, now - f.seenAt); f.seenT = e.airT; f.seenAt = now; }
  f.t = Math.max(f.t, e.airT + Math.min(now - f.seenAt, f.gap * 1.5));
  return f.t;
}

// The side's FACTORY (js/sprites/factory.js), standing from takeoff: the
// building on its footprint's centre, the hit flash, the collapse (it
// shakes and sinks into its own dust, factoryBoomFx) and the rubble after
// it - and, once it is live, its hp bar under its name in its side's paint.
function drawFactory(e, ex, ey, now) {
  if (!e.crash) return;
  const gone = e.state === 'gone' || (e.state === 'fall' && e.fallT > COLLAPSE_T * 0.8);
  const spr = (gone ? SPRITES.factoryFallen : SPRITES.factory)[skin(e.team)];
  const sx = Math.round(e.crash.x - ex), sy = Math.round(e.crash.y - ey);
  const x0 = sx - FACTORY_OX, y0 = sy - FACTORY_OY, w = spr.width, h = spr.height;
  if (x0 > WV_W || y0 > WV_H || x0 + w < 0 || y0 + h < -30) return;
  if (e.state === 'fall' && !gone) {
    // the collapse: a shake that dies down as the walls sink into the ground
    // (the rows that have gone under are simply not drawn)
    const u = e.fallT / COLLAPSE_T;
    const dx = Math.round(Math.sin(now * 55) * 2 * (1 - u)), dy = Math.round(u * u * 24);
    ctx.drawImage(spr, 0, 0, w, h - dy, x0 + dx, y0 + dy, w, h - dy);
  } else ctx.drawImage(spr, x0, y0);
  if (e.flash > 0 && !gone) {
    ctx.globalAlpha = Math.min(1, e.flash * 7);
    ctx.drawImage(SPRITES.factoryFlash, x0, y0);
    ctx.globalAlpha = 1;
  }
  // the fall's shockwave: two rings racing out over the clearing, then gone -
  // squashed flat so they read as a blast along the ground
  if (e.boomT > 0) {
    const q = 1 - e.boomT / BOOM_LIFE;
    ctx.save();
    ctx.translate(sx, sy + 10);
    ctx.scale(1, 0.55);
    ctx.strokeStyle = '#f4f7ff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7 * (1 - q);
    ctx.beginPath(); ctx.arc(0, 0, 30 + q * 78, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = TEAMS[skin(e.team)].mark; ctx.lineWidth = 1; ctx.globalAlpha = 0.5 * (1 - q);
    ctx.beginPath(); ctx.arc(0, 0, 20 + q * 52, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (e.state !== 'down') return;
  // the pool, in team colour, up from the moment it is live - the bar IS
  // the objective's introduction, so it never waits for a first hit - under
  // its FACTORY nameplate in the same paint. In even health segments like
  // every hp bar, but big and few: the objective's bar reads from across
  // the clearing, so FACTORY_BAR_SEGS is set here rather than asked of
  // hpSegCount (which would split FACTORY_HP into a comb of 2 px blocks)
  const bw = FACTORY_BAR_W, bh = FACTORY_BAR_H, bx = Math.round(sx - bw / 2), by = y0 - 4 - bh;
  ctx.fillStyle = '#0f1632'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = '#3a3448'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = TEAMS[skin(e.team)].mark;
  ctx.fillRect(bx, by, Math.round(bw * Math.max(0, e.hp) / e.maxHp), bh);
  const segs = FACTORY_BAR_SEGS, seg = (bw + 1) / segs;
  ctx.fillStyle = HP_TICK;
  for (let k = 1; k < segs; k++) ctx.fillRect(bx + k * seg - 1, by, 1, bh);
  drawWorldText('FACTORY', centreTextX(sx, 'FACTORY', 2), by - 15, TEAMS[skin(e.team)].mark, 2); // at twice a player's size, two clear rows over the frame
}

// the ride's HUD: the flight bar (the line as a shape - flown part filled,
// the jump window pale, a white head line riding it), its JUMP key, and the
// keybind indicators. The wider read is the M map now.
// The flight bar's own clock. The bar moved only when the sim did - a
// 60 Hz step, or a 15 Hz snapshot on a client - and in whole UI pixels,
// 12 of them a second at the common scale, so the head crept in 3-device-px
// hops. This carries the flight's time on by the frame's own clock between
// updates, never more than about one update's gap past the last value seen
// (so a pause or a stalled wire holds it within a frame) and never
// backwards. Render-only: the sim's e.t is untouched.
const FLIGHT_BAR_CUT = { tl: true, tr: true, bl: true, br: true }; // all four corners cut
const FLIGHT_TRACK = '#1a2240';    // the line still to fly
const FLIGHT_SHUT = '#3c4a74';     // the jump window while the door is locked
const FLIGHT_OPEN = '#e8f0ff';     // ...and open
const FLIGHT_KEY_SHUT = '#5d6b92'; // the JUMP indicator while locked
const FLIGHT_DENY_T = 0.6;         // s the refusal holds - the bag's own (bagFlash)
// A press of the jump in flight, from any device - a key or the pad
// (keyPress), the click, the mouse scheme's press (input.js): the step
// performs it (dropJump). A press the door will refuse (the lock, or the
// scripted first flight) also reddens and shakes the flight bar, the bag's
// refusal (bagDenied) on this plate. Raised here on the pressing screen: a
// refusal flash is the client's own (the rule in js/net/events.js).
let flightDenyAt = -1e9; // performance seconds of the last refused press
function dropPress() {
  player.input.jump = true;
  const d = state.drop;
  if (!d || !player.aboard) return;
  const e = d.eagles[player.team];
  if (e.state === 'fly' && (d.firstFlight || e.t < e.dur - DROP_LOCK_T)) flightDenyAt = performance.now() / 1000;
}
const flightShown = { e: null, t: 0, seenT: 0, seenAt: 0, gap: 0 };
function flightShownT(e, now) {
  const f = flightShown;
  if (f.e !== e || e.t < f.seenT) { f.e = e; f.t = f.seenT = e.t; f.seenAt = now; f.gap = 0; return e.t; }
  if (e.t !== f.seenT) { f.gap = Math.min(0.25, now - f.seenAt); f.seenT = e.t; f.seenAt = now; }
  const reach = e.t + Math.min(now - f.seenAt, f.gap * 1.5);
  f.t = Math.max(f.t, Math.min(reach, e.dur));
  return f.t;
}
function renderDropUI(now) {
  const d = state.drop;
  if (!d || window.DBG.hideUI) return;
  const big = VIEW_H >= 500;
  const ts = big ? 2 : 1;                   // text scale follows the zoomed-out view
  const cxm = Math.round(VIEW_W / 2);
  if (player.aboard) {
    const me = d.eagles[player.team];
    const left = Math.max(0, me.dur - me.t);
    const open = me.t >= me.dur - DROP_LOCK_T;
    // the flight bar, top centre: a steel HUD plate (drawHudFrame, the
    // strip's own frame) round the whole line as a track. The pale stretch
    // is the jump window - the lock is taught by the shape, not a sentence -
    // and it pulses bright the moment the door opens.
    const bw = 120 * ts, bh = 6 * ts, bxx = cxm - Math.round(bw / 2), byy = 14 * ts;
    // a refused press: the whole plate - frame, track, number and key as one -
    // shakes a pixel either way and goes the bag's refusal red
    const red = now - flightDenyAt < FLIGHT_DENY_T;
    ctx.save();
    if (red) ctx.translate(((now * 40) | 0) % 2 ? -1 : 1, 0);
    drawHudFrame(bxx - 3, byy - 3, bw + 6, bh + 6, red
      ? { corners: FLIGHT_BAR_CUT, bg: BAG_BG_RED, ink: '#7a2436', lit: '#c2465a' }
      : { corners: FLIGHT_BAR_CUT });
    ctx.fillStyle = FLIGHT_TRACK;
    ctx.fillRect(bxx, byy, bw, bh);
    // the first flight is scripted (dropJump shuts the door), so it shows
    // no window and no key: nothing on screen offers a jump it would refuse
    const door = !d.firstFlight;
    if (door) {
      const wx0 = bxx + Math.round(bw * me.jumpOpen), wx1 = bxx + Math.round(bw * me.jumpEnd);
      ctx.fillStyle = open ? FLIGHT_OPEN : FLIGHT_SHUT;
      if (open) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now * 6);
      ctx.fillRect(wx0, byy, Math.max(2, wx1 - wx0), bh);
      ctx.globalAlpha = 1;
    }
    // flown so far, in team colour, a white head line riding its front. On
    // device pixels, not UI pixels: the head glides a device pixel at a time
    // (whole device pixels, so every edge stays crisp)
    const fx = Math.round(bw * Math.min(1, flightShownT(me, now) / me.dur) * devScale) / devScale;
    ctx.fillStyle = TEAMS[skin(player.team)].mark;
    ctx.fillRect(bxx, byy, fx, bh);
    ctx.fillStyle = '#f4f7ff';
    ctx.fillRect(bxx + fx - 1, byy - 2, 2, bh + 4);
    // seconds left beside the plate, white once the window is open
    drawPixelTextOutline(ctx, Math.ceil(left) + 'S', bxx + bw + 7 * ts, byy + Math.round(bh / 2) - 3 * ts,
      red ? '#c2465a' : open && door ? '#f4f7ff' : '#9fb6d8', '#0f1632', ts);
    // the jump's keybind indicator under the plate: dim while the door is
    // shut, lit once it opens, red with the plate on a refused press
    if (door) drawDropBind('dodge', 'JUMP', cxm, byy + bh + 9 * ts, red ? '#c2465a' : open ? '#f4f7ff' : FLIGHT_KEY_SHUT, ts, true);
    ctx.restore();
  } else {
    drawDropBind('move', 'DRIFT', cxm, 10 * ts, '#f4f7ff', ts, true);
  }
  // keybind indicator, bottom right: the map itself is the affordance
  if (!state.mapOpen) drawDropBind('map', 'MAP', VIEW_W - 6 * ts, VIEW_H - 12 * ts, '#9fb6d8', ts, false);
}
// one of the flight HUD's two keybind indicators: `KEY - VERB` as text for
// the keyboard - the key the action is bound to (keyCap, input.js) - the
// pad's glyph beside the verb while a pad is in hand (PAD_BIND, ui.js).
// Centred on x, or ending at x when `centre` is false.
function drawDropBind(act, verb, x, y, col, ts, centre) {
  if (padActive()) {
    const gw = padBindW(act) * ts, w = gw + 3 * ts + pixelTextWidth(verb, ts);
    const x0 = Math.round(centre ? x - w / 2 : x - w);
    drawPadBind(ctx, x0, y - 2 * ts, act, ts);
    drawPixelTextOutline(ctx, verb, x0 + gw + 3 * ts, y, col, '#0f1632', ts);
  } else {
    const t = keyCap(act) + ' - ' + verb, w = pixelTextWidth(t, ts);
    drawPixelTextOutline(ctx, t, Math.round(centre ? x - w / 2 : x - w), y, col, '#0f1632', ts);
  }
}

// the brief is over, however it ended: the controls come back, and the DAY 1
// headline the landing owes (the camera banner, js/sim.js, holds it while the
// tour has the top of the screen) pops now
function endBrief() {
  if (!state.dropBrief) return;
  state.dropBrief = null;
  if (!PRACTICE && state.mode === 'play') state.dayPop = { day: state.day, t: 0 };
}

// where the drop brief's camera is looking right now: the sim camera
// (js/sim.js) glides toward this every frame - a factory, or your boots
function dropBriefTarget() {
  const b = state.dropBrief, d = state.drop;
  if (!b || !d) return { x: player.x, y: player.y };
  if (b.ph === 'ours-go' || b.ph === 'ours') return d.eagles[player.team];
  if (b.ph === 'theirs-go' || b.ph === 'theirs') return d.eagles[1 - player.team];
  return { x: player.x, y: player.y }; // 'wait': where you landed
}

// the brief's two headlines, one per factory: the building on screen is the
// picture, this says what it MEANS (the headline carve-out - a match has
// exactly one win condition, and this is the once it is ever written down).
// Big, high and short: the headline in the factory's team colour at three times
// the HUD's text scale across the top of the view, one plain line under it,
// nothing else. Baked opaque and faded as a canvas, the dayPop grammar: an
// outline stamped under globalAlpha goes blotchy (the CLAUDE.md text rule).
let briefCv = null, briefCvKey = '';
function drawDropBrief() {
  const b = state.dropBrief;
  if (!b || window.DBG.hideUI) return;
  if (b.ph !== 'ours' && b.ph !== 'theirs') return;
  const hold = b.ph === 'ours' ? BRIEF_HOLD_OURS : BRIEF_HOLD;
  const a = Math.min(1, b.t / 0.25, Math.max(0, (hold - b.t) / 0.3));
  if (a <= 0) return;
  const ts = VIEW_H >= 500 ? 2 : 1; // the drop HUD's own text scale (renderDropUI)
  const key = b.ph + ts;
  if (!briefCv || briefCvKey !== key) {
    const team = b.ph === 'ours' ? player.team : 1 - player.team;
    const t1 = b.ph === 'ours' ? 'YOUR FACTORY' : 'THEIR FACTORY';
    const t2 = b.ph === 'ours' ? 'LOSE IT, LOSE THE MATCH' : 'BRING IT DOWN TO WIN';
    const hs = 3 * ts, ss = ts, pad = 6 * ts; // the plate's margin round the words
    briefCv = document.createElement('canvas');
    briefCv.width = Math.max(pixelTextWidth(t1, hs), pixelTextWidth(t2, ss)) + 4 + pad * 2;
    briefCv.height = 8 * hs + 8 * ss + 8 + pad * 2;
    const c2 = briefCv.getContext('2d');
    // a dark PLATE under the words, the panels' own ink at BRIEF_PLATE_A with
    // a 1px rim: the factory stands in a wall of pines, and an outline alone on green
    // needles at this size was a smear
    c2.fillStyle = BAG_BG;
    c2.globalAlpha = BRIEF_PLATE_A;
    c2.fillRect(0, 0, briefCv.width, briefCv.height);
    c2.globalAlpha = 1;
    c2.fillStyle = TEAMS[skin(team)].mark;
    c2.fillRect(0, 0, briefCv.width, 1); c2.fillRect(0, briefCv.height - 1, briefCv.width, 1); // the team's colour as the plate's rule, top and bottom
    drawPixelTextOutline(c2, t1, Math.round((briefCv.width - pixelTextWidth(t1, hs)) / 2), pad + 2,
      TEAMS[skin(team)].mark, '#0f1632', hs);
    drawPixelTextOutline(c2, t2, Math.round((briefCv.width - pixelTextWidth(t2, ss)) / 2), pad + 8 * hs + 6,
      '#f4f7ff', '#0f1632', ss);
    briefCvKey = key;
  }
  ctx.globalAlpha = a;
  ctx.drawImage(briefCv, Math.round((VIEW_W - briefCv.width) / 2), Math.round(VIEW_H * 0.08));
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ boot
function startGame() {
  SFX.unlock();
  beginDrop();
}

PROFILE.load();   // the profile carries the settings, so it is read first
loadSettings();
mendBinds(); // the profile's key binds made whole (input.js)
// ...and the tech tree, which decides what this profile's world may drop.
// Must run after PROFILE.load() and before initPlayers()/any swing.
rebuildLootPool();
// ...and the merchants' market, which primes three days of prices behind it
// so the counter's graphs are graphs on day one (js/shop.js).
initMarket();
relayout(); // fitCanvas already ran at load; this places the UI for the fitted view
SFX.setVolume(settings.volume);
SFX.setMusicVolume(settings.musicVol);
SFX.setSfxVolume(settings.sfxVol);
SFX.setMuted(settings.muted);
// the title track. Browsers refuse audio before a gesture, so SFX.music holds
// this as pending and the first click or keypress starts it (see js/audio.js).
SFX.music.play('intro', { in: 1.5 });
if (PRACTICE) {
  // the training field (the `practice arena` banner, js/world.js): a fixed
  // room instead of a match world - one dummy, open targets, the ice parkour,
  // and nothing that spawns or restocks: no camps, chests, wildlife or
  // eagles at all
  genPracticeWorld();
} else {
  // the SHAPE this page grew (MAPS, js/world.js): ?map=N wins, else the
  // profile's pick, so a reload carries a pick the way ?seed carries a
  // reroll. Read after loadSettings and before genWorld, and never again.
  MAP_TYPE = (function () {
    const q = /[?&]map=(\d+)/.exec(location.search);
    const k = q ? +q[1] : settings.mapType | 0;
    return k >= 0 && k < MAPS.length ? k : 0;
  })();
  settings.mapType = MAP_TYPE; // the lobby's pick starts as the shape standing (a ?map=N page may differ from the profile's)
  genWorld();
  placeCreek();     // the creek down the cross-diagonal, its bridge, bends and fords (world.js)
  layPaths();       // ...and the paths a grown shape cuts through its own woods, forded where they cross it (world.js)
  placeRoad();       // the diagonal lane, and the paths with it (world.js)
  placeZips();       // ...and each side's cable along it (world.js)
  placeCamps();      // worldgen's last pass, before the ground is baked: the camps clear their sites
  placeChests();     // ...then the caches take their trees (objects only, no ground)
  placeRocks();      // ...and the rocks move out to their clusters on the rim, on their own stream (world.js)
  placeLandmarks();  // ...and the story landmarks take their spots, on a stream of their own (landmarks.js)
  spawnAnimals();
  spawnFish();
  stockCamps();      // the monsters go in once the world is standing
}
layDrifts();         // the snow's depth, in the lee of everything worldgen stood up (js/depth.js)
initPlayers();
// the match's role for this screen (js/net/net.js): ?net=host&room=R hosts a
// room on the dev server's relay, ?net=client&room=R joins it; nothing else
// (and any file:// page) is solo. A lobby hands the role in instead, later.
// Under the wrapper (desktop/, which exposes window.steamBridge) the same
// two roles ride a Steam lobby instead: ?net=host makes one, ?net=client&lobby=ID
// joins it (js/net/transport-steam.js).
(function () {
  const q = /[?&]net=(host|client)/.exec(location.search), r = /[?&](?:room|lobby)=([A-Za-z0-9_-]+)/.exec(location.search);
  netRelay(); // a ?relay= in the URL is remembered now, whether or not a role follows
  if (q) netSetup(q[1], netTransportFor(r ? r[1] : null)); else netSetup('solo');
})();
// ...and a page reloaded onto a room's seed to join it (joinRoom, js/ui/menu.js)
// walks straight into the rooms screen with that join under way
const JOIN_AT_BOOT = (function () { const j = /[?&]join=([A-Z0-9]+)/i.exec(location.search); return j ? j[1].toUpperCase() : null; })();
// a saved match (js/save.js): the valley as it grew is the baseline every
// save is written against, and a load that reloaded onto its seed puts the
// match back now - after the world stands, before the bake paints it
if (!PRACTICE) saveBaseline();
const LOADED_AT_BOOT = !PRACTICE && !NET.isClient && saveBootLoad();
prepGround(); // the ground bakes lazily from here, view first (js/draw/ground.js)
mapAlloc(); // the map slab's buffers and bake, at the size relayout() gave it
buildSettingsPanel();
buildHelpPanel();
camX = player.x - WV_W / 2;
camY = player.y - WV_H / 2;
// practice boots straight onto the snow: no title, no eagle. The other nine
// players empty out (control 'none' - `active` is derived from it) and stand
// parked in the corner forest, far outside the arena, so their ghost
// silhouettes never wander into a capture; the local player takes the arena's
// spawn tile and the HUD slides in the way a landing's does.
if (PRACTICE) {
  for (const p of players) {
    if (p === player) continue;
    p.control = 'none';
    p.spawn = { tx: 4, ty: 4 };
    p.x = (4.5) * TILE; p.y = (4.5) * TILE;
  }
  player.spawn = { tx: PR_SPAWN.tx, ty: PR_SPAWN.ty };
  player.x = (PR_SPAWN.tx + 0.5) * TILE;
  player.y = (PR_SPAWN.ty + 0.5) * TILE;
  // early morning, forever: sim.js never advances state.time under PRACTICE,
  // so this is the arena's one fixed hour - crisp daylight, shadowless dawn
  state.time = 0;
  state.mode = 'play';
  camX = Math.max(0, Math.min(WORLD * TILE - WV_W, player.x - WV_W / 2));
  camY = Math.max(0, Math.min(WORLD * TILE - WV_H, player.y - WV_H / 2));
  state.introFrom = { x: camX, y: camY };
  state.intro = HUD_IN_T; state.introLen = HUD_IN_T;
} else if (!PROFILE.hasChar()) {
  // a fresh install: the first thing seen is the create screen, opened on a
  // pre-rolled character (js/ui/chars.js) - the title menu is behind it
  beginCreate(-1, true);
}
if (JOIN_AT_BOOT && !PRACTICE && PROFILE.hasChar()) { beginRooms(); state.menu.rsel = -2; netJoin(JOIN_AT_BOOT); }
// landing from a reroll: the whiteout the die left behind clears to the new world
try {
  if (sessionStorage.getItem('softfall.reroll')) {
    sessionStorage.removeItem('softfall.reroll');
    state.fade = { a: 1, to: 0, spd: 1 / 0.8, color: '#f4f7ff', then: null };
    state.menu.rolling = 0.5;
  }
  // ...and from a MAP PICK, which is the same page on the same seed in a new
  // shape (pickMap, js/ui/menu.js): it clears onto the screen it was made on,
  // so picking a shape is one press and not a walk back through the menu
  // (through the lobby's own night, not the white: the screen went dark on
  // itself and comes back up on itself)
  if (sessionStorage.getItem('softfall.select')) {
    sessionStorage.removeItem('softfall.select');
    if (!PRACTICE && PROFILE.hasChar() && !JOIN_AT_BOOT) {
      beginLobby(); state.menu.screenT = 1;
      if (state.fade) state.fade.color = LOBBY_NIGHT;
    }
  }
  // ...and from LOCK IN on a shape this page had not grown (lockIn, js/ui/menu.js):
  // the page came back on this seed in that shape and goes straight to the
  // eagle, the gear picks, stat points and ability picks it carried put back on (no profile holds them)
  const dropRaw = sessionStorage.getItem('softfall.drop');
  if (dropRaw) {
    sessionStorage.removeItem('softfall.drop');
    if (!PRACTICE && PROFILE.hasChar() && !JOIN_AT_BOOT) {
      try {
        const d = JSON.parse(dropRaw);
        if (d && Array.isArray(d.gear)) player.gear = d.gear.map((v) => v | 0);
        if (d && Array.isArray(d.pts)) player.pts = d.pts.map((v) => v | 0);
        if (d && Array.isArray(d.abPick)) player.abPick = d.abPick.map((v) => v | 0);
      } catch (e) { }
      setClass(player, player.cls);
      beginDrop();
    }
  }
} catch (e) { }

// ...and a saved match put back at boot (saveBootLoad above) comes up out of
// the dark, whatever the page was about to show
if (LOADED_AT_BOOT) saveBootEnter();

// debug/dev harness: lets external tooling step frames & stage scenes
window.DBG = {
  SEED, state, animals, objects, ground, mouse, keys, drops, footprints, flakes,
  fish, iceCracks, holes, crackIce, addFish, spawnEmerger, netAt, buildSiteAt,
  // the shoal the water this shape froze can hold (the fish banner, wildlife.js)
  get fishCap() { return fishCap; }, get fishFloor() { return fishFloor; },
  // the camps: the live registry, the table behind it, where each site is,
  // what is where, restock by hand, and blood a player by hand
  camps, CAMPS, CAMP_SITES, campSites, campTile, campAt, stockCamps, campBuff, flushBirds,
  // the map shape this page grew, the table behind it, the rule one IS, and
  // the paths it cut: DBG.mapTerrain(k, tx, ty) answers for any shape
  MAPS, mapTerrain, mapName, mapGrown, paths, pathDist,
  // the snow's depth (js/depth.js): the map, the deep band, the drifts and the wind that laid them
  snowDepth, deepAt, drifts, driftWind,
  get MAP_TYPE() { return MAP_TYPE; },
  // the practice arena: whether this boot is one, the dummy's live record,
  // the spawn tile, the shared hit paths, the archery targets, the parkour
  // clock and the ESC slab's exit plank
  PRACTICE, practiceDummies, PR_SPAWN, hitDummy, leavePlankRect,
  ptargets, ptFace, ptLive, ptHitR, hitPTarget, parkour,
  // the archery round: the live state, the difficulty tables, the bell's
  // resolver, ring a round in by hand at a difficulty (warp beside AG_BELL
  // first - the reach check is real), spawn one random target, and the
  // track parametrisation for staging shots
  agame, AG_DIFF, agBellNear, agSpawn, agStock, agPos, AG_LEN, AG_BELL,
  agRing: (diff, p) => agRing(p || player, { tx: AG_BELL.tx, ty: AG_BELL.ty, id: diff || agame.diff }),
  get agStreak() { return agStreak; }, // the consecutive-hit run (rebinds, so a getter)
  // the parkour roll station: roll a track by hand, resolve the die E would
  // open the wheel on, and watch the sweep (pkAnim rebinds, so a getter;
  // pkAnimStep lets a driver fast-forward the front)
  pkRoll, pkDieNear, pkWheelPick, PK_DIFFS, pkAnimState: () => pkAnim, pkAnimStep,
  // drop a player (default the local one) on a tile - how to stage a camp
  warp: (tx, ty, p) => { const q = p || player; q.x = (tx + 0.5) * TILE; q.y = (ty + 0.5) * TILE; q.vx = q.vy = 0; return q; },
  settings, perf, treeRare, cursorInfo,
  // the other controller (js/gamepad.js): its live state
  pad, padActive,
  // the local profile: the store itself and the character screens (js/ui/chars.js),
  // so a driver can open the roster or the create screen and read back what it accepts
  PROFILE, beginChars, leaveChars, beginCreate, createCommit, createCancel, createKey, createHit, charsHit,
  createLayout, charsLayout, nameOk, charTagRect, overCharTag, applyCharacter, activateChar, beginSkins, skinsLayout, birdSkinFor, coinTagRect, setCoins: (n) => PROFILE.setCoins(n),
  // the radial wheel: open one by hand (state.wheel) and read back the
  // geometry the hover test and the pixels both use
  wheelLayout, wheelSpan, wheelAng, WHEEL_HUB, WHEEL_R, WHEEL_RING,
  structures, robots, tracers, arrows, STRUCTS, SWING_TOOLS, TOOLS, BITS,
  // the team flag: plant one without a mouse (any player), lift it, open the
  // wheel by hand, and read back whose flag a body serves and the ring
  FLAG_TYPES, FLAG_ORDER, FLAG_R, mapTileAt, mapCloseRect, mapCloseHit, servedFlag, humanFlag, inFlag, openFlagWheel,
  // the two coordinate bridges, so a driver can put the pointer on a tile
  wToSX, wToSY, mouseWX, mouseWY,
  plantFlag: (tx, ty, type, p) => plantFlag(p || player, tx, ty, type),
  clearFlag: (p) => clearFlag(p || player),
  get flag() { return player.flag; },
  // the hud strip - the xp bar + weapon/ability strip, bottom-centre.
  hudStripRect, stripHit,
  // Tools and bits: the two tables, the tier palette, an instance maker, the
  // firing pipeline and the loot roll - so a driver can stage a build without
  // mining for it. `shelfCellRect(-1)` is the weapon's one well, and
  // `shelfCellRect` / `shelfHit` the always-up shelf's (cell -1 is the tool).
  // `fitAdd` is the pickup's own path: a bit into the tool, the rest in the pack.
  TOOL_TIERS, TOOL_SLOTS, makeTool, toolType, bitType, bitMods, newMods, fitAdd,
  // toolPlan is the whole press resolved without firing it: what the budget
  // reaches, through which envelope, and where it runs out (`cut`)
  toolPlan, toolLoad, toolDrawMul, drawTime, sortBits,
  toolRof, toolCycle, peekBit, toolReady, dropLoot, giveLoadout, CLASS_LOADOUT,
  // a thing put down on purpose: the throw (out of the pack, along the
  // cursor), the lock that keeps it out of the thrower's own hands, and the
  // bits a tool sheds as it lands - so a driver can stage a discard without
  // a drag. And the swap: whether a find would take the hand, doing it, and
  // the risen icons it leaves for drawSwaps.
  spawnDrop, throwCell, flingDrop, lockDrop, dropLocked, TOSS_SPEED, TOSS_LOCK_T,
  shedBits, SHED_KICK, BIT_STACK, swaps, SWAP_T,
  // death keeps everything (die): the one number a kill is worth
  KILL_BOUNTY,
  toolUpgrade: (cell, p) => toolUpgrade(p || player, cell),
  takeUpgrade: (cell, p) => takeUpgrade(p || player, cell),
  // the draw curve: 0..1 off a player's chargeT, and the flight and damage it buys a bit
  drawPow, shotFlight, drawDmgMul, DRAW_RANGE_MIN, DRAW_SPEED_MIN, DRAW_DMG_MIN,
  shelfCellRect, shelfHit, shelfRails, tierPlate,
  // the closing line's three bits: what a shot does where it LANDS, the
  // teleport with no shot to fire it, the flashes it strings across the jump,
  // and the chop a thrown axe lands - so a driver can prove an arrival or a
  // fell without waiting for one to connect
  BIT_IMPACT, warps, WARP_FLASH_T, AXE_CHOP_R, chopTree,
  warpPlayer: (x, y, p) => warpPlayer(p || player, x, y),
  // the class abilities: the table, a keypress by hand, and the entity lists
  // an ability leaves in the world - so a driver can stage a crater or a net
  // without walking a bot into one
  CLASS_AB, abCraters: craters, abNets: nets,
  tryAbility: (i, p) => tryAbility(p || player, i),
  setAbilityCd: (i, t, p) => { (p || player).abCd[i] = t; },
  // ability levels: gear's ladder on the four keys (js/abilities.js)
  AB_LV_MAX, abLvCanBuy: (i, p) => abLvCanBuy(p || player, i),
  abCdOf: (i, p) => abCdOf(p || player, i),
  // level 0 is LOCKED: nothing casts off a key no point has been spent on
  abUnlocked: (i, p) => abUnlocked(p || player, i), abReady: (i, p) => abReady(p || player, i),
  buyAbilityLv: (i, p) => buyAbilityLv(p || player, i), abBuyRect, abBuyHit,
  // the arsenal tree: the graph, the page's own geometry, and the pool a
  // match drops from - which is the whole arsenal, the same for every profile.
  // `wipeTech` forgets what this profile has HELD (the blue pips), which is
  // all a profile still remembers about the tree.
  TECH, rebuildLootPool, LOOT_POOL,
  // the wiki: its pages, the live layout (tabs, rows, window, rail), what is
  // under a point, the open page's scroll, and the way in from the plank
  WIKI_PAGES, wikiLayout, wikiHit, wikiScrollBy, wikiSetTab, beginWiki, leaveWiki,
  wipeTech: () => PROFILE.clearTech(),
  // The merchant's counter (js/shop.js): the live market and its two goods,
  // the rolled stock, the panel's geometry, and every trade without the
  // pointer. `marketStep(n)` walks the prices n moves on so a driver can watch
  // a spike without waiting three days for one, and `shopRestock()` turns the
  // counter over on the spot - quietly, or `shopRestock(true)` with the plate
  // and the two-beat cue a real turnover raises.
  market, GOODS, MKT_STEP, MKT_HIST, MKT_DAYS, SHOP_RESTOCK, marketPrice, marketHist,
  marketStep: (n) => { for (let i = 0; i < (n || 1); i++) updateMarket(MKT_STEP); return MKT_ORDER.map(marketPrice); },
  shopRestock: (loud) => shopRestock(!loud), shopOffer, itemValue, cellValue, sellValue,
  // the market's plates under the minimap: the live stack, where a slot lands,
  // and a way to raise one without waiting for the walk to do it
  notices, noteRect, NOTE_KIND, raiseNotice,
  merchNear: (p) => merchNear(p || player),
  openShop: (p) => openShop(merchNear(p || player)), closeShop, shopOpen,
  shopLayout, shopHit: (x, y) => shopHit(x == null ? mouse.x : x, y == null ? mouse.y : y),
  shopBuy: (sec, i, p) => shopBuy(p || player, sec, i),
  shopSellCell: (i, p) => shopSellCell(p || player, i),
  // the SELL ALL button's own press, and the two numbers it reads itself out
  // with - the pack's worth over the counter and how many cells that is
  shopSellAll: (p) => shopSellAll(p || player), packValue: (p) => packValue(p || player),
  packCount: (p) => packCount(p || player),
  shopTrade: (id, dir, p) => shopTrade(p || player, id, dir),
  CARD_PRICE,
  // what the pointer is on, as the panel would describe it (null = nothing)
  tipAt: (x, y) => tipAt(x == null ? mouse.x : x, y == null ? mouse.y : y),
  // and where this frame's panel is sitting, the rect drawTooltip paints -
  // which is how the TOOLTIP row's two modes are read without eyeballing px
  tipRect: () => { if (!tipNow) return null; const s = tipSize(tipNow); return Object.assign(tipPos(s.w, s.h), s); },
  fireTool: (p) => fireTool(p || player),
  // the fish catch's three beats: start one by hand, read which frame a body is on
  startCatch: (p) => startCatch(p || player), cancelCatch: (p) => cancelCatch(p || player), catchFrame,
  get tools() { return player.tools; },
  // stage a loaded tool straight onto a slot: DBG.equip(0, 'longbow', ['arrow','flame'])
  equip: (slot, id, bits, p) => {
    const q = p || player, cell = makeTool(id);
    (bits || []).forEach((b, i) => { if (i < cell.bits.length) cell.bits[i] = b; });
    sortBits(cell);
    q.tools[slot] = cell;
    return cell;
  },
  setNock: (t, p) => { (p || player).nockT = t; }, // a huge t parks a player's bow for a capture
  // the players: all ten, the local one, and the teams table
  players, MAX_PLAYERS, TEAMS, Player, ringPts, contestRank,
  // the eagle drop: the live flight records, force a jump, or fly the route from scratch
  get drop() { return state.drop; }, beginDrop, dropJump: (p) => dropJump(p || player, true), landPlayer, makeEagleRoute, makeEagles, inAir,
  birdAt, birdPose, // where a bird is past its line's end, and anywhere
  // the two objectives: read them, chip one, or fell one outright without a siege
  get eagles() { return state.drop && state.drop.eagles; },
  // the war eagle skins' painter (js/sprites/warbirds.js); wear one with PROFILE.wear('bird', id)
  warBirds: SPRITES.warBirds,
  // the paint: which preset a team wears on this screen (settings.teamBlue), and the two merchants
  skin, get merchants() { return robots.filter((b) => b.merchant); },
  // the factory's road out and the rest of the road system
  spurs, roadNest, roadSpan, roadDist, roadMainDist, findCrashPoint, // the road system: the spur registry, a side's nest and junction, the gates, the two distances, and where a factory stands
  creekAt, creekFlow, creekWet, bridgeAt, creekBends, creekOuterFords, waterAt, CQ, // the creek: the distance to its banks (CQ holds where), the current, the plunge test, the deck, the bends and the fixed fords
  zips, zipPoint, zipNearest, zipNear, zipStart, zipEnd, zipToggle,  // the ziplines (world.js): both lines, a point along one, the nearest point to a body, and the ride's own verbs
  landmarks, LANDMARKS, sledNear, sledToggle, sledEnd, // the story landmarks (landmarks.js): every one stood, the table, and the sled's ride
  hurtFactory: (team, dmg, src) => { const e = state.drop.eagles[team]; hurtFactory(e, dmg == null ? 25 : dmg, src); return e; },
  factoryFall: (team, src) => factoryFall(state.drop.eagles[team], src),
  teamFactoryDown,
  get player() { return player; },
  get inv() { return player.inv; },
  // the backpack: the item table, the slot array, and add/take/count without
  // walking onto a drop. bagHit is what the pointer tests against; food is a
  // POUCH and takes no cell, so `food` is where a berry actually sits, and
  // goldCellRect is the always-on gold readout on the hud strip.
  ITEMS, BAG_CAP, bagFrameRect, bagTabRect, bagCellRect, bagHit, goldCellRect, foodCellRect, shortNum, useCard: (p) => useCard(p || player),
  get bagEase() { return bagEase; },
  // the drag, and what it answers with: the armed press, the three moves, the
  // cue/rumble/pulse raiser, and what a release on a given well WOULD do -
  // so a driver can prove the promise and the move agree without a mouse
  dragLift, dragDrop, dragReturn, hudPress, hudRelease, hudFx, haptic,
  dropKindBag, dropKindSlot: (i) => dropKindSlot(i || 0), dropKindBit,
  get wellLit() { return wellLit; }, get dragLit() { return dragLit; },
  get bag() { return player.bag; },
  get food() { return player.food; },
  bagAdd: (type, n, p) => bagAdd(p || player, type, n || 1),
  bagTake: (type, n, p) => bagTake(p || player, type, n || 1),
  bagCount: (type, p) => bagCount(p || player, type),
  bagRoom: (type, p) => bagRoom(p || player, type),
  bagUsed: (p) => bagUsed(p || player),
  // hand a player to an AI, a human, or nobody (a ghost at its camp)
  setControl: (id, mode) => { const p = players[id]; if (p) p.control = mode; return p; },
  // reseat this screen's player in slot `id` (a fresh roster: bots and bags
  // reset), the camera on it - the same thing ?local=N does at load
  setLocal: (id) => { initPlayers(undefined, id); camX = player.x - WV_W / 2; camY = player.y - WV_H / 2; return player; },
  localId: () => localId,
  // the snapshot and its echo harness (js/net/snapshot.js): netEcho() renders,
  // snapshots, blanks, applies and renders again - a nonzero diff is a field
  // the schema is missing; netEchoRun(ticks, every) does it along a run
  netEcho, netEchoRun, snapBuild, snapApply, snapSize, NET, netSetup,
  // the two-tab match: role, peers, bytes each way, the newest snapshot tick
  netStatus: () => ({ role: NET.role, peers: [...NET.peers.values()].map((q) => q.slot), parked: NET.parked.size, synced: NET.synced, lastTick: NET.lastTick, bytesIn: NET.bytesIn, bytesOut: NET.bytesOut, bpsIn: NET.bpsIn, bpsOut: NET.bpsOut, hostOver: NET.hostOver, refused: NET.refused || null, open: !!(NET.transport && NET.transport.open), lobby: NET.transport && NET.transport.lobbyId || null, room: NET.transport && NET.transport.room || null, transportError: NET.transport && NET.transport.error || null, verify: NET.verify, verifyFail: NET.verifyFail, acks: [...NET.peers.values()].map((q) => q.ack), hist: snapShadow.hist.length, lossOut: NET.lossOut, dropped: NET.dropped, fulls: NET.fulls, framesLost: NET.transport && NET.transport.lost || 0 }),
  // the wire form's own proofs: netDeltaRun(ticks, every) sends `ticks` of this
  // page's sim as binary deltas and applies them back, comparing against the
  // full form after each; netVerify(on) makes a host ride its full form along
  // every VERIFY_EVERY ticks so each client checks itself (netStatus().verifyFail)
  netDeltaRun, netVerify: (on) => { NET.verify = !!on; return NET.verify; }, netLoss: (f) => { NET.lossOut = +f || 0; return NET.lossOut; }, snapHistoryPush, snapDeltaFrom, snapBuildDelta, snapEncode, snapDecode, encDict,
  // the wrapper's lobbies, for a joiner picking one by hand (steamBridge only)
  lobbies: () => (window.steamBridge ? window.steamBridge.lobbies() : Promise.resolve([])),
  placeObj, idx, objAt, hoverFish, damagePlayer, die, endMatch, specNext, aliveCount, updateAI, contest,
  // the post-game lobby (js/ui/lobby.js): freeze the table by hand, open the
  // screen without walking a ceremony, drive it, and read back both the
  // frozen record and the live screen state
  statFreeze, sampleStats, openScores, scoresLayout, scoresHit, scoresKey, scoresClick, scores,
  get matchStats() { return matchStats; },
  // the two end screens: their timelines, the frozen numbers they print, and
  // a way to open the loss summary without pressing its plank. Set
  // state.defeatT / state.deadTimer to scrub either ceremony to a beat.
  WIN_T, DEF_T, openDefeat, endSnapshot, endScreen, deadLayout, deadHit, deadActivate, respawnTime,
  // ...and their emote bar: the table, where its plates sit, what the pointer
  // is on, and a way to play one without a key (DBG.emotePlay(0..3))
  EMOTES, EM_T, emoteLayout, emoteHit, emotePlay, emoteLive,
  // the replay window's rect this frame, its close box, and whether the pointer is on it
  rpRect, rpCloseRect, rpCloseHit,
  // routes: the search itself, and showPaths = true draws every unit's live route
  findPath, walkable, navTo, showPaths: false,
  // hero levels: pay a player gold (and XP) the way a pickup would
  gainGold: (n, p) => gainGold(p || player, n), LEVEL_XP, LEVEL_MAX,
  // the stat ledger, the sheet that flies into the notice lane when a number
  // moves (the `stat ledger` block, js/ui/shop.js): the table every surface
  // prices a body with, the plate's own size, the live values, what each row
  // is still lit for, and the raise without a change behind it - so a driver
  // can prove a level, a card or a gear buy moved the number it was meant to
  GEAR_STATS, STAT_W, statPlateH, raiseStatNote, noteLaneFloor,
  statValues: (p) => GEAR_STATS.map(([n, get, fmt]) => [n, fmt(get(kitOf(p || player), p || player))]),
  statLit: () => GEAR_STATS.map(([n], i) => (statLit[i] ? [n, statDeltaTxt(statLit[i].d, GEAR_STATS[i][2]), statLit[i].t] : null)).filter(Boolean),
  // gear: the table, a player's effective kit, and buy/pick without the HUD
  GEAR, GEAR_SLOTS, GEAR_COSTS, kitOf, refreshKit, gearHit, charLayout, charHit, BAG_CELL,
  gearCost: (i, p) => gearCost(p || player, i),
  buyGear: (i, p) => buyGear(p || player, i),
  pickGear: (i, v) => pickGear(i, v), spendPt, heroLayout, heroScreenHit, beginHero,
  setGear: (i, v, p) => { const q = p || player; q.gear[i] = v; refreshKit(q); return q.kit; },
  // the match readouts: the log (not drawn - read it here), staged lines
  // without the kills behind them, and the standings (hold TAB in game, or
  // set keys.tab here)
  events, logEvent, scoreGroups, scoreboardOpen,
  // the four-second replay: the filmstrip itself, how much is banked, whether it is up, and whether it fills the frame
  replay: {
    get cv() { return rpAt; }, get frames() { return rpCount; }, showing: replayShowing, full: replayFull,
    get shot() { return [rpFW[(rpHead - 1 + RP_N) % RP_N], rpFH[(rpHead - 1 + RP_N) % RP_N]]; },
    get slot() { return [rpSW, rpSH]; }, get bytes() { return rpAt ? rpAt.width * rpAt.height * 4 : 0; },
    W: RP_W, H: RP_H, fps: RP_FPS, rate: RP_RATE, ov: rpOv,
  },
  // action entry points default to the local player, or take any player
  clickAction: (p) => clickAction(p || player),
  tryWork: (p) => tryWork(p || player),
  workTarget: (p) => workTarget(p || player),
  tryDodge: (p) => tryDodge(p || player),
  // status effects (js/actions.js): the one blow every kind of unit takes,
  // every state one can be put under, and the two lists an area effect
  // sweeps. `e` defaults to the local player wherever it is the last argument.
  hurtUnit, unitsNear, unitsHit, unitMoveMul, unitFoe, unitAlive, sideOf, clearUnitStatus,
  rootUnit: (t, e) => rootUnit(e || player, t),
  slowUnit: (t, mul, e) => slowUnit(e || player, t, mul),
  netUnit: (t, mul, e) => netUnit(e || player, t, mul),
  markUnit: (t, e) => markUnit(e || player, t),
  // fire: light a body, put it out, and the numbers a burn runs on
  igniteUnit: (t, dps, e, src) => igniteUnit(e || player, t, dps, src === undefined ? player : src),
  douseUnit: (e) => douseUnit(e || player),
  DMG_TYPES, BURN_T, BURN_DPS, BURN_TICK, BURN_MAX, PYRE_T, PYRE_DPS, CINDER_R,
  // the roll as a hit: stun anything by hand, and read back what a roll at a
  // given speed would deal (`.` draws the sweep circle over a live dash)
  stunUnit: (t, e) => stunUnit(e || player, t),
  rollDmg: (sp, p) => rollDmg(p || player, sp),
  rollSweep: (p) => rollSweep(p || player),
  ROLL_HIT_R, ROLL_FAST, ROLL_DMG, ROLL_STUN, TACKLE_STUN, TACKLE_SELF, TACKLE_MIN,
  // prone: the burrow toggle, how buried a player reads to anything hunting it,
  // and a way to stage a fully covered body without lying in the snow for 1.5s
  tryProne: (p) => tryProne(p || player),
  risePlayer: (p) => risePlayer(p || player),
  concealOf: (p) => concealOf(p || player),
  seenAt: (range, p) => seenAt(p || player, range),
  ambushReady: (p) => ambushReady(p || player),
  setHide: (h, p) => {
    const q = p || player;
    q.hide = Math.max(0, Math.min(1, h));
    q.prone = q.hide > 0 || q.prone;
    return q.hide;
  },
  PRONE_BURY, PRONE_SPEED, PRONE_SNIFF, PRONE_CUT, PRONE_MOVE, PRONE_MAP, AMBUSH_MUL,
  spawnAnimal: (kind, x, y) => { const a = makeAnimal(kind, x, y); animals.push(a); return a; },
  // the level a spawn is dealt (the table's average), the meadow's strength
  // and its top-up (which a driver can call by hand to force one now)
  animalLevel, PREY_POP, updatePreyStock,
  // debug staging: place a construction site directly, no cost or validation
  buildStruct: (tx, ty, type, tier, rot) => {
    const t = Math.min(STRUCTS[type].tiers.length - 1, tier || 0);
    return createStruct(tx, ty, type, t, player, true, rot); // anchor = top-left for a big footprint
  },
  findSite, structOf, footprint,
  // the build list and its ghost: the one placement rule, the list's order
  // and reach, what the ghost snaps to right now, and the building E manages
  canPlaceAt, BUILD_ORDER, BUILD_REACH, buildGhostAt, manageNear, placeStruct,
  // ...and the hammer plate that opens it, the rows under it (1x corner
  // space - the hit tests take the pointer's own), and the one toggle
  buildTabRect, buildTabHit, buildRowRect, buildListHit, toggleBuild,
  finishBuild: (o) => { if (o && o.building) o.buildT = o.buildTotal; },
  // z is a world scale; it lands on the nearest pixel-exact rung, as the
  // wheel does. snap skips the ease. setK sets the rung itself.
  setZoom: (z, snap) => { kWant = Math.max(kMin(), Math.min(kMax(), Math.round((+z || 1) * devScale))); if (snap) applyZoom(0, true); },
  setK: (k, snap) => { kWant = Math.max(kMin(), Math.min(kMax(), k | 0)); if (snap) applyZoom(0, true); },
  getZoom: () => ({ want: zoomWantOf(), applied: zoomCur, k: kWant, devScale, exact: Math.abs(zoomCur * devScale - Math.round(zoomCur * devScale)) < 1e-6,
    rungs: (() => { const r = []; for (let k = kMin(); k <= kMax(); k++) r.push(+(k / devScale).toFixed(4)); return r; })(),
    wv: [WV_W, WV_H], mm: mmScale() }),
  setSwing: (i, p) => { (p || player).swing = i; },
  getSwing: (p) => (p || player).swing,
  cam: () => ({ x: camX, y: camY }),
  // the day's weather: weather('blizzard') pins one (fading to it like a dawn
  // would; weather() lets the day decide again), wx the dials in force now,
  // weatherOf(day) what a day rolls on this seed
  weather: (name) => { state.wxForce = name && WEATHERS[name] ? name : null; },
  get wx() { return weatherNow(); }, weatherOf,
  startGame, beginIntro, beginLobby, lockIn, pressPlay, cancelCount, setAiLevel, lobbyLayout, AI_LEVELS, AI_ALLIES, aiProfile, setClass, CLASSES, menu: state.menu, menuHit, menuClick, menuKey, lobbyHit,
  // the ESC panel: what the pointer is over, the speaker's plate, the open
  // page's row anchors (already scrolled - a row's y is where it is on
  // screen) and the navbar cells - so a driver can click a dial without
  // guessing at the pitch. setSettingsTab flips the page directly, and
  // ctrlCvs holds the CONTROLS page's three bakes (keys / pad / touch) -
  // blit one scaled to read the weapon primer's pixels without squinting at
  // a 240px page; setCtrlTab picks which listing the page shows.
  settingsHit, muteBtnRect, settingsScrollBy, ctrlCvs,
  setSettingsTab: (id) => { setTab = id; },
  get settingsTab() { return setTab; }, // the open page (a let, so a getter)
  setCtrlTab: (id) => { ctrlTab = id; },
  // the key binds: the action table, the live map, the rebind by hand
  // (setBind swaps exactly as a listening cap would), and keyName - which
  // reads a KeyboardEvent, or a bare {code, key}, the way the listener does,
  // so an AZERTY board can be staged without one. keyRows is where every
  // cap on the CONTROLS page sits, listing-local.
  KEY_ACTIONS, setBind, resetBinds, rebindStart, keyName, keyLabel, keyCap, mendBinds,
  get binds() { return binds(); }, // the live scheme's map
  // the CLICK scheme (input.js): its state, the two presses and the pickers
  ck, ckOn, ckClear, ckRightPress, ckRightRelease, ckArmedPress, ckReach: (p) => ckReach(p || player),
  // the MOUSE scheme (input.js, the `mouse only` banner): its state and presses
  ms, msOn, msWell, msWheelPress, msWheelRelease, pointerPress, pointerRelease,
  ckAcquire: (p) => ckAcquire(p || player), ckSees: (t, p) => ckSees(p || player, t), unitUnder, mmWorldAt,
  // the entry points a pad presses through, and their held state
  keyPress, keyRelease, actHeld, settingsLayout,
  keyRows: () => keyRowsLayout(),
  get settingsRows() {
    const L = settingsLayout();
    const rows = {};
    for (const r of L.rows) rows[r.id] = r.y - L.scroll;
    return { tab: setTab, tabs: L.tabs, rows, scroll: L.scroll, maxScroll: L.maxScroll,
      x: SL_X, w: SL_W, panel: { x: SET_X, y: SET_Y, w: SET_W, h: SET_H } };
  },
  layout: () => ({ VIEW_W, VIEW_H, SET_X, SET_Y, SL_X, PANEL_X, PANEL_Y, MM_CX, MM_CY }),
  hideUI: false,
  // saved matches (js/save.js): the record, the hash the replay proof compares, a slot by hand
  saveCapture, saveApply, saveHash, saveMatch, loadSave, saveList, autoSave,
  step: (dt, n) => { for (let i = 0; i < (n || 1); i++) { update(dt || TICK_DT); } render(); },
};

// ------------------------------------------------------------ the fixed step
// The sim steps in TICK_DT slices, never in the frame's own delta. A frame
// banks its time in `tickAcc` and update() runs once per whole slice owed,
// so a 60 Hz screen steps about once a frame, a 144 Hz screen about every
// other frame, and a stall steps several times in one - and the world's
// clocks, the momentum walk and every cooldown read the same dt on every
// machine whatever the refresh rate. That is what lets a step be numbered
// (state.tick), stamped onto an input and replayed by a host: the
// precondition for online play (docs/pvp-architecture.md). 1/60 because
// that is the step the game was tuned under - TOOL_ROF_STEP counts rate of
// fire in it, and the integrators have only ever seen 16 ms - so the feel
// is the one it had; a coarser network tick is a snapshot cadence, not a
// sim one. render() still runs once per frame, so between steps a frame
// repeats the last sim state (no interpolation yet - a client will need it
// for the snapshot buffer, and it arrives with that).
const TICK_DT = 1 / 60;
// steps one frame may take: three is the old 50 ms dt cap, one slice at a
// time. Past it the rest of the owed time is DROPPED, not banked, so a long
// stall costs a moment of slow motion and never a spiral of catch-up steps
const TICK_MAX = 3;
// a step is owed once the bank is within TICK_SLACK of a whole slice. rAF's
// stamps jitter a ms or two around the refresh, and a bank that had to
// reach the slice exactly would take 0 steps one frame and 2 the next on a
// 60 Hz screen - a visible stutter. Stepping this little early lets the
// bank run slightly negative and settle back, so the AVERAGE rate stays
// exactly 60 and almost every 60 Hz frame takes exactly one step
const TICK_SLACK = TICK_DT * 0.25;
let tickAcc = 0;

// THE DROP'S IN-BETWEEN FRAMES. A screen faster than 60 Hz draws two or
// three frames per step, and without this every one of them repeated the
// last step's camera and bird, so the ride juddered however fast the screen.
// Before each step tweenMark notes where the ride's movers stand; render
// then draws them part of the way from there to where the step put them,
// by how far the clock has got toward the next step (tickAcc), and
// tweenOut puts the sim's own values back before anything else reads them.
// Render-only: no step ever sees an in-between value. The drop alone - the
// camera, both birds and everyone aboard or falling - because it is the one
// scene where the whole screen rides one smooth line; ground play still
// draws each step as it is. A jump bigger than TWEEN_SNAP (the intro's
// cut, a landing) is drawn where it lands, never smeared across it.
const TWEEN_SNAP = 48; // px a mover may cover in one step and still be drawn in between
const tween = { on: false, cx: 0, cy: 0, was: [], now: [] };
function tweenMark() {
  tween.on = state.mode === 'drop' && !!state.drop;
  if (!tween.on) return;
  tween.cx = camX; tween.cy = camY;
  tween.was.length = 0;
  for (const e of state.drop.eagles) tween.was.push(e, e.x, e.y, true);
  for (const p of players) if (p.active && inAir(p)) tween.was.push(p, p.x, p.y, false);
}
function tweenIn() {
  tween.now.length = 0;
  if (!tween.on || state.mode !== 'drop') return;
  // shown a quarter step behind the clock, so a 60 Hz screen, whose frames
  // land about on the steps (TICK_SLACK), always draws at about 0.25
  const a = Math.max(0, Math.min(1, (tickAcc + TICK_SLACK) / TICK_DT));
  const mix = (o, n) => Math.abs(n - o) > TWEEN_SNAP ? n : o + (n - o) * a;
  tween.now.push(null, camX, camY);
  camX = mix(tween.cx, camX); camY = mix(tween.cy, camY);
  const w = tween.was;
  for (let i = 0; i < w.length; i += 4) {
    const b = w[i];
    if (!w[i + 3] && !inAir(b)) continue; // a player who landed this step: drawn where it stands
    tween.now.push(b, b.x, b.y);
    b.x = mix(w[i + 1], b.x); b.y = mix(w[i + 2], b.y);
  }
}
function tweenOut() {
  const n = tween.now;
  for (let i = 0; i < n.length; i += 3) {
    if (n[i] === null) { camX = n[i + 1]; camY = n[i + 2]; }
    else { n[i].x = n[i + 1]; n[i].y = n[i + 2]; }
  }
  n.length = 0;
}

// A HIDDEN TAB does not get animation frames, and its timers are held to a
// beat a second - which is fine for one screen and the end of the match for
// nine others when that screen is the host (docs/pvp-architecture.md, risk
// 3). A worker's clock is not throttled the same way, so while the page is
// hidden the frames come from one, and the visible page goes back to rAF.
let hiddenTimer = null;
function hiddenTick() { if (document.hidden) loop(performance.now()); }
function watchHidden() {
  if (document.hidden && !hiddenTimer) {
    try {
      const w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'], { type: 'text/javascript' })));
      w.onmessage = hiddenTick; hiddenTimer = w;
    } catch (e) { hiddenTimer = setInterval(hiddenTick, 16); }
  } else if (!document.hidden && hiddenTimer) {
    if (hiddenTimer.terminate) hiddenTimer.terminate(); else clearInterval(hiddenTimer);
    hiddenTimer = null;
    last = performance.now();
    requestAnimationFrame(loop);
  }
}
document.addEventListener('visibilitychange', watchHidden);
watchHidden(); // a page opened in a background tab never gets a first frame to arm itself from

// THE FPS CAP. settings.fpsCap (the VIDEO page's FPS CAP row; 0 = every
// frame the screen offers) skips whole frames: a skipped one leaves `last`
// alone, so its time is banked into the next and the sim still takes every
// 1/60 s step it is owed - the cap is on the presentation, never the step.
// `capDue` is when the next frame may run, advanced by one period per frame
// taken so the AVERAGE rate is exactly the cap on any refresh rate (30 on a
// 60 Hz screen is every other frame, not a beat that drifts against it),
// with a quarter period of slack because rAF's stamps jitter; a due clock
// more than a period behind (a stall, a hidden tab) resyncs instead of
// paying itself back as a burst.
let capDue = 0;
function capSkips(nowMs) {
  const cap = settings.fpsCap;
  if (!cap) return false;
  const per = 1000 / cap;
  if (nowMs < capDue - per * 0.25) return true;
  capDue = nowMs - capDue > per ? nowMs + per : capDue + per;
  return false;
}

let last = performance.now();
function loop(nowMs) {
  if (capSkips(nowMs)) {
    if (!document.hidden) requestAnimationFrame(loop);
    else watchHidden();
    return;
  }
  const rawDt = (nowMs - last) / 1000;
  // clamped at BOTH ends: rAF can hand back a stamp behind the clock `last`
  // was taken off (a headless first frame, a tab restored from the bfcache),
  // and a negative dt would run the bank backwards. Capped above for the
  // opposite reason: a long stall (a hidden tab, a debugger) must not owe
  // seconds of steps
  const dt = Math.max(0, Math.min(TICK_DT * TICK_MAX, rawDt));
  last = nowMs;
  perf.frames++;
  perf.acc += rawDt;
  if (perf.acc >= 0.5) {
    perf.fps = Math.round(perf.frames / perf.acc);
    perf.frames = 0;
    perf.acc = 0;
  }
  if (!window.DBG.freeze) {
    padPoll(dt);   // the sticks have no events: read them once a frame, before the steps
    tickAcc += dt;
    let n = 0;
    while (tickAcc >= TICK_DT - TICK_SLACK && n < TICK_MAX) {
      tweenMark();
      update(TICK_DT);
      tickAcc -= TICK_DT;
      n++;
    }
    if (n === TICK_MAX && tickAcc > 0) tickAcc = 0; // the stall's remainder is dropped, not owed
    tweenIn();
    try { render(); } finally { tweenOut(); } // the sim's values back, whatever render does
    saveAutoTick(); // a timed autosave, off the match clock (js/save.js)
  }
  if (!document.hidden) requestAnimationFrame(loop); // hidden: the worker calls loop() instead
  else watchHidden();
}
requestAnimationFrame(loop);
