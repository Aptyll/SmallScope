'use strict';
// The skins screen: the cosmetics the coins buy, the coin tag in the title's
// top-right corner that opens it, what a match pays into the purse, and the
// one question every drawer asks - which skin a bird wears.
// ------------------------------------------------------------ skins
// The purse and the wardrobe are the profile's (PROFILE.coins/owns/buy/
// addCoins/worn/wear, js/app/profile.js). Nothing here touches the sim: a skin is
// paint, read at draw time on this machine only, and coins are paid on the
// local machine as its own match ends.
//
// The screen is a navbar of categories (SKIN_TABS) over a grid of cards, a
// card per skin, on the lobby's night. A card is the skin's picture on a
// low glow of its rarity's colour, its name, a bar of that colour along its
// foot, and opposite the name its price (coin + number, red when the purse is
// short) or a tick when it is the one worn. A press on an owned card wears
// it; a press on a card still for sale picks it, and its price plate lights -
// a second press on the same card buys it and wears it. A purse that is short
// shakes the plate.
const SK_COLS = 3;
const SK_CARD_W = 148, SK_CARD_H = 104, SK_GAP = 8;
const SK_ART_H = 76;          // the picture's box at the top of a card; it is scaled by whole numbers to fit
const SK_ART_MAX = 4;         // ...and never past this, so a small icon does not turn to blocks
const SK_SHAKE_T = 0.35;      // the short purse's shake
const SK_FLASH_T = 0.5;       // the buy's flash over the card and the purse
// what a finished match pays the local player: every ending, and a win on top
const COINS_MATCH = 10, COINS_WIN = 15;
// a rarity is a colour and nothing else (each table sets its own prices)
const SKIN_RARITY = {
  common: '#8fa0c8',
  rare: '#4f9cff',
  epic: '#b07cff',
  legend: '#ffa24a',
};
// the coin: a steel-silver piece, apart from the gold a match pays in
const SK_COIN = [
  '..oooo..',
  '.oLLLLo.',
  'oLSSSSDo',
  'oLSDDSDo',
  'oLSDDSDo',
  'oLSSSSDo',
  '.oDDDDo.',
  '..oooo..',
];
const SK_COIN_PAL = { o: '#1a2142', L: '#eef3ff', S: '#b4c3e2', D: '#6f7fa8' };
const SK_TICK = ['......ww', '.....ww.', 'w...ww..', 'ww.ww...', '.www....', '..w.....'];
const SK_TICK_PAL = { w: '#cfe0ff' };

// ---- the catalogue ----------------------------------------------------------
// Each hero's table lives with its own art (heroArt, js/sprites/hero-art.js): every look sold
// here is worn in a match and seen on every screen. Every table's first row is
// free and is the slot's default; an id is what a profile keeps, so it never
// changes.
// The navbar: one tab per hero, in the hero grid's order, read off the
// registry - its word, its 8x8 glyph, the slot the profile keeps its pick
// under (the hero's id) and its looks. What a look is on a card is skinArt.
const SKIN_TABS = CLASSES.map((c, h) => { const a = heroArtOf(h); return { id: c.id, name: c.name, slot: c.id, rows: a.looks, hero: h, glyph: a.glyph }; });

// The wardrobe slots the game no longer has - the HERO coat tints and the
// WEAPON tints (the old HUNTER's coat and bow), the TRAIL streaks, which were
// never worn in a match, and the EAGLE skins, cut to keep the wardrobe to the
// heroes' looks - and what each of their skins cost (the eagle's keys are
// bare, the way they were sold): a profile
// that bought one gets the coins back on its next boot (PROFILE.refundRetired,
// called from boot.js). Add a slot that goes; never change a price here.
const SKIN_RETIRED_SLOTS = ['scout', 'weapon', 'trail', 'bird'];
const SKIN_RETIRED = {
  'scout:pine': 100, 'scout:frost': 200, 'scout:ember': 200, 'scout:aurora': 400, 'scout:robot': 800,
  'weapon:birch': 100, 'weapon:frost': 200, 'weapon:ember': 200, 'weapon:night': 400, 'weapon:sun': 800,
  'trail:smoke': 100, 'trail:frost': 200, 'trail:ember': 200, 'trail:aurora': 400, 'trail:stars': 800,
  helm: 100, beak: 100, horned: 200, crested: 200, ironclad: 400,
};

// the row an id names in a table, the free one for anything it does not have
function skinRow(rows, id) {
  for (const r of rows) if (r.id === id) return r;
  return rows[0];
}
// The profile keeps what was bought as one list of keys. An id is only
// unique within its table, so a key is `slot:id`.
function skinKey(tab, r) { return tab.slot + ':' + r.id; }
function skinHas(tab, r) { return r.price <= 0 || PROFILE.owns(skinKey(tab, r)); }
// the row a tab's slot wears now: the pick, if it is still owned, else the free one
function skinWorn(tab) {
  const r = skinRow(tab.rows, PROFILE.worn(tab.slot));
  return skinHas(tab, r) ? r : tab.rows[0];
}
// the looks this profile wears on each hero, as a player carries them
// (p.skins: hero slot -> id; only owned, and only a look that is not the
// hero's own free one)
function profileHeroSkins() {
  const out = {};
  for (const tab of SKIN_TABS) { const r = skinWorn(tab); if (r !== tab.rows[0]) out[tab.slot] = r.id; }
  return out;
}
// what a finished match pays (endMatch, js/sim/player.js, on its first ending
// only); practice pays nothing
function payMatchCoins(won) {
  if (PRACTICE) return;
  PROFILE.addCoins(COINS_MATCH + (won ? COINS_WIN : 0));
}

// ---- the pictures -------------------------------------------------------------
// A card's picture: { img, sx, sy, w, h } - the hero standing in that look.
// Cached; nothing is smoothed.
const skinArtCache = new Map();
function skinArt(tab, r, t) {
  const key = tab.id + ':' + r.id + ':' + t;
  let cv = skinArtCache.get(key);
  if (!cv) {
    cv = SPRITES.champLook(tab.hero, t, r.id).down[0]; // the hero standing in that look
    skinArtCache.set(key, cv);
  }
  return { img: cv, sx: 0, sy: 0, w: cv.width, h: cv.height };
}

// ---- the coin tag -----------------------------------------------------------
// top-right of the title: the coin and the purse, the way into the screen
function coinTagRect() {
  const s = String(PROFILE.coins());
  const w = 8 + 3 + pixelTextWidth(s);
  return { x: VIEW_W - 5 - w, y: 5, w, h: 8 };
}
function overCoinTag() {
  const r = coinTagRect();
  return overRect(r, 3);
}
function drawCoinTag() {
  const hot = !state.menu.panel && overCoinTag();
  const r = coinTagRect();
  stampGrid(SK_COIN, SK_COIN_PAL, r.x, r.y, 1);
  drawPixelTextShadow(ctx, String(PROFILE.coins()), r.x + 11, r.y + 1, hot ? '#ffd95c' : '#cfe0ff', 'rgba(15,22,50,0.9)');
  if (hot) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(r.x + 11, r.y + 9, r.w - 11, 1); }
}

// ---- the screen -------------------------------------------------------------
// the navbar's tabs left to right from the grid's left edge (glyph, gap,
// word), the purse over the grid's right edge, the cards under them. A tab
// row longer than the room between them scrolls: skTabs.off is the first tab
// shown, and each end with more past it wears a chevron that pages that way.
const SK_TAB_GAP = 14;  // px between two tabs
const SK_TAB_CHEV = 10; // px an end's chevron takes off the strip
const skTabs = { off: 0 };
function skinTabW(i) { return 8 + 4 + pixelTextWidth(SKIN_TABS[i].name); }
// the tabs shown from `off` on a strip from x0 to x1, as [{ x, w, i }]: a tab
// with more after it leaves the right chevron its room
function skinTabsFrom(off, x0, x1) {
  const n = SKIN_TABS.length, out = [];
  let x = x0 + (off > 0 ? SK_TAB_CHEV : 0);
  for (let i = off; i < n; i++) {
    const w = skinTabW(i);
    if (x + w > x1 - (i < n - 1 ? SK_TAB_CHEV : 0)) break;
    out.push({ x, w, i });
    x += w + SK_TAB_GAP;
  }
  return out;
}
// the strip's ends: the grid's left edge, and the purse's left less a gap
function skinStrip() {
  const gw = SK_COLS * SK_CARD_W + (SK_COLS - 1) * SK_GAP;
  const x0 = Math.round(VIEW_W / 2) - Math.round(gw / 2);
  return { x0, x1: x0 + gw - (8 + 4 + pixelTextWidth(String(PROFILE.coins()))) - 12 };
}
// the last `off` whose strip still reaches the final tab
function skinTabsMax(st) {
  const n = SKIN_TABS.length;
  let off = 0;
  while (off < n - 1) { const v = skinTabsFrom(off, st.x0, st.x1); if (v.length && v[v.length - 1].i === n - 1) break; off++; }
  return off;
}
// scroll the strip by d tabs (a chevron pages, the wheel steps); true if it moved
function skinsScrollBy(d) {
  const st = skinStrip();
  const off = Math.max(0, Math.min(skinTabsMax(st), skTabs.off + d));
  if (off === skTabs.off) return false;
  skTabs.off = off;
  SFX.notch();
  return true;
}
// the pointer over the strip (the wheel's way to scroll it)
function skinsTabsOver() {
  const st = skinStrip(), y = frameTop() + 12;
  return mouse.x >= st.x0 - 4 && mouse.x < st.x1 + 4 && mouse.y >= y - 4 && mouse.y < y + 13;
}
// the open tab brought into the strip
function skinsTabShow(i) {
  const st = skinStrip();
  if (i < skTabs.off) skTabs.off = i;
  for (let k = 0; k < SKIN_TABS.length; k++) {
    const v = skinTabsFrom(skTabs.off, st.x0, st.x1);
    if (v.length && v[v.length - 1].i >= i) break;
    skTabs.off++;
  }
}
function skinsLayout() {
  const toy = frameTop();
  const cx = Math.round(VIEW_W / 2);
  const gw = SK_COLS * SK_CARD_W + (SK_COLS - 1) * SK_GAP;
  const x0 = cx - Math.round(gw / 2), y0 = toy + 30, head = toy + 12;
  const st = skinStrip();
  skTabs.off = Math.max(0, Math.min(skinTabsMax(st), skTabs.off));
  const shown = skinTabsFrom(skTabs.off, st.x0, st.x1);
  const tabs = shown.map((t) => ({ x: t.x, y: head, w: t.w, h: 9, i: t.i }));
  const chevs = [];
  if (skTabs.off > 0) chevs.push({ x: st.x0, y: head, w: 5, h: 9, d: -1 });
  if (shown.length && shown[shown.length - 1].i < SKIN_TABS.length - 1) chevs.push({ x: st.x1 - 5, y: head, w: 5, h: 9, d: 1 });
  const page = Math.max(1, shown.length - 1);
  const rows = SKIN_TABS[state.menu.skTab].rows;
  const cards = [];
  for (let i = 0; i < rows.length; i++) {
    const x = x0 + (i % SK_COLS) * (SK_CARD_W + SK_GAP), y = y0 + Math.floor(i / SK_COLS) * (SK_CARD_H + SK_GAP);
    cards.push({ x, y, w: SK_CARD_W, h: SK_CARD_H, i });
  }
  const nrows = Math.max(2, Math.ceil(rows.length / SK_COLS));
  return { toy, cx, tabs, chevs, page, cards, x0, x1: x0 + gw, head, back: y0 + nrows * (SK_CARD_H + SK_GAP) + 6 };
}
// open tab i (wrapping), its keyboard card on the skin worn
function skinsTab(i) {
  const m = state.menu;
  const n = SKIN_TABS.length;
  i = ((i % n) + n) % n;
  if (i === m.skTab) return;
  m.skTab = i;
  skinsTabShow(i);
  const tab = SKIN_TABS[i];
  m.skSel = Math.max(0, tab.rows.indexOf(skinWorn(tab)));
  m.skPick = -1;
  m.skHover = {};
  SFX.pickup();
}
function beginSkins() {
  const m = state.menu;
  m.screen = 'skins';
  skinsTabShow(m.skTab);
  const tab = SKIN_TABS[m.skTab];
  m.skSel = Math.max(0, tab.rows.indexOf(skinWorn(tab)));
  m.skPick = -1;
  m.skNav = false; m.skKeyed = false;
  m.skHover = {};
  SFX.place();
  SFX.music.play('lobby');
}
function leaveSkins() {
  state.menu.screen = 'menu';
  SFX.pickup();
  SFX.music.play('intro');
}
// what the pointer is on: { kind: 'tab'|'card', i } or null
function skinsHit() {
  const L = skinsLayout();
  for (const c of L.chevs) if (overRect(c, 3, 4)) return { kind: 'chev', i: c.d };
  for (const t of L.tabs) if (overRect(t, 4, 4)) return { kind: 'tab', i: t.i };
  for (const c of L.cards) if (overRect(c)) return { kind: 'card', i: c.i };
  return null;
}
// a press on card i of the open tab: wear what is owned, pick what is for
// sale, and buy what was already picked
function skinPress(i) {
  const m = state.menu;
  const tab = SKIN_TABS[m.skTab];
  const r = tab.rows[i];
  if (!r) return;
  m.skSel = i;
  if (skinHas(tab, r)) {
    m.skPick = -1;
    if (PROFILE.wear(tab.slot, i === 0 ? null : r.id)) SFX.place(); else SFX.pickup();
    player.skins = profileHeroSkins(); // the stage and the next match wear it
    return;
  }
  if (m.skPick !== i) { m.skPick = i; SFX.pickup(); return; }
  if (!PROFILE.buy(skinKey(tab, r), r.price)) { m.skDeny = SK_SHAKE_T; SFX.deny(); return; }
  PROFILE.wear(tab.slot, r.id);
  player.skins = profileHeroSkins();
  m.skPick = -1;
  m.skFlash = SK_FLASH_T; m.skFlashI = i;
  SFX.coin();
}
// Q/E turn the tabs; the arrows walk the grid, and up off its top row lands
// on the navbar (skNav), where left/right turn the tabs and down goes back.
// A key press shows the selection (skKeyed) until the next click.
function skinsKey(k) {
  const m = state.menu;
  m.skKeyed = true;
  const n = SKIN_TABS[m.skTab].rows.length;
  if (k === 'escape' || k === 'backspace') { if (m.skPick >= 0) { m.skPick = -1; SFX.pickup(); } else leaveSkins(); return; }
  if (k === 'q') { skinsTab(m.skTab - 1); return; }
  if (k === 'e') { skinsTab(m.skTab + 1); return; }
  const d = moveDir(k);
  if (m.skNav) {
    if (d === 'left') skinsTab(m.skTab - 1);
    else if (d === 'right') skinsTab(m.skTab + 1);
    else if (d === 'down' || k === 'enter' || k === ' ') { m.skNav = false; SFX.pickup(); }
    return;
  }
  let to = m.skSel;
  if (d === 'left') to = m.skSel - 1;
  else if (d === 'right') to = m.skSel + 1;
  else if (d === 'up') { if (m.skSel < SK_COLS) { m.skNav = true; m.skPick = -1; SFX.pickup(); return; } to = m.skSel - SK_COLS; }
  else if (d === 'down') to = m.skSel + SK_COLS;
  else if (k === 'enter' || k === ' ') { skinPress(m.skSel); return; }
  if (to !== m.skSel && to >= 0 && to < n) { m.skSel = to; if (m.skPick !== to) m.skPick = -1; SFX.pickup(); }
}
function skinsClick() {
  const m = state.menu;
  if (m.skinT < 1) return;
  const h = skinsHit();
  m.skNav = false;
  m.skKeyed = false;
  if (h && h.kind === 'tab') { skinsTab(h.i); return; }
  if (h && h.kind === 'chev') { skinsScrollBy(h.i * skinsLayout().page); return; }
  if (!h) { if (m.skPick >= 0) { m.skPick = -1; SFX.pickup(); } return; }
  skinPress(h.i);
}
function updateSkins(dt) {
  const m = state.menu;
  const h = m.skinT >= 1 && mouse.inside ? skinsHit() : null;
  const want = h ? h.kind + h.i : m.skKeyed ? (m.skNav ? 'tab' + m.skTab : 'card' + m.skSel) : '';
  for (const k of Object.keys(m.skHover)) m.skHover[k] += ((want === k ? 1 : 0) - m.skHover[k]) * Math.min(1, dt * 14);
  if (want && m.skHover[want] === undefined) m.skHover[want] = 0;
  if (m.skDeny > 0) m.skDeny = Math.max(0, m.skDeny - dt);
  if (m.skFlash > 0) m.skFlash = Math.max(0, m.skFlash - dt);
}

// one card: a well whose rim is slate, lighter under the hand and bright
// steel on the skin worn and the one picked; the picture on a low glow of
// the rarity's colour, still at rest and moving under the hand; under a
// hairline the name, the price or the tick; the rarity's bar along the foot
function drawSkinCard(c, now, a) {
  const m = state.menu;
  const tab = SKIN_TABS[m.skTab];
  const r = tab.rows[c.i];
  const hv = m.skHover['card' + c.i] || 0;
  const worn = skinWorn(tab) === r;
  const owned = skinHas(tab, r);
  const picked = m.skPick === c.i;
  const rc = SKIN_RARITY[r.rarity] || SKIN_RARITY.common;
  const y = c.y - Math.round(hv * 1.5);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(4,6,18,0.55)';
  ctx.fillRect(c.x + 2, c.y + 2, c.w, c.h);
  ctx.fillStyle = worn || picked ? '#cfe0ff' : hv > 0.5 ? '#8fa0c8' : '#2c3560';
  ctx.fillRect(c.x, y, c.w, c.h);
  ctx.fillStyle = worn ? '#18203f' : '#0f1632';
  ctx.fillRect(c.x + 1, y + 1, c.w - 2, c.h - 2);
  // the rarity's glow, low behind the picture
  const gx = c.x + c.w / 2, gy = y + SK_ART_H / 2 + 4;
  const grd = ctx.createRadialGradient(gx, gy, 2, gx, gy, c.w / 2);
  grd.addColorStop(0, rc + '38');
  grd.addColorStop(1, rc + '00');
  ctx.fillStyle = grd;
  ctx.fillRect(c.x + 1, y + 1, c.w - 2, SK_ART_H + 2);
  // the picture at the largest whole scale its box holds; one bigger than
  // the box at 1x is clipped to it rather than shrunk off the pixel grid
  const art = skinArt(tab, r, skin(player.team));
  const bw = art.w, bh = art.h;
  const S = Math.max(1, Math.min(SK_ART_MAX, Math.floor(Math.min((c.w - 8) / bw, (SK_ART_H - 8) / bh))));
  const bx = c.x + Math.round((c.w - bw * S) / 2), by = y + 4 + Math.round((SK_ART_H - bh * S) / 2);
  ctx.save();
  ctx.beginPath(); ctx.rect(c.x + 1, y + 1, c.w - 2, SK_ART_H + 2); ctx.clip();
  ctx.globalAlpha = a * (owned ? 1 : 0.85);
  ctx.drawImage(art.img, art.sx, art.sy, bw, bh, bx, by, bw * S, bh * S);
  ctx.restore();
  ctx.globalAlpha = a;
  // the foot: a hairline, the name, and the price or the tick
  const fy = y + c.h - 20;
  ctx.fillStyle = '#2c3a68'; ctx.fillRect(c.x + 6, fy - 4, c.w - 12, 1);
  drawPixelTextShadow(ctx, r.name, c.x + 8, fy + 3, worn ? '#f4f7ff' : '#9fb6d8', '#0a0e23');
  if (worn) stampGrid(SK_TICK, SK_TICK_PAL, c.x + c.w - 16, fy + 3, 1);
  else if (!owned) {
    const s = String(r.price);
    const pw = 8 + 3 + pixelTextWidth(s) + 8;
    const shake = picked && m.skDeny > 0 ? Math.round(Math.sin(now * 70) * 2 * (m.skDeny / SK_SHAKE_T)) : 0;
    const px = c.x + c.w - 6 - pw + shake, py = fy - 1;
    const short = PROFILE.coins() < r.price;
    if (picked) {
      // the plate lights: the press that buys is the next one on this card
      const glow = 0.6 + 0.4 * Math.sin(now * 6);
      ctx.fillStyle = short ? '#c86a5a' : '#cfe0ff';
      ctx.globalAlpha = a * glow;
      ctx.fillRect(px, py, pw, 13);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#0f1632'; ctx.fillRect(px + 1, py + 1, pw - 2, 11);
    }
    stampGrid(SK_COIN, SK_COIN_PAL, px + 4, py + 2, 1);
    drawPixelTextShadow(ctx, s, px + 15, py + 3, short ? '#e0806a' : '#f4f7ff', '#0a0e23');
  }
  // the rarity's bar
  ctx.fillStyle = rc;
  ctx.fillRect(c.x + 1, y + c.h - 3, c.w - 2, 2);
  // the buy's flash: the card goes white and fades back
  if (m.skFlash > 0 && m.skFlashI === c.i) {
    ctx.globalAlpha = a * (m.skFlash / SK_FLASH_T) * 0.6;
    ctx.fillStyle = '#f4f7ff';
    ctx.fillRect(c.x + 1, y + 1, c.w - 2, c.h - 2);
    ctx.globalAlpha = a;
  }
  if (m.skKeyed && !m.skNav && m.skSel === c.i) { ctx.fillStyle = '#cfe0ff'; ctx.fillRect(c.x, y + c.h + 2, c.w, 1); }
}
// a navbar tab: the glyph and the word, dim slate at rest, pale under the
// hand, white on the open tab with a 1 px line as wide as the word under it
function drawSkinTab(t, a) {
  const m = state.menu;
  const tab = SKIN_TABS[t.i];
  const open = m.skTab === t.i;
  const hot = (m.skHover['tab' + t.i] || 0) > 0.5;
  const col = open ? '#f4f7ff' : hot ? '#cfe0ff' : '#5a6690';
  ctx.globalAlpha = a;
  stampGrid(tab.glyph, { w: col }, t.x, t.y, 1);
  drawPixelTextShadow(ctx, tab.name, t.x + 12, t.y + 2, col, 'rgba(8,12,28,0.9)');
  if (open) { ctx.fillStyle = '#cfe0ff'; ctx.fillRect(t.x + 12, t.y + 10, t.w - 12, 1); }
}
function renderSkins(now, a) {
  const m = state.menu;
  const L = skinsLayout();
  drawLobbyBackdrop(now, a);
  const slide = Math.round((1 - a) * 26);
  for (const t of L.tabs) drawSkinTab({ x: t.x, y: t.y - slide, w: t.w, h: t.h, i: t.i }, a);
  ctx.globalAlpha = a;
  // the strip's chevrons: an end with more tabs past it, pale under the hand
  for (const c of L.chevs) {
    ctx.fillStyle = (m.skHover['chev' + c.d] || 0) > 0.5 ? '#f4f7ff' : '#8fa0c8';
    for (let k = 0; k < 3; k++) {
      const x = c.x + (c.d > 0 ? 1 + k : 3 - k), y = c.y - slide + 4;
      ctx.fillRect(x, y - 2 + k, 1, 1); ctx.fillRect(x, y + 2 - k, 1, 1);
    }
  }
  // the purse, over the grid's right edge; it flashes as it pays
  const s = String(PROFILE.coins());
  const pw = 8 + 4 + pixelTextWidth(s);
  stampGrid(SK_COIN, SK_COIN_PAL, L.x1 - pw, L.head - slide, 1);
  const fl = m.skFlash > 0 ? m.skFlash / SK_FLASH_T : 0;
  drawPixelTextShadow(ctx, s, L.x1 - pw + 12, L.head + 2 - slide, fl > 0.5 ? '#ffffff' : '#cfe0ff', '#0a0e23');
  for (const c of L.cards) drawSkinCard({ x: c.x, y: c.y + slide, w: c.w, h: c.h, i: c.i }, now, a);
  ctx.globalAlpha = a;
  drawBackHint(ctx, L.cx, L.back);
  ctx.globalAlpha = 1;
}
