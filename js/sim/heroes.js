'use strict';
// ------------------------------------------------------------ hero hooks
// The places a named hero's kit reaches into the shared sim, as lists and
// tables each hero file registers into at load (js/sim/armatos.js and the
// heroes after him), so a second hero never adds a second named call beside
// the first. Loaded before every hero file; everything here runs at runtime
// and draws no rng().
//
// - HERO_PASSIVE[name]: a passive by the name a CLASSES row gives (`passive`),
//   with any of hurt(p, dmg, src) for a hit taken (after armor, before the
//   shields), deal(src, e, dmg, o) -> dmg for a blow landed (before it lands),
//   cast(p) for a key landing, tick(p, dt) every step, out(p) when the body
//   leaves the world (bodyOut); plus name/blurb/icon for the strip and the wiki.
// - HERO_TAKEN: fn(p, dmg, dx, dy, src) -> dmg, folded over every hit a player
//   takes after armor (a brace, a parry).
// - HERO_STAT: { name, add(p, key) } summed into statOf; `name` labels its row
//   in the stat panel's hover.
// - HERO_TEN: fn(e) -> tenacity 0..1; every stun, root and slow lasts the
//   product of (1 - t) of its length (ccMul, js/sim/actions.js).
// - HERO_MOVE: fn(p) -> a multiplier on the walk (abilityMoveMul).
// - HERO_DASH[id]: a charge riding the rush's state (rushT, rushNX/NY) at its
//   own pace: { spd, t, ramp, step(p, mv, dt), pose(p)? }, picked by p.dash = id
//   (`pose` is the body's while it runs: abilityPose; else the rush's lean).
// - HERO_TICK: fn(dt) once a step for what a hero leaves in the world.
// - HERO_GROUND: fn(ex, ey, now) drawn on the snow under the wind-ups.
// An ability row may also carry recast(p) (true: the key pressed again is
// its second half, castSlam) and ok(p) (false: the press is refused).
const HERO_PASSIVE = {};
const HERO_TAKEN = [];
const HERO_STAT = [];
const HERO_TEN = [];
const HERO_MOVE = [];
const HERO_DASH = {};
const HERO_TICK = [];
const HERO_GROUND = [];

// the ability whose use() is running right now, so a blow it lands says so
// (o.ab, stamped by hurtUnit, js/sim/actions.js); '' between casts. Never state: set and cleared
// inside one call.
let heroAbNow = '';

function heroPassive(p) { const c = CLASSES[p.cls]; return c && c.passive ? HERO_PASSIVE[c.passive] : null; }
function passiveHurt(p, dmg, src) { const h = heroPassive(p); if (h && h.hurt) h.hurt(p, dmg, src); }
function passiveCast(p) { const h = heroPassive(p); if (h && h.cast) h.cast(p); }
function passiveTick(p, dt) { const h = heroPassive(p); if (h && h.tick) h.tick(p, dt); }
function passiveOut(p) { const h = heroPassive(p); if (h && h.out) h.out(p); }
// a blow `src` is about to land on `e`: what its passive makes of it
function passiveDeal(src, e, dmg, o) {
  if (!(src instanceof Player)) return dmg;
  const h = heroPassive(src);
  if (!h || !h.deal) return dmg;
  return h.deal(src, e, dmg, o);
}
function heroTaken(p, dmg, dx, dy, src) { for (const f of HERO_TAKEN) dmg = f(p, dmg, dx, dy, src); return dmg; }
function heroStat(p, key) { let n = 0; for (const s of HERO_STAT) n += s.add(p, key); return n; }
function heroTen(e) { let m = 1; for (const f of HERO_TEN) m *= 1 - Math.min(1, Math.max(0, f(e))); return m; }
function heroMove(p) { let m = 1; for (const f of HERO_MOVE) m *= f(p); return m; }
function heroDash(p) { return p.dash ? HERO_DASH[p.dash] : null; }
function heroTick(dt) { for (const f of HERO_TICK) f(dt); }
function heroGround(ex, ey, now) { for (const f of HERO_GROUND) f(ex, ey, now); }
