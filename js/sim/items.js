'use strict';
// ------------------------------------------------------------ items
// THE BUILD, League's way: six item slots a player fills at either merchant's
// counter (js/ui/shop.js). Every item is always on sale - nothing rotates,
// nothing sells out, so a player can save up for the one they want.
//
// League's four tiers share one table (the CATALOGUE below). A BASIC item is
// cheap and carries one stat; an EPIC is built FROM basics, a LEGENDARY from
// epics and basics and adds a PASSIVE; BOOTS upgrade from one pair. An item
// costs its own price minus every component of it already in your slots,
// which the buy uses up (itemCost, buyItem). So a part bought early is never
// wasted gold, and saving toward a legendary can start one part at a time.
//
// What an item does is all in this file: its stats and its passive both write
// into the kit through refreshKit (js/sim/player.js), so every kit-reading site (damage, movement, dodge,
// stealth, the bots) picks an item up without knowing items exist. The
// passives that are not a kit number hang off the shared functions every blow
// and every body goes through: hurtUnit (itemsDeal, itemsOnHit, itemsOnHurt),
// a key landing (itemsOnCast), the player's clock (itemsTick), statOf
// (itemStat) and ccMul (itemTen).
//
// A passive counts ONCE however many items carry it (League's unique
// passives): two Wolf Fangs add their stats twice and FEAST once.
//
// Items are ids in `p.items`, never instances: an item has no state of its
// own, so a slot is just the name of what is in it.
const ITEM_SLOTS = 6;
const ITEM_SELL = 0.5;      // share of its price an item fetches back, like every other made good
const ITEM_FIGHT_T = 5;     // s after a hit given or taken before DEN's heal starts
const KINDLE_EVERY = 3;     // KINDLING: every this-many-th hit lights the target...
const KINDLE_BURN = 2;      // ...for this many seconds at the ordinary burn
const CHILL_T = 1, CHILL_MUL = 0.7; // CHILL: a hit slows the target this long, to this share of its speed
const LEECH_SHARE = 0.1;    // LEECH: a blow heals its striker this share of itself
const THORN_SHARE = 0.2;    // THORNS: a blow taken hands this share back to whoever struck it
const CULL_BELOW = 0.35, CULL_MUL = 1.2; // CULL: a blow on a body under this share of its health lands this much harder
const STEADY_MUL = 0.7;     // STEADY: every stun, root and slow lasts this share of its length (ccMul, js/sim/actions.js)
const SURGE_T = 4, SURGE_MUL = 1.5; // SURGE: for this long after a key, the next basic attack lands this much harder
const BRACE_BELOW = 0.4, BRACE_ARMOR = 15; // BRACE: under this share of health, this much more armor (itemStat)
const SMOLDER_R = 30, SMOLDER_EVERY = 1, SMOLDER_BURN = 1.2; // SMOLDER: rivals this close catch a short burn, once a second
const SCORCH_BURN = 2;      // SCORCH: an ability's blow burns this long
const AMPLIFY_MUL = 1.25;   // AMPLIFY: the ability power from items, times this

// What each stat line IS: the label the shop prints, the short one a narrow
// column prints, how its number reads, and what it writes into the kit. Every
// line is one of the seven hero stats (js/sim/stats.js) and adds to the kit's
// stat bag, `kit.add`, so statOf reads an item without knowing items exist.
// ARMOR is League's (each point a share off every hit), ATTACK SPEED a share
// added to the hero's attack speed, the rest flat.
const statAdd = (key) => (k, v) => { k.add[key] += v; };
const ITEM_STATS = {
  dmg:   { label: 'DAMAGE', short: 'DMG', fmt: (v) => '+' + v, mod: statAdd('dmg') },
  as:    { label: 'ATTACK SPEED', short: 'AS', fmt: (v) => '+' + Math.round(v * 100) + '%', mod: statAdd('as') },
  hp:    { label: 'HEALTH', short: 'HP', fmt: (v) => '+' + v, mod: statAdd('hp') },
  armor: { label: 'ARMOR', short: 'ARM', fmt: (v) => '+' + v, mod: statAdd('armor') },
  ap:    { label: 'ABILITY POWER', short: 'AP', fmt: (v) => '+' + v, mod: statAdd('ap') },
  haste: { label: 'COOLDOWN SPEED', short: 'CS', fmt: (v) => '+' + v, mod: statAdd('haste') },
  ms:    { label: 'MOVE SPEED', short: 'MS', fmt: (v) => '+' + v, mod: statAdd('ms') },
};
const ITEM_STAT_ORDER = ['dmg', 'as', 'hp', 'armor', 'ap', 'haste', 'ms']; // the shop's stat filters, in this order

// The passives, each a name, one short line and what it writes into the kit.
// The kit numbers (feast, glide, drift, light, ambush, amplify) are read where
// the sim already reads them; the flags are read by the hooks below:
// itemsDeal and itemsOnHit (every blow a player lands, hurtUnit), itemsOnHurt
// (every blow a player takes), itemsTick (the player's clock), itemStat (the
// stat sheet) and itemTen (crowd control's length).
const ITEM_PASSIVES = {
  kindling: { name: 'KINDLING', line: 'EVERY 3RD HIT BURNS', mod: (k) => { k.kindle = true; } },
  den:      { name: 'DEN', line: 'HEALS OUT OF A FIGHT', mod: (k) => { k.restHeal += 3; } },
  feast:    { name: 'FEAST', line: 'A KILL HEALS 20', mod: (k) => { k.killHeal += 20; } },
  chill:    { name: 'CHILL', line: 'HITS SLOW FOR 1 S', mod: (k) => { k.chill = true; } },
  glide:    { name: 'GLIDE', line: 'FASTER ON ICE', mod: (k) => { k.iceMax *= 1.15; k.iceSteer += 0.3; } },
  drift:    { name: 'DRIFT', line: 'SEEN FROM CLOSER', mod: (k) => { k.stealth -= 0.15; } },
  light:    { name: 'LIGHT', line: 'ROLL COMES BACK SOONER', mod: (k) => { k.dodgeCd -= 0.8; } },
  ambush:   { name: 'AMBUSH', line: 'AMBUSH HITS LAND HARDER', mod: (k) => { k.ambushMul += 0.4; } },
  leech:    { name: 'LEECH', line: 'HITS HEAL 10% OF THEMSELVES', mod: (k) => { k.leech = true; } },
  thorns:   { name: 'THORNS', line: 'HITTERS TAKE 20% BACK', mod: (k) => { k.thorns = true; } },
  cull:     { name: 'CULL', line: '+20% ON THE BADLY HURT', mod: (k) => { k.cull = true; } },
  steady:   { name: 'STEADY', line: 'STUNS AND SLOWS 30% SHORTER', mod: (k) => { k.steady = true; } },
  surge:    { name: 'SURGE', line: 'AFTER A KEY, NEXT HIT +50%', mod: (k) => { k.surge = true; } },
  brace:    { name: 'BRACE', line: 'UNDER 40% HEALTH: +15 ARMOR', mod: (k) => { k.brace = true; } },
  smolder:  { name: 'SMOLDER', line: 'BURNS RIVALS CLOSE BY', mod: (k) => { k.smolder = true; } },
  scorch:   { name: 'SCORCH', line: 'ABILITIES BURN', mod: (k) => { k.scorch = true; } },
  amplify:  { name: 'AMPLIFY', line: 'ABILITY POWER +25%', mod: (k) => { k.add.ap *= AMPLIFY_MUL; } },
};

// THE CATALOGUE, League's four tiers. A BASIC item carries one stat and is
// built from nothing. An EPIC is built FROM basics (a part named twice is
// needed twice) and carries a bigger mix. A LEGENDARY is built from epics and
// basics and adds one PASSIVE. BOOTS start as FUR BOOTS and upgrade into one
// of six pairs; a body wears one pair (`boots`). An item costs its price minus
// every component of it already held, however deep (itemCost). `icon` is a
// SPRITES key: SPRITES['item_' + id] (js/sprites/item-icons.js) unless named.
const BUILD_ITEMS = {
  // basic
  flint:  { name: 'FLINT HEAD', price: 400, stats: { dmg: 3 } },
  string: { name: 'GUT STRING', price: 300, stats: { as: 0.12 } },
  hide:   { name: 'WOLF HIDE', price: 400, stats: { hp: 25 } },
  plate:  { name: 'IRON PLATE', price: 300, stats: { armor: 8 } },
  bead:   { name: 'AMBER BEAD', price: 350, stats: { ap: 2 } },
  glass:  { name: 'HOURGLASS', price: 300, stats: { haste: 6 } },
  boots:  { name: 'FUR BOOTS', price: 300, stats: { ms: 5 }, boots: true },
  pick:   { name: 'PICKAXE', price: 850, stats: { dmg: 6 } },
  axe:    { name: 'FELLING AXE', price: 1300, stats: { dmg: 10 } },
  belt:   { name: 'BEAR BELT', price: 900, stats: { hp: 55 } },
  mail:   { name: 'CHAIN SHIRT', price: 800, stats: { armor: 20 } },
  rod:    { name: 'DOWSING ROD', price: 1200, stats: { ap: 7 } },
  // epic
  whet:    { name: 'WHETSTONE', price: 1100, from: ['flint', 'flint'], stats: { dmg: 5, haste: 8 } },
  quiver:  { name: 'QUIVER', price: 1000, from: ['flint', 'string'], stats: { dmg: 4, as: 0.18 } },
  recurve: { name: 'RECURVE LIMB', price: 900, from: ['string', 'string'], stats: { as: 0.35 } },
  sash:    { name: 'WIND SASH', price: 850, from: ['string'], stats: { as: 0.18, ms: 6 } },
  ember:   { name: 'EMBER CORE', price: 850, from: ['hide'], stats: { hp: 30, haste: 8 } },
  knife:   { name: 'BONE KNIFE', price: 1100, from: ['flint', 'hide'], stats: { dmg: 4, hp: 35 } },
  tooth:   { name: 'TOOTHED KNIFE', price: 900, from: ['flint'], stats: { dmg: 4 }, passive: 'leech' },
  bramble: { name: 'BRAMBLE COAT', price: 800, from: ['plate', 'plate'], stats: { armor: 15 }, passive: 'thorns' },
  buckler: { name: 'FROST BUCKLER', price: 800, from: ['plate', 'glass'], stats: { armor: 10, haste: 8 } },
  jacket:  { name: 'PADDED JACKET', price: 800, from: ['hide', 'plate'], stats: { hp: 25, armor: 10 } },
  warm:    { name: 'WARM STONE', price: 900, from: ['hide', 'hide'], stats: { hp: 40 }, passive: 'den' },
  lantern: { name: 'LANTERN', price: 850, from: ['bead'], stats: { ap: 4, ms: 3 } },
  almanac: { name: 'ALMANAC', price: 900, from: ['bead', 'glass'], stats: { ap: 3, haste: 8 } },
  // boots
  hobnail: { name: 'HOBNAIL BOOTS', price: 1000, from: ['boots', 'plate'], stats: { ms: 8, armor: 12 }, boots: true },
  quick:   { name: 'QUICKSTEP BOOTS', price: 1000, from: ['boots', 'string'], stats: { ms: 8, as: 0.22 }, boots: true },
  shoes:   { name: 'SNOWSHOES', price: 900, from: ['boots'], stats: { ms: 8, haste: 10 }, boots: true },
  emberb:  { name: 'EMBER BOOTS', price: 1000, from: ['boots', 'bead'], stats: { ms: 8, ap: 3 }, boots: true },
  mukluk:  { name: 'MUKLUKS', price: 1000, from: ['boots', 'hide'], stats: { ms: 8, hp: 15 }, passive: 'steady', boots: true },
  skates:  { name: 'SKATES', price: 900, from: ['boots'], stats: { ms: 12 }, passive: 'glide', boots: true },
  // legendary
  horn:      { name: "HUNTER'S HORN", price: 2800, from: ['quiver', 'recurve'], stats: { dmg: 9, as: 0.4, ms: 3 }, passive: 'kindling' },
  feathers:  { name: 'FEATHERS', price: 2600, from: ['recurve', 'sash'], stats: { dmg: 5, as: 0.5, ms: 5 }, passive: 'light' },
  frostline: { name: 'FROST LINE', price: 2700, from: ['quiver', 'sash'], stats: { dmg: 8, as: 0.45 }, passive: 'chill' },
  sunstone:  { name: 'SUNSTONE', price: 3000, from: ['axe', 'pick'], stats: { dmg: 18 }, passive: 'ambush' },
  maul:      { name: 'SPLITTING MAUL', price: 3100, from: ['axe', 'whet'], stats: { dmg: 15, haste: 10 }, passive: 'cull' },
  beartooth: { name: 'BEAR TOOTH', price: 3000, from: ['tooth', 'axe'], stats: { dmg: 16, hp: 20 }, passive: 'leech' },
  fang:      { name: 'WOLF FANG', price: 3000, from: ['knife', 'pick'], stats: { dmg: 9, hp: 50, haste: 10 }, passive: 'feast' },
  brand:     { name: 'IRON BRAND', price: 2900, from: ['whet', 'mail'], stats: { dmg: 8, armor: 20, haste: 10 }, passive: 'chill' },
  grind:     { name: 'GRINDSTONE', price: 3000, from: ['whet', 'belt'], stats: { dmg: 8, hp: 50, haste: 15 }, passive: 'surge' },
  collar:    { name: 'IRON COLLAR', price: 3000, from: ['knife', 'mail'], stats: { dmg: 8, hp: 40, armor: 20 }, passive: 'leech' },
  bearskin:  { name: 'BEARSKIN', price: 2800, from: ['warm', 'belt'], stats: { hp: 110, armor: 10 }, passive: 'den' },
  brambmail: { name: 'BRAMBLE MAIL', price: 2700, from: ['bramble', 'jacket'], stats: { hp: 40, armor: 40 }, passive: 'thorns' },
  stonehide: { name: 'STONEHIDE', price: 2800, from: ['mail', 'belt'], stats: { hp: 70, armor: 30 }, passive: 'brace' },
  hearth:    { name: 'HEARTH PLATE', price: 2800, from: ['ember', 'mail'], stats: { hp: 60, armor: 20, haste: 10 }, passive: 'smolder' },
  glacier:   { name: 'GLACIER SHIELD', price: 2700, from: ['buckler', 'jacket'], stats: { hp: 30, armor: 25, haste: 15 }, passive: 'steady' },
  cloak:     { name: 'SNOW CLOAK', price: 2600, from: ['sash', 'belt'], stats: { hp: 70, as: 0.2, ms: 8 }, passive: 'drift' },
  storm:     { name: 'STORM GLASS', price: 3000, from: ['rod', 'almanac'], stats: { ap: 11, haste: 15 }, passive: 'surge' },
  deeprod:   { name: 'DEEP ROD', price: 3400, from: ['rod', 'rod'], stats: { ap: 16 }, passive: 'amplify' },
  marsh:     { name: 'MARSH LIGHT', price: 2800, from: ['lantern', 'almanac'], stats: { ap: 9, haste: 10, ms: 5 }, passive: 'scorch' },
  slate:     { name: 'ICE SLATE', price: 2700, from: ['rod', 'hide'], stats: { ap: 8, hp: 50 }, passive: 'chill' },
  clock:     { name: 'STILL CLOCK', price: 3000, from: ['rod', 'mail'], stats: { ap: 9, armor: 18, haste: 8 }, passive: 'brace' },
  hornet:    { name: 'HORNET NEST', price: 2900, from: ['almanac', 'recurve'], stats: { ap: 8, as: 0.3, haste: 10 }, passive: 'kindling' },

  // THE CONSUMABLE: a stack of up to `stack` in ONE slot (League's potions),
  // drunk off that slot's key (the `potion` banner below). No stats, no passive,
  // never a part of anything.
  potion: { name: 'HEALTH POTION', price: 50, stack: 5, stats: {}, icon: 'itemPotion' },
};
// an item's tier, off its record: 'potion', 'basic' (built from nothing),
// 'boots' (an upgraded pair), 'legend' (built from at least one epic, or
// dear) and 'epic' (built from basics)
const ITEM_LEGEND_PRICE = 2000; // a built item this dear or dearer is legendary
function itemTier(id) {
  const it = BUILD_ITEMS[id];
  if (it.stack) return 'potion';
  if (!it.from) return 'basic';
  if (it.boots) return 'boots';
  return it.price >= ITEM_LEGEND_PRICE ? 'legend' : 'epic';
}
// the whole catalogue in the order the grid shows it: tier, then price
const ITEM_TIER_ORDER = ['potion', 'basic', 'boots', 'epic', 'legend'];
const ITEM_ALL = Object.keys(BUILD_ITEMS).sort((a, b) =>
  ITEM_TIER_ORDER.indexOf(itemTier(a)) - ITEM_TIER_ORDER.indexOf(itemTier(b)) || BUILD_ITEMS[a].price - BUILD_ITEMS[b].price);
const ITEM_PARTS = ITEM_ALL.filter((id) => !BUILD_ITEMS[id].from && !BUILD_ITEMS[id].stack);
const ITEM_DONE = ITEM_ALL.filter((id) => itemTier(id) === 'legend');
// what an item goes INTO: every item that names it in its recipe (the shop's BUILDS INTO row)
function itemInto(id) { return ITEM_ALL.filter((k) => (BUILD_ITEMS[k].from || []).includes(id)); }

function itemIcon(id) { return SPRITES[BUILD_ITEMS[id].icon || 'item_' + id]; }
function isPart(id) { return !BUILD_ITEMS[id].from && !BUILD_ITEMS[id].stack; }
function isStack(id) { return !!BUILD_ITEMS[id].stack; }
function isBoots(id) { return !!BUILD_ITEMS[id].boots; }
// the metal an item is drawn in, everywhere it shows (its well's rim, and the
// ink its name is printed in): a basic in dim green, an epic or a pair of
// boots in steel blue, a legendary in gold (the potion wears the basic's green)
const ITEM_METAL = {
  part: { rim: '#3f6e44', ink: '#7fb87f' },
  epic: { rim: '#4f78a8', ink: '#b4d0f0' },
  done: { rim: '#ffcf33', ink: '#fff6c8' },
};
function itemMetal(id) {
  const t = itemTier(id);
  return t === 'legend' ? ITEM_METAL.done : t === 'epic' || t === 'boots' ? ITEM_METAL.epic : ITEM_METAL.part;
}

// THE PRICE STILL TO PAY for an item, League's way: its own price minus every
// component of it already in a slot, each slot counted once, and a component
// not held is looked into in turn - so a QUIVER held takes 1000 off HUNTER'S
// HORN, and a GUT STRING held takes 300 off it through the RECURVE LIMB.
// Returns the gold and the slot indices the buy will use up.
function itemCost(p, id) {
  const used = [];
  const walk = (k) => {
    let gold = BUILD_ITEMS[k].price;
    for (const part of BUILD_ITEMS[k].from || []) {
      const i = p.items.findIndex((x, j) => x === part && !used.includes(j));
      if (i >= 0) { used.push(i); gold -= BUILD_ITEMS[part].price; }
      else gold -= BUILD_ITEMS[part].price - walk(part);
    }
    return gold;
  };
  return { gold: walk(id), used };
}
// the slots free once the buy has spent its parts
function itemRoom(p, used) { return p.items.filter((x, j) => x === null || used.includes(j)).length; }
// ONE PAIR OF BOOTS: a buy of boots is refused while another pair is held
// that the buy does not use up
function bootsClash(p, id, used) {
  return isBoots(id) && p.items.some((x, j) => x && isBoots(x) && !used.includes(j));
}

// fold the slots into a kit: every item's stats, then each passive once
// (after all the stats, so AMPLIFY multiplies the whole of them)
function itemMods(k, p) {
  const held = (p.items || []).filter(Boolean);
  for (const id of held) { const st = BUILD_ITEMS[id].stats; for (const s in st) ITEM_STATS[s].mod(k, st[s]); }
  for (const pv of new Set(held.map((id) => BUILD_ITEMS[id].passive).filter(Boolean))) ITEM_PASSIVES[pv].mod(k);
}
// rebuild the kit after the slots changed; new max health arrives filled, the
// way a hero level does, and lost max health clamps
function itemsChanged(p) {
  const oldMax = p.maxHp;
  refreshKit(p);
  if (p.maxHp > oldMax) p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - oldMax));
  p.hp = Math.min(p.hp, p.maxHp);
}

// ONE BUY, reached through runCmd (input.cmd {kind:'shop', act:'item'}), so
// the HUD click and a bot buy the same way. Re-checks the reach, the gold and
// the room itself, so a stale order is harmless. Nothing is contested: the
// stock is endless, so two buyers never want the same thing.
function buyItem(p, id) {
  if (!Object.hasOwn(BUILD_ITEMS, id) || !merchNear(p)) { shopDeny(p); return false; }
  if (id === 'potion') return buyPotion(p);
  const c = itemCost(p, id);
  if (p.inv.gold < c.gold || itemRoom(p, c.used) < 1 || bootsClash(p, id, c.used)) { shopDeny(p); return false; }
  pay({ gold: c.gold }, p);
  for (const j of c.used) p.items[j] = null;
  p.items[p.items.indexOf(null)] = id;
  itemsChanged(p);
  shopFx(p, '-' + c.gold, RES_COLORS.gold);
  sfxFor(p, isPart(id) ? 'coin' : 'buy');
  return true;
}
// ...and one sale, at ITEM_SELL of the item's whole price. A trade, not a
// payout: never counted as earned (tradeGold).
function sellItem(p, slot) {
  const id = p.items[slot];
  if (!id || !merchNear(p)) { shopDeny(p); return false; }
  const v = itemSellValue(id);
  if (id === 'potion') takePotion(p); // a stack sells one at a time
  else p.items[slot] = null;
  itemsChanged(p);
  tradeGold(p, v);
  shopFx(p, String(v), RES_COLORS.gold);
  sfxFor(p, 'coin');
  return true;
}
function itemSellValue(id) { return Math.floor(BUILD_ITEMS[id].price * ITEM_SELL); }

// THE BLOW ITSELF, before it lands (hurtUnit, js/sim/actions.js): CULL on a
// body badly hurt, and SURGE's next basic attack after a key.
function itemsDeal(src, e, dmg, o) {
  if (!(src instanceof Player)) return dmg;
  const k = kitOf(src);
  if (k.cull && e.maxHp > 0 && e.hp < e.maxHp * CULL_BELOW) dmg *= CULL_MUL;
  if (k.surge && o.basic && src.surgeT > 0) { src.surgeT = 0; dmg *= SURGE_MUL; }
  return Math.round(dmg);
}
// a key is pressed (useAbility, js/sim/abilities.js): SURGE arms the next basic attack
function itemsOnCast(p) { if (kitOf(p).surge) p.surgeT = SURGE_T; }
// Called from hurtUnit for every blow a player lands. A burn's own ticks are
// not hits, so they never feed KINDLING, CHILL, LEECH or SCORCH.
function itemsOnHit(src, e, o, dmg) {
  src.fightT = ITEM_FIGHT_T;
  if (o.type === 'burn' || o.thorns) return;
  const k = kitOf(src);
  if (k.kindle) {
    src.kindleN = (src.kindleN || 0) + 1;
    if (src.kindleN >= KINDLE_EVERY) { src.kindleN = 0; igniteUnit(e, KINDLE_BURN, BURN_DPS, src); }
  }
  if (k.chill) slowUnit(e, CHILL_T, CHILL_MUL);
  if (k.scorch && o.ab) igniteUnit(e, SCORCH_BURN, BURN_DPS, src);
  if (k.leech && dmg > 0) healPlayer(src, dmg * LEECH_SHARE);
}
// ...and every blow a player TAKES from a body (hurtUnit): THORNS hands a
// share back to a player, a beast or a bot that struck it - never to a tower,
// and never a thorn for a thorn
function itemsOnHurt(e, src, dmg, o) {
  if (!kitOf(e).thorns || o.thorns || o.type === 'burn' || !(dmg > 0) || e.invuln > 0) return;
  if (!(src instanceof Player || robots.includes(src) || animals.includes(src)) || !unitFoe(e, src)) return;
  const d = Math.hypot(src.x - e.x, src.y - e.y) || 1;
  hurtUnit(src, Math.max(1, Math.round(dmg * THORN_SHARE)), (src.x - e.x) / d, (src.y - e.y) / d, e, { thorns: true, kb: 0 });
}
// BRACE on the stat sheet (statOf, js/sim/stats.js): armor while badly hurt
function itemStat(p, key) {
  return key === 'armor' && p.kit && p.kit.brace && p.hp < p.maxHp * BRACE_BELOW ? BRACE_ARMOR : 0;
}
// STEADY on crowd control's length (ccMul, js/sim/actions.js)
function itemTen(e) { return e instanceof Player && e.kit && e.kit.steady ? STEADY_MUL : 1; }
// the player's own clock, once a step (js/sim/sim.js): the fight timer, DEN's
// heal once it has run out, SURGE's window, SMOLDER's pulse and the potion
function itemsTick(p, dt) {
  if (p.fightT > 0) p.fightT = Math.max(0, p.fightT - dt);
  else if (p.kit.restHeal > 0 && p.hp < p.maxHp) healPlayer(p, p.kit.restHeal * dt);
  if (p.surgeT > 0) p.surgeT = Math.max(0, p.surgeT - dt);
  if (p.kit.smolder && !p.dead) {
    p.smolderT = (p.smolderT || 0) - dt;
    if (p.smolderT <= 0) {
      p.smolderT = SMOLDER_EVERY;
      for (const e of unitsNear(p, p.x, p.y, SMOLDER_R)) if ((e instanceof Player || e.bot) && unitTeam(e) !== p.team) igniteUnit(e, SMOLDER_BURN, BURN_DPS, p);
    }
  }
  potionTick(p, dt);
}

// ---- potion --------------------------------------------------------------
// THE HEAL A PLAYER CARRIES, League's way: bought at either counter for its
// price, stacked up to BUILD_ITEMS.potion.stack in ONE item slot (`p.items`
// holds 'potion' there and `p.potions` is how many), and drunk off that slot's
// key or a click on its well (the input's useItem intent, useItem below).
// One drink heals POTION_HEAL over POTION_T through healPlayer, and nothing
// breaks it: a hit, a stun and a roll all let it run. A second one waits for
// the first to finish (the well sweeps for the time left), and a body at full
// health keeps its potion. Death pours it out (Player.reset).
const POTION_HEAL = 100;  // health one potion gives back...
const POTION_T = 15;      // ...over this many seconds
const POTION_FX_T = 0.35; // s between the green motes rising off a drinker
function potionSlot(p) { return p.items ? p.items.indexOf('potion') : -1; }
// room for one more: a stack with space, or a free slot to start one in
function potionRoom(p) {
  return potionSlot(p) >= 0 ? (p.potions || 0) < BUILD_ITEMS.potion.stack : p.items.includes(null);
}
function buyPotion(p) {
  const price = BUILD_ITEMS.potion.price;
  if (p.inv.gold < price || !potionRoom(p)) { shopDeny(p); return false; }
  pay({ gold: price }, p);
  if (potionSlot(p) < 0) { p.items[p.items.indexOf(null)] = 'potion'; p.potions = 0; }
  p.potions++;
  shopFx(p, '-' + price, RES_COLORS.gold);
  sfxFor(p, 'coin');
  return true;
}
// one out of the stack; the last one frees its slot
function takePotion(p) {
  p.potions = Math.max(0, (p.potions || 0) - 1);
  if (p.potions <= 0) { const i = potionSlot(p); if (i >= 0) p.items[i] = null; }
}
// the useItem intent (updatePlayer, js/sim/sim.js): an item slot's key or a
// click on its well. Only the potion has a use today; any other slot is
// refused with the well's red.
function useItem(p, slot) {
  if (p.items[slot] === 'potion') { drinkPotion(p, slot); return; }
  if (p === player) itemDenied(slot);
}
function drinkPotion(p, slot) {
  if (p.dead || p.potT > 0 || p.hp >= p.maxHp || (p.potions || 0) <= 0 || inAir(p)) {
    if (p === player) itemDenied(slot);
    return;
  }
  takePotion(p);
  p.potT = POTION_T;
  p.potFxT = 0;
  sfxAt('heal', p.x, p.y);
  burst(p.x, p.y - 8, '#e0505a', 6, 30, 0.4);
}
function potionTick(p, dt) {
  if (!(p.potT > 0)) return;
  const t = Math.min(dt, p.potT);
  p.potT -= t;
  healPlayer(p, POTION_HEAL / POTION_T * t);
  p.potFxT -= dt;
  if (p.potFxT <= 0) {
    p.potFxT = POTION_FX_T;
    particles.push({
      x: p.x + rand(-4, 4), y: p.y - 3, vx: rand(-4, 4), vy: rand(-22, -12),
      life: rand(0.4, 0.6), maxLife: 0.5, color: '#8fe08a', size: 1, grav: 0, alpha: 1 - concealOf(p),
    });
  }
}

// ---- bots ------------------------------------------------------------------
// Each class's build, League-style: the first legendary, then boots, then the
// rest, in the order a bot finishes them. A bot saves for the next item on
// its list, and at a counter buys it whole if the purse covers it, else the
// first component of it (however deep) it can afford and has room for. The
// same lists are the shop's RECOMMENDED tab (shopRecommended, js/ui/shop.js),
// so what a bot buys is what the counter suggests to you.
const BOT_BUILDS = {
  HUNTER: ['horn', 'quick', 'feathers', 'frostline', 'sunstone', 'cloak'],
  WARRIOR: ['grind', 'hobnail', 'maul', 'stonehide', 'beartooth', 'brambmail'],
  ARMATOS: ['bearskin', 'hobnail', 'brambmail', 'glacier', 'hearth', 'stonehide'], // the wall first: health and armor, then the walk to the fight
  FORTIVA: ['brand', 'mukluk', 'fang', 'stonehide', 'maul', 'collar'], // the hit first, the health to stay in the fight, then the legs to reach it
  BELLA: ['beartooth', 'quick', 'maul', 'feathers', 'sunstone', 'collar'], // the blade first: damage and its cut, then the speed to chain it
};
function botBuild(p) { return BOT_BUILDS[CLASSES[p.cls].name] || BOT_BUILDS.HUNTER; }
// the next item on p's list it does not have yet, or null when done
function botNextItem(p) {
  const have = p.items.slice();
  for (const id of botBuild(p)) {
    const i = have.indexOf(id);
    if (i >= 0) { have[i] = null; continue; }
    return id;
  }
  return null;
}
// every component an item is built from, however deep, each once
function itemParts(id, out) {
  out = out || new Set();
  for (const q of BUILD_ITEMS[id].from || []) { out.add(q); itemParts(q, out); }
  return out;
}
// a held item nothing still left on p's list is built from (bought off an
// old list): the slot index of the first one, or -1. Sold at a counter once
// the slots are full, so a stray part never blocks the build - and so are the
// potions, last, once the build still wants their slot.
function botStrayPart(p) {
  const want = new Set();
  for (const id of botBuild(p)) if (!p.items.includes(id)) itemParts(id, want);
  for (let i = 0; i < p.items.length; i++) {
    const id = p.items[i];
    if (id && !isStack(id) && !want.has(id) && !botBuild(p).includes(id)) return i;
  }
  return botNextItem(p) ? potionSlot(p) : -1;
}
// A bot keeps potions on it the way a League bot does: the first one before
// anything else on its list, and topped up to BOT_POTIONS when the build has
// nothing it can buy right now. Never while the build needs the slot.
const BOT_POTIONS = 2;
function botWantsPotion(p, first) {
  const n = potionSlot(p) >= 0 ? p.potions : 0;
  if (n >= (first ? 1 : BOT_POTIONS) || p.inv.gold < BUILD_ITEMS.potion.price || !potionRoom(p)) return false;
  return n > 0 || p.items.filter((x) => x === null).length > 1 || !botNextItem(p);
}
// what a bot would buy RIGHT NOW with its purse: the next item whole, or the
// first component of it (depth first, the recipe's own order) it can buy -
// an epic whole before its basics. null when nothing on the way is affordable.
function botItemBuy(p) {
  const id = botNextItem(p);
  if (!id) return null;
  const held = p.items.slice();
  const can = (k) => { const c = itemCost(p, k); return p.inv.gold >= c.gold && itemRoom(p, c.used) >= 1 && !bootsClash(p, k, c.used); };
  const walk = (k) => {
    if (can(k)) return k;
    for (const q of BUILD_ITEMS[k].from || []) {
      const i = held.indexOf(q);
      if (i >= 0) { held[i] = null; continue; }
      const r = walk(q);
      if (r) return r;
    }
    return null;
  };
  return walk(id);
}
