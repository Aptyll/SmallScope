// The media kit's browser: a headless Chrome driven over the DevTools protocol.
// No packages (Node 22+ has a global WebSocket and fetch), so it runs on a
// Windows desktop with Chrome installed and in a cloud box with Playwright's
// Chromium alike. CHROME=<path> picks the binary; otherwise the first one found.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const env = process.env.CHROME;
  if (env) return env;
  const known = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/opt/pw-browsers/chromium',
  ];
  for (const p of known) if (fs.existsSync(p)) return p;
  for (const name of ['google-chrome', 'chromium', 'chromium-browser', 'chrome']) {
    try { const p = execSync((process.platform === 'win32' ? 'where ' : 'command -v ') + name, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/)[0].trim(); if (p) return p; } catch (e) { /* not on PATH */ }
  }
  throw new Error('no Chrome found: set CHROME=<path to chrome>');
}

async function fetchJson(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('devtools never answered ' + url);
}

class Page {
  constructor(ws, proc, profile) {
    this.ws = ws; this.proc = proc; this.profile = profile; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id != null) {
        const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails; console.log('PAGE ERROR', (d.exception && d.exception.description) || d.text);
      } else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || process.env.MEDIA_LOG)) {
        console.log('page:', m.params.args.map((a) => a.value !== undefined ? a.value : a.description).join(' '));
      }
    });
  }
  send(method, params) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  // evaluate in the game's global scope; a function is called with args (JSON)
  async eval(fn, ...args) {
    const expr = typeof fn === 'function' ? `(${fn})(...${JSON.stringify(args)})` : fn;
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) {
      const e = r.exceptionDetails;
      throw new Error('page: ' + ((e.exception && (e.exception.description || e.exception.value)) || e.text));
    }
    return r.result && r.result.value;
  }
  // run a script file in the page as a classic script (it shares the game's globals)
  async inject(file) { return this.eval(fs.readFileSync(file, 'utf8') + '\n;true'); }
  // run before any of the page's own scripts on every load (swap a browser API out)
  async preload(src) { return this.send('Page.addScriptToEvaluateOnNewDocument', { source: src }); }
  async goto(url) {
    await this.send('Page.navigate', { url });
    for (let i = 0; i < 200; i++) { await sleep(100); if (await this.eval('document.readyState').catch(() => '') === 'complete') break; }
  }
  async key(k) {
    for (const type of ['keyDown', 'keyUp']) await this.send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: k === 'Enter' ? 13 : 0 });
  }
  // the whole viewport at device pixels, as a PNG file
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  }
  async close() {
    try { await this.send('Browser.close'); } catch (e) { /* already gone */ }
    try { this.proc.kill(); } catch (e) { /* already gone */ }
    await sleep(200);
    try { fs.rmSync(this.profile, { recursive: true, force: true }); } catch (e) { /* Windows holds it a moment */ }
  }
}

// open a headless page at w x h CSS px and dpr device px per CSS px
async function open({ width = 1280, height = 720, dpr = 1, audio = false } = {}) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'softfall-media-'));
  const args = ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--window-size=' + width + ',' + height, 'about:blank'];
  if (audio) args.push('--autoplay-policy=no-user-gesture-required');
  if (process.getuid && process.getuid() === 0) args.push('--no-sandbox');
  const proc = spawn(findChrome(), args, { stdio: 'ignore' });
  const list = await fetchJson('http://127.0.0.1:' + port + '/json/list');
  const t = list.find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
  if (!t) throw new Error('no page target');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const pg = new Page(ws, proc, profile);
  await pg.send('Runtime.enable'); await pg.send('Page.enable');
  await pg.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
  return pg;
}

// the game, served by app/server.js, booted past character create at a seed
async function openGame({ seed = 6, port = +(process.env.PORT || 8471), width, height, dpr } = {}) {
  const pg = await open({ width, height, dpr });
  await pg.goto(`http://localhost:${port}/?seed=${seed}`);
  await sleep(1200);
  if (await pg.eval(() => typeof DBG === 'undefined')) throw new Error('the game did not load: is node app/server.js running on :' + port + '?');
  return pg;
}

// --flag value pairs off argv, the rest positional
function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) o[k] = true; else { o[k] = v; i++; } }
    else o._.push(a);
  }
  return o;
}

module.exports = { open, openGame, findChrome, sleep, args };
