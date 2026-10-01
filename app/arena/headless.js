'use strict';
// The game with no browser: every classic script index.html loads, run in
// order in this Node process's own global scope, which stands in for the
// page. Nothing is drawn. A canvas is a small alpha-only pixel store - enough
// for the sim's one pixel read, the building hitboxes off their sprites'
// opaque pixels (artBox, js/sim.js), and those match Chromium's pixel for
// pixel; audio, input, timers and storage are inert. The sim is the real one,
// untouched, and nothing runs the title screen (whose live world would spend
// rng draws for as long as it is up), so one seed is one exact replay - the
// same replay a browser page gives with its frame loop held off
// (docs/dev/arena.md, "Is it the real game?").
//
//   const { bootGame } = require('./headless');
//   const g = bootGame({ seed: 42 });  // g.run('state.mode'), globalThis.update(1 / 60)
//
// The page's function declarations become globals of this process; its
// top-level let/const live in the scripts' shared scope, reached by g.run(code).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

// the scripts, in the page's own order: index.html is the one list
function scriptList() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script\b[^>]*\bsrc=["']([^"']+)["']/g; // app/check-globals.js reads the list the same way
  let m;
  while ((m = re.exec(html))) if (!/^[a-z]+:\/\//i.test(m[1])) out.push(m[1].replace(/^\.\//, ''));
  return out;
}

// ------------------------------------------------------------ the canvas
// Only small canvases keep pixels (sprites, icons): the world and screen
// buffers are thousands of px square and nothing in the sim reads them.
const PIX_MAX = 512 * 512;
// the page's element classes, so `instanceof HTMLElement` (the save's walk)
// tells a canvas from state
function HTMLElement() {}
function HTMLCanvasElement() {}
HTMLCanvasElement.prototype = Object.create(HTMLElement.prototype);

function makeCanvas(w, h) {
  const cv = {
    _w: w || 300, _h: h || 150, _a: null, style: {}, dataset: {},
    get width() { return this._w; }, set width(v) { this._w = v | 0; this._a = null; },
    get height() { return this._h; }, set height(v) { this._h = v | 0; this._a = null; },
    addEventListener() {}, removeEventListener() {}, getBoundingClientRect() { return { left: 0, top: 0, width: this._w, height: this._h }; },
    toDataURL() { return 'data:,'; }, setAttribute() {}, focus() {},
    getContext() { return this._g || (this._g = makeCtx(this)); },
  };
  return Object.setPrototypeOf(cv, HTMLCanvasElement.prototype);
}
function alphaOf(cv, make) {
  if (cv._a) return cv._a;
  if (!make || cv._w * cv._h > PIX_MAX || cv._w <= 0 || cv._h <= 0) return null;
  return (cv._a = new Uint8Array(cv._w * cv._h));
}
const NOOP = () => {};
// an object that answers anything: every property is itself, every call and
// `new` returns itself, and it reads as 0 - the audio graph, a gamepad
const INERT = new Proxy(function () {}, {
  get: (o, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : INERT),
  set: () => true, apply: () => INERT, construct: () => INERT, has: () => true,
});
function makeCtx(cv) {
  // translate + scale only (the flips): rotation leaves pixels where they were
  let t = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const g = {
    canvas: cv, fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1, font: '',
    globalCompositeOperation: 'source-over', imageSmoothingEnabled: false, textAlign: 'left', textBaseline: 'top',
    save() { stack.push(t.slice()); }, restore() { if (stack.length) t = stack.pop(); },
    setTransform(a, b, c, d, e, f) { t = typeof a === 'object' && a ? [a.a, a.b, a.c, a.d, a.e, a.f] : [a, b, c, d, e, f]; },
    resetTransform() { t = [1, 0, 0, 1, 0, 0]; },
    getTransform() { return { a: t[0], b: t[1], c: t[2], d: t[3], e: t[4], f: t[5] }; },
    translate(x, y) { t[4] += t[0] * x; t[5] += t[3] * y; },
    scale(x, y) { t[0] *= x; t[3] *= y; },
    rotate: NOOP, transform: NOOP,
    fillRect(x, y, w, h) { paint(x, y, w, h, this.globalCompositeOperation === 'destination-out' ? 0 : 255); },
    clearRect(x, y, w, h) { paint(x, y, w, h, 0); },
    drawImage(src, a, b, c, d, e, f, gw, gh) {
      if (!src) return;
      let sx = 0, sy = 0, sw = src.width, sh = src.height, dx = a, dy = b, dw = sw, dh = sh;
      if (e !== undefined) { sx = a; sy = b; sw = c; sh = d; dx = e; dy = f; dw = gw; dh = gh; }
      else if (c !== undefined) { dw = c; dh = d; }
      const sa = src._a, da = alphaOf(cv, true);
      if (!sa || !da || !sw || !sh) return;
      const x0 = t[0] * dx + t[4], y0 = t[3] * dy + t[5], ww = t[0] * dw, hh = t[3] * dh;
      const lx = Math.round(Math.min(x0, x0 + ww)), ly = Math.round(Math.min(y0, y0 + hh));
      const W = Math.round(Math.abs(ww)), H = Math.round(Math.abs(hh));
      for (let j = 0; j < H; j++) {
        const Y = ly + j;
        if (Y < 0 || Y >= cv._h) continue;
        const v = hh < 0 ? H - 1 - j : j, syy = Math.floor(sy + (v + 0.5) * sh / H);
        if (syy < 0 || syy >= src.height) continue;
        for (let i = 0; i < W; i++) {
          const X = lx + i;
          if (X < 0 || X >= cv._w) continue;
          const u = ww < 0 ? W - 1 - i : i, sxx = Math.floor(sx + (u + 0.5) * sw / W);
          if (sxx < 0 || sxx >= src.width) continue;
          const s = sa[syy * src.width + sxx];
          if (s) da[Y * cv._w + X] = Math.max(da[Y * cv._w + X], s);
        }
      }
    },
    getImageData(x, y, w, h) {
      const out = new Uint8ClampedArray(w * h * 4), a = cv._a;
      if (a) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const X = x + i, Y = y + j;
        if (X >= 0 && Y >= 0 && X < cv._w && Y < cv._h) out[(j * w + i) * 4 + 3] = a[Y * cv._w + X];
      }
      return { data: out, width: w, height: h };
    },
    putImageData(img, x, y) {
      const a = alphaOf(cv, true);
      if (!a) return;
      for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) {
        const X = x + i, Y = y + j;
        if (X >= 0 && Y >= 0 && X < cv._w && Y < cv._h) a[Y * cv._w + X] = img.data[(j * img.width + i) * 4 + 3];
      }
    },
    createImageData(w, h) { if (typeof w === 'object') { h = w.height; w = w.width; } return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    measureText(s) { return { width: String(s).length * 6, actualBoundingBoxAscent: 6, actualBoundingBoxDescent: 1 }; },
    createLinearGradient() { return { addColorStop: NOOP }; },
    createRadialGradient() { return { addColorStop: NOOP }; },
    createConicGradient() { return { addColorStop: NOOP }; },
    createPattern() { return {}; },
    isPointInPath() { return false; },
    getLineDash() { return []; },
  };
  function paint(x, y, w, h, v) {
    const a = alphaOf(cv, v > 0);
    if (!a) return;
    if (v && (g.globalAlpha <= 0 || g.fillStyle === 'transparent')) return;
    const x0 = t[0] * x + t[4], y0 = t[3] * y + t[5], x1 = x0 + t[0] * w, y1 = y0 + t[3] * h;
    const lx = Math.max(0, Math.round(Math.min(x0, x1))), hx = Math.min(cv._w, Math.round(Math.max(x0, x1)));
    const ly = Math.max(0, Math.round(Math.min(y0, y1))), hy = Math.min(cv._h, Math.round(Math.max(y0, y1)));
    for (let Y = ly; Y < hy; Y++) for (let X = lx; X < hx; X++) a[Y * cv._w + X] = v;
  }
  // every path call and anything else a draw pass asks for is a no-op
  return new Proxy(g, { get: (o, k) => (k in o ? o[k] : NOOP), set: (o, k, v) => { o[k] = v; return true; } });
}

// ------------------------------------------------------------ the page
function makeWindow(seed, extra) {
  const listeners = NOOP;
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k), clear: () => store.clear(), key: (i) => [...store.keys()][i] || null,
    get length() { return store.size; },
  };
  const elements = {};
  const el = () => Object.assign(makeCanvas(), { appendChild: NOOP, removeChild: NOOP, classList: { add: NOOP, remove: NOOP, toggle: NOOP, contains: () => false }, innerHTML: '', textContent: '', children: [] });
  const document = {
    hidden: true, visibilityState: 'hidden', fullscreenElement: null,
    getElementById: (id) => elements[id] || (elements[id] = el()),
    querySelector: () => el(), querySelectorAll: () => [],
    createElement: (tag) => (tag === 'canvas' ? makeCanvas() : el()),
    addEventListener: listeners, removeEventListener: listeners,
    body: el(), documentElement: el(), head: el(), fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
    exitFullscreen: NOOP,
  };
  const w = {
    document, localStorage: storage, sessionStorage: storage,
    location: { search: '?seed=' + seed + (extra || ''), pathname: '/index.html', href: 'file:///index.html', protocol: 'file:', host: '', hostname: '' },
    navigator: { userAgent: 'node', getGamepads: () => [], language: 'en', languages: ['en'], platform: 'node' },
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, screen: { width: 1280, height: 720 },
    addEventListener: listeners, removeEventListener: listeners, dispatchEvent: NOOP,
    requestAnimationFrame: () => 0, cancelAnimationFrame: NOOP,
    setTimeout: () => 0, clearTimeout: NOOP, setInterval: () => 0, clearInterval: NOOP, // no timer ever fires: the driver steps
    matchMedia: () => ({ matches: false, addEventListener: NOOP, addListener: NOOP }),
    Image: function () { return makeCanvas(1, 1); }, Audio: function () { return { play: () => Promise.resolve(), pause: NOOP, addEventListener: NOOP }; },
    Worker: function () { return { postMessage: NOOP, terminate: NOOP, addEventListener: NOOP }; },
    Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL: NOOP },
    WebSocket: function () { return { send: NOOP, close: NOOP, addEventListener: NOOP }; },
    fetch: () => Promise.reject(new Error('headless')),
    performance: { now: () => 0 }, // fx only reads it (updateFx); a fixed clock keeps a run a replay
    atob: (s) => Buffer.from(s, 'base64').toString('binary'), btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    OffscreenCanvas: function (a, b) { return makeCanvas(a, b); },
    ImageData: function (d, w2, h2) { return { data: d, width: w2, height: h2 }; },
    DOMMatrix: function () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    HTMLElement, HTMLCanvasElement, HTMLImageElement: HTMLElement,
    AudioContext: INERT, webkitAudioContext: INERT,
    CompressionStream: undefined, DecompressionStream: undefined,
  };
  w.window = w; w.self = w; w.globalThis = w;
  return w;
}

// boot the page on `seed`: every script, then the boot's own tail (boot.js)
// leaves it on the title (or the create screen on a fresh profile)
//
// The page runs in THIS process's own global scope, not a vm context: a vm
// context's global object answers every bare global (every function
// declaration the game calls) through an interceptor, which ran the sim at
// half speed. So a process boots one page, once - a match is a process
// (app/arena/run.js forks one per match).
let booted = null;
function bootGame(opts) {
  if (booted) throw new Error('one page per process: fork a process per match');
  const o = opts || {};
  const seed = o.seed == null ? 42 : o.seed;
  const win = makeWindow(seed, o.search);
  for (const k of Object.keys(win)) {
    if (k === 'window' || k === 'self' || k === 'globalThis') continue;
    Object.defineProperty(globalThis, k, { value: win[k], writable: true, configurable: true, enumerable: true });
  }
  globalThis.window = globalThis; globalThis.self = globalThis;
  for (const src of scriptList()) {
    const file = path.join(ROOT, src);
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: src });
  }
  const run = (code) => vm.runInThisContext(code);
  booted = { seed, run, DBG: globalThis.DBG };
  return booted;
}

module.exports = { bootGame, scriptList, ROOT };
