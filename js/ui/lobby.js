// The POST-GAME LOBBY: the match's own record, read after it is over.
//
// The victory and defeat screens are a CEREMONY - one side, one headline,
// four numbers about you. They answer "what happened to me". This answers
// "what happened", which is a different question and wants a different
// screen: League's post-game page - every player who flew in a column, both
// sides, the numbers a match is argued about afterwards in folding groups,
// and a page charting any one of those numbers as a bar per player. LOBBY
// off either ending lands here first, and this
// screen's own LOBBY is the door out (toLobby, js/ui/screens.js) - so the
// walk out of a match is ceremony, then record, then the title.
//
// It is an INSTRUMENT in the sense CLAUDE.md's show-don't-label rule carves
// out: its whole job is comparing numbers between ten people, so it gets
// row names and printed values the way the practice room's meters and the
// merchant's price graphs do. Everything that is NOT a number still reads as
// a shape - the side is a colour, a player is their face, your column is a
// lit band in gold, and the best in each row wears its side's underline.
//
// Nothing here runs during a match except sampleStats() below, and nothing
// here is anybody's state but this screen's: the table is frozen out of
// `players` the moment the match ends (statFreeze, from endMatch) so the bots
// still farming underneath a won match cannot move the numbers while you read
// them.

// ------------------------------------------------------------ the samples
// A running sample of every player's cumulative gold earned and damage dealt,
// once the lobby's line graphs. The GRAPHS page is a bar chart of the frozen
// record now (drawScoreBars) and draws none of it; the bot lab reads the last
// gold (js/ui/botview.js), and the series stay for a timeline to come. They
// live ON the player (hGold/hDmg, the Player constructor) because a player
// field crosses the wire with everything else. Every player is sampled on the
// same tick, active or not, so index i means the same moment in all ten arrays.
//
// A match has no length limit, so the series cannot either: past STAT_MAX
// samples each one HALVES - every other sample dropped, newest kept - and the
// pitch doubles with it. The spacing stays uniform, which is all a timeline
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
      streak: q.bestStreak, multi: q.bestMulti, cc: Math.round(q.ccOut),
      dmg: q.dmgOut, bird: q.dmgBird, struct: q.dmgStruct, beast: Math.round(q.dmgBeast),
      inP: q.dmgInP, inB: q.dmgInB, healed: Math.round(q.healed),
      gold: q.xp, spent: q.goldSpent, beasts: q.beasts,
    })),
    // which sides are still standing at the whistle: a side whose bird has
    // been driven off is out, and a lone side left standing wears the crest
    down: [0, 1].map((t) => teamEagleDown(t)),
  };
}

// ------------------------------------------------------------ the groups
// League's post-game page, read sideways: a COLUMN per player, faces across
// the top, and the numbers in folding groups down the side. `key` is the
// number a row compares, `txt` how it prints when that is not the plain
// number, and `best: false` leaves a row out of the underline the biggest
// value in every other row wears (in its side's colour): a K/D has no single
// best, and the most damage TAKEN is nobody's prize.
const SCORE_GROUPS = [
  { head: 'COMBAT', rows: [
    { label: 'K/D', key: 'kills', txt: (r) => r.kills + '/' + r.deaths, best: false },
    { label: 'LEVEL', key: 'level' },
    { label: 'BEST STREAK', key: 'streak' },
    { label: 'BEST MULTI-KILL', key: 'multi' },
    { label: 'CROWD CONTROL', key: 'cc', txt: (r) => scoreFmt(r.cc) + 'S' },
  ] },
  { head: 'DAMAGE DEALT', rows: [
    { label: 'TO PLAYERS', key: 'dmg' },
    { label: 'TO THE BIRD', key: 'bird' },
    { label: 'TO BUILDINGS', key: 'struct' },
    { label: 'TO BEASTS', key: 'beast' },
    { label: 'TOTAL', key: 'dealt' },
  ] },
  { head: 'TAKEN AND HEALED', rows: [
    { label: 'FROM PLAYERS', key: 'inP', best: false },
    { label: 'FROM BEASTS', key: 'inB', best: false },
    { label: 'HEALED', key: 'healed' },
  ] },
  { head: 'GOLD', rows: [
    { label: 'EARNED', key: 'gold' },
    { label: 'SPENT', key: 'spent' },
    { label: 'BEASTS HUNTED', key: 'beasts' },
  ] },
];
const SCORE_LABEL_W = 92; // px of row names down the left
const SCORE_COL_W = 46;   // px per player column at most: a six-digit number and its air
const SCORE_TEAM_GAP = 10; // px between the two sides
const SCORE_FACE = 26;    // the portrait square over each column
const SCORE_NAME = 8;     // px per line of names under the faces: two lines, the columns taking turns,
                          // so every name has two columns' width to be printed whole in
const SCORE_LIST_W = 104; // px of the GRAPHS page's stat list down the left
const SCORE_LIST_ROW = 9; // px per stat in that list (a group heading takes SCORE_HEAD)
// every row of every group in one list: what the GRAPHS page picks among
const SCORE_STATS = SCORE_GROUPS.flatMap((g) => g.rows);
const SCORE_ROW = 10;     // px per stat row
const SCORE_HEAD = 11;    // px per group heading, and the 2 under a group
// a number in a column: whole up to 99999, past that its magnitude (shortNum,
// js/sim/core.js: 100K, 2.4M, 1B) so no column ever outgrows its width
function scoreFmt(n) {
  n = Math.round(n || 0);
  return n >= 100000 ? shortNum(n) : String(n);
}
// a name cut to what fits in w px (it only ever bites on a view narrowed
// below the columns' full width: two columns hold the longest name there is)
function scoreName(nm, w) {
  nm = String(nm || '');
  const n = Math.max(1, Math.floor((w + 1) / 4));
  return nm.length > n ? nm.slice(0, n) : nm;
}
function scoreVal(r, row) {
  return row.key === 'dealt' ? r.dmg + r.bird + r.struct + r.beast : r[row.key] || 0;
}

// this screen's whole state - it is one screen's UI and nothing the match or
// the wire has any business in, so it lives here rather than on `state`
const scores = {
  t: 0,          // s since the screen opened: the fade and the column cascade
  last: 0,       // the frame clock's last reading, so t steps on real time
  page: 0,       // 0 the stats, 1 the graphs
  stat: 5,       // the row the GRAPHS page charts, in SCORE_STATS (5: damage to players)
  shut: {},      // the folded groups, by head, for the session
  scroll: 0,     // px the stats are scrolled up when they outgrow the view
  sel: 2,        // the keyboard's word in SCORE_WORDS
  from: 'menu',  // the view BACK returns to
};

// the words a key walks: the two pages, then the two ways out
const SCORE_WORDS = ['STATS', 'GRAPHS', 'BACK', 'LOBBY'];
const SCORE_IN = 0.28; // s the screen takes to arrive

// The head is struck in the ending's own accent - gold for a win, frost for
// anything else, the way the two ceremonies are.
function scoreAccent() {
  return (matchStats && matchStats.over) === 'won'
    ? { rule: '#c89a3c', txt: '#f2cc6a', hi: '#ffd95c' }
    : { rule: '#3f5a77', txt: '#9fc4dd', hi: '#cfe4f2' };
}
function scoreHead() {
  const o = matchStats && matchStats.over;
  return o === 'won' ? 'VICTORY' : o === 'hostleft' ? 'NO RESULT' : 'DEFEAT';
}

// ------------------------------------------------------------ the layout
// Centred in whatever the view has, the full height of it: the head and the
// page words on top, the faces under them, the groups in a window that
// scrolls when a short view cannot hold them all, and BACK / LOBBY as bare
// words at the foot, the title screen's own (drawMenuItems, js/ui/menu.js).
function scoreCols() {
  if (!matchStats) return [];
  const mine = player ? player.team : 0;
  const side = (t) => matchStats.rows.filter((r) => r.team === t).sort((a, b) => (b.you - a.you) || a.id - b.id);
  return side(mine).concat(side(1 - mine));
}
function scoresLayout() {
  const cols = scoreCols();
  const nMine = cols.filter((r) => r.team === (player ? player.team : 0)).length;
  const gap = nMine && nMine < cols.length ? SCORE_TEAM_GAP : 0;
  // a narrow view narrows the columns, never the numbers: a six-digit value
  // still fits at the floor's width (320, fitCanvas js/app/canvas.js)
  const colW = Math.max(20, Math.min(SCORE_COL_W, Math.floor((VIEW_W - 8 - SCORE_LABEL_W - gap) / Math.max(1, cols.length))));
  const face = Math.min(SCORE_FACE, colW - 2);
  const w = SCORE_LABEL_W + cols.length * colW + gap;
  const x = Math.round((VIEW_W - w) / 2);
  const L = { x, w, cols, colW, face, headY: 10, tabsY: 30, ruleY: 40, faceY: 46 };
  L.colX = cols.map((r, i) => x + SCORE_LABEL_W + i * colW + (i >= nMine ? gap : 0));
  L.wordY = VIEW_H - 24;
  L.nameY = L.faceY + face + 4;
  L.body = { x, y: L.nameY + SCORE_NAME * 2 + 3, w, h: 0 };
  L.body.h = Math.max(20, L.wordY - 8 - L.body.y);
  // the stats' own height, every open group at full length
  let h = 0;
  for (const g of SCORE_GROUPS) h += SCORE_HEAD + (scores.shut[g.head] ? 0 : g.rows.length * SCORE_ROW) + 2;
  L.contentH = h;
  L.maxScroll = Math.max(0, h - L.body.h);
  // the GRAPHS page: the stat list down the left, every group's rows under its
  // heading (scrolled to keep the picked one in sight on a short view), and
  // the chart in what is left - one bar a player, your side first, a gap, the rivals
  const gy = L.ruleY + 6, gh = Math.max(60, L.wordY - 10 - gy);
  L.list = { x, y: gy, w: SCORE_LIST_W, h: gh, rows: [] };
  let ly = 0;
  for (const g of SCORE_GROUPS) {
    L.list.rows.push({ head: g.head, y: ly }); ly += SCORE_HEAD;
    for (const row of g.rows) { L.list.rows.push({ i: SCORE_STATS.indexOf(row), row, y: ly }); ly += SCORE_LIST_ROW; }
    ly += 2;
  }
  const pk = L.list.rows.find((e) => e.i === scores.stat);
  L.list.off = pk ? Math.max(0, Math.min(ly - gh, pk.y + SCORE_LIST_ROW * 2 - gh)) : 0;
  const cx0 = x + SCORE_LIST_W + 10;
  L.chart = { x: cx0, y: gy + 12, w: x + w - cx0, h: gh - 12 - 10 };
  const gapB = nMine && nMine < cols.length ? 6 : 0;
  L.barH = Math.max(14, Math.min(26, Math.floor((L.chart.h - gapB) / Math.max(1, cols.length))));
  L.bars = cols.map((r, i) => ({ y: L.chart.y + i * L.barH + (i >= nMine ? gapB : 0) }));
  // the page words, top left
  let tx = x;
  L.tabs = ['STATS', 'GRAPHS'].map((label) => { const r = { label, x: tx, y: L.tabsY, w: pixelTextWidth(label), h: 7 }; tx += r.w + 14; return r; });
  // BACK and LOBBY: 2x words side by side at the foot
  const ws = ['BACK', 'LOBBY'].map((l) => pixelTextWidth(l, MENU_TXT_SCALE) + 8);
  const wgap = 24, total = ws[0] + wgap + ws[1];
  L.words = ['BACK', 'LOBBY'].map((label, i) => ({
    label, x: Math.round((VIEW_W - total) / 2) + (i ? ws[0] + wgap : 0), y: L.wordY - 2, w: ws[i], h: 7 * MENU_TXT_SCALE + 4,
  }));
  return L;
}
// the stats laid out down the scrolled window: each group's heading and each
// open row with its y, and what a click on it does
function scoreLines(L) {
  const out = [];
  let y = L.body.y - Math.round(scores.scroll);
  for (const g of SCORE_GROUPS) {
    out.push({ kind: 'group', g, y });
    y += SCORE_HEAD;
    if (!scores.shut[g.head]) for (let i = 0; i < g.rows.length; i++) { out.push({ kind: 'row', row: g.rows[i], i, y }); y += SCORE_ROW; }
    y += 2;
  }
  return out;
}
function scoresScrollBy(d) {
  const L = scoresLayout();
  scores.scroll = Math.max(0, Math.min(L.maxScroll, scores.scroll + d));
}

// ------------------------------------------------------------ the way in
// LOBBY off either ending lands here rather than leaving (deadActivate,
// js/ui/screens.js). `from` is the view BACK hands the screen back to.
function openScores(from) {
  if (!matchStats) statFreeze(); // a driver that opened the screen without an ending
  scores.from = from;
  scores.t = 0;
  scores.sel = 2;
  scores.scroll = 0;
  state.deadView = 'scores';
}

function scoresBack() {
  state.deadView = scores.from;
  SFX.pickup();
}

// what the pointer is on: a page word, a stat in the GRAPHS list, a group heading,
// a row, a way out, or nothing. The screen has to have arrived first - a
// control that is still fading in is not a control yet.
function scoresHit() {
  if (scores.t < SCORE_IN) return null;
  const L = scoresLayout();
  const inR = (r, pad) => mouse.x >= r.x - (pad || 0) && mouse.x < r.x + r.w + (pad || 0)
    && mouse.y >= r.y - (pad || 0) && mouse.y < r.y + r.h + (pad || 0);
  for (let i = 0; i < L.tabs.length; i++) if (inR(L.tabs[i], 3)) return { kind: 'page', i };
  for (let i = 0; i < L.words.length; i++) if (inR(L.words[i], 2)) return { kind: 'word', i };
  if (scores.page === 1) {
    if (!inR(L.list)) return null;
    for (const e of L.list.rows) {
      const y = L.list.y + e.y - L.list.off;
      if (e.row && mouse.y >= y && mouse.y < y + SCORE_LIST_ROW) return { kind: 'stat', i: e.i };
    }
    return null;
  }
  if (!inR(L.body)) return null;
  for (const ln of scoreLines(L)) {
    const h = ln.kind === 'group' ? SCORE_HEAD - 1 : SCORE_ROW;
    if (mouse.y >= ln.y && mouse.y < ln.y + h) return ln.kind === 'group' ? { kind: 'group', head: ln.g.head } : { kind: 'row', label: ln.row.label };
  }
  return null;
}

function scoresActivate(i) {
  const w = SCORE_WORDS[i];
  if (w === 'STATS' || w === 'GRAPHS') { const pg = w === 'STATS' ? 0 : 1; if (scores.page !== pg) { scores.page = pg; SFX.pickup(); } return; }
  SFX.place();
  if (w === 'BACK') scoresBack();
  else toLobby();
}

function scoresKey(k) {
  // the arrival is skippable, the way both ceremonies are
  if (scores.t < SCORE_IN) { scores.t = SCORE_IN; return; }
  if (k === 'escape' || k === 'backspace') { scoresBack(); return; }
  const d = moveDir(k);
  if (d === 'left') { scores.sel = (scores.sel + SCORE_WORDS.length - 1) % SCORE_WORDS.length; SFX.pickup(); }
  else if (d === 'right') { scores.sel = (scores.sel + 1) % SCORE_WORDS.length; SFX.pickup(); }
  // up/down is the page's own: the stats scroll, the graphs walk the stat list
  else if (d === 'up' || d === 'down') {
    if (scores.page === 1) { scores.stat = (scores.stat + (d === 'down' ? 1 : SCORE_STATS.length - 1)) % SCORE_STATS.length; SFX.pickup(); }
    else scoresScrollBy(d === 'down' ? SCORE_ROW * 3 : -SCORE_ROW * 3);
  } else if (k === 'enter' || k === ' ') scoresActivate(scores.sel);
}

function scoresClick() {
  if (scores.t < SCORE_IN) { scores.t = SCORE_IN; return; }
  const h = scoresHit();
  if (!h) return;
  if (h.kind === 'page') { scores.sel = h.i; scoresActivate(h.i); }
  else if (h.kind === 'stat') { if (scores.stat !== h.i) { scores.stat = h.i; SFX.pickup(); } }
  else if (h.kind === 'group') {
    scores.shut[h.head] = !scores.shut[h.head];
    scoresScrollBy(0); // a fold can leave the window scrolled past its new end
    SFX.pickup();
  } else if (h.kind === 'word') { scores.sel = 2 + h.i; scoresActivate(2 + h.i); }
}

// ------------------------------------------------------------ the pixels
// Graphite, the HUD's own (js/ui/strip.js): a neutral dark page, one step
// lighter for a heading, the numbers pale and yours gold.
const SC_INK = '#07080a', SC_BG = '#0d0e11', SC_PLATE = '#16181c', SC_EDGE = '#2f3238';
const SC_ROW_A = '#121317', SC_ROW_B = '#0f1013', SC_YOU = '#1e2127', SC_HOT = '#23262c';
const SC_DIM = '#6c717a', SC_LBL = '#a3a8b0', SC_TXT = '#d4d7dc', SC_LIT = '#f4f7ff', SC_GOLD = '#f2cc6a';

// a page word: dim, pale under the pointer, white with a gold hairline under
// the word alone when it is the open page (drawNavCell's grammar, js/ui/panels.js)
function scoreWord(r, on, hot) {
  drawPixelText(ctx, r.label, r.x, r.y, on ? SC_LIT : hot ? SC_TXT : SC_DIM, 1);
  if (on) { ctx.fillStyle = SC_GOLD; ctx.fillRect(r.x, r.y + 7, r.w, 1); }
}

// One player's face over their column: the HUD portrait's square (drawPortrait,
// js/ui/hud-draw.js) small, a gold rim on yours, the side's colour as a line
// under it and the level on its corner.
function drawScoreFace(x, y, s, r) {
  const q = players[r.id];
  ctx.fillStyle = SC_INK; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = r.you ? '#c89a3c' : SC_EDGE; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.fillStyle = PORT_SKY; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
  const half = (s - 4) >> 1;
  ctx.fillStyle = PORT_GROUND; ctx.fillRect(x + 2, y + 2 + half + 3, s - 4, s - 4 - half - 3);
  if (q) {
    const spr = portraitSprite(q), k = 2;
    ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, s - 4, s - 4); ctx.clip();
    ctx.drawImage(spr, x + 2 + ((s - 4 - spr.width * k) >> 1), y + 2 + half - 14, spr.width * k, spr.height * k);
    ctx.restore();
  }
  ctx.fillStyle = TEAMS[skin(r.team)].mark; ctx.fillRect(x, y + s + 1, s, 1);
  const lv = String(r.level), bw = pixelTextWidth(lv) + 4;
  const lx = x + s - bw + 2, ly = y + s - 6;
  ctx.fillStyle = SC_INK; ctx.fillRect(lx, ly, bw, 8);
  ctx.fillStyle = SC_PLATE; ctx.fillRect(lx + 1, ly + 1, bw - 2, 6);
  drawPixelText(ctx, lv, lx + 2, ly + 2, r.you ? SC_GOLD : SC_LIT, 1);
}

function renderScores(now) {
  const dt = Math.min(0.05, now - (scores.last || now));
  scores.last = now;
  scores.t += dt;
  const L = scoresLayout();
  if (scores.scroll > L.maxScroll) scores.scroll = L.maxScroll;
  const ac = scoreAccent();
  const arrive = Math.min(1, scores.t / SCORE_IN);
  const hit = scoresHit();

  // OPAQUE once it has arrived: the ceremony's stage, and the match still
  // playing under that, are put away entirely. A page that lets the pines
  // show through reads as a pause menu, which is the wrong promise.
  ctx.fillStyle = arrive < 1 ? 'rgba(13,14,17,' + (0.95 * arrive).toFixed(3) + ')' : SC_BG;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const fade = arrive < 1 ? arrive : 1;
  ctx.globalAlpha = fade;

  // --- the head: the result, how long it took, and the two pages --------
  drawPixelTextShadow(ctx, scoreHead(), L.x, L.headY, ac.txt, SC_INK, 2);
  const clock = clockTxt(matchStats ? matchStats.time : state.elapsed);
  drawPixelTextShadow(ctx, clock, L.x + L.w - pixelTextWidth(clock, 2), L.headY, SC_TXT, SC_INK, 2);
  for (let i = 0; i < L.tabs.length; i++) {
    const hot = (hit && hit.kind === 'page' && hit.i === i) || scores.sel === i;
    scoreWord(L.tabs[i], scores.page === i, hot);
  }
  ctx.fillStyle = SC_EDGE;
  ctx.fillRect(L.x, L.ruleY, Math.round(L.w * arrive), 1);

  if (scores.page === 0) drawScoreStats(L, hit, fade);
  else drawScoreBars(L, hit, fade);

  // --- the ways out: bare words, white, gold under the pointer or the keys
  for (let i = 0; i < L.words.length; i++) {
    const w = L.words[i];
    const hot = hit && hit.kind === 'word' ? hit.i === i : scores.sel === 2 + i;
    drawPixelTextOutline(ctx, w.label, w.x + 4, w.y + 2, hot ? '#ffd95c' : SC_LIT, 'rgba(8,12,28,0.9)', MENU_TXT_SCALE);
  }
  ctx.globalAlpha = 1;
}

// the STATS page: the faces, then the groups in their scrolled window
function drawScoreStats(L, hit, fade) {
  const cols = L.cols;
  const youI = cols.findIndex((r) => r.you);
  // the columns arrive a beat apart, left to right, so the eye is walked
  // along the faces the way the old rows walked it down the blocks
  const colA = (i) => Math.max(0, Math.min(1, (scores.t - SCORE_IN - i * 0.03) / 0.18));
  for (let i = 0; i < cols.length; i++) {
    const a = colA(i);
    if (a <= 0) continue;
    ctx.globalAlpha = fade * a;
    drawScoreFace(L.colX[i] + ((L.colW - L.face) >> 1), L.faceY, L.face, cols[i]);
    // the name, whole: the columns take turns between two lines, so each one
    // is centred on its own column with two columns' width to print in
    const nm = scoreName(cols[i].name, L.colW * 2 - 4), cx = L.colX[i] + (L.colW >> 1);
    drawPixelText(ctx, nm, Math.round(cx - pixelTextWidth(nm) / 2), L.nameY + (i & 1) * SCORE_NAME, cols[i].you ? SC_GOLD : SC_TXT, 1);
  }
  ctx.globalAlpha = fade;
  const b = L.body;
  ctx.save();
  ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
  for (const ln of scoreLines(L)) {
    if (ln.y + SCORE_HEAD < b.y || ln.y > b.y + b.h) continue;
    const y = ln.y;
    if (ln.kind === 'group') {
      const shut = !!scores.shut[ln.g.head];
      const hot = hit && hit.kind === 'group' && hit.head === ln.g.head;
      ctx.fillStyle = hot ? SC_HOT : SC_PLATE; ctx.fillRect(L.x, y, L.w, SCORE_HEAD - 1);
      ctx.fillStyle = SC_EDGE; ctx.fillRect(L.x, y, L.w, 1);
      // the fold's chevron: down while open, right while shut
      ctx.fillStyle = hot ? SC_TXT : SC_DIM;
      if (shut) { ctx.fillRect(L.x + 3, y + 3, 1, 5); ctx.fillRect(L.x + 4, y + 4, 1, 3); ctx.fillRect(L.x + 5, y + 5, 1, 1); }
      else { ctx.fillRect(L.x + 2, y + 4, 5, 1); ctx.fillRect(L.x + 3, y + 5, 3, 1); ctx.fillRect(L.x + 4, y + 6, 1, 1); }
      drawPixelText(ctx, ln.g.head, L.x + 10, y + 3, hot ? SC_LIT : SC_LBL, 1);
      continue;
    }
    const row = ln.row;
    const hot = hit && hit.kind === 'row' && hit.label === row.label;
    ctx.fillStyle = ln.i & 1 ? SC_ROW_B : SC_ROW_A; ctx.fillRect(L.x, y, L.w, SCORE_ROW);
    if (youI >= 0) { ctx.fillStyle = SC_YOU; ctx.fillRect(L.colX[youI], y, L.colW, SCORE_ROW); }
    if (hot) { ctx.fillStyle = SC_HOT; ctx.fillRect(L.x, y, L.w, SCORE_ROW); ctx.fillStyle = SC_GOLD; ctx.fillRect(L.x, y, 1, SCORE_ROW); }
    drawPixelText(ctx, row.label, L.x + 10, y + 3, hot ? SC_LIT : SC_LBL, 1);
    let best = 0;
    if (row.best !== false) for (const r of cols) best = Math.max(best, scoreVal(r, row));
    for (let i = 0; i < cols.length; i++) {
      const a = colA(i);
      if (a <= 0) continue;
      ctx.globalAlpha = fade * a;
      const r = cols[i], v = row.txt ? row.txt(r) : scoreFmt(scoreVal(r, row));
      const vw = pixelTextWidth(v), vx = L.colX[i] + ((L.colW - vw) >> 1);
      // the biggest in the row, anywhere in the match: underlined in its side's colour
      if (best > 0 && scoreVal(r, row) === best) { ctx.fillStyle = TEAMS[skin(r.team)].mark; ctx.fillRect(vx - 1, y + 8, vw + 2, 1); }
      drawPixelText(ctx, v, vx, y + 2, r.you ? SC_GOLD : hot ? SC_LIT : SC_TXT, 1);
    }
    ctx.globalAlpha = fade;
  }
  ctx.restore();
  // more below, or above: a fade off the window's edge says the page goes on
  if (L.maxScroll > 0) {
    ctx.fillStyle = SC_BG;
    for (let k = 0; k < 4; k++) {
      ctx.globalAlpha = fade * (0.8 - k * 0.2);
      if (scores.scroll < L.maxScroll) ctx.fillRect(b.x, b.y + b.h - 1 - k, b.w, 1);
      if (scores.scroll > 0) ctx.fillRect(b.x, b.y + k, b.w, 1);
    }
    ctx.globalAlpha = fade;
  }
}

// The GRAPHS page, League's: a list of every stat down the left, the picked
// one gold-marked, and that stat as a bar chart - one horizontal bar a
// player, each in its side's colour, the face and the name at its head and
// the number at its end, over a scale of round steps. A bar is that player's
// share of the biggest value in the match, so the longest bar is the leader
// and an empty row is a zero. The pointer on a row of the list charts it; so
// do up/down.
function scoreStep(hi) {
  const raw = Math.max(1, hi / 4), p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}
function drawScoreBars(L, hit, fade) {
  const cols = L.cols, li = L.list, row = SCORE_STATS[scores.stat];
  // --- the list ----------------------------------------------------------
  ctx.save();
  ctx.beginPath(); ctx.rect(li.x, li.y, li.w, li.h); ctx.clip();
  for (const e of li.rows) {
    const y = li.y + e.y - li.off;
    if (y + SCORE_HEAD < li.y || y > li.y + li.h) continue;
    if (e.head) { drawPixelText(ctx, e.head, li.x, y + 2, SC_DIM, 1); continue; }
    const on = e.i === scores.stat, hot = hit && hit.kind === 'stat' && hit.i === e.i;
    if (on || hot) { ctx.fillStyle = SC_HOT; ctx.fillRect(li.x, y, li.w, SCORE_LIST_ROW); }
    if (on) { ctx.fillStyle = SC_GOLD; ctx.fillRect(li.x, y, 1, SCORE_LIST_ROW); }
    drawPixelText(ctx, e.row.label, li.x + 6, y + 2, on ? SC_LIT : hot ? SC_TXT : SC_LBL, 1);
  }
  ctx.restore();
  ctx.fillStyle = SC_EDGE; ctx.fillRect(li.x + li.w + 4, li.y, 1, li.h);
  // --- the chart ---------------------------------------------------------
  const c = L.chart;
  const title = SCORE_GROUPS.find((g) => g.rows.includes(row)).head + ' - ' + row.label;
  drawPixelText(ctx, title, c.x + ((c.w - pixelTextWidth(title)) >> 1), c.y - 10, SC_LIT, 1);
  let hi = 0;
  for (const r of cols) hi = Math.max(hi, scoreVal(r, row));
  const step = scoreStep(hi), top = Math.max(step, Math.ceil(hi / step) * step);
  // the bars start past the face; the name rides over its bar, or - on a view
  // too short for two lines a row - beside the face, ahead of the bar
  const face = Math.min(20, L.barH - 2), nh = L.barH >= 20 ? 8 : 0;
  const nameW = nh ? 0 : 16 * 4 + 2;
  const bx = c.x + face + 4 + nameW, bw = c.x + c.w - 30 - bx;
  const bottom = L.bars.length ? L.bars[L.bars.length - 1].y + L.barH : c.y;
  // the scale: faint uprights at each round step, their values under the chart
  for (let v = 0; v <= top + 0.5; v += step) {
    const gx = bx + Math.round(v / top * bw);
    ctx.fillStyle = SC_ROW_A; ctx.fillRect(gx, c.y - 1, 1, bottom - c.y + 2);
    const t = shortNum(v);
    drawPixelText(ctx, t, gx - (pixelTextWidth(t) >> 1), bottom + 3, SC_DIM, 1);
  }
  const colA = (i) => Math.max(0, Math.min(1, (scores.t - SCORE_IN - i * 0.03) / 0.18));
  for (let i = 0; i < cols.length; i++) {
    const r = cols[i], y = L.bars[i].y, a = colA(i);
    if (a <= 0) continue;
    ctx.globalAlpha = fade * a;
    drawScoreFace(c.x, y + ((L.barH - face) >> 1) - 1, face, r);
    // the name over the bar, the bar under it, the number at its end
    const nc = r.you ? SC_GOLD : SC_TXT;
    if (nh) drawPixelText(ctx, scoreName(r.name, bw), bx, y + 1, nc, 1);
    else drawPixelText(ctx, scoreName(r.name, nameW - 2), c.x + face + 4, y + ((L.barH - 5) >> 1), nc, 1);
    const v = scoreVal(r, row), len = Math.round(bw * Math.max(0, v) / top * a);
    const bh = L.barH - nh - 4, by = y + nh + 1;
    ctx.fillStyle = TEAMS[skin(r.team)].mark;
    if (len > 0) ctx.fillRect(bx, by, len, bh);
    if (r.you && len > 0) { ctx.fillStyle = SC_GOLD; ctx.fillRect(bx, by + bh - 1, len, 1); }
    const t = row.txt ? row.txt(r) : scoreFmt(v);
    drawPixelText(ctx, t, bx + len + 4, by + ((bh - 5) >> 1), r.you ? SC_GOLD : SC_LIT, 1);
  }
  ctx.globalAlpha = fade;
}
