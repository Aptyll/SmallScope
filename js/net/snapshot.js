// ------------------------------------------------------------ snapshot
// The whole authoritative state of a match as one plain object a host can
// serialize and a client can write back into the singletons - after which
// render() draws it with no change of its own (docs/pvp-architecture.md).
//
// It is built by REFLECTION, not by a field table: every own property of
// every entity goes in, except the few named in SNAP_SKIP, so a field a
// sim file adds tomorrow is carried the day it is added and the schema
// cannot quietly fall behind the game. This file is the CORRECT snapshot,
// and what proves it complete is netEcho() below: render a frame, snapshot,
// blank every singleton, apply, render again, and count the pixels that
// differ - zero or the schema is missing something the eye can see.
//
// THE WIRE FORM is cut from it, not written beside it (the `delta` banner):
// every entity carries a stable network id (snapNid), a host keeps a ring
// of what it packed at each tick and sends each client only the fields that
// changed since the tick that client acked, and
// the whole message goes as binary with every object key as an index into a
// dictionary both ends grow in step and a position as an int16 count of
// eighths of a px (the `encode` banner). A full snapshot
// and a delta write into the singletons through the same apply, and the
// entities a client holds are updated IN PLACE, so a reference resolved a
// tick ago still points at the thing.
//
// References between entities (a bot's home bay, a wolf's target, a part
// tile's anchor, the eagle's merchant) cannot cross a wire as pointers, so
// pack() turns each into a token naming the KIND and the ID - P player id,
// R robot, A animal, W arrow, D drop, F fish by network id, O object tile
// index, C camp index, E eagle by team - and snapResolve() rebuilds them
// once everything they can name exists. Anything that is a per-machine
// concern rather than the match's is skipped: a player's `input` (the host
// fills it), `ai` (the bot brain runs only on the host), `nav` (a route is
// the mover's own business and the client moves nothing), and the `_`
// fields the client's interpolation keeps (js/net/net.js). The eagle's
// `spur` and `pad` are entries of the road registry (`spurs`, js/world.js)
// shared by identity, so the registry is a section of its own and an eagle
// is re-pointed at its entry after the apply; its `lane` (the felling plan,
// with clocks that advance) is merged into the object already there.
const SNAP_SKIP = new Set(['input', 'ai', 'nav', '_fx', '_fy', '_tx', '_ty', '_t0', '_nid',
  // ...and the sim's own bookkeeping that ticks every step and that no draw
  // pass reads: a client neither steps nor shows these, and each is a few
  // bytes per body per snapshot. The echo harness runs WITHOUT them, so
  // adding a name here is proven harmless or caught as pixels
  'trickleT', 'footT', 'footSide', 'puffT', 'dodgeDustT', 'slideDustT', 'eatFxT', 'burnTick', 'fishCd', 'catchT', 'dryT', 'swingCd',
  'idleT', 'wary', 'thinkT', 'moveT', 'turnT', 'emT', 'spook', 'biteCd', 'alertT', 'dashT', 'dashX', 'dashY', 'fleeT', 'fleeGoal', 'goal',
  'avoidT', 'madT', 'madX', 'madY', 'baySite', 'bayDir']);
// the match's own state keys: the clock, the result, the birds. Everything
// else on `state` is one screen's UI (overlays, the menu, the death view)
const SNAP_STATE = ['time', 'elapsed', 'day', 'tick', 'darkness', 'wind', 'windDir', 'windT', 'fishT', 'over', 'end', 'eagleCine'];
const SNAP_DEPTH = 8; // how deep pack() follows plain objects before giving up (a cycle guard)
// the moving kinds, their arrays and their token letters
const SNAP_KINDS = { R: () => robots, A: () => animals, W: () => arrows, D: () => drops, F: () => fish };

// ---- network ids ----------------------------------------------------------
// A stable id per moving entity for its life, so a delta can name it and a
// client can keep it: players are their slot, eagles their team, the rest
// are dealt from a counter the first time a host packs them. A client is
// TOLD the id with each entity and registers it (snapNidSet), so its maps
// answer the same tokens the host wrote.
const snapNids = new WeakMap(); // entity -> nid
const snapMaps = { R: new Map(), A: new Map(), W: new Map(), D: new Map(), F: new Map() }; // kind -> nid -> entity
let snapNidNext = 16;
function snapNid(e) { let n = snapNids.get(e); if (n === undefined) { n = snapNidNext++; snapNids.set(e, n); } return n; }
function snapNidSet(e, n) { snapNids.set(e, n); if (n >= snapNidNext) snapNidNext = n + 1; }
function snapKindOf(v) { for (const k in SNAP_KINDS) if (SNAP_KINDS[k]().indexOf(v) >= 0) return k; return null; }
// which entity this is, if it is one: a token, or null for a plain object
function snapToken(v) {
  if (v.id !== undefined && players[v.id] === v) return { $: 'P', i: v.id };
  if (v.tx !== undefined && v.ty !== undefined && v.type !== undefined && inWorld(v.tx, v.ty) && objects[idx(v.tx, v.ty)] === v) return { $: 'O', i: idx(v.tx, v.ty) };
  const k = snapKindOf(v);
  if (k) { const n = snapNid(v); snapMaps[k].set(n, v); return { $: k, i: n }; }
  let i;
  if ((i = camps.indexOf(v)) >= 0) return { $: 'C', i };
  if (state.drop && (i = state.drop.eagles.indexOf(v)) >= 0) return { $: 'E', i };
  return null;
}
function snapDeref(t) {
  switch (t.$) {
    case 'P': return players[t.i];
    case 'O': return objects[t.i];
    case 'C': return camps[t.i];
    case 'E': return state.drop ? state.drop.eagles[t.i] : null;
  }
  const m = snapMaps[t.$];
  return m ? m.get(t.i) || null : null;
}
// a plain copy of v with entities turned into tokens. `top` is the entity
// itself, whose own fields are copied even though it would token-ise
function pack(v, depth, top) {
  if (v === null || v === undefined) return v === undefined ? undefined : null;
  // JSON has no Infinity or NaN (both become null): a timer pinned at
  // Infinity would come back as nothing, so the three ride as marked objects
  if (typeof v === 'number') return Number.isFinite(v) ? v : { $n: v === Infinity ? 1 : v === -Infinity ? -1 : 0 };
  if (typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (!top) { const t = snapToken(v); if (t) return t; }
  if (depth > SNAP_DEPTH) return undefined;
  if (v instanceof Map) return { $map: [...v.entries()] };
  if (v instanceof Set) return { $set: [...v] };
  if (v instanceof Uint8Array) return { $u8: snapB64(v) };
  if (Array.isArray(v)) { const a = new Array(v.length); for (let i = 0; i < v.length; i++) a[i] = pack(v[i], depth + 1); return a; }
  const o = {};
  for (const k of Object.keys(v)) {
    if (SNAP_SKIP.has(k)) continue;
    const pv = pack(v[k], depth + 1);
    if (pv !== undefined) o[k] = pv;
  }
  return o;
}
// an entity's packed form, carrying its network id
function packEnt(e, kind) {
  const o = pack(e, 0, true);
  if (kind) { const n = snapNid(e); snapMaps[kind].set(n, e); o._nid = n; }
  return o;
}
// the inverse, with tokens left in place: snapResolve() swaps them for the
// entities once every array stands
function unpack(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v.$n !== undefined) return v.$n === 1 ? Infinity : v.$n === -1 ? -Infinity : NaN;
  if (v.$map) return new Map(v.$map);
  if (v.$set) return new Set(v.$set);
  if (v.$u8) return snapUnB64(v.$u8);
  if (Array.isArray(v)) return v.map(unpack);
  const o = {};
  for (const k of Object.keys(v)) o[k] = unpack(v[k]);
  return o;
}
function snapIsToken(v) { return v !== null && typeof v === 'object' && typeof v.$ === 'string' && v.i !== undefined; }
function snapResolve(v, seen) {
  if (v === null || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { if (snapIsToken(v[i])) v[i] = snapDeref(v[i]); else snapResolve(v[i], seen); } return; }
  if (v instanceof Map || v instanceof Set || ArrayBuffer.isView(v)) return;
  for (const k of Object.keys(v)) { const c = v[k]; if (snapIsToken(c)) v[k] = snapDeref(c); else snapResolve(c, seen); }
}
function snapB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function snapUnB64(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

// ---- build ---------------------------------------------------------------
// the singletons beside the entities: the match's state keys, the road
// registry, the ice, the nets, the market, the camps' clocks, the ride
function snapSingles() {
  const s = { state: {}, camps: [] };
  for (const k of SNAP_STATE) { const v = pack(state[k], 0); if (v !== undefined) s.state[k] = v; }
  for (const c of camps) s.camps.push({ repopT: c.repopT }); // the rest of a camp is written down by worldgen
  s.dropMeta = state.drop ? { firstFlight: state.drop.firstFlight } : null;
  s.spurs = pack(spurs, 0); // the road registry: each side's paved spur and its crash pad
  s.holes = holes.slice();
  s.iceCracks = [...iceCracks.entries()];
  s.nets = pack(nets, 0);
  s.market = pack(market, 0);
  return s;
}
function snapBuild() {
  const s = Object.assign({ v: 2, players: [], objects: {}, structs: [] }, snapSingles());
  for (const p of players) s.players.push(packEnt(p));
  for (let i = 0; i < objects.length; i++) if (objects[i]) s.objects[i] = pack(objects[i], 0, true);
  for (const o of structures) s.structs.push(idx(o.tx, o.ty));
  for (const k in SNAP_KINDS) s[k] = SNAP_KINDS[k]().map((e) => packEnt(e, k));
  s.eagles = state.drop ? state.drop.eagles.map((e) => pack(e, 0, true)) : [];
  s.ground = snapB64(ground);
  return s;
}
// bytes per section of the JSON form - the budget the wire form is cut from
function snapSize(s) {
  s = s || snapBuild();
  const out = { total: JSON.stringify(s).length };
  for (const k of Object.keys(s)) out[k] = JSON.stringify(s[k]).length;
  return out;
}

// ---- apply ---------------------------------------------------------------
// the singletons back; `s` is a full snapshot or a delta carrying only what changed
function snapApplySingles(s) {
  if (s.state) for (const k of Object.keys(s.state)) state[k] = unpack(s.state[k]);
  if (s.camps) for (let i = 0; i < camps.length && i < s.camps.length; i++) camps[i].repopT = s.camps[i].repopT;
  if (s.dropMeta !== undefined) {
    if (!s.dropMeta) state.drop = null;
    else { if (!state.drop) state.drop = { eagles: [], firstFlight: s.dropMeta.firstFlight }; state.drop.firstFlight = s.dropMeta.firstFlight; }
  }
  if (s.spurs) {
    // the road registry, merged by (team, pad) so an entry keeps its identity
    const keep = [];
    for (const src of unpack(s.spurs)) {
      let sp = spurs.find((q) => q.team === src.team && !!q.pad === !!src.pad);
      if (sp) { for (const k of Object.keys(sp)) delete sp[k]; Object.assign(sp, src); } else sp = src;
      keep.push(sp);
    }
    spurs.length = 0; for (const sp of keep) spurs.push(sp);
  }
  if (s.holes) { holes.length = 0; for (const h of s.holes) holes.push(h); }
  if (s.iceCracks) { iceCracks.clear(); for (const [k, v] of s.iceCracks) iceCracks.set(k, v); }
  if (s.nets) { nets.length = 0; for (const n of unpack(s.nets)) nets.push(n); }
  if (s.market) { const mk = unpack(s.market); for (const k of Object.keys(mk)) market[k] = mk[k]; }
}
// a field onto an entity the game holds by identity: a nested plain object
// is merged into the one already there (a player's `inv` is aliased by the
// HUD, its `food`, `kit`, `flag` and `look` are read through the body), the
// rest is set
const SNAP_MERGE = new Set(['inv', 'food', 'kit', 'flag', 'spawn', 'look']); // the only fields merged in place: plain data the game holds by handle
function snapAssign(e, k, v) {
  const old = e[k];
  // never a token (it names another entity; merging its two keys into the
  // object already here would gut that entity before the token resolved)
  if (SNAP_MERGE.has(k) && v && old && typeof v === 'object' && typeof old === 'object' && !Array.isArray(v) && !Array.isArray(old) && !snapIsToken(v)) {
    for (const kk of Object.keys(old)) if (!(kk in v)) delete old[kk];
    Object.assign(old, v);
  } else e[k] = v;
}
// an eagle's fields onto the object already there (the drop points at it)
function snapEagleFields(e, src) {
  for (const k of Object.keys(src)) {
    const u = unpack(src[k]);
    // the lane keeps its identity (its clocks are read by the object's own handle)
    if (k === 'lane' && u && e.lane && typeof e.lane === 'object') { for (const kk of Object.keys(e.lane)) delete e.lane[kk]; Object.assign(e.lane, u); }
    else e[k] = u;
  }
}
function snapEaglesRepoint() {
  if (!state.drop) return;
  for (const e of state.drop.eagles) {
    if (e.spur) e.spur = spurs.find((q) => q.team === e.team && !q.pad) || e.spur;
    if (e.pad) e.pad = spurs.find((q) => q.team === e.team && q.pad) || e.pad;
  }
}
// the tiles and the ground: wholesale from the full form, where they changed
// from a delta; then the structures registry re-pointed at the tiles
function snapApplyTiles(s) {
  const tiles = s.objects || s.objDiff || null;
  const wholeAt = s.objWholeAt ? new Set(s.objWholeAt) : null;
  if (tiles) {
    if (s.objects) objects.fill(null);
    for (const i in tiles) {
      const u = tiles[i] ? unpack(tiles[i]) : null, old = objects[i];
      // a tile that is still there changes IN PLACE: a bot's home bay, a
      // part's anchor and the structures registry hold it by identity. A
      // full form carries whole tiles; a delta carries the fields that
      // changed (and the names that left as $del), or the whole tile when
      // it was made or unmade since the base (objWhole for all, objWholeAt
      // for the named ones) - then a key absent from it left, but never
      // the bookkeeping the wire skips
      if (u && old) {
        if (s.objects || s.objWhole || (wholeAt && wholeAt.has(+i))) { for (const k of Object.keys(old)) if (!(k in u) && !SNAP_SKIP.has(k)) delete old[k]; }
        if (u.$del) { for (const k of u.$del) delete old[k]; delete u.$del; }
        Object.assign(old, u);
      } else objects[i] = u;
    }
  }
  if (s.structs) { structures.length = 0; for (const i of s.structs) if (objects[i]) structures.push(objects[i]); }
  // the ground: only tiles that changed are repainted - the whole array is
  // a boot-time bake (repaintGround, js/draw/ground.js)
  if (s.ground) {
    const g = snapUnB64(s.ground);
    for (let i = 0; i < ground.length; i++) if (ground[i] !== g[i]) { ground[i] = g[i]; repaintGround(i % WORLD, (i / WORLD) | 0); }
  } else if (s.groundDiff) {
    for (let k = 0; k < s.groundDiff.length; k += 2) { const i = s.groundDiff[k]; ground[i] = s.groundDiff[k + 1]; repaintGround(i % WORLD, (i / WORLD) | 0); }
  }
  return tiles;
}
// Writes a FULL snapshot into the singletons. Existing Player and eagle
// objects are kept and overwritten field by field - `player`, `inv` and the
// drop point at them - every other array is rebuilt, and each entity is
// registered under the id the host dealt it. Tokens are resolved last, once
// everything they can name exists again.
function snapApply(s) {
  snapApplySingles(s);
  const tiles = snapApplyTiles(s) || {};
  for (const k in SNAP_KINDS) {
    const arr = SNAP_KINDS[k](), m = snapMaps[k];
    arr.length = 0; m.clear();
    for (const src of s[k]) { const e = unpack(src); const n = e._nid; delete e._nid; if (n !== undefined) { snapNidSet(e, n); m.set(n, e); } arr.push(e); }
  }
  for (let i = 0; i < players.length; i++) {
    const src = s.players[i], p = players[i];
    for (const k of Object.keys(src)) if (k !== '_nid') snapAssign(p, k, unpack(src[k]));
  }
  if (state.drop) {
    for (let i = 0; i < s.eagles.length; i++) snapEagleFields(state.drop.eagles[i] || (state.drop.eagles[i] = {}), s.eagles[i]);
    state.drop.eagles.length = s.eagles.length;
  }
  snapEaglesRepoint();
  // and the references, now that everything they can point at exists
  const seen = new Set();
  for (const p of players) snapResolve(p, seen);
  for (const i of Object.keys(tiles)) if (objects[i]) snapResolve(objects[i], seen);
  for (const k in SNAP_KINDS) snapResolve(SNAP_KINDS[k](), seen);
  snapResolve(nets, seen);
  if (state.drop) snapResolve(state.drop.eagles, seen);
  snapResolve(state.end, seen); snapResolve(state.eagleCine, seen);
}

// ------------------------------------------------------------ delta
// What a host sends every snapshot tick: per entity, only the fields that
// changed since a BASE the client has confirmed it holds; the order each
// array stands in when it changed since then; the ids that left since then;
// the tiles and the ground where they changed since then; and each
// singleton only where its packed form differs. The base is ACK-KEYED: the
// host keeps a ring of what it packed at each flush tick (snapHistoryPush,
// HIST_KEEP deep), a client acks the newest tick it applied on every input
// it sends, and each client's delta is cut against the ring entry at ITS
// ack (snapDeltaFrom) - so a delta lost on an unreliable channel is not
// lost for good: the ack does not move, and the next delta carries the
// same changes again. An ack older than the ring earns a full sync. On a
// reliable channel the ack simply trails the send by a round trip and the
// delta is a few fields fatter for it. A primitive field compares by value
// - a quantized one (SNAP_QUANT, the `encode` banner) by the value the
// client will hold - a nested one (a bag, a route's points, a building's
// bots) by its JSON. A tile goes field by field against what it was at the
// base: each ring entry keeps the before-form of every tile it changed, so
// any base in the ring can be reconstructed tile by tile without a shadow
// of the whole world per tick.
const HIST_KEEP = 75; // flush ticks kept in the ring: 5 s at 15 Hz. An ack older than this is a full sync
const snapShadow = { objs: null, ground: null, hist: [], byTick: new Map() };
function snapShadowReset() {
  snapShadow.objs = null; snapShadow.ground = null;
  snapShadow.hist = []; snapShadow.byTick = new Map();
}
snapShadowReset();
function snapSame(va, vb) {
  if (va === vb) return true;
  if (va === null || vb === null || typeof va !== 'object' || typeof vb !== 'object') return false;
  return JSON.stringify(va) === JSON.stringify(vb);
}
// the fields of `packed` that differ from `prev` (all of them for a first
// send), plus the names that left as `$del`; null when nothing changed.
// A quantized field (SNAP_QUANT) compares AS THE CLIENT WILL SEE IT: the
// shadow holds the exact value, but a body nudged less than a quantum has
// not moved on the wire, and resending it would be bytes for nothing
function snapFieldDiff(packed, prev) {
  if (!prev) return packed;
  let out = null, del = null;
  for (const k of Object.keys(packed)) { if (!snapSame(snapQv(k, packed[k]), snapQv(k, prev[k]))) { (out = out || {})[k] = packed[k]; } }
  for (const k of Object.keys(prev)) if (!(k in packed)) (del = del || []).push(k);
  if (del) { (out = out || {}).$del = del; }
  return out;
}
// The world as packed at this tick, into the ring, WITH what changed since
// the previous entry: per entity the names that changed or left (null for
// an entity new this tick - whole), the ids that left, whether the order
// moved, the same for the eagles and the singletons, each tile's changed
// names (null for one made or unmade), the ground cells, the structures'
// key. A cut from any base is the UNION of the entries after it, not a
// compare of the two ends: a client behind a lossy wire may hold any tick
// between the base and now (its ack is in flight), so a field that flipped
// and flipped back must still go, or the client keeps the flip. Idempotent
// within a tick. The tile shadow (the newest form of every tile) is updated
// here, so the ring holds no world per tick, only what moved.
function snapHistoryPush() {
  const sh = snapShadow, tick = state.tick;
  const have = sh.byTick.get(tick);
  if (have) return have;
  const p = sh.hist.length ? sh.hist[sh.hist.length - 1] : null; // the previous entry
  const h = { tick, ents: {}, order: {}, orderKey: {}, chg: {}, gone: {}, orderMoved: {}, eagles: [], eagleChg: [], singles: null, singlesJs: {}, singlesChg: {}, structs: '', structsMoved: false, tiles: null, groundCh: null };
  const namesOf = (f) => { const n = new Set(Object.keys(f)); if (f.$del) { n.delete('$del'); for (const k of f.$del) n.add(k); } return n; };
  for (const kind of ['P', ...Object.keys(SNAP_KINDS)]) {
    const arr = kind === 'P' ? players : SNAP_KINDS[kind]();
    const m = new Map(), order = [], chg = new Map(), was = p ? p.ents[kind] : null;
    for (const e of arr) {
      const packed = packEnt(e, kind === 'P' ? null : kind);
      const n = kind === 'P' ? e.id : packed._nid;
      delete packed._nid;
      m.set(n, packed); order.push(n);
      const prev = was ? was.get(n) : null;
      const f = snapFieldDiff(packed, prev);
      if (f) chg.set(n, prev ? namesOf(f) : null);
    }
    const gone = new Set();
    if (was) for (const n of was.keys()) if (!m.has(n)) gone.add(n);
    h.ents[kind] = m; h.order[kind] = order; h.orderKey[kind] = order.join(',');
    h.chg[kind] = chg; h.gone[kind] = gone; h.orderMoved[kind] = !p || p.orderKey[kind] !== h.orderKey[kind];
  }
  h.eagles = state.drop ? state.drop.eagles.map((e) => pack(e, 0, true)) : [];
  for (let i = 0; i < h.eagles.length; i++) { const prev = p ? p.eagles[i] : null; const f = snapFieldDiff(h.eagles[i], prev); if (f) h.eagleChg[i] = prev ? namesOf(f) : null; }
  h.singles = snapSingles();
  for (const k of Object.keys(h.singles)) {
    const v = h.singles[k], isObj = v && typeof v === 'object' && !Array.isArray(v);
    const pv = p ? p.singles[k] : undefined, pObj = pv && typeof pv === 'object' && !Array.isArray(pv);
    if (isObj) { if (pObj) { const f = snapFieldDiff(v, pv); if (f) h.singlesChg[k] = namesOf(f); } else h.singlesChg[k] = true; }
    else { h.singlesJs[k] = JSON.stringify(v); if (!p || pObj || p.singlesJs[k] !== h.singlesJs[k]) h.singlesChg[k] = true; }
  }
  h.structs = structures.map((o) => idx(o.tx, o.ty)).join(',');
  h.structsMoved = !p || p.structs !== h.structs;
  // tiles against the newest shadow: a tile whose primitive fields all match
  // is skipped without packing (most of the world, every tick)
  if (!sh.objs) sh.objs = new Array(objects.length).fill(null);
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i], prev = sh.objs[i];
    if (!o && !prev) continue;
    if (o && prev && snapTileSame(o, prev)) continue;
    const packed = o ? pack(o, 0, true) : null;
    const f = packed && prev ? snapFieldDiff(packed, prev) : null;
    if (packed && prev && !f) { sh.objs[i] = packed; continue; }
    (h.tiles = h.tiles || new Map()).set(i, f ? namesOf(f) : null); // null: made or unmade - whole
    sh.objs[i] = packed;
  }
  if (!sh.ground) { sh.ground = new Uint8Array(ground); }
  else for (let i = 0; i < ground.length; i++) if (ground[i] !== sh.ground[i]) { (h.groundCh = h.groundCh || new Set()).add(i); sh.ground[i] = ground[i]; }
  sh.hist.push(h); sh.byTick.set(tick, h);
  while (sh.hist.length > HIST_KEEP) sh.byTick.delete(sh.hist.shift().tick);
  return h;
}
// the ring entry at a tick, or null when it has aged out (or was never pushed)
function snapHistoryAt(tick) { return snapShadow.byTick.get(tick) || null; }
// The delta from ring entry `base` to the newest entry `h`: everything any
// entry after the base touched, as it stands now (base null: from nothing -
// everything, the first send). `d.base` names the base tick (-1 for
// nothing) so a client can refuse a delta built on a state it never had.
function snapDeltaFrom(h, base) {
  const d = { v: 2, tick: h.tick, base: base ? base.tick : -1 };
  const sh = snapShadow;
  const after = base ? sh.hist.slice(sh.hist.indexOf(base) + 1) : null; // the entries after the base, oldest first
  // the fields of `packed` named by `names`, present ones by value, absent ones as $del
  const pick = (packed, names) => { let f = null, del = null; for (const k of names) { if (k in packed) (f = f || {})[k] = packed[k]; else (del = del || []).push(k); } if (del) (f = f || {}).$del = del; return f; };
  for (const kind of ['P', ...Object.keys(SNAP_KINDS)]) {
    const now = h.ents[kind];
    let ch = null, del = null, order = !base;
    if (!base) { for (const [n, packed] of now) (ch = ch || []).push([n, packed]); }
    else {
      const names = new Map(); // id -> Set of names, or null for whole
      for (const e of after) {
        for (const [n, ns] of e.chg[kind]) { const cur = names.get(n); if (ns === null || cur === null) names.set(n, null); else { if (!cur) names.set(n, new Set(ns)); else for (const k of ns) cur.add(k); } }
        for (const n of e.gone[kind]) if (!names.has(n)) names.set(n, new Set()); // touched: gone at some point
        if (e.orderMoved[kind]) order = true;
      }
      for (const [n, ns] of names) {
        const packed = now.get(n);
        if (!packed) { (del = del || []).push(n); continue; }
        const f = ns === null ? packed : pick(packed, ns);
        if (f) (ch = ch || []).push([n, f]);
      }
    }
    const k = {};
    if (ch) k.ch = ch;
    if (del) k.del = del;
    if (order) k.order = h.order[kind];
    if (ch || del || order) d[kind] = k;
  }
  // the eagles, by team
  const es = [];
  for (let i = 0; i < h.eagles.length; i++) {
    let ns = base ? undefined : null;
    if (base) for (const e of after) { const c = e.eagleChg[i]; if (c === undefined) continue; if (c === null || ns === null) ns = null; else { if (!ns) ns = new Set(c); else for (const k of c) ns.add(k); } }
    if (ns === undefined) continue;
    const f = ns === null ? h.eagles[i] : pick(h.eagles[i], ns);
    if (f) es.push([i, f]);
  }
  if (es.length) d.eagles = es;
  // the singletons: a plain object (the state keys, the market) by the names
  // touched, an array (the registry, the ice, the nets) whole when touched
  for (const k of Object.keys(h.singles)) {
    const v = h.singles[k], isObj = v && typeof v === 'object' && !Array.isArray(v);
    let ns = base ? undefined : true;
    if (base) for (const e of after) { const c = e.singlesChg[k]; if (c === undefined) continue; if (c === true || ns === true) ns = true; else { if (!ns) ns = new Set(c); else for (const kk of c) ns.add(kk); } }
    if (ns === undefined) continue;
    if (ns === true || !isObj) d[k] = v; else { const f = pick(v, ns); if (f) d[k] = f; }
  }
  // tiles and ground: every cell any entry after the base touched. A tile
  // made or unmade at any point goes whole (or null, gone now); one only
  // edited goes by the names touched; a ground cell goes as it stands.
  // With no base everything goes whole, and the apply is told so
  let objDiff = null, g = null;
  if (!base) {
    for (let i = 0; i < sh.objs.length; i++) if (sh.objs[i]) (objDiff = objDiff || {})[i] = sh.objs[i];
    if (objDiff) d.objWhole = true;
  } else {
    const tiles = new Map(), cells = new Set();
    for (const e of after) {
      if (e.tiles) for (const [i, ns] of e.tiles) { const cur = tiles.get(i); if (ns === null || cur === null) tiles.set(i, null); else { if (!cur) tiles.set(i, new Set(ns)); else for (const k of ns) cur.add(k); } }
      if (e.groundCh) for (const i of e.groundCh) cells.add(i);
    }
    for (const [i, ns] of tiles) {
      const now = sh.objs[i];
      if (!now) { (objDiff = objDiff || {})[i] = null; continue; }
      const f = ns === null ? now : pick(now, ns);
      if (f) (objDiff = objDiff || {})[i] = f;
      if (ns === null) (d.objWholeAt = d.objWholeAt || []).push(i); // this one is whole: keys absent from it left
    }
    for (const i of cells) (g = g || []).push(i, sh.ground[i]);
  }
  if (objDiff) d.objDiff = objDiff;
  if (g) d.groundDiff = g;
  if (!base || after.some((e) => e.structsMoved)) d.structs = h.structs ? h.structs.split(',').map(Number) : [];
  return d;
}
// this tick's delta against the previous push (the reliable channel's form,
// and what the in-page proofs send): everything on a first call
function snapBuildDelta() {
  const sh = snapShadow;
  const last = sh.hist.length ? sh.hist[sh.hist.length - 1] : null;
  const h = snapHistoryPush();
  const base = last === h ? (sh.hist.length > 1 ? sh.hist[sh.hist.length - 2] : null) : last;
  return snapDeltaFrom(h, base);
}
// the no-allocation test a live tile takes against its packed shadow: true
// only when every field is a primitive equal to the shadow's and the key
// counts match; anything nested or non-finite falls through to the full diff
function snapTileSame(o, prev) {
  let n = 0;
  for (const k in o) {
    if (SNAP_SKIP.has(k)) continue;
    const v = o[k];
    if (v === undefined || typeof v === 'function') continue;
    n++;
    if (v === null || typeof v === 'string' || typeof v === 'boolean') { if (prev[k] !== v) return false; continue; }
    if (typeof v === 'number') { if (!Number.isFinite(v) || prev[k] !== v) return false; continue; }
    return false;
  }
  return n === Object.keys(prev).length;
}
// a delta into the singletons: entities updated in place under their ids,
// arrays re-ordered as the host's stand, departures dropped. Returns the
// entities whose fields changed (the caller's interpolation reads them), or
// null when an id the host named is missing here - a full sync is owed then.
function snapApplyDelta(d) {
  let lost = false;
  const changed = [];
  snapApplySingles(d);
  const tiles = snapApplyTiles(d) || {};
  const applyFields = (e, f) => {
    for (const k of Object.keys(f)) { if (k === '$del') { for (const kk of f.$del) delete e[kk]; } else snapAssign(e, k, unpack(f[k])); }
    changed.push([e, f]);
  };
  if (d.P) { if (d.P.ch) for (const [n, f] of d.P.ch) applyFields(players[n], f); }
  for (const k in SNAP_KINDS) {
    const dk = d[k]; if (!dk) continue;
    const arr = SNAP_KINDS[k](), m = snapMaps[k];
    if (dk.del) for (const n of dk.del) m.delete(n);
    if (dk.ch) for (const [n, f] of dk.ch) { let e = m.get(n); if (!e) { e = {}; snapNidSet(e, n); m.set(n, e); } applyFields(e, f); }
    if (dk.order) { arr.length = 0; for (const n of dk.order) { const e = m.get(n); if (e) arr.push(e); else lost = true; } }
  }
  if (d.eagles && state.drop) for (const [i, f] of d.eagles) { const e = state.drop.eagles[i] || (state.drop.eagles[i] = {}); snapEagleFields(e, f); changed.push([e, f]); }
  snapEaglesRepoint();
  const seen = new Set();
  for (const [e] of changed) snapResolve(e, seen);
  for (const i of Object.keys(tiles)) if (objects[i]) snapResolve(objects[i], seen);
  if (d.nets) snapResolve(nets, seen);
  if (d.state) { snapResolve(state.end, seen); snapResolve(state.eagleCine, seen); }
  return lost ? null : changed;
}

// ------------------------------------------------------------ encode
// The bytes: a compact binary form of any snapshot-shaped value, with every
// object key an index into a DICTIONARY both ends grow in step - a message
// begins with the names from index `from` to the end of the list, written
// BY POSITION on the far side, so a message lost on the way loses no name
// (the next carries them again) and a repeat is harmless. A host passes
// the length its dictionary had after the message that client last acked
// (js/net/net.js); the full sync passes 0 and carries the whole list.
// Numbers go as the smallest
// integer that holds them or a float32; strings as utf8; the rest by tag.
//
// QUANTIZED FIELDS: a position or a velocity crosses as an int16 count of
// EIGHTHS of a px (Q16, 3 bytes against a float32's 5), and only those - a
// field is quantized by its NAME at encode time, so a timer, hp, gold or
// anything the HUD prints as a number never is. The host reads nothing
// back: the sim keeps its exact floats and only the bytes to a client are
// coarse. Why an eighth: a sprite lands at Math.round(x - camera), so any
// error under half a px is invisible at rest, and the sim's own sub-px
// nudges (separateUnits' pushes, a knockback decaying toward zero for
// ever) fall below it - which is what lets the shadow compare (snapFieldDiff)
// drop a body that has not moved on the wire. A position is FLOORED, not
// rounded: for a camera on the same grid, Math.round(floor8(x) - c) ===
// Math.round(x - c) exactly (the floor shifts by less than the distance to
// the next rounding edge), so the echo's frame cannot move a pixel, where a
// rounding quantizer can. A velocity is ROUNDED: it is only ever a direction
// on a client (an arrow's heading, a bolt's), and flooring a knockback
// decayed to 1e-100 would hand it -0.125 for good. A value past ±4095 px
// (or px/s) falls through to the float32 unchanged.
const SNAP_Q = 8;                     // quanta per px
const SNAP_Q_MAX = 32767 / SNAP_Q;    // the int16's reach in px
const SNAP_QPOS = new Set(['x', 'y']);                                  // floored
const SNAP_QUANT = new Set(['x', 'y', 'vx', 'vy', 'kbx', 'kby']);       // all of them; kbx/kby are a knockback's velocity, same unit as vx
function snapQable(k, v) { return SNAP_QUANT.has(k) && typeof v === 'number' && v >= -SNAP_Q_MAX && v <= SNAP_Q_MAX; } // NaN/Infinity fail the range
function snapQi(k, v) { return SNAP_QPOS.has(k) ? Math.floor(v * SNAP_Q) : Math.round(v * SNAP_Q); } // the int16 on the wire
function snapQv(k, v) { return snapQable(k, v) ? snapQi(k, v) / SNAP_Q : v; } // what the client will hold for field k
const ENC_TAG = { NULL: 0, FALSE: 1, TRUE: 2, I8: 3, I16: 4, I32: 5, F32: 6, F64: 7, STR: 8, ARR: 9, OBJ: 10, Q16: 11 };
function encDict() { return { names: [], index: new Map() }; }
const encTextEnc = new TextEncoder(), encTextDec = new TextDecoder();
function snapEncode(value, dict, from) {
  let buf = new Uint8Array(1 << 16), view = new DataView(buf.buffer), pos = 0;
  const need = (n) => { if (pos + n > buf.length) { let len = buf.length * 2; while (len < pos + n) len *= 2; const nb = new Uint8Array(len); nb.set(buf); buf = nb; view = new DataView(buf.buffer); } };
  const u8 = (v) => { need(1); buf[pos++] = v; };
  const u16 = (v) => { need(2); view.setUint16(pos, v); pos += 2; };
  const u32 = (v) => { need(4); view.setUint32(pos, v); pos += 4; };
  const str = (s) => { const b = encTextEnc.encode(s); need(4 + b.length); view.setUint32(pos, b.length); pos += 4; buf.set(b, pos); pos += b.length; };
  // a key that is a number (a tile index) goes as one, not as a dictionary
  // name: the world has fifty thousand of them and a dictionary would carry every one
  const key = (k) => {
    if (k.length && k.length < 10 && /^[0-9]+$/.test(k)) { u16(0xFFFF); u32(+k); return; }
    let i = dict.index.get(k); if (i === undefined) { i = dict.names.length; dict.names.push(k); dict.index.set(k, i); } u16(i);
  };
  // `k` is the key this value sits under, when it sits under one: a
  // quantized field is known by its name (an array element has none)
  const put = (v, k) => {
    if (v === null || v === undefined) { u8(ENC_TAG.NULL); return; }
    if (v === false) { u8(ENC_TAG.FALSE); return; }
    if (v === true) { u8(ENC_TAG.TRUE); return; }
    if (k !== undefined && snapQable(k, v)) { u8(ENC_TAG.Q16); need(2); view.setInt16(pos, snapQi(k, v)); pos += 2; return; }
    if (typeof v === 'number') {
      if (Number.isInteger(v) && v >= -2147483648 && v <= 2147483647) {
        if (v >= -128 && v <= 127) { u8(ENC_TAG.I8); need(1); view.setInt8(pos, v); pos += 1; }
        else if (v >= -32768 && v <= 32767) { u8(ENC_TAG.I16); need(2); view.setInt16(pos, v); pos += 2; }
        else { u8(ENC_TAG.I32); need(4); view.setInt32(pos, v); pos += 4; }
      } else if (Math.abs(v) < 1e6 && Math.fround(v) === v) { u8(ENC_TAG.F32); need(4); view.setFloat32(pos, v); pos += 4; }
      else { u8(ENC_TAG.F64); need(8); view.setFloat64(pos, v); pos += 8; }
      return;
    }
    if (typeof v === 'string') { u8(ENC_TAG.STR); str(v); return; }
    if (Array.isArray(v)) { u8(ENC_TAG.ARR); u32(v.length); for (const x of v) put(x); return; }
    const keys = Object.keys(v);
    u8(ENC_TAG.OBJ); u32(keys.length);
    for (const k of keys) { key(k); put(v[k], k); }
  };
  put(value);
  // the header: every name from `from` (this message's own fresh ones included)
  from = from || 0;
  const hb = encTextEnc.encode(JSON.stringify([from, dict.names.slice(from)]));
  const out = new Uint8Array(4 + hb.length + pos);
  new DataView(out.buffer).setUint32(0, hb.length);
  out.set(hb, 4); out.set(buf.subarray(0, pos), 4 + hb.length);
  return out;
}
function snapDecode(bytes, dict) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const hl = view.getUint32(0); pos = 4;
  const [from, names] = JSON.parse(encTextDec.decode(bytes.subarray(pos, pos + hl))); pos += hl;
  for (let i = 0; i < names.length; i++) { dict.names[from + i] = names[i]; dict.index.set(names[i], from + i); }
  const get = () => {
    const t = bytes[pos++];
    switch (t) {
      case ENC_TAG.NULL: return null;
      case ENC_TAG.FALSE: return false;
      case ENC_TAG.TRUE: return true;
      case ENC_TAG.I8: return view.getInt8(pos++);
      case ENC_TAG.I16: { const v = view.getInt16(pos); pos += 2; return v; }
      case ENC_TAG.I32: { const v = view.getInt32(pos); pos += 4; return v; }
      case ENC_TAG.F32: { const v = view.getFloat32(pos); pos += 4; return v; }
      case ENC_TAG.F64: { const v = view.getFloat64(pos); pos += 8; return v; }
      case ENC_TAG.Q16: { const v = view.getInt16(pos) / SNAP_Q; pos += 2; return v; }
      case ENC_TAG.STR: { const n = view.getUint32(pos); pos += 4; const s = encTextDec.decode(bytes.subarray(pos, pos + n)); pos += n; return s; }
      case ENC_TAG.ARR: { const n = view.getUint32(pos); pos += 4; const a = new Array(n); for (let i = 0; i < n; i++) a[i] = get(); return a; }
      case ENC_TAG.OBJ: {
        const n = view.getUint32(pos); pos += 4; const o = {};
        for (let i = 0; i < n; i++) {
          const ki = view.getUint16(pos); pos += 2;
          let k; if (ki === 0xFFFF) { k = String(view.getUint32(pos)); pos += 4; } else k = dict.names[ki];
          o[k] = get();
        }
        return o;
      }
    }
    throw new Error('snapDecode: bad tag ' + t + ' at ' + (pos - 1));
  };
  return get();
}

// ------------------------------------------------------------ the echo harness
// Empties every singleton the snapshot claims to carry, so that what the
// next frame shows is what the snapshot brought back and nothing else
function snapBlank() {
  for (const p of players) {
    const fresh = new Player(p.id, p.control, p.team);
    for (const k of Object.keys(fresh)) if (!SNAP_SKIP.has(k)) p[k] = fresh[k];
  }
  objects.fill(null); structures.length = 0;
  for (const k in SNAP_KINDS) SNAP_KINDS[k]().length = 0;
  nets.length = 0;
  holes.length = 0; iceCracks.clear(); spurs.length = 0;
  for (const c of camps) c.repopT = 0;
  if (state.drop) for (const e of state.drop.eagles) for (const k of Object.keys(e)) if (!SNAP_SKIP.has(k) && k !== 'team') e[k] = typeof e[k] === 'number' ? 0 : null;
  for (const k of SNAP_STATE) if (typeof state[k] === 'number') state[k] = 0;
}
// the world frame's pixels, for the diff. The wall clock is pinned for the
// render, so anything that animates off performance.now() (the ride's
// ribbon, a shimmer) draws the same twice and the diff is the state's alone
const SNAP_T0 = 1e6; // the one instant every harness frame is rendered at (ms)
function snapFrame() {
  const now = performance.now;
  // ...and the shake: render() rolls a fresh random offset for the frame
  // while it is up, which would make two frames of one state disagree
  const shake = state.shake; state.shake = 0;
  performance.now = () => SNAP_T0;
  try { render(); } finally { performance.now = now; state.shake = shake; }
  return new Uint32Array(wctx.getImageData(0, 0, WV_W, WV_H).data.buffer);
}
// every path at which two packed snapshots disagree (the first `max`): the
// field-level answer to a nonzero pixel diff. The one tolerance is the
// wire's own: a field on SNAP_QUANT may differ by less than a quantum
// (`k` is the key the value sits under), and nothing else by anything
function snapCompare(a, b, path, out, max, k) {
  if (out.length >= max) return;
  if (a === b) return;
  const ta = typeof a, tb = typeof b;
  if (ta === 'number' && tb === 'number' && k !== undefined && SNAP_QUANT.has(k) && Math.abs(a - b) <= 1 / SNAP_Q) return; // <=: a floored 1e-26 is a quantum from its wire value to the last bit
  if (ta !== tb || a === null || b === null || ta !== 'object') { out.push(path + ': ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b)); return; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const kk of keys) snapCompare(a[kk], b[kk], path + '.' + kk, out, max, Array.isArray(a) ? undefined : kk); // an array element sits under no name, and is not quantized
}
// the same compare for a CLIENT checking itself against the host's full form
// mid-match: a control is a screen's own view, the wind is recomputed
// locally each tick, and a position may be mid-ease toward the host's
const SNAP_LOOSE_SKIP = new Set(['control', 'wind', 'windDir', 'windT']);
function snapCompareLoose(a, b, path, out, max) {
  if (out.length >= max) return;
  if (a === b) return;
  const ta = typeof a, tb = typeof b;
  if (ta === 'number' && tb === 'number' && Math.abs(a - b) <= 1) return;
  if (ta !== tb || a === null || b === null || ta !== 'object') { out.push(path + ': ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b)); return; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (!SNAP_LOOSE_SKIP.has(k)) snapCompareLoose(a[k], b[k], path + '.' + k, out, max);
}
function snapDiff(a, b) { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }
// The wire's one DESIGNED loss, written into the world: every field the
// encoder quantizes (SNAP_QUANT) set to the value the bytes would carry.
// The echo renders its reference frame from this state, so the pixels it
// counts are what the wire lost BESIDES the quantum - which is what it is
// there to prove is nothing. (Left to the exact state, a merchant's axe,
// drawn rotated toward its stump from a sub-px position, shifts its
// antialiasing by one colour unit on an eighth of a px: the quantum's own
// cost, visible to the diff and to nothing else.) Harness only: a live
// host never reads a quantized value back.
function snapQuantize() {
  const seen = new Set();
  const walk = (v) => {
    if (v === null || typeof v !== 'object' || seen.has(v) || v instanceof Map || v instanceof Set || ArrayBuffer.isView(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    for (const k of Object.keys(v)) { if (SNAP_SKIP.has(k)) continue; const c = v[k]; if (typeof c === 'number') { if (snapQable(k, c)) v[k] = snapQv(k, c); } else walk(c); }
  };
  walk(players); for (const k in SNAP_KINDS) walk(SNAP_KINDS[k]());
  if (state.drop) walk(state.drop.eagles);
  walk(objects); walk(nets); walk(spurs); walk(market); walk(state.end); walk(state.eagleCine);
}
// One echo: quantize, frame, snapshot, blank, apply, frame; the pixels that differ,
// the frame's own noise (two renders of the same state, for anything that
// animates off the wall clock), and the JSON weight by section. The live
// state IS the applied state afterwards, so a run can go on and echo again.
// The snapshot crosses through the binary encoder on its way, so the echo
// proves the bytes as well as the fields.
function netEcho() {
  snapQuantize();
  const a1 = snapFrame(), a2 = snapFrame();
  const noise = snapDiff(a1, a2);
  const s = snapBuild();
  const json = JSON.stringify(s);
  const size = snapSize(s);
  const dict = encDict(), bytes = snapEncode(s, dict);
  snapBlank();
  const blanked = snapFrame();
  snapApply(snapDecode(bytes, encDict()));
  const b = snapFrame();
  // what did not survive the round trip, field by field (a second build
  // after the apply, against the first)
  const mismatch = [];
  snapCompare(JSON.parse(json), snapBuild(), '', mismatch, 20);
  return { diff: snapDiff(a2, b), noise, blankDiff: snapDiff(a2, blanked), bytes: json.length, binBytes: bytes.length, size, mismatch };
}
// echo every `every` ticks over `ticks` of stepping; the worst diff and when
function netEchoRun(ticks, every) {
  every = every || 60;
  let worst = { diff: -1 }, at = 0, total = 0;
  for (let t = 0; t < ticks; t += every) {
    for (let i = 0; i < every; i++) update(TICK_DT);
    const r = netEcho(); total++;
    if (r.diff > worst.diff) { worst = r; at = state.tick; }
  }
  return { echoes: total, worstDiff: worst.diff, atTick: at, noise: worst.noise, bytes: worst.bytes, binBytes: worst.binBytes };
}
// The delta's own proof, in one page: a full snapshot is applied onto a
// blank world, then `ticks` of the sim are sent as deltas through the bytes
// and applied to that same world - which IS the world, so each apply is a
// no-op if the delta was right, and a field-level compare of the world
// against the host's full form after every apply says so. Returns the delta
// sizes, and the first mismatch if any. With `loss` (0..1) that share of
// deltas is thrown away unapplied and unacked, so the next is cut from the
// older base the way a host cuts one for a client behind a lossy wire -
// which exercises the ring, the whole-tile resend and the dictionary's
// positions, but NOT a missed change: the world here is the host's own and
// holds every change already. That proof is the client's self-check
// between two tabs under DBG.netLoss (docs/dev/checklists.md).
function netDeltaRun(ticks, every, loss) {
  every = every || SNAP_EVERY; loss = loss || 0;
  snapShadowReset();
  const dOut = encDict(), dIn = encDict();
  let total = 0, n = 0, worst = 0, mismatch = null, dropped = 0, oldest = 0;
  let ack = snapHistoryPush().tick, dictAt = dOut.names.length; // the first entry is the base everything is cut from
  let rng = 12345; const roll = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x80000000; };
  for (let t = 0; t < ticks; t += every) {
    for (let i = 0; i < every; i++) update(TICK_DT);
    const before = JSON.stringify(snapBuild());
    const h = snapHistoryPush(), base = snapHistoryAt(ack);
    if (!base) { mismatch = ['base ' + ack + ' aged out of the ring at tick ' + h.tick]; break; }
    oldest = Math.max(oldest, h.tick - base.tick);
    const bytes = snapEncode(snapDeltaFrom(h, base), dOut, dictAt);
    total += bytes.length; n++; if (bytes.length > worst) worst = bytes.length;
    if (loss && roll() < loss) { dropped++; continue; } // lost: not applied, not acked
    const d = snapDecode(bytes, dIn);
    const changed = snapApplyDelta(d);
    if (changed === null) { mismatch = ['lost an id at tick ' + state.tick]; break; }
    ack = h.tick; dictAt = dOut.names.length;
    const out = []; snapCompare(JSON.parse(before), snapBuild(), '', out, 5);
    if (out.length) { mismatch = out; break; }
  }
  return { deltas: n, dropped, oldestBase: oldest, avgBytes: n ? Math.round(total / n) : 0, worstBytes: worst, perSecond: Math.round(total / Math.max(1, n) * (60 / every)), mismatch };
}
