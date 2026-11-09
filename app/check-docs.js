// Checks that the docs name only code that exists. Run on its own or as part
// of app/check-globals.js, the one lint:
//
//   node app/check-docs.js   # exit 0 clean, 1 with a report
//
// A doc that names a function nobody has any more reads as true to the next
// person, who goes looking for it. CLAUDE.md asks a change that makes a doc
// line false to fix it in the same PR; this is the part of that a machine
// can see. It fails a camelCase name or a CONSTANT_NAME in backticks in
// docs/ (`drawFoo`, `p.someField`, `TOWER_DMG`) that appears nowhere in the
// code: js/, app/ (the Python bakers too), desktop/, bots/, .claude/ and the
// root pages. A name written with a trailing `*`
// (`skCatch*`) is a prefix: some code word must start with it.
//
// SKIP_FILES are docs that name old code on purpose. ALLOW lists the few
// words that are not code (a placeholder, a browser API, a key from a past
// version), each with its reason. No packages.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CODE_DIRS = ['js', 'app', 'desktop', 'bots', '.claude'];
const CODE_EXT = /\.(js|cjs|mjs|html|json|py|sh)$/; // the art bakers are Python
const SKIP_FILES = new Set([
  'docs/dev/gameplay/roguelike-cards.md', // the parked cards: a note for rebuilding them off old code
]);
const ALLOW = {
  deviceH: 'a formula term, not a name',
  fNNNN: 'a file name pattern',
  posN: 'a placeholder for position N',
  skinN: 'a placeholder for skin N',
  someCue: 'an example cue name',
  requestFullscreen: 'a browser API',
  hudCorner: 'a removed settings key old profiles may still carry',
  useCard: 'the bot API version history',
};

function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const rel = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

function codeWords() {
  const files = [];
  for (const d of CODE_DIRS) walk(d, files);
  for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.html')) files.push(f);
  const words = new Set();
  for (const f of files) {
    if (!CODE_EXT.test(f)) continue;
    let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (f === 'app/check-docs.js') src = src.replace(/const ALLOW = \{[\s\S]*?\n\};/, ''); // its own ALLOW words are not code
    for (const w of src.match(/[A-Za-z_$][\w$]*/g) || []) words.add(w);
  }
  return words;
}

function check() {
  const words = codeWords();
  let prefixes = null; // built on the first prefix asked for
  const has = (w, prefix) => {
    if (!prefix) return words.has(w);
    if (!prefixes) prefixes = [...words];
    return prefixes.some((c) => c.startsWith(w));
  };
  const problems = [];
  const docs = walk('docs', []).filter((f) => f.endsWith('.md') && !f.startsWith('docs/media/') && !SKIP_FILES.has(f));
  for (const f of docs) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const re = /`([^`\n]+)`/g;
    let m;
    while ((m = re.exec(src))) {
      // a camelCase name, or a CONSTANT_NAME with an underscore in it
      const tok = /\b([a-z][a-z0-9]*[A-Z]\w*|[A-Z][A-Z0-9]*_[A-Z0-9_]*[A-Z0-9])\b(\*?)/g;
      let t;
      while ((t = tok.exec(m[1]))) {
        const w = t[1];
        if (ALLOW[w] || has(w, t[2] === '*')) continue;
        const line = src.slice(0, m.index).split('\n').length;
        problems.push(`STALE DOC  ${f}:${line} names \`${w}\`, which no code has`);
      }
    }
  }
  for (const w in ALLOW) if (has(w, false)) problems.push(`STALE ALLOW  app/check-docs.js ALLOW.${w}: the code has it now, so drop the entry`);
  return problems;
}

module.exports = { check };
if (require.main === module) {
  const p = check();
  for (const s of p) console.log(s);
  console.log(p.length ? `\n${p.length} doc line(s) name code that is gone: fix the doc` : 'docs ok');
  process.exit(p.length ? 1 : 0);
}
