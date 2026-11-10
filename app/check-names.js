// Checks that every name the game reads is declared somewhere. Run on its
// own or as part of app/check-globals.js, the one lint:
//
//   node app/check-names.js   # exit 0 clean, 1 with a report
//
// The game is classic scripts in one shared scope (docs/dev/architecture.md),
// so a call to a function that was renamed or deleted still loads; it throws
// only when that line runs, which can be a screen or a key no check visits.
// This reads every js/ file with the lint's tokenizer and reports a name READ
// (not after a `.`, not an object key, not a method's own name) that no file
// declares at any depth (const/let/var, a function or class, a parameter, a
// catch binding, a `window.X =`) and that is not the browser's or the
// language's own. It is name-level, not scope-level: a name declared anywhere
// counts as declared everywhere, so it can miss a misspelt local that happens
// to match another file's, never invent a problem. BROWSER lists the page's
// globals the scripts read.
'use strict';
const fs = require('fs');
const path = require('path');
const { tokenize } = require('./check-globals.js');

const ROOT = path.join(__dirname, '..');

// the page's own globals the game reads (the language's come from node itself)
const BROWSER = ['window', 'document', 'location', 'navigator', 'localStorage', 'sessionStorage',
  'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'Image', 'Audio', 'AudioContext',
  'webkitAudioContext', 'OfflineAudioContext', 'HTMLCanvasElement', 'CanvasRenderingContext2D',
  'ImageData', 'Path2D', 'OffscreenCanvas', 'WebSocket', 'Blob', 'URL', 'FileReader', 'Worker',
  'KeyboardEvent', 'MouseEvent', 'Event', 'CustomEvent', 'alert', 'confirm', 'prompt', 'screen',
  'devicePixelRatio', 'innerWidth', 'innerHeight', 'getComputedStyle', 'matchMedia', 'history',
  'fetch', 'atob', 'btoa', 'createImageBitmap', 'RTCPeerConnection', 'RTCSessionDescription',
  'RTCIceCandidate', 'TextEncoder', 'TextDecoder', 'CompressionStream', 'DecompressionStream',
  'Response', 'crypto', 'self', 'top', 'parent', 'open', 'close', 'focus', 'origin', 'name',
  'XMLHttpRequest', 'PerformanceObserver', 'ResizeObserver', 'MutationObserver', 'IntersectionObserver',
  'DOMParser', 'XMLSerializer', 'Option', 'HTMLElement', 'Node', 'Element', 'getSelection',
  'MediaRecorder', 'requestIdleCallback', 'steamBridge', 'electron', 'require', 'module', 'exports', 'arguments'];
const KEYWORDS = new Set(('break case catch class const continue debugger default delete do else export extends ' +
  'false finally for function if import in instanceof let new null of return static super switch this throw true ' +
  'try typeof var void while with yield async await get set undefined NaN Infinity').split(' '));
const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'function', 'return', 'typeof', 'await', 'yield', 'new', 'in', 'of', 'delete', 'void', 'case', 'else', 'do', 'throw', 'instanceof']);
const OPS_CONTINUE = new Set(['=', '+', '-', '*', '/', '%', '?', ':', ',', '&', '|', '^', '!', '~', '<', '>', '(', '[', '{', '.', '=>']);

function jsFiles(dir, rel) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel + '/' + e.name;
    if (e.isDirectory()) out.push(...jsFiles(path.join(dir, e.name), r));
    else if (e.name.endsWith('.js')) out.push(r);
  }
  return out;
}

// the index of the bracket that closes the one at i
function closeOf(T, i) {
  let d = 0;
  for (let k = i; k < T.length; k++) {
    const v = T[k].t === 'p' ? T[k].v : null;
    if (v === '(' || v === '[' || v === '{') d++;
    else if (v === ')' || v === ']' || v === '}') { d--; if (d === 0) return k; }
  }
  return T.length - 1;
}
// the index of the bracket that opens the one closing at i
function openOf(T, i) {
  let d = 0;
  for (let k = i; k >= 0; k--) {
    const v = T[k].t === 'p' ? T[k].v : null;
    if (v === ')' || v === ']' || v === '}') d++;
    else if (v === '(' || v === '[' || v === '{') { d--; if (d === 0) return k; }
  }
  return 0;
}
// every name a binding pattern from a to b (exclusive) binds: ids not after a `.`
// and not a default's value. Over-collecting only ever hides a report.
function patternNames(T, a, b, out) {
  let skip = 0; // inside a default value: from `=` to the next `,` at the same depth
  let d = 0;
  for (let k = a; k < b; k++) {
    const x = T[k];
    if (x.t === 'p') {
      if (x.v === '(' || x.v === '[' || x.v === '{') d++;
      else if (x.v === ')' || x.v === ']' || x.v === '}') { d--; if (skip && d < skip) skip = 0; }
      else if (x.v === '=' && !skip) skip = d || -1;
      else if (x.v === ',' && skip && (d === skip || skip === -1)) skip = 0;
      continue;
    }
    if (skip || x.t !== 'id' || KEYWORDS.has(x.v)) continue;
    if (k > 0 && T[k - 1].v === '.' && T[k - 1].t === 'p') continue;
    if (T[k + 1] && T[k + 1].t === 'p' && T[k + 1].v === ':') continue; // a key: the name after it is the binding
    out.add(x.v);
  }
}

function declared(T, out) {
  for (let k = 0; k < T.length; k++) {
    const x = T[k];
    if (x.t === 'id' && (x.v === 'const' || x.v === 'let' || x.v === 'var')) {
      // binding, then (= initializer) up to a `,` at its depth, then another binding...
      let j = k + 1;
      for (;;) {
        const s = j;
        if (T[j] && T[j].t === 'p' && (T[j].v === '{' || T[j].v === '[')) j = closeOf(T, j) + 1;
        else j++;
        patternNames(T, s, j, out);
        if (T[j] && T[j].v === ',') { j++; continue; } // `let a, b`: no initializer
        if (!T[j] || T[j].v !== '=') break;
        // skip the initializer
        let d = 0; j++;
        for (; j < T.length; j++) {
          const v = T[j].t === 'p' ? T[j].v : null;
          if (v === '(' || v === '[' || v === '{') d++;
          else if (v === ')' || v === ']' || v === '}') { if (--d < 0) break; }
          else if (d === 0 && (v === ',' || v === ';')) break;
          if (d === 0 && T[j + 1] && T[j + 1].line !== T[j].line && !(T[j].t === 'p' && OPS_CONTINUE.has(T[j].v)) &&
            !(T[j + 1].t === 'p' && OPS_CONTINUE.has(T[j + 1].v))) { j++; break; }
        }
        if (!T[j] || T[j].v !== ',') break;
        j++;
      }
    } else if (x.t === 'id' && (x.v === 'function' || x.v === 'class')) {
      if (T[k + 1] && T[k + 1].t === 'id') out.add(T[k + 1].v);
    } else if (x.t === 'p' && x.v === '=>') {
      const p = T[k - 1];
      if (p && p.t === 'id') out.add(p.v);
      else if (p && p.v === ')') patternNames(T, openOf(T, k - 1) + 1, k - 1, out);
    } else if (x.t === 'p' && x.v === '(') {
      // a function's or method's parameters: ( ... ) followed by {
      const c = closeOf(T, k), after = T[c + 1], before = T[k - 1];
      if (after && after.t === 'p' && after.v === '{' && before && (before.t === 'id' && (!CONTROL.has(before.v) || before.v === 'function' || before.v === 'catch'))) patternNames(T, k + 1, c, out);
      else if (after && after.t === 'p' && after.v === '{' && before && before.t === 'id' && before.v === 'catch') patternNames(T, k + 1, c, out);
    } else if (x.t === 'id' && x.v === 'window' && T[k + 1] && T[k + 1].v === '.' && T[k + 2] && T[k + 2].t === 'id' && T[k + 3] && T[k + 3].v === '=') {
      out.add(T[k + 2].v);
    }
  }
}

function reads(T, file, out) {
  for (let k = 0; k < T.length; k++) {
    const x = T[k];
    if (x.t !== 'id' || KEYWORDS.has(x.v)) continue;
    const p = T[k - 1], q = T[k + 1];
    if (p && p.t === 'p' && p.v === '.') continue;                       // a property
    if (p && p.t === 'id' && (p.v === 'break' || p.v === 'continue')) continue; // a label's jump
    if (q && q.t === 'p' && q.v === ':' && T[k + 2] && T[k + 2].t === 'id' && /^(for|while|do)$/.test(T[k + 2].v)) continue; // a label
    if (q && q.t === 'p' && q.v === ':' && p && p.t === 'p' && (p.v === '{' || p.v === ',')) continue; // an object key
    if (q && q.t === 'p' && q.v === '(' ) { const c = closeOf(T, k + 1); if (T[c + 1] && T[c + 1].v === '{' && !(p && p.t === 'p' && p.v === '.')) { if (!(p && p.t === 'id' && p.v === 'function')) continue; } } // a method's own name
    if (p && p.t === 'id' && (p.v === 'get' || p.v === 'set' || p.v === 'static' || p.v === 'async') && q && q.v === '(') continue;
    out.push({ name: x.v, file, line: x.line });
  }
}

function check() {
  const files = jsFiles(path.join(ROOT, 'js'), 'js');
  const known = new Set([...Object.getOwnPropertyNames(globalThis), ...BROWSER]);
  const all = [];
  for (const f of files) {
    const T = tokenize(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    declared(T, known);
    reads(T, f, all);
  }
  const problems = [];
  const seen = new Set();
  for (const r of all) {
    if (known.has(r.name)) continue;
    const key = r.name + '@' + r.file + ':' + r.line;
    if (seen.has(key)) continue; seen.add(key);
    problems.push(`UNDECLARED ${r.file}:${r.line} reads \`${r.name}\`, which nothing declares`);
  }
  return problems;
}
module.exports = { check };
if (require.main === module) {
  const p = check();
  for (const l of p) console.log(l);
  console.log(p.length ? `\n${p.length} read(s) of a name nothing declares` : 'names ok');
  process.exit(p.length ? 1 : 0);
}
