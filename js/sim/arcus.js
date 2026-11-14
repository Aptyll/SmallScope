'use strict';
// ARCUS, THE FLETCHER - a named hero (CLASSES, js/sim/player.js) and the
// planted marksman: a longbow, quick on the string, and no way out of a dive.
// His arrows stay in the snow where they fall, and he turns them back into
// speed: walking over one pulls it up and quickens his draw. He looses a fan of
// five, nocks two at a time, calls every stuck arrow back through whoever stands
// between, and rains a full quiver on a far spot. He made the empire's arrows
// and broke a cartload of them rather than send them against a town.
// Loaded before abilities.js, whose CLASS_AB takes ARCUS_AB as his row of keys;
// he registers into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ arcus

// ---- tuning --------------------------------------------------------------
// WASTE NOTHING (the passive): a basic arrow that hits a rival hero, and every
// arrow of his keys, sticks in the snow where it ends. He alone pulls one up,
// by walking over it: a stack of attack speed for a while, a fresh one
// refreshing the clock.
const SHAFT_LIFE = 6;           // s an arrow stands in the snow
const SHAFT_MAX = 14;           // his arrows standing at once: the oldest goes
const SHAFT_PAST = 16;          // px past a hero it hit that the arrow lands
const SHAFT_PICK_R = 11;        // px from his feet he pulls one up
const WASTE_AS = 0.07;          // attack speed share per stack
const WASTE_MAX = 5;            // stacks at most
const WASTE_T = 4;              // s the stacks hold
// Q VOLLEY: five arrows in a fan; a second arrow of the same volley on one body
// lands for a share
const VOLLEY_N = 5;
const VOLLEY_HALF = 0.26;       // rad from the aim to the outer arrow
const VOLLEY_SPD = 430;         // px/s
const VOLLEY_RANGE = 220;       // px
const VOLLEY_MORE = 0.4;        // a body's second and later arrow x this
// W TWIN NOCK: for a while each basic arrow is loosed with a second beside it
const TWIN_T = 5;               // s
const TWIN_SIDE = 7;            // px between the pair, which straddles the aim
// E GATHER UP: every arrow of his standing in the snow flies back to where he
// stands, through every rival between; one struck by three of them is slowed
const GATHER_SPD = 520;         // px/s
const GATHER_SLOW = 0.6;        // walk x this...
const GATHER_SLOW_T = 1.5;      // ...for this long
const GATHER_N = 3;             // arrows on one body that slow it
// R FULL QUIVER: a far spot is rained on, arrow by arrow, each one a small blow
// and a slow where it lands, and each one left standing in the snow
const RAIN_RANGE = 360;         // px from him the spot's middle may be set
const RAIN_R = 44;              // px round the spot the arrows fall
const RAIN_N = 12;              // arrows
const RAIN_T = 1.8;             // s from the first landing to the last
const RAIN_FALL = 0.3;          // s an arrow is seen falling before it lands
const RAIN_HIT = 13;            // px round a landing it hits
const RAIN_SLOW = 0.75;         // walk x this...
const RAIN_SLOW_T = 0.6;        // ...for this long

const arcusShafts = []; // {x, y, ang, team, owner, t} - his arrows standing in the snow
const arcusRains = [];  // {x, y, team, owner, t, n, dmg} - FULL QUIVER falling on a spot

// ---- the keys ---------------------------------------------------------------
// His row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const ARCUS_AB = [
  {
    id: 'volley', name: 'VOLLEY', cd: [9, 8.5, 8, 7.5, 7], ap: 0.5, cast: 0.15, aim: { cone: VOLLEY_RANGE, half: VOLLEY_HALF }, aimHeld: true,
    rank: { dmg: [40, 60, 80, 100, 120] }, // dmg: each arrow (a body's second and later for VOLLEY_MORE)
    tip: 'FIVE ARROWS IN A FAN',
    blurb: 'LOOSE FIVE ARROWS IN A FAN. EACH HITS THE FIRST BODY IN ITS WAY; MORE THAN ONE ON THE SAME RIVAL HIT FOR LESS. EVERY ARROW STAYS IN THE SNOW.',
    use: (p) => arcusVolley(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawVolleyTele(p, a, closing, ex, ey), // five arrows fanned on the string (js/draw/arcus.js)
    pose: () => ({ dx: 0, dy: 0, rot: 0 }),
    icon: ARCUS_ICON32.volley,
    bot: (p, foe, d, clear) => d < VOLLEY_RANGE - 20 && (clear || foe instanceof Player), // a fan: a soldier in the way takes one, the rest fly on
  },
  {
    id: 'twin', name: 'TWIN NOCK', cd: [14, 13, 12, 11, 10], cast: 0.05,
    rank: { share: [0.5, 0.6, 0.7, 0.8, 0.9] }, // share: the second arrow's damage x this
    tip: 'FOR A WHILE, EVERY SHOT IS TWO ARROWS',
    blurb: 'FOR A FEW SECONDS EVERY BASIC SHOT LOOSES TWO ARROWS SIDE BY SIDE. THE SECOND HITS FOR A SHARE OF THE FIRST.',
    use: (p) => arcusTwin(p),
    pose: () => ({ dx: 0, dy: -1, rot: 0 }),
    icon: ARCUS_ICON32.twin,
    bot: (p, foe, d) => foe instanceof Player && d < 250,
  },
  {
    id: 'gather', name: 'GATHER UP', cd: [12, 11, 10, 9, 8], ap: 0.3, cast: 0.2,
    rank: { dmg: [30, 45, 60, 75, 90] }, // dmg: each arrow coming back
    tip: 'CALL YOUR ARROWS BACK THROUGH RIVALS',
    blurb: 'EVERY ARROW OF YOURS IN THE SNOW FLIES BACK TO YOU, HITTING EACH RIVAL ON ITS WAY. THREE ON ONE RIVAL SLOW THEM. EACH ONE BACK IS PULLED UP.',
    use: (p) => arcusGather(p),
    ok: (p) => arcusShaftsOf(p) > 0, // nothing in the snow, nothing to call
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawGatherTele(p, closing, now, ex, ey), // each arrow of his stirring toward him
    pose: () => ({ dx: 0, dy: 1, rot: 0 }),
    icon: ARCUS_ICON32.gather, mark: 'slow',
    bot: (p, foe) => foe instanceof Player && arcusGatherHits(p, foe) >= 2,
  },
  {
    id: 'quiver', name: 'FULL QUIVER', cd: [100, 85, 70], ap: 0.25, cast: 0.3, aim: { ring: RAIN_RANGE },
    rank: { dmg: [40, 60, 80] }, // dmg: each arrow that lands
    tip: 'RAIN ARROWS ON A FAR SPOT',
    blurb: 'LOOSE A FULL QUIVER HIGH. ARROW BY ARROW IT FALLS ON A FAR SPOT, EACH ONE HITTING AND SLOWING WHAT IT LANDS ON. EVERY ARROW STAYS IN THE SNOW.',
    use: (p) => arcusQuiver(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawQuiverTele(p, px, py, arcusSpot(p), closing, now, ex, ey), // loosed high; the shadows gathering where they fall
    pose: () => ({ dx: 0, dy: -2, rot: 0 }), // the bow raised high
    icon: ARCUS_ICON32.quiver, mark: 'slow',
    bot: (p, foe, d) => foe instanceof Player && d > 60 && d < RAIN_RANGE && (foe.hp < foe.maxHp * 0.7 || arcusFoesNear(p, foe) >= 2),
    botAim: (p, foe) => ({ x: foe.x + (foe.vx || 0) * 0.5, y: foe.y + (foe.vy || 0) * 0.5 }), // where they are walking to
  },
];

function isArcus(p) { return p instanceof Player && CLASSES[p.cls].passive === 'wastenothing'; }
// the caster of something he left in the world, while it is still his to credit
function arcusSrc(w) { const o = players[w.owner]; return o && o.team === w.team ? o : null; }
function arcusShaftsOf(p) { let n = 0; for (const s of arcusShafts) if (s.owner === p.id && s.team === p.team) n++; return n; }

// ---- WASTE NOTHING ---------------------------------------------------------------
// An arrow comes to rest in the snow at (x, y), facing `ang` as it flew: only on
// open ground (never in a tree, a wall or water), and the oldest of his goes past SHAFT_MAX.
function arcusDrop(owner, team, x, y, ang) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (!inWorld(tx, ty) || isSolidTile(tx, ty) || waterAt(tx, ty)) return;
  let n = 0, old = -1;
  for (let i = 0; i < arcusShafts.length; i++) if (arcusShafts[i].owner === owner) { n++; if (old < 0) old = i; }
  if (n >= SHAFT_MAX && old >= 0) arcusShafts.splice(old, 1);
  arcusShafts.push({ x, y, ang, team, owner, t: 0 });
}
// a stack of speed: what one arrow pulled up is worth
function arcusStack(p) {
  p.arcN = Math.min(WASTE_MAX, (p.arcN || 0) + 1);
  p.arcT = WASTE_T;
}
// the loose hook (HERO_PASSIVE `shot`): his basic arrow drops where it hits a hero,
// and in TWIN NOCK a second one flies beside it
function arcusShot(p, a) {
  a.hit = 'arcus';
  if (!(p.twinT > 0)) return;
  // the pair straddles the aim, half the gap each side, so both cross whatever
  // the aim was on (a body's hit disc is ARROW_HIT_R across its middle)
  const vd = Math.hypot(a.vx, a.vy) || 1, sx = -a.vy / vd * TWIN_SIDE / 2, sy = a.vx / vd * TWIN_SIDE / 2;
  a.x -= sx; a.y -= sy; a.ox -= sx; a.oy -= sy;
  arrows.push(Object.assign({}, a, { x: a.x + 2 * sx, y: a.y + 2 * sy, ox: a.ox + 2 * sx, oy: a.oy + 2 * sy,
    dmg: Math.round(a.dmg * abRk(p, 'twin', 'share')), basic: false, ab: 'twin' }));
}
// a basic arrow (or a twin) that hit a rival hero lands in the snow past them
// (HERO_SHOT_HIT); an arrow of VOLLEY lands past whatever it hit
function arcusHit(a, t, nx, ny) {
  if (!(t instanceof Player)) return;
  arcusDrop(a.owner, a.team, t.x + nx * SHAFT_PAST, t.y + ny * SHAFT_PAST, Math.atan2(ny, nx));
}
function volleyHit(a, t, nx, ny) {
  a.dropped = true;
  arcusDrop(a.owner, a.team, t.x + nx * SHAFT_PAST, t.y + ny * SHAFT_PAST, Math.atan2(ny, nx));
}
// a VOLLEY arrow that flew its whole way drops where it stopped (HERO_SHOT_END)
function volleyEnd(a, k) {
  if (a.dropped || k === 'wall') return;
  arcusDrop(a.owner, a.team, a.x, a.y, Math.atan2(a.vy, a.vx));
}
// the blow hook (HERO_PASSIVE `deal`): a body's second and later arrow of one volley lands for less
function arcusDeal(p, e, dmg, o) {
  if (o.ab !== 'volley') return dmg;
  const id = p.id * 1000 + p.arcVolN;
  if (e.arcVol === id) return Math.round(dmg * VOLLEY_MORE);
  e.arcVol = id;
  return dmg;
}
// his clocks, one sim step, and the arrows he walks over
function arcusTick(p, dt) {
  if (p.arcT > 0 && (p.arcT -= dt) <= 0) p.arcN = 0;
  if (p.twinT > 0) p.twinT = Math.max(0, p.twinT - dt);
  if (!p.active || p.dead || inAir(p)) return;
  for (let i = arcusShafts.length - 1; i >= 0; i--) {
    const s = arcusShafts[i];
    if (s.owner !== p.id || s.team !== p.team || Math.hypot(s.x - p.x, s.y - p.y) > SHAFT_PICK_R) continue;
    arcusShafts.splice(i, 1);
    arcusStack(p);
    burst(s.x, s.y - 2, '#efe3c4', 4, 25, 0.25, true);
    sfxFor(p, 'pickup');
  }
}
function arcusOut(p) { p.arcN = 0; p.arcT = 0; p.twinT = 0; }
// his stacks as attack speed (HERO_STAT)
function arcusAs(p, key) { return key === 'as' && p.arcN > 0 && isArcus(p) ? p.arcN * WASTE_AS : 0; }

// ---- Q VOLLEY ---------------------------------------------------------------------
function arcusVolley(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y), a0 = Math.atan2(dy, dx);
  const dmg = abDmg(p, 'volley', abRk(p, 'volley', 'dmg'));
  p.arcVolN = ((p.arcVolN || 0) + 1) % 1000;
  for (let k = 0; k < VOLLEY_N; k++) {
    const a = a0 - VOLLEY_HALF + (2 * VOLLEY_HALF * k) / (VOLLEY_N - 1);
    arrows.push({
      x: p.x, y: p.y - BOW_Y, vx: Math.cos(a) * VOLLEY_SPD, vy: Math.sin(a) * VOLLEY_SPD,
      t: 0, life: VOLLEY_RANGE / VOLLEY_SPD, dmg, pow: 1, owner: p.id, team: p.team,
      solid: true, kb: 0.6, col: '#c8a46a', ab: 'volley', hit: 'volley',
      ang: a, spd: VOLLEY_SPD, ox: p.x, oy: p.y - BOW_Y,
    });
  }
  faceToward(p, dx, dy, true);
  sfxAt('arrow', p.x, p.y);
}

// ---- W TWIN NOCK --------------------------------------------------------------------
function arcusTwin(p) {
  p.twinT = TWIN_T;
  p.nockT = 0; // a second arrow on the string at once
  burst(p.x, p.y - 8, '#efe3c4', 6, 30, 0.3, true);
  sfxAt('pickup', p.x, p.y);
}

// ---- E GATHER UP ---------------------------------------------------------------------
// Each of his arrows in the snow becomes a shot flying back to where he stands:
// it pierces every rival body on the way, and the snow is clear of it at once.
function arcusGather(p) {
  const dmg = abDmg(p, 'gather', abRk(p, 'gather', 'dmg'));
  p.arcGathN = ((p.arcGathN || 0) + 1) % 1000;
  const gid = p.id * 1000 + p.arcGathN, y1 = p.y - BOW_Y;
  for (let i = arcusShafts.length - 1; i >= 0; i--) {
    const s = arcusShafts[i];
    if (s.owner !== p.id || s.team !== p.team) continue;
    arcusShafts.splice(i, 1);
    const y0 = s.y - 3, dx = p.x - s.x, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
    arrows.push({
      x: s.x, y: y0, vx: dx / d * GATHER_SPD, vy: dy / d * GATHER_SPD,
      t: 0, life: d / GATHER_SPD, dmg, pow: 1, owner: p.id, team: p.team,
      solid: true, kb: 0.3, col: '#c8a46a', ab: 'gather', hit: 'gather', gid,
      pierce: true, pierceHit: [], ang: a, spd: GATHER_SPD, ox: s.x, oy: y0,
    });
    burst(s.x, s.y - 2, '#dfe8f4', 3, 25, 0.25, true);
  }
  sfxAt('dodge', p.x, p.y);
}
// an arrow coming back cut a body (HERO_SHOT_HIT): the third of one call slows it
function gatherHit(a, t) {
  if (t.arcGId === a.gid) t.arcGN++; else { t.arcGId = a.gid; t.arcGN = 1; }
  if (t.arcGN === GATHER_N) { slowUnit(t, GATHER_SLOW_T, GATHER_SLOW); burst(t.x, t.y + 2, '#efe3c4', 8, 40, 0.4, true); }
}
// ...and one that reached him is pulled up (HERO_SHOT_END), if he is still there to take it
function gatherEnd(a, k) {
  const p = arcusSrc(a);
  if (k === 'life' && p && p.active && !p.dead && isArcus(p)) arcusStack(p);
}
// how many of his arrows would fly back through `foe` from here (the bot's reason to call them)
function arcusGatherHits(p, foe) {
  let n = 0;
  for (const s of arcusShafts) {
    if (s.owner !== p.id || s.team !== p.team) continue;
    const vx = p.x - s.x, vy = p.y - s.y, l2 = vx * vx + vy * vy || 1;
    const u = Math.max(0, Math.min(1, ((foe.x - s.x) * vx + (foe.y - s.y) * vy) / l2));
    if (Math.hypot(foe.x - (s.x + vx * u), foe.y - (s.y + vy * u)) < 10) n++;
  }
  return n;
}

// rival heroes standing round `foe`, it too (the bot's reason to rain on a crowd)
function arcusFoesNear(p, foe) { let n = 0; for (const q of players) if (q.team !== p.team && q.active && !q.dead && Math.hypot(q.x - foe.x, q.y - foe.y) < RAIN_R) n++; return n; }

// ---- R FULL QUIVER --------------------------------------------------------------------
// where the rain falls: the aim, no further than RAIN_RANGE
function arcusSpot(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1, r = Math.min(d, RAIN_RANGE);
  return { x: p.x + dx / d * r, y: p.y + dy / d * r };
}
// where arrow k of a rain lands: a sunflower spiral over the disc, so the spot fills
// evenly with no roll of the dice
function rainPoint(r, k) {
  const a = k * 2.39996, d = RAIN_R * Math.sqrt((k + 0.5) / RAIN_N);
  return { x: r.x + Math.cos(a) * d, y: r.y + Math.sin(a) * d * 0.8 };
}
// the clock of arrow k: when it lands, counted from the cast
function rainAt(k) { return RAIN_FALL + (RAIN_T * k) / (RAIN_N - 1); }
function arcusQuiver(p) {
  const c = arcusSpot(p);
  arcusRains.push({ x: c.x, y: c.y, team: p.team, owner: p.id, t: 0, n: 0, dmg: abDmg(p, 'quiver', abRk(p, 'quiver', 'dmg')) });
  faceToward(p, c.x - p.x, c.y - p.y, true);
  burst(p.x, p.y - 14, '#efe3c4', 10, 50, 0.4, true);
  sfxAt('arrow', p.x, p.y);
}
function rainLand(r, k) {
  const at = rainPoint(r, k), src = arcusSrc(r);
  if (src) {
    for (const q of unitsHit(src, at.x, at.y, RAIN_HIT)) {
      hurtUnit(q, r.dmg, 0, 1, src, { kb: 0, ab: 'quiver' });
      slowUnit(q, RAIN_SLOW_T, RAIN_SLOW);
    }
    hurtBuilt(src, at.x, at.y, RAIN_HIT, r.dmg);
  }
  arcusDrop(r.owner, r.team, at.x, at.y, Math.PI / 2 + ((k % 3) - 1) * 0.5);
  burst(at.x, at.y, '#eef4fb', 4, 30, 0.25, true);
  if (k % 3 === 0) sfxAt('hit', at.x, at.y);
}

// what he leaves in the world, one sim step (HERO_TICK)
function updateArcusWorld(dt) {
  for (let i = arcusShafts.length - 1; i >= 0; i--) {
    const s = arcusShafts[i];
    if ((s.t += dt) >= SHAFT_LIFE || !arcusSrc(s)) arcusShafts.splice(i, 1);
  }
  for (let i = arcusRains.length - 1; i >= 0; i--) {
    const r = arcusRains[i];
    r.t += dt;
    while (r.n < RAIN_N && r.t >= rainAt(r.n)) rainLand(r, r.n++);
    if (r.n >= RAIN_N) arcusRains.splice(i, 1);
  }
}

// ---- the hooks he registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.wastenothing = { shot: arcusShot, deal: arcusDeal, tick: arcusTick, out: arcusOut,
  name: 'WASTE NOTHING', blurb: 'YOUR ARROWS STAY IN THE SNOW: A BASIC SHOT THAT HITS A HERO, AND EVERY ARROW OF YOUR KEYS. WALK OVER ONE TO PULL IT UP AND SHOOT FASTER FOR A WHILE, UP TO FIVE TIMES.',
  icon: ARCUS_ICON32.waste, mark: 'speed' };
HERO_STAT.push({ name: 'WASTE NOTHING', add: arcusAs });
HERO_SHOT_HIT.arcus = arcusHit;
HERO_SHOT_HIT.volley = volleyHit;
HERO_SHOT_HIT.gather = gatherHit;
HERO_SHOT_END.volley = volleyEnd;
HERO_SHOT_END.gather = gatherEnd;
HERO_TICK.push(updateArcusWorld);
