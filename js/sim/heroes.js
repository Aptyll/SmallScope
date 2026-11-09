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
//   cast(p) for a key landing, shot(p, a) for a basic shot just loosed (it may
//   change the shot: SAGITTA's heavy bolt), tick(p, dt) every step, out(p) when the body
//   leaves the world (bodyOut); plus name/blurb/icon for the strip and the wiki.
// - HERO_TAKEN: fn(p, dmg, dx, dy, src) -> dmg, folded over every hit a player
//   takes after armor (a brace, a parry).
// - HERO_STAT: { name, add(p, key) } summed into statOf; `name` labels its row
//   in the stat panel's hover.
// - HERO_TEN: fn(e) -> tenacity 0..1; every stun, root and slow lasts the
//   product of (1 - t) of its length (ccMul, js/sim/actions.js).
// - HERO_MOVE: fn(p) -> a multiplier on the walk (abilityMoveMul).
// - HERO_SIGHT: fn(p) -> a multiplier on how far a hero sees (FOG_HERO, sightSources):
//   LUCERNA's lamplight stretches it, HIEMS's whiteout cuts it.
// - HERO_DASH[id]: a charge riding the rush's state (rushT, rushNX/NY) at its
//   own pace: { spd, t, ramp, step(p, mv, dt), pose(p)? }, picked by p.dash = id
//   (`pose` is the body's while it runs: abilityPose; else the rush's lean); with
//   `through` it passes the small bodies a roll passes (separateUnits).
// - HERO_TICK: fn(dt) once a step for what a hero leaves in the world.
// - HERO_GROUND: fn(ex, ey, now) drawn on the snow under the wind-ups.
// - HERO_MARK: fn(e, px, py, w, h, now) drawn over any body with the states
//   every unit wears (drawUnitStates): a mark a hero left on it, a hero's own stacks.
// - HERO_ICE: fn(p) -> true where a hero's ground skates like the creek's ice
//   (iceUnder, js/sim/sim.js): a rival's glaze, VELOX's lanes.
// - HERO_SUMMON[id]: { step(a, dt) } the brain of an animal a hero called onto its
//   side (a.summon = id, with team and owner): VARRO's wolves. It walks in `animals`
//   like any beast (hit, drawn, pushed apart, fogged) and pays nothing when it falls.
// - HERO_AIR: fn(ex, ey, now) drawn over the bodies with the arrows
//   (drawAbilityAir): what a kit leaves in the air (NIX's shard and her cloud's powder).
// - HERO_COVER: fn(srcs, x, y, u) -> true when body u at (x, y) is hidden from
//   the side whose eyes are `srcs`, beside the woods and the brush (coverHide,
//   js/sim/fog.js): cover a hero's kit makes (NIX's snow cloud).
// - HERO_MACHINE[kind]: { step(b, dt), draw(b, ex, ey, now), r, hitR, mass, sight,
//   pay: { gold, xp } } a machine a hero built (b.kind = kind, with team and owner):
//   FABER's. It is a body in `robots` like a soldier (hit, drawn, pushed apart,
//   shot at by towers and soldiers); `pay` is a rival's for breaking it.
// - HERO_WRECK: fn(b, src) when a body in `robots` is broken (robotDies): FABER's spare parts.
// - HERO_SHOT_HIT[id]: fn(a, t, nx, ny) once a shot with `a.hit = id` has landed its
//   blow on body t (the arrow loop, js/sim/sim.js): SAGITTA's pin against a tree.
//   Clearing a.pierce there ends a piercing shot on that body.
// An ability row may also carry recast(p) (true: the key pressed again is
// its second half, castSlam), ok(p) (false: the press is refused) and aimHeld
// (its wind-up holds the weapon on the aim: castAims, js/draw/bodies.js).
const HERO_PASSIVE = {};
const HERO_TAKEN = [];
const HERO_STAT = [];
const HERO_TEN = [];
const HERO_MOVE = [];
const HERO_SIGHT = [];
const HERO_DASH = {};
const HERO_TICK = [];
const HERO_GROUND = [];
const HERO_MARK = [];
const HERO_ICE = [];
const HERO_SUMMON = {};
const HERO_COVER = [];
const HERO_AIR = [];
const HERO_MACHINE = {};
const HERO_WRECK = [];
const HERO_SHOT_HIT = {};

// the ability whose use() is running right now, so a blow it lands says so
// (o.ab, stamped by hurtUnit, js/sim/actions.js); '' between casts. Never state: set and cleared
// inside one call.
let heroAbNow = '';

function heroPassive(p) { const c = CLASSES[p.cls]; return c && c.passive ? HERO_PASSIVE[c.passive] : null; }
function passiveHurt(p, dmg, src) { const h = heroPassive(p); if (h && h.hurt) h.hurt(p, dmg, src); }
function passiveCast(p) { const h = heroPassive(p); if (h && h.cast) h.cast(p); }
function passiveTick(p, dt) { const h = heroPassive(p); if (h && h.tick) h.tick(p, dt); }
function passiveOut(p) { const h = heroPassive(p); if (h && h.out) h.out(p); }
function passiveShot(p, a) { const h = heroPassive(p); if (h && h.shot) h.shot(p, a); }
// a blow `src` is about to land on `e`: what its passive makes of it
function passiveDeal(src, e, dmg, o) {
  if (!(src instanceof Player)) return dmg;
  const h = heroPassive(src);
  if (!h || !h.deal) return dmg;
  return h.deal(src, e, dmg, o);
}
function heroTaken(p, dmg, dx, dy, src) { for (const f of HERO_TAKEN) dmg = f(p, dmg, dx, dy, src); return dmg; }
function heroStat(p, key) { let n = 0; for (const s of HERO_STAT) n += s.add(p, key); return n; }
function heroSight(p) { let m = 1; for (const f of HERO_SIGHT) m *= f(p); return m; }
function heroTen(e) { let m = 1; for (const f of HERO_TEN) m *= 1 - Math.min(1, Math.max(0, f(e))); return m; }
function heroMove(p) { let m = 1; for (const f of HERO_MOVE) m *= f(p); return m; }
function heroDash(p) { return p.dash ? HERO_DASH[p.dash] : null; }
function heroDashThrough(p) { const d = p.rushT > 0 && heroDash(p); return !!(d && d.through); }
function heroTick(dt) { for (const f of HERO_TICK) f(dt); }
function heroGround(ex, ey, now) { for (const f of HERO_GROUND) f(ex, ey, now); }
function heroMarks(e, px, py, w, h, now) { for (const f of HERO_MARK) f(e, px, py, w, h, now); }
function heroIce(p) { for (const f of HERO_ICE) if (f(p)) return true; return false; }
function heroSummonStep(a, dt) { const s = HERO_SUMMON[a.summon]; if (s) s.step(a, dt); else a.dead = true; }
function heroCover(srcs, x, y, u) { for (const f of HERO_COVER) if (f(srcs, x, y, u)) return true; return false; }
function heroAir(ex, ey, now) { for (const f of HERO_AIR) f(ex, ey, now); }
function heroMachine(b) { return (b.kind && HERO_MACHINE[b.kind]) || null; }
function heroWreck(b, src) { for (const f of HERO_WRECK) f(b, src); }
function heroShotHit(a, t, nx, ny) { const f = a.hit && HERO_SHOT_HIT[a.hit]; if (f) f(a, t, nx, ny); }
