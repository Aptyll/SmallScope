'use strict';
// The patch check's page: one static HTML file beside the runs (regress.html),
// numbers inlined, opens straight off the disk. Patches run left to right,
// the set's matches top to bottom; a cell is who won, how long it ran and
// how much fun it scored, and a cell that moved from the patch before it
// carries its flags. Under it, the ladder's history cut into one season
// per patch. Same look as ladder.html. The same numbers ride in the page as
// a JSON block (#regress-data) for scripts and agents.

const fs = require('fs');
const path = require('path');
const core = require('../ladder/core');

const GLOSSARY = [
  ['W0 / W1', 'Which team drove the rival bird off. Team 0 is seat 0\'s side.'],
  ['draw', 'The match hit its cut (set.js maxMin) with both birds still roosting.'],
  ['ERR', 'The match crashed; its numbers are not compared.'],
  ['fun', 'The match\'s fun score, 0 to 100 (app/arena/fun.js): close, swingy, busy, full of fights.'],
  ['min', 'Minutes of match clock until a bird fled or the cut.'],
  ['FLIP', 'A different winner than the patch before.'],
  ['FUN+ / FUN-', 'Fun score moved 8 or more points.'],
  ['LONGER / SHORTER', 'Match length moved a quarter or more.'],
  ['BLOODIER / QUIETER', 'Kills moved by half or more (and at least 4).'],
  ['SETUP', 'The set changed for this match: the two runs are not comparable.'],
  ['BOT ERRORS', 'A bot file threw more often than on the patch before.'],
  ['season', 'Ladder matches played on one patch, rated from 1000 again: a rating against the game it was played on.'],
];

// the ladder's history cut by patch: each season rated from scratch
function seasonsOf(history) {
  const by = {};
  for (const h of history) (by[h.patch || '?'] = by[h.patch || '?'] || []).push(h);
  const num = (n) => parseFloat(n) || 0;
  return Object.keys(by).sort((x, y) => num(x) - num(y)).map((patch) => {
    const rows = {};
    const row = (id) => rows[id] || (rows[id] = { id, rating: core.RATING_START, w: 0, l: 0, d: 0, games: 0 });
    for (const h of by[patch]) {
      const A = row(h.team0.id), B = row(h.team1.id);
      if (!h.rated) continue;
      const sa = h.winner === A.id ? 1 : h.winner === B.id ? 0 : 0.5;
      [A.rating, B.rating] = core.rate(A.rating, B.rating, sa);
      if (sa === 1) { A.w++; B.l++; } else if (sa === 0) { A.l++; B.w++; } else { A.d++; B.d++; }
      A.games++; B.games++;
    }
    const list = Object.values(rows).map((r) => Object.assign(r, { rating: Math.round(r.rating) })).sort((x, y) => y.rating - x.rating || y.games - x.games);
    return { patch, matches: by[patch].length, rows: list };
  });
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const CSS = `
  :root { --bg: #0b0f16; --panel: #121822; --edge: #2c3544; --edge-hi: #5b6678; --ink: #d6dde8; --dim: #8b94a7;
    --faint: #262f3f; --t0: #6ea8e8; --t1: #ff8a5c; --draw: #5b6678; --err: #f0b84a; --fun: #7bd88f; --flag: #f0b84a; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink);
    font: 12px/1.45 ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace; }
  header { display: flex; align-items: center; gap: 14px; padding: 8px 16px; border-bottom: 1px solid var(--edge); flex-wrap: wrap; }
  header h1 { font-size: 13px; letter-spacing: 2px; margin: 0; font-weight: 600; }
  .sp { flex: 1; }
  .muted { color: var(--dim); }
  .legend { display: flex; gap: 14px; align-items: center; color: var(--dim); flex-wrap: wrap; }
  .legend span { display: inline-flex; gap: 5px; align-items: center; }
  main { padding: 12px 16px 40px; display: grid; gap: 18px; }
  section { background: var(--panel); border: 1px solid var(--edge); padding: 10px 12px; }
  h2 { font-size: 11px; letter-spacing: 2px; margin: 0 0 8px; color: var(--dim); font-weight: 600; }
  .head { font-size: 14px; display: flex; gap: 18px; align-items: baseline; flex-wrap: wrap; }
  .head b { font-size: 18px; }
  .moved { color: var(--flag); }
  table { border-collapse: collapse; }
  th { color: var(--dim); font-weight: 600; text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--edge); white-space: nowrap; cursor: default; }
  td { padding: 4px 8px; border-bottom: 1px solid var(--faint); vertical-align: top; white-space: nowrap; }
  td.c { text-align: center; }
  .chip { display: inline-block; margin-right: 5px; min-width: 34px; padding: 1px 5px; text-align: center; font-weight: 600; border: 1px solid currentColor; }
  .w0 { color: var(--t0); } .w1 { color: var(--t1); } .dr { color: var(--draw); } .er { color: var(--err); }
  .bar { display: block; height: 4px; width: 60px; background: var(--faint); margin: 3px auto 0; }
  .bar i { display: block; height: 100%; background: var(--fun); }
  .cell { display: inline-block; cursor: default; }
  .flags { display: block; font-size: 10px; color: var(--flag); min-height: 14px; letter-spacing: 0.5px; }
  .sub { font-size: 10px; color: var(--dim); }
  .tot td { color: var(--dim); border-top: 1px solid var(--edge); }
  svg { display: block; }
  .seasons { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
  .season { border: 1px solid var(--edge); padding: 8px 10px; min-width: 220px; }
  .season .r { display: grid; grid-template-columns: 90px 1fr 46px; gap: 8px; align-items: center; padding: 2px 0; }
  .season .rb { height: 6px; background: var(--faint); } .season .rb i { display: block; height: 100%; background: var(--t0); }
`;

function sparkline(vals, W, H) {
  const ok = vals.map((v, i) => [i, v]).filter((p) => p[1] != null);
  if (ok.length < 2) return '';
  const lo = Math.min(...ok.map((p) => p[1])), hi = Math.max(...ok.map((p) => p[1]));
  const x = (i) => 4 + (W - 8) * i / (vals.length - 1), y = (v) => H - 4 - (hi > lo ? (H - 8) * (v - lo) / (hi - lo) : (H - 8) / 2);
  const d = ok.map((p, k) => (k ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
  return `<svg width="${W}" height="${H}"><path d="${d}" fill="none" stroke="var(--fun)" stroke-width="1.5"/>${ok.map((p) => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="2" fill="var(--fun)"/>`).join('')}</svg>`;
}

function chip(r) {
  if (!r) return '<span class="chip dr">·</span>';
  const cls = r.reason === 'error' ? 'er' : r.winner == null ? 'dr' : 'w' + r.winner;
  const txt = r.reason === 'error' ? 'ERR' : r.winner == null ? 'draw' : 'W' + r.winner;
  return `<span class="chip ${cls}">${txt}</span>`;
}
function cellOf(r, flags) {
  if (!r) return '<td class="c"><span class="cell muted">·</span></td>';
  const nerve = r.sides.map((s) => (s.nerve == null ? '?' : s.nerve + '%')).join(' / ');
  const tip = `${esc(r.setup)}\n${r.reason}${r.winner != null ? ', team ' + r.winner + ' won' : ''} after ${r.min} min\nfun ${r.fun}  kills ${r.kills}  nerve left ${nerve}\n` +
    `team 0: ${r.sides[0].kills} kills, ${r.sides[0].dmg} dmg, ${r.sides[0].siege} siege\nteam 1: ${r.sides[1].kills} kills, ${r.sides[1].dmg} dmg, ${r.sides[1].siege} siege` +
    (r.errors ? `\nbot errors ${r.errors}, late ${r.late}` : '') + (r.error ? '\n' + esc(r.error.split('\n')[0]) : '') + (flags.length ? '\n' + flags.join(' ') : '') + `\nlog: ${r.file}`;
  const shown = flags.filter((f) => f !== 'NEW');
  return `<td class="c"><span class="cell" title="${tip}">${chip(r)}<span class="sub">${r.min} min · ${r.kills} k</span>` +
    `<span class="bar" title="fun ${r.fun}"><i style="width:${r.fun == null ? 0 : r.fun}%"></i></span><span class="flags">${shown.join(' ')}</span></span></td>`;
}

function render(runs, seasons, rules) {
  const shown = runs.slice(-8);
  const keys = [];
  for (const r of shown) for (const k of Object.keys(r.matches)) if (!keys.includes(k)) keys.push(k);
  const tots = shown.map((r) => rules.totals(r));
  const flagsAt = shown.map((r, i) => {
    const out = {};
    if (!i) { for (const k of keys) out[k] = []; return out; }
    for (const d of rules.diffOf(shown[i - 1], r).rows) out[d.key] = d.flags;
    return out;
  });
  const last = shown[shown.length - 1], prev = shown[shown.length - 2];
  let head = '';
  if (last && prev) {
    const d = rules.diffOf(prev, last);
    const n = d.rows.filter((r) => r.flags.length && r.flags[0] !== 'NEW').length;
    head = `<div class="head"><span><b>${esc(last.patch)}</b> <span class="muted">vs ${esc(prev.patch)}</span></span>` +
      `<span class="${n ? 'moved' : 'muted'}">${n ? n + ' of ' + d.rows.length + ' matches moved' : 'nothing moved'}</span>` +
      `<span class="muted">fun ${d.ta.fun} → ${d.tb.fun} · ${d.ta.min} → ${d.tb.min} min · ${d.ta.kills} → ${d.tb.kills} kills` +
      (d.tb.errors ? ` · <span class="er">${d.tb.errors} crashed</span>` : '') + (d.tb.botErrors ? ` · <span class="er">${d.tb.botErrors} bot errors</span>` : '') + '</span></div>';
  } else if (last) head = `<div class="head"><span><b>${esc(last.patch)}</b></span><span class="muted">first run: nothing to compare with yet</span></div>`;
  else head = '<div class="head muted">no runs yet: node app/regress/regress.js run</div>';

  const th = shown.map((r) => `<th title="${esc(r.date.slice(0, 16).replace('T', ' '))}">${esc(r.patch)}</th>`).join('');
  const rows = keys.map((k) => {
    const any = shown.map((r) => r.matches[k]).find(Boolean);
    return `<tr><td title="seed ${any.seed}, map ${any.shape}, cut at ${any.maxMin} min">${esc(k)}<br><span class="sub">${esc(any.setup)}</span></td>` +
      shown.map((r, i) => cellOf(r.matches[k], flagsAt[i][k] || [])).join('') + '</tr>';
  }).join('');
  const tot = (label, f) => `<tr class="tot"><td>${label}</td>${tots.map((t) => `<td class="c">${f(t)}</td>`).join('')}</tr>`;
  const grid = `<table><tr><th>match</th>${th}</tr>${rows}` +
    tot('fun', (t) => t.fun) + tot('minutes', (t) => t.min) + tot('kills', (t) => t.kills) +
    tot('wins 0 / 1', (t) => t.wins.join(' / ')) + tot('draws · crashes', (t) => t.timeouts + ' · ' + t.errors) + '</table>';
  const spark = shown.length > 1 ? `<div class="muted" style="margin-top:8px">mean fun across patches</div>${sparkline(tots.map((t) => t.fun), Math.max(160, 70 * shown.length), 44)}` : '';

  const seas = seasons.length
    ? `<div class="seasons">${seasons.slice(-6).map((s) => {
      const top = s.rows.slice(0, 8), hi = Math.max(1100, ...top.map((r) => r.rating));
      return `<div class="season"><div><b>${esc(s.patch)}</b> <span class="muted">${s.matches} matches</span></div>` +
        top.map((r) => `<div class="r" title="${r.w}W ${r.l}L ${r.d}D in ${r.games}"><span>${esc(r.id)}</span><span class="rb"><i style="width:${Math.round(100 * (r.rating - 900) / (hi - 900))}%"></i></span><span>${r.rating}</span></div>`).join('') + '</div>';
    }).join('')}</div>`
    : '<div class="muted">no ladder matches yet (node app/ladder/ladder.js run)</div>';

  const data = { runs: shown, seasons, glossary: GLOSSARY };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Softfall patch check</title>
<!-- #regress-data: { runs[] { patch, date, matches{ key: row } }, seasons[] { patch, matches, rows[] { id, rating, w, l, d, games } }, glossary[] }
     row: { key, seed, shape, setup, maxMin, winner, reason, min, kills, fun, parts, sides[2]{kills,deaths,dmg,siege,gold,nerve}, errors, late, error, file }
     The reading: docs/dev/regress.md. -->
<style>${CSS}</style></head><body>
<header><h1>PATCH CHECK</h1><span class="muted">the same ${keys.length} matches on every patch</span><span class="sp"></span>
<div class="legend"><span class="w0"><span class="chip w0">W0</span></span><span class="w1"><span class="chip w1">W1</span></span><span><span class="chip dr">draw</span></span><span><span class="chip er">ERR</span></span><span><span class="bar" style="margin:0;width:40px"><i style="width:60%"></i></span> fun</span><span class="moved">flag = moved since the patch before</span></div></header>
<main>
<section>${head}</section>
<section><h2>THE SET</h2>${grid}${spark}</section>
<section><h2>LADDER SEASONS</h2>${seas}</section>
<section><h2>HOW TO READ</h2><table>${GLOSSARY.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="muted">${esc(v)}</td></tr>`).join('')}</table></section>
</main>
<script id="regress-data" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</body></html>`;
}

function writePage(dir, runs, history, rules) {
  fs.mkdirSync(dir, { recursive: true });
  const seasons = seasonsOf(history);
  const file = path.join(dir, 'regress.html');
  fs.writeFileSync(file, render(runs, seasons, rules));
  fs.writeFileSync(path.join(dir, 'seasons.json'), JSON.stringify(seasons, null, 1));
  return file;
}

module.exports = { writePage, seasonsOf, GLOSSARY };
