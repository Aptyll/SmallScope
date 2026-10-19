'use strict';
// The zipline: each team's cable, laid at boot, and the ride every body takes
// on it (drawn by js/draw/zipline.js).
// ------------------------------------------------------------ zipline
// THE ZIPLINE: one cable per team, strung on pylons from the stump ring
// beside its bird, out over the spur's treeline and along the road's own verge, to
// a terminus ZIP_MID_GAP road-units short of the road's centre - so the
// middle stretch where the waves meet is cable-free and is always walked
// into. The walk out of a base is dead time with no decisions in it; the
// fight is not; the cable compresses exactly the first and stops at the
// second. ANY body standing under EITHER cable clips on with E (input.jump -
// the same hop intent the eagle reads), rides at ZIP_SPD
// (three times walk) in whichever direction it holds along the cable, and
// lets go anywhere with E again; a dodge rolls off it the way it rolls off
// the grapple. Riding is hands-on-the-handle: no swing, shot, cast, fish or
// prone (every gate lists `p.zip >= 0` beside fallT and dodgeT), but a
// rider is still a body to every weapon - arrows, the roll's sweep, a
// turret, a wolf - and plain damage never dismounts. A stun, a root or a
// net does (zipEnd with `fell`: dropped at rest on the snow under the
// cable). Two RIVALS meeting on one cable crash (zipCrash): both stunned
// ZIP_CRASH_STUN and dropped where they met; a side's own riders pass
// through each other. The exit KEEPS the cable's velocity the way grapEnd keeps the
// reel's, so a hop-off is a dash and shift on landing carves a slide.
// Riders leave the unit-contact list (separateUnits: the body is above the
// ground) and move by the cable alone - no moveEntity, so a wall or a pine
// under the line never stops one. The lines are laid at boot by placeZips,
// right after the road, on pure reads (roadNest, roadSpan, roadEdgeAt,
// findCrashPoint, objAt): nothing rolls, so genWorld and every seed's
// ground are untouched; a pylon (`pylon`, OBJECTS) fells the pine or rock
// on its tile like the road's own furniture and refuses anything else. Its
// pixels and the cable pass are js/draw/zipline.js. Bots ride it through
// steerTo (aiZipWorth, js/ai.js), and the waves' soldiers ride any cable that
// carries them toward the rival bird (soldierBoard, robots.js): a robot rides
// through the same zipBoard/zipRide/zipEnd as a player, minus the hands.
const ZIP_MID_GAP = 20;    // u short of the road's centre the front terminus stands
const ZIP_OUT = 0.6;       // tiles past the ragged road edge the cable runs - the shoulder, never the lane
const ZIP_SPAN = 10;       // u between pylons along the road (about 226 px)
const ZIP_SPD = 220;       // px/s - 3x walk, under GRAP_REEL (260) so the hook stays the fastest thing in the game
const ZIP_GRAB = 32;       // px off the cable's ground track a body may clip on from: two tiles, so the press works from the lane and the body hops the rest
const ZIP_HOVER = 6;       // px the pointer may sit off the DRAWN cable (the track lifted by zipLift) and still be on it: the hover highlight and the click scheme's press-on-the-cable read this
const ZIP_ALT = 8;         // px the riding body hangs above its own shadow (the draw)
const ZIP_H = 31;          // px above the ground track the cable itself hangs at a pylon: one row under the crossarm's top (PYLON_H, js/draw/zipline.js)
const ZIP_SAG = 3;         // px a span sags at its middle
const ZIP_CRASH_R = 8;     // px along the cable two rival riders meet inside (a body's width)
const ZIP_CRASH_STUN = 0.8; // s both are stunned for: a body hit at full speed, the tackle's top (TACKLE_STUN, actions.js)
const ZIP_BASE_OUT = 4.4;  // tiles from the crater the base pylon stands: in the middle stump ring (BOOM_R..BOOM_STUMP_R), so the ride home lets go beside the bird, well clear of the verge pylon
const ZIP_SPUR_OFF = 1.9;  // tiles the spur leg stands off the spur's own axis (over SPUR_HW: never on the track), toward the front
const zips = [];           // [team] -> { team, pts: [{x, y}] (body positions, base -> front), cum: [px along at each point], len }
// a point `s` tiles off the diagonal at u, signed like roadOffS (+ toward the
// bottom-right side), in continuous tile-index space
function zipTile(u, s) { return { x: u + s / Math.SQRT2, y: WORLD - 1 - u + s / Math.SQRT2 }; }
function placeZips() {
  zips.length = 0;
  if (PRACTICE) return;
  const sp = roadSpan(), um = (sp.u0 + sp.u1) / 2;
  for (const team of [0, 1]) {
    const n = roadNest(team), dirF = team === 0 ? 1 : -1, side = n.side; // dirF: u toward the centre
    const c = findCrashPoint({ team }), cx = c.x / TILE - 0.5, cy = c.y / TILE - 0.5; // where the bird will come down (eagle.js: the same rule the crash uses)
    let ax = n.jx - cx, ay = n.jy - cy; const L = Math.hypot(ax, ay) || 1; ax /= L; ay /= L; // the spur's axis, crater -> road
    const lx = dirF / Math.SQRT2, ly = -dirF / Math.SQRT2;                                    // along the road, toward the front
    const tiles = [];
    tiles.push({ x: cx + ax * ZIP_BASE_OUT + lx * ZIP_SPUR_OFF, y: cy + ay * ZIP_BASE_OUT + ly * ZIP_SPUR_OFF });
    const u1 = n.u + dirF * ZIP_SPUR_OFF / Math.SQRT2, uEnd = um - dirF * ZIP_MID_GAP;
    const verge = (u) => zipTile(u, side * (roadEdgeAt(u, side) + ZIP_OUT));
    tiles.push(verge(u1));
    for (let k = 1; ; k++) {
      let u = u1 + dirF * k * ZIP_SPAN;
      const last = (uEnd - u) * dirF < ZIP_SPAN * 0.4; // a stub of a span at the end joins the one before it
      if (last) u = uEnd;
      tiles.push(verge(u));
      if (last) break;
    }
    const pts = [];
    for (const t of tiles) {
      // the pylon's tile: the nearest along the road that is dry and holds
      // nothing but worldgen's scenery (a pine or a rock gives way, like the
      // road's poles); the point stands even if no tile will take a pylon
      let tx = Math.round(t.x), ty = Math.round(t.y);
      for (const k of [0, 1, -1, 2, -2]) {
        const qx = tx + k, qy = ty - k;
        if (!inWorld(qx, qy) || waterAt(qx, qy)) continue;
        const o = objects[idx(qx, qy)];
        if (o && !laneFells(o)) continue;
        placeObj(qx, qy, 'pylon', { team });
        tx = qx; ty = qy;
        break;
      }
      pts.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE - 4 }); // a body position: its feet (p.y + 4) on the tile's centre
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    zips[team] = { team, pts, cum, len: cum[cum.length - 1] };
  }
}
// the cable at `d` px along: the body position on its ground track, the unit
// tangent (base -> front), the span it is on and how far across it (0..1)
function zipPoint(z, d) {
  d = Math.max(0, Math.min(z.len, d));
  let i = 1;
  while (i < z.cum.length - 1 && z.cum[i] < d) i++;
  const a = z.pts[i - 1], b = z.pts[i], sl = (z.cum[i] - z.cum[i - 1]) || 1;
  const t = (d - z.cum[i - 1]) / sl;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx: (b.x - a.x) / sl, ty: (b.y - a.y) / sl, seg: i - 1, t };
}
// how high above its ground track the cable hangs at `d`: ZIP_H at a pylon,
// ZIP_SAG less at a span's middle
function zipLift(z, d) { const q = zipPoint(z, d); return ZIP_H - ZIP_SAG * 4 * q.t * (1 - q.t); }
// the nearest point of a line to (x, y): px along it and px off its track
function zipNearest(z, x, y) {
  let best = { d: 0, dist: Infinity };
  for (let i = 1; i < z.pts.length; i++) {
    const a = z.pts[i - 1], b = z.pts[i], sl = (z.cum[i] - z.cum[i - 1]) || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / (sl * sl)));
    const dist = Math.hypot(x - (a.x + (b.x - a.x) * t), y - (a.y + (b.y - a.y) * t));
    if (dist < best.dist) best = { d: z.cum[i - 1] + t * sl, dist };
  }
  return best;
}
// the line a body may clip on right now: the nearer of the two, within
// ZIP_GRAB of its track - or null. Either side's: a cable is anyone's ride
function zipNear(p) {
  let best = null, bd = ZIP_GRAB;
  for (const z of zips) {
    if (!z) continue;
    const n = zipNearest(z, p.x, p.y);
    if (n.dist <= bd) { bd = n.dist; best = { z, d: n.d }; }
  }
  return best;
}
// the cable a world point sits on as DRAWN - a side's line hangs zipLift
// above its ground track (pts are body positions, the strand is at y + 4 -
// lift), so the point is dropped to the track by the lift where it lands,
// once to find the span and once more with that span's own sag - within
// ZIP_HOVER, or null. The pointer's question (hoverZip, actions.js) and the
// click scheme's (ckRightPress, input.js): both ask about the strand the
// eye is on, never the invisible track under it. Either side's line, the nearer
function zipUnder(wx, wy) {
  let best = null;
  for (const z of zips) {
    if (!z) continue;
    let n = zipNearest(z, wx, wy - 4 + ZIP_H);
    n = zipNearest(z, wx, wy - 4 + zipLift(z, n.d));
    if (n.dist <= ZIP_HOVER && (!best || n.dist < best.dist)) best = { z, d: n.d, dist: n.dist };
  }
  return best;
}
// the mount: the point of the cable at d, or the nearest along it whose
// ground tile a body can stand on - a pylon stands ON the track, and the
// shoulder holds the odd pine or rock - so a walk to the cable (zipWalkStep
// below, and a bot's, steerTo in ai.js) has a goal the feet can reach: the
// track point itself, or a tile's width to either side of it (still well
// inside ZIP_GRAB, so the press works from there) - the nearest along the
// cable first, out to ten tiles either way. The first span out of a base
// runs the spur's treeline, where the track is under pines for its whole
// length and only the verge beside it can be stood on. Null when nothing
// that far will do. The point comes back as the tile's centre in BODY
// coordinates (feet at y + 4, as nearestDryTile hands one back), so the tile
// the feet were tested on is the tile navTo routes to - an offset point off a
// diagonal cable can put the two a row apart, and the route fails on a pine
// nobody is standing under.
function zipMount(z, d) {
  for (let k = 0; k <= 160; k += 16) for (const o of (k ? [k, -k] : [0])) {
    const q = zipPoint(z, d + o);
    for (const s of [0, 16, -16]) {
      const tx = Math.floor((q.x - q.ty * s) / TILE), ty = Math.floor((q.y + q.tx * s + 4) / TILE);
      if (walkable(tx, ty)) return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE - 4 };
    }
  }
  return null;
}
// the hop intent on the ground (updatePlay reads input.jump for every
// player alike): riding, it lets go; walking to the cable, it calls the
// walk off; under a cable, it clips on; out of reach with the aim on your
// a cable as drawn (zipUnder - the pointer, for a human), it starts the
// walk there (zipWalkStart, below)
function zipToggle(p) {
  if (p.zip >= 0) { zipEnd(p, false); return; }
  if (p.zipWalk) { zipWalkEnd(p); return; }
  const near = zipNear(p);
  if (near) { zipStart(p, near); return; }
  const u = zipUnder(p.input.aimX, p.input.aimY);
  if (u) zipWalkStart(p, u.z);
}
// THE WALK TO THE CABLE: a channel. The body routes itself to the nearest
// point of the named cable's track (navTo - never a straight line at it) and
// clips on the moment it is inside ZIP_GRAB, so the press that names the
// cable is the whole gesture from anywhere the pointer can see it. It is
// a channel because the player is not holding the stick: ANY held movement
// takes the legs back and ends it, and so does anything that takes the body
// - a dodge, a draw, a cast, a rush, a shield, the grapple, a slide, going
// prone, a stun, a root, a net, a hole, the air, a death - and a route that
// fails or pins (navTo's ok). No timer. State on the body: p.zipWalk (a
// flag; the goal is re-read every step, since the nearest point moves with
// the body) and p.zipWalkL (the line's team: which cable). The walk does not write p.lastMx/lastMy (updatePlayer), so the
// clip-on at the end still reads the way you were walking BEFORE the press.
function zipWalkStart(p, z) {
  if (p.dead || p.stunT > 0 || p.fallT > 0 || p.dodgeT > 0 || p.rushT > 0 || p.castT > 0 || p.shieldT > 0 || p.grapT > 0 || p.charging || inAir(p)) return;
  risePlayer(p);
  p.zipWalk = true; p.zipWalkL = z.team;
  navClear(p);
}
function zipWalkEnd(p) {
  if (!p.zipWalk) return;
  p.zipWalk = false;
  navClear(p);
}
// one sim step of the walk (updatePlayer, before the input is read): the
// stick to hold this step, or null once the walk is over - clipped on, called
// off, or taken over by the player's own input
function zipWalkStep(p, dt) {
  if (!p.zipWalk) return null;
  const z = zips[p.zipWalkL];
  const busy = p.dead || p.stunT > 0 || p.rootT > 0 || p.fallT > 0 || p.dodgeT > 0 || p.rushT > 0 || p.castT > 0 ||
    p.shieldT > 0 || p.grapT > 0 || p.charging || p.sliding || p.prone || inAir(p);
  if (!z || busy || p.input.mx || p.input.my) { zipWalkEnd(p); return null; }
  const n = zipNearest(z, p.x, p.y);
  if (n.dist <= ZIP_GRAB) { zipWalkEnd(p); zipStart(p, { z, d: n.d }); return null; }
  const q = zipMount(z, n.d); // never the track point itself: at a pylon that is the pylon's tile
  if (!q) { zipWalkEnd(p); return null; }
  const nv = navTo(p, q.x, q.y, PLAYER_R, 0, dt);
  if (!nv.ok) { zipWalkEnd(p); return null; }
  return { mx: nv.dx, my: nv.dy };
}
function zipStart(p, near) {
  if (p.dead || p.stunT > 0 || p.fallT > 0 || p.dodgeT > 0 || p.rushT > 0 || p.castT > 0 || p.shieldT > 0 || inAir(p)) return;
  if (p.grapT > 0) grapEnd(p);      // off the rope and onto the handle
  risePlayer(p);                    // up out of the snow first
  breakEat(p);                      // the meal is over: both hands are on the handle
  cancelCatch(p);
  if (p.charging) { p.charging = false; p.chargeT = 0; }
  p.fireArmed = false;
  p.sliding = false; p.slideT = 0;
  // the way you were LAST walking (p.lastMx/lastMy: the stick's last held
  // direction, kept across the stop - a body that walked home and stood
  // still for the press is going home), or toward the front when nothing
  // said otherwise - the direction you are almost always going. Across the
  // cable (the walk in from the lane) says nothing, so it is the default
  const q = zipPoint(near.z, near.d), dot = p.lastMx * q.tx + p.lastMy * q.ty;
  zipBoard(p, near.z, near.d, dot < -0.3 ? -1 : 1);
}
// onto the handle, for any body (a player through zipStart above, a soldier
// through soldierBoard, robots.js): the line, the spot, the way - an end has
// one way to go (a clip-on AT the terminus that rode toward the front would
// let go on its first step) - and the body up on the cable
function zipBoard(e, z, d, dir) {
  e.zip = z.team; e.zipD = d; e.zipLast = d;
  e.zipDir = d <= 1 ? 1 : d >= z.len - 1 ? -1 : dir;
  const at = zipPoint(z, d);
  e.x = at.x; e.y = at.y;
  sfxAt('dodge', e.x, e.y);
  burst(e.x, e.y + 4, '#dfe8f4', 4, 26, 0.3, true);
}
// letting go: the body stays where the cable put it and KEEPS the cable's
// velocity for the surface to spend (a hop-off is a dash); `fell` - knocked
// off by a stun, a root, a net or a crash - drops it at rest instead. Any
// body: the route that brought it to the cable is stale either way
function zipEnd(p, fell) {
  if (!(p.zip >= 0)) return;
  p.zip = -1;
  navClear(p);
  if (fell) { p.vx = 0; p.vy = 0; }
  // a pine, a rock or the cistern's stone stands under the shoulder here and there: come down beside it
  const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + 4) / TILE);
  if (isSolidTile(tx, ty) || cisternCrowds(p.x, p.y, PLAYER_R)) {
    const out = nearestDryTile(p.x, p.y + 4, p);
    p.x = (out.tx + 0.5) * TILE; p.y = (out.ty + 0.5) * TILE - 4;
  }
  if (!fell) sfxAt('dodge', p.x, p.y);
  burst(p.x, p.y + 4, '#cfd8e8', 4, 30, 0.3, true);
}
// one sim step of the ride (playerMove, updatePlayer's movement ladder): a held stick
// along the cable past a dead zone picks the direction, the cable sets the
// position outright, and either end lets go
function zipStep(p, dt, mx, my, len) {
  const z = zips[p.zip];
  if (!z) { p.zip = -1; return; }
  const q0 = zipPoint(z, p.zipD);
  if (len > 0) {
    const dot = mx * q0.tx + my * q0.ty;
    if (dot > 0.5) p.zipDir = 1; else if (dot < -0.5) p.zipDir = -1;
  }
  p.sliding = false;
  zipRide(p, dt);
  faceToward(p, p.vx, p.vy);
}
// the cable's own step, for any body: on along it at ZIP_SPD, the position
// set outright, and either end lets go
function zipRide(e, dt) {
  const z = zips[e.zip];
  if (!z) { e.zip = -1; return; }
  e.zipD += e.zipDir * ZIP_SPD * dt;
  const q = zipPoint(z, e.zipD);
  e.x = q.x; e.y = q.y;
  e.vx = q.tx * ZIP_SPD * e.zipDir; e.vy = q.ty * ZIP_SPD * e.zipDir;
  if (e.zipD <= 0 || e.zipD >= z.len) { e.zipD = Math.max(0, Math.min(z.len, e.zipD)); zipEnd(e, false); }
}
// THE CRASH: once everyone has stepped (updatePlay, after the robots), two
// RIVAL riders on one cable within ZIP_CRASH_R of each other - or past each
// other since the last step (zipLast: px along then) - both take
// ZIP_CRASH_STUN through stunUnit, which drops each at rest where it hangs
// (zipEnd with `fell`). A side's own riders pass through each other. The
// riders are players (any seat) and soldiers alike
const zipRiders = [];
function zipCrash() {
  zipRiders.length = 0;
  for (const p of players) if (p.active && !p.dead && p.zip >= 0) zipRiders.push(p);
  for (const b of robots) if (!b.dead && b.zip >= 0) zipRiders.push(b);
  for (let i = 0; i < zipRiders.length; i++) for (let j = i + 1; j < zipRiders.length; j++) {
    const a = zipRiders[i], b = zipRiders[j];
    if (a.zip !== b.zip || a.team === b.team || a.zip < 0 || b.zip < 0) continue; // (an earlier crash this step may have dropped one)
    const g = a.zipD - b.zipD, g0 = a.zipLast - b.zipLast;
    if (Math.abs(g) > ZIP_CRASH_R && Math.sign(g) === Math.sign(g0)) continue;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    stunUnit(a, ZIP_CRASH_STUN, b);
    stunUnit(b, ZIP_CRASH_STUN, a);
    sfxAt('hit', mx, my);
    burst(mx, my + 4 - ZIP_ALT, '#ffe9a8', 8, 50, 0.4, true);
  }
  for (const e of zipRiders) if (e.zip >= 0) e.zipLast = e.zipD;
}
