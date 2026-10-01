'use strict';
// The fixed match set every patch replays (regress.js). Small on purpose: four
// matches cut at six minutes are about a minute of wall clock each on one
// core, the whole set a few minutes. Change it only with a reason, and know that the
// patch run after a change is not comparable with the one before: the diff
// says so when a match's setup differs.
//
// `maxMin` cuts a match at that many minutes of match clock; a cut match is
// a 'timeout' with no winner, and its numbers still compare (fun, kills,
// damage, nerve) patch against patch. `level` is an AI_LEVELS index (js/ai.js).

const MATCHES = [
  { seed: 1, shape: 0, kind: 'level', level: 0, maxMin: 6 },   // OPEN FIELD, NORMAL
  { seed: 3, shape: 1, kind: 'level', level: 0, maxMin: 6 },   // THICKET, NORMAL
  { seed: 4, shape: 2, kind: 'level', level: 1, maxMin: 6 },   // FROZEN ISLES, HARD
  // the baked example bots (bots/*.js) on team 1, the brain on team 0: the
  // bot API's health rides along with every patch
  { seed: 6, shape: 0, kind: 'level', level: 0, maxMin: 6, seats: { 1: 'pack', 3: 'pack', 5: 'keeper', 7: 'pack', 9: 'keeper' } },
];

// the stable name a match keeps from one patch to the next
function keyOf(m) {
  const who = m.kind === 'level' ? 'L' + m.level : 'V' + m.a + m.b;
  return [m.seed, m.shape, who, m.seats ? 'bots' : 'brain'].join('-');
}

module.exports = { MATCHES, keyOf };
