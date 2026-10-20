'use strict';
// ------------------------------------------------------------ death recap
// Why you went down, in the top-left corner of the replay of it (the `replay`
// banner, js/ui/screens.js), read the way League's is:
//
//   [-]  ( ring )  [>]     the ring: all the damage, split by kind, the total in it
//   [face] 51 ====   o o   one line per hitter, biggest first: its total over a
//   [face] 35 ===    o     bar split by kind, and the icons of what it hit with
//
// The face of the blow that put you down wears the gold rim. [-] folds the
// lines away (the ring alone), [>] opens them out (a pad's Y walks all three): each icon gets its own
// number under it and each hitter its name. Under the pointer, a face says
// who, an icon says what and how much, and the ring names its kinds - the
// words a new player needs, only when asked for.
//
// It shows only what the record kept (recapNote, js/sim/player.js), and the
// record is written as your side saw it: a rival out of sight when the blow
// landed is a `?` face with no icon (its kind still colours the bar - an
// arrow in you is an arrow you saw).

// ---- tuning --------------------------------------------------------------
const RC_X = 4, RC_Y = 4;     // the plate's corner, top left
const RC_W = 112, RC_W_OPEN = 152; // its width with the lines, and opened out
const RC_HEAD = 41;           // the ring's band
const RC_RING = 33, RC_RING_IN = 10.5; // the ring: odd-wide so it has a true centre, and its hole's radius
const RC_BTN = 11;            // a fold button's square
const RC_ROW = 20, RC_ROW_OPEN = 28; // a line, and an opened-out line (the numbers under its icons)
const RC_FACE = 18;           // the face's square, rim included
const RC_ICON = 16;           // an icon: a 32 px strip icon at half
const RC_ICONS = 3, RC_ICONS_OPEN = 4; // icons a line shows
const RC_BAR = 36, RC_BAR_H = 4;      // a hitter's bar
const RC_ROWS = 5;            // lines at most; the rest still count on the ring
// a blow's kind: its colour on the ring and the bars, and its word under the pointer
const RC_KIND = {
  atk: { col: '#e8dcb4', word: 'ATTACKS' },   // a basic attack: the bone of an arrow's shaft
  ab: { col: '#7fb2ff', word: 'ABILITIES' },  // a key
  other: { col: '#ff9440', word: 'OTHER' },   // a burn, a roll, the world's
};
const RC_KINDS = ['atk', 'ab', 'other'];
// the world's names, by cause, for the pointer
const RC_WORLD = { tower: 'TOWER', soldier: 'WAVE', wolf: 'WOLF', bear: 'BEAR', fire: 'FIRE',
  orca: 'ORCA', ice: 'ICE', creek: 'CREEK', tackle: 'A TACKLE', eagle: 'EAGLE' };
const RC_MOVE = { roll: 'ROLL' };
// 0 the ring alone, 1 the lines, 2 opened out: this screen's, kept across deaths
const recap = { view: 1 };

function rcKind(e) { return e.k === 'atk' || e.k === 'ab' ? e.k : 'other'; }

// ---- the read ------------------------------------------------------------
// The record grouped by hitter (one face per player, one `?` for everyone
// you did not see, one per cause of the world's), biggest first; inside
// each, what it hit with, biggest first; and the whole split by kind.
function recapRead(log) {
  const faces = new Map(), split = { atk: 0, ab: 0, other: 0 };
  let total = 0, lastFace = '';
  for (const e of log) {
    const kind = rcKind(e);
    const fk = e.by >= 0 ? 'p' + e.by : e.s === 0 ? '?' : 'w' + e.c;
    let f = faces.get(fk);
    if (!f) faces.set(fk, (f = { key: fk, e, d: 0, kinds: { atk: 0, ab: 0, other: 0 }, hits: new Map() }));
    const hk = e.k + ':' + (e.i !== undefined ? e.i + '.' + e.o : e.m || '');
    let h = f.hits.get(hk);
    if (!h) f.hits.set(hk, (h = { key: hk, e, d: 0, kind }));
    h.d += e.d; f.d += e.d; f.kinds[kind] += e.d; split[kind] += e.d; total += e.d;
    lastFace = fk;
  }
  const order = (a, b) => b.d - a.d || (a.key < b.key ? -1 : 1);
  const list = [...faces.values()].sort(order).slice(0, RC_ROWS);
  for (const f of list) f.hits = [...f.hits.values()].filter((h) => rcIcon(h.e)).sort(order);
  return { faces: list, split, total, lastFace };
}

// ---- the faces, the icons and their words ----------------------------------
// the world's faces, by its cause: the thing itself, standing (the wiki's own
// figures, js/ui/wiki.js); a cause with no body to show draws none
function rcWorldFig(c, team) {
  const rival = skin(1 - team);
  switch (c) {
    case 'tower': return towerFigure(rival);
    case 'soldier': return SPRITES.robotTeam[rival][0];
    case 'wolf': return SPRITES.wolf.right.idle[0];
    case 'bear': return SPRITES.alpha && SPRITES.alpha.right.idle[0];
    case 'fire': return SPRITES.fire[0];
    default: return null;
  }
}
// a square well and what stands in it, centred and clipped: the HUD
// portrait's dusk behind a hero's face (drawPortrait, js/ui/hud-draw.js)
function rcFace(x, y, f, gold, team) {
  const s = RC_FACE, e = f.e;
  ctx.fillStyle = SC_INK; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = gold ? '#c89a3c' : SC_EDGE; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  const ix = x + 2, iy = y + 2, is = s - 4;
  const q = e.by >= 0 ? players[e.by] : null;
  ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, is, is); ctx.clip();
  if (q) drawFace(ix, iy, is, q);
  else {
    ctx.fillStyle = SC_PLATE; ctx.fillRect(ix, iy, is, is);
    const fig = e.s === 0 ? null : rcWorldFig(e.c, team);
    // a tall figure shows its upper body: a tower's stone, a bear's head
    if (fig) ctx.drawImage(fig, ix + ((is - fig.width) >> 1), fig.height <= is ? iy + ((is - fig.height) >> 1) : iy - Math.round(Math.min(fig.height * 0.3, fig.height - is)));
    else drawPixelText(ctx, '?', ix + ((is - 5) >> 1), iy + ((is - 10) >> 1), SC_LBL, 2);
  }
  ctx.restore();
}
// what a blow was: the key's strip icon, the hero's weapon, the fire - or
// nothing (the world, and anyone you did not see)
function rcIcon(e) {
  if (e.by < 0) return null;
  if (e.k === 'ab' && e.i !== undefined) return classAbIcon(e.c, e.i, e.o);
  if (e.k === 'atk') { const C = CLASSES[e.c]; return C && SPRITES.weaponArt[C.attack.art]; }
  if (e.k === 'burn') return SPRITES.fire[0];
  return null;
}
function rcDrawIcon(icon, x, y) {
  ctx.fillStyle = SC_PLATE; ctx.fillRect(x, y, RC_ICON, RC_ICON);
  const big = icon.width > RC_ICON || icon.height > RC_ICON;
  const iw = big ? icon.width >> 1 : icon.width, ih = big ? icon.height >> 1 : icon.height;
  ctx.drawImage(icon, x + ((RC_ICON - iw) >> 1), y + ((RC_ICON - ih) >> 1), iw, ih);
}
function rcWho(e) {
  if (e.by >= 0) { const q = players[e.by]; return q ? q.name || CLASSES[q.cls].name : '?'; }
  return e.s === 0 ? '?' : RC_WORLD[e.c] || '?';
}
function rcWhat(e) {
  if (e.k === 'ab' && e.i !== undefined) { const o = abOptions(e.c, e.i)[e.o]; return o ? o.name : '?'; }
  if (e.k === 'atk') { const C = CLASSES[e.c]; return C ? C.attack.name : '?'; }
  if (e.k === 'burn') return 'BURN';
  return RC_MOVE[e.m] || '?';
}
function rcWhoCol(e) { const q = e.by >= 0 ? players[e.by] : null; return q ? TEAMS[skin(q.team)].mark : SC_TXT; }

// ---- the ring ----------------------------------------------------------------
// One pixel at a time round a true centre, so its steps mirror on both axes;
// each px takes the kind whose stretch of the turn (clockwise from the top)
// it falls in. Baked once per split.
let rcRingCv = null, rcRingKey = '';
function rcRing(split, total) {
  const key = RC_KINDS.map((k) => split[k]).join(',');
  if (rcRingCv && key === rcRingKey) return rcRingCv;
  const s = RC_RING, c = s / 2, ro = c, ri = RC_RING_IN;
  const cv = rcRingCv || document.createElement('canvas'), g = cv.getContext('2d');
  cv.width = cv.height = s;
  g.clearRect(0, 0, s, s);
  const ends = []; let acc = 0;
  for (const k of RC_KINDS) { acc += split[k] / (total || 1); ends.push([acc, RC_KIND[k].col]); }
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
      if (d > ro || d < ri) continue;
      let u = Math.atan2(dx, -dy) / (Math.PI * 2); if (u < 0) u += 1;
      const edge = d > ro - 1 || d < ri + 1;
      let col = SC_EDGE;
      for (const [end, kc] of ends) if (u < end - 1e-9) { col = kc; break; }
      g.fillStyle = edge ? SC_INK : col;
      g.fillRect(x, y, 1, 1);
    }
  }
  rcRingCv = cv; rcRingKey = key;
  return cv;
}

// ---- the layout ----------------------------------------------------------------
// every rect the plate draws and the pointer can land on, for this view
function recapLayout(R) {
  const v = recap.view, w = v === 2 ? RC_W_OPEN : RC_W, rh = v === 2 ? RC_ROW_OPEN : RC_ROW;
  const x = RC_X, y = RC_Y, n = v ? R.faces.length : 0;
  const L = {
    x, y, w, h: RC_HEAD + (n ? 2 + n * rh : 0),
    fold: { x: x + 3, y: y + 3, w: RC_BTN, h: RC_BTN },
    open: { x: x + w - 3 - RC_BTN, y: y + 3, w: RC_BTN, h: RC_BTN },
    ring: { x: x + ((w - RC_RING) >> 1), y: y + 4, w: RC_RING, h: RC_RING },
    rows: [],
  };
  const nIcons = v === 2 ? RC_ICONS_OPEN : RC_ICONS;
  for (let i = 0; i < n; i++) {
    const f = R.faces[i], ry = y + RC_HEAD + 2 + i * rh;
    const row = { f, y: ry, face: { x: x + 4, y: ry, w: RC_FACE, h: RC_FACE }, icons: [] };
    // right-aligned, biggest first reading left to right
    const hs = f.hits.slice(0, nIcons), ix0 = x + w - 4 - hs.length * (RC_ICON + 2) + 2;
    hs.forEach((h, j) => row.icons.push({ h, x: ix0 + j * (RC_ICON + 2), y: ry + 1, w: RC_ICON, h2: RC_ICON }));
    L.rows.push(row);
  }
  return L;
}
function rcIn(r, h) { return mouse.x >= r.x && mouse.x < r.x + r.w && mouse.y >= r.y && mouse.y < r.y + (h || r.h); }
// what the pointer is on: a button, the ring, a face or an icon
function recapHover(L) {
  if (!rcIn(L)) return null;
  if (rcIn(L.fold)) return { btn: 'fold' };
  if (rcIn(L.open)) return { btn: 'open' };
  if (rcIn(L.ring)) return { ring: true };
  for (const row of L.rows) {
    if (rcIn(row.face)) return { face: row.f, y: row.y };
    for (const ic of row.icons) if (rcIn(ic, ic.h2)) return { hit: ic.h, y: ic.y };
  }
  return null;
}
function recapLive() { return replayFull() && player.deathLog && player.deathLog.length > 0; }
// the pointer over a button: the cursor's hand (render.js)
function recapHot() {
  if (!recapLive()) return false;
  const h = recapHover(recapLayout(recapRead(player.deathLog)));
  return !!(h && h.btn);
}
// a press on the plate: [-] folds the lines away or back, [>] opens them
// out or back
function recapClick() {
  if (!recapLive()) return false;
  const h = recapHover(recapLayout(recapRead(player.deathLog)));
  if (!h || !h.btn) return false;
  if (h.btn === 'fold') recap.view = recap.view ? 0 : 1;
  else recap.view = recap.view === 2 ? 1 : 2;
  SFX.pickup();
  return true;
}
// a pad's Y (padPress, js/app/gamepad.js): the lines, opened out, the ring
// alone, and round again
function recapCycle() {
  if (!recapLive()) return false;
  recap.view = recap.view === 1 ? 2 : recap.view === 2 ? 0 : 1;
  SFX.pickup();
  return true;
}

// ---- the drawing ---------------------------------------------------------------
// a fold button: a flat square with its glyph, lit gold under the pointer
function rcButton(r, glyph, hot) {
  ctx.fillStyle = SC_INK; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = hot ? '#2a2d33' : SC_PLATE; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.fillStyle = hot ? '#ffd95c' : SC_LBL;
  const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
  if (glyph === '-' || glyph === '+') { ctx.fillRect(cx - 2, cy, 5, 1); if (glyph === '+') ctx.fillRect(cx, cy - 2, 1, 5); }
  else for (let i = 0; i < 3; i++) { const d = glyph === '>' ? i : 2 - i; ctx.fillRect(cx - 1 + d, cy - 2 + i, 1, 1); if (i < 2) ctx.fillRect(cx - 1 + d, cy + 2 - i, 1, 1); }
}
// a small graphite tag beside the plate: the words under the pointer
function rcTag(lines, y) {
  const w = Math.max(...lines.map((l) => pixelTextWidth(l[0], 1))) + 8, h = lines.length * 8 + 5;
  const x = RC_X + (recap.view === 2 ? RC_W_OPEN : RC_W) + 3;
  ctx.fillStyle = SC_INK; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = SC_PLATE; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  lines.forEach((l, i) => drawPixelText(ctx, l[0], x + 4, y + 4 + i * 8, l[1], 1));
}
function drawRecap() {
  if (!recapLive()) return;
  const R = recapRead(player.deathLog), L = recapLayout(R), H = recapHover(L), v = recap.view;
  ctx.fillStyle = SC_INK; ctx.fillRect(L.x - 1, L.y - 1, L.w + 2, L.h + 2);
  ctx.fillStyle = SC_BG; ctx.fillRect(L.x, L.y, L.w, L.h);
  ctx.fillStyle = SC_EDGE; ctx.fillRect(L.x, L.y, L.w, 1);
  // the ring and the total in its hole
  ctx.drawImage(rcRing(R.split, R.total), L.ring.x, L.ring.y);
  const t = String(Math.round(R.total));
  drawPixelText(ctx, t, L.ring.x + ((RC_RING - pixelTextWidth(t, 1)) >> 1), L.ring.y + ((RC_RING - 5) >> 1), SC_LIT, 1);
  rcButton(L.fold, v ? '-' : '+', H && H.btn === 'fold');
  rcButton(L.open, v === 2 ? '<' : '>', H && H.btn === 'open');
  if (padActive()) drawPadBind(ctx, L.open.x - padBindW('recap') - 3, L.open.y + 1, 'recap', 1); // the pad's way through the views
  if (L.rows.length) { ctx.fillStyle = SC_EDGE; ctx.fillRect(L.x + 4, L.y + RC_HEAD, L.w - 8, 1); }
  const top = R.faces.length ? R.faces[0].d : 1;
  for (const row of L.rows) {
    const f = row.f, y = row.y, tx = L.x + 4 + RC_FACE + 4;
    rcFace(row.face.x, y, f, f.key === R.lastFace, player.team);
    // the total, the name when opened out, and the bar split by kind
    const num = String(Math.round(f.d));
    drawPixelText(ctx, num, tx, y + 2, SC_LIT, 1);
    if (v === 2) drawPixelText(ctx, rcWho(f.e), tx + pixelTextWidth(num, 1) + 4, y + 2, rcWhoCol(f.e), 1);
    const by = y + 10;
    ctx.fillStyle = SC_PLATE; ctx.fillRect(tx, by, RC_BAR, RC_BAR_H);
    let bx = tx;
    const len = Math.max(2, Math.round(RC_BAR * f.d / top));
    for (const k of RC_KINDS) {
      if (!f.kinds[k]) continue;
      const bw = Math.max(1, Math.round(len * f.kinds[k] / f.d));
      ctx.fillStyle = RC_KIND[k].col; ctx.fillRect(bx, by, Math.min(bw, tx + len - bx), RC_BAR_H);
      bx += bw;
    }
    for (const ic of row.icons) {
      rcDrawIcon(rcIcon(ic.h.e), ic.x, ic.y);
      if (v === 2) {
        const n = String(Math.round(ic.h.d));
        drawPixelText(ctx, n, ic.x + ((RC_ICON - pixelTextWidth(n, 1)) >> 1), ic.y + RC_ICON + 2, RC_KIND[ic.h.kind].col, 1);
      }
    }
  }
  // the words, only under the pointer
  if (!H) return;
  if (H.ring) rcTag(RC_KINDS.filter((k) => R.split[k] > 0).map((k) => [RC_KIND[k].word + ' ' + Math.round(R.split[k]), RC_KIND[k].col]), L.ring.y);
  else if (H.face) rcTag([[rcWho(H.face.e), rcWhoCol(H.face.e)]], H.y);
  else if (H.hit) rcTag([[rcWhat(H.hit.e), SC_LIT], [String(Math.round(H.hit.d)), RC_KIND[H.hit.kind].col]], H.y);
}
