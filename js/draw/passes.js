'use strict';
// The passes render() (js/draw/render.js) runs, cut out of it in its own order
// and named for what each lays down. Each takes the frame's corner (ox/oy,
// ex/ey: the same whole world px) and the clock; none keeps state of its own.
// ------------------------------------------------------------ render passes
const HUT_FR = 140; // ms a frame of the hog hut's chimney smoke
const SNOWDROP_SWAY = 12; // gain on windSway for a snowdrop's lean: a stem bends where a pine barely sways

// the ground and everything flat in it, under the prints
function drawGroundPass(ox, oy, ex, ey, now) {
  // ground - after baking any chunk of it the view reaches for the first time
  // (the lazy bake, ground.js) and repainting the shade of anything standing
  // that changed since the ground last painted it (the `cast shadows` banner)
  groundView(ox, oy, ox + WV_W, oy + WV_H);
  syncCasts(Math.floor(ox / TILE), Math.floor(oy / TILE), Math.floor((ox + WV_W) / TILE), Math.floor((oy + WV_H) / TILE));
  ctx.drawImage(groundCv, ox, oy, WV_W, WV_H, 0, 0, WV_W, WV_H);
  // the creek's fish and its current, drifting over the still water the bake laid (ground.js)
  drawCreekFish(ox, oy); // under the water: drawn first, so the glints run over it
  drawCreekFlow(ox, oy, Math.floor(ox / TILE), Math.floor(oy / TILE), Math.floor((ox + WV_W) / TILE), Math.floor((oy + WV_H) / TILE));

  // the lake's fish under the ice, shadows and crisp in open holes (js/draw/lakes.js)
  drawIceFish(ex, ey);

  // the orca, a shadow under the same ice (js/draw/orca.js)
  drawOrcaShadow(ex, ey, now);

  // pick-cracked ice: bright fractures radiating from the struck tile
  for (const [ci, hits] of iceCracks) {
    const ctx2 = ci % WORLD, cty2 = (ci / WORLD) | 0;
    const px = ctx2 * TILE - ox, py = cty2 * TILE - oy;
    if (px < -TILE || py < -TILE || px > WV_W || py > WV_H) continue;
    const n = 3 + hits * 3;
    for (let j = 0; j < n; j++) {
      const h = hash2(ci * 7 + j * 13, j * 31 + hits);
      const a = (j / n) * Math.PI * 2 + h;
      let x0 = px + 8, y0 = py + 8;
      const steps = 2 + hits;
      ctx.fillStyle = j % 2 ? 'rgba(238,248,253,0.9)' : 'rgba(163,203,224,0.9)';
      for (let s = 0; s < steps; s++) {
        x0 += Math.cos(a) * 2 + (hash2(ci + s, j) - 0.5);
        y0 += Math.sin(a) * 2 + (hash2(j + 7, ci + s) - 0.5);
        ctx.fillRect(Math.round(x0), Math.round(y0), 1, 1);
      }
    }
  }

  // the ice breaks: their water, plates and cracks, in their own shape (js/draw/icebreak.js)
  drawIceBreaks(ox, oy);

  // the archery track's rails, flat under everything that walks, then the
  // parkour's start/finish line, painted flat on the carved ice
  if (PRACTICE) { drawAgTrack(ox, oy); drawParkourLine(ox, oy); drawDfHold(ox, oy); }

  // the trampled snow: the match's slow record, under the crisp prints (js/draw/trample.js)
  drawTrample(ox, oy);
}

function drawFootprints(ox, oy) {
  // footprints + slide trails
  for (const f of footprints) {
    if (f.k === 1) {
      // carved snow groove, lit from the top-left like the rest of the art:
      // shadowed trench wall on top, lit pressed floor below. Holds crisp for
      // most of its (short) life, then fades out fast — so a slide's trail
      // wipes away tail-first behind the player instead of ghosting out as one
      const a = Math.max(0, Math.min(1, (SNOW_TRAIL_LIFE - f.t) / SNOW_TRAIL_FADE));
      const px = Math.round(f.x - ox) - 1, py = Math.round(f.y - oy) - 1;
      ctx.fillStyle = 'rgba(128,152,190,' + (a * 0.6).toFixed(3) + ')';
      ctx.fillRect(px, py, 2, 1);
      ctx.fillStyle = 'rgba(182,199,222,' + (a * 0.55).toFixed(3) + ')';
      ctx.fillRect(px, py + 1, 2, 1);
    } else if (f.k === 2) {
      // ice skate scratch: thin frosted nick, brighter than the ice sheet
      const a = Math.max(0, 1 - f.t / 9);
      ctx.fillStyle = 'rgba(238,250,255,' + (a * 0.75).toFixed(3) + ')';
      ctx.fillRect(Math.round(f.x - ox), Math.round(f.y - oy), 1, 1);
    } else if (f.k === 3) {
      // belly-crawl furrow: a 5px trough laid ACROSS the path (f.nx/ny is the
      // perpendicular the mark was pushed with, so it stays square to the
      // crawl whichever way it went), pressed dark in the middle with the snow
      // it shoved up pale at both lips, plus one elbow dimple to the side.
      // Lives the full 9 s of a footprint - a trail worth following needs to
      // outlast the crawl that made it.
      const a = Math.max(0, 1 - f.t / 9);
      const px = Math.round(f.x - ox), py = Math.round(f.y - oy);
      const dark = 'rgba(118,144,186,' + (a * 0.45).toFixed(3) + ')';
      const lip = 'rgba(200,216,238,' + (a * 0.4).toFixed(3) + ')';
      // two deep along the direction of travel (f.ny, -f.nx), so consecutive
      // marks butt up against each other into one trough instead of a ladder
      for (let k = 0; k < 2; k++) {
        const ox2 = Math.round(f.ny * k), oy2 = Math.round(-f.nx * k);
        for (let t = -2; t <= 2; t++) {
          ctx.fillStyle = t === -2 || t === 2 ? lip : dark;
          ctx.fillRect(px + ox2 + Math.round(f.nx * t), py + oy2 + Math.round(f.ny * t), 1, 1);
        }
      }
      if (f.s) {
        ctx.fillStyle = dark;
        ctx.fillRect(px + Math.round(f.nx * 3 * f.s), py + Math.round(f.ny * 3 * f.s), 1, 1);
      }
    } else {
      // walking footprints
      const a = Math.max(0, 1 - f.t / 9);
      ctx.fillStyle = 'rgba(122,150,192,' + (a * 0.6).toFixed(3) + ')';
      ctx.fillRect(Math.round(f.x - ox) - 1, Math.round(f.y - oy), 2, 2);
    }
  }
}

// the ice's sky and weather, the flat objects, and the rings and marks laid on the snow
function drawFlatPass(ox, oy, ex, ey, tx0, ty0, tx1, ty1, now) {
  // the night sky, reflected in every frozen tile: on the ice surface, so it
  // covers the fish under it and the cracks in it, and under everything that
  // walks - a body standing on the ice covers its own reflection
  if (settings.vidStars) drawIceStars(ox, oy, tx0, ty0, tx1, ty1);
  // a blizzard day's low streaks, on the ground under everything that stands
  drawDrift(ex, ey);
  // the weather on the ice: blown snow, a frosty night's glints and cracks, fresh dust (lakes.js)
  drawLakeSky(ox, oy, tx0, ty0, tx1, ty1);

  // flat objects first (stumps)
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const o = objects[idx(tx, ty)];
      if (!o) continue;
      const px = tx * TILE - ox, py = ty * TILE - oy;
      // +4 like rocks and bushes - any lower and the canopy of a tree on the tile below buries it
      if (o.type === 'stump') ctx.drawImage(SPRITES.stump, px, py + 4);
      // nets lie flat on the water, under everything that walks on them
      else if (o.type === 'net') drawNet(o, px, py, now);
      // ...and so do a burrow's holes (js/draw/tunnel.js)
      else if (o.type === 'tunnel') drawTunnelHole(o, px, py, now);
    }
  }
  // the mounds of bodies riding a tunnel, and the dig's clock under a digger
  drawTunnelGround(ex, ey, now);
  // your side's flag rings - the ground each order covers - flat on the snow
  // under everything that walks it, and the ring a held flag wheel previews
  drawFlagRings(ox, oy, now);
  drawRecallGround(ex, ey); // ...each roost's healing ring and the recall's closing on the feet (js/draw/recall.js)
  // ...and the pick's reach round a rock (drawMineRing, beside drawRock)
  drawMineRing(ox, oy);
  // the CLICK scheme's rings: where the last order landed, and the lock's
  // ring under its target
  drawClickMarks(ex, ey, now);
  // ...and the MOUSE scheme's range preview: what a wedge or a readied
  // ability would cover
  drawCastPreview(ex, ey, now);

  // what the abilities left flat on the snow - craters, and the piercing
  // shot's telegraph line - then drops (all under entities)
  drawAbilityGround(ex, ey, now);
}

// the items lying on the ground
function drawDrops(ex, ey, now) {
  for (const d of drops) {
    const spr = SPRITES[ITEMS[d.type] ? ITEMS[d.type].icon : 'itemGold'];
    const h = spr.width >> 1; // a tool's icon is 12x12, everything else 8x8
    // WHAT YOU JUST THREW AWAY LIES DIM. A drop inside its lock is not yours
    // to walk back over (dropLocked, js/sim/core.js) - no glint, no magnet - so it
    // goes half-lit until the three seconds are up and it comes back to life.
    // Everyone else sees it whole: the lock is one hand's, not the world's.
    const held = dropLocked(d, viewPlayer());
    ctx.fillStyle = 'rgba(120,140,175,0.35)';
    ctx.fillRect(Math.round(d.x - ex) - 2, Math.round(d.y - ey) + 2, 4, 2);
    // a find glints in the colour of its own tier, so something worth walking
    // to is told from a berry at a distance
    const tier = itemTier(d.type);
    if (tier >= 0 && !held) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(now * 5 + d.x);
      ctx.fillStyle = TOOL_TIERS[tier].rim;
      ctx.fillRect(Math.round(d.x - ex) - h - 1, Math.round(d.y - d.z - ey) - h - 1, h * 2 + 2, h * 2 + 2);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = held ? 0.5 : 1;
    ctx.drawImage(spr, Math.round(d.x - ex) - h, Math.round(d.y - d.z - ey) - h);
    ctx.globalAlpha = 1;
  }
}

// the y-sorted list: what stands up, sorted by its feet
function gatherDraws(ox, oy, tx0, ty0, tx1, ty1, now) {
  // y-sorted entities. A building sorts by the bottom of its footprint; a
  // filler whose anchor is outside the scanned tiles stands in for it so a
  // big building still draws when only its lower tiles are on screen.
  const draws = [];
  const seen = new Set();
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      let o = objects[idx(tx, ty)];
      // stumps, nets and holes are all drawn flat, above, and never y-sorted; an
      // eagle's hitbox tiles have no pixels of their own (drawEagle draws the bird)
      if (!o || o.type === 'stump' || o.type === 'net' || o.type === 'tunnel' || o.type === 'eagle') continue;
      if (o.type === 'part') {
        o = o.of;
        if ((o.tx >= tx0 && o.tx <= tx1 && o.ty >= ty0 && o.ty <= ty1) || seen.has(o)) continue;
        seen.add(o);
      }
      draws.push({ y: (o.ty + structH(o)) * TILE, o, tx: o.tx, ty: o.ty });
    }
  }
  trackDowns(now); // a body that just dropped goes down in place (the `going down` banner, js/draw/bodies.js)
  for (const p of players) {
    if (goingDown(p)) { if (fogShown(p, now)) draws.push({ y: p.y + 8, down: p }); continue; }
    if (p.dead || inAir(p) || !fogShown(p, now)) continue; // airborne players draw in drawDropAir; one in the fog not at all (js/draw/fog.js)
    draws.push({ y: p.y + 8, p, ghost: !p.active }); // empty slots stand as silhouettes
  }
  for (const a of animals) if (fogShown(a, now)) draws.push({ y: a.y + 4, a });
  for (const b of robots) if (fogShown(b, now)) draws.push({ y: b.y + (b.merchant ? 8 : 4), r: b }); // a merchant stands on player feet (robots.js)
  // the archery targets (the training grounds', or one a staged scene stood in
  // a match): entities, never tile objects (a slider crosses tiles every
  // frame), sorted by their base like everything
  for (const t of ptargets) draws.push({ y: t.y + 1, pt: t });
  // the middle's stone and the orca out of its ice (js/draw/cistern.js)
  pushMiddleDraws(draws, ox, oy);
  // your side's flags, half a pixel behind their own tile so a flag planted
  // on a tree is never swallowed by that tree's canopy
  for (const q of players) {
    if (!q.active || !q.flag || q.team !== viewPlayer().team) continue;
    draws.push({ y: (q.flag.ty + 1) * TILE + 0.5, f: q });
  }
  draws.sort((a, b) => a.y - b.y);
  return draws;
}

// the y-sorted pass: bodies, animals, flags and the scenery, back to front
function drawSorted(draws, ox, oy, ex, ey, now) {
  // whose view the canopies must not hide (null while dead or airborne - no
  // sprite on the ground to hide; the canopy window, js/draw/canopy.js) and
  // the tree its cursor is resting on
  let heroP = viewPlayer();
  if (!heroP.active || heroP.dead || inAir(heroP)) heroP = null;
  canopyFrame(heroP);
  let wkO = null;
  // the scenery under the pointer, for the one thing a hover shows on a
  // thing E cannot act on yet: a regrowing bush's clock (its branch below).
  // Any reach: a look asks nothing of the legs
  let hovO = null;
  if (heroP) {
    const wk = workTarget(heroP);
    if (wk && !window.DBG.hideUI) wkO = wk.o; // no gold rim on a clean frame (director mode, the media kit)
    if (mouse.inside && state.mode === 'play' && !state.mapOpen && !state.settingsOpen && !state.wheel && !state.drag && !window.DBG.hideUI)
      hovO = structOf(objAt(Math.floor(mouseWX() / TILE), Math.floor(mouseWY() / TILE)));
  }

  airRiders.length = 0;
  for (const d of draws) {
    // a body in deep snow is drawn sunk to the shins (drawWading, js/draw/depth.js)
    if (d.down) { drawDown(d.down, ex, ey, now); continue; }
    if (d.p && !d.ghost && d.p.zip >= 0) { airRiders.push(d.p); continue; } // on a cable: the air layer's, below
    if (d.p) { if (d.ghost) drawGhost(d.p, ex, ey); else drawWading(d.p, ex, ey, now, () => drawPlayer(d.p, ex, ey, now)); continue; }
    if (d.a) { drawWading(d.a, ex, ey, now, () => drawAnimal(d.a, ex, ey, now)); continue; }
    if (d.r) { drawWading(d.r, ex, ey, now, () => drawRobot(d.r, ex, ey, now)); continue; }
    if (d.f) { drawFlag(d.f, ex, ey, now); continue; }
    if (d.pt) { drawPTarget(d.pt, ex, ey, now); continue; }
    if (d.fn) { d.fn(d, ex, ey, now); continue; }
    drawSceneryObj(d, ox, oy, now, wkO, hovO);
  }
}

// one tile object in the y-sorted pass: a tree, a rock, a bush, a building...
function drawSceneryObj(d, ox, oy, now, wkO, hovO) {
  const o = d.o;
  const px = d.tx * TILE - ox, py = d.ty * TILE - oy;
  const sh = o.shake > 0 ? Math.round(Math.sin(o.shake * 55) * 1.4) : 0;
  if (o.type === 'tree') {
    // 27x37, bottom-aligned on its own tile: (px - 5, py - 21) puts the
    // trunk on the tile's centre line and hangs the canopy over the tile
    // above. How far over it is leaning - and whether it draws mirrored - is
    // the WIND's business, not the tree's: see treeFrame() in
    // js/draw/ground.js, which hands back a column of the one atlas
    // texture, never a per-frame canvas.
    // which palette row (variant, forest-depth tone) and where on the tile
    // it stands are the tile's too: treeCell / treeNudgeX/Y, js/draw/ground.js
    const fi = treeCell(d.tx, d.ty, treeFrame(d.tx, d.ty));
    const artX = px - 5 + sh + treeNudgeX(d.tx, d.ty), artY = py - 21 + treeNudgeY(d.tx, d.ty);
    // the hero's own work target wears the gold rim; a canopy over the
    // hero's model opens its window (canopyOver/drawWindowed,
    // js/draw/canopy.js), rim and all. Only a covering canopy leaves the
    // atlas batch, so the thousand-pine batch stays whole.
    const A = SPRITES.treeAtlas, fw = A.fw, fh = A.fh, cx = (fi % A.cols) * fw, cy = Math.floor(fi / A.cols) * fh;
    const drawTree = () => {
      if (o === wkO) drawTargetRim(A, cx, cy, fw, fh, artX, artY, now);
      drawFrameFlash(A, fi, artX, artY, o.flash);
    };
    const open = canopyOver(A, cx, cy, fw, fh, artX, artY);
    if (open > 0) drawWindowed(open, artX, artY, fw, fh, drawTree); else drawTree();
  } else if (o.type === 'deadTree') {
    const spr = SPRITES.deadTree[o.variant], x = px + sh, y = py - 8;
    const drawSnag = () => {
      if (o === wkO) drawTargetRim(spr, 0, 0, spr.width, spr.height, x, y, now);
      drawSpriteFlash(spr, x, y, o.flash);
    };
    const open = canopyOver(spr, 0, 0, spr.width, spr.height, x, y);
    if (open > 0) drawWindowed(open, x, y, spr.width, spr.height, drawSnag); else drawSnag();
  } else if (o.type === 'den') {
    drawSpriteFlash(SPRITES.den, px + sh, py - 4, o.flash);
    drawCampClock(o, px + 16, py - 3); // a cleared camp's respawn clock (js/draw/marks.js)
  } else if (o.type === 'hut') {
    // the HOG HUT (CAMPS.hut, camps.js): the anchor is the front-left tile
    // of its 2x2 footprint and draws the whole building centred over the
    // pair, its chimney smoking through HUT_FR ms a frame; its three
    // `part` tiles resolve to it above and draw nothing of their own
    const fr = SPRITES.hogHut, spr = fr[Math.floor(now * 1000 / HUT_FR) % fr.length];
    drawSpriteFlash(spr, px + sh + TILE - (spr.width >> 1), py + TILE - spr.height, o.flash);
  } else if (o.type === 'stall') {
    // the merchant's shop (OBJECTS.stall): the anchor is the front-left tile
    // and draws the whole 48-wide stall up off the front row
    const spr = SPRITES.teamBuild[skin(o.team)].stall;
    drawSpriteFlash(spr, px + sh, py + TILE - spr.height, o.flash);
  } else if (LANDMARKS[o.type]) {
    drawLandmark(o, px + sh, py); // the boat (js/draw/landmarks.js); their parts draw nothing
  } else if (o.type === 'rock') {
    drawRock(o, px + sh, py, now);
  } else if (o.type === 'chest') {
    if (o === wkO) drawTargetRim(CHEST_SPR, 0, 0, CHEST_SPR.width, CHEST_SPR.height, px + sh, py + TILE - CHEST_SPR.height, now);
    drawSpriteFlash(CHEST_SPR, px + sh, py + TILE - CHEST_SPR.height, o.flash);
  } else if (o.type === 'dummy') {
    // the practice target: skids on its tile, everything else drawn up off
    // it like a tree. The readout bar only appears once it is hurt, and
    // updatePractice mending it is what takes the bar away again. While
    // the archery round's sink runs (agSinkU, js/sim/practice.js) the sprite
    // drops and the snow line crops it - the bottom is already under the
    // field - and at full depth the object leaves the grid entirely.
    const su = PRACTICE ? agSinkU() : 0;
    if (su > 0) {
      const vis = Math.round(DUMMY_SPR.height * (1 - su));
      if (vis > 0) ctx.drawImage(DUMMY_SPR, 0, 0, DUMMY_SPR.width, vis,
        px + sh + ((TILE - DUMMY_SPR.width) >> 1), py + TILE - vis, DUMMY_SPR.width, vis);
      return;
    }
    const dx = px + sh + ((TILE - DUMMY_SPR.width) >> 1);
    const dy = py + TILE - DUMMY_SPR.height;
    drawSpriteFlash(DUMMY_SPR, dx, dy, o.flash);
    if (o.hp < o.maxHp) drawHealthBar(px + 8 + sh, dy - 6, o.hp, o.maxHp, 20, undefined, undefined, o);
    // the combo readout, above the bar's slot so neither ever covers the other
    drawDummyMeter(o, px + 8, dy - 10);
  } else if (o.type === 'cairn') {
    drawSpriteFlash(CAIRN_SPR, px + sh + 1, py + TILE - CAIRN_SPR.height + 1, o.flash);
    drawCampClock(o, px + 8, py + TILE - CAIRN_SPR.height - 2); // the black bear stone's clock
  } else if (o.type === 'pylon') {
    drawPylon(o, px + sh, py); // a zipline's post (js/draw/zipline.js); the cable itself is drawZips, below
  } else if (o.type === 'banner') {
    drawBanner(o, px + sh, py, now);
  } else if (o.type === 'rack') {
    // two tiles per rack: the lead (left) tile draws the whole sprite
    // centred over the pair; the follower tile is solid and silent
    if (o.lead) {
      // `dx` nudges the picture off the tile grid (the practice rack sits
      // half a tile left of its pair, square under the dummy's axis)
      const rx = px + sh + (o.dx || 0);
      // mid-sink for the archery round: dropped and cropped like the dummy
      const su = PRACTICE ? agSinkU() : 0;
      if (su > 0) {
        const vis = Math.round(RACK_SPR.height * (1 - su));
        if (vis > 0) ctx.drawImage(RACK_SPR, 0, 0, RACK_SPR.width, vis,
          rx + ((TILE * 2 - RACK_SPR.width) >> 1), py + TILE + 1 - vis, RACK_SPR.width, vis);
        return;
      }
      ctx.fillStyle = 'rgba(40,60,100,0.25)';
      ctx.fillRect(rx + 2, py + TILE - 2, TILE * 2 - 4, 2);
      drawSpriteFlash(RACK_SPR, rx + ((TILE * 2 - RACK_SPR.width) >> 1), py + TILE - RACK_SPR.height + 1, o.flash);
    }
  } else if (o.type === 'pkdie') {
    drawPkDie(o, px, py, now);
  } else if (o.type === 'agbell') {
    // mid-sink for the archery round, like the dummy and rack: the bell is
    // drawn procedurally, so it slides down and a clip at its ground line
    // crops what is already under the field
    const su = PRACTICE ? agSinkU() : 0;
    if (su > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(px - 2, py + TILE - 29, 21, 29);
      ctx.clip();
      drawAgBell(o, px + sh, py + Math.round(su * 29), now);
      ctx.restore();
    } else drawAgBell(o, px + sh, py, now);
  } else if (o.type === 'bush') {
    // the plant is its own regrow clock (BUSH_BUD_T / BUSH_RIPEN_T, world.js):
    // bare, then buds, then dull berries, then ripe
    const spr = o.berries > 0 ? SPRITES.bush
      : o.regrow <= BUSH_RIPEN_T ? SPRITES.bushRipen
      : o.regrow <= BUSH_BUD_T ? SPRITES.bushBud : SPRITES.bushEmpty;
    // a bare bush never rims: workTarget's `ready` gate already refuses it,
    // so the rim only ever lands on berries worth picking
    if (o === wkO) drawTargetRim(spr, 0, 0, spr.width, spr.height, px + sh, py + 4, now);
    drawSpriteFlash(spr, px + sh, py + 4, o.flash);
    // hovered while regrowing: the clock itself, the neutral unit bar over
    // the plant filling toward ripe - the frames say roughly, a look asks
    // exactly. A ripe bush wears the rim instead, and says pick me.
    if (o.berries <= 0 && o === hovO) drawHealthBar(px + 8, py + 1, BUSH_REGROW - o.regrow, BUSH_REGROW, 12, undefined, BAR_NEUTRAL);
  } else if (o.type === 'snowdrop') {
    // a warren's clump: open until picked, then the snapped stem, then the
    // shut bud as it comes back (snowdropLeft, world.js) - and hovered while
    // it rests, the neutral bar a bush wears, filling toward open. It leans
    // with the pines' own wind - lighter, so the same breath moves it
    // further (SNOWDROP_SWAY) - and sits a hash's few pixels off its tile's
    // grid so two clumps never line up. Its 24 px cell stands its feet at
    // the tile's (8, 15). An open one's bell, halo and light are laid again
    // above the grade (litDrops, then litSnowdrops in js/draw/light.js), so
    // no cloud or night dulls the one thing in the warren worth crossing it for.
    const V = SPRITES.snowdrop[o.variant % SPRITES.snowdrop.length];
    const left = snowdropLeft(o), open = left <= 0;
    const lean = Math.max(-1, Math.min(1, Math.round(windSway(o.tx, o.ty) * SNOWDROP_SWAY)));
    const spr = left > SNOWDROP_BUD_T ? V.picked[0] : (open ? V.open : V.closed)[lean + 1];
    const jx = Math.floor(hash2(o.tx * 5 + 3, o.ty * 7 + 1) * 5) - 2, jy = Math.floor(hash2(o.tx * 3 + 9, o.ty * 11 + 2) * 3) - 1;
    const sx = px + sh + jx + 8 - (spr.width >> 1), sy = py + jy + 17 - spr.height;
    if (open && o === wkO) drawTargetRim(spr, 0, 0, spr.width, spr.height, sx, sy, now);
    drawSpriteFlash(spr, sx, sy, o.flash);
    if (open) litDrops.push({ o, V, lean, sx, sy });
    else if (o === hovO) drawHealthBar(px + 8, sy + 4, SNOWDROP_CD - left, SNOWDROP_CD, 12, undefined, BAR_NEUTRAL);
  } else if (STRUCTS[o.type] && STRUCTS[o.type].tiled) {
    drawTiledStruct(o, px, py, sh, now); // one tile of art per footprint tile (the long wall)
  } else if (STRUCTS[o.type]) {
    drawStructObj(o, px, py, sh, now); // a building: below
  }
}

// a building (STRUCTS): a build in progress, or a standing one with its overlays,
// cracks and bar
function drawStructObj(o, px, py, sh, now) {
  const spr = structSprite(o);
  const off = structArtOff(o, spr); // skirt on the footprint's bottom edge, centred over its width
  const sx = px + off.x, sy = py + off.y;
  if (o.building) {
    const p = o.buildT / o.buildTotal;
    if (spr.width > 16) {
      // a big build: the foundation is staked out first, then the walls
      // rise out of it behind a weld line (bigBuildReveal for the split)
      const fw = structW(o) * TILE, fh = structH(o) * TILE;
      ctx.fillStyle = 'rgba(58,66,82,0.5)';
      ctx.fillRect(px + 1, py + 1, fw - 2, fh - 2);
      ctx.fillStyle = '#1c2130';
      ctx.fillRect(px, py, fw, 1); ctx.fillRect(px, py + fh - 1, fw, 1);
      ctx.fillRect(px, py, 1, fh); ctx.fillRect(px + fw - 1, py, 1, fh);
      for (const [cx, cy] of [[px + 1, py - 2], [px + fw - 3, py - 2], [px + 1, py + fh - 5], [px + fw - 3, py + fh - 5]]) {
        ctx.fillStyle = '#1c2130'; ctx.fillRect(cx, cy, 2, 4);
        ctx.fillStyle = '#e0b83f'; ctx.fillRect(cx, cy, 2, 1);
      }
      const r = bigBuildReveal(o);
      if (r.rows > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(sx - 2, sy + spr.height - r.rows, spr.width + 4, r.rows); ctx.clip();
        drawSpriteFlash(spr, sx + sh, sy, o.flash);
        ctx.restore();
        if (r.rows < spr.height) {
          const ey = sy + spr.height - r.rows;
          ctx.fillStyle = '#fff1b0'; ctx.fillRect(sx + 2, ey, spr.width - 4, 1);
          ctx.globalAlpha = 0.55 + 0.45 * Math.sin(now * 40);
          ctx.fillStyle = '#ffd95c'; ctx.fillRect(sx + 4, ey - 1, spr.width - 8, 1);
          ctx.globalAlpha = 1;
        }
      }
    } else if (p < 1 / 3) ctx.drawImage(SPRITES.scaffold[0], px, py);
    else if (p < 2 / 3) ctx.drawImage(SPRITES.scaffold[1], px, py);
    else {
      drawSpriteFlash(spr, px + sh, py, o.flash);
      ctx.drawImage(SPRITES.scaffold[2], px, py);
    }
  } else {
    // the gold pump strokes: the frame off its payout clock (pumpFrame)
    const art = o.type === 'generator' ? pumpFrame(o) : spr;
    drawCastShade(art, sx, sy); // a standing building throws the sun's shade like a body (ground.js)
    drawSpriteFlash(art, sx + sh, sy, o.flash);
    if (o.type === 'generator') drawPumpCoin(o, sx + sh, sy);
    if (o.type === 'spawner') drawBayOverlay(o, sx + sh, sy, now);
    if (o.type === 'barracks') drawBarracksOverlay(o, sx + sh, sy, now);
    // the gun is not in the grid: rasterise it at the live bearing, on the collar
    if (o.type === 'turret') drawTurretHead(o, sx + sh + 16, sy + 12); else if (o.type === 'tower') drawTowerTop(o, sx + sh, sy); // a tower's gun in its deck, and its bar (js/draw/towers.js)
    if (o.hp < o.maxHp * 0.6) {
      // four crack marks, placed as fractions of the sprite so they fit any size
      const w = spr.width, h = spr.height;
      ctx.fillStyle = 'rgba(40,25,15,0.5)';
      ctx.fillRect(sx + (w >> 2), sy + (h * 5 >> 4), 1, 3); ctx.fillRect(sx + (w >> 2) + 1, sy + (h >> 1), 1, 2);
      ctx.fillRect(sx + (w * 5 >> 3), sy + (h * 3 >> 4), 1, 4); ctx.fillRect(sx + (w * 5 >> 3) + 1, sy + (h * 7 >> 4), 1, 2);
    }
    // damage readout: only once hurt, so an untouched base stays clean.
    // the bay has its own bar inside drawBayOverlay - don't draw two.
    // `+ sh` so the readout rides the hit shudder with the building it
    // belongs to: it only ever appears while the thing is being hit, and a
    // bar holding still over a wall that is rocking is a bar centred on
    // nothing. drawBayOverlay is handed `sx + sh` and has always done this.
    if (o.type !== 'spawner' && o.type !== 'barracks' && o.type !== 'tower' && o.hp < o.maxHp) {
      drawHealthBar(sx + sh + (spr.width >> 1), sy - 5, o.hp, o.maxHp, evenBarW(Math.max(12, Math.min(24, spr.width - 4))), o.team, undefined, o);
    }
  }
}

function drawBuildBars(ox, oy) {
  // construction progress bars - "over the roof" for a big building
  for (const o of structures) {
    if (!o.building) continue;
    const px = o.tx * TILE - ox, py = o.ty * TILE - oy;
    if (px < -20 || px > WV_W + 4 || py < -20 || py > WV_H + 4) continue;
    const p = Math.min(1, o.buildT / o.buildTotal);
    const big = structW(o) > 1;
    const bw = big ? 24 : 12, bx = big ? px + structW(o) * 8 - 12 : px + 2;
    const by = big ? (o.ty + structH(o)) * TILE - oy - structSprite(o).height - 12 : py - 7;
    ctx.fillStyle = 'rgba(15,22,50,0.8)';
    ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = '#ffd95c';
    ctx.fillRect(bx + 1, by + 1, Math.round((bw - 2) * p), 2);
  }
}

function drawParticles(ex, ey) {
  // particles
  for (const p of particles) {
    // `maxLife` is the seconds a particle spends fading out (bursts hold full
    // opacity until their last 0.4 s); `alpha` caps how opaque it ever gets,
    // which is what keeps arrow trail motes a hint of colour rather than sparks
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife)) * (p.alpha || 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - ex), Math.round(p.y - ey), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawArrows(ex, ey, now) {
  // arrows: the one shared body (ARROW_MAP, js/sim/actions.js - white tip, flint
  // head, the loaded bit's collar, one-gold shaft, team feathers) rasterised
  // at the live bearing by arrowBodyPx and rimmed in dark so the shot stays
  // readable over snow. a.x/a.y is the TIP - the point the sim tests - and
  // the body trails ARROW_LEN px behind it.
  for (const a of arrows) { if (!fogShown(a, now)) continue; // a rival's shot in the fog is not there (js/draw/fog.js)
    if (a.kind === 'rock') { drawSlungRock(a, ex, ey); continue; }
    const hx = Math.round(a.x - ex), hy = Math.round(a.y - ey);
    if (hx < -22 || hx > WV_W + 22 || hy < -22 || hy > WV_H + 22) continue;
    // Not every bit flies as the plain arrow: a bit may name a BODY of its
    // own (`body`, js/sim/tools.js) - a barbed or an icy shaft, a grapple on its
    // cord, a tumbling log, a mote with no bearing at all, a swung fist or
    // axe, a teleport request that is not a shape - and BIT_BODY (the bodies
    // a bit flies as, below) is where that name is answered. Everything else
    // is the arrow, wearing the bit's own colour on the collar behind the head.
    const bd = a.body && BIT_BODY[a.body];
    if (bd) bd(a, hx, hy, now, a.x - ex, a.y - ey);
    else drawShaft(a, a.x - ex, a.y - ey);
    // ...and whatever it flies as, a shot carrying fire burns on its head
    if (a.burn > 0) drawShotFire(a, hx, hy, now);
  }
}

function drawTracers(ex, ey) {
  // turret tracers
  for (const t of tracers) {
    ctx.globalAlpha = Math.max(0, Math.min(1, t.t / 0.08));
    ctx.strokeStyle = '#f6d35c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(t.x0 - ex) + 0.5, Math.round(t.y0 - ey) + 0.5);
    ctx.lineTo(Math.round(t.x1 - ex) + 0.5, Math.round(t.y1 - ey) + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSwingArcs(ex, ey, now) {
  // swing arcs (every player who is mid-swing)
  for (const p of players) {
    if (!p.active || p.dead || inAir(p) || p.swingT <= 0 || !fogShown(p, now)) continue;
    const prog = 1 - p.swingT / 0.18;
    const a0 = p.swingDir - 1.1 + prog * 2.2;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.8 - prog * 0.6).toFixed(2) + ')';
    for (let i = 0; i < 3; i++) {
      const a = a0 - i * 0.22;
      const rr = 13 - i;
      ctx.fillRect(
        Math.round(p.x + Math.cos(a) * rr - ex),
        Math.round(p.y - 2 + Math.sin(a) * rr - ey), 2, 2);
    }
  }
}

function renderAirLayer(shx, shy, now) {
  // the air layer (airCv, js/app/canvas.js): a bird in flight, its riders,
  // anyone falling and a player on a zipline's handle, off the EXACT camera
  // so the body the camera rides holds still on the screen while the ground
  // slides under it; the day's grade laid over it the way renderLighting
  // laid it over the world. Only the box round what it holds is graded and
  // blitted (airBox): a bird's trail and shadow reach across the frame, so a
  // flight takes all of it, but a rider is a few dozen px
  const ax = camX + shx, ay = camY + shy;
  airBox.x0 = airBox.y0 = Infinity; airBox.x1 = airBox.y1 = -Infinity;
  if (state.drop && state.drop.eagles.some(dropFlies)) airGrow(0, 0, WV_W, WV_H);
  for (const p of players) if (p.active && p.dropT > 0) airGrow(p.x - ax - AIR_PAD, p.y - ay - DROP_ALT - 60, p.x - ax + AIR_PAD, p.y - ay + AIR_PAD);
  for (const p of airRiders) airGrow(p.x - ax - AIR_PAD, p.y - ay - AIR_TOP, p.x - ax + AIR_PAD, p.y - ay + AIR_PAD);
  airBox.x0 = Math.max(0, Math.floor(airBox.x0)); airBox.y0 = Math.max(0, Math.floor(airBox.y0));
  airBox.x1 = Math.min(WV_W, Math.ceil(airBox.x1)); airBox.y1 = Math.min(WV_H, Math.ceil(airBox.y1));
  airOn = airBox.x1 > airBox.x0 && airBox.y1 > airBox.y0;
  if (airOn) {
    ctx = actx;
    ctx.clearRect(0, 0, WV_W, WV_H);
    if (state.drop) drawDropAir(ax, ay, now, true);
    for (const p of airRiders) drawWading(p, ax, ay, now, () => drawPlayer(p, ax, ay, now));
    lightAir(airBox.x0, airBox.y0, airBox.x1 - airBox.x0, airBox.y1 - airBox.y0);
  }
}

// the world blit, then everything drawn in screen space: the weather, the HUD,
// the screens over it and the pointer
function renderScreen(ox, oy, shx, shy, now) {
  // Back to the screen, and the only place the two pixel spaces meet. The
  // blit is done in DEVICE pixels (identity transform) at k = zoom * devScale
  // px per world px: whole at rest, so every world pixel gets exactly the
  // same k x k block and the grid is uniform; briefly fractional while the
  // ease runs, which is the one moment nobody is reading pixel edges. It is
  // one nearest-neighbour resample of an ALREADY COMPOSED frame, so ground,
  // sprites and particles share one grid instead of each rounding its own.
  // It lands shifted up-left by the camera's leftover fraction (the
  // sub-pixel camera, above), rounded to a whole DEVICE px so the blocks stay
  // whole; the buffer carries a spare world px on each axis for the shift
  // (sizeWorldView), so the destination still covers the canvas and the edge
  // clips the overhang.
  ctx = uictx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const kPx = zoomCur * devScale;
  const subX = Math.round((camX + shx - ox) * kPx), subY = Math.round((camY + shy - oy) * kPx);
  ctx.drawImage(worldCv, 0, 0, WV_W, WV_H, -subX, -subY, WV_W * kPx, WV_H * kPx);
  if (airOn) {
    const b = airBox, bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    ctx.drawImage(airCv, b.x0, b.y0, bw, bh, b.x0 * kPx, b.y0 * kPx, bw * kPx, bh * kPx);
  }
  // everything from here draws in VIEW space, blown up by the whole-number
  // devScale - so 1px HUD rects and the 3x5 font stay exact at any zoom
  ctx.setTransform(devScale, 0, 0, devScale, 0, 0);

  renderWeather(camX + shx, camY + shy); // on the screen: the exact camera, the way the ground was blitted
  renderVignettes();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawTallies(kPx, subX, subY); // the running damage totals the frames queued, crisp at any zoom (js/draw/overhead.js)
  ctx.setTransform(devScale, 0, 0, devScale, 0, 0);
  if (!window.DBG.hideUI) drawBotTags(); // F4: each bot's goal under its feet, under the HUD (js/ui/botview.js)
  replayTick(now); // banks the finished world frame - must stay above renderUI
  // what the pointer is on, resolved ONCE per frame, before the UI draws
  // (see the tooltips banner, ui.js)
  tipResolve();
  renderUI(now);
  // the archery round's live layer: countdown, GO, the TIME/SCORE/HITS
  // plate, the final score (drawAgameUI, js/draw-world.js)
  if (PRACTICE && state.mode === 'play') drawAgameUI(now);
  if (state.mode === 'drop') renderDropUI(now);
  // the drop brief's roost headlines (updateDrop's tour, js/sim/eagle.js)
  if (state.mode === 'play' && state.dropBrief) drawDropBrief();
  else if (state.mode === 'play' && player.aboard) drawHopPrompt(now); // still seated on the roost: E - HOP OFF
  // the M map works mid-flight too: the ride's wider read lives here now
  if ((state.mode === 'play' || state.mode === 'drop') && state.mapOpen) renderWorldMap(now);
  // after the chart: a flag wheel opens over it too (pinned to the press point)
  if (state.mode === 'play' && state.wheel) renderWheel(now);
  if (state.mode === 'play' && state.settingsOpen) renderSettings(now);
  if (state.mode === 'title' || state.intro > 0) renderTitle(now);
  // the last four seconds: the whole frame on a death (the recap - the
  // countdown and its ESC prompt draw over it, so it goes first), the
  // bottom-left corner on pause
  renderReplay();
  if (state.mode === 'dead') renderDead(now);
  // the tooltip owns the bottom-left corner while it is up; it draws in every
  // mode, since the tech tree on the title screen is read through it too
  if (!window.DBG.hideUI) drawBotView(); // F4: the table and the hovered bot's card (js/ui/botview.js)
  if (!window.DBG.hideUI && !endScreen()) drawTooltip();
  if (scoreboardOpen()) renderScoreboard();
  if (!window.DBG.hideUI) drawTags();
  if (state.fade && state.fade.a > 0) {
    ctx.globalAlpha = Math.min(1, state.fade.a);
    ctx.fillStyle = state.fade.color;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
  // pointer, last of all so it sits above every overlay
  const cur = cursorInfo();
  applyCursorStyle(cur);
  if (!window.DBG.hideUI) drawBuildCursor(cur); // the build list's piece, under the pointer's own glyph
  if (settings.pixelCursor && mouse.inside && !window.DBG.hideUI) drawCursor(cur, now);
  // director mode (js/app/director.js): the finished frame goes to a take being
  // recorded, and only then the director's strip over it
  dirRecFrame();
  drawDirector(now);
}
