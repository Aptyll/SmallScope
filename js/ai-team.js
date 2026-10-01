'use strict';
// The side's shared mind: every bot's personality, the role the side hands
// it, what the side has seen and who is calling for help - the few simple
// rules teamwork comes out of. The ladder (js/ai.js) asks it; nothing here
// writes an input.
// ------------------------------------------------------------ team brain
// Three ideas, each a small rule, and the teamwork is what they add up to:
//   MOOD   every bot is one of five temperaments, dealt so each side fields
//          all five. A mood moves the choices - when to back off, how far it
//          walks to help, how long it farms - never the hands (aim, draw and
//          reactions are the profile's, js/ai.js).
//   ROLE   the side's plan hands out the jobs the ladder already had (who
//          pushes, who guards) plus two new ones (a scout that walks the
//          middle and the far bank, a stalker that goes after a rival the side
//          saw alone), picked by fit to the mood, not by seat. A role is kept
//          while it is still wanted, so nobody flip-flops.
//   MEMORY the side pools what it sees: every rival any bot notices is a
//          sighting the whole side can act on, and a bot hurt or outnumbered
//          in a fight calls for help - a friend near enough, free enough and
//          loyal enough comes, and on arrival the caller is an anchor the
//          fight rung reads, so it joins the fight rather than walking past.
// Plus the plan's one reading of the match: its STANCE (FARM, PRESS, PUSH,
// HOLD, BEAR) and the WINDOW - when more of the rivals are down than of its
// own, or the side is wearing a bear's blood, the side's free hands go for
// the bird while it lasts. And the BEAR: once the side is strong enough it
// sends a party to the bear on its bank together - the kill pays everyone
// and bloods them (MONSTER's teamPay, wildlife.js), which opens the window.
// The difficulty profile's decision knobs (judge, focus, team, memory) are
// read through aiKnob with a neutral default; a mood nudges them, never
// replaces them.

// ---- moods ------------------------------------------------------------------
// What a mood IS lives in its row:
//   flee   added to the profile's flee (a hunter's burrow point)
//   judge  added to the profile's judge: how readily it backs off a fight the
//          numbers say it is losing (low: takes every fight it sees)
//   help   x the reach it answers a teammate's call from (0 never goes)
//   stalk  whether it will take the stalker's job at all
//   greed  x how far it looks for loot and work
//   roam   x how wide it wanders with nothing to do
//   fit    how well it suits each role (the plan hands jobs out by this)
const AI_MOODS = {
  brave:    { name: 'BRAVE',    flee: -0.15, judge: -0.25, help: 1.3, stalk: true,  greed: 0.9, roam: 1.1, fit: { pusher: 4, stalker: 3, guard: 0, scout: 1, slayer: 3 } },
  cautious: { name: 'CAUTIOUS', flee: 0.15,  judge: 0.25,  help: 0.8, stalk: false, greed: 1,   roam: 0.8, fit: { pusher: 0, stalker: 0, guard: 4, scout: 2, slayer: 1 } },
  greedy:   { name: 'GREEDY',   flee: 0.05,  judge: 0.1,   help: 0.5, stalk: false, greed: 1.5, roam: 0.9, fit: { pusher: 1, stalker: 0, guard: 1, scout: 0, slayer: 3 } },
  loyal:    { name: 'LOYAL',    flee: 0,     judge: 0.1,   help: 1.8, stalk: true,  greed: 1,   roam: 1,   fit: { pusher: 3, stalker: 1, guard: 3, scout: 0, slayer: 2 } },
  wild:     { name: 'WILD',     flee: -0.05, judge: -0.1,  help: 1,   stalk: true,  greed: 1,   roam: 1.6, fit: { pusher: 2, stalker: 4, guard: 0, scout: 4, slayer: 2 } },
};
const AI_MOOD_KEYS = Object.keys(AI_MOODS);
// A bot's mood is for life, not for a match: a body with a roster name of
// its own (a lobby's, a joiner's) is the mood its name hashes to, so the same
// name plays the same temperament in every match, online or off; a seat bot
// (named after its colour) is the mood of its place on its side - the five
// dealt round each side in one fixed order, so both sides field all five and
// RED-4 is the same bot every match. No seed, no rng: nothing here moves the
// world's draws.
function aiMoodOf(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return AI_MOOD_KEYS[(h >>> 0) % AI_MOOD_KEYS.length];
}
function aiMood(p) {
  if (p.ai.mood && AI_MOODS[p.ai.mood]) return AI_MOODS[p.ai.mood];
  if (p._name) p.ai.mood = aiMoodOf(p._name);
  else {
    let n = 0;
    for (const q of players) { if (q === p) break; if (q.team === p.team) n++; }
    p.ai.mood = AI_MOOD_KEYS[(n + p.team * 2) % AI_MOOD_KEYS.length];
  }
  return AI_MOODS[p.ai.mood];
}
// a decision knob off the difficulty profile (js/ai.js), with the neutral
// value a profile that predates it plays by
const AI_KNOB_DEFAULT = { judge: 0.5, focus: 0.5, team: 0.8, memory: 5, obey: 1 };
function aiKnob(prof, k) { return prof[k] !== undefined ? prof[k] : AI_KNOB_DEFAULT[k]; }
// the knob with p's mood on it, kept inside 0..1
function aiJudge(p, prof) { return Math.max(0, Math.min(1, aiKnob(prof, 'judge') + aiMood(p).judge)); }
function aiFlee(p, prof) { return Math.max(0, Math.min(0.9, prof.flee + aiMood(p).flee)); }

// ---- roles ------------------------------------------------------------------
// The jobs a side hands out, in the order it fills them. `name` is the word
// the dashboard shows.
const AI_ROLES = {
  pusher:   { name: 'PUSHER' },   // the objective rung: the rival bird
  guard:    { name: 'GUARD' },    // stands by its own bird (the guard rung)
  scout:    { name: 'SCOUT' },    // walks the middle and the far bank, eyes for the side
  stalker:  { name: 'STALKER' },  // goes after a rival the side saw alone
  slayer:   { name: 'SLAYER' },   // one of the party the side sends to its bear
  gatherer: { name: 'GATHERER' }, // the ladder as it always was: hunt, loot, build, harvest
};
const AI_PLAN_T = 2;        // s between a side's re-plans
const AI_SCOUT_AT = 45;     // s into the match the side sends its scout out
const AI_STALK_AT = 90;     // s into the match the side lets a stalker off the leash
const AI_KEEP = 2;          // fit a bot's current role is worth over a better-suited teammate's
const AI_WINDOW_DOWN = 2;   // more rivals down than own: the side's free hands go for the bird
const AI_WINDOW_MIN = 12;   // s a window, once opened, stays open (a respawn does not snap it shut)
const AI_BEAR_AT = 240;     // s into the match before a side thinks about its bear
const AI_BEAR_N = 3;        // bots the side sends to it, all together
const AI_BEAR_LV = 6;       // mean hero level the party must have (a weak party feeds the bear)
const AI_BEAR_R = 120;      // px off the bear the party meets at before one of them wakes it
const AI_BEAR_WAIT = 15;    // s the party waits for its last member before going in short

// ---- memory -----------------------------------------------------------------
const AI_SEEN_T = 10;       // s a sighting is kept at most (the memory knob cuts it shorter)
const AI_CALL_T = 5;        // s a call for help stays open
const AI_CALL_R = 340;      // px a call reaches at help 1 (x the mood's help)
const AI_CALL_N = 2;        // helpers a call wants; more stay on their own work
const AI_STALK_R = 560;     // px a stalker goes for a sighting from
const AI_ALONE_R = 180;     // px: a rival with no other rival sighting this close is alone
const AI_FLEE_HOLD = 1.5;  // s a bot that turned to back off keeps backing off before the judge reads the numbers again
const AI_GRUDGE_N = 2;      // times a bot downs the same rival in a match before it is personal
const AI_GRUDGE_T = 90;     // s a grudge lasts: the side's stalker job goes to it, on its mark
const AI_ODDS_R = 150;      // px round a fight the numbers are counted in (the judge)

// the side's shared mind, one per team; it is saved whole (SAVE_ROOTS,
// js/save.js), the bear by reference like any other shared body
function aiTeamNew() {
  return { at: -1, stance: 'FARM', why: '', winT: 0, roles: {}, order: [], seen: [], calls: [], focus: -1, bear: null, bearT: 0 };
}
const aiTeams = [aiTeamNew(), aiTeamNew()];

// the side's bots, the way aiRank has always counted them: living, on the
// ground, driven by the brain (a bot FILE's seat plays its own plan,
// js/bots/api.js), never the local player
function aiSideBots(team) {
  const out = [];
  for (const q of players) if (q.active && !q.dead && !inAir(q) && q.team === team && q.control === 'ai' && !q.botId && q !== player) out.push(q);
  return out;
}
// how many of a side are down (dead and coming back, or out for good)
function aiDownCount(team) {
  let n = 0;
  for (const q of players) if (q.active && q.team === team && q.dead) n++;
  return n;
}

// Re-plan a side: its stance, and who holds which job. The push and guard
// counts are the profile's own (aiPushers, prof.guard - the difficulty),
// so the plan decides WHO, not how many; the window is the one time it adds
// pushers of its own. Everyone else is a gatherer, bar one scout and one
// stalker once the match is under way. A bot keeps its role while the role
// is still wanted (AI_KEEP), so the jobs do not reshuffle every re-plan.
function aiPlan(team) {
  const T = aiTeams[team];
  if (state.elapsed < T.at) { Object.assign(T, aiTeamNew()); } // a new match on the same page
  if (T.at >= 0 && state.elapsed - T.at < AI_PLAN_T) return T;
  T.at = state.elapsed;
  aiForget(T);
  const bots = aiSideBots(team);
  if (!bots.length) { T.order = []; return T; }
  const prof = aiProfile(bots[0]);
  const sit = aiSituation(), mine = sit[team], theirs = sit[1 - team];
  // the window: the rivals are thinner on the ground than the side is, or
  // the side is wearing a bear's blood (most of it)
  const gap = aiDownCount(1 - team) - aiDownCount(team);
  let blood = 0;
  for (const q of bots) if (q.buffT > 20) blood++;
  if (theirs && !(mine && mine.threat) && ((state.elapsed > AI_STALK_AT && gap >= AI_WINDOW_DOWN) || blood * 2 > bots.length)) T.winT = AI_WINDOW_MIN;
  else T.winT = Math.max(0, T.winT - AI_PLAN_T);
  let nPush = aiPushers(prof);
  const nGuard = state.elapsed >= prof.push.t * 0.6 ? prof.guard : 0;
  if (T.winT > 0) nPush = Math.max(nPush, bots.length - nGuard);
  nPush = Math.min(nPush, bots.length);
  const want = [];
  for (let i = 0; i < nPush; i++) want.push('pusher');
  for (let i = 0; i < nGuard && want.length < bots.length; i++) want.push('guard');
  // the bear: the side's own (the teamPay camp nearest its bird), asleep,
  // with no rival seen by it, and a party strong enough to spare. A party
  // already out keeps going while the bear lives and the bird is quiet
  const bear = aiSideBear(team);
  let party = 0;
  if (bear && !(mine && mine.threat) && T.winT <= 0) {
    const out = T.bear === bear;
    let lv = 0, n = 0;
    for (const q of bots) { lv += q.level; n++; }
    const quiet = !T.seen.some((sg) => state.elapsed - sg.t < 6 && Math.hypot(sg.x - bear.x, sg.y - bear.y) < AI_ODDS_R * 2);
    if (bots.length - want.length >= AI_BEAR_N && (out || (state.elapsed >= AI_BEAR_AT && n && lv / n >= AI_BEAR_LV && quiet && !bear.target))) party = AI_BEAR_N;
  }
  if (party) { if (T.bear !== bear) T.bearT = 0; T.bear = bear; for (let i = 0; i < party; i++) want.push('slayer'); }
  else T.bear = null;
  if (state.elapsed >= AI_SCOUT_AT && want.length < bots.length - 1) want.push('scout');
  // a grudge (aiDowned) takes the side's one stalker job first, whatever the clock
  const grudger = bots.find((q) => aiGrudge(q));
  if (grudger && want.length < bots.length) want.unshift('stalker');
  else if (state.elapsed >= AI_STALK_AT && want.length < bots.length - 1) want.push('stalker');
  // hand the jobs out best fit first, a held job counting AI_KEEP extra
  const free = bots.slice(), roles = {}, order = [];
  for (const r of want) {
    let best = -1, bs = -Infinity;
    for (let i = 0; i < free.length; i++) {
      const q = free[i], m = aiMood(q);
      if (r === 'stalker' && !m.stalk && q !== grudger) continue;
      const s = (m.fit[r] || 0) + (T.roles[q.id] === r ? AI_KEEP : 0) - q.id * 0.01 + (r === 'stalker' && q === grudger ? 100 : 0);
      if (s > bs) { bs = s; best = i; }
    }
    if (best < 0) continue;
    const q = free.splice(best, 1)[0];
    roles[q.id] = r; order.push(q.id);
  }
  for (const q of free) { roles[q.id] = 'gatherer'; order.push(q.id); }
  T.roles = roles; T.order = order;
  // the stance, the one word the dashboard shows for the side
  if (mine && mine.threat) { T.stance = 'HOLD'; T.why = mine.hp < AI_ALARM_HP ? 'BIRD HURT' : 'BIRD HIT'; }
  else if (T.winT > 0) { T.stance = 'WINDOW'; T.why = blood * 2 > bots.length ? 'BEAR BLOOD' : gap > 0 ? gap + ' DOWN' : 'CLOSING'; }
  else if (T.bear) { T.stance = 'BEAR'; T.why = 'PARTY OF ' + party; }
  else if (nPush > 0) { T.stance = 'PUSH'; T.why = nPush + ' ON BIRD'; }
  else if (want.indexOf('stalker') >= 0) { T.stance = 'PRESS'; T.why = 'HUNTING'; }
  else { T.stance = 'FARM'; T.why = 'LEVELLING'; }
  // the side's focus: the rival most of its bots are shooting at (focus fire)
  const tally = {};
  let fb = -1, fn = 1;
  for (const q of bots) {
    const f = q.ai.foeId;
    if (f === undefined || f < 0) continue;
    tally[f] = (tally[f] || 0) + 1;
    if (tally[f] > fn) { fn = tally[f]; fb = f; }
  }
  T.focus = fb;
  return T;
}
// The commit window: a rival p was fighting stays its foe for AI_COMMIT_T
// after it slips out of sight, as long as it is inside AI_COMMIT_R x the
// sight (through seenAt - a rival that went to ground is still gone).
// Without it a strafe across the edge of sight flips a bot between the
// fight and its last job every few ticks.
const AI_COMMIT_T = 1.5;  // s
const AI_COMMIT_R = 1.25; // x the profile's sight
function aiHoldFoe(p, prof, foe) {
  const ai = p.ai, f = ai.lastFoe;
  if (!foe && f && state.elapsed - ai.lastFoeT < AI_COMMIT_T && (f instanceof Player ? enemyOf(p, f) : unitAlive(f) && f.team !== p.team)) {
    const r = prof.sight * AI_COMMIT_R, d = Math.hypot(f.x - p.x, f.y - p.y);
    if (d < r && (!(f instanceof Player) || d < seenAt(f, r))) return f;
  }
  if (foe) { ai.lastFoe = foe; ai.lastFoeT = state.elapsed; }
  return foe;
}
// The grudge: die() (js/player.js) tells the brain each time a bot downs a
// player; the AI_GRUDGE_N-th time it is the same one, the bot holds a grudge
// for AI_GRUDGE_T - the side's stalker job on that mark, the mark taken over
// any other rival in sight. `seenT` is when it first laid eyes on its mark
// since (the callouts' YOU AGAIN, js/ai-callouts.js), -1 until then.
function aiDowned(k, v) {
  if (!k.ai || v === k) return;
  const d = k.ai.downs || (k.ai.downs = {});
  d[v.id] = (d[v.id] || 0) + 1;
  if (d[v.id] >= AI_GRUDGE_N && !aiGrudge(k)) k.ai.grudge = { id: v.id, until: state.elapsed + AI_GRUDGE_T, seenT: -1 };
}
// p's live grudge, or null (one that ran out, or whose mark is out of the match, is dropped)
function aiGrudge(p) {
  const g = p.ai.grudge;
  if (!g) return null;
  const m = players[g.id];
  if (state.elapsed > g.until || !m || !m.active || m.eliminated) { p.ai.grudge = null; return null; }
  return g;
}
// the mark, if p holds a grudge and can see them now: the rival it fights
function aiGrudgeFoe(p, prof) {
  const g = aiGrudge(p);
  const m = g ? players[g.id] : null;
  if (!m || !enemyOf(p, m)) return null;
  const d = Math.hypot(m.x - p.x, m.y - p.y);
  if (d >= prof.sight * AI_COMMIT_R || d >= seenAt(m, prof.sight * AI_COMMIT_R)) return null;
  if (g.seenT < 0) g.seenT = state.elapsed;
  return m;
}
// Whether an ALLY answers its human's flag: rolled once a flag, off the
// profile's `obey` (a missing knob obeys). The appeal read: an ally that
// ignores you is worse than a dumb one that follows - keep it high.
function aiObeys(p, prof, f) {
  if (p.ai.obeyFor !== f) { p.ai.obeyFor = f; p.ai.obeyOk = rng() < aiKnob(prof, 'obey'); }
  return p.ai.obeyOk;
}

// A bot answering its human's flag says so - ON IT, or GUARDING for the
// guard that stays on the bird - once a flag, staggered by seat so the side
// reads as a crew rather than a chorus. The words are the callouts' (CALLS,
// js/ai-callouts.js): a kind they do not carry yet is simply not said.
const AI_ONIT_T = [0.2, 0.6]; // s after the flag goes up the first and the last of a side answer
function aiAnswerFlag(p, f, kind) {
  const ai = p.ai;
  if (ai.answered === f) return;
  ai.answered = f;
  let n = 0;
  for (const q of players) { if (q === p) break; if (q.team === p.team) n++; }
  ai.answerAt = state.elapsed + AI_ONIT_T[0] + (AI_ONIT_T[1] - AI_ONIT_T[0]) * (n % 5) / 4;
  ai.answerKind = kind;
}
function aiAnswerStep(p) {
  const ai = p.ai;
  if (!ai.answerKind || state.elapsed < ai.answerAt) return;
  const k = ai.answerKind;
  ai.answerKind = null;
  if (CALLS[k]) addCallout(k, CALLS[k].word(p), p.id, p.team, p.x, p.y);
}

// the side's bear: the living teamPay camp monster nearest its own bird
function aiSideBear(team) {
  const e = state.drop && state.drop.eagles[team];
  if (!e) return null;
  let best = null, bd = Infinity;
  for (const a of animals) {
    if (!unitAlive(a) || !MONSTER[a.kind] || !MONSTER[a.kind].teamPay) continue;
    const d = Math.hypot(a.x - e.x, a.y - e.y);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
// The bear party (the slayer role): meet AI_BEAR_R off the bear, and once
// AI_BEAR_N are there (or the first has waited AI_BEAR_WAIT) go in together.
// Returns the bear to fight (the camp rung plays it, js/ai.js), a point to
// walk to while the party forms, or null when p is not in one.
function aiBearJob(p, dt) {
  const T = aiTeams[p.team], b = T.bear;
  if (!b || !unitAlive(b) || aiRole(p) !== 'slayer') return null;
  if (b.target) return { fight: b }; // awake: the party is in
  let here = 0;
  for (const q of players) if (q.team === p.team && !q.dead && q.control === 'ai' && aiRole(q) === 'slayer' && Math.hypot(q.x - b.x, q.y - b.y) < AI_BEAR_R * 1.5) here++;
  const at = Math.hypot(p.x - b.x, p.y - b.y) < AI_BEAR_R * 1.5;
  if (at) T.bearT += dt / Math.max(1, here); // the party's shared wait, one clock however many are waiting
  if (here >= AI_BEAR_N || T.bearT > AI_BEAR_WAIT) return { fight: b };
  return { meet: { x: b.x + (p.x - b.x) / (Math.hypot(p.x - b.x, p.y - b.y) || 1) * AI_BEAR_R, y: b.y + (p.y - b.y) / (Math.hypot(p.x - b.x, p.y - b.y) || 1) * AI_BEAR_R }, here };
}
// p's job this plan (a bot the plan has not seen yet gathers)
function aiRole(p) { return aiPlan(p.team).roles[p.id] || 'gatherer'; }
// p's place in the side's plan: the pushers first, then the guards, then the
// rest - what aiRank reads, so aiWantsPush and aiOnGuard hand the profile's
// push and guard counts to the bots the plan picked
function aiPlanRank(p) {
  const i = aiPlan(p.team).order.indexOf(p.id);
  return i < 0 ? 99 : i;
}

// drop what the side no longer trusts: old sightings and closed calls
function aiForget(T) {
  const now = state.elapsed;
  T.seen = T.seen.filter((s) => now - s.t < AI_SEEN_T && players[s.id] && !players[s.id].dead);
  T.calls = T.calls.filter((c) => now - c.t < AI_CALL_T && players[c.id] && !players[c.id].dead);
}
// a rival p can see right now goes on the side's board (one row a rival,
// the newest spot kept)
function aiSaw(p, q) {
  const T = aiTeams[p.team];
  for (const s of T.seen) if (s.id === q.id) { s.x = q.x; s.y = q.y; s.t = state.elapsed; return; }
  T.seen.push({ id: q.id, x: q.x, y: q.y, t: state.elapsed });
}
// every rival p notices this think, through the same sight rule the fight
// rung uses (seenAt, so a buried rival is never reported)
function aiLook(p, prof) {
  for (const q of players) {
    if (!enemyOf(p, q)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < prof.sight && d < seenAt(q, prof.sight)) aiSaw(p, q);
  }
}
// p calls for help at where it stands (one open call a caller, refreshed)
function aiCall(p, foe) {
  const T = aiTeams[p.team];
  const fid = foe && foe.id !== undefined && players[foe.id] === foe ? foe.id : -1;
  for (const c of T.calls) if (c.id === p.id) { c.x = p.x; c.y = p.y; c.t = state.elapsed; c.foe = fid; return; }
  T.calls.push({ id: p.id, x: p.x, y: p.y, t: state.elapsed, foe: fid, kind: 'help' });
}
// the call p would answer: open, near enough for its mood, not its own, not
// already answered by AI_CALL_N others (p's own answer is not counted
// against it). Null for a bot with a job that must not be dropped - that is
// decided by the caller (the help rung, js/ai.js)
function aiHelpCall(p) {
  const T = aiTeams[p.team], m = aiMood(p);
  const reach = AI_CALL_R * m.help;
  let best = null, bd = reach;
  for (const c of T.calls) {
    if (c.id === p.id || players[c.id].dead || state.elapsed - c.t > AI_CALL_T) continue;
    let n = 0;
    for (const q of players) if (q !== p && q.team === p.team && q.control === 'ai' && q.ai.helping === c.id) n++;
    if (n >= AI_CALL_N) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
// the sighting a stalker goes for: fresh (inside the memory knob), within
// AI_STALK_R, and ALONE - no other rival spotted within AI_ALONE_R of it.
// A lone rival is a fight the side can win; a pair is not a stalker's job
function aiStalkTarget(p, prof) {
  const T = aiTeams[p.team], mem = aiKnob(prof, 'memory');
  const g = aiGrudge(p);
  if (g) { // a grudge goes to its mark's last known spot, alone or not, near or far
    for (const s of T.seen) if (s.id === g.id && state.elapsed - s.t <= AI_SEEN_T) return s;
    return null;
  }
  let best = null, bd = AI_STALK_R;
  for (const s of T.seen) {
    if (state.elapsed - s.t > mem) continue;
    let alone = true;
    for (const o of T.seen) if (o !== s && state.elapsed - o.t <= mem && Math.hypot(o.x - s.x, o.y - s.y) < AI_ALONE_R) { alone = false; break; }
    if (!alone) continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
// The numbers round a fight: rivals seen within AI_ODDS_R of the foe
// against p's side within AI_ODDS_R of p (p counted). What the judge weighs.
function aiOdds(p, foe, prof) {
  let them = 0, us = 0;
  for (const q of players) {
    if (!q.active || q.dead || inAir(q)) continue;
    if (q.team === p.team) { if (Math.hypot(q.x - p.x, q.y - p.y) < AI_ODDS_R) us++; }
    else if (enemyOf(p, q) && Math.hypot(q.x - foe.x, q.y - foe.y) < AI_ODDS_R && Math.hypot(q.x - p.x, q.y - p.y) < seenAt(q, prof.sight)) them++;
  }
  return { us, them };
}
// Should p back off the fight it is in? The judge weighs the numbers and its
// health: a side short by two always gives ground at a good judge, a side
// short by one does once it is hurt, and a poor judge takes every fight it
// sees. A relentless side never gives ground (the profile); nobody backs off
// its own bird (the defend rung holds it).
function aiFallBack(p, prof, foe, odds) {
  if (prof.relentless) return false;
  const j = aiJudge(p, prof), hp = p.hp / p.maxHp, short = odds.them - odds.us;
  if (j < 0.15) return false;
  if (short >= 2) return j >= 0.3 || hp < 0.4;
  if (short >= 1) return hp < 0.3 + 0.4 * j;
  return hp < 0.2 * j && foe.hp > p.hp; // an even fight is only left when it is being lost badly
}
// where p backs off to: the nearest teammate outside the fight, else its own bird
function aiFallBackTo(p, foe) {
  let best = null, bd = Infinity;
  for (const q of players) {
    if (q === p || !q.active || q.dead || inAir(q) || q.team !== p.team) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (Math.hypot(q.x - foe.x, q.y - foe.y) < AI_ODDS_R * 0.5) continue; // one of the fight, not a way out of it
    if (d < bd) { bd = d; best = q; }
  }
  if (best) return best;
  const e = aiOwnEagle(p);
  return e || { x: (p.spawn.tx + 0.5) * TILE, y: (p.spawn.ty + 0.5) * TILE };
}
// the scout's beat: the map's middle, the rival half's road short of its
// lane, and back - one point at a time, re-picked on arrival
function aiScoutPoint(p) {
  const e = state.drop && state.drop.eagles[1 - p.team];
  const pts = [{ x: cx * TILE, y: cy * TILE }];
  if (e) { const g = aiLaneGate(e); pts.push({ x: (g.x * 2 + cx * TILE) / 3, y: (g.y * 2 + cy * TILE) / 3 }); }
  const k = (p.ai.scoutN || 0) % pts.length;
  const b = pts[k];
  const j = aiMood(p).roam;
  return { x: b.x + (hash2(p.id * 7 + k, (p.ai.scoutN || 0) + 31) - 0.5) * 12 * TILE * j, y: b.y + (hash2(p.id * 11 + k, (p.ai.scoutN || 0) + 57) - 0.5) * 12 * TILE * j };
}
// a human in trouble is a call too: the side hears its hand the way it hears
// a bot's (the human never presses anything for it - a hit with a rival on
// them is the call)
function aiHumanCall(team) {
  for (const q of players) {
    if (!q.active || q.dead || inAir(q) || q.team !== team || !isHuman(q)) continue;
    if (q.hurtT <= 0 || q.hp > q.maxHp * 0.7) continue;
    let foe = null;
    for (const r of players) if (enemyOf(q, r) && Math.hypot(r.x - q.x, r.y - q.y) < 200) { foe = r; break; }
    if (foe) aiCall(q, foe);
  }
}

// ---- the thought --------------------------------------------------------------
// What a bot is doing and why, for the dashboard (contract.md, the shared
// folder's ai-behaviors): one record a bot, reused, written by the rung that
// wins each think - the last write in a think is the one that stands.
// `t` may be an entity (its kind is read off where it lives) or a point.
function aiNote(p, goal, why, t) {
  const ai = p.ai;
  const th = ai.thought || (ai.thought = { goal: '', why: '', target: null, role: '', mood: '', plan: '', src: 'native', t: 0 });
  th.goal = goal; th.why = why; th.t = state.tick;
  th.role = AI_ROLES[aiRole(p)].name; th.mood = aiMood(p).name; th.plan = aiTeams[p.team].stance;
  if (!t) { th.target = null; return; }
  const g = th.target || (th.target = { x: 0, y: 0, kind: 'point', ref: null });
  let kind = 'point', x = t.x, y = t.y;
  if (t instanceof Player) kind = 'player';
  else if (state.drop && state.drop.eagles.indexOf(t) >= 0) kind = 'bird';
  else if (t.kind === 'soldier') kind = 'soldier';
  else if (t.tx !== undefined && t.type) { kind = 'object'; x = t.tx * TILE + 8; y = t.ty * TILE + 8; }
  else if (t.kind && t.hp !== undefined) kind = 'animal';
  else if (t.type && t.t !== undefined) kind = 'drop';
  g.kind = kind; g.x = x; g.y = y; g.ref = kind === 'point' ? null : t;
  if (t.id !== undefined) g.id = t.id; else delete g.id;
}
