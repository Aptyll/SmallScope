// PACK: waits for friends, then goes for the rival bird together, and fights
// as one. Shows the team channel: `say` reaches your teammates' next obs.team.
defineBot({
  name: 'PACK',
  author: 'Softfall',
  version: '1.0',

  init(hello) {
    this.team = hello.team;
    this.drawT = 0;
    this.focus = null;  // the rival the side agreed to shoot
    this.go = false;    // the pack has gathered and is moving
  },

  think(obs) {
    const me = obs.me;
    if (me.dead || me.aboard) { this.go = false; return { think: { goal: 'IDLE', why: 'DOWN' } }; }
    const act = {};
    if (me.skillPts > 0) act.ability = me.abilities.reduce((b, a) => (a.lv < b.lv ? a : b)).key;

    // what the side said: a focus target, or "go"
    for (const m of obs.team) {
      if (m.say && m.say.focus !== undefined) this.focus = m.say.focus;
      if (m.say && m.say.go) this.go = true;
    }

    // fight: the agreed target if it is in sight, else the nearest
    const dist = (o) => Math.hypot(o.x - me.x, o.y - me.y);
    let foe = obs.enemies.find((e) => e.id === this.focus) || null;
    if (!foe || dist(foe) > 260) {
      foe = null;
      for (const e of obs.enemies) if (dist(e) < 260 && (!foe || dist(e) < dist(foe))) foe = e;
      if (foe) act.say = { focus: foe.id }; // call it for the side
    }
    const melee = me.cls === 'WARRIOR';
    if (foe) {
      const d = dist(foe);
      act.aim = [foe.x + foe.vx * 0.2, foe.y + foe.vy * 0.2];
      act.think = { goal: 'FIGHT', why: foe.id === this.focus ? 'FOCUS' : 'NEAREST', plan: 'PACK', target: { kind: 'player', id: foe.id, x: foe.x, y: foe.y } };
      if (melee) { act.goTo = { x: foe.x, y: foe.y }; act.fire = d < 40 && (obs.tick / 6) % 2 < 1; }
      else {
        if (d < 100) act.move = [(me.x - foe.x) / d, (me.y - foe.y) / d];
        this.drawT++;
        act.fire = this.drawT < 8;
        if (!act.fire) this.drawT = 0;
      }
      if (me.hp < me.maxHp * 0.3) act.dodge = true;
      return act;
    }

    const own = obs.eagles.find((e) => e.team === me.team && e.state === 'down');
    const bird = obs.eagles.find((e) => e.team !== me.team && e.state === 'down');
    if (!own || !bird) {
      act.goTo = { x: me.x < 1856 ? me.x + 64 : me.x - 64, y: me.y };
      act.think = { goal: 'ROAM', why: 'NO BIRDS YET' };
      return act;
    }

    // gather at your own bird's road junction until three of the side stand there
    const rally = own.mouth || own;
    if (!this.go) {
      const here = obs.allies.filter((a) => !a.dead && Math.hypot(a.x - rally.x, a.y - rally.y) < 160).length
        + (Math.hypot(me.x - rally.x, me.y - rally.y) < 160 ? 1 : 0);
      if (here >= 3) { this.go = true; act.say = { go: true }; }
      else {
        act.goTo = { x: rally.x, y: rally.y };
        act.think = { goal: 'RALLY', why: here + ' OF 3 HERE', plan: 'PACK', target: { kind: 'point', x: rally.x, y: rally.y } };
        return act;
      }
    }

    // the push: to the rival bird, strike it (warrior) or shoot it (hunter)
    const d = Math.hypot(bird.x - me.x, bird.y - me.y);
    act.aim = [bird.x, bird.y];
    act.think = { goal: 'PUSH', why: 'PACK IS GO', plan: 'PACK', target: { kind: 'bird', id: bird.team, x: bird.x, y: bird.y } };
    if (melee || d > 100) act.goTo = { x: bird.x, y: bird.y, reach: 1 };
    if (melee) act.work = d < 40;
    else if (d < 140) { this.drawT++; act.fire = this.drawT % 8 !== 0; }
    if (me.hp < me.maxHp * 0.25) this.go = false; // too hurt: back to the rally
    return act;
  },
});
