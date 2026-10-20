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
// save up for the one they want. Nothing in it moves - fish and berries have
// a fixed price too - and nothing sells out. Three things live here:
//   - the COUNTERS: which one a body is standing at, and the reach that keeps
//     the panel open.
//   - BUYING AND SELLING: items through buyItem/sellItem, fish and berries at
//     their fixed price.
//   - the PANEL, layout A: category filters down the left, the parts and the
//     finished items in a grid, the picked item read out on the right with its
//     build tree, and along the bottom your six slots and the food.
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
// FISH AND BERRIES trade at a fixed price, the same both ways. A
// frost pike is the `fish` price, and every other fish is priced off it by
// what it heals against what the pike heals, so a new fish is priced the
// moment it has a `heal`.
const FOOD_PRICE = { fish: 18, berry: 4 };
const FOOD_GOODS = ['fish', 'berry']; // the panel's food row, in this order
function isFood(type) { return type === 'berry' || FISH_KINDS.includes(type); }
function foodPrice(type) {
  if (type === 'berry') return FOOD_PRICE.berry;
  return Math.max(1, Math.round(FOOD_PRICE.fish * ITEMS[type].heal / ITEMS.fish.heal));
}
// the local refusals, so a bot's failed order is silent
function shopDeny(p) { sfxFor(p, 'deny'); }
// Food over the counter at its fixed price. `dir` +1 buys `n` (one when left
// out) - as many as the purse and the pouch cover - and -1 sells ALL of that
// good: every berry, or every fish of every kind. One payment either way.
function shopTrade(p, good, dir, n) {
  if (!FOOD_GOODS.includes(good) || !merchNear(p)) { shopDeny(p); return false; }
  if (dir > 0) {
    const price = foodPrice(good);
    const k = Math.min(Math.max(1, Math.floor(n) || 1), Math.floor(p.inv.gold / price), bagRoom(p, good));
    if (k < 1) { shopDeny(p); return false; }
    const got = bagAdd(p, good, k);
    pay({ gold: price * got }, p);
    shopFx(p, '-' + price * got, RES_COLORS[good]);
  } else {
    let v = 0;
    for (const t of good === 'fish' ? FISH_KINDS : [good]) v += foodPrice(t) * bagTake(p, t, bagCount(p, t));
    if (v < 1) { shopDeny(p); return false; }
    tradeGold(p, v);
    shopFx(p, String(v), RES_COLORS[good]);
  }
  sfxFor(p, 'coin');
  return true;
}
// how many of a food good a body carries (every fish kind for `fish`)
function foodHeld(p, good) { return good === 'fish' ? fishHeld(p) : bagCount(p, good); }

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
  if (c.act === 'trade') return !!shopTrade(p, c.good, c.dir, c.n);
  return false;
}

// ------------------------------------------------------------ the shop panel
// LAYOUT A, on the HUD's own graphite plate (drawHudFrame, js/ui/strip.js):
//
//   SHOP                                              purse  X
//   [cats] PARTS  five cheap parts          | the picked item: icon, name,
//          ITEMS  the finished items, 4 a row| price, BUY or SELL, its stats,
//                                           | its passive, and its build tree
//   your six slots                          fish  BUY SELL  berries BUY SELL
//
// A click PICKS (an item in the grid, a node of the tree, one of your slots)
// and the plate on the read-out acts on the pick: BUY for an item on sale,
// SELL for one in your slots. The category plates down the left dim every
// item without that stat rather than hiding it, so nothing on the grid moves.
//
// It is centred near the top edge, clear of the bottom-left corner the
// tooltip grows up out of.
const SHOP_W = 344, SHOP_H = 206, SHOP_Y = 4;
const SHOP_PART = 22, SHOP_ITEM = 26, SHOP_CAT = 16, SHOP_SLOT = 22;
const SHOP_PITCH = 25, SHOP_ITEM_PITCH = 31, SHOP_ITEM_ROW = 39, SHOP_COLS = 4;
const SHOP_PANE_X = 160;   // the read-out's left edge, from the slab's
const SHOP_FOOD_W = 82;    // one food plate along the bottom
const SHOP_RIM = '#3c4048', SHOP_HOT = '#9ca1aa', SHOP_PICK = '#fff6c8';
const SHOP_INK = '#e8eaee', SHOP_DIM = '#8a8f99', SHOP_STAT = '#7fd88a';
const SHOP_PANE_BG = '#111216', SHOP_PLATE = '#2a2d33', SHOP_PLATE_HOT = '#3a3e46';
// A price you cannot pay: the refusal red every other "not enough gold" in the
// game already speaks, on the rim and the price, with the goods greyed back.
const SHOP_DEAR_RIM = '#6b2230', SHOP_DEAR_BAND = '#3a1420', SHOP_DEAR_INK = '#e0637a';
const SHOP_DEAR_WASH = 'rgba(8,9,12,0.62)';

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

// the item the read-out shows: the slot picked, else the item picked
function shopPicked() {
  const s = state.shopSlot;
  if (s >= 0 && player.items[s]) return { id: player.items[s], slot: s };
  return { id: Object.hasOwn(BUILD_ITEMS, state.shopSel) ? state.shopSel : ITEM_DONE[0], slot: -1 };
}
// the category filter: an item without the picked stat is dimmed
function shopFiltered(id) {
  const c = state.shopCat;
  return c >= 0 && !(ITEM_STAT_ORDER[c] in BUILD_ITEMS[id].stats);
}

// The whole geometry in one place: the slab centred across the view, SHOP_Y
// down from its top.
function shopLayout() {
  const x = Math.max(2, Math.round((VIEW_W - SHOP_W) / 2)), y = SHOP_Y;
  const gx = x + 28, by = y + SHOP_H - 30;
  const cats = [], parts = [], items = [], slots = [], food = [];
  for (let i = 0; i <= ITEM_STAT_ORDER.length; i++) cats.push({ c: i - 1, x: x + 6, y: y + 26 + i * 18, w: SHOP_CAT, h: SHOP_CAT });
  ITEM_PARTS.forEach((id, i) => parts.push({ id, x: gx + i * SHOP_PITCH, y: y + 33, w: SHOP_PART, h: SHOP_PART }));
  ITEM_DONE.forEach((id, i) => items.push({ id, x: gx + (i % SHOP_COLS) * SHOP_ITEM_PITCH,
    y: y + 77 + ((i / SHOP_COLS) | 0) * SHOP_ITEM_ROW, w: SHOP_ITEM, h: SHOP_ITEM }));
  for (let i = 0; i < ITEM_SLOTS; i++) slots.push({ i, x: x + 7 + i * SHOP_PITCH, y: by, w: SHOP_SLOT, h: SHOP_SLOT });
  FOOD_GOODS.forEach((good, i) => {
    const fx = x + SHOP_W - 7 - (FOOD_GOODS.length - i) * (SHOP_FOOD_W + 4) + 4;
    food.push({ good, x: fx, y: by, w: SHOP_FOOD_W, h: SHOP_SLOT,
      buy: { x: fx + 44, y: by + 4, w: 15, h: 14 }, sell: { x: fx + 61, y: by + 4, w: 19, h: 14 } });
  });
  const pane = { x: x + SHOP_PANE_X, y: y + 25, w: SHOP_W - SHOP_PANE_X - 6, h: by - 9 - (y + 25) };
  return {
    panel: { x, y, w: SHOP_W, h: SHOP_H },
    xr: { x: x + SHOP_W - 16, y: y + 6, w: 11, h: 11 },
    labels: { parts: { x: gx, y: y + 26 }, items: { x: gx, y: y + 70 } },
    cats, parts, items, slots, food, pane, by,
    act: { x: pane.x + pane.w - 65, y: pane.y + 7, w: 60, h: 14 }, // BUY / SELL
    tree: shopTree(pane, shopPicked().id),
  };
}
// The picked item's tree, as wells in the read-out: a finished item over its
// parts, or a part under the finished items it goes into.
function shopTree(pane, id) {
  const it = BUILD_ITEMS[id], cx = pane.x + (pane.w >> 1), n = [];
  const top = pane.y + 72, low = top + 32;
  const row = (ids, y, w, span) => {
    const x0 = cx - ((ids.length - 1) * span) / 2;
    ids.forEach((k, i) => n.push({ id: k, x: Math.round(x0 + i * span) - (w >> 1), y, w, h: w }));
  };
  if (it.from) { row([id], top, 22, 0); row(it.from, low, 18, 44); }
  else { row(ITEM_DONE.filter((k) => BUILD_ITEMS[k].from.includes(id)), top, 18, 24); row([id], low, 22, 0); }
  return n;
}

// 'x' | 'panel' | {kind:'cat', c} | {kind:'pick', id} | {kind:'slot', i} |
// {kind:'act'} | {kind:'food', good, dir} | {kind:'foodWell', good} | null.
// Shared by the click, the cursor and the tooltip, so the three can never
// disagree about what the pointer is on.
function shopHit(mx, my) {
  if (!shopOpen()) return null;
  const L = shopLayout(), P = L.panel;
  if (!hitR(P, mx, my)) return null;
  if (hitR(L.xr, mx, my)) return 'x';
  for (const r of L.cats) if (hitR(r, mx, my)) return { kind: 'cat', c: r.c };
  for (const r of L.parts.concat(L.items, L.tree)) if (hitR(r, mx, my)) return { kind: 'pick', id: r.id };
  for (const r of L.slots) if (hitR(r, mx, my)) return { kind: 'slot', i: r.i };
  if (hitR(L.act, mx, my)) return { kind: 'act' };
  for (const f of L.food) {
    if (hitR(f.buy, mx, my)) return { kind: 'food', good: f.good, dir: 1 };
    if (hitR(f.sell, mx, my)) return { kind: 'food', good: f.good, dir: -1 };
    if (hitR(f, mx, my)) return { kind: 'foodWell', good: f.good };
  }
  return 'panel';
}
function hitR(r, mx, my) { return mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h; }

// one left press inside the panel; returns whether it was swallowed
function shopClick(h) {
  if (!h) return false;
  if (h === 'x') { closeShop(); return true; }
  if (h.kind === 'cat') { state.shopCat = state.shopCat === h.c ? -1 : h.c; SFX.place(); return true; }
  if (h.kind === 'pick') { state.shopSel = h.id; state.shopSlot = -1; SFX.place(); return true; }
  if (h.kind === 'slot') { if (player.items[h.i]) { state.shopSlot = h.i; SFX.place(); } return true; }
  if (h.kind === 'act') {
    const pk = shopPicked();
    SFX.unlock();
    player.input.cmd = pk.slot >= 0 ? { kind: 'shop', act: 'sellItem', slot: pk.slot } : { kind: 'shop', act: 'item', id: pk.id };
    if (pk.slot >= 0) { state.shopSlot = -1; state.shopSel = pk.id; }
    return true;
  }
  if (h.kind === 'food') { SFX.unlock(); player.input.cmd = { kind: 'shop', act: 'trade', good: h.good, dir: h.dir }; return true; }
  return true; // the slab eats the rest; the world never sees it
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
// one item's well: its rim says part or finished (the tier rims), hover,
// pick, or can't-afford; a filtered-out or unaffordable item greys back
function shopItemWell(r, id, h, price) {
  const dear = price !== undefined && price > player.inv.gold;
  const hot = !!h && h.kind === 'pick' && h.id === id;
  const pick = shopPicked().slot < 0 && shopPicked().id === id;
  const rim = pick ? SHOP_PICK : hot ? SHOP_HOT : dear ? SHOP_DEAR_RIM : itemMetal(id).rim;
  shopWell(r, rim);
  shopIcon(itemIcon(id), r);
  if (dear || shopFiltered(id)) { ctx.fillStyle = SHOP_DEAR_WASH; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); }
}

function drawShopPanel(now) {
  const L = shopLayout(), P = L.panel;
  const h = mouse.inside ? shopHit(mouse.x, mouse.y) : null;
  drawHudFrame(P.x, P.y, P.w, P.h, { corners: { tl: true, tr: true, bl: true, br: true } });
  // the head: the name, the purse, the way out
  drawPixelText(ctx, 'SHOP', P.x + 7, P.y + 6, SHOP_INK, 2);
  const gold = String(player.inv.gold);
  shopPrice(gold, L.xr.x - 16 - pixelTextWidth(gold), P.y + 9);
  const xh = h === 'x';
  ctx.fillStyle = xh ? SHOP_INK : SHOP_DIM;
  for (let k = 0; k < 5; k++) { ctx.fillRect(L.xr.x + 3 + k, L.xr.y + 3 + k, 1, 1); ctx.fillRect(L.xr.x + 7 - k, L.xr.y + 3 + k, 1, 1); }
  ctx.fillStyle = HUD_EDGE;
  ctx.fillRect(P.x + 3, P.y + 21, P.w - 6, 1);
  ctx.fillRect(P.x + 3, L.by - 5, P.w - 6, 1);

  drawShopCats(L, h);
  drawPixelText(ctx, 'PARTS', L.labels.parts.x, L.labels.parts.y, SHOP_DIM);
  drawPixelText(ctx, 'ITEMS', L.labels.items.x, L.labels.items.y, SHOP_DIM);
  for (const r of L.parts) {
    const n = itemCost(player, r.id).gold;
    shopItemWell(r, r.id, h, n);
    shopPrice(n, r.x + 1, r.y + r.h + 4, n > player.inv.gold);
  }
  for (const r of L.items) {
    const n = itemCost(player, r.id).gold;
    shopItemWell(r, r.id, h, n);
    shopPrice(n, r.x + 1, r.y + r.h + 4, n > player.inv.gold);
  }
  drawShopPane(L, h);
  drawShopSlots(L, h);
  for (const f of L.food) drawShopFood(f, h);
}

// The category plates: ALL, then one a stat, each that stat's own picture.
// The picked one is rimmed lit; picking it again clears the filter.
function drawShopCats(L, h) {
  const icons = { dmg: SPRITES.itemArt_flint, hp: SPRITES.heartFull, armor: SPRITES.gearIcons[1][1][1],
    as: SPRITES.weaponArt.bow, ms: SPRITES.gearIcons[3][0][1] };
  for (const r of L.cats) {
    const on = (state.shopCat === undefined ? -1 : state.shopCat) === r.c;
    const hot = !!h && h.kind === 'cat' && h.c === r.c;
    shopWell(r, on ? SHOP_PICK : hot ? SHOP_HOT : SHOP_RIM);
    if (r.c < 0) { // ALL: four squares, the grid itself
      ctx.fillStyle = on ? SHOP_INK : SHOP_DIM;
      for (const [a, b] of [[4, 4], [9, 4], [4, 9], [9, 9]]) ctx.fillRect(r.x + a, r.y + b, 3, 3);
    } else {
      const im = icons[ITEM_STAT_ORDER[r.c]];
      ctx.drawImage(im, r.x + ((r.w - im.width) >> 1), r.y + ((r.h - im.height) >> 1));
    }
  }
}

// THE READ-OUT: the picked item big, its name and full price, the plate that
// acts on it, its stats in green, its passive in gold over one dim line, and
// its build tree under all of that.
function drawShopPane(L, h) {
  const R = L.pane, pk = shopPicked(), it = BUILD_ITEMS[pk.id];
  shopWell(R, HUD_EDGE, SHOP_PANE_BG);
  const big = { x: R.x + 5, y: R.y + 5, w: 28, h: 28 };
  shopWell(big, itemMetal(pk.id).rim);
  shopIcon(itemIcon(pk.id), big);
  drawPixelText(ctx, it.name, R.x + 38, R.y + 7, SHOP_INK);
  shopPrice(it.price, R.x + 38, R.y + 19);
  // BUY what is picked on the grid, SELL what is picked in your slots
  const A = L.act, hot = !!h && h.kind === 'act';
  let word, n, ok;
  if (pk.slot >= 0) { word = 'SELL'; n = itemSellValue(pk.id); ok = true; }
  else { const c = itemCost(player, pk.id); word = 'BUY'; n = c.gold; ok = n <= player.inv.gold && itemRoom(player, c.used) >= 1; }
  ctx.fillStyle = !ok ? SHOP_DEAR_BAND : hot ? SHOP_PLATE_HOT : SHOP_PLATE;
  ctx.fillRect(A.x, A.y, A.w, A.h);
  drawPixelText(ctx, word, A.x + 6, A.y + 5, ok ? SHOP_INK : SHOP_DEAR_INK);
  shopPrice(n, A.x + 9 + pixelTextWidth(word), A.y + 5, !ok);
  // the stats, then the passive
  let y = R.y + 39;
  for (const s of ITEM_STAT_ORDER) {
    if (!(s in it.stats)) continue;
    const S = ITEM_STATS[s];
    drawPixelText(ctx, S.fmt(it.stats[s]) + ' ' + S.label, R.x + 6, y, SHOP_STAT);
    y += 8;
  }
  if (it.passive) {
    const pv = ITEM_PASSIVES[it.passive];
    drawPixelText(ctx, pv.name, R.x + 6, y + 3, RES_COLORS.gold);
    drawPixelText(ctx, pv.line, R.x + 6, y + 11, SHOP_DIM);
  }
  // the tree: lines between the two rows, then the wells; a part already in
  // your slots is rimmed green with a tick and wears no price
  const tree = L.tree, up = tree.filter((r) => r.y === tree[0].y), low = tree.filter((r) => r.y !== tree[0].y);
  if (low.length) {
    const cy = up[0].y + up[0].h + 4;
    ctx.fillStyle = SHOP_DIM;
    const xs = up.concat(low).map((r) => r.x + (r.w >> 1));
    ctx.fillRect(Math.min(...xs), cy, Math.max(...xs) - Math.min(...xs) + 1, 1);
    for (const r of up) ctx.fillRect(r.x + (r.w >> 1), r.y + r.h, 1, cy - r.y - r.h);
    for (const r of low) ctx.fillRect(r.x + (r.w >> 1), cy, 1, r.y - cy);
  }
  const held = player.items.slice();
  for (const r of tree) {
    const i = r.id !== pk.id && isPart(r.id) ? held.indexOf(r.id) : -1;
    if (i >= 0) held[i] = null;
    const hot2 = !!h && h.kind === 'pick' && h.id === r.id;
    shopWell(r, i >= 0 ? SHOP_STAT : hot2 ? SHOP_HOT : itemMetal(r.id).rim);
    shopIcon(itemIcon(r.id), r);
    if (i >= 0) { ctx.fillStyle = SHOP_STAT; ctx.fillRect(r.x + r.w - 4, r.y + 1, 3, 3); }
    else if (r.id !== pk.id) shopPrice(BUILD_ITEMS[r.id].price, r.x, r.y + r.h + 4, BUILD_ITEMS[r.id].price > player.inv.gold);
  }
}

// your six slots, along the bottom: a held item in its tier rim, the picked
// one lit; an empty slot is a dark well
function drawShopSlots(L, h) {
  for (const r of L.slots) {
    const id = player.items[r.i];
    const hot = !!h && h.kind === 'slot' && h.i === r.i && id;
    shopWell(r, state.shopSlot === r.i && id ? SHOP_PICK : hot ? SHOP_HOT : id ? itemMetal(id).rim : SHOP_RIM);
    if (id) shopIcon(itemIcon(id), r);
  }
}

// one food plate: the good and how many you carry, its fixed price, and the
// two plain words that trade it
function drawShopFood(f, h) {
  shopWell(f, SHOP_RIM);
  const im = SPRITES[ITEMS[f.good].icon];
  ctx.drawImage(im, f.x + 4, f.y + ((f.h - im.height) >> 1));
  drawPixelText(ctx, shortNum(foodHeld(player, f.good)), f.x + 4 + im.width - 2, f.y + 15, SHOP_DIM);
  shopPrice(foodPrice(f.good), f.x + 22, f.y + 9);
  for (const [r, word, dir] of [[f.buy, 'BUY', 1], [f.sell, 'SELL', -1]]) {
    const hot = !!h && h.kind === 'food' && h.good === f.good && h.dir === dir;
    const live = dir > 0 ? player.inv.gold >= foodPrice(f.good) : foodHeld(player, f.good) > 0;
    if (hot && live) { ctx.fillStyle = SHOP_PLATE_HOT; ctx.fillRect(r.x, r.y, r.w, r.h); }
    drawPixelText(ctx, word, r.x + ((r.w - pixelTextWidth(word)) >> 1), r.y + 5, live ? SHOP_INK : SHOP_DIM);
  }
}

// ---- tooltips ------------------------------------------------------------
// What the pointer is on at the counter, in the shared descriptor shape
// (tipBase and friends, js/ui/tooltip.js).
function tipShop(h) {
  if (!h || typeof h === 'string') return null;
  if (h.kind === 'pick') return tipItem(h.id, itemCost(player, h.id).gold);
  if (h.kind === 'slot') {
    const id = player.items[h.i];
    if (!id) return null;
    const d = tipItem(id);
    d.rows.push(['SELLS FOR', itemSellValue(id) + ' GOLD', RES_COLORS.gold]);
    return d;
  }
  if (h.kind === 'foodWell' || h.kind === 'food') {
    const d = { title: h.good === 'fish' ? 'FISH' : 'BERRIES', tcol: RES_COLORS[h.good], kind: 'FOOD', rows: [], notes: [],
      icon: SPRITES[ITEMS[h.good].icon], plate: BAG_WELL, rim: SHOP_RIM };
    d.rows.push(['PRICE', foodPrice(h.good) + ' GOLD', RES_COLORS.gold]);
    d.rows.push(['CARRIED', String(foodHeld(player, h.good)), '#f4f7ff']);
    if (h.good === 'fish') d.notes.push(['A BIGGER FISH FETCHES MORE', TIP_DIM]);
    return d;
  }
  return null;
}
// one item: its stats, its passive, and what it costs you now
function tipItem(id, cost) {
  const it = BUILD_ITEMS[id];
  const d = { title: it.name, tcol: itemMetal(id).ink, kind: isPart(id) ? 'PART' : 'ITEM',
    rows: [], notes: [], icon: itemIcon(id), plate: BAG_WELL, rim: itemMetal(id).rim };
  if (cost !== undefined) d.rows.push(['PRICE', cost + ' GOLD', cost <= player.inv.gold ? RES_COLORS.gold : SHOP_DEAR_INK]);
  for (const s of ITEM_STAT_ORDER) if (s in it.stats) d.rows.push([ITEM_STATS[s].label, ITEM_STATS[s].fmt(it.stats[s]), SHOP_STAT]);
  if (it.passive) {
    d.notes.push([ITEM_PASSIVES[it.passive].name, RES_COLORS.gold]);
    d.notes.push([ITEM_PASSIVES[it.passive].line, TIP_DIM]);
  }
  return d;
}
