'use strict';
// The arena's bot transport, 'vm': each bot file in a thread of its own (a
// worker_threads Worker, so its heap is capped apart from the match's), and
// inside that thread in a Node vm context of its own, so it sees only its
// messages - not `players`, not the page, not `require`, not the disk. The
// file loads behind BOT_SEAL (js/bots/api.js: a seeded Math.random, a clock
// standing at 0, a budget on raw buffers) and every think has a CPU budget,
// so the same seed and files replay the same match and a slow or greedy file
// costs only itself.
//
// The match still runs in lockstep: send() posts the message and blocks on a
// shared flag until the thread answers, so to the sim this is as synchronous
// as a function call. Only strings cross: a message goes in as JSON text and
// the answers come out as JSON text.
//
// A thread that dies (out of memory) or stops answering is a dead seat: every
// later message is an error marked `dead`, the seat lets go of its keys, and
// the match log says so - the ladder scores a side with a dead seat as the
// loser (app/ladder/core.js), so crashing never dodges a loss.
//
// Node's vm is a boundary for honest mistakes and casual peeking, not a
// hardened jail (Node's own docs say so): the online ladder runs each file in
// a process of its own (docs/bots/ladder.md, Going online).

const { Worker, MessageChannel, receiveMessageOnPort } = require('worker_threads');

const BOT_LOAD_MS = 1000;  // CPU the file's load and its hello (init) may take
const BOT_THINK_MS = 50;   // CPU one think may take; over it, the think is an error and the seat keeps its act
const BOT_OUT_MAX = 65536; // chars of answer one message may bring back
const BOT_HEAP_MB = 64;    // the thread's heap; past it the thread dies and the seat is dead
const BOT_WAIT_MS = 3000;  // how long past its budget a message may go unanswered before the thread counts as dead

// the runner inside the context: one message in, its answers out, all as text
const RUNNER = `
;globalThis.__botRun = (() => {
  const msg = botMsg, json = JSON;
  return (text) => { const out = []; msg(json.parse(text), (m) => out.push(m)); return json.stringify(out); };
})();`;

// the thread: builds the context, then answers each message and raises the flag
const THREAD = `'use strict'; // strict frames: a stack trace hands the bot no 'this' and no function of ours
const { workerData: d } = require('worker_threads');
const vm = require('vm');
const flag = new Int32Array(d.flag);
const done = (m) => { d.port.postMessage(m); Atomics.store(flag, 0, 1); Atomics.notify(flag, 0); };
let ctx = null, step = null, fail = null;
try {
  // a global with no prototype: nothing on it leads back to this realm
  ctx = vm.createContext(Object.create(null), { microtaskMode: 'afterEvaluate', codeGeneration: { strings: true, wasm: false } });
  vm.runInContext(d.seal + d.prelude + '\\n' + d.src + '\\n' + d.runner, ctx, { filename: 'bot.js', timeout: d.loadMs });
  step = new vm.Script('__botRun(__botIn)', { filename: 'bot-think' });
} catch (e) { fail = String(e && e.message || e); }
d.port.on('message', (m) => {
  if (fail) { done({ id: m.id, err: fail }); return; }
  ctx.__botIn = m.text;
  try {
    const out = step.runInContext(ctx, { timeout: m.hello ? d.loadMs : d.thinkMs });
    if (typeof out === 'string' && out.length > d.outMax) done({ id: m.id, err: 'answer over ' + d.outMax + ' chars' });
    else done({ id: m.id, out: typeof out === 'string' ? out : '[]' });
  } catch (e) {
    done({ id: m.id, err: /timed out/.test(String(e && e.message)) ? 'think over ' + d.thinkMs + ' ms' : String(e && e.message || e) });
  }
});
`;

// open(src, hear), the shape BOT_TRANSPORTS wants; G is the booted page
function vmTransport(G) {
  return (src, hear) => {
    const flagBuf = new SharedArrayBuffer(4), flag = new Int32Array(flagBuf);
    const { port1, port2 } = new MessageChannel();
    let dead = null, open = true, n = 0;
    const w = new Worker(THREAD, {
      eval: true, transferList: [port2], stdout: true, stderr: true,
      workerData: { port: port2, flag: flagBuf, src, seal: G.BOTS.seal, prelude: G.BOTS.prelude, runner: RUNNER,
        loadMs: BOT_LOAD_MS, thinkMs: BOT_THINK_MS, outMax: BOT_OUT_MAX },
      resourceLimits: { maxOldGenerationSizeMb: BOT_HEAP_MB, maxYoungGenerationSizeMb: 16 },
    });
    w.unref();
    w.on('error', () => { }); // a death is found by the next unanswered message
    const send = (m) => {
      if (!open) return;
      if (!dead) {
        const id = ++n, hello = m.t === 'hello';
        Atomics.store(flag, 0, 0);
        port1.postMessage({ id, text: JSON.stringify(m), hello });
        const until = Date.now() + (hello ? 2 * BOT_LOAD_MS : BOT_THINK_MS) + BOT_WAIT_MS;
        let got = null;
        while (!got && Date.now() < until) {
          if (Atomics.load(flag, 0) === 0) Atomics.wait(flag, 0, 0, Math.max(1, until - Date.now()));
          const r = receiveMessageOnPort(port1);
          if (r && r.message.id === id) got = r.message;
        }
        if (got && got.err) { hear({ t: 'err', tick: m.tick, msg: got.err }); return; }
        if (got) { for (const a of JSON.parse(got.out)) hear(a); return; }
        dead = 'sandbox died (out of memory, or stopped answering)';
        w.terminate().catch(() => { });
      }
      hear({ t: 'err', tick: m.tick, msg: dead, dead: true });
    };
    return { async: false, send, close() { open = false; w.terminate().catch(() => { }); } };
  };
}

module.exports = { vmTransport, BOT_LOAD_MS, BOT_THINK_MS, BOT_HEAP_MB };
