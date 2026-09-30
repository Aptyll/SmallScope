'use strict';
// A batch of headless bot-vs-bot matches in parallel, one process each, every
// log written to a folder with a summary line per match and a table at the end.
//
//   node app/arena/run.js --seeds 1-20 --level 0 --out arena-out/normal
//   node app/arena/run.js --seeds 1-8 --level 0,1,2 --jobs 4
//   node app/arena/run.js --seeds 1-8 --kind versus --a 1 --b 0
//
// Flags: --seeds a-b or a,b,c (default 1-4); --level n[,n] (the game's sides
// at that difficulty, default 0); --kind level|versus (--a/--b: each side's
// AI_LEVELS index); --proxy n (the profile seat 0 plays in 'level', default 0);
// --shape n (MAPS index, default 0); --max min (timeout, default 40);
// --every s (sample pitch, default 2); --jobs n (default: cores); --out dir
// (default arena-out/<date>); --quiet (no per-match lines).
// The format: docs/dev/arena.md and /mnt/project-files/ai-behaviors/match-log.md.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    a[k.slice(2)] = v;
  }
  return a;
}
function parseList(s, def) {
  if (s == null || s === true) return def;
  const out = [];
  for (const part of String(s).split(',')) {
    const m = /^(\d+)-(\d+)$/.exec(part);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i);
    else if (part !== '') out.push(+part);
  }
  return out;
}

// play one match in a child process; resolves with its log (or an error log)
function playChild(opts) {
  return new Promise((resolve) => {
    const kid = spawn(process.execPath, [path.join(__dirname, 'match.js'), JSON.stringify(opts)], { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [], err = [];
    kid.stdout.on('data', (d) => out.push(d));
    kid.stderr.on('data', (d) => err.push(d));
    kid.on('close', (code) => {
      try { resolve(JSON.parse(Buffer.concat(out).toString())); } catch (e) {
        resolve({ v: 1, id: [opts.seed, opts.shape, 'crash', opts.n].join('-'), seed: opts.seed, shape: opts.shape,
          result: { winner: null, reason: 'error', time: 0, ticks: 0, error: ('exit ' + code + ': ' + Buffer.concat(err).toString()).slice(0, 2000) },
          fun: { score: 0, parts: {}, raw: {} } });
      }
    });
  });
}

// a summary line: the log without its per-sample and per-event bulk
function summaryOf(log) {
  const s = Object.assign({}, log);
  delete s.samples; delete s.events;
  return s;
}

const pad = (v, n) => String(v).padStart(n);
function line(log) {
  const r = log.result, f = log.fun, p = f.parts || {};
  const k = (log.players || []).reduce((a, q) => a + q.kills, 0);
  return [pad(log.id, 22), pad(r.reason, 7), pad(r.winner == null ? '-' : r.winner, 2), pad((r.time / 60).toFixed(1), 5),
    pad(k, 4), pad(f.score, 4), ...['close', 'swings', 'comeback', 'length', 'action', 'busy', 'spread', 'variety'].map((x) => pad(p[x] == null ? '-' : p[x].toFixed(2), 6))].join(' ');
}
const HEAD = [pad('match', 22), pad('end', 7), pad('W', 2), pad('min', 5), pad('K', 4), pad('fun', 4),
  ...['close', 'swings', 'comebk', 'length', 'action', 'busy', 'spread', 'variety'].map((x) => pad(x, 6))].join(' ');

// the mean of every number a group of logs shares, for the table's foot and aggregate.json
function aggregate(logs) {
  const ok = logs.filter((l) => l.result.reason !== 'error');
  const mean = (f) => (ok.length ? ok.reduce((a, l) => a + f(l), 0) / ok.length : 0);
  const r2 = (v) => Math.round(v * 100) / 100;
  const parts = {};
  for (const k of Object.keys((ok[0] && ok[0].fun.parts) || {})) parts[k] = r2(mean((l) => l.fun.parts[k]));
  const raw = {};
  for (const k of ['leadChanges', 'longestLull', 'idleShare', 'minutes', 'winnerWorstDeficit', 'winnerNerve']) raw[k] = r2(mean((l) => l.fun.raw[k] || 0));
  const acts = {};
  for (const k of ['fight', 'siege', 'work', 'move']) acts[k] = r2(mean((l) => (l.fun.raw.actShare || {})[k] || 0));
  return {
    matches: logs.length, errors: logs.length - ok.length,
    wins: [0, 1].map((t) => ok.filter((l) => l.result.winner === t).length),
    timeouts: ok.filter((l) => l.result.reason === 'timeout').length,
    fun: r2(mean((l) => l.fun.score)), parts, raw, acts,
    kills: r2(mean((l) => l.players.reduce((a, q) => a + q.kills, 0))),
  };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const seeds = parseList(a.seeds, [1, 2, 3, 4]);
  const kind = a.kind === 'versus' ? 'versus' : 'level';
  const levels = kind === 'level' ? parseList(a.level, [0]) : [0];
  const jobs = Math.max(1, +a.jobs || os.cpus().length);
  const out = path.resolve(a.out && a.out !== true ? a.out : path.join('arena-out', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')));
  fs.mkdirSync(out, { recursive: true });
  const queue = [];
  let n = 0;
  for (const level of levels) for (const seed of seeds) {
    queue.push({ seed, level, kind, a: +a.a || 0, b: +a.b || 0, proxy: +a.proxy || 0, shape: +a.shape || 0,
      maxMin: +a.max || 40, sampleEvery: +a.every || 2, n: n++ });
  }
  const t0 = Date.now();
  const logs = [];
  if (!a.quiet) console.log(HEAD);
  const summary = fs.createWriteStream(path.join(out, 'summary.jsonl'));
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const job = queue[next++];
      const log = await playChild(job);
      fs.writeFileSync(path.join(out, log.id + '.json'), JSON.stringify(log));
      summary.write(JSON.stringify(summaryOf(log)) + '\n');
      logs.push(log);
      if (!a.quiet) console.log(line(log) + (log.result.error ? '  ! ' + log.result.error.split('\n')[0] : ''));
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, worker));
  summary.end();
  // one aggregate per setup, so a sweep over levels reads as rows
  const groups = {};
  for (const l of logs) {
    const key = !l.setup ? 'crash' : l.setup.kind === 'level' ? l.setup.levelName : l.setup.a + ' v ' + l.setup.b;
    (groups[key] = groups[key] || []).push(l);
  }
  const agg = {};
  for (const k in groups) agg[k] = aggregate(groups[k]);
  fs.writeFileSync(path.join(out, 'aggregate.json'), JSON.stringify(agg, null, 2));
  console.log('\n' + Object.entries(agg).map(([k, g]) => `${k}: ${g.matches} matches, fun ${g.fun}, ` +
    `wins ${g.wins.join('/')}, timeouts ${g.timeouts}, errors ${g.errors}, ${g.raw.minutes} min, ${g.kills} kills`).join('\n'));
  console.log(`${logs.length} matches in ${((Date.now() - t0) / 60000).toFixed(1)} min -> ${out}`);
}

if (require.main === module) main();
module.exports = { playChild, aggregate, summaryOf };
