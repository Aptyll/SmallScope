'use strict';
// The skins screen: the cosmetics the coins buy, the coin tag in the title's
// top-right corner that opens it, and the one question every drawer asks -
// which skin a bird wears.
// ------------------------------------------------------------ skins
// What a skin IS lives in its table (BIRD_SKINS, js/sprites/eagle.js); the
// purse and the wardrobe are the profile's (PROFILE.coins/owns/buy/worn/wear,
// js/profile.js). Nothing here touches the sim: a skin is paint, read at draw
// time on this machine only.
//
// The screen is one grid of cards, a card per skin, on the lobby's night.
// A card is the bird flapping in your company's colour, its name, and at its
// foot either its price (coin + number, red when the purse is short) or a
// tick when it is the one worn. A press on an owned card wears it; a press on
// a card still for sale picks it, and its price plate lights - a second
// press on the same card buys it and wears it. A purse that is short shakes
// the plate.
const SK_COLS = 3;
const SK_CARD_W = 148, SK_CARD_H = 104, SK_GAP = 8;
const SK_ART_H = 76;          // the bird's box at the top of a card; it is scaled by whole numbers to fit
const SK_SHAKE_T = 0.35;      // the short purse's shake
const SK_FLASH_T = 0.5;       // the buy's flash over the card and the purse
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

// the row an id names, the free one for anything the table does not have
function birdSkinRow(id) {
  for (const r of BIRD_SKINS) if (r.id === id) return r;
  return BIRD_SKINS[0];
}
function skinOwned(r) { return r.price <= 0 || PROFILE.owns(r.id); }
// Which skin a bird wears on this screen: your own company's bird wears the
// one you wear, the other company's the free one (a skin is not sent to the
// other screens yet). Always a BIRD_SKINS id.
function birdSkinFor(team) {
  const id = player && team === player.team ? PROFILE.worn('bird') : null;
  const r = birdSkinRow(id);
  return skinOwned(r) ? r.id : BIRD_SKINS[0].id;
}
// a skin's flap frames facing up the screen, in palette set t (skin(team)):
// the skin's own art when it has some, else today's bird turned nose-up
function birdSkinFrames(id, t) {
  const own = SPRITES.birdSkinIcon && SPRITES.birdSkinIcon[id];
  if (own && own[t]) return own[t];
  return SPRITES.eagleTeam[t];
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
function skinsLayout() {
  const toy = frameTop();
  const cx = Math.round(VIEW_W / 2);
  const n = BIRD_SKINS.length;
  const rows = Math.ceil(n / SK_COLS);
  const gw = SK_COLS * SK_CARD_W + (SK_COLS - 1) * SK_GAP;
  const x0 = cx - Math.round(gw / 2), y0 = toy + 30;
  const cards = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + (i % SK_COLS) * (SK_CARD_W + SK_GAP), y = y0 + Math.floor(i / SK_COLS) * (SK_CARD_H + SK_GAP);
    cards.push({ x, y, w: SK_CARD_W, h: SK_CARD_H, i });
  }
  // the headline over the grid's left edge, the purse over its right
  return { toy, cx, cards, x0, x1: x0 + gw, head: toy + 14, back: y0 + rows * (SK_CARD_H + SK_GAP) + 6 };
}
function beginSkins() {
  const m = state.menu;
  m.screen = 'skins';
  const worn = BIRD_SKINS.indexOf(birdSkinRow(birdSkinFor(player.team)));
  m.skSel = Math.max(0, worn);
  m.skPick = -1;
  m.skHover = {};
  SFX.place();
  SFX.music.play('lobby');
}
function leaveSkins() {
  state.menu.screen = 'menu';
  SFX.pickup();
  SFX.music.play('intro');
}
// the card under the pointer, or -1
function skinsHit() {
  for (const c of skinsLayout().cards) if (overRect(c)) return c.i;
  return -1;
}
// a press on card i: wear what is owned, pick what is for sale, and buy what
// was already picked
function skinPress(i) {
  const m = state.menu;
  const r = BIRD_SKINS[i];
  if (!r) return;
  m.skSel = i;
  if (skinOwned(r)) {
    m.skPick = -1;
    if (PROFILE.wear('bird', i === 0 ? null : r.id)) SFX.place(); else SFX.pickup();
    return;
  }
  if (m.skPick !== i) { m.skPick = i; SFX.pickup(); return; }
  if (!PROFILE.buy(r.id, r.price)) { m.skDeny = SK_SHAKE_T; SFX.deny(); return; }
  PROFILE.wear('bird', r.id);
  m.skPick = -1;
  m.skFlash = SK_FLASH_T; m.skFlashI = i;
  SFX.coin();
}
function skinsKey(k) {
  const m = state.menu;
  const n = BIRD_SKINS.length;
  if (k === 'escape' || k === 'backspace') { if (m.skPick >= 0) { m.skPick = -1; SFX.pickup(); } else leaveSkins(); return; }
  const d = moveDir(k);
  let to = m.skSel;
  if (d === 'left') to = m.skSel - 1;
  else if (d === 'right') to = m.skSel + 1;
  else if (d === 'up') to = m.skSel - SK_COLS;
  else if (d === 'down') to = m.skSel + SK_COLS;
  else if (k === 'enter' || k === ' ') { skinPress(m.skSel); return; }
  if (to !== m.skSel && to >= 0 && to < n) { m.skSel = to; if (m.skPick !== to) m.skPick = -1; SFX.pickup(); }
}
function skinsClick() {
  const m = state.menu;
  if (m.skinT < 1) return;
  const h = skinsHit();
  if (h < 0) { if (m.skPick >= 0) { m.skPick = -1; SFX.pickup(); } return; }
  skinPress(h);
}
function updateSkins(dt) {
  const m = state.menu;
  const h = m.skinT >= 1 && mouse.inside ? skinsHit() : -1;
  for (let i = 0; i < BIRD_SKINS.length; i++) {
    const target = h === i || (padActive() && m.skSel === i) ? 1 : 0;
    m.skHover[i] = (m.skHover[i] || 0) + (target - (m.skHover[i] || 0)) * Math.min(1, dt * 14);
  }
  if (m.skDeny > 0) m.skDeny = Math.max(0, m.skDeny - dt);
  if (m.skFlash > 0) m.skFlash = Math.max(0, m.skFlash - dt);
}

// one card: a well whose rim is slate, lighter under the hand and bright
// steel on the skin worn; the bird flapping in the top box (still at rest,
// beating under the hand); the name at the foot and, opposite it, the price
// or the tick
function drawSkinCard(c, now, a) {
  const m = state.menu;
  const r = BIRD_SKINS[c.i];
  const hv = m.skHover[c.i] || 0;
  const worn = birdSkinFor(player.team) === r.id;
  const owned = skinOwned(r);
  const picked = m.skPick === c.i;
  const y = c.y - Math.round(hv * 1.5);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(4,6,18,0.55)';
  ctx.fillRect(c.x + 2, c.y + 2, c.w, c.h);
  ctx.fillStyle = worn || picked ? '#cfe0ff' : hv > 0.5 ? '#8fa0c8' : '#2c3560';
  ctx.fillRect(c.x, y, c.w, c.h);
  ctx.fillStyle = worn ? '#18203f' : '#0f1632';
  ctx.fillRect(c.x + 1, y + 1, c.w - 2, c.h - 2);
  // the bird, turned nose-up, at the largest whole scale its box holds
  const frames = birdSkinFrames(r.id, skin(player.team));
  const beat = hv > 0.5 || worn || picked;
  const spr = frames[beat ? [0, 1, 2, 1][Math.floor(now * 6 + c.i) % 4] : 0];
  const own = SPRITES.birdSkinIcon && SPRITES.birdSkinIcon[r.id];
  const bw = own ? spr.width : spr.height, bh = own ? spr.height : spr.width; // today's bird flies along +x
  const S = Math.max(1, Math.floor(Math.min((c.w - 8) / bw, (SK_ART_H - 8) / bh)));
  const bx = c.x + Math.round((c.w - bw * S) / 2), by = y + 4 + Math.round((SK_ART_H - bh * S) / 2);
  ctx.globalAlpha = a * (owned ? 1 : 0.85);
  if (own) ctx.drawImage(spr, bx, by, bw * S, bh * S);
  else {
    ctx.save();
    ctx.translate(bx + (bw * S) / 2, by + (bh * S) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(spr, -(spr.width * S) / 2, -(spr.height * S) / 2, spr.width * S, spr.height * S);
    ctx.restore();
  }
  ctx.globalAlpha = a;
  // the foot: a hairline, the name, and the price or the tick
  const fy = y + c.h - 18;
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
  // the buy's flash: the card goes white and fades back
  if (m.skFlash > 0 && m.skFlashI === c.i) {
    ctx.globalAlpha = a * (m.skFlash / SK_FLASH_T) * 0.6;
    ctx.fillStyle = '#f4f7ff';
    ctx.fillRect(c.x + 1, y + 1, c.w - 2, c.h - 2);
    ctx.globalAlpha = a;
  }
  if (padActive() && m.skSel === c.i) { ctx.fillStyle = '#cfe0ff'; ctx.fillRect(c.x, y + c.h - 2, c.w, 2); }
}
function renderSkins(now, a) {
  const m = state.menu;
  const L = skinsLayout();
  drawLobbyBackdrop(now, a);
  const slide = Math.round((1 - a) * 26);
  ctx.globalAlpha = a;
  drawPixelTextShadow(ctx, 'BIRD', L.x0, L.head - slide, '#f4f7ff', '#0a0e23', 2);
  // the purse, over the grid's right edge; it flashes as it pays
  const s = String(PROFILE.coins());
  const pw = 16 + 4 + pixelTextWidth(s, 2);
  stampGrid(SK_COIN, SK_COIN_PAL, L.x1 - pw, L.head - 2 - slide, 2);
  const fl = m.skFlash > 0 ? m.skFlash / SK_FLASH_T : 0;
  drawPixelTextShadow(ctx, s, L.x1 - pw + 20, L.head - slide, fl > 0.5 ? '#ffffff' : '#cfe0ff', '#0a0e23', 2);
  for (const c of L.cards) drawSkinCard({ x: c.x, y: c.y + slide, w: c.w, h: c.h, i: c.i }, now, a);
  ctx.globalAlpha = a;
  drawBackHint(ctx, L.cx, L.back);
  ctx.globalAlpha = 1;
}
