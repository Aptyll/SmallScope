'use strict';
// ------------------------------------------------------------ tunnels
// THE BURROW: a rabbit's drop (animalDies, js/wildlife.js) carried as a
// stack in a pack cell (ITEMS.tunnel, js/player.js). Used, it lays the NEAR HOLE where the ghost stands (the aim is the
// local hand's, below; the sim only ever sees the `tunnel` order), and the far
// end is dug behind the digger for TUN_DIG: wherever the digger stands when
// the clock runs out, the FAR HOLE opens and the two are one tunnel.
//
// A hole is a tile object (OBJECTS.tunnel, js/world.js) that knows its `mate`,
// its digger's side and `crumble` - so the snapshot, the save and every
// "is this tile free" rule carry it with nothing written for them. Anyone,
// of either side, takes a hole with a fresh press of the work key while
// standing on it; many can be under at once. Underground a body is out of the
// world (inAir, js/player.js: nothing hits it, nothing it wants gets through)
// and rides the line between the holes at TUN_SPEED as a moving mound of snow
// every player can see, then comes up on the far hole and waits TUN_CD before
// any hole takes it again. A rival standing on either hole for TUN_BREAK caves
// the whole tunnel. One tunnel a digger: a new one caves the old, and a digger
// who goes down before the far end opens loses the near hole with it.
// Bots never take a hole (yet), so a worker swinging beside one stays put.
const TUN_DIG = 10;        // s from the near hole going down to the far one opening
const TUN_CD = 3;          // s after coming up before any hole takes the body again
const TUN_BREAK = 3;       // s of a rival standing on a hole that caves the tunnel
const TUN_SPEED = 240;     // px/s underground: three times a walk, so a ten-second run is a ~3 s ride
const TUN_MIN_T = 0.5;     // s: the shortest ride, so a hole beside its mate is still a trip
const TUN_ON = 9;          // px from a hole's centre that counts as standing on it
const TUN_UP = 10;         // px ABOVE a hole's centre a body comes up: off it (TUN_ON), and the hole lies in front of the boots where neither the body nor its frame hides it
const TUN_FAR = 2;         // tiles round the digger the far hole may shift to, off a tree or the water
const TUN_DROP = 0.25;     // a rabbit's chance of leaving a burrow behind

// the hole's centre in world px: its tile's middle, a row low like the art
function tunX(o) { return o.tx * TILE + 8; }
function tunY(o) { return o.ty * TILE + 9; }
// a tile a hole can go down on: open snow or the road - not the ice, the
// water, or anything already standing there
function tunSiteOk(tx, ty) {
  if (!inWorld(tx, ty) || objects[idx(tx, ty)]) return false;
  const g = ground[idx(tx, ty)];
  return g === 0 || g === 3;
}
// THE one placement rule for the near hole: the ghost's colour, the click and
// the order all ask it. Inside the builder's reach, on a free site, with a
// burrow in the pack and no far end already being dug.
function tunPlaceOk(p, tx, ty) {
  if (p.dead || inAir(p) || p.digT > 0 || bagCount(p, 'tunnel') <= 0) return false;
  if (Math.hypot(tx * TILE + 8 - p.x, ty * TILE + 8 - p.y) > BUILD_REACH) return false;
  return tunSiteOk(tx, ty);
}
// the `tunnel` order (runCmd, js/ui/wheel.js): the near hole goes down and the
// dig starts. True, or why not.
function digTunnel(p, tx, ty) {
  if (!tunPlaceOk(p, tx, ty)) return 'site';
  bagTake(p, 'tunnel', 1);
  const old = tunHoleOf(p);
  if (old) caveTunnel(old);
  const o = placeObj(tx, ty, 'tunnel', { owner: p.id, team: p.team, mate: null, crumble: 0 });
  p.tunHole = idx(tx, ty);
  p.digT = TUN_DIG;
  sfxAt('tunnelDig', tunX(o), tunY(o));
  burst(tunX(o), tunY(o), '#e8eef8', 10, 45, 0.5, true);
  burst(tunX(o), tunY(o), '#6a5040', 6, 35, 0.45, true);
  return true;
}
// p's near hole, if it still stands
function tunHoleOf(p) {
  const o = p.tunHole >= 0 ? objects[p.tunHole] : null;
  return o && o.type === 'tunnel' && o.owner === p.id ? o : null;
}
// every hole standing: each digger's near hole and its mate
function tunHoles() {
  const out = [];
  for (const p of players) { const o = tunHoleOf(p); if (o) { out.push(o); if (o.mate) out.push(o.mate); } }
  return out;
}
// both ends fall in
function caveTunnel(o) {
  for (const h of [o, o.mate]) {
    if (!h || objects[idx(h.tx, h.ty)] !== h) continue;
    objects[idx(h.tx, h.ty)] = null;
    burst(tunX(h), tunY(h), '#e8eef8', 12, 50, 0.55, true);
    burst(tunX(h), tunY(h), '#6a5040', 8, 40, 0.5, true);
    sfxAt('tunnelCave', tunX(h), tunY(h));
  }
  const d = players[o.owner];
  if (d && (d.tunHole === idx(o.tx, o.ty) || (o.mate && d.tunHole === idx(o.mate.tx, o.mate.ty)))) { d.tunHole = -1; d.digT = 0; }
}
// the far end: the digger's own tile, or the nearest free one round it
function tunFarSite(p, near) {
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  for (let r = 0; r <= TUN_FAR; r++) {
    let best = null, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = ptx + dx, ty = pty + dy;
      if (!tunSiteOk(tx, ty) || (tx === near.tx && ty === near.ty)) continue;
      const d = Math.hypot(tx * TILE + 8 - p.x, ty * TILE + 8 - p.y);
      if (d < bd) { bd = d; best = { tx, ty }; }
    }
    if (best) return best;
  }
  return null;
}
// the work key pressed fresh on a hole with a mate (updatePlayer, js/sim.js,
// ahead of the swing): under it goes. True when it took the body.
function tunnelEnter(p) {
  if (p.control === 'ai' || p.tunCd > 0 || p.prone || p.fallT > 0 || p.dodgeT > 0 || p.eatT > 0 ||
    p.castT > 0 || p.rushT > 0 || p.shieldT > 0 || p.grapT > 0 || p.zip >= 0) return false;
  const h = tunUnder(p);
  if (!h || !h.mate) return false;
  const fx = tunX(h), fy = tunY(h), tx = tunX(h.mate), ty = tunY(h.mate);
  p.tun = { fx, fy, tx, ty, t: 0, len: Math.max(TUN_MIN_T, Math.hypot(tx - fx, ty - fy) / TUN_SPEED) };
  p.x = fx; p.y = fy; p.vx = p.vy = 0;
  p.charging = false; p.chargeT = 0; p.swingT = 0;
  sfxAt('tunnelIn', fx, fy);
  burst(fx, fy, '#e8eef8', 8, 40, 0.4, true);
  return true;
}
// the hole p is standing on, if any
function tunUnder(p) {
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tx = ptx + dx, ty = pty + dy;
    if (!inWorld(tx, ty)) continue;
    const o = objects[idx(tx, ty)];
    if (o && o.type === 'tunnel' && Math.hypot(tunX(o) - p.x, tunY(o) - p.y) <= TUN_ON) return o;
  }
  return null;
}
// up on the far hole: the ride's clock starts on the wait, and whatever was
// pressed down there is dropped rather than fired on the surface
function tunnelExit(p) {
  const t = p.tun;
  p.tun = null;
  p.x = t.tx; p.y = t.ty - TUN_UP; p.vx = p.vy = 0;
  p.tunCd = TUN_CD;
  p.tunE = true;
  const inp = p.input;
  inp.dodge = inp.eatBerry = inp.eatFish = inp.useCard = false;
  inp.ability = -1; inp.cmd = null;
  sfxAt('tunnelOut', t.tx, t.ty);
  burst(t.tx, t.ty, '#e8eef8', 12, 50, 0.5, true);
  burst(t.tx, t.ty, '#6a5040', 5, 35, 0.4, true);
}
// one step of every tunnel: the waits, the digs, the rides and the crumbling
// (updatePlay, js/sim.js, after the players have stepped)
function updateTunnels(dt) {
  for (const p of players) {
    if (p.tunCd > 0) p.tunCd = Math.max(0, p.tunCd - dt);
    if (p.tun) { p.tun.t += dt; const f = Math.min(1, p.tun.t / p.tun.len); p.x = p.tun.fx + (p.tun.tx - p.tun.fx) * f; p.y = p.tun.fy + (p.tun.ty - p.tun.fy) * f; if (f >= 1) tunnelExit(p); }
    if (p.digT <= 0) continue;
    const near = tunHoleOf(p);
    if (!near) { p.digT = 0; continue; }
    if (p.dead) { caveTunnel(near); continue; }
    p.digT -= dt;
    if (p.digT > 0) continue;
    p.digT = 0;
    const s = tunFarSite(p, near);
    if (!s) { caveTunnel(near); if (!bagAdd(p, 'tunnel', 1)) spawnDrop(p.x, p.y, 'tunnel'); continue; } // nowhere to come up: the burrow goes back in the pack, or at the boots when it is full
    const far = placeObj(s.tx, s.ty, 'tunnel', { owner: p.id, team: p.team, mate: near, crumble: 0 });
    near.mate = far;
    sfxAt('tunnelOut', tunX(far), tunY(far));
    burst(tunX(far), tunY(far), '#e8eef8', 12, 50, 0.5, true);
    burst(tunX(far), tunY(far), '#6a5040', 6, 35, 0.45, true);
  }
  for (const h of tunHoles()) {
    if (objects[idx(h.tx, h.ty)] !== h) continue; // caved earlier this step
    let on = false;
    for (const q of players) {
      if (!q.active || q.dead || inAir(q) || q.team === h.team) continue;
      if (Math.hypot(q.x - tunX(h), q.y - tunY(h)) <= TUN_ON) { on = true; break; }
    }
    h.crumble = on ? h.crumble + dt : Math.max(0, h.crumble - dt);
    if (h.crumble >= TUN_BREAK) caveTunnel(h);
  }
}

// ---- the aim: the local hand's ghost ---------------------------------------
// The burrow's key (or a click on its pack cell) stands a hole ghost on the
// tile under the pointer, the build list's grammar: green where tunPlaceOk says it can go,
// red where not, and the builder's reach dotted round the body. A left press
// on the world sends the order; the key again, the right button or Escape
// puts it away. state.tunAim is the screen's, never the match's (SAVE_STATE_SKIP).
function tunnelAimToggle() {
  if (state.tunAim) { state.tunAim = false; SFX.ui(false); return; }
  if (player.dead || inAir(player) || player.digT > 0 || bagCount(player, 'tunnel') <= 0) { bagDenied(); return; }
  state.build = null;
  state.tunAim = true;
  SFX.ui(true);
}
function tunnelAimTile() { return { tx: Math.floor(mouseWX() / TILE), ty: Math.floor(mouseWY() / TILE) }; }
// the press on the world while aiming (pointerPress, input.js)
function tunnelAimPress() {
  const t = tunnelAimTile();
  if (!tunPlaceOk(player, t.tx, t.ty)) { SFX.deny(); return; }
  SFX.unlock();
  player.input.cmd = { kind: 'tunnel', tx: t.tx, ty: t.ty };
  state.tunAim = false;
}

// the burrow's 8x8 icon (ITEMS.tunnel): a hole in a snow mound with a
// rabbit's ears in it - the pack cell, the drop on the snow and the floater
// all draw this one canvas
SPRITES.itemTunnel = bakeGrid([
  '...b.b..',
  '...b.b..',
  '.wwbwbw.',
  'wwdkkdww',
  'wdkkkkdw',
  'swdkkdws',
  '.ssssss.',
  '........',
], { w: '#e8eef8', s: '#a9b6d0', d: '#6a5040', k: '#1a1220', b: '#9a6a45' }, 8);
