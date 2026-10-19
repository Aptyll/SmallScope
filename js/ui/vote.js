'use strict';
// The surrender vote's panel (the vote itself: js/sim/surrender.js).
// ------------------------------------------------------------ the vote panel
// Top centre under the clock (and under the spectate control while you are
// out): SURRENDER? over one dash per seat of your side, you first, then YES
// and NO each centred in its half, and the time left as one line along the
// foot that drains in toward the centre. A dash is green for yes, red for no,
// the track while the seat has not voted. The two words are plain and never
// light: a click casts the vote and your dash is the answer. Everything sits
// on one centre line.
const VOTE_W = 64, VOTE_H = 38;
const VOTE_DASH = 8, VOTE_DASH_GAP = 2;
const VOTE_NO = '#c8463c';     // a no's dash
// is the panel up on this screen: your side has a vote open (or a failed
// one holding its dashes) and the match has not ended for you
function voteUp() {
  if (!player || state.over === 'won' || state.over === 'lost' || state.mode === 'title' || state.mode === 'drop') return false;
  return !!votes()[player.team] && hudHome();
}
// the panel's top edge: where the top-centre notes start (voteY, js/ui/rail.js)
function voteRect() { return { x: (VIEW_W - VOTE_W) >> 1, y: voteY(), w: VOTE_W, h: VOTE_H }; }
// the two words' click boxes: each half of the panel's lower band
function voteWords() {
  const r = voteRect(), half = VOTE_W >> 1;
  return [{ yes: true, x: r.x, y: r.y + 19, w: half, h: 13, cx: r.x + (VOTE_W >> 2) },
    { yes: false, x: r.x + half, y: r.y + 19, w: half, h: 13, cx: r.x + VOTE_W - (VOTE_W >> 2) }];
}
let voteHeard = false; // this screen has rung the panel's arrival (one cue per vote)
function drawVotePanel() {
  if (!voteUp()) { voteHeard = false; return; }
  if (!voteHeard) { voteHeard = true; SFX.ui(true); }
  const v = votes()[player.team], r = voteRect(), mid = r.x + (VOTE_W >> 1);
  drawHudFrame(r.x, r.y, r.w, r.h, { corners: { tl: true, tr: true, bl: true, br: true } });
  const ttl = 'SURRENDER?';
  drawPixelText(ctx, ttl, mid - (pixelTextWidth(ttl) >> 1), r.y + 6, '#f4f7ff');
  const T = voteTally(v, player.team), n = T.seats.length;
  const rw = n * VOTE_DASH + (n - 1) * VOTE_DASH_GAP, x0 = mid - (rw >> 1);
  T.seats.forEach((q, i) => {
    const yes = isHuman(q) ? v.yes.includes(q.id) : T.botsYes;
    const no = isHuman(q) && v.no.includes(q.id);
    ctx.fillStyle = yes ? HP_FILL : no ? VOTE_NO : RAIL_TRACK;
    ctx.fillRect(x0 + i * (VOTE_DASH + VOTE_DASH_GAP), r.y + 15, VOTE_DASH, 2);
  });
  for (const w of voteWords()) {
    const t = w.yes ? 'YES' : 'NO';
    drawPixelText(ctx, t, w.cx - (pixelTextWidth(t) >> 1), r.y + 22, '#f4f7ff');
  }
  const bw = VOTE_W - 6, fw = v.hold ? 0 : Math.round(bw * Math.max(0, v.t) / VOTE_T) & ~1;
  ctx.fillStyle = RAIL_TRACK; ctx.fillRect(r.x + 3, r.y + VOTE_H - 5, bw, 1);
  ctx.fillStyle = '#f4f7ff'; ctx.fillRect(mid - (fw >> 1), r.y + VOTE_H - 5, fw, 1);
}
// a press over the panel: a word casts the vote, the rest of the plate just
// swallows the press so it never looses a shot under it
function voteClick() {
  if (!voteUp()) return false;
  const r = voteRect(), mx = mouse.x, my = mouse.y;
  if (mx < r.x || mx >= r.x + r.w || my < r.y || my >= r.y + r.h) return false;
  if (voteOpenFor(player)) {
    const w = voteWords().find((b) => mx >= b.x && mx < b.x + b.w && my >= b.y && my < b.y + b.h);
    if (w) { SFX.unlock(); player.input.cmd = { kind: 'vote', yes: w.yes }; }
  }
  return true;
}
