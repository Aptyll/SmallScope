'use strict';
// The backpack and what the pointer carries: the drawer's geometry and hit
// tests, overHud, the drag verbs and what a gesture answers with, the
// character panel, the pack's SHIFT plate and drawBag.
// ---- the backpack: a DRAWER under the weapon shelf, top-left ------------
// THE HUD SHOWS ONE WEAPON (3.23): the shelf in the top-left corner is the
// tool in hand and the bits loaded into it, and everything else a player
// carries - the spare tools a walk turns up, the bits no cell had room for -
// is in a drawer that is INVISIBLE UNTIL ASKED FOR. The pack key (B, L3 on a
// pad) or the small arrow under the tool cell drops it down from beneath the
// shelf; the same again, or ESC, slides it back up. The merchant's counter
// drops it too, since a sale is a drag out of it. The pack is the overflow
// (fitAdd, js/tools.js): a found bit loads itself into a tool first, and a
// found tool goes in here, so the shelf never has to be read past.
//
// Small cells, on purpose: BAG_CELL px with the item art at 1x, a third the
// size of a well, because a spare is a thing you glance at and drag, not a
// thing you read all match - the shelf is for reading.
//
// ONE BACKGROUND, ONE FRAME, NO INTERNAL LINE. Every part of the drawer is
// the same opaque BAG_BG inside the strip's own chrome (drawHudFrame), so
// nothing inside reads as a separate panel stacked on another.
//
// Clicking a cell uses or sends what is in it. The drawer swallows every
// other click over itself so nothing is fired at the world through it. It
// does NOT stop the sim - it is HUD, not an overlay. Two things are said in
// colour rather than in words: the arrow (and the open drawer's light) goes
// amber when no cell is left free, and arrow and drawer alike redden when
// something could not be carried (bagDenied) - the drawer shaking with it.
//
// ONE WELL SIZE FOR THE HUD (3.23): the strip's ability wells and the
// shelf's cells are HUD_CELL square with their item art doubled
// (drawItemIcon's k), so a tool reads at the same size on the shelf as an
// ability does on the strip. The HUD SIZE dial scales both widgets: the
// strip about its bottom-centre anchor (drawHudScaled), the shelf and its
// drawer about the top-left corner (drawCornerScaled).
const HUD_CELL = 34;
const BAG_CELL = 18;   // a drawer cell: the art at 1x
const BAG_GAP = 2;     // between neighbouring cells
const BAG_PAD = 3;     // frame edge to the first cell: line, light, ground (drawHudFrame)
const BAG_COLS = 6;    // the drawer is six columns wide (BAG_CAP 12: two rows)
const BAG_W = BAG_PAD * 2 + BAG_COLS * BAG_CELL + (BAG_COLS - 1) * BAG_GAP;
const BAG_TAB_H = 7;   // the band under the tool cell the arrow sits in, and answers the pointer from
const BAG_SLIDE_T = 0.15; // s the drawer takes to drop or lift; updateFx eases it
let bagEase = 0;       // 0 shut .. 1 open, on wall time
const BAG_BG = '#0d1229';     // the whole frame
const BAG_BG_RED = '#4a121c'; // ... and while a refusal is up
// a filled cell recesses BELOW that ground, an empty one sits above it, so
// the three tones say occupied / free / frame without any line doing it
const BAG_WELL = '#080b1c';
let bagFlash = 0;      // seconds left of the "it does not fit" red; updateFx ages it
// The refusal tell, fired by every path that cannot store something. Re-firing
// while it is already up does not restart it, so standing on a drop you
// cannot carry is one flash and one sound, not sixty a second.
function bagDenied() {
  if (bagFlash > 0) return;
  bagFlash = 0.6;
  hudFx("deny"); // the ear and the hand, beside the red the flash paints
}
function bagGridH() {
  const rows = Math.ceil(player.bagCap / BAG_COLS);
  return rows * BAG_CELL + (rows - 1) * BAG_GAP;
}
// The drawer is OPEN whenever its own toggle says so, and also whenever the
// merchant's counter is up, because a sale is a DRAG out of it into the
// counter's sell well (js/shop.js). Everything that lays it out or hit-tests
// it asks this, never state.bagOpen; bagEase chases the answer.
function bagOpenNow() { return state.bagOpen || shopOpen(); }
// the handle's band, under the shelf's tool cell and level with the budget
// track beside it: the arrow is drawn in its middle, and the whole band
// answers the pointer so a small mark is not a small target
function bagTabRect() { return { x: SHELF_X, y: shelfRowY() + SHELF_CELL + 1, w: SHELF_CELL, h: BAG_TAB_H }; }
// the drawer, fully open: flush with the view's left edge, its top a px
// under the arrow's band, its first cell on the tool cell's own left edge
function bagFrameRect() {
  const t = bagTabRect();
  const h = BAG_PAD * 2 + bagGridH(); // pad, the grid, pad
  return { x: SHELF_X - BAG_PAD, y: t.y + t.h + 1, w: BAG_W, h };
}
// cell i of the inventory grid
function bagCellRect(i) {
  const f = bagFrameRect();
  return {
    x: f.x + BAG_PAD + (i % BAG_COLS) * (BAG_CELL + BAG_GAP),
    y: f.y + BAG_PAD + ((i / BAG_COLS) | 0) * (BAG_CELL + BAG_GAP),
    w: BAG_CELL, h: BAG_CELL,
  };
}
// the pointer is over HUD that owns its own clicks, not over the world
function overHud(x, y) {
  return !!bagHit(x, y) || !!charHit(x, y) || !!shopHit(x, y) || !!stripHit(x, y) || abBuyHit(x, y) >= 0 ||
    !!shelfHit(x, y) || overMinimap();
}
// THE CORNER SCALES WITH THE HUD SIZE DIAL, about the top-left corner
// (drawCornerScaled, below the shelf). Every rect in this banner and the
// shelf's stays in 1x space; a pointer is mapped back through the corner
// anchor here before any hit test reads it, the way stripMouse does for the
// strip, so a click can never land beside its pixel.
function cornerMouse(mx, my) {
  const s = hudSc();
  if (s === 1) return { x: mx, y: my };
  return { x: mx / s, y: my / s };
}
// What the pointer is on: { kind: 'tab' } (the arrow's band, always) | { kind:
// 'cell', i } (a grid slot) | { kind: 'frame' } (anywhere else inside the
// open drawer, swallowed and otherwise inert) | null. A drawer still moving
// answers nothing but its tab. Shared by the click handler, the cursor and
// the widget's own hover, so the three can never disagree.
function bagHit(mx, my) {
  if (!shelfUp()) return null;
  ({ x: mx, y: my } = cornerMouse(mx, my));
  const t = bagTabRect();
  if (mx >= t.x && mx < t.x + t.w && my >= t.y && my < t.y + t.h) return { kind: 'tab' };
  if (bagEase < 1) return null;
  const f = bagFrameRect();
  if (mx < f.x || mx >= f.x + f.w || my < f.y || my >= f.y + f.h) return null;
  for (let i = 0; i < player.bagCap; i++) {
    const r = bagCellRect(i);
    if (mx >= r.x && mx < r.x + r.w && my >= r.y - 1 && my < r.y + r.h) return { kind: 'cell', i };
  }
  return { kind: 'frame' };
}
// one left click on the widget; returns true if it was swallowed
function bagClick(h) {
  if (!h) return false;
  if (h.kind === 'tab') { state.bagOpen = !state.bagOpen; SFX.pickup(); return true; }
  if (h.kind === 'frame') return true; // the panel eats it; the world never sees it
  // a cell that a plain click could not send anywhere (sendAt tried first)
  SFX.deny();
  return true;
}

// ---- carrying an item on the cursor -------------------------------------
// One drag, shared by everything that can hold an item: the grid, the four
// weapon slots and the weapon shelf. `state.drag` is the cell riding the
// pointer - the SAME object the bag held, so a tool never loses its bits on
// the way across - and `from` is where to put it back when a release lands
// somewhere that will not take it.
//
// Releasing over the WORLD throws it: that is how a tool is thrown away, and
// the only way to get rid of one. Releasing anywhere on the HUD that is not a
// valid target returns it home instead, so the frame is a safe place to think
// better of a drag.
// ---- what a gesture answers with ----------------------------------------
// EVERY MOVE OF AN ITEM ANSWERS IN THREE PLACES AT ONCE: the ear (its own
// cue), the hand (a rumble on a pad, a buzz on a phone - `haptic`, input.js)
// and the eye (the well it landed in, pulsing). One function raises all three,
// so a new well or a new gesture cannot end up with two of the three and no
// one noticing; before this the drag rang a bare SFX at eleven call sites and
// a swap was inaudible against a plain put-down.
//
// FIVE KINDS, and they are a language rather than a volume: `grab` lifting
// something onto the cursor, `place` setting it into an empty well, `seat` the
// weapon well's heavier version of that, `swap` an exchange - the one move
// that hands you something BACK, so it is the longest cue, the hardest rumble
// and the only one that also pulses the cursor - and `deny` a refusal.
const WELL_LIT_T = 0.3;   // s a well glows after something landed in it
const DRAG_LIT_T = 0.36;  // ...and the cursor, when the hand's contents changed
let wellLit = null;       // { k, i, slot, t, col } - k is 'bag' | 'slot' | 'bit'
let dragLit = 0;
// the colours are the same four the hovered well uses to say what a release
// WILL do (dropKindAt), so the promise and the answer are one language
const FX_PLACE = '#9fe0ff', FX_MERGE = '#8fe08a', FX_SWAP = '#ffd95c', FX_DENY = '#c2465a';
const HUD_FX = {
  grab:  { sfx: () => SFX.pickup(), col: '#8fa0c8' },
  place: { sfx: () => SFX.stash(),  col: FX_PLACE },
  merge: { sfx: () => SFX.stash(),  col: FX_MERGE },
  seat:  { sfx: () => SFX.place(),  col: FX_PLACE },
  swap:  { sfx: () => SFX.swap(),   col: FX_SWAP, hand: true },
  deny:  { sfx: () => SFX.deny(),   col: FX_DENY },
};
// `k`/`i`/`slot` name the well that answered, or nothing at all for a gesture
// with no well behind it (a throw out onto the snow)
function hudFx(kind, k, i, slot) {
  const f = HUD_FX[kind];
  if (!f) return;
  f.sfx();
  haptic(kind);
  if (k) wellLit = { k, i: i | 0, slot: slot | 0, t: WELL_LIT_T, col: f.col };
  if (f.hand) dragLit = DRAG_LIT_T;
}
// how lit a well is, 1 the moment something landed and 0 by the end of it
function wellLitAt(k, i, slot) {
  if (!wellLit || wellLit.k !== k || wellLit.i !== i) return 0;
  if (k === 'bit' && wellLit.slot !== (slot | 0)) return 0;
  return Math.min(1, wellLit.t / WELL_LIT_T);
}
// the wash itself, over a well that has just taken something
function drawWellLit(r, k, i, slot) {
  const lit = wellLitAt(k, i, slot);
  if (lit <= 0) return;
  ctx.globalAlpha = 0.5 * lit;
  ctx.fillStyle = wellLit.col;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalAlpha = 1;
}

// WHAT LETTING GO HERE WOULD DO, asked of the well under the pointer while
// something is on the cursor, and answered in colour alone on that well's rim
// (drawBag / drawShelf). It is the other half of the press arming rather than
// acting: a gesture you can call off is only worth having if you can see what
// you are about to do before you commit to it - and a bit held over the weapon
// KEY reddening before the release is the refusal said in advance rather than
// after the fact.
//
// It reads the same branches the three dragDrop* functions take, so the
// promise and the move can never disagree.
function dropKindBag(i) {
  const d = state.drag;
  if (!d) return null;
  const s = player.bag[i];
  if (!s) return 'place';
  const max = ITEMS[d.cell.type] ? ITEMS[d.cell.type].stack : 1;
  if (s.type === d.cell.type && !s.bits && s.n < max) return 'merge';
  return 'swap';
}
function dropKindSlot(i) {
  const d = state.drag;
  if (!d) return null;
  if (!isToolCell(d.cell)) return 'deny'; // a bit belongs in a tool, not on a key
  return player.tools[i] ? 'swap' : 'place';
}
function dropKindBit(s, i) {
  const d = state.drag;
  if (!d) return null;
  if (!bitIdOf(d.cell.type)) return 'deny'; // a tool does not go inside a tool
  const cell = player.tools[s];
  if (!cell) return 'deny';
  return cell.bits[i] ? 'swap' : 'place';
}
const DROP_RIM = { place: FX_PLACE, merge: FX_MERGE, swap: FX_SWAP, deny: FX_DENY };
function dropRim(kind) { return kind ? DROP_RIM[kind] : null; }
// ...and it is drawn as a ring OUTSIDE the well and LAST, over the carried
// ghost rather than under it (drawDropPromise, called after drawDragGhost).
// The thing asking the question is an 18px ghost sitting on an 18px cell, so
// a rim inside the well - or a ring drawn with the well - is a ring nobody
// ever sees. Every gap here is 2px and the frame's pad 3, so it never touches
// a neighbour.
function drawDropRing(r, kind) {
  const col = dropRim(kind);
  if (!col) return;
  ctx.fillStyle = col;
  ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, 1);
  ctx.fillRect(r.x - 2, r.y + r.h + 1, r.w + 4, 1);
  ctx.fillRect(r.x - 2, r.y - 2, 1, r.h + 4);
  ctx.fillRect(r.x + r.w + 1, r.y - 2, 1, r.h + 4);
}

function dragTake(cell, from) {
  if (!cell) return false;
  state.drag = { cell, from };
  hudFx('grab');
  return true;
}
// Lifting what a well is holding onto the cursor: the move a press that
// TRAVELS makes (hudMove), one function over the three kinds of well so the
// three branches cannot drift apart. Returns whether anything was lifted.
function dragLift(src) {
  if (src.k === 'bag') {
    const s = player.bag[src.i];
    if (!s) return false;
    player.bag[src.i] = null;
    return dragTake(s, src);
  }
  if (src.k === 'slot') {
    const s = player.tools[src.i];
    if (!s) return false;
    player.tools[src.i] = null;
    return dragTake(s, src);
  }
  const cell = player.tools[src.slot];
  const was = cell && bitPut(cell, src.i, null);
  return was ? dragTake({ type: bitType(was), n: 1 }, src) : false;
}
// Put a carried cell back where the drag started. Home may have been filled
// behind it (the drop that landed there, a swap earlier in the same gesture),
// so every branch falls back to any free bag cell and then to the snow -
// nothing carried is ever destroyed by putting it down.
function dragReturn() {
  const d = state.drag;
  if (!d) return;
  const f = d.from;
  let home = false;
  if (f.k === 'bag') { if (!player.bag[f.i]) { player.bag[f.i] = d.cell; home = true; } }
  else if (f.k === 'slot') { if (!player.tools[f.i]) { player.tools[f.i] = d.cell; home = true; } }
  else if (f.k === 'bit') {
    // a bit came out of a tool as a one-off cell; it goes back as an id
    const t = player.tools[f.slot];
    if (t && !t.bits[f.i]) { t.bits[f.i] = bitIdOf(d.cell.type); home = true; }
  }
  if (!home && !bagPut(player, d.cell)) throwCell(d.cell);
  state.drag = null;
}
// THE WORLD TAKES IT, AND IT GOES WHERE IT WAS AIMED. A release out on the
// snow throws the item along the cursor's heading off the body rather than
// tipping it out at the feet, so "put this over there" is a gesture and not a
// wish - and for TOSS_LOCK_T seconds it is deaf to the hand that threw it
// (lockDrop, js/core.js), because the pickup magnet would otherwise reel
// straight back in what you just dragged out.
//
// A TOOL LEAVES ITS BUILD BEHIND ON THE WAY OUT (shedBits, js/tools.js): the
// bits scatter around the body, each its own drop, carrying the throw's own
// heading plus a kick. What lands is a bare weapon in a spray of fittings.
function throwCell(cell) {
  const p = player;
  let hx = p.input.aimX - p.x, hy = p.input.aimY - p.y;
  // the cursor sitting on the body is no heading at all: fall back to the
  // way the body is facing, so a throw is never a drop straight down
  if (Math.hypot(hx, hy) < 1) {
    hx = p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0;
    hy = p.dir === 'up' ? -1 : p.dir === 'down' ? 1 : 0;
  }
  const m = Math.hypot(hx, hy) || 1;
  shedBits(cell, p.x, p.y - 4, hx, hy, p);
  lockDrop(flingDrop(spawnDrop(p.x, p.y - 4, cell.type, cell.n, cell.bits ? cell : null),
    hx / m * TOSS_SPEED, hy / m * TOSS_SPEED), p);
  hudFx('place'); // no well behind this one: it went out onto the snow
}
// Where the item a drop DISPLACES goes: HOME, the well this drag started
// from. That well is the one place already known to be free - it is where
// what is in hand came out of - so a drop onto a loaded well is a straight
// SWAP, the same one move each way the CLICK already makes (sendBagCell),
// instead of leaving the ousted item stuck to the cursor to be filed by hand.
//
// Home can be gone by the time it is asked: a stack that did not empty is
// still sitting in it, an earlier swap in the same gesture filled it, or it
// cannot hold this kind at all (a berry does not go in a bit cell, a bit does
// not go on the weapon key). Then this says no and the caller falls back to
// what it always did - the ousted item rides the cursor, which is free,
// because what was on it is what just went into the well.
function dragHome(out, from) {
  if (!from) return false;
  if (from.k === 'bag') {
    const s = player.bag[from.i];
    if (!s) { player.bag[from.i] = out; return true; }
    // refilled with more of its own kind: top that stack up instead
    const max = ITEMS[out.type] ? ITEMS[out.type].stack : 1;
    if (s.type === out.type && !s.bits && !out.bits && s.n + out.n <= max) { s.n += out.n; return true; }
    return false;
  }
  if (from.k === 'slot') {
    if (!isToolCell(out) || player.tools[from.i]) return false;
    player.tools[from.i] = out;
    return true;
  }
  const cell = player.tools[from.slot], id = bitIdOf(out.type);
  if (!id || out.n > 1 || !cell || cell.bits[from.i]) return false;
  bitPut(cell, from.i, id);
  return true;
}
// a carried cell landing on grid cell i: merge into the same kind if it will
// take it, otherwise swap with whatever is sitting there - what was here
// going back where the carried item came from (dragHome)
function dragDropBag(i) {
  const d = state.drag, s = player.bag[i];
  if (!s) { player.bag[i] = d.cell; state.drag = null; hudFx('place', 'bag', i); return true; }
  const max = ITEMS[d.cell.type] ? ITEMS[d.cell.type].stack : 1;
  if (s.type === d.cell.type && !s.bits && s.n < max) {
    const take = Math.min(d.cell.n, max - s.n);
    s.n += take; d.cell.n -= take;
    if (d.cell.n <= 0) state.drag = null;
    hudFx('merge', 'bag', i);
    return true;
  }
  player.bag[i] = d.cell;                 // the swap...
  state.drag = null;
  // ...and either the ousted item found its way home, or it is now in your
  // hand - which is the one outcome a gesture can hand you without asking, so
  // it is the one that rings the swap cue, rumbles hardest and pulses the
  // cursor itself (hudFx's `hand`)
  if (dragHome(s, d.from)) hudFx('place', 'bag', i);
  else { state.drag = { cell: s, from: { k: 'bag', i } }; hudFx('swap', 'bag', i); }
  return true;
}
// One cell, and the reason nothing in here is bigger than anything else:
// grid slots and gear plates all come out of this. Returns
// the y it actually drew at, since a hover lift shifts it.
function bagCellPlate(r, rim, inner, lift) {
  const y = r.y - (lift ? 1 : 0);
  ctx.fillStyle = rim;
  ctx.fillRect(r.x, y, r.w, r.h);
  ctx.fillStyle = inner;
  ctx.fillRect(r.x + 1, y + 1, r.w - 2, r.h - 2);
  return y;
}

// ---- the character panel (G) ---------------------------------------------
// WoW's C key, at this game's size: one slab, sim running live behind it.
// LEFT: the body as it stands right now - the class sprite walking in place
// at 4x wearing its bought gear bands in their level materials
// (drawGearMarks, the same pixels every rival reads on you in the world) with
// the held weapon beside it - and under it the STAT LEDGER, GEAR_STATS read
// off the LIVE kit (kitOf), so gear levels, ability ranks and cards are all
// in the numbers. RIGHT: the four equipped pieces, each a 32px icon well
// (gearIcon32) with its variant name, gear's buy pips, and the next level's
// price; a click on an affordable well buys through the same input.cmd the
// old HUD row used, so bots and the panel still share one path. The ledger's
// labelled rows are the panels' text carve-out - comparing numbers is this
// panel's whole job. G toggles it, ESC or the X closes it; it swallows only
// its own clicks, so the fight stays live around it.
const CHAR_LEDW = 118, CHAR_WELL = 36;
function charLayout() {
  const rowW = 128;
  const pw = 8 + CHAR_LEDW + 10 + rowW + 8;
  const ph = 226;
  const px = Math.round((VIEW_W - pw) / 2), py = Math.round((VIEW_H - ph) / 2);
  const gx = px + 8 + CHAR_LEDW + 10;
  const rows = [];
  for (let i = 0; i < GEAR_SLOTS.length; i++) {
    rows.push({ x: gx, y: py + 22 + i * 50, w: rowW, h: CHAR_WELL });
  }
  return { panel: { x: px, y: py, w: pw, h: ph }, rows,
    prev: { x: px + 8, y: py + 22, w: CHAR_LEDW, h: 78 },
    led: { x: px + 8, y: py + 106, w: CHAR_LEDW },
    xr: { x: px + pw - 14, y: py + 4, w: 10, h: 10 } };
}
// 'x' | { piece } | 'panel' | null - shared by the click, the cursor and the
// tooltip so the three cannot disagree
function charHit(mx, my) {
  if (!state.charOpen || state.mode !== 'play' || player.dead || state.paused ||
      state.mapOpen || state.settingsOpen || state.wheel || window.DBG.hideUI) return null;
  const L = charLayout();
  const p = L.panel;
  if (mx < p.x || mx >= p.x + p.w || my < p.y || my >= p.y + p.h) return null;
  if (mx >= L.xr.x && mx < L.xr.x + L.xr.w && my >= L.xr.y && my < L.xr.y + L.xr.h) return 'x';
  for (let i = 0; i < L.rows.length; i++) {
    const r = L.rows[i];
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return { piece: i };
  }
  return 'panel';
}
// the piece index under the pointer, or -1 - the shape tipAt and the cursor
// already read gear through, kept so both keep working unchanged
function gearHit(mx, my) {
  const h = charHit(mx, my);
  return h && h.piece !== undefined ? h.piece : -1;
}
// a press inside the panel; returns whether it was swallowed
function charClick(h) {
  if (!h) return false;
  if (h === 'x') { state.charOpen = false; SFX.pickup(); return true; }
  if (h.piece !== undefined) { SFX.unlock(); player.input.cmd = { kind: 'gear', piece: h.piece }; return true; }
  return true; // the slab eats it; the world never sees it
}
function drawCharPanel(now) {
  const L = charLayout();
  const { panel } = L;
  const gh = mouse.inside ? charHit(mouse.x, mouse.y) : null;
  // a light dim: the match stays visible and live around the slab
  ctx.fillStyle = 'rgba(4,6,18,0.38)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // the slab, in the planks' own chrome
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; chamRect(panel.x + 3, panel.y + 3, panel.w, panel.h);
  ctx.fillStyle = '#0a0e23'; chamRect(panel.x, panel.y, panel.w, panel.h);
  ctx.fillStyle = '#10173a'; chamRect(panel.x + 1, panel.y + 1, panel.w - 2, panel.h - 2);
  ctx.fillStyle = '#35426e';
  ctx.fillRect(panel.x + 2, panel.y + 1, panel.w - 4, 1); ctx.fillRect(panel.x + 1, panel.y + 2, 1, panel.h - 4);
  ctx.fillStyle = '#080c1c';
  ctx.fillRect(panel.x + 2, panel.y + panel.h - 2, panel.w - 4, 1); ctx.fillRect(panel.x + panel.w - 2, panel.y + 2, 1, panel.h - 4);
  // the header: whose sheet this is - the name in the team's mark, the class
  // and hero level beside it in quiet ink
  const head = player.name;
  const sub = CLASSES[player.cls].name + ' ' + player.level;
  drawPixelTextShadow(ctx, head, panel.x + 8, panel.y + 6, TEAMS[skin(player.team)].mark, '#0a0e23');
  drawPixelTextShadow(ctx, sub, panel.x + 8 + pixelTextWidth(head) + 8, panel.y + 6, '#7a8bb8', '#0a0e23');
  // the body, live: walking in place with its bought bands in their level
  // materials and the held weapon beside it
  const pr = L.prev;
  ctx.fillStyle = '#0a0e23';
  ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
  ctx.fillStyle = '#232c52';
  ctx.fillRect(pr.x, pr.y, pr.w, 1); ctx.fillRect(pr.x, pr.y + pr.h - 1, pr.w, 1);
  ctx.fillRect(pr.x, pr.y, 1, pr.h); ctx.fillRect(pr.x + pr.w - 1, pr.y, 1, pr.h);
  const sx = pr.x + 12, sy = pr.y + 7;
  ctx.fillStyle = 'rgba(4,6,18,0.6)';
  ctx.beginPath(); ctx.ellipse(sx + 32, pr.y + pr.h - 6, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
  const spr = SPRITES.champLook(player.cls, player.look, skin(0)).down[1 + (Math.floor(now * 3) % 2)];
  ctx.drawImage(spr, sx, sy, 64, 64);
  drawGearMarks(player, sx, sy, 4);
  const held = heldTool(player);
  if (held) {
    const im = SPRITES[ITEMS[held.type].icon];
    ctx.drawImage(im, pr.x + pr.w - 31, pr.y + pr.h - 33 + Math.round(Math.sin(now * 2.2) * 1.5), 24, 24);
  }
  // the ledger: every number the kit carries RIGHT NOW - gear levels, ability
  // ranks and cards already folded in, because it reads the live kit
  const k = kitOf(player);
  for (let i = 0; i < GEAR_STATS.length; i++) {
    const [label, get, fmt] = GEAR_STATS[i];
    const y = L.led.y + i * 8;
    drawPixelTextShadow(ctx, label, L.led.x, y, '#7a8bb8', '#0a0e23');
    const vTxt = fmt(get(k));
    drawPixelTextShadow(ctx, vTxt, L.led.x + L.led.w - pixelTextWidth(vTxt), y, '#f4f7ff', '#0a0e23');
    ctx.fillStyle = '#2c3a68'; // the leader: dots from the label to its number
    for (let dx = L.led.x + pixelTextWidth(label) + 4; dx < L.led.x + L.led.w - pixelTextWidth(vTxt) - 4; dx += 4) {
      ctx.fillRect(dx, y + 4, 2, 1);
    }
  }
  // the four equipped pieces: icon well, variant name in the level's
  // material, gear's buy pips, and the next level's price
  for (let i = 0; i < L.rows.length; i++) {
    const r = L.rows[i], lv = player.gearLv[i], cost = gearCost(player, i);
    const afford = cost && player.inv.gold >= cost.gold;
    const on = gh && gh.piece === i;
    const y = r.y - (on ? 1 : 0);
    ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(r.x + 2, r.y + 2, CHAR_WELL, CHAR_WELL);
    ctx.fillStyle = !cost ? '#c89a3c' : on ? '#8fa0c8'
      : afford ? (Math.sin(now * 8) > 0 ? '#f2cc6a' : '#c9a227') : '#2c3560';
    ctx.fillRect(r.x, y, CHAR_WELL, CHAR_WELL);
    ctx.fillStyle = '#0f1632';
    ctx.fillRect(r.x + 1, y + 1, CHAR_WELL - 2, CHAR_WELL - 2);
    ctx.drawImage(gearIcon32(i, player.gear[i]), r.x + 2, y + 2);
    const tx0 = r.x + CHAR_WELL + 6;
    drawPixelTextShadow(ctx, GEAR[i][player.gear[i]].name, tx0, y + 4, GEAR_MATS[lv - 1], '#0a0e23');
    for (let p2 = 0; p2 < GEAR_LV_MAX - 1; p2++) { // the buys, gear's own pips
      ctx.fillStyle = p2 < lv - 1 ? '#f2cc6a' : '#2c3560';
      ctx.fillRect(tx0 + p2 * 5, y + 14, 4, 2);
    }
    if (cost) { // the price, coin + number, in can/cannot ink
      ctx.drawImage(SPRITES.itemGold, tx0, y + 22);
      drawPixelTextShadow(ctx, String(cost.gold), tx0 + 10, y + 24,
        afford ? '#f5c542' : '#9fb6d8', '#0a0e23');
    }
  }
  // the X: the one way out that is drawn (ESC and G also close)
  const hot = gh === 'x';
  ctx.fillStyle = hot ? '#8fa0c8' : '#35426e';
  ctx.fillRect(L.xr.x, L.xr.y, L.xr.w, L.xr.h);
  ctx.fillStyle = '#0f1632';
  ctx.fillRect(L.xr.x + 1, L.xr.y + 1, L.xr.w - 2, L.xr.h - 2);
  ctx.fillStyle = hot ? '#f4f7ff' : '#8fa8d0';
  for (let k2 = 0; k2 < 4; k2++) {
    ctx.fillRect(L.xr.x + 3 + k2, L.xr.y + 3 + k2, 1, 1);
    ctx.fillRect(L.xr.x + L.xr.w - 4 - k2, L.xr.y + 3 + k2, 1, 1);
  }
}

// The shared meal clock over one food well: the cooldown SWEEPING round it
// behind the hand (drawSweepCover, the strip's one cooldown shape), or a white
// lift while THIS meal is the one being chewed - the two states an ability
// well already draws, said about food. (x, y, w, h) is the well's inner rect;
// the meal buttons are the only surface left that draws it, but it stays a
// function of the rect so anything that shows a meal wears the same clock.
function drawFoodClock(x, y, w, h, type) {
  const p = player;
  if (p.eatT > 0 && p.eatType === type) {
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#f4f7ff';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    return;
  }
  if (p.foodCd <= 0) return;
  // the hand only where there is room for one: under about twelve pixels it
  // is four long and lands ACROSS the icon, reading as a scratch on the fruit
  // rather than a clock over it, so the smallest wells turn the bare veil -
  // the same wedge sweeping the same way, minus the stroke that would own the
  // icon
  drawSweepCover(x, y, w, h, Math.min(1, p.foodCd / FOOD_CD), CD_SWEEP, w >= 12 ? CD_EDGE : null);
}

// ---- the pack's SHIFT plate ---------------------------------------------
// The one keybind indicator the backpack carries (the carve-out CLAUDE.md's
// UI rule names), in the world prompts' own key-cap grammar. It is up while
// the pointer is on a well that has somewhere to send what it holds - a bit
// in the grid (into the weapon), a bit on the shelf or a tool on the
// weapon (back into the pack), a tool in the grid (into your hands) - and its
// verb is that DESTINATION, so the plate teaches which way the transfer goes
// rather than merely announcing a key. The cap depresses while shift is
// actually down, so it also answers "is it registering".
//
// Shift-click IS that transfer, in both hands: with an empty one it is the
// plain click's own move (hudRelease), and while carrying something it is
// sendAt, which spends the click on this well and leaves the hand loaded. The
// verb reads the same either way, because the well's item goes the same way.
function shiftVerb(mx, my) {
  if (!mouse.inside || player.dead) return null;
  const fh = shelfHit(mx, my);    // the same wells, in the same order, sendAt tries
  if (fh) return (fh.kind === 'bit' ? shelfCell().bits[fh.i] : shelfCell()) ? 'STOW' : null;
  const bh = bagHit(mx, my);
  if (!bh || bh.kind !== 'cell') return null;
  const s = player.bag[bh.i];
  if (isToolCell(s)) return 'HOLD';                    // trades places with the weapon
  return s && bitIdOf(s.type) && heldTool(player) ? 'LOAD' : null;
}
function drawShiftHint() {
  const verb = shiftVerb(mouse.x, mouse.y);
  if (!verb) return;
  // off the shelf row's right end, level with its cells - clear of the
  // rails above the row and of the drawer below it
  drawKeyPrompt(shelfRowRight() + 5, shelfRowY() + 12, verb, keyHeld('slide'), 'slide');
}

function drawBag(now) {
  if (!shelfUp()) return;
  const hov = mouse.inside ? bagHit(mouse.x, mouse.y) : null;
  const red = bagFlash > 0, full = bagUsed(player) >= player.bagCap, open = bagOpenNow();
  const shake = red ? (((now * 40) | 0) % 2 ? -1 : 1) : 0;
  const t = bagTabRect();
  // THE DRAWER, sliding out from under the tab: clipped to the screen below
  // the tab's bottom edge, so it emerges rather than fades. The strip's own
  // chrome (drawHudFrame), every corner cut and no snow cap - it lives under
  // the shelf, not under the sky. No cast shadow: the cells already carry
  // the depth. The light says the one state the grid cannot: amber means no
  // cell is left free, and a refusal reddens line and light both.
  if (bagEase > 0) {
    const f = bagFrameRect();
    const lift = Math.round((1 - easeOut(bagEase)) * (f.h + 3));
    ctx.save();
    ctx.beginPath(); ctx.rect(-8, t.y + t.h + 1, VIEW_W + 16, VIEW_H); ctx.clip();
    ctx.translate(shake, -lift);
    drawHudFrame(f.x, f.y, f.w, f.h, {
      bg: red ? BAG_BG_RED : BAG_BG, ink: red ? '#7a2436' : null,
      lit: red ? '#c2465a' : full ? '#c9922f' : null,
      corners: { tl: false, tr: true, bl: false, br: true }, cap: false, seed: 47, // flush left: only the free corners cut
    });
    for (let i = 0; i < player.bagCap; i++) {
      const r = bagCellRect(i), s = player.bag[i];
      const on = hov && hov.kind === 'cell' && hov.i === i;
      // an EMPTY cell is the lighter one. It has no icon to show off, so the
      // well itself has to be the thing you see - free space is what the grid
      // is being read for - while a full cell goes dark behind its item. A
      // tool or a bit brings its own ground: the tier plate, which is where
      // the whole "how good is this find" question is answered.
      const tp = s ? tierPlate(s.type, on) : null;
      const y = bagCellPlate(r, on ? '#8fa0c8' : s ? tp.rim : '#2c3560',
        s ? tp.plate : '#171f45', on && s);
      const wl = { x: r.x, y, w: r.w, h: r.h }; // the plate's own rect, which a lift raises a pixel
      if (!s) { drawWellLit(wl, 'bag', i); continue; }
      modPlate(s.type, r, y);
      tierShine(r, y, s.type, now);
      // the icon sits high in the cell so the count can have the bottom
      // right corner without its outline eating the cell's own rim
      drawItemIcon(s.type, r, y - 2);
      if (s.n > 1) { // a lone item needs no '1' on it - an empty corner says it
        const n = String(s.n);
        drawPixelTextOutline(ctx, n, r.x + r.w - 3 - pixelTextWidth(n), y + 10, '#f4f7ff', '#0f1632');
      }
      // a loaded tool counts its bits in the corner the stack number would
      // have used, so a full build is told apart from a bare body in the grid
      if (s.bits) {
        for (let k = 0; k < s.bits.length && k < 5; k++) {
          ctx.fillStyle = s.bits[k] ? BITS[s.bits[k]].col : '#2c3560';
          ctx.fillRect(r.x + 3 + k * 3, y + r.h - 4, 2, 2);
        }
      }
      // ...and last, over everything in it: the pulse a cell wears for a
      // beat after something landed there, in the colour of what happened
      drawWellLit(wl, 'bag', i);
    }
    ctx.restore();
  }
  // THE ARROW: the drawer's handle, a plain small chevron under the tool
  // cell with no plate behind it - white, rimmed a pixel dark so it reads on
  // snow the way every mark over the world does - pointing the way the
  // drawer will go, down to open and up to shut. Nothing moves: its colour is
  // its only state - gold under the pointer, amber when no cell is free, red
  // on a refusal - so it stays the quietest thing in the corner.
  const onTab = hov && hov.kind === 'tab';
  const col = red ? '#e0637a' : onTab ? '#ffd95c' : full ? '#c9922f' : '#f4f7ff';
  const ax = t.x + (t.w >> 1), ay = t.y + 2; // the arrow's centre column and top row
  const stamp = (ox, oy, c) => {
    ctx.fillStyle = c;
    for (let d = 0; d < 4; d++) {
      const yy = (open ? ay + 3 - d : ay + d) + oy;
      ctx.fillRect(ax - 3 + d + ox, yy, 1, 1);
      ctx.fillRect(ax + 3 - d + ox, yy, 1, 1);
    }
  };
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (ox || oy) stamp(ox, oy, '#0f1632');
  stamp(0, 0, col);
  drawShiftHint(); // outside the refusal shake: the plate is not what refused
}
