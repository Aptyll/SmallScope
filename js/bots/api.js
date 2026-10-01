'use strict';
// The bot API: a seat driven by a bot FILE instead of the built-in brain.
// The file sees only a JSON observation of what its seat's player could see
// and answers with the same input struct a hand fills. The contract, for bot
// authors: docs/bots/api.md.
// ------------------------------------------------------------ bot api
// A scripted seat is a player with control 'ai' and a `botId` naming a program
// in BOT_LIB; the sim's step hands it to botStep instead of updateAI (sim.js).
// Every BOT_THINK ticks it is sent an OBSERVATION (botObserve) and answers
// with an ACT (botAct cleans it); between thinks the act's held fields stay
// held, and its edge fields (a dodge, a cast, an order) fire once. Nothing
// crosses the boundary but plain JSON: the observation is built from scratch
// every think and the act is read field by field, so a bot never holds a
// reference into the game and can run anywhere a message can reach - inline
// (the same thread: only the baked examples, which can see the page), in a Web
// Worker (a person's file), in the arena's sealed Node context (every ladder
// match, app/arena/sandbox.js), or later over a socket (online ladder).
// A bot can never do what a hand cannot: the act IS the input struct, the sim
// re-validates every order, and the hands are the ladder's (skillHands).
const BOT_API = 1;          // the message shape's version; a rename bumps it
const BOT_THINK = 6;        // ticks between thinks: 10 a second at TICK_DT
const BOT_OBS_R = 24 * TILE; // px: how far round its side a bot sees (the minimap's default reach, MM_R tiles)
const BOT_SAY_MAX = 256;    // bytes of JSON a `say` may carry to the side
const BOT_WHY_MAX = 20;     // chars of a thought's `why` (the dashboard's plate)
const BOT_ERR_MAX = 8;      // errors kept per seat for the ladder page
const BOT_CMDS = new Set(['build', 'upgrade', 'repair', 'demolish', 'gear', 'ability', 'flag', 'shop']);
const BOT_NODES_N = 64;     // workable tiles an observation lists, nearest first
const BOT_NODES = new Set(['tree', 'deadTree', 'rock', 'bush', 'chest']);
const BOT_CALLS = new Set(['bird', 'help', 'low', 'push', 'here']); // CALLS' kinds a bot may say
const BOT_CALL_LOW = new Set(['HUNTER', 'WARRIOR', 'BEAR']);       // what a 'low' call may name

// ---- the library --------------------------------------------------------------
// Every program a seat can run, by id: { id, name, src, run } - `run` names
// the transport it runs on (BOT_TRANSPORTS, below): the examples baked from
// bots/*.js by app/bake-bots.js (js/bots/lib.js) run 'inline'; a person's file
// runs in a 'worker'; a harness may register its own (the arena's 'vm', a socket).
const BOT_LIB = new Map();
function botLibAdd(id, src, run) {
  const m = /name\s*:\s*['"`]([^'"`]{1,40})['"`]/.exec(src); // a label for the list before the file has run
  BOT_LIB.set(id, { id, name: m ? m[1] : id, src, run: run || 'worker' });
  return BOT_LIB.get(id);
}

// ---- ids ------------------------------------------------------------------------
// A player's id is its seat. Everything else a bot can name (a soldier, an
// animal, a building, a drop) gets a number the first time an observation
// shows it, stable for the session - never saved, never read by the sim.
const botIds = new WeakMap(), botRefs = new Map();
let botIdNext = 100;
function botIdOf(o) {
  let id = botIds.get(o);
  if (id === undefined) { id = botIdNext++; botIds.set(o, id); botRefs.set(id, o); }
  return id;
}
// the refs of things gone from the world, let go of now and then
function botIdPrune() {
  const live = new Set([...robots, ...animals, ...structures, ...drops]);
  for (const [id, o] of botRefs) if (!live.has(o)) botRefs.delete(id);
}

// ---- the observation ----------------------------------------------------------------
const botR = (v) => Math.round(v * 10) / 10;
function botSeen(p, q) {
  // what the side's minimap would show (the loop in renderMinimap): near any
  // of the side, and not buried past PRONE_MAP unless a falcon marked it
  if (q.markT <= 0 && concealOf(q) >= PRONE_MAP) return false;
  for (const a of players) {
    if (a.team !== p.team || !a.active || a.dead || inAir(a)) continue;
    if (Math.hypot(q.x - a.x, q.y - a.y) < seenAt(q, BOT_OBS_R)) return true;
  }
  return false;
}
function botNearSide(p, x, y) {
  for (const a of players) {
    if (a.team !== p.team || !a.active || a.dead || inAir(a)) continue;
    if (Math.hypot(x - a.x, y - a.y) < BOT_OBS_R) return true;
  }
  return false;
}
function botToolOf(c) {
  return c ? { type: c.type, bits: c.bits.map((b) => (b ? (b.type || b) : null)), lvl: toolLvl(c) } : null;
}
function botObserve(p) {
  const near = (x, y) => Math.hypot(x - p.x, y - p.y) < BOT_OBS_R;
  const me = {
    id: p.id, team: p.team, cls: CLASSES[p.cls].name,
    x: botR(p.x), y: botR(p.y), vx: botR(p.vx), vy: botR(p.vy),
    hp: botR(p.hp), maxHp: p.maxHp, dead: p.dead, respawnT: botR(p.respawnT), eliminated: p.eliminated,
    level: p.level, xp: p.xp, gold: p.inv.gold, skillPts: p.skillPts,
    prone: !!p.prone, hide: botR(p.hide || 0), aboard: !!p.aboard, falling: p.dropT > 0, zip: p.zip,
    abilities: p.abLv.map((lv, i) => botAbility(p, i, lv)),
    gear: p.gearLv.slice(), // each piece's level, 1..GEAR_LV_MAX (hello.rules.gearCosts prices the next)
    tool: botToolOf(heldTool(p)), toolSel: p.toolSel,
    tools: (p.tools || []).map((c) => (c ? c.type : null)),
    bag: p.bag.map((s) => (s ? { type: s.type, n: s.n } : null)),
    food: Object.assign({}, p.food),
    charging: !!p.charging, chargeT: botR(p.chargeT),
    nav: botRt.get(p.id) ? botRt.get(p.id).nav : null,
    lastCmd: p.lastCmd ? Object.assign({}, p.lastCmd) : null,
    atShop: !!merchNear(p),
  };
  const allies = [], enemies = [];
  for (const q of players) {
    if (q === p || !q.active) continue;
    if (q.team === p.team) {
      allies.push({ id: q.id, x: botR(q.x), y: botR(q.y), hp: botR(q.hp), maxHp: q.maxHp, cls: CLASSES[q.cls].name,
        dead: q.dead, respawnT: botR(q.respawnT), aboard: inAir(q), bot: q.control === 'ai' });
    } else if (!q.dead && !inAir(q) && botSeen(p, q)) {
      enemies.push({ id: q.id, x: botR(q.x), y: botR(q.y), vx: botR(q.vx), vy: botR(q.vy), hp: botR(q.hp), maxHp: q.maxHp,
        cls: CLASSES[q.cls].name, prone: !!q.prone });
    }
  }
  const soldiers = [];
  for (const b of robots) {
    if (b.kind !== 'soldier' || !unitAlive(b) || !botNearSide(p, b.x, b.y)) continue;
    soldiers.push({ id: botIdOf(b), team: b.team, x: botR(b.x), y: botR(b.y), hp: botR(b.hp), maxHp: b.maxHp });
  }
  const animalsSeen = [];
  for (const a of animals) {
    if (a.dead || !near(a.x, a.y)) continue;
    animalsSeen.push({ id: botIdOf(a), kind: a.kind, level: a.level, x: botR(a.x), y: botR(a.y), hp: botR(a.hp), maxHp: a.maxHp });
  }
  const eagles = [];
  if (state.drop) for (const e of state.drop.eagles) {
    eagles.push({ team: e.team, x: botR(e.x), y: botR(e.y), state: e.state, hp: botR(e.hp), maxHp: e.maxHp, hitT: botR(e.hitT),
      mouth: e.mouth ? { x: botR(e.mouth.x), y: botR(e.mouth.y) } : null });
  }
  const structs = [];
  for (const o of structures) {
    const x = o.tx * TILE + 8, y = o.ty * TILE + 8;
    if (o.dead || !near(x, y)) continue;
    structs.push({ id: botIdOf(o), type: o.type, team: o.team, tx: o.tx, ty: o.ty, hp: botR(o.hp), maxHp: o.maxHp, building: !!o.building });
  }
  const nodes = [], R = Math.ceil(BOT_OBS_R / TILE), ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  for (let ty = pty - R; ty <= pty + R; ty++) for (let tx = ptx - R; tx <= ptx + R; tx++) {
    const o = objAt(tx, ty);
    if (!o || !BOT_NODES.has(o.type) || !near(tx * TILE + 8, ty * TILE + 8)) continue;
    const def = OBJECTS[o.type];
    if (def.ready && !def.ready(o)) continue; // a picked bush offers nothing
    nodes.push({ kind: o.type, tx, ty, d: Math.hypot(tx * TILE + 8 - p.x, ty * TILE + 8 - p.y) });
  }
  // a forest is thousands of pines: only the nearest BOT_NODES_N, nearest first
  nodes.sort((a, b) => a.d - b.d);
  nodes.length = Math.min(nodes.length, BOT_NODES_N);
  for (const n of nodes) delete n.d;
  const dropsSeen = [];
  for (const d of drops) if (near(d.x, d.y)) dropsSeen.push({ id: botIdOf(d), type: d.type, n: d.n, x: botR(d.x), y: botR(d.y) });
  const shots = [];
  for (const a of arrows) if (near(a.x, a.y)) shots.push({ x: botR(a.x), y: botR(a.y), vx: botR(a.vx), vy: botR(a.vy), team: a.team });
  const flags = [];
  for (const q of players) if (q.active && q.team === p.team && q.flag) flags.push({ owner: q.id, type: q.flag.type, tx: q.flag.tx, ty: q.flag.ty });
  // the merchants are as plain to see as their birds; the counter's stock
  // only from the counter, where a hand would read it off the shelf
  const merchants = [];
  for (const b of robots) {
    if (!b.merchant || b.dead) continue;
    merchants.push({ team: b.team, x: botR(b.x), y: botR(b.y), stall: stallUp(b.stall) ? { tx: b.stall.tx, ty: b.stall.ty } : null });
  }
  let shop = null;
  if (me.atShop && market.stock) {
    shop = [];
    for (const sec in market.stock) market.stock[sec].forEach((_, i) => {
      const o = shopOffer(sec, i);
      if (o) shop.push({ sec, i, kind: o.kind, id: o.id, price: o.price });
    });
  }
  const r = botRt.get(p.id);
  // the kill feed every screen shows: each death since this seat's last think
  // (r.seen: every player's death count when that think was sent)
  const kills = [];
  for (const q of players) {
    const d = q.active && q.lastDeath;
    if (!d || !r || q.deaths <= (r.seen[q.id] || 0)) continue;
    kills.push({ victim: q.id, team: q.team, by: d.by, cause: d.cause, tick: d.tick, out: !!q.eliminated });
  }
  const team = r ? r.inbox.splice(0) : [];
  return { tick: state.tick, time: botR(state.elapsed), me, allies, enemies, soldiers, animals: animalsSeen, eagles, structs, nodes, drops: dropsSeen, shots, flags,
    merchants, shop, kills, team };
}
// one key: what it is on this body (abOf: a warrior may carry an alternate),
// its level and cooldown, and how far its aim reaches (px, null for none)
function botAbility(p, i, lv) {
  const ab = abOf(p, i), aim = ab.aim || {};
  return { key: i, id: ab.id, lv, cd: botR(p.abCd[i]), ready: abReady(p, i), range: aim.line || aim.ring || aim.cone || null };
}
// the map as it stood when the seat was taken, one character a tile, a row a
// string: '#' solid, '~' open water, '-' ice, '=' road or bridge, ',' a ford,
// '.' snow. Trees fall and buildings rise after it: obs.nodes and obs.structs
// are the live word on what stands near you
const BOT_GROUND = '.-~==,';
function botGrid(p) {
  const rows = [];
  for (let ty = 0; ty < WORLD; ty++) {
    let row = '';
    for (let tx = 0; tx < WORLD; tx++) {
      row += isSolidTile(tx, ty, p) ? '#' : waterAt(tx, ty) ? '~' : BOT_GROUND[ground[idx(tx, ty)]] || '.';
    }
    rows.push(row);
  }
  return rows;
}
// once, when a seat is taken: the rules and the world a bot may remember
function botHello(p) {
  return {
    t: 'hello', api: BOT_API, seat: p.id, team: p.team, cls: CLASSES[p.cls].name, name: p.name, seed: SEED,
    rules: { tickDt: TICK_DT, thinkEvery: BOT_THINK, obsR: BOT_OBS_R, tile: TILE, world: WORLD, gearCosts: GEAR_COSTS.slice(), gearMax: GEAR_LV_MAX },
    map: { world: WORLD, tile: TILE, shape: MAP_TYPE, grid: botGrid(p) },
  };
}

// ---- the act ------------------------------------------------------------------------
// Read field by field into a fresh struct: numbers clamped, strings cut,
// anything unknown dropped. A malformed act is "no change", never a throw.
const botNum = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
function botAct(a) {
  if (!a || typeof a !== 'object') return null;
  const W = WORLD * TILE, out = { mx: 0, my: 0, aimX: NaN, aimY: NaN, fire: !!a.fire, work: !!a.work, slide: !!a.slide, grapple: !!a.grapple,
    goTo: null, dodge: !!a.dodge, jump: !!a.jump, eatBerry: !!a.eatBerry, eatFish: !!a.eatFish, useCard: !!a.useCard,
    ability: -1, cmd: null, call: null, say: undefined, think: null };
  if (Array.isArray(a.move)) { out.mx = botNum(a.move[0], -1, 1, 0); out.my = botNum(a.move[1], -1, 1, 0); }
  if (Array.isArray(a.aim)) { out.aimX = botNum(a.aim[0], -W, 2 * W, NaN); out.aimY = botNum(a.aim[1], -W, 2 * W, NaN); }
  if (a.goTo && typeof a.goTo === 'object') {
    const x = botNum(a.goTo.x, 0, W, NaN), y = botNum(a.goTo.y, 0, W, NaN);
    if (x === x && y === y) out.goTo = { x, y, reach: botNum(a.goTo.reach, 0, 3, 0) | 0 };
  }
  if (typeof a.ability === 'number') out.ability = botNum(a.ability | 0, -1, AB_KEYS - 1, -1);
  if (a.cmd && typeof a.cmd === 'object' && BOT_CMDS.has(a.cmd.kind)) {
    const c = {};
    for (const k in a.cmd) {
      const v = a.cmd[k];
      if (typeof v === 'number' ? isFinite(v) : typeof v === 'string' ? v.length <= 40 : typeof v === 'boolean' || v === null) c[k] = v;
    }
    out.cmd = c;
  }
  // a callout to the side (js/ai-callouts.js): a kind, where, and for 'low' or
  // 'here' what it names - a class or BEAR, or how many rivals
  if (a.call && typeof a.call === 'object' && BOT_CALLS.has(a.call.kind)) {
    const c = a.call, x = botNum(c.x, 0, W, NaN), y = botNum(c.y, 0, W, NaN);
    const n = c.kind === 'here' ? botNum(c.n | 0, 1, 5, 1) : c.kind === 'low' ? (BOT_CALL_LOW.has(c.n) ? c.n : null) : undefined;
    if (x === x && y === y && n !== null) out.call = { kind: c.kind, x, y, n };
  }
  if (a.say !== undefined) {
    try { const s = JSON.stringify(a.say); if (s !== undefined && s.length <= BOT_SAY_MAX) out.say = JSON.parse(s); } catch (e) { }
  }
  if (a.think && typeof a.think === 'object') out.think = a.think;
  return out;
}
// the thought record the dashboard reads for every bot (contract: p.ai.thought)
function botSetThought(p, t, src) {
  const up = (v, n) => (typeof v === 'string' ? v.toUpperCase().slice(0, n) : '');
  let target = null;
  const g = t.target;
  if (g && typeof g === 'object') {
    const kind = typeof g.kind === 'string' ? g.kind : 'point';
    const ref = kind === 'player' ? players[g.id] || null
      : kind === 'bird' ? (state.drop && state.drop.eagles[g.id]) || null
      : typeof g.id === 'number' ? botRefs.get(g.id) || null : null;
    target = { x: botNum(g.x, -1e5, 1e5, ref ? ref.x : 0), y: botNum(g.y, -1e5, 1e5, ref ? ref.y : 0), kind, ref, id: typeof g.id === 'number' ? g.id : undefined };
  }
  const o = p.ai.thought && p.ai.thought.src === src ? p.ai.thought : (p.ai.thought = {});
  o.goal = up(t.goal, 12) || 'IDLE';
  o.why = up(t.why, BOT_WHY_MAX);
  o.target = target;
  o.role = up(t.role, 12) || undefined;
  o.mood = up(t.mood, 12) || undefined;
  o.plan = up(t.plan, 12) || undefined;
  o.src = src;
  o.t = state.tick;
}

// ---- seats ------------------------------------------------------------------------
// The live half of a scripted seat - never saved (a save keeps `p.botId`, and
// the first step after a load rebuilds this from BOT_LIB): the connection, the
// act in force, the edges not yet fired, the side's words waiting for it.
const botRt = new Map();
function botAssign(p, id) {
  botRelease(p);
  p.botId = id;
  if (id) p.control = 'ai';
  return id ? botOpen(p) : null;
}
function botRelease(p) {
  const r = botRt.get(p.id);
  if (r) { r.conn.close(); botRt.delete(p.id); }
  p.botId = null;
}
function botOpen(p) {
  const lib = BOT_LIB.get(p.botId);
  if (!lib) return null;
  const r = { p, lib, conn: null, act: null, edge: false, waiting: false, sentT: -1, nav: null,
    inbox: [], name: lib.name, errs: [], errN: 0, late: 0, thinks: 0, ms: 0, sentAt: 0, seen: players.map((q) => q.deaths), ready: false };
  const open = BOT_TRANSPORTS[lib.run];
  r.conn = open ? open(lib.src, (m) => botHear(r, m)) : { async: false, send() { }, close() { } };
  if (!open) botErr(r, 'no transport ' + lib.run);
  botRt.set(p.id, r);
  r.conn.send(botHello(p));
  return r;
}
function botErr(r, msg) {
  r.errN++;
  r.errs.push({ tick: state.tick, msg: String(msg).slice(0, 200) });
  if (r.errs.length > BOT_ERR_MAX) r.errs.shift();
}
// a message from the bot, on whatever transport it came
function botHear(r, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'ready') { r.ready = true; if (typeof m.name === 'string') r.name = m.name.slice(0, 40); return; }
  if (m.t === 'err') { r.waiting = false; botErr(r, m.msg); return; }
  if (m.t !== 'act' || m.tick !== r.sentT) return; // an answer to a think already given up on
  r.waiting = false;
  r.ms += (performance.now() - r.sentAt - r.ms) * 0.1; // timed here: inside a sealed realm the clock stands still
  const a = botAct(m.act);
  if (!a) return; // null: keep what is held
  r.act = a;
  r.edge = true;
  r.nav = null;
  if (a.say !== undefined) {
    for (const q of players) {
      const rq = botRt.get(q.id);
      if (q !== r.p && q.team === r.p.team && rq) rq.inbox.push({ from: r.p.id, say: a.say });
    }
  }
  if (a.think) botSetThought(r.p, a.think, r.name);
}
// the seat's step, in place of updateAI (updatePlay, sim.js)
function botStep(p, dt) {
  let r = botRt.get(p.id);
  if (!r && !(r = botOpen(p))) { updateAI(p, dt); return; } // a program this page does not have: the built-in brain plays the seat
  r.p = p; // a load or a wire echo puts a new body in the seat: the runtime follows it
  if (state.tick % 600 === p.id) botIdPrune();
  if ((state.tick + p.id) % BOT_THINK === 0 && r.ready) {
    if (r.waiting) r.late++;
    else {
      r.waiting = true;
      r.sentT = state.tick;
      r.thinks++;
      const obs = botObserve(p);
      r.seen = players.map((q) => q.deaths);
      r.sentAt = performance.now();
      r.conn.send({ t: 'obs', tick: state.tick, obs });
    }
  }
  const inp = p.input, a = r.act;
  if (!a) { inp.mx = inp.my = 0; inp.fire = inp.work = inp.slide = inp.grapple = false; return; }
  inp.mx = a.mx; inp.my = a.my;
  if (a.goTo && !p.dead) {
    const n = navTo(p, a.goTo.x, a.goTo.y, PLAYER_R, a.goTo.reach, dt);
    if (!n.ok) { a.goTo = null; r.nav = 'fail'; } // a goal with no way to it is dropped, and the bot is told
    else { inp.mx = n.dx; inp.my = n.dy; r.nav = n.d < TILE ? 'arrived' : 'ok'; }
  }
  if (a.aimX === a.aimX) { inp.aimX = a.aimX; inp.aimY = a.aimY; }
  inp.fire = a.fire; inp.work = a.work; inp.slide = a.slide; inp.grapple = a.grapple;
  if (r.edge) {
    r.edge = false;
    inp.dodge = inp.dodge || a.dodge; inp.jump = inp.jump || a.jump;
    inp.eatBerry = inp.eatBerry || a.eatBerry; inp.eatFish = inp.eatFish || a.eatFish; inp.useCard = inp.useCard || a.useCard;
    if (a.ability >= 0) inp.ability = a.ability;
    if (a.cmd) inp.cmd = a.cmd;
    // through the side's own anti-spam, on the same cooldown as a native bot's calls
    const c = a.call;
    if (c && !PRACTICE && unitAlive(p) && !(p.ai.callCd > 0) && callFree(p.team, c.kind, c.x, c.y)) {
      addCallout(c.kind, CALLS[c.kind].word(c.n), p.id, p.team, Math.round(c.x), Math.round(c.y));
      p.ai.callCd = CALL_BOT_CD;
    }
  }
  // the ladder's hands, the one set every scripted seat shares (js/ai-skill.js)
  if (typeof skillHands === 'function' && typeof AI_LADDER_HANDS !== 'undefined') skillHands(p, AI_LADDER_HANDS, dt);
}
// is any seat still waiting on an answer? (a lockstep runner steps only once none is)
function botPending() {
  for (const r of botRt.values()) if (r.conn.async && (r.waiting || (!r.ready && !r.errN))) return true;
  return false;
}
// give up on every late answer: the seat keeps the act it holds
function botGiveUp() {
  for (const r of botRt.values()) if (r.conn.async && (r.waiting || !r.ready)) { if (!r.ready && !r.errN) botErr(r, 'no answer to hello'); r.waiting = false; r.late++; }
}
function botEnd(result) { for (const r of botRt.values()) r.conn.send({ t: 'end', result: result[r.p.team] }); }

// ---- transports ------------------------------------------------------------------------
// A connection is { send(msg), close(), async }: open(src, hear) makes one,
// and hear(msg) takes each answer. Both built-in ones run the same PRELUDE
// around the bot's source - it defines defineBot and answers the messages -
// so a file behaves the same in either, and a socket later is a third one.
const BOT_PRELUDE = `
let BOT = null, HELLO = null;
function defineBot(b) { BOT = b; }
function botMsg(m, reply) {
  try {
    if (!BOT || typeof BOT.think !== 'function') throw new Error('the file never called defineBot({ think(obs) { ... } })');
    if (m.t === 'hello') {
      HELLO = m;
      if (Math.random.seed) Math.random.seed(m.seed * 16 + m.seat); // a sealed realm's random replays with the match
      if (BOT.init) BOT.init(m);
      reply({ t: 'ready', name: BOT.name, author: BOT.author, version: BOT.version });
    } else if (m.t === 'obs') reply({ t: 'act', tick: m.tick, act: BOT.think(m.obs, HELLO) || null });
    else if (m.t === 'end' && BOT.end) BOT.end(m.result);
  } catch (e) { reply({ t: 'err', tick: m.tick, msg: String(e && e.message || e) }); }
}
`;
// A realm of its own (a worker, the arena's vm) is sealed before the file
// loads: Math.random is seeded from the match (on hello) and the clock stands
// at 0, so the same seed and the same files replay the same match, and a bot
// cannot smuggle chance or time into its choices.
const BOT_SEAL = `
Math.random = (() => {
  let s = 1;
  const f = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.seed = (n) => { s = n >>> 0; };
  return f;
})();
Date = ((D) => class extends D { constructor(...a) { if (a.length) super(...a); else super(0); } static now() { return 0; } })(Date);
if (typeof performance !== 'undefined') performance.now = () => 0;
`;
// the same thread: every message goes through JSON both ways, so the bot's
// world and the game's never share an object - a data boundary, not a lock:
// the file runs in the page's own scope and could read the game, so only the
// baked examples run this way. Anyone else's file runs sealed.
function botInline(src, hear) {
  let fn = null, fail = null;
  try { fn = new Function(BOT_PRELUDE + '\n' + src + '\nreturn botMsg;')(); } catch (e) { fail = e; }
  return {
    async: false,
    send(m) {
      if (!fn) { hear({ t: 'err', msg: String(fail && fail.message || fail) }); return; }
      fn(JSON.parse(JSON.stringify(m)), (out) => hear(JSON.parse(JSON.stringify(out))));
    },
    close() { fn = null; },
  };
}
// a Web Worker from a Blob: works from file:// and in the desktop wrapper,
// and the bot has no window, no players, no storage - only its messages
function botWorker(src, hear) {
  const code = BOT_SEAL + BOT_PRELUDE + '\n' + src + '\nself.onmessage = (e) => botMsg(e.data, (m) => postMessage(m));';
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  let w = null;
  try { w = new Worker(url); } catch (e) { hear({ t: 'err', msg: 'no worker: ' + e.message }); }
  URL.revokeObjectURL(url);
  if (w) {
    w.onmessage = (e) => hear(e.data);
    w.onerror = (e) => { e.preventDefault(); hear({ t: 'err', msg: e.message || 'the file did not load' }); };
  }
  return { async: true, send(m) { if (w) w.postMessage(m); }, close() { if (w) w.terminate(); w = null; } };
}

// by name: what a library entry's `run` picks. A harness adds its own here
// (the arena's Node vm, a socket to a bot running elsewhere)
const BOT_TRANSPORTS = { inline: botInline, worker: botWorker };

// the handle for the ladder page, a console, and the headless harness
window.BOTS = { lib: BOT_LIB, rt: botRt, transports: BOT_TRANSPORTS, seal: BOT_SEAL, prelude: BOT_PRELUDE,
  add: botLibAdd, assign: (id, bot) => botAssign(players[id], bot), observe: (id) => botObserve(players[id]), pending: botPending };
