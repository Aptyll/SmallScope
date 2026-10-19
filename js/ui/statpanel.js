// ------ the stat panel
// THE HERO'S SEVEN STATS, LEFT OF THE PORTRAIT (League's own corner): a
// plate of two columns, an icon and a number a stat, the numbers statShown
// (js/sim/stats.js) prints - so a running bear buff is already in them, and
// the number it raises wears that buff's ring colour while it lasts. Pointing
// at one raises the tooltip's breakdown (tipStat): the base, what the levels
// added, the bonus gear and cards gave, the buff, and the total under a rule.
// It is part of the strip: drawn inside drawHudStrip, so it slides and scales
// with it (drawHudScaled bakes from its left edge), and answered by stripHit,
// so the world never sees a press on it.
const STAT_PANEL_W = 66;           // the plate, its frame included
const STAT_CELL_W = 29, STAT_CELL_H = 10, STAT_CELL_GAP = 1, STAT_ROW_GAP = 2;
const STAT_CELL_HOT = '#3a3e46';   // the pointed cell's well
// where each stat sits: rows of [left, right], STATS keys
const STAT_PANEL_GRID = [['dmg', 'ap'], ['as', 'haste'], ['armor', 'hp'], ['ms', null]];
// The icons: 7x7 marks on the strip's own inks, a 1px HUD_INK outline baked
// round each (so a 9x9 canvas, drawn one px up and left of the mark's corner).
const STAT_ICON_ART = {
  hp: ['#7fd36b', ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...', '.......']],
  dmg: ['#f0a050', ['.....xx', '....xxx', '...xxx.', 'x.xxx..', '.xxx...', '.xx....', 'x.x....']],
  as: ['#f2cc6a', ['x..x...', '.x..x..', '..x..x.', '...x..x', '..x..x.', '.x..x..', 'x..x...']],
  armor: ['#b8c4d4', ['xxxxxxx', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...']],
  ap: ['#c2a6ff', ['...x...', '...x...', '..xxx..', 'xxxxxxx', '..xxx..', '...x...', '...x...']],
  haste: ['#8fd8ff', ['xxxxxxx', '.x...x.', '..x.x..', '...x...', '..xxx..', '.xxxxx.', 'xxxxxxx']],
  ms: ['#e8eef6', ['..xxx..', '..xxx..', '..xxx..', '..xxxx.', '..xxxxx', 'xxxxxxx', 'xxxxxxx']],
};
const STAT_ICON = {};
for (const key of Object.keys(STAT_ICON_ART)) {
  const [col, rows] = STAT_ICON_ART[key];
  const cv = document.createElement('canvas'); cv.width = 9; cv.height = 9;
  const g = cv.getContext('2d');
  const on = (i, j) => rows[j] && rows[j][i] === 'x';
  g.fillStyle = HUD_INK;
  for (let j = -1; j <= 7; j++) for (let i = -1; i <= 7; i++) {
    if (on(i, j)) continue;
    if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) g.fillRect(i + 1, j + 1, 1, 1);
  }
  g.fillStyle = col;
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (on(i, j)) g.fillRect(i + 1, j + 1, 1, 1);
  STAT_ICON[key] = cv;
}
// the plate: flush against the strip's left frame, the strip's own height
function statPanelRect() {
  const R = hudStripRect();
  return { x: R.x - 3 - STAT_PANEL_W + 1, y: R.y, w: STAT_PANEL_W, h: R.h };
}
// every cell, in reading order: { key, x, y, w, h }
function statCells() {
  const P = statPanelRect(), out = [];
  STAT_PANEL_GRID.forEach((row, r) => row.forEach((key, c) => {
    if (key) out.push({ key, x: P.x + 4 + c * (STAT_CELL_W + STAT_CELL_GAP), y: P.y + 5 + r * (STAT_CELL_H + STAT_ROW_GAP), w: STAT_CELL_W, h: STAT_CELL_H });
  }));
  return out;
}
// in the strip's own coordinates (stripMouse already applied): a cell's
// {kind: 'stat', key}, the bare plate's 'frame', or null off it
function statPanelHit(mx, my) {
  const P = statPanelRect();
  if (mx < P.x || mx >= P.x + P.w || my < P.y || my >= P.y + P.h) return null;
  for (const c of statCells()) if (mx >= c.x && mx < c.x + c.w && my >= c.y && my < c.y + c.h) return { kind: 'stat', key: c.key };
  return { kind: 'frame' };
}
// the colour a buff paints the number it is raising, or null
function statBuffCol(p, key) {
  if (statBuffMul(p, key) === 1) return null;
  return (MONSTER[p.buffKind] && MONSTER[p.buffKind].buffCol) || BUFF_COL;
}
function drawStatPanel(hov) {
  const p = player, P = statPanelRect();
  drawHudFrame(P.x, P.y, P.w, P.h, { corners: { tl: true, tr: false, bl: false, br: false } });
  for (const c of statCells()) {
    ctx.fillStyle = hov && hov.kind === 'stat' && hov.key === c.key ? STAT_CELL_HOT : BAG_WELL;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.drawImage(STAT_ICON[c.key], c.x + 1, c.y + 1);
    const s = STATS.find((q) => q.key === c.key), t = s.fmt(statShown(p, c.key));
    drawPixelText(ctx, t, c.x + c.w - 2 - pixelTextWidth(t), c.y + 3, statBuffCol(p, c.key) || '#f4f7ff', 1);
  }
}
// THE BREAKDOWN, as a tooltip descriptor (drawTooltip, js/ui/tooltip.js):
// one row per source that adds something, and the total under a rule
const STAT_PCT = (v) => (v < 0 ? '-' : '+') + Math.round(Math.abs(v) * 100) + '%';
function tipStat(key) {
  const p = player, s = STATS.find((q) => q.key === key);
  const d = { title: s.name, tcol: '#f4f7ff', rows: [], notes: [], icon: STAT_ICON[key], plate: BAG_WELL, rim: '#3c4048' };
  const signed = (v) => (v < 0 ? '-' : '+') + s.fmt(Math.abs(v));
  for (const [label, v, kind] of statParts(p, key)) {
    if (kind === 'base') d.rows.push([label, s.fmt(v), '#f4f7ff']);
    else if (kind === 'lv') d.rows.push([label, signed(v), '#f4f7ff']);
    else if (kind === 'lvp') d.rows.push([label, STAT_PCT(v), '#f4f7ff']);
    else if (kind === 'add') d.rows.push([label, signed(v), v > 0 ? '#8fe08a' : '#e0637a']);
    else if (kind === 'addp') d.rows.push([label, STAT_PCT(v), v > 0 ? '#8fe08a' : '#e0637a']);
    else d.rows.push([label, STAT_PCT(v), statBuffCol(p, key) || '#f4f7ff']);
  }
  d.sum = [s.fmt(statShown(p, key)), statBuffCol(p, key) || '#f4f7ff'];
  return d;
}
