// The POST-GAME LOBBY: the match's own record, read after it is over.
//
// The victory and defeat screens are a CEREMONY - one side, one headline,
// four numbers about you. They answer "what happened to me". This answers
// "what happened", which is a different question and wants a different
// screen: League's post-game page - every player who flew in a column, both
// sides, the numbers a match is argued about afterwards in folding groups,
// and a page of graphs of how the two sides pulled apart. LOBBY off either ending lands here first, and this
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
      streak: q.bestStreak, multi: q.bestMulti, cc: Math.round(q.ccOut),
      dmg: q.dmgOut, bird: q.dmgBird, struct: q.dmgStruct, beast: Math.round(q.dmgBeast),
      inP: q.dmgInP, inB: q.dmgInB, healed: Math.round(q.healed),
      gold: q.xp, spent: q.goldSpent, beasts: q.beasts,
      hGold: q.hGold.slice(), hDmg: q.hDmg.slice(),
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
const SCORE_ROW = 10;     // px per stat row
const SCORE_HEAD = 11;    // px per group heading, and the 2 under a group
// a number in a column: whole up to 99999, past that its magnitude (shortNum,
// js/core.js: 100K, 2.4M, 1B) so no column ever outgrows its width
function scoreFmt(n) {
  n = Math.round(n || 0);
  return n >= 100000 ? shortNum(n) : String(n);
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
  tab: 0,        // which graph: 0 gold, 1 damage
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
  // still fits at the floor's width (320, fitCanvas js/canvas.js)
  const colW = Math.max(20, Math.min(SCORE_COL_W, Math.floor((VIEW_W - 8 - SCORE_LABEL_W - gap) / Math.max(1, cols.length))));
  const face = Math.min(SCORE_FACE, colW - 2);
  const w = SCORE_LABEL_W + cols.length * colW + gap;
  const x = Math.round((VIEW_W - w) / 2);
  const L = { x, w, cols, colW, face, headY: 10, tabsY: 30, ruleY: 40, faceY: 46 };
  L.colX = cols.map((r, i) => x + SCORE_LABEL_W + i * colW + (i >= nMine ? gap : 0));
  L.wordY = VIEW_H - 24;
  L.body = { x, y: L.faceY + face + 6, w, h: 0 };
  L.body.h = Math.max(20, L.wordY - 8 - L.body.y);
  // the stats' own height, every open group at full length
  let h = 0;
  for (const g of SCORE_GROUPS) h += SCORE_HEAD + (scores.shut[g.head] ? 0 : g.rows.length * SCORE_ROW) + 2;
  L.contentH = h;
  L.maxScroll = Math.max(0, h - L.body.h);
  L.graph = { x, y: L.tabsY + 22, w, h: Math.max(40, L.wordY - 12 - (L.tabsY + 22)) };
  // the page words, top left, and the graph's two under the rule on its page
  let tx = x;
  L.tabs = ['STATS', 'GRAPHS'].map((label) => { const r = { label, x: tx, y: L.tabsY, w: pixelTextWidth(label), h: 7 }; tx += r.w + 14; return r; });
  tx = x;
  L.gtabs = ['GOLD', 'DAMAGE'].map((label) => { const r = { label, x: tx, y: L.ruleY + 4, w: pixelTextWidth(label), h: 7 }; tx += r.w + 12; return r; });
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

// what the pointer is on: a page word, a graph word, a group heading, a row,
// a face, a way out, or nothing. The screen has to have arrived first - a
// control that is still fading in is not a control yet.
function scoresHit() {
  if (scores.t < SCORE_IN) return null;
  const L = scoresLayout();
  const inR = (r, pad) => mouse.x >= r.x - (pad || 0) && mouse.x < r.x + r.w + (pad || 0)
    && mouse.y >= r.y - (pad || 0) && mouse.y < r.y + r.h + (pad || 0);
  for (let i = 0; i < L.tabs.length; i++) if (inR(L.tabs[i], 3)) return { kind: 'page', i };
  for (let i = 0; i < L.words.length; i++) if (inR(L.words[i], 2)) return { kind: 'word', i };
  if (scores.page === 1) {
    for (let i = 0; i < L.gtabs.length; i++) if (inR(L.gtabs[i], 3)) return { kind: 'tab', i };
    return null;
  }
  for (let i = 0; i < L.cols.length; i++) {
    if (inR({ x: L.colX[i] + ((L.colW - L.face) >> 1), y: L.faceY, w: L.face, h: L.face })) return { kind: 'face', i };
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
  // up/down is the page's own: the stats scroll, the graphs swap their line
  else if (d === 'up' || d === 'down') {
    if (scores.page === 1) { scores.tab = 1 - scores.tab; SFX.pickup(); }
    else scoresScrollBy(d === 'down' ? SCORE_ROW * 3 : -SCORE_ROW * 3);
  } else if (k === 'enter' || k === ' ') scoresActivate(scores.sel);
}

function scoresClick() {
  if (scores.t < SCORE_IN) { scores.t = SCORE_IN; return; }
  const h = scoresHit();
  if (!h) return;
  if (h.kind === 'page') { scores.sel = h.i; scoresActivate(h.i); }
  else if (h.kind === 'tab') { if (scores.tab !== h.i) { scores.tab = h.i; SFX.pickup(); } }
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
const SC_WELL = '#101114', SC_RULE = SC_EDGE;

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
  else {
    for (let i = 0; i < L.gtabs.length; i++) scoreWord(L.gtabs[i], scores.tab === i, hit && hit.kind === 'tab' && hit.i === i);
    drawScoreGraph(L.graph, ac);
  }

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
  // a face under the pointer names its player, on a plate over the column
  if (hit && hit.kind === 'face') {
    const r = cols[hit.i], nm = r.name || '';
    const nw = pixelTextWidth(nm) + 6, cx = L.colX[hit.i] + (L.colW >> 1);
    const nx = Math.max(2, Math.min(VIEW_W - nw - 2, Math.round(cx - nw / 2))), ny = L.faceY + L.face + 4;
    ctx.fillStyle = SC_INK; ctx.fillRect(nx - 1, ny - 1, nw + 2, 11);
    ctx.fillStyle = SC_PLATE; ctx.fillRect(nx, ny, nw, 9);
    drawPixelText(ctx, nm, nx + 3, ny + 2, r.you ? SC_GOLD : SC_LIT, 1);
  }
}

// The graph: one cumulative line per side, summed over its players, in the
// side's own colour, with the LEAD shaded between the two. A chart with no
// scale is a squiggle (the merchant's own rule, js/ui/shop.js), so the top of
// the well prints the biggest value it reaches; the match clock is in the
// head and printed once. The dotted uprights are the match's days.
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
  ctx.fillStyle = SC_EDGE;
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
    // (a cross for the rival's under a colour-blind palette, as on the minimap)
    drawMapUnit(ctx, lx, ly, col, SC_LIT, 1, true, foeCue(s.t));
  }
  // the scale, and nothing else: the match clock is already in the head, and
  // a fact printed twice is a fact that drifts in one of the two places
  drawPixelTextShadow(ctx, String(hi), r.x + 3, r.y + 3, ac.txt, SC_WELL, 1);
}
