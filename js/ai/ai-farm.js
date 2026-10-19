'use strict';
// ------------------------------------------------------------ bot farm
// Bots farm the way a hand does (the `farm` banner, js/sim/farm.js): two of
// the side's roles (AI_ROLES, js/ai/ai-team.js) are farm jobs, handed out
// after the side's pushers, guards and bear party.
//   LANER    walks to where its side's wave meets the rival one and stands
//            just behind its own column; the fight there is rung 3's, and
//            on a rival soldier its own soldiers are wearing down it holds
//            the draw until one blow finishes it (aiFarmFire) - the last
//            hit, never the softening. A lone soldier is simply killed.
//   JUNGLER  walks its own side's wolf dens: a den with its pack up is
//            walked into and hunted (rung 6, which hunts anything in
//            AI_HUNT); a cleared one is waited on just outside its ground
//            (CAMP_HOLD) so it is there as the clock ends, and while the
//            next den is further off in time than in walking, the jungler
//            works what is near instead.
// Neither job reads anything a hand could not: the soldiers' health bars,
// the den clocks every screen wears, and the damage its own last blow did.
const AI_JUNGLE_N = 2;   // junglers a side hands out (one den each of its two)
const AI_LANE_N = 3;     // laners a side hands out
const AI_FARM_NEAR = 40; // px an own soldier must be from a rival one for the rival to count as being worn down
const AI_FARM_HIT = 8;   // damage a bot reckons on before its own first blow on a soldier tells it better
const AI_FARM_FORGET = 0.95; // share of its hardest remembered blow a bot keeps at each new one (a new weapon is learned in a few)
const AI_FARM_ARROW = 300; // px/s a bot reckons its shot flies (the plain arrow's 320, a little under)
const AI_FARM_SWING = 0.2; // s from a blade's release to the cut landing, as a bot reckons it
const AI_FARM_STAND = [40, 90]; // px a blade and a bow wait off a soldier they are holding for
const AI_FARM_BACK = 40; // px a laner stands behind its own column, toward its own bird
const AI_DEN_EARLY = 15; // s ahead of a den's clock a jungler sets off (time to walk in on top of the walk)

// is foe a rival soldier p should leave alone until one blow finishes it?
// It reads ahead by the blow's travel: the swings its own soldiers on it
// will land before an arrow gets there (half of them - a swing that does not
// come leaves the soldier a sliver over, and the wave takes it)
function aiFarmHold(p, foe) {
  if (!foe || foe.kind !== 'soldier' || foe.team === p.team) return false;
  let worn = 0;
  for (const b of robots) {
    if (b.kind === 'soldier' && b.team === p.team && unitAlive(b) && Math.hypot(b.x - foe.x, b.y - foe.y) < AI_FARM_NEAR) worn++;
  }
  if (!worn) return false;
  const travel = aiMelee(p) ? AI_FARM_SWING : Math.hypot(foe.x - p.x, foe.y - p.y) / AI_FARM_ARROW;
  return foe.hp - worn * ROBOT_DMG * travel / ROBOT_ATK_CD * 0.5 > (p.ai.farmHit || AI_FARM_HIT);
}
// rung 3's trigger on a soldier: while it is not yet one blow from down,
// the draw is held (a held press never looses); once it is, the ordinary
// trigger lets the draw go
// - and while it waits it stands off at AI_FARM_STAND, its own soldiers
// nearer the rival than it is, so the wave it is farming is not hitting it
function aiFarmFire(p, foe, fire) {
  if (!aiFarmHold(p, foe)) return fire;
  const dx = foe.x - p.x, dy = foe.y - p.y, d = Math.hypot(dx, dy) || 1;
  const stand = aiMelee(p) ? AI_FARM_STAND[0] : AI_FARM_STAND[1];
  if (d < stand) { p.input.mx = -dx / d; p.input.my = -dy / d; }
  else if (d > stand + 16) { p.input.mx = dx / d; p.input.my = dy / d; }
  else { p.input.mx = 0; p.input.my = 0; }
  return true;
}
// what p's blow did to a soldier, remembered for the next last hit
// - the hardest of its recent blows, so one weak tap does not have it
// waiting for a soldier to drop under a tap's worth (and lose it to the wave)
function aiFarmLearn(src, dmg) { if (src && src.control === 'ai' && src.ai) src.ai.farmHit = Math.max(dmg, (src.ai.farmHit || 0) * AI_FARM_FORGET); }

// where a laner stands: behind its own soldier nearest a rival one (the
// clash), or behind its own column's head with no clash yet; null with no
// column on the road
function aiLaneSpot(p) {
  const own = aiOwnEagle(p);
  let best = null, bd = Infinity, head = null, hd = Infinity;
  const rival = aiRivalEagle(p);
  for (const b of robots) {
    if (b.kind !== 'soldier' || b.team !== p.team || !unitAlive(b)) continue;
    if (rival) { const d = Math.hypot(b.x - rival.x, b.y - rival.y); if (d < hd) { hd = d; head = b; } }
    for (const r of robots) {
      if (r.kind !== 'soldier' || r.team === p.team || !unitAlive(r) || Math.hypot(r.x - b.x, r.y - b.y) > AI_WAVE_R * 1.5) continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < bd) { bd = d; best = b; }
      break;
    }
  }
  const b = best || head;
  if (!b) return null;
  if (!own) return { x: b.x, y: b.y };
  const ux = own.x - b.x, uy = own.y - b.y, ud = Math.hypot(ux, uy) || 1;
  return { x: b.x + ux / ud * AI_FARM_BACK, y: b.y + uy / ud * AI_FARM_BACK };
}

// where a jungler goes: its side's den with the pack up (walked into), or the
// cleared one coming back soonest, waited on outside its ground; null when
// the soonest one is further off in time than the walk (work what is near)
function aiDenSpot(p) {
  const own = aiOwnEagle(p), rival = aiRivalEagle(p);
  if (!own) return null;
  let up = null, ud = Infinity, next = null, nt = Infinity;
  for (const C of camps) {
    if (C.key !== 'resource') continue;
    const cx = (C.tx + 0.5) * TILE, cy = (C.ty + 0.5) * TILE;
    if (rival && Math.hypot(cx - rival.x, cy - rival.y) < Math.hypot(cx - own.x, cy - own.y)) continue; // the rival's half
    const d = Math.hypot(cx - p.x, cy - p.y);
    if (campPop(C) > 0) { if (d < ud) { ud = d; up = { x: cx, y: cy, d, wait: false }; } continue; }
    const t = Math.max(C.repopT, aiWalkT(p, d));
    if (t < nt) { nt = t; next = { x: cx, y: cy, d, wait: true, left: C.repopT }; }
  }
  if (up) return up;
  if (!next || next.left - aiWalkT(p, next.d) > AI_DEN_EARLY) return null;
  // outside the den's ground, on p's side of it: standing in it holds the clock
  const ux = p.x - next.x, uy = p.y - next.y, d = Math.hypot(ux, uy) || 1;
  return { x: next.x + ux / d * (CAMP_HOLD + 16), y: next.y + uy / d * (CAMP_HOLD + 16), wait: true, d };
}

// the farm roles' walk (rung 5f of aiThink): true when p is on its way, or
// waiting on a den, and the ladder below is not for it this think
function aiFarmWalk(p, role, steerTo, aimAt) {
  if (role !== 'laner' && role !== 'jungler') return false;
  const s = role === 'laner' ? aiLaneSpot(p) : aiDenSpot(p);
  if (!s) return false;
  const d = Math.hypot(s.x - p.x, s.y - p.y);
  // a den with its pack up is hunted from AI_HUNT in (rung 6), so the walk stops short of it
  if (role === 'jungler' && !s.wait && d < AI_HUNT * 0.8) return false;
  aiNote(p, role === 'laner' ? 'FARM' : 'JUNGLE', role === 'laner' ? 'LAST HITS' : s.wait ? 'DEN SOON' : 'DEN UP', s);
  if (d > 12 && steerTo(s.x, s.y, 2) < 0) return false;
  if (d <= 12) { p.input.mx = 0; p.input.my = 0; }
  aimAt(s.x, s.y);
  p.input.fire = false;
  p.ai.tgt = null;
  return true;
}
