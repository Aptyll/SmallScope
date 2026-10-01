'use strict';
// A building's pixels: the turret's sling and its rocks, the bay and barracks
// overlays, the net, and structSprite/drawTiledStruct - how a tiered or
// multi-tile STRUCTS entry finds its sprite and lays it down.
// ---- the turret's sling, its rocks, the bay, the net and the tiled struct ----
// The BASE is baked per tier (js/sprites/buildings.js); the SLING above it is
// not baked at all - it is rasterised pixel by pixel at the live bearing and
// dilated into a 1px dark rim, the same trick the arrows use - so the fork
// stays crisp and readable at any bearing over snow, and a baked grid cannot
// lock it to one angle.
//
// IT IS A PART TABLE, not a wall of loops. Each row of SLING is one piece: `k`
// its shape, `c` its ink, `mir` mirrors it across the throw's line (a fork has
// two arms, and one row draws both), `when` names a state flag the piece needs.
// Coordinates are sling-local px - `f` ALONG the throw, 0 at the pivot and +
// toward the mark, `s` ACROSS it, - to the left, which is the lit side - and a
// coordinate given as a STRING is read out of the frame's state instead, so the
// whole ANIMATION is the four numbers slingState() works out and the table
// itself never moves. Retuning the fork is editing a row; adding a piece is
// adding one.
const SL_MOUTH = 6;     // px along the throw the loaded pouch rests at, low in the fork
const SL_DRAW = 9;      // ...and px it is drawn back over a full draw
const SL_FLY = 5;       // ...and px past the rest it is flung on the release
const SL_FLARE = [7, 7, 9];   // px the fork's arms spread either side, one per tier
// One row per piece of the sling, read top to bottom (later writes win, so the
// table paints back to front). `k` is the shape, `c` the ink, `mir` mirrors the
// row across the throw's line (a fork has two arms, and one row draws both),
// `when` names a state flag the piece needs and `from` the first TIER it
// appears at - which is the whole of how the three forks differ: tier 1 is a
// bare stick, tier 2 binds and paints it, tier 3 ties and crowns it.
// Coordinates are sling-local px: `f` ALONG the throw (0 at the pivot, + toward
// the mark), `s` ACROSS it (- to the left, which is the lit side). A
// coordinate given as a STRING is read out of the frame's state instead (a
// leading '-' negates it), so the whole ANIMATION and the per-tier GEOMETRY are
// the numbers slingState() works out and the table itself never moves.
const SLING = [
  // the TURNTABLE: the timber deck the whole fork stands on and turns with
  { k: 'ell', f: -1, s: 0, af: 5, as: 4, c: 'lit' },
  { k: 'box', f0: 1, f1: 2, s0: -4, s1: 4, c: 'lit' },           // the deck's front lip, lit
  { k: 'box', f0: -6, f1: -5, s0: -3, s1: 3, c: 'team' },        // a stripe of the side's coat at the back
  { k: 'dot', f: -5, s: 0, c: 'mark' },                          // ...with its own ink in it
  { k: 'dot', f: 0, s: -3, c: 'ironL', mir: true },              // two bolts through the deck
  // TIER 2 up: an iron rim round the deck's shoulder
  { k: 'seg', f0: -5, s0: 4, f1: 2, s1: 3, c: 'iron', mir: true, from: 1 },
  // TIER 3: the rim carries on round the back, and the deck is studded
  { k: 'seg', f0: -5, s0: 4, f1: -6, s1: 1, c: 'iron', mir: true, from: 2 },
  { k: 'dot', f: -2, s: 3, c: 'trim', mir: true, from: 2 },
  // the STANCHION: the block the arms rise out of
  { k: 'box', f0: 2, f1: 5, s0: -2, s1: 2, c: 'lit' },
  { k: 'box', f0: 3, f1: 5, s0: -2, s1: -2, c: 'trim' },         // its lit edge
  { k: 'box', f0: 2, f1: 2, s0: -2, s1: 2, c: 'team', from: 1 }, // a painted collar at its foot
  // the ARMS: two timbers flaring out to the fork's mouth, whose reach is the
  // tier's own (TUR_MOUTH, js/structures.js - the rock leaves from exactly there)
  { k: 'seg', f0: 3, s0: 2, f1: 'af', s1: 'as', c: 'lit', w: 1, mir: true },
  { k: 'dot', f: 'mf', s: 'ms', c: 'team', mir: true, from: 1 }, // a wrap halfway up each arm
  { k: 'dot', f: 'mf1', s: 'ms', c: 'mark', mir: true, from: 2 },
  { k: 'dot', f: 'mf1', s: 'ms1', c: 'cord', mir: true, from: 2 },  // the lashing's loose end
  { k: 'box', f0: 'af1', f1: 'af', s0: 'as1', s1: 'as', c: 'ironL', mir: true }, // the binding at each tip
  { k: 'dot', f: 'af', s: 'as', c: 'iron', mir: true },          // ...and its shadowed corner
  { k: 'dot', f: 'af1', s: 'fs', c: 'trim', mir: true, from: 2 }, // TIER 3: a carved finial past it
  { k: 'dot', f: 'af2', s: 'fs', c: 'iron', mir: true, from: 2 },
  // THE SLING: two cords off the tips down to the pouch, and the stone in it
  { k: 'seg', f0: 'af1', s0: 'as1', f1: 'pf', s1: 0, c: 'cord', mir: true },
  { k: 'box', f0: 'pf', f1: 'pf', s0: -1, s1: 1, c: 'hide' },
  { k: 'box', f0: 'pf1', f1: 'pf2', s0: -1, s1: 0, c: 'stone', when: 'loaded' },
  { k: 'dot', f: 'pf1', s: -1, c: 'stoneL', when: 'loaded' },
  { k: 'dot', f: 'pf2', s: 0, c: 'stoneD', when: 'loaded' },
];
// One row a tier, and the base under it climbs the same three timbers
// (TUR_PALS, js/sprites/buildings.js): pine, oak, tarred oak.
const SLING_WOOD = [
  { wood: '#8a6142', woodL: '#a3794f', woodD: '#6b4a30', cord: '#cfc6a8', hide: '#7a5a3e' },
  { wood: '#7a5636', woodL: '#966e46', woodD: '#5a3f28', cord: '#ddd4b6', hide: '#6b4a30' },
  { wood: '#5f4028', woodL: '#7d5638', woodD: '#412a1a', cord: '#eee2bc', hide: '#4e3421' },
];
const ROCK_INK = { l: '#c9d0e2', m: '#98a0b4', d: '#6b7286' };
const TUR_ARC = 22;    // dashes the aim arc is walked in
const TUR_LET = 0.55;  // of o.rec the cords are still drawn snapping across the mouth
const TUR_RIM = '#0d1226';
// shared by the sling and its rocks: plus-dilate the pixel map into a dark rim,
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
// What this frame's sling looks like. The pouch is the whole of the animation:
// it slides BACK along the throw as the sling loads (o.chg), is flung out past
// the fork's mouth on the release (o.rec, one timer for both the snap and the
// flash), and is home a breath later with the next stone in it.
function slingState(o) {
  const chg = o.chg || 0, rec = o.rec || 0;
  const tier = Math.min(SLING_WOOD.length - 1, o.tier || 0);
  const pf = Math.round(rec > 0 ? SL_MOUTH + SL_FLY * rec : SL_MOUTH - SL_DRAW * chg);
  // the fork: as long as the tier throws from (TUR_MOUTH) and as wide as the
  // tier is built, with the mid-arm wrap and the finial placed off those two
  const af = TUR_MOUTH[tier], as = SL_FLARE[tier];
  const mf = Math.round(3 + (af - 3) * 0.55), ms = Math.round(2 + (as - 2) * 0.55);
  return {
    tier: tier,
    wood: SLING_WOOD[tier],
    tm: TEAMS[skin(o.team === undefined ? 0 : o.team)],
    af: af, af1: af - 1, af2: af - 2, as: as, as1: as - 1, fs: as + 1,
    mf: mf, mf1: mf + 1, ms: ms, ms1: ms + 1,
    pf: pf, pf1: pf + 1, pf2: pf + 2,
    loaded: rec <= 0,      // the stone is in the pouch until it is thrown
    ready: chg > 0.97,     // ...and the cords go the side's own colour, taut
  };
}
// a part's ink, by role and by which side of the throw the pixel is on: the
// timber and the team band are both lit from the left, like the rest of the art
function slingInk(st, role, sd) {
  const W = st.wood, tm = st.tm;
  switch (role) {
    case 'lit': return sd <= -2 ? W.woodL : sd >= 2 ? W.woodD : W.wood;
    case 'team': return sd <= -2 ? tm.coatL : sd >= 2 ? tm.coatD : tm.coat;
    case 'trim': return tm.trim;
    case 'mark': return tm.mark;
    case 'iron': return tm.fit;
    case 'ironL': return tm.fitL;
    case 'cord': return st.ready ? tm.glow : W.cord;
    case 'hide': return W.hide;
    case 'stone': return ROCK_INK.m;
    case 'stoneL': return ROCK_INK.l;
    case 'stoneD': return ROCK_INK.d;
  }
  return null;
}
// one row of SLING laid down, `m` +1 for the piece and -1 for its mirror
function slingPart(p, st, put, m) {
  const n = (v) => (typeof v !== 'string' ? v : v.charAt(0) === '-' ? -st[v.slice(1)] : st[v]);
  const ink = (sd) => slingInk(st, p.c, sd);
  if (p.k === 'dot') { const sd = n(p.s) * m; put(n(p.f), sd, ink(sd)); return; }
  if (p.k === 'box') {
    for (let f = n(p.f0); f <= n(p.f1); f++) for (let j = n(p.s0); j <= n(p.s1); j++) {
      const sd = j * m;
      put(f, sd, ink(sd));
    }
    return;
  }
  if (p.k === 'ell') {
    const cf = n(p.f), cs = n(p.s);
    for (let f = -p.af; f <= p.af; f++) for (let j = -p.as; j <= p.as; j++) {
      if ((f * f) / (p.af * p.af) + (j * j) / (p.as * p.as) > 1) continue;
      const sd = cs + j * m;
      put(cf + f, sd, ink(sd));
    }
    return;
  }
  if (p.k === 'seg') {
    // a straight run between two sling-local points, `w` px of extra thickness
    // laid toward the centre line so an arm reads as a timber and not a hair
    const f0 = n(p.f0), s0 = n(p.s0) * m, f1 = n(p.f1), s1 = n(p.s1) * m;
    const steps = Math.max(1, Math.round(Math.max(Math.abs(f1 - f0), Math.abs(s1 - s0))));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, f = Math.round(f0 + (f1 - f0) * u), sd = Math.round(s0 + (s1 - s0) * u);
      put(f, sd, ink(sd));
      for (let k = 1; k <= (p.w || 0); k++) put(f, sd - Math.sign(sd) * k, ink(sd));
    }
  }
}
function drawTurretHead(o, cx, cy) {
  const ang = o.ang || 0, ca = Math.cos(ang), sa = Math.sin(ang);
  const st = slingState(o);
  const body = new Map();
  // every point rotates about the pivot; later writes win, so the table paints
  // back to front all on its own
  const put = (f, sd, c) => {
    if (c) body.set(Math.round(cx + f * ca - sd * sa) + ',' + Math.round(cy + f * sa + sd * ca), c);
  };
  for (const p of SLING) {
    if (p.from !== undefined && st.tier < p.from) continue;
    if (p.when && !st[p.when]) continue;
    slingPart(p, st, put, 1);
    if (p.mir) slingPart(p, st, put, -1);
  }
  paintRimmed(body);
}
// A TURRET'S ROCK: a lump of stone tumbling end over end, on the throwing
// log's own stamp-and-rim pass (stampTurned, js/draw/render.js) - it is the
// one shot in the game whose body is NOT pointed along its flight, because a
// rock in the air does not care which way it is going. Whose rock it is reads
// off the trail of motes behind it, as it does for every other shot.
const ROCK_MAP = [
  '.mWm.',
  'mWWWm',
  'dWWWm',
  '.ddm.',
];
function drawSlungRock(a, ex, ey) {
  const hx = Math.round(a.x - ex), hy = Math.round(a.y - ey);
  if (hx < -12 || hx > WV_W + 12 || hy < -12 || hy > WV_H + 12) return;
  const body = new Map();
  stampTurned(body, ROCK_MAP, { W: ROCK_INK.l, m: ROCK_INK.m, d: ROCK_INK.d }, hx, hy,
    (a.spin || 0) + a.t * 7);
  paintRimmed(body);
}
// The aim arc and the release, over the world so they read against the base.
function drawTurretFx(ex, ey, now) {
  for (const o of structures) {
    if (o.type !== 'turret' || o.building) continue;
    const tm = TEAMS[skin(o.team === undefined ? 0 : o.team)];
    const pv = turretPivot(o), m = turretMouth(o);
    const mx = Math.round(m.x - ex), my = Math.round(m.y - ey);
    if (mx < -180 || my < -180 || mx > WV_W + 180 || my > WV_H + 180) continue;
    const goal = turretGoal(o);
    if (goal && o.chg > 0.02) {
      // THE ARC THE ROCK WILL FLY, dashed and crawling outward, brightening as
      // the sling loads: a straight line to the mark would be a lie about a
      // lob. And the reticle sits on where this throw is GOING, not on the
      // mark - a throw that has already rolled a miss (turretRoll) aims beside
      // its target, and this is the game saying so before the stone goes.
      const la = turretLaunch(pv, goal.x, goal.y);
      const hot = o.chg > 0.99;
      const crawl = Math.floor(now * 14);
      ctx.globalAlpha = 0.25 + 0.6 * o.chg;
      for (let i = 3; i < TUR_ARC; i++) {
        if ((i + crawl) % 3 === 0) continue;
        const t2 = la.T * i / TUR_ARC;
        const x = Math.round(pv.x + la.vx * t2 - ex);
        const y = Math.round(pv.y + la.vy * t2 + ROCK_FALL * t2 * t2 / 2 - ey);
        ctx.fillStyle = TUR_RIM; ctx.fillRect(x, y + 1, 1, 1);   // shadow, so it reads on snow
        ctx.fillStyle = hot ? '#ffffff' : tm.mark; ctx.fillRect(x, y, 1, 1);
      }
      const r = Math.round(8 - 4 * o.chg);
      const rx = Math.round(goal.x - ex), ry = Math.round(goal.y - ey);
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
    if (o.rec > TUR_LET) {
      // THE RELEASE: the cords snap taut across the fork's mouth for a couple
      // of frames. No flash - a sling has nothing to flash with, and the snap
      // between the two tips is the whole picture.
      const k = (o.rec - TUR_LET) / (1 - TUR_LET);
      const qx = -m.ny, qy = m.nx;
      const sp = SL_FLARE[Math.min(SL_FLARE.length - 1, o.tier || 0)] - 2;
      ctx.globalAlpha = Math.min(1, k);
      ctx.fillStyle = '#ffffff';
      for (let j = -sp; j <= sp; j++) {
        ctx.fillRect(Math.round(m.x + qx * j - ex), Math.round(m.y + qy * j - ey), 1, 1);
      }
      ctx.fillStyle = tm.glow;
      for (const s2 of [-sp - 1, sp + 1]) {
        ctx.fillRect(Math.round(m.x + qx * s2 - ex), Math.round(m.y + qy * s2 - ey), 1, 1);
      }
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
  if (o.hp < o.maxHp) drawHealthBar(px + sh + 8, py - 5, o.hp, o.maxHp, 11, o.team); // + sh: rides the shudder, like every other building bar
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
// where a building's sprite is laid, in px from its footprint's top-left: the
// skirt on the footprint's bottom edge, centred over its width (a sprite
// wider than its footprint - the 32x32 turret on one tile - overhangs both
// sides). The draw and the shot's sweep (structShotBox, sim.js) both read it.
function structArtOff(o, spr) {
  return { x: (structW(o) * TILE - spr.width) >> 1, y: structH(o) * TILE - spr.height };
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
  if (!o.building && o.hp < o.maxHp) drawHealthBar(px + sh + (w * TILE >> 1), py + TILE - spr.height - 5, o.hp, o.maxHp, 17, o.team);
}
