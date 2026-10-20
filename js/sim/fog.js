'use strict';
// The fog of war's rule: what a side can see. Each hero, wave soldier and
// road tower of a side lights a circle round it; solid stone (the cistern's
// wall) stops a line of sight, pines never do; a body
// standing deep in the woods is hidden from the outside until one of the side
// stands close, and a body in the brush (deep snow, js/sim/depth.js) until
// one of the side stands in that patch or right at its rim. Rival bodies and every creature outside a side's sight are
// gone for it: from the screen and both maps (js/draw/fog.js draws that) and
// from its bots (they ask through seenAt(q, range, team) and inSight).
// Terrain, buildings and the eagles are never fogged.
//   Everything here is read off the world as it stands, so nothing new is
// saved. Online the host sends each side only what this says it sees (the
// `fog` banner in js/net/snapshot.js), and a client takes its word (`fogHid`).
// ------------------------------------------------------------ fog of war
const FOG_HERO = 160;    // px a hero sees
const FOG_SOLDIER = 112; // px a wave soldier sees (past its SOLDIER_AGGRO, so it sees what it turns on)
const FOG_TOWER = 136;   // px a road tower sees from its foot (past its TOWER_RANGE)
const FOG_WOODS_N = 9;   // pines in the 5x5 tiles round a walkable tile that make it the woods
const FOG_BRUSH = 48;    // px a side's hero or soldier must be inside to see someone in the woods
const FOG_BRUSH_RIM = 1.5; // tiles outside a brush patch's rim a side's hero or soldier still sees into it
const FOG_FACE = 6;      // px past where a sight line meets stone still lit, so the wall's face shows

// whether the fog is up: a match on the ground, never the practice field or
// the title tour. DBG.fog = false lifts it for a debug look
function fogUp() {
  return !PRACTICE && state.mode === 'play' && window.DBG.fog !== false;
}

// Every eye a side has, as { x, y, r, near, stone, open }: near for a body (a
// hero or a soldier: what can walk up to the woods' edge and look in); stone
// for the cistern within its reach, so a line from it traces only what could
// stop it; open when it is not, so every line is clear (most eyes, in the
// field - those cost nothing to trace)
function sightSources(team, out) {
  out.length = 0;
  for (const p of players) if (p.team === team && p.active && !p.dead && !inAir(p)) out.push(sightEye(p.x, p.y, FOG_HERO, true));
  for (const b of robots) if (b.team === team && b.kind === 'soldier' && unitAlive(b)) out.push(sightEye(b.x, b.y, FOG_SOLDIER, true));
  for (const o of structures) {
    if (o.team !== team || o.building || o.dead) continue;
    if (o.type === 'tower') { const f = towerFoot(o); out.push(sightEye(f.x, f.y, FOG_TOWER, false)); }
  }
  return out;
}
function sightEye(x, y, r, near) {
  const stone = cisternDist(x, y) <= r + 1;
  return { x, y, r, near, stone, open: !stone };
}

// How far a sight line from (x, y) along the unit vector (dx, dy) runs before
// stone stops it, up to r: the cistern by its distance field (each step as
// long as the nearest stone is far)
function sightReach(x, y, dx, dy, r, stone) {
  let t = r;
  // the cistern: march by the distance to the nearest stone
  if (stone && cistOn) {
    let s = 0;
    while (s < t) {
      const d = cisternDist(x + dx * s, y + dy * s);
      if (d < 0.5) { t = s; break; }
      s += d === Infinity ? TILE : Math.max(1, d - 0.5);
    }
  }
  return t;
}
// the woods: a walkable tile with FOG_WOODS_N pines or more in the 5x5 round it
function inWoods(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (isSolidTile(tx, ty)) return false;
  let n = 0;
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const o = inWorld(tx + i, ty + j) && objects[(ty + j) * WORLD + tx + i];
    if (o && o.type === 'tree') n++;
  }
  return n >= FOG_WOODS_N;
}
// the woods' rule on a body at (x, y) the side's sight reaches: hidden unless
// one of the side's heroes or soldiers stands within FOG_BRUSH of it
function woodsHide(srcs, x, y) {
  if (!inWoods(x, y)) return false;
  for (const s of srcs) if (s.near && Math.hypot(s.x - x, s.y - y) < FOG_BRUSH) return false;
  return true;
}

// the brush's rule: a body in a deep snow patch (brushOf) is hidden unless
// one of the side's heroes or soldiers stands in the same patch or within
// FOG_BRUSH_RIM of its rim. Seeing OUT of it is nothing special
function brushHide(srcs, x, y) {
  const D = brushOf(x, y);
  if (!D) return false;
  for (const s of srcs) if (s.near && brushIn(D, s.x / TILE, s.y / TILE) > -FOG_BRUSH_RIM) return false;
  return true;
}
// every cover a body can be in that the side's eyes reach: the woods, the brush
function coverHide(srcs, x, y) { return woodsHide(srcs, x, y) || brushHide(srcs, x, y); }

// Whether `team` can see unit u right now. Its own side always; a rival the
// falcon marked always (the mark's one bypass, js/sim/abilities.js); on a
// client, never a body the host said is out of its sight (`fogHid`, the `fog`
// banner in js/net/snapshot.js - what it holds of that body is stale). Asked
// once per unit per side per tick: the answer is kept for the rest of the tick
const fogSeen = [new Map(), new Map()], fogEyes = [[], []], fogTick = [-1, -1];
function inSight(team, u) {
  if (u.fogHid) return false;
  if (!fogUp() || u.team === team || (team !== 0 && team !== 1)) return true;
  if (u.markT > 0) return true;
  fogEyesOf(team);
  const kept = fogSeen[team].get(u);
  if (kept !== undefined) return kept;
  const seen = sightAt(team, u.x, u.y);
  fogSeen[team].set(u, seen);
  return seen;
}
// the side's eyes this tick (worked out on the first ask of the tick)
function fogEyesOf(team) {
  if (fogTick[team] !== state.tick) { fogTick[team] = state.tick; fogSeen[team].clear(); sightSources(team, fogEyes[team]); }
  return fogEyes[team];
}
// whether `team` sees the point (x, y): inside an eye's reach with no stone
// between, and not in the woods or the brush out of a near eye's reach
// (coverHide). What a body is asked through inSight; a puff or a number on
// the wire, bare
function sightAt(team, x, y) {
  if (!fogUp() || (team !== 0 && team !== 1)) return true;
  const srcs = fogEyesOf(team);
  let seen = false;
  for (const s of srcs) {
    const dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy);
    if (d > s.r) continue;
    if (s.open || d < 1 || sightReach(s.x, s.y, dx / d, dy / d, d, s.stone) >= d) { seen = true; break; }
  }
  return seen && !coverHide(srcs, x, y);
}
