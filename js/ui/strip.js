'use strict';
// The hud strip's bones: its constants, the hud frame every bottom widget
// stands on, HUD SIZE, every cell rect and refusal flash, the weapon
// shelf's geometry and drops, sending a cell across, and the press / move /
// release the drag is made of. Drawing is js/ui/hud-draw.js.
// ---- hud strip: the ability wells over the xp bar, bottom-centre --------
// One opaque plate. Four wells on top - the class abilities in key order
// 1-4 (the WEAPON left the strip for the shelf, top-left, in 3.23: one tool,
// read in one place); under them the plum xp bar (xp IS lifetime gold), notched into
// AB_SEGS segments so progress through a level is countable at a glance. The
// bar sits at the BOTTOM so the strip's top edge is open screen: that is
// where an affordable ability level floats its buy plate (abBuyRect below),
// and a plate bobbing through the bar was the reason the bar moved.
// The dodge pips the old rail carried are gone: the reticle and the overhead
// bar already say it.
//
// A tool cell says three things without a word on it. The PLATE behind the
// icon is the tool's tier colour, the same colour it wears in every other
// well it ever sits in. The SELECTED slot is the one with the lit rim, lifted
// a pixel off the plate. And the cooldown between shots wipes top-down over
// the whole well, so the tool's rate of fire is the shape of the wipe rather
// than a number anywhere. What is loaded stays out of the resting well - the
// shelf over the backpack is where the build is read and edited.
//
// The strip proper is FIVE wells: [ WEAPON ][1][2][3][4] - the weapon leads
// and the class abilities follow in key order, each wearing its 32px icon
// (classAbIcon, js/abilities.js). On the right end the two MEAL buttons
// stack: berry over fish, half-height cells (two of them + the gap = one
// well, so the pair sits flush with the wells), each wearing its item
// icon, its count and its key letter, and both wiping on the one shared
// food clock (drawFoodClock) the bag's cells already wear. THE MEALS ARE
// ALWAYS HERE: food is a pouch and not a bag stack (the `inventory` banner,
// js/player.js), so these two buttons are the whole of where a berry and a
// fish are read and pressed, and the counts on them are uncapped - hence
// shortNum, four characters at most in a square's corner.
//
// And flush on the strip's top edge over that column, THE PURSE: the coin and
// the gold behind it, on screen for the whole match. Money is the number a
// player is deciding on all game - what the counter is asking, what a gear
// level costs, whether that kill was worth it - and it used to be readable
// only with the pack open. It is a tab of the strip rather than a bar of its
// own so it slides in with the HUD, scales with it, and stays one glance from
// the meals and the abilities it is spent on.
const AB_CELL = HUD_CELL, AB_GAP = 2, AB_N = 4; // AB_CELL: a strip well (the one size, above); AB_N: abilities
// THE POUCH BLOCK, the strip's right end: the four numbers you own in a 2x2
// of SQUARES - berry over fish on the left, gold over cards on the right
// (3.23). Every cell is the ability wells' own grammar at two thirds the
// size: the doubled icon in the middle, the key cap in the bottom-left corner
// (the carve-out; the gold has none) and the count in the top-right, so
// the block reads as four stamps and not as four bars. It is TALLER than a
// well: two squares and their gap stand POUCH_RISE px above the strip's top
// edge on a tab of the strip's own plate, its bottom flush with the wells'.
const FOOD_SQ = 24;                          // a pouch cell: a square
const POUCH_GAP = 2;                         // between neighbouring squares
const POUCH_W = FOOD_SQ * 2 + POUCH_GAP;     // the block: two columns...
const POUCH_H = POUCH_W;                     // ...and two rows
const AB_W = AB_N * AB_CELL + AB_N * AB_GAP + POUCH_W; // four wells, four gaps, the pouch block
const AB_PAD = 3, AB_XP = 5, AB_SEGS = 10; // AB_PAD: the frame's outline, its lit line and one px of ground (drawHudFrame); AB_SEGS: xp bar notches
const AB_H = AB_PAD + AB_CELL + AB_PAD + AB_XP + AB_PAD;
const POUCH_RISE = POUCH_H - AB_PAD - AB_CELL; // how far the block stands above the strip's top edge
const AB_BG = '#0d1229';
// ---- the hud frame: the one plate the bottom widgets stand on ----------
// The strip and the pack are the frostlands' own chrome, at a combat
// surface's volume: the settings slab's chamfered corners and bevel
// (bakeFrostSlab, js/panels.js) and the menu planks' snow cap
// (drawMenuButton, js/menu.js), with none of their mottling, rivets or
// icicles - the wells cover most of the ground, and a plate that is looked
// at for an hour has to stay quiet. Four layers, all pixels, nothing soft:
//   * the SILHOUETTE, one dark line (the xp bar's own ink) with its top
//     corners cut two pixels, so the plate sits on the snow as a shape and
//     not a rectangle - the bottom corners stay square where they meet the
//     screen's edge, since a notch of world there reads as a hole;
//   * the GROUND inside it, one opaque colour;
//   * the BEVEL: an icy line along the top and left, a deep one along the
//     bottom and right, the slab's light from the top-left;
//   * the SNOW CAP: a ragged one-to-two pixel drift resting on every top
//     edge, with a frost pixel here and there sunk into the lit line under
//     it - deterministic (hash2 off the seed), so it never shimmers.
// `tab` is a block rising off the top edge and flush with the right side
// (the pouch block's): the outline steps up around it as ONE silhouette,
// the ground runs through the seam, and the lit line turns the inside
// corner rather than stopping at it. `lit` and `ink` are what a widget's
// state colours (the pack's full amber, a refusal's red). Every margin
// inside the outline is three pixels - line, light, ground - which is what
// AB_PAD and BAG_PAD are.
const HUD_INK = '#05070f';   // the silhouette
const HUD_LIT = '#35426e';   // the icy light along the top and left
const HUD_SHADE = '#070a18'; // the shade along the bottom and right
const HUD_SNOW = '#f4f7ff', HUD_FROST = '#b8cce6';
// a rect with its corners cut two pixels where `c` says so
function chamCut(x, y, w, h, c) {
  ctx.fillRect(x + 2, y, w - 4, h);
  ctx.fillRect(x, y + 2, w, h - 4);
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  if (!c.tl) { ctx.fillRect(x, y, 2, 1); ctx.fillRect(x, y + 1, 1, 1); }
  if (!c.tr) { ctx.fillRect(x + w - 2, y, 2, 1); ctx.fillRect(x + w - 1, y + 1, 1, 1); }
  if (!c.bl) { ctx.fillRect(x, y + h - 1, 2, 1); ctx.fillRect(x, y + h - 2, 1, 1); }
  if (!c.br) { ctx.fillRect(x + w - 2, y + h - 1, 2, 1); ctx.fillRect(x + w - 1, y + h - 2, 1, 1); }
}
function drawHudFrame(x, y, w, h, o) {
  o = o || {};
  const c = o.corners || { tl: true, tr: true, bl: false, br: false };
  const t = o.tab || null, tc = { tl: true, tr: true, bl: false, br: false };
  const ink = o.ink || HUD_INK, lit = o.lit || HUD_LIT, shade = o.shade || HUD_SHADE, seed = (o.seed || 1) * 13;
  // the silhouette, then the ground - the tab's run down INTO the plate so
  // the seam between the two is ground, never line
  ctx.fillStyle = ink;
  chamCut(x, y, w, h, c);
  if (t) chamCut(t.x, t.y, t.w, y - t.y + 3, tc);
  ctx.fillStyle = o.bg || AB_BG;
  chamCut(x + 1, y + 1, w - 2, h - 2, c);
  if (t) chamCut(t.x + 1, t.y + 1, t.w - 2, y - t.y + 2, tc);
  // the bevel: light from the top-left, shade to the bottom-right; with a
  // tab the top light runs to the inside corner and climbs it
  ctx.fillStyle = lit;
  if (t) {
    ctx.fillRect(x + 2, y + 1, t.x - x - 1, 1);
    ctx.fillRect(t.x + 1, t.y + 2, 1, y - t.y);
    ctx.fillRect(t.x + 2, t.y + 1, t.w - 4, 1);
  } else ctx.fillRect(x + 2, y + 1, w - 4, 1);
  ctx.fillRect(x + 1, y + 2, 1, h - 4);
  ctx.fillStyle = shade;
  ctx.fillRect(x + 2, y + h - 2, w - 4, 1);
  const rt = t ? t.y + 2 : y + 2;
  ctx.fillRect(x + w - 2, rt, 1, y + h - 2 - rt);
  // the snow cap, on every top edge the sky can reach
  if (o.cap !== false) {
    const segs = t ? [[x + 2, t.x - 1, y], [t.x + 2, t.x + t.w - 3, t.y]] : [[x + 2, x + w - 3, y]];
    const tall = o.cap === 1 ? 0 : 1; // a one-px cap for an edge something already stands on
    for (const [x0, x1, top] of segs) {
      for (let px = x0; px <= x1; px++) {
        const hb = hash2(px * 3 + 5, seed);
        const sh = 1 + (hb > 0.6 ? tall : 0);
        ctx.fillStyle = HUD_SNOW;
        ctx.fillRect(px, top - sh, 1, sh);
        if (hb > 0.3 && hb < 0.42) { ctx.fillStyle = HUD_FROST; ctx.fillRect(px, top + 1, 1, 1); }
      }
    }
  }
}
// The weapon well's half of the refusal the backpack already has: a bit that
// will not fit in the tool reddens and shakes the WELL, exactly as one that
// will not fit in the pack reddens and shakes the frame (bagDenied) - so the
// two containers say "full" in one language, and the one that is full is the
// one that answers. updateFx ages it on wall time, beside bagFlash.
let toolFlash = 0;
function toolDenied() {
  if (toolFlash > 0) return;
  toolFlash = 0.6;
  hudFx("deny");
}
function hudStripRect() {
  return { x: Math.round((VIEW_W - AB_W) / 2), y: VIEW_H - AB_H, w: AB_W, h: AB_H };
}
// How far the strip drops to be AWAY: its own height plus the pouch block's
// tab standing over it, so the whole widget clears the bottom edge rather
// than leaving a sliver of tab over a cinematic.
const HUD_SLIDE = AB_H + POUCH_RISE + 5; // ...its outline, and the snow on top of it
// How far the HUD has slid in: 0 while it is away below the screen, 1 once it
// is home. The intro rides it up (renderUI) - and a ceremony PINS it there,
// because the drop brief's camera branch holds state.intro for the whole
// roost tour (js/sim.js), which is how the HUD stays off a cinematic. Every
// piece that hangs in the open screen ABOVE the strip - the buy plates, which
// the slide is not deep enough to carry off the bottom on their own - asks
// this before it draws or answers the pointer, or it bobs there alone over a
// cinematic with no strip under it.
function hudInT() {
  return state.intro > 0 ? easeOut(Math.max(0, 1 - state.intro / HUD_IN_T)) : 1;
}
function hudHome() { return hudInT() >= 1; }
// The HUD SIZE dial (settings.hudScale, the ESC panel's GAME page). The strip
// keeps ALL its geometry in this 1x space and drawHudScaled blits the whole
// widget scaled about its bottom-centre anchor; stripMouse maps the pointer
// back through that anchor, so every hit test below converts first and the
// rects themselves never move.
// a phone keeps a HUD SIZE of its own (hudScaleM): the same slider edits
// whichever is live, so a profile that plays on both keeps both
function hudScaleKey() { return MOBILE ? 'hudScaleM' : 'hudScale'; }
// The size the HUD is actually drawn at: the dial, CAPPED at the size where
// the strip would outgrow the view, so past that point the slider simply
// stops growing it rather than pushing its ends off the screen.
function hudSc() {
  const want = settings[hudScaleKey()] || 0.8;
  return Math.min(want, (VIEW_W - 8) / (AB_W + 6));
}
function stripMouse(mx, my) {
  const s = hudSc();
  if (s === 1) return { x: mx, y: my };
  return { x: VIEW_W / 2 + (mx - VIEW_W / 2) / s, y: VIEW_H + (my - VIEW_H) / s };
}
// well j of the four, left to right, over the xp bar
function stripCellRect(j) {
  const R = hudStripRect();
  return { x: R.x + j * (AB_CELL + AB_GAP), y: R.y + AB_PAD, w: AB_CELL, h: AB_CELL };
}
// ability i's well: keys 1-4, in order from the strip's left end
function abCellRect(i) { return stripCellRect(i); }
// pouch cell (col, row) of the 2x2 block: col 0 the meals, col 1 gold and cards
function pouchCellRect(col, row) {
  const R = hudStripRect();
  return { x: R.x + AB_W - POUCH_W + col * (FOOD_SQ + POUCH_GAP),
    y: R.y + AB_PAD + AB_CELL - POUCH_H + row * (FOOD_SQ + POUCH_GAP), w: FOOD_SQ, h: FOOD_SQ };
}
// the tab the block stands on: the strip's plate carried up behind the two
// rows, a rim's width around them, down to the strip's own top edge
function pouchTabRect() {
  const R = hudStripRect(), b = pouchCellRect(0, 0);
  return { x: b.x - 3, y: b.y - 3, w: POUCH_W + 6, h: R.y - b.y + 3 };
}
// the three BUTTONS of the block, in stripHit's 'food' order: the berry (0)
// over the fish (1) on the left, the cards (2) bottom-right; the gold plate
// top-right is a readout and answers 'frame'. Each carries the action whose
// key its cap prints and the input intent its press sets.
const FOOD_BTNS = [
  { type: 'berry', act: 'berry', intent: 'eatBerry', col: 0, row: 0 },
  { type: 'fish', act: 'fish', intent: 'eatFish', col: 0, row: 1 },
  { type: 'card', act: 'card', intent: 'useCard', col: 1, row: 1 },
];
function foodCellRect(i) { const b = FOOD_BTNS[i]; return pouchCellRect(b.col, b.row); }
function goldCellRect() { return pouchCellRect(1, 0); }
// The meal buttons' share of that refusal: a press that could not become a
// meal - nothing in the bag, the clock still up, full health, a busy body -
// reddens and shakes the button that was asked, in the red the well and the
// pack already refuses in, so a Q with no berry reads as denied rather than
// dead. startEat is the one path every press takes (key or click), so it is
// the one caller; a second press on the same button while the red is up is
// swallowed as the pack's is, while the other meal's button answers fresh.
// updateFx ages it on wall time beside bagFlash and toolFlash.
let foodFlash = 0, foodFlashI = 0;
function foodDenied(type) {
  const i = type === 'fish' ? 1 : type === 'card' ? 2 : 0;
  if (foodFlash > 0 && foodFlashI === i) return;
  foodFlash = 0.6;
  foodFlashI = i;
  SFX.deny();
}
// And the ability wells' share of it: a key nobody has spent a point on is
// LOCKED (abUnlocked, js/abilities.js), and its well already stands dim with
// a dark icon - but a press has to answer, so the asked well reddens and
// shakes in the same red the pack, the weapon well and the meal buttons
// refuse in. tryAbility is the one caller, so key and click speak alike; a
// cooldown is NOT this refusal - the wipe already says when it comes home.
let abFlash = 0, abFlashI = 0;
function abDenied(i) {
  if (abFlash > 0 && abFlashI === i) return;
  abFlash = 0.6;
  abFlashI = i;
  SFX.deny();
}
// The floating buy plate: an affordable ability level's ask hovers in the
// open screen ABOVE the well - gear's old chevron grammar, made a real
// button. The plate is the buy click and the well below stays purely the
// cast, so the two can never steal each other's press. The rect is FIXED
// (the bob is drawn, never hit-tested) and 3px taller than the plate so the
// bob's whole travel stays inside it.
const AB_BUY = 14;
function abBuyRect(i) {
  const r = abCellRect(i);
  return { x: r.x + ((r.w - AB_BUY) >> 1), y: r.y - AB_BUY - 6, w: AB_BUY, h: AB_BUY + 3 };
}
// which ability's plate the pointer is on, or -1. A plate only EXISTS while
// a skill point is waiting and the key has room (abLvCanBuy), so the hit
// test is also the appears-then-goes gate - shared by the press, the
// cursor, the tooltip and the pixels.
function abBuyHit(mx, my) {
  if (state.mode !== 'play' || player.dead || state.paused || !hudHome() ||
      state.mapOpen || state.settingsOpen || state.wheel || window.DBG.hideUI) return -1;
  ({ x: mx, y: my } = stripMouse(mx, my));
  for (let i = 0; i < AB_N; i++) {
    if (!abLvCanBuy(player, i)) continue;
    const r = abBuyRect(i);
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return i;
  }
  return -1;
}
// { kind:'ab', i } | { kind:'food', i } | { kind:'frame' }
// | null. Shared by the click handler, the cursor and the strip's own hover
// so they cannot disagree.
function stripHit(mx, my) {
  if (state.mode !== 'play' || player.dead || state.paused ||
      state.mapOpen || state.settingsOpen || state.wheel || window.DBG.hideUI) return null;
  ({ x: mx, y: my } = stripMouse(mx, my));
  const R = hudStripRect();
  // the pouch block's tab stands above the plate: inside it counts as on the strip
  const tb = pouchTabRect();
  const onTab = mx >= tb.x && mx < tb.x + tb.w && my >= tb.y && my < tb.y + tb.h;
  if (!onTab && (mx < R.x - 3 || mx >= R.x + R.w + 3 || my < R.y || my >= R.y + R.h)) return null;
  for (let i = 0; i < AB_N; i++) {
    const s = abCellRect(i);
    if (mx >= s.x && mx < s.x + s.w && my >= s.y - 1 && my < s.y + s.h) return { kind: 'ab', i };
  }
  for (let i = 0; i < FOOD_BTNS.length; i++) {
    const s = foodCellRect(i);
    if (mx >= s.x && mx < s.x + s.w && my >= s.y - 1 && my < s.y + s.h) return { kind: 'food', i };
  }
  return { kind: 'frame' };
}

// ---- the weapon shelf ----------------------------------------------------
// THE ONE WEAPON, TOP-LEFT, ON SCREEN AT ALL TIMES (3.23): the tool in hand
// at the left end and its bit cells running right in FIRING ORDER - which is
// also the direction a fitting reaches along, so the row reads the way the
// press resolves. It is the whole of what the HUD says about the arsenal -
// the strip lost its weapon well, and everything else carried is in the
// drawer under this row, shut until asked for (the backpack banner, above) -
// so one tool is read in one place, the way Noita's wand or Terraria's held
// item is.
//
// It is NOT a panel. Bare wells with their own drop shadows, so the corner
// stays world everywhere between them and only a cell itself ever swallows
// a click.
//
// Pinned by its TOP to shelfRowY - under the sky on a desktop, under the
// menu and zoom plates on a phone - and grown rightward from SHELF_X: the
// budget track and the row keep their pixels whatever the build does, and a
// fitting's rail is what climbs into the open screen above them.
const SHELF_CELL = HUD_CELL, SHELF_GAP = 2; // a well (the one size), and the air between two
const SHELF_BAR = 4;                  // the budget track, under the row
const SHELF_RAIL = 3;                 // what one modifier's rail costs above it
const SHELF_SLOT = 0;                 // the weapon slot it edits (TOOL_SLOTS is 1)
const SHELF_X = BAG_PAD;              // the tool cell's left edge: the drawer's first cell sits under it, its frame flush with the view's edge
function shelfRowY() { return MOBILE ? 44 : 18; } // the row's top: room for five rails above it, and on a phone for the plates
// how far in from the left edge the corner widget can reach: the widest row
// (a five-bit longbow) and the SHIFT plate off its end - what the intro
// slide and the bake are sized by, so neither jumps when the tool changes
const CORNER_REACH = SHELF_X + 6 * SHELF_CELL + 5 * SHELF_GAP + 80;
// WHAT THE CORNER CLAIMS OF THE FRAME, in view px at the HUD SIZE the dial
// holds: the widest row a tool can ever grow to, or the drawer under it,
// whichever reaches further. The merchant's slab is pinned off this
// (shopLayout, js/shop.js) so a trade never stands on the pack it is dragged
// out of. It is the FIXED reach and not the live shelfRowRight(): the row
// grows with the tool in hand, and a slab that slid sideways when a swap
// changed the row mid-trade would walk out from under the pointer. The SHIFT
// plate CORNER_REACH allows for is left out of it - that is a hover hint,
// not a widget, and 80 px of room for one is 80 px the counter would lose.
const CORNER_CLAIM = Math.max(BAG_W, SHELF_X + 6 * SHELF_CELL + 5 * SHELF_GAP);
function cornerClaim() { return Math.round(CORNER_CLAIM * hudSc()); }
// ...and how far DOWN it reaches with the drawer open: the other half of the
// room a panel pinned off the corner has to miss, for a view too NARROW to
// stand one beside it. This one is measured live off the drawer, because
// unlike the row's width it does not move with the tool in hand - only with
// the number of cells carried, which nothing changes today.
function cornerBottom() { const f = bagFrameRect(); return Math.round((f.y + f.h) * hudSc()); }
// the tool the shelf is showing, or null with the weapon well empty
function shelfCell() { return player.tools[SHELF_SLOT] || null; }
// ...and whether the shelf is on screen and answering the pointer at all: the
// backpack's own gate, since the two are one widget in the corner now
function shelfUp() {
  return state.mode === 'play' && !player.dead && !state.paused &&
    !state.mapOpen && !state.settingsOpen && !state.wheel && !window.DBG.hideUI;
}
// how many wells the row is: the tool, and one per bit cell it has
function shelfCells() { const c = shelfCell(); return (c ? c.bits.length : 0) + 1; }
// Cell -1 is the TOOL and 0..cap-1 are its bits: one row, left to right
// from the corner. A bigger tool grows the row rightward, so the tool cell -
// and the drawer's tab under it - never move.
function shelfCellRect(i) {
  return { x: SHELF_X + (i + 1) * (SHELF_CELL + SHELF_GAP), y: shelfRowY(), w: SHELF_CELL, h: SHELF_CELL };
}
// the row's right edge, where the SHIFT plate hangs
function shelfRowRight() { const n = shelfCells(); return SHELF_X + n * SHELF_CELL + (n - 1) * SHELF_GAP; }
// What the pointer is on: { kind: 'tool' } | { kind: 'bit', i } | null. The
// gaps, the rails and the budget track are not hit tested - they say things,
// they do not take anything, and the snow behind them stays clickable.
function shelfHit(mx, my) {
  if (!shelfUp()) return null;
  ({ x: mx, y: my } = cornerMouse(mx, my));
  const t = shelfCellRect(-1);
  if (mx >= t.x && mx < t.x + t.w && my >= t.y && my < t.y + t.h) return { kind: 'tool' };
  const cell = shelfCell();
  if (!cell) return null;
  for (let i = 0; i < cell.bits.length; i++) {
    const r = shelfCellRect(i);
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return { kind: 'bit', i };
  }
  return null;
}
// WHICH FITTING REACHES WHICH SHOT, as one rail per modifier over the row.
// A rail starts at its own cell and runs right to the last shot it touches,
// with a blip under every shot on the way that it is actually in the envelope
// of - which is the forward-only rule drawn rather than written down. The
// reach is read off toolPlan's own `mods`, so the picture cannot claim a rule
// the press does not follow.
//
// The LAST modifier takes the rail nearest the row and earlier ones stack
// above it. That order is what keeps the picture untangled: a rail's stem
// drops to its own cell through the rails under it, and every one of those
// belongs to a later modifier, which by definition starts further RIGHT - so
// no stem ever crosses a line.
function shelfRails(cell, plan) {
  const out = [];
  for (let i = cell.bits.length - 1; i >= 0; i--) {
    const id = cell.bits[i];
    if (!id || BITS[id].proj) continue;
    const hits = plan.shots.filter((s) => s.mods.indexOf(i) >= 0).map((s) => s.i);
    if (hits.length) out.push({ i, hits, col: BITS[id].col });
  }
  return out;
}
// The top of everything the shelf draws: the row, and one rail for every
// fitting that reaches a shot. Whatever hangs over the shelf (the pack's SHIFT
// plate) clears THIS rather than the row, so a rail can never grow up into it.
// A carried bit landing in bit cell i of slot s. One bit comes off the stack;
// whatever it displaces goes home first (dragHome - the pack cell or the bit
// cell this drag began in, which makes the drop a swap), then onto the
// now-free hand, into the bag, or onto the snow, so it is never a deletion.
function dragDropBit(s, i) {
  const cell = player.tools[s], d = state.drag, from = d.from;
  const id = bitIdOf(d.cell.type);
  if (!id) { hudFx('deny', 'bit', i, s); return; }  // a tool does not go inside a tool
  const was = bitPut(cell, i, id);
  d.cell.n--;
  if (d.cell.n <= 0) state.drag = null;
  let hand = false;
  if (was) {
    const out = { type: bitType(was), n: 1 };
    if (!dragHome(out, from)) {
      if (!state.drag) { state.drag = { cell: out, from: { k: 'bit', slot: s, i } }; hand = true; }
      else if (!bagPut(player, out)) throwCell(out);
    }
  }
  // the ousted bit rode back onto the cursor: the hand changed without being
  // asked, so this is a swap and says so - otherwise it is a plain seating
  hudFx(hand ? 'swap' : 'place', 'bit', i, s);
}
// A carried tool landing on weapon slot i. Only a tool goes here - a bit
// dropped on a slot is refused rather than quietly swallowed, because a bit
// belongs in a tool, not on a key. The tool it displaces takes the bag cell
// this one came out of (dragHome), which is the swap the CLICK already makes.
function dragDropSlot(i) {
  const d = state.drag, from = d.from;
  if (!isToolCell(d.cell)) { hudFx('deny', 'slot', i); return; }
  const was = slotPut(player, i, d.cell);
  state.drag = null;
  let hand = false;
  if (was && !dragHome(was, from)) { state.drag = { cell: was, from: { k: 'slot', i } }; hand = true; }
  hudFx(hand ? 'swap' : 'seat', 'slot', i);
}
// Where the carried item is being let go. Every well that can hold one is
// tried, then the rest of the HUD sends it home, and only the WORLD throws it
// away - so a fumbled release inside the frame costs nothing and a deliberate
// drag out onto the snow is the one way to get rid of a tool.
function dragDrop(mx, my) {
  // the counter first: its sell STRIP is the one place a release turns an item
  // into gold, and the rest of the slab sends it home. Both halves of the
  // strip take the release - the well you aim at and the SELL ALL button at
  // its end - because the strip is one full-width target with an item on the
  // cursor and only becomes two controls once your hand is empty.
  const sp = shopHit(mx, my);
  if (sp) { if (sp.kind === 'sell' || sp.kind === 'sellAll') shopDropSell(); else dragReturn(); return; }
  const fh = shelfHit(mx, my);
  if (fh) {
    if (fh.kind === 'bit') dragDropBit(SHELF_SLOT, fh.i);
    else dragDropSlot(SHELF_SLOT);
    return;
  }
  const sh = stripHit(mx, my);
  if (sh) { dragReturn(); return; } // the strip takes nothing: the weapon's well is on the shelf
  const bh = bagHit(mx, my);
  if (bh) { if (bh.kind === 'cell') dragDropBag(bh.i); else dragReturn(); return; }
  if (overHud(mx, my)) { dragReturn(); return; }
  throwCell(state.drag.cell);
  state.drag = null;
}

// ---- one click sends it to the other side -------------------------------
// Every well here has exactly ONE sensible destination, so the CLICK is the
// whole move: a bit in the grid loads into the weapon's first free cell, a
// bit on the shelf comes back to the pack, a tool in the grid trades places
// with the weapon in hand, and the weapon well stows what it holds in the
// pack the way a bit does. That completes the grammar the backpack already
// had - clicking a cell USES what is in it, a card by drawing from it - for
// the two kinds that had no use and could only deny.
//
// It is resolved on the RELEASE like every other click (hudRelease), never on
// the press, so a press that travels is still a drag and arranging the pack
// by hand is untouched. Each returns whether it HANDLED the click: a card and
// an empty cell are not transfers, and there it falls through to the click it
// always was.
//
// Nothing here can destroy anything - when the destination has no room the
// item does not move at all, and the container that is full is the one that
// reddens and buzzes (bagDenied / toolDenied), which is the same refusal a
// drop you cannot carry already fires.

// a grid cell: a tool swaps into the hand, a bit loads into the weapon
function sendBagCell(i) {
  const s = player.bag[i];
  if (!s) return false;
  if (isToolCell(s)) {
    // the swap is one move each way: what was in hand lands in the cell the
    // tool just left, so the grid never grows or loses a row
    const was = slotPut(player, player.toolSel, s);
    player.bag[i] = was || null;
    // one move each way IS a swap when the hand was full, and the cue says so
    hudFx(was ? 'swap' : 'seat', 'slot', player.toolSel);
    return true;
  }
  const id = bitIdOf(s.type);
  if (!id) return false;            // a card: nowhere else to be
  const cell = heldTool(player);
  const free = cell ? cell.bits.indexOf(null) : -1;
  if (free < 0) { toolDenied(); return true; } // no weapon, or every cell loaded
  bitPut(cell, free, id);
  if (--s.n <= 0) player.bag[i] = null;
  hudFx('place', 'bit', free, player.toolSel); // the cell it landed in lights, not the one it left
  return true;
}
// a bit cell of the shelf: back into the pack, topping up a stack of
// its own kind first (bagAdd), and staying put if none of it fits
function sendBitCell(s, i) {
  const cell = player.tools[s];
  const id = cell && cell.bits[i];
  if (!id) return false;
  if (!bagAdd(player, bitType(id), 1)) { bagDenied(); return true; }
  bitPut(cell, i, null);
  hudFx('place', 'bit', i, s);
  return true;
}
// the weapon well: the tool stows in the pack, bits and all, exactly as a bit
// does - the same gesture, one well over
function sendSlot(i) {
  const cell = player.tools[i];
  if (!cell) return false;
  if (!bagPut(player, cell)) { bagDenied(); return true; } // put it down before lifting it
  slotPut(player, i, null);
  hudFx('place', 'slot', i);
  return true;
}
// Where a SHIFT-held release lands while something is riding the cursor: the
// same wells dragDrop tries, in the same order, but acting on what is already
// SITTING there instead of on what is in hand. Everything else - the rest of
// the frame, the world - does nothing at all, because shift's whole promise
// is that the item in hand is still in hand afterwards.
function sendAt(mx, my) {
  const fh = shelfHit(mx, my);
  if (fh) return fh.kind === 'bit' ? sendBitCell(SHELF_SLOT, fh.i) : sendSlot(SHELF_SLOT);
  const bh = bagHit(mx, my);
  if (bh) return bh.kind === 'cell' && sendBagCell(bh.i);
  return false;
}

// ---- the press / move / release the drag is made of ---------------------
// A press ARMS a pick-up rather than performing one, and only movement past a
// few pixels promotes it into a live drag. That is what keeps one gesture
// doing two jobs: a tap on a card still draws from it and a tap on a bit sends
// it into the weapon, while a drag off either one picks it up. `state.dragPend`
// is the armed press; it never survives the release that resolves it, and it
// is also where a press made WHILE CARRYING records which of the two things
// this gesture is (`keep`), so letting go of shift mid-click cannot change
// its mind halfway through.
const DRAG_SLOP = 3; // px of travel before a press becomes a drag
function hudPress(mx, my) {
  // ALREADY CARRYING SOMETHING: the press ARMS, exactly as every branch below
  // does, and the RELEASE is what puts the item down. It used to resolve here,
  // on the press, and that was a real bug rather than an inconsistency: a drop
  // onto a loaded well swaps, and a swap whose displaced item cannot go home
  // puts that item back on the cursor - so `state.drag` was full again by the
  // time the mouseup arrived, hudRelease ran the very same dragDrop at the very
  // same pixel, and one physical click swapped TWICE. The two items flipped
  // back and forth, one flip per click, and the well ended up exactly where it
  // started.
  //
  // Arming also buys the gesture what every other well already had: a press
  // you can think better of. The pointer may still travel after it, the
  // hovered well says what letting go will do (dropKindAt), and moving off
  // before the release is how a mis-aimed drop is called off.
  if (state.drag) {
    state.dragPend = keyHeld('slide') ? { keep: true } : { hold: true };
    return true;
  }
  const fh = shelfHit(mx, my);
  if (fh) {
    if (fh.kind === 'bit') {
      if (shelfCell().bits[fh.i]) state.dragPend = { src: { k: 'bit', slot: SHELF_SLOT, i: fh.i }, x: mx, y: my };
    } else {
      state.dragPend = { src: { k: 'slot', i: SHELF_SLOT }, x: mx, y: my, empty: !shelfCell() };
    }
    return true; // the shelf swallows the press either way
  }
  // the floating buy plate over an ability well: its own press, clear of the
  // strip, so buying a level and casting can never steal each other's click
  const abb = abBuyHit(mx, my);
  if (abb >= 0) {
    SFX.unlock();
    player.input.cmd = { kind: 'ability', i: abb };
    return true;
  }
  const sh = stripHit(mx, my);
  if (sh) {
    if (sh.kind === 'ab') player.input.ability = sh.i; // click-to-cast: the well IS the key
    else if (sh.kind === 'food') player.input[FOOD_BTNS[sh.i].intent] = true; // the button IS the key, refusals and all (startEat / useCard)
    return true;
  }
  const bh = bagHit(mx, my);
  if (bh) {
    if (bh.kind === 'cell' && player.bag[bh.i]) state.dragPend = { src: { k: 'bag', i: bh.i }, x: mx, y: my };
    else if (bh.kind !== 'cell') return bagClick(bh); // the frame eats the press
    return true;
  }
  return false;
}
// the pointer moved: an armed press that has travelled far enough becomes the
// drag itself, lifting the item out of wherever it was sitting
function hudMove(mx, my) {
  const q = state.dragPend;
  // an empty well has nothing to lift, and neither a shift-hold nor a press
  // made with something ALREADY in hand is a pick-up at all - both are aimed
  // at the well under the pointer when the button comes back up
  if (!q || q.empty || q.keep || q.hold) return;
  if (Math.abs(mx - q.x) < DRAG_SLOP && Math.abs(my - q.y) < DRAG_SLOP) return;
  state.dragPend = null;
  dragLift(q.src);
}
// The release, where every click in this widget is actually decided. A live
// drag is put down - or, when the press was begun with shift held, spends
// itself on the well under the pointer and stays in hand (sendAt). An armed
// press that never travelled is the click it always was, and that click is
// the TRANSFER: the bag cell's own use (a bit into the weapon, a tool into
// the hand, otherwise bagClick's refusal), the weapon well and a bit cell
// of the shelf both stowing what they hold in the pack.
//
// SHIFT sends too, in both hands: with an empty one it is the plain click
// (below - the transfer is what shift-click means everywhere else, so the
// modifier costs nothing and finds the gesture for anybody who reaches for
// it), and while carrying it is the same transfer aimed at the well under
// the pointer instead of at what is in hand (sendAt above).
function hudRelease(mx, my) {
  const q = state.dragPend;
  state.dragPend = null;
  if (state.drag) {
    if (q && q.keep) sendAt(mx, my);
    else dragDrop(mx, my);
    return true;
  }
  if (!q) return false;
  if (q.src.k === 'bag') { if (!sendBagCell(q.src.i)) bagClick({ kind: 'cell', i: q.src.i }); }
  else if (q.src.k === 'slot') sendSlot(q.src.i);
  else sendBitCell(q.src.slot, q.src.i);
  return true;
}
