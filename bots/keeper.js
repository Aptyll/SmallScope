// KEEPER: stays home. Chops the woods by its own bird for gold, spends it on
// gear, and turns on anything that comes for the bird. Shows work (E), an
// order (`cmd`) and reading your own bird's `hitT`.
defineBot({
  name: 'KEEPER',
  author: 'Softfall',
  version: '1.0',

  init(hello) { this.drawT = 0; this.gear = 0; this.bad = new Set(); this.tree = null; },

  think(obs) {
    const me = obs.me;
    if (me.dead || me.aboard) return { think: { goal: 'IDLE', why: 'DOWN' } };
    const act = {};
    if (me.skillPts > 0) act.ability = me.abilities.reduce((b, a) => (a.lv < b.lv ? a : b)).key;
    else if (me.gold > 120) { act.cmd = { kind: 'gear', piece: this.gear }; this.gear = (this.gear + 1) % 4; }

    const own = obs.eagles.find((e) => e.team === me.team && e.state === 'down');
    const home = own || { x: me.x, y: me.y };
    const dist = (o) => Math.hypot(o.x - me.x, o.y - me.y);
    // anyone within 300 of home is the enemy of the day
    let foe = null;
    for (const e of obs.enemies.concat(obs.soldiers.filter((s) => s.team !== me.team))) {
      if (Math.hypot(e.x - home.x, e.y - home.y) < 300 && (!foe || dist(e) < dist(foe))) foe = e;
    }
    if (foe) {
      const d = dist(foe);
      act.aim = [foe.x, foe.y];
      act.think = { goal: 'DEFEND', why: own && own.hitT < 8 ? 'BIRD HIT' : 'AT THE ROOST', target: { kind: foe.cls ? 'player' : 'soldier', id: foe.id, x: foe.x, y: foe.y } };
      if (me.cls === 'WARRIOR') { act.goTo = { x: foe.x, y: foe.y }; act.fire = d < 40 && (obs.tick / 6) % 2 < 1; }
      else { this.drawT++; act.fire = this.drawT < 8; if (!act.fire) this.drawT = 0; }
      return act;
    }
    this.drawT = 0;

    // hurt: eat
    if (me.hp < me.maxHp * 0.6 && me.food.berry > 0) { act.eatBerry = true; act.think = { goal: 'EAT', why: 'LOW HP' }; return act; }

    // work the nearest tree within 250 of home; a tree it found no way to is
    // skipped from then on (me.nav says 'fail' when the last goTo had no route)
    if (me.nav === 'fail' && this.tree) this.bad.add(this.tree.key);
    let tree = null, td = Infinity;
    for (const n of obs.nodes) {
      if (n.kind !== 'tree' || this.bad.has(n.tx + ',' + n.ty)) continue;
      const x = n.tx * 16 + 8, y = n.ty * 16 + 8;
      if (Math.hypot(x - home.x, y - home.y) > 250) continue;
      const d = Math.hypot(x - me.x, y - me.y);
      if (d < td) { td = d; tree = { x, y, key: n.tx + ',' + n.ty }; }
    }
    this.tree = tree;
    if (tree) {
      act.goTo = { x: tree.x, y: tree.y, reach: 1 };
      act.aim = [tree.x, tree.y];
      act.work = td < 28;
      act.think = { goal: 'GATHER', why: 'WOOD FOR GOLD', target: { kind: 'point', x: tree.x, y: tree.y } };
      return act;
    }
    act.goTo = { x: home.x + 40, y: home.y + 40 };
    act.think = { goal: 'GUARD', why: 'NOTHING TO DO' };
    return act;
  },
});
