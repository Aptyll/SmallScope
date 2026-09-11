'use strict';
// The HUD that lives in world space: the radial wheel and runCmd, the tile
// brackets and selection, the key and pad prompts, the work/rack/bell/shop
// hints, and the build list with its ghost.
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
  // the site decides the menu: a stump offers the five buildings that stand
  // on land, an open hole offers the one that floats. A single option is not
  // special-cased either - wheelSpan(1) is the whole circle, so any direction
  // out of the hub picks it and the hub still cancels.
  if (w.kind === 'build') return buildOptionsAt(w.tx, w.ty).map((type) => ({ id: type }));
  // the flag wheel: the four orders, attack straight up (the `team flags`
  // banner, robots.js)
  if (w.kind === 'flag') return FLAG_ORDER.map((id) => ({ id }));
  // the practice rack offers every tool in the game, in table (tier) order -
  // the arena is the one place trying an unearned weapon costs nothing
  if (w.kind === 'rack') return Object.keys(TOOLS).map((id) => ({ id }));
  // the parkour die and the range bell: the three difficulties, easy
  // straight up - picking one IS the roll (or the ring), so neither carries
  // a separate go wedge
  if (w.kind === 'pkdie' || w.kind === 'agbell') return [{ id: 'easy' }, { id: 'medium' }, { id: 'hard' }];
  // upgrade is always the wedge straight up and demolish always the last one,
  // so a type's extra option would land between them instead of displacing
  // either (none has one today; the Keep's card craft did)
  return [{ id: 'upgrade' }, { id: 'demolish' }];
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
  // (a flag wheel over the chart is pinned to its press point instead: the
  // chart's tile is under the pointer, not under the camera)
  let cx = w.sx !== undefined ? Math.round(w.sx) : Math.round(wToSX(w.tx * TILE + 8));
  let cy = w.sx !== undefined ? Math.round(w.sy) : Math.round(wToSY(w.ty * TILE + 8));
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
// performs it next step, so a build races other players' orders fairly
function resolveWheel() {
  const w = state.wheel;
  const L = wheelLayout();
  if (L.seg < 0) {
    // released in the hub = cancel - except a flag wheel held over your own
    // flag, whose hub IS the flag (drawWheelHub): releasing there lifts it
    if (w.kind === 'flag' && wheelOnOwnFlag()) player.input.cmd = { kind: 'flag', tx: w.tx, ty: w.ty, id: null };
    return;
  }
  player.input.cmd = {
    kind: w.kind === 'build' ? 'build' : w.kind === 'flag' ? 'flag' : w.kind === 'rack' ? 'rack' : w.kind === 'pkdie' ? 'pkdie' : w.kind === 'agbell' ? 'agbell' : L.opts[L.seg].id,
    tx: w.tx, ty: w.ty, id: L.opts[L.seg].id,
  };
}
// is the open wheel standing on the local player's own flag?
function wheelOnOwnFlag() {
  const w = state.wheel, f = player.flag;
  return !!(w && f && f.tx === w.tx && f.ty === w.ty);
}

// run a queued build/manage/gear order for any player
function runCmd(p, c) {
  if (c.kind === 'gear') { buyGear(p, c.piece); return; } // no tile, no reach - gear is bought from anywhere
  if (c.kind === 'ability') { buyAbilityLv(p, c.i); return; } // an ability level: a skill point, from anywhere
  if (c.kind === 'shop') { shopCmd(p, c); return; } // the merchant's counter (js/shop.js) - it checks its own reach

  if (c.kind === 'build') { placeStruct(c.tx, c.ty, c.id, p, c.rot); return; } // rot: the list's R (a wheel's order is unturned)
  // the flag: per-player state, planted anywhere on the map (no reach, no
  // contest); id null is the lift (the `team flags` banner, js/robots.js)
  if (c.kind === 'flag') { if (c.id) plantFlag(p, c.tx, c.ty, c.id); else clearFlag(p); return; }
  if (c.kind === 'rack') { rackEquip(p, c); return; } // the practice armory (js/world.js)
  if (c.kind === 'pkdie') { pkWheelPick(p, c); return; } // the parkour roll die (js/world.js)
  if (c.kind === 'agbell') { agRing(p, c); return; } // the archery range's bell (js/world.js)
  const o = structOf(objAt(c.tx, c.ty));
  if (!o || !STRUCTS[o.type] || o.building || !ownsStruct(o, p)) return;
  if (Math.hypot(c.tx * TILE + 8 - p.x, c.ty * TILE + 8 - p.y) > 60) return;
  if (c.kind === 'upgrade') startUpgrade(o, p);
  else if (c.kind === 'demolish') demolishStruct(o, p);
}

// ------------------------------------------------------------ selection, hints & wheel
// white corner brackets over the hovered / wheel-targeted tile
function drawSelection(ox, oy, now) {
  if (state.mode !== 'play' || state.mapOpen || state.settingsOpen || state.build) return; // the build list's ghost has the tile
  let tx, ty;
  if (state.wheel) {
    tx = state.wheel.tx; ty = state.wheel.ty;
  } else {
    tx = Math.floor(mouseWX() / TILE);
    ty = Math.floor(mouseWY() / TILE);
    // what E opens rather than swings at: the practice rack, and one of
    // your own finished buildings (its manage wheel) - in reach
    const o = structOf(objAt(tx, ty));
    if (!o) return;
    if (o.type !== 'rack' && !(STRUCTS[o.type] && !o.building && !STRUCTS[o.type].fixed && o.team === player.team)) return;
    if (Math.hypot(tx * TILE + 8 - player.x, ty * TILE + 8 - player.y) > 60) return;
  }
  // a big building brackets its whole footprint, from its anchor - and the
  // practice rack its whole two-tile pair, from its lead
  const o2 = structOf(objAt(tx, ty));
  const big = o2 && STRUCTS[o2.type] && (structW(o2) > 1 || structH(o2) > 1);
  const rk = o2 && o2.type === 'rack' ? (o2.lead ? o2 : objAt(o2.tx - 1, o2.ty)) : null;
  const bx = rk ? rk.tx * TILE + (rk.dx || 0) - ox : (big ? o2.tx : tx) * TILE - ox;
  const by = (big ? o2.ty : ty) * TILE - oy;
  const bw = rk ? TILE * 2 : (big ? structW(o2) : 1) * TILE, bh = (big ? structH(o2) : 1) * TILE;
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
  if (state.mode !== 'play' || state.mapOpen || state.settingsOpen || state.wheel) return;
  if (player.charging || player.fallT > 0 || player.dodgeT > 0) return;
  if (hoverFish()) return; // the fish brackets win over CRACK ICE on the same tile
  let t = workTarget(player);
  // what the hands take on their own (autoToolFor: a tree, a rock, a chest, a
  // rival's building or eagle) asks for no key - the swing itself is the whole signal
  if (t && t.o && autoToolFor(t.o, player) >= 0) t = null;
  
  // no work target: the armory, the roll station, the range bell or a
  // MERCHANT may still be in reach
  if (!t || !t.near) { drawRackHint(ox, oy); drawPkHint(ox, oy); drawBellHint(ox, oy); drawShopHint(ox, oy); return; }
  const st = t.o && structOf(t.o);
  const isStruct = !!(st && STRUCTS[st.type]);
  const d = t.o && OBJECTS[t.o.type];
  const verb = !t.o ? 'CRACK ICE' : isStruct ? 'BREAK' : (d && d.verb) || 'MINE';
  // sit above the sprite: the entry's `lift` is how far above its tile the
  // prompt goes - 33 for the 37px pine, 20 for a dead tree's 8px overhang, 10
  // for the short ones. A building is drawn up from its footprint's bottom
  // edge and can be taller than its tiles, so clear its own sprite instead.
  const lift = isStruct ? structSprite(st).height - structH(st) * TILE + 12 :
    t.o ? ((d && d.lift) || 10) : 8;
  // a multi-tile building takes the prompt on its centre, not the tile you aimed at
  const hx = isStruct ? (st.tx + structW(st) / 2) * TILE : t.tx * TILE + 8;
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
// is bound to (keyCap), and with a pad in hand (padActive, js/gamepad.js)
// the same indicator wears the pad's button instead, so what the player is
// holding is what the screen points at. This table is the action -> pad
// glyph map, one row per action the HUD ever prints, and it mirrors
// PAD_PLAY / PAD_MENU (js/gamepad.js) - a change there is a row here; esc,
// enter, click and move are the fixed few. The glyph kinds are
// drawPadGlyph's (panels.js), the same pictures the CONTROLS page lists.
const PAD_BIND = {
  work: ['face', 'X'], dodge: ['face', 'A'], slide: ['trig', 'LT'], click: ['trig', 'RT'],
  ab1: ['face', 'Y'], ab2: ['face', 'B'], ab3: ['bump', 'LB'], ab4: ['bump', 'RB'],
  berry: ['dpad', 'L'], fish: ['dpad', 'R'], char: ['dpad', 'U'], map: ['pill', 'BACK'], board: ['pill', 'BACK'],
  esc: ['face', 'B'], enter: ['face', 'A'], move: ['stick', 'L'],
};
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
  g.fillStyle = '#0f1632';
  if (b[0] === 'face' || b[0] === 'stick') { touchDisc(g, 4, 4, 5, '#0f1632'); }
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
    drawPixelText(g, verb, x + 12, y, '#5a6690');
  } else {
    const t = 'ESC ' + verb;
    drawPixelText(g, t, Math.round(cx - pixelTextWidth(t) / 2), y, '#5a6690');
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
  g.fillStyle = '#0a0e23';
  g.fillRect(x, y, w, 10);
  g.fillStyle = hot === 2 ? (Math.sin((now || 0) * 9) > 0 ? '#ffd95c' : '#f4f7ff') : hot ? '#f4f7ff' : pressed ? '#8fb3d6' : '#c2d8ee';
  g.fillRect(x + 1, cy + 1, w - 2, 8 - (pressed ? 1 : 0));
  if (!pressed) {
    g.fillStyle = '#f4f7ff'; g.fillRect(x + 1, y + 1, w - 2, 1);
    g.fillStyle = hot === 2 ? '#c9a227' : '#8fb3d6'; g.fillRect(x + 1, y + 8, w - 2, 1); // bottom shade = depth
  }
  drawPixelText(g, label, x + 3, cy + 3, '#0a0e23');
  return w;
}
// the key-cap + verb pair itself, shared by the work prompt, the rack's and
// the pack's SHIFT plate: pressed = the face drops a pixel and the verb goes
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
    drawPixelTextOutline(ctx, verb, x + gw + 3, y + 3, pressed ? '#ffd95c' : '#f4f7ff', '#0f1632');
    return;
  }
  const capW = drawKeyCap(ctx, x, y, keyCap(action), pressed, 0);
  drawPixelTextOutline(ctx, verb, x + capW + 3, y + 3, pressed ? '#ffd95c' : '#f4f7ff', '#0f1632');
}
function promptW(verb, action) {
  action = action || 'work';
  return (padActive() && PAD_BIND[action] ? padBindW(action) : pixelTextWidth(keyCap(action)) + 6) + 3 + pixelTextWidth(verb);
}

// The practice armory's prompt: PROXIMITY, not hover - standing beside the
// rack is the whole gesture (rackNear, js/world.js), so the E ARM cap rises
// over the rack itself the moment you are in reach, wherever the pointer is.
// Pressing E opens the wheel, which hides every hint including this one.
function drawRackHint(ox, oy) {
  const rk = rackNear(player);
  if (!rk) return;
  const verb = 'ARM';
  const totalW = promptW(verb, 'work');
  const hx = (rk.tx + 1) * TILE + (rk.dx || 0); // the pair's centre, nudged with the sprite
  drawKeyPrompt(Math.round(hx - ox - totalW / 2), Math.round(rk.ty * TILE - oy - 24), verb, keyHeld('work'));
}

// The parkour die's prompt, the rack's own proximity grammar: an E ROLL cap
// over the die while it is in reach (pkDieNear, js/world.js - the same
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
// over the bell while it is in reach (agBellNear, js/world.js - the same
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
// The merchant's prompt, the rack's own proximity grammar one body over: an
// E SHOP cap over whichever merchant is in reach (merchNear, js/shop.js -
// the same resolver the press uses), either team's. It hides while the
// counter is up, the way every hint hides under a wheel.
function drawShopHint(ox, oy) {
  if (state.shop) return;
  const b = merchNear(player);
  if (!b) return;
  const verb = 'SHOP';
  const totalW = promptW(verb, 'work');
  drawKeyPrompt(Math.round(b.x - ox - totalW / 2), Math.round(b.y - 44 - oy), verb, keyHeld('work'));
}


// hovering a fish: white brackets on the fish (the same "this reacts" cue as
// stumps), full-bright once it is inside the automatic catch's reach (autoFish,
// js/tools.js) and dimmed until then - the mechanic is standing on the ice
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
  corners(near ? '#ffffff' : '#9fb6d8', fx - 8, fy - 6);
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
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(kx - 2, ky - 2, 5, 5);
  ctx.fillStyle = live ? '#ffd95c' : '#8fa4c8'; ctx.fillRect(kx - 1, ky - 1, 3, 3);
}

// the hub: the hole the wedges leave, and the cancel target. It carries a
// cross rather than the word CANCEL, and goes hot while the pointer is in it
// - which is where the pointer starts, so the way out is the way you came in.
function drawWheelHub(L) {
  const cancel = L.seg < 0;
  // a flag wheel over your own flag: the hub IS the flag, and releasing in
  // it lifts the flag - so it wears the pennant, lit while the pointer is in
  const lift = state.wheel.kind === 'flag' && wheelOnOwnFlag();
  ctx.beginPath();
  ctx.arc(L.cx, L.cy, WHEEL_HUB - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = lift ? '#0e142c' : cancel ? '#3a1f2c' : '#0e142c';
  ctx.fill();
  ctx.strokeStyle = lift ? (cancel ? '#ffd95c' : '#2a3358') : cancel ? '#ff8a7a' : '#2a3358';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (lift) { drawFlagPennant(ctx, L.cx - 2, L.cy + 4, cancel ? '#ffd95c' : TEAMS[skin(player.team)].mark); return; }
  ctx.fillStyle = cancel ? '#ff8a7a' : '#46527a';
  for (let d = -3; d <= 3; d++) { // rasterised, so the cross stays crisp
    ctx.fillRect(L.cx + d, L.cy + d, 1, 1);
    ctx.fillRect(L.cx + d, L.cy - d, 1, 1);
  }
}

function renderWheel(now) {
  const L = wheelLayout();
  const w = state.wheel;
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
    ctx.fillStyle = hovered ? '#35426e' : '#141c3c';
    ctx.fill();
    if (hovered) {
      ctx.strokeStyle = '#ffd95c';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const ix = L.cx + Math.cos(opt.ang) * WHEEL_RING;
    const iy = L.cy + Math.sin(opt.ang) * WHEEL_RING;
    if (w.kind === 'build') {
      const affordable = canAfford(STRUCTS[opt.id].tiers[0].cost);
      const tb = SPRITES.teamBuild[skin(player.team)];
      const art = STRUCTS[opt.id].tiled || STRUCTS[opt.id].art || opt.id; // a piece wearing another's tile (the long wall)
      const spr = (tb.icon && (tb.icon[opt.id] || tb.icon[art])) || tb[art][0];
      ctx.globalAlpha = affordable ? 1 : 0.55;
      ctx.drawImage(spr, Math.round(ix - 8), Math.round(iy - 8));
      if (!affordable) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#e85a5a';
        ctx.fillRect(Math.round(ix - 8), Math.round(iy - 8), 16, 16);
      }
      ctx.globalAlpha = 1;
    } else if (w.kind === 'flag') {
      // the order's glyph at twice its banner size, in its own ink (the
      // stakes: pale for your side, red for theirs) - lit gold under the pick
      drawFlagIcon(ctx, opt.id, ix, iy, hovered ? '#ffd95c' : FLAG_TYPES[opt.id].col, '#0f1632', 2);
    } else if (w.kind === 'rack') {
      // a tool's own strip icon: the family silhouette in its tier's metal
      const T = TOOLS[opt.id];
      ctx.drawImage(SPRITES['toolArt_' + T.art + '_' + T.tier], Math.round(ix - 6), Math.round(iy - 6));
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
      // a difficulty wedge is the round it rings in: the TARGET FACE the
      // spawner pours out, drawn smaller as the pick gets harder. The armed
      // difficulty wears the gold frame - the bell itself never changes.
      const rix = Math.round(ix), riy = Math.round(iy);
      const di = PK_DIFFS.indexOf(opt.id);
      const fw = [14, 11, 8][di];
      ctx.drawImage(TARGET_SPR, rix - (fw >> 1), riy - (fw >> 1), fw, fw);
      if (agame.diff === opt.id) {
        ctx.fillStyle = '#ffd95c';
        ctx.fillRect(rix - 9, riy - 9, 18, 1); ctx.fillRect(rix - 9, riy + 8, 18, 1);
        ctx.fillRect(rix - 9, riy - 9, 1, 18); ctx.fillRect(rix + 8, riy - 9, 1, 18);
      }
    } else {
      const label = opt.id === 'upgrade' ? 'UP' : opt.id === 'demolish' ? 'DEL' : 'CARD';
      drawPixelTextOutline(ctx, label,
        Math.round(ix - pixelTextWidth(label) / 2), Math.round(iy - 2),
        hovered ? '#ffd95c' : '#9fb6d8', '#0f1632');
    }
  }

  drawWheelHub(L);
  drawWheelStick(L);

  // hovered label + cost under the wheel (or CANCEL, from inside the hub -
  // LIFT, from the hub of a flag wheel standing on your own flag)
  let label = 'CANCEL', color = '#9fb6d8';
  if (L.seg < 0 && w.kind === 'flag' && wheelOnOwnFlag()) { label = 'LIFT'; color = '#ffd95c'; }
  if (L.seg >= 0) {
    const opt = L.opts[L.seg];
    const o = structOf(objAt(w.tx, w.ty));
    if (w.kind === 'build') {
      const t0 = STRUCTS[opt.id].tiers[0];
      label = STRUCTS[opt.id].name + ' : ' + costText(t0.cost);
      color = canAfford(t0.cost) ? '#ffd95c' : '#ff8a7a';
    } else if (w.kind === 'flag') {
      label = FLAG_TYPES[opt.id].name;
      color = FLAG_TYPES[opt.id].col;
    } else if (w.kind === 'rack') {
      label = TOOLS[opt.id].name;
      color = TOOL_TIERS[TOOLS[opt.id].tier].rim; // the name in its tier's metal
    } else if (w.kind === 'pkdie') {
      label = 'ROLL ' + opt.id.toUpperCase();
      color = PK_PIP_COL[PK_DIFFS.indexOf(opt.id)];
    } else if (w.kind === 'agbell') {
      label = 'RING ' + opt.id.toUpperCase();
      color = PK_PIP_COL[PK_DIFFS.indexOf(opt.id)];
    } else if (opt.id === 'upgrade') {
      if (!o || o.tier >= STRUCTS[o.type].tiers.length - 1) { label = 'MAX TIER'; color = '#9fb6d8'; }
      else {
        const t = STRUCTS[o.type].tiers[o.tier + 1];
        label = 'UPGRADE : ' + costText(t.cost);
        color = canAfford(t.cost) ? '#ffd95c' : '#ff8a7a';
      }
    } else if (opt.id === 'demolish') {
      label = 'DEMOLISH'; color = '#ff8a7a';
    }
  }
  // centred under the wheel, but never off the edge: the wheel sits where the
  // stump is, and a wide cost line is wider than the margin that leaves
  const lw = pixelTextWidth(label);
  drawPixelTextOutline(ctx, label,
    Math.round(Math.max(2, Math.min(VIEW_W - lw - 2, L.cx - lw / 2))),
    Math.round(L.cy + WHEEL_R + WHEEL_PAD + 6), color, '#0f1632');
}

// ---- the build list and its ghost -----------------------------------------
// T opens a column of every buildable (BUILD_ORDER, structures.js) under
// the weapon shelf, one row a piece: its icon and its price, the picked row
// lit, a price you cannot pay in red - and, on a piece that turns, the
// rotate key's cap. The world under the pointer carries the GHOST: the
// piece's own art, faint, snapped to the tile grid with its footprint rimmed
// in the standard bright ink where it can stand and the danger red where it
// cannot (canPlaceAt - one rule for the colour, the click and the AI), and a
// dot at every tile corner inside the builder's reach, so the snap and the
// reach read as one thing without a number. A click lays the ghost and the
// list stays up for the next piece: a wall is a run, not a piece.
const BUILD_X = 3;           // the column's left edge: flush with the drawer it replaces (BAG_PAD, declared below - a literal, since this is read at load)
const BUILD_Y = 64;          // under the shelf
const BUILD_ROW = 20;        // a row's pitch
const BUILD_W = 62;          // a row's width: icon, price, the rotate cap
const BUILD_OK = '#f4f7ff', BUILD_NO = '#ff8a7a'; // the ghost's two answers (the flag's own pair, robots.js)
function buildRowRect(i) { return { x: BUILD_X, y: BUILD_Y + i * BUILD_ROW, w: BUILD_W, h: BUILD_ROW - 2 }; }
function buildListHit(mx, my) {
  if (!state.build) return -1;
  for (let i = 0; i < BUILD_ORDER.length; i++) {
    const r = buildRowRect(i);
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return i;
  }
  return -1;
}
// what the ghost is right now: the picked piece, turned or not, anchored so
// its footprint sits centred on the tile under the pointer, and whether it
// can stand there. Null with no list up.
function buildGhostAt() {
  const b = state.build;
  if (!b) return null;
  const type = BUILD_ORDER[b.sel];
  const rot = STRUCTS[type].rotates ? b.rot : 0;
  const f = { type, rot };
  const w = structW(f), h = structH(f);
  const tx = Math.floor(mouseWX() / TILE) - (w >> 1), ty = Math.floor(mouseWY() / TILE) - (h >> 1);
  return { type, rot, tx, ty, w, h, can: canPlaceAt(type, tx, ty, rot, player) };
}
// the world half: the reach dots and the ghost, in the world pass beside drawSelection
function drawBuildGhost(ox, oy, now) {
  if (state.mode !== 'play' || !state.build || state.mapOpen || state.settingsOpen || state.wheel) return;
  const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
  const r = Math.ceil(BUILD_REACH / TILE) + 1;
  ctx.fillStyle = 'rgba(15,22,50,0.4)';
  for (let ty = pty - r; ty <= pty + r; ty++) for (let tx = ptx - r; tx <= ptx + r; tx++) {
    if (Math.hypot(tx * TILE + 8 - player.x, ty * TILE + 8 - player.y) > BUILD_REACH) continue;
    ctx.fillRect(tx * TILE - ox, ty * TILE - oy, 1, 1);
  }
  if (!mouse.inside || overHud(mouse.x, mouse.y) || buildListHit(mouse.x, mouse.y) >= 0) return;
  const g = buildGhostAt();
  const col = g.can.ok ? BUILD_OK : BUILD_NO;
  const px = g.tx * TILE - ox, py = g.ty * TILE - oy, fw = g.w * TILE, fh = g.h * TILE;
  const spr = structSprite({ type: g.type, tier: 0, team: player.team, rot: g.rot });
  if (spr) {
    ctx.globalAlpha = g.can.ok ? 0.55 : 0.3;
    if (STRUCTS[g.type].tiled) { for (let dy = 0; dy < g.h; dy++) for (let dx = 0; dx < g.w; dx++) ctx.drawImage(spr, px + dx * TILE, py + dy * TILE + TILE - spr.height); }
    else ctx.drawImage(spr, px + ((fw - spr.width) >> 1), py + fh - spr.height);
    ctx.globalAlpha = 1;
  }
  // the footprint's rim, dark under the colour, so it reads on snow and ice alike
  const rim = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); };
  rim('rgba(15,22,50,0.9)', px + 1, py + 1, fw, fh);
  rim(col, px, py, fw, fh);
}
// the HUD half: the column of rows, in the UI pass
function drawBuildList(now) {
  const b = state.build;
  if (!b || state.mapOpen || state.settingsOpen) return;
  const tb = SPRITES.teamBuild[skin(player.team)];
  for (let i = 0; i < BUILD_ORDER.length; i++) {
    const type = BUILD_ORDER[i], S = STRUCTS[type], sel = i === b.sel;
    const r = buildRowRect(i);
    const t0 = S.tiers[0], afford = canAfford(t0.cost);
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    ctx.fillStyle = sel ? '#141c3c' : '#0d1229'; ctx.fillRect(r.x, r.y, r.w, r.h);
    if (sel) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(r.x, r.y, r.w, 1); ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1); ctx.fillRect(r.x, r.y, 1, r.h); ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h); }
    // the icon: a type's own 16x16 (or the dedicated one a big sprite keeps
    // in `icon`); a tiled piece shows its tile twice, one over the other
    const art = S.tiled || S.art || type;
    const spr = (tb.icon && tb.icon[type]) || (tb.icon && tb.icon[art]) || (tb[art] && tb[art][0]);
    ctx.globalAlpha = afford ? 1 : 0.5;
    if (spr) {
      const iw = Math.min(16, spr.width), ih = Math.min(16, spr.height);
      if (S.tiled) { ctx.drawImage(spr, 0, 0, iw, ih, r.x + 1, r.y + 1, iw, ih); ctx.drawImage(spr, 0, 0, iw, ih, r.x + 5, r.y + 1, iw, ih); }
      else ctx.drawImage(spr, 0, 0, iw, ih, r.x + 2, r.y + 1, iw, ih);
    }
    ctx.globalAlpha = 1;
    // the price, in gold's own colour while the purse covers it, red while not
    const cost = '' + (t0.cost.gold || 0);
    drawPixelTextOutline(ctx, cost, r.x + 25, r.y + 6, afford ? RES_COLORS.gold : BUILD_NO, '#0f1632');
    // the piece that turns wears the rotate key's cap on its row while picked
    if (S.rotates && sel) drawKeyCap(ctx, r.x + r.w - 14, r.y + 4, keyCap('rotate'), keyHeld('rotate'), 0, now);
  }
}
