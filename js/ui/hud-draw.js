'use strict';
// Drawing the strip and the shelf: the xp bar, tier and mod plates, item
// icons, the cooldown sweep, the ability, pouch, food and gold cells,
// drawHudStrip and the scaled bakes, then the shelf's wells, the drop
// promise and the drag ghost.
// ---- the plates, bars and icons the widgets share --------------------------
// a level-up is an edge the sim never announces to the HUD, so the xp bar
// watches for it itself and pops white
let abLvSeen = 0, abLvFlash = 0;
function drawXpBar(now, x, y) {
  const p = player;
  if (p.level > abLvSeen && abLvSeen > 0) abLvFlash = now + 0.5;
  abLvSeen = p.level;
  const hot = now < abLvFlash;
  const max = p.level >= LEVEL_MAX;
  const frac = max ? 1
    : (p.xp - LEVEL_XP[p.level - 1]) / (LEVEL_XP[p.level] - LEVEL_XP[p.level - 1]);
  const inner = AB_W - 2;
  const fw = Math.round(Math.max(0, Math.min(1, frac)) * inner);
  // dark silhouette + frost rim: the plate is nearly the old track colour,
  // so without this the bar is a gold smudge with no readable shape
  ctx.fillStyle = '#05070f';
  ctx.fillRect(x - 1, y - 1, AB_W + 2, AB_XP + 2);
  ctx.fillStyle = '#5a6a9a';
  ctx.fillRect(x, y, AB_W, 1);
  ctx.fillStyle = '#1c2448';
  ctx.fillRect(x, y + AB_XP - 1, AB_W, 1);
  ctx.fillStyle = '#35426e';
  ctx.fillRect(x, y, 1, AB_XP);
  ctx.fillRect(x + AB_W - 1, y, 1, AB_XP);
  ctx.fillStyle = '#05070f';
  ctx.fillRect(x + 1, y + 1, inner, AB_XP - 2);
  const gx = x + 1, gy = y + 1, gh = AB_XP - 2;
  if (fw > 0) {
    // 1px dark leading edge so the fill's end reads as a silhouette
    const cap = fw < inner ? 1 : 0;
    ctx.fillStyle = '#0a0e1c';
    ctx.fillRect(gx, gy, fw, gh);
    ctx.fillStyle = hot ? '#f4f7ff' : '#9d4fb3';
    ctx.fillRect(gx, gy, Math.max(1, fw - cap), gh);
    ctx.fillStyle = hot ? '#ffffff' : '#c98ad8';
    ctx.fillRect(gx, gy, Math.max(1, fw - cap), 1);
    ctx.fillStyle = hot ? '#cfd8e8' : '#5f2d75';
    ctx.fillRect(gx, gy + gh - 1, Math.max(1, fw - cap), 1);
  }
  // the notches: AB_SEGS segments - a tick cuts dark through the fill and sits
  // faint on the empty track, so the bar is countable full or empty
  for (let s = 1; s < AB_SEGS; s++) {
    const tx = gx + Math.round(s * inner / AB_SEGS);
    ctx.fillStyle = tx < gx + fw ? '#3d1c4d' : '#1c2448';
    ctx.fillRect(tx, gy, 1, gh);
  }
}
// The tier behind an item's icon, wherever that icon sits: a bag cell, the
// weapon well, a bit cell, the drag ghost. This is the ONLY place a tier is
// stated, and it is stated the same way everywhere - a dark well with a 1px
// rim in the tier's colour, dim green, blue, gold, brighter as it gets better
// (TOOL_TIERS, js/tools.js) - which is what lets a find be read at a glance
// without a rarity word anywhere on screen. Nothing on it moves.
function tierPlate(type, lit) {
  const t = itemTier(type);
  if (t < 0) return { plate: BAG_WELL, rim: lit ? '#8fa0c8' : '#35426e' };
  const T = TOOL_TIERS[t];
  return { plate: T.plate, rim: lit ? T.ink : T.rim };
}
// The one thing that tells the two kinds of BIT apart wherever either one
// sits - the bag grid, the tool's row, the cursor, the counter, the tech
// tree. A PROJECTILE is a thing you fire, and it keeps the flat plate every
// other carried item wears. A MODIFIER never flies: it is fitted INTO the
// tool and shapes every shot on it, so its plate is hatched - in its TIER's
// colour, the same one its rim wears, so a well says its rarity once. The
// hatch stops a px inside the rim, so the rim stays one clean line. Called on
// the drawn plate, under the icon; (y, h) are the plate's own, since a
// hovered cell lifts and the counter's plate is shorter than its well. `g` is
// the context to paint - the live HUD's unless a bake hands its own, which is
// what lets the CONTROLS page's primer stamp this exact mark into a static
// diagram.
function modPlate(type, r, y, h, g) {
  const id = type && bitIdOf(type);
  if (!id || !BITS[id] || BITS[id].proj) return;
  g = g || ctx;
  h = h || r.h;
  const x0 = r.x + 2, y0 = y + 2, x1 = r.x + r.w - 2, y1 = y + h - 2;
  g.globalAlpha = 0.35;
  g.fillStyle = TOOL_TIERS[BITS[id].tier].rim;
  for (let d = 1 - h; d < r.w; d += 4) { // 1px diagonals, four apart
    for (let k = 0; k < h; k++) {
      const px = r.x + d + k, py = y + k;
      if (px >= x0 && px < x1 && py >= y0 && py < y1) g.fillRect(px, py, 1, 1);
    }
  }
  g.globalAlpha = 1;
}

// an item icon centred in a cell of any size (tools are 12x12, everything
// else 8x8), so one call covers every well the two sizes share; k doubles it
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

// ---- drawing the strip, the shelf and the carried item -----------------
// THE COOLDOWN SWEEP - League's radial clock cut to a SQUARE, and now the
// ONE shape every wait in the game is drawn in: the weapon well, the four
// ability wells, and both meal buttons through drawFoodClock.
// The veil fills the well and retreats CLOCKWISE FROM
// 12 O'CLOCK, so the dark that is left is the wait that is left, and the
// hand's angle is the fraction at a glance - which a top-down wipe cannot
// say, because a bar three quarters down and a bar half down look alike in
// the corner of your eye. A rate of fire, an ability's cooldown and the meal
// clock are the same question asked of different clocks: answer them in the
// same shape and only the SPEED of the hand tells a 0.8 s bow from a 20 s
// fury, and nothing on the HUD has to be learned twice.
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
// #080b1c and half of every 32px icon is nearly as dark, so a darker-still
// wash over it changes nothing you can see and the sweep would be a bare line
// turning over a well that never dims. A translucent SLATE reads on both
// halves at once - it drags the lit pixels of an icon down and lifts its dark
// ones to a blue-grey, so the waiting wedge is a different MATERIAL rather
// than merely a darker one, which is the thing League's grey veil is actually
// doing.
const CD_SWEEP = 'rgba(40,50,86,0.74)';
const CD_EDGE = '#9fb6d8'; // the hand: the 1px line the veil retreats behind
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
// weapon well turns the same hand), the rim goes white while the
// body performs the cast, an ACTIVE ability (the shield up, the fury running)
// pulses the rim in its own colour and drains a bar of it along the bottom
// edge, and the well pops white the frame a cooldown comes home. The big
// digit bottom-left is the key (the keybind-indicator carve-out). Along the
// top inner edge, gear's buy pips - fat ones, this is the strip's main
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
    : lock ? (on ? '#4a5480' : '#232c52')
    : ms.ready === i ? '#ffd95c' // readied under the MOUSE scheme: the next left press casts it
    : casting ? '#f4f7ff'
    : act > 0 ? (Math.sin(now * 9) > 0 ? ab.acol : '#35426e')
    : now < abReadyFlash[i] ? '#f4f7ff'
    : on ? '#8fa0c8'
    : cd > 0 ? '#232c52' : '#35426e';
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
  // the level, as gear's buy pips along the top inner edge - fat blocks with a
  // dark seat, so the bought count reads from across the screen. ONE SEAT PER
  // POINT the key can hold (AB_LV_MAX of them, the first of which is the
  // unlock), so an empty row is a locked ability and the row filling up is the
  // whole ladder in one readout. They sit ABOVE the sweep: the wait is what
  // the cover is for, and what you own is never dimmed by it
  for (let k = 0; k < AB_LV_MAX; k++) {
    ctx.fillStyle = '#0f1632';
    ctx.fillRect(r.x + 2 + k * 10, r.y + 2, 9, 5);
    ctx.fillStyle = k < p.abLv[i] ? '#f2cc6a' : '#2c3560';
    ctx.fillRect(r.x + 3 + k * 10, r.y + 3, 7, 3);
  }
  if (act > 0) {
    ctx.fillStyle = '#0f1632';
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
  else drawPixelTextOutline(ctx, key, r.x + 3, r.y + r.h - 13, dimKey ? '#7a8bb8' : '#f4f7ff', '#0f1632', 2);
  if (red) ctx.restore();
}
// The floating buy plate over ability i - gear's bobbing chevron made a real
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
  ctx.fillStyle = '#0f1632';
  ctx.fillRect(r.x + 1, y + 1, AB_BUY - 2, AB_BUY - 2);
  ctx.fillStyle = hot ? '#f4f7ff' : '#f2cc6a';
  ctx.fillRect(r.x + 6, y + 3, 2, 8); ctx.fillRect(r.x + 3, y + 6, 8, 2);
}
// A meal button: read left to right, the key it is pressed on, the item icon
// and how many you are carrying, over BAG_WELL and under the shared food
// clock - one grammar for the meal wherever it is read. It is WIDE because
// the pouch has no ceiling: the count is shortNum's four characters at most
// (js/core.js), so a hundred berries and three read in the same seat.
// A meal you have none of keeps its seat but dims, so the pair never
// rearranges; the click sets the same edge-trigger the key does and startEat
// speaks every refusal - and the refused button wears the well's red band and
// the pack's 1px shake for it (foodDenied).
// how many unopened cards the pouch holds, all rarities together
function cardTotal(p) { let n = 0; for (const r of CARD_RARITIES) n += bagCount(p, cardKey(r)); return n; }
// the card button's refusal: nothing to draw
function cardDenied() { foodDenied('card'); }
// THE CARD ICON: three of the card icons themselves fanned - a white, a blue
// and a gold, each a step up and over from the last, the gold's glint on top
// - baked once at 16x16, the size a doubled 8px item icon draws at, so the
// four squares carry art of one size. Three rarities, because the button
// holds every rarity at once and the fan is what says "a hand" rather than
// "a card"; the real icons, so the hand is visibly made of what it draws.
const cardFanCv = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const g = cv.getContext('2d');
  g.drawImage(SPRITES.itemCardWhite, -1, 7);
  g.drawImage(SPRITES.itemCardBlue, 3, 4);
  g.drawImage(SPRITES.itemCardGold, 7, 1);
  return cv;
})();
// ONE POUCH SQUARE, the block's whole grammar - the ability well's, smaller:
// the icon doubled in the middle (a bake that is already 16px draws at 1x),
// the key cap in the BOTTOM-LEFT corner, exactly where an ability well
// prints its key (the pad's glyph while one is in hand), and the count in
// the TOP-RIGHT, over the icon's corner if it has to be - so the eye reads
// keys along the strip's bottom edge and numbers along its top.
// All four wear the same rim, so the block is one symmetrical thing; on a
// button (a meal, the cards) it lights on hover and reddens on a refusal,
// and on the gold - a readout - it never does either, which with no key cap
// in its corner is what says the one square you cannot press.
function drawPouchCell(r, act, icon, n, col, on, red, live, now) {
  if (red) {
    ctx.save();
    ctx.translate(((now * 40) | 0) % 2 ? -1 : 1, 0);
    ctx.fillStyle = '#c2465a';
    ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  }
  ctx.fillStyle = red ? '#c2465a' : on ? '#8fa0c8' : n > 0 ? '#35426e' : '#232c52';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = BAG_WELL;
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const k = icon.width <= 8 ? 2 : 1, iw = icon.width * k, ih = icon.height * k;
  if (n <= 0) ctx.globalAlpha = 0.35;
  ctx.drawImage(icon, r.x + ((r.w - iw) >> 1), r.y + ((r.h - ih) >> 1), iw, ih);
  ctx.globalAlpha = 1;
  if (act) {
    const lab = keyCapShort(act);
    if (padActive()) drawPadBind(ctx, r.x + 2, r.y + r.h - 8, act, 1, !live);
    else drawPixelTextOutline(ctx, lab, r.x + 2, r.y + r.h - 8, live ? '#f4f7ff' : '#7a8bb8', '#0f1632');
  }
  const t = shortNum(n);
  drawPixelTextOutline(ctx, t, r.x + r.w - 2 - pixelTextWidth(t), r.y + 2, n > 0 ? col : '#7a8bb8', '#0f1632');
  if (red) ctx.restore();
}
// a meal button, or the card button: the pouch grammar pointed at a thing
// you press - the meals share the food clock, the cards have no clock
function drawFoodCell(i, now, on) {
  const p = player, b = FOOD_BTNS[i];
  const r = foodCellRect(i);
  const isCard = b.type === 'card';
  const n = isCard ? cardTotal(p) : bagCount(p, b.type);
  const red = foodFlash > 0 && foodFlashI === i;
  const live = n > 0 && (isCard || p.foodCd <= 0);
  drawPouchCell(r, b.act, isCard ? cardFanCv : SPRITES[ITEMS[b.type].icon], n, '#f4f7ff', on, red, live, now);
  if (!isCard) drawFoodClock(r.x + 1, r.y + 1, r.w - 2, r.h - 2, b.type);
}
// THE GOLD PLATE, top-right of the block: the coin and the gold, inked
// '#f5c542' because the one number on the HUD that is money must never read
// as a count of something carried. A readout, not a button - the same rim
// as its three neighbours, but no key cap, no hover and no refusal.
function drawGoldCell() {
  drawPouchCell(goldCellRect(), null, SPRITES.itemGold, inv.gold, '#f5c542', false, false, true, 0);
}
function drawHudStrip(now) {
  const R = hudStripRect();
  const hov = mouse.inside ? stripHit(mouse.x, mouse.y) : null;
  const bhov = mouse.inside ? abBuyHit(mouse.x, mouse.y) : -1;
  // one frame behind bar, wells and the pouch block's tab (drawHudFrame,
  // above): the bag's ground and the bag's chrome, so the two HUD pieces
  // sit in the same family
  const tb = pouchTabRect();
  drawHudFrame(R.x - 3, R.y, R.w + 6, R.h, { tab: { x: tb.x, y: tb.y, w: tb.w } });
  for (let i = 0; i < AB_N; i++) {
    drawClassAbCell(i, now, hov && hov.kind === 'ab' && hov.i === i);
    drawAbBuyPlate(i, now, bhov === i);
  }
  for (let i = 0; i < FOOD_BTNS.length; i++) {
    drawFoodCell(i, now, hov && hov.kind === 'food' && hov.i === i);
  }
  drawGoldCell();
  drawXpBar(now, R.x, R.y + AB_PAD + AB_CELL + AB_PAD);
}
// The strip and its buy plates at the HUD SIZE the settings dial holds. At 1x
// everything draws straight to the frame as it always did; any other size
// bakes the widget at 1x into hudScaleCv and blits it scaled about the strip's
// bottom-centre anchor - uictx's smoothing is off, so the art scales
// nearest-neighbour instead of every fillRect going soft under a fractional
// transform. The bake's headroom covers the buy plates' bob and the purse tab,
// and nothing taller: the build lives on the pack's own shelf, which scales
// with the corner it stands in (drawCornerScaled).
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
  const bx = R.x - 3, by = R.y - HUD_BAKE_HEAD, bw = R.w + 6, bh = R.h + HUD_BAKE_HEAD;
  if (hudScaleCv.width !== bw || hudScaleCv.height !== bh) {
    hudScaleCv.width = bw; hudScaleCv.height = bh;
    hudScaleCtx.imageSmoothingEnabled = false; // resizing resets ctx state; the tool well's 2x art must stay chunky
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
    bw * s, bh * s); // whole device pixels: hudSc snaps to them
}

// THE CORNER - the shelf, the drawer under it, and the hammer plate and build
// list under that (js/ui/wheel.js) - at the same HUD SIZE, scaled about the
// TOP-LEFT corner so the tool cell stays put in it. The same deal as
// drawHudScaled: at 1x straight to the frame, otherwise a 1x bake blitted
// with smoothing off. The bake is sized to the widget's reach (CORNER_REACH,
// the list hanging under the open drawer) so nothing of it is left behind.
const cornerScaleCv = document.createElement('canvas');
const cornerScaleCtx = cornerScaleCv.getContext('2d');
function drawCorner(now) {
  drawShelf(now);
  drawBag(now);
  drawBuildTab(now);
  drawBuildList(now);
}
function drawCornerScaled(now, slideX) {
  const s = hudSc();
  if (s === 1) {
    ctx.save();
    ctx.translate(slideX, 0);
    drawCorner(now);
    ctx.restore();
    return;
  }
  const f = bagFrameRect();
  const bw = Math.max(CORNER_REACH, f.x + f.w + 4), bh = Math.max(f.y + f.h + 6, buildFootMax() + 4);
  if (cornerScaleCv.width !== bw || cornerScaleCv.height !== bh) {
    cornerScaleCv.width = bw; cornerScaleCv.height = bh;
    cornerScaleCtx.imageSmoothingEnabled = false;
  }
  const o = ctx;
  ctx = cornerScaleCtx;
  ctx.clearRect(0, 0, bw, bh);
  drawCorner(now);
  ctx = o;
  ctx.drawImage(cornerScaleCv, slideX, 0, bw * s, bh * s); // whole device pixels: hudSc snaps to them
}

// ONE WELL OF THE SHELF: the tier rim and the dark well inside it, one px
// all round, sunk in the shelf's own plate. `rim` overrides the tier's own,
// which is how the refusal's red and a hovered fitting's reach are said in
// one place.
function shelfWell(r, type, lit, rim) {
  const tp = type ? tierPlate(type, lit) : { plate: BAG_WELL, rim: lit ? '#8fa0c8' : '#2c3560' };
  ctx.fillStyle = rim || tp.rim;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = tp.plate;
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}
// THE SHELF, DRAWN - the weapon and everything loaded in it, on screen the
// whole match, so every mark on it has to survive being looked at for an
// hour rather than for the second a hover lasted. Three marks, no words:
//   * the WEAPON is the big well at the left end; its bits are the smaller
//     wells after it, shots on the left and modifiers on the right, so what
//     flies and what shapes it are told apart by where they sit.
//   * the TIER is the rim's colour (tierPlate), a MODIFIER's well is hatched
//     in that colour too (modPlate).
//   * a LINE over the row runs from each modifier to every shot it powers, in
//     the modifier's own colour, with an arrowhead into each - into the
//     weapon well itself when no shot is loaded, since that is where the
//     plain shot comes from. Every line lands on a shot at its own x, so none
//     ever sits on another. Hover a cell and the lines that touch it stay
//     lit while the rest dim.
// ...and one event: every cell the last press SPENT flashes white and fades
// (bitLitAt, js/tools.js), its lines with it, so the left button teaches the
// row it is firing.
const SHELF_LINE_STEP = 4; // px between two lines landing on the same shot
function drawShelf(now) {
  if (!shelfUp()) return;
  const cell = shelfCell();
  const hov = mouse.inside ? shelfHit(mouse.x, mouse.y) : null;
  const hovBit = hov && hov.kind === 'bit' ? hov.i : -1;
  // the plate the row stands on, flush with the view's left edge (so only
  // its right corners are cut), under everything the shelf draws
  const pl = shelfPlateRect();
  drawHudFrame(pl.x, pl.y, pl.w, pl.h, { corners: { tl: false, tr: true, bl: false, br: true } });
  // the tool leads the row in its own bigger well. This is the weapon's one
  // well, so it carries every tell the strip's used to: the refusal red
  // (toolFlash) when a bit will not fit, and the SWEEP - the rate of fire,
  // the same hand the ability wells turn (drawSweepCover), so the two clocks a
  // press waits on read in one shape
  const p = player, t = shelfCellRect(-1), red = toolFlash > 0;
  ctx.save();
  if (red) ctx.translate(((now * 40) | 0) % 2 ? -1 : 1, 0);
  shelfWell(t, cell && cell.type, !!hov && hov.kind === 'tool', red ? '#c2465a' : null);
  if (cell) {
    drawItemIcon(cell.type, t, t.y, null, 2);
    forgeMark(t, t.y, toolLvl(cell)); // its forge level, top-left (js/ui/forge.js)
    if (p.nockT > 0) {
      drawSweepCover(t.x + 1, t.y + 1, t.w - 2, t.h - 2,
        Math.min(1, p.nockT / Math.max(0.01, toolCycle(p))), CD_SWEEP, CD_EDGE);
    }
    // ...and the tool's own share of the row flash: a press never lights this
    // cell, so a lit TOOL means one thing only - the body itself just changed
    // under you (swapFx, js/tools.js)
    const tlit = bitLitAt(cell, -1);
    if (tlit > 0) {
      ctx.globalAlpha = 0.6 * tlit;
      ctx.fillStyle = bitLitCol();
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.globalAlpha = 1;
    }
  }
  drawWellLit(t, 'slot', SHELF_SLOT); // ...and the pulse a weapon landing here wears
  ctx.restore();
  if (!cell) return;
  const plan = toolPlan(cell);

  // THE LINES, drawn before the cells so a cell's own rim closes over the
  // tip of each arrowhead. The modifier nearest the shots takes the line
  // nearest the row; every line runs LEFT from its stem to the first shot.
  const rails = shelfRails(cell, plan), rowY = shelfRowY();
  const cx = (i) => { const r = shelfCellRect(i); return r.x + (r.w >> 1); };
  // where line d lands on shot j: the lines that reach j, spread
  // SHELF_LINE_STEP apart about its centre, the nearer ones on the left
  const land = (j, d) => {
    const at = [];
    rails.forEach((r, k) => { if (r.hits.indexOf(j) >= 0) at.push(k); });
    return cx(j) + Math.round((at.indexOf(d) - (at.length - 1) / 2) * SHELF_LINE_STEP);
  };
  rails.forEach((rail, d) => {
    const y = rowY - 3 - d * SHELF_LINE, x0 = cx(rail.i), y0 = shelfCellRect(rail.i).y;
    const first = rail.hits[0], xl = land(first, d);
    const hot = hovBit < 0 || hovBit === rail.i || rail.hits.indexOf(hovBit) >= 0;
    const lit = bitLitAt(cell, rail.i);
    ctx.globalAlpha = hot ? 1 : 0.35;
    ctx.fillStyle = lit > 0.4 ? bitLitCol() : rail.col;
    ctx.fillRect(x0 - 1, y0 - 2, 3, 2);           // a node on the modifier
    ctx.fillRect(x0, y + 2, 1, y0 - y - 4);       // its stem
    ctx.fillRect(x0 - 1, y + 1, 1, 1);            // the rounded corner
    ctx.fillRect(xl + 2, y, x0 - xl - 3, 1);      // the run, left
    for (const j of rail.hits) {
      const tx = land(j, d), ty = shelfCellRect(j).y, end = j === first;
      if (end) ctx.fillRect(tx + 1, y + 1, 1, 1); else ctx.fillRect(tx, y, 1, 1);
      ctx.fillRect(tx, y + (end ? 2 : 1), 1, ty - y - (end ? 5 : 4));
      ctx.fillRect(tx - 1, ty - 3, 3, 1); ctx.fillRect(tx, ty - 2, 1, 1); // the arrowhead
    }
    ctx.globalAlpha = 1;
  });

  for (let i = 0; i < cell.bits.length; i++) {
    const r = shelfCellRect(i), id = cell.bits[i];
    // the other end of a line: a hovered FITTING rims every shot it powers
    // in its own colour, so the question is answered from either end
    const hovId = hovBit >= 0 ? cell.bits[hovBit] : null;
    const reached = hovId && !BITS[hovId].proj &&
      plan.shots.some((s) => s.i === i && s.mods.indexOf(hovBit) >= 0);
    shelfWell(r, id && bitType(id), hovBit === i, reached ? BITS[hovId].col : null);
    if (id) {
      modPlate(bitType(id), r, r.y);
      drawItemIcon(bitType(id), r, r.y, null, 2);
    }
    const lit = bitLitAt(cell, i);
    if (lit > 0) { // what the last press spent, still glowing - or the whole row, on a swap
      ctx.globalAlpha = 0.6 * lit;
      ctx.fillStyle = bitLitCol();
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 1;
    }
    drawWellLit(r, 'bit', i, SHELF_SLOT); // ...and a bit that just landed here
  }
}

// Whatever is riding the pointer, drawn last so it is over every well it
// might be dropped into. It wears its own tier plate, so the thing in your
// hand is read exactly the way it is read in a cell.
// The promise, on top of everything: which well the release would land in and
// what it would do there. It asks the wells in the SAME order dragDrop
// resolves in, so the ring can never point at a well the release would not
// take. The strip's own weapon slot is left out on purpose - it is drawn under
// the HUD SIZE transform (drawHudScaled) while this pass is in plain view
// space, and the shelf's tool well, which dragDrop tries first, is the one a
// drag actually aims at.
function drawDropPromise() {
  if (!state.drag || !mouse.inside || shopHit(mouse.x, mouse.y)) return;
  // the ring is painted in screen space after the corner's bake, so a 1x
  // rect of the shelf or the drawer is mapped through the HUD SIZE first
  const k = hudSc(), sc = (r) => ({ x: Math.round(r.x * k), y: Math.round(r.y * k), w: Math.round(r.w * k), h: Math.round(r.h * k) });
  const fh = shelfHit(mouse.x, mouse.y);
  if (fh) {
    if (fh.kind === 'bit') drawDropRing(sc(shelfCellRect(fh.i)), dropKindBit(SHELF_SLOT, fh.i));
    else drawDropRing(sc(shelfCellRect(-1)), dropKindSlot(SHELF_SLOT));
    return;
  }
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
  const tp = tierPlate(d.cell.type, true);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = tp.rim;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = tp.plate;
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  modPlate(d.cell.type, r, r.y);
  drawItemIcon(d.cell.type, r, r.y);
  ctx.globalAlpha = 1;
  if (d.cell.n > 1) {
    const t = String(d.cell.n);
    drawPixelTextOutline(ctx, t, r.x + r.w - 2 - pixelTextWidth(t), r.y + r.h - 7, '#f4f7ff', '#0f1632');
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
    ctx.fillStyle = '#0a0e23';
    ctx.fillRect(r.x + 3, r.y + r.h + 3, r.w - 6, 2);
    ctx.fillRect(r.x + 5, r.y + r.h + 6, r.w - 10, 1);
    ctx.globalAlpha = 1;
  }
}
