'use strict';
// The fog of war's rule: what a side can see. Each hero, wave soldier and
// finished turret of a side lights a circle round it; solid stone (the
// cistern's wall, built walls) stops a line of sight, pines never do; a body
// standing deep in the woods is hidden from the outside until one of the side
// stands close. Rival bodies and every creature outside a side's sight are
// gone for it: from the screen and both maps (js/draw/fog.js draws that) and
// from its bots (they ask through seenAt(q, range, team) and inSight).
// Terrain, buildings and the eagles are never fogged.
//   Everything here is read off the world as it stands, so nothing new is
// saved. Online the host sends each side only what this says it sees (the
// `fog` banner in js/net/snapshot.js), and a client takes its word (`fogHid`).
// ------------------------------------------------------------ fog of war
const FOG_HERO = 160;    // px a hero sees
const FOG_SOLDIER = 112; // px a wave soldier sees (past its SOLDIER_AGGRO, so it sees what it turns on)
const FOG_TURRET = 128;  // px a turret sees (past its longest throw)
const FOG_WOODS_N = 9;   // pines in the 5x5 tiles round a walkable tile that make it the woods
const FOG_BRUSH = 48;    // px a side's hero or soldier must be inside to see someone in the woods
const FOG_FACE = 6;      // px past where a sight line meets stone still lit, so the wall's face shows

// whether the fog is up: a match on the ground, never the practice field or
// the title tour. DBG.fog = false lifts it for a debug look
function fogUp() {
  return !PRACTICE && state.mode === 'play' && window.DBG.fog !== false;
}

// a built wall on the tile: the stone a side builds (gates too)
function sightWallAt(tx, ty) {
  if (!inWorld(tx, ty)) return true;
  const s = structOf(objects[ty * WORLD + tx]);
  return !!s && (s.type === 'wall' || s.type === 'longwall' || s.type === 'gate');
}

// Every eye a side has, as { x, y, r, near, walls, stone, open }: near for a
// body (a hero or a soldier: what can walk up to the woods' edge and look in);
// walls and stone for a built wall or the cistern within its reach, so a line
// from it traces only what could stop it; open when neither is, so every line
// is clear (most eyes, in the field - those cost nothing to trace)
function sightSources(team, out) {
  out.length = 0;
  for (const p of players) if (p.team === team && p.active && !p.dead && !inAir(p)) out.push(sightEye(p.x, p.y, FOG_HERO, true));
  for (const b of robots) if (b.team === team && b.kind === 'soldier' && unitAlive(b)) out.push(sightEye(b.x, b.y, FOG_SOLDIER, true));
  for (const o of structures) {
    if (o.type !== 'turret' || o.team !== team || o.building || o.dead) continue;
    const pv = turretPivot(o);
    out.push(sightEye(pv.x, pv.y, FOG_TURRET, false));
  }
  return out;
}
function sightEye(x, y, r, near) {
  const stone = cisternDist(x, y) <= r + 1;
  let walls = false;
  const t0x = Math.floor((x - r) / TILE), t1x = Math.floor((x + r) / TILE);
  const t0y = Math.floor((y - r) / TILE), t1y = Math.floor((y + r) / TILE);
  for (let ty = t0y; ty <= t1y && !walls; ty++) for (let tx = t0x; tx <= t1x; tx++) if (sightWallAt(tx, ty)) { walls = true; break; }
  return { x, y, r, near, walls, stone, open: !walls && !stone };
}

// How far a sight line from (x, y) along the unit vector (dx, dy) runs before
// stone stops it, up to r: walls tile by tile (a grid walk), the cistern by
// its distance field (each step as long as the nearest stone is far)
function sightReach(x, y, dx, dy, r, walls, stone) {
  let t = r;
  // the walls: step from tile edge to tile edge
  if (walls) t = sightWalls(x, y, dx, dy, r);
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
// how far the line runs before a built wall's tile (r if none): tile edge to tile edge
function sightWalls(x, y, dx, dy, r) {
  let tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const ix = dx !== 0 ? Math.abs(TILE / dx) : Infinity, iy = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
  let nx = dx !== 0 ? ((dx > 0 ? (tx + 1) * TILE - x : x - tx * TILE) / Math.abs(dx)) : Infinity;
  let ny = dy !== 0 ? ((dy > 0 ? (ty + 1) * TILE - y : y - ty * TILE) / Math.abs(dy)) : Infinity;
  for (;;) {
    let e;
    if (nx < ny) { e = nx; nx += ix; tx += sx; } else { e = ny; ny += iy; ty += sy; }
    if (e >= r) return r;
    if (sightWallAt(tx, ty)) return e;
  }
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
// between, and not deep in the woods out of a near eye's reach. What a body
// is asked through inSight; a puff or a number on the wire, bare
function sightAt(team, x, y) {
  if (!fogUp() || (team !== 0 && team !== 1)) return true;
  const srcs = fogEyesOf(team);
  let seen = false;
  for (const s of srcs) {
    const dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy);
    if (d > s.r) continue;
    if (s.open || d < 1 || sightReach(s.x, s.y, dx / d, dy / d, d, s.walls, s.stone) >= d) { seen = true; break; }
  }
  return seen && !woodsHide(srcs, x, y);
}
