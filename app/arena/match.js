'use strict';
// One bot-vs-bot match, headless, start to finish, written as a match log
// (the format: /mnt/project-files/ai-behaviors/match-log.md, and docs/dev/arena.md).
//
//   const { playMatch } = require('./match');
//   const log = playMatch({ seed: 42, shape: 0, level: 1 });
//
// It boots the page in this process (headless.js), makes every seat a bot,
// flies the eagle and steps the sim at its own TICK_DT until a bird is
// driven off or the clock runs out, sampling as it goes. The sim is never
// changed: the log is read off fields the game already keeps, plus
// wrappers that only watch (die for the kill feed, hurtEagle for who hit a
// bird, updateRobot + gainGold for the gold a body's robots bring home).
// One page per process, so one match per process (run.js forks).

const { bootGame } = require('./headless');
const { vmTransport } = require('./sandbox');
const { funScore } = require('./fun');

const SETUPS = ['level', 'versus'];

function playMatch(opts) {
  const o = Object.assign({ seed: 42, shape: 0, level: 1, kind: 'level', a: 1, b: 1, proxy: 1, maxMin: 40, sampleEvery: 2, n: 0 }, opts || {});
  if (!SETUPS.includes(o.kind)) throw new Error('kind must be one of ' + SETUPS.join(', '));
  const g = bootGame({ seed: o.seed, search: '&map=' + (o.shape | 0) });
  // the page's function declarations are globals of this process now; its
  // top-level const/let live in the scripts' shared scope, so the few this
  // file reads are fetched once (each is a stable object or a constant)
  const G = globalThis;
  const L = g.run('({ players, state, CLASSES, AI_LEVELS, TICK_DT, WORLD, TILE, PATCH_TXT })');

  // ---- the seats ------------------------------------------------------------
  // 'level': the game's own sides at settings.aiLevel - seat 0's side are the
  // ALLIES (a notch up, supportive), the other side the RIVALS - with seat 0
  // itself played by a bot on `proxy`'s profile standing in for the human.
  // 'versus': side 0 plays AI_LEVELS[a], side 1 AI_LEVELS[b], no ally bonus.
  // Either way seat 0 is the page's `player`, which the brain never ranks
  // into a push or a guard (aiRank) - the human's seat, sat by a bot.
  g.run(`
    PROFILE.markDropped();                 // no scripted first flight: every rider may leap
    sampleHumanInput = function () {};     // nobody's keys: seat 0's input is its bot's
    settings.aiLevel = ${o.level | 0};
    player.control = 'ai';
  `);
  const levels = L.AI_LEVELS;
  if (o.kind === 'level') g.run(`player.ai.prof = AI_LEVELS[${o.proxy | 0}];`);
  else for (const p of L.players) p.ai.prof = levels[p.team === 0 ? o.a : o.b];
  // bot files (js/bots/api.js, docs/bots/): `bots` adds programs to the
  // library ({ id: source text }) beside the baked examples, `seats` says who
  // plays where ({ seat: id }). Every file runs sealed in a vm context of its
  // own (sandbox.js), the baked examples too, so no seat can read the game
  // and a seed and the same files are one exact replay. `beforeDrop(G)` is
  // the raw hook for anything else.
  G.BOTS.transports.vm = vmTransport(G);
  for (const e of G.BOTS.lib.values()) e.run = 'vm';
  for (const id in o.bots || {}) G.botLibAdd(id, o.bots[id], 'vm');
  for (const seat in o.seats || {}) G.BOTS.assign(+seat, o.seats[seat]);
  if (typeof o.beforeDrop === 'function') o.beforeDrop(G);
  const profName = (p) => (p.ai.prof ? p.ai.prof.name : G.aiProfile(p).name);
  const seats = L.players.map((p) => {
    const scripted = p.botId != null;
    const s = {
      id: p.id, team: p.team, cls: L.CLASSES[p.cls] ? L.CLASSES[p.cls].name : String(p.cls), name: p.name,
      ctrl: scripted ? 'scripted' : p.control === 'ai' ? 'native' : p.control, prof: p.active && !scripted ? profName(p) : null,
    };
    if (scripted) s.bot = String(p.botId);
    return s;
  });

  // ---- the watchers -----------------------------------------------------------
  const events = [];
  const clock = () => L.state.elapsed;
  const round1 = (v) => Math.round(v * 10) / 10;
  const dieWas = G.die;
  G.die = function (p, src, cause) {
    const killer = src && src !== p && src.id !== undefined && L.players.includes(src) ? src : null;
    events.push({ t: round1(clock()), k: 'kill', a: killer ? killer.id : -1, v: p.id, x: Math.round(p.x), y: Math.round(p.y), cause: cause || null });
    return dieWas.apply(this, arguments);
  };
  const lastHit = [-1, -1];
  const hurtEagleWas = G.hurtEagle;
  G.hurtEagle = function (e, dmg, src) {
    if (src && L.players.includes(src)) lastHit[e.team] = src.id;
    return hurtEagleWas.apply(this, arguments);
  };
  // gold a body's worker robots carry home lands whatever the body is doing,
  // so it is passive income too: counted here, kept out of 'work'
  const robotGold = L.players.map(() => 0);
  let inRobot = false;
  const updateRobotWas = G.updateRobot, gainGoldWas = G.gainGold;
  G.updateRobot = function () { inRobot = true; try { return updateRobotWas.apply(this, arguments); } finally { inRobot = false; } };
  G.gainGold = function (p, n) { if (inRobot && p && L.players[p.id] === p) robotGold[p.id] += n; return gainGoldWas.apply(this, arguments); };

  // ---- the drop ---------------------------------------------------------------
  G.beginDrop();
  const T = L.TICK_DT;
  const maxTicks = Math.round(o.maxMin * 60 / T);
  const sampleTicks = Math.max(1, Math.round(o.sampleEvery / T));
  const pKeys = ['x', 'y', 'hp', 'maxHp', 'dead', 'level', 'gold', 'dmg', 'hurt', 'siege', 'kills', 'deaths', 'act', 'goal'];
  // gold that comes whatever a body does - the clock's trickle (TRICKLE_*,
  // js/sim.js) and a side's generators - is not work: a window has to earn
  // more than this before it counts
  const passive = g.run('TRICKLE_GOLD * Math.ceil(' + o.sampleEvery + ' / TRICKLE_T)') + 1;
  const samples = [];
  const act = L.players.map(() => ({ fight: 0, siege: 0, work: 0, move: 0, idle: 0, dead: 0 }));
  const goals = L.players.map(() => ({}));
  const dist = L.players.map(() => 0);
  const prev = L.players.map((p) => ({ x: p.x, y: p.y, dmgOut: p.dmgOut, dmgIn: p.dmgIn, siege: p.dmgBird + p.dmgStruct, xp: p.xp, robot: 0 }));
  const nerveStep = [10, 10]; // the next 10% step down each bird's nerve is logged at
  const W = L.WORLD, TILE = L.TILE, CELL = 8, CW = Math.ceil(W / CELL);
  const cellOpen = new Uint8Array(CW * CW), cellSeen = new Uint8Array(CW * CW);
  let cellsMapped = false;
  let ticks = 0, winner = null, reason = 'timeout', error = null;

  // the terrain as the minimap paints it (1 px per tile, updateMinimap),
  // taken once at the landing - the dashboard's Bot Lab draws a replay on it
  let terrain = null;
  const grabMap = () => {
    g.run('mmBuiltAt = -1e9; updateMinimap();');
    const d = g.run('mmImg.data'), n = W * W, rgb = Buffer.alloc(n * 3);
    for (let i = 0; i < n; i++) { rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2]; }
    terrain = { w: W, h: W, rgb: rgb.toString('base64') };
  };
  const mapCells = () => {
    // a cell counts as ground to cover when most of its tiles can be walked
    for (let cy = 0; cy < CW; cy++) for (let cx = 0; cx < CW; cx++) {
      let n = 0, open = 0;
      for (let ty = cy * CELL; ty < Math.min(W, cy * CELL + CELL); ty++) for (let tx = cx * CELL; tx < Math.min(W, cx * CELL + CELL); tx++) {
        n++; if (G.walkable(tx, ty)) open++;
      }
      cellOpen[cy * CW + cx] = open * 2 > n ? 1 : 0;
    }
    cellsMapped = true;
  };

  const sample = () => {
    const t = round1(clock());
    const eagles = L.state.drop.eagles.map((e) => [Math.round(e.hp), e.maxHp, e.state]);
    const rows = L.players.map((p, i) => {
      const q = prev[i];
      const siege = p.dmgBird + p.dmgStruct;
      const moved = Math.hypot(p.x - q.x, p.y - q.y);
      let a;
      if (!p.active) a = null;
      else if (p.dead) a = 'dead';
      else if (p.dmgOut > q.dmgOut || p.dmgIn > q.dmgIn) a = 'fight';
      else if (siege > q.siege) a = 'siege';
      else if (p.xp - q.xp - (robotGold[i] - q.robot) > passive) a = 'work';
      else if (moved > TILE || p.aboard || G.inAir(p)) a = 'move';
      else a = 'idle';
      if (a) act[i][a] += o.sampleEvery;
      if (!p.dead && !p.aboard) dist[i] += moved;
      const th = p.ai && p.ai.thought;
      const goal = th && th.goal ? String(th.goal) : null;
      if (goal && !p.dead) goals[i][goal] = (goals[i][goal] || 0) + o.sampleEvery;
      if (cellsMapped && p.active && !p.dead && !G.inAir(p)) {
        const cx = Math.floor(p.x / TILE / CELL), cy = Math.floor(p.y / TILE / CELL);
        if (cx >= 0 && cy >= 0 && cx < CW && cy < CW) cellSeen[cy * CW + cx] = 1;
      }
      q.x = p.x; q.y = p.y; q.dmgOut = p.dmgOut; q.dmgIn = p.dmgIn; q.siege = siege; q.xp = p.xp; q.robot = robotGold[i];
      return [Math.round(p.x), Math.round(p.y), Math.round(p.hp), Math.round(p.maxHp), p.dead ? 1 : 0, p.level,
        Math.round(p.xp), Math.round(p.dmgOut), Math.round(p.dmgIn), Math.round(siege), p.kills, p.deaths, a, goal];
    });
    for (const e of L.state.drop.eagles) {
      if (e.state !== 'down') continue;
      const pct = Math.floor(10 * Math.max(0, e.hp) / e.maxHp);
      if (pct < nerveStep[e.team]) { nerveStep[e.team] = pct; events.push({ t, k: 'bird', team: e.team, hp: Math.round(e.hp), by: lastHit[e.team] }); }
    }
    samples.push({ t, eagles, p: rows });
  };

  try {
    while (ticks < maxTicks) {
      // seat 0 dying puts the page in 'dead' (the respawn overlay), which
      // stops the match clock and the day with it (update, js/sim.js). A human
      // watching their respawn is still in a match that runs on, so the
      // harness keeps the page in 'play' until the respawn does it itself.
      if (L.state.over === 'respawning' && L.state.mode === 'dead') L.state.mode = 'play';
      G.update(T);
      ticks++;
      if (!cellsMapped && L.state.mode === 'play') { mapCells(); if (o.map !== false) grabMap(); }
      if (ticks % sampleTicks === 0) sample();
      const down = [0, 1].map((t) => G.teamEagleDown(t));
      if (down[0] || down[1]) {
        for (const t of [0, 1]) if (down[t]) events.push({ t: round1(clock()), k: 'flee', team: t });
        winner = down[0] && down[1] ? null : down[0] ? 1 : 0;
        reason = 'eagle';
        sample();
        break;
      }
    }
  } catch (err) {
    reason = 'error';
    error = String(err && err.stack || err).slice(0, 2000);
  }

  const players = L.players.map((p, i) => ({
    id: p.id, kills: p.kills, deaths: p.deaths, dmg: Math.round(p.dmgOut), siege: Math.round(p.dmgBird + p.dmgStruct),
    gold: Math.round(p.xp), level: p.level, dist: Math.round(dist[i]), acts: act[i], goals: goals[i],
  }));
  // a bot file's health at the whistle (js/bots/api.js): how often it threw
  // or answered nothing usable, so a ladder can flag a broken entry
  for (const s of seats) {
    const r = s.ctrl === 'scripted' && G.BOTS.rt.get(s.id);
    if (r) { s.errors = r.errN; s.late = r.late; s.thinks = r.thinks; if (r.dead) s.dead = true; } // dead: its sandbox died (sandbox.js)
  }
  const kindName = o.kind === 'level' ? levels[o.level].name.toLowerCase() : levels[o.a].name.toLowerCase() + '-v-' + levels[o.b].name.toLowerCase();
  const log = {
    v: 1,
    id: [o.seed, o.shape | 0, kindName, o.n].join('-'),
    date: new Date().toISOString(),
    patch: String(L.PATCH_TXT || '').replace(/^PATCH\s*/, ''),
    runner: 'node',
    world: W * TILE,
    seed: o.seed, shape: g.run('MAP_TYPE'), shapeName: g.run('MAPS[MAP_TYPE].name'),
    setup: o.kind === 'level'
      ? { kind: 'level', level: o.level, levelName: levels[o.level].name, proxy: levels[o.proxy].name }
      : { kind: 'versus', a: levels[o.a].name, b: levels[o.b].name },
    seats,
    result: { winner, reason, time: round1(clock()), ticks, error },
    sampleEvery: o.sampleEvery,
    pKeys, samples, events, players,
    cells: { size: CELL, open: cellOpen.reduce((a, b) => a + b, 0), seen: cellSeen.reduce((a, b, i) => a + (b && cellOpen[i] ? 1 : 0), 0) },
  };
  if (o.seats) log.setup.seats = o.seats;
  if (terrain) log.map = terrain;
  log.fun = funScore(log);
  return log;
}

module.exports = { playMatch, SETUPS };

// `node app/arena/match.js '{"seed":42}'` plays one match and prints its log
// on stdout - how run.js drives a worker, and a way to poke one by hand
// (the options come on stdin when there is no argument: run.js sends them that
// way, since a bot's source can outgrow a command line)
if (require.main === module) {
  const opts = process.argv[2] ? process.argv[2] : require('fs').readFileSync(0, 'utf8');
  const log = playMatch(JSON.parse(opts || '{}'));
  process.stdout.write(JSON.stringify(log));
}
