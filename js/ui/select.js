'use strict';
// ------------------------------------------------------------ select look
// The champ select's pixels (the lobby, js/ui/menu.js `lobby`; its rules are
// the draft's, js/ui/draft.js), laid out the way League lays its own: the
// HEADLINE over a draining TIMER BAR and the seconds top centre, each side's
// BANS in its top corner, YOUR SIDE down the left as five SEAT ROWS (a
// portrait disc, the position, the hero, the name) and THE RIVALS down the
// right, the HERO GRID in the middle (js/ui/heroes.js), the CHAT bottom left
// (js/ui/roomtalk.js) and the MODE bottom right. Once your pick is locked the grid gives way to the
// SPLASH and the SKIN STRIP under it. Graphite and flat: the party room's
// colours (SC_*, js/ui/lobby.js), no bevels.
const SEL_ACCENT = 2;          // px: the bar down an acting row's outer edge
const SEL_DISC = 15;           // the portrait disc's radius
const SEL_TIMER_W = 200;       // the timer bar's full width
const SEL_RED = '#e04848';     // a ban
const SEL_GOLD = '#f2cc6a';    // you, and what you must do
const SKIN_THUMB_W = 48, SKIN_THUMB_H = 28, SKIN_THUMB_G = 6, SKIN_SHOW = 5; // a skin's thumbnail, and how many the strip shows
const SPLASH_W = 288, SPLASH_H = 160; // the splash art's size (a hero's skin, painted at 1x)

// ------------------------------------------------------------ positions
// A position's 11 px emblem: the map's square with its own lane lit (top,
// mid, bot), a pine for the jungle, a shield for support. 'W' takes the
// colour asked for, 'd' a dim of it.
const POS11 = (() => {
  const frame = () => Array.from({ length: 11 }, (_, y) => Array.from({ length: 11 }, (_, x) => (x === 0 || y === 0 || x === 10 || y === 10 ? 'd' : '.')));
  const top = frame();
  for (let i = 0; i < 7; i++) { top[0][i] = top[1][i] = top[i][0] = top[i][1] = 'W'; }
  const bot = frame();
  for (let i = 4; i < 11; i++) { bot[10][i] = bot[9][i] = bot[i][10] = bot[i][9] = 'W'; }
  const mid = frame();
  for (let y = 1; y < 10; y++) { mid[y][10 - y] = 'W'; if (10 - y - 1 > 0) mid[y][10 - y - 1] = 'W'; }
  const rows = (g) => g.map((r) => r.join(''));
  return [rows(top), [
    '.....W.....',
    '....WWW....',
    '...WWWWW...',
    '....WWW....',
    '..WWWWWWW..',
    '...WWWWW...',
    '.WWWWWWWWW.',
    '..WWWWWWW..',
    'WWWWWWWWWWW',
    '.....d.....',
    '.....d.....',
  ], rows(mid), rows(bot), [
    'WWWWWWWWWWW',
    'WdddddddddW',
    'WddddWddddW',
    'WddWWWWWddW',
    'WddddWddddW',
    'WddddWddddW',
    '.WddddddddW',
    '.WdddddddW.',
    '..WdddddW..',
    '...WdddW...',
    '....WWW....',
  ]];
})();
const pos11Cache = new Map();
function posIcon(r, col) {
  const key = r + col;
  let cv = pos11Cache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = 11;
    const g = cv.getContext('2d');
    POS11[r].forEach((row, y) => {
      for (let x = 0; x < 11; x++) {
        if (row[x] === '.') continue;
        g.fillStyle = col; g.globalAlpha = row[x] === 'W' ? 1 : 0.35;
        g.fillRect(x, y, 1, 1);
      }
    });
    pos11Cache.set(key, cv);
  }
  return cv;
}

// ------------------------------------------------------------ top band
// The headline (BAN A HERO!, PICK YOUR HERO!, PREPARE YOUR LOADOUT! once your
// pick is in and through the count), the bar under it draining toward the
// middle, the seconds under that - gold while this screen still has to act.
// Each side's bans sit in its own top corner, yours left: a vote standing
// as a dim face, a ban made as a face struck through in red.
function selHeadline() {
  const D = DRAFT;
  if (D.phase === 'ban') return 'BAN A HERO!';
  if (D.phase === 'pick' && D.lock[localId] < 0) return 'PICK YOUR HERO!';
  if (D.phase === 'wait') return 'PICK YOUR HERO!';
  return 'PREPARE YOUR LOADOUT!';
}
function selClock() {
  const D = DRAFT, m = state.menu;
  if (m.countT > 0) return { t: m.countT, f: m.countT / COUNT_T };
  if (!draftOpen()) return null;
  return { t: D.t, f: D.t / (D.phase === 'ban' ? DRAFT_BAN_T : DRAFT_PICK_T) };
}
function selActing() { return draftOpen() && DRAFT.lock[localId] < 0; }
function drawSelectTop(L, a) {
  const D = DRAFT, cx = L.cx;
  if (D.phase === 'off') return;
  ctx.globalAlpha = a;
  const head = selHeadline();
  drawPixelTextOutline(ctx, head, cx - (pixelTextWidth(head, 2) >> 1), 6, '#f4f7ff', SC_INK, 2);
  const c = selClock(), act = selActing(), col = act ? SEL_GOLD : SC_LBL;
  const bx = cx - (SEL_TIMER_W >> 1), by = 20;
  ctx.fillStyle = SC_EDGE; ctx.fillRect(bx, by, SEL_TIMER_W, 1);
  if (c) {
    const w = Math.round(SEL_TIMER_W * Math.max(0, Math.min(1, c.f)));
    ctx.fillStyle = col; ctx.fillRect(cx - (w >> 1), by, w, 1);
    const s = String(Math.ceil(c.t));
    drawPixelTextOutline(ctx, s, cx - (pixelTextWidth(s, 3) >> 1), by + 5, state.menu.countT > 0 ? SEL_GOLD : act ? SEL_GOLD : '#f4f7ff', SC_INK, 3);
  }
  for (let t = 0; t < 2; t++) {
    const mine = t === player.team, n = D.nBan;
    for (let k = 0; k < n; k++) {
      const x = mine ? LOBBY_PAD + k * 24 : VIEW_W - LOBBY_PAD - 22 - k * 24, y = LOBBY_PAD;
      ctx.fillStyle = SC_EDGE; ctx.fillRect(x, y, 22, 22);
      ctx.fillStyle = SC_INK; ctx.fillRect(x + 1, y + 1, 20, 20);
      ctx.fillStyle = TEAMS[skin(t)].mark; ctx.fillRect(x, y + 23, 22, 1);
      const h = D.lead[t] ? D.lead[t][k] : undefined;
      if (h == null || !CLASSES[h]) continue;
      const made = D.phase !== 'ban';
      draftFace(h, x + 1, y + 1, 1, made ? 0.55 : 0.35);
      if (made) draftSlash(x + 1, y + 1, 20);
    }
  }
}

// ------------------------------------------------------------ seat rows
// One seat: League's row. Your side's, left: the portrait disc (the hero
// pointed at, faded until locked; empty, the seat's position emblem), and
// beside it three lines - what the seat is doing (PICKING...) or its
// position, the hero big, the player's name. A rival's, right and mirrored:
// face-down through the draft (only that it has locked), turned at the
// reveal. The row acting wears a bar down its outer edge (gold for yours)
// and the seconds point at your own row while you have to act.
const selDiscCv = document.createElement('canvas');
selDiscCv.width = selDiscCv.height = SEL_DISC * 2 + 1;
const selDiscG = selDiscCv.getContext('2d');
const selDiscMask = (() => { // the disc's inside, cut once: a face is trimmed to it in one stroke
  const cv = document.createElement('canvas'), R = SEL_DISC - 1;
  cv.width = cv.height = SEL_DISC * 2 + 1;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff';
  for (let dy = -R; dy <= R; dy++) { const hw = Math.floor(Math.sqrt(R * R - dy * dy)); g.fillRect(SEL_DISC - hw, SEL_DISC + dy, hw * 2 + 1, 1); }
  return cv;
})();
function drawSelDisc(cx, cy, ring, h, look, team, alpha, pos, skinId) {
  ctx.fillStyle = ring; pxDisc(cx, cy, SEL_DISC);
  ctx.fillStyle = SC_INK; pxDisc(cx, cy, SEL_DISC - 1);
  if (h >= 0) {
    const g = selDiscG, S = HERO_CROP.s, n = SEL_DISC * 2 + 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, n, n);
    const f = heroHead(h, look, team, skinId);
    g.drawImage(f.img, f.x, f.y, f.w, f.w, SEL_DISC - S, SEL_DISC - S + 2, S * 2, S * 2);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(selDiscMask, 0, 0);
    g.globalCompositeOperation = 'source-over';
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * alpha;
    ctx.drawImage(selDiscCv, cx - SEL_DISC, cy - SEL_DISC);
    ctx.globalAlpha = a;
  } else if (pos >= 0) ctx.drawImage(posIcon(pos, SC_DIM), cx - 5, cy - 5);
}
// the little trade mark under your own disc: the way to another position
function selSwapRect(r) { return { x: r.x + 26 + 7, y: r.y + (r.h >> 1) + 8, w: 9, h: 9 }; }
function drawSelSwap(r, hot) {
  const s = selSwapRect(r);
  ctx.fillStyle = hot ? SC_LIT : SC_EDGE; ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = SC_PLATE; ctx.fillRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
  ctx.fillStyle = hot ? SEL_GOLD : SC_LBL; // two arrows, one each way
  ctx.fillRect(s.x + 2, s.y + 3, 5, 1); ctx.fillRect(s.x + 5, s.y + 2, 1, 1);
  ctx.fillRect(s.x + 2, s.y + 5, 5, 1); ctx.fillRect(s.x + 3, s.y + 6, 1, 1);
}
function drawSeatRow(r, mine, hidden, flash, hot) {
  const p = r.p, D = DRAFT, me = p === player, team = skin(p.team), mark = TEAMS[team].mark;
  const role = mine ? D.role[p.id] : -1;
  const acting = draftOpen() && D.lock[p.id] === -1;
  const banning = D.phase === 'ban';
  let h = -1, firm = true;
  if (mine && D.phase === 'pick') { h = draftWant(p.id); firm = D.lock[p.id] >= 0; }
  else if (mine && banning) { h = D.hover[p.id]; firm = false; }
  else if (!hidden && (D.phase === 'done' || D.phase === 'off')) h = p.cls;
  if (me) { ctx.fillStyle = SC_YOU; ctx.fillRect(r.x, r.y, r.w, r.h - 1); }
  if (acting) { ctx.fillStyle = me ? SEL_GOLD : mark; ctx.fillRect(mine ? r.x : r.x + r.w - SEL_ACCENT, r.y, SEL_ACCENT, r.h - 1); }
  ctx.fillStyle = SC_EDGE; ctx.fillRect(r.x + 8, r.y + r.h - 1, r.w - 16, 1);
  const dx = mine ? r.x + 26 : r.x + r.w - 26, dy = r.y + (r.h >> 1);
  const ring = h >= 0 && banning ? SEL_RED : h >= 0 && firm ? mark : me ? SEL_GOLD : SC_EDGE;
  const look = h >= 0 ? CLASSES[h].look : p.look;
  const worn = h >= 0 && CLASSES[h].skinSlot && p.skins ? p.skins[CLASSES[h].skinSlot] || null : null; // the look this seat wears
  drawSelDisc(dx, dy, ring, h, look, team, firm ? 1 : 0.45, role, worn);
  if (h >= 0 && banning && D.lock[p.id] >= 0) draftSlash(dx - 10, dy - 10, 21);
  if (me && draftOpen()) drawSelSwap(r, hot === 'swap');
  // the three lines
  const tx = (s, sc) => mine ? r.x + 48 : r.x + r.w - 48 - pixelTextWidth(s, sc);
  const status = acting ? (banning ? 'BANNING...' : 'PICKING...') : '';
  let l1, l2, l3 = p.name, c2 = '#f4f7ff';
  if (mine) {
    l1 = status || (role >= 0 ? POSITIONS[role].name : '');
    if (h >= 0 && !banning) { l2 = CLASSES[h].name; if (!firm) c2 = SC_DIM; if (!status && role < 0) l1 = ''; }
    else { l2 = role >= 0 ? POSITIONS[role].name : p.name; if (role >= 0) l1 = status; else l3 = ''; }
  } else if (hidden) {
    l1 = D.phase === 'pick' ? (acting ? 'PICKING...' : 'LOCKED IN') : '';
    l2 = p.name; l3 = '';
  } else { l1 = ''; l2 = h >= 0 ? CLASSES[h].name : p.name; }
  const c1 = acting && me ? SEL_GOLD : me && !status ? SEL_GOLD : SC_DIM;
  const s2 = pixelTextWidth(l2, 2) <= r.w - 52 ? 2 : 1; // a long name in a narrow column drops to 1x
  const ty = r.y + ((r.h - 27) >> 1); // the three lines' block, centred on the row
  if (l1) drawPixelText(ctx, l1, tx(l1, 1), ty, c1, 1);
  drawPixelTextShadow(ctx, l2, tx(l2, s2), ty + (s2 > 1 ? 8 : 11), me && h < 0 ? SC_LIT : c2, SC_INK, s2);
  if (l3) drawPixelText(ctx, l3, tx(l3, 1), ty + 22, me ? SC_LBL : SC_DIM, 1);
  if (flash) { ctx.fillStyle = '#f4f7ff'; ctx.globalAlpha *= 0.6; ctx.fillRect(r.x, r.y, r.w, r.h - 1); }
}
// both columns; a rival row stays face-down until lobbyRevealed() passes it,
// and the seconds point at your row while you have to act
function drawSeats(L, a, hot) {
  const m = state.menu, shown = draftHiding() ? 0 : lobbyRevealed();
  for (let mine = 1; mine >= 0; mine--) {
    const col = L.cards[mine];
    for (let k = 0; k < col.length; k++) {
      const r = col[k];
      const hidden = !mine && k >= shown;
      const flash = !mine && !hidden && m.countT > 0 && (COUNT_T - k) - m.countT < 0.15;
      ctx.globalAlpha = a;
      drawSeatRow(r, mine, hidden, flash, mine && r.p === player ? hot : null);
    }
  }
  const c = selClock(), mineR = L.cards[1].find((r) => r.p === player);
  if (c && selActing() && mineR) {
    ctx.globalAlpha = a;
    const s = String(Math.ceil(c.t)), x = mineR.x + mineR.w + 6, y = mineR.y + (mineR.h >> 1) - 5;
    ctx.fillStyle = SEL_GOLD;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 - i, y + 5 - i, 1, i * 2 + 1);
    drawPixelTextOutline(ctx, s, x + 7, y, '#f4f7ff', SC_INK, 2);
  }
}

// ------------------------------------------------------------ splash
// Your locked hero, big, in the middle once the grid has done its work: the
// skin's splash art (heroSplash) or, for a look with none painted, the
// hero's model at 3x on a slice of the valley's night - and its look's name
// under it. A hero's splash is SPLASH_W x SPLASH_H at 1x, its strip
// thumbnail SKIN_THUMB_W x SKIN_THUMB_H (heroThumb), both baked by
// app/bake-splash.js from docs/media/splash/<slot>-<id>(-thumb).png.
const SPLASH_PICS = {}; // '<slot>-<id>' and '<slot>-<id>-thumb' -> Image, decoded at load
for (const [k, src] of Object.entries(window.SPLASH_ART || {})) { const img = new Image(); img.src = src; SPLASH_PICS[k] = img; }
function splashPic(h, id, tail) {
  const slot = CLASSES[h] && CLASSES[h].skinSlot, img = slot && id ? SPLASH_PICS[slot + '-' + id + tail] : null;
  return img && img.complete && img.naturalWidth ? img : null;
}
function heroSplash(h, id) { return splashPic(h, id, ''); }
function heroThumb(h, id) { return splashPic(h, id, '-thumb'); }
function selSkinRows(h) {
  const c = CLASSES[h], tab = c && c.skinSlot ? SKIN_TABS.find((t) => t.hero === h) : null;
  return tab ? tab.rows.map((r) => ({ r, tab, own: skinHas(tab, r) })) : [{ r: { id: null, name: c.name, rarity: 'common' }, tab: null, own: true }];
}
function selSkinWorn(h) {
  const c = CLASSES[h], id = c && c.skinSlot && player.skins ? player.skins[c.skinSlot] || null : null;
  const rows = selSkinRows(h), k = rows.findIndex((s) => s.r.id === id);
  return k > 0 ? k : 0;
}
function drawSplash(L, now, a) {
  const S = L.splash, h = player.cls, k = selSkinWorn(h), rows = selSkinRows(h), row = rows[k].r;
  ctx.globalAlpha = a;
  ctx.fillStyle = SC_EDGE; ctx.fillRect(S.x - 1, S.y - 1, S.w + 2, S.h + 2);
  const art = heroSplash(h, row.id);
  if (art) ctx.drawImage(art, (art.width - S.w) >> 1, (art.height - S.h) >> 1, S.w, S.h, S.x, S.y, S.w, S.h); // a narrow view keeps the middle
  else { // the stand-in: the model on the night, under its light
    ctx.save(); ctx.beginPath(); ctx.rect(S.x, S.y, S.w, S.h); ctx.clip();
    const sky = ctx.createLinearGradient(0, S.y, 0, S.y + S.h);
    sky.addColorStop(0, '#05070f'); sky.addColorStop(0.62, '#141c3c'); sky.addColorStop(0.63, '#1b2650'); sky.addColorStop(1, '#0a0f26');
    ctx.fillStyle = sky; ctx.fillRect(S.x, S.y, S.w, S.h);
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(now * (0.6 + hash2(i, 7)) + i)));
      ctx.fillStyle = '#dfe8f4';
      ctx.fillRect(S.x + Math.floor(hash2(i, 41) * S.w), S.y + Math.floor(hash2(i, 43) * S.h * 0.55), 1, 1);
    }
    ctx.globalAlpha = a;
    const feet = S.y + S.h - 12, sc = 3, bw = 48 * sc;
    ctx.fillStyle = 'rgba(4,6,18,0.5)';
    ctx.beginPath(); ctx.ellipse(L.cx, feet, 36, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(SPRITES.portrait(h, player.look, skin(player.team), row.id), L.cx - (bw >> 1), feet - 46 * sc + Math.round(Math.sin(now * 1.6)), bw, bw); // a named hero in the look picked on the strip
    ctx.restore();
  }
  const nm = k > 0 ? row.name + ' ' + CLASSES[h].name : CLASSES[h].name;
  drawPixelTextOutline(ctx, nm, L.cx - (pixelTextWidth(nm, 2) >> 1), S.y + S.h + 6, '#f4f7ff', SC_INK, 2);
}

// ------------------------------------------------------------ skin strip
// Under the splash: the hero's looks, SKIN_SHOW at a time, the worn one in
// gold, one this profile does not own dimmed with a lock; the chevrons walk
// the window when there are more. A thumbnail is its splash's own
// SKIN_THUMB_W x SKIN_THUMB_H (heroThumb; a look with none: its body at 2x).
function selSkinCells(L) {
  const h = player.cls, rows = selSkinRows(h);
  const fit = Math.max(1, Math.floor((L.splash.w + SKIN_THUMB_G) / (SKIN_THUMB_W + SKIN_THUMB_G)));
  const n = Math.min(SKIN_SHOW, fit, rows.length), w = n * SKIN_THUMB_W + (n - 1) * SKIN_THUMB_G;
  const off = Math.max(0, Math.min(state.menu.skinOff | 0, rows.length - n));
  const x0 = L.cx - (w >> 1), y = L.skins.y;
  const cells = [];
  for (let i = 0; i < n; i++) cells.push({ x: x0 + i * (SKIN_THUMB_W + SKIN_THUMB_G), y, w: SKIN_THUMB_W, h: SKIN_THUMB_H, k: off + i, s: rows[off + i] });
  const full = Math.min(SKIN_SHOW, fit) * SKIN_THUMB_W + (Math.min(SKIN_SHOW, fit) - 1) * SKIN_THUMB_G;
  return { cells, more: rows.length > n, prev: { x: L.cx - (full >> 1) - 16, y, w: 10, h: SKIN_THUMB_H }, next: { x: L.cx + (full >> 1) + 6, y, w: 10, h: SKIN_THUMB_H } };
}
function drawSkinStrip(L, a, hot) {
  const h = player.cls, worn = selSkinWorn(h), { cells, more, prev, next } = selSkinCells(L);
  ctx.globalAlpha = a;
  for (const c of cells) {
    const on = c.k === worn, hv = hot === 'skin' + c.k;
    ctx.fillStyle = on ? SEL_GOLD : hv && c.s.own ? SC_LBL : SC_EDGE; ctx.fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
    ctx.fillStyle = SC_INK; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.save(); ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
    ctx.fillStyle = SKIN_RARITY[c.s.r.rarity] || SC_EDGE; ctx.globalAlpha = a * 0.18; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.globalAlpha = a * (c.s.own ? 1 : 0.35);
    const thumb = heroThumb(h, c.s.r.id);
    if (thumb) ctx.drawImage(thumb, c.x, c.y);
    else ctx.drawImage(SPRITES.champLook(h, CLASSES[h].look, skin(player.team), c.k > 0 ? c.s.r.id : null).down[0], c.x + (c.w >> 1) - 16, c.y - 1, 32, 32);
    ctx.restore();
    ctx.globalAlpha = a;
    ctx.fillStyle = SKIN_RARITY[c.s.r.rarity] || SC_EDGE; ctx.fillRect(c.x, c.y + c.h - 1, c.w, 1);
    if (!c.s.own) { // the lock
      const lx = c.x + c.w - 9, ly = c.y + 3;
      ctx.fillStyle = SC_LBL; ctx.fillRect(lx + 1, ly, 4, 1); ctx.fillRect(lx, ly + 1, 1, 2); ctx.fillRect(lx + 5, ly + 1, 1, 2); ctx.fillRect(lx - 1, ly + 3, 8, 5);
      ctx.fillStyle = SC_INK; ctx.fillRect(lx + 2, ly + 5, 2, 2);
    }
  }
  if (more) {
    drawSelChevron(prev, -1, hot === 'skinPrev');
    drawSelChevron(next, 1, hot === 'skinNext');
  }
}
function drawSelChevron(r, d, hot) {
  ctx.fillStyle = hot ? SEL_GOLD : SC_LBL;
  const cy = r.y + (r.h >> 1);
  for (let i = 0; i < 5; i++) { const x = d < 0 ? r.x + 4 + i : r.x + 6 - i; ctx.fillRect(x, cy - 5 + i, 1, 1); ctx.fillRect(x, cy + 5 - i, 1, 1); }
  ctx.fillRect(d < 0 ? r.x + 3 : r.x + 7, cy, 1, 1);
}

// ------------------------------------------------------------ foot
// The foot: the match bottom right - its size and its mode - and the confirm
// plate under the grid.
function selModeName() { return PARTY_MODES[NET.mode] || (PRACTICE ? 'PRACTICE TOOL' : 'QUICKPLAY'); }
function drawSelMode(L, a) {
  const mode = selModeName(), size = '5V5';
  const rx = VIEW_W - LOBBY_PAD;
  ctx.globalAlpha = a;
  drawPixelText(ctx, size, rx - pixelTextWidth(size), L.mode.y, SC_LBL, 1);
  drawPixelTextShadow(ctx, mode, rx - pixelTextWidth(mode, 2), L.mode.y + 8, '#f4f7ff', SC_INK, 2);
}
// LOCK IN (BAN in the ban phase) on its plate under the grid: white and
// live while there is a confirm to make, gold under the hand, red for a
// ban, slate once made; gone with the splash
function drawSelPlay(L, a, hot) {
  const dw = draftWord(), r = L.play;
  if (!dw) return;
  const live = dw.live, ban = DRAFT.phase === 'ban', hv = live && hot === 'play';
  const pressed = live && (state.menu.pressT > 0 || (mouse.down && hv));
  ctx.globalAlpha = a;
  const edge = !live ? SC_EDGE : hv ? SEL_GOLD : ban ? SEL_RED : SC_LBL;
  ctx.fillStyle = edge; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = live ? (ban ? '#2a1418' : SC_HOT) : SC_PLATE; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const y = r.y + ((r.h - 10) >> 1) + (pressed ? 1 : 0);
  drawPixelTextShadow(ctx, dw.w, r.x + ((r.w - pixelTextWidth(dw.w, 2)) >> 1), y, !live ? SC_DIM : hv ? SEL_GOLD : '#f4f7ff', SC_INK, 2);
}
