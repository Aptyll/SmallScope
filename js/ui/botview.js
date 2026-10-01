'use strict';
// The bot dev view: what every bot is thinking, on the map and in a table,
// and the recorder the out-of-game page (botlab.html) reads. A dev
// instrument - it only READS the sim, so it is safe on a host, a solo game
// and the title screen's living world alike, and a client (which runs no
// sim) simply has nothing to show.
// ------------------------------------------------------------ bot thoughts
// What a bot is doing and why, read one way for every caller. The brain
// writes `p.ai.thought` ({ goal, why, target, role, mood, plan, options,
// skill, src, t }: the bot contract, docs/dev/botview.md); until a bot has one, the goal
// is GUESSED from the ladder's own state and marked `guess` (drawn with a
// trailing '?'), so the view is honest about which of the two it is showing.
const BOT_GOALS = {
  DEFEND: '#6fa8ff', GUARD: '#8fb4d9', PUSH: '#ff8a5c', RALLY: '#ffb36b', FIGHT: '#ff5a5a',
  FLEE: '#ffd166', HIDE: '#9aa3b5', EAT: '#7bd88f', WOLF: '#ff7a9a', HUNT: '#c9a26b',
  ESCORT: '#7fe0e0', LOOT: '#e0c3ff', BUILD: '#d9b38c', GATHER: '#a8d672', MINE: '#b7c0cc',
  SPEND: '#d9b38c', SHOP: '#d9b38c', FORGE: '#d9b38c', FOLLOW: '#7fe0e0',
  ROAM: '#7d8699', IDLE: '#5d6578', DEAD: '#454b5a',
};
const BOT_GOAL_ANY = '#c8d0e0'; // a goal word the table above does not know yet
const BOT_AIM_NEAR = 28;        // px round a firing bot's aim point its target is looked for in
function botGoalCol(g) { return BOT_GOALS[g] || BOT_GOAL_ANY; }
function botIsBot(p) { return p.active && p.control === 'ai'; }
// the level a bot plays at, by name (AI_LEVELS / AI_ALLIES, ai.js)
function botLevel(p) { return aiProfile(p).name; }

// the one read: { goal, why, x, y (the target's live point, or null), ref,
// guess, role, mood, plan, options, skill }
function botThought(p) {
  const th = p.ai && p.ai.thought;
  if (!th || !th.goal) return botGuess(p);
  if (p.dead) return Object.assign(botGuess(p), { guess: false }); // a body down thinks nothing, whatever it last wrote
  const t = th.target, r = t && t.ref;
  return {
    goal: th.goal, why: th.why || '', guess: false, ref: r || null, kind: t && t.kind ? String(t.kind).toUpperCase() : '',
    x: r ? r.x : t ? t.x : null, y: r ? r.y : t ? t.y : null,
    role: th.role || '', mood: th.mood || '', plan: th.plan || '',
    options: th.options || null, skill: th.skill || null, src: th.src || '',
  };
}
// Today's brain keeps no goal of its own, but its rungs leave marks: the
// flag it would fly (`want`), the work it holds (`tgt`), its prey, its hide
// clock, its roam point. Read in the ladder's order, top rung first.
function botGuess(p) {
  const ai = p.ai, inp = p.input;
  const g = (goal, why, x, y, ref, kind) => ({ goal, why, x: x === undefined ? null : x, y: y === undefined ? null : y,
    ref: ref || null, kind: kind || '', guess: true, role: '', mood: '', plan: '', options: null, skill: null, src: '' });
  if (p.dead) return g('DEAD', '');
  if (p.eatT > 0) return g('EAT', 'HURT');
  if (p.prone && ai.hideT > 0) return g('HIDE', 'OUTMATCHED');
  if (inp.fire || p.charging) {
    const q = botAimed(p);
    if (q) return g(q.isWolf ? 'WOLF' : 'FIGHT', q.kind, q.e.x, q.e.y, q.e, q.kind);
  }
  const w = ai.want;
  if (w && w.type === 'defend') return g('DEFEND', 'BIRD HIT', w.x, w.y, null, 'BIRD');
  if (w && w.type === 'attack') return g(ai.packGo ? 'PUSH' : 'RALLY', ai.packGo ? 'PACK READY' : 'PUSH TIME', w.x, w.y, null, 'BIRD');
  // a rival noticed for longer than the level's reaction (`seeT`, the
  // ladder's own clock and its engage rule) is a fight between shots too, so
  // the guess holds FIGHT instead of flickering with the trigger
  if (ai.seeT > 0 && ai.seeT >= aiProfile(p).react) {
    const q = botAimed(p);
    return q ? g(q.isWolf ? 'WOLF' : 'FIGHT', q.kind, q.e.x, q.e.y, q.e, q.kind) : g('FIGHT', 'RIVAL SEEN');
  }
  if (ai.huntTgt && !ai.huntTgt.dead) return g('HUNT', 'FOOD', ai.huntTgt.x, ai.huntTgt.y, ai.huntTgt, 'ANIMAL');
  if (ai.tgt) {
    const x = ai.tgt.tx * TILE + TILE / 2, y = ai.tgt.ty * TILE + TILE / 2, what = String(ai.tgt.type || '').toUpperCase();
    return g(ai.tgt.type === 'rock' ? 'MINE' : 'GATHER', what, x, y, null, what);
  }
  if (ai.roam > 0) return g('ROAM', 'NOTHING NEAR', ai.wx, ai.wy, null, 'POINT');
  return g('IDLE', '');
}
// how long ago (in sim ticks) a bot last changed its mind: the view flashes
// a fresh goal white, so a change of plan is seen as it happens
function botChangedAgo(p) { const t = BOTLOG.changed.get(p.id); return t === undefined ? 1e9 : state.tick - t; }
// what a firing bot is shooting at: the body nearest its aim point
function botAimed(p) {
  const ax = p.input.aimX, ay = p.input.aimY;
  let best = null, bd = BOT_AIM_NEAR;
  const look = (e, kind, isWolf) => {
    const d = Math.hypot(e.x - ax, e.y - ay);
    if (d < bd) { bd = d; best = { e, kind, isWolf }; }
  };
  for (const q of players) if (enemyOf(p, q)) look(q, 'RIVAL', false);
  for (const a of animals) if (!a.dead) look(a, a.type === 'wolf' ? 'WOLF' : 'ANIMAL', a.type === 'wolf');
  for (const r of robots) if (!r.dead && r.team !== p.team) look(r, 'SOLDIER', false);
  return best;
}

// ------------------------------------------------------------ bot recorder
// Every goal change and a once-a-second sample of every bot, plus the time
// each bot has spent on each goal, every kill and the birds' nerve - read by
// the table below and sent to the out-of-game page. Stepped from updatePlay (sim.js) after the bots think; it
// writes nothing the sim reads, so it is no part of a save or the wire.
// A match is over when the clock runs backward (a new one began): its last
// summary joins `matches`, the session's history.
const BOTLOG_SAMPLE = 1;       // s between position samples
const BOTLOG_CAP = 60000;      // events + samples kept per match before the oldest go
const BOTLOG_MATCHES = 50;     // finished-match summaries kept this session
const BOTLOG = { seed: SEED, t: -1, sampleT: 0, events: [], samples: [], kills: [], birds: [], seen: new Map(),
  goals: new Map(), time: new Map(), changed: new Map(), matches: [], last: null };
function botLogReset() {
  if (BOTLOG.last) {
    BOTLOG.matches.push(BOTLOG.last);
    if (BOTLOG.matches.length > BOTLOG_MATCHES) BOTLOG.matches.shift();
  }
  BOTLOG.seed = SEED; BOTLOG.t = -1; BOTLOG.sampleT = 0;
  BOTLOG.events = []; BOTLOG.samples = []; BOTLOG.kills = []; BOTLOG.birds = []; BOTLOG.seen.clear();
  BOTLOG.goals.clear(); BOTLOG.time.clear(); BOTLOG.changed.clear(); BOTLOG.last = null;
}
function botLogStep(dt) {
  const t = state.elapsed;
  if (t < BOTLOG.t - 1) botLogReset();
  BOTLOG.t = t;
  BOTLOG.sampleT -= dt;
  const sample = BOTLOG.sampleT <= 0;
  if (sample) BOTLOG.sampleT += BOTLOG_SAMPLE;
  for (const p of players) {
    if (!botIsBot(p) || inAir(p)) continue;
    const th = botThought(p);
    let tm = BOTLOG.time.get(p.id);
    if (!tm) BOTLOG.time.set(p.id, tm = {});
    tm[th.goal] = (tm[th.goal] || 0) + dt;
    if (BOTLOG.goals.get(p.id) !== th.goal) {
      BOTLOG.goals.set(p.id, th.goal);
      BOTLOG.changed.set(p.id, state.tick);
      botLogPush(BOTLOG.events, { t: +t.toFixed(2), id: p.id, goal: th.goal, why: th.why, guess: th.guess,
        x: Math.round(p.x), y: Math.round(p.y), tx: th.x === null ? null : Math.round(th.x), ty: th.y === null ? null : Math.round(th.y) });
    }
    if (sample) botLogPush(BOTLOG.samples, { t: Math.round(t), id: p.id, x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp),
      mhp: Math.round(p.maxHp), k: p.kills, d: p.deaths, goal: th.goal });
  }
  botLogKills(t);
  if (sample && state.drop) botLogPush(BOTLOG.birds, { t: Math.round(t), e: state.drop.eagles.map((e) => [Math.round(Math.max(0, e.hp)), Math.round(e.maxHp), e.state]) });
  // the summary kept current, so the one a new match files is the old match's
  // own (by the time the clock runs backward the players are already reset)
  if (sample) BOTLOG.last = botMatchSummary();
}
// who went down since the last step, credited to whoever's kill count rose
// with it (die, js/player.js, does both at once); -1 when nobody's did
function botLogKills(t) {
  let downs = null, up = null;
  for (const p of players) {
    if (!p.active) continue;
    const was = BOTLOG.seen.get(p.id);
    if (!was) { BOTLOG.seen.set(p.id, { dead: p.dead, kills: p.kills }); continue; }
    if (p.dead && !was.dead) (downs || (downs = [])).push(p);
    if (p.kills > was.kills) (up || (up = [])).push(p);
    was.dead = p.dead; was.kills = p.kills;
  }
  if (downs) for (const v of downs) {
    const i = up ? up.findIndex((a) => a !== v) : -1;
    const a = i >= 0 ? up.splice(i, 1)[0] : null;
    botLogPush(BOTLOG.kills, { t: +t.toFixed(1), a: a ? a.id : -1, v: v.id, x: Math.round(v.x), y: Math.round(v.y) });
  }
}
function botLogPush(list, e) { list.push(e); if (list.length > BOTLOG_CAP) list.splice(0, list.length - BOTLOG_CAP); }
// one bot's line in a table: who, at what level, what it did and how it spent its time
function botRow(p) {
  return {
    id: p.id, name: p.name, team: p.team, col: TEAMS[skin(p.team)].mark, level: botLevel(p), cls: botCls(p),
    role: (p.ai.thought && p.ai.thought.role) || '',
    kills: p.kills, deaths: p.deaths, dmgOut: Math.round(p.dmgOut), dmgBird: Math.round(p.dmgBird),
    dmgStruct: Math.round(p.dmgStruct), gold: p.hGold.length ? p.hGold[p.hGold.length - 1] : 0,
    time: Object.assign({}, BOTLOG.time.get(p.id) || {}),
  };
}
function botCls(p) { return CLASSES[p.cls] ? CLASSES[p.cls].name : ''; }
// each team's paint on this screen, by team index: the page puts BLUE on the left
function botSides() { return [0, 1].map((t) => ({ name: TEAMS[skin(t)].name, col: TEAMS[skin(t)].mark })); }
// the seats nobody's brain drives (the local player, a remote one)
function botPeople() {
  return players.filter((p) => p.active && p.control !== 'ai').map((p) => ({ id: p.id, name: p.name, team: p.team, col: TEAMS[skin(p.team)].mark,
    cls: botCls(p), x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp), maxHp: Math.round(p.maxHp), dead: p.dead, kills: p.kills, deaths: p.deaths }));
}
function botMatchSummary() {
  return { seed: BOTLOG.seed, len: Math.round(BOTLOG.t), bots: players.filter(botIsBot).map(botRow) };
}
// everything recorded so far, as the page saves and loads it, with the
// minimap's terrain (1 px a tile) to draw it on (docs/dev/botview.md)
function botLogExport() {
  return { kind: 'softfall-botlog', v: 1, seed: BOTLOG.seed, len: Math.round(BOTLOG.t), world: WORLD * TILE, map: mmCv.toDataURL(),
    sides: botSides(), bots: players.filter(botIsBot).map(botRow), people: botPeople(), events: BOTLOG.events, samples: BOTLOG.samples,
    kills: BOTLOG.kills, birds: BOTLOG.birds, matches: BOTLOG.matches };
}

// ------------------------------------------------------------ bot view
// F4 steps it: off, the map (a line to each bot's target and its goal over
// its head, the full card on the bot under the pointer), then the map and
// the table. F6 opens the out-of-game page in its own window.
let botView = 0;
const BOT_VIEW_MODES = 3;
const BOT_HOVER_R = 14;        // view px from a bot's feet the pointer picks it within
const BOT_TAG_DY = 6;          // world px under the feet the goal word hangs (over the head is the name plate's)
const BOT_PANEL_W = 196;
const BOT_ROW = 9;
const BOT_BAR_W = 44;          // the goal-time bar at a row's right end
const BOT_EDGE = '#5b6678', BOT_BG = 'rgba(12,16,24,0.92)', BOT_INK = '#d6dde8', BOT_DIM = '#7d8699';
const BOT_SHADOW = 'rgba(6,8,14,0.9)';
const BOT_FLASH = 18;          // ticks a fresh goal is drawn white before it takes its colour
// each level's ink in the table, dim to hot (AI_LEVELS / AI_ALLIES, ai.js)
const BOT_LEVEL_COL = { NORMAL: '#8f9cb3', HARD: '#c7d3e6', IMPOSSIBLE: '#ff7a7a', ALLY: '#7fb8e0' };
function botLevelCol(name) { return BOT_LEVEL_COL[name] || BOT_DIM; }
function botViewStep() { botView = (botView + 1) % BOT_VIEW_MODES; }

// the world pass (render.js, beside the debug routes): a dotted line from
// each bot to what it is after, ending in a ring. World pixels, so it rides
// the zoom exactly like the routes do.
function drawBotLines(ex, ey) {
  if (!botView) return;
  for (const p of players) {
    if (!botIsBot(p) || p.dead || inAir(p)) continue;
    const th = botThought(p);
    if (th.x === null) continue;
    const col = botGoalCol(th.goal);
    const x0 = Math.round(p.x - ex), y0 = Math.round(p.y - ey), x1 = Math.round(th.x - ex), y1 = Math.round(th.y - ey);
    hbLine(x0, y0, x1, y1, col, p === botHover ? 0 : 3);
    hbRing(x1, y1, p === botHover ? 5 : 3, col);
  }
}

let botHover = null; // the bot under the pointer this frame (set by drawBotTags)
// the view pass under the HUD (render.js): the goal under every bot's feet,
// and which bot the pointer is on
function drawBotTags() {
  botHover = null;
  if (!botView) return;
  let hd = BOT_HOVER_R;
  for (const p of players) {
    if (!botIsBot(p) || p.dead || inAir(p)) continue;
    const sx = Math.round(wToSX(p.x)), sy = Math.round(wToSY(p.y));
    if (sx < -40 || sy < -20 || sx > VIEW_W + 40 || sy > VIEW_H + 40) continue;
    const d = Math.hypot(mouse.x - sx, mouse.y - sy);
    if (mouse.inside && d < hd) { hd = d; botHover = p; }
    const th = botThought(p);
    const w = th.goal + (th.guess ? '?' : '');
    const col = botChangedAgo(p) < BOT_FLASH ? '#ffffff' : botGoalCol(th.goal);
    drawPixelTextOutline(ctx, w, sx - Math.round(pixelTextWidth(w) / 2), sy + Math.round(BOT_TAG_DY * zoomCur), col, BOT_SHADOW);
  }
}
// ...and over it: the table and the hovered bot's card
function drawBotView() {
  if (!botView) return;
  const row = botView > 1 ? drawBotPanel() : null;
  if (botHover) drawBotCard(botHover, row);
}

function botFrame(x, y, w, h) {
  ctx.fillStyle = BOT_BG; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = BOT_EDGE;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
}
function botText(s, x, y, col) { drawPixelTextShadow(ctx, s, x, y, col, BOT_SHADOW); }
function botTextR(s, x, y, col) { botText(s, x - pixelTextWidth(s), y, col); }
// a goal-time bar: each goal's share of the bot's match, in the table's order
function botBar(tm, x, y, w) {
  let sum = 0;
  for (const k in tm) sum += tm[k];
  ctx.fillStyle = '#1c2230'; ctx.fillRect(x, y, w, 5);
  if (sum <= 0) return;
  let cx = x;
  const keys = Object.keys(BOT_GOALS).concat(Object.keys(tm).filter((k) => !BOT_GOALS[k]));
  for (const k of keys) {
    if (!tm[k]) continue;
    const seg = Math.round((tm[k] / sum) * w);
    if (seg <= 0) continue;
    ctx.fillStyle = botGoalCol(k); ctx.fillRect(cx, y, Math.min(seg, x + w - cx), 5);
    cx += seg;
    if (cx >= x + w) break;
  }
}

// the card on the hovered bot: who, level, goal and why, what it is after
// and how far, and whatever the brain has written of its role, mood, plan
// and the options it weighed. Beside the bot when the pointer is on it in
// the world, beside the row when the pointer is on the table (`row`: the
// row's left edge and middle), so a bot off screen still has its card.
function drawBotCard(p, row) {
  const th = botThought(p);
  const lines = [];
  const lv = th.src && th.src !== 'native' ? th.src.toUpperCase().slice(0, 10) : botLevel(p);
  lines.push([p.name, playerTint(p), lv, th.src && th.src !== 'native' ? BOT_DIM : botLevelCol(lv)]);
  lines.push([th.goal + (th.guess ? '?' : ''), botGoalCol(th.goal), th.why, BOT_INK]);
  if (th.x !== null) lines.push([th.kind || 'TARGET', BOT_DIM, Math.round(Math.hypot(th.x - p.x, th.y - p.y) / TILE) + ' TILES', BOT_INK]);
  if (th.role || th.mood) lines.push([th.role, BOT_INK, th.mood, BOT_DIM]);
  if (th.plan) lines.push(['PLAN', BOT_DIM, th.plan, BOT_INK]);
  lines.push(['HP', BOT_DIM, Math.max(0, Math.round(p.hp)) + '/' + Math.round(p.maxHp), BOT_INK]);
  const opts = th.options ? th.options.slice(0, 4) : [];
  let w = 104;
  for (const [a, , b] of lines) w = Math.max(w, pixelTextWidth(a || '') + pixelTextWidth(b || '') + 14);
  const h = 5 + lines.length * 8 + opts.length * 8 + (opts.length ? 2 : 0);
  let x, y;
  if (row) { x = row.x - w - 3; y = row.y - Math.round(h / 2); }
  else {
    x = Math.round(wToSX(p.x)) + 12; y = Math.round(wToSY(p.y)) - Math.round(h / 2);
    if (x + w > VIEW_W - 2) x = Math.round(wToSX(p.x)) - 12 - w;
  }
  x = Math.max(2, x); y = Math.max(2, Math.min(VIEW_H - h - 2, y));
  botFrame(x, y, w, h);
  let ry = y + 3;
  for (const [a, ac, b, bc] of lines) {
    if (a) botText(a, x + 4, ry, ac);
    if (b) botTextR(b, x + w - 4, ry, bc);
    ry += 8;
  }
  if (opts.length) { ctx.fillStyle = '#2a3242'; ctx.fillRect(x + 4, ry - 1, w - 8, 1); ry += 1; }
  for (const o of opts) {
    botText(o.goal, x + 4, ry, botGoalCol(o.goal));
    const bw = 40, s = Math.max(0, Math.min(1, +o.score || 0));
    ctx.fillStyle = '#1c2230'; ctx.fillRect(x + w - 4 - bw, ry + 1, bw, 3);
    ctx.fillStyle = botGoalCol(o.goal); ctx.fillRect(x + w - 4 - bw, ry + 1, Math.round(bw * s), 3);
    ry += 8;
  }
}

// the table: every bot, grouped by side, with its level, goal, record and
// how it has spent the match; under it one line per level (the difficulty
// read), this match and the session's finished ones. The pointer on a row
// is the pointer on that bot (its line goes solid, its card opens beside
// the row): returns where that card hangs, or null.
function drawBotPanel() {
  const bots = players.filter(botIsBot);
  if (!bots.length) return null;
  let rowAt = null;
  const sides = [0, 1].map((t) => bots.filter((p) => p.team === t)).filter((g) => g.length);
  const lv = botLevelRows(bots);
  const h = 17 + bots.length * BOT_ROW + (sides.length - 1) * 3 + 6 + lv.length * 8 + 3;
  const x = VIEW_W - BOT_PANEL_W - MM_GAP, y = MM_CY + MM_R + MM_OUT + 6;
  botFrame(x, y, BOT_PANEL_W, h);
  // head: the columns, right-aligned numbers
  const C_LV = 70, C_GOAL = 74, C_K = 128, C_D = 140;
  botText('BOT', x + 8, y + 4, BOT_DIM);
  botText('GOAL', x + C_GOAL, y + 4, BOT_DIM);
  botTextR('K', x + C_K, y + 4, BOT_DIM); botTextR('D', x + C_D, y + 4, BOT_DIM);
  const tt = Math.floor(state.elapsed / 60) + ':' + String(Math.floor(state.elapsed % 60)).padStart(2, '0');
  botTextR(tt, x + BOT_PANEL_W - 4, y + 4, BOT_DIM);
  ctx.fillStyle = '#2a3242'; ctx.fillRect(x + 3, y + 12, BOT_PANEL_W - 6, 1);
  let ry = y + 15;
  for (const g of sides) {
    ctx.fillStyle = TEAMS[skin(g[0].team)].mark;
    ctx.fillRect(x + 3, ry, 2, g.length * BOT_ROW - 2);
    for (const p of g) {
      const th = botThought(p), dim = p.dead ? 0.5 : 1;
      if (mouse.inside && mouse.x >= x + 6 && mouse.x < x + BOT_PANEL_W - 3 && mouse.y >= ry - 1 && mouse.y < ry - 1 + BOT_ROW) {
        botHover = p; rowAt = { x, y: ry + 3 };
      }
      if (p === botHover) { ctx.fillStyle = 'rgba(214,221,232,0.08)'; ctx.fillRect(x + 6, ry - 1, BOT_PANEL_W - 9, BOT_ROW); }
      ctx.globalAlpha = dim;
      botText(p.name, x + 8, ry, playerTint(p));
      const lv = botLevel(p);
      botTextR(lv[0], x + C_LV, ry, botLevelCol(lv));
      botText(th.goal + (th.guess ? '?' : ''), x + C_GOAL, ry, botChangedAgo(p) < BOT_FLASH ? '#ffffff' : botGoalCol(th.goal));
      botTextR(String(p.kills), x + C_K, ry, BOT_INK);
      botTextR(String(p.deaths), x + C_D, ry, BOT_INK);
      botBar(BOTLOG.time.get(p.id) || {}, x + BOT_PANEL_W - 4 - BOT_BAR_W, ry + 1, BOT_BAR_W);
      ctx.globalAlpha = 1;
      ry += BOT_ROW;
    }
    ry += 3;
  }
  ctx.fillStyle = '#2a3242'; ctx.fillRect(x + 3, ry - 1, BOT_PANEL_W - 6, 1);
  ry += 3;
  for (const r of lv) {
    botText(r.name, x + 8, ry, botLevelCol(r.name));
    botTextR(r.n + (r.past ? '+' + r.past : ''), x + C_LV, ry, BOT_DIM);
    botText('K ' + r.k.toFixed(1) + '  D ' + r.d.toFixed(1), x + C_GOAL, ry, BOT_INK);
    botTextR(Math.round(r.dmg) + ' DMG', x + BOT_PANEL_W - 4, ry, BOT_DIM);
    ry += 8;
  }
  // the table covers the world under it: a pointer on it names no bot there
  if (!rowAt && mouse.x >= x && mouse.x < x + BOT_PANEL_W && mouse.y >= y && mouse.y < y + h) botHover = null;
  return rowAt;
}
// per level: bots this match and in the session's finished matches, and
// their average kills, deaths and damage over all of them
function botLevelRows(bots) {
  const m = new Map();
  const add = (b, past) => {
    let r = m.get(b.level);
    if (!r) m.set(b.level, r = { name: b.level, n: 0, past: 0, k: 0, d: 0, dmg: 0 });
    if (past) r.past++; else r.n++;
    r.k += b.kills; r.d += b.deaths; r.dmg += b.dmgOut;
  };
  for (const p of bots) add(botRow(p), false);
  for (const mt of BOTLOG.matches) for (const b of mt.bots) add(b, true);
  const rows = [...m.values()];
  for (const r of rows) { const c = r.n + r.past; r.k /= c; r.d /= c; r.dmg /= c; }
  return rows;
}

// ------------------------------------------------------------ bot lab link
// The out-of-game page (botlab.html, beside index.html) opened as a window
// of this one: it asks for the log with a hello, then this page sends it a
// frame of every bot's thought a few times a second. postMessage to a window
// we opened, so it works off a double-clicked file with no server.
const BOTLAB_T = 0.25;         // s between frames to the page
// (a timer, not the frame: a window in front of this one may stall its
// frames, and the page should still hear the sim wherever it has got to)
let botLab = null, botLabT = 0;
function openBotLab() {
  if (botLab && !botLab.closed) { botLab.focus(); return botLab; }
  botLab = window.open('botlab.html', 'softfall-botlab', 'width=1280,height=800');
  if (botLab && !botLabT) botLabT = setInterval(botLabPump, BOTLAB_T * 1000);
  return botLab;
}
window.addEventListener('message', (e) => {
  const m = e.data;
  if (!m || !botLab || e.source !== botLab) return;
  // hello: the whole log and the terrain; save: the whole log again, to download
  if (m.kind === 'botlab-hello') botLab.postMessage({ kind: 'botlab-log', log: botLogExport() }, '*');
  else if (m.kind === 'botlab-save') botLab.postMessage({ kind: 'botlab-log', log: botLogExport(), save: true }, '*');
});
function botLabPump() {
  if (!botLab || botLab.closed) { botLab = null; clearInterval(botLabT); botLabT = 0; return; }
  const bots = [];
  for (const p of players) {
    if (!botIsBot(p)) continue;
    const th = botThought(p);
    bots.push({ id: p.id, name: p.name, team: p.team, col: TEAMS[skin(p.team)].mark, level: botLevel(p), cls: botCls(p), x: Math.round(p.x), y: Math.round(p.y),
      hp: Math.round(p.hp), maxHp: Math.round(p.maxHp), dead: p.dead, air: inAir(p),
      goal: th.goal, why: th.why, guess: th.guess, tx: th.x === null ? null : Math.round(th.x), ty: th.y === null ? null : Math.round(th.y),
      role: th.role, mood: th.mood, plan: th.plan, options: th.options, kills: p.kills, deaths: p.deaths, dmgOut: Math.round(p.dmgOut),
      time: BOTLOG.time.get(p.id) || {} });
  }
  const birds = state.drop ? state.drop.eagles.map((e) => ({ team: e.team, col: TEAMS[skin(e.team)].mark, x: Math.round(e.x), y: Math.round(e.y),
    state: e.state, hp: Math.round(Math.max(0, e.hp)), max: Math.round(e.maxHp) })) : [];
  botLab.postMessage({ kind: 'botlab-frame', t: +state.elapsed.toFixed(2), seed: SEED, sides: botSides(), bots, humans: botPeople(), birds,
    events: BOTLOG.events.slice(-40), kills: BOTLOG.kills.slice(-20) }, '*');
}
