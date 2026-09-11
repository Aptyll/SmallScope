'use strict';
// A body in the world: a beast on its clip, a robot, the merchant, and the
// player - gear marks, buff ring, pose bounds, snow cover, burial, the
// ghost, the held tool. Every walking thing's sprite pass ends up here.
// ---- beasts, robots and the merchant --------------------------------------
// The frame a beast is on: the clip it put itself in (ANIM_CLIPS,
// js/wildlife.js - a graze, a gallop, a sit-up) and how far into it, wrapped
// the long way round so any animT lands on a frame rather than off the end.
function clipFrame(set, a) {
  const clip = set[a.clip] || set.idle;
  const i = Math.floor(a.animT || 0) % clip.length;
  return clip[i < 0 ? i + clip.length : i];
}

function drawAnimal(a, ex, ey, now) {
  if (a.kind === 'bird') { drawBird(a, ex, ey, now); return; }
  const rabbit = a.kind === 'rabbit';
  const wolf = isCampKind(a.kind); // a camp monster: wears the leash bar in threat red
  const big = a.kind === 'dire';   // the 2x sprite: everything about its frame is wider
  const spr = clipFrame(SPRITES[a.kind][a.dir], a);
  const px = Math.round(a.x - spr.width / 2 - ex);
  const py = Math.round(a.y + 4 - spr.height - ey);
  const sw = rabbit ? 4 : big ? 12 : wolf ? 6 : 7;
  ctx.fillStyle = 'rgba(110,130,170,0.35)';
  ctx.fillRect(Math.round(a.x - ex) - sw, Math.round(a.y + 2 - ey), sw * 2, 2);
  drawSpriteFlash(spr, px, py, a.flash);
  // netted, snared, alight, marked: the same four tells a player wears, at
  // this body's size (drawUnitStates, js/abilities.js)
  drawUnitStates(a, px, py, spr.width, spr.height, now);
  // The player's frame, on a beast: health on top, always, the second bar
  // hung 3 rows under it the way a player's stamina hangs under the health,
  // the two sharing a wall, and the level badge on the left spanning both -
  // the same plate a hero wears (drawLevelBadge), because the number means
  // the same thing over either. The second bar is always worn: a wolf's
  // threat, bare track at rest and filling from the first flicker of
  // interest to the full bar it charges on (updateWolf, js/wildlife.js); a
  // deer's sprint and a rabbit's jink charge (updatePrey) in stamina white -
  // each is one, spent on the run and on the dash. Over the frame, the stun
  // stars or the noticed mark, never both.
  const bw = rabbit ? 8 : big ? 24 : wolf ? 12 : 16;
  const bx = Math.round(a.x - ex - bw / 2); // the bars' own left column (drawHealthBar's x)
  drawHealthBar(a.x - ex, py - 8, a.hp, a.maxHp, bw);
  if (wolf) drawHealthBar(a.x - ex, py - 5, a.threat, 1, bw, undefined, THREAT_COL);
  else drawHealthBar(a.x - ex, py - 5, rabbit ? a.dodge : a.sprint, 1, bw, undefined, STAM_COL);
  drawLevelBadge(bx - 1, py - 9, a.level);
  if (a.stunT > 0) drawStunStars(Math.round(a.x - ex), py - 13, a, 4);
  else if (a.senseT > 0) drawSenseMark(Math.round(a.x - ex), py - 16, a, wolf ? THREAT_COL : STAM_COL);
}

// The only thing in the world that leaves the ground: the sprite lifts off
// its own shadow by a.alt, which is the whole read on how high a bird is.
// No health bar - three hp means every hit is a kill, and a bar over
// something this small is all bar.
function drawBird(a, ex, ey, now) {
  const flying = a.flyT > 0;
  const spr = clipFrame(SPRITES.bird[a.dir], a);
  const px = Math.round(a.x - spr.width / 2 - ex);
  const py = Math.round(a.y - a.alt - spr.height - ey);
  ctx.fillStyle = flying ? 'rgba(110,130,170,0.22)' : 'rgba(110,130,170,0.3)';
  ctx.fillRect(Math.round(a.x - ex) - 2, Math.round(a.y + 1 - ey), 4, 1);
  drawSpriteFlash(spr, px, py, a.flash);
  drawUnitStates(a, px, py, spr.width, spr.height, now); // a burning bird still reads as one
}

// Worker bot: one sprite, two tread frames. The whole thing bobs 1px while
// driving so body and tread never part. No face - the states are the tread
// rolling, the tool swinging at a target, and the gold held up front.
function drawRobot(b, ex, ey, now) {
  if (b.merchant) { drawMerchant(b, ex, ey, now); return; }
  const set = SPRITES.robotTeam[skin(b.team === undefined ? 0 : b.team)] || SPRITES.robot;
  const spr = set[b.moving ? Math.floor(b.animT) % 2 : 0];
  const bob = b.moving ? Math.floor(b.animT / 2) % 2 : 0;
  const bx = Math.round(b.x - 6 - ex);
  const by = Math.round(b.y + 4 - ey) - spr.height - bob; // tread bottom sits at b.y + 4

  ctx.fillStyle = 'rgba(110,130,170,0.35)';
  ctx.fillRect(bx + 1, Math.round(b.y + 3 - ey), 10, 2);

  // one swing animation, two jobs: the harvest tick, or - on an attack flag -
  // the same axe aimed at whatever b.atkAim points to (`worker flags`, robots.js)
  let tdx = 0, tdy = 0, working = false, icon = null, prog = 0;
  if (b.atkAim) {
    tdx = b.atkAim.x - b.x; tdy = b.atkAim.y - b.y;
    working = true;
    icon = SPRITES.itemAxe;
    prog = 1 - b.atkCd / ROBOT_ATK_CD;
  } else if (b.tgt && !b.moving) {
    tdx = b.tgt.tx * TILE + 8 - b.x; tdy = b.tgt.ty * TILE + 8 - b.y;
    working = Math.hypot(tdx, tdy) <= 20;
    icon = SPRITES[b.tgt.type === 'rock' ? 'itemPick' : 'itemAxe'];
    prog = Math.min(1, b.workT / 0.9);
  }

  drawSpriteFlash(spr, bx, by, b.flash);
  // a soldier (the `soldiers` banner, robots.js) flies its side's pennant
  // off the chassis: the one thing that says this bot is not here to chop
  if (b.kind === 'soldier') drawFlagPennant(ctx, bx + 10, by + 2, TEAMS[skin(b.team)].mark);

  // carried gold: a nugget held up in front of the body
  if (b.carry > 0 && !working) {
    const gx = bx + 3, gy = by + 2;
    ctx.fillStyle = '#1c2130'; ctx.fillRect(gx, gy, 6, 4);
    ctx.fillStyle = '#f2cc6a'; ctx.fillRect(gx + 1, gy + 1, 4, 2);
    ctx.fillStyle = '#fff1b0'; ctx.fillRect(gx + 1, gy + 1, 2, 1);
    ctx.fillStyle = '#b8902e'; ctx.fillRect(gx + 3, gy + 2, 2, 1);
  }

  // working: raised away from the target through a slow wind-up, then a
  // fast chop that lands pointing at it (workT resets on the hit)
  if (working) {
    const e = prog < 0.7 ? prog / 0.7 * 0.3 : 0.3 + (prog - 0.7) / 0.3 * 0.7;
    const a = Math.atan2(tdy, tdx) - 1.6 * (1 - e);
    ctx.save();
    ctx.translate(Math.round(bx + 6 + Math.cos(a) * 7), Math.round(by + 3 + Math.sin(a) * 7));
    ctx.rotate(a + Math.PI / 2);
    ctx.drawImage(icon, -4, -4);
    ctx.restore();
  }

  // the four shared tells, same as any other body (js/abilities.js)
  drawUnitStates(b, bx, by, spr.width, spr.height, now);
  drawHealthBar(b.x - ex, by - 4, b.hp, b.maxHp, 8, b.team);
  if (b.stunT > 0) drawStunStars(Math.round(b.x - ex), by - 9, b, 4);
}

// The merchant (the `merchant` banner, robots.js): its own 16x18 hooded-robe
// grids (sprites.js), two rows taller than a slot, standing on player feet
// (b.y + 8 in the sort, the feet on the player's own foot row),
// with the worker's axe swing over whatever it is felling or setting, the hop
// off the bird as a lift, the shared tells, and a MERCH nameplate in the
// side's paint - a name, the one text a body over the world gets (the bird it
// drives wears PERCH the same way, drawEagle in boot.js). NO HEALTH BAR: it
// has no health to draw (the `merchant` banner, js/robots.js), and a full bar
// that can never move would promise a fight that is not on offer.
function drawMerchant(b, ex, ey, now) {
  const set = SPRITES.merchant[skin(b.team)];
  const frames = set[b.dir] || set.down;
  const spr = frames[b.moving ? 1 + (Math.floor(b.animT / 2) % 2) : 0];
  // 16 x 18: the feet land on the player's own foot row (b.y + 4), so the
  // extra two rows are height, and a walking robe bobs a pixel like a player
  const px = Math.round(b.x - 8 - ex), py = Math.round(b.y + 4 - ey) - spr.height;
  const lift = (b.hopT > 0 ? Math.round(Math.sin(Math.min(1, b.hopT / MERCH_HOP_T) * Math.PI) * 10) : 0) +
    (b.moving ? Math.floor(b.animT / 2) % 2 : 0);
  ctx.fillStyle = 'rgba(110,130,170,0.35)';
  ctx.fillRect(px + 5, py + spr.height - 1, 6, 2);
  drawSpriteFlash(spr, px, py - lift, b.flash);
  // the swing: the worker's wind-up and chop, aimed at the tile in hand
  if (b.tgt && !b.moving && lift === 0) {
    const tdx = b.tgt.tx * TILE + 8 - b.x, tdy = b.tgt.ty * TILE + 8 - b.y;
    if (Math.hypot(tdx, tdy) <= 20) {
      const total = b.tgt.type === 'stump' ? MERCH_BUILD_T : MERCH_SWING_T;
      const prog = Math.min(1, b.workT / total);
      const e = prog < 0.7 ? prog / 0.7 * 0.3 : 0.3 + (prog - 0.7) / 0.3 * 0.7;
      const a = Math.atan2(tdy, tdx) - 1.6 * (1 - e);
      ctx.save();
      ctx.translate(Math.round(px + 8 + Math.cos(a) * 8), Math.round(py + 10 + Math.sin(a) * 8));
      ctx.rotate(a + Math.PI / 2);
      ctx.drawImage(SPRITES.itemAxe, -4, -4);
      ctx.restore();
    }
  }
  drawUnitStates(b, px, py - lift, spr.width, spr.height, now);
  drawPixelTextOutline(ctx, 'MERCH', centreTextX(b.x - ex, 'MERCH'), py - 17 - lift, TEAMS[skin(b.team)].mark, '#0f1632');
  if (b.stunT > 0) drawStunStars(Math.round(b.x - ex), py - 10, b, 5);
}

// ---- the player -----------------------------------------------------------
// every player draws through here - the local one, the AI fills, network
// peers later. Team palette on the sprite, name tag on everybody else.
// gear on the body: bought depth is visible depth. Each piece at level 2+
// lays a band of its material across the sprite - hat, coat, hips, one mark
// per foot - so a fed player reads iron -> steel -> gold at a glance without
// a number. Level 1 (the free pick) draws nothing: the baseline look is the
// champion's. Rows are sprite-relative to the shared 16x16 body plan.
const GEAR_MARKS = [
  { y: 3, x: 5, w: 6 },          // helmet: across the hat/hood
  { y: 8, x: 5, w: 6 },          // chest: across the coat
  { y: 11, x: 5, w: 6 },         // legs: across the hips
  { y: 13, x: 5, w: 2, x2: 9 },  // boots: one mark per foot
];
// s scales the whole 16x16 grid the marks are authored on: 1 in the world,
// 3 on the victory screen's stage
function drawGearMarks(p, px, py, s) {
  s = s || 1;
  for (let i = 0; i < GEAR_MARKS.length; i++) {
    const lv = p.gearLv[i];
    if (lv < 2) continue;
    const m = GEAR_MARKS[i];
    ctx.fillStyle = GEAR_MATS[lv - 1];
    ctx.fillRect(px + m.x * s, py + m.y * s, m.w * s, s);
    if (m.x2 !== undefined) ctx.fillRect(px + m.x2 * s, py + m.y * s, m.w * s, s);
  }
}

// Centre a run of pixel text over a model. A glyph run is an ODD number of
// pixels wide at scale 1 (`pixelTextWidth` is `4n - 1`), so it can never sit
// exactly on the seam an even-width sprite is centred on - but it must at
// least sit on the same side of that seam every frame, and rounding
// `x - ex - w / 2` in one go does not. The half pixel the odd width carries
// lands on top of the camera's own fraction, so which way it rounds flips as
// the model walks and the tag hops a pixel left and right against a body that
// is holding still. Round the position first - the once-and-only-once rule in
// CLAUDE.md - then step back a whole number of pixels. `w >> 1` puts the run's
// MIDDLE COLUMN on `round(sx)`, which is the column the debug centre line
// (hbMid) draws, so the overlay runs straight down the middle glyph.
function centreTextX(sx, txt, scale) { return Math.round(sx) - (pixelTextWidth(txt, scale) >> 1); }

// How far right of the sprite's own centre the overhead stack is drawn. The
// frame is the 6 px level badge hard against the 16 px bar backing - 22 px in
// all - and it is the FRAME that has to be centred on the body, so the bars
// inside it sit three pixels right of the seam to leave the badge its room on
// the left. Centring the bars instead and letting the badge overhang put the
// whole plate three pixels off; the pink centre column under '.' (`hbMid`) is
// what both were measured against. The stun plate is deliberately NOT counted:
// it is a transient annex on the right, and sizing the resting frame around
// something that is usually absent is what made the plate lopsided before.
const FRAME_DX = 3;

// ALPHA'S BLOOD, worn: an amber ring of pips around the feet, rimmed dark
// so it reads on snow, that loses a pip at a time as the buff runs out -
// the ring IS the timer, and a full ring on a rival is the warning. The
// longest buff (the dire wolf's) fills every pip; the alpha's starts short.
const BUFF_RING = 12;                // pips round the ring
const BUFF_COL = '#ffb04a';          // the epic camp's own map ink
function drawBuffRing(p, cx, cy, now) {
  const n = Math.ceil(BUFF_RING * Math.min(1, p.buffT / CAMP_BUFF_EPIC_T));
  const pulse = 7 + ((now * 3) & 1); // breathes a pixel
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / BUFF_RING) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * pulse), y = Math.round(cy + Math.sin(a) * pulse * 0.6);
    ctx.fillStyle = '#0f1632'; ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = BUFF_COL; ctx.fillRect(x, y, 1, 1);
  }
}

function drawPlayer(p, ex, ey, now) {
  const local = p === player;
  const lying = p.prone;
  const set = lying ? classSet(p).prone[p.dir] : classSet(p)[p.dir];
  let frame = 0;
  if (lying) frame = p.moving ? 1 + (Math.floor(p.crawlT) % 2) : 0;
  else if (p.moving) frame = 1 + (Math.floor(p.animT) % 2);
  let spr = set[frame];
  // the fish catch: three DOWN-facing frames whatever the body faces
  // (catchFrame, js/tools.js). The hoist frame is 20 tall on the same feet,
  // which is what `sy` below pays for
  const catchF = !lying && p.fallT <= 0 && p.dodgeT <= 0 ? catchFrame(p) : -1;
  if (catchF >= 0) spr = classSet(p).catch[catchF];
  // the crawl inches: the second frame sits one pixel further along the facing
  // than the first, so the body hauls itself forward instead of flapping in
  // place. Baking two shifted copies of every grid would have said the same
  // thing at eight times the art.
  const ix = lying && frame === 2 ? (p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0) : 0;
  const iy = lying && frame === 2 ? (p.dir === 'up' ? -1 : p.dir === 'down' ? 1 : 0) : 0;
  const px = Math.round(p.x - 8 - ex) + ix;
  const py = Math.round(p.y - 12 - ey) + iy;
  // shadow (not while swimming in a hole, and not while lying down - a body
  // flat on the snow has nothing to cast one over, and the cover's own dark
  // lower rim is what grounds it instead)
  if (p.fallT <= 0 && !lying) {
    ctx.fillStyle = 'rgba(110,130,170,0.4)';
    ctx.fillRect(px + 5, py + 15, 6, 2);
  }
  if (p.buffT > 0 && p.fallT <= 0) drawBuffRing(p, Math.round(p.x - ex), Math.round(p.y - ey) + 3, now);
  if (lying && local) drawBuryRing(p, Math.round(p.x - ex), Math.round(p.y - ey) + 3);

  if (p.fallT > 0) {
    // plunged through the ice: quick sink, only the head above the waterline
    const sink = Math.round(Math.min(7, (HOLE_FALL_T - p.fallT) * 40));
    ctx.save();
    ctx.beginPath(); ctx.rect(px - 2, py - 8, 20, 20); ctx.clip();
    drawSpriteFlash(spr, px, py + sink, p.hurtT > 0.12 ? 1 : 0);
    ctx.restore();
    // ripple rings at the waterline
    ctx.fillStyle = 'rgba(207,228,242,0.75)';
    ctx.fillRect(px + 2, py + 11, 12, 1);
    ctx.fillRect(px + 4, py + 13, 8, 1);
  } else if (p.dodgeT > 0) {
    // dodge roll: full spin over the roll, trailing two afterimage ghosts.
    // Spin sign follows horizontal intent so side rolls tumble forward.
    const prog = 1 - p.dodgeT / DODGE_T;
    const sgn = p.dodgeVX < 0 ? -1 : p.dodgeVX > 0 ? 1 :
      p.dodgeVY < 0 ? -1 : 1;
    const vd = Math.hypot(p.dodgeVX, p.dodgeVY) || 1;
    const nx = p.dodgeVX / vd, ny = p.dodgeVY / vd;
    const rollSpr = classSet(p)[p.dir][0];
    const spin = (a, gx, gy) => {
      ctx.save();
      ctx.translate(Math.round(px + 8 + gx), Math.round(py + 8 + gy));
      ctx.rotate(a);
      ctx.drawImage(rollSpr, -8, -8);
      ctx.restore();
    };
    ctx.globalAlpha = 0.12; spin(sgn * (prog - 0.14) * Math.PI * 2, -nx * 11, -ny * 11);
    ctx.globalAlpha = 0.28; spin(sgn * (prog - 0.07) * Math.PI * 2, -nx * 6, -ny * 6);
    ctx.globalAlpha = 1; spin(sgn * prog * Math.PI * 2, 0, 0);
  } else {
    // a cast, the net shot's recoil hop or the rush lean is performed BY the
    // body: the pose shifts / tilts the sprite itself (abilityPose,
    // js/abilities.js), so an ability visibly happens to the model
    const pose = state.mode !== 'title' ? abilityPose(p) : null;
    const ax = px + (pose ? pose.dx : 0), ay = py + (pose ? pose.dy : 0);
    const sy = ay + (16 - spr.height); // a taller frame (the hoist) keeps its feet
    // deep in the treeline the viewed hero wears a black 1px rim so the body
    // pops off the faded canopy - treeFadeSil (render.js) is the occluder
    // fade's silhouette strength, 0 in the open, so the rim dissolves as the
    // hero leaves the trees. The current frame tints black on the scratch
    // canvas and stamps the eight neighbours, the same rim grammar as
    // drawPixelTextOutline. A lying body keeps its stealth read bare, and a
    // rotating cast pose skips the stamp rather than wear a stale rim.
    if (treeFadeSil > 0 && !lying && !(pose && pose.rot) && p === viewPlayer()) {
      sctx.clearRect(0, 0, 64, 64);
      sctx.globalCompositeOperation = 'source-over';
      sctx.drawImage(spr, 0, 0);
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = '#000';
      sctx.fillRect(0, 0, 64, 64);
      ctx.globalAlpha = treeFadeSil;
      for (let ry = -1; ry <= 1; ry++) for (let rx = -1; rx <= 1; rx++) {
        if (rx || ry) ctx.drawImage(scratch, 0, 0, 16, spr.height, ax + rx, sy + ry, 16, spr.height);
      }
      ctx.globalAlpha = 1;
    }
    // held tool: behind the body when facing away, in the hand otherwise. A
    // lying player shows one only while the bow is actually drawn - a carried
    // axe bobbing over a body on its belly reads as a floating axe. A body
    // mid-cast (or holding the shield, or charging) has no hand free for it.
    const held = state.mode !== 'title' && (!lying || p.charging) && catchF < 0 &&
      p.castT <= 0 && p.shieldT <= 0 && p.rushT <= 0;
    const toolBehind = held && p.dir === 'up' && !p.charging && p.swingT <= 0 && p.slashT <= 0; // a blade mid-sweep is always in front
    if (toolBehind) drawHeldTool(p, px, py);
    if (p.invuln > 0 && state.mode !== 'title' && ((now * 12) | 0) % 2 === 0) ctx.globalAlpha = 0.45;
    if (pose && pose.rot) {
      ctx.save();
      ctx.translate(ax + 8, ay + 8);
      ctx.rotate(pose.rot);
      drawSpriteFlash(spr, -8, -8, p.hurtT > 0.12 ? 1 : 0);
      ctx.restore();
    } else {
      drawSpriteFlash(spr, ax, sy, p.hurtT > 0.12 ? 1 : 0);
    }
    // gear marks sit at fixed points on the standing body plan, so the prone
    // poses skip them rather than stripe a shoulder across someone's hip
    if (state.mode !== 'title' && !lying && !(pose && pose.rot) && catchF < 0) drawGearMarks(p, ax, ay);
    ctx.globalAlpha = 1;
    if (held && !toolBehind) drawHeldTool(p, px, py);
    // what an ability left ON this body - shield, net, jaws, fury, mark -
    // drawn over the sprite for every side alike (js/abilities.js)
    if (state.mode !== 'title') drawAbilityOnPlayer(p, ax, ay, now);
    // and the snow goes on last, over body and bow alike
    if (lying && p.hide > 0) {
      drawSnowCover(p, spr, px, py, local ? 0.66 : p.team === player.team ? 0.85 : 1);
    }
  }

  if (state.mode === 'title') return;

  // Everything above the head is a tell, and a buried player gives none of
  // them away: name tag, both bars, the level badge and - the one that
  // matters - the draw meter that says a shot is coming all fade with the
  // cover. You keep a readable copy of your own, your side keeps most of
  // theirs, and a rival keeps nothing, which is the whole point of the thing.
  const cf = 1 - concealOf(p) * (local ? 0.55 : p.team === player.team ? 0.7 : 1);
  if (cf < 0.03) { ctx.globalAlpha = 1; return; }
  ctx.globalAlpha = cf;

  // the whole stack hangs off one y so it can drop with the body: a prone
  // pose starts ~6 rows lower in the same 16x16 cell, and bars floating where
  // a head no longer is look broken
  const hy = py + (lying ? 6 : 0) - (catchF === 2 ? 4 : 0); // the hoist holds the fish where the plate would sit
  // fx is the stack's own centre column - the body's, shifted by FRAME_DX so
  // the frame straddles the sprite. Everything in the frame hangs off it.
  const fx = Math.round(p.x - ex) + FRAME_DX;
  drawHealthBar(p.x - ex + FRAME_DX, hy - 7, p.hp, p.maxHp, 14, p.team);
  // level badge: a 7-tall plate sharing its right frame column with the bar
  // backing's left edge (fx-8: one 1px frame everywhere, never a doubled
  // wall), and spanning the health bar and the stamina bar stacked (hy-8 ..
  // hy-2) - the plate every animal wears too (drawLevelBadge)
  drawLevelBadge(fx - 8, hy - 8, p.level);
  // Every player carries a name tag in its team colour so a fight stays
  // legible - your own included: the profile name is what the rest of the
  // table sees over your head, and hiding it from you alone would make it
  // the one label in the game you cannot check.
  drawPixelTextOutline(ctx, p.name,
    centreTextX(p.x - ex, p.name), hy - 18, // clear of the draw meter's frame (top row hy-11) with a gap row
    TEAMS[skin(p.team)].mark, '#0f1632');
  // dodge stamina: one clean unsegmented WHITE bar under the health bar -
  // white on every side, since stamina has no side, and white is neither the
  // team's paint above it nor the gold of the draw - charges stay discrete
  // in the sim, the bar just shows the pooled total. Drawn for every player
  // (a rival out of rolls is a tell, and the level badge spans both bars, so
  // a lone hp bar would look broken).
  // The track is painted one row taller than the fill so the gap between the two
  // bars is track grey, not frame colour - one clean outline around both.
  {
    const bx = fx - 7, by = hy - 4;
    ctx.fillStyle = 'rgba(12,18,42,0.78)';
    ctx.fillRect(bx - 1, by, 16, 3); // rows under the hp backing only - the backing is translucent, so overlapping it would paint a darker row
    ctx.fillStyle = '#3a3448';
    ctx.fillRect(bx, by - 1, 14, 3);
    const regenP = p.dodgeCharges < DODGE_CHARGES ? 1 - p.dodgeRegenT / kitOf(p).dodgeCd : 0;
    const frac = (p.dodgeCharges + regenP) / DODGE_CHARGES;
    // ghost of the chunk just spent: pale segment that drains into place
    const gw = Math.round(14 * Math.max(frac, p.stamGhost)) - Math.round(14 * frac);
    if (gw > 0) {
      ctx.fillStyle = STAM_GHOST;
      ctx.fillRect(bx + Math.round(14 * frac), by, gw, 2);
    }
    ctx.fillStyle = STAM_COL;
    ctx.fillRect(bx, by, Math.round(14 * frac), 2);
  }
  // stunned: the mirror of the level badge on the other side of the frame -
  // same backing, same track, sharing its left frame column with the health
  // bar backing's right edge, so the stack still reads as one outline. The
  // sparks say what the state is and the track drains from the bottom as the
  // window runs out, which answers the only question a stun asks.
  //
  // Nothing is drawn here while nothing is stunning - an empty plate parked
  // over every head is a bar that is never a bar. That does mean the resting
  // frame is only the level badge plus the bars, 22 px spanning cx-14..cx+7,
  // sitting three pixels left of the sprite's own seam; turn the pink centre
  // column on under '.' (drawHitboxes) and you can see it. Fixing that by
  // shifting the badge and both bars 3 px right would take the BARS off the
  // body to square up a badge, and the frame would still grow rightwards the
  // moment a stun landed, so it is left as it is.
  if (p.stunT > 0) {
    const bx = fx + 8, by = hy - 8;
    ctx.fillStyle = 'rgba(12,18,42,0.78)';
    ctx.fillRect(bx, by, 6, 7); // 6 wide: the column to its left is the bar backing, already painted
    ctx.fillStyle = '#3a3448';
    ctx.fillRect(bx, by + 1, 5, 5);
    const h = Math.max(1, Math.round(5 * Math.min(1, p.stunT / Math.max(0.01, p.stunMax))));
    ctx.fillStyle = '#b06a14'; // bright enough to read as a fill against the track, dim enough to sit under the sparks
    ctx.fillRect(bx, by + 6 - h, 5, h);
    drawStunStars(bx + 2, by + 3, p, 1.5, 1);
  }
  // bow draw meter: gold while charging, blinking white and settling to
  // pale gold the moment the draw is full - brighter, never a new hue, so it
  // stays the bow's colour next to a red rival's bar. Drawn for everyone -
  // it is the tell that says a shot is coming. It sits inside the shared frame directly above the hp bar, the
  // mirror of the stamina bar below it: its backing adds the rows above the
  // hp backing (frame top at hy-11, fill hy-10..-9) and the hp backing's top
  // row hy-8 becomes the track-grey gap row, so the frame stays one outline.
  // The same slot carries the renock cooldown when the bow is not drawn, AND
  // the meal being chewed (js/core.js) - the three states of one pair of
  // hands, and never two at once, since a meal puts the bow down and blocks
  // the draw for its whole length. So one strip above a head answers the only
  // question a fight asks about it: gold filling = drawing (a shot is coming),
  // pale gold = it peaked, slate filling = reloading (it is not), pale gold
  // again for the instant it came back (the bow's own ready colour; white is
  // the stamina bar's), GREEN filling = eating (a heal is coming, and hitting
  // them takes it away).
  // All three use the identical geometry, so the bar never jumps when one
  // hands over to the next.
  if (p.eatT > 0 || p.charging || p.nockT > 0 || p.readyFlash > 0) {
    const eating = p.eatT > 0, drawing = p.charging;
    // the reload divides by toolCycle - the same span the well's wipe and the
    // reticle's marks read - so the slate fill starts at zero the frame the
    // shot leaves (dividing by the bare kit.nock sat it at 1 px for half the cycle)
    const frac = eating ? 1 - p.eatT / FOOD_EAT
      : drawing ? drawPow(p)
      : p.readyFlash > 0 ? 1 : 1 - p.nockT / Math.max(0.01, toolCycle(p));
    const x = fx - 7, y = hy - 10;
    ctx.fillStyle = 'rgba(12,18,42,0.78)';
    ctx.fillRect(x - 1, y - 1, 16, 3); // rows above the hp backing only (translucent - never overlap)
    ctx.fillStyle = '#3a3448';
    ctx.fillRect(x, y, 14, 3);         // fill rows + the gap row
    ctx.fillStyle = eating ? EAT_COL
      : !drawing ? (p.readyFlash > 0 ? DRAW_FULL_COL : NOCK_COL)
      : frac < 1 ? DRAW_COL
      : p.chargeT < kitOf(p).bowCharge + DRAW_FULL_FLASH ? '#ffffff' : DRAW_FULL_COL;
    ctx.fillRect(x, y, Math.max(1, Math.round(14 * frac)), 2);
  }
  ctx.globalAlpha = 1;
}

// The cover has to fit the pose it is covering, and the six prone poses are
// six different silhouettes - long and low side-on, wide-armed head-on - so
// the mound's row extents come from the sprite rather than from an ellipse
// that would leave a mitten sticking out of the snow. `spr.spans` is the
// per-row [firstX, lastX] that sprites.js takes off the char grid at bake time
// (see `bakeSpan`), so there is no canvas readback anywhere in this, and the
// cover stays correct on its own if the art is ever redrawn.
const poseSpans = new Map();
function poseBounds(spr) {
  let b = poseSpans.get(spr);
  if (b) return b;
  const raw = spr.spans || [];
  // dilate a row into its neighbours before storing: snow banked over a body
  // is a drift, not a traced outline, and taking the union of three rows both
  // rounds the jagged bits out and adds the row of piled snow above and below
  // the sprite that makes it sit IN the ground rather than on it
  b = [];
  for (let y = 0; y < 16; y++) {
    let lo = 99, hi = -1;
    for (let k = -1; k <= 1; k++) {
      const s = raw[y + k];
      if (s) { if (s[0] < lo) lo = s[0]; if (s[1] > hi) hi = s[1]; }
    }
    b.push(hi < 0 ? null : [lo, hi]);
  }
  b.raw = raw; // the body itself: the cover is never allowed to be narrower than this
  poseSpans.set(spr, b);
  return b;
}

// The snow pulled over a body, one row per row of the pose it sits on, each
// row a pixel wider than the body underneath so nothing peeks out at the
// edges. Coverage closes from the OUTSIDE IN - boots and elbows go first, the
// middle of the back last - so most of the way through there is still a seam
// of coat showing down the spine, and only at the very end does the shape
// become a lump in the snow. Row widths are roughened by hash2 against the
// tile, so it is a drift rather than a traced outline and it holds still
// instead of shimmering. Lit like every other drift here: pale crest along the
// top, shade along the bottom, and a dark rim under it doing the grounding
// that a prone body's missing cast shadow would have done.
function drawSnowCover(p, spr, px, py, alpha) {
  const h = Math.max(0, Math.min(1, p.hide));
  if (h <= 0) return;
  const rows = poseBounds(spr);
  const seed = ((p.x / TILE) | 0) * 31 + ((p.y / TILE) | 0) * 17;
  let first = -1, last = -1;
  for (let r = 0; r < 16; r++) if (rows[r]) { if (first < 0) first = r; last = r; }
  if (first < 0) return;
  ctx.globalAlpha = alpha;
  let botY = 0, botL = 0, botR = 0;
  for (let r = first; r <= last; r++) {
    const s = rows[r];
    if (!s) continue;
    // 1-2 px of piled snow past the body, pulled back in at the two ends so
    // the drift rounds off instead of ending in a square corner
    const edge = Math.min(r - first, last - r);
    const grow = 1 + Math.round(hash2(seed + r * 5, 91)) - (edge === 0 ? 3 : edge === 1 ? 1 : 0);
    // the taper must never pull the cover inside the body it is covering - a
    // pose that runs to the bottom of the cell (both head-on ones do) has no
    // spare row below it to round off into, and two boot pixels sticking out
    // of an otherwise finished mound is exactly the tell that ruins it
    const body = rows.raw[r];
    const lo = Math.min(px + s[0] - grow, body ? px + body[0] : Infinity);
    const hi = Math.max(px + s[1] + grow, body ? px + body[1] : -Infinity);
    if (hi < lo) continue;
    const hw = (hi - lo + 1) / 2, mid = (lo + hi + 1) / 2;
    const gap = Math.round(hw * (1 - h));                        // the open seam, closing as it fills
    if (gap >= hw) continue;
    const bw = Math.round(hw - gap), y = py + r;
    // a ramp down the mound, not three flat bands: the crest catches the light
    // the same way every drift in this world does and the far side falls into
    // shade, which is the only thing that makes a finished mound read as a
    // lump rather than as a patch of ground the same colour as the ground
    const u = (r - first) / Math.max(1, last - first);
    ctx.fillStyle = u < 0.14 ? '#ffffff' : u < 0.32 ? '#f8fbff' : u < 0.56 ? '#edf3fc'
      : u < 0.78 ? '#d8e4f2' : '#bfcee4';
    ctx.fillRect(Math.round(mid - hw), y, bw, 1);
    ctx.fillRect(Math.round(mid + gap), y, bw, 1);
    botY = y; botL = Math.round(mid - hw); botR = Math.round(mid + hw);
  }
  if (botR > botL) {
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = '#6e86ab';
    ctx.fillRect(botL + 1, botY + 1, botR - botL - 2, 1);
  }
  // two frost glints on the crest, fixed to the tile so they do not crawl
  if (h > 0.75) {
    ctx.globalAlpha = alpha * (0.5 + 0.5 * h);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 2; i++) {
      const gr = first + 1 + Math.floor(hash2(seed + i * 13, 67) * Math.max(1, last - first - 2));
      const s = rows[gr];
      if (!s) continue;
      ctx.fillRect(px + s[0] + 1 + Math.floor(hash2(seed + i * 13, 41) * Math.max(1, s[1] - s[0] - 1)), py + gr, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// The bury meter, local player only: twelve marks on a ring in the snow that
// light one at a time as the cover builds, then flash white and go. A rival's
// bury needs no meter - they can literally watch you disappear - and this one
// exists only because you cannot see your own back.
function drawBuryRing(p, cxp, cyp) {
  const done = p.hideFlash > 0;
  if (p.hide >= 1 && !done) return;
  const h = Math.min(1, p.hide);
  ctx.globalAlpha = done ? Math.min(1, p.hideFlash / 0.4) : 1;
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    const x = Math.round(cxp + Math.cos(a) * 14), y = Math.round(cyp + Math.sin(a) * 9);
    // a dark pixel under each mark, the same trick drawPixelTextOutline uses:
    // white on snow is white on white without something behind it
    ctx.fillStyle = 'rgba(14,22,50,0.55)';
    ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = done || i / 12 < h ? '#ffffff' : '#68799f';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

// an unfilled player: a flat team-tinted silhouette standing at its camp, so
// the world shows who is missing rather than pretending the player isn't there
function drawGhost(p, ex, ey) {
  const spr = classSet(p)[p.dir][0];
  const px = Math.round(p.x - 8 - ex), py = Math.round(p.y - 12 - ey);
  sctx.clearRect(0, 0, 32, 32);
  sctx.globalCompositeOperation = 'source-over';
  sctx.drawImage(spr, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = TEAMS[skin(p.team)].mark;
  sctx.fillRect(0, 0, 32, 32);
  ctx.globalAlpha = 0.22;
  ctx.drawImage(scratch, 0, 0, spr.width, spr.height, px, py, spr.width, spr.height);
  ctx.globalAlpha = 1;
}

// the held tool, drawn on a player: carried at the hand while idle or
// walking, swept along the arc during a melee swing, aimed at that player's
// aim point while the bow is drawn. px/py are the sprite's top-left on screen.
function drawHeldTool(p, px, py) {
  const t = SWING_TOOLS[p.swing];
  // At rest the hands hold the WEAPON on the selected slot, whose art carries
  // its own tier colour - so what somebody is carrying reads off their sprite
  // from across the snow, and an empty slot reads as empty hands. Mid-swing
  // (axe, pick) the swing tool's own 8x8 icon sweeps - and a draw running at
  // the same time (an auto swing, autoWork, chops under a draw) puts BOTH up:
  // one hand sweeps the axe, the other holds the drawn weapon on the aim.
  const weapon = heldTool(p);
  const wIcon = weapon ? SPRITES[ITEMS[weapon.type].icon] : null;
  const drawing = p.charging && !!wIcon;
  const swinging = t.key !== 'bow' && p.swingT > 0;
  const cxp = px + 8, cyp = py + 10; // roughly the hands

  // melee swing: sweep with the same arc the swing effect uses; the icons
  // point up, so + PI/2 aligns the head with the sweep direction
  if (swinging) {
    const icon = SPRITES[t.icon], half = icon.width >> 1;
    const prog = 1 - p.swingT / 0.18;
    const a = p.swingDir - 1.1 + prog * 2.2;
    ctx.save();
    ctx.translate(Math.round(cxp + Math.cos(a) * 9), Math.round(cyp - 2 + Math.sin(a) * 9));
    ctx.rotate(a + Math.PI / 2);
    ctx.drawImage(icon, -half, -half);
    ctx.restore();
  }

  // the weapon's art points its business end along TOOL_FWD (js/tools.js);
  // rotating by the aim (or the facing) minus that puts the arrowhead, the
  // sword's point or the sling's stone toward where its owner is looking
  const wDef = weapon ? TOOLS[toolIdOf(weapon.type)] : null;
  const fwd = wDef ? TOOL_FWD[wDef.art] || 0 : 0;
  // the blade at its real length, where the art has one (TOOL_HELD_ART,
  // js/tools.js); everything else is its bag icon
  const wHeld = wDef ? SPRITES['toolHeld_' + wDef.art + '_' + wDef.tier] || wIcon : null;

  // THE SWING: a blade mid-cut is swung through its whole wedge, pivoting at
  // the hands - the sword itself at the sweep's edge with two ghosts of it
  // trailing, so the arc the cut took is read off the weapon and not only off
  // the snow. Over everything, whichever way the body faces.
  if (p.slashT > 0 && wDef && wDef.melee && wHeld) {
    const half = wHeld.width >> 1;
    const prog = 1 - p.slashT / SLASH_T;
    const sw = Math.min(1, prog / 0.7); // the blade crosses in the first 70%, then hangs at the end of the arc
    const e = p.slashA - p.slashHalf + sw * p.slashHalf * 2;
    for (let k = 2; k >= 0; k--) {
      const t = e - k * 0.32 * sw;
      ctx.globalAlpha = k ? (k === 1 ? 0.4 : 0.18) * (1 - prog) : 1;
      ctx.save();
      ctx.translate(Math.round(cxp + Math.cos(t) * 5), Math.round(cyp - 2 + Math.sin(t) * 4));
      ctx.rotate(t - fwd);
      ctx.drawImage(wHeld, -half, -half);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    return;
  }

  // the drawn weapon tracks the aim. Drawn over the sweep: the shot about to
  // leave is the thing to read. A blade is drawn back to the START of its
  // arc, wound up, so the draw reads as the swing it is about to be.
  if (drawing) {
    const spr = wDef.melee ? wHeld : wIcon;
    const half = spr.width >> 1;
    const a = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x);
    const t = wDef.melee ? a - wDef.melee.half * (0.4 + 0.6 * drawPow(p)) : a;
    ctx.save();
    ctx.translate(Math.round(cxp + Math.cos(t) * (wDef.melee ? 4 : 8)), Math.round(cyp - 2 + Math.sin(t) * (wDef.melee ? 3 : 8)));
    ctx.rotate(t - fwd);
    ctx.drawImage(spr, -half, -half);
    ctx.restore();
  }
  if (drawing || swinging) return;

  // carried: the weapon (or, through the swing cooldown, the work tool) sits
  // in the leading hand, with a 1px walk bob, turned to the facing - a work
  // tool's icon points up and is left as drawn, the way it always was
  const icon = t.key === 'bow' ? wHeld : SPRITES[t.icon];
  if (!icon) return;
  const half = icon.width >> 1;
  const bob = p.moving ? Math.floor(p.animT) % 2 : 0;
  const hx = p.dir === 'left' || p.dir === 'up' ? px + 2 : px + 14; // the leading hand (up: the far one, occluded by the body - the caller draws us first)
  const hy = cyp - (p.dir === 'left' || p.dir === 'right' ? 2 : 1) + bob;
  if (t.key !== 'bow') { ctx.drawImage(icon, hx - half, hy - half); return; }
  const face = p.dir === 'right' ? 0 : p.dir === 'down' ? Math.PI / 2 : p.dir === 'left' ? Math.PI : -Math.PI / 2;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(face - fwd);
  ctx.drawImage(icon, -half, -half);
  ctx.restore();
}
