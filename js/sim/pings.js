'use strict';
// ------------------------------------------------------------ pings
// A PING is a player's mark on the map, for their own side only: a glyph at
// the spot over a pulsing ring, the same glyph on the minimap and the chart,
// and a short cue (the `callout pixels` group, js/draw/callouts.js). A tap
// of the ping button marks GO HERE; holding it opens the wheel and a flick
// picks one of PING_WHEEL (pingKeyPress, js/app/input.js). Either ends in
// p.input.cmd = { kind: 'ping', k, x, y }, and runCmd performs it next step
// through pingCmd - so a ping is sim, and a client's reaches the host and
// comes back like any order.
//
// A ping IS a callout (addCallout, js/ai/ai-callouts.js): the same list, the
// same save, the same wire event, which a host sends only to the side whose
// `see` it is (sendEvents, js/net/net.js) - a rival never hears a ping.
//
// A HUMAN's ping is also a hint to the bots on its side, never an order to
// the whole team: the PING_ANSWERS bots nearest the spot within PING_HEAR
// take it up (an ally may shrug it off: the profile's `obey` knob, rolled
// here once), say ON IT, and walk there - ATTACK breaks what is theirs
// round the spot, DEFEND, ON MY WAY and GO HERE hold it a while (PING_STAY).
// A DANGER instead sends every bot of the side within PING_DANGER_R of the
// spot backing off for PING_BACK_T. What a bot does with it is the ping
// rung and the back-off rung in js/ai/ai-ladder.js; a bot's own pings (the
// bot API's `ping` order) are marks only.
const PING_T = 3.5;           // s a ping stays up
const PING_BURST = 3;         // pings one player may make inside PING_WINDOW...
const PING_WINDOW = 5;        // ...seconds
const PING_GAP = 0.4;         // s between any two pings of one player
const PING_R = 192;           // px round the spot a ping is about: an ATTACK covering the rival bird is a push, a DEFEND covering its own the defence
const PING_HEAR = 1200;       // px from the spot inside which a bot hears a ping
const PING_ANSWERS = 2;       // bots that take one ping up: the nearest that hear it
const PING_IN = 40;           // px from the spot inside which a bot is there
const PING_FOLLOW = 25;       // s a bot walks to a ping before it gives the walk up
const PING_STAY = { go: 5, omw: 6, attack: 10, defend: 15 }; // s it holds the spot once there
const PING_DANGER_R = 240;    // px round a DANGER inside which a bot backs off...
const PING_BACK_T = 6;        // ...for this long
// the wheel's wedges, clockwise from straight up (wheelOptions, js/ui/wheel.js);
// GO HERE is the tap's, and has no wedge
const PING_WHEEL = ['attack', 'omw', 'danger', 'defend'];
// what each ping is, as callouts (spread into CALLS, js/ai/ai-callouts.js):
// `ping` draws it as a mark at the spot rather than a plate over the caller
const PING_CALLS = {
  go:     { word: () => 'GO HERE',   icon: 'go',     ink: '#8fe3ff', ping: true, t: PING_T },
  attack: { word: () => 'ATTACK',    icon: 'attack', ink: '#ff5a6a', ping: true, t: PING_T },
  omw:    { word: () => 'ON MY WAY', icon: 'omw',    ink: '#8fb8ff', ping: true, t: PING_T },
  danger: { word: () => 'DANGER',    icon: 'danger', ink: '#ff9a4d', ping: true, t: PING_T },
  defend: { word: () => 'DEFEND',    icon: 'defend', ink: '#b9a3ff', ping: true, t: PING_T },
};
const PING_KINDS = Object.keys(PING_CALLS);

// may p ping now? Two rules against spam: PING_GAP between two, and no more
// than PING_BURST inside PING_WINDOW. p.pingLog holds its recent ping times.
function pingReady(p) {
  const log = p.pingLog || (p.pingLog = []), now = state.elapsed; // (a save from before pings has none)
  while (log.length && now - log[0] >= PING_WINDOW) log.shift();
  return log.length < PING_BURST && (!log.length || now - log[log.length - 1] >= PING_GAP);
}

// runCmd's ping (js/ui/wheel.js): the mark, then - from a human - the hint
function pingCmd(p, c) {
  if (p.dead || !pingReady(p)) return 'cd';
  const x = Math.max(0, Math.min(WORLD * TILE, c.x)), y = Math.max(0, Math.min(WORLD * TILE, c.y));
  p.pingLog.push(state.elapsed);
  addCallout(c.k, PING_CALLS[c.k].word(p), p.id, p.team, x, y);
  if (isHuman(p)) pingSteer(p, c.k, x, y);
  return true;
}

// the bots on p's side that hear a ping at (x, y)
function pingSteer(p, k, x, y) {
  const mates = players.filter((q) => q !== p && q.active && q.control === 'ai' && q.team === p.team && !q.dead && !inAir(q));
  if (k === 'danger') {
    for (const q of mates) {
      if (q.ai.ping && Math.hypot(q.ai.ping.x - x, q.ai.ping.y - y) < PING_DANGER_R) q.ai.ping = null; // a walk into it is called off
      if (Math.hypot(q.x - x, q.y - y) < PING_DANGER_R * 1.5) q.ai.backOff = { x, y, t: PING_BACK_T };
    }
    return;
  }
  // the nearest that hear it - not a guard on an ATTACK: someone keeps the bird
  const near = mates.filter((q) => Math.hypot(q.x - x, q.y - y) < PING_HEAR && !(k === 'attack' && aiOnGuard(q, aiProfile(q))))
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y) || a.id - b.id)
    .slice(0, PING_ANSWERS);
  const key = p.id + ':' + k + ':' + Math.round(x) + ':' + Math.round(y) + ':' + state.tick;
  for (const q of near) {
    const prof = aiProfile(q);
    if (prof.support && rng() >= aiKnob(prof, 'obey')) continue; // an ally that shrugs it off
    q.ai.ping = { k, x, y, owner: p.id, t: PING_FOLLOW, at: false };
    q.ai.backOff = null;
    aiAnswer(q, 'onit', key);
  }
}
