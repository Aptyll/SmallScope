'use strict';
// The arena's bot transport, 'vm': each bot file in a Node vm context of its
// own, so a ladder entry sees only its messages - not `players`, not the page,
// not `require`, not the disk. The file loads behind BOT_SEAL (js/bots/api.js:
// a seeded Math.random and a clock standing at 0) and every think has a CPU
// budget, so the same seed and files replay the same match and a slow file
// costs only itself.
//
// Only strings cross: a message goes in as JSON text and the answers come out
// as JSON text, so the context never holds an object from this realm to climb
// out through. Node's vm is a boundary for honest mistakes and casual peeking,
// not a hardened jail (Node's own docs say so): the online ladder runs each
// file in a process of its own (docs/bots/ladder.md, Going online).

const vm = require('vm');

const BOT_LOAD_MS = 1000; // CPU the file's load and its hello (init) may take
const BOT_THINK_MS = 50;  // CPU one think may take; over it, the think is an error and the seat keeps its act
const BOT_OUT_MAX = 65536; // chars of answer one message may bring back

// the runner inside the context: one message in, its answers out, all as text
const RUNNER = `
(() => {
  const msg = botMsg, json = JSON;
  return (text) => { const out = []; msg(json.parse(text), (m) => out.push(m)); return json.stringify(out); };
})()`;

// open(src, hear), the shape BOT_TRANSPORTS wants; G is the booted page
function vmTransport(G) {
  const step = new vm.Script('__botRun(__botIn)', { filename: 'bot-think' });
  return (src, hear) => {
    // a global with no prototype: nothing on it leads back to this realm
    const ctx = vm.createContext(Object.create(null), { microtaskMode: 'afterEvaluate', codeGeneration: { strings: true, wasm: false } });
    let fail = null, open = true;
    try {
      vm.runInContext(G.BOTS.seal + G.BOTS.prelude + '\n' + src + '\n;globalThis.__botRun = ' + RUNNER + ';', ctx,
        { filename: 'bot.js', timeout: BOT_LOAD_MS });
    } catch (e) { fail = e; }
    const send = (m) => {
      if (!open) return;
      if (fail) { hear({ t: 'err', msg: String(fail && fail.message || fail) }); return; }
      ctx.__botIn = JSON.stringify(m);
      let out;
      try { out = step.runInContext(ctx, { timeout: m.t === 'hello' ? BOT_LOAD_MS : BOT_THINK_MS }); }
      catch (e) {
        const slow = /timed out/.test(String(e && e.message));
        hear({ t: 'err', tick: m.tick, msg: slow ? 'think over ' + BOT_THINK_MS + ' ms' : String(e && e.message || e) });
        return;
      }
      if (typeof out !== 'string') return;
      if (out.length > BOT_OUT_MAX) { hear({ t: 'err', tick: m.tick, msg: 'answer over ' + BOT_OUT_MAX + ' chars' }); return; }
      for (const a of JSON.parse(out)) hear(a);
    };
    return { async: false, send, close() { open = false; } };
  };
}

module.exports = { vmTransport, BOT_LOAD_MS, BOT_THINK_MS };
