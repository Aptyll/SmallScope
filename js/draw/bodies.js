'use strict';
// A body in the world: a beast on its clip, a robot, the merchant, and the
// player - buff ring, pose bounds, snow cover, burial, the
// ghost, the held tool. Every walking thing's sprite pass ends up here.
// ---- beasts, robots and the merchant --------------------------------------
// The frame a beast is on: the clip it put itself in (ANIM_CLIPS,
// js/sim/wildlife.js - a graze, a gallop, a sit-up) and how far into it, wrapped
// the long way round so any animT lands on a frame rather than off the end.
function clipFrame(set, a) {
  const clip = set[a.clip] || set.idle;
  const i = Math.floor(a.animT || 0) % clip.length;
  return clip[i < 0 ? i + clip.length : i];
}

function drawAnimal(a, ex, ey, now) {
  const spr = clipFrame(SPRITES[a.kind][a.dir], a);
  const px = Math.round(a.x - spr.width / 2 - ex);
  const gy = Math.round(a.y + 4 - spr.height - ey);
  drawCastShade(spr, px, gy); // the sun's shade, cut from this frame (ground.js), on the ground under a leap
  const py = gy - rideLift(a); // a ridden deer's leap lifts it off its shade (js/sim/wildlife.js)
  const lit = spr.width <= 120 ? bodyLayerOpen(px + (spr.width >> 1), py + spr.height, (spr.width >> 1) + 4, spr.height + 4) : null; // keeps its light at night (js/draw/light.js)
  drawSpriteFlash(spr, px, py, a.flash);
  // netted, snared, alight, marked: the same four tells a player wears, at
  // this body's size (drawUnitStates, js/draw/abilities.js). `top` (a bear's
  // frames) is the headroom its rear-up needs over the standing head: the
  // tells sit on the standing body, not on the box
  const ty = py + (spr.top || 0);
  drawUnitStates(a, px, ty, spr.width, spr.height - (spr.top || 0), now);
  bodyLayerClose(lit);
  // The frame centres on the SPRITE's own columns (px, already rounded), not
  // on a.x: a wolf's 16-wide body under an 11-wide bar rounded the two
  // halves apart, and the bar shivered a pixel against the body as it ran.
  // It stands still over the tallest pose its clips reach (`crown`; a bear's
  // roar is the one it lets pass behind it), never over the frame now
  // playing: a bar that rode the poses up and down would jump
  const fy = py + (spr.crown || 0);
  // a ridden deer's bar is its rider's: one row under theirs, in their
  // side's colour (drawPlayer), so the two read as one frame
  if (a.rider) return;
  const two = a.summon ? a.life / a.lifeMax : isCampKind(a.kind) ? a.threat : a.kind === 'rabbit' ? a.dodge : a.sprint; // a summon's: the hunt's time left
  overheadPlate(() => drawBeastFrame(a.kind, px + spr.width / 2, px + (spr.width >> 1), fy, a, two, a, now));
}

// The player's frame, on a beast: health on top, always, the second bar
// hung 3 rows under it the way a player's stamina hangs under the health,
// the two sharing a wall, and the level badge on the left spanning both -
// the same plate a hero wears (drawLevelBadge), because the number means
// the same thing over either. The second bar is always worn: a wolf's
// threat, bare track at rest and filling from the first flicker of
// interest to the full bar it charges on (updateWolf, js/sim/wildlife.js); a
// deer's sprint and a rabbit's jink charge (updatePrey) in stamina white -
// each is one, spent on the run and on the dash. On its right, the status
// plate while a control holds it (drawStatusPlate); over it, the noticed mark
// unless it is stunned. The bar's width is the kind's
// (beastFrame): BEAST_BAR_W, or a camp monster's own `frame` row - a bear's
// is drawn at its body's 2x, cut into fixed `segs`, and centred whole,
// plate and bar together, on its body. `cx` is the body's centre, `mid` its
// centre column, `fy` the row the frame stands on; drawAnimal's in the
// world and the wiki's cards (ui/wiki.js) are the same pixels.
const BEAST_BAR_W = { rabbit: 8, wolf: 11, deer: 23 }; // widths that split into even segments (hpSegCount)
function beastFrame(kind) { return (MONSTER[kind] && MONSTER[kind].frame) || { s: 1, w: BEAST_BAR_W[kind] || 17 }; }
function drawBeastFrame(kind, cx, mid, fy, e, two, u, now) {
  const F = beastFrame(kind), k = F.s, camp = isCampKind(kind);
  const bc = F.centre ? mid + levelBadgeW(e.level) * k / 2 : cx; // the bar's centre: the plate's half off a centred frame's
  const bx = Math.round(bc - F.w * k / 2);                       // the bar's own left column (drawHealthBar's x)
  // a hero's summon (HERO_SUMMON) wears its side's bar, so it is never taken for a den's
  const st = statusOf(e), team = e.summon ? e.team : undefined;
  // a plate's total stands past the plate, where a player's does (drawPlayer)
  drawHealthBar(bc, fy - 8 * k, e.hp, e.maxHp, F.w, team, undefined, st ? undefined : u, k, F.segs);
  drawHealthBar(bc, fy - 5 * k, two, 1, F.w, undefined, camp ? THREAT_COL : STAM_COL, undefined, k);
  drawLevelBadge(bx - k, fy - 9 * k, e.level, k);
  if (st) {
    drawStatusPlate(bx + (F.w + 1) * k, fy - 10 * k, e, st, k); // its left column the bar backing's right wall
    if (u) queueTally(u, bx + (F.w + 1 + STATUS_W) * k, fy - 7 * k, barCol(team));
  }
  // the noticed mark over the head, unless its stunned plate says it is seeing nothing
  if (e.senseT > 0 && !(e.stunT > 0)) drawSenseMark(mid, fy - 16 * k, e, camp ? THREAT_COL : STAM_COL, k);
  // a hero's marks on it (HERO_OVER) stand over all of that: the '!' tops the stack at fy - 16k
  if (now !== undefined) heroOver(e, mid, fy - 16 * k - 5, now);
}

// A bot (a wave's soldier): one sprite, two tread frames. The whole thing
// bobs 1px while driving so body and tread never part. No face, and nothing
// carried: the states are the tread rolling and, for a melee soldier, the
// chassis itself ramming a foe (soldierRam).
// a melee soldier's blow, in whole px along the line to its foe: it rocks
// back through the wind-up, drives in as the blow lands (atkCd running out,
// prog 1) and settles back over the first beat after
function soldierRam(prog) {
  if (prog < 0.12) return 2;
  if (prog < 0.24) return 1;
  if (prog < 0.55) return 0;
  return prog < 0.85 ? -1 : 1;
}
function drawRobot(b, ex, ey, now) {
  if (b.merchant) { drawMerchant(b, ex, ey, now); return; }
  // its kind's sprite set (SOLDIER_TYPES' `spr`): frames 0-1 roll, and a
  // thrower's 2-3 are the same roll with its shot gone - shown from the
  // throw until the next is in hand (half its cooldown). A set baked with
  // its mirror (the ballista cart) shows 4-7 while it faces left (b.faceL)
  const T = soldierType(b), team = skin(b.team === undefined ? 0 : b.team);
  const set = (SPRITES[T.spr] || SPRITES.robotTeam)[team] || SPRITES.robot;
  const thrown = T.shot && (b.shot || b.atkCd > T.cd * 0.5) ? 2 : 0;
  const left = b.faceL && set.length > 4;
  const spr = set[(left ? 4 : 0) + thrown + (b.moving ? Math.floor(b.animT) % 2 : 0)];
  const M = heroMachine(b);
  if (M) { M.draw(b, ex, ey, now); return; } // a hero's machine draws itself (HERO_MACHINE: js/draw/faber.js)
  const bob = b.moving ? Math.floor(b.animT / 2) % 2 : 0;
  const ax = SPRITES.robotAx[T.spr] || 6;
  const bx = Math.round(b.x - ex) - (left ? spr.width - ax : ax);
  const zl = b.zip >= 0 ? ZIP_ALT : 0; // a soldier on a zipline hangs ZIP_ALT rows up, its shadow on the snow
  const by = Math.round(b.y + 4 - ey) - spr.height - bob - zl; // tread bottom sits at b.y + 4
  // the ram (soldierRam): the body and its shadow shift, the bar holds still
  let rx = 0, ry = 0;
  if (b.atkAim && !T.shot) {
    const dx = b.atkAim.x - b.x, dy = b.atkAim.y - b.y, d = Math.hypot(dx, dy) || 1;
    const n = soldierRam(1 - b.atkCd / T.cd);
    rx = Math.round(dx / d * n); ry = Math.round(dy / d * n);
  }

  drawCastShade(spr, bx + rx, by + bob + zl + ry); // on the ground under the bob

  const lit = bodyLayerOpen(Math.round(b.x - ex), by + spr.height, 20, 36); // keeps its light at night (js/draw/light.js)
  if (zl) drawZipHandle(b, Math.round(b.x - ex), by, ey); // the handle over the chassis and the rope up to the cable (js/draw/zipline.js)
  drawSpriteFlash(spr, bx + rx, by + ry, b.flash);
  if (b.shot) drawSoldierShot(b, T, ex, ey, left);

  // the four shared tells, same as any other body (js/sim/abilities.js)
  drawUnitStates(b, bx + rx, by + ry, spr.width, spr.height, now);
  bodyLayerClose(lit);
  drawHealthBar(b.x - ex, by - 4, b.hp, b.maxHp, T.spr === 'robotSiege' ? 12 : 8, b.team, undefined, b);
  if (b.stunT > 0) drawStunStars(Math.round(b.x - ex), by - 9, b, 4);
  heroOver(b, Math.round(b.x - ex), by - 15, now); // a hero's marks, over the bar and the stars (HERO_OVER)
}
// a shot in the air (soldierShot, js/sim/robots.js), by its kind's `look`
// (SOLDIER_SHOTS): a snowball thrown from the hand to where it lands on a low
// arc, its shadow on the snow under it, 2 px with an ink rim; or a ballista
// bolt, shot flat off the stock's front (BOLT_AT) to its mark, 5 px of shaft
// along its flight, a steel head and the side's fletching
const BOLT_AT = [16, 12]; // the bolt's head on the loaded cart: px ahead of b.x, px over b.y
function drawSoldierShot(b, T, ex, ey, left) {
  const s = b.shot, f = Math.min(1, s.t / T.shot);
  if (T.look === 'bolt') {
    const x0 = b.x + (left ? -BOLT_AT[0] : BOLT_AT[0]), y0 = b.y - BOLT_AT[1];
    const dx = s.x - x0, dy = s.y - 4 - y0, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const hx = x0 + dx * f, hy = y0 + dy * f; // the head
    const fx = Math.round(hx - ex), fy = Math.round(hy - ey);
    ctx.fillStyle = 'rgba(40,52,90,0.25)'; // its shadow on the snow, under the line it flies
    ctx.fillRect(Math.round(hx - ux * 3 - ex) - 2, Math.round(hy + 16 - 8 * f - ey), 5, 1); // the ground: b.y + 4 at the cart, the mark's + 4 at the end
    const at = (k) => [Math.round(hx - ux * k - ex), Math.round(hy - uy * k - ey)];
    ctx.fillStyle = '#1c2130';
    for (let k = 0; k <= 6; k++) { const [x, y] = at(k); ctx.fillRect(x - 1, y - 1, 3, 3); }
    ctx.fillStyle = '#8a6142';
    for (let k = 1; k <= 4; k++) { const [x, y] = at(k); ctx.fillRect(x, y, 1, 1); }
    ctx.fillStyle = TEAMS[skin(b.team)].mark;
    for (let k = 5; k <= 6; k++) { const [x, y] = at(k); ctx.fillRect(x, y, 1, 1); }
    ctx.fillStyle = '#e4e8ee';
    ctx.fillRect(fx, fy, 1, 1);
    return;
  }
  const lift = Math.sin(f * Math.PI) * 3;
  const gx = s.x0 + (s.x - s.x0) * f, gy = s.y0 + 6 + (s.y + 4 - s.y0 - 6) * f; // the ground under it
  const x = Math.round(gx - ex), y = Math.round(gy - 6 - lift - ey), r = 2;
  ctx.fillStyle = 'rgba(40,52,90,0.25)';
  ctx.fillRect(Math.round(gx - ex) - 1, Math.round(gy - ey), r + 1, 1);
  ctx.fillStyle = '#1c2130';
  ctx.fillRect(x - 1, y, r + 2, r); ctx.fillRect(x, y - 1, r, r + 2);
  ctx.fillStyle = '#eef4fb';
  ctx.fillRect(x, y, r, r);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, 1, 1);
}

// The merchant (the `merchant` banner, robots.js): its own 16x18 hooded-robe
// grids (sprites.js), two rows taller than a slot, standing on player feet
// (b.y + 8 in the sort, the feet on the player's own foot row),
// with an axe swing over whatever it is felling or setting, the hop
// off the bird as a lift, the shared tells, and a MERCH nameplate in the
// side's paint - a name, the one text a body over the world gets (the bird it
// drives wears PERCH the same way, drawEagle in eagle.js). NO HEALTH BAR: it
// has no health to draw (the `merchant` banner, js/sim/robots.js), and a full bar
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
  const lit = bodyLayerOpen(px + 8, py + spr.height, 20, 40); // keeps its light at night (js/draw/light.js)
  drawSpriteFlash(spr, px, py - lift, b.flash);
  // the swing: a slow wind-up and a fast chop, aimed at the tile in hand
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
  bodyLayerClose(lit);
  if (b.stunT > 0) drawStunStars(Math.round(b.x - ex), py - 10, b, 5);
  heroOver(b, Math.round(b.x - ex), py - 22 - lift, now); // a hero's marks, over the name (HERO_OVER)
}

// ---- the player -----------------------------------------------------------
// every player draws through here - the local one, the AI fills, network
// peers later. Team palette on the sprite, name tag on everybody else.
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

// A bear buff, worn: a ring of pips around the feet in that bear's colour
// (MONSTER's buffCol: violet the black bear's), rimmed dark
// so it reads on snow, that loses a pip at a time as the buff runs out -
// the ring IS the timer, and a full ring on a rival is the warning. The
// longest buff (a bear's) fills every pip.
const BUFF_RING = 12;                // pips round the ring
const BUFF_COL = '#ffb04a';          // a buff with no bear named (a hand grant): amber
// THE TEAM RING: one pixel ring on the snow round every hero's feet, in its
// side's paint (the coat's own shade, a value step under the mark so a blue
// one holds on blue-white snow; your own in SELF_COL, the green of your bar),
// on an ink underline and a faint wash of the same colour. Heroes alone wear
// it - never a soldier, a beast or the merchant - so in a crowd the ringed
// bodies are the ones that matter, and which side each is on reads off the
// ground when the bodies and their frames are piled on each other. It is
// ground, like the shade: under the body, under the night, never in the
// body's light. Not under a body plunged through the ice, riding a cable, or
// off the map on a stage. A hero its own kit hides is not drawn for a rival
// at all (fogShown), so its ring never is either.
const HERO_RING_RX = 8, HERO_RING_RY = 4, HERO_RING_DY = 6, HERO_RING_WASH = 0.25;
const HERO_RING_INK = '#0f1632';
let heroRingPts = null; // [dx, dy] of the outline, then [dx0, dy, w] of each wash row
function heroRingShape() {
  const rx = HERO_RING_RX, ry = HERO_RING_RY, edge = [], rows = [];
  const half = (v, r, q) => Math.round(r * Math.sqrt(Math.max(0, 1 - ((v + 0.5) / q) ** 2)) - 0.5);
  for (let x = -rx; x < rx; x++) { const y = half(x, ry, rx); edge.push([x, y], [x, -y - 1]); }
  for (let y = -ry; y < ry; y++) { const x = half(y, rx, ry); edge.push([x, y], [-x - 1, y]); rows.push([-x - 1, y, 2 * x + 2]); }
  return (heroRingPts = { edge, rows });
}
function drawHeroRing(p, cx, cy) {
  const R = heroRingPts || heroRingShape(), was = ctx.globalAlpha;
  ctx.fillStyle = HERO_RING_INK;
  for (const q of R.edge) ctx.fillRect(cx + q[0], cy + q[1] + 1, 1, 1);
  ctx.fillStyle = p === player ? SELF_COL : TEAMS[skin(p.team)].coat;
  for (const q of R.edge) ctx.fillRect(cx + q[0], cy + q[1], 1, 1);
  ctx.globalAlpha = was * HERO_RING_WASH;
  for (const q of R.rows) ctx.fillRect(cx + q[0], cy + q[1], q[2], 1);
  ctx.globalAlpha = was;
}
function drawBuffRing(p, cx, cy, now) {
  drawPipRing(cx, cy, 7 + ((now * 3) & 1), p.buffT / CAMP_BUFF_EPIC_T, (MONSTER[p.buffKind] && MONSTER[p.buffKind].buffCol) || BUFF_COL);
}
// the orca buff (p.pushT), the same ring a size out in the orca's colour, so
// a hero wearing both shows both
function drawPushRing(p, cx, cy, now) {
  drawPipRing(cx, cy, 10 + ((now * 3) & 1), p.pushT / ORCA_PUSH_T, MONSTER.orca.buffCol);
}
// `r` px round (squashed to the ground's 3/4 view), `share` of its pips lit
function drawPipRing(cx, cy, r, share, col) {
  const n = Math.ceil(BUFF_RING * Math.min(1, share));
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / BUFF_RING) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.6);
    ctx.fillStyle = '#0f1632'; ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
  }
}

// The class body's run and dodge roll are the doll's frames (js/baked/motion.js,
// baked in every paint by characters.js), each wider than the 16x16 cell, which
// sits at SPRITES.motionBox's (x, y) inside it. The run plays RUN_STEP frames per
// step of animT - eight frames, two steps, 18 a second at a walk's 9 - and a roll
// frame is picked off how far through DODGE_T the roll is (SPRITES.rollAt).
const RUN_STEP = 2;
function runFrame(p) { return Math.floor(p.animT * RUN_STEP) % SPRITES.runBob.length; }
// A body whose hands are busy - a drawn weapon, a swing, a cast, the
// shield up - runs on the held run instead, its arms at its
// sides rather than pumping under what they hold. runBob is the bob of the
// frame on show, whole px up, for what rides the body.
function handsBusy(p) {
  return p.charging || p.swingT > 0 || p.slashT > 0 || p.castT > 0 || p.shieldT > 0;
}
function runBob(p) { return (handsBusy(p) ? SPRITES.holdBob : SPRITES.runBob)[runFrame(p)]; }
function rollFrame(prog) {
  const at = SPRITES.rollAt;
  let i = 0;
  while (i + 1 < at.length && prog >= at[i + 1]) i++;
  return i;
}

const MOUNT_BAR_ROWS = 1; // rows a rider's frame stands higher to hang the deer's bar under the stamina
const MOUNT_BAR_COL = '#c98f52'; // that bar's fill: the deer's own coat tan, never the rider's colour
// A deer's rider sits IN the deer (RIDE, js/sim/wildlife.js): the cell sinks
// until its row `hip` meets the back at the seat column, which sits toward
// the rump, and nothing of the body from that row down is drawn - the deer's
// own back line is the rider's lower edge, so the legs are out of sight
// behind the flank. `lift` seats it on the standing frame's back (the plate
// rides that and holds still); `bob` follows the frame on show, so the body
// rises and falls with the gallop.
function riderSeat(p) {
  const a = p.mount, R = RIDE[a.kind];
  const still = SPRITES[a.kind][a.dir].idle[0], w = still.width;
  const left = a.dir === 'left', col = left ? w - 1 - R.col : R.col;
  const back = backRow(still, col);
  return {
    dx: col + (left ? 1 : 0) - (w >> 1), // the cell's middle columns on the seat, mirrored with the deer
    lift: R.hip - 16 + still.height - back, // the cell's foot is p.y+4, the deer's frame's too
    bob: backRow(clipFrame(SPRITES[a.kind][a.dir], a), col) - back,
    hip: R.hip,
  };
}
// the top of a frame's body at one column: the opaque run through the
// frame's lower middle, walked up past the back (antlers above the gap are
// not the back). Read once per frame and column, kept on the frame.
function backRow(spr, col) {
  const k = 'back' + col;
  if (spr[k] === undefined) {
    const d = spr.getContext('2d').getImageData(col, 0, 1, spr.height).data;
    let y = Math.floor(spr.height * 0.6);
    while (y > 0 && d[(y - 1) * 4 + 3] > 0) y--;
    spr[k] = y;
  }
  return spr[k];
}
// how far a player's model reaches off its centre column and over its feet,
// the greatsword at full swing included (the body light's scenery test,
// js/draw/light.js)
const BODY_REACH = 30, BODY_REACH_UP = 44;
// stage: a model on show off the map (the champ select's showcase, drawShowcase,
// js/ui/select.js) - the tool in hand, no sun shade (its stage lights it), none of
// the overhead tells, on any mode.
function drawPlayer(p, ex, ey, now, stage) {
  const local = p === player;
  const set = classSet(p)[p.dir];
  let frame = 0;
  // upright, a body strides only while it covers ground on its own feet - the
  // sim's own test for stepping animT on (updatePlayer, js/sim/sim.js) - so a
  // shift-slide and a push against a wall stand, and a zipline's rider hangs still
  const striding = p.moving && p.zip < 0 && !p.mount && !p.sliding && Math.hypot(p.vx, p.vy) > 8; // ...and a deer's rider sits
  if (striding) frame = 1 + (Math.floor(p.animT) % 2);
  // a zipline's rider: the body ZIP_ALT rows up, the shadow where it always
  // is - the rope and handle over its head are the cable pass's (drawZips)
  const zl = p.zip >= 0 ? ZIP_ALT : 0;
  // a deer's rider: the body sits in the deer's back (riderSeat) and rides
  // its leap (rideLift, js/sim/wildlife.js); the deer casts the shadow
  const seat = p.mount ? riderSeat(p) : null;
  const rl = rideLift(p) + (seat ? seat.lift : 0);
  let spr = set[frame];
  // ...and a body on the move runs: the doll's eight frames (runFrame)
  const running = frame > 0 && p.fallT <= 0;
  if (running) spr = classSet(p)[handsBusy(p) ? 'hold' : 'run'][p.dir][runFrame(p)];
  // ...and standing still it breathes, its cloth a beat behind a stop or a turn (js/draw/idle.js)
  idleTick(p, striding, now);
  if (frame === 0 && !seat && p.fallT <= 0 && !(state.mode !== 'title' && abilityPose(p))) spr = idleFrame(p, now);
  const MB = SPRITES.motionBox;
  const px = Math.round(p.x - 8 - ex) + (seat ? seat.dx : 0);
  const py = Math.round(p.y - 12 - ey) - rl; // a rider's whole body - held tool, marks, plate - sits up on the deer
  // where the frame's top-left sits: any frame - the 16x16 cell, a larger
  // hero's, a wider run frame, the hoist - is centred on the cell with its
  // floor on the cell's floor
  const bx = px - ((spr.width - 16) >> 1);
  const by = py + 16 - spr.height;
  // shadow (not while swimming in a hole, and not on a deer, which casts its own)
  if (!stage && p.fallT <= 0 && !p.mount) {
    // the sun's shade, cut from the frame on show (ground.js), feet on the
    // foot row: a roll's own frame, so the ball goes over its own shadow
    if (p.dodgeT > 0) drawCastShade(classSet(p).roll[p.dir][rollFrame(1 - p.dodgeT / DODGE_T)], px - MB.x, py - MB.y);
    else drawCastShade(spr, bx, by);
  }
  if (!stage && p.fallT <= 0 && !zl) drawHeroRing(p, Math.round(p.x - ex), Math.round(p.y - ey) + HERO_RING_DY); // the team ring, on the snow under it
  if (p.buffT > 0 && p.fallT <= 0) drawBuffRing(p, Math.round(p.x - ex), Math.round(p.y - ey) + 3, now);
  if (p.pushT > 0 && p.fallT <= 0) drawPushRing(p, Math.round(p.x - ex), Math.round(p.y - ey) + 3, now);

  // the model itself - never the shade or the rings at its feet - goes
  // through the canopy window's hero layer (js/draw/canopy.js) when it is the
  // viewed hero's, so a canopy over it can open round exactly what is drawn
  const layer = heroLayerOpen(p, px, py);
  // ...and through the body layer when it is anyone else's and the night is on,
  // so a body keeps its light (js/draw/light.js)
  const lit = !layer ? bodyLayerOpen(px + 8, py + 16, BODY_REACH, BODY_REACH_UP) : null;
  if (p.fallT > 0) {
    // plunged through the ice: quick sink, only the head above the waterline
    const sink = Math.round(Math.min(7, (HOLE_FALL_T - p.fallT) * 40));
    ctx.save();
    ctx.beginPath(); ctx.rect(bx - 2, by - 8, spr.width + 4, py + 12 - (by - 8)); ctx.clip();
    ctx.drawImage(spr, bx, by + sink);
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
  } else if (heroBodyDraw(p, px, py, now)) {
    // a hero drawn as something else for a while: RUPES's snowball (HERO_BODY_DRAW, js/draw/heroes.js)
  } else {
    // a cast or a dash's lean is performed BY the
    // body: the pose shifts / tilts the sprite itself (abilityPose,
    // js/sim/abilities.js), so an ability visibly happens to the model
    const pose = state.mode !== 'title' ? abilityPose(p) : null;
    const bob = seat ? seat.bob : 0; // a rider rises and falls with the gallop, the plate holds still
    // a blade's blow moves the whole body, and the hands with it: back on the draw, in on the cut (attackLean)
    const lean = state.mode !== 'title' ? attackLean(p) : null, lx = lean ? lean.dx : 0, ly = lean ? lean.dy : 0;
    const ax = px + lx + (pose ? pose.dx : 0), ay = py + ly + (pose ? pose.dy : 0) - zl + bob;
    const sy = ay + by - py, sx = ax + bx - px; // a taller frame (the hoist) keeps its feet
    // held tool: behind the body when facing away or pointing up the screen,
    // in the hand otherwise. A body
    // mid-cast (or holding the shield, or charging) has no hand free for it -
    // but a mage casts with the staff in hand (heroStaffOf, js/draw/heroes.js), and a
    // key that is a shot holds the weapon on the aim through its wind-up (castAims).
    const held = (state.mode !== 'title' || stage) &&
      (p.castT <= 0 || heroStaffOf(p) || castAims(p)) && p.shieldT <= 0 && p.rushT <= 0 && p.zip < 0; // ...or holding a zipline's handle
    // what points up the screen or is carried facing away goes behind (THE CARRY RULE, drawHeldTool)
    if (held) drawHeldTool(p, px + lx, py + ly + bob, true);
    // a rider's body stops at the deer's back: the rows from its hip down
    // are the deer's (riderSeat); what the hands hold is not cut
    if (seat) {
      ctx.save();
      ctx.beginPath(); ctx.rect(sx - 32, py + bob + seat.hip - 64, spr.width + 64, 64); ctx.clip();
    }
    if (p.invuln > 0 && state.mode !== 'title' && ((now * 12) | 0) % 2 === 0) ctx.globalAlpha = 0.45;
    const fade = heroFade(p); if (fade < 1) ctx.globalAlpha = Math.min(ctx.globalAlpha, fade); // a hero hidden by its own kit, as its side sees it (HERO_FADE, js/draw/heroes.js)
    heroBodyFx(p, ax, ay, now, false); // a hero's own marks behind the body: ARMATOS's standard (HERO_BODY_FX, js/draw/heroes.js)
    if (pose && pose.rot) {
      ctx.save();
      // turned about the cell's middle (a doll frame is wider than the cell it holds)
      ctx.translate(ax + 8, ay + 8);
      ctx.rotate(pose.rot);
      ctx.drawImage(spr, sx - ax - 8, sy - ay - 8);
      ctx.restore();
    } else {
      // never washed white when struck: a hero's model stays solid so a
      // fight reads (Noah, 2026-11-10); the spark and the recoil tell the
      // hit (js/draw/hitfx.js)
      ctx.drawImage(spr, sx, sy);
    }
    heroBodyFx(p, ax, ay, now, true); // ...or over it (his standard facing away)
    if (seat) ctx.restore();
    ctx.globalAlpha = 1;
    if (held) drawHeldTool(p, px + lx, py + ly + bob, false);
    // what an ability left ON this body - shield, net, jaws, fury, mark -
    // drawn over the sprite for every side alike (js/sim/abilities.js)
    if (state.mode !== 'title') drawAbilityOnPlayer(p, ax, ay, now);
    if (zl) drawZipHandle(p, Math.round(p.x - ex), sy, ey); // the handle over the head and the rope up to the cable (js/draw/zipline.js)
  }
  heroLayerClose(layer);
  if (layer) litAdd(heroCv, heroAt.x, heroAt.y, HERO_LW >> 1, HERO_FOOT, BODY_REACH, BODY_REACH_UP);
  bodyLayerClose(lit);

  // ...and neither the title's living world nor an end screen's frozen one
  // wears any of the tells below: both are compositions somebody is looking
  // AT rather than a match somebody is reading, and a name plate with a
  // health bar under it floating through the ceremony is the HUD showing up
  // to a party it was not invited to (endScreen, js/ui/screens.js)
  if (stage || state.mode === 'title' || endScreen()) return;

  // the whole stack hangs off one y
  const hy = py - heroRise(p) - (zl ? zl + 5 : 0) - // a taller body lifts it; a rider's frame rises with it and clears the handle
    (p.mount ? MOUNT_BAR_ROWS : 0); // ...and a deer's rider stands the frame up off the head for the deer's row
  // fx is the stack's own centre column - the body's, shifted by FRAME_DX so
  // the frame straddles the sprite. Everything in the frame hangs off it.
  const fx = Math.round(p.x - ex) + FRAME_DX;
  // a dawn shield (pickSnowdrop, js/sim/actions.js) adds its own row straight
  // above the hp bar, and everything that sat above the bar - the draw meter,
  // the name, a callout - stands SHIELD_LIFT rows higher while it holds; the
  // orca's count (js/sim/orca.js) stands over the frame the same way, over the shield's
  const dawn = shieldOf(p, 'dawn'), shL = dawn > 0 ? SHIELD_LIFT : 0, line = orcaLine(p);
  const lift = shL + (line > 0 ? ORCA_COUNT_LIFT : 0);
  const bounty = bountyOf(p);
  // the stack's top: the name, a bounty's coin over it; a hero's marks on the
  // body (HERO_OVER) take the row over that, never a row of the frame below
  const nameTop = hy - 18 - lift, stackTop = nameTop - (bounty > 0 ? BOUNTY_LIFT + 1 : 0);
  callTag(p, Math.round(p.x - ex), stackTop - (heroOverW(p) ? OVER_ROW : 0) + (bounty > 0 ? 1 : 0)); // a bot's callout hangs over the name, a bounty and the marks (js/draw/callouts.js)
  // the whole frame, name included, is one plate stamped over the grade
  // (overheadPlate, js/draw/light.js), so it reads the same in any light and
  // nothing standing in front of the body cuts into it
  overheadPlate(() => {
    const stam = staminaShown(p); // a full stamina bar shows over your own head only (js/draw/overhead.js)
    drawHealthBar(p.x - ex + FRAME_DX, hy - 7, p.hp, p.maxHp, 14, p.team, undefined, undefined, 1, undefined, local ? SELF_COL : undefined, stam ? 2 : HP_ROWS_ALONE); // your own in green (unitBarCol, js/draw/overhead.js)
    if (p.healCutT > 0) drawHealCut(p.x - ex + FRAME_DX, hy - 7, p.hp, p.maxHp, 14); // FROSTBITE: its heals are cut
    if (shL) drawShieldBar(fx - 7, hy - 10, dawn);
    if (line > 0) drawOrcaCount(fx, hy - 10 - shL, line);
    // the running damage total, past the frame's right edge: the bar backing,
    // the colour-blind cap or the status plate, whichever stands furthest out,
    // centred on the 7-row frame the badge spans (hy-8 .. hy-2)
    const st = statusOf(p);
    queueTally(p, fx + 8 + (st ? STATUS_W : foeCue(p.team) ? 1 : 0), hy - 4.5, unitBarCol(p));
    // level badge: a 7-tall plate sharing its right frame column with the bar
    // backing's left edge (fx-8: one 1px frame everywhere, never a doubled
    // wall), and spanning the health bar and the stamina bar stacked (hy-8 ..
    // hy-2) - the plate every animal wears too (drawLevelBadge)
    drawLevelBadge(fx - 8, hy - 8, p.level);
    if (local) queueXp(p, fx - 8 - levelBadgeW(p.level), hy - 4.5); // your XP, mirroring the damage total off the badge's left (js/draw/overhead.js)
    // Every player carries a name tag in its team colour so a fight stays
    // legible - your own included: the profile name is what the rest of the
    // table sees over your head, and hiding it from you alone would make it
    // the one label in the game you cannot check. A bot's tag is its hero
    // (boardName), the name TAB, the podium and the recap give it too
    const tag = boardName(p);
    drawWorldText(tag,
      centreTextX(p.x - ex, tag), hy - 18 - lift, // clear of the draw meter's frame (top row hy-11) with a gap row
      TEAMS[skin(p.team)].mark, undefined, undefined, local ? undefined : NAME_RIM_SOFT); // your own name keeps the full rim
    drawBountyTag(p.x - ex, hy - 18 - lift, bounty); // a streak's price, over the name (js/draw/overhead.js)
    heroOver(p, Math.round(p.x - ex), stackTop - 5, now); // ...and over it all, a hero's marks on this body
    // dodge stamina: one clean unsegmented WHITE bar under the health bar -
    // white on every side, since stamina has no side, and white is neither the
    // team's paint above it nor the gold of the draw - charges stay discrete
    // in the sim, the bar just shows the pooled total. Yours always shows;
    // another hero's only while it is short of a roll (staminaShown: a rival
    // out of rolls is a tell, a full bar is not), and its health bar stands a
    // row taller in the meantime, under the same level badge.
    // The gap row between the two is the hp backing's own bottom row, frame
    // colour, as between every pair of bars on a beast (drawBeastFrame).
    if (stam) {
      const bx = fx - 7, by = hy - 4;
      ctx.fillStyle = BAR_FRAME;
      ctx.fillRect(bx - 1, by, 16, 3); // rows under the hp backing only
      ctx.fillStyle = BAR_TRACK;
      ctx.fillRect(bx, by, 14, 2);
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
    // a deer's rider: the deer's health one row under the stamina, sharing a
    // frame row with it, in the deer's coat tan (MOUNT_BAR_COL) - in the
    // side's colour it read as a second copy of the rider's own bar. The
    // rider's bar above says the side the deer is on while ridden (unitFoe,
    // js/sim/actions.js); the deer's damage total wears the tan too
    if (p.mount) {
      const cx = p.x - ex + FRAME_DX; // the column the rider's own bars hang off
      drawHealthBar(cx, hy - 1, p.mount.hp, p.mount.maxHp, 14, p.team, MOUNT_BAR_COL);
      queueTally(p.mount, Math.round(cx - 7) + 15, Math.round(hy), MOUNT_BAR_COL); // where drawHealthBar puts a total
    }
    // the status plate: what has this body pinned, the mirror of the level
    // badge on the frame's other side (drawStatusPlate, js/draw/overhead.js),
    // the one state that matters most and nothing while nothing holds.
    // That does mean the resting
    // frame is only the level badge plus the bars, 22 px spanning cx-14..cx+7,
    // sitting three pixels left of the sprite's own seam; turn the pink centre
    // column on under '.' (drawHitboxes) and you can see it. Fixing that by
    // shifting the badge and both bars 3 px right would take the BARS off the
    // body to square up a badge, and the frame would still grow rightwards the
    // moment a state landed, so it is left as it is.
    if (st) drawStatusPlate(fx + 8, hy - 9, p, st);
    // bow draw meter: gold while charging, blinking white and settling to
    // pale gold the moment the draw is full - brighter, never a new hue, so it
    // stays the bow's colour next to a red rival's bar. Drawn for everyone -
    // it is the tell that says a shot is coming. It sits inside the shared frame directly above the hp bar, the
    // mirror of the stamina bar below it: its backing adds the rows above the
    // hp backing (frame top at hy-11, fill hy-10..-9) and the hp backing's top
    // row hy-8 is the frame-colour gap row, so the frame stays one outline.
    // The same slot carries the renock cooldown when the bow is not drawn. So
    // one strip above a head answers the only question a fight asks about it:
    // gold filling = drawing (a shot is coming), pale gold = it peaked, slate
    // filling = reloading (it is not), pale gold again for the instant it came
    // back (the bow's own ready colour; white is the stamina bar's), and the
    // recall's channel in the side's own glow (js/sim/recall.js: a hero
    // leaving, and a hit keeps them there).
    // All of them use the identical geometry, so the bar never jumps when one
    // hands over to the next.
    if (p.recallT > 0 || p.charging || p.nockT > 0 || p.readyFlash > 0) {
      const drawing = p.charging, home = p.recallT > 0;
      // the reload divides by attackCycle - the same span the reticle's marks
      // read - so the slate fill starts at zero the frame the
      // shot leaves (dividing by the bare kit.nock sat it at 1 px for half the cycle)
      const frac = home ? 1 - p.recallT / RECALL_T
        : drawing ? drawPow(p)
        : p.readyFlash > 0 ? 1 : 1 - p.nockT / Math.max(0.01, attackCycle(p));
      const x = fx - 7, y = hy - 10 - lift;
      ctx.fillStyle = BAR_FRAME;
      ctx.fillRect(x - 1, y - 1, 16, 3); // rows above the hp backing only
      ctx.fillStyle = BAR_TRACK;
      ctx.fillRect(x, y, 14, 2);         // the fill rows; the gap row under is the hp backing's
      ctx.fillStyle = home ? TEAMS[skin(p.team)].glow
        : !drawing ? (p.readyFlash > 0 ? DRAW_FULL_COL : NOCK_COL)
        : frac < 1 ? DRAW_COL
        : p.chargeT < drawTime(p) + DRAW_FULL_FLASH ? '#ffffff' : DRAW_FULL_COL;
      ctx.fillRect(x, y, Math.max(1, Math.round(14 * frac)), 2);
    }
  });
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

// where a drawn weapon points: the local body off its own live pointer, any
// other off the aim its step held (aimHold, js/sim/player.js) - a client is
// never sent another body's input
function aimAngle(p) { return p === player ? Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x) : p.aimA; }

// the hero's weapon, drawn on a player: carried at the hand while idle or
// walking, swept along the arc during a melee swing, aimed at that player's
// aim point while the bow is drawn. px/py are the sprite's top-left on screen.
// THE CARRY RULE. Whatever the hands hold is turned about the hand (its art's
// grip: WEAPON_GRIP, js/sprites/weapons.js, or a hero blade's `hilt`), so a
// blade reaches out of the fist and its hilt never crosses the body; and it
// is drawn behind the body whenever it points up the screen (HELD_RISE), away
// from the camera, so no aim, wind-up or sweep ever lies over the face.
// drawPlayer calls this twice, behind the body (back true) and over it.
const HELD_RISE = 0.3; // sin of the angle above level past which a held thing goes behind the body
// where the hand is: a blade's hand rides an ellipse about the hips, out past
// the head's columns (rx, ry px), not up at the chin; a carried weapon sits at
// the hip or the side by facing, rows from the hands' line (cyp below)
const BLADE_HAND = [6, 3];
const CARRY_HAND_Y = { down: 1, up: -1, left: 0, right: 0 };
function heldBehind(a) { return Math.sin(a) < -HELD_RISE; }
// one held art at the hand (hx, hy), turned by `rot`, the hand closed on grip
function drawGripped(img, grip, hx, hy, rot) {
  ctx.save();
  ctx.translate(Math.round(hx), Math.round(hy));
  ctx.rotate(rot);
  ctx.drawImage(img, -grip[0], -grip[1]);
  ctx.restore();
}
// is a key mid-wind-up holding the weapon on the aim (its CLASS_AB row's `aimHeld`: SAGITTA's bolts)
function castAims(p) { if (!(p.castT > 0)) return false; const ab = abOf(p, p.castAb); return !!(ab && ab.aimHeld); }
// ---- the blow's motion -----------------------------------------------------
// A blade's attack is drawn as frames at SWING_FPS, the body's rate, never a
// 60 fps tween: the wind-up (the body 1 px back off the aim while the blade is
// drawn), the strike (1 px in toward it, the blade across with a solid swish),
// the finish (held at the arc's end), then the body comes back. Draw only: it
// reads the draw, the sweep and the cycle the sim already keeps (charging,
// slashT, slashA, nockT).
const SWING_FPS = 12;      // frames a second of a swing
const SWING_FIRST = 0.45;  // how far across the arc the blade is on the strike's first frame
const SWISH_FRAMES = 3;    // the swish shows on the strike's frames and one more as it goes
const SWISH_TAIL = 0.4;    // ...that last one keeps only this leading part of the arc
const SWISH_W = [2, 6];   // the swish's depth in px at its tail and at the blade
const SWISH_COL = ['#f8fcff', '#9cb6d4', '#1b2233']; // light edge, body, ink outline
const SWING_FRAMES = 5;    // frames from the loose to the recover: the last two are the held finish
// which frame of its blow a blade is on, or -1. The sweep (slashT) runs the
// strike; the held finish runs on into the cycle (nockT) that no draw can start inside.
function swingFrame(p) {
  if (!attackOf(p).cut) return -1;
  if (p.slashT > 0) return Math.floor((SLASH_T - p.slashT) * SWING_FPS);
  if (p.nockT <= 0 || p.charging || p.castT > 0) return -1;
  const f = Math.floor((attackCycle(p) - p.nockT) * SWING_FPS);
  return f >= 0 && f < SWING_FRAMES ? f : -1;
}
// the body's offset for a blow or a staff's cast ({ dx, dy } whole px), or null
function attackLean(p) {
  if (heroStaffOf(p)) return staffCasting(p) ? { dx: 0, dy: -1 } : null; // a staff's cast lifts the body with it (staffCasting, js/draw/heroes.js)
  if (!attackOf(p).cut) return null;
  let a, s;
  if (swingFrame(p) >= 0) { a = p.slashA; s = 1; } // the strike and the held finish
  else if (p.charging) { a = aimAngle(p); s = -1; } // the wind-up
  else return null;
  return { dx: s * Math.round(Math.cos(a)), dy: s * Math.round(Math.sin(a)) };
}
// how far a held art reaches from where the hand closes on it: its farthest painted pixel
const bladeLens = new WeakMap();
function bladeLen(img, grip) {
  let L = bladeLens.get(img);
  if (L !== undefined) return L;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  L = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]) L = Math.max(L, Math.hypot(x - grip[0], y - grip[1]));
  bladeLens.set(img, L);
  return L;
}
// The swish: one solid crescent of pixels along the arc the blade's outer part
// swept, from angle a0 to the blade at e, deepest at the blade and thinning to
// its tail (SWISH_W); a light outer edge, a body, and an ink line along the
// outside so it reads on snow. Each pixel takes the pass its own angle would
// (heldBehind), and none lands on the head (rules.md rule 1), sized by the
// swinger p's cell (heroRise, heroReach). `hand(a)` is where the hands are at
// angle a, L the blade's reach from them, (px, cyp) the cell's left and the
// hands' row.
function drawSwish(p, px, cyp, hand, L, a0, e, back) {
  if (L < 4) return;
  const cx = px + 8, span = e - a0, dir = span < 0 ? -1 : 1, R = Math.ceil(L + 8);
  const rise = heroRise(p), reach = heroReach(p), headTop = cyp - 10 - rise, headBot = cyp - 4; // the head's rows, taller on a larger cell
  for (let y = Math.round(cyp) - R; y <= Math.round(cyp) + R; y++) for (let x = Math.round(cx) - R; x <= Math.round(cx) + R; x++) {
    // the pixel's angle about the hands' middle, as a fraction of the way along the arc
    const a = Math.atan2(y - cyp, x - cx);
    let d = (a - a0) * dir; d -= Math.floor(d / (2 * Math.PI)) * 2 * Math.PI;
    const u = d / Math.abs(span);
    if (u > 1) continue;
    const h = hand(a), out = Math.hypot(h[0] - cx, h[1] - cyp) + L; // the blade's tip at that angle
    const rr = Math.hypot(x - cx, y - cyp), w = SWISH_W[0] + (SWISH_W[1] - SWISH_W[0]) * u;
    if (rr > out + 1 || rr < out - w) continue;
    if (heldBehind(a) !== back) continue;
    if (!back && y >= headTop && y <= headBot && x >= px + 3 - reach && x <= px + 12 + reach) continue;
    ctx.fillStyle = SWISH_COL[rr > out ? 2 : rr > out - 1.5 ? 0 : 1]; // ink only on the outer edge: the inner one is the motion
    ctx.fillRect(x, y, 1, 1);
  }
}
function drawHeldTool(p, px, py, back) {
  // At rest the hands hold the hero's WEAPON (its basic attack's `art`,
  // SPRITES.weaponArt, js/sprites/weapons.js), so what somebody fights with
  // reads off their sprite from across the snow. Mid-swing the
  // swing tool's own 8x8 icon sweeps - and a draw running at the same time
  // (an auto swing, autoWork, chops under a draw) puts BOTH up: one hand
  // sweeps the axe, the other holds the drawn weapon on the aim.
  const A = attackOf(p), cut = A.cut;
  const wIcon = SPRITES.weaponArt[A.art];
  const drawing = p.charging || castAims(p); // a key's shot winding up aims it too (an ability row's `aimHeld`)
  // the axe is out from a swing's start (startSwing, js/sim/actions.js) to the end of its cooldown
  const axeOut = p.swingT > 0 || p.swingCd > 0, swinging = p.swingT > 0;
  const cxp = px + 8, cyp = py + 10; // roughly the hands

  // melee swing: sweep with the same arc the swing effect uses; the icons
  // point up, so + PI/2 aligns the head with the sweep direction
  if (swinging) {
    const icon = SPRITES.itemAxe, half = icon.width >> 1;
    const prog = 1 - p.swingT / 0.18;
    const a = p.swingDir - 1.1 + prog * 2.2;
    if (heldBehind(a) === back) drawGripped(icon, [half, half], cxp + Math.cos(a) * 9, cyp - 2 + Math.sin(a) * 9, a + Math.PI / 2);
  }

  // a staff is carried upright in every facing, at rest, drawn or cast
  // (HERO_STAVES, js/draw/heroes.js), standing beside the body and behind it,
  // so its head stands clear of the face and the body's own edge overlaps it
  if (!swinging && heroStaffOf(p)) {
    if (back) heroStaff(p, px, py + (!p.moving ? 0 : -runBob(p)));
    return;
  }

  // the weapon's art points its business end along WEAPON_FWD
  // (js/sprites/weapons.js); rotating by the aim (or the facing) minus that
  // puts the arrowhead or the sword's point toward where its owner is looking
  const fwd = WEAPON_FWD[A.art] || 0;
  // the blade at its real length, where the art has one (SPRITES.weaponHeld),
  // and where the hand closes on it; a hero's own blade first (js/draw/heroes.js)
  const gripOf = (img, g) => g || [img.width >> 1, img.height >> 1];
  const hb = heroBlade(p), held = SPRITES.weaponHeld[A.art];
  const wHeld = hb ? hb.img : held || wIcon;
  const hGrip = gripOf(wHeld, hb ? hb.grip : held ? WEAPON_GRIP.held[A.art] : WEAPON_GRIP.icon[A.art]);
  const iGrip = gripOf(wIcon, WEAPON_GRIP.icon[A.art]);

  // THE SWING: a blade mid-cut is swung through its wedge from the hands in
  // drawn steps (SWING_FPS): across, through with the swish behind it, the
  // swish going, then the blade held at the arc's end. Behind the body while
  // it points up the screen.
  const f = swingFrame(p);
  if (f >= 0) {
    const sw = f === 0 ? SWING_FIRST : 1;
    const a0 = p.slashA - p.slashHalf, e = a0 + sw * p.slashHalf * 2;
    const hand = (a) => [cxp + Math.cos(a) * BLADE_HAND[0], cyp + Math.sin(a) * BLADE_HAND[1]];
    if (f < SWISH_FRAMES) drawSwish(p, px, cyp, hand, bladeLen(wHeld, hGrip), f === 2 ? e - (e - a0) * SWISH_TAIL : a0, e, back);
    if (heldBehind(e) === back) { const h = hand(e); drawGripped(wHeld, hGrip, h[0], h[1], e - fwd); }
    return;
  }

  // the drawn weapon tracks the aim. Drawn over the sweep: the shot about to
  // leave is the thing to read. A blade is drawn back to the START of its
  // arc, wound up, so the draw reads as the swing it is about to be.
  if (drawing) {
    const a = aimAngle(p);
    const w = cut ? a - cut.half * (0.4 + 0.6 * Math.floor(drawPow(p) * 2) / 2) : a; // cocked back in two steps, not a creep
    if (heldBehind(w) === back) {
      drawGripped(cut ? wHeld : wIcon, cut ? hGrip : iGrip,
        cxp + Math.cos(w) * (cut ? BLADE_HAND[0] : 8), cyp + (cut ? Math.sin(w) * BLADE_HAND[1] : Math.sin(w) * 8 - 2), w - fwd);
    }
  }
  if (drawing || swinging) return;

  // carried: the weapon (or, through the swing cooldown, the work tool) sits
  // in the leading hand, riding the run's bob, turned to the facing - a work
  // tool's icon points up and is left as drawn, the way it always was. Facing
  // up it is behind the body. A worn body keeps the old one-pixel step.
  const bob = !p.moving ? 0 : -runBob(p);
  // a hero's own way of holding it, which picks its own pass (heroCarry, js/draw/heroes.js)
  if (!axeOut && heroCarry(p, px, py + bob, back)) return;
  if ((p.dir === 'up') !== back) return;
  const icon = axeOut ? SPRITES.itemAxe : wHeld;
  if (!icon) return;
  const half = icon.width >> 1;
  const hx = p.dir === 'left' || p.dir === 'up' ? px + 2 : px + 14; // the leading hand (up: the far one, occluded by the body)
  // a short blade hung at the side rides `lift` px up, so its tip rests at the feet
  const hb0 = heroBladeOf(p), lift = hb0 && hb0.lift && p.dir === 'down' ? hb0.lift : 0;
  const hy = cyp + CARRY_HAND_Y[p.dir] + bob - lift;
  if (axeOut) { ctx.drawImage(icon, hx - half, hy - half); return; }
  const face = p.dir === 'right' ? 0 : p.dir === 'down' ? Math.PI / 2 : p.dir === 'left' ? Math.PI : -Math.PI / 2;
  drawGripped(icon, hGrip, hx, hy, face - fwd);
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
