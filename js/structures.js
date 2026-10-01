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
// `ramp`: an INCOME building (one that pays its owner on its own) gets dearer
// with every one of its type the owner already has standing - its price is
// tiers[0].cost x ramp^n (buildCost, below). Income is a payback sum: a first
// generator pays itself back in three minutes, so without the ramp the best
// play was always another one, and a match drowned in them. With it the
// answer turns: the fourth or fifth costs more than an upgrade or the gear
// it competes with, and the list's own price says so. Defence never ramps.
// `blurb` is what a piece is FOR, one short sentence to a line (a line is
// split at '. ' and must fit the tooltip's width): the build list's hover
// (tipStruct, js/ui/tooltip.js) prints it under the numbers.
const STRUCTS = {
  // `line`: a drag over the world lays a straight run of it (buildLine)
  wall: { name: 'WALL', blurb: 'NOTHING WALKS THROUGH IT. MOST SHOTS STOP ON IT.', line: true, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 5 },  hp: 60,  buildT: 4   },
    { cost: { gold: 12 }, hp: 140, buildT: 2.4 },
    { cost: { gold: 30 }, hp: 300, buildT: 2.4 },
  ]},
  // THE LONG WALL: two wall tiles laid as one piece for a little under two
  // walls - the piece R turns (`rotates`: 2x1 or 1x2, o.rot) - and the one
  // `tiled` type: each footprint tile wears the named type's own grid, so it
  // needs no art of its own and nothing has to turn (3/4-view art cannot).
  // Hurt as one, upgraded as one.
  longwall: { name: 'LONG WALL', blurb: 'TWO WALLS IN ONE PIECE, FOR LESS.', w: 2, h: 1, rotates: true, tiled: 'wall', mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 9 },  hp: 120, buildT: 6   },
    { cost: { gold: 22 }, hp: 280, buildT: 3.6 },
    { cost: { gold: 55 }, hp: 600, buildT: 3.6 },
  ]},
  // THE GATE: a wall piece its own side walks through and nobody else does -
  // `gate` is the whole difference, read by isSolidTile (world.js) with the
  // walker in hand. Shots stop on it like any wall, whoever fired them.
  gate: { name: 'GATE', blurb: 'YOUR SIDE WALKS THROUGH IT. NOTHING ELSE DOES.', gate: true, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 7 },  hp: 60,  buildT: 4   },
    { cost: { gold: 16 }, hp: 140, buildT: 2.4 },
    { cost: { gold: 36 }, hp: 300, buildT: 2.4 },
  ]},
  // THE TURRET: a SLINGSHOT on a timber base. Each tier is its own wooden
  // grid (js/sprites/buildings.js) - the upgrade is more timber, never a
  // change of material - and the fork above it is rasterised live at the
  // launch bearing (the `turret gunnery` banner below).
  // traverse = rad/s the fork swings; aim = seconds held on the launch bearing
  // before it lets go; acc = the share of throws that go where they are aimed,
  // the rest landing ROCK_MISS px off it. range grows the most per tier: the
  // upgrade a defender buys is reach.
  // head = px round turretPivot the fork's turntable stands, above the tile: a
  // shot through it lands (structShotBox, sim.js) - the arms past it are
  // sticks a shot flies by
  turret: { name: 'TURRET', blurb: 'SLINGS ROCKS AT WHATEVER IS HOSTILE IN RANGE. IT THROWS OVER WALLS AND TREES.', head: 6, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 10 }, hp: 50,  buildT: 8,   range: 64,  dmg: 6,  rate: 1.0,  traverse: 2.2, aim: 0.55, acc: 0.6 },
    { cost: { gold: 25 }, hp: 90,  buildT: 4.8, range: 92,  dmg: 9,  rate: 0.8,  traverse: 3.0, aim: 0.45, acc: 0.8 },
    { cost: { gold: 50 }, hp: 140, buildT: 4.8, range: 124, dmg: 14, rate: 0.65, traverse: 3.8, aim: 0.35, acc: 0.9 },
  ]},
  generator: { name: 'GENERATOR', blurb: 'PAYS YOU GOLD FOR AS LONG AS IT STANDS.', ramp: 1.5, mm: mmTeam, map: chTeam, tiers: [
    // 4 / 6 / 10 gold a minute against the clock's own 15 (TRICKLE_*, js/sim.js):
    // a top generator is two thirds of a second trickle for 82 gold, paid back
    // in eight minutes - an early build, and something worth walking over to wreck
    { cost: { gold: 12 }, hp: 40,  buildT: 8,   pay: 1, period: 15 },
    { cost: { gold: 25 }, hp: 70,  buildT: 4.8, pay: 1, period: 10 },
    { cost: { gold: 45 }, hp: 100, buildT: 4.8, pay: 2, period: 12 },
  ]},
  // the bot bay is the one big build: a single tier on a 3x2 tile footprint
  // (w/h - see footprint()/findSite()), its three bots rolling out one by one
  spawner: { name: 'BOT BAY', blurb: 'ROLLS OUT BOTS THAT DIG GOLD FOR YOU. THEY WORK WHERE YOUR FLAG SAYS.', ramp: 1.5, w: 3, h: 2, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 45 }, hp: 220, buildT: 16, bots: 3, botHp: 24 },
  ]},
  // THE BARRACKS: the wave bays each merchant raises in the back woods
  // behind its roost, the first MERCH_BAY_T after the landing and up to
  // MERCH_BAYS for its logs (the `merchant` banner, robots.js).
  // Never on the wheel (not in STRUCT_ORDER), nobody's to upgrade or pull
  // down (`fixed`), and it wears the bay's own 3x2 grid (`art`). Every
  // `waveT` seconds it queues a WAVE of soldiers (the `soldiers` banner,
  // robots.js) that march the road to the rival bird: `wave` of them at
  // first, one more for every `grow` seconds it has stood. Its cost is what a
  // wrecker is paid half of - breaking one stalls the waves until the
  // merchant walks back and raises it again. `cap` is the most of a SIDE's
  // soldiers alive at once, every bay counted: a side nobody fights back
  // against does not fill the map, it waits for its column to spend itself.
  barracks: { name: 'BARRACKS', w: 3, h: 2, art: 'spawner', fixed: true, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 40 }, hp: 320, buildT: 12, wave: 5, waveT: 30, grow: 180, botHp: 30, cap: 24 },
  ]},
  // The fish net: the one building that goes on water instead of snow.
  // `water: true` is the whole difference, and every site reads that flag
  // rather than the type name - it builds on an open hole (canPlaceAt),
  // never freezes over while it stands (the dawn refreeze), and is not solid
  // (isSolidTile), because walking onto it is how anyone - owner or not -
  // takes the catch out of it.
  net: { name: 'FISH NET', blurb: 'GOES ON AN OPEN ICE HOLE AND FISHES. WHOEVER WALKS ONTO IT TAKES THE CATCH.', water: true, mm: mmTeam, map: chTeam, tiers: [
    { cost: { gold: 8 }, hp: 45, buildT: 5 },
  ]},
};
// THE BUILD LIST (T, js/ui.js): every buildable in the order the list shows
// them, the net last because its site is the rarest. The two wheel tables
// are the pad's (openWheelNear, input.js): a wheel over the
// facing tile offers the land list on land and the net over a hole. The
// barracks is the merchant's alone and on none of them.
const BUILD_ORDER = ['wall', 'longwall', 'gate', 'turret', 'generator', 'spawner', 'net'];
const STRUCT_ORDER = ['wall', 'longwall', 'gate', 'turret', 'generator', 'spawner'];
const WATER_STRUCT_ORDER = ['net'];
const BUILD_REACH = 64;    // px from the builder to the nearest tile of what it lays
const BUILD_LINE_MAX = 12; // tiles one drag can lay: more than the reach ever lets stand
const CREW_BOOST = 0.5;    // a site rises this much faster for each of its side standing in BUILD_REACH...
const CREW_MAX = 3;        // ...counting this many at most
const REPAIR_SHARE = 0.5;  // a repair costs this share of the tier's price, scaled by the hp missing
const REPAIR_RATE = 0.25;  // ...and mends this share of max hp a second, hits or not
const BARRACKS_ROLL = 0.5; // s between the soldiers of one wave leaving the door

// fish nets: a building laid over an open hole that fishes it on its own
const NET_CAP = 3;         // fish a net holds before it stops catching
const NET_R = 9;           // px from the net's centre a fish is caught at
const NET_LURE = 44;       // ...and px it draws fish gently toward
const NET_CATCH_T = 2.2;   // seconds between catches, so a net fills visibly
const NET_TAKE_T = 0.3;    // seconds between fish handed to whoever stands on it

// WHAT p PAYS TO LAY ONE MORE `type` right now: the first tier's price,
// times the type's `ramp` for each of that type p already owns (standing or
// still going up). The one price every surface asks - the click, the drag,
// the list, the wheel, the tooltip, the bots - so none can quote another.
function buildCost(type, p) {
  const S = STRUCTS[type], c = S.tiers[0].cost;
  if (!S.ramp || !p) return c;
  let n = 0;
  for (const o of structures) if (o.type === type && o.owner === p.id) n++;
  if (!n) return c;
  const out = {};
  for (const k in c) out[k] = Math.round(c[k] * Math.pow(S.ramp, n));
  return out;
}
// what one standing building has cost so far: its price when it was laid
// (`paid`, which the ramp may have raised over tiers[0]) plus every upgrade
function cumulativeCost(type, tier, paid) {
  const total = {};
  for (let t = 0; t <= tier; t++) {
    const c = t === 0 && paid ? paid : STRUCTS[type].tiers[t].cost;
    for (const k in c) total[k] = (total[k] || 0) + c[k];
  }
  return total;
}

// THE RUN A DRAG LAYS: from the press's tile along whichever axis the pointer
// travelled further, never more than BUILD_LINE_MAX tiles. The ghost draws
// these tiles and runCmd lays them, so the two can never disagree.
function buildLine(tx, ty, tx2, ty2) {
  const dx = tx2 - tx, dy = ty2 - ty;
  const n = Math.min(BUILD_LINE_MAX - 1, Math.max(Math.abs(dx), Math.abs(dy)));
  const sx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0, sy = sx ? 0 : Math.sign(dy);
  const out = [];
  for (let i = 0; i <= n; i++) out.push([tx + sx * i, ty + sy * i]);
  return out;
}
// A dragged run, for any player: every tile of it that can stand is laid
// as its own contested order, in order from the press, so a purse that runs
// out stops the run where it runs out (placeStruct re-asks the price when
// its claim wins) and a tile that cannot stand is simply skipped.
function placeLine(p, c) {
  if (!STRUCTS[c.id] || !STRUCTS[c.id].line) return false;
  let any = false;
  for (const [x, y] of buildLine(c.tx, c.ty, c.tx2, c.ty2)) {
    if (canPlaceAt(c.id, x, y, 0, p).ok && placeStruct(x, y, c.id, p, 0) === true) any = true;
  }
  return any;
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
// one of p's own buildings to manage (upgrade / repair / demolish, or only
// the demolish while it is still going up - the barracks is `fixed` and
// refuses all of it, so it is nobody's to open): the one
// under p's aim if it is in reach, else the nearest in reach. What holding
// E beside a building opens (keyPress, input.js) and the pad's wheel falls
// back to (openWheelNear).
function manageNear(p) {
  const own = (o) => o && STRUCTS[o.type] && !STRUCTS[o.type].fixed && ownsStruct(o, p) && o.team !== undefined;
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
  const deny = (msg, t) => { sfxFor(p, 'deny'); if (p === player && msg) showMsg(msg, t); };
  const S = STRUCTS[type];
  if (!S || !inWorld(tx, ty)) { deny(); return 'ground'; }
  rot = S.rotates && rot ? 1 : 0;
  let can = canPlaceAt(type, tx, ty, rot, p);
  if (!can.ok && can.why !== 'far' && (structW(type) > 1 || structH(type) > 1)) {
    const a = findSite(type, tx, ty);
    if (a) { tx = a.tx; ty = a.ty; rot = 0; can = canPlaceAt(type, tx, ty, rot, p); }
  }
  if (!can.ok) { deny(); return can.why || false; } // the ghost already said so, in red
  if (!canAfford(buildCost(type, p), p)) { deny('NOT ENOUGH RESOURCES', 1.6); return 'gold'; }
  const cxp = (tx + structW({ type, rot }) / 2) * TILE, cyp = (ty + structH({ type, rot }) / 2) * TILE;
  contest('site:' + idx(tx, ty), p, () => {
    if (!canPlaceAt(type, tx, ty, rot, p).ok) return; // somebody's build landed on it first
    const cost = buildCost(type, p); // asked again: another of p's own may have landed this step
    if (!canAfford(cost, p)) return;
    pay(cost, p);
    createStruct(tx, ty, type, 0, p, true, rot).paid = cost;
    sfxAt('hammer', cxp, cyp);
    burst(cxp, cyp, '#eef4fb', 8, 40, 0.4, true);
  });
  return true; // ordered (a rival's order on the same tile can still land first)
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
  if (type === 'turret') { o.cd = 0; o.ang = -Math.PI / 2; o.tgt = null; o.tgtK = null; o.off = null; o.chg = 0; o.rec = 0; o.scan = 0; }
  if (type === 'generator') o.payT = 0;
  if (type === 'spawner') { o.bots = []; o.respawnT = o.respawnTotal = 1; o.door = 1; }
  // waveT: the clock to the next wave. queue/rollT: soldiers still to leave
  // the door, and the gap to the next. born: when it stood, for the growth.
  if (type === 'barracks') { o.waveT = t.waveT; o.queue = 0; o.rollT = 0; o.born = state.elapsed; o.door = 0; }
  // fish: what the net is holding. catchT/takeT are the two clocks that let
  // it fill and empty a fish at a time instead of all at once
  if (type === 'net') { o.fish = 0; o.catchT = NET_CATCH_T; o.takeT = 0; }
  o.sparkT = 0;
  o.mend = 0; // hp a paid repair has still to put back (startRepair)
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
  const deny = (msg, t) => { sfxFor(p, 'deny'); if (p === player && msg) showMsg(msg, t); };
  if (o.building || !ownsStruct(o, p) || STRUCTS[o.type].fixed) { deny(); return false; }
  if (o.tier >= STRUCTS[o.type].tiers.length - 1) { deny('MAX TIER', 1.4); return 'max'; }
  const t = STRUCTS[o.type].tiers[o.tier + 1];
  if (!canAfford(t.cost, p)) { deny('NOT ENOUGH RESOURCES', 1.6); return 'gold'; }
  pay(t.cost, p);
  o.tier++;
  o.maxHp = t.hp;
  o.building = true;
  o.buildT = 0;
  o.buildTotal = t.buildT;
  o.dustT = 0;
  sfxAt('hammer', o.tx * TILE + 8, o.ty * TILE + 8);
  burst(o.tx * TILE + 8, o.ty * TILE + 8, '#eef4fb', 8, 40, 0.4, true);
  return true;
}

// WHAT A REPAIR COSTS: REPAIR_SHARE of the standing tier's price, scaled by
// the share of hp still missing once any mend already paid for lands - at
// least 1 while anything is missing, 0 with nothing to mend
function repairCost(o) {
  const miss = o.maxHp - o.hp - (o.mend || 0);
  if (miss <= 0) return 0;
  const g = STRUCTS[o.type].tiers[o.tier].cost.gold || 0;
  return Math.max(1, Math.ceil(g * REPAIR_SHARE * miss / o.maxHp));
}
// The manage wheel's repair: pay repairCost and the building mends at
// REPAIR_RATE until it is whole (updateStructures). Hits still land while it
// mends; they just have more to take back.
function startRepair(o, p) {
  p = p || player;
  const deny = (msg, t) => { sfxFor(p, 'deny'); if (p === player && msg) showMsg(msg, t); };
  if (o.building || !ownsStruct(o, p) || STRUCTS[o.type].fixed) { deny(); return false; }
  const g = repairCost(o);
  if (g <= 0) { deny(); return 'max'; }
  if (!canAfford({ gold: g }, p)) { deny('NOT ENOUGH RESOURCES', 1.6); return 'gold'; }
  pay({ gold: g }, p);
  o.mend = o.maxHp - o.hp;
  sfxAt('hammer', o.tx * TILE + 8, o.ty * TILE + 8);
  return true;
}
// WHAT TAKING A BUILDING DOWN PAYS: half of everything spent across its
// tiers - except a site of your own still going up for the first time, which
// hands its whole price back, so a misplaced piece costs nothing but the
// walk. A wreck (an enemy's blow) is always the half.
function structRefund(o, own) {
  const g = cumulativeCost(o.type, o.tier, o.paid).gold || 0;
  return own && o.building && o.tier === 0 ? g : Math.floor(g / 2);
}

function demolishStruct(o, p) {
  // a `fixed` building (the barracks) is the eagle's, not the wallet's: nobody pulls it down for the refund
  if (!ownsStruct(o, p || player) || STRUCTS[o.type].fixed) { sfxFor(p || player, 'deny'); return false; }
  destroyStructure(o, 'own', p || player); // 'own': a site still going up comes back whole (structRefund)
  return true;
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
  // reads as a currency floater; must match CARD_PALS in js/sprites/items.js
  cardWhite: '#d9dfe8', cardGreen: '#5fd18a', cardBlue: '#4a90e2', cardPurple: '#a259e6', cardGold: '#e8a33d',
  // the three ores (js/mining.js), their rocks' own inks
  ironstone: '#c4cad8', frostglass: '#8fd4f4', sunstone: '#f4bc44',
};
// audio/screen gating: is this happening near the local listener?
function nearPlayer(x, y, r) { return !!player && Math.hypot(player.x - x, player.y - y) < (r || 180); }

// ---- turret gunnery ------------------------------------------------------
// A turret is a SLINGSHOT: a timber fork on a turntable that lobs a rock. The
// BASE is baked per tier (js/sprites/buildings.js); the fork is NOT baked at
// all - drawTurretHead rasterises it at the live bearing (js/draw/structs.js),
// because a baked grid would lock it to one angle.
//
// And that bearing is the LAUNCH bearing, never the bearing to the mark. A
// sling LOBS: the rock leaves with a lift on it and sags onto the target, so
// the arms stand ABOVE what they are throwing at and the throw leaves exactly
// along them. turretLaunch is the one solve behind both - the tick swings the
// fork onto the bearing it returns and fireRock throws along the velocity it
// returns - so what a raider sees the arms pointing at is where the rock goes.
const TUR_PIVOT_Y = -4;   // px: the fork's pivot, relative to the anchor tile's top edge
// px from pivot to the fork's mouth, where the rock leaves - ONE PER TIER, and
// the draw reads this same row for how long to make the arms (slingState,
// js/draw/structs.js), so the stone can never leave anywhere but the fork
const TUR_MOUTH = [12, 13, 15];
const TUR_LOCK = 0.14;    // rad: inside this of the launch bearing, the draw starts
const TUR_SNAP = 0.14;    // s the pouch takes to snap forward again after a release
const ROCK_SPD = 190;     // px/s the rock covers the ground at, whatever the range
const ROCK_FALL = 240;    // px/s^2 it sags by in flight - the whole of the arc
const ROCK_MISS = [14, 26]; // px a MISSED throw lands off the mark, at a random bearing
const ROCK_SPLASH = 7;    // px round where a rock lands that takes the thump

// The fork pivots above the tile, so every bearing, range and sight line is
// measured from there rather than from the footprint's centre.
function turretPivot(o) { return { x: (o.tx + 0.5) * TILE, y: o.ty * TILE + TUR_PIVOT_Y }; }
// where the rock leaves: the fork's mouth, on the launch bearing
function turretMouth(o) {
  const pv = turretPivot(o), c = Math.cos(o.ang || 0), sn = Math.sin(o.ang || 0);
  const r = TUR_MOUTH[Math.min(TUR_MOUTH.length - 1, o.tier || 0)];
  return { x: pv.x + c * r, y: pv.y + sn * r, nx: c, ny: sn };
}
// THE THROW, solved once and read by everything: the velocity that carries a
// rock from `pv` onto (ax, ay) at ROCK_SPD over the ground while ROCK_FALL
// pulls it down, the seconds that takes, and the bearing it leaves on. The
// flight is an exact parabola (no drag, one constant sag - the `sling` path,
// steerBit in js/tools.js), so `T` IS the rock's life: a throw that runs out
// of life is a throw that has ARRIVED, which is what rockLands reads.
function turretLaunch(pv, ax, ay) {
  const dx = ax - pv.x, dy = ay - pv.y;
  const T = Math.max(0.12, Math.hypot(dx, dy) / ROCK_SPD);
  const vx = dx / T, vy = dy / T - ROCK_FALL * T / 2;
  return { vx: vx, vy: vy, T: T, ang: Math.atan2(vy, vx), ax: ax, ay: ay };
}

// WHAT A TURRET THROWS AT, in this order: a rival PLAYER, then a rival worker
// or soldier bot, then a HOSTILE CREATURE that is hunting somebody (a camp
// monster with a quarry - it belongs to no side, so it is every turret's
// problem), and last a rival BUILDING, which is not going anywhere and is
// never worth turning off a body for. Inside a rank the nearest wins.
const TUR_RANK = { player: 0, robot: 1, beast: 2, struct: 3 };
// The aim point on a mark - low on a body, a building's centre - and null the
// instant it stops being one. turretMark and turretHolds both ask THIS, so a
// mark is acquired and held on one rule: unitAlive (js/actions.js) gates every
// body, so a merchant is never a mark and nor is a player still on the eagle;
// structFoe gates every building; and a beast is a mark only while it is
// actually hunting, so the meadow is never shot at.
function turretAim(o, tg, k) {
  if (!tg) return null;
  const team = o.team === undefined ? 0 : o.team;
  if (k === 'struct') {
    if (!structFoe({ team: team, id: -1 }, tg) || objAt(tg.tx, tg.ty) !== tg) return null;
    return structCenter(tg);
  }
  if (!unitAlive(tg)) return null;
  // A LOB COMES DOWN ON A BODY, so every kind is aimed low on it rather than at
  // a chest: it is the point rockLands measures its thump from (unitsHit takes
  // a body at its feet), and a throw aimed a head higher would land clean over
  // everyone. A beast up on its own altitude is aimed where it is drawn.
  if (k === 'beast') return isCampKind(tg.kind) && tg.target ? { x: tg.x, y: tg.y - (tg.alt || 0) - 4 } : null;
  if (tg.team === team) return null;
  return { x: tg.x, y: tg.y - 4 };
}
// GHOSTSTEP - and a body buried in the snow - shrink the ring a PLAYER is
// acquired and held inside; nothing else hides from a sling.
function turretReach(tg, k, range) { return k === 'player' ? seenAt(tg, range) : range; }
function turretHolds(o, tg, k, range, pv) {
  const at = turretAim(o, tg, k);
  return !!at && Math.hypot(at.x - pv.x, at.y - pv.y) <= turretReach(tg, k, range);
}
// the best mark in range as `{ tg, k }`, or null: the lowest TUR_RANK first
// and the nearest of that rank
function turretMark(o, range, pv) {
  let best = null, bk = null, br = 9, bd = 0;
  const test = (tg, k) => {
    const r = TUR_RANK[k];
    if (r > br) return;
    const at = turretAim(o, tg, k);
    if (!at) return;
    const d = Math.hypot(at.x - pv.x, at.y - pv.y);
    if (d > turretReach(tg, k, range)) return;
    if (r < br || d < bd) { br = r; bd = d; best = tg; bk = k; }
  };
  for (const p of players) test(p, 'player');
  for (const b of robots) test(b, 'robot');
  for (const a of animals) test(a, 'beast');
  for (const s of structures) test(s, 'struct');
  return best ? { tg: best, k: bk } : null;
}
// THE MISS, rolled the moment the draw begins rather than at the release, and
// carried as px off the mark (o.off): the fork then aims at the wrong place for
// the whole of the draw and the aim arc draws it, so a throw that is going to
// miss SAYS SO before it goes - which is what an accuracy number is worth to
// the player standing in front of it.
function turretRoll(o, t) {
  if (rng() < (t.acc === undefined ? 1 : t.acc)) { o.off = { x: 0, y: 0 }; return; }
  const a = rng() * Math.PI * 2, d = rand(ROCK_MISS[0], ROCK_MISS[1]);
  o.off = { x: Math.cos(a) * d, y: Math.sin(a) * d };
}
// where this turret is throwing right now: the mark's aim point plus the miss
// it has already rolled. Null with no mark. The draw asks it too (drawTurretFx).
function turretGoal(o) {
  const at = turretAim(o, o.tgt, o.tgtK);
  if (!at) return null;
  const f = o.off || { x: 0, y: 0 };
  return { x: at.x + f.x, y: at.y + f.y };
}

// The rock leaves the pouch and rides the normal arrow pipeline, so it hits
// players, bots and beasts, respects friendly fire and credits the owner - but
// it passes the WORLD (`solid: false`, the wisp's own flag: the arrow loop's
// solid-tile branch and its building sweep both skip it), so it clears the wall
// in front of the fork, the pines and the turret's own base. That is the whole
// reason a rock LANDS rather than ending on a wall: rockLands, below, is where
// a throw reaches a building, and it is the only door it has to one.
// The arms snap to the exact launch bearing as it goes, so the rock leaves
// along the fork and not a fourteenth of a radian off it.
function fireRock(o, t, pv) {
  const goal = turretGoal(o);
  if (!goal) return;
  const la = turretLaunch(pv, goal.x, goal.y);
  o.ang = la.ang;
  const m = turretMouth(o), team = o.team === undefined ? 0 : o.team;
  arrows.push({
    kind: 'rock', path: 'sling', x: m.x, y: m.y, solid: false,
    vx: la.vx, vy: la.vy, fall: ROCK_FALL,
    t: 0, life: la.T, dmg: t.dmg, pow: 1, kb: 1, spin: rng() * Math.PI * 2,
    land: { x: la.ax, y: la.ay },
    owner: o.owner === undefined ? 0 : o.owner, team: team, trailD: 0,
  });
  burst(m.x, m.y, '#cfd8e8', 3, 50, 0.2, true);
  sfxAt('turretFire', pv.x, pv.y);
}
// WHERE A ROCK COMES DOWN. A throw that ran its whole life ARRIVED - the life
// is the time of flight turretLaunch solved for - so it is put exactly on the
// point it was thrown at and the ground round it takes the thump: every rival
// building through hurtStruct and every body through hurtUnit, both by way of
// the shared area lists, so a rock can never quietly skip a side of the world.
// The splash is a few px wide: this is a rock landing, not a blast.
// A rock that STRUCK something on the way in spent itself there and only puffs,
// because the body it hit has already taken the damage.
function rockLands(a) {
  // one that STRUCK bursts where it struck - the arrow loop has already put it
  // on the contact - and takes nothing else: the body it hit took the damage
  if (a.struck) { burst(a.x, a.y, '#a8b0c4', 3, 45, 0.35, true); return; }
  if (a.land) { a.x = a.land.x; a.y = a.land.y; }
  burst(a.x, a.y, '#a8b0c4', 6, 45, 0.35, true);
  burst(a.x, a.y, '#eef4fb', 4, 40, 0.4, true);
  sfxAt('rockLand', a.x, a.y);
  const src = sideOf(a), vd = Math.hypot(a.vx, a.vy) || 1;
  for (const s of structsNear(src, a.x, a.y, ROCK_SPLASH)) hurtStruct(s, a.dmg, players[a.owner]);
  // no `kb`: the thump names no shove of its own, so each kind takes the one
  // it always takes (hurtUnit, js/actions.js) scaled by the rock's own kbMul
  for (const t of unitsHit(src, a.x, a.y, ROCK_SPLASH)) {
    hurtUnit(t, a.dmg, a.vx / vd, a.vy / vd, players[a.owner], { kbMul: a.kb });
  }
}
// how many of a site's side stand within BUILD_REACH of it, alive and on
// the ground - each one speeds it (CREW_BOOST)
function buildCrew(o) {
  const c = structCenter(o);
  let n = 0;
  for (const q of players) {
    if (!q.active || q.dead || inAir(q) || q.team !== o.team) continue;
    if (Math.hypot(q.x - c.x, q.y - c.y) <= BUILD_REACH) n++;
  }
  return n;
}

function updateStructures(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].t -= dt;
    if (tracers[i].t <= 0) tracers.splice(i, 1);
  }
  for (const o of structures) {
    const ox = o.tx * TILE + 8, oy = o.ty * TILE + 8;
    if (o.mend > 0 && !o.building) {
      // a repair paid for: whole again at REPAIR_RATE, a puff every so often
      const h = Math.min(o.mend, o.maxHp * REPAIR_RATE * dt, o.maxHp - o.hp);
      o.hp += h; o.mend = o.hp >= o.maxHp ? 0 : o.mend - h;
      o.dustT -= dt;
      if (o.dustT <= 0) { o.dustT = 0.5; burst(ox, oy, '#eef4fb', 2, 25, 0.3, true); }
    }
    if (o.building) {
      // AoE-style: every one of its side standing in reach speeds the site
      const crew = Math.min(CREW_MAX, buildCrew(o)), k = 1 + CREW_BOOST * crew;
      o.buildT += dt * k;
      // SC2-style: hp grows from the 30% floor toward max as the site rises
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.7 * dt * k / o.buildTotal);
      o.dustT -= dt * k;
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
        sfxAt('hammer', ox, oy); shakeAt(ox, oy, big ? 2.5 : 1.5);
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
      o.rec = Math.max(0, o.rec - dt / TUR_SNAP);  // the pouch snapping forward again
      const pv = turretPivot(o);
      // A HELD MARK IS KEPT while it holds - a sling that jumped to whichever
      // body was a pixel nearer would swing forever and never finish a draw -
      // but a BETTER-RANKED one takes it the moment it arrives: a wall is
      // never worth throwing at while a raider is standing there.
      const m = turretMark(o, t.range, pv);
      const held = o.tgt && turretHolds(o, o.tgt, o.tgtK, t.range, pv);
      if (!held || (m && TUR_RANK[m.k] < TUR_RANK[o.tgtK])) {
        o.tgt = m && m.tg; o.tgtK = m && m.k;
        turretRoll(o, t); // a fresh mark is a fresh roll of the accuracy
      }
      let want, rate = t.traverse;
      const goal = turretGoal(o);
      if (goal) {
        // the LAUNCH bearing, never the bearing to the mark: the fork stands
        // ABOVE what it is throwing at, because the rock sags onto it
        want = turretLaunch(pv, goal.x, goal.y).ang;
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
      if (goal && Math.abs(da) < TUR_LOCK) {
        o.chg = Math.min(1, o.chg + dt / t.aim);
        if (o.chg >= 1 && o.cd <= 0) {
          fireRock(o, t, pv);
          o.cd = t.rate; o.chg = 0; o.rec = 1;
          turretRoll(o, t); // ...and the next throw rolls a miss of its own
        }
      } else {
        o.chg = Math.max(0, o.chg - dt * 2.5); // lost the bearing: ease the draw back down
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
          // a machine waking up, for anyone standing in the yard: the bay
          // shutter, the exhaust and a new chassis had been entirely silent,
          // which is odd for the one building that manufactures things
          sfxAt('botOut', b.x, b.y);
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
        let alive = 0; // the cap is the SIDE's: every bay of the team queued or out, so more bays refill a column faster but never fill the map
        for (const q of structures) if (q.type === 'barracks' && q.team === o.team) alive += q.queue;
        for (const b of robots) if (b.kind === 'soldier' && b.team === o.team && !b.dead) alive++;
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
            if (o.fish <= 0 || bagAdd(p, 'fish', 1) < 1) return;
            o.fish--;
            o.takeT = NET_TAKE_T;
            if (p.catchT <= 0) startCatch(p); // the first fish off the rope is hoisted; the rest come up under it
            addFloater(p.x, p.y - 14, '+1', RES_COLORS.fish);
            sfxFor(p, 'stash');
          });
        }
      }
    }
  }
}
