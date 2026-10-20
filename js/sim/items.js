'use strict';
// ------------------------------------------------------------ items
// THE BUILD, League's way: six item slots a player fills at either merchant's
// counter (js/ui/shop.js). Every item is always on sale - nothing rotates,
// nothing sells out, so a player can save up for the one they want.
//
// Two kinds share one table. A PART is cheap and carries one stat. A FINISHED
// item is built FROM parts: it carries a bigger version of their stats and one
// PASSIVE, and it costs its own price minus the parts already in your slots,
// which the buy uses up (itemCost, buyItem). So a part bought early is never
// wasted gold, and saving toward a finished item can start one part at a time.
//
// What an item does is all in this file: its stats and its passive both write
// into the kit through refreshKit (js/sim/player.js), the same way a card
// does, so every kit-reading site (damage, movement, dodge,
// stealth, the bots) picks an item up without knowing items exist. The two
// passives that are not a kit number - a hit that does something, a heal out
// of a fight - hang off hurtUnit (itemsOnHit) and the player's clock
// (itemsTick), the shared functions every hit and every body goes through.
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

// What each stat line IS: the label the shop prints, how its number reads,
// and what it writes into the kit. Every line is one of the hero stats
// (js/sim/stats.js) and adds to the kit's stat bag, `kit.add`, the same bag
// cards add to, so statOf reads an item without knowing items
// exist. ARMOR is League's (each point a share off every hit), ATTACK SPEED a
// share added to the hero's attack speed, MOVE SPEED flat (the hero's walk is
// PLAYER_SPEED).
const ITEM_STATS = {
  dmg:   { label: 'DAMAGE', fmt: (v) => '+' + v, mod: (k, v) => { k.add.dmg += v; } },
  hp:    { label: 'HEALTH', fmt: (v) => '+' + v, mod: (k, v) => { k.add.hp += v; } },
  armor: { label: 'ARMOR', fmt: (v) => '+' + v, mod: (k, v) => { k.add.armor += v; } },
  as:    { label: 'ATTACK SPEED', fmt: (v) => '+' + Math.round(v * 100) + '%', mod: (k, v) => { k.add.as += v; } },
  ms:    { label: 'MOVE SPEED', fmt: (v) => '+' + v, mod: (k, v) => { k.add.ms += v; } },
};
const ITEM_STAT_ORDER = ['dmg', 'hp', 'armor', 'as', 'ms']; // the shop's category filters, in this order

// The passives, each a name, one short line and what it writes into the kit.
// kindle / chill / restHeal are read by itemsOnHit and itemsTick below; the
// rest are kit fields the sim already reads.
const ITEM_PASSIVES = {
  kindling: { name: 'KINDLING', line: 'EVERY 3RD HIT BURNS', mod: (k) => { k.kindle = true; } },
  den:      { name: 'DEN', line: 'HEALS OUT OF A FIGHT', mod: (k) => { k.restHeal += 3; } },
  feast:    { name: 'FEAST', line: 'A KILL HEALS 20', mod: (k) => { k.killHeal += 20; } },
  chill:    { name: 'CHILL', line: 'HITS SLOW FOR 1 S', mod: (k) => { k.chill = true; } },
  glide:    { name: 'GLIDE', line: 'FASTER ON ICE', mod: (k) => { k.iceMax *= 1.15; k.iceSteer += 0.3; } },
  drift:    { name: 'DRIFT', line: 'SEEN FROM CLOSER', mod: (k) => { k.stealth -= 0.15; } },
  light:    { name: 'LIGHT', line: 'ROLL COMES BACK SOONER', mod: (k) => { k.dodgeCd -= 0.8; } },
  ambush:   { name: 'AMBUSH', line: 'AMBUSH SHOTS HIT HARDER', mod: (k) => { k.ambushMul += 0.4; } },
};

// THE CATALOGUE. `from` lists the parts a finished item is built out of (a
// part named twice is needed twice). `icon` is a SPRITES key, or
// ['gear', slot, variant, material] for one of SPRITES.gearIcons. The icons are
// borrowed from today's art until the items get their own.
const BUILD_ITEMS = {
  flint:  { name: 'FLINT HEAD', price: 30, stats: { dmg: 2 }, icon: 'itemArt_flint' },
  hide:   { name: 'WOLF HIDE', price: 25, stats: { hp: 15 }, icon: ['gear', 1, 0, 0] },
  string: { name: 'GUT STRING', price: 30, stats: { as: 0.08 }, icon: ['gear', 0, 1, 0] },
  plate:  { name: 'IRON PLATE', price: 30, stats: { armor: 7 }, icon: ['gear', 1, 1, 1] },
  boots:  { name: 'FUR BOOTS', price: 25, stats: { ms: 4 }, icon: ['gear', 3, 0, 0] },

  horn:     { name: "HUNTER'S HORN", price: 150, from: ['flint', 'string'], stats: { dmg: 4, as: 0.15 }, passive: 'kindling', icon: 'itemArt_horn' },
  bearskin: { name: 'BEARSKIN', price: 140, from: ['hide', 'plate'], stats: { hp: 35, armor: 14 }, passive: 'den', icon: ['gear', 1, 2, 3] },
  fang:     { name: 'WOLF FANG', price: 130, from: ['flint', 'hide'], stats: { dmg: 3, hp: 20 }, passive: 'feast', icon: ['gear', 0, 2, 3] },
  brand:    { name: 'IRON BRAND', price: 140, from: ['flint', 'plate'], stats: { dmg: 3, armor: 14 }, passive: 'chill', icon: 'itemArt_brand' },
  skates:   { name: 'SKATES', price: 80, from: ['boots'], stats: { ms: 6 }, passive: 'glide', icon: ['gear', 3, 0, 3] },
  cloak:    { name: 'SNOW CLOAK', price: 120, from: ['boots', 'hide'], stats: { hp: 20, ms: 4 }, passive: 'drift', icon: ['gear', 3, 2, 3] },
  feathers: { name: 'FEATHERS', price: 130, from: ['string', 'boots'], stats: { as: 0.18, ms: 4 }, passive: 'light', icon: ['gear', 3, 1, 3] },
  sunstone: { name: 'SUNSTONE', price: 200, from: ['flint', 'flint'], stats: { dmg: 7 }, passive: 'ambush', icon: 'itemOre_sunstone' },
};
const ITEM_PARTS = Object.keys(BUILD_ITEMS).filter((id) => !BUILD_ITEMS[id].from);
const ITEM_DONE = Object.keys(BUILD_ITEMS).filter((id) => BUILD_ITEMS[id].from);

function itemIcon(id) {
  const ic = BUILD_ITEMS[id].icon;
  return Array.isArray(ic) ? SPRITES.gearIcons[ic[1]][ic[2]][ic[3]] : SPRITES[ic];
}
function isPart(id) { return !BUILD_ITEMS[id].from; }
// the metal an item is drawn in, everywhere it shows: a part in dim green, a
// finished item in gold (its well's rim, and the ink its name is printed in)
const ITEM_METAL = { part: { rim: '#3f6e44', ink: '#7fb87f' }, done: { rim: '#ffcf33', ink: '#fff6c8' } };
function itemMetal(id) { return isPart(id) ? ITEM_METAL.part : ITEM_METAL.done; }

// THE PRICE STILL TO PAY for an item: its own price minus every part of it
// already in a slot, each slot counted once - so a Sunstone with one Flint
// Head held costs 170, and with two, 140. Returns the gold and the slot
// indices the buy will use up.
function itemCost(p, id) {
  const it = BUILD_ITEMS[id], used = [];
  let gold = it.price;
  for (const part of it.from || []) {
    const i = p.items.findIndex((x, j) => x === part && !used.includes(j));
    if (i >= 0) { used.push(i); gold -= BUILD_ITEMS[part].price; }
  }
  return { gold, used };
}
// the slots free once the buy has spent its parts
function itemRoom(p, used) { return p.items.filter((x, j) => x === null || used.includes(j)).length; }

// fold the slots into a kit: every item's stats, then each passive once
function itemMods(k, p) {
  const seen = new Set();
  for (const id of p.items || []) {
    if (!id) continue;
    const it = BUILD_ITEMS[id];
    for (const s in it.stats) ITEM_STATS[s].mod(k, it.stats[s]);
    if (it.passive && !seen.has(it.passive)) { seen.add(it.passive); ITEM_PASSIVES[it.passive].mod(k); }
  }
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
  const c = itemCost(p, id);
  if (p.inv.gold < c.gold || itemRoom(p, c.used) < 1) { shopDeny(p); return false; }
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
  p.items[slot] = null;
  itemsChanged(p);
  tradeGold(p, v);
  shopFx(p, String(v), RES_COLORS.gold);
  sfxFor(p, 'coin');
  return true;
}
function itemSellValue(id) { return Math.floor(BUILD_ITEMS[id].price * ITEM_SELL); }

// Called from hurtUnit (js/sim/actions.js) for every blow a player lands. A
// burn's own ticks are not hits, so they never feed KINDLING or CHILL.
function itemsOnHit(src, e, o) {
  src.fightT = ITEM_FIGHT_T;
  if (o.type === 'burn') return;
  const k = kitOf(src);
  if (k.kindle) {
    src.kindleN = (src.kindleN || 0) + 1;
    if (src.kindleN >= KINDLE_EVERY) { src.kindleN = 0; igniteUnit(e, KINDLE_BURN, BURN_DPS, src); }
  }
  if (k.chill) slowUnit(e, CHILL_T, CHILL_MUL);
}
// A sprung chest's free part (hitObject, js/sim/actions.js): one part off the
// shared rng, straight into a free slot. With every slot full it pays the
// part's price in gold instead, so a chest is never worth less for a full build.
function chestPart(p, x, y) {
  const id = ITEM_PARTS[Math.floor(rng() * ITEM_PARTS.length)];
  const slot = p.items.indexOf(null);
  if (slot < 0) { tradeGold(p, BUILD_ITEMS[id].price); addFloater(x, y - 34, '+' + BUILD_ITEMS[id].price, RES_COLORS.gold); return; }
  p.items[slot] = id;
  itemsChanged(p);
  addFloater(x, y - 34, BUILD_ITEMS[id].name, '#9fd6a0');
}
// the player's own clock, once a step (js/sim/sim.js): the fight timer, and
// DEN's heal once it has run out
function itemsTick(p, dt) {
  if (p.fightT > 0) p.fightT = Math.max(0, p.fightT - dt);
  else if (p.kit.restHeal > 0 && p.hp < p.maxHp) healPlayer(p, p.kit.restHeal * dt);
}

// ---- bots ------------------------------------------------------------------
// Each class's build, in the order a bot finishes it. A bot saves for the next
// finished item on its list, and at a counter it buys that item if the purse
// covers it, else the first of its parts it does not hold yet.
const BOT_BUILDS = {
  HUNTER: ['horn', 'feathers', 'fang', 'sunstone', 'skates', 'bearskin'],
  WARRIOR: ['bearskin', 'brand', 'fang', 'skates', 'cloak', 'sunstone'],
  ARMATOS: ['bearskin', 'cloak', 'brand', 'skates', 'fang', 'sunstone'], // the wall first: health and armor, then the walk to the fight
  FORTIVA: ['brand', 'bearskin', 'skates', 'fang', 'cloak', 'sunstone'], // the hit first, the health to stay in the fight, then the legs to reach it
  BELLA: ['brand', 'fang', 'skates', 'sunstone', 'cloak', 'bearskin'], // the blade first: damage and its cut, then the speed to chain it
};
// the next finished item on p's list it does not have yet, or null when done
function botNextItem(p) {
  const list = BOT_BUILDS[CLASSES[p.cls].name] || BOT_BUILDS.HUNTER;
  const have = p.items.slice();
  for (const id of list) {
    const i = have.indexOf(id);
    if (i >= 0) { have[i] = null; continue; }
    return id;
  }
  return null;
}
// a held part no item still left on p's list is built from (a chest's gift,
// usually): the slot index of the first one, or -1. Sold at a counter once
// the slots are full, so a stray part never blocks the build.
function botStrayPart(p) {
  const list = BOT_BUILDS[CLASSES[p.cls].name] || BOT_BUILDS.HUNTER;
  const want = new Set();
  for (const id of list) if (!p.items.includes(id)) for (const q of BUILD_ITEMS[id].from || []) want.add(q);
  for (let i = 0; i < p.items.length; i++) {
    const id = p.items[i];
    if (id && isPart(id) && !want.has(id)) return i;
  }
  return -1;
}
// what a bot would buy RIGHT NOW with its purse: the next item whole, or a part
// of it. null when nothing on its list is affordable.
function botItemBuy(p) {
  const id = botNextItem(p);
  if (!id) return null;
  const c = itemCost(p, id);
  if (p.inv.gold >= c.gold && itemRoom(p, c.used) >= 1) return id;
  const held = p.items.slice();
  for (const part of BUILD_ITEMS[id].from) {
    const i = held.indexOf(part);
    if (i >= 0) { held[i] = null; continue; }
    if (p.inv.gold >= BUILD_ITEMS[part].price && p.items.includes(null)) return part;
  }
  return null;
}
