'use strict';
// ------------------------------------------------------------ characters
// Who you are between matches: the CHARACTER ROSTER (menu.screen 'chars')
// and the CREATE / CUSTOMIZE screen ('create'), both on class select's
// painted night, and the character tag bottom-left of the title that opens
// the roster. The STORE is js/profile.js (three slots, each a name, a class
// fixed at creation, a look and its lifetime stats) and nothing here touches
// localStorage; the pictures are js/sprites/looks.js (the 48 px model) and
// characters.js (the look on the 16 px body).
//
// A fresh install opens the create screen before the title (js/boot.js),
// on a PRE-ROLLED character - a rolled name and look - so DONE is one press
// away and nobody is stopped at a blank form. Nothing on either screen is a
// sentence: the model IS the preview, a cell is a choice worn by the model,
// the die rolls one, the class is the emblem, the X plate deletes.
// Text is the name, the ledger's labels (the character panel carve-out) and
// the two planks.

// ---- layout -------------------------------------------------------------
const CH_CARD_W = 120, CH_CARD_H = 184, CH_CARD_GAP = 16; // a roster slot
const CH_STAGE = 144;      // the create screen's model, the 48 px portrait at 3x
const CH_CELL = 24;        // an option cell's side: a 1x crop of the model wearing that option
const CH_CELL_GAP = 2;
const CH_PLATE = 36;       // the head row's plates: the two class emblems and the die
const CH_ROW_P = 28;       // the option rows' pitch
const CH_GAP = 24;         // between the stage column and the option panel
const CH_NAME_W = 176, CH_NAME_H = 20;
const CH_BW = 88, CH_BH = 20, CH_BGAP = 12;
const NAME_SHAKE_T = 0.3;  // the name field's refusal: it rattles and flushes red
const DIE_T = 0.4;         // the die's tumble after a press
// the create screen's rows, in keyboard order: the axis each turns and the
// crop of the bare model its cells show - the head (x 12, y 2) for anything
// on the face, the torso (x 12, y 22) for the body. `cls` is the class pair,
// only live for a new character. Every row is the same thing: one cell per
// choice, the choice drawn in it, the picked one gold.
const CH_HEAD = { x: 12, y: 2 }, CH_TORSO = { x: 12, y: 22 };
const CH_ROWS = [
  { id: 'cls', kind: 'cls' },
  { id: 'sex', crop: CH_TORSO },
  { id: 'tone', crop: CH_HEAD },
  { id: 'hair', crop: CH_HEAD },
  { id: 'hairCol', crop: CH_HEAD },
  { id: 'beard', crop: CH_HEAD },
  { id: 'face', crop: CH_HEAD },
];
const CH_ROW_N = Math.max(...Object.values(PROFILE.LOOK_N)); // the widest row sets the panel

// the roster: three slots across the middle, the back hint under them
function charsLayout() {
  const toy = frameTop();
  const cx = Math.round(VIEW_W / 2);
  const n = PROFILE.CHAR_MAX;
  const x0 = cx - Math.round((n * CH_CARD_W + (n - 1) * CH_CARD_GAP) / 2);
  const cards = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (CH_CARD_W + CH_CARD_GAP), y = toy + 24;
    cards.push({ x, y, w: CH_CARD_W, h: CH_CARD_H, i,
      quill: { x: x + CH_CARD_W - 16, y: y + CH_CARD_H - 14, w: 12, h: 10 },
      del: { x: x + CH_CARD_W - 14, y: y + 3, w: 11, h: 11 } });
  }
  return { toy, cx, cards, back: toy + 222 };
}
// the create screen, two columns sharing a top line and a foot, centred as
// one block: the stage (the model, the in-world body on a snow pad) with the
// name under it, and the option panel - its head row the class pair at the
// left and the die at the right, both at CH_PLATE, the look rows under it,
// every cell the same size, every row starting in the same column and the
// head row spanning the widest. DONE / CANCEL centred along the foot.
function createLayout() {
  const toy = frameTop();
  const cx = Math.round(VIEW_W / 2);
  const panelW = 16 + CH_ROW_N * CH_CELL + (CH_ROW_N - 1) * CH_CELL_GAP; // the glyph gutter + the widest row
  const left = cx - Math.round((CH_STAGE + CH_GAP + panelW) / 2);
  const stage = { x: left, y: toy + 12, w: CH_STAGE, h: CH_STAGE };
  const mini = { x: stage.x + stage.w - 34, y: stage.y + stage.h - 36, w: 32, h: 32 }; // the in-world body, 2x
  const name = { x: stage.x + Math.round((stage.w - CH_NAME_W) / 2), y: stage.y + stage.h + 12, w: CH_NAME_W, h: CH_NAME_H };
  const x0 = left + CH_STAGE + CH_GAP + 16; // the cells' left edge; a row's glyph sits in the 16 px gutter before it
  const cellsW = panelW - 16;
  const rows = CH_ROWS.map((r, i) => i
    ? { id: r.id, crop: r.crop, x: x0, y: toy + 56 + (i - 1) * CH_ROW_P, w: cellsW, h: CH_CELL }
    : { id: r.id, kind: r.kind, x: x0, y: toy + 12, w: CH_PLATE * 2 + 6, h: CH_PLATE });
  const die = { x: x0 + cellsW - CH_PLATE, y: toy + 12, w: CH_PLATE, h: CH_PLATE }; // the head row's right end
  const planks = [];
  const first = state.menu.cedit && state.menu.cedit.first;
  const pw = first ? CH_BW : CH_BW * 2 + CH_BGAP;
  const px = cx - Math.round(pw / 2), py = toy + 230;
  planks.push({ x: px, y: py, w: CH_BW, h: CH_BH, id: 'done' });
  if (!first) planks.push({ x: px + CH_BW + CH_BGAP, y: py, w: CH_BW, h: CH_BH, id: 'cancel' });
  return { toy, cx, stage, die, mini, name, rows, planks };
}
// the cells of one option row, each with a hit id and the value it sets
function rowCells(r) {
  const out = [];
  if (r.kind === 'cls') {
    for (let v = 0; v < CLASSES.length; v++) out.push({ id: 'cls' + v, x: r.x + v * (CH_PLATE + 6), y: r.y, w: CH_PLATE, h: CH_PLATE, axis: 'cls', v });
  } else {
    const n = PROFILE.LOOK_N[r.id];
    for (let v = 0; v < n; v++) out.push({ id: r.id + v, x: r.x + v * (CH_CELL + CH_CELL_GAP), y: r.y, w: CH_CELL, h: CH_CELL, axis: r.id, v, crop: r.crop });
  }
  return out;
}
const overRect = (r, px, py) => mouse.x >= r.x - (px || 0) && mouse.x < r.x + r.w + (px || 0) && mouse.y >= r.y - (py || 0) && mouse.y < r.y + r.h + (py || 0);

// ---- the roster ---------------------------------------------------------
function beginChars() {
  const m = state.menu;
  m.screen = m.cscreen = 'chars';
  m.ksel = PROFILE.activeIndex();
  m.khover = {};
  SFX.place();
  SFX.music.play('select');
}
function leaveChars() {
  state.menu.screen = 'menu';
  SFX.pickup();
  SFX.music.play('intro');
}
// what the pointer is on: { kind: 'card'|'quill'|'del'|'new', i } or null
function charsHit() {
  const { cards } = charsLayout();
  const chars = PROFILE.chars();
  for (const c of cards) {
    if (chars[c.i]) {
      if (overRect(c.del, 2, 2)) return { kind: 'del', i: c.i };
      if (overRect(c.quill, 2, 2)) return { kind: 'quill', i: c.i };
      if (overRect(c)) return { kind: 'card', i: c.i };
    } else if (overRect(c)) return { kind: 'new', i: c.i };
  }
  return null;
}
// make slot i the character the local player wears
function activateChar(i) {
  if (PROFILE.setActive(i)) applyCharacter();
}
function charsKey(k) {
  const m = state.menu;
  const chars = PROFILE.chars();
  if (k === 'escape' || k === 'backspace') { leaveChars(); return; }
  if (moveDir(k) === 'left') { m.ksel = Math.max(0, m.ksel - 1); SFX.pickup(); }
  else if (moveDir(k) === 'right') { m.ksel = Math.min(PROFILE.CHAR_MAX - 1, m.ksel + 1); SFX.pickup(); }
  else if (k === 'enter' || k === ' ') {
    if (chars[m.ksel]) { activateChar(m.ksel); SFX.unlock(); leaveChars(); }
    else beginCreate(-1, false);
  }
}
function charsClick() {
  const m = state.menu;
  if (m.charT < 1) return;
  const h = charsHit();
  if (!h) return;
  m.ksel = h.i;
  if (h.kind === 'new') beginCreate(-1, false);
  else if (h.kind === 'quill') beginCreate(h.i, false);
  else if (h.kind === 'card') { activateChar(h.i); SFX.unlock(); leaveChars(); }
  else if (h.kind === 'del') deleteSlot(h.i);
}
// the X plate: the slot goes on the press. The last character gone puts the
// create screen back up as a first launch - the game needs somebody to play.
function deleteSlot(i) {
  const m = state.menu;
  if (!PROFILE.deleteChar(i)) return;
  applyCharacter();
  m.ksel = Math.min(i, Math.max(0, PROFILE.chars().length - 1));
  SFX.break_();
  if (!PROFILE.hasChar()) beginCreate(-1, true);
}
function updateChars(dt) {
  const m = state.menu;
  const hv = m.charT >= 1 ? charsHit() : null;
  const want = hv ? hv.kind + hv.i : '';
  for (const k of Object.keys(m.khover)) m.khover[k] += ((want === k ? 1 : 0) - m.khover[k]) * Math.min(1, dt * 14);
  if (want && m.khover[want] === undefined) m.khover[want] = 0;
}

// ---- the create screen --------------------------------------------------
// slot -1 makes a new character (pre-rolled); a slot index edits that one -
// its class shown but not for turning. `first` is the fresh install: no
// CANCEL, and DONE lands on the title menu.
function beginCreate(slot, first) {
  const m = state.menu;
  const c = slot >= 0 ? PROFILE.chars()[slot] : null;
  const spec = c ? { name: c.name, cls: c.cls, look: Object.assign({}, c.look) } : PROFILE.rollChar();
  m.cedit = { slot, spec, first: !!first };
  m.nameBuf = spec.name;
  m.nameSel = slot < 0; // a pre-rolled name arrives selected: the first letter typed replaces it
  m.nameShake = 0;
  m.dieT = 0;
  m.crow = 0;
  m.khover = {};
  m.screen = m.cscreen = 'create';
  if (!first) SFX.place();
  SFX.music.play('select');
}
// the buffer as it stands would be accepted: what lights the DONE plank
function nameOk() { return PROFILE.validate(state.menu.nameBuf).ok; }
function createCommit() {
  const m = state.menu;
  const e = m.cedit;
  if (!e) return;
  e.spec.name = m.nameBuf;
  const r = e.slot >= 0 ? PROFILE.updateChar(e.slot, e.spec) : PROFILE.createChar(e.spec);
  if (!r.ok) { m.nameShake = NAME_SHAKE_T; SFX.iceKnock(); return; } // refused: the field says so, and stays open
  applyCharacter();
  SFX.unlock();
  const first = e.first;
  m.cedit = null;
  if (first) { m.screen = 'menu'; SFX.music.play('intro'); }
  else beginChars();
}
// ESC or the CANCEL plank: the stored character is left alone. There is no
// cancelling the first one - the game needs somebody to play.
function createCancel() {
  const m = state.menu;
  if (!m.cedit || m.cedit.first) { SFX.deny(); return; }
  m.cedit = null;
  SFX.pickup();
  beginChars();
}
function setLook(axis, v) {
  const m = state.menu, e = m.cedit;
  if (!e) return;
  if (axis === 'cls') {
    if (e.slot >= 0 || e.spec.cls === v) { SFX.deny(); return; } // fixed at creation
    e.spec.cls = v;
  } else {
    if (e.spec.look[axis] === v) return;
    e.spec.look[axis] = v;
  }
  SFX.pickup();
}
function cycleLook(axis, step) {
  const n = PROFILE.LOOK_N[axis];
  setLook(axis, ((state.menu.cedit.spec.look[axis] + step) % n + n) % n);
}
// the die: a press tumbles it (DIE_T of faces flickering) and lands a new
// look AND a new name, the name selected so a letter typed next replaces it
function shuffleLook() {
  const m = state.menu, e = m.cedit;
  if (!e) return;
  const c = PROFILE.rollChar(e.spec.cls);
  e.spec.look = c.look;
  m.nameBuf = c.name;
  m.nameSel = true;
  m.dieT = DIE_T;
  SFX.dodge();
}
// what the pointer is on: a cell's id, 'die', 'name', 'done', 'cancel', or null
function createHit() {
  const L = createLayout();
  for (const r of L.rows) for (const c of rowCells(r)) if (overRect(c, 1, 1)) return c.id;
  if (overRect(L.die, 2, 2)) return 'die';
  if (overRect(L.name, 2, 2)) return 'name';
  for (const p of L.planks) if (overRect(p, 2, 3)) return p.id;
  return null;
}
function createCellById(id) {
  for (const r of createLayout().rows) for (const c of rowCells(r)) if (c.id === id) return c;
  return null;
}
// The screen owns the keyboard while it is up (input.js routes here): letters
// are the name, Backspace edits it, the arrows walk the rows and turn them,
// Enter is DONE, Escape CANCEL. A character the name may not hold is simply
// never drawn - that refusal IS the validation message.
function createKey(e) {
  const m = state.menu;
  if (m.charT < 1 || !m.cedit) return;
  const k = e.key.toLowerCase();
  if (k === 'enter') { createCommit(); return; }
  if (k === 'escape') { createCancel(); return; }
  if (k === 'backspace') {
    if (m.nameBuf) { m.nameBuf = m.nameSel ? '' : m.nameBuf.slice(0, -1); m.nameSel = false; SFX.tally(); }
    return;
  }
  if (k === 'arrowup') { m.crow = (m.crow + CH_ROWS.length - 1) % CH_ROWS.length; SFX.pickup(); return; }
  if (k === 'arrowdown') { m.crow = (m.crow + 1) % CH_ROWS.length; SFX.pickup(); return; }
  if (k === 'arrowleft' || k === 'arrowright') {
    const r = CH_ROWS[m.crow], step = k === 'arrowleft' ? -1 : 1;
    if (r.kind === 'cls') setLook('cls', (m.cedit.spec.cls + CLASSES.length + step) % CLASSES.length);
    else cycleLook(r.id, step);
    return;
  }
  const ch = String(e.char != null ? e.char : e.key).toUpperCase(); // what the key TYPED, not where it sits
  if (ch.length !== 1) return;
  if (!/^[A-Z0-9]$/.test(ch)) return;
  if (m.nameSel) { m.nameBuf = ''; m.nameSel = false; } // the selected name goes, this letter starts the new one
  if (m.nameBuf.length >= PROFILE.NAME_MAX) { m.nameShake = NAME_SHAKE_T; SFX.iceKnock(); return; }
  m.nameBuf += ch;
  SFX.tally();
}
function createClick() {
  const m = state.menu;
  if (m.charT < 1 || !m.cedit) return;
  const h = createHit();
  if (!h) return;
  if (h === 'done') { m.pressT = 0.12; createCommit(); return; }
  if (h === 'cancel') { m.pressT = 0.12; createCancel(); return; }
  m.nameSel = false;
  if (h === 'die') { shuffleLook(); return; }
  if (h === 'name') { m.nameSel = !!m.nameBuf; if (m.nameSel) SFX.pickup(); return; }
  const c = createCellById(h);
  if (!c) return;
  m.crow = CH_ROWS.findIndex((r) => r.id === c.axis);
  setLook(c.axis, c.v);
}
function updateCreate(dt) {
  const m = state.menu;
  if (m.nameShake > 0) m.nameShake = Math.max(0, m.nameShake - dt);
  if (m.dieT > 0) m.dieT = Math.max(0, m.dieT - dt);
  const want = m.charT >= 1 && mouse.inside ? createHit() || '' : '';
  for (const k of Object.keys(m.khover)) m.khover[k] += ((want === k ? 1 : 0) - m.khover[k]) * Math.min(1, dt * 14);
  if (want && m.khover[want] === undefined) m.khover[want] = 0;
}

// ---- pixels -------------------------------------------------------------
const CH_ICON_PAL = { '.': null, y: '#f2cc6a', w: '#cfe0ff', d: '#7a8bb8' };
const CH_CROWN = ['........', 'y..yy..y', 'y.yyyy.y', 'yyyyyyyy', '.yyyyyy.', '........', '........', '........'];
const CH_SUN = ['...yy...', '.y....y.', '..yyyy..', 'y.yyyy.y', 'y.yyyy.y', '..yyyy..', '.y....y.', '...yy...'];
const CH_SWORDS = ['w.....w.', '.w...w..', '..w.w...', '...w....', '..w.w...', '.w...w..', 'd.....d.', '........'];
const CH_SKULL = ['..wwww..', '.wwwwww.', '.wdwwdw.', '.wwwwww.', '..wwww..', '..w.w...', '........', '........'];
const CH_FLAG = ['w.......', 'wyyyy...', 'wyyyyy..', 'wyyyy...', 'w.......', 'w.......', 'w.......', '........'];
const CH_PLUS = ['....yy....', '....yy....', '....yy....', '....yy....', 'yyyyyyyyyy', 'yyyyyyyyyy', '....yy....', '....yy....', '....yy....', '....yy....'];
const CH_QUILL = ['....hh', '...hh.', '..hh..', '.hh...', 'th....', 't.....'];
const CH_QUILL_PAL = { '.': null, h: '#9fb6d8', t: '#f2cc6a' };
const CH_QUILL_HOT = { '.': null, h: '#ffd95c', t: '#fff1c2' };
const CH_LOCK = ['.oooo.', 'o....o', 'o....o', 'oooooo', 'oooooo', 'oo..oo', 'oooooo'];
const CH_LOCK_PAL = { '.': null, o: '#8fa0c8' };
// the die's six faces: where the pips sit on a 3 x 3 lattice
const DIE_FACES = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
// the option rows' glyphs, 8 x 8, at the row's left: a figure, a drop, a
// comb, a palette, a beard, a face
const CH_ROW_GLYPH = {
  sex: ['...ww...', '...ww...', '..wwww..', '.w.ww.w.', '.w.ww.w.', '...ww...', '..w..w..', '..w..w..'],
  tone: ['...w....', '..www...', '..www...', '.wwwww..', '.wwwww..', '.wwwww..', '..www...', '........'],
  hair: ['.wwwwww.', 'wwwwwwww', 'w.w.w.w.', 'w.w.w.w.', 'w.w.w.w.', '........', '........', '........'],
  hairCol: ['..wwww..', '.w.w..w.', 'w.w....w', 'w......w', 'w..w...w', '.w....w.', '..wwww..', '........'],
  beard: ['w......w', 'w......w', 'ww....ww', '.ww..ww.', '.wwwwww.', '..wwww..', '...ww...', '........'],
  face: ['..wwww..', '.w....w.', 'w.w..w.w', 'w......w', 'w.w..w.w', 'w..ww..w', '.w....w.', '..wwww..'],
};

// a well: the this-is-a-button grammar shared by every plate here - a dark
// drop shadow, a slate rim that lightens under the hand and goes gold when
// picked, a navy floor
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
// the 48 px model, S px per pixel, on a pool of light with a gold ring
// turning on the snow (class select's stage grammar)
function drawModel(cls, look, team, x, y, S, now, a) {
  const cx = x + 24 * S, feet = y + 46 * S;
  ctx.globalAlpha = a * 0.4;
  ctx.fillStyle = '#04060f';
  ctx.beginPath(); ctx.ellipse(cx, feet, 18 * S / 3 + 6, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, feet - 20 * S / 3 * 2, 3, cx, feet - 40, 48 * S / 3 + 8);
  g.addColorStop(0, 'rgba(255,170,80,' + (0.14 * a).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 20, y - 20, 48 * S + 40, 48 * S + 40);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = a;
  ctx.fillStyle = '#c89a3c';
  const rr = 16 * S / 3 + 14;
  for (let k = 0; k < 24; k += 2) {
    const an = (k / 24) * Math.PI * 2 + now * 0.5;
    ctx.fillRect(cx + Math.round(Math.cos(an) * rr), feet + Math.round(Math.sin(an) * 6), 2, 1);
  }
  const bob = Math.round(Math.sin(now * 1.6)) ;
  ctx.drawImage(SPRITES.portrait(cls, look, team), x, y + bob, 48 * S, 48 * S);
}
// the six-row ledger under a roster card's name: icon, label, dotted leader,
// number (the character panel's labelled-row carve-out)
function drawLedger(x, y, w, st) {
  const grand = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, ',');
  const rows = [[CH_CROWN, 'WINS', st.wins, '#cfe0ff'], [CH_FLAG, 'MATCHES', st.matches, '#cfe0ff'],
    [CH_SWORDS, 'KILLS', st.kills, '#cfe0ff'], [CH_SKULL, 'DEATHS', st.deaths, '#cfe0ff'],
    [CH_SUN, 'DAYS', st.days, '#cfe0ff'], [null, 'GOLD', st.gold, '#f2cc6a']];
  for (let i = 0; i < rows.length; i++) {
    const ry = y + i * 10;
    if (rows[i][0]) stampGrid(rows[i][0], CH_ICON_PAL, x, ry - 1, 1);
    else ctx.drawImage(SPRITES.itemGold, x, ry - 1);
    drawPixelTextShadow(ctx, rows[i][1], x + 11, ry, '#7a8bb8', 'rgba(8,12,28,0.9)');
    const s = grand(rows[i][2]);
    const nx = x + w - pixelTextWidth(s);
    drawPixelTextShadow(ctx, s, nx, ry, rows[i][3], '#0a0e23');
    ctx.fillStyle = '#2c3a68';
    for (let dx = x + 11 + pixelTextWidth(rows[i][1]) + 4; dx < nx - 4; dx += 3) ctx.fillRect(dx, ry + 4, 1, 1);
  }
}

// One roster slot: the model at 2x on its light, the name in gold with the
// class emblem beside it, the ledger; the ACTIVE one wears the gold rim, a
// hovered one lifts. The quill bottom-right edits, the plate top-right
// deletes when held (its floor fills red as it goes). An empty slot is a
// dashed well with a plus in it.
function drawCharCard(c, now, a) {
  const m = state.menu;
  const ch = PROFILE.chars()[c.i];
  const hv = m.khover['card' + c.i] || m.khover['new' + c.i] || 0;
  const active = ch && c.i === PROFILE.activeIndex();
  const focus = c.i === m.ksel;
  ctx.globalAlpha = a;
  if (!ch) {
    ctx.fillStyle = 'rgba(4,6,18,0.4)';
    ctx.fillRect(c.x + 2, c.y + 2, c.w, c.h);
    ctx.fillStyle = hv > 0.5 || (focus && padActive()) ? '#8fa0c8' : '#2c3560';
    for (let d = 0; d < c.w; d += 6) { ctx.fillRect(c.x + d, c.y, 3, 1); ctx.fillRect(c.x + d, c.y + c.h - 1, 3, 1); }
    for (let d = 0; d < c.h; d += 6) { ctx.fillRect(c.x, c.y + d, 1, 3); ctx.fillRect(c.x + c.w - 1, c.y + d, 1, 3); }
    ctx.globalAlpha = a * (0.5 + hv * 0.5);
    stampGrid(CH_PLUS, CH_ICON_PAL, c.x + (c.w >> 1) - 10, c.y + (c.h >> 1) - 10, 2);
    ctx.globalAlpha = a;
    return;
  }
  const y = drawWell(c, hv, active, true);
  if (focus && padActive()) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(c.x, y + c.h - 2, c.w, 2); }
  drawModel(ch.cls, ch.look, skin(player.team), c.x + (c.w >> 1) - 48, y + 2, 2, now + c.i, a);
  const nm = ch.name;
  const nw = pixelTextWidth(nm) + 14;
  const nx = c.x + (c.w >> 1) - (nw >> 1);
  ctx.drawImage(classIcon12(ch.cls, true), nx, y + 104);
  drawPixelTextShadow(ctx, nm, nx + 14, y + 107, active ? '#ffd95c' : '#f4f7ff', '#0a0e23');
  ctx.fillStyle = '#2c3a68'; ctx.fillRect(c.x + 10, y + 117, c.w - 20, 1);
  drawLedger(c.x + 10, y + 122, c.w - 20, ch.stats);
  // the quill and the delete plate
  const qh = m.khover['quill' + c.i] || 0;
  stampGrid(CH_QUILL, qh > 0.5 ? CH_QUILL_HOT : CH_QUILL_PAL, c.quill.x + 3, c.quill.y + 2 - Math.round(qh), 1);
  // the X plate: slate at rest, red under the hand - a press deletes the slot
  const dh = m.khover['del' + c.i] || 0;
  ctx.fillStyle = dh > 0.5 ? '#c86a5a' : '#2c3560';
  ctx.fillRect(c.del.x, c.del.y, c.del.w, c.del.h);
  ctx.fillStyle = dh > 0.5 ? '#5a1e1e' : '#0f1632';
  ctx.fillRect(c.del.x + 1, c.del.y + 1, c.del.w - 2, c.del.h - 2);
  ctx.fillStyle = dh > 0.5 ? '#ffd0c0' : '#5a6690';
  for (let i = 0; i < 5; i++) { ctx.fillRect(c.del.x + 3 + i, c.del.y + 3 + i, 1, 1); ctx.fillRect(c.del.x + 7 - i, c.del.y + 3 + i, 1, 1); }
}
function renderChars(now, a) {
  const m = state.menu;
  const L = charsLayout();
  drawSelectBackdrop(now, a);
  const slide = Math.round((1 - a) * 26);
  for (const c of L.cards) drawCharCard({ x: c.x, y: c.y + slide, w: c.w, h: c.h, i: c.i, quill: { x: c.quill.x, y: c.quill.y + slide, w: c.quill.w, h: c.quill.h }, del: { x: c.del.x, y: c.del.y + slide, w: c.del.w, h: c.del.h } }, now, a);
  ctx.globalAlpha = a;
  drawBackHint(ctx, L.cx, L.back);
  ctx.globalAlpha = 1;
}

// one option cell: a well with a 1x crop of the bare model wearing that
// choice in it - the head for anything on the face, the torso for the body -
// so a row IS its choices, seen before they are picked. The picked cell is
// gold and sits a px up; a hovered one lifts under the hand.
function drawLookCell(c, spec, team, hv, picked) {
  const y = drawWell(c, hv, picked, true);
  const look = Object.assign({}, spec.look); look[c.axis] = c.v;
  const src = SPRITES.portrait(spec.cls, look, team, true);
  ctx.drawImage(src, c.crop.x, c.crop.y, c.w - 2, c.h - 2, c.x + 1, y + 1, c.w - 2, c.h - 2);
}
// the die: a well with a face of pips on it. At rest it shows five; under
// the hand it lifts and the pips go gold; for DIE_T after a press the face
// flickers through the six and the plate rattles - a roll, not a button.
function drawDie(r, hv, tumble, now) {
  const rattle = tumble > 0 ? Math.round(Math.sin(now * 70) * 2 * tumble) : 0;
  const rr = { x: r.x + rattle, y: r.y, w: r.w, h: r.h };
  const y = drawWell(rr, hv, false, true);
  const face = tumble > 0 ? DIE_FACES[Math.floor(now * 18) % 6] : DIE_FACES[4];
  ctx.fillStyle = tumble > 0 || hv > 0.5 ? '#ffd95c' : '#8fa0c8';
  const pip = Math.round(r.w / 9), st = Math.round(r.w / 4), o = Math.round((r.w - 2 * st - pip) / 2); // pips sized to the plate
  for (const k of face) ctx.fillRect(rr.x + o + (k % 3) * st, y + o + Math.floor(k / 3) * st, pip, pip);
}

// The create screen: the model at 3x on its stage with the in-world body on
// a snow pad beside its feet (what the snow will actually show), the name
// field under the stage; the option panel to the right - its head row the
// class pair (the unpicked emblem dark, and locked once the character
// exists) and, at the row's far end, the die that rolls the whole character,
// then a row per axis: its glyph in the gutter, and a cell per choice
// showing that choice on the model. DONE and CANCEL centred along the foot. The keyboard row breathes gold ticks at
// its glyph.
function renderCreate(now, a) {
  const m = state.menu, e = m.cedit;
  if (!e) return;
  const L = createLayout();
  const spec = e.spec, team = skin(player.team);
  drawSelectBackdrop(now, a);
  const slide = Math.round((1 - a) * 26);
  ctx.globalAlpha = a;
  drawModel(spec.cls, spec.look, team, L.stage.x - slide, L.stage.y, 3, now, a);
  // the 16 px body at 2x on a little snow pad: the in-world read
  const set = SPRITES.champLook(spec.cls, spec.look, team);
  ctx.fillStyle = '#e8eef8';
  ctx.beginPath(); ctx.ellipse(L.mini.x + 16 - slide, L.mini.y + 30, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(set.down[1 + (Math.floor(now * 4) % 2)], L.mini.x - slide, L.mini.y, 32, 32);
  // the name field: a well whose rim lights under the hand, the buffer at 2x
  // with the caret - or SELECTED, on a gold band, when the next letter will
  // replace it (a pre-rolled name, a rolled one, a click on the field) - the
  // capacity ticks under it, and the underline: slate while the name is
  // good, red while it would be refused; a refusal on DONE rattles and
  // floods it red.
  const f = { x: L.name.x - slide, y: L.name.y, w: L.name.w, h: L.name.h };
  const bad = m.nameShake / NAME_SHAKE_T;
  const shake = bad > 0 ? Math.round(Math.sin(now * 90) * 2.5 * bad) : 0;
  const nh = m.khover.name || 0;
  const ok = nameOk();
  ctx.fillStyle = nh > 0.5 ? '#8fa0c8' : '#2c3560'; ctx.fillRect(f.x - 1, f.y - 1, f.w + 2, f.h + 2);
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.fillStyle = ok || !m.nameBuf ? '#2c3a68' : '#a83a3a'; ctx.fillRect(f.x + 1, f.y + f.h - 2, f.w - 2, 2);
  if (bad > 0) { ctx.globalAlpha = a * 0.5 * bad; ctx.fillStyle = '#a83a3a'; ctx.fillRect(f.x, f.y, f.w, f.h); ctx.globalAlpha = a; }
  const txt = m.nameBuf;
  const tw = pixelTextWidth(txt, 2);
  const tx = f.x + Math.round((f.w - tw - 5) / 2) + shake, ty = f.y + 5;
  const sel = m.nameSel && txt;
  if (sel) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(tx - 2, ty - 2, tw + 4, 14); }
  drawPixelTextShadow(ctx, txt, tx, ty, sel ? '#0a0e23' : bad > 0 ? '#ffb0a0' : '#f4f7ff', sel ? '#c89a3c' : '#0a0e23', 2);
  if (!sel && Math.floor(now * 2) % 2 === 0) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(txt ? tx + tw + 2 : tx - 5, ty, 2, 10); }
  let kx = f.x + Math.round((f.w - (PROFILE.NAME_MAX * 4 - 1)) / 2);
  for (let i = 0; i < PROFILE.NAME_MAX; i++, kx += 4) { ctx.fillStyle = i < txt.length ? '#f2cc6a' : '#2c3a68'; ctx.fillRect(kx, f.y + f.h + 4, 3, 2); }

  // the option panel: the die at the head row's right end, then the rows
  drawDie({ x: L.die.x + slide, y: L.die.y, w: L.die.w, h: L.die.h }, m.khover.die || 0, m.dieT / DIE_T, now);
  for (let i = 0; i < L.rows.length; i++) {
    const r = L.rows[i];
    const rx = r.x + slide;
    if (r.kind !== 'cls') {
      stampGrid(CH_ROW_GLYPH[r.id], CH_ICON_PAL, rx - 14, r.y + 8, 1);
      if (m.crow === i && !mouse.inside) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(rx - 18, r.y + 8 + Math.round(Math.sin(now * 4) + 1), 2, 6); }
    }
    for (const c of rowCells(r)) {
      const hv = m.khover[c.id] || 0;
      const cr = Object.assign({}, c, { x: c.x + slide });
      if (c.axis === 'cls') {
        const locked = e.slot >= 0;
        const picked = spec.cls === c.v;
        ctx.globalAlpha = a * (picked ? 1 : locked ? 0.3 : 0.6 + hv * 0.4);
        const y = drawWell(cr, locked ? 0 : hv, picked, !locked);
        ctx.drawImage(classIcon32(c.v), cr.x + 2, y + 2);
        if (locked && !picked) stampGrid(CH_LOCK, CH_LOCK_PAL, cr.x + 15, y + 14, 1);
        ctx.globalAlpha = a;
      } else {
        drawLookCell(cr, spec, team, hv, spec.look[c.axis] === c.v);
      }
    }
  }

  // the planks: DONE dims while the name would be refused
  for (const p of L.planks) {
    const hv = m.khover[p.id] || 0;
    const live = p.id !== 'done' || ok;
    ctx.globalAlpha = a * (live ? 1 : 0.4);
    drawMenuButton({ x: p.x, y: p.y + slide, w: p.w, h: p.h }, p.id === 'done' ? 'DONE' : 'CANCEL', live ? hv : 0, now, live && m.pressT > 0 && hv > 0.5);
  }
  ctx.globalAlpha = 1;
}


// ---- the character tag --------------------------------------------------
// Bottom-left of the title, mirroring the patch tag on the right: the active
// character's in-world body beside its name and a quill that gilds on hover.
// Clicking it opens the roster - the body and the quill ARE the affordance.
function charTagRect() {
  return { x: 5, y: VIEW_H - 21, w: 18 + pixelTextWidth(PROFILE.name()) + 4 + 6, h: 18 };
}
function overCharTag() {
  const r = charTagRect();
  return mouse.x >= r.x - 3 && mouse.x < r.x + r.w + 3 && mouse.y >= r.y - 3 && mouse.y < r.y + r.h + 3;
}
function drawCharTag(now) {
  const hot = !state.menu.panel && overCharTag();
  const r = charTagRect();
  const nm = PROFILE.name();
  const set = classSet(player);
  ctx.drawImage(set.down[hot ? 1 + (Math.floor(now * 4) % 2) : 0], r.x, r.y + 1);
  drawPixelTextShadow(ctx, nm, r.x + 18, r.y + 12, hot ? '#ffd95c' : '#9fb6d8', 'rgba(15,22,50,0.9)');
  stampGrid(CH_QUILL, hot ? CH_QUILL_HOT : CH_QUILL_PAL, r.x + 18 + pixelTextWidth(nm) + 4, r.y + 12, 1);
  if (hot) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(r.x + 18, r.y + 19, r.w - 18, 1); }
}
