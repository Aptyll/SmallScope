// The refactor check: proves this tree plays exactly like another commit
// (origin/main by default). Both trees are served side by side and played in
// headless Chromium on the same seeds, every seat a bot, the page frozen from
// its first frame and its clock and Math.random faked, so the two runs can
// only part if the code does something different. Every CHUNK ticks it
// compares the sim (DBG.saveHash) and the pixels (the canvas hashed in a few
// views: plain, hitboxes and paths, the map, a shake, the cursor, no HUD).
// It plays the base's first seed twice, so a check that cannot judge says so.
// Playwright is not in the repo: `PLAYWRIGHT=<path to the package>` points at
// one, else `playwright` is required as usual.
//
//   node app/check-same.js                 this tree (uncommitted edits too) vs origin/main
//   node app/check-same.js <ref>           vs another commit or branch
//     --seeds 7,3,11   the match seeds (default 7,3,11), plus the practice map unless --no-practice
//     --min 8          match minutes played per seed
//     --drop a,b       state keys the change adds or removes: left out of both hashes
//     --scene <file>   a staged scene for a path bots rarely take (below), run on both trees
//
// Exit 0 SAME, 1 DIFFERENT (with the first tick, the save sections and the
// fields that parted), 2 cannot judge (the base differs from itself, or a
// page threw). A pixel-only difference is a draw change; a sim one is a
// behaviour change.
//
// A scene file is the body of a function run in the page once the match is on
// the field (the drop and brief done), with `D` (window.DBG) and `mark(tag)`,
// which records the sim hash and the plain frame under that tag, and `step(n)`,
// which runs n ticks with the faked clock moving. Drive a seat no screen
// samples (the local `player` has its input overwritten each tick):
//   const p = players.find((q) => q !== player && q.team === player.team);
//   p.control = 'human'; p.input.mx = 1; step(90); mark('walked');
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHUNK = 600;              // ticks between comparisons: 10 s of match
const PRACTICE_SEED = 'practice';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { } }
  console.error('check-same: no Playwright (npm i -g playwright, or PLAYWRIGHT=<its folder>)'); process.exit(2);
}

function parseArgs(argv) {
  const a = { ref: 'origin/main', seeds: ['7', '3', '11'], min: 8, drop: [], scene: null, practice: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--seeds') a.seeds = argv[++i].split(',').filter(Boolean);
    else if (k === '--min') a.min = +argv[++i];
    else if (k === '--drop') a.drop = argv[++i].split(',').filter(Boolean);
    else if (k === '--scene') a.scene = fs.readFileSync(path.resolve(argv[++i]), 'utf8');
    else if (k === '--no-practice') a.practice = false;
    else if (k.startsWith('--')) { console.error('check-same: unknown flag ' + k + ' (the comment at the top of app/check-same.js)'); process.exit(2); }
    else a.ref = k;
  }
  a.chunks = Math.max(1, Math.round(a.min * 60 * 60 / CHUNK));
  return a;
}

// the base commit's files, written out whole into a temp folder (no worktree to clean up)
function exportRef(ref) {
  const sha = execFileSync('git', ['rev-parse', '--verify', ref + '^{commit}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-same-'));
  execFileSync('sh', ['-c', 'git archive "$1" | tar -x -C "$2"', 'sh', sha, dir], { cwd: ROOT });
  return { sha, dir };
}

// a plain static server on a free port: each tree served as itself, nothing rewritten
function serve(root) {
  return new Promise((done) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(root, path.normalize(rel));
      if (!file.startsWith(root)) { res.writeHead(400); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => done({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}

// Runs before any game script: a seeded Math.random (a fresh profile rolls a
// random name), a clock that moves only when the check moves it, and
// window.DBG frozen the moment boot.js sets it, so no rAF frame ever steps
function initScript() {
  let r = 12345;
  Math.random = () => ((r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 4294967296);
  window.__checkT = 1000;
  performance.now = () => window.__checkT;
  Date.now = () => 1767225600000 + window.__checkT;
  let d;
  Object.defineProperty(window, 'DBG', { configurable: true, get: () => d, set: (v) => { v.freeze = true; d = v; } });
}

// in the page: play the match and fingerprint it. `upTo` stops early and hands
// back the whole save body there (the why, after a sim difference)
function playInPage({ chunks, CHUNK, drop, scene, upTo }) {
  const D = window.DBG, cv = document.getElementById('game');
  const without = (f) => { // the dropped state keys out of the way for one read
    const kept = {};
    for (const k of drop) if (k in state) { kept[k] = state[k]; delete state[k]; }
    try { return f(); } finally { Object.assign(state, kept); }
  };
  const simHash = () => without(() => { const h = D.saveHash(); return h.hash + ':' + h.len; });
  const sections = () => without(() => {
    const b = D.saveCapture().body, o = {};
    for (const k of Object.keys(b)) o[k] = JSON.stringify(b[k]).length + ':' + fnv(JSON.stringify(b[k]));
    return o;
  });
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
  const pxHash = () => {
    let h = 0x811c9dc5;
    for (const c of [cv, worldCv]) {
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i], 16777619);
    }
    return (h >>> 0).toString(16);
  };
  const shot = () => { render(); return pxHash(); };
  const views = () => {
    const v = { plain: shot() };
    window.__checkT += 7;
    settings.hitbox = 2; D.showPaths = true; v.hit = shot(); settings.hitbox = 0; D.showPaths = false;
    state.mapOpen = true; v.map = shot(); state.mapOpen = false;
    const sk = settings.shake; settings.shake = true; state.shake = 3; v.shake = shot(); state.shake = 0; settings.shake = sk;
    mouse.inside = true; mouse.x = VIEW_W / 2 + 10; mouse.y = VIEW_H / 2 - 6; v.mouse = shot(); mouse.inside = false;
    D.hideUI = true; v.clean = shot(); D.hideUI = false;
    return v;
  };
  const step = (n) => { for (let i = 0; i < n; i += 60) { const k = Math.min(60, n - i); window.__checkT += k * 1000 / 60; D.step(1 / 60, k); } };
  if (PRACTICE) saveBaseline(); // boot skips it there (practice is never saved); the hash reads against it
  const rows = [{ tag: 'title', tick: state.tick, sim: simHash(), px: views() }];
  if (upTo === state.tick) return { body: without(() => D.saveCapture().body) };
  if (!PRACTICE) D.startGame();
  if (scene) {
    for (let i = 0; i < 6000 && (state.mode !== 'play' || state.dropBrief); i++) step(1);
    rows.push({ tag: 'field', tick: state.tick, sim: simHash(), px: views() });
    const mark = (tag) => rows.push({ tag, tick: state.tick, sim: simHash(), px: { plain: shot() } });
    new Function('D', 'mark', 'step', scene)(D, mark, step);
    return { rows, mode: state.mode };
  }
  for (let c = 0; c < chunks; c++) {
    for (const p of players) if (!PRACTICE || p === player) p.control = 'ai'; // practice keeps its empty seats: one bot on the field
    step(CHUNK);
    if (upTo != null && state.tick >= upTo) return { body: without(() => D.saveCapture().body) };
    rows.push({ tag: 'chunk', tick: state.tick, sim: simHash(), secs: sections(), px: views() });
  }
  return { rows, mode: state.mode };
}

async function play(browser, base, seed, a, upTo) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  await pg.addInitScript(initScript);
  const q = seed === PRACTICE_SEED ? '?practice=1' : '?seed=' + seed;
  try {
    await pg.goto(base + '/index.html' + q);
    await pg.waitForFunction(() => window.DBG && window.DBG.startGame, null, { timeout: 60000 });
    const out = await pg.evaluate(playInPage, { chunks: a.chunks, CHUNK, drop: a.drop, scene: a.scene, upTo });
    return Object.assign(out, { errors });
  } catch (e) {
    return { rows: [], errors: errors.concat(String(e.message || e).split('\n')[0]) };
  } finally { await ctx.close(); }
}

// the first fields where two save bodies part, as paths (players[3].hp)
function partings(x, y, at, out) {
  if (out.length >= 8) return out;
  if (JSON.stringify(x) === JSON.stringify(y)) return out;
  if (x && y && typeof x === 'object' && typeof y === 'object' && Array.isArray(x) === Array.isArray(y)) {
    const keys = [...new Set(Object.keys(x).concat(Object.keys(y)))];
    for (const k of keys) partings(x[k], y[k], Array.isArray(x) ? `${at}[${k}]` : at ? `${at}.${k}` : k, out);
    return out;
  }
  const show = (v) => { const s = JSON.stringify(v); return s === undefined ? 'missing' : s.length > 40 ? s.slice(0, 37) + '...' : s; };
  out.push(`${at}: ${show(x)} -> ${show(y)}`);
  return out;
}

function compare(b, t) {
  const n = Math.min(b.rows.length, t.rows.length);
  let sim = null, px = null;
  for (let i = 0; i < n && !sim; i++) if (b.rows[i].sim !== t.rows[i].sim) sim = { i, row: b.rows[i] };
  for (let i = 0; i < n && !px; i++) {
    const views = Object.keys(b.rows[i].px).filter((v) => b.rows[i].px[v] !== t.rows[i].px[v]);
    if (views.length) px = { i, row: b.rows[i], views };
  }
  const short = b.rows.length !== t.rows.length;
  if (short && !sim) sim = { i: n, row: { tag: 'end', tick: '?' } };
  return { sim, px, n };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const { chromium } = loadPlaywright();
  const { sha, dir } = exportRef(a.ref);
  const [B, T] = await Promise.all([serve(dir), serve(ROOT)]);
  const browser = await chromium.launch();
  const seeds = a.scene ? a.seeds.slice(0, 1) : a.seeds.concat(a.practice ? [PRACTICE_SEED] : []);
  const what = a.scene ? 'a staged scene' : `${a.min} match min per seed, compared every ${CHUNK / 60} s`;
  console.log(`check-same: this tree vs ${a.ref} (${sha.slice(0, 7)}), seeds ${seeds.join(' ')}, ${what}`);
  let code = 0;
  try {
    const jobs = [];
    for (const s of seeds) jobs.push(['base', s], ['this', s]);
    jobs.push(['again', seeds[0]]);
    const limit = Math.max(1, os.cpus().length - 1);
    const res = {};
    let next = 0;
    const worker = async () => { while (next < jobs.length) { const [who, s] = jobs[next++]; res[who + ' ' + s] = await play(browser, who === 'this' ? T.url : B.url, s, a); } };
    await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));

    const errs = Object.entries(res).filter(([, r]) => r.errors.length);
    const again = compare(res['base ' + seeds[0]], res['again ' + seeds[0]]);
    if (again.sim || again.px) { console.log(`CANNOT JUDGE: ${a.ref} played seed ${seeds[0]} twice and parted (${again.sim ? 'sim' : 'pixels'} at tick ${(again.sim || again.px).row.tick}): something outside the seed leaks in`); code = 2; }
    let firstSim = null;
    for (const s of seeds) {
      const b = res['base ' + s], t = res['this ' + s];
      const c = compare(b, t);
      const ticks = b.rows.length ? b.rows[b.rows.length - 1].tick : 0;
      const simTxt = c.sim ? `sim DIFFERS from tick ${c.sim.row.tick} (${c.sim.row.tag})` : `sim same`;
      const pxTxt = c.px ? `pixels DIFFER from tick ${c.px.row.tick} (${c.px.views.join(', ')})` : `pixels same`;
      console.log(`  seed ${s.padEnd(9)} ${simTxt.padEnd(42)} ${pxTxt}   ${c.n} checks to tick ${ticks}, ends in ${b.mode}`);
      if (c.sim || c.px) code = code || 1;
      const moved = new Set(b.rows.filter((r) => r.tag === 'chunk').map((r) => r.sim)).size;
      if (!a.scene && b.rows.length > 2 && moved < 2) { console.log(`  CANNOT JUDGE seed ${s}: its match never moved`); code = 2; }
      if (c.sim && (c.sim.row.tag === 'chunk' || c.sim.row.tag === 'title') && !firstSim) {
        const sb = b.rows[c.sim.i].secs || {}, st = t.rows[c.sim.i].secs || {};
        const secs = Object.keys(Object.assign({}, sb, st)).filter((k) => sb[k] !== st[k]);
        firstSim = { s, tick: c.sim.row.tick, secs };
      }
    }
    if (firstSim) {
      console.log(`  first parting, seed ${firstSim.s} at tick ${firstSim.tick}` + (firstSim.secs.length ? `: save sections ${firstSim.secs.join(', ')}` : ''));
      const [bb, tb] = await Promise.all([play(browser, B.url, firstSim.s, a, firstSim.tick), play(browser, T.url, firstSim.s, a, firstSim.tick)]);
      if (bb.body && tb.body) for (const line of partings(bb.body, tb.body, '', [])) console.log('    ' + line);
    }
    for (const [k, r] of errs) { console.log(`  page error on ${k}: ${r.errors.slice(0, 3).join(' | ')}`); code = 2; }
    console.log(code === 0 ? 'SAME: no behaviour and no pixel changed' : code === 1 ? 'DIFFERENT: see above (pixels only = a draw change; sim = behaviour)' : 'CANNOT JUDGE: see above');
  } finally {
    await browser.close();
    B.srv.close(); T.srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  process.exit(code);
}

main().catch((e) => { console.error('check-same: ' + (e.stack || e)); process.exit(2); });
