'use strict';
// ------ the market tab
// The counter's third face, beside the SHOP and the FORGE (the tab plates:
// forgeTabs, js/ui/forge.js): the four traded goods - the three fish and the
// berries - on a page of their own. The rules underneath (the walk, the
// shocks, the ledger) are the `market` banner of js/ui/shop.js; this file is
// only how they are read and traded.
//
// The page: a row per good down the left (its live price, the last move, what
// you carry), the picked good's three days as one big chart on the right, and
// along the bottom the four trades - BUY 1, BUY 5, SELL 1, SELL ALL - each
// wearing the gold it moves. On the chart every trade you made is PINNED: a
// green mark under the line where you bought and a red one over it where you
// sold, at the very move and the very coin it happened at (marketLog), so the
// chart answers "did I buy low?" by looking. A dashed gold line is what your
// buys still on the chart cost on average.
//
// The chart's line is drawn on the COIN - the rounded price the counter
// actually pays - rather than the walk's float, so a marker never floats a
// pixel off the line it was traded on. Its right edge is the market's clock
// right now (marketNow), not the newest sample, so the line creeps on between
// moves and a trade made this second lands at the edge rather than a move
// ahead of where the line is drawn.
//
// The numbers on this page are the panel carve-out of CLAUDE.md's UI rule
// (the shop banner's reason): reading a market IS reading numbers.
const MKT_SIGN = 'MARKET';
const MKT_GOODS = ['fish', 'whitefish', 'snowChar', 'berry']; // the rows' order: the money good first
const MKT_BUY = '#8fe08a', MKT_SELL = '#e0637a';               // a buy and a sale, and the rise and the fall
const MKT_AVG = '#f2cc6a';                                      // what the buys cost, in the purse's own gold
const MKT_INK = '#c3d0ee', MKT_DIM = '#5a6a99';
const MKT_ROW_H = 28;      // a good's row in the list
const MKT_BTN_H = 18;      // a trade plate along the bottom
const MKT_AXIS = 22;       // the price axis down the chart's right side
// the trades along the bottom: [dir, how many] - Infinity is "all you carry"
const MKT_TRADE = [[1, 1], [1, 5], [-1, 1], [-1, Infinity]];

// which good the page is on: this screen's own choice of what to look at (a
// trade names its good in the order), so not match state
let mktSel = 'fish';
// TEMP (mock): which of the two layouts is drawn
let mktLook = 'A';

// the chart glyph on the MARKET tab (the SHOP tab wears the coin, the FORGE the anvil)
const MKT_GLYPH = SPRITES.marketGlyph = bakeGrid([
  '.........gg',
  '........g.g',
  '.r.....g...',
  'r.r...g....',
  '...r.g.....',
  '....g......',
  'ooooooooooo',
], { '.': null, o: '#6c7486', g: MKT_BUY, r: MKT_SELL }, 11);

const MKT_KINDS = new Set(['mGood', 'mTrade', 'mMark', 'mChart']);
function mktKind(h) { return !!h && MKT_KINDS.has(h.kind); }

// ---- layout, hits and clicks -------------------------------------------
// The page's geometry, off the counter's own (shopLayout): it stands in the
// room the stock and the sell strip take on the SHOP face.
function mktLayout(L) {
  const x = L.head.x, w = L.head.w, top = L.panel.y + SHOP_HEAD + 7, bot = L.lane.y - 5;
  const btns = [], bw = Math.floor((w - 3 * 4) / 4), by = bot - MKT_BTN_H;
  for (let i = 0; i < MKT_TRADE.length; i++) {
    btns.push({ dir: MKT_TRADE[i][0], n: MKT_TRADE[i][1], x: x + i * (bw + 4), y: by, w: bw, h: MKT_BTN_H });
  }
  btns[btns.length - 1].w = x + w - btns[btns.length - 1].x; // the last plate takes the odd px
  const rows = [];
  let chart, info;
  if (mktLook === 'A') {
    const lw = 84;
    for (let i = 0; i < MKT_GOODS.length; i++) rows.push({ id: MKT_GOODS[i], x, y: top + i * (MKT_ROW_H + 3), w: lw, h: MKT_ROW_H });
    chart = { x: x + lw + 6, y: top, w: w - lw - 6, h: by - 18 - top };
    info = { x: chart.x, y: chart.y + chart.h + 4, w: chart.w, h: 10 };
  } else {
    const tw = Math.floor((w - 3 * 4) / 4);
    for (let i = 0; i < MKT_GOODS.length; i++) rows.push({ id: MKT_GOODS[i], x: x + i * (tw + 4), y: top, w: i === 3 ? x + w - (x + i * (tw + 4)) : tw, h: 22 });
    chart = { x, y: top + 26, w, h: by - 18 - top - 26 };
    info = { x, y: chart.y + chart.h + 4, w, h: 10 };
  }
  const plot = { x: chart.x + 1, y: chart.y + 1, w: chart.w - 2 - MKT_AXIS, h: chart.h - 2 };
  return { rows, chart, plot, info, btns };
}

// what the pointer is on, on the MARKET face - null for the bare slab
function mktHit(L, mx, my) {
  const M = L.market;
  for (const r of M.rows) if (hitR(r, mx, my)) return { kind: 'mGood', id: r.id };
  for (const b of M.btns) if (hitR(b, mx, my)) return { kind: 'mTrade', dir: b.dir, n: b.n };
  if (hitR(M.chart, mx, my)) {
    const k = mktMarkAt(M, mx, my);
    return k >= 0 ? { kind: 'mMark', i: k } : { kind: 'mChart', x: mx };
  }
  return null;
}
function mktClick(h) {
  if (h.kind === 'mGood') {
    if (mktSel !== h.id) { mktSel = h.id; SFX.place(); }
    return;
  }
  if (h.kind === 'mTrade') {
    if (!mktCan(h.dir, h.n)) { SFX.deny(); return; }
    SFX.unlock();
    player.input.cmd = { kind: 'shop', act: 'trade', good: mktSel, dir: h.dir, n: h.n === Infinity ? 1e6 : h.n };
  }
}
// can this trade be made at all, and how many units it would move
function mktUnits(dir, n) {
  const id = mktSel, price = marketPrice(id);
  if (dir > 0) return Math.min(n, Math.floor(player.inv.gold / price), bagRoom(player, id));
  return Math.min(n, bagCount(player, id));
}
function mktCan(dir, n) { return mktUnits(dir, n) > 0; }

// ---- the chart's geometry ----------------------------------------------
// One frame's read of the picked good's chart: the coin at every sample, the
// window it spans in market moves, and the two maps onto the plot. Shared by
// the drawing, the marker hits and the hover, so all three agree on where a
// trade sits to the pixel.
function mktChart(M) {
  const id = mktSel, k = goodScale(id), hist = marketHist(id), n = hist.length;
  const now = marketNow(), t0 = (market.step || 0) - (n - 1); // the oldest sample's move
  const coin = hist.map((v) => Math.max(1, Math.round(v * k)));
  const marks = (player.trades || []).filter((t) => t.id === id && t.at >= t0);
  const avg = mktAvg(marks);
  let lo = Infinity, hi = -Infinity;
  for (const v of coin) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (const t of marks) { if (t.c < lo) lo = t.c; if (t.c > hi) hi = t.c; }
  if (avg) { lo = Math.min(lo, avg); hi = Math.max(hi, avg); }
  if (hi - lo < 4) { const m = (hi + lo) / 2; lo = m - 2; hi = m + 2; }
  const P = M.plot, span = now - t0;
  const px = (at) => P.x + Math.round((at - t0) / span * (P.w - 1));
  const py = (v) => P.y + 4 + Math.round((hi - v) / (hi - lo) * (P.h - 9));
  return { id, coin, t0, now, marks, avg, lo, hi, px, py, at: (x) => t0 + (x - P.x) / (P.w - 1) * span };
}
// what the buys still on the chart cost for one, on average (0: no buys)
function mktAvg(marks) {
  let n = 0, g = 0;
  for (const t of marks) if (t.d > 0) { n += t.n; g += t.c * t.n; }
  return n ? g / n : 0;
}
// the marker under the pointer (an index into the chart's marks), or -1
function mktMarkAt(M, mx, my) {
  const C = mktChart(M);
  let best = -1, bd = 5;
  for (let i = 0; i < C.marks.length; i++) {
    const t = C.marks[i], x = C.px(t.at), y = C.py(t.c) + (t.d > 0 ? 3 : -3);
    const d = Math.max(Math.abs(mx - x), Math.abs(my - y));
    if (d <= bd) { bd = d; best = i; }
  }
  return best;
}

// ---- drawing -------------------------------------------------------------
function drawMarket(L, h, now) {
  const M = L.market;
  for (const r of M.rows) drawMktRow(r, h, now);
  const C = mktChart(M);
  drawMktChart(M, C, h);
  drawMktInfo(M.info, C);
  for (const b of M.btns) drawMktBtn(b, h);
}

// One good: its icon and name, the live coin in the direction of the last
// move, and what you carry. The picked one is lit and rimmed in its colour.
function drawMktRow(r, h, now) {
  const id = r.id, on = id === mktSel, hot = !!h && h.kind === 'mGood' && h.id === id;
  const g = market.goods[goodOf(id)], hist = g.hist;
  const prev = hist.length > 1 ? hist[hist.length - 2] : g.price, up = g.price >= prev;
  const col = RES_COLORS[id], price = marketPrice(id), held = bagCount(player, id);
  ctx.fillStyle = 'rgba(4,6,18,0.5)'; ctx.fillRect(r.x + 2, r.y + 2, r.w, r.h);
  ctx.fillStyle = on ? col : g.pop > 0 && Math.sin(now * 8) > 0 ? col : hot ? '#8fa0c8' : '#2c3560';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = on ? '#141c3c' : '#0d1229';
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const img = SPRITES[ITEMS[id].icon];
  ctx.globalAlpha = on || hot ? 1 : 0.7;
  ctx.drawImage(img, r.x + 4, r.y + 4);
  ctx.globalAlpha = 1;
  const pt = String(price), pw = pixelTextWidth(pt, 2);
  const ink = up ? MKT_BUY : MKT_SELL;
  if (mktLook === 'A') {
    drawPixelText(ctx, goodName(id), r.x + 4, r.y + r.h - 9, on ? '#f4f7ff' : MKT_INK);
    drawPixelText(ctx, pt, r.x + r.w - 4 - pw, r.y + 4, ink, 2);
    drawTrend(r.x + r.w - 11 - pw, r.y + 7, up);
    if (held) {
      const ht = 'X' + shortNum(held);
      drawPixelText(ctx, ht, r.x + r.w - 4 - pixelTextWidth(ht), r.y + r.h - 9, col);
    }
  } else {
    drawPixelText(ctx, pt, r.x + r.w - 4 - pw, r.y + 3, ink, 2);
    drawTrend(r.x + r.w - 11 - pw, r.y + 6, up);
    if (held) drawPixelText(ctx, 'X' + shortNum(held), r.x + 4, r.y + r.h - 8, col);
  }
  if (on) { ctx.fillStyle = col; ctx.fillRect(r.x + 1, r.y + r.h - 2, r.w - 2, 1); }
}

// The picked good's three days: the day marks, the area and the step line on
// the coin, the dashed average of your buys, every trade pinned where it
// happened, the live coin on the axis, and - under the pointer - a hairline
// with the coin and how long ago.
function drawMktChart(M, C, h) {
  const R = M.chart, P = M.plot, col = RES_COLORS[C.id];
  ctx.fillStyle = '#070a1e'; ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.fillStyle = BAG_WELL; ctx.fillRect(R.x + 1, R.y + 1, R.w - 2, R.h - 2);
  // the axis: the high, the middle and the low as faint rules with their coin
  ctx.fillStyle = '#151b3a';
  ctx.fillRect(P.x + P.w, R.y + 1, 1, R.h - 2);
  for (const v of [C.hi, (C.hi + C.lo) / 2, C.lo]) {
    const y = C.py(v);
    for (let x = P.x; x < P.x + P.w; x += 4) ctx.fillRect(x, y, 2, 1);
    drawPixelText(ctx, String(Math.round(v)), P.x + P.w + 4, y - 2, MKT_DIM);
  }
  // the day marks, counted back from now
  const per = CYCLE / MKT_STEP;
  ctx.fillStyle = '#20294f';
  for (let d = 1; d < MKT_DAYS; d++) {
    const gx = C.px(C.now - d * per);
    if (gx <= P.x) continue;
    for (let y = P.y; y < P.y + P.h; y += 3) ctx.fillRect(gx, y, 1, 2);
  }
  // the area, then the step line over it: a sample holds until the next one,
  // and the newest holds out to the right edge, which is now
  const n = C.coin.length, xs = [];
  for (let i = 0; i < n; i++) xs.push(C.px(C.t0 + i));
  xs.push(P.x + P.w - 1);
  ctx.globalAlpha = 0.2; ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const y = C.py(C.coin[i]);
    ctx.fillRect(xs[i], y, Math.max(1, xs[i + 1] - xs[i]), P.y + P.h - y);
  }
  ctx.globalAlpha = 1; ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const y = C.py(C.coin[i]);
    ctx.fillRect(xs[i], y, Math.max(1, xs[i + 1] - xs[i] + (i === n - 1 ? 1 : 0)), 1);
    if (i) { const y0 = C.py(C.coin[i - 1]); ctx.fillRect(xs[i], Math.min(y, y0), 1, Math.abs(y - y0) + 1); }
  }
  // what the buys cost, dashed in gold across the whole plot
  if (C.avg) {
    const y = C.py(C.avg);
    ctx.fillStyle = MKT_AVG;
    for (let x = P.x; x < P.x + P.w; x += 5) ctx.fillRect(x, y, 3, 1);
  }
  // the live coin on the axis, on a plate in the colour of the last move
  const last = C.coin[n - 1], prev = n > 1 ? C.coin[n - 2] : last;
  const ly = C.py(last), lt = String(last), lw = pixelTextWidth(lt) + 4;
  ctx.fillStyle = last >= prev ? MKT_BUY : MKT_SELL;
  ctx.fillRect(P.x + P.w, ly - 3, lw, 7);
  drawPixelText(ctx, lt, P.x + P.w + 2, ly - 2, '#0a0e23');
  ctx.fillStyle = '#f4f7ff'; ctx.fillRect(P.x + P.w - 2, ly - 1, 3, 3);
  // the trades, pinned
  const hm = h && h.kind === 'mMark' ? h.i : -1;
  for (let i = 0; i < C.marks.length; i++) drawMktMark(C, C.marks[i], i === hm);
  // the hairline under the pointer
  if (h && h.kind === 'mChart' && h.x >= P.x && h.x < P.x + P.w) {
    const at = C.at(h.x), i = Math.max(0, Math.min(n - 1, Math.floor(at - C.t0)));
    const v = C.coin[i], y = C.py(v);
    ctx.fillStyle = '#8fa0c8';
    for (let yy = P.y; yy < P.y + P.h; yy += 2) ctx.fillRect(h.x, yy, 1, 1);
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(h.x - 1, y - 1, 3, 3);
    const tag = v + '  ' + mktAgo(C.now - at), tw = pixelTextWidth(tag) + 6;
    const tx = Math.max(P.x, Math.min(P.x + P.w - tw, h.x - (tw >> 1)));
    ctx.fillStyle = '#070a1e'; ctx.fillRect(tx, P.y, tw, 9);
    drawPixelText(ctx, tag, tx + 3, P.y + 2, '#f4f7ff');
  }
}

// A trade, pinned: a dot on the line at the exact move and coin, and a
// triangle off it - under the line pointing up for a buy, over it pointing down
// for a sale. A run of units says how many beside the point.
function drawMktMark(C, t, hot) {
  const x = C.px(t.at), y = C.py(t.c), buy = t.d > 0, col = buy ? MKT_BUY : MKT_SELL;
  ctx.fillStyle = '#070a1e';
  ctx.fillRect(x - 2, y - 2, 5, 5);
  ctx.fillStyle = hot ? '#f4f7ff' : col;
  ctx.fillRect(x - 1, y - 1, 3, 3);
  // the triangle: three rows, apex toward the dot
  for (let k = 0; k < 3; k++) {
    const ry = buy ? y + 3 + k : y - 3 - k;
    ctx.fillStyle = '#070a1e'; ctx.fillRect(x - k - 1, ry, k * 2 + 3, 1);
  }
  for (let k = 0; k < 3; k++) {
    const ry = buy ? y + 3 + k : y - 3 - k;
    ctx.fillStyle = hot ? '#f4f7ff' : col; ctx.fillRect(x - k, ry, k * 2 + 1, 1);
  }
  if (t.n > 1) {
    const s = String(shortNum(t.n));
    drawPixelTextOutline(ctx, s, x + 4, buy ? y + 3 : y - 8, hot ? '#f4f7ff' : col, '#070a1e');
  }
}

// seconds back from now as m:ss
function mktAgo(moves) {
  const s = Math.max(0, Math.round(moves * MKT_STEP));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// Under the chart: what you carry of the good, what that fetches right now,
// and - in the dashed line's gold - what your buys cost on average.
function drawMktInfo(r, C) {
  const id = C.id, held = bagCount(player, id), price = marketPrice(id);
  let x = r.x;
  const img = SPRITES[ITEMS[id].icon];
  ctx.drawImage(img, x, r.y + ((8 - img.height) >> 1));
  x += img.width + 3;
  const ht = 'X' + shortNum(held);
  drawPixelText(ctx, ht, x, r.y + 1, held ? '#f4f7ff' : MKT_DIM);
  x += pixelTextWidth(ht) + 6;
  ctx.drawImage(SPRITES.itemGold, x, r.y);
  x += 11;
  const wt = String(shortNum(held * price));
  drawPixelText(ctx, wt, x, r.y + 1, held ? RES_COLORS.gold : MKT_DIM);
  if (C.avg) {
    const at = 'PAID ' + Math.round(C.avg), aw = pixelTextWidth(at);
    const ax = r.x + r.w - aw;
    ctx.fillStyle = MKT_AVG;
    for (let k = 0; k < 3; k++) ctx.fillRect(ax - 14 + k * 4, r.y + 3, 3, 1);
    drawPixelText(ctx, at, ax, r.y + 1, MKT_AVG);
  }
}

// A trade plate: the word and the gold it moves, in plain words like the
// menus. Lit in the trade's own colour when it will go, dark when it will
// not - and red-rimmed when the reason is the purse.
function drawMktBtn(b, h) {
  const k = mktUnits(b.dir, b.n), on = k > 0, hot = on && !!h && h.kind === 'mTrade' && h.dir === b.dir && h.n === b.n;
  const dear = b.dir > 0 && !on && player.inv.gold < marketPrice(mktSel);
  const col = b.dir > 0 ? MKT_BUY : MKT_SELL, y = b.y - (hot ? 1 : 0);
  ctx.fillStyle = 'rgba(4,6,18,0.5)'; ctx.fillRect(b.x + 1, b.y + 1, b.w, b.h);
  ctx.fillStyle = dear ? SHOP_DEAR_RIM : !on ? '#232c52' : hot ? col : '#41527f';
  ctx.fillRect(b.x, y, b.w, b.h);
  ctx.fillStyle = dear ? SHOP_DEAR_BAND : on ? '#141c3c' : '#0c1128';
  ctx.fillRect(b.x + 1, y + 1, b.w - 2, b.h - 2);
  const word = (b.dir > 0 ? 'BUY ' : 'SELL ') + (b.n === Infinity ? 'ALL' : b.n);
  drawPixelText(ctx, word, b.x + 5, y + 6, on ? (hot ? '#f4f7ff' : col) : MKT_DIM);
  const g = String(shortNum((on ? k : Math.min(b.n === Infinity ? 1 : b.n, 1)) * marketPrice(mktSel)));
  const gw = pixelTextWidth(g);
  ctx.globalAlpha = on ? 1 : 0.4;
  ctx.drawImage(SPRITES.itemGold, b.x + b.w - 5 - gw - 10, y + 5);
  ctx.globalAlpha = 1;
  drawPixelText(ctx, g, b.x + b.w - 5 - gw, y + 6, on ? (b.dir > 0 ? '#f4f7ff' : RES_COLORS.gold) : MKT_DIM);
}

// ---- the ticker on the SHOP face ----------------------------------------
// A card a good under the stock's MARKET rule: the good, its live coin and the
// last move, and its three days as a sparkline. The whole card is a way onto
// the MARKET page, opened on its good (shopClick, js/ui/shop.js).
function drawMktTicker(c, h, now) {
  const id = c.id, g = market.goods[goodOf(id)], hist = g.hist, col = RES_COLORS[id];
  const hot = !!h && h.kind === 'good' && h.id === id;
  const prev = hist.length > 1 ? hist[hist.length - 2] : g.price, up = g.price >= prev;
  const y = c.y - (hot ? 1 : 0);
  ctx.fillStyle = 'rgba(4,6,18,0.5)'; ctx.fillRect(c.x + 2, c.y + 2, c.w, c.h);
  ctx.fillStyle = g.pop > 0 && Math.sin(now * 8) > 0 ? col : hot ? SHOP_WOOD_L : SHOP_WOOD;
  ctx.fillRect(c.x, y, c.w, c.h);
  ctx.fillStyle = '#0d1229'; ctx.fillRect(c.x + 1, y + 1, c.w - 2, c.h - 2);
  ctx.drawImage(SPRITES[ITEMS[id].icon], c.x + 4, y + 4);
  const pt = String(marketPrice(id)), pw = pixelTextWidth(pt, 2);
  drawPixelText(ctx, pt, c.x + c.w - 4 - pw, y + 3, up ? MKT_BUY : MKT_SELL, 2);
  drawTrend(c.x + c.w - 11 - pw, y + 6, up);
  // the sparkline: the coin over the three days, the area under it faint
  const r = { x: c.x + 3, y: y + 18, w: c.w - 6, h: c.h - 21 }, k = goodScale(id), n = hist.length;
  ctx.fillStyle = BAG_WELL; ctx.fillRect(r.x, r.y, r.w, r.h);
  let lo = Infinity, hi = -Infinity;
  for (const v of hist) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi - lo < 0.5) hi = lo + 0.5;
  const px = (i) => r.x + Math.round(i / (n - 1) * (r.w - 1));
  const py = (v) => r.y + r.h - 2 - Math.round((v - lo) / (hi - lo) * (r.h - 4));
  ctx.globalAlpha = 0.22; ctx.fillStyle = col;
  for (let i = 0; i < n; i++) { const yy = py(hist[i]); ctx.fillRect(px(i), yy, 1, r.y + r.h - yy); }
  ctx.globalAlpha = 1;
  let lx = px(0), ly = py(hist[0]);
  for (let i = 1; i < n; i++) {
    const x = px(i), yy = py(hist[i]);
    ctx.fillRect(x, Math.min(ly, yy), 1, Math.abs(yy - ly) + 1);
    if (x > lx + 1) ctx.fillRect(lx, ly, x - lx, 1);
    lx = x; ly = yy;
  }
  ctx.fillStyle = '#f4f7ff'; ctx.fillRect(lx - 1, ly - 1, 3, 3);
  const held = bagCount(player, id);
  if (held) drawPixelTextShadow(ctx, 'X' + shortNum(held), r.x + 2, r.y + 2, col, BAG_WELL);
}

// ---- tooltips ------------------------------------------------------------
function tipMarket(h) {
  if (h.kind === 'mGood') return tipShop({ kind: 'good', id: h.id });
  if (h.kind !== 'mMark') return null;
  const C = mktChart(shopLayout().market), t = C.marks[h.i];
  if (!t) return null;
  const buy = t.d > 0;
  const d = { title: buy ? 'BOUGHT' : 'SOLD', tcol: buy ? MKT_BUY : MKT_SELL, kind: goodName(t.id), rows: [], notes: [],
    icon: SPRITES[ITEMS[t.id].icon], plate: BAG_WELL, rim: '#35426e' };
  d.rows.push(['AMOUNT', String(t.n), '#f4f7ff']);
  d.rows.push(['PRICE', t.c + ' GOLD', RES_COLORS.gold]);
  d.rows.push([buy ? 'PAID' : 'FETCHED', t.c * t.n + ' GOLD', RES_COLORS.gold]);
  const now = marketPrice(t.id), dv = (now - t.c) * (buy ? 1 : -1);
  d.rows.push(['NOW', now + ' GOLD', dv >= 0 ? MKT_BUY : MKT_SELL]);
  d.rows.push(['WHEN', mktAgo(C.now - t.at) + ' AGO', '#f4f7ff']);
  return d;
}
