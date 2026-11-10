'use strict';
// The title's scene: what the landing page shows behind the logo and the
// words. Ten heroes stand on the frozen middle, five a side, facing each other
// across the merchant's boat at the match's own zoom - the game in one picture before a word is
// read. They are this screen's own bodies (never in `players`, never stepped
// by the sim, never sent): drawPlayer paints them in the sorted pass like
// any body, so they wear the real sprites, weapons, shade and team rings.
// Your own hero (the profile's last pick) leads the blue side; the other nine
// are dealt fresh each time the title opens.
const TITLE_AT = [9, 12];      // world px off the boat's tile the scene is framed on: the merchant's boat, frozen into the middle
                               // (off the map's centre on a map with no boat)
const TITLE_DRIFT = [3, 2];    // world px the camera breathes round it, each axis
// where each side's five stand, world px off the scene's centre, the leader first
// (your side as written, left of the boat; the rivals mirrored across it)
const TITLE_SPOTS = [[-62, -4], [-84, -30], [-80, 22], [-108, -8], [-102, -46]];
let titleBodies = null;

function titleSceneAt() {
  const c = WORLD * TILE / 2;
  let at = { x: c, y: c }, bd = Infinity;
  for (const l of landmarks) {
    const d = Math.hypot(l.tx * TILE - c, l.ty * TILE - c);
    if (l.key === 'boat' && d < bd) { bd = d; at = { x: l.tx * TILE, y: l.ty * TILE }; }
  }
  return { x: at.x + TITLE_AT[0], y: at.y + TITLE_AT[1] };
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
  const n = TITLE_SPOTS.length;
  for (let i = 0; i < n * 2; i++) {
    const mine = i < n, sp = TITLE_SPOTS[i % n];
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
  const n = TITLE_SPOTS.length, mine = i < n, k = i % n, sp = TITLE_SPOTS[k], at = titleSceneAt();
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
