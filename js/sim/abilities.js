'use strict';
// The heroes' abilities: keys 1-4, four actives per hero, each with a
// cooldown and a cast the body visibly performs. The rows and their effects
// are each hero's own file (ARM_AB, js/sim/armatos.js, and the rest); this is
// the machinery every row runs through: ranks, casting, the second half of a
// key (`recast`), and the shield and dash states a key can leave on a body.
// Everything here runs per player off p.input.ability, so a bot casts through
// exactly the key a human presses. Loaded after attack.js (it shares the
// world's fx helpers at runtime and nothing at load time - and it must draw
// no load-time rng(), or every seed reshuffles). Their pixels - the telegraph
// shapes, the world layer, the body's poses and the strip's icons - are
// js/draw/abilities.js.
// ------------------------------------------------------------ class abilities

// ---- tuning --------------------------------------------------------------
const AB_KEYS = 4;          // keys 1-4
// ability ranks, League-style: the hero's own growth, never the purse's. A
// key starts LOCKED at rank 0 - the kit hands you the four actives, not the
// use of them - and every rank costs ONE SKILL POINT, the only thing a point
// buys, one per hero level. The FIRST point UNLOCKS the key; every one after
// is a clear step in what it does - the numbers in its row's `rank` table
// (and a `cd` given as a list), read through abRk/abCdOf. A basic key (1-3)
// holds AB_RANK_LV.length ranks, rank n waiting for hero level AB_RANK_LV[n-1];
// the ultimate (key 4, AB_ULT) holds three, at AB_ULT_LV. 5 + 5 + 5 + 3 is the
// 18 points a capped hero earns, so the ladder ends exactly where the hero
// does, and the ORDER you spend them in is the whole build.
const AB_RANK_LV = [1, 3, 5, 7, 9];  // hero level each rank of a basic key waits for (rank n at 2n - 1)
const AB_ULT_LV = [6, 11, 16];       // ...and of the ultimate's
const AB_ULT = 3;                    // the key that is the ultimate (4, R)
const AB_LV_MATS = ['#8a6a4a', '#9aa3ad', '#9fc4dd', '#cfe0ff', '#f2cc6a']; // the rank-up floater's ink, by the key's new rank (the last one gold)
// the front arc of a raised shield (shieldT, the state ARMATOS's brace rides): a
// hit from inside it is braced (holdTaken, js/sim/armatos.js)
const SHIELD_ARC = 0.35;    // cos-margin of the front arc
const RECAST_T = 0.16;      // s of wind-up a key's second half (`recast`) takes
// every readable shape an ability puts on the snow for BOTH sides: the
// telegraph while a cast winds up (the wedge, the ring, the dash's line),
// and the flash where it landed. abFx holds the flashes; the telegraphs are
// read live off the caster.
const AB_FX_T = 0.28;       // s a landed shape flashes for
const TELE_COL = '#e0637a'; // the wind-up's colour...
const TELE_HOT = '#ffd95c'; // ...and the last quarter of it, when it is about to land

// ---- the kits --------------------------------------------------------
// One list of four rows per hero, in CLASSES order. A row is one key: `use(p)`
// is the whole effect, fired when the cast lands - what an ability IS lives in
// its row, never in an `if` somewhere else. `cast` is the seconds the body
// spends performing it (the pose is abilityPose, js/draw/abilities.js). `aim`
// is the ground it covers (a bot's reach, botAbView in js/ai/bot-api.js, and
// the draw's cull, js/draw/abilities.js): a `line` of that many px toward the
// aim, a `cone` of radius r and `half` rad either side of it, or a `ring`
// of radius r round the body; a row without one aims at nothing. Every
// field a row may carry is listed over ARM_AB (js/sim/armatos.js).
const CLASS_AB = [
  ARM_AB, // ARMATOS - the standard, the shield, the march (js/sim/armatos.js)
  FORT_AB, // FORTIVA - the arc, the defiant shield, the lunge, the leap (js/sim/fortiva.js)
  BELLA_AB, // BELLA - the lunge, the parry, the slip, the duel (js/sim/bella.js)
  IGNIA_AB, // IGNIA - the brand, the brushfire, the warm hands, the wildfire (js/sim/ignia.js)
  AURA_AB, // AURA - the falling star, the drifting light, the step, the curtain (js/sim/aura.js)
  SALVIA_AB, // SALVIA - the poultice, the snowdrops, the warm cloak, the thaw (js/sim/salvia.js)
  LUCERNA_AB, // LUCERNA - the crook, the lantern, the shoo, the circle of light (js/sim/lucerna.js)
  HIEMS_AB, // HIEMS - the icicle, the clear ice, the cold snap, the whiteout (js/sim/hiems.js)
  RUPES_AB, // RUPES - the heave, the shed, the shoulder, the avalanche (js/sim/rupes.js)
  VARRO_AB, // VARRO - the lunge, the howl, the snap, the pack (js/sim/varro.js)
  BUCINA_AB, // BUCINA - the blast, the note, the echo, the pines (js/sim/bucina.js)
  NIX_AB, // NIX - the shard, the cloud, the drift step, the squall (js/sim/nix.js)
  FABER_AB, // FABER - the spark, the small machine, the clockspring, the old engine (js/sim/faber.js)
  VELOX_AB, // VELOX - the skip stone, the ice lane, the quick step, the long run (js/sim/velox.js)
  FALCO_AB, // FALCO - the talons, the knife fan, the glide, the stoop (js/sim/falco.js)
  MARIS_AB, // MARIS - the harpoon, the brace, the undertow, the breach (js/sim/maris.js)
  LIGNUM_AB, // LIGNUM - the chop, the thrown axe, the bark skin, the timber (js/sim/lignum.js)
  SAGITTA_AB, // SAGITTA - the pin, the pavise, the crank back, the long bolt (js/sim/sagitta.js)
  CLIVUS_AB, // CLIVUS - the pick strike, the rope, the vault, the rope ring (js/sim/clivus.js)
  ARCUS_AB, // ARCUS - the volley, the twin nock, the gather, the full quiver (js/sim/arcus.js)
];
// every hero has a row of keys, and a bot knows how to use each one (its `bot`)
for (const c of CLASSES) {
  const row = CLASS_AB[heroIndex(c.name)];
  if (!row || row.length !== AB_KEYS || row.some((ab) => !ab.bot)) throw new Error('abilities.js: ' + c.name + ' needs ' + AB_KEYS + ' keys, each with a bot row');
}

// the shapes the abilities flash on the snow
const abFx = [];     // {kind: 'wedge'|'ring', x, y, a, r, half, t, col, fx?, life?} - where a blow landed, flashed for AB_FX_T (or `life`); `fx` names its own look (AB_FX_LOOK, js/draw/abilities.js)

// ---- levelling -----------------------------------------------------------
// Whether the key is bought at all (level 0 = locked: no cast, a dim well and
// a dim icon on the strip), can-buy or not (a point in hand, room on the
// key), the one entry point a buyer reaches through runCmd (HUD plate click
// and bots alike), and the effective cooldown the sim reads instead of the
// table's base. abUnlocked is the ONE gate - tryAbility and every bot that
// reaches for a key ask it, so a locked ability is dark for a player whoever
// is driving it.
function abUnlocked(p, i) { return p.abLv[i] > 0; }
// ---- what a key is ---------------------------------------------------------
// Every reader asks abOf(p, i) for the row on key i of this body; abKeyOf
// finds the key an ability id is standing on, or -1 when this hero has none.
function abOf(p, i) { return CLASS_AB[p.cls][i]; }
function abKeyOf(p, id) { for (let i = 0; i < AB_KEYS; i++) if (abOf(p, i).id === id) return i; return -1; }
function abReady(p, i) { return p.abLv[i] > 0 && p.abCd[i] <= 0; } // bought AND off cooldown: what a bot reaches for
// The rank ladder of key `i` carrying row `ab`: the hero level each rank
// waits for - the row's own `lvReq` when it names one, else the basic or the
// ultimate ladder - and so how many ranks the key holds.
function abReqOf(ab, i) { return ab.lvReq || (i === AB_ULT ? AB_ULT_LV : AB_RANK_LV); }
function abLvMax(p, i) { return abReqOf(abOf(p, i), i).length; }
function abLvCanBuy(p, i) {
  const req = abReqOf(abOf(p, i), i);
  return p.skillPts > 0 && p.abLv[i] < req.length && p.level >= req[p.abLv[i]];
}
// a ranked number at rank `lv`: a list is read at that rank (rank 0, a key
// not bought yet, reads as rank 1, what the first point would give), a plain
// number is the same at every rank
function rankAt(v, lv) { return Array.isArray(v) ? v[Math.max(0, Math.min(v.length - 1, lv - 1))] : v; }
// THE ONE READER of an ability's ranked numbers: `key` of the `rank` table on
// ability `id`, at the rank `p` holds it. Every use() reads its numbers here,
// so a rank point lands in every blow alike.
function abRk(p, id, key) {
  const i = p instanceof Player ? abKeyOf(p, id) : -1;
  const ab = i >= 0 ? abOf(p, i) : null;
  return ab ? rankAt(ab.rank[key], p.abLv[i]) : NaN;
}
function abCdOf(p, i) { return rankAt(abOf(p, i).cd, p.abLv[i]) * hasteMul(p); } // COOLDOWN SPEED (js/sim/stats.js)
// what ABILITY POWER adds to ability `id`'s blow: the stat times the ratio its
// entry carries (`ap`), nothing for one that has none or is not on a key
function abAp(p, id) {
  const i = p instanceof Player ? abKeyOf(p, id) : -1;
  return i < 0 ? 0 : statOf(p, 'ap') * (abOf(p, i).ap || 0);
}
// an ability's blow: its base and its ability power share, whole
function abDmg(p, id, base) { return Math.round(base + abAp(p, id)); }
function buyAbilityLv(p, i) {
  if (!abLvCanBuy(p, i)) { sfxFor(p, 'deny'); return p.skillPts > 0 ? 'max' : 'points'; }
  p.skillPts--;
  p.abLv[i]++;
  // the first point is the one that changes what you CAN do, so it says so;
  // every one after is a number going up
  const nm = abOf(p, i).name;
  const ink = p.abLv[i] === abLvMax(p, i) ? AB_LV_MATS[AB_LV_MATS.length - 1] : AB_LV_MATS[p.abLv[i] - 1]; // a full key is gold
  addFloater(p.x, p.y - 18, p.abLv[i] === 1 ? nm + ' UNLOCKED' : nm + ' ' + p.abLv[i], ink);
  burst(p.x, p.y - 8, ink, p.abLv[i] === 1 ? 14 : 8, p.abLv[i] === 1 ? 55 : 40, 0.45);
  sfxOwn(p, 'levelUp', 'pickup');
  return true;
}

// ---- casting -------------------------------------------------------------
// The press. Refused flat while the body is otherwise occupied; a row with a
// second half (`recast`) takes the key again as that half.
function tryAbility(p, i) {
  if (i < 0 || i >= AB_KEYS || p.dead || p.stunT > 0 || p.fallT > 0 ||
    p.dodgeT > 0 || p.castT > 0 || inAir(p) || p.zip >= 0) return; // a zipline's handle occupies the hands the way a cast does
  const ab = abOf(p, i);
  if (!ab) return;
  // a key nobody has spent a point on is not yours yet: the dim well already
  // says so, and the press reddens it the way a bit that will not fit reddens
  // the tool well (abDenied, js/ui.js)
  if (!abUnlocked(p, i)) { if (p === player) abDenied(i); return; }
  // THE SECOND HALF: the key again while its row's `recast` says so (the
  // brace up, a dash running). It is already paid for, so it waits on no
  // cooldown; a dash stops on the spot and the wind-up begins from there.
  if (abRecast(p, ab)) {
    if (ab.ok && !ab.ok(p)) { sfxFor(p, 'deny'); return; } // it may still need its target
    if (p.rushT > 0) dashStop(p);
    p.castSlam = true;
    startCast(p, i, RECAST_T);
    return;
  }
  if (p.rushT > 0) return; // every other key waits out the dash
  if (p.abCd[i] > 0) { sfxFor(p, 'deny'); return; }
  if (ab.ok && !ab.ok(p)) { sfxFor(p, 'deny'); return; } // a row that needs something the press lacks (a target near the aim)
  p.castSlam = false; // a fresh press is never a second half (one knocked out of the hands mid-cast must not linger)
  startCast(p, i, ab.cast);
}
// is the key pressed now its row's second half (castSlam)
function abRecast(p, ab) { return !!(ab.recast && ab.recast(p)); }
// the wind-up itself: the draw dropped, the body turned to the aim and the
// clock set. `t` is the cast's length - the row's, or the second half's
function startCast(p, i, t) {
  if (p.charging) { p.charging = false; p.chargeT = 0; }
  p.fireArmed = false;
  p.castAb = i;
  p.castT = t;
  p.castMax = t;
  faceToward(p, p.input.aimX - p.x, p.input.aimY - p.y, true);
  sfxAt('swing', p.x, p.y);
}
// how far through its wind-up a cast is, 0 at the press and 1 at the landing
function castProg(p) { return p.castT > 0 && p.castMax > 0 ? 1 - p.castT / p.castMax : 0; }

// per-player tick: cooldowns, the cast landing, and every timed state an
// ability leaves on a body. Called from updatePlayer once the player is alive.
function updateAbilities(p, dt) {
  for (let i = 0; i < AB_KEYS; i++) if (p.abCd[i] > 0) p.abCd[i] = Math.max(0, p.abCd[i] - dt);
  loadoutTick(p, dt); // the tricks' cooldowns and the calling's clocks (js/sim/loadout.js)
  // root / slow / net / mark / fire: the shared clock every kind of unit runs
  // (updateUnitStatus, js/sim/actions.js) - an animal and a bot age the
  // identical states off the identical timers
  updateUnitStatus(p, dt);
  if (p.dead) return; // a burn can finish a player mid-tick
  if (p.rootT > 0) p.sliding = false;
  if (p.buffT > 0) p.buffT = Math.max(0, p.buffT - dt); // a bear buff running out (campBuff, wildlife.js)
  if (p.pushT > 0) p.pushT = Math.max(0, p.pushT - dt); // ...and the orca buff (orcaPushMul)
  // the shield tracks the aim while it is up, and lowers itself on the timer
  if (p.shieldT > 0) {
    p.shieldT -= dt;
    p.shieldA = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
    faceToward(p, Math.cos(p.shieldA), Math.sin(p.shieldA));
    if (p.charging) { p.charging = false; p.chargeT = 0; }
    p.fireArmed = false;
    if (p.shieldT <= 0) abShieldDown(p, false);
  }
  // the cast: a short performance, then the effect fires at the aim the
  // caster is holding NOW - a bot tracking its target casts like a hand does
  if (p.castT > 0) {
    p.castT -= dt;
    aimHold(p); // the telegraph on every screen points where the hand does (aimAngle, js/draw/bodies.js)
    const ab = abOf(p, p.castAb);
    // a cast with a telegraph on the snow keeps facing the aim the whole
    // wind-up - a dash's line, a bash's wedge - so the shape and the body
    // agree about where this is going, and what lands is what was shown
    if (ab && (ab.tele || (ab.wall && p.castSlam))) {
      faceToward(p, p.input.aimX - p.x, p.input.aimY - p.y);
    }
    if (p.castT <= 0) {
      const i = p.castAb;
      p.castAb = -1;
      p.castT = 0;
      p.abCd[i] = abCdOf(p, i);
      const ab = abOf(p, i);
      heroAbNow = ab.id; // a blow the key lands says which key (passiveDeal, js/sim/heroes.js)
      ab.use(p);
      heroAbNow = '';
      itemsOnCast(p); // SURGE arms the next basic attack (js/sim/items.js)
      passiveCast(p); // a hero's passive that answers a key landing (HERO_PASSIVE, js/sim/heroes.js)
    }
  }
  passiveTick(p, dt);
  // a timed shield running out (shieldTick, js/sim/actions.js)
  shieldTick(p, dt);
}

// every movement cap an ability is allowed to touch, in one multiplier: the
// root pins, a cast and a raised shield slow, a slow drags. updatePlayer
// applies it to the walk cap and the ice cap alike.
function abilityMoveMul(p) {
  if (p.rootT > 0) return 0;
  let m = 1;
  if (p.castT > 0) m *= 0.5; // a cast halves the walk
  if (p.shieldT > 0) m *= 0.4;
  if (p.slowT > 0) m *= p.slowMul;
  m *= statBuffMul(p, 'ms'); // a bear buff (campBuff, wildlife.js; js/sim/stats.js)
  m *= heroMove(p); // a hero's own (HERO_MOVE, js/sim/heroes.js)
  return m;
}

// ---- the shield and the dash ----------------------------------------------
// THE SHIELD: `shieldT` is a raised shield's seconds left and `shieldA` where
// it faces (updateAbilities turns it with the aim); ARMATOS's brace rides it
// (abHold, js/sim/armatos.js). Down on the timer, by its second half, or
// knocked down by a stun: the cooldown starts HERE, so holding it the full
// stretch and spending it at once cost the same.
function abShieldDown(p, early) {
  if (p.shieldT <= 0 && !early) return;
  p.shieldT = 0;
  const i = p.hold ? abKeyOf(p, 'hold') : -1;
  p.hold = false; p.holdHit = false;
  if (i >= 0) p.abCd[i] = abCdOf(p, i);
  sfxAt('pickup', p.x, p.y);
}
// THE DASH: a hero's charge rides `rushT` and its line (rushNX/NY) at the pace
// its HERO_DASH row gives (playerMove, js/sim/sim.js; js/sim/heroes.js). A key's
// second half pressed mid-dash stops it where it is, with a little of its way
// still in the feet.
function dashStop(p) {
  p.rushT = 0;
  p.dash = '';
  p.vx = p.rushNX * 60; p.vy = p.rushNY * 60;
}

// the practice dummy takes area hits like everything else: any dummy tile
// whose base is inside the circle rings the meter
function abHitDummies(x, y, r, dmg) {
  const tx0 = Math.floor((x - r) / TILE), tx1 = Math.floor((x + r) / TILE);
  const ty0 = Math.floor((y - r) / TILE), ty1 = Math.floor((y + r) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!inWorld(tx, ty)) continue;
    const o = objects[idx(tx, ty)];
    if (o && o.type === 'dummy' && Math.hypot(tx * TILE + 8 - x, ty * TILE + 8 - y) <= r + 8) {
      hitDummy(o, dmg, tx * TILE + 8, ty * TILE - 4);
    }
  }
}

// ---- the world tick ------------------------------------------------------
// Everything the abilities left lying in the world, stepped once per sim
// step from updatePlay: the flashes age, and each hero's own (HERO_TICK).
// (A piercing shot rides the arrows array, js/sim/sim.js.)
function updateAbilityWorld(dt) {
  for (let i = abFx.length - 1; i >= 0; i--) {
    abFx[i].t += dt;
    if (abFx[i].t >= (abFx[i].life || AB_FX_T)) abFx.splice(i, 1); // a key's own look may last longer (`life`)
  }
  heroTick(dt); // what the heroes leave in the world: ARMATOS's standards (HERO_TICK, js/sim/heroes.js)
}

// how far a telegraphed line runs out along (nx, ny) before the world stops it
function teleLen(x0, y0, nx, ny, range) {
  for (let s = 10; s < range; s += 4) {
    if (isSolidTile(Math.floor((x0 + nx * s) / TILE), Math.floor((y0 + ny * s) / TILE))) return s;
  }
  return range;
}
