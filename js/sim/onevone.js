'use strict';
// The 1V1 queue's match: one hero a side on the one map, the mid road
// alone (the merchant raises only the mid bay: merchLanes, js/sim/robots.js),
// and League's 1v1 rules for the end: the first side to go down, to lose
// ONEVONE_FARM soldiers' last hits to its rival, or to lose a tower
// sends its bird home (eagleFlee, js/sim/eagle.js), and that ceremony ends
// the match for both screens the way a driven-off bird does.
// ------------------------------------------------------------ 1v1 duel
const ONEVONE_FARM = 100; // soldiers' last hits that win a 1v1
const ONEVONE_POS = 2;    // both heroes' POSITIONS index (js/sim/player.js): MID

// the host's, as the drop begins (beginDrop, js/sim/eagle.js): a 1V1 party's
// match writes its rules into the sim's own state, so the sim never asks the
// party what it is playing. null in every other match.
function onevoneBegin() {
  if (NET.mode !== 'onevone' || PRACTICE) { state.onevone = null; return; }
  state.onevone = { towers: [0, 1].map(onevoneTowers) };
}
function onevoneTowers(team) { let n = 0; for (const o of structures) if (o.type === 'tower' && o.team === team) n++; return n; }
// why side `team` has lost the duel, or null while it has not
function onevoneLost(team) {
  const side = players.filter((p) => p.active && p.team === team);
  if (side.some((p) => p.deaths > 0)) return 'FIRST STRIKE';
  if (players.some((q) => q.active && q.team !== team && q.farm >= ONEVONE_FARM)) return ONEVONE_FARM + ' SOLDIERS';
  if (onevoneTowers(team) < state.onevone.towers[team]) return 'FIRST TOWER';
  return null;
}
// every step of play (updatePlay, js/sim/sim.js): the first side to lose sends its bird home
function updateOnevone() {
  const D = state.onevone;
  if (!D || D.done || state.over === 'won' || state.over === 'lost' || state.eagleCine || !state.drop) return;
  for (const team of [0, 1]) {
    const why = onevoneLost(team), e = state.drop.eagles[team];
    if (!why || !e) continue;
    D.done = why;
    const win = players.find((p) => p.active && p.team !== team) || null;
    if (e.state !== 'flee' && e.state !== 'gone') eagleFlee(e, win, why + ': THE ' + TEAMS[skin(1 - team)].name + ' SIDE WINS THE 1V1');
    return;
  }
}
