'use strict';
// A building's pixels: the turret's rotating half and its bolts, the bay
// and barracks overlays, the net, and structSprite/drawTiledStruct - how a
// tiered or multi-tile STRUCTS entry finds its sprite and lays it down.
// ---- the turret's rotating half, the bay, the net and the tiled struct ----
// The grid stops at the collar; the housing and barrel are rasterised pixel by
// pixel at the live angle and dilated into a 1px dark rim - the same trick the
// arrows use - so the gun stays crisp and readable at any bearing over snow.
const TUR_METAL = [
  { d: '#6b4a30', m: '#8a6142', l: '#a3794f' }, // tier 1: iron-banded timber
  { d: '#666d84', m: '#8b93a8', l: '#a8b0c4' }, // tier 2: stone grey
  { d: '#b9884f', m: '#d8a850', l: '#f2cc6a' }, // tier 3: gilt
];
const TUR_RIM = '#0d1226';
// shared by the head and its bolts: plus-dilate the pixel map into a dark rim,
// paint the rim, then the body over it
function paintRimmed(body) {
  const rim = new Set();
  for (const k of body.keys()) {
    const i = k.indexOf(','), x = +k.slice(0, i), y = +k.slice(i + 1);
    const n = [(x - 1) + ',' + y, (x + 1) + ',' + y, x + ',' + (y - 1), x + ',' + (y + 1)];
    for (const q of n) if (!body.has(q)) rim.add(q);
  }
  ctx.fillStyle = TUR_RIM;
  for (const k of rim) { const i = k.indexOf(','); ctx.fillRect(+k.slice(0, i), +k.slice(i + 1), 1, 1); }
  for (const [k, col] of body) { const i = k.indexOf(','); ctx.fillStyle = col; ctx.fillRect(+k.slice(0, i), +k.slice(i + 1), 1, 1); }
}
function drawTurretHead(o, cx, cy) {
  const ang = o.ang || 0, ca = Math.cos(ang), sa = Math.sin(ang);
  const tm = TEAMS[skin(o.team === undefined ? 0 : o.team)];
  const M = TUR_METAL[Math.min(TUR_METAL.length - 1, o.tier)];
  const rec = -(o.rec || 0) * 3;   // recoil slides the barrel back through the mantlet
  const chg = o.chg || 0;
  const body = new Map();
  // f runs along the barrel, sd across it; every point rotates about the pivot.
  // Later writes win, so this paints back-to-front: casemate, then the plate the
  // barrel comes through, then the barrel itself.
  const put = (f, sd, c) => {
    body.set(Math.round(cx + f * ca - sd * sa) + ',' + Math.round(cy + f * sa + sd * ca), c);
  };
  // casemate: a rounded armour shell, lit from the top like the rest of the art
  for (let f = -5; f <= 4; f++) for (let sd = -4; sd <= 4; sd++) {
    if (((f + 0.5) * (f + 0.5)) / 26 + (sd * sd) / 18 > 1) continue;
    put(f, sd, sd <= -3 ? tm.coatL : sd >= 3 ? tm.coatD : tm.coat);
  }
  for (let f = -4; f <= 1; f++) put(f, -3, tm.trim);                    // hull highlight
  for (const rv of [[-3, -1], [-3, 1], [0, -2], [0, 2]]) put(rv[0], rv[1], tm.coatD); // rivets
  // vision slit: team colour at rest, hot white the instant the shot is ready
  const eye = chg > 0.99 ? '#ffffff' : chg > 0.45 ? tm.glow : tm.mark;
  for (let f = -3; f <= 0; f++) put(f, -2, eye);
  for (let f = -6; f <= -5; f++) for (let sd = -2; sd <= 2; sd++) put(f, sd, M.d); // breech block
  for (let f = 2; f <= 5; f++) for (let sd = -3; sd <= 3; sd++) {       // mantlet plate
    put(f, sd, sd <= -2 ? M.l : sd >= 2 ? M.d : M.m);
  }
  // barrel: light top edge, dark underside, so it reads as round at any bearing
  for (let f = 5; f <= 16; f++) for (let sd = -2; sd <= 2; sd++) {
    put(f + rec, sd, sd === -2 ? M.l : sd === 2 ? M.d : M.m);
  }
  for (let f = 13; f <= 16; f++) for (let sd = -3; sd <= 3; sd++) {     // muzzle brake
    put(f + rec, sd, sd <= -2 ? M.l : sd >= 2 ? M.d : M.m);
  }
  put(14 + rec, -3, M.d); put(14 + rec, 3, M.d);                        // brake slots
  for (let sd = -1; sd <= 1; sd++) put(16 + rec, sd, '#131a2e');        // the bore, looking down it
  paintRimmed(body);
}
// a turret bolt: a stubby bright slug with a halo, deliberately nothing like an arrow
function drawBolt(a, ex, ey) {
  const vd = Math.hypot(a.vx, a.vy) || 1;
  const nx = a.vx / vd, ny = a.vy / vd, qx = -ny, qy = nx;
  const hx = Math.round(a.x - ex), hy = Math.round(a.y - ey);
  if (hx < -16 || hx > WV_W + 16 || hy < -16 || hy > WV_H + 16) return;
  const tm = TEAMS[skin(a.team)];
  ctx.globalAlpha = 0.28;                       // soft halo under the rim
  ctx.fillStyle = tm.mark;
  ctx.fillRect(hx - 3, hy, 7, 1); ctx.fillRect(hx, hy - 3, 1, 7);
  ctx.globalAlpha = 1;
  const body = new Map();
  const put = (i, j, c) => {
    body.set(Math.round(hx - nx * i + qx * j) + ',' + Math.round(hy - ny * i + qy * j), c);
  };
  put(4, 0, tm.coatD); put(3, 0, tm.mark); put(2, 0, tm.mark);
  put(1, -1, tm.mark); put(1, 1, tm.mark);
  put(1, 0, '#ffffff'); put(0, 0, '#ffffff');   // hot core at the nose
  paintRimmed(body);
}
// aim line and muzzle flash, over the world so they read against the mount
function drawTurretFx(ex, ey, now) {
  for (const o of structures) {
    if (o.type !== 'turret' || o.building) continue;
    const tm = TEAMS[skin(o.team === undefined ? 0 : o.team)];
    const m = turretMuzzle(o);
    const mx = Math.round(m.x - ex), my = Math.round(m.y - ey);
    if (mx < -90 || my < -90 || mx > WV_W + 90 || my > WV_H + 90) continue;
    if (o.tgt && o.chg > 0.02) {
      // a dashed line crawling out to the mark, brightening and tightening as it locks
      const tx = o.tgt.x - ex, ty = turretAimY(o.tgt) - ey;
      const dx = tx - mx, dy = ty - my, d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      const hot = o.chg > 0.99;
      ctx.globalAlpha = 0.25 + 0.6 * o.chg;
      for (let q = (now * 30) % 6; q < d - 2; q += 6) {
        for (let k = 0; k < 3 && q + k < d - 2; k++) {
          const x = Math.round(mx + nx * (q + k)), y = Math.round(my + ny * (q + k));
          ctx.fillStyle = TUR_RIM; ctx.fillRect(x, y + 1, 1, 1);   // shadow, so it reads on snow
          ctx.fillStyle = hot ? '#ffffff' : tm.mark; ctx.fillRect(x, y, 1, 1);
        }
      }
      const r = Math.round(8 - 4 * o.chg), rx = Math.round(tx), ry = Math.round(ty);
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? (hot ? '#ffffff' : tm.mark) : TUR_RIM;
        const oy2 = pass ? 0 : 1;
        for (const c2 of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          ctx.fillRect(rx + c2[0] * r, ry + c2[1] * r + oy2, c2[0] * 2, 1);
          ctx.fillRect(rx + c2[0] * r, ry + c2[1] * r + oy2, 1, c2[1] * 2);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (o.mz > 0) {
      // the shot: a four-point star at the barrel tip for a couple of frames
      const a2 = o.mz / TUR_MZ, L = Math.round(3 + 5 * a2), h = Math.max(1, L >> 1);
      ctx.globalAlpha = Math.min(1, a2);
      ctx.fillStyle = tm.mark;
      ctx.fillRect(mx - L, my, L * 2 + 1, 1);
      ctx.fillRect(mx, my - L, 1, L * 2 + 1);
      for (let k = 1; k <= h; k++) {
        ctx.fillRect(mx - k, my - k, 1, 1); ctx.fillRect(mx + k, my - k, 1, 1);
        ctx.fillRect(mx - k, my + k, 1, 1); ctx.fillRect(mx + k, my + k, 1, 1);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx - 1, my - 1, 3, 3);
      ctx.globalAlpha = 1;
    }
  }
}

function drawBayOverlay(o, px, sy, now) {
  const t = STRUCTS.spawner.tiers[o.tier];
  const due = o.bots.length < t.bots;
  if (due && o.respawnT <= 0.8) {
    const set = SPRITES.robotTeam[skin(o.team === undefined ? 0 : o.team)] || SPRITES.robot;
    const spr = set[Math.floor(now * 8) % 2];
    const k = 1 - o.respawnT / 0.8;
    ctx.save();
    ctx.beginPath(); ctx.rect(px + 14, sy + 13, 20, 24); ctx.clip();
    ctx.drawImage(spr, px + 18, sy + 26 - Math.round(12 * (1 - k)));
    ctx.restore();
  }
  const shut = Math.round(23 * (1 - o.door));
  for (let i = 0; i < shut; i++) {
    ctx.fillStyle = i === shut - 1 ? '#1c2130' : (i % 3 === 2 ? '#5b6473' : '#98a1b0');
    ctx.fillRect(px + 14, sy + 13 + i, 20, 1);
  }
  // readouts on the right flank
  ctx.fillStyle = '#1c2130'; ctx.fillRect(px + 35, sy + 23, 10, 9);
  for (let i = 0; i < t.bots; i++) {
    let c = '#3b4150';
    if (i < o.bots.length) c = '#9ce87a';
    else if (i === o.bots.length && due) c = Math.floor(now * 3) % 2 ? '#ffd95c' : '#6b5a1c';
    ctx.fillStyle = c; ctx.fillRect(px + 36 + i * 3, sy + 24, 2, 2);
  }
  ctx.fillStyle = '#3b4150'; ctx.fillRect(px + 36, sy + 28, 8, 2);
  if (due) {
    ctx.fillStyle = '#ffd95c';
    ctx.fillRect(px + 36, sy + 28, Math.max(1, Math.round(8 * (1 - o.respawnT / (o.respawnTotal || 1)))), 2);
  }
  // vent slat flicker
  const slat = sy + 17 + (Math.floor(now * 5) % 3) * 2;
  ctx.fillStyle = '#6c7486';
  ctx.fillRect(px + 5, slat, 6, 1); ctx.fillRect(px + 37, slat, 6, 1);
  // beacon on the roof corner
  ctx.fillStyle = '#1c2130'; ctx.fillRect(px + 44, sy - 4, 2, 5); ctx.fillRect(px + 42, sy - 7, 6, 4);
  ctx.fillStyle = due ? (Math.floor(now * 4) % 2 ? '#ff9a3c' : '#7a3a1c') : '#6c7486';
  ctx.fillRect(px + 43, sy - 6, 4, 2);
  if (o.hp < o.maxHp) drawHealthBar(px + 24, sy - 11, o.hp, o.maxHp, 24, o.team);
}

// The fish net, drawn flat on its hole in the pass right after the ground
// instead of y-sorted with the buildings that stand up out of it - a player
// walks OVER this one, so it must never sort in front of them. An unfinished
// net is rope still being paid out into the water (no scaffold: there is
// nothing out there to stand a frame on), and the catch shows through the
// mesh, which is the only thing that says a net is worth walking to.
function drawNet(o, px, py, now) {
  const spr = structSprite(o);
  const sh = o.shake > 0 ? Math.round(Math.sin(o.shake * 55) * 1.4) : 0;
  if (o.building) {
    ctx.globalAlpha = 0.3 + 0.55 * Math.min(1, o.buildT / o.buildTotal);
    ctx.drawImage(spr, px + sh, py);
    ctx.globalAlpha = 1;
    return;
  }
  drawSpriteFlash(spr, px + sh, py, o.flash);
  // the catch: up to NET_CAP fish lying in the mesh, each on its own bob
  for (let i = 0; i < o.fish; i++) {
    const fx = px + sh + NET_FISH_AT[i][0], fy = py + NET_FISH_AT[i][1] + (Math.floor(now * 3 + i) % 2);
    ctx.fillStyle = '#7fa9c6';
    ctx.fillRect(fx, fy, 5, 2);
    ctx.fillRect(fx + 5, fy - 1, 1, 1); ctx.fillRect(fx + 5, fy + 2, 1, 1); // tail fork
    ctx.fillStyle = '#c9dded'; ctx.fillRect(fx + 1, fy + 1, 2, 1);
    ctx.fillStyle = '#101d2c'; ctx.fillRect(fx + 1, fy, 1, 1);
  }
  if (o.hp < o.maxHp) drawHealthBar(px + sh + 8, py - 5, o.hp, o.maxHp, 12, o.team); // + sh: rides the shudder, like every other building bar
}
const NET_FISH_AT = [[3, 4], [8, 8], [4, 11]]; // where a held fish lies in the mesh

// a building wears its owner's team palette over its tier material
function structSprite(o) {
  const set = SPRITES.teamBuild[skin(o.team === undefined ? 0 : o.team)];
  const S = STRUCTS[o.type];
  // a type wearing another's grid (the barracks, `art`), or one tile of
  // another's on every footprint tile (the long wall, `tiled`)
  const art = (S && (S.tiled || S.art)) || o.type;
  return set ? set[art][o.tier] : SPRITES[art][o.tier];
}
// A `tiled` building (the long wall): each footprint tile wears the named
// type's own tile of art, so a piece turned by R is two wall tiles either
// way and no art has to turn. The scaffold stages and the sprite go on per
// tile, the cracks per tile, and one bar over the middle.
function drawTiledStruct(o, px, py, sh, now) {
  const spr = structSprite(o);
  const w = structW(o), h = structH(o);
  const p = o.building ? o.buildT / o.buildTotal : 1;
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const x = px + dx * TILE, y = py + dy * TILE;
    if (o.building && p < 1 / 3) ctx.drawImage(SPRITES.scaffold[0], x, y);
    else if (o.building && p < 2 / 3) ctx.drawImage(SPRITES.scaffold[1], x, y);
    else {
      drawSpriteFlash(spr, x + sh, y + TILE - spr.height, o.flash);
      if (o.building) ctx.drawImage(SPRITES.scaffold[2], x, y);
      else if (o.hp < o.maxHp * 0.6) {
        ctx.fillStyle = 'rgba(40,25,15,0.5)';
        ctx.fillRect(x + 4, y + 5, 1, 3); ctx.fillRect(x + 10, y + 3, 1, 4);
      }
    }
  }
  if (!o.building && o.hp < o.maxHp) drawHealthBar(px + sh + (w * TILE >> 1), py + TILE - spr.height - 5, o.hp, o.maxHp, 16, o.team);
}
