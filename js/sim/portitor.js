'use strict';
// PORTITOR, THE CARRIER - a named hero (CLASSES, js/sim/player.js) and the
// support who carries: a copper baggage engine of the old works with a bedroll
// on its back. It lifts an ally onto its shoulders and walks them out of a
// fight, shielded, their hands still free; it lobs supply crates that shield
// its side and knock rivals back; it ploughs a path through a crowd; and it
// runs the length of a lane to carry a friend home. The empire built it to haul
// silver; on the retreat it carried the wounded instead, and was left behind for it.
// Loaded before abilities.js, whose CLASS_AB takes PORTITOR_AB as its row of keys;
// it registers into the shared hero hooks (js/sim/heroes.js) and draws no rng().
// ------------------------------------------------------------ portitor

// ---- tuning --------------------------------------------------------------
// THE CARRY (W and R): an ally up on its back stands where it stands, cannot walk,
// and keeps its hands free (a bow still shoots from up there). The ally's roll, a
// dash, a fall or the zipline hops them down; a stun or a fall on the carrier
// drops them; a recast of W sets them down where it aims.
const CARRY_REACH = 46;         // px from him an ally may stand to be lifted
const CARRY_T = 2.5;            // s W holds them up
const CARRY_SET = 54;           // px from him the recast may set them down
const CARRY_BESIDE = 12;        // px beside him an ally is set down when the carry runs out
// BEDROLL (the passive): the ally he carries mends a share of their health each
// second, and an ally standing still at his side mends a smaller share
const BED_CARRY = 0.03;         // max health share a second, carried
const BED_REST = 0.012;         // ...standing still beside him
const BED_REST_R = 40;          // px of "beside"
const BED_STILL = 6;            // px/s under which a body is standing still
// Q SUPPLY CRATE: a crate lobbed onto a spot; where it lands rivals are struck and
// slowed and allies (him too) take a shield
const CRATE_RANGE = 200;        // px from him the spot may be set
const CRATE_T = 0.5;            // s in the air
const CRATE_R = 30;             // px round the landing
const CRATE_SLOW = 0.7;         // a rival's walk x this...
const CRATE_SLOW_T = 1.2;       // ...for this long
const CRATE_SHIELD = 35;        // the shield on each ally in the ring...
const CRATE_SHIELD_LV = 5;      // ...and this more for each of his levels
const CRATE_SHIELD_T = 2.5;     // s it holds
// E PLOUGH ON: a short charge; every rival in the way is struck once and shoved aside
const PLOUGH_LEN = 110;         // px
const PLOUGH_SPD = 300;         // px/s
const PLOUGH_HIT = 13;          // px round him a rival is met
const PLOUGH_KB = 2.6;          // the shove, x what that kind of body takes from a hit
// R CARRY HOME: a run to a far ally, through every body; rivals run through are
// struck and shoved aside, and the ally is lifted for longer and carried faster
const HOME_RANGE = 460;         // px from him the ally may stand
const HOME_PICK = 60;           // px from the aim the ally may stand
const HOME_SPD = 430;           // px/s
const HOME_REACH = 16;          // px from the ally the run lifts them
const HOME_T = 3.5;             // s the carry holds
const HOME_WALK = 1.3;          // his walk x this while the carry holds
const HOME_SHIELD = 80;         // the shield on the ally lifted...
const HOME_SHIELD_LV = 10;      // ...and this more for each of his levels

const portitorCrates = []; // {x, y, ox, oy, t, team, owner, dmg, shield} - Q's crates in the air, (x, y) where they land

// ---- the keys ---------------------------------------------------------------
// His row in CLASS_AB (js/sim/abilities.js), in ARM_AB's shape (js/sim/armatos.js).
const PORTITOR_AB = [
  {
    id: 'crate', name: 'SUPPLY CRATE', cd: [10, 9.5, 9, 8.5, 8], ap: 0.5, cast: 0.2, aim: { ring: CRATE_RANGE },
    rank: { dmg: [60, 85, 110, 135, 160] }, // dmg: each rival where it lands
    tip: 'STRIKES RIVALS, SHIELDS ALLIES',
    blurb: 'LOB A SUPPLY CRATE ONTO A SPOT. WHERE IT LANDS, RIVALS ARE STRUCK AND SLOWED AND ALLIES, YOU TOO, TAKE A SHIELD.',
    use: (p) => portitorCrate(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const c = portSpot(p, CRATE_RANGE); drawRing(Math.round(c.x - ex), Math.round(c.y - ey), CRATE_R, col, 0.5 + 0.45 * closing, closing * 0.25); },
    pose: () => ({ dx: 0, dy: -1, rot: 0 }), // the crate up over the shoulder
    icon: PORTITOR_ICON32.crate,
    bot: (p, foe, d) => d < CRATE_RANGE - 10,
    botAim: (p, foe) => ({ x: foe.x + (foe.vx || 0) * CRATE_T, y: foe.y + (foe.vy || 0) * CRATE_T }), // where they will be when it lands
  },
  {
    id: 'shoulder', name: 'SHOULDER', cd: [16, 15, 14, 13, 12], cast: 0.1, aim: { ring: CARRY_REACH },
    recast: (p) => portRider(p) !== null, // the key again sets them down
    ok: (p) => portRider(p) !== null || !!shoulderPick(p),
    rank: { shield: [50, 70, 90, 110, 130] }, // shield: on the ally lifted
    tip: 'LIFT AN ALLY. SHIELDED, HANDS FREE',
    blurb: 'LIFT THE ALLY NEAREST THE AIM ONTO YOUR BACK FOR A FEW SECONDS, WITH A SHIELD. THEY CANNOT WALK BUT CAN STILL FIGHT, AND MEND AS YOU CARRY THEM. PRESS AGAIN TO SET THEM DOWN WHERE YOU AIM. THEY CAN ROLL OFF.',
    use: (p) => portitorShoulder(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const q = p.castSlam ? null : shoulderPick(p); if (q) drawRing(Math.round(q.x - ex), Math.round(q.y - ey), 10, col, 0.5 + 0.45 * closing, 0); else { const c = portSpot(p, CARRY_SET); drawRing(Math.round(c.x - ex), Math.round(c.y - ey), 8, col, 0.5 + 0.45 * closing, 0); } },
    pose: () => ({ dx: 0, dy: 1, rot: 0 }), // the crouch to lift
    icon: PORTITOR_ICON32.shoulder,
    bot: (p, foe, d) => portRider(p) === null && !!portNeedy(p, CARRY_REACH, 0.45) && d < 240,
    botAim: (p, foe) => { const q = portNeedy(p, CARRY_REACH, 0.45); return q ? { x: q.x, y: q.y } : { x: foe.x, y: foe.y }; },
  },
  {
    id: 'plough', name: 'PLOUGH ON', cd: [13, 12, 11, 10, 9], ap: 0.6, cast: 0.12, aim: { line: PLOUGH_LEN },
    rank: { dmg: [50, 75, 100, 125, 150] }, // dmg: each rival in the way
    tip: 'CHARGE, SHOVING RIVALS ASIDE',
    blurb: 'CHARGE A SHORT WAY. EVERY RIVAL IN THE WAY IS STRUCK AND SHOVED ASIDE. AN ALLY ON YOUR BACK COMES TOO.',
    use: (p) => portitorPlough(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => drawTeleLine(p.x, p.y, Math.cos(a), Math.sin(a), PLOUGH_LEN, col, 0.5 + 0.45 * closing, now, ex, ey),
    pose: () => ({ dx: 0, dy: 1, rot: 0 }), // head down
    icon: PORTITOR_ICON32.plough,
    bot: (p, foe, d) => foe instanceof Player && d > 24 && d < PLOUGH_LEN - 10,
  },
  {
    id: 'home', name: 'CARRY HOME', cd: [110, 95, 80], ap: 0.5, cast: 0.25, aim: { ring: HOME_RANGE },
    ok: (p) => !!homePick(p),
    rank: { dmg: [100, 150, 200] }, // dmg: each rival run through
    tip: 'RUN TO A FAR ALLY AND CARRY THEM',
    blurb: 'RUN TO AN ALLY FAR AWAY, THROUGH EVERY BODY IN THE WAY: RIVALS RUN THROUGH ARE STRUCK AND SHOVED ASIDE. THE ALLY IS LIFTED WITH A BIG SHIELD AND YOU CARRY THEM FASTER, FOR LONGER.',
    use: (p) => portitorHome(p),
    tele: (p, px, py, a, col, closing, now, ex, ey) => { const q = homePick(p); if (q) { drawRing(Math.round(q.x - ex), Math.round(q.y - ey), 12, col, 0.5 + 0.45 * closing, closing * 0.3); drawTeleLine(p.x, p.y, (q.x - p.x) / (Math.hypot(q.x - p.x, q.y - p.y) || 1), (q.y - p.y) / (Math.hypot(q.x - p.x, q.y - p.y) || 1), Math.hypot(q.x - p.x, q.y - p.y), col, 0.4 + 0.4 * closing, now, ex, ey); } },
    pose: () => ({ dx: 0, dy: 1, rot: 0 }),
    acol: '#e8a060', activeF: (p) => (p.portFastT > 0 ? p.portFastT / HOME_T : 0),
    icon: PORTITOR_ICON32.home,
    bot: (p, foe) => { const q = homeNeedy(p); return !!q && Math.hypot(q.x - p.x, q.y - p.y) > 90; },
    botAim: (p, foe) => { const q = homeNeedy(p); return q ? { x: q.x, y: q.y } : { x: foe.x, y: foe.y }; },
  },
];

function isPortitor(p) { return p instanceof Player && CLASSES[p.cls].passive === 'bedroll'; }
// the caster of something he left in the world, while it is still his to credit
function portSrc(w) { const o = players[w.owner]; return o && o.team === w.team ? o : null; }
// the spot at his aim, no further than `range`
function portSpot(p, range) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1, r = Math.min(d, range);
  return { x: p.x + dx / d * r, y: p.y + dy / d * r };
}
// every ally hero but himself that could be lifted: on the field, on its own feet,
// carrying nobody and carried by nobody
function portLiftable(p, q) {
  return q !== p && q.team === p.team && unitAlive(q) && q.portBy < 0 && q.portRide < 0 &&
    q.zip < 0 && !q.mount && q.fallT <= 0 && !(q.rushT > 0);
}
// the ally nearest the aim within `reach` of him and `pick` of the aim
function portPick(p, reach, pick) {
  let best = null, bd = pick;
  for (const q of players) {
    if (!portLiftable(p, q) || Math.hypot(q.x - p.x, q.y - p.y) > reach) continue;
    const d = Math.hypot(q.x - p.input.aimX, q.y - 6 - p.input.aimY);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function shoulderPick(p) { return portPick(p, CARRY_REACH, CARRY_REACH * 2); }
function homePick(p) { return portRider(p) ? null : portPick(p, HOME_RANGE, HOME_PICK); }
// the most hurt ally within `r` of him below `frac` of their life: who a bot lifts
function portNeedy(p, r, frac) {
  let best = null, bk = frac;
  for (const q of players) {
    if (!portLiftable(p, q) || Math.hypot(q.x - p.x, q.y - p.y) > r) continue;
    const k = q.hp / (q.maxHp || 1);
    if (k < bk) { bk = k; best = q; }
  }
  return best;
}
// ...and who a bot runs to: an ally in reach of R, badly hurt, with a rival on them
function homeNeedy(p) {
  if (portRider(p)) return null;
  const q = portNeedy(p, HOME_RANGE, 0.35);
  if (!q) return null;
  for (const e of players) if (enemyOf(q, e) && Math.hypot(e.x - q.x, e.y - q.y) < 150) return q;
  return null;
}

// ---- THE CARRY ----------------------------------------------------------------
// who he carries, or null; who carries a body (HERO_HELD), or null
function portRider(p) { return p.portRide >= 0 ? players[p.portRide] || null : null; }
function portCarrier(q) {
  if (!(q instanceof Player) || q.portBy < 0) return null;
  const c = players[q.portBy];
  return c && c.portRide === q.id ? c : null;
}
function portLift(p, q, t, shield) {
  if (!q || !portLiftable(p, q)) return;
  if (p.portRide >= 0) portSetDown(p, null);
  p.portRide = q.id; p.portT = t;
  q.portBy = p.id;
  if (q.zipWalk) zipWalkEnd(q);
  q.sliding = false; q.vx = 0; q.vy = 0; q.kbx = 0; q.kby = 0;
  q.x = p.x; q.y = p.y;
  breakRecall(q);
  shieldUnit(q, Math.round(itemMend(p, q, shield)), t);
  burst(q.x, q.y - 10, '#e8a060', 8, 40, 0.4, true);
  burst(q.x, q.y - 4, '#dfe8f4', 6, 30, 0.35, true);
  sfxAt('pickup', q.x, q.y);
}
// the ally off his back: at `at` (a recast's aim) when that is open snow, else
// beside him, else where he stands
function portSetDown(p, at) {
  const q = portRider(p);
  p.portRide = -1; p.portT = 0; p.portFastT = 0;
  if (!q) return;
  if (q.portBy === p.id) q.portBy = -1;
  if (!unitAlive(q)) return;
  const open = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor((y + 4) / TILE); return inWorld(tx, ty) && !isSolidTile(tx, ty) && !waterAt(tx, ty); };
  const side = p.dir === 'left' ? 1 : -1;
  const spots = [at, { x: p.x + side * CARRY_BESIDE, y: p.y + 2 }, { x: p.x - side * CARRY_BESIDE, y: p.y + 2 }];
  const s = spots.find((c) => c && open(c.x, c.y));
  if (s) { q.x = s.x; q.y = s.y; } else { q.x = p.x; q.y = p.y; }
  q.vx = 0; q.vy = 0;
  burst(q.x, q.y + 4, '#dfe8f4', 6, 30, 0.3, true);
  sfxAt('place', q.x, q.y);
}
// what ends a carry, either body's: down, gone, the air, a fall, a stun on him;
// on them a roll, a dash, a fall or the zipline (their own way down)
function portCarryOver(p, q) {
  return !q || !p.active || p.dead || inAir(p) || p.stunT > 0 || p.fallT > 0 || p.zip >= 0 || p.mount ||
    !q.active || q.dead || inAir(q) || q.dodgeT > 0 || q.rushT > 0 || q.fallT > 0 || q.zip >= 0 || q.mount ||
    q.team !== p.team || !isPortitor(p);
}
// every step, after every body has moved: each carry holds or ends, and a held body
// stands where its carrier does (HERO_TICK)
function portCarryStep(dt) {
  for (const p of players) {
    if (p.portRide < 0) continue;
    const q = portRider(p);
    if (portCarryOver(p, q) || (p.portT -= dt) <= 0) { portSetDown(p, null); continue; }
    q.x = p.x; q.y = p.y; q.vx = 0; q.vy = 0; q.kbx = 0; q.kby = 0; q.sliding = false;
    if (p.portFastT > 0) p.portFastT = Math.max(0, p.portFastT - dt);
  }
  // a body left marked as carried by a carry that has ended lets go of it
  for (const q of players) if (q.portBy >= 0 && !portCarrier(q)) q.portBy = -1;
}
// a held body does not walk; the carrier walks faster on CARRY HOME (HERO_MOVE)
function portMoveMul(p) { return p.portBy >= 0 ? 0 : p.portFastT > 0 ? HOME_WALK : 1; }

// ---- BEDROLL -------------------------------------------------------------------------
// his clock, one step: the ally on his back mends, and so does an ally standing still beside him
function portitorTick(p, dt) {
  if (!unitAlive(p)) return;
  const q = portRider(p);
  if (q && unitAlive(q)) healPlayer(q, q.maxHp * BED_CARRY * dt);
  for (const o of players) {
    if (o === p || o === q || o.team !== p.team || !unitAlive(o) || o.hp >= o.maxHp) continue;
    if (Math.hypot(o.x - p.x, o.y - p.y) > BED_REST_R || Math.hypot(o.vx, o.vy) > BED_STILL) continue;
    healPlayer(o, o.maxHp * BED_REST * dt);
    o.bedT = 0.3; // shown on them (drawPortitorMark)
  }
}
function portitorOut(p) { portSetDown(p, null); p.portFastT = 0; p.portHomeId = -1; }

// ---- Q SUPPLY CRATE -----------------------------------------------------------------
function portitorCrate(p) {
  const c = portSpot(p, CRATE_RANGE);
  portitorCrates.push({ x: c.x, y: c.y, ox: p.x, oy: p.y - BOW_Y, t: 0, team: p.team, owner: p.id,
    dmg: abDmg(p, 'crate', abRk(p, 'crate', 'dmg')), shield: CRATE_SHIELD + CRATE_SHIELD_LV * p.level });
  faceToward(p, c.x - p.x, c.y - p.y, true);
  sfxAt('swing', p.x, p.y);
}
function crateLand(w) {
  const src = portSrc(w), side = src || sideOf(w);
  for (const q of unitsHit(side, w.x, w.y, CRATE_R)) {
    const dx = q.x - w.x, dy = q.y - w.y, d = Math.hypot(dx, dy) || 1;
    hurtUnit(q, w.dmg, dx / d, dy / d, src, { kb: 90, ab: 'crate' });
    slowUnit(q, CRATE_SLOW_T, CRATE_SLOW);
  }
  for (const st of structsNear(side, w.x, w.y, CRATE_R)) hurtStruct(st, w.dmg, src);
  if (PRACTICE) abHitDummies(w.x, w.y, CRATE_R, w.dmg);
  for (const q of players) {
    if (q.team !== w.team || !unitAlive(q) || Math.hypot(q.x - w.x, q.y - w.y) > CRATE_R + PLAYER_R) continue;
    shieldUnit(q, Math.round(itemMend(src, q, w.shield)), CRATE_SHIELD_T);
    burst(q.x, q.y - 8, '#e8a060', 5, 30, 0.35, true);
  }
  abFx.push({ kind: 'ring', x: w.x, y: w.y, r: CRATE_R, t: 0, col: '#e8a060' });
  burst(w.x, w.y, '#c89a5a', 10, 50, 0.45, true);
  burst(w.x, w.y, '#eef4fb', 10, 45, 0.4, true);
  sfxAt('break_', w.x, w.y);
}
function updateCrates(dt) {
  for (let i = portitorCrates.length - 1; i >= 0; i--) {
    const w = portitorCrates[i];
    if ((w.t += dt) < CRATE_T) continue;
    portitorCrates.splice(i, 1);
    crateLand(w);
  }
}

// ---- the charge's blows, E's and R's ------------------------------------------------------
// each rival met once a charge (stamped with the charge's number, p.portRunN), struck
// and shoved off to the side of his line
function portRunHits(p, ab) {
  const nx = p.rushNX, ny = p.rushNY, dmg = abDmg(p, ab, abRk(p, ab, 'dmg')), id = p.id * 1000 + p.portRunN;
  for (const q of unitsHit(p, p.x, p.y, PLOUGH_HIT + 4)) {
    if (q.portRunHit === id) continue;
    q.portRunHit = id;
    // aside: square to his line, to whichever side of it they stand
    const s = (q.x - p.x) * -ny + (q.y - p.y) * nx >= 0 ? 1 : -1;
    const kx = -ny * s * 0.8 + nx * 0.6, ky = nx * s * 0.8 + ny * 0.6;
    hurtUnit(q, dmg, kx, ky, p, { kb: 160, kbMul: PLOUGH_KB, ab });
    burst(q.x, unitMidY(q), '#e8a060', 6, 40, 0.35, true);
    shakeFor(p, 2, q);
  }
  for (const st of structsNear(p, p.x, p.y, PLOUGH_HIT)) {
    if (st.portRunHit === id) continue;
    st.portRunHit = id;
    hurtStruct(st, dmg, p);
  }
  if (PRACTICE) abHitDummies(p.x, p.y, PLOUGH_HIT, 0);
}
function portRunEnd(p, keep) {
  p.rushT = 0; p.dash = '';
  p.vx = p.rushNX * keep; p.vy = p.rushNY * keep;
  burst(p.x, p.y + 4, '#dfe8f4', 6, 35, 0.3, true);
}

// ---- E PLOUGH ON ----------------------------------------------------------------------
function portitorPlough(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y, d = Math.hypot(dx, dy) || 1;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = PLOUGH_LEN / PLOUGH_SPD;
  p.dash = 'plough';
  p.sliding = false;
  p.portRunN = (p.portRunN + 1) % 1000;
  faceToward(p, p.rushNX, p.rushNY, true);
  burst(p.x, p.y + 4, '#dfe8f4', 10, 45, 0.4, true);
  sfxAt('dodge', p.x, p.y);
}
function ploughStep(p, mv) {
  portRunHits(p, 'plough');
  if (mv.blockedX || mv.blockedY || p.rushT <= 0) portRunEnd(p, 40);
}

// ---- R CARRY HOME -------------------------------------------------------------------------
function portitorHome(p) {
  const q = homePick(p);
  if (!q) return;
  p.portHomeId = q.id;
  const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  p.rushNX = (q.x - p.x) / d; p.rushNY = (q.y - p.y) / d;
  p.rushT = HOME_RANGE * 1.25 / HOME_SPD; // room for an ally who walks on while he runs
  p.dash = 'home';
  p.sliding = false;
  p.portRunN = (p.portRunN + 1) % 1000;
  faceToward(p, p.rushNX, p.rushNY, true);
  burst(p.x, p.y + 4, '#e8a060', 14, 60, 0.45, true);
  sfxAt('dodge', p.x, p.y);
}
// the run steers onto the ally wherever they walk, and lifts them on reaching them
function homeStep(p, mv) {
  const q = players[p.portHomeId];
  if (!q || !portLiftable(p, q)) { p.portHomeId = -1; portRunEnd(p, 40); return; }
  portRunHits(p, 'home');
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
  if (d <= HOME_REACH) {
    p.portHomeId = -1;
    portRunEnd(p, 0);
    portLift(p, q, HOME_T, HOME_SHIELD + HOME_SHIELD_LV * p.level);
    p.portFastT = HOME_T;
    abFx.push({ kind: 'ring', x: p.x, y: p.y, r: 20, t: 0, col: '#e8a060' });
    return;
  }
  p.rushNX = dx / d; p.rushNY = dy / d;
  faceToward(p, dx, dy, true);
  if (mv.blockedX && mv.blockedY || p.rushT <= 0) { p.portHomeId = -1; portRunEnd(p, 40); }
}

// ---- W SHOULDER --------------------------------------------------------------------------
function portitorShoulder(p) {
  if (p.castSlam) { portSetDown(p, portSpot(p, CARRY_SET)); return; } // the recast: down where he aims
  portLift(p, shoulderPick(p), CARRY_T, abRk(p, 'shoulder', 'shield'));
}

// what he leaves in the world, one sim step (HERO_TICK)
function updatePortitorWorld(dt) {
  portCarryStep(dt);
  updateCrates(dt);
  for (const q of players) if (q.bedT > 0) q.bedT = Math.max(0, q.bedT - dt);
}

// ---- the hooks he registers (js/sim/heroes.js) ------------------------------------
HERO_PASSIVE.bedroll = { tick: portitorTick, out: portitorOut,
  name: 'BEDROLL', blurb: 'AN ALLY YOU CARRY MENDS QUICKLY. AN ALLY STANDING STILL BESIDE YOU MENDS SLOWLY.',
  icon: PORTITOR_ICON32.bedroll };
HERO_MOVE.push(portMoveMul);
HERO_HELD.push(portCarrier);
HERO_TICK.push(updatePortitorWorld);
HERO_DASH.plough = { spd: PLOUGH_SPD, t: PLOUGH_LEN / PLOUGH_SPD, ramp: 0.04, step: ploughStep };
HERO_DASH.home = { spd: HOME_SPD, t: HOME_RANGE * 1.25 / HOME_SPD, ramp: 0.06, through: true, step: homeStep };
