// ------------------------------------------------------------ snapshot
// The whole authoritative state of a match as one plain object a host can
// serialize and a client can write back into the singletons - after which
// render() draws it with no change of its own (docs/pvp-architecture.md).
//
// It is built by REFLECTION, not by a field table: every own property of
// every entity goes in, except the few named in SNAP_SKIP, so a field a
// sim file adds tomorrow is carried the day it is added and the schema
// cannot quietly fall behind the game. The price is bytes, and that is the
// next step's problem: this file is the CORRECT snapshot, snapSize() says
// what it weighs by section, and the delta/quantized wire form is derived
// from it later rather than instead of it. What proves it complete is
// netEcho() below: render a frame, snapshot, blank every singleton, apply,
// render again, and count the pixels that differ - zero or the schema is
// missing something the eye can see.
//
// References between entities (a bot's home bay, a wolf's target, a part
// tile's anchor, the eagle's merchant) cannot cross a wire as pointers, so
// pack() turns each into a token naming the KIND and the INDEX it lives at
// - P player id, R robot, A animal, W arrow, D drop, F fish, O object tile
// index, C camp, E eagle by team - and unpack() rebuilds them after every
// array stands again. Anything that is a per-machine concern rather than
// the match's is skipped: a player's `input` (the host fills it), `ai` (the
// bot brain runs only on the host), `nav` (a route is the mover's own
// business and the client moves nothing). The eagle's `spur` and `pad` are
// entries of the road registry (`spurs`, js/world.js) shared by identity, so
// the registry is a section of its own and an eagle is re-pointed at its
// entry after the apply; its `lane` (the felling plan, with clocks that
// advance) is merged into the object already there for the same reason.
const SNAP_SKIP = new Set(['input', 'ai', 'nav']);
// the match's own state keys: the clock, the result, the birds. Everything
// else on `state` is one screen's UI (overlays, the menu, the death view)
const SNAP_STATE = ['time', 'elapsed', 'day', 'tick', 'darkness', 'wind', 'windDir', 'windT', 'fishT', 'over', 'end', 'eagleCine'];
const SNAP_DEPTH = 8; // how deep pack() follows plain objects before giving up (a cycle guard)

// which entity this is, if it is one: a token, or null for a plain object
function snapToken(v) {
  if (v.id !== undefined && players[v.id] === v) return { $: 'P', i: v.id };
  if (v.tx !== undefined && v.ty !== undefined && v.type !== undefined && inWorld(v.tx, v.ty) && objects[idx(v.tx, v.ty)] === v) return { $: 'O', i: idx(v.tx, v.ty) };
  let i;
  if ((i = robots.indexOf(v)) >= 0) return { $: 'R', i };
  if ((i = animals.indexOf(v)) >= 0) return { $: 'A', i };
  if ((i = arrows.indexOf(v)) >= 0) return { $: 'W', i };
  if ((i = drops.indexOf(v)) >= 0) return { $: 'D', i };
  if ((i = fish.indexOf(v)) >= 0) return { $: 'F', i };
  if ((i = camps.indexOf(v)) >= 0) return { $: 'C', i };
  if (state.drop && (i = state.drop.eagles.indexOf(v)) >= 0) return { $: 'E', i };
  return null;
}
function snapDeref(t) {
  switch (t.$) {
    case 'P': return players[t.i];
    case 'O': return objects[t.i];
    case 'R': return robots[t.i];
    case 'A': return animals[t.i];
    case 'W': return arrows[t.i];
    case 'D': return drops[t.i];
    case 'F': return fish[t.i];
    case 'C': return camps[t.i];
    case 'E': return state.drop ? state.drop.eagles[t.i] : null;
  }
  return null;
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
function snapBuild() {
  const s = { v: 1, state: {}, players: [], objects: {}, structs: [], camps: [] };
  for (const k of SNAP_STATE) s.state[k] = pack(state[k], 0);
  for (const p of players) s.players.push(pack(p, 0, true));
  for (let i = 0; i < objects.length; i++) if (objects[i]) s.objects[i] = pack(objects[i], 0, true);
  for (const o of structures) s.structs.push(idx(o.tx, o.ty));
  s.robots = robots.map((e) => pack(e, 0, true));
  s.animals = animals.map((e) => pack(e, 0, true));
  s.arrows = arrows.map((e) => pack(e, 0, true));
  s.drops = drops.map((e) => pack(e, 0, true));
  s.fish = fish.map((e) => pack(e, 0, true));
  for (const c of camps) s.camps.push({ repopT: c.repopT }); // the rest of a camp is written down by worldgen
  s.drop = state.drop ? { firstFlight: state.drop.firstFlight, eagles: state.drop.eagles.map((e) => pack(e, 0, true)) } : null;
  s.spurs = pack(spurs, 0); // the road registry: each side's paved spur and its crash pad
  s.holes = holes.slice();
  s.iceCracks = [...iceCracks.entries()];
  s.nets = pack(nets, 0);
  s.market = pack(market, 0);
  s.ground = snapB64(ground);
  return s;
}
// ---- the per-tick form ---------------------------------------------------
// What a host sends every snapshot tick: everything that moves, in full, and
// the world's tiles and ground only WHERE THEY CHANGED since the last send
// (the static world is 95% of the full form and seed-generated on every
// screen). A shadow of what was last sent is kept per host; the transport is
// reliable and ordered, so "since last sent" is exact - an unreliable one
// keys the shadow by the client's ack instead (docs/pvp-architecture.md).
// A tile with only primitive fields is compared field by field; one with a
// nested field (a building's bots, a turret's mark) by its packed JSON.
const snapShadow = { objs: null, objJson: null, ground: null };
function snapShadowReset() { snapShadow.objs = null; snapShadow.objJson = null; snapShadow.ground = null; }
function snapObjSame(a, b) {
  if (!a || !b) return a === b;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) { const va = a[k], vb = b[k]; if (va !== vb) { if (va === null || vb === null || typeof va !== 'object' || typeof vb !== 'object') return false; return null; } }
  return true; // null above means "nested: decide by JSON"
}
function snapBuildTick() {
  const s = { v: 1, tick: true, state: {}, players: [], structs: [], camps: [], objDiff: {}, groundDiff: [] };
  for (const k of SNAP_STATE) s.state[k] = pack(state[k], 0);
  for (const p of players) s.players.push(pack(p, 0, true));
  for (const o of structures) s.structs.push(idx(o.tx, o.ty));
  s.robots = robots.map((e) => pack(e, 0, true));
  s.animals = animals.map((e) => pack(e, 0, true));
  s.arrows = arrows.map((e) => pack(e, 0, true));
  s.drops = drops.map((e) => pack(e, 0, true));
  s.fish = fish.map((e) => pack(e, 0, true));
  for (const c of camps) s.camps.push({ repopT: c.repopT });
  s.drop = state.drop ? { firstFlight: state.drop.firstFlight, eagles: state.drop.eagles.map((e) => pack(e, 0, true)) } : null;
  s.spurs = pack(spurs, 0);
  s.holes = holes.slice();
  s.iceCracks = [...iceCracks.entries()];
  s.nets = pack(nets, 0);
  s.market = pack(market, 0);
  // tiles and ground against the shadow
  if (!snapShadow.objs) { snapShadow.objs = new Array(objects.length).fill(null); snapShadow.objJson = new Array(objects.length).fill(null); }
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i], sh = snapShadow.objs[i];
    if (!o && !sh) continue;
    const packed = o ? pack(o, 0, true) : null;
    let same = snapObjSame(packed, sh);
    let js = null;
    if (same === null) { js = JSON.stringify(packed); same = js === snapShadow.objJson[i]; }
    if (same) continue;
    s.objDiff[i] = packed;
    snapShadow.objs[i] = packed; snapShadow.objJson[i] = js;
  }
  // a building goes every tick whatever the shadow says: the moving arrays a
  // client rebuilds each tick are what its references point at, and a
  // reference resolved a tick ago points at a copy that tick threw away
  for (const o of structures) { const i = idx(o.tx, o.ty); if (!(i in s.objDiff)) { const packed = pack(o, 0, true); s.objDiff[i] = packed; snapShadow.objs[i] = packed; snapShadow.objJson[i] = null; } }
  if (!snapShadow.ground) { snapShadow.ground = new Uint8Array(ground); }
  else for (let i = 0; i < ground.length; i++) if (ground[i] !== snapShadow.ground[i]) { s.groundDiff.push(i, ground[i]); snapShadow.ground[i] = ground[i]; }
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
// Writes a snapshot into the singletons. Existing Player and eagle objects
// are kept and overwritten field by field - `player`, `inv` and the drop
// point at them - and every other array is rebuilt wholesale. Tokens are
// resolved last, once everything they can name exists again.
function snapApply(s) {
  for (const k of SNAP_STATE) state[k] = unpack(s.state[k]);
  // world tiles: wholesale from the full form, where they changed from the
  // tick form; then the structures registry re-pointed at them
  const tiles = s.objects || s.objDiff || {};
  if (s.objects) objects.fill(null);
  for (const i in tiles) objects[i] = tiles[i] ? unpack(tiles[i]) : null;
  structures.length = 0;
  for (const i of s.structs) if (objects[i]) structures.push(objects[i]);
  const fill = (arr, list) => { arr.length = 0; for (const e of list) arr.push(unpack(e)); };
  fill(robots, s.robots); fill(animals, s.animals); fill(arrows, s.arrows); fill(drops, s.drops); fill(fish, s.fish);
  for (let i = 0; i < players.length; i++) {
    const src = s.players[i], p = players[i];
    for (const k of Object.keys(src)) p[k] = unpack(src[k]);
  }
  for (let i = 0; i < camps.length && i < s.camps.length; i++) camps[i].repopT = s.camps[i].repopT;
  if (!s.drop) state.drop = null;
  else {
    if (!state.drop) state.drop = { eagles: [], firstFlight: s.drop.firstFlight };
    state.drop.firstFlight = s.drop.firstFlight;
    for (let i = 0; i < s.drop.eagles.length; i++) {
      const src = s.drop.eagles[i], e = state.drop.eagles[i] || (state.drop.eagles[i] = {});
      for (const k of Object.keys(src)) {
        const u = unpack(src[k]);
        // the lane keeps its identity (its clocks are read by the object's
        // own handle); the registry entries are re-pointed below
        if (k === 'lane' && u && e.lane && typeof e.lane === 'object') { for (const kk of Object.keys(e.lane)) delete e.lane[kk]; Object.assign(e.lane, u); }
        else e[k] = u;
      }
    }
    state.drop.eagles.length = s.drop.eagles.length;
  }
  // the road registry, merged by (team, pad) so an entry keeps its identity
  const keep = [];
  for (const src of unpack(s.spurs)) {
    let sp = spurs.find((q) => q.team === src.team && !!q.pad === !!src.pad);
    if (sp) { for (const k of Object.keys(sp)) delete sp[k]; Object.assign(sp, src); } else sp = src;
    keep.push(sp);
  }
  spurs.length = 0; for (const sp of keep) spurs.push(sp);
  if (state.drop) for (const e of state.drop.eagles) {
    if (e.spur) e.spur = spurs.find((q) => q.team === e.team && !q.pad) || e.spur;
    if (e.pad) e.pad = spurs.find((q) => q.team === e.team && q.pad) || e.pad;
  }
  holes.length = 0; for (const h of s.holes) holes.push(h);
  iceCracks.clear(); for (const [k, v] of s.iceCracks) iceCracks.set(k, v);
  nets.length = 0; for (const n of unpack(s.nets)) nets.push(n);
  const mk = unpack(s.market); for (const k of Object.keys(mk)) market[k] = mk[k];
  // the ground: only tiles that changed are repainted - the whole array is
  // a boot-time bake (repaintGround, js/draw/ground.js)
  if (s.ground) {
    const g = snapUnB64(s.ground);
    for (let i = 0; i < ground.length; i++) if (ground[i] !== g[i]) { ground[i] = g[i]; repaintGround(i % WORLD, (i / WORLD) | 0); }
  } else if (s.groundDiff) {
    for (let k = 0; k < s.groundDiff.length; k += 2) { const i = s.groundDiff[k]; ground[i] = s.groundDiff[k + 1]; repaintGround(i % WORLD, (i / WORLD) | 0); }
  }
  // and the references, now that everything they can point at exists
  const seen = new Set();
  for (const p of players) snapResolve(p, seen);
  for (const i of Object.keys(tiles)) if (objects[i]) snapResolve(objects[i], seen);
  for (const arr of [robots, animals, arrows, drops, fish, nets]) snapResolve(arr, seen);
  if (state.drop) snapResolve(state.drop.eagles, seen);
  snapResolve(state.end, seen); snapResolve(state.eagleCine, seen);
}

// ---- the echo harness -----------------------------------------------------
// Empties every singleton the snapshot claims to carry, so that what the
// next frame shows is what the snapshot brought back and nothing else
function snapBlank() {
  for (const p of players) {
    const fresh = new Player(p.id, p.control, p.team);
    for (const k of Object.keys(fresh)) if (!SNAP_SKIP.has(k)) p[k] = fresh[k];
  }
  objects.fill(null); structures.length = 0;
  robots.length = 0; animals.length = 0; arrows.length = 0; drops.length = 0; fish.length = 0; nets.length = 0;
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
function snapDiff(a, b) { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }
// One echo: frame, snapshot, blank, apply, frame; the pixels that differ,
// the frame's own noise (two renders of the same state, for anything that
// animates off the wall clock), and the JSON weight by section. The live
// state IS the applied state afterwards, so a run can go on and echo again.
function netEcho() {
  const a1 = snapFrame(), a2 = snapFrame();
  const noise = snapDiff(a1, a2);
  const s = snapBuild();
  const json = JSON.stringify(s);
  const size = snapSize(s);
  snapBlank();
  const blanked = snapFrame();
  snapApply(JSON.parse(json));
  const b = snapFrame();
  // what did not survive the round trip, field by field (a second build
  // after the apply, against the first)
  const mismatch = [];
  snapCompare(s, snapBuild(), '', mismatch, 20);
  return { diff: snapDiff(a2, b), noise, blankDiff: snapDiff(a2, blanked), bytes: json.length, size, mismatch };
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
  return { echoes: total, worstDiff: worst.diff, atTick: at, noise: worst.noise, bytes: worst.bytes };
}
