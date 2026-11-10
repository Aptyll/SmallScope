'use strict';
// ------------------------------------------------------------ loadout
// THE PRE-GAME PICKS, League's runes and summoner spells kept to three picks
// so a new player can read them: one CALLING (the keystone: a passive that
// says what kind of fighter you are) and two TRICKS (two actives on their own
// keys, each on a long cooldown). They are picked on the champ select beside
// LOCK IN (js/ui/loadout.js), remembered per hero by the profile, and carried
// into the match as `p.loadout` ({ tricks: [id, id], calling: id }), which
// the snapshot carries to every screen like any other body field.
//
// Nothing here is magic: a trick is a thing a person carries or does (a
// bandage, a torch, a pair of bolas, a sprint) and a calling is the person it
// makes you (lore.md: a perk is named for the person it makes you). There is
// no FLASH: the dodge roll is already everybody's.
//
// Every effect goes through the shared functions: hurtUnit, the status
// setters (slowUnit, igniteUnit, cutHeal, weakenUnit, shieldUnit),
// healPlayer, seenAt, and the hero hooks (HERO_STAT, HERO_MOVE, HERO_TEN),
// so a trick on a bot, a stealthed rival or the other side is handled where
// every other blow is. Draws no rng() of its own.
//
// Numbers are sized to this game's scale (a level-1 hero has about 100
// health; League's has about 600): each trick is League's spell at about the
// same share of a body.

// ---- the tricks -----------------------------------------------------------
const TRICK_N = 2;            // tricks a body carries
const TRICK_REACH = 96;       // px: how far a trick aimed at a rival hero reaches (TORCH, BOLAS)
const TRICK_ALLY_R = 96;      // px: BANDAGE finds the most hurt ally within this
const CLEAVER_REACH = 44;     // px: CLEAVER's reach to a beast or a soldier, past the body's own edge
const SPRINT_T = 6, SPRINT_MUL = 1.35;      // SPRINT: this long, this much faster
const BANDAGE_RUN_T = 1.5, BANDAGE_RUN_MUL = 1.3; // BANDAGE: the quick step after it, on both bodies
const SHAKE_T = 2, SHAKE_TEN = 0.5;         // SHAKE OFF: for this long after, every hold lasts half
const TORCH_T = 5;            // TORCH: the burn's length, and the heal cut's
const BOLAS_T = 2.5, BOLAS_SLOW = 0.6;      // BOLAS: tangled this long, at this share of the walk...
const WEAK_MUL = 0.7;         // ...and every blow the tangled body lands is worth this share (weakenUnit)
const TORCH_CUT = 0.4;        // TORCH: the share of every heal its target loses (cutHeal, js/sim/actions.js)

// What each trick IS: its name, the one line its card prints, its cooldown in
// seconds, the reach a hover shows, whether a stun lets it through (`free`),
// and use(p) -> true when it went off (false: nothing to use it on, and the
// cooldown is not spent). `pow(p)` is the number it scales with the level,
// shown on its card.
const TRICKS = {
  bandage: { name: 'BANDAGE', cd: 150, line: 'HEAL YOU AND THE MOST HURT ALLY NEAR YOU',
    pow: (p) => 10 + 2.5 * p.level, use: trickBandage },
  torch: { name: 'TORCH', cd: 120, line: 'SET A NEAR RIVAL HERO ALIGHT. THEY HEAL LESS', reach: TRICK_REACH,
    pow: (p) => Math.round((2 + 0.5 * p.level) * TORCH_T), use: trickTorch },
  bolas: { name: 'BOLAS', cd: 150, line: 'TANGLE A NEAR RIVAL HERO: SLOWER AND WEAKER', reach: TRICK_REACH,
    pow: () => Math.round((1 - WEAK_MUL) * 100), use: trickBolas },
  bulwark: { name: 'BULWARK', cd: 120, line: 'A SHIELD FOR A MOMENT',
    pow: (p) => Math.round(12 + 2.5 * p.level), use: trickBulwark },
  sprint: { name: 'SPRINT', cd: 120, line: 'RUN FASTER FOR A WHILE',
    pow: () => Math.round((SPRINT_MUL - 1) * 100), use: trickSprint },
  shake: { name: 'SHAKE OFF', cd: 150, free: true, line: 'BREAK FREE OF EVERY HOLD AND FIRE',
    pow: () => Math.round(SHAKE_TEN * 100), use: trickShake },
  cleaver: { name: 'CLEAVER', cd: 45, line: 'A HEAVY CUT ON A BEAST OR A SOLDIER', reach: CLEAVER_REACH,
    pow: (p) => 30 + 10 * p.level, use: trickCleaver },
};
const TRICK_IDS = Object.keys(TRICKS);

// ---- the callings ---------------------------------------------------------
const DUELIST_HITS = 3, DUELIST_WINDOW = 4, DUELIST_T = 5, DUELIST_MUL = 1.12; // DUELIST: 3 basic hits on one hero inside 4 s: 12% more from you for 5 s
const AMBUSH_HITS = 3, AMBUSH_WINDOW = 3, AMBUSH_CD = 20;          // AMBUSHER: 3 separate hits on one hero inside 3 s: a burst, once every 20 s
const STALWART_CD = 4, STALWART_DMG = 0.04, STALWART_HEAL = 0.02;  // STALWART: in a fight, every 4 s the next basic hit on a hero adds 4% of your health, heals 2%
const QUICK_STACK = 0.06, QUICK_MAX = 5, QUICK_T = 4;              // QUICKHAND: each basic hit on a hero, 6% attack speed for 4 s, up to 5 times
const OUTRIDE_HITS = 3, OUTRIDE_WINDOW = 3, OUTRIDE_T = 2.5, OUTRIDE_MUL = 1.3, OUTRIDE_CD = 10; // OUTRIDER: 3 hits on a hero inside 3 s: 30% faster for 2.5 s
const WARDEN_R = 80, WARDEN_T = 1.5, WARDEN_CD = 25;               // WARDEN: an ally this close is struck by a hero: a shield on both of you

// What each calling IS: its name, its one line, the style it suits (the
// picker's order), and pow(p) for its card's number.
const CALLINGS = {
  duelist: { name: 'DUELIST', line: 'THREE HITS IN A ROW ON A HERO: THEY TAKE MORE FROM YOU',
    pow: () => Math.round((DUELIST_MUL - 1) * 100) },
  ambusher: { name: 'AMBUSHER', line: 'THREE QUICK HITS ON A HERO: A HARD EXTRA BLOW',
    pow: (p) => Math.round(8 + 1.5 * p.level + (p instanceof Player ? 0.4 * statOf(p, 'ap') : 0)) },
  stalwart: { name: 'STALWART', line: 'IN A FIGHT, NOW AND THEN A HIT ON A HERO HURTS MORE AND HEALS YOU',
    pow: (p) => Math.round(p.maxHp * STALWART_DMG) },
  quickhand: { name: 'QUICKHAND', line: 'EACH HIT ON A HERO: FASTER ATTACKS FOR A WHILE',
    pow: () => Math.round(QUICK_STACK * QUICK_MAX * 100) },
  outrider: { name: 'OUTRIDER', line: 'THREE QUICK HITS ON A HERO: A BURST OF SPEED',
    pow: () => Math.round((OUTRIDE_MUL - 1) * 100) },
  warden: { name: 'WARDEN', line: 'AN ALLY NEAR YOU IS STRUCK BY A HERO: YOU BOTH TAKE A SHIELD',
    pow: (p) => Math.round(8 + 2 * p.level) },
};
const CALLING_IDS = Object.keys(CALLINGS);

// ---- defaults --------------------------------------------------------------
// A seat's tricks off its position (POSITIONS order: TOP, JUNGLE, MID, BOT,
// SUPPORT), League's usual pairs with the roll standing in for FLASH; a
// hero's calling off its kind. A bot flies with these, and a person's first
// pick of a hero opens on them.
const TRICKS_BY_POS = [['sprint', 'torch'], ['cleaver', 'sprint'], ['torch', 'bulwark'], ['bandage', 'bulwark'], ['bandage', 'bolas']];
const TRICKS_ANY = ['sprint', 'bandage'];
const CALLING_OF = {
  VELOX: 'quickhand', SAGITTA: 'quickhand',
  FORTIVA: 'duelist', BELLA: 'duelist', CLIVUS: 'duelist',
  ARMATOS: 'stalwart', RUPES: 'stalwart', MARIS: 'stalwart',
  IGNIA: 'warden', SALVIA: 'warden', LUCERNA: 'warden', BUCINA: 'warden',
  AURA: 'ambusher', HIEMS: 'ambusher', FABER: 'ambusher', NIX: 'ambusher', FALCO: 'ambusher',
  VARRO: 'outrider', LIGNUM: 'outrider',
};
function callingFor(cls) {
  const c = CLASSES[cls];
  return (c && CALLING_OF[c.name]) || (c && c.attack && c.attack.shot ? 'quickhand' : 'duelist');
}
function loadoutDefault(cls, pos) {
  return { tricks: (TRICKS_BY_POS[pos] || TRICKS_ANY).slice(), calling: callingFor(cls) };
}
// any record made whole: two different known tricks and a known calling,
// whatever is missing or unknown taken from the default (a profile's, a
// guest's word over the wire, a save)
function loadoutClean(lo, cls, pos) {
  const d = loadoutDefault(cls, pos), out = { tricks: [], calling: d.calling };
  const want = lo && Array.isArray(lo.tricks) ? lo.tricks : [];
  for (let i = 0; i < TRICK_N; i++) {
    const t = String(want[i] || '');
    out.tricks.push(TRICKS[t] && !out.tricks.includes(t) ? t : null);
  }
  for (let i = 0; i < TRICK_N; i++) if (!out.tricks[i]) out.tricks[i] = d.tricks.concat(TRICK_IDS).find((t) => !out.tricks.includes(t));
  if (lo && CALLINGS[lo.calling]) out.calling = lo.calling;
  return out;
}
// the wire's and the profile's short form: "bandage,torch,warden"
function loadoutStr(lo) { return lo.tricks.join(',') + ',' + lo.calling; }
function loadoutParse(s) { const a = String(s || '').split(','); return { tricks: [a[0], a[1]], calling: a[2] }; }

// Every seat's picks for the match, as it flies out (beginDrop): this
// screen's own from the profile, a guest's as its draft word left it, a bot's
// off its seat and hero. Every one is made whole.
function loadoutStart(p) {
  const lo = p === player && isHuman(p) ? PROFILE.loadout(CLASSES[p.cls].name)
    : isHuman(p) ? p.loadout : loadoutDefault(p.cls, p.position);
  p.loadout = loadoutClean(lo, p.cls, p.position);
  p.trickCd = [0, 0];
  p.ks = ksBlank();
}
function trickOf(p, i) { return p.loadout && TRICKS[p.loadout.tricks[i]] ? p.loadout.tricks[i] : null; }
function callingOf(p) { return p.loadout && CALLINGS[p.loadout.calling] ? p.loadout.calling : null; }

// ---- using a trick ---------------------------------------------------------
// The press (playerIntents, js/sim/sim.js): refused while the body cannot act
// (a stun lets only a `free` trick through), on cooldown, or when use() finds
// nothing to use it on - a refusal costs nothing. Cooldown speed does not
// shorten a trick (League's summoner spells are their own clock).
function trickBusy(p, free) {
  return p.dead || inAir(p) || p.fallT > 0 || p.zip >= 0 || (!free && (p.stunT > 0 || p.upT > 0));
}
function tryTrick(p, i) {
  const id = trickOf(p, i), T = id && TRICKS[id];
  if (!T || p.trickCd[i] > 0 || trickBusy(p, T.free)) { if (p === player && T) trickDenied(i); return false; }
  if (!T.use(p)) { if (p === player) trickDenied(i); return false; }
  p.trickCd[i] = T.cd;
  breakRecall(p); // a trick is the body doing something: the walk home ends (js/sim/recall.js)
  return true;
}
// the clocks, once a step for every body (updateAbilities, js/sim/abilities.js)
function loadoutTick(p, dt) {
  if (p.trickCd) for (let i = 0; i < TRICK_N; i++) if (p.trickCd[i] > 0) p.trickCd[i] = Math.max(0, p.trickCd[i] - dt);
  if (p.sprintT > 0) p.sprintT = Math.max(0, p.sprintT - dt);
  if (p.runT > 0) p.runT = Math.max(0, p.runT - dt);
  if (p.shakeT > 0) p.shakeT = Math.max(0, p.shakeT - dt);
  const k = p.ks;
  if (!k) return;
  if (k.t > 0) { k.t = Math.max(0, k.t - dt); if (k.t <= 0) { k.n = 0; k.foe = -1; } }
  if (k.on > 0) k.on = Math.max(0, k.on - dt);
  // STALWART charges only while the body is in a fight (fightT, js/sim/items.js)
  if (k.cd > 0 && (callingOf(p) !== 'stalwart' || p.fightT > 0)) k.cd = Math.max(0, k.cd - dt);
}
// the rival hero nearest the aim inside `reach` of the caster that its side can see
function trickFoe(p, reach) {
  let best = null, bd = Infinity;
  for (const q of players) {
    if (!(q instanceof Player) || !q.active || inAir(q) || !unitFoe(p, q) || unitTeam(q) < 0) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d > reach || d > seenAt(q, reach, p.team)) continue;
    const da = Math.hypot(q.x - p.input.aimX, q.y - p.input.aimY);
    if (da < bd) { bd = da; best = q; }
  }
  return best;
}
function trickBandage(p) {
  const n = TRICKS.bandage.pow(p);
  let ally = null, low = 1;
  for (const q of players) {
    if (q === p || !q.active || q.dead || inAir(q) || q.team !== p.team) continue;
    if (Math.hypot(q.x - p.x, q.y - p.y) > TRICK_ALLY_R) continue;
    const s = q.hp / q.maxHp;
    if (s < low) { low = s; ally = q; }
  }
  for (const q of ally ? [p, ally] : [p]) {
    healPlayer(q, n);
    q.runT = BANDAGE_RUN_T;
    burst(q.x, q.y - 8, '#8fe39a', 10, 40, 0.6, -20);
  }
  sfxAt('heal', p.x, p.y);
  return true;
}
function trickTorch(p) {
  const e = trickFoe(p, TRICK_REACH);
  if (!e) return false;
  igniteUnit(e, TORCH_T, 2 + 0.5 * p.level, p);
  cutHeal(e, TORCH_T, TORCH_CUT);
  noteFoe(e, p);
  burst(e.x, unitMidY(e), '#ffb24a', 10, 60, 0.5);
  sfxAt('swing', p.x, p.y);
  return true;
}
function trickBolas(p) {
  const e = trickFoe(p, TRICK_REACH);
  if (!e) return false;
  slowUnit(e, BOLAS_T, BOLAS_SLOW);
  weakenUnit(e, BOLAS_T);
  ccCredit(e, 0, BOLAS_T, p);
  burst(e.x, e.y - 2, '#c8b48a', 8, 40, 0.4);
  sfxAt('swing', p.x, p.y);
  return true;
}
function trickBulwark(p) {
  shieldUnit(p, TRICKS.bulwark.pow(p), 2.5, 'bulwark');
  burst(p.x, p.y - 8, '#cfd8e8', 10, 40, 0.45);
  sfxAt('place', p.x, p.y);
  return true;
}
function trickSprint(p) {
  p.sprintT = SPRINT_T;
  burst(p.x, p.y, '#e8eef6', 8, 50, 0.35);
  sfxAt('dodge', p.x, p.y);
  return true;
}
function trickShake(p) {
  p.stunT = 0; p.stunMax = 0; p.rootT = 0; p.slowT = 0; p.slowMul = 1;
  p.weakT = 0;
  douseUnit(p);
  p.shakeT = SHAKE_T;
  burst(p.x, p.y - 8, '#ffffff', 12, 60, 0.4);
  sfxAt('unlock', p.x, p.y);
  return true;
}
function trickCleaver(p) {
  let best = null, bd = Infinity;
  for (const e of unitsNear(p, p.x, p.y, CLEAVER_REACH + 20)) {
    if (e instanceof Player || e.merchant || e.summon && unitTeam(e) === p.team) continue;
    const r = (e.r || 6) + CLEAVER_REACH;
    if (Math.hypot(e.x - p.x, e.y - p.y) > r) continue;
    const da = Math.hypot(e.x - p.input.aimX, e.y - p.input.aimY);
    if (da < bd) { bd = da; best = e; }
  }
  if (!best) return false;
  const d = Math.hypot(best.x - p.x, best.y - p.y) || 1;
  hurtUnit(best, TRICKS.cleaver.pow(p), (best.x - p.x) / d, (best.y - p.y) / d, p, { kb: 10, cause: 'cleaver' });
  burst(best.x, unitMidY(best), '#e8eef6', 10, 70, 0.4);
  sfxAt('chop', best.x, best.y);
  return true;
}

// ---- the callings at the blow -----------------------------------------------
// hurtUnit's hooks: loadoutDeal before a blow lands (DUELIST's mark, a
// tangled striker), loadoutOnHit after a player lands one, loadoutOnHurt
// after a player takes one (WARDEN).
function loadoutDeal(src, e, dmg, o) {
  if (!src || o.type === 'burn') return dmg;
  if (src.weakT > 0) dmg *= WEAK_MUL; // BOLAS: a tangled body strikes weaker, whatever it strikes with
  if (src instanceof Player && src.ks && src.ks.on > 0 && callingOf(src) === 'duelist' && e === players[src.ks.mark]) dmg *= DUELIST_MUL;
  return Math.round(dmg);
}
// a hit count on one rival hero inside a window: the count after this hit
// (once a step, so a blow that lands three times at once counts as one)
function ksCount(k, e, window) {
  if (k.foe === e.id && k.t > 0) { if (k.tick !== state.tick) k.n++; } else { k.foe = e.id; k.n = 1; }
  k.tick = state.tick; k.t = window;
  return k.n;
}
function loadoutOnHit(src, e, o, dmg) {
  if (!(e instanceof Player) || e === src || src.team === e.team || o.type === 'burn' || o.thorns || o.ks) return;
  const k = src.ks, c = callingOf(src);
  if (!k || !c) return;
  if (c === 'duelist' && o.basic && ksCount(k, e, DUELIST_WINDOW) >= DUELIST_HITS) {
    k.n = 0; k.on = DUELIST_T; k.mark = e.id;
    burst(e.x, unitMidY(e), '#ffd84a', 8, 50, 0.4);
  } else if (c === 'ambusher' && k.cd <= 0 && ksCount(k, e, AMBUSH_WINDOW) >= AMBUSH_HITS) {
    k.n = 0; k.cd = AMBUSH_CD;
    hurtUnit(e, CALLINGS.ambusher.pow(src), 0, 0, src, { kb: 0, ks: true, cause: 'ambusher' });
    burst(e.x, unitMidY(e), '#c2a6ff', 12, 70, 0.45);
  } else if (c === 'stalwart' && o.basic && k.cd <= 0) {
    k.cd = STALWART_CD;
    hurtUnit(e, Math.round(src.maxHp * STALWART_DMG), 0, 0, src, { kb: 0, ks: true, cause: 'stalwart' });
    healPlayer(src, src.maxHp * STALWART_HEAL);
    burst(e.x, unitMidY(e), '#8fe39a', 8, 50, 0.4);
  } else if (c === 'quickhand' && o.basic) {
    k.n = Math.min(QUICK_MAX, (k.t > 0 ? k.n : 0) + 1); k.t = QUICK_T;
  } else if (c === 'outrider' && k.cd <= 0 && ksCount(k, e, OUTRIDE_WINDOW) >= OUTRIDE_HITS) {
    k.n = 0; k.cd = OUTRIDE_CD; k.on = OUTRIDE_T;
    burst(src.x, src.y, '#e8eef6', 8, 50, 0.35);
  }
}
function loadoutOnHurt(e, src, dmg, o) {
  if (!(src instanceof Player) || src.team === e.team || !(dmg > 0) || o.type === 'burn' || o.thorns) return;
  for (const w of players) {
    if (!w.active || w.dead || w.team !== e.team || callingOf(w) !== 'warden' || !w.ks || w.ks.cd > 0) continue;
    if (Math.hypot(w.x - e.x, w.y - e.y) > WARDEN_R) continue;
    const s = CALLINGS.warden.pow(w);
    w.ks.cd = WARDEN_CD;
    for (const q of w === e ? [w] : [w, e]) { shieldUnit(q, s, WARDEN_T, 'warden'); burst(q.x, q.y - 8, '#f2cc6a', 8, 40, 0.4); }
    sfxAt('place', e.x, e.y);
  }
}
// the fresh state a body's calling keeps, made at the match's start and kept
// across deaths (a League keystone's clocks run on through a respawn)
function ksBlank() { return { foe: -1, n: 0, t: 0, tick: -1, on: 0, mark: -1, cd: STALWART_CD }; }

// ---- into the shared hooks (js/sim/heroes.js) ----------------------------------
HERO_STAT.push({ name: 'QUICKHAND', add: (p, key) => key === 'as' && p.ks && p.ks.t > 0 && callingOf(p) === 'quickhand' ? p.ks.n * QUICK_STACK : 0 });
HERO_MOVE.push((p) => (p.sprintT > 0 ? SPRINT_MUL : 1) * (p.runT > 0 ? BANDAGE_RUN_MUL : 1) *
  (p.ks && p.ks.on > 0 && callingOf(p) === 'outrider' ? OUTRIDE_MUL : 1));
HERO_TEN.push((e) => e.shakeT > 0 ? SHAKE_TEN : 0);

// ---- bots ---------------------------------------------------------------------
// When a bot reaches for a trick: each reads the moment the way a person
// would. The aim is already on its foe (the skill layer), so a trick aimed at
// a rival takes whoever the bot is fighting. Called once a think (updateAI).
const AI_TRICK_LOW = 0.3;     // share of health under which a bot heals, shields or runs
function aiTricks(p) {
  if (p.dead || inAir(p) || !p.loadout || p.input.trick >= 0) return;
  const foe = p.ai && p.ai.foeId >= 0 ? players[p.ai.foeId] : null;
  const fd = foe && !foe.dead ? Math.hypot(foe.x - p.x, foe.y - p.y) : Infinity;
  const low = p.hp < p.maxHp * AI_TRICK_LOW;
  const want = {
    bandage: () => low || players.some((q) => q !== p && q.team === p.team && !q.dead && q.active && q.hp < q.maxHp * AI_TRICK_LOW && Math.hypot(q.x - p.x, q.y - p.y) < TRICK_ALLY_R),
    torch: () => fd < TRICK_REACH * 0.9 && foe.hp < foe.maxHp * 0.45,
    bolas: () => fd < TRICK_REACH * 0.9 && (low || foe.hp < foe.maxHp * 0.4),
    bulwark: () => low && fd < 140,
    sprint: () => (low && fd < 160) || (fd < 200 && fd > 70 && foe.hp < foe.maxHp * 0.25),
    shake: () => (p.stunT > 0.6 || p.rootT > 0.6 || (p.slowT > 1 && p.slowMul < 0.6)) && fd < 200,
    cleaver: () => {
      for (const e of unitsNear(p, p.x, p.y, CLEAVER_REACH + 20)) {
        if (e instanceof Player || e.merchant) continue;
        if (e.hp <= TRICKS.cleaver.pow(p) && (e.maxHp || 0) >= 200) return true; // a bear's last hit
      }
      return false;
    },
  };
  for (let i = 0; i < TRICK_N; i++) {
    const id = trickOf(p, i);
    if (!id || p.trickCd[i] > 0 || !want[id]()) continue;
    if (id === 'cleaver') { // aim the cut at the beast it means
      const b = unitsNear(p, p.x, p.y, CLEAVER_REACH + 20).find((e) => !(e instanceof Player) && !e.merchant && e.hp <= TRICKS.cleaver.pow(p));
      if (b) { p.input.aimX = b.x; p.input.aimY = b.y; }
    }
    p.input.trick = i;
    return;
  }
}
