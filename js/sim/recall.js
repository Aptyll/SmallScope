// ------------------------------------------------------------ recall
// THE WAY HOME, and the ground that heals you there. League's loop: fight,
// go back, heal, shop, ride the zipline out.
//
// THE RECALL is a channel, the meal's kind (js/sim/core.js): RECALL_T seconds
// standing still, then the body is set down at its own roost on the tile a
// carried-back scout lands on (roostTile, js/sim/player.js). It arrives as a
// cmd ({ kind: 'recall' }: the H key, a bot, the bots' API) so it rides the one
// input path online. Anything the body DOES ends it - a step, the bow, an
// ability, E, the roll, the slide - and so does every way a meal is knocked
// out (breakEat calls breakRecall: a hit, a stun, the water, the cable). It is
// refused while the bird is not down, in the air, under the snow, riding,
// stunned or busy with something that already owns the hands. The tell is the
// whole point of a channel: a ring closing on the feet in your side's colour
// and the bar over the head filling (js/draw/recall.js, js/draw/bodies.js),
// so a rival sees you leaving and can stop it.
//
// THE ROOST RING is the packed-earth disc the bird blew clear when it landed
// (BOOM_R, js/sim/eagle.js), read off the bird where it sits, so it follows
// the roost wherever a map puts it. Inside your OWN side's ring and out of a
// fight, health comes back fast and the roll's charges refill fast; a rival
// standing in it gets nothing. "Out of a fight" is the one clock the items
// keep (p.fightT, ITEM_FIGHT_T, js/sim/items.js: set by every blow given or
// taken), so a defender trading hits at the bird does not out-heal the push.
const RECALL_T = 6;          // s of the channel
const RING_HP = 0.22;        // share of max health the ring gives back a second
const RING_STAM = 4;         // the roll's recharge runs this many times as fast
const RING_FX_T = 0.3;       // s between the green motes on a healing body

// the bird whose ring a body stands in, or null: its own side's, down and in reach
function roostRing(p) {
  const e = state.drop && state.drop.eagles[p.team];
  if (!e || e.state !== 'down') return null;
  return Math.hypot(p.x - e.x, p.y - e.y) <= BOOM_R * TILE ? e : null;
}

// why a channel cannot start now ('nobird', 'busy'), or null when it can - the
// cmd's refusal, and what a bot asks before it stands still for one
function recallBlocked(p) {
  if (p.dead || inAir(p)) return 'busy';
  if (!roostTile(p)) return 'nobird';
  if (p.stunT > 0 || p.fallT > 0 || p.dodgeT > 0 || p.castT > 0 || p.rushT > 0 || p.grapT > 0 ||
    p.zip >= 0 || p.zipWalk || p.mount || p.charging || p.prone) return 'busy';
  return null;
}
// the cmd: start the channel, or say why not (me.lastCmd for a bot)
function startRecall(p) {
  if (p.recallT > 0) return true;
  const no = recallBlocked(p);
  if (no) return no;
  p.recallT = RECALL_T;
  p.vx = p.vy = 0;
  sfxAt('wings', p.x, p.y);
  return true;
}

// the channel dropped: a puff in the side's colour where the ring was
function breakRecall(p) {
  if (!(p.recallT > 0)) return;
  p.recallT = 0;
  burst(p.x, p.y - 2, TEAMS[skin(p.team)].glow, 6, 30, 0.35, true);
}

// what the controller asked for that is an action of the body's own: any of
// it ends the channel before it is consumed (top of playerIntents, js/sim/sim.js)
function recallIntents(p) {
  if (!(p.recallT > 0)) return;
  const i = p.input;
  if (i.mx || i.my || i.fire || i.work || i.slide || i.dodge || i.jump || i.ability >= 0) breakRecall(p);
}

// the step: the channel's clock and the landing, then the ring's heal.
// Called from updatePlayer beside the meal's clock.
function updateRecall(p, dt) {
  if (p.recallT > 0) {
    p.recallT -= dt;
    if (p.recallT <= 0) {
      p.recallT = 0;
      const t = roostTile(p);
      if (t) {
        burst(p.x, p.y - 4, TEAMS[skin(p.team)].glow, 12, 50, 0.45, true);
        p.x = (t.tx + 0.5) * TILE; p.y = (t.ty + 0.5) * TILE;
        p.vx = p.vy = 0; p.kbx = p.kby = 0;
        navClear(p);
        burst(p.x, p.y - 2, '#f4f7ff', 16, 70, 0.5, true);
        sfxAt('warp', p.x, p.y);
      }
    }
  }
  if (p.fightT > 0 || !roostRing(p)) return;
  let fed = healPlayer(p, p.maxHp * RING_HP * dt) > 0;
  // the roll's clock runs the extra (RING_STAM - 1) here; playerStamina runs the 1 and refills
  if (p.dodgeCharges < DODGE_CHARGES) { p.dodgeRegenT -= dt * (RING_STAM - 1); fed = true; }
  if (!fed) return;
  p.ringFxT -= dt;
  if (p.ringFxT <= 0) {
    p.ringFxT = RING_FX_T;
    particles.push({ x: p.x + rand(-5, 5), y: p.y - 4, vx: 0, vy: rand(-26, -16),
      life: rand(0.5, 0.8), maxLife: 0.6, color: '#8fe08a', size: 1, grav: 0, alpha: 1 - concealOf(p) });
  }
}
