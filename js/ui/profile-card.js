'use strict';
// ------------------------------------------------------------ profile card
// Who you are between matches: ONE name and its lifetime stats (the store is
// js/app/profile.js; nothing here touches localStorage). The NAME TAG sits
// bottom-left of the title, mirroring the patch tag on the right: the name
// and a quill that gild under the hand. A press opens the PROFILE CARD
// (menu.screen 'profile') over the dimmed title: the name in a field, the
// ledger under it. A fresh install arrives PRE-NAMED (a winter word), so the
// card is never in the way of the first match; it is where a name is changed.
//
// The field: a click selects the name (the next letter replaces it), typing
// edits it, Enter keeps it, Escape or a press off the card closes - keeping a
// name the store accepts and dropping one it refuses. A refused Enter rattles
// the field and floods it red; a character the name may not hold is never
// drawn. Nothing here is a sentence: text is the name and the ledger's labels.

// ---- layout -------------------------------------------------------------
const PC_W = 156, PC_H = 104;   // the card
const PC_FIELD_H = 20;          // the name field, inset across the card's head
const NAME_SHAKE_T = 0.3;       // the field's refusal: it rattles and flushes red
function profileLayout() {
  const card = { x: Math.round(VIEW_W / 2) - (PC_W >> 1), y: Math.round(VIEW_H / 2) - (PC_H >> 1) - 24, w: PC_W, h: PC_H };
  const field = { x: card.x + 8, y: card.y + 8, w: card.w - 16, h: PC_FIELD_H };
  return { card, field, ledger: { x: card.x + 12, y: card.y + 44, w: card.w - 24 }, back: card.y + card.h + 12 };
}
const overRect = (r, px, py) => mouse.x >= r.x - (px || 0) && mouse.x < r.x + r.w + (px || 0) && mouse.y >= r.y - (py || 0) && mouse.y < r.y + r.h + (py || 0);

// ---- the name tag -------------------------------------------------------
function profileTagRect() {
  return { x: 6, y: VIEW_H - 12, w: pixelTextWidth(PROFILE.name()) + 4 + 6, h: 8 };
}
function overProfileTag() { return overRect(profileTagRect(), 3, 3); }
function drawProfileTag() {
  const hot = !state.menu.panel && overProfileTag();
  const r = profileTagRect(), nm = PROFILE.name();
  drawPixelTextShadow(ctx, nm, r.x, r.y + 1, hot ? '#ffd95c' : '#9fb6d8', 'rgba(15,22,50,0.9)');
  stampGrid(PC_QUILL, hot ? PC_QUILL_HOT : PC_QUILL_PAL, r.x + pixelTextWidth(nm) + 4, r.y + 1, 1);
  if (hot) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(r.x, r.y + 8, r.w, 1); }
}

// ---- the card -----------------------------------------------------------
function beginProfile() {
  const m = state.menu;
  m.screen = 'profile';
  m.nameBuf = PROFILE.name();
  m.nameSel = false; m.nameEdit = false; m.nameShake = 0;
  m.khover = {};
  SFX.place();
}
// out, keeping the buffer when the store takes it (an unchanged name is a no-op)
function leaveProfile() {
  const m = state.menu;
  const r = PROFILE.setName(m.nameBuf);
  if (r.ok) player.name = r.name; // the title's body wears it at once
  m.nameEdit = false;
  m.screen = 'menu';
  SFX.pickup();
}
// Enter: the name is kept and the card closes - or the field refuses it
function profileCommit() {
  const m = state.menu;
  if (!PROFILE.validate(m.nameBuf).ok) { m.nameShake = NAME_SHAKE_T; SFX.iceKnock(); return; }
  SFX.unlock();
  leaveProfile();
}
// what the pointer is on: 'name', 'card' or null (off the card)
function profileHit() {
  const L = profileLayout();
  if (overRect(L.field, 2, 2)) return 'name';
  return overRect(L.card) ? 'card' : null;
}
// The card owns the keyboard while it is up (input.js routes here): letters
// are the name, Backspace edits it, Enter keeps it, Escape closes.
function profileKey(e) {
  const m = state.menu;
  if (m.charT < 1) return;
  const k = e.key.toLowerCase();
  if (k === 'enter') { profileCommit(); return; }
  if (k === 'escape') { leaveProfile(); return; }
  if (k === 'backspace') {
    if (m.nameBuf) { m.nameBuf = m.nameSel ? '' : m.nameBuf.slice(0, -1); m.nameSel = false; m.nameEdit = true; SFX.tally(); }
    return;
  }
  const ch = String(e.char != null ? e.char : e.key).toUpperCase(); // what the key TYPED, not where it sits
  if (ch.length !== 1 || !/^[A-Z0-9]$/.test(ch)) return;
  if (m.nameSel) { m.nameBuf = ''; m.nameSel = false; } // the selected name goes, this letter starts the new one
  m.nameEdit = true;
  if (m.nameBuf.length >= PROFILE.NAME_MAX) { m.nameShake = NAME_SHAKE_T; SFX.iceKnock(); return; }
  m.nameBuf += ch;
  SFX.tally();
}
function profileClick() {
  const m = state.menu;
  if (m.charT < 1) return;
  const h = profileHit();
  if (!h) { leaveProfile(); return; }
  if (h === 'name') { m.nameEdit = true; m.nameSel = !!m.nameBuf; if (m.nameSel) SFX.pickup(); }
}
function updateProfile(dt) {
  const m = state.menu;
  if (m.nameShake > 0) m.nameShake = Math.max(0, m.nameShake - dt);
  const want = m.charT >= 1 && mouse.inside ? profileHit() || '' : '';
  for (const k of ['name']) m.khover[k] = (m.khover[k] || 0) + ((want === k ? 1 : 0) - (m.khover[k] || 0)) * Math.min(1, dt * 14);
}

// The card over the dimmed title: the name field across its head - at rest
// the name in gold with its quill; typed in, the buffer in white with the
// caret, or SELECTED on a gold band when the next letter will replace it, the
// capacity ticks under it and the underline red while the store would refuse
// it - then a rule and the ledger.
function renderProfileCard(now, a) {
  const m = state.menu, L = profileLayout();
  ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#04060f'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const slide = Math.round((1 - a) * 16);
  ctx.globalAlpha = a;
  const c = { x: L.card.x, y: L.card.y + slide, w: L.card.w, h: L.card.h };
  drawWell(c, 0, true, false);
  const f = { x: L.field.x, y: L.field.y + slide, w: L.field.w, h: L.field.h };
  const bad = m.nameShake / NAME_SHAKE_T;
  const shake = bad > 0 ? Math.round(Math.sin(now * 90) * 2.5 * bad) : 0;
  const nh = m.khover.name || 0;
  const ok = PROFILE.validate(m.nameBuf).ok, txt = m.nameBuf;
  const tw = pixelTextWidth(txt, 2);
  if (m.nameEdit || nh > 0.5) { // the field shows itself under the hand or while typed in
    ctx.fillStyle = nh > 0.5 ? '#8fa0c8' : '#2c3560'; ctx.fillRect(f.x - 1, f.y - 1, f.w + 2, f.h + 2);
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(f.x, f.y, f.w, f.h);
  }
  if (m.nameEdit) {
    ctx.fillStyle = ok || !txt ? '#2c3a68' : '#a83a3a'; ctx.fillRect(f.x + 1, f.y + f.h - 2, f.w - 2, 2);
    if (bad > 0) { ctx.globalAlpha = a * 0.5 * bad; ctx.fillStyle = '#a83a3a'; ctx.fillRect(f.x, f.y, f.w, f.h); ctx.globalAlpha = a; }
    const tx = f.x + Math.round((f.w - tw - 5) / 2) + shake, ty = f.y + 5;
    const sel = m.nameSel && txt;
    if (sel) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(tx - 2, ty - 2, tw + 4, 14); }
    drawPixelTextShadow(ctx, txt, tx, ty, sel ? '#0a0e23' : bad > 0 ? '#ffb0a0' : '#f4f7ff', sel ? '#c89a3c' : '#0a0e23', 2);
    if (!sel && Math.floor(now * 2) % 2 === 0) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(txt ? tx + tw + 2 : tx - 5, ty, 2, 10); }
    let kx = f.x + Math.round((f.w - (PROFILE.NAME_MAX * 4 - 1)) / 2);
    for (let i = 0; i < PROFILE.NAME_MAX; i++, kx += 4) { ctx.fillStyle = i < txt.length ? '#f2cc6a' : '#2c3a68'; ctx.fillRect(kx, f.y + f.h + 3, 3, 2); }
  } else {
    const tx = f.x + Math.round((f.w - tw - 10) / 2);
    drawPixelTextOutline(ctx, txt, tx, f.y + 5, '#ffd95c', 'rgba(8,12,28,0.9)', 2);
    stampGrid(PC_QUILL, nh > 0.5 ? PC_QUILL_HOT : PC_QUILL_PAL, tx + tw + 4, f.y + 10, 1);
  }
  ctx.fillStyle = '#2c3a68'; ctx.fillRect(c.x + 10, c.y + 36, c.w - 20, 1);
  drawLedger(L.ledger.x, L.ledger.y + slide, L.ledger.w, PROFILE.stats());
  drawBackHint(ctx, Math.round(VIEW_W / 2), L.back + slide);
  ctx.globalAlpha = 1;
}

// ---- pixels -------------------------------------------------------------
const PC_ICON_PAL = { '.': null, y: '#f2cc6a', w: '#cfe0ff', d: '#7a8bb8' };
const PC_CROWN = ['........', 'y..yy..y', 'y.yyyy.y', 'yyyyyyyy', '.yyyyyy.', '........', '........', '........'];
const PC_SUN = ['...yy...', '.y....y.', '..yyyy..', 'y.yyyy.y', 'y.yyyy.y', '..yyyy..', '.y....y.', '...yy...'];
const PC_SWORDS = ['w.....w.', '.w...w..', '..w.w...', '...w....', '..w.w...', '.w...w..', 'd.....d.', '........'];
const PC_SKULL = ['..wwww..', '.wwwwww.', '.wdwwdw.', '.wwwwww.', '..wwww..', '..w.w...', '........', '........'];
const PC_FLAG = ['w.......', 'wyyyy...', 'wyyyyy..', 'wyyyy...', 'w.......', 'w.......', 'w.......', '........'];
const PC_QUILL = ['....hh', '...hh.', '..hh..', '.hh...', 'th....', 't.....'];
const PC_QUILL_PAL = { '.': null, h: '#9fb6d8', t: '#f2cc6a' };
const PC_QUILL_HOT = { '.': null, h: '#ffd95c', t: '#fff1c2' };

// a well: the this-is-a-button grammar shared by the card and the hero row
// (js/ui/heroes.js) - a dark drop shadow, a slate rim that lightens under the
// hand and goes gold when picked, a navy floor. Returns the floor's top
// (lifted 1-2 px under the hand when `lift`).
function drawWell(r, hv, picked, lift) {
  const y = r.y - (lift ? Math.round(hv * 1.5) : 0);
  ctx.fillStyle = 'rgba(4,6,18,0.55)';
  ctx.fillRect(r.x + 2, r.y + 2, r.w, r.h);
  ctx.fillStyle = picked ? '#c89a3c' : hv > 0.5 ? '#8fa0c8' : '#2c3560';
  ctx.fillRect(r.x, y, r.w, r.h);
  ctx.fillStyle = picked ? '#1a2142' : '#0f1632';
  ctx.fillRect(r.x + 1, y + 1, r.w - 2, r.h - 2);
  return y;
}
// the lifetime ledger: an icon, the label, a dotted leader and the number
function drawLedger(x, y, w, st) {
  const grand = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, ',');
  const rows = [[PC_CROWN, 'WINS', st.wins, '#cfe0ff'], [PC_FLAG, 'MATCHES', st.matches, '#cfe0ff'],
    [PC_SWORDS, 'KILLS', st.kills, '#cfe0ff'], [PC_SKULL, 'DEATHS', st.deaths, '#cfe0ff'],
    [PC_SUN, 'DAYS', st.days, '#cfe0ff'], [null, 'GOLD', st.gold, '#f2cc6a']];
  for (let i = 0; i < rows.length; i++) {
    const ry = y + i * 10;
    if (rows[i][0]) stampGrid(rows[i][0], PC_ICON_PAL, x, ry - 1, 1);
    else ctx.drawImage(SPRITES.itemGold, x, ry - 1);
    drawPixelTextShadow(ctx, rows[i][1], x + 11, ry, '#7a8bb8', 'rgba(8,12,28,0.9)');
    const s = grand(rows[i][2]);
    const nx = x + w - pixelTextWidth(s);
    drawPixelTextShadow(ctx, s, nx, ry, rows[i][3], '#0a0e23');
    ctx.fillStyle = '#2c3a68';
    for (let dx = x + 11 + pixelTextWidth(rows[i][1]) + 4; dx < nx - 4; dx += 3) ctx.fillRect(dx, ry + 4, 1, 1);
  }
}
