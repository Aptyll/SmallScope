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
// The tier plate behind an item's icon, wherever that icon sits: a bag cell,
// a weapon slot, a bit cell, the drag ghost. This is the ONLY place a tier is
// stated, and it is stated the same way everywhere, which is what lets a find
// be read at a glance without a rarity word anywhere on screen.
function tierPlate(type, lit) {
  const t = itemTier(type);
  if (t < 0) return { plate: BAG_WELL, rim: lit ? '#8fa0c8' : '#35426e' };
  const T = TOOL_TIERS[t];
  return { plate: T.plate, rim: lit ? T.ink : T.rim };
}
// the gilded tier is the one that moves: a 2px highlight sweeping the plate
function tierShine(r, y, type, now) {
  if (itemTier(type) !== TIER_SHINE) return;
  const span = r.w + r.h;
  const s = ((now * 26) % (span + 18)) - 9;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x + 1, y + 1, r.w - 2, r.h - 2); ctx.clip();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#fff2c0';
  for (let k = 0; k < 2; k++) {
    for (let dy = 0; dy < r.h; dy++) ctx.fillRect(r.x + Math.round(s + k - dy), y + dy, 1, 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
// The one thing that tells the two kinds of BIT apart wherever either one
// sits - the bag grid, the tool's column, the cursor, the counter, the tech
// tree. A PROJECTILE is a thing you fire, and it keeps the flat square plate
// every other carried item wears. A MODIFIER never flies: it is fitted INTO
// the tool and rewrites every shot on it, so its plate is hatched in the
// bit's own colour and cut back at the corners - a fitting rather than a
// card. Colour is already spent on TIER, which is why the difference has to
// be the plate's texture and silhouette: those still read across a whole grid
// at a glance, without recognising a single glyph on it. Called on the drawn
// plate, under the icon; (y, h) are the plate's own, since a hovered cell
// lifts and the counter's plate is shorter than its well. `g` is the context
// to paint - the live HUD's unless a bake hands its own, which is what lets
// the CONTROLS page's primer stamp this exact mark into a static diagram.
function modPlate(type, r, y, h, g) {
  const id = type && bitIdOf(type);
  if (!id || !BITS[id] || BITS[id].proj) return;
  g = g || ctx;
  h = h || r.h;
  const x0 = r.x + 1, y0 = y + 1, x1 = r.x + r.w - 1, y1 = y + h - 1;
  g.globalAlpha = 0.35;
  g.fillStyle = BITS[id].col;
  for (let d = 1 - h; d < r.w; d += 4) { // 1px diagonals, four apart
    for (let k = 0; k < h; k++) {
      const px = r.x + d + k, py = y + k;
      if (px >= x0 && px < x1 && py >= y0 && py < y1) g.fillRect(px, py, 1, 1);
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = '#0a0e23';
  for (const [cx, sx] of [[r.x, 1], [r.x + r.w - 1, -1]]) {
    for (const [cy, sy] of [[y, 1], [y + h - 1, -1]]) {
      g.fillRect(cx, cy, 1, 1); g.fillRect(cx + sx, cy, 1, 1); g.fillRect(cx, cy + sy, 1, 1);
    }
  }
}
// "!" OVER A TOOL CARRYING MORE THAN ONE PRESS CAN SWING. The build is not
// broken - it fires along the row as far as the tensile budget reaches and
// stops - so this is a warning and not a refusal, and the SHELF's budget track
// is where you go to see exactly where it stops. A triangle, because a warning
// triangle is the one glyph nobody has to be taught; it rides the well's
// top-right corner and bobs a pixel, so the eye catches it on a strip that is
// otherwise still.
// Drawn wherever a loaded tool is: the weapon well and the pack's own grid.
function drawOverWarn(r, y, now, g) {
  g = g || ctx;
  // IN the well's top-right corner, over the rim and clear of the tool's own
  // art, rather than floating above it: the strip's wells are packed shoulder
  // to shoulder under the buy plates' travel, and a warning drawn into that
  // air is a warning something else lands on
  const h = 5, cx = r.x + r.w - 5, y0 = y - 1 + (Math.sin(now * 5) > 0 ? 0 : 1);
  g.fillStyle = '#0a0e23';                          // the dark seat, one px proud all round
  for (let d = 0; d <= h; d++) g.fillRect(cx - d, y0 - 1 + d, 1 + d * 2, 1);
  g.fillRect(cx - h, y0 + h, 1 + h * 2, 1);
  g.fillStyle = '#ffd95c';
  for (let d = 0; d < h; d++) g.fillRect(cx - d, y0 + d, 1 + d * 2, 1);
  g.fillStyle = '#241a12';                          // the stroke, and its dot
  g.fillRect(cx, y0 + 1, 1, 2);
  g.fillRect(cx, y0 + 4, 1, 1);
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
  const p = player, ab = CLASS_AB[p.cls][i];
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
// THE CARD ICON: three cards fanned - white, green and blue, each a step up
// and over from the last - baked once at 16x16, the size a doubled 8px item
// icon draws at, so the four squares carry art of one size. Three different
// colours, because the button holds every rarity at once and the fan is
// what says "a hand" rather than "a card".
const cardFanCv = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const g = cv.getContext('2d');
  const cards = [['#d9dfe8', '#8a94a8', 0, 5], ['#5fd18a', '#2f7a4b', 4, 2], ['#4a90e2', '#245390', 8, 0]];
  for (const [face, edge, dx, dy] of cards) {
    g.fillStyle = '#0a0e23'; g.fillRect(dx, dy, 8, 11);       // the rim
    g.fillStyle = face; g.fillRect(dx + 1, dy + 1, 6, 9);      // the face
    g.fillStyle = edge; g.fillRect(dx + 3, dy + 4, 2, 3);      // its pip
  }
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
  drawHudFrame(R.x - 3, R.y, R.w + 6, R.h, { tab: { x: tb.x, y: tb.y, w: tb.w }, seed: 31 });
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
    Math.round(VIEW_W / 2 - (VIEW_W / 2 - bx) * s),
    Math.round(VIEW_H - (VIEW_H - by) * s) + slideY,
    Math.round(bw * s), Math.round(bh * s));
}

// THE CORNER - the shelf and the drawer under it - at the same HUD SIZE,
// scaled about the TOP-LEFT corner so the tool cell stays put in it. The
// same deal as drawHudScaled: at 1x straight to the frame, otherwise a 1x
// bake blitted with smoothing off. The bake is sized to the widget's reach
// (CORNER_REACH, the drawer's height) so nothing of it is left behind.
const cornerScaleCv = document.createElement('canvas');
const cornerScaleCtx = cornerScaleCv.getContext('2d');
function drawCornerScaled(now, slideX) {
  const s = hudSc();
  if (s === 1) {
    ctx.save();
    ctx.translate(slideX, 0);
    drawShelf(now);
    drawBag(now);
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
  drawShelf(now);
  drawBag(now);
  ctx = o;
  ctx.drawImage(cornerScaleCv, slideX, 0, Math.round(bw * s), Math.round(bh * s));
}

// ONE WELL OF THE SHELF: its drop shadow, the tier rim and the plate inside
// it. `rim` overrides the tier's own, which is how the cut's red, the
// refusal's and a hovered fitting's reach are all said in one place.
function shelfWell(r, type, lit, rim) {
  ctx.fillStyle = 'rgba(4,6,18,0.55)';
  ctx.fillRect(r.x + 2, r.y + 2, r.w, r.h);
  const tp = type ? tierPlate(type, lit) : { plate: BAG_WELL, rim: lit ? '#8fa0c8' : '#2c3560' };
  ctx.fillStyle = rim || tp.rim;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = tp.plate;
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}
// THE SHELF, DRAWN - the whole of the weapon's arithmetic on screen at once,
// and on screen the WHOLE match now, so every mark on it has to survive being
// looked at for an hour rather than for the second a hover lasted.
//
// Five marks, no words:
//   * the ROW is the press, left to right out of the tool: cell 0 leaves first.
//   * a cell PAST the cut - the first the tensile budget could not reach - is
//     red-rimmed and washed out, because it is carried and never thrown.
//   * WEIGHT is pips along a cell's bottom edge, on both kinds, because a
//     fitting costs a press exactly what a shot does.
//   * a RAIL over the row runs from each fitting to the last shot it reaches,
//     in that fitting's own colour, blipping over every shot on the way that
//     it is really in the envelope of - the forward-only rule, drawn. Hover
//     either end and the pair lights: the rail, and the cells it lands on.
//   * the GOLD BAR in the gap left of a cell is the LEAD SHOT: what the next
//     press puts in the air first, and what the aim line on the ground is for.
// ...and one event: every cell the last press SPENT flashes white and fades
// (bitLitAt, js/tools.js), its rails with it, so the left button teaches the
// row it is firing.
function drawShelf(now) {
  if (!shelfUp()) return;
  const cell = shelfCell();
  const hov = mouse.inside ? shelfHit(mouse.x, mouse.y) : null;
  const hovBit = hov && hov.kind === 'bit' ? hov.i : -1;
  // the tool leads the row, in the tier plate it wears in every other well.
  // This is the weapon's one well now, so it carries every tell the strip's
  // used to: the refusal red (toolFlash) when a bit will not fit, the
  // dry-bow red when the tool cannot answer the button, and the SWEEP - the
  // rate of fire, the same hand the ability wells turn (drawSweepCover), so
  // the two clocks a press waits on read in one shape
  const p = player, t = shelfCellRect(-1), red = toolFlash > 0, dry = !!cell && !toolReady(p);
  ctx.save();
  if (red) ctx.translate(((now * 40) | 0) % 2 ? -1 : 1, 0);
  shelfWell(t, cell && cell.type, !!hov && hov.kind === 'tool', red ? '#c2465a' : dry ? '#7e3346' : null);
  if (cell) {
    tierShine(t, t.y, cell.type, now);
    drawItemIcon(cell.type, t, t.y, null, 2);
    if (p.nockT > 0) {
      drawSweepCover(t.x + 1, t.y + 1, t.w - 2, t.h - 2,
        Math.min(1, p.nockT / Math.max(0.01, toolCycle(p))), CD_SWEEP, CD_EDGE);
    }
    // the same "!" the pack's grid wears, in the one place the budget track
    // below can say exactly where the press runs out
    if (toolOver(cell)) drawOverWarn(t, t.y, now);
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
  const T = TOOLS[toolIdOf(cell.type)], plan = toolPlan(cell);
  const lead = plan.shots.length ? plan.shots[0].i : -1;

  // THE RAILS, drawn before the cells so a cell's own rim closes over the stem
  // that climbs to it. One per fitting that reaches anything.
  const rails = shelfRails(cell, plan);
  rails.forEach((rail, d) => {
    const from = shelfCellRect(rail.i), to = shelfCellRect(rail.hits[rail.hits.length - 1]);
    const y = from.y - 3 - d * SHELF_RAIL, cx = from.x + (SHELF_CELL >> 1);
    const w = to.x + (SHELF_CELL >> 1) - cx + 1;
    const hot = hovBit === rail.i || rail.hits.indexOf(hovBit) >= 0;
    const lit = bitLitAt(cell, rail.i);
    const blip = (j, dx, dy, bw, bh) => {
      ctx.fillRect(shelfCellRect(j).x + (SHELF_CELL >> 1) + dx, y + dy, bw, bh);
    };
    // A 1px line hanging over the snow needs a seat under it, the same reason
    // world text is outlined: the rail is a thread over a busy background.
    // Three px tall, which is exactly the rail pitch, so seats abut and never
    // swallow the line above.
    ctx.fillStyle = '#0a0e23';
    ctx.fillRect(cx - 1, y - 1, w + 2, 3);
    ctx.fillRect(cx - 1, y, 3, from.y - y);
    for (const j of rail.hits) blip(j, -2, -1, 5, 3);
    ctx.globalAlpha = hot ? 1 : 0.8 + 0.2 * lit;
    ctx.fillStyle = lit > 0.4 ? bitLitCol() : rail.col;
    ctx.fillRect(cx, y, w, 1);          // the run
    ctx.fillRect(cx, y, 1, from.y - y); // ...and the stem down to its own cell
    // a blip over every shot the fitting is riding, and nothing at all over
    // the ones it never reached
    for (const j of rail.hits) blip(j, -1, -1, 3, 2);
    ctx.globalAlpha = 1;
  });

  for (let i = 0; i < cell.bits.length; i++) {
    const r = shelfCellRect(i), id = cell.bits[i], b = id && BITS[id];
    // dead weight is not a property of the bit, it is a property of where the
    // bit SITS: everything from the cut on is carried, not thrown
    const dead = b && plan.cut >= 0 && i >= plan.cut;
    // the other end of the rail: a hovered FITTING rims every shot it reaches
    // in its own colour, so the question is answered from either end
    const hovId = hovBit >= 0 ? cell.bits[hovBit] : null;
    const reached = hovId && !BITS[hovId].proj &&
      plan.shots.some((s) => s.i === i && s.mods.indexOf(hovBit) >= 0);
    shelfWell(r, id && bitType(id), hovBit === i, dead ? '#c2465a' : reached ? BITS[hovId].col : null);
    if (b) {
      if (dead) ctx.globalAlpha = 0.45; // ...and it is washed out with it
      modPlate(bitType(id), r, r.y);
      tierShine(r, r.y, bitType(id), now);
      drawItemIcon(bitType(id), r, r.y - 2, null, 2); // up a little, clear of the pips
      // WEIGHT, as pips, on both kinds - a fitting costs the press what a
      // shot does, and the hatched plate is what says which kind it is
      ctx.fillStyle = dead ? '#e0637a' : '#f2cc6a';
      for (let k = 0; k < b.weight && k < 8; k++) ctx.fillRect(r.x + 2 + k * 4, r.y + r.h - 5, 2, 3);
      ctx.globalAlpha = 1;
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

  // THE LEAD SHOT, a gold bar standing in the gap to its left: the press
  // starts HERE. On cell 0 that gap is between the tool and its first bit,
  // which reads as the tool feeding it.
  if (lead >= 0) {
    const r = shelfCellRect(lead);
    ctx.fillStyle = '#0a0e23';
    ctx.fillRect(r.x - SHELF_GAP - 1, r.y - 1, SHELF_GAP + 1, r.h + 2);
    ctx.fillStyle = Math.sin(now * 6) > 0 ? '#fff2c0' : '#f2cc6a';
    ctx.fillRect(r.x - SHELF_GAP, r.y, SHELF_GAP, r.h);
  }

  // THE BUDGET: a track under the bit cells, filled in the tier's own ink to
  // what this press spends of the tool's strength. A row carrying more than
  // the tool can swing leaves the tail of the track red - the same fact the
  // "!" over the strip's well is shouting, said where the build is.
  const b0 = shelfCellRect(0), bN = shelfCellRect(cell.bits.length - 1);
  const bx = b0.x + 1, by = b0.y + b0.h + 1, bw = bN.x + bN.w - b0.x - 2;
  const over = plan.load > T.tensile;
  ctx.fillStyle = '#0f1632';
  ctx.fillRect(bx - 1, by, bw + 2, SHELF_BAR);
  let fill = Math.round(bw * Math.min(1, plan.used / T.tensile));
  if (over) fill = Math.min(fill, bw - 3); // always leave the overrun showing
  ctx.fillStyle = TOOL_TIERS[T.tier].ink;
  ctx.fillRect(bx, by + 1, fill, SHELF_BAR - 2);
  if (over) {
    ctx.fillStyle = '#c2465a';
    ctx.fillRect(bx + fill, by + 1, bw - fill, SHELF_BAR - 2);
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
  tierShine(r, r.y, d.cell.type, now);
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
