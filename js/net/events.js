// ------------------------------------------------------------ sim events
// Everything the SIM does that only the eye and the ear can tell - a puff of
// snow, a damage number, a cue, a shake - lands here on its way to the
// screen, so that a host can WRITE IT DOWN for the clients that do not run
// the sim at all (docs/pvp-architecture.md). Solo play records nothing: the
// helpers play the cosmetic exactly as the bare call did, and the ring stays
// empty. This is step 3 of the plan; the client that replays the ring is a
// later one, and evPlay below is what it will call per entry.
//
// THE RULE: a sound, a shake or a puff raised inside the step that used to be
// gated on the LOCAL screen - `if (nearPlayer(x, y)) SFX.cue()`, `if (p ===
// player) SFX.cue()`, `if (p === player) state.shake = ...` - goes through
// sfxAt / sfxFor / sfxOwn / shakeAt / shakeFor, which carry the WHERE and the
// WHO instead of the answer, because the answer differs per screen: the host
// is near its own player, not a client's. burst() and the floaters need no
// call-site change - they carry a position already and record themselves.
// A cue that is deliberately for everyone whatever the distance (a bird
// landing) passes EV_ANYWHERE as its radius. What is NOT recorded: anything
// raised outside the step - the HUD's blips, the menu, a refusal flash in a
// drag - which the client raises for itself, and the practice arena, which
// is never a match.
const EV_MAX = 1024;       // entries kept per flush; a fight is tens a second, this is a stall's worth
const EV_ANYWHERE = 1e9;   // a radius that reaches every screen
const evRing = [];         // [{ k, a }] since the last evDrain, in sim order
let evRecord = false;      // the host (and the loopback harness) turn this on; solo leaves it off
let evInStep = false;      // true only inside updatePlay - the one span whose cosmetics are the sim's
function evPush(k, a) {
  if (!evRecord || !evInStep) return;
  if (evRing.length < EV_MAX) evRing.push({ k, a });
}
function evDrain() { const out = evRing.slice(); evRing.length = 0; return out; }
// a unit's id, if it is a player; anything else (a beast, a bot) has no
// screen of its own and records nothing for one
function evPid(p) { return p && players[p.id] === p ? p.id : -1; }

// a cue at a place: heard by a screen within r px of it (nearPlayer's own
// default when r is 0)
function sfxAt(cue, x, y, r, arg) {
  evPush('sfx', [cue, x, y, r || 0, arg]);
  if (nearPlayer(x, y, r || 0)) SFX[cue](arg);
}
// a cue for one body: heard only by the screen that is that player (a step,
// a nock, a refusal, a status landing on you)
function sfxFor(p, cue, arg) {
  evPush('sfxp', [cue, evPid(p), arg]);
  if (p === player) SFX[cue](arg);
}
// one cue for the owner and another for the bystanders in earshot (a level
// gained rings for you and reads as a pickup to the rest)
function sfxOwn(p, own, other) {
  evPush('sfxo', [own, other, evPid(p), p.x, p.y]);
  if (p === player) SFX[own]();
  else if (nearPlayer(p.x, p.y)) SFX[other]();
}
// a shake for one body (or either of two: the striker and the struck)
function shakeFor(p, n, q) {
  evPush('shakep', [evPid(p), n, evPid(q)]);
  if (p === player || (q && q === player)) state.shake = Math.max(state.shake, n);
}
// a shake at a place, for every screen within r px of it
function shakeAt(x, y, n, r) {
  evPush('shake', [x, y, n, r || 0]);
  if (nearPlayer(x, y, r || 0)) state.shake = Math.max(state.shake, n);
}

// replaying one recorded entry on a screen that did not run the step: the
// same answers, asked of THIS screen's player. burst/float go straight back
// into the arrays through the same functions (which, with evRecord off on a
// client, record nothing again).
function evPlay(ev) {
  const a = ev.a;
  switch (ev.k) {
    case 'burst': burst(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7]); break;
    case 'float': addFloater(a[0], a[1], a[2], a[3]); break;
    case 'dmg': addDmgFloater(a[0], a[1], a[2], a[3], a[4]); break;
    case 'sfx': if (nearPlayer(a[1], a[2], a[3])) SFX[a[0]](a[4]); break;
    case 'sfxp': if (a[1] === player.id) SFX[a[0]](a[2]); break;
    case 'sfxo': if (a[2] === player.id) SFX[a[0]](); else if (nearPlayer(a[3], a[4])) SFX[a[1]](); break;
    case 'shakep': if (a[0] === player.id || a[2] === player.id) state.shake = Math.max(state.shake, a[1]); break;
    case 'shake': if (nearPlayer(a[0], a[1], a[3])) state.shake = Math.max(state.shake, a[2]); break;
  }
}
