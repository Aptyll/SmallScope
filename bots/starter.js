// STARTER: the template bot. Copy this file to begin your own.
// Rules of the road (docs/bots/api.md has the whole contract):
//   - think(obs) is called 10 times a second for YOUR seat only, with what your
//     player could see. Return an act: the keys you are holding, plus a thought.
//   - Held keys (move, goTo, aim, attack, work, slide) stay held until your next act.
//     One-shot keys (dodge, ability, useItem, cmd...) fire once.
//   - `this` is your bot object, so keep memory on it (this.team below).
defineBot({
  name: 'STARTER',
  author: 'Softfall',
  version: '1.0',

  init(hello) {
    this.team = hello.team;
    this.mid = hello.map.world * hello.map.tile / 2; // the map's centre, px
  },

  think(obs) {
    const me = obs.me;
    if (me.dead) return { think: { goal: 'IDLE', why: 'DOWN' } };
    const act = {};

    // a free skill point: spend it on the lowest key (ability on a key with a
    // point waiting buys a level instead of casting)
    if (me.skillPts > 0) {
      let best = 0;
      for (const a of me.abilities) if (a.lv < me.abilities[best].lv) best = a.key;
      act.ability = best;
    }

    // the nearest thing to fight: a rival player, else a rival soldier
    const foes = obs.enemies.concat(obs.soldiers.filter((s) => s.team !== me.team));
    let foe = null, fd = Infinity;
    for (const f of foes) {
      const d = Math.hypot(f.x - me.x, f.y - me.y);
      if (d < fd) { fd = d; foe = f; }
    }

    // hurt: drink a potion (useItem is the slot's key; it heals over time and
    // never stops the hands)
    const pot = me.items.indexOf('potion');
    if (me.hp < me.maxHp * 0.5 && pot >= 0 && me.potionT <= 0) act.useItem = pot;

    const melee = me.attack === 'cut';
    if (foe && fd < (melee ? 160 : 220)) {
      // lead a moving target a little: where it will be in a fifth of a second
      const tx = foe.x + (foe.vx || 0) * 0.2, ty = foe.y + (foe.vy || 0) * 0.2;
      act.aim = [tx, ty];
      const kind = obs.enemies.includes(foe) ? 'player' : 'soldier';
      act.think = { goal: 'FIGHT', why: melee ? 'IN REACH' : 'IN RANGE', target: { kind, id: foe.id, x: foe.x, y: foe.y } };
      // the basic attack is a MARK: name it and your hero strikes it whenever
      // it is in range (me.range px to its edge), standing still for each
      // wind-up. A blade walks in; a bow keeps its distance between shots
      act.attack = foe.id;
      if (melee || fd > me.range) act.goTo = { x: foe.x, y: foe.y };
      else if (fd < me.range * 0.6) act.move = [(me.x - foe.x) / fd, (me.y - foe.y) / fd];
      return act;
    }

    // nothing to fight: go for the rival bird once it has landed
    const bird = obs.eagles.find((e) => e.team !== me.team && e.state === 'down');
    if (bird) {
      const d = Math.hypot(bird.x - me.x, bird.y - me.y);
      act.aim = [bird.x, bird.y];
      act.think = { goal: 'PUSH', why: 'BIRD IS DOWN', target: { kind: 'bird', id: bird.team, x: bird.x, y: bird.y } };
      if (melee || d > me.range + 20) act.goTo = { x: bird.x, y: bird.y, reach: 1 };
      if (melee) act.work = d < 40; // E on the bird: a swing chips its nerve
      else act.attack = 'eagle'; // a bow strikes it from range
      return act;
    }

    // still in the air, or no bird yet: head for the middle of the map
    act.goTo = { x: this.mid, y: this.mid };
    act.think = { goal: 'ROAM', why: 'NO BIRD YET' };
    return act;
  },
});
