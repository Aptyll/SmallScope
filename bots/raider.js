// RAIDER: the rusher. The moment the rival bird lands, every seat runs the
// road at it and never stops. Hunters stand off outside the wing gust and
// loose quick shots (a bird takes the same chip from any arrow, drawn or
// not); warriors swing E at it and take the buffets. It only turns to fight
// what gets in its face, and it does not wait for anyone after a respawn:
// the pressure is the plan (it waits for one partner at most). Beats sides that farm; loses to a side that
// holds its roost.
defineBot({
  name: 'RAIDER',
  author: 'Softfall',
  version: '1.0',

  init(hello) { this.drawT = 0; this.swing = false; this.n = 0; this.waitT = 0; },

  think(obs) {
    const me = obs.me;
    this.n++;
    if (me.dead || me.aboard || me.falling) { this.waitT = me.dead ? 8 : 0; return { think: { goal: 'IDLE', why: me.dead ? 'DOWN' : 'RIDING' } }; }
    const act = {};
    const dist = (o) => Math.hypot(o.x - me.x, o.y - me.y);

    // points: the rush and the net first (they open a path), then the rest
    if (me.skillPts > 0) { const k = pickKey(me, me.cls === 'WARRIOR' ? [1, 2, 3, 0] : [1, 0, 3, 2]); if (k >= 0) act.cmd = { kind: 'ability', i: k }; }

    const bird = obs.eagles.find((e) => e.team !== me.team && e.state === 'down');
    const foes = obs.enemies.concat(obs.soldiers.filter((s) => s.team !== me.team));
    // only what is close enough to stop the raid gets an answer
    // soldiers pour out of the barracks behind the bird all match long: a hunter
    // shoots past them, a warrior cuts only the ones on top of it
    let foe = null;
    for (const f of foes) {
      const r = f.cls ? (me.cls === 'WARRIOR' ? 90 : 110) : (me.cls === 'WARRIOR' ? 36 : 0);
      if (dist(f) < r && (!foe || dist(f) < dist(foe))) foe = f;
    }
    // at the bird, a warrior keeps rival players off its hunters
    if (!foe && me.cls === 'WARRIOR' && bird && dist(bird) < 220) {
      for (const f of obs.enemies) if (Math.hypot(f.x - bird.x, f.y - bird.y) < 220 && (!foe || dist(f) < dist(foe))) foe = f;
    }
    if (foe && !act.cmd) {
      fight(this, me, foe, act);
      act.think = { goal: 'FIGHT', why: 'IN THE WAY', plan: 'RAID', mood: 'RECKLESS', target: { kind: foe.cls ? 'player' : 'soldier', id: foe.id, x: foe.x, y: foe.y } };
      return act;
    }

    if (!bird) {
      // the birds are still in the air: head down the road toward where theirs lands
      const far = obs.eagles.find((e) => e.team !== me.team);
      const to = far && far.state !== 'gone' ? far : { x: me.x, y: me.y };
      act.goTo = { x: to.x, y: to.y };
      act.think = { goal: 'ROAM', why: 'BIRD STILL UP', plan: 'RAID' };
      return act;
    }

    buyGear(this, me, act, 0); // gold is never saved: armour now
    // back from a respawn: wait a few seconds at home for one partner, never longer
    const own = obs.eagles.find((e) => e.team === me.team && e.state === 'down');
    if (this.waitT > 0 && own) {
      this.waitT -= 0.1;
      const buddy = obs.allies.some((a) => !a.dead && !a.aboard && Math.hypot(a.x - me.x, a.y - me.y) < 140);
      if (!buddy) {
        const m = own.mouth || own;
        act.goTo = { x: m.x, y: m.y };
        act.think = { goal: 'RALLY', why: 'ONE PARTNER', plan: 'RAID', target: { kind: 'point', x: m.x, y: m.y } };
        return act;
      }
      this.waitT = 0;
    }
    siege(this, me, bird, act);
    if (me.hp < me.maxHp * 0.35 && me.food.berry > 0 && !foes.some((f) => dist(f) < 160)) act.eatBerry = true;
    act.think = { goal: 'PUSH', why: dist(bird) > 200 ? 'RUN THE ROAD' : 'HIT THE BIRD', plan: 'RAID', mood: 'RECKLESS', target: { kind: 'bird', id: bird.team, x: bird.x, y: bird.y } };
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
