// ------------------------------------------------------------ saves screen
// The SAVES slab: one grid of slot cards - the five manual slots on top, the
// autosave ring under them - on the settings slab's frost (bakeFrostSlab,
// js/ui/panels.js), with the verb picked on its navbar. In a match it opens
// off the ESC panel's SAVES plank with both verbs, SAVE and LOAD; on the
// title it is a panel of the menu's own (LOAD GAME) with LOAD alone.
// A card is its match at a glance: the minimap where you stood, your class
// and level, the match clock, and how long ago it was kept. An empty manual
// card is a +. A press that would throw something away - writing over a kept
// slot, or loading over the match you are in - arms the card first (it
// glows gold and wears the verb's arrow), and a second press does it.
// The storage and the match itself are js/save.js.

const SV_CW = 56, SV_CH = 76, SV_GAP = 4; // one card, and the gutter between
const SV_ARM_T = 2.5;                      // s an armed card waits for its second press
const SV_STAMP_T = 0.6;                    // s of the white stamp on a card just written

const saveUi = {
  open: false,     // the slab is up over the ESC panel (in a match; the title uses menu.panel)
  tab: 'save',     // 'save' | 'load'
  row: 0, col: 0,  // the keys' pick: row -1 the navbar, 0 manual, 1 auto
  keyNav: false,   // the keys made the pick (it lights until the pointer moves)
  armed: null, armAt: 0, // the slot waiting on its second press, and when it was armed (s)
  stamp: null,     // { slot, at, ok } - the card a save just landed on
  hover: {},       // per hit id hover eases
  metas: null,     // the slots' metas, read once per opening (and after a write)
  imgs: new Map(), // thumbnail data URL -> Image
};
let savesPanelCv = null;
function savesNow() { return performance.now() / 1000; }

function savesTitle() { return state.mode === 'title'; }
// the slab is up and taking input
function savesUp() {
  if (savesTitle()) return state.menu.panel === 'saves';
  return state.mode === 'play' && state.settingsOpen && saveUi.open;
}
function savesMetas() { if (!saveUi.metas) saveUi.metas = saveList(); return saveUi.metas; }
function savesReset(tab) {
  saveUi.tab = tab; saveUi.row = 0; saveUi.col = 0; saveUi.keyNav = false;
  saveUi.armed = null; saveUi.stamp = null; saveUi.metas = null;
}
// in a match: the ESC panel's SAVES plank
function openSaves() { savesReset('save'); saveUi.open = true; SFX.place(); }
function closeSaves() { saveUi.open = false; saveUi.armed = null; SFX.pickup(); }
// on the title: LOAD GAME
function openSavesTitle() { savesReset('load'); openMenuPanel('saves'); }

function savesTabs() { return savesTitle() ? [{ id: 'load', label: 'LOAD' }] : [{ id: 'save', label: 'SAVE' }, { id: 'load', label: 'LOAD' }]; }

// the cards where they sit: row 0 the manual slots, row 1 the autosaves
// newest first, centred under them
function savesCards() {
  const m = savesMetas(), x0 = SET_X + Math.round((SET_W - (SV_CW * 5 + SV_GAP * 4)) / 2);
  const y0 = SET_Y + SET_CONTENT_Y + 2;
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

function savesLayout() {
  const tabs = savesTabs(), cw = Math.floor((SET_W - 24) / 2);
  const tx0 = SET_X + Math.round((SET_W - cw * tabs.length) / 2);
  return {
    tabs: tabs.map((t, i) => ({ id: t.id, label: t.label, x: tx0 + i * cw, y: SET_Y + SET_TAB_Y, w: cw, h: 9 })),
    cards: savesCards(),
    back: { id: 'back', x: SET_X + Math.round((SET_W - SET_PLANK_W) / 2), y: SET_Y + SET_FOOT_Y, w: SET_PLANK_W, h: SET_PLANK_H },
  };
}

// what is under the pointer: 'tab:<id>', 'card:<slot>', 'back' or null
function savesHit() {
  const mx = mouse.x, my = mouse.y, L = savesLayout();
  for (const t of L.tabs) if (t.id !== saveUi.tab && mx >= t.x && mx < t.x + t.w && my >= t.y - 3 && my < t.y + t.h + 3) return 'tab:' + t.id;
  for (const c of L.cards) if (savesLive(c) && mx >= c.x && mx < c.x + c.w && my >= c.y && my < c.y + c.h) return 'card:' + c.slot;
  const b = L.back;
  if (mx >= b.x - 2 && mx < b.x + b.w + 2 && my >= b.y - 3 && my < b.y + b.h + 3) return 'back';
  return null;
}

function savesBack() { if (savesTitle()) closeMenuPanel(); else closeSaves(); }
function savesTab(id) {
  if (id === saveUi.tab) return;
  saveUi.tab = id; saveUi.armed = null; SFX.pickup();
}
// the press on a card: the verb, or the arm before a verb that throws something away
function savesAct(c) {
  if (!c || !savesLive(c)) return;
  const now = savesNow();
  const risky = saveUi.tab === 'save' ? !!c.meta : !savesTitle();
  if (risky && !(saveUi.armed === c.slot && now - saveUi.armAt < SV_ARM_T)) {
    saveUi.armed = c.slot; saveUi.armAt = now; SFX.pickup();
    return;
  }
  saveUi.armed = null;
  if (saveUi.tab === 'load') { SFX.place(); loadSave(c.slot); return; }
  saveMatch(c.slot).then((ok) => {
    saveUi.metas = null;
    saveUi.stamp = { slot: c.slot, at: savesNow(), ok };
    if (ok) SFX.place(); else SFX.deny();
  });
}
function savesClick() {
  const h = savesHit();
  saveUi.keyNav = false;
  if (!h) { saveUi.armed = null; return; }
  if (h === 'back') { savesBack(); return; }
  if (h.startsWith('tab:')) { savesTab(h.slice(4)); return; }
  savesAct(savesLayout().cards.find((c) => c.slot === h.slice(5)));
}
// the arrows walk the cards (and up onto the navbar, where left and right
// turn the verb); enter or space is the press; escape is BACK. True when the
// key was the slab's.
function savesKey(k) {
  const d = moveDir(k), cards = savesLayout().cards;
  const rowLen = (r) => cards.filter((c) => c.row === r).length;
  if (k === 'escape' || k === 'backspace') { savesBack(); return true; }
  if (!d && k !== 'enter' && k !== ' ') return false;
  const u = saveUi;
  if (!u.keyNav) { u.keyNav = true; if (d) return true; } // the first key lights the pick where it stands
  if (d === 'up') u.row = Math.max(-1, u.row - 1);
  else if (d === 'down') u.row = Math.min(1, u.row + 1);
  else if (d === 'left' || d === 'right') {
    const s = d === 'left' ? -1 : 1;
    if (u.row < 0) { const t = savesTabs(), i = t.findIndex((x) => x.id === u.tab); savesTab(t[(i + s + t.length) % t.length].id); return true; }
    u.col += s;
  } else if (u.row >= 0) {
    savesAct(cards.find((c) => c.row === u.row && c.col === u.col));
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

function drawSaveCard(c, hv, now) {
  const live = savesLive(c), u = saveUi;
  const lift = live ? Math.round(hv * 2) : 0;
  const x = c.x, y = c.y - lift, w = c.w, h = c.h;
  const armed = u.armed === c.slot && now - u.armAt < SV_ARM_T;
  const picked = u.keyNav && u.row === c.row && u.col === c.col;
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; chamRect(x + 2, c.y + 2, w, h);
  ctx.fillStyle = armed || picked ? '#ffd95c' : '#0a0e23'; chamRect(x, y, w, h);
  ctx.fillStyle = !live ? '#10152e' : hv > 0.5 || armed ? '#1f2b5c' : '#141c3c'; chamRect(x + 1, y + 1, w - 2, h - 2);
  const a0 = ctx.globalAlpha;
  if (!live) ctx.globalAlpha = a0 * 0.45;
  const m = c.meta;
  if (m) {
    const tx = x + Math.round((w - SAVE_THUMB) / 2), ty = y + 5;
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(tx - 1, ty - 1, SAVE_THUMB + 2, SAVE_THUMB + 2);
    const im = savesImg(m.thumb);
    if (im) ctx.drawImage(im, tx, ty); else { ctx.fillStyle = '#1b2448'; ctx.fillRect(tx, ty, SAVE_THUMB, SAVE_THUMB); }
    if (m.auto) { ctx.fillStyle = '#0a0e23'; ctx.fillRect(tx, ty, 9, 9); drawAutoGlyph(tx + 1, ty + 1, '#8fb4ff'); }
    const ago = savesAgo(m.when), aw = pixelTextWidth(ago);
    ctx.fillStyle = 'rgba(10,14,35,0.85)'; ctx.fillRect(tx + SAVE_THUMB - aw - 3, ty + SAVE_THUMB - 9, aw + 3, 9);
    drawPixelText(ctx, ago, tx + SAVE_THUMB - aw - 1, ty + SAVE_THUMB - 8, '#cfe0ff');
    // the hero: class emblem and level; under it the match clock
    const lv = 'LV' + (m.level | 0), lw = 12 + 3 + pixelTextWidth(lv), lx = x + Math.round((w - lw) / 2);
    ctx.drawImage(classIcon12(m.cls | 0, false), lx, y + 49);
    drawPixelTextShadow(ctx, lv, lx + 15, y + 52, '#f4f7ff', 'rgba(8,12,28,0.9)');
    const ck = clockTxt(m.elapsed || 0);
    drawPixelTextShadow(ctx, ck, x + Math.round((w - pixelTextWidth(ck)) / 2), y + 64, '#ffd95c', 'rgba(8,12,28,0.9)');
    if (armed) {
      const p = 0.5 + 0.5 * Math.sin(now * 10);
      ctx.fillStyle = 'rgba(6,10,24,0.72)'; ctx.fillRect(tx, ty, SAVE_THUMB, SAVE_THUMB);
      ctx.globalAlpha = a0 * (0.7 + 0.3 * p);
      drawVerbArrow(tx + SAVE_THUMB / 2, ty + SAVE_THUMB / 2, u.tab === 'save', '#ffd95c');
      ctx.globalAlpha = a0;
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
  // the stamp: a card just written flashes white (red if storage refused it)
  const st = u.stamp;
  if (st && st.slot === c.slot && now - st.at < SV_STAMP_T) {
    ctx.globalAlpha = a0 * (1 - (now - st.at) / SV_STAMP_T) * 0.8;
    ctx.fillStyle = st.ok ? '#f4f7ff' : '#e0533a'; chamRect(x, y, w, h);
    ctx.globalAlpha = a0;
  }
}

// opts: { bare, slide } as renderSettings takes them
function renderSaves(ms, opts) {
  const slide = opts && opts.slide ? Math.round(opts.slide) : 0;
  if (!opts || !opts.bare) { ctx.fillStyle = 'rgba(6,10,24,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (!savesPanelCv) {
    savesPanelCv = document.createElement('canvas');
    savesPanelCv.width = SET_W; savesPanelCv.height = SET_H;
    bakeFrostSlab(savesPanelCv.getContext('2d'), SET_W, SET_H, 'SAVES');
  }
  const now = savesNow();
  if (slide) { ctx.save(); ctx.translate(0, slide); }
  ctx.drawImage(savesPanelCv, SET_X, SET_Y);
  const hit = slide ? null : savesHit();
  const L = savesLayout();
  if (mouse.inside && hit) saveUi.keyNav = false;
  for (const t of L.tabs) {
    const active = t.id === saveUi.tab;
    const col = active ? '#ffd95c' : hit === 'tab:' + t.id || (saveUi.keyNav && saveUi.row < 0) ? '#cfe0ff' : '#7a8bb8';
    drawPixelTextShadow(ctx, t.label, Math.round(t.x + (t.w - pixelTextWidth(t.label)) / 2), t.y, col, 'rgba(8,12,28,0.9)');
    if (active) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(t.x + 4, t.y + 8, t.w - 8, 1); }
  }
  ctx.fillStyle = '#2c3a68';
  ctx.fillRect(SET_X + 10, SET_Y + SET_CONTENT_Y - 3, SET_W - 20, 1);
  for (const c of L.cards) {
    const id = 'card:' + c.slot;
    const want = hit === id || (saveUi.keyNav && saveUi.row === c.row && saveUi.col === c.col) ? 1 : 0;
    const hv = saveUi.hover[id] = (saveUi.hover[id] || 0) + (want - (saveUi.hover[id] || 0)) * 0.35;
    drawSaveCard(c, hv, now);
  }
  drawMenuButton(L.back, 'BACK', hit === 'back' ? 1 : 0, ms, false, false);
  if (slide) ctx.restore();
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
