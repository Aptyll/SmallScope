'use strict';
// ------------------------------------------------------------ profile
// The PROFILE (menu.screen 'profile'): who a player is between matches, laid
// out like League's client profile with op.gg's match list inside it. A
// column down the left holds the picture, the name and three numbers; tabs
// across the top open OVERVIEW, MATCH HISTORY, RANKED and STATS; a search
// field top-right finds the people this screen has met. The pixels of the
// tabs' bodies are js/ui/profile-tabs.js; the records they print,
// js/app/history.js; the store, js/app/profile.js (nothing here touches
// localStorage).
//
// It shows YOUR profile or, with pfWho set, someone else's from the card
// they sent when you sat in a party together (peopleNote): their column, their
// overview and their last matches. Only yours can be changed: a press on the
// picture opens the picker (a hero's face), a press on the name its field.
//
// The name field keeps the old card's grammar: a click selects the name (the
// next letter replaces it), typing edits it, Enter keeps it, Escape drops an
// edit the store refuses. A refused Enter rattles the field and floods it red.
// Text is names, numbers, the tabs and the column heads (show, don't label).

// ---- layout -------------------------------------------------------------
const PF_TABS = ['OVERVIEW', 'MATCH HISTORY', 'RANKED', 'STATS'];
const PF_BAR_H = 22;          // the tab bar across the top
const PF_COL_W = 108;         // the left column
const PF_PIC = 64;            // the picture in the column
const PF_SEARCH_W = 100;
const PF_ROW_H = 50;          // a match row (op.gg's header line and body)
const PF_ROW_GAP = 2;
const PF_SUM_H = 44;          // the summary over the match list
const PF_LIST_H = 34;         // a STATS or RANKED row
const PF_SCROLL = 18;         // px one wheel notch moves a list
const PF_PICK_N = 32, PF_PICK_GAP = 4, PF_PICK_COLS = 10; // the picker's faces
const NAME_SHAKE_T = 0.3;     // the name field's refusal: it rattles and flushes red
const overRect = (r, px, py) => mouse.x >= r.x - (px || 0) && mouse.x < r.x + r.w + (px || 0) && mouse.y >= r.y - (py || 0) && mouse.y < r.y + r.h + (py || 0);

// whose profile is open: yours, or a card out of PROFILE.people
function pfCard() {
  const m = state.menu;
  if (!m.pfWho) return null;
  return PROFILE.people().find((c) => c.pid === m.pfWho) || null;
}
function pfBody() {
  const L = { x: PF_COL_W + 16, y: PF_BAR_H + 8 };
  L.w = VIEW_W - L.x - 8; L.h = VIEW_H - L.y - 8;
  return L;
}
function profileLayout() {
  const m = state.menu;
  const col = { x: 8, y: PF_BAR_H + 8, w: PF_COL_W, h: VIEW_H - PF_BAR_H - 16 };
  const pic = { x: col.x + (col.w >> 1) - (PF_PIC >> 1), y: col.y + 16, w: PF_PIC, h: PF_PIC };
  const field = { x: col.x + 6, y: pic.y + PF_PIC + 8, w: col.w - 12, h: 20 };
  const tabs = [];
  let tx = PF_COL_W + 16;
  for (let i = 0; i < PF_TABS.length; i++) {
    const w = pixelTextWidth(PF_TABS[i]);
    tabs.push({ x: tx, y: 8, w, h: 9, i });
    tx += w + 16;
  }
  const search = { x: VIEW_W - PF_SEARCH_W - 8, y: 5, w: PF_SEARCH_W, h: 13 };
  return { col, pic, field, tabs, search, body: pfBody(), tab: m.pfTab };
}

// ---- the name tag on the title --------------------------------------------
function profileTagRect() {
  return { x: 6, y: VIEW_H - 14, w: 10 + 4 + pixelTextWidth(PROFILE.name()) + 4 + 6, h: 10 };
}
function overProfileTag() { return overRect(profileTagRect(), 3, 3); }
// the picture's face small, the name and its quill: gold under the hand
function drawProfileTag() {
  const hot = !state.menu.panel && overProfileTag();
  const r = profileTagRect(), nm = PROFILE.name();
  pfFace(profilePic(), r.x, r.y, 10, 1, true);
  if (hot) { ctx.fillStyle = '#c89a3c'; pfRim(r.x - 1, r.y - 1, 12, 12); }
  drawPixelTextShadow(ctx, nm, r.x + 14, r.y + 3, hot ? '#ffd95c' : '#9fb6d8', 'rgba(15,22,50,0.9)');
  stampGrid(PC_QUILL, hot ? PC_QUILL_HOT : PC_QUILL_PAL, r.x + 14 + pixelTextWidth(nm) + 4, r.y + 3, 1);
}

// ---- in and out -----------------------------------------------------------
// Open from the title (the name tag), from the party screen (a seat's face,
// back to 'room' on the way out) or OVER A MATCH that has ended (an end
// screen's row or the post-game's face: menu.pfOver, the match running on
// under it, its own ease and keys - nothing of the match's screens moves).
function beginProfile(who, back) {
  const m = state.menu;
  m.pfBack = back || 'menu';
  m.screen = 'profile';
  pfReset(who);
}
function beginProfileOver(who) {
  state.menu.pfOver = true;
  pfReset(who);
}
function pfReset(who) {
  const m = state.menu;
  m.pfWho = who || null;
  m.pfTab = 0; m.pfScroll = 0; m.pfOpen = ''; m.pfMode = ''; m.pfPick = false; m.pfSearch = null;
  m.nameBuf = PROFILE.name();
  m.nameSel = false; m.nameEdit = false; m.nameShake = 0;
  SFX.place();
}
// out to where it was opened from, keeping the buffer when the store takes it (an unchanged name is a no-op)
function leaveProfile() {
  const m = state.menu;
  pfNameKeep();
  if (m.pfOver) m.pfOver = false;
  else m.screen = m.pfBack || 'menu';
  SFX.pickup();
}
// whether the profile has the keys and the pointer: on the title, or over an ended match
function profileUp() {
  const m = state.menu;
  return state.mode === 'title' ? m.screen === 'profile' : state.mode === 'dead' && m.pfOver;
}
// over a match: the ease the title's update gives it there (from sim.js's dead branch)
function updateProfileOver(dt) {
  const m = state.menu;
  m.charT = Math.max(0, Math.min(1, m.charT + (m.pfOver ? 1 : -1) * dt / 0.35));
  if (m.pfOver) updateProfile(dt);
}
// a seat's profile, when this screen holds it: yours, or the card the seat's person sent
function seatPid(id) {
  if (player && id === player.id) return PROFILE.pid();
  const c = NET.cards[id];
  return c && PROFILE.people().some((q) => q.pid === c.pid) ? c.pid : null;
}
// open seat `id`'s profile from wherever the screen is; false when there is none to open
function openSeatProfile(id, back) {
  const pid = seatPid(id);
  if (!pid) return false;
  const who = pid === PROFILE.pid() ? null : pid;
  if (state.mode === 'dead') beginProfileOver(who); else beginProfile(who, back);
  return true;
}
function pfNameKeep() {
  const m = state.menu;
  if (!m.nameEdit) return;
  const r = PROFILE.setName(m.nameBuf);
  if (r.ok) player.name = r.name; // the title's body wears it at once
  else m.nameBuf = PROFILE.name();
  m.nameEdit = false; m.nameSel = false;
}
// Enter on the field: the name is kept - or the field refuses it
function profileCommit() {
  const m = state.menu;
  if (!PROFILE.validate(m.nameBuf).ok) { m.nameShake = NAME_SHAKE_T; SFX.iceKnock(); return; }
  SFX.unlock();
  pfNameKeep();
}
function pfSetTab(i) {
  const m = state.menu;
  if (m.pfTab === i) return;
  m.pfTab = i; m.pfScroll = 0; m.pfOpen = '';
  SFX.pickup();
}
// open someone's profile (a pid out of PROFILE.people), or yours with null
function pfOpenWho(pid) {
  const m = state.menu;
  pfNameKeep();
  m.pfWho = pid && pid !== PROFILE.pid() ? pid : null;
  m.pfTab = 0; m.pfScroll = 0; m.pfOpen = ''; m.pfPick = false; m.pfSearch = null;
  SFX.place();
}

// ---- what the pointer is on -----------------------------------------------
// { kind, i } or null: 'tab', 'name', 'pic', 'search', 'found' (a search
// result), 'pick' (a face in the picker), 'mode' (a filter word), 'row' (a
// match row, i its id), 'seat' (a name in an open match, i a pid), 'person'
// (a RANKED or played-with row, i a pid), 'back' (to your own profile)
function profileHit() {
  const m = state.menu, L = profileLayout();
  if (m.pfPick) {
    for (const c of pfPickCells()) if (overRect(c)) return { kind: 'pick', i: c.i };
    return overRect(pfPickRect()) ? { kind: 'slab' } : { kind: 'off' };
  }
  if (m.pfSearch !== null) for (const f of pfFound(L)) if (overRect(f)) return { kind: 'found', i: f.pid };
  for (const t of L.tabs) if (overRect(t, 6, 6)) return { kind: 'tab', i: t.i };
  if (overRect(L.search, 1, 1)) return { kind: 'search' };
  if (!m.pfWho && overRect(L.pic, 1, 1)) return { kind: 'pic' };
  if (!m.pfWho && overRect(L.field, 2, 2)) return { kind: 'name' };
  if (m.pfWho && overRect(pfBackRect(L), 2, 2)) return { kind: 'back' };
  for (const p of pfMateRects(L)) if (overRect(p)) return { kind: 'person', i: p.pid };
  return profileTabHit(L);
}
// a press: each hit does its one thing; a press anywhere else drops the
// search and keeps a name being typed
function profileClick() {
  const m = state.menu;
  if (m.charT < 1) return;
  const h = profileHit();
  if (m.pfPick) {
    if (h.kind === 'pick') { PROFILE.setPic(CLASSES[h.i].name); SFX.unlock(); m.pfPick = false; }
    else if (h.kind === 'off') { m.pfPick = false; SFX.pickup(); }
    return;
  }
  if (!h || h.kind !== 'name') pfNameKeep();
  if (!h || h.kind !== 'search') m.pfSearch = h && h.kind === 'found' ? m.pfSearch : null;
  if (!h) return;
  if (h.kind === 'tab') pfSetTab(h.i);
  else if (h.kind === 'name') { m.nameEdit = true; m.nameSel = !!m.nameBuf; if (m.nameSel) SFX.pickup(); }
  else if (h.kind === 'pic') { m.pfPick = true; SFX.place(); }
  else if (h.kind === 'search') { if (m.pfSearch === null) { m.pfSearch = ''; SFX.pickup(); } }
  else if (h.kind === 'found' || h.kind === 'person' || h.kind === 'seat') pfOpenWho(h.i);
  else if (h.kind === 'back') pfOpenWho(null);
  else if (h.kind === 'mode') { m.pfMode = h.i; m.pfScroll = 0; m.pfOpen = ''; SFX.pickup(); }
  else if (h.kind === 'row') { m.pfOpen = m.pfOpen === h.i ? '' : h.i; SFX.pickup(); }
}
// The screen owns the keyboard while it is up (input.js routes here): the
// name field or the search take letters while they are being typed in;
// Escape steps back one thing at a time - the picker, the search, someone
// else's profile - and then out to the title.
function profileKey(e) {
  const m = state.menu;
  if (m.charT < 1) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (m.pfPick) m.pfPick = false;
    else if (m.pfSearch !== null) m.pfSearch = null;
    else if (m.nameEdit) { m.nameBuf = PROFILE.name(); m.nameEdit = false; }
    else if (m.pfWho) pfOpenWho(null);
    else leaveProfile();
    return;
  }
  const ch = String(e.char != null ? e.char : e.key).toUpperCase(); // what the key TYPED, not where it sits
  if (m.pfSearch !== null) {
    if (k === 'backspace') m.pfSearch = m.pfSearch.slice(0, -1);
    else if (k === 'enter') { const f = pfFound(profileLayout())[0]; if (f) pfOpenWho(f.pid); }
    else if (ch.length === 1 && /^[A-Z0-9]$/.test(ch) && m.pfSearch.length < PROFILE.NAME_MAX) { m.pfSearch += ch; SFX.tally(); }
    return;
  }
  if (!m.nameEdit) return;
  if (k === 'enter') { profileCommit(); return; }
  if (k === 'backspace') {
    if (m.nameBuf) { m.nameBuf = m.nameSel ? '' : m.nameBuf.slice(0, -1); m.nameSel = false; SFX.tally(); }
    return;
  }
  if (ch.length !== 1 || !/^[A-Z0-9]$/.test(ch)) return;
  if (m.nameSel) { m.nameBuf = ''; m.nameSel = false; } // the selected name goes, this letter starts the new one
  if (m.nameBuf.length >= PROFILE.NAME_MAX) { m.nameShake = NAME_SHAKE_T; SFX.iceKnock(); return; }
  m.nameBuf += ch;
  SFX.tally();
}
// the wheel over a list: MATCH HISTORY, RANKED and STATS scroll
function profileScrollBy(d) {
  const m = state.menu;
  if (m.pfPick || m.pfTab === 0) return;
  m.pfScroll = Math.max(0, Math.min(profileScrollMax(), m.pfScroll + d * PF_SCROLL));
}
function updateProfile(dt) {
  const m = state.menu;
  if (m.nameShake > 0) m.nameShake = Math.max(0, m.nameShake - dt);
  const h = m.charT >= 1 && mouse.inside ? profileHit() : null;
  const want = h ? h.kind + ':' + (h.i == null ? '' : h.i) : '';
  m.pfHot = want;
  m.pfScroll = Math.min(m.pfScroll, profileScrollMax());
}
const pfHot = (kind, i) => state.menu.pfHot === kind + ':' + (i == null ? '' : i);

// ---- the search -------------------------------------------------------------
// the people whose name starts with what is typed (then those holding it), under the field
function pfFound(L) {
  const q = state.menu.pfSearch;
  if (!q) return [];
  const all = PROFILE.people();
  const hits = all.filter((c) => c.n.startsWith(q)).concat(all.filter((c) => !c.n.startsWith(q) && c.n.indexOf(q) > 0));
  return hits.slice(0, 8).map((c, i) => ({ x: L.search.x, y: L.search.y + L.search.h + 1 + i * 14, w: L.search.w, h: 14, pid: c.pid, c }));
}

// ---- the picker ---------------------------------------------------------------
function pfPickRect() {
  const rows = Math.ceil(CLASSES.length / PF_PICK_COLS);
  const w = PF_PICK_COLS * (PF_PICK_N + PF_PICK_GAP) - PF_PICK_GAP + 28, h = 30 + rows * (PF_PICK_N + PF_PICK_GAP) - PF_PICK_GAP + 14;
  return { x: Math.round((VIEW_W - w) / 2), y: Math.round((VIEW_H - h) / 2), w, h };
}
function pfPickCells() {
  const r = pfPickRect(), out = [];
  for (let i = 0; i < CLASSES.length; i++) {
    out.push({ x: r.x + 14 + (i % PF_PICK_COLS) * (PF_PICK_N + PF_PICK_GAP), y: r.y + 30 + Math.floor(i / PF_PICK_COLS) * (PF_PICK_N + PF_PICK_GAP), w: PF_PICK_N, h: PF_PICK_N, i });
  }
  return out;
}

// ---- pixels shared by every tab ---------------------------------------------------
const PC_QUILL = ['....hh', '...hh.', '..hh..', '.hh...', 'th....', 't.....'];
const PC_QUILL_PAL = { '.': null, h: '#9fb6d8', t: '#f2cc6a' };
const PC_QUILL_HOT = { '.': null, h: '#ffd95c', t: '#fff1c2' };
function pfRim(x, y, w, h) { ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); }
// a hero's face (by name) in an n-square window, painted as your side (or the rival's)
function pfFace(hero, x, y, n, sc, ours) {
  const cls = heroIndex(hero);
  if (cls < 0) { ctx.fillStyle = SC_EDGE; ctx.fillRect(x, y, n, n); return; }
  drawFace(x, y, n, { cls, team: skin(ours === false ? 0 : 1), skins: {} }, sc);
}
// the column down the left: the picture, the name (yours in its field), the
// three numbers, and the people played with most
function drawProfileColumn(L, now) {
  const m = state.menu, c = pfCard(), col = L.col;
  ctx.fillStyle = SC_PLATE; ctx.fillRect(col.x, col.y, col.w, col.h);
  ctx.fillStyle = SC_GOLD; ctx.fillRect(col.x, col.y, col.w, 2);
  const pic = c ? c.pic : profilePic();
  ctx.fillStyle = pfHot('pic') ? '#ffd95c' : SC_GOLD; ctx.fillRect(L.pic.x - 1, L.pic.y - 1, PF_PIC + 2, PF_PIC + 2);
  pfFace(pic, L.pic.x, L.pic.y, PF_PIC, 3);
  if (c) drawPixelTextOutline(ctx, c.n, col.x + (col.w >> 1) - (pixelTextWidth(c.n, 2) >> 1), L.field.y + 5, SC_GOLD, SC_INK, 2);
  else drawNameField(L.field, now);
  const st = c ? { r: c.rk, g: c.g, w: c.w } : { r: PROFILE.rank(), g: PROFILE.stats().matches, w: PROFILE.stats().wins };
  const by = L.field.y + L.field.h + 12, cells = [[st.r, 'RANK', SC_GOLD], [st.g, 'GAMES', SC_TXT], [st.g ? Math.round(100 * st.w / st.g) + '%' : '-', 'WINS', SC_TXT]];
  cells.forEach(([v, l, cl], i) => {
    const cx = col.x + 18 + Math.round(i * (col.w - 36) / 2);
    drawPixelTextOutline(ctx, String(v), cx - (pixelTextWidth(String(v)) >> 1), by, cl, SC_INK, 1);
    drawPixelTextOutline(ctx, l, cx - (pixelTextWidth(l) >> 1), by + 9, SC_DIM, SC_INK, 1);
  });
  ctx.fillStyle = SC_EDGE; ctx.fillRect(col.x + 10, by + 22, col.w - 20, 1);
  if (c) {
    const b = pfBackRect(L), hot = pfHot('back');
    pfFace(profilePic(), b.x, b.y, 14, 1, true);
    drawPixelTextOutline(ctx, PROFILE.name(), b.x + 18, b.y + 4, hot ? '#ffd95c' : SC_LBL, SC_INK, 1);
    return;
  }
  const mates = pfMateRects(L);
  if (mates.length) drawPixelTextOutline(ctx, 'PLAYED WITH', col.x + 10, by + 30, SC_DIM, SC_INK, 1);
  for (const p of mates) {
    pfFace(p.hero, p.x, p.y, 14, 1, true);
    drawPixelTextOutline(ctx, p.n, p.x + 18, p.y + 4, pfHot('person', p.pid) ? '#ffd95c' : SC_TXT, SC_INK, 1);
  }
}
// the way back to your own profile, under someone else's numbers
function pfBackRect(L) { return { x: L.col.x + 10, y: L.field.y + L.field.h + 42, w: L.col.w - 20, h: 14 }; }
// the people you played with most, the ones whose card this screen holds
function pfMateRects(L) {
  if (state.menu.pfWho) return [];
  const known = new Map(PROFILE.people().map((c) => [c.pid, c]));
  const y0 = L.field.y + L.field.h + 52, rows = Math.max(0, Math.floor((L.col.y + L.col.h - y0 - 4) / 18));
  return historyMates(historyList(), 12).filter((e) => known.has(e.pid)).slice(0, Math.min(5, rows))
    .map((e, i) => { const c = known.get(e.pid); return { x: L.col.x + 10, y: y0 + i * 18, w: L.col.w - 20, h: 14, n: c.n, hero: c.pic, pid: c.pid }; });
}
// the name field: at rest the name in gold with its quill; typed in, the
// buffer in white with the caret, or SELECTED on a gold band when the next
// letter will replace it, the underline red while the store would refuse it
function drawNameField(f, now) {
  const m = state.menu;
  const bad = m.nameShake / NAME_SHAKE_T;
  const shake = bad > 0 ? Math.round(Math.sin(now * 90) * 2.5 * bad) : 0;
  const hot = pfHot('name'), txt = m.nameEdit ? m.nameBuf : PROFILE.name();
  const ok = PROFILE.validate(txt).ok, tw = pixelTextWidth(txt, 2);
  if (m.nameEdit || hot) {
    ctx.fillStyle = hot ? '#8fa0c8' : SC_EDGE; ctx.fillRect(f.x - 1, f.y - 1, f.w + 2, f.h + 2);
    ctx.fillStyle = '#0a0b0e'; ctx.fillRect(f.x, f.y, f.w, f.h);
  }
  if (m.nameEdit) {
    ctx.fillStyle = ok || !txt ? SC_EDGE : '#a83a3a'; ctx.fillRect(f.x + 1, f.y + f.h - 2, f.w - 2, 2);
    if (bad > 0) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.5 * bad; ctx.fillStyle = '#a83a3a'; ctx.fillRect(f.x, f.y, f.w, f.h); ctx.globalAlpha = ga; }
    const tx = f.x + Math.round((f.w - tw - 5) / 2) + shake, ty = f.y + 5;
    const sel = m.nameSel && txt;
    if (sel) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(tx - 2, ty - 2, tw + 4, 14); }
    drawPixelTextShadow(ctx, txt, tx, ty, sel ? '#0a0b0e' : bad > 0 ? '#ffb0a0' : SC_LIT, sel ? '#c89a3c' : '#0a0b0e', 2);
    if (!sel && Math.floor(now * 2) % 2 === 0) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(txt ? tx + tw + 2 : tx - 5, ty, 2, 10); }
  } else {
    const tx = f.x + Math.round((f.w - tw - 10) / 2);
    drawPixelTextOutline(ctx, txt, tx, f.y + 5, '#ffd95c', SC_INK, 2);
    stampGrid(PC_QUILL, hot ? PC_QUILL_HOT : PC_QUILL_PAL, tx + tw + 4, f.y + 10, 1);
  }
}
// the bar across the top: the tabs (white with a word-wide gold line on the
// open one) and the search field, its results dropping under it
function drawProfileBar(L, now) {
  const m = state.menu;
  ctx.fillStyle = '#0a0b0e'; ctx.fillRect(0, 0, VIEW_W, PF_BAR_H);
  ctx.fillStyle = SC_EDGE; ctx.fillRect(0, PF_BAR_H, VIEW_W, 1);
  for (const t of L.tabs) {
    const open = m.pfTab === t.i;
    drawPixelTextOutline(ctx, PF_TABS[t.i], t.x, t.y, open ? SC_LIT : pfHot('tab', t.i) ? SC_TXT : SC_LBL, SC_INK, 1);
    if (open) { ctx.fillStyle = SC_GOLD; ctx.fillRect(t.x, t.y + 8, t.w, 1); }
  }
  const s = L.search, typing = m.pfSearch !== null;
  ctx.fillStyle = '#07080a'; ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = typing || pfHot('search') ? '#8fa0c8' : SC_EDGE; pfRim(s.x, s.y, s.w, s.h);
  ctx.fillStyle = SC_DIM; // the magnifier
  ctx.fillRect(s.x + 4, s.y + 3, 4, 1); ctx.fillRect(s.x + 4, s.y + 7, 4, 1); ctx.fillRect(s.x + 3, s.y + 4, 1, 3); ctx.fillRect(s.x + 8, s.y + 4, 1, 3); ctx.fillRect(s.x + 9, s.y + 8, 1, 1); ctx.fillRect(s.x + 10, s.y + 9, 1, 1);
  if (typing) {
    drawPixelTextOutline(ctx, m.pfSearch, s.x + 15, s.y + 4, SC_LIT, SC_INK, 1);
    if (Math.floor(now * 2) % 2 === 0) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(s.x + 15 + pixelTextWidth(m.pfSearch) + (m.pfSearch ? 1 : 0), s.y + 3, 1, 7); }
  }
}
function drawProfileFound(L) {
  for (const f of pfFound(L)) {
    ctx.fillStyle = pfHot('found', f.pid) ? SC_HOT : SC_PLATE; ctx.fillRect(f.x, f.y, f.w, f.h);
    pfFace(f.c.pic, f.x + 2, f.y + 2, 10, 1, true);
    drawPixelTextOutline(ctx, f.c.n, f.x + 16, f.y + 4, SC_TXT, SC_INK, 1);
    const r = String(f.c.rk);
    drawPixelTextOutline(ctx, r, f.x + f.w - 4 - pixelTextWidth(r), f.y + 4, SC_GOLD, SC_INK, 1);
  }
}
// the picker over the dimmed profile: every hero's face, the one worn in gold
function drawProfilePicker() {
  const r = pfPickRect(), worn = profilePic();
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * 0.8; ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.globalAlpha = ga;
  ctx.fillStyle = SC_PLATE; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = SC_GOLD; ctx.fillRect(r.x, r.y, r.w, 2);
  let hov = -1;
  for (const c of pfPickCells()) {
    const on = CLASSES[c.i].name === worn, hot = pfHot('pick', c.i);
    if (hot) hov = c.i;
    ctx.fillStyle = on ? SC_GOLD : hot ? '#8fa0c8' : SC_EDGE; pfRim(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
    pfFace(CLASSES[c.i].name, c.x, c.y, c.w, 2, true);
  }
  const nm = CLASSES[hov >= 0 ? hov : Math.max(0, heroIndex(worn))].name;
  drawPixelTextOutline(ctx, nm, r.x + (r.w >> 1) - (pixelTextWidth(nm, 2) >> 1), r.y + 10, SC_LIT, SC_INK, 2);
}
function renderProfile(now, a) {
  const m = state.menu, L = profileLayout();
  ctx.globalAlpha = a;
  ctx.fillStyle = SC_BG; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawProfileTab(L, now);
  drawProfileBar(L, now);
  drawProfileColumn(L, now);
  if (m.pfSearch !== null) drawProfileFound(L);
  if (m.pfPick) drawProfilePicker();
  drawBackHint(ctx, L.col.x + (L.col.w >> 1), L.col.y + L.col.h - 12);
  ctx.globalAlpha = 1;
}
