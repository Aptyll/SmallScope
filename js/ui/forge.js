'use strict';
// ------ the forge tab
// The merchant's counter has two faces, picked by the two tab plates in its
// sign row: the SHOP (js/ui/shop.js) and the FORGE, where ore from the rocks
// is dumped into a weapon (the rules: the forge banner, js/mining.js). The
// FORGE face swaps the stock, the market and the sell strip for one bench and
// keeps everything else - the awning, the purse, the restock road - so it
// reads as the same counter.
//
// The bench, left to right: the WEAPON well, a "+", the PILE well, an arrow,
// and the PREVIEW board - the level and the two numbers the pile moves, old
// against new - over the plate that forges it. Under the wells runs the
// weapon's FORGE BAR: its points toward the next level, and the pile's share
// lit on top of it. Under the bench, one ORE plate per kind: what one piece is
// worth, how many are in the pile and how many you carry.
//
// The pile is any ore, any amount, in any order - a dump, not a recipe. It
// fills by a DRAG of a stack onto the pile well or its kind's plate
// (dragDrop, js/ui/strip.js), a CLICK on an ore stack in the pack (sendBagCell),
// a click on a kind's plate (all of that kind in, or out again), or a click on
// the pile well itself (every ore you carry in, or the pile emptied). The
// weapon well fills the same ways and its own click steps through what you
// carry. Nothing leaves the pack for either: the weapon well holds a pointer
// to the cell and the pile only counts (state.forgePile, clamped to what you
// carry every frame), and the order spends straight out of the bag, so
// closing the counter loses nothing.
//
// The preview, the bar's numbers and the plates' counts are the panel
// carve-out of CLAUDE.md's UI rule: a dump is a sum, and no shape says x1.12 > x1.18.
const FORGE_INK = '#ff9a3c';   // the forge's own colour: a level reached, a forged number
const FORGE_INK_D = '#7a3a12';
const FORGE_GO = '#4f9c55', FORGE_GO_L = '#8fe08a';
const FORGE_SIGN = 'FORGE';
const FORGE_WELL = 54;         // the two wells, square
const FORGE_KIND_H = 40;       // one ore plate under the bench
const FORGE_ORES = ['ironstone', 'frostglass', 'sunstone']; // the plates' order: commonest first

// the anvil on the FORGE tab (the SHOP tab wears the coin)
const FORGE_ANVIL = SPRITES.forgeAnvil = bakeGrid([
  '.oooooooooo',
  'oLLLLLLLLLo',
  '.ooyyyyyyo.',
  '...oyyyyo..',
  '...oyyyyo..',
  '..oyyyyyyo.',
  '.oooooooooo',
], { '.': null, o: '#241a12', L: '#c4cad8', y: '#6c7486' }, 11);

// is this shopHit answer one of the bench's own
const FORGE_KINDS = new Set(['fWeapon', 'fOre', 'fGo', 'fKind']);
function forgeKind(h) { return !!h && FORGE_KINDS.has(h.kind); }
function forgeTabOpen() { return shopOpen() && state.shopTab === 'forge'; }

// ---- what is in the wells ----------------------------------------------
// The weapon well's pointer, found again every frame: by the cell itself
// (a tool is moved, never rebuilt, so the object is the weapon), and failing
// that by where it last was and what it is - a client's pack is rebuilt by
// every snapshot, and the body in that cell is still the one it chose.
function forgeFind() {
  const s = state.forgeSel, p = player;
  if (!s) return null;
  if (state.drag && state.drag.cell === s.cell) return { cell: s.cell, where: null, i: -1 }; // in hand right now
  const hit = (where, arr) => {
    for (let i = 0; arr && i < arr.length; i++) if (arr[i] === s.cell) { s.where = where; s.i = i; return true; }
    return false;
  };
  if (hit('tool', p.tools) || hit('bag', p.bag)) return { cell: s.cell, where: s.where, i: s.i };
  const c = forgeCell(p, s.where, s.i);
  if (c && c.type === s.type) { s.cell = c; return { cell: c, where: s.where, i: s.i }; }
  return null; // gone for now (sold, thrown, mid-snapshot): the well shows empty and keeps looking
}
// The pile, never more than you carry: a stack sold, thrown or spent by the
// last forge shrinks it here, so the preview and the order can never ask for
// ore that is not in the pack.
function forgePileNow() {
  const pile = state.forgePile || (state.forgePile = {});
  for (const k of FORGE_ORES) pile[k] = Math.max(0, Math.min(pile[k] || 0, bagCount(player, k)));
  return pile;
}
function pileCount(pile) { let n = 0; for (const k of FORGE_ORES) n += pile[k] || 0; return n; }
function forgeSelect(cell, where, i) {
  state.forgeSel = { cell, where, i, type: cell.type };
  SFX.place();
}
// ore onto the pile: `n` more of a kind, or every piece of it with n omitted
function forgeAdd(type, n) {
  const pile = forgePileNow(), have = bagCount(player, type);
  if (!have || pile[type] >= have) { SFX.deny(); return; }
  pile[type] = Math.min(have, pile[type] + (n === undefined ? have : n));
  SFX.place();
}
// Something put onto the bench - by a drop, by a click in the pack or on the
// shelf. `which` is the well it was aimed at, or null for "wherever it goes".
// Returns whether it was taken.
function forgePut(cell, where, i, which) {
  if (!cell) return false;
  if (toolIdOf(cell.type) && which !== 'fOre' && which !== 'fKind') { forgeSelect(cell, where, i); return true; }
  if (isOre(cell.type) && which !== 'fWeapon') { forgeAdd(cell.type, cell.n); return true; }
  SFX.deny();
  return which != null;
}
// every weapon this player carries, shelf first, in the order the weapon
// well's click steps through them
function forgeCarried() {
  const out = [], p = player;
  for (let i = 0; p.tools && i < p.tools.length; i++) if (p.tools[i]) out.push({ cell: p.tools[i], where: 'tool', i });
  for (let i = 0; i < p.bag.length; i++) if (p.bag[i] && toolIdOf(p.bag[i].type)) out.push({ cell: p.bag[i], where: 'bag', i });
  return out;
}

// ---- layout, hits and clicks -------------------------------------------
// The bench's geometry, off the counter's own (shopLayout): it stands in the
// room the stock, the market and the sell strip take on the SHOP face.
function forgeLayout(L) {
  const x = L.head.x, w = L.head.w, top = L.panel.y + SHOP_HEAD + 6;
  const by = top + 10, wy = by + 6;
  const weapon = { x: x + 12, y: wy, w: FORGE_WELL, h: FORGE_WELL };
  const ore = { x: weapon.x + FORGE_WELL + 22, y: wy, w: FORGE_WELL, h: FORGE_WELL };
  const px = ore.x + FORGE_WELL + 26;
  const view = { x: px, y: wy, w: x + w - 8 - px, h: FORGE_WELL - 22 };
  const go = { x: px, y: wy + FORGE_WELL - 18, w: view.w, h: 18 };
  const kinds = [], kw = Math.floor((w - 2 * 6) / 3), ky = by + FORGE_WELL + 38;
  for (let k = 0; k < FORGE_ORES.length; k++) kinds.push({ type: FORGE_ORES[k], x: x + k * (kw + 6), y: ky, w: kw, h: FORGE_KIND_H });
  return {
    head: { x, y: top, w, h: 8 },
    board: { x: x - 2, y: by, w: w + 4, h: FORGE_WELL + 28 },
    bar: { x: weapon.x, y: wy + FORGE_WELL + 7, w: x + w - 8 - weapon.x, h: 8 },
    weapon, ore, view, go, kinds,
    plus: { x: weapon.x + FORGE_WELL + 7, y: wy + (FORGE_WELL >> 1) - 4 },
    arrow: { x: ore.x + FORGE_WELL + 8, y: wy + (FORGE_WELL >> 1) - 4 },
  };
}
// the two tab plates, beside the portrait in the sign row
function forgeTabs(L) {
  const R = L.head;
  return [{ tab: 'shop', x: R.x + 18, y: R.y - 1, w: 17, h: 13 },
          { tab: 'forge', x: R.x + 37, y: R.y - 1, w: 17, h: 13 }];
}
// what the pointer is on, on the FORGE face - null for the bare slab
function forgeHit(L, mx, my) {
  const F = L.forge;
  if (hitR(F.weapon, mx, my)) return { kind: 'fWeapon' };
  if (hitR(F.ore, mx, my)) return { kind: 'fOre' };
  if (hitR(F.go, mx, my)) return { kind: 'fGo' };
  for (const k of F.kinds) if (hitR(k, mx, my)) return { kind: 'fKind', type: k.type };
  return null;
}
function forgeClick(h) {
  if (h.kind === 'tab') {
    if (state.shopTab !== h.tab) { state.shopTab = h.tab; SFX.place(); }
    return;
  }
  const f = forgeFind(), pile = forgePileNow();
  if (h.kind === 'fWeapon') {
    const all = forgeCarried();
    if (!all.length) { SFX.deny(); return; }
    const at = f ? all.findIndex((c) => c.cell === f.cell) : -1;
    const n = all[(at + 1) % all.length];
    forgeSelect(n.cell, n.where, n.i);
    return;
  }
  // the pile well: everything you carry in, or - with a pile on it - emptied
  if (h.kind === 'fOre') {
    if (pileCount(pile)) { for (const k of FORGE_ORES) pile[k] = 0; SFX.pickup(); return; }
    let any = false;
    for (const k of FORGE_ORES) { pile[k] = bagCount(player, k); if (pile[k]) any = true; }
    if (any) SFX.place(); else SFX.deny();
    return;
  }
  // a kind's plate: all of it in, or all of it out again
  if (h.kind === 'fKind') {
    if (pile[h.type] && pile[h.type] >= bagCount(player, h.type)) { pile[h.type] = 0; SFX.pickup(); }
    else forgeAdd(h.type);
    return;
  }
  if (h.kind === 'fGo') {
    const give = {};
    for (const k of FORGE_ORES) if (pile[k]) give[k] = pile[k];
    if (!f || !f.where || !forgeReady(player, f.cell, give)) { SFX.deny(); return; }
    SFX.unlock();
    player.input.cmd = { kind: 'shop', act: 'forge', where: f.where, i: f.i, pile: give };
    for (const k of FORGE_ORES) pile[k] = 0; // it is in the weapon now (or back in the pack if the order is refused)
  }
}
// a carried cell let go over the bench: it goes onto the well it was aimed
// at and then straight home, because the bench only points at the pack
function forgeDrop(h) {
  const d = state.drag;
  if (!d) return;
  if (h.kind === 'fWeapon' || h.kind === 'fOre' || h.kind === 'fKind') {
    const where = d.from.k === 'bag' ? 'bag' : d.from.k === 'slot' ? 'tool' : null;
    dragReturn();
    // back home it is findable: where it came from, or wherever dragReturn found room
    if (toolIdOf(d.cell.type)) {
      const f = forgeCarried().find((c) => c.cell === d.cell);
      if (f && h.kind === 'fWeapon') forgeSelect(f.cell, f.where, f.i);
      else SFX.deny();
    } else forgePut(d.cell, where, d.from.i, h.kind);
    return;
  }
  dragReturn();
}
function forgeReset() { state.forgeSel = null; state.forgePile = null; }

// ---- drawing -------------------------------------------------------------
function drawShopTabs(L, h) {
  for (const t of forgeTabs(L)) {
    const on = state.shopTab === t.tab, hot = !!h && h.kind === 'tab' && h.tab === t.tab;
    const y = t.y - (on ? 1 : 0);
    ctx.fillStyle = 'rgba(4,6,18,0.5)'; ctx.fillRect(t.x + 1, t.y + 1, t.w, t.h);
    ctx.fillStyle = on ? SHOP_WOOD_L : hot ? SHOP_WOOD : SHOP_WOOD_D;
    ctx.fillRect(t.x, y, t.w, t.h);
    ctx.fillStyle = on ? '#141c3c' : '#0b1030';
    ctx.fillRect(t.x + 1, y + 1, t.w - 2, t.h - 2);
    const im = t.tab === 'shop' ? SPRITES.itemGold : FORGE_ANVIL;
    ctx.globalAlpha = on || hot ? 1 : 0.45;
    ctx.drawImage(im, t.x + ((t.w - im.width) >> 1), y + ((t.h - im.height) >> 1));
    ctx.globalAlpha = 1;
    if (on) { ctx.fillStyle = t.tab === 'shop' ? RES_COLORS.gold : FORGE_INK; ctx.fillRect(t.x + 3, y + t.h - 2, t.w - 6, 1); }
  }
}

function drawForge(L, h, now) {
  const F = L.forge;
  const f = forgeFind(), cell = f && f.cell;
  const pile = forgePileNow(), add = pilePts(pile);
  const fp = toolFp(cell), lv = forgeLvlOf(fp), nfp = fp + add, nlv = forgeLvlOf(nfp);
  drawShopHeading(F.head, 'FORGE', true);
  const b = F.board;
  ctx.fillStyle = SHOP_BOARD; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#070a1e'; ctx.fillRect(b.x, b.y, b.w, 1); ctx.fillRect(b.x, b.y, 1, b.h);
  ctx.fillStyle = '#182148'; ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1); ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);

  // the well a drag in hand would be taken by lights up: a weapon's, or the pile's for any ore
  const dt = state.drag && state.drag.cell.type;
  const dragK = dt && (toolIdOf(dt) ? 'fWeapon' : isOre(dt) ? 'fOre' : null);

  // THE WEAPON WELL, in its tier's plate, the weapon at 4x
  forgeWell(F.weapon, cell && cell.type, !!h && h.kind === 'fWeapon', dragK === 'fWeapon', now);
  if (cell) drawItemIcon(cell.type, F.weapon, F.weapon.y, null, 4);
  else forgeGhost(F.weapon, SPRITES[ITEMS[(heldTool(player) || { type: toolType('shortbow') }).type].icon], 4);
  if (lv) forgeMark(F.weapon, F.weapon.y, lv);

  drawPixelTextShadow(ctx, '+', F.plus.x, F.plus.y, SHOP_LABEL, SHOP_BG, 2);

  // THE PILE WELL: each kind in it as a stacked icon with its count, the
  // richest on top; the ghost of a stone while it is empty
  forgeWell(F.ore, null, !!h && h.kind === 'fOre', dragK === 'fOre', now);
  const inPile = FORGE_ORES.filter((k) => pile[k]);
  if (!inPile.length) forgeGhost(F.ore, SPRITES[ITEMS.ironstone.icon], 5);
  for (let j = 0; j < inPile.length; j++) {
    const k = inPile[j], im = SPRITES[ITEMS[k].icon], sz = inPile.length === 1 ? 40 : 24;
    const ox = inPile.length === 1 ? 7 : [4, 26, 15][j], oy = inPile.length === 1 ? 7 : [4, 4, 26][j];
    ctx.drawImage(im, F.ore.x + ox, F.ore.y + oy, sz, sz);
    const n = String(pile[k]);
    drawPixelTextOutline(ctx, n, F.ore.x + ox + sz - pixelTextWidth(n), F.ore.y + oy + sz - 5, '#f4f7ff', '#0f1632');
  }

  // the arrow to the preview: lit once there is a weapon and a pile
  const give = {};
  for (const k of FORGE_ORES) if (pile[k]) give[k] = pile[k];
  const ready = !!f && !!f.where && forgeReady(player, cell, give);
  forgeArrow(F.arrow.x, F.arrow.y, ready ? FORGE_INK : '#35426e');

  // THE FORGE BAR: the points toward the next level in the forge's colour,
  // the pile's share lit green on top - wrapping round as often as the pile
  // would level the weapon, with the level it ends on at the far end
  const r = F.bar;
  ctx.fillStyle = '#070a1e'; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#141c3c'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  if (cell) {
    const iw = r.w - 2, cur = Math.round(iw * forgeBar(fp));
    if (nlv > lv) {
      // the pile levels it: the whole bar green to the new level's own fill
      ctx.fillStyle = FORGE_GO; ctx.fillRect(r.x + 1, r.y + 1, iw, r.h - 2);
      ctx.fillStyle = FORGE_GO_L; ctx.fillRect(r.x + 1, r.y + 1, Math.round(iw * forgeBar(nfp)), r.h - 2);
    } else {
      ctx.fillStyle = FORGE_INK; ctx.fillRect(r.x + 1, r.y + 1, cur, r.h - 2);
      if (add) { ctx.fillStyle = FORGE_GO_L; ctx.fillRect(r.x + 1 + cur, r.y + 1, Math.round(iw * forgeBar(nfp)) - cur, r.h - 2); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(r.x + 1, r.y + 1, iw, 1); // the bar's lit top edge
    const lt = '+' + lv, rt = '+' + (nlv + 1);
    const pts = (nfp - forgeCum(nlv)) + '/' + forgeNeed(nlv);
    drawPixelTextOutline(ctx, lt, r.x + 3, r.y + 2, lv ? FORGE_INK : '#c3d0ee', '#0f1632');
    drawPixelTextOutline(ctx, rt, r.x + r.w - 3 - pixelTextWidth(rt), r.y + 2, '#c3d0ee', '#0f1632');
    drawPixelTextOutline(ctx, pts, r.x + ((r.w - pixelTextWidth(pts)) >> 1), r.y + 2, '#f4f7ff', '#0f1632');
  }

  // THE PREVIEW: +N > +M, then the two numbers the pile moves
  const v = F.view;
  ctx.fillStyle = '#070a1e'; ctx.fillRect(v.x, v.y, v.w, v.h);
  ctx.fillStyle = '#141c3c'; ctx.fillRect(v.x + 1, v.y + 1, v.w - 2, v.h - 2);
  if (cell) {
    const T = TOOLS[toolIdOf(cell.type)];
    const up = T.up === 'rof'
      ? ['RATE', tipSec(T.rof * forgeRofAt(cell, lv) * TOOL_ROF_STEP), tipSec(T.rof * forgeRofAt(cell, nlv) * TOOL_ROF_STEP)]
      : ['TENSILE', String(forgeTensileAt(cell, lv)), String(forgeTensileAt(cell, nlv))];
    const rows = [['DAMAGE', 'X' + forgeDmgAt(lv).toFixed(2), 'X' + forgeDmgAt(nlv).toFixed(2)], up];
    for (let k = 0; k < rows.length; k++) {
      const [lab, a, c] = rows[k], y = v.y + 5 + k * 9;
      drawPixelText(ctx, lab, v.x + 4, y, SHOP_LABEL);
      if (nlv === lv) { drawPixelText(ctx, a, v.x + v.w - 4 - pixelTextWidth(a), y, lv ? FORGE_INK : '#c3d0ee'); continue; }
      const cw = pixelTextWidth(c);
      drawPixelText(ctx, c, v.x + v.w - 4 - cw, y, FORGE_GO_L);
      drawPixelText(ctx, '>', v.x + v.w - 10 - cw, y, '#5a6a99');
      drawPixelText(ctx, a, v.x + v.w - 14 - cw - pixelTextWidth(a), y, '#c3d0ee');
    }
    const lvT = nlv > lv ? '+' + lv + ' > +' + nlv : '+' + lv;
    drawPixelText(ctx, lvT, v.x + 4, v.y + v.h - 9, nlv > lv ? FORGE_GO_L : lv ? FORGE_INK : '#c3d0ee');
    const nm = T.name;
    drawPixelText(ctx, nm, v.x + v.w - 4 - pixelTextWidth(nm), v.y + v.h - 9, TOOL_TIERS[T.tier].ink);
  }

  // THE PLATE THAT FORGES IT: green and lifting on hover when it will take,
  // dark when it will not; it carries the points the pile is worth
  const g = F.go, hot = !!h && h.kind === 'fGo' && ready;
  const gy = g.y - (hot ? 1 : 0);
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(g.x + 2, g.y + 2, g.w, g.h);
  ctx.fillStyle = ready ? (hot ? FORGE_GO_L : '#2f6a38') : '#232c52';
  ctx.fillRect(g.x, gy, g.w, g.h);
  ctx.fillStyle = ready ? FORGE_GO : '#141c3c';
  ctx.fillRect(g.x + 1, gy + 1, g.w - 2, g.h - 2);
  const gt = '+' + add, gw = pixelTextWidth(gt) + 9, gx = g.x + ((g.w - gw) >> 1);
  const ink = ready ? '#f4f7ff' : '#5a6a99';
  forgeUpArrow(gx, gy + 6, ink);
  drawPixelText(ctx, gt, gx + 9, gy + 7, ink);

  // THE ORE PLATES: each kind, what a piece is worth, and in the pile / carried
  for (const s of F.kinds) {
    const k = s.type, have = bagCount(player, k), n = pile[k] || 0;
    const hotS = !!h && h.kind === 'fKind' && h.type === k, lift = hotS && have ? 1 : 0;
    const y = s.y - lift, K = ROCK_KINDS[ITEMS[k].ore];
    ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(s.x + 2, s.y + 2, s.w, s.h);
    ctx.fillStyle = n ? K.chip : hotS ? '#8fa0c8' : dragK === 'fOre' && dt === k ? FORGE_INK : '#232c52';
    ctx.fillRect(s.x, y, s.w, s.h);
    ctx.fillStyle = '#0f1632'; ctx.fillRect(s.x + 1, y + 1, s.w - 2, s.h - 2);
    ctx.globalAlpha = have ? 1 : 0.35;
    ctx.drawImage(SPRITES[ITEMS[k].icon], s.x + 6, y + 8, 24, 24);
    ctx.globalAlpha = 1;
    const worth = 'X' + FORGE_PTS[k];
    drawPixelText(ctx, worth, s.x + s.w - 5 - pixelTextWidth(worth), y + 6, FORGE_INK);
    const cnt = n + '/' + have;
    drawPixelText(ctx, cnt, s.x + s.w - 5 - pixelTextWidth(cnt), y + s.h - 11, n ? '#f4f7ff' : have ? '#c3d0ee' : '#5a6a99');
  }
}
// a well of the bench: the item's tier plate when one is in it, the empty
// well's lighter ground when not, and the rim lit while a drag of the kind
// it takes is in hand
function forgeWell(r, type, hot, wants, now, no) {
  const tp = type ? tierPlate(type, hot) : null;
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(r.x + 2, r.y + 2, r.w, r.h);
  ctx.fillStyle = no ? '#e0637a' : wants ? (Math.sin(now * 8) > 0 ? FORGE_INK : FORGE_INK_D) : type ? tp.rim : hot ? '#8fa0c8' : '#2c3560';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = type ? tp.plate : '#171f45';
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  if (type) tierShine(r, r.y, type, now);
}
function forgeGhost(r, im, k) {
  if (!im) return;
  ctx.globalAlpha = 0.18;
  ctx.drawImage(im, r.x + ((r.w - im.width * k) >> 1), r.y + ((r.h - im.height * k) >> 1), im.width * k, im.height * k);
  ctx.globalAlpha = 1;
}
function forgeArrow(x, y, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y + 3, 7, 2);
  for (let k = 0; k < 4; k++) ctx.fillRect(x + 7 + k, y + k, 1, 8 - k * 2);
}
function forgeUpArrow(x, y, col) {
  ctx.fillStyle = col;
  for (let k = 0; k < 3; k++) ctx.fillRect(x + 3 - k, y + k, 1 + k * 2, 1);
  ctx.fillRect(x + 2, y + 3, 3, 3);
}
// The level a weapon carries, wherever the weapon is drawn in a well - the
// shelf, the pack, the bench: "+N" in the forge's colour on the well's
// top-left corner, the corner the "!" (drawOverWarn) leaves free.
function forgeMark(r, y, lv) {
  if (!lv) return;
  drawPixelTextOutline(ctx, '+' + lv, r.x + 2, y + 2, FORGE_INK, '#0f1632');
}

// ---- tooltips ------------------------------------------------------------
function tipForge(h) {
  const f = forgeFind(), cell = f && f.cell, pile = forgePileNow();
  if (h.kind === 'fWeapon') {
    if (cell) { const d = tipTool(cell); d.notes.push(['CLICK FOR THE NEXT WEAPON', TIP_DIM]); return d; }
    return { title: 'WEAPON', tcol: TIP_DIM, kind: 'THE FORGE', rows: [], plate: BAG_WELL, rim: '#35426e',
      notes: [['DRAG A WEAPON HERE', TIP_DIM]] };
  }
  if (h.kind === 'fKind') {
    const k = h.type;
    const d = { title: ITEMS[k].name, tcol: ROCK_KINDS[ITEMS[k].ore].chip, kind: 'THE FORGE', rows: [], notes: [],
      icon: SPRITES[ITEMS[k].icon], plate: BAG_WELL, rim: '#35426e' };
    d.rows.push(['WORTH', FORGE_PTS[k] + (FORGE_PTS[k] === 1 ? ' POINT' : ' POINTS'), FORGE_INK]);
    d.rows.push(['IN THE PILE', String(pile[k] || 0), '#f4f7ff']);
    d.rows.push(['CARRIED', String(bagCount(player, k)), '#f4f7ff']);
    return d;
  }
  const add = pilePts(pile);
  const d = { title: 'THE PILE', tcol: FORGE_INK, kind: 'THE FORGE', rows: [], notes: [],
    icon: SPRITES[ITEMS.ironstone.icon], plate: BAG_WELL, rim: '#35426e' };
  for (const k of FORGE_ORES) if (pile[k]) d.rows.push([ITEMS[k].name, pile[k] + ' X ' + FORGE_PTS[k], '#f4f7ff']);
  d.rows.push(['POINTS', String(add), FORGE_INK]);
  if (cell) {
    const fp = toolFp(cell), lv = forgeLvlOf(fp), nlv = forgeLvlOf(fp + add);
    d.rows.push(['LEVEL', nlv > lv ? '+' + lv + ' > +' + nlv : '+' + lv, nlv > lv ? '#8fe08a' : '#f4f7ff']);
  }
  if (h.kind === 'fOre') d.notes.push([pileCount(pile) ? 'CLICK TO EMPTY IT' : 'CLICK TO DUMP ALL YOUR ORE', TIP_DIM]);
  return d;
}
