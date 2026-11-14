'use strict';
// The champ select (menu.screen = 'lobby') and the hero pop-up over it: every
// rect of the screen, what the pointer is on, the clicks and keys, the stage
// and the screen's draw. Its pixels are js/ui/select.js, its rules
// js/ui/draft.js, its hero grid js/ui/heroes.js; the title screen it rides
// (renderTitle, menuKey, menuClick) is js/ui/menu.js.

// ------------------------------------------------------------ lobby
// The HERO SELECT (menu.screen = 'lobby'), where a party's FIND MATCH lands
// (js/ui/rooms.js) and every member follows (netPhase 'pick'): League's champ
// select in Softfall's graphite, ONE screen over its own painted night -
// never the live world - running the DRAFT (js/ui/draft.js: the positions,
// the bans, then everyone's blind pick, then the reveal); its pixels are
// js/ui/select.js. The HEADLINE, the timer bar and the seconds top centre,
// each side's bans in its top corner. YOUR SIDE's five seat rows down the
// left in position order, THE RIVALS' down the right, face-down until the
// count turns them. In the middle the FILTER ROW (the positions, the search)
// over the HERO GRID (js/ui/heroes.js), the STAGE under it - the hero you
// point at, the 48 px model at LOBBY_MODEL under its warm light, the way
// into the HERO POP-UP (the stats and the abilities, `the hero pop-up`
// below) - and the confirm plate (BAN / LOCK IN: draftConfirm). Once your
// pick is locked the SPLASH and its SKIN STRIP take the middle. At the foot
// the CHAT bottom left (js/ui/roomtalk.js, your side's only) and the match's
// size and mode bottom right; the bots' level is the leader's, set on the
// party screen (js/ui/rooms.js). When the pick ends the COUNTDOWN runs in
// the top band (draftCount): a gold ring bursting off the figure (lockFx),
// one rival row turning face-up per tick, and at zero lockIn() flies to the
// eagle (lockT -> beginDrop). Nothing on the screen is instructions: the
// shapes carry it.
const LOBBY_PANEL_W = 148;               // a side's column of seat rows at its widest, glued to its screen edge
const LOBBY_PANEL_MIN = 104;             // ...and its narrowest: a narrow view drops grid columns before going under it
const LOBBY_GUTTER = 30;                 // between a column and the grid: the seconds that point at your row (drawSeats: arrow and two 2x digits, 28 px)
const LOBBY_ROW_MAX = 44;                // a seat row's tallest; a short view shrinks it...
const LOBBY_ROW_MIN = 34;                // ...to this: the portrait disc and the three lines
const LOBBY_HEAD = 44;                   // the band over the columns and the grid: the headline, the clock, the bans
const LOBBY_MODEL = 2;                   // the stage model's scale under the grid: the 48 px model at 2x
const LOBBY_PAD = 6;                     // the margin off the view's edge
const LOBBY_CHAT_LINES = 6;              // the chat's lines over its plate, bottom left
const COUNT_T = 5;                     // s: LOCK IN's countdown to the eagle
function lobbyLayout() {
  const cx = Math.round(VIEW_W / 2), pad = LOBBY_PAD;
  // the grid takes six heroes a row where the view is wide enough for the
  // columns beside it, fewer on a narrow (4:3) one
  const gridW = (n) => n * HERO_CELL + (n - 1) * HERO_GAP;
  let cols = 6;
  while (cols > 3 && (VIEW_W - gridW(cols) - 2 * LOBBY_GUTTER) / 2 < LOBBY_PANEL_MIN) cols--;
  const gw = gridW(cols), pw = Math.min(LOBBY_PANEL_W, Math.floor((VIEW_W - gw - 2 * LOBBY_GUTTER) / 2));
  // the chat bottom left: its plate on the foot, its lines over it
  const chat = { x: pad, w: pw - pad - 4, ty: VIEW_H - pad - TALK_H, lines: LOBBY_CHAT_LINES };
  // the seat rows: five a side under the head (a 1V1's one), down to the
  // chat (which keeps two lines at the least); yours in position order (TOP
  // first), the rivals' in seat order; an empty seat is out of the match
  const room = chat.ty - 6 - 2 * TALK_PITCH - LOBBY_HEAD;
  const fh = Math.max(LOBBY_ROW_MIN, Math.min(LOBBY_ROW_MAX, Math.floor(room / (MAX_PLAYERS / 2))));
  chat.lines = Math.max(1, Math.min(LOBBY_CHAT_LINES, Math.floor((chat.ty - 6 - LOBBY_HEAD - fh * (MAX_PLAYERS / 2)) / TALK_PITCH)));
  const cards = [[], []];
  const mineTeam = player ? player.team : 0;
  const role = (p) => DRAFT.role[p.id] >= 0 ? DRAFT.role[p.id] : 9;
  const ours = players.filter((p) => p.active && p.team === mineTeam).sort((p, q) => role(p) - role(q) || p.id - q.id);
  for (const p of ours.concat(players.filter((p) => p.active && p.team !== mineTeam))) {
    const mine = p.team === mineTeam ? 1 : 0;
    const y = LOBBY_HEAD + cards[mine].length * fh;
    cards[mine].push({ x: mine ? 0 : VIEW_W - pw, y, w: pw, h: fh, p });
  }
  // the middle column: the filter row, the grid, LOCK IN at the foot
  const gx = cx - (gw >> 1);
  const play = { x: cx - 56, y: VIEW_H - pad - 4 - 20, w: 112, h: 20 };
  const filter = { y: LOBBY_HEAD };
  const grid = { x: gx, y: LOBBY_HEAD + 19, w: gw };
  const L = { cx, pw, play, filter, grid, cards, chat };
  L.pitch = heroPitch(L);
  L.heroes = heroCells(L);
  // the stage under the grid: the hero pointed at, standing at 2x, when the
  // view has the room for it under the grid's last row
  const last = L.heroes.length ? L.heroes[L.heroes.length - 1].y + L.pitch : grid.y;
  const S = LOBBY_MODEL, bs = 48 * S, feet = play.y - 10;
  L.S = S;
  L.body = { x: cx - (bs >> 1), y: feet - 46 * S, w: bs, h: bs };
  L.stage = feet - 44 * S >= last + 4;
  L.figure = L.stage ? { x: L.body.x + 14 * S, y: L.body.y + 4 * S, w: 20 * S, h: 42 * S } : { x: 0, y: 0, w: 0, h: 0 };
  // the showcase and its skin strip take the middle once your pick is in
  const sh = Math.min(SHOW_H, play.y - LOBBY_HEAD - 20 - SKIN_THUMB_H - 8);
  const sw = Math.min(SHOW_W, VIEW_W - 2 * pw - 16);
  L.show = { x: cx - (sw >> 1), y: LOBBY_HEAD, w: sw, h: sh };
  L.skins = { y: L.show.y + sh + 20 };
  // bottom right, under the rivals: the match's size and mode
  L.mode = { y: VIEW_H - pad - 18 };
  return L;
}
// the showcase stands in the middle: this screen's pick is locked, or the count runs
function lobbyShowcase() { return (DRAFT.phase === 'pick' && DRAFT.lock[localId] >= 0) || DRAFT.phase === 'done'; }

// The screen's own painted night, fully opaque at rest so the live ambient
// world is never the backdrop here: a starfield under two aurora ribbons, a
// snow-crested ridge over a pine line, a lit snow floor, slow snowfall, and
// the cinematic band. All procedural - hash2/vnoise for the stillness, now
// for the drift - and everything takes the caller's fade.
function drawLobbyBackdrop(now, a) {
  const toy = frameTop();
  const hz = toy + 150; // the horizon the figures stand against
  ctx.globalAlpha = a;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#04060f'); sky.addColorStop(0.7, '#0a1024'); sky.addColorStop(1, '#141c3c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_W, hz);
  const gr = ctx.createLinearGradient(0, hz, 0, VIEW_H);
  gr.addColorStop(0, '#1b2650'); gr.addColorStop(0.5, '#141c3c'); gr.addColorStop(1, '#0a0f26');
  ctx.fillStyle = gr; ctx.fillRect(0, hz, VIEW_W, VIEW_H - hz);
  for (let i = 0; i < 70; i++) { // stars, twinkling out of phase
    const sx = Math.floor(hash2(i, 11) * VIEW_W), sy = Math.floor(hash2(i, 23) * (hz - 34));
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(now * (0.6 + hash2(i, 7)) + i));
    ctx.globalAlpha = a * tw * 0.8;
    ctx.fillStyle = hash2(i, 3) > 0.8 ? '#9fd8ff' : '#dfe8f4';
    ctx.fillRect(sx, sy, 1, 1);
  }
  ctx.globalCompositeOperation = 'lighter'; // the aurora breathes over the stars
  for (let b = 0; b < 2; b++) {
    const ay = toy + 44 + b * 26;
    ctx.fillStyle = b ? '#2c6ec8' : '#2cc890';
    for (let x = 0; x < VIEW_W; x += 2) {
      const yy = ay + Math.sin(x * 0.018 + now * (0.4 + b * 0.15) + b * 2.4) * 13;
      const hgt = 14 + Math.sin(x * 0.03 + now * 0.5) * 5;
      ctx.globalAlpha = a * 0.05;
      ctx.fillRect(x, Math.round(yy - hgt), 2, Math.round(hgt * 1.6));
      ctx.fillRect(x, Math.round(yy - hgt * 0.4), 2, Math.round(hgt * 0.7));
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = a;
  for (let x = 0; x < VIEW_W; x++) { // the ridge, its crest catching the sky
    const h = 16 + vnoise(x * 0.028, 7.3) * 34 + vnoise(x * 0.11, 3.1) * 8;
    ctx.fillStyle = '#0b1128';
    ctx.fillRect(x, hz - Math.round(h), 1, Math.round(h));
    ctx.fillStyle = '#2a3a6e';
    ctx.fillRect(x, hz - Math.round(h), 1, 1);
  }
  ctx.fillStyle = '#070b1c';
  for (let x = 0; x < VIEW_W; x += 7) { // the pine line at the ridge's feet
    const ph = 6 + Math.floor(hash2(x, 91) * 8);
    const px = x + Math.floor(hash2(x, 17) * 5);
    for (let k = 0; k < ph; k++) {
      const w = Math.max(1, Math.round((k / ph) * 5));
      ctx.fillRect(px - w, hz - ph + k, w * 2 + 1, 1);
    }
  }
  ctx.fillStyle = '#9fb6d8';
  for (let i = 0; i < 60; i++) { // glints in the snow floor
    const gx = Math.floor(hash2(i, 41) * VIEW_W);
    const gy = hz + 4 + Math.floor(hash2(i, 43) * Math.max(1, VIEW_H - hz - 6));
    ctx.globalAlpha = a * (0.1 + 0.18 * hash2(i, 5));
    ctx.fillRect(gx, gy, 1, 1);
  }
  ctx.fillStyle = '#dfe8f4';
  for (let i = 0; i < 46; i++) { // slow snowfall, stateless off the clock
    const fx = (hash2(i, 63) * VIEW_W + now * (4 + hash2(i, 67) * 8)) % VIEW_W;
    const fy = (hash2(i, 65) * VIEW_H + now * (12 + hash2(i, 61) * 16)) % VIEW_H;
    ctx.globalAlpha = a * 0.5;
    ctx.fillRect(Math.floor(fx), Math.floor(fy), 1, 1);
  }
  ctx.globalAlpha = a; // the cinematic band, heavier top and bottom
  const v = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  v.addColorStop(0, 'rgba(3,5,16,0.8)'); v.addColorStop(0.16, 'rgba(3,5,16,0)');
  v.addColorStop(0.85, 'rgba(3,5,16,0)'); v.addColorStop(1, 'rgba(3,5,16,0.9)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ the hero pop-up
// Opened by clicking your character on the lobby (beginHero). The lobby
// stays lit underneath; the pop-up dims it and floats a panel in two
// columns. LEFT: the live preview - the chosen class walking in place with
// the class weapon at hand, and under it the STAT LEDGER: every number the
// kit flies out with, real values from the same code the sim reads (baseKit,
// js/sim/player.js). RIGHT: the ABILITIES column, one well a key (1-4)
// wearing its ability's icon with the key in the corner, and a hover raises
// its card (tipClassAb, js/ui/tooltip.js): what the key will do, read
// before the eagle - its growth is the match's own (skill points), never
// bought here. The ledger is the hero's seven stats at level 1 (STAT_ROWS,
// js/sim/stats.js), the PLAYER-panel text carve-out: comparing numbers is
// this panel's whole job. ESC, Backspace, the X, or a click outside the panel
// closes it; LOCK IN stays on the lobby behind it. The keyboard walks
// menu.grow down the ability column, naming the well it is on.
const HERO_WELL = 38, HERO_WELL_G = 4;               // an ability well, and the gap between wells
function heroLayout() {
  const cx = Math.round(VIEW_W / 2);
  const ledW = 118;
  const pw = 8 + ledW + 10 + HERO_WELL + 8;
  const ph = 206;
  const px = cx - (pw >> 1), py = Math.round((VIEW_H - ph) / 2);
  const ax = px + 8 + ledW + 10;
  const abils = [0, 1, 2, 3].map((i) => ({ x: ax, y: py + 12 + i * (HERO_WELL + HERO_WELL_G), w: HERO_WELL, h: HERO_WELL, i }));
  // the ledger: a row a stat, under the preview
  const led = { x: px + 8, y: py + 94, w: ledW };
  return { cx, panel: { x: px, y: py, w: pw, h: ph }, abils,
    prev: { x: px + 8, y: py + 8, w: ledW, h: 78 },   // the preview well
    led,                                               // the ledger below it
    name: { x: cx, y: py + 190 },                      // the hovered well's name
    xr: { x: px + pw - 14, y: py + 4, w: 10, h: 10 } };
}

// what the pointer is over on the hero pop-up: {ab} (an ability well), 'x', 'panel' (the slab itself - inert, swallows the
// press, the ledger included), or null (outside: a click closes)
function heroScreenHit() {
  const { abils, panel, xr } = heroLayout();
  if (overRect(xr, 3)) return 'x';
  for (const w of abils) if (overRect(w, 0, 1)) return { ab: w.i };
  return popFrameHit(panel, xr);
}
function beginHero() {
  state.menu.grow = 0;
  openPop('hero');
}
function leaveHero() { leavePop(); }
function heroKey(k) {
  const m = state.menu;
  if (m.lockT > 0) return;
  const N = AB_KEYS; // the ability column
  if (k === 'escape' || k === 'backspace') leaveHero();
  else if (moveDir(k) === 'up') { m.grow = (m.grow + N - 1) % N; SFX.pickup(); }
  else if (moveDir(k) === 'down') { m.grow = (m.grow + 1) % N; SFX.pickup(); }
}

function heroClick() {
  const m = state.menu;
  if (m.lockT > 0 || m.popT < 1) return;
  const h = heroScreenHit();
  if (!h || h === 'x') { leaveHero(); return; } // the X, or anywhere off the panel
  if (h === 'panel') return;                    // the slab swallows it
  if (h.ab != null) m.grow = h.ab; // the well takes the keyboard's focus
}

// what the pointer is on: 'play' (BAN / LOCK IN), 'hero' (the stage figure:
// the hero pop-up), 'swap' (the trade mark on your row: the
// next position), 'search' (the row over the grid), 'skin'N /
// 'skinPrev' / 'skinNext' (the strip under the showcase), 'book' (the story's
// book on the showcase, or the open story itself), 'talk' (the chat's
// plate), 'pickN' (hero N's cell) or null.
function lobbyHit() {
  const L = lobbyLayout();
  const lo = loadoutHit(L); // the pre-game picks' wells and picker, over everything under them (js/ui/loadout.js)
  if (lo) return lo;
  const mineR = L.cards[1].find((r) => r.p === player);
  if (mineR && draftOpen() && overRect(selSwapRect(mineR), 1)) return 'swap';
  if (inTalk(L.chat)) return 'talk';
  if (lobbyShowcase()) {
    if (CLASSES[player.cls].story && (overRect(selBookRect(L), 2) || (selLoreOn() && overRect(L.show)))) return 'book'; // the story (js/ui/select.js)
    const S = selSkinCells(L);
    for (const c of S.cells) if (overRect(c, 1)) return 'skin' + c.k;
    if (S.more && overRect(S.prev, 2)) return 'skinPrev';
    if (S.more && overRect(S.next, 2)) return 'skinNext';
  } else {
    if (lobbyStageUp(L) && overRect(L.figure)) return 'hero';
    const f = heroFilterAt(L);
    if (f) return f;
    const hi = heroCellAt(L.heroes);
    if (hi >= 0 && hi < CLASSES.length) return 'pick' + hi;
    if (overRect(L.play, 1) && draftWord()) return 'play';
  }
  return null;
}
// the hero pop-up over the lobby rides its own ease (menu.popT); menu.pop
// is kept through the fade so it draws on the way out
function popOpen() { return state.menu.screen === 'hero'; }
function popHit() { return popOpen() ? heroScreenHit() : null; }
function openPop(which) {
  const m = state.menu;
  m.screen = which; m.pop = which;
  SFX.place();
}
function leavePop() {
  state.menu.screen = 'lobby';
  SFX.pickup();
}

function beginLobby() {
  const m = state.menu;
  m.screen = 'lobby';
  m.csel = player.cls;
  m.cswapT = 1;
  m.countT = 0; m.countN = -1; // every rival frame face-down again
  m.loreOn = false;            // the story starts shut
  m.lockFx = 0;
  m.showKey = null;            // the showcase starts its turn again (drawShowcase)
  closeMenuPanel(); // a party member's settings slide away: the draft's clock is running
  draftStart(); // the bans, then everyone's pick (js/ui/draft.js)
  SFX.place();
  SFX.music.play('lobby');
}
function leaveLobby() {
  if (NET.role !== 'solo') { leaveRoom(); return; } // a guest walks out of the party, back to the title (a leader's ESC goes back to the seats: lobbyKey)
  state.menu.screen = 'menu';
  state.menu.countT = 0;
  SFX.pickup();
  SFX.music.play('intro');
}
// BAN / LOCK IN at the foot: the draft's confirm (js/ui/draft.js); the
// count that follows the pick is the draft's, and runs to the end
function pressPlay() {
  if (state.menu.lockT > 0) return;
  draftConfirm();
}
// how many rival frames are face-up: one per tick of the count (the first on
// the press, the last on ONE), all of them once it has run out, none at rest
function lobbyRevealed() {
  const m = state.menu;
  if (m.countT > 0) return COUNT_T + 1 - Math.ceil(m.countT);
  return m.countN === 0 ? MAX_PLAYERS : 0;
}
// the count's end: the short hold, then the eagle (updateTitle: lockT ->
// beginDrop)
function lockIn() {
  const m = state.menu;
  if (m.lockT > 0) return;
  setClass(player, m.csel);
  SFX.place();
  m.lockT = 0.12;
}
// the rivals' difficulty: one of AI_LEVELS, remembered with the profile
function setAiLevel(k) {
  if (settings.aiLevel === k) return;
  settings.aiLevel = k;
  saveSettings();
  SFX.pickup();
}

// the keys: a chat line or the search field being typed takes every key;
// otherwise Enter starts a chat line (League's), Space confirms (BAN / LOCK IN), the arrows walk the heroes, ESC leaves (never
// Backspace: a slip off the search field or the chat would walk out)
function lobbyKey(k, e) {
  const m = state.menu;
  if (m.lockT > 0) return;
  if (m.talkOn) { talkKey(k, e); return; }
  if (heroSearchKey(k, e)) return;
  if (loadoutKey(k)) return; // ESC shuts the picks' picker first (js/ui/loadout.js)
  if (k === 'escape') { if (m.countT > 0) return; if (NET.role === 'host') { draftStop(); netPhase('room'); beginRoom(); } else leaveLobby(); } // a host's ESC takes the room back to its seats; the count runs out
  else if (moveDir(k) === 'left' || moveDir(k) === 'up') lobbyStep(-1);   // the hero grid (js/ui/heroes.js)
  else if (moveDir(k) === 'right' || moveDir(k) === 'down') lobbyStep(1);
  else if (k === 'enter') talkOpen();
  else if (k === ' ') pressPlay();
}

function lobbyClick() {
  const m = state.menu;
  if (m.lockT > 0 || m.screenT < 1 || m.popT > 0) return;
  const h = lobbyHit();
  if (loadoutClick(h)) return; // a well or its picker (js/ui/loadout.js); any other press shuts the picker and goes on
  m.searchOn = h === 'search';
  if (m.talkOn && h !== 'talk') m.talkOn = false;
  if (!h) return;
  if (h === 'play') pressPlay();                                    // BAN / LOCK IN: the draft's confirm
  else if (h === 'hero') { m.pressT = 0.12; beginHero(); }          // the figure opens the hero pop-up: stats, abilities
  else if (h === 'talk') { if (!m.talkOn) talkOpen(); }             // the chat's plate starts a line
  else if (h === 'search') SFX.pickup();                            // the field takes the keys
  else if (h === 'swap') draftRole(draftNextRole());            // the next position no person on your side holds
  else if (h === 'book') { m.loreOn = !m.loreOn; SFX.pickup(); }   // the hero's story over the splash
  else if (h === 'skinPrev' || h === 'skinNext') { m.skinOff = Math.max(0, (m.skinOff | 0) + (h === 'skinNext' ? 1 : -1)); SFX.pickup(); }
  else if (h.startsWith('skin')) lobbySkin(+h.slice(4));
  else if (h.startsWith('pick')) lobbyPick(+h.slice(4));            // point at a hero on the grid (js/ui/heroes.js)
}
// a look on the strip: worn at once when this profile owns it
function lobbySkin(k) {
  const h = player.cls, row = selSkinRows(h)[k];
  if (!row || !row.own || k === selSkinWorn(h)) { if (row && !row.own) SFX.deny(); return; }
  draftSkin(h, k > 0 ? row.r.id : null);
}

// The heroes' EMBLEMS at 12px - ARMATOS's broken standard, and one each - for
// the team rail's chips (drawRailChip), the rooms and tooltips, on the
// shared big-icon palette (AB32_PAL, js/draw/abilities.js): drawn by hand at
// that size, each in its hero's registry row (`emblem`, heroArt). The local
// player's own chip is baked with every colour but the outline pushed to
// white, the maps' "you".
const class12Cache = new Map();
function classIcon12(i, you) {
  const key = i * 2 + (you ? 1 : 0);
  let cv = class12Cache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = 12;
    const g = cv.getContext('2d');
    const rows = heroArtOf(i).emblem;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c], col = AB32_PAL[ch];
        if (!col) continue;
        g.fillStyle = you && ch !== 'o' ? '#f4f7ff' : col;
        g.fillRect(c, r, 1, 1);
      }
    }
    class12Cache.set(key, cv);
  }
  return cv;
}

// One roster portrait: the class's symbolic emblem in a small well. The
// chosen one wears the gold rim; a hover lifts and lightens (hv is that
// portrait's ease). Symbol only - the stage carries the body and every word.
// The stage: your hero alone in full glory - the 48 px model at the layout's
// scale (LOBBY_MODEL, 2x in a short view) inside a warm pool of light with a
// gold ring turning on the snow. No weapon and no name under it: the hero
// row carries the hero's name, the roster frame yours. It wears your side's paint, like
// that frame. sw is the swap-pop ease; a lock-in bursts a second ring out
// from the feet (lockFx) and the light stays up while the count runs.
const LOCK_FX_T = 0.7; // s: the lock-in's ring
// the stage stands only when it has your hero to show: never through the
// bans, and in the picks only while you point at one (a banned last hero
// leaves you pointing at none)
function lobbyStageUp(L) {
  return L.stage && DRAFT.phase !== 'ban' && !(DRAFT.phase === 'pick' && draftWant(localId) < 0);
}
function drawLobbyStage(now, a, sw) {
  const m = state.menu, L = lobbyLayout();
  const { cx, body, S } = L;
  if (!lobbyStageUp(L)) return;
  const feet = body.y + 46 * S;
  drawStageLight(cx, feet, S, a, sw, now);
  // the body; a swap pops it up through the light, and it lifts under the
  // hand - it is the way into the hero pop-up
  const hover = m.screenT >= 1 && m.popT <= 0 ? lobbyHit() : null;
  const rise = Math.round((1 - sw) * 8) - (hover === 'hero' ? 2 : 0);
  const bob = Math.round(Math.sin(now * 1.6));
  ctx.globalAlpha = a;
  ctx.drawImage(SPRITES.portrait(player.cls, skin(player.team), heroSkinOf(player)), body.x, body.y + rise + bob, body.w, body.h);
}

// The pick's light on the snow: a shadow, a warm pool, the gold ring turning
// round the feet (bright through the count and the lock), and the lock-in's
// ring bursting out across the snow - for a model at S px a pixel whose soles
// stand on feet. The pick stage's (drawLobbyStage) and the showcase's
// (drawShowcase, js/ui/select.js).
function drawStageLight(cx, feet, S, a, sw, now) {
  const m = state.menu;
  const lit = m.countT > 0 || m.lockT > 0 ? 1.7 : 1;
  ctx.globalAlpha = a * 0.4;
  ctx.fillStyle = '#04060f';
  ctx.beginPath(); ctx.ellipse(cx, feet, 12 * S, 5, 0, 0, Math.PI * 2); ctx.fill();
  // the pick's light, and the gold ring turning on the snow
  ctx.globalCompositeOperation = 'lighter';
  const gr = 32 * S;
  const g = ctx.createRadialGradient(cx, feet - 20 * S, 3, cx, feet - 20 * S, gr);
  g.addColorStop(0, 'rgba(255,170,80,' + (0.14 * a * sw * lit).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - gr - 2, feet - 20 * S - gr - 2, gr * 2 + 4, gr * 2 + 4);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = a * sw;
  ctx.fillStyle = lit > 1 ? '#ffd95c' : '#c89a3c';
  const rr = 16 * S + 2;
  for (let k = 0; k < 24; k += 2) {
    const an = (k / 24) * Math.PI * 2 + now * 0.5;
    ctx.fillRect(cx + Math.round(Math.cos(an) * rr), feet + Math.round(Math.sin(an) * 6), 2, 1);
  }
  if (m.lockFx > 0) { // the lock-in: a ring bursting out across the snow
    const u = 1 - m.lockFx / LOCK_FX_T, e = easeOut(u);
    ctx.globalAlpha = a * (1 - u);
    ctx.fillStyle = '#ffd95c';
    const rx = rr + e * 90, ry = 6 + e * 13;
    for (let k = 0; k < 40; k++) {
      const an = (k / 40) * Math.PI * 2;
      ctx.fillRect(cx + Math.round(Math.cos(an) * rx), feet + Math.round(Math.sin(an) * ry), 2, 1);
    }
  }
}

// a filled pixel disc, scanline by scanline
function pxDisc(cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}
// a (0..1) is the screen's own visibility; the whole surface rides it.
// Under it all the lobby's painted night, dimmed to the party room's
// graphite so the columns and the grid read flat on it.
function renderLobby(now, a) {
  const m = state.menu, L = lobbyLayout();
  drawLobbyBackdrop(now, a);
  ctx.globalAlpha = a * 0.78;
  ctx.fillStyle = SC_BG; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const hot = m.screenT >= 1 && m.popT <= 0 ? lobbyHit() : null;
  drawSelectTop(L, a);                 // the headline, the clock, the bans (js/ui/select.js)
  drawSeats(L, a, hot);                // both sides' seat rows
  if (lobbyShowcase()) {               // your pick is in: the showcase and the skins
    drawShowcase(L, now, a);
    drawSelLore(L, a, hot);            // the book, and the story when it is open
    drawSkinStrip(L, a, hot);
  } else {
    drawHeroFilters(L, a, hot, now);   // the positions and the search (js/ui/heroes.js)
    drawHeroRow(L.heroes, a);          // the grid
    drawLobbyStage(now, a, easeOut(m.cswapT));
    drawSelBrief(L, a);                // the pointed hero's name, title and abilities, where the stage has no room (js/ui/select.js)
    drawSelPlay(L, a, hot);            // BAN / LOCK IN
  }
  drawLoadoutPicks(L, a, hot);         // the calling and the two tricks, and a picker over them (js/ui/loadout.js)
  drawSelMode(L, a);                   // the match's size and mode
  ctx.globalAlpha = a;
  drawTalk(L.chat, now, hot === 'talk'); // the side's chat (js/ui/roomtalk.js)
  ctx.globalAlpha = 1;
}

// The preview body: the chosen class walking in place with the class weapon
// at hand.
function drawHeroPreview(r, now) {
  const m = state.menu;
  ctx.fillStyle = '#0a0e23';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#232c52';
  ctx.fillRect(r.x, r.y, r.w, 1); ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
  ctx.fillRect(r.x, r.y, 1, r.h); ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
  const sx = r.x + 12, sy = r.y + 7; // the 16x16 body at 4x
  ctx.fillStyle = 'rgba(4,6,18,0.6)';
  ctx.beginPath(); ctx.ellipse(sx + 32, r.y + r.h - 6, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(classSet(player).down[1 + (Math.floor(now * 3) % 2)], sx, sy, 64, 64);
  // the hero's own weapon rides along - its basic attack (CLASSES[c].attack)
  const im = SPRITES.weaponArt[(CLASSES[m.csel] || CLASSES[player.cls]).attack.art];
  ctx.drawImage(im, r.x + r.w - 31, r.y + r.h - 33 + Math.round(Math.sin(now * 2.2) * 1.5), 24, 24);
}

// the pop-up itself: a dim over the still-lit select screen, then the panel
// slab rising a few px as it eases in - the preview and its ledger on the
// left, the four ability wells on the right, the X in the corner
function renderHero(now, a) {
  const m = state.menu;
  const { panel, abils, xr, prev, led, name } = heroLayout();
  const rise = Math.round((1 - a) * 12);
  ctx.globalAlpha = a;
  drawPopSlab(panel, rise);
  const gh = m.popT >= 1 && mouse.inside ? heroScreenHit() : null;
  const onAb = gh && gh.ab != null;
  drawHeroPreview({ x: prev.x, y: prev.y + rise, w: prev.w, h: prev.h }, now);
  // the ledger: the seven stats the hero flies out with
  const cur = baseKit(m.csel);
  for (let i = 0; i < STAT_ROWS.length; i++) {
    const [label, get, fmt] = STAT_ROWS[i];
    const y = led.y + rise + i * 8, vTxt = fmt(get(cur));
    drawPixelTextShadow(ctx, label, led.x, y, '#7a8bb8', '#0a0e23');
    drawPixelTextShadow(ctx, vTxt, led.x + led.w - pixelTextWidth(vTxt), y, '#f4f7ff', '#0a0e23');
  }
  ctx.globalAlpha = a;
  // the column: a well a key wearing its ability; the keyboard's well
  // breathing its corner ticks
  const keyed = !mouse.inside;
  for (const w of abils) {
    const hot = onAb && gh.ab === w.i, y = w.y + rise - (hot ? 1 : 0);
    ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(w.x + 2, w.y + rise + 2, w.w, w.h);
    ctx.fillStyle = hot ? '#8fa0c8' : '#c89a3c'; ctx.fillRect(w.x, y, w.w, w.h);
    ctx.fillStyle = '#1a2142'; ctx.fillRect(w.x + 1, y + 1, w.w - 2, w.h - 2);
    ctx.drawImage(classAbIcon(player.cls, w.i), w.x + 3, y + 3);
    drawPixelTextShadow(ctx, keyCapShort('ab' + (w.i + 1)), w.x + 3, y + w.h - 9, '#ffd95c', '#0a0e23'); // the key, a keybind indicator
    if (keyed && m.grow === w.i) { // keyboard cursor: four corner ticks, breathing
      ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(now * 6));
      ctx.fillStyle = '#f4f7ff';
      ctx.fillRect(w.x - 1, y - 1, 4, 1); ctx.fillRect(w.x - 1, y - 1, 1, 4);
      ctx.fillRect(w.x + w.w - 3, y - 1, 4, 1); ctx.fillRect(w.x + w.w, y - 1, 1, 4);
      ctx.fillRect(w.x - 1, y + w.h, 4, 1); ctx.fillRect(w.x - 1, y + w.h - 3, 1, 4);
      ctx.fillRect(w.x + w.w - 3, y + w.h, 4, 1); ctx.fillRect(w.x + w.w, y + w.h - 3, 1, 4);
      ctx.globalAlpha = a;
    }
  }
  // the hovered well's name, else the focused well's
  const nm = abOf(player, onAb ? gh.ab : m.grow).name;
  drawPixelTextShadow(ctx, nm, name.x - Math.round(pixelTextWidth(nm) / 2), name.y + rise, '#ffd95c', '#0a0e23');
  drawPopX(xr, rise, gh === 'x');
  ctx.globalAlpha = 1;
}
// a pop-up's slab in the planks' own chrome, dimming the lobby under it, and
// its X: the one way out that is drawn (ESC and a click outside also close)
function drawPopSlab(panel, rise) {
  const a = ctx.globalAlpha, py = panel.y + rise;
  ctx.fillStyle = 'rgba(4,6,18,' + (0.62 * a).toFixed(3) + ')';
  ctx.globalAlpha = 1; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; chamRect(panel.x + 3, py + 3, panel.w, panel.h);
  ctx.fillStyle = '#0a0e23'; chamRect(panel.x, py, panel.w, panel.h);
  ctx.fillStyle = '#10173a'; chamRect(panel.x + 1, py + 1, panel.w - 2, panel.h - 2);
  ctx.fillStyle = '#35426e';
  ctx.fillRect(panel.x + 2, py + 1, panel.w - 4, 1); ctx.fillRect(panel.x + 1, py + 2, 1, panel.h - 4);
  ctx.fillStyle = '#080c1c';
  ctx.fillRect(panel.x + 2, py + panel.h - 2, panel.w - 4, 1); ctx.fillRect(panel.x + panel.w - 2, py + 2, 1, panel.h - 4);
}
function drawPopX(xr, rise, hot) {
  ctx.fillStyle = hot ? '#8fa0c8' : '#35426e';
  ctx.fillRect(xr.x, xr.y + rise, xr.w, xr.h);
  ctx.fillStyle = '#0f1632';
  ctx.fillRect(xr.x + 1, xr.y + rise + 1, xr.w - 2, xr.h - 2);
  ctx.fillStyle = hot ? '#f4f7ff' : '#8fa8d0';
  for (let k = 0; k < 4; k++) {
    ctx.fillRect(xr.x + 3 + k, xr.y + rise + 3 + k, 1, 1);
    ctx.fillRect(xr.x + xr.w - 4 - k, xr.y + rise + 3 + k, 1, 1);
  }
}
// a pop-up's inert hit answers: 'x', 'panel' (the slab swallows the press)
// or null (outside - a click there closes)
function popFrameHit(panel, xr) {
  if (overRect(xr, 3)) return 'x';
  if (overRect(panel)) return 'panel';
  return null;
}
