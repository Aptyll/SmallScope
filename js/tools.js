'use strict';
// The weapon: a TOOL on the ONE weapon slot, loaded with BITS that say what
// it fires. A tool is a body - how often it can shoot, how many bits it holds,
// and how much WEIGHT it can swing in one press; a bit is a shot, or a
// modifier that rewrites every shot fired after it. One press spends the
// tool's strength along the row and looses everything it can afford at once.
// Both are carried items, both scatter out of the world, and a tool keeps its
// bits wherever it goes.
// Keys 1-4 are the class abilities now (js/abilities.js), not slot picks.
// ------------------------------------------------------------ tools & bits
// Ordering: this file needs ITEMS (js/player.js) and RES_COLORS
// (js/structures.js) at LOAD time - it registers one ITEMS entry per tool and
// per bit so the bag, the drop pickup, the death spill and the refusal flash
// are all generic over the new items exactly as they are over a berry. It
// loads after js/actions.js because the shot it spawns is the arrow pipeline's
// and it reads that file's tuning (BOW_Y, AMBUSH_MUL) at runtime.

// ---- tiers ---------------------------------------------------------------
// A tier is a colour and nothing else in the sim: what a tier BUYS you is
// written into each tool's numbers. The plate is the colour behind the icon -
// the one place tier is stated, in every well the item ever sits in (bag cell,
// tool slot, bit cell, loadout card), which is why nothing has to say "TIER 2".
// The top tier is the only one that moves: a shine sweeps its plate.
const TOOL_TIERS = [
  { name: 'WORN',   plate: '#33241a', rim: '#a3794f', ink: '#d9ad72' },
  { name: 'KEEN',   plate: '#14303f', rim: '#7ac0e8', ink: '#bfe6ff' },
  { name: 'GILDED', plate: '#3a2c0e', rim: '#f2cc6a', ink: '#fff2c0' },
];
const TIER_SHINE = 2; // the tier whose plate animates

// ---- bits ----------------------------------------------------------------
// Two kinds under one table, told apart by `proj`.
//
// EVERY bit carries a `weight`, projectile and modifier alike, because weight
// is what a press SPENDS. A tool's `tensile` is a BUDGET reset at the top of
// every activation and spent cell by cell in order (toolPlan below), so a
// heavy bit is not dead weight any more - it is expensive, and what it costs
// is whatever is stacked after it.
//
// A PROJECTILE bit is one shot: `path` is how it flies, `solid` whether a wall stops it, `ff`
// whether it will hurt your own side, `kb` how hard it shoves whatever it
// lands on, and life/speed/dmg are the baselines the
// tool, the champion kit, the hero level and any modifier bits scale - and
// the DRAW scales all three again (`the draw` below). A spent shot is gone:
// nothing lands in the snow to be picked back up, and the tool's own cycle
// is the only thing between one press and the next.
// UNITS: `life` is seconds and `speed` px/s, because that is what the sim runs
// in and what every hit test downstream reads. A tool's `rof` is the one
// number counted in game STEPS, since it is a cadence rather than a physical
// quantity - toolRof() is the single place that converts it.
//
// KNOCKBACK (`kb`) is a MULTIPLIER, not a speed: 1 is the ordinary shove a
// blow lands and the bit scales it. It has to be a multiplier, because the
// three kinds of unit are already shoved at three different weights (a player
// at HIT_KB, a worker at ROBOT_KB, an animal on a curve off the draw) and one
// number written on a bit has to mean the same thing thrown at any of them -
// so it rides to hurtUnit as `kbMul` and scales whatever shove that kind
// takes. A shot with no `kb` at all pushes exactly as hard as it always did.
//
// Four optional fields under those: `reach` is extra px on every hit test (a
// body wider than a shaft's tip - the fist and the axe), `body` names the
// silhouette the shots pass draws it with (BIT_BODY, js/render.js; absent =
// the arrow), `impact` what it DOES where it lands on something rather than
// simply running out (BIT_IMPACT below), and `bot: false` marks a bit no AI
// player can read, the way the paths it cannot aim are already left alone.
//
// `price` is what the merchant sells one for (the `shop` banner, js/shop.js),
// and half of it is what the merchant pays for one back. It is the only
// number on a bit the sim never reads - loot does not consult it and a found
// bit is worth exactly what a bought one is.
//
// A MODIFIER bit (`proj: false`) never flies, but it costs weight like
// everything else. Its `mod(m)` edits the shot envelope - and it edits it for
// every projectile AFTER it in the list and for NONE before it, so where a
// modifier sits is the whole of what it is worth, and a FLAME in the LAST cell
// sets nothing alight. Once a press has reached a modifier it stays in the
// envelope for the rest of that press: there is no per-shot expiry. The shelf
// draws that reach as a rail running forward off the fitting (js/ui.js).
//
// A MOD COMPOUNDS WITH WHAT IS ALREADY IN THE ENVELOPE. Every `mod` must
// COMPOSE with the value it is handed - `*=` a multiplier, `+=` a quantity -
// and must never `=` or `Math.max` it: two SPEEDUPs are four times the speed,
// two FLAMEs burn twice as long at twice the rate, two SPLITTERs are nine
// shots. That is the rule EVERY new modifier follows, and it is why the fold
// is a forward walk rather than a set-union. The one field that is set rather
// than composed is `m.type`, because a damage type is a category and not a
// magnitude.
//
// FIRE is the one damage TYPE a bit can put on a shot (`m.type`, DMG_TYPES in
// js/actions.js): the hit ignites what it lands on, which then burns for
// `m.burn` seconds at `m.burnDps` a second - on a rival, a deer or a worker
// bot alike, because a burn is a unit state like any other.
//
// `path` is one of: 'line' straight | 'orbit' circling the shooter |
// 'boomer' out and curving back | 'lob' a heavy throw that arcs down |
// 'curve' a scything arc, the way a thrown axe goes.
//
// The swung pair's flight, in seconds - declared above the table because the
// table reads it at LOAD time (PYRE_T and the rest sit under it, read inside
// a closure). It is SHORT on purpose: a fifth of a second at 300 px/s is a
// body length of travel, so the fist and the axe read as a blow thrown from
// where you stand rather than as anything in flight. They are projectiles
// only because a projectile is what the one weapon slot fires.
const FIST_T = 0.2;
const BITS = {
  // -- projectiles ---------------------------------------------------------
  arrow: {
    name: 'ARROW', blurb: 'THE PLAIN SHAFT. LIGHT AND TRUE.', price: 6, tier: 0, proj: true,
    weight: 2, path: 'line', solid: true, ff: false, kb: 1,
    life: 0.85, speed: 320, dmg: 8, col: '#e8dcb4',
  },
  barb: {
    name: 'BARBED SHOT', blurb: 'A HEAVY SHAFT. SLOW, AND IT HITS HARDER.', price: 16, tier: 0, proj: true,
    weight: 5, path: 'line', solid: true, ff: false, kb: 1.2,
    life: 1, speed: 250, dmg: 12, col: '#cfd8e8',
  },
  hook: {
    name: 'HOOKSHOT', blurb: 'FLIES OUT AND COMES BACK.', price: 14, tier: 0, proj: true,
    weight: 3, path: 'boomer', solid: false, ff: false, kb: 0.5,
    life: 1.5, speed: 260, dmg: 7, col: '#9fc4dd',
  },
  care: {
    name: 'CARE ARROW', blurb: 'FAST, PASSES WALLS, LIGHTS THE SNOW.', price: 42, tier: 1, proj: true,
    weight: 4, path: 'line', solid: false, ff: false, kb: 0.8,
    life: 0.7, speed: 430, dmg: 13, col: '#ffe6a8', lit: 34,
  },
  wisp: {
    name: 'WISP', blurb: 'CIRCLES YOU, LIGHTING THE DARK.', price: 34, tier: 1, proj: true,
    weight: 3, path: 'orbit', solid: false, ff: false, kb: 0.3,
    life: 3, speed: 250, dmg: 6, col: '#8fd8ff', lit: 40, body: 'mote',
  },
  log: {
    name: 'THROWING LOG', blurb: 'SLOW, ARCS DOWN, FLATTENS ANYONE.', price: 52, tier: 1, proj: true,
    weight: 8, path: 'lob', solid: true, ff: true, kb: 2.4,
    life: 2.2, speed: 155, dmg: 34, col: '#a3794f', body: 'tumble',
  },
  lance: {
    name: 'ICE LANCE', blurb: 'HEAVY, FLAT AND VERY FAST.', price: 110, tier: 2, proj: true,
    weight: 7, path: 'line', solid: true, ff: false, kb: 1.6,
    life: 1.1, speed: 380, dmg: 26, col: '#bfe6ff',
  },
  // The closing line: three bits that are not archery at all. Each one is
  // about ARRIVING - the fist at arm's length, the axe in the treeline, the
  // request wherever it sticks - which is what makes them a lineage on the
  // tech page rather than three loose oddities.
  fist: {
    name: 'BIG FIST', blurb: 'A PUNCH. NO REACH, AND IT THROWS BODIES.', price: 20, tier: 0, proj: true,
    weight: 4, path: 'line', solid: true, ff: false, kb: 4,
    // a fifth of a second of flight: it is gone before it reads as a shot,
    // which is the whole trick - a projectile that looks like a melee blow
    life: FIST_T, speed: 300, dmg: 16, col: '#e8b98a',
    reach: 5, body: 'fist', bot: false,
  },
  axe: {
    name: 'BIG AXE', blurb: 'A CURVING HEAD. HEAVY, AND NO REACH.', price: 78, tier: 1, proj: true,
    weight: 6, path: 'curve', solid: true, ff: false, kb: 2,
    life: 0.24, speed: 290, dmg: 20, col: '#cfd8e8',   // a hair past FIST_T: the head is heavier
    reach: 6, body: 'axe', impact: 'chop', bot: false,
  },
  warp: {
    name: 'TELEPORT REQUEST', blurb: 'FLIES WRONG. YOU END UP WHERE IT DOES.', price: 150, tier: 2, proj: true,
    weight: 5, path: 'line', solid: true, ff: false, kb: 0.2,
    life: 0.75, speed: 620, dmg: 6, col: '#c58fff', lit: 22,
    body: 'warp', impact: 'warp', bot: false,
  },
  // -- modifiers -----------------------------------------------------------
  // Every one of these COMPOUNDS: it composes with the envelope it is handed
  // rather than setting a value into it, so a second copy in the same tool is
  // a second application. Their weights are what a fitting costs the press it
  // sits in - a modifier is not free any more, and a tool packed with them has
  // nothing left to throw a shot with.
  speedup: {
    name: 'SPEEDUP', blurb: 'SHOTS AFTER IT FLY TWICE AS FAST.', price: 22, tier: 0, proj: false,
    weight: 3, col: '#8fe08a', mod: (m) => { m.spdMul *= 2; },
  },
  fan: {
    name: 'SPLITTER', blurb: 'SHOTS AFTER IT SPLIT IN THREE, WEAKER.', price: 28, tier: 0, proj: false,
    weight: 4, col: '#cfe0f2', mod: (m) => { m.fan *= 3; m.dmgMul *= 0.6; },
  },
  flame: {
    name: 'FLAME', blurb: 'SHOTS AFTER IT SET WHAT THEY HIT ALIGHT.', price: 46, tier: 1, proj: false,
    weight: 4, col: '#ff9440',
    mod: (m) => {
      m.type = 'fire';
      // ADDITIVE, so a second fire modifier really is a second fire: two
      // FLAMEs are exactly a PYRE, and a FLAME under a PYRE is nine seconds
      // at eighteen a second
      m.burn += BURN_T;
      m.burnDps += BURN_DPS;
      m.dmgAdd += 2;                    // the flat bonus is small now: the burn is the damage
      m.lit += 30;
    },
  },
  twin: {
    name: 'DUPLICATE', blurb: 'EVERY SHOT AFTER IT IS FIRED TWICE.', price: 60, tier: 1, proj: false,
    weight: 5, col: '#a259e6', mod: (m) => { m.dup *= 2; },
  },
  heft: {
    name: 'HEFT', blurb: 'SHOTS AFTER IT HIT HARDER, FLY SLOWER.', price: 95, tier: 2, proj: false,
    weight: 5, col: '#f2cc6a', mod: (m) => { m.dmgMul *= 1.6; m.spdMul *= 0.75; },
  },
  longshot: {
    name: 'LONGSHOT', blurb: 'SHOTS AFTER IT FLY MUCH FURTHER.', price: 88, tier: 2, proj: false,
    weight: 4, col: '#7ac0e8', mod: (m) => { m.lifeMul *= 1.8; m.spdMul *= 1.15; },
  },
  pyre: {
    name: 'PYRE', blurb: 'THE FIRE TAKES HOLD. LONGER, AND HOTTER.', price: 125, tier: 2, proj: false,
    weight: 6, col: '#ff5a2a',
    mod: (m) => {
      m.type = 'fire';
      m.burn += PYRE_T;
      m.burnDps += PYRE_DPS;
      m.lit += 34;
    },
  },
  cinder: {
    name: 'CINDER BURST', blurb: 'EVERY IMPACT AFTER IT THROWS EMBERS.', price: 135, tier: 2, proj: false,
    weight: 6, col: '#ffb347',
    mod: (m) => {
      m.type = 'fire';
      m.burn += BURN_T;
      m.burnDps += BURN_DPS;
      m.cinder += CINDER_R;             // ...and the ring the shot lights where it ends
      m.lit += 30;
    },
  },
};
// PYRE's own fire, and how wide a CINDER BURST scatters. The plain fire these
// two escalate is BURN_T / BURN_DPS, in the `status effects` banner of
// js/actions.js beside the burn itself.
const PYRE_T = BURN_T * 2;
const PYRE_DPS = BURN_DPS * 2;
const CINDER_R = 26;   // px of ring an ending shot sets alight

// ---- what a bit does where it LANDS ---------------------------------------
// `impact` on a bit names one of these, and the arrow update calls it when the
// shot ended ON something - a wall, a tree, a body - rather than merely
// running out of life over open snow. That distinction is the whole of the
// teleport's rule: a request that hits nothing takes you nowhere.
// `a` is the spent shot (a.x/a.y is where it stopped) and `p` whoever fired
// it, which may be gone by now.
const AXE_CHOP_R = 26;   // px around a landed axe head that takes the chop with it
const WARP_BACK = 0.02;  // s of flight rewound before the arrival, so it lands short of what it hit
// what the thrown axe is allowed to bite: the two things an E axe fells
const CHOPPABLE = { tree: true, deadTree: true };
const BIT_IMPACT = {
  // TELEPORT REQUEST: the shooter is standing where it stopped. The landing
  // spot is pulled back off whatever was hit and onto a tile a body can
  // actually stand on (nearestDryTile, js/actions.js), so a request buried in
  // a treeline puts you beside the tree rather than inside it.
  warp: (a, p) => {
    if (!unitAlive(p)) return;   // downed, or up on the bird, between loose and landing
    warpPlayer(p, a.x - a.vx * WARP_BACK, a.y - a.vy * WARP_BACK);
  },
  // BIG AXE: one chop into every tree within AXE_CHOP_R of where the head
  // stopped - the tile it struck included. It is the same blow an E swing
  // lands (chopTree, js/actions.js), gold and fell and loot roll and all, so
  // an axe thrown into a treeline is a real, if expensive, way to log.
  chop: (a, p) => {
    if (!p) return;
    // the tile square the ring fits inside, not the whole object array: the
    // same scan nearestDryTile and every other radius search here makes
    const r = Math.ceil(AXE_CHOP_R / TILE);
    const htx = Math.floor(a.x / TILE), hty = Math.floor(a.y / TILE);
    for (let ty = hty - r; ty <= hty + r; ty++) for (let tx = htx - r; tx <= htx + r; tx++) {
      if (!inWorld(tx, ty)) continue;
      const o = objAt(tx, ty);
      if (!o || !CHOPPABLE[o.type]) continue;
      if (Math.hypot(tx * TILE + 8 - a.x, ty * TILE + 8 - a.y) > AXE_CHOP_R) continue;
      // a work order is contested like any other: an axe and an E swing on
      // one tile in one step must be ONE chop, whichever of them got there
      contest('work:' + idx(tx, ty), p, () => {
        const t = objAt(tx, ty);
        if (t && CHOPPABLE[t.type]) chopTree(t, p);
      });
    }
  },
};
// One shot's impact, dispatched. Kept a function rather than an inline lookup
// so the sim reads as "what did this land on" and every new kind of ending
// stays one row in the table above.
function bitImpact(a) {
  const f = BIT_IMPACT[a.impact];
  if (f) f(a, players[a.owner]);
}

// ---- the teleport ---------------------------------------------------------
// A slot picked up and put down somewhere else, plus the tell that says it
// happened. Nothing else in the game moves a body without walking it, so the
// FLASH is not decoration: a silhouette of the character is stamped every
// WARP_STEP px of the line it crossed, all of them fading together over
// WARP_FLASH_T, which is what makes the jump read as a path rather than as a
// slot blinking out of existence. The trail is drawn by drawWarps
// (js/render.js) and aged by updateWarps below.
const WARP_FLASH_T = 0.34; // s the silhouettes hang before they are gone
const WARP_STEP = 11;      // px between them along the line
const WARP_MAX = 14;       // ...and the most a very long jump may stamp
const warps = []; // live flashes: {spr, x0, y0, x1, y1, n, col, t}
function warpPlayer(p, x, y) {
  let tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (!inWorld(tx, ty) || isSolidTile(tx, ty) || ground[idx(tx, ty)] === 2) {
    const t = nearestDryTile(x, y, p);
    tx = t.tx; ty = t.ty;
    x = tx * TILE + 8; y = ty * TILE + 8;
  }
  const d = Math.hypot(x - p.x, y - p.y);
  warps.push({
    spr: classSet(p)[p.dir][0], x0: p.x, y0: p.y, x1: x, y1: y,
    n: Math.max(2, Math.min(WARP_MAX, Math.round(d / WARP_STEP))),
    col: BITS.warp.col, t: 0,
  });
  risePlayer(p);   // you cannot be buried somewhere you are no longer standing
  cancelCatch(p);  // ...nor still holding a fish over the hole you left
  p.x = x; p.y = y;
  p.kbx = 0; p.kby = 0;
  burst(x, y - 6, BITS.warp.col, 12, 60, 0.5, true);
  burst(p.x, p.y - 6, '#f4f7ff', 6, 40, 0.4, true);
  if (nearPlayer(x, y)) SFX.warp();
  if (p === player) state.shake = Math.max(state.shake, 2);
}
function updateWarps(dt) {
  for (let i = warps.length - 1; i >= 0; i--) {
    warps[i].t += dt;
    if (warps[i].t >= WARP_FLASH_T) warps.splice(i, 1);
  }
}

// ---- tools ---------------------------------------------------------------
// `rof` is in game steps between shots (the number the HUD's cooldown wipe
// runs on); `cap` is how many bit cells the tool has; `tensile` is the WEIGHT
// BUDGET one press has to spend on them - reset at the top of every
// activation, spent cell by cell from the bottom up, and the first cell that
// would push the total PAST it ends that press there (toolPlan). `price` is
// the merchant's asking price (js/shop.js)
// and half of it what one fetches sold back - a tool sold with bits in it
// fetches half of those too, so nothing is ever quietly emptied for gold. `art` picks the 12x12 silhouette, which is baked
// once per tier - so a tool's shape says which family it is and its colour
// says how good it is, the way GEAR_MATS tints one gear icon across levels.
//
// TENSILE AND CAP ARE THE TWO HALVES OF A TOOL. `cap` is how much you may
// hang on it and `tensile` is how much of that it can actually swing in one
// press, and the tiers grow the two together at roughly four weight a cell:
// a build that fits its cap and busts its budget still fires, it just stops
// partway up, and the well wears a "!" to say so.
//
// The two STARTING bodies are sized against the shot their class flies in
// with plus one fitting on top of it (CLASS_LOADOUT, below), so nobody's first
// pickup can truncate the weapon they are already holding: the SHORTBOW's 9
// carries an ARROW (2) under anything, the SLING's 10 a BARBED SHOT (5) under
// a fitting of 5 - the two tier-2 fire fittings weigh 6 and still overrun it,
// which is a decision and a reason to want a bigger body.
const TOOLS = {
  shortbow: { name: 'SHORTBOW',    tier: 0, price: 30,  rof: 55, cap: 2, tensile: 9,  art: 'bow' },
  sling:    { name: 'SLING',       tier: 0, price: 26,  rof: 26, cap: 2, tensile: 10, art: 'sling' },
  // the one MELEE body: `melee` is what makes a press a CUT rather than a
  // shot (slashTool below) - `reach` px of blade at full draw, `half` rad of
  // sweep to either side of the aim. Every bit still loads and still counts:
  // what is fitted is what the edge is worth, and a modifier under it
  // rewrites the cut the way it rewrites a shot.
  longsword:{ name: 'LONGSWORD',   tier: 0, price: 28,  rof: 30, cap: 2, tensile: 10, art: 'sword', melee: { reach: 28, half: 1.05 } },
  recurve:  { name: 'RECURVE BOW', tier: 1, price: 85,  rof: 40, cap: 3, tensile: 13, art: 'recurve' },
  hornbow:  { name: 'HORN BOW',    tier: 1, price: 72,  rof: 34, cap: 4, tensile: 15, art: 'bow' },
  longbow:  { name: 'LONGBOW',     tier: 2, price: 170, rof: 28, cap: 5, tensile: 22, art: 'recurve' },
};
const TOOL_SLOTS = 1;        // ONE weapon slot: the class weapon, on the shelf top-left
const TOOL_ROF_STEP = 1 / 60; // a tool's `rof` is counted in game steps of this length

// ---- items: one bag entry per kind ---------------------------------------
// Namespaced keys ('tool:longbow', 'bit:flame') so a kind can never collide
// with a berry or a card. Registering here is what makes the bag, the drop
// pickup, the death spill and the "it does not fit" flash work on tools and
// bits with no code of their own - see checklists.md, "adding a carried item".
// A tool's stack is 1 because it is INSTANCED: its cell carries the bits
// loaded into it, so two of them are never the same object.
//
// A BIT STACKS TO 255, which is a deliberate "as many as you will ever find".
// A bit is ammunition for the build rather than a thing to ration: the pack's
// ten cells are for the CHOICE between kinds, and a cell that filled up at
// four made a run of arrows cost cells that a second kind of arrow wanted.
// The count still reads in three characters inside an 18px cell, which is the
// ceiling the number itself is picked against.
const BIT_STACK = 255;
function toolType(id) { return 'tool:' + id; }
function bitType(id) { return 'bit:' + id; }
function toolIdOf(type) { return type.startsWith('tool:') ? type.slice(5) : null; }
function bitIdOf(type) { return type.startsWith('bit:') ? type.slice(4) : null; }
function isToolCell(s) { return !!s && !!toolIdOf(s.type); }
function isBitCell(s) { return !!s && !!bitIdOf(s.type); }
// the def behind a cell, whichever kind it is
function toolDefOf(s) { const id = s && toolIdOf(s.type); return id ? TOOLS[id] : null; }
function bitDefOf(s) { const id = s && bitIdOf(s.type); return id ? BITS[id] : null; }
// what tier an item wears, for the plate behind its icon; -1 = not a tool item
function itemTier(type) {
  const t = toolIdOf(type); if (t) return TOOLS[t].tier;
  const b = bitIdOf(type); if (b) return BITS[b].tier;
  return -1;
}

// ---- a tool instance -----------------------------------------------------
// A tool in the bag, in a slot, or lying in the snow is the same object: a bag
// cell with a `bits` array of its own. Nothing ever copies it, which is why
// throwing a loaded tool away throws the bits with it.
function makeTool(id) {
  return { type: toolType(id), n: 1, bits: new Array(TOOLS[id].cap).fill(null) };
}
// the tool on the slot p is pointing at right now, or null
function heldTool(p) { return p.tools ? p.tools[p.toolSel] || null : null; }
// how many bit cells are filled - the pips the HUD counts
function bitsIn(cell) { let n = 0; for (const b of cell.bits) if (b) n++; return n; }
// what a tool is carrying, whatever it can afford to swing - every bit in it,
// modifiers included, since a fitting costs weight like anything else
function toolLoad(cell) {
  let w = 0;
  for (const id of cell.bits) if (id) w += BITS[id].weight;
  return w;
}
// ...and whether that is more than one press can spend. This is the "!" over
// the well (drawOverWarn, js/ui.js): the build still fires, it just stops
// partway along the row, and the shelf's budget track says where.
function toolOver(cell) { return toolLoad(cell) > TOOLS[toolIdOf(cell.type)].tensile; }
// a fresh shot envelope: what a press starts with before a single modifier
// has touched it. The damage TYPE is 'blunt' until a fire modifier says
// otherwise (DMG_TYPES, js/actions.js).
function newMods() {
  return {
    spdMul: 1, dmgMul: 1, dmgAdd: 0, lifeMul: 1, fan: 1, dup: 1, lit: 0,
    type: 'blunt', burn: 0, burnDps: 0, cinder: 0,
  };
}
// the envelope ONE modifier writes, on its own - what the tooltip prints, so
// a retuned FLAME can never disagree with its own panel
function bitMods(id) {
  const m = newMods();
  const b = BITS[id];
  if (b && !b.proj && b.mod) b.mod(m);
  return m;
}

// ONE ACTIVATION, RESOLVED IN A SINGLE PASS OVER THE CELLS: what fires, in
// what order, and through which envelope. This is the whole of the weapon's
// arithmetic, and the press, the aim line and the shelf all read it, so
// the three can never disagree about what the button is about to do.
//
// TENSILE IS A BUDGET, not a ceiling on one bit. It resets here at the top of
// every activation and is spent cell by cell from cell 0 up; the first cell
// whose weight would push the running total PAST it stops the activation
// there, and everything before it has already gone. So overloading a tool
// never jams it - it truncates it, and what falls off the end is whatever was
// hung last. Everything a press can afford leaves in the SAME frame: a tool
// whose budget covers all of it fires all of it at once.
//
// A MODIFIER APPLIES FORWARD AND ONLY FORWARD. Each projectile is fired
// through a SNAPSHOT of the envelope as it stood when that cell was reached,
// which is what makes "put the FLAME under the arrow" a real decision - and
// once a modifier is in the envelope it stays there for every shot after it
// in the same press. Two of a kind compound, because every `mod` composes
// with what it is handed (see BITS above).
//
// A shot also carries `mods`: the CELLS whose fittings shaped it, snapshotted
// beside the envelope they wrote. Nothing in the sim reads it - it is what the
// shelf draws its rails from (drawShelf, js/ui.js), so the picture of which
// fitting reaches which shot is read off the same pass that fires them and can
// never claim a rule the press does not follow.
function toolPlan(cell) {
  const T = TOOLS[toolIdOf(cell.type)];
  const m = newMods();
  const mi = [];
  const plan = { shots: [], spent: [], used: 0, cut: -1, load: 0, tensile: T.tensile };
  for (let i = 0; i < cell.bits.length; i++) {
    const id = cell.bits[i];
    if (!id) continue;                 // a gap costs nothing and stops nothing
    const b = BITS[id];
    plan.load += b.weight;             // the load is the WHOLE column: it is what the "!" reads
    if (plan.cut >= 0) continue;       // past the cut: still carried, never fired
    if (plan.used + b.weight > T.tensile) { plan.cut = i; continue; }
    plan.used += b.weight;
    plan.spent.push(i);                // ...and what it spent it ON, for the shelf to light

    if (b.proj) plan.shots.push({ id, i, m: Object.assign({}, m), mods: mi.slice() });
    else if (b.mod) { b.mod(m); mi.push(i); }
  }
  return plan;
}
// what the next press puts in the air FIRST - the lead shot, which is what
// the shelf's gold bar marks and what the aim line is drawn for. -1 when the
// press would put nothing in the air at all.
function peekBit(cell) {
  const s = toolPlan(cell).shots;
  return s.length ? s[0].i : -1;
}
// seconds between shots: the tool's own rate, quickened by everything that
// already quickens a renock (QUICKDRAW, QUICK HANDS, the renock cards)
function toolRof(p, cell) {
  return TOOLS[toolIdOf(cell.type)].rof * TOOL_ROF_STEP * (kitOf(p).nock / BOW_NOCK);
}
// The cycle a press starts, for THIS player right now: the held tool's rate,
// or bare hands' (`kit.nock`) with no tool up. The one number every readout of
// the cooldown divides `p.nockT` by - the well's wipe, the reticle's marks and
// the overhead slate bar - and the one number every press sets it to, so no
// meter can ever show a cooldown a different length from the one running.
function toolCycle(p) {
  const cell = heldTool(p);
  return cell ? toolRof(p, cell) : kitOf(p).nock;
}

// Can the button do anything at all right now? A slot with no tool in it and a
// tool whose budget reaches no projectile - nothing loaded, only modifiers, or
// a first cell already too heavy for the body - are both dry, and updatePlayer
// refuses the draw on both the same way. The cycle (`nockT`) is the ONLY other
// gate: the moment the well's wipe clears, the draw can begin.
function toolReady(p) {
  const cell = heldTool(p);
  return !!cell && peekBit(cell) >= 0;
}

// ---- the draw ------------------------------------------------------------
// How far back the string is: `chargeT` over the kit's full draw, 0..1. It
// scales the shot three ways at once - how far it flies, how fast, and how
// hard it lands - on straight lines from a floor to the bit's own numbers, so
// the meter over the head, the ring closing on the cursor and the aim line
// growing out of the bow all read the same quantity. A tap still fires, at
// every floor; that is the whole punishment for spamming the button - short,
// slow and weak, with the tool's cycle still to run before the next - and it
// is dealt by the shot itself rather than by a counter. `shotFlight` is the
// envelope emitBit fires through AND the one drawAimLine measures, so the line
// on the ground is the flight, never an estimate of it.
const DRAW_RANGE_MIN = 0.22; // a tap flies this fraction of the bit's full flight
const DRAW_SPEED_MIN = 0.6;  // at this fraction of its speed
const DRAW_DMG_MIN = 0.3;    // for this fraction of its damage (the whole sum: bit, kit, level)
function drawPow(p) { return Math.min(1, Math.max(0, p.chargeT / kitOf(p).bowCharge)); }
function drawSpeedMul(pw) { return DRAW_SPEED_MIN + (1 - DRAW_SPEED_MIN) * pw; }
function drawRangeMul(pw) { return DRAW_RANGE_MIN + (1 - DRAW_RANGE_MIN) * pw; }
function drawDmgMul(pw) { return DRAW_DMG_MIN + (1 - DRAW_DMG_MIN) * pw; }
// speed (px/s) and life (s) a bit leaves this tool with at this draw - the
// modifiers' envelope `m` folded in, the range curve applied through the life
// so a slow tap also stops short instead of just arriving late
function shotFlight(b, m, pw) {
  const sm = drawSpeedMul(pw);
  return { spd: b.speed * m.spdMul * sm, life: b.life * m.lifeMul * drawRangeMul(pw) / sm };
}
// ---- equipping -----------------------------------------------------------
// Every move of a tool or a bit goes through these two, so a cell is never in
// two places at once. Both return the thing displaced, for the caller to put
// somewhere (the drag drops it back where it came from).
function slotPut(p, i, cell) {
  const was = p.tools[i];
  p.tools[i] = cell || null;
  return was;
}
function bitPut(cell, i, id) {
  const was = cell.bits[i];
  cell.bits[i] = id || null;
  return was;
}

// ---- a find arms itself ---------------------------------------------------
// THE PACK IS THE OVERFLOW, NOT THE DESTINATION. A bit picked up off the snow
// (or bought over the counter) walks into the tool's first free cell, and only
// what the tool cannot hold goes into the grid - so the ordinary way to arm a
// find is to walk over it, and the drag is what you reach for to ARRANGE a
// build rather than what you must do to have one. The shelf over the pack
// (js/ui.js) is where it lands, which is half of why that shelf is on screen
// at all times: a bit that loaded itself has to be seen loading itself.
//
// It fills a free cell whatever the tensile budget says. A bit the press
// cannot afford stops that press where it sits rather than jamming it
// (toolPlan), the shelf draws the cell red and washed out, and one click sends
// it back to the pack - so an unaffordable find is visible and undone in a
// click, and the pickup never has to guess what you meant by it.
//
// A BOT IS LEFT OUT: botFitLoadout below does this for them on its own timer
// and is choosier than this - it will not load a boomerang it cannot aim, and
// it builds INSIDE the budget - so a pickup that shoved a bit into a bot's
// tool would only make it a worse shot.
//
// EVERY TOOL YOU CARRY IS A DESTINATION (3.23): the one in hand first, then
// each tool lying in the pack in cell order, so a bit only ever takes a cell
// of its own once every weapon you own is full - the pack is one row now,
// and a row of loose bits beside tools with empty cells was the row wasted.
function autoFitTools(p) {
  if (p.control !== 'human') return [];
  const out = [];
  const held = heldTool(p);
  if (held) out.push(held);
  for (const s of p.bag) if (s && s.bits) out.push(s);
  return out;
}
// how many free cells those tools are offering for `type`, which is room on
// top of whatever the pack will take: every path that hands a player an item
// asks through here, so a FULL PACK with an empty cell in a tool still
// magnetises a drop and still claims it
function fitRoom(p, type) {
  let n = 0;
  if (bitIdOf(type)) for (const cell of autoFitTools(p)) for (const b of cell.bits) if (!b) n++;
  return bagRoom(p, type) + n;
}
// ...and the transfer: the tools first, the pack with the remainder. Returns
// how many were taken, exactly as bagAdd does.
function fitAdd(p, type, n) {
  const id = bitIdOf(type);
  let got = 0, free;
  if (id) for (const cell of autoFitTools(p)) {
    while (got < n && (free = cell.bits.indexOf(null)) >= 0) { bitPut(cell, free, id); got++; }
  }
  return got + bagAdd(p, type, n - got);
}

// ---- a tool that lands in the snow arrives bare ---------------------------
// A DISCARDED WEAPON SHEDS ITS BUILD. The body and its fittings part company
// the moment the tool hits the ground: every loaded bit comes out as its own
// drop, flung along whatever threw the tool plus a kick of its own, so what
// lies in the snow is a bare body in a scatter of bits rather than one pickup
// carrying somebody else's finished weapon.
//
// It is the counterweight to the pack being the OVERFLOW (fitAdd above). A
// find arms itself on the way in, so getting rid of a tool had become the way
// to move a whole build in one gesture - and a body picked off the snow that
// arrives already built is the one pickup nobody has to think about. Now the
// bits are still all there, in reach, one walk apart: it costs a moment, not
// the build.
//
// The tool INSTANCE is untouched by any of this - the same object still moves
// bag to snow to bag (CLAUDE.md's hard rule); it is emptied here on purpose,
// where it is thrown, rather than quietly rebuilt from its type name later.
// `gone` sheds the row into thin air instead of onto the snow: the bits of a
// tool that is itself evaporating (evaporateTool, below) still scatter, so
// the spill looks like a spill, and then go with it.
const SHED_KICK = 80;   // px/s of a shed bit's own, off the throw's heading
function shedBits(cell, x, y, hx, hy, p, gone) {
  if (!cell || !cell.bits) return 0;
  const m = Math.hypot(hx || 0, hy || 0) || 1;
  const ux = (hx || 0) / m, uy = (hy || 0) / m;
  let n = 0;
  for (let i = 0; i < cell.bits.length; i++) {
    const id = cell.bits[i];
    if (!id) continue;
    cell.bits[i] = null;
    n++;
    const a = rng() * Math.PI * 2;
    const d = flingDrop(spawnDrop(x, y, bitType(id), 1),
      ux * TOSS_SPEED + Math.cos(a) * SHED_KICK,
      uy * TOSS_SPEED + Math.sin(a) * SHED_KICK);
    if (gone) vanishDrop(d);           // a starting tool's build goes with it
    else if (p) lockDrop(d, p);        // what you threw away stays thrown away for a moment
  }
  return n;
}

// ---- a starting tool does not litter the snow ----------------------------
// A KILL SHOULD NOT LEAVE A SHORTBOW. Every player flies in with its class's
// tool (CLASS_LOADOUT, below) and is handed the same one back at the bird on
// every respawn, so a body spilling one puts a weapon on the ground that
// NOBODY will ever stoop for - and ground fought over twice is ground carpeted
// in them. The test is the tool itself rather than a list of names: STARTER_CAP
// bit cells or fewer is the bottom of the table (shortbow and sling, cap 2),
// which is exactly what the two classes fly in with, so a tier a later table
// adds under them is covered on the day it is added.
//
// It is a DEATH rule, not a tool rule. Dragged out of the pack on purpose it
// still lands and still lies there (throwCell, js/ui.js) - you may hand a
// teammate your sling, and a starting tool the world rolled as loot (dropLoot)
// is an ordinary find. Only what falls off a body evaporates.
const STARTER_CAP = 2;   // bit cells at or under which a tool is starting kit
function isStarterTool(s) { const d = toolDefOf(s); return !!d && d.cap <= STARTER_CAP; }
// ...and how it goes: the build scatters and thins out, then the bare body
// does, all of it out of reach the whole way (vanishDrop, js/core.js)
function evaporateTool(cell, x, y) {
  shedBits(cell, x, y, 0, 0, null, true);
  vanishDrop(spawnDrop(x, y, cell.type, 1, cell));
}

// ---- a better body takes the build with it --------------------------------
// A FIND THAT IS STRICTLY BETTER SWAPS ITSELF INTO THE HAND. Two conditions,
// both hard: the find's TIER is higher than what is held, and its `cap` is at
// least as big, so nothing already loaded is left with nowhere to sit. Then
// the bits move across CELL FOR CELL - the row's order IS the build, and a
// modifier that landed behind the shots it was in front of would be worth
// nothing - and the old body is treated exactly as the find was: into the
// pack, or into the snow it was lying in if the pack is full.
//
// It is the one place the weapon changes with no hand on it, which is why it
// carries a tell of its own (swapFx below). And it is not a courtesy for the
// local human: a bot walking over a longbow trades up on the same rule,
// through the same two functions, so the roster stays honest.
function toolUpgrade(p, cell) {
  if (!isToolCell(cell)) return false;
  const cur = heldTool(p);
  if (!cur) return false;            // an empty hand is an ordinary pickup
  const A = TOOLS[toolIdOf(cur.type)], B = TOOLS[toolIdOf(cell.type)];
  return !!A && !!B && B.tier > A.tier && B.cap >= A.cap;
}
// ...and doing it. Returns the body that came off, for the caller to file.
function takeUpgrade(p, cell) {
  const cur = heldTool(p);
  for (let i = 0; i < cur.bits.length; i++) { cell.bits[i] = cur.bits[i]; cur.bits[i] = null; }
  slotPut(p, p.toolSel, cell);
  swapFx(p, cell);
  return cur;
}
// AN UPGRADE THAT HAPPENS TO YOU HAS TO BE SEEN HAPPENING, and seen by
// everyone: a rival trading up mid-fight is news to whoever is shooting at
// them. So the tell is in the WORLD first - the new body's own icon rises out
// of the player inside a spray of its tier's colour - and on the shelf second,
// where the whole row lights in that same tier ink for a long beat, tool cell
// included, because the row is what actually changed.
const SWAP_T = 1.1;      // s the risen icon lives
const SWAP_RISE = 26;    // px it climbs over that
const swaps = [];        // { x, y, type, tier, t } - drawn by drawSwaps, js/render.js
function swapFx(p, cell) {
  const T = TOOLS[toolIdOf(cell.type)];
  swaps.push({ x: p.x, y: p.y - 10, type: cell.type, tier: T.tier, t: 0 });
  burst(p.x, p.y - 8, TOOL_TIERS[T.tier].ink, 14, 70, 0.6);
  burst(p.x, p.y - 8, TOOL_TIERS[T.tier].rim, 8, 40, 0.85);
  if (p === player) {
    const cells = [-1];  // the tool well leads the row (shelfCellRect, js/ui.js)
    for (let i = 0; i < cell.bits.length; i++) if (cell.bits[i]) cells.push(i);
    bitLit = { cell, cells, t: SWAP_T, col: TOOL_TIERS[T.tier].ink };
    SFX.levelUp();
  } else if (nearPlayer(p.x, p.y)) SFX.pickup();
}
function updateSwaps(dt) {
  for (let i = swaps.length - 1; i >= 0; i--) if ((swaps[i].t += dt) > SWAP_T) swaps.splice(i, 1);
}

// ---- what a tool fires ---------------------------------------------------
// One press = one activation of the selected tool, resolved in ONE frame:
// toolPlan spends the tool's tensile budget along the row and every shot it
// can afford leaves together. The tool's rate of fire sets the gap to the next
// press (toolRof) and the draw sets what each shot is worth (`the draw` above).
// Nothing cycles between presses any more - a press is the whole tool.
// WHAT THE PRESS SPENT, LIT ON THE SHELF. A build is fired far more often than
// it is edited, so the press itself is where the column is learned: every cell
// the activation paid for - the shots AND the fittings that shaped them -
// flashes together for BIT_LIT_T, and the rails between them flash with it, so
// one click of the left button says "these three went, and that flame is why".
// It is the local player's alone (nothing else has a shelf on screen), it is
// held by REFERENCE to the tool that fired, so swapping weapons cannot leave a
// flash on somebody else's cells, and updateFx ages it on wall time beside the
// refusal reds.
// TWO EVENTS RIDE THIS ONE FLASH. The press, white, for BIT_LIT_T - and the
// TOOL SWAP above, which lights the whole row (cell -1, the tool well,
// included) in the new tier's ink for the longer SWAP_T. `col` is what tells
// them apart on screen, and the tool cell is what tells them apart at a
// glance: a press never lights it.
const BIT_LIT_T = 0.3;
// { cell, cells: [i...], t, col } - `col` overrides the press's white, which
// is what lets the tool swap (swapFx above) borrow the same flash in its own
// tier ink for a longer beat. Cell -1 is the TOOL well, the shelf's own index.
let bitLit = null;
// how lit cell i of `cell` is, 1 at the loose and 0 by the end of the flash.
// CLAMPED: a longer-lived flash than the press's rides this same ramp, and an
// alpha over 1 is a value the canvas silently ignores rather than clips.
function bitLitAt(cell, i) {
  if (!bitLit || bitLit.cell !== cell || bitLit.cells.indexOf(i) < 0) return 0;
  return Math.min(1, bitLit.t / BIT_LIT_T);
}
// ...and in what colour: white for a press, the tier's ink for a swap
function bitLitCol() { return (bitLit && bitLit.col) || '#f4f7ff'; }
function fireTool(p) {
  cancelCatch(p); // a press is a press: the hoist gives way to the shot (the spear below re-starts it on a catch)
  // the cover is read before anything below can break it - the ambush shot is
  // what the crawl in was for, whatever bit is loaded
  const amb = ambushReady(p);
  const cell = heldTool(p);
  if (!cell) { dryFire(p); return; }          // an empty slot has nothing to press
  const plan = toolPlan(cell);
  if (!plan.shots.length) { dryFire(p); return; } // pressed a tool that cannot answer
  if (p === player) bitLit = { cell, cells: plan.spent, t: BIT_LIT_T };
  const T = TOOLS[toolIdOf(cell.type)];
  if (T.melee) {
    // a blade: the same press, the same plan, the same cycle - but the bits
    // are swung, not thrown (slashTool below)
    slashTool(p, cell, plan, T.melee, amb);
  } else {
    // the index into the volley is the skew off the aim, so no two bits of one
    // press leave inside each other
    plan.shots.forEach((s, k) => emitBit(p, BITS[s.id], s.id, s.m, amb, k));
    if (nearPlayer(p.x, p.y)) SFX.arrow();
  }
  p.nockT = toolRof(p, cell);
  // the loose is what breaks cover - one ambush per burrow, then you are a
  // player lying in the open with a tool that still has to cycle
  risePlayer(p);
}

// Every bit a press can afford leaves in the SAME frame, so no two of them may
// be stacked inside one another: each one past the first is nudged a hair off
// the aim, alternating sides, which is what makes a full tool read as a volley
// rather than as one very thick arrow. It is per BIT and per DUPLICATE, never
// per arm of a fan - SPLITTER already spreads its own arms, and skewing those
// as well would drag one side of the spread out with it.
const SHOT_SKEW = 0.05; // rad between one bit of an activation and the next
const DUP_SKEW = 0.07;  // ...and between a DUPLICATE's repeats of one bit
function offBy(k, step) { return k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step : 0; }

// One projectile bit, put into the air, through the envelope the modifiers
// UNDER it wrote (toolPlan's snapshot). `seq` is this bit's place in the
// activation, which is all its skew off the aim is. SPLITTER fans one bit into
// `m.fan` arms and DUPLICATE fires the whole fan `m.dup` times over, and the
// two multiply because both compound.
function emitBit(p, b, id, m, amb, seq) {
  const kit = kitOf(p);
  const pw = drawPow(p);
  const spdBonus = kit.spdDmg * Math.min(1, Math.hypot(p.vx, p.vy) / 200);
  // aim from the spawn point (BOW_Y above the feet), not the feet: otherwise
  // the flight runs parallel to the aim line and never meets it
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y);
  const base = Math.atan2(dy, dx);
  // the bit is what is being thrown: its own numbers lead, and the champion
  // kit, the hero level and the modifiers are what the player brought to it.
  // Then the draw scales the whole sum (drawDmgMul): a full draw is worth
  // every point of it, a tap DRAW_DMG_MIN of it - the flat kit and level
  // bonuses included, so a spammed level-twelve bow is still a weak one
  let dmg = (b.dmg + kit.dmgPow * pw * 0.5 + kit.dmgBase + spdBonus + LVL_DMG * (p.level - 1)) * drawDmgMul(pw);
  dmg = Math.round(dmg * m.dmgMul + m.dmgAdd);
  if (amb) dmg = Math.round(dmg * kit.ambushMul);
  const { spd, life } = shotFlight(b, m, pw);
  const lit = Math.max(b.lit || 0, m.lit);
  // SPLITTER turns one bit into a fan and DUPLICATE fires the whole fan
  // again; every other shot is one arm, once
  const arms = m.fan, reps = m.dup;
  const spread = 0.16;
  const skew = offBy(seq, SHOT_SKEW);   // this bit's own place in the volley
  for (let d = 0; d < reps; d++) for (let k = 0; k < arms; k++) {
    const a = base + (arms > 1 ? (k - (arms - 1) / 2) * spread : 0) + skew + offBy(d, DUP_SKEW);
    arrows.push({
      x: p.x, y: p.y - BOW_Y,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      t: 0, life, dmg, pow: pw,
      owner: p.id, team: p.team,
      ambush: amb,
      trailD: 0,
      // what makes this a bit rather than the old arrow: how it flies, what
      // stops it, who it is allowed to hurt, and what it leaves behind
      bit: id, path: b.path, solid: b.solid !== false, ff: !!b.ff,
      lit, col: b.col,
      // how hard it shoves what it lands on (1 = the ordinary blow), how far
      // past the tip its body reaches, what the shots pass draws it as, and
      // what it does where it stops - see the four optional fields on BITS
      kb: b.kb === undefined ? 1 : b.kb, reach: b.reach || 0,
      body: b.body || null, impact: b.impact || null,
      // what it does when it lands: the damage type, the fire it leaves in
      // the body, and the ring it sets alight where it ends
      type: m.type, burn: m.burn, burnDps: m.burnDps, cinder: m.cinder,
      ang: a, spd, ox: p.x, oy: p.y - BOW_Y,
    });
  }
  if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
  else p.dir = dy > 0 ? 'down' : 'up';
}

// ---- the cut -------------------------------------------------------------
// A melee tool's press. The draw is still the throttle - a tap is a short,
// weak cut and a full draw the whole blade at its whole worth (SLASH_REACH_MIN
// is the reach floor, drawDmgMul the damage's) - and every bit in the plan is
// one cut of the same swing: its damage through emitBit's own sum, its
// modifiers' damage type and fire on every body the edge reaches. What the
// edge reaches is the WEDGE (inCone, js/actions.js) and nothing else: a body
// behind the caster is never cut, and the sweep left on the snow (`slashes`,
// drawn by drawSlashes in js/render.js) is that exact wedge, so what a rival
// saw is what hit them. A bit whose whole point is its flight - a boomerang,
// a lob, an orbit - swings as a plain cut worth its damage; the sword is a
// place the fittings you found can still go, not a second arsenal.
const SLASH_T = 0.28;        // s the sweep lives on the snow - and the hand swings the blade through it
const SLASH_REACH_MIN = 0.6; // a tap reaches this fraction of the blade
const slashes = [];          // {x, y, a, r, half, t, hit}
function slashReach(melee, pw) { return melee.reach * (SLASH_REACH_MIN + (1 - SLASH_REACH_MIN) * pw); }
function slashTool(p, cell, plan, melee, amb) {
  const kit = kitOf(p);
  const pw = drawPow(p);
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y);
  const a = Math.atan2(dy, dx);
  const r = slashReach(melee, pw);
  const spdBonus = kit.spdDmg * Math.min(1, Math.hypot(p.vx, p.vy) / 200);
  const targets = unitsInCone(p, p.x, p.y, a, r, melee.half);
  const walls = structsInCone(p, p.x, p.y, a, r, melee.half);
  for (const s of plan.shots) {
    const b = BITS[s.id], m = s.m;
    let dmg = (b.dmg + kit.dmgPow * pw * 0.5 + kit.dmgBase + spdBonus + LVL_DMG * (p.level - 1)) * drawDmgMul(pw);
    dmg = Math.round(dmg * m.dmgMul + m.dmgAdd);
    if (amb) dmg = Math.round(dmg * kit.ambushMul);
    const kb = b.kb === undefined ? 1 : b.kb;
    for (const q of targets) {
      const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      hurtUnit(q, dmg, (q.x - p.x) / d, (q.y - p.y) / d, p, {
        type: m.type, burn: m.burn, burnDps: m.burnDps, ambush: amb, kb: 30, kbMul: kb,
      });
      burst(q.x, unitMidY(q), '#eef4fb', 4, 40, 0.3, true);
    }
    for (const w of walls) hurtStruct(w, dmg, p);
    // the practice dummy: the wedge's far half is where a dummy stands to be hit
    if (PRACTICE) abHitDummies(p.x + Math.cos(a) * r * 0.5, p.y + Math.sin(a) * r * 0.5, r * 0.5, dmg);
  }
  slashes.push({ x: p.x, y: p.y - 2, a, r, half: melee.half, t: 0, hit: targets.length > 0 });
  p.slashT = SLASH_T; p.slashA = a; p.slashHalf = melee.half; // the hand swings the blade through the same arc (drawHeldTool)
  if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
  else p.dir = dy > 0 ? 'down' : 'up';
  if (targets.length && (p === player || targets.includes(player))) state.shake = Math.max(state.shake, 2);
  if (nearPlayer(p.x, p.y)) { SFX.swing(); if (targets.length) SFX.hit(); }
}
function updateSlashes(dt) {
  for (let i = slashes.length - 1; i >= 0; i--) {
    slashes[i].t += dt;
    if (slashes[i].t >= SLASH_T) slashes.splice(i, 1);
  }
}

// Fishing is the hands working on their own, like a tree in reach
// (autoWork, js/actions.js): standing on ice with a fish inside FISH_CATCH_R
// takes it through the sheet with no press - once every FISH_AUTO_CD, so a
// walk along a shoal is a stride per fish, not a vacuum. It never touches
// the tool: no cycle is spent, a draw runs on under it, and the press that
// used to spear now flies like any other. Nothing can refuse the catch: fish
// are a POUCH kind and take no bag cell (the `inventory` banner, js/player.js).
// Two players can reach one fish in a step, so it is contested, not first-come.
const FISH_AUTO_CD = 1.2;
function autoFish(p, dt) {
  p.fishCd = Math.max(0, p.fishCd - dt);
  if (p.fishCd > 0 || p.fallT > 0 || p.dodgeT > 0 || p.stunT > 0 || inAir(p)) return;
  const ftx = Math.floor(p.x / TILE), fty = Math.floor((p.y + 4) / TILE);
  if (!inWorld(ftx, fty) || ground[idx(ftx, fty)] !== 1) return;
  let bi = -1, bd = FISH_CATCH_R;
  for (let i = 0; i < fish.length; i++) {
    if (!fish[i].born) continue; // still swimming in from under the shore
    const d = Math.hypot(fish[i].x - p.x, fish[i].y - p.y);
    if (d < bd) { bd = d; bi = i; }
  }
  if (bi < 0) return;
  const f = fish[bi];
  p.fishCd = FISH_AUTO_CD;
  contest('fish:' + bi, p, () => {
    const j = fish.indexOf(f);
    if (j < 0) return;
    fish.splice(j, 1);
    bagAdd(p, 'fish', 1);
    startCatch(p);
    addFloater(f.x, f.y - 10, 'FISH!', '#7ac0e8');
    burst(f.x, f.y, '#9fc4dd', 8, 45, 0.45, true);
    burst(f.x, f.y, '#ddf1f8', 5, 35, 0.4, true);
    if (nearPlayer(f.x, f.y)) { SFX.splash(); SFX.stash(); }
  });
}

// The catch is a pose the body performs - CATCH_STOOP s bent to the hole,
// CATCH_HAUL s with the fish coming up, then the trophy hoist for the rest of
// CATCH_T - three DOWN-facing frames whatever the body was facing
// (classSet(p).catch, drawn by drawPlayer). It is shown only by a body that
// is standing still anyway: a step, a fresh press, a roll, a cast, a swing,
// a meal or a hit drops it at once (cancelCatch, from updatePlayer and
// damagePlayer), because an automatic catch may never hold the player.
// A net hands its first fish up the same way (updateStructures, js/structures.js).
const CATCH_T = 2, CATCH_STOOP = 0.16, CATCH_HAUL = 0.22;
function startCatch(p) { p.catchT = CATCH_T; }
function cancelCatch(p) { p.catchT = 0; }
// which catch frame the body is on: 0 stoop, 1 haul, 2 hoist, -1 not catching
function catchFrame(p) {
  if (p.catchT <= 0) return -1;
  const t = CATCH_T - p.catchT;
  return t < CATCH_STOOP ? 0 : t < CATCH_STOOP + CATCH_HAUL ? 1 : 2;
}

// ---- how a bit flies -----------------------------------------------------
// Called once per shot per sim step, BEFORE the step is integrated, so the
// path owns the velocity and everything downstream (the trail, the hit tests,
// the drawn body) just follows it. 'line' is the old arrow and costs nothing.
const ORBIT_R = 46;    // px the wisp circles its shooter at
const LOB_DRAG = 0.55; // per second: how fast a thrown log gives up its speed
const LOB_FALL = 210;  // px/s^2 the same log is pulled down at
const CURVE_TURN = 3.4; // rad/s a thrown axe's bearing sweeps, always the one way
// THE BOOMERANG, as one continuous curve. It flies out bleeding speed down to
// BOOM_SLOW - never to nothing, because a shot that stops dead reads as a
// bounce rather than a turn - and then BANKS: the bearing is swung toward the
// thrower a little each step instead of snapped onto them, so the velocity
// never jumps and the shot carves a teardrop, coming home along the outside
// of its own path.
//
// Every number here is a FRACTION of the flight rather than a count of
// seconds, which is what keeps the shape the same at every draw: the half
// turn is allowed BOOM_SWING of the life whatever that life is (a tap's
// quarter-second loop and a LONGSHOT's three-second sweep are the same
// picture at different sizes), and because the turn rate is a rate and the
// speed is a speed, the ARC widens on its own for a fast shot and tightens
// for a slow one.
//
// AND IT ALWAYS COMES HOME. The return builds speed back to full, and is
// floored at whatever pace actually closes the gap by BOOM_SPARE of the life
// - a fixed deadline, not a rolling one, or the target recedes as fast as the
// shot chases it and the loop lands on the last frame every time. That floor
// is only spent once the shot is roughly POINTED home (BOOM_ALIGN), since
// speed spent mid-turn only widens the arc it has to fly back out of, and it
// is capped at BOOM_RUSH so a sprinting owner is chased rather than snapped
// to. The flight ends at the hand (BOOM_HOME_R) or at the end of its life,
// whichever comes first: it never trails a walking owner around the map.
const BOOM_OUT = 0.24;   // of life spent flying out before the bank begins
const BOOM_SLOW = 0.3;   // of speed left at the top of the turn
const BOOM_SWING = 0.4;  // of life a full half turn is allowed to take, at range
const BOOM_BITE = 1.8;   // ...but never an arc wider than this fraction of the gap
const BOOM_ALIGN = 2;    // rad off home the catch-up pace starts being spent
const BOOM_SPARE = 0.85; // of the life the return aims to be home by
const BOOM_RUSH = 2.2;   // ceiling on the return's catch-up speed, x the bit's own
const BOOM_HOME_R = 10;  // px from the thrower's hand the flight ends at - or the
                         // step just taken, whichever is wider, so a fast shot
                         // in a long frame cannot stride straight over the hand
function steerBit(a, dt) {
  if (!a.path || a.path === 'line') return;
  if (a.path === 'lob') {
    a.vx *= Math.pow(LOB_DRAG, dt);
    a.vy = a.vy * Math.pow(LOB_DRAG, dt) + LOB_FALL * dt;
    return;
  }
  if (a.path === 'curve') {
    // a scythe: the bearing sweeps steadily one way, so the head carves an arc
    // out of the bearing it was thrown on instead of holding it
    a.ang += CURVE_TURN * dt;
    a.vx = Math.cos(a.ang) * a.spd; a.vy = Math.sin(a.ang) * a.spd;
    return;
  }
  if (a.path === 'boomer') {
    const o = players[a.owner];
    const u = Math.min(a.t / a.life, 1);
    // the throw: speed bleeds off to BOOM_SLOW and holds there through the turn
    let spd = a.spd * (u < BOOM_OUT ? 1 - (1 - BOOM_SLOW) * (u / BOOM_OUT) : BOOM_SLOW);
    if (u >= BOOM_OUT && o) {
      const dx = o.x - a.x, dy = (o.y - BOW_Y) - a.y, d = Math.hypot(dx, dy) || 1;
      // BANK, never snap: the bearing turns the short way toward home by at
      // most this step's share of the swing, which is what makes the arc an arc
      let df = (Math.atan2(dy, dx) - a.ang) % (Math.PI * 2);
      if (df > Math.PI) df -= Math.PI * 2;
      if (df < -Math.PI) df += Math.PI * 2;
      // The swing tightens as the hand nears. A wide arc reads beautifully at
      // range, but a wide arc ten px out is an ORBIT around the thrower that
      // never lands - a circle of radius r cannot curve into anything closer
      // than r - so the turn is also never slower than the rate that holds
      // that radius inside the gap left (r <= d / BOOM_BITE). At range this
      // term is nothing and BOOM_SWING owns the shape; on the doorstep it is
      // the whole of the guidance, and it is what makes the loop CLOSE.
      const w = Math.max(Math.PI / (a.life * BOOM_SWING), BOOM_BITE * Math.hypot(a.vx, a.vy) / d);
      const turn = w * dt;
      a.ang += df > turn ? turn : df < -turn ? -turn : df;
      // the return builds back up to full speed...
      spd = a.spd * (BOOM_SLOW + (1 - BOOM_SLOW) * (u - BOOM_OUT) / (1 - BOOM_OUT));
      // ...and once it is pointed home, never below the pace that closes the
      // gap by the deadline. This is the whole of the guarantee.
      if (Math.abs(df) < BOOM_ALIGN) spd = Math.max(spd, d / Math.max(a.life * BOOM_SPARE - a.t, 1e-3));
      spd = Math.min(spd, a.spd * BOOM_RUSH);
      if (d <= Math.max(BOOM_HOME_R, spd * dt)) a.t = a.life + 1; // caught: the loop retires it this step
    }
    a.vx = Math.cos(a.ang) * spd; a.vy = Math.sin(a.ang) * spd;
    return;
  }
  if (a.path === 'orbit') {
    // a ring around the shooter, kept at ORBIT_R and swept at its own speed
    const o = players[a.owner];
    if (!o) return;
    const cx = o.x, cy = o.y - BOW_Y;
    const ang = Math.atan2(a.y - cy, a.x - cx) + (a.spd / ORBIT_R) * dt;
    const r = a.t < 0.25 ? ORBIT_R * (a.t / 0.25) : ORBIT_R;
    const nx2 = cx + Math.cos(ang) * r, ny2 = cy + Math.sin(ang) * r;
    a.vx = (nx2 - a.x) / Math.max(dt, 1e-4);
    a.vy = (ny2 - a.y) / Math.max(dt, 1e-4);
  }
}

// ---- the tech tree -------------------------------------------------------
// Every tool and every bit is a node, and every node is UNLOCKED. The world
// is allowed to drop the whole arsenal for anybody, so a profile on its first
// flight rolls exactly what one a hundred matches old rolls: nothing here is
// earned, priced or spent, and a match reads nothing back out of a profile.
// The tree is the PICTURE of the arsenal - lineages of at most three, each
// kind beside the kinds it is a step from - and `seen`, "this profile has
// held one of these", is the one mark on it that is about you rather than
// about the arsenal. It gates nothing; it is a record of what you have
// actually met in the snow.
//
// Storage is js/profile.js and nothing here writes a key.
// The tree, in draw order down each tier column. `req` is the node beneath
// this one - null on the tier-0 row - and is the only edge in the graph, so
// the picture and the lineage are the same thing.
const TECH = [
  // tier 0: the roots every branch grows out of
  { id: 'tool:shortbow', req: null },
  { id: 'tool:sling',    req: null },
  { id: 'tool:longsword', req: null },
  { id: 'bit:arrow',     req: null },
  { id: 'bit:barb',      req: null },
  { id: 'bit:hook',      req: null },
  { id: 'bit:speedup',   req: null },
  { id: 'bit:fan',       req: null },
  { id: 'bit:fist',      req: null },
  // tier 1: one step off a root
  { id: 'tool:recurve',  req: 'tool:shortbow' },
  { id: 'tool:hornbow',  req: 'tool:sling' },
  { id: 'bit:care',      req: 'bit:arrow' },
  { id: 'bit:wisp',      req: 'bit:hook' },
  { id: 'bit:log',       req: 'bit:barb' },
  { id: 'bit:flame',     req: 'bit:speedup' },
  { id: 'bit:twin',      req: 'bit:fan' },
  { id: 'bit:axe',       req: 'bit:fist' },
  // tier 2: the end of each branch
  { id: 'tool:longbow',  req: 'tool:recurve' },
  { id: 'bit:lance',     req: 'bit:care' },
  { id: 'bit:heft',      req: 'bit:log' },
  { id: 'bit:longshot',  req: 'bit:wisp' },
  { id: 'bit:pyre',      req: 'bit:flame' },  // the fire line, escalated
  { id: 'bit:cinder',    req: 'bit:twin' },   // ...and the multiplying line, ending in one
  { id: 'bit:warp',      req: 'bit:axe' },    // ...and the closing line, which stops throwing the blow and throws YOU
];
const TECH_BY_ID = {};
for (const n of TECH) TECH_BY_ID[n.id] = n;
// "this profile has held one of these" - fired from the local player's pickup
// and from the loadout they fly in with, and nothing reads it but the tree
function noteSeen(p, type) {
  if (p === player && TECH_BY_ID[type]) PROFILE.markSeen(type);
}

// ---- loot: what the world pays out --------------------------------------
// Tools and bits are found FIRST and bought SECOND - the merchant's counter
// (js/shop.js) rotates a handful of them every couple of minutes, and this
// is the other, older way in. A broken rock is the common source and
// a felled tree the rare one, both rolling on the shared rng at the moment the
// swing lands (never inside genWorld - see the seed rule in CLAUDE.md). Only
// the bottom tier lies around loose; the good stuff is in the chests.
const ROCK_DROP = 0.2;   // 1 in 5 broken rocks
const TREE_DROP = 0.04;  // 1 in 25 felled trees
const CHEST_TOOL = 0.75; // ...and three in four sprung chests, at the TOP tier
const LOOT_TOOL = 0.3;   // this share of any of those is a tool, the rest bits
// Every kind at or under `tier`, split into the two pools. The whole arsenal
// is unlocked, so this is one list per tier built at boot rather than a filter
// run per roll - a drop happens in the middle of a swing. The array itself is
// never replaced - dropLoot holds it.
const LOOT_POOL = [];
function rebuildLootPool() {
  LOOT_POOL.length = 0;
  for (let t = 0; t < TOOL_TIERS.length; t++) {
    LOOT_POOL.push({
      tools: Object.keys(TOOLS).filter((k) => TOOLS[k].tier <= t),
      bits: Object.keys(BITS).filter((k) => BITS[k].tier <= t),
    });
  }
}
// Rolls one find at `tier` or below and drops it at (x, y); returns what it
// dropped, or null. A tool comes out empty - its bits are the next thing to
// find - and a bit drops as a single, so a pack of them is a run of finds.
function dropLoot(x, y, tier, chance) {
  if (rng() >= chance) return null;
  const pool = LOOT_POOL[Math.max(0, Math.min(LOOT_POOL.length - 1, tier))];
  if (!pool || !pool.tools.length || !pool.bits.length) return null;
  if (rng() < LOOT_TOOL) {
    const id = pool.tools[Math.floor(rng() * pool.tools.length)];
    spawnDrop(x, y, toolType(id), 1, makeTool(id));
    addFloater(x, y - 26, TOOLS[id].name, TOOL_TIERS[TOOLS[id].tier].ink);
    burst(x, y - 6, TOOL_TIERS[TOOLS[id].tier].rim, 10, 50, 0.6, true);
    return id;
  }
  const id = pool.bits[Math.floor(rng() * pool.bits.length)];
  spawnDrop(x, y, bitType(id), 1);
  addFloater(x, y - 26, BITS[id].name, TOOL_TIERS[BITS[id].tier].ink);
  burst(x, y - 6, BITS[id].col, 8, 45, 0.5, true);
  return id;
}

// ---- starting loadouts ---------------------------------------------------
// Every player flies in with its class's tool in the one weapon slot and ONE
// projectile in it, which is what makes the pick a choice rather than a
// preview: the two classes do not shoot the same thing. Called from
// initPlayers() and again whenever the local player changes class at select.
//
// THE SHOT SITS IN THE LAST CELL AND EVERY CELL ABOVE IT IS LEFT EMPTY. The
// order inside `bits` is the FIRING order, cell 0 first, and a modifier only
// reaches the shots AFTER it - so holding cell 0 open means the first fitting
// anybody picks up is auto-fitted there (fitAdd takes the first free cell) and
// lands in front of the shot it was always meant to shape. A kit that filled
// cell 0 would put that first find PAST the only projectile, where it does
// nothing, and teach the rule backwards on the press that follows. A `null` in
// `bits` is a real entry rather than a gap to skip: it is the reserved cell,
// and toolPlan charges nothing for it.
//
// The starting shot also has to leave room for that fitting inside the tool's
// TENSILE budget, or the first pickup truncates the press to nothing - which
// is what the LONGSWORD's 10 is sized for: BARBED SHOT and a fitting up to 5.
const CLASS_LOADOUT = [
  { tool: 'shortbow', bits: [null, 'arrow'] }, // HUNTER: the plain shaft, a cell held open above it
  { tool: 'longsword', bits: [null, 'barb'] }, // WARRIOR: the blade, the heavy bit on its edge, same open cell
];
function giveLoadout(p) {
  p.tools = new Array(TOOL_SLOTS).fill(null);
  p.toolSel = 0;
  const L = CLASS_LOADOUT[p.cls] || CLASS_LOADOUT[0];
  const cell = makeTool(L.tool);
  // right-aligned against the tool's own cap, so the shot stays in the LAST
  // cell and the reserved ones stay in front of it whatever the body's size
  const off = Math.max(0, cell.bits.length - L.bits.length);
  for (let i = 0; i < L.bits.length && off + i < cell.bits.length; i++) cell.bits[off + i] = L.bits[i];
  p.tools[0] = cell;
  // what you fly in with counts as met, so the tree opens on the kinds you
  // have actually held rather than only on what you have picked off the snow
  noteSeen(p, cell.type);
  for (const b of L.bits) if (b) noteSeen(p, bitType(b));
}

// ---- a bot fitting what it has found -------------------------------------
// A bot has no shelf and no pointer, so it does by hand the two things a
// person does with a drag: push loose bits into the tool it is actually
// firing, and put a spare tool on a free key (or over a worse one, which then
// takes the bag cell the new one came out of). Without this a bot walks the
// rest of the match carrying a longbow in its backpack.
//
// It only takes bits that fly TOWARD what they were aimed at - a bot cannot
// read a boomerang or an orbit, so it leaves those for someone who can - and
// nothing marked `bot: false`, which is the same refusal written on a kind
// whose PATH is fine but whose point is not (a fist that must be thrown at
// arm's length, a request whose whole payoff is deciding where to stand).
function botFitLoadout(p) {
  const cur = heldTool(p);
  if (cur) {
    const tens = TOOLS[toolIdOf(cur.type)].tensile;
    let load = toolLoad(cur);
    for (let i = 0; i < p.bag.length; i++) {
      const s = p.bag[i];
      const id = s && bitIdOf(s.type);
      if (!id) continue;
      const b = BITS[id];
      if (b.proj && (b.bot === false || (b.path !== 'line' && b.path !== 'lob'))) continue;
      let free;
      // a bot builds INSIDE the budget: a bit it cannot afford would only
      // truncate the press it is already firing, so it stays in the pack
      while (s.n > 0 && load + b.weight <= tens && (free = cur.bits.indexOf(null)) >= 0) {
        cur.bits[free] = id;
        load += b.weight;
        if (--s.n <= 0) p.bag[i] = null;
      }
      if (cur.bits.indexOf(null) < 0) break;
    }
    // ...and then sorts the build the way a person would, since a modifier
    // sitting past the shots it is meant to change is worth nothing: fittings
    // to the front, shots behind them. A stable sort, no rng - deterministic.
    const live = cur.bits.filter(Boolean);
    live.sort((a, c) => (BITS[a].proj ? 1 : 0) - (BITS[c].proj ? 1 : 0));
    for (let k = 0; k < cur.bits.length; k++) cur.bits[k] = live[k] || null;
  }
  for (let i = 0; i < p.bag.length; i++) {
    const s = p.bag[i];
    if (!isToolCell(s)) continue;
    let slot = p.tools.indexOf(null);
    if (slot < 0) { // no free key: trade up over the weakest body, or leave it
      let worst = -1, wt = 99;
      for (let k = 0; k < p.tools.length; k++) {
        const t = TOOLS[toolIdOf(p.tools[k].type)].tier;
        if (t < wt) { wt = t; worst = k; }
      }
      if (worst < 0 || TOOLS[toolIdOf(s.type)].tier <= wt) continue;
      slot = worst;
    }
    p.bag[i] = p.tools[slot] || null;
    p.tools[slot] = s;
  }
  // and always be pointing at a key that can answer the button
  if (!toolReady(p)) {
    for (let k = 0; k < p.tools.length; k++) {
      if (p.tools[k] && peekBit(p.tools[k]) >= 0) { p.toolSel = k; break; }
    }
  }
}

// ---- icons ---------------------------------------------------------------
// The art bakes HERE and not in js/sprites.js, which is byte-fragile (BOM,
// mangled-byte repair) and is never rewritten - the same reason the treasure
// chest bakes beside its draw pass. Tools are 12x12 (they sit in a HUD well
// and in a hand); bits are 8x8 like every other carried item.
//
// A tool's SHAPE says which family it is and its PALETTE says its tier, so
// three silhouettes cover five tools across three tiers - the way one gear
// icon covers four materials. Tier colour lands on 'm' (the metal/limb) and
// 'M' (its highlight); the grip and string stay the same on every tier.
// 'm' is the shaded side of the limb and 'M' its lit side, so the two together
// are both the silhouette and its own rim; 's' is the string and the shaft it
// looses, 'W' the head. Only m and M change per tier.
const TOOL_ART_PAL = [
  { m: '#6b4a30', M: '#a3794f' }, // WORN: wood
  { m: '#3f7aa0', M: '#bfe6ff' }, // KEEN: frost steel
  { m: '#b98a2e', M: '#ffe08a' }, // GILDED: gold
];
// which way each art's BUSINESS END points as drawn (radians, 0 = +x): the
// bows' arrowhead is on the right, the sword's point on the left, the sling's
// stone at the top. drawHeldTool (js/draw-world.js) rotates the icon by the
// difference between this and the hand's facing (or the aim, mid-draw), so a
// weapon always points where its owner does and never into them.
const TOOL_FWD = { bow: 0, recurve: 0, sword: Math.PI, sling: -Math.PI / 2 };
const TOOL_ART = {
  bow: [ // a plain D-bow: limbs bowing left, string taut, arrow nocked right
    '........mM..',
    '......mM.s..',
    '....mM...s..',
    '..mM.....s..',
    '.mM......s..',
    '.mM.sssssssW',
    '.mM......s..',
    '..mM.....s..',
    '....mM...s..',
    '......mM.s..',
    '........mM..',
    '............',
  ],
  recurve: [ // the same bow with the limb tips flicked back the other way
    '.........Mm.',
    '........mM..',
    '......mM.s..',
    '....mM...s..',
    '...mM....s..',
    '..mM.ssssssW',
    '...mM....s..',
    '....mM...s..',
    '......mM.s..',
    '........mM..',
    '.........Mm.',
    '............',
  ],
  sword: [ // the longsword laid flat, point LEFT (drawn rotated a + PI onto the
    // aim like the bows, whose arc faces -x): a white point, the lit edge
    // over the shaded flat in steel (e/E, the two keys only this art uses),
    // the cross-guard in the tier's metal, a wooden grip and a dark pommel
    '............',
    '............',
    '............',
    '........mM..',
    '..eeeeeemM..',
    'WeeeeeeemMgo',
    '..EEEEEEmM..',
    '........mM..',
    '............',
    '............',
    '............',
    '............',
  ],
  sling: [ // a forked stick, two cords and a stone in the cradle
    '.mM......Mm.',
    '.mMs....sMm.',
    '.mM.s..s.Mm.',
    '.mM..oo..Mm.',
    '..mM.oo.Mm..',
    '...mM..Mm...',
    '....mMMm....',
    '.....mM.....',
    '.....mM.....',
    '.....mM.....',
    '....omMo....',
    '............',
  ],
};
// The blade AS HELD: the 12px icon is the bag's, and a longsword drawn at
// twelve pixels in a sixteen-pixel hand reads as a dagger. This is the same
// sword at its real length (22 px, point left like the icon), baked per tier
// beside it as toolHeld_<art>_<tier>, and drawHeldTool draws it in place of
// the icon whenever the hand holds a tool that has one.
const TOOL_HELD_ART = {
  sword: [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '..................mM..',
    '..................mM..',
    '..eeeeeeeeeeeeeeeemMG.',
    'WeeeeeeeeeeeeeeeeemMgo',
    '..EEEEEEEEEEEEEEEEmMG.',
    '..................mM..',
    '..................mM..',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
};
// 8x8 bit glyphs. Each says what the bit DOES by shape - a head and fletching
// for the plain arrow, a spiral for the wisp, a chevron stack for SPEEDUP -
// because the plate behind it is already spending the colour on tier.
const BIT_ART = {
  arrow: [
    '.......s', '......ss', '.....sSs', '....sSs.',
    '..fsSs..', '.ffSs...', 'ff.s....', 'f.......',
  ],
  barb: [
    '......ss', '.....sSs', '..s.sSs.', '.sSssS..',
    '..sSSs..', '.ssSs...', 'fs.s....', 'f.......',
  ],
  hook: [
    '..sss...', '.so.os..', 'so...os.', 'so......',
    'so...ss.', '.so.sSs.', '..sssSs.', '.....ss.',
  ],
  care: [
    '...gg...', '..gGGg..', '.gG..Gg.', 'gG.gg.Gg',
    'gG.gg.Gg', '.gG..Gg.', '..gGGg..', '...gg...',
  ],
  wisp: [
    '...ii...', '..i..i..', '.i.ii.i.', 'i.iIi.i.',
    'i.iii.i.', '.i....i.', '..i..i..', '...ii...',
  ],
  log: [
    '..wwww..', '.wWWWWw.', 'wWvvvvWw', 'wWvWWvWw',
    'wWvWWvWw', 'wWvvvvWw', '.wWWWWw.', '..wwww..',
  ],
  lance: [
    '.......i', '......iI', '.....iI.', '....iI..',
    '...iI...', '..iI....', '.iI.....', 'iI......',
  ],
  speedup: [
    '..n...n.', '.nGn.nGn', 'nGn.nGn.', 'Gn...Gn.',
    'nGn.nGn.', '.nGn.nGn', '..n...n.', '........',
  ],
  fan: [
    '......sS', '.....s..', '....s...', 'sssssssS',
    '....s...', '.....s..', '......sS', '........',
  ],
  flame: [
    '...f....', '..fFf...', '.fFFFf..', 'fFFhFFf.',
    'fFhhhFf.', 'fFFhFFf.', '.fFFFf..', '..fff...',
  ],
  twin: [
    '..pp.pp.', '.pPp.pPp', '.pPp.pPp', '.pPp.pPp',
    '.pPp.pPp', '.pPp.pPp', '.pPp.pPp', '..pp.pp.',
  ],
  heft: [
    '..oooo..', '.oggggo.', 'ogGGGGgo', 'ogGhhGgo',
    'ogGhhGgo', 'ogGGGGgo', '.oggggo.', '..oooo..',
  ],
  longshot: [
    '........', '......iI', '.....iII', 'iiiiiiII',
    '.....iII', '......iI', '........', '........',
  ],
  // PYRE: FLAME's one tongue grown into a banked fire - a deep red body with
  // a white heart, standing on two logs, so the escalation reads at a glance
  pyre: [
    '...F....', '..FhF...', '.RFhFR..', 'RFhhhFR.',
    'RFhhhFR.', '.RFhFR..', '.wWWWw..', '..wWw...',
  ],
  // CINDER BURST: a hot centre throwing sparks to every corner - the
  // multiplying line's ending, said in fire
  cinder: [
    'f...f...', '.f.f..f.', '..FfF...', '.FfhfF.f',
    '..FfF...', '.f.f....', 'f..f..f.', '....f...',
  ],
  // BIG FIST: a hand closed and thrown to the right - the knuckles are the
  // jagged right edge, the fold line is where the fingers close, and the cuff
  // is the dark leather down the left
  fist: [
    '..KKKK..', '.KKKKKK.', 'wKKkKKKK', 'wKKkKKK.',
    'wKKkKKKK', 'wKKkKKK.', '.KKKKKK.', '..KKKK..',
  ],
  // BIG AXE: a bearded head on a haft, the edge to the right
  axe: [
    'W.......', 'WSs.....', 'wSSSs...', 'wSSSSSs.',
    'wSSSs...', 'wSs.....', 'W.......', 'W.......',
  ],
  // TELEPORT REQUEST: two halves of somewhere else, pinching onto a core -
  // deliberately not a shaft, because what it does is not shooting
  warp: [
    '.u....u.', 'uU...uU.', '.uU.uU..', '..uUUu..',
    '..uUUu..', '.uU.uU..', 'uU...uU.', '.u....u.',
  ],
};
const BIT_PAL = {
  '.': null, o: '#241a12', s: '#cfd8e8', S: '#8b93a8',
  f: '#ff9440', F: '#ffd95c', h: '#fff2c0', R: '#ff5a2a',
  w: '#6b4a30', W: '#a3794f', v: '#d9ad72',
  i: '#8fd8ff', I: '#4a90e2', g: '#f2cc6a', G: '#ffe08a',
  n: '#5fd18a', p: '#a259e6', P: '#d6b6ff',
  K: '#e8b98a', k: '#b8845c',   // a fist: knuckles and the shade off them
  u: '#8f4ad6', U: '#c58fff',   // ...and the two violets nothing else in the world wears
};
// paint a char grid onto its own canvas, the one-off bake this file shares
function bakeGrid(rows, pal, w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const col = pal[r[x]];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  });
  return c;
}
// tool art, one canvas per (shape, tier), onto SPRITES so the generic
// `SPRITES[ITEMS[type].icon]` draw in the bag and the drop pass needs no
// special case for the new items
for (const art in TOOL_ART) {
  for (let t = 0; t < TOOL_TIERS.length; t++) {
    const pal = Object.assign({ '.': null, o: '#241a12', s: '#e8dcb4', W: '#ffffff', g: '#6b4a30', G: '#a3794f', e: '#c8d2e4', E: '#8b93a8' },
      TOOL_ART_PAL[t]);
    SPRITES['toolArt_' + art + '_' + t] = bakeGrid(TOOL_ART[art], pal, 12);
    if (TOOL_HELD_ART[art]) SPRITES['toolHeld_' + art + '_' + t] = bakeGrid(TOOL_HELD_ART[art], pal, TOOL_HELD_ART[art][0].length);
  }
}
for (const id in BIT_ART) SPRITES['bitArt_' + id] = bakeGrid(BIT_ART[id], BIT_PAL, 8);
// and the ITEMS/RES_COLORS rows that make them carryable
for (const id in TOOLS) {
  const T = TOOLS[id];
  ITEMS[toolType(id)] = { icon: 'toolArt_' + T.art + '_' + T.tier, stack: 1, iw: 12 };
  RES_COLORS[toolType(id)] = TOOL_TIERS[T.tier].ink;
}
for (const id in BITS) {
  ITEMS[bitType(id)] = { icon: 'bitArt_' + id, stack: BIT_STACK, iw: 8 };
  RES_COLORS[bitType(id)] = BITS[id].col;
}
