'use strict';
// The frame: render() composes ground, entities and lighting into the world
// buffer and blits it under the UI, plus the '.' debug overlays and the
// cursor, reticle and bow aim line.
// ------------------------------------------------------------ render
function drawSpriteFlash(spr, x, y, flash) {
  ctx.drawImage(spr, x, y);
  if (flash > 0) {
    sctx.clearRect(0, 0, spr.width, spr.height);
    sctx.globalCompositeOperation = 'source-over';
    sctx.drawImage(spr, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = 'rgba(255,255,255,0.8)';
    sctx.fillRect(0, 0, spr.width, spr.height);
    ctx.drawImage(scratch, 0, 0, spr.width, spr.height, x, y, spr.width, spr.height);
  }
}

// The same thing for one frame of a sprite ATLAS. A drawImage whose source
// canvas differs from the last one cannot be batched, so anything the world
// holds a thousand of draws from a single texture and picks its frame with a
// source rect instead of by swapping canvases - measured on a GTX 1060, the
// pines cost 97 fps as sixteen canvases and 199 as one.
function drawFrameFlash(atlas, fi, x, y, flash) {
  const w = atlas.fw, h = atlas.fh, cols = atlas.cols || Infinity;
  const sx = (fi % cols) * w, sy = Math.floor(fi / cols) * h;
  ctx.drawImage(atlas, sx, sy, w, h, x, y, w, h);
  if (flash > 0) {
    sctx.clearRect(0, 0, w, h);
    sctx.globalCompositeOperation = 'source-over';
    sctx.drawImage(atlas, sx, sy, w, h, 0, 0, w, h);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = 'rgba(255,255,255,0.8)';
    sctx.fillRect(0, 0, w, h);
    ctx.drawImage(scratch, 0, 0, w, h, x, y, w, h);
  }
}

// THE ANIMATED GOODS. Two item icons are loops rather than stamps - the
// gold piece and the berry cluster (`SPRITES.itemAnim`,
// js/sprites.js) - and this stamps each one's current frame into the LIVE
// canvas the game holds for it, once a frame, before anything draws.
//
// Doing it here rather than at the call sites is what keeps an item icon one
// generic read: `SPRITES[ITEMS[type].icon]` is how the pouch, a shop price, a
// sale row, a drop on the snow, a tooltip and the wiki all reach one, and
// none of them has to know which goods move. They share ONE clock, so
// every berry on the screen is on the same beat - a dozen icons each looping
// to their own is a fruit machine, not a HUD. A frame that has not changed
// is not redrawn, so a still HUD costs nothing.
const ITEM_FR = 100; // ms a frame
function stepItemIcons(nowMs) {
  const t = Math.floor(nowMs / ITEM_FR);
  for (const key in SPRITES.itemAnim) {
    const frames = SPRITES.itemAnim[key], live = SPRITES[key];
    const i = t % frames.length;
    if (live.frame === i) continue;
    live.frame = i;
    const g = live.getContext('2d');
    g.clearRect(0, 0, live.width, live.height);
    g.drawImage(frames[i], 0, 0);
  }
}

// The work-target rim: the hero's hovered workable object (tree, dead tree,
// berried bush) draws under a 1px pulsing gold outline - the
// buy plates' two golds on the same beat, so "you can act on this" reads in
// its standing ink. The sprite (or atlas frame) tints through the scratch
// canvas and stamps the eight neighbours, the same rim grammar as
// drawPixelTextOutline. Call it right before drawing the
// object itself so the rim sits under the body.

function drawTargetRim(src, sx, sy, w, h, x, y, now) {
  sctx.clearRect(0, 0, w, h);
  sctx.globalCompositeOperation = 'source-over';
  sctx.drawImage(src, sx, sy, w, h, 0, 0, w, h);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = Math.sin(now * 6) > 0 ? '#f2cc6a' : '#c9a227';
  sctx.fillRect(0, 0, w, h);
  for (let ry = -1; ry <= 1; ry++) for (let rx = -1; rx <= 1; rx++) {
    if (rx || ry) ctx.drawImage(scratch, 0, 0, w, h, x + rx, y + ry, w, h);
  }
}

function render() {
  const now = performance.now() / 1000;
  stepItemIcons(now * 1000); // the animated item icons, before anything reads one
  // the shake's jitter comes off fxRng, never the sim's rng: a frame is not a
  // step, and a draw off the main stream here made how many frames a screen
  // happened to render change the match (a saved one replayed differently)
  const shk = (s) => Math.round(-s + fxRng() * 2 * s);
  const shx = settings.shake && state.shake > 0.2 ? shk(state.shake) : 0;
  const shy = settings.shake && state.shake > 0.2 ? shk(state.shake) : 0;
  // THE SUB-PIXEL CAMERA. The world buffer's corner is the camera FLOORED to
  // a whole world px, and what is left over (camX - floor, 0..1 world px) is
  // spent at the blit below, in device px: a world px is k device px (6 at a
  // 1080p 2x), so a camera that could only move in whole world px stepped the
  // whole screen 6 px at a time - a ride at 2.6 px a step scrolled 12, 18,
  // 12, 18 device px on alternate frames, and that uneven scroll across the
  // full screen was the eye strain. Now the ground slides by the device px
  // and every world pixel keeps its exact k x k block.
  //   Tiles and moving entities share the one whole-px corner: `ex`/`ey` ARE
  // `ox`/`oy`, so a body is round(world) - corner, on the ground's own grid,
  // and never vibrates against it. The cost: a followed body sits on the
  // world grid while the screen slides under it, so it wanders within half
  // a world px of the centre - one sprite, instead of the whole frame.
  const ox = Math.floor(camX) + shx;
  const oy = Math.floor(camY) + shy;
  const ex = ox, ey = oy;
  wOX = ox; wOY = oy;

  // Into the world buffer: from here to renderLighting() every pass draws at
  // 1:1 world pixels into a WV_W x WV_H frame, and the screen never sees any
  // of it until the blit below. Everything in this stretch bounds itself
  // against WV_W/WV_H, never VIEW_W/VIEW_H - at zoom < 1 the world view is
  // WIDER than the canvas, and culling to the canvas would eat the edges.
  ctx = wctx;

  drawGroundPass(ox, oy, ex, ey, now);

  drawFootprints(ox, oy);

  // visible tile range
  const tx0 = Math.max(0, Math.floor(ox / TILE) - 1);
  const ty0 = Math.max(0, Math.floor(oy / TILE) - 1);
  const tx1 = Math.min(WORLD - 1, Math.ceil((ox + WV_W) / TILE) + 1);
  const ty1 = Math.min(WORLD - 1, Math.ceil((oy + WV_H) / TILE) + 2);

  drawFlatPass(ox, oy, ex, ey, tx0, ty0, tx1, ty1, now); // the ice's sky, the flat objects, the rings
  drawDrops(ex, ey, now);

  const draws = gatherDraws(ox, oy, tx0, ty0, tx1, ty1, now);
  drawSorted(draws, ox, oy, ex, ey, now);

  drawSelection(ox, oy, now);
  drawBuildGhost(ox, oy, now);
  drawCheatGhost(ox, oy); // the practice bar's armed teleport / dummy (js/ui/cheats.js)
  drawWorkHint(ox, oy);
  drawFishHint(ex, ey, now);
  // the parkour's two readouts: the lap clock over the runner, BEST / LAST
  // on the frost plate at the gate (drawParkour, js/draw-world.js) - and the
  // archery range's own BEST / LAST plate over the bell (drawAgame), with
  // the hit-ring flash snapping over whatever face just broke (drawAgRings)
  if (PRACTICE) { drawParkour(ex, ey, now); drawAgame(ex, ey, now); drawAgRings(ex, ey); }

  drawBuildBars(ox, oy); // construction progress bars
  drawParticles(ex, ey);

  drawAimLine(ex, ey, now);
  drawZipGuide(ex, ey);     // the dotted walk to the hovered cable (js/draw/zipline.js)

  drawArrows(ex, ey, now);


  // airborne ability bodies: the spinning net, and the grapple's rope
  // between a reeling body and its anchor - with the arrows, over the entities
  drawAbilityAir(ex, ey, now);

  drawTurretFx(ex, ey, now);

  drawTracers(ex, ey);

  // the sword's sweeps (js/sim/abilities.js draws them: every player who just cut)
  drawSlashes(ex, ey);
  drawSwingArcs(ex, ey, now); // every player who is mid-swing

  drawPops(ex, ey); // the floaters and the farm's coins, stamped above the night grade (js/draw/pops.js)

  drawSweep(ex, ey);        // the wind's slow sweep of loose snow, laid in the world, over the pines (windSweep, js/sim/weather.js)
  drawDropAir(ex, ey, now, false); // the flight path, and a bird on the ground (the fliers: the air layer, below)
  drawZips(ex, ey, now);    // the ziplines' cables, lit gold under the pointer, over everything but the night (js/draw/zipline.js)
  renderLighting(ox, oy, now);
  drawCallouts(ex, ey); // the bots' calls, above the night like all world text (js/draw/callouts.js)
  // the two debug views, above the lighting on purpose - see the banner
  if (settings.hitbox > 1 || window.DBG.showPaths) drawNavPaths(ox, oy, ex, ey);
  drawHitboxes(ox, oy, ex, ey);
  drawBotLines(ex, ey); // F4: a line from each bot to what it is after (js/ui/botview.js)

  renderAirLayer(shx, shy, now); // the air layer: a bird in flight, its riders, the zipline riders
  renderScreen(ox, oy, shx, shy, now); // the blit, then the screen: weather, HUD, screens, pointer
}

// ---- the shot's body ------------------------------------------------------
// Every shaft in the air is the one arrow body (ARROW_MAP, js/sim/actions.js),
// rasterised by the arrow's own DDA (arrowBodyPx, js/draw/overhead.js) so it
// is as clean on a diagonal as at a cardinal. T/D are the team's feather and
// its edge and B the shot's own colour, so whose shot it is reads off the
// tail. (x, y) is the exact tip in world-view px.
function drawShaft(a, x, y) {
  const vd = Math.hypot(a.vx, a.vy) || 1;
  ARROW_PX.length = 0;
  arrowBodyPx(ARROW_PX, x, y, a.vx / vd, a.vy / vd, 0, ARROW_LEN,
    TEAMS[skin(a.team)].mark, TEAMS[skin(a.team)].coatD, a.col || ARROW_INK.G, 0);
  paintArrowPx(ARROW_PX);
}
// A small map TURNED to any angle by inverse sampling: every pixel in the box
// it can reach asks which map cell it falls in, so a spinning body has no
// holes at any angle (stamping each cell forward leaves gaps on the
// diagonals). Writes into `body`, the pixel map paintRimmed takes - the
// turret's slung rock is drawn this way (drawSlungRock, js/draw/structs.js).
function stampTurned(body, rows, ink, cx, cy, ang) {
  const h = rows.length, w = rows[0].length;
  const c = Math.cos(ang), s = Math.sin(ang);
  const R = Math.ceil(Math.hypot(w, h) / 2);
  const X = Math.round(cx), Y = Math.round(cy);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const col = Math.round(dx * c + dy * s + (w - 1) / 2);
    const row = Math.round(-dx * s + dy * c + (h - 1) / 2);
    if (row < 0 || row >= h || col < 0 || col >= w || rows[row][col] === '.') continue;
    body.set((X + dx) + ',' + (Y + dy), ink[rows[row][col]]);
  }
}

// ------------------------------------------------------------ debug overlays
// What the sim actually tests, drawn on top of what the art shows. One key:
// '.' toggles `settings.hitbox` between 0 (off) and 2 (bodies + the route
// every walker is following). Every shape here is read from the same
// expression the sim uses, never a repeat of the number: an overlay that
// disagrees with the sim is worse than none, because it is believed. Colour
// carries the kind, so there is nothing to label:
//   cyan   a wall to everyone (isSolidTile)
//   blue   open water: a wall to animals and robots, a hole a player falls in
//   green  the body circle separateUnits/moveEntity push apart
//   red    the circle an arrow is tested against - offset UP from the feet
//   violet a walk-over pickup, or a click target
//   gold   a projectile, which is a point and not a circle
//   pink   the model's own centre column, for lining an overhead frame up on
// Reaches and sight ranges are deliberately NOT here: they are wide enough to
// bury the 7px circle that decides whether an arrow lands, and they come back
// on their own terms later.
// These two are the only world passes that draw ABOVE renderLighting: a debug
// view has to be as readable at midnight as at noon, and the lighting would
// eat it.
const HB_SOLID = '#5ad0ff', HB_WATER = '#3f76ff', HB_BODY = '#4dff7d';
const HB_HURT = '#ff4d5e', HB_PICK = '#c07dff', HB_SHOT = '#ffd95c';
const HB_MID = '#ff2ee6';

// One ring, plotted as 1px world pixels. Not an arc() stroke: that is
// anti-aliased, and the world blit magnifies a soft edge into mush. Rows give
// the left/right extremes and columns the top/bottom ones, so the ring closes
// at every radius and a fractional one (PLAYER_R is 4.5) is not rounded away.
function hbRing(cx, cy, r, col) {
  if (r < 0.5) return;
  cx = Math.round(cx); cy = Math.round(cy);
  if (cx + r < 0 || cy + r < 0 || cx - r > WV_W || cy - r > WV_H) return;
  ctx.fillStyle = col;
  const put = (px, py) => ctx.fillRect(px, py, 1, 1);
  const R = Math.floor(r);
  for (let d = -R; d <= R; d++) {
    const o = Math.round(Math.sqrt(r * r - d * d));
    put(cx - o, cy + d); put(cx + o, cy + d);
    put(cx + d, cy - o); put(cx + d, cy + o);
  }
}
function hbBox(x, y, w, h, col) {
  if (x + w < 0 || y + h < 0 || x > WV_W || y > WV_H) return;
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y + 1, 1, h - 2); ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
}
// one line, same idiom: Bresenham in 1px world pixels, `step` plotting one
// pixel in N (the dotted look a planned-but-not-yet-walked leg uses)
function hbLine(x0, y0, x1, y1, col, step) {
  if ((x0 < 0 && x1 < 0) || (y0 < 0 && y1 < 0) ||
    (x0 > WV_W && x1 > WV_W) || (y0 > WV_H && y1 > WV_H)) return;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  ctx.fillStyle = col;
  for (;;) {
    if ((!step || n % step === 0) && x0 >= 0 && y0 >= 0 && x0 < WV_W && y0 < WV_H) ctx.fillRect(x0, y0, 1, 1);
    n++;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// the anchor point itself: a circle drawn around the wrong origin looks right
// until you see where its centre is
function hbDot(cx, cy, col) {
  const x = Math.round(cx), y = Math.round(cy);
  ctx.fillStyle = col;
  ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
}
// a short heading arrow - the shape for a thing that STEERS rather than
// routes, and so has no goal tile to put a box on. The arrowhead is what
// tells the two apart at a glance: a barbed stub is a heading, a line ending
// in a box is a walk to a decided place.
function hbArrow(cx, cy, ang, len, col) {
  const x0 = Math.round(cx), y0 = Math.round(cy);
  const x1 = Math.round(cx + Math.cos(ang) * len), y1 = Math.round(cy + Math.sin(ang) * len);
  hbLine(x0, y0, x1, y1, col, 0);
  const back = ang + Math.PI;
  for (const s of [0.7, -0.7]) {
    hbLine(x1, y1, Math.round(x1 + Math.cos(back + s) * 4), Math.round(y1 + Math.sin(back + s) * 4), col, 0);
  }
}

// The model's own centre column, and the one overlay here that is about the
// ART rather than the sim: the overhead frame (health bar, stamina bar, level
// badge) is the only thing in the game that has to line up with a sprite
// instead of with a number, and nothing else on screen shows you where a
// sprite's middle actually is.
//
// Every sprite in the game is an even number of pixels wide and centred on
// the seam between its two halves, so the true middle is a pixel BOUNDARY and
// no 1px line can sit on it. This draws at `round(centre)` — the column just
// right of that seam — which makes the test a count: a frame that is genuinely
// centred has as many columns strictly left of the line as it has from the
// line rightwards. It is dotted so the frame it is measuring still reads
// through it.
function hbMid(cx, y0, y1) {
  const x = Math.round(cx);
  if (x < 0 || x > WV_W) return;
  ctx.fillStyle = HB_MID;
  const a = Math.max(0, Math.round(y0)), b = Math.min(WV_H, Math.round(y1));
  for (let y = a; y < b; y += 2) ctx.fillRect(x, y, 1, 1);
}

function drawHitboxes(ox, oy, ex, ey) {
  if (!settings.hitbox) return;

  // tiles - the AABB moveEntity() sweeps, straight off isSolidTile. Statics
  // subtract the rounded camera, movers below subtract the exact one.
  const tx0 = Math.floor(ox / TILE), ty0 = Math.floor(oy / TILE);
  const tx1 = Math.floor((ox + WV_W) / TILE), ty1 = Math.floor((oy + WV_H) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const px = tx * TILE - ox, py = ty * TILE - oy;
    if (isSolidTile(tx, ty, null, true)) hbBox(px, py, TILE, TILE, HB_SOLID);
    else if (waterAt(tx, ty)) hbBox(px, py, TILE, TILE, HB_WATER);
  }
  drawCisternHitbox(ox, oy, ex, ey, HB_SOLID, HB_BODY); // the middle's stone is held to the px, not the tile

  // players: the body circle everything is pushed out of, and the hurt circle
  // an arrow is tested against - which sits 6px UP, at the chest, so a shot
  // that looks like it went over the head is a hit and this is where you see it.
  // A live roll adds the sweep it swipes units with, which is the body circle
  // grown by ROLL_HIT_R and centred on the feet, not the chest.
  for (const p of players) {
    if (!p.active || p.dead || inAir(p)) continue;
    hbRing(p.x - ex, p.y - ey, PLAYER_R, HB_BODY);
    hbRing(p.x - ex, p.y - 6 - ey, ARROW_HIT_R, HB_HURT);
    if (p.dodgeT > 0) hbRing(p.x - ex, p.y - ey, PLAYER_R + ROLL_HIT_R, HB_HURT);
    hbDot(p.x - ex, p.y - ey, HB_BODY);
    hbMid(p.x - ex, p.y - 32 - ey, p.y + 4 - ey); // up past the name tag, down past the feet
  }

  // animals: birds are the one unit nothing collides with, so they get no
  // body circle - only the (smaller) circle an arrow tests
  for (const a of animals) {
    if (a.dead) continue;
    if (a.kind !== 'bird') hbRing(a.x - ex, a.y - ey, unitRadius(a), HB_BODY);
    hbRing(a.x - ex, animalHitY(a) - ey, animalHitR(a), HB_HURT);
    hbDot(a.x - ex, a.y - ey, HB_BODY);
    hbMid(a.x - ex, a.y - (a.alt || 0) - 26 - ey, a.y + 4 - ey);
  }

  for (const b of robots) {
    if (b.dead) continue;
    hbRing(b.x - ex, b.y - ey, unitRadius(b), HB_BODY);
    hbRing(b.x - ex, robotHitY(b) - ey, ROBOT_HIT_R, HB_HURT);
    hbDot(b.x - ex, b.y - ey, HB_BODY);
    hbMid(b.x - ex, b.y - 24 - ey, b.y + 4 - ey);
  }

  // buildings: the centre of the FOOTPRINT, which is what the sprite centres
  // itself over (`sx` in the structure draw) whether it is wider than its
  // tiles or not - so it is the line the damage bar has to sit on too. And
  // the shape a shot meets it by (structShotBox, sim.js): the drawn art's box
  // and, on a turret, the head's disc - past the cyan footprint wherever the
  // art stands past it
  for (const o of structures) {
    const w = structW(o) * TILE, h = structH(o) * TILE;
    hbMid(o.tx * TILE + w / 2 - ox, o.ty * TILE - 24 - oy, o.ty * TILE + h - oy);
    const b = structShotBox(o);
    if (!b) continue;
    hbBox(b.x0 - ox, b.y0 - oy, b.x1 - b.x0, b.y1 - b.y0, HB_HURT);
    if (b.hr) hbRing(b.hx - ox, b.hy - oy, b.hr, HB_HURT);
  }

  // an arrow is a point: it is the tile under that point that stops it, and
  // that point that is tested against every circle above
  for (const a of arrows) hbDot(a.x - ex, a.y - ey, HB_SHOT);

  // walk-over and click targets, claimed from their own centres - what the
  // sim measures to
  for (const d of drops) hbRing(d.x - ex, d.y - ey, 7, HB_PICK);
  for (const f of fish) hbRing(f.x - ex, f.y - ey, 7, HB_PICK); // hoverFish
}

// debug: every walker's live route - '.' (settings.hitbox 2), or
// DBG.showPaths on its own.
// The line is the PLAN, not the walk: it leaves the unit, runs through the
// waypoints it has left, and ends in a box on `nav.gtx/gty`, the tile it
// decided to go to - which is the answer to "why is it walking over there".
// The leg it is on now is solid and the legs behind that are dotted, so a
// route being followed reads differently from a route being replanned.
// Everything that walks has one of these, grazing and patrolling included,
// so a line always shrinks into its box and ends where the walker stops.
// The two exceptions are the two things that do not walk: a flying bird gets
// a straight dotted line to its perch, and a fish - which genuinely has
// nowhere it is going - gets an arrow, no box, no claim of a destination.
function drawNavPaths(ox, oy, ex, ey) {
  const one = (e, col) => {
    const nav = e.nav;
    if (!nav || !nav.path) return false;
    let px = Math.round(e.x - ex), py = Math.round(e.y - ey);
    for (let i = nav.i; i < nav.path.length; i++) {
      const qx = Math.round(nav.path[i][0] - ex), qy = Math.round(nav.path[i][1] - ey);
      hbLine(px, py, qx, qy, col, i === nav.i ? 0 : 2);
      hbDot(qx, qy, col);
      px = qx; py = qy;
    }
    hbBox(nav.gtx * TILE - ox, nav.gty * TILE - oy, TILE, TILE, col);
    return true;
  };
  // A bird in the air is not on the ground route grid - it flies over
  // everything - but it does have a decided place to be: the perch it is
  // coming down on. Straight line and the same goal box, dotted the whole
  // way because the circuit it flies to get there is not surveyed.
  const perchLine = (a, col) => {
    if (a.flyT <= 0 || !a.perch) return;
    const gx = Math.round(a.perch.tx * TILE + 8 - ex), gy = Math.round(a.perch.ty * TILE + 8 - ey);
    hbLine(Math.round(a.x - ex), Math.round(a.y - a.alt - ey), gx, gy, col, 2);
    hbBox(a.perch.tx * TILE - ox, a.perch.ty * TILE - oy, TILE, TILE, col);
  };
  // one colour per kind of walker, as they read on the minimap: the players
  // gold, a wolf red, the rest of the wildlife green, a worker bot blue
  for (const p of players) if (p.active && !p.dead && !inAir(p)) one(p, '#ffe27a');
  for (const a of animals) {
    if (a.dead) continue;
    if (a.kind === 'bird') perchLine(a, '#8ef0a0');
    else one(a, isCampKind(a.kind) ? '#ff6a6a' : '#8ef0a0');
  }
  for (const b of robots) if (!b.dead) one(b, '#7fc8ff');
  // fish steer and never route - there is no goal tile under a fish to box -
  // so they get the arrow instead, teal to sit apart from the walkers above
  for (const f of fish) hbArrow(f.x - ex, f.y - ey, f.a, 12, '#5fe0c8');
}

// ------------------------------------------------------------ cursor & aim line
// The pointer is drawn in-canvas (settings.pixelCursor) so it stays on the
// game's pixel grid at every zoom. cursorInfo() resolves what it should look
// like this frame, once, and both the pixel cursor and the browser-cursor
// fallback read from it:
//   kind  arrow | hand | grab | hammer | reticle
//   mode  (reticle only) idle | lock | hunt | fish | ice | bow
//   dim   the action under the pointer is currently blocked / out of reach
function cursorInfo() {
  if (state.mode === 'title') {
    const m = state.menu;
    if (m.panel === 'settings' && m.panelT >= 1 && !m.closing) {
      if (dragSlider) return { kind: 'grab' };
      return { kind: settingsHit() ? 'hand' : 'arrow' };
    }
    if (popOpen()) { const gh = m.popT >= 1 ? popHit() : null; return { kind: gh !== null && gh !== 'panel' ? 'hand' : 'arrow' }; }
    if (m.screen === 'notes') return { kind: m.notesT >= 1 && notesHit(mouse.x, mouse.y) ? 'hand' : 'arrow' };
    if (m.screen === 'wiki') return { kind: m.wikiT >= 1 && pageTabHit(mouse.x, mouse.y) >= 0 ? 'hand' : 'arrow' };
    if (m.screen === 'lobby') return { kind: m.screenT >= 1 && m.popT <= 0 && lobbyHit() ? 'hand' : 'arrow' };
    if (m.screen === 'profile') return { kind: m.charT >= 1 && profileHit() === 'name' ? 'hand' : 'arrow' };
    if (m.screen === 'skins') return { kind: m.skinT >= 1 && skinsHit() >= 0 ? 'hand' : 'arrow' };
    if (m.screen === 'room') return { kind: m.roomsT >= 1 && roomHit() ? 'hand' : 'arrow' };
    if (!m.panel && (overProfileTag() || overPatchTag() || overCoinTag())) return { kind: 'hand' }; // the three corner tags
    if (!m.panel && menuHit() >= 0) return { kind: 'hand' };
    return { kind: 'arrow' };
  }
  if (state.mode === 'dead') return { kind: deadHit() >= 0 || emoteHit() >= 0 || specHit() || rpCloseHit() || recapHot() ? 'hand' : 'arrow' };
  if (state.mode === 'drop') return { kind: 'arrow' };
  if (state.mode !== 'play') return { kind: 'arrow' };
  if (state.settingsOpen) {
    if (dragSlider) return { kind: 'grab' };
    return { kind: settingsHit() ? 'hand' : 'arrow' };
  }
  if (state.mapOpen) return { kind: 'arrow' };
  if (state.paused) return { kind: 'arrow' };
  if (state.wheel) return { kind: wheelLayout().seg >= 0 ? 'hand' : 'arrow' };
  // the merchant's counter: a hand over anything that trades, an arrow over
  // the rest of the slab (which still swallows the click)
  const sp = shopHit(mouse.x, mouse.y);
  if (sp) return { kind: sp === 'panel' || sp.kind === 'foodWell' ? 'arrow' : 'hand' };
  if (abBuyHit(mouse.x, mouse.y) >= 0) return { kind: 'hand' };
  const sh = stripHit(mouse.x, mouse.y);
  if (sh && (sh.kind === 'ab' || sh.kind === 'food' || sh.kind === 'fishPick')) return { kind: 'hand' };
  if (sh) return { kind: 'arrow' };

  // Every reticle in play carries the attack's state, whatever it is
  // hovering: `nock` is how much of the cycle between attacks has elapsed
  // (1 = ready). drawCursor turns it into the ring's own behaviour, so the
  // crosshair the eye is already on is where the cooldown is read.
  const nockF = player.nockT > 0 ? 1 - player.nockT / Math.max(0.01, attackCycle(player)) : 1;
  // `amb` rides along the same way: buried, settled, and the next arrow off
  // this string is the one worth AMBUSH_MUL
  const ret = (mode, dim, extra) =>
    Object.assign({ kind: 'reticle', mode, dim, nock: nockF, amb: ambushReady(player) }, extra);

  const wx = mouseWX(), wy = mouseWY();
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  const o = structOf(objAt(tx, ty));
  const busy = player.fallT > 0 || player.dodgeT > 0; // tools locked out
  // the CLICK scheme's armed attack-move: the pointer is the order waiting to
  // be laid, and reads as one wherever it is
  if (ckOn() && ck.arm) return ret('amove', false);
  // the MOUSE scheme's readied ability: the pointer is where the next left
  // press casts it, dim while it cannot
  if (ms.ready >= 0) return ret('cast', !abReady(player, ms.ready));
  // the build list up: a hand over its rows, the hammer over the world -
  // wearing the picked piece (drawBuildCursor, js/ui/wheel.js) wherever a
  // press would lay it, and dim where the ghost cannot stand
  if (state.build) {
    if (buildListHit(mouse.x, mouse.y) >= 0) return { kind: 'hand' };
    const g = buildGhostAt();
    return { kind: 'hammer', dim: !g || !g.can.ok, piece: g && !overHud(mouse.x, mouse.y) ? g.type : null };
  }
  // one of your own buildings (E manages it) outranks tool hints; beyond the
  // 60px reach it dims - not under CLICK, where the press walks there
  if (o && STRUCTS[o.type] && !STRUCTS[o.type].fixed && o.team === player.team) {
    const far = Math.hypot(tx * TILE + 8 - player.x, ty * TILE + 8 - player.y) > 60;
    return { kind: 'hammer', dim: far && !ckOn() };
  }
  if (player.charging) {
    return ret('bow', false, { frac: drawPow(player) });
  }
  // a living thing under the pointer: hunting reticle (unitUnder, actions.js
  // - the boxes the CLICK scheme's right button picks a body by, so the ring
  // and the click agree; a merchant is not a mark)
  if (unitUnder(player, wx, wy)) return ret('hunt', busy);
  // a fish under the ice: water-blue ring (the bow spears it from point-blank)
  if (hoverFish()) return ret('fish', busy);
  // something E can work: lock ring (ice-blue over bare ice), dim out of
  // reach. Nothing at a counter: inside a merchant's reach E is the shop's
  // (keyPress, js/app/input.js), and a ring there would promise a swing the key
  // no longer makes.
  const wt = merchNear(player) ? null : workTarget(player);
  if (wt) return ret(wt.o ? 'lock' : 'ice', busy || !wt.near);
  return ret('idle', busy);
}

// sprite hotspots (the pixel that sits under the true mouse position)
const CUR_HOT = { arrow: [0, 0], hand: [4, 0], grab: [5, 4], hammer: [6, 5] };
// reticle looks: colour, tick gap from centre, corner dots
const RETICLE = {
  idle: { col: '#f4f7ff', gap: 3 },
  lock: { col: '#ffd95c', gap: 3, diag: true },
  hunt: { col: '#f2cc6a', gap: 4, diag: true },
  fish: { col: '#7ac0e8', gap: 4, diag: true },
  ice:  { col: '#a8e0f8', gap: 3, diag: true },
  bow:  { col: '#ffd95c', gap: 6, diag: true },
  amove: { col: '#ff6a5c', gap: 4, diag: true }, // the CLICK scheme's armed attack-move
  cast: { col: '#ffd95c', gap: 5, diag: true },  // the MOUSE scheme's readied ability
};
let lastCssCursor = null;

// browser-cursor fallback: hide the native pointer under the pixel cursor,
// otherwise mirror the resolved state with the nearest CSS cursor
function applyCursorStyle(info) {
  let css = 'none';
  if (!settings.pixelCursor) {
    css = info.kind === 'reticle' ? 'crosshair' : info.kind === 'grab' ? 'grabbing' :
      info.kind === 'arrow' ? 'default' : 'pointer';
  }
  if (css !== lastCssCursor) { canvas.style.cursor = css; lastCssCursor = css; }
}

// outlined pixel rects: every rect gets a dark rim first, then the fill, so
// touching ticks never eat each other's outline
function drawOutlinedRects(rects, col, alpha) {
  ctx.globalAlpha = alpha * 0.7;
  ctx.fillStyle = '#0a0e23';
  for (const r of rects) ctx.fillRect(r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  for (const r of rects) ctx.fillRect(r[0], r[1], r[2], r[3]);
  ctx.globalAlpha = 1;
}

function drawCursor(info, now) {
  const mx = Math.round(mouse.x), my = Math.round(mouse.y);
  const base = info.dim ? 0.5 : 1;
  if (info.kind !== 'reticle') {
    const [hx, hy] = CUR_HOT[info.kind];
    ctx.globalAlpha = base * 0.45;
    ctx.drawImage(SPRITES.cursorShadow[info.kind], mx - hx + 1, my - hy + 1);
    ctx.globalAlpha = base;
    ctx.drawImage(SPRITES.cursor[info.kind], mx - hx, my - hy);
    ctx.globalAlpha = 1;
    return;
  }
  const R = RETICLE[info.mode];
  let gap = R.gap, col = R.col;
  if (info.mode === 'bow') {
    // the ring closes as the draw fills and goes pale gold at full, like the meter
    gap = Math.round(6 - 3 * info.frac);
    if (info.frac >= 1) col = DRAW_FULL_COL;
  } else if (info.mode === 'hunt') {
    gap = 4 + (((now * 3) | 0) % 2); // slow breathing
  }
  const L = 3; // tick length
  const rects = [
    [mx - gap - L + 1, my, L, 1], [mx + gap, my, L, 1],
    [mx, my - gap - L + 1, 1, L], [mx, my + gap, 1, L],
  ];
  if (R.diag) { // corner dots one step outside the ring so they never fuse with the ticks
    const g = gap + 1;
    rects.push([mx - g, my - g, 1, 1], [mx + g, my - g, 1, 1], [mx - g, my + g, 1, 1], [mx + g, my + g, 1, 1]);
  }
  // The bow's own state, on top of whatever the pointer is over. While the
  // renock runs, four corner marks fall inward from far out and land on the
  // ring at the moment the bow is ready; there is nothing left of them at rest,
  // so a ready bow is still the clean crosshair it has always been.
  const nock = info.nock === undefined ? 1 : info.nock;
  rects.push([mx, my, 1, 1]);
  drawOutlinedRects(rects, col, base);
  if (nock < 1) {
    const g = gap + 2 + Math.round((1 - nock) * 6);
    drawOutlinedRects([
      [mx - g, my - g, 2, 1], [mx - g, my - g, 1, 2],
      [mx + g - 1, my - g, 2, 1], [mx + g, my - g, 1, 2],
      [mx - g, my + g, 2, 1], [mx - g, my + g - 1, 1, 2],
      [mx + g - 1, my + g, 2, 1], [mx + g, my + g - 1, 1, 2],
    ], '#ffd95c', base * (0.35 + 0.55 * nock));
  }
  // Loosing from full cover: the crosshair grows a second segment out along
  // each of its own axes and the centre pixel warms to gold. Deliberately on
  // the cross, where the renock's marks are on the diagonals, so a bow that is
  // both reloading and buried says two separate things at once.
  if (info.amb) {
    const g2 = gap + L + 2;
    drawOutlinedRects([
      [mx - g2 - 1, my, 2, 1], [mx + g2, my, 2, 1],
      [mx, my - g2 - 1, 1, 2], [mx, my + g2, 1, 2],
    ], '#ffd95c', base);
    ctx.globalAlpha = base;
    ctx.fillStyle = '#ffd95c';
    ctx.fillRect(mx, my, 1, 1);
    ctx.globalAlpha = 1;
  }
}

// Dotted flight line while the bow is drawn: a static dotted line from the
// shot's spawn point through the cursor, exactly as far as the shot would fly
// if loosed this instant, stopping at the first solid tile or body. A blade's
// draw grows the wedge its cut will sweep instead.
function drawAimLine(ex, ey, now) {
  if (!player.charging || state.mode !== 'play' || window.DBG.hideUI) return;
  const full = drawPow(player) >= 1;
  const col = full ? DRAW_FULL_COL : DRAW_COL; // the meter's own two golds (draw-world.js)
  const A = attackOf(player);
  // a blade's draw grows a WEDGE, not a line: the exact reach the cut will
  // sweep at this draw (slashReach, js/sim/attack.js), from the body along the aim
  if (A.cut) {
    const a = Math.atan2(mouseWY() - (player.y - BOW_Y), mouseWX() - player.x);
    drawWedge(Math.round(player.x - ex), Math.round(player.y - 2 - ey), a, slashReach(A.cut, drawPow(player)), A.cut.half, col, full ? 0.85 : 0.6, 0);
    return;
  }
  // the flight THIS draw buys, right now: shotFlight is the shot's own
  // envelope, so the line grows out of the bow as the string comes back and
  // its cap sits exactly where a shot loosed this instant would end
  const fl = shotFlight(A.shot, drawPow(player));
  const range = fl.spd * fl.life;
  const x0 = player.x, y0 = player.y - BOW_Y; // exactly shootAttack()'s origin and direction
  const dx = mouseWX() - x0, dy = mouseWY() - y0;
  const d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
  // walk the flight: stop at the first solid tile or the first animal the
  // shot would hit (the arrow update's own 8px body test)
  let len = range, blocked = null; // 'solid' | 'animal'
  for (let s = 10; s < range; s += 3) {
    const x = x0 + nx * s, y = y0 + ny * s;
    if (isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE))) { len = s; blocked = 'solid'; break; }
    let hit = false;
    for (const an of animals) if (unitFoe(player, an) && animalHit(an, x, y)) { hit = true; break; }
    if (!hit) for (const q of players) {
      if (enemyOf(player, q) && Math.hypot(q.x - x, q.y - 6 - y) < 7) { hit = true; break; }
    }
    if (hit) { len = s; blocked = 'animal'; break; }
  }
  // static dots (no animation - it read as clutter), fading toward the end of the flight
  const sp = 6;
  for (let s = 13; s < len - 3; s += sp) {
    const a = 0.95 * (1 - (s / range) * 0.6);
    const sx = Math.round(x0 + nx * s - ex), sy = Math.round(y0 + ny * s - ey);
    ctx.globalAlpha = a * 0.6; ctx.fillStyle = '#0a0e23'; ctx.fillRect(sx + 1, sy + 1, 2, 2);
    ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
  const tx1 = Math.round(x0 + nx * len - ex), ty1 = Math.round(y0 + ny * len - ey);
  if (blocked) {
    // impact cross where the shot lands: line colour on a solid, hunt amber on a body
    const r = [];
    for (let i = -2; i <= 2; i++) r.push([tx1 + i, ty1 + i, 1, 1], [tx1 + i, ty1 - i, 1, 1]);
    drawOutlinedRects(r, blocked === 'animal' ? RETICLE.hunt.col : col, 0.9);
  } else {
    // range cap: a short bar square to the flight line
    const r = [];
    for (let i = -2; i <= 2; i++) r.push([Math.round(tx1 - ny * i), Math.round(ty1 + nx * i), 1, 1]);
    drawOutlinedRects(r, col, 0.55);
  }
}

