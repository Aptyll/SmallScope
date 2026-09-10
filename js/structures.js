'use strict';
// Everything built: the STRUCTS table every buildable is an entry in,
// placing/upgrading/wrecking structures, and the per-type building sim
// (turrets, generators, bays, nets, keeps). The bots a bay rolls out are
// js/robots.js, which loads next.
// ------------------------------------------------------------ structures
// Everything the build list (T, js/ui.js) lays on open snow - and the net on
// a hole - and the one placement rule they all answer to (canPlaceAt).
// tiers[0] is what the list builds; tiers[1]/[2] cost/buildT are the upgrade
// price and (already shortened) upgrade construction time. `mm` and `map` are
// what the two maps paint it, the same pair OBJECTS carries for scenery -
// both maps read whichever of the two tables holds the tile's type, so a new
// building is coloured by its entry here and nothing else. Every building
// wears ITS SIDE'S INK on both (mmTeam / chTeam, world.js): at a map's scale
// a wall and a turret are the same pixel, and whose base it is is the whole
// read - the type is the sprite's job.
const STRUCTS = {
  wall: { name: 'WALL', mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 5 },  hp: 60,  buildT: 4   },
    { cost: { gold: 12 }, hp: 140, buildT: 2.4 },
    { cost: { gold: 30 }, hp: 300, buildT: 2.4 },
  ]},
  // THE LONG WALL: two wall tiles laid as one piece for a little under two
  // walls - the piece R turns (`rotates`: 2x1 or 1x2, o.rot) - and the one
  // `tiled` type: each footprint tile wears the named type's own grid, so it
  // needs no art of its own and nothing has to turn (3/4-view art cannot).
  // Hurt as one, upgraded as one.
  longwall: { name: 'LONG WALL', w: 2, h: 1, rotates: true, tiled: 'wall', mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 9 },  hp: 120, buildT: 6   },
    { cost: { gold: 22 }, hp: 280, buildT: 3.6 },
    { cost: { gold: 55 }, hp: 600, buildT: 3.6 },
  ]},
  // traverse = rad/s the head swings; aim = seconds held on target before it fires
  turret: { name: 'TURRET', mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 10 }, hp: 50,  buildT: 8,   range: 60, dmg: 6,  rate: 1.0,  traverse: 2.2, aim: 0.55 },
    { cost: { gold: 25 }, hp: 90,  buildT: 4.8, range: 76, dmg: 9,  rate: 0.8,  traverse: 3.0, aim: 0.45 },
    { cost: { gold: 50 }, hp: 140, buildT: 4.8, range: 92, dmg: 14, rate: 0.65, traverse: 3.8, aim: 0.35 },
  ]},
  generator: { name: 'GENERATOR', mm: mmTeam, map: chTeam, tiers: [
    // 4 / 6 / 10 gold a minute against the clock's own 15 (TRICKLE_*, js/sim.js):
    // a top generator is two thirds of a second trickle for 82 gold, paid back
    // in eight minutes - an early build, and something worth walking over to wreck
    { cost: { gold: 12 }, hp: 40,  buildT: 8,   pay: 1, period: 15 },
    { cost: { gold: 25 }, hp: 70,  buildT: 4.8, pay: 1, period: 10 },
    { cost: { gold: 45 }, hp: 100, buildT: 4.8, pay: 2, period: 12 },
  ]},
  // the bot bay is the one big build: a single tier on a 3x2 tile footprint
  // (w/h - see footprint()/findSite()), its three bots rolling out one by one
  spawner: { name: 'BOT BAY', w: 3, h: 2, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 45 }, hp: 220, buildT: 16, bots: 3, botHp: 24 },
  ]},
  // THE BARRACKS: the wave bay each merchant raises in the woods behind its
  // roost MERCH_BAY_T after the landing (the `merchant` banner, robots.js).
  // Never on the wheel (not in STRUCT_ORDER), nobody's to upgrade or pull
  // down (`fixed`), and it wears the bay's own 3x2 grid (`art`). Every
  // `waveT` seconds it queues a WAVE of soldiers (the `soldiers` banner,
  // robots.js) that march the road to the rival bird: `wave` of them at
  // first, one more for every `grow` seconds it has stood. Its cost is what a
  // wrecker is paid half of - breaking one stalls the waves until the
  // merchant walks back and raises it again. `cap` is the most of its
  // soldiers alive at once: a side nobody fights back against does not
  // fill the map, it waits for its column to spend itself.
  barracks: { name: 'BARRACKS', w: 3, h: 2, art: 'spawner', fixed: true, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 40 }, hp: 320, buildT: 12, wave: 5, waveT: 30, grow: 180, botHp: 30, cap: 24 },
  ]},
  // The fish net: the one building that goes on water instead of snow.
  // `water: true` is the whole difference, and every site reads that flag
  // rather than the type name - it builds on an open hole (canPlaceAt),
  // never freezes over while it stands (the dawn refreeze), and is not solid
  // (isSolidTile), because walking onto it is how anyone - owner or not -
  // takes the catch out of it.
  net: { name: 'FISH NET', water: true, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 8 }, hp: 45, buildT: 5 },
  ]},
};
// THE BUILD LIST (T, js/ui.js): every buildable in the order the list shows
// them, the net last because its site is the rarest. The two wheel tables
// are the pad's and a finger's (openWheelNear, input.js): a wheel over the
// facing tile offers the land list on land and the net over a hole. The
// barracks is the merchant's alone and on none of them.
const BUILD_ORDER = ['wall', 'longwall', 'turret', 'generator', 'spawner', 'net'];
const STRUCT_ORDER = ['wall', 'longwall', 'turret', 'generator', 'spawner'];
const WATER_STRUCT_ORDER = ['net'];
const BUILD_REACH = 64;    // px from the builder to the nearest tile of what it lays
const BARRACKS_ROLL = 0.5; // s between the soldiers of one wave leaving the door

// fish nets: a building laid over an open hole that fishes it on its own
const NET_CAP = 3;         // fish a net holds before it stops catching
const NET_R = 9;           // px from the net's centre a fish is caught at
const NET_LURE = 44;       // ...and px it draws fish gently toward
const NET_CATCH_T = 2.2;   // seconds between catches, so a net fills visibly
const NET_TAKE_T = 0.3;    // seconds between fish handed to whoever stands on it

function cumulativeCost(type, tier) {
  const total = {};
  for (let t = 0; t <= tier; t++) {
    const c = STRUCTS[type].tiers[t].cost;
    for (const k in c) total[k] = (total[k] || 0) + c[k];
  }
  return total;
}

// Can `type` stand with its anchor on (tx, ty), turned `rot`, laid by p?
// THE one placement rule - the ghost's colour, the click, the pad's wheel,
// findSite and the AI all ask it, so none of them can offer a site another
// refuses. A `water` building wants a bare open hole; everything else wants
// every footprint tile to be in-world snow or road (ground 0 / 3) holding
// nothing or a stump (a stump is consumed - it is no longer a site, just
// something a wall may stand on). No unit may stand inside the footprint (a
// building is solid, and would entomb it), and the builder - when there is
// one - must be within BUILD_REACH of the nearest footprint tile. Cost is
// not asked here: a ghost you cannot afford yet is still a valid site, and
// the list's own row says the price.
//   -> { ok, why }   why: 'ground' | 'blocked' | 'unit' | 'far' | null
function canPlaceAt(type, tx, ty, rot, p) {
  const S = STRUCTS[type];
  if (!S) return { ok: false, why: 'ground' };
  rot = S.rotates && rot ? 1 : 0;
  const tiles = footprint(type, tx, ty, rot);
  let near = Infinity;
  for (const [x, y] of tiles) {
    if (!inWorld(x, y)) return { ok: false, why: 'ground' };
    const g = ground[idx(x, y)], o = objects[idx(x, y)];
    if (S.water) { if (o || g !== 2) return { ok: false, why: o ? 'blocked' : 'ground' }; }
    else {
      if (g !== 0 && g !== 3) return { ok: false, why: 'ground' };
      if (o && o.type !== 'stump') return { ok: false, why: 'blocked' };
    }
    if (p) near = Math.min(near, Math.hypot(x * TILE + 8 - p.x, y * TILE + 8 - p.y));
  }
  if (!S.water) {
    const w = structW({ type, rot }), h = structH({ type, rot });
    const x0 = tx * TILE, y0 = ty * TILE, x1 = (tx + w) * TILE, y1 = (ty + h) * TILE;
    const inside = (x, y, r) => x > x0 - r && x < x1 + r && y > y0 - r && y < y1 + r;
    for (const q of players) if (q.active && !q.dead && !inAir(q) && inside(q.x, q.y, PLAYER_R)) return { ok: false, why: 'unit' };
    for (const b of robots) if (unitAlive(b) && inside(b.x, b.y, 7)) return { ok: false, why: 'unit' };
    for (const a of animals) if (!a.dead && inside(a.x, a.y, 6)) return { ok: false, why: 'unit' };
  }
  if (p && near > BUILD_REACH) return { ok: false, why: 'far' };
  return { ok: true, why: null };
}
// one of p's own FINISHED buildings to manage (upgrade / demolish - the
// barracks is `fixed` and refuses both, so it is nobody's to open): the one
// under p's aim if it is in reach, else the nearest in reach. What holding
// E beside a building opens (keyPress, input.js) and the pad's wheel falls
// back to (openWheelNear).
function manageNear(p) {
  const own = (o) => o && STRUCTS[o.type] && !STRUCTS[o.type].fixed && !o.building && ownsStruct(o, p) && o.team !== undefined;
  const at = structOf(objAt(Math.floor(p.input.aimX / TILE), Math.floor(p.input.aimY / TILE)));
  const reach = (o) => { const c = structCenter(o); return Math.hypot(c.x - p.x, c.y - p.y) <= 60 + (structW(o) + structH(o)) * 4; };
  if (own(at) && reach(at)) return at;
  let best = null, bd = Infinity;
  for (const o of structures) {
    if (!own(o) || !reach(o)) continue;
    const c = structCenter(o), d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// Building is a contested order: two players can claim the same tile in one
// step. The claim is checked and paid for when it wins, so a loser keeps its
// gold. p defaults to the local player (DBG staging). A big building ordered
// by ONE tile (the pad's wheel, the AI) is fitted around that tile by
// findSite when it will not stand anchored on it.
function placeStruct(tx, ty, type, p, rot) {
  p = p || player;
  const deny = (msg, t) => { if (p === player) { SFX.deny(); if (msg) showMsg(msg, t); } };
  const S = STRUCTS[type];
  if (!S || !inWorld(tx, ty)) { deny(); return; }
  rot = S.rotates && rot ? 1 : 0;
  let can = canPlaceAt(type, tx, ty, rot, p);
  if (!can.ok && can.why !== 'far' && (structW(type) > 1 || structH(type) > 1)) {
    const a = findSite(type, tx, ty);
    if (a) { tx = a.tx; ty = a.ty; rot = 0; can = canPlaceAt(type, tx, ty, rot, p); }
  }
  if (!can.ok) { deny(); return; } // the ghost already said so, in red
  const t0 = S.tiers[0];
  if (!canAfford(t0.cost, p)) { deny('NOT ENOUGH RESOURCES', 1.6); return; }
  const cxp = (tx + structW({ type, rot }) / 2) * TILE, cyp = (ty + structH({ type, rot }) / 2) * TILE;
  contest('site:' + idx(tx, ty), p, () => {
    if (!canPlaceAt(type, tx, ty, rot, p).ok) return; // somebody's build landed on it first
    if (!canAfford(t0.cost, p)) return;
    pay(t0.cost, p);
    createStruct(tx, ty, type, 0, p, true, rot);
    if (nearPlayer(cxp, cyp)) SFX.hammer();
    burst(cxp, cyp, '#eef4fb', 8, 40, 0.4, true);
  });
}

// The one place a building object is made (placeStruct and DBG.buildStruct):
// the anchor object, its footprint fillers, the registry and per-type state.
function createStruct(tx, ty, type, tier, p, building, rot) {
  const t = STRUCTS[type].tiers[tier];
  const o = placeObj(tx, ty, type, {
    tier, hp: building ? Math.ceil(t.hp * 0.3) : t.hp, maxHp: t.hp,
    building: !!building, buildT: 0, buildTotal: t.buildT, dustT: 0,
    owner: p.id, team: p.team, // paints the sprite and gates the manage wheel
    rot: STRUCTS[type].rotates && rot ? 1 : 0, // turned: w and h swapped (structW/structH, world.js)
  });
  for (const [x, y] of footprint(type, tx, ty, o.rot)) {
    if (x !== tx || y !== ty) objects[idx(x, y)] = { type: 'part', tx: x, ty: y, of: o, flash: 0, shake: 0 };
  }
  // ang: where the barrel points. tgt/chg: the mark and how locked on it is.
  // rec/mz: recoil slide and muzzle flash. scan: the idle sweep's phase.
  if (type === 'turret') { o.cd = 0; o.ang = -Math.PI / 2; o.tgt = null; o.chg = 0; o.rec = 0; o.mz = 0; o.scan = 0; }
  if (type === 'generator') o.payT = 0;
  if (type === 'spawner') { o.bots = []; o.respawnT = o.respawnTotal = 1; o.door = 1; }
  // waveT: the clock to the next wave. queue/rollT: soldiers still to leave
  // the door, and the gap to the next. born: when it stood, for the growth.
  if (type === 'barracks') { o.waveT = t.waveT; o.queue = 0; o.rollT = 0; o.born = state.elapsed; o.door = 0; }
  // fish: what the net is holding. catchT/takeT are the two clocks that let
  // it fill and empty a fish at a time instead of all at once
  if (type === 'net') { o.fish = 0; o.catchT = NET_CATCH_T; o.takeT = 0; }
  o.sparkT = 0;
  structures.push(o);
  return o;
}

// only the owning side may upgrade or demolish
function ownsStruct(o, p) { return o.team === undefined || o.team === p.team; }

// rolls a card rarity against an odds table (CHEST_ODDS - a sprung chest is
// where a card comes from, hitObject in js/actions.js) using the shared
// runtime rng() - never called from genWorld, so this never perturbs a
// seed's terrain
function rollCardRarity(odds) {
  let r = rng(), acc = 0;
  for (const rarity of CARD_RARITIES) {
    acc += odds[rarity] || 0;
    if (r < acc) return rarity;
  }
  return CARD_RARITIES[0];
}

function startUpgrade(o, p) {
  p = p || player;
  const deny = (msg, t) => { if (p === player) { SFX.deny(); if (msg) showMsg(msg, t); } };
  if (o.building || !ownsStruct(o, p) || STRUCTS[o.type].fixed) { deny(); return; }
  if (o.tier >= STRUCTS[o.type].tiers.length - 1) { deny('MAX TIER', 1.4); return; }
  const t = STRUCTS[o.type].tiers[o.tier + 1];
  if (!canAfford(t.cost, p)) { deny('NOT ENOUGH RESOURCES', 1.6); return; }
  pay(t.cost, p);
  o.tier++;
  o.maxHp = t.hp;
  o.building = true;
  o.buildT = 0;
  o.buildTotal = t.buildT;
  o.dustT = 0;
  if (nearPlayer(o.tx * TILE + 8, o.ty * TILE + 8)) SFX.hammer();
  burst(o.tx * TILE + 8, o.ty * TILE + 8, '#eef4fb', 8, 40, 0.4, true);
}

function demolishStruct(o, p) {
  // a `fixed` building (the barracks) is the eagle's, not the wallet's: nobody pulls it down for the refund
  if (!ownsStruct(o, p || player) || STRUCTS[o.type].fixed) { if ((p || player) === player) SFX.deny(); return; }
  destroyStructure(o, true, p || player);
}

function removeStruct(o) {
  for (const [x, y] of footprint(o.type, o.tx, o.ty, o.rot)) objects[idx(x, y)] = null;
  const i = structures.indexOf(o);
  if (i >= 0) structures.splice(i, 1);
  if (o.bots) for (const b of o.bots) {
    if (!b.dead) {
      b.dead = true;
      burst(b.x, b.y - 4, '#98a1b0', 8, 45, 0.5, true);
    }
  }
}

// ------------------------------------------------------------ the building sim
const RES_COLORS = {
  gold: '#f2cc6a', berry: '#f2707a', fish: '#7ac0e8',
  // card rarities - kept out of the amber family so a "gold" card drop never
  // reads as a currency floater; must match CARD_PALS in sprites.js
  cardWhite: '#d9dfe8', cardGreen: '#5fd18a', cardBlue: '#4a90e2', cardPurple: '#a259e6', cardGold: '#e8a33d',
};
// audio/screen gating: is this happening near the local listener?
function nearPlayer(x, y, r) { return !!player && Math.hypot(player.x - x, player.y - y) < (r || 180); }

// ---- turret gunnery ------------------------------------------------------
// turret gunnery. The head is NOT baked into the sprite (see js/sprites.js) - it
// is rasterised at the live angle, pivoting on sprite-local (16, 14).
const TUR_PIVOT_Y = -4;   // px: the pivot, relative to the anchor tile's top edge
const TUR_BARREL = 16;    // px from pivot to muzzle
const TUR_LOCK = 0.14;    // rad: inside this of the mark, the shot starts charging
const TUR_MZ = 0.09;      // muzzle flash duration
const BOLT_SPD = 250;     // px/s
const BOLT_LIFE = 1.1;

// The head pivots above the tile, so every bearing, range and sight line is
// measured from there rather than from the footprint's centre.
function turretPivot(o) { return { x: (o.tx + 0.5) * TILE, y: o.ty * TILE + TUR_PIVOT_Y }; }
// players carry an `input` struct, worker bots do not - aim at the body of each
function turretAimY(tg) { return tg.input ? tg.y - BOW_Y : tg.y - 4; }
function turretMuzzle(o) {
  const pv = turretPivot(o), c = Math.cos(o.ang || 0), sn = Math.sin(o.ang || 0);
  const r = TUR_BARREL - (o.rec || 0) * 3;
  return { x: pv.x + c * r, y: pv.y + sn * r, nx: c, ny: sn };
}
// A bolt flies OVER the world - walls, pines, the roost's own tiles
// (`solid: false`, fireBolt) - so a turret needs no line of sight: the
// merchant stands its guns inside a ring of walls (the two stump rings,
// eagleCrash) and they cover the ground beyond it, and a player's turret
// behind a wall of its own is a gun and not a prop. Range alone limits it.
// a valid mark is an enemy player (never one still on the eagle) or worker
// bot - unitAlive (js/actions.js) is the one gate, so a merchant is never one
function turretFoe(o, tg) {
  return unitAlive(tg) && tg.team !== o.team;
}
function turretHolds(o, tg, range, pv) {
  return turretFoe(o, tg) &&
    Math.hypot(tg.x - pv.x, turretAimY(tg) - pv.y) <= (tg instanceof Player ? seenAt(tg, range) : range);
}
function turretMark(o, range, pv) {
  let best = null, bd = range;
  const test = (tg) => {
    if (!turretFoe(o, tg)) return;
    const d = Math.hypot(tg.x - pv.x, turretAimY(tg) - pv.y);
    // GHOSTSTEP - and a body buried in the snow - shrink the ring this target
    // is acquired (and held) inside
    if (d > (tg instanceof Player ? seenAt(tg, range) : range)) return;
    if (d < bd) { bd = d; best = tg; }
  };
  for (const p of players) test(p);
  for (const b of robots) test(b);
  return best;
}
// the shot leaves the barrel tip and rides the normal arrow pipeline, so it
// hits players and animals, respects friendly fire, and credits the owner -
// but it passes the world (`solid: false`, the wisp's own flag: the arrow
// loop's solid-tile branch skips it), so it clears the wall in front of the
// gun, the pines, and the turret's own mount, and never sieges a building
function fireBolt(o, t, pv) {
  const m = turretMuzzle(o), team = o.team === undefined ? 0 : o.team;
  arrows.push({
    kind: 'bolt', x: m.x, y: m.y, solid: false,
    vx: m.nx * BOLT_SPD, vy: m.ny * BOLT_SPD,
    t: 0, life: BOLT_LIFE, dmg: t.dmg, pow: 1,
    owner: o.owner === undefined ? 0 : o.owner, team: team, trailD: 0,
  });
  burst(m.x, m.y, TEAMS[skin(team)].mark, 4, 60, 0.22, true);
  if (nearPlayer(pv.x, pv.y)) SFX.turretFire();
}

function updateStructures(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].t -= dt;
    if (tracers[i].t <= 0) tracers.splice(i, 1);
  }
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
        if (nearPlayer(ox, oy)) SFX.building();
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
        o.flash = 0.3; // the completion flash
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
        if (nearPlayer(ox, oy)) { SFX.hammer(); state.shake = Math.max(state.shake, big ? 2.5 : 1.5); }
        if (o.type === 'turret') o.cd = 0;
        if (o.type === 'generator') o.payT = STRUCTS.generator.tiers[o.tier].period;
        if (o.type === 'spawner') { o.respawnT = o.respawnTotal = 1; }
        if (o.type === 'barracks') { o.waveT = STRUCTS.barracks.tiers[o.tier].waveT; o.born = state.elapsed; }
      }
      continue;
    }
    const t = STRUCTS[o.type].tiers[o.tier];
    if (o.type === 'turret') {
      o.cd -= dt;
      o.rec = Math.max(0, o.rec - dt * 7);
      o.mz = Math.max(0, o.mz - dt);
      const pv = turretPivot(o);
      if (o.tgt && !turretHolds(o, o.tgt, t.range, pv)) o.tgt = null;
      if (!o.tgt) o.tgt = turretMark(o, t.range, pv);
      let want, rate = t.traverse;
      if (o.tgt) {
        want = Math.atan2(turretAimY(o.tgt) - pv.y, o.tgt.x - pv.x);
      } else {
        // idle sweep, at a third of the traverse: a live turret should never
        // read as a dead prop, and the sweep telegraphs its arc to a raider
        o.scan += dt * 0.55;
        want = -Math.PI / 2 + Math.sin(o.scan) * 1.15;
        rate = t.traverse * 0.35;
      }
      let da = want - o.ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const step = rate * dt;
      o.ang += Math.max(-step, Math.min(step, da));  // swing, never snap
      if (o.tgt && Math.abs(da) < TUR_LOCK) {
        o.chg = Math.min(1, o.chg + dt / t.aim);
        if (o.chg >= 1 && o.cd <= 0) {
          fireBolt(o, t, pv);
          o.cd = t.rate; o.chg = 0; o.rec = 1; o.mz = TUR_MZ;
        }
      } else {
        o.chg = Math.max(0, o.chg - dt * 2.5); // lost the lock: bleed the charge
      }
    } else if (o.type === 'generator') {
      o.payT -= dt;
      if (o.payT <= 0) {
        o.payT = t.period;
        // passive income deposits straight into the owner's wallet - gold is
        // never a physical drop, so there is no pile to collect or to cap
        awardGold(players[o.owner], t.pay, ox, oy + 2);
        burst(ox, oy - 6, '#c9d0e2', 2, 20, 0.3);
      }
    } else if (o.type === 'spawner') {
      // bots roll out one after another (4 s apart); a lost bot takes 12 s to replace
      const alive = o.bots.filter((b) => !b.dead);
      if (alive.length < o.bots.length && o.respawnT < 12) { o.respawnT = o.respawnTotal = 12; }
      o.bots = alive;
      const due = o.bots.length < t.bots;
      if (due) {
        o.respawnT -= dt;
        if (o.respawnT <= 0) {
          o.respawnT = o.respawnTotal = 4;
          const b = makeRobot(o);
          o.bots.push(b);
          robots.push(b);
          burst(b.x, b.y - 4, '#c3c9d3', 6, 35, 0.4, true);
          burst(b.x, b.y + 2, '#e4e8ee', 5, 30, 0.45, true); // exhaust off the mouth
        }
      }
      // the shutter: open while a worker is out in the yard or one is rolling
      // out, shut when the whole crew is home - so the door reports the bay's
      // state rather than a mode nobody sets any more
      const mo = structMouth(o);
      const out = o.bots.some((b) => !b.dead && Math.hypot(b.x - mo.x, b.y - mo.y) > 20);
      const want = (out || (due && o.respawnT < 1.4)) ? 1 : 0;
      o.door += Math.sign(want - o.door) * Math.min(Math.abs(want - o.door), dt * 2.2);
    } else if (o.type === 'barracks') {
      // the wave clock: every waveT a wave is queued - `wave` soldiers, one
      // more per `grow` seconds stood - and the queue leaves the door one
      // soldier every BARRACKS_ROLL, so a wave reads as a column, not a heap
      o.waveT -= dt;
      if (o.waveT <= 0) {
        o.waveT = t.waveT;
        let alive = o.queue;
        for (const b of robots) if (b.kind === 'soldier' && b.home === o && !b.dead) alive++;
        o.queue += Math.max(0, Math.min(t.cap - alive, t.wave + Math.floor((state.elapsed - o.born) / t.grow)));
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
          o.catchT = NET_CATCH_T;
          if (nearPlayer(ox, oy)) SFX.splash();
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
            if (o.fish <= 0 || bagAdd(p, 'fish', 1) < 1) return;
            o.fish--;
            o.takeT = NET_TAKE_T;
            if (p.catchT <= 0) startCatch(p); // the first fish off the rope is hoisted; the rest come up under it
            addFloater(p.x, p.y - 14, '+1', RES_COLORS.fish);
            if (p === player) SFX.stash();
          });
        }
      }
    }
  }
}
