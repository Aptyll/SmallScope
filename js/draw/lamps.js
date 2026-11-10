'use strict';
// The lights the valley's buildings keep after dark (called from
// renderLighting, js/draw/light.js, over the night's grade).
// ------------------------------------------------------------ night lamps
// Night is one multiply over the frame, so without a light of their own a
// tower, a bay and the merchant's stall sink into the same blue as the
// forest and the dark has nowhere to look. Each kind's row in LAMPS names
// what burns: `lit`, rects of its sprite that glow (an arrow slit, the
// strip over a bay's door, the stall's lantern), and `pool`, the warm light
// lying on the snow at its foot. Both ride the darkness, so they come up
// with the dusk and are gone by day; the flame steps LAMP_FLICKER_HZ times
// a second on each building's own phase. All of it is the frame's clock and
// the building's place, never world state. A body standing in front of a
// lit slit has it drawn over its edge: the price of a light no grade
// touches, the snowdrops' own (js/draw/light.js).
const LAMP_GLOW = '#ffc56a', LAMP_CORE = '#fff1c4';
const LAMP_FLICKER_HZ = 7;    // steps of the flame a second
const LAMP_DIP = 0.22;        // how far a step can dip the light
const LAMP_FROM = 0.08;       // the darkness the lamps come up from
// px from the sprite's top-left: lit [x, y, w, h]..., pool [x, y, half-width]
const LAMPS = {
  tower:    { lit: [[20, 37, 2, 5], [20, 56, 2, 4]], pool: [21, 90, 26] },
  barracks: { lit: [[13, 11, 22, 1]], pool: [24, 40, 28] },
  stall:    { lit: [[9, 13, 3, 3]], pool: [24, 41, 28] },
};
// the pool: three stepped rings of warm light, twice as wide as tall since
// it lies on the snow - pixel edges, not a gradient
const lampPools = new Map();
function lampPool(R) {
  let c = lampPools.get(R);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 2 * R; c.height = R;
  const g = c.getContext('2d');
  for (const [k, a] of [[1, 0.15], [0.7, 0.17], [0.42, 0.22]]) {
    g.fillStyle = `rgba(255,186,84,${a})`;
    for (let y = 0; y < R; y++) for (let x = 0; x < 2 * R; x++) {
      const u = (x + 0.5 - R) / (R * k), v = (y + 0.5 - R / 2) / (R / 2 * k);
      if (u * u + v * v <= 1) g.fillRect(x, y, 1, 1);
    }
  }
  lampPools.set(R, c);
  return c;
}
// this frame's lamps in view: [row, sprite's screen x, y, phase]...
const lampSpots = [];
function lampAt(L, wx, wy, ox, oy, ph) {
  const x = Math.round(wx - ox), y = Math.round(wy - oy), R = L.pool[2];
  if (x + L.pool[0] + R < 0 || x + L.pool[0] - R > WV_W || y + L.pool[1] + R < 0 || y > WV_H) return;
  lampSpots.push(L, x, y, ph);
}
function litLamps(ox, oy, now, dark) {
  if (dark < LAMP_FROM) return;
  lampSpots.length = 0;
  for (const o of structures) {
    const L = LAMPS[o.type];
    if (!L || o.dead || o.building) continue; // (a building draws live in the fog of war, so its lamp does too)
    const spr = structSprite(o), off = structArtOff(o, spr);
    lampAt(L, o.tx * TILE + off.x, o.ty * TILE + off.y, ox, oy, o.tx * 7 + o.ty * 3);
  }
  for (const b of robots) if (b.merchant && stallUp(b.stall)) {
    const o = b.stall, spr = SPRITES.teamBuild[skin(o.team)].stall;
    lampAt(LAMPS.stall, o.tx * TILE, (o.ty + 1) * TILE - spr.height, ox, oy, o.tx * 7 + o.ty * 3);
  }
  if (!lampSpots.length) return;
  const up = Math.min(1, (dark - LAMP_FROM) / (1 - LAMP_FROM) * 1.6), step = Math.floor(now * LAMP_FLICKER_HZ);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < lampSpots.length; i += 4) {
    const L = lampSpots[i], P = L.pool, R = P[2];
    ctx.globalAlpha = up * (1 - LAMP_DIP * hash2(step, lampSpots[i + 3]));
    ctx.drawImage(lampPool(R), lampSpots[i + 1] + P[0] - R, lampSpots[i + 2] + P[1] - (R >> 1));
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < lampSpots.length; i += 4) {
    const L = lampSpots[i], x = lampSpots[i + 1], y = lampSpots[i + 2];
    ctx.globalAlpha = up * (1 - LAMP_DIP * 0.5 * hash2(step, lampSpots[i + 3]));
    for (const [lx, ly, w, h] of L.lit) {
      ctx.fillStyle = LAMP_GLOW; ctx.fillRect(x + lx, y + ly, w, h);
      // the flame's heart: the rect's middle, or its near half where it is too thin for one
      ctx.fillStyle = LAMP_CORE;
      if (w > 2 && h > 2) ctx.fillRect(x + lx + 1, y + ly + 1, w - 2, h - 2);
      else if (w > h) ctx.fillRect(x + lx + (w >> 2), y + ly, w >> 1, h);
      else ctx.fillRect(x + lx, y + ly + (h >> 2), 1, h - (h >> 1));
    }
  }
  ctx.globalAlpha = 1;
}
