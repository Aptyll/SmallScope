'use strict';
// The HUD's shared well tones and big well, overHud, the character panel (G)
// and the meal clock.
// ---- the HUD's wells --------------------------------------------------------
// THE HUD'S BIG WELL (HUD_CELL): the strip's ability wells, their art doubled.
// A filled well recesses BELOW the frame's ground (BAG_BG) and an empty one
// sits above it, so the tones say occupied / free / frame without any line
// doing it.
const HUD_CELL = 34;
const BAG_PAD = 3;            // frame edge to the first well: line, light, ground (drawHudFrame)
const BAG_BG = '#16181c';     // a HUD frame's ground
const BAG_WELL = '#0e0f12';   // a filled well
// the pointer is over HUD that owns its own clicks, not over the world
function overHud(x, y) {
  return !!charHit(x, y) || !!shopHit(x, y) || !!stripHit(x, y) || abBuyHit(x, y) >= 0 ||
    overMinimap() || !!cheatHit(x, y);
}

// ---- the character panel (G) ---------------------------------------------
// WoW's C key, at this game's size: one slab, sim running live behind it.
// LEFT: the body as it stands right now - the class sprite walking in place
// at 4x with the held weapon beside it - and under it the STAT LEDGER,
// STAT_ROWS read off the LIVE kit (kitOf) with the player handed to it, so
// items and the hero level's own growth are all in the numbers - the
// same table, numbers and verdict inks as the stat sheet that flies into the
// notice lane (js/ui/shop.js), opened out: the panel's job is reading a body
// at leisure, the plate's is catching what moved. RIGHT: the six item slots,
// each a well with the item's icon (part or finished rim, as on the bar),
// its name and its passive; a hover raises the shop's item card (tipItem).
// Items are bought and sold at a counter, never here. The ledger's labelled
// rows are the panels' text carve-out - comparing numbers is this panel's
// whole job. G toggles it, ESC or the X closes it; it swallows only its own
// clicks, so the fight stays live around it.
const CHAR_LEDW = 118, CHAR_WELL = 28;
function charLayout() {
  const rowW = 128;
  const pw = 8 + CHAR_LEDW + 10 + rowW + 8;
  const ph = 226;
  const px = Math.round((VIEW_W - pw) / 2), py = Math.round((VIEW_H - ph) / 2);
  const gx = px + 8 + CHAR_LEDW + 10;
  const rows = [];
  for (let i = 0; i < ITEM_SLOTS; i++) {
    rows.push({ x: gx, y: py + 22 + i * (CHAR_WELL + 5), w: rowW, h: CHAR_WELL });
  }
  return { panel: { x: px, y: py, w: pw, h: ph }, rows,
    prev: { x: px + 8, y: py + 22, w: CHAR_LEDW, h: 78 },
    led: { x: px + 8, y: py + 106, w: CHAR_LEDW },
    xr: { x: px + pw - 14, y: py + 4, w: 10, h: 10 } };
}
// 'x' | { item } | 'panel' | null - shared by the click, the cursor and the
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
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return { item: i };
  }
  return 'panel';
}
// the item slot under the pointer on the panel, or -1 (the tooltip's read)
function charItemHit(mx, my) {
  const h = charHit(mx, my);
  return h && h.item !== undefined ? h.item : -1;
}
// a press inside the panel; returns whether it was swallowed
function charClick(h) {
  if (!h) return false;
  if (h === 'x') { state.charOpen = false; SFX.pickup(); return true; }
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
  ctx.fillStyle = '#121418'; chamRect(panel.x, panel.y, panel.w, panel.h);
  ctx.fillStyle = '#10173a'; chamRect(panel.x + 1, panel.y + 1, panel.w - 2, panel.h - 2);
  ctx.fillStyle = '#3c4048';
  ctx.fillRect(panel.x + 2, panel.y + 1, panel.w - 4, 1); ctx.fillRect(panel.x + 1, panel.y + 2, 1, panel.h - 4);
  ctx.fillStyle = '#080c1c';
  ctx.fillRect(panel.x + 2, panel.y + panel.h - 2, panel.w - 4, 1); ctx.fillRect(panel.x + panel.w - 2, panel.y + 2, 1, panel.h - 4);
  // the header: whose sheet this is - the name in the team's mark, the class
  // and hero level beside it in quiet ink
  const head = player.name;
  const sub = CLASSES[player.cls].name + ' ' + player.level;
  drawPixelTextShadow(ctx, head, panel.x + 8, panel.y + 6, TEAMS[skin(player.team)].mark, '#121418');
  drawPixelTextShadow(ctx, sub, panel.x + 8 + pixelTextWidth(head) + 8, panel.y + 6, '#8c919a', '#121418');
  // the body, live: walking in place with the held weapon beside it
  const pr = L.prev;
  ctx.fillStyle = '#121418';
  ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
  ctx.fillStyle = '#2b2e34';
  ctx.fillRect(pr.x, pr.y, pr.w, 1); ctx.fillRect(pr.x, pr.y + pr.h - 1, pr.w, 1);
  ctx.fillRect(pr.x, pr.y, 1, pr.h); ctx.fillRect(pr.x + pr.w - 1, pr.y, 1, pr.h);
  const sx = pr.x + 12, sy = pr.y + 7;
  ctx.fillStyle = 'rgba(4,6,18,0.6)';
  ctx.beginPath(); ctx.ellipse(sx + 32, pr.y + pr.h - 6, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
  const spr = SPRITES.champLook(player.cls, player.look, skin(0)).down[1 + (Math.floor(now * 3) % 2)];
  ctx.drawImage(spr, sx, sy, 64, 64);
  const im = SPRITES.weaponArt[attackOf(player).art]; // the hero's own weapon beside it
  ctx.drawImage(im, pr.x + pr.w - 31, pr.y + pr.h - 33 + Math.round(Math.sin(now * 2.2) * 1.5), 24, 24);
  // the ledger: every number this body carries RIGHT NOW - items
  // and the hero level already folded in, because it reads the live kit and
  // hands the getters the player (STAT_ROWS, js/sim/stats.js)
  const k = kitOf(player);
  for (let i = 0; i < STAT_ROWS.length; i++) {
    const [label, get, fmt] = STAT_ROWS[i];
    const y = L.led.y + i * 8;
    drawPixelTextShadow(ctx, label, L.led.x, y, '#8c919a', '#121418');
    const vTxt = fmt(get(k, player));
    drawPixelTextShadow(ctx, vTxt, L.led.x + L.led.w - pixelTextWidth(vTxt), y, '#f4f7ff', '#121418');
    ctx.fillStyle = '#2c3a68'; // the leader: dots from the label to its number
    for (let dx = L.led.x + pixelTextWidth(label) + 4; dx < L.led.x + L.led.w - pixelTextWidth(vTxt) - 4; dx += 4) {
      ctx.fillRect(dx, y + 4, 2, 1);
    }
  }
  // the six item slots: icon well (part or finished rim, the bar's),
  // the item's name, and its passive under it
  for (let i = 0; i < L.rows.length; i++) {
    const r = L.rows[i], id = player.items[i];
    const on = gh && gh.item === i && !!id;
    const y = r.y - (on ? 1 : 0);
    ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(r.x + 2, r.y + 2, CHAR_WELL, CHAR_WELL);
    ctx.fillStyle = !id ? '#33363d' : on ? '#9ca1aa' : itemMetal(id).rim;
    ctx.fillRect(r.x, y, CHAR_WELL, CHAR_WELL);
    ctx.fillStyle = '#191b1f';
    ctx.fillRect(r.x + 1, y + 1, CHAR_WELL - 2, CHAR_WELL - 2);
    if (!id) continue;
    shopIcon(itemIcon(id), { x: r.x, y, w: CHAR_WELL, h: CHAR_WELL });
    const it = BUILD_ITEMS[id], tx0 = r.x + CHAR_WELL + 6;
    drawPixelTextShadow(ctx, it.name, tx0, y + 6, on ? '#ffffff' : '#cfe0ff', '#121418');
    if (it.passive) drawPixelTextShadow(ctx, ITEM_PASSIVES[it.passive].name, tx0, y + 16, '#9fd6a0', '#121418');
  }
  // the X: the one way out that is drawn (ESC and G also close)
  const hot = gh === 'x';
  ctx.fillStyle = hot ? '#9ca1aa' : '#3c4048';
  ctx.fillRect(L.xr.x, L.xr.y, L.xr.w, L.xr.h);
  ctx.fillStyle = '#191b1f';
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
