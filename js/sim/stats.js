// ------ hero stats
// Every hero is the same seven numbers, League-style: HEALTH, DAMAGE, ATTACK
// SPEED, ARMOR, ABILITY POWER, COOLDOWN SPEED and MOVE SPEED. A hero starts
// from its own base and grows a set amount a level (CLASSES[c].base / .grow,
// js/sim/player.js); gear and cards add to the kit's bonus bag (`kit.add`,
// written by their mod() and rebuilt by refreshKit); a bear buff multiplies
// at the moment it counts (statBuffMul). statOf is the ONE reader: the sim,
// the HUD's stat panel (js/ui/statpanel.js) and the bots all ask it, so no
// screen can show a number the body does not play by.
//
// How each one counts:
//   hp     the most health                       base + grow a level + bonus
//   dmg    every basic attack at full draw       base + grow a level + bonus
//   as     full-draw attacks a second            the class weapon's own cycle x (1 + grow a level + bonus)
//   armor  a hit is cut to 100 / (100 + armor)   base + grow a level + bonus
//   ap     each ability adds its `ap` ratio of it (CLASS_AB, js/sim/abilities.js)
//   haste  a cooldown runs 100 / (100 + haste) as long
//   ms     walking speed in px/s                 base + bonus
// `as` is the one fraction in the bag (+0.1 is +10%); the rest are flat.
const STAT_INT = (v) => String(Math.round(v));
const STAT_AS = (v) => (Math.round(v * 100) / 100).toFixed(2);
// key, name, how it prints, and which way is better (+1 higher). The panel's
// icons sit with its drawing (STAT_ICON, js/ui/statpanel.js), in this order.
const STATS = [
  { key: 'hp', name: 'HEALTH', fmt: STAT_INT, dir: 1 },
  { key: 'dmg', name: 'DAMAGE', fmt: STAT_INT, dir: 1 },
  { key: 'as', name: 'ATTACK SPEED', fmt: STAT_AS, dir: 1 },
  { key: 'armor', name: 'ARMOR', fmt: STAT_INT, dir: 1 },
  { key: 'ap', name: 'ABILITY POWER', fmt: STAT_INT, dir: 1 },
  { key: 'haste', name: 'COOLDOWN SPEED', fmt: STAT_INT, dir: 1 },
  { key: 'ms', name: 'MOVE SPEED', fmt: STAT_INT, dir: 1 },
];
// an empty bonus bag, every key at nothing: what baseKit starts a kit with
function statBag() { const b = {}; for (const s of STATS) b[s.key] = 0; return b; }
// the class weapon's own full cycle, as attacks a second: the full draw plus
// the renock after it (the loadout tool's rate, toolRof, js/sim/tools.js)
function classAs(cls) {
  const k = CLASSES[cls].kit, tool = TOOLS[CLASS_LOADOUT[cls].tool];
  return 1 / (k.bowCharge + tool.rof * TOOL_ROF_STEP * (k.nock / BOW_NOCK));
}
// the multiplier attack speed puts on the cycle: every draw and renock is
// divided by it (drawTime, toolRof, toolCycle)
function asMulFrom(cls, level, add) {
  return Math.max(0.25, 1 + (CLASSES[cls].grow.as || 0) * Math.max(0, level - 1) + (add ? add.as : 0));
}
// one stat for a hero of this class at this level with this bonus bag. The
// pure form, so the hero pop-up can price a pick before there is a body.
function statFrom(cls, level, add, key) {
  if (key === 'as') return classAs(cls) * asMulFrom(cls, level, add);
  const c = CLASSES[cls];
  return (c.base[key] || 0) + (c.grow[key] || 0) * Math.max(0, level - 1) + (add ? add[key] : 0);
}
function statOf(p, key) { return statFrom(p.cls, p.level, kitOf(p).add, key); }
function asMul(p) { return asMulFrom(p.cls, p.level, kitOf(p).add); }
// what a running buff multiplies a stat by right now (1 = nothing). The bear
// buffs (campBuff, js/sim/wildlife.js) raise every blow landed and the walk;
// hurtUnit and abilityMoveMul apply these, and the panel shows them.
function statBuffMul(p, key) {
  if (!(p.buffT > 0)) return 1;
  return key === 'dmg' ? CAMP_BUFF_DMG : key === 'ms' ? CAMP_BUFF_SPD : 1;
}
// the number the panel prints: the sheet with its buffs on
function statShown(p, key) { return statOf(p, key) * statBuffMul(p, key); }
// The panel's hover: where a number comes from, row by row. Each row is
// [source, value, kind] - kind 'base', 'lv', 'add' (gear and cards, or items) or 'buff'
// (a multiplier, printed as a percent) - and rows that add nothing are left out.
function statParts(p, key) {
  const c = CLASSES[p.cls], add = kitOf(p).add, n = Math.max(0, p.level - 1), rows = [];
  // the items' share of the bonus, folded into a spare kit the way refreshKit
  // folds them; the rest of the bag is cards
  const ik = baseKit(p.cls);
  if (p.items) itemMods(ik, p);
  const it = ik.add[key] || 0, rest = ((add && add[key]) || 0) - it;
  const kind = key === 'as' ? ['lvp', 'addp'] : ['lv', 'add'];
  rows.push(['BASE', key === 'as' ? classAs(p.cls) : c.base[key] || 0, 'base']);
  if (n && c.grow[key]) rows.push(['LEVEL ' + p.level, c.grow[key] * n, kind[0]]);
  if (Math.abs(rest) > 1e-9) rows.push(['CARDS', rest, kind[1]]);
  if (Math.abs(it) > 1e-9) rows.push(['ITEMS', it, kind[1]]);
  const b = statBuffMul(p, key);
  if (b !== 1) rows.push([(MONSTER[p.buffKind] && MONSTER[p.buffKind].buff) || 'BUFF', b - 1, 'buff']);
  return rows;
}
// ARMOR at the hit: what a blow of `dmg` leaves after this body's armor, never
// under 1 (damagePlayer, js/sim/player.js) - and its inverse, the blow it
// takes to land `n` (orcaLethal, js/sim/orca.js)
function armorTaken(p, dmg) { return Math.max(1, Math.round(dmg * 100 / (100 + Math.max(0, statOf(p, 'armor'))))); }
function armorRaw(p, n) { return Math.max(1, Math.ceil((n - 0.5) * (100 + Math.max(0, statOf(p, 'armor'))) / 100)); }
// COOLDOWN SPEED on a cooldown: the share of it that is left to wait (abCdOf)
function hasteMul(p) { return 100 / (100 + Math.max(0, statOf(p, 'haste'))); }
// The ledgers' rows - the hero pop-up's (js/ui/menu.js), the character panel's
// (js/ui/bag.js) and the stat plate's (js/ui/shop.js): [name, get(kit, player?),
// format, dir]. The player is optional: the hero pop-up prices a pick before
// the match, where every hero is level 1 and the kit says whose it is.
const STAT_ROWS = STATS.map((s) => [s.name,
  (k, p) => statFrom(p ? p.cls : k.cls, p ? p.level : 1, k.add, s.key), s.fmt, s.dir]);
