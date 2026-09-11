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
// sentence: the model IS the preview, a swatch is a colour, a chevron cycles
// a row, the class is the emblem, the delete plate fills while it is held.
// Text is the name, the ledger's labels (the character panel carve-out) and
// the two planks.

// ---- layout -------------------------------------------------------------
const CH_CARD_W = 120, CH_CARD_H = 184, CH_CARD_GAP = 16; // a roster slot
const CH_STAGE = 144;      // the create screen's model, the 48 px portrait at 3x
const CH_ROW_P = 22;       // the option rows' pitch
const CH_SW = 12;          // a swatch's side
const CH_NAME_W = 176, CH_NAME_H = 20;
const CH_BW = 88, CH_BH = 20, CH_BGAP = 12;
const CH_DEL_T = 0.8;      // s the delete plate is held before a slot goes
const NAME_SHAKE_T = 0.3;  // the name field's refusal: it rattles and flushes red
// the create screen's rows, in keyboard order: the axis they turn and what
// the row is made of. `cls` is the class pair, only live for a new character.
const CH_ROWS = [
  { id: 'cls', kind: 'cls' },
  { id: 'sex', kind: 'sex' },
  { id: 'tone', kind: 'swatch' },
  { id: 'hair', kind: 'cycle' },
  { id: 'hairCol', kind: 'swatch' },
  { id: 'beard', kind: 'cycle' },
  { id: 'face', kind: 'cycle' },
];

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
// the create screen: the model on its stage left, the class pair over the
// option column right, the name under the stage, the planks along the foot
function createLayout() {
  const toy = frameTop();
  const cx = Math.round(VIEW_W / 2);
  const stage = { x: cx - 264, y: toy + 24, w: CH_STAGE, h: CH_STAGE };
  const mini = { x: stage.x + stage.w + 10, y: stage.y + stage.h - 40, w: 32, h: 32 }; // the in-world body, 2x
  const name = { x: stage.x - 8, y: stage.y + stage.h + 18, w: CH_NAME_W, h: CH_NAME_H };
  const x0 = cx - 40; // the option column's left edge (its glyphs sit 14 px left of it)
  // the class pair heads the column (a 36 px row), the six look rows follow
  const rows = CH_ROWS.map((r, i) => ({ id: r.id, kind: r.kind, x: x0, y: i ? toy + 76 + (i - 1) * CH_ROW_P : toy + 28, w: 220, h: i ? 20 : 36 }));
  const shuffle = { x: x0 + 96, y: toy + 35, w: 24, h: 22 };
  const planks = [];
  const first = state.menu.cedit && state.menu.cedit.first;
  const pw = first ? CH_BW : CH_BW * 2 + CH_BGAP;
  const px = cx + 60 - Math.round(pw / 2), py = toy + 212;
  planks.push({ x: px, y: py, w: CH_BW, h: CH_BH, id: 'done' });
  if (!first) planks.push({ x: px + CH_BW + CH_BGAP, y: py, w: CH_BW, h: CH_BH, id: 'cancel' });
  return { toy, cx, stage, mini, name, rows, shuffle, planks };
}
// the cells of one option row, each with a hit id and the value it sets
function rowCells(r) {
  const N = PROFILE.LOOK_N, out = [];
  if (r.kind === 'sex') {
    for (let v = 0; v < N.sex; v++) out.push({ id: 'sex' + v, x: r.x + v * 24, y: r.y, w: 18, h: 20, axis: 'sex', v });
  } else if (r.kind === 'swatch') {
    for (let v = 0; v < N[r.id]; v++) out.push({ id: r.id + v, x: r.x + v * (CH_SW + 5), y: r.y + 4, w: CH_SW, h: CH_SW, axis: r.id, v });
  } else if (r.kind === 'cycle') {
    const n = N[r.id];
    out.push({ id: r.id + 'L', x: r.x, y: r.y + 2, w: 12, h: 16, axis: r.id, step: -1 });
    out.push({ id: r.id + 'R', x: r.x + 24 + n * 8, y: r.y + 2, w: 12, h: 16, axis: r.id, step: 1 });
  } else if (r.kind === 'cls') {
    for (let v = 0; v < CLASSES.length; v++) out.push({ id: 'cls' + v, x: r.x + v * 42, y: r.y, w: 36, h: 36, axis: 'cls', v });
  }
  return out;
}
const overRect = (r, px, py) => mouse.x >= r.x - (px || 0) && mouse.x < r.x + r.w + (px || 0) && mouse.y >= r.y - (py || 0) && mouse.y < r.y + r.h + (py || 0);

// ---- the roster ---------------------------------------------------------
function beginChars() {
  const m = state.menu;
  m.screen = m.cscreen = 'chars';
  m.ksel = PROFILE.activeIndex();
  m.delHold = 0;
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
  // 'del' is a HOLD, not a click: updateChars fills it while the button stays down
}
// the delete plate fills while the button is held over it, and the slot goes
// at full; letting go early lets it drain - nothing is ever lost to a click
function updateChars(dt) {
  const m = state.menu;
  const h = m.charT >= 1 && mouse.down ? charsHit() : null;
  if (h && h.kind === 'del' && h.i === m.ksel) {
    m.delHold += dt / CH_DEL_T;
    if (m.delHold >= 1) {
      m.delHold = 0;
      PROFILE.deleteChar(h.i);
      applyCharacter();
      m.ksel = Math.min(m.ksel, Math.max(0, PROFILE.chars().length - 1));
      SFX.break_();
      if (!PROFILE.hasChar()) beginCreate(-1, true); // the last one gone: back to the start
    }
  } else if (h && h.kind === 'del') m.ksel = h.i;
  else m.delHold = Math.max(0, m.delHold - dt * 3);
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
  m.nameShake = 0;
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
function shuffleLook() {
  const e = state.menu.cedit;
  if (!e) return;
  e.spec.look = PROFILE.rollChar(e.spec.cls).look;
  SFX.dodge();
}
// what the pointer is on: a cell's id, 'shuffle', 'done', 'cancel', or null
function createHit() {
  const L = createLayout();
  for (const r of L.rows) for (const c of rowCells(r)) if (overRect(c, 1, 1)) return c.id;
  if (overRect(L.shuffle, 2, 2)) return 'shuffle';
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
    if (m.nameBuf) { m.nameBuf = m.nameBuf.slice(0, -1); SFX.tally(); }
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
  if (h === 'shuffle') { shuffleLook(); return; }
  const c = createCellById(h);
  if (!c) return;
  m.crow = CH_ROWS.findIndex((r) => r.id === c.axis);
  if (c.step) cycleLook(c.axis, c.step);
  else setLook(c.axis, c.v);
}
function updateCreate(dt) {
  const m = state.menu;
  if (m.nameShake > 0) m.nameShake = Math.max(0, m.nameShake - dt);
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
const CH_SHUFFLE = ['w........w', '.w......w.', '..w....w..', '...w..w...', '....ww....', '....ww....', '...w..w...', '..w....w..', '.w......w.', 'w........w'];
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
const CH_MALE = ['..wwww..', '.wwwwww.', '.wwwwww.', '..wwww..', '.wwwwww.', 'wwwwwwww', 'wwwwwwww', 'w.wwww.w', '..wwww..', '..wwww..', '..ww.ww.', '..ww.ww.'];
const CH_FEMALE = ['..wwww..', '.wwwwww.', '.wwwwww.', '..wwww..', '..wwww..', '.wwwwww.', '.wwwwww.', '..wwww..', '.wwwwww.', 'wwwwwwww', '..ww.ww.', '..ww.ww.'];

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
function drawChevron(x, y, dir, hot) {
  ctx.fillStyle = hot ? '#ffd95c' : '#8fa0c8';
  for (let i = 0; i < 5; i++) {
    const d = i < 3 ? i : 4 - i;
    ctx.fillRect(x + (dir < 0 ? 4 - d : d), y + i * 2, 2, 2);
  }
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
  const dh = m.khover['del' + c.i] || 0;
  const hold = focus ? m.delHold : 0;
  ctx.fillStyle = dh > 0.5 ? '#c86a5a' : '#2c3560';
  ctx.fillRect(c.del.x, c.del.y, c.del.w, c.del.h);
  ctx.fillStyle = '#0f1632';
  ctx.fillRect(c.del.x + 1, c.del.y + 1, c.del.w - 2, c.del.h - 2);
  if (hold > 0) { ctx.fillStyle = '#a83a3a'; ctx.fillRect(c.del.x + 1, c.del.y + c.del.h - 1 - Math.round((c.del.h - 2) * hold), c.del.w - 2, Math.round((c.del.h - 2) * hold)); }
  ctx.fillStyle = dh > 0.5 || hold > 0 ? '#ffd0c0' : '#5a6690';
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

// The create screen: the model at 3x on its stage, the in-world body walking
// beside it (what the snow will actually show), the name field under them;
// the option rows down the right - a row's glyph, then its swatches, its
// silhouettes, or a chevron pair around the count's pips - the class pair
// under the rows (the unpicked emblem dark, and locked once the character
// exists), the shuffle plate, and the planks along the foot. The keyboard row
// breathes gold ticks at its glyph.
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
  // the name field: a well, the buffer at 2x with the caret, the capacity
  // ticks under it, a refusal flooding it red
  const f = { x: L.name.x - slide, y: L.name.y, w: L.name.w, h: L.name.h };
  const bad = m.nameShake / NAME_SHAKE_T;
  const shake = bad > 0 ? Math.round(Math.sin(now * 90) * 2.5 * bad) : 0;
  ctx.fillStyle = '#080c1c'; ctx.fillRect(f.x - 1, f.y - 1, f.w + 2, f.h + 2);
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.fillStyle = '#2c3a68'; ctx.fillRect(f.x + 1, f.y + f.h - 1, f.w - 2, 1);
  if (bad > 0) { ctx.globalAlpha = a * 0.5 * bad; ctx.fillStyle = '#a83a3a'; ctx.fillRect(f.x, f.y, f.w, f.h); ctx.globalAlpha = a; }
  const txt = m.nameBuf;
  const tw = pixelTextWidth(txt, 2);
  const tx = f.x + Math.round((f.w - tw - 5) / 2) + shake, ty = f.y + 5;
  drawPixelTextShadow(ctx, txt, tx, ty, bad > 0 ? '#ffb0a0' : '#f4f7ff', '#0a0e23', 2);
  if (Math.floor(now * 2) % 2 === 0) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(txt ? tx + tw + 2 : tx - 5, ty, 2, 10); }
  let kx = f.x + Math.round((f.w - (PROFILE.NAME_MAX * 4 - 1)) / 2);
  for (let i = 0; i < PROFILE.NAME_MAX; i++, kx += 4) { ctx.fillStyle = i < txt.length ? '#f2cc6a' : '#2c3a68'; ctx.fillRect(kx, f.y + f.h + 4, 3, 2); }

  // the option rows
  const hot = m.charT >= 1 ? createHit() : null;
  for (let i = 0; i < L.rows.length; i++) {
    const r = L.rows[i];
    const rx = r.x + slide;
    if (r.kind !== 'cls') {
      stampGrid(CH_ROW_GLYPH[r.id], CH_ICON_PAL, rx - 16, r.y + 6, 1);
      if (m.crow === i && !mouse.inside) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(rx - 20, r.y + 6 + Math.round(Math.sin(now * 4) + 1), 2, 6); }
    }
    for (const c of rowCells(r)) {
      const hv = m.khover[c.id] || 0;
      const cr = { x: c.x + slide, y: c.y, w: c.w, h: c.h };
      if (c.axis === 'sex') {
        const y = drawWell(cr, hv, spec.look.sex === c.v, true);
        stampGrid(c.v ? CH_FEMALE : CH_MALE, { '.': null, w: spec.look.sex === c.v ? '#ffd95c' : hv > 0.5 ? '#f4f7ff' : '#8fa0c8' }, cr.x + 5, y + 4, 1);
      } else if (c.axis === 'cls') {
        const locked = e.slot >= 0;
        const picked = spec.cls === c.v;
        ctx.globalAlpha = a * (picked ? 1 : locked ? 0.3 : 0.6 + hv * 0.4);
        const y = drawWell(cr, locked ? 0 : hv, picked, !locked);
        ctx.drawImage(classIcon32(c.v), cr.x + 2, y + 2);
        if (locked && !picked) stampGrid(CH_LOCK, CH_LOCK_PAL, cr.x + 15, y + 14, 1);
        ctx.globalAlpha = a;
      } else if (c.step) {
        drawChevron(cr.x + 3, cr.y + 3, c.step, hv > 0.5);
      } else {
        // a swatch: the tone's skin or the hair colour, the picked one gold-rimmed and lifted
        const picked = spec.look[c.axis] === c.v;
        const y = cr.y - (picked ? 1 : Math.round(hv));
        ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(cr.x + 1, cr.y + 1, cr.w, cr.h);
        ctx.fillStyle = picked ? '#ffd95c' : hv > 0.5 ? '#f4f7ff' : '#2c3560';
        ctx.fillRect(cr.x, y, cr.w, cr.h);
        const col = c.axis === 'tone' ? SPRITES.LOOK.tones[c.v] : SPRITES.LOOK.hairCols[c.v];
        ctx.fillStyle = col[0]; ctx.fillRect(cr.x + 1, y + 1, cr.w - 2, cr.h - 2);
        ctx.fillStyle = col[1]; ctx.fillRect(cr.x + 1, y + cr.h - 4, cr.w - 2, 3);
      }
    }
    if (r.kind === 'cycle') { // the pips between the chevrons: which of the row's choices is on
      const n = PROFILE.LOOK_N[r.id], v = spec.look[r.id];
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = k === v ? '#ffd95c' : '#35426e';
        ctx.fillRect(rx + 18 + k * 8, r.y + 9, 4, 3);
      }
    }
  }
  // the shuffle plate: two crossing arrows, a new look each press
  const sh = m.khover.shuffle || 0;
  const sy = drawWell({ x: L.shuffle.x + slide, y: L.shuffle.y, w: L.shuffle.w, h: L.shuffle.h }, sh, false, true);
  stampGrid(CH_SHUFFLE, { '.': null, w: sh > 0.5 ? '#ffd95c' : '#8fa0c8' }, L.shuffle.x + slide + 7, sy + 6, 1);

  // the planks: DONE dims while the name would be refused
  const ok = nameOk();
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
