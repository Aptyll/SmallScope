'use strict';
// The HUD that lives in world space: the radial wheel and runCmd, the tile
// brackets and selection, the key and pad prompts, and the work/die/bell/shop
// hints.
// ------------------------------------------------------------ radial wheel
// One geometry, any number of options: n wedges of exactly 2*PI/n, the first
// centred straight up and the rest clockwise. Nothing is special-cased per
// count - 4 options land on up/right/down/left and 2 on up/down because that
// is what the formula gives. WHEEL_HUB is the hole in the middle and the
// cancel target both: the pointer starts inside it, and nothing is chosen
// until it leaves.
const WHEEL_HUB = 13;   // inner radius = the deadzone that cancels
const WHEEL_R = 40;     // outer radius of the wedges
const WHEEL_PAD = 4;    // backing disc beyond the wedges
const WHEEL_RING = (WHEEL_HUB + WHEEL_R) >> 1; // icons and labels: the same distance every direction
const WHEEL_GAP = 2;    // px of daylight between neighbouring wedges, measured at the rim
// The pointer is measured from the press point (w.ax/ay), not from the wheel's
// drawn hub: that press is what the hand remembers, and the hub drifts as the
// camera follows the player. drawWheelStick() draws that travel 1:1 from the
// hub, so the knob is visibly inside the wedge it has picked.

function wheelOptions() {
  const w = state.wheel;
  // the ping wheel: the four pings, attack straight up (the `pings` banner,
  // js/sim/pings.js) - the tap's GO HERE has no wedge
  if (w.kind === 'ping') return PING_WHEEL.map((id) => ({ id }));
  // the parkour die and the range bell: the three difficulties, easy
  // straight up - picking one IS the roll (or the ring), so neither carries
  // a separate go wedge
  if (w.kind === 'pkdie') return [{ id: 'easy' }, { id: 'medium' }, { id: 'hard' }];
  if (w.kind === 'agbell') return AG_WEDGES.map((id) => ({ id })); // one wedge per round (js/sim/practice.js)
  // the MOUSE scheme's action wheel: the four abilities clockwise from the
  // top, then the two meals and the ping (MS_WHEEL, js/app/input.js)
  return MS_WHEEL.map((id) => ({ id })); // 'kit'
}

// The whole geometry, in two lines: every wedge is span wide, and wedge i is
// centred on wheelAng(i). The hover test, the wedge pixels and the icon ring
// all read them, so a wedge is exactly its own hitbox at any count.
function wheelSpan(n) { return Math.PI * 2 / n; }
function wheelAng(i, n) { return -Math.PI / 2 + i * wheelSpan(n); }

// shared by resolveWheel and renderWheel so hover math and pixels agree
function wheelLayout() {
  const w = state.wheel;
  const edge = WHEEL_R + WHEEL_PAD;
  // the wheel is UI, not world: it sits over its tile but keeps its own pixel
  // size at every zoom, so the anchor comes through wToS and the radii don't
  // (a ping wheel over the chart or the minimap is pinned to its press point
  // instead: the spot is under the pointer, not under the camera; a ping
  // wheel stands on its exact world point, wx/wy, not on a tile's middle)
  let cx = w.sx !== undefined ? Math.round(w.sx) : Math.round(wToSX(w.wx !== undefined ? w.wx : w.tx * TILE + 8));
  let cy = w.sx !== undefined ? Math.round(w.sy) : Math.round(wToSY(w.wy !== undefined ? w.wy : w.ty * TILE + 8));
  cx = Math.max(edge + 2, Math.min(VIEW_W - edge - 2, cx));
  cy = Math.max(edge + 2, Math.min(VIEW_H - edge - 14, cy)); // bottom margin fits the label
  const opts = wheelOptions();
  const n = opts.length, span = wheelSpan(n);
  for (let i = 0; i < n; i++) opts[i].ang = wheelAng(i, n);
  // travel since the press, not distance from the hub
  const dx = mouse.x - w.ax, dy = mouse.y - w.ay;
  const dist = Math.hypot(dx, dy);
  let seg = -1;
  if (dist >= WHEEL_HUB) { // still in the hub = nothing chosen, releasing cancels
    // which wedge the travel points into - the same floor the wedges are drawn
    // from, so the hit region and the pixels cannot disagree
    let a = Math.atan2(dy, dx) - wheelAng(0, n) + span / 2;
    a -= Math.floor(a / (Math.PI * 2)) * Math.PI * 2;
    seg = Math.floor(a / span) % n;
  }
  return { cx, cy, opts, n, span, seg, dx, dy, dist };
}

// the wheel writes a one-shot order into the local player's input; the sim
// performs it next step, so a pick races other players' orders fairly
function resolveWheel() {
  const w = state.wheel;
  const L = wheelLayout();
  // the action wheel performs its own pick (msKitPick, js/app/input.js); only its
  // own release stands the ping wheel up, so any other close drops that wedge
  if (w.kind === 'kit') { if (L.seg >= 0 && MS_WHEEL[L.seg] !== 'ping') msKitPick(w, L.seg); return; }
  // the ping wheel: a wedge is its ping; a TAP - let go before the wheel
  // showed - or a press in the hub of one the action wheel stood up is GO
  // HERE; a hold let go in the hub is the cancel
  if (w.kind === 'ping') {
    const k = L.seg >= 0 ? L.opts[L.seg].id : w.stand || !pingWheelShown(w, L) ? 'go' : null;
    if (k) player.input.cmd = { kind: 'ping', k, x: Math.round(w.wx), y: Math.round(w.wy) };
    return;
  }
  if (L.seg < 0) return; // released in the hub = cancel
  player.input.cmd = { kind: w.kind, tx: w.tx, ty: w.ty, id: L.opts[L.seg].id }; // 'pkdie' | 'agbell'
}
// THE TAP: a ping wheel draws nothing until the button has been held
// PING_HOLD or the pointer has left the hub, so a tap is a GO HERE that
// never flashes a wheel - and a flick out of the hub picks before it shows
const PING_HOLD = 0.18; // s
function pingWheelShown(w, L) {
  if (w.kind !== 'ping' || w.stand) return true;
  return performance.now() / 1000 - w.t0 >= PING_HOLD || (L || wheelLayout()).dist >= WHEEL_HUB;
}

// is an order the right shape to act on? A bot file or a remote client can
// send anything - a string where a seat number goes, a key off Object's own
// prototype ('constructor') - and the handlers below index tables with it,
// so a malformed order is dropped here rather than throwing inside the step
// or leaving NaN gold behind. Only the shape: whether it may happen is still
// each handler's call.
const cmdInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v < hi;
const cmdKey = (table, k) => typeof k === 'string' && !!table && Object.hasOwn(table, k);
const cmdTile = (c) => Number.isInteger(c.tx) && Number.isInteger(c.ty);
function cmdOk(c) {
  if (!c || typeof c !== 'object') return false;
  if (c.kind === 'recall') return true;
  if (c.kind === 'ability') return cmdInt(c.i, 0, AB_KEYS);
  if (c.kind === 'fishPick') return c.type === null || FISH_KINDS.includes(c.type);
  if (c.kind === 'shop') {
    if (c.act === 'item') return cmdKey(BUILD_ITEMS, c.id);
    if (c.act === 'sellItem') return cmdInt(c.slot, 0, ITEM_SLOTS);
    if (c.act === 'trade') return FOOD_GOODS.includes(c.good) && (c.dir === 1 || c.dir === -1) &&
      (c.n === undefined || (Number.isInteger(c.n) && c.n >= 1));
    return false;
  }
  if (c.kind === 'ping') return cmdKey(PING_CALLS, c.k) && Number.isFinite(c.x) && Number.isFinite(c.y);
  return c.kind === 'pkdie' || c.kind === 'agbell' || c.kind === 'cheat'; // the practice props check their own
}

// run a queued order for any player. Returns what came of it, for whoever
// asked (a bot reads it as me.lastCmd): true when it went through, or why
// not - a word ('gold', 'far', ...) where the refusal has one, false where it
// has none
function runCmd(p, c) {
  if (!cmdOk(c)) return 'bad';
  if (c.kind === 'ability') return buyAbilityLv(p, c.i); // an ability level: a skill point, from anywhere
  if (c.kind === 'fishPick') { p.fishPick = c.type; return true; } // the fish well's picker (fishPick, js/ui/strip.js): which fish the key eats
  if (c.kind === 'recall') return startRecall(p); // the walk home, from anywhere (js/sim/recall.js)
  if (c.kind === 'shop') return shopCmd(p, c); // the merchant's counter (js/shop.js) - it checks its own reach

  // a ping: anywhere on the map, no reach, no contest - a mark for the side
  // and a hint to its bots (the `pings` banner, js/sim/pings.js)
  if (c.kind === 'ping') return pingCmd(p, c);
  if (c.kind === 'pkdie') { pkWheelPick(p, c); return true; } // the parkour roll die (js/sim/practice.js)
  if (c.kind === 'agbell') { agRing(p, c); return true; } // the archery range's bell (js/sim/practice.js)
  if (c.kind === 'cheat') return cheatCmd(p, c); // the practice bar (js/sim/practice.js, js/ui/cheats.js)
  return false;
}

// ------------------------------------------------------------ selection, hints & wheel
// an aimed ghost's rim (the practice bar's drop): the
// bright ink where it can go, the danger red where it cannot
const GHOST_OK = '#f4f7ff', GHOST_NO = '#ff8a7a';
// white corner brackets over the tile a wheel is open on
function drawSelection(ox, oy, now) {
  if (state.mode !== 'play' || state.mapOpen || state.settingsOpen || window.DBG.hideUI) return;
  if (!state.wheel) return;
  const tx = state.wheel.tx, ty = state.wheel.ty;
  // a big building brackets its whole footprint, from its anchor
  const o2 = structOf(objAt(tx, ty));
  const big = o2 && STRUCTS[o2.type] && (structW(o2) > 1 || structH(o2) > 1);
  const bx = (big ? o2.tx : tx) * TILE - ox;
  const by = (big ? o2.ty : ty) * TILE - oy;
  const bw = (big ? structW(o2) : 1) * TILE, bh = (big ? structH(o2) : 1) * TILE;
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now * 6);
  // four 3px corner brackets, dark shadow first so white reads on snow
  const corners = (c, px, py) => {
    ctx.fillStyle = c;
    ctx.fillRect(px, py, 3, 1); ctx.fillRect(px, py, 1, 3);
    ctx.fillRect(px + bw - 3, py, 3, 1); ctx.fillRect(px + bw - 1, py, 1, 3);
    ctx.fillRect(px, py + bh - 1, 3, 1); ctx.fillRect(px, py + bh - 3, 1, 3);
    ctx.fillRect(px + bw - 3, py + bh - 1, 3, 1); ctx.fillRect(px + bw - 1, py + bh - 3, 1, 3);
  };
  corners('rgba(15,22,50,0.9)', bx + 1, by + 1);
  corners('#ffffff', bx, by);
  ctx.globalAlpha = 1;
}

// "E  CHOP" key prompt over whatever E would work right now (Fortnite-style):
// a pixel key-cap that visibly presses while E is held, plus the verb. Only
// when the target is in reach and tools aren't blocked, so it doubles as
// the "you're close enough" signal.
function drawWorkHint(ox, oy) {
  if (state.mode !== 'play' || state.mapOpen || state.settingsOpen || state.wheel || state.shop || window.DBG.hideUI) return;
  if (player.charging || player.fallT > 0 || player.dodgeT > 0 || player.zip >= 0) return; // a rider's hands are full, and the cable is the only thing E does
  if (player.mount) return; // on deer-back E is the hop off, and the deer under you says so
  if (hoverFish()) return; // the fish brackets win over the cap on the same tile
  // a MERCHANT in reach owns the key outright (keyPress, js/app/input.js), so its
  // cap is the one that shows - trunk under the aim or not
  if (drawShopHint(ox, oy)) return;
  // ...then a zipline overhead, the key's next claim (keyPress again)
  if (drawZipHint(ox, oy)) return;
  // ...then a deer in reach (keyPress again)
  if (drawRideHint(ox, oy)) return;
  let t = workTarget(player);
  // what the hands take on their own (autoToolFor: a tree, a bush, a
  // rival's building or eagle) asks for no key - the swing itself is the whole signal
  if (t && t.o && autoToolFor(t.o, player) >= 0) t = null;
  
  // no work target: the roll station or the range bell may still be in
  // reach (the merchant answered above)
  if (!t || !t.near) { drawPkHint(ox, oy); drawBellHint(ox, oy); return; }
  const st = t.o && structOf(t.o);
  const isStruct = !!(st && STRUCTS[st.type]);
  const d = t.o && OBJECTS[t.o.type];
  const verb = isStruct ? 'BREAK' : (d && d.verb) || 'HIT';
  // sit above the sprite: the entry's `lift` is how far above its tile the
  // prompt goes - 33 for the 37px pine, 20 for a dead tree's 8px overhang, 10
  // for the short ones. A building is drawn up from its footprint's bottom
  // edge and can be taller than its tiles, so clear its own sprite instead.
  const lift = isStruct ? structSprite(st).height - structH(st) * TILE + 12 :
    (d && (typeof d.lift === 'function' ? d.lift(t.o) : d.lift)) || 10;
  // a multi-tile building takes the prompt on its centre, not the tile you aimed at,
  // and so does scenery wider than a tile (its OBJECTS `w`)
  const hx = isStruct ? (st.tx + structW(st) / 2) * TILE : t.tx * TILE + ((d && d.w) || 1) * 8;
  const hty = isStruct ? st.ty * TILE : t.ty * TILE;
  const hby = isStruct ? (st.ty + structH(st)) * TILE : t.ty * TILE + TILE;
  const pressed = !!player.input.work;
  const totalW = promptW(verb, 'work');
  const x = Math.round(hx - ox - totalW / 2);
  let y = Math.round(hty - oy - lift);
  // an adjacent target puts the prompt over the player's head: flip it under the tile instead
  const px0 = Math.round(player.x - ox), py0 = Math.round(player.y - oy);
  if (x < px0 + 9 && x + totalW > px0 - 9 && y < py0 + 5 && y + 10 > py0 - 14) {
    y = Math.round(hby - oy + 3);
  }
  // a 37px pine on a tile near the top of the view puts its prompt off the
  // top edge at the closest zoom rungs: keep it in the world view (WV_*, not
  // VIEW_* - this pass draws in world space)
  y = Math.max(1, Math.min(WV_H - 11, y));
  drawKeyPrompt(x, y, verb, pressed);
}

// Every keybind indicator - a cap beside a verb, a number in a well's
// corner, the ESC hint under a slab - names an ACTION (KEY_ACTIONS,
// input.js), never a key: on the keyboard it prints whatever key the action
// is bound to (keyCap), and with a pad in hand (padActive, js/app/gamepad.js)
// the same indicator wears the pad's button instead, so what the player is
// holding is what the screen points at. This table is the action -> pad
// glyph map, one row per action the HUD ever prints, and it mirrors
// PAD_PLAY / PAD_MENU (js/app/gamepad.js) - a change there is a row here; esc,
// enter, click and move are the fixed few. The glyph kinds are
// drawPadGlyph's (panels.js), the same pictures the CONTROLS page lists.
const PAD_BIND = {
  work: ['face', 'X'], dodge: ['face', 'A'], slide: ['trig', 'LT'], click: ['trig', 'RT'],
  ab1: ['face', 'Y'], ab2: ['face', 'B'], ab3: ['bump', 'LB'], ab4: ['bump', 'RB'],
  berry: ['dpad', 'L'], fish: ['dpad', 'R'], char: ['dpad', 'U'], map: ['pill', 'BACK'], board: ['pill', 'BACK'],
  esc: ['face', 'B'], enter: ['face', 'A'], move: ['stick', 'L'],
  recap: ['face', 'Y'], // the death recap's views (recapCycle, js/ui/recap.js)
};
// a filled disc and a 1px ring, in scanlines, so they are pixel art and not
// an anti-aliased arc (a pad's face buttons and sticks, here and on the
// CONTROLS page's GAMEPAD listing, panels.js)
function pixDisc(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}
function pixRing(g, cx, cy, r, col) {
  g.fillStyle = col;
  const ri = r - 1;
  for (let dy = -r; dy <= r; dy++) {
    const wo = Math.floor(Math.sqrt(r * r - dy * dy));
    const wi = Math.abs(dy) > ri ? -1 : Math.floor(Math.sqrt(ri * ri - dy * dy));
    if (wi < 0) g.fillRect(cx - wo, cy + dy, wo * 2 + 1, 1);
    else { g.fillRect(cx - wo, cy + dy, wo - wi, 1); g.fillRect(cx + wi + 1, cy + dy, wo - wi, 1); }
  }
}
// the glyph's footprint, so a caller can lay a verb beside it
function padBindW(key) { const b = PAD_BIND[key]; return !b ? 0 : b[0] === 'bump' || b[0] === 'trig' ? 13 : b[0] === 'pill' ? 11 : b[0] === 'stick' ? 17 : 9; }
// the pad's button for an action, drawn at x, y (top-left) at `s` px per px;
// `pressed` dims it the way a held cap drops its face
function drawPadBind(g, x, y, key, s, pressed) {
  const b = PAD_BIND[key];
  if (!b) return;
  s = s || 1;
  g.save();
  g.translate(x, y);
  if (s !== 1) g.scale(s, s);
  if (pressed) g.globalAlpha *= 0.55;
  // a dark rim under the disc so it reads on snow as the cap's navy did
  const w = padBindW(key);
  g.fillStyle = '#191b1f';
  if (b[0] === 'face' || b[0] === 'stick') { pixDisc(g, 4, 4, 5, '#191b1f'); }
  else g.fillRect(-1, -1, w + 2, 11);
  drawPadGlyph(g, 0, 0, b[0], b[1]);
  g.restore();
}
// the ESC BACK / ESC CLOSE line under a slab, centred on cx: the keyboard's
// word, or the pad's B disc beside the verb
function drawBackHint(g, cx, y, verb) {
  verb = verb || 'BACK';
  if (padActive()) {
    const w = 9 + 3 + pixelTextWidth(verb), x = Math.round(cx - w / 2);
    drawPadBind(g, x, y - 2, 'esc');
    drawPixelText(g, verb, x + 12, y, '#60656e');
  } else {
    const t = 'ESC ' + verb;
    drawPixelText(g, t, Math.round(cx - pixelTextWidth(t) / 2), y, '#60656e');
  }
}

// The key cap alone, on any context: navy rim, icy face, top highlight, the
// key's face in navy. It grows to fit its label (the label sits at x + 3 at
// any width), so SHIFT wears the same cap E does. pressed drops the face a
// pixel; hot 1 is the hover lift (the face goes white), hot 2 a cap
// LISTENING for its key on the CONTROLS page (the face pulses gold on
// `now`). Returns its width.
function drawKeyCap(g, x, y, label, pressed, hot, now) {
  const w = pixelTextWidth(label) + 6;
  const cy = y + (pressed ? 1 : 0);
  g.fillStyle = '#121418';
  g.fillRect(x, y, w, 10);
  g.fillStyle = hot === 2 ? (Math.sin((now || 0) * 9) > 0 ? '#ffd95c' : '#f4f7ff') : hot ? '#f4f7ff' : pressed ? '#8fb3d6' : '#c2d8ee';
  g.fillRect(x + 1, cy + 1, w - 2, 8 - (pressed ? 1 : 0));
  if (!pressed) {
    g.fillStyle = '#f4f7ff'; g.fillRect(x + 1, y + 1, w - 2, 1);
    g.fillStyle = hot === 2 ? '#c9a227' : '#8fb3d6'; g.fillRect(x + 1, y + 8, w - 2, 1); // bottom shade = depth
  }
  drawPixelText(g, label, x + 3, cy + 3, '#121418');
  return w;
}
// the key-cap + verb pair itself, shared by the work prompt and the die's
// plate: pressed = the face drops a pixel and the verb goes
// gold. `action` is what the cap is FOR (the work key unless said otherwise),
// and the cap prints whatever key that action is bound to (keyCap,
// input.js). With a pad in hand the cap is the pad's button (PAD_BIND) and
// the verb sits beside that instead. promptW is its footprint, for a caller
// centring it.
function drawKeyPrompt(x, y, verb, pressed, action) {
  action = action || 'work';
  if (padActive() && PAD_BIND[action]) {
    const gw = padBindW(action);
    drawPadBind(ctx, x, y, action, 1, pressed);
    drawPixelTextOutline(ctx, verb, x + gw + 3, y + 3, pressed ? '#ffd95c' : '#f4f7ff', '#191b1f');
    return;
  }
  const capW = drawKeyCap(ctx, x, y, keyCap(action), pressed, 0);
  drawPixelTextOutline(ctx, verb, x + capW + 3, y + 3, pressed ? '#ffd95c' : '#f4f7ff', '#191b1f');
}
function promptW(verb, action) {
  action = action || 'work';
  return (padActive() && PAD_BIND[action] ? padBindW(action) : pixelTextWidth(keyCap(action)) + 6) + 3 + pixelTextWidth(verb);
}

// The zipline's prompt: a bare cap, no verb, over the cable at the body's own
// column while it stands under either side's line (zipNear, js/sim/zipline.js - the
// resolver keyPress clips on with). The cable overhead is the whole
// affordance; the cap only says which key takes it.
function drawZipHint(ox, oy) {
  const near = zipNear(player);
  if (!near) return false;
  const w = promptW('', 'work');
  const y = Math.round(player.y + 4 - zipLift(near.z, near.d) - oy - 19); // clear of the cable, and of the name tag stamped over the world (drawWorldText)
  drawKeyPrompt(Math.round(player.x - ox - w / 2), Math.max(1, Math.min(WV_H - 11, y)), '', keyHeld('work'));
  return true;
}

// The deer's prompt, the zipline's grammar: a bare cap over the back of the
// wild deer in reach (rideNear, js/sim/wildlife.js - the resolver keyPress hops
// on with). The deer is the affordance; the cap only says which key takes it.
function drawRideHint(ox, oy) {
  const a = rideNear(player);
  if (!a) return false;
  const w = promptW('', 'work');
  drawKeyPrompt(Math.round(a.x - ox - w / 2), Math.round(a.y - oy - RIDE_HINT_Y), '', keyHeld('work'));
  return true;
}
const RIDE_HINT_Y = 56; // px above a deer's feet: clear of its plate and its noticed mark

// The parkour die's prompt, PROXIMITY, not hover: an E ROLL cap over the
// die while it is in reach (pkDieNear, js/sim/practice.js - the same
// resolver the wheel-open press uses). Holding E opens the roll wheel, which
// hides every hint including this one.
function drawPkHint(ox, oy) {
  if (pkAnim) return; // mid-sweep the station is busy - the tumbling die says so
  const pk = pkDieNear(player);
  if (!pk) return;
  const verb = 'ROLL';
  const totalW = promptW(verb, 'work');
  drawKeyPrompt(Math.round((pk.tx + 0.5) * TILE - ox - totalW / 2), Math.round(pk.ty * TILE - oy - 28), verb, keyHeld('work'));
}

// The range bell's prompt, the die's own proximity grammar: an E RING cap
// over the bell while it is in reach (agBellNear, js/sim/practice.js - the same
// resolver the wheel-open press uses). Holding E opens the difficulty
// wheel, which hides every hint including this one. Only while the range
// is idle - mid-round the bell is under the snow.
function drawBellHint(ox, oy) {
  if (agame.phase !== 'off') return;
  const bl = agBellNear(player);
  if (!bl) return;
  const verb = 'RING';
  const totalW = promptW(verb, 'work');
  drawKeyPrompt(Math.round((bl.tx + 0.5) * TILE - ox - totalW / 2), Math.round(bl.ty * TILE - oy - 30), verb, keyHeld('work'));
}

// 9x11 pixel mouse, the "click" key-cap. Only the LEFT button carries colour
// (gold = the game's "active" accent, hot orange while pressed); the right
// button is plain body so nothing suggests right-click.
// The merchant's prompt, the die's own proximity grammar one body over: an
// E SHOP cap over whichever merchant is in reach (merchNear, js/ui/shop.js -
// the same resolver the press uses), either team's. It hides while the
// counter is up, the way every hint hides under a wheel. Returns whether it
// drew: the merchant owns E in that bubble, so a cap here is the whole
// answer and drawWorkHint stops on it.
function drawShopHint(ox, oy) {
  if (state.shop) return false;
  const b = merchNear(player);
  if (!b) return false;
  const verb = 'SHOP';
  const totalW = promptW(verb, 'work');
  const pt = counterPt(b), lift = b.merchant ? 44 : 50; // a stall's cap clears its awning
  drawKeyPrompt(Math.round(pt.x - ox - totalW / 2), Math.round(pt.y - lift - oy), verb, keyHeld('work'));
  return true;
}


// hovering a fish: white brackets on the fish (the same "this reacts" cue as
// stumps), full-bright once it is inside the automatic catch's reach (autoFish,
// js/sim/attack.js) and dimmed until then - the mechanic is standing on the ice
// beside it, and the brackets' brightness is the whole of that hint
function drawFishHint(ex, ey, now) {
  if (state.mode !== 'play' || state.mapOpen || state.settingsOpen || state.wheel) return;
  if (player.fallT > 0 || player.dodgeT > 0) return;
  const f = hoverFish();
  if (!f) return;
  const fx = Math.round(f.x - ex), fy = Math.round(f.y - ey);
  const near = fishInRange(f);
  // brackets: 16x12 box, pulsing like the stump selection
  ctx.globalAlpha = (near ? 0.6 : 0.4) + 0.3 * Math.sin(now * 6);
  const corners = (c, px, py) => {
    ctx.fillStyle = c;
    ctx.fillRect(px, py, 3, 1); ctx.fillRect(px, py, 1, 3);
    ctx.fillRect(px + 13, py, 3, 1); ctx.fillRect(px + 15, py, 1, 3);
    ctx.fillRect(px, py + 11, 3, 1); ctx.fillRect(px, py + 9, 1, 3);
    ctx.fillRect(px + 13, py + 11, 3, 1); ctx.fillRect(px + 15, py + 9, 1, 3);
  };
  corners('rgba(15,22,50,0.9)', fx - 7, fy - 5);
  corners(near ? '#ffffff' : '#b4b8bf', fx - 8, fy - 6);
  ctx.globalAlpha = 1;
}

// How far the pointer has travelled since the press that opened the wheel,
// drawn from the hub as a knob. The cursor itself can be anywhere on screen,
// so this is the only readout of the input the choice is actually made with:
// it moves 1:1 with the pointer, so the knob is visibly inside the wedge that
// is lit, and it clamps to the lane between the hub rim and the icon ring so
// it never lands on an icon. Sitting in the hub is "nothing chosen": the knob
// stays grey on the cancel cross, which is where it starts.
function drawWheelStick(L) {
  const live = L.seg >= 0;
  const reach = (WHEEL_HUB + WHEEL_RING) >> 1;      // clear of the hub, short of the icons
  const k = L.dist > reach ? reach / L.dist : 1;    // 1:1 until it would reach an icon
  const kx = Math.round(L.cx + L.dx * k), ky = Math.round(L.cy + L.dy * k);
  ctx.fillStyle = '#121418'; ctx.fillRect(kx - 2, ky - 2, 5, 5);
  ctx.fillStyle = live ? '#ffd95c' : '#8fa4c8'; ctx.fillRect(kx - 1, ky - 1, 3, 3);
}

// the hub: the hole the wedges leave, and the cancel target. It carries a
// cross rather than the word CANCEL, and goes hot while the pointer is in it
// - which is where the pointer starts, so the way out is the way you came in.
function drawWheelHub(L) {
  const cancel = L.seg < 0;
  ctx.beginPath();
  ctx.arc(L.cx, L.cy, WHEEL_HUB - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = cancel ? '#3a1f2c' : '#131519';
  ctx.fill();
  ctx.strokeStyle = cancel ? '#ff8a7a' : '#2c2f36';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = cancel ? '#ff8a7a' : '#46527a';
  for (let d = -3; d <= 3; d++) { // rasterised, so the cross stays crisp
    ctx.fillRect(L.cx + d, L.cy + d, 1, 1);
    ctx.fillRect(L.cx + d, L.cy - d, 1, 1);
  }
}

function renderWheel(now) {
  const w = state.wheel;
  const L = wheelLayout();
  if (!pingWheelShown(w, L)) return; // the ping button still reads as a tap
  if (w.kind === 'ping' && !w.shown) { w.shown = true; SFX.wheelUp(); } // it rolls open only once it shows
  // backing disc
  ctx.fillStyle = 'rgba(6,10,24,0.6)';
  ctx.beginPath();
  ctx.arc(L.cx, L.cy, WHEEL_R + WHEEL_PAD, 0, Math.PI * 2);
  ctx.fill();

  const n = L.n, span = L.span;
  const gap = WHEEL_GAP / WHEEL_R / 2; // half a rim-width gap, as an angle
  for (let i = 0; i < n; i++) {
    const opt = L.opts[i];
    const hovered = i === L.seg;
    // an annulus sector: exactly span wide, from the hub out to the rim, so
    // every wedge is the same size and shape however many there are
    const a0 = opt.ang - span / 2 + gap, a1 = opt.ang + span / 2 - gap;
    ctx.beginPath();
    ctx.arc(L.cx, L.cy, WHEEL_R, a0, a1);
    ctx.arc(L.cx, L.cy, WHEEL_HUB, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = hovered ? '#3c4048' : '#1d1f24';
    ctx.fill();
    if (hovered) {
      ctx.strokeStyle = '#ffd95c';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const ix = L.cx + Math.cos(opt.ang) * WHEEL_RING;
    const iy = L.cy + Math.sin(opt.ang) * WHEEL_RING;
    if (w.kind === 'ping') {
      // the ping's glyph at twice its mark's size, in its own ink - lit gold under the pick
      drawPingGlyph(ctx, opt.id, ix, iy, 2, hovered ? '#ffd95c' : CALLS[opt.id].ink, '#191b1f');
    } else if (w.kind === 'pkdie') {
      // a difficulty wedge is that difficulty's DIE: the same coloured cube
      // the station's die becomes when this wedge is picked, pip count on its
      // face. The current track's one wears a gold frame.
      const rix = Math.round(ix), riy = Math.round(iy);
      const di = PK_DIFFS.indexOf(opt.id), C = PK_DIE_COL[di];
      ctx.fillStyle = '#241a12'; ctx.fillRect(rix - 6, riy - 6, 12, 12);
      ctx.fillStyle = C.body; ctx.fillRect(rix - 5, riy - 5, 10, 10);
      ctx.fillStyle = C.lite; ctx.fillRect(rix - 5, riy - 5, 10, 1); ctx.fillRect(rix - 5, riy - 5, 1, 10);
      ctx.fillStyle = C.dark; ctx.fillRect(rix + 4, riy - 4, 1, 9); ctx.fillRect(rix - 4, riy + 4, 9, 1);
      ctx.fillStyle = '#1c2130';
      for (const [ax2, ay2] of PK_PIP_AT[di]) ctx.fillRect(rix - 4 + ax2, riy - 4 + ay2, 2, 2);
      if (parkour.diff === opt.id) {
        ctx.fillStyle = '#ffd95c';
        ctx.fillRect(rix - 7, riy - 7, 14, 1); ctx.fillRect(rix - 7, riy + 6, 14, 1);
        ctx.fillRect(rix - 7, riy - 7, 1, 14); ctx.fillRect(rix + 6, riy - 7, 1, 14);
      }
    } else if (w.kind === 'agbell') {
      // a wedge is a round, in its own mark with its best medal pinned to
      // the corner (js/draw/practice.js). The last-rung round wears the gold
      // frame - the bell itself never changes.
      const rix = Math.round(ix), riy = Math.round(iy);
      drawAgRoundWedge(opt.id, rix, riy);
      if (agame.mode === opt.id) {
        ctx.fillStyle = '#ffd95c';
        ctx.fillRect(rix - 9, riy - 9, 18, 1); ctx.fillRect(rix - 9, riy + 8, 18, 1);
        ctx.fillRect(rix - 9, riy - 9, 1, 18); ctx.fillRect(rix + 8, riy - 9, 1, 18);
      }
    } else if (w.kind === 'kit') {
      drawKitWedge(opt.id, Math.round(ix), Math.round(iy), hovered);
    }
  }

  drawWheelHub(L);
  drawWheelStick(L);

  // the hovered wedge's label under the wheel (or CANCEL, from inside the hub)
  let label = 'CANCEL', color = '#b4b8bf';
  if (L.seg >= 0) {
    const opt = L.opts[L.seg];
    if (w.kind === 'ping') {
      label = CALLS[opt.id].word();
      color = CALLS[opt.id].ink;
    } else if (w.kind === 'pkdie') {
      label = 'ROLL ' + opt.id.toUpperCase();
      color = PK_PIP_COL[PK_DIFFS.indexOf(opt.id)];
    } else if (w.kind === 'agbell') {
      label = 'RING ' + AG_ROUNDS[opt.id].name;
      color = '#ffd95c';
    } else if (w.kind === 'kit') {
      ({ label, color } = kitLabel(opt.id));
    }
  }
  // centred under the wheel, but never off the edge: the wheel sits over its
  // tile, and a wide label is wider than the margin that leaves
  const lw = pixelTextWidth(label);
  drawPixelTextOutline(ctx, label,
    Math.round(Math.max(2, Math.min(VIEW_W - lw - 2, L.cx - lw / 2))),
    Math.round(L.cy + WHEEL_R + WHEEL_PAD + 6), color, '#191b1f');
}

// ---- the action wheel's wedges ------------------------------------------
// The MOUSE scheme's wheel (msWheelPress, js/app/input.js) wears what the strip
// wears: an ability's own icon at half size, dark where it cannot cast yet
// (locked or waiting), a meal's icon, dark with none in the pouch, and
// the ping's GO HERE glyph.
function kitAb(id) { return /^ab\d$/.test(id) ? +id[2] - 1 : -1; }
function drawKitWedge(id, x, y, hot) {
  const i = kitAb(id);
  if (i >= 0) {
    ctx.globalAlpha = abReady(player, i) ? 1 : 0.4;
    ctx.drawImage(classAbIcon(player.cls, i), x - 8, y - 8, 16, 16);
    ctx.globalAlpha = 1;
    return;
  }
  if (id === 'ping') { drawPingGlyph(ctx, 'go', x, y, 2, hot ? '#ffd95c' : CALLS.go.ink, '#191b1f'); return; }
  const im = SPRITES[ITEMS[id].icon];
  ctx.globalAlpha = bagCount(player, id) > 0 ? 1 : 0.4;
  ctx.drawImage(im, x - (im.width >> 1), y - (im.height >> 1));
  ctx.globalAlpha = 1;
}
// the line under the wheel: the ability's name (gold when it will cast), the
// meal's verb with the count in the pouch, or the ping's own verb
function kitLabel(id) {
  const i = kitAb(id);
  if (i >= 0) return { label: abOf(player, i).name, color: abReady(player, i) ? '#ffd95c' : '#8c919a' };
  if (id === 'ping') return { label: KEY_ACT.ping.verb, color: '#ffd95c' };
  const n = bagCount(player, id);
  return { label: KEY_ACT[id].verb + ' ' + n, color: n > 0 ? '#ffd95c' : '#8c919a' };
}
