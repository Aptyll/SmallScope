'use strict';
// The hud strip's bones: its constants, the hud frame every bottom widget
// stands on, the HUD size dials, every cell rect and refusal flash, the weapon
// shelf's geometry and drops, sending a cell across, and the press / move /
// release the drag is made of. Drawing is js/ui/hud-draw.js.
// ---- hud strip: portrait, wells and bars, bottom-centre ------------------
// One opaque plate, read left to right the way a MOBA's bottom bar is (0.426):
//
//   [portrait] [1][2][3][4] [berry][fish]
//              [ health bar ] [  gold  ]
//              [ stamina    ]
//
// THE PORTRAIT is a square well holding your hero's face, framed in the
// wells' own border. Your XP runs CLOCKWISE ROUND ITS EDGE from top centre,
// so the ring filling is the level filling; the xp you have and the xp the
// next level needs stand over it as one number pair, and the level itself is
// the digit in the badge on its bottom-right corner. Under the four ability
// wells run the HEALTH bar (the number on it is your health and your most)
// and the STAMINA bar under that: the dodge charges, white, one notch between
// each, the overhead bar's twin (drawOverhead, js/draw/bodies.js). It is the
// seat a mana bar takes when heroes come.
//
// The meals sit beside the abilities in wells of the SAME size, because they
// are pressed the same way (Q and F, a click), each with its key in the
// corner an ability prints its key in and its count in the top-right; both
// wipe on the shared food clock (drawFoodClock). THE MEALS ARE ALWAYS HERE:
// food is a pouch and not a bag stack (the `inventory` banner, js/player.js),
// so these two wells are the whole of where a berry and a fish are read and
// pressed, and the counts are uncapped - hence shortNum, four characters at
// most. Under them, level with the bars, THE PURSE: the coin and the gold, on
// screen for the whole match, since money is the number a player decides on
// all game. Unopened cards are not on the strip: they are bag items, drawn
// from the pack or on the card key.
//
// The weapon is not on the strip either (the shelf, top-left), and nor is the
// build list's way in: the build key opens it, and its column stands over the
// meal wells (buildTabRect, js/ui/wheel.js).
const AB_CELL = HUD_CELL, AB_GAP = 2, AB_N = 4; // AB_CELL: a strip well (the one size, above); AB_N: abilities
const AB_PAD = 3;                         // the frame's outline, its edge and one px of ground (drawHudFrame)
const PORT_SQ = 51;                       // the portrait square, the plate's full inner height
const PORT_GAP = 4;                       // portrait to the first well
const AB_ROW_W = AB_N * AB_CELL + (AB_N - 1) * AB_GAP; // the four ability wells
const FOOD_GAP = 5;                       // abilities to the meals
const FOOD_N = 2;                         // the meal wells: berry, fish
const FOOD_W = FOOD_N * AB_CELL + (FOOD_N - 1) * AB_GAP;
const HP_H = 7, ST_H = 4;                 // the health bar (tall enough for its number) and the stamina bar
const BAR_TOP = AB_CELL + 3;              // the health bar's outline, under the wells
const ST_TOP = BAR_TOP + HP_H + 1;        // the stamina bar's outline: shares the health bar's bottom ink
const XP_TAG = 9;                         // the xp numbers standing over the portrait
const AB_W = PORT_SQ + PORT_GAP + AB_ROW_W + FOOD_GAP + FOOD_W; // the content, inside the frame's pads
const AB_H = AB_PAD + ST_TOP + ST_H + 2 + AB_PAD; // wells, bars, the stamina bar's outline, the pads
const AB_BG = '#16181c';
// ---- the hud frame: the one plate the bottom widgets stand on ----------
// The strip, the pack and the team rail stand on one plate, drawn the way
// League's and Dota's HUDs get their contrast, kept simple: a dark outline,
// a faint line just inside it, and a solid dark ground, all neutral
// graphite (0.421: the cold steel line pulled the eye off the game). The
// outline holds the plate apart from bright snow at noon, the faint line
// gives its edge a finish against the forest at night, and the ground keeps
// every well on it readable over both; the icons, the sides' colours and
// the gold carry the contrast, never the frame. No bevel, no snow, no ornament: a plate
// looked at for an hour has to stay quiet. Three layers, all pixels:
//   * the SILHOUETTE, one dark line (the bars' own ink) with its top
//     corners cut two pixels, so the plate sits on the snow as a shape and
//     not a rectangle - the bottom corners stay square where they meet the
//     screen's edge, since a notch of world there reads as a hole;
//   * the EDGE, one faint line just inside it, following the same cuts;
//   * the GROUND inside that, one opaque colour.
// `ink` and `lit` are what a widget's state colours (the pack's full amber,
// a refusal's red): `lit` repaints the edge. Every margin inside the outline is three pixels -
// line, edge, ground - which is what AB_PAD and BAG_PAD are.
const HUD_INK = '#07080a';   // the silhouette
const HUD_EDGE = '#2f3238';  // the faint line inside it: one step off the ground, apart from the pack's amber and red states
const HUD_FROST = '#d4d7dc'; // a pale "on": the practice bar's lit toggles (cheats.js)
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
  // outline, edge, ground, each laid over the last one pixel in
  ctx.fillStyle = o.ink || HUD_INK;
  chamCut(x, y, w, h, c);
  ctx.fillStyle = o.lit || HUD_EDGE;
  chamCut(x + 1, y + 1, w - 2, h - 2, c);
  ctx.fillStyle = o.bg || AB_BG;
  chamCut(x + 2, y + 2, w - 4, h - 4, c);
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
// How far the strip drops to be AWAY: its own height plus the xp numbers
// standing over the portrait, so the whole widget clears the bottom edge
// rather than leaving a sliver of numbers over a cinematic.
const HUD_SLIDE = AB_H + XP_TAG + 5; // ...and their outline
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
// THE HUD SIZE DIALS (the ESC panel's GAME page): one per widget, so each
// part of the HUD is sized on its own - the strip (settings.hudScale), the
// top-left corner of weapon shelf and drawer (settings.hudCorner), the team
// rail along the top (settings.hudRail); the minimap has its own radius dial
// (settings.mmR, applyMinimapSize, js/core.js). Each widget keeps ALL its
// geometry in 1x space and its draw bakes it at 1x and blits it scaled about
// its anchor (drawHudScaled, drawCornerScaled, drawRailScaled); the pointer is
// mapped back through the same anchor (stripMouse, cornerMouse), so every hit
// test converts first and the rects themselves never move.
// A dial stops every HUD_FINE from HUD_MIN to HUD_MAX, plus on each CRISP size
// - one at which a HUD pixel is a whole number of device pixels, so a 1px
// line draws the same width wherever it falls (hudCrisp). A fine stop within
// half a step of a crisp one gives way to it, so the knob always lands on the
// crisp size near where it is dropped. Between crisp sizes some pixel rows
// draw one device pixel wider than others: the price of any size at all. The
// crisp sizes depend on the screen - halves on a 2x canvas, thirds on a 3x -
// and a dial never stops past the size where its widget would outgrow the
// view (the cap each widget passes, hudFit).
const HUD_MIN = 0.5, HUD_MAX = 2, HUD_FINE = 0.05;
function hudSnapDown(s) { return Math.max(1, Math.floor(s * devScale + 1e-6)) / devScale; }
// the crisp sizes in [HUD_MIN, cap]
function hudCrisp(cap) {
  const out = [], k0 = Math.max(1, Math.ceil(HUD_MIN * devScale - 1e-6));
  for (let k = k0; k / devScale <= Math.min(HUD_MAX, cap) + 1e-6; k++) out.push(k / devScale);
  return out;
}
// a dial's stops, low to high, never past `cap` (the widget's fit); cached
// per screen and cap
const hudSizesMemo = new Map();
function hudSizes(cap) {
  const key = devScale + ':' + cap;
  let out = hudSizesMemo.get(key);
  if (out) return out;
  const crisp = hudCrisp(cap), top = Math.min(HUD_MAX, cap);
  out = crisp.slice();
  for (let i = 0; HUD_MIN + i * HUD_FINE <= top + 1e-6; i++) {
    const v = Math.round((HUD_MIN + i * HUD_FINE) * 100) / 100;
    if (!crisp.some((c) => Math.abs(c - v) < HUD_FINE / 2 - 1e-6)) out.push(v);
  }
  if (!out.length) out.push(hudSnapDown(cap));
  out.sort((a, b) => a - b);
  hudSizesMemo.set(key, out);
  return out;
}
// the stop nearest a stored dial value
function hudPick(want, cap) {
  const S = hudSizes(cap);
  let best = S[0];
  for (const v of S) if (Math.abs(v - want) < Math.abs(best - want) - 1e-6) best = v;
  return best;
}
// the cap a widget `w` x `h` view px at 1x passes: the size at which it would
// reach the view's edges, on the device grid so a crisp size can sit there
function hudFit(w, h) { return hudSnapDown(Math.min((VIEW_W - 8) / w, (VIEW_H - 8) / h)); }
// THE SCALES. The strip's caps where its plate would outgrow the view; the
// corner's where its claim would cross half the view or its open drawer the
// view's foot. The rail's is railSc (js/ui/rail.js), capped by its own width.
function stripCap() { return hudFit(AB_W + 6, AB_H + XP_TAG); }
function cornerCap() { const f = bagFrameRect(); return hudFit(CORNER_CLAIM * 2, f.y + f.h + 6); }
function hudSc() { return hudPick(settings.hudScale || 1, stripCap()); }
function cornerSc() { return hudPick(settings.hudCorner || 1, cornerCap()); }
// a view coordinate put on the device grid, where a scaled HUD bake has to
// land for its pixels to stay whole
function hudPx(v) { return Math.round(v * devScale) / devScale; }
function stripMouse(mx, my) {
  const s = hudSc();
  if (s === 1) return { x: mx, y: my };
  return { x: VIEW_W / 2 + (mx - VIEW_W / 2) / s, y: VIEW_H + (my - VIEW_H) / s };
}
// well j, left to right after the portrait: 0-3 the abilities, then the meals
function stripCellRect(j) {
  const R = hudStripRect();
  const x = R.x + PORT_SQ + PORT_GAP + j * (AB_CELL + AB_GAP) + (j >= AB_N ? FOOD_GAP - AB_GAP : 0);
  return { x, y: R.y + AB_PAD, w: AB_CELL, h: AB_CELL };
}
// ability i's well: keys 1-4, in order after the portrait
function abCellRect(i) { return stripCellRect(i); }
// the portrait square, the plate's full inner height at its left end
function portraitRect() {
  const R = hudStripRect();
  return { x: R.x, y: R.y + AB_PAD, w: PORT_SQ, h: PORT_SQ };
}
// the health bar's and the stamina bar's insides, under the ability wells
function hpBarRect() { const r = abCellRect(0); return { x: r.x + 1, y: r.y + BAR_TOP + 1, w: AB_ROW_W - 2, h: HP_H }; }
function stBarRect() { const r = abCellRect(0); return { x: r.x + 1, y: r.y + ST_TOP + 1, w: AB_ROW_W - 2, h: ST_H }; }
// the two meal BUTTONS, in stripHit's 'food' order: the berry (0), the fish
// (1). Each carries the action whose key its corner prints and the input
// intent its press sets.
const FOOD_BTNS = [
  { type: 'berry', act: 'berry', intent: 'eatBerry' },
  { type: 'fish', act: 'fish', intent: 'eatFish' },
];
function foodCellRect(i) { return stripCellRect(AB_N + i); }
// the purse: a readout well under the meals, level with the two bars
function goldCellRect() {
  const r = foodCellRect(0);
  return { x: r.x, y: r.y + BAR_TOP, w: FOOD_W, h: ST_TOP + ST_H + 2 - BAR_TOP };
}
// THE FISH PICKER: the fish well holds three kinds (FISH_KINDS, js/player.js),
// and pointing at it raises a column of them straight up off the well - the
// ice fish nearest it, then the whitefish, then the snow char, each with how
// many you carry. With
// none picked all three stand lit and the key eats whichever comes next (the
// well shows that one); a click on one picks it, and the key eats only that
// (it rings gold, the others dim), and a click on the picked one lets it go.
// The pick is the body's own (p.fishPick), set through the input's cmd like
// every other order, so it holds online. It stays up while the pointer is on
// the well or the column. The column is a part of the strip, not a plate over
// it: its frame runs on down into the strip's (drawFishPop), so the rect below
// reaches into the strip's top frame. The fish well has no buy plate over it,
// so the column hides none.
const FISH_POP = ['fish', 'whitefish', 'snowChar']; // the column, bottom to top
const FISH_POP_NAME = 10;  // the hovered kind's name, standing over the column
function fishPopRect() {
  const s = foodCellRect(1), top = hudStripRect().y - (FISH_POP.length * AB_CELL + (FISH_POP.length - 1) * AB_GAP + AB_PAD);
  return { x: s.x - AB_PAD, y: top, w: AB_CELL + 2 * AB_PAD, h: s.y - top };
}
function fishPopCellRect(j) {
  const r = fishPopRect();
  return { x: r.x + AB_PAD, y: r.y + AB_PAD + (FISH_POP.length - 1 - j) * (AB_CELL + AB_GAP), w: AB_CELL, h: AB_CELL };
}
// is the column up, for a pointer at strip-space (mx, my)
function fishPopUp(mx, my) {
  if (state.mode !== 'play' || player.dead || state.paused || state.build || !hudHome() ||
      state.mapOpen || state.settingsOpen || state.wheel || window.DBG.hideUI || !mouse.inside) return false;
  const r = fishPopRect(), s = foodCellRect(1);
  if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < s.y) return true; // the column and the gap under it
  return mx >= s.x && mx < s.x + s.w && my >= s.y - 1 && my < s.y + s.h;
}
function fishPopHeadroom() {
  const m = stripMouse(mouse.x, mouse.y);
  return fishPopUp(m.x, m.y) ? hudStripRect().y - fishPopRect().y + FISH_POP_NAME + 2 : 0;
}
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
  const i = FISH_KINDS.includes(type) ? 1 : 0;
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
const AB_BUY_AIR = 3; // open screen between the plate's lowest bob (its shadow too) and the strip's outline
function abBuyRect(i) {
  const r = abCellRect(i);
  // the drawn plate sits 2 under the rect's top, bobs 1 either way and casts
  // 2 more of shadow: all of it stays AB_BUY_AIR clear of the strip's line
  return { x: r.x + ((r.w - AB_BUY) >> 1), y: r.y - AB_PAD - AB_BUY_AIR - AB_BUY - 5, w: AB_BUY, h: AB_BUY + 3 };
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
// { kind:'ab', i } | { kind:'food', i } | { kind:'fishPick', j } | { kind:'fishPop' } | { kind:'port' } | { kind:'frame' }
// | null. Shared by the click handler, the cursor and the strip's own hover
// so they cannot disagree.
function stripHit(mx, my) {
  if (state.mode !== 'play' || player.dead || state.paused ||
      state.mapOpen || state.settingsOpen || state.wheel || window.DBG.hideUI) return null;
  ({ x: mx, y: my } = stripMouse(mx, my));
  if (fishPopUp(mx, my)) {
    for (let j = 0; j < FISH_POP.length; j++) {
      const s = fishPopCellRect(j);
      if (mx >= s.x && mx < s.x + s.w && my >= s.y && my < s.y + s.h) return { kind: 'fishPick', j };
    }
    const r = fishPopRect();
    if (my < r.y + r.h + 2) return { kind: 'fishPop' }; // the row's frame and the gap: nothing, but not the world either
  }
  const R = hudStripRect();
  if (mx < R.x - 3 || mx >= R.x + R.w + 3 || my < R.y || my >= R.y + R.h) return null;
  for (let i = 0; i < AB_N; i++) {
    const s = abCellRect(i);
    if (mx >= s.x && mx < s.x + s.w && my >= s.y - 1 && my < s.y + s.h) return { kind: 'ab', i };
  }
  for (let i = 0; i < FOOD_BTNS.length; i++) {
    const s = foodCellRect(i);
    if (mx >= s.x && mx < s.x + s.w && my >= s.y - 1 && my < s.y + s.h) return { kind: 'food', i };
  }
  const pr = portraitRect();
  if (mx >= pr.x && mx < pr.x + pr.w && my >= pr.y && my < pr.y + pr.h) return { kind: 'port' };
  return { kind: 'frame' };
}

// ---- the weapon shelf ----------------------------------------------------
// THE ONE WEAPON, TOP-LEFT, ON SCREEN AT ALL TIMES (3.23): the tool in hand
// at the left end in its own bigger well, then its bit cells - projectiles on
// the left, modifiers on the right, the free cells between them (sortBits,
// js/tools.js). Order does nothing in a press any more, so the row is laid
// out to be READ: what flies, then what shapes it. It is the whole of what
// the HUD says about the arsenal - the strip has no weapon well, and
// everything else carried is in the drawer under this plate, shut until
// asked for (the backpack banner) - so one tool is read in one place, the way
// Noita's wand or Terraria's held item is.
//
// It stands on the hud frame, like the strip and the rail (4.18): one plate
// flush with the view's left edge and level with the minimap's top, hugging
// the row. The plate swallows its own clicks (shelfPlateHit). Over the row,
// INSIDE the plate, one line per modifier runs to every shot it powers; the
// plate grows down by a line's pitch for each, so the row sits under them.
const SHELF_CELL = HUD_CELL;   // the weapon's own well: the one HUD size
const SHELF_ITEM = 26;         // a bit cell: smaller than the weapon, so the weapon reads as what holds them
const SHELF_GAP = 3;           // the air between two bit cells
const SHELF_WGAP = 5;          // ...and between the weapon and its first bit
const SHELF_PAD = 4;           // the plate's ground round the row
const SHELF_LINE = 4;          // what one modifier's line costs over the row
const SHELF_TOP = MM_GAP;      // the plate's top edge: level with the minimap's and the rail's
const SHELF_SLOT = 0;          // the weapon slot it edits (TOOL_SLOTS is 1)
const SHELF_X = SHELF_PAD;     // the weapon well's left edge: the plate's ground in from the view's edge
const SHELF_MAX_BITS = 5;      // the widest body's cap (LONGBOW): what the corner reserves room for
// how many lines hang over the row: one per modifier loaded, since each one
// powers every shot (toolPlan)
function shelfLines() {
  const c = shelfCell();
  if (!c) return 0;
  let n = 0;
  for (const id of c.bits) if (id && !BITS[id].proj) n++;
  return n;
}
// the row's top: under the plate's margin and the lines over it
function shelfRowY() { const n = shelfLines(); return SHELF_TOP + SHELF_PAD + (n ? n * SHELF_LINE + 2 : 0); }
// the plate under the row: flush with the view's left edge, its ground round
// the row and the lines, hugging whatever the tool in hand is
function shelfPlateRect() {
  const y = SHELF_TOP;
  return { x: 0, y, w: shelfRowRight() + SHELF_PAD, h: shelfRowY() + SHELF_CELL + SHELF_PAD - y };
}
// whether the pointer is on that plate - the shelf's cells answer for
// themselves; this is the ground between them, which takes the click so it
// never falls through to the world
function shelfPlateHit(mx, my) {
  if (!shelfUp()) return false;
  ({ x: mx, y: my } = cornerMouse(mx, my));
  const r = shelfPlateRect();
  return mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h;
}
// the widest row a tool can grow to: the weapon and a longbow's five bits
const SHELF_ROW_MAX = SHELF_X + SHELF_CELL + SHELF_WGAP + SHELF_MAX_BITS * SHELF_ITEM + (SHELF_MAX_BITS - 1) * SHELF_GAP;
// how far in from the left edge the corner widget can reach: that row and the
// SHIFT plate off its end - what the intro slide and the bake are sized by,
// so neither jumps when the tool changes
const CORNER_REACH = SHELF_ROW_MAX + 80;
// WHAT THE CORNER CLAIMS OF THE FRAME, in view px at the corner's own size
// (cornerSc): the widest row a tool can ever grow to, or the drawer under it,
// whichever reaches further. The merchant's slab is pinned off this
// (shopLayout, js/shop.js) so a trade never stands on the pack it is dragged
// out of. It is the FIXED reach and not the live shelfRowRight(): the row
// grows with the tool in hand, and a slab that slid sideways when a swap
// changed the row mid-trade would walk out from under the pointer. The SHIFT
// plate CORNER_REACH allows for is left out of it - that is a hover hint,
// not a widget, and 80 px of room for one is 80 px the counter would lose.
const CORNER_CLAIM = Math.max(BAG_W, SHELF_ROW_MAX + SHELF_PAD); // ...and the plate's margin past it
function cornerClaim() { return Math.round(CORNER_CLAIM * cornerSc()); }
// ...and how far DOWN it reaches with the drawer open: the other half of the
// room a panel pinned off the corner has to miss, for a view too NARROW to
// stand one beside it. This one is measured live off the drawer, which sits
// under the plate and so moves with the lines over the row.
function cornerBottom() { const f = bagFrameRect(); return Math.round((f.y + f.h + 2) * cornerSc()); }
// the tool the shelf is showing, or null with the weapon well empty
function shelfCell() { return player.tools[SHELF_SLOT] || null; }
// ...and whether the shelf is on screen and answering the pointer at all: the
// backpack's own gate, since the two are one widget in the corner now
function shelfUp() {
  return state.mode === 'play' && !player.dead && !state.paused &&
    !state.mapOpen && !state.settingsOpen && !state.wheel && !window.DBG.hideUI;
}
// how many bit cells the row is
function shelfBits() { const c = shelfCell(); return c ? c.bits.length : 0; }
// Cell -1 is the TOOL, in the full-size well, and 0..cap-1 are its bits, in
// the smaller ones centred on the weapon's height: one row, left to right
// from the corner. A bigger tool grows the row rightward.
function shelfCellRect(i) {
  const y = shelfRowY();
  if (i < 0) return { x: SHELF_X, y, w: SHELF_CELL, h: SHELF_CELL };
  return { x: SHELF_X + SHELF_CELL + SHELF_WGAP + i * (SHELF_ITEM + SHELF_GAP), y: y + ((SHELF_CELL - SHELF_ITEM) >> 1), w: SHELF_ITEM, h: SHELF_ITEM };
}
// the row's right edge, where the SHIFT plate hangs
function shelfRowRight() { const n = shelfBits(); const r = shelfCellRect(n ? n - 1 : -1); return r.x + r.w; }
// What the pointer is on: { kind: 'tool' } | { kind: 'bit', i } | null. The
// gaps and the lines are not hit tested - they say things, they do not take
// anything, and the plate behind them swallows the click.
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
// WHICH FITTING POWERS WHICH SHOT, as one line per modifier over the row,
// running left to every shot it is in the envelope of. That is every shot
// now (toolPlan), but it is still read off toolPlan's own `mods`, so the
// picture cannot claim a rule the press does not follow. A tool with no shot
// loaded fires its own plain one, and the lines then run into the WEAPON
// well (cell -1), which is where that shot comes from.
//
// The modifier nearest the shots takes the line nearest the row and the
// ones further right stack above it, so no stem ever crosses a line.
function shelfRails(cell, plan) {
  const out = [];
  for (let i = 0; i < cell.bits.length; i++) {
    const id = cell.bits[i];
    if (!id || BITS[id].proj) continue;
    const hits = plan.shots.filter((s) => s.mods.indexOf(i) >= 0).map((s) => s.i);
    if (hits.length) out.push({ i, hits, col: BITS[id].col });
  }
  return out;
}
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
  if (sp) {
    if (sp.kind === 'sell' || sp.kind === 'sellAll') shopDropSell();
    else if (sp.kind === 'fWeapon' || sp.kind === 'fOre') forgeDrop(sp); // the bench (js/ui/forge.js)
    else dragReturn();
    return;
  }
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
// whole move: a bit in the grid loads into the weapon where it works (fitBit), a
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

// a grid cell: a tool swaps into the hand, a bit loads into the weapon, a
// consumable is used
function sendBagCell(i) {
  const s = player.bag[i];
  if (!s) return false;
  // with the counter's FORGE face up, a weapon or an ore goes onto the bench
  if (forgeTabOpen() && (isToolCell(s) || isOre(s.type))) return forgePut(s, 'bag', i, null);
  // a consumable (ITEMS[type].use): the click is the use, refusals and all
  if (ITEMS[s.type] && ITEMS[s.type].use) { ITEMS[s.type].use(); return true; }
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
  const at = cell ? fitBit(cell, id) : -1;
  if (at < 0) { toolDenied(); return true; } // no weapon, or every cell loaded
  if (--s.n <= 0) player.bag[i] = null;
  hudFx('place', 'bit', at, player.toolSel); // the cell it landed in lights, not the one it left
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
  sortBits(cell); // the row closes up behind it
  hudFx('place', 'bit', i, s);
  return true;
}
// the weapon well: the tool stows in the pack, bits and all, exactly as a bit
// does - the same gesture, one well over
function sendSlot(i) {
  const cell = player.tools[i];
  if (!cell) return false;
  if (forgeTabOpen()) return forgePut(cell, 'tool', i, null); // onto the bench, not into the pack
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
    if (sh.kind === 'ab') { if (msOn()) msWell(sh.i); else player.input.ability = sh.i; } // click-to-cast: the well IS the key (under MOUSE it readies - msWell)
    else if (sh.kind === 'food') player.input[FOOD_BTNS[sh.i].intent] = true; // the button IS the key, refusals and all (startEat)
    else if (sh.kind === 'fishPick') { // pick that fish, or let the picked one go
      const t = FISH_POP[sh.j];
      SFX.unlock();
      player.input.cmd = { kind: 'fishPick', type: player.fishPick === t ? null : t };
    }
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
    // a bit carried OUT of the row left a gap there; once nothing is in hand
    // the row closes up again (sortBits) - never mid-carry, while the gap is
    // still the carried bit's way home
    if (!state.drag && shelfCell()) sortBits(shelfCell());
    return true;
  }
  if (!q) return false;
  if (q.src.k === 'bag') { if (!sendBagCell(q.src.i)) bagClick({ kind: 'cell', i: q.src.i }); }
  else if (q.src.k === 'slot') sendSlot(q.src.i);
  else sendBitCell(q.src.slot, q.src.i);
  return true;
}
