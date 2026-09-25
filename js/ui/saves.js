// ------------------------------------------------------------ saves screen
// The SAVES grid: one grid of slot cards - the five manual slots on top, the
// autosave ring under them. It stands in two places. In a match it opens off
// the ESC panel's SAVES plank on the settings slab's frost (bakeFrostSlab,
// js/ui/panels.js) with both verbs, SAVE and LOAD, on its navbar. In the solo
// lobby it is a pop-up off the SAVES plate at the top (js/ui/menu.js) with
// LOAD alone, the newest card lit when it opens: the way back into a match.
// A card is its match at a glance: the minimap where you stood with the
// match clock and how long ago it was kept on it, the save's name, your
// class and level. An empty manual card is a +. A press that would throw
// something away - writing over a kept slot, or loading over the match you
// are in - arms the card first (it glows gold and wears the verb's arrow),
// and a second press does it.
// Every kept card also carries its own three handles, whatever the verb: the
// X in its corner deletes it (armed red first, then gone), its name is typed
// over in place (the pencil beside it), and the card itself can be carried
// onto another manual slot - the two trade places, or an autosave dropped on
// an empty one is kept there for good. The keys reach the same: Delete, F2,
// and Shift with Left or Right; a pad's X is Delete and its pointer carries.
// The storage and the match itself are js/save.js.

const SV_CW = 56, SV_CH = 76, SV_GAP = 4; // one card, and the gutter between
const SV_ARM_T = 2.5;                      // s an armed card waits for its second press
const SV_STAMP_T = 0.6;                    // s of the white stamp on a card just written or moved
const SV_NAME_MAX = 10;                    // a name's letters: what a card's width holds
const SV_DRAG_PX = 4;                      // px the pointer travels on a pressed kept card before it is carried
const SV_POP_PAD = 12;                     // the lobby pop-up's margin round the grid

const saveUi = {
  open: false,     // the grid is up over the ESC panel (in a match; the lobby uses menu.screen)
  tab: 'save',     // 'save' | 'load'
  row: 0, col: 0,  // the keys' pick: row -1 the navbar, 0 manual, 1 auto
  keyNav: false,   // the keys made the pick (it lights until the pointer moves)
  armed: null, armAt: 0, armDel: false, // the slot waiting on its second press, when (s), and whether the press deletes
  stamp: null,     // { slot, at, ok } - the card a save or a move just landed on
  hover: {},       // per hit id hover eases
  metas: null,     // the slots' metas, read once per opening (and after a write)
  imgs: new Map(), // thumbnail data URL -> Image
  press: null,     // { slot, x, y, drag } - the card under the pointer between its press and release
  edit: null,      // { slot, buf, sel } - a name being typed (sel: the whole name is selected)
  mx: 0, my: 0,    // the pointer where the last frame saw it
};
let savesPanelCv = null;
function savesNow() { return performance.now() / 1000; }

function savesInLobby() { return state.mode === 'title'; }
// the grid is up and taking input
function savesUp() {
  if (savesInLobby()) return state.menu.screen === 'saves';
  return state.mode === 'play' && state.settingsOpen && saveUi.open;
}
function savesMetas() { if (!saveUi.metas) saveUi.metas = saveList(); return saveUi.metas; }
function savesReset(tab) {
  const u = saveUi;
  u.tab = tab; u.row = 0; u.col = 0; u.keyNav = false;
  u.armed = null; u.armDel = false; u.stamp = null; u.metas = null; u.press = null; u.edit = null;
}
// in a match: the ESC panel's SAVES plank
function openSaves() { savesReset('save'); saveUi.open = true; SFX.place(); }
function closeSaves() { savesEditEnd(true); saveUi.open = false; saveUi.armed = null; saveUi.press = null; SFX.pickup(); }
// in the lobby: the SAVES plate. The newest card comes up lit, so the one
// you were last playing is a press of Enter (or a click) away.
function beginSavesPick() {
  if (NET.role !== 'solo' || !saveNewest()) return;
  savesReset('load');
  const c = savesCards().find((k) => k.slot === saveNewest());
  if (c) { saveUi.row = c.row; saveUi.col = c.col; saveUi.keyNav = true; }
  openPop('saves');
}

function savesTabs() { return savesInLobby() ? [] : [{ id: 'save', label: 'SAVE' }, { id: 'load', label: 'LOAD' }]; }

// where the grid stands: in the lobby a pop-up slab of its own, centred, with
// an X; in a match the settings slab's content window
function savesFrame() {
  const gw = SV_CW * 5 + SV_GAP * 4, gh = SV_CH * 2 + SV_GAP;
  if (savesInLobby()) {
    const pw = gw + SV_POP_PAD * 2, ph = gh + 16 + SV_POP_PAD;
    const px = Math.round((VIEW_W - pw) / 2), py = Math.round((VIEW_H - ph) / 2);
    return { x0: px + SV_POP_PAD, y0: py + 16, panel: { x: px, y: py, w: pw, h: ph }, xr: { x: px + pw - 14, y: py + 4, w: 10, h: 10 } };
  }
  return { x0: SET_X + Math.round((SET_W - gw) / 2), y0: SET_Y + SET_CONTENT_Y + 2, panel: null, xr: null };
}
// the cards where they sit: row 0 the manual slots, row 1 the autosaves
// newest first, centred under them
function savesCards() {
  const m = savesMetas(), { x0, y0 } = savesFrame();
  const cards = [];
  for (let i = 0; i < SAVE_MANUAL; i++) {
    const slot = 'm' + i;
    cards.push({ slot, row: 0, col: i, meta: m[slot] || null, x: x0 + i * (SV_CW + SV_GAP), y: y0, w: SV_CW, h: SV_CH });
  }
  const autos = [];
  for (let i = 0; i < SAVE_AUTO; i++) autos.push({ slot: 'a' + i, meta: m['a' + i] || null });
  autos.sort((a, b) => (b.meta ? b.meta.when : -1) - (a.meta ? a.meta.when : -1));
  const ax = x0 + Math.round((SV_CW * 5 + SV_GAP * 4 - (SV_CW * SAVE_AUTO + SV_GAP * (SAVE_AUTO - 1))) / 2);
  autos.forEach((a, i) => cards.push({ slot: a.slot, row: 1, col: i, meta: a.meta,
    x: ax + i * (SV_CW + SV_GAP), y: y0 + SV_CH + SV_GAP, w: SV_CW, h: SV_CH }));
  return cards;
}
// a card the open verb can act on: SAVE writes the manual slots, LOAD reads a kept one
function savesLive(c) { return saveUi.tab === 'save' ? c.row === 0 : !!c.meta; }
// a kept card's handles: the X in its top-right corner, and its name's strip
function svDelRect(c) { return { x: c.x + c.w - 8, y: c.y + 1, w: 7, h: 7 }; }
function svNameRect(c) { return { x: c.x + 2, y: c.y + 46, w: c.w - 4, h: 10 }; }

function savesLayout() {
  const tabs = savesTabs(), F = savesFrame(), cw = Math.floor((SET_W - 24) / 2);
  const tx0 = SET_X + Math.round((SET_W - cw * tabs.length) / 2);
  return {
    tabs: tabs.map((t, i) => ({ id: t.id, label: t.label, x: tx0 + i * cw, y: SET_Y + SET_TAB_Y, w: cw, h: 9 })),
    cards: savesCards(),
    back: F.panel ? null : { id: 'back', x: SET_X + Math.round((SET_W - SET_PLANK_W) / 2), y: SET_Y + SET_FOOT_Y, w: SET_PLANK_W, h: SET_PLANK_H },
    panel: F.panel, xr: F.xr,
  };
}

// what is under the pointer: 'tab:<id>', 'del:<slot>', 'name:<slot>',
// 'card:<slot>', 'back', and in the lobby 'x', 'panel' (the slab swallows the
// press) or null (off the slab: a press there closes it)
function savesHit() {
  const mx = mouse.x, my = mouse.y, L = savesLayout();
  const inR = (r, px, py) => mx >= r.x - px && mx < r.x + r.w + px && my >= r.y - py && my < r.y + r.h + py;
  for (const t of L.tabs) if (t.id !== saveUi.tab && inR(t, 0, 3)) return 'tab:' + t.id;
  for (const c of L.cards) {
    if (!inR(c, 0, 0)) continue;
    if (c.meta && inR(svDelRect(c), 1, 1)) return 'del:' + c.slot;
    if (c.meta && inR(svNameRect(c), 0, 0)) return 'name:' + c.slot;
    if (c.meta || savesLive(c)) return 'card:' + c.slot;
    break;
  }
  if (L.back && inR(L.back, 2, 3)) return 'back';
  if (L.panel) return popFrameHit(L.panel, L.xr);
  return null;
}
function savesCardAt(x, y) { return savesLayout().cards.find((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) || null; }

function savesBack() { savesEditEnd(true); saveUi.press = null; if (savesInLobby()) leavePop(); else closeSaves(); }
function savesTab(id) {
  if (id === saveUi.tab) return;
  saveUi.tab = id; saveUi.armed = null; SFX.pickup();
}
// the press on a card: the verb, or the arm before a verb that throws something away
function savesAct(c) {
  if (!c || !savesLive(c)) return;
  const now = savesNow(), u = saveUi;
  const risky = u.tab === 'save' ? !!c.meta : !savesInLobby();
  if (risky && !(u.armed === c.slot && !u.armDel && now - u.armAt < SV_ARM_T)) {
    u.armed = c.slot; u.armDel = false; u.armAt = now; SFX.pickup();
    return;
  }
  u.armed = null;
  if (u.tab === 'load') { SFX.place(); loadSave(c.slot); return; }
  saveMatch(c.slot).then((ok) => {
    u.metas = null;
    u.stamp = { slot: c.slot, at: savesNow(), ok };
    if (ok) SFX.place(); else SFX.deny();
  });
}
// the X: the first press arms the card red, the second deletes it
function savesDelete(slot) {
  const u = saveUi, now = savesNow();
  if (!savesMetas()[slot]) return;
  if (!(u.armed === slot && u.armDel && now - u.armAt < SV_ARM_T)) {
    u.armed = slot; u.armDel = true; u.armAt = now; SFX.pickup();
    return;
  }
  u.armed = null; u.armDel = false;
  PROFILE.dropSave(slot);
  u.metas = null;
  SFX.iceKnock();
}
// Where a carried card may go: two manual slots trade places (either may be
// empty), and an autosave carried onto an EMPTY manual slot is kept there and
// stops being one. The ring keeps the order it was written in, so nothing is
// dropped onto it, and a kept save never falls into it.
function savesCanMove(from, to) {
  const m = savesMetas();
  if (from === to || !m[from] || to[0] !== 'm') return false;
  return from[0] === 'm' || !m[to];
}
function savesMove(from, to) {
  const u = saveUi;
  if (!savesCanMove(from, to) || !PROFILE.swapSaves(from, to)) { SFX.deny(); return false; }
  const m = PROFILE.saveMetas()[to];
  if (m && m.auto) { m.auto = false; PROFILE.putSaveMeta(to, m); }
  u.metas = null; u.armed = null;
  u.stamp = { slot: to, at: savesNow(), ok: true };
  SFX.place();
  return true;
}

// ---- a name, typed over in place ------------------------------------------
function savesEditStart(slot) {
  const m = savesMetas()[slot];
  if (!m) return;
  saveUi.edit = { slot, buf: saveTitleOf(m).slice(0, SV_NAME_MAX), sel: true }; // selected: the first letter typed replaces it
  saveUi.armed = null;
  SFX.pickup();
}
// keep: write what was typed (an emptied name falls back to the day), or drop it
function savesEditEnd(keep) {
  const e = saveUi.edit;
  saveUi.edit = null;
  if (!e || !keep) return;
  const m = PROFILE.saveMetas()[e.slot];
  if (!m) return;
  const t = e.buf.trim();
  if (t) { m.title = t; m.named = true; } else { delete m.title; m.named = false; }
  PROFILE.putSaveMeta(e.slot, m);
  saveUi.metas = null;
  SFX.place();
}
// The name owns the keyboard while it is typed (keyPress, input.js, the
// create screen's own grammar): letters, digits and single spaces, Backspace,
// Enter keeps it and Escape drops it. A letter it will not hold is never drawn.
function savesEditKey(e) {
  const u = saveUi.edit, k = e.key;
  if (k === 'Enter') { savesEditEnd(true); return; }
  if (k === 'Escape') { savesEditEnd(false); SFX.pickup(); return; }
  if (k === 'Backspace') { if (u.buf) { u.buf = u.sel ? '' : u.buf.slice(0, -1); u.sel = false; SFX.tally(); } return; }
  const ch = String(e.char != null ? e.char : k).toUpperCase();
  if (ch.length !== 1 || !/^[A-Z0-9 ]$/.test(ch)) return;
  if (u.sel) { u.buf = ''; u.sel = false; }
  if (u.buf.length >= SV_NAME_MAX || (ch === ' ' && (!u.buf || u.buf.endsWith(' ')))) { SFX.iceKnock(); return; }
  u.buf += ch;
  SFX.tally();
}

// ---- the pointer: a press picks a card up, the release is the click or the drop
function savesClick() {
  const h = savesHit(), u = saveUi;
  u.keyNav = false;
  if (u.edit && h !== 'name:' + u.edit.slot) savesEditEnd(true);
  if (!h || h === 'panel') { u.armed = null; if (!h && savesInLobby()) savesBack(); return; }
  if (h === 'back' || h === 'x') { savesBack(); return; }
  if (h.startsWith('tab:')) { savesTab(h.slice(4)); return; }
  const slot = h.slice(h.indexOf(':') + 1);
  if (h.startsWith('del:')) { savesDelete(slot); return; }
  if (h.startsWith('name:')) { if (!u.edit) savesEditStart(slot); return; }
  u.press = { slot, x: mouse.x, y: mouse.y, drag: false };
}
// the frame's half: a pressed kept card the pointer has moved off is carried
function savesDragTick() {
  const p = saveUi.press;
  if (!p || p.drag) return;
  if (Math.abs(mouse.x - p.x) + Math.abs(mouse.y - p.y) < SV_DRAG_PX || !savesMetas()[p.slot]) return;
  p.drag = true; saveUi.armed = null;
  SFX.pickup();
}
// pointerRelease (input.js): a carried card lands where the pointer is, a
// card that never travelled was a click
function savesRelease() {
  const p = saveUi.press;
  saveUi.press = null;
  if (!p || !savesUp()) return;
  if (p.drag) {
    const to = savesCardAt(mouse.x, mouse.y);
    if (to && to.slot !== p.slot) savesMove(p.slot, to.slot); else SFX.pickup();
    return;
  }
  const c = savesLayout().cards.find((k) => k.slot === p.slot);
  if (c && savesCardAt(mouse.x, mouse.y) === null) return; // slid off the card and let go: nothing
  savesAct(c);
}
function savesCarrying() { return !!(saveUi.press && saveUi.press.drag); }

// The arrows walk the cards (and, in a match, up onto the navbar, where left
// and right turn the verb); enter or space is the press; escape is BACK.
// Delete is the X, F2 the name, and Shift with Left or Right carries a
// manual card one slot along. True when the key was the grid's.
function savesKey(k) {
  const d = moveDir(k), u = saveUi, cards = savesLayout().cards;
  const rowLen = (r) => cards.filter((c) => c.row === r).length;
  const picked = () => (u.row >= 0 ? cards.find((c) => c.row === u.row && c.col === u.col) : null);
  if (k === 'escape' || k === 'backspace') { savesBack(); return true; }
  if (k === 'delete' || k === 'f2') { // the picked card, or the one under the pointer (a pad's X over the lobby's pointer)
    const c = u.keyNav ? picked() : mouse.inside ? savesCardAt(mouse.x, mouse.y) : null;
    if (!c || !c.meta) { u.keyNav = true; return true; }
    if (k === 'delete') savesDelete(c.slot); else savesEditStart(c.slot);
    return true;
  }
  if (!d && k !== 'enter' && k !== ' ') return false;
  if (!u.keyNav) { u.keyNav = true; if (d) return true; } // the first key lights the pick where it stands
  const minRow = savesTabs().length ? -1 : 0;
  if ((d === 'left' || d === 'right') && keys.shift && u.row === 0) {
    const c = picked(), to = u.col + (d === 'left' ? -1 : 1);
    if (!c || !c.meta || to < 0 || to >= rowLen(0)) { SFX.deny(); return true; }
    if (savesMove(c.slot, 'm' + to)) u.col = to;
    return true;
  }
  if (d === 'up') u.row = Math.max(minRow, u.row - 1);
  else if (d === 'down') u.row = Math.min(1, u.row + 1);
  else if (d === 'left' || d === 'right') {
    const s = d === 'left' ? -1 : 1;
    if (u.row < 0) { const t = savesTabs(), i = t.findIndex((x) => x.id === u.tab); savesTab(t[(i + s + t.length) % t.length].id); return true; }
    u.col += s;
  } else if (u.row >= 0) {
    savesAct(picked());
    return true;
  }
  if (u.row >= 0) u.col = Math.max(0, Math.min(rowLen(u.row) - 1, u.col));
  SFX.pickup();
  return true;
}

// how long ago, in the one unit that says it: NOW, 12M, 5H, 3D
function savesAgo(when) {
  const s = Math.max(0, (Date.now() - when) / 1000);
  if (s < 60) return 'NOW';
  if (s < 3600) return Math.floor(s / 60) + 'M';
  if (s < 86400) return Math.floor(s / 3600) + 'H';
  return Math.floor(s / 86400) + 'D';
}
function savesImg(url) {
  if (!url) return null;
  let im = saveUi.imgs.get(url);
  if (!im) { im = new Image(); im.src = url; saveUi.imgs.set(url, im); }
  return im.complete && im.naturalWidth ? im : null;
}

// a slot's picture (saveMeta, js/save.js): the whole minimap at SAVE_THUMB
// px square, a gold pip where you stood
function saveThumb() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = SAVE_THUMB;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(mmCv, 0, 0, WORLD, WORLD, 0, 0, SAVE_THUMB, SAVE_THUMB);
    const k = SAVE_THUMB / (WORLD * TILE);
    x.fillStyle = '#000';
    x.fillRect(Math.round(player.x * k) - 2, Math.round(player.y * k) - 2, 4, 4);
    x.fillStyle = '#ffd84a';
    x.fillRect(Math.round(player.x * k) - 1, Math.round(player.y * k) - 1, 2, 2);
    return c.toDataURL('image/png');
  } catch (e) { return null; }
}
// the autosave's mark: two arrows chasing round, 7x7
function drawAutoGlyph(x, y, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x + 2, y, 3, 1); ctx.fillRect(x + 5, y + 1, 1, 1); ctx.fillRect(x + 6, y + 2, 1, 2); ctx.fillRect(x + 4, y + 2, 2, 1);
  ctx.fillRect(x + 2, y + 6, 3, 1); ctx.fillRect(x + 1, y + 5, 1, 1); ctx.fillRect(x, y + 3, 1, 2); ctx.fillRect(x + 1, y + 4, 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x + 5, y + 5, 1, 1);
}
// the verb's arrow over an armed card: down into the slot for SAVE, out to
// the right (play) for LOAD
function drawVerbArrow(cx, cy, save, col) {
  ctx.fillStyle = col;
  if (save) {
    ctx.fillRect(cx - 1, cy - 7, 3, 8);
    for (let i = 0; i < 5; i++) ctx.fillRect(cx - 4 + i, cy + i - 1, 9 - i * 2, 1);
    ctx.fillRect(cx - 6, cy + 6, 13, 2);
  } else {
    for (let i = 0; i < 7; i++) ctx.fillRect(cx - 4, cy - 6 + i, 1 + i, 1);
    for (let i = 0; i < 6; i++) ctx.fillRect(cx - 4, cy + 1 + i, 6 - i, 1);
  }
}
// an X, n px square, t px thick: the card's delete handle and its armed mark
function drawSaveX(x, y, n, t, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) { ctx.fillRect(x + i, y + i, t, 1); ctx.fillRect(x + n - t - i, y + i, t, 1); }
}
// the pencil beside a name under the pointer, 6x6, point down-left
function drawSavePencil(x, y, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 1 + i, y + 4 - i, 2, 1);
  ctx.fillRect(x + 5, y, 1, 1);
  ctx.fillRect(x, y + 5, 1, 1);
}
// a label on a dark strip over the thumbnail's corner
function drawThumbBadge(txt, x, y, right, col) {
  const w = pixelTextWidth(txt), bx = right ? x - w - 3 : x;
  ctx.fillStyle = 'rgba(10,14,35,0.85)'; ctx.fillRect(bx, y, w + 3, 9);
  drawPixelText(ctx, txt, bx + 2 - (right ? 0 : 1), y + 1, col);
}

// One card. `at` draws it somewhere other than its slot: the card in the hand.
function drawSaveCard(c, hv, now, hit, at) {
  const u = saveUi, m = c.meta, live = savesLive(c);
  const lift = at ? 0 : Math.round(hv * 2);
  const x = at ? at.x : c.x, y = (at ? at.y : c.y) - lift, w = c.w, h = c.h;
  const armed = u.armed === c.slot && now - u.armAt < SV_ARM_T;
  const del = armed && u.armDel;
  const picked = u.keyNav && u.row === c.row && u.col === c.col;
  const shade = at ? 4 : 2;
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; chamRect(x + shade, (at ? y : c.y) + shade, w, h);
  ctx.fillStyle = del ? '#e0533a' : armed || picked || at ? '#ffd95c' : '#0a0e23'; chamRect(x, y, w, h);
  ctx.fillStyle = del ? '#2a1224' : !live && !m ? '#10152e' : hv > 0.5 || armed || at ? '#1f2b5c' : '#141c3c'; chamRect(x + 1, y + 1, w - 2, h - 2);
  const a0 = ctx.globalAlpha;
  if (!live && !at) ctx.globalAlpha = a0 * (m && hv > 0.5 ? 0.8 : 0.45); // off the verb: dim, but a kept card still answers its handles
  const aCard = ctx.globalAlpha;
  if (m) {
    const tx = x + Math.round((w - SAVE_THUMB) / 2), ty = y + 5;
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(tx - 1, ty - 1, SAVE_THUMB + 2, SAVE_THUMB + 2);
    const im = savesImg(m.thumb);
    if (im) ctx.drawImage(im, tx, ty); else { ctx.fillStyle = '#1b2448'; ctx.fillRect(tx, ty, SAVE_THUMB, SAVE_THUMB); }
    if (m.auto) { ctx.fillStyle = '#0a0e23'; ctx.fillRect(tx, ty, 9, 9); drawAutoGlyph(tx + 1, ty + 1, '#8fb4ff'); }
    // on the picture's foot: the match clock left, how long ago right
    drawThumbBadge(clockTxt(m.elapsed || 0), tx, ty + SAVE_THUMB - 9, false, '#ffd95c');
    drawThumbBadge(savesAgo(m.when), tx + SAVE_THUMB, ty + SAVE_THUMB - 9, true, '#cfe0ff');
    // the name: typed over in place, or the pencil beside it under the pointer
    const nr = svNameRect(c), ny = y + (nr.y - c.y) + 2;
    const ed = u.edit && u.edit.slot === c.slot ? u.edit : null;
    if (ed) {
      const tw = pixelTextWidth(ed.buf), nx = x + Math.round((w - tw) / 2);
      ctx.fillStyle = '#0a0e23'; ctx.fillRect(x + 2, ny - 2, w - 4, 11);
      ctx.fillStyle = '#ffd95c'; ctx.fillRect(x + 3, ny + 8, w - 6, 1);
      if (ed.sel && ed.buf) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(nx - 1, ny - 1, tw + 2, 9); }
      drawPixelText(ctx, ed.buf, nx, ny, ed.sel && ed.buf ? '#0a0e23' : '#f4f7ff');
      if (!ed.sel && Math.floor(now * 2) % 2 === 0) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(nx + tw + 1, ny, 1, 7); }
    } else {
      const nm = saveTitleOf(m), hot = hit === 'name:' + c.slot;
      drawPixelTextShadow(ctx, nm, x + Math.round((w - pixelTextWidth(nm)) / 2), ny, hot ? '#ffd95c' : '#f4f7ff', 'rgba(8,12,28,0.9)');
      if (hot) drawSavePencil(x + w - 8, ny, '#ffd95c');
    }
    // the hero: class emblem and level
    const lv = 'LV' + (m.level | 0), lw = 12 + 3 + pixelTextWidth(lv), lx = x + Math.round((w - lw) / 2);
    ctx.drawImage(classIcon12(m.cls | 0, false), lx, y + 59);
    drawPixelTextShadow(ctx, lv, lx + 15, y + 62, '#cfe0ff', 'rgba(8,12,28,0.9)');
    if (armed) {
      const p = 0.5 + 0.5 * Math.sin(now * 10);
      ctx.fillStyle = del ? 'rgba(40,8,14,0.72)' : 'rgba(6,10,24,0.72)'; ctx.fillRect(tx, ty, SAVE_THUMB, SAVE_THUMB);
      ctx.globalAlpha = aCard * (0.7 + 0.3 * p);
      if (del) drawSaveX(tx + SAVE_THUMB / 2 - 7, ty + SAVE_THUMB / 2 - 7, 15, 3, '#e0533a');
      else drawVerbArrow(tx + SAVE_THUMB / 2, ty + SAVE_THUMB / 2, u.tab === 'save', '#ffd95c');
      ctx.globalAlpha = aCard;
    }
    // the X in the corner: out while the card is under the hand, picked, or armed to go
    if (!at && (hv > 0.5 || picked || del)) {
      const r = svDelRect(c), hot = hit === 'del:' + c.slot || del;
      ctx.globalAlpha = a0;
      ctx.fillStyle = hot ? '#e0533a' : '#0a0e23'; ctx.fillRect(r.x, r.y - lift, r.w, r.h);
      drawSaveX(r.x + 1, r.y + 1 - lift, 5, 1, hot ? '#f4f7ff' : '#8fa8d0');
    }
  } else if (c.row === 0 && u.tab === 'save') {
    // an empty manual slot: a + that warms under the pointer (SAVE writes it at once)
    const cx = x + Math.round(w / 2), cy = y + Math.round(h / 2);
    ctx.fillStyle = live && hv > 0.5 ? '#ffd95c' : '#4a5480';
    ctx.fillRect(cx - 6, cy - 1, 13, 3); ctx.fillRect(cx - 1, cy - 6, 3, 13);
  } else if (c.row === 1) {
    drawAutoGlyph(x + Math.round(w / 2) - 3, y + Math.round(h / 2) - 3, '#2c3a68');
  }
  ctx.globalAlpha = a0;
  // the stamp: a card just written or moved flashes white (red if storage refused it)
  const st = u.stamp;
  if (!at && st && st.slot === c.slot && now - st.at < SV_STAMP_T) {
    ctx.globalAlpha = a0 * (1 - (now - st.at) / SV_STAMP_T) * 0.8;
    ctx.fillStyle = st.ok ? '#f4f7ff' : '#e0533a'; chamRect(x, y, w, h);
    ctx.globalAlpha = a0;
  }
}

// opts: { bare, slide } as renderSettings takes them in a match; { pop } (the
// pop-up's ease, 0..1) in the lobby
function renderSaves(ms, opts) {
  opts = opts || {};
  savesDragTick();
  const L = savesLayout(), u = saveUi, now = savesNow();
  let dy = 0, still = true;
  if (L.panel) {
    const a = opts.pop == null ? 1 : opts.pop;
    dy = Math.round((1 - a) * 12);
    ctx.globalAlpha = a;
    drawPopSlab(L.panel, dy);
    still = state.menu.popT >= 1;
  } else {
    dy = opts.slide ? Math.round(opts.slide) : 0;
    if (!opts.bare) { ctx.fillStyle = 'rgba(6,10,24,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (!savesPanelCv) {
      savesPanelCv = document.createElement('canvas');
      savesPanelCv.width = SET_W; savesPanelCv.height = SET_H;
      bakeFrostSlab(savesPanelCv.getContext('2d'), SET_W, SET_H, 'SAVES');
    }
    ctx.drawImage(savesPanelCv, SET_X, SET_Y + dy);
    still = !dy;
  }
  ctx.save(); ctx.translate(0, dy);
  const hit = still && mouse.inside ? savesHit() : null;
  if (hit && hit !== 'panel' && (mouse.x !== u.mx || mouse.y !== u.my)) u.keyNav = false; // the hand takes the pick back by moving, not by resting
  u.mx = mouse.x; u.my = mouse.y;
  for (const t of L.tabs) {
    const active = t.id === u.tab;
    const col = active ? '#ffd95c' : hit === 'tab:' + t.id || (u.keyNav && u.row < 0) ? '#cfe0ff' : '#7a8bb8';
    drawPixelTextShadow(ctx, t.label, Math.round(t.x + (t.w - pixelTextWidth(t.label)) / 2), t.y, col, 'rgba(8,12,28,0.9)');
    if (active) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(t.x + 4, t.y + 8, t.w - 8, 1); }
  }
  if (L.tabs.length) { ctx.fillStyle = '#2c3a68'; ctx.fillRect(SET_X + 10, SET_Y + SET_CONTENT_Y - 3, SET_W - 20, 1); }
  const carry = savesCarrying() ? u.press.slot : null;
  const over = carry ? savesCardAt(mouse.x, mouse.y) : null;
  let held = null;
  for (const c of L.cards) {
    if (c.slot === carry) { held = c; ctx.fillStyle = '#0a0e23'; chamRect(c.x, c.y, c.w, c.h); continue; } // the gap it left
    const hid = hit ? hit.slice(hit.indexOf(':') + 1) : null;
    const want = !carry && (hid === c.slot || (u.keyNav && u.row === c.row && u.col === c.col)) ? 1 : 0;
    const hv = u.hover[c.slot] = (u.hover[c.slot] || 0) + (want - (u.hover[c.slot] || 0)) * 0.35;
    drawSaveCard(c, hv, now, carry ? null : hit, null);
    if (over === c && carry) { // where it would land: gold where it may, red where it may not
      ctx.fillStyle = savesCanMove(carry, c.slot) ? '#ffd95c' : '#e0533a';
      ctx.fillRect(c.x - 2, c.y - 2, c.w + 4, 1); ctx.fillRect(c.x - 2, c.y + c.h + 1, c.w + 4, 1);
      ctx.fillRect(c.x - 2, c.y - 2, 1, c.h + 4); ctx.fillRect(c.x + c.w + 1, c.y - 2, 1, c.h + 4);
    }
  }
  if (L.back) drawMenuButton(L.back, 'BACK', hit === 'back' ? 1 : 0, ms, false, false);
  if (L.xr) drawPopX(L.xr, 0, hit === 'x');
  if (held) drawSaveCard(held, 1, now, null, { x: Math.round(mouse.x - (u.press.x - held.x)), y: Math.round(mouse.y - (u.press.y - held.y)) - 3 });
  ctx.restore();
  ctx.globalAlpha = 1;
}

// The lobby's SAVES plate (drawLobbyTop, js/ui/menu.js): the newest save's
// picture on a little fanned stack of cards, the way into the saves pop-up.
// Under the hand the picture darkens behind a play arrow: this picks it up.
function drawSavesPlate(r, lift) {
  const slot = saveNewest(), m = slot ? savesMetas()[slot] : null;
  const y = r.y - lift, f = { x: r.x, y: y + 6, w: r.w - 6, h: r.h - 6 }; // the front card; two more behind it, up and right
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(r.x + 2, r.y + 8, f.w, f.h);
  for (let k = 2; k >= 0; k--) {
    const bx = f.x + k * 3, by = f.y - k * 3;
    ctx.fillStyle = lift ? (k ? '#5f6f9a' : '#8fa0c8') : (k ? '#232c52' : '#2c3560'); ctx.fillRect(bx, by, f.w, f.h);
    ctx.fillStyle = k ? '#141c3c' : '#0f1632'; ctx.fillRect(bx + 1, by + 1, f.w - 2, f.h - 2);
  }
  if (!m) return;
  const tx = f.x + Math.round((f.w - SAVE_THUMB) / 2), ty = f.y + Math.round((f.h - SAVE_THUMB) / 2);
  const im = savesImg(m.thumb);
  if (im) ctx.drawImage(im, tx, ty); else { ctx.fillStyle = '#1b2448'; ctx.fillRect(tx, ty, SAVE_THUMB, SAVE_THUMB); }
  if (lift) {
    ctx.fillStyle = 'rgba(6,10,24,0.6)'; ctx.fillRect(tx, ty, SAVE_THUMB, SAVE_THUMB);
    drawVerbArrow(tx + SAVE_THUMB / 2, ty + SAVE_THUMB / 2, false, '#ffd95c');
  } else drawThumbBadge(clockTxt(m.elapsed || 0), tx, ty + SAVE_THUMB - 9, false, '#ffd95c');
}

// the HUD's mark that a save just landed (an autosave above all, which
// nobody asked for): the slot's down-arrow, gold, beside the match clock
// under the minimap - it pops in and fades over SAVE_FLASH_T
function drawSaveFlash() {
  if (state.mode === 'title' || window.DBG.hideUI) return;
  const t = (performance.now() - saveFlashAt) / 1000;
  if (t < 0 || t > SAVE_FLASH_T) return;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = Math.min(1, t / 0.12) * Math.min(1, (SAVE_FLASH_T - t) / 0.5);
  const cx = Math.round(MM_CX - pixelTextWidth(clockTxt(state.elapsed)) / 2 - 10), cy = MM_CY + MM_R + 11;
  const pop = t < 0.2 ? Math.round((0.2 - t) * 10) : 0;
  ctx.fillStyle = '#0f1632'; ctx.fillRect(cx - 7, cy - 8 - pop, 15, 17);
  drawVerbArrow(cx, cy - pop, true, '#ffd95c');
  ctx.globalAlpha = a0;
}
