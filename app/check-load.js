// The load check: one host and nine headless players through the relay, on a
// staged busy match, and the numbers a full room costs the host. It serves the
// game itself (app/server.js on CHECK_PORT) and drives Chromium through
// Playwright, which the repo does not install: `PLAYWRIGHT=<path to the
// package>` points at one, else `playwright` is required as usual.
//   node app/check-load.js          9 players, exit 1 on any failure
//   N=4 node app/check-load.js      fewer players (a quicker look)
//
// The match is STAGED, not played to: every seat goes to a bot, the host runs
// at FAST times speed until the first wave has left the bays (FIRST_WAVE_S of
// match clock), then each barracks queues WAVES more at once, so the lanes are
// full from the first measured second. The players run only the net step (no drawing),
// so ten pages fit on one machine. Three windows: a clean wire; the host
// throwing away LOSS of its snapshot sends (DBG.netLoss), which the ack-keyed
// ring must ride without a full resync; and the host riding its full form
// along (DBG.netVerify), so every player checks itself against it. The proof
// window counts no bytes, times or resyncs: nine copies of the whole match
// every VERIFY_EVERY steps is its own load, not the game's.
//
// Times are this machine's, all ten pages sharing it: they are printed, and
// fail only far past what a host can carry. Bytes and correctness fail hard.
const path = require('path');
const { spawn } = require('child_process');

const CHECK_PORT = 8478;     // its own port: the game on 8471 and check-join's 8479 are left alone
const PLAYERS = +(process.env.N || 9);
const SEED = 42;
const FIRST_WAVE_S = 62;     // s of match clock the staging runs to: the merchants' bays stand and the first wave is out
const FAST = 4;              // steps per frame while staging
const WAVES = 1;             // extra waves each barracks queues at once (the staging): a lane that was not cleared
const CLEAN_S = 25, LOSSY_S = 20, VERIFY_S = 20; // the three windows, s
const LOSS = 0.05;           // share of the host's snapshot sends thrown away in the second
const DELTA_MAX = 16 * 1193; // bytes: Steam's unreliable channel carries a delta in 16 parts of 1193 at most (STEAM_LOSSY_PARTS); past it, it goes reliable
const FLUSH_P95_MAX = 40;    // ms: the host's flush step, far past a dropped frame on this shared machine
const APPLY_SHARE = 0.8;     // of the deltas a window should bring, each player must have taken at least this share

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { } }
  console.error('check-load: no Playwright (npm i -g playwright, or PLAYWRIGHT=<its folder>)'); process.exit(2);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the host's meters: the flush step's time, every other step's (the sweep),
// the sim's, and the bytes of each delta and full sync sent. A DBG.netVerify
// step carries the whole match beside its delta, so it is kept apart
function hostMeters() {
  const M = window.__load = { flush: [], between: [], sim: [], delta: [], full: [], verify: 0 };
  const fl = window.netHostFlush;
  window.netHostFlush = function () {
    const flushStep = NET.role === 'host' && NET.peers.size && state.tick % SNAP_EVERY === 0;
    M.inVerify = flushStep && NET.verify && state.tick % VERIFY_EVERY === 0;
    const t = performance.now(); fl(); const dt = performance.now() - t;
    if (M.inVerify) M.verify++; else (flushStep ? M.flush : M.between).push(dt);
    M.inVerify = false;
  };
  const up = window.updatePlay;
  window.updatePlay = function () { const t = performance.now(); const r = up.apply(this, arguments); M.sim.push(performance.now() - t); return r; };
  const tr = NET.transport, send = tr.send.bind(tr);
  tr.send = (peer, msg, lossy) => { if (msg instanceof Uint8Array && !M.inVerify) (lossy ? M.delta : M.full).push(msg.length); return send(peer, msg, lossy); };
}
function hostRead() {
  const M = window.__load, s = DBG.netStatus();
  const q = (a, f) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return +b[Math.floor(f * (b.length - 1))].toFixed(2); };
  const avg = (a) => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : 0;
  const out = {
    elapsed: state.elapsed | 0, soldiers: robots.length, peers: s.peers.length, flushes: M.flush.length + M.verify,
    simAvg: avg(M.sim), flush50: q(M.flush, 0.5), flush95: q(M.flush, 0.95), betweenAvg: avg(M.between),
    netPerStep: +((avg(M.flush) + avg(M.between) * (SNAP_EVERY - 1)) / SNAP_EVERY).toFixed(2),
    delta50: q(M.delta, 0.5), delta95: q(M.delta, 0.95), deltaMax: q(M.delta, 1), fulls: M.full.length,
    uploadKBs: 0, tileLate: s.tileLate, tileLateBy: s.tileLateBy,
  };
  for (const k of ['flush', 'between', 'sim', 'delta', 'full']) M[k] = [];
  M.verify = 0;
  return out;
}
function clientRead() {
  const s = DBG.netStatus(), n = window.__applied || 0; window.__applied = 0;
  return { applied: n, verifyFail: s.verifyFail, refused: s.refused, synced: NET.synced };
}

async function window_(host, clients, secs, label, bad) {
  const proof = label === 'verify';
  await sleep(secs * 1000);
  const h = await host.evaluate(hostRead);
  h.uploadKBs = Math.round(h.delta50 * 15 * h.peers / 1000);
  const cs = await Promise.all(clients.map((c) => c.evaluate(clientRead)));
  const want = h.flushes * (label === 'lossy' ? 1 - LOSS : 1); // the deltas sent each player, less the share thrown away
  console.log(label.padEnd(6), JSON.stringify(h));
  console.log(''.padEnd(6), 'players applied', cs.map((c) => c.applied).join(' '), 'of ~' + Math.round(want));
  const fail = (why) => { bad.push(label + ': ' + why); };
  if (h.peers !== PLAYERS) fail(h.peers + ' of ' + PLAYERS + ' players seated');
  if (h.tileLate) fail('tiles changed without a mark: ' + JSON.stringify(h.tileLateBy));
  if (!proof) {
    if (h.deltaMax > DELTA_MAX) fail('a delta of ' + h.deltaMax + ' bytes (max ' + DELTA_MAX + ')');
    if (h.fulls) fail(h.fulls + ' full resyncs');
    if (h.flush95 > FLUSH_P95_MAX) fail('host flush p95 ' + h.flush95 + ' ms');
  }
  cs.forEach((c, i) => {
    if (c.refused || !c.synced) fail('player ' + (i + 1) + ' ' + (c.refused || 'not synced'));
    if (!proof && c.applied < want * APPLY_SHARE) fail('player ' + (i + 1) + ' applied ' + c.applied);
    if (c.verifyFail) fail('player ' + (i + 1) + ' disagrees with the host: ' + JSON.stringify(c.verifyFail));
  });
}

(async () => {
  const { chromium } = loadPlaywright();
  const server = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env: Object.assign({}, process.env, { PORT: String(CHECK_PORT) }), stdio: 'ignore' });
  await sleep(800);
  const opts = process.env.PLAYWRIGHT_BROWSERS_PATH && require('fs').existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const browser = await chromium.launch(opts);
  const bad = [], errs = [];
  try {
    const base = 'http://localhost:' + CHECK_PORT + '/index.html?seed=' + SEED;
    const host = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    host.on('pageerror', (e) => errs.push('host: ' + e.message));
    await host.goto(base + '&net=host&room=LOAD');
    await host.waitForFunction(() => window.DBG && NET.transport && NET.transport.open, null, { timeout: 15000 });
    const clients = [];
    for (let i = 0; i < PLAYERS; i++) {
      const c = await browser.newPage({ viewport: { width: 640, height: 360 } });
      c.on('pageerror', (e) => errs.push('player ' + (i + 1) + ': ' + e.message));
      await c.goto(base + '&net=client&room=LOAD');
      await c.waitForFunction(() => window.DBG && NET.welcomed, null, { timeout: 15000 });
      // the net step alone, no drawing: update() on a client sends the input,
      // drains the wire and applies (netClientStep)
      await c.evaluate(() => {
        DBG.freeze = true; window.__applied = 0;
        const a = window.netClientApplyDelta; window.netClientApplyDelta = function () { window.__applied++; return a.apply(this, arguments); };
        setInterval(() => update(1 / 60), 16);
      });
      clients.push(c);
    }
    await host.evaluate(hostMeters);
    await host.evaluate(() => { for (const p of players) DBG.setControl(p.id, 'ai'); DBG.hideUI = true; DBG.startGame(); });
    // the staging: FAST steps a frame (the players keep up: a delta per flush
    // step, so FAST times the rate) until the first wave is out
    await host.evaluate(([fast, until]) => new Promise((done) => {
      DBG.freeze = true;
      const t = setInterval(() => { DBG.step(1 / 60, fast); if (state.elapsed >= until) { clearInterval(t); DBG.freeze = false; done(); } }, 16);
    }), [FAST, FIRST_WAVE_S]);
    const bays = await host.evaluate((w) => { let n = 0; for (const o of structures) if (o.type === 'barracks' && !o.building) { o.queue += w * barracksWave(o); n++; } return n; }, WAVES);
    if (!bays) bad.push('staging: no barracks stood at ' + FIRST_WAVE_S + ' s');
    await sleep(4000);
    await host.evaluate(hostRead); await Promise.all(clients.map((c) => c.evaluate(clientRead))); // the meters start clean
    await window_(host, clients, CLEAN_S, 'clean', bad);
    await host.evaluate((f) => DBG.netLoss(f), LOSS);
    await window_(host, clients, LOSSY_S, 'lossy', bad);
    await host.evaluate(() => { DBG.netLoss(0); DBG.netVerify(true); });
    await window_(host, clients, VERIFY_S, 'verify', bad);
  } catch (e) { bad.push('threw: ' + e.message.split('\n')[0]); }
  for (const e of errs) bad.push(e);
  await browser.close(); server.kill();
  console.log(bad.length ? 'FAIL\n  ' + bad.join('\n  ') : 'ok   ' + PLAYERS + ' players');
  process.exit(bad.length ? 1 : 0);
})();
