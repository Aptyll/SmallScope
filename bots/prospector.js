// PROSPECTOR: the farmer. Spends the early match getting rich: loot on the
// ground first, then chests, rocks, berry bushes, rabbits and deer, and pines
// when nothing better is near. Every coin goes on armour and every point on
// the class keys. It only defends when its own bird is struck. At nine
// minutes (or from five, once a seat's armour is full) it calls the push, and the
// whole side goes for the rival bird at once, geared. Beats sides that
// trade early and even; loses to an early raid.
const PUSH_AT = 540;   // s: the push, called by the clock if nobody called it sooner
const PUSH_FULL = 300; // s: the earliest a seat in full armour may call it
defineBot({
  name: 'PROSPECTOR',
  author: 'Softfall',
  version: '1.0',

  init(hello) { this.drawT = 0; this.swing = false; this.push = false; this.spent = 0; this.lastGold = 0; },

  think(obs) {
    const me = obs.me;
    if (me.dead || me.aboard || me.falling) return { think: { goal: 'IDLE', why: me.dead ? 'DOWN' : 'RIDING' } };
    const act = {};
    const dist = (o) => Math.hypot(o.x - me.x, o.y - me.y);
    if (me.skillPts > 0) { const k = pickKey(me, me.cls === 'WARRIOR' ? [1, 3, 2, 0] : [0, 1, 3, 2]); if (k >= 0) act.cmd = { kind: 'ability', i: k }; }

    for (const m of obs.team) if (m.say && m.say.push) this.push = true;
    if (!this.push && obs.time > PUSH_AT) { this.push = true; act.say = { push: true }; }
    // armour: count what a buy took off the purse; 260 gold buys all four pieces to the top
    if (this.wantGear && [10, 20, 35].includes(this.lastGold - me.gold)) this.spent += this.lastGold - me.gold;
    this.wantGear = false;
    this.lastGold = me.gold;
    if (!this.push && this.spent >= 240 && obs.time > PUSH_FULL) { this.push = true; act.say = { push: true }; }

    const own = obs.eagles.find((e) => e.team === me.team && e.state === 'down');
    const bird = obs.eagles.find((e) => e.team !== me.team && e.state === 'down');
    const home = own || { x: me.x, y: me.y };
    const foes = obs.enemies.concat(obs.soldiers.filter((s) => s.team !== me.team));

    // a fight it can't walk away from, or anything at its own bird when struck
    let foe = null;
    // farming, it only turns on a soldier that is on top of it
    for (const f of foes) if (dist(f) < (this.push ? 220 : f.cls ? 130 : 50) && (!foe || dist(f) < dist(foe))) foe = f;
    if (!foe && own && own.hitT < 4 && dist(own) < 900) {
      for (const f of foes) if (Math.hypot(f.x - own.x, f.y - own.y) < 300 && (!foe || dist(f) < dist(foe))) foe = f;
      if (!foe) {
        act.goTo = { x: own.x, y: own.y, reach: 1 };
        act.think = { goal: 'DEFEND', why: 'BIRD HIT', plan: this.push ? 'PUSH' : 'FARM' };
        return act;
      }
    }
    if (foe) {
      fight(this, me, foe, act);
      act.think = { goal: own && Math.hypot(foe.x - own.x, foe.y - own.y) < 300 ? 'DEFEND' : 'FIGHT', why: 'TOO CLOSE', plan: this.push ? 'PUSH' : 'FARM', target: { kind: foe.cls ? 'player' : 'soldier', id: foe.id, x: foe.x, y: foe.y } };
      return act;
    }

    if (me.hp < me.maxHp * 0.6 && me.food.berry > 0) { act.eatBerry = true; act.think = { goal: 'EAT', why: 'LOW HP' }; return act; }
    if (me.hp < me.maxHp * 0.6 && me.food.fish > 0) { act.eatFish = true; act.think = { goal: 'EAT', why: 'LOW HP' }; return act; }
    if (!act.cmd && me.gold >= 45) { buyGear(this, me, act, 35); this.wantGear = !!act.cmd; }

    if (this.push && bird) {
      siege(this, me, bird, act);
      act.think = { goal: 'PUSH', why: obs.time > PUSH_AT ? 'TIME TO CASH IN' : 'ARMOUR FULL', plan: 'PUSH', mood: 'BOLD', target: { kind: 'bird', id: bird.team, x: bird.x, y: bird.y } };
      return act;
    }

    // loot on the ground near, then the best node
    const drop = obs.drops.filter((d) => dist(d) < 200).sort((a, b) => dist(a) - dist(b))[0];
    if (drop) {
      act.goTo = { x: drop.x, y: drop.y };
      act.think = { goal: 'LOOT', why: drop.type, plan: 'FARM', target: { kind: 'drop', id: drop.id, x: drop.x, y: drop.y } };
      return act;
    }
    const game = obs.animals.filter((a) => (a.kind === 'rabbit' || a.kind === 'deer') && dist(a) < 220).sort((a, b) => dist(a) - dist(b))[0];
    if (game) {
      fight(this, me, game, act);
      act.think = { goal: 'HUNT', why: game.kind.toUpperCase(), plan: 'FARM', target: { kind: 'animal', id: game.id, x: game.x, y: game.y } };
      return act;
    }
    // the side spreads out: each seat farms its own patch on its half
    const half = { x: home.x + (1856 - home.x) * ((me.id >> 1) % 5) / 6, y: home.y + (1856 - home.y) * ((me.id >> 1) % 5) / 6 };
    const n = pickNode(this, obs, half, 700, ['chest', 'rock', 'bush', 'tree']);
    if (n) {
      work(me, n, act);
      act.think = { goal: n.kind === 'rock' ? 'MINE' : 'GATHER', why: n.kind.toUpperCase(), plan: 'FARM', target: { kind: 'object', x: n.x, y: n.y } };
      return act;
    }
    act.goTo = { x: half.x, y: half.y };
    act.think = { goal: 'ROAM', why: 'LOOKING FOR GOLD', plan: 'FARM' };
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
