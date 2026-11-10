'use strict';
// Everything built: the STRUCTS table every building is an entry in, making
// and wrecking one, and the per-type building sim (road towers, barracks,
// gold pumps). Nobody builds by hand: every building is the map's or
// the eagle's merchant's. The soldiers a barracks rolls out are
// js/sim/robots.js, which loads next.
// ------------------------------------------------------------ structures
// One flat entry per type. `mm` and `map` are what the two maps paint it, the
// same pair OBJECTS carries for scenery - both maps read whichever of the two
// tables holds the tile's type, so a building is coloured by its entry here
// and nothing else. Every building wears ITS SIDE'S INK on both (mmTeam /
// chTeam, world.js): at a map's scale whose base it is is the whole read -
// the type is the sprite's job. A building's cost is what a wrecker is paid
// half of (wreckPay); one with no `cost` pays nothing. `sight` is the px of
// fog of war a standing one of a side lifts round its middle, or round
// `eye(o)` (sightSources, js/sim/fog.js).
// WHAT A TYPE DOES is its own three hooks, so the building sim never asks a
// type's name: `init(o)` lays its state on a fresh object (createStruct),
// `built(o)` runs once a site finishes rising, and `tick(o, dt)` is its step
// every tick it stands (updateStructures). Its draw is three more, each
// optional: `sprite(o)` its still sprite, `frame(o)` the frame it shows
// standing when it moves, `over(o, x, y, now)` a pass over that frame
// (drawStructObj, js/draw/passes.js).
const STRUCTS = {
  // THE GOLD PUMP: a pump jack on a 4x2 tile pad, the
  // map's two neutral objectives (the `pumps` banner, js/sim/pumps.js). It
  // wears its HOLDER's paint, or grey held by nobody (mmPump/chPump, world.js;
  // pumpSet, js/draw/structs.js). While a side holds it, every hero on that
  // side is paid `pay` every `period` s; its stroke runs off o.payT against
  // `period` (pumpFrame). Nobody owns it, so nobody swings at it (ownsStruct)
  // and it has no cost to pay a wrecker.
  pump: { name: 'GOLD PUMP', w: 4, h: 2, mm: mmPump, map: chPump, hp: 160, pay: 20, period: 10,
    // the ring's state (updatePump, js/sim/pumps.js)
    init(o) { o.hold = -1; o.cap = 0; o.capBy = -1; o.payT = this.period; o.paid = false; },
    built(o) { o.payT = this.period; },
    tick(o, dt) { updatePump(o, dt); },
    // its draw (js/draw/structs.js): the still sprite in the holder's paint,
    // the stroke's frame off the payout clock, and the payout's coin over it
    sprite: (o) => pumpSet(o).pump, frame: (o) => pumpFrame(o), over: (o, x, y) => drawPumpCoin(o, x, y),
  },
  // THE BARRACKS: the wave bays each merchant raises in the back woods
  // inside the lane mouths, all three straight after its stall and a rebuild
  // for its logs (the `merchant` banner, robots.js).
  // It wears the bay's own 3x2 grid (`art`). The waves keep the MATCH's beat, not
  // the bay's: every bay standing queues a WAVE of soldiers (the
  // `soldiers` banner, robots.js) at `first` seconds of match clock and every
  // `waveT` after (barracksBeat), so the lanes roll out together and a rebuilt
  // bay falls into step. Each wave marches its lane to the rival bird:
  // its `mix` of soldier kinds (SOLDIER_TYPES, js/sim/robots.js) out of the
  // door in that order - melee in front, ranged behind - one more melee for
  // every `grow` seconds the bay has stood, and a SIEGE soldier last on every
  // n-th wave of the match, n read off `siege` ([from s of match clock, n]:
  // every 3rd early, every 2nd from 15:00, every wave from 25:00, League's).
  // Its cost is what a wrecker is paid half of - breaking one stalls the
  // waves until the merchant walks back and raises it again. `cap` is the
  // most of a SIDE's soldiers alive at once, every bay counted: a side
  // nobody fights back against does not fill the map, it waits for its
  // column to spend itself.
  barracks: { name: 'BARRACKS', w: 3, h: 2, art: 'spawner', sight: 176, mm: mmTeam, map: chTeam, glyph: 'bay',
    cost: { gold: 400 }, hp: 320, buildT: 6, mix: ['melee', 'melee', 'melee', 'ranged', 'ranged', 'ranged'],
    siege: [[0, 3], [900, 2], [1500, 1]], first: 60, waveT: 30, grow: 180, cap: 16, // cap: soldiers a LANE holds, queued or out (two whole waves and change)
    // waveT: the clock to the next wave. queue/rollT: soldiers still to leave
    // the door, and the gap to the next. born: when it stood, for the growth.
    init(o) { o.waveT = barracksBeat(this); o.queue = 0; o.kinds = []; o.rollT = 0; o.born = state.elapsed; o.door = 0; },
    built(o) { o.waveT = barracksBeat(this); o.born = state.elapsed; },
    tick(o, dt) { barracksTick(o, dt); },
    over: (o, x, y, now) => drawBarracksOverlay(o, x, y, now), // its door and its wave clock (js/draw/overhead.js)
  },
  // THE ROAD TOWER: the map's, never a wallet's - two stand on each side's
  // cable at boot (placeTowers, js/sim/towers.js), each with a crossbow on
  // its deck that holds its stretch of road, and a side's cable runs only as
  // far as its furthest standing one. The wrecker is paid half its cost like any wreck, and its fall
  // is the announcer's (`call`, callStruct). Its gun's numbers sit with its
  // sim (TOWER_*, towers.js).
  // It sees from its foot, half again past a hero (TOWER_RANGE is 112).
  tower: { name: 'ROAD TOWER', w: 3, h: 2, call: true, sight: 240, eye: (o) => towerFoot(o), mm: mmTeam, map: chTeam, glyph: 'tower',
    cost: { gold: 1500 }, hp: 700, buildT: 1,
    // ang: the gun's bearing; tgt/chg: its mark and how far it has wound; cd: the
    // reload; heat/heatId: bolts in a row into one hero; bolt/pin: the one in the
    // air and the spent one in the snow (updateTower, js/sim/towers.js)
    init(o) { o.zl = -1; o.zi = -1; o.ang = o.team === 0 ? -Math.PI / 4 : Math.PI * 3 / 4; o.tgt = null; o.chg = 0; o.cd = 0; o.heat = 0; o.heatId = -1; o.bolt = null; o.pin = null; o.loose = -9; },
    built() {},
    // the practice bar's TOWERS off: the gun stands down
    tick(o, dt) { if (!PRACTICE || state.prac.towers) updateTower(o, dt); else towerRest(o, dt); },
    over: (o, x, y) => drawTowerTop(o, x, y), // its gun in its deck, and its bar (js/draw/towers.js)
  },
};
const BARRACKS_ROLL = 0.5; // s between the soldiers of one wave leaving the door
// s to the next wave on the match's beat: `first` s of match clock, then every `waveT`
function barracksBeat(t) {
  const past = state.elapsed - t.first;
  return past < 0 ? -past : t.waveT - (past % t.waveT);
}
// the kinds of the wave a bay queues now, in door order: the `mix`, a melee
// more per `grow` the bay has stood, and the siege soldier when this beat's
// wave number (1 the first, on the match clock, so every lane agrees) is its
// turn - cut from the back to what its lane's `cap` leaves room for
function barracksWave(o) {
  const t = STRUCTS.barracks;
  const n = Math.round((state.elapsed - t.first) / t.waveT) + 1;
  let every = 0;
  for (const [from, k] of t.siege) if (state.elapsed >= from) every = k;
  const extra = Math.floor((state.elapsed - o.born) / t.grow);
  const at = t.mix.lastIndexOf('melee') + 1; // the grown melee join the front rank
  const kinds = t.mix.slice(0, at).concat(Array(extra).fill('melee'), t.mix.slice(at));
  if (every && n % every === 0) kinds.push('siege');
  return kinds.slice(0, Math.max(0, t.cap - barracksLaneLoad(o)));
}
// a bay queues its wave (the beat, and the practice bar's SPAWN WAVE,
// cheatCmd js/sim/practice.js): `o.kinds` leave the door in order, `o.queue`
// is how many are left. Returns how many it queued
function barracksQueue(o) {
  const k = barracksWave(o);
  o.kinds = (o.kinds || []).concat(k);
  o.queue = o.kinds.length;
  return k.length;
}

// The one place a building object is made (the merchant's barracks, the road
// towers and DBG.buildStruct): the anchor object, its footprint fillers, the
// registry and its type's state (`init`). `building` raises it from scratch
// over the type's buildT; p is { id, team } - a player, or the side's own stand-in.
function createStruct(tx, ty, type, p, building) {
  const S = STRUCTS[type];
  const o = placeObj(tx, ty, type, {
    hp: building ? Math.ceil(S.hp * 0.3) : S.hp, maxHp: S.hp,
    building: !!building, buildT: 0, buildTotal: S.buildT || 0, dustT: 0,
    owner: p.id, team: p.team, // paints the sprite
  });
  for (const [x, y] of footprint(type, tx, ty)) {
    if (x !== tx || y !== ty) setTile(idx(x, y), { type: 'part', tx: x, ty: y, of: o, flash: 0, shake: 0 });
  }
  S.init(o);
  o.sparkT = 0;
  structures.push(o);
  return o;
}

// is o p's side's (or nobody's)? Nobody swings at their own side's building
// (autoWorks, js/sim/actions.js)
function ownsStruct(o, p) { return o.team === undefined || o.team === p.team; }

// WHAT A WRECK PAYS whoever brought it down: half the building's price
function wreckPay(o) { const c = STRUCTS[o.type].cost; return c ? Math.floor((c.gold || 0) / 2) : 0; }

function removeStruct(o) {
  for (const [x, y] of footprint(o.type, o.tx, o.ty)) setTile(idx(x, y), null);
  const i = structures.indexOf(o);
  if (i >= 0) structures.splice(i, 1);
}

// ------------------------------------------------------------ the building sim
const RES_COLORS = {
  gold: '#f2cc6a',
};
// audio/screen gating: is this happening near the local listener?
function nearPlayer(x, y, r) { return !!player && Math.hypot(player.x - x, player.y - y) < (r || 180); }

// the soldiers a bay's LANE holds: every bay of its team on that lane
// queued, and every soldier of the team walking it - the barracks' cap is
// the lane's, so more bays refill a column faster but never fill a lane.
// The merchant's bays carry their lane (updateMerchant); any other walks mid
function barracksLaneLoad(o) {
  const lane = o.lane === undefined ? 1 : o.lane;
  let n = 0;
  for (const q of structures) if (q.type === 'barracks' && q.team === o.team && (q.lane === undefined ? 1 : q.lane) === lane) n += q.queue;
  for (const b of robots) if (b.kind === 'soldier' && b.team === o.team && b.lane === lane && !b.dead) n++;
  return n;
}

function updateStructures(dt) {
  towersSync(true); // a side's cable runs to its furthest standing road tower (js/sim/towers.js)
  for (const o of structures) {
    const ox = o.tx * TILE + 8, oy = o.ty * TILE + 8;
    if (o.building) {
      o.buildT += dt;
      // SC2-style: hp grows from the 30% floor toward max as the site rises
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.7 * dt / o.buildTotal);
      // every building is several tiles wide: dust off the whole
      // footprint's front edge, and sparks off the weld line while the walls
      // rise (see bigBuildReveal)
      o.dustT -= dt;
      if (o.dustT <= 0) {
        o.dustT = 0.8;
        sfxAt('building', ox, oy);
        const c = structCenter(o);
        burst(c.x + rand(-18, 18), (o.ty + structH(o)) * TILE - 2, '#c9d0e2', 3, 25, 0.35, true);
      }
      const r = bigBuildReveal(o);
      o.sparkT -= dt;
      if (r.rows > 0 && r.rows < r.h && o.sparkT <= 0) {
        o.sparkT = 0.11;
        const x = o.tx * TILE + 3 + rng() * (structW(o) * TILE - 6);
        burst(x, r.edgeY, rng() < 0.5 ? '#fff1b0' : '#ffb347', 2, 45, 0.28, true);
      }
      if (o.buildT >= o.buildTotal) {
        o.building = false;
        o.hp = o.maxHp;
        joltObj(o, 0.3); // the completion flash
        // snow settles along the whole roofline
        const top = (o.ty + structH(o)) * TILE - structSprite(o).height + 4;
        for (let i = 0; i < 6; i++) burst(o.tx * TILE + 4 + i * 8, top, '#f4f7fc', 3, 35, 0.6, true);
        burst(structCenter(o).x, top + 12, '#aeb6c4', 8, 50, 0.5, true);
        sfxAt('hammer', ox, oy);
        STRUCTS[o.type].built(o);
      }
      continue;
    }
    STRUCTS[o.type].tick(o, dt);
  }
}
// a barracks' step (STRUCTS.barracks.tick): the wave clock. On every beat
// (barracksBeat) a wave is queued - its kinds in door order (barracksQueue),
// as many as the lane's cap leaves room for, the front of the column first -
// and the queue leaves the door one soldier every BARRACKS_ROLL, so a wave
// reads as a column, not a heap. `+=` keeps the beat: no tick's overshoot
// drifts it (the practice bar's WAVES off keeps the beat and queues nothing)
function barracksTick(o, dt) {
  o.waveT -= dt;
  if (o.waveT <= 0) {
    o.waveT += STRUCTS.barracks.waveT;
    if (!PRACTICE || state.prac.waves) barracksQueue(o);
  }
  o.rollT -= dt;
  if (o.queue > 0 && o.rollT <= 0) {
    o.rollT = BARRACKS_ROLL;
    const kind = o.kinds.shift();
    o.queue = o.kinds.length;
    const b = makeSoldier(o, kind);
    robots.push(b);
    burst(b.x, b.y - 4, '#c3c9d3', 6, 35, 0.4, true);
    burst(b.x, b.y + 2, '#e4e8ee', 5, 30, 0.45, true);
  }
  const want = o.queue > 0 ? 1 : 0; // the shutter is up only while a column is leaving
  o.door += Math.sign(want - o.door) * Math.min(Math.abs(want - o.door), dt * 2.2);
}
