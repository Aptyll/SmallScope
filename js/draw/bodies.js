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
  const big = isBigBeast(a);       // a bear: everything about its frame is wider
  const spr = clipFrame(SPRITES[a.kind][a.dir], a);
  const px = Math.round(a.x - spr.width / 2 - ex);
  const py = Math.round(a.y + 4 - spr.height - ey);
    drawCastShade(spr, px, py); // the sun's shade, cut from this frame (ground.js)
  drawSpriteFlash(spr, px, py, a.flash);
  // netted, snared, alight, marked: the same four tells a player wears, at
  // this body's size (drawUnitStates, js/abilities.js). `top` (a bear's
  // frames) is the headroom its rear-up needs over the standing head: the
  // tells sit on the standing body, not on the box
  const ty = py + (spr.top || 0);
  drawUnitStates(a, px, ty, spr.width, spr.height - (spr.top || 0), now);
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
  // The frame centres on the SPRITE's own columns (px, already rounded), not
  // on a.x: a wolf's 16-wide body under an 11-wide bar rounded the two
  // halves apart, and the bar shivered a pixel against the body as it ran.
  const bw = rabbit ? 8 : big ? 24 : wolf ? 11 : 17; // widths that split into even segments (hpSegCount)
  const cx = px + spr.width / 2, mid = px + (spr.width >> 1);
  const bx = Math.round(cx - bw / 2); // the bars' own left column (drawHealthBar's x)
  // The frame stands still over the TALLEST pose any clip reaches (`crown`,
  // a bear's rear-up), never over the frame now playing: a bar that rode the
  // roar up and down would jump, and one on the standing head is buried by it
  const fy = py + (spr.crown || 0);
  overheadPlate(() => {
    drawHealthBar(cx, fy - 8, a.hp, a.maxHp, bw, undefined, undefined, a);
    if (wolf) drawHealthBar(cx, fy - 5, a.threat, 1, bw, undefined, THREAT_COL);
    else drawHealthBar(cx, fy - 5, rabbit ? a.dodge : a.sprint, 1, bw, undefined, STAM_COL);
    drawLevelBadge(bx - 1, fy - 9, a.level);
    if (a.stunT > 0) drawStunStars(mid, fy - 13, a, 4);
    else if (a.senseT > 0) drawSenseMark(mid, fy - 16, a, wolf ? THREAT_COL : STAM_COL);
  });
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

  drawCastShade(spr, bx, by + bob); // on the ground under the bob

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
  drawHealthBar(b.x - ex, by - 4, b.hp, b.maxHp, 8, b.team, undefined, b);
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
  drawCastShade(spr, px, py); // stays on the snow through a hop
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
  drawWorldText('MERCH', centreTextX(b.x - ex, 'MERCH'), py - 17 - lift, TEAMS[skin(b.team)].mark);
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
  { y: 3, x: 5, w: 6, lean: true }, // helmet: across the hat/hood
  { y: 8, x: 5, w: 6 },          // chest: across the coat
  { y: 11, x: 5, w: 6 },         // legs: across the hips
  { y: 13, x: 5, w: 2, x2: 9 },  // boots: one mark per foot
];
// s scales the whole 16x16 grid the marks are authored on: 1 in the world,
// 3 on the victory screen's stage. On a run (`running`) the body has the
// doll's frames under it: their feet are never where the standing ones are,
// so the boots' marks are left off, and the head leans `lean` px along a
// side-on facing, so the helmet's mark goes with it.
function drawGearMarks(p, px, py, s, running, lean) {
  s = s || 1;
  for (let i = 0; i < GEAR_MARKS.length; i++) {
    const lv = p.gearLv[i];
    if (lv < 2) continue;
    const m = GEAR_MARKS[i];
    if (running && m.x2 !== undefined) continue;
    const x = px + (m.x + (running && m.lean ? lean : 0)) * s;
    ctx.fillStyle = GEAR_MATS[lv - 1];
    ctx.fillRect(x, py + m.y * s, m.w * s, s);
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
// longest buff (a bear's) fills every pip.
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

// A worn body (scoutBody, js/ui/skins.js) stands in for the class body while
// upright: its idle breathes on the clock at ROBOT_IDLE_FPS, its run steps on
// the stride. It is twice a player's height, so what the class body wears at
// its hands and over itself (the held tool, an ability's shield or net) is
// drawn at WORN_SC about the feet to fit it. The sim's body is the same.
const ROBOT_IDLE_FPS = 5;
const WORN_SC = 2;
function atFeet(x, y, sc, fn) {
  if (sc === 1) { fn(); return; }
  ctx.save();
  ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y);
  fn();
  ctx.restore();
}

// The class body's run and dodge roll are the doll's frames (js/sprites/motion.js,
// baked in every paint by characters.js), each wider than the 16x16 cell, which
// sits at SPRITES.motionBox's (x, y) inside it. The run plays RUN_STEP frames per
// step of animT - eight frames, two steps, 18 a second at a walk's 9 - and a roll
// frame is picked off how far through DODGE_T the roll is (SPRITES.rollAt).
const RUN_STEP = 2;
function runFrame(p) { return Math.floor(p.animT * RUN_STEP) % SPRITES.runBob.length; }
// A body whose hands are busy - a drawn weapon, a swing, a meal, a cast, the
// shield up, the grapple's rope - runs on the held run instead, its arms at its
// sides rather than pumping under what they hold. runBob is the bob of the
// frame on show, whole px up, for what rides the body.
function handsBusy(p) {
  return p.charging || p.swingT > 0 || p.slashT > 0 || p.eatT > 0 || p.castT > 0 || p.shieldT > 0 || p.grapT > 0;
}
function runBob(p) { return (handsBusy(p) ? SPRITES.holdBob : SPRITES.runBob)[runFrame(p)]; }
function rollFrame(prog) {
  const at = SPRITES.rollAt;
  let i = 0;
  while (i + 1 < at.length && prog >= at[i + 1]) i++;
  return i;
}

function drawPlayer(p, ex, ey, now) {
  const local = p === player;
  const lying = p.prone;
  const set = lying ? classSet(p).prone[p.dir] : classSet(p)[p.dir];
  let frame = 0;
  // upright, a body strides only while it covers ground on its own feet - the
  // sim's own test for stepping animT on (updatePlayer, js/sim.js) - so a
  // shift-slide and a push against a wall stand, and a zipline's rider hangs still
  const striding = p.moving && p.zip < 0 && !p.sliding && Math.hypot(p.vx, p.vy) > 8;
  if (lying) frame = p.moving ? 1 + (Math.floor(p.crawlT) % 2) : 0;
  else if (striding) frame = 1 + (Math.floor(p.animT) % 2);
  // a zipline's rider: the body ZIP_ALT rows up, the shadow where it always
  // is - the rope and handle over its head are the cable pass's (drawZips)
  const zl = p.zip >= 0 ? ZIP_ALT : 0;
  let spr = set[frame];
  // the fish catch: three DOWN-facing frames whatever the body faces
  // (catchFrame, js/tools.js). The hoist frame is 20 tall on the same feet,
  // which is what `sy` below pays for
  const catchF = !lying && p.fallT <= 0 && p.dodgeT <= 0 ? catchFrame(p) : -1;
  if (catchF >= 0) spr = classSet(p).catch[catchF];
  // ...or the worn body: lying and the catch keep the class body, which has
  // the only poses for them
  const rb = !lying && catchF < 0 ? scoutBody(p) : null;
  if (rb) {
    const c = rb[p.dir];
    spr = frame > 0 ? c.run[Math.floor(p.animT) % c.run.length] : c.idle[Math.floor(now * ROBOT_IDLE_FPS) % c.idle.length];
  }
  // ...and a class body on the move runs: the doll's eight frames (runFrame)
  const running = frame > 0 && !lying && catchF < 0 && !rb && p.fallT <= 0;
  if (running) spr = classSet(p)[handsBusy(p) ? 'hold' : 'run'][p.dir][runFrame(p)];
  const MB = SPRITES.motionBox;
  // the crawl inches: the second frame sits one pixel further along the facing
  // than the first, so the body hauls itself forward instead of flapping in
  // place. Baking two shifted copies of every grid would have said the same
  // thing at eight times the art.
  const ix = lying && frame === 2 ? (p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0) : 0;
  const iy = lying && frame === 2 ? (p.dir === 'up' ? -1 : p.dir === 'down' ? 1 : 0) : 0;
  const px = Math.round(p.x - 8 - ex) + ix;
  const py = Math.round(p.y - 12 - ey) + iy;
  // where the frame's top-left sits: a class frame fills the 16x16 cell (a
  // taller one keeps its feet on the cell's floor, a doll frame holds the cell
  // at motionBox's x, y); a worn body is centred on the cell with its soles on
  // the cell's bottom row
  const bx = rb ? px + 8 - (spr.width >> 1) : running ? px - MB.x : px;
  const by = rb ? py + 15 - rb.foot : running ? py - MB.y : py + 16 - spr.height;
  const wsc = rb ? WORN_SC : 1, fx0 = px + 8, fy0 = py + 16; // what the hands hold grows about the feet
  // shadow (not while swimming in a hole, and not while lying down - a body
  // flat on the snow has nothing to cast one over, and the cover's own dark
  // lower rim is what grounds it instead)
  if (p.fallT <= 0 && !lying) {
    // the sun's shade, cut from the frame on show (ground.js), feet on the
    // foot row: a roll's own frame, so the ball goes over its own shadow - but
    // a worn body's standing frame through its spin, which would smear it
    const roll = p.dodgeT > 0;
    if (roll && !rb) drawCastShade(classSet(p).roll[p.dir][rollFrame(1 - p.dodgeT / DODGE_T)], px - MB.x, py - MB.y);
    else {
      const ss = roll ? rb[p.dir].idle[0] : spr;
      drawCastShade(ss, bx, rb || running ? by : py + 16 - ss.height);
    }
  }
  if (p.buffT > 0 && p.fallT <= 0) drawBuffRing(p, Math.round(p.x - ex), Math.round(p.y - ey) + 3, now);
  if (lying && local) drawBuryRing(p, Math.round(p.x - ex), Math.round(p.y - ey) + 3);

  if (p.fallT > 0) {
    // plunged through the ice: quick sink, only the head above the waterline
    const sink = Math.round(Math.min(7, (HOLE_FALL_T - p.fallT) * 40)) * wsc;
    ctx.save();
    ctx.beginPath(); ctx.rect(bx - 2, by - 8, spr.width + 4, py + 12 - (by - 8)); ctx.clip();
    drawSpriteFlash(spr, bx, by + sink, p.hurtT > 0.12 ? 1 : 0);
    ctx.restore();
    // ripple rings at the waterline
    ctx.fillStyle = 'rgba(207,228,242,0.75)';
    ctx.fillRect(px + 2, py + 11, 12, 1);
    ctx.fillRect(px + 4, py + 13, 8, 1);
  } else if (p.dodgeT > 0) {
    // dodge roll, trailing two afterimages of where the roll just was
    const prog = 1 - p.dodgeT / DODGE_T;
    const vd = Math.hypot(p.dodgeVX, p.dodgeVY) || 1;
    const nx = p.dodgeVX / vd, ny = p.dodgeVY / vd;
    if (rb) {
      // a worn body has no tuck of its own: its standing frame spins a full
      // turn, the spin's sign following horizontal intent so side rolls
      // tumble forward
      const sgn = p.dodgeVX < 0 ? -1 : p.dodgeVX > 0 ? 1 : p.dodgeVY < 0 ? -1 : 1;
      const rollSpr = rb[p.dir].idle[0];
      const rw = rollSpr.width >> 1, rh = (rb.foot + 1 - rb.top) >> 1, ry0 = rb.foot + 1 - rh;
      const spin = (a, gx, gy) => {
        ctx.save();
        ctx.translate(Math.round(px + 8 + gx), Math.round(py + 16 - rh + gy)); // spun about the body's middle
        ctx.rotate(a);
        ctx.drawImage(rollSpr, -rw, -ry0);
        ctx.restore();
      };
      ctx.globalAlpha = 0.12; spin(sgn * (prog - 0.14) * Math.PI * 2, -nx * 11, -ny * 11);
      ctx.globalAlpha = 0.28; spin(sgn * (prog - 0.07) * Math.PI * 2, -nx * 6, -ny * 6);
      ctx.globalAlpha = 1; spin(sgn * prog * Math.PI * 2, 0, 0);
    } else {
      // the class body goes down into a crouch, dives, tucks into a ball that
      // turns over once, and comes up out of a squat - the doll's frames, lit
      // from where the sun is rather than spun with it. Each afterimage wears
      // the frame the roll showed where it is drawn.
      const fr = classSet(p).roll[p.dir];
      const at = (pr, back) => ctx.drawImage(fr[rollFrame(pr)],
        px - MB.x - Math.round(nx * back), py - MB.y - Math.round(ny * back));
      if (prog >= 0.14) { ctx.globalAlpha = 0.12; at(prog - 0.14, 11); }
      if (prog >= 0.07) { ctx.globalAlpha = 0.28; at(prog - 0.07, 6); }
      ctx.globalAlpha = 1; at(prog, 0);
    }
  } else {
    // a cast, the net shot's recoil hop or the rush lean is performed BY the
    // body: the pose shifts / tilts the sprite itself (abilityPose,
    // js/abilities.js), so an ability visibly happens to the model
    const pose = state.mode !== 'title' ? abilityPose(p) : null;
    const ax = px + (pose ? pose.dx : 0), ay = py + (pose ? pose.dy : 0) - zl;
    const sy = ay + by - py, sx = ax + bx - px; // a taller frame (the hoist) keeps its feet
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
        if (rx || ry) ctx.drawImage(scratch, 0, 0, spr.width, spr.height, sx + rx, sy + ry, spr.width, spr.height);
      }
      ctx.globalAlpha = 1;
    }
    // held tool: behind the body when facing away, in the hand otherwise. A
    // lying player shows one only while the bow is actually drawn - a carried
    // axe bobbing over a body on its belly reads as a floating axe. A body
    // mid-cast (or holding the shield, or charging) has no hand free for it.
    const held = state.mode !== 'title' && (!lying || p.charging) && catchF < 0 &&
      p.castT <= 0 && p.shieldT <= 0 && p.rushT <= 0 && p.zip < 0; // ...or holding a zipline's handle
    const toolBehind = held && p.dir === 'up' && !p.charging && p.swingT <= 0 && p.slashT <= 0; // a blade mid-sweep is always in front
    if (toolBehind) atFeet(fx0, fy0, wsc, () => drawHeldTool(p, px, py));
    if (p.invuln > 0 && state.mode !== 'title' && ((now * 12) | 0) % 2 === 0) ctx.globalAlpha = 0.45;
    if (pose && pose.rot) {
      ctx.save();
      // turned about the body's middle: a worn body's own, or the cell's for a
      // class frame (a doll frame is wider than the cell it holds)
      const hw = rb ? spr.width >> 1 : 8, hh = rb ? rb.foot + 1 - ((rb.foot + 1 - rb.top) >> 1) : 8;
      const ox = rb ? sx : ax, oy = rb ? sy : ay;
      ctx.translate(ox + hw, oy + hh);
      ctx.rotate(pose.rot);
      drawSpriteFlash(spr, sx - ox - hw, sy - oy - hh, p.hurtT > 0.12 ? 1 : 0);
      ctx.restore();
    } else {
      drawSpriteFlash(spr, sx, sy, p.hurtT > 0.12 ? 1 : 0);
    }
    // gear marks sit at fixed points on the standing body plan, so the prone
    // poses skip them rather than stripe a shoulder across someone's hip; a
    // running body carries them up and down its bob, and side-on leans the
    // head a pixel into the run
    if (state.mode !== 'title' && !lying && !(pose && pose.rot) && catchF < 0 && !rb) {
      drawGearMarks(p, ax, ay - (running ? runBob(p) : 0), 1, running,
        p.dir === 'right' ? 1 : p.dir === 'left' ? -1 : 0);
    }
    ctx.globalAlpha = 1;
    if (held && !toolBehind) atFeet(fx0, fy0, wsc, () => drawHeldTool(p, px, py));
    // what an ability left ON this body - shield, net, jaws, fury, mark -
    // drawn over the sprite for every side alike (js/abilities.js)
    if (state.mode !== 'title') atFeet(fx0, fy0, wsc, () => drawAbilityOnPlayer(p, ax, ay, now));
    if (zl) drawZipHandle(p, Math.round(p.x - ex), sy, ey); // the handle over the head and the rope up to the cable (js/draw/zipline.js)
    // and the snow goes on last, over body and bow alike
    if (lying && p.hide > 0) {
      drawSnowCover(p, spr, px, py, local ? 0.66 : p.team === player.team ? 0.85 : 1);
    }
  }

  // ...and neither the title's living world nor an end screen's frozen one
  // wears any of the tells below: both are compositions somebody is looking
  // AT rather than a match somebody is reading, and a name plate with a
  // health bar under it floating through the ceremony is the HUD showing up
  // to a party it was not invited to (endScreen, js/ui/screens.js)
  if (state.mode === 'title' || endScreen()) return;

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
  const hy = py + (lying ? 6 : 0) - (catchF === 2 ? 4 : 0) - (zl ? zl + 5 : 0) + // the hoist holds the fish where the plate would sit; a rider's frame rises with it and clears the handle
    (rb ? by + rb.top - py : 0); // ...and a worn body's frame sits on its taller head
  // fx is the stack's own centre column - the body's, shifted by FRAME_DX so
  // the frame straddles the sprite. Everything in the frame hangs off it.
  const fx = Math.round(p.x - ex) + FRAME_DX;
  // a dawn shield (pickSnowdrop, js/actions.js) adds its own row straight
  // above the hp bar, and everything that sat above the bar - the draw meter,
  // the name, a callout - stands SHIELD_LIFT rows higher while it holds
  const lift = p.dawnShield > 0 ? SHIELD_LIFT : 0;
  callTag(p, Math.round(p.x - ex), hy - 18 - lift); // a bot's callout hangs over the name (js/draw/callouts.js)
  // the whole frame, name included, is one plate stamped over the grade
  // (overheadPlate, js/draw/light.js), so it reads the same in any light and
  // nothing standing in front of the body cuts into it
  overheadPlate(() => {
    drawHealthBar(p.x - ex + FRAME_DX, hy - 7, p.hp, p.maxHp, 14, p.team);
    if (lift) drawShieldBar(fx - 7, hy - 10, p.dawnShield);
    // the running damage total, past the frame's right edge: the bar backing,
    // the colour-blind cap or the stun plate, whichever stands furthest out
    queueTally(p, fx + 8 + (p.stunT > 0 ? 6 : foeCue(p.team) ? 1 : 0), hy - 6, barCol(p.team));
    // level badge: a 7-tall plate sharing its right frame column with the bar
    // backing's left edge (fx-8: one 1px frame everywhere, never a doubled
    // wall), and spanning the health bar and the stamina bar stacked (hy-8 ..
    // hy-2) - the plate every animal wears too (drawLevelBadge)
    drawLevelBadge(fx - 8, hy - 8, p.level);
    // Every player carries a name tag in its team colour so a fight stays
    // legible - your own included: the profile name is what the rest of the
    // table sees over your head, and hiding it from you alone would make it
    // the one label in the game you cannot check.
    drawWorldText(p.name,
      centreTextX(p.x - ex, p.name), hy - 18 - lift, // clear of the draw meter's frame (top row hy-11) with a gap row
      TEAMS[skin(p.team)].mark);
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
      ctx.fillStyle = BAR_FRAME;
      ctx.fillRect(bx - 1, by, 16, 3); // rows under the hp backing only
      ctx.fillStyle = BAR_TRACK;
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
      ctx.fillStyle = BAR_FRAME;
      ctx.fillRect(bx, by, 6, 7); // 6 wide: the column to its left is the bar backing, already painted
      ctx.fillStyle = BAR_TRACK;
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
      const x = fx - 7, y = hy - 10 - lift;
      ctx.fillStyle = BAR_FRAME;
      ctx.fillRect(x - 1, y - 1, 16, 3); // rows above the hp backing only
      ctx.fillStyle = BAR_TRACK;
      ctx.fillRect(x, y, 14, 3);         // fill rows + the gap row
      ctx.fillStyle = eating ? EAT_COL
        : !drawing ? (p.readyFlash > 0 ? DRAW_FULL_COL : NOCK_COL)
        : frac < 1 ? DRAW_COL
        : p.chargeT < drawTime(p) + DRAW_FULL_FLASH ? '#ffffff' : DRAW_FULL_COL;
      ctx.fillRect(x, y, Math.max(1, Math.round(14 * frac)), 2);
    }
  });
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
  // in the leading hand, riding the run's bob, turned to the facing - a work
  // tool's icon points up and is left as drawn, the way it always was. A worn
  // body keeps the old one-pixel step.
  const icon = t.key === 'bow' ? wHeld : SPRITES[t.icon];
  if (!icon) return;
  const half = icon.width >> 1;
  const bob = !p.moving || p.prone ? 0 : scoutBody(p) ? Math.floor(p.animT) % 2 : -runBob(p);
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

// ---- going down -----------------------------------------------------------
// A body that drops does not blink out. For DOWN_T it either FREEZES - a
// white flash, ice, a crack, then 3x3 shards that fly and fall - or is BLOWN
// AWAY, a pixel at a time from the hat down, each one paling to snow as the
// wind takes it. Which of the two is hash2(id, deaths), so every screen, and
// the recap that ends on it, sees the same fall. Drawn only: the sim let the
// body go in die() (player.js), and this keys off the edge of p.dead as this
// machine sees it, so a client that never runs the sim plays it too.
const DOWN_T = 0.6;                   // s, the whole fall
const DOWN_FLASH = 0.06;              // s of white before either one starts
const DOWN_ICE = ['#2c4a7a', '#4f7fb8', '#86b6e4', '#c6e6fb', '#f4fbff']; // dark to light, by the pixel's own lightness
const DOWN_CRACK = [[8, 3], [7, 4], [7, 5], [8, 6], [9, 7], [9, 8], [8, 9], [6, 7], [5, 8], [10, 5], [11, 4]];
const downs = new Map();              // player -> the fall it is on
const downWas = new Map();            // player -> dead as of the last frame
const downPxOf = new WeakMap();       // frame -> its opaque pixels, read once

function downPixels(spr) {
  let px = downPxOf.get(spr);
  if (px) return px;
  sctx.clearRect(0, 0, 32, 32);
  sctx.globalCompositeOperation = 'source-over';
  sctx.drawImage(spr, 0, 0);
  const d = sctx.getImageData(0, 0, spr.width, spr.height).data;
  px = [];
  for (let y = 0; y < spr.height; y++) for (let x = 0; x < spr.width; x++) {
    const i = (y * spr.width + x) * 4;
    if (!d[i + 3]) continue;
    const lum = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 256;
    px.push({ x, y, col: 'rgb(' + d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ')', ice: DOWN_ICE[Math.min(4, (lum * 5) | 0)] });
  }
  downPxOf.set(spr, px);
  return px;
}

// once a frame, before the draw list: start a fall on every body that went
// down since the last frame, and let finished ones go. A body already dead
// when this machine first saw it (a loaded save, a late join) gets none.
function trackDowns(now) {
  for (const p of players) {
    if (p.dead && downWas.get(p) === false && p.active) {
      downs.set(p, { t0: now, x: p.x, y: p.y, spr: classSet(p)[p.dir][0], wind: hash2(p.id, p.deaths) < 0.5, k: p.deaths });
      tallyFall(p); // a one-shot never wore its total: it floats off from where the frame stood
    }
    if (!p.dead) downs.delete(p);
    downWas.set(p, p.dead);
  }
  for (const [p, d] of downs) if (now - d.t0 >= DOWN_T) downs.delete(p);
}
function goingDown(p) { return downs.has(p); }

function drawDown(p, ex, ey, now) {
  const d = downs.get(p), t = now - d.t0;
  const ox = Math.round(d.x - 8 - ex), oy = Math.round(d.y - 12 - ey);
  const px = downPixels(d.spr), h = d.spr.height;
  const dot = (col, x, y) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  if (t < DOWN_FLASH) { for (const q of px) dot('#ffffff', ox + q.x, oy + q.y); return; }
  if (d.wind) {
    // head first: a pixel lets go by its row, give or take a little, and
    // drifts downwind and up, colour to pale to white, then gone
    const tt = t - DOWN_FLASH, dir = hash2(p.id + 7, d.k) < 0.5 ? -1 : 1;
    px.forEach((q, i) => {
      const r1 = hash2(i, d.k), r2 = hash2(i + 101, d.k);
      const q0 = (q.y / h) * 0.26 + r1 * 0.04;
      if (tt < q0) { dot(q.col, ox + q.x, oy + q.y); return; }
      const a = tt - q0;
      if (a > 0.24) return;
      dot(a < 0.05 ? q.col : a < 0.12 ? '#c6d6ee' : '#ffffff',
        ox + q.x + dir * a * (60 + r2 * 50), oy + q.y - a * (18 + r1 * 20) + Math.sin(a * 30 + i) * 1.2);
    });
    return;
  }
  // frozen: ice, the crack once it has set, then the shards
  const SHATTER = 0.32;
  if (t < SHATTER) {
    for (const q of px) dot(q.ice, ox + q.x, oy + q.y);
    if (t > 0.2) for (const [cx, cy] of DOWN_CRACK) if (px.some(q => q.x === cx && q.y === cy)) dot('#ffffff', ox + cx, oy + cy);
    return;
  }
  const tt = t - SHATTER, w = d.spr.width;
  for (const q of px) {
    const bx = (q.x / 3) | 0, by = (q.y / 3) | 0;
    const vx = (bx * 3 + 1.5 - w / 2) * 5 + (hash2(bx, by + d.k * 16) - 0.5) * 20;
    const vy = -30 - hash2(by, bx + d.k * 16) * 30;
    const y = oy + q.y + vy * tt + 220 * tt * tt;
    if (y > oy + h + 1 || tt > 0.26) continue; // a shard that has reached the snow is gone, and the last of them with the fall
    dot(q.ice, ox + q.x + vx * tt, y);
  }
}
