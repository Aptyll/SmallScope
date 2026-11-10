'use strict';
// The eagle drop that opens every match, and the eagles themselves: the
// route, the ride, the landing, the crew's leap, and the bird each side guards.
// The pixels - the birds, the riders, the trail, the roost's bar, the ride's
// HUD and the landing's headline - are js/draw/eagle.js.
// ------------------------------------------------------------ eagle drop
// Nobody spawns in a camp: after PLAY's count each TEAM rides its own armoured
// eagle in over its OWN corner - RED's bottom-left, BLUE's top-right, every
// match and every seed - a short glide down the road's diagonal from the
// corner and a stoop into the trees at its base's PERCH (mode 'drop': the
// bases, js/sim/base.js). Every match opens the same way, as ONE UNBROKEN
// SHOT of your side's arrival: high over the field, the camera leaning on
// toward your roost, the stoop with the camera diving in to your own zoom
// (dropCamAim / dropStoopZoom), the crash - and the whole crew leaps off the
// wings together, CREW_HOP_T after it, fanning out over the pad (hopOff), so
// your control starts the moment your boots touch. No hop key, no tour: the
// one word on it is PROTECT YOUR EAGLE over your roost (drawDropHeadline).
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
const CREW_HOP_T = 0.25;    // s after the crash the whole crew leaps off the grounded bird, together
const HOP_FALL_T = 0.7;     // s the leap takes (a step down, not a free fall)...
const HOP_ALT = 16;         // ...from this many px up
const HOP_SPREAD = 60;      // px/s each leaper fans out from the bird's centre, unless steering
// the landing's headline, the once the win condition is written down: PROTECT
// YOUR EAGLE over your own roost, every match, while the wings settle
// (drawDropHeadline reads the bird's own restT, so every screen shows it alike)
const HEADLINE_IN = 0.4;     // s after the crash it comes up...
const HEADLINE_HOLD = 2.6;   // ...and how long it holds
const HEADLINE_TEXT = 4;     // its scale, times the drop HUD's text scale
const HEADLINE_RIM = 2;      // px of dark rim round it: the roost is pines edge to edge, and no plate
const HEADLINE_Y = 0.64;     // where its top sits, as a share of the view's height: under you, clear of the roost's bar and the HUD
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
// siege now that bots go for it (the ai's objective rung): a lone blade's
// E swings (three a second, so EAGLE_WORK_DMG is a hundred of them) take a
// minute or more under the gust, a pair half that, and an arrow only ever
// spooks it EAGLE_ARROW_DMG whatever the draw, so archers standing off it
// outside the gust take minutes - long enough either way for the side to
// answer the hit (the two birds, ai.js). At 60 a swing two blades emptied the
// nerve in the fifty seconds between two harness marks, before anyone came
const EAGLE_HP = 2000;
const PERCH_BAR_W = 63;   // px: the roost's hp bar, the match's win/lose bar...
const PERCH_BAR_H = 7;    // ...its height, the pool's number just fitting inside...
const PERCH_BAR_SEGS = 8; // ...and its blocks: (PERCH_BAR_W + 1) must divide by this
const PERCH_BAR_RIM = 1;  // its ink frame, a body's own
const PERCH_LAG_HOLD = 0.35, PERCH_LAG_RATE = 900; // s a hit's lost chunk holds pale, then hp/s it drains at
const EAGLE_WORK_DMG = 20;  // what one rival E swing chips off the roosting bird
const EAGLE_ARROW_DMG = 12; // what one rival arrow chips, whatever it would do to a body
const EAGLE_TILE_R = 1.6;   // tiles around the roost marked solid - the hitbox arrows AND walkers test
// ...and the one thing in the game that shouts from off screen: seconds
// between two "YOUR BIRD IS BEING STRUCK" alarms (SFX.alarm, hurtEagle). A
// siege is a hundred blows and one piece of news, and the news is worth
// hearing again only about as often as a side can answer it.
const EAGLE_WARN_GAP = 9;
const roostWarnT = [-99, -99]; // this screen's last alarm for each side's bird (state.elapsed): a screen's own, never the match's
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
const BOOM_STUMP_R2 = 6.0;  // ...and every tree beyond that, out to here, snapped to a stump
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
// THE ARRIVAL'S CAMERA - one unbroken shot from the sky to your boots, read
// by the drop branch of the camera and applyZoom (js/sim/sim.js). Local: it
// moves this screen's view, never the match.
// how far your own bird's stoop has come, eased: 0 in level flight, 1 at the impact
function dropStoopU() {
  const e = state.drop && state.drop.eagles[player.team];
  return e && e.state === 'dive' ? easeInOut(Math.min(1, e.diveT / EAGLE_DIVE_T)) : 0;
}
// the zoom: the ride's wide framing walks in to your own zoom as your bird
// comes down, so the landing is never a cut. It eases the bird's SIZE ON
// SCREEN (zoom x eagleScale) from the ride's to the roost's, so the bird only
// ever grows as it nears - the stoop's own shrink from 3x to 2x is paid for
// by the zoom. `play` is the zoom the landing hands over to.
function dropStoopZoom(play) {
  const e = state.drop && state.drop.eagles[player.team];
  if (!e || e.state !== 'dive') return DROP_ZOOM;
  const u = dropStoopU();
  return (DROP_ZOOM * EAGLE_SCALE + (play * EAGLE_REST_SCALE - DROP_ZOOM * EAGLE_SCALE) * u) / eagleScale(e);
}
// ...and the aim: your seat, leaning DROP_CAM_LEAD of the way on toward the
// roost the bird is bound for, so the base waiting down the road is in the
// shot. The lean grows in with the opening's pull-out and is gone by the
// impact, where the frame is your seat exactly - the one handOver takes.
const DROP_CAM_LEAD = 0.4;
function dropCamAim() {
  const e = state.drop.eagles[player.team];
  if (!dropFlies(e) || e.state === 'flee') return { x: player.x, y: player.y };
  const c = findCrashPoint(e);
  const open = state.intro > 0 ? easeInOut(1 - state.intro / state.introLen) : 1;
  const k = DROP_CAM_LEAD * open * (1 - dropStoopU());
  return { x: player.x + (c.x - player.x) * k, y: player.y + (c.y - player.y) * k };
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
  PROFILE.addMatch(); // the profile's matches: one per takeoff
  state.drop = { eagles: makeEagles() };
  onevoneBegin(); // a 1V1 party's rules into the match (js/sim/onevone.js)
  const seats = [0, 0]; // next free wing seat per team, dealt in slot order - the first slot of each side sits at seat 0
  for (const p of players) {
    if (!p.active) continue;
    loadoutStart(p); // the pre-game picks, made whole (js/sim/loadout.js)
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
  // the whole crew lands on one beat: a LANDED tag over each was four tags
  // stacked on the roost, so only your own boots answer it
  if (p === player) SFX.land();
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
// the impact and play begins, still seated for the beat before the crew
// leaps (updateDrop)
function landAboard(p) {
  handOver(p);
  state.rayT = RAY_AFTER;
  SFX.music.play('jump', { out: 0.1, in: 0.05 });
}

// off the grounded bird: a leap down off the wing - short, low, fanning out
// from the bird and steerable like any fall (updateDrop)
function hopOff(p) {
  if (!p.aboard || !state.drop) return;
  const e = state.drop.eagles[p.team];
  if (e.state !== 'down') return;
  p.aboard = false;
  p.dropT = HOP_FALL_T; p.dropAlt = HOP_ALT; p.dropSc = 1;
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
  for (const p of players) {
    if (!p.active) continue;
    if (p.aboard) {
      const e = state.drop.eagles[p.team];
      const sp = seatPos(e, p.seat);
      p.x = sp.x; p.y = sp.y;
      if (e.state === 'down' && e.restT >= CREW_HOP_T) hopOff(p); // the whole crew at once, humans and bots alike
      p.input.dodge = false; // a seated roll is spent here, never carried into the landing
    } else if (p.dropT > 0) {
      p.dropT -= dt;
      // steer the fall: the input axis drifts the landing point; left
      // alone, the leap fans out from the bird's centre, so the crew lands
      // round the roost instead of on its back
      const dm = Math.hypot(p.input.mx, p.input.my), e = state.drop.eagles[p.team];
      const ox = p.x - e.x, oy = p.y - e.y, ol = Math.hypot(ox, oy) || 1;
      const vx = dm > 0 ? p.input.mx / dm * DRIFT_SPD : ox / ol * HOP_SPREAD;
      const vy = dm > 0 ? p.input.my / dm * DRIFT_SPD : oy / ol * HOP_SPREAD;
      p.x = Math.max(TILE, Math.min(WORLD * TILE - TILE, p.x + vx * dt));
      p.y = Math.max(TILE, Math.min(WORLD * TILE - TILE, p.y + vy * dt));
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
    if (o.type !== 'tree') continue;
    setTile(idx(tx, ty), Math.hypot(dx, dy) <= BOOM_R ? null : { type: 'stump', tx, ty, flash: 0, shake: 0 });
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
  // heard on every screen
  sfxAt('boom', e.x, e.y, EV_ANYWHERE);
  logEvent('THE ' + TEAMS[skin(e.team)].name + ' EAGLE HAS LANDED', players.find((p) => p.team === e.team));
  // the way out is the road: from the roost up it to the junction (e.mouth),
  // the bearing the merchant's work reads; the driver climbs down
  const mx = e.mouth.x - e.x, my = e.mouth.y - e.y, ml = Math.hypot(mx, my);
  e.laneDir = ml > TILE ? { x: mx / ml, y: my / ml } : { x: -Math.cos(e.heading), y: -Math.sin(e.heading) };
  // the pad: the blown disc is packed earth from this frame - one ground
  // with the road it lands on - so its tiles turn to 3 at
  // once and the ground repaints out to the verge through repaintGround,
  // which also tells the trample the snow there is gone (a one-time cost,
  // under the boom)
  e.pad = addPad(e.team, e.x / TILE - 0.5, e.y / TILE - 0.5, BOOM_R);
  const PR = Math.ceil(BOOM_R) + 3;
  for (let dy = -PR; dy <= PR; dy++) for (let dx = -PR; dx <= PR; dx++) {
    const tx = ctx0 + dx, ty = cty0 + dy;
    if (inWorld(tx, ty) && ground[idx(tx, ty)] === 0 && laneDist(tx, ty) < 0) ground[idx(tx, ty)] = 3;
  }
  for (let dy = -PR; dy <= PR; dy++) for (let dx = -PR; dx <= PR; dx++) {
    if (inWorld(ctx0 + dx, cty0 + dy)) repaintGround(ctx0 + dx, cty0 + dy);
  }
  spawnMerchant(e);
  for (const p of players) if (p.active && p.aboard && p.team === e.team && p === player) landAboard(p);
}

// what the road's furniture and the cables may stand on in place of: a pine gives way
function laneFells(o) { o = structOf(o); return !!o && o.type === 'tree'; }

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

// A FEATHER KNOCKED LOOSE (hurtEagle): it pops up off the hit, tips out to one side and
// sinks, turning as it goes (drawLooseFeather, js/draw/recall.js). Recorded, so every screen
// sees the same feather.
const FEATHER_GAP = 0.3, FEATHER_LIFE = 1.2; // s between two off one bird, and how long one hangs in the air
function knockFeather(x, y, side) {
  evPush('feather', [x, y, side]);
  particles.push({ x, y, vx: side * 70, vy: -30, life: FEATHER_LIFE, maxLife: 0.35, color: '#f4f7ff', size: 11, grav: 70, art: 'feather', side });
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
  // a feather knocked loose, never specks in the side's colour: red ones off a struck
  // bird read as blood. One at a time, so a crowd on the bird is not a pillow fight
  if (state.elapsed - (e.featherT || -9) >= FEATHER_GAP) { e.featherT = state.elapsed; knockFeather(px, py, rng() < 0.5 ? -1 : 1); }
  // WITHIN EARSHOT it is the bird's own voice - it had been using hurt(), the
  // man's winded oof, so the objective the whole match is about sounded like
  // somebody being punched. OUT OF EARSHOT, and only for YOUR OWN bird, it is
  // a warning instead: the roost is the one thing you must defend that you
  // cannot see from where you fight, and the minimap only says so if you
  // happen to be looking at it. One alarm per EAGLE_WARN_GAP, never both cues
  // at once - standing there, the blow IS the news. Whether it is news is
  // each screen's own answer (near, its side, its own clock), so the blow is
  // recorded for the clients and asked here of this one (roostWarnHere).
  sfxAt('bigHurt', e.x, e.y);
  const pct = Math.round(Math.max(0, e.hp) / e.maxHp * 100);
  evPush('roost', [e.team, pct, e.x, e.y]);
  roostWarnHere(e.team, pct, e.x, e.y);
  if (e.hp <= 0) { if (PRACTICE) practiceBirdMend(e); else eagleFlee(e, src); } // nothing ends in practice (js/sim/practice.js)
}

// a blow on a bird, as THIS screen hears it (from hitEagle, and from evPlay on
// a client): out of earshot, its own side's, still in the match, and one
// alarm per EAGLE_WARN_GAP - then the news arrives where the other things you
// glance at mid-fight do: a plate top-right under the minimap, on the
// market's own grammar (the `notices` banner) - your side's bird diamond, the
// NERVE it has left as a number, and the falling tail. The cue turns your
// head and the plate says what happened, which is the market's split too;
// the feed line goes with it, since the log is the match's record.
function roostWarnHere(team, pct, x, y) {
  if (!player || team !== player.team || player.eliminated || nearPlayer(x, y)) return;
  if (state.elapsed - roostWarnT[team] < EAGLE_WARN_GAP) return;
  roostWarnT[team] = state.elapsed;
  logEvent('YOUR EAGLE IS UNDER ATTACK', null, NOTE_KIND.roost);
  raiseNotice('roost', pct + '%');
  SFX.alarm();
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
    if (o && o.type === 'eagle' && o.team === e.team) setTile(idx(tx, ty), null);
  }
  eagleGustFx(e, 2); // the takeoff downdraft: the gust's language writ large
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

// a bird whose body is off the ground: drawn on the air layer (airCv)
function dropFlies(e) { return e.state === 'fly' || e.state === 'dive' || e.state === 'flee'; }

