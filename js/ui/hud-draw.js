'use strict';
// Drawing the strip: the portrait, the health and stamina bars, the cell
// plate, item icons, the cooldown sweep, the ability, item, meal and gold
// cells, drawHudStrip and the scaled bakes, then the drop promise and the
// drag ghost.
// ---- the plates, bars and icons the widgets share --------------------------
// THE PORTRAIT: the hero's face in a square well, framed in the wells' own
// border (ink, then the rim). Inside the rim a 3px band is the XP, filling
// CLOCKWISE FROM TOP CENTRE round the square (each band pixel's place along
// the perimeter decides it, so the corners turn at the same pace as the
// sides); then one px of ink seals the face apart from the band. The xp you
// have and what the level needs stand over the square; at the top level the
// band is full and the numbers go. A level-up is an edge the sim never
// announces to the HUD, so the portrait watches for it and pops the band
// white.
let abLvSeen = 0, abLvFlash = 0;
const PORT_BAND = 3;                          // the xp band's width
const PORT_XP = '#9d4fb3', PORT_XP_LIT = '#c98ad8', PORT_XP_EMPTY = '#121418';
const PORT_SKY = '#2f4166', PORT_GROUND = '#263655'; // behind the face: a dusk the hero's pale kit reads on
const PORT_ZOOM = 3;                          // the face at 3x: the model's head and shoulders fill the square
function xpFrac(p) {
  if (p.level >= LEVEL_MAX) return 1;
  return Math.max(0, Math.min(1, (p.xp - LEVEL_XP[p.level - 1]) / (LEVEL_XP[p.level] - LEVEL_XP[p.level - 1])));
}
// the face: the worn body's standing frame if one is worn, the class body's
// otherwise - the same model drawPlayer puts in the world
function portraitSprite(p) {
  const rb = scoutBody(p);
  return rb ? rb.down.idle[0] : classSet(p).down[0];
}
function drawPortrait(now) {
  const p = player, r = portraitRect();
  if (p.level > abLvSeen && abLvSeen > 0) abLvFlash = now + 0.5;
  abLvSeen = p.level;
  const hot = now < abLvFlash;
  ctx.fillStyle = HUD_INK; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#2b2e34'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  // the band
  const bx = r.x + 2, by = r.y + 2, bs = r.w - 4, h = bs / 2;
  ctx.fillStyle = PORT_XP_EMPTY; ctx.fillRect(bx, by, bs, bs);
  const f = xpFrac(p);
  for (let py = 0; py < bs; py++) {
    for (let px = 0; px < bs; px++) {
      if (px >= PORT_BAND && px < bs - PORT_BAND && py >= PORT_BAND && py < bs - PORT_BAND) continue;
      const dx = px + 0.5 - h, dy = py + 0.5 - h;
      // the pixel's place along the perimeter, clockwise from top centre, 0..1
      let u;
      if (-dy >= Math.abs(dx)) u = dx >= 0 ? dx : 8 * h + dx;     // top side
      else if (dx >= Math.abs(dy)) u = 2 * h + dy;                // right side
      else if (dy >= Math.abs(dx)) u = 4 * h - dx;                // bottom side
      else u = 6 * h - dy;                                        // left side
      if (u / (8 * h) > f) continue;
      const rim = px === 0 || py === 0 || px === bs - 1 || py === bs - 1;
      ctx.fillStyle = hot ? '#f4f7ff' : rim ? PORT_XP_LIT : PORT_XP;
      ctx.fillRect(bx + px, by + py, 1, 1);
    }
  }
  // the seal and the face
  const sx = bx + PORT_BAND, ss = bs - PORT_BAND * 2;
  ctx.fillStyle = HUD_INK; ctx.fillRect(sx, by + PORT_BAND, ss, ss);
  const fx = sx + 1, fy = by + PORT_BAND + 1, fs = ss - 2;
  ctx.fillStyle = PORT_SKY; ctx.fillRect(fx, fy, fs, fs);
  ctx.fillStyle = PORT_GROUND; ctx.fillRect(fx, fy + (fs >> 1) + 4, fs, fs - (fs >> 1) - 4);
  const spr = portraitSprite(p), k = PORT_ZOOM;
  ctx.save();
  ctx.beginPath(); ctx.rect(fx, fy, fs, fs); ctx.clip();
  ctx.drawImage(spr, fx + ((fs - spr.width * k) >> 1), fy + (fs >> 1) - 22, spr.width * k, spr.height * k);
  ctx.restore();
  // the level, in a badge on the bottom-right corner: an odd-sized plate so
  // its digits sit on a true centre, widened for two
  const lv = String(p.level), lw = pixelTextWidth(lv), bw = lw > 3 ? 17 : 13;
  const lx = r.x + r.w - bw, ly = r.y + r.h - 13;
  ctx.fillStyle = HUD_INK; ctx.fillRect(lx, ly, bw, 13);
  ctx.fillStyle = '#2b2e34'; ctx.fillRect(lx + 1, ly + 1, bw - 2, 11);
  ctx.fillStyle = BAG_WELL; ctx.fillRect(lx + 2, ly + 2, bw - 4, 9);
  drawPixelText(ctx, lv, lx + (bw >> 1) - ((lw - 1) >> 1), ly + 4, '#f4f7ff', 1);
  // what you have of this level, and what it needs, standing over the square
  if (p.level < LEVEL_MAX) {
    const t = Math.floor(p.xp - LEVEL_XP[p.level - 1]) + '/' + (LEVEL_XP[p.level] - LEVEL_XP[p.level - 1]);
    drawPixelTextOutline(ctx, t, r.x + ((r.w - pixelTextWidth(t)) >> 1), r.y - AB_PAD - XP_TAG + 2, hot ? '#f4f7ff' : PORT_XP_LIT, HUD_INK);
  }
}
// THE HEALTH BAR under the ability wells: green, the number on it your health
// and your most. Green and not your side's colour: this one bar is always
// yours, and the overhead bars keep the sides.
const HP_FILL = '#4fae4a', HP_LIT = '#7fd36b', HP_DARK = '#2f7a33', HP_TRACK = '#1a2a1c';
function drawHpBar() {
  const p = player, r = hpBarRect();
  const f = Math.max(0, Math.min(1, p.hp / p.maxHp)), fw = Math.round(r.w * f);
  ctx.fillStyle = HUD_INK; ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  ctx.fillStyle = HP_TRACK; ctx.fillRect(r.x, r.y, r.w, r.h);
  if (fw > 0) {
    ctx.fillStyle = HP_FILL; ctx.fillRect(r.x, r.y, fw, r.h);
    ctx.fillStyle = HP_LIT; ctx.fillRect(r.x, r.y, fw, 1);
    ctx.fillStyle = HP_DARK; ctx.fillRect(r.x, r.y + r.h - 1, fw, 1);
  }
  const t = Math.ceil(Math.max(0, p.hp)) + '/' + Math.round(p.maxHp);
  drawPixelTextOutline(ctx, t, r.x + ((r.w - pixelTextWidth(t)) >> 1), r.y + 1, '#f4f7ff', HUD_INK);
}
// THE STAMINA BAR under it: the dodge charges, read exactly as the overhead
// one is (white, the chunk just spent draining as a ghost - drawOverhead,
// js/draw/bodies.js), with a notch between charges. The seat a mana bar takes
// when heroes come.
function drawStBar() {
  const p = player, r = stBarRect();
  ctx.fillStyle = HUD_INK; ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  ctx.fillStyle = '#24272c'; ctx.fillRect(r.x, r.y, r.w, r.h);
  const regen = p.dodgeCharges < DODGE_CHARGES ? 1 - p.dodgeRegenT / kitOf(p).dodgeCd : 0;
  const f = Math.max(0, Math.min(1, (p.dodgeCharges + regen) / DODGE_CHARGES));
  const fw = Math.round(r.w * f), gw = Math.round(r.w * Math.max(f, p.stamGhost)) - fw;
  if (gw > 0) { ctx.fillStyle = STAM_GHOST; ctx.fillRect(r.x + fw, r.y, gw, r.h); }
  if (fw > 0) {
    ctx.fillStyle = STAM_COL; ctx.fillRect(r.x, r.y, fw, r.h);
    ctx.fillStyle = '#b4b8bf'; ctx.fillRect(r.x, r.y + r.h - 1, fw, 1);
  }
  ctx.fillStyle = HUD_INK;
  for (let k = 1; k < DODGE_CHARGES; k++) ctx.fillRect(r.x + Math.round(k * r.w / DODGE_CHARGES), r.y, 1, r.h);
}
// The plate behind a carried thing's icon, wherever that icon sits: a bag
// cell, the drag ghost, the tooltip. A dark well with a 1px rim that lights
// while it is the one being handled.
function cellPlate(lit) { return { plate: BAG_WELL, rim: lit ? '#9ca1aa' : '#3c4048' }; }

// an item icon centred in a cell of any size, so one call covers every well; k doubles it
// for the HUD_CELL wells, where 1x art would swim
function drawItemIcon(type, r, y, g, k) {
  const d = ITEMS[type];
  if (!d) return;
  const im = SPRITES[d.icon];
  if (!im) return;
  k = k || 1;
  const w = im.width * k, h = im.height * k;
  (g || ctx).drawImage(im, r.x + ((r.w - w) >> 1), y + ((r.h - h) >> 1), w, h);
}

// ---- drawing the strip and the carried item --------------------------------
// THE COOLDOWN SWEEP - League's radial clock cut to a SQUARE, and now the
// ONE shape every wait in the game is drawn in: the four ability wells and
// both meal buttons through drawFoodClock.
// The veil fills the well and retreats CLOCKWISE FROM
// 12 O'CLOCK, so the dark that is left is the wait that is left, and the
// hand's angle is the fraction at a glance - which a top-down wipe cannot
// say, because a bar three quarters down and a bar half down look alike in
// the corner of your eye. An ability's cooldown and the meal clock are the
// same question asked of different clocks: answer them in the same shape and
// only the SPEED of the hand tells a 20 s fury from a meal, and nothing on
// the HUD has to be learned twice.
//
// It scales down further than it looks like it should, which is why the size
// gate below outlived the 8x8 wells it was written for: under twelve pixels
// the hand is four of stair-step, and that reads because it is the SAME four
// pixels every clock on screen is turning, with the eye already on three
// bigger ones beside it.
//
// Rasterised A PIXEL AT A TIME for the reason every minimap curve is
// (mmRing): canvas paths anti-alias, and a soft diagonal across a 32px well
// is blur on a screen where every other edge is hard. Each row is walked once
// and its covered pixels are coalesced into ONE fillRect per run, so a
// sweeping well costs a few dozen draws rather than a thousand - and only a
// well actually on cooldown is walked at all.
// The veil is NOT the near-black cover the old top-down wipes used
// (rgba(8,12,30,0.82), gone with the last of them): the well's ground is
// #0e0f12 and half of every 32px icon is nearly as dark, so a darker-still
// wash over it changes nothing you can see and the sweep would be a bare line
// turning over a well that never dims. A translucent SLATE reads on both
// halves at once - it drags the lit pixels of an icon down and lifts its dark
// ones to a blue-grey, so the waiting wedge is a different MATERIAL rather
// than merely a darker one, which is the thing League's grey veil is actually
// doing.
const CD_SWEEP = 'rgba(40,50,86,0.74)';
const CD_EDGE = '#b4b8bf'; // the hand: the 1px line the veil retreats behind
function drawSweepCover(x, y, w, h, frac, col, edge) {
  if (frac <= 0) return;
  if (frac >= 1) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); return; }
  const TAU = Math.PI * 2;
  const cx = x + w / 2, cy = y + h / 2;
  // the hand has already travelled (1 - frac) of the way round from 12; the
  // cover is the span from it back round to 12
  const a0 = -Math.PI / 2 + TAU * (1 - frac), span = TAU * frac;
  ctx.fillStyle = col;
  for (let py = 0; py < h; py++) {
    const dy = y + py + 0.5 - cy;
    let run = -1;
    for (let px = 0; px <= w; px++) {
      let inside = false;
      if (px < w) {
        const a = ((Math.atan2(dy, x + px + 0.5 - cx) - a0) % TAU + TAU) % TAU;
        inside = a < span;
      }
      if (inside) { if (run < 0) run = px; }
      else if (run >= 0) { ctx.fillRect(x + run, y + py, px - run, 1); run = -1; }
    }
  }
  if (!edge) return;
  // the hand itself, centre to rim along a0 - the same 1px bright line the
  // wiping wells carry at the front of their cover
  ctx.fillStyle = edge;
  const hx = Math.cos(a0), hy = Math.sin(a0);
  const end = Math.min(Math.abs(hx) > 1e-6 ? (w / 2) / Math.abs(hx) : 1e9,
                       Math.abs(hy) > 1e-6 ? (h / 2) / Math.abs(hy) : 1e9);
  for (let s = 0; s <= end; s++) {
    ctx.fillRect(Math.floor(cx + hx * s), Math.floor(cy + hy * s), 1, 1);
  }
}
// An ability well says everything without a word: the 32px icon is the
// ability, a SWEEP round the well is its cooldown (drawSweepCover above - the
// meal wells turn the same hand), the rim goes white while the
// body performs the cast, an ACTIVE ability (the shield up, the fury running)
// pulses the rim in its own colour and drains a bar of it along the bottom
// edge, and the well pops white the frame a cooldown comes home. The big
// digit bottom-left is the key (the keybind-indicator carve-out). Along the
// top inner edge, buy pips - fat ones, this is the strip's main
// progress readout - count the POINTS in the key, one seat per level; the ASK
// lives off the well entirely, on the floating plate above it
// (drawAbBuyPlate), so the well's rim carries combat states only.
//
// A key with no point in it is LOCKED, and the well says so exactly the way a
// meal button with nothing behind it does: dark rim, the icon at LOCK_DIM,
// the pips all empty and the key digit dim - grey, not absent, so the strip
// never rearranges and you can read what you have not bought yet. A press on
// one reddens it (abDenied above).
const LOCK_DIM = 0.28; // the locked icon's alpha - the meal button's grammar, one shade darker
let abCdSeen = [0, 0, 0, 0], abReadyFlash = [0, 0, 0, 0];
function drawClassAbCell(i, now, on) {
  const p = player, ab = abOf(p, i);
  const r = abCellRect(i);
  const cd = p.abCd[i];
  const lock = !abUnlocked(p, i);
  if (abCdSeen[i] > 0 && cd <= 0) abReadyFlash[i] = now + 0.3;
  abCdSeen[i] = cd;
  const casting = p.castT > 0 && p.castAb === i;
  const act = ab.activeF ? ab.activeF(p) : 0;
  const red = abFlash > 0 && abFlashI === i;
  if (red) {
    ctx.save();
    ctx.translate(((now * 40) | 0) % 2 ? -1 : 1, 0);
    ctx.fillStyle = '#c2465a';
    ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  }
  const rim = red ? '#c2465a'
    : lock ? (on ? '#555a63' : '#2b2e34')
    : ms.ready === i ? '#ffd95c' // readied under the MOUSE scheme: the next left press casts it
    : casting ? '#f4f7ff'
    : act > 0 ? (Math.sin(now * 9) > 0 ? ab.acol : '#3c4048')
    : now < abReadyFlash[i] ? '#f4f7ff'
    : on ? '#9ca1aa'
    : cd > 0 ? '#2b2e34' : '#3c4048';
  ctx.fillStyle = rim;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = BAG_WELL;
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  if (lock) ctx.globalAlpha = LOCK_DIM;
  ctx.drawImage(classAbIcon(p.cls, i), r.x + 1, r.y + 1);
  ctx.globalAlpha = 1;
  // a RUNNING ability owns its well: the drain bar is the readout and the
  // sweep waits until the state ends (the shield resets its cooldown on the
  // drop anyway, so a hand turning under a raised shield would be a lie)
  if (cd > 0 && act <= 0) {
    drawSweepCover(r.x + 1, r.y + 1, r.w - 2, r.h - 2,
      Math.min(1, cd / abCdOf(p, i)), CD_SWEEP, CD_EDGE);
  }
  // the level, as buy pips along the top inner edge - fat blocks with a
  // dark seat, so the bought count reads from across the screen. ONE SEAT PER
  // POINT the key can hold (AB_LV_MAX of them, the first of which is the
  // unlock), so an empty row is a locked ability and the row filling up is the
  // whole ladder in one readout. They sit ABOVE the sweep: the wait is what
  // the cover is for, and what you own is never dimmed by it
  for (let k = 0; k < AB_LV_MAX; k++) {
    ctx.fillStyle = '#191b1f';
    ctx.fillRect(r.x + 2 + k * 10, r.y + 2, 9, 5);
    ctx.fillStyle = k < p.abLv[i] ? '#f2cc6a' : '#33363d';
    ctx.fillRect(r.x + 3 + k * 10, r.y + 3, 7, 3);
  }
  if (act > 0) {
    ctx.fillStyle = '#191b1f';
    ctx.fillRect(r.x + 1, r.y + r.h - 4, r.w - 2, 3);
    ctx.fillStyle = ab.acol;
    ctx.fillRect(r.x + 2, r.y + r.h - 3, Math.max(1, Math.round(act * (r.w - 4))), 1);
  }
  if (casting) {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#f4f7ff';
    ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.globalAlpha = 1;
  }
  const abAct = 'ab' + (i + 1), key = keyCapShort(abAct); // the corner prints the key the ability is bound to
  const dimKey = lock || (cd > 0 && !casting && act <= 0);
  if (padActive()) drawPadBind(ctx, r.x + 3, r.y + r.h - 13 - 2 * 3, abAct, 2, dimKey); // the pad's button, at the number's size
  else drawPixelTextOutline(ctx, key, r.x + 3, r.y + r.h - 13, dimKey ? '#8c919a' : '#f4f7ff', '#191b1f', 2);
  if (red) ctx.restore();
}
// The floating buy plate over ability i - a bobbing chevron made a real
// button, spending a SKILL POINT (never gold). Drawn only while a point is
// in hand, the key has room, and the strip is HOME (the same abLvCanBuy +
// hudHome gate abBuyHit answers with - the plate hangs in open screen, so the
// intro's slide does not take it with the wells and it has to leave on its
// own), bobbing over open screen; hover lights it, and the tooltip
// carries the numbers.
function drawAbBuyPlate(i, now, hot) {
  if (!abLvCanBuy(player, i) || !hudHome()) return; // never bobbing over a cinematic the strip is hidden for
  const r = abBuyRect(i);
  const y = r.y + 2 + Math.round(Math.sin(now * 6)); // the bob stays inside the fixed hit rect
  ctx.fillStyle = 'rgba(4,6,18,0.55)';
  ctx.fillRect(r.x + 2, y + 2, AB_BUY, AB_BUY);
  ctx.fillStyle = hot ? '#f4f7ff' : Math.sin(now * 6) > 0 ? '#f2cc6a' : '#c9a227';
  ctx.fillRect(r.x, y, AB_BUY, AB_BUY);
  ctx.fillStyle = '#191b1f';
  ctx.fillRect(r.x + 1, y + 1, AB_BUY - 2, AB_BUY - 2);
  ctx.fillStyle = hot ? '#f4f7ff' : '#f2cc6a';
  ctx.fillRect(r.x + 6, y + 3, 2, 8); ctx.fillRect(r.x + 3, y + 6, 8, 2);
}
// a card key with nothing to draw: the deny cue (unopened cards are bag
// items, so the pack is where they are read)
function cardDenied() { SFX.deny(); }
// A MEAL WELL: an ability well's grammar pointed at the pouch, at the items'
// size - the item icon doubled in the middle, the key in the bottom-left
// corner (the pad's glyph while one is in hand), and how many
// you carry in the top-right, shortNum's four characters at most (the pouch
// has no ceiling). It wipes on the shared food clock. A meal you have none
// of keeps its seat but dims, so the pair never rearranges; the click sets
// the same edge-trigger the key does and startEat speaks every refusal - the
// refused well wears the ability wells' red and their 1px shake for it
// (foodDenied).
function drawFoodCell(i, now, on) {
  const p = player, b = FOOD_BTNS[i], r = foodCellRect(i);
  // the fish well counts every fish you carry and shows the one its key eats
  // next - or only the picked kind (the picker over it, drawFishPop)
  const fish = b.type === 'fish', type = fish ? fishToEat(p) : b.type;
  const n = fish && !p.fishPick ? fishHeld(p) : bagCount(p, type);
  const red = foodFlash > 0 && foodFlashI === i;
  const live = n > 0 && p.foodCd <= 0;
  if (red) {
    ctx.save();
    ctx.translate(((now * 40) | 0) % 2 ? -1 : 1, 0);
    ctx.fillStyle = '#c2465a';
    ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  }
  ctx.fillStyle = red ? '#c2465a' : on ? '#9ca1aa' : n > 0 ? '#3c4048' : '#2b2e34';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = BAG_WELL;
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const icon = SPRITES[ITEMS[type].icon], iw = icon.width * 2, ih = icon.height * 2;
  if (n <= 0) ctx.globalAlpha = 0.35;
  ctx.drawImage(icon, r.x + ((r.w - iw) >> 1), r.y + ((r.h - ih) >> 1), iw, ih);
  ctx.globalAlpha = 1;
  drawFoodClock(r.x + 1, r.y + 1, r.w - 2, r.h - 2, fish && FISH_KINDS.includes(p.eatType) ? p.eatType : type);
  if (padActive()) drawPadBind(ctx, r.x + 2, r.y + r.h - 11, b.act, 1, !live);
  else drawPixelTextOutline(ctx, keyCapShort(b.act), r.x + 2, r.y + r.h - 7, live ? '#f4f7ff' : '#8c919a', '#191b1f');
  const t = shortNum(n);
  drawPixelTextOutline(ctx, t, r.x + r.w - 2 - pixelTextWidth(t), r.y + 2, n > 0 ? '#f4f7ff' : '#8c919a', '#191b1f');
  if (red) ctx.restore();
}
// The fish picker's column (FISH_POP, js/ui/strip.js): the meal wells' own
// wells on the hud plate, each kind's icon and count; the picked one rings gold
// and the rest dim, none picked leaves all of them lit. The pointed-at kind's
// name and meal stand over the column.
function drawFishPop(hov) {
  const m = stripMouse(mouse.x, mouse.y);
  if (!fishPopUp(m.x, m.y)) return;
  const p = player, R = fishPopRect(), S = hudStripRect();
  // the column grows out of the strip: its frame, then the seam opened so its
  // ground runs on into the strip's and its sides turn into the strip's top
  // edge (a side flush with the strip's own outer side just carries on down)
  drawHudFrame(R.x, R.y, R.w, R.h);
  ctx.fillStyle = AB_BG; ctx.fillRect(R.x + 2, S.y, R.w - 4, R.h - (S.y - R.y));
  for (const [ink, edge] of [[R.x, R.x + 1], [R.x + R.w - 1, R.x + R.w - 2]]) {
    if (ink === S.x - 3 || ink === S.x + S.w + 2) continue;
    ctx.fillStyle = HUD_EDGE; ctx.fillRect(ink, S.y + 1, 1, 1);
    ctx.fillStyle = AB_BG; ctx.fillRect(ink, S.y + 2, 1, R.y + R.h - S.y - 2); ctx.fillRect(edge, S.y + 2, 1, R.y + R.h - S.y - 2);
  }
  for (let j = 0; j < FISH_POP.length; j++) {
    const t = FISH_POP[j], r = fishPopCellRect(j), n = bagCount(p, t);
    const picked = p.fishPick === t, on = hov && hov.kind === 'fishPick' && hov.j === j;
    ctx.fillStyle = picked ? '#f5c542' : on ? '#9ca1aa' : n > 0 ? '#3c4048' : '#2b2e34';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = BAG_WELL;
    ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    const icon = SPRITES[ITEMS[t].icon], iw = icon.width * 2, ih = icon.height * 2;
    if (n <= 0 || (p.fishPick && !picked)) ctx.globalAlpha = 0.35;
    ctx.drawImage(icon, r.x + ((r.w - iw) >> 1), r.y + ((r.h - ih) >> 1), iw, ih);
    ctx.globalAlpha = 1;
    const c = shortNum(n);
    drawPixelTextOutline(ctx, c, r.x + r.w - 2 - pixelTextWidth(c), r.y + 2, n > 0 ? '#f4f7ff' : '#8c919a', '#191b1f');
    if (on) {
      const name = ITEMS[t].name, heal = '+' + Math.round(ITEMS[t].heal * kitOf(p).foodMul);
      // over the column's top, flush with its right side: clear of the
      // ability buy plates whichever fish is hovered
      const x = R.x + R.w - 1 - pixelTextWidth(name) - 4 - pixelTextWidth(heal), y = R.y - FISH_POP_NAME + 2; // 1 in: the outline stays inside the bake
      drawPixelTextOutline(ctx, name, x, y, RES_COLORS[t], '#191b1f');
      drawPixelTextOutline(ctx, heal, x + pixelTextWidth(name) + 4, y, '#8fe08a', '#191b1f');
    }
  }
}
// AN ITEM WELL: the item's icon on its rim - a part's green, a finished
// item's gold (itemMetal), so a glance tells how far the build has come - and
// an empty slot's number, dim, so the six read as six before the first buy.
// Read, never pressed: the hover lights the rim and names it (tipItem).
function drawItemCell(i, on) {
  const r = itemCellRect(i), id = player.items[i];
  ctx.fillStyle = id ? (on ? '#9ca1aa' : itemMetal(id).rim) : '#33363d';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = BAG_WELL;
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  if (id) { shopIcon(itemIcon(id), r); return; }
  const t = String(i + 1);
  drawPixelText(ctx, t, r.x + ((r.w - pixelTextWidth(t)) >> 1) + 1, r.y + ((r.h - 5) >> 1), '#33363d', 1);
}
// THE PURSE under the meals: the coin and the gold, centred, inked '#f5c542'
// because the one number on the HUD that is money must never read as a count
// of something carried. A readout, not a button - the meal wells' rim, but no
// key, no hover and no refusal.
function drawGoldCell() {
  const r = goldCellRect();
  ctx.fillStyle = HUD_INK; ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  ctx.fillStyle = '#3c4048'; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = BAG_WELL; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const t = shortNum(inv.gold), coin = SPRITES.itemGold, w = coin.width + 2 + pixelTextWidth(t);
  const x = r.x + ((r.w - w) >> 1), y = r.y + ((r.h - coin.height) >> 1);
  ctx.drawImage(coin, x, y);
  drawPixelTextOutline(ctx, t, x + coin.width + 2, r.y + ((r.h - 5) >> 1), '#f5c542', '#191b1f');
}
function drawHudStrip(now) {
  const R = hudStripRect();
  const hov = mouse.inside ? stripHit(mouse.x, mouse.y) : null;
  const bhov = mouse.inside ? abBuyHit(mouse.x, mouse.y) : -1;
  // one frame behind portrait, wells and bars (drawHudFrame): the bag's
  // ground and the bag's chrome, so the HUD pieces sit in the same family
  drawHudFrame(R.x - 3, R.y, R.w + 6, R.h);
  drawStatPanel(hov); // left of the portrait (js/ui/statpanel.js)
  drawPortrait(now);
  for (let i = 0; i < AB_N; i++) {
    drawClassAbCell(i, now, hov && hov.kind === 'ab' && hov.i === i);
    drawAbBuyPlate(i, now, bhov === i);
  }
  for (let i = 0; i < ITEM_SLOTS; i++) drawItemCell(i, hov && hov.kind === 'item' && hov.i === i);
  for (let i = 0; i < FOOD_BTNS.length; i++) {
    drawFoodCell(i, now, hov && hov.kind === 'food' && hov.i === i);
  }
  drawHpBar();
  drawStBar();
  drawGoldCell();
  drawFishPop(hov);
  drawBuildList(now); // last: the open column stands over the meal wells
}
// The strip and its buy plates at the size its dial holds (hudSc). At 1x
// everything draws straight to the frame as it always did; any other size
// bakes the widget at 1x into hudScaleCv and blits it scaled about the strip's
// bottom-centre anchor - uictx's smoothing is off, so the art scales
// nearest-neighbour instead of every fillRect going soft under a fractional
// transform. The bake's headroom covers the buy plates' bob and the xp
// numbers over the portrait - and, while the build list is open, the column
// standing over the meal wells (buildHeadroom, js/ui/wheel.js).
const HUD_BAKE_HEAD = 26;
const hudScaleCv = document.createElement('canvas');
const hudScaleCtx = hudScaleCv.getContext('2d');
function drawHudScaled(now, slideY) {
  const s = hudSc();
  if (s === 1) {
    ctx.save();
    ctx.translate(0, slideY);
    drawHudStrip(now);
    ctx.restore();
    return;
  }
  const R = hudStripRect();
  const head = Math.max(HUD_BAKE_HEAD, buildHeadroom(), fishPopHeadroom());
  const bx = statPanelRect().x, by = R.y - head, bw = Math.max(R.x + R.w + 3 - bx, buildTabRect().x + BUILD_W + 1 - bx), bh = R.h + head;
  if (hudScaleCv.width !== bw || hudScaleCv.height !== bh) {
    hudScaleCv.width = bw; hudScaleCv.height = bh;
    hudScaleCtx.imageSmoothingEnabled = false; // resizing resets ctx state; the wells' 2x art must stay chunky
  }
  const o = ctx;
  ctx = hudScaleCtx;
  ctx.clearRect(0, 0, bw, bh);
  ctx.save();
  ctx.translate(-bx, -by);
  drawHudStrip(now);
  ctx.restore();
  ctx = o;
  ctx.drawImage(hudScaleCv,
    hudPx(VIEW_W / 2 - (VIEW_W / 2 - bx) * s),
    hudPx(VIEW_H - (VIEW_H - by) * s) + slideY,
    hudPx(bw * s), hudPx(bh * s)); // the size, too, on the device grid
}

// THE CORNER - the backpack's arrow and its drawer - at its own size (cornerSc), scaled about the
// TOP-LEFT corner so the arrow stays put in it. The same deal as
// drawHudScaled: at 1x straight to the frame, otherwise a 1x bake blitted
// with smoothing off. The bake is sized to the widget's reach (CORNER_REACH,
// the open drawer) so nothing of it is left behind.
const cornerScaleCv = document.createElement('canvas');
const cornerScaleCtx = cornerScaleCv.getContext('2d');
function drawCorner(now) { drawBag(now); }
function drawCornerScaled(now, slideX) {
  const s = cornerSc();
  if (s === 1) {
    ctx.save();
    ctx.translate(slideX, 0);
    drawCorner(now);
    ctx.restore();
    return;
  }
  const f = bagFrameRect();
  const bw = Math.max(CORNER_REACH, f.x + f.w + 4), bh = f.y + f.h + 6;
  if (cornerScaleCv.width !== bw || cornerScaleCv.height !== bh) {
    cornerScaleCv.width = bw; cornerScaleCv.height = bh;
    cornerScaleCtx.imageSmoothingEnabled = false;
  }
  const o = ctx;
  ctx = cornerScaleCtx;
  ctx.clearRect(0, 0, bw, bh);
  drawCorner(now);
  ctx = o;
  ctx.drawImage(cornerScaleCv, slideX, 0, hudPx(bw * s), hudPx(bh * s)); // the size on the device grid
}

// Whatever is riding the pointer, drawn last so it is over every well it
// might be dropped into. It wears its own tier plate, so the thing in your
// hand is read exactly the way it is read in a cell.
// The promise, on top of everything: which well the release would land in and
// what it would do there. Only a pack cell takes a carried item, so only a
// pack cell is ringed (dropKindBag, the branch dragDropBag takes).
function drawDropPromise() {
  if (!state.drag || !mouse.inside || shopHit(mouse.x, mouse.y)) return;
  // the ring is painted in screen space after the corner's bake, so a 1x
  // rect of the drawer is mapped through the corner's size first
  const k = cornerSc(), sc = (r) => ({ x: Math.round(r.x * k), y: Math.round(r.y * k), w: Math.round(r.w * k), h: Math.round(r.h * k) });
  const bh = bagHit(mouse.x, mouse.y);
  if (!bh || bh.kind !== 'cell') return;
  const r = bagCellRect(bh.i);
  if (player.bag[bh.i]) r.y -= 1; // a hovered FULL cell's plate lifts a pixel; the ring rides with it
  drawDropRing(sc(r), dropKindBag(bh.i));
}
function drawDragGhost(now) {
  const d = state.drag;
  if (!d || !mouse.inside) return;
  const r = { x: Math.round(mouse.x) - 8, y: Math.round(mouse.y) - 8, w: 18, h: 18 };
  const tp = cellPlate(true);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = tp.rim;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = tp.plate;
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  drawItemIcon(d.cell.type, r, r.y);
  ctx.globalAlpha = 1;
  if (d.cell.n > 1) {
    const t = String(d.cell.n);
    drawPixelTextOutline(ctx, t, r.x + r.w - 2 - pixelTextWidth(t), r.y + r.h - 7, '#f4f7ff', '#191b1f');
  }
  // THE HAND ITSELF, WHEN A SWAP CHANGED WHAT IS IN IT. A trade hands you the
  // ousted item back, which is the one thing a release can do that you did not
  // ask for by name - so the ghost flares gold for a beat and grows a ring,
  // and the item you are now carrying is impossible to mistake for the one you
  // let go of. Aged in updateFx beside the wells' own pulse.
  if (dragLit > 0) {
    const k = Math.min(1, dragLit / DRAG_LIT_T);
    const g = Math.round(2 + 4 * (1 - k)); // a ring opening off the ghost as it fades
    ctx.globalAlpha = 0.85 * k;
    ctx.fillStyle = FX_SWAP;
    ctx.fillRect(r.x - g, r.y - g, r.w + g * 2, 1);
    ctx.fillRect(r.x - g, r.y + r.h + g - 1, r.w + g * 2, 1);
    ctx.fillRect(r.x - g, r.y - g, 1, r.h + g * 2);
    ctx.fillRect(r.x + r.w + g - 1, r.y - g, 1, r.h + g * 2);
    ctx.globalAlpha = 0.4 * k;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  }
  // over the world rather than over any well: the release throws it, and the
  // ghost says so by growing a fall shadow under itself
  if (!overHud(mouse.x, mouse.y)) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#121418';
    ctx.fillRect(r.x + 3, r.y + r.h + 3, r.w - 6, 2);
    ctx.fillRect(r.x + 5, r.y + r.h + 6, r.w - 10, 1);
    ctx.globalAlpha = 1;
  }
}
