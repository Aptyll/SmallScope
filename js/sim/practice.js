'use strict';
// The practice arena behind the PRACTICE TOOL plank: its world, the dummies,
// the archery track and bell, the ice parkour, the roll station, the practice
// bar's commands and the deer ride (drawn by js/draw/practice.js).
// ------------------------------------------------------------ practice arena
// The TRAINING FIELD behind the PRACTICE TOOL plank: one open snowfield, cut
// to pure combat. The practice world itself is SMALL - WORLD is 76 under
// PRACTICE (js/sim/core.js) - so the forest is a collar, not a wilderness. In the
// middle of the field: one dummy standing in the open snow, spawn just
// south of it, and the range BELL and bow rack flanking the dummy on its own
// row - bell west, rack east, mirrored about its axis.
// The archery targets all ride one TWO-RAIL TRACK around the
// field's perimeter - stills, movers and pop-ups on trolleys, movers hopping
// lanes around anything in their way - shoot them from anywhere, roll
// straight past them; ringing the bell runs the timed, scored round over the
// same track. No wildlife, no chests, no pond, no harvest: the world drops
// nothing and asks nothing.
//
// Around the field, through the forest collar, runs the ICE PARKOUR: a
// narrow carved-ice loop (PK_PATH) entered through a flag gate on the west
// side. Ice is mechanically slippery, so the track is the movement pillar as
// a minigame: stepping onto the start line starts the lap clock, a
// checkpoint on the far side keeps a lap honest, and recrossing the line
// records it - the clock rides over the runner's head, and BEST / LAST hang
// on a frost plate at the gate (the dummy meter's own language). Leaving the
// ice for more than PK_OFF_T abandons the run.
//
// Boots only under PRACTICE (js/sim/core.js pins the seed to PRACTICE_SEED, so
// ?seed can never reshape it) and replaces genWorld outright: no camps,
// no eagles, no other players (js/app/boot.js), and the clock is pinned to early
// morning forever (sim.js). One player, nothing at stake - die() revives on
// the spot and the profile is never written (js/sim/player.js), with ONE
// exception: a record parkour lap goes through PROFILE.setBestLap, so the
// gate plate's BEST stands across visits.
const PR_W = 40, PR_H = 23;                      // the open field, in tiles
// the field and the ice loop's collar round it are one PR_RING-tile square
// block, centred across the top of the world; the deer ride's forest wing
// fills the rows under it (the `deer ride` part below). Every fixed parkour
// coordinate is written in the block's own tiles and offset by PR_OX/PR_OY
const PR_RING = 76;
const PR_OX = (WORLD - PR_RING) >> 1, PR_OY = 0;
const PR_X0 = PR_OX + ((PR_RING - PR_W) >> 1), PR_Y0 = PR_OY + ((PR_RING - PR_H) >> 1);
const PR_SPAWN = { tx: PR_X0 + 20, ty: PR_Y0 + 17 }; // south of the rack, facing it and the dummy behind
// who stands on the field: a person on the spawn tile (separateUnits eases
// a party apart), every empty seat parked deep in the corner forest, far
// outside the arena, so no ghost silhouette wanders into a capture
const PR_PARK = { tx: 4, ty: 4 };
function practiceSeat(p) {
  p.spawn = { tx: PR_SPAWN.tx, ty: PR_SPAWN.ty };
  p.x = (PR_SPAWN.tx + 0.5) * TILE; p.y = (PR_SPAWN.ty + 0.5) * TILE;
}
function practiceVacate(p) {
  p.control = 'none';
  p.spawn = { tx: PR_PARK.tx, ty: PR_PARK.ty };
  p.x = (PR_PARK.tx + 0.5) * TILE; p.y = (PR_PARK.ty + 0.5) * TILE;
}
const DUMMY_HP = 60;
const DUMMY_WORK_DMG = 10;   // what one E swing chips off it (the eagle's own number)
const DUMMY_RESET_T = 2.5;   // s unhit before a dummy mends itself back to full
// the damage meter over the dummy's head (drawDummyMeter, js/draw-world.js):
// LAST HIT / DPS / TOTAL for the combo in progress - the string of hits since
// the dummy last went quiet (hitDummy starts the ledger over, js/sim/actions.js).
// It hangs on this long after the mend so the final numbers can be read,
// then fades. DPS is total over first-to-last hit, floored at one second, so
// a single hit reads as itself instead of infinity.
const DUMMY_METER_LINGER = 2.5;
const practiceDummies = [];  // every dummy standing, for updatePractice's mend clock

// ---- the archery track ---------------------------------------------------
// Link's-Crossbow-Training-style targets, all riding ONE piece of furniture:
// a two-rail TRACK ringing the field (AG_RECT, AG_INSET tiles in from the
// rim, so the ring sits in open snow with the treeline well clear of every
// face; drawAgTrack, js/draw-world.js). Every target is a trolley on a rail - ENTITIES in
// `ptargets`, never tile objects (a mover crosses tiles every frame and a
// raised face should not block a walker) - so only arrows meet them: the
// arrow loop (js/sim/sim.js) tests every live face disc (ptFace/ptLive/ptHitR).
// Outside practice the list is empty unless a staged scene (app/media/scenes)
// stands a face in the valley: it holds where it was put (updatePractice,
// which rolls the track, never runs in a match), and one carrying a `word`
// says it in gold when it breaks (hitPTarget). The track has TWO LANES (outer 0, inner 1,
// AG_LANE_GAP px apart): a mover about to run into anything parked - or
// rolling slower - on its rail hops to the free lane and keeps going (the
// hop eases over laneU, a visible little lane change, never a teleport).
//   kind   'still' | 'move' | 'pop'
//   s      distance along the track's perimeter, in px (agPos -> world x/y)
//   lane   the rail it rides (laneU eases toward it); dir/spd a mover's roll
//   size   0 small | 1 large - scales the face and its hit disc (ptHitR)
//   up     0..1 a pop-up's rise out of its trolley (still/move sit at 1)
//   pop    a pop-up's own cycle {hide,rise,hold,sink}; t the behaviour clock
//   stock  the free-practice roster: broken faces respawn where they stood
//          (a round's targets are one-shot - hit means gone and scored)
const PT_HIT_R = 11;         // px around a LARGE face's centre an arrow scores on
const PT_RESPAWN = 2.6;      // s a broken stock face stays gone
const PT_POP = { hide: 1.4, rise: 0.22, hold: 2.4, sink: 0.22 }; // the stock pop cycle
const AG_SPD = [26, 46, 70]; // the stock roster's mover speeds (a round rolls its difficulty's own table, AG_DIFF)
const AG_SIZE = [0.625, 1];  // small / large, as a scale on the 32px face
const AG_LANE_GAP = 7;       // px between the outer and inner rail
const AG_POST = 8;           // px of post between trolley and face bottom
const AG_INSET = 3;          // tiles the ring sits in from the field's rim
const AG_RECT = {            // the outer rail, ringing the open snow well inside the treeline
  x0: (PR_X0 + AG_INSET) * TILE, y0: (PR_Y0 + AG_INSET) * TILE,
  x1: (PR_X0 + PR_W - AG_INSET) * TILE, y1: (PR_Y0 + PR_H - AG_INSET) * TILE,
};
const AG_LEN = 2 * ((AG_RECT.x1 - AG_RECT.x0) + (AG_RECT.y1 - AG_RECT.y0));
const ptargets = [];

// where a trolley at track distance s stands, laneU easing it in toward the
// inner rail - clockwise from the NW corner, the one parametrisation the
// update, the arrow test and the rails' pixels all hang off
function agPos(s, laneU) {
  const w = AG_RECT.x1 - AG_RECT.x0, h = AG_RECT.y1 - AG_RECT.y0;
  const inset = laneU * AG_LANE_GAP;
  s = ((s % AG_LEN) + AG_LEN) % AG_LEN;
  if (s < w) return { x: AG_RECT.x0 + s, y: AG_RECT.y0 + inset };
  if (s < w + h) return { x: AG_RECT.x1 - inset, y: AG_RECT.y0 + (s - w) };
  if (s < w * 2 + h) return { x: AG_RECT.x1 - (s - w - h), y: AG_RECT.y1 - inset };
  return { x: AG_RECT.x0 + inset, y: AG_RECT.y1 - (s - w * 2 - h) };
}
// which run of the ring s is on (0 top, 1 right, 2 bottom, 3 left) - odd
// means the rail runs vertically, which is how drawPTarget knows to seat a
// carriage's wheels along the rail's own axis
function agEdge(s) {
  const w = AG_RECT.x1 - AG_RECT.x0, h = AG_RECT.y1 - AG_RECT.y0;
  s = ((s % AG_LEN) + AG_LEN) % AG_LEN;
  return s < w ? 0 : s < w + h ? 1 : s < w * 2 + h ? 2 : 3;
}

function addPTarget(kind, s, opts) {
  const t = Object.assign({
    kind, s: ((s % AG_LEN) + AG_LEN) % AG_LEN,
    lane: 0, laneU: 0, dir: 1, spd: 0, spdClass: 0, size: 1,
    up: 1, t: 0, pop: null, broken: 0, wob: 0, swapT: 0,
    stock: false, gone: false, x: 0, y: 0,
    // the little tells: dustD paces a mover's snow trail by distance rolled,
    // hopping arms the lane-swap landing puff, warned/prevUp edge a pop-up's
    // pre-rise rattle fleck and its lock-up bounce once per cycle
    dustD: 0, hopping: false, warned: -1, prevUp: 0,
  }, opts || {});
  if (t.kind === 'pop') { t.up = 0; if (!t.pop) t.pop = PT_POP; }
  t.laneU = t.lane;
  // a raider stands where it was put; a post off the track (`at`, the deer
  // ride's) stands there for good; everything else rides the rail
  if (t.kind !== 'raid') { const p0 = t.at || agPos(t.s, t.laneU); t.x = p0.x; t.y = p0.y; }
  ptargets.push(t);
  return t;
}

// where a face's centre is right now, in world px - the one geometry the
// update, the arrow test and the draw all share, so they can never disagree
function ptFace(t) {
  if (t.kind === 'raid') return { x: t.x, y: t.y - DF_FACE_Y - t.hopY }; // a raider's painted chest ring (DEFEND)
  const fh = 32 * AG_SIZE[t.size];
  // a pop-up's face flips up out of its trolley: bottom edge pinned at the
  // mouth, so the centre rides the rise (exactly how drawPTarget anchors it)
  if (t.kind === 'pop') return { x: t.x, y: t.y - 4 - fh * t.up / 2 };
  return { x: t.x, y: t.y - AG_POST - fh / 2 };
}
// the face's hit disc, scaled with its size
function ptHitR(t) { return t.kind === 'raid' ? DF_HIT_R : PT_HIT_R * AG_SIZE[t.size]; }
// can an arrow score on it this frame
function ptLive(t) { return !t.gone && t.broken <= 0 && (t.kind !== 'pop' || t.up > 0.6); }

// one arrow into the face and it EXPLODES, that frame - points, popup, the
// run and the shatter all land on impact, so the feedback is instant and the
// round clock can never eat a landed shot. Then a STOCK target's mast stands
// bare until the respawn springs a fresh face, while a ROUND target is spent
// for good. Points: small, fast and pop-up all pay extra, so the shot that
// was harder to make is worth more.
function hitPTarget(t) {
  const f = ptFace(t);
  agStreak++;
  // a target that carries a WORD says it instead of scoring: gold, rising
  // and fading in the damage totals' own ink (wordPop, js/sim/core.js)
  if (t.word) { wordPop(f.x, f.y - 6, t.word); agShatter(t); return; }
  // a milestone run flares at the face: gold at every fifth in a row, hot
  // orange from ten - the popup says the number, this says the moment
  if (agStreak >= AG_RUN_STEP && agStreak % AG_RUN_STEP === 0) {
    burst(f.x, f.y, agStreak >= 10 ? '#ff9440' : '#ffd95c', 10, 70, 0.5, true);
    SFX.runUp(agStreak); // ...and it rings higher the longer the run is
  }
  if (!t.stock && agame.phase === 'play') {
    // the round in play says what the hit is worth and what its popup reads
    // (AG_ROUNDS: the range pays points, quick draw pays time)
    const pop = AG_ROUNDS[agame.mode].hit(t);
    agame.hits++;
    // the popup wears the run from the second hit on
    addFloater(f.x, f.y - 6, pop + (agStreak > 1 ? ' X' + agStreak : ''), '#ffd95c');
  } else if (agStreak > 1) {
    // free practice pays nothing, so the popup IS the run - white, gold from
    // five in a row, hot orange from ten
    addFloater(f.x, f.y - 6, 'X' + agStreak,
      agStreak >= 10 ? '#ff9440' : agStreak >= 5 ? '#ffd95c' : '#f4f7ff');
  }
  agShatter(t); // the break IS the hit feedback - no beat between them
}

// the shatter: chips, straw, splinters and the shock ring, and the face is
// gone - back on a respawn clock if it was stock, for good if it was a
// round target
function agShatter(t) {
  const f = ptFace(t);
  const sc = AG_SIZE[t.size];
  burst(f.x, f.y, '#d0453a', Math.round(10 * sc), 60, 0.5, true);   // painted chips
  burst(f.x, f.y, '#efe6d0', Math.round(8 * sc), 55, 0.5, true);    // straw backing
  burst(f.x, f.y, '#a3794f', 5, 45, 0.45, true);                    // splinters
  agRings.push({ x: f.x, y: f.y, t: 0, max: ptHitR(t) + 5 });       // the shock ring
  if (t.stock) { t.broken = PT_RESPAWN; t.wob = 0; }
  else t.gone = true;  // updatePractice sweeps it out of the array
  sfxAt('break_', f.x, f.y);
}

// ---- the archery round: one bell -----------------------------------------
// The BELL west of the dummy starts the round on the die's own grammar:
// HOLDING E beside it (agBellNear - shared by the E RING cap, drawBellHint
// in js/ui.js, and the press in js/app/input.js) opens a three-wedge radial
// wheel (kind 'agbell', the ordinary wheel pipeline) - one wedge per round
// (AG_WEDGES: RANGE, QUICK DRAW, DEFEND), each in its own mark with its best
// medal, the last-rung one wearing a gold frame. Releasing on a
// wedge IS the ring (agRing, through the same input.cmd -> runCmd path every
// order takes): the stock roster bursts away, the dummy, the rack AND THE
// BELL ITSELF sink under the snow (their objects leave the grid at full
// depth, so nothing blocks a shot or a runner - which is also why a running
// round cannot be rung off: the timer alone ends it), a 3-2-1 countdown
// lands, and - for the RANGE, the rest are AG_ROUNDS below - for AG_T
// seconds random targets pour onto the track from a spawn table that climbs
// with the clock (AG_DIFF: mover speeds, small/pop odds, crowd cap and
// refill pace, in AG_RANGE_DIFF order) - each worth points on hitPTarget's
// harder-shot-pays-more rule. Time out and the round ends: the score stands
// as LAST, a strictly higher one writes BEST through PROFILE.setBestRange -
// the range's own all-time record beside the parkour's lap - the furniture
// rises back out of the snow and the stock roster springs back on. The bell
// never wears the pick (no recolour - the wheel's gold frame is the
// readout); the readouts (the countdown, the top-centre TIME/SCORE/HITS
// plate, the bell's BEST/LAST frost plate) live in drawAgameUI / drawAgame,
// js/draw-world.js.
const AG_T = 30;         // s a round runs
const AG_COUNT_T = 3;    // the countdown, one tick per second
const AG_SINK_T = 0.9;   // s the dummy, rack and bell take to sink / rise
const AG_END_T = 2.4;    // s the final score stands before the field resets
const AG_BELL = { tx: PR_X0 + 15, ty: PR_Y0 + 12 }; // the bell, west of the dummy on its own row
// one spawn table per difficulty, which the range climbs: spd = the
// three mover speeds (scored by class, not raw px/s), small/still/pop the
// mix odds (move takes the rest), max/spawnT the crowd and its refill pace
const AG_DIFF = {
  easy:   { spd: [20, 34, 50], small: 0.22, still: 0.42, pop: 0.22, max: 6, spawnT: 1.8 },
  medium: { spd: [26, 46, 70], small: 0.40, still: 0.30, pop: 0.25, max: 7, spawnT: 1.5 },
  hard:   { spd: [34, 60, 90], small: 0.58, still: 0.16, pop: 0.32, max: 9, spawnT: 1.1 },
};
// QUICK DRAW: one face on the track at a time, a short clock, and every hit
// buys time back - how long can you keep it alive. Every QD_STEP hits the
// round climbs a stage (QD_STAGES: what the next face is, top to bottom, and
// how much time it buys), and each face appears within QD_NEAR px of you when
// the track has a spot that close, so the draw is the test, not the walk.
const QD_START = 6;        // s on the clock as the window opens
const QD_MAX = 9;          // s the clock can bank, so a hot run still has to keep shooting
const QD_STEP = 5;         // hits per stage
const QD_GAP = 0.18;       // s between a break and the next face
const QD_NEAR = 190;       // px: how close to the archer a new face prefers to stand
const QD_STAGES = [
  { kind: 'still', size: 1, add: 2.0 },
  { kind: 'still', size: 0, add: 1.8 },
  { kind: 'move', size: 1, spd: 46, add: 1.7 },
  { kind: 'pop', size: 0, hold: 1.2, add: 1.6 },
  { kind: 'move', size: 0, spd: 74, add: 1.5 },
];
// What a bell round IS lives here, one entry per round (CLAUDE.md: never in
// an if): its wheel wedges, its starting clock, how it opens and runs, what
// a hit pays and says, the plate's rows, and where its record is kept.
// agame.mode names the one in play; agUpdate and hitPTarget only ever ask it.
const AG_ROUNDS = {
  range: {
    name: 'RANGE',
    clock: AG_T,
    medals: [150, 300, 450], // score for bronze / silver / gold
    begin() { agame.diff = AG_RANGE_DIFF[0]; for (let i = 0; i < 4; i++) agSpawn(); },
    tick(dt) {
      // the range climbs its own tables: a third of the clock on each
      agame.diff = AG_RANGE_DIFF[Math.min(AG_RANGE_DIFF.length - 1, Math.floor(agame.t / (AG_T / AG_RANGE_DIFF.length)))];
      const S = AG_DIFF[agame.diff] || AG_DIFF.medium;
      agame.spawnT -= dt;
      if (agame.spawnT <= 0 && ptargets.length < S.max) { agSpawn(); agame.spawnT = S.spawnT; }
    },
    // speed pays by CLASS (slow/medium/fast), not raw px/s - the classes
    // mean the same thing on every difficulty's speed table
    hit(t) {
      const pts = 10 + (t.size === 0 ? 10 : 0) + (t.kind === 'pop' ? 10 : 0) +
        (t.spd > 0 ? [0, 5, 10][t.spdClass] || 0 : 0);
      agame.score += pts;
      return '+' + pts;
    },
    over: () => agame.left <= 0,
    end: () => agame.lastHits + ' HITS',
    rows: () => [agTimeRow(5), ['SCORE', String(agame.score), '#f4f7ff'], ['HITS', String(agame.hits), '#e0c890']],
    best: () => PROFILE.bestRange(),
    setBest: (n) => PROFILE.setBestRange(n),
  },
  quick: {
    name: 'QUICK DRAW',
    clock: QD_START,
    medals: [10, 20, 30], // hits
    begin() { agame.spawnT = 0; },
    tick(dt) {
      if (ptargets.length) return;
      agame.spawnT -= dt;
      if (agame.spawnT <= 0) qdSpawn();
    },
    hit() {
      const st = QD_STAGES[qdStage()];
      agame.left = Math.min(QD_MAX, agame.left + st.add);
      agame.score++;
      agame.spawnT = QD_GAP;
      if (agame.score % QD_STEP === 0 && qdStage() > 0) SFX.place(); // a new stage opens
      return '+' + st.add.toFixed(1) + 'S';
    },
    over: () => agame.left <= 0,
    end: () => 'STAGE ' + (qdStage() + 1),
    rows: () => [agTimeRow(2), ['HITS', String(agame.score), '#f4f7ff'], ['STAGE', String(qdStage() + 1), '#e0c890']],
    best: () => PROFILE.bestRound('quick'),
    setBest: (n) => PROFILE.setBestRound('quick', n),
  },
  defend: {
    name: 'DEFEND',
    medals: [8, 16, 28], // raiders downed
    clock: 0, // no clock: it runs until the raiders get through DF_LIVES times
    begin() { agame.lives = DF_LIVES; agame.spawnT = DF_FIRST; agame.dfGap = DF_GAP0; },
    tick(dt) {
      agame.left = 0;
      agame.spawnT -= dt;
      if (agame.spawnT <= 0) {
        dfSpawn();
        agame.dfGap = Math.max(DF_GAP_MIN, agame.dfGap * DF_GAP_MUL);
        agame.spawnT = agame.dfGap;
      }
    },
    hit() { agame.score++; return '+1'; },
    over: () => agame.lives <= 0,
    end: () => 'HELD ' + Math.floor(agame.t) + 'S',
    rows: () => [['TIME', String(Math.floor(agame.t)), '#ffd95c'], ['DOWNED', String(agame.score), '#f4f7ff'],
      ['LIVES', String(agame.lives), agame.lives <= 1 ? '#ff6a5a' : '#e0c890']],
    best: () => PROFILE.bestRound('defend'),
    setBest: (n) => PROFILE.setBestRound('defend', n),
  },
};
// the plate's clock row: gold, red for its last `warn` seconds
function agTimeRow(warn) {
  const left = Math.max(0, agame.left);
  return ['TIME', left.toFixed(1), left < warn + 0.05 ? '#ff6a5a' : '#ffd95c'];
}
// DEFEND: straw RAIDERS - the field dummy's own body, hopping on its post -
// come in off the field's rim and make for the HOLD (the field's centre,
// where the dummy sank), each one arrow to drop. One that reaches the hold
// costs a life; DF_LIVES gone ends it, and the score is how many went down.
// They come faster and closer together the longer you hold (DF_*). A raider
// is a target, not a unit: it rides ptargets beside the rail faces (only
// arrows meet it, nothing blocks on it), and it hops a straight line across
// the round's emptied field - the round has sunk everything that stood on
// it - so it needs no path.
const DF_LIVES = 3;
const DF_FIRST = 1.2;      // s before the first raider
const DF_GAP0 = 2.6;       // s between raiders at the start...
const DF_GAP_MUL = 0.94;   // ...shrinking by this each raider...
const DF_GAP_MIN = 0.8;    // ...to no closer than this
const DF_SPD0 = 15;        // px/s the first raiders cover
const DF_SPD_UP = 0.45;    // px/s more for every raider downed
const DF_SPD_MAX = 34;
const DF_HOP_T = 0.42;     // s one hop takes; a raider covers ground only in the air
const DF_HOP_H = 5;        // px a hop lifts it
const DF_REACH = 14;       // px from the hold's centre that counts as through
const DF_FACE_Y = 20;      // px from its feet up to the chest ring
const DF_HIT_R = 8;        // px around the ring an arrow drops it on
const DF_HOLD = { x: (PR_X0 + 20.5) * TILE, y: (PR_Y0 + 12.5) * TILE }; // the field dummy's own tile
// one raider onto the field's rim, on a side and spot rolled fresh
// (runtime rng() - world.md), never right on top of the archer
function dfSpawn() {
  const a = players[agame.pid] || players[0];
  const x0 = (PR_X0 + 1) * TILE, x1 = (PR_X0 + PR_W - 1) * TILE;
  const y0 = (PR_Y0 + 1) * TILE, y1 = (PR_Y0 + PR_H - 1) * TILE;
  let x = 0, y = 0;
  for (let i = 0; i < 8; i++) {
    const side = (rng() * 4) | 0, u = rng();
    x = side === 1 ? x1 : side === 3 ? x0 : x0 + u * (x1 - x0);
    y = side === 0 ? y0 : side === 2 ? y1 : y0 + u * (y1 - y0);
    if (Math.hypot(x - a.x, y - a.y) > 90) break;
  }
  const t = addPTarget('raid', 0, { x, y, lane: -1, spd: Math.min(DF_SPD_MAX, DF_SPD0 + DF_SPD_UP * agame.score),
    hopY: 0, t: rng() * DF_HOP_T });
  t.wob = 0.3;
  burst(x, y - 6, '#e0c890', 6, 40, 0.45, true);
  burst(x, y - 2, '#f4f7ff', 5, 35, 0.4, true);
}
// a raider's hop toward the hold, from updatePractice: it gains ground only
// while it is in the air, and one that lands within DF_REACH is through
function dfStep(t, dt) {
  const u = (t.t % DF_HOP_T) / DF_HOP_T;
  t.hopY = Math.sin(Math.PI * u) * DF_HOP_H;
  const dx = DF_HOLD.x - t.x, dy = DF_HOLD.y - t.y, d = Math.hypot(dx, dy);
  if (d <= DF_REACH) {
    t.gone = true;
    if (agame.phase === 'play' && agame.mode === 'defend') {
      agame.lives--; agame.hurtT = 0.5;
      agStreak = 0; // a raider through ends the run
    }
    burst(t.x, t.y - 10, '#e0c890', 10, 60, 0.5, true);
    burst(t.x, t.y - 10, '#d0453a', 6, 50, 0.45, true);
    sfxAt('break_', t.x, t.y);
    return;
  }
  const step = Math.min(d, t.spd * dt * 2); // twice its pace aloft, still on the ground
  if (u > 0.08 && u < 0.92) { t.x += dx / d * step; t.y += dy / d * step; }
  else if (t.prevU > 0.5 && u < 0.5) burst(t.x, t.y + 1, '#f4f7ff', 2, 18, 0.3, true); // the landing puff
  t.prevU = u;
}
// the bell's wheel, wedge by wedge: one per round
const AG_WEDGES = ['range', 'quick', 'defend'];
function agRoundOf(id) { return AG_ROUNDS[id] ? id : null; }
// the range's spawn tables in the order a round climbs them
const AG_RANGE_DIFF = ['easy', 'medium', 'hard'];
// the medal a score earns in a round: 0 none, 1 bronze, 2 silver, 3 gold
// (the thresholds are each round's `medals`; untuned first guesses)
function agMedal(mode, score) {
  const M = AG_ROUNDS[mode].medals;
  let m = 0;
  while (m < M.length && score >= M[m]) m++;
  return m;
}
// quick draw's stage, off the hits so far
function qdStage() { return Math.min(QD_STAGES.length - 1, Math.floor(agame.score / QD_STEP)); }
// quick draw's next face: the stage's kind, on a track spot near the archer
function qdSpawn() {
  const st = QD_STAGES[qdStage()], a = players[agame.pid] || players[0];
  let s = rng() * AG_LEN;
  for (let i = 0; i < 16; i++) {
    const c = rng() * AG_LEN, q = agPos(c, 0);
    if (Math.hypot(q.x - a.x, q.y - a.y) <= QD_NEAR) { s = c; break; }
  }
  const t = addPTarget(st.kind, s, {
    lane: rng() < 0.5 ? 0 : 1, size: st.size, dir: rng() < 0.5 ? 1 : -1,
    spd: st.spd || 0, spdClass: st.spd ? 1 : 0,
    pop: st.kind === 'pop' ? { hide: 0.35, rise: 0.18, hold: st.hold, sink: 0.18 } : null,
  });
  t.wob = 0.3;
  burst(t.x, t.y - 8, '#f4f7ff', 6, 40, 0.45, true);
}
// phase: off | sink | count | play | end. `diff` is the spawn table the
// range is on right now (it climbs AG_RANGE_DIFF with the clock). `best` is the
// profile's record, seeded at gen and written on a strictly higher score;
// last/lastHits are this visit's. `tick` edges the countdown SFX, dustT
// paces the sink dust.
// `mode` is the round in play (AG_ROUNDS), `left` its clock - a range round
// only runs down, quick draw's buys time back - and `bests` each round's
// record, seeded at gen; `best` is the mode's, for the bell's plate.
const agame = { phase: 'off', t: 0, score: 0, hits: 0, last: 0, lastHits: 0,
  best: 0, record: false, diff: 'medium', mode: 'range', pid: 0, left: 0, bests: {}, spawnT: 0, tick: 0, dustT: 0,
  lives: 0, hurtT: 0, dfGap: 0, lastLine: '', lastMedal: 0 }; // DEFEND's: lives left, the plate's red flash, the raiders' spacing
let agBellObj = null;    // the bell object, for its ring animation
let agFurniture = [];    // the dummy + rack + bell objects the round sinks away
// the consecutive-hit run: every arrow into a face extends it, minigame or
// not, and any practice arrow that ends without striking a face breaks it
// (the arrow loop, js/sim/sim.js). The hit popup carries it from the second hit
// on - hotter-coloured as the run grows - and a fresh round starts it over.
let agStreak = 0;
// the run's MILESTONE, every one of which flares at the face and rings
// (SFX.runUp, pitched up as the run climbs) - and the length a run has to
// reach before losing it is worth hearing at all (SFX.runBroke, the arrow
// loop in js/sim/sim.js). One number, or the flare and the cue disagree about
// what a milestone is.
const AG_RUN_STEP = 5;
// the hit-ring flash: every face break snaps one quick shock ring out from
// the hit, sized to the face it came off (agShatter pushes, updatePractice
// ages, drawAgRings in js/draw-world.js draws)
const AG_RING_T = 0.22;  // s a ring lives
const agRings = [];      // { x, y, t, max }

// how far apart two track distances are, the short way round the ring
function agDist(a, b) {
  const d = Math.abs(a - b) % AG_LEN;
  return Math.min(d, AG_LEN - d);
}
// anything parked or rolling on this lane within r of s - what a spawn
// point and a lane hop's landing zone both check
function agBlocked(lane, s, r, skip) {
  for (const t of ptargets) {
    if (t === skip || t.gone || t.at || t.lane !== lane) continue; // a post off the track is on no rail
    if (agDist(t.s, s) < r) return true;
  }
  return false;
}

// how deep the furniture is right now: 0 standing, 1 under the snow - the
// dummy and rack draw branches (js/render.js) crop and drop their sprites by
// it, so the whole sink is one number and no second animation state
function agSinkU() {
  if (agame.phase === 'sink') return Math.min(1, agame.t / AG_SINK_T);
  if (agame.phase === 'end') return Math.max(0, 1 - agame.t / AG_SINK_T);
  return agame.phase === 'off' ? 0 : 1;
}

// the bell the player is standing at - Chebyshev 1, E's own reach - shared
// by the E RING prompt (drawBellHint, js/ui.js) and the press (js/app/input.js)
function agBellNear(p) {
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const o = objAt(ptx + dx, pty + dy);
    if (o && o.type === 'agbell') return o;
  }
  return null;
}

// a round released off the bell's wheel, through runCmd: the wedge IS
// the ring (the roll die's own grammar) - it arms that round and winds
// the round up, the stock roster leaving with the furniture. Only an idle
// range answers: mid-round the bell is under the snow, and the sink and
// rise phases are mid-ceremony. PRACTICE-gated like pkWheelPick.
function agRing(p, c) {
  const mode = agRoundOf(c.id);
  if (!PRACTICE || agame.phase !== 'off' || !mode) return;
  if (Math.hypot(c.tx * TILE + 8 - p.x, c.ty * TILE + 8 - p.y) > 60) return;
  agame.mode = mode; agame.pid = p.id;
  agame.best = agame.bests[mode] || 0;
  if (agBellObj) agBellObj.ring = 0.9;
  SFX.dawnChime();
  agame.phase = 'sink'; agame.t = 0; agame.dustT = 0;
  agame.score = 0; agame.hits = 0;
  agStreak = 0; // the round's run is its own
  for (const t of ptargets) { const f = ptFace(t); burst(f.x, f.y, '#f4f7ff', 5, 40, 0.4, true); }
  ptargets.length = 0;
}

// the round closes: bank LAST (and BEST through the profile on a strictly
// higher score), sweep the unshot targets away, put the furniture back on
// the grid and let the rise play out - agUpdate flips to 'off' and restocks
// the free-practice roster once the final score has stood AG_END_T
function agEndRound() {
  agame.last = agame.score; agame.lastHits = agame.hits;
  agame.lastLine = AG_ROUNDS[agame.mode].end(); // what stands under the final score
  agame.lastMedal = agMedal(agame.mode, agame.score);
  agame.record = agame.score > 0 && agame.score > agame.best;
  if (agame.record) { agame.best = agame.bests[agame.mode] = agame.score; AG_ROUNDS[agame.mode].setBest(agame.score); }
  agame.phase = 'end'; agame.t = 0; agame.dustT = 0;
  for (const t of ptargets) { const f = ptFace(t); burst(f.x, f.y, '#f4f7ff', 5, 40, 0.4, true); }
  ptargets.length = 0;
  for (const o of agFurniture) objects[idx(o.tx, o.ty)] = o;
  if (agame.record) SFX.record(); else SFX.place();
}

// one random target onto the track, from the armed difficulty's spawn table
// (AG_DIFF): habit, lane, size, speed and clock all rolled fresh (runtime
// rng() reshuffles nothing - world.md), the spawn point retried away from
// anything already parked there, and a wobble-in with a poof so a face
// never just blinks into being
function agSpawn() {
  const S = AG_DIFF[agame.diff] || AG_DIFF.medium;
  const r = rng();
  const kind = r < S.still ? 'still' : r < 1 - S.pop ? 'move' : 'pop';
  const lane = rng() < 0.5 ? 0 : 1;
  let s = rng() * AG_LEN;
  for (let i = 0; i < 8 && agBlocked(lane, s, 26); i++) s = rng() * AG_LEN;
  const sc = (rng() * 3) | 0; // the mover speed class - what the score reads
  const t = addPTarget(kind, s, {
    lane, size: rng() < S.small ? 0 : 1,
    dir: rng() < 0.5 ? 1 : -1,
    spd: kind === 'move' ? S.spd[sc] : 0,
    spdClass: kind === 'move' ? sc : 0,
    pop: kind === 'pop' ? { hide: rand(0.7, 1.8), rise: 0.22, hold: rand(1.1, 2.2), sink: 0.22 } : null,
  });
  t.wob = 0.45;
  burst(t.x, t.y - 8, '#f4f7ff', 6, 40, 0.45, true);
}

// the free-practice roster: the fixed mix that stands between rounds -
// stills of both sizes, one slow and one fast mover, pop-ups on offset
// clocks - every one respawning where it stood when shot (stock: true)
function agStock(quiet) {
  ptargets.length = 0;
  const w = AG_RECT.x1 - AG_RECT.x0, h = AG_RECT.y1 - AG_RECT.y0;
  addPTarget('still', w * 0.5, { stock: true });                                   // top centre
  addPTarget('still', w + h * 0.5, { stock: true, size: 0, lane: 1 });             // east, small, inner rail
  addPTarget('still', w * 2 + h + h * 0.75, { stock: true });                      // west, above the gate walk
  addPTarget('move', w * 0.2, { stock: true, spd: AG_SPD[0], dir: 1 });            // the slow patroller
  addPTarget('move', w + h + w * 0.5, { stock: true, spd: AG_SPD[2], spdClass: 2, dir: -1, size: 0, lane: 1 }); // the fast small one
  addPTarget('pop', w * 0.15, { stock: true, t: 0 });
  addPTarget('pop', w + h * 0.8, { stock: true, t: 1.4, size: 0 });
  addPTarget('pop', w + h + w * 0.7, { stock: true, t: 2.7 });
  // ...and the three posts along the deer ride, off the track (`at`)
  for (const [tx, ty] of RD_TARGETS) addPTarget('still', 0, { stock: true, at: { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE } });
  if (!quiet) for (const t of ptargets) burst(t.x, t.y - 8, '#f4f7ff', 5, 38, 0.4, true);
}

// the round's clock, from updatePractice: the sink hands the furniture off
// the grid, the countdown ticks, the play window spawns and times out, and
// the end phase lets the score stand while the furniture rises back
function agUpdate(dt) {
  if (agBellObj && agBellObj.ring > 0) agBellObj.ring = Math.max(0, agBellObj.ring - dt);
  const G = agame;
  if (G.phase === 'off') return;
  G.t += dt;
  // snow dusting off the sinking / rising furniture, only while it moves
  if ((G.phase === 'sink' || (G.phase === 'end' && G.t < AG_SINK_T)) && (G.dustT -= dt) <= 0) {
    G.dustT = 0.07;
    for (const o of agFurniture) {
      burst(o.tx * TILE + 8 + rand(-5, 5), (o.ty + 1) * TILE - 1, rng() < 0.7 ? '#f4f7ff' : '#c4d4ea', 2, 30, 0.4, true);
    }
  }
  if (G.phase === 'sink') {
    if (G.t >= AG_SINK_T) {
      // under the snow the furniture leaves the grid entirely: nothing left
      // to block a shot, a runner, or raise a prompt - agEndRound puts the
      // exact objects back (a tool is an instance; so is a dummy's ledger)
      for (const o of agFurniture) objects[idx(o.tx, o.ty)] = null;
      G.phase = 'count'; G.t = 0; G.tick = AG_COUNT_T + 1;
    }
  } else if (G.phase === 'count') {
    const left = Math.ceil(AG_COUNT_T - G.t);
    if (left !== G.tick) { G.tick = left; if (left > 0) SFX.countTick(); }
    if (G.t >= AG_COUNT_T) {
      const R = AG_ROUNDS[G.mode];
      G.phase = 'play'; G.t = 0; G.left = R.clock; G.spawnT = (AG_DIFF[G.diff] || AG_DIFF.medium).spawnT;
      R.begin();
      SFX.place();
    }
  } else if (G.phase === 'play') {
    const R = AG_ROUNDS[G.mode];
    G.left -= dt;
    if (G.hurtT > 0) G.hurtT -= dt;
    R.tick(dt);
    if (R.over()) { G.left = 0; agEndRound(); }
  } else if (G.phase === 'end') {
    if (G.t >= AG_END_T) { G.phase = 'off'; agStock(false); }
  }
}

// ---- the ice parkour -----------------------------------------------------
// PK_PATH is the STOCK loop's centreline in world tiles (the practice WORLD
// is a fixed 76, so these are absolute), carved 2-3 tiles wide through the
// forest collar by genPracticeWorld - trees hug both sides, and ice being
// mechanically slippery IS the whole game of it. The lap: step onto the
// start-line ice under the west flag gate (the clock starts), round the far
// checkpoint, recross the line (the clock records). Both line and checkpoint
// are plain coordinate tests against the carved ice, not objects.
//
// The stock loop is only the FIRST track: the roll station just inside the
// gate (pkRoll below) recarves the collar into a fresh random loop, so
// everything that must survive a reroll is anchored - the gate, its walk and
// the start line never move (every generated loop is pinned to them), the
// checkpoint is wherever parkour.cpTx/cpTy says this track's far side is,
// and pkTiles remembers the carve so the old track can grow back into forest.
// The loop rides an ellipse around the field's centre (PK_CX/PK_CY), with a
// deep tree belt between track and field: PK_APRON tiles of forest that no
// waypoint, chord or carve may enter, so the run reads as a lane cut through
// woods rather than the hem of the clearing. The field's block is PR_RING
// tiles square to give the collar that depth on every side.
const PK_CX = PR_X0 + (PR_W >> 1), PK_CY = PR_Y0 + 11; // the field's centre tile, (38, 37) in the block
const PK_RX = 30, PK_RY = 26;  // the loop's base radii, in tiles
const PK_APRON = 6;            // tree belt between field and anything the track does
const PK_PATH = [
  [8, 37], [8, 29], [6, 22], [9, 16],                            // west leg, up
  [16, 11], [26, 15], [36, 10], [45, 15], [55, 11], [63, 16],    // the top slalom
  [68, 22], [66, 30], [69, 37], [66, 45], [68, 54],              // east leg, down
  [62, 59], [52, 64], [43, 59], [33, 64], [24, 59],              // the bottom slalom
  [15, 63], [9, 57], [7, 49], [8, 42], [8, 37],                  // and home
].map(([x, y]) => [PR_OX + x, PR_OY + y]);
// The start/finish line is a FIXED five-tile checker band: pkPlanCarve
// force-ices exactly this strip on every carve, whatever width the roll cut
// the lane, so the line never stretches, never gaps, and the coordinate test
// that times laps is the same box that is painted. A flag stands at each end.
const PK_LINE = { x0: PR_OX + 6, x1: PR_OX + 10, y: PR_OY + 37 };
const PK_OFF_T = 2.5;  // s off the ice before a live run is abandoned
const PK_GATE = { x: (PR_OX + 5.5) * TILE, y: (PR_OY + 34.5) * TILE }; // where the BEST/LAST plate hangs, over the west line flag
// the walk out of the field: cleared snow the reroll must never ice or tree
const PK_WALK = { x0: PR_OX + 10, x1: PR_OX + 18, y0: PR_OY + 36, y1: PR_OY + 37 };
// one runner, one clock: the live lap (on/t/cp), the abandon timer, and the
// last and best laps. `best` is the profile's all-time record - seeded from
// PROFILE.bestLap() by genPracticeWorld and written back through
// PROFILE.setBestLap() on a record, the one thing practice ever writes -
// while `last` is this session's only. A ROLLED track flips `custom`: its
// laps are its own (best/last restart at 0 and never touch the profile -
// random loops are not comparable, so a persistent record over them would be
// a lie), and the profile's record stays what it says it is: the stock lap.
// `diff` is the current track's difficulty - the die wears it as its body
// colour - and cpTx/cpTy is THIS track's checkpoint.
const parkour = { on: false, t: 0, cp: false, wasLine: false, offT: 0, last: 0, best: 0,
  diff: 'easy', custom: false, cpTx: PR_OX + 69, cpTy: PR_OY + 37 };

// ---- the roll station: one die, one held wheel ---------------------------
// A die on a pedestal in a felled nook off the walk rerolls the loop: HOLD E
// beside it (pkDieNear - the armory rack's own proximity gesture, wired in
// js/app/input.js and hinted by drawPkHint, js/ui.js) and a three-wedge radial
// wheel opens - one wedge per difficulty, each drawn as that difficulty's
// coloured die. Releasing on a wedge IS the roll: it carves a fresh track at
// that difficulty (pkWheelPick, the same input.cmd -> runCmd path every
// wheel uses), and the station's die recolours to match (PK_DIE_COL,
// draw-world.js), so the standing die always says what the current track is.
const PK_DIFFS = ['easy', 'medium', 'hard'];
// pts = waypoints (more = twistier), jit = radial jitter in tiles (alt flips
// it in and out on alternating points - a forced slalom), rad = carve
// half-width in tiles (easy is a boulevard, hard a ribbon)
const PK_DIFF = {
  easy:   { pts: 10, jit: 1.6, rad: 1.75, alt: false },
  medium: { pts: 16, jit: 3.2, rad: 1.25, alt: false },
  hard:   { pts: 22, jit: 4.5, rad: 1.0,  alt: true },
};
// The die stands in a small felled nook off the walk's south side, adjacent
// to the walk so its prompt rises as you pass on the way to the track.
const PK_DIE = { tx: PR_OX + 15, ty: PR_OY + 38 };
let pkTiles = new Set();   // every tile index the current track's carve iced
let pkDieObj = null;       // the die object, for the roll animation
// A roll is WATCHED, not blinked: one carving front sweeps once around the
// collar in the lap's own direction, starting and finishing at the gate. As
// it passes, the forest closes over the old track (trees spring back with a
// snow poof) and the new lane is cut (trees fall, ice lays down) - the same
// wave doing both is what makes the new loop legible as it appears. pkRoll
// builds the tile events sorted by ring angle and pkAnimStep (updatePractice)
// spends them as the front advances - a handful of tiles and one repaint
// each per frame, so the whole show costs less than a particle burst. The
// die tumbles for the full sweep and the station refuses a new roll until
// the front comes home.
const PK_ANIM_T = 6.0;         // s for the front to lap the collar - a slow, watchable carve
const PK_WARN = 0.45;          // rad the shudder runs ahead of the front: pines shake, THEN fall
const PK_ANIM_CAP = 48;        // max tile events spent per frame (dt-spike guard)
// { t, ev: [{k:0 grow|1 ice|2 shudder, i, a}], next, sfxT,
//   trail: [{x,y,a}] dense samples along the new lane, ti, plumeT } - the
// trail is what the front's sparkle plume rides, so the sweep stays visible
// even where the old and new track share tiles and no event fires
let pkAnim = null;

// The rack is the practice armory: right-clicking either of its tiles opens
// a radial wheel of every tool in the game (kind 'rack' - input.js opens it,
// wheelOptions/renderWheel list and draw it, and the pick lands here through
// the same input.cmd -> runCmd path a build order takes). The selected slot
// becomes a fresh instance of the picked tool with a plain arrow seated, so
// it fires the moment it is taken. PRACTICE-gated: a rack in a match world
// must never be a free-weapons kiosk.
function rackEquip(p, c) {
  if (!PRACTICE) return;
  const o = objAt(c.tx, c.ty);
  if (!o || o.type !== 'rack' || !TOOLS[c.id]) return;
  if (Math.hypot(c.tx * TILE + 8 - p.x, c.ty * TILE + 8 - p.y) > 60) return;
  const cell = makeTool(c.id);
  cell.bits[0] = 'arrow';
  p.tools[p.toolSel] = cell;
  burst(p.x, p.y - 8, '#e8dcb4', 6, 40, 0.4, true);
  sfxAt('place', p.x, p.y);
}

// ---- the practice bar: League's practice-tool cheats -----------------------
// The column of buttons down the left edge (js/ui/cheats.js) sends each press
// through input.cmd {kind:'cheat', id, tx?, ty?} -> runCmd -> cheatCmd, so a
// cheat is a command like any wheel pick and never a UI write into the sim.
// Two are standing toggles (CHEAT_AUTO: cooldowns and health refill every
// tick while on - updatePractice reads them); the rest act once. Teleport
// and the dummy carry the tile the pointer picked. PRACTICE-gated: the bar
// never draws in a match, and a forged command there does nothing.
const CHEAT_GOLD = 500;      // what one ADD GOLD press pays
const CHEAT_DUMMIES = 12;    // the most spawned dummies standing at once
const CHEAT_AUTO = { cd: false, hp: false };
const cheatDummies = [];     // the dummies the bar spawned, oldest first (the field's own is not one)
function cheatCmd(p, c) {
  if (!PRACTICE) return false;
  const fx = (col) => burst(p.x, p.y - 8, col, 8, 45, 0.45, true);
  if (c.id === 'level') {
    if (p.level >= LEVEL_MAX) return 'max';
    p.xp = Math.max(p.xp, LEVEL_XP[p.level]); // the bar fills to the line it crosses
    levelUp(p);
    return true;
  }
  if (c.id === 'gold') {
    // play money, never counted as earned - LEVEL UP is its own button - so
    // the till's path (tradeGold), not gainGold (which would climb the scoreboard)
    tradeGold(p, CHEAT_GOLD);
    addFloater(p.x, p.y - 22, String(CHEAT_GOLD), RES_COLORS.gold);
    sfxFor(p, 'coin');
    return true;
  }
  if (c.id === 'cd' || c.id === 'hp') {
    CHEAT_AUTO[c.id] = !CHEAT_AUTO[c.id];
    cheatAuto(p);
    sfxFor(p, CHEAT_AUTO[c.id] ? 'levelUp' : 'deny');
    return true;
  }
  if (c.id === 'reset') {
    // back to a fresh level 1: level, xp, purse, skill points and ranks
    p.level = 1; p.xp = 0; p.inv.gold = 0; p.earned = 0; p.skillPts = 1;
    for (let i = 0; i < p.abLv.length; i++) { p.abLv[i] = 0; p.abCd[i] = 0; }
    p.maxHp = levelMaxHp(p); p.hp = p.maxHp;
    fx('#f4f7ff');
    sfxFor(p, 'place');
    return true;
  }
  if (c.id === 'tp') {
    if (!Number.isInteger(c.tx) || !Number.isInteger(c.ty) || !walkable(c.tx, c.ty, p)) return 'blocked';
    fx('#9fc4dd');
    p.x = (c.tx + 0.5) * TILE; p.y = (c.ty + 0.5) * TILE; p.vx = p.vy = 0;
    p.sliding = false; p.dodgeT = 0;
    fx('#ddf1f8');
    sfxFor(p, 'place');
    return true;
  }
  if (c.id === 'dummy') return cheatDummy(p, c.tx, c.ty);
  if (c.id === 'clear') {
    if (!cheatDummies.length) return false;
    for (const o of cheatDummies) cheatDummyGone(o);
    cheatDummies.length = 0;
    sfxFor(p, 'place');
    return true;
  }
  return false;
}
// the standing toggles, applied: every tick from updatePractice, and once on
// the press so a toggle answers the moment it lights
function cheatAuto(p) {
  if (CHEAT_AUTO.cd) {
    for (let i = 0; i < p.abCd.length; i++) p.abCd[i] = 0;
    p.dodgeCharges = DODGE_CHARGES; p.dodgeRegenT = 0;
  }
  if (CHEAT_AUTO.hp && !p.dead) p.hp = p.maxHp;
}
// a dummy where the pointer picked: the field's own dummy's numbers and
// meter, on any open tile. Never mid-round (the round has the field), and the
// oldest goes when the cap is reached. It joins the round's furniture, so a
// rung bell sinks it with the rest and the end of the round stands it back up.
function cheatDummy(p, tx, ty) {
  if (agame.phase !== 'off') return 'busy';
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || !walkable(tx, ty)) return 'blocked';
  if (Math.floor(p.x / TILE) === tx && Math.floor(p.y / TILE) === ty) return 'blocked'; // not onto yourself
  if (cheatDummies.length >= CHEAT_DUMMIES) cheatDummyGone(cheatDummies.shift());
  const o = placeObj(tx, ty, 'dummy', { hp: DUMMY_HP, maxHp: DUMMY_HP, hitT: 99,
    mLast: 0, mTotal: 0, mT0: 0, mT1: 0 });
  practiceDummies.push(o); agFurniture.push(o); cheatDummies.push(o);
  burst(tx * TILE + 8, ty * TILE + 2, '#e0c890', 8, 45, 0.45, true);
  burst(tx * TILE + 8, ty * TILE + 8, '#f4f7ff', 6, 35, 0.4, true);
  sfxAt('place', tx * TILE + 8, ty * TILE + 8);
  return true;
}
function cheatDummyGone(o) {
  if (objects[idx(o.tx, o.ty)] === o) objects[idx(o.tx, o.ty)] = null;
  const a = practiceDummies.indexOf(o); if (a >= 0) practiceDummies.splice(a, 1);
  const b = agFurniture.indexOf(o); if (b >= 0) agFurniture.splice(b, 1);
  burst(o.tx * TILE + 8, o.ty * TILE - 4, '#e0c890', 6, 40, 0.4, true);
}

// the rack the player is standing at - Chebyshev 1 of any of its tiles, E's
// own WORK_REACH - resolved to its lead. What the E ARM prompt, the E-opens
// gesture and the hover brackets all agree on.
function rackNear(p) {
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const o = objAt(ptx + dx, pty + dy);
    if (o && o.type === 'rack') return o.lead ? o : objAt(o.tx - 1, o.ty);
  }
  return null;
}

function genPracticeWorld() {
  const ax = PR_X0, ay = PR_Y0;
  // solid forest everywhere, then the field carved out of it - the whole
  // field stays open (rim included): the target track runs the perimeter,
  // one tile in, and a face must never stand behind a pine
  for (let ty = 0; ty < WORLD; ty++) {
    for (let tx = 0; tx < WORLD; tx++) {
      const inX = tx >= ax && tx < ax + PR_W, inY = ty >= ay && ty < ay + PR_H;
      if (inX && inY) continue;
      placeObj(tx, ty, 'tree', { hp: TREE_HP, variant: randi(0, 1), rare: treeRare(tx, ty) });
    }
  }
  // ---- the dummy in the open snow, the armory rack squared under it ------
  const put = (tx, ty, type, extra) => { if (!objects[idx(ax + tx, ay + ty)]) return placeObj(ax + tx, ay + ty, type, extra); return null; };
  const d = put(20, 12, 'dummy', { hp: DUMMY_HP, maxHp: DUMMY_HP, hitT: 99,
    mLast: 0, mTotal: 0, mT0: 0, mT1: 0 }); // the meter's combo ledger
  if (d) practiceDummies.push(d);
  // the bell and the rack FLANK the dummy on its own row, mirrored about its
  // axis in the open snow, five tiles out each way. A two-tile pair can only
  // centre on a tile boundary,
  // so the rack sits at (25,12)-(26,12) and `dx` nudges the drawn sprite
  // (and its brackets and prompt) 8px left, landing its visual centre
  // exactly opposite the bell's - the tiles stay honest, the picture mirrors
  const rk1 = put(25, 12, 'rack', { lead: true, dx: -8 }), rk2 = put(26, 12, 'rack', {});
  // ---- the range bell, the rack's western mirror -------------------------
  agBellObj = put(15, 12, 'agbell', { ring: 0 });
  // the archery round sinks exactly these under the snow - the bell
  // included, which is why a running round cannot be rung off - and
  // agEndRound raises the same instances back
  agFurniture = [d, rk1, rk2, agBellObj].filter(Boolean);
  // ---- the targets: the free-practice roster, out on the perimeter track -
  agStock(true);
  // ---- the ice parkour: the gate walk, the carved loop, the flags --------
  // the walk out of the field is cleared snow (the approach should not
  // slide); the loop is carved AFTER it so their overlap ends up ice, which
  // is what puts the start line - the forced PK_LINE strip - under the gate
  const fell = (tx, ty) => { objects[idx(tx, ty)] = null; };
  for (let ty = PK_WALK.y0; ty <= PK_WALK.y1; ty++) for (let tx = PK_WALK.x0; tx <= PK_WALK.x1; tx++) { fell(tx, ty); ground[idx(tx, ty)] = 0; }
  // the die's nook: a small felled pocket off the walk's south side, deep
  // enough that no pine canopy from the row behind hangs over the die
  for (let ty = PK_DIE.ty; ty <= PK_DIE.ty + 2; ty++) for (let tx = PK_DIE.tx - 1; tx <= PK_DIE.tx + 1; tx++) fell(tx, ty);
  rdCarve(); // the deer ride's trail, under the loop: where they cross, the ice wins
  pkCarve(PK_PATH, 1.15);
  // the gate: a flag capping each END of the checker line, west and east
  fell(PK_LINE.x0 - 1, PK_LINE.y); placeObj(PK_LINE.x0 - 1, PK_LINE.y, 'banner');
  fell(PK_LINE.x1 + 1, PK_LINE.y); placeObj(PK_LINE.x1 + 1, PK_LINE.y, 'banner');
  pkDieObj = placeObj(PK_DIE.tx, PK_DIE.ty, 'pkdie', { rollT: 0 });
  // the records stand across visits: the gate plate opens showing the
  // profile's best lap, the bell plate its best round score
  parkour.best = PROFILE.bestLap();
  for (const k in AG_ROUNDS) agame.bests[k] = AG_ROUNDS[k].best();
  agame.best = agame.bests[agame.mode] || 0;
}

// Plan one loop's carve: walk the centreline and collect every tile within
// `rad` of it that MAY become ice. Only tree tiles (or bare ground) qualify -
// the gate flags, the station, the walk's cleared snow past the line and the
// whole training field all refuse it, which is what keeps the fixed
// west-gate furniture and the range safe under every random track. Nothing
// is touched here: the boot carve applies the plan at once (pkCarve), a roll
// spends it tile by tile as the front sweeps past (pkAnimStep).
function pkPlanCarve(path, rad) {
  const plan = new Set();
  const reach = Math.ceil(rad);
  for (let s = 0; s < path.length - 1; s++) {
    const [x0, y0] = path[s], [x1, y1] = path[s + 1];
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 3;
    for (let i = 0; i <= steps; i++) {
      const fx = x0 + (x1 - x0) * i / steps, fy = y0 + (y1 - y0) * i / steps;
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
        const tx = Math.round(fx) + dx, ty = Math.round(fy) + dy;
        if (!inWorld(tx, ty) || Math.hypot(tx - fx, ty - fy) > rad) continue;
        const wx = tx >= PK_WALK.x0 && tx <= PK_WALK.x1 && ty >= PK_WALK.y0 && ty <= PK_WALK.y1;
        if (wx && tx > PK_LINE.x1) continue; // the walk stays snow past the line
        if (tx >= PR_X0 && tx < PR_X0 + PR_W && ty >= PR_Y0 && ty < PR_Y0 + PR_H) continue;
        const o = objects[idx(tx, ty)];
        if (o && o.type !== 'tree' && o.type !== 'deadTree') continue;
        plan.add(idx(tx, ty));
      }
    }
  }
  // the line strip is ALWAYS part of the carve, whatever width the roll cut
  // the lane: exactly PK_LINE.x0..x1 on the line row, so the checker band,
  // the lap test and the flags capping its ends never move and never gap
  for (let tx = PK_LINE.x0; tx <= PK_LINE.x1; tx++) {
    const o = objects[idx(tx, PK_LINE.y)];
    if (!o || o.type === 'tree' || o.type === 'deadTree') plan.add(idx(tx, PK_LINE.y));
  }
  return plan;
}

// lay one planned ice tile down NOW: fell whatever tree still stands there,
// ice the ground, repaint. The one writer both the boot carve and the
// animation go through.
function pkIceTile(i) {
  const o = objects[i];
  if (o && (o.type === 'tree' || o.type === 'deadTree')) objects[i] = null;
  ground[i] = 1;
}

// the boot carve: plan and apply in the same breath (repaint is renderGround's
// job at boot, so none here)
function pkCarve(path, rad) {
  pkTiles = pkPlanCarve(path, rad);
  for (const i of pkTiles) pkIceTile(i);
}

// A fresh random loop for one difficulty: waypoints on a jittered ellipse
// around the field, walked gate-to-gate so the first and last legs are always
// the west line. Points that would stray into the field (or its two-tile
// apron) are pushed back out into the collar, so a track can never cut across
// the training ground. Runtime entropy is fine here - rng() calls after boot
// reshuffle nothing (world.md#determinism-and-noise).
function pkGenPath(spec) {
  const ecx = PK_CX, ecy = PK_CY, rx = PK_RX, ry = PK_RY;
  // only the line point itself is pinned - the two approach legs wander a
  // little (x 6-9, y a few tiles either way), so even two rolls of the same
  // difficulty visibly redraw the ice in front of the gate where the roller
  // is standing to watch
  const ox = PR_OX, oy = PR_OY, home = [ox + 8, oy + 37];
  const path = [home, [ox + 6 + ((rng() * 4) | 0), oy + 28 + ((rng() * 4) | 0)]];
  let cp = [ox + 69, oy + 37];
  const n = spec.pts;
  for (let i = 2; i <= n - 2; i++) {
    const th = Math.PI - 2 * Math.PI * i / n;
    let r1 = rx, r2 = ry;
    if (spec.alt) { // the forced slalom: alternate points swing out and in
      const s = (i % 2 ? 1 : -1) * (0.5 + rng() * 0.5);
      r1 += s * spec.jit; r2 += s * spec.jit;
    } else {
      r1 += (rng() * 2 - 1) * spec.jit;
      r2 += (rng() * 2 - 1) * spec.jit;
    }
    let x = Math.round(ecx + Math.cos(th) * r1);
    let y = Math.round(ecy - Math.sin(th) * r2);
    x = Math.max(5, Math.min(WORLD - 6, x));
    y = Math.max(5, Math.min(WORLD - 6, y));
    // out of the field's tree belt, along whichever axis it strayed least
    if (x > PR_X0 - PK_APRON - 1 && x < PR_X0 + PR_W + PK_APRON && y > PR_Y0 - PK_APRON - 1 && y < PR_Y0 + PR_H + PK_APRON) {
      const dx = (x - ecx) / (PR_W / 2 + PK_APRON), dy = (y - ecy) / (PR_H / 2 + PK_APRON);
      if (Math.abs(dx) > Math.abs(dy)) x = dx > 0 ? PR_X0 + PR_W + PK_APRON : PR_X0 - PK_APRON - 1;
      else y = dy > 0 ? PR_Y0 + PR_H + PK_APRON : PR_Y0 - PK_APRON - 1;
    }
    path.push([x, y]);
  }
  path.push([ox + 6 + ((rng() * 4) | 0), oy + 43 + ((rng() * 4) | 0)], home.slice());
  // a straight leg between two collar points can still CHORD across the tree
  // belt's corner - walk every segment and, where one would cross the belt,
  // route it through the belt corner nearest its midpoint instead
  const fx0 = PR_X0 - PK_APRON - 1, fx1 = PR_X0 + PR_W + PK_APRON, fy0 = PR_Y0 - PK_APRON - 1, fy1 = PR_Y0 + PR_H + PK_APRON;
  const inApron = (x, y) => x > fx0 && x < fx1 && y > fy0 && y < fy1;
  const routed = [path[0]];
  for (let s = 1; s < path.length; s++) {
    const [ax, ay] = routed[routed.length - 1], [bx, by] = path[s];
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay)) * 2;
    let cut = false;
    for (let i = 1; i < steps && !cut; i++) {
      if (inApron(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps)) cut = true;
    }
    if (cut) {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const corners = [[fx0, fy0], [fx1, fy0], [fx0, fy1], [fx1, fy1]];
      corners.sort((c1, c2) => Math.hypot(c1[0] - mx, c1[1] - my) - Math.hypot(c2[0] - mx, c2[1] - my));
      routed.push(corners[0]);
    }
    routed.push([bx, by]);
  }
  // the checkpoint is this track's farthest-east waypoint - the honest "you
  // went round the far side" test, wherever the roll put the far side
  cp = routed.reduce((a, b) => (b[0] > a[0] ? b : a));
  return { path: routed, cp };
}

// where a tile sits on the ring, as the sweep's clock: 0 at the west gate,
// growing in the lap's own direction (north first, east over the top), 2pi
// back home - the same parametrisation pkGenPath walks
function pkAngKey(i) {
  const th = Math.atan2(PK_CY - ((i / WORLD) | 0), (i % WORLD) - PK_CX);
  const k = Math.PI - th;
  return k >= Math.PI * 2 ? k - Math.PI * 2 : k;
}

// The roll itself: pick the new loop, unregister the old track's scars, aim
// the checkpoint at the new far side, reset the clock - and hand the actual
// terrain change to the sweep (pkAnimStep): every affected tile becomes one
// event keyed by its ring angle, so the front regrows the forest and cuts
// the new lane in a single lap-shaped pass. Rolled tracks are their own
// event - best/last restart and the profile's stock record is never written.
function pkRoll(diff) {
  if (pkAnim) return; // one front out at a time - the die is still tumbling
  if (PK_DIFF[diff]) parkour.diff = diff;
  const spec = PK_DIFF[parkour.diff];
  const old = pkTiles;
  const gen = pkGenPath(spec);
  pkTiles = pkPlanCarve(gen.path, spec.rad);
  // the old track takes its scars with it: any crack or hole the player put
  // in it is unregistered before the forest grows back over the tile
  for (const i of old) {
    iceCracks.delete(i);
    const hi = holes.indexOf(i);
    if (hi >= 0) holes.splice(hi, 1);
  }
  const ev = [];
  for (const i of old) if (!pkTiles.has(i)) ev.push({ k: 0, i, a: pkAngKey(i) });
  // a tile in BOTH tracks normally needs no event - unless the player broke
  // a hole through it: its registration was just wiped, so the sweep must
  // re-ice it or the hole would linger unregistered forever
  for (const i of pkTiles) if (old.has(i) && ground[i] !== 1) ev.push({ k: 1, i, a: pkAngKey(i) });
  for (const i of pkTiles) if (!old.has(i)) {
    const a = pkAngKey(i);
    ev.push({ k: 1, i, a });
    // a pine in the new lane shudders a beat before the front reaches it -
    // the anticipation is half the show
    const o = objects[i];
    if (o && o.type === 'tree') ev.push({ k: 2, i, a: Math.max(0, a - PK_WARN) });
  }
  ev.sort((a, b) => a.a - b.a);
  // the plume's rail: dense samples along the new lane in sweep order (the
  // path is angle-ordered by construction; the running max irons out the
  // slalom's tiny local wobbles so the index only ever advances)
  const trail = [];
  let ka = 0;
  for (let s = 0; s < gen.path.length - 1; s++) {
    const [x0, y0] = gen.path[s], [x1, y1] = gen.path[s + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2);
    for (let i = 0; i < steps; i++) {
      const fx = x0 + (x1 - x0) * i / steps, fy = y0 + (y1 - y0) * i / steps;
      let a = Math.PI - Math.atan2(PK_CY - fy, fx - PK_CX);
      if (a >= Math.PI * 2) a -= Math.PI * 2;
      ka = Math.max(ka, a);
      trail.push({ x: fx * TILE + 8, y: fy * TILE + 8, a: ka });
    }
  }
  pkAnim = { t: 0, ev, next: 0, sfxT: 0, trail, ti: 0, plumeT: 0 };
  parkour.cpTx = gen.cp[0]; parkour.cpTy = gen.cp[1];
  parkour.custom = true;
  parkour.on = false; parkour.t = 0; parkour.cp = false; parkour.offT = 0;
  parkour.best = 0; parkour.last = 0;
  if (pkDieObj) pkDieObj.rollT = PK_ANIM_T + 0.3; // the die tumbles for the whole sweep
  const dx2 = PK_DIE.tx * TILE + 8, dy2 = PK_DIE.ty * TILE + 8;
  burst(dx2, dy2 - 10, '#f4f7ff', 10, 55, 0.5, true);
  burst(dx2, dy2 - 10, '#8fd8ff', 8, 45, 0.45, true);
  sfxAt('unlock', dx2, dy2);
}

// The sweep, one frame's worth: advance the front around the ring and spend
// every event it has passed - a grow event closes the forest over an old
// tile (snow back, a tree with a flash and a poof, never onto the player), an
// ice event cuts the new lane (the tree falls in needles and snow, the ice
// lays down with a sparkle). Each event is one ground write and one
// repaintGround - a handful per frame at 60fps - and PK_ANIM_CAP bounds a
// dt spike so a background tab can never dump the whole track into one
// frame's budget. When the front comes home the line flashes: track open.
function pkAnimStep(dt) {
  if (!pkAnim) return;
  pkAnim.t += dt; pkAnim.sfxT += dt;
  // eased, not linear: the watcher stands at the gate, so the front pulls
  // away slowly (the first trees fall where you can see them), hurries round
  // the far side, and slows again to close the loop in front of you
  const u = Math.min(1, pkAnim.t / PK_ANIM_T);
  const front = (u * u * (3 - 2 * u)) * Math.PI * 2;
  let spent = 0;
  while (pkAnim.next < pkAnim.ev.length && pkAnim.ev[pkAnim.next].a <= front && spent < PK_ANIM_CAP) {
    const e = pkAnim.ev[pkAnim.next++]; spent++;
    const tx = e.i % WORLD, ty = (e.i / WORLD) | 0;
    const px = tx * TILE + 8, py = ty * TILE + 8;
    if (e.k === 2) {
      // the shudder: the pine shakes on its feet a beat before it falls
      // (o.shake decays in sim.js's object-timer loop) - no ground change,
      // so no repaint either
      const o = objects[e.i];
      if (o && o.type === 'tree') joltObj(o, undefined, 0.55);
      continue;
    }
    if (e.k === 1) {
      const hadTree = !!objects[e.i];
      pkIceTile(e.i);
      if (hadTree) {
        burst(px, py - 8, '#88b090', 4, 45, 0.45, true);  // needles off the falling pine
        if (rng() < 0.6) burst(px, py - 4, '#f4f7ff', 3, 40, 0.4, true);
        if (pkAnim.sfxT > 0.28) { pkAnim.sfxT = 0; sfxAt('break_', px, py); }
      } else if (rng() < 0.5) {
        burst(px, py, '#ddf1f8', 2, 35, 0.4, true);        // frost settling on fresh ice
      }
    } else {
      ground[e.i] = 0;
      const inField = tx >= PR_X0 && tx < PR_X0 + PR_W && ty >= PR_Y0 && ty < PR_Y0 + PR_H;
      const inWalk = tx >= PK_WALK.x0 && tx <= PK_WALK.x1 && ty >= PK_WALK.y0 && ty <= PK_WALK.y1;
      const onMe = Math.abs(player.x / TILE - (tx + 0.5)) < 1.5 && Math.abs(player.y / TILE - (ty + 0.5)) < 1.5;
      if (!inField && !inWalk && !onMe && !rdTiles.has(e.i) && !objects[e.i]) { // the deer ride's trail stays open
        const t = placeObj(tx, ty, 'tree', { hp: TREE_HP, variant: hash2(tx * 3 + 1, ty * 3 + 2) > 0.5 ? 1 : 0, rare: treeRare(tx, ty) });
        joltObj(t, 0.2);
        if (rng() < 0.5) burst(px, py - 10, '#f4f7ff', 3, 40, 0.45, true);
      }
    }
    repaintGround(tx, ty);
  }
  // the plume: a steady sparkle riding the front along the new lane (rate is
  // time-based, so a 240Hz screen gets the same shower as a 60Hz one), with
  // a faint comet tail dropped on the samples the front passed this frame
  while (pkAnim.ti < pkAnim.trail.length - 1 && pkAnim.trail[pkAnim.ti + 1].a <= front) {
    pkAnim.ti++;
    if (rng() < 0.3) { const s = pkAnim.trail[pkAnim.ti]; burst(s.x, s.y - 4, '#6fc4f2', 1, 22, 0.5, true); }
  }
  if (pkAnim.t < PK_ANIM_T) {
    pkAnim.plumeT += dt;
    const s = pkAnim.trail[Math.min(pkAnim.ti, pkAnim.trail.length - 1)];
    while (pkAnim.plumeT > 0.03) {
      pkAnim.plumeT -= 0.03;
      // deep blue against snow and ice, white against the dark pines - the
      // pair keeps the head visible over everything it crosses
      burst(s.x + rand(-4, 4), s.y - 6 + rand(-4, 3), rng() < 0.6 ? '#3a86c8' : '#f4f7ff', 2, 30, 0.5, true);
    }
  }
  if (pkAnim.next >= pkAnim.ev.length && pkAnim.t >= PK_ANIM_T) {
    pkAnim = null;
    const lx = (PK_LINE.x0 + PK_LINE.x1 + 1) * TILE / 2, ly = (PK_LINE.y + 0.5) * TILE;
    burst(lx, ly, '#8fd8ff', 10, 55, 0.5, true);
    burst(lx, ly, '#f4f7ff', 8, 50, 0.45, true);
    sfxAt('place', lx, ly);
  }
}

// the die the player is standing at - Chebyshev 1 of its tile, E's own
// reach - shared by the E prompt (drawPkHint, js/ui.js) and the wheel-open
// press (js/app/input.js), so they can never disagree
function pkDieNear(p) {
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const o = objAt(ptx + dx, pty + dy);
    if (o && o.type === 'pkdie') return o;
  }
  return null;
}

// a pick released off the die's wheel, through the same input.cmd -> runCmd
// path every wheel uses: the wedge IS the roll - picking a difficulty carves
// a fresh track at it, and the die recolours to match. PRACTICE-gated like
// rackEquip, and pkRoll itself refuses a roll while a sweep is out.
function pkWheelPick(p, c) {
  if (!PRACTICE || !PK_DIFF[c.id]) return;
  if (Math.hypot(c.tx * TILE + 8 - p.x, c.ty * TILE + 8 - p.y) > 60) return;
  pkRoll(c.id);
}

// ---- the deer ride: a trail through the forest wing ----------------------
// A cleared snow trail leaves the field's south edge, crosses the ice loop
// and the tree belt into the forest wing under the field's block (PR_RING),
// sweeps west, then runs the wing east with no two bends alike: a hairpin
// up to the first target, a long flat sprint past the second, and a hook
// that curls back west round the third and east again over a felled log (the
// roll key's leap, js/sim/wildlife.js), then dives south and turns north to cross
// the ice again back into the field. A tame deer waits at its head (PR_DEER): E
// rides it. The trail is laid out by hand, never rolled:
// RD_PATH is its centreline in world tiles, smoothed through every point
// (rdCurve). Where it crosses the ice loop the ice wins, and a re-rolled
// track never grows the forest back over it (rdTiles, pkAnimStep).
const RD_PATH = [[48, 48], [47, 56], [45, 63], [42, 71], [36, 78], [26, 81], [16, 80], [9, 86], [10, 95],
  [14, 101], [21, 104], [26, 100], [28, 92], [32, 88], [36, 92], [40, 100], [47, 104], [60, 104],
  [67, 102], [71, 97], [70, 91], [66, 88], [65, 85], [71, 79], [78, 81], [83, 91], [86, 100], [89, 101],
  [93, 97], [99, 92], [102, 83], [97, 77], [86, 74], [76, 70], [71, 63], [68, 55], [66, 48]];
const RD_RAD = 1.4;                  // tiles from the centreline the trail is cleared
const RD_SHOT = 8;                   // tiles of trail each target's clearing opens onto
const RD_LOG = { tx: 68, ty: 82 };   // the felled log's middle piece, across the hook's climb
const RD_TARGETS = [[27, 87], [52, 101], [74, 93]]; // the three faces: past the hairpin, over the sprint, in the hook
const PR_DEER = { tx: 48, ty: 46 };  // where the tame deer waits, at the trail's head in the field
const PR_DEER_BACK = 3;              // s riderless away from its stand (or gone) before it is back
let rdTiles = new Set();             // every tile the trail cleared
let prDeer = null, prDeerAway = 0;

// the centreline as dense samples, a Catmull-Rom curve through RD_PATH
function rdCurve() {
  const P = RD_PATH, out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) * 4;
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P[P.length - 1]);
  return out;
}

// the boot carve, before the ice loop's (so a crossing ends up ice): fell the
// trail, lay the log across it, and open a clearing round each target's post
function rdCarve() {
  const fell = (tx, ty) => { if (!inWorld(tx, ty)) return; objects[idx(tx, ty)] = null; ground[idx(tx, ty)] = 0; rdTiles.add(idx(tx, ty)); };
  const reach = Math.ceil(RD_RAD);
  for (const [fx, fy] of rdCurve()) {
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const tx = Math.round(fx) + dx, ty = Math.round(fy) + dy;
      if (Math.hypot(tx + 0.5 - fx, ty + 0.5 - fy) <= RD_RAD) fell(tx, ty);
    }
  }
  // the face stands two tiles tall over its post: the clearing is open above
  // it and fans out over the stretch of trail it stands by, as far as
  // RD_SHOT, so a shot from the saddle meets no pine wherever it is loosed
  // (only that stretch: a pass of the trail further off stays behind trees)
  const C = rdCurve();
  for (const [tx, ty] of RD_TARGETS) {
    for (let dy = -3; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) fell(tx + dx, ty + dy);
    const ox = tx + 0.5, oy = ty - 0.5;   // the face, a tile over the post
    const far = (i) => Math.hypot(C[i][0] - ox, C[i][1] - oy);
    let m = 0; for (let i = 1; i < C.length; i++) if (far(i) < far(m)) m = i;
    let a = m, b = m; while (a > 0 && far(a - 1) <= RD_SHOT) a--; while (b < C.length - 1 && far(b + 1) <= RD_SHOT) b++;
    for (let i = a; i <= b; i++) {
      const [cx, cy] = C[i];
      for (let k = 0, n = Math.ceil(far(i) * 2); k <= n; k++) fell(Math.floor(ox + (cx - ox) * k / n), Math.floor(oy + (cy - oy) * k / n));
    }
  }
  // one `log` per tile along the cross-diagonal, as across a match road
  // (placeRoad): the ends run into the trees, so nothing squeezes round it
  for (let k = -2; k <= 2; k++) {
    const tx = RD_LOG.tx + k, ty = RD_LOG.ty + k;
    objects[idx(tx, ty)] = null;
    placeObj(tx, ty, 'log', { seg: k === -2 ? 0 : k === 2 ? 2 : 1 });
  }
}

// the tame deer, from updatePractice: it stands at its post and never bolts
// from a player (`tame`, updatePrey). Ridden off and let go, shot, or dead,
// it is back on its stand PR_DEER_BACK seconds later
function prDeerStep(dt) {
  const sx = (PR_DEER.tx + 0.5) * TILE, sy = (PR_DEER.ty + 0.5) * TILE;
  const here = prDeer && animals.includes(prDeer) && !prDeer.dead;
  const away = !here || (!prDeer.rider && Math.hypot(prDeer.x - sx, prDeer.y - sy) > 24);
  prDeerAway = away ? prDeerAway + dt : 0;
  if (prDeerAway < PR_DEER_BACK && prDeer) return;
  prDeerAway = 0;
  if (here) {
    burst(prDeer.x, prDeer.y - 6, '#f4f7ff', 6, 40, 0.4, true);
    Object.assign(prDeer, { x: sx, y: sy, fleeT: 0, fleeGoal: null, goal: null, spd: 0, hp: prDeer.maxHp });
    navClear(prDeer);
  } else {
    prDeer = makeAnimal('deer', sx, sy);
    prDeer.tame = true;
    animals.push(prDeer);
  }
  burst(sx, sy - 6, '#f4f7ff', 8, 40, 0.45, true);
}

// The grounds' clock, from updatePlay under PRACTICE only: the dummy mends
// between combos, broken targets spring back, pop-ups run their cycle,
// sliders patrol their rails, and the parkour lap is timed. The shimmer, the
// wobble and the bar refilling are the whole announcement - no words.
function updatePractice(dt) {
  pkAnimStep(dt); // the roll's carving front, while one is out
  prDeerStep(dt); // the deer ride's tame deer, back on its stand
  agUpdate(dt);   // the archery round's clock, sink, countdown and spawner
  cheatAuto(player); // the practice bar's standing toggles
  if (pkDieObj && pkDieObj.rollT > 0) pkDieObj.rollT = Math.max(0, pkDieObj.rollT - dt); // the die's tumble
  for (const o of practiceDummies) {
    o.hitT += dt;
    if (o.hp < o.maxHp && o.hitT > DUMMY_RESET_T) {
      o.hp = o.maxHp;
      joltObj(o, 0.18);
      const ox = o.tx * TILE + 8, oy = o.ty * TILE + 8;
      burst(ox, oy - 14, '#f4f7ff', 8, 40, 0.5, true);
      burst(ox, oy - 14, '#e0c890', 5, 35, 0.45, true);
      sfxAt('place', ox, oy);
    }
  }
  for (const t of ptargets) {
    t.t += dt;
    if (t.wob > 0) t.wob = Math.max(0, t.wob - dt);
    if (t.swapT > 0) t.swapT -= dt;
    if (t.broken > 0) {
      t.broken -= dt;
      if (t.broken <= 0) { // a fresh face springs onto the bare post
        t.broken = 0;
        t.wob = 0.45;
        const f = ptFace(t);
        burst(f.x, f.y, '#f4f7ff', 6, 35, 0.4, true);
        sfxAt('place', f.x, f.y);
      }
    }
    if (t.kind === 'raid') { dfStep(t, dt); continue; } // DEFEND's raiders hop, they ride no rail
    if (t.kind === 'pop') {
      // the cycle: hidden - rise - hold - sink, on the target's own clock
      const C = t.pop || PT_POP, total = C.hide + C.rise + C.hold + C.sink;
      const u = t.t % total;
      if (u < C.hide) t.up = 0;
      else if (u < C.hide + C.rise) t.up = (u - C.hide) / C.rise;
      else if (u < C.hide + C.rise + C.hold) t.up = 1;
      else t.up = 1 - (u - C.hide - C.rise - C.hold) / C.sink;
      // the telegraph: one snow fleck as the pre-rise rattle starts (the
      // rattle itself is drawPTarget's jitter over the same window), and a
      // little bounce as the face locks fully up - each once per cycle
      const cyc = (t.t / total) | 0;
      if (t.warned !== cyc && u > C.hide - 0.35 && u < C.hide) {
        t.warned = cyc;
        burst(t.x, t.y - 4, '#f4f7ff', 3, 22, 0.3, true);
      }
      if (t.up === 1 && t.prevUp < 1) t.wob = Math.max(t.wob, 0.22);
      t.prevUp = t.up;
    }
    if (t.spd > 0) {
      t.s = (t.s + t.spd * t.dir * dt + AG_LEN) % AG_LEN;
      // a rolling carriage kicks up a thin snow trail, paced by distance
      t.dustD += t.spd * dt;
      if (t.dustD > 26) { t.dustD = 0; burst(t.x, t.y + 1, '#f4f7ff', 1, 14, 0.3, true); }
      // a mover about to run into anything parked - or rolling slower - on
      // its rail hops to the other lane and keeps going. Never mid-hop
      // (swapT), and one at a time in array order, which is what lets two
      // head-on movers resolve: the first hops, the second finds its rail clear.
      if (t.swapT <= 0) {
        const ahead = 10 + t.spd * 0.4;
        let block = false;
        for (const o of ptargets) {
          if (o === t || o.gone || o.at || o.lane !== t.lane) continue;
          const dd = ((((o.s - t.s) * t.dir) % AG_LEN) + AG_LEN) % AG_LEN;
          if (dd <= 0 || dd >= ahead) continue;
          if (o.spd > 0 && o.dir === t.dir && o.spd >= t.spd) continue; // pulling away
          block = true; break;
        }
        if (block && !agBlocked(1 - t.lane, t.s, 20, t)) { t.lane = 1 - t.lane; t.swapT = 0.9; t.hopping = true; }
      }
    }
    // ease onto the lane it wants, then stand where the track says - the
    // draw lifts the carriage through the swap (the hop), and the landing
    // puffs the moment it settles back onto its rail
    t.laneU += Math.max(-dt / 0.22, Math.min(dt / 0.22, t.lane - t.laneU));
    if (t.hopping && Math.abs(t.lane - t.laneU) < 0.02) {
      t.hopping = false;
      burst(t.x, t.y + 1, '#f4f7ff', 3, 25, 0.3, true);
    }
    const tp = t.at || agPos(t.s, t.laneU);
    t.x = tp.x; t.y = tp.y;
  }
  // a round target that has been shot is spent for good
  for (let i = ptargets.length - 1; i >= 0; i--) if (ptargets[i].gone) ptargets.splice(i, 1);
  // the hit rings age out fast - a flash, not a decoration
  for (let i = agRings.length - 1; i >= 0; i--) {
    agRings[i].t += dt;
    if (agRings[i].t >= AG_RING_T) agRings.splice(i, 1);
  }
  // ---- the parkour clock -------------------------------------------------
  // plain coordinate tests against the carved ice: stepping onto the line
  // starts a lap, the far checkpoint keeps it honest, recrossing the line
  // records it and rolls straight into the next - continuous laps. Leaving
  // the ice for PK_OFF_T (or dying) abandons the run without a time.
  const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
  const onIce = inWorld(ptx, pty) && ground[idx(ptx, pty)] === 1;
  const onLine = onIce && pty === PK_LINE.y && ptx >= PK_LINE.x0 && ptx <= PK_LINE.x1;
  if (player.dead) {
    parkour.on = false;
  } else if (!parkour.on) {
    if (onLine && !parkour.wasLine) { parkour.on = true; parkour.t = 0; parkour.cp = false; parkour.offT = 0; }
  } else {
    parkour.t += dt;
    // this track's checkpoint: near its farthest-east waypoint, on the ice -
    // pkRoll re-aims it at wherever each random loop's far side landed
    if (onIce && Math.hypot(ptx - parkour.cpTx, pty - parkour.cpTy) <= 2.5) parkour.cp = true;
    if (onLine && !parkour.wasLine && parkour.cp) {
      parkour.last = parkour.t;
      const record = !parkour.best || parkour.t < parkour.best;
      // only the STOCK track writes the profile - a rolled track's laps are
      // its own session event, not comparable across rolls
      if (record) { parkour.best = parkour.t; if (!parkour.custom) PROFILE.setBestLap(parkour.t); }
      burst(player.x, player.y - 10, '#ffd95c', 12, 60, 0.55, true);
      burst(player.x, player.y - 10, '#f4f7ff', 8, 45, 0.45, true);
      if (record) SFX.record(); else SFX.place();
      parkour.t = 0; parkour.cp = false;
    }
    if (!onIce) { parkour.offT += dt; if (parkour.offT > PK_OFF_T) parkour.on = false; }
    else parkour.offT = 0;
  }
  parkour.wasLine = onLine;
}
