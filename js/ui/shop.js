'use strict';
// THE MERCHANT'S COUNTER: the one place gold turns into items and goods turn
// back into gold. Each eagle's driver (the `merchant` banner, js/sim/robots.js)
// climbs down at the crash, fells its back woods and raises the bot bays,
// and keeps to the lane mouth between jobs - and standing beside it, or its
// stall, opens this.
//
// BOTH counters serve EVERYBODY. Your own roost's merchant is the near one and
// the rival's is a walk through their base, but neither asks whose side you
// are on, which is exactly why a merchant cannot be killed (unitAlive,
// js/sim/actions.js): a shop nobody can reach is not a shop.
//
// It is an ITEMS shop in League's mould (js/sim/items.js owns the items):
// every item is on sale all the time, at one fixed price, so a player can
// save up for the one they want. Nothing in it moves and nothing sells out. Three things live here:
//   - the COUNTERS: which one a body is standing at, and the reach that keeps
//     the panel open.
//   - BUYING AND SELLING: items through buyItem/sellItem (the health potion
//     stacks in one slot).
//   - the PANEL, League's: RECOMMENDED and ALL ITEMS on the left, the picked
//     item on the right with BUILDS INTO, its tree and BUY, and along the
//     bottom your six slots with SELL.
//
// The counter does not stop the sim, and standing at one does not protect you:
// it is HUD like the character sheet, and walking out of
// reach shuts it.
// ------------------------------------------------------------ the counters
const SHOP_REACH = 34; // px from a counter the shop is open

// A COUNTER is either of two things: the merchant's own body, or the STALL
// it pitches beside the roost (OBJECTS.stall, world.js; updateMerchant,
// robots.js). Both open the same shop. `counterPt` is where each one's cap
// sits and where a click walks you to - the body itself, or the middle of the
// stall's counter edge, a step in front of its front row.
function counterPt(c) {
  return c.merchant ? c : { x: (c.tx + 1.5) * TILE, y: (c.ty + 1) * TILE + 4 };
}
// how far a body stands from a counter: from the merchant's body, or from the
// nearest edge of the stall's whole footprint, so its back and sides are in
// reach as well as its front (the anchor is the front-left tile and the
// footprint runs north and east of it - pitchStall, robots.js)
function counterDist(p, c) {
  if (c.merchant) return Math.hypot(c.x - p.x, c.y - p.y);
  const d = OBJECTS.stall, x0 = c.tx * TILE, x1 = (c.tx + d.w) * TILE;
  const y0 = (c.ty + 1 - d.h) * TILE, y1 = (c.ty + 1) * TILE;
  return Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(y0 - p.y, 0, p.y - y1));
}
// a stall still standing (objAt answers it off its own anchor tile)
function stallUp(s) { return !!s && objAt(s.tx, s.ty) === s; }
// the counter this player is standing at, or null. Either team's: both
// merchants and both stalls serve everybody.
function merchNear(p) {
  let best = null, bd = SHOP_REACH + PLAYER_R;
  for (const b of robots) {
    if (!b.merchant || b.dead) continue;
    for (const c of [b.hopT > 0 ? null : b, stallUp(b.stall) ? b.stall : null]) { // mid-hop it is still climbing down
      if (!c) continue;
      const d = counterDist(p, c);
      if (d < bd) { bd = d; best = c; }
    }
  }
  return best;
}
// still standing at THIS counter - the check that shuts the panel when you walk off
function inReach(p, c) {
  if (!c || c.dead || (!c.merchant && !stallUp(c))) return false;
  return counterDist(p, c) <= SHOP_REACH + PLAYER_R;
}
// The other way round: the player whose counter is OPEN on this merchant, or
// null. updateMerchant (js/sim/robots.js) asks it every frame and drops
// everything - the bays, the felling, the loiter - while somebody is being
// served: a shopkeeper does not walk off mid-sale, and a counter that strolled
// away from its own customer would shut itself in their face while they read
// the prices. A counter open at its STALL holds nobody: the stall stays put,
// so its keeper goes on working.
//
// It is the OPEN PANEL and not mere proximity on purpose. Everybody lands at
// the roost together, so a merchant that stopped for anyone standing near it
// would never get its stall up at all.
// The local player is the only one that can open a counter today; when other
// players can, this is the one place that has to learn about them.
function shopServing(b) {
  return state.shop === b && player.active && !player.dead ? player : null;
}

// Shuts the counter the moment you walk away from it. Called once per sim
// step from updatePlay (js/sim/sim.js), never in practice: the training room
// has no merchants.
function updateShop() {
  if (state.shop && (player.dead || !inReach(player, state.shop))) closeShop();
}

// ------------------------------------------------------------ buying and selling
// the local refusals, so a bot's failed order is silent
function shopDeny(p) { sfxFor(p, 'deny'); }

// the coin popping off the body that traded - the same floater a payout uses,
// so money moving always looks the same wherever it moved
function shopFx(p, txt, col) {
  addFloater(p.x, p.y - 20, txt, col);
  burst(p.x, p.y - 8, col, 5, 40, 0.4);
}

// the one entry point runCmd hands a shop order to (js/ui/wheel.js)
function shopCmd(p, c) {
  if (c.act === 'item') return !!buyItem(p, c.id);
  if (c.act === 'sellItem') return !!sellItem(p, c.slot);
  return false;
}

// ------------------------------------------------------------ the shop panel
// League's shop on the HUD's own graphite plate (drawHudFrame, js/ui/strip.js):
//
//   RECOMMENDED   ALL ITEMS                     X | BUILDS INTO  [] [] []
//   [stat filters]                                |       the picked item
//   the grid: a row a tier - potion and basics,   |      /      |      \
//   boots, epics, then the legendaries - each     |   its components, and
//   well with its price under it                  |   theirs, owned ones ticked
//                                                 | icon NAME  price
//                                                 | stats, passive
//   your six slots   SELL            purse        | [ BUY  price ]
//
// A click PICKS (an item on the grid, a node of the tree, a BUILDS INTO well,
// one of your slots); BUY on the right buys the pick, SELL along the bottom
// sells the picked slot. A right click is the shortcut: on the grid it buys,
// on a slot it sells. RECOMMENDED is your class's own build, the one a bot of
// it buys (BOT_BUILDS, js/sim/items.js). The stat filters dim every item
// without that stat rather than hiding it, so nothing on the grid moves.
//
// It is centred near the top edge, clear of the bottom-left corner the
// tooltip grows up out of.
const SHOP_W = 500, SHOP_H = 288, SHOP_Y = 4;
const SHOP_WELL = 20, SHOP_PITCH = 23, SHOP_ROW = 29, SHOP_COLS = 13; // a grid well, its pitch, a row with its price
const SHOP_CAT = 14, SHOP_CAT_PITCH = 16;  // a stat filter
const SHOP_PANE_X = 310;   // the right pane's left edge, from the slab's
const SHOP_SELL_W = 40, SHOP_BTN_H = 16;   // the SELL plate, and both plates' height
const SHOP_TREE_PITCH = 24, SHOP_TREE_ROW = 34; // the build tree: a leaf's pitch, a level's
const SHOP_INTO_MAX = 7;   // BUILDS INTO wells shown (empty ones keep the row's shape)
const SHOP_RIM = '#3c4048', SHOP_HOT = '#9ca1aa', SHOP_PICK = '#fff6c8';
const SHOP_INK = '#e8eaee', SHOP_DIM = '#8a8f99', SHOP_STAT = '#7fd88a', SHOP_FAINT = '#24272d';
const SHOP_PANE_BG = '#111216', SHOP_PLATE = '#2a2d33', SHOP_PLATE_HOT = '#3a3e46';
const SHOP_BUY = '#2c5a3a', SHOP_BUY_HOT = '#3a7048'; // the BUY plate: the one green action on the slab
// A price you cannot pay: the refusal red every other "not enough gold" in the
// game already speaks, on the rim and the price, with the goods greyed back.
const SHOP_DEAR_BAND = '#3a1420', SHOP_DEAR_INK = '#e0637a';
const SHOP_DEAR_WASH = 'rgba(8,9,12,0.62)';
const SHOP_TABS = [{ id: 'rec', label: 'RECOMMENDED' }, { id: 'all', label: 'ALL ITEMS' }];

// the counter is up: the panel is drawn and eats its own clicks
function shopOpen() {
  return !!state.shop && state.mode === 'play' && !player.dead && !state.paused &&
    !state.mapOpen && !state.settingsOpen && !state.wheel && !window.DBG.hideUI;
}
// The post has a song of its own, and it takes the music layer for exactly as
// long as the counter is open: SFX.music.hold notes what was playing AND the
// second it had reached, and the release at the far end puts it back there - so
// a trip to the shop costs the match's track the bars it covered rather than
// the whole song (the `music` banner, js/app/audio.js).
function openShop(b) {
  if (!b) return false;
  state.shop = b;
  state.charOpen = false; // one slab at a time - they would sit on each other
  if (!state.shopTab) state.shopTab = 'rec';
  if (!state.shopSel) state.shopSel = botNextItem(player) || ITEM_DONE[0]; // open on what a bot of your class would save for next
  SFX.place();
  SFX.music.hold('village', { in: 0.6, out: 0.5 });
  return true;
}
function closeShop() {
  if (!state.shop) return;
  state.shop = null;
  SFX.pickup();
  SFX.music.release({ in: 0.8, out: 0.5 });
}

// the item the pane shows: the slot picked, else the item picked
function shopPicked() {
  const s = state.shopSlot;
  if (s >= 0 && player.items[s]) return { id: player.items[s], slot: s };
  return { id: Object.hasOwn(BUILD_ITEMS, state.shopSel) ? state.shopSel : ITEM_DONE[0], slot: -1 };
}
// the stat filter: an item without the picked stat is dimmed
function shopFiltered(id) {
  const c = state.shopCat;
  return state.shopTab === 'all' && c >= 0 && !(ITEM_STAT_ORDER[c] in BUILD_ITEMS[id].stats);
}
// THE RECOMMENDED TAB: your class's build cut League's way - a start (the
// potion and the first item's basics), the core (its first legendary and its
// boots), and the rest of the list - each a row under its headline.
function shopRecommended() {
  const list = botBuild(player);
  const boots = list.filter(isBoots), legends = list.filter((id) => !isBoots(id));
  const first = legends[0];
  const start = ['potion'].concat([...itemParts(first)].filter(isPart).sort((a, b) => BUILD_ITEMS[a].price - BUILD_ITEMS[b].price));
  return [
    { label: 'START', ids: start },
    { label: 'CORE', ids: [first, ...[...itemParts(first)].filter((k) => !isPart(k))] },
    { label: 'BOOTS', ids: ['boots', ...boots] },
    { label: 'THEN', ids: legends.slice(1) },
  ];
}
// THE ALL ITEMS GRID: a row a kind - the potion and the basics, every pair of
// boots, the epics, the legendaries - cheapest first, a kind too long for one
// row running on into the next
const SHOP_ROW_KINDS = ['basic', 'boots', 'epic', 'legend'];
function shopRowKind(id) { return isBoots(id) ? 'boots' : itemTier(id) === 'potion' ? 'basic' : itemTier(id); }
function shopAllRows() {
  const rows = [];
  for (const kind of SHOP_ROW_KINDS) {
    const ids = ITEM_ALL.filter((id) => shopRowKind(id) === kind);
    for (let i = 0; i < ids.length; i += SHOP_COLS) rows.push(ids.slice(i, i + SHOP_COLS));
  }
  return rows;
}

// The whole geometry in one place: the slab centred across the view, SHOP_Y
// down from its top.
function shopLayout() {
  const x = Math.max(2, Math.round((VIEW_W - SHOP_W) / 2)), y = SHOP_Y;
  const gx = x + 6, by = y + SHOP_H - 26;
  const tabs = [], cats = [], grid = [], heads = [], slots = [];
  let tx = gx + 2;
  for (const t of SHOP_TABS) { const w = pixelTextWidth(t.label) + 8; tabs.push({ id: t.id, x: tx - 4, y: y + 4, w, h: 14 }); tx += w + 10; }
  const well = (id, wx, wy) => grid.push({ id, x: wx, y: wy, w: SHOP_WELL, h: SHOP_WELL });
  if (state.shopTab === 'all') {
    for (let i = 0; i <= ITEM_STAT_ORDER.length; i++) cats.push({ c: i - 1, x: gx + i * SHOP_CAT_PITCH, y: y + 24, w: SHOP_CAT, h: SHOP_CAT });
    shopAllRows().forEach((row, r) => row.forEach((id, i) => well(id, gx + i * SHOP_PITCH, y + 44 + r * SHOP_ROW)));
  } else {
    shopRecommended().forEach((sec, r) => {
      const sy = y + 25 + r * (SHOP_ROW + 14);
      heads.push({ label: sec.label, x: gx, y: sy });
      sec.ids.forEach((id, i) => well(id, gx + i * SHOP_PITCH, sy + 9));
    });
  }
  for (let i = 0; i < ITEM_SLOTS; i++) slots.push({ i, x: gx + i * SHOP_PITCH, y: by, w: SHOP_WELL, h: SHOP_WELL });
  const sell = { x: gx + ITEM_SLOTS * SHOP_PITCH + 5, y: by + 2, w: SHOP_SELL_W, h: SHOP_BTN_H };
  const pane = { x: x + SHOP_PANE_X, y: y + 6, w: SHOP_W - SHOP_PANE_X - 6, h: SHOP_H - 12 };
  const into = [];
  for (let i = 0; i < SHOP_INTO_MAX; i++) into.push({ i, x: pane.x + 6 + i * SHOP_PITCH, y: pane.y + 15, w: SHOP_WELL, h: SHOP_WELL });
  return {
    panel: { x, y, w: SHOP_W, h: SHOP_H },
    xr: { x: pane.x - 17, y: y + 6, w: 11, h: 11 },
    tabs, cats, grid, heads, slots, sell, pane, into, by,
    purse: { x: pane.x - 10, y: by + 7 },
    buy: { x: pane.x + 6, y: pane.y + pane.h - SHOP_BTN_H - 6, w: pane.w - 12, h: SHOP_BTN_H + 2 },
    tree: shopTree(pane, shopPicked().id),
  };
}
// The picked item's tree, as wells in the pane: the item on top, its
// components under it, and theirs under them, each child centred under its
// own parent. A node is { id, x, y, w, h, up } where `up` is its parent node.
function shopTree(pane, id) {
  const n = [], cx = pane.x + (pane.w >> 1), top = pane.y + 46;
  if (isStack(id)) return n; // the potion is built from nothing and into nothing
  const leaves = (k) => { const f = BUILD_ITEMS[k].from; return f ? f.reduce((s, q) => s + leaves(q), 0) : 1; };
  const place = (k, x0, depth, up) => {
    const span = leaves(k) * SHOP_TREE_PITCH;
    const node = { id: k, x: Math.round(x0 + span / 2) - (SHOP_WELL >> 1), y: top + depth * SHOP_TREE_ROW, w: SHOP_WELL, h: SHOP_WELL, up };
    n.push(node);
    let cx0 = x0;
    if (depth < 2) for (const q of BUILD_ITEMS[k].from || []) { place(q, cx0, depth + 1, node); cx0 += leaves(q) * SHOP_TREE_PITCH; }
    return node;
  };
  place(id, cx - leaves(id) * SHOP_TREE_PITCH / 2, 0, null);
  return n;
}
// which tree nodes you already hold, the way itemCost spends them: a held
// component covers everything under it
function shopTreeOwned(tree) {
  const used = [], own = new Set();
  const walk = (node) => {
    for (const c of tree.filter((m) => m.up === node)) {
      const i = player.items.findIndex((x, j) => x === c.id && !used.includes(j));
      if (i >= 0) { used.push(i); own.add(c); } else walk(c);
    }
  };
  if (tree.length) walk(tree[0]);
  return own;
}

// 'x' | 'panel' | {kind:'tab', id} | {kind:'cat', c} | {kind:'pick', id} |
// {kind:'slot', i} | {kind:'buy'} | {kind:'sell'} | null. Shared by the
// click, the cursor and the tooltip, so the three can never disagree about
// what the pointer is on.
function shopHit(mx, my) {
  if (!shopOpen()) return null;
  const L = shopLayout(), P = L.panel;
  if (!hitR(P, mx, my)) return null;
  if (hitR(L.xr, mx, my)) return 'x';
  for (const r of L.tabs) if (hitR(r, mx, my)) return { kind: 'tab', id: r.id };
  for (const r of L.cats) if (hitR(r, mx, my)) return { kind: 'cat', c: r.c };
  for (const r of L.grid.concat(L.tree)) if (hitR(r, mx, my)) return { kind: 'pick', id: r.id };
  const into = itemInto(shopPicked().id);
  for (const r of L.into) if (into[r.i] && hitR(r, mx, my)) return { kind: 'pick', id: into[r.i] };
  for (const r of L.slots) if (hitR(r, mx, my)) return { kind: 'slot', i: r.i };
  if (hitR(L.buy, mx, my)) return { kind: 'buy' };
  if (hitR(L.sell, mx, my)) return { kind: 'sell' };
  return 'panel';
}
function hitR(r, mx, my) { return mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h; }

// the two orders the slab sends, through the player's input like every other act
function shopBuy(id) { SFX.unlock(); player.input.cmd = { kind: 'shop', act: 'item', id }; }
function shopSell(slot) {
  const id = player.items[slot];
  if (!id) return;
  SFX.unlock();
  player.input.cmd = { kind: 'shop', act: 'sellItem', slot };
  if (!(id === 'potion' && player.potions > 1)) { state.shopSlot = -1; state.shopSel = id; } // the stack's last one leaves the slot
}
// one left press inside the panel; returns whether it was swallowed
function shopClick(h) {
  if (!h) return false;
  if (h === 'x') { closeShop(); return true; }
  if (h.kind === 'tab') { if (state.shopTab !== h.id) { state.shopTab = h.id; SFX.place(); } return true; }
  if (h.kind === 'cat') { state.shopCat = state.shopCat === h.c ? -1 : h.c; SFX.place(); return true; }
  if (h.kind === 'pick') { state.shopSel = h.id; state.shopSlot = -1; SFX.place(); return true; }
  if (h.kind === 'slot') { if (player.items[h.i]) { state.shopSlot = h.i; SFX.place(); } return true; }
  if (h.kind === 'buy') { shopBuy(shopPicked().id); return true; }
  if (h.kind === 'sell') { if (state.shopSlot >= 0) shopSell(state.shopSlot); return true; }
  return true; // the slab eats the rest; the world never sees it
}
// one right press: the shortcut - buy what is under it on the grid or the
// tree, sell what is under it in your slots; anywhere else on the slab it is
// only swallowed, so no ping wheel opens through the counter
function shopRightClick(h) {
  if (!h) return false;
  if (h.kind === 'pick') { state.shopSel = h.id; state.shopSlot = -1; shopBuy(h.id); }
  else if (h.kind === 'slot') shopSell(h.i);
  return true;
}

// ---- drawing -------------------------------------------------------------
// THE COUNTER'S WASH, over the whole frame. What stays LIT above it is
// everything a trade is made of: this slab and the tooltip. The ORDER that does
// that is in renderUI (js/ui/compose.js): a panel cannot dim what is drawn
// after it, and the corner has to be drawn after.
const SHOP_WASH = 'rgba(6,7,10,0.55)';
function shopScrim() {
  ctx.fillStyle = SHOP_WASH;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// a recessed well: a 1px rim and a dark ground
function shopWell(r, rim, bg) {
  ctx.fillStyle = rim; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = bg || BAG_WELL; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}
// an icon at the largest whole-number scale that fits the well: a fractional
// one stretches every third source pixel and frays 1px linework
function shopIcon(im, r) {
  if (!im) return;
  const k = Math.max(1, Math.floor(Math.min((r.w - 4) / im.width, (r.h - 4) / im.height)));
  const w = im.width * k, h = im.height * k;
  ctx.drawImage(im, r.x + ((r.w - w) >> 1), r.y + ((r.h - h) >> 1), w, h);
}
// a coin and a number: what something costs, red when the purse is short
function shopPrice(n, x, y, dear) {
  ctx.drawImage(SPRITES.itemGold, x, y - 2);
  drawPixelText(ctx, String(n), x + 10, y, dear ? SHOP_DEAR_INK : RES_COLORS.gold);
}
// a bare number centred under a well: the grid's price, gold or red
function shopTag(n, r, dear) {
  const t = String(n);
  drawPixelText(ctx, t, r.x + ((r.w - pixelTextWidth(t) + 1) >> 1), r.y + r.h + 2, dear ? SHOP_DEAR_INK : RES_COLORS.gold);
}
// one item's well: its rim says its tier, hover or pick; a filtered-out item
// greys back. What you cannot afford keeps its colours and says so in its red
// price (shopTag): with fifty items on the grid, most are dear most of a match.
function shopItemWell(r, id, h) {
  const hot = !!h && h.kind === 'pick' && h.id === id;
  const pick = shopPicked().slot < 0 && shopPicked().id === id;
  shopWell(r, pick ? SHOP_PICK : hot ? SHOP_HOT : itemMetal(id).rim);
  shopIcon(itemIcon(id), r);
  if (shopFiltered(id)) { ctx.fillStyle = SHOP_DEAR_WASH; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); }
}
// a flat plate with a word on it, and a price after the word when it has one
function shopPlate(r, word, n, bg, ink) {
  ctx.fillStyle = bg; ctx.fillRect(r.x, r.y, r.w, r.h);
  const tw = pixelTextWidth(word) + (n === undefined ? 0 : 13 + pixelTextWidth(String(n)));
  const x0 = r.x + ((r.w - tw) >> 1), ty = r.y + ((r.h - 5) >> 1);
  drawPixelText(ctx, word, x0, ty, ink);
  if (n !== undefined) shopPrice(n, x0 + pixelTextWidth(word) + 3, ty, ink === SHOP_DEAR_INK);
}
// what buying the pick needs: its price now, and whether it can go through
function shopBuyState(id) {
  if (id === 'potion') { const n = BUILD_ITEMS.potion.price; return { n, gold: n <= player.inv.gold, ok: n <= player.inv.gold && potionRoom(player) }; }
  const c = itemCost(player, id);
  const gold = c.gold <= player.inv.gold;
  return { n: c.gold, gold, ok: gold && itemRoom(player, c.used) >= 1 && !bootsClash(player, id, c.used) };
}

function drawShopPanel(now) {
  const L = shopLayout(), P = L.panel;
  const h = mouse.inside ? shopHit(mouse.x, mouse.y) : null;
  drawHudFrame(P.x, P.y, P.w, P.h, { corners: { tl: true, tr: true, bl: true, br: true } });
  drawShopTabs(L, h);
  const xh = h === 'x';
  ctx.fillStyle = xh ? SHOP_INK : SHOP_DIM;
  for (let k = 0; k < 5; k++) { ctx.fillRect(L.xr.x + 3 + k, L.xr.y + 3 + k, 1, 1); ctx.fillRect(L.xr.x + 7 - k, L.xr.y + 3 + k, 1, 1); }
  ctx.fillStyle = HUD_EDGE;
  ctx.fillRect(P.x + 3, P.y + 20, SHOP_PANE_X - 6, 1);
  ctx.fillRect(P.x + 3, L.by - 6, SHOP_PANE_X - 6, 1);
  drawShopCats(L, h);
  for (const hd of L.heads) drawPixelText(ctx, hd.label, hd.x, hd.y, SHOP_DIM);
  for (const r of L.grid) {
    const n = r.id === 'potion' ? BUILD_ITEMS.potion.price : itemCost(player, r.id).gold;
    shopItemWell(r, r.id, h);
    shopTag(n, r, n > player.inv.gold);
    if (r.id === 'potion' && player.potions > 0) { const t = String(player.potions); drawPixelText(ctx, t, r.x + r.w - 2 - pixelTextWidth(t), r.y + 2, SHOP_INK); }
  }
  drawShopSlots(L, h);
  const gold = String(player.inv.gold);
  shopPrice(gold, L.purse.x - 10 - pixelTextWidth(gold), L.purse.y);
  drawShopPane(L, h);
}

// RECOMMENDED and ALL ITEMS: the open one lit with a line under it
function drawShopTabs(L, h) {
  for (const t of L.tabs) {
    const on = state.shopTab === t.id, hot = !!h && h.kind === 'tab' && h.id === t.id;
    drawPixelText(ctx, SHOP_TABS.find((s) => s.id === t.id).label, t.x + 4, t.y + 4, on ? SHOP_INK : hot ? SHOP_HOT : SHOP_DIM);
    if (on) { ctx.fillStyle = SHOP_PICK; ctx.fillRect(t.x + 4, t.y + 12, t.w - 8, 1); }
  }
}
// The stat filters (ALL ITEMS only): ALL, then one a stat, each the stat
// panel's own icon (STAT_ICON, js/ui/statpanel.js). The picked one is rimmed
// lit; picking it again clears the filter.
function drawShopCats(L, h) {
  for (const r of L.cats) {
    const on = (state.shopCat === undefined ? -1 : state.shopCat) === r.c;
    const hot = !!h && h.kind === 'cat' && h.c === r.c;
    shopWell(r, on ? SHOP_PICK : hot ? SHOP_HOT : SHOP_RIM);
    if (r.c < 0) { // ALL: four squares, the grid itself
      ctx.fillStyle = on ? SHOP_INK : SHOP_DIM;
      for (const [a, b] of [[3, 3], [8, 3], [3, 8], [8, 8]]) ctx.fillRect(r.x + a, r.y + b, 3, 3);
    } else {
      const im = STAT_ICON[ITEM_STAT_ORDER[r.c]];
      ctx.drawImage(im, r.x + ((r.w - im.width) >> 1), r.y + ((r.h - im.height) >> 1));
    }
  }
}

// THE PANE: BUILDS INTO along the top, the picked item's tree, its card (icon,
// name, price, stats with their icons, the passive) and BUY at the foot.
function drawShopPane(L, h) {
  const R = L.pane, pk = shopPicked(), it = BUILD_ITEMS[pk.id];
  shopWell(R, HUD_EDGE, SHOP_PANE_BG);
  drawPixelText(ctx, 'BUILDS INTO', R.x + 6, R.y + 6, SHOP_DIM);
  const into = itemInto(pk.id);
  for (const r of L.into) {
    if (into[r.i]) shopItemWell(r, into[r.i], h);
    else shopWell(r, SHOP_FAINT, SHOP_PANE_BG);
  }
  ctx.fillStyle = HUD_EDGE;
  ctx.fillRect(R.x + 4, R.y + 41, R.w - 8, 1);
  drawShopTree(L, h);
  // the card
  const cy = R.y + 152;
  ctx.fillStyle = HUD_EDGE;
  ctx.fillRect(R.x + 4, cy - 4, R.w - 8, 1);
  const big = { x: R.x + 6, y: cy, w: SHOP_WELL, h: SHOP_WELL };
  shopWell(big, itemMetal(pk.id).rim);
  shopIcon(itemIcon(pk.id), big);
  drawPixelText(ctx, it.name, R.x + 32, cy + 2, itemMetal(pk.id).ink);
  shopPrice(it.price, R.x + 32, cy + 13);
  let y = cy + 28;
  for (const s of ITEM_STAT_ORDER) {
    if (!(s in it.stats)) continue;
    const S = ITEM_STATS[s];
    ctx.drawImage(STAT_ICON[s], R.x + 5, y - 2);
    drawPixelText(ctx, S.fmt(it.stats[s]) + ' ' + S.label, R.x + 17, y, SHOP_STAT);
    y += 10;
  }
  if (it.passive) {
    const pv = ITEM_PASSIVES[it.passive];
    drawPixelText(ctx, pv.name, R.x + 6, y + 3, RES_COLORS.gold);
    drawPixelText(ctx, pv.line, R.x + 6, y + 11, SHOP_DIM);
  }
  if (isBoots(pk.id)) drawPixelText(ctx, 'ONE PAIR', R.x + R.w - 6 - pixelTextWidth('ONE PAIR'), cy + 13, SHOP_DIM);
  // the potion: what one drink gives and over how long, and the stack you carry
  if (pk.id === 'potion') {
    ctx.drawImage(STAT_ICON.hp, R.x + 5, y - 2);
    drawPixelText(ctx, '+' + POTION_HEAL + ' HEALTH OVER ' + POTION_T + ' S', R.x + 17, y, SHOP_STAT);
    drawPixelText(ctx, (player.potions || 0) + ' / ' + it.stack, R.x + 6, y + 13, SHOP_DIM);
  }
  // BUY: the pick's price now; red when the purse is short, dim when it has no room
  const b = shopBuyState(pk.id), hot = !!h && h.kind === 'buy';
  shopPlate(L.buy, 'BUY', b.n, !b.gold ? SHOP_DEAR_BAND : !b.ok ? SHOP_PLATE : hot ? SHOP_BUY_HOT : SHOP_BUY,
    !b.gold ? SHOP_DEAR_INK : b.ok ? SHOP_INK : SHOP_DIM);
}
// the tree: a line down from each parent and across to its children, then the
// wells; a component you hold is rimmed green with a tick and wears no price
function drawShopTree(L, h) {
  const tree = L.tree;
  if (!tree.length) return;
  const own = shopTreeOwned(tree);
  ctx.fillStyle = SHOP_DIM;
  for (const p of tree) {
    const kids = tree.filter((m) => m.up === p);
    if (!kids.length) continue;
    const px = p.x + (p.w >> 1), cy = p.y + p.h + 10; // under the parent's price
    const xs = kids.map((k) => k.x + (k.w >> 1)).concat(px);
    ctx.fillRect(px, p.y + p.h + 8, 1, cy - p.y - p.h - 8);
    ctx.fillRect(Math.min(...xs), cy, Math.max(...xs) - Math.min(...xs) + 1, 1);
    for (const k of kids) ctx.fillRect(k.x + (k.w >> 1), cy, 1, k.y - cy);
  }
  const covered = (n) => { for (let u = n.up; u; u = u.up) if (own.has(u)) return true; return false; };
  for (const r of tree) {
    const mine = own.has(r) || covered(r);
    const hot = !!h && h.kind === 'pick' && h.id === r.id;
    const pick = r === tree[0];
    shopWell(r, mine ? SHOP_STAT : hot ? SHOP_HOT : pick ? SHOP_PICK : itemMetal(r.id).rim);
    shopIcon(itemIcon(r.id), r);
    if (mine) { ctx.fillStyle = SHOP_STAT; ctx.fillRect(r.x + r.w - 5, r.y + 2, 3, 3); }
    else {
      const n = r === tree[0] ? itemCost(player, r.id).gold : BUILD_ITEMS[r.id].price;
      ctx.fillStyle = SHOP_PANE_BG; // the price sits on the pane, under the line
      shopTag(n, r, n > player.inv.gold);
    }
  }
}

// your six slots, along the bottom: a held item in its tier rim, the picked
// one lit; an empty slot is a dark well. SELL beside them sells the pick.
function drawShopSlots(L, h) {
  for (const r of L.slots) {
    const id = player.items[r.i];
    const hot = !!h && h.kind === 'slot' && h.i === r.i && id;
    shopWell(r, state.shopSlot === r.i && id ? SHOP_PICK : hot ? SHOP_HOT : id ? itemMetal(id).rim : SHOP_RIM);
    if (id) shopIcon(itemIcon(id), r);
    if (id === 'potion') { const t = String(player.potions || 0); drawPixelText(ctx, t, r.x + r.w - 2 - pixelTextWidth(t), r.y + 2, SHOP_INK); }
  }
  const pk = shopPicked(), live = pk.slot >= 0, hot = live && !!h && h.kind === 'sell';
  shopPlate(L.sell, 'SELL', undefined, hot ? SHOP_PLATE_HOT : SHOP_PLATE, live ? SHOP_INK : SHOP_DIM);
  if (live) shopPrice(itemSellValue(pk.id), L.sell.x + L.sell.w + 5, L.sell.y + 6);
}

// ---- tooltips ------------------------------------------------------------
// What the pointer is on at the counter, in the shared descriptor shape
// (js/ui/tooltip.js).
function tipShop(h) {
  if (!h || typeof h === 'string') return null;
  if (h.kind === 'pick') return tipItem(h.id, shopBuyState(h.id).n);
  if (h.kind === 'slot') {
    const id = player.items[h.i];
    if (!id) return null;
    const d = tipItem(id);
    d.rows.push(['SELLS FOR', itemSellValue(id) + ' GOLD', RES_COLORS.gold]);
    return d;
  }
  return null;
}
// one item: its stats, its passive, and what it costs you now
const SHOP_TIER_WORD = { potion: 'POTION', basic: 'BASIC', epic: 'EPIC', boots: 'BOOTS', legend: 'LEGENDARY' };
function tipItem(id, cost) {
  const it = BUILD_ITEMS[id];
  const d = { title: it.name, tcol: itemMetal(id).ink, kind: SHOP_TIER_WORD[itemTier(id)],
    rows: [], notes: [], icon: itemIcon(id), plate: BAG_WELL, rim: itemMetal(id).rim };
  if (cost !== undefined) d.rows.push(['PRICE', cost + ' GOLD', cost <= player.inv.gold ? RES_COLORS.gold : SHOP_DEAR_INK]);
  for (const s of ITEM_STAT_ORDER) if (s in it.stats) d.rows.push([ITEM_STATS[s].label, ITEM_STATS[s].fmt(it.stats[s]), SHOP_STAT]);
  if (id === 'potion') {
    // the drink said the way an ability well says it: how much, over how long
    d.rows.push(['HEALS', '+' + POTION_HEAL, '#8fe08a'], ['OVER', tipSec(POTION_T), '#f4f7ff']);
    d.rows.push(['CARRIED', player.potions + ' / ' + it.stack, '#f4f7ff']);
  }
  if (it.passive) {
    d.notes.push([ITEM_PASSIVES[it.passive].name, RES_COLORS.gold]);
    d.notes.push([ITEM_PASSIVES[it.passive].line, TIP_DIM]);
  }
  return d;
}
