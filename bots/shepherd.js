// SHEPHERD: rides its own soldier waves. Every half minute the barracks
// behind its bird send a column down the road; SHEPHERD waits at the head of
// its spur for one, walks behind the front soldier, clears the rival column
// and anyone who comes out to meet it. Once the column is over the middle
// of the map it commits: soldiers beside it, it goes for the rival bird. Between waves it chops the woods by the spur. Wins the
// middle of the map; slow to answer a raid that skips the road.
defineBot({
  name: 'SHEPHERD',
  author: 'Softfall',
  version: '1.0',

  init(hello) { this.drawT = 0; this.swing = false; },

  think(obs) {
    const me = obs.me;
    if (me.dead || me.aboard || me.falling) return { think: { goal: 'IDLE', why: me.dead ? 'DOWN' : 'RIDING' } };
    const act = {};
    const dist = (o) => Math.hypot(o.x - me.x, o.y - me.y);
    if (me.skillPts > 0) { const k = pickKey(me, me.cls === 'WARRIOR' ? [2, 1, 3, 0] : [0, 1, 3, 2]); if (k >= 0) act.cmd = { kind: 'ability', i: k }; }

    const own = obs.eagles.find((e) => e.team === me.team && e.state === 'down');
    const bird = obs.eagles.find((e) => e.team !== me.team && e.state === 'down');
    if (!own || !bird) { act.goTo = { x: me.x, y: me.y }; act.think = { goal: 'IDLE', why: 'NO ROOST YET' }; return act; }
    const toBird = (o) => Math.hypot(o.x - bird.x, o.y - bird.y);

    // the front of our column: the soldier of ours nearest the rival bird
    const ours = obs.soldiers.filter((s) => s.team === me.team);
    let front = null;
    for (const s of ours) if (!front || toBird(s) < toBird(front)) front = s;
    const foes = obs.enemies.concat(obs.soldiers.filter((s) => s.team !== me.team));

    // over the middle with soldiers of ours beside it: commit to the bird
    const withMe = ours.filter((s) => dist(s) < 220).length;
    const commit = withMe > 0 && toBird(me) < 1100;
    // players first (they kill the column), then the rival column, near us or the
    // front; committed, only what is on top of it
    let foe = null, fd = Infinity;
    for (const f of foes) {
      const d = Math.min(dist(f), front ? Math.hypot(f.x - front.x, f.y - front.y) + 60 : Infinity) + (f.cls ? 0 : 50);
      if (d < (commit ? (f.cls ? 140 : 90) : 200) && d < fd) { fd = d; foe = f; }
    }
    // a blow on our own bird with no column out: go home and answer it
    if (own.hitT < 3 && (!front || toBird(front) > toBird(me) + 200) && dist(own) < 1200) {
      for (const f of foes) if (Math.hypot(f.x - own.x, f.y - own.y) < 300 && (!foe || dist(f) < dist(foe))) foe = f;
      if (!foe) {
        act.goTo = { x: own.x, y: own.y, reach: 1 };
        act.think = { goal: 'DEFEND', why: 'BIRD HIT', plan: 'WAVE' };
        return act;
      }
    }
    if (foe) {
      fight(this, me, foe, act);
      act.think = { goal: 'FIGHT', why: foe.cls ? 'AT THE COLUMN' : 'RIVAL COLUMN', plan: 'WAVE', target: { kind: foe.cls ? 'player' : 'soldier', id: foe.id, x: foe.x, y: foe.y } };
      return act;
    }
    if (me.hp < me.maxHp * 0.6 && me.food.berry > 0) { act.eatBerry = true; act.think = { goal: 'EAT', why: 'LOW HP' }; return act; }
    buyGear(this, me, act, 0);

    // the column is at their bird, or three of ours stand by us near it: siege
    if (commit && (toBird(front) < 400 || toBird(me) < 400)) {
      siege(this, me, bird, act);
      act.think = { goal: 'PUSH', why: 'COLUMN AT THE BIRD', plan: 'WAVE', mood: 'STEADY', target: { kind: 'bird', id: bird.team, x: bird.x, y: bird.y } };
      return act;
    }
    // walk a step behind the front of a column that has left home
    const mouth = own.mouth || own;
    if (front && toBird(front) < toBird(mouth) - 64) {
      const L = Math.max(1, toBird(front)), back = 36;
      const x = front.x + (front.x - bird.x) / L * back, y = front.y + (front.y - bird.y) / L * back;
      act.goTo = { x, y };
      act.aim = [bird.x, bird.y];
      act.think = { goal: 'ESCORT', why: ours.length + ' IN THE COLUMN', plan: 'WAVE', target: { kind: 'soldier', id: front.id, x: front.x, y: front.y } };
      return act;
    }
    // between waves: chop by the head of the spur, where the next one passes
    const n = pickNode(this, obs, mouth, 200, ['tree', 'bush', 'rock']);
    if (n) { work(me, n, act); act.think = { goal: 'GATHER', why: 'WAITING ON A WAVE', plan: 'WAVE', target: { kind: 'point', x: n.x, y: n.y } }; return act; }
    act.goTo = { x: mouth.x, y: mouth.y };
    act.think = { goal: 'RALLY', why: 'WAITING ON A WAVE', plan: 'WAVE', target: { kind: 'point', x: mouth.x, y: mouth.y } };
    return act;
  },
});

// ---- shared moves (every bot file stands alone, so these are copied) --------

// the first key in `order` with a level still to buy
function pickKey(me, order) {
  for (const k of order) if (me.abilities[k] && me.abilities[k].lv < 3) return k;
  return -1;
}

// strike the rival bird: a hunter stands off past the wing gust (it reaches
// 76 px) and taps shots; a warrior walks in and swings E
function siege(bot, me, bird, act) {
  const d = Math.hypot(bird.x - me.x, bird.y - me.y);
  act.aim = [bird.x, bird.y];
  if (me.cls === 'HUNTER') {
    if (d > 115) act.goTo = { x: bird.x, y: bird.y, reach: 1 };
    else if (d < 84) act.move = [(me.x - bird.x) / d, (me.y - bird.y) / d];
    if (d < 135) { bot.drawT++; act.fire = bot.drawT % 2 === 1; } // further out, the woods eat the shots
  } else {
    act.goTo = { x: bird.x, y: bird.y, reach: 1 };
    act.work = d < 56;
  }
}

// one exchange with a rival body, by class, with the four keys
function fight(bot, me, foe, act) {
  const d = Math.max(1, Math.hypot(foe.x - me.x, foe.y - me.y));
  const lead = me.cls === 'HUNTER' ? d / 320 : 0.1;
  act.aim = [foe.x + (foe.vx || 0) * lead, foe.y + (foe.vy || 0) * lead];
  const ab = me.abilities;
  if (me.cls === 'WARRIOR') {
    act.goTo = { x: foe.x, y: foe.y };
    if (ab[1].ready && d > 48 && d < 110) act.ability = 1;                         // rush in
    else if (ab[2].ready && d < 34) act.ability = 2;                               // stomp
    else if (ab[3].ready && d < 30 && foe.hp < foe.maxHp * 0.45) act.ability = 3;  // execute
    bot.swing = !bot.swing;
    act.fire = d < 40 && bot.swing;
  } else {
    if (d < 100) act.move = [(me.x - foe.x) / d, (me.y - foe.y) / d];
    else if (d > 220) act.goTo = { x: foe.x, y: foe.y };
    if (ab[1].ready && d < 110) act.ability = 1;                                   // net, and the kick back
    else if (ab[0].ready && d > 150 && d < 400) act.ability = 0;                   // piercing shot
    bot.drawT++;
    act.fire = bot.drawT < 8;
    if (!act.fire) bot.drawT = 0;
  }
  if (me.hp < me.maxHp * 0.3 && d < 60) act.dodge = true;
}

// a resource node to work near `home`: the nearest of `kinds` within `range`,
// skipping any the pathfinder found no way to (me.nav says 'fail' the think
// after a goTo with no route)
function pickNode(bot, obs, home, range, kinds) {
  const me = obs.me;
  bot.bad = bot.bad || {};
  if (me.nav === 'fail' && bot.node) bot.bad[bot.node.key] = true;
  let best = null, bd = Infinity;
  for (const n of obs.nodes) {
    const key = n.tx + ',' + n.ty;
    if (!kinds.includes(n.kind) || bot.bad[key]) continue;
    const x = n.tx * 16 + 8, y = n.ty * 16 + 8;
    if (Math.hypot(x - home.x, y - home.y) > range) continue;
    const d = Math.hypot(x - me.x, y - me.y) * (n.kind === 'tree' ? 1.5 : 1); // anything but a pine is worth a detour
    if (d < bd) { bd = d; best = { x, y, kind: n.kind, key }; }
  }
  bot.node = best;
  return best;
}

// work a node: walk up beside it and hold E (a rock needs no key: standing by it mines it)
function work(me, n, act) {
  const d = Math.hypot(n.x - me.x, n.y - me.y);
  act.goTo = { x: n.x, y: n.y, reach: 1 };
  act.aim = [n.x, n.y];
  act.work = d < 28 && n.kind !== 'rock';
}

// gold to spare: the next gear piece, round the four in turn (the obs does
// not say which pieces are already bought, so a full one is just skipped)
function buyGear(bot, me, act, keep) {
  if (act.cmd || me.gold < keep + 10) return;
  bot.gear = ((bot.gear || 0) + 1) % 4;
  act.cmd = { kind: 'gear', piece: bot.gear };
}
