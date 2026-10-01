'use strict';
// The bot ladder screen: the title's BOT LADDER word opens the standings of
// the offline ladder (app/ladder/, docs/bots/ladder.md) and puts a ladder bot
// on the rival side of a solo match.
// ------------------------------------------------------------ bot ladder
// The ladder runs outside the game (node app/ladder/ladder.js run) and leaves
// ladder-data/standings.js beside index.html: `window.LADDER_DATA = { rows,
// bots }`, rows its standings (core.standings) and bots the source of every
// entered file. The game never fetches, so the file is loaded as a script,
// again each time the screen opens (a run between opens shows); a missing
// file is a ladder with no matches, and every bot BOT_LIB holds still lists
// at the starting rating.
//
// The screen is the list on the left, a row per bot, best first: rank, name,
// a steel bar of its rating against the field, its last five results as
// chips. The row picked opens its card on the right: name, author, rating
// and its last move, the trend, the record as one W/D/L bar, a win-share bar
// against each rival, and FIGHT, which takes it to the lobby with that bot
// on the rival side (ladderFoe; the lobby's target names it). The drop seats
// it in all five rival seats (ladderSeat) - the ladder's own rule, one file
// playing a whole side - so a save keeps it as each seat's p.botId.
const LAD_ROW_H = 20, LAD_ROW_GAP = 3;
const LAD_LIST_W = 300, LAD_CARD_W = 236, LAD_GAP = 12;
const LAD_ROWS_MAX = 9;            // rows shown; the keys scroll past them
const LAD_START = 1000;            // the rating a bot with no games shows (RATING_START, app/ladder/core.js)
const LAD_WIN = '#6fd08c', LAD_DRAW = '#7d88a8', LAD_LOSS = '#e0806a';
const LAD_FORM = { W: LAD_WIN, D: LAD_DRAW, L: LAD_LOSS };

let ladderFoe = null;  // the BOT_LIB id the next solo drop seats on the rival side, or null
let ladderRows = [];   // the screen's rows, best first (ladderTake)
let ladderGames = 0;   // matches the loaded ladder has played

// ---- the data -------------------------------------------------------------------
// load (or reload) ladder-data/standings.js, then rebuild the rows
function ladderLoad() {
  const s = document.createElement('script');
  s.src = 'ladder-data/standings.js?' + Date.now();
  s.onload = s.onerror = () => { s.remove(); ladderTake(); };
  document.head.appendChild(s);
}
function ladderTake() {
  const D = window.LADDER_DATA && typeof window.LADDER_DATA === 'object' ? window.LADDER_DATA : null;
  if (D && D.bots) for (const id of Object.keys(D.bots)) if (!BOT_LIB.has(id) && typeof D.bots[id] === 'string') botLibAdd(id, D.bots[id]);
  const rows = (D && Array.isArray(D.rows) ? D.rows : []).filter((r) => r && !r.retired && typeof r.id === 'string');
  const have = new Set(rows.map((r) => r.id));
  // the bots the game holds that the ladder has not met: listed at the start
  for (const b of BOT_LIB.values()) if (!have.has(b.id)) rows.push({ id: b.id, name: b.name, rating: LAD_START, games: 0, w: 0, l: 0, d: 0, trail: [], form: [], vs: {} });
  for (const r of rows) {
    const src = BOT_LIB.has(r.id) ? BOT_LIB.get(r.id).src : '';
    const au = /author\s*:\s*['"`]([^'"`]{1,40})['"`]/.exec(src);
    r.author = r.author || (au ? au[1] : '');
    r.name = String(r.name || r.id).toUpperCase();
  }
  rows.sort((x, y) => y.rating - x.rating || y.games - x.games);
  ladderRows = rows;
  ladderGames = 0;
  for (const r of rows) ladderGames += r.games || 0;
  ladderGames = Math.round(ladderGames / 2); // two entries play each match
  const m = state.menu;
  m.ldSel = Math.max(0, Math.min(rows.length - 1, m.ldSel | 0));
}
function ladderName(id) {
  const r = ladderRows.find((q) => q.id === id);
  return r ? r.name : BOT_LIB.has(id) ? String(BOT_LIB.get(id).name).toUpperCase() : String(id).toUpperCase();
}

// ---- the match --------------------------------------------------------------------
// the drop (beginDrop, js/boot.js): every rival seat a bot plays runs the foe
function ladderSeat() {
  const id = ladderFoe;
  ladderFoe = null;
  if (!id || NET.role !== 'solo' || !BOT_LIB.has(id)) return;
  for (const p of players) if (p.team !== player.team && p.control === 'ai') botAssign(p, id);
}

// ---- the screen ---------------------------------------------------------------------
function beginLadder() {
  const m = state.menu;
  m.screen = 'ladder';
  m.ldHover = {};
  m.ldTop = 0;
  ladderTake();
  ladderLoad();
  SFX.place();
  SFX.music.play('lobby');
}
function leaveLadder() {
  state.menu.screen = 'menu';
  SFX.pickup();
  SFX.music.play('intro');
}
function ladderLayout() {
  const toy = frameTop();
  const w = LAD_LIST_W + LAD_GAP + LAD_CARD_W;
  const x0 = Math.round((VIEW_W - w) / 2), head = toy + 12, y0 = toy + 32;
  const m = state.menu;
  const rows = [];
  const n = Math.min(LAD_ROWS_MAX, ladderRows.length);
  for (let k = 0; k < n; k++) rows.push({ x: x0, y: y0 + k * (LAD_ROW_H + LAD_ROW_GAP), w: LAD_LIST_W, h: LAD_ROW_H, i: (m.ldTop | 0) + k });
  const card = { x: x0 + LAD_LIST_W + LAD_GAP, y: y0, w: LAD_CARD_W, h: LAD_ROWS_MAX * (LAD_ROW_H + LAD_ROW_GAP) - LAD_ROW_GAP };
  const fw = pixelTextWidth('FIGHT', 2) + 8;
  const fight = { x: card.x + Math.round((card.w - fw) / 2), y: card.y + card.h - 26, w: fw, h: 18 };
  return { toy, x0, x1: x0 + w, head, rows, card, fight, back: card.y + card.h + 14, cx: Math.round(VIEW_W / 2) };
}
// what the pointer is on: { kind: 'row', i } | { kind: 'fight' } | null
function ladderHit() {
  const L = ladderLayout();
  for (const r of L.rows) if (overRect(r)) return { kind: 'row', i: r.i };
  if (overRect(L.fight, 4, 3) && ladderRows[state.menu.ldSel]) return { kind: 'fight' };
  return null;
}
function ladderPick(i) {
  const m = state.menu;
  const n = ladderRows.length;
  if (!n) return;
  i = Math.max(0, Math.min(n - 1, i));
  if (i === m.ldSel) return;
  m.ldSel = i;
  if (i < m.ldTop) m.ldTop = i;
  if (i >= m.ldTop + LAD_ROWS_MAX) m.ldTop = i - LAD_ROWS_MAX + 1;
  SFX.pickup();
}
// FIGHT: to the lobby, the picked bot on the rival side
function ladderFight() {
  const r = ladderRows[state.menu.ldSel];
  if (!r || !BOT_LIB.has(r.id)) { SFX.deny(); return; }
  ladderFoe = r.id;
  state.menu.screen = 'menu';
  beginLobby();
}
function ladderKey(k) {
  const m = state.menu;
  if (k === 'escape' || k === 'backspace') { leaveLadder(); return; }
  const d = moveDir(k);
  if (d === 'up') ladderPick(m.ldSel - 1);
  else if (d === 'down') ladderPick(m.ldSel + 1);
  else if (k === 'enter' || k === ' ') ladderFight();
}
function ladderClick() {
  const m = state.menu;
  if ((m.ladT || 0) < 1) return;
  const h = ladderHit();
  if (!h) return;
  if (h.kind === 'fight') ladderFight();
  else ladderPick(h.i);
}
// the screen's ease and hovers: called every title frame (updateTitle)
function updateLadder(dt) {
  const m = state.menu;
  m.ladT = Math.max(0, Math.min(1, (m.ladT || 0) + (m.screen === 'ladder' ? 1 : -1) * dt / 0.35));
  if (m.screen !== 'ladder') return;
  if (!m.ldHover) m.ldHover = {};
  const h = m.ladT >= 1 && mouse.inside ? ladderHit() : null;
  const want = h ? (h.kind === 'row' ? 'row' + h.i : 'fight') : '';
  if (want && m.ldHover[want] === undefined) m.ldHover[want] = 0;
  for (const k of Object.keys(m.ldHover)) m.ldHover[k] += ((want === k ? 1 : 0) - m.ldHover[k]) * Math.min(1, dt * 14);
}
function ladderCursor() {
  const m = state.menu;
  return { kind: m.ladT >= 1 && ladderHit() ? 'hand' : 'arrow' };
}

// ---- the pixels -------------------------------------------------------------------------
// a well: a slate rim (steel when lit) round the night's ink
function ladWell(x, y, w, h, rim) {
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = rim; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#0f1632'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}
// the last results, oldest first, as small chips
function ladForm(form, x, y) {
  for (let k = 0; k < 5; k++) {
    const f = form[form.length - 5 + k];
    ctx.fillStyle = f ? LAD_FORM[f] : '#1c2448';
    ctx.fillRect(x + k * 7, y, 5, 5);
  }
}
// one bar split into wins, draws and losses
function ladRecord(r, x, y, w, h) {
  const n = (r.w || 0) + (r.d || 0) + (r.l || 0);
  ctx.fillStyle = '#1c2448'; ctx.fillRect(x, y, w, h);
  if (!n) return;
  const ww = Math.round(w * r.w / n), dw = Math.round(w * (r.w + r.d) / n) - ww;
  ctx.fillStyle = LAD_WIN; ctx.fillRect(x, y, ww, h);
  ctx.fillStyle = LAD_DRAW; ctx.fillRect(x + ww, y, dw, h);
  ctx.fillStyle = LAD_LOSS; ctx.fillRect(x + ww + dw, y, w - ww - dw, h);
}
function drawLadderRow(r, lo, hi, a) {
  const m = state.menu;
  const row = ladderRows[r.i];
  if (!row) return;
  const hv = m.ldHover['row' + r.i] || 0;
  const on = m.ldSel === r.i;
  const y = r.y - Math.round(hv);
  ctx.globalAlpha = a;
  ladWell(r.x, y, r.w, r.h, on ? '#cfe0ff' : hv > 0.5 ? '#8fa0c8' : '#2c3560');
  const ty = y + 7;
  const rank = String(r.i + 1);
  drawPixelText(ctx, rank, r.x + 14 - pixelTextWidth(rank), ty, on ? '#cfe0ff' : '#5a6690');
  drawPixelTextShadow(ctx, row.name, r.x + 22, ty, on ? '#f4f7ff' : '#9fb6d8', '#0a0e23');
  if (row.errors > 0) { ctx.fillStyle = LAD_LOSS; ctx.fillRect(r.x + 24 + pixelTextWidth(row.name), ty + 1, 3, 3); } // its code threw
  // the rating against the field: the bar's length, the number at its end
  const bx = r.x + 120, bw = 96;
  const f = hi > lo ? (row.rating - lo) / (hi - lo) : 0.5;
  ctx.fillStyle = '#1c2448'; ctx.fillRect(bx, ty + 1, bw, 5);
  ctx.fillStyle = row.games ? (on ? '#cfe0ff' : '#8fa0c8') : '#3a4470';
  ctx.fillRect(bx, ty + 1, Math.max(2, Math.round(bw * (0.15 + 0.85 * f))), 5);
  const rt = String(Math.round(row.rating));
  drawPixelText(ctx, rt, bx + bw + 6, ty, row.games ? (on ? '#f4f7ff' : '#cfe0ff') : '#5a6690');
  ladForm(row.form || [], r.x + r.w - 42, ty + 1);
}
// the trend: the rating after each match, a line over the start's level
function ladTrend(trail, x, y, w, h) {
  ctx.fillStyle = '#141b3a'; ctx.fillRect(x, y, w, h);
  const pts = [LAD_START].concat(trail);
  let lo = Math.min(...pts), hi = Math.max(...pts);
  if (hi - lo < 20) { const c = (hi + lo) / 2; lo = c - 10; hi = c + 10; }
  const Y = (v) => y + h - 2 - Math.round((h - 4) * (v - lo) / (hi - lo));
  ctx.fillStyle = '#2c3a68'; ctx.fillRect(x, Y(LAD_START), w, 1); // the start's level
  if (pts.length < 2) return;
  let px = x, py = Y(pts[0]);
  for (let k = 1; k < pts.length; k++) {
    const nx = x + Math.round((w - 1) * k / (pts.length - 1)), ny = Y(pts[k]);
    // a 1 px line on whole pixels: step across, then up or down
    const steps = Math.max(1, nx - px);
    for (let s = 0; s <= steps; s++) {
      const yy = Math.round(py + (ny - py) * s / steps);
      ctx.fillStyle = pts[k] >= pts[k - 1] ? '#cfe0ff' : '#8fa0c8';
      ctx.fillRect(px + s, yy, 1, 1);
    }
    px = nx; py = ny;
  }
  ctx.fillStyle = '#f4f7ff'; ctx.fillRect(px - 1, py - 1, 3, 3); // where it stands now
}
function drawLadderCard(c, now, a) {
  const m = state.menu;
  const row = ladderRows[m.ldSel];
  ctx.globalAlpha = a;
  ladWell(c.x, c.y, c.w, c.h, '#2c3560');
  if (!row) return;
  const x = c.x + 10;
  let y = c.y + 9;
  drawPixelTextShadow(ctx, row.name, x, y, '#f4f7ff', '#0a0e23', 2);
  if (row.author) drawPixelText(ctx, String(row.author), x, y + 18, '#5a6690');
  // the rating, big, and its last move beside it
  const rt = String(Math.round(row.rating));
  const rw = pixelTextWidth(rt, 2);
  drawPixelTextShadow(ctx, rt, c.x + c.w - 10 - rw, y, row.games ? '#cfe0ff' : '#5a6690', '#0a0e23', 2);
  if (row.delta) {
    const up = row.delta > 0, s = (up ? '+' : '') + Math.round(row.delta);
    drawPixelText(ctx, s, c.x + c.w - 10 - pixelTextWidth(s), y + 18, up ? LAD_WIN : LAD_LOSS);
  }
  y += 32;
  if (row.games) {
    ladTrend(row.trail || [], x, y, c.w - 20, 34);
    y += 42;
    ladRecord(row, x, y, c.w - 20, 5);
    const parts = [[row.w, LAD_WIN, 'W'], [row.d, LAD_DRAW, 'D'], [row.l, LAD_LOSS, 'L']];
    let tx = x;
    for (const [v, col, k] of parts) { const s = v + k; drawPixelText(ctx, s, tx, y + 9, col); tx += pixelTextWidth(s) + 10; }
    y += 24;
    // against each rival it has met: its win share as one bar
    const vs = Object.keys(row.vs || {});
    for (const id of vs.slice(0, 4)) {
      const v = row.vs[id];
      drawPixelText(ctx, ladderName(id), x, y, '#9fb6d8');
      ladRecord(v, x + 90, y + 1, c.w - 110, 5);
      y += 11;
    }
  }
  // FIGHT: a bare word, gold under the hand, the lobby's LOCK IN in small
  const L = ladderLayout(), F = { x: L.fight.x, y: L.fight.y + c.y - L.card.y, w: L.fight.w };
  const hv = m.ldHover.fight || 0;
  const ok = BOT_LIB.has(row.id);
  ctx.fillStyle = '#2c3a68'; ctx.fillRect(c.x + 10, F.y - 8, c.w - 20, 1);
  drawPixelTextOutline(ctx, 'FIGHT', F.x + 4, F.y + 2 - Math.round(hv), !ok ? '#3a4470' : hv > 0.5 ? '#ffd95c' : '#f4f7ff', 'rgba(8,12,28,0.9)', 2);
  if (padActive()) { ctx.fillStyle = '#cfe0ff'; ctx.fillRect(F.x + 4, F.y + 18, F.w - 8, 1); }
}
function renderLadder(now, a) {
  const L = ladderLayout();
  drawLobbyBackdrop(now, a);
  const slide = Math.round((1 - a) * 26);
  ctx.globalAlpha = a;
  drawPixelTextShadow(ctx, 'BOT LADDER', L.x0, L.head - slide, '#f4f7ff', '#0a0e23');
  ctx.fillStyle = '#cfe0ff'; ctx.fillRect(L.x0, L.head + 9 - slide, pixelTextWidth('BOT LADDER'), 1);
  const meta = ladderRows.length + ' BOTS   ' + ladderGames + ' MATCHES';
  drawPixelText(ctx, meta, L.x1 - pixelTextWidth(meta), L.head - slide, '#5a6690');
  let lo = Infinity, hi = -Infinity;
  for (const r of ladderRows) { lo = Math.min(lo, r.rating); hi = Math.max(hi, r.rating); }
  for (const r of L.rows) drawLadderRow({ x: r.x, y: r.y + slide, w: r.w, h: r.h, i: r.i }, lo, hi, a);
  drawLadderCard({ x: L.card.x, y: L.card.y + slide, w: L.card.w, h: L.card.h }, now, a);
  ctx.globalAlpha = a;
  drawBackHint(ctx, L.cx, L.back);
  ctx.globalAlpha = 1;
}
