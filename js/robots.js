'use strict';
// The worker bots and the one flag per player the whole side reads: a bot's
// life from the bay's mouth to its wreck, the frame it spends deciding what to
// do, and the order marker it reads to decide it. Everything here is sim - a
// flag's pixels are the `what a flag looks like` group in js/draw-world.js,
// and how an AI PLAYER answers one is the `flag` rung in js/ai.js.
// ------------------------------------------------------------ workers
function makeRobot(sp) {
  const t = STRUCTS[sp.type].tiers[sp.tier]; // the bay's worker, or the barracks' soldier (makeSoldier): both carry botHp
  const m = structMouth(sp);
  let sx = m.x, sy = m.y;
  if (isSolidTile(Math.floor(sx / TILE), Math.floor(sy / TILE))) {
    // mouth blocked: the first free tile in the rings around the footprint
    const w = structW(sp), h = structH(sp);
    outer: for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy < h + r; dy++) for (let dx = -r; dx < w + r; dx++) {
        if (dx > -r && dx < w + r - 1 && dy > -r && dy < h + r - 1) continue;
        if (!isSolidTile(sp.tx + dx, sp.ty + dy)) { sx = (sp.tx + dx) * TILE + 8; sy = (sp.ty + dy) * TILE + 8; break outer; }
      }
    }
  }
  const b = {
    bot: true, // a machine, not wildlife: what isAnimalUnit (js/actions.js) reads
    x: sx, y: sy, hp: t.botHp, maxHp: t.botHp, vx: 0, vy: 0, // vx/vy: a bot never drifts, but a rival's aim leads by them (updateAI)
    home: sp, team: sp.team === undefined ? 0 : sp.team, owner: sp.owner === undefined ? 0 : sp.owner,
    tgt: null, workT: 0, atkCd: 0, avoid: null, avoidT: 0, nav: null,
    // the fight, all of it: what it is swinging at right now (drawRobot reads
    // it), and who hit it last - a struck worker fights back for ROBOT_MAD s
    atkAim: null, mad: null, madT: 0, madX: 0, madY: 0,
    carry: 0, // gold held, deposited at home
    moveT: 0, idleT: rand(0.3, 1), mvx: 0, mvy: 0, moving: false,
    animT: rng() * 2, flash: 0, kbx: 0, kby: 0, dead: false,
  };
  // a worker takes every state a player can be put under - snared,
  // netted, marked, alight - written by the same setters (`status effects`,
  // js/actions.js). A bot rolling out of the bay is not a different rulebook.
  clearUnitStatus(b);
  return b;
}

// A worker is a 12x10 body standing on its treads at b.y + 4, so its middle
// sits a pixel above the anchor. Same radius as a player: a bot in the open
// is as shootable as the rival who built it.
// `pad` is a shot's own `reach` - extra px for a bit with a BODY rather than
// a shaft's tip (the fist, the axe; js/tools.js). Absent for everything else.
function robotHit(b, x, y, pad) { return Math.hypot(b.x - x, b.y - 1 - y) < 7 + (pad || 0); }

// px/s a chassis is shoved by an ordinary blow. hurtUnit writes over it for
// anything carrying a shove of its own or a KNOCKBACK multiplier.
const ROBOT_KB = 40;
// an arrow landing on a worker - and a turret bolt too, since bolts ride the
// same pipeline. src is the shooter, for the feed line on the kill. Reached
// only through hurtUnit, which asks unitAlive first, so a merchant never
// arrives here - the guard below is the same question asked twice on purpose,
// since this is a named function and nothing stops a later caller finding it.
function hurtRobot(b, dmg, nx, ny, src) {
  if (!unitAlive(b)) return;
  // a worker under a flag remembers who hit it and swings back; with no flag
  // it is the same defenceless hauler it always was
  // madX/madY is where it was standing when it was hit: the leash it fights
  // back inside, so a raider cannot walk a worker off its post
  if (src && src.team !== b.team && flagOf(b)) { b.mad = src; b.madT = ROBOT_MAD; b.madX = b.x; b.madY = b.y; }
  b.hp -= dmg;
  b.flash = 0.12;
  b.kbx = nx * ROBOT_KB; b.kby = ny * ROBOT_KB;
  addDmgFloater(b.x, b.y - 12, dmg);
  burst(b.x, b.y - 2, '#c3c9d3', 6, 45, 0.35, true);
  burst(b.x, b.y - 2, '#ffb347', 3, 40, 0.3, true); // sparks off the plating
  if (nearPlayer(b.x, b.y)) SFX.hit();
  if (b.hp <= 0) robotDies(b, src);
}

// The wreck. Whatever gold it was hauling goes to whoever downed it - the
// final blow takes the cargo, which is what keeps shooting a loaded worker
// on its way home worth the arrows. A wreck nobody caused eats its load.
function robotDies(b, src) {
  b.dead = true;
  if (nearPlayer(b.x, b.y)) SFX.break_();
  burst(b.x, b.y - 4, '#98a1b0', 10, 50, 0.5, true);
  burst(b.x, b.y - 4, '#3b4150', 4, 35, 0.4);
  if (b.carry > 0) {
    if (src && src.inv) awardGold(src, b.carry, b.x, b.y);
    b.carry = 0;
  }
  // a soldier carries a bounty instead of cargo: whoever scraps one is paid
  // it on the spot (through awardGold, so the kill levels too) - the road
  // pays, which is what makes walking out to meet a wave worth the walk.
  // Five a wave, so no feed line: the fight is the news, not each wreck.
  if (b.kind === 'soldier') {
    if (src && src.inv && src.team !== b.team) awardGold(src, SOLDIER_BOUNTY, b.x, b.y);
    return;
  }
  // a downed worker is not a downed player: it makes the feed, never the kill
  // count. There is no merchant line any more: a merchant cannot be downed
  // (unitAlive, js/actions.js), so nothing reaches here carrying one.
  if (src && src.team !== b.team) logEvent(src.name + ' SCRAPPED A WORKER', src);
}

function updateRobot(b, dt) {
  b.flash = Math.max(0, b.flash - dt);
  b.atkCd = Math.max(0, b.atkCd - dt);
  b.kbx *= Math.pow(0.02, dt);
  b.kby *= Math.pow(0.02, dt);
  // every timed state on the chassis first - a burn can scrap it, and a wreck
  // must not then drive on (js/actions.js, `status effects`)
  updateUnitStatus(b, dt);
  if (b.dead) return;
  if (b.stunT > 0) {
    // rattled: the brain is off, but a shove still slides the chassis
    b.stunT = Math.max(0, b.stunT - dt);
    b.moving = false;
    if (Math.abs(b.kbx) + Math.abs(b.kby) > 1) moveEntity(b, b.kbx * dt, b.kby * dt, 3);
    b.x = Math.max(8, Math.min(WORLD * TILE - 8, b.x));
    b.y = Math.max(8, Math.min(WORLD * TILE - 8, b.y));
    return;
  }
  if (b.merchant) { updateMerchant(b, dt); return; } // the eagle's driver: its own brain, the shared body above
  if (b.kind === 'soldier') { updateSoldier(b, dt); return; } // a wave's soldier: the march (the `soldiers` banner below)
  const home = b.home;
  const hm = structMouth(home), hx = hm.x, hy = hm.y;
  let moving = false;
  const SPD = 40;

  // route there (reach 1 = stop beside a tile it cannot stand on); an
  // unreachable goal comes back as -1 and the caller drops it
  const walkToward = (px, py, reach) => {
    const n = navStep(b, px, py, 3, SPD, dt, reach);
    if (!n.ok) return -1;
    moving = true;
    return n.d;
  };

  // loiter around an anchor - home with no orders, the flag's post with them.
  // Steered by hand rather than routed, so the net/crater drag is folded in
  // here the way navStep does it for every walk with a goal (js/actions.js)
  const wander = (ax, ay) => {
    if (ax === undefined) { ax = hx; ay = hy; }
    const drag = unitMoveMul(b);
    if (b.moveT > 0) {
      b.moveT -= dt;
      moving = true;
      const mv = moveEntity(b, (b.mvx * 24 * drag + b.kbx) * dt, (b.mvy * 24 * drag + b.kby) * dt, 3);
      if (mv.blockedX || mv.blockedY) b.moveT = 0;
    } else {
      b.idleT -= dt;
      if (Math.abs(b.kbx) + Math.abs(b.kby) > 1) moveEntity(b, b.kbx * dt, b.kby * dt, 3); // shoved while idle
      if (b.idleT <= 0) {
        let ang = rng() * Math.PI * 2;
        if (Math.hypot(ax - b.x, ay - b.y) > 2.5 * TILE) ang = Math.atan2(ay - b.y, ax - b.x) + rand(-0.5, 0.5);
        b.mvx = Math.cos(ang); b.mvy = Math.sin(ang);
        b.moveT = rand(0.5, 1.2);
        b.idleT = rand(0.8, 2);
      }
    }
  };

  // walk to a post and stand on it: the flag's own hold, and a guard's ring
  const holdAt = (px, py) => {
    if (Math.hypot(px - b.x, py - b.y) > 22) { if (walkToward(px, py) >= 0) return; }
    wander(px, py);
  };

  const deposit = () => {
    if (b.carry <= 0) return;
    gainGold(players[b.owner] || player, b.carry);
    addFloater(hx, hy - 14, '+' + b.carry, RES_COLORS.gold);
    b.carry = 0;
    if (nearPlayer(hx, hy)) SFX.coin();
  };

  const harvest = () => {
    const t = b.tgt, ox = t.tx * TILE + 8, oy = t.ty * TILE + 8;
    t.flash = 0.1;
    t.shake = 0.22;
    if (t.type === 'tree' || t.type === 'deadTree') {
      const dry = t.type === 'deadTree';   // a rookery perch: quicker, same gold
      t.hp--;
      b.carry += dry ? YIELD.deadTreeHit : YIELD.treeHit;
      if (nearPlayer(ox, oy)) SFX.chop();
      burst(ox, oy - 10, '#eef4fb', 3, 35, 0.4, true);
      if (t.hp <= 0) {
        objects[idx(t.tx, t.ty)] = { type: 'stump', tx: t.tx, ty: t.ty, flash: 0, shake: 0 };
        b.carry += dry ? YIELD.deadTreeFall : YIELD.treeFall;
        if (t.rare) b.carry += YIELD.treeRare;
        burst(ox, oy - 8, '#eef4fb', 8, 45, 0.5, true);
        if (nearPlayer(ox, oy)) SFX.treeFall();
        if (dry) flushBirds(campAt(ox, oy), { x: ox, y: oy }); // the flock loses its perch (dormant: see the birds banner, wildlife.js)
        b.tgt = null;
      }
    } else {
      t.hp--;
      b.carry += YIELD.rockHit;
      if (nearPlayer(ox, oy)) SFX.mine();
      burst(ox, oy - 4, '#a8b0c4', 3, 35, 0.35, true);
      if (t.hp <= 0) {
        objects[idx(t.tx, t.ty)] = null;
        b.carry += YIELD.rockBreak;
        b.tgt = null;
      }
    }
  };

  // walk to the current target and swing at it; false = it gave the tile up
  const workTgt = () => {
    const txp = b.tgt.tx * TILE + 8, typ = b.tgt.ty * TILE + 8;
    if (Math.hypot(txp - b.x, typ - b.y) > 20) {
      // no route to it (walled in, or pinned on the way): leave it alone a while
      if (walkToward(txp, typ, 1) < 0) { b.avoid = b.tgt; b.avoidT = 12; b.tgt = null; return false; }
    } else {
      b.workT += dt;
      if (b.workT >= 0.9) { b.workT = 0; harvest(); }
    }
    return true;
  };
  // hold the current target if it still stands, otherwise take what `pick`
  // offers; false = there was nothing left to work
  const gather = (pick) => {
    if (b.tgt && objects[idx(b.tgt.tx, b.tgt.ty)] !== b.tgt) b.tgt = null;
    if (!b.tgt) b.tgt = pick();
    if (!b.tgt) return false;
    workTgt();
    return true;
  };
  const homeRun = () => { const d = walkToward(hx, hy); if (d >= 0 && d < 14) deposit(); };
  // anything a worker will cut, anywhere near a point, that no sibling has
  const cutNear = (cx, cy, r) => nearestObj(cx, cy, r, (o) =>
    (o.type === 'tree' || o.type === 'deadTree' || o.type === 'rock') && o !== b.avoid && !objTaken(b, o));

  // close on a foe and swing at it. `leash` (px, measured from lx/ly) is what
  // keeps a worker on a defensive job from being kited off it.
  const engage = (foe, lx, ly, leash) => {
    const pt = foePoint(foe, b.x, b.y - 1);
    if (leash !== undefined && Math.hypot(pt.x - lx, pt.y - ly) > leash) return false;
    if (Math.hypot(pt.x - b.x, pt.y - (b.y - 1)) > ROBOT_REACH) {
      // a building is a solid tile: stop beside it, not on it
      return walkToward(pt.x, pt.y, foe.tx !== undefined ? 1 : 0) >= 0;
    }
    b.atkAim = pt;
    if (b.atkCd <= 0) { b.atkCd = ROBOT_ATK_CD; robotStrike(b, foe, pt); }
    return true;
  };

  // ---- the flag is the order -------------------------------------------
  // No flag and this is the bay-centred gather it has always been. With one,
  // its kind says what the crew does with the ground inside its ring (the
  // `team flags` banner below), and only an ATTACK lets a worker chase.
  const fl = flagOf(b);
  const type = fl ? fl.type : null;
  const fx = fl ? fl.tx * TILE + 8 : hx, fy = fl ? fl.ty * TILE + 8 : hy;
  if (b.avoidT > 0) b.avoidT -= dt; else b.avoid = null;
  // anger only lives under a flag - an unflagged worker is the same
  // defenceless hauler it always was
  if (b.madT > 0 && fl && foeAlive(b, b.mad)) b.madT -= dt;
  else { b.mad = null; b.madT = 0; }
  b.atkAim = null;
  // one post each, spaced around the flag, so a crew holding ground is a
  // ring on it and not a pile
  const post = () => {
    const a = (Math.max(0, home.bots.indexOf(b))) * 2.4;
    holdAt(fx + Math.cos(a) * 18, fy + Math.sin(a) * 11);
  };

  if (!fl) {
    if (b.carry >= 8) homeRun();
    else if (!gather(() => nearestObj(hx, hy, 8, (o) =>
      (o.type === 'tree' || o.type === 'rock') && o !== b.avoid))) {
      if (b.carry > 0) homeRun(); else wander();
    }
  } else if (type === 'attack') {
    b.tgt = null;
    // whatever hostile is on it first, then the nearest thing inside the
    // ring - units before buildings - chased no further than a leash past
    // the ring's edge, so a raider cannot walk the crew off across the map
    const foe = robotFoeUnit(b, ROBOT_AGGRO) || flagFoe(b, fx, fy, true);
    if (!foe || !engage(foe, fx, fy, FLAG_R + ROBOT_LEASH)) post(); // nothing left to break: hold the ground
  } else if (b.carry >= 8) {
    homeRun();
  } else if (b.mad && engage(b.mad, b.madX, b.madY, ROBOT_LEASH)) {
    // struck at its post: swings back from where it was standing, and never
    // follows past the leash - chasing is what an attack flag is for
  } else if (type === 'defend') {
    b.tgt = null;
    // anything that comes into the ring is met, and never followed out of it
    const foe = flagFoe(b, fx, fy, false);
    if (!foe || !engage(foe, fx, fy, FLAG_R)) {
      if (b.carry > 0 && Math.hypot(hx - b.x, hy - b.y) < 40) homeRun();
      else post();
    }
  } else if (type === 'gather') {
    // everything inside the ring, nearest the flag first
    if (!gather(() => cutNear(fx, fy, FLAG_R / TILE))) {
      if (b.carry > 0) homeRun(); else post();
    }
  } else {
    // rally: come and stand. A load is banked only if home is right there.
    b.tgt = null;
    if (b.carry > 0 && Math.hypot(hx - b.x, hy - b.y) < 40) homeRun();
    else post();
  }

  b.animT += dt * (moving ? 8 : 0);
  b.moving = moving;
  b.x = Math.max(8, Math.min(WORLD * TILE - 8, b.x));
  b.y = Math.max(8, Math.min(WORLD * TILE - 8, b.y));

  if (b.hp <= 0 && !b.dead) robotDies(b, null);
}

// ------------------------------------------------------------ merchant
// Each eagle is DRIVEN by its team's merchant - the figure on the bird's neck
// in flight (drawEagle, js/boot.js) - who climbs down the moment it roosts
// and works the roost for its side: first the DEFENCE off the crash's two
// stump rings (a turret on the middle ring at each of the four corner
// bearings, then a wall on every outer-ring stump but the spur's gap and the
// one back corner its bay will take - guns inside a closed ring of walls,
// covering every angle, with its own way out through the bay's corner to
// fell and build beyond them), then the ring of pines beyond the outer ring
// felled to stumps so the base has more sites, then it keeps to the roost -
// where it becomes the SHOP (the `shop` banner, js/shop.js):
// walk up to either team's merchant and E opens its counter.
//
// It is a unit in `robots` with `merchant: true`: the same separation and
// draw pipelines a worker rides, dispatched to updateMerchant/drawMerchant by
// that flag (updateRobot's status/stun handling is shared). owner -1: it
// obeys no flag and pays nobody - its work is the eagle's, free like the
// crater, the same for both sides.
//
// It CANNOT BE KILLED, and it has no hp at all rather than a large number:
// unitAlive (js/actions.js) answers false for a merchant, which takes it out
// of every arrow, blow, sweep, turret mark and worker's quarry in one place.
// Both sides trade at both counters, so neither side may shoot one, and
// nothing may stand between a player and the shop they walked to.
const MERCH_SPD = 46;        // px/s
const MERCH_SWING_T = 0.7;   // s per axe swing (a pine is 4 hp: ~3 s a tree)
const MERCH_BUILD_T = 0.9;   // s of hammering to set a site
const MERCH_CLEAR_R = 7.2;   // tiles from the roost the felling reaches: one ring past BOOM_STUMP_R2 (boot.js), the outer wall ring
const MERCH_GATE_GAP = 1.3;  // tiles either side of the spur's centreline the wall ring leaves open - over SPUR_HW, so the track is never walled
const MERCH_CORNERS = [Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4]; // bearings off the spur's axis: a turret on the middle ring at each
const MERCH_BAY_GAP = 0.35;   // rad either side of the bay's bearing (merchBayDir: one of the two back corners) the wall ring leaves open - about four tiles at the ring, the merchant's own way out
const MERCH_WALL_R = 5.4;     // tiles from the roost the wall ring runs: the middle of the outer stump ring (BOOM_STUMP_R..BOOM_STUMP_R2, boot.js - which loads later, so this is a number and not a sum), one tile thick, every tile of it a site whether a stump stands there or not
const MERCH_HOP_T = 0.55;    // s of the hop off the bird
const MERCH_THINK = 0.35;    // s between job picks
// the barracks (STRUCTS.barracks): MERCH_BAY_T after the landing the merchant
// clears the woods MERCH_BAY_BACK tiles out from the roost - the footprint
// to the ground and a MERCH_BAY_RING ring round it to stumps, so the door
// opens onto walkable ground and there is room to fight at it - and raises
// the wave bay there, on the bay's corner (merchBayDir). Wrecked, it goes up again
// MERCH_BAY_REBUILD later; the clearing is already made, so the second
// build is the hammering alone.
const MERCH_BAY_T = 30;       // s after the landing the barracks is due
const MERCH_BAY_BACK = 8;     // tiles from the roost, on the bay's bearing (merchBayDir), its centre sits - outside the outer wall ring (BOOM_STUMP_R2), so the walls never cut through the yard
const MERCH_BAY_RING = 1;     // tiles of woods cleared round the footprint
const MERCH_BAY_SWING = 0.34; // s per axe swing on the clearing - the lane's pace, not the rim's, so the bay is up before the second minute
const MERCH_BAY_REBUILD = 45; // s after a wreck before it is raised again
const MERCH_BAY_HAMMER = 2.6; // s of hammering that sets the site

// the nearest tile to (tx, ty) nothing stands on, spiralling out
function freeTileNear(tx, ty, rMax) {
  for (let r = 0; r <= rMax; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = tx + dx, y = ty + dy;
      if (inWorld(x, y) && !objAt(x, y) && ground[idx(x, y)] !== 2) return { tx: x, ty: y };
    }
  }
  return null;
}

// the crash: the driver climbs down on the lane side of the roost and plans
// its gate off the stumps the impact left (eagleCrash, js/boot.js)
function spawnMerchant(e) {
  const lx = e.laneDir.x, ly = e.laneDir.y; // the spur's own direction: from the crater to its junction on the road (eagleCrash)
  const wx = e.x + lx * (EAGLE_TILE_R + 1.4) * TILE, wy = e.y + ly * (EAGLE_TILE_R + 1.4) * TILE;
  const at = freeTileNear(Math.floor(wx / TILE), Math.floor(wy / TILE), 6) || { tx: Math.floor(e.x / TILE), ty: Math.floor(e.y / TILE) };
  const b = {
    merchant: true, bot: true, kind: 'merchant', team: e.team, owner: -1, home: null,
    x: (at.tx + 0.5) * TILE, y: (at.ty + 0.5) * TILE, // no hp: nothing can hurt it (unitAlive)
    roost: e, plan: [], tgt: null, workT: 0, thinkT: 0, avoids: [], avoid: null, avoidT: 0, nav: null,
    bay: null, bayT: MERCH_BAY_T, baySite: null, // the barracks: the building once it stands, the clock to raising it, where
    hopT: MERCH_HOP_T, dir: 'down', moving: false, animT: 0, mvx: 0, mvy: 0, moveT: 0, idleT: 1,
    atkAim: null, atkCd: 0, mad: null, madT: 0, carry: 0, flash: 0, kbx: 0, kby: 0, dead: false,
  };
  clearUnitStatus(b);
  b.bayDir = merchBayDir(e);
  // the defence plan, off the crash's two stump rings (eagleCrash, boot.js),
  // every stump read by its bearing off the spur's axis (0 = toward the road):
  // TURRETS on the middle ring, the stump nearest each MERCH_CORNERS bearing,
  // so four guns cover every angle from inside; WALLS on every tile of the
  // one-tile band at MERCH_WALL_R - stump or bare ground alike, so the ring
  // is CLOSED (the tiles of a one-tile-thick circle touch at least corner to
  // corner, and a body cannot pass a corner) - except the spur's gap
  // (|lat| < MERCH_GATE_GAP, along the track) and MERCH_BAY_GAP round the
  // bay's bearing: two ways through, the road's and the merchant's own past
  // its bay, which is how it gets out to fell and build beyond the walls
  // (skipped from the start, so it is never walled in waiting for the bay).
  // Turrets first: the guns are the defence, the walls only keep a rusher
  // off them.
  const mid = [], outer = [];
  const R = Math.ceil(BOOM_STUMP_R2) + 1, ctx0 = Math.floor(e.x / TILE), cty0 = Math.floor(e.y / TILE);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const tx = ctx0 + dx, ty = cty0 + dy, o = objAt(tx, ty);
    if (!inWorld(tx, ty) || ground[idx(tx, ty)] === 2 || (o && o.type !== 'stump')) continue;
    const px = dx + 0.5 - (e.x / TILE - ctx0), py = dy + 0.5 - (e.y / TILE - cty0); // tiles, roost-relative
    const d = Math.hypot(px, py);
    const along = px * lx + py * ly, lat = px * -ly + py * lx, site = { tx, ty, d, along, lat, ang: Math.atan2(lat, along) };
    if (Math.abs(d - MERCH_WALL_R) <= 0.5) outer.push(site);                     // a wall takes the band, stump or not - the band first, so no stump in it is spent on a gun
    else if (o && d > BOOM_R - 0.3 && d <= BOOM_STUMP_R + 0.3) mid.push(site);  // a turret wants a stump, inside the band
  }
  const angDiff = (a, c) => { let x = a - c; while (x > Math.PI) x -= Math.PI * 2; while (x < -Math.PI) x += Math.PI * 2; return Math.abs(x); };
  const tur = [];
  for (const c of MERCH_CORNERS) {
    let best = null, bd = Infinity;
    for (const s of mid) {
      if (tur.includes(s)) continue;
      const k = angDiff(s.ang, c) * 4 + Math.abs(s.d - (BOOM_R + BOOM_STUMP_R) / 2);
      if (k < bd) { bd = k; best = s; }
    }
    if (best) tur.push(best);
  }
  for (const s of tur) b.plan.push({ tx: s.tx, ty: s.ty, type: 'turret' });
  outer.sort((a, c) => a.ang - c.ang); // round the ring, so the wall goes up in order and reads as one
  for (const s of outer) {
    if (s.along > 0 && Math.abs(s.lat) < MERCH_GATE_GAP) continue;
    if (angDiff(s.ang, b.bayDir.ang) < MERCH_BAY_GAP) continue;
    b.plan.push({ tx: s.tx, ty: s.ty, type: 'wall' });
  }
  e.merchant = b;
  robots.push(b);
  burst(b.x, b.y - 4, '#f4f7ff', 10, 50, 0.5, true);
  burst(b.x, b.y - 2, TEAMS[skin(e.team)].mark, 5, 40, 0.45);
  return b;
}

// one axe swing on a pine, a snag or a rock; true when it came down (the
// tile is emptied - the rim puts a stump back, the barracks' clearing does
// not). Pays nothing, like the crater and the lane.
function merchFell(b, t) {
  const px = t.tx * TILE + 8, py = t.ty * TILE + 8;
  t.hp--; t.flash = 0.1; t.shake = 0.22;
  if (nearPlayer(px, py)) SFX[t.type === 'rock' ? 'mine' : 'chop']();
  burst(px, py - 10, '#eef4fb', 3, 35, 0.4, true);
  if (t.hp > 0) return false;
  objects[idx(t.tx, t.ty)] = null;
  burst(px, py - 8, '#eef4fb', 8, 45, 0.5, true);
  burst(px, py - 8, t.type === 'tree' ? '#2f5c4b' : t.type === 'rock' ? '#9aa4b4' : '#6b5a48', 5, 45, 0.5, true);
  if (nearPlayer(px, py)) SFX[t.type === 'rock' ? 'break_' : 'treeFall']();
  if (t.type === 'deadTree') flushBirds(campAt(px, py), { x: px, y: py });
  b.tgt = null;
  return true;
}
// the bay's bearing: one of the two BACK corners (+-135 deg off the spur's
// axis), the one pointing nearer the world's edge - deeper into the roost
// corner's guaranteed woods, away from the field - so both sides' yards sit
// the same way round, mirrored. A unit vector in world space and the
// bearing itself (for the wall plan's gap).
function merchBayDir(e) {
  const lx = e.laneDir.x, ly = e.laneDir.y;
  let best = null, bd = Infinity;
  for (const ang of [3 * Math.PI / 4, -3 * Math.PI / 4]) {
    const x = lx * Math.cos(ang) - ly * Math.sin(ang), y = ly * Math.cos(ang) + lx * Math.sin(ang);
    const tx = e.x / TILE + x * 8, ty = e.y / TILE + y * 8;
    const edge = Math.min(tx, ty, WORLD - tx, WORLD - ty);
    if (edge < bd) { bd = edge; best = { x, y, ang }; }
  }
  return best;
}
// where the barracks goes: its 3x2 anchor about MERCH_BAY_BACK tiles out
// from the roost on the bay's bearing, outside the wall ring at the corner
// the walls leave open - the nearest placement to that point whose footprint
// is dry land holding nothing the axe cannot take (a pine, a snag, a rock, a
// stump: never the bird's own tiles or a building)
function merchBaySite(e) {
  const d = (e.merchant && e.merchant.bayDir) || merchBayDir(e);
  const cx = (e.x + d.x * MERCH_BAY_BACK * TILE) / TILE - 1.5, cy = (e.y + d.y * MERCH_BAY_BACK * TILE) / TILE - 1;
  const fits = (tx, ty) => footprint('barracks', tx, ty).every(([x, y]) => {
    if (!inWorld(x, y) || ground[idx(x, y)] !== 0) return false;
    const o = objAt(x, y);
    return !o || laneFells(o) || o.type === 'stump';
  });
  let best = null, bd = 1e9;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const tx = Math.round(cx) + dx, ty = Math.round(cy) + dy;
    const d = Math.hypot(tx - cx, ty - cy);
    if (d < bd && fits(tx, ty)) { bd = d; best = { tx, ty }; }
  }
  return best;
}
// the first thing still standing on the site or in the ring round it,
// nearest the merchant, that its swing will not reach this frame anyway
// (a stump counts only on the footprint itself: the ring round it keeps
// its stumps, walkable and a site like every other the merchant leaves)
function merchOnBay(s, x, y) { return x >= s.tx && x < s.tx + 3 && y >= s.ty && y < s.ty + 2; }
function merchBayBlocker(b, s) {
  let best = null, bd = 1e9;
  for (let y = s.ty - MERCH_BAY_RING; y < s.ty + 2 + MERCH_BAY_RING; y++) for (let x = s.tx - MERCH_BAY_RING; x < s.tx + 3 + MERCH_BAY_RING; x++) {
    const o = objAt(x, y);
    if (!o || !(laneFells(o) || (o.type === 'stump' && merchOnBay(s, x, y))) || b.avoids.some((a) => a.o === o)) continue;
    const d = Math.hypot(x * TILE + 8 - b.x, y * TILE + 8 - b.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// the merchant's frame: hop, then the barracks once it is due, then gate,
// then the rim, then keep to the roost. Every walk routes (navStep) and
// drops its goal when the route fails.
function updateMerchant(b, dt) {
  const e = b.roost;
  if (b.hopT > 0) { b.hopT -= dt; if (b.hopT <= 0) { burst(b.x, b.y + 2, '#eef4fb', 8, 45, 0.45, true); if (nearPlayer(b.x, b.y)) SFX.land(); } b.moving = false; return; }
  let moving = false, mvx = 0, mvy = 0;
  const from = { x: b.x, y: b.y };
  const walkToward = (px, py, reach) => {
    const n = navStep(b, px, py, PLAYER_R, MERCH_SPD, dt, reach);
    if (!n.ok) return -1;
    moving = true;
    return n.d;
  };
  const owner = players.find((p) => p.team === b.team) || player;
  // ---- serving: a counter is OPEN on this body, so everything else waits --
  // The shop IS this body and its reach is measured off it (the `shop`
  // banner, js/shop.js), so a merchant that walked off mid-sale would shut
  // its own counter in the customer's face. It drops the axe, stands where it
  // is and turns to them; the gate and the felling are still there afterwards.
  const cust = shopServing(b);
  if (cust) {
    b.moveT = 0;
    b.workT = 0;
    b.tgt = null; // the axe comes down: nothing is half-swung while it serves
    const cdx = cust.x - b.x, cdy = cust.y - b.y;
    b.dir = Math.abs(cdx) > Math.abs(cdy) ? (cdx > 0 ? 'right' : 'left') : (cdy > 0 ? 'down' : 'up');
    b.moving = false;
    b.animT = 0;
    return;
  }
  const unitOn = (tx, ty) => { // a body on or beside the tile: setting a solid site there would entomb it
    const cx = tx * TILE + 8, cy = ty * TILE + 8;
    for (const q of players) if (q.active && !q.dead && !inAir(q) && Math.abs(q.x - cx) < 8 + PLAYER_R && Math.abs(q.y - cy) < 8 + PLAYER_R) return true;
    for (const r of robots) if (!r.dead && r !== b && Math.abs(r.x - cx) < 8 + PLAYER_R && Math.abs(r.y - cy) < 8 + PLAYER_R) return true;
    return false;
  };
  // ---- the barracks: due MERCH_BAY_T after the landing, ahead of the gate
  // and the rim once it is - the waves are the match's clock, the gate is
  // furniture. The woods on the site are felled (no gold, like the rim), a
  // stump on it kicked out, then the site is hammered up from its doorstep.
  // Wrecked, the clock restarts at MERCH_BAY_REBUILD.
  if (b.bay && structOf(objAt(b.bay.tx, b.bay.ty)) !== b.bay) { b.bay = null; b.bayT = MERCH_BAY_REBUILD; }
  if (!b.bay) b.bayT -= dt;
  if (!b.bay && b.bayT <= 0) {
    for (let i = b.avoids.length - 1; i >= 0; i--) if ((b.avoids[i].t -= dt) <= 0) b.avoids.splice(i, 1); // the rim's list, aged here too since this returns early
    if (!b.baySite) b.baySite = merchBaySite(e);
    const s = b.baySite;
    if (!s) b.bayT = 8; // nowhere to stand it right now: ask again
    else {
      const o = merchBayBlocker(b, s);
      if (o) {
        const px = o.tx * TILE + 8, py = o.ty * TILE + 8;
        if (Math.hypot(px - b.x, py - b.y) > 20) {
          if (walkToward(px, py, 1) < 0) { b.avoids.push({ o, t: 12 }); b.bayT = 3; } // walled off: try again shortly
          b.workT = 0;
        } else {
          b.tgt = o;
          b.workT += dt;
          if (b.workT >= MERCH_BAY_SWING) {
            b.workT = 0;
            if (o.type === 'stump') { objects[idx(o.tx, o.ty)] = null; burst(px, py, '#eef4fb', 6, 40, 0.4, true); b.tgt = null; }
            else if (merchFell(b, o) && !merchOnBay(s, o.tx, o.ty)) objects[idx(o.tx, o.ty)] = { type: 'stump', tx: o.tx, ty: o.ty, flash: 0, shake: 0 }; // the merchant's axe always leaves a stump: the footprint alone is cleared to the ground
          }
        }
        return finish();
      }
      // the site is clear: hammer it up from the tile below the door
      const mx = (s.tx + 1.5) * TILE, my = (s.ty + 2) * TILE + 3;
      if (Math.hypot(mx - b.x, my - b.y) > 14) {
        if (walkToward(mx, my, 0) < 0) { b.baySite = null; b.bayT = 6; }
        b.workT = 0;
      } else if (footprint('barracks', s.tx, s.ty).some(([x, y]) => unitOn(x, y))) {
        b.workT = 0; // somebody standing on the site: wait for them to step off
      } else {
        b.tgt = { type: 'stump', tx: s.tx + 1, ty: s.ty + 1 }; // the hammer's aim (drawMerchant reads the type for its timing)
        b.workT += dt;
        if (b.workT >= MERCH_BAY_HAMMER) {
          b.workT = 0; b.tgt = null;
          b.bay = createStruct(s.tx, s.ty, 'barracks', 0, owner, true); // the eagle's own: nobody pays
          burst(mx, my - 8, '#eef4fb', 10, 45, 0.45, true);
          if (nearPlayer(mx, my)) SFX.hammer();
        }
      }
      return finish();
    }
  }
  // ---- the defence: walk to each planned site and set it ----------------
  while (b.plan.length) {
    const s = b.plan[0], o = objAt(s.tx, s.ty);
    if ((o && o.type !== 'stump') || (!o && s.type !== 'wall')) { b.plan.shift(); continue; } // built on, or a turret's stump gone: next
    const px = s.tx * TILE + 8, py = s.ty * TILE + 8;
    if (Math.hypot(px - b.x, py - b.y) > 20) {
      if (walkToward(px, py, 1) < 0) { b.plan.push(b.plan.shift()); b.workT = 0; } // no route right now: try it last
      else b.workT = 0;
    } else if (unitOn(s.tx, s.ty)) {
      b.plan.push(b.plan.shift()); b.workT = 0;
    } else {
      b.tgt = o || { type: 'stump', tx: s.tx, ty: s.ty }; // the hammer's aim (drawMerchant reads the type for its timing)
      b.workT += dt;
      if (b.workT >= MERCH_BUILD_T) {
        b.workT = 0; b.tgt = null;
        b.plan.shift();
        createStruct(s.tx, s.ty, s.type, 0, owner, true); // the eagle's own defence: nobody pays
        burst(px, py, '#eef4fb', 8, 40, 0.4, true);
        if (nearPlayer(px, py)) SFX.hammer();
      }
    }
    return finish();
  }
  // ---- the rim: fell the ring past the outer wall ring, no gold ---------
  // The nearest pine to the MERCHANT inside the ring that still has an open
  // side to stand on - the ones its own walls shut in are the forest's now.
  // A pine the route failed on goes on the avoid list for a while, a LIST
  // because one player flips forever between two blocked trunks.
  if (b.tgt && objects[idx(b.tgt.tx, b.tgt.ty)] !== b.tgt) b.tgt = null;
  for (let i = b.avoids.length - 1; i >= 0; i--) if ((b.avoids[i].t -= dt) <= 0) b.avoids.splice(i, 1);
  if (!b.tgt) {
    b.thinkT -= dt;
    if (b.thinkT <= 0) {
      b.thinkT = MERCH_THINK;
      const openSide = (o) => !isSolidTile(o.tx + 1, o.ty) || !isSolidTile(o.tx - 1, o.ty) || !isSolidTile(o.tx, o.ty + 1) || !isSolidTile(o.tx, o.ty - 1);
      b.tgt = nearestObj(b.x, b.y, Math.ceil(MERCH_CLEAR_R) + 2, (o) => (o.type === 'tree' || o.type === 'deadTree') &&
        Math.hypot(o.tx * TILE + 8 - e.x, o.ty * TILE + 8 - e.y) <= MERCH_CLEAR_R * TILE &&
        !b.avoids.some((a) => a.o === o) && openSide(o));
    }
  }
  if (b.tgt) {
    const t = b.tgt, px = t.tx * TILE + 8, py = t.ty * TILE + 8;
    if (Math.hypot(px - b.x, py - b.y) > 20) {
      if (walkToward(px, py, 1) < 0) { b.avoids.push({ o: t, t: 12 }); b.tgt = null; }
      b.workT = 0;
    } else {
      b.workT += dt;
      if (b.workT >= MERCH_SWING_T) {
        b.workT = 0;
        if (merchFell(b, t)) objects[idx(t.tx, t.ty)] = { type: 'stump', tx: t.tx, ty: t.ty, flash: 0, shake: 0 }; // the rim leaves build sites
      }
    }
    return finish();
  }
  // ---- done: keep to the mouth of the lane, a step or two either way ----
  const postX = e.x + e.laneDir.x * (EAGLE_TILE_R + 1.6) * TILE, postY = e.y + e.laneDir.y * (EAGLE_TILE_R + 1.6) * TILE;
  if (b.moveT > 0) {
    b.moveT -= dt;
    moving = true;
    const drag = unitMoveMul(b);
    const mv = moveEntity(b, (b.mvx * 24 * drag + b.kbx) * dt, (b.mvy * 24 * drag + b.kby) * dt, PLAYER_R);
    if (mv.blockedX || mv.blockedY) b.moveT = 0;
  } else {
    b.idleT -= dt;
    if (Math.abs(b.kbx) + Math.abs(b.kby) > 1) moveEntity(b, b.kbx * dt, b.kby * dt, PLAYER_R);
    if (b.idleT <= 0) {
      let ang = rng() * Math.PI * 2;
      if (Math.hypot(postX - b.x, postY - b.y) > 2 * TILE) ang = Math.atan2(postY - b.y, postX - b.x) + rand(-0.5, 0.5);
      b.mvx = Math.cos(ang); b.mvy = Math.sin(ang);
      b.moveT = rand(0.4, 1); b.idleT = rand(1.5, 3.5);
    }
  }
  return finish();

  function finish() {
    mvx = b.x - from.x; mvy = b.y - from.y;
    if (moving && (Math.abs(mvx) > 0.01 || Math.abs(mvy) > 0.01)) {
      b.dir = Math.abs(mvx) > Math.abs(mvy) ? (mvx > 0 ? 'right' : 'left') : (mvy > 0 ? 'down' : 'up');
    } else if (b.tgt) { // face the work
      const dx = b.tgt.tx * TILE + 8 - b.x, dy = b.tgt.ty * TILE + 8 - b.y;
      b.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    b.animT += dt * (moving ? 8 : 0);
    b.moving = moving;
    b.x = Math.max(8, Math.min(WORLD * TILE - 8, b.x));
    b.y = Math.max(8, Math.min(WORLD * TILE - 8, b.y));
  }
}

// ------------------------------------------------------------ soldiers
// The WAVES. Every STRUCTS.barracks.waveT seconds each merchant's barracks
// (the `merchant` banner above) rolls out a column of soldiers - the worker's
// chassis under its side's pennant (drawRobot) - that marches the ROAD
// (placeRoad, world.js) to the rival bird and strikes it. A soldier is
// allowed to FIGHT and nothing else: no flag reads it (owner -1), no tree
// tempts it, and it swings the worker's own axe (robotStrike) at any rival
// unit inside SOLDIER_AGGRO, any rival building inside SOLDIER_SIEGE (the
// gate's turrets and walls, their barracks), and then the bird itself,
// SOLDIER_EAGLE_DMG a swing through hurtEagle - which is why two waves
// meeting on the road grind each other down until somebody breaks the tie.
// It carries a SOLDIER_BOUNTY paid to whoever scraps it (robotDies), and it
// takes every hit, state and gust like any other body. Its route is the
// road's waypoints from its own spur's junction to the rival's
// (roadWaypoints), then the rival's spur to the roost: a waypoint it cannot reach is skipped, not
// waited on, so a wave never stands still on a blocked tile.
const SOLDIER_SPD = 44;        // px/s, a step slower than a walking player
const SOLDIER_AGGRO = 96;      // px it turns on a rival unit inside
const SOLDIER_SIEGE = 40;      // px it turns on a rival building inside - what is in its way, not the whole ring round a roost
const SOLDIER_EAGLE_DMG = 8;   // nerve one swing takes off the rival bird (a hand's E swing is EAGLE_WORK_DMG, 20)
const SOLDIER_BOUNTY = 4;      // gold (and so xp) a scrapped soldier pays its killer
const SOLDIER_WP_R = 28;       // px from a waypoint that counts as reached

function makeSoldier(o) {
  const b = makeRobot(o); // the bay's roll-out geometry, the barracks' botHp
  b.kind = 'soldier';
  b.owner = -1; // nobody's: no flag, no cargo, no payout but the bounty
  // the march: own junction first (down the roost's spur), the road, the
  // rival junction; the rival roost itself is read live (it may have flown)
  const own = state.drop && state.drop.eagles[b.team], rival = state.drop && state.drop.eagles[1 - b.team];
  b.way = [];
  if (own && own.mouth) b.way.push({ x: own.mouth.x, y: own.mouth.y });
  for (const w of roadWaypoints(b.team)) b.way.push(w);
  if (rival && rival.mouth) b.way.push({ x: rival.mouth.x, y: rival.mouth.y });
  b.wayI = 0;
  return b;
}

function updateSoldier(b, dt) {
  let moving = false;
  const walkToward = (px, py, reach) => {
    const n = navStep(b, px, py, 3, SOLDIER_SPD, dt, reach);
    if (!n.ok) return -1;
    moving = true;
    return n.d;
  };
  b.atkAim = null;
  const swing = (pt, hit) => { b.atkAim = pt; if (b.atkCd <= 0) { b.atkCd = ROBOT_ATK_CD; hit(); } };
  const rival = state.drop && state.drop.eagles[1 - b.team];
  const roost = rival && rival.state === 'down' ? rival : null;
  let busy = false;
  // 1. a rival unit in reach: close and swing (players through seenAt, so a
  //    buried hunter lets a column walk past)
  const foe = robotFoeUnit(b, SOLDIER_AGGRO);
  if (foe) {
    const pt = foePoint(foe, b.x, b.y - 1);
    if (Math.hypot(pt.x - b.x, pt.y - (b.y - 1)) > ROBOT_REACH) busy = walkToward(pt.x, pt.y, 0) >= 0;
    else { swing(pt, () => robotStrike(b, foe, pt)); busy = true; }
  }
  // 2. the rival bird, once the road has brought it close: a swing on the
  //    nearest roost tile (hurtEagle) - ahead of any building, since the
  //    gate's whole ring stands within a step of the roost
  if (!busy && roost && Math.hypot(roost.x - b.x, roost.y - b.y) < 6 * TILE) {
    const t = aiEagleTile(roost, b);
    if (t) {
      const pt = { x: t.tx * TILE + 8, y: t.ty * TILE + 8 };
      if (Math.hypot(pt.x - b.x, pt.y - (b.y - 1)) > ROBOT_REACH + 6) busy = walkToward(pt.x, pt.y, 1) >= 0;
      else {
        swing(pt, () => { if (nearPlayer(b.x, b.y)) SFX.swing(); hurtEagle(roost, SOLDIER_EAGLE_DMG, null, pt.x, pt.y); });
        busy = true;
      }
    }
  }
  // 3. a rival building in its way: the gate's turrets, a wall across the
  //    gap, their barracks
  if (!busy) {
    const st = enemyStructNear(b.team, b.x, b.y - 1, SOLDIER_SIEGE);
    if (st) {
      const pt = foePoint(st, b.x, b.y - 1);
      if (Math.hypot(pt.x - b.x, pt.y - (b.y - 1)) > ROBOT_REACH) busy = walkToward(pt.x, pt.y, 1) >= 0;
      else { swing(pt, () => robotStrike(b, st, pt)); busy = true; }
    }
  }
  // 4. the march: the next waypoint, then the roost through its lane
  if (!busy) {
    if (b.wayI < b.way.length) {
      const w = b.way[b.wayI];
      const d = walkToward(w.x, w.y, 2);
      if (d < 0 || d < SOLDIER_WP_R) b.wayI++; // reached, or unreachable: the next one
    } else if (roost) {
      if (walkToward(roost.x, roost.y, 3) < 0) navClear(b); // pinned in the lane: try afresh next frame
    }
  }
  b.animT += dt * (moving ? 8 : 0);
  b.moving = moving;
  b.x = Math.max(8, Math.min(WORLD * TILE - 8, b.x));
  b.y = Math.max(8, Math.min(WORLD * TILE - 8, b.y));
  if (b.hp <= 0 && !b.dead) robotDies(b, null);
}

// ------------------------------------------------------------ team flags
// The flag: ONE order marker per player, of four kinds, that the whole side
// reads - every worker bot out of a bay the planter owns (the dispatch at the
// tail of updateRobot) and every AI player on the team (the `flag` rung,
// js/ai.js). A flag is an AREA: FLAG_R px round the tile it stands on is the
// ground the order is about, drawn as a ring on the snow (drawFlagRing,
// js/draw-world.js) so what an order covers is never a guess.
const FLAG_R = 192;        // px round a flag its order covers (12 tiles)
const ROBOT_DMG = 5;       // one worker swing, against a unit or a building
const ROBOT_ATK_CD = 1.1;  // seconds between those swings
const ROBOT_REACH = 15;    // px from a worker's body to what its axe can reach
const ROBOT_AGGRO = 70;    // px a worker on any flag notices a foe inside
const ROBOT_LEASH = 90;    // px a worker on a *defensive* flag will leave its post to swing
const ROBOT_MAD = 6;       // seconds a struck worker stays angry at whoever hit it

//   p.flag = { tx, ty, type, owner }   // owner: the planter's player id
//
// The four orders, and what each asks of the ground inside the ring:
//   attack - kill every rival unit and break every rival building in it
//   defend - hold it, and swing at whatever comes in; never chase out of it
//   gather - cut and mine everything in it
//   rally  - come here and stand; nothing is fought on the way
// Which flag a body serves is servedFlag(): A HUMAN'S FLAG IS THE SIDE'S
// WHOLE PLAN - while one stands every bot on the team lifts its own and
// follows it (aiFlagSync, js/ai.js), and every worker on the side reads it.
// With no human flag a bot serves the one it planted itself (a bot's flag is
// only ever the ladder's own decision made visible) or a teammate's it
// joined instead of planting a twin over the same ground.
// TWO colours only, and they carry the STAKES, not the order - the icon is
// what says which order it is. The two pointed at your own side wear the
// game's plain pale ink; the one pointed at another team is the danger red
// every other hostile thing in the game already uses. Amber and green are
// spoken for (affordable / interactable, and good), and an order is neither.
// The pale one is the game's standard bright ink, NOT a soft slate: this
// world is snow, and anything near it disappears into the ground. It reads
// for the same reason drawSelection's brackets do - a dark rim under white.
const FLAG_MINE = '#f4f7ff', FLAG_FOE = '#ff8a7a';
const FLAG_TYPES = {
  // icon: rects on a 7x7 grid, stamped by drawFlagIcon (the camp glyph's idiom)
  attack: { name: 'ATTACK', col: FLAG_FOE,  icon: [[2, 0, 3, 3], [1, 3, 5, 1], [3, 4, 1, 3]] },                     // a sword
  defend: { name: 'DEFEND', col: FLAG_MINE, icon: [[0, 0, 7, 2], [1, 2, 5, 2], [2, 4, 3, 1], [3, 5, 1, 1]] },       // a shield
  gather: { name: 'GATHER', col: FLAG_MINE, icon: [[0, 0, 5, 1], [0, 1, 6, 1], [1, 2, 5, 1], [3, 3, 1, 4]] },       // an axe
  rally:  { name: 'RALLY',  col: FLAG_MINE, icon: [[0, 0, 2, 1], [5, 0, 2, 1], [1, 1, 2, 1], [4, 1, 2, 1], [2, 2, 3, 1], [3, 3, 1, 1], [2, 5, 3, 1]] }, // a chevron down onto the ground
};
// the radial's wedges, clockwise from straight up (wheelOptions, js/ui.js)
const FLAG_ORDER = ['attack', 'defend', 'gather', 'rally'];

// where a flag stands, in world px, and whether a point is inside its ring
function flagPos(f) { return { x: f.tx * TILE + 8, y: f.ty * TILE + 8 }; }
function inFlag(f, x, y) { return Math.hypot(f.tx * TILE + 8 - x, f.ty * TILE + 8 - y) < FLAG_R; }
// the flag a HUMAN on this team has standing - the side's plan while it stands
function humanFlag(team) {
  for (const q of players) if (q.active && q.control === 'human' && q.team === team && q.flag) return q.flag;
  return null;
}
// the flag this player's crews and, for a bot, the bot itself answer to:
// a human teammate's, else the teammate's flag a bot has joined, else its own
function servedFlag(p) {
  const h = humanFlag(p.team);
  if (h) return h;
  if (p.control === 'ai' && p.ai.join >= 0) {
    const q = players[p.ai.join];
    if (q && q.active && q.flag) return q.flag;
  }
  return p.flag;
}
// a teammate (not `except`) already flying an order of this kind whose ring
// covers (x, y) - the flag a bot joins instead of planting a twin
function teamFlagAt(team, type, x, y, except) {
  for (const q of players) {
    if (!q.active || q === except || q.team !== team || !q.flag || q.flag.type !== type) continue;
    if (inFlag(q.flag, x, y)) return q;
  }
  return null;
}
// the nearest standing flag on the side that passes `pred(flag)`, whoever
// planted it (a bot with nothing of its own to do goes and helps: aiHelps,
// js/ai.js, says at which)
function nearestTeamFlag(p, pred) {
  let best = null, bd = Infinity;
  for (const q of players) {
    if (!q.active || q === p || q.team !== p.team || !q.flag || (pred && !pred(q.flag))) continue;
    const d = Math.hypot(q.flag.tx * TILE + 8 - p.x, q.flag.ty * TILE + 8 - p.y);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}

// plant / move: one flag per player, so planting anywhere moves it. The
// burst and the sound are the local side's only - a rival's flag is not
// intelligence to hand across the map, and neither is the puff it lands with.
function plantFlag(p, tx, ty, type) {
  if (!inWorld(tx, ty) || !FLAG_TYPES[type]) return;
  p.flag = { tx, ty, type, owner: p.id };
  flagRecall(p);
  if (player && p.team === player.team) burst(tx * TILE + 8, ty * TILE + 8, FLAG_TYPES[type].col, 8, 45, 0.4, true);
  if (p === player) SFX.place();
}
function clearFlag(p) {
  if (!p.flag) return;
  const x = p.flag.tx * TILE + 8, y = p.flag.ty * TILE + 8;
  p.flag = null;
  flagRecall(p);
  if (player && p.team === player.team) burst(x, y, '#c9d0e2', 6, 40, 0.35, true);
  if (p === player) SFX.pickup();
}
// every worker that will read the new order drops what it was doing and
// turns for it the same frame it lands - an order has to be visibly obeyed
// at once. A human's flag is read by the whole side's crews; a bot's by its own.
function flagRecall(p) {
  const side = p.control === 'human';
  for (const b of robots) {
    if (b.dead || b.merchant || b.kind === 'soldier') continue;
    if (b.owner === p.id || (side && b.team === p.team)) { b.tgt = null; b.atkAim = null; navClear(b); }
  }
}
// the order a given worker is under: what its bay's owner serves, or none
function flagOf(b) { const p = players[b.owner]; return p && p.active ? servedFlag(p) : null; }

// nearest building belonging to any other team, within r px of (x, y)
function enemyStructNear(team, x, y, r) {
  let best = null, bd = r;
  for (const o of structures) {
    if (o.team === undefined || o.team === team) continue;
    const c = structCenter(o);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
// The nearest hostile INSIDE a flag's ring, measured from the worker: a
// unit first (a player through seenAt, so a buried archer is not there for
// the crew either; a rival wave's soldiers count), then - when `structs` -
// a building. Units before buildings because a building does not swing back.
function flagFoe(b, fx, fy, structs) {
  let best = null, bd = Infinity;
  for (const q of players) {
    if (!q.active || q.dead || inAir(q) || q.team === b.team) continue;
    const df = Math.hypot(q.x - fx, q.y - 6 - fy);
    if (df >= FLAG_R || df > seenAt(q, FLAG_R)) continue;
    const d = Math.hypot(q.x - b.x, q.y - 6 - b.y);
    if (d < bd) { bd = d; best = q; }
  }
  for (const r of robots) {
    if (r === b || !unitAlive(r) || r.team === b.team) continue;
    if (Math.hypot(r.x - fx, r.y - 1 - fy) >= FLAG_R) continue;
    const d = Math.hypot(r.x - b.x, r.y - 1 - b.y);
    if (d < bd) { bd = d; best = r; }
  }
  if (!best && structs) best = enemyStructNear(b.team, fx, fy, FLAG_R);
  return best;
}
// is another live worker out of the same bay already swinging at this?
function objTaken(b, o) {
  for (const s of b.home.bots) if (s !== b && !s.dead && s.tgt === o) return true;
  return false;
}

// ---- a worker's simple attack -------------------------------------------
// Workers were never fighters; a flag that points at another team has to hand
// them something to point back with. One axe swing on a flat cooldown - the
// same swing the harvest animation already draws, aimed at a body instead of
// a trunk. Nothing here scales with anything yet; that is the balance pass.
function foeAlive(b, e) {
  if (!e) return false;
  if (e.tx !== undefined) return structOf(objAt(e.tx, e.ty)) === e && e.team !== b.team;
  if (e.input) return e.active && !e.dead && !inAir(e) && e.team !== b.team;
  return !e.dead && e.team !== b.team;
}
// Where a worker aims. A body is a point a little above its feet; a building
// is the nearest point on its FOOTPRINT, not its centre - the bay is 3x2, and
// a worker measuring to the middle of it could never reach its own axe past
// the wall it is standing against.
function foePoint(e, fx, fy) {
  if (e.tx === undefined) return { x: e.x, y: e.y - 4 };
  if (fx === undefined) return structCenter(e);
  const x0 = e.tx * TILE, y0 = e.ty * TILE;
  return {
    x: Math.max(x0, Math.min(x0 + structW(e) * TILE, fx)),
    y: Math.max(y0, Math.min(y0 + structH(e) * TILE, fy)),
  };
}
// nearest enemy UNIT (player or worker) inside range. Players are noticed through
// seenAt, so a body under the snow is as invisible to a worker as to a wolf.
function robotFoeUnit(b, range) {
  let best = null, bd = range;
  for (const q of players) {
    if (!q.active || q.dead || inAir(q) || q.team === b.team) continue;
    const d = Math.hypot(q.x - b.x, q.y - 6 - b.y);
    if (d < bd && d <= seenAt(q, range)) { bd = d; best = q; }
  }
  for (const r of robots) {
    if (r === b || !unitAlive(r) || r.team === b.team) continue;
    const d = Math.hypot(r.x - b.x, r.y - 1 - b.y);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
// the blow itself: a building goes through hurtStruct (the same path an E
// swing takes), any BODY through the one blow every unit takes (hurtUnit,
// js/actions.js), all credited to the bay's owner so a worker kill still pays
// and still levels
function robotStrike(b, e, pt) {
  const src = players[b.owner] || null;
  const d = Math.hypot(pt.x - b.x, pt.y - (b.y - 1)) || 1;
  const nx = (pt.x - b.x) / d, ny = (pt.y - (b.y - 1)) / d;
  if (nearPlayer(b.x, b.y)) SFX.swing();
  if (e.tx !== undefined) hurtStruct(e, ROBOT_DMG, src, b); // `b` swung it, so STRUCT_DR stays off: ROBOT_DMG is already a building number
  else hurtUnit(e, ROBOT_DMG, nx, ny, src, { cause: b.kind === 'soldier' ? 'soldier' : 'worker' });
}
