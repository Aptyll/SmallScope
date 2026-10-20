'use strict';
// Everything built: the STRUCTS table every building is an entry in, making
// and wrecking one, and the per-type building sim (road towers, barracks,
// gold pumps, nets). Nobody builds by hand: every building is the map's or
// the eagle's merchant's. The soldiers a barracks rolls out are
// js/sim/robots.js, which loads next.
// ------------------------------------------------------------ structures
// tiers[0] is what stands; `mm` and `map` are what the two maps paint it, the
// same pair OBJECTS carries for scenery - both maps read whichever of the two
// tables holds the tile's type, so a building is coloured by its entry here
// and nothing else. Every building wears ITS SIDE'S INK on both (mmTeam /
// chTeam, world.js): at a map's scale whose base it is is the whole read -
// the type is the sprite's job. A building's cost is what a wrecker is paid
// half of (wreckPay). `sight` is the px of fog of war a standing one of a
// side lifts round its middle, or round `eye(o)` (sightSources, js/sim/fog.js).
const STRUCTS = {
  // THE GOLD PUMP (type 'generator'): a pump jack on a 4x2 tile pad, the
  // map's two neutral objectives (the `pumps` banner, js/sim/pumps.js). It
  // wears its HOLDER's paint, or grey held by nobody (mmPump/chPump, world.js;
  // pumpSet, js/draw/structs.js). While a side holds it, every hero on that
  // side is paid `pay` every `period` s; its stroke runs off o.payT against
  // `period` (pumpFrame). Nothing hurts it, so its hp and cost go unread.
  generator: { name: 'GOLD PUMP', w: 4, h: 2, mm: mmPump, map: chPump, tiers: [
    { cost: { gold: 60 },  hp: 160, buildT: 20, pay: 3, period: 10 },
  ]},
  // THE BARRACKS: the wave bays each merchant raises in the back woods
  // behind its roost, the first MERCH_BAY_T after the landing and up to
  // MERCH_BAYS for its logs (the `merchant` banner, robots.js).
  // It wears the bay's own 3x2 grid (`art`). Every `waveT` seconds it queues a WAVE of soldiers (the
  // `soldiers` banner, robots.js) that march the road to the rival bird:
  // `wave` of them at first, one more for every `grow` seconds it has stood.
  // Its cost is what a wrecker is paid half of - breaking one stalls the
  // waves until the merchant walks back and raises it again. `cap` is the
  // most of a SIDE's soldiers alive at once, every bay counted: a side
  // nobody fights back against does not fill the map, it waits for its
  // column to spend itself.
  barracks: { name: 'BARRACKS', w: 3, h: 2, art: 'spawner', sight: 176, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 40 }, hp: 320, buildT: 12, wave: 3, waveT: 30, grow: 180, botHp: 60, cap: 8 }, // cap: soldiers a LANE holds, queued or out; botHp: a soldier's health at the start, grown by SOLDIER_HP_GROW (js/sim/robots.js)
  ]},
  // THE ROAD TOWER: the map's, never a wallet's - two stand on each side's
  // cable at boot (placeTowers, js/sim/towers.js), each with a crossbow on
  // its deck that holds its stretch of road, and a side's cable runs only as
  // far as its furthest standing one. The wrecker is paid half its cost like any wreck, and its fall
  // is the announcer's (`call`, callStruct). Its gun's numbers sit with its
  // sim (TOWER_*, towers.js).
  // It sees from its foot, half again past a hero (TOWER_RANGE is 112).
  tower: { name: 'ROAD TOWER', w: 3, h: 2, call: true, sight: 240, eye: (o) => towerFoot(o), mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 150 }, hp: 700, buildT: 1 },
  ]},
  // The fish net: the one building that goes on water instead of snow.
  // `water: true` is the whole difference, and every site reads that flag
  // rather than the type name - it never freezes over while it stands (the
  // dawn refreeze), and is not solid (isSolidTile), because walking onto it
  // is how anyone - owner or not - takes the catch out of it.
  net: { name: 'FISH NET', water: true, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 8 }, hp: 45, buildT: 5 },
  ]},
};
const BARRACKS_ROLL = 0.5; // s between the soldiers of one wave leaving the door

// fish nets: a building laid over an open hole that fishes it on its own
const NET_CAP = 3;         // fish a net holds before it stops catching
const NET_R = 9;           // px from the net's centre a fish is caught at
const NET_LURE = 44;       // ...and px it draws fish gently toward
const NET_CATCH_T = 2.2;   // seconds between catches, so a net fills visibly
const NET_TAKE_T = 0.3;    // seconds between fish handed to whoever stands on it

// The one place a building object is made (the merchant's barracks, the road
// towers and DBG.buildStruct): the anchor object, its footprint fillers, the
// registry and per-type state. `building` raises it from scratch over the
// tier's buildT; p is { id, team } - a player, or the side's own stand-in.
function createStruct(tx, ty, type, tier, p, building) {
  const t = STRUCTS[type].tiers[tier];
  const o = placeObj(tx, ty, type, {
    tier, hp: building ? Math.ceil(t.hp * 0.3) : t.hp, maxHp: t.hp,
    building: !!building, buildT: 0, buildTotal: t.buildT, dustT: 0,
    owner: p.id, team: p.team, // paints the sprite
  });
  for (const [x, y] of footprint(type, tx, ty)) {
    if (x !== tx || y !== ty) objects[idx(x, y)] = { type: 'part', tx: x, ty: y, of: o, flash: 0, shake: 0 };
  }
  // ang: the gun's bearing; tgt/chg: its mark and how far it has wound; cd: the
  // reload; heat/heatId: bolts in a row into one scout; bolt/pin: the one in the
  // air and the spent one in the snow (updateTower, js/sim/towers.js)
  if (type === 'tower') { o.zl = -1; o.zi = -1; o.ang = p.team === 0 ? -Math.PI / 4 : Math.PI * 3 / 4; o.tgt = null; o.chg = 0; o.cd = 0; o.heat = 0; o.heatId = -1; o.bolt = null; o.pin = null; o.loose = -9; }
  if (type === 'generator') { o.hold = -1; o.cap = 0; o.capBy = -1; o.payT = t.period; o.paid = false; } // the ring's state (updatePump, js/sim/pumps.js)
  // waveT: the clock to the next wave. queue/rollT: soldiers still to leave
  // the door, and the gap to the next. born: when it stood, for the growth.
  if (type === 'barracks') { o.waveT = t.waveT; o.queue = 0; o.rollT = 0; o.born = state.elapsed; o.door = 0; }
  // fish: what the net is holding. catchT/takeT are the two clocks that let
  // it fill and empty a fish at a time instead of all at once
  if (type === 'net') { o.fish = 0; o.sun = 0; o.catchT = NET_CATCH_T; o.takeT = 0; } // o.sun: how many of o.fish are gold sunfish
  o.sparkT = 0;
  structures.push(o);
  return o;
}

// is o p's side's (or nobody's)? Nobody swings at their own side's building
// (autoToolFor, js/sim/actions.js)
function ownsStruct(o, p) { return o.team === undefined || o.team === p.team; }

// WHAT A WRECK PAYS whoever brought it down: half the building's price
function wreckPay(o) { return Math.floor((STRUCTS[o.type].tiers[o.tier].cost.gold || 0) / 2); }

function removeStruct(o) {
  for (const [x, y] of footprint(o.type, o.tx, o.ty)) objects[idx(x, y)] = null;
  const i = structures.indexOf(o);
  if (i >= 0) structures.splice(i, 1);
}

// ------------------------------------------------------------ the building sim
const RES_COLORS = {
  gold: '#f2cc6a', berry: '#f2707a', fish: '#9fd0ea', sunfish: '#f2b640', whitefish: '#cfdcec', snowChar: '#d47e8e',
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
  towersSync(); // a side's cable runs to its furthest standing road tower (js/sim/towers.js)
  for (const o of structures) {
    const ox = o.tx * TILE + 8, oy = o.ty * TILE + 8;
    if (o.building) {
      o.buildT += dt;
      // SC2-style: hp grows from the 30% floor toward max as the site rises
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.7 * dt / o.buildTotal);
      o.dustT -= dt;
      const big = structW(o) > 1 || structH(o) > 1;
      if (o.dustT <= 0) {
        o.dustT = 0.8;
        sfxAt('building', ox, oy);
        if (big) {
          // dust off the whole footprint's front edge
          const c = structCenter(o);
          burst(c.x + rand(-18, 18), (o.ty + structH(o)) * TILE - 2, '#c9d0e2', 3, 25, 0.35, true);
        } else burst(ox, oy + 4, '#c9d0e2', 3, 25, 0.35, true);
      }
      if (big) {
        // sparks off the weld line while the walls rise (see bigBuildReveal)
        const r = bigBuildReveal(o);
        o.sparkT -= dt;
        if (r.rows > 0 && r.rows < r.h && o.sparkT <= 0) {
          o.sparkT = 0.11;
          const x = o.tx * TILE + 3 + rng() * (structW(o) * TILE - 6);
          burst(x, r.edgeY, rng() < 0.5 ? '#fff1b0' : '#ffb347', 2, 45, 0.28, true);
        }
      }
      if (o.buildT >= o.buildTotal) {
        o.building = false;
        o.hp = o.maxHp;
        joltObj(o, 0.3); // the completion flash
        if (big) {
          // snow settles along the whole roofline
          const top = (o.ty + structH(o)) * TILE - structSprite(o).height + 4;
          for (let i = 0; i < 6; i++) burst(o.tx * TILE + 4 + i * 8, top, '#f4f7fc', 3, 35, 0.6, true);
          burst(structCenter(o).x, top + 12, '#aeb6c4', 8, 50, 0.5, true);
        } else {
          burst(ox, oy - 4, '#8a6142', 12, 55, 0.6, true);
          burst(ox, oy - 4, '#eef4fb', 10, 50, 0.6, true);
          burst(ox, oy - 4, o.tier === 2 ? '#f2cc6a' : o.tier === 1 ? '#a8b0c4' : '#c9a06a', 6, 45, 0.5, true);
        }
        sfxAt('hammer', ox, oy); shakeAt(ox, oy, big ? 2.5 : 1.5);
        if (o.type === 'generator') o.payT = STRUCTS.generator.tiers[o.tier].period;
        if (o.type === 'barracks') { o.waveT = STRUCTS.barracks.tiers[o.tier].waveT; o.born = state.elapsed; }
      }
      continue;
    }
    const t = STRUCTS[o.type].tiers[o.tier];
    if (o.type === 'tower') updateTower(o, dt);
    else if (o.type === 'generator') updatePump(o, dt); // the ring and the pay (js/sim/pumps.js)
    else if (o.type === 'barracks') {
      // the wave clock: every waveT a wave is queued - `wave` soldiers, one
      // more per `grow` seconds stood - and the queue leaves the door one
      // soldier every BARRACKS_ROLL, so a wave reads as a column, not a heap
      o.waveT -= dt;
      if (o.waveT <= 0) {
        o.waveT = t.waveT;
        o.queue += Math.max(0, Math.min(t.cap - barracksLaneLoad(o), t.wave + Math.floor((state.elapsed - o.born) / t.grow)));
      }
      o.rollT -= dt;
      if (o.queue > 0 && o.rollT <= 0) {
        o.rollT = BARRACKS_ROLL;
        o.queue--;
        const b = makeSoldier(o);
        robots.push(b);
        burst(b.x, b.y - 4, '#c3c9d3', 6, 35, 0.4, true);
        burst(b.x, b.y + 2, '#e4e8ee', 5, 30, 0.45, true);
      }
      const want = o.queue > 0 ? 1 : 0; // the shutter is up only while a column is leaving
      o.door += Math.sign(want - o.door) * Math.min(Math.abs(want - o.door), dt * 2.2);
    } else if (o.type === 'net') {
      // The net fishes on its own: any born fish that swims over the rope is
      // caught and comes out of the shoal (which is what the trickle in
      // updateFish refills), one every NET_CATCH_T so a net visibly fills
      // rather than snapping shut on the whole pond at once.
      o.catchT -= dt;
      if (o.fish < NET_CAP && o.catchT <= 0) {
        for (let k = fish.length - 1; k >= 0; k--) {
          const f = fish[k];
          if (!f.born || Math.hypot(f.x - ox, f.y - oy) > NET_R) continue;
          fish.splice(k, 1);
          o.fish++;
          if (f.kind === 'sunfish') o.sun = (o.sun || 0) + 1;
          o.catchT = NET_CATCH_T;
          sfxAt('splash', ox, oy);
          burst(ox, oy, '#7fa9c6', 6, 40, 0.4, true);
          burst(ox, oy, '#ddf1f8', 5, 45, 0.4, true);
          break;
        }
      }
      // ...and it hands the catch to whoever is standing on it, theirs or
      // not: a net is a thing lying on the ice, not a locked chest. Contested,
      // so two players over one rope cannot take the same fish.
      o.takeT -= dt;
      if (o.fish > 0 && o.takeT <= 0) {
        for (const p of players) {
          if (!p.active || p.dead || inAir(p)) continue;
          if (Math.floor(p.x / TILE) !== o.tx || Math.floor((p.y + 4) / TILE) !== o.ty) continue;
          contest('net:' + idx(o.tx, o.ty), p, () => {
            const k = o.sun > 0 ? 'sunfish' : 'fish'; // the rare one comes off the rope first
            if (o.fish <= 0 || bagAdd(p, k, 1) < 1) return;
            o.fish--;
            if (k === 'sunfish') o.sun--;
            o.takeT = NET_TAKE_T;
            if (p.catchT <= 0) startCatch(p, k); // the first fish off the rope is hoisted; the rest come up under it
            addFloater(p.x, p.y - 14, '+1', RES_COLORS[k]);
            sfxFor(p, 'stash');
          });
        }
      }
    }
  }
}
