// Minimal Chrome DevTools Protocol client. No packages: Node 22+ ships a
// global WebSocket, which is the only thing a CDP session needs.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('devtools never answered ' + url);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id != null) {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message + ' (' + JSON.stringify(m.error.data || '') + ')'));
        else p.resolve(m.result);
      } else if (m.method) {
        const hs = this.handlers.get(m.method);
        if (hs) for (const h of hs) h(m.params);
      }
    });
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }

  send(method, params) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  // Evaluate an expression in the page's global scope and hand back its value.
  // Promises are awaited; a thrown error comes back as a rejected promise with
  // the page-side stack, which is the only way to debug a driver from here.
  async eval(expr, { awaitPromise = true, timeout = 0 } = {}) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise,
      userGesture: true,
      timeout: timeout || undefined,
    });
    if (r.exceptionDetails) {
      const e = r.exceptionDetails;
      const msg = (e.exception && (e.exception.description || e.exception.value)) || e.text;
      throw new Error('page: ' + msg);
    }
    return r.result && r.result.value;
  }
}

async function launch({ port = 9333, url, width = 1920, height = 1080, show = true } = {}) {
  const profile = path.join(os.tmpdir(), 'softfall-montage-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const args = [
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    '--window-size=1080,680',
    '--window-position=40,20',
    '--disable-features=CalculateNativeWinOcclusion',
    url,
  ];
  if (!show) args.unshift('--headless=new');
  const proc = spawn(CHROME, args, { stdio: 'ignore', detached: false });

  const list = await fetchJson('http://127.0.0.1:' + port + '/json/list');
  const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  return { cdp, proc, port };
}

module.exports = { launch, CDP, sleep, CHROME };
