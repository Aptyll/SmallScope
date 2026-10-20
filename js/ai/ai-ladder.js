'use strict';
// The bot brain's ladder (aiThink, called by updateAI in js/ai/ai.js), cut
// into its rungs. Each rung reads the think's shared read `k` (aiRead) and
// returns true when it took the think; the first that does ends it. The
// order IS the ladder, and the rng() calls inside the rungs draw on the
// sim's stream in exactly this order, so a rung moved changes the match.
// ------------------------------------------------------------ the ladder
function aiThink(p, dt) {
  const inp = p.input, ai = p.ai;
  inp.mx = 0; inp.my = 0; inp.work = false; inp.slide = false;
  if (p.dead || p.fallT > 0) { inp.fire = false; aiNote(p, 'IDLE', p.dead ? 'DOWN' : 'IN THE ICE', null); return; }
  const k = aiRead(p, dt), prof = k.prof;
  aiOrders(k);

  // 0. a free skill point and a fat purse are spent before the ladder
  if (aiSpend(p, inp, k.steerTo)) return;

  // 0b. the orca has it (js/sim/orca.js): off its ice by the nearest way before
  //     the line runs out, everything else after. A bot reads the line a
  //     beat late, as it reads a rival (the profile's react).
  const shore = orcaShore(p, prof.react);
  if (shore) { inp.fire = false; k.walkTo(shore.x, shore.y, 0); aiNote(p, 'FLEE', 'ORCA', shore); return; }

  // 1. the rival in sight read first; a potion is drunk over everything
  //    below, since it never stops the hands (js/sim/items.js)
  aiFoe(k);
  aiDrink(p);
  // 2. the burrow, decided before the ladder (rungs 3 and 5 read it)
  if (aiBurrow(k)) return;
  if (aiBackOffRung(k)) return; // 2b. a human's DANGER ping
  if (aiFight(k)) return;      // 3. a rival in sight
  if (aiCampFight(k)) return;  // 4. a camp it woke
  // 5. lying low with nothing in sight: hold still and let the snow finish.
  //    Everything below this rung walks somewhere, and a bot crawling to a
  //    bush at PRONE_SPEED is a bot that has stopped playing.
  if (p.prone) { inp.fire = false; aiNote(p, 'HIDE', 'LYING LOW', null); return; }
  if (aiHealRung(k)) return;   // 5'. hurt and alone: a ripe bush, a creek fish
  if (aiPingRung(k)) return;   // 5a. a human's ping
  if (aiDefendRung(k)) return; // 5b. its bird
  if (aiHomeRung(k)) return;   // 5b''. the guard's scouting walk
  if (aiGuardRung(k)) return;  // 5b'. on guard
  if (aiPushRung(k)) return;   // 5c. the rival bird
  if (aiEscortRung(k)) return; // 5d. the human
  if (aiHelpRung(k)) return;   // 5e. a call for help
  if (aiPumpRung(k)) return;   // 5e'. a gold pump to take or hold
  if (aiRoamJobs(k)) return;   // 5f. the bear party, the stalker, the scout
  if (aiRoadRung(k)) return;   // 5g. the road
  if (aiHuntRung(k)) return;   // 6. meat
  if (aiHarvestRung(k)) return; // 8. harvest
  aiRoam(k);                   // 9. nothing to do
}

// the think's read, shared by every rung: the profile, the side's plan and
// p's job in it, the walks, the clocks, and what it is minding
function aiRead(p, dt) {
  const inp = p.input, ai = p.ai;
  const prof = aiProfile(p);
  // the side's shared mind (js/ai/ai-team.js): the plan and p's job in it, what
  // p can see put on the side's board, and a hurt human heard as a call
  const T = aiPlan(p.team), role = aiRole(p);
  aiLook(p, prof);
  if (T.hcT !== state.tick) { T.hcT = state.tick; aiHumanCall(p.team); }

  // walk the route to (x, y) - reach 1 stops beside a tile it cannot stand
  // on, which is exactly WORK_REACH - and return the straight-line distance,
  // or -1 when there is no route (drop the goal, do not wait on it)
  const walkTo = (x, y, reach, budget) => {
    const n = navTo(p, x, y, PLAYER_R, reach || 0, dt, budget);
    if (!n.ok) return -1;
    inp.mx = n.dx; inp.my = n.dy;
    return n.d;
  };
  // every walk the ladder orders: by the zipline when the cable is worth it
  // (the ride, above), else the feet. Riding, it holds the stick along the
  // cable toward the exit nearest the goal and lets go there; on the ground,
  // a worthwhile ride is a walk to the mount and the hop under the cable.
  // Returns the straight-line distance to the goal either way, so a rung
  // reads progress, or walkTo's -1 for a goal with no way to it at all.
  const steerTo = (x, y, reach, budget) => {
    if (p.zip >= 0) {
      const z = zips[p.zip], d1 = zipNearest(z, x, y).d;
      ai.zipUsed = true;
      if (Math.abs(d1 - p.zipD) <= ZIP_AI_OFF) inp.jump = true; // the exit: let go (zipToggle, next step)
      else { const q = zipPoint(z, p.zipD), s = d1 > p.zipD ? 1 : -1; inp.mx = q.tx * s; inp.my = q.ty * s; }
      return Math.hypot(x - p.x, y - p.y);
    }
    const w = aiZipWorth(p, x, y);
    if (w) {
      const nr = zipNear(p);
      if (nr && nr.z === w.z) { inp.jump = true; return Math.hypot(x - p.x, y - p.y); } // under it: clip on
      const m = zipMount(w.z, w.d0); // the player's walk to the cable stands on the same point (js/sim/zipline.js)
      if (m && walkTo(m.x, m.y, 0, budget) >= 0) return Math.hypot(x - p.x, y - p.y);
    }
    return walkTo(x, y, reach, budget);
  };
  const aimAt = (x, y) => { inp.aimX = x; inp.aimY = y; };

  ai.thinkT -= dt;
  if (ai.hideCd > 0) ai.hideCd -= dt;
  if (ai.pushCd > 0) ai.pushCd -= dt;
  // the profile's clocks: the skill layer's (ai-skill.js), the ability roll
  skillTick(p, prof, dt);
  ai.abilT -= dt;
  if (ai.abilT <= 0) { ai.abilT = AI_ABIL_T; ai.abilOk = rng() < prof.abil; }
  ai.focusT -= dt; // ...and the focus roll: this plan, does it join the side's target?
  if (ai.focusT <= 0) { ai.focusT = AI_PLAN_T; ai.focusOk = rng() < aiKnob(prof, 'focus'); }
  // what it is minding, off the shared read of both birds: its own bird
  // under attack - answered from anywhere on the map by as many as the
  // threat calls for (aiDefendersWanted), a bot already at the roost holding
  // its station, and once the nerve is under AI_ALARM_HP by everyone, the
  // one exception a pusher whose side is WINNING the race (the rival bird
  // lower still), who presses on - the rival bird it is due to push, and
  // (an ally) the human it escorts
  const sit = aiSituation();
  const mine = sit[p.team], theirs = sit[1 - p.team];
  const own = mine ? mine.e : null;
  const alarm = !!(mine && mine.threat && mine.hp < AI_ALARM_HP);
  let pushE = ai.pushCd > 0 ? null : aiWantsPush(p, prof, theirs, mine);
  if (!pushE) ai.packGo = false; // a pack's commitment (the objective rung) ends with the push - and with a death (updateAI)
  let defend = null;
  if (mine && mine.threat) {
    if (pushE) defend = alarm && !(theirs.hp < mine.hp) ? own : null;
    else if (alarm || Math.hypot(own.x - p.x, own.y - p.y) < AI_ROOST_R) defend = own;
    else defend = mine.defenders < aiDefendersWanted(mine) ? own : null;
  }
  let guardE = aiOnGuard(p, prof);
  let ward = prof.support && !player.dead && !inAir(player) && player !== p ? player : null;
  return { p, dt, inp, ai, prof, T, role, walkTo, steerTo, aimAt, mine, theirs, own, alarm, pushE, defend, guardE, ward };
}

// the human's ping it has taken up, folded into what it minds, and a
// teammate's call it would answer
function aiOrders(k) {
  const { p, dt, ai, role, theirs, own, alarm } = k;
  let { pushE, defend, guardE, ward } = k;
  // what the ladder decided this tick, for the dashboard (botGuess): DEFEND
  // at its bird when it is answering a threat, ATTACK at the rival's when it
  // is pushing
  if (defend) ai.want = { type: 'defend', x: own.x, y: own.y };
  else if (pushE) ai.want = { type: 'attack', x: pushE.x, y: pushE.y };
  else ai.want = null;
  // THE PING: a human teammate's it took up (pingSteer, js/sim/pings.js),
  // walked for PING_FOLLOW at most and then held PING_STAY on the spot. While
  // it stands it is the bot's plan over its own: the defend, guard, push and
  // escort reads give way to it, the one exception the alarm (its bird under
  // half nerve), which no ping overrides. An ATTACK covering the rival bird
  // and a DEFEND covering its own are folded straight into pushE/defend, so
  // the push and defend rungs play them with everything they know (the lane,
  // the archer's station); every other ping is walked by the ping rung (5a).
  const pg = ai.ping;
  if (pg) { pg.t -= dt; if (pg.t <= 0) ai.ping = null; }
  const order = ai.ping;
  if (order) {
    pushE = order.k === 'attack' && theirs && ai.pushCd <= 0 && Math.hypot(theirs.e.x - order.x, theirs.e.y - order.y) < PING_R ? theirs.e : null;
    if (!alarm) defend = order.k === 'defend' && own && Math.hypot(own.x - order.x, own.y - order.y) < PING_R ? own : null;
    guardE = null;
    ward = null;
  }
  aiAnswerStep(p);
  // a teammate's call for help it would answer (the team brain): a bot with
  // somewhere it must be - the push, its bird, a ping, a guard's post - does
  // not leave it for one
  const call = !pushE && !defend && !order && !guardE && role !== 'pusher' ? aiHelpCall(p) : null;
  const caller = call ? players[call.id] : null;
  ai.helping = call ? call.id : -1;
  k.pushE = pushE; k.defend = defend; k.guardE = guardE; k.ward = ward; k.order = order; k.caller = caller;
}

// the rival it would fight, and whether it fights them yet (rung 1 reads
// it first)
function aiFoe(k) {
  const { p, dt, ai, prof, T, mine, theirs, own, pushE, defend, guardE, ward, order, caller } = k;
  // 1. the rival in sight. `foe` is read here rather than at rung 2 because
  //    the heal rung (5') asks it too: nobody walks to a bush under fire.
  // (a ping's spot is an anchor too: a rival on it is found on arrival)
  // (and a teammate it is answering is one: the fight it walks into is found)
  let foe = aiNearestEnemy(p, prof, [defend || guardE, pushE, ward, order, caller]);
  // focus fire: on the focus roll, the rival most of the side is already
  // shooting is the one it takes, when it can see them
  const fq = foe && ai.focusOk && T.focus >= 0 ? players[T.focus] : null;
  if (fq && fq !== foe && enemyOf(p, fq)) {
    const d = Math.hypot(fq.x - p.x, fq.y - p.y);
    if (d < prof.sight && d < seenAt(fq, prof.sight, p.team)) foe = fq;
  }
  // ...and a rival it was just fighting is held a little past the edge of
  // its sight (aiHoldFoe, the team brain), so a strafe across the line does
  // not flip the bot between the fight and whatever it was doing before
  foe = aiHoldFoe(p, prof, foe);
  // a grudge's mark in sight is the one it fights, whoever else is nearer
  const mark = aiGrudgeFoe(p, prof);
  if (mark) foe = mark;
  const foeD = foe ? Math.hypot(foe.x - p.x, foe.y - p.y) : Infinity;
  // the reaction: a rival stays noticed prof.react seconds before the bot
  // turns on it (a slow side keeps chopping while you line up the shot) -
  // slower for one outside the cone it is watching (skillNotice)
  const noticeRate = skillNotice(p, prof, foe);
  ai.seeT = foe ? ai.seeT + dt * noticeRate : Math.max(0, ai.seeT - dt * 2);
  // the siege: a pusher AT the rival roost keeps hitting the bird and leaves
  // the fight to its friends, however many defenders there are - they
  // respawn at their bird, so a push that turns to meet each one never
  // lands a swing (and no push ever outnumbers them for long) - unless a
  // rival is at arm's length (AI_SIEGE_R), which is a rival it cannot ignore
  const siege = pushE && theirs && Math.hypot(theirs.e.x - p.x, theirs.e.y - p.y) < AI_ROOST_R;
  // the CHARGE: a relentless side on its push fights only what is at arm's
  // length the whole way - a wave on the road, an archer standing off, a
  // defender at the roost are all walked past for the bird (the siege rule,
  // from the first step and whatever the numbers); what closes to
  // AI_SIEGE_R is fought where it stands, and nothing else slows the rush
  // (...away from home: a respawn at its own besieged bird fights what is
  // there with everything it sees before it rides out again)
  const charge = prof.relentless && !!pushE && !(mine && mine.threat && own && Math.hypot(own.x - p.x, own.y - p.y) < AI_ROOST_R);
  // (and a pusher leaves the rival WAVE to its own: soldiers it meets on the
  // road are fought only at arm's length - the waves fight each other in the
  // middle, and a push that stopped for every column never reached the bird)
  const waveFoe = foe && !(foe instanceof Player) && !!pushE && !(mine && mine.threat && own && Math.hypot(own.x - p.x, own.y - p.y) < AI_ROOST_R);
  const engage = foe && ai.seeT >= prof.react && !((siege || charge || waveFoe) && foeD > AI_SIEGE_R) ? foe : null;
  k.foe = foe; k.fq = fq; k.mark = mark; k.foeD = foeD; k.siege = siege; k.charge = charge; k.engage = engage;
}


// true while it is going to ground (it stands still for it)
function aiBurrow(k) {
  const { p, dt, inp, ai, prof, pushE, defend, ward, order, foe } = k;
  // 2. the burrow - a hunter's alone now, cast as SNOW COVER (key 4) with its
  //    own 60 s clock on the way under. Decided before the ladder because two
  //    rungs below read the answer: a bot that has come off worse and has
  //    nobody looking at it goes to ground and waits the fight out, and one
  //    that is already down shoots from where it lies - which earns it the
  //    same ambush multiplier a human gets, off the same ambushReady() check.
  //    It gets straight back up for a wolf, for a rival close enough to find
  //    it anyway, or when the spell runs out - rising is free, the cast key
  //    again. It only ever tries where a player could: on snow, on its own
  //    feet, with the cooldown in hand. `hideT` doubles as the give-up: a
  //    plant that will not take burns it four times as fast and ends in the
  //    lockout.
  // (its own bird under threat comes before the human's camp fight)
  // (and a bear party's bear, once the party has formed - the team brain)
  const bj = !foe && !defend && !pushE && !order ? aiBearJob(p, dt) : null;
  const wolf = foe ? null : aiNearestWolf(p, defend ? null : ward) || (bj && bj.fight) || null;
  k.bj = bj; k.wolf = wolf;
  if (p.prone) ai.hideT -= dt;
  const btx = Math.floor(p.x / TILE), bty = Math.floor((p.y + 4) / TILE);
  const canBury = p.cls === 0 && abReady(p, 3) && !p.sliding && p.dodgeT <= 0 &&
    inWorld(btx, bty) && ground[idx(btx, bty)] === 0;
  let down = p.prone;
  if (wolf) down = false;
  else if (foe) down = p.prone && Math.hypot(foe.x - p.x, foe.y - p.y) > 48;
  else if (p.prone) down = ai.hideT > 0 && p.hp < p.maxHp * 0.9;
  else if (p.hp < p.maxHp * aiFlee(p, prof) && ai.hideCd <= 0 && canBury) down = true; // (the mood moves the point)
  if (down !== p.prone) {
    inp.ability = 3;                                  // snow cover: the burrow's one door, in and out
    if (p.prone) ai.hideCd = 18;                      // back up: no re-burrowing for a while
    else if (ai.hideT <= 0) ai.hideT = rand(7, 12);   // going down: how long it means to stay
  }
  if (down && !p.prone) {
    // stop dead and let the momentum bleed off; tryProne refuses a body that
    // is still moving. Somewhere that never takes gives up and locks out.
    ai.hideT -= dt * 4;
    if (ai.hideT > 0) { inp.fire = false; aiNote(p, 'HIDE', 'LOW HP', null); return true; }
    ai.hideCd = 12;
  }
  return false;
}

function aiFight(k) {
  const { p, dt, inp, ai, prof, role, steerTo, aimAt, defend, caller, foe, fq, mark, foeD, siege, charge, engage } = k;
  // 3. a rival in sight (and reacted to): circle at bow range and shoot.
  //    The profile says how well: the aim point carries its scatter and its
  //    lead, abilities go on the ability roll, the draw is loosed at the
  //    profile's fraction, the dodge at its rate - and a slow side stands
  //    still for part of every strafe, which is when it gets hit.
  ai.foeId = engage && engage instanceof Player ? engage.id : -1;
  if (engage) {
    const foe = engage;
    const d = foeD;
    aiNote(p, 'FIGHT', foe === mark ? 'YOU AGAIN' : siege ? 'AT THEIR BIRD' : foe === fq ? 'FOCUS FIRE' : caller ? 'HELPING ' + caller.name.slice(0, 11) : 'IN SIGHT', foe);
    if (p.zip >= 0) inp.jump = true; // off the zipline first: nobody fights holding the handle
    const aim = skillAim(p, prof, foe, dt); // its read of them, led, with its wobble
    aimAt(aim.x, aim.y);
    // hold ~70px: close in when far, back off when crowded, strafe in between
    const clear = aiLineClear(p, foe.x, foe.y - 6);
    if (p.prone) {
      // no strafing on your belly: concealOf discounts a mound that is moving,
      // and ambushReady refuses a moving shot outright. Hold still, let them
      // walk in, and spend the arrow at full draw.
      inp.fire = clear && p.chargeT < drawTime(p) * 0.95;
      aiNote(p, 'HIDE', 'AMBUSH', foe);
      ai.tgt = null;
      return true;
    }
    // the numbers (the team brain): hurt or outnumbered, it calls the side;
    // losing by the judge's reading, it gives ground toward a friend and
    // keeps shooting over its shoulder - which pulls the chase into its side.
    // Nobody backs off its own bird, a siege or a charge.
    const odds = aiOdds(p, foe, prof);
    if (p.hp < p.maxHp * 0.6 || odds.them > odds.us) aiCall(p, foe);
    const atHome = defend && Math.hypot(defend.x - p.x, defend.y - p.y) < AI_ROOST_R;
    if (!atHome && !siege && !charge && (state.elapsed < ai.fleeT || aiFallBack(p, prof, foe, odds))) {
      if (state.elapsed >= ai.fleeT) ai.fleeT = state.elapsed + AI_FLEE_HOLD; // once it turns, it means it for a moment
      if (role === 'scout') ai.scoutCd = state.elapsed + 8; // (a scout chased off its beat works a while before it walks back into them)
      const to = aiFallBackTo(p, foe);
      aiNote(p, 'FLEE', odds.them > odds.us ? odds.them + 'V' + odds.us : 'LOW HP', to);
      if (steerTo(to.x, to.y, 3) < 0) { inp.mx = -Math.cos(Math.atan2(foe.y - p.y, foe.x - p.x)); inp.my = -Math.sin(Math.atan2(foe.y - p.y, foe.x - p.x)); }
      inp.fire = clear && !aiMelee(p) && p.chargeT < drawTime(p) * prof.draw;
      if (d < 60 && p.dodgeCharges > 0 && rng() < dt * 2 * prof.dodge) inp.dodge = true;
      ai.tgt = null;
      return true;
    }
    // the class abilities, spent off cooldown at the foe - through the same
    // edge key a human presses, so a bot can never cast what a hand couldn't
    if (ai.abilOk && p.castT <= 0 && p.grapT <= 0 && inp.ability < 0) {
      if (CLASS_AB[p.cls].some((ab) => ab.bot)) inp.ability = abBotKey(p, foe, d, clear); // a hero whose rows say when (ARM_AB's `bot`, js/sim/armatos.js)
      else if (p.cls === 0) { // hunter: skewer the open lane, tangle the gap
        // (the grapple is a held key and a terrain read - a hand skill the
        // ladder does not try to fake; snow cover is spent at rung 2)
        if (abReady(p, 0) && d > 55 && d < 230 && clear) inp.ability = 0; // lock the piercing draw on them
        else if (abReady(p, 1) && d < 110 && clear) inp.ability = 1;      // net the gap
      } else if (p.shieldT > 0 || p.rushT > 0) { // warrior, wall up or mid-charge: the SLAM, the moment they are under it
        if (abUnlocked(p, 0) && d < SLAM_R - 4) inp.ability = 0;
      } else { // warrior: get there, and finish what the arrival started
        if (abReady(p, 3) && d < EXEC_R - 4 && foe.hp < foe.maxHp * 0.55) inp.ability = 3; // the execute on a body already bleeding
        else if (abReady(p, 1) && d > 36 && d < 120 && clear) inp.ability = 1; // rush the line
        else if (abReady(p, 2) && d < 42) inp.ability = 2;           // stomp at arm's length
        else if (abReady(p, 0) && d < 150 && p.hp < p.maxHp * 0.75) inp.ability = 0; // shield the arrows
      }
    }
    const side = p.id % 2 ? 1 : -1;
    const a = Math.atan2(foe.y - p.y, foe.x - p.x);
    const melee = aiMelee(p);
    if (!clear) {
      // no line to them: never walk into the corner that is blocking it
      // (ten bodies doing exactly that at a lane's bend was a fight nobody
      // fired a shot in for a quarter of an hour). Far off, ROUTE in through
      // the open - along a lane's axis rather than into its tree wall;
      // close in, give ground straight back and let them come round the
      // corner into the line. Re-read every think, so a cleared line goes
      // straight back to the strafe below.
      // (a relentless side never gives ground: it routes in at any range)
      if (d > 60 || prof.relentless) { if (steerTo(foe.x, foe.y, 3) < 0) { inp.mx = 0; inp.my = 0; } }
      else { inp.mx = -Math.cos(a); inp.my = -Math.sin(a); }
      inp.fire = false;
      ai.tgt = null;
      return true;
    }
    // a blade holds at arm's length and circles there; a bow holds ~70px:
    // close in when far, back off when crowded, strafe in between
    // (a relentless bow never backs off when crowded: it circles in close)
    // (the range bands hold AI_BAND_HYS px past their edge: on an edge it
    // swapped close-in for circle every other tick, and the walk - and the
    // facing that follows it - flickered between the two)
    ai.band = aiRangeBand(ai.band, d, melee ? [AI_MELEE_D] : [50, 85]);
    const turn = melee ? (ai.band > 0 ? 0.15 * side : Math.PI / 2 * side * prof.strafe)
      : ai.band > 1 ? 0.3 * side : ai.band < 1 && !prof.relentless ? Math.PI * 0.85 * side : Math.PI / 2 * side * prof.strafe;
    inp.mx = Math.cos(a + turn); inp.my = Math.sin(a + turn);
    // a slow side plants its feet to shoot: the standing part of each 2 s is
    // the only part it draws and looses in (a draw cut off by the walk goes
    // as the weak tap it is), so stopping IS the tell
    const planted = prof.strafe >= 1 || (state.tick % 120) >= 120 * prof.strafe;
    if (planted && prof.strafe < 1) { inp.mx = 0; inp.my = 0; }
    // draw, then loose at the profile's draw - a blade only once they are under it
    // (on a soldier its own wave is wearing down, the draw is held for the last hit: aiFarmFire, js/ai/ai-farm.js)
    inp.fire = aiFarmFire(p, foe, planted && clear && (!melee || d < AI_MELEE_D + 8) && p.chargeT < drawTime(p) * skillDraw(p, prof));
    if (p.hp < p.maxHp * 0.45 && p.dodgeCharges > 0 && rng() < dt * 2 * prof.dodge) inp.dodge = true;
    skillSlip(p, prof, foe, dt); // the odd lapse, at the profile's rate
    ai.tgt = null;
    return true;
  }
  return false;
}

function aiCampFight(k) {
  const { p, dt, inp, ai, prof, steerTo, aimAt, bj, wolf } = k;
  // 4. a camp it has woken hunts back: a bot with a monster on it fights
  //    its way out, shooting the nearest one and giving ground while it does.
  //    An ally helping the human's camp fight (aiNearestWolf) has no monster
  //    coming to it, so it walks in to its own range first - a blade to arm's
  //    length, a bow to ~90 px with the line open
  if (wolf) {
    aiNote(p, bj && wolf === bj.fight ? 'HUNT' : 'WOLF', bj && wolf === bj.fight ? 'THE BEAR' : wolf.target === p ? 'ON ME' : 'HELPING', wolf);
    if (p.zip >= 0) inp.jump = true; // off the zipline first
    const d = Math.hypot(wolf.x - p.x, wolf.y - p.y);
    const clear = aiLineClear(p, wolf.x, wolf.y - 4);
    aimAt(wolf.x, wolf.y - 4);
    const away = Math.atan2(p.y - wolf.y, p.x - wolf.x);
    const melee = aiMelee(p);
    if (wolf.target !== p && (melee ? d > AI_MELEE_D : d > 90 || !clear)) { if (steerTo(wolf.x, wolf.y, 0) < 0) { inp.mx = 0; inp.my = 0; } }
    else if (d < 64 && !melee && !prof.relentless) { inp.mx = Math.cos(away); inp.my = Math.sin(away); } // a bow keeps its distance; a blade (or a relentless side) stands its ground
    inp.fire = clear && (!melee || d < AI_MELEE_D + 8) && p.chargeT < drawTime(p) * 0.7;
    if (d < 30 && p.dodgeCharges > 0 && rng() < dt * 3) inp.dodge = true;
    ai.tgt = null;
    return true;
  }
  return false;
}

function aiBackOffRung(k) {
  const { p, dt, inp, ai, steerTo, aimAt, own } = k;
  // 2b. a human's DANGER ping near it (pingSteer, js/sim/pings.js): for
  //     PING_BACK_T it walks out of the danger - home, the way it would run
  //     - and fights nothing on the way; outside PING_DANGER_R * 1.6 the
  //     ladder has it again
  const b = ai.backOff;
  if (!b) return false;
  b.t -= dt;
  if (b.t <= 0) { ai.backOff = null; return false; }
  const d = Math.hypot(p.x - b.x, p.y - b.y);
  if (d >= PING_DANGER_R * 1.6) return false;
  aiNote(p, 'FLEE', 'DANGER PING', b);
  inp.fire = false; ai.tgt = null;
  if (own && Math.hypot(own.x - b.x, own.y - b.y) > PING_DANGER_R && steerTo(own.x, own.y, 3, AI_ROOST_BUDGET) >= 0) { aimAt(b.x, b.y); return true; }
  const a = Math.atan2(p.y - b.y, p.x - b.x) || 0; // home is in it, or no way home: straight out
  if (steerTo(b.x + Math.cos(a) * PING_DANGER_R * 1.7, b.y + Math.sin(a) * PING_DANGER_R * 1.7, 3) < 0) { inp.mx = Math.cos(a); inp.my = Math.sin(a); }
  return true;
}

function aiPingRung(k) {
  const { p, inp, ai, steerTo, aimAt, pushE, defend, order } = k;
  // 5a. the ping it took up (aiOrders, above). An attack on the rival bird
  //     and a defend at its own were folded into pushE/defend and are played
  //     below; this walks the rest. Away from the spot: get there, and a
  //     spot it cannot route to is let go. On it, the walk's clock becomes
  //     the hold's (PING_STAY): ATTACK breaks what is theirs round the spot
  //     with E (rivals in sight are rung 3's - the spot anchors them) and
  //     holds the ground when nothing is left; the rest stand there.
  if (!order || defend || pushE) return false;
  aiNote(p, 'ORDER', PING_CALLS[order.k].word() + ' PING', order);
  const d = Math.hypot(order.x - p.x, order.y - p.y);
  if (!order.at && d > PING_IN) {
    if (steerTo(order.x, order.y, 2, AI_ROOST_BUDGET) >= 0) { aimAt(order.x, order.y); inp.fire = false; ai.tgt = null; return true; }
    ai.ping = null; // no way there
    return false;
  }
  if (!order.at) { order.at = true; order.t = Math.min(order.t, PING_STAY[order.k] || 5); }
  if (order.k === 'attack') {
    const st = enemyStructNear(p.team, order.x, order.y, PING_R);
    if (st) {
      const t = aiStructTile(st, p);
      const tx = t.tx * TILE + 8, ty = t.ty * TILE + 8;
      aimAt(tx, ty);
      const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
      if (Math.max(Math.abs(t.tx - ptx), Math.abs(t.ty - pty)) <= WORK_REACH) { inp.work = true; inp.fire = false; ai.tgt = null; return true; }
      if (steerTo(tx, ty, WORK_REACH, AI_ROOST_BUDGET) >= 0) { inp.fire = false; ai.tgt = null; return true; }
    }
  }
  // hold the spot: back onto it if pushed off, else stand
  if (d > PING_IN * 2 && steerTo(order.x, order.y, 2) >= 0) { inp.fire = false; ai.tgt = null; return true; }
  inp.fire = false; ai.tgt = null;
  return true;
}

function aiDefendRung(k) {
  const { p, inp, ai, steerTo, aimAt, alarm, defend } = k;
  // 5b. its bird is under attack: get to it. Rung 3 takes over on arrival -
  //     the bird is an anchor, so the archer standing off it is in sight.
  if (defend) {
    aiNote(p, 'DEFEND', alarm ? 'BIRD HURT' : 'BIRD HIT', defend);
    const d = Math.hypot(defend.x - p.x, defend.y - p.y);
    if (d > 80) { // home through its own lane, like a push
      if (aiToRoost(p, defend, steerTo, 3) >= 0) { aimAt(defend.x, defend.y); inp.fire = false; ai.tgt = null; return true; }
    } else { // on station: sweep round the bird looking out, never stand and wait
      const a = state.elapsed * 1.3 + p.id;
      steerTo(defend.x + Math.cos(a) * 70, defend.y + Math.sin(a) * 70, 1);
      aimAt(defend.x + Math.cos(a) * 140, defend.y + Math.sin(a) * 140);
      inp.fire = false; ai.tgt = null; return true;
    }
  }
  return false;
}

function aiHomeRung(k) {
  const { p, inp, ai, steerTo, aimAt, guardE } = k;
  // 5b''. a guard is a proactive defender, never a sentry: for AI_PATROL_OUT
  //       of every AI_PATROL_T it walks out past the base's junction and up
  //       the road to see who is coming (what it sees is the side's, aiLook -
  //       the brace reads it); the rest of the time it works what is near
  //       the bird (the rungs below).
  if (guardE && (state.elapsed + p.id * 9) % AI_PATROL_T < AI_PATROL_OUT && guardE.mouth) {
    const u = roadNest(guardE.team).u + (guardE.team === 0 ? 1 : -1) * AI_PATROL_D / (TILE * Math.SQRT2);
    const pt = roadPoint(u);
    aiNote(p, 'GUARD', 'SCOUTING', pt);
    if (steerTo(pt.x, pt.y, 3, AI_ROOST_BUDGET) >= 0) { aimAt(pt.x, pt.y); inp.fire = false; ai.tgt = null; return true; }
  }
  return false;
}

function aiGuardRung(k) {
  const { p, inp, ai, steerTo, aimAt, guardE } = k;
  // 5b'. on guard: stand by its own bird, and go on down the ladder (working
  //      what is near) while it is within AI_GUARD_R of it. The bird is its
  //      anchor, so a rival standing off the roost is rung 3's the moment
  //      they show.
  if (guardE && Math.hypot(guardE.x - p.x, guardE.y - p.y) > AI_GUARD_R) {
    aiNote(p, 'GUARD', 'BACK TO POST', guardE);
    if (aiToRoost(p, guardE, steerTo, 4) >= 0) { aimAt(guardE.x, guardE.y); inp.fire = false; ai.tgt = null; return true; }
  }
  return false;
}

function aiPushRung(k) {
  const { p, dt, inp, ai, prof, T, steerTo, aimAt, theirs, pushE } = k;
  // 5c. the objective: drive off the rival bird. A hunter holds AI_HOLD off
  //     it - outside the gust - and looses at the roost; a warrior walks up
  //     to a roost tile and swings E on it, gust and all, exactly as a hand
  //     does. Defenders in sight are rung 3's business (the bird anchors
  //     them). A roost it cannot route to is left for a while (pushCd).
  if (pushE) {
    const e = pushE;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    aiNote(p, 'PUSH', T.stance === 'WINDOW' ? 'THEY ARE DOWN' : theirs && theirs.hp < AI_JOIN_HP ? 'BIRD IS WEAK' : 'OUR TURN', e);
    // the roost sits in the corner's forest at the end of its lane, and the
    // lane is the only way in: off it, the walk is aiToRoost's (gate, mouth,
    // lane); on it, the class decides the approach
    // a rival ROAD TOWER its own wave stands under (aiLaneFort, ai.js): the
    // wave takes the bolts, so the push stops to bring the tower down with it
    const tur = aiLaneFort(p, e);
    // the wave is the push: off the rival's lane, a pusher walks with the
    // head of its side's column rather than ahead of it alone
    // (a relentless side's grouping is the pack below, not the column's pace;
    // and a WINDOW is a rush: the rivals are down now, not when a column or
    // the side's stragglers get there)
    const rush = T.stance === 'WINDOW';
    const head = aiInLane(p, e) || prof.relentless || rush ? null : aiWaveHead(p, e);
    if (head && Math.hypot(head.x - p.x, head.y - p.y) > AI_WAVE_R) {
      aiNote(p, 'PUSH', 'WITH THE WAVE', head);
      if (steerTo(head.x, head.y, 2) >= 0) { aimAt(e.x, e.y); inp.fire = false; ai.tgt = null; return true; }
    }
    // a relentless side hits as a PACK, never a trickle: off the rival's
    // lane, its pushers rally at their own cable's end - the last fast
    // ground before the fight - until AI_PACK of the side's living bots are
    // together there (or as many as are living), then go on as one. A
    // respawn rides straight back to the rally, so a wave of them lands on
    // the roost every time rather than one body at a time into the guns.
    // Once the pack is together each of them is COMMITTED (ai.packGo): it
    // goes on however the others fare, until it dies or is called home -
    // a pack that re-counts itself every step falls back to the rally the
    // moment one body steps out of the ring.
    // Every other side REGROUPS the same way (the team brain): its pushers
    // (the plan's, js/ai/ai-team.js) meet at the rally until AI_REGROUP of them
    // are there, and go on together - or alone once one has waited
    // AI_REGROUP_T, so a push is never held hostage by a bot that went home.
    // A column on the road is grouping enough: walking with the wave skips it.
    if ((prof.relentless || !head) && !rush && !aiInLane(p, e) && !ai.packGo) {
      const z = zips[p.team], end = z ? z.pts[z.pts.length - 1] : null;
      if (end) {
        let alive = 0, here = 0;
        for (const q of players) {
          if (!q.active || q.dead || inAir(q) || q.team !== p.team || q.control !== 'ai') continue;
          if (!prof.relentless && q !== p && aiRole(q) !== 'pusher') continue;
          alive++;
          if (Math.hypot(q.x - end.x, q.y - end.y) < AI_PACK_R) here++;
        }
        const dEnd = Math.hypot(end.x - p.x, end.y - p.y);
        const need = Math.min(prof.relentless ? AI_PACK : AI_REGROUP, alive);
        if (dEnd <= AI_PACK_R) ai.packT += dt; else ai.packT = 0;
        if (here >= need || (!prof.relentless && ai.packT > AI_REGROUP_T)) ai.packGo = true;
        else {
          aiNote(p, 'REGROUP', 'PACK ' + here + '/' + need, end);
          if (dEnd > AI_PACK_R * 0.3) { if (steerTo(end.x, end.y, 2, AI_ROOST_BUDGET) >= 0) { aimAt(e.x, e.y); inp.fire = false; ai.tgt = null; return true; } }
          else { aimAt(e.x, e.y); inp.fire = false; ai.tgt = null; return true; } // at the rally: wait for the side
        }
      }
    }
    if (!aiInLane(p, e) && !tur) {
      if (aiToRoost(p, e, steerTo, 5) >= 0) { aimAt(e.x, e.y); inp.fire = false; ai.tgt = null; return true; }
      ai.pushCd = 10;
    } else if (tur) {
      const tx = tur.tx * TILE + 8, ty = tur.ty * TILE + 8; // the building's tile nearest the bot (a tower's is one of six)
      aimAt(tx, ty);
      const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
      if (Math.max(Math.abs(tur.tx - ptx), Math.abs(tur.ty - pty)) <= WORK_REACH) { inp.work = true; inp.fire = false; ai.tgt = null; return true; }
      if (steerTo(tx, ty, WORK_REACH, AI_ROOST_BUDGET) >= 0) { inp.fire = false; ai.tgt = null; return true; }
      ai.pushCd = 10;
    } else if (aiMelee(p)) { // a blade works the roost's tiles; a bow keeps its station
      const t = aiEagleTile(e, p);
      if (t) {
        const tx = t.tx * TILE + 8, ty = t.ty * TILE + 8;
        aimAt(tx, ty);
        const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
        if (Math.max(Math.abs(t.tx - ptx), Math.abs(t.ty - pty)) <= WORK_REACH) { inp.work = true; ai.tgt = null; return true; }
        if (steerTo(tx, ty, WORK_REACH, AI_ROOST_BUDGET) >= 0) { ai.tgt = null; return true; }
      }
      ai.pushCd = 10;
    } else {
      // the archer's station: AI_HOLD out from the bird ON THE LANE'S AXIS,
      // where the road keeps the line to the roost open (off the axis a
      // wall the defenders raised may eat the shot), outside the gust
      const sx = e.x + e.laneDir.x * AI_HOLD, sy = e.y + e.laneDir.y * AI_HOLD;
      const ux = (e.x - p.x) / (d || 1), uy = (e.y - p.y) / (d || 1);
      aimAt(e.x, e.y - 8);
      // the roost tiles are solid, so the line is read to just short of them
      const clear = aiLineClear(p, e.x - ux * 40, e.y - uy * 40);
      const ds = Math.hypot(sx - p.x, sy - p.y);
      if (ds > 14) {
        if (steerTo(sx, sy, 0, AI_ROOST_BUDGET) < 0) { ai.pushCd = 10; }
        else { inp.fire = d < 170 && clear && p.chargeT < drawTime(p) * skillDraw(p, prof); ai.tgt = null; return true; }
      } else {
        if (d < GUST_BLAST_R + 16) { inp.mx = -ux; inp.my = -uy; } // out of the gust's reach
        inp.fire = clear && p.chargeT < drawTime(p) * skillDraw(p, prof);
        ai.tgt = null;
        return true;
      }
    }
  }
  return false;
}

function aiEscortRung(k) {
  const { p, inp, ai, role, steerTo, aimAt, ward } = k;
  // 5d. an ally's escort: with the human on the ground and within reach, it
  //     keeps AI_ESCORT of them - the two lowest allied players, so the rest
  //     of the side still farms and builds. Inside that it goes on down the
  //     ladder, working what is near, and comes back when they walk off.
  // (an escort is a gatherer's job: a scout, stalker or slayer of the team
  // brain has its own walk, and a bot with two flipped between them)
  const escort = ward && aiEscorts(p) && role === 'gatherer' && Math.hypot(ward.x - p.x, ward.y - p.y) < AI_ESCORT_R;
  k.escort = escort;
  if (escort) {
    const d = Math.hypot(ward.x - p.x, ward.y - p.y);
    if (d > AI_ESCORT && d < AI_ESCORT_R) {
      aiNote(p, 'ESCORT', 'STAY CLOSE', ward);
      if (steerTo(ward.x, ward.y, 4) >= 0) { aimAt(ward.x, ward.y); inp.fire = false; ai.tgt = null; return true; }
    }
  }
  return false;
}

function aiHelpRung(k) {
  const { p, inp, ai, steerTo, aimAt, caller } = k;
  // 5e. a teammate's call for help (the team brain): go to them. The caller
  //     is an anchor, so the rival they are fighting is rung 3's on arrival.
  if (caller) {
    aiNote(p, 'HELP', caller.name.slice(0, 13) + ' CALLED', caller);
    // (by the caller with the call still open: stay by them - stepping off to
    // the next job flipped it between the two every few ticks)
    if (Math.hypot(caller.x - p.x, caller.y - p.y) <= 48) { aimAt(caller.x, caller.y); inp.fire = false; ai.tgt = null; return true; }
    if (steerTo(caller.x, caller.y, 3) >= 0) { aimAt(caller.x, caller.y); inp.fire = false; ai.tgt = null; return true; }
  }
  return false;
}

// 5e'. THE GOLD PUMPS (js/sim/pumps.js): a pump its side does not hold, or
//      holds with a rival hero in the ring, is walked to and stood in until
//      it is the side's. Its lane's laner goes from anywhere; anyone else
//      free (not pushing, defending, on guard, escorting or under a ping)
//      only from within AI_PUMP_NEAR, and no more than AI_PUMP_N of a side
//      at one pump. A rival in the ring is rung 3's the moment it is seen,
//      so taking a held pump is a fight at it. No rng(): the stream is as it was.
const AI_PUMP_NEAR = 30 * TILE; // px from a pump a bot that is not its lane's laner will go for it
const AI_PUMP_N = 2;            // bots of a side going for one pump at once
const AI_PUMP_IN = 0.6;         // share of the ring's radius out from the pump a bot stands
function aiPumpRung(k) {
  const { p, inp, ai, role, steerTo, aimAt, pushE, defend, guardE, escort, order } = k;
  ai.pump = -1; // the pump it is going for, by its tile, for its side's count
  if (pushE || defend || guardE || escort || order || role === 'pusher') return false;
  const lane = role === 'laner' ? aiLane(p) : -1;
  let best = null, bd = Infinity;
  for (const o of structures) {
    if (o.type !== 'generator') continue;
    const n = pumpCount(o);
    if (o.hold === p.team && !n[1 - p.team]) continue; // its side's, and nobody taking it
    const c = structCenter(o), d = Math.hypot(c.x - p.x, c.y - p.y);
    if (o.lane !== lane && d > AI_PUMP_NEAR) continue;
    const key = idx(o.tx, o.ty);
    let going = 0;
    for (const q of players) if (q !== p && q.team === p.team && q.ai && q.ai.pump === key && !q.dead) going++;
    if (going >= AI_PUMP_N || d >= bd) continue;
    bd = d; best = o;
  }
  if (!best) return false;
  ai.pump = idx(best.tx, best.ty);
  const c = structCenter(best), R = pumpRingPx();
  aiNote(p, 'PUMP', best.hold === p.team ? 'HOLD IT' : 'TAKE IT', c);
  inp.fire = false; ai.tgt = null;
  if (bd <= R * 0.85) { aimAt(p.x * 2 - c.x, p.y * 2 - c.y); return true; } // in: stand and look out
  const ux = (p.x - c.x) / (bd || 1), uy = (p.y - c.y) / (bd || 1);
  const sx = c.x + ux * R * AI_PUMP_IN, sy = c.y + uy * R * AI_PUMP_IN;
  if (steerTo(sx, sy, 1) < 0) { ai.pump = -1; return false; }
  aimAt(sx, sy);
  return true;
}

function aiRoamJobs(k) {
  const { p, inp, ai, prof, role, steerTo, aimAt, pushE, defend, guardE, order, bj } = k;
  // 5f. the side's two roaming jobs (the plan, js/ai/ai-team.js), for a bot
  //     nothing above has claimed. The STALKER walks to where the side last
  //     saw a rival alone - on arrival they are rung 3's, and a spot found
  //     empty is struck off; with nobody alone it works like anybody else.
  //     The SCOUT walks its beat - the middle, the far road short of the
  //     rival lane - and everything it sees goes on the side's board.
  if (bj && bj.meet) { // the bear party forming, off the bear's reach
    aiNote(p, 'REGROUP', 'BEAR PARTY ' + bj.here + '/' + AI_BEAR_N, bj.meet);
    if (steerTo(bj.meet.x, bj.meet.y, 2) >= 0) { aimAt(bj.meet.x, bj.meet.y); inp.fire = false; ai.tgt = null; return true; }
  }
  if (!order && !pushE && !defend && !guardE) {
    if (role === 'stalker') {
      const s = aiStalkTarget(p, prof);
      if (s) {
        const q = players[s.id];
        aiNote(p, 'STALK', aiGrudge(p) ? 'GRUDGE' : (q ? q.name.slice(0, 12) : 'RIVAL') + ' ALONE', s);
        const d = steerTo(s.x, s.y, 2);
        if (d >= 0 && d > 28) { aimAt(s.x, s.y); inp.fire = false; ai.tgt = null; return true; }
        s.t = -1e9; // there and nobody: the side forgets the spot
      }
    } else if (role === 'scout' && state.elapsed >= ai.scoutCd) {
      if (!ai.scout) ai.scout = aiScoutPoint(p);
      aiNote(p, 'SCOUT', 'WATCHING', ai.scout);
      const d = steerTo(ai.scout.x, ai.scout.y);
      if (d >= 0 && d > 24) { aimAt(p.x + inp.mx * 40, p.y + inp.my * 40); inp.fire = false; ai.tgt = null; return true; }
      ai.scoutN = (ai.scoutN || 0) + 1; ai.scout = null; // there, or no way there: the next point on the beat
      if (d < 0) ai.scoutCd = state.elapsed + 3;          // (no way there: work a while before trying the next)
    } else if (aiFarmWalk(p, role, steerTo, aimAt)) return true; // a laner's wave, a jungler's den (js/ai/ai-farm.js)
  }
  return false;
}

function aiRoadRung(k) {
  const { p, dt, inp, ai, steerTo, aimAt, guardE, escort } = k;
  // 5g. the road (aiRoad): a road stretch walks to the nearest rival wave,
  //     where the XP falls - free of an escort and a post
  const road = !escort && !guardE ? aiRoad(p, dt) : null;
  if (road) { aiNote(p, 'ROAD', 'THE WAVE', road); if (steerTo(road.x, road.y, 2) >= 0) { aimAt(road.x, road.y); inp.fire = false; ai.tgt = null; return true; } }
  return false;
}

function aiHuntRung(k) {
  const { p, dt, inp, ai, steerTo, aimAt, ward, escort } = k;
  // 6. meat is gold: chase and shoot the nearest animal, but give up on one
  //    it cannot catch in 6 s (prey outruns a walk) or cannot route to at all
  if (ai.huntAvoidT > 0) { ai.huntAvoidT -= dt; if (ai.huntAvoidT <= 0) ai.huntAvoid = null; }
  let prey = aiNearestAnimal(p);
  if (prey && escort && Math.hypot(prey.x - ward.x, prey.y - ward.y) > AI_ESCORT) prey = null; // (the escort's leash bounds the hunt as it does the work)
  if (prey) {
    aiNote(p, 'HUNT', 'MEAT IS GOLD', prey);
    if (prey !== ai.huntTgt) { ai.huntTgt = prey; ai.huntT = 0; }
    ai.huntT += dt;
    const clear = aiLineClear(p, prey.x, prey.y - 3);
    const d = Math.hypot(prey.x - p.x, prey.y - p.y);
    // (a blade walks into reach before it swings, and gets a little longer
    // to catch its prey for it; a bow stands off at 55 px)
    const blade = aiMelee(p);
    const lost = ai.huntT > (blade ? 8 : 6) || ((blade ? d > AI_MELEE_D : d > 55 || !clear) && steerTo(prey.x, prey.y) < 0);
    if (lost) {
      ai.huntAvoid = prey; ai.huntAvoidT = 15;
      ai.huntTgt = null; ai.huntT = 0;
    } else {
      aimAt(prey.x, prey.y - 3);
      inp.fire = clear && (!blade || d < AI_MELEE_D + 8) && p.chargeT < drawTime(p) * 0.8;
      ai.tgt = null;
      return true;
    }
  }
  inp.fire = false;
  return false;
}

function aiHarvestRung(k) {
  const { p, dt, inp, ai, prof, steerTo, aimAt, guardE, ward, escort } = k;
  // 8. harvest: walk to a tree and hold E on it
  if (ai.tgt && objects[idx(ai.tgt.tx, ai.tgt.ty)] !== ai.tgt) { ai.tgt = null; ai.thinkT = 0; } // (finished: look for the next at once)
  ai.avoidT -= dt;
  if (ai.avoidT <= 0) ai.avoid = null;
  if (ai.tgt && escort && Math.hypot(ai.tgt.tx * TILE + 8 - ward.x, ai.tgt.ty * TILE + 8 - ward.y) > AI_ESCORT * 0.9) ai.tgt = null; // (the human walked on: the work goes with them)
  if (!ai.tgt && ai.thinkT <= 0) {
    ai.thinkT = 0.6;
    ai.tgt = nearestObj(p.x, p.y, Math.round(AI_FORAGE * aiMood(p).greed), (o) => o !== ai.avoid &&
      o.type === 'tree' &&
      aiOpenSides(o.tx, o.ty) >= 1 &&
      (!escort || Math.hypot(o.tx * TILE + 8 - ward.x, o.ty * TILE + 8 - ward.y) < AI_ESCORT * 0.7) && // (an escort works inside its leash)
      (!guardE || Math.hypot(o.tx * TILE + 8 - guardE.x, o.ty * TILE + 8 - guardE.y) < AI_GUARD_R * 0.85)); // (a guard works inside its leash)
  }
  if (ai.tgt) {
    const t = ai.tgt;
    aiNote(p, 'GATHER', t.type.toUpperCase(), t);
    aimAt(t.tx * TILE + 8, t.ty * TILE + 8);
    const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
    if (Math.max(Math.abs(t.tx - ptx), Math.abs(t.ty - pty)) <= WORK_REACH) {
      // the E key at the profile's duty cycle - a slow side rests between
      // swings, which is what sets how fast it earns
      inp.work = prof.work >= 1 || (state.tick % 120) < 120 * prof.work;
      return true;
    }
    // route to any tile within WORK_REACH of it, whichever side is open;
    // one with no route (walled in, or pinned on the way) is left alone a while
    if (steerTo(t.tx * TILE + 8, t.ty * TILE + 8, WORK_REACH) < 0) {
      ai.avoid = t; ai.avoidT = 12;
      ai.tgt = null;
    }
    return true;
  }
  return false;
}

function aiRoam(k) {
  const { p, dt, inp, ai, steerTo, aimAt, guardE, ward, escort } = k;
  // 9. nothing to do: roam between its camp and the middle of the map
  // a guard or an escort with nothing to do walks its rounds inside its leash
  // (roaming off the edge of the leash had it flipping between its rung and
  // this every few ticks)
  const leash = guardE ? { e: guardE, r: AI_GUARD_R * 0.5 } : escort ? { e: ward, r: AI_ESCORT * 0.5 } : null;
  if (leash) aiNote(p, guardE ? 'GUARD' : 'ESCORT', guardE ? 'ON ROUNDS' : 'BY THEIR SIDE', leash.e);
  else aiNote(p, 'ROAM', 'NOTHING NEAR', { x: ai.wx, y: ai.wy });
  ai.roam -= dt;
  if (leash && Math.hypot(ai.wx - leash.e.x, ai.wy - leash.e.y) > leash.r * 1.5) ai.roam = 0; // the leash moved (the human walked on)
  if (ai.roam <= 0) { ai.roam = rand(3, 7); aiRoamPick(p, leash); }
  const rd = steerTo(ai.wx, ai.wy);
  if (rd < 20) ai.roam = 0; // arrived, or no route (a point in the treeline): pick another
  aimAt(p.x + inp.mx * 24, p.y + inp.my * 24);
}
