'use strict';
// ------------------------------------------------------------ tunnels, drawn
// The burrow's pixels (the sim is js/tunnel.js). Everything here lies flat on
// the snow under whatever walks: the holes, the mound a body makes riding a
// tunnel, the dig's clock under a digger's boots, the aim's ghost - and the
// work key's cap over a hole the local player can take. Each state is a
// shape and a colour, never a word: a ring of dots that drains GOLD is a dig
// running out (the far end opens when it empties), one that fills PALE BLUE is
// your own wait after a ride (the hole takes you when it is whole), and a
// hole that shrinks and shakes is caving under a rival's boots.
const TUN_RING_N = 12;          // dots round a hole's ring
const TUN_RING_R = 11;          // px from the hole's centre to its ring (squashed to 0.6 down the screen)
const TUN_DIG_COL = '#f2cc6a', TUN_WAIT_COL = '#9be8ff', TUN_RING_OFF = 'rgba(30,38,72,0.45)', TUN_RING_INK = 'rgba(15,22,50,0.7)';
const TUN_SNOW = '#eef3fb', TUN_SNOW_LO = '#b8c4dc', TUN_MOUND_LO = '#7d8cb0', TUN_DIRT = '#6a5040', TUN_PIT = '#1a1220', TUN_PIT_LO = '#2c2030';

// a pixel ellipse, row by row, so its edge stays exact at any zoom
function tunOval(cx, cy, a, b, col) {
  if (a <= 0 || b <= 0) return;
  ctx.fillStyle = col;
  for (let dy = -b; dy < b; dy++) {
    const t = (dy + 0.5) / b, h = Math.round(a * Math.sqrt(Math.max(0, 1 - t * t)));
    if (h > 0) ctx.fillRect(cx - h, cy + dy, h * 2, 1);
  }
}
// a ring of TUN_RING_N 2x2 dots round (cx, cy), the first `lit` of them in
// `col` with a dark row under each so they read on snow and ice alike,
// clockwise from twelve
function tunRing(cx, cy, lit, col) {
  for (let i = 0; i < TUN_RING_N; i++) {
    const a = -Math.PI / 2 + (i / TUN_RING_N) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * TUN_RING_R) - 1, y = Math.round(cy + Math.sin(a) * TUN_RING_R * 0.6) - 1;
    if (i < lit) { ctx.fillStyle = TUN_RING_INK; ctx.fillRect(x, y + 2, 2, 1); }
    ctx.fillStyle = i < lit ? col : TUN_RING_OFF;
    ctx.fillRect(x, y, 2, 2);
  }
}
// the hole itself at its tile's screen corner: a kicked-up rim of snow, the
// dirt ring, the pit - the pit closing and the whole shaking as it caves -
// and a stake in its digger's colour, so a rival's tunnel reads as one
function tunHoleArt(cx, cy, k, team) {
  tunOval(cx, cy + 1, 7, 4, TUN_SNOW_LO);
  tunOval(cx, cy, 7, 4, TUN_SNOW);
  tunOval(cx, cy, 5, 3, TUN_DIRT);
  const a = Math.max(1, Math.round(4 * (1 - 0.7 * k))), b = Math.max(1, Math.round(2 * (1 - 0.5 * k)));
  tunOval(cx, cy, a, b, TUN_PIT);
  ctx.fillStyle = TUN_PIT_LO;
  ctx.fillRect(cx - a + 1, cy + b - 1, Math.max(1, a * 2 - 2), 1);
  if (team !== undefined) {
    ctx.fillStyle = '#4a3a30';
    ctx.fillRect(cx - 7, cy - 6, 1, 5);
    ctx.fillStyle = TEAMS[skin(team)].mark;
    ctx.fillRect(cx - 6, cy - 6, 2, 2);
  }
}
// one hole in the flat pass (render.js): its art, then whichever ring it owes
function drawTunnelHole(o, px, py, now) {
  const k = Math.min(1, (o.crumble || 0) / TUN_BREAK);
  const sh = k > 0 ? (((now * 30) | 0) % 2 ? -1 : 1) : 0;
  const cx = px + 8 + sh, cy = py + 9;
  tunHoleArt(cx, cy, k, o.team);
  if (!o.mate) { // still being dug: the far end's clock, draining
    const d = players[o.owner];
    if (d && d.digT > 0) tunRing(cx, cy, Math.ceil(TUN_RING_N * d.digT / TUN_DIG), TUN_DIG_COL);
  } else if (player.tunCd > 0 && !player.dead) { // your own wait after a ride, filling
    tunRing(cx, cy, Math.floor(TUN_RING_N * (1 - player.tunCd / TUN_CD)), TUN_WAIT_COL);
  }
}
// The flat pass's moving half: the mound every body under the snow pushes up
// (the line it is riding, from its near hole to its far one), with the snow
// it kicks behind it - and the dig's clock under every digger's boots, the
// same gold ring its near hole wears, so a rival can see where it comes up.
function drawTunnelGround(ex, ey, now) {
  for (const p of players) {
    if (!p.active) continue;
    if (p.tun) {
      const x = Math.round(p.x - ex), y = Math.round(p.y - ey);
      const dx = p.tun.tx - p.tun.fx, dy = p.tun.ty - p.tun.fy, d = Math.hypot(dx, dy) || 1;
      for (let i = 1; i <= 4; i++) { // the furrow it leaves: churned snow and dirt, fading
        ctx.globalAlpha = 0.75 - i * 0.15;
        const fx = Math.round(p.x - dx / d * i * 6 - ex), fy = Math.round(p.y - dy / d * i * 6 - ey) + 2;
        tunOval(fx, fy, 3 - (i >> 1), 1, TUN_MOUND_LO);
        ctx.fillStyle = TUN_DIRT;
        ctx.fillRect(fx - 1 + (i & 1), fy - 1, 1, 1);
      }
      ctx.globalAlpha = 1;
      const bob = ((now * 14 + p.id) | 0) % 2;
      tunOval(x, y + 2, 7, 3, TUN_MOUND_LO);
      tunOval(x, y + 1 - bob, 6, 3, TUN_SNOW_LO);
      tunOval(x, y - bob, 4, 2, TUN_SNOW);
      ctx.fillStyle = TUN_DIRT; // the dirt it turns up
      ctx.fillRect(x - 3, y - bob, 1, 1); ctx.fillRect(x + 2, y + 1 - bob, 1, 1); ctx.fillRect(x, y + 2 - bob, 1, 1);
      ctx.fillStyle = TEAMS[skin(p.team)].mark;
      ctx.fillRect(x - 1, y - 2 - bob, 2, 1);
      for (let i = 0; i < 4; i++) { // flecks thrown off the top
        const s = hash2(p.id * 7 + i, (now * 10) | 0);
        ctx.fillStyle = i & 1 ? TUN_DIRT : TUN_SNOW;
        ctx.fillRect(x - 6 + Math.round(s * 12), y - 3 - bob - Math.round(hash2(i, (now * 10) | 0) * 4), 1, 1);
      }
    } else if (p.digT > 0 && !p.dead && !inAir(p)) {
      tunRing(Math.round(p.x - ex), Math.round(p.y - ey) + 5, Math.ceil(TUN_RING_N * p.digT / TUN_DIG), TUN_DIG_COL);
    }
  }
}
// the aim's ghost on the tile under the pointer, beside the build list's
// (drawBuildGhost, js/ui/wheel.js) and in its grammar: the reach dotted round
// the body, the hole at half strength, its rim in the ghost's two answers
function drawTunnelGhost(ox, oy) {
  if (state.mode !== 'play' || !state.tunAim || state.mapOpen || state.settingsOpen || state.wheel) return;
  const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
  const r = Math.ceil(BUILD_REACH / TILE) + 1;
  ctx.fillStyle = 'rgba(15,22,50,0.4)';
  for (let ty = pty - r; ty <= pty + r; ty++) for (let tx = ptx - r; tx <= ptx + r; tx++) {
    if (Math.hypot(tx * TILE + 8 - player.x, ty * TILE + 8 - player.y) > BUILD_REACH) continue;
    ctx.fillRect(tx * TILE - ox, ty * TILE - oy, 1, 1);
  }
  if (!mouse.inside || overHud(mouse.x, mouse.y)) return;
  const t = tunnelAimTile(), ok = tunPlaceOk(player, t.tx, t.ty);
  const px = t.tx * TILE - ox, py = t.ty * TILE - oy;
  ctx.globalAlpha = ok ? 0.6 : 0.3;
  tunHoleArt(px + 8, py + 9, 0, player.team);
  ctx.globalAlpha = 1;
  const rim = (c, x, y) => { ctx.fillStyle = c; ctx.fillRect(x, y, TILE, 1); ctx.fillRect(x, y + TILE - 1, TILE, 1); ctx.fillRect(x, y, 1, TILE); ctx.fillRect(x + TILE - 1, y, 1, TILE); };
  rim('rgba(15,22,50,0.9)', px + 1, py + 1);
  rim(ok ? BUILD_OK : BUILD_NO, px, py);
}
// The work key's claim on a hole (drawWorkHint, js/ui/wheel.js): standing on
// one with a far end, the bare cap over it says the key takes you down - the
// zipline's grammar. While your wait runs there is no cap (the ring says
// "not yet"), but the hole still owns the key, so nothing else's prompt shows.
function drawTunnelHint(ox, oy) {
  if (player.dead || inAir(player)) return false;
  const h = tunUnder(player);
  if (!h || !h.mate) return false;
  if (player.tunCd > 0) return true;
  const w = promptW('', 'work');
  drawKeyPrompt(Math.round(tunX(h) - ox - w / 2), Math.round(h.ty * TILE - oy - 12), '', keyHeld('work'));
  return true;
}
