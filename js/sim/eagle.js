'use strict';
// The eagles: the bird each side guards. Each flies its side in at the start
// of a match (THE ARRIVAL, below: the crew and the merchant on its back) and
// lands on its perch at the back of its base (basePerch, js/sim/field.js),
// where it is its team's OBJECTIVE: an hp pool (its
// NERVE) the side keeps alive, guarding itself with a wing gust and calming
// back down (preen regen) between scares. At zero the bird is DRIVEN OFF
// (hurtEagle / eagleFlee), and its whole side falls with it. The pixels -
// the birds, the roost's bar and the match's opening headline - are
// js/draw/eagle.js.
// state.drop holds the two birds for the whole match: set at beginMatch,
// null on the title screen, so it is also the test for "a match is live".
// ------------------------------------------------------------ the eagles
// the opening headline, the once the win condition is written down: PROTECT
// YOUR EAGLE over your own roost, every match, while the wings settle
// (drawDropHeadline reads the bird's own restT, so every screen shows it alike)
const HEADLINE_IN = 0.4;     // s after the match starts it comes up...
const HEADLINE_HOLD = 2.6;   // ...and how long it holds
const HEADLINE_TEXT = 4;     // its scale, times the HUD's big-view text scale
const HEADLINE_RIM = 2;      // px of dark rim round it: the roost is pines edge to edge, and no plate
const HEADLINE_Y = 0.64;     // where its top sits, as a share of the view's height: under you, clear of the roost's bar and the HUD
const DROP_ALT = 56;        // screen px between a fleeing bird at the top of its climb and its shadow
const EAGLE_SCALE = 3;      // a bird in the air is nearer the camera: drawn at 3x as it flees...
const EAGLE_REST_SCALE = 2; // ...and 2x on its perch
const EAGLE_SETTLE_T = 0.6; // seconds of wing-fold at the match's start, into the resting pose
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
const ROOST_R = 3.6;         // tiles round the bird that are its roost: where the recall lands and a body heals (js/sim/recall.js)
const BOOM_LIFE = 0.9;      // seconds the gust's shockwave rings run
// where a side's three set out from at the match's start: RESPAWN_OUT up the
// lane from the bird (roostTile), spread this many px across it
const START_SPREAD = 24;
// THE ARRIVAL: every match opens with each side's bird flying its crew in.
// From ARRIVE_FROM px off its perch (behind the base and up the lane side,
// over the back pines; BLUE's mirrored) it glides one straight line down
// onto the perch in ARRIVE_T, DROP_ALT px over its shadow at the start and
// none at the touchdown, the riders on its back: the side's three on its
// EAGLE_SEATS and the merchant on its neck (SPRITES.perch.merchSeat).
// CREW_HOP_T after the touchdown the whole crew steps off together, a short
// leap (HOP_FALL_T, HOP_ALT high) to its start spot, and the hero is yours
// when its boots touch; the merchant hops off to its post at the touchdown.
// Nothing aboard acts: crewAboard holds the body out of the sim's steps.
const ARRIVE_T = 1.5;               // s from the first frame to the touchdown
const ARRIVE_FROM = [-120, -400];   // px off RED's perch the glide starts (BLUE's x mirrored): up the lane side, over the back pines
const EAGLE_SEATS = [[-2, 0], [2, -11], [2, 11]]; // the crew's seats: the back, then the two inner wings (SPRITES.perch.seat's units)
const CREW_HOP_T = 0.2;             // s after the touchdown the crew steps off, together
const HOP_FALL_T = 0.45;            // s the step off takes...
const HOP_ALT = 12;                 // ...from this many px up its arc

// a bird per team, already on its perch
function makeEagles() {
  return [0, 1].map((team) => {
    const at = basePerchPx(team);
    return {
      team, heading: team === 0 ? 0 : Math.PI, x: at.x, y: at.y,
      roostX: at.x, roostY: at.y, homeH: team === 0 ? 0 : Math.PI, // the perch it lands on, and the way it sits there
      arriveT: 0, landH: team === 0 ? 0 : Math.PI,                 // the arrival: s into the glide, and the heading it lands on
      flap: team * 0.4,
      state: 'down',                // down (the objective) -> flee -> gone
      restT: 0,
      hp: EAGLE_HP, maxHp: EAGLE_HP, flash: 0, boomT: 0,
      gustCd: 0, windT: 0, hitT: 99,          // the wing gust and the calm-down clock
      idleT: 3 + team * 2, ruffleT: 0,        // the resting idle: seconds to the next wing shuffle (offset so the birds never sync)
      fleeT: 0, fleeFrom: 0, fleeTo: 0,       // the driven-off takeoff
      laneDir: { x: team === 0 ? 1 : -1, y: 0 }, // the unit direction from the roost out toward the field: the way out, read by the respawn and the bots
      merchant: null,                         // its side's merchant, at the stall (robots.js)
    };
  });
}

// the roost's hitbox: `eagle` objects on the tiles under the bird - solid to
// walkers, a work target for rival E swings (their OBJECTS entry), and drawn
// by drawEagle, never the object pass
function eagleRoost(e) {
  const ctx0 = Math.floor(e.x / TILE), cty0 = Math.floor(e.y / TILE);
  const TR = Math.ceil(EAGLE_TILE_R);
  for (let dy = -TR; dy <= TR; dy++) for (let dx = -TR; dx <= TR; dx++) {
    const tx = ctx0 + dx, ty = cty0 + dy;
    if (!inWorld(tx, ty) || Math.hypot(dx, dy) > EAGLE_TILE_R) continue;
    if (!objAt(tx, ty) && !waterAt(tx, ty)) placeObj(tx, ty, 'eagle', { team: e.team });
  }
}

// THE MATCH STARTS: both birds in the air with their sides on their backs
// (the arrival), the waves' clock at zero, and every player's start spot a
// step up the lane from its own perch, where its leap off the bird lands
function beginMatch() {
  PROFILE.addMatch(); // the profile's matches: one per match started
  state.drop = { eagles: makeEagles() };
  for (const e of state.drop.eagles) eagleRoost(e);
  spawnMerchants();
  wavesReset();
  const slot = [0, 0]; // next start spot per team, dealt in slot order
  for (const p of players) {
    if (!p.active) continue;
    const e = state.drop.eagles[p.team], k = slot[p.team]++;
    const off = (k % 3 - 1) * START_SPREAD;
    p.spawn = nearestDryTile(e.x + e.laneDir.x * RESPAWN_OUT, e.y + e.laneDir.y * RESPAWN_OUT + off, p, 0);
    p.x = (p.spawn.tx + 0.5) * TILE; p.y = (p.spawn.ty + 0.5) * TILE;
    p.vx = p.vy = 0;
    p.aboard = true; p.seat = k; p.dropT = 0;
  }
  for (const e of state.drop.eagles) arriveStart(e);
  netHostRoom(); // the relay's list: this room is live now
  matchHandOver(player);
  SFX.dawnChime();
}
// this screen goes from the menus into the match, on its own body: the
// host's at beginMatch, a client's on the first snapshot of a live match
// (netClientMode, js/net/net.js)
function matchHandOver(p) {
  state.mode = 'play';
  state.mapOpen = false;
  state.menu.panel = null;
  state.menu.screen = 'menu';
  applyZoom(0, true); // the player's own zoom, centred on them
  camX = Math.max(0, Math.min(WORLD * TILE - WV_W, p.x - WV_W / 2));
  camY = Math.max(0, Math.min(WORLD * TILE - WV_H, p.y - WV_H / 2));
  state.introFrom = { x: camX, y: camY };
  state.intro = HUD_IN_T; state.introLen = HUD_IN_T; // the HUD slides in, the camera settles
  state.menu.screenT = 0;
  state.rayT = RAY_AFTER; // the low sun's shafts, for the opening seconds (js/draw/light.js)
  SFX.music.play('jump');
}

// ------------------------------------------------------------ the arrival
// the glide's first frame: the bird up at the far end of its line, heading
// down it, its riders in their seats
function arriveStart(e) {
  const sx = e.team === 0 ? 1 : -1;
  e.state = 'arrive'; e.arriveT = 0;
  e.fromX = e.roostX + ARRIVE_FROM[0] * sx; e.fromY = e.roostY + ARRIVE_FROM[1];
  e.heading = e.landH = Math.atan2(e.roostY - e.fromY, e.roostX - e.fromX);
  arriveAt(e, 0);
}
// where the glide is at u (0..1 of ARRIVE_T): the ground under it eases in
// to the perch (it slows as it comes down), and the bird is `eagleAlt` over
// that ground, so shadow and bird meet at the touchdown
function arriveAt(e, u) {
  const k = 1 - (1 - u) * (1 - u);
  e.arriveK = k;
  e.x = e.fromX + (e.roostX - e.fromX) * k;
  e.y = e.fromY + (e.roostY - e.fromY) * k - eagleAlt(e);
  seatCrew(e);
}
// px between a flying bird and its shadow: DROP_ALT at the top of the
// glide, none at the touchdown; the takeoff climbs back up to DROP_ALT
function eagleAlt(e) {
  if (e.state === 'arrive') return DROP_ALT * (1 - e.arriveK);
  if (e.state === 'flee') return DROP_ALT * Math.min(1, e.fleeT / FLEE_LIFT_T);
  return 0;
}
// the bird's drawn size over its roost size: 3x in the air, 2x down
function eagleScale(e) {
  if (e.state === 'arrive') return EAGLE_REST_SCALE + (EAGLE_SCALE - EAGLE_REST_SCALE) * (1 - e.arriveK);
  if (e.state === 'flee') return EAGLE_REST_SCALE + (EAGLE_SCALE - EAGLE_REST_SCALE) * Math.min(1, e.fleeT / FLEE_LIFT_T);
  return EAGLE_REST_SCALE;
}
// a seat's world point on a bird right now: its offset turned by the
// heading, at the bird's drawn size (the seats are SPRITES.perch.seat's
// units: two px a unit at the roost's size)
function seatPos(e, st) {
  const S = eagleScale(e), dx = st[0] * S, dy = st[1] * S, c = Math.cos(e.heading), s = Math.sin(e.heading);
  return { x: e.x + dx * c - dy * s, y: e.y + dx * s + dy * c };
}
// every rider sits where its seat is, the merchant on the neck
function seatCrew(e) {
  for (const p of players) {
    if (!p.active || !p.aboard || p.team !== e.team) continue;
    const at = seatPos(e, EAGLE_SEATS[p.seat % EAGLE_SEATS.length]);
    p.x = at.x; p.y = at.y; p.vx = p.vy = 0;
  }
  const m = e.merchant;
  if (m) { const at = seatPos(e, SPRITES.perch.merchSeat); m.x = m.hopX = at.x; m.y = m.hopY = at.y; }
}
// one step of the glide; at its end the bird is down on its perch: the
// roost's own life starts (restT, the wing-fold settle turning it from the
// line's heading to the way it sits) and the merchant hops off to its post
function updateArrive(e, dt) {
  e.arriveT += dt;
  const u = Math.min(1, e.arriveT / ARRIVE_T);
  if (u < 1) { arriveAt(e, u); return; }
  e.state = 'down'; e.restT = 0; e.arriveK = 1;
  e.x = e.roostX; e.y = e.roostY;
  seatCrew(e);
  if (e.merchant) e.merchant.hopT = MERCH_HOP;
  eagleLandFx(e);
}
// the touchdown: snow thrown out from under the wings, the team's paint in it
function eagleLandFx(e) {
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2;
    particles.push({
      x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 6,
      vx: Math.cos(a) * rand(70, 130), vy: Math.sin(a) * rand(40, 80),
      life: 0.5, maxLife: 0.5, color: '#eef4fb', size: 2, grav: 60,
    });
  }
  sfxAt('gust', e.x, e.y);
}
// a merchant still on its bird's neck
function merchAboard(b) { const e = b.merchant && state.drop && state.drop.eagles[b.team]; return !!e && e.state === 'arrive'; }
// a body on its bird or stepping off it: held out of the sim's steps (no
// input, no walk, no push), its seat or its leap the only thing that moves it
function crewAboard(p) { return !!p.aboard || p.dropT > 0; }
// the crew's step of the arrival, from updatePlayer: seated until CREW_HOP_T
// after its bird is down, then the leap to its start spot. True while it holds the body
function crewStep(p, dt) {
  if (!crewAboard(p)) return false;
  const inp = p.input;
  inp.dodge = false; inp.useItem = -1; inp.ability = -1; inp.cmd = null;
  const e = state.drop && state.drop.eagles[p.team];
  if (p.aboard) {
    if (e && e.state === 'down' && e.restT >= CREW_HOP_T) {
      p.aboard = false; p.dropT = HOP_FALL_T; p.hopX = p.x; p.hopY = p.y;
    } else return true;
  }
  p.dropT = Math.max(0, p.dropT - dt);
  const q = 1 - p.dropT / HOP_FALL_T, to = { x: (p.spawn.tx + 0.5) * TILE, y: (p.spawn.ty + 0.5) * TILE };
  p.x = p.hopX + (to.x - p.hopX) * q; p.y = p.hopY + (to.y - p.hopY) * q;
  p.vx = p.vy = 0;
  if (p.dropT <= 0) { burst(p.x, p.y + 2, '#e4e8ee', 5, 25, 0.35, true); return false; }
  return true;
}
// how high a body stepping off its bird is over its feet right now (the draw)
function crewLift(p) {
  if (!(p.dropT > 0)) return 0;
  const q = 1 - p.dropT / HOP_FALL_T;
  return Math.round(HOP_ALT * 4 * q * (1 - q) + 2 * (1 - q));
}
// a match staged by a tool (the media kit, see): both birds already down and
// every body on its start spot, as if the arrival had run
function arriveNow() {
  if (!state.drop) return;
  for (const e of state.drop.eagles) {
    e.state = 'down'; e.restT = 0; e.arriveK = 1; e.heading = e.homeH;
    e.x = e.roostX; e.y = e.roostY;
    if (e.merchant) { e.merchant.hopX = e.x; e.merchant.hopY = e.y; e.merchant.hopT = MERCH_HOP; }
  }
  for (const p of players) {
    if (!p.active || !crewAboard(p)) continue;
    p.aboard = false; p.dropT = 0;
    p.x = (p.spawn.tx + 0.5) * TILE; p.y = (p.spawn.ty + 0.5) * TILE;
  }
}

// the birds' clock, every step of a live match (updatePlay), and the
// driven-off ceremony: hold on the takeoff, then let the screens come
function updateEagles(dt) {
  const cine = state.eagleCine;
  if (cine) {
    cine.t += dt;
    if (cine.t >= EAGLE_CINE_T) {
      state.eagleCine = null; // cleared first, so the resolve's endMatch path runs clean
      eagleFleeResolve(state.drop.eagles[cine.team], cine.srcId >= 0 ? players[cine.srcId] : null);
    }
  }
  for (const e of state.drop.eagles) updateEagle(e, dt);
}

// one bird's whole life: the grounded objective, then the driven-off flight
function updateEagle(e, dt) {
  e.flap += dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.boomT > 0) e.boomT -= dt;
  if (e.state === 'arrive') updateArrive(e, dt);
  else if (e.state === 'down') {
    e.restT += dt; // drives the wing-fold settle, then the breathing at rest
    // the settle turns a bird that came down its line round to the way it sits
    if (e.heading !== e.homeH) {
      let turn = e.homeH - e.landH;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      const q = Math.min(1, e.restT / EAGLE_SETTLE_T);
      e.heading = q >= 1 ? e.homeH : e.landH + turn * q * q * (3 - 2 * q);
    }
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
        if (!q.active || q.dead || q.team === e.team) continue;
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
    // the takeoff turn: from the way it sits, around to the
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
    if (!q.active || q.dead || q.team === e.team) continue;
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
  if (perchShut(e)) return; // the order: no lane of its side's towers is down yet (js/sim/towers.js)
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
  if (e.hp <= 0) eagleFlee(e, src);
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

// the ceremony's last beat, EAGLE_CINE_T after liftoff (updateEagles ticks it):
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
function eagleAloft(e) { return e.state === 'flee' || e.state === 'arrive'; }

