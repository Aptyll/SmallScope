// Checks the game's one shared global scope for collisions that git merges
// cleanly and `node --check` passes, but that break the game at load.
//
//   node app/check-globals.js         # exit 0 clean, 1 with a report
//   node app/check-globals.js --list  # every name it found, as JSON
//
// index.html loads every js file as a classic script into ONE global scope
// (docs/dev/architecture.md), so two files that each declare the same
// top-level name collide:
//   - a const/let/class declared twice, or once beside a function/var of the
//     same name, throws "Identifier ... has already been declared" when the
//     later file loads - every global after it is missing and the game dies;
//   - a function or var declared twice loads fine and the LATER one silently
//     replaces the earlier everywhere, which is how one agent's helper
//     quietly rewires another's feature.
// It also reports a js file index.html never loads, and one it loads twice.
//
// It reads each file with a small tokenizer (strings, template literals,
// comments and regex literals skipped, brackets tracked) and takes the
// declarations at depth 0: const/let/var (destructuring included), function,
// async function, class. The IIFE files declare nothing at depth 0, so they
// only count through their window.X assignments, which are read at any depth.
// No packages.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// the scripts index.html loads, in order
function loadOrder() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script\b[^>]*\bsrc=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) if (!/^[a-z]+:\/\//i.test(m[1])) out.push(m[1].replace(/^\.\//, ''));
  return out;
}

// every .js under js/, as index.html would name it
function jsFiles(dir, rel) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel + '/' + e.name;
    if (e.isDirectory()) out.push(...jsFiles(path.join(dir, e.name), r));
    else if (e.name.endsWith('.js')) out.push(r);
  }
  return out;
}

// ---- the tokenizer ---------------------------------------------------------
// Yields { t: 'id' | 'num' | 'str' | 'p', v, line } with comments dropped.
// A '/' starts a regex where an operand is expected: after a punctuator other
// than ) ] }, after a keyword that takes an expression, or at the start.
const REGEX_AFTER_KW = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
function tokenize(src) {
  const toks = [];
  let i = 0, line = 1;
  const n = src.length;
  const tmpl = []; // brace depth at each open ${ inside a template literal
  let depth = 0;   // brace depth, for closing a ${ back into its template
  const regexOk = () => {
    const p = toks[toks.length - 1];
    if (!p) return true;
    if (p.t === 'num' || p.t === 'str') return false;
    if (p.t === 'id') return REGEX_AFTER_KW.has(p.v);
    return !(p.v === ')' || p.v === ']' || p.v === '}');
  };
  // the rest of a template literal from i (just past ` or a closing }), up to ` or ${
  const readTemplate = () => {
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') line++;
      if (c === '`') { i++; return; }
      if (c === '$' && src[i + 1] === '{') { i += 2; tmpl.push(depth); depth++; toks.push({ t: 'p', v: '(', line }); return; }
      i++;
    }
  };
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '﻿') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2), stop = e < 0 ? n : e + 2;
      for (let k = i; k < stop; k++) if (src[k] === '\n') line++;
      i = stop; continue;
    }
    if (c === '"' || c === "'") {
      const at = line; i++;
      while (i < n && src[i] !== c) { if (src[i] === '\\') i++; else if (src[i] === '\n') line++; i++; }
      i++; toks.push({ t: 'str', v: '', line: at }); continue;
    }
    if (c === '`') { toks.push({ t: 'str', v: '', line }); i++; readTemplate(); continue; }
    if (c === '/' && regexOk()) {
      let cls = false; i++;
      while (i < n) {
        const d = src[i];
        if (d === '\\') { i += 2; continue; }
        if (d === '\n') break; // not a regex after all; bail rather than eat the file
        if (cls) { if (d === ']') cls = false; }
        else if (d === '[') cls = true;
        else if (d === '/') { i++; break; }
        i++;
      }
      while (i < n && /[a-z]/i.test(src[i])) i++; // flags
      toks.push({ t: 'str', v: '', line }); continue;
    }
    if (/[A-Za-z_$]/.test(c) || c.charCodeAt(0) > 127) {
      let j = i + 1;
      while (j < n && (/[\w$]/.test(src[j]) || src.charCodeAt(j) > 127)) j++;
      toks.push({ t: 'id', v: src.slice(i, j), line }); i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      let j = i + 1;
      while (j < n && /[\w.]/.test(src[j])) j++;
      toks.push({ t: 'num', v: '', line }); i = j; continue;
    }
    if (c === '{') { depth++; toks.push({ t: 'p', v: '{', line }); i++; continue; }
    if (c === '}') {
      if (tmpl.length && tmpl[tmpl.length - 1] === depth - 1) { // the } closing a ${ - back into the template
        tmpl.pop(); depth--; i++;
        toks.push({ t: 'p', v: ')', line }); // ${ ... } reads as ( ... ): balanced, and an operand ends here
        readTemplate();
        continue;
      }
      depth--; toks.push({ t: 'p', v: '}', line }); i++; continue;
    }
    // punctuators: longest first is not needed, only the bracket and comma identity matters
    toks.push({ t: 'p', v: c === '=' && src[i + 1] === '>' ? '=>' : c, line });
    i += c === '=' && src[i + 1] === '>' ? 2 : 1;
  }
  return toks;
}

// ---- declarations ----------------------------------------------------------
// the names a destructuring pattern (or a plain identifier) binds, from toks[k];
// returns the index just past the pattern
function patternNames(toks, k, out) {
  const t = toks[k];
  if (!t) return k;
  if (t.t === 'id') { out.push(t); return k + 1; }
  if (t.v !== '{' && t.v !== '[') return k + 1;
  const obj = t.v === '{', close = obj ? '}' : ']';
  k++;
  while (k < toks.length && toks[k].v !== close) {
    if (toks[k].v === ',') { k++; continue; }
    if (toks[k].v === '.' && toks[k + 1] && toks[k + 1].v === '.' && toks[k + 2] && toks[k + 2].v === '.') { k = patternNames(toks, k + 3, out); continue; }
    if (obj) {
      // key, key: pattern, [computed]: pattern, key = default
      let key = k;
      if (toks[k].v === '[') { let d = 0; do { if (toks[k].v === '[') d++; else if (toks[k].v === ']') d--; k++; } while (d > 0 && k < toks.length); key = -1; }
      else k++;
      if (toks[k] && toks[k].v === ':') k = patternNames(toks, k + 1, out);
      else if (key >= 0) out.push(toks[key]);
    } else {
      k = patternNames(toks, k, out);
    }
    if (toks[k] && toks[k].v === '=') k = skipExpr(toks, k + 1, [',', close]);
  }
  return k + 1;
}
// skip an expression from k to the first of `stops` at bracket depth 0
function skipExpr(toks, k, stops) {
  let d = 0;
  for (; k < toks.length; k++) {
    const v = toks[k].t === 'p' ? toks[k].v : null;
    if (v === null) continue;
    if (d === 0 && stops.includes(v)) return k;
    if (v === '(' || v === '[' || v === '{') d++;
    else if (v === ')' || v === ']' || v === '}') { if (d === 0) return k; d--; }
  }
  return k;
}
// every top-level declaration and every window.X = in one file
function declarations(src) {
  const toks = tokenize(src), decls = [];
  let d = 0;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === 'p') {
      if (t.v === '(' || t.v === '[' || t.v === '{') d++;
      else if (t.v === ')' || t.v === ']' || t.v === '}') d--;
    }
    // window.NAME = (not ==), at any depth: the IIFE files' exports
    if (t.t === 'id' && t.v === 'window' && toks[k + 1] && toks[k + 1].v === '.' && toks[k + 2] && toks[k + 2].t === 'id'
        && toks[k + 3] && toks[k + 3].v === '=' && !(toks[k + 4] && toks[k + 4].v === '=')
        && !(toks[k - 1] && toks[k - 1].v === '.')) {
      decls.push({ name: toks[k + 2].v, kind: 'window', line: t.line });
    }
    if (d !== 0 || t.t !== 'id') continue;
    const prev = toks[k - 1];
    if (prev && prev.v === '.') continue; // a property, not a declaration
    if (t.v === 'const' || t.v === 'let' || t.v === 'var') {
      let j = k + 1;
      for (;;) {
        const names = [];
        j = patternNames(toks, j, names);
        for (const nm of names) decls.push({ name: nm.v, kind: t.v, line: nm.line });
        if (toks[j] && toks[j].v === '=') j = skipExpr(toks, j + 1, [',', ';']);
        if (toks[j] && toks[j].v === ',') { j++; continue; }
        break;
      }
      k = j - 1;
    } else if (t.v === 'function' || t.v === 'class') {
      // a declaration only where a statement starts: not `x = function f`, not `(class C {})`
      const p = prev && prev.t === 'id' && prev.v === 'async' ? toks[k - 2] : prev;
      const stmt = !p || (p.t === 'p' && (p.v === ';' || p.v === '}' || p.v === ')')) || (p.t === 'str' && p.line < t.line);
      let j = k + 1;
      if (toks[j] && toks[j].v === '*') j++;
      if (stmt && toks[j] && toks[j].t === 'id') decls.push({ name: toks[j].v, kind: t.v, line: toks[j].line });
    }
  }
  return decls;
}

// ---- the check -------------------------------------------------------------
const LEXICAL = new Set(['const', 'let', 'class']);
function main() {
  const order = loadOrder();
  const problems = [];
  const onDisk = jsFiles(path.join(ROOT, 'js'), 'js');
  const seen = new Set();
  for (const f of order) {
    if (seen.has(f)) problems.push(`index.html loads ${f} twice`);
    seen.add(f);
    if (!fs.existsSync(path.join(ROOT, f))) problems.push(`index.html loads ${f}, which does not exist`);
  }
  for (const f of onDisk) if (!seen.has(f)) problems.push(`${f} is never loaded by index.html (dead, or a missing <script>)`);
  // a script without defer would run while the page parses, ahead of every
  // deferred one above it: the load order breaks (index.html says why defer)
  const tags = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<script\b[^>]*>/g) || [];
  for (const t of tags) if (/\bsrc=/.test(t) && !/\bdefer\b/.test(t)) problems.push(`index.html: ${t} needs defer`);

  const byName = new Map(); // name -> [{ file, kind, line }]
  for (const f of order) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const dcl of declarations(fs.readFileSync(p, 'utf8'))) {
      if (!byName.has(dcl.name)) byName.set(dcl.name, []);
      byName.get(dcl.name).push({ file: f, kind: dcl.kind, line: dcl.line });
    }
  }
  if (process.argv.includes('--list')) { // every name, for a tool: [name, kind, file, line]
    const rows = [];
    for (const [name, list] of byName) for (const e of list) rows.push([name, e.kind, e.file, e.line]);
    console.log(JSON.stringify(rows));
    return 0;
  }
  let fatal = 0, silent = 0;
  for (const [name, list] of byName) {
    // a window.X export beside its own `const X` twin is one file's usual idiom; the same file
    // assigning window.X twice is a lazy init - neither is a collision
    const decl = list.filter((e) => e.kind !== 'window');
    const win = list.filter((e) => e.kind === 'window');
    const winFiles = new Set(win.map((e) => e.file));
    const clash = decl.length > 1 || (winFiles.size > 1) ||
      (decl.length === 1 && win.some((e) => e.file !== decl[0].file));
    if (!clash) continue;
    const lex = decl.some((e) => LEXICAL.has(e.kind)) && (decl.length > 1 || win.length > 0);
    if (lex) fatal++; else silent++;
    const where = list.map((e) => `${e.file}:${e.line} (${e.kind === 'window' ? 'window.' + name + ' =' : e.kind})`).join(', ');
    problems.push(`${lex ? 'LOAD ERROR' : 'OVERRIDE  '} ${name}: ${where}`);
  }
  if (!problems.length) {
    console.log(`globals ok: ${byName.size} top-level names across ${order.length} scripts, no collisions`);
    return 0;
  }
  for (const p of problems) console.log(p);
  console.log(`\n${problems.length} problem(s)` + (fatal ? ` - ${fatal} would throw when the page loads` : '') +
    (silent ? ` - ${silent} silently replace an earlier definition` : ''));
  return 1;
}
process.exit(main());
