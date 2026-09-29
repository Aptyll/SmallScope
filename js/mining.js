'use strict';
// ------ rocks and ore
// A rock mines ITSELF: stand within MINE_R of it and the pick bites every
// MINE_STRIKE while the rock cracks in three stages and a bar fills over it.
// No key is held and nothing the hands do stops it - walk, shoot, roll, eat,
// cast, the bar keeps filling. Only a rival's blow knocks the pick off: the
// bar stops for MINE_HIT_HOLD and, like a rock nobody is at, slowly closes
// back up (MINE_DECAY) rather than dropping to nothing, so the next pick -
// yours, or whoever steps up while you are busy - starts from what is left.
// What a rock pays when the bar fills is its kind's row below: gold on the
// spot, ORE that bursts out of it onto the snow for the pickup to take into
// the bag, and a roll at a find (dropLoot, js/tools.js). A mined rock stays
// where it stood as rubble - it is still solid - and grows back after its
// kind's `regrow`.
//
// The three kinds are placed by placeRocks (js/world.js): STONE along the
// whole rim, FROSTGLASS on the stretches of it furthest from both roosts,
// and one SUNSTONE by each of the two corners neither side owns.
//
//   mine    - seconds of pick from nothing to broken
//   gold    - paid on the spot (awardGold, so it is XP too), before harvestMul
//   ore     - how many of `item` burst out, [min, max]
//   loot    - the chance of a find, at `lootTier` or below
//   regrow  - seconds the rubble stands before the rock is back
//   glint   - seconds between glints on its crystal (0: plain stone never glints)
//   chip    - the colour of what flies off it
//   lift    - px above the anchor's tile the rock's top stands (the prompt and the floaters)
const ROCK_KINDS = [
  { key: 'common',    name: 'STONE',            item: 'ironstone',  mine: 2, gold: 3,  ore: [3, 5], loot: 0.2, lootTier: 0,
    regrow: 120, glint: 0,   chip: '#a8b0c4', lift: 12 },
  { key: 'rare',      name: 'FROSTGLASS SPIRE', item: 'frostglass', mine: 3, gold: 8,  ore: [1, 2], loot: 0.5, lootTier: 1,
    regrow: 180, glint: 2.4, chip: '#8fd4f4', lift: 20 },
  { key: 'legendary', name: 'SUNSTONE',         item: 'sunstone',   mine: 4, gold: 20, ore: [1, 1], loot: 1,   lootTier: 2,
    regrow: 300, glint: 1.2, chip: '#f4bc44', lift: 24 },
];
const MINE_STRIKE = 0.5;   // s between the pick's bites while it works
const MINE_R = 40;         // px from the rock's middle (rockCx/rockCy) the pick works inside
const MINE_DECAY = 0.35;   // s of pick the cracks close per s while nobody works the rock
const MINE_HIT_HOLD = 1.5; // s a rival's blow keeps the pick off every rock
const MINE_MOVE = 0.25;    // a walk input past this is walking: the pick bites without the swing drawn
const ORE_STACK = 99;      // one bag cell holds this many of one ore
const ORE_FLING = 45;      // px/s the ore leaves the rock at, toward whoever mined it

// The ores are carried items: one ITEMS row each, in the BAG (a cell each,
// stacked to ORE_STACK), so the pickup, the drag, the throw and the counter's
// sell strip take them with no code of their own. `price` is what one is
// worth at the counter (itemValue, js/ui/shop.js - it sells for half);
// `ore` is the ROCK_KINDS index it comes out of.
const ORE_ICONS = {
  ironstone: [
    '........',
    '..oooo..',
    '.oYLyyo.',
    'oYLyyvvo',
    'oYyyqyvo',
    'oyyvvvVo',
    '.oVVVVo.',
    '..oooo..',
  ],
  frostglass: [
    '....k...',
    '...kJk..',
    '..kIik..',
    '..kIijk.',
    '.kIIijk.',
    '.kIiijk.',
    '..kijk..',
    '...kk...',
  ],
  sunstone: [
    '..mmmm..',
    '.mNAAam.',
    'mNAAaanm',
    'mAAaannm',
    'maaannnm',
    '.mannnm.',
    '..mnnm..',
    '...mm...',
  ],
};
const ORE_PAL = {
  '.': null, o: '#3a3f52', V: '#4e5266', v: '#666d84', y: '#8b93a8', Y: '#a8b0c4', L: '#c4cad8', q: '#dfe4ee',
  k: '#1f3d6e', j: '#2f64a8', i: '#4f98d8', I: '#8fd4f4', J: '#e6fbff',
  m: '#5c2c0c', n: '#9a4e16', a: '#d8862a', A: '#f4bc44', N: '#fff1b0',
};
const ORE_PRICE = { ironstone: 2, frostglass: 12, sunstone: 40 };
ROCK_KINDS.forEach((K, k) => {
  const icon = 'itemOre_' + K.item;
  SPRITES[icon] = bakeGrid(ORE_ICONS[K.item], ORE_PAL, 8);
  ITEMS[K.item] = { icon, stack: ORE_STACK, ore: k, price: ORE_PRICE[K.item],
    name: K.item.toUpperCase() };
});
function isOre(type) { return !!(ITEMS[type] && ITEMS[type].ore !== undefined); }

// a rock that is standing (not rubble): the one thing the channel will start on
function rockReady(o) { return !(o.regrow > 0); }
// the middle of a rock's two-tile footprint, where its puffs and floaters go
// and what MINE_R is measured from
function rockCx(o) { return (o.tx + (OBJECTS.rock.w || 1) / 2) * TILE; }
function rockCy(o) { return o.ty * TILE + 8; }
function mineReach(p, o) { return Math.hypot(p.x - rockCx(o), p.y - rockCy(o)) <= MINE_R; }
// who is at the rock right now, if anyone is - a miner who left the match or
// let go without it being written back holds nothing
function rockMiner(o) {
  if (o.miner === undefined || o.miner < 0) return null;
  const q = players.find((pl) => pl.id === o.miner);
  return q && q.active && !q.dead && q.mineO === o ? q : null;
}
// the nearest standing rock nobody else is at, within r (MINE_R) of the body
function mineFree(p, r = MINE_R) {
  const R = Math.ceil(r / TILE) + 1, ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  let best = null, bd = r;
  for (let ty = pty - R; ty <= pty + R; ty++) for (let tx = ptx - R; tx <= ptx + R; tx++) {
    if (!inWorld(tx, ty)) continue;
    const o = objects[idx(tx, ty)];
    if (!o || o.type !== 'rock' || o.tx !== tx || o.ty !== ty || !rockReady(o) || rockMiner(o)) continue;
    const d = Math.hypot(p.x - rockCx(o), p.y - rockCy(o));
    if (d <= bd) { best = o; bd = d; }
  }
  return best;
}
// can the pick work at all this step: a body in the air, in the water, on
// the zipline's handle or on a sled has no feet by a rock, and a stun holds
// the bar still (it neither fills nor closes: the rock is still yours)
function mineIdle(p) {
  return p.dead || p.mineHoldT > 0 || p.fallT > 0 || p.stunT > 0 || inAir(p) || p.zip >= 0 || p.sled;
}

// The pick, every step for every player (updatePlayer, beside the meal).
// One miner per rock: a body in reach of a free one takes it, and two
// reaching it in the same step are contested (contest, js/player.js) so
// exactly one of them has it. Stepping out of MINE_R lets go.
function updateMine(p, dt) {
  if (p.mineHoldT > 0) p.mineHoldT -= dt;
  let o = p.mineO;
  if (o && (p.dead || p.fallT > 0 || inAir(p) || p.zip >= 0 || p.sled || objects[idx(o.tx, o.ty)] !== o ||
    !rockReady(o) || !mineReach(p, o))) { breakMine(p); o = null; }
  if (mineIdle(p)) return;
  if (!o) {
    const f = mineFree(p);
    if (f) contest('mine:' + idx(f.tx, f.ty), p, () => {
      if (p.mineO || !rockReady(f) || rockMiner(f) || objects[idx(f.tx, f.ty)] !== f) return;
      p.mineO = f; p.mineStrikeT = MINE_STRIKE; // the first bite lands a beat after arriving
      f.miner = p.id; f.crack = f.crack || 0;   // ...on whatever the last pick left
    });
    return;
  }
  const K = ROCK_KINDS[o.kind];
  o.crack = Math.min(1, (o.crack || 0) + dt / K.mine);
  p.mineStrikeT -= dt;
  if (p.mineStrikeT <= 0) mineStrike(p, o, K);
  if (o.crack >= 1) finishMine(p, o, K);
}
// one bite of the pick: the rock shivering, chips off its face, and - only
// on a body standing with its hands free - the E swing drawn at it (swingHitDone,
// so it lands on nothing, and no swingCd: E and the bow stay yours)
function mineStrike(p, o, K) {
  p.mineStrikeT = MINE_STRIKE;
  const cx = rockCx(o), cy = rockCy(o), dx = cx - p.x, dy = cy - p.y;
  if (Math.hypot(p.input.mx, p.input.my) <= MINE_MOVE && !p.charging && !(p.swingT > 0) &&
    !(p.castT > 0) && !(p.eatT > 0) && !(p.dodgeT > 0) && !p.prone) {
    p.swing = SWING_PICK;
    p.swingT = 0.18; p.swingHitDone = true;
    p.swingDir = Math.atan2(dy, dx);
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
    else p.dir = dy > 0 ? 'down' : 'up';
  }
  o.shake = 0.12;
  sfxAt('mine', cx, cy);
  burst(cx + rand(-8, 8), cy - 4 - rand(0, K.lift), K.chip, 4, 40, 0.35, true);
}
// the bar full: the rock goes to rubble and pays out
function finishMine(p, o, K) {
  const cx = rockCx(o), cy = rockCy(o);
  p.mineO = null;
  o.miner = -1; o.crack = 0; o.regrow = K.regrow;
  o.flash = 0.15; o.shake = 0.3;
  sfxAt('break_', cx, cy);
  shakeFor(p, 2 + o.kind);
  burst(cx, cy - 6, K.chip, 12 + o.kind * 6, 60, 0.7, true);
  burst(cx, cy - 6, '#eef4fb', 8, 45, 0.5, true);
  awardGold(p, Math.round(K.gold * kitOf(p).harvestMul), cx, cy - K.lift - 6);
  // the ore bursts out onto the snow one piece at a time, thrown the miner's
  // way so it lands on their side of the rock for the pickup
  const n = K.ore[0] + Math.floor(rng() * (K.ore[1] - K.ore[0] + 1));
  const d = Math.hypot(p.x - cx, p.y - cy) || 1;
  for (let i = 0; i < n; i++) flingDrop(spawnDrop(cx + rand(-6, 6), cy + 2, K.item, 1), (p.x - cx) / d * ORE_FLING, (p.y - cy) / d * ORE_FLING);
  dropLoot(cx, cy - 4, K.lootTier, K.loot);
}
// Letting go of the rock: out of reach, off your feet, dead. The progress
// stays on the rock and closes slowly (tickRock) until a pick is back at it.
function breakMine(p) {
  const o = p.mineO;
  if (!o) return;
  p.mineO = null;
  if (o.miner === p.id) o.miner = -1;
  burst(rockCx(o), rockCy(o) - 4, '#eef4fb', 4, 30, 0.35, true);
}
// A rival's blow (damagePlayer, js/player.js): the pick comes off the rock
// and stays off for MINE_HIT_HOLD
function mineHit(p) {
  breakMine(p);
  p.mineHoldT = MINE_HIT_HOLD;
}

// the object timers (js/sim.js): the cracks closing on a rock nobody is at,
// and the rubble growing back
function tickRock(o, dt) {
  if (o.crack > 0 && !rockMiner(o)) o.crack = Math.max(0, o.crack - MINE_DECAY * dt / ROCK_KINDS[o.kind].mine);
  if (!(o.regrow > 0)) return;
  o.regrow -= dt;
  if (o.regrow > 0) return;
  o.regrow = 0;
  burst(rockCx(o), rockCy(o) - 6, '#eef4fb', 6, 35, 0.5, true);
}

// ------ the forge
// What the ore is FOR: the merchant's second tab (js/ui/forge.js) is a DUMP.
// Any ore, any amount, in any order, goes into a weapon and is counted as
// forge points (FORGE_PTS: the rarer the rock, the more a piece is worth);
// the points fill the weapon's bar, and every time it fills the weapon is a
// level up and the next bar is a little longer (forgeNeed). There is no top
// level and no recipe - a weapon is exactly as forged as the ore you have
// thrown at it - and what a level ADDS tapers instead (forgeSum), so a pile
// of five hundred stones makes a weapon strong and never absurd.
//
// The points live on the tool's own cell (`fp`, beside its `bits`), so they
// go wherever the tool goes - the shelf, the bag, the snow, the wire, a save -
// and a rebuilt tool would lose them, which is one more reason a tool is never
// rebuilt from its type. The level is always read off them (toolLvl).
//
// Every level adds damage (into the press's envelope before any fitting,
// toolPlan, js/tools.js) and some of the stat the body's TOOLS row names as
// its `up`: 'rof' draws the bow quicker, 'tensile' lets one press spend more
// weight.
const FORGE_PTS = { ironstone: 1, frostglass: 4, sunstone: 15 }; // what one piece of each ore is worth
const FORGE_NEED = 5;       // points from +0 to +1...
const FORGE_NEED_UP = 3;    // ...and each bar after is this much longer (+1 to +2 is 8, then 11, 14...)
const FORGE_TAPER = 0.9;    // each level adds this share of what the one before it added
const FORGE_DMG = 0.06;     // damage the FIRST level adds, as a share of the body's own (tops out at x1.6)
const FORGE_ROF = 0.04;     // share of the cycle the first level takes off an 'rof' body (tops out at 40%)
const FORGE_TENSILE = 1;    // weight the first level adds to a 'tensile' body's budget (tops out at +10)
const FORGE_GOLD = 2;       // gold a forge point is worth at the counter (cellValue, js/ui/shop.js)

// the points a bar of level `l` holds, and the total from +0 to +l
function forgeNeed(l) { return FORGE_NEED + FORGE_NEED_UP * l; }
function forgeCum(l) { return FORGE_NEED * l + FORGE_NEED_UP * l * (l - 1) / 2; }
// the points on a cell (a weapon from the fixed-recipe forge carries only a
// `lvl`, and is worth the points that level costs now)
function toolFp(cell) { return !cell ? 0 : cell.fp !== undefined ? cell.fp : cell.lvl ? forgeCum(cell.lvl) : 0; }
function forgeLvlOf(fp) { let l = 0; while (forgeCum(l + 1) <= fp) l++; return l; }
function toolLvl(cell) { return forgeLvlOf(toolFp(cell)); }
// how full the bar toward the next level is, 0..1
function forgeBar(fp) { const l = forgeLvlOf(fp); return (fp - forgeCum(l)) / forgeNeed(l); }
// what `l` levels add, in units of what the first one adds: 1 + 0.9 + 0.81...
function forgeSum(l) { return (1 - Math.pow(FORGE_TAPER, l)) / (1 - FORGE_TAPER); }
function toolUp(cell) { return TOOLS[toolIdOf(cell.type)].up; }
// the three stats at a level, so the bench can preview a level the cell is not at yet
function forgeDmgAt(l) { return 1 + FORGE_DMG * forgeSum(l); }
function forgeRofAt(cell, l) { return toolUp(cell) === 'rof' ? 1 - FORGE_ROF * forgeSum(l) : 1; }
function forgeTensileAt(cell, l) {
  return TOOLS[toolIdOf(cell.type)].tensile + (toolUp(cell) === 'tensile' ? Math.round(FORGE_TENSILE * forgeSum(l)) : 0);
}
function toolDmgMul(cell) { return forgeDmgAt(toolLvl(cell)); }
function toolRofMul(cell) { return forgeRofAt(cell, toolLvl(cell)); }
function toolTensile(cell) { return forgeTensileAt(cell, toolLvl(cell)); }
// the points a pile is worth: { ironstone: n, frostglass: n, sunstone: n }
function pilePts(pile) { let v = 0; for (const k in FORGE_PTS) v += FORGE_PTS[k] * ((pile && pile[k]) || 0); return v; }
// a forged weapon sells for its points too (cellValue, js/ui/shop.js)
function forgeWorth(cell) { return toolFp(cell) * FORGE_GOLD; }
// the tool cell an order names: 'tool' is the weapon shelf, 'bag' the pack
function forgeCell(p, where, i) {
  const c = where === 'tool' ? p.tools && p.tools[i] : where === 'bag' ? p.bag[i] : null;
  return c && toolIdOf(c.type) ? c : null;
}
// can p dump this pile into this cell here and now - the one test the
// bench's forge plate and the order itself both ask. A pile is whole numbers
// of ore p is carrying, and at least one piece.
function forgeReady(p, cell, pile) {
  if (!cell || !pile || !merchNear(p)) return false;
  let n = 0;
  for (const k in FORGE_PTS) {
    const c = pile[k] || 0;
    if (c < 0 || c !== Math.floor(c) || c > bagCount(p, k)) return false;
    n += c;
  }
  return n > 0;
}
// The order (shopCmd, js/ui/shop.js, act 'forge'). Nothing is contested: the
// weapon and the ore are both the player's own, so there is no one to race.
function forgeTool(p, where, i, pile) {
  const cell = forgeCell(p, where, i);
  if (!forgeReady(p, cell, pile)) { shopDeny(p); return false; }
  const was = toolLvl(cell);
  let best = null;
  for (const k in FORGE_PTS) {
    if (!pile[k]) continue;
    bagTake(p, k, pile[k]);
    best = k;                          // the rarest ore in the pile colours the sparks
  }
  cell.fp = toolFp(cell) + pilePts(pile);
  delete cell.lvl;                     // the points are the record now
  const lv = toolLvl(cell), col = ROCK_KINDS[ITEMS[best].ore].chip;
  burst(p.x, p.y - 8, col, 10, 50, 0.5);
  if (lv > was) {
    sfxFor(p, 'levelUp');
    addFloater(p.x, p.y - 20, '+' + lv, col);
  } else sfxFor(p, 'place');
  return true;
}
