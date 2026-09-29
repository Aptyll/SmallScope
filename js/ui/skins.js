'use strict';
// The skins screen: the cosmetics the coins buy, the coin tag in the title's
// top-right corner that opens it, what a match pays into the purse, and the
// one question every drawer asks - which skin a bird wears.
// ------------------------------------------------------------ skins
// The purse and the wardrobe are the profile's (PROFILE.coins/owns/buy/
// addCoins/worn/wear, js/profile.js). Nothing here touches the sim: a skin is
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
// PLACEHOLDERS: the scout, weapon and trail skins below have no art of their
// own yet and are not worn in a match - a card shows today's picture washed
// in the skin's `tint` (a trail, a streak in its two `cols`). The bird's
// table is real and lives with its art (BIRD_SKINS, js/sprites/eagle.js).
// Every table's first row is free and is the slot's default; an id is what
// a profile keeps, so it never changes.
const SCOUT_SKINS = [
  { id: 'plain', name: 'TRAIL COAT', rarity: 'common', price: 0 },
  { id: 'pine', name: 'PINE WARDEN', rarity: 'common', price: 100, tint: '#3f8a5a' },
  { id: 'frost', name: 'FROSTBITE', rarity: 'rare', price: 200, tint: '#8fd4ff' },
  { id: 'ember', name: 'EMBERWALK', rarity: 'rare', price: 200, tint: '#e0603a' },
  { id: 'aurora', name: 'AURORA', rarity: 'epic', price: 400, tint: '#6ae0c0' },
  { id: 'gilded', name: 'GILDED EXILE', rarity: 'legend', price: 800, tint: '#ffc84a' },
];
const WEAPON_SKINS = [
  { id: 'plain', name: 'BARE WOOD', rarity: 'common', price: 0 },
  { id: 'birch', name: 'BIRCH', rarity: 'common', price: 100, tint: '#e8e0cc' },
  { id: 'frost', name: 'RIME', rarity: 'rare', price: 200, tint: '#8fd4ff' },
  { id: 'ember', name: 'CINDER', rarity: 'rare', price: 200, tint: '#e0603a' },
  { id: 'night', name: 'MIDNIGHT', rarity: 'epic', price: 400, tint: '#5a4ab8' },
  { id: 'sun', name: 'SUNFIRE', rarity: 'legend', price: 800, tint: '#ffc84a' },
];
// the streak a scout leaves dropping off the eagle: two colours, head and tail
const TRAIL_SKINS = [
  { id: 'plain', name: 'SNOWFALL', rarity: 'common', price: 0, cols: ['#f4f7ff', '#8fa0c8'] },
  { id: 'smoke', name: 'WOODSMOKE', rarity: 'common', price: 100, cols: ['#b8b0a8', '#5a5660'] },
  { id: 'frost', name: 'ICE SHARDS', rarity: 'rare', price: 200, cols: ['#cfeeff', '#4f9cff'] },
  { id: 'ember', name: 'EMBERS', rarity: 'rare', price: 200, cols: ['#ffd070', '#e0603a'] },
  { id: 'aurora', name: 'AURORA', rarity: 'epic', price: 400, cols: ['#6ae0c0', '#b07cff'] },
  { id: 'stars', name: 'STARDUST', rarity: 'legend', price: 800, cols: ['#ffffff', '#ffa24a'] },
];
// The navbar: one tab per wardrobe slot - its word, its 8x8 glyph, the slot
// the profile keeps its pick under, and its table. What a skin looks like on
// a card is skinArt below.
const SKIN_TABS = [
  { id: 'scout', name: 'SCOUT', slot: 'scout', rows: SCOUT_SKINS, glyph: ['..ww....', '..ww....', '.wwww...', 'w.ww.w..', 'w.ww.w..', '..ww....', '.w..w...', '.w..w...'] },
  { id: 'bird', name: 'EAGLE', slot: 'bird', rows: BIRD_SKINS, glyph: ['........', 'w......w', 'ww....ww', '.ww..ww.', '..wwww..', '...ww...', '...ww...', '..w..w..'] },
  { id: 'weapon', name: 'WEAPON', slot: 'weapon', rows: WEAPON_SKINS, glyph: ['...wwww.', '..w..ww.', '.w..w.w.', 'w..w..w.', 'w.w...w.', 'ww....w.', 'wwwwww..', '........'] },
  { id: 'trail', name: 'TRAIL', slot: 'trail', rows: TRAIL_SKINS, glyph: ['...w....', '..www.w.', '...w....', '......w.', '.w...www', 'www...w.', '.w......', '........'] },
];
const SK_TAB_BIRD = 1; // SKIN_TABS' eagle, the one tab a match already reads

// the row an id names in a table, the free one for anything it does not have
function skinRow(rows, id) {
  for (const r of rows) if (r.id === id) return r;
  return rows[0];
}
// The profile keeps what was bought as one list of keys. An id is only
// unique within its table, so a key is `slot:id` - but the bird's, which
// went out first, stay bare.
function skinKey(tab, r) { return tab.slot === 'bird' ? r.id : tab.slot + ':' + r.id; }
function skinHas(tab, r) { return r.price <= 0 || PROFILE.owns(skinKey(tab, r)); }
// the row a tab's slot wears now: the pick, if it is still owned, else the free one
function skinWorn(tab) {
  const r = skinRow(tab.rows, PROFILE.worn(tab.slot));
  return skinHas(tab, r) ? r : tab.rows[0];
}
function birdSkinRow(id) { return skinRow(BIRD_SKINS, id); }
function skinOwned(r) { return skinHas(SKIN_TABS[SK_TAB_BIRD], r); } // a bird row
// Which skin a bird wears on this screen: your own company's bird wears the
// one you wear, the other company's the free one (a skin is not sent to the
// other screens yet). Always a BIRD_SKINS id.
function birdSkinFor(team) {
  return player && team === player.team ? skinWorn(SKIN_TABS[SK_TAB_BIRD]).id : BIRD_SKINS[0].id;
}
// what a finished match pays (endMatch, js/player.js, on its first ending
// only); practice pays nothing
function payMatchCoins(won) {
  if (PRACTICE) return;
  PROFILE.addCoins(COINS_MATCH + (won ? COINS_WIN : 0));
}

// ---- the pictures -------------------------------------------------------------
// A card's picture: { img, sx, sy, w, h, turn } - a source rect, and whether
// it is today's eagle, which flies along +x and is turned nose-up. f is the
// beat (0..3) while the card is lit. Cached; nothing is smoothed.
const skinArtCache = new Map();
function washed(src, tint) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  if (tint) {
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.5;
    g.fillStyle = tint;
    g.fillRect(0, 0, cv.width, cv.height);
  }
  return cv;
}
// the streak: a bright head, the tail in the second colour and breaking up;
// f slides the specks
function trailArt(cols, f) {
  const cv = document.createElement('canvas');
  cv.width = 48; cv.height = 30;
  const g = cv.getContext('2d');
  for (let k = 0; k < 90; k++) {
    const u = ((k * 37) % 90) / 90;                    // 0 head .. 1 tail
    const x = Math.round(42 - u * 36 + ((k * 13 + f * 3) % 5) - 2);
    const y = Math.round(6 + u * 18 + ((k * 7 + f) % 5) - 2);
    if (hash2(k * 11 + f, 5) > 1 - u * 0.8) continue;
    g.fillStyle = u < 0.35 ? cols[0] : cols[1];
    const sz = u < 0.15 ? 2 : 1;
    g.fillRect(x, y, sz, sz);
  }
  return cv;
}
function skinArt(tab, r, t, f) {
  if (tab.id === 'bird') {
    const own = SPRITES.birdSkinIcon && SPRITES.birdSkinIcon[r.id];
    if (own && own[t]) { const spr = own[t][f % own[t].length]; return { img: spr, sx: 0, sy: 0, w: spr.width, h: spr.height, turn: false }; }
    const spr = SPRITES.eagleTeam[t][[0, 1, 2, 1][f % 4]];
    return { img: spr, sx: 0, sy: 0, w: spr.height, h: spr.width, turn: true };
  }
  let key = tab.id + ':' + r.id + ':' + t;
  if (tab.id === 'trail') key += ':' + f;
  if (tab.id === 'scout') key += ':' + player.cls + ':' + JSON.stringify(player.look); // the scout you are
  let cv = skinArtCache.get(key);
  if (!cv) {
    if (tab.id === 'scout') cv = washed(SPRITES.portrait(player.cls, player.look, t), r.tint);
    else if (tab.id === 'weapon') cv = washed(SPRITES.itemBow, r.tint);
    else cv = trailArt(r.cols, f);
    skinArtCache.set(key, cv);
  }
  return { img: cv, sx: 0, sy: 0, w: cv.width, h: cv.height, turn: false };
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
  return mouse.x >= r.x - 3 && mouse.x < r.x + r.w + 3 && mouse.y >= r.y - 3 && mouse.y < r.y + r.h + 3;
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
// word), the purse over the grid's right edge, the cards under them
function skinsLayout() {
  const toy = frameTop();
  const cx = Math.round(VIEW_W / 2);
  const gw = SK_COLS * SK_CARD_W + (SK_COLS - 1) * SK_GAP;
  const x0 = cx - Math.round(gw / 2), y0 = toy + 30, head = toy + 12;
  const tabs = [];
  let tx = x0;
  for (let i = 0; i < SKIN_TABS.length; i++) {
    const w = 8 + 4 + pixelTextWidth(SKIN_TABS[i].name);
    tabs.push({ x: tx, y: head, w, h: 9, i });
    tx += w + 14;
  }
  const rows = SKIN_TABS[state.menu.skTab].rows;
  const cards = [];
  for (let i = 0; i < rows.length; i++) {
    const x = x0 + (i % SK_COLS) * (SK_CARD_W + SK_GAP), y = y0 + Math.floor(i / SK_COLS) * (SK_CARD_H + SK_GAP);
    cards.push({ x, y, w: SK_CARD_W, h: SK_CARD_H, i });
  }
  const nrows = Math.max(2, Math.ceil(rows.length / SK_COLS));
  return { toy, cx, tabs, cards, x0, x1: x0 + gw, head, back: y0 + nrows * (SK_CARD_H + SK_GAP) + 6 };
}
// open tab i (wrapping), its keyboard card on the skin worn
function skinsTab(i) {
  const m = state.menu;
  const n = SKIN_TABS.length;
  i = ((i % n) + n) % n;
  if (i === m.skTab) return;
  m.skTab = i;
  const tab = SKIN_TABS[i];
  m.skSel = Math.max(0, tab.rows.indexOf(skinWorn(tab)));
  m.skPick = -1;
  m.skHover = {};
  SFX.pickup();
}
function beginSkins() {
  const m = state.menu;
  m.screen = 'skins';
  const tab = SKIN_TABS[m.skTab];
  m.skSel = Math.max(0, tab.rows.indexOf(skinWorn(tab)));
  m.skPick = -1;
  m.skNav = false;
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
    return;
  }
  if (m.skPick !== i) { m.skPick = i; SFX.pickup(); return; }
  if (!PROFILE.buy(skinKey(tab, r), r.price)) { m.skDeny = SK_SHAKE_T; SFX.deny(); return; }
  PROFILE.wear(tab.slot, r.id);
  m.skPick = -1;
  m.skFlash = SK_FLASH_T; m.skFlashI = i;
  SFX.coin();
}
// Q/E turn the tabs; the arrows walk the grid, and up off its top row lands
// on the navbar (skNav), where left/right turn the tabs and down goes back
function skinsKey(k) {
  const m = state.menu;
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
  if (h && h.kind === 'tab') { skinsTab(h.i); return; }
  if (!h) { if (m.skPick >= 0) { m.skPick = -1; SFX.pickup(); } return; }
  skinPress(h.i);
}
function updateSkins(dt) {
  const m = state.menu;
  const h = m.skinT >= 1 && mouse.inside ? skinsHit() : null;
  const want = h ? h.kind + h.i : padActive() ? (m.skNav ? 'tab' + m.skTab : 'card' + m.skSel) : '';
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
  const beat = hv > 0.5 || worn || picked;
  const art = skinArt(tab, r, skin(player.team), beat ? Math.floor(now * 6 + c.i) % 4 : 0);
  const bw = art.w, bh = art.h;
  const S = Math.max(1, Math.min(SK_ART_MAX, Math.floor(Math.min((c.w - 8) / bw, (SK_ART_H - 8) / bh))));
  const bx = c.x + Math.round((c.w - bw * S) / 2), by = y + 4 + Math.round((SK_ART_H - bh * S) / 2);
  ctx.save();
  ctx.beginPath(); ctx.rect(c.x + 1, y + 1, c.w - 2, SK_ART_H + 2); ctx.clip();
  ctx.globalAlpha = a * (owned ? 1 : 0.85);
  if (!art.turn) ctx.drawImage(art.img, art.sx, art.sy, bw, bh, bx, by, bw * S, bh * S);
  else {
    ctx.translate(bx + (bw * S) / 2, by + (bh * S) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(art.img, -(art.img.width * S) / 2, -(art.img.height * S) / 2, art.img.width * S, art.img.height * S);
  }
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
  if (padActive() && !m.skNav && m.skSel === c.i) { ctx.fillStyle = '#cfe0ff'; ctx.fillRect(c.x, y + c.h + 2, c.w, 1); }
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
