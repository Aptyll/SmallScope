'use strict';
// ------------------------------------------------------------ farm
// FARMING, League's last hit: a rival soldier pays whoever lands its final
// blow (robotDies, robots.js) and a camp monster pays its killer
// (animalDies, wildlife.js). Each of those is one FARM on the body's record
// (p.farm, PLAYER_RECORD in player.js), which the scoreboard and the
// post-game page print beside the kills. A soldier the waves, a turret or
// a beast finish pays nobody: that is the miss, and it costs the side the
// whole bounty.
//
// What the eye gets: a gold coin hops up off the body and spins on a last
// hit (the earner's, seen by everyone near), and a grey coin drops and fades
// where a rival soldier died that nobody on your side finished - drawn only
// for that side's screens near it (drawPops, js/draw/pops.js). A pop is
// a cosmetic of the step, so it is recorded for the screens that do not run
// it (evPush, js/net/events.js), and it is aged by the sim's tick, the way a
// damage total is, so a client fades it exactly as the host does.
const SOLDIER_BOUNTY = 16;     // gold the last hit on a rival soldier pays at the start
const SOLDIER_BOUNTY_GROW = 1; // ...and the more it pays for every barracks `grow` (the clock that adds a soldier to the wave)
const COIN_POP_T = 0.8;        // s a coin pop lives
const coinPops = [];           // { x, y, miss, team, tick }: miss pops are for `team`'s screens only

// what the last hit on a rival soldier pays right now
function soldierBounty() {
  return SOLDIER_BOUNTY + SOLDIER_BOUNTY_GROW * Math.floor(state.elapsed / STRUCTS.barracks.tiers[0].grow);
}

// one coin into the air: the gold one off a last hit, or (miss) the grey one
// a side's screens see when a rival soldier it could have farmed died to
// something else
function coinPop(x, y, miss, team) {
  evPush('coin', [x, y, miss, team]);
  for (let i = coinPops.length - 1; i >= 0; i--) {
    if ((state.tick - coinPops[i].tick) * TICK_DT > COIN_POP_T) coinPops.splice(i, 1);
  }
  coinPops.push({ x, y, miss: !!miss, team, tick: state.tick });
}

// a last hit landed by p on a soldier or a camp monster at (x, y)
function farmHit(p, x, y) {
  p.farm++;
  coinPop(x, y, false, p.team);
}
