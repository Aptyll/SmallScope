'use strict';
// ------ the forge tab
// The merchant's counter has two faces, picked by the two tab plates in its
// sign row: the SHOP (js/ui/shop.js) and the FORGE, where ore from the rocks
// (js/mining.js) takes a weapon up a level. The FORGE face swaps the stock,
// the market and the sell strip for one bench and keeps everything else - the
// awning, the purse, the restock road - so it reads as the same counter.
//
// The bench, left to right: the WEAPON well, a "+", the ORE well, an arrow,
// and the PREVIEW board - the level and the two numbers the next one moves,
// old against new - over the plate that forges it. Under the bench is the
// LADDER, the five levels as plates, each with the ore it costs, lit up to
// the level the weapon in the well has reached - the whole price list in one
// row, so which ore to go and mine is read off the bench.
//
// Both wells are filled the same three ways: DRAG a weapon or an ore from the
// pack or the shelf onto one (dragDrop, js/ui/strip.js), CLICK a weapon or an
// ore in the pack while this face is up (sendBagCell / sendSlot), or click the
// well itself - the weapon well steps through what you carry, the ore well
// takes the ore the next level needs. Nothing leaves the pack for it: a well
// holds a pointer to the cell (the weapon) or a kind (the ore), and the
// forging order spends straight out of the bag, so a weapon in the well can
// still be worn and closing the counter loses nothing. The ore well takes only
// the ore the next level costs - anything else is refused where it is dropped.
//
// The preview board and the ladder are the panel carve-out of CLAUDE.md's UI
// rule: an upgrade is a comparison of numbers, and no shape says x1.12 > x1.18.
const FORGE_INK = '#ff9a3c';   // the forge's own colour: a level reached, a forged number
const FORGE_INK_D = '#7a3a12';
const FORGE_GO = '#4f9c55', FORGE_GO_L = '#8fe08a';
const FORGE_SIGN = 'FORGE';
const FORGE_WELL = 54;         // the two wells, square
const FORGE_PIP_W = 6, FORGE_PIP_GAP = 2;
const FORGE_STEP_H = 40;       // one plate of the ladder

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
const FORGE_KINDS = new Set(['fWeapon', 'fOre', 'fGo', 'fStep']);
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
// ...and the ore well: a kind, and only while it is still the kind the next
// level costs - a level forged, or a different weapon put in, empties it
function forgeOreIn(cell) {
  const c = cell && forgeCost(cell);
  if (state.forgeOre && (!c || c.item !== state.forgeOre)) state.forgeOre = null;
  return state.forgeOre;
}
function forgeSelect(cell, where, i) {
  state.forgeSel = { cell, where, i, type: cell.type };
  forgeOreIn(cell);
  SFX.place();
}
// Something put into a well - by a drop, by a click in the pack or on the
// shelf. `which` is the well it was aimed at, or null for "wherever it goes".
// Returns whether it was taken.
function forgePut(cell, where, i, which) {
  if (!cell) return false;
  if (toolIdOf(cell.type) && which !== 'fOre') { forgeSelect(cell, where, i); return true; }
  if (isOre(cell.type) && which !== 'fWeapon') {
    const f = forgeFind(), c = f && forgeCost(f.cell);
    if (!c || c.item !== cell.type) { forgeRefuse(); return true; } // the ladder shows which one
    state.forgeOre = cell.type;
    SFX.place();
    return true;
  }
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
  const by = top + 10, wy = by + 8;
  const weapon = { x: x + 12, y: wy, w: FORGE_WELL, h: FORGE_WELL };
  const ore = { x: weapon.x + FORGE_WELL + 22, y: wy, w: FORGE_WELL, h: FORGE_WELL };
  const px = ore.x + FORGE_WELL + 26;
  const view = { x: px, y: wy, w: x + w - 8 - px, h: FORGE_WELL - 22 };
  const go = { x: px, y: wy + FORGE_WELL - 18, w: view.w, h: 18 };
  const steps = [], sw = Math.floor((w - 4 * 5) / 5), sy = by + FORGE_WELL + 38;
  for (let k = 0; k < FORGE_MAX; k++) steps.push({ x: x + k * (sw + 5), y: sy, w: sw, h: FORGE_STEP_H });
  return {
    head: { x, y: top, w, h: 8 },
    board: { x: x - 2, y: by, w: w + 4, h: FORGE_WELL + 30 },
    weapon, ore, view, go, steps,
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
  for (let k = 0; k < F.steps.length; k++) if (hitR(F.steps[k], mx, my)) return { kind: 'fStep', lvl: k + 1 };
  return null;
}
function forgeClick(h) {
  if (h.kind === 'tab') {
    if (state.shopTab !== h.tab) { state.shopTab = h.tab; SFX.place(); }
    return;
  }
  const f = forgeFind();
  if (h.kind === 'fWeapon') {
    const all = forgeCarried();
    if (!all.length) { SFX.deny(); return; }
    const at = f ? all.findIndex((c) => c.cell === f.cell) : -1;
    const n = all[(at + 1) % all.length];
    forgeSelect(n.cell, n.where, n.i);
    return;
  }
  if (h.kind === 'fOre') {
    const c = f && forgeCost(f.cell);
    if (!c || !bagCount(player, c.item)) { forgeRefuse(); return; }
    state.forgeOre = c.item;
    SFX.place();
    return;
  }
  if (h.kind === 'fGo') {
    if (!f || !f.where || !forgeOreIn(f.cell) || !forgeReady(player, f.cell)) { SFX.deny(); return; }
    SFX.unlock();
    player.input.cmd = { kind: 'shop', act: 'forge', where: f.where, i: f.i };
  }
}
// a carried cell let go over the bench: it goes into the well it was aimed
// at and then straight home, because a well only points at what is in the pack
function forgeDrop(h) {
  const d = state.drag;
  if (!d) return;
  if (h.kind === 'fWeapon' || h.kind === 'fOre') {
    const where = d.from.k === 'bag' ? 'bag' : d.from.k === 'slot' ? 'tool' : null;
    dragReturn();
    // back home it is findable: where it came from, or wherever dragReturn found room
    if (toolIdOf(d.cell.type)) {
      const f = forgeCarried().find((c) => c.cell === d.cell);
      if (f) forgeSelect(f.cell, f.where, f.i);
    } else forgePut(d.cell, where, d.from.i, h.kind);
    return;
  }
  dragReturn();
}
function forgeReset() { state.forgeSel = null; state.forgeOre = null; }
// the ore well refusing: a buzz, and the well and the ladder's next plate
// flash red for FORGE_NO s, so the ore it wanted is pointed at
const FORGE_NO = 0.5;
function forgeRefuse() { SFX.deny(); state.forgeNoT = performance.now() / 1000 + FORGE_NO; }
function forgeNo(now) { return state.forgeNoT > now; }

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
  const lv = toolLvl(cell), cost = cell && forgeCost(cell), ore = forgeOreIn(cell);
  drawShopHeading(F.head, 'FORGE', true);
  const b = F.board;
  ctx.fillStyle = SHOP_BOARD; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#070a1e'; ctx.fillRect(b.x, b.y, b.w, 1); ctx.fillRect(b.x, b.y, 1, b.h);
  ctx.fillStyle = '#182148'; ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1); ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);

  // THE WEAPON WELL, in its tier's plate, the weapon at 3x, the five level
  // pips under it
  // the well a drag in hand would be taken by lights up: any weapon, and the
  // ore the next level costs
  const dt = state.drag && state.drag.cell.type;
  const dragK = dt && (toolIdOf(dt) ? 'fWeapon' : cost && dt === cost.item ? 'fOre' : null);
  forgeWell(F.weapon, cell && cell.type, !!h && h.kind === 'fWeapon', dragK === 'fWeapon', now);
  if (cell) drawItemIcon(cell.type, F.weapon, F.weapon.y, null, 4);
  else forgeGhost(F.weapon, SPRITES[ITEMS[(heldTool(player) || { type: toolType('shortbow') }).type].icon], 4);
  const pw = FORGE_MAX * FORGE_PIP_W + (FORGE_MAX - 1) * FORGE_PIP_GAP;
  const px0 = F.weapon.x + ((FORGE_WELL - pw) >> 1), py = F.weapon.y + FORGE_WELL + 4;
  for (let k = 0; k < FORGE_MAX; k++) {
    const x = px0 + k * (FORGE_PIP_W + FORGE_PIP_GAP);
    const next = !!cost && k === lv;
    ctx.fillStyle = '#070a1e'; ctx.fillRect(x, py, FORGE_PIP_W, 3);
    ctx.fillStyle = k < lv ? FORGE_INK : next && Math.sin(now * 6) > 0 ? FORGE_INK_D : '#232c52';
    ctx.fillRect(x + 1, py + 1, FORGE_PIP_W - 2, 1);
  }
  if (lv) forgeMark(F.weapon, F.weapon.y, lv);

  drawPixelTextShadow(ctx, '+', F.plus.x, F.plus.y, SHOP_LABEL, SHOP_BG, 2);

  // THE ORE WELL: the ore the next level costs, ghosted until one is put in,
  // with have / need under it
  const oreIcon = cost && SPRITES[ITEMS[cost.item].icon];
  const no = forgeNo(now);
  forgeWell(F.ore, ore, !!h && h.kind === 'fOre', dragK === 'fOre', now, no);
  if (ore) drawItemIcon(ore, F.ore, F.ore.y, null, 5);
  else if (oreIcon) forgeGhost(F.ore, oreIcon, 5);
  if (cost) {
    const have = bagCount(player, cost.item), txt = have + '/' + cost.n;
    drawPixelTextShadow(ctx, txt, F.ore.x + ((FORGE_WELL - pixelTextWidth(txt)) >> 1), F.ore.y + FORGE_WELL + 3,
      have >= cost.n ? '#f4f7ff' : '#e0637a', SHOP_BG);
  }

  // the arrow to the preview: lit once both wells are ready
  const ready = !!f && !!f.where && !!ore && forgeReady(player, cell);
  forgeArrow(F.arrow.x, F.arrow.y, ready ? FORGE_INK : '#35426e');

  // THE PREVIEW: +N > +N+1, then the two numbers it moves
  const v = F.view;
  ctx.fillStyle = '#070a1e'; ctx.fillRect(v.x, v.y, v.w, v.h);
  ctx.fillStyle = '#141c3c'; ctx.fillRect(v.x + 1, v.y + 1, v.w - 2, v.h - 2);
  if (cell) {
    const T = TOOLS[toolIdOf(cell.type)];
    const nx = cost ? Object.assign({}, cell, { lvl: lv + 1 }) : cell;
    const up = T.up === 'rof'
      ? ['RATE', tipSec(T.rof * toolRofMul(cell) * TOOL_ROF_STEP), tipSec(T.rof * toolRofMul(nx) * TOOL_ROF_STEP)]
      : ['TENSILE', String(toolTensile(cell)), String(toolTensile(nx))];
    const rows = [['DAMAGE', 'X' + toolDmgMul(cell).toFixed(2), 'X' + toolDmgMul(nx).toFixed(2)], up];
    for (let k = 0; k < rows.length; k++) {
      const [lab, a, c] = rows[k], y = v.y + 5 + k * 9;
      drawPixelText(ctx, lab, v.x + 4, y, SHOP_LABEL);
      if (!cost) { drawPixelText(ctx, a, v.x + v.w - 4 - pixelTextWidth(a), y, FORGE_INK); continue; }
      const cw = pixelTextWidth(c);
      drawPixelText(ctx, c, v.x + v.w - 4 - cw, y, FORGE_GO_L);
      drawPixelText(ctx, '>', v.x + v.w - 10 - cw, y, '#5a6a99');
      drawPixelText(ctx, a, v.x + v.w - 14 - cw - pixelTextWidth(a), y, '#c3d0ee');
    }
    const lvT = cost ? '+' + lv + ' > +' + (lv + 1) : '+' + lv;
    drawPixelText(ctx, lvT, v.x + 4, v.y + v.h - 9, cost ? '#c3d0ee' : FORGE_INK);
    const nm = T.name;
    drawPixelText(ctx, nm, v.x + v.w - 4 - pixelTextWidth(nm), v.y + v.h - 9, TOOL_TIERS[T.tier].ink);
  }

  // THE PLATE THAT FORGES IT: green and lifting on hover when it will take,
  // dark when it will not, gilded and still at the top
  const g = F.go, hot = !!h && h.kind === 'fGo' && ready;
  const gy = g.y - (hot ? 1 : 0), top = !!cell && !cost;
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(g.x + 2, g.y + 2, g.w, g.h);
  ctx.fillStyle = top ? FORGE_INK : ready ? (hot ? FORGE_GO_L : '#2f6a38') : '#232c52';
  ctx.fillRect(g.x, gy, g.w, g.h);
  ctx.fillStyle = top ? '#3a1d08' : ready ? FORGE_GO : '#141c3c';
  ctx.fillRect(g.x + 1, gy + 1, g.w - 2, g.h - 2);
  const gt = top ? 'MAX' : '+' + (lv + 1);
  const gw = pixelTextWidth(gt) + (top ? 0 : 9), gx = g.x + ((g.w - gw) >> 1);
  const ink = top ? FORGE_INK : ready ? '#f4f7ff' : '#5a6a99';
  if (!top) forgeUpArrow(gx, gy + 6, ink);
  drawPixelText(ctx, gt, gx + (top ? 0 : 9), gy + 7, ink);

  // THE LADDER: every level, the ore it costs, lit up to the level reached
  for (let k = 0; k < F.steps.length; k++) {
    const s = F.steps[k], c = FORGE_COST[k + 1];
    const done = !!cell && k < lv, next = !!cost && k === lv;
    const hotS = !!h && h.kind === 'fStep' && h.lvl === k + 1;
    const pulse = next && no && Math.sin(now * 20) > 0;
    ctx.fillStyle = pulse ? '#e0637a' : done ? FORGE_INK : next ? '#8fa0c8' : hotS ? '#5a6a99' : '#232c52';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = done ? '#3a1d08' : '#0f1632';
    ctx.fillRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
    drawPixelText(ctx, '+' + (k + 1), s.x + 4, s.y + 4, done ? FORGE_INK : next ? '#f4f7ff' : '#5a6a99');
    const im = SPRITES[ITEMS[c.item].icon];
    ctx.globalAlpha = done || next || !cell ? 1 : 0.5;
    ctx.drawImage(im, s.x + 4, s.y + s.h - 28, 24, 24);
    ctx.globalAlpha = 1;
    const n = 'X' + c.n;
    drawPixelText(ctx, n, s.x + s.w - 5 - pixelTextWidth(n), s.y + s.h - 11, done ? FORGE_INK : '#c3d0ee');
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
  const f = forgeFind(), cell = f && f.cell;
  if (h.kind === 'fWeapon') {
    if (cell) { const d = tipTool(cell); d.notes.push(['CLICK FOR THE NEXT WEAPON', TIP_DIM]); return d; }
    return { title: 'WEAPON', tcol: TIP_DIM, kind: 'THE FORGE', rows: [], plate: BAG_WELL, rim: '#35426e',
      notes: [['DRAG A WEAPON HERE', TIP_DIM]] };
  }
  const stepTip = (lvl) => {
    const c = FORGE_COST[lvl];
    const d = { title: '+' + lvl, tcol: FORGE_INK, kind: 'THE FORGE', rows: [], notes: [],
      icon: SPRITES[ITEMS[c.item].icon], plate: BAG_WELL, rim: '#35426e' };
    const have = bagCount(player, c.item);
    d.rows.push(['COSTS', c.n + ' ' + ITEMS[c.item].name, '#f4f7ff']);
    d.rows.push(['CARRIED', String(have), have >= c.n ? '#8fe08a' : '#e0637a']);
    d.rows.push(['DAMAGE', 'X' + (1 + FORGE_DMG * lvl).toFixed(2), FORGE_INK]);
    return d;
  };
  if (h.kind === 'fStep') return stepTip(h.lvl);
  const cost = cell && forgeCost(cell);
  if (!cost) return null;
  if (h.kind === 'fOre') {
    const d = stepTip(toolLvl(cell) + 1);
    d.title = ITEMS[cost.item].name;
    return d;
  }
  if (h.kind === 'fGo') return stepTip(toolLvl(cell) + 1);
  return null;
}
