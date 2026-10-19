'use strict';
// ------------------------------------------------------------ base
// THE BASES: each side's home is a fixed HOLLOW cut into its own roost
// corner's woods, on the road's diagonal - the same spot on every seed, so a
// base is designed rather than found, and every bot knows it. The bird comes
// in over its own corner and roosts at the PERCH, the back of the hollow
// (findCrashPoint, js/sim/eagle.js); the road runs in through the hollow's
// mouth and ends on the perch (baseRoadEnd caps laneDist, js/sim/world.js),
// so from the field the way home is one straight road. RED (team 0) holds the
// bottom-left corner, BLUE the top-right, mirrored across the creek like the
// camps (u -> WORLD - 1 - u). placeBase clears the hollow once the road is
// laid: pure position noise, no rng(), so no seed moves.
const BASE_U = 30;    // u from the corner along the diagonal the hollow's centre sits
const BASE_R = 15;    // tiles: the hollow's radius
const BASE_RAG = 1.2; // tiles its wall wanders either way: a clearing, not a circle
const PERCH_U = 21;   // u from the corner the bird roosts: the back of the hollow, deepest in the woods
const BASE_KEEP = 3;  // tiles past the wall the later worldgen passes (rocks, chests) keep off
// a RED-side u for either team: BLUE's base is RED's mirrored along the road
function baseU(team, u) { return team === 0 ? u : WORLD - 1 - u; }
// THE MOUTHS: the hollow opens three ways, one a LANE (js/sim/lanes.js) -
// 0 the top lane out of the top-left side of the wall, 1 the mid road out
// of the front, 2 the bot lane out of the bottom-right side - and the
// merchant raises one BAY (the barracks) just inside each, whose waves walk
// that lane (updateMerchant, js/sim/robots.js). Spots are in the road's
// frame: u along it from the side's own corner, s tiles across it (- the
// top side, + the bot side), the same for both teams.
const BASE_SIDE_U = 34;  // u of the top and bot mouths...
const BASE_SIDE_S = 15;  // ...and the tiles across the road they open: on the wall
const BASE_BAYS = [[27, -10], [40, 6], [27, 10]]; // [u, s] per lane where its bay's centre stands: inside the mouth, beside the lane in, clear of the stall
// a point of a side's frame in tile-index space (continuous)
function baseTile(team, u, s) {
  const v = baseU(team, u);
  return { tx: v + s / Math.SQRT2, ty: WORLD - 1 - v + s / Math.SQRT2 };
}
// where lane `lane` leaves a side's hollow, and where its bay stands
function baseGate(team, lane) {
  return lane === 1 ? baseTile(team, BASE_U + BASE_R, 0) : baseTile(team, BASE_SIDE_U, (lane - 1) * BASE_SIDE_S);
}
function baseBaySpot(team, lane) { return baseTile(team, BASE_BAYS[lane][0], BASE_BAYS[lane][1]); }
function baseCentre(team) { const u = baseU(team, BASE_U); return { tx: u, ty: WORLD - 1 - u }; }
function basePerch(team) { const u = baseU(team, PERCH_U); return { u, tx: u, ty: WORLD - 1 - u }; }
// the u where the road leaves the hollow through its mouth: a side's junction (roadNest)
function baseGateU(team) { return baseU(team, BASE_U + BASE_R); }
// the wall's radius at bearing a off the centre, wandering on the position noise
function baseWall(team, a) {
  return BASE_R + (vnoise(Math.cos(a) * 2.2 + team * 41.3, Math.sin(a) * 2.2 + 7.7) - 0.5) * 2 * BASE_RAG;
}
// the side whose hollow holds (tx, ty), `pad` tiles past its wall counted in,
// or -1 (always on the practice field, which has no bases)
function baseAt(tx, ty, pad) {
  if (PRACTICE) return -1;
  for (const team of [0, 1]) {
    const c = baseCentre(team), dx = tx - c.tx, dy = ty - c.ty;
    if (Math.hypot(dx, dy) <= baseWall(team, Math.atan2(dy, dx)) + pad) return team;
  }
  return -1;
}
// the road's two ends: positive past either perch, so the lane as laid and
// drawn stops at the bird instead of running on to the corner
function baseRoadEnd(fx, fy) {
  const u = roadAlong(fx, fy);
  return Math.max(PERCH_U - u, u - (WORLD - 1 - PERCH_U));
}
// clear both hollows: whatever worldgen stood there goes (a rock with both of
// its tiles), and any ice is snow. Runs after placeRoad, before the cables
// and the camps (js/app/boot.js).
function placeBase() {
  if (PRACTICE) return;
  const R = Math.ceil(BASE_R + BASE_RAG);
  for (const team of [0, 1]) {
    const c = baseCentre(team);
    for (let ty = c.ty - R; ty <= c.ty + R; ty++) for (let tx = c.tx - R; tx <= c.tx + R; tx++) {
      if (!inWorld(tx, ty) || baseAt(tx, ty, 0) !== team) continue;
      const i = idx(tx, ty);
      if (objects[i]) fellScenery(tx, ty);
      if (ground[i] === 1) ground[i] = 0;
    }
  }
}
