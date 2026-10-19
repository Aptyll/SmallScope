'use strict';
// The surrender vote, League's: a side that wants out says so together.
// Any person on a side starts one from the ESC panel's foot (SURRENDER, js/ui/panels.js)
// once the match clock passes VOTE_OPEN; every seat on that side gets the
// panel top centre (js/ui/vote.js) and votes YES or NO with a click. Enough yes and the
// side's bird is called home: the match ends as its loss and its people land
// straight on the post-game stats (endMatch, js/player.js). A vote that
// fails holds the side off a fresh one for VOTE_CD.
// Bots vote with the people on their side: they never start a vote and never
// block one, they just side with however most of the people who voted went.
// Every order rides p.input.cmd ({ kind: 'vote', yes }), so online the host
// counts the votes and a client only draws what the snapshot says.
// ------------------------------------------------------------ surrender vote
const VOTE_OPEN = 15 * 60;  // s of match clock before a side may vote
const VOTE_T = 30;          // s a vote stays open; a seat that never voted counts as no
const VOTE_CD = 180;        // s after a failed vote before the side may start another
const VOTE_HOLD = 1.5;      // s a failed vote's dashes stay up before the panel folds

// the open vote per side (null for none), and the clock time each side may vote again
function votes() { return state.votes || (state.votes = Array(TEAM_COUNT).fill(null)); }
function voteCd() { return state.voteCd || (state.voteCd = Array(TEAM_COUNT).fill(0)); }
// every seat on the side: the panel's dashes, you first
function voteSeats(team) {
  return players.filter((q) => q.active && q.team === team)
    .sort((a, b) => (a === player ? -1 : b === player ? 1 : a.id - b.id));
}
// 4 of 5 yes, as League; a smaller side needs every seat
function voteNeed(n) { return n >= 5 ? n - 1 : n; }
// where a vote stands: the people's yes and no, the people yet to vote, whether
// the bots are with the yes side (more people yes than no), and what that adds up to
function voteTally(v, team) {
  const seats = voteSeats(team), people = seats.filter(isHuman);
  const yes = people.filter((q) => v.yes.includes(q.id)).length;
  const no = people.filter((q) => v.no.includes(q.id)).length;
  const bots = seats.length - people.length, open = people.length - yes - no;
  const botsYes = yes > no;
  // the most yes this vote can still reach: every open seat says yes
  const best = yes + open + (yes + open > no ? bots : 0);
  return { seats, botsYes, yesSeats: yes + (botsYes ? bots : 0), best, need: voteNeed(seats.length) };
}
// can p start a vote right now? Only a person, only on a side still in the
// match with a rival still in it, past the clock and off the cooldown
function voteCanStart(p) {
  if (PRACTICE || !state.drop || state.eagleCine || !isHuman(p) || !p.active) return false;
  if (state.elapsed < VOTE_OPEN || state.elapsed < voteCd()[p.team] || votes()[p.team]) return false;
  return teamInMatch(p.team) && rivalTeamsInMatch(p) > 0;
}
// has p a vote to cast: its side's vote open and p not in it yet
function voteOpenFor(p) {
  const v = votes()[p.team];
  return !!v && !v.hold && isHuman(p) && !v.yes.includes(p.id) && !v.no.includes(p.id);
}
// one order: a yes with no vote open starts one, otherwise it is a vote cast.
// A bot's order is dropped here - it never starts or casts one of its own.
function voteCmd(p, c) {
  if (!isHuman(p)) return;
  const yes = c.yes === true;
  if (voteCanStart(p)) {
    if (!yes) return;
    votes()[p.team] = { t: VOTE_T, yes: [p.id], no: [], hold: 0 };
    return;
  }
  if (!voteOpenFor(p)) return;
  votes()[p.team][yes ? 'yes' : 'no'].push(p.id);
}
// the sim's step: read this step's vote orders off every seat (before
// updatePlayer, which drops the orders of a body that is down or stunned),
// then run each side's clock and settle it
function updateVotes(dt) {
  for (const p of players) {
    const c = p.input.cmd;
    if (c && c.kind === 'vote') { p.input.cmd = null; if (p.active) voteCmd(p, c); }
  }
  const all = votes();
  for (let team = 0; team < all.length; team++) {
    const v = all[team];
    if (!v) continue;
    if (v.hold) { v.hold -= dt; if (v.hold <= 0) all[team] = null; continue; }
    v.t -= dt;
    const T = voteTally(v, team);
    if (T.yesSeats >= T.need) { all[team] = null; surrenderSide(team); continue; }
    if (T.best < T.need || v.t <= 0) { v.hold = VOTE_HOLD; voteCd()[team] = state.elapsed + VOTE_CD; }
  }
}
// the vote passed: the side's bird is called home. Its people leave the
// world (bodyOut: nobody went down, so no death is counted) and are out for
// good, the local one lands on the post-game stats (endMatch, js/player.js),
// and the bird's own takeoff ends the match for the other side the way a
// driven-off bird does (eagleFlee, js/eagle.js)
function surrenderSide(team) {
  state.surrendered = team;
  for (const p of players) {
    if (!p.active || p.team !== team) continue;
    if (!p.dead) bodyOut(p);
    p.eliminated = true; p.respawnT = 0;
    if (p === player) endMatch('lost');
  }
  const e = state.drop.eagles[team];
  if (e && e.state !== 'flee' && e.state !== 'gone') eagleFlee(e, null, 'THE ' + TEAMS[skin(team)].name + ' SIDE SURRENDERED');
}
