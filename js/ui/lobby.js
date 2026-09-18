// The POST-GAME LOBBY: the match's own record, read after it is over.
//
// The victory and defeat screens are a CEREMONY - one side, one headline,
// four numbers about you. They answer "what happened to me". This answers
// "what happened", which is a different question and wants a different
// screen: every player who flew in, both sides, side by side, with the six
// numbers a match is actually argued about afterwards and a graph of how the
// two sides pulled apart. LOBBY off either ending lands here first, and this
// screen's own LOBBY is the door out (toLobby, js/ui/screens.js) - so the
// walk out of a match is ceremony, then record, then the title.
//
// It is an INSTRUMENT in the sense CLAUDE.md's show-don't-label rule carves
// out: its whole job is comparing numbers between ten people, so it gets
// column headings and printed values the way the practice room's meters and
// the merchant's price graphs do. Everything that is NOT a number still reads
// as a shape - the side you are on is a colour, a player's class is its
// emblem, a row's share of the sorted column is the bar under it, and the
// heading you sorted by wears the arrow.
//
// Nothing here runs during a match except sampleStats() below, and nothing
// here is anybody's state but this screen's: the table is frozen out of
// `players` the moment the match ends (statFreeze, from endMatch) so the bots
// still farming underneath a won match cannot move the numbers while you read
// them.

// ------------------------------------------------------------ the samples
// The two graphs are drawn from a running sample of every player's cumulative
// gold earned and damage dealt. They live ON the player (hGold/hDmg, the
// Player constructor) rather than in a table of their own for one reason: a
// player field crosses the wire with everything else, so a client's lobby
// draws the host's graph instead of a flat line. Every player is sampled on
// the same tick, active or not, so index i means the same moment in all ten
// arrays and the series can simply be summed per side.
//
// A match has no length limit, so the series cannot either: past STAT_MAX
// samples each one HALVES - every other sample dropped, newest kept - and the
// pitch doubles with it. The spacing stays uniform, which is all the graph
// needs, and ten players' history stays a few hundred numbers however long
// the match runs.
const STAT_STEP = 10;  // s between samples
const STAT_MAX = 72;   // samples kept per series before it halves and the pitch doubles
let statT = 0;         // s toward the next sample (the host's clock; a client never steps)

// every other sample, newest kept, oldest dropped first
function statHalve(a) {
  const out = [];
  for (let i = a.length - 1; i >= 0; i -= 2) out.push(a[i]);
  out.reverse();
  return out;
}

function sampleStats(dt) {
  statT += dt;
  if (statT < STAT_STEP) return;
  statT -= STAT_STEP;
  for (const p of players) {
    p.hGold.push(p.xp);
    p.hDmg.push(p.dmgOut);
    if (p.hGold.length > STAT_MAX) { p.hGold = statHalve(p.hGold); p.hDmg = statHalve(p.hDmg); }
  }
}

// ------------------------------------------------------------ the record
// The table, frozen. endMatch calls this on every real ending (a respawn wait
// is not one), so what the lobby prints is the match as it ENDED, not as it
// stands by the time the ceremony is over and the plank is pressed.
let matchStats = null;

function statFreeze() {
  matchStats = {
    time: state.elapsed,
    over: state.over,
    rows: players.filter((q) => q.active).map((q) => ({
      id: q.id, name: q.name, cls: q.cls, team: q.team, you: q === player,
      level: q.level, kills: q.kills, deaths: q.deaths,
      dmg: q.dmgOut, siege: q.dmgBird + q.dmgStruct, gold: q.xp,
      hGold: q.hGold.slice(), hDmg: q.hDmg.slice(),
    })),
    // which sides are still standing at the whistle: a side whose bird has
    // been driven off is out, and a lone side left standing wears the crest
    down: [0, 1].map((t) => teamEagleDown(t)),
  };
}

// ------------------------------------------------------------ the columns
// Six numbers, each right-aligned under its own heading and each sortable by
// clicking that heading. `w` is what the widest value the column can hold
// needs at 2x, so the table's geometry is this table's own business.
const SCORE_COLS = [
  { key: 'level', head: 'LV', w: 16 },
  { key: 'kills', head: 'K', w: 16 },
  { key: 'deaths', head: 'D', w: 16 },
  { key: 'dmg', head: 'DMG', w: 40 },
  { key: 'siege', head: 'SIEGE', w: 40 },
  { key: 'gold', head: 'GOLD', w: 34 },
];
const SCORE_GAP = 8;    // px between columns
const SCORE_ROW = 12;   // px per player row
const SCORE_STRIP = 10; // px of team heading over each block
const SCORE_ICON = 12;  // the class emblem (classIcon12, js/ui/menu.js)

// this screen's whole state - it is one screen's UI and nothing the match or
// the wire has any business in, so it lives here rather than on `state`
const scores = {
  t: 0,          // s since the screen opened: the fade and the row cascade
  last: 0,       // the frame clock's last reading, so t steps on real time
  tab: 0,        // which graph: 0 gold, 1 damage
  sort: 'gold',  // the column the blocks are ordered by...
  desc: true,    // ...and which way
  sel: 0,        // the keyboard's plank
  hover: [0, 0], // per-plank hover ease
  from: 'menu',  // the view BACK returns to
};

const SCORE_PLANKS = ['BACK', 'LOBBY'];
const SCORE_IN = 0.28; // s the screen takes to arrive

// the accents each ending is struck in: a win is gold, anything else frost
// The head, the rule and the sort arrow are struck in the ending's own
// accent - gold for a win, frost for anything else, the way the two
// ceremonies are. `sort` is NOT: it is the colour the sorted column's numbers
// are printed in, and a frost one would read dimmer than an ordinary column
// rather than brighter, so the mark on "this is the column you asked for" is
// the game's own number gold on both endings.
function scoreAccent() {
  return (matchStats && matchStats.over) === 'won'
    ? { rule: '#c89a3c', txt: '#f2cc6a', hi: '#ffd95c', sort: '#ffd95c' }
    : { rule: '#3f5a77', txt: '#9fc4dd', hi: '#cfe4f2', sort: '#f2cc6a' };
}
function scoreHead() {
  const o = matchStats && matchStats.over;
  return o === 'won' ? 'VICTORY' : o === 'hostleft' ? 'NO RESULT' : 'DEFEAT';
}

// ------------------------------------------------------------ the layout
// Authored in the 270-row frame every other screen is (frameTop, core.js) and
// centred in whatever width the view actually has, so the table breathes with
// the window without a single literal 640 in it.
function scoresLayout() {
  const toy = frameTop();
  const nums = SCORE_COLS.reduce((a, c) => a + c.w + SCORE_GAP, 0);
  const w = Math.max(240, Math.min(VIEW_W - 24, 440));
  const x = Math.round((VIEW_W - w) / 2);
  // the numbers are pinned to the right edge and the name takes what is left,
  // so a narrow view loses name room rather than losing a column
  const cols = [];
  let cx = x + w - 4;
  for (let i = SCORE_COLS.length - 1; i >= 0; i--) {
    cx -= SCORE_COLS[i].w;
    cols[i] = { x: cx, w: SCORE_COLS[i].w, c: SCORE_COLS[i] };
    cx -= SCORE_GAP;
  }
  const nameX = x + 4 + SCORE_ICON + 4;
  const blockH = SCORE_STRIP + 5 * SCORE_ROW;
  const L = {
    toy, x, w, cols, nameX, nameW: Math.max(8, cols[0].x - 6 - nameX),
    headY: toy + 6, ruleY: toy + 22, colHY: toy + 26,
    blocks: [toy + 34, toy + 34 + blockH + 4],
    tabsY: toy + 184, graph: { x: x, y: toy + 194, w: w, h: 40 },
    plankY: toy + 240,
  };
  L.tabs = ['GOLD', 'DAMAGE'].map((label, i) => ({
    label, x: L.x + i * 56, y: L.tabsY, w: 52, h: 9,
  }));
  const pw = SCORE_PLANKS.length * DEAD_BW + (SCORE_PLANKS.length - 1) * DEAD_GAP;
  L.planks = SCORE_PLANKS.map((label, i) => ({
    label, x: Math.round((VIEW_W - pw) / 2) + i * (DEAD_BW + DEAD_GAP), y: L.plankY, w: DEAD_BW, h: DEAD_BH,
  }));
  return L;
}

// the two sides in reading order - yours first, whatever index it was dealt -
// each already sorted by the live column
function scoreBlocks() {
  if (!matchStats) return [];
  const mine = player ? player.team : 0;
  const dir = scores.desc ? -1 : 1;
  return [mine, 1 - mine].map((t) => ({
    team: t,
    down: matchStats.down[t],
    rows: matchStats.rows.filter((r) => r.team === t)
      .sort((a, b) => (a[scores.sort] - b[scores.sort]) * dir || a.id - b.id),
  }));
}

// the biggest value in the sorted column anywhere in the match: what every
// row's bar is drawn as a share of
function scoreBest() {
  let best = 0;
  if (matchStats) for (const r of matchStats.rows) best = Math.max(best, r[scores.sort]);
  return best;
}

// ------------------------------------------------------------ the way in
// LOBBY off either ending lands here rather than leaving (deadActivate,
// js/ui/screens.js). `from` is the view BACK hands the screen back to.
function openScores(from) {
  if (!matchStats) statFreeze(); // a driver that opened the screen without an ending
  scores.from = from;
  scores.t = 0;
  scores.sel = 0;
  scores.hover = [0, 0];
  state.deadView = 'scores';
}

function scoresBack() {
  state.deadView = scores.from;
  SFX.pickup();
}

// what the pointer is on: a column heading, a graph tab, a plank, or nothing.
// The screen has to have arrived first - a control that is still fading in is
// not a control yet.
function scoresHit() {
  if (scores.t < SCORE_IN) return null;
  const L = scoresLayout();
  const inR = (r, pad) => mouse.x >= r.x - (pad || 0) && mouse.x < r.x + r.w + (pad || 0)
    && mouse.y >= r.y - (pad || 0) && mouse.y < r.y + r.h + (pad || 0);
  for (let i = 0; i < L.cols.length; i++) {
    if (inR({ x: L.cols[i].x - 3, y: L.colHY - 3, w: L.cols[i].w + 6, h: 11 })) return { kind: 'col', i };
  }
  for (let i = 0; i < L.tabs.length; i++) if (inR(L.tabs[i], 1)) return { kind: 'tab', i };
  for (let i = 0; i < L.planks.length; i++) if (inR(L.planks[i], 2)) return { kind: 'plank', i };
  return null;
}

function scoresSort(key) {
  if (scores.sort === key) scores.desc = !scores.desc;
  else { scores.sort = key; scores.desc = true; }
  SFX.pickup();
}

function scoresActivate(i) {
  SFX.place();
  if (SCORE_PLANKS[i] === 'BACK') scoresBack();
  else toLobby();
}

function scoresKey(k) {
  // the arrival is skippable, the way both ceremonies are
  if (scores.t < SCORE_IN) { scores.t = SCORE_IN; return; }
  if (k === 'escape' || k === 'backspace') { scoresBack(); return; }
  const d = moveDir(k);
  if (d === 'left') { scores.sel = (scores.sel + SCORE_PLANKS.length - 1) % SCORE_PLANKS.length; SFX.pickup(); }
  else if (d === 'right') { scores.sel = (scores.sel + 1) % SCORE_PLANKS.length; SFX.pickup(); }
  // up/down is the graph's, since the planks are a row and the tabs are the
  // only other thing on the screen a key could mean
  else if (d === 'up' || d === 'down') { scores.tab = 1 - scores.tab; SFX.pickup(); }
  else if (k === 'enter' || k === ' ') scoresActivate(scores.sel);
}

function scoresClick() {
  if (scores.t < SCORE_IN) { scores.t = SCORE_IN; return; }
  const h = scoresHit();
  if (!h) return;
  if (h.kind === 'col') scoresSort(SCORE_COLS[h.i].key);
  else if (h.kind === 'tab') { if (scores.tab !== h.i) { scores.tab = h.i; SFX.pickup(); } }
  else { scores.sel = h.i; scoresActivate(h.i); }
}

// ------------------------------------------------------------ the pixels
const SC_DARK = '#0a0e23', SC_PLATE = '#141c3c', SC_WELL = '#10162f';
const SC_RULE = '#35426e', SC_DIM = '#5a6a99', SC_TXT = '#cfe0ff', SC_LIT = '#f4f7ff';

// a 2x number, right-aligned in its column
function scoreNum(txt, col, y, color) {
  txt = String(txt);
  drawPixelTextShadow(ctx, txt, col.x + col.w - pixelTextWidth(txt, 2), y, color, SC_DARK, 2);
}

function renderScores(now) {
  const dt = Math.min(0.05, now - (scores.last || now));
  scores.last = now;
  scores.t += dt;
  const L = scoresLayout();
  const ac = scoreAccent();
  const arrive = Math.min(1, scores.t / SCORE_IN);
  const hit = scoresHit();

  // the backdrop: the ceremony underneath is put away entirely - this screen
  // is a page, not an overlay on a stage
  // OPAQUE once it has arrived: the ceremony's stage, and the match still
  // playing under that, are put away entirely. A page that lets the pines
  // show through reads as a pause menu, which is the wrong promise.
  ctx.fillStyle = arrive < 1 ? 'rgba(6,9,22,' + (0.95 * arrive).toFixed(3) + ')' : '#060916';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (arrive < 1) ctx.globalAlpha = arrive;

  // --- the head: the result, and how long it took ------------------------
  drawPixelTextShadow(ctx, scoreHead(), L.x, L.headY, ac.txt, SC_DARK, 2);
  const clock = clockTxt(matchStats ? matchStats.time : state.elapsed);
  drawPixelTextShadow(ctx, clock, L.x + L.w - pixelTextWidth(clock, 2), L.headY, SC_TXT, SC_DARK, 2);
  ctx.fillStyle = ac.rule;
  ctx.fillRect(L.x, L.ruleY, Math.round(L.w * arrive), 1);

  // --- the column headings, which are also the sort control --------------
  for (const col of L.cols) {
    const on = scores.sort === col.c.key;
    const hot = hit && hit.kind === 'col' && L.cols[hit.i] === col;
    const head = col.c.head;
    const hw = pixelTextWidth(head, 1);
    // the arrow is the whole explanation of what a heading does: the one
    // wearing it is the one the blocks are ordered by, and it points the way
    const ax = col.x + col.w - (on ? 5 : 0);
    drawPixelText(ctx, head, ax - hw, L.colHY, on ? ac.sort : hot ? SC_TXT : SC_DIM, 1);
    if (on) {
      const tx = col.x + col.w - 3, ty = L.colHY + 1;
      ctx.fillStyle = ac.sort;
      for (let i = 0; i < 3; i++) {
        const row = scores.desc ? ty + i : ty + 2 - i;
        ctx.fillRect(tx - (2 - i), row, (2 - i) * 2 + 1, 1);
      }
    }
  }

  // --- the two sides -----------------------------------------------------
  const blocks = scoreBlocks();
  const best = scoreBest();
  for (let b = 0; b < blocks.length; b++) {
    const blk = blocks[b], y0 = L.blocks[b], tm = TEAMS[skin(blk.team)];
    // the team strip: the side's colour edge to edge, its name in it, and the
    // side's own totals at the right end - the blocks compare as blocks too
    ctx.fillStyle = SC_PLATE;
    ctx.fillRect(L.x, y0, L.w, SCORE_STRIP);
    ctx.fillStyle = tm.mark;
    ctx.fillRect(L.x, y0, 2, SCORE_STRIP);
    ctx.globalAlpha = (arrive < 1 ? arrive : 1) * 0.5;
    ctx.fillRect(L.x + 2, y0, L.w - 2, 1);
    ctx.globalAlpha = arrive < 1 ? arrive : 1;
    drawPixelText(ctx, tm.name, L.x + 6, y0 + 3, tm.mark, 1);
    // the crest: one side left standing at the whistle wears it, and neither
    // does while both birds are still on their roosts
    if (!blk.down && blocks.some((o) => o.down)) {
      const cx = L.x + 8 + pixelTextWidth(tm.name, 1) + 6;
      ctx.fillStyle = ac.hi;
      for (let i = 0; i < 3; i++) ctx.fillRect(cx - 3 + i * 3, y0 + 2 + (i === 1 ? 0 : 1), 2, i === 1 ? 5 : 4);
      ctx.fillRect(cx - 4, y0 + 7, 9, 1);
    }
    // the side's totals, under the same headings the rows use
    for (const col of L.cols) {
      let sum = 0;
      for (const r of blk.rows) sum += r[col.c.key];
      if (col.c.key === 'level') sum = blk.rows.length ? Math.round(sum / blk.rows.length) : 0;
      scoreNumSmall(String(sum), col, y0 + 3, SC_DIM);
    }

    for (let i = 0; i < blk.rows.length; i++) {
      const r = blk.rows[i];
      const ry = y0 + SCORE_STRIP + i * SCORE_ROW;
      // the rows cascade in, a beat apart, so the eye is walked down the block
      const ra = Math.max(0, Math.min(1, (scores.t - SCORE_IN - (b * 5 + i) * 0.035) / 0.18));
      if (ra <= 0) continue;
      ctx.globalAlpha = (arrive < 1 ? arrive : 1) * ra;
      // your own row is the one you came to read: it sits on a lit plate
      ctx.fillStyle = r.you ? '#1c2750' : i & 1 ? '#0e1430' : '#0b1026';
      ctx.fillRect(L.x, ry, L.w, SCORE_ROW - 1);
      // THE BAR IS THE ROW. This row's share of the biggest value anywhere in
      // the column the table is sorted by, drawn as the row's own fill in the
      // side's colour rather than as a line somewhere in it - so the block
      // reads as a bar chart at a glance and nothing crosses the names. It is
      // what makes a heading worth pressing: the numbers say how much, the
      // fill says how much OF the best.
      if (best > 0) {
        ctx.globalAlpha = (arrive < 1 ? arrive : 1) * ra * (r.you ? 0.34 : 0.22);
        ctx.fillStyle = tm.mark;
        ctx.fillRect(L.x, ry, Math.round(L.w * Math.max(0, r[scores.sort]) / best), SCORE_ROW - 1);
        ctx.globalAlpha = (arrive < 1 ? arrive : 1) * ra;
      }
      if (r.you) { ctx.fillStyle = tm.mark; ctx.fillRect(L.x, ry, 2, SCORE_ROW - 1); }
      ctx.drawImage(classIcon12(r.cls, r.you), L.x + 4, ry - 1);
      drawPixelTextShadow(ctx, r.name, L.nameX, ry + 2, r.you ? SC_LIT : SC_TXT, SC_DARK, 2);
      for (const col of L.cols) {
        const on = scores.sort === col.c.key;
        scoreNum(r[col.c.key], col, ry + 2, on ? ac.sort : r.you ? SC_LIT : SC_TXT);
      }
      ctx.globalAlpha = arrive < 1 ? arrive : 1;
    }
  }

  // --- the graph ---------------------------------------------------------
  for (let i = 0; i < L.tabs.length; i++) {
    const t = L.tabs[i], on = scores.tab === i;
    const hot = hit && hit.kind === 'tab' && hit.i === i;
    ctx.fillStyle = on ? SC_PLATE : '#0c1228';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = on ? ac.rule : hot ? SC_RULE : '#1b2445';
    ctx.fillRect(t.x, t.y, t.w, 1);
    const tw = pixelTextWidth(t.label, 1);
    drawPixelText(ctx, t.label, t.x + Math.round((t.w - tw) / 2), t.y + 3, on ? ac.hi : hot ? SC_TXT : SC_DIM, 1);
  }
  drawScoreGraph(L.graph, ac);

  // --- the planks --------------------------------------------------------
  for (let i = 0; i < L.planks.length; i++) {
    const want = (hit && hit.kind === 'plank' ? hit.i === i : scores.sel === i) ? 1 : 0;
    scores.hover[i] += (want - scores.hover[i]) * Math.min(1, dt * 14);
    drawMenuButton(L.planks[i], L.planks[i].label, scores.hover[i], now, false);
  }
  ctx.globalAlpha = 1;
}

// the team totals on the strip, 1x so they sit under the 2x rows without
// competing with them
function scoreNumSmall(txt, col, y, color) {
  drawPixelText(ctx, txt, col.x + col.w - pixelTextWidth(txt, 1), y, color, 1);
}

// The graph: one line per side, summed over its players, in the side's own
// colour, with the area under it filled. A chart with no scale is a squiggle
// (the merchant's own rule, js/ui/shop.js), so the top of the well prints the
// biggest value it reaches and the right end prints the match clock; the
// dotted uprights are the match's days.
function drawScoreGraph(r, ac) {
  const key = scores.tab === 0 ? 'hGold' : 'hDmg';
  ctx.fillStyle = SC_WELL;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = SC_RULE;
  ctx.fillRect(r.x, r.y, r.w, 1);
  ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
  if (!matchStats) return;
  const mine = player ? player.team : 0;
  const sides = [mine, 1 - mine].map((t) => {
    const rows = matchStats.rows.filter((q) => q.team === t);
    let n = 0;
    for (const q of rows) n = Math.max(n, q[key].length);
    const sum = new Array(n).fill(0);
    for (const q of rows) { const h = q[key]; for (let i = 0; i < n; i++) sum[i] += h[i] === undefined ? (h.length ? h[h.length - 1] : 0) : h[i]; }
    return { t, sum };
  });
  const n = Math.max(sides[0].sum.length, sides[1].sum.length);
  // a match shorter than one sample has nothing to draw: say so with the
  // empty well rather than with a sentence
  if (n < 2) {
    ctx.fillStyle = SC_DIM;
    ctx.fillRect(r.x + 4, r.y + (r.h >> 1), r.w - 8, 1);
    return;
  }
  let hi = 1;
  for (const s of sides) for (const v of s.sum) hi = Math.max(hi, v);
  // x = 0 is the drop, which every series starts from at zero, so the line
  // leaves the corner rather than the first sample's height
  const px = (i) => r.x + 1 + Math.round(i / n * (r.w - 3));
  const py = (v) => r.y + r.h - 2 - Math.round(v / hi * (r.h - 4));
  // the days, counted forward from the drop at the pitch the samples ended on
  const span = matchStats.time || 1;
  ctx.fillStyle = '#20294f';
  for (let d = 1; d * CYCLE < span; d++) {
    const gx = r.x + Math.round(d * CYCLE / span * (r.w - 1));
    for (let y = r.y + 1; y < r.y + r.h - 1; y += 3) ctx.fillRect(gx, y, 1, 2);
  }
  // THE LEAD, shaded between the two lines in the colour of whoever is ahead
  // at that moment. Two cumulative totals nest - the trailing side's area is
  // inside the leading side's - so filling under each one just fills the well;
  // what a reader wants off this graph is the GAP and when it opened, which is
  // the band itself. The lines keep the absolute totals readable over it.
  const at = (s, i) => (i === 0 ? 0 : s.sum[Math.min(i - 1, s.sum.length - 1)]);
  ctx.globalAlpha = 0.3;
  for (let i = 0; i <= n; i++) {
    const a = at(sides[0], i), b = at(sides[1], i);
    if (a === b) continue;
    const ya = py(a), yb = py(b);
    ctx.fillStyle = TEAMS[skin(a > b ? sides[0].t : sides[1].t)].mark;
    ctx.fillRect(px(i), Math.min(ya, yb), 1, Math.abs(ya - yb) + 1);
  }
  ctx.globalAlpha = 1;
  // the rival's line first, so your own side's is the one on top where they cross
  for (const s of [sides[1], sides[0]]) {
    const col = TEAMS[skin(s.t)].mark;
    ctx.fillStyle = col;
    let lx = px(0), ly = py(0);
    for (let i = 1; i <= n; i++) {
      const x = px(i), y = py(at(s, i));
      const y0 = Math.min(ly, y), y1 = Math.max(ly, y);
      ctx.fillRect(x, y0, 1, y1 - y0 + 1);
      if (x > lx + 1) ctx.fillRect(lx, ly, x - lx, 1);
      lx = x; ly = y;
    }
    // the head of the line, so which side ended where reads without counting
    ctx.fillStyle = SC_LIT;
    ctx.fillRect(lx - 1, ly - 1, 3, 3);
    ctx.fillStyle = col;
    ctx.fillRect(lx, ly, 1, 1);
  }
  // the scale, and nothing else: the match clock is already in the head, and
  // a fact printed twice is a fact that drifts in one of the two places
  drawPixelTextShadow(ctx, String(hi), r.x + 3, r.y + 3, ac.txt, SC_WELL, 1);
}
