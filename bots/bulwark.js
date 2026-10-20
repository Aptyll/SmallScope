// BULWARK: the turtle. Holds the spur in front of its own bird: warriors
// stand at its head, hunters a step behind. Everyone else chops the woods by the roost
// for items. It only leaves when it has just wiped an attack, or the snow has
// been quiet a long while, and the side is up: then the first seat calls a sally, everyone goes at the
// rival bird together, and the first blow on its own bird calls them home.
// Shows team `say` and reading your own bird's `hitT`.
defineBot({
  name: 'BULWARK',
  author: 'Softfall',
  version: '1.0',

  init(hello) {
    this.drawT = 0; this.swing = false;
    this.quietT = 0;      // s since anyone of the side last saw a rival near home
    this.sally = 0;       // the match second the side's sally began (0: none)
    this.lead = hello.seat === hello.team; // the side's first seat calls the sally
    this.seenT = -99; this.seenN = 0;      // when, and how many, rivals were last at the spur
  },

  think(obs) {
    const me = obs.me;
    if (me.dead || me.aboard || me.falling) return { think: { goal: 'IDLE', why: me.dead ? 'DOWN' : 'RIDING' } };
    const act = {};
    const dist = (o) => Math.hypot(o.x - me.x, o.y - me.y);
    if (me.skillPts > 0) { const k = pickKey(me, me.cls === 'WARRIOR' ? [0, 2, 3, 1] : [1, 0, 2, 3]); if (k >= 0) act.cmd = { kind: 'ability', i: k }; }

    for (const m of obs.team) if (m.say) {
      if (m.say.sally) this.sally = this.sally || obs.time;
      if (m.say.home) this.sally = 0;
    }
    const own = obs.eagles.find((e) => e.team === me.team && e.state === 'down');
    const bird = obs.eagles.find((e) => e.team !== me.team && e.state === 'down');
    if (!own) { act.goTo = { x: me.x, y: me.y }; act.think = { goal: 'IDLE', why: 'NO ROOST YET' }; return act; }

    // the post: two thirds of the way from the bird to the head of its spur
    const mouth = own.mouth || own;
    const post = { x: own.x + (mouth.x - own.x) * 0.66, y: own.y + (mouth.y - own.y) * 0.66 };
    const foes = obs.enemies.concat(obs.soldiers.filter((s) => s.team !== me.team));
    const near = foes.filter((f) => Math.hypot(f.x - post.x, f.y - post.y) < 340);
    const struck = own.hitT < 3;
    // quiet: no rival player near the spur (waves of soldiers come and go regardless)
    this.quietT = struck || obs.enemies.some((f) => Math.hypot(f.x - post.x, f.y - post.y) < 500) ? 0 : this.quietT + 0.1;

    // a sally: out together, home at the first blow on our bird
    if (this.sally && (struck || obs.time - this.sally > 90)) {
      this.sally = 0;
      if (struck) act.say = { home: true };
    }
    // a wipe: three or more were at the spur, and now for 6 s nobody is
    const atSpur = obs.enemies.filter((f) => Math.hypot(f.x - post.x, f.y - post.y) < 500).length;
    if (atSpur) { this.seenN = Math.max(atSpur, obs.time - this.seenT < 10 ? this.seenN : 0); this.seenT = obs.time; }
    const wiped = !atSpur && this.seenN >= 3 && obs.time - this.seenT > 6 && obs.time - this.seenT < 20;
    if (this.lead && !this.sally && bird && !struck && (wiped || (this.quietT > 45 && obs.time > 240))) {
      const up = obs.allies.filter((a) => !a.dead && !a.aboard).length + 1;
      if (up >= (wiped ? 4 : 5)) { this.sally = obs.time; this.seenN = 0; act.say = { sally: true }; }
    }

    // anything in front of the post, or at the bird: everyone answers
    let foe = null;
    for (const f of this.sally ? foes : near) if (!foe || dist(f) < dist(foe)) foe = f;
    if (foe && (!this.sally || dist(foe) < 200)) {
      fight(this, me, foe, act);
      // a hunter fights from the post, never past it
      if (me.cls === 'HUNTER' && !this.sally && Math.hypot(me.x - post.x, me.y - post.y) > 140) act.goTo = { x: post.x, y: post.y };
      act.think = { goal: 'DEFEND', why: struck ? 'BIRD HIT' : 'AT THE SPUR', plan: this.sally ? 'SALLY' : 'HOLD', mood: 'STEADY', target: { kind: foe.cls ? 'player' : 'soldier', id: foe.id, x: foe.x, y: foe.y } };
      return act;
    }
    if (struck) {
      // hit by something nobody can see (a buried hunter): sweep round the bird
      const a = obs.time * 1.3 + me.id;
      act.goTo = { x: own.x + Math.cos(a) * 70, y: own.y + Math.sin(a) * 70 };
      act.aim = [own.x + Math.cos(a) * 120, own.y + Math.sin(a) * 120];
      act.think = { goal: 'DEFEND', why: 'BIRD HIT', plan: 'HOLD', mood: 'ALARMED' };
      return act;
    }

    if (this.sally && bird) {
      siege(this, me, bird, act);
      act.think = { goal: 'PUSH', why: 'SALLY', plan: 'SALLY', mood: 'BOLD', target: { kind: 'bird', id: bird.team, x: bird.x, y: bird.y } };
      return act;
    }

    drink(me, act, 0.6);

    buyItem(obs.shop, me, act, this.lead ? 40 : 0);

    // the rest of the time: warriors at the post, hunters chop close by
    if (me.cls === 'WARRIOR' && obs.allies.some((a) => a.cls === 'HUNTER' && !a.dead)) {
      act.goTo = { x: post.x, y: post.y };
      act.aim = [mouth.x, mouth.y];
      act.think = { goal: 'GUARD', why: 'HOLD THE SPUR', plan: 'HOLD', mood: 'STEADY', target: { kind: 'point', x: post.x, y: post.y } };
      return act;
    }
    const n = pickNode(this, obs, own, 220, ['tree']);
    if (n) { work(me, n, act); act.think = { goal: 'GATHER', why: 'GOLD FOR ITEMS', plan: 'HOLD', target: { kind: 'point', x: n.x, y: n.y } }; return act; }
    act.goTo = { x: post.x, y: post.y };
    act.think = { goal: 'GUARD', why: 'NOTHING TO DO', plan: 'HOLD' };
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

// work a node: walk up beside it and hold E
function work(me, n, act) {
  const d = Math.hypot(n.x - me.x, n.y - me.y);
  act.goTo = { x: n.x, y: n.y, reach: 1 };
  act.aim = [n.x, n.y];
  act.work = d < 28;
}

// gold to spare at a counter: the dearest item the purse covers, keeping
// `keep` back (the obs lists the shop only while me.atShop)
function buyItem(shop, me, act, keep) {
  if (act.cmd || !shop) return;
  // one potion on hand first (it stacks in its own slot), then the dearest item the purse covers
  const pot = shop.find((s) => s.id === 'potion');
  if (pot && me.potions < 1 && me.items.filter((x) => x === null).length > 1 && pot.price <= me.gold - keep) {
    act.cmd = { kind: 'shop', act: 'item', id: 'potion' };
    return;
  }
  if (!me.items.includes(null)) return;
  const can = shop.filter((s) => !s.stack && s.price <= me.gold - keep).sort((a, b) => b.price - a.price);
  if (can.length) act.cmd = { kind: 'shop', act: 'item', id: can[0].id };
}
// hurt: drink a potion if one is on hand and none is running (it never stops the hands)
function drink(me, act, share) {
  const s = me.items.indexOf('potion');
  if (s >= 0 && me.potionT <= 0 && me.hp < me.maxHp * share) act.useItem = s;
}
