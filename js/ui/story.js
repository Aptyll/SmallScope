// ------------------------------------------------------------ match story
// Three lines under the tally that say what happened to YOU this match and
// who did it: the rival who kept hunting you, the mate who held the bird
// when it was nearly gone, the one who never went down. Bots have names and
// moods, but a player only remembers them if the match tells them what the
// bots did. These lines are that telling, so a loss has a story too.
//
// The record is one object on the match state (state.story), filled by two
// hooks in the sim - a body going down (the down block of `hurtUnit`'s
// player branch, js/player.js) and a blow on a bird (`hurtEagle`, js/boot.js)
// - so it rides saves with the rest of `state` (SAVE_ROOTS) and the wire
// with the match keys (SNAP_STATE, js/net/snapshot.js), and a client prints
// the same lines its host would. Everything else is read off `players` when
// an end screen first asks, once (cached on state.end), so the sim never
// pays for a line nobody is reading.
const STORY_MAX = 3;        // lines an end screen prints
const STORY_ROOST_R = 240;  // px round a bird that counts as holding it (the brain's AI_ROOST_R)
const STORY_HELD_HP = 0.4;  // nerve fraction under which a bird was "held", not just hit
const STORY_PITCH = 7;      // px between two lines of 1x text

// the record, made on first use so a match that never saw a blow keeps none
function storyOf() {
  return state.story || (state.story = {
    downs: {},          // 'killerSeat-victimSeat' -> times
    low: [null, null],  // per team: { hp, by } - its bird's lowest nerve as a percent, and the seat nearest it then (-1 for nobody)
  });
}

// a player went down to another player
function storyDown(killer, p) {
  if (!(killer instanceof Player) || !(p instanceof Player) || killer === p) return;
  const s = storyOf(), k = killer.id + '-' + p.id;
  s.downs[k] = (s.downs[k] || 0) + 1;
}

// a bird took a blow: remember its worst moment and who stood by it
function storyBirdHit(e) {
  if (e.hp <= 0) return; // a bird that broke was not held
  const s = storyOf(), low = s.low[e.team];
  if (low && Math.round(e.hp * 100 / e.maxHp) >= low.hp) return;
  let by = -1, bd = STORY_ROOST_R;
  for (const q of players) {
    if (!q.active || q.dead || inAir(q) || q.team !== e.team) continue;
    const d = Math.hypot(q.x - e.x, q.y - e.y);
    if (d < bd) { bd = d; by = q.id; }
  }
  s.low[e.team] = { hp: Math.max(1, Math.round(e.hp * 100 / e.maxHp)), by }; // as a percent of its nerve, the number the line prints
}

// The lines for the local player's ending, best first, at most STORY_MAX,
// one per name so the three are about three different people. Each is
// { who: player|null, txt } - `who` is printed in their side's colour, the
// rest in the screen's ink. A match the host walked out of has no story.
function storyLines(ws) {
  if (ws.story) return ws.story;
  const out = [], used = new Set();
  const me = player, s = state.story;
  const add = (who, txt) => {
    if (out.length >= STORY_MAX || (who && used.has(who))) return;
    if (who) used.add(who);
    out.push({ who, txt });
  };
  const times = (n) => n === 2 ? 'TWICE' : n + ' TIMES';
  const live = players.filter((q) => q.active && q !== me);
  const allies = live.filter((q) => q.team === me.team), rivals = live.filter((q) => q.team !== me.team);
  if (s && state.over !== 'hostleft') {
    // the rival who hunted you, and the one you hunted
    let hunter = null, hn = 1, prey = null, pn = 1;
    for (const q of rivals) {
      const a = s.downs[q.id + '-' + me.id] || 0, b = s.downs[me.id + '-' + q.id] || 0;
      if (a > hn) { hn = a; hunter = q; }
      if (b > pn) { pn = b; prey = q; }
    }
    if (hunter) add(hunter, ' HUNTED YOU ' + times(hn));
    if (prey) add(prey, ' WENT DOWN TO YOU ' + times(pn));
    // the mate who stood by the bird at its worst, if it is still standing
    const low = s.low[me.team], own = state.drop && state.drop.eagles[me.team];
    if (low && low.by >= 0 && own && own.hp > 0 && low.hp <= STORY_HELD_HP * 100) {
      const q = players[low.by];
      if (q === me) add(me, 'YOU HELD THE BIRD AT ' + low.hp + '%');
      else if (q && q.active) add(q, ' HELD THE BIRD AT ' + low.hp + '%');
    }
  }
  // the mate who hit their bird hardest
  let br = null, bn = 0;
  for (const q of allies) if (q.dmgBird > bn) { bn = q.dmgBird; br = q; }
  if (br && bn >= 20) add(br, ' HIT THEIR BIRD FOR ' + bn);
  // the mate who downed the most, and the one nobody could
  let top = null, tn = 2;
  for (const q of allies) if (q.kills > tn) { tn = q.kills; top = q; }
  if (top) add(top, ' DOWNED ' + tn);
  if (state.elapsed > 180) for (const q of allies) if (!q.deaths && !q.eliminated) { add(q, ' NEVER WENT DOWN'); break; }
  // the richest mate, when the match was too quiet for anything better
  let rich = null, rn = 0;
  for (const q of allies) if (q.xp > rn) { rn = q.xp; rich = q; }
  if (rich) add(rich, ' EARNED ' + rn + ' GOLD');
  return (ws.story = out);
}

// Under the tally, in both ceremonies: each line arrives on its own beat
// after the last plate has landed, centred, 1x, the name in its side's paint.
function drawStoryLines(ws, t, y, T, ac) {
  const lines = storyLines(ws);
  const t0 = T.stats + 4 * T.statStep + T.roll;
  for (let i = 0; i < lines.length; i++) {
    const s0 = t0 + i * 0.18;
    if (t < s0) return;
    const pop = easeOut(Math.min(1, (t - s0) / 0.3));
    const L = lines[i], name = L.who && L.who !== player ? L.who.name : '';
    const w = pixelTextWidth(name + L.txt, 1);
    const x = Math.round((VIEW_W - w) / 2), ly = y + i * STORY_PITCH + Math.round((1 - pop) * 4);
    ctx.globalAlpha = pop;
    if (name) drawPixelTextOutline(ctx, name, x, ly, TEAMS[skin(L.who.team)].mark, '#0a0e23', 1);
    drawPixelTextOutline(ctx, L.txt, x + pixelTextWidth(name, 1), ly, ac.txt, '#0a0e23', 1);
  }
  ctx.globalAlpha = 1;
}
