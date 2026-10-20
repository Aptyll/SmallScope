'use strict';
// ------------------------------------------------------------ hero row
// The HERO ROW on the lobby (menu.js `lobby`): a cell per hero under the
// draft's top band (js/ui/draft.js), League's champion grid at Softfall's
// size, wrapping into rows between the two team panels. A cell is the hero's
// own 48 px model (js/sprites/looks.js) cropped to the head at 2x - each hero
// wears ONE fixed look (CLASSES, js/sim/player.js), so the face IS the hero.
// What you point at is gold (red while it is a ban), a hovered cell lifts,
// and the hero's name prints under the row (the hovered one's, else yours).
// A banned hero is dimmed and struck through in red; one a person on your
// side has locked is dimmed with your side's bar under it; one only a bot of
// yours holds keeps the bar but stays bright (the bot gives it up,
// draftYield); and one a rival may have is never shown - the pick is blind.
// The heroes still to come (HEROES_SOON) stand at the end as dark
// silhouettes of their model: their name on hover, no press.
//
// A press points at the hero (draftPoint: the stage shows it in the pick);
// BAN / LOCK IN at the foot confirms it (draftConfirm). In a party every
// press goes through the leader, who keeps the draft (js/ui/draft.js).

const HERO_CELL = 44;                  // a cell's side: a 20 px head crop at 2x, and its rim
const HERO_GAP = 8;
const HERO_CROP = { x: 14, y: 2, s: 20 }; // the head inside the 48 px model
const HERO_NAME_GAP = 6;               // between the row and the name under it
const HERO_ROW_H = HERO_CELL + HERO_NAME_GAP + 16; // the row and its name: what the stage keeps clear of
const HERO_SOON_INK = '#26305a';       // a coming hero's silhouette

// every cell the row has, playable first: { name, cls, look, soon }
function heroList() {
  return CLASSES.map((c, i) => ({ name: c.name, cls: i, look: c.look, soon: false }))
    .concat(HEROES_SOON.map((h) => ({ name: h.name, cls: h.cls, look: h.look, soon: true })));
}
// the row's cells with their top at y: as many to a row as fit between the
// team panels, each row centred
function heroCols() { return Math.max(1, Math.floor((VIEW_W - 2 * LOBBY_PANEL_W - 16 + HERO_GAP) / (HERO_CELL + HERO_GAP))); }
function heroCells(y) {
  const list = heroList(), n = list.length, cols = heroCols();
  return list.map((h, i) => {
    const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), k = i - row * cols;
    const x0 = Math.round(VIEW_W / 2) - ((inRow * HERO_CELL + (inRow - 1) * HERO_GAP) >> 1);
    return { x: x0 + k * (HERO_CELL + HERO_GAP), y: y + row * (HERO_CELL + HERO_GAP), w: HERO_CELL, h: HERO_CELL, i, hero: h };
  });
}
// the cell under the pointer, or -1
function heroCellAt(cells) {
  for (const c of cells) if (overRect(c, 2, 2)) return c.i;
  return -1;
}
// point at hero i (the draft keeps it: js/ui/draft.js), and the keys' step
function lobbyPick(i) { draftPoint(i); }
function lobbyStep(d) { draftStep(d); }

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
    ctx.globalAlpha = a * (!draftOpen() && !picked ? 0.45 : 1);
    const y = drawWell(c, !h.soon && !out && i === hv ? 1 : 0, picked && !banning, !h.soon && !out);
    if (picked && banning) { // a ban you point at: the rim in red
      ctx.fillStyle = DRAFT_RED; ctx.fillRect(c.x, y, c.w, c.h);
      ctx.fillStyle = '#2a1424'; ctx.fillRect(c.x + 1, y + 1, c.w - 2, c.h - 2);
    }
    const src = SPRITES.portrait(h.cls, h.look, team);
    if (h.soon) { // the model's head as one flat shade: who is coming, not yet who they are
      heroSilG.globalCompositeOperation = 'source-over';
      heroSilG.clearRect(0, 0, S, S);
      heroSilG.drawImage(src, HERO_CROP.x, HERO_CROP.y, S, S, 0, 0, S, S);
      heroSilG.globalCompositeOperation = 'source-in';
      heroSilG.fillStyle = HERO_SOON_INK; heroSilG.fillRect(0, 0, S, S);
      ctx.drawImage(heroSil, 0, 0, S, S, c.x + 2, y + 2, S * 2, S * 2);
      continue;
    }
    draftFace(i, c.x + 2, y + 2, 2, out ? 0.6 : 0);
    if (banned) {
      draftSlash(c.x + 2, y + 2, S * 2); draftSlash(c.x + 3, y + 2, S * 2);
      if (D.fx > 0) { ctx.globalAlpha = a * D.fx * 2; ctx.fillStyle = '#f4f7ff'; ctx.fillRect(c.x, y, c.w, c.h); }
    } else if (taken) { ctx.fillStyle = mark; ctx.fillRect(c.x + 1, y + c.h - 4, c.w - 2, 3); }
  }
  const show = cells[hv >= 0 ? hv : mine];
  if (show) {
    const nm = show.hero.name, c0 = cells[cells.length - 1];
    ctx.globalAlpha = a;
    drawPixelTextOutline(ctx, nm, Math.round(VIEW_W / 2) - (pixelTextWidth(nm, 2) >> 1), c0.y + c0.h + HERO_NAME_GAP,
      show.hero.soon ? '#5a6690' : '#f4f7ff', 'rgba(8,12,28,0.9)', 2);
  }
  ctx.globalAlpha = 1;
}
