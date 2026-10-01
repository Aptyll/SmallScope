'use strict';
// The patch check: the same fixed set of bot matches (set.js) replayed on
// every patch, each run kept, and the newest two read side by side. A patch
// that flips a winner, drains the fun score or makes matches drag shows up
// here as a flag, with the seed to replay it on; a bot strategy that starts
// winning for a bad reason shows up as the same flag. The ladder's history
// is also cut into one season per patch, so a bot's rating is read against
// the game it was played on.
//
//   node app/regress/regress.js run            play the set, keep it under the patch's name, diff
//   node app/regress/regress.js diff [a] [b]   two patches side by side (default: the newest two)
//   node app/regress/regress.js page           rewrite regress.html (every run + ladder seasons)
//   node app/regress/regress.js same           play the first match twice: is the sim deterministic?
//
// `run` flags: --jobs n (matches at once, default one per core), --as 4.50
// (keep the run under that name instead of PATCH_TXT: a branch before its
// bump), --only key (one match of the set, see set.js keyOf), --max min
// (override every match's cut). Every command takes --dir (default
// regress-data/, which git ignores) and --ladder (default ladder-data/).
// Format and reading: docs/dev/regress.md.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { playChild } = require('../arena/run');
const { MATCHES, keyOf } = require('./set');
const { writePage } = require('./page');

// how far a number may move before the diff calls it out
const FLAG_FUN = 8;     // fun score points
const FLAG_TIME = 0.25; // share of the shorter match's length
const FLAG_KILLS = 0.5; // share of the smaller side's kills (and at least 4)

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) { a._.push(k); continue; }
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    a[k.slice(2)] = v;
  }
  return a;
}

// ---- the store: one folder per patch -----------------------------------------------------
function store(dir) {
  const P = (...p) => path.join(dir, ...p);
  const num = (name) => parseFloat(name) || 0;
  return {
    dir,
    patches() {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).filter((n) => fs.existsSync(P(n, 'summary.json'))).sort((x, y) => num(x) - num(y) || (x < y ? -1 : 1));
    },
    summary(name) { return JSON.parse(fs.readFileSync(P(name, 'summary.json'), 'utf8')); },
    keep(name, sum) {
      fs.mkdirSync(P(name), { recursive: true });
      fs.writeFileSync(P(name, 'summary.json'), JSON.stringify(sum, null, 1));
    },
    log(name, key, log) {
      fs.mkdirSync(P(name), { recursive: true });
      if (log.map) {
        const mf = 'map-' + log.seed + '-' + log.shape + '.json';
        if (!fs.existsSync(P(name, mf))) fs.writeFileSync(P(name, mf), JSON.stringify(log.map));
        log.mapFile = mf; delete log.map;
      }
      fs.writeFileSync(P(name, key + '.json'), JSON.stringify(log));
      return path.join(name, key + '.json');
    },
  };
}

// the ladder's history, if there is one beside this (app/ladder/)
function ladderHistory(dir) {
  try { return fs.readFileSync(path.join(dir, 'history.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (e) { return []; }
}

// ---- one match's row: what a patch is compared on ---------------------------------------
function rowOf(m, log, file) {
  const r = log.result || {};
  const side = (team) => {
    const t = { kills: 0, deaths: 0, dmg: 0, siege: 0, gold: 0 };
    for (const p of log.players || []) if (p.id % 2 === team) for (const k in t) t[k] += p[k] || 0;
    const last = log.samples && log.samples.length ? log.samples[log.samples.length - 1] : null;
    const e = last && last.eagles ? last.eagles[team] : null;
    t.nerve = e ? Math.round(100 * e[0] / e[1]) : null; // the bird's nerve left, %
    return t;
  };
  let errors = 0, late = 0;
  for (const s of log.seats || []) { errors += s.errors || 0; late += s.late || 0; }
  const setup = log.setup
    ? (log.setup.kind === 'level' ? log.setup.levelName + (m.seats ? ' + bots' : '') : log.setup.a + ' v ' + log.setup.b) + ' on ' + (log.shapeName || '?')
    : 'crash';
  return {
    key: keyOf(m), seed: m.seed, shape: m.shape, setup, maxMin: m.maxMin,
    winner: r.winner == null ? null : r.winner, reason: r.reason || 'error', min: Math.round((r.time || 0) / 6) / 10,
    kills: (log.players || []).reduce((a, p) => a + (p.kills || 0), 0),
    fun: log.fun ? log.fun.score : null, parts: log.fun ? log.fun.parts : {},
    sides: [side(0), side(1)], errors, late, error: r.error || null, file,
  };
}

// ---- the diff: two summaries, matched by key -------------------------------------------
function flagsOf(a, b) {
  if (!a || !b) return ['NEW'];
  const f = [];
  if (a.setup !== b.setup) f.push('SETUP');
  if (b.reason === 'error' && a.reason !== 'error') f.push('ERROR');
  if (a.winner !== b.winner) f.push('FLIP');
  if (a.fun != null && b.fun != null && Math.abs(b.fun - a.fun) >= FLAG_FUN) f.push(b.fun > a.fun ? 'FUN+' : 'FUN-');
  const lo = Math.min(a.min, b.min);
  if (lo > 0 && Math.abs(b.min - a.min) / lo >= FLAG_TIME) f.push(b.min > a.min ? 'LONGER' : 'SHORTER');
  const lk = Math.min(a.kills, b.kills);
  if (Math.abs(b.kills - a.kills) >= Math.max(4, lk * FLAG_KILLS)) f.push(b.kills > a.kills ? 'BLOODIER' : 'QUIETER');
  if (b.errors > a.errors) f.push('BOT ERRORS');
  return f;
}
function meanOf(rows, f) {
  const ok = rows.filter((r) => r.reason !== 'error' && f(r) != null);
  return ok.length ? Math.round(10 * ok.reduce((s, r) => s + f(r), 0) / ok.length) / 10 : null;
}
function totals(sum) {
  const rows = Object.values(sum.matches);
  return {
    matches: rows.length, errors: rows.filter((r) => r.reason === 'error').length,
    timeouts: rows.filter((r) => r.reason === 'timeout').length,
    wins: [0, 1].map((t) => rows.filter((r) => r.winner === t).length),
    fun: meanOf(rows, (r) => r.fun), min: meanOf(rows, (r) => r.min), kills: meanOf(rows, (r) => r.kills),
    botErrors: rows.reduce((a, r) => a + r.errors, 0),
  };
}
function diffOf(A, B) {
  const keys = Array.from(new Set([...Object.keys(A.matches), ...Object.keys(B.matches)]));
  const rows = keys.map((k) => ({ key: k, a: A.matches[k] || null, b: B.matches[k] || null, flags: flagsOf(A.matches[k], B.matches[k]) }));
  return { a: A.patch, b: B.patch, rows, ta: totals(A), tb: totals(B) };
}

const pad = (v, n) => String(v == null ? '-' : v).padStart(n);
const padR = (v, n) => String(v == null ? '-' : v).padEnd(n);
function cell(r) { return '  ' + (r ? pad(r.winner == null ? (r.reason === 'error' ? 'ERR' : 'draw') : 'W' + r.winner, 4) + pad(r.min.toFixed(1), 6) + pad(r.kills, 4) + pad(r.fun, 4) : pad('-', 18)); }
function printDiff(d) {
  console.log(`\n${d.a}  ->  ${d.b}`);
  console.log(padR('match', 18) + padR('setup', 26) + pad(d.a, 18) + pad(d.b, 18) + '  flags');
  for (const r of d.rows) {
    const s = (r.b || r.a).setup;
    console.log(padR(r.key, 18) + padR(s.slice(0, 25), 26) + cell(r.a) + cell(r.b) + '  ' + r.flags.join(' '));
  }
  const t = (x) => `fun ${x.fun}, ${x.min} min, ${x.kills} kills, wins ${x.wins.join('/')}, timeouts ${x.timeouts}, errors ${x.errors}, bot errors ${x.botErrors}`;
  console.log(`\n${d.a}: ${t(d.ta)}\n${d.b}: ${t(d.tb)}`);
  const n = d.rows.filter((r) => r.flags.length && r.flags[0] !== 'NEW').length;
  console.log(n ? `${n} of ${d.rows.length} matches moved` : 'nothing moved');
}

// ---- commands -------------------------------------------------------------------------------
async function playSet(a, S, matches, onLog) {
  const jobs = Math.max(1, +a.jobs || os.cpus().length);
  const queue = matches.map((m, n) => Object.assign({ n, sampleEvery: 2 }, m, a.max ? { maxMin: +a.max } : {}));
  let next = 0;
  const out = new Array(queue.length);
  const worker = async () => {
    while (next < queue.length) {
      const i = next++;
      const job = queue[i];
      const log = await playChild(job);
      out[i] = log;
      onLog(matches[i], log, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, worker));
  return out;
}

async function run(a) {
  const S = store(a.dir);
  const matches = a.only ? MATCHES.filter((m) => keyOf(m) === a.only) : MATCHES;
  if (!matches.length) throw new Error('no match ' + a.only + ' in the set (keys: ' + MATCHES.map(keyOf).join(', ') + ')');
  const t0 = Date.now();
  let name = a.as && a.as !== true ? String(a.as) : null;
  const sum = { v: 1, patch: name, date: new Date().toISOString(), matches: {} };
  // a rerun of one match on a patch that already has a run keeps the rest
  const have = name && S.patches().includes(name) ? S.summary(name) : null;
  if (have && a.only) sum.matches = have.matches;
  console.log(`${matches.length} matches, ${Math.min(+a.jobs || os.cpus().length, matches.length)} at once`);
  await playSet(a, S, matches, (m, log) => {
    if (!name) { name = sum.patch = log.patch || 'unknown'; if (a.only && S.patches().includes(name)) Object.assign(sum.matches, S.summary(name).matches); }
    const key = keyOf(m);
    const file = S.log(name, key, log);
    const row = rowOf(m, log, file);
    sum.matches[key] = row;
    console.log(padR(key, 18) + padR(row.setup.slice(0, 25), 26) + cell(row) + (row.error ? '  ! ' + row.error.split('\n')[0] : ''));
  });
  S.keep(name, sum);
  console.log(`${matches.length} matches in ${((Date.now() - t0) / 60000).toFixed(1)} min -> ${path.join(a.dir, name)}`);
  const ps = S.patches();
  const i = ps.indexOf(name);
  if (i > 0) printDiff(diffOf(S.summary(ps[i - 1]), sum));
  else console.log('first run: nothing to compare with yet');
  console.log('page: ' + page(a));
}

function diff(a) {
  const S = store(a.dir);
  const ps = S.patches();
  const [x, y] = a._.length >= 3 ? [a._[1], a._[2]] : a._.length === 2 ? [a._[1], ps[ps.length - 1]] : ps.slice(-2);
  if (!x || !y) throw new Error('need two runs to compare (have: ' + ps.join(', ') + ')');
  if (!ps.includes(x) || !ps.includes(y)) throw new Error('no run named ' + (ps.includes(x) ? y : x) + ' (have: ' + ps.join(', ') + ')');
  printDiff(diffOf(S.summary(x), S.summary(y)));
}

function page(a) {
  const S = store(a.dir);
  const runs = S.patches().map((p) => S.summary(p));
  return writePage(S.dir, runs, ladderHistory(a.ladder), { diffOf, totals });
}

// the promise every comparison rests on: the same seed and the same files
// are the same match. Plays the set's first match twice and compares.
async function same(a) {
  const m = Object.assign({}, MATCHES[0], a.max ? { maxMin: +a.max } : {});
  console.log('playing ' + keyOf(m) + ' twice');
  const [x, y] = await Promise.all([playChild(Object.assign({ n: 0 }, m)), playChild(Object.assign({ n: 0 }, m))]);
  const strip = (l) => { const c = Object.assign({}, l); delete c.date; delete c.map; delete c.id; return JSON.stringify(c); };
  const ok = strip(x) === strip(y);
  const rx = x.result, ry = y.result;
  console.log(`run 1: ${rx.reason} W${rx.winner} ${rx.ticks} ticks fun ${x.fun.score}\nrun 2: ${ry.reason} W${ry.winner} ${ry.ticks} ticks fun ${y.fun.score}`);
  console.log(ok ? 'SAME: every sample and event matched' : 'DIFFERENT: the sim or a bot read something outside the seed');
  if (!ok) {
    const n = Math.min(x.samples.length, y.samples.length);
    for (let i = 0; i < n; i++) if (JSON.stringify(x.samples[i]) !== JSON.stringify(y.samples[i])) { console.log('first differing sample: #' + i + ' at ' + x.samples[i].t + ' s'); break; }
    process.exitCode = 1;
  }
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  a.dir = path.resolve(a.dir && a.dir !== true ? a.dir : 'regress-data');
  a.ladder = path.resolve(a.ladder && a.ladder !== true ? a.ladder : 'ladder-data');
  const cmd = a._[0];
  if (cmd === 'run') await run(a);
  else if (cmd === 'diff') diff(a);
  else if (cmd === 'page') console.log(page(a));
  else if (cmd === 'same') await same(a);
  else console.log('usage: node app/regress/regress.js run|diff|page|same  (the comment at the top of this file)');
}

if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
module.exports = { rowOf, flagsOf, diffOf, totals, FLAG_FUN, FLAG_TIME, FLAG_KILLS };
