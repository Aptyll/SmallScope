'use strict';
// The title's scene: what the landing page shows behind the logo and the
// words. Ten heroes stand near the middle of the map, five a side, facing
// each other at the match's own zoom - the game in one picture before a word is
// read. They are this screen's own bodies (never in `players`, never stepped
// by the sim, never sent): drawPlayer paints them in the sorted pass like
// any body, so they wear the real sprites, weapons, shade and team rings.
// Your own hero (the profile's last pick) leads the blue side; the other nine
// are dealt fresh each time the title opens.
//
// WHERE it stands is found, not written (titleSceneAt): the spot nearest the
// map's centre where the logo, the word column and all ten heroes each sit on
// one clean ground - open snow or plain paving, nothing standing on it, no
// brush, no ice. So the picture stays clean whatever the map's middle becomes.
const TITLE_DRIFT = [3, 2];    // world px the camera breathes round it, each axis
// where each side's five stand, world px off the scene's centre, the leader first
// (your side as written, left of the centre; the rivals mirrored across it)
const TITLE_SPOTS = [[-72, -2], [-92, -30], [-90, 24], [-104, -4], [-102, -52]];
const TITLE_LOGO = [232, 64];  // view px: the logo's room under LOGO_Y (the picture's size, a little air)
const TITLE_WORDS = [72, 6];   // view px half-width of the word column (its widest word and the diamond), and the rows it may hold
const TITLE_BODY = [18, 12, 44]; // world px a hero needs clean: each side of it, over its feet's row, and under it (a pine to its south stands that tall over it)
const TITLE_REACH = 44;        // tiles from the centre the search goes
const TITLE_STEP = 8;          // world px between two spots tried, and between two points of a rect sampled
const TITLE_EDGE = [22, 28];   // world px the formation keeps from the view's side, and from its foot
const TITLE_HEAD = 18;        // world px a body stands over its feet: the back row's heads start under the logo's foot
let titleBodies = null;
let titleFit = null;           // TITLE_SPOTS fitted to the view: { spots, key }
// THE FORMATION FITS THE VIEW: a smaller view (a 1600x900 window shows fewer
// world px than 1280x720) would put the back row level with the logo, so the
// spots slide down until their top row's heads stand under the logo's foot,
// and squeeze only when the room between the logo and the view's foot, or
// between its sides, is less than the formation's own
function titleSpots() {
  const key = VIEW_W + 'x' + VIEW_H;
  if (titleFit && titleFit.key === key) return titleFit.spots;
  const hw = VIEW_W / 2 / ZOOM_TITLE, hh = VIEW_H / 2 / ZOOM_TITLE;
  const ys = TITLE_SPOTS.map((sp) => sp[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const top = Math.max(y0, (LOGO_Y + TITLE_LOGO[1]) / ZOOM_TITLE - hh + TITLE_HEAD), bot = hh - TITLE_EDGE[1];
  const ky = Math.min(1, (bot - top) / (y1 - y0));
  const kx = Math.min(1, (hw - TITLE_EDGE[0]) / Math.max(...TITLE_SPOTS.map((sp) => -sp[0])));
  titleFit = { key, spots: TITLE_SPOTS.map((sp) => [Math.round(sp[0] * kx), Math.round(top + (sp[1] - y0) * ky)]) };
  return titleFit.spots;
}
let titleSpot = null;          // the found spot and the view it was found for: { x, y, key }

// what a world point stands on, for the picture: 'S' open snow, 'L' plain paving, 'X' anything else
function titleGround(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (!inWorld(tx, ty)) return 'X';
  const i = idx(tx, ty);
  if (objects[i] != null || cisternTouches(tx, ty)) return 'X';
  return ground[i] === 3 ? 'L' : ground[i] === 0 && !deepAt(x, y) ? 'S' : 'X';
}
// the one ground a world rect lies on, or 'X' when it is mixed or busy
function titleRectGround(x0, y0, x1, y1) {
  let g = null;
  for (let y = y0; y <= y1; y += TITLE_STEP) for (let x = x0; x <= x1; x += TITLE_STEP) {
    const c = titleGround(x, y);
    if (c === 'X' || (g && c !== g)) return 'X';
    g = c;
  }
  return g || 'X';
}
function titleSpotOk(X, Y) {
  const k = 1 / ZOOM_TITLE, hh = VIEW_H / 2;
  // the logo's room and the word column's, from the view's layout into world px
  if (titleRectGround(X - TITLE_LOGO[0] / 2 * k, Y + (LOGO_Y - hh) * k, X + TITLE_LOGO[0] / 2 * k, Y + (LOGO_Y + TITLE_LOGO[1] - hh) * k) === 'X') return false;
  // ...the column runs to the view's foot, so nothing is cut off under the last word
  const wy0 = VIEW_H - MENU_BOTTOM - TITLE_WORDS[1] * MENU_TXT_PITCH;
  if (titleRectGround(X - TITLE_WORDS[0] * k, Y + (wy0 - hh) * k, X + TITLE_WORDS[0] * k, Y + hh * k) === 'X') return false;
  let g = null;
  for (const sp of titleSpots()) for (const m of [1, -1]) {
    const c = titleRectGround(X + m * sp[0] - TITLE_BODY[0], Y + sp[1] - TITLE_BODY[1], X + m * sp[0] + TITLE_BODY[0], Y + sp[1] + TITLE_BODY[2]);
    if (c === 'X' || (g && c !== g)) return false;
    g = c;
  }
  return true;
}
// the nearest clean spot to the centre, ring by ring outward; the centre itself when the map has none
function titleSceneAt() {
  const key = VIEW_W + 'x' + VIEW_H;
  if (titleSpot && titleSpot.key === key) return titleSpot;
  const c = WORLD * TILE / 2, n = Math.floor(TITLE_REACH * TILE / TITLE_STEP);
  let best = null, bd = Infinity;
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const d = i * i + j * j;
    if (d >= bd || !titleSpotOk(c + i * TITLE_STEP, c + j * TITLE_STEP)) continue;
    bd = d; best = { x: c + i * TITLE_STEP, y: c + j * TITLE_STEP };
  }
  titleSpot = Object.assign(best || { x: c, y: c }, { key });
  return titleSpot;
}
// the title's camera: the scene, breathing a few px so the picture is never dead still
function titleCamTarget() {
  const s = titleSceneAt(), t = state.menu.camT;
  return {
    x: s.x + Math.cos(t * 0.11 + 0.7) * TITLE_DRIFT[0] - WV_W / 2,
    y: s.y + Math.sin(t * 0.083 + 0.7) * TITLE_DRIFT[1] - WV_H / 2,
  };
}
// ten different heroes: yours first, the rest shuffled off this boot's clock
function titleDeal() {
  const pool = CLASSES.map((c, i) => i).filter((i) => i !== player.cls);
  let s = (Date.now() >>> 0) || 1;
  for (let i = pool.length - 1; i > 0; i--) {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    const j = s % (i + 1), h = pool[i]; pool[i] = pool[j]; pool[j] = h;
  }
  return [player.cls].concat(pool);
}
function titleCast() {
  if (titleBodies && titleBodies[0].cls === player.cls && titleBodies[0].team === player.team) return titleBodies;
  const deal = titleDeal(), at = titleSceneAt();
  titleBodies = [];
  const spots = titleSpots(), n = spots.length;
  for (let i = 0; i < n * 2; i++) {
    const mine = i < n, sp = spots[i % n];
    const b = new Player(100 + i, 'none', mine ? player.team : 1 - player.team);
    setClass(b, deal[i % deal.length]);
    if (i === 0) b.skins = player.skins; // your own look on your own hero
    b.aboard = false;
    b.x = at.x + (mine ? sp[0] : -sp[0]); b.y = at.y + sp[1];
    b.dir = mine ? 'right' : 'left'; b.aimA = mine ? 0 : Math.PI;
    titleBodies.push(b);
  }
  return titleBodies;
}
// THE CAST LIVES: nobody stands dead still for minutes. Off the menu's own clock
// (never the sim's), each body but the two leaders now and then paces a few px
// toward the middle and back, or turns its face to you for a breath. A pure
// read of the time, so a repaint of the same instant draws the same picture.
const TITLE_PACE = 12;         // world px a pace covers
const TITLE_PACE_T = 0.9;      // s each way
const TITLE_PACE_HOLD = 2.2;   // s it stands at the far end
const TITLE_LOOK_T = 1.8;      // s a face is turned to you
const TITLE_ACT_EVERY = 11;    // s between one body's acts, give or take its seat
function titleCastPose(b, i, t) {
  const spots = titleSpots(), n = spots.length, mine = i < n, k = i % n, sp = spots[k], at = titleSceneAt();
  const hx = at.x + (mine ? sp[0] : -sp[0]), toward = mine ? 1 : -1, face = mine ? 'right' : 'left', back = mine ? 'left' : 'right';
  b.x = hx; b.y = at.y + sp[1]; b.dir = face; b.moving = false; b.vx = 0; b.animT = 0;
  if (k === 0) return; // a leader holds its ground
  const every = TITLE_ACT_EVERY + k * 1.7, u = (t + i * 3.1) % every;
  if (k % 2 === 0) { // turns to you
    if (u < TITLE_LOOK_T) b.dir = 'down';
    return;
  }
  const out = TITLE_PACE_T, far = out + TITLE_PACE_HOLD, home = far + TITLE_PACE_T;
  if (u < out) { b.x = hx + toward * TITLE_PACE * (u / out); b.moving = true; b.vx = toward * 20; }
  else if (u < far) b.x = hx + toward * TITLE_PACE;
  else if (u < home) { b.x = hx + toward * TITLE_PACE * (1 - (u - far) / TITLE_PACE_T); b.moving = true; b.vx = -toward * 20; b.dir = back; }
  if (b.moving) b.animT = t * SHOW_STRIDE; // a walk's stride (js/ui/select.js)
  b.x = Math.round(b.x);
}
// into the sorted pass (bodyDraws, js/draw/passes.js), by the feet like every body
function titleCastDraws(draws) {
  if (state.mode !== 'title') return;
  titleCast().forEach((b, i) => { titleCastPose(b, i, state.menu.t); draws.push({ y: b.y + 8, p: b }); });
}
