// The join check: two headless pages meet through every way a friend joins a
// party, and each must end WELCOMED with its page still drawing. It serves the
// game itself (app/server.js on CHECK_PORT) and drives Chromium through
// Playwright, which the repo does not install: `PLAYWRIGHT=<path to the
// package>` points at one, else `playwright` is required as usual.
//   node app/check-join.js          every path, exit 1 on any failure
//   node app/check-join.js steam-code   one path (relay-code, steam-code, steam-invite)
//
// The Steam paths run against a FAKE Steam: one lobby-and-packet world in this
// process, handed to each page as `window.steamBridge` with the calls and
// event shapes desktop/main.js + preload.js give the real one (a lobby id is an
// 18-digit string, binary frames lead with STEAM_MAGIC). It proves the page's
// side of the wire; Steam itself still needs two machines.
const path = require('path');
const { spawn } = require('child_process');

const CHECK_PORT = 8479;       // its own port, so a game already served on 8471 is left alone
const JOIN_WAIT = 15;          // s a guest has to be welcomed
const PATHS = ['relay-code', 'steam-code', 'steam-invite'];

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { } }
  console.error('check-join: no Playwright (npm i -g playwright, or PLAYWRIGHT=<its folder>)'); process.exit(2);
}

// ---- the fake Steam -------------------------------------------------------
function fakeSteam() {
  const W = { lobbies: new Map(), users: new Map(), next: 109775240000000001n };
  const info = (l) => ({ id: l.id, owner: l.owner, members: [...l.members], data: Object.assign({}, l.data) });
  const chat = (l, user, change) => { for (const m of l.members) { const u = W.users.get(m); if (u) u.events.push({ t: 'chat', lobby: l.id, user, change }); } };
  async function attach(page, uid, name) {
    const u = { events: [], packets: [] };
    W.users.set(uid, u);
    await page.exposeBinding('__steam', (src, method, a) => {
      const l = a && a[0] != null ? W.lobbies.get(String(a[0])) : null;
      switch (method) {
        case 'info': return { ready: true, error: null, appId: 480, id: uid, name };
        case 'createLobby': { const id = String(W.next++), n = { id, owner: uid, members: new Set([uid]), data: {} }; W.lobbies.set(id, n); return info(n); }
        case 'joinLobby': if (!l) throw new Error('no lobby'); if (!l.members.has(uid)) { l.members.add(uid); chat(l, uid, 1); } return info(l);
        case 'leaveLobby':
          if (l && l.members.delete(uid)) { chat(l, uid, 2); if (!l.members.size) W.lobbies.delete(l.id); else if (l.owner === uid) l.owner = [...l.members][0]; }
          return true;
        case 'lobby': return l ? info(l) : null;
        case 'lobbies': return [...W.lobbies.values()].map((q) => Object.assign(info(q), { owner: '0' })); // a list sees no owner, as Steam's does
        case 'setLobbyData': if (!l) return false; Object.assign(l.data, a[1]); return true;
        case 'send': {
          const to = W.users.get(String(a[0])); if (!to) return false;
          const d = a[1];
          if (typeof d === 'string') to.packets.push({ from: uid, text: d });
          else if (d.first === 0xB1) to.packets.push({ from: uid, b64: d.b64 });
          else to.packets.push({ from: uid, text: Buffer.from(d.b64, 'base64').toString('utf8') });
          return true;
        }
        case 'drain': { const out = { ev: u.events, pk: u.packets.splice(0, 64) }; u.events = []; return out; }
        default: return true; // invite, log, flash, accept
      }
    });
    await page.addInitScript(() => {
      const call = (m, ...a) => window.__steam(m, a), evs = [], pks = [];
      const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
      const unb64 = (s) => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
      window.steamBridge = {
        info: () => call('info'), createLobby: (k, n) => call('createLobby', k, n), joinLobby: (id) => call('joinLobby', String(id)),
        leaveLobby: (id) => call('leaveLobby', String(id)), lobby: (id) => call('lobby', String(id)), lobbies: () => call('lobbies'),
        setLobbyData: (id, d) => call('setLobbyData', String(id), d), invite: (id) => call('invite', String(id)), log: (l) => call('log', String(l)),
        flash: () => call('flash'), accept: (id) => call('accept', String(id)),
        send: (to, data, rel) => call('send', String(to), typeof data === 'string' ? data : { b64: b64(data), first: data[0] }, rel),
        onEvent: (cb) => evs.push(cb), onPackets: (cb) => pks.push(cb),
      };
      setInterval(async () => { // main.js's pump, every 8 ms
        let r; try { r = await call('drain'); } catch (e) { return; }
        for (const ev of r.ev) for (const cb of evs) cb(ev);
        if (r.pk.length) { const list = r.pk.map((p) => (p.b64 ? { from: p.from, bin: unb64(p.b64) } : p)); for (const cb of pks) cb(list); }
      }, 8);
    });
  }
  return { attach };
}

// ---- one path -------------------------------------------------------------
async function runPath(browser, kind) {
  const steam = kind.startsWith('steam'), S = fakeSteam(), errs = [];
  const base = 'http://localhost:' + CHECK_PORT + '/';
  const mk = async (tag, uid) => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pg = await c.newPage();
    if (steam) await S.attach(pg, uid, tag);
    pg.on('pageerror', (e) => errs.push(tag + ': ' + e.message));
    return pg;
  };
  const A = await mk('host', '76561190000000001'), B = await mk('guest', '76561190000000002');
  const q = steam ? '&transport=steam' : '';
  const open = async (pg, seed) => { await pg.goto(base + '?seed=' + seed + q); await pg.waitForFunction(() => window.DBG && typeof menuActivate === 'function'); await pg.waitForTimeout(800); };
  await open(A, 7);
  await A.evaluate(() => menuActivate(0)); // QUICKPLAY: a party, hosted
  await A.waitForFunction(() => NET.role === 'host' && NET.transport.open && roomCode(), null, { timeout: 10000 });
  const host = await A.evaluate(() => ({ code: roomCode(), lobby: NET.transport.lobbyId || null }));
  if (kind === 'steam-invite') await B.goto(base + '?join=' + host.lobby + q); // what a Steam invite opens (steamJoinRequested / +connect_lobby)
  else { // a code typed into the guest's own party, on another seed: the page reloads onto the host's
    await open(B, 9);
    await B.evaluate(() => menuActivate(0));
    await B.waitForFunction(() => NET.role === 'host' && NET.transport.open, null, { timeout: 10000 });
    await B.evaluate((c) => { state.menu.codeOn = true; state.menu.code = ''; for (const ch of c) codeType(ch); }, host.code);
  }
  let ok = false, why = '';
  const t0 = Date.now();
  while (Date.now() - t0 < JOIN_WAIT * 1000) {
    await B.waitForTimeout(500);
    try { ok = await B.evaluate(() => NET.role === 'client' && NET.welcomed && SEED === 7); } catch (e) { ok = false; } // mid-reload
    if (ok) break;
  }
  if (!ok) why = 'guest never welcomed';
  else {
    // the page must still be running: a throw in a frame ends the loop and leaves the screen frozen
    const alive = async (pg) => { const a = await pg.evaluate(() => state.menu.t); await pg.waitForTimeout(400); return (await pg.evaluate(() => state.menu.t)) > a; };
    const seats = await A.evaluate(() => players.filter((p) => p.control === 'remote').length);
    if (seats !== 1) why = 'host shows ' + seats + ' remote seats';
    else if (!(await alive(A))) why = 'host page stopped drawing';
    else if (!(await alive(B))) why = 'guest page stopped drawing';
  }
  if (errs.length) why = (why ? why + '; ' : '') + errs.slice(0, 3).join(' | ');
  await A.context().close(); await B.context().close();
  return why;
}

(async () => {
  const { chromium } = loadPlaywright();
  const only = process.argv[2], list = only ? [only] : PATHS;
  const server = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env: Object.assign({}, process.env, { PORT: String(CHECK_PORT) }), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));
  const opts = process.env.PLAYWRIGHT_BROWSERS_PATH && require('fs').existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const browser = await chromium.launch(opts);
  let bad = 0;
  for (const k of list) {
    let why;
    try { why = await runPath(browser, k); } catch (e) { why = 'threw: ' + e.message.split('\n')[0]; }
    console.log((why ? 'FAIL ' : 'ok   ') + k + (why ? '  ' + why : ''));
    if (why) bad++;
  }
  await browser.close(); server.kill();
  process.exit(bad ? 1 : 0);
})();
