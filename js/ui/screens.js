'use strict';
// The screens around a match's end: the rolling replay window, the death
// overlay and spectating. The victory and defeat ceremonies
// are js/ui/endscreens.js.
// ------------------------------------------------------------ replay
// A rolling four seconds of the world, kept as pixels rather than as state,
// played back while you are dead or paused. A DEATH gets the RECAP:
// the whole frame, the way a goal replays - the ally view (a respawn wait)
// waits underneath until its close box or ESC
// puts it away, and the RESPAWNING IN Ns
// line and the ESC BACK prompt draw over it. A lost match gets none. PAUSE gets the WINDOW: the
// bottom-left corner at RP_W x RP_H, under the pause planks.
//
// The capture is the WORLD LAYER itself (worldCv, one sample per world px,
// before the blit scales it), with the k it was blitted at, so the recap
// draws it back at that same k and every world px lands on the same k x k
// block of device px it had live - pixel-exact at any resting zoom, zoomed
// in or not. Only a view wider than the cap (zoomed out past RP_CAP_W world
// px) is reduced. The snowfall and the vignettes draw after the blit, and
// the HUD after the capture, so none of the three is in it. The corner
// window cannot be exact: its 160x90
// canvas px hold a sixteenth of the view, and the detail is gone before it
// is drawn. The same corner of the SCREEN is RP_W*devScale wide (480 device
// px at a 1080p fullscreen's 3x), so the window's frame goes to its own
// device-resolution canvas (#replay) laid over that rect, and the game
// canvas draws only the plate, the rim, the playhead and a low-res copy
// underneath (which keeps the feature legible in a plain canvas.toDataURL()
// capture).
//
// Capture is one drawImage every 1/RP_FPS s while you are alive, straight off
// the finished world pass - never a getImageData / toDataURL readback, and
// nothing allocated per frame.
const RP_W = 160, RP_H = 90;    // the pause window in the corner, in GAME px: 16:9, a quarter of the view
const RP_CLOSE = 12;            // the recap's close box, on the frame's top-right corner
const RP_SECS = 4;              // seconds held
const RP_FPS = 30;              // frames captured per second, and played back at
const RP_RATE = 1;              // playback speed: real time
const RP_N = RP_SECS * RP_FPS;  // slots in the ring
const RP_COLS = 12;             // atlas grid; RP_N / RP_COLS rows
const RP_PAD = 4;               // inset from the bottom-left corner
// the biggest slot the ring will ever allocate, and so the memory ceiling:
// RP_CAP_W * RP_CAP_H * 4 * RP_N bytes (640x360 -> 110 MB). In world px: the
// default zoom and every zoom closer fit whole; zoomed further out, the
// view is reduced to fit.
const RP_CAP_W = 640, RP_CAP_H = 360;

// the device-resolution layer: sized and placed over the window's rect by
// layoutReplay(), which relayout() calls on every canvas-size change
const rpOv = document.getElementById('replay');
const rpOvx = rpOv.getContext('2d');

// The ring is one atlas canvas of RP_N slots. Slots are square-off cells of
// rpSW x rpSH; each frame records the size it was actually captured at, so a
// resize changes what the NEXT frames look like without invalidating - or
// rescaling - the ones already banked. The atlas only ever grows.
let rpAt = null, rpAtx = null;
let rpSW = 0, rpSH = 0;                  // current slot size
const rpFW = new Int16Array(RP_N);       // per-frame captured size (0 = empty slot)
const rpFH = new Int16Array(RP_N);
const rpFK = new Float32Array(RP_N);     // per-frame device px per captured px, as it was blitted live

let rpHead = 0;     // slot the next capture goes in
let rpCount = 0;    // slots filled, <= RP_N
let rpAcc = 0;      // seconds banked toward the next capture
let rpPlay = 0;     // playhead, in frames
let rpLast = 0;     // previous render's clock; the delta for both timers
let rpOpen = false; // was the window up last frame (a fresh open restarts the loop)
let rpVis = false, rpAlpha = -1, rpOvW = 0, rpOvH = 0; // last state pushed to the overlay

// What to capture at, this frame: the world view at one sample per world
// px, reduced only past the memory ceiling - and the device px each captured
// px covered on screen, which is what the recap draws it back at
function rpTarget() {
  const s = Math.min(1, RP_CAP_W / WV_W, RP_CAP_H / WV_H);
  return [Math.max(1, Math.round(WV_W * s)), Math.max(1, Math.round(WV_H * s)), zoomCur * devScale / s];
}

function rpSlotAt(i, sw, sh) { return [(i % RP_COLS) * sw, ((i / RP_COLS) | 0) * sh]; }

// Grow the atlas so a w x h frame fits a slot, carrying every banked frame
// over at its own resolution. Only a resize or a zoom that raises devScale
// gets here, and only ever upward, so a window being dragged about does not
// reallocate on every step - and no frame is ever dropped for it.
function rpEnsure(w, h) {
  if (rpAt && w <= rpSW && h <= rpSH) return;
  const nw = Math.max(w, rpSW), nh = Math.max(h, rpSH);
  const cv = document.createElement('canvas');
  cv.width = nw * RP_COLS;
  cv.height = nh * Math.ceil(RP_N / RP_COLS);
  const cx = cv.getContext('2d');
  // the capture is a reduction whenever the view outruns the corner, and
  // nearest would sample 1px in 9 there - an arrow in flight would strobe
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'medium';
  cx.fillStyle = '#06091a';
  cx.fillRect(0, 0, cv.width, cv.height); // slots are opaque before they are filled
  if (rpAt) {
    for (let i = 0; i < RP_N; i++) {
      if (!rpFW[i]) continue;
      const o = rpSlotAt(i, rpSW, rpSH), n = rpSlotAt(i, nw, nh);
      cx.drawImage(rpAt, o[0], o[1], rpFW[i], rpFH[i], n[0], n[1], rpFW[i], rpFH[i]);
    }
  }
  rpAt = cv; rpAtx = cx; rpSW = nw; rpSH = nh;
}

// Recording runs exactly while the local player is alive and the sim is
// stepping - the same condition update() plays on - and on through its own
// fall (goingDown, js/draw/bodies.js), so the recap ends on it. The overlays that freeze
// the sim would otherwise pack the ring with copies of one still frame, and
// death freezes the strip on the four seconds that led to it. The map does
// not freeze anything, and the capture point is above its dim, so the ring
// keeps banking clean world frames while the chart is up.
function replayLive() {
  if (state.paused || state.settingsOpen || !player.active) return false;
  return goingDown(player) || (state.mode === 'play' && !player.dead);
}

// up on a death until it is closed (a respawn wait, once its half second
// has landed - the recap) and on pause (the corner
// window); never under a full-screen panel
function replayShowing() {
  if (!rpCount || window.DBG.hideUI || state.mapOpen || state.settingsOpen || goingDown(player)) return false;
  if (state.paused) return true;
  // not over an end screen: both are compositions, and the frame is theirs
  if (state.mode !== 'dead' || endScreen() || !deadReady()) return false;
  // a respawn wait only: a lost match has just been watched live (the bird's
  // flight is the camera's, js/sim/eagle.js), and its screen is the defeat's
  return !state.rpClosed && state.over === 'respawning';
}

// Which of the two it is this frame: the recap fills the view on a death,
// the window sits in the bottom-left corner on pause
function rpFull() { return state.mode === 'dead'; }
function rpRect() {
  if (rpFull()) return { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
  return { x: RP_PAD, y: VIEW_H - RP_H - RP_PAD, w: RP_W, h: RP_H };
}
// the recap's close box: a small plank inside the frame's top-right corner
function rpCloseRect() {
  return { x: VIEW_W - RP_CLOSE - 4, y: 4, w: RP_CLOSE, h: RP_CLOSE };
}
function rpCloseHit() {
  if (!rpFull() || !replayShowing()) return false;
  const c = rpCloseRect();
  return mouse.x >= c.x - 2 && mouse.x < c.x + c.w + 2 && mouse.y >= c.y - 2 && mouse.y < c.y + c.h + 2;
}
// the recap is up: what draws under it (the ally view's strip, the death dim
// and its planks) waits, and a press puts it away
function replayFull() { return rpFull() && replayShowing(); }
function replayClose() { state.rpClosed = true; SFX.pickup(); }

// the overlay tracks the game canvas: the window's rect, at the canvas's
// scale, in device pixels
let rpKey = '';
function layoutReplay() {
  const b = canvas.getBoundingClientRect(), r = rpRect();
  rpKey = r.x + ',' + r.y + ',' + r.w;
  rpOv.style.left = (b.left + r.x * scale) + 'px';
  rpOv.style.top = (b.top + r.y * scale) + 'px';
  rpOv.style.width = (r.w * scale) + 'px';
  rpOv.style.height = (r.h * scale) + 'px';
}

// one call per frame from render(), at the capture point: it owns the clock,
// and either banks a frame or advances the playhead - never both
function replayTick(now) {
  const dt = rpLast ? Math.min(0.05, now - rpLast) : 0;
  rpLast = now;
  if (replayLive()) {
    rpOpen = false;
    rpAcc += dt;
    if (rpAcc < 1 / RP_FPS) return;
    // carry the remainder so the cadence averages out, but never bank more
    // than one period of debt: below RP_FPS that would spiral
    rpAcc = Math.min(rpAcc - 1 / RP_FPS, 1 / RP_FPS);
    const [cw, ch, ck] = rpTarget();
    rpEnsure(cw, ch);
    const [sx, sy] = rpSlotAt(rpHead, rpSW, rpSH);
    // the slot may be wider than this frame (a shrunk view after a resize):
    // clear it so the last tenant does not fringe the new one
    rpAtx.fillStyle = '#06091a';
    rpAtx.fillRect(sx, sy, rpSW, rpSH);
    rpAtx.drawImage(worldCv, 0, 0, WV_W * WD, WV_H * WD, sx, sy, cw, ch);
    if (airOn) rpAtx.drawImage(airCv, 0, 0, WV_W * WD, WV_H * WD, sx, sy, cw, ch); // the fliers ride over it (render())
    rpFW[rpHead] = cw; rpFH[rpHead] = ch; rpFK[rpHead] = ck;
    rpHead = (rpHead + 1) % RP_N;
    if (rpCount < RP_N) rpCount++;
    return;
  }
  if (!replayShowing()) { rpOpen = false; return; }
  if (!rpOpen) { rpOpen = true; rpPlay = 0; } // every open starts four seconds back
  rpPlay += dt * RP_FPS * RP_RATE;
  if (rpPlay >= rpCount) rpPlay -= Math.floor(rpPlay / rpCount) * rpCount;
}

// the overlay's whole public surface: shown/hidden and faded with the screen,
// and touched only when something actually changed
function rpOverlay(on, a) {
  if (on !== rpVis) {
    rpVis = on;
    rpOv.style.display = on ? 'block' : 'none';
    if (on) layoutReplay();
  }
  if (on && a !== rpAlpha) { rpAlpha = a; rpOv.style.opacity = a; }
}

// The recap: the frame itself, the playhead sweeping its bottom edge, a
// close box in its top-right corner and the ESC prompt at its foot. The
// window: the strip on a frost plate with the playhead on the bottom rim.
// No label either way - a looping picture under a sweeping playhead is what
// a recording looks like, and a box with a
// cross in it is how a picture closes.
function renderReplay() {
  if (!replayShowing()) { rpOverlay(false, 1); return; }
  const r = rpRect(), x = r.x, y = r.y, w = r.w, h = r.h;
  const i = Math.min(rpCount - 1, Math.max(0, Math.floor(rpPlay)));
  const slot = (rpHead - rpCount + i + RP_N) % RP_N;
  const [sx, sy] = rpSlotAt(slot, rpSW, rpSH);
  const fw = rpFW[slot], fh = rpFH[slot];
  if (rpFull()) {
    rpOverlay(false, 1); // the recap is the canvas's own
    ctx.fillStyle = '#06091a';
    ctx.fillRect(0, 0, w, h);
    // the world frame back at the k it was blitted at live, from the same
    // top-left corner, nearest: the same block of device px per world px
    if (fw) {
      const k = rpFK[slot] / devScale;
      ctx.drawImage(rpAt, sx, sy, fw, fh, 0, 0, fw * k, fh * k);
    }
    // the playhead, two px along the bottom edge
    ctx.fillStyle = '#0a0e23';
    ctx.fillRect(0, h - 3, w, 3);
    ctx.fillStyle = '#c89a3c';
    ctx.fillRect(0, h - 2, Math.round(w * Math.min(1, rpPlay / rpCount)), 2);
    // the close box, lit gold under the pointer
    const c = rpCloseRect(), hot = rpCloseHit();
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
    ctx.fillStyle = hot ? '#1f2b5c' : '#141c3c'; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = hot ? '#c89a3c' : '#35426e';
    ctx.fillRect(c.x, c.y, c.w, 1); ctx.fillRect(c.x, c.y + c.h - 1, c.w, 1);
    ctx.fillRect(c.x, c.y, 1, c.h); ctx.fillRect(c.x + c.w - 1, c.y, 1, c.h);
    ctx.fillStyle = hot ? '#ffd95c' : '#cfe0ff';
    for (let k = 0; k < 6; k++) { ctx.fillRect(c.x + 3 + k, c.y + 3 + k, 1, 1); ctx.fillRect(c.x + 8 - k, c.y + 3 + k, 1, 1); }
    drawRecap(); // why: who hit you, with what, how much (js/ui/recap.js)
    // the way back to the allies: the key cap with its verb, over the world, so it wears the outline the world demands
    const verb = tr('end.back');
    drawKeyPrompt(Math.round((w - promptW(verb, 'esc')) / 2), h - 18, verb, false, 'esc');
    return;
  }
  ctx.fillStyle = '#0a0e23';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  // the low-res copy in the game canvas: the overlay covers it exactly, so
  // this is only ever seen in a raw canvas capture or if the layer is off
  if (fw) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(rpAt, sx, sy, fw, fh, x, y, w, h);
    ctx.imageSmoothingEnabled = false;
  }
  // the pale frost rim every other plate in the UI wears
  ctx.fillStyle = '#35426e';
  ctx.fillRect(x - 1, y - 1, w + 2, 1);
  ctx.fillRect(x - 1, y + h, w + 2, 1);
  ctx.fillRect(x - 1, y - 1, 1, h + 2);
  ctx.fillRect(x + w, y - 1, 1, h + 2);
  // playhead along the bottom rim: where the loop is, and the only thing that
  // says this window is a recording rather than a second camera
  ctx.fillStyle = '#c89a3c';
  ctx.fillRect(x - 1, y + h, Math.round((w + 2) * Math.min(1, rpPlay / rpCount)), 1);

  // and the real thing, at device resolution, over the top
  if (!fw) { rpOverlay(false, 1); return; }
  if (rpVis && rpKey !== r.x + ',' + r.y + ',' + r.w) layoutReplay(); // the window moved (a resize, or the corner after a wait)
  if (rpOvW !== fw || rpOvH !== fh) {
    rpOvW = rpOv.width = fw; rpOvH = rpOv.height = fh;
    rpOvx.imageSmoothingEnabled = false; // resizing a canvas resets ctx state
  }
  rpOvx.drawImage(rpAt, sx, sy, fw, fh, 0, 0, fw, fh); // 1:1, never resampled
  rpOverlay(true, state.fade ? Math.max(0, 1 - state.fade.a) : 1);
}

// ------------------------------------------------------------ death & spectate
// The local player's ELIMINATION ('lost') - or a respawn-pending death
// ('respawning', see die()/updateRespawns) - or its win, once every RIVAL
// TEAM is gone (teams win together, see checkLastStanding) - puts the game
// in mode 'dead' with the match running on underneath. 'lost' dims the
// screen under one line and goes on to the defeat banner by itself (lostBeat); 'respawning' has no plank - it opens straight
// onto an ally (endMatch picks one through specNext, which keeps to the side
// while the wait runs) under one line, RESPAWNING IN Ns, with the replay
// window large over the view until it is closed, and snaps back to 'play' on
// its own once the timer clears; a win
// hands the whole frame to the victory banner (js/ui/endscreens.js), LOBBY
// under it. A won or lost match is decided for everyone, so there is nothing
// left to watch or play on: LOBBY is the only plank, on the victory banner and
// on the defeat banner - the loss's own summary, the mirror of the victory screen. A respawn wait follows an ally through a top-centre control: two
// pixel arrows around the name, clickable, the arrow keys do the same (no hint
// text: the arrows are the explanation). LOBBY fades out and reloads into the title screen on the same seed. viewPlayer() is who the camera and minimap
// frame, and the only thing the rest of the file needs to know about any of it.
const DEAD_BW = 112, DEAD_BH = 20, DEAD_GAP = 12; // the title menu plank, side by side
const DEAD_ITEMS = { lost: [], won: ['end.lobby'], respawning: [], hostleft: ['end.lobby'] }; // hostleft: a guest whose host left mid-match - no win, no loss, the door

// the planks on offer: the defeat summary has nothing left to offer but the
// door, so it is the one view whose items are its own rather than the ending's
function deadItems() {
  return state.deadView === 'defeat' ? ['end.lobby'] : (DEAD_ITEMS[state.over] || DEAD_ITEMS.hostleft);
}

// a full-frame end screen is up: the HUD and the replay window both bow out
// under one, because both are compositions and both put something exactly
// where those sit
function endScreen() {
  return state.mode === 'dead' && (state.over === 'won' || state.deadView === 'defeat' || state.deadView === 'scores');
}

function viewPlayer() {
  if (goingDown(player)) return player; // your own fall is watched through before the view hands over
  const q = state.spec >= 0 ? players[state.spec] : null;
  return q && q.active && !q.dead ? q : player;
}

function deadLayout() {
  const items = deadItems();
  const w = items.length * DEAD_BW + (items.length - 1) * DEAD_GAP;
  const x0 = Math.round((VIEW_W - w) / 2);
  // both end screens seat them at the foot of the same composition, under
  // the tally; the death dim keeps the middle of the screen it always had
  const y = endScreen() ? winLayout().plankY : Math.round(VIEW_H / 2) + 10;
  return items.map((label, i) => ({ x: x0 + i * (DEAD_BW + DEAD_GAP), y, w: DEAD_BW, h: DEAD_BH, label }));
}

// the overlay has finished arriving and the planks are live: half a second
// for a death, the whole ceremony for either end screen (both skippable)
function deadReady() {
  if (state.deadView === 'defeat') return state.defeatT >= DEF_T.menu;
  return state.deadTimer >= (state.over === 'won' ? WIN_T.menu : 0.5);
}

// a press during either ceremony jumps to its end instead of being swallowed;
// true means it was consumed and the caller should do nothing else. The plain
// death dim has nothing to skip - it is half a second of fade, not a reward.
function endSkip() {
  if (lostBeat()) { if (state.deadTimer >= 0.5) { openDefeat(); SFX.pickup(); } return true; } // the loss's one line: a press goes on to the ceremony
  if (deadReady()) return false;
  if (state.deadView === 'defeat') { state.defeatT = DEF_T.menu; SFX.pickup(); return true; }
  if (state.over !== 'won') return false;
  state.deadTimer = WIN_T.menu;
  SFX.pickup();
  return true;
}

// A lost match holds LOST_BEAT s on its one line (YOUR EAGLE WAS DRIVEN OFF,
// or a 1V1's reason) over the dimmed world, with nothing to press, and then
// the defeat ceremony opens itself (renderDead), the way a win goes straight
// to its own: there is no looping recap and no plank between the two.
const LOST_BEAT = 2.4;
function lostBeat() { return state.over === 'lost' && state.deadView === 'menu'; }
// the loss's summary, on its own clock (the death overlay's has been running
// since the bird left)
function openDefeat() {
  state.deadView = 'defeat';
  state.defeatT = 0;
  state.deadSel = 0;
  state.deadHover = [0, 0];
}

// the spectate control, top centre: [<] FACE HERO [>], on the HUD's graphite. Arrow boxes are SPEC_AW
// wide; the plate between them is sized to the widest hero name so the
// arrows never jump as the target changes.
const SPEC_Y = 6, SPEC_H = 20, SPEC_AW = 13, SPEC_FACE = 16;
function specName(p) { return CLASSES[p.cls] ? CLASSES[p.cls].name : p.name; } // who you are watching, by the hero on the field
function specLayout() {
  let nw = 0;
  for (const p of players) if (p.active) nw = Math.max(nw, pixelTextWidth(specName(p), 2));
  const w = SPEC_AW + 3 + SPEC_FACE + 5 + nw + 5 + SPEC_AW;
  const x = Math.round((VIEW_W - w) / 2);
  const rb = railBottom(); // the team rail keeps the top edge while you are out (ui.js)
  const y = rb ? rb + 4 : SPEC_Y;
  return { x, y, w, h: SPEC_H,
    left: { x, y, w: SPEC_AW, h: SPEC_H },
    right: { x: x + w - SPEC_AW, y, w: SPEC_AW, h: SPEC_H } };
}
// which spectate arrow the pointer is on: -1 left, 1 right, 0 neither
function specHit() {
  if (state.deadView !== 'spec') return 0;
  const L = specLayout();
  const inR = (r) => mouse.x >= r.x - 2 && mouse.x < r.x + r.w + 2 && mouse.y >= r.y - 2 && mouse.y < r.y + r.h + 2;
  return inR(L.left) ? -1 : inR(L.right) ? 1 : 0;
}

// which plank is under the pointer (-1 for none); the overlay must have faded
// in, and spectating has planks of its own (the two arrows) rather than these
function deadHit() {
  if (state.deadView === 'spec' || !deadReady()) return -1;
  const rs = deadLayout();
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    if (mouse.x >= r.x - 2 && mouse.x < r.x + r.w + 2 && mouse.y >= r.y - 3 && mouse.y < r.y + r.h + 3) return i;
  }
  return -1;
}

function deadActivate(i) {
  const label = deadLayout()[i].label;
  SFX.place();
  if (label === 'end.lobby') openScores(state.deadView); // the post-game lobby (js/ui/lobby.js); its own LOBBY leaves
}

// who can be watched while a respawn wait runs: a living ally only - the wait
// is not a scouting window
function specOk(q) {
  return q !== player && q.active && !q.dead && q.team === player.team;
}
// follow the next watchable player in player order (dir -1 for the previous one)
function specNext(dir) {
  const n = players.length;
  let i = state.spec;
  for (let k = 0; k < n; k++) {
    i = ((i + dir) % n + n) % n;
    // the camera leaving your own body for somebody else's is the one moment
    // the player is not IN the world any more, and it had no sound at all -
    // the view simply jumped across the map. Once per handover, not once per
    // candidate the loop skips over.
    if (specOk(players[i])) { if (state.spec !== i) SFX.spectate(); state.spec = i; return; }
  }
  state.spec = -1; // nobody left to watch
}

// back to the title screen: fade to dark and reload this seed - or, after a
// match in a room, onto a fresh valley with the room reopened around the same
// people and sides (rematchUrl, js/ui/rooms.js)
function toLobby() {
  if (state.fade) return;
  SFX.music.stop(0.4);
  const next = rematchUrl() || location.pathname + location.search;
  state.fade = {
    a: 0, to: 1, spd: 1 / 0.5, color: '#06081a',
    then: () => { location.href = next; },
  };
}

function deadKey(k) {
  if (state.fade) return;
  if (state.deadView === 'scores') { scoresKey(k); return; } // the post-game record owns its own controls
  // the recap takes every back key and puts itself away: the allies are underneath
  if (replayFull()) {
    if (k === 'escape' || k === 'backspace' || k === 'enter' || k === ' ') replayClose();
    return;
  }
  if (state.deadView === 'spec') {
    // a respawn wait has no planks to go back to: a back key does nothing
    if (moveDir(k) === 'right') { specNext(1); SFX.pickup(); }
    else if (moveDir(k) === 'left') { specNext(-1); SFX.pickup(); }
    return;
  }
  if (endSkip()) return;
  if (!deadReady()) return;
  const n = deadLayout().length;
  if (moveDir(k) === 'left') { state.deadSel = (state.deadSel + n - 1) % n; SFX.pickup(); }
  else if (moveDir(k) === 'right') { state.deadSel = (state.deadSel + 1) % n; SFX.pickup(); }
  else if (k === 'enter' || k === ' ') deadActivate(state.deadSel);
}

function deadClick() {
  if (state.fade) return;
  if (state.deadView === 'scores') { scoresClick(); return; }
  if (replayFull()) { if (!recapClick()) replayClose(); return; } // the recap's fold buttons (js/ui/recap.js); any other press puts it away, as its keys do
  if (state.deadView === 'spec') {
    const d = specHit(); if (d) { specNext(d); SFX.pickup(); }
    return;
  }
  if (endSkip()) return;
  const h = deadHit();
  if (h >= 0) { state.deadSel = h; deadActivate(h); }
}

// the wait, and not a word more: the recap, then the ally the camera is on,
// is the screen, and the number is the only thing to read (a FIRST MATCH adds
// its coach's card, the lesson of that death: renderGuideDead, js/ui/guide.js). 3x in the upper
// band where an eye lands, 2x on a view too narrow to hold it.
function drawRespawnLine() {
  const t = tr('end.respawn', { s: Math.max(0, Math.ceil(player.respawnT)) });
  const ts = pixelTextWidth(t, 3) <= VIEW_W - 20 ? 3 : 2;
  drawPixelTextOutline(ctx, t, Math.round((VIEW_W - pixelTextWidth(t, ts)) / 2),
    Math.max(frameTop() + 30, noteY() + ANN_FACE + 2 * ANN_PAD + 6), '#cfe4f2', '#0a0e23', ts); // clear of the spectate bar and a call under it
}

function renderDead(now) {
  if (state.deadView === 'scores') { renderScores(now); return; } // the post-game record (js/ui/lobby.js)
  // the recap owns the frame: only a respawn wait's countdown reads over it
  if (replayFull()) { if (state.over === 'respawning') { drawRespawnLine(); renderGuideDead(now); } return; }
  if (state.deadView === 'spec') {
    // top centre: [<] FACE HERO [>]. The watched hero's face and name at 2x over a rule in its side's
    // colour; each arrow is its own box that lights gold under the
    // pointer, so the control explains itself without a word of hint.
    const vp = viewPlayer();
    const L = specLayout();
    const hit = specHit();
    ctx.fillStyle = HUD_INK; ctx.fillRect(L.x, L.y, L.w, L.h);
    ctx.fillStyle = AB_BG; ctx.fillRect(L.x + 1, L.y + 1, L.w - 2, L.h - 2);
    for (const dir of [-1, 1]) {
      const r = dir < 0 ? L.left : L.right;
      const hot = hit === dir;
      ctx.fillStyle = hot ? '#3a3e46' : HUD_EDGE;
      ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      // a 5-tall chevron, 2 px thick, pointing out of the plate
      const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
      ctx.fillStyle = hot ? '#ffd95c' : '#d4d7dc';
      for (let i = 0; i < 4; i++) {
        const px = dir < 0 ? cx - 2 + i : cx + 1 - i;
        ctx.fillRect(px - (dir < 0 ? 0 : 1), cy - i, 2, 1); ctx.fillRect(px - (dir < 0 ? 0 : 1), cy + i, 2, 1);
      }
    }
    const fx = L.x + SPEC_AW + 3, tx = fx + SPEC_FACE + 5;
    if (vp !== player) {
      const nm = specName(vp);
      drawFace(fx, L.y + 2, SPEC_FACE, vp);
      drawPixelText(ctx, nm, tx, L.y + 4, '#f4f7ff', 2);
      ctx.fillStyle = TEAMS[skin(vp.team)].mark; ctx.fillRect(tx, L.y + 16, pixelTextWidth(nm, 2), 1);
    } else {
      // nobody left to watch: an empty plate with a dim dash where a name would be
      ctx.fillStyle = '#6c717a';
      ctx.fillRect(Math.round(L.x + L.w / 2) - 4, L.y + 9, 8, 2);
    }
    if (state.over === 'respawning') { drawRespawnLine(); renderGuideDead(now); }
    return;
  }
  if (state.deadView === 'defeat') { renderDefeat(now); return; } // the loss's own summary
  if (state.over === 'won') { renderVictory(now); return; } // a win gets a ceremony, not a dim
  const a = Math.min(0.75, state.deadTimer * 0.6);
  ctx.fillStyle = 'rgba(8,10,28,' + a + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (state.deadTimer < 0.5) return;
  // The elimination's headline sits in the upper band, not over the middle
  // of the screen: it is the first thing to read and the match is still
  // playing underneath, so it goes where an eye lands rather than where the
  // body fell. 3x, or 2x on a view too narrow to hold it (a 25-glyph line
  // is 297px at 3x).
  const gone = state.over === 'hostleft'; // the host walked out from under the match
  const why = gone ? '' : onevoneWhy(); // a 1V1 says how it was lost (js/sim/onevone.js)
  if (!gone && state.deadTimer >= LOST_BEAT) { openDefeat(); renderDefeat(now); return; } // a loss's beat is over: the ceremony, from this frame
  const t = gone ? tr('end.hostLeft') : why || tr('end.lost');
  const ts = pixelTextWidth(t, 3) <= VIEW_W - 20 ? 3 : 2;
  const toy = frameTop();
  drawPixelTextOutline(ctx, t, Math.round((VIEW_W - pixelTextWidth(t, ts)) / 2), toy + 34, '#cfe4f2', '#0a0e23', ts);
  if (!gone) return; // a loss says its one line and goes on; a host who left gets the line under it and the door
  const t2 = tr('end.hostLeftSub');
  drawPixelTextOutline(ctx, t2, Math.round((VIEW_W - pixelTextWidth(t2, 2)) / 2), toy + 34 + ts * 5 + 8, '#8f9cc4', '#0a0e23', 2);
  drawEndPlanks(now, 0);
}

// the words both endings share (LOBBY): hovered or keyboard-picked is hot, and the
// ease runs on the frame delta (it only steps while the overlay is up). dy
// slides them on screen without moving the rects deadHit() tests, so a plank
// is only clickable once it has arrived.
function drawEndPlanks(now, dy) {
  const rs = deadLayout();
  const hot = deadHit();
  const dt = Math.min(0.05, now - (drawEndPlanks.last || now)); drawEndPlanks.last = now;
  for (let i = 0; i < rs.length; i++) {
    const want = (hot >= 0 ? hot === i : state.deadSel === i) ? 1 : 0;
    state.deadHover[i] += (want - state.deadHover[i]) * Math.min(1, dt * 14);
    // the title screen's bare words: white, gold while hot
    const t = tr(rs[i].label);
    drawPixelTextOutline(ctx, t, Math.round(rs[i].x + (rs[i].w - pixelTextWidth(t, MENU_TXT_SCALE)) / 2),
      rs[i].y + dy + ((rs[i].h - 7 * MENU_TXT_SCALE) >> 1), state.deadHover[i] > 0.5 ? SC_GOLD : SC_LIT, SC_INK, MENU_TXT_SCALE);
  }
}
