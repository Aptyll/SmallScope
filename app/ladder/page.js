'use strict';
// The ladder's page: one static HTML file written beside the ladder's data
// (ladder.html), its numbers inlined, so it opens straight off the disk with
// no server - the standings with each entry's rating over its matches, who
// beats whom, and every match with its log. Same look as the bot lab
// (botlab.html), which opens any of the logs listed here.

const fs = require('fs');
const path = require('path');
const core = require('./core');

const HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Softfall Bot Ladder</title>
<style>
  :root { --bg: #0b0f16; --panel: #121822; --edge: #2c3544; --edge-hi: #5b6678; --ink: #d6dde8; --dim: #7d8699;
    --faint: #1c2230; --win: #7bd88f; --loss: #ff8a5c; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink);
    font: 12px/1.4 ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace; }
  header { display: flex; align-items: baseline; gap: 12px; padding: 8px 16px; border-bottom: 1px solid var(--edge); flex-wrap: wrap; }
  header h1 { font-size: 13px; letter-spacing: 2px; margin: 0; font-weight: 600; }
  .muted { color: var(--dim); }
  main { display: grid; gap: 12px; padding: 12px 16px; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); }
  @media (max-width: 900px) { main { grid-template-columns: minmax(0, 1fr); } }
  .box { border: 1px solid var(--edge); background: var(--panel); min-width: 0; }
  .box > .hd { padding: 6px 8px; border-bottom: 1px solid var(--edge); display: flex; gap: 8px; align-items: baseline; }
  .box > .bd { overflow: auto; max-height: 70vh; }
  .wide { grid-column: 1 / -1; }
  table { border-collapse: collapse; width: 100%; }
  th { color: var(--dim); font-weight: normal; text-align: left; position: sticky; top: 0; background: var(--panel); }
  th, td { padding: 3px 8px; white-space: nowrap; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:hover td { background: #161d29; }
  tr.pick td { background: #1b2230; }
  #board tbody tr { cursor: pointer; }
  .w { color: var(--win); } .l { color: var(--loss); }
  .retired { opacity: 0.45; }
  svg.spark { display: block; }
  .grid td.c { text-align: center; min-width: 44px; }
  a { color: var(--ink); }
  button { background: var(--panel); color: var(--dim); border: 1px solid var(--edge); font: inherit; padding: 1px 8px; cursor: pointer; }
  button:hover { color: var(--ink); border-color: var(--edge-hi); }
</style>
</head>
<body>
<header>
  <h1>SOFTFALL BOT LADDER</h1>
  <span class="muted" id="meta"></span>
</header>
<main>
  <section class="box">
    <div class="hd"><span>STANDINGS</span></div>
    <div class="bd"><table id="board"><thead><tr>
      <th class="n">#</th><th>BOT</th><th class="n">RATING</th><th></th><th class="n">GAMES</th><th class="n">W</th><th class="n">L</th><th class="n">D</th>
      <th class="n">WIN%</th><th class="n">FUN</th><th class="n">MIN</th><th class="n">K/D</th></tr></thead><tbody></tbody></table></div>
  </section>
  <section class="box">
    <div class="hd"><span>HEAD TO HEAD</span><span class="muted">row's win % against column</span></div>
    <div class="bd"><table class="grid" id="h2h"></table></div>
  </section>
  <section class="box wide">
    <div class="hd"><span>MATCHES</span><span class="muted" id="filter"></span><button id="all" hidden>ALL</button></div>
    <div class="bd"><table id="matches"><thead><tr>
      <th>MATCH</th><th>DATE</th><th>TEAM 0</th><th class="n"></th><th>TEAM 1</th><th class="n"></th><th>RESULT</th>
      <th class="n">MIN</th><th class="n">FUN</th><th>SEED / MAP</th><th>LOG</th></tr></thead><tbody></tbody></table></div>
  </section>
</main>
<script>
const DATA = /*DATA*/null;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dash = (v) => (v == null ? '-' : v);
let pick = null;
function spark(trail) {
  const pts = [DATA.start].concat(trail);
  if (pts.length < 2) return '';
  const lo = Math.min(...pts), hi = Math.max(...pts), W = 80, H = 16, k = (hi - lo) || 1;
  const d = pts.map((v, i) => (i ? 'L' : 'M') + (i * W / (pts.length - 1)).toFixed(1) + ' ' + (H - 1 - (v - lo) / k * (H - 2)).toFixed(1)).join(' ');
  const up = pts[pts.length - 1] >= pts[0];
  return '<svg class="spark" width="' + W + '" height="' + H + '"><path d="' + d + '" fill="none" stroke="' + (up ? 'var(--win)' : 'var(--loss)') + '" stroke-width="1.2"/></svg>';
}
function board() {
  $('#board tbody').innerHTML = DATA.rows.map((r, i) =>
    '<tr data-id="' + esc(r.id) + '" class="' + (r.retired ? 'retired ' : '') + (pick === r.id ? 'pick' : '') + '"><td class="n">' + (i + 1) + '</td>' +
    '<td>' + esc(r.name) + (r.name.toLowerCase() !== r.id ? ' <span class="muted">' + esc(r.id) + '</span>' : '') +
    (r.author ? ' <span class="muted">by ' + esc(r.author) + '</span>' : '') + (r.rev > 1 ? ' <span class="muted">r' + r.rev + '</span>' : '') + '</td>' +
    '<td class="n">' + Math.round(r.rating) + '</td><td>' + spark(r.trail) + '</td><td class="n">' + r.games + '</td>' +
    '<td class="n">' + r.w + '</td><td class="n">' + r.l + '</td><td class="n">' + r.d + '</td>' +
    '<td class="n">' + dash(r.winPct) + '</td><td class="n">' + dash(r.fun) + '</td><td class="n">' + dash(r.avgMin) + '</td><td class="n">' + dash(r.kd) + '</td></tr>').join('');
  for (const tr of document.querySelectorAll('#board tbody tr')) tr.onclick = () => { pick = pick === tr.dataset.id ? null : tr.dataset.id; render(); };
}
function h2h() {
  const ids = DATA.rows.map((r) => r.id), cell = {};
  for (const h of DATA.history) {
    if (!h.rated) continue;
    const a = h.team0.id, b = h.team1.id, s = h.winner === a ? 1 : h.winner === b ? 0 : 0.5;
    for (const [x, y, v] of [[a, b, s], [b, a, 1 - s]]) { const c = cell[x + '|' + y] || (cell[x + '|' + y] = [0, 0]); c[0] += v; c[1]++; }
  }
  let t = '<thead><tr><th></th>' + ids.map((id) => '<th class="c">' + esc(id.slice(0, 8)) + '</th>').join('') + '</tr></thead><tbody>';
  for (const x of ids) {
    t += '<tr><th>' + esc(x) + '</th>' + ids.map((y) => {
      const c = cell[x + '|' + y];
      if (x === y || !c) return '<td class="c muted">' + (x === y ? '' : '-') + '</td>';
      const p = Math.round(100 * c[0] / c[1]);
      return '<td class="c ' + (p > 50 ? 'w' : p < 50 ? 'l' : '') + '" title="' + c[1] + ' games">' + p + '</td>';
    }).join('') + '</tr>';
  }
  $('#h2h').innerHTML = t + '</tbody>';
}
function side(s, won) {
  const d = Math.round((s.after - s.before) * 10) / 10;
  return '<td' + (won ? ' class="w"' : '') + '>' + esc(s.id) + '</td><td class="n ' + (d > 0 ? 'w' : d < 0 ? 'l' : 'muted') + '">' + (d > 0 ? '+' : '') + d + '</td>';
}
function matches() {
  const list = DATA.history.filter((h) => !pick || h.team0.id === pick || h.team1.id === pick).slice().reverse();
  $('#filter').textContent = pick ? pick + ' only' : list.length + ' played';
  $('#all').hidden = !pick;
  $('#matches tbody').innerHTML = list.map((h) => '<tr><td>' + esc(h.id) + '</td><td class="muted">' + esc(h.date.slice(0, 16).replace('T', ' ')) + '</td>' +
    side(h.team0, h.winner === h.team0.id) + side(h.team1, h.winner === h.team1.id) +
    '<td>' + (h.reason === 'eagle' ? 'BIRD DOWN' : h.reason === 'timeout' ? '<span class="muted">TIME</span>' : '<span class="l" title="' + esc(h.error) + '">ERROR</span>') + '</td>' +
    '<td class="n">' + (h.time / 60).toFixed(1) + '</td><td class="n">' + dash(h.fun) + '</td>' +
    '<td class="muted">' + h.seed + ' / ' + esc(h.shapeName || h.shape) + '</td><td><a href="' + esc(h.log) + '">' + esc(h.id) + '.json</a></td></tr>').join('');
}
function render() { board(); h2h(); matches(); }
$('#all').onclick = () => { pick = null; render(); };
$('#meta').textContent = DATA.rows.length + ' bots, ' + DATA.history.length + ' matches, written ' + DATA.written.slice(0, 16).replace('T', ' ');
render();
</script>
</body>
</html>
`;

function writePage(dir, ladder, history) {
  const data = { start: core.RATING_START, written: new Date().toISOString(), rows: core.standings(ladder, history), history };
  const out = path.join(dir, 'ladder.html');
  // </script> inside a name must not close the inline block
  fs.writeFileSync(out, HTML.replace('/*DATA*/null', JSON.stringify(data).replace(/</g, '\\u003c')));
  return out;
}

module.exports = { writePage };
