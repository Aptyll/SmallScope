// ------------------------------------------------------------ saved matches
// A SAVE is a match frozen at one sim step, whole: every body, arrow in
// flight, building, drop, camp, the counters' stock and prices, the clock and
// the three random streams' positions - so a match put back does not merely
// look like the captured one, it PLAYS OUT exactly as that one would have
// from that step on. Players never save; this stays as the determinism
// proof: DBG.saveHash after stepping a
// match, DBG.saveLoad(DBG.saveCapture()) onto a fresh page, step the same
// count, compare.
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
// sim reads does not - it joins SAVE_ROOTS, or the proof misses it.
//
// The flow: saveDevLoad hands the record to the next page through
// sessionStorage and reloads onto ?seed&map; js/app/boot.js calls saveBootLoad
// after the world stands and before the ground is baked, so the bake paints
// the saved valley and not the fresh one.

// ---- tuning ---------------------------------------------------------------
const SAVE_V = 3;           // the body's shape; a body of another shape is refused, never half-read
                            // (2: the generator grew to the 4x2 gold pump - a 1x1 one would load without its footprint;
                            //  3: player building cut - a save holding a wall or a turret has no STRUCTS entry to load it by)

// ---- what is saved ----------------------------------------------------------
// [name, get, put]: get() hands the live value in, put(v) takes the decoded
// one back. A const container is refilled in place (every file holds the same
// array); a `let` is reassigned (this file shares the one global scope).
// (a save from before the array joined SAVE_ROOTS carries none of it: it loads empty)
function saveArr(a) { return [() => a, (v) => { a.length = 0; if (v) for (const x of v) a.push(x); }]; }
// state's own UI keys are this screen's and never the match's: a load opens
// with every panel shut
const SAVE_STATE_SKIP = new Set(['paused', 'mapOpen', 'charOpen', 'shop',
  'settingsOpen', 'rebind', 'wheel', 'menu', 'intro', 'introLen', 'introFrom', 'fade', 'shake',
  'shopSel', 'shopSlot', 'shopCat']); // the counter's pick and filter (js/ui/shop.js)
const SAVE_ROOTS = [
  ['state', () => { const o = {}; for (const k of Object.keys(state)) if (!SAVE_STATE_SKIP.has(k)) o[k] = state[k]; return o; },
    (v) => Object.assign(state, v)],
  ['players', ...saveArr(players)],
  ['localId', () => localId, (v) => { localId = v; player = players[v]; inv = player.inv; }],
  ['animals', ...saveArr(animals)], ['structures', ...saveArr(structures)], ['robots', ...saveArr(robots)],
  ['arrows', ...saveArr(arrows)],
  ['particles', ...saveArr(particles)], ['floaters', ...saveArr(floaters)], ['footprints', ...saveArr(footprints)],
  ['fish', ...saveArr(fish)], ['holes', ...saveArr(holes)], ['camps', ...saveArr(camps)],
  ['craters', ...saveArr(craters)], ['nets', ...saveArr(nets)], ['abFx', ...saveArr(abFx)],
  ['guards', () => [guards, guardN], (v) => { saveArr(guards)[1](v && v[0]); guardN = v ? v[1] : 0; }], // ARMATOS's standards (js/sim/armatos.js)
  ['wordPops', ...saveArr(wordPops)], ['coinPops', ...saveArr(coinPops)], ['ptargets', ...saveArr(ptargets)], ['slashes', ...saveArr(slashes)],
  ['shed', () => [shedWait, shedLive], (v) => { saveArr(shedWait)[1](v[0]); shedLive = v[1]; }],
  ['iceBreaks', ...saveArr(iceBreaks)], // the breaks in their own shape (js/sim/icebreak.js); their pixels rebuild off them
  // the orca (js/sim/orca.js); a save from before it carries none, and it stays where boot put it
  ['orca', () => orca, (v) => { if (v) Object.assign(orca, ORCA_FRESH(), v); }],
  // the bot callouts (js/ai/ai-callouts.js); a save from before they existed
  // carries none of these, and loads with every side silent
  ['callouts', ...saveArr(callouts)],
  ['callSaid', () => callSaid, (v) => { callSaid[0] = v ? v[0] : {}; callSaid[1] = v ? v[1] : {}; }],
  ['rng', () => [rng.s, fxRng.s], (v) => { rng.s = v[0]; fxRng.s = v[1]; }], // (an old save's third, the market's, is ignored)
  // (a save from before the deer lines carries one number there: both sides start their clock fresh)
  ['wild', () => [deerBackT, fishCap, fishFloor, emergeSites],
    (v) => { deerBackT = Array.isArray(v[0]) ? v[0] : [DEER_BACK, DEER_BACK]; fishCap = v[1]; fishFloor = v[2]; emergeSites = v[3]; }],
  ['ai', () => [aiSitTick, aiSit], (v) => { aiSitTick = v[0]; aiSit = v[1]; }],
  ['aiTeams', ...saveArr(aiTeams)], // the sides' shared minds (js/ai/ai-team.js)
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
      // an array can carry fields of its own (a route's `partial`, js/sim/nav.js)
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
  // a save from before a record field existed: the field starts at nothing
  for (const p of players) for (const k in PLAYER_RECORD) if (p[k] === undefined) p[k] = PLAYER_RECORD[k];
  for (const p of players) if (!p.items) p.items = new Array(ITEM_SLOTS).fill(null); // ...and from before items (js/sim/items.js)
  for (const p of players) { if (!(p.potions >= 0)) p.potions = 0; if (!(p.potT >= 0)) p.potT = 0; } // ...and from before potions
  objTimersRescan(); // the objects with a clock running are an index of the tiles, rebuilt rather than saved (js/sim/sim.js)
}

// A hash of everything a save carries, for the proof (DBG.saveHash): two
// pages that agree on it at the same tick hold the same match.
// Left out: the camera, and two things that are screen dressing on the wall
// clock rather than the match: the snowfall (updateFx sways it on performance.now, and
// tops it up off fxRng, so it is never saved at all) and so an ember's tint,
// the one draw that stream lends the sim (actions.js).
function saveHash() {
  const b = saveCapture().body;
  b.rng = [b.rng[0], b.rng[2]];
  delete b.view; // the camera is this screen's, and a load eases it in
  b.particles = b.particles.map((q) => { const o = Object.assign({}, q); delete o.color; return o; });
  const s = JSON.stringify(b);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { hash: (h >>> 0).toString(16), len: s.length, tick: state.tick };
}

// ---- the dev load -------------------------------------------------------------
// A record (saveCapture) put back on a fresh page: it rides sessionStorage to
// the next page, which grows the record's seed in its shape and applies it at
// boot (saveBootLoad). The replay proof's other half (DBG.saveLoad); nothing a
// player reaches calls it.
function saveDevLoad(rec) {
  try { sessionStorage.setItem('softfall.load', JSON.stringify(rec)); } catch (e) { return false; }
  location.href = location.pathname + '?seed=' + SEED + '&map=' + MAP_TYPE;
  return true;
}
// boot's half (js/app/boot.js): true when a saved match was put back on this page
function saveBootLoad() {
  let raw = null;
  try { raw = sessionStorage.getItem('softfall.load'); sessionStorage.removeItem('softfall.load'); } catch (e) { }
  if (!raw) return false;
  try { saveApply(JSON.parse(raw)); } catch (e) { console.warn(e); return false; }
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
