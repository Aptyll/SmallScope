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
// every entity carries a stable network id (snapNid), a host keeps a shadow
// of what it last sent per id and sends only the fields that changed, and
// the whole message goes as binary with every object key as an index into a
// dictionary both ends grow in step (the `encode` banner). A full snapshot
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
  if (tiles) {
    if (s.objects) objects.fill(null);
    for (const i in tiles) {
      const u = tiles[i] ? unpack(tiles[i]) : null, old = objects[i];
      // a tile that is still there changes IN PLACE: a bot's home bay, a
      // part's anchor and the structures registry hold it by identity. A
      // full form carries whole tiles; a delta carries the fields that
      // changed (and the names that left as $del)
      if (u && old) {
        if (s.objects) { for (const k of Object.keys(old)) if (!(k in u)) delete old[k]; }
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
// changed since it last sent them, against a shadow it keeps per network
// id; the order each array stands in; the ids that left; the tiles and the
// ground only where they changed; and each singleton only when its packed
// form changed. The transport is reliable and ordered, so "since last sent"
// is exact - an unreliable one keys the shadow by the client's ack instead
// (docs/pvp-architecture.md). A primitive field compares by value, a nested
// one (a bag, a route's points, a building's bots) by its JSON.
const snapShadow = { objs: null, objJson: null, ground: null, ents: {}, singles: {}, eagles: [] };
function snapShadowReset() {
  snapShadow.objs = null; snapShadow.objJson = null; snapShadow.ground = null;
  snapShadow.ents = { P: new Map(), R: new Map(), A: new Map(), W: new Map(), D: new Map(), F: new Map() };
  snapShadow.singles = {}; snapShadow.singlesObj = {}; snapShadow.eagles = [];
}
snapShadowReset();
function snapSame(va, vb) {
  if (va === vb) return true;
  if (va === null || vb === null || typeof va !== 'object' || typeof vb !== 'object') return false;
  return JSON.stringify(va) === JSON.stringify(vb);
}
// the fields of `packed` that differ from `prev` (all of them for a first
// send), plus the names that left as `$del`; null when nothing changed
function snapFieldDiff(packed, prev) {
  if (!prev) return packed;
  let out = null, del = null;
  for (const k of Object.keys(packed)) { if (!snapSame(packed[k], prev[k])) { (out = out || {})[k] = packed[k]; } }
  for (const k of Object.keys(prev)) if (!(k in packed)) (del = del || []).push(k);
  if (del) { (out = out || {}).$del = del; }
  return out;
}
function snapKindDelta(kind, arr, sh, out) {
  const order = [], seen = new Set();
  let ch = null;
  for (const e of arr) {
    const packed = packEnt(e, kind === 'P' ? null : kind);
    const n = kind === 'P' ? e.id : packed._nid;
    if (kind === 'P') delete packed._nid; else delete packed._nid;
    order.push(n); seen.add(n);
    const d = snapFieldDiff(packed, sh.get(n));
    if (d) (ch = ch || []).push([n, d]);
    sh.set(n, packed);
  }
  let del = null;
  for (const n of sh.keys()) if (!seen.has(n)) { (del = del || []).push(n); }
  if (del) for (const n of del) sh.delete(n);
  const k = {};
  if (ch) k.ch = ch;
  if (del) k.del = del;
  // the order goes only when it changed (an arrival, a departure, a reorder)
  const key = order.join(',');
  if (sh.order !== key) { sh.order = key; k.order = order; }
  if (ch || del || k.order) out[kind] = k;
}
function snapBuildDelta() {
  const d = { v: 2, tick: state.tick };
  const sh = snapShadow;
  snapKindDelta('P', players, sh.ents.P, d);
  for (const k in SNAP_KINDS) snapKindDelta(k, SNAP_KINDS[k](), sh.ents[k], d);
  // the eagles, by team, field by field
  if (state.drop) {
    const es = [];
    for (let i = 0; i < state.drop.eagles.length; i++) {
      const packed = pack(state.drop.eagles[i], 0, true);
      const f = snapFieldDiff(packed, sh.eagles[i]);
      sh.eagles[i] = packed;
      if (f) es.push([i, f]);
    }
    if (es.length) d.eagles = es;
  } else sh.eagles = [];
  // the singletons: a plain object (the state keys, the market) field by
  // field against its shadow, an array (the registry, the ice, the nets)
  // whole when its JSON changed
  const singles = snapSingles();
  if (!sh.singlesObj) sh.singlesObj = {};
  for (const k of Object.keys(singles)) {
    const v = singles[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const f = snapFieldDiff(v, sh.singlesObj[k]);
      sh.singlesObj[k] = v;
      if (f) d[k] = f;
    } else {
      const js = JSON.stringify(v);
      if (sh.singles[k] !== js) { sh.singles[k] = js; d[k] = v; }
    }
  }
  // tiles against the shadow: a tile whose primitive fields all match its
  // shadow is skipped without packing (most of the world, every tick); one
  // that differs goes field by field, whole when the shadow had none
  if (!sh.objs) { sh.objs = new Array(objects.length).fill(null); }
  let objDiff = null;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i], prev = sh.objs[i];
    if (!o && !prev) continue;
    if (o && prev && snapTileSame(o, prev)) continue;
    const packed = o ? pack(o, 0, true) : null;
    const f = packed ? snapFieldDiff(packed, prev) : null;
    if (packed && !f) { sh.objs[i] = packed; continue; }
    (objDiff = objDiff || {})[i] = packed ? f : null;
    sh.objs[i] = packed;
  }
  if (objDiff) d.objDiff = objDiff;
  const structs = structures.map((o) => idx(o.tx, o.ty)).join(',');
  if (sh.singles.$structs !== structs) { sh.singles.$structs = structs; d.structs = structures.map((o) => idx(o.tx, o.ty)); }
  if (!sh.ground) sh.ground = new Uint8Array(ground);
  else { let g = null; for (let i = 0; i < ground.length; i++) if (ground[i] !== sh.ground[i]) { (g = g || []).push(i, ground[i]); sh.ground[i] = ground[i]; } if (g) d.groundDiff = g; }
  return d;
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
function snapObjSame(a, b) {
  if (!a || !b) return a === b;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) { const va = a[k], vb = b[k]; if (va !== vb) { if (va === null || vb === null || typeof va !== 'object' || typeof vb !== 'object') return false; return null; } }
  return true; // null above means "nested: decide by JSON"
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
// begins with the names it is the first to use, appended in order, so the
// reliable, ordered channel keeps the two lists equal. A joiner is handed
// the host's whole list with its WELCOME. Numbers go as the smallest
// integer that holds them or a float32; strings as utf8; the rest by tag.
const ENC_TAG = { NULL: 0, FALSE: 1, TRUE: 2, I8: 3, I16: 4, I32: 5, F32: 6, F64: 7, STR: 8, ARR: 9, OBJ: 10 };
function encDict() { return { names: [], index: new Map() }; }
const encTextEnc = new TextEncoder(), encTextDec = new TextDecoder();
function snapEncode(value, dict) {
  let buf = new Uint8Array(1 << 16), view = new DataView(buf.buffer), pos = 0;
  const fresh = [];
  const need = (n) => { if (pos + n > buf.length) { let len = buf.length * 2; while (len < pos + n) len *= 2; const nb = new Uint8Array(len); nb.set(buf); buf = nb; view = new DataView(buf.buffer); } };
  const u8 = (v) => { need(1); buf[pos++] = v; };
  const u16 = (v) => { need(2); view.setUint16(pos, v); pos += 2; };
  const u32 = (v) => { need(4); view.setUint32(pos, v); pos += 4; };
  const str = (s) => { const b = encTextEnc.encode(s); need(4 + b.length); view.setUint32(pos, b.length); pos += 4; buf.set(b, pos); pos += b.length; };
  // a key that is a number (a tile index) goes as one, not as a dictionary
  // name: the world has fifty thousand of them and a dictionary would carry every one
  const key = (k) => {
    if (k.length && k.length < 10 && /^[0-9]+$/.test(k)) { u16(0xFFFF); u32(+k); return; }
    let i = dict.index.get(k); if (i === undefined) { i = dict.names.length; dict.names.push(k); dict.index.set(k, i); fresh.push(k); } u16(i);
  };
  const put = (v) => {
    if (v === null || v === undefined) { u8(ENC_TAG.NULL); return; }
    if (v === false) { u8(ENC_TAG.FALSE); return; }
    if (v === true) { u8(ENC_TAG.TRUE); return; }
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
    for (const k of keys) { key(k); put(v[k]); }
  };
  put(value);
  // the header: the names this message is the first to use
  const hb = encTextEnc.encode(JSON.stringify(fresh));
  const out = new Uint8Array(4 + hb.length + pos);
  new DataView(out.buffer).setUint32(0, hb.length);
  out.set(hb, 4); out.set(buf.subarray(0, pos), 4 + hb.length);
  return out;
}
function snapDecode(bytes, dict) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const hl = view.getUint32(0); pos = 4;
  const fresh = JSON.parse(encTextDec.decode(bytes.subarray(pos, pos + hl))); pos += hl;
  for (const k of fresh) { dict.index.set(k, dict.names.length); dict.names.push(k); }
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
// field-level answer to a nonzero pixel diff
function snapCompare(a, b, path, out, max) {
  if (out.length >= max) return;
  if (a === b) return;
  const ta = typeof a, tb = typeof b;
  if (ta !== tb || a === null || b === null || ta !== 'object') { out.push(path + ': ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b)); return; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) snapCompare(a[k], b[k], path + '.' + k, out, max);
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
// One echo: frame, snapshot, blank, apply, frame; the pixels that differ,
// the frame's own noise (two renders of the same state, for anything that
// animates off the wall clock), and the JSON weight by section. The live
// state IS the applied state afterwards, so a run can go on and echo again.
// The snapshot crosses through the binary encoder on its way, so the echo
// proves the bytes as well as the fields.
function netEcho() {
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
// sizes, and the first mismatch if any.
function netDeltaRun(ticks, every) {
  every = every || SNAP_EVERY;
  snapShadowReset();
  const dOut = encDict(), dIn = encDict();
  let total = 0, n = 0, worst = 0, mismatch = null;
  const base = snapEncode(snapBuildDelta(), dOut); snapDecode(base, dIn); // the first delta is everything; the shadow is primed
  for (let t = 0; t < ticks; t += every) {
    for (let i = 0; i < every; i++) update(TICK_DT);
    const before = JSON.stringify(snapBuild());
    const bytes = snapEncode(snapBuildDelta(), dOut);
    total += bytes.length; n++; if (bytes.length > worst) worst = bytes.length;
    const d = snapDecode(bytes, dIn);
    const changed = snapApplyDelta(d);
    if (changed === null) { mismatch = ['lost an id at tick ' + state.tick]; break; }
    const out = []; snapCompare(JSON.parse(before), snapBuild(), '', out, 5);
    if (out.length) { mismatch = out; break; }
  }
  return { deltas: n, avgBytes: n ? Math.round(total / n) : 0, worstBytes: worst, perSecond: Math.round(total / Math.max(1, n) * (60 / every)), mismatch };
}
