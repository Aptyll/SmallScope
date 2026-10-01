// ------------------------------------------------------------ bot callouts
// Bots say what they see, the way a good teammate does: a short word over the
// head and a ping on the spot it is about, shown to their own side only, so a
// human can read a bot and play beside it. A callout is never a new decision:
// each one reports something already true in the sim (the bird is being hit,
// this bot is losing a fight, the rival in front of it is nearly down), so
// what a bot says and what the match is doing can never disagree.
//
// Every bot looks a few times a second (staggered by seat, off state.tick, so
// no rng is drawn and the match plays out exactly as it would in silence).
// Three rules keep it from being noise: a bot waits CALL_BOT_CD between its
// own calls, a side keeps CALL_SIDE_GAP between any two, does not repeat a call near the same spot inside
// CALL_SAME_T, and a side never has more than CALL_SIDE_MAX up at once. A
// call is only said when a friend is near enough to act on it.
//
// The live list is sim state (SAVE_ROOTS); addCallout records each one for a
// host's clients (the `sim events` banner, js/net/events.js), and the pixels
// are js/draw/callouts.js.
const CALL_T = 2.4;         // s a callout stays up
const CALL_BOT_CD = 7;      // s a bot waits between two calls of its own
const CALL_SAME_T = 9;      // s a side will not repeat the same call...
const CALL_SAME_R = 180;    // ...within this many px of the last one
const CALL_SIDE_MAX = 2;    // calls a side has up at once
const CALL_SIDE_GAP = 3;    // s between any two calls of one side: a fight is one voice, not five
const CALL_LOOK = 15;       // ticks between two looks by one bot (4 a second)
const CALL_NEAR = 160;      // px: a rival this close is on the caller
const CALL_FRIEND_R = 480;  // px: a call is worth saying only if a friend is this close
const CALL_HELP_HP = 0.35;  // the caller's own hp fraction under which it asks for help
const CALL_LOW_HP = 0.3;    // a rival's (or a bear's) hp fraction under which it is called low
const CALL_BIRD_HIT = 0.5;  // s since its own bird was last hit for the side to call it
const CALL_PUSH_HP = 0.6;   // the rival bird's nerve under which a bot at it calls the push
const CALL_ROOST_R = 240;   // px round a bird that counts as at it (the brain's AI_ROOST_R)

// What each call is. `word` is what prints (a function when the call names
// something), `icon` the glyph beside it (CALL_GLYPHS, js/draw/callouts.js)
// and `ink` its accent. `pin` says whether the ping stays on the ground where
// it was called (a spot) or rides the caller (the caller is the spot).
const CALLS = {
  bird: { word: () => 'BIRD!', icon: 'bird', ink: '#ff9a4d' },
  help: { word: () => 'HELP!', icon: 'help', ink: '#6be38a' },
  low:  { word: (n) => n + ' LOW!', icon: 'low', ink: '#ff5a6a' },
  push: { word: () => 'PUSH!', icon: 'push', ink: '#8fe3ff' },
  here: { word: (n) => n + ' HERE!', icon: 'here', ink: '#ffd166' },
};
const CALL_KINDS = Object.keys(CALLS);

const callouts = []; // live: { k, word, id (caller seat), team, x, y, t }

// The one door in: every call, a bot's own or (later) a scripted bot's
// `act.call`, goes through here. Records itself for the clients, the way a
// floater does, and rings the notch for the screen whose side it is.
function addCallout(k, word, id, team, x, y) {
  if (!CALLS[k]) return;
  evPush('call', [k, word, id, team, x, y]);
  callouts.push({ k, word, id, team, x, y, t: 0 });
  callSaid[team][k] = callSaid[team].any = { t: state.elapsed, x, y };
  if (player && team === player.team && !PRACTICE) SFX.notch();
}

function updateCallouts(dt) {
  for (let i = callouts.length - 1; i >= 0; i--) {
    callouts[i].t += dt;
    if (callouts[i].t >= CALL_T) callouts.splice(i, 1);
  }
  if (PRACTICE) return;
  for (const p of players) {
    if (p.control !== 'ai' || !unitAlive(p)) continue;
    const ai = p.ai;
    if (ai.callCd > 0) ai.callCd -= dt;
    if (ai.callCd > 0 || (state.tick + p.id) % CALL_LOOK) continue;
    const c = callLook(p);
    if (!c || !callFree(p.team, c.k, c.x, c.y)) continue;
    addCallout(c.k, CALLS[c.k].word(c.n), p.id, p.team, Math.round(c.x), Math.round(c.y));
    ai.callCd = CALL_BOT_CD;
  }
}

// may this side say k at (x, y) now?
function callFree(team, k, x, y) {
  let up = 0;
  for (const c of callouts) {
    if (c.team !== team) continue;
    up++;
    if (c.k === k && Math.hypot(c.x - x, c.y - y) < CALL_SAME_R) return false;
  }
  if (up >= CALL_SIDE_MAX) return false;
  // a call that has already faded still counts against a repeat: the side's
  // memory of it is the last-said clock on the kind
  if (callSaid[team].any && state.elapsed - callSaid[team].any.t < CALL_SIDE_GAP) return false;
  const said = callSaid[team][k];
  return !(said && state.elapsed - said.t < CALL_SAME_T && Math.hypot(said.x - x, said.y - y) < CALL_SAME_R);
}
// [team][kind] = { t, x, y } of the side's last call of that kind (`any`: of any kind)
const callSaid = [{}, {}];

// What p would say this look, most urgent first, or null. Everything it reads
// is what its seat could see: rivals through seenAt, both birds (the
// objective is public, as it is on every map).
function callLook(p) {
  const friend = callFriend(p);
  if (!friend) return null;
  const drop = state.drop;
  const own = drop && drop.eagles[p.team], riv = drop && drop.eagles[1 - p.team];
  // its own bird is being hit: the whole side needs to know
  if (own && own.state === 'down' && own.hitT < CALL_BIRD_HIT) return { k: 'bird', x: own.x, y: own.y };
  // the rivals on it, nearest first
  let near = null, nd = CALL_NEAR, low = null;
  for (const q of players) {
    if (q.team === p.team || !unitAlive(q)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d >= seenAt(q, CALL_NEAR)) continue;
    if (d < nd) { nd = d; near = q; }
    if (q.hp < q.maxHp * CALL_LOW_HP && (!low || q.hp < low.hp)) low = q;
  }
  // losing a fight: ask, where it stands
  if (near && p.hp < p.maxHp * CALL_HELP_HP) return { k: 'help', x: p.x, y: p.y };
  // a rival nearly down in front of it: name it, on it
  if (low) return { k: 'low', n: CLASSES[low.cls].name, x: low.x, y: low.y };
  // a bear nearly down: the whole side is paid for it
  for (const a of animals) {
    if (!unitAlive(a) || !MONSTER[a.kind] || !MONSTER[a.kind].big) continue;
    if (a.hp < a.maxHp * CALL_LOW_HP && Math.hypot(a.x - p.x, a.y - p.y) < CALL_NEAR) return { k: 'low', n: 'BEAR', x: a.x, y: a.y };
  }
  // at the rival bird with it wavering: bring the rest
  if (riv && riv.state === 'down' && riv.hp < riv.maxHp * CALL_PUSH_HP && Math.hypot(riv.x - p.x, riv.y - p.y) < CALL_ROOST_R)
    return { k: 'push', x: riv.x, y: riv.y };
  // rivals walking onto its own roost before the bird is touched
  if (own && own.state === 'down' && Math.hypot(own.x - p.x, own.y - p.y) < CALL_ROOST_R + CALL_NEAR) {
    let n = 0, sx = 0, sy = 0;
    for (const q of players) {
      if (q.team === p.team || !unitAlive(q)) continue;
      if (Math.hypot(q.x - own.x, q.y - own.y) >= CALL_ROOST_R || Math.hypot(q.x - p.x, q.y - p.y) >= seenAt(q, CALL_ROOST_R)) continue;
      n++; sx += q.x; sy += q.y;
    }
    if (n) return { k: 'here', n, x: sx / n, y: sy / n };
  }
  return null;
}
// a friend near enough to act on a call, or null (a human counts first: the
// calls are for them)
function callFriend(p) {
  let best = null;
  for (const q of players) {
    if (q === p || q.team !== p.team || !unitAlive(q)) continue;
    if (Math.hypot(q.x - p.x, q.y - p.y) >= CALL_FRIEND_R) continue;
    if (q.control === 'human') return q;
    best = q;
  }
  return best;
}
