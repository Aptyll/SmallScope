'use strict';
// The ladder's page: one static HTML file written beside the ladder's data
// (ladder.html), its numbers inlined, so it opens straight off the disk with
// no server - the standings, one bot's card, who beats whom, and every match
// with its log. Same look as the bot lab (botlab.html), which opens any of
// the logs listed here. The same numbers are written as standings.json for
// scripts and agents, and ride in the page as a JSON block (#ladder-data).

const fs = require('fs');
const path = require('path');
const core = require('./core');

// what each column means: every header's hover, and glossary in the page's JSON
const GLOSSARY = [
  ['RATING', 'Elo score. Everyone starts at 1000. Beating a higher-rated bot gains more.'],
  ['TREND', 'Rating after each of its matches, oldest to newest.'],
  ['LAST 5', 'Its last five results, newest on the right.'],
  ['RECORD', 'Wins (green), draws (grey), losses (red). A draw is a match that ran out of time.'],
  ['WIN%', 'Share of points: a win is 1, a draw a half.'],
  ['FUN', 'Mean fun score of its matches, 0 to 100: close, swingy, busy, full of fights.'],
  ['MIN', 'Mean length in minutes of its matches that ended with a bird driven off.'],
  ['K/D', 'Kills per death for its side, over all its matches.'],
  ['ERRORS', 'Times its code threw. A seat whose bot throws stands still for that think.'],
];
const TIP = Object.fromEntries(GLOSSARY);

const HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Softfall bot ladder: standings, ratings and every match between bot files.">
<title>Softfall Bot Ladder</title>
<!--
  For scripts and agents: every number on this page is in the JSON block
  #ladder-data below (and in standings.json beside this file):
    rows[]     one per bot, best first: id, name, author, version, rev, rating, peak, delta,
               games, w, l, d, winPct, fun, avgMin, kd, errors, thinks, trail[], form[], vs{ id: {w,l,d} }, retired
    history[]  one per match, oldest first: id, date (ISO, UTC), seed, shape, shapeName,
               team0/team1 { id, before, after, stats{kills,deaths,dmg,siege,gold,bird,errors,thinks} },
               winner (bot id or null), reason ('eagle' | 'timeout' | 'error'), time (s), fun, rated, log
    glossary[] [column, meaning]  (each column header's hover)
  The files: docs/bots/ladder.md. Each match's full log: the path in history[].log.
-->
<style>
  :root { --bg: #0b0f16; --panel: #121822; --edge: #2c3544; --edge-hi: #5b6678; --ink: #d6dde8; --dim: #8b94a7;
    --faint: #262f3f; --sel: #1b2230; --win: #7bd88f; --loss: #ff8a5c; --draw: #5b6678; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink);
    font: 12px/1.45 ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace; }
  header { display: flex; align-items: center; gap: 14px; padding: 8px 16px; border-bottom: 1px solid var(--edge); flex-wrap: wrap; }
  header h1 { font-size: 13px; letter-spacing: 2px; margin: 0; font-weight: 600; }
  .sp { flex: 1; }
  .muted { color: var(--dim); }
  .legend { display: flex; gap: 14px; align-items: center; color: var(--dim); flex-wrap: wrap; }
  .legend span { display: inline-flex; gap: 5px; align-items: center; }
  main { display: grid; gap: 12px; padding: 12px 16px 24px; grid-template-columns: minmax(0, 1.5fr) minmax(260px, 1fr); }
  @media (max-width: 960px) { main { grid-template-columns: minmax(0, 1fr); } }
  .box { border: 1px solid var(--edge); background: var(--panel); min-width: 0; }
  .box > h2 { margin: 0; font-size: 12px; font-weight: normal; letter-spacing: 1px; padding: 6px 10px; border-bottom: 1px solid var(--edge);
    display: flex; gap: 10px; align-items: center; }
  .box > .bd { overflow: auto; }
  .wide { grid-column: 1 / -1; }
  .scroll { max-height: 60vh; }
  table { border-collapse: collapse; width: 100%; }
  caption { position: absolute; left: -9999px; }
  th { color: var(--dim); font-weight: normal; text-align: left; position: sticky; top: 0; background: var(--panel); }
  th[title] { cursor: help; }
  th, td { padding: 5px 8px; white-space: nowrap; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  td.c, th.c { text-align: center; }
  tbody tr:hover td { background: #161d29; }
  #board tbody tr { cursor: pointer; }
  #board tbody tr:focus-visible { outline: 1px solid var(--ink); outline-offset: -1px; }
  tr.pick td { background: var(--sel); }
  tr.pick td:first-child { box-shadow: inset 2px 0 0 var(--ink); }
  .w { color: var(--win); } .l { color: var(--loss); } .d { color: var(--dim); }
  .retired { opacity: 0.4; }
  /* the visual vocabulary: a rating bar, a record bar, a meter, result chips */
  .rbar { display: inline-flex; align-items: center; gap: 8px; }
  .rbar i { display: block; height: 6px; background: var(--edge-hi); }
  .rbar b { font-weight: 600; min-width: 34px; text-align: right; }
  .rec { display: flex; width: 90px; height: 8px; background: var(--faint); }
  .rec i { display: block; height: 8px; }
  .meter { display: inline-block; width: 44px; height: 6px; background: var(--faint); vertical-align: middle; }
  .meter i { display: block; height: 6px; background: #7aa2f7; }
  .chip { display: inline-block; width: 14px; height: 14px; line-height: 12px; text-align: center; font-size: 10px; font-weight: 600; border: 1px solid currentColor; }
  .chip.w { background: rgba(123,216,143,0.15); } .chip.l { background: rgba(255,138,92,0.15); }
  .form { display: inline-flex; gap: 2px; }
  .err { color: var(--loss); font-weight: 600; }
  svg.spark { display: block; }
  .grid td.c { min-width: 46px; height: 26px; font-variant-numeric: tabular-nums; }
  .grid td.self { background: var(--faint); }
  table.grid { width: auto; }
  a { color: var(--dim); } a:hover { color: var(--ink); }
  .card { padding: 12px; display: grid; gap: 12px; }
  .card .name { font-size: 16px; letter-spacing: 1px; }
  .big { display: flex; align-items: baseline; gap: 10px; }
  .big b { font-size: 28px; font-weight: 600; }
  .vs { display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; align-items: center; }
  .vsbar { display: flex; height: 8px; background: var(--faint); max-width: 160px; }
  .vsbar i { display: block; height: 8px; }
  pre { margin: 0; padding: 8px 12px; background: var(--bg); border: 1px solid var(--edge); overflow: auto; }
  .empty { padding: 16px 12px; display: grid; gap: 8px; justify-items: start; }
  .vsep { color: var(--dim); padding: 0 2px; }
  button { font: inherit; color: var(--ink); background: var(--faint); border: 1px solid var(--edge-hi); padding: 0 8px; cursor: pointer; }
  button:hover { border-color: var(--ink); }
</style>
</head>
<body>
<header>
  <h1>SOFTFALL BOT LADDER</h1>
  <span class="muted" id="meta"></span>
  <span class="sp"></span>
  <span class="legend" aria-label="legend">
    <span><b class="chip w">W</b><b class="chip d">D</b><b class="chip l">L</b></span>
    <span><span class="rec" style="width:42px"><i style="width:50%;background:var(--win)"></i><i style="width:20%;background:var(--draw)"></i><i style="width:30%;background:var(--loss)"></i></span>record</span>
    <span><span class="meter"><i style="width:70%"></i></span>fun</span>
    <span class="muted">hover anything for detail</span>
  </span>
</header>
<main>
  <section class="box">
    <h2>STANDINGS</h2>
    <div class="bd"><table id="board"><caption>Standings, best first</caption><thead><tr>
      <th class="n">#</th><th>BOT</th><th data-tip="RATING">RATING</th><th data-tip="TREND">TREND</th><th data-tip="LAST 5">LAST 5</th>
      <th data-tip="RECORD">RECORD</th><th data-tip="FUN">FUN</th></tr></thead><tbody></tbody></table></div>
  </section>
  <section class="box" aria-live="polite">
    <h2>BOT</h2>
    <div class="card" id="card"></div>
  </section>
  <section class="box wide">
    <h2>WHO BEATS WHOM</h2>
    <div class="bd"><table class="grid" id="h2h"><caption>Head to head</caption></table></div>
  </section>
  <section class="box wide">
    <h2>MATCHES <span class="muted" id="filter"></span><button id="all" hidden>ALL</button></h2>
    <div class="bd scroll"><table id="matches"><caption>Every match, newest first</caption><tbody></tbody></table></div>
  </section>
</main>
<script type="application/json" id="ladder-data">/*DATA*/</script>
<script>
const DATA = JSON.parse(document.getElementById('ladder-data').textContent);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TIP = Object.fromEntries(DATA.glossary);
const byId = Object.fromEntries(DATA.rows.map((r) => [r.id, r]));
const nameOf = (id) => (byId[id] ? byId[id].name : id);
const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const signed = (v) => (v == null ? '' : (v > 0 ? '+' : '') + (Math.round(v * 10) / 10));
const tone = (v) => (v > 0 ? 'w' : v < 0 ? 'l' : 'd');
const ratings = DATA.rows.map((r) => r.rating), rLo = Math.min(DATA.start, ...ratings) - 20, rHi = Math.max(DATA.start, ...ratings) + 20;
let pick = DATA.rows.length ? DATA.rows[0].id : null, filtered = false;

const chip = (x) => '<b class="chip ' + x.toLowerCase() + '">' + x + '</b>';
const rbar = (r) => '<span class="rbar" title="rating ' + r.rating + (r.delta != null ? ', last match ' + signed(r.delta) : '') + '"><b>' + Math.round(r.rating) + '</b><i style="width:' + Math.round(8 + 72 * (r.rating - rLo) / (rHi - rLo)) + 'px"></i></span>';
function rec(w, l, d, width) {
  const n = w + l + d;
  if (!n) return '<span class="muted">-</span>';
  const seg = (k, c) => (k ? '<i style="width:' + (100 * k / n) + '%;background:var(--' + c + ')"></i>' : '');
  return '<span class="rec" style="' + (width ? 'width:' + width + 'px' : '') + '" title="' + w + ' won, ' + d + ' drawn, ' + l + ' lost">' + seg(w, 'win') + seg(d, 'draw') + seg(l, 'loss') + '</span>';
}
const meter = (v) => (v == null ? '<span class="muted">-</span>' : '<span class="meter" title="fun ' + v + ' / 100"><i style="width:' + v + '%"></i></span>');
function spark(r, W, H) {
  const pts = [DATA.start].concat(r.trail);
  if (pts.length < 2) return '<span class="muted">-</span>';
  W = W || 72; H = H || 16;
  const lo = Math.min(...pts), hi = Math.max(...pts), k = (hi - lo) || 1;
  const d = pts.map((v, i) => (i ? 'L' : 'M') + (i * W / (pts.length - 1)).toFixed(1) + ' ' + (H - 2 - (v - lo) / k * (H - 4)).toFixed(1)).join(' ');
  const up = pts[pts.length - 1] >= pts[0];
  return '<svg class="spark" width="' + W + '" height="' + H + '" role="img" aria-label="rating ' + pts[0] + ' to ' + Math.round(pts[pts.length - 1]) + '"><path d="' + d + '" fill="none" stroke="' + (up ? 'var(--win)' : 'var(--loss)') + '" stroke-width="1.4"/></svg>';
}
const form = (f) => (f.length ? '<span class="form" title="last results, newest on the right">' + f.map(chip).join('') + '</span>' : '<span class="muted">-</span>');
const errs = (r) => (r.errors ? ' <span class="err" title="its code threw ' + r.errors + ' times in ' + r.thinks + ' thinks">!</span>' : '');

function board() {
  $('#board tbody').innerHTML = DATA.rows.map((r, i) =>
    '<tr tabindex="0" data-id="' + esc(r.id) + '" data-rating="' + r.rating + '" class="' + (r.retired ? 'retired ' : '') + (pick === r.id ? 'pick' : '') + '">' +
    '<td class="n muted">' + (r.retired ? '' : i + 1) + '</td>' +
    '<td title="' + esc(r.id + '.js' + (r.author ? ' by ' + r.author : '')) + '">' + esc(r.name) + errs(r) + '</td>' +
    '<td>' + rbar(r) + '</td><td>' + spark(r) + '</td><td>' + form(r.form) + '</td>' +
    '<td>' + rec(r.w, r.l, r.d) + '</td><td>' + meter(r.fun) + '</td></tr>').join('');
  for (const tr of document.querySelectorAll('#board tbody tr')) {
    const go = () => { pick = tr.dataset.id; filtered = true; render(); };
    tr.onclick = go;
    tr.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  }
}
function card() {
  const r = byId[pick];
  if (!r) { $('#card').innerHTML = '<span class="muted">No bots yet.</span>'; return; }
  const opp = Object.entries(r.vs).map(([id, v]) => ({ id, v, s: (v.w + v.d / 2) / (v.w + v.l + v.d) })).sort((a, b) => b.s - a.s);
  $('#card').innerHTML =
    '<div><div class="name">' + esc(r.name) + errs(r) + '</div><div class="muted">' + esc(r.id) + '.js' + (r.author ? ' · ' + esc(r.author) : '') +
    (r.rev > 1 ? ' · r' + r.rev : '') + '</div></div>' +
    '<div class="big"><b>' + Math.round(r.rating) + '</b>' + (r.delta != null ? '<span class="' + tone(r.delta) + '">' + signed(r.delta) + '</span>' : '') +
    (r.games ? '<span class="muted" title="highest rating it has reached">peak ' + Math.round(r.peak) + '</span>' : '') + '</div>' +
    (!r.games ? '' : spark(r, 220, 40) +
    '<div style="display:flex;gap:14px;align-items:center">' + rec(r.w, r.l, r.d, 160) + '<span class="muted">' + r.w + '-' + r.d + '-' + r.l + '</span>' + form(r.form) + '</div>' +
    (opp.length ? '<div class="vs">' + opp.map((o) => '<span>' + esc(nameOf(o.id)) + '</span>' + rec(o.v.w, o.v.l, o.v.d, 160)).join('') + '</div>' : '') +
    '<div class="muted" style="display:flex;gap:16px">' +
    '<span title="mean fun score of its matches">' + meter(r.fun) + ' ' + (r.fun == null ? '' : r.fun) + '</span>' +
    (r.avgMin != null ? '<span title="mean minutes to drive a bird off">⏱ ' + r.avgMin + 'm</span>' : '') +
    (r.kd != null ? '<span title="kills per death">⚔ ' + r.kd + '</span>' : '') + '</div>');
}
function h2h() {
  const rows = DATA.rows.filter((r) => !r.retired || r.games);
  if (!DATA.history.length) { $('#h2h').closest('.box').hidden = true; return; }
  let t = '<caption>Head to head</caption><thead><tr><th></th>' +
    rows.map((r) => '<th class="c" scope="col" title="' + esc(r.name) + '">' + esc(r.name.slice(0, 7)) + '</th>').join('') + '</tr></thead><tbody>';
  for (const x of rows) {
    t += '<tr><th scope="row">' + esc(x.name) + '</th>' + rows.map((y) => {
      if (x.id === y.id) return '<td class="c self"></td>';
      const v = x.vs[y.id];
      if (!v) return '<td class="c"></td>';
      const n = v.w + v.l + v.d, s = (v.w + v.d / 2) / n; // 0 lost all .. 1 won all
      const bg = s > 0.5 ? 'rgba(123,216,143,' + (0.12 + 0.6 * (s - 0.5) * 2) + ')' : s < 0.5 ? 'rgba(255,138,92,' + (0.12 + 0.6 * (0.5 - s) * 2) + ')' : 'var(--faint)';
      return '<td class="c" style="background:' + bg + '" title="' + esc(x.name) + ' vs ' + esc(y.name) + ': ' + v.w + ' won, ' + v.d + ' drawn, ' + v.l + ' lost">' + Math.round(100 * s) + '</td>';
    }).join('') + '</tr>';
  }
  $('#h2h').innerHTML = t + '</tbody>';
}
function side(s, h) {
  const won = h.winner === s.id, d = s.after - s.before;
  return '<span class="' + (won ? 'w' : '') + '">' + (won ? '★ ' : '') + esc(nameOf(s.id)) + '</span> <span class="' + tone(d) + '" title="rating ' + Math.round(s.after) + '">' + signed(d) + '</span>';
}
function result(h) {
  if (h.reason === 'error') return '<b class="chip l" title="crashed, unrated: ' + esc(h.error) + '">!</b>';
  if (!h.winner) return '<b class="chip d" title="draw: time ran out">D</b>';
  return '<b class="chip w" title="a bird was driven off">W</b>';
}
function matches() {
  if (!DATA.history.length) {
    $('#matches tbody').innerHTML = '<tr><td><div class="empty"><pre>node app/ladder/ladder.js run --matches 10</pre><span class="muted">add your own: node app/ladder/ladder.js add mybot.js</span></div></td></tr>';
    $('#filter').textContent = ''; $('#all').hidden = true; return;
  }
  const list = DATA.history.filter((h) => !filtered || h.team0.id === pick || h.team1.id === pick).slice().reverse();
  $('#filter').textContent = filtered ? nameOf(pick) : '';
  $('#all').hidden = !filtered;
  $('#matches tbody').innerHTML = list.map((h) => '<tr data-match="' + esc(h.id) + '">' +
    '<td class="c">' + result(h) + '</td>' +
    '<td>' + side(h.team0, h) + ' <span class="vsep">vs</span> ' + side(h.team1, h) + '</td>' +
    '<td class="n muted" title="match length">' + (h.time / 60).toFixed(0) + 'm</td>' +
    '<td>' + meter(h.fun) + '</td>' +
    '<td class="muted" title="seed ' + h.seed + '">' + esc(h.shapeName || h.shape) + '</td>' +
    '<td class="muted">' + esc(when(h.date)) + '</td>' +
    '<td><a href="' + esc(h.log) + '" title="match log ' + esc(h.id) + ': open it in the bot lab (F6, or botlab.html)">log</a></td></tr>').join('');
}
function render() { board(); card(); h2h(); matches(); }

for (const th of document.querySelectorAll('th[data-tip]')) th.title = TIP[th.dataset.tip];
$('#all').onclick = () => { filtered = false; render(); };
$('#meta').textContent = DATA.rows.length + ' bots · ' + DATA.history.length + ' matches';
$('#meta').title = 'updated ' + when(DATA.written);
render();
</script>
</body>
</html>
`;

function writePage(dir, ladder, history) {
  const data = { v: 1, start: core.RATING_START, written: new Date().toISOString(), glossary: GLOSSARY, rows: core.standings(ladder, history), history };
  fs.writeFileSync(path.join(dir, 'standings.json'), JSON.stringify(data, null, 1));
  // the same numbers for the game's BOT LADDER screen (js/ui/ladder.js), which
  // loads them as a script (the game never fetches), with each entered file's
  // source so the player can fight it
  const bots = {}, bdir = path.join(dir, 'bots');
  if (fs.existsSync(bdir)) for (const f of fs.readdirSync(bdir)) if (f.endsWith('.js')) bots[f.slice(0, -3)] = fs.readFileSync(path.join(bdir, f), 'utf8');
  fs.writeFileSync(path.join(dir, 'standings.js'), "// GENERATED by app/ladder/page.js: the standings for the game's BOT LADDER screen\n" +
    'window.LADDER_DATA = ' + JSON.stringify({ v: 1, written: data.written, start: data.start, rows: data.rows, bots }).replace(/</g, '\\u003c') + ';\n');
  const out = path.join(dir, 'ladder.html');
  // a name holding "</script>" must not close the JSON block
  fs.writeFileSync(out, HTML.replace('/*DATA*/', () => JSON.stringify(data).replace(/</g, '\\u003c'))); // a function: a '$' in a name is not a pattern
  return out;
}

module.exports = { writePage, GLOSSARY };
