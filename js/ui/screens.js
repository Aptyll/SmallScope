'use strict';
// The screens around a match's end: the rolling replay window, the death
// overlay and spectating, and the emotes. The victory and defeat ceremonies
// are js/ui/endscreens.js.
// ------------------------------------------------------------ replay
// A rolling four seconds of the world, kept as pixels rather than as state,
// played back while you are dead or paused. A DEATH gets the RECAP:
// the whole frame, the way a goal replays - the ally view (a respawn wait)
// or the elimination's planks wait underneath until its close box or ESC
// puts it away, and the RESPAWNING IN Ns
// line and the ESC BACK prompt draw over it. PAUSE gets the WINDOW: the
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

// up on a death until it is closed (a respawn wait or an elimination, once
// its half second of dim has landed - the recap) and on pause (the corner
// window); never under a full-screen panel
function replayShowing() {
  if (!rpCount || window.DBG.hideUI || state.mapOpen || state.settingsOpen || goingDown(player)) return false;
  if (state.paused) return true;
  // not over an end screen: both are compositions, and the frame is theirs
  if (state.mode !== 'dead' || endScreen() || !deadReady()) return false;
  return !state.rpClosed && (state.over === 'respawning' || state.deadView === 'menu');
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
    rpAtx.drawImage(worldCv, 0, 0, WV_W, WV_H, sx, sy, cw, ch);
    if (airOn) rpAtx.drawImage(airCv, 0, 0, WV_W, WV_H, sx, sy, cw, ch); // the fliers ride over it (render())
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
// screen and offers two planks; 'respawning' offers none - it opens straight
// onto an ally (endMatch picks one through specNext, which keeps to the side
// while the wait runs) under one line, RESPAWNING IN Ns, with the replay
// window large over the view until it is closed, and snaps back to 'play' on
// its own once the timer clears; a win
// hands the whole frame to the victory banner (js/ui/endscreens.js) and offers two of its
// own. LOBBY off an ELIMINATION does not leave: it hands the frame to the
// defeat banner - the loss's own summary, the mirror of the victory screen -
// and that screen's single plank is what leaves. A match you lost still ends
// on its numbers, and it ends when you are done watching rather than the
// instant you went down. SPECTATE follows a living player through a
// top-centre control: two pixel arrows around the name, clickable, the arrow
// keys do the same, ESC comes back (no hint text: the arrows are the
// explanation). LOBBY fades out and reloads into the title screen on the same seed. viewPlayer() is who the camera and minimap
// frame, and the only thing the rest of the file needs to know about any of it.
const DEAD_BW = 112, DEAD_BH = 20, DEAD_GAP = 12; // the title menu plank, side by side
const DEAD_ITEMS = { lost: ['end.spectate', 'end.lobby'], won: ['end.keepPlaying', 'end.lobby'], respawning: [], hostleft: ['end.lobby'] }; // hostleft: a guest whose host left mid-match - no win, no loss, the door

// the planks on offer: the defeat summary has nothing left to offer but the
// door, so it is the one view whose items are its own rather than the ending's
function deadItems() {
  return state.deadView === 'defeat' ? ['end.lobby'] : (DEAD_ITEMS[state.over] || DEAD_ITEMS.lost);
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
  if (deadReady()) return false;
  if (state.deadView === 'defeat') { state.defeatT = DEF_T.menu; SFX.pickup(); return true; }
  if (state.over !== 'won') return false;
  state.deadTimer = WIN_T.menu;
  SFX.pickup();
  return true;
}

// LOBBY on an elimination lands here first: the loss's summary, on its own
// clock (the death overlay's has been running since the body dropped)
function openDefeat() {
  state.deadView = 'defeat';
  state.defeatT = 0;
  state.deadSel = 0;
  state.deadHover = [0, 0];
  state.shake = Math.max(state.shake, 2);
}

// the spectate control, top centre: [<] NAME [>]. Arrow boxes are SPEC_AW
// wide; the name plate between them is sized to the widest player name so the
// arrows never jump as the target changes.
const SPEC_Y = 6, SPEC_H = 13, SPEC_AW = 11;
function specLayout() {
  let nw = 0;
  for (const p of players) if (p.active) nw = Math.max(nw, pixelTextWidth(p.name));
  const w = SPEC_AW + 6 + nw + 6 + SPEC_AW;
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
  // the door out of an elimination goes through the summary once; the
  // summary's own LOBBY (and every other ending's) actually leaves
  if (label === 'end.lobby' && state.over === 'lost' && state.deadView !== 'defeat') openDefeat();
  else if (label === 'end.lobby') openScores(state.deadView); // the post-game lobby (js/ui/lobby.js); its own LOBBY leaves
  else if (label === 'end.spectate') { state.deadView = 'spec'; state.spec = -1; specNext(1); }
  else if (label === 'end.keepPlaying') state.mode = 'play';
}

// who can be watched: any living player after an elimination, only the side's
// own while a respawn wait runs - the wait is not a scouting window
function specOk(q) {
  return q !== player && q.active && !q.dead && (state.over !== 'respawning' || q.team === player.team);
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
    if (k === 'escape' || k === 'backspace' || k === 'enter' || k === ' ') {
      // a respawn wait has no planks to go back to: the key does nothing
      if (state.over !== 'respawning') { state.deadView = 'menu'; SFX.pickup(); }
    }
    else if (moveDir(k) === 'right') { specNext(1); SFX.pickup(); }
    else if (moveDir(k) === 'left') { specNext(-1); SFX.pickup(); }
    return;
  }
  if (endSkip()) return;
  if (!deadReady()) return;
  if (emoteKey(k)) return; // the digits are the emote bar (the `emotes` banner)
  const n = deadLayout().length;
  if (moveDir(k) === 'left') { state.deadSel = (state.deadSel + n - 1) % n; SFX.pickup(); }
  else if (moveDir(k) === 'right') { state.deadSel = (state.deadSel + 1) % n; SFX.pickup(); }
  else if (k === 'enter' || k === ' ') deadActivate(state.deadSel);
}

function deadClick() {
  if (state.fade) return;
  if (state.deadView === 'scores') { scoresClick(); return; }
  if (replayFull()) { if (rpCloseHit()) replayClose(); else recapClick(); return; } // the close box, and the recap's fold buttons (js/ui/recap.js)
  if (state.deadView === 'spec') {
    const d = specHit(); if (d) { specNext(d); SFX.pickup(); }
    return;
  }
  if (endSkip()) return;
  if (emoteClick()) return; // a plate under the pointer plays its emote
  const h = deadHit();
  if (h >= 0) { state.deadSel = h; deadActivate(h); }
}

// the wait, and not a word more: the recap, then the ally the camera is on,
// is the screen, and the number is the only thing to read. 3x in the upper
// band where an eye lands, 2x on a view too narrow to hold it.
function drawRespawnLine() {
  const t = tr('end.respawn', { s: Math.max(0, Math.ceil(player.respawnT)) });
  const ts = pixelTextWidth(t, 3) <= VIEW_W - 20 ? 3 : 2;
  drawPixelTextOutline(ctx, t, Math.round((VIEW_W - pixelTextWidth(t, ts)) / 2),
    frameTop() + 30, '#cfe4f2', '#0a0e23', ts);
}

function renderDead(now) {
  if (state.deadView === 'scores') { renderScores(now); return; } // the post-game record (js/ui/lobby.js)
  // the recap owns the frame: only a respawn wait's countdown reads over it
  if (replayFull()) { if (state.over === 'respawning') drawRespawnLine(); return; }
  if (state.deadView === 'spec') {
    // top centre: [<] NAME [>]. The name sits on a plate in the target's
    // team colour; each arrow is its own box that lights gold under the
    // pointer, so the control explains itself without a word of hint.
    const vp = viewPlayer();
    const L = specLayout();
    const hit = specHit();
    ctx.fillStyle = 'rgba(12,18,42,0.82)';
    ctx.fillRect(L.x, L.y, L.w, L.h);
    const mark = vp === player ? '#8f9cc4' : TEAMS[skin(vp.team)].mark;
    ctx.fillStyle = mark;
    ctx.fillRect(L.x + SPEC_AW, L.y, L.w - SPEC_AW * 2, 1);
    ctx.fillRect(L.x + SPEC_AW, L.y + L.h - 1, L.w - SPEC_AW * 2, 1);
    for (const dir of [-1, 1]) {
      const r = dir < 0 ? L.left : L.right;
      const hot = hit === dir;
      ctx.fillStyle = hot ? '#1f2b5c' : '#141c3c';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = hot ? '#c89a3c' : '#35426e';
      ctx.fillRect(r.x, r.y, r.w, 1); ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
      ctx.fillRect(dir < 0 ? r.x : r.x + r.w - 1, r.y, 1, r.h);
      // a 4-wide chevron, pointing out of the plate
      const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
      ctx.fillStyle = hot ? '#ffd95c' : '#cfe0ff';
      for (let i = 0; i < 4; i++) {
        const px = dir < 0 ? cx - 2 + i : cx + 1 - i;
        ctx.fillRect(px, cy - i, 1, 1); ctx.fillRect(px, cy + i, 1, 1);
      }
    }
    if (vp !== player) {
      drawPixelTextShadow(ctx, vp.name, Math.round(L.x + (L.w - pixelTextWidth(vp.name)) / 2), L.y + 4, playerTint(vp), '#0a0e23');
    } else {
      // nobody left to watch: an empty plate with a dim dash where a name would be
      ctx.fillStyle = '#5a6690';
      ctx.fillRect(Math.round(L.x + L.w / 2) - 3, L.y + 6, 6, 1);
    }
    if (state.over === 'respawning') drawRespawnLine();
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
  const t = tr(gone ? 'end.hostLeft' : 'end.lost');
  const ts = pixelTextWidth(t, 3) <= VIEW_W - 20 ? 3 : 2;
  const toy = frameTop();
  drawPixelTextOutline(ctx, t, Math.round((VIEW_W - pixelTextWidth(t, ts)) / 2), toy + 34, '#cfe4f2', '#0a0e23', ts);
  const t2 = tr(gone ? 'end.hostLeftSub' : 'end.lostSub');
  drawPixelTextOutline(ctx, t2, Math.round((VIEW_W - pixelTextWidth(t2, 2)) / 2), toy + 34 + ts * 5 + 8, '#8f9cc4', '#0a0e23', 2);
  drawEndPlanks(now, 0);
}

// the planks both endings share: hovered or keyboard-picked is hot, and the
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
    drawMenuButton({ x: rs[i].x, y: rs[i].y + dy, w: rs[i].w, h: rs[i].h },
      tr(rs[i].label), state.deadHover[i], now, false); // prints its own 2x label
  }
}

// ------------------------------------------------------------ emotes
// The ceremony ends and the side is just standing there - the moment a
// scored goal hands back to the players, with nothing left to win and
// everything left to mess about with. Four of them, on a bar of four picture
// plates under the planks: a digit plays one, which is why a plate wears its
// digit in its corner the way a slot wears its number rather than a word of hint.
//
// An emote is a POSE PICKER over the set every body on the stage is already
// drawn from (champLook, js/sprites/characters.js): it hands back a frame,
// an offset off that body's own feet and, now and then, a puff of snow
// (puff: how far along its 0..1 that snow is, so a pose may throw several). So
// the whole feature costs no art. Each has a second performance for a body
// that is already DOWN, and the loss's screen plays that one - the side lies
// in the drift and emotes without getting up, so nothing on that screen ever
// stands back up.
//
// The local player's is `emo` below; the mates on a WIN celebrate on their
// own (emoteAmbient), rolled off a hash per slot rather than kept, the same
// no-array idiom as the motes and the blizzard. A loss has no ambient at
// all: that side is down.
const EM_T = 1.5;                        // one performance, whichever it is
const EM_KEYS = ['1', '2', '3', '4'];
const EM_TURN = ['down', 'left', 'up', 'right']; // a turn on the spot, one facing a beat

// the local player's: which plate, and the FRAME clock it started on - not
// either ceremony's, because a skip jumps those and would strand a pose
const emo = { i: -1, t0: -1e9, hover: [0, 0, 0, 0] };

const EMOTES = [
  // hoisted: the catch's hold frame is the one pose in the set with both
  // arms over the head, and what those arms are holding is a fish, which is
  // the correct thing to be holding at the end of a match in this valley
  { cap: '1', glyph: 'cheer',
    up: (s, f) => { if (f < 0.08) return { spr: s.catch[0] }; if (f < 0.16) return { spr: s.catch[1] }; const q = ((f - 0.16) * 3) % 1; return { spr: s.catch[2], dy: Math.round(Math.sin(q * Math.PI) * 8), puff: q < 0.3 ? q / 0.3 : 0 }; },
    down: (s, f) => { const q = (f * 3) % 1; return { spr: s.prone.down[1 + (Math.floor(f * 16) & 1)], dy: Math.round(Math.sin(q * Math.PI) * 10), puff: q < 0.3 ? q / 0.3 : 0 }; } },
  // the shuffle: the two side frames on alternate beats, swaying across its
  // own feet
  { cap: '2', glyph: 'dance',
    up: (s, f) => { const b = Math.floor(f * 10); return { spr: (b & 1 ? s.left : s.right)[1 + ((b >> 1) & 1)], dx: b & 1 ? -4 : 4, dy: b & 1 ? 0 : 3 }; },
    down: (s, f) => { const b = Math.floor(f * 10); return { spr: (b & 1 ? s.prone.left : s.prone.right)[1 + ((b >> 1) & 1)], dx: b & 1 ? -6 : 6, dy: b & 1 ? 0 : 3, puff: f < 0.15 ? f / 0.15 : 0 }; } },
  // the twirl, and the whole trick of it: a body that turns through all four
  // facings on the spot reads as spinning without a frame of new art
  { cap: '3', glyph: 'spin',
    up: (s, f) => ({ spr: s[EM_TURN[Math.floor(f * 10) & 3]][0], dy: Math.round(Math.sin(f * Math.PI) * 10), puff: f > 0.85 ? (f - 0.85) / 0.15 : 0 }),
    down: (s, f) => ({ spr: s.prone[EM_TURN[Math.floor(f * 9) & 3]][0], dy: Math.round(Math.abs(Math.sin(f * Math.PI * 4)) * 4), puff: f < 0.2 ? f / 0.2 : 0 }) },
  // down and up again: a beat on its feet, the length of it flat in the
  // snow, and back up - the one emote that leaves the body plan, so it is
  // also the one that puffs. Downed, it has nowhere to go but deeper.
  { cap: '4', glyph: 'flop',
    up: (s, f) => {
      if (f < 0.08 || f > 0.92) return { spr: s.down[0] };
      if (f < 0.16 || f > 0.84) return { spr: s.catch[0] }; // the stoop, going down and getting up
      const b = Math.floor((f - 0.16) * 20);
      return { spr: s.prone.right[b < 1 ? 0 : 1 + (b & 1)], puff: f < 0.4 ? (f - 0.16) / 0.24 : 0, low: true };
    },
    down: (s, f) => ({ spr: s.prone.right[f < 0.5 ? 1 + (Math.floor(f * 12) & 1) : 0], dy: -Math.round(Math.sin(f * Math.PI) * 8), puff: f < 0.5 ? f / 0.5 : 0 }) },
];

// ---- the plates' art -----------------------------------------------------
// One 10x10 grid an emote, stamped at 2x in the ending's accent (gold on the
// win, frost on the loss) - a figure with its arms up, a note, a turning
// arrow and a body flat on the ground with the snow still settling over it.
const EM_GLYPHS = {
  cheer: [
    '.g......g.',
    '.g..hh..g.',
    '.g..hh..g.',
    '..g.gg.g..',
    '...gggg...',
    '...gggg...',
    '...gggg...',
    '...g..g...',
    '...g..g...',
    '..gg..gg..',
  ],
  dance: [
    '...gggggg.',
    '...gggggg.',
    '...g....g.',
    '...g....g.',
    '...g....g.',
    '...g....g.',
    '.ggg..ggg.',
    'ggggg.gggg',
    'ggggg.gggg',
    '.ggg..ggg.',
  ],
  spin: [
    '...gggg...',
    '..g....g..',
    '.g......g.',
    'g.....gggg',
    'g......ggg',
    'g.......gg',
    '.g........',
    '..g....g..',
    '...gggg...',
    '..........',
  ],
  flop: [
    '....gg....',
    '....gg....',
    '....gg....',
    '....gg....',
    '..gggggg..',
    '...gggg...',
    '....gg....',
    '.h..h..h..',
    'h...h....h',
    '..h.....h.',
  ],
};
const EM_GLYPH_HOT = { '.': null, g: '#ffffff', o: '#ffffff', h: '#ffffff' };

// ---- the bar -------------------------------------------------------------
const EM_PLATE = 26, EM_GAP = 5, EM_BAR_DY = 24; // under the planks, inside the frame

function emoteLayout() {
  const L = winLayout();
  const n = EMOTES.length;
  const w = n * EM_PLATE + (n - 1) * EM_GAP;
  const x0 = Math.round((VIEW_W - w) / 2);
  return EMOTES.map((e, i) => ({ x: x0 + i * (EM_PLATE + EM_GAP), y: L.plankY + EM_BAR_DY, w: EM_PLATE, h: EM_PLATE }));
}

// the bar is live exactly when the planks are: before that a press is a skip
// (endSkip), and the screen has not finished saying what it is
function emoteLive() {
  return emoteScreen() && deadReady() && !state.fade;
}
// ...and which screens have the bar at all: the two ceremonies, not the
// post-game record that answers endScreen() beside them (js/ui/lobby.js)
function emoteScreen() {
  return endScreen() && state.deadView !== 'spec' && state.deadView !== 'scores';
}

// which plate the pointer is on (-1 for none)
function emoteHit() {
  if (!emoteLive()) return -1;
  const rs = emoteLayout();
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    if (mouse.x >= r.x - 2 && mouse.x < r.x + r.w + 2 && mouse.y >= r.y - 2 && mouse.y < r.y + r.h + 2) return i;
  }
  return -1;
}

function emotePlay(i) { emo.i = i; emo.t0 = performance.now() / 1000; SFX.place(); }
function emoteKey(k) { const i = EM_KEYS.indexOf(k); if (i < 0 || !emoteLive()) return false; emotePlay(i); return true; }
function emoteClick() { const h = emoteHit(); if (h < 0) return false; emotePlay(h); return true; }

// what the local player's body is doing this frame, or null for standing there
function emoteNow(now) {
  if (emo.i < 0) return null;
  const f = (now - emo.t0) / EM_T;
  return f >= 0 && f < 1 ? { e: EMOTES[emo.i], f } : null;
}

// A mate celebrating on its own: every EM_AMB seconds each one rolls its own
// slot off the hash, about half of them play, and the rest of the slot it
// stands there. Nothing is kept between frames, so a resize costs it nothing.
const EM_AMB = 2.6;
function emoteAmbient(k, now) {
  const ph = now / EM_AMB + k * 0.37;
  const slot = Math.floor(ph);
  const h = hash2(k * 13 + slot, 71);
  if (h < 0.42) return null;
  const f = ((ph - slot) * EM_AMB) / EM_T;
  return f < 1 ? { e: EMOTES[Math.floor(h * 997) % EMOTES.length], f } : null;
}

// A body on the stage at 3x, bottom-aligned on the line its feet stand on:
// the cheer's hoist frame is 20 rows on the same feet, which is what reading
// the height pays for (the deal drawPlayer strikes too, js/draw/bodies.js).
function drawEndBody(spr, x, footY) {
  ctx.drawImage(spr, x, footY - spr.height * 3, WIN_BODY, spr.height * 3);
}

// snow thrown up under a body: a ring of pale specks spreading and settling
function drawSnowPuff(cx, y, f, a) {
  if (f < 0 || f > 1) return;
  for (let i = 0; i < 10; i++) {
    const h1 = hash2(i * 7 + 1, 43), h2 = hash2(i * 5 + 3, 89);
    const ang = (i / 10) * Math.PI * 2 + h1;
    const r = 3 + f * (10 + h2 * 10);
    ctx.globalAlpha = a * (1 - f) * 0.9;
    ctx.fillStyle = h1 > 0.6 ? '#ffffff' : '#dfe8f8';
    ctx.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(y - 1 - Math.sin(ang) * r * 0.35 - f * 4), 1, 1);
  }
  ctx.globalAlpha = 1;
}

// the bar itself: the glyph is the whole explanation, the plate lifts under
// the pointer and stays lit while its emote runs, and the corner carries
// the digit that plays it. dy
// slides it on with the planks without moving the rects emoteHit() tests.
function drawEmoteBar(now, ac, dy) {
  const rs = emoteLayout();
  const hot = emoteHit();
  const live = emoteNow(now);
  const dt = Math.min(0.05, now - (drawEmoteBar.last || now)); drawEmoteBar.last = now;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    const want = hot === i || (live && emo.i === i) ? 1 : 0;
    emo.hover[i] += (want - emo.hover[i]) * Math.min(1, dt * 14);
    const y = r.y + dy - Math.round(emo.hover[i] * 2);
    const lit = emo.hover[i] > 0.5;
    ctx.fillStyle = 'rgba(4,6,18,0.55)'; chamRect(r.x + 2, r.y + dy + 2, r.w, r.h);
    ctx.fillStyle = '#0a0e23'; chamRect(r.x, y, r.w, r.h);
    ctx.fillStyle = '#141c3c'; chamRect(r.x + 1, y + 1, r.w - 2, r.h - 2);
    ctx.fillStyle = lit ? ac.rule : '#35426e';
    ctx.fillRect(r.x + 2, y + 1, r.w - 4, 1); ctx.fillRect(r.x + 2, y + r.h - 2, r.w - 4, 1);
    stampGrid(EM_GLYPHS[EMOTES[i].glyph], lit ? EM_GLYPH_HOT : ac.icon, r.x + 3, y + 2, 2);
    drawPixelTextShadow(ctx, EMOTES[i].cap, r.x + r.w - 6, y + r.h - 7, lit ? ac.txt : '#8f9cc4', '#0a0e23');
  }
}
