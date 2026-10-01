'use strict';
// The offline bot ladder: bot files play rated matches against each other on
// this computer, through the arena's headless runner (app/arena/), and every
// match is kept - its record, its full log, the ratings before and after.
//
//   node app/ladder/ladder.js add path/to/mybot.js [--id mybot]   # enter a bot file
//   node app/ladder/ladder.js run [--matches 10] [--jobs 4] [--max 30]
//   node app/ladder/ladder.js table                                # the standings
//   node app/ladder/ladder.js page                                 # write ladder.html
//   node app/ladder/ladder.js retire mybot                         # stop scheduling an entry
//
// Every command takes --dir (default ladder-data/ in the repo, gitignored).
// The example bots in bots/ are always entered. One entry = one bot file
// playing all five seats of a side; a changed file keeps its rating and
// counts a new revision. The rules (pairing, Elo, the record) are core.js;
// the author's guide is docs/bots/ladder.md. No packages.
//
// TRUST: a bot file runs inside the match process with this computer's
// rights (the arena runs it in a Node vm context: sealed from the game, not a hardened jail). Enter only files you trust; an online
// ladder runs each bot in its own sandboxed process instead (docs/bots/ladder.md).

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const core = require('./core');
const { writePage } = require('./page');

const ROOT = path.join(__dirname, '..', '..');

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) { a._.push(k); continue; }
    a[k.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return a;
}
const hashOf = (src) => crypto.createHash('sha1').update(src).digest('hex').slice(0, 10);
// the label a file gives itself in defineBot (botLibAdd reads it the same way)
function metaOf(src) {
  const f = (k) => { const m = new RegExp(k + '\\s*:\\s*[\'"`]([^\'"`]{1,40})[\'"`]').exec(src); return m ? m[1] : ''; };
  return { name: f('name'), author: f('author'), version: f('version') };
}
// how many map shapes the game has (MAPS, js/world.js), read off the source
function shapeCount() {
  const s = fs.readFileSync(path.join(ROOT, 'js', 'world.js'), 'utf8');
  const i = s.indexOf('const MAPS = ['), j = s.indexOf('\n];', i);
  return Math.max(1, (s.slice(i, j).match(/^\s*\{ name: /gm) || []).length);
}

// ---- the store: a folder of plain files ---------------------------------------------
function store(dir) {
  const P = (...p) => path.join(dir, ...p);
  fs.mkdirSync(P('bots'), { recursive: true });
  fs.mkdirSync(P('logs'), { recursive: true });
  return {
    dir,
    load() {
      try { return JSON.parse(fs.readFileSync(P('ladder.json'), 'utf8')); } catch (e) { return { v: 1, n: 0, entries: {} }; }
    },
    save(ladder) { fs.writeFileSync(P('ladder.json'), JSON.stringify(ladder, null, 1)); },
    history() {
      try { return fs.readFileSync(P('history.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (e) { return []; }
    },
    record(rec, log) {
      fs.writeFileSync(P('logs', rec.id + '.json'), JSON.stringify(log));
      fs.appendFileSync(P('history.jsonl'), JSON.stringify(rec) + '\n');
    },
    botPath(id) { return P('bots', id + '.js'); },
    // every bot file this ladder plays: the examples, then the entered files
    sources() {
      const out = {};
      const ex = path.join(ROOT, 'bots');
      const take = (d, f, from) => { const id = f.slice(0, -3); if (f.endsWith('.js') && core.idOk(id)) out[id] = { src: fs.readFileSync(path.join(d, f), 'utf8'), from }; };
      for (const f of fs.readdirSync(ex)) take(ex, f, 'builtin');
      for (const f of fs.readdirSync(P('bots'))) take(P('bots'), f, 'file');
      return out;
    },
  };
}
// bring the entries in line with the files: new files enter, changed files
// count a revision and keep their rating, and an entry whose file is gone is
// marked missing (kept, never scheduled) until the file comes back
function sync(ladder, sources) {
  for (const [id, { src, from }] of Object.entries(sources)) {
    const h = hashOf(src), meta = metaOf(src), e = Object.hasOwn(ladder.entries, id) ? ladder.entries[id] : null;
    if (!e) ladder.entries[id] = core.newEntry(id, Object.assign({ hash: h, from }, meta, { name: meta.name || id }));
    else if (e.hash !== h) Object.assign(e, meta, { name: meta.name || id, hash: h, rev: e.rev + 1 });
  }
  for (const id of Object.keys(ladder.entries)) {
    if (Object.hasOwn(sources, id)) delete ladder.entries[id].missing;
    else ladder.entries[id].missing = true;
  }
}

// ---- commands ----------------------------------------------------------------------
function cmdAdd(S, args) {
  const file = args._[1];
  if (!file || !fs.existsSync(file)) throw new Error('add: give a bot file, e.g. node app/ladder/ladder.js add mybot.js');
  const src = fs.readFileSync(file, 'utf8');
  if (!/defineBot\s*\(/.test(src)) throw new Error('add: ' + file + ' never calls defineBot({ ... })');
  const id = String(args.id || path.basename(file, '.js')).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!core.idOk(id)) throw new Error('add: "' + id + '" is not a usable id; pass --id');
  const had = S.sources()[id];
  if (had && had.src !== src && !args.replace) {
    throw new Error('add: ' + id + ' is already on the ladder (' + (had.from === 'builtin' ? 'an example bot' : 'an entered file') +
      '); pass --replace to make this its next revision, or --id to enter it as a new bot');
  }
  fs.writeFileSync(S.botPath(id), src);
  const ladder = S.load();
  const was = Object.hasOwn(ladder.entries, id);
  sync(ladder, S.sources());
  S.save(ladder);
  const e = ladder.entries[id];
  console.log((was ? 'updated ' : 'entered ') + id + ' (' + e.name + ' rev ' + e.rev + ', rating ' + e.rating + ')');
}
function cmdRetire(S, args) {
  const ladder = S.load(), e = Object.hasOwn(ladder.entries, args._[1]) ? ladder.entries[args._[1]] : null;
  if (!e) throw new Error('retire: no entry ' + args._[1]);
  e.retired = !args.undo;
  S.save(ladder);
  console.log((e.retired ? 'retired ' : 'back on the ladder: ') + e.id);
}
function cmdTable(S) {
  const rows = core.standings(S.load(), S.history());
  const pad = (v, n) => String(v == null ? '-' : v).padStart(n);
  console.log('  #  bot              rating  games   W   L   D  win%  fun  min  k/d  errors');
  rows.forEach((r, i) => console.log(pad(i + 1, 3) + '  ' + String(r.id + (r.retired ? '*' : '')).padEnd(16) + pad(r.rating, 7) + pad(r.games, 7) +
    pad(r.w, 4) + pad(r.l, 4) + pad(r.d, 4) + pad(r.winPct, 6) + pad(r.fun, 5) + pad(r.avgMin, 5) + pad(r.kd, 5) + pad(r.errors || 0, 8)));
}
async function cmdRun(S, args) {
  const { playChild } = require('../arena/run'); // the match runner (docs/dev/arena.md)
  const total = Math.max(1, +args.matches || 4);
  const jobs = Math.max(1, Math.min(+args.jobs || os.cpus().length, total));
  const maxMin = +args.max || 30;
  const shapes = shapeCount();
  let ladder = S.load();
  const sources = S.sources();
  sync(ladder, sources);
  if (Object.values(ladder.entries).filter((e) => !e.retired).length < 2) console.log('(one entry: it plays itself, unrated)');
  // schedule the whole batch up front from today's ratings, so the plan is a
  // pure function of the ladder; results are folded in in plan order, however
  // the matches finish, so --jobs never changes a rating
  const plan = core.pairings(ladder, total, shapes);
  ladder.n += plan.length;
  S.save(ladder);
  console.log('playing ' + plan.length + ' matches, ' + jobs + ' at a time, up to ' + maxMin + ' min each');
  let next = 0, folded = 0;
  const done = [];
  const fold = () => {
    for (; folded < plan.length && done[folded]; folded++) {
      const m = plan[folded], { log, secs } = done[folded];
      ladder = S.load();
      const rec = core.applyResult(ladder, m, log, 'logs/' + m.id + '.json');
      S.save(ladder);
      S.record(rec, log);
      done[folded] = true; // the log is written: let it go
      const win = rec.winner ? rec.winner + ' wins' : rec.reason === 'error' ? 'ERROR ' + String(rec.error).slice(0, 80) : 'draw';
      console.log(m.id + '  ' + m.team0 + ' vs ' + m.team1 + '  ' + win + ' (' + rec.reason + ', ' + Math.round(rec.time / 60) + ' min, fun ' + rec.fun + ')  '
        + rec.team0.id + ' ' + rec.team0.before + '->' + rec.team0.after + ', ' + rec.team1.id + ' ' + rec.team1.before + '->' + rec.team1.after
        + '  [' + secs + ' s]');
    }
  };
  const worker = async () => {
    while (next < plan.length) {
      const k = next++, m = plan[k];
      const bots = { [m.team0]: sources[m.team0].src, [m.team1]: sources[m.team1].src };
      const t0 = Date.now();
      const log = await playChild({ seed: m.seed, shape: m.shape, maxMin, n: m.n, bots, seats: core.seatsOf(m) });
      log.setup = Object.assign({}, log.setup, { kind: 'ladder', a: m.team0, b: m.team1 });
      done[k] = { log, secs: Math.round((Date.now() - t0) / 1000) };
      fold();
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  cmdTable(S);
  console.log('page: ' + writePage(S.dir, S.load(), S.history()));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const S = store(path.resolve(args.dir || path.join(ROOT, 'ladder-data')));
  const cmd = args._[0] || 'table';
  if (cmd === 'add') cmdAdd(S, args);
  else if (cmd === 'retire') cmdRetire(S, args);
  else if (cmd === 'table') { const L = S.load(); sync(L, S.sources()); S.save(L); cmdTable(S); }
  else if (cmd === 'run') await cmdRun(S, args);
  else if (cmd === 'page') { const L = S.load(); sync(L, S.sources()); S.save(L); console.log(writePage(S.dir, L, S.history())); }
  else throw new Error('commands: add, run, table, page, retire');
}
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { store, sync, metaOf, hashOf };
