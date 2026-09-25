// ------------------------------------------------------------ saved matches
// A SAVE is a solo match frozen at one sim step, whole: every body, arrow in
// flight, building, drop, camp, the counters' stock and prices, the clock and
// the three random streams' positions - so a loaded game does not merely look
// like the saved one, it PLAYS OUT exactly as the saved one would have from
// that step on (the proof is DBG.saveHash: step a match on, load its save
// beside it, step the same count, compare).
//
// Nothing here knows what a field means. The world is a seed (SEED, MAP_TYPE):
// a load is a page on the saved seed and shape, which grows the very same
// valley, and the save is what the match has done to it since. That is
//   - the ROOTS below, every mutable global the sim reads, serialized as one
//     object graph, so a reference shared anywhere (a bot's hunt target, a
//     camp's den, `player` === players[localId]) comes back shared;
//   - the map objects and ground tiles that DIFFER from the freshly grown
//     valley (saveBaseline, taken at boot before anything moves): the 33 000
//     untouched pines are not written, a reference to one is its tile index.
// A new field on any of these rides along untold. A new mutable GLOBAL the
// sim reads does not - it joins SAVE_ROOTS, or a loaded match forgets it.
//
// The flow: saveMatch writes a slot through PROFILE (the one file that
// touches storage); loadSave hands the body to the next page through
// sessionStorage and reloads onto ?seed&map; js/boot.js calls saveBootLoad
// after the world stands and before the ground is baked, so the bake paints
// the saved valley and not the fresh one.

// ---- tuning ---------------------------------------------------------------
const SAVE_V = 1;           // the body's shape; a body of another shape is refused, never half-read
const SAVE_MANUAL = 5;      // manual slots: m0..m4
const SAVE_AUTO = 3;        // autosaves kept, newest first: a0..a2
const SAVE_AUTO_T = 120;    // s of live match between autosaves
const SAVE_THUMB = 40;      // px square: the slot's minimap picture
const SAVE_FLASH_T = 1.6;   // s the HUD's saved mark shows

// ---- what is saved ----------------------------------------------------------
// [name, get, put]: get() hands the live value in, put(v) takes the decoded
// one back. A const container is refilled in place (every file holds the same
// array); a `let` is reassigned (this file shares the one global scope).
function saveArr(a) { return [() => a, (v) => { a.length = 0; for (const x of v) a.push(x); }]; }
// state's own UI keys are this screen's and never the match's: a load opens
// with every panel shut
const SAVE_STATE_SKIP = new Set(['paused', 'mapOpen', 'bagOpen', 'charOpen', 'shop', 'drag', 'dragPend',
  'settingsOpen', 'rebind', 'wheel', 'build', 'menu', 'intro', 'introLen', 'introFrom', 'fade', 'shake',
  'shopTab', 'forgeSel', 'forgePile']); // the forge's bench (js/ui/forge.js); a weapon's points ride its own cell
const SAVE_ROOTS = [
  ['state', () => { const o = {}; for (const k of Object.keys(state)) if (!SAVE_STATE_SKIP.has(k)) o[k] = state[k]; return o; },
    (v) => Object.assign(state, v)],
  ['players', ...saveArr(players)],
  ['localId', () => localId, (v) => { localId = v; player = players[v]; inv = player.inv; }],
  ['animals', ...saveArr(animals)], ['structures', ...saveArr(structures)], ['robots', ...saveArr(robots)],
  ['tracers', ...saveArr(tracers)], ['arrows', ...saveArr(arrows)], ['drops', ...saveArr(drops)],
  ['particles', ...saveArr(particles)], ['floaters', ...saveArr(floaters)], ['footprints', ...saveArr(footprints)],
  ['fish', ...saveArr(fish)], ['holes', ...saveArr(holes)], ['camps', ...saveArr(camps)],
  ['craters', ...saveArr(craters)], ['nets', ...saveArr(nets)], ['abFx', ...saveArr(abFx)],
  ['warps', ...saveArr(warps)], ['swaps', ...saveArr(swaps)], ['slashes', ...saveArr(slashes)],
  ['landmarks', ...saveArr(landmarks)],
  ['shed', () => [shedWait, shedLive], (v) => { saveArr(shedWait)[1](v[0]); shedLive = v[1]; }],
  ['iceCracks', () => iceCracks, (v) => { iceCracks.clear(); for (const [k, x] of v) iceCracks.set(k, x); }],
  ['market', () => market, (v) => Object.assign(market, v)],
  ['rng', () => [rng.s, fxRng.s, mktRng.s], (v) => { rng.s = v[0]; fxRng.s = v[1]; mktRng.s = v[2]; }],
  ['wild', () => [preyRepopT, fishCap, fishFloor, emergeSites],
    (v) => { preyRepopT = v[0]; fishCap = v[1]; fishFloor = v[2]; emergeSites = v[3]; }],
  ['ai', () => [aiSitTick, aiSit], (v) => { aiSitTick = v[0]; aiSit = v[1]; }],
  ['stats', () => [statT, matchStats], (v) => { statT = v[0]; matchStats = v[1]; }],
  // the view: where the camera and both zooms stood, so the first frame is the saved one
  // (boot frames the camera on the player after this runs, so saveBootView puts it back again)
  ['view', () => [camX, camY, kWant, zoomCur, mmCur], (v) => { saveView = v; camX = v[0]; camY = v[1]; kWant = v[2]; zoomCur = v[3]; mmCur = v[4]; }],
];

let saveView = null; // the loaded match's camera, until boot has finished moving it
// the world view is sized to the restored zoom first: the next step's
// applyZoom keeps the view's centre still across a size change, and a view
// still at boot's size would slide the camera by half the difference
function saveBootView() { if (saveView) { sizeWorldView(); camX = saveView[0]; camY = saveView[1]; } }

// ---- the baseline -----------------------------------------------------------
// The valley as it grew, before the match touched it: each tile's object (by
// reference) with a hash of its contents, and the ground. saveBaseline runs
// once at boot, on every page that can save.
let saveBase = null; // { obj: [], sum: Uint32Array, ground: Uint8Array, at: Map obj -> tile }
function saveSum(o) {
  let s;
  try { s = JSON.stringify(o); } catch (e) { return 0; } // a cycle: never equal, always written
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) || 1;
}
// A tile object that points at anything but another tile object or a static
// row (a den, a hut or a cairn at its camp's `site`) is LIVE: always written,
// never taken as untouched, because the fresh valley's copy points at the
// fresh page's camp and not at the loaded one. So is anything pointing at a
// live one (the parts of its footprint). A dozen objects on any seed.
function saveBaseline() {
  if (!saveStaticMap) saveStaticMap = saveStatics();
  const obj = objects.slice(), sum = new Uint32Array(obj.length), at = new Map(), live = new Set();
  for (let i = 0; i < obj.length; i++) if (obj[i]) { sum[i] = saveSum(obj[i]); at.set(obj[i], i); }
  const refs = (o, f) => { for (const k of Object.keys(o)) { const v = o[k]; if (v && typeof v === 'object' && !saveStaticMap.has(v)) f(v); } };
  for (let i = 0; i < obj.length; i++) if (obj[i]) refs(obj[i], (v) => { if (!at.has(v)) live.add(i); });
  for (let grew = true; grew;) {
    grew = false;
    for (let i = 0; i < obj.length; i++) if (obj[i] && !live.has(i)) refs(obj[i], (v) => { if (live.has(at.get(v))) { live.add(i); grew = true; } });
  }
  saveBase = { obj, sum, ground: ground.slice(), at, live };
}

// ---- the graph ----------------------------------------------------------------
// JSON with a handful of $-tags, so the body is plain JSON and a shared object
// is written once: {$i} names an object or array written in full, {$r} points
// back at one ({$a} its items, {$p} an array's own fields), {$t} is an
// untouched tile object of the fresh valley, {$k} a row of a static table,
// {$c} the class a body was built from, {$m}/{$s}/{$y}
// a Map, a Set and a typed array, {$f} a number JSON cannot hold, {$u}
// undefined. Functions and canvases are nobody's state and are dropped.
const SAVE_CLASSES = { Player };
// static tables a live body may point INTO (a camp's CAMPS row, a tier of a
// STRUCTS row): any object in them, three levels down, is written as its path
const SAVE_STATIC_DEPTH = 3;
function saveTables() { return { CAMPS, OBJECTS, STRUCTS, CLASSES, TEAMS, MAPS, AI_LEVELS }; }
function saveStatics() {
  const m = new Map(), tables = saveTables();
  const walk = (o, path, d) => {
    if (!o || typeof o !== 'object' || m.has(o) || ArrayBuffer.isView(o) || o instanceof HTMLElement) return;
    m.set(o, path);
    if (d < SAVE_STATIC_DEPTH) for (const k of Object.keys(o)) walk(o[k], path + '.' + k, d + 1);
  };
  for (const n in tables) for (const k of Object.keys(tables[n])) walk(tables[n][k], n + '.' + k, 1);
  return m;
}
let saveStaticMap = null;
function saveStaticOf(n) {
  const ks = n.split('.');
  let o = saveTables()[ks[0]];
  for (let i = 1; i < ks.length; i++) o = o[ks[i]];
  return o;
}

function saveEncode(roots, touched) {
  if (!saveStaticMap) saveStaticMap = saveStatics();
  const seen = new Map(); // object -> times reached (pass 1), then its id (pass 2)
  const leaf = (o) => saveStaticMap.has(o) || (saveBase && saveBase.at.has(o) && !touched.has(saveBase.at.get(o)))
    || typeof o === 'function' || o instanceof HTMLElement || o instanceof CanvasRenderingContext2D;
  // pass 1: how many times each object is reached, so only a shared one pays for an id
  const stack = [roots];
  while (stack.length) {
    const o = stack.pop();
    if (!o || typeof o !== 'object' || leaf(o)) continue;
    const n = seen.get(o);
    seen.set(o, (n || 0) + 1);
    if (n) continue;
    if (ArrayBuffer.isView(o)) continue;
    if (o instanceof Map) { for (const [k, v] of o) stack.push(k, v); continue; }
    if (o instanceof Set) { for (const v of o) stack.push(v); continue; }
    if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) stack.push(o[i]); continue; }
    for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) stack.push(o[k]);
  }
  let nextId = 0;
  const ids = new Map();
  const dropped = new Set();
  const enc = (v, path) => {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return v;
    if (typeof v === 'number') {
      if (v !== v) return { $f: 'N' };
      if (v === Infinity) return { $f: 'I' };
      if (v === -Infinity) return { $f: '-I' };
      if (v === 0 && 1 / v < 0) return { $f: '-0' };
      return v;
    }
    if (v === undefined) return { $u: 1 };
    if (typeof v === 'function' || v instanceof HTMLElement || v instanceof CanvasRenderingContext2D) {
      dropped.add(path); return null;
    }
    if (saveStaticMap.has(v)) return { $k: saveStaticMap.get(v) };
    if (saveBase && saveBase.at.has(v) && !touched.has(saveBase.at.get(v))) return { $t: saveBase.at.get(v) };
    if (ids.has(v)) return { $r: ids.get(v) };
    const shared = seen.get(v) > 1;
    let id = -1;
    if (shared) { id = nextId++; ids.set(v, id); }
    let out;
    if (ArrayBuffer.isView(v)) out = { $y: v.constructor.name, $a: Array.from(v, (x) => enc(x, path)) };
    else if (v instanceof Map) out = { $m: Array.from(v, ([k, x]) => [enc(k, path), enc(x, path + '.<v>')]) };
    else if (v instanceof Set) out = { $s: Array.from(v, (x) => enc(x, path)) };
    else if (Array.isArray(v)) {
      const a = new Array(v.length);
      for (let i = 0; i < v.length; i++) a[i] = enc(v[i], path + '[]');
      // an array can carry fields of its own (a route's `partial`, js/nav.js)
      let props = null;
      if (Object.keys(v).length !== v.length) {
        for (const k of Object.keys(v)) if (!(String(k >>> 0) === k && (k >>> 0) < v.length)) (props || (props = {}))[k] = enc(v[k], path + '.' + k);
      }
      out = shared || props ? { $a: a } : a;
      if (props) out.$p = props;
    } else {
      out = {};
      const cn = v.constructor && v.constructor.name;
      if (cn && cn !== 'Object') {
        if (SAVE_CLASSES[cn]) out.$c = cn;
        else dropped.add(path + ':' + cn);
      }
      for (const k in v) if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = enc(v[k], path + '.' + k);
    }
    if (shared) out.$i = id;
    return out;
  };
  const body = {};
  for (const k of Object.keys(roots)) body[k] = enc(roots[k], k);
  return { body, dropped };
}

function saveDecode(body, tileObj) {
  const ids = [];
  const dec = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(dec);
    if (v.$f !== undefined) return v.$f === 'N' ? NaN : v.$f === 'I' ? Infinity : v.$f === '-I' ? -Infinity : -0;
    if (v.$u !== undefined) return undefined;
    if (v.$r !== undefined) return ids[v.$r];
    if (v.$t !== undefined) return tileObj[v.$t];
    if (v.$k !== undefined) return saveStaticOf(v.$k);
    let out;
    if (v.$y !== undefined) {
      out = new (window[v.$y] || Float64Array)(v.$a.length);
      if (v.$i !== undefined) ids[v.$i] = out;
      for (let i = 0; i < v.$a.length; i++) out[i] = dec(v.$a[i]);
      return out;
    }
    if (v.$m !== undefined) {
      out = new Map();
      if (v.$i !== undefined) ids[v.$i] = out;
      for (const [k, x] of v.$m) out.set(dec(k), dec(x));
      return out;
    }
    if (v.$s !== undefined) {
      out = new Set();
      if (v.$i !== undefined) ids[v.$i] = out;
      for (const x of v.$s) out.add(dec(x));
      return out;
    }
    if (v.$a !== undefined) {
      out = [];
      if (v.$i !== undefined) ids[v.$i] = out;
      for (const x of v.$a) out.push(dec(x));
      if (v.$p) for (const k of Object.keys(v.$p)) out[k] = dec(v.$p[k]);
      return out;
    }
    out = v.$c && SAVE_CLASSES[v.$c] ? Object.create(SAVE_CLASSES[v.$c].prototype) : {};
    if (v.$i !== undefined) ids[v.$i] = out;
    for (const k in v) if (k[0] !== '$') out[k] = dec(v[k]);
    return out;
  };
  const r = {};
  for (const k of Object.keys(body)) r[k] = dec(body[k]);
  return r;
}

// ---- capture and apply ------------------------------------------------------
// The match as one JSON-able record: { v, seed, map, body }. `touched` is
// every tile whose object is not the fresh valley's untouched one; those
// tiles are written out ([tile, object] pairs), and so is every ground tile
// that differs from the grown ground.
function saveCapture() {
  const touched = new Set();
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i], b = saveBase.obj[i];
    if (o !== b || (o && (saveBase.live.has(i) || saveSum(o) !== saveBase.sum[i]))) touched.add(i);
  }
  const roots = {};
  for (const [n, get] of SAVE_ROOTS) roots[n] = get();
  const tiles = [];
  for (const i of touched) tiles.push([i, objects[i]]);
  roots.tiles = tiles;
  const grd = [];
  for (let i = 0; i < ground.length; i++) if (ground[i] !== saveBase.ground[i]) grd.push(i, ground[i]);
  roots.ground = grd;
  const { body, dropped } = saveEncode(roots, touched);
  if (dropped.size) console.warn('save: dropped', [...dropped].slice(0, 12));
  return { v: SAVE_V, seed: SEED, map: MAP_TYPE, body };
}
// the record back onto this page, whose valley must be the saved one's fresh
// (the same seed and shape, no step taken yet). Throws on a record of another
// shape or another world, before touching anything.
function saveApply(rec) {
  if (!rec || rec.v !== SAVE_V) throw new Error('save: version ' + (rec && rec.v));
  if (rec.seed !== SEED || rec.map !== MAP_TYPE) throw new Error('save: another world');
  const r = saveDecode(rec.body, objects);
  for (const [i, o] of r.tiles) objects[i] = o;
  for (let j = 0; j < r.ground.length; j += 2) ground[r.ground[j]] = r.ground[j + 1];
  for (const [n, , put] of SAVE_ROOTS) put(r[n]);
}

// A hash of everything a save carries, for the proof (DBG.saveHash): two
// pages that agree on it at the same tick hold the same match.
// Left out: the camera, and two things that are screen dressing on the wall
// clock rather than the match: the snowfall (updateFx sways it on performance.now, and
// tops it up off fxRng, so it is never saved at all) and so an ember's tint,
// the one draw that stream lends the sim (actions.js).
// what a draw pass keeps on a body, eased on the frame's own clock (the
// wade's look, js/draw/depth.js): the match never reads it, and a page that
// rendered a different count of frames holds different numbers
const SAVE_FRAME_KEYS = new Set(['wadeAt', 'wadeV', 'wadeDX', 'wadeDY', 'wadeMv']);
function saveHash() {
  const b = saveCapture().body;
  b.rng = [b.rng[0], b.rng[2]];
  delete b.view; // the camera is this screen's, and a load eases it in
  b.particles = b.particles.map((q) => { const o = Object.assign({}, q); delete o.color; return o; });
  const s = JSON.stringify(b, (k, v) => SAVE_FRAME_KEYS.has(k) ? undefined : v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { hash: (h >>> 0).toString(16), len: s.length, tick: state.tick };
}

// ---- slots ------------------------------------------------------------------
// Solo matches only: an online match is the host's and a client's sim never
// runs, and the practice room is no match at all. Nor is one already decided.
function canSave() {
  return !PRACTICE && !NET.isClient && NET.role === 'solo' && !!saveBase &&
    (state.mode === 'play' || state.mode === 'drop' || state.mode === 'dead') &&
    state.over !== 'won' && state.over !== 'lost';
}
// the slot's card: everything a list prints, so a list never opens a body
// (the thumbnail's pixels: saveThumb, js/ui/saves.js)
function saveMeta() {
  return {
    name: player.name, cls: player.cls, look: player.look, team: player.team, level: player.level,
    elapsed: state.elapsed, day: state.day, when: Date.now(), seed: SEED, map: MAP_TYPE, thumb: saveThumb(),
  };
}
// the name a card wears: the player's (named in the saves grid, js/ui/saves.js),
// else the day it was kept on
function saveTitleOf(m) { return m.named && m.title ? m.title : 'DAY ' + (m.day || 1); }
// every filled slot's meta, keyed by slot
function saveList() { return PROFILE.saveMetas(); }
// the newest save of all, or null: what the lobby's saves plate shows. Off
// the saves grid's cached read (js/ui/saves.js), since the lobby asks every frame.
function saveNewest() {
  const m = savesMetas();
  let best = null;
  for (const k in m) if (!best || m[k].when > m[best].when) best = k;
  return best;
}
// A body is gzipped (CompressionStream) and kept as base64 behind a 'z', a
// tenth of the JSON - eight of them have to share the browser's few MB with
// the profile. A browser without the stream keeps the plain JSON ('{').
async function saveZip(str) {
  if (typeof CompressionStream === 'undefined') return str;
  const buf = await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const u = new Uint8Array(buf);
  let b = '';
  for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return 'z' + btoa(b);
}
async function saveUnzip(body) {
  if (body[0] !== 'z') return body;
  const b = atob(body.slice(1)), u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

// Write the match into `slot`. The match is taken NOW (synchronously, the
// step the press landed on); only the packing and the write wait. Resolves
// true once it is kept, false when it cannot be saved or storage refused it.
let saveBusy = false;
let saveFlashAt = -1e9; // performance.now() of the last save that landed: the HUD's mark (drawSaveFlash)
function saveMatch(slot) {
  if (!canSave() || saveBusy || state.drag || state.dragPend) return Promise.resolve(false);
  saveBusy = true;
  const meta = saveMeta(), json = JSON.stringify(saveCapture());
  meta.auto = slot[0] === 'a';
  const old = PROFILE.saveMetas()[slot];
  if (old && old.named) { meta.title = old.title; meta.named = true; } // a slot the player named keeps its name when written over
  return saveZip(json).catch(() => json).then((body) => {
    saveBusy = false;
    const ok = PROFILE.putSave(slot, meta, body);
    if (ok) saveFlashAt = performance.now();
    saveUi.metas = null; // an open saves slab reads the slots afresh (js/ui/saves.js)
    return ok;
  });
}

// ---- autosave -----------------------------------------------------------------
// Every SAVE_AUTO_T of match clock, and on the way into the ESC panel, into
// the oldest of the SAVE_AUTO ring - never twice inside SAVE_AUTO_GAP, so
// flicking the panel open and shut does not roll the ring over itself.
const SAVE_AUTO_GAP = 15;       // s of match clock between any two autosaves
let saveAutoAt = SAVE_AUTO_T;   // state.elapsed the next timed autosave is due at
let saveAutoLast = -1e9;        // state.elapsed of the last autosave
function autoSave() {
  if (!canSave() || state.elapsed - saveAutoLast < SAVE_AUTO_GAP) return;
  const m = saveList();
  let slot = null;
  for (let i = 0; i < SAVE_AUTO; i++) {
    const k = 'a' + i;
    if (!m[k]) { slot = k; break; }
    if (!slot || m[k].when < m[slot].when) slot = k;
  }
  saveAutoLast = state.elapsed;
  saveAutoAt = state.elapsed + SAVE_AUTO_T;
  saveMatch(slot);
}
// the frame loop's half (js/boot.js), after the steps
function saveAutoTick() {
  if (state.elapsed >= saveAutoAt && !state.paused && !state.settingsOpen) autoSave();
}

// Load: the body rides sessionStorage to the next page, which grows the saved
// seed in the saved shape and applies it at boot (saveBootLoad).
function loadSave(slot) {
  const m = saveList()[slot], body = PROFILE.saveBody(slot);
  if (!m || !body || state.fade || saveBusy) return false;
  saveBusy = true;
  SFX.music.stop(0.45);
  let ready; // the unpacked body once it is (null: it would not), or the page's go once the dark is down
  const go = (json) => {
    if (json === null) { // the body would not unpack: back out of the dark, nothing lost
      saveBusy = false;
      state.fade = { a: 1, to: 0, spd: 1 / 0.45, color: '#04060f', then: null };
      SFX.deny();
      return;
    }
    try { sessionStorage.setItem('softfall.load', json); } catch (e) { go(null); return; }
    // the character that played it becomes the active one, so what the match
    // adds to a lifetime tally lands on the right card (js/profile.js)
    const ci = PROFILE.chars().findIndex((c) => c.name === m.name && c.cls === m.cls);
    if (ci >= 0) PROFILE.setActive(ci);
    location.href = location.pathname + '?seed=' + m.seed + '&map=' + m.map;
  };
  state.fade = {
    a: 0, to: 1, spd: 1 / 0.45, color: '#04060f',
    then: () => { if (ready !== undefined) go(ready); else ready = go; },
  };
  const done = (json) => { if (ready === go) go(json); else ready = json; };
  saveUnzip(body).then(done, () => done(null));
  return true;
}
// boot's half (js/boot.js): true when a saved match was put back on this page
function saveBootLoad() {
  let raw = null;
  try { raw = sessionStorage.getItem('softfall.load'); sessionStorage.removeItem('softfall.load'); } catch (e) { }
  if (!raw) return false;
  try { saveApply(JSON.parse(raw)); } catch (e) { console.warn(e); return false; }
  saveAutoAt = state.elapsed + SAVE_AUTO_T;
  saveAutoLast = state.elapsed;
  return true;
}
// ...and once boot has finished setting the page up for a title: the match
// comes up out of the dark on the saved camera, its own music under it. No
// HUD slide: the intro's ease moves the camera and pops the day's headline,
// and a loaded match is the saved one, not a landing.
function saveBootEnter() {
  saveBootView();
  state.menu.screen = 'menu'; state.menu.panel = null;
  state.fade = { a: 1, to: 0, spd: 1 / 0.6, color: '#04060f', then: null };
  SFX.music.play(player.aboard ? 'eagle' : 'jump', { in: 0.8 });
}
