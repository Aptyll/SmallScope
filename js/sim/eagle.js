'use strict';
// The eagle drop that opens every match, and the eagles themselves: the
// route, the ride, the landing, the hop off, and the bird each side guards.
// ------------------------------------------------------------ eagle drop
// Nobody spawns in a camp: after PLAY's count each TEAM rides its own armoured
// eagle in over its OWN corner - RED's bottom-left, BLUE's top-right, every
// match and every seed - a short glide down the road's diagonal from the
// corner and a stoop into the trees at its base's PERCH (mode 'drop': the
// bases, js/sim/base.js). Everybody rides the landing: the bird dives with
// the whole side on its back, the crash hands the mode over (landAboard), and
// each rider hops off at the perch - a bot on its own beat after the wings
// fold, a human with E (or the roll button - a pad's A, or simply walking:
// hopOff, under the HOP OFF indicator drawHopPrompt raises, which wears the
// button of the controller in hand). A profile's first ride sits through the
// drop brief before the hop - both roosts toured with you still seated - and
// never again once it has hopped off.
// state.drop outlives mode 'drop' - and the whole match: the bird blows a
// crater at the perch, its MERCHANT (the driver on its neck - the `merchant`
// banner, js/sim/robots.js) hops off to fell its back woods and raise the bot
// bays, and the bird sits there as its team's OBJECTIVE, the road running
// out from under it - guarding itself with a wing gust and calming back
// down (preen regen) between scares. Keep its nerve up: at zero the bird is
// DRIVEN OFF (hurtEagle / eagleFlee), and its whole side falls with it.
                            // the ride's framing is DROP_ZOOM (canvas banner): half scale, twice the view
const EAGLE_FLIGHT_T = 2.5; // s the glide in takes (speed derives from the line's length)
const EAGLE_FROM_U = 3;     // u from its own corner the line starts: at the corner, every wing seat still on the map
const EAGLE_STOOP_U = 9;    // u short of the perch the line ends and the stoop onto it begins
const BOT_HOP_T = 0.8;      // s after the crash the first bot hops off the grounded bird...
const BOT_HOP_GAP = 0.3;    // ...and the gap to the next, by seat
const HOP_FALL_T = 0.7;     // s the hop off a GROUNDED bird takes (a step down, not a free fall)...
const HOP_ALT = 16;         // ...from this many px up
const HOP_GAP = 6;          // px kept clear between the HOP OFF key and your name tag under it
// the DROP BRIEF: a profile's first ride sits through a camera tour before
// the hop: a beat on the crash you are sitting in, then across the map to
// the RIVAL roost with the win condition, then home to finish on YOUR OWN
// roost with the lose condition - the last thing said is where you are - and
// the E - HOP OFF indicator takes over. Once a profile has hopped off a bird
// (PROFILE.markDropped) the brief never runs again.
const BRIEF_WAIT = 1;       // s the camera stays on the crash before it leaves
const BRIEF_HOLD = 3;       // s it holds on the rival roost
const BRIEF_HOLD_OURS = 4;  // s it holds on your own to finish
const BRIEF_GO_MIN = 1;     // s a glide leg lasts at least, however close the target
const BRIEF_MAX_T = 24;     // s the whole tour may run before it force-ends (safety)
const BRIEF_TEXT = 4;        // the headline's scale, times the drop HUD's text scale (drawDropBrief)
const BRIEF_RIM = 2;         // px of dark rim round it: the roost is pines edge to edge, and no plate
const BRIEF_Y = 0.72;        // where its top sits, as a share of the view's height: under the bird
// the WIND TRAIL: the air the bird tears in level flight - ONE continuous
// ribbon off each wingtip, laid along the flown line where the tip actually
// was and fading out toward its tail (drawEagleTrail - pure reads of the
// flight clock, no particles)
const TRAIL_T = 1.1;        // s of flight a ribbon reaches back
const TRAIL_STEP = 6;       // px between the ribbon's samples along the line
const TRAIL_RIM = 'rgba(40,60,100,0.6)'; // the dark line under the ribbon: white air over white snow needs a rim, like the text does
const DRIFT_SPD = 130;      // px/s a body stepping off the bird steers sideways with WASD
const DROP_ALT = 56;        // screen px between the bird / a faller and its shadow
const EAGLE_SCALE = 3;      // the bird is huge and high above the ground: drawn at 3x in flight
const EAGLE_REST_SCALE = 2; // ...settling to 2x once it roosts (the dive walks 3 down to 2)
// the riders are WORLD-SIZED: 1x on the roosting bird, and in flight exactly
// as much bigger as the bird itself is for being nearer the camera (3/2), so
// a body never changes size against the feathers under it - riderScale(e)
const EAGLE_BEAT_HZ = 1;      // wingbeats a second in level flight (one stroke of Perch's)
const EAGLE_DIVE_T = 1.4;   // seconds from the end of the line to the impact on the perch
const EAGLE_SETTLE_T = 0.6; // seconds of wing-fold after the impact, into the resting pose
// The grounded objective's NERVE: hits spook it, at zero it flees. Sized as a
// siege now that bots go for it (the ai's objective rung): a lone warrior's
// E swings (three a second, so EAGLE_WORK_DMG is a hundred of them) take a
// minute or more under the gust, a pair half that, and an arrow only ever
// spooks it EAGLE_ARROW_DMG whatever the draw, so archers standing off it
// outside the gust take minutes - long enough either way for the side to
// answer the hit (the two birds, ai.js). At 60 a swing two warriors emptied the
// nerve in the fifty seconds between two harness marks, before anyone came
const EAGLE_HP = 2000;
const PERCH_BAR_W = 95;   // px: the roost's hp bar, the match's win/lose bar...
const PERCH_BAR_H = 9;    // ...its height, room for the pool's number inside...
const PERCH_BAR_SEGS = 8; // ...and its blocks: (PERCH_BAR_W + 1) must divide by this
const PERCH_BAR_RIM = 2;  // its ink frame, twice a body's
const PERCH_LAG_HOLD = 0.35, PERCH_LAG_RATE = 900; // s a hit's lost chunk holds pale, then hp/s it drains at
const EAGLE_WORK_DMG = 20;  // what one rival E swing chips off the roosting bird
const EAGLE_ARROW_DMG = 12; // what one rival arrow chips, whatever it would do to a body
const EAGLE_TILE_R = 1.6;   // tiles around the roost marked solid - the hitbox arrows AND walkers test
// ...and the one thing in the game that shouts from off screen: seconds
// between two "YOUR BIRD IS BEING STRUCK" alarms (SFX.alarm, hurtEagle). A
// siege is a hundred blows and one piece of news, and the news is worth
// hearing again only about as often as a side can answer it.
const EAGLE_WARN_GAP = 9;
// the wing gust: the bird's own defense. A rival inside GUST_R makes it rear
// up - wings spread for GUST_WIND_T, the whole telegraph - then the buffet
// throws every rival in GUST_BLAST_R into a tumble. No damage on purpose: the
// objective punishes face-tanking, it never earns kills.
// GUST_R has to cover the E reach: the roost's hitbox is the 3x3 round the
// bird (EAGLE_TILE_R) and WORK_REACH lets an axe land from the next tile out,
// whose far corner is ~57 px from the bird - at 44 a rival stood there and
// drove the bird off unbuffeted (2.62's playtest, 24 s of E and not one gust)
const GUST_R = 64;          // px: how close a rival can stand before the bird rears
const GUST_BLAST_R = 76;    // px: the buffet itself reaches a little further
const GUST_WIND_T = 0.5;    // s of wings-spread windup before the blast
const GUST_CD = 4;          // s between gusts
const GUST_KB = 300;        // knockback impulse (px/s)
const GUST_STUN = 0.7;      // s of tumble
const PREEN_DELAY = 6;      // s unhit before the bird starts calming down...
const PREEN_RATE = 8;       // ...recovering this much nerve per second
const FLEE_LIFT_T = 1.1;    // s of takeoff: turn away, climb, downdraft
const FLEE_T = 5.5;         // s total from liftoff to gone (fading over the last stretch)
const FLEE_SPD = 220;       // px/s once airborne - faster than it arrived, it wants out
const EAGLE_CINE_T = 3.2;   // s the camera holds the takeoff before the end screens queue
const RUFFLE_T = 0.45;      // s of the resting idle's wing shuffle (frame 1 only - a full
                            // spread is the gust telegraph, and the idle must never wear it)
const BOOM_R = 3.6;         // tiles of trees the impact clears outright - and paves: the roost stands on packed earth, one ground with the road it ends (the pad, addPad)
const BOOM_STUMP_R = 4.8;   // ...the MIDDLE ring beyond snapped to stumps: build sites round the bird...
const BOOM_STUMP_R2 = 6.0;  // ...and the OUTER ring beyond that - two layers, so a side can stand guns inside a wall
const BOOM_LIFE = 0.9;      // seconds the impact shockwave rings run
// where the five riders sit, in the bird's own frame (x along the heading,
// y across the wings, unscaled sprite px): one on its back, two on the inner
// wings, two out on the primaries - where Perch's spread wing is
// (SPRITES.perch.seat), so a rider who hops off leaves from where it was drawn.
// Seat 0 is the roster's first player per team - the human, on their own bird.
const EAGLE_SEATS = [[-2, 0], [2, -11], [2, 11], [0, -15.5], [0, 15.5]];

// the flown line at fraction u: where the bird is and which way it points.
// The sim flies it (updateEagle).
function eaglePathAt(e, u) {
  return { x: e.x0 + (e.x1 - e.x0) * u, y: e.y0 + (e.y1 - e.y0) * u, h: Math.atan2(e.y1 - e.y0, e.x1 - e.x0) };
}

// a bird per team, each on its own short line: from its own corner down the
// road's diagonal to EAGLE_STOOP_U short of its perch (basePerch,
// js/sim/base.js), where it stoops onto the perch (beginDive). Fixed: the
// same line every match and every seed.
function makeEagles() {
  return [0, 1].map((team) => {
    const n = basePerch(team), dir = team === 0 ? 1 : -1; // dir: u toward the field
    const a = roadPoint(baseU(team, EAGLE_FROM_U)), b = roadPoint(n.u - dir * EAGLE_STOOP_U);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const e = {
      team, heading: Math.atan2(b.y - a.y, b.x - a.x), len, dur: EAGLE_FLIGHT_T, spd: len / EAGLE_FLIGHT_T,
      x0: a.x, y0: a.y, x1: b.x, y1: b.y, x: a.x, y: a.y,
      t: 0, prog: 0, flap: team * 0.4,
      state: 'fly',                 // fly -> dive -> down (the objective) -> flee -> gone
      diveT: 0, from: null, crash: null, restT: 0,
      hp: EAGLE_HP, maxHp: EAGLE_HP, flash: 0, boomT: 0,
      gustCd: 0, windT: 0, hitT: 99,          // the wing gust and the calm-down clock
      idleT: 3 + team * 2, ruffleT: 0,        // the resting idle: seconds to the next wing shuffle (offset so the birds never sync)
      fleeT: 0, fleeFrom: 0, fleeTo: 0,       // the driven-off takeoff
      mouth: { x: roadNest(team).x, y: roadNest(team).y }, // its JUNCTION on the road (roadNest, world.js): where the road leaves the base, the way in for every walker
      laneDir: null,                          // the unit direction from the roost up the road, set at the crash (eagleCrash) - the merchant's bearings read it
      pad: null,                              // the crater's road registry entry (addPad, world.js)
      merchant: null,                         // the driver once it is down (robots.js)
    };
    return e;
  });
}

// the bird's drawn scale right now: 3x in flight, walking down to the roost's
// 2x through the dive (drawEagle's own curve), 2x on the ground
function eagleScale(e) {
  if (e.state === 'fly') return EAGLE_SCALE;
  if (e.state === 'dive') { const u = Math.min(1, e.diveT / EAGLE_DIVE_T); return EAGLE_SCALE - (EAGLE_SCALE - EAGLE_REST_SCALE) * u * u; }
  return EAGLE_REST_SCALE;
}
// how big a body on the bird draws: the bird's own perspective, 1x at rest
function riderScale(e) { return eagleScale(e) / EAGLE_REST_SCALE; }
// which way a rider on the bird faces: the heading's dominant axis, so a
// crew flying down-left shows its profiles and one flying up its backs -
// bodies ride a bird the way it points, they are not stuck on facing you
function riderDir(e) {
  const c = Math.cos(e.heading), s = Math.sin(e.heading);
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
// a seat's world position on a bird right now: the seat offset rotated by the
// heading, off the bird's centre, at the bird's current scale
function seatPos(e, si) {
  const s = EAGLE_SEATS[si % EAGLE_SEATS.length];
  const S = eagleScale(e);
  const dx = s[0] * S, dy = s[1] * S;
  const c = Math.cos(e.heading), sn = Math.sin(e.heading);
  return { x: e.x + dx * c - dy * sn, y: e.y + dx * sn + dy * c };
}

function beginDrop() {
  PROFILE.addDay(); // day 1 of the days-played stat: the clock starts with the eagle
  PROFILE.addMatch(); // ...and the profile's matches: one per takeoff
  // a profile's first ride sits through the drop brief before its hop
  state.drop = { eagles: makeEagles(), firstFlight: !PROFILE.hasDropped() };
  const seats = [0, 0]; // next free wing seat per team, dealt in slot order - the first slot of each side sits at seat 0
  for (const p of players) {
    if (!p.active) continue;
    const e = state.drop.eagles[p.team];
    p.aboard = true; p.dropT = 0;
    p.seat = seats[p.team]++;
    const sp = seatPos(e, p.seat);
    p.x = sp.x; p.y = sp.y;
  }
  state.mode = 'drop';
  state.menu.panel = null;
  state.menu.screen = 'menu';
  netHostRoom(); // the relay's list: this room is live now
  // the OPENING SHOT: the ride opens tight on your own seat (DROP_OPEN_ZOOM,
  // snapped under the menu's cross-fade) and pulls out to the ride's framing
  // over INTRO_T, the camera held on you the whole way (the drop branch of
  // the camera, js/sim/sim.js; the zoom's curve: applyZoom)
  state.introFrom = { x: camX, y: camY };
  state.intro = INTRO_T; state.introLen = INTRO_T;
  applyZoom(0, true);
  camX = Math.max(0, Math.min(WORLD * TILE - WV_W, player.x - WV_W / 2)); // inside the world: the bird starts at its corner
  camY = Math.max(0, Math.min(WORLD * TILE - WV_H, player.y - WV_H / 2));
  SFX.dawnChime();
  SFX.music.play('eagle');
}

// touchdown: the nearest open tile to the hop's landing becomes the player's
// position and its spawn tile
function landPlayer(p) {
  const ftx = Math.floor(p.x / TILE), fty = Math.floor(p.y / TILE);
  let best = null;
  for (let r = 0; r <= 80 && !best; r++) {
    let bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = ftx + dx, ty = fty + dy;
      if (!inWorld(tx, ty) || objAt(tx, ty) || waterAt(tx, ty) || cisternBlocks(tx, ty)) continue;
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
    state.shake = 5;
    SFX.land();
  } else {
    addFloater(p.x, p.y - 20, p.name + ' LANDED', TEAMS[skin(p.team)].mark);
  }
}

// mode 'drop' -> 'play' for the local player, still on the bird's back at
// the crash (landAboard)
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

// the crash with the local player aboard: the ride's song is interrupted by
// the impact, play begins with you seated on the roost, and a first ride's
// brief opens - the E hop comes after it (updateDrop)
function landAboard(p) {
  handOver(p);
  state.shake = 9;
  state.rayT = RAY_AFTER;
  SFX.music.play('jump', { out: 0.1, in: 0.05 });
  if (state.drop.firstFlight) state.dropBrief = { ph: 'wait', t: 0, total: 0 };
}

// off the grounded bird: a step down off the wing - short, low, steerable
// like any fall - and the drop brief never comes back after it. The local
// player waits out its own brief first.
function hopOff(p) {
  if (!p.aboard || !state.drop || (p === player && state.dropBrief)) return;
  const e = state.drop.eagles[p.team];
  if (e.state !== 'down') return;
  p.aboard = false;
  p.dropT = HOP_FALL_T; p.dropAlt = HOP_ALT; p.dropSc = 1;
  if (p === player) PROFILE.markDropped();
  sfxFor(p, 'dodge');
}

function updateDrop(dt) {
  // the driven-off ceremony: hold on the takeoff, then let the screens come
  const cine = state.eagleCine;
  if (cine) {
    cine.t += dt;
    if (cine.t >= EAGLE_CINE_T) {
      state.eagleCine = null; // cleared first, so the resolve's endMatch path runs clean
      eagleFleeResolve(state.drop.eagles[cine.team], cine.srcId >= 0 ? players[cine.srcId] : null);
    }
  }
  for (const e of state.drop.eagles) updateEagle(e, dt);
  // the drop brief: the roost tour a forced landing opened on. The match runs
  // on underneath - only the local camera and controls are spoken for
  // (sampleHumanInput zeroes them, the camera branch in js/sim/sim.js follows
  // dropBriefTarget) - and the landing grace holds until the hand-back, so
  // nobody dies watching the lesson. Each glide leg ends when the camera has
  // arrived AND the bird it is looking at is down (a first flight catches the
  // dive mid-air; a veteran dropped at the window's end finds it landed).
  const brief = state.dropBrief;
  if (brief) {
    if (state.mode !== 'play' || state.eagleCine) endBrief(); // the ceremony (or a death) outranks the lesson
    else {
      brief.t += dt; brief.total += dt;
      player.invuln = Math.max(player.invuln, 0.4);
      const tgt = dropBriefTarget();
      const near = Math.hypot(tgt.x - WV_W / 2 - camX, tgt.y - WV_H / 2 - camY) < 24;
      const birdDown = (t) => { const e = state.drop.eagles[t]; return e.state !== 'fly' && e.state !== 'dive'; };
      const step = (ph) => { brief.ph = ph; brief.t = 0; };
      if (brief.total > BRIEF_MAX_T) endBrief();
      else if (brief.ph === 'wait') { if (brief.t > BRIEF_WAIT) step('theirs-go'); }
      else if (brief.ph === 'theirs-go') { if (near && brief.t > BRIEF_GO_MIN && birdDown(1 - player.team)) step('theirs'); }
      else if (brief.ph === 'theirs') { if (brief.t > BRIEF_HOLD) step('ours-go'); }
      else if (brief.ph === 'ours-go') { if (near && brief.t > BRIEF_GO_MIN && birdDown(player.team)) step('ours'); }
      else if (brief.t > BRIEF_HOLD_OURS) endBrief(); // 'ours': the finish, on the roost you are sitting on
    }
  }
  for (const p of players) {
    if (!p.active) continue;
    if (p.aboard) {
      const e = state.drop.eagles[p.team];
      const sp = seatPos(e, p.seat);
      p.x = sp.x; p.y = sp.y;
      if (e.state !== 'down') { /* still riding in */ }
      else if (!isHuman(p)) { if (e.restT >= BOT_HOP_T + p.seat * BOT_HOP_GAP) hopOff(p); } // the bots step off one by one once the wings fold
      else if ((p !== player || state.mode === 'play') && (p.input.work || p.input.dodge || p.input.mx || p.input.my)) hopOff(p); // E, the roll button (a pad's A) or simply walking: off the roost
      p.input.dodge = false; // a seated roll is spent here, never carried into the landing
    } else if (p.dropT > 0) {
      p.dropT -= dt;
      // steer the fall: the input axis drifts the landing point
      const dm = Math.hypot(p.input.mx, p.input.my);
      if (dm > 0) {
        p.x = Math.max(TILE, Math.min(WORLD * TILE - TILE, p.x + p.input.mx / dm * DRIFT_SPD * dt));
        p.y = Math.max(TILE, Math.min(WORLD * TILE - TILE, p.y + p.input.my / dm * DRIFT_SPD * dt));
      }
      if (p.dropT <= 0) landPlayer(p);
    }
  }
}

// one bird's whole life: the flight, the dive past the line's end, and the
// grounded objective it becomes. state.drop never goes null - the wrecks ARE
// the match now.
function updateEagle(e, dt) {
  e.flap += dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.boomT > 0) e.boomT -= dt;
  if (e.state === 'fly') {
    e.t += dt;
    const dist = Math.min(e.spd * e.t, e.len);
    e.prog = Math.min(1, dist / e.len);
    const at = eaglePathAt(e, e.prog);
    e.x = at.x; e.y = at.y;
    if (e.prog >= 1) beginDive(e);
  } else if (e.state === 'dive') {
    e.diveT += dt;
    const u = Math.min(1, e.diveT / EAGLE_DIVE_T);
    e.x = e.from.x + (e.crash.x - e.from.x) * u;
    e.y = e.from.y + (e.crash.y - e.from.y) * u;
    // the BANK: the head comes round from the line's heading to the stoop's
    // own bearing over the first part of the dive, so the turn off the road
    // into the nest's woods reads as a turn
    e.heading = e.diveH0 + e.diveTurn * Math.min(1, u * 1.8);
    // speed motes stream off the stoop
    particles.push({
      x: e.x - Math.cos(e.heading) * rand(14, 26), y: e.y - Math.sin(e.heading) * rand(14, 26),
      vx: -Math.cos(e.heading) * 30, vy: -Math.sin(e.heading) * 30,
      life: 0.3, maxLife: 0.3, color: '#f4f7ff', size: 1, grav: 0, alpha: 0.5,
    });
    if (u >= 1) eagleCrash(e);
  } else if (e.state === 'down') {
    e.restT += dt; // drives the wing-fold settle, then the breathing at rest
    // preen: unbothered for PREEN_DELAY, the bird calms back down - the bar
    // visibly refilling is the whole announcement, so chip damage must be
    // pressed home or it evaporates
    e.hitT += dt;
    if (e.hitT > PREEN_DELAY && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + PREEN_RATE * dt);
      if (rng() < dt * 2) particles.push({
        x: e.x + rand(-10, 10), y: e.y + rand(-8, 2),
        vx: rand(-3, 3), vy: -rand(6, 12),
        life: 0.7, maxLife: 0.7, color: '#f6f8ff', size: 1, grav: -4, alpha: 0.6,
      });
    }
    // the resting idle: every few seconds the bird shuffles its wings and a
    // little snow settles off them - alive between scares, never mistakable
    // for the gust telegraph (drawEagle keeps the shuffle off the spread frame)
    if (e.ruffleT > 0) e.ruffleT -= dt;
    else if (e.restT > EAGLE_SETTLE_T && e.windT <= 0) {
      e.idleT -= dt;
      if (e.idleT <= 0) {
        e.idleT = rand(3.5, 7);
        e.ruffleT = RUFFLE_T;
        for (let i = 0; i < 3; i++) particles.push({
          x: e.x + rand(-14, 14), y: e.y + rand(-9, 3),
          vx: rand(-8, 8), vy: rand(4, 14),
          life: 0.5, maxLife: 0.5, color: '#eef4fb', size: 1, grav: 40, alpha: 0.7,
        });
      }
    }
    // the wing gust, once it has finished settling in
    if (e.windT > 0) {
      e.windT -= dt;
      if (e.windT <= 0) eagleGust(e);
    } else if (e.gustCd > 0) e.gustCd -= dt;
    else if (e.restT > EAGLE_SETTLE_T) {
      for (const q of players) {
        if (!q.active || q.dead || inAir(q) || q.team === e.team) continue;
        if (Math.hypot(q.x - e.x, q.y - e.y) < seenAt(q, GUST_R)) { e.windT = GUST_WIND_T; break; }
      }
      // a rival wave's soldier at its feet rears it the same (robots.js)
      if (e.windT <= 0) for (const b of robots) {
        if (!unitAlive(b) || b.team === e.team) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) < GUST_R) { e.windT = GUST_WIND_T; break; }
      }
    }
  } else if (e.state === 'flee') {
    e.fleeT += dt;
    const u = Math.min(1, e.fleeT / FLEE_LIFT_T);
    // the takeoff turn: from however the dive left it pointing, around to the
    // nearest treeline (away from the world's centre), shortest way round
    let turn = e.fleeTo - e.fleeFrom;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    e.heading = e.fleeFrom + turn * u;
    // downdraft while the wings are winning: snow blown out under the climb
    if (u < 1 && rng() < dt * 20) {
      const a = rng() * Math.PI * 2;
      particles.push({
        x: e.x + Math.cos(a) * 8, y: e.y + Math.sin(a) * 5,
        vx: Math.cos(a) * rand(60, 110), vy: Math.sin(a) * rand(40, 70),
        life: 0.4, maxLife: 0.4, color: '#eef4fb', size: 2, grav: 60,
      });
    }
    if (u >= 1) {
      e.x += Math.cos(e.heading) * FLEE_SPD * dt;
      e.y += Math.sin(e.heading) * FLEE_SPD * dt;
    }
    if (e.fleeT >= FLEE_T) e.state = 'gone';
  }
}

// the buffet lands: every rival in the ring is thrown into a tumble and blown
// out of the snow if they were under it. No damage - the tumble IS the price.
function eagleGust(e) {
  e.gustCd = GUST_CD;
  eagleGustFx(e, 1);
  sfxAt('gust', e.x, e.y);
  for (const q of players) {
    if (!q.active || q.dead || inAir(q) || q.team === e.team) continue;
    const dx = q.x - e.x, dy = q.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > GUST_BLAST_R) continue;
    const nx = d > 0 ? dx / d : 1, ny = d > 0 ? dy / d : 0;
    q.kbx = nx * GUST_KB; q.kby = ny * GUST_KB;
    stunUnit(q, GUST_STUN);
    risePlayer(q); // wind strips the snow off a buried body
    burst(q.x, q.y - 6, '#eef4fb', 6, 50, 0.4, true);
  }
  // a wave's soldiers at its feet take the same buffet (the `soldiers`
  // banner, robots.js): the bird defends its ground against every body alike
  for (const b of robots) {
    if (!unitAlive(b) || b.team === e.team) continue;
    const dx = b.x - e.x, dy = b.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > GUST_BLAST_R) continue;
    const nx = d > 0 ? dx / d : 1, ny = d > 0 ? dy / d : 0;
    b.kbx = nx * GUST_KB; b.kby = ny * GUST_KB;
    stunUnit(b, GUST_STUN);
    burst(b.x, b.y - 4, '#eef4fb', 5, 45, 0.4, true);
  }
}

// the gust's language, shared with the takeoff (k scales it): a low ring of
// blown snow and a flattened shockwave, feathers drifting up after
function eagleGustFx(e, k) {
  e.boomT = Math.min(BOOM_LIFE, BOOM_LIFE * 0.6 * k);
  const n = Math.round(16 * k);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    particles.push({
      x: e.x + Math.cos(a) * 8, y: e.y - 2 + Math.sin(a) * 5,
      vx: Math.cos(a) * (80 + rng() * 40) * k, vy: Math.sin(a) * (50 + rng() * 25) * k,
      life: 0.45, maxLife: 0.45, color: '#e8eef8', size: 2, grav: 55,
    });
  }
  burst(e.x, e.y - 10, '#f6f8ff', Math.round(5 * k), 40, 0.9, true);
}

// the end of the line: the bird stoops onto its perch (findCrashPoint) with
// its whole side aboard, the head coming round onto the stoop's bearing
function beginDive(e) {
  e.state = 'dive';
  e.from = { x: e.x, y: e.y };
  e.crash = findCrashPoint(e);
  e.diveT = 0;
  // the turn: from the line's heading to the crash's bearing, the short way round
  let turn = Math.atan2(e.crash.y - e.y, e.crash.x - e.x) - e.heading;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  e.diveH0 = e.heading; e.diveTurn = turn;
}

// the crash lands on the side's PERCH, the back of its base (roadNest's
// nest: basePerch, js/sim/base.js) - fixed, so the same spot every match and
// every seed, and the cables (placeZips) are laid knowing it
function findCrashPoint(e) {
  const n = roadNest(e.team);
  return { x: (n.nx + 0.5) * TILE, y: (n.ny + 0.5) * TILE };
}

// impact: the near trees are blown apart outright, the ring beyond snapped to
// stumps, and the bird is DOWN - a grounded objective with an hp pool its
// team keeps alive from here on. The blast pays no gold: a crater full of
// free fells would warp the economy at minute one.
function eagleCrash(e) {
  e.state = 'down';
  e.restT = 0;
  e.x = e.crash.x; e.y = e.crash.y;
  const ctx0 = Math.floor(e.x / TILE), cty0 = Math.floor(e.y / TILE);
  const R = Math.ceil(BOOM_STUMP_R2);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const tx = ctx0 + dx, ty = cty0 + dy;
    if (!inWorld(tx, ty) || Math.hypot(dx, dy) > BOOM_STUMP_R2) continue;
    const o = objAt(tx, ty);
    if (!o) continue;
    const ox = tx * TILE + 8, oy = ty * TILE + 8;
    const so = structOf(o); // a rock's east tile is the rock
    if (so.type === 'rock' || so.type === 'bush') { // shattered or flattened outright, out to the outer ring: a rock in the wall's band would leave a hole in it
      fellScenery(tx, ty);
      burst(ox, oy - 6, so.type === 'rock' ? '#9aa4b4' : '#88b090', 6, 50, 0.45, true);
      continue;
    }
    if (o.type !== 'tree' && o.type !== 'deadTree') continue;
    objects[idx(tx, ty)] = Math.hypot(dx, dy) <= BOOM_R ? null : { type: 'stump', tx, ty, flash: 0, shake: 0 };
    burst(ox, oy - 8, '#eef4fb', 8, 70, 0.6, true);
    burst(ox, oy - 8, o.type === 'tree' ? '#2f5c4b' : '#6b5a48', 5, 60, 0.55, true);
    burst(ox, oy - 6, '#6b5a48', 4, 55, 0.5, true);
  }
  // the roost's hitbox: `eagle` objects on the tiles under the bird - solid
  // to walkers, a work target for rival E swings (their OBJECTS entry), and
  // drawn by drawEagle, never the object pass. Anything the blast didn't
  // clear (a rock) keeps its tile.
  const TR = Math.ceil(EAGLE_TILE_R);
  for (let dy = -TR; dy <= TR; dy++) for (let dx = -TR; dx <= TR; dx++) {
    const tx = ctx0 + dx, ty = cty0 + dy;
    if (!inWorld(tx, ty) || Math.hypot(dx, dy) > EAGLE_TILE_R) continue;
    if (!objAt(tx, ty) && !waterAt(tx, ty)) placeObj(tx, ty, 'eagle', { team: e.team });
  }
  eagleBoomFx(e, 1);
  // felt everywhere, hardest close by: three rings, the widest reaching every screen
  shakeAt(e.x, e.y, 3, EV_ANYWHERE); shakeAt(e.x, e.y, 5, 1000); shakeAt(e.x, e.y, 9, 400);
  sfxAt('boom', e.x, e.y, EV_ANYWHERE);
  logEvent('THE ' + TEAMS[skin(e.team)].name + ' EAGLE HAS LANDED', players.find((p) => p.team === e.team));
  // the way out is the road: from the roost up it to the junction (e.mouth),
  // the bearing the merchant's work reads; the driver climbs down
  const mx = e.mouth.x - e.x, my = e.mouth.y - e.y, ml = Math.hypot(mx, my);
  e.laneDir = ml > TILE ? { x: mx / ml, y: my / ml } : { x: -Math.cos(e.heading), y: -Math.sin(e.heading) };
  // the pad: the blown disc is packed earth from this frame - one ground
  // with the road it lands on - so its tiles turn to 3 at
  // once and the ground repaints out to the verge (a one-time cost, under
  // the shake and the boom)
  e.pad = addPad(e.team, e.x / TILE - 0.5, e.y / TILE - 0.5, BOOM_R);
  {
    const g = groundCv.getContext('2d'), PR = Math.ceil(BOOM_R) + 3;
    g.imageSmoothingEnabled = false;
    for (let dy = -PR; dy <= PR; dy++) for (let dx = -PR; dx <= PR; dx++) {
      const tx = ctx0 + dx, ty = cty0 + dy;
      if (!inWorld(tx, ty)) continue;
      if (ground[idx(tx, ty)] === 0 && laneDist(tx, ty) < 0) ground[idx(tx, ty)] = 3;
      paintGroundTile(g, tx, ty);
    }
  }
  spawnMerchant(e);
  for (const p of players) if (p.active && p.aboard && p.team === e.team && p === player) landAboard(p);
}

// what the road's furniture and the cables may stand on in place of: a pine,
// a snag or a rock gives way (a rock's east tile is the rock)
function laneFells(o) { o = structOf(o); return !!o && (o.type === 'tree' || o.type === 'deadTree' || o.type === 'rock'); }

// the impact language, shared by the landing and the loss (k scales it up):
// snow thrown high, the team's colours in it, feathers left hanging, and a
// low dust ring rolling out along the ground under the shockwave rings.
function eagleBoomFx(e, k) {
  e.boomT = BOOM_LIFE;
  burst(e.x, e.y - 6, '#f4f7ff', Math.round(26 * k), 110 * k, 0.7, true);
  burst(e.x, e.y - 6, TEAMS[skin(e.team)].mark, Math.round(14 * k), 90 * k, 0.6);
  burst(e.x, e.y - 12, '#f6f8ff', Math.round(10 * k), 40, 1.1, true);
  const n = Math.round(26 * k);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    particles.push({
      x: e.x + Math.cos(a) * 6, y: e.y - 2 + Math.sin(a) * 4,
      vx: Math.cos(a) * (70 + rng() * 50) * k, vy: Math.sin(a) * (44 + rng() * 30) * k,
      life: 0.55, maxLife: 0.55, color: '#dfe7f4', size: 2, grav: 60,
    });
  }
}

// a rival's arrow or E swing into the grounded bird. hx/hy is where the hit
// landed (an arrow into a wingtip puffs at the wingtip, not the body's centre);
// callers with no better point omit them.
function hurtEagle(e, dmg, src, hx, hy) {
  if (e.state !== 'down' || state.eagleCine) return; // the ceremony has the match: no second flee under it
  // the objective damage the post-game lobby prints (js/ui/lobby.js), capped
  // at the nerve there actually was to take - a bird cannot lose more than it has
  if (src instanceof Player) src.dmgBird += Math.min(dmg, Math.max(0, e.hp));
  e.hp -= dmg;
  storyBirdHit(e); // the match story (js/ui/story.js): the bird's worst moment and who stood by it
  e.hitT = 0; // frightened again: the calm-down clock starts over
  e.flash = 0.12;
  const px = hx === undefined ? e.x : hx, py = (hy === undefined ? e.y : hy) - 8;
  burst(px, py, '#f6f8ff', 5, 45, 0.5, true);
  burst(px, py, TEAMS[skin(e.team)].mark, 3, 40, 0.4);
  // WITHIN EARSHOT it is the bird's own voice - it had been using hurt(), the
  // man's winded oof, so the objective the whole match is about sounded like
  // somebody being punched. OUT OF EARSHOT, and only for YOUR OWN bird, it is
  // a warning instead: the roost is the one thing you must defend that you
  // cannot see from where you fight, and the minimap only says so if you
  // happen to be looking at it. One alarm per EAGLE_WARN_GAP, never both cues
  // at once - standing there, the blow IS the news.
  sfxAt('bigHurt', e.x, e.y);
  if (!nearPlayer(e.x, e.y) && player && e.team === player.team && !player.eliminated
      && state.elapsed - (e.warnT === undefined ? -99 : e.warnT) >= EAGLE_WARN_GAP) {
    e.warnT = state.elapsed;
    // ...and the news arrives where the other things you glance at mid-fight
    // do: a plate top-right under the minimap, on the market's own grammar
    // (the `notices` banner, js/ui/shop.js) - your side's bird diamond, the
    // NERVE it has left as a number, and the falling tail. The cue turns your
    // head and the plate says what happened, which is the market's split too;
    // the feed line goes with it, since the log is the match's record.
    logEvent('YOUR EAGLE IS UNDER ATTACK', null, NOTE_KIND.roost);
    raiseNotice('roost', Math.round(Math.max(0, e.hp) / e.maxHp * 100) + '%', null);
    SFX.alarm();
  }
  if (e.hp <= 0) eagleFlee(e, src);
}

// the objective's nerve breaks: the bird is DRIVEN OFF, not killed. It blasts
// a takeoff downdraft, turns for the treeline and flies - and liftoff starts
// the DRIVEN-OFF CEREMONY (state.eagleCine): every camera glides to this bird
// (the camera banner in js/sim/sim.js), the local controls go dead (input.js),
// and the takeoff plays for EAGLE_CINE_T before eagleFleeResolve puts the
// side down and queues the victory or defeat screen. League-style: watch the
// nexus fall, then read the word. `line` is the feed's word for why, when it
// was not a fight (a side that surrenders calls its bird home, js/sim/surrender.js).
function eagleFlee(e, src, line) {
  e.state = 'flee';
  e.fleeT = 0;
  e.hp = 0;
  e.windT = 0;
  e.fleeFrom = e.heading;
  const c = WORLD * TILE / 2;
  e.fleeTo = Math.atan2(e.y - c, e.x - c); // away from the centre, out over the nearest treeline
  // the talons leave the ground: its roost tiles open back up
  const ctx0 = Math.floor(e.x / TILE), cty0 = Math.floor(e.y / TILE);
  const TR = Math.ceil(EAGLE_TILE_R);
  for (let dy = -TR; dy <= TR; dy++) for (let dx = -TR; dx <= TR; dx++) {
    const tx = ctx0 + dx, ty = cty0 + dy;
    if (!inWorld(tx, ty)) continue;
    const o = objAt(tx, ty);
    if (o && o.type === 'eagle' && o.team === e.team) objects[idx(tx, ty)] = null;
  }
  eagleGustFx(e, 2); // the takeoff downdraft: the gust's language writ large
  shakeAt(e.x, e.y, 4, EV_ANYWHERE); shakeAt(e.x, e.y, 7, 500);
  sfxAt('gust', e.x, e.y, EV_ANYWHERE);
  logEvent(line || 'THE ' + TEAMS[skin(e.team)].name + ' EAGLE WAS DRIVEN OFF', src || players.find((p) => p.team === e.team));
  state.eagleCine = { team: e.team, t: 0, srcId: src ? src.id : -1 };
}

// the ceremony's last beat, EAGLE_CINE_T after liftoff (updateDrop ticks it):
// the whole side falls with its bird - die() and teamInMatch() both read
// teamEagleDown - and checkLastStanding queues the victory or defeat screen
// while the escape keeps flying underneath it (the sim runs on in mode 'dead').
function eagleFleeResolve(e, src) {
  for (const p of players) {
    if (!p.active || p.team !== e.team) continue;
    if (!p.dead) die(p, null, 'eagle');
    else if (!p.eliminated) {
      p.eliminated = true;
      if (p === player) endMatch('lost');
    }
  }
  checkLastStanding();
}

// the objective test the death/respawn path asks (player.js): a driven-off
// eagle takes its team out of the match - the one thing that does
function teamEagleDown(team) {
  const e = state.drop && state.drop.eagles[team];
  return !!e && (e.state === 'flee' || e.state === 'gone');
}

// both birds, the rider and every faller, above the world and below the
// lighting. Shadows sit `alt` below (and a little right of) each body,
// converging as a dive comes down.
// a bird whose body is off the ground: drawn on the air layer (airCv)
function dropFlies(e) { return e.state === 'fly' || e.state === 'dive' || e.state === 'flee'; }
// `air` picks the half: false is the world pass (the path dotted over the
// snow and a bird on the ground), true the air layer (render())
function drawDropAir(ex, ey, now, air) {
  const d = state.drop;
  if (!d) return;
  // the flight path itself, dotted over the snow in each team's colour - the
  // world-space chart. The dots crawl toward the line's end so it reads as a
  // direction.
  if (!air && state.mode === 'drop') for (const e of d.eagles) {
    if (e.state !== 'fly') continue;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 9]);
    ctx.lineDashOffset = -((now * 30) % 14);
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = TEAMS[skin(e.team)].mark;
    const path = (u0, u1) => {
      const a = eaglePathAt(e, u0), b = eaglePathAt(e, u1);
      ctx.beginPath(); ctx.moveTo(a.x - ex, a.y - ey); ctx.lineTo(b.x - ex, b.y - ey); ctx.stroke();
    };
    path(0, 1);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  for (const e of d.eagles) if (dropFlies(e) === air) drawEagle(e, ex, ey, now);
  if (!air) return;
  // fallers: a hop off the wing, then the shrink from rider scale to the
  // ground's, shadow growing under them. This is a WORLD pass, so the cull is
  // against WV_*, not VIEW_* - the old VIEW_* bounds were half the zoomed-out
  // frame, which is what made fallers on the far side of it vanish mid-air.
  for (const p of players) {
    if (!p.active || p.dropT <= 0) continue;
    const q = 1 - p.dropT / HOP_FALL_T;      // 0 just stepped off .. 1 touching down
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
// same trail at any dt - and the stoop fades the whole ribbon out as the bird
// tips over. Drawn at the bird's altitude, under the sprite.
const TRAIL_TIP = 19, TRAIL_TIP_AMP = 2;   // sprite px across to the wingtip, and the gentle swing the flap puts on it (the tip itself moves 4, the air behind it half that)
const TRAIL_BACK = -8, TRAIL_BACK_AMP = 3; // ...and how far back along the body it sits, and its swing
function drawEagleTrail(e, ex, ey, S, now) {
  const hc = Math.cos(e.heading), hs = Math.sin(e.heading);
  const dive = e.state === 'dive' ? Math.min(1, e.diveT / EAGLE_DIVE_T) : 0;
  if (dive >= 1) return;
  const T = e.t + (e.state === 'dive' ? e.diveT : 0);   // the flight clock: e.t stops at the line's end
  const head = Math.min(T, e.dur);                       // the ribbon's tip never leaves the line
  const n = Math.ceil(Math.min(TRAIL_T, head) * e.spd / TRAIL_STEP);
  if (n < 2) return;
  // a sample's point on the ribbon: the tip's world position `age` seconds ago
  const at = (side, age, out) => {
    const t = head - age, d = Math.min(e.spd * t, e.len);
    const ph = Math.cos((e.flap - (T - t)) * EAGLE_BEAT_HZ * 2 * Math.PI); // the flap cycle: spread -> top -> spread, EAGLE_BEAT_HZ a second
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
    ctx.globalAlpha = 1 - dive;
    g.addColorStop(0, TRAIL_RIM); g.addColorStop(0.55, 'rgba(40,60,100,0.32)'); g.addColorStop(1, 'rgba(40,60,100,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.stroke();
    const w = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    w.addColorStop(0, 'rgba(255,255,255,0.95)'); w.addColorStop(0.55, 'rgba(255,255,255,0.55)'); w.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = w; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

const strokeAt = (flap, n) => Math.floor(flap * EAGLE_BEAT_HZ * n) % n;

// Perch's frames paint on first use (a few ms each), so the ones a bird is
// about to need are queued ahead (SPRITES.perch.warm): on its first frame in a
// state, every frame that state will draw - level flight's stroke; the
// stoop and the takeoff stepped a frame at a time by the same clocks
// updateEagle runs them on (the dive's turn and shrink, the takeoff's turn,
// climb and beats), so a frame is painted before it is shown; the roost's
// beats. The next state's frames go on the slow queue well before it comes:
// in flight the stoop the line's end will start (beginDive's turn onto
// findCrashPoint), at the roost the takeoff eagleFlee would fly (away from
// the map's centre). Render only: it reads the bird, never moves it.
const perchWarmed = new WeakMap();
function warmPerch(e, id) {
  const key = id + '|' + e.state;
  if (perchWarmed.get(e) === key) return;
  perchWarmed.set(e, key);
  const PR = SPRITES.perch, t = skin(e.team);
  const both = (hd, k, sc, idle) => { PR.warm(id, t, hd, k, sc, false, idle); PR.warm(id, t, hd, k, 1, true, idle); };
  const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const stoop = (h0, turn, T0, idle) => {
    for (let T = T0; T <= EAGLE_DIVE_T; T += 1 / 60) {
      const u = T / EAGLE_DIVE_T;
      both(h0 + turn * Math.min(1, u * 1.8), 'd' + Math.round(u * PR.DIVE_N), (EAGLE_SCALE - (EAGLE_SCALE - EAGLE_REST_SCALE) * u * u) / EAGLE_REST_SCALE, idle);
    }
    for (let fi = 0; fi < 3; fi++) PR.warm(id, t, h0 + turn, 'r' + fi, 1, false, idle);
  };
  const takeoff = (from, to, T0, idle) => {
    const turn = wrap(to - from);
    for (let T = T0; T <= FLEE_LIFT_T + 0.5; T += 1 / 60) {
      const u = Math.min(1, T / FLEE_LIFT_T);
      both(from + turn * u, 'l' + perchLiftBeat(T), (EAGLE_REST_SCALE + (EAGLE_SCALE - EAGLE_REST_SCALE) * u) / EAGLE_REST_SCALE, idle);
    }
  };
  if (e.state === 'fly') {
    for (let k = 0; k <= PR.STROKE_N / 2; k++) both(e.heading, 's' + k, EAGLE_SCALE / EAGLE_REST_SCALE);
    const end = eaglePathAt(e, 1), crash = findCrashPoint(e);
    stoop(e.heading, wrap(Math.atan2(crash.y - end.y, crash.x - end.x) - e.heading), 0, true);
  }
  if (e.state === 'dive') stoop(e.diveH0, e.diveTurn, e.diveT);
  if (e.state === 'down') {
    for (let fi = 0; fi < 3; fi++) PR.warm(id, t, e.heading, 'r' + fi, 1);
    const c = WORLD * TILE / 2;
    takeoff(e.heading, Math.atan2(e.y - c, e.x - c), 0, true);
  }
  if (e.state === 'flee') takeoff(e.fleeFrom, e.fleeTo, e.fleeT);
}
// the takeoff's beat at T s into it: hard and fast, from the spread
const perchLiftBeat = (T) => [0, 1, 2, 1][Math.floor(T * 13) % 4];

// the roosting bird's pool: the match is won and lost on it, so it is the
// biggest bar in the world. Even segments like every hp bar but big and few
// (PERCH_BAR_SEGS, not hpSegCount, which would split EAGLE_HP into a comb of
// 2 px blocks), a heavy ink frame, the chunk a hit just took holding pale
// before it drains (render-side: perchLag eases toward e.hp), the pool's
// number inside. `bottom` is the world row just above the bird.
const perchLag = new WeakMap();
function drawPerchBar(e, sx, bottom, now) {
  const L = perchLag.get(e) || { v: e.hp, t: now, last: now };
  if (e.hp > L.v) L.v = e.hp;                                  // healed or a new pool: no ghost
  else if (e.hp < L.v && now - L.t > PERCH_LAG_HOLD) L.v = Math.max(e.hp, L.v - PERCH_LAG_RATE * Math.max(0, now - L.last));
  if (e.hp < L.hp0) L.t = now;                                 // a fresh hit restarts the hold
  L.hp0 = e.hp; L.last = now;
  perchLag.set(e, L);
  const T = TEAMS[skin(e.team)], bw = PERCH_BAR_W, bh = PERCH_BAR_H, r = PERCH_BAR_RIM;
  const bx = Math.round(sx - bw / 2), by = bottom - r - bh;
  const fill = (v) => Math.round(bw * Math.max(0, v) / e.maxHp);
  overheadPlate(() => { // over the grade, like every frame (js/draw/light.js)
    ctx.fillStyle = BAR_FRAME; ctx.fillRect(bx - r, by - r, bw + 2 * r, bh + 2 * r);
    ctx.fillStyle = BAR_TRACK; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(bx, by, fill(L.v), bh);   // the chunk a hit just took, pale
    ctx.fillStyle = T.mark; ctx.fillRect(bx, by, fill(e.hp), bh);
    ctx.fillStyle = T.coatD; ctx.fillRect(bx, by + bh - 2, fill(e.hp), 2);  // its lower rows a step darker: weight, not a bevel
    const seg = (bw + 1) / PERCH_BAR_SEGS;
    ctx.fillStyle = HP_TICK;
    for (let k = 1; k < PERCH_BAR_SEGS; k++) ctx.fillRect(bx + k * seg - 1, by, 1, bh);
    const txt = String(Math.max(0, Math.ceil(e.hp))); // the pool's number, 1x outlined, centred in the bar
    drawWorldText(txt, centreTextX(sx, txt, 1), by + 2, '#f4f7ff', 1);
  });
}
// one bird in its team's armour, whatever its state. In the air the sprite
// sits at (x, y) with the shadow `alt` px below it; the dive walks that gap
// to zero so shadow and bird meet exactly at the crash point. The skin it
// wears (birdSkinFor, read here only: the sim never asks) is one of Perch's
// looks (SPRITES.perch), painted at its heading and its size in the pose of
// the moment, so the bird draws 1:1 and unrotated, its
// shadow is its own silhouette at the roost's size, and a rider on a wing
// rides that wing (SPRITES.perch.seat)
function drawEagle(e, ex, ey, now) {
  const sx = Math.round(e.x - ex), sy = Math.round(e.y - ey), t = skin(e.team);
  const PR = SPRITES.perch, worn = birdSkinFor(e.team), look = PR.has(worn) ? worn : BIRD_SKINS[0].id;
  warmPerch(e, look); PR.tick(4); // paint the frames it is about to need, a few ms a frame
  if (e.state === 'fly' || e.state === 'dive') {
    const u = e.state === 'dive' ? Math.min(1, e.diveT / EAGLE_DIVE_T) : 0;
    const fall = u * u; // gravity: slow tip-over, hard finish
    const alt = DROP_ALT * (1 - fall);
    const S = EAGLE_SCALE - (EAGLE_SCALE - EAGLE_REST_SCALE) * fall; // 3x down to the roost's 2x
    // the shadow lies on the snow at the bird's TRUE size - the roost's, not
    // the nearer-the-camera flight size - and beats with the same wings
    // level flight's stroke, or the stoop's pose by how far down it is
    const key = e.state === 'fly' ? 's' + strokeAt(e.flap, PR.STROKE_N) : 'd' + Math.round(u * PR.DIVE_N), sc = S / EAGLE_REST_SCALE;
    const spr = PR.frame(look, t, e.heading, key, sc, e), shw = PR.shadow(look, t, e.heading, key, e);
    const seatAt = (st) => PR.seat(e.heading, key, sc, st);
    const w = spr.fw, h = spr.fh;
    drawEagleTrail(e, ex, ey, S, now); // before the cull: the trail hangs behind a bird already off the frame
    if (sx < -w - 40 || sy < -h - DROP_ALT - 40 || sx > WV_W + w + 40 || sy > WV_H + h + 40) return;
    const bob = flightBob(e, now);
    PR.put(ctx, shw, sx + Math.round(10 * (1 - fall)) - (shw.fw >> 1), sy + alt - (shw.fh >> 1));
    PR.put(ctx, spr, sx - Math.round(w / 2), sy + bob - Math.round(h / 2));
    // every rider seated on its wing, facing the way the bird flies, at the
    // bird's own perspective size (riderScale); the local player draws last so
    // it is never under a teammate. Only YOUR name rides the wing (in your
    // side's paint, under the gold arrow renderDropUI hangs over you): seven
    // names on one bird told a new player nothing about which one was them
    const RS = riderScale(e), rd = riderDir(e);
    { // the driver first, on the neck: the team's merchant, who climbs down at the crash
      const [dx, dy] = seatAt(PR.merchSeat);
      drawSeated(SPRITES.merchant[t], rd, sx + dx, sy + bob + dy, RS);
    }
    for (let pass = 0; pass < 2; pass++) for (const p of players) {
      if (!p.active || !p.aboard || p.team !== e.team || (p === player) !== (pass === 1)) continue;
      const [dx, dy] = seatAt(EAGLE_SEATS[p.seat % EAGLE_SEATS.length]);
      drawSeated(classSet(p), rd, sx + dx, sy + bob + dy, RS);
      if (p === player) seatedName(classSet(p), rd, sx + dx, sy + bob + dy, RS, p.name, p.team);
    }
  } else if (e.state === 'flee') {
    // driven off: the climb out. Scale and altitude walk back up from the
    // roost's to the flight's, the wings beat hard, and the bird fades out
    // over the last stretch of its escape.
    const u = Math.min(1, e.fleeT / FLEE_LIFT_T);
    const alt = DROP_ALT * u;
    const S = EAGLE_REST_SCALE + (EAGLE_SCALE - EAGLE_REST_SCALE) * u;
    const fi = perchLiftBeat(e.fleeT); // beating for its life, from the first downstroke
    const spr = PR.frame(look, t, e.heading, 'l' + fi, S / EAGLE_REST_SCALE, e), shw = PR.shadow(look, t, e.heading, 'l' + fi, e);
    const w = spr.fw, h = spr.fh;
    if (sx < -w - DROP_ALT - 40 || sy < -h - DROP_ALT - 40 || sx > WV_W + w + 40 || sy > WV_H + h + 40) return;
    const fade = Math.min(1, Math.max(0, (FLEE_T - e.fleeT) / 1.4));
    ctx.globalAlpha = 0.8 * u * fade; // the shadow returns as the ground falls away
    PR.put(ctx, shw, sx + Math.round(10 * u) - (shw.fw >> 1), sy + alt - (shw.fh >> 1));
    ctx.globalAlpha = fade;
    PR.put(ctx, spr, sx - Math.round(w / 2), sy - Math.round(h / 2));
    ctx.globalAlpha = 1;
  } else if (e.state === 'down') {
    // the roosting objective. The landing is a landing, not a wound - the
    // bird folds its wings over EAGLE_SETTLE_T and sits there breathing;
    // wings thrown open and raised (beat 0) are the gust's telegraph.
    const winding = e.windT > 0;
    // the idle's wing shuffle rides the MID beat only, in the middle of
    // RUFFLE_T (fold - shuffle - fold): the full spread stays the gust's
    const ruffling = !winding && e.ruffleT > RUFFLE_T * 0.25 && e.ruffleT < RUFFLE_T * 0.75;
    const fi = e.restT < EAGLE_SETTLE_T
      ? Math.min(2, Math.floor(e.restT / EAGLE_SETTLE_T * 3)) : (winding ? 0 : (ruffling ? 1 : 2));
    // Perch sits landed, painted at its heading
    const spr = PR.frame(look, t, e.heading, 'r' + fi, 1, e), seatAt = (st) => PR.seat(e.heading, 'r' + fi, 1, st);
    const w = spr.fw, h = spr.fh;
    if (sx > -w - 70 && sy > -h - 70 && sx < WV_W + w + 70 && sy < WV_H + h + 70) {
      // no cast shadow at rest: the bird is ON the ground, and a dark copy
      // under it read as a second bird
      const breath = winding ? -2 : (ruffling ? -1 : (e.restT >= EAGLE_SETTLE_T ? Math.round(Math.sin(now * 1.5 + e.team * 2.1)) : 0));
      PR.put(ctx, spr, sx - Math.round(w / 2), sy + breath - Math.round(h / 2));
      if (e.flash > 0) {
        ctx.globalAlpha = Math.min(1, e.flash * 7);
        PR.put(ctx, PR.flash(spr), sx - Math.round(w / 2), sy + breath - Math.round(h / 2));
        ctx.globalAlpha = 1;
      }
      // whoever rode the landing, still seated - world-sized now, the bird at
      // rest is just a big bird - breathing with it, facing where it points
      // (the local player: their first ground is this bird's back), with the
      // gold landing ring pulsing under the bird once the brief has handed
      // back - where the hop lands
      const rd = riderDir(e);
      for (const p of players) {
        if (!p.active || !p.aboard || p.team !== e.team) continue;
        const [dx, dy] = seatAt(EAGLE_SEATS[p.seat % EAGLE_SEATS.length]);
        drawSeated(classSet(p), rd, sx + dx, sy + breath + dy, 1);
        seatedName(classSet(p), rd, sx + dx, sy + breath + dy, 1, p.name, p.team);
      }
      if (player.aboard && player.team === e.team && state.mode === 'play' && !state.dropBrief) {
        const ph = (now * 1.2) % 1;
        ctx.globalAlpha = 0.8 - ph * 0.6;
        ctx.strokeStyle = '#ffd95c';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, sy, 10 + ph * 14, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // the pool, in team colour, up from the moment it roosts - the bar IS
      // the objective's introduction, so it never waits for a first hit.
      // Anchored to the bird's rotated extent, not the unrotated box, so it
      // hugs the sprite whatever way the dive left it pointing.
      const vh = PR.reach(spr).up;
      // in even health segments like every hp bar, but big and few: the
      // objective's bar reads from across the clearing, so PERCH_BAR_SEGS
      // is set here rather than asked of hpSegCount (which would split
      // EAGLE_HP into a comb of 2 px blocks)
      drawPerchBar(e, sx, sy - Math.round(vh) - 6, now);
    }
  }
  // the impact shockwave: two rings racing out over the crater, then gone -
  // squashed flat so they read as a blast wave along the ground, never as a
  // halo circling the bird's head
  if (e.boomT > 0) {
    const q = 1 - e.boomT / BOOM_LIFE;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.55);
    ctx.strokeStyle = '#f4f7ff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7 * (1 - q);
    ctx.beginPath(); ctx.arc(0, 0, 10 + q * 78, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = TEAMS[skin(e.team)].mark; ctx.lineWidth = 1; ctx.globalAlpha = 0.5 * (1 - q);
    ctx.beginPath(); ctx.arc(0, 0, 5 + q * 52, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// the ride's HUD: the gold arrow over you on the wing, the DRIFT key while
// you step down, and the MAP key. The wider read is the M map.
const FLIGHT_OPEN = '#ffd95c'; // the gold every "do it now" wears: your arrow on the wing, the HOP OFF key
function renderDropUI(now) {
  const d = state.drop;
  if (!d || window.DBG.hideUI) return;
  const big = VIEW_H >= 500;
  const ts = big ? 2 : 1;                   // text scale follows the zoomed-out view
  if (player.aboard) drawYouArrow(now, d.eagles[player.team]);
  else drawDropBind('move', 'DRIFT', Math.round(VIEW_W / 2), 10 * ts, '#f4f7ff', ts, true);
  // keybind indicator, bottom right: the map itself is the affordance
  if (!state.mapOpen) drawDropBind('map', 'MAP', VIEW_W - 6 * ts, VIEW_H - 12 * ts, '#9fb6d8', ts, false);
}
// the bird's bob in flight: its riders, their names and your arrow ride it
function flightBob(e, now) {
  return e.state === 'fly' ? Math.round(Math.sin(now * 2.4 + e.team * 2.1) * 3) : 0;
}
// the gold arrow over your own name on the wing, bobbing: with only your
// name riding the bird, this is the "that one is you" a first flight needs.
// World-anchored like the tag under it (seatedName: 8 px over the seated
// head, at the bird's rider scale), so it stays clear of it at every zoom
// of the opening shot.
function drawYouArrow(now, e) {
  const set = classSet(player), RS = riderScale(e);
  const tagTop = wToSY(player.y + flightBob(e, now) - (set[riderDir(e)][0].height - 5) * RS - 8);
  const b = Math.round(Math.sin(now * 5) * 1.5);
  const cx = Math.round(wToSX(player.x)), cy = Math.round(tagTop) - 9 + b;
  ctx.fillStyle = '#0f1632';
  for (let r = 0; r < 5; r++) ctx.fillRect(cx - 5 + r, cy - 1 + r, 11 - 2 * r, 2);
  ctx.fillStyle = FLIGHT_OPEN;
  for (let r = 0; r < 4; r++) ctx.fillRect(cx - 4 + r, cy + r, 9 - 2 * r, 1);
}
// an action's key cap - the shared one (drawKeyCap, js/ui/wheel.js), its
// face lit white when `lit`; the pad's glyph while a pad is in hand - with
// its one word beside it in `col`, the pair centred on x with its top at y.
// The roost's HOP OFF wears it.
function drawCapBind(act, verb, x, y, col, lit) {
  const vw = pixelTextWidth(verb);
  if (padActive() && PAD_BIND[act]) {
    const gw = padBindW(act), x0 = Math.round(x - (gw + 3 + vw) / 2);
    drawPadBind(ctx, x0, y, act, 1);
    drawPixelTextOutline(ctx, verb, x0 + gw + 3, y + 3, col, '#0f1632');
    return;
  }
  const lab = keyCap(act), x0 = Math.round(x - (pixelTextWidth(lab) + 6 + 3 + vw) / 2);
  const cw = drawKeyCap(ctx, x0, y, lab, false, lit ? 1 : 0);
  drawPixelTextOutline(ctx, verb, x0 + cw + 3, y + 3, col, '#0f1632');
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

// The way off the roost, for a rider still seated after the brief: a keybind
// indicator - the work key's cap with the one word beside it, bobbing at the seated
// player's shoulder (beside, not above: above is the bird's own bar and
// whoever is standing on the far side of it) - and the gold landing ring
// pulsing under the bird (drawEagle). Play mode's UI pass, over the world (wToSX/wToSY), gone
// the moment the hop starts.
function drawHopPrompt(now) {
  if (!state.drop || !player.aboard || state.dropBrief || window.DBG.hideUI) return;
  const e = state.drop.eagles[player.team];
  if (e.state !== 'down') return;
  const bob = Math.round(Math.sin(now * 4) * 2);
  // centred over your head, its foot HOP_GAP clear of your name tag's top
  // (seatedName: the tag sits 8 world px over the seated body's head)
  const set = classSet(player), dir = riderDir(e);
  const tagTop = Math.round(wToSY(player.y - (set[dir][0].height - 5) - 8));
  const y = tagTop - HOP_GAP - 10 + bob, cx = Math.round(wToSX(player.x));
  // the work key on a keyboard (E); a pad's A disc (the jump; X, the work button, hops too)
  drawCapBind(padActive() ? 'dodge' : 'work', 'HOP OFF', cx, y, FLIGHT_OPEN, true);
}

// the brief is over, however it ended: the controls come back
function endBrief() {
  if (!state.dropBrief) return;
  state.dropBrief = null;
}

// where the drop brief's camera is looking right now: the sim camera
// (js/sim/sim.js) glides toward this every frame, so a bird still finishing its
// dive is TRACKED rather than met - the crash lands on screen
function dropBriefTarget() {
  const b = state.dropBrief, d = state.drop;
  if (!b || !d) return { x: player.x, y: player.y };
  if (b.ph === 'ours-go' || b.ph === 'ours') return d.eagles[player.team];
  if (b.ph === 'theirs-go' || b.ph === 'theirs') return d.eagles[1 - player.team];
  return { x: player.x, y: player.y }; // 'wait': the seat you are in
}

// the brief's two headlines, one per roost: the bird on screen is the
// picture, this says what to DO about it (the headline carve-out - a match
// has exactly one win condition, and this is the once it is ever written
// down). One line, verb first, nothing under it: the roost's team colour at
// four times the drop HUD's text scale, low in the view under the bird, on
// no plate - a 2 px dark rim carries it over the pines instead. Baked opaque
// and faded as a canvas: an outline stamped under
// globalAlpha goes blotchy (the CLAUDE.md text rule).
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
    const t1 = b.ph === 'ours' ? 'PROTECT YOUR EAGLE' : 'ATTACK THEIR EAGLE';
    const hs = BRIEF_TEXT * ts, rim = BRIEF_RIM;
    briefCv = document.createElement('canvas');
    briefCv.width = pixelTextWidth(t1, hs) + rim * 2;
    briefCv.height = 5 * hs + rim * 2;
    const c2 = briefCv.getContext('2d');
    for (let dy = -rim; dy <= rim; dy++) for (let dx = -rim; dx <= rim; dx++) {
      if (dx || dy) drawPixelText(c2, t1, rim + dx, rim + dy, '#0f1632', hs);
    }
    drawPixelText(c2, t1, rim, rim, TEAMS[skin(team)].mark, hs);
    briefCvKey = key;
  }
  ctx.globalAlpha = a;
  ctx.drawImage(briefCv, Math.round((VIEW_W - briefCv.width) / 2), Math.round(VIEW_H * BRIEF_Y));
  ctx.globalAlpha = 1;
}
