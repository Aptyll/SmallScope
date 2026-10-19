'use strict';
// ------------------------------------------------------------ hero row
// The HERO PICK on the lobby (menu.js `lobby`): a row of hero heads under the
// map plate and the target, League's champion grid at Softfall's size. A
// cell is the hero's own 48 px model (js/sprites/looks.js) cropped to the
// head at 2x - each hero wears ONE fixed look (CLASSES, js/sim/player.js), so
// the face IS the hero. The picked cell is gold, a hovered one lifts, and the
// hero's name prints under the row (the hovered one's, else the pick's). The
// heroes still to come (HEROES_SOON) stand at the row's end as dark
// silhouettes of their model: their name on hover, no press.
//
// A press puts the hero on the stage at once (setClass: its look, kit and
// loadout); LOCK IN keeps it as the profile's hero (lockIn, PROFILE.setHero),
// which is where the next match's pick opens. The row is still while the
// count runs. A guest's room plays the hero its profile arrived with (the
// hello, js/net/net.js), so a client's row is shown but not pressed.

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
// the row's cells, centred, with their top at y
function heroCells(y) {
  const list = heroList(), n = list.length;
  const x0 = Math.round(VIEW_W / 2) - ((n * HERO_CELL + (n - 1) * HERO_GAP) >> 1);
  return list.map((h, i) => ({ x: x0 + i * (HERO_CELL + HERO_GAP), y, w: HERO_CELL, h: HERO_CELL, i, hero: h }));
}
// the cell under the pointer, or -1
function heroCellAt(cells) {
  for (const c of cells) if (overRect(c, 2, 2)) return c.i;
  return -1;
}
// put hero i on the stage (a playable one, before the count)
function lobbyPick(i) {
  const m = state.menu;
  if (m.countT > 0 || m.lockT > 0 || NET.isClient || i < 0 || i >= CLASSES.length) { SFX.deny(); return; }
  if (i === m.csel) return;
  m.csel = i;
  setClass(player, i);
  m.cswapT = 0; // the stage's pop
  SFX.pickup();
}
// the keys' step through the playable heroes
function lobbyStep(d) {
  const n = CLASSES.length;
  lobbyPick(((state.menu.csel + d) % n + n) % n);
}

const heroSil = document.createElement('canvas');
heroSil.width = heroSil.height = HERO_CROP.s;
const heroSilG = heroSil.getContext('2d');
function drawHeroRow(cells, a) {
  const m = state.menu;
  const counting = m.countT > 0 || m.lockT > 0;
  const live = m.screenT >= 1 && m.popT <= 0 && !counting;
  const hv = live ? heroCellAt(cells) : -1;
  const team = skin(player.team), S = HERO_CROP.s;
  for (const c of cells) {
    const h = c.hero, picked = c.i === m.csel;
    ctx.globalAlpha = a * (counting && !picked ? 0.45 : 1);
    const y = drawWell(c, !h.soon && c.i === hv ? 1 : 0, picked, !h.soon);
    const src = SPRITES.portrait(h.cls, h.look, team);
    if (h.soon) { // the model's head as one flat shade: who is coming, not yet who they are
      heroSilG.globalCompositeOperation = 'source-over';
      heroSilG.clearRect(0, 0, S, S);
      heroSilG.drawImage(src, HERO_CROP.x, HERO_CROP.y, S, S, 0, 0, S, S);
      heroSilG.globalCompositeOperation = 'source-in';
      heroSilG.fillStyle = HERO_SOON_INK; heroSilG.fillRect(0, 0, S, S);
      ctx.drawImage(heroSil, 0, 0, S, S, c.x + 2, y + 2, S * 2, S * 2);
    } else ctx.drawImage(src, HERO_CROP.x, HERO_CROP.y, S, S, c.x + 2, y + 2, S * 2, S * 2);
  }
  const show = cells[hv >= 0 ? hv : m.csel];
  if (show) {
    const nm = show.hero.name, c0 = cells[0];
    ctx.globalAlpha = a;
    drawPixelTextOutline(ctx, nm, Math.round(VIEW_W / 2) - (pixelTextWidth(nm, 2) >> 1), c0.y + c0.h + HERO_NAME_GAP,
      show.hero.soon ? '#5a6690' : '#f4f7ff', 'rgba(8,12,28,0.9)', 2);
  }
  ctx.globalAlpha = 1;
}
