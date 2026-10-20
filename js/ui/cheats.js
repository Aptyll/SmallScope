'use strict';
// The practice bar: League's practice-tool column down the left edge, under
// the PRACTICE TOOL only. Icons on one hud plate, a name on hover (the
// tooltip), a press sends the command (cheatCmd, js/sim/practice.js).
// ------------------------------------------------------------ the practice bar
// Two groups on one plate, split by a gap: YOU (level, gold, the two standing
// toggles, reset) and THE FIELD (teleport, a dummy, clear the dummies). A
// toggle that is on wears the frost rim; a press flashes its well white.
// TELEPORT and DUMMY AIM rather than act: the press arms a ghost on the world
// tile under the pointer, a left press there sends the order (teleport once,
// dummies until the button, the right button or Escape puts it down). The
// chevron tab on the plate's right edge folds the column away to the tab.
// It hangs in the top-left corner and scales with the strip's size dial
// (hudSc) about its own top-left, capped so the column never runs off the bottom.
const CB_CELL = 16;          // a well: a 12px icon, 1px rim and 1px air round it
const CB_GAP = 2;            // between two wells
const CB_SPLIT = 7;          // between the two groups
const CB_TAB_W = 7, CB_TAB_H = 14; // the fold tab on the plate's right edge
const CB_FLASH_T = 0.18;     // s a pressed well stays white
// the buttons, top to bottom; `aim` arms a ghost, `auto` names a standing toggle
const CHEATS = [
  { id: 'level', name: 'LEVEL UP' },
  { id: 'gold', name: 'ADD GOLD', note: String(CHEAT_GOLD) },
  { id: 'cd', name: 'REFRESH COOLDOWNS', auto: true },
  { id: 'hp', name: 'REFRESH HEALTH', auto: true },
  { id: 'reset', name: 'RESET TO LEVEL 1' },
  { id: 'tp', name: 'TELEPORT', aim: true, split: true },
  { id: 'dummy', name: 'SPAWN DUMMY', aim: true },
  { id: 'clear', name: 'CLEAR DUMMIES' },
];
// the icons: 12x12 grids, baked once (SPR.bake, js/sprites/core.js)
const CB_PAL = { '.': null, o: '#0a0e1c', w: '#ddf1f8', s: '#b4b8bf', g: '#f2cc6a', h: '#ffedb0', d: '#b8912f',
  r: '#e0505a', R: '#f2909a', b: '#e0c890', n: '#8a6a4a', c: '#9fc4dd' };
const CB_ICONS = {
  level: [
    '.....oo.....',
    '....owwo....',
    '...owwwwo...',
    '..owwoowwo..',
    '.owwo..owwo.',
    '..oo.oo.oo..',
    '....owwo....',
    '...owwwwo...',
    '..owwoowwo..',
    '.owwo..owwo.',
    '..oo....oo..',
    '............',
  ],
  gold: [
    '............',
    '...oooooo...',
    '..ohhhhhho..',
    '..oggggggo..',
    '..oddddddo..',
    '..ohhhhhho..',
    '..oggggggo..',
    '..oddddddo..',
    '..ohhhhhho..',
    '..oggggggo..',
    '...oooooo...',
    '............',
  ],
  cd: [
    '.oooooooooo.',
    '.osssssssso.',
    '..owwwwwwo..',
    '...oggggo...',
    '....oggo....',
    '.....oo.....',
    '....owwo....',
    '...owwgwo...',
    '..owggggwo..',
    '.osssssssso.',
    '.oooooooooo.',
    '............',
  ],
  hp: [
    '............',
    '....oooo....',
    '....oRro....',
    '....orro....',
    '.ooooRrroooo',
    '.oRRrrrrrrro',
    '.orrrrrrrrro',
    '.oooorrroooo',
    '....orro....',
    '....orro....',
    '....oooo....',
    '............',
  ],
  reset: [
    '............',
    '....oooo.o..',
    '...owwwwowo.',
    '..owoooowwo.',
    '.owo...owwo.',
    '.owo..owwwo.',
    '.owo..ooooo.',
    '.owo........',
    '..owo...ow..',
    '...owoooo...',
    '....owww....',
    '.....ooo....',
  ],
  tp: [
    '.oo.........',
    '.owo........',
    '.owwo.......',
    '.owwwo......',
    '.owwwwo.....',
    '.owwwwwo....',
    '.owwwoooo.c.',
    '.owowo...ccc',
    '.oo.owo...c.',
    '.....oo.....',
    '..c.........',
    '.ccc........',
  ],
  dummy: [
    '....oooo....',
    '...obbbbo...',
    '...obbbbo...',
    '....oooo....',
    '.oooobboooo.',
    '.obbbbbbbbo.',
    '.oooobboooo.',
    '....obbo....',
    '....onno....',
    '....onno....',
    '...onnnno...',
    '...oooooo...',
  ],
  clear: [
    '............',
    '.oo......oo.',
    '.oro....oro.',
    '..oro..oro..',
    '...orooro...',
    '....orro....',
    '....orro....',
    '...orooro...',
    '..oro..oro..',
    '.oro....oro.',
    '.oo......oo.',
    '............',
  ],
};
let cbIcons = null;
function cbIcon(id) {
  if (!cbIcons) { cbIcons = {}; for (const k in CB_ICONS) cbIcons[k] = SPR.bake(CB_ICONS[k], CB_PAL); }
  return cbIcons[id];
}

// this screen's bar state, never the sim's: folded, which well was
// last pressed (the flash), and the armed aim ('tp' | 'dummy' | null)
const cheatUi = { open: true, flashId: null, flashT: 0, aim: null };

function cheatBarUp() { return PRACTICE && state.mode === 'play' && hudInT() >= 1 && !shopOpen(); }
// 1x layout, in the bar's own space (its top-left at the view's cheatTop):
// the plate flush with the left edge
function cheatPlateRect() {
  let h = AB_PAD * 2 + CHEATS.length * CB_CELL + (CHEATS.length - 1) * CB_GAP;
  for (const c of CHEATS) if (c.split) h += CB_SPLIT - CB_GAP;
  const w = AB_PAD * 2 + CB_CELL;
  return { x: 0, y: 0, w, h };
}
// where the bar's top lands in the view: level with the minimap's and the
// rail's tops, on the device grid (hudPx)
function cheatTop() { return hudPx(MM_GAP); }
// the bar's scale: the dial's, unless that would run it off the bottom
function cheatSc() {
  const s = hudSc(), room = VIEW_H - cheatTop() - 4, h = cheatPlateRect().h;
  return h * s <= room ? s : Math.min(s, hudSnapDown(room / h));
}
function cheatCellRect(i) {
  const pl = cheatPlateRect();
  let y = pl.y + AB_PAD;
  for (let j = 0; j < i; j++) y += CB_CELL + (CHEATS[j + 1].split ? CB_SPLIT : CB_GAP);
  return { x: pl.x + AB_PAD, y, w: CB_CELL, h: CB_CELL };
}
// the fold tab: on the plate's right edge while open, alone at the edge while folded
function cheatTabRect() {
  const pl = cheatPlateRect();
  const x = cheatUi.open ? pl.x + pl.w - 1 : 0;
  return { x, y: (pl.h - CB_TAB_H) >> 1, w: CB_TAB_W, h: CB_TAB_H };
}
// a view pointer mapped back into the bar's 1x space
function cheatMouse(mx, my) {
  const s = cheatSc();
  return { x: mx / s, y: (my - cheatTop()) / s };
}
const cbIn = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
// what the pointer is on: { kind: 'tab' } | { kind: 'cell', i } | { kind: 'plate' }
function cheatHit(mx, my) {
  if (!cheatBarUp()) return null;
  ({ x: mx, y: my } = cheatMouse(mx, my));
  if (cbIn(cheatTabRect(), mx, my)) return { kind: 'tab' };
  if (!cheatUi.open) return null;
  for (let i = 0; i < CHEATS.length; i++) {
    const r = cheatCellRect(i);
    if (cbIn(r, mx, my)) return { kind: 'cell', i };
  }
  if (cbIn(cheatPlateRect(), mx, my)) return { kind: 'plate' };
  return null;
}
// a left press on the bar: the tab folds, a well fires or arms. True when the
// bar took the press (so it never falls through to the world)
function cheatClick(mx, my) {
  const h = cheatHit(mx, my);
  if (!h) return false;
  SFX.unlock();
  if (h.kind === 'tab') { cheatUi.open = !cheatUi.open; if (!cheatUi.open) cheatUi.aim = null; SFX.ui(cheatUi.open); return true; }
  if (h.kind !== 'cell') return true;
  const c = CHEATS[h.i];
  cheatUi.flashId = c.id; cheatUi.flashT = CB_FLASH_T;
  if (c.aim) { cheatUi.aim = cheatUi.aim === c.id ? null : c.id; SFX.ui(!!cheatUi.aim); return true; }
  player.input.cmd = { kind: 'cheat', id: c.id };
  return true;
}
// the armed aim, pressed on the world: the order for the tile under the pointer
function cheatAimPress() {
  const tx = Math.floor(mouseWX() / TILE), ty = Math.floor(mouseWY() / TILE);
  if (!cheatAimOk(tx, ty)) { SFX.deny(); return; }
  SFX.unlock();
  player.input.cmd = { kind: 'cheat', id: cheatUi.aim, tx, ty };
  if (cheatUi.aim === 'tp') cheatUi.aim = null;
}
// what the ghost promises - the same tests cheatCmd makes, so green means it lands
function cheatAimOk(tx, ty) {
  if (!walkable(tx, ty, player)) return false;
  if (cheatUi.aim === 'dummy') {
    if (agame.phase !== 'off') return false;
    if (Math.floor(player.x / TILE) === tx && Math.floor(player.y / TILE) === ty) return false;
  }
  return true;
}
function cheatAimOff() { if (!cheatUi.aim) return false; cheatUi.aim = null; SFX.ui(false); return true; }
function cheatAimLive() { return !!cheatUi.aim && cheatBarUp() && !state.mapOpen && !state.settingsOpen && !state.wheel; }

// the tooltip's card for one well: its name, and what it is doing right now
function tipCheat(i) {
  const c = CHEATS[i];
  const d = { title: c.name, tcol: '#f4f7ff', kind: 'PRACTICE', icon: cbIcon(c.id), plate: BAG_WELL, rim: '#3c4048', rows: [], notes: [] };
  if (c.note) d.notes.push([c.note, '#f2cc6a']);
  if (c.auto) d.notes.push(CHEAT_AUTO[c.id] ? ['ON', HUD_FROST] : ['OFF', TIP_DIM]);
  if (c.id === 'clear') d.notes.push([cheatDummies.length + ' STANDING', TIP_DIM]);
  return d;
}

// ages the press flash on wall time (from the draw: it is this screen's look)
let cheatDrawT = 0;
function drawCheatBar(now) {
  if (!cheatBarUp()) { cheatUi.aim = null; return; }
  const dt = cheatDrawT ? Math.min(0.1, now - cheatDrawT) : 0;
  cheatDrawT = now;
  if (cheatUi.flashT > 0) cheatUi.flashT = Math.max(0, cheatUi.flashT - dt);
  const s = cheatSc();
  ctx.save();
  ctx.translate(0, cheatTop());
  if (s !== 1) ctx.scale(s, s);
  drawCheatBar1();
  ctx.restore();
}
function drawCheatBar1() {
  const hov = mouse.inside ? cheatHit(mouse.x, mouse.y) : null;
  const tab = cheatTabRect();
  if (cheatUi.open) {
    const pl = cheatPlateRect();
    drawHudFrame(pl.x, pl.y, pl.w, pl.h, { corners: { tl: false, tr: true, bl: false, br: true } });
    for (let i = 0; i < CHEATS.length; i++) {
      const c = CHEATS[i], r = cheatCellRect(i);
      const on = (c.auto && CHEAT_AUTO[c.id]) || (c.aim && cheatUi.aim === c.id);
      const hot = hov && hov.kind === 'cell' && hov.i === i;
      const flash = cheatUi.flashId === c.id && cheatUi.flashT > 0;
      ctx.fillStyle = flash ? '#ffffff' : on ? HUD_FROST : hot ? '#9ca1aa' : '#33363d';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = on ? '#1c2a4e' : BAG_WELL;
      ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      ctx.drawImage(cbIcon(c.id), r.x + 2, r.y + 2 - (hot ? 1 : 0));
    }
    // the gap between the groups carries one quiet steel tick
    for (let i = 1; i < CHEATS.length; i++) if (CHEATS[i].split) {
      const r = cheatCellRect(i);
      ctx.fillStyle = '#3c4048';
      ctx.fillRect(r.x + 3, r.y - ((CB_SPLIT + 1) >> 1), r.w - 6, 1);
    }
  }
  // the fold tab: a small plate with a chevron pointing where it will go
  const th = hov && hov.kind === 'tab';
  drawHudFrame(tab.x, tab.y, tab.w, tab.h, { corners: { tl: false, tr: true, bl: false, br: true }, lit: th ? '#d4d7dc' : undefined });
  ctx.fillStyle = th ? '#f4f7ff' : '#b4b8bf';
  const cx = tab.x + 3, cy = tab.y + (tab.h >> 1);
  for (let k = 0; k < 3; k++) {
    const x = cheatUi.open ? cx - 1 + k : cx + 1 - k;
    ctx.fillRect(x, cy - k, 1, 1 + 2 * k);
  }
}

// the armed aim's ghost on the world tile under the pointer: a dummy's
// silhouette or a landing ring, green where it lands and red where it would not
function drawCheatGhost(ox, oy) {
  if (!cheatAimLive() || !mouse.inside || overHud(mouse.x, mouse.y)) return;
  const tx = Math.floor(mouseWX() / TILE), ty = Math.floor(mouseWY() / TILE);
  const ok = cheatAimOk(tx, ty);
  const px = tx * TILE - ox, py = ty * TILE - oy;
  if (cheatUi.aim === 'dummy') {
    ctx.globalAlpha = ok ? 0.55 : 0.25;
    ctx.drawImage(DUMMY_SPR, px + ((TILE - DUMMY_SPR.width) >> 1), py + TILE - DUMMY_SPR.height);
    ctx.globalAlpha = 1;
  }
  const rim = (c, x, y) => { ctx.fillStyle = c; ctx.fillRect(x, y, TILE, 1); ctx.fillRect(x, y + TILE - 1, TILE, 1); ctx.fillRect(x, y, 1, TILE); ctx.fillRect(x + TILE - 1, y, 1, TILE); };
  rim('rgba(15,22,50,0.9)', px + 1, py + 1);
  rim(ok ? GHOST_OK : GHOST_NO, px, py);
}
