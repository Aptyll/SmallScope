'use strict';
// The class abilities: keys 1-4, four unique actives per class, each with a
// cooldown, a cast the body visibly performs, and world entities of its own
// (a piercing shot, nets, a grapple line, a shield, a rush, a crater, a fury).
// Everything here runs per player off p.input.ability, so a bot casts through
// exactly the key a human presses. Loaded after tools.js (it shares the
// world's fx helpers at runtime and nothing at load time - and it must draw
// no load-time rng(), or every seed reshuffles).
// ------------------------------------------------------------ class abilities

// ---- tuning --------------------------------------------------------------
const AB_KEYS = 4;          // keys 1-4
// ability levels: the hero's own growth, never the purse's. A key starts
// LOCKED at level 0 - the kit hands you the four actives, not the use of
// them - and every level costs ONE SKILL POINT, the only thing a point buys,
// one per hero level. The FIRST point on a key UNLOCKS it (that is the whole
// gate: level 1 casts, level 0 refuses); each one after shaves AB_LV_CD off
// that ability's cooldown - one lever, universally meaningful (more nets in
// the air, the wall up more often), read back through abCdOf so every
// cooldown-setting site scales alike. Four keys x AB_LV_MAX is 12 points
// against the 12 a capped hero earns, so the ladder ends exactly where the
// hero does: every point has a home, and the order you spend them in - which
// key you can use at all, and how early - is the whole build.
const AB_LV_MAX = 3;
const AB_LV_CD = 0.12;
// hunter
const PIERCE_WIND = 0.7;    // s the draw is LOCKED before the shot looses itself
const PIERCE_MUL = 1.5;     // over a fully drawn plain arrow's damage
const PIERCE_SPD = 380;     // px/s (a plain arrow flies 320)
const PIERCE_RANGE = 260;   // px of flight - the telegraph line draws this far
const PIERCE_SLOW = 0.15;   // walk multiplier while the draw is locked: commitment
const NET_SPD = 300;
const NET_RANGE = 130;
const NET_DMG = 4;
const NET_SLOW = 0.4;       // speed multiplier under the net...
const NET_SLOW_T = 2;       // ...for this long
const NET_KICK = 150;       // px/s of recoil the hunter takes backward
const GRAP_RANGE = 170;     // px a thrown hook can reach
const GRAP_ASSIST = 12;     // px either side of the aim ray a trunk still catches
const GRAP_REEL = 260;      // px/s of reel - over SLIDE_MIN, so a release carves
const GRAP_ARRIVE = 12;     // px from the anchor the line lets itself go
const GRAP_MAX_T = 1.5;     // s of reel before the hook slips (safety rail)
const GRAP_MISS_CD = 1;     // s a hook that caught nothing costs
// (snow cover has no numbers of its own: the burrow it opens is PRONE_*, js/actions.js)
// warrior
const SHIELD_T = 2.2;       // s the shield can be held up
const SHIELD_ARC = 0.35;    // cos-margin of the front arc that blocks
// the SLAM: the shield key again while the wall is up (or mid-charge) - a
// short wind-up, then the shield's face driven into everything in the wedge
// ahead. It ENDS the wall and starts its cooldown, so a slam is the wall's
// second half spent all at once.
const SLAM_CAST = 0.16;     // s of wind-up the wedge is on the snow for
const SLAM_R = 30;          // px of reach
const SLAM_HALF = 0.85;     // rad either side of the shield's face
const SLAM_DMG = 8;
const SLAM_STUN = 1.1;
const SLAM_KB = 150;        // px/s of shove, straight down the face
const RUSH_SPD = 300;
const RUSH_T = 0.42;        // s of charge (~4 tiles)
const RUSH_RAMP = 0.08;     // s the charge takes to reach full speed, so it leaves smooth
const RUSH_DMG = 10;
const RUSH_STUN = 0.6;
const RUSH_WALL_MUL = 1.6;  // driven into a tree/rock/wall: the slam is worse
const STOMP_R = 34;
const STOMP_DMG = 12;
const STOMP_KB = 170;       // px/s radial shove
const STOMP_STUN = 0.25;
const CRATER_R = 30;        // the deep-snow crater the stomp leaves...
const CRATER_T = 4;         // ...and how long it slows rivals crossing it
const CRATER_SLOW = 0.55;
// the EXECUTE: a slow overhead cut whose worth is the target's MISSING life -
// the finisher the other three keys set up. A whole body of life missing is
// EXEC_MISSING of it again on top of the base, capped so a dire wolf at a
// sliver is not a one-line kill.
const EXEC_R = 30;
const EXEC_HALF = 0.75;     // rad either side of the aim: narrower than the sword
const EXEC_DMG = 10;        // the base, at full life
const EXEC_MISSING = 0.5;   // ...plus this share of the life the target has lost
const EXEC_BONUS_MAX = 40;  // ...to at most this much extra
const EXEC_KB = 120;
// every readable shape an ability puts on the snow for BOTH sides: the
// telegraph while a cast winds up (the wedge, the ring, the charge's line),
// and the flash where it landed. abFx holds the flashes; the telegraphs are
// read live off the caster.
const AB_FX_T = 0.28;       // s a landed shape flashes for
const TELE_COL = '#e0637a'; // the wind-up's colour...
const TELE_HOT = '#ffd95c'; // ...and the last quarter of it, when it is about to land

// ---- the two kits --------------------------------------------------------
// One row per key. `use(p)` is the whole effect, fired when the cast lands -
// what an ability IS lives here, never in an `if` somewhere else. `cast` is
// the seconds the body spends performing it (the pose is abilityPose below).
const CLASS_AB = [
  [ // HUNTER - bow, distance control, the ground between
    {
      id: 'pierce', name: 'PIERCING SHOT', cd: 12, cast: PIERCE_WIND,
      blurb: 'LOCK A FULL DRAW, THEN LOOSE. THE SHOT GOES THROUGH EVERYONE ON THE LINE.',
      use: (p) => abPierce(p),
    },
    {
      id: 'net', name: 'NET SHOT', cd: 15, cast: 0.18,
      blurb: 'A WEIGHTED NET THAT TANGLES. THE RECOIL KICKS YOU BACKWARD.',
      use: (p) => abNetShot(p),
    },
    {
      id: 'grap', name: 'GRAPPLE', cd: 8, cast: 0.12,
      blurb: 'HOOK A TREE OR A ROCK. HOLD TO REEL IN, LET GO TO KEEP THE SPEED.',
      use: (p) => abGrapple(p),
    },
    {
      id: 'snow', name: 'SNOW COVER', cd: 60, cast: 0.22,
      blurb: 'LIE DOWN AND PULL THE SNOW OVER YOU. THE KEY AGAIN STANDS YOU UP.',
      use: (p) => abSnowCover(p),
      // the strip's active tell: how deep under the snow the body is
      acol: '#f4f7ff', activeF: (p) => (p.prone ? Math.max(0.15, p.hide) : 0),
    },
  ],
  [ // WARRIOR - close pressure, blocking, momentum
    {
      id: 'shield', name: 'SHIELD WALL', cd: 9, cast: 0.12,
      blurb: 'RAISE THE TOWER SHIELD. PRESS AGAIN TO SLAM: STUNS WHAT IS AHEAD, ENDS THE WALL.',
      // the one key with two halves: the raise, and - pressed again while the
      // wall is up or mid-charge (tryAbility sets castSlam) - the slam
      use: (p) => (p.castSlam ? abSlam(p) : abShieldUp(p)),
      // the strip's active tell: how much of the wall is left, and its colour
      acol: '#f2cc6a', activeF: (p) => (p.shieldT > 0 ? p.shieldT / SHIELD_T : 0),
    },
    {
      id: 'rush', name: 'BULL RUSH', cd: 12, cast: 0.3,
      blurb: 'CHARGE A LINE. THE FIRST RIVAL HIT IS CARRIED AND SLAMMED.',
      use: (p) => abRush(p),
    },
    {
      id: 'stomp', name: 'STOMP', cd: 14, cast: 0.28,
      blurb: 'LEAP AND SLAM THE SNOW. THE CRATER SLOWS WHOEVER CROSSES IT.',
      use: (p) => abStomp(p),
    },
    {
      id: 'exec', name: 'EXECUTE', cd: 18, cast: 0.55,
      blurb: 'A HEAVY OVERHEAD CUT. THE LESS LIFE THEY HAVE LEFT, THE HARDER IT LANDS.',
      use: (p) => abExecute(p),
    },
  ],
];

// the world the abilities put things into
const craters = [];  // {x, y, team, t}
const nets = [];     // {x, y, nx, ny, d, owner, team, spin}
const abFx = [];     // {kind: 'wedge'|'ring', x, y, a, r, half, t, col} - where a blow landed, flashed for AB_FX_T

// ---- levelling -----------------------------------------------------------
// Whether the key is bought at all (level 0 = locked: no cast, a dim well and
// a dim icon on the strip), can-buy or not (a point in hand, room on the
// key), the one entry point a buyer reaches through runCmd (HUD plate click
// and bots alike), and the effective cooldown the sim reads instead of the
// table's base. abUnlocked is the ONE gate - tryAbility and every bot that
// reaches for a key ask it, so a locked ability is dark for a player whoever
// is driving it.
function abUnlocked(p, i) { return p.abLv[i] > 0; }
function abReady(p, i) { return p.abLv[i] > 0 && p.abCd[i] <= 0; } // bought AND off cooldown: what a bot reaches for
function abLvCanBuy(p, i) { return p.skillPts > 0 && p.abLv[i] < AB_LV_MAX; }
function abCdOf(p, i) { return CLASS_AB[p.cls][i].cd * (1 - AB_LV_CD * (Math.max(1, p.abLv[i]) - 1)); }
function buyAbilityLv(p, i) {
  if (!abLvCanBuy(p, i)) { if (p === player) SFX.deny(); return; }
  p.skillPts--;
  p.abLv[i]++;
  // the first point is the one that changes what you CAN do, so it says so;
  // every one after is a number going up
  const nm = CLASS_AB[p.cls][i].name;
  addFloater(p.x, p.y - 18, p.abLv[i] === 1 ? nm + ' UNLOCKED' : nm + ' ' + p.abLv[i], GEAR_MATS[p.abLv[i] - 1]);
  burst(p.x, p.y - 8, GEAR_MATS[p.abLv[i] - 1], p.abLv[i] === 1 ? 14 : 8, p.abLv[i] === 1 ? 55 : 40, 0.45);
  if (p === player) SFX.levelUp();
  else if (nearPlayer(p.x, p.y)) SFX.pickup();
}

// ---- casting -------------------------------------------------------------
// The press. Refused flat while the body is otherwise occupied; the shield's
// own key is the one toggle - pressing it again lowers the shield early - and
// snow cover's is the other: pressing it again stands the body up, free.
function tryAbility(p, i) {
  if (i < 0 || i >= AB_KEYS || p.dead || p.stunT > 0 || p.fallT > 0 ||
    p.dodgeT > 0 || p.grapT > 0 || p.castT > 0 || p.eatT > 0 || inAir(p)) return; // a meal occupies the hands the same way a cast does
  const ab = CLASS_AB[p.cls][i];
  if (!ab) return;
  // a key nobody has spent a point on is not yours yet: the dim well already
  // says so, and the press reddens it the way a bit that will not fit reddens
  // the tool well (abDenied, js/ui.js)
  if (!abUnlocked(p, i)) { if (p === player) abDenied(i); return; }
  // THE SLAM: the shield key while the wall is up, or mid-charge. A charge
  // stops on the spot (the body it carried is slammed where it stands) and
  // the wind-up begins from there; without a wall up the slam is the shield's
  // own cast, so it waits on the shield's cooldown like the raise would
  if (ab.id === 'shield' && (p.shieldT > 0 || p.rushT > 0)) {
    if (p.shieldT <= 0 && p.abCd[i] > 0) { if (p === player) SFX.deny(); return; }
    if (p.rushT > 0) rushEnd(p, false);
    p.castSlam = true;
    startCast(p, i, SLAM_CAST);
    return;
  }
  if (p.rushT > 0) return; // every other key waits out the charge
  if (ab.id === 'snow' && p.prone) { risePlayer(p); return; } // rising is free; only going under pays
  if (p.abCd[i] > 0) { if (p === player) SFX.deny(); return; }
  if (ab.id === 'rush' && p.rootT > 0) { if (p === player) SFX.deny(); return; } // pinned: nothing that moves you
  if (ab.id === 'snow') {
    // no snow underfoot is a flat no before the kneel even starts - the speed
    // check waits for the cast to land (tryProne, called by abSnowCover)
    const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + 4) / TILE);
    if (!inWorld(tx, ty) || ground[idx(tx, ty)] !== 0) { if (p === player) SFX.deny(); return; }
  }
  startCast(p, i, ab.cast);
}
// the wind-up itself: cover broken, the draw dropped, the body turned to the
// aim and the clock set. `t` is the cast's length - the table's, or the slam's
function startCast(p, i, t) {
  risePlayer(p); // a cast breaks cover the way the shot does
  if (p.charging) { p.charging = false; p.chargeT = 0; }
  p.fireArmed = false;
  p.castAb = i;
  p.castT = t;
  p.castMax = t;
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y;
  if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
  else p.dir = dy > 0 ? 'down' : 'up';
  if (nearPlayer(p.x, p.y)) SFX.swing();
}
// how far through its wind-up a cast is, 0 at the press and 1 at the landing
function castProg(p) { return p.castT > 0 && p.castMax > 0 ? 1 - p.castT / p.castMax : 0; }

// per-player tick: cooldowns, the cast landing, and every timed state an
// ability leaves on a body. Called from updatePlayer once the player is alive.
function updateAbilities(p, dt) {
  for (let i = 0; i < AB_KEYS; i++) if (p.abCd[i] > 0) p.abCd[i] = Math.max(0, p.abCd[i] - dt);
  if (p.hopT > 0) p.hopT = Math.max(0, p.hopT - dt);
  // root / slow / net / mark / fire: the shared clock every kind of unit runs
  // (updateUnitStatus, js/actions.js) - an animal and a worker bot age the
  // identical states off the identical timers
  updateUnitStatus(p, dt);
  if (p.dead) return; // a burn can finish a player mid-tick
  if (p.rootT > 0) p.sliding = false;
  if (p.buffT > 0) p.buffT = Math.max(0, p.buffT - dt); // ALPHA'S BLOOD running out (campBuff, wildlife.js)
  // the shield tracks the aim while it is up, and lowers itself on the timer
  if (p.shieldT > 0) {
    p.shieldT -= dt;
    p.shieldA = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
    const adx = Math.cos(p.shieldA), ady = Math.sin(p.shieldA);
    if (Math.abs(adx) > Math.abs(ady)) p.dir = adx > 0 ? 'right' : 'left';
    else p.dir = ady > 0 ? 'down' : 'up';
    if (p.charging) { p.charging = false; p.chargeT = 0; }
    p.fireArmed = false;
    if (p.shieldT <= 0) abShieldDown(p, false);
  }
  // the cast: a short performance, then the effect fires at the aim the
  // caster is holding NOW - a bot tracking its target casts like a hand does
  if (p.castT > 0) {
    p.castT -= dt;
    const ab = CLASS_AB[p.cls][p.castAb];
    // a cast with a telegraph on the snow keeps facing the aim the whole
    // wind-up - the locked draw, the charge's line, the slam's and the
    // execute's wedge - so the shape and the body agree about where this is
    // going, and what lands is what was shown
    if (ab && (ab.id === 'pierce' || ab.id === 'rush' || ab.id === 'exec' || (ab.id === 'shield' && p.castSlam))) {
      const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y;
      if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
      else p.dir = dy > 0 ? 'down' : 'up';
    }
    if (p.castT <= 0) {
      const i = p.castAb;
      p.castAb = -1;
      p.castT = 0;
      p.abCd[i] = abCdOf(p, i);
      CLASS_AB[p.cls][i].use(p);
    }
  }
}

// every movement cap an ability is allowed to touch, in one multiplier: the
// root pins, a cast and a raised shield slow, a net drags. updatePlayer
// applies it to the walk cap and the ice cap alike.
function abilityMoveMul(p) {
  if (p.rootT > 0) return 0;
  let m = 1;
  // a cast halves the walk - except the locked draw, which all but plants the
  // feet: the pierce's cost is standing still where everyone can see the line
  if (p.castT > 0) {
    const ab = CLASS_AB[p.cls][p.castAb];
    m *= ab && ab.id === 'pierce' ? PIERCE_SLOW : 0.5;
  }
  if (p.shieldT > 0) m *= 0.4;
  if (p.slowT > 0) m *= p.slowMul;
  if (p.buffT > 0) m *= CAMP_BUFF_SPD; // ALPHA'S BLOOD (campBuff, wildlife.js)
  return m;
}

// ---- hunter: the four effects --------------------------------------------
// The windup was the telegraph; the loose is the payoff. One enhanced arrow,
// already at full draw, that goes THROUGH every body on the line instead of
// dying on the first - the pierce flag is read by the arrow loop (js/sim.js),
// which keeps the shot alive past a hit and remembers who it has already cut.
// The cue that the lock released is hard and unmissable: the nock snap, a
// white flash on the arrowhead, and the shot itself already gone.
function abPierce(p) {
  const kit = kitOf(p);
  const b = BITS.arrow;
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y);
  const a = Math.atan2(dy, dx);
  // a fully drawn plain arrow's own damage math (emitBit at pw = 1, no
  // modifiers), then the pierce multiplier over the top
  const dmg = Math.round(((b.dmg + kit.dmgPow * 0.5) + kit.dmgBase + LVL_DMG * (p.level - 1)) * PIERCE_MUL);
  arrows.push({
    x: p.x, y: p.y - BOW_Y,
    vx: Math.cos(a) * PIERCE_SPD, vy: Math.sin(a) * PIERCE_SPD,
    t: 0, life: PIERCE_RANGE / PIERCE_SPD, dmg, pow: 1,
    owner: p.id, team: p.team, ambush: false, trailD: 0,
    bit: 'arrow', path: 'line', solid: true, ff: false,
    lit: 0, col: '#f4f7ff',
    pierce: true, pierceHit: [],
    ang: a, spd: PIERCE_SPD, ox: p.x, oy: p.y - BOW_Y,
  });
  // the snap: arrowhead flash at the bow, and the sound of the lock letting go
  burst(p.x + Math.cos(a) * 7, p.y - BOW_Y + Math.sin(a) * 7, '#f4f7ff', 8, 55, 0.3, true);
  burst(p.x + Math.cos(a) * 9, p.y - BOW_Y + Math.sin(a) * 9, '#ffd95c', 5, 45, 0.25, true);
  if (p === player) state.shake = Math.max(state.shake, 2);
  if (nearPlayer(p.x, p.y)) { SFX.nock(); SFX.arrow(); }
}

function abNetShot(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y);
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;
  nets.push({ x: p.x, y: p.y - BOW_Y, nx, ny, d: 0, owner: p.id, team: p.team, spin: 0 });
  // the recoil: a real backward hop, animated on the body (p.hopT)
  p.vx -= nx * NET_KICK;
  p.vy -= ny * NET_KICK;
  p.hopT = 0.3;
  burst(p.x, p.y + 4, '#eef4fb', 4, 30, 0.3, true);
  if (nearPlayer(p.x, p.y)) SFX.arrow();
}

// The hook: thrown down the aim ray, it catches the first tree or rock near
// the line (GRAP_ASSIST px either side - the assist, so a trunk half a tile
// off the cursor still takes it) and starts the reel. The reel itself is a
// movement branch in updatePlayer, held as long as the key is held; grapEnd
// is every way it lets go, and where the cooldown starts - so a long ride and
// an instant release cost the same. A hook that catches nothing costs
// GRAP_MISS_CD instead of the full clock.
function abGrapple(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;
  let ax = 0, ay = 0, found = false;
  for (let s = 12; s < GRAP_RANGE && !found; s += 6) {
    const sx = p.x + nx * s, sy = p.y + ny * s;
    const ctx2 = Math.floor(sx / TILE), cty = Math.floor(sy / TILE);
    for (let oy = -1; oy <= 1 && !found; oy++) for (let ox = -1; ox <= 1 && !found; ox++) {
      const tx = ctx2 + ox, ty = cty + oy;
      if (!inWorld(tx, ty)) continue;
      const o = objects[idx(tx, ty)];
      if (!o || (o.type !== 'tree' && o.type !== 'deadTree' && o.type !== 'rock')) continue;
      const cx2 = tx * TILE + 8, cy2 = ty * TILE + 8;
      // the assist: perpendicular distance of the trunk to the aim ray
      const along = (cx2 - p.x) * nx + (cy2 - p.y) * ny;
      if (along < 10 || along > GRAP_RANGE) continue;
      const perp = Math.abs((cx2 - p.x) * ny - (cy2 - p.y) * nx);
      if (perp > GRAP_ASSIST + 8) continue;
      ax = cx2; ay = cy2; found = true;
    }
  }
  if (!found) {
    // nothing to bite: the throw whiffs, and only a beat is paid for it
    const i = CLASS_AB[p.cls].findIndex((a) => a.id === 'grap');
    if (i >= 0) p.abCd[i] = GRAP_MISS_CD;
    burst(p.x + nx * 14, p.y + ny * 14, '#8b93a8', 3, 25, 0.25, true);
    if (p === player) SFX.deny();
    return;
  }
  p.grapX = ax; p.grapY = ay;
  p.grapT = GRAP_MAX_T;
  p.sliding = false;
  burst(ax, ay - 4, '#c8d2e4', 6, 40, 0.35, true);
  if (nearPlayer(p.x, p.y)) SFX.place();
}
// every way the line lets go: the key released, the anchor reached, a wall, a
// stun, the water, or the hook slipping on the safety timer. The momentum is
// KEPT - the reel speed rides out over SLIDE_MIN, so releasing into shift
// carves straight into a slide.
function grapEnd(p) {
  if (p.grapT <= 0) return;
  p.grapT = 0;
  const i = CLASS_AB[p.cls].findIndex((a) => a.id === 'grap');
  if (i >= 0) p.abCd[i] = abCdOf(p, i);
  burst(p.x, p.y - 2, '#c8d2e4', 4, 30, 0.3, true);
  if (nearPlayer(p.x, p.y)) SFX.pickup();
}

// Snow cover: the burrow, moved onto the kit. The whole state is still prone
// (tryProne/risePlayer and PRONE_*, js/actions.js) - this is just the one door
// in, and the 60 s clock is paid HERE, on the way under; every way back up is
// free. A kneel that lands somewhere the snow refuses (still moving, sliding)
// gives the clock back.
function abSnowCover(p) {
  tryProne(p);
  if (!p.prone) {
    const i = CLASS_AB[p.cls].findIndex((a) => a.id === 'snow');
    if (i >= 0) p.abCd[i] = 0; // the snow refused: nothing is paid
  }
}

// ---- warrior: the four effects -------------------------------------------
function abShieldUp(p) {
  p.shieldT = SHIELD_T;
  p.shieldA = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
  burst(p.x, p.y - 4, '#9aa3ad', 6, 35, 0.35, true);
  if (nearPlayer(p.x, p.y)) SFX.place();
}
// down on the timer, or spent by the slam: the cooldown starts HERE, so
// holding the wall the full stretch and slamming at once cost the same
function abShieldDown(p, early) {
  if (p.shieldT <= 0 && !early) return;
  p.shieldT = 0;
  const i = CLASS_AB[p.cls].findIndex((a) => a.id === 'shield');
  if (i >= 0) p.abCd[i] = abCdOf(p, i);
  if (nearPlayer(p.x, p.y)) SFX.pickup();
}
// THE SLAM lands: the shield's face driven through the wedge ahead. Everything
// alive in it takes the blow, the shove down the face and a real stun; the
// wall it was part of is spent, whether it was up or the charge stood in for
// it. The wedge on the snow is exactly inCone's (js/actions.js).
function abSlam(p) {
  p.castSlam = false;
  const a = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
  const nx = Math.cos(a), ny = Math.sin(a);
  for (const q of unitsInCone(p, p.x, p.y, a, SLAM_R, SLAM_HALF)) {
    hurtUnit(q, SLAM_DMG, nx, ny, p, { kb: SLAM_KB });
    if (!q.dead) { stunUnit(q, SLAM_STUN); q.kbx += nx * SLAM_KB * 0.5; q.kby += ny * SLAM_KB * 0.5; }
    burst(q.x, unitMidY(q), '#f2cc6a', 8, 50, 0.45, true);
    if (p === player || q === player) state.shake = Math.max(state.shake, 4);
  }
  for (const s of structsInCone(p, p.x, p.y, a, SLAM_R, SLAM_HALF)) hurtStruct(s, SLAM_DMG, p);
  if (PRACTICE) abHitDummies(p.x + nx * SLAM_R * 0.5, p.y + ny * SLAM_R * 0.5, SLAM_R * 0.5, SLAM_DMG);
  abFx.push({ kind: 'wedge', x: p.x, y: p.y - 2, a, r: SLAM_R, half: SLAM_HALF, t: 0, col: '#f2cc6a' });
  burst(p.x + nx * 8, p.y - 4 + ny * 6, '#9aa3ad', 8, 45, 0.4, true);
  abShieldDown(p, true);
  if (nearPlayer(p.x, p.y)) SFX.hit();
}
// an incoming shot dies on a raised shield when it flies INTO the front arc
function abShieldBlocks(t, nx, ny) {
  if (t.shieldT <= 0) return false;
  return nx * Math.cos(t.shieldA) + ny * Math.sin(t.shieldA) < -SHIELD_ARC;
}

function abRush(p) {
  const dx = p.input.aimX - p.x, dy = p.input.aimY - p.y;
  const d = Math.hypot(dx, dy) || 1;
  p.rushNX = dx / d; p.rushNY = dy / d;
  p.rushT = RUSH_T;
  p.rushVictim = null;
  p.sliding = false;
  if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
  else p.dir = dy > 0 ? 'down' : 'up';
  burst(p.x, p.y + 4, '#dfe8f4', 8, 45, 0.4, true);
  if (nearPlayer(p.x, p.y)) SFX.dodge();
}
// one step of the charge, called from updatePlayer's movement branch with the
// wall verdict for this frame. The first rival in the path is grabbed and
// carried; the end of the line (or a wall) is where the slam happens.
function rushStep(p, mv, dt) {
  // plowed snow off the front
  p.rushFxT = (p.rushFxT || 0) - dt;
  if (p.rushFxT <= 0) {
    p.rushFxT = 0.04;
    burst(p.x + p.rushNX * 5, p.y + 4, '#eef4fb', 2, 30, 0.35, true);
  }
  // p.rushVictim is the BODY, whatever kind it is: the charge picks up a deer
  // or a worker bot the same way it picks up a rival, and slams it just as hard
  const v = p.rushVictim;
  if (!v) {
    for (const q of unitsHit(p, p.x, p.y, ROLL_HIT_R + PLAYER_R)) {
      p.rushVictim = q;
      if (q instanceof Player) risePlayer(q);
      stunUnit(q, 0.3); // manhandled: nothing they hold survives the grab
      burst(q.x, unitMidY(q), '#eef4fb', 6, 40, 0.4, true);
      if (nearPlayer(q.x, q.y)) SFX.hit();
      break;
    }
  } else if (unitAlive(v)) {
    // carried on the shoulder: held one body ahead, stun refreshed so their
    // own step stays limp until the slam
    stunUnit(v, 0.2);
    const wx = p.x + p.rushNX * 9, wy = p.y + p.rushNY * 9;
    moveEntity(v, wx - v.x, wy - v.y, unitRadius(v));
  } else {
    p.rushVictim = null; // it died on the way: the charge runs on empty
  }
  const wall = mv.blockedX || mv.blockedY;
  if (wall || p.rushT <= 0) rushEnd(p, wall);
}
function rushEnd(p, wall) {
  p.rushT = 0;
  const v = p.rushVictim;
  p.rushVictim = null;
  p.vx = p.rushNX * 60; p.vy = p.rushNY * 60;
  // A charge stopped by a rival's BUILDING slams the building: the tile just
  // past the body is whatever was driven into, and it takes the wall slam's
  // own number - the same blow a carried body would have taken into it.
  if (wall) {
    const bx = p.x + p.rushNX * (PLAYER_R + 6), by = p.y + p.rushNY * (PLAYER_R + 6);
    const st = structOf(objAt(Math.floor(bx / TILE), Math.floor(by / TILE)));
    if (structFoe(p, st)) hurtStruct(st, Math.round(RUSH_DMG * RUSH_WALL_MUL), p);
  }
  if (v && unitAlive(v)) {
    const mul = wall ? RUSH_WALL_MUL : 1;
    hurtUnit(v, Math.round(RUSH_DMG * mul), p.rushNX, p.rushNY, p, { kb: 110 * mul });
    if (!v.dead) stunUnit(v, RUSH_STUN * mul);
    burst(v.x, v.y - 5, '#e04a54', 8, 50, 0.5);
    burst(v.x, v.y - 4, '#eef4fb', 10, 55, 0.5, true);
    if (p === player || v === player) state.shake = Math.max(state.shake, wall ? 6 : 4);
    if (nearPlayer(v.x, v.y)) SFX.hit();
  } else if (wall) {
    p.vx = -p.rushNX * 40; p.vy = -p.rushNY * 40; // the thud, without a body to spend it on
    burst(p.x + p.rushNX * 6, p.y - 2, '#eef4fb', 8, 45, 0.45, true);
    if (p === player) state.shake = Math.max(state.shake, 3);
    if (nearPlayer(p.x, p.y)) SFX.hit();
  }
}

function abStomp(p) {
  const px = p.x, py = p.y;
  // one list, every living thing in the ring: players, wildlife and worker bots
  // take the same damage, the same shove and the same beat of stun
  for (const q of unitsHit(p, px, py, STOMP_R)) {
    const d = Math.hypot(q.x - px, q.y - py) || 1;
    const nx = (q.x - px) / d, ny = (q.y - py) / d;
    hurtUnit(q, STOMP_DMG, nx, ny, p, { kb: STOMP_KB });
    if (!q.dead) { stunUnit(q, STOMP_STUN); q.kbx += nx * STOMP_KB; q.kby += ny * STOMP_KB; }
  }
  // the ring does not stop at bodies: every rival building it touches takes
  // the same blow, damped once by STRUCT_DR inside hurtStruct (js/actions.js)
  for (const s of structsNear(p, px, py, STOMP_R)) hurtStruct(s, STOMP_DMG, p);
  if (PRACTICE) abHitDummies(px, py, STOMP_R, STOMP_DMG);
  craters.push({ x: px, y: py + 3, team: p.team, t: 0 });
  abFx.push({ kind: 'ring', x: px, y: py, r: STOMP_R, t: 0, col: '#f4f7ff' });
  // the shockwave: one ring of snow thrown outward
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    particles.push({
      x: px + Math.cos(a) * 6, y: py + 2 + Math.sin(a) * 4,
      vx: Math.cos(a) * 90, vy: Math.sin(a) * 55 - 15,
      life: 0.4, maxLife: 0.35, color: i % 3 ? '#eef4fb' : '#cfd8e8', size: i % 2 ? 2 : 1, grav: 60,
    });
  }
  if (p === player) state.shake = Math.max(state.shake, 5);
  if (nearPlayer(px, py)) SFX.break_();
}

// THE EXECUTE lands: the overhead cut through the wedge ahead, worth the base
// plus a share of every point of life the body under it has already lost -
// the three keys before this one are how that life went missing. The same
// blow for every kind of unit: a wolf at a sliver is finished like a rival.
function execDmg(q) {
  const max = q.maxHp || q.hp;
  return EXEC_DMG + Math.min(EXEC_BONUS_MAX, Math.round(Math.max(0, max - q.hp) * EXEC_MISSING));
}
function abExecute(p) {
  const a = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
  const nx = Math.cos(a), ny = Math.sin(a);
  for (const q of unitsInCone(p, p.x, p.y, a, EXEC_R, EXEC_HALF)) {
    const dmg = execDmg(q);
    hurtUnit(q, dmg, nx, ny, p, { kb: EXEC_KB, crit: dmg > EXEC_DMG * 2 });
    burst(q.x, unitMidY(q), '#e05a4a', 10, 55, 0.5);
    burst(q.x, unitMidY(q), '#f4f7ff', 6, 45, 0.4, true);
    if (p === player || q === player) state.shake = Math.max(state.shake, 5);
  }
  for (const s of structsInCone(p, p.x, p.y, a, EXEC_R, EXEC_HALF)) hurtStruct(s, EXEC_DMG, p);
  if (PRACTICE) abHitDummies(p.x + nx * EXEC_R * 0.5, p.y + ny * EXEC_R * 0.5, EXEC_R * 0.5, EXEC_DMG);
  abFx.push({ kind: 'wedge', x: p.x, y: p.y - 2, a, r: EXEC_R, half: EXEC_HALF, t: 0, col: '#e05a4a' });
  burst(p.x + nx * 10, p.y - 2 + ny * 8, '#eef4fb', 8, 45, 0.4, true);
  if (nearPlayer(p.x, p.y)) SFX.break_();
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
// step from updatePlay: craters drag, and nets fly their lines. (The piercing
// shot rides the arrows array, js/sim.js, and the grapple lives on its
// caster's body - neither leaves a thing behind to tick here.)

// Each of them is asked about through `sideOf` (js/actions.js), which hands
// unitsNear/unitsHit the side a thing in the world is on rather than a living
// caster. Everything those two return is fair game: players, wildlife AND worker
// bots, none of them a special case.
// This is the other half: who to credit a kill to - the caster, if they are
// still standing. A trap that outlives its hunter kills for nobody.
function abCredit(w) { const o = players[w.owner]; return o && !o.dead ? o : null; }

function updateAbilityWorld(dt) {
  for (let i = abFx.length - 1; i >= 0; i--) {
    abFx[i].t += dt;
    if (abFx[i].t >= AB_FX_T) abFx.splice(i, 1);
  }
  for (let i = craters.length - 1; i >= 0; i--) {
    const z = craters[i];
    z.t += dt;
    if (z.t > CRATER_T) { craters.splice(i, 1); continue; }
    // deep snow is deep snow for everything that has to cross it, refreshed
    // every step spent inside
    for (const q of unitsNear(sideOf(z), z.x, z.y - 4, CRATER_R)) slowUnit(q, 0.15, CRATER_SLOW);
  }
  for (let i = nets.length - 1; i >= 0; i--) {
    const n = nets[i];
    n.x += n.nx * NET_SPD * dt;
    n.y += n.ny * NET_SPD * dt;
    n.d += NET_SPD * dt;
    n.spin += dt * 14;
    let dead = n.d >= NET_RANGE;
    if (!dead && isSolidTile(Math.floor(n.x / TILE), Math.floor(n.y / TILE))) {
      // a net that ends on a rival's building lands on it, the way a shot does
      const st = structOf(objAt(Math.floor(n.x / TILE), Math.floor(n.y / TILE)));
      if (structFoe(sideOf(n), st)) hurtStruct(st, NET_DMG, abCredit(n));
      burst(n.x, n.y, '#cfd8e8', 4, 30, 0.3, true);
      dead = true;
    }
    // the first body in the way tangles in it, whatever kind of body it is
    if (!dead) for (const q of unitsHit(sideOf(n), n.x, n.y + 6, 8)) {
      if (q instanceof Player && abShieldBlocks(q, n.nx, n.ny)) {
        burst(n.x, n.y, '#cfd8e8', 6, 40, 0.35, true); dead = true; break;
      }
      hurtUnit(q, NET_DMG, n.nx, n.ny, abCredit(n), { kb: 40 });
      if (!q.dead) netUnit(q, NET_SLOW_T, NET_SLOW); // the drape the slow is read off
      burst(q.x, unitMidY(q), '#cfd8e8', 8, 45, 0.4, true);
      dead = true;
      break;
    }
    if (dead) nets.splice(i, 1);
  }
}

// ---- drawing: the world layer --------------------------------------------
// Flat things on the snow, drawn before the drops and the entities: the
// pierce telegraph is as plainly visible as the shot will be, to BOTH sides -
// the game is readable first, sneaky second.
// ---- the shapes ----
// One vocabulary for every blow with an area: a WEDGE (the sword, the slam,
// the execute - inCone's exact shape) and a RING (the stomp). Each is a
// 1px-seated dotted outline with a sparse hash inside so the snow still
// reads through it, drawn in world px with the camera already subtracted.
// `fill` 0..1 is how much of the inside is hashed - a wind-up fills in as it
// nears landing, a landed flash is full and fades.
function drawWedge(px, py, a, r, half, col, alpha, fill) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  const steps = Math.max(6, Math.round(r * half / 2.5));
  for (let i = 0; i <= steps; i++) {
    const t = a - half + (i / steps) * half * 2;
    const x = Math.round(px + Math.cos(t) * r), y = Math.round(py + Math.sin(t) * r);
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y + 1, 2, 2);
    ctx.fillStyle = col; ctx.fillRect(x, y, 2, 2);
  }
  for (const t of [a - half, a + half]) {
    for (let s = 4; s < r - 1; s += 3) {
      const x = Math.round(px + Math.cos(t) * s), y = Math.round(py + Math.sin(t) * s);
      ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
    }
  }
  if (fill > 0) {
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = col;
    for (let s = 6; s < r * fill; s += 4) {
      const n = Math.max(2, Math.round(s * half / 3));
      for (let i = 0; i <= n; i++) {
        const t = a - half + (i / n) * half * 2;
        if ((i + Math.round(s / 4)) % 2) continue;
        ctx.fillRect(Math.round(px + Math.cos(t) * s), Math.round(py + Math.sin(t) * s), 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
function drawRing(px, py, r, col, alpha, fill) {
  ctx.globalAlpha = alpha;
  const n = Math.max(12, Math.round(r * 1.2));
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.round(px + Math.cos(t) * r), y = Math.round(py + Math.sin(t) * r);
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y + 1, 2, 2);
    ctx.fillStyle = col; ctx.fillRect(x, y, 2, 2);
  }
  if (fill > 0) {
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = col;
    for (let s = 5; s < r * fill; s += 4) {
      const m = Math.round(s * 1.1);
      for (let i = 0; i < m; i++) {
        if ((i + Math.round(s / 4)) % 2) continue;
        const t = (i / m) * Math.PI * 2;
        ctx.fillRect(Math.round(px + Math.cos(t) * s), Math.round(py + Math.sin(t) * s), 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
// a dashed line marching from (x0, y0) out along (nx, ny) for `len` px - the
// pierce's and the charge's telegraph
function drawTeleLine(x0, y0, nx, ny, len, col, alpha, now, ex, ey) {
  const march = (now * 60) % 4; // dashes crawl toward the landing
  ctx.globalAlpha = alpha;
  for (let s = 10 + march; s < len; s += 4) {
    const px = Math.round(x0 + nx * s - ex), py = Math.round(y0 + ny * s - ey);
    if (px < -2 || py < -2 || px > WV_W + 2 || py > WV_H + 2) continue;
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(px, py + 1, 1, 1);
    ctx.fillStyle = col; ctx.fillRect(px, py, 1, 1);
  }
  ctx.globalAlpha = 1;
}
// the sword's sweep, drawn over the bodies (js/render.js beside the E swing
// arcs): the wedge it reached, fading, and a bright edge sweeping across it
function drawSlashes(ex, ey) {
  for (const s of slashes) {
    const px = Math.round(s.x - ex), py = Math.round(s.y - ey);
    if (px < -40 || py < -40 || px > WV_W + 40 || py > WV_H + 40) continue;
    const prog = s.t / SLASH_T;
    drawWedge(px, py, s.a, s.r, s.half, s.hit ? '#ffd95c' : '#f4f7ff', 0.7 * (1 - prog), 0);
    const e = s.a - s.half + prog * s.half * 2; // the edge, across the wedge over the sweep
    ctx.globalAlpha = 0.9 - prog * 0.5;
    for (let i = 0; i < 3; i++) {
      const t = e - i * 0.18;
      const rr = s.r - 1 - i * 2;
      for (let k = 6; k < rr; k += 2) {
        ctx.fillStyle = i ? '#cfe0f2' : '#ffffff';
        ctx.fillRect(Math.round(px + Math.cos(t) * k), Math.round(py + Math.sin(t) * k), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
}

function drawAbilityGround(ex, ey, now) {
  // every wind-up's telegraph, live off the caster and drawn for BOTH sides:
  // the piercing shot's line, the charge's line, the stomp's ring, the
  // slam's and the execute's wedge - each in the wind-up red, hot gold for
  // the last quarter, filling in as the landing nears. It teaches the caster
  // what the key reaches, and it gives whoever is inside the whole wind-up
  // to not be
  for (const p of players) {
    if (!p.active || p.dead || inAir(p) || p.castT <= 0) continue;
    const ab = CLASS_AB[p.cls][p.castAb];
    if (!ab) continue;
    const closing = castProg(p);
    const col = closing > 0.75 ? TELE_HOT : TELE_COL;
    const px = Math.round(p.x - ex), py = Math.round(p.y - 2 - ey);
    if (px < -80 || py < -80 || px > WV_W + 80 || py > WV_H + 80) continue;
    const dx = p.input.aimX - p.x, dy = p.input.aimY - (p.y - BOW_Y);
    const a = Math.atan2(dy, dx), nx = Math.cos(a), ny = Math.sin(a);
    if (ab.id === 'pierce' || ab.id === 'rush') {
      const range = ab.id === 'pierce' ? PIERCE_RANGE : RUSH_SPD * RUSH_T;
      const y0 = ab.id === 'pierce' ? p.y - BOW_Y : p.y;
      let len = range;
      for (let s = 10; s < range; s += 4) {
        if (isSolidTile(Math.floor((p.x + nx * s) / TILE), Math.floor((y0 + ny * s) / TILE))) { len = s; break; }
      }
      drawTeleLine(p.x, y0, nx, ny, len, col, 0.5 + 0.45 * closing, now, ex, ey);
      if (ab.id === 'rush') {
        // the end of the line: where the charge stops and the slam happens
        ctx.globalAlpha = 0.6 + 0.4 * closing;
        ctx.fillStyle = col;
        for (let i = -3; i <= 3; i++) ctx.fillRect(Math.round(p.x + nx * len - ny * i - ex), Math.round(y0 + ny * len + nx * i - ey), 1, 1);
        ctx.globalAlpha = 1;
      }
    } else if (ab.id === 'stomp') {
      drawRing(px, py + 2, STOMP_R, col, 0.55 + 0.4 * closing, closing);
    } else if (ab.id === 'exec') {
      drawWedge(px, py, a, EXEC_R, EXEC_HALF, col, 0.55 + 0.4 * closing, closing);
    } else if (ab.id === 'shield' && p.castSlam) {
      drawWedge(px, py, a, SLAM_R, SLAM_HALF, col, 0.55 + 0.4 * closing, closing);
    }
  }
  // where a blow landed: the same shape, in the blow's own colour, full and
  // gone in a beat
  for (const f of abFx) {
    const px = Math.round(f.x - ex), py = Math.round(f.y - ey);
    if (px < -60 || py < -60 || px > WV_W + 60 || py > WV_H + 60) continue;
    const prog = f.t / AB_FX_T;
    const alpha = 0.9 * (1 - prog);
    if (f.kind === 'wedge') drawWedge(px, py, f.a, f.r + prog * 3, f.half, f.col, alpha, 1 - prog);
    else drawRing(px, py + 2, f.r + prog * 4, f.col, alpha, 1 - prog);
  }
  for (const z of craters) {
    const px = Math.round(z.x - ex), py = Math.round(z.y - ey);
    if (px < -40 || py < -40 || px > WV_W + 40 || py > WV_H + 40) continue;
    const a = Math.max(0, 1 - z.t / CRATER_T);
    // dithered pressed-snow bowl: pixels thin out toward the rim
    for (let dy = -CRATER_R; dy <= CRATER_R; dy += 2) {
      for (let dx = -CRATER_R; dx <= CRATER_R; dx += 2) {
        const d = Math.hypot(dx, dy * 1.6);
        if (d > CRATER_R) continue;
        const h = hash2(z.x + dx, z.y + dy);
        if (h > 0.28 + 0.55 * (1 - d / CRATER_R)) continue;
        ctx.fillStyle = h < 0.18 ? 'rgba(118,144,186,' + (a * 0.5).toFixed(2) + ')'
          : 'rgba(160,182,214,' + (a * 0.4).toFixed(2) + ')';
        ctx.fillRect(px + dx, py + Math.round(dy * 0.62), 1, 1);
      }
    }
    // the rim: shoved-up snow, lit pale
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * Math.PI * 2 + 0.2;
      ctx.fillStyle = 'rgba(238,244,251,' + (a * 0.6).toFixed(2) + ')';
      ctx.fillRect(px + Math.round(Math.cos(an) * CRATER_R * 0.9), py + Math.round(Math.sin(an) * CRATER_R * 0.55), 2, 1);
    }
  }
}

// airborne ability bodies, drawn with the arrows: the net spinning open, and
// the grapple's taut rope between a reeling body and its anchor
function drawAbilityAir(ex, ey, now) {
  for (const p of players) {
    if (!p.active || p.dead || inAir(p) || p.grapT <= 0) continue;
    // the rope: dark-seated tan dots every couple of px from chest to anchor,
    // and the steel hook biting where it caught
    const x0 = p.x, y0 = p.y - 4;
    const dx = p.grapX - x0, dy = p.grapY - 4 - y0;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    for (let s = 3; s < d - 2; s += 2) {
      const px = Math.round(x0 + nx * s - ex), py = Math.round(y0 + ny * s - ey);
      if (px < -2 || py < -2 || px > WV_W + 2 || py > WV_H + 2) continue;
      ctx.fillStyle = '#0d1226';
      ctx.fillRect(px, py + 1, 1, 1);
      ctx.fillStyle = '#a89263';
      ctx.fillRect(px, py, 1, 1);
    }
    const hx = Math.round(p.grapX - ex), hy = Math.round(p.grapY - 4 - ey);
    ctx.fillStyle = '#0d1226';
    ctx.fillRect(hx - 2, hy - 1, 5, 3);
    ctx.fillStyle = '#c8d2e4';
    ctx.fillRect(hx - 1, hy - 1, 3, 1);
    ctx.fillRect(hx - 2, hy, 1, 2);
    ctx.fillRect(hx + 2, hy, 1, 2);
  }
  for (const n of nets) {
    const px = Math.round(n.x - ex), py = Math.round(n.y - ey);
    if (px < -12 || py < -12 || px > WV_W + 12 || py > WV_H + 12) continue;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(n.spin);
    ctx.fillStyle = '#0d1226';
    for (let k = -3; k <= 3; k += 3) { ctx.fillRect(k - 1, -4, 1, 8); ctx.fillRect(-4, k - 1, 8, 1); }
    ctx.fillStyle = '#cfd8e8';
    for (let k = -3; k <= 3; k += 3) { ctx.fillRect(k, -4, 1, 8); ctx.fillRect(-4, k, 8, 1); }
    ctx.fillStyle = '#8b93a8'; // the weights on the corners
    ctx.fillRect(-4, -4, 2, 2); ctx.fillRect(3, -4, 2, 2);
    ctx.fillRect(-4, 3, 2, 2); ctx.fillRect(3, 3, 2, 2);
    ctx.restore();
  }
}

// ---- drawing: on the body ------------------------------------------------
// The pose a cast (or the net shot's recoil hop, or the rush's lean) puts on
// the sprite itself: drawPlayer applies dx/dy/rot to the body draw, so every
// ability visibly happens TO the model, not just around it.
function abilityPose(p) {
  if (p.rushT > 0) {
    return { dx: 0, dy: -1, rot: 0.26 * (p.rushNX >= 0 ? 1 : -1) };
  }
  if (p.hopT > 0) {
    return { dx: 0, dy: -Math.round(4 * Math.sin(Math.PI * (1 - p.hopT / 0.3))), rot: 0 };
  }
  if (p.castT <= 0 || p.castAb < 0) return null;
  const ab = CLASS_AB[p.cls][p.castAb];
  const prog = 1 - p.castT / ab.cast;
  switch (ab.id) {
    // the locked draw: leant back off the aim, planted, and it does not move
    // again until the loose - the body itself is part of the telegraph
    case 'pierce': return { dx: p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0, dy: 1, rot: 0 };
    case 'net': return { dx: p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0, dy: 0, rot: 0 }; // braced back
    case 'grap': return { dx: 0, dy: -1, rot: 0.1 * (p.dir === 'left' ? -1 : 1) };  // arm slung forward
    case 'snow': return { dx: 0, dy: 2, rot: 0 };                                   // the kneel down
    case 'shield': return p.castSlam
      ? { dx: p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0, dy: prog < 0.6 ? 1 : -1, rot: 0 } // coiled back, then the drive
      : { dx: 0, dy: 1, rot: 0 };                                                   // planted
    case 'rush': return { dx: 0, dy: prog < 0.5 ? 1 : 0, rot: 0.14 * (p.dir === 'left' ? -1 : 1) }; // head down, feet dug in
    case 'stomp': return { dx: 0, dy: -Math.round(6 * Math.sin(Math.PI * prog)), rot: 0 }; // the leap
    case 'exec': return { dx: 0, dy: prog < 0.8 ? -Math.round(3 * prog) : 2, rot: 0 }; // the blade climbs, then comes down
  }
  return null;
}

// Everything a STATUS leaves on a body, drawn over whatever sprite is
// wearing it: the net drape, the sprung jaws at rooted feet, the flames, and
// the gold mark chevrons (root and mark currently have no caster in the
// game, but the tells stay with the universal status set - see Known drift,
// docs/dev/checklists.md). Takes the sprite's
// own box, so a rabbit, a worker bot
// and a player wear the same four tells at their own size - a state you
// cannot see is a rule you cannot play around, and that is as true of a deer
// as of a rival. Called by drawAbilityOnPlayer below and by drawAnimal /
// drawBird / drawRobot (js/draw-world.js).
function drawUnitStates(e, px, py, w, h, now) {
  if (e.netT > 0) {
    ctx.globalAlpha = Math.min(1, e.netT / 0.4);
    ctx.fillStyle = '#cfd8e8';
    // a 3px mesh inside the sprite's own box, however big that box is
    for (let x = 3; x < w - 2; x += 3) ctx.fillRect(px + x, py + 3, 1, h - 5);
    for (let y = 4; y < h - 2; y += 3) ctx.fillRect(px + 3, py + y, w - 6, 1);
    ctx.fillStyle = '#8b93a8';
    ctx.fillRect(px + 3, py + h - 3, w - 6, 1); // the sag at the hem
    ctx.globalAlpha = 1;
  }
  if (e.rootT > 0) {
    // the sprung jaws, closed on the feet
    ctx.fillStyle = '#3c4356';
    ctx.fillRect(px + 4, py + h - 2, w - 8, 2);
    ctx.fillStyle = '#c8d2e4';
    for (let k = 0; k * 2 + 5 < w - 4; k++) ctx.fillRect(px + 5 + k * 2, py + h - 3, 1, 1);
  }
  if (e.burnT > 0) {
    // Alight: tongues licking UP off the crown, and the snow under the feet
    // lit by them - never a wash over the body, because a burning rival still
    // has to read as the rival it is. Phased off the body's own burn clock, so
    // two burning things are never in lockstep and no global clock is involved.
    const ph = e.burnT * 9;
    const n = Math.max(2, Math.min(4, w >> 2));
    for (let k = 0; k < n; k++) {
      const fx = px + 1 + Math.round((w - 3) * ((k + 0.5) / n));
      const lift = 2 + Math.round(2.2 * (1 + Math.sin(ph + k * 2.1)));
      ctx.fillStyle = '#e0533a';
      ctx.fillRect(fx, py - lift, 2, lift + 1);
      ctx.fillStyle = '#ff9440';
      ctx.fillRect(fx, py - lift + 1, 1, lift);
      ctx.fillStyle = '#ffd95c';
      ctx.fillRect(fx, py - lift, 1, 1);
    }
    ctx.globalAlpha = 0.45 + 0.2 * Math.sin(ph * 1.7);
    ctx.fillStyle = '#ff9440';
    ctx.fillRect(px + 2, py + h - 1, w - 4, 1);
    ctx.globalAlpha = 1;
  }
  if (e.markT > 0) {
    // the mark: gold chevrons falling toward the head, for everyone
    const ph = (now * 2.2) % 1;
    ctx.globalAlpha = e.markT < 0.6 ? e.markT / 0.6 : 1;
    const mx = px + (w >> 1) - 3;
    for (let k = 0; k < 2; k++) {
      const y = py - 8 - 5 * k + Math.round(ph * 4);
      ctx.fillStyle = '#0f1632';
      ctx.fillRect(mx, y + 1, 6, 2);
      ctx.fillStyle = '#f2cc6a';
      ctx.fillRect(mx, y, 2, 2); ctx.fillRect(mx + 4, y, 2, 2); ctx.fillRect(mx + 2, y + 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}

// The player's own layer: the one state only a player can be in - a raised
// shield - over the four every unit shares.
function drawAbilityOnPlayer(p, px, py, now) {
  if (p.shieldT > 0) {
    const a = p.shieldA;
    ctx.save();
    ctx.translate(px + 8 + Math.round(Math.cos(a) * 7), py + 8 + Math.round(Math.sin(a) * 5));
    ctx.rotate(a);
    ctx.fillStyle = '#242a3a';
    ctx.fillRect(-1, -7, 4, 14);
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(-1, -6, 3, 12);
    ctx.fillStyle = '#c8d2e4';
    ctx.fillRect(-1, -6, 1, 12);
    ctx.fillStyle = TEAMS[skin(p.team)].mark; // the trim carries the side
    ctx.fillRect(0, -2, 1, 4);
    ctx.restore();
  }
  drawUnitStates(p, px, py, 16, 16, now);
}

// ---- the strip icons -----------------------------------------------------
// The eight ability icons: detailed 32x32 char grids in the sprite system's
// grammar (sprites.md - new sprites bake beside the code that draws them),
// AB32[cls][key] in CLASS_AB's own order, baked lazily onto their own
// canvases. Drawn by the strip's ability wells and the ability tooltip
// (drawClassAbCell / tipClassAb, js/ui.js). Each icon repeats the ability's
// in-world look - the pierce's gold line, the net's corner weights, the
// grapple's sagging rope - so the well and the snow speak the same picture.
const AB32_PAL = {
  o: '#141a2c', k: '#0f1632',
  W: '#f4f7ff', b: '#cfe0f2', B: '#9fb6d8',
  C: '#c8d2e4', s: '#8b93a8', S: '#5f6f96', D: '#3c4356',
  t: '#e8dcb4', d: '#a89263', w: '#a8794a', u: '#6e4a28',
  g: '#f2cc6a', G: '#b98a2e',
  r: '#e05a4a', R: '#a03428', p: '#f2937f',
  H: '#d9ad72', h: '#8a6d50', n: '#5c4a38',
  E: '#cfd8e8', e: '#8b93a8',
};
const AB32 = [
  [ // HUNTER
    [ // PIERCING SHOT: the shaft already loosed down the thin gold telegraph
      // line, the flash still on the arrowhead
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '..b.............................',
      '......rr....................g...',
      '......rrrr....................W.',
      '.bbb...rrrr....................g',
      '.....ooooooooooooooooooooooooo..',
      '.....ottttttttttttttttsssSSWWo.W',
      'g.g.goddddddddddddddddsssSSWWg.g',
      '.....ooooooooooooooooooooooooo.W',
      '.bbb...rrrr....................g',
      '......rrrr....................W.',
      '......rr....................g...',
      '..b.............................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    [ // NET SHOT: the weighted net mid-flight - the rope weave bright on the
      // throw lines, and the four steel corner weights the air sprite wears
      '................................',
      '................................',
      '................................',
      '.....ooo.................ooo....',
      '....osCso...............osCso...',
      '....osCsoEWEEEWEEEWEEEWEosCso...',
      '....osSso...............osSso...',
      '.....ooo..e...e...e...e..ooo....',
      '......e...e...e...e...e...e.....',
      '......WeeeWeeeWeeeWeeeWeeeW.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......WeeeWeeeWeeeWeeeWeeeW.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......WeeeWeeeWeeeWeeeWeeeW.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......WeeeWeeeWeeeWeeeWeeeW.....',
      '......e...e...e...e...e...e.....',
      '.....ooo..e...e...e...e..ooo....',
      '....osCso.e...e...e...e.osCso...',
      '....osCsoEWEEEWEEEWEEEWEosCso...',
      '....osSso...............osSso...',
      '.....ooo.................ooo....',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    [ // GRAPPLE: the steel hook bitten into a trunk top-right, the rope
      // sagging home toward the reeling hand
      '......................oooooooooo',
      '......................ouwwwwwwww',
      '......................ouwwwwwwuw',
      '......................ouwwuwwwww',
      '......................ouwwwwwwww',
      '......................ouwwwwwuww',
      '......................ouwwwwwwww',
      '......................ouwwwwwwww',
      '......................Cuwuwwwwww',
      '......................oCswwwwwww',
      '.....................oCuwwwwuwww',
      '....................oCsuwwwwwwww',
      '...................oCsCCswwuwwww',
      '...................d..oooooooooo',
      '..................dk............',
      '..................d.............',
      '.................dk.............',
      '................dk..............',
      '................d...............',
      '...............dk...............',
      '..............dk................',
      '..............d.................',
      '.............dk.................',
      '............dk..................',
      '...........dk...................',
      '.........ddk....................',
      '........ddk.....................',
      '..b..dddkk......................',
      '....ddkk........................',
      '....kk..........................',
      '.b...b..........................',
      '................................',
    ],
    [ // SNOW COVER: the mound holding perfectly still, and the breath in the
      // cold air that is the one tell it still gives
      '................................',
      '................................',
      '................................',
      '................................',
      '........W.................W.....',
      '.........................bb.....',
      '................................',
      '................................',
      '....b...........................',
      '......................bWb.......',
      '......................bbB.......',
      '................................',
      '................................',
      '......W.............bW..........',
      '....................bb..........',
      '............................b...',
      '................................',
      '...........oWWWWWWWo............',
      '........oWWWWWWWWWWWWWo.........',
      '......oWWWWWWWWWWWWWWWWWo.......',
      '.....obbbbbbbbBBbbbbbbbbbo......',
      '.....obbbbbbbbbbbbbbbbbbbo......',
      '....obbbbbbbbbbbbbbbbbbbbbo.....',
      '.....obbbbbbbbbbbbbbbbbbbo......',
      '.....oBBBBBBBBBBBBBBBBBBBo......',
      '......oBBBBBBBBBBBBBBBBBo.......',
      '........oBBBBBBBBBBBBBo.........',
      '...........ooooooooo............',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  ],
  [ // WARRIOR
    [ // SHIELD WALL: the tower shield face-on - bright left edge, gold band
      // and boss, riveted corners
      '................................',
      '................................',
      '................................',
      '.........oooooooooooooo.........',
      '.........oCssssggssssSo.........',
      '.........oCksssggssskSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssogggGossSo.........',
      '.........oCssogWgGossSo.........',
      '.........oCssoggGGossSo.........',
      '.........oCssoooooossSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCksssggssskSo.........',
      '.........oCssssggssssSo.........',
      '..........oCsssggsssSo..........',
      '...........oCssggssSo...........',
      '.............oCggSo.............',
      '...............oo...............',
      '................................',
      '................................',
    ],
    [ // BULL RUSH: the warrior mid-charge - head tucked, the big pauldron
      // leading, gauntlet up, legs driving, speed lines and plowed snow
      '................................',
      '................................',
      '................................',
      '................................',
      '.....................oooooo.....',
      '....................oCssssso....',
      '...................oCsssssso....',
      '...................oCskkkkso....',
      '...................oCsssssso....',
      '..............oooooossssoo......',
      '.............oCCCCCCssssso......',
      '..bbb........oCCCCssssssso......',
      '..bbb.......oCCssssssssSSo......',
      '............oCsssssssssSSo......',
      '............ossssssssssSSo......',
      '...........orrssssssssSSo.......',
      '.bbb......orrrsssssssoCWCo......',
      '..........orrrsssssssoCCCo......',
      '..........orrrrssssssooooo......',
      '..........orrrrrsssssoo.........',
      '.........orrrrrrrrroo...........',
      '........oDDDo.oDDDo.............',
      '.bb....oDDDo...oDDDo............',
      '......oDDDo.....oDDo............',
      '.....oDDDo......oDDDoo..........',
      '....oDDDDo......oDDDDDo.........',
      '....oooooo......ooooooo.........',
      '...bb............bWb..bb........',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    [ // AVALANCHE STOMP: the boot coming down, the shock chevrons and thrown
      // snow already leaving the point of impact
      '................................',
      '................................',
      '.........oooooooo...............',
      '........oWWWWWWWWo..............',
      '........obbWWWWbbo..............',
      '........oooooooooo..............',
      '.........owwwwwwuo..............',
      '.........owwwwwwuo..............',
      '.........owwgwwwuo..............',
      '.........owwwwwwuo..............',
      '.........owwwwwwuo..............',
      '.........owwwwwwuo..............',
      '.........owwwwwwuoo.............',
      '.........owwwwwwwuooo...........',
      '.........owwwwwwwwwuooo.........',
      '.........owwwwwwwwwwwuoo........',
      '.........owwwwwwwwwwwwwuo.......',
      '........oDDDDDDDDDDDDDDDDo......',
      '........oDkDDkDDkDDkDDkDDo......',
      '........oooooooooooooooooo......',
      '..........WW...WW...WW..........',
      '........WW.....WW.....WW........',
      '......bb.......bb.......bb......',
      '....bb.........BB.........bb....',
      '.........WW.........WW..........',
      '.....W.......b....b.......W.....',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    [ // EXECUTE: the greatsword coming straight down - gold guard, wrapped
      // grip, a white gleam on the edge - and the blood already flying off it
      '................................',
      '................................',
      '..............oooo..............',
      '.............oGggGo.............',
      '..............oGGo..............',
      '..............oDko..............',
      '..............okDo..............',
      '..............oDko..............',
      '..............okDo..............',
      '..............oDko..............',
      '..........oooooooooooo..........',
      '.........oGgggggggggGo..........',
      '..........oooooooooooo..........',
      '.............oCssSo.............',
      '.............oWssSo.............',
      '.............oWssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.......r.....oCssSo.....r.......',
      '......r......oCssSo......r......',
      '.............oCssSo.............',
      '........r....oCssSo....r........',
      '.............oCssSo.............',
      '..........r..oCssSo..r..........',
      '..............oCSo..............',
      '..............oCSo..............',
      '...............oo...............',
      '................................',
      '................................',
    ],
  ],
];
const ab32Cache = new Map();
// the baked 32x32 icon for class ability (cls, i)
function classAbIcon(cls, i) {
  const key = cls + ':' + i;
  let cv = ab32Cache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const g = cv.getContext('2d');
    const rows = AB32[cls][i];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const col = AB32_PAL[row[c]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(c, r, 1, 1);
      }
    }
    ab32Cache.set(key, cv);
  }
  return cv;
}
