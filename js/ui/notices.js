'use strict';
// ------------------------------------------------------------ notices
// News as something you SEE, not something you read in a log: a PLATE that
// flies in top-right, hard under the minimap beside the clock, for anything
// that happens where you are NOT looking. Two things raise one today - your
// roost under attack (`raiseNotice`, js/sim/eagle.js) and your own stat sheet
// moving (the stat ledger, below).
//
// A headline here also leaves its line in the event log (logEvent,
// js/ui/panels.js) - the log is the match's own record - but the log is not
// drawn, so the plate is how the news reaches the screen.
//
// One shape, read left to right with no sentence in it: the MARK of what the
// news is (the maps' own BIRD in your side's ink when it is your roost), then
// what it is about (the number - the NERVE the bird has left), then one glyph
// carrying WHICH WAY. The plate's frame and ink carry the same colours the
// feed line does, so the two readouts of one event never disagree.
const NOTE_MAX = 3;      // plates on screen at once; the oldest falls off the bottom
const NOTE_LIFE = 8;     // s from arrival to gone
// The arrival is a BEAT, not a fade-in: the plate flies in off the right edge
// over NOTE_IN while flashing white (NOTE_FLASH - three pulses under a decay,
// so the corner catches somebody whose eyes are on the middle of the screen),
// and at the end it rides back out the way it came over NOTE_OUT rather than
// dissolving in place. Long on purpose: this is news you are meant to look up
// for, and a third-of-a-second slide is over before a glance can land on it.
const NOTE_IN = 0.55;    // arrival: the slide in
const NOTE_FLASH = 0.45; // ...and the white flash pulsing over it
const NOTE_WASH = 0.85;  // how hard that flash washes the FIELD; a kind's `flash` overrides it
const NOTE_OUT = 1.2;    // departure: fades while sliding back out right
const NOTE_SLIDE = 30;   // px it travels, in and out
// 78 wide is what the content well needs: a number like "60%" at 2x is 22,
// over the 30 the mark's well and the tail's gutter take, and the rest is air.
const NOTE_W = 78, NOTE_H = 22;
const NOTE_AIR = 4;      // the air between two plates in the lane
const NOTE_GAP = 18;     // below the disc's clock, which ends 14px under it
const notices = [];      // {kind, txt, good, t}; ageNotices runs the clock
// A PLATE IS ITS KIND'S SIZE. Every kind but one is the 78x22 card; the STATS kind is the same card grown to seat
// a ledger, and nothing in the lane is special-cased for it - the stack sums
// the heights it finds. Ask the table, never the kind's name.
function noteW(K) { return K.w || NOTE_W; }
function noteH(K) { return K.h || NOTE_H; }
function notePitch(K) { return noteH(K) + NOTE_AIR; }
// the tails: which way the number went. 8x8, the item icons' own grid.
const NOTE_TAILS = {
  up: ['........', '...aa...', '..ahha..', '.ahhhha.', 'aahhhhaa', '..ahha..', '..ahha..', '..ahha..'],
  down: ['..ahha..', '..ahha..', '..ahha..', 'aahhhhaa', '.ahhhha.', '..ahha..', '...aa...', '........'],
};
// ---- the stat ledger: your sheet, as a notice ------------------------------
// THE ANSWER TO "WHAT DID THAT DO?". A hero level, a card drawn on C and a
// gear buy all rewrite the kit silently - the floater over your head names the
// thing you TOOK and never the number it moved - so until this plate the only
// place to read the change was the character panel, which is a key press and a
// pause in the middle of a fight.
//
// It is a NOTICE and nothing else: it does not stand on the HUD, it ARRIVES.
// A change flies the sheet in off the right edge into the lane under the disc
// on the same ease, the same white pulse and the same lane as a price, holds
// NOTE_LIFE, and rides back out the way it came - and it SHOVES whatever plate
// was in the lane down under it exactly as a price plate does. The only thing
// about it that is not a price plate is its SIZE, and that the lane sums the
// heights it finds instead of counting a pitch is the whole of what carrying
// it took. It sits above NOTE_KIND because the table reads its size.
//
// Every row of the sheet is on it, dim, and THE ROWS THAT MOVED ARE LIT: label
// and number to white, a wash across the row in its verdict colour, the delta
// printed in the leader's own space between them - and those rows PULSE for
// STAT_PULSE seconds as the plate slides home, so the thing you are meant to
// read is still blinking when your eyes arrive. Green is BETTER and red is
// WORSE by the row's own `dir`, so a draw time that FELL reads green: the
// grammar the hero pop-up's hover deltas already teach.
//
// ONE stats plate is ever up. A second change inside the first one's life
// drops it and flies a fresh one - the news is what your sheet is NOW, not a
// stack of what it has been - and a row still inside its own hold comes along
// on the new plate until that hold runs out.
//
// The rows read STAT_ROWS (js/sim/stats.js), the one table the hero pop-up
// prices a pick from and the character panel spells a body out with, so the
// three can never disagree about what a stat is, how it prints, or which way
// is up. It is the seven hero stats and nothing else, so a bonus to anything
// outside them (ice, dodge, stealth, food, hunts, fells, killHeal, ambushMul,
// an item's passive) lights nothing.
const STAT_PAD = 4;      // the plate's margin inside its frame
const STAT_TOP = 4;      // ...and above the first row
const STAT_PITCH = 8;    // a row: the 5 px font and its air
const STAT_PULSE = 1.3;  // s the moved rows blink for, arriving
const STAT_W = 100;      // the longest label ('COOLDOWN SPEED'), its number, and a delta between them
const STAT_LABEL = '#68769f', STAT_VAL = '#c3d0ee', STAT_LIT = '#f4f7ff';
const STAT_DOT = '#2b3560';                       // the leader, where a delta is not standing in it
const STAT_UP = '#8fe08a', STAT_DOWN = '#e0637a'; // better / worse: the hero pop-up's verdict inks
// The plate's height is every row of the sheet, so it follows STAT_ROWS
// rather than repeating its length; NOTE_KIND.stats asks for it through a
// getter, at draw time.
function statPlateH() { return STAT_TOP * 2 + (STAT_ROWS.length - 1) * STAT_PITCH + 6; }
let statSeen = null;    // the last value of each row; null = not seeded yet
let statOwner = null;   // the body those came off - a new match reseeds silently
const statLit = [];     // per row: { d, t } - the delta and the seconds of hold left
// drop any stats plate that is up and fly a fresh one: it arrives at the head
// of the lane, shoving whatever stood there down, and re-runs its own pulse
function raiseStatNote() {
  for (let i = notices.length - 1; i >= 0; i--) if (notices[i].kind === 'stats') notices.splice(i, 1);
  notices.push({ kind: 'stats', txt: '', good: null, t: 0 });
  while (notices.length > NOTE_MAX * 2) notices.shift();
}
// Watching the kit beats hooking the writers: levelUp, buyGear, useCard and a
// bot's resolveCardForBot all land here for free, a host's snapshot lands a
// client's here the same way, and nothing that ever edits a kit has to
// remember to announce it. Aged from updateFx (js/sim/sim.js) beside ageNotices.
function updateStatLedger(dt) {
  for (let i = 0; i < statLit.length; i++) if (statLit[i] && (statLit[i].t -= dt) <= 0) statLit[i] = null;
  const p = player;
  // the menus, the class screen's gear picks and the drop tour reseed in
  // silence: nothing there is news, and a plate must not be waiting to fly in
  // the moment the HUD arrives
  if (!p || (state.mode !== 'play' && state.mode !== 'dead')) { statSeen = null; return; }
  const k = kitOf(p), seed = !statSeen || statOwner !== p;
  if (seed) { statSeen = []; statOwner = p; statLit.length = 0; }
  let moved = 0, good = 0;
  for (let i = 0; i < STAT_ROWS.length; i++) {
    const get = STAT_ROWS[i][1], fmt = STAT_ROWS[i][2], v = get(k, p);
    if (seed) { statSeen[i] = v; statLit[i] = null; continue; }
    // the test is the PRINTED number, not the raw one: a change too small to
    // move the row is one the plate cannot show, and a '+0' beside a number
    // that did not move would be a lie
    if (fmt(v) === fmt(statSeen[i])) continue;
    statLit[i] = { d: v - statSeen[i], t: NOTE_LIFE }; // a delta lives as long as a plate does
    good += (v - statSeen[i]) * STAT_ROWS[i][3] > 0 ? 1 : -1;
    statSeen[i] = v;
    moved++;
  }
  if (!moved) return;
  raiseStatNote();
  // ONE cue for the batch, never one per row: a gold card moves three numbers
  // and is one thing that happened. Its direction is the batch's balance, so a
  // card that trades health for damage still speaks and reads as whichever way
  // it leans. The bare call is the right one here even though updateFx runs
  // inside the step: this is the LOCAL screen's own chrome, read off the local
  // body, and a client's snapshot moves its numbers for it.
  SFX.stat(good >= 0);
}
// the delta beside a value, in that value's own format: the magnitude printed
// exactly as the row prints itself, behind the sign it moved in
function statDeltaTxt(d, fmt) { return (d > 0 ? '+' : '-') + fmt(Math.abs(d)); }
// THE PLATE'S BODY (NOTE_KIND.stats.body): the whole sheet, the moved rows lit
// and blinking. `e.t` is the plate's own age, which is what the pulse runs on.
function noteStatBody(x, y, e, K, a) {
  const p = player, k = kitOf(p);
  const sh = 'rgba(4,6,18,0.9)'; // the plate is opaque and it fades: shadow font, not outline
  // three pulses under a decay - the card's own flash grammar, said about a row
  const pulse = e.t < STAT_PULSE
    ? (1 - e.t / STAT_PULSE) * (0.5 + 0.5 * Math.cos(e.t / STAT_PULSE * Math.PI * 6)) : 0;
  for (let i = 0; i < STAT_ROWS.length; i++) {
    const label = STAT_ROWS[i][0], get = STAT_ROWS[i][1], fmt = STAT_ROWS[i][2];
    const ry = y + STAT_TOP + i * STAT_PITCH;
    const vTxt = fmt(get(k, p));
    const lx = x + STAT_PAD, vx = x + STAT_W - STAT_PAD - pixelTextWidth(vTxt);
    const lit = statLit[i];
    const col = lit && lit.d * STAT_ROWS[i][3] > 0 ? STAT_UP : STAT_DOWN;
    const dTxt = lit ? statDeltaTxt(lit.d, fmt) : '';
    const dx = vx - 4 - pixelTextWidth(dTxt);
    if (lit) { // the row's wash, in the verdict's own ink, blinking as it arrives
      ctx.globalAlpha = a * (0.22 + 0.55 * pulse);
      ctx.fillStyle = col;
      noteBox(x + 2, ry - 2, STAT_W - 4, STAT_PITCH, 1);
      ctx.globalAlpha = a;
    }
    drawPixelTextShadow(ctx, label, lx, ry, lit ? STAT_LIT : STAT_LABEL, sh);
    drawPixelTextShadow(ctx, vTxt, vx, ry, lit ? STAT_LIT : STAT_VAL, sh);
    ctx.fillStyle = STAT_DOT; // the leader, stopping short of whatever stands in it
    for (let dotX = lx + pixelTextWidth(label) + 4; dotX < (lit ? dx : vx) - 3; dotX += 4) {
      ctx.fillRect(dotX, ry + 4, 2, 1);
    }
    if (!lit) continue;
    drawPixelTextShadow(ctx, dTxt, dx, ry, col, sh);
    // the blink: the delta stamped again in white on the pulse's peaks, so the
    // row reads as a bulb going off and not as a colour that happens to be there
    if (pulse > 0.01) {
      ctx.globalAlpha = a * pulse;
      drawPixelTextShadow(ctx, dTxt, dx, ry, '#f4f7ff', sh);
      ctx.globalAlpha = a;
    }
  }
}

// One palette per kind, worn by the plate AND handed to logEvent for the feed
// line: bg/edge/fg are exactly the keys logEvent's `o` override reads, so the
// two cannot drift apart. `glyph` names the stamp in the plate's left well
// (NOTE_MARKS, below).
const NOTE_KIND = {
  // YOUR ROOST IS BEING STRUCK AND YOU ARE SOMEWHERE ELSE (hurtEagle,
  // js/app/boot.js, in the same beat as SFX.alarm). Its own alarm red, because this
  // costs you the match, and the falling tail, since what the number on it
  // says is the nerve the bird has left.
  roost: { bg: '#3a1414', edge: '#d0453a', fg: '#ff9a8a', glyph: 'bird', tail: 'down',
    tp: { '.': null, a: '#a83c50', h: '#ff9a8a' } },
  // A NUMBER ON YOUR OWN SHEET MOVED (the `stat ledger` block below): the
  // same card, grown to seat the ledger and drawing its own body instead of
  // the mark/headline/tail row. Slate rather than a verdict colour, because
  // one plate can carry a gain and a loss at once - the ROWS are where green
  // and red are spoken.
  stats: { bg: '#141a33', edge: '#5d6d9e', fg: '#c3d0ee', mark: null, tail: null,
    w: STAT_W, get h() { return statPlateH(); }, body: noteStatBody, flash: 0 },
};
// A mark that is STAMPED rather than blitted, named by its kind's `glyph`, so
// a kind whose mark is not a sprite needs no `if` in the draw. Grids in the
// tails' own language (`stampGrid`, js/ui/screens.js): 16 wide, to fill the
// same well the 16x16 sprites do, and `h` is filled in per draw with YOUR
// SIDE'S ink - which is the whole reason to stamp one instead of baking a
// sprite, since a baked sprite cannot be recoloured per team.
//
// The BIRD is a soaring raptor from below - head, swept wings, tail - and not
// the maps' 7 px objective diamond blown up: at 2x that diamond reads as a
// medical PLUS, and its cousin the arrow tail is already on the far end of
// this same plate. A mark has to be the thing, not a marker for it.
const NOTE_MARKS = {
  bird: [
    '.......hh.......',
    '......hhhh......',
    '......hhhh......',
    '.hh...hhhh...hh.',
    '.hhhh.hhhh.hhhh.',
    '..hhhhhhhhhhhh..',
    '...hhhhhhhhhh...',
    '.......hh.......',
    '......hhhh......',
    '.......hh.......',
  ],
};

// raise one. `good` is a GOODS/ITEMS key whose icon rides beside the text, or
// null for a notice about the counter itself - or about something that is not
// the counter at all.
function raiseNotice(kind, txt, good) {
  notices.push({ kind, txt: String(txt).toUpperCase(), good, t: 0 });
  while (notices.length > NOTE_MAX * 2) notices.shift();
}

// Chrome: it ages on WALL time from updateFx (js/sim/sim.js),
// so a plate fades out while the sim is paused rather than hanging there.
function ageNotices(dt) {
  for (let i = notices.length - 1; i >= 0; i--) {
    notices[i].t += dt;
    if (notices[i].t > NOTE_LIFE) notices.splice(i, 1);
  }
}

// The slot a plate rests in, newest first: k = 0 sits under the disc's clock
// row, and every plate is RIGHT-ALIGNED on the disc's own right edge, so a
// taller or wider one still reads as the same lane. Off MM_* so the lane
// follows the minimap wherever the size dial and the view put it. The y is a
// SUM of what stands above the slot rather than k * a pitch, because the
// stats plate is not the height of a price.
function noteKindAt(k) {
  const e = notices[notices.length - 1 - k];
  return (e && NOTE_KIND[e.kind]) || NOTE_KIND.roost;
}
function noteRect(k) {
  const K = noteKindAt(k), w = noteW(K);
  let y = MM_CY + MM_R + NOTE_GAP;
  for (let j = 0; j < k; j++) y += notePitch(noteKindAt(j));
  return { x: MM_CX + MM_R - w, y, w, h: noteH(K) };
}
// The lane's floor: the top of the hud strip's xp numbers, at whatever size
// its dial holds (hudSc). Three plates of a price's height never came near it, but the
// stats sheet is five of them, so on a short view the lane can reach the
// bottom edge - and a plate drawn half under the strip is worse than one not
// drawn. renderNotices lays them newest first and stops here, which drops the
// OLDEST news: the right one to lose.
function noteLaneFloor() { return VIEW_H - Math.round((AB_H + XP_TAG) * hudSc()) - 4; }

// Drawn from renderUI (js/ui.js) after the counter and the character sheet:
// news that arrives mid-trade must not hide behind the thing it is about.
function renderNotices() {
  const n = Math.min(NOTE_MAX, notices.length);
  if (!n) return;
  // the newest arrives at the top and pushes the stack down under it, on the
  // same ease that slides it in - so nothing below it jumps a whole pitch, and
  // it shoves by ITS OWN height, which is how a tall plate can join the lane
  const top = notices[notices.length - 1];
  const push = easeOut(top.t / NOTE_IN);
  const shove = notePitch(NOTE_KIND[top.kind] || NOTE_KIND.roost);
  // oldest first, so the newest lands ON TOP of the stack it is pushing down:
  // during the ease the plate below starts under it and slides out from
  // beneath, which is the motion that reads as a shove rather than a collision
  for (let k = n - 1; k >= 0; k--) {
    const e = notices[notices.length - 1 - k], K = NOTE_KIND[e.kind] || NOTE_KIND.roost;
    const slide = 1 - easeOut(e.t / NOTE_IN);
    // the exit is the entrance run backwards - it leaves by the edge it came
    // in from, so the corner reads as one lane rather than as things vanishing
    const gone = easeOut((e.t - (NOTE_LIFE - NOTE_OUT)) / NOTE_OUT);
    // No fade IN: the plate is opaque from its first frame and the flash's own
    // first peak is what covers its arrival, so the card reads as a bulb going
    // off rather than as something dissolving into place.
    const a = 1 - gone;
    if (a <= 0) continue;
    const r = noteRect(k);
    if (r.y + r.h > noteLaneFloor()) continue; // the lane ran out of room: this is the oldest plate
    // it travels its own width plus the lane's slack, so a wide plate clears
    // the edge as completely as a narrow one
    const x = r.x + Math.round((slide + gone) * (NOTE_SLIDE + r.w - NOTE_W));
    const y = Math.round(r.y - (k ? (1 - push) * shove : 0));
    ctx.globalAlpha = a;
    noteCard(x, y, K, a, e.t);
    // WHAT IS ON THE CARD is the kind's own (K.body), so a plate carrying a
    // ledger needs no branch in the lane that carries it; everything without
    // one wears noteBody, the mark / headline / tail row every price is read
    // off. The kind's own flash comes with it - the body is drawn under the
    // card's white pulse and may pulse on its own clock after it.
    (K.body || noteBody)(x, y, e, K, a);
    // The flash, last and over everything: three pulses under a decay, so the
    // first is a near-white card and the two after it are the plate blinking
    // as it slides home. The frame goes white whole while the field only
    // washes - past the opening peak the card has to stay readable. How hard
    // the FIELD washes is the kind's (`flash`, default NOTE_WASH): on a card
    // the size of a price it is the arrival, but on the stats sheet it would
    // white out fourteen rows and drown the green ones that are the news, so
    // that kind takes the frame's pulse alone and lets its rows do the
    // blinking (noteStatBody).
    if (e.t < NOTE_FLASH) {
      const f = (1 - e.t / NOTE_FLASH) * (0.5 + 0.5 * Math.cos(e.t / NOTE_FLASH * Math.PI * 6));
      const wash = K.flash === undefined ? NOTE_WASH : K.flash;
      ctx.fillStyle = '#f4f7ff';
      if (wash > 0) {
        ctx.globalAlpha = a * wash * f;
        noteBox(x + 1, y + 1, r.w - 2, r.h - 2, 1);
      }
      ctx.globalAlpha = a * f;
      noteFrame(x, y, r.w, r.h, '#f4f7ff');
    }
    ctx.globalAlpha = 1;
  }
}

// THE DEFAULT BODY: the mark, what the news is about, and the tail - the row
// a roost warning is read left to right off. A kind
// with a `body` of its own never comes through here.
function noteBody(x, y, e, K, a) {
  // the kind's mark, sunk into a well of its own so it reads as a stamp on
  // the card
  ctx.fillStyle = 'rgba(3,5,14,0.5)';
  ctx.fillRect(x + 1, y + 3, 18, 16);
  // a stamped mark sits where a sprite would, centred in the well's 16 rows
  // (the grids are 10 tall, so 3 px of air above and below) and inked in
  // your side's colour, with the rim pass so it reads on the wash
  stampGrid(NOTE_MARKS[K.glyph], { '.': null, h: TEAMS[skin(player.team)].mark },
    x + 2, y + 6, 1, '#0b1024');
  // What it is about, centred in the well between the mark and the tail: an
  // item's own icon (when `good` names one) and the number, sized TOGETHER -
  // the icon is drawn at the text's own scale, so the pair reads as one
  // number with a face on it, and both drop to 1x together if a headline is
  // too long for 2x. A kind with no tail runs the well out to the frame.
  const tail = NOTE_TAILS[K.tail];
  const cx0 = x + 20, cw = NOTE_W - 22 - (tail ? 8 : 0);
  const im = e.good && ITEMS[e.good] && SPRITES[ITEMS[e.good].icon];
  const sh = 'rgba(4,6,18,0.9)'; // the plate is opaque and it fades: shadow font, not outline
  const runW = (sc) => (im ? im.width * sc + 3 : 0) + pixelTextWidth(e.txt, sc);
  const ts = runW(2) <= cw ? 2 : 1;
  const bx = cx0 + Math.max(0, (cw - runW(ts)) >> 1);
  if (im) ctx.drawImage(im, bx, y + ((NOTE_H - im.height * ts) >> 1), im.width * ts, im.height * ts);
  drawPixelTextShadow(ctx, e.txt, bx + (im ? im.width * ts + 3 : 0),
    y + ((NOTE_H - ts * 5) >> 1), K.fg, sh, ts);
  if (tail) stampGrid(tail, K.tp, x + NOTE_W - 10, y + 7, 1);
}

// The card itself, and the whole of what makes it read as a PLATE rather than
// as a rectangle: a shadow under it, corners notched off so it sits like a
// stamped tag, a lit top edge and a shaded bottom one for the bevel, and the
// kind's accent draining along the base as the plate's own remaining life -
// the one place the 8 s it has left is written down, and it is written as a
// length rather than a number.
function noteCard(x, y, K, a, t) {
  const w = noteW(K), h = noteH(K);
  ctx.globalAlpha = a * 0.5;
  ctx.fillStyle = 'rgba(3,5,14,0.85)';
  noteBox(x + 2, y + 2, w, h, 1);
  ctx.globalAlpha = a;
  ctx.fillStyle = '#080c1e'; // base: the world must not read through the plate
  noteBox(x, y, w, h, 1);
  ctx.globalAlpha = a * 0.9;
  ctx.fillStyle = K.bg;
  noteBox(x + 1, y + 1, w - 2, h - 2, 1);
  ctx.globalAlpha = a * 0.5;
  ctx.fillStyle = K.edge; // the bevel: lit along the top, shaded along the base
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  ctx.globalAlpha = a * 0.35;
  ctx.fillStyle = '#03050e';
  ctx.fillRect(x + 2, y + h - 2, w - 4, 1);
  ctx.globalAlpha = a;
  noteFrame(x, y, w, h, K.edge);
  const life = Math.max(0, Math.min(1, 1 - t / NOTE_LIFE));
  ctx.fillStyle = K.fg;
  ctx.fillRect(x + 2, y + h - 1, Math.round((w - 4) * life), 1);
}

// a rect with its four corner pixels cut, drawn as three bands. `c` is how
// deep the notch bites - the whole reason the plate does not read as a box.
function noteBox(x, y, w, h, c) {
  ctx.fillRect(x + c, y, w - c * 2, c);
  ctx.fillRect(x, y + c, w, h - c * 2);
  ctx.fillRect(x + c, y + h - c, w - c * 2, c);
}
// the 1px frame around that shape, corners included
function noteFrame(x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x + 1, y, w - 2, 1); ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2); ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
}
