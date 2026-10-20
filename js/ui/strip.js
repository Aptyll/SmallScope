'use strict';
// The hud strip's bones: its constants, the hud frame every bottom widget
// stands on, the HUD size dials, every cell rect and refusal flash, the drops,
// sending a cell across, and the press / move / release the drag is made of.
// Drawing is js/ui/hud-draw.js.
// ---- hud strip: portrait, wells and bars, bottom-centre ------------------
// One opaque plate, read left to right the way a MOBA's bottom bar is (0.426),
// and the one bar the HUD has:
//
//   [portrait] [1][2][3][4] [i1][i2][i3] [coin]
//              [ health bar ] [i4][i5][i6] [gold]
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
// THE SIX ITEMS stand after the abilities in a three-by-two grid of smaller
// wells (ITEM_CELL), left to right and top row first as the shop fills them
// (p.items, js/sim/items.js): the whole of what the HUD says about what you
// carry into a fight. Each slot has a key (ITEM_KEYS, js/app/input.js) and an
// empty one shows it, dim. A slot holding the POTION is pressed the way an
// ability is - its key or a click drinks one - and wears the key in its
// bottom-left corner, the stack in its top-right, and the drink's time left as
// the cooldown sweep; a refusal reddens and shakes it (itemDenied). Every
// other item is read, not pressed: a hover names what is there (tooltip.js).
// The hero's own basic attack has no well: it is the hero's, not a thing
// carried, and the portrait's hover names it (tipAttack, tooltip.js).
//
// After the items, the full height of the plate, THE PURSE: the coin over the
// gold, on screen for the whole match, since money is the number a player
// decides on all game.
const AB_CELL = HUD_CELL, AB_GAP = 2, AB_N = 4; // AB_CELL: a strip well (the one size, above); AB_N: abilities
const AB_PAD = 3;                         // the frame's outline, its edge and one px of ground (drawHudFrame)
const PORT_SQ = 51;                       // the portrait square, the plate's full inner height
const PORT_GAP = 4;                       // portrait to the first well
const AB_ROW_W = AB_N * AB_CELL + (AB_N - 1) * AB_GAP; // the four ability wells
const ITEM_CELL = 24, ITEM_GAP = 2;       // an item well, and the air between two
const ITEM_COLS = 3;                      // the six items: three wide, two high
const ITEM_GRID_W = ITEM_COLS * ITEM_CELL + (ITEM_COLS - 1) * ITEM_GAP;
const ITEM_X_GAP = 5;                     // abilities to the items
const PURSE_GAP = 5;                      // items to the purse
const PURSE_W = ITEM_CELL;                // the purse: one item well wide, the plate's full inner height
const HP_H = 7, ST_H = 4;                 // the health bar (tall enough for its number) and the stamina bar
const BAR_TOP = AB_CELL + 3;              // the health bar's outline, under the wells
const ST_TOP = BAR_TOP + HP_H + 1;        // the stamina bar's outline: shares the health bar's bottom ink
const XP_TAG = 9;                         // the xp numbers standing over the portrait
const AB_W = PORT_SQ + PORT_GAP + AB_ROW_W + ITEM_X_GAP + ITEM_GRID_W + PURSE_GAP + PURSE_W; // the content, inside the frame's pads
const AB_H = AB_PAD + ST_TOP + ST_H + 2 + AB_PAD; // wells, bars, the stamina bar's outline, the pads
const AB_BG = '#16181c';
// ---- the hud frame: the one plate the bottom widgets stand on ----------
// The strip and the team rail stand on one plate, drawn the way
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
// `ink` and `lit` are what a widget's state colours (a refusal's red): `lit` repaints the edge. Every margin inside the outline is three pixels -
// line, edge, ground - which is what AB_PAD and BAG_PAD are.
const HUD_INK = '#07080a';   // the silhouette
const HUD_EDGE = '#2f3238';  // the faint line inside it: one step off the ground
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
function hudStripRect() {
  // centred WITH the stat panel on its left (js/ui/statpanel.js): the two are
  // one widget, so the pair sits on the view's centre and scales about it
  return { x: Math.round((VIEW_W - AB_W + STAT_PANEL_W - 1) / 2), y: VIEW_H - AB_H, w: AB_W, h: AB_H };
}
// How far the strip drops to be AWAY: its own height plus the xp numbers
// standing over the portrait, so the whole widget clears the bottom edge
// rather than leaving a sliver of numbers over a cinematic.
const HUD_SLIDE = AB_H + XP_TAG + 5; // ...and their outline
// How far the HUD has slid in: 0 while it is away below the screen, 1 once it
// is home. The intro rides it up (renderUI) - and a ceremony PINS it there,
// because the drop brief's camera branch holds state.intro for the whole
// roost tour (js/sim/sim.js), which is how the HUD stays off a cinematic. Every
// piece that hangs in the open screen ABOVE the strip - the buy plates, which
// the slide is not deep enough to carry off the bottom on their own - asks
// this before it draws or answers the pointer, or it bobs there alone over a
// cinematic with no strip under it.
function hudInT() {
  return state.intro > 0 ? easeOut(Math.max(0, 1 - state.intro / HUD_IN_T)) : 1;
}
function hudHome() { return hudInT() >= 1; }
// THE HUD SIZE DIALS (the ESC panel's GAME page): one per widget, so each
// part of the HUD is sized on its own - the strip (settings.hudScale) and
// the team rail along the top (settings.hudRail); the minimap has its own radius dial
// (settings.mmR, applyMinimapSize, js/sim/core.js). Each widget keeps ALL its
// geometry in 1x space and its draw bakes it at 1x and blits it scaled about
// its anchor (drawHudScaled, drawRailScaled); the pointer is
// mapped back through the same anchor (stripMouse), so every hit
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
// THE SCALES. The strip's caps where its plate would outgrow the view. The rail's is railSc (js/ui/rail.js), capped by its own width.
function stripCap() { return hudFit(AB_W + 6 + STAT_PANEL_W - 1, AB_H + XP_TAG); }
function hudSc() { return hudPick(settings.hudScale || 1, stripCap()); }
// a view coordinate put on the device grid, where a scaled HUD bake has to
// land for its pixels to stay whole
function hudPx(v) { return Math.round(v * devScale) / devScale; }
function stripMouse(mx, my) {
  const s = hudSc();
  if (s === 1) return { x: mx, y: my };
  return { x: VIEW_W / 2 + (mx - VIEW_W / 2) / s, y: VIEW_H + (my - VIEW_H) / s };
}
// ability i's well: keys 1-4, in order after the portrait
function abCellRect(i) {
  const R = hudStripRect();
  return { x: R.x + PORT_SQ + PORT_GAP + i * (AB_CELL + AB_GAP), y: R.y + AB_PAD, w: AB_CELL, h: AB_CELL };
}
// item slot i's well (0..ITEM_SLOTS-1): the grid after the abilities, top row
// first; the rows share the plate's full inner height
function itemCellRect(i) {
  const R = hudStripRect(), x0 = R.x + PORT_SQ + PORT_GAP + AB_ROW_W + ITEM_X_GAP;
  return {
    x: x0 + (i % ITEM_COLS) * (ITEM_CELL + ITEM_GAP),
    y: R.y + AB_PAD + ((i / ITEM_COLS) | 0) * (ITEM_CELL + ITEM_GAP + 1),
    w: ITEM_CELL, h: ITEM_CELL,
  };
}
// the portrait square, the plate's full inner height at its left end
function portraitRect() {
  const R = hudStripRect();
  return { x: R.x, y: R.y + AB_PAD, w: PORT_SQ, h: PORT_SQ };
}
// the health bar's and the stamina bar's insides, under the ability wells
function hpBarRect() { const r = abCellRect(0); return { x: r.x + 1, y: r.y + BAR_TOP + 1, w: AB_ROW_W - 2, h: HP_H }; }
function stBarRect() { const r = abCellRect(0); return { x: r.x + 1, y: r.y + ST_TOP + 1, w: AB_ROW_W - 2, h: ST_H }; }
// the purse: a readout well after the items, the plate's full inner height
function goldCellRect() {
  const R = hudStripRect(), x0 = R.x + PORT_SQ + PORT_GAP + AB_ROW_W + ITEM_X_GAP + ITEM_GRID_W + PURSE_GAP;
  return { x: x0, y: R.y + AB_PAD, w: PURSE_W, h: 2 * ITEM_CELL + ITEM_GAP + 1 };
}
// The item wells' share of the refusal: a slot's key or click that could not
// be used - nothing usable in it, a potion already running, full health -
// reddens and shakes the well that was asked, in the red the ability wells
// already refuse in. useItem / drinkPotion are the one caller, so key and
// click speak alike; a second press on the same well while the red is up is
// swallowed. updateFx ages it on wall time.
let itemFlash = 0, itemFlashI = 0;
function itemDenied(i) {
  if (itemFlash > 0 && itemFlashI === i) return;
  itemFlash = 0.6;
  itemFlashI = i;
  SFX.deny();
}
// And the ability wells' share of it: a key nobody has spent a point on is
// LOCKED (abUnlocked, js/sim/abilities.js), and its well already stands dim with
// a dark icon - but a press has to answer, so the asked well reddens and
// shakes in the same red the item wells
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
// open screen ABOVE the well - a bobbing chevron, made a real
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
// { kind:'ab', i } | { kind:'item', i } | { kind:'port' } | { kind:'frame' } | null. Shared by the click handler, the cursor and the strip's own hover
// so they cannot disagree.
function stripHit(mx, my) {
  if (state.mode !== 'play' || player.dead || state.paused ||
      state.mapOpen || state.settingsOpen || state.wheel || window.DBG.hideUI) return null;
  ({ x: mx, y: my } = stripMouse(mx, my));
  const sp = statPanelHit(mx, my); // the stat panel left of the portrait (js/ui/statpanel.js)
  if (sp) return sp;
  const R = hudStripRect();
  if (mx < R.x - 3 || mx >= R.x + R.w + 3 || my < R.y || my >= R.y + R.h) return null;
  for (let i = 0; i < AB_N; i++) {
    const s = abCellRect(i);
    if (mx >= s.x && mx < s.x + s.w && my >= s.y - 1 && my < s.y + s.h) return { kind: 'ab', i };
  }
  for (let i = 0; i < ITEM_SLOTS; i++) {
    const s = itemCellRect(i);
    if (mx >= s.x && mx < s.x + s.w && my >= s.y && my < s.y + s.h) return { kind: 'item', i };
  }
  const pr = portraitRect();
  if (mx >= pr.x && mx < pr.x + pr.w && my >= pr.y && my < pr.y + pr.h) return { kind: 'port' };
  return { kind: 'frame' };
}

// ---- the press ------------------------------------------------------------
// A press on the HUD: the buy plate over an ability well, or a well of the
// strip itself. Returns whether it was the HUD's, so the world never sees it.
function hudPress(mx, my) {
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
    else if (sh.kind === 'item' && player.items[sh.i] === 'potion') player.input.useItem = sh.i; // the well IS the key, refusals and all (useItem)
    return true;
  }
  return false;
}
