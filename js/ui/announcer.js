'use strict';
// ------------------------------------------------------------ announcer
// The match's big moments as a CALL, League's way: a short headline on a
// graphite plate under the team rail, the face of who made it on its left and
// the face it was made on, dimmed, on its right - each in its side's colour -
// and a sting as it lands. One call is up at a time; the rest wait their turn
// in the queue, so two never overlap, and the plate hangs under the rail, top
// centre, where the fight never is.
//
// And under the news plates beside the minimap, the KILL FEED: every kill as
// a row of two faces and a chevron in the killer's colour, no words, newest on
// top, each row gone after FEED_LIFE.
//
// What happened is the sim's to say (callKill / callStruct / callBeast, the
// `calls` banner, js/sim/player.js); annRaise is where it lands. A host
// records it (evPush, js/net/events.js) and every client replays it through
// evPlay, unfiltered by fog - every side hears every call. The queue, the feed
// and the stings are this screen's own and are never saved: a call is news,
// not state.
//
// A call is { k, n, a, at, bk, bv }: the kind (ANN_TEXT), the multi-kill's
// count, the credited player's id (-1 = a side, no player) and side, and what
// was taken - bk 'p' a player (bv its id), 'side' a whole side (bv the team),
// 'tower' a road tower (bv its team), 'beast' a camp monster (bv its kind).
const ANN_LIFE = 3;      // s a call holds when nothing waits behind it
const ANN_RUSH = 1.8;    // ...and when something does: a teamfight's calls keep up with it
const ANN_IN = 0.15;     // s the plate takes to drop in
const ANN_OUT = 0.3;     // ...and to fade out
const ANN_DROP = 4;      // px it drops in from
const ANN_WAIT = 4;      // calls kept waiting; past that the oldest waiting one is dropped
const ANN_FACE = 16;     // the plate's faces
const ANN_PAD = 2, ANN_GAP = 5; // the plate's border, and the air either side of the words
const FEED_MAX = 5;      // rows on the feed; the oldest falls off the bottom
const FEED_LIFE = 10;    // s a row stays
const FEED_IN = 0.2;     // s it takes to slide in from the right
const FEED_FACE = 12;    // the feed's faces
const FEED_AIR = 2;      // between two rows
const ANN_DIM = 'rgba(7,8,10,0.55)'; // over the face that was taken
const ANN_TOWER = [[0, 0, 1, 2], [3, 0, 1, 2], [6, 0, 1, 2], [0, 1, 7, 1], [1, 2, 5, 5]]; // a road tower's battlements, the camps' 7x7 grid
// the headline each kind reads; a multi-kill's comes from its count, a bear's
// from its name (MONSTER[kind].feed, js/sim/wildlife.js). 'kill' only feeds.
const ANN_MULTI = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUADRA KILL', 'PENTA KILL'];
const ANN_TEXT = {
  first: () => 'FIRST BLOOD',
  multi: (c) => ANN_MULTI[c.n],
  shut: () => 'SHUTDOWN',
  ace: () => 'ACE',
  tower: () => 'TOWER DESTROYED',
  beast: (c) => MONSTER[c.bv].feed + ' SLAIN',
};
const annQ = [];   // calls waiting, oldest first; annQ[0] is up once annT starts
let annT = -1;     // the call up's age in s (-1 = nothing up)
const annFeed = [];   // { c, t }, newest last

// the sim's call, on every screen: a row on the feed for anything that was
// taken (an ACE took no one new), a headline for anything with one
function annRaise(k, n, a, at, bk, bv) {
  evPush('ann', [k, n, a, at, bk, bv]);
  annTake({ k, n, a, at, bk, bv });
}
function annTake(c) {
  if (c.k !== 'ace') {
    annFeed.push({ c, t: 0 });
    while (annFeed.length > FEED_MAX) annFeed.shift();
  }
  if (!ANN_TEXT[c.k]) return;
  annQ.push(c);
  while (annQ.length > ANN_WAIT + 1) annQ.splice(1, 1);
}
function annHold() { return annQ.length > 1 ? ANN_RUSH : ANN_LIFE; }
// aged from updateFx (js/sim/sim.js) with the news plates; the sting rings
// when a call comes UP, not when it is queued, so the ear and the eye agree
function ageAnnouncer(dt) {
  for (let i = annFeed.length - 1; i >= 0; i--) if ((annFeed[i].t += dt) > FEED_LIFE) annFeed.splice(i, 1);
  if (!annQ.length) return;
  if (annT < 0) { annT = 0; annSting(annQ[0]); return; }
  annT += dt;
  if (annT < annHold()) return;
  annQ.shift(); annT = -1;
}
// the sting reads the call from this screen's side: a rising run for ours,
// a falling one for theirs (SFX.announce, js/app/audio.js)
function annSting(c) {
  const step = c.k === 'multi' ? c.n : c.k === 'ace' ? 5 : c.k === 'first' ? 2 : 1;
  SFX.announce(c.k, step, c.at === player.team);
}

// ---- the faces --------------------------------------------------------------
// A square in the side's colour (1px), dusk inside (the HUD portrait's own
// PORT_SKY/PORT_GROUND), and what it shows: a player's face (drawFace,
// js/ui/hud-draw.js, the team rail's too), a tower glyph in its side's colour, a
// bear's camp glyph in the camp's colour, or for a side and no player, the
// side's colour alone. `dim` darkens what was taken.
function annSide(c, who) { return who === 'a' ? c.at : c.bk === 'p' ? players[c.bv].team : c.bk === 'beast' ? -1 : c.bv; }
function annFace(x, y, S, k, v, team, dim) {
  const rim = team < 0 ? annCamp(v).mark : TEAMS[skin(team)].mark;
  ctx.fillStyle = HUD_INK; ctx.fillRect(x - 1, y - 1, S + 2, S + 2);
  ctx.fillStyle = rim; ctx.fillRect(x, y, S, S);
  const fx = x + 1, fy = y + 1, fs = S - 2;
  ctx.fillStyle = k === 'side' || (k === 'p' && v < 0) ? TEAMS[skin(team)].coatD : PORT_SKY;
  ctx.fillRect(fx, fy, fs, fs);
  if (k === 'p' && v >= 0) drawFace(fx, fy, fs, players[v]);
  else if (k === 'tower') annGlyph(ANN_TOWER, TEAMS[skin(v)].mark, fx, fy, fs);
  else if (k === 'beast') annGlyph(annCamp(v).icon, annCamp(v).mark, fx, fy, fs);
  if (dim) { ctx.fillStyle = ANN_DIM; ctx.fillRect(fx, fy, fs, fs); }
}
// a 7x7 glyph of [x, y, w, h] runs on a dark rim, centred, 2x where it fits
// - the camps' own icons (CAMPS[k].icon, js/sim/camps.js) and the tower's
function annGlyph(icon, col, fx, fy, fs) {
  const s = fs >= 14 ? 2 : 1, x0 = fx + ((fs - 7 * s) >> 1), y0 = fy + ((fs - 7 * s) >> 1);
  ctx.fillStyle = HUD_INK; for (const [a, b, w, h] of icon) ctx.fillRect(x0 + a * s - 1, y0 + b * s - 1, w * s + 2, h * s + 2);
  ctx.fillStyle = col; for (const [a, b, w, h] of icon) ctx.fillRect(x0 + a * s, y0 + b * s, w * s, h * s);
}
function annCamp(kind) { return Object.values(CAMPS).find((C) => C.kind === kind); }
function annFaceA(c, x, y, S) { annFace(x, y, S, c.a >= 0 ? 'p' : 'side', c.a, c.at, false); }
function annFaceB(c, x, y, S) { annFace(x, y, S, c.bk, c.bv, annSide(c, 'b'), true); }

// ---- the plate --------------------------------------------------------------
// HUD graphite (AB_BG on HUD_INK, the HUD_EDGE line inside), the words at 2x
// over a 1px rule in the maker's colour; an ACE has no face on its right.
function drawAnnPlate(c, t) {
  const txt = ANN_TEXT[c.k](c), tw = pixelTextWidth(txt, 2), S = ANN_FACE;
  const right = c.k !== 'ace';
  const h = S + 2 * ANN_PAD, w = ANN_PAD + S + ANN_GAP + tw + ANN_GAP + (right ? S + ANN_PAD : 0);
  const x = Math.round((VIEW_W - w) / 2);
  const out = Math.max(0, (t - (annHold() - ANN_OUT)) / ANN_OUT);
  const y = noteY() - Math.round((1 - easeOut(t / ANN_IN)) * ANN_DROP);
  ctx.globalAlpha = Math.min(1, t / ANN_IN, 1 - out);
  ctx.fillStyle = HUD_INK; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = HUD_EDGE; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = AB_BG; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  annFaceA(c, x + ANN_PAD, y + ANN_PAD, S);
  const tx = x + ANN_PAD + S + ANN_GAP, ty = y + ((h - 10) >> 1) - 1;
  drawPixelText(ctx, txt, tx, ty, '#f4f7ff', 2);
  ctx.fillStyle = TEAMS[skin(c.at)].mark; ctx.fillRect(tx, ty + 12, tw, 1);
  if (right) annFaceB(c, x + w - ANN_PAD - S, y + ANN_PAD, S);
  ctx.globalAlpha = 1;
}

// ---- the feed ---------------------------------------------------------------
// right-aligned on the minimap's edge like the news plates, starting where
// they end (noteLaneBottom, js/ui/notices.js) and stopping at the lane's floor
function drawFeedRow(e, x, y) {
  const c = e.c, S = FEED_FACE, rh = S + 4, w = 2 + S + 2 + 7 + 2 + S + 2;
  const col = TEAMS[skin(c.at)].mark;
  ctx.fillStyle = HUD_INK; ctx.fillRect(x, y, w, rh);
  ctx.fillStyle = AB_BG; ctx.fillRect(x + 1, y + 1, w - 2, rh - 2);
  ctx.fillStyle = col; ctx.fillRect(x + 1, y + rh - 2, w - 2, 1);
  annFaceA(c, x + 2, y + 2, S);
  // the chevron, pointing at what was taken
  const cx = x + 2 + S + 2, cy = y + 4;
  ctx.fillStyle = col;
  ctx.fillRect(cx + 1, cy, 2, 2); ctx.fillRect(cx + 3, cy + 2, 2, 2); ctx.fillRect(cx + 5, cy + 4, 1, 1);
  ctx.fillRect(cx + 3, cy + 4, 2, 2); ctx.fillRect(cx + 1, cy + 6, 2, 2);
  annFaceB(c, x + w - 2 - S, y + 2, S);
}
function feedRowW() { return 2 + FEED_FACE + 2 + 7 + 2 + FEED_FACE + 2; }
function drawFeed() {
  const w = feedRowW(), rh = FEED_FACE + 4, floor = noteLaneFloor();
  let y = noteLaneBottom() + 2;
  for (let i = annFeed.length - 1; i >= 0 && y + rh <= floor; i--) {
    const e = annFeed[i];
    const x = MM_CX + MM_R - w + Math.round((1 - easeOut(e.t / FEED_IN)) * (w + 8));
    ctx.globalAlpha = Math.min(1, FEED_LIFE - e.t);
    drawFeedRow(e, x, y);
    ctx.globalAlpha = 1;
    y += rh + FEED_AIR;
  }
}

function renderAnnouncer() {
  if (annFeed.length) drawFeed();
  if (annQ.length && annT >= 0) drawAnnPlate(annQ[0], annT);
}
