'use strict';
// ------------------------------------------------------------ the orca
// The orca's lake (orcaLakeAt, js/sim/world.js) has one thing living under it.
// It cruises the disc as a shadow under the ice, like the lake's fish but
// the size of a deer. A player who walks out onto ITS ice within
// seenAt(p, ORCA_SIGHT) of it is locked: a countdown over their head runs
// ORCA_LINE s (drawOrcaCount, js/draw/overhead.js; a knock in the ice on
// every number) while the orca stalks them (orcaStalk): a glide past beside
// them, a wide turn, then the run in under them, its heading always leading
// its path. Off the orca's ice - onto the snow, a gate's sill, a zipline, a
// deer's back is still the ice - and the hunt drops. If the line runs out on
// the ice, the orca comes up:
//   the strike   the ice cracks round where it will break (iceBreak's warn,
//                ORCA_CRACK) and the one it is after is pinned (rootUnit);
//                under the cracks the shadow glides onto the hole, turning
//                to face the spot it lunges at
//   the breach   the hole opens beside and below them (ORCA_LEAN: the 3/4
//                view's "behind"), the orca lunges up out of it and its jaws
//                close on the spot they stood on (ORCA_BITE): whatever is
//                within ORCA_JAWS of it goes down, whatever its health
//   the rest     it slides back under and cruises again; nothing is locked
//                for ORCA_REST once it is gone
// One orca, one hunt at a time. Its water is the whole disc, under the
// cistern's sills too (js/sim/cistern.js), but it locks and breaks only bare
// ice. It never rolls: every pick comes off hash2 and the tick,
// so the shared rng() is untouched. Sim only - `orca` is a SAVE_ROOTS
// singleton and rides the snapshot; the pixels are js/draw/orca.js.
const ORCA_LINE = 3;          // s of countdown before it comes up
const ORCA_SIGHT = 160;       // px from the orca a player on its ice is felt from (seenAt shortens it)
const ORCA_SWIM = 26;         // px/s cruising
const ORCA_DASH = 260;        // px/s at most on the run in
const ORCA_TURN = 1.4;        // rad/s cruising; the run in turns ORCA_TURN_HUNT
const ORCA_TURN_HUNT = 5;     // ...in its last few px under them
const ORCA_STALK = 1.5;       // s of the line at most it spends on the pass before it turns in
const ORCA_PASS = [28, 44];   // px beside its quarry, and past it, that the pass glides for
const ORCA_GLIDE = 55;        // px/s on the pass, and the least on the run in
const ORCA_TURN_PASS = 2.2;   // rad/s on the pass and the turn: a wide arc, never a pivot
const ORCA_TURN_RUN = 3.2;    // rad/s on the run in
const ORCA_ACC = 4;           // 1/s: how fast its speed eases to what it wants (a few tail strokes)
const ORCA_MARGIN = 12;       // px of the disc kept round the shadow's middle
const ORCA_LEAN = [24, 28];   // px from the bitten spot to the middle of the hole: beside it, and below
const ORCA_LEAN_K = [1, 0.75, 0.5]; // ...and the shorter lunges it tries where the ice for the long one is not there
const ORCA_CRACK = 0.3;       // s the cracks trace the hole before it opens (the break's warn)
const ORCA_RISE = 0.13;       // s from the hole opening to the orca all the way up
const ORCA_BITE = 0.2;        // s from the hole opening to the jaws shutting
const ORCA_SINK_AT = 0.57;    // s from the hole opening to it sliding back down
const ORCA_UP = 0.93;         // s from the hole opening to it gone under again
const ORCA_JAWS = 12;         // px round the bitten spot the jaws take
const ORCA_REST = 1;          // s after it is back under before it locks anyone
const ORCA_LET = 1.5;         // s after losing one before it locks anyone
const ORCA_TOLL = 3;          // extra steps a route pays per tile of its ice (navToll): the bots go round
const ORCA_FRESH = () => ({ on: 0, x: 0, y: 0, a: 0, v: ORCA_SWIM, mode: 'swim', t0: 0, tgt: -1, side: 1,
  jx: 0, jy: 0, hx: 0, hy: 0, cool: 0, gx: 0, gy: 0, bit: 0, n: 0, px: 0, py: 0, run: 0 });
const orca = ORCA_FRESH();
let orcaWater = null; // per tile: 1 inside the disc (the orca swims there, under the ice and the sills alike)
let orcaHome = null;  // the disc's tiles with room round them: where it cruises to

// the orca's bite is a beast's, in the post-game record (damagePlayer)
BEAST_CAUSES.add('orca');

const orcaAge = () => (state.tick - orca.t0) * TICK_DT;
function orcaTileIn(tx, ty) { return inWorld(tx, ty) && orcaWater[idx(tx, ty)] === 1; }
function orcaIn(x, y) { return orcaTileIn(Math.floor(x / TILE), Math.floor(y / TILE)); }
// the shadow's middle with ORCA_MARGIN of disc round it
function orcaClear(x, y) {
  const m = ORCA_MARGIN;
  return orcaIn(x - m, y) && orcaIn(x + m, y) && orcaIn(x, y - m) && orcaIn(x, y + m);
}
// bare ice of the orca's: what a player is locked on and the ice breaks
function orcaIce(tx, ty) { return orcaTileIn(tx, ty) && ground[idx(tx, ty)] === 1 && !objects[idx(tx, ty)]; }
function orcaOnIce(p) { return orcaTileIn(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) && ground[idx(Math.floor(p.x / TILE), Math.floor(p.y / TILE))] === 1; }
// can it have this one: on the ground, on its ice, not on a cable
function orcaPrey(p) { return !!p && p.active && !p.dead && !inAir(p) && !(p.zip >= 0) && orcaOnIce(p); }

// boot, after the fish (js/app/boot.js): the disc's tiles, the routes' toll on
// them, and the orca put in at the home tile the seed hashes to
function spawnOrca() {
  orcaWater = new Uint8Array(WORLD * WORLD);
  orcaHome = [];
  if (PRACTICE) return;
  const c = Math.round((WORLD - 1) / 2), r = Math.ceil(ORCA_LAKE_R + 2);
  for (let ty = c - r; ty <= c + r; ty++) for (let tx = c - r; tx <= c + r; tx++) {
    if (!inWorld(tx, ty) || !orcaLakeAt(tx, ty)) continue;
    orcaWater[idx(tx, ty)] = 1;
    navToll[idx(tx, ty)] = ORCA_TOLL;
  }
  for (let ty = c - r; ty <= c + r; ty++) for (let tx = c - r; tx <= c + r; tx++) {
    if (orcaTileIn(tx, ty) && orcaClear((tx + 0.5) * TILE, (ty + 0.5) * TILE)) orcaHome.push(idx(tx, ty));
  }
  if (!orcaHome.length) return;
  Object.assign(orca, ORCA_FRESH(), { on: 1 });
  orcaGoal();
  orca.x = orca.gx; orca.y = orca.gy;
  orcaGoal();
}
// somewhere new to cruise to: a home tile off the tick
function orcaGoal() {
  const i = orcaHome[Math.floor(hash2(state.tick * 7 + 3, ++orca.n) * orcaHome.length)];
  orca.gx = (i % WORLD + 0.5) * TILE; orca.gy = (((i / WORLD) | 0) + 0.5) * TILE;
}
// one step of swimming: turn toward (tx, ty) at `turn`, go `v`, never out of
// the disc (a step that would leave it turns instead)
function orcaSwim(tx, ty, v, turn, dt) {
  orca.a += Math.max(-turn * dt, Math.min(turn * dt, angDelta(orca.a, Math.atan2(ty - orca.y, tx - orca.x))));
  const nx = orca.x + Math.cos(orca.a) * v * dt, ny = orca.y + Math.sin(orca.a) * v * dt;
  if (orcaClear(nx, ny)) { orca.x = nx; orca.y = ny; } else orca.a += turn * dt;
  orca.v = v;
}
// where it runs to under its quarry: the hole's own spot, on whichever side
// has the disc for it (the side it came from first)
function orcaUnder(p) {
  for (const s of [orca.side, -orca.side]) {
    const x = p.x + s * ORCA_LEAN[0], y = p.y + ORCA_LEAN[1];
    if (orcaClear(x, y)) { orca.side = s; return [x, y]; }
  }
  return [p.x, p.y];
}

// every step, from updatePlay (js/sim/sim.js), after the fish
function updateOrca(dt) {
  if (!orca.on) return;
  orca.cool = Math.max(0, orca.cool - dt);
  const age = orcaAge();
  if (orca.mode === 'swim') {
    if (Math.hypot(orca.gx - orca.x, orca.gy - orca.y) < 18) orcaGoal();
    orcaSwim(orca.gx, orca.gy, ORCA_SWIM, ORCA_TURN, dt);
    if (orca.cool <= 0) orcaLook();
    return;
  }
  if (orca.mode === 'hunt') {
    const p = players[orca.tgt];
    if (!orcaPrey(p)) { orca.mode = 'swim'; orca.tgt = -1; orca.t0 = state.tick; orca.cool = ORCA_LET; orcaGoal(); return; }
    const left = ORCA_LINE - age;
    // a knock in the ice under them, once a second, the line's own clock
    const k = state.tick - orca.t0, sec = Math.round(1 / TICK_DT);
    if (k > 0 && k % sec === 0 && left > 0.5) sfxAt('iceKnock', p.x, p.y);
    const [tx, ty] = orcaStalk(p, left, dt);
    if (left <= 0) orcaStrike(p);
    return;
  }
  if (orca.mode === 'crack') {
    // the last glide under the cracks: from where the run left it onto the hole, turning to
    // face the spot it lunges at, so the shadow goes into the breach instead of jumping to it
    const u = Math.min(1, dt / Math.max(dt, ORCA_CRACK - age));
    orca.x += (orca.hx - orca.x) * u; orca.y += (orca.hy - orca.y) * u;
    orca.a += angDelta(orca.a, Math.atan2(orca.jy - orca.hy, orca.jx - orca.hx)) * u;
    if (age >= ORCA_CRACK) { orca.mode = 'up'; orca.t0 = state.tick; orca.bit = 0; } // the hole opens this same step (updateIceBreaks)
    return;
  }
  if (orca.mode === 'up') {
    if (!orca.bit && age >= ORCA_BITE) orcaBite();
    if (age >= ORCA_UP) { orca.mode = 'swim'; orca.t0 = state.tick; orca.cool = ORCA_REST; orca.a = orca.side > 0 ? 0 : Math.PI; orcaGoal(); }
  }
}
// lock on: the nearest player on its ice it can feel
function orcaLook() {
  let best = null, bd = 1e9;
  for (const p of players) {
    if (!orcaPrey(p)) continue;
    const d = Math.hypot(p.x - orca.x, p.y - orca.y);
    if (d <= seenAt(p, ORCA_SIGHT) && d < bd) { bd = d; best = p; }
  }
  if (!best) return;
  orca.mode = 'hunt'; orca.t0 = state.tick; orca.tgt = best.id;
  orca.side = orca.x >= best.x ? 1 : -1;
  orcaPass(best);
  sfxAt('iceKnock', best.x, best.y);
}
// where the pass glides for: beside its quarry on the side it is already
// heading, and on past them, so it goes by and has to turn back. No disc
// there (the rim) and it runs straight in.
function orcaPass(p) {
  const d = Math.max(1, Math.hypot(p.x - orca.x, p.y - orca.y)), ux = (p.x - orca.x) / d, uy = (p.y - orca.y) / d;
  const lean = Math.cos(orca.a) * -uy + Math.sin(orca.a) * ux >= 0 ? 1 : -1; // the side its heading already sits
  orca.run = 1;
  for (const s of [lean, -lean]) {
    const x = p.x - uy * s * ORCA_PASS[0] + ux * ORCA_PASS[1], y = p.y + ux * s * ORCA_PASS[0] + uy * ORCA_PASS[1];
    if (orcaClear(x, y)) { orca.px = x; orca.py = y; orca.run = 0; return; }
  }
}
// one step of the stalk; returns where it comes up under them (orcaUnder).
// The pass ends at its mark, once it is past them, or at ORCA_STALK; the run
// in goes as fast as the time left asks. Its speed eases (ORCA_ACC), its
// heading turns at a capped rate, so the path is arcs, never a pivot.
function orcaStalk(p, left, dt) {
  const [tx, ty] = orcaUnder(p);
  if (!orca.run) {
    const ahead = (p.x - orca.x) * Math.cos(orca.a) + (p.y - orca.y) * Math.sin(orca.a);
    if (Math.hypot(orca.px - orca.x, orca.py - orca.y) < 10 || ahead < -12 || ORCA_LINE - left >= ORCA_STALK) orca.run = 1;
  }
  const d = Math.hypot(tx - orca.x, ty - orca.y);
  const want = orca.run ? Math.min(ORCA_DASH, Math.max(ORCA_GLIDE, 1.4 * d / Math.max(0.12, left))) : ORCA_GLIDE;
  const v = orca.v + (want - orca.v) * Math.min(1, ORCA_ACC * dt);
  const turn = !orca.run ? ORCA_TURN_PASS : d < 20 ? ORCA_TURN_HUNT : ORCA_TURN_RUN;
  if (orca.run) orcaSwim(tx, ty, v, turn, dt); else orcaSwim(orca.px, orca.py, v, turn, dt);
  return [tx, ty];
}
// the line has run out: break the ice for the lunge, the longest one there
// is bare ice for, and pin the one it is after. Nowhere to come up (the
// shallows at the rim, a snow bank) and it tries again next step.
function orcaStrike(p) {
  const jx = Math.round(p.x), jy = Math.round(p.y), sq = ICE_BREAK_SHAPES.orca.sq;
  for (const s of [orca.side, -orca.side]) for (const k of ORCA_LEAN_K) {
    const hx = Math.round(jx + s * ORCA_LEAN[0] * k), hy = Math.round(jy + ORCA_LEAN[1] * k);
    if (!orcaIce(Math.floor(hx / TILE), Math.floor(hy / TILE))) continue;
    const b = iceBreak(hx, hy, 'orca', Math.atan2((jy - hy) / sq, jx - hx), { warn: ORCA_CRACK });
    if (!b) continue;
    Object.assign(orca, { mode: 'crack', t0: state.tick, side: s, jx, jy, hx, hy, bit: 0 });
    rootUnit(p, ORCA_CRACK + ORCA_BITE + 0.05);
    return;
  }
}
// the jaws shut: everything within reach of the spot goes down
function orcaBite() {
  orca.bit = 1;
  for (const e of unitsHit(null, orca.jx, orca.jy, ORCA_JAWS)) hurtUnit(e, orcaLethal(e), 0, 0, null, { cause: 'orca', kb: 0 });
  sfxAt('bite', orca.jx, orca.jy);
  shakeAt(orca.jx, orca.jy, 5);
  burst(orca.hx, orca.hy - 4, '#ddf1f8', 12, 70, 0.5, true);
}
// a blow that takes the whole of a body, its shield and its hide included,
// and not a point more (the post-game record counts what landed)
function orcaLethal(e) {
  return e instanceof Player ? armorRaw(e, Math.ceil(e.hp + (e.dawnShield || 0))) : Math.ceil(e.hp);
}

// the countdown over a player's head, in s left; -1 while the orca is not after them
function orcaLine(p) {
  if (!orca.on || orca.tgt !== p.id) return -1;
  if (orca.mode === 'hunt') return Math.max(0, ORCA_LINE - orcaAge());
  return orca.mode === 'crack' ? 0 : -1;
}
// a bot the orca is after: where to run to, off its ice by the nearest way,
// once `react` s of the line have gone (the profile's notice, js/ai/ai-skill.js);
// null while it need not run (js/ai/ai.js, rung 0b)
function orcaShore(p, react) {
  if (!orca.on || orca.mode !== 'hunt' || orca.tgt !== p.id || orcaAge() < (react || 0)) return null;
  const sx = Math.floor(p.x / TILE), sy = Math.floor(p.y / TILE), R = Math.ceil(ORCA_LAKE_R) * 2 + 4;
  const seen = new Set([idx(sx, sy)]), q = [[sx, sy]];
  for (let h = 0; h < q.length; h++) {
    const [tx, ty] = q[h];
    if (!(orcaTileIn(tx, ty) && ground[idx(tx, ty)] === 1)) return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = tx + dx, y = ty + dy;
      if (Math.abs(x - sx) > R || Math.abs(y - sy) > R || !walkable(x, y, p) || seen.has(idx(x, y))) continue;
      seen.add(idx(x, y)); q.push([x, y]);
    }
  }
  return null;
}
