'use strict';
// ------------------------------------------------------------ hero grid
// The HERO GRID on the lobby (menu.js `lobby`): a cell per hero in the
// middle column under the filter row (the five positions and a search
// field), League's champion grid at Softfall's size. A cell is the hero's
// own 48 px model (js/sprites/looks.js) cropped to the head at 2x - each hero
// wears ONE fixed look (CLASSES, js/sim/player.js), so the face IS the hero.
// What you point at is gold (red while it is a ban), a hovered cell lightens,
// and each hero's name prints under its cell.
// A banned hero is dimmed and struck through in red; one a person on your
// side has locked is dimmed with your side's bar under it; one only a bot of
// yours holds keeps the bar but stays bright (the bot gives it up,
// draftYield); and one a rival may have is never shown - the pick is blind.
// The heroes still to come (HEROES_SOON) stand at the end as dark
// silhouettes of their model, their names dim, no press.
//
// A press points at the hero (draftPoint: the stage shows it in the pick);
// BAN / LOCK IN at the foot confirms it (draftConfirm). In a party every
// press goes through the leader, who keeps the draft (js/ui/draft.js).

const HERO_CELL = 42;                  // a cell's side: a 20 px head crop at 2x, and its rim
const HERO_GAP = 6;
const HERO_PITCH = HERO_CELL + 12;     // a grid row and the names under it
const HERO_CROP = { x: 14, y: 2, s: 20 }; // the head inside the 48 px model
const HERO_SOON_INK = '#26305a';       // a coming hero's silhouette
const HERO_SEARCH_W = 96;              // the search field, right of the filters
const HERO_SEARCH_MAX = 12;

// every cell the grid has, playable first: { name, cls, look, soon }
function heroList() {
  return CLASSES.map((c, i) => ({ name: c.name, cls: i, look: c.look, soon: false }))
    .concat(HEROES_SOON.map((h) => ({ name: h.name, cls: h.cls, look: h.look, soon: true })));
}
// the heroes the filters let through: the picked position's (menu.posFilter)
// and the typed name's (menu.search, anywhere in the name); a coming hero
// only while neither is set
function heroShown() {
  const m = state.menu, f = m.posFilter == null ? -1 : m.posFilter, q = m.search || '';
  return heroList().map((h, i) => ({ h, i })).filter(({ h, i }) => {
    if (h.soon) return f < 0 && !q;
    return heroPlays(i, f) && h.name.includes(q);
  });
}
function heroCols(L) { return Math.max(1, Math.floor((L.grid.w + HERO_GAP) / (HERO_CELL + HERO_GAP))); }
// the grid's cells from its top-left, as many to a row as its width takes
function heroCells(L) {
  const cols = heroCols(L);
  return heroShown().map(({ h, i }, k) => ({
    x: L.grid.x + (k % cols) * (HERO_CELL + HERO_GAP), y: L.grid.y + Math.floor(k / cols) * HERO_PITCH,
    w: HERO_CELL, h: HERO_CELL, i, hero: h,
  }));
}
// the cell under the pointer, or -1
function heroCellAt(cells) {
  for (const c of cells) if (overRect(c, 2, 2)) return c.i;
  return -1;
}
// the filter row over the grid: a position emblem each, the search field right
function heroFilterRects(L) {
  const y = L.filter.y;
  return {
    pos: POSITIONS.map((_, r) => ({ x: L.grid.x + r * 16, y, w: 13, h: 13, r })),
    search: (() => { const w = Math.min(HERO_SEARCH_W, L.grid.w - POSITIONS.length * 16 - 4); return { x: L.grid.x + L.grid.w - w, y, w, h: 13 }; })(),
  };
}
// a press on the filter row: a position's emblem filters to it (again: all),
// the field takes the keys
function heroFilterAt(L) {
  const F = heroFilterRects(L);
  for (const r of F.pos) if (overRect(r, 1, 1)) return 'pos' + r.r;
  if (overRect(F.search, 1, 1)) return 'search';
  return null;
}
function heroFilter(r) {
  const m = state.menu;
  m.posFilter = m.posFilter === r ? -1 : r;
  SFX.pickup();
}
// a key while the field has them: true when it took it
function heroSearchKey(k, e) {
  const m = state.menu;
  if (!m.searchOn) return false;
  const ch = e && e.char && e.char.length === 1 ? e.char.toUpperCase() : '';
  if (k === 'escape' || k === 'enter') m.searchOn = false;
  else if (k === 'backspace') m.search = (m.search || '').slice(0, -1);
  else if (/^[A-Z]$/.test(ch) && (m.search || '').length < HERO_SEARCH_MAX) m.search = (m.search || '') + ch;
  else return k !== 'tab';
  return true;
}
// point at hero i (the draft keeps it: js/ui/draft.js), and the keys' step
function lobbyPick(i) { draftPoint(i); }
function lobbyStep(d) { draftStep(d); }

function drawHeroFilters(L, a, hot, now) {
  const m = state.menu, F = heroFilterRects(L), f = m.posFilter == null ? -1 : m.posFilter;
  ctx.globalAlpha = a;
  for (const r of F.pos) {
    const on = f === r.r, hv = hot === 'pos' + r.r;
    ctx.drawImage(posIcon(r.r, on ? SEL_GOLD : hv ? SC_LIT : SC_DIM), r.x + 1, r.y + 1);
  }
  const s = F.search, q = m.search || '';
  ctx.fillStyle = m.searchOn ? SEL_GOLD : hot === 'search' ? SC_LBL : SC_EDGE; ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = SC_PLATE; ctx.fillRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
  const gc = m.searchOn || q ? SC_LIT : SC_DIM; // the glass
  ctx.fillStyle = gc;
  ctx.fillRect(s.x + 4, s.y + 3, 3, 1); ctx.fillRect(s.x + 3, s.y + 4, 1, 3); ctx.fillRect(s.x + 7, s.y + 4, 1, 3); ctx.fillRect(s.x + 4, s.y + 7, 3, 1);
  ctx.fillRect(s.x + 8, s.y + 8, 1, 1); ctx.fillRect(s.x + 9, s.y + 9, 1, 1);
  drawPixelText(ctx, q, s.x + 14, s.y + 4, SC_TXT, 1);
  if (m.searchOn && Math.floor(now * 2.5) % 2) { ctx.fillStyle = SEL_GOLD; ctx.fillRect(s.x + 15 + pixelTextWidth(q), s.y + 3, 1, 7); }
}

// The grid: League's champion grid in Softfall's pixels - a head at 2x in a
// flat well, its name under it. What you point at wears the gold rim (red
// while it is a ban); a banned hero is dimmed and struck through; one a
// person on your side has locked is dimmed with your side's bar under it;
// one only a bot of yours holds keeps the bar but stays bright (the bot gives
// it up, draftYield); a rival's pick is never shown - the pick is blind. The
// heroes still to come (HEROES_SOON) stand at the end as dark silhouettes.
const heroSil = document.createElement('canvas');
heroSil.width = heroSil.height = HERO_CROP.s;
const heroSilG = heroSil.getContext('2d');
function drawHeroRow(cells, a) {
  const m = state.menu, D = DRAFT;
  const live = m.screenT >= 1 && m.popT <= 0 && draftOpen() && D.lock[localId] < 0;
  const hv = live ? heroCellAt(cells) : -1;
  const team = skin(player.team), S = HERO_CROP.s, mark = TEAMS[team].mark;
  const mine = D.hover[localId], banning = D.phase === 'ban';
  for (const c of cells) {
    const h = c.hero, i = c.i;
    const banned = !h.soon && D.banned.includes(i);
    const mates = h.soon ? [] : players.filter((q) => q !== player && q.team === player.team && D.lock[q.id] === i);
    const taken = !banned && D.phase === 'pick' && mates.length > 0;
    const out = banned || (taken && !draftCanLock(player, i));
    const picked = i === mine && !h.soon && !banned;
    const over = !h.soon && !out && i === hv;
    ctx.globalAlpha = a * (!draftOpen() && !picked ? 0.45 : 1);
    ctx.fillStyle = picked ? (banning ? SEL_RED : SEL_GOLD) : over ? SC_LBL : SC_EDGE;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = SC_INK; ctx.fillRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    const src = SPRITES.portrait(h.cls, h.look, team);
    if (h.soon) { // the model's head as one flat shade: who is coming, not yet who they are
      heroSilG.globalCompositeOperation = 'source-over';
      heroSilG.clearRect(0, 0, S, S);
      heroSilG.drawImage(src, HERO_CROP.x, HERO_CROP.y, S, S, 0, 0, S, S);
      heroSilG.globalCompositeOperation = 'source-in';
      heroSilG.fillStyle = HERO_SOON_INK; heroSilG.fillRect(0, 0, S, S);
      ctx.drawImage(heroSil, 0, 0, S, S, c.x + 1, c.y + 1, S * 2, S * 2);
    } else {
      draftFace(i, c.x + 1, c.y + 1, 2, out ? 0.6 : 0);
      if (banned) {
        draftSlash(c.x + 1, c.y + 1, S * 2); draftSlash(c.x + 2, c.y + 1, S * 2);
        if (D.fx > 0) { ctx.globalAlpha = a * D.fx * 2; ctx.fillStyle = '#f4f7ff'; ctx.fillRect(c.x, c.y, c.w, c.h); }
      } else if (taken) { ctx.fillStyle = mark; ctx.fillRect(c.x + 1, c.y + c.h - 4, c.w - 2, 3); }
    }
    ctx.globalAlpha = a * (h.soon || out ? 0.5 : 1);
    const nm = h.name;
    drawPixelText(ctx, nm, c.x + ((c.w - pixelTextWidth(nm)) >> 1), c.y + c.h + 3, picked ? SEL_GOLD : over ? SC_LIT : SC_LBL, 1);
  }
  ctx.globalAlpha = 1;
}
