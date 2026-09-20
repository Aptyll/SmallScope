'use strict';
// Minimal CDP client over node 22's built-in WebSocket. No installs: the game
// is flat classic scripts in one global scope, so Runtime.evaluate reaches
// every global, and DBG.freeze + DBG.step let a driver advance the sim exactly
// one frame per captured image.
const http = require('http');

function get(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => { let b = ''; r.on('data', (d) => b += d); r.on('end', () => res(b)); }).on('error', rej);
  });
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waits = new Map(); this.logs = []; this.errors = []; }
  static async open(port, targetUrl) {
    // find (or make) a page target
    let list = JSON.parse(await get('http://127.0.0.1:' + port + '/json/list'));
    let page = list.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (ev) => c._msg(JSON.parse(ev.data));
    await c.send('Runtime.enable');
    await c.send('Page.enable');
    await c.send('Log.enable');
    return c;
  }
  _msg(m) {
    if (m.id != null) {
      const w = this.waits.get(m.id);
      if (w) { this.waits.delete(m.id); m.error ? w.rej(new Error(JSON.stringify(m.error))) : w.res(m.result); }
      return;
    }
    if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      this.logs.push(e.level + ': ' + e.text);
      if (e.level === 'error') this.errors.push(e.text);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      this.errors.push('EXC: ' + (d.exception && d.exception.description || d.text));
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const t = (m.params.args || []).map((a) => a.value !== undefined ? a.value : a.description).join(' ');
      this.logs.push(m.params.type + ': ' + t);
      if (m.params.type === 'error') this.errors.push(t);
    }
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.waits.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async eval(expr, opts) {
    const r = await this.send('Runtime.evaluate', Object.assign({
      expression: expr, returnByValue: true, awaitPromise: true, userGesture: true,
    }, opts || {}));
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('eval threw: ' + (d.exception && d.exception.description || d.text) + '\n--- expr ---\n' + expr.slice(0, 4000));
    }
    return r.result.value;
  }
  async goto(url) {
    await this.send('Page.navigate', { url });
    await this.waitFor('typeof window.DBG === "object" && typeof SPRITES === "object" && typeof state === "object" && state.mode === "title"', 20000);
  }
  async waitFor(expr, ms) {
    const t0 = Date.now();
    for (;;) {
      let ok = false;
      try { ok = await this.eval('!!(' + expr + ')'); } catch (e) { ok = false; }
      if (ok) return true;
      if (Date.now() - t0 > (ms || 10000)) throw new Error('waitFor timed out: ' + expr);
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

// One frame straight off the game canvas: DBG.step() has already run render()
// synchronously, so the bitmap is exactly the frame the driver just stepped.
const GRAB = '(function(){var c=document.getElementById("game");return c.toDataURL("image/png").slice(22);})()';

module.exports = { CDP, GRAB };
