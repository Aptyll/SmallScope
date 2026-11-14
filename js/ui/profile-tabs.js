'use strict';
// ------------------------------------------------------------ profile tabs
// The bodies of the profile's four tabs (the frame, the column and the
// input are js/ui/profile.js; the records, js/app/history.js):
//   OVERVIEW       the most played hero large, four numbers under it
//   MATCH HISTORY  op.gg's list: a summary, then a row a match - a header
//                  line (result, length, mode, how long ago) over the body
//                  (face and level, loadout, K/D/A with deaths in red, the
//                  kill share, CS a minute, gold, the build, both sides).
//                  A press opens the row into the whole scoreboard.
//   RANKED         a ladder of you and every person this screen has met, by rating
//   STATS          op.gg's most played: every hero's games, KDA, CS and win rate
// Someone else's profile shows what their card carries: their last matches
// (no builds or sides, a card is short) and the heroes in them.

const PF_MODE_KEYS = ['', 'ranked', 'quick', 'onevone'];
const PF_MODE_TXT = { '': 'ALL', ranked: 'RANKED', quick: 'QUICKPLAY', onevone: '1V1', guide: 'FIRST MATCH' };
const PF_WIN_BG = '#141a24', PF_LOSS_BG = '#1e1517';
const PF_WIN_LINE = '#1f2838', PF_LOSS_LINE = '#2c1e22';
const PF_BOARD_ROW = 14;                 // a seat in an open match's scoreboard
const PF_BOARD_H = 22 + 2 * (10 + 5 * PF_BOARD_ROW + 6);
const pfBlue = () => TEAMS[1].mark, pfRed = () => TEAMS[0].mark;
const pfK = (n) => (n >= 1000 ? Math.round(n / 100) / 10 + 'K' : String(n));
const pfT = (t, x, y, c, sc) => drawPixelTextOutline(ctx, String(t), x, y, c, SC_INK, sc || 1);
const pfTR = (t, x, y, c, sc) => pfT(t, x - pixelTextWidth(String(t), sc || 1), y, c, sc);
const pfTC = (t, x, y, c, sc) => pfT(t, x - (pixelTextWidth(String(t), sc || 1) >> 1), y, c, sc);
function pfBox(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

// ---- what a tab lists ---------------------------------------------------------
// the matches shown: yours in full, or the card's short ones ({ short: true })
function pfMatches() {
  const m = state.menu, c = pfCard();
  if (c) return c.rec.filter((r) => !m.pfMode || r.mode === m.pfMode).map((r) => ({ short: true, r }));
  return historyList(m.pfMode || null).map((r) => ({ short: false, r }));
}
// each match as op.gg's row needs it: your seat's numbers and the hero
function pfMine(e) {
  if (e.short) return { h: e.r.h, k: e.r.k, d: e.r.d, a: e.r.a, w: e.r.w, t: e.r.t };
  const y = historyYou(e.r);
  return { h: y.h, k: y.k, d: y.d, a: y.a, w: e.r.w, t: e.r.t, y };
}
function pfHeroes() {
  return historyHeroes(pfMatches().map((e) => (e.short ? { w: e.r.w, t: e.r.t, you: 0, seats: [{ s: 0, h: e.r.h, k: e.r.k, d: e.r.d, a: e.r.a, cs: 0 }] } : e.r)));
}
function pfLadder() {
  const me = cardMine();
  return PROFILE.people().concat([me]).sort((a, b) => b.rk - a.rk || b.w - a.w);
}

// ---- layout: every row's rect, given the scroll ---------------------------------
// the filter words, right-aligned at y
function pfModeRects(B, y) {
  const out = [];
  let x = B.x + B.w - 10;
  for (let i = PF_MODE_KEYS.length - 1; i >= 0; i--) {
    const t = PF_MODE_TXT[PF_MODE_KEYS[i]], w = pixelTextWidth(t);
    x -= w;
    out.unshift({ x, y, w, h: 9, key: PF_MODE_KEYS[i], t });
    x -= 12;
  }
  return out;
}
// the list area under the tab's fixed head, and each entry's rect in it
function pfListLayout(L) {
  const m = state.menu, B = L.body;
  const head = m.pfTab === 1 ? PF_SUM_H + 4 : m.pfTab === 3 ? 26 : 0;
  const clip = { x: B.x, y: B.y + head, w: B.w, h: B.h - head };
  const rows = [];
  let y = clip.y - m.pfScroll;
  if (m.pfTab === 1) {
    for (const e of pfMatches()) {
      const open = !e.short && m.pfOpen === e.r.m;
      rows.push({ x: B.x, y, w: B.w, h: PF_ROW_H, e, open });
      y += PF_ROW_H + (open ? PF_BOARD_H : 0) + PF_ROW_GAP;
    }
  } else if (m.pfTab === 2) {
    pfLadder().forEach((c, i) => { rows.push({ x: B.x, y, w: B.w, h: PF_LIST_H, c, i }); y += PF_LIST_H + 1; });
  } else if (m.pfTab === 3) {
    const hs = pfHeroes();
    if (hs.length) [null].concat(hs).forEach((s) => { rows.push({ x: B.x, y, w: B.w, h: PF_LIST_H, s }); y += PF_LIST_H + 1; });
  }
  return { clip, rows, end: y + m.pfScroll };
}
function profileScrollMax() {
  const m = state.menu;
  if (m.screen !== 'profile' || m.pfTab === 0) return 0;
  const P = pfListLayout(profileLayout());
  return Math.max(0, P.end - (P.clip.y + P.clip.h));
}
// the seats of an open match, as rects a press can open into their profile
function pfSeatRects(row) {
  const out = [];
  if (!row.open) return out;
  const r = row.e.r, you = historyYou(r);
  let y = row.y + row.h + 22;
  for (const side of [you.tm, 1 - you.tm]) {
    y += 10;
    for (const q of r.seats.filter((s) => s.tm === side)) { out.push({ x: row.x + 6, y: y - 1, w: row.w - 12, h: PF_BOARD_ROW, q }); y += PF_BOARD_ROW; }
    y += 6;
  }
  return out;
}
function pfKnown(pid) { return pid && (pid === PROFILE.pid() || PROFILE.people().some((c) => c.pid === pid)); }
function profileTabHit(L) {
  const m = state.menu, B = L.body;
  if (m.pfTab === 1 || m.pfTab === 3) {
    const fy = m.pfTab === 1 ? B.y + 32 : B.y + 8;
    for (const f of pfModeRects(B, fy)) if (overRect(f, 3, 3)) return { kind: 'mode', i: f.key };
  }
  if (m.pfTab === 0) return null;
  const P = pfListLayout(L);
  if (!overRect(P.clip)) return null;
  for (const row of P.rows) {
    if (m.pfTab === 1) {
      for (const s of pfSeatRects(row)) if (overRect(s) && pfKnown(s.q.p)) return { kind: 'seat', i: s.q.p };
      if (!row.e.short && overRect(row)) return { kind: 'row', i: row.e.r.m };
    } else if (m.pfTab === 2 && overRect(row)) return { kind: 'person', i: row.c.pid };
  }
  return null;
}

// ---- OVERVIEW ---------------------------------------------------------------------
function drawOverview(L) {
  const B = L.body, c = pfCard(), hs = pfHeroes();
  const main = hs.length ? hs[0].h : c ? c.pic : profilePic();
  const sh = Math.min(196, B.h - 92);
  pfBox(B.x, B.y, B.w, sh, '#101521');
  pfBox(B.x, B.y + sh - 52, B.w, 52, '#151b28');
  const cls = heroIndex(main);
  if (cls >= 0) {
    const spr = classSet({ cls, team: skin(1), skins: {} }).down[0];
    const k = Math.max(1, Math.min(8, Math.floor((sh - 16) / spr.height)));
    ctx.save(); ctx.beginPath(); ctx.rect(B.x, B.y, B.w, sh); ctx.clip();
    ctx.drawImage(spr, B.x + (B.w >> 1) - ((spr.width * k) >> 1), B.y + sh - spr.height * k - 4, spr.width * k, spr.height * k);
    ctx.restore();
  }
  pfT(main, B.x + 10, B.y + 8, SC_LIT, 2);
  if (hs.length) pfT(hs[0].n + (hs[0].n === 1 ? ' GAME' : ' GAMES'), B.x + 10, B.y + 24, SC_DIM);
  // the four numbers: rating, record, best hero, and a fourth that is yours alone
  const st = c ? { r: c.rk, g: c.g, w: c.w } : { r: PROFILE.rank(), g: PROFILE.stats().matches, w: PROFILE.stats().wins };
  const best = hs.filter((h) => h.n >= 3).sort((a, b) => b.w / b.n - a.w / a.n)[0] || hs[0];
  const cw = Math.floor(B.w / 4), y = B.y + sh + 14;
  const cells = [
    ['RANKED', () => pfRatingMark(0, y + 12), String(st.r), wearsRank(c) ? RANK_TIERS[rankTier(st.r)] : 'RATING', SC_GOLD],
    ['RECORD', (x) => { pfBox(x - 30, y + 22, 60, 6, pfRed()); pfBox(x - 30, y + 22, st.g ? Math.round(60 * st.w / st.g) : 0, 6, pfBlue()); }, st.w + 'W ' + (st.g - st.w) + 'L', st.g ? Math.round(100 * st.w / st.g) + '% WINS' : '', SC_LIT],
    ['BEST HERO', (x) => { if (best) pfFace(best.h, x - 14, y + 12, 28, 2, true); }, best ? best.h : '-', best ? Math.round(100 * best.w / best.n) + '% IN ' + best.n : '', SC_LIT],
  ];
  if (!c) cells.push(['PRACTICE', null, PROFILE.bestLap() ? PROFILE.bestLap().toFixed(1) + 'S' : '-', 'BEST LAP', SC_LIT]);
  cells.forEach(([h, mark, v, sub, col], i) => {
    const cx = B.x + i * cw + (cw >> 1);
    pfTC(h, cx, y, SC_LBL);
    if (mark) mark(cx);
    pfTC(v, cx, y + 48, col, 2); pfTC(sub, cx, y + 64, SC_DIM);
  });
  function pfRatingMark() { // the tier's badge in a gold square (js/ui/badges.js), or before any RANKED a flat snow crystal
    const cx = B.x + (cw >> 1), ey = y + 12;
    pfBox(cx - 14, ey, 28, 28, '#0a0b0e'); ctx.fillStyle = SC_GOLD; pfRim(cx - 14, ey, 28, 28);
    if (wearsRank(c)) { drawRankBadge(cx - (BADGE_PX >> 1), ey + ((28 - BADGE_PX) >> 1), st.r); return; }
    for (let k = -8; k <= 8; k++) { ctx.fillRect(cx + k, ey + 14, 1, 1); ctx.fillRect(cx, ey + 14 + k, 1, 1); ctx.fillRect(cx + k, ey + 14 + k, 1, 1); ctx.fillRect(cx + k, ey + 14 - k, 1, 1); }
  }
}

// ---- MATCH HISTORY ------------------------------------------------------------------
function drawHistorySummary(B) {
  const m = state.menu, list = pfMatches().slice(0, 20), n = list.length;
  pfBox(B.x, B.y, B.w, PF_SUM_H, SC_PLATE);
  for (const f of pfModeRects(B, B.y + 32)) {
    const on = m.pfMode === f.key;
    pfT(f.t, f.x, f.y, on ? SC_LIT : pfHot('mode', f.key) ? SC_TXT : SC_DIM);
    if (on) pfBox(f.x, f.y + 8, f.w, 1, SC_GOLD);
  }
  if (!n) return;
  const mine = list.map(pfMine), wins = mine.filter((q) => q.w).length;
  pfT('LAST ' + n, B.x + 8, B.y + 6, SC_DIM);
  pfT(wins + 'W ' + (n - wins) + 'L', B.x + 8, B.y + 16, SC_LIT, 2);
  pfBox(B.x + 8, B.y + 32, 60, 4, pfRed()); pfBox(B.x + 8, B.y + 32, Math.round(60 * wins / n), 4, pfBlue());
  const k = mine.reduce((s, q) => s + q.k, 0) / n, d = mine.reduce((s, q) => s + q.d, 0) / n, a = mine.reduce((s, q) => s + q.a, 0) / n;
  pfT(k.toFixed(1) + ' / ' + d.toFixed(1) + ' / ' + a.toFixed(1), B.x + 92, B.y + 8, SC_TXT);
  const kda = historyKda(k, d, a);
  pfT(kda.toFixed(2) + ':1 KDA', B.x + 92, B.y + 20, kda >= 3 ? SC_GOLD : SC_LIT, 2);
  const hs = historyHeroes(list.map((e) => (e.short ? { w: e.r.w, t: e.r.t, you: 0, seats: [{ s: 0, h: e.r.h, k: e.r.k, d: e.r.d, a: e.r.a, cs: 0 }] } : e.r)));
  const room = Math.max(0, Math.min(3, Math.floor((B.w - 210) / 66)));
  hs.slice(0, room).forEach((h, i) => {
    const hx = B.x + 210 + i * 66;
    pfFace(h.h, hx, B.y + 6, 28, 2, true);
    pfT(Math.round(100 * h.w / h.n) + '%', hx + 32, B.y + 9, h.w / h.n >= 0.6 ? SC_GOLD : SC_LIT);
    pfT(h.w + 'W ' + (h.n - h.w) + 'L', hx + 32, B.y + 19, SC_DIM);
  });
}
// the fold mark, down shut and up open, and the row's header line
function drawRowHead(row, mine, col) {
  const r = row.e.r, x = row.x, y = row.y, w = row.w;
  pfT(mine.w ? 'VICTORY' : 'DEFEAT', x + 10, y + 4, col);
  pfT(clockTxt(mine.t), x + 50, y + 4, SC_LBL);
  pfBox(x + 3, y + 12, w - 3, 1, mine.w ? PF_WIN_LINE : PF_LOSS_LINE);
  const ax = x + w - 14, ay = y + 5;
  ctx.fillStyle = row.open ? SC_GOLD : row.e.short ? SC_EDGE : col;
  if (row.open) { ctx.fillRect(ax, ay + 2, 5, 1); ctx.fillRect(ax + 1, ay + 1, 3, 1); ctx.fillRect(ax + 2, ay, 1, 1); }
  else { ctx.fillRect(ax, ay, 5, 1); ctx.fillRect(ax + 1, ay + 1, 3, 1); ctx.fillRect(ax + 2, ay + 2, 1, 1); }
  pfTR((PF_MODE_TXT[r.mode] || '') + '   ' + historyAgo(r.at) + ' AGO', ax - 8, y + 4, SC_LBL);
}
function drawHistoryRow(row) {
  const mine = pfMine(row.e), col = mine.w ? pfBlue() : pfRed(), x = row.x, w = row.w;
  pfBox(x, row.y, w, row.h, row.open || pfHot('row', row.e.r.m) ? (mine.w ? '#18202c' : '#241a1d') : mine.w ? PF_WIN_BG : PF_LOSS_BG);
  pfBox(x, row.y, 3, row.h, col);
  drawRowHead(row, mine, col);
  const by = row.y + 15, fx = x + 10;
  pfFace(mine.h, fx, by, 32, 2, true);
  if (mine.y) { pfBox(fx + 20, by + 24, 12, 8, SC_INK); pfTC(mine.y.lv, fx + 26, by + 26, SC_LIT); }
  const lx = fx + 36;
  if (!row.e.short) {
    const lo = row.e.r.lo.split(',');
    [['trick', lo[0], 0, 0], ['trick', lo[1], 0, 17], ['calling', lo[2], 17, 0]].forEach(([kind, id, ox, oy]) => {
      const im = id && loIcon(kind, id);
      if (im) ctx.drawImage(im, lx + ox, by + oy);
    });
  }
  // the score, deaths in red, and the ratio under it
  const kx = row.e.short ? fx + 40 : lx + 40;
  const parts = [[mine.k, SC_LIT], [' / ', SC_DIM], [mine.d, pfRed()], [' / ', SC_DIM], [mine.a, SC_LIT]];
  let tx = kx + 36 - (parts.reduce((s, [t]) => s + pixelTextWidth(String(t), 2), 0) >> 1);
  for (const [t, c] of parts) { pfT(t, tx, by + 6, c, 2); tx += pixelTextWidth(String(t), 2); }
  const kda = historyKda(mine.k, mine.d, mine.a);
  pfTC(kda.toFixed(2) + ':1 KDA', kx + 36, by + 22, kda >= 3 ? SC_GOLD : SC_LBL);
  if (row.e.short) return;
  drawRowBody(row, mine, col, kx + 80, by);
}
// the rest of a full row: the share, the build, the damage, both sides
function drawRowBody(row, mine, col, cx, by) {
  const r = row.e.r, y = mine.y, x = row.x, w = row.w;
  const kills = historySideKills(r, y.tm), kp = kills ? Math.round(100 * (y.k + y.a) / kills) : 0;
  pfT('P/KILL ' + kp + '%', cx, by + 2, kp >= 60 ? SC_GOLD : SC_LBL);
  pfT('CS ' + y.cs + ' (' + (y.cs / Math.max(1, r.t / 60)).toFixed(1) + ')', cx, by + 12, SC_LBL);
  ctx.drawImage(SPRITES.itemGold, cx, by + 20); pfT(pfK(y.g), cx + 11, by + 22, SC_GOLD);
  const ix = cx + 66, empty = mine.w ? '#1c2432' : '#2a1d21';
  for (let i = 0; i < ITEM_SLOTS; i++) {
    const id = y.it[i], qx = ix + (i % 3) * 17, qy = by + Math.floor(i / 3) * 17;
    if (id && BUILD_ITEMS[id]) ctx.drawImage(itemIcon(id), qx, qy); else pfBox(qx, qy, 16, 16, empty);
  }
  // both sides, a face and a name a seat, where the row has room past the build
  const px = x + w - 150, dx = ix + 59, dw = Math.min(70, px - 10 - dx);
  if (dw >= 40) { // the damage to heroes, against the match's best
    const best = Math.max(1, ...r.seats.map((q) => q.dmg));
    pfT('DMG ' + pfK(y.dmg), dx, by + 6, SC_LBL);
    pfBox(dx, by + 15, dw, 4, empty); pfBox(dx, by + 15, Math.round(dw * y.dmg / best), 4, col);
  }
  if (px < ix + 51 + 8) return;
  [y.tm, 1 - y.tm].forEach((tm, si) => r.seats.filter((q) => q.tm === tm).forEach((q, i) => {
    const qx = px + si * 66, qy = by - 1 + i * 7;
    pfFace(q.h, qx, qy, 6, 1, si === 0);
    pfT(q.n, qx + 9, qy + 1, q.s === r.you ? SC_LIT : SC_DIM);
  }));
}
// an open match: both sides in full, your row outlined
function drawHistoryBoard(row) {
  const r = row.e.r, you = historyYou(r), x = row.x, w = row.w;
  let y = row.y + row.h;
  pfBox(x, y, w, PF_BOARD_H, '#0f1218');
  pfT('SCOREBOARD', x + 10, y + 6, SC_LIT); pfBox(x + 10, y + 14, pixelTextWidth('SCOREBOARD'), 1, SC_GOLD);
  const best = Math.max(1, ...r.seats.map((q) => q.dmg));
  const cDmg = x + Math.min(300, w - 200), cCs = cDmg + 40, cGold = cCs + 36, cIt = cGold + 10;
  const seats = pfSeatRects(row);
  let si = 0;
  y += 22;
  for (const tm of [you.tm, 1 - you.tm]) {
    const won = tm === you.tm ? r.w : 1 - r.w, col = tm === you.tm ? pfBlue() : pfRed();
    pfT(won ? 'VICTORY' : 'DEFEAT', x + 10, y, col);
    pfTR('DAMAGE', cDmg, y, SC_DIM); pfTR('CS', cCs, y, SC_DIM); pfTR('GOLD', cGold, y, SC_DIM);
    y += 10;
    for (const q of r.seats.filter((s) => s.tm === tm)) {
      const s = seats[si++], me = q.s === r.you, hot = pfKnown(q.p) && pfHot('seat', q.p);
      if (me) { pfBox(s.x, s.y, s.w, s.h, SC_YOU); ctx.fillStyle = SC_GOLD; pfRim(s.x, s.y, s.w, s.h); }
      pfFace(q.h, x + 10, y, 12, 1, tm === you.tm);
      pfT(q.n, x + 26, y + 4, me ? SC_GOLD : hot ? '#ffd95c' : SC_TXT);
      if (!q.b) pfT(q.h, x + 90, y + 4, SC_DIM); // a bot is named by its hero already
      pfTR(q.k + ' / ' + q.d + ' / ' + q.a, cDmg - 110, y + 4, SC_LIT);
      pfBox(cDmg - 100, y + 5, 60, 3, SC_EDGE); pfBox(cDmg - 100, y + 5, Math.round(60 * q.dmg / best), 3, col);
      pfTR(pfK(q.dmg), cDmg, y + 4, SC_LBL); pfTR(q.cs, cCs, y + 4, SC_TXT); pfTR(pfK(q.g), cGold, y + 4, SC_GOLD);
      for (let i = 0; i < ITEM_SLOTS && cIt + i * 13 + 12 <= x + w - 4; i++) {
        const id = q.it[i];
        if (id && BUILD_ITEMS[id]) ctx.drawImage(itemIcon(id), 2, 2, 12, 12, cIt + i * 13, y, 12, 12); else pfBox(cIt + i * 13, y, 12, 12, '#0a0b0e');
      }
      y += PF_BOARD_ROW;
    }
    y += 6;
  }
}

// ---- RANKED and STATS ------------------------------------------------------------------
function drawLadderRow(row) {
  const c = row.c, me = c.pid === PROFILE.pid(), x = row.x, y = row.y;
  pfBox(x, y, row.w, row.h, me ? SC_YOU : pfHot('person', c.pid) ? SC_HOT : row.i % 2 ? SC_ROW_B : SC_ROW_A);
  if (me) { ctx.fillStyle = SC_GOLD; pfRim(x, y, row.w, row.h); }
  pfTR(row.i + 1, x + 24, y + 14, SC_DIM);
  pfFace(c.pic, x + 32, y + 3, 28, 2, true);
  pfT(c.n, x + 68, y + 9, me ? SC_GOLD : SC_LIT, 2);
  pfTR(c.rk, x + row.w - 140, y + 10, SC_GOLD, 2);
  pfBox(x + row.w - 120, y + 15, 60, 3, pfRed()); pfBox(x + row.w - 120, y + 15, c.g ? Math.round(60 * c.w / c.g) : 0, 3, pfBlue());
  pfTR(c.g ? Math.round(100 * c.w / c.g) + '%' : '-', x + row.w - 10, y + 8, SC_LIT);
  pfTR(c.w + 'W ' + (c.g - c.w) + 'L', x + row.w - 10, y + 19, SC_DIM);
}
function drawStatsRow(row, i) {
  const s = row.s, x = row.x, y = row.y, w = row.w;
  const all = s || pfHeroes().reduce((t, h) => ({ n: t.n + h.n, w: t.w + h.w, k: t.k + h.k, d: t.d + h.d, a: t.a + h.a, cs: t.cs + h.cs, t: t.t + h.t }), { n: 0, w: 0, k: 0, d: 0, a: 0, cs: 0, t: 0 });
  pfBox(x, y, w, row.h, i % 2 ? SC_ROW_B : SC_ROW_A);
  if (s) pfFace(s.h, x + 10, y + 3, 28, 2, true);
  else { pfBox(x + 10, y + 3, 28, 28, '#0a0b0e'); ctx.fillStyle = SC_EDGE; pfRim(x + 10, y + 3, 28, 28); pfTC('ALL', x + 24, y + 15, SC_LBL); }
  pfT(s ? s.h : 'ALL HEROES', x + 46, y + 8, SC_LIT);
  if (all.cs) pfT('CS ' + Math.round(all.cs / all.n) + ' (' + (all.cs / Math.max(1, all.t / 60)).toFixed(1) + ')', x + 46, y + 19, SC_DIM);
  const kda = historyKda(all.k, all.d, all.a), mid = x + Math.round(w * 0.5);
  pfTC(kda.toFixed(2) + ':1 KDA', mid, y + 8, kda >= 3 ? SC_GOLD : SC_LBL);
  pfTC((all.k / all.n).toFixed(1) + ' / ' + (all.d / all.n).toFixed(1) + ' / ' + (all.a / all.n).toFixed(1), mid, y + 19, SC_DIM);
  const wr = Math.round(100 * all.w / all.n), bx = x + w - 150;
  if (bx > mid + 50) { pfBox(bx, y + 15, 80, 3, pfRed()); pfBox(bx, y + 15, Math.round(80 * all.w / all.n), 3, pfBlue()); }
  pfTR(wr + '%', x + w - 10, y + 8, wr >= 60 ? SC_GOLD : SC_LIT);
  pfTR(all.n + (all.n === 1 ? ' GAME' : ' GAMES'), x + w - 10, y + 19, SC_DIM);
}

// ---- the tab ---------------------------------------------------------------------------
function drawProfileTab(L, now) {
  const m = state.menu, B = L.body;
  if (m.pfTab === 0) { drawOverview(L); return; }
  if (m.pfTab === 1) drawHistorySummary(B);
  if (m.pfTab === 3) {
    pfBox(B.x, B.y, B.w, 22, SC_PLATE);
    pfT('MOST PLAYED', B.x + 10, B.y + 8, SC_LIT);
    for (const f of pfModeRects(B, B.y + 8)) {
      const on = m.pfMode === f.key;
      pfT(f.t, f.x, f.y, on ? SC_LIT : pfHot('mode', f.key) ? SC_TXT : SC_DIM);
      if (on) pfBox(f.x, f.y + 8, f.w, 1, SC_GOLD);
    }
  }
  const P = pfListLayout(L);
  ctx.save(); ctx.beginPath(); ctx.rect(P.clip.x, P.clip.y, P.clip.w, P.clip.h); ctx.clip();
  P.rows.forEach((row, i) => {
    if (row.y > P.clip.y + P.clip.h || row.y + row.h + (row.open ? PF_BOARD_H : 0) < P.clip.y) return;
    if (m.pfTab === 1) { drawHistoryRow(row); if (row.open) drawHistoryBoard(row); }
    else if (m.pfTab === 2) drawLadderRow(row);
    else drawStatsRow(row, i);
  });
  ctx.restore();
}
