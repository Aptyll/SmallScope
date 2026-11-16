'use strict';
// ------------------------------------------------------------ the hub
// The landing page, League's client home in the Graphite of the party
// screen: one flat page where the party, PLAY and a preview of everything a
// player reaches for between matches stand at once. It IS the party lobby
// (state.menu.screen 'room', js/ui/rooms.js keeps the party's logic): the
// title is only a step on the way in (hubEnter), so a boot, a match's end, a
// closed profile or wiki all land here.
//
//   YOU            your face, name, rank and record, your last ten results,
//                  the purse (the skins screen) and the gear (settings)
//   MATCH HISTORY  your newest matches as op.gg's rows (the profile's tab)
//   PARTY + PLAY   your side's seats with you in the middle and PLAY beside
//                  them: the leader's PLAY looks for a match and turns into
//                  its clock and X while it does; a guest's says READY
//   HEROES         one hero's four abilities (a card on hover) and its
//                  numbers; the arrows walk all of them (the wiki's page)
//   ITEMS          the build for that hero (buildsRec, js/app/builds.js)
//   FRIENDS        Steam's friends (js/ui/friends.js), or off Steam your
//                  party's code and JOIN for a friend's
//   LADDER         you among everyone this screen has met, by rating
//
// Every panel's head names it; a click on a panel opens its whole page and
// that page's way out comes back here. A profile that has never seen a match
// through plays its first PLAY as FIRST MATCH (roomGo): easy bots and the
// coach. The layout reads VIEW_W and VIEW_H: the two columns share the
// width with the middle, and every list shows the rows its panel fits.
const HUB_PAD = 8, HUB_GAP = 8;          // the page's margin, the air between panels
const HUB_SIDE = 160, HUB_SIDE_MIN = 112; // a side column at its widest and narrowest
const HUB_CARD_H = 84;                   // YOU
const HUB_SEAT_H = 72, HUB_SEAT_H_N = 52; // a seat's height, and on a view under 340 tall
const HUB_CTRL_H = 18;                   // the PARTY panel's foot row: JOIN, or the chat and the X
const HUB_PLAY_MIN = 64, HUB_PLAY_MAX = 96; // PLAY's width
const HUB_ITEMS_H = 72;                  // ITEMS: the head, the wells and their prices
const HUB_HERO_H = 114;                  // HEROES: the hero, the wells, the lit ability's name and two lines of it
const HUB_HEAD = 20;                     // a panel's head
const HUB_ROW = 35;                      // a match's row
const HUB_LAD_ROW = 18;                  // a ladder's row (a badge is BADGE_PX tall)
const HUB_WELL = 32, HUB_WELL_GAP = 4;   // an ability's well, an item's
const HUB_FACE_MAX = 48;                 // a seat's face at its largest
const HUB_COPY = ['####.', '#..##', '#..##', '####.', '.####'];  // two sheets: the code copies
const HUB_LAST = 10;                     // results in YOU's strip of pips
const HUB_WIN = '#7fd88a', HUB_LOSS = '#e0675a', HUB_WIN_BG = '#14201a', HUB_LOSS_BG = '#22161a';
const HUB_STAT = [['hub.hp', 'hp'], ['hub.dmg', 'dmg'], ['hub.armor', 'armor'], ['hub.speed', 'ms']];
const HUB_CHEV = ['#...', '##..', '###.', '##..', '#...'];
const HUB_CHEV_L = ['...#', '..##', '.###', '..##', '...#'];
const HUB_QUIT = ['...#...', '.#.#.#.', '#..#..#', '#.....#', '#.....#', '.#...#.', '..###..']; // the desktop build's way out

// the way in: the title is only ever passed through, onto your party's hub
// (the one you are in, or your own hosted now)
function hubEnter() {
  const m = state.menu;
  if (state.mode !== 'title' || m.screen !== 'menu' || m.panel || state.fade || state.intro > 0 || PRACTICE || CROSS) return;
  if (NET.role === 'solo' || (NET.role === 'host' && !NET.peers.size && NET.transport && NET.transport.error)) beginParty('ranked');
  else beginRoom();
}
// the hero the HEROES and ITEMS panels show: the one the arrows walked to, else yours
function hubHero() { const h = state.menu.hubHero; return h >= 0 && CLASSES[h] ? h : profileHero(); }
function hubHeroStep(d) { const n = CLASSES.length; state.menu.hubHero = (hubHero() + d + n) % n; SFX.pickup(); }
// the six items the ITEMS panel shows: boots and the build's core, then what people finish most
function hubBuild(h) {
  const name = CLASSES[h].name, R = buildsRec(name, BOT_BUILDS[name] || []);
  const ids = (R.boots.length ? [R.boots[0].ids[0]] : []).concat(R.core[0].ids, R.more);
  return ids.filter((id, i) => BUILD_ITEMS[id] && ids.indexOf(id) === i).slice(0, 6);
}

// ---- layout -----------------------------------------------------------------
// every rect on the page, one call: the panels, the seats, PLAY and the X,
// the chat line, the code and JOIN; draw, hit test and keys all read it.
// PARTY is one panel: its head names it with the count and the code; the
// seats with PLAY beside them; and a foot row of plates as tall as each other
// under them: JOIN while you are alone, the chat with the X that leaves under
// PLAY once there are people. FRIENDS (Steam's) shares the right column with
// LADDER, and off Steam LADDER takes it all.
function hubTalking() { return NET.role === 'client' || NET.peers.size > 0; }
function hubLayout() {
  const W = VIEW_W, H = VIEW_H, p = HUB_PAD, g = HUB_GAP;
  const side = Math.max(HUB_SIDE_MIN, Math.min(HUB_SIDE, Math.floor((W - 2 * p - 2 * g) / 4)));
  const lx = p, rx = W - p - side, mx = p + side + g, mw = W - 2 * p - 2 * side - 2 * g, bot = H - p;
  const card = { x: lx, y: p, w: side, h: HUB_CARD_H };
  const hist = { x: lx, y: p + HUB_CARD_H + g, w: side, h: bot - (p + HUB_CARD_H + g) };
  // the seats take what HEROES and ITEMS leave, so no panel stands half empty
  const frame = HUB_HEAD + 6 + 4 + HUB_CTRL_H + 8;
  const sh = H >= 340 ? Math.max(HUB_SEAT_H, bot - p - frame - 2 * g - HUB_HERO_H - HUB_ITEMS_H) : HUB_SEAT_H_N;
  const strip = { x: mx, y: p, w: mw, h: frame + sh };
  const restY = strip.y + strip.h + g;
  const items = { x: mx, y: bot - HUB_ITEMS_H, w: mw, h: HUB_ITEMS_H };
  const hero = { x: mx, y: restY, w: mw, h: items.y - g - restY };
  const fh = FRIENDS.on ? Math.round((bot - p - g) / 2) : 0;
  const friends = { x: rx, y: p, w: side, h: fh };
  const ladder = fh ? { x: rx, y: p + fh + g, w: side, h: bot - (p + fh + g) } : { x: rx, y: p, w: side, h: bot - p };
  // PARTY's body: the seats, PLAY at its right end
  const talking = hubTalking(), leaving = talking && seekClock() == null; // while it looks, the clock's own X is the one way out
  const top = strip.y + HUB_HEAD + 6, fy = top + sh + 4;
  const pw = Math.max(HUB_PLAY_MIN, Math.min(HUB_PLAY_MAX, Math.round(mw * 0.3)));
  const go = { x: strip.x + strip.w - 8 - pw, y: top, w: pw, h: leaving ? sh : sh + 4 + HUB_CTRL_H };
  const leave = leaving ? { x: go.x, y: fy, w: pw, h: HUB_CTRL_H } : null;
  const side0 = player ? partySide() : roomSide(0), n = side0.length, mid = n >> 1;
  const at = [mid]; // the positions, nearest the middle first
  for (let d = 1; at.length < n; d++) { if (mid - d >= 0) at.push(mid - d); if (mid + d < n && at.length < n) at.push(mid + d); }
  const order = side0.filter((q) => q === player).concat(side0.filter((q) => q !== player));
  const area = go.x - 6 - (strip.x + 8), sg = 4, sw = Math.floor((area - (n - 1) * sg) / Math.max(1, n));
  const fs = Math.max(16, Math.min(HUB_FACE_MAX, sw - 12, sh - 28));
  const sx = strip.x + 8;
  const seats = order.map((q, i) => ({ x: sx + at[i] * (sw + sg), y: top, w: sw, h: sh, fs, p: q, k: side0.indexOf(q) })).sort((a, b) => a.x - b.x);
  const foot = { x: sx, y: fy, w: n * sw + (n - 1) * sg, h: HUB_CTRL_H }; // under the seats: the chat, or JOIN
  const talk = talking ? foot : null;
  const box = foot;
  return { card, hist, strip, hero, items, friends, ladder, seats, go, leave, talk, box, label: hubGoLabel() };
}
// what PLAY says: a guest's READY, the leader's PLAY, or the clock while it looks
function hubGoLabel() {
  if (NET.isClient) return 'ready';
  const clock = seekClock();
  return clock != null ? seekText(clock) : 'play';
}
// the party screen's name for the layout, read by the chat, the friends and the pointer
function roomLayout() { return hubLayout(); }
// the panels' own targets: a match row, a ladder row, an ability or item well, the hero arrows
function hubRows(R, n, pitch) { const out = [], top = R.y + HUB_HEAD + 4; for (let i = 0; i < n && top + (i + 1) * pitch <= R.y + R.h; i++) out.push({ x: R.x + 4, y: top + i * pitch, w: R.w - 8, h: pitch - 4, i }); return out; }
function hubHistRows(L) { return hubRows(L.hist, Math.min(historyList(null).length, 12), HUB_ROW); }
function hubLadRows(L) {
  const all = pfLadder(), mine = all.findIndex((c) => c.pid === PROFILE.pid()), fit = Math.floor((L.ladder.h - HUB_HEAD - 6) / HUB_LAD_ROW);
  const from = Math.max(0, Math.min(all.length - fit, mine - (fit >> 1)));
  return hubRows(L.ladder, Math.min(fit, all.length), HUB_LAD_ROW).map((r) => Object.assign(r, { c: all[from + r.i], rank: from + r.i + 1 }));
}
function hubAbWells(L) { const R = L.hero, x = R.x + 72, y = R.y + HUB_HEAD + 18; return CLASS_AB[hubHero()].map((_, i) => ({ x: x + i * (HUB_WELL + HUB_WELL_GAP), y, w: HUB_WELL, h: HUB_WELL, i })); }
function hubItemWells(L) {
  const R = L.items, ids = hubBuild(hubHero()), step = Math.floor((R.w - 16) / 6), y = R.y + HUB_HEAD + 6;
  return ids.map((id, i) => ({ x: R.x + 8 + i * step + ((step - HUB_WELL) >> 1), y, w: HUB_WELL, h: HUB_WELL, id }));
}
function hubArrows(L) { const R = L.hero; return [{ d: -1, x: R.x + R.w - 44, y: R.y + 4, w: 10, h: 12 }, { d: 1, x: R.x + R.w - 30, y: R.y + 4, w: 10, h: 12 }]; }
// QUIT, the desktop build's (the bridge, desktop/preload.js: it opens fullscreen,
// so the app needs its own way out; a browser tab has its X): left of the gear
function hubQuitRect(L) { return window.steamBridge && steamBridge.quit ? { x: L.card.x + L.card.w - 31, y: L.card.y + L.card.h - 16, w: 7, h: 7 } : null; }
// the party's code in PARTY's head, right-aligned behind the copy mark: a click copies it
function hubCodeRect(L) { const c = roomCode(), R = L.strip; if (!c) return null; const w = 9 + pixelTextWidth(c); return { x: R.x + R.w - 8 - w, y: R.y + 6, w, h: 7 }; }
function hubPurseRect(L) { const s = String(PROFILE.coins()), w = 11 + pixelTextWidth(s); return { x: L.card.x + 8, y: L.card.y + L.card.h - 16, w, h: 9 }; }

// ---- the pointer ------------------------------------------------------------
// what is under it: the party's own targets first (rooms.js's kinds), then the panels
function roomHit() {
  const m = state.menu, L = hubLayout();
  if (!mouse.inside) return null;
  if (overRect(L.go, 1)) return { kind: 'go' };
  if (L.leave && overRect(L.leave, 1)) return { kind: 'leave' };
  const cr = hubCodeRect(L);
  if (cr && overRect(cr, 3)) return { kind: 'code' };
  if (codeBoxShown() && overRect(L.box, 1)) return { kind: 'box' };
  const fh = friendsHit(L);
  if (fh) return fh;
  if (L.talk && overRect(L.talk, 1)) return { kind: 'talk' };
  if (!m.joining) for (const s of L.seats) if (overRect(s)) {
    if (isHuman(s.p) && seatPid(s.p.id)) return { kind: 'profile', id: s.p.id }; // a person's seat: their profile (js/ui/profile.js)
    const act = seatAct(s);
    return act ? { kind: 'seat', id: s.p.id, act } : null;
  }
  if (overRect(hubPurseRect(L), 2)) return { kind: 'purse' };
  const q = hubQuitRect(L);
  if (q && overRect(q, 3)) return { kind: 'quit' };
  if (overGear()) return null; // the settings: menuClick takes it first
  if (overRect(L.card)) return { kind: 'card' };
  for (const r of hubHistRows(L)) if (overRect(r)) return { kind: 'match', i: r.i };
  if (overRect(L.hist)) return { kind: 'history' };
  for (const a of hubArrows(L)) if (overRect(a, 2)) return { kind: 'arrow', d: a.d };
  for (const w of hubAbWells(L)) if (overRect(w)) return { kind: 'ab', i: w.i };
  if (overRect(L.hero)) return { kind: 'heroes' };
  for (const w of hubItemWells(L)) if (overRect(w)) return { kind: 'item', id: w.id };
  if (overRect(L.items)) return { kind: 'items' };
  for (const r of hubLadRows(L)) if (overRect(r)) return { kind: 'person', c: r.c };
  if (overRect(L.ladder)) return { kind: 'ladder' };
  return null;
}
// a panel's click: its whole page, which comes back here
function hubDo(h) {
  const m = state.menu;
  if (h.kind === 'purse') { beginSkins(); return true; }
  if (h.kind === 'quit') { steamBridge.quit(); return true; } // the app closes (desktop/main.js, win:quit)
  if (h.kind === 'card') { beginProfile(null, 'room'); return true; }
  if (h.kind === 'history' || h.kind === 'match') {
    beginProfile(null, 'room'); m.pfTab = 1;
    if (h.kind === 'match') m.pfOpen = historyList(null)[h.i].m;
    return true;
  }
  if (h.kind === 'ladder' || h.kind === 'person') {
    const pid = h.c && h.c.pid !== PROFILE.pid() ? h.c.pid : null;
    beginProfile(pid, 'room'); if (!pid) m.pfTab = 2;
    return true;
  }
  if (h.kind === 'arrow') { hubHeroStep(h.d); return true; }
  if (h.kind === 'heroes' || h.kind === 'ab') { wikiOpen('classes', hubHero()); return true; }
  if (h.kind === 'items' || h.kind === 'item') { wikiOpen('items'); return true; }
  return false;
}
// the card a well raises: an ability's, an item's (tipAt, js/ui/tooltip.js)
function hubTip() {
  const h = roomHit();
  if (!h) return null;
  if (h.kind === 'ab') return tipClassAb(h.i, hubHero());
  if (h.kind === 'item') return tipItem(h.id);
  return null;
}

// ---- the pixels -------------------------------------------------------------
const hubT = (s, x, y, c, k) => drawPixelText(ctx, String(s), Math.round(x), Math.round(y), c, k || 1);
function hubRim(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); }
// a panel: the plate, its name in the head, and the step that opens its page (none: no page)
function hubPanel(R, word, side, hot, step) {
  ctx.fillStyle = SC_PLATE; ctx.fillRect(R.x, R.y, R.w, R.h);
  hubRim(R.x, R.y, R.w, R.h, hot ? SC_LBL : SC_EDGE);
  hubT(tr(word), R.x + 8, R.y + 7, hot ? SC_TXT : SC_LBL);
  if (side) hubT(side, R.x + R.w - (step === false ? 8 : 20) - pixelTextWidth(side), R.y + 7, SC_DIM);
  if (step !== false) frBmp(R.x + R.w - 12, R.y + 7, HUB_CHEV, hot ? '#ffd95c' : SC_DIM);
  ctx.fillStyle = SC_EDGE; ctx.fillRect(R.x, R.y + HUB_HEAD - 1, R.w, 1);
}
function hubWell(w, hot, rim) { ctx.fillStyle = hot ? '#ffd95c' : rim || SC_INK; ctx.fillRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2); ctx.fillStyle = '#080b1c'; ctx.fillRect(w.x, w.y, w.w, w.h); }

// YOU: face, name, rank and rating, the record, the last results, the purse and the gear
function drawHubCard(L, hit) {
  const R = L.card, hot = hit && hit.kind === 'card', list = historyList(null);
  ctx.fillStyle = SC_PLATE; ctx.fillRect(R.x, R.y, R.w, R.h); hubRim(R.x, R.y, R.w, R.h, hot ? SC_LBL : SC_EDGE);
  pfFace(profilePic(), R.x + 8, R.y + 8, 40, 3, true);
  ctx.fillStyle = '#c89a3c'; ctx.fillRect(R.x + 8, R.y + 48, 40, 1);
  const nx = R.x + 56, nw = R.w - 64, nm = PROFILE.name(), big = pixelTextWidth(nm, 2) <= nw;
  hubT(nm, nx, R.y + 10, hot ? '#ffd95c' : SC_GOLD, big ? 2 : 1);
  const rk = PROFILE.rank(), ranked = PROFILE.rankedN() > 0;
  if (ranked) { drawRankBadge(nx, R.y + 26, rk); hubT(RANK_TIERS[rankTier(rk)], nx + BADGE_PX + 2, R.y + 31, SC_TXT); }
  hubT(String(rk), R.x + R.w - 8 - pixelTextWidth(String(rk)), R.y + 31, SC_LBL);
  const w = list.filter((r) => r.w).length, l = list.length - w;
  if (list.length) hubT(tr('hub.record', { w, l }), nx, R.y + 44, SC_TXT);
  const last = list.slice(0, HUB_LAST), pip = Math.floor((R.w - 16 - 3 * (HUB_LAST - 1)) / HUB_LAST);
  for (let i = 0; i < HUB_LAST; i++) { ctx.fillStyle = i < last.length ? (last[i].w ? HUB_WIN : HUB_LOSS) : SC_ROW_B; ctx.fillRect(R.x + 8 + i * (pip + 3), R.y + 56, pip, 5); }
  const pr = hubPurseRect(L), ph = hit && hit.kind === 'purse';
  stampGrid(SK_COIN, SK_COIN_PAL, pr.x, pr.y, 1);
  hubT(String(PROFILE.coins()), pr.x + 11, pr.y + 1, ph ? '#ffd95c' : SC_LBL);
  const q = hubQuitRect(L);
  if (q) frBmp(q.x, q.y, HUB_QUIT, hit && hit.kind === 'quit' ? RM_BAD : SC_LBL);
  drawGear(); // the settings (js/ui/menu.js: gearRect stands it in this card)
}
// MATCH HISTORY: a row a match, newest first, your hero, the result, K/D/A, three of your items
function drawHubHistory(L, hit) {
  const R = L.hist, rows = hubHistRows(L), list = historyList(null), now = Date.now();
  hubPanel(R, 'hub.history', '', hit && (hit.kind === 'history' || hit.kind === 'match'));
  if (!rows.length) { hubT(tr('hub.noMatches'), R.x + 8, R.y + HUB_HEAD + 8, SC_DIM); return; }
  for (const r of rows) {
    const rec = list[r.i], y = historyYou(rec), won = !!rec.w, hot = hit && hit.kind === 'match' && hit.i === r.i;
    ctx.fillStyle = hot ? SC_HOT : won ? HUB_WIN_BG : HUB_LOSS_BG; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = won ? HUB_WIN : HUB_LOSS; ctx.fillRect(r.x, r.y, 2, r.h);
    pfFace(y.h, r.x + 6, r.y + 4, 23, 2, true);
    hubT(tr(won ? 'hub.win' : 'hub.loss'), r.x + 34, r.y + 6, won ? HUB_WIN : HUB_LOSS);
    const ago = historyAgo(rec.at, now); hubT(ago, r.x + r.w - 4 - pixelTextWidth(ago), r.y + 6, SC_DIM);
    hubT(y.k + '/' + y.d + '/' + y.a, r.x + 34, r.y + 18, SC_TXT);
    const its = (y.it || []).filter((id) => id && BUILD_ITEMS[id]).slice(0, 3);
    its.forEach((id, k) => { const ix = r.x + r.w - 4 - (3 - k) * 18; ctx.fillStyle = SC_INK; ctx.fillRect(ix - 1, r.y + 12, 18, 18); ctx.drawImage(itemIcon(id), ix, r.y + 13); });
  }
}
// a seat: an empty one a dark well with the gold + that invites; a person's
// card with the side's paint along its top, the face, the name, the crown
// over the leader, a guest's READY tick (top left) and link (top right)
function drawHubSeat(s, act, flash) {
  const p = s.p, me = p === player, x = s.x, y = s.y, w = s.w, h = s.h, fs = s.fs, fx = x + ((w - fs) >> 1), fy = y + 8;
  if (!isHuman(p)) {
    ctx.fillStyle = flash ? '#3a3e46' : act ? SC_HOT : SC_ROW_B; ctx.fillRect(x, y, w, h);
    hubRim(x, y, w, h, act ? SC_LBL : SC_EDGE);
    ctx.fillStyle = act ? SC_LBL : SC_EDGE; // the face's place, dotted
    for (let i = 0; i < fs; i += 2) { ctx.fillRect(fx + i, fy, 1, 1); ctx.fillRect(fx + i, fy + fs - 1, 1, 1); ctx.fillRect(fx, fy + i, 1, 1); ctx.fillRect(fx + fs - 1, fy + i, 1, 1); }
    if (seatsOpen()) drawPlusMark(fx + ((fs - 5) >> 1), fy + ((fs - 5) >> 1), act ? '#ffd95c' : SC_GOLD);
    return;
  }
  ctx.fillStyle = flash ? '#3a3e46' : act ? SC_HOT : me ? SC_YOU : SC_ROW_B; ctx.fillRect(x, y, w, h);
  hubRim(x, y, w, h, me ? '#c89a3c' : act ? SC_LBL : SC_EDGE);
  ctx.fillStyle = TEAMS[skin(p.team)].mark; ctx.fillRect(x + 1, y + 1, w - 2, 2);
  drawScoreFace(fx, fy, fs, { id: p.id, you: me, team: p.team, level: p.level || 1, sc: fs >= 40 ? 3 : 2 });
  if (p === roomHost()) drawCrown(fx + (fs >> 1) - 2, fy - 4);
  let nm = p.name || '';
  while (nm.length > 1 && pixelTextWidth(nm) > w - 6) nm = nm.slice(0, -1);
  hubT(nm, x + ((w - pixelTextWidth(nm)) >> 1), y + h - 10, me ? SC_GOLD : SC_LIT);
  const card = me ? null : NET.cards[p.id] || {}; // what they told the party of themselves (js/app/history.js)
  const by = fy + fs + 2; // the rank's badge between the face and the name, where the seat is tall enough
  if ((me ? PROFILE.rankedN() > 0 : wearsRank(card)) && by + BADGE_PX <= y + h - 12) drawRankBadge(x + ((w - BADGE_PX) >> 1), by, seatRank(p));
  if (wearsFounder(card)) drawFounderBadge(x + 3, y + h - 22); // js/ui/badges.js
  if (p !== roomHost()) { // a guest: READY's tick and the link to the leader, in the card's top corners
    if (NET.ready.has(p.id)) drawTick(x + 4, y + 6, RM_OK);
    drawPingBars(x + w - 12, y + 5, NET.pings[p.id]);
  }
  if (act === 'kick') drawXMark(x + w - 9, y + h - 22, '#e0524f');
}
// PLAY, the leader's: gold, dim until every friend is READY; while it
// looks, the clock in gold with the X that stops it. A guest's READY, green once said
function drawHubPlay(L, hot) {
  const g = L.go, lab = L.label, seeking = /^\d+:\d\d$/.test(lab), m = state.menu;
  const dim = (lab === 'play' && !roomAllReady()) || m.joining, ready = lab === 'ready' && NET.ready.has(localId);
  const word = seeking ? lab : tr(lab === 'ready' ? 'hub.ready' : 'hub.play'), k = pixelTextWidth(word, 3) <= g.w - 12 ? 3 : 2;
  if (seeking || lab === 'ready') {
    ctx.fillStyle = hot ? SC_HOT : SC_ROW_B; ctx.fillRect(g.x, g.y, g.w, g.h);
    hubRim(g.x, g.y, g.w, g.h, ready ? RM_OK : '#c89a3c');
    hubT(word, g.x + ((g.w - pixelTextWidth(word, k)) >> 1), g.y + ((g.h - 7 * k) >> 1), ready ? RM_OK : SC_GOLD, k);
    if (seeking) drawXMark(g.x + g.w - 10, g.y + 5, hot ? RM_BAD : SC_DIM);
    return;
  }
  ctx.fillStyle = dim ? SC_EDGE : '#7a5a1e'; ctx.fillRect(g.x, g.y + g.h - 2, g.w, 2);
  ctx.fillStyle = dim ? SC_ROW_B : hot ? '#d9aa48' : '#c89a3c'; ctx.fillRect(g.x, g.y, g.w, g.h - 2);
  if (!dim) { ctx.fillStyle = '#f2cc6a'; ctx.fillRect(g.x, g.y, g.w, 1); }
  hubT(word, g.x + ((g.w - pixelTextWidth(word, k)) >> 1), g.y + ((g.h - 2 - 7 * k) >> 1), dim ? SC_DIM : SC_INK, k);
}
// a foot plate: the one shape the chat, the X and JOIN share
function hubPlate(r, hot, on) {
  ctx.fillStyle = on ? SC_YOU : hot ? SC_HOT : SC_ROW_B; ctx.fillRect(r.x, r.y, r.w, r.h);
  hubRim(r.x, r.y, r.w, r.h, on ? '#c89a3c' : hot ? SC_LBL : SC_EDGE);
}
// the chat: at rest the ENTER key and the newest line, typing the line and its caret
function drawHubTalk(r, now, hot) {
  const m = state.menu, ty = r.y + ((r.h - 5) >> 1);
  hubPlate(r, hot, m.talkOn);
  ctx.save(); ctx.beginPath(); ctx.rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); ctx.clip();
  if (m.talkOn) {
    let t = m.talk;
    while (t && pixelTextWidth(t) > r.w - 14) t = t.slice(1); // a long line scrolls: its end stays in view
    hubT(t, r.x + 6, ty, SC_LIT);
    if (Math.floor(now * 2.5) % 2) { ctx.fillStyle = SC_GOLD; ctx.fillRect(r.x + 7 + pixelTextWidth(t), ty - 1, 1, 7); }
  } else {
    const key = tr('hub.enter');
    drawKeyCap(ctx, r.x + 4, r.y + ((r.h - 10) >> 1), key, false, hot);
    const c = NET.chat[NET.chat.length - 1], lx = r.x + 16 + pixelTextWidth(key);
    if (c) { const nm = c.name + ':'; hubT(nm, lx, ty, TEAMS[skin(c.team)].mark); hubT(c.s, lx + pixelTextWidth(nm) + 5, ty, SC_TXT); }
  }
  ctx.restore();
}
// JOIN: the four slots a friend's code goes in, gold while it is looked for, a rattle on a code nobody answers to
function drawHubJoin(r, now, hot) {
  const m = state.menu, on = m.codeOn || m.joining || !!m.seek;
  const dx = m.codeShake > 0 ? Math.round(Math.sin(m.codeShake * 60) * 2 * (m.codeShake / NAME_SHAKE_T)) : 0;
  const b = { x: r.x + dx, y: r.y, w: r.w, h: r.h };
  hubPlate(b, hot, on);
  const word = tr('hub.join'), ty = b.y + ((b.h - 5) >> 1);
  hubT(word, b.x + 6, ty, on || hot ? SC_TXT : SC_LBL);
  const pitch = 14, x0 = b.x + b.w - 6 - pitch * RM_CODE_N + 4, cy = b.y + ((b.h - 10) >> 1);
  for (let i = 0; i < RM_CODE_N; i++) {
    const cx = x0 + i * pitch, ch = m.code[i];
    if (ch) hubT(ch, cx, cy, m.codeShake > 0 ? RM_BAD : SC_GOLD, 2);
    else { ctx.fillStyle = i === m.code.length && m.codeOn && Math.floor(now * 2.5) % 2 ? SC_GOLD : hot ? SC_LBL : SC_DIM; ctx.fillRect(cx, cy + 10, 8, 1); }
  }
}
// PARTY: its head (the count, the code), the seats, PLAY, and the foot row
function drawHubStrip(L, now, hit) {
  const m = state.menu, R = L.strip;
  hubPanel(R, 'hub.party', '', false, false);
  const n = roomSide(player.team).filter(isHuman).length;
  hubT(n + '/' + partyCap(), R.x + 14 + pixelTextWidth(tr('hub.party')), R.y + 7, SC_DIM);
  const cr = hubCodeRect(L), up = !!(NET.transport && NET.transport.open);
  if (cr) {
    const col = !up ? SC_DIM : now - (m.copyAt || -9) < 0.5 ? SC_LIT : hit && hit.kind === 'code' ? '#ffd95c' : SC_GOLD;
    frBmp(cr.x, cr.y + 1, HUB_COPY, hit && hit.kind === 'code' ? '#ffd95c' : SC_DIM);
    hubT(roomCode(), cr.x + 9, cr.y + 1, col);
    if (!up && Math.floor(now * 3) % 2) { ctx.fillStyle = RM_BAD; ctx.fillRect(cr.x - 7, cr.y + 2, 4, 4); } // the link is down: the code would find nothing
  }
  if (!m.joining) for (const s of L.seats) {
    let act = hit && hit.kind === 'seat' && hit.id === s.p.id ? hit.act : null;
    if (!act && m.rseat === s.p.id && !hit && m.rkeys) act = seatAct(s) || 'none'; // the keys' cursor lights the seat too
    drawHubSeat(s, act === 'none' ? null : act, m.cardFx && m.cardFx[s.p.id] > 0);
    if (m.rkeys && m.rseat === s.p.id && !hit) { ctx.fillStyle = SC_GOLD; ctx.fillRect(s.x, s.y + s.h - 2, s.w, 2); }
  }
  const keyGo = m.rkeys && m.rseat === -1;
  drawHubPlay(L, hit ? hit.kind === 'go' : keyGo && m.rword === 1);
  if (L.leave) {
    const r = L.leave, hot = hit ? hit.kind === 'leave' : keyGo && m.rword === 0;
    hubPlate(r, hot, false);
    drawXMark(r.x + ((r.w - 5) >> 1), r.y + ((r.h - 5) >> 1), hot ? RM_BAD : SC_LBL);
  }
  if (L.talk) drawHubTalk(L.talk, now, hit && hit.kind === 'talk');
  else if (codeBoxShown() || m.joining) drawHubJoin(L.box, now, hit && hit.kind === 'box');
}
// HEROES: the hero, its title, four ability wells (one under the pointer gold), its numbers, and the arrows that walk the list
function drawHubHero(L, hit) {
  const R = L.hero, h = hubHero(), c = CLASSES[h];
  hubPanel(R, 'hub.heroes', '', hit && (hit.kind === 'heroes' || hit.kind === 'ab'), false); // the arrows stand where the step would
  for (const a of hubArrows(L)) frBmp(a.x + 3, a.y + 3, a.d < 0 ? HUB_CHEV_L : HUB_CHEV, hit && hit.kind === 'arrow' && hit.d === a.d ? '#ffd95c' : SC_LBL);
  const by = R.y + HUB_HEAD + 6, bh = R.h - HUB_HEAD - 12, spr = portraitSprite({ cls: h, team: skin(1), skins: {} });
  const k = spr.height * 3 <= bh - 4 ? 3 : 2;
  ctx.fillStyle = SC_ROW_B; ctx.fillRect(R.x + 8, by, 56, bh);
  ctx.save(); ctx.beginPath(); ctx.rect(R.x + 8, by, 56, bh); ctx.clip();
  ctx.drawImage(spr, R.x + 36 - ((spr.width * k) >> 1), by + bh - spr.height * k - 2, spr.width * k, spr.height * k);
  ctx.restore();
  const ax = R.x + 72;
  hubT(c.name, ax, by + 2, SC_GOLD);
  if (c.role) hubT(c.role, ax + pixelTextWidth(c.name) + 6, by + 2, SC_DIM);
  const wells = hubAbWells(L), lit = hit && hit.kind === 'ab' ? hit.i : -1;
  for (const w of wells) { hubWell(w, w.i === lit); ctx.drawImage(classAbIcon(h, w.i), w.x, w.y); }
  const ab = CLASS_AB[h][lit >= 0 ? lit : 0], cd = (Array.isArray(ab.cd) ? ab.cd[0] : ab.cd) + 'S', wy = wells[0].y + HUB_WELL + 5;
  const ww = wells.length * (HUB_WELL + HUB_WELL_GAP) - HUB_WELL_GAP;
  if (wy + 7 <= R.y + R.h - 4) { hubT(ab.name, ax, wy, SC_TXT); hubT(cd, ax + ww - pixelTextWidth(cd), wy, SC_DIM); }
  // what it does, as many of its lines as the panel holds
  wrapText(ab.blurb || '', R.x + R.w - 8 - ax).forEach((ln, i) => { const y = wy + 12 + i * 8; if (y + 6 <= R.y + R.h - 4) hubT(ln, ax, y, SC_LBL); });
  const sx = ax + ww + 12, bw = R.x + R.w - 8 - (sx + 22);
  if (bw < 12) return; // no room for the numbers beside the wells
  HUB_STAT.forEach(([lab, key], i) => {
    const y = wells[0].y + i * 9, mx = Math.max(...CLASSES.map((q) => q.base[key] || 0)), f = mx ? (c.base[key] || 0) / mx : 0;
    hubT(tr(lab), sx, y, SC_DIM);
    ctx.fillStyle = SC_ROW_B; ctx.fillRect(sx + 22, y + 1, bw, 4);
    ctx.fillStyle = '#6fa8dc'; ctx.fillRect(sx + 22, y + 1, Math.max(2, Math.round(bw * f)), 4);
  });
}
// ITEMS: that hero's build, its wells rimmed the shop's way, each price under it
function drawHubItems(L, hit) {
  const R = L.items, wells = hubItemWells(L);
  hubPanel(R, 'hub.items', CLASSES[hubHero()].name, hit && (hit.kind === 'items' || hit.kind === 'item'));
  wells.forEach((w, i) => {
    hubWell(w, hit && hit.kind === 'item' && hit.id === w.id, itemMetal(w.id).rim);
    ctx.drawImage(itemIcon(w.id), w.x, w.y, HUB_WELL, HUB_WELL);
    const next = wells[i + 1];
    if (next) frBmp(((w.x + w.w + next.x) >> 1) - 1, w.y + 13, ['#..', '##.', '###', '##.', '#..'], SC_EDGE);
    const pr = String(BUILD_ITEMS[w.id].price), py = w.y + HUB_WELL + 4;
    if (py + 7 <= R.y + R.h - 2) hubT(pr, w.x + ((w.w - pixelTextWidth(pr)) >> 1), py, SC_GOLD);
  });
}
// LADDER: the people around you by rating, you lit
function drawHubLadder(L, hit) {
  const R = L.ladder, me = PROFILE.pid();
  hubPanel(R, 'hub.ladder', '', hit && (hit.kind === 'ladder' || hit.kind === 'person'));
  for (const r of hubLadRows(L)) {
    const c = r.c, you = c.pid === me, hot = hit && hit.kind === 'person' && hit.c === c, rk = c.rk || PROFILE.RANK_START;
    if (you || hot) { ctx.fillStyle = hot ? SC_HOT : SC_YOU; ctx.fillRect(R.x + 1, r.y, R.w - 2, r.h + 2); }
    if (you) { ctx.fillStyle = SC_GOLD; ctx.fillRect(R.x + 1, r.y, 2, r.h + 2); }
    hubT(String(r.rank), R.x + 8, r.y + 5, SC_DIM);
    drawRankBadge(R.x + 24, r.y - 1, rk);
    let nm = String(c.n || '');
    while (nm.length > 1 && pixelTextWidth(nm) > R.w - 76) nm = nm.slice(0, -1);
    hubT(nm, R.x + 44, r.y + 5, you ? SC_GOLD : SC_TXT);
    hubT(String(rk), R.x + R.w - 8 - pixelTextWidth(String(rk)), r.y + 5, you ? SC_GOLD : SC_LBL);
  }
}

function renderRoom(now, a) {
  const m = state.menu, L = hubLayout();
  const hit = m.roomsT >= 1 ? roomHit() : null;
  ctx.globalAlpha = a;
  ctx.fillStyle = SC_BG; ctx.fillRect(0, 0, VIEW_W, VIEW_H); // flat, opaque: the page is the client, not a menu over the world
  ctx.fillStyle = '#16181d';
  for (let i = 0; i < 140; i++) { const h = (i * 2654435761) >>> 0; ctx.fillRect(h % VIEW_W, (h >>> 12) % VIEW_H, 1 + (i & 1), 1 + (i & 1)); } // faint snow, still
  drawHubCard(L, hit);
  drawHubHistory(L, hit);
  drawHubStrip(L, now, hit);
  drawHubHero(L, hit);
  drawHubItems(L, hit);
  drawSocial(L, now, hit); // FRIENDS (js/ui/friends.js)
  drawHubLadder(L, hit);
  ctx.globalAlpha = 1;
}
