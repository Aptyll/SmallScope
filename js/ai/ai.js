'use strict';
// The bot brain: a priority ladder re-picked a few times a second, writing
// the same input struct a human fills - it can never do what a player cannot.
// ------------------------------------------------------------ ai
// Bots. A bot only ever writes the same input struct a human fills in -
// movement axis, aim point, fire / work / slide / dodge and the odd one-shot
// order - so it can never do anything a player couldn't. The brain is a small
// priority ladder, re-picked a few times a second: eat, fight, wolves, defend
// the bird, push the rival bird, escort, hunt, loot, spend, harvest, roam -
// and a PROFILE (the difficulty banner below) says how well each rung is
// played. Every walk goes through steerTo(), which routes
// around obstacles (see pathfinding) and reports an unreachable goal as -1 -
// that, not a timer, is what makes a bot drop a target.
const AI_SIGHT = 200;   // px: how far a wolf on a bot is still tracked (a rival's reach is the profile's sight)
const AI_EAT_R = 110;   // px: a rival closer than this will knock the meal out of its hands, so it waits
const AI_HUNT = 120;    // px: how far it will go after an animal
const AI_FORAGE = 12;   // tiles: how far from itself it looks for work
const AI_GUARD_R = 160;   // px a guard lets itself drift from its bird before walking back
const AI_ESCALATE = 120;  // s after push.t per extra pusher a side commits
// how many of a side push right now: push.n, growing past push.t
function aiPushers(prof) { return state.elapsed < prof.push.t ? 0 : prof.push.n + Math.floor((state.elapsed - prof.push.t) / AI_ESCALATE); }
const AI_ABIL_T = 0.5;    // s between ability rolls
const AI_ANCHOR_R = 260;  // px round an anchor (its bird, the human) a rival is noticed from
const AI_ANCHOR_D = 420;  // ...but never from farther than this
const AI_HOLD = 96;       // px a hunter holds off the rival bird at (outside its gust)
const AI_GATE = 128;      // px up the road from a base's junction where a walk to a roost stages
const AI_PATROL_T = 40;   // s of a guard's cycle...
const AI_PATROL_OUT = 14; // ...the first of which it spends scouting out up the road
const AI_PATROL_D = 360;  // px up the road from the base's junction the scouting walk reaches
const AI_ROOST_BUDGET = NAV_BUDGET * 4; // A* expansions a walk into a roost's forest may spend
const AI_ESCORT = 120;    // px an escort lets the human get away before it follows
const AI_ESCORT_R = 400;  // px past which the human is too far to escort
// the two objectives as a bot sees them: a roosting bird, or null
function aiRivalEagle(p) { const e = state.drop && state.drop.eagles[1 - p.team]; return e && e.state === 'down' ? e : null; }
function aiOwnEagle(p) { const e = state.drop && state.drop.eagles[p.team]; return e && e.state === 'down' ? e : null; }
// ---- the two birds --------------------------------------------------------
// What every bot knows about the objective - both birds, all match: where
// each roosts, how its nerve stands, when it was last hit, and who is AT it:
// the rivals standing off it (each through seenAt, so a buried archer is
// buried for the whole side) and the friends already there. Read once per
// sim step and shared by all ten players, so a hit on a roost is news on the
// far side of the map the same tick - a bird under attack is answered from
// anywhere, and a bird that is winning the race is not abandoned for one
// that is losing it. `threat` is the one word the ladder asks.
const AI_ROOST_R = 240;   // px round a bird inside which a body counts as at it
const AI_DEFEND_T = 8;    // s after a hit on its bird a side still counts it as under attack
const AI_JOIN_HP = 0.6;   // a rival bird under this much nerve, with friends on it, is a siege to join
const AI_ALARM_HP = 0.5;  // its own bird under this much nerve: EVERYONE comes home, pushers included
const AI_SIEGE_R = 48;    // px: a rival closer than this pulls a besieging pusher off the bird
// how many of a side a threat on its bird calls home: one more than the
// attackers seen there, and never fewer than two (a hit with nobody in sight
// is an archer standing off it). The rest go on with the match - a side
// that empties the whole map for one arrow is a side that never pushes -
// until the nerve is under AI_ALARM_HP, when the number is everyone.
function aiDefendersWanted(s) { return s.hp < AI_ALARM_HP ? 99 : Math.max(2, s.attackers + 1); }
let aiSitTick = -1, aiSit = null;
function aiSituation() {
  if (aiSit && aiSitTick === state.tick) return aiSit;
  aiSitTick = state.tick;
  aiSit = [0, 1].map((team) => {
    const e = state.drop && state.drop.eagles[team];
    if (!e || e.state !== 'down') return null;
    const s = { e, team, hp: e.hp / e.maxHp, hitT: e.hitT, attackers: 0, defenders: 0, human: false, threat: false };
    for (const q of players) {
      if (!q.active || q.dead || inAir(q)) continue;
      const d = Math.hypot(q.x - e.x, q.y - e.y);
      if (d >= AI_ROOST_R) continue;
      if (q.team === team) s.defenders++;
      else if (d < seenAt(q, AI_ROOST_R, team)) { s.attackers++; if (q === player) s.human = true; }
    }
    // a rival WAVE at the roost is an attack too (the `soldiers` banner,
    // robots.js) - counted at half strength, so a five-column calls three
    // defenders home rather than the whole side
    let wave = 0;
    for (const b of robots) if (b.kind === 'soldier' && unitAlive(b) && b.team !== team && Math.hypot(b.x - e.x, b.y - e.y) < AI_ROOST_R) wave++;
    s.attackers += Math.ceil(wave / 2);
    s.threat = s.hitT < AI_DEFEND_T || s.attackers > 0;
    return s;
  });
  return aiSit;
}
// p's place among its side's living bots (the human is never counted):
// the profile's push.n first go for the rival bird, the guard next stand by
// their own, and the rest farm, build and (allies) escort. The order is the
// side's plan (aiPlanRank, js/ai/ai-team.js): the jobs go by mood, not by seat
function aiRank(p) { return aiPlanRank(p); }
// the objective rung's gate: the plan's pushers (T.nPush: push.n after
// push.t, everyone but the guards in a window, none in a brace) go for the
// rival bird; an ally also goes whenever the human is already on
// it, so a push you start is a push your side joins; and ANY bot joins a
// siege its side already has going once the rival bird is under AI_JOIN_HP
// - unless its own bird is under attack, which is where it is wanted
// (`theirs`/`mine` are the aiSituation reads for the two birds)
function aiWantsPush(p, prof, theirs, mine) {
  if (!theirs) return null;
  const e = theirs.e;
  if (prof.support && theirs.human && player !== p) return e;
  if (theirs.attackers > 0 && theirs.hp < AI_JOIN_HP && !(mine && mine.threat)) return e;
  return aiRank(p) < aiPlan(p.team).nPush ? e : null;
}
// the guard's gate: from 0.6 push.t on, the plan's guards (T.nGuard: the
// prof.guard bots after the pushers, and the pushers too in a brace) stand
// by their own bird
function aiOnGuard(p, prof) {
  const e = aiOwnEagle(p);
  if (!e || state.elapsed < prof.push.t * 0.6) return null;
  const T = aiPlan(p.team), r = aiRank(p);
  return r >= T.nPush && r < T.nPush + T.nGuard ? e : null;
}
// the staging point of a roost: AI_GATE px up the road from the base's
// junction (e.mouth) toward the field, on the road itself, so the way in is
// always road -> junction -> the road through the hollow -> bird (roadNest/roadPoint, world.js)
function aiLaneGate(e) {
  return roadPoint(roadNest(e.team).u + (e.team === 0 ? 1 : -1) * AI_GATE / (TILE * Math.SQRT2));
}
// Walk toward a roost the way its lane allows: from the field to the gate,
// in through the mouth, then down the lane to the bird (reach tiles off it).
// Returns steerTo's distance, or -1 for no route this frame. A route straight
// at a bird from the field runs the pathfinder out in the border's trees and
// leaves the bot wedged in a pocket - which is what this exists to prevent.
function aiToRoost(p, e, steerTo, reach) {
  if (aiInLane(p, e)) return steerTo(e.x, e.y, reach, AI_ROOST_BUDGET);
  const dm = Math.hypot(e.mouth.x - p.x, e.mouth.y - p.y);
  if (dm <= 24) return steerTo(e.x, e.y, reach, AI_ROOST_BUDGET);
  const g = aiLaneGate(e);
  const dg = Math.hypot(g.x - p.x, g.y - p.y);
  if (dg > 40 && dm > AI_GATE * 0.75) return steerTo(g.x, g.y, 2, AI_ROOST_BUDGET);
  return steerTo(e.mouth.x, e.mouth.y, 1, AI_ROOST_BUDGET);
}
// is p inside a roost's lane - the band from the bird out to the lane's
// mouth on the treeline - or at the bird itself? Off it, the way to the
// roost is the mouth (aiInLane is asked before every walk to a bird).
function aiInLane(p, e) {
  const vx = e.mouth.x - e.x, vy = e.mouth.y - e.y, L2 = vx * vx + vy * vy || 1;
  const px = p.x - e.x, py = p.y - e.y;
  const t = (px * vx + py * vy) / L2;
  const perp = Math.abs(px * vy - py * vx) / Math.sqrt(L2);
  return (t >= -0.1 && t <= 1.08 && perp < 40) || Math.hypot(px, py) < 90;
}
// THE FORT IN A PUSHER'S WAY, as the tile of it nearest the bot (a part of a
// big building carries its own tx/ty), or null: a rival road tower
// (towerNear, js/sim/towers.js) with the bot's own wave under it to take the
// bolts (towerTanked) - a bot never walks in under a tower alone
function aiLaneFort(p, e) {
  const t = towerNear(p.team, p.x, p.y, TOWER_RANGE + 24);
  return t && towerTanked(t, p.team) ? nearestObj(p.x, p.y, 9, (o) => structOf(o) === t) : null;
}
// the eagle hitbox tile nearest p (a warrior's E target on a push)
function aiEagleTile(e, p) {
  let best = null, bd = 1e9;
  const cx0 = Math.floor(e.x / TILE), cy0 = Math.floor(e.y / TILE);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const o = inWorld(cx0 + dx, cy0 + dy) ? objects[idx(cx0 + dx, cy0 + dy)] : null;
    if (!o || o.type !== 'eagle' || o.team !== e.team) continue;
    const d = Math.hypot(o.tx * TILE + 8 - p.x, o.ty * TILE + 8 - p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// the nearest tile of a building's footprint to p, as a work target (E on
// an enemy building round an ATTACK ping)
function aiStructTile(o, p) {
  let best = null, bd = 1e9;
  for (let dy = 0; dy < structH(o); dy++) for (let dx = 0; dx < structW(o); dx++) {
    const tx = o.tx + dx, ty = o.ty + dy;
    const d = Math.hypot(tx * TILE + 8 - p.x, ty * TILE + 8 - p.y);
    if (d < bd) { bd = d; best = { tx, ty }; }
  }
  return best;
}

// the side's escorts: the two lowest bots on the human's team
function aiEscorts(p) {
  let n = 0;
  for (const q of players) {
    if (!q.active || q.control !== 'ai' || q.team !== player.team || q === player) continue;
    if (q === p) return n < 2;
    n++;
  }
  return false;
}

// The rival p goes for: within its profile's sight, plus anyone near an
// ANCHOR it is minding - its own bird under attack, the human it escorts,
// the rival bird it is pushing - so a defender finds the archer standing off
// its roost and an ally joins the fight the human is in. Every candidate
// still resolves through seenAt: a buried rival is buried for everyone.
// is the weapon in hand a blade? A bot with one fights at arm's length
// (AI_MELEE_D px) instead of at a bow's 70
const AI_MELEE_D = 18;
// Which band of `edges` (ascending px) distance d is in - 0 inside the first
// edge, edges.length past the last - holding the band it was in (`band`)
// until d is AI_BAND_HYS px past that band's own edge, so a body sitting on
// an edge does not swap moves every tick
const AI_BAND_HYS = 6;
function aiRangeBand(band, d, edges) {
  let b = 0;
  while (b < edges.length && d > edges[b]) b++;
  if (band === undefined || band === null || band === b) return b;
  if (b > band) return d > edges[b - 1] + AI_BAND_HYS ? b : (b > band + 1 ? b - 1 : band);
  return d < edges[b] - AI_BAND_HYS ? b : (b < band - 1 ? b + 1 : band);
}
function aiMelee(p) { return !!attackOf(p).cut; }
function aiNearestEnemy(p, prof, anchors) {
  let best = null, bs = Infinity;
  for (const q of players) {
    if (!enemyOf(p, q)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    let range = prof.sight;
    for (const an of anchors) {
      if (an && Math.hypot(q.x - an.x, q.y - an.y) < AI_ANCHOR_R) range = AI_ANCHOR_D;
    }
    if (d >= range || d >= seenAt(q, range, p.team)) continue;
    const s = prof.pick === 'weak' ? q.hp + d * 0.05 : d;
    if (s < bs) { bs = s; best = q; }
  }
  // a rival wave's soldiers are rivals too (the `soldiers` banner, robots.js):
  // the same sight and the same anchors, with no cover to see through
  for (const b of robots) {
    if (b.kind !== 'soldier' || !unitAlive(b) || b.team === p.team || !inSight(p.team, b)) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    let range = prof.sight;
    for (const an of anchors) {
      if (an && Math.hypot(b.x - an.x, b.y - an.y) < AI_ANCHOR_R) range = AI_ANCHOR_D;
    }
    if (d >= range) continue;
    const s = (prof.pick === 'weak' || aiRole(p) === 'laner' ? b.hp + d * 0.05 : d) + 20; // a player in the same sight is the better target (a laner reads the bars: the lowest is the next last hit)
    if (s < bs) { bs = s; best = b; }
  }
  return best;
}
// the head of its side's wave on the road: the own soldier nearest the
// rival bird that is still on the march (outside AI_ROOST_R of it) and near
// enough to be worth walking with - a push rides its wave (rung 5c)
const AI_PACK = 5;       // relentless pushers that must be together at the rally (their cable's end) before the pack goes on
const AI_PACK_R = 200;   // px round the rally a pusher counts as at it (bodies milling at a point stand 70-150 px apart)
const AI_REGROUP = 2;    // pushers every other side meets at the rally before going in (the team brain)
const AI_REGROUP_T = 15; // s one waits there before it goes in alone
const AI_WAVE_R = 80;    // px a pusher keeps to the column's head
const AI_WAVE_D = 640;   // px past which the column is too far behind to wait for
function aiWaveHead(p, e) {
  let best = null, bd = 1e9;
  for (const b of robots) {
    if (b.kind !== 'soldier' || !unitAlive(b) || b.team !== p.team) continue;
    const d = Math.hypot(b.x - e.x, b.y - e.y);
    if (d < AI_ROOST_R || d >= bd || Math.hypot(b.x - p.x, b.y - p.y) > AI_WAVE_D) continue;
    // a column well behind is not one to walk back for (the regroup is)
    if (d > Math.hypot(p.x - e.x, p.y - e.y) + AI_WAVE_R * 2) continue;
    // a column locked in a fight with the rival's is not going anywhere: walk past it
    let clash = false;
    for (const r of robots) if (r.kind === 'soldier' && unitAlive(r) && r.team !== p.team && Math.hypot(r.x - b.x, r.y - b.y) < AI_WAVE_R * 1.5) { clash = true; break; }
    if (clash) continue;
    bd = d; best = b;
  }
  return best;
}

// ---- the road, and the roam ---------------------------------------------------
// XP is being NEAR when rival bodies fall (shareXp, js/sim/player.js), and the
// road is where they fall, a wave every thirty seconds - while gold is the
// work's (the harvest rung). So a bot splits its time: every AI_ROAD_T it
// rolls a stretch on the road or on the work, the road at AI_ROAD_P at the
// table's average level, AI_ROAD_LV more a level it trails that average and
// less a level it leads, and a greedy mood stays on the work longer. On a
// road stretch it walks to the nearest rival soldier inside AI_ROAD_D (rung
// 5g); rung 3 does the fighting once the wave is in sight. No wave out, or a
// work stretch: null, and the ladder goes on to the hunt and the harvest.
const AI_ROAD_T = 30;    // s a stretch lasts before the next roll
const AI_ROAD_P = 0.55;  // the odds of the road at the table's average level
const AI_ROAD_LV = 0.15; // ...moved this much a level behind (up) or ahead (down)
const AI_ROAD_D = 1600;  // px off a rival soldier may be and still be walked to: most of the way across the valley, the zipline helps
function aiRoad(p, dt) {
  const ai = p.ai;
  ai.roadT = (ai.roadT || 0) - dt;
  if (ai.roadT <= 0) {
    ai.roadT = AI_ROAD_T;
    ai.road = rng() < (AI_ROAD_P + AI_ROAD_LV * (animalLevel() - p.level)) / aiMood(p).greed;
  }
  if (!ai.road) return null;
  let best = null, bd = AI_ROAD_D;
  for (const b of robots) {
    if (b.kind !== 'soldier' || !unitAlive(b) || b.team === p.team) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
// where a bot with nothing to do wanders next: round its leash when it has
// one, else near the middle of the map or near its own landing, by halves
// (rung 11)
function aiRoamPick(p, leash) {
  const ai = p.ai;
  if (leash) { ai.wx = leash.e.x + rand(-1, 1) * leash.r; ai.wy = leash.e.y + rand(-1, 1) * leash.r; return; }
  const toward = rng() < 0.5 ? { x: cx * TILE, y: cy * TILE } :
    { x: (p.spawn.tx + 0.5) * TILE, y: (p.spawn.ty + 0.5) * TILE };
  const w = aiMood(p).roam; // (a wild bot wanders wider)
  ai.wx = toward.x + rand(-14, 14) * TILE * w;
  ai.wy = toward.y + rand(-14, 14) * TILE * w;
}

// ---- the ride ---------------------------------------------------------------
// A bot rides the zipline (the `zipline` banner, js/sim/zipline.js) the way a hand
// does, through the same hop intent: every walk the ladder orders goes
// through steerTo, and steerTo asks aiZipWorth first - would walking to
// either side's cable, riding to the point nearest the goal and walking the
// rest beat the feet by ZIP_AI_GAIN seconds? (The better of the two, if both
// would.) If so it walks to the mount
// (zipMount, js/sim/zipline.js: the nearest point of the cable whose ground a body can stand
// on), presses the hop under it, holds the stick along the cable toward the
// exit while it rides, and presses the hop again ZIP_AI_OFF short of the
// exit. The goal is re-read every think, so a rider called home mid-cable
// simply holds the other way. Nothing here decides WHERE a bot goes - the
// rungs do - only how it covers the ground; and a ride with no rung wanting
// it (aiThink returned without a walk) is let go of at once, so a bot never
// coasts to the terminus by accident. A fight (rung 3) and a camp on it
// (rung 4) let go first: nobody rides past an enemy holding the handle.
const ZIP_AI_GAIN = 4;   // s a ride must save over the feet before a bot walks to the cable
const ZIP_AI_OFF = 6;    // px short of the exit point it lets go (a step is 3.7 px at ZIP_SPD)
// the feet's time over a straight line, at the bot's own walk
function aiWalkT(p, d) { return d / statOf(p, 'ms'); }
// the ride from p's spot to (x, y), if the cable saves ZIP_AI_GAIN over the
// feet: { z, d0, d1 } (px along at the mount and the exit), else null
function aiZipWorth(p, x, y) {
  const feet = aiWalkT(p, Math.hypot(x - p.x, y - p.y));
  let best = null, bt = feet - ZIP_AI_GAIN;
  for (const z of zips) {
    if (!z) continue;
    const nb = zipNearest(z, p.x, p.y), ng = zipNearest(z, x, y);
    const ride = aiWalkT(p, nb.dist) + Math.abs(ng.d - nb.d) / ZIP_SPD + aiWalkT(p, ng.dist);
    if (ride <= bt) { bt = ride; best = { z, d0: nb.d, d1: ng.d }; }
  }
  return best;
}

// the camp monster nearest of those in a fight this bot is in. A camp is
// neutral until hit (updateCampMonster, wildlife.js), so one standing by
// is nothing to a bot - only a hunting one is: one hunting this bot, in
// AI_SIGHT, or (an ally minding the human, `ward`) one hunting anybody on
// its side inside AI_ANCHOR_R of the human, noticed from AI_ANCHOR_D - the
// human is the anchor, exactly as for a rival at rung 3, so a bear you
// wake is a bear your side comes to. "Anybody on its side" because the
// camp goes for whoever is nearest (campQuarry): the first helper to walk
// in takes it off the human, and the rest must not drop out when it does
function aiNearestWolf(p, ward) {
  let best = null, bd = Infinity;
  for (const a of animals) {
    if (!unitAlive(a) || !isCampKind(a.kind) || !a.target) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d >= bd) continue;
    const mine = a.target === p && d < AI_SIGHT;
    const helps = ward && a.target.team === p.team && d < AI_ANCHOR_D &&
      Math.hypot(a.x - ward.x, a.y - ward.y) < AI_ANCHOR_R;
    if (mine || helps) { bd = d; best = a; }
  }
  return best;
}

function aiNearestAnimal(p) {
  let best = null, bd = AI_HUNT;
  for (const a of animals) {
    // birds fly: no route on the ground catches a flushed flock. The two
    // midline camps' kinds are never a hunt: a lone bot pulling one dies to it
    if (a.dead || a.kind === 'bird' || a === p.ai.huntAvoid || a.rider || !inSight(p.team, a)) continue; // a ridden deer is its rider's; one in the fog is not there
    if (MONSTER[a.kind] && MONSTER[a.kind].teamPay) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

// arrows die on solids, so a bot only shoots when the flight path is open
function aiLineClear(p, x, y) {
  const dx = x - p.x, dy = y - (p.y - BOW_Y), d = Math.hypot(dx, dy) || 1;
  for (let s = 10; s < d; s += 8) {
    if (isSolidTile(Math.floor((p.x + dx / d * s) / TILE), Math.floor((p.y - BOW_Y + dy / d * s) / TILE))) return false;
  }
  return true;
}

// open tiles around a target: work needs at least one to stand on (the
// route finds the way to it)
function aiOpenSides(tx, ty) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = tx + dx, ny = ty + dy;
    if (inWorld(nx, ny) && !isSolidTile(nx, ny) && !waterAt(nx, ny)) n++;
  }
  return n;
}

// aiThink's rung 0: a free skill point, then the purse. Items first, off the
// class's build (BOT_BUILDS, js/sim/items.js): at a counter it buys whatever
// of the build it can afford, a part or the whole item, and a purse that
// covers the next WHOLE item walks it to its own side's counter when that is
// close (a bot respawns beside it).
// True while it is walking to shop, which ends aiThink's ladder this think.
const AI_SHOP_DETOUR = 32 * TILE; // px: how far a bot walks to its counter to buy; past it (AI_RECALL_FAR) it recalls
function aiSpend(p, inp, steerTo) {
  // spend a free skill point before the ladder - waiting on it is leaving
  // growth on the table. League's order: the ultimate whenever it can rank,
  // then every basic key unlocked once (level 0 casts nothing), then the
  // basics maxed in the hero's own rankOrder (CLASSES), first to last.
  if (p.skillPts > 0 && !inp.cmd) {
    const order = CLASSES[p.cls].rankOrder || [0, 1, 2];
    let ba = abLvCanBuy(p, AB_ULT) ? AB_ULT : -1;
    for (const i of order) if (ba < 0 && p.abLv[i] === 0 && abLvCanBuy(p, i)) ba = i;
    for (const i of order) if (ba < 0 && abLvCanBuy(p, i)) ba = i; // (a key still waiting on its hero level is no buy yet)
    if (ba >= 0) inp.cmd = { kind: 'ability', i: ba };
  }
  if (!inp.cmd && p.items) {
    const buy = botItemBuy(p);
    if (buy && merchNear(p)) { inp.cmd = { kind: 'shop', act: 'item', id: buy }; return false; }
    const stray = !p.items.includes(null) && merchNear(p) ? botStrayPart(p) : -1;
    if (stray >= 0) { inp.cmd = { kind: 'shop', act: 'sellItem', slot: stray }; return false; }
    const next = botNextItem(p);
    // the walk: the next WHOLE item is in the purse and the counter will
    // seat it (a stray part sold there makes the room), never out of a fight
    // (ITEM_FIGHT_T)
    const nc = next && itemCost(p, next);
    const fits = nc && (itemRoom(p, nc.used) >= 1 || botStrayPart(p) >= 0);
    if (next && fits && !merchNear(p) && p.inv.gold >= nc.gold && p.fightT <= 0) {
      const m = robots.find((b) => b.merchant && !b.dead && b.team === p.team);
      const c = m && (stallUp(m.stall) ? m.stall : m.hopT > 0 ? null : m);
      const pt = c && counterPt(c);
      if (pt && Math.hypot(pt.x - p.x, pt.y - p.y) < AI_SHOP_DETOUR && steerTo(pt.x, pt.y, 1) >= 0) {
        aiNote(p, 'SHOP', BUILD_ITEMS[next].name, pt);
        return true;
      }
    }
    if (next) return false;
  }
  return false;
}

function updateAI(p, dt) {
  const ai = p.ai;
  ai.zipUsed = false;
  if (p.dead) ai.packGo = false;
  aiThink(p, dt); // the ladder (js/ai/ai-ladder.js)
  if (!p.dead) skillHands(p, aiProfile(p), dt); // the crosshair moves to where the ladder aimed (the skill layer, ai-skill.js)
  aiRecall(p); // over the ladder: the walk home when low, and the wait in the roost ring (below)
  // riding with no rung wanting the ride this think: let go (the ride, above)
  if (p.zip >= 0 && !ai.zipUsed) p.input.jump = true;
}
// rung 1's meal (aiThink): fish when badly hurt, berries when a little, and
// only with no rival close enough to knock it out of the hands
function aiEat(p, foeD) {
  const inp = p.input;
  if (p.eatT <= 0 && p.foodCd <= 0 && foeD > AI_EAT_R) {
    if (p.hp < p.maxHp * 0.5 && fishHeld(p) > 0) inp.eatFish = true;
    else if (p.hp < p.maxHp * 0.8 && bagCount(p, 'berry') > 0) inp.eatBerry = true;
  }
  if (p.eatT > 0) aiNote(p, 'EAT', 'LOW HP', null);
}
// THE WAY HOME (js/sim/recall.js). Read after the ladder, so it overrides
// what the ladder asked only when nothing rival is within AI_RECALL_SAFE: a
// fight in reach is the ladder's, and whatever it does there ends a channel
// the way a player's own action would. Out of reach of one, a bot low on
// health, or out of a fight with the gold for its next whole item (League's
// back to shop: the counter stands by the bird), and far from its bird
// recalls and stands still for the channel; one already in its own ring and
// hurt stands in it until it is whole again.
const AI_RECALL_HP = 0.35;      // share of max health under which a bot goes home
const AI_RECALL_FAR = 30 * TILE; // px from its bird past which the channel beats the walk
const AI_RECALL_SAFE = 150;     // px: a rival this close and the bot fights or runs instead
const AI_RING_FULL = 0.9;       // share of max health a bot waits in its ring for
function aiRecall(p) {
  if (p.dead || inAir(p) || p.zip >= 0 || p.mount) return;
  const e = state.drop && state.drop.eagles[p.team];
  if (!e || e.state !== 'down') return;
  if (unitsNear(p, p.x, p.y, AI_RECALL_SAFE).some((q) => (q instanceof Player || robots.includes(q)) && inSight(p.team, q))) return; // what its side sees, as a player would
  const inp = p.input, low = p.hp < p.maxHp * AI_RECALL_HP;
  const next = p.items && botNextItem(p), nc = next && itemCost(p, next);
  const rich = !!nc && p.fightT <= 0 && p.inv.gold >= nc.gold && (itemRoom(p, nc.used) >= 1 || botStrayPart(p) >= 0);
  const go = p.recallT <= 0 && (low || rich) && p.eatT <= 0 && !recallBlocked(p) && Math.hypot(e.x - p.x, e.y - p.y) > AI_RECALL_FAR;
  const wait = roostRing(p) && p.fightT <= 0 && p.hp < p.maxHp * AI_RING_FULL; // a body still in a fight is the ladder's
  if (!go && !(p.recallT > 0) && !wait) return;
  if (go) inp.cmd = { kind: 'recall' };
  inp.mx = inp.my = 0; inp.slide = false; inp.dodge = false; inp.jump = false;
  if (go || p.recallT > 0) { inp.fire = false; inp.work = false; inp.ability = -1; aiNote(p, 'RECALL', low ? 'LOW HP' : 'SHOP', null); }
  else aiNote(p, 'IDLE', 'HEALING', null);
}

