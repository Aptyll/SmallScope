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

// what each column means: the page's HOW TO READ panel and every header's hover
const GLOSSARY = [
  ['RATING', 'Elo score. Everyone starts at 1000. Beating a higher-rated bot gains more.'],
  ['TREND', 'Rating after each of its matches, oldest to newest.'],
  ['FORM', 'Its last five results, newest on the right. W win, L loss, D draw.'],
  ['W-L-D', 'Wins, losses, draws. A draw is a match that ran out of time.'],
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
               games, w, l, d, winPct, fun, avgMin, kd, trail[], form[], vs{ id: {w,l,d} }, retired
    history[]  one per match, oldest first: id, date (ISO, UTC), seed, shape, shapeName,
               team0/team1 { id, before, after, stats{kills,deaths,dmg,siege,gold,bird} },
               winner (bot id or null), reason ('eagle' | 'timeout' | 'error'), time (s), fun, rated, log
    glossary[] [column, meaning]
  The files: docs/bots/ladder.md. Each match's full log: the path in history[].log.
-->
<style>
  :root { --bg: #0b0f16; --panel: #121822; --edge: #2c3544; --edge-hi: #5b6678; --ink: #d6dde8; --dim: #8b94a7;
    --faint: #1c2230; --sel: #1b2230; --win: #7bd88f; --loss: #ff8a5c; --draw: #8b94a7; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink);
    font: 12px/1.45 ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace; }
  header { display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-bottom: 1px solid var(--edge); flex-wrap: wrap; }
  header h1 { font-size: 13px; letter-spacing: 2px; margin: 0; font-weight: 600; }
  .sp { flex: 1; }
  .muted { color: var(--dim); }
  button { background: var(--panel); color: var(--ink); border: 1px solid var(--edge-hi); font: inherit; padding: 2px 10px; cursor: pointer; }
  button:hover, button:focus-visible { border-color: var(--ink); outline: none; }
  button[aria-expanded="true"] { background: var(--sel); }
  #help { margin: 12px 16px 0; }
  #help[hidden] { display: none; }
  main { display: grid; gap: 12px; padding: 12px 16px 24px; grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr); }
  @media (max-width: 960px) { main { grid-template-columns: minmax(0, 1fr); } }
  .box { border: 1px solid var(--edge); background: var(--panel); min-width: 0; }
  .box > h2 { margin: 0; font-size: 12px; font-weight: normal; letter-spacing: 1px; padding: 6px 10px; border-bottom: 1px solid var(--edge);
    display: flex; gap: 10px; align-items: baseline; }
  .box > .bd { overflow: auto; }
  .wide { grid-column: 1 / -1; }
  .scroll { max-height: 60vh; }
  table { border-collapse: collapse; width: 100%; }
  caption { position: absolute; left: -9999px; }
  th { color: var(--dim); font-weight: normal; text-align: left; position: sticky; top: 0; background: var(--panel); }
  th[title] { cursor: help; text-decoration: underline dotted var(--edge-hi); text-underline-offset: 3px; }
  th, td { padding: 4px 8px; white-space: nowrap; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:hover td { background: #161d29; }
  #board tbody tr { cursor: pointer; }
  #board tbody tr:focus-visible { outline: 1px solid var(--ink); outline-offset: -1px; }
  tr.pick td { background: var(--sel); }
  tr.pick td:first-child { box-shadow: inset 2px 0 0 var(--ink); }
  .w { color: var(--win); } .l { color: var(--loss); } .d { color: var(--draw); }
  .retired { opacity: 0.45; }
  .rating { font-weight: 600; }
  .form { display: inline-flex; gap: 2px; }
  .form b { display: inline-block; width: 14px; text-align: center; font-weight: 600; border: 1px solid currentColor; line-height: 13px; font-size: 10px; }
  svg.spark { display: block; }
  table.grid { width: auto; }
  .grid th.c, .grid td.c { text-align: center; min-width: 72px; }
  .grid td.self { background: var(--faint); }
  a { color: var(--ink); }
  .card { padding: 10px 12px; display: grid; gap: 10px; }
  .card .name { font-size: 15px; letter-spacing: 1px; }
  .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .stat { border: 1px solid var(--edge); padding: 6px 8px; }
  .stat .k { color: var(--dim); font-size: 11px; }
  .stat .v { font-size: 16px; font-variant-numeric: tabular-nums; }
  dl.gl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 0; padding: 10px 12px; }
  dl.gl dt { color: var(--ink); } dl.gl dd { margin: 0; color: var(--dim); white-space: normal; }
  pre { margin: 0; padding: 8px 12px; background: var(--bg); border: 1px solid var(--edge); overflow: auto; }
  .empty { padding: 16px 12px; display: grid; gap: 8px; }
</style>
</head>
<body>
<header>
  <h1>SOFTFALL BOT LADDER</h1>
  <span class="muted" id="meta"></span>
  <span class="sp"></span>
  <button id="helpBtn" aria-expanded="false" aria-controls="help">HOW TO READ</button>
</header>
<section class="box" id="help" hidden>
  <h2>HOW TO READ</h2>
  <dl class="gl" id="gloss"></dl>
  <div class="card">
    <span class="muted">Run more matches, then reopen this page:</span>
    <pre>node app/ladder/ladder.js add mybot.js
node app/ladder/ladder.js run --matches 10</pre>
    <span class="muted">Writing a bot: docs/bots/README.md</span>
  </div>
</section>
<main>
  <section class="box">
    <h2>STANDINGS <span class="muted" id="boardNote"></span></h2>
    <div class="bd" id="boardWrap"><table id="board"><caption>Standings, best first</caption><thead><tr>
      <th class="n">#</th><th>BOT</th><th class="n" data-tip="RATING">RATING</th><th data-tip="TREND">TREND</th><th data-tip="FORM">FORM</th>
      <th class="n" data-tip="W-L-D">W-L-D</th><th class="n" data-tip="WIN%">WIN%</th><th class="n" data-tip="FUN">FUN</th>
      <th class="n" data-tip="MIN">MIN</th><th class="n" data-tip="K/D">K/D</th></tr></thead><tbody></tbody></table></div>
  </section>
  <section class="box" id="cardBox" aria-live="polite">
    <h2>BOT</h2>
    <div class="card" id="card"></div>
  </section>
  <section class="box wide">
    <h2>HEAD TO HEAD <span class="muted">each row's wins-losses-draws against each column</span></h2>
    <div class="bd"><table class="grid" id="h2h"><caption>Head to head records</caption></table></div>
  </section>
  <section class="box wide">
    <h2>MATCHES <span class="muted" id="filter"></span><button id="all" hidden>SHOW ALL</button></h2>
    <div class="bd scroll"><table id="matches"><caption>Every match, newest first</caption><thead><tr>
      <th>MATCH</th><th>WHEN</th><th>RESULT</th><th>TEAM 0</th><th class="n" title="its rating after this match, and the change">RATING</th><th>TEAM 1</th><th class="n" title="its rating after this match, and the change">RATING</th>
      <th class="n">MIN</th><th class="n" data-tip="FUN">FUN</th><th>MAP</th><th class="n">SEED</th><th>LOG</th></tr></thead><tbody></tbody></table></div>
  </section>
</main>
<script type="application/json" id="ladder-data">/*DATA*/</script>
<script>
const DATA = JSON.parse(document.getElementById('ladder-data').textContent);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dash = (v) => (v == null ? '-' : v);
const TIP = Object.fromEntries(DATA.glossary);
const byId = Object.fromEntries(DATA.rows.map((r) => [r.id, r]));
const nameOf = (id) => (byId[id] ? byId[id].name : id);
const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const signed = (v) => (v == null ? '' : (v > 0 ? '+' : '') + (Math.round(v * 10) / 10));
const cls = (v) => (v > 0 ? 'w' : v < 0 ? 'l' : 'd');
let pick = DATA.rows.length ? DATA.rows[0].id : null, filtered = false;

function spark(r) {
  const pts = [DATA.start].concat(r.trail);
  if (pts.length < 2) return '<span class="muted">-</span>';
  const lo = Math.min(...pts), hi = Math.max(...pts), W = 72, H = 16, k = (hi - lo) || 1;
  const d = pts.map((v, i) => (i ? 'L' : 'M') + (i * W / (pts.length - 1)).toFixed(1) + ' ' + (H - 2 - (v - lo) / k * (H - 4)).toFixed(1)).join(' ');
  const up = pts[pts.length - 1] >= pts[0];
  return '<svg class="spark" width="' + W + '" height="' + H + '" role="img" aria-label="rating from ' + pts[0] + ' to ' + Math.round(pts[pts.length - 1]) + '"><path d="' + d + '" fill="none" stroke="' + (up ? 'var(--win)' : 'var(--loss)') + '" stroke-width="1.2"/></svg>';
}
function form(f) {
  if (!f.length) return '<span class="muted">-</span>';
  return '<span class="form" aria-label="last results ' + f.join(' ') + '">' + f.map((x) => '<b class="' + x.toLowerCase() + '">' + x + '</b>').join('') + '</span>';
}
function broken(r) {
  return r.errors ? ' <span class="l" title="its code threw ' + r.errors + ' times in ' + r.thinks + ' thinks">' + r.errors + ' ERRORS</span>' : '';
}
function board() {
  $('#board tbody').innerHTML = DATA.rows.map((r, i) =>
    '<tr tabindex="0" data-id="' + esc(r.id) + '" data-rating="' + r.rating + '" class="' + (r.retired ? 'retired ' : '') + (pick === r.id ? 'pick' : '') + '">' +
    '<td class="n">' + (r.retired ? '' : i + 1) + '</td>' +
    '<td>' + esc(r.name) + (r.author ? ' <span class="muted">by ' + esc(r.author) + '</span>' : '') + (r.retired ? ' <span class="muted">retired</span>' : '') + broken(r) + '</td>' +
    '<td class="n"><span class="rating">' + Math.round(r.rating) + '</span>' + (r.delta != null ? ' <span class="' + cls(r.delta) + '" title="change in its last match">' + signed(r.delta) + '</span>' : '') + '</td>' +
    '<td>' + spark(r) + '</td><td>' + form(r.form) + '</td>' +
    '<td class="n">' + r.w + '-' + r.l + '-' + r.d + '</td><td class="n">' + dash(r.winPct) + '</td><td class="n">' + dash(r.fun) + '</td>' +
    '<td class="n">' + dash(r.avgMin) + '</td><td class="n">' + dash(r.kd) + '</td></tr>').join('');
  for (const tr of document.querySelectorAll('#board tbody tr')) {
    const go = () => { pick = tr.dataset.id; filtered = true; render(); };
    tr.onclick = go;
    tr.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  }
  const active = DATA.rows.filter((r) => !r.retired).length;
  $('#boardNote').textContent = !DATA.rows.length ? '' : active + ' bots' + (DATA.rows.length > active ? ', ' + (DATA.rows.length - active) + ' retired' : '') + '. Click one for its card.';
}
function card() {
  const r = byId[pick];
  if (!r) { $('#card').innerHTML = '<span class="muted">No bots yet.</span>'; return; }
  const opp = Object.entries(r.vs).map(([id, v]) => ({ id, v, s: (v.w + v.d / 2) / (v.w + v.l + v.d) }));
  opp.sort((a, b) => b.s - a.s);
  const rec = (o) => esc(nameOf(o.id)) + ' <span class="muted">' + o.v.w + '-' + o.v.l + '-' + o.v.d + '</span>';
  const stat = (k, v, c) => '<div class="stat"><div class="k">' + k + '</div><div class="v' + (c ? ' ' + c : '') + '">' + v + '</div></div>';
  $('#card').innerHTML =
    '<div><div class="name">' + esc(r.name) + '</div><div class="muted">' + esc(r.id) + '.js' + (r.author ? ' · by ' + esc(r.author) : '') +
    (r.version ? ' · v' + esc(r.version) : '') + ' · revision ' + r.rev + (r.from === 'builtin' ? ' · example bot' : '') + '</div></div>' +
    '<div class="stats">' + stat('RATING', Math.round(r.rating)) + stat('PEAK', Math.round(r.peak)) + stat('GAMES', r.games) +
    stat('W-L-D', r.w + '-' + r.l + '-' + r.d) + stat('WIN%', dash(r.winPct)) + stat('ERRORS', r.errors || 0, r.errors ? 'l' : '') + '</div>' +
    (r.form.length ? '<div>' + form(r.form) + '</div>' : '') +
    (opp.length ? '<div><span class="muted">Best against</span> ' + rec(opp[0]) + (opp.length > 1 ? '<br><span class="muted">Worst against</span> ' + rec(opp[opp.length - 1]) : '') + '</div>'
      : '<span class="muted">No rated matches yet.</span>');
}
function h2h() {
  const rows = DATA.rows.filter((r) => !r.retired || r.games);
  if (!DATA.history.length) { $('#h2h').innerHTML = '<caption>Head to head records</caption><tbody><tr><td class="muted">No matches yet.</td></tr></tbody>'; return; }
  let t = '<caption>Head to head records</caption><thead><tr><th scope="col">vs</th>' +
    rows.map((r) => '<th class="c" scope="col" title="' + esc(r.name) + '">' + esc(r.name.slice(0, 8)) + '</th>').join('') + '</tr></thead><tbody>';
  for (const x of rows) {
    t += '<tr><th scope="row">' + esc(x.name) + '</th>' + rows.map((y) => {
      if (x.id === y.id) return '<td class="c self"></td>';
      const v = x.vs[y.id];
      if (!v) return '<td class="c muted" title="not played">.</td>';
      const s = v.w - v.l;
      return '<td class="c ' + cls(s) + '" title="' + esc(x.name) + ' vs ' + esc(y.name) + ': ' + v.w + ' won, ' + v.l + ' lost, ' + v.d + ' drawn">' + v.w + '-' + v.l + '-' + v.d + '</td>';
    }).join('') + '</tr>';
  }
  $('#h2h').innerHTML = t + '</tbody>';
}
function result(h) {
  if (h.reason === 'error') return '<span class="l" title="' + esc(h.error) + '">CRASHED, UNRATED</span>';
  if (!h.winner) return '<span class="d">DRAW</span> <span class="muted">time ran out</span>';
  return '<span class="w">' + esc(nameOf(h.winner)) + ' WON</span> <span class="muted">bird driven off</span>';
}
function side(s, won) {
  const d = s.after - s.before;
  return '<td' + (won ? ' class="w"' : '') + '>' + esc(nameOf(s.id)) + '</td><td class="n"><span class="muted">' + Math.round(s.after) + '</span> <span class="' + cls(d) + '">' + signed(d) + '</span></td>';
}
function matches() {
  if (!DATA.history.length) {
    $('#matches tbody').innerHTML = '<tr><td colspan="12"><div class="empty"><span>No matches yet. Play some:</span><pre>node app/ladder/ladder.js run --matches 10</pre></div></td></tr>';
    $('#filter').textContent = ''; $('#all').hidden = true; return;
  }
  const list = DATA.history.filter((h) => !filtered || h.team0.id === pick || h.team1.id === pick).slice().reverse();
  $('#filter').textContent = filtered ? nameOf(pick) + "'s " + list.length : list.length + ' played';
  $('#all').hidden = !filtered;
  $('#matches tbody').innerHTML = list.map((h) => '<tr data-match="' + esc(h.id) + '"><td>' + esc(h.id) + '</td><td class="muted">' + esc(when(h.date)) + '</td>' +
    '<td>' + result(h) + '</td>' + side(h.team0, h.winner === h.team0.id) + side(h.team1, h.winner === h.team1.id) +
    '<td class="n">' + (h.time / 60).toFixed(1) + '</td><td class="n">' + dash(h.fun) + '</td>' +
    '<td class="muted">' + esc(h.shapeName || h.shape) + '</td><td class="n muted">' + h.seed + '</td>' +
    '<td><a href="' + esc(h.log) + '" title="the full match log: open it in the bot lab (F6 in the game, or botlab.html)">log</a></td></tr>').join('');
}
function render() { board(); card(); h2h(); matches(); }

for (const th of document.querySelectorAll('th[data-tip]')) th.title = TIP[th.dataset.tip];
$('#gloss').innerHTML = DATA.glossary.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('');
$('#helpBtn').onclick = () => { const h = $('#help'), open = h.hidden; h.hidden = !open; $('#helpBtn').setAttribute('aria-expanded', String(open)); };
$('#all').onclick = () => { filtered = false; render(); };
$('#meta').textContent = DATA.history.length + ' matches · updated ' + when(DATA.written);
if (!DATA.history.length) { $('#help').hidden = false; $('#helpBtn').setAttribute('aria-expanded', 'true'); } // a first visit opens on the how-to
render();
</script>
</body>
</html>
`;

function writePage(dir, ladder, history) {
  const data = { v: 1, start: core.RATING_START, written: new Date().toISOString(), glossary: GLOSSARY, rows: core.standings(ladder, history), history };
  fs.writeFileSync(path.join(dir, 'standings.json'), JSON.stringify(data, null, 1));
  const out = path.join(dir, 'ladder.html');
  // a name holding "</script>" must not close the JSON block
  fs.writeFileSync(out, HTML.replace('/*DATA*/', JSON.stringify(data).replace(/</g, '\\u003c')));
  return out;
}

module.exports = { writePage, GLOSSARY };
