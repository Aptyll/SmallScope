'use strict';
// The in-match HUD: the radial wheel, tile brackets and key prompts, the
// minimap, the backpack + gear widget, the hud strip and the card draft -
// everything renderUI() puts over the world while you play.
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
  let cx = Math.round(wToSX(w.tx * TILE + 8));
  let cy = Math.round(wToSY(w.ty * TILE + 8));
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
  if (L.seg < 0) return; // released in the hub = cancel
  player.input.cmd = {
    kind: w.kind === 'build' ? 'build' : w.kind === 'rack' ? 'rack' : w.kind === 'pkdie' ? 'pkdie' : w.kind === 'agbell' ? 'agbell' : L.opts[L.seg].id,
    tx: w.tx, ty: w.ty, id: L.opts[L.seg].id,
  };
}

// run a queued build/manage/gear order for any player
function runCmd(p, c) {
  if (c.kind === 'gear') { buyGear(p, c.piece); return; } // no tile, no reach - gear is bought from anywhere
  if (c.kind === 'ability') { buyAbilityLv(p, c.i); return; } // an ability level: a skill point, from anywhere
  if (c.kind === 'shop') { shopCmd(p, c); return; } // the merchant's counter (js/shop.js) - it checks its own reach

  if (c.kind === 'build') { placeStruct(c.tx, c.ty, c.id, p); return; }
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
  if (state.mode !== 'play' || state.mapOpen || state.settingsOpen) return;
  let tx, ty;
  if (state.wheel) {
    tx = state.wheel.tx; ty = state.wheel.ty;
  } else {
    tx = Math.floor(mouseWX() / TILE);
    ty = Math.floor(mouseWY() / TILE);
    const o = structOf(objAt(tx, ty));
    // a bare open hole brackets too: it is a build site with nothing on it,
    // and the brackets are the only thing that says so
    if (!o) { if (!buildSiteAt(tx, ty)) return; }
    else if (o.type !== 'stump' && o.type !== 'rack' &&
             !(STRUCTS[o.type] && !o.building && o.team === player.team)) return;
    if (Math.hypot(tx * TILE + 8 - player.x, ty * TILE + 8 - player.y) > 60) return;
  }
  // a big building brackets its whole footprint, from its anchor - and the
  // practice rack its whole two-tile pair, from its lead
  const o2 = structOf(objAt(tx, ty));
  const big = o2 && STRUCTS[o2.type] && (structW(o2.type) > 1 || structH(o2.type) > 1);
  const rk = o2 && o2.type === 'rack' ? (o2.lead ? o2 : objAt(o2.tx - 1, o2.ty)) : null;
  const bx = rk ? rk.tx * TILE + (rk.dx || 0) - ox : (big ? o2.tx : tx) * TILE - ox;
  const by = (big ? o2.ty : ty) * TILE - oy;
  const bw = rk ? TILE * 2 : (big ? structW(o2.type) : 1) * TILE, bh = (big ? structH(o2.type) : 1) * TILE;
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
  const lift = isStruct ? structSprite(st).height - structH(st.type) * TILE + 12 :
    t.o ? ((d && d.lift) || 10) : 8;
  // a multi-tile building takes the prompt on its centre, not the tile you aimed at
  const hx = isStruct ? (st.tx + structW(st.type) / 2) * TILE : t.tx * TILE + 8;
  const hty = isStruct ? st.ty * TILE : t.ty * TILE;
  const hby = isStruct ? (st.ty + structH(st.type)) * TILE : t.ty * TILE + TILE;
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
  ctx.beginPath();
  ctx.arc(L.cx, L.cy, WHEEL_HUB - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = cancel ? '#3a1f2c' : '#0e142c';
  ctx.fill();
  ctx.strokeStyle = cancel ? '#ff8a7a' : '#2a3358';
  ctx.lineWidth = 1;
  ctx.stroke();
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
      const spr = (tb.icon && tb.icon[opt.id]) || tb[opt.id][0];
      ctx.globalAlpha = affordable ? 1 : 0.55;
      ctx.drawImage(spr, Math.round(ix - 8), Math.round(iy - 8));
      if (!affordable) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#e85a5a';
        ctx.fillRect(Math.round(ix - 8), Math.round(iy - 8), 16, 16);
      }
      ctx.globalAlpha = 1;
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

  // hovered label + cost under the wheel (or CANCEL, from inside the hub)
  let label = 'CANCEL', color = '#9fb6d8';
  if (L.seg >= 0) {
    const opt = L.opts[L.seg];
    const o = structOf(objAt(w.tx, w.ty));
    if (w.kind === 'build') {
      const t0 = STRUCTS[opt.id].tiers[0];
      label = STRUCTS[opt.id].name + ' : ' + costText(t0.cost);
      color = canAfford(t0.cost) ? '#ffd95c' : '#ff8a7a';
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

// ------------------------------------------------------------ UI
// The terrain image is a full WORLD x WORLD sweep with a structOf() call per
// tile - far too much to pay every frame for a picture that only changes when
// something is built or the ground is cut. It rebuilds at most twice a
// second; at one map pixel per tile nothing can be seen arriving late.
const MM_REBUILD = 30; // sim ticks between terrain sweeps (half a second)
let mmBuiltAt = -1e9;  // tick of the last sweep; > tick means a fresh match reset the clock
function updateMinimap() {
  if (state.tick - mmBuiltAt < MM_REBUILD && state.tick >= mmBuiltAt) return;
  mmBuiltAt = state.tick;
  const d = mmImg.data;
  for (let i = 0; i < WORLD * WORLD; i++) {
    let r, g, b;
    const o = structOf(objects[i]); // resolves a multi-tile building's 'part' fillers to the anchor
    if (o) {
      const c = objMapColor(o, 'mm') || MM_UNKNOWN;
      r = c[0]; g = c[1]; b = c[2];
    } else if (ground[i] === 2) { r = 58; g = 92; b = 128; } // open water hole
    else if (ground[i] === 1) { r = 145; g = 188; b = 212; } // ice
    else if (ground[i] === 3) { r = 188; g = 168; b = 138; } // the road
    else { r = 205; g = 216; b = 232; } // snow
    const j = i * 4;
    d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255;
  }
  mmCtx.putImageData(mmImg, 0, 0);
}

// Every curve of the minimap is rasterised a pixel at a time: canvas arc()
// anti-aliases, and at game resolution a 1 px rim smeared over two pixels
// reads as blur. mmRing paints every pixel whose centre lies in [r0, r1)
// from the disc centre, optionally only between angles a0..a1 (clockwise
// from a0, in canvas terms), and mmMask(r) is a cached pixel disc used to
// clip the map view with destination-in instead of an anti-aliased clip().
function mmRing(g, cx, cy, r0, r1, col, a0, a1) {
  const span = a1 === undefined ? 7 : ((a1 - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const R = Math.ceil(r1);
  g.fillStyle = col;
  for (let py = -R; py <= R; py++) for (let px = -R; px <= R; px++) {
    const dx = px + 0.5, dy = py + 0.5, d = Math.hypot(dx, dy);
    if (d < r0 || d >= r1) continue;
    if (a1 !== undefined) {
      const a = ((Math.atan2(dy, dx) - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (a > span) continue;
    }
    g.fillRect(cx + px, cy + py, 1, 1);
  }
}
const mmMasks = new Map();
function mmMask(r) {
  let m = mmMasks.get(r);
  if (!m) {
    m = document.createElement('canvas'); m.width = m.height = r * 2;
    mmRing(m.getContext('2d'), r, r, 0, r, '#000');
    mmMasks.set(r, m);
  }
  return m;
}
const mmView = document.createElement('canvas'); // the clipped map view, rebuilt each frame
const mmViewCtx = mmView.getContext('2d');

// The disc's chrome - the opaque silhouette, its rim, the day ring's track
// and the dusk tick - and the day/night arcs are all mmRing, and mmRing is a
// per-pixel hypot/atan2 loop issuing a fillRect per lit pixel. Run every
// frame that was ~1.6 ms - a third of the whole frame, the largest single
// cost in the game - for pixels that never change. So the chrome is baked
// per (radius, hover) and the arc band per (radius, progress step): the arcs
// only move as fast as the clock, so quantising the cycle to MM_ARC_STEPS
// repaints the band every couple of real seconds instead of every frame.
const mmChromes = new Map();
function mmChrome(hov) {
  const key = MM_R * 2 + (hov ? 1 : 0);
  let c = mmChromes.get(key);
  if (!c) {
    const R = MM_R + 8, S = R * 2 + 2;
    c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), cc = R + 1;
    mmRing(g, cc, cc, MM_R + 7, MM_R + 8, hov ? '#9aa8d0' : '#6f7ca8'); // rim
    mmRing(g, cc, cc, 0, MM_R + 7, '#0f1632');                          // silhouette disc
    mmRing(g, cc, cc, MM_R + 2, MM_R + 5, '#2a3358');                   // day ring track
    mmChromes.set(key, c);
  }
  return c;
}
const MM_ARC_STEPS = 512; // day-ring granularity: ~a pixel of arc per step
const mmArc = { key: '', cv: document.createElement('canvas') };
function mmArcBand(prog) {
  const q = Math.min(MM_ARC_STEPS, Math.floor(prog * MM_ARC_STEPS));
  const key = MM_R + ':' + q;
  if (mmArc.key !== key) {
    mmArc.key = key;
    const R = MM_R + 6, S = R * 2 + 2;
    if (mmArc.cv.width !== S) mmArc.cv.width = mmArc.cv.height = S;
    const g = mmArc.cv.getContext('2d'), cc = R + 1;
    g.clearRect(0, 0, S, S);
    const p = q / MM_ARC_STEPS, dayFrac = DAY_LEN / CYCLE, a0 = -Math.PI / 2;
    const r0 = MM_R + 2, r1 = MM_R + 5;
    if (p > 0) mmRing(g, cc, cc, r0, r1, '#ffd95c', a0, a0 + Math.min(p, dayFrac) * Math.PI * 2);
    if (p > dayFrac) mmRing(g, cc, cc, r0, r1, '#7a90d8', a0 + dayFrac * Math.PI * 2, a0 + p * Math.PI * 2);
    // dusk boundary tick: one pixel column across the band, a little past it,
    // over the arcs exactly as the per-frame draw laid it
    const ba = a0 + dayFrac * Math.PI * 2;
    mmRing(g, cc, cc, r0 - 1, r1 + 1, '#8f9cc4', ba - 0.03, ba + 0.03);
  }
  return mmArc.cv;
}

function renderMinimap(now) {
  updateMinimap();
  const vp = viewPlayer();
  const ptx = vp.x / TILE, pty = vp.y / TILE;
  const s = mmScale(); // px per tile: the wheel over the disc changes it
  const hov = overMinimap() && state.mode === 'play' && !state.mapOpen && !state.settingsOpen && !state.wheel;

  // silhouette: an opaque dark disc under everything, rimmed by a pale line
  // so the whole control reads as one solid shape on the snow (baked, above)
  ctx.drawImage(mmChrome(hov), MM_CX - MM_R - 9, MM_CY - MM_R - 9);

  // pixel-clipped map view centered on the player
  const half = MM_R / s; // tiles from the centre to the edge
  if (mmView.width !== MM_R * 2) { mmView.width = mmView.height = MM_R * 2; }
  mmViewCtx.imageSmoothingEnabled = false;
  mmViewCtx.globalCompositeOperation = 'source-over';
  mmViewCtx.clearRect(0, 0, MM_R * 2, MM_R * 2);
  mmViewCtx.drawImage(mmCv, ptx - half, pty - half, half * 2, half * 2, 0, 0, MM_R * 2, MM_R * 2);
  mmViewCtx.globalCompositeOperation = 'destination-in';
  mmViewCtx.drawImage(mmMask(MM_R), 0, 0);
  ctx.drawImage(mmView, MM_CX - MM_R, MM_CY - MM_R);
  // the other players, in team colour, wherever they fall inside the view. A
  // rival buried past PRONE_MAP drops off it entirely - a dot that survived
  // the cover would make the whole thing pointless. Your own side never does.
  for (const p of players) {
    if (p === vp || !p.active || p.dead || inAir(p)) continue;
    if (p.team !== vp.team && p.markT <= 0 && concealOf(p) >= PRONE_MAP) continue; // a falcon-marked rival stays on it
    const dx = (p.x / TILE - ptx) * s, dy = (p.y / TILE - pty) * s;
    if (Math.hypot(dx, dy) > MM_R - 1) continue;
    ctx.fillStyle = '#0f1632';
    ctx.fillRect(Math.round(MM_CX + dx) - 2, Math.round(MM_CY + dy) - 2, 4, 4);
    ctx.fillStyle = TEAMS[skin(p.team)].mark;
    ctx.fillRect(Math.round(MM_CX + dx) - 1, Math.round(MM_CY + dy) - 1, 2, 2);
  }
  // worker flags on your side, as the same pennant the chart draws: where the
  // crew was sent is exactly the kind of thing you check without opening a map
  for (const q of players) {
    if (!q.active || q.team !== vp.team || !q.flag) continue;
    const dx = (q.flag.tx + 0.5 - ptx) * s, dy = (q.flag.ty + 0.5 - pty) * s;
    if (Math.hypot(dx, dy) > MM_R - 2) continue;
    drawFlagPennant(ctx, MM_CX + dx, MM_CY + dy + 3, TEAMS[skin(q.team)].mark);
  }
  // the downed eagles: both objectives, always on the disc - keeping yours
  // alive (and finding theirs) is the match
  if (state.drop) for (const e of state.drop.eagles) {
    if (e.state !== 'down') continue;
    const dx = (e.x / TILE - ptx) * s, dy = (e.y / TILE - pty) * s;
    if (Math.hypot(dx, dy) > MM_R - 2) continue;
    const gx = Math.round(MM_CX + dx), gy = Math.round(MM_CY + dy);
    ctx.fillStyle = '#0f1632';
    ctx.fillRect(gx - 3, gy - 1, 7, 3); ctx.fillRect(gx - 1, gy - 3, 3, 7);
    ctx.fillStyle = TEAMS[skin(e.team)].mark;
    ctx.fillRect(gx - 2, gy, 5, 1); ctx.fillRect(gx, gy - 2, 1, 5);
  }
  // the camps, glyph only - a name would not fit inside the disc (the
  // world map and the arrival toast are where they are read by name)
  for (const L of camps) {
    const dx = (L.tx + 0.5 - ptx) * s, dy = (L.ty + 0.5 - pty) * s;
    if (Math.hypot(dx, dy) > MM_R - 2) continue;
    drawCampIcon(ctx, L, MM_CX + dx, MM_CY + dy, L.spec.mark, '#0f1632');
  }
  // the centre dot: white for you, the team colour for a player you are watching
  ctx.fillStyle = '#0f1632';
  ctx.fillRect(MM_CX - 2, MM_CY - 2, 4, 4);
  ctx.fillStyle = vp === player ? '#ffffff' : TEAMS[skin(vp.team)].mark;
  ctx.fillRect(MM_CX - 1, MM_CY - 1, 2, 2);

  // day/night cycle ring: a 3 px band of pixels, the elapsed part painted
  // clockwise from 12 o'clock in the day colour, then the night colour
  // (the track is in the baked chrome; the arcs come from the cached band)
  const prog = state.time / CYCLE;
  const a0 = -Math.PI / 2; // start at 12 o'clock
  const r0 = MM_R + 2;
  ctx.drawImage(mmArcBand(prog), MM_CX - MM_R - 7, MM_CY - MM_R - 7);
  // progress tip: a 3x3 pixel block on the band
  const ta = a0 + prog * Math.PI * 2;
  const pulse = state.darkness > 0.5 ? (Math.sin(now * 6) * 0.15 + 0.85) : 1;
  ctx.fillStyle = state.darkness > 0.5 ? '#cfd8f2' : '#fff2b0';
  ctx.globalAlpha = pulse;
  ctx.fillRect(Math.round(MM_CX + Math.cos(ta) * (r0 + 1)) - 1, Math.round(MM_CY + Math.sin(ta) * (r0 + 1)) - 1, 3, 3);
  ctx.globalAlpha = 1;

  // beneath the minimap, one centred row: players still in the match (a pixel
  // figure + the count, no label) then the elapsed play-time. Clear of the
  // fps readout, which owns the extreme top-right corner.
  const clock = clockTxt(state.elapsed);
  const alive = String(aliveCount());
  const rowW = ALIVE_ICON_W + 2 + pixelTextWidth(alive) + 7 + pixelTextWidth(clock);
  let rx = Math.round(MM_CX - rowW / 2);
  const ry = MM_CY + MM_R + 9;
  drawAliveIcon(rx, ry - 1, '#f4f7ff', '#0f1632');
  rx += ALIVE_ICON_W + 2;
  drawPixelTextOutline(ctx, alive, rx, ry, '#f4f7ff', '#0f1632');
  rx += pixelTextWidth(alive) + 7;
  drawPixelTextOutline(ctx, clock, rx, ry, '#f4f7ff', '#0f1632');
}

// the "players left" glyph: a hooded figure, 5x7, stamped with the same 1px
// rim the outline font uses so it reads on snow beside the count
const ALIVE_ICON = [
  '.###.',
  '#####',
  '#.#.#',
  '.###.',
  '#####',
  '#####',
  '#...#',
];
const ALIVE_ICON_W = 5;
function drawAliveIcon(x, y, color, outline) {
  const stamp = (ox, oy, c) => {
    ctx.fillStyle = c;
    for (let r = 0; r < ALIVE_ICON.length; r++)
      for (let q = 0; q < ALIVE_ICON_W; q++)
        if (ALIVE_ICON[r][q] === '#') ctx.fillRect(x + q + ox, y + r + oy, 1, 1);
  };
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (ox || oy) stamp(ox, oy, outline);
  stamp(0, 0, color);
}

// ---- the backpack: one button, and the frame it opens - bottom-right -----
// It STARTS OPEN (state.bagOpen, js/core.js) - the grid is what a match is
// spent looking at, and a pack that has to be asked for hides the build. B or
// the button shuts it.
//
// Shut, the pack is ONE BUTTON flush in the corner - a 26px plate wearing the
// 20px pack icon (BAG_ICON below) and nothing else. Open (B, or clicking it),
// the frame rises off the button's top edge and is nothing but the ten-cell
// GRID: a SIMPLE INVENTORY of the things a build is made of. No numbers row
// any more - the two meals are a pouch on the hud strip's own buttons and the
// gold is the purse tab beside them, both on screen whether the pack is open
// or shut. Nothing else lives here either: gear is on the character panel (G,
// below), and skill points are spent on the strip's own floating plates.
//
// ONE BACKGROUND, ONE BORDER, NO INTERNAL LINE. Every part of the frame -
// behind the cells, behind the grid - is the same opaque BAG_BG, so nothing
// inside reads as a separate panel stacked on another. The frame is pinned by
// its BOTTOM RIGHT over the button and grows upward, so opening never pushes
// anything off-screen.
//
// Clicking the button (or B) toggles the grid; clicking a cell uses or sends
// what is in it. The frame swallows every other click over itself so nothing
// is fired at the world through it. The grid does NOT stop the sim - it is
// HUD, not an overlay. Two things are said in colour rather than in words: the
// button's rim goes amber when no cell is left free, and button and frame
// alike redden and shake when something could not be carried (bagDenied).
const BAG_CELL = 18;   // a grid slot
const BAG_GAP = 2;     // between neighbouring cells
const BAG_PAD = 3;     // frame edge to the first cell
const BAG_COLS = 5;    // the grid is five columns wide (BAG_CAP 10: two rows)
const BAG_BTN = 26;    // the closed pack: one big button, flush in the corner
const BAG_W = BAG_PAD * 2 + BAG_COLS * BAG_CELL + (BAG_COLS - 1) * BAG_GAP;
const BAG_BG = '#0d1229';     // the whole frame
const BAG_BG_RED = '#4a121c'; // ... and while a refusal is up
// a filled cell recesses BELOW that ground, an empty one sits above it, so
// the three tones say occupied / free / frame without any line doing it
const BAG_WELL = '#080b1c';
let bagFlash = 0;      // seconds left of the "it does not fit" red; updateFx ages it
// The refusal tell, fired by every path that cannot store something. Re-firing
// while it is already up does not restart it, so standing on a drop you
// cannot carry is one flash and one sound, not sixty a second.
function bagDenied() {
  if (bagFlash > 0) return;
  bagFlash = 0.6;
  SFX.deny();
}
function bagGridH() {
  const rows = Math.ceil(player.bagCap / BAG_COLS);
  return rows * BAG_CELL + (rows - 1) * BAG_GAP;
}
// The pack is OPEN whenever its own toggle says so, and also whenever the
// merchant's counter is up, because a sale is a DRAG out of the grid into the
// counter's sell well (js/shop.js). Everything that lays the widget out or
// hit-tests it asks this, never state.bagOpen, or the two disagree by a row and
// every click below the gear lands one cell out - the weapon shelf reads it
// too, since the shelf stands on whichever of the two edges is up.
function bagOpenNow() { return state.bagOpen || shopOpen(); }
// the pack button, flush in the corner - drawn shut and open alike, so the
// toggle never moves under the pointer that just used it
function bagBtnRect() { return { x: VIEW_W - BAG_BTN, y: VIEW_H - BAG_BTN, w: BAG_BTN, h: BAG_BTN }; }
// the open frame, its bottom edge on the button's top; it grows upward
function bagFrameRect() {
  const h = BAG_PAD * 2 + bagGridH(); // pad, the grid, pad
  return { x: VIEW_W - BAG_W, y: VIEW_H - BAG_BTN - h, w: BAG_W, h };
}
// cell i of the inventory grid
function bagCellRect(i) {
  const f = bagFrameRect();
  return {
    x: f.x + BAG_PAD + (i % BAG_COLS) * (BAG_CELL + BAG_GAP),
    y: f.y + BAG_PAD + ((i / BAG_COLS) | 0) * (BAG_CELL + BAG_GAP),
    w: BAG_CELL, h: BAG_CELL,
  };
}
// the pointer is over HUD that owns its own clicks, not over the world
function overHud(x, y) {
  return !!bagHit(x, y) || !!charHit(x, y) || !!shopHit(x, y) || !!stripHit(x, y) || abBuyHit(x, y) >= 0 ||
    !!shelfHit(x, y) || overMinimap();
}
// What the pointer is on: { kind: 'btn' } (the pack button) | { kind: 'cell',
// i } (a grid slot) | { kind: 'frame' } (anywhere else inside the open
// frame, swallowed and otherwise inert) | null. Shut, only the button
// answers - the rest of the corner is world. Shared by the click handler,
// the cursor and the widget's own hover, so the three can never disagree.
function bagHit(mx, my) {
  if (state.mode !== 'play' || player.dead || state.paused ||
      state.mapOpen || state.settingsOpen || state.wheel || window.DBG.hideUI) return null;
  const b = bagBtnRect();
  if (mx >= b.x && mx < b.x + b.w && my >= b.y && my < b.y + b.h) return { kind: 'btn' };
  if (!bagOpenNow()) return null;
  const f = bagFrameRect();
  if (mx < f.x || mx >= f.x + f.w || my < f.y || my >= f.y + f.h) return null;
  for (let i = 0; i < player.bagCap; i++) {
    const r = bagCellRect(i);
    if (mx >= r.x && mx < r.x + r.w && my >= r.y - 1 && my < r.y + r.h) return { kind: 'cell', i };
  }
  return { kind: 'frame' };
}
// one left click on the widget; returns true if it was swallowed
function bagClick(h) {
  if (!h) return false;
  if (h.kind === 'frame') return true; // the panel eats it; the world never sees it
  if (h.kind === 'btn') { state.bagOpen = !state.bagOpen; SFX.pickup(); return true; }
  const s = player.bag[h.i];
  if (!s) { SFX.deny(); return true; }
  if (CARD_TYPE_RARITY[s.type]) openDraft(CARD_TYPE_RARITY[s.type]);
  else SFX.deny();
  return true;
}

// ---- carrying an item on the cursor -------------------------------------
// One drag, shared by everything that can hold an item: the grid, the four
// weapon slots and the weapon shelf. `state.drag` is the cell riding the
// pointer - the SAME object the bag held, so a tool never loses its bits on
// the way across - and `from` is where to put it back when a release lands
// somewhere that will not take it.
//
// Releasing over the WORLD throws it: that is how a tool is thrown away, and
// the only way to get rid of one. Releasing anywhere on the HUD that is not a
// valid target returns it home instead, so the frame is a safe place to think
// better of a drag.
function dragTake(cell, from) {
  if (!cell) return false;
  state.drag = { cell, from };
  SFX.pickup();
  return true;
}
// Lifting what a well is holding onto the cursor: the move a press that
// TRAVELS makes (hudMove), one function over the three kinds of well so the
// three branches cannot drift apart. Returns whether anything was lifted.
function dragLift(src) {
  if (src.k === 'bag') {
    const s = player.bag[src.i];
    if (!s) return false;
    player.bag[src.i] = null;
    return dragTake(s, src);
  }
  if (src.k === 'slot') {
    const s = player.tools[src.i];
    if (!s) return false;
    player.tools[src.i] = null;
    return dragTake(s, src);
  }
  const cell = player.tools[src.slot];
  const was = cell && bitPut(cell, src.i, null);
  return was ? dragTake({ type: bitType(was), n: 1 }, src) : false;
}
// Put a carried cell back where the drag started. Home may have been filled
// behind it (the drop that landed there, a swap earlier in the same gesture),
// so every branch falls back to any free bag cell and then to the snow -
// nothing carried is ever destroyed by putting it down.
function dragReturn() {
  const d = state.drag;
  if (!d) return;
  const f = d.from;
  let home = false;
  if (f.k === 'bag') { if (!player.bag[f.i]) { player.bag[f.i] = d.cell; home = true; } }
  else if (f.k === 'slot') { if (!player.tools[f.i]) { player.tools[f.i] = d.cell; home = true; } }
  else if (f.k === 'bit') {
    // a bit came out of a tool as a one-off cell; it goes back as an id
    const t = player.tools[f.slot];
    if (t && !t.bits[f.i]) { t.bits[f.i] = bitIdOf(d.cell.type); home = true; }
  }
  if (!home && !bagPut(player, d.cell)) throwCell(d.cell);
  state.drag = null;
}
// the world takes it: dropped at the player's feet, instanced items whole
function throwCell(cell) {
  spawnDrop(player.x, player.y - 4, cell.type, cell.n, cell.bits ? cell : null);
  SFX.stash();
}
// Where the item a drop DISPLACES goes: HOME, the well this drag started
// from. That well is the one place already known to be free - it is where
// what is in hand came out of - so a drop onto a loaded well is a straight
// SWAP, the same one move each way the CLICK already makes (sendBagCell),
// instead of leaving the ousted item stuck to the cursor to be filed by hand.
//
// Home can be gone by the time it is asked: a stack that did not empty is
// still sitting in it, an earlier swap in the same gesture filled it, or it
// cannot hold this kind at all (a berry does not go in a bit cell, a bit does
// not go on the weapon key). Then this says no and the caller falls back to
// what it always did - the ousted item rides the cursor, which is free,
// because what was on it is what just went into the well.
function dragHome(out, from) {
  if (!from) return false;
  if (from.k === 'bag') {
    const s = player.bag[from.i];
    if (!s) { player.bag[from.i] = out; return true; }
    // refilled with more of its own kind: top that stack up instead
    const max = ITEMS[out.type] ? ITEMS[out.type].stack : 1;
    if (s.type === out.type && !s.bits && !out.bits && s.n + out.n <= max) { s.n += out.n; return true; }
    return false;
  }
  if (from.k === 'slot') {
    if (!isToolCell(out) || player.tools[from.i]) return false;
    player.tools[from.i] = out;
    return true;
  }
  const cell = player.tools[from.slot], id = bitIdOf(out.type);
  if (!id || out.n > 1 || !cell || cell.bits[from.i]) return false;
  bitPut(cell, from.i, id);
  return true;
}
// a carried cell landing on grid cell i: merge into the same kind if it will
// take it, otherwise swap with whatever is sitting there - what was here
// going back where the carried item came from (dragHome)
function dragDropBag(i) {
  const d = state.drag, s = player.bag[i];
  if (!s) { player.bag[i] = d.cell; state.drag = null; SFX.stash(); return true; }
  const max = ITEMS[d.cell.type] ? ITEMS[d.cell.type].stack : 1;
  if (s.type === d.cell.type && !s.bits && s.n < max) {
    const take = Math.min(d.cell.n, max - s.n);
    s.n += take; d.cell.n -= take;
    if (d.cell.n <= 0) state.drag = null;
    SFX.stash();
    return true;
  }
  player.bag[i] = d.cell;                 // the swap...
  state.drag = null;
  if (dragHome(s, d.from)) SFX.stash();
  else { state.drag = { cell: s, from: { k: 'bag', i } }; SFX.pickup(); } // ...or the cursor keeps it
  return true;
}
// opens the pick-1-of-3 draft for a rarity - a pure local UI state change,
// like the pack toggle above, not a contest (only the local human ever
// touches their own bag). Does NOT pause the sim: bag/map/wheel don't either.
function openDraft(rarity) {
  state.draft = { rarity, options: pick3Distinct(rarity) };
  SFX.pickup();
}
const DRAFT_CW = 130, DRAFT_CH = 96, DRAFT_GAP = 10;
function draftLayout() {
  const w = DRAFT_CW * 3 + DRAFT_GAP * 2;
  const x0 = Math.round((VIEW_W - w) / 2), y = Math.round((VIEW_H - DRAFT_CH) / 2);
  const cards = [];
  for (let i = 0; i < 3; i++) cards.push({ x: x0 + i * (DRAFT_CW + DRAFT_GAP), y, w: DRAFT_CW, h: DRAFT_CH });
  return cards;
}
function draftHit(mx, my) {
  if (!state.draft) return -1;
  const cards = draftLayout();
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i];
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return i;
  }
  return -1;
}
// a card picks it - bagTake, push onto p.cards, refreshKit, exactly the
// storage/kit halves the plan calls for; anywhere else just closes the
// draft. Either way the click never reaches the world (see mousedown).
function draftClick() {
  const d = state.draft;
  const i = draftHit(mouse.x, mouse.y);
  if (i >= 0) {
    const id = d.options[i];
    bagTake(player, cardKey(d.rarity), 1);
    player.cards.push({ rarity: d.rarity, id });
    refreshKit(player);
    addFloater(player.x, player.y - 18, CARDS[d.rarity][id].name, RES_COLORS[cardKey(d.rarity)]);
    SFX.levelUp();
  }
  state.draft = null;
}
// bots skip this UI entirely - see resolveCardForBot in the ai banner
function renderDraft() {
  const d = state.draft;
  ctx.fillStyle = 'rgba(6,10,24,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const cards = draftLayout();
  const col = RES_COLORS[cardKey(d.rarity)];
  const hit = draftHit(mouse.x, mouse.y);
  const title = d.rarity.toUpperCase() + ' CARD - CHOOSE ONE';
  drawPixelTextShadow(ctx, title, Math.round((VIEW_W - pixelTextWidth(title, 2)) / 2), cards[0].y - 16, col, '#0a0e23', 2);
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i], hot = hit === i;
    const lift = hot ? 2 : 0;
    const x = r.x, y = r.y - lift, w = r.w, h = r.h;
    ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(x + 2, r.y + 2, w, h);
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = hot ? '#1f2b5c' : '#141c3c'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = col;
    ctx.fillRect(x + 2, y + 1, w - 4, 1); ctx.fillRect(x + 1, y + 2, 1, h - 4);
    ctx.fillRect(x + 2, y + h - 2, w - 4, 1); ctx.fillRect(x + w - 2, y + 2, 1, h - 4);
    const card = CARDS[d.rarity][d.options[i]];
    ctx.drawImage(SPRITES[ITEMS[cardKey(d.rarity)].icon], x + Math.round(w / 2) - 4, y + 10);
    drawPixelTextShadow(ctx, card.name, x + Math.round((w - pixelTextWidth(card.name)) / 2), y + 26, hot ? '#ffd95c' : '#f4f7ff', '#0a0e23');
    drawPixelTextShadow(ctx, card.blurb, x + Math.round((w - pixelTextWidth(card.blurb)) / 2), y + 40, '#9fb6d8', '#0a0e23');
  }
}
// One cell, and the reason nothing in here is bigger than anything else:
// grid slots, gear plates and the pack button all come out of this. Returns
// the y it actually drew at, since a hover lift shifts it.
function bagCellPlate(r, rim, inner, lift) {
  const y = r.y - (lift ? 1 : 0);
  ctx.fillStyle = rim;
  ctx.fillRect(r.x, y, r.w, r.h);
  ctx.fillStyle = inner;
  ctx.fillRect(r.x + 1, y + 1, r.w - 2, r.h - 2);
  return y;
}

// ---- the pack icon: a 20px rucksack, baked once --------------------------
// The button is the whole widget while the pack is shut, so the old 12px
// item sprite is not enough icon for it: this is a proper leather rucksack -
// rolled flap with a gold buckle, stitched hem, two side pockets - drawn at
// the strip icons' detail level and centred on the 26px button plate.
const BAG_ICON = [
  '.....oooo...oooo....',
  '....os..o...o..so...',
  '....os.oooooo..so...',
  '...os.owwwwwwo.so...',
  '...osowhhwwhhwoso...',
  '..osowwwwwwwwwwoso..',
  '..osowwwwwwwwwwoso..',
  '..oootttttttttoooo..',
  '..owwwwwwggwwwwwwo..',
  '..owwwwwwgGwwwwwwo..',
  '.owuowwwwwwwwwwouwo.',
  '.owuowwwwwwwwwwouwo.',
  '.owuowwwwwwwwwwouwo.',
  '.owuowwwwwwwwwwouwo.',
  '.owwowwttttttwwowwo.',
  '.owwowwwwwwwwwwowwo.',
  '..oowwwwwwwwwwwwoo..',
  '...owwwwwwwwwwwwo...',
  '...ouuuuuuuuuuuuo...',
  '....oooooooooooo....',
];
const BAG_ICON_PAL = {
  o: '#141a2c', w: '#a8794a', u: '#6e4a28', h: '#c49a6a',
  t: '#e8dcb4', g: '#f2cc6a', G: '#b98a2e', s: '#5f6f96',
};
const bagIconCv = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 20;
  const g = cv.getContext('2d');
  for (let r = 0; r < BAG_ICON.length; r++) {
    for (let c = 0; c < BAG_ICON[r].length; c++) {
      const col = BAG_ICON_PAL[BAG_ICON[r][c]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(c, r, 1, 1);
    }
  }
  return cv;
})();

// ---- the character panel (G) ---------------------------------------------
// WoW's C key, at this game's size: one slab, sim running live behind it.
// LEFT: the body as it stands right now - the class sprite walking in place
// at 4x wearing its bought gear bands in their level materials
// (drawGearMarks, the same pixels every rival reads on you in the world) with
// the held weapon beside it - and under it the STAT LEDGER, GEAR_STATS read
// off the LIVE kit (kitOf), so gear levels, ability ranks and cards are all
// in the numbers. RIGHT: the four equipped pieces, each a 32px icon well
// (gearIcon32) with its variant name, gear's buy pips, and the next level's
// price; a click on an affordable well buys through the same input.cmd the
// old HUD row used, so bots and the panel still share one path. The ledger's
// labelled rows are the panels' text carve-out - comparing numbers is this
// panel's whole job. G toggles it, ESC or the X closes it; it swallows only
// its own clicks, so the fight stays live around it.
const CHAR_LEDW = 118, CHAR_WELL = 36;
function charLayout() {
  const rowW = 128;
  const pw = 8 + CHAR_LEDW + 10 + rowW + 8;
  const ph = 226;
  const px = Math.round((VIEW_W - pw) / 2), py = Math.round((VIEW_H - ph) / 2);
  const gx = px + 8 + CHAR_LEDW + 10;
  const rows = [];
  for (let i = 0; i < GEAR_SLOTS.length; i++) {
    rows.push({ x: gx, y: py + 22 + i * 50, w: rowW, h: CHAR_WELL });
  }
  return { panel: { x: px, y: py, w: pw, h: ph }, rows,
    prev: { x: px + 8, y: py + 22, w: CHAR_LEDW, h: 78 },
    led: { x: px + 8, y: py + 106, w: CHAR_LEDW },
    xr: { x: px + pw - 14, y: py + 4, w: 10, h: 10 } };
}
// 'x' | { piece } | 'panel' | null - shared by the click, the cursor and the
// tooltip so the three cannot disagree
function charHit(mx, my) {
  if (!state.charOpen || state.mode !== 'play' || player.dead || state.paused ||
      state.mapOpen || state.settingsOpen || state.wheel || window.DBG.hideUI) return null;
  const L = charLayout();
  const p = L.panel;
  if (mx < p.x || mx >= p.x + p.w || my < p.y || my >= p.y + p.h) return null;
  if (mx >= L.xr.x && mx < L.xr.x + L.xr.w && my >= L.xr.y && my < L.xr.y + L.xr.h) return 'x';
  for (let i = 0; i < L.rows.length; i++) {
    const r = L.rows[i];
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return { piece: i };
  }
  return 'panel';
}
// the piece index under the pointer, or -1 - the shape tipAt and the cursor
// already read gear through, kept so both keep working unchanged
function gearHit(mx, my) {
  const h = charHit(mx, my);
  return h && h.piece !== undefined ? h.piece : -1;
}
// a press inside the panel; returns whether it was swallowed
function charClick(h) {
  if (!h) return false;
  if (h === 'x') { state.charOpen = false; SFX.pickup(); return true; }
  if (h.piece !== undefined) { SFX.unlock(); player.input.cmd = { kind: 'gear', piece: h.piece }; return true; }
  return true; // the slab eats it; the world never sees it
}
function drawCharPanel(now) {
  const L = charLayout();
  const { panel } = L;
  const gh = mouse.inside ? charHit(mouse.x, mouse.y) : null;
  // a light dim: the match stays visible and live around the slab
  ctx.fillStyle = 'rgba(4,6,18,0.38)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // the slab, in the planks' own chrome
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; chamRect(panel.x + 3, panel.y + 3, panel.w, panel.h);
  ctx.fillStyle = '#0a0e23'; chamRect(panel.x, panel.y, panel.w, panel.h);
  ctx.fillStyle = '#10173a'; chamRect(panel.x + 1, panel.y + 1, panel.w - 2, panel.h - 2);
  ctx.fillStyle = '#35426e';
  ctx.fillRect(panel.x + 2, panel.y + 1, panel.w - 4, 1); ctx.fillRect(panel.x + 1, panel.y + 2, 1, panel.h - 4);
  ctx.fillStyle = '#080c1c';
  ctx.fillRect(panel.x + 2, panel.y + panel.h - 2, panel.w - 4, 1); ctx.fillRect(panel.x + panel.w - 2, panel.y + 2, 1, panel.h - 4);
  // the header: whose sheet this is - the name in the team's mark, the class
  // and hero level beside it in quiet ink
  const head = player.name;
  const sub = CLASSES[player.cls].name + ' ' + player.level;
  drawPixelTextShadow(ctx, head, panel.x + 8, panel.y + 6, TEAMS[skin(player.team)].mark, '#0a0e23');
  drawPixelTextShadow(ctx, sub, panel.x + 8 + pixelTextWidth(head) + 8, panel.y + 6, '#7a8bb8', '#0a0e23');
  // the body, live: walking in place with its bought bands in their level
  // materials and the held weapon beside it
  const pr = L.prev;
  ctx.fillStyle = '#0a0e23';
  ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
  ctx.fillStyle = '#232c52';
  ctx.fillRect(pr.x, pr.y, pr.w, 1); ctx.fillRect(pr.x, pr.y + pr.h - 1, pr.w, 1);
  ctx.fillRect(pr.x, pr.y, 1, pr.h); ctx.fillRect(pr.x + pr.w - 1, pr.y, 1, pr.h);
  const sx = pr.x + 12, sy = pr.y + 7;
  ctx.fillStyle = 'rgba(4,6,18,0.6)';
  ctx.beginPath(); ctx.ellipse(sx + 32, pr.y + pr.h - 6, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
  const spr = SPRITES.champ[player.cls][skin(0)].down[1 + (Math.floor(now * 3) % 2)];
  ctx.drawImage(spr, sx, sy, 64, 64);
  drawGearMarks(player, sx, sy, 4);
  const held = heldTool(player);
  if (held) {
    const im = SPRITES[ITEMS[held.type].icon];
    ctx.drawImage(im, pr.x + pr.w - 31, pr.y + pr.h - 33 + Math.round(Math.sin(now * 2.2) * 1.5), 24, 24);
  }
  // the ledger: every number the kit carries RIGHT NOW - gear levels, ability
  // ranks and cards already folded in, because it reads the live kit
  const k = kitOf(player);
  for (let i = 0; i < GEAR_STATS.length; i++) {
    const [label, get, fmt] = GEAR_STATS[i];
    const y = L.led.y + i * 8;
    drawPixelTextShadow(ctx, label, L.led.x, y, '#7a8bb8', '#0a0e23');
    const vTxt = fmt(get(k));
    drawPixelTextShadow(ctx, vTxt, L.led.x + L.led.w - pixelTextWidth(vTxt), y, '#f4f7ff', '#0a0e23');
    ctx.fillStyle = '#2c3a68'; // the leader: dots from the label to its number
    for (let dx = L.led.x + pixelTextWidth(label) + 4; dx < L.led.x + L.led.w - pixelTextWidth(vTxt) - 4; dx += 4) {
      ctx.fillRect(dx, y + 4, 2, 1);
    }
  }
  // the four equipped pieces: icon well, variant name in the level's
  // material, gear's buy pips, and the next level's price
  for (let i = 0; i < L.rows.length; i++) {
    const r = L.rows[i], lv = player.gearLv[i], cost = gearCost(player, i);
    const afford = cost && player.inv.gold >= cost.gold;
    const on = gh && gh.piece === i;
    const y = r.y - (on ? 1 : 0);
    ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(r.x + 2, r.y + 2, CHAR_WELL, CHAR_WELL);
    ctx.fillStyle = !cost ? '#c89a3c' : on ? '#8fa0c8'
      : afford ? (Math.sin(now * 8) > 0 ? '#f2cc6a' : '#c9a227') : '#2c3560';
    ctx.fillRect(r.x, y, CHAR_WELL, CHAR_WELL);
    ctx.fillStyle = '#0f1632';
    ctx.fillRect(r.x + 1, y + 1, CHAR_WELL - 2, CHAR_WELL - 2);
    ctx.drawImage(gearIcon32(i, player.gear[i]), r.x + 2, y + 2);
    const tx0 = r.x + CHAR_WELL + 6;
    drawPixelTextShadow(ctx, GEAR[i][player.gear[i]].name, tx0, y + 4, GEAR_MATS[lv - 1], '#0a0e23');
    for (let p2 = 0; p2 < GEAR_LV_MAX - 1; p2++) { // the buys, gear's own pips
      ctx.fillStyle = p2 < lv - 1 ? '#f2cc6a' : '#2c3560';
      ctx.fillRect(tx0 + p2 * 5, y + 14, 4, 2);
    }
    if (cost) { // the price, coin + number, in can/cannot ink
      ctx.drawImage(SPRITES.itemGold, tx0, y + 22);
      drawPixelTextShadow(ctx, String(cost.gold), tx0 + 10, y + 24,
        afford ? '#f5c542' : '#9fb6d8', '#0a0e23');
    }
  }
  // the X: the one way out that is drawn (ESC and G also close)
  const hot = gh === 'x';
  ctx.fillStyle = hot ? '#8fa0c8' : '#35426e';
  ctx.fillRect(L.xr.x, L.xr.y, L.xr.w, L.xr.h);
  ctx.fillStyle = '#0f1632';
  ctx.fillRect(L.xr.x + 1, L.xr.y + 1, L.xr.w - 2, L.xr.h - 2);
  ctx.fillStyle = hot ? '#f4f7ff' : '#8fa8d0';
  for (let k2 = 0; k2 < 4; k2++) {
    ctx.fillRect(L.xr.x + 3 + k2, L.xr.y + 3 + k2, 1, 1);
    ctx.fillRect(L.xr.x + L.xr.w - 4 - k2, L.xr.y + 3 + k2, 1, 1);
  }
}

// The shared meal clock over one food well: the cooldown SWEEPING round it
// behind the hand (drawSweepCover, the strip's one cooldown shape), or a white
// lift while THIS meal is the one being chewed - the two states an ability
// well already draws, said about food. (x, y, w, h) is the well's inner rect;
// the meal buttons are the only surface left that draws it, but it stays a
// function of the rect so anything that shows a meal wears the same clock.
function drawFoodClock(x, y, w, h, type) {
  const p = player;
  if (p.eatT > 0 && p.eatType === type) {
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#f4f7ff';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    return;
  }
  if (p.foodCd <= 0) return;
  // the hand only where there is room for one: under about twelve pixels it
  // is four long and lands ACROSS the icon, reading as a scratch on the fruit
  // rather than a clock over it, so the smallest wells turn the bare veil -
  // the same wedge sweeping the same way, minus the stroke that would own the
  // icon
  drawSweepCover(x, y, w, h, Math.min(1, p.foodCd / FOOD_CD), CD_SWEEP, w >= 12 ? CD_EDGE : null);
}

// ---- the pack's SHIFT plate ---------------------------------------------
// The one keybind indicator the backpack carries (the carve-out CLAUDE.md's
// UI rule names), in the world prompts' own key-cap grammar. It is up while
// the pointer is on a well that has somewhere to send what it holds - a bit
// in the grid (into the weapon), a bit on the shelf or a tool on the
// weapon (back into the pack), a tool in the grid (into your hands) - and its
// verb is that DESTINATION, so the plate teaches which way the transfer goes
// rather than merely announcing a key. The cap depresses while shift is
// actually down, so it also answers "is it registering".
//
// Shift-click IS that transfer, in both hands: with an empty one it is the
// plain click's own move (hudRelease), and while carrying something it is
// sendAt, which spends the click on this well and leaves the hand loaded. The
// verb reads the same either way, because the well's item goes the same way.
// A card gets no plate: drafting is not a transfer, and a plate over it would
// promise a move that does not exist.
function shiftVerb(mx, my) {
  if (!mouse.inside || player.dead) return null;
  const fh = shelfHit(mx, my);    // the same wells, in the same order, sendAt tries
  if (fh) return (fh.kind === 'bit' ? shelfCell().bits[fh.i] : shelfCell()) ? 'STOW' : null;
  const sh = stripHit(mx, my);
  if (sh) return sh.kind === 'slot' && player.tools[sh.i] ? 'STOW' : null;
  const bh = bagHit(mx, my);
  if (!bh || bh.kind !== 'cell') return null;
  const s = player.bag[bh.i];
  if (isToolCell(s)) return 'HOLD';                    // trades places with the weapon
  return s && bitIdOf(s.type) && heldTool(player) ? 'LOAD' : null;
}
function drawShiftHint() {
  const verb = shiftVerb(mouse.x, mouse.y);
  if (!verb) return;
  // over the pack's top-right corner, whether it is the open frame or the
  // shut button - clear of the grid it is about, and of the shelf over it
  const totalW = promptW(verb, 'slide');
  // clear of the SHELF, rails and all - the plate hangs over the whole corner
  // widget, and a fitting's rail must never grow up through it
  const top = shelfUp() ? shelfTopY() : bagOpenNow() ? bagFrameRect().y : bagBtnRect().y;
  drawKeyPrompt(VIEW_W - 2 - totalW, top - 12, verb, keyHeld('slide'), 'slide');
}

function drawBag(now) {
  if (player.dead) return;
  const hov = mouse.inside ? bagHit(mouse.x, mouse.y) : null;
  const red = bagFlash > 0;
  const open = bagOpenNow();
  ctx.save();
  // inward only: a ±1 shake on a flush right edge would clip a column of rim
  ctx.translate(red ? (((now * 40) | 0) % 2 ? -1 : 0) : 0, 0);
  // The button, shut and open alike: hover lights the rim, open keeps it lit,
  // a bag with no free cell wears amber whatever the pointer is doing, and a
  // refusal reddens it - the button is the whole widget while the pack is
  // shut, so every state the frame used to carry lives on it too.
  const btn = bagBtnRect();
  const onBtn = hov && hov.kind === 'btn';
  const full = bagUsed(player) >= player.bagCap;
  ctx.fillStyle = red ? '#c2465a' : onBtn || open ? '#8fa0c8' : full ? '#c9922f' : '#35426e';
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
  ctx.fillStyle = red ? BAG_BG_RED : open ? '#182350' : BAG_WELL;
  ctx.fillRect(btn.x + 1, btn.y + 1, btn.w - 2, btn.h - 2);
  ctx.drawImage(bagIconCv, btn.x + 3, btn.y + 3);
  if (open) {
    // The frame, off the button's top edge. No cast shadow: it is hard
    // against the screen's right edge, and the cells already carry the depth.
    const f = bagFrameRect();
    ctx.fillStyle = red ? BAG_BG_RED : BAG_BG; // one opaque ground for the whole widget
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = red ? '#c2465a' : '#2c3a68';
    ctx.fillRect(f.x, f.y, f.w, 1); ctx.fillRect(f.x, f.y + f.h - 1, f.w, 1);
    ctx.fillRect(f.x, f.y, 1, f.h); ctx.fillRect(f.x + f.w - 1, f.y, 1, f.h);
    for (let i = 0; i < player.bagCap; i++) {
      const r = bagCellRect(i), s = player.bag[i];
      const on = hov && hov.kind === 'cell' && hov.i === i;
      // an EMPTY cell is the lighter one. It has no icon to show off, so the
      // well itself has to be the thing you see - free space is what the grid
      // is being read for - while a full cell goes dark behind its item. A
      // tool or a bit brings its own ground: the tier plate, which is where
      // the whole "how good is this find" question is answered.
      const tp = s ? tierPlate(s.type, on) : null;
      const y = bagCellPlate(r, on ? '#8fa0c8' : s ? tp.rim : '#2c3560',
        s ? tp.plate : '#171f45', on && s);
      if (!s) continue;
      modPlate(s.type, r, y);
      tierShine(r, y, s.type, now);
      // the icon sits high in the cell so the count can have the bottom
      // right corner without its outline eating the cell's own rim
      drawItemIcon(s.type, r, y - 2);
      if (s.n > 1) { // a lone item needs no '1' on it - an empty corner says it
        const t = String(s.n);
        drawPixelTextOutline(ctx, t, r.x + r.w - 3 - pixelTextWidth(t), y + 10, '#f4f7ff', '#0f1632');
      }
      // a loaded tool counts its bits in the corner the stack number would
      // have used, so a full build is told apart from a bare body in the grid
      if (s.bits) {
        for (let k = 0; k < s.bits.length && k < 5; k++) {
          ctx.fillStyle = s.bits[k] ? BITS[s.bits[k]].col : '#2c3560';
          ctx.fillRect(r.x + 3 + k * 3, y + r.h - 4, 2, 2);
        }
      }
      // Food answers to one shared clock (FOOD_CD, js/core.js), so it wipes
    }
  }
  ctx.restore();
  drawShiftHint(); // outside the refusal shake: the plate is not what refused
}

// ---- hud strip: the weapon and ability wells over the xp bar, bottom-centre
// One opaque plate. Five wells on top: the WEAPON first on the left - the
// tool the button fires - with the four class abilities following in key
// order 1-4; under them the plum xp bar (xp IS lifetime gold), notched into
// AB_SEGS segments so progress through a level is countable at a glance. The
// bar sits at the BOTTOM so the strip's top edge is open screen: that is
// where an affordable ability level floats its buy plate (abBuyRect below),
// and a plate bobbing through the bar was the reason the bar moved.
// The dodge pips the old rail carried are gone: the reticle and the overhead
// bar already say it.
//
// A tool cell says three things without a word on it. The PLATE behind the
// icon is the tool's tier colour, the same colour it wears in every other
// well it ever sits in. The SELECTED slot is the one with the lit rim, lifted
// a pixel off the plate. And the cooldown between shots wipes top-down over
// the whole well, so the tool's rate of fire is the shape of the wipe rather
// than a number anywhere. What is loaded stays out of the resting well - the
// shelf over the backpack is where the build is read and edited.
//
// The strip proper is FIVE wells: [ WEAPON ][1][2][3][4] - the weapon leads
// and the class abilities follow in key order, each wearing its 32px icon
// (classAbIcon, js/abilities.js). On the right end the two MEAL buttons
// stack: berry over fish, half-height cells (two of them + the gap = one
// well, so the pair sits flush with the wells), each wearing its item
// icon, its count and its key letter, and both wiping on the one shared
// food clock (drawFoodClock) the bag's cells already wear. THE MEALS ARE
// ALWAYS HERE: food is a pouch and not a bag stack (the `inventory` banner,
// js/player.js), so these two buttons are the whole of where a berry and a
// fish are read and pressed, and the counts on them are uncapped - hence
// FOOD_W, wide enough for shortNum's four characters beside the icon.
//
// And flush on the strip's top edge over that column, THE PURSE: the coin and
// the gold behind it, on screen for the whole match. Money is the number a
// player is deciding on all game - what the counter is asking, what a gear
// level costs, whether that kill was worth it - and it used to be readable
// only with the pack open. It is a tab of the strip rather than a bar of its
// own so it slides in with the HUD, scales with it, and stays one glance from
// the meals and the abilities it is spent on.
const AB_CELL = 34, AB_GAP = 2, AB_N = 4; // AB_CELL: a strip well; AB_N: abilities
const FOOD_CELL = 16; // a meal button's height; 2 * FOOD_CELL + AB_GAP = AB_CELL
const FOOD_W = 40;    // ...and its width: the key cap, the 8px icon and a 4-char count
const FOOD_ICON_X = 13; // the icon is PINNED, so a count that grows never shifts it
const PURSE_H = 11;   // the tab over that column: an 8px coin with a pixel of air
const AB_W = (AB_N + 1) * AB_CELL + (AB_N + 1) * AB_GAP + FOOD_W;
const AB_PAD = 2, AB_XP = 5, AB_SEGS = 10; // AB_SEGS: xp bar notches
const AB_H = AB_PAD + AB_CELL + AB_PAD + AB_XP + AB_PAD;
const AB_BG = '#0d1229';
// The weapon well's half of the refusal the backpack already has: a bit that
// will not fit in the tool reddens and shakes the WELL, exactly as one that
// will not fit in the pack reddens and shakes the frame (bagDenied) - so the
// two containers say "full" in one language, and the one that is full is the
// one that answers. updateFx ages it on wall time, beside bagFlash.
let toolFlash = 0;
function toolDenied() {
  if (toolFlash > 0) return;
  toolFlash = 0.6;
  SFX.deny();
}
function hudStripRect() {
  return { x: Math.round((VIEW_W - AB_W) / 2), y: VIEW_H - AB_H, w: AB_W, h: AB_H };
}
// How far the strip drops to be AWAY: its own height plus the purse tab
// standing on it, so the whole widget clears the bottom edge rather than
// leaving a sliver of tab over a cinematic.
const HUD_SLIDE = AB_H + PURSE_H;
// How far the HUD has slid in: 0 while it is away below the screen, 1 once it
// is home. The intro rides it up (renderUI) - and a ceremony PINS it there,
// because the drop brief's camera branch holds state.intro for the whole
// roost tour (js/sim.js), which is how the HUD stays off a cinematic. Every
// piece that hangs in the open screen ABOVE the strip - the buy plates, which
// the slide is not deep enough to carry off the bottom on their own - asks
// this before it draws or answers the pointer, or it bobs there alone over a
// cinematic with no strip under it.
function hudInT() {
  return state.intro > 0 ? easeOut(Math.max(0, 1 - state.intro / HUD_IN_T)) : 1;
}
function hudHome() { return hudInT() >= 1; }
// The HUD SIZE dial (settings.hudScale, the ESC panel's GAME page). The strip
// keeps ALL its geometry in this 1x space and drawHudScaled blits the whole
// widget scaled about its bottom-centre anchor; stripMouse maps the pointer
// back through that anchor, so every hit test below converts first and the
// rects themselves never move.
// a phone keeps a HUD SIZE of its own (hudScaleM): the same slider edits
// whichever is live, so a profile that plays on both keeps both
function hudScaleKey() { return MOBILE ? 'hudScaleM' : 'hudScale'; }
function hudSc() { return settings[hudScaleKey()] || 0.8; }
function stripMouse(mx, my) {
  const s = hudSc();
  if (s === 1) return { x: mx, y: my };
  return { x: VIEW_W / 2 + (mx - VIEW_W / 2) / s, y: VIEW_H + (my - VIEW_H) / s };
}
// well j of the five, left to right, over the xp bar
function stripCellRect(j) {
  const R = hudStripRect();
  return { x: R.x + j * (AB_CELL + AB_GAP), y: R.y + AB_PAD, w: AB_CELL, h: AB_CELL };
}
// the ONE weapon well, the strip's left end (i is kept so the drag plumbing
// stays generic over slots)
function toolCellRect(i) { return stripCellRect(i); }
// ability i's well: keys 1-4, in order to the weapon's right
function abCellRect(i) { return stripCellRect(1 + i); }
// meal button i (0 the berry over 1 the fish), the strip's right end
const FOOD_BTNS = [{ type: 'berry', act: 'berry' }, { type: 'fish', act: 'fish' }]; // the meal, and the action whose key its cap prints
function foodCellRect(i) {
  const R = hudStripRect();
  return { x: R.x + AB_W - FOOD_W, y: R.y + AB_PAD + i * (FOOD_CELL + AB_GAP), w: FOOD_W, h: FOOD_CELL };
}
// the purse tab, flush on the strip's top rim over the meal column
function pursePlateRect() {
  const R = hudStripRect();
  return { x: R.x + AB_W - FOOD_W, y: R.y - PURSE_H, w: FOOD_W, h: PURSE_H };
}
// The meal buttons' share of that refusal: a press that could not become a
// meal - nothing in the bag, the clock still up, full health, a busy body -
// reddens and shakes the button that was asked, in the red the well and the
// pack already refuses in, so a Q with no berry reads as denied rather than
// dead. startEat is the one path every press takes (key or click), so it is
// the one caller; a second press on the same button while the red is up is
// swallowed as the pack's is, while the other meal's button answers fresh.
// updateFx ages it on wall time beside bagFlash and toolFlash.
let foodFlash = 0, foodFlashI = 0;
function foodDenied(type) {
  const i = type === 'fish' ? 1 : 0;
  if (foodFlash > 0 && foodFlashI === i) return;
  foodFlash = 0.6;
  foodFlashI = i;
  SFX.deny();
}
// And the ability wells' share of it: a key nobody has spent a point on is
// LOCKED (abUnlocked, js/abilities.js), and its well already stands dim with
// a dark icon - but a press has to answer, so the asked well reddens and
// shakes in the same red the pack, the weapon well and the meal buttons
// refuse in. tryAbility is the one caller, so key and click speak alike; a
// cooldown is NOT this refusal - the wipe already says when it comes home.
let abFlash = 0, abFlashI = 0;
function abDenied(i) {
  if (abFlash > 0 && abFlashI === i) return;
  abFlash = 0.6;
  abFlashI = i;
  SFX.deny();
}
// The floating buy plate: an affordable ability level's ask hovers in the
// open screen ABOVE the well - gear's old chevron grammar, made a real
// button. The plate is the buy click and the well below stays purely the
// cast, so the two can never steal each other's press. The rect is FIXED
// (the bob is drawn, never hit-tested) and 3px taller than the plate so the
// bob's whole travel stays inside it.
const AB_BUY = 14;
function abBuyRect(i) {
  const r = abCellRect(i);
  return { x: r.x + ((r.w - AB_BUY) >> 1), y: r.y - AB_BUY - 6, w: AB_BUY, h: AB_BUY + 3 };
}
// which ability's plate the pointer is on, or -1. A plate only EXISTS while
// a skill point is waiting and the key has room (abLvCanBuy), so the hit
// test is also the appears-then-goes gate - shared by the press, the
// cursor, the tooltip and the pixels.
function abBuyHit(mx, my) {
  if (state.mode !== 'play' || player.dead || state.paused || !hudHome() ||
      state.mapOpen || state.settingsOpen || state.wheel || window.DBG.hideUI) return -1;
  ({ x: mx, y: my } = stripMouse(mx, my));
  for (let i = 0; i < AB_N; i++) {
    if (!abLvCanBuy(player, i)) continue;
    const r = abBuyRect(i);
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return i;
  }
  return -1;
}
// { kind:'slot', i } | { kind:'ab', i } | { kind:'food', i } | { kind:'frame' }
// | null. Shared by the click handler, the cursor and the strip's own hover
// so they cannot disagree.
function stripHit(mx, my) {
  if (state.mode !== 'play' || player.dead || state.paused ||
      state.mapOpen || state.settingsOpen || state.wheel || window.DBG.hideUI) return null;
  ({ x: mx, y: my } = stripMouse(mx, my));
  const R = hudStripRect();
  // the purse tab: opaque HUD, so it swallows its own clicks the way the rest
  // of the strip's plate does - a readout is not a button, but it is not a
  // hole through to the snow either
  const pr = pursePlateRect();
  if (mx >= pr.x && mx < pr.x + pr.w && my >= pr.y && my < pr.y + pr.h) return { kind: 'frame' };
  if (mx < R.x - 3 || mx >= R.x + R.w + 3 || my < R.y || my >= R.y + R.h) return null;
  for (let i = 0; i < TOOL_SLOTS; i++) {
    const s = toolCellRect(i);
    if (mx >= s.x && mx < s.x + s.w && my >= s.y - 1 && my < s.y + s.h) return { kind: 'slot', i };
  }
  for (let i = 0; i < AB_N; i++) {
    const s = abCellRect(i);
    if (mx >= s.x && mx < s.x + s.w && my >= s.y - 1 && my < s.y + s.h) return { kind: 'ab', i };
  }
  for (let i = 0; i < FOOD_BTNS.length; i++) {
    const s = foodCellRect(i);
    if (mx >= s.x && mx < s.x + s.w && my >= s.y - 1 && my < s.y + s.h) return { kind: 'food', i };
  }
  return { kind: 'frame' };
}

// ---- the weapon shelf ----------------------------------------------------
// THE BUILD IS ON SCREEN AT ALL TIMES, on the backpack's top edge: the tool at
// the left end and its bit cells running right in FIRING ORDER - which is also
// the direction a fitting reaches along, so the row reads the way the press
// resolves. It used to rise out of the strip's weapon well on hover, and a
// build you had to hold the pointer still to see was a build nobody looked at;
// here it sits in the one corner already about carried things, a cell away
// from the pack it is loaded out of.
//
// It is NOT a panel. Bare wells with their own drop shadows, exactly as the
// risen column was, so the corner stays world everywhere between them and only
// a cell itself ever swallows a click.
//
// Pinned by its BOTTOM to the pack (the open frame's top edge, or the shut
// button's) and grown upward: the budget track and the row keep their pixels
// whatever the build does, and a fitting's rail is what climbs into the open
// screen above them.
const SHELF_CELL = 16, SHELF_GAP = 2; // a well, and the air between two
const SHELF_BAR = 4;                  // the budget track, under the row
const SHELF_RAIL = 3;                 // what one modifier's rail costs above it
const SHELF_SLOT = 0;                 // the weapon slot it edits (TOOL_SLOTS is 1)
// the tool the shelf is showing, or null with the weapon well empty
function shelfCell() { return player.tools[SHELF_SLOT] || null; }
// ...and whether the shelf is on screen and answering the pointer at all: the
// backpack's own gate, since the two are one widget in the corner now
function shelfUp() {
  return state.mode === 'play' && !player.dead && !state.paused &&
    !state.mapOpen && !state.settingsOpen && !state.wheel && !window.DBG.hideUI;
}
// how many wells the row is: the tool, and one per bit cell it has
function shelfCells() { const c = shelfCell(); return (c ? c.bits.length : 0) + 1; }
// THE ROW STEPS OVER THE STRIP RATHER THAN UNDER IT. The strip is the one HUD
// piece the HUD SIZE dial scales, and at the top of its range the purse tab on
// its right rim climbs into the corner a wide row stands in. What the next
// press will fire is not a thing to read through a gold counter, so the shelf
// lifts by exactly enough to clear the tab - which only ever happens at the
// dial's largest sizes with a four- or five-cell tool.
function shelfLift() {
  const s = hudSc();
  if (s <= 1) return 0;
  const pr = pursePlateRect();
  // where the tab's right edge and top land, through drawHudScaled's own map
  const rx = VIEW_W / 2 - (VIEW_W / 2 - (pr.x + pr.w)) * s;
  const ry = VIEW_H - (VIEW_H - pr.y) * s;
  const n = shelfCells();
  if (rx <= VIEW_W - BAG_PAD - n * SHELF_CELL - (n - 1) * SHELF_GAP) return 0; // clear of the row anyway
  const bottom = (bagOpenNow() ? bagFrameRect().y : bagBtnRect().y) - 2;       // the budget track's underside
  return Math.max(0, Math.ceil(bottom - ry + 1));
}
// Cell -1 is the TOOL and 0..cap-1 are its bits: one row, left to right, its
// RIGHT end flush with the pack's grid below it. A bigger tool grows the row
// leftward rather than shifting the corner it is read in, and only the widest
// (a 5-cell longbow) reaches past the pack's own edge.
function shelfCellRect(i) {
  const n = shelfCells(); // the tool leads the row
  const k = i + 1;
  const top = bagOpenNow() ? bagFrameRect().y : bagBtnRect().y;
  return {
    x: VIEW_W - BAG_PAD - (n - k) * SHELF_CELL - (n - 1 - k) * SHELF_GAP,
    y: top - 2 - SHELF_BAR - 1 - SHELF_CELL - shelfLift(),
    w: SHELF_CELL, h: SHELF_CELL,
  };
}
// What the pointer is on: { kind: 'tool' } | { kind: 'bit', i } | null. The
// gaps, the rails and the budget track are not hit tested - they say things,
// they do not take anything, and the snow behind them stays clickable.
function shelfHit(mx, my) {
  if (!shelfUp()) return null;
  const t = shelfCellRect(-1);
  if (mx >= t.x && mx < t.x + t.w && my >= t.y && my < t.y + t.h) return { kind: 'tool' };
  const cell = shelfCell();
  if (!cell) return null;
  for (let i = 0; i < cell.bits.length; i++) {
    const r = shelfCellRect(i);
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) return { kind: 'bit', i };
  }
  return null;
}
// WHICH FITTING REACHES WHICH SHOT, as one rail per modifier over the row.
// A rail starts at its own cell and runs right to the last shot it touches,
// with a blip under every shot on the way that it is actually in the envelope
// of - which is the forward-only rule drawn rather than written down. The
// reach is read off toolPlan's own `mods`, so the picture cannot claim a rule
// the press does not follow.
//
// The LAST modifier takes the rail nearest the row and earlier ones stack
// above it. That order is what keeps the picture untangled: a rail's stem
// drops to its own cell through the rails under it, and every one of those
// belongs to a later modifier, which by definition starts further RIGHT - so
// no stem ever crosses a line.
function shelfRails(cell, plan) {
  const out = [];
  for (let i = cell.bits.length - 1; i >= 0; i--) {
    const id = cell.bits[i];
    if (!id || BITS[id].proj) continue;
    const hits = plan.shots.filter((s) => s.mods.indexOf(i) >= 0).map((s) => s.i);
    if (hits.length) out.push({ i, hits, col: BITS[id].col });
  }
  return out;
}
// The top of everything the shelf draws: the row, and one rail for every
// fitting that reaches a shot. Whatever hangs over the shelf (the pack's SHIFT
// plate) clears THIS rather than the row, so a rail can never grow up into it.
function shelfTopY() {
  const cell = shelfCell(), row = shelfCellRect(-1).y;
  return cell ? row - 3 - shelfRails(cell, toolPlan(cell)).length * SHELF_RAIL : row;
}
// A carried bit landing in bit cell i of slot s. One bit comes off the stack;
// whatever it displaces goes home first (dragHome - the pack cell or the bit
// cell this drag began in, which makes the drop a swap), then onto the
// now-free hand, into the bag, or onto the snow, so it is never a deletion.
function dragDropBit(s, i) {
  const cell = player.tools[s], d = state.drag, from = d.from;
  const id = bitIdOf(d.cell.type);
  if (!id) { SFX.deny(); return; }        // a tool does not go inside a tool
  const was = bitPut(cell, i, id);
  d.cell.n--;
  if (d.cell.n <= 0) state.drag = null;
  if (was) {
    const out = { type: bitType(was), n: 1 };
    if (!dragHome(out, from)) {
      if (!state.drag) state.drag = { cell: out, from: { k: 'bit', slot: s, i } };
      else if (!bagPut(player, out)) throwCell(out);
    }
  }
  SFX.stash();
}
// A carried tool landing on weapon slot i. Only a tool goes here - a bit
// dropped on a slot is refused rather than quietly swallowed, because a bit
// belongs in a tool, not on a key. The tool it displaces takes the bag cell
// this one came out of (dragHome), which is the swap the CLICK already makes.
function dragDropSlot(i) {
  const d = state.drag, from = d.from;
  if (!isToolCell(d.cell)) { SFX.deny(); return; }
  const was = slotPut(player, i, d.cell);
  state.drag = null;
  if (was && !dragHome(was, from)) state.drag = { cell: was, from: { k: 'slot', i } };
  SFX.place();
}
// Where the carried item is being let go. Every well that can hold one is
// tried, then the rest of the HUD sends it home, and only the WORLD throws it
// away - so a fumbled release inside the frame costs nothing and a deliberate
// drag out onto the snow is the one way to get rid of a tool.
function dragDrop(mx, my) {
  // the counter first: its sell well is the one place a release turns an item
  // into gold, and the rest of the slab sends it home
  const sp = shopHit(mx, my);
  if (sp) { if (sp.kind === 'sell') shopDropSell(); else dragReturn(); return; }
  const fh = shelfHit(mx, my);
  if (fh) {
    if (fh.kind === 'bit') dragDropBit(SHELF_SLOT, fh.i);
    else dragDropSlot(SHELF_SLOT);
    return;
  }
  const sh = stripHit(mx, my);
  if (sh) { if (sh.kind === 'slot') dragDropSlot(sh.i); else dragReturn(); return; }
  const bh = bagHit(mx, my);
  if (bh) { if (bh.kind === 'cell') dragDropBag(bh.i); else dragReturn(); return; }
  if (overHud(mx, my)) { dragReturn(); return; }
  throwCell(state.drag.cell);
  state.drag = null;
}

// ---- one click sends it to the other side -------------------------------
// Every well here has exactly ONE sensible destination, so the CLICK is the
// whole move: a bit in the grid loads into the weapon's first free cell, a
// bit on the shelf comes back to the pack, a tool in the grid trades places
// with the weapon in hand, and the weapon well stows what it holds in the
// pack the way a bit does. That completes the grammar the backpack already
// had - clicking a cell USES what is in it, a card by drawing from it - for
// the two kinds that had no use and could only deny.
//
// It is resolved on the RELEASE like every other click (hudRelease), never on
// the press, so a press that travels is still a drag and arranging the pack
// by hand is untouched. Each returns whether it HANDLED the click: a card and
// an empty cell are not transfers, and there it falls through to the click it
// always was.
//
// Nothing here can destroy anything - when the destination has no room the
// item does not move at all, and the container that is full is the one that
// reddens and buzzes (bagDenied / toolDenied), which is the same refusal a
// drop you cannot carry already fires.

// a grid cell: a tool swaps into the hand, a bit loads into the weapon
function sendBagCell(i) {
  const s = player.bag[i];
  if (!s) return false;
  if (isToolCell(s)) {
    // the swap is one move each way: what was in hand lands in the cell the
    // tool just left, so the grid never grows or loses a row
    player.bag[i] = slotPut(player, player.toolSel, s) || null;
    SFX.place();
    return true;
  }
  const id = bitIdOf(s.type);
  if (!id) return false;            // a card: nowhere else to be
  const cell = heldTool(player);
  const free = cell ? cell.bits.indexOf(null) : -1;
  if (free < 0) { toolDenied(); return true; } // no weapon, or every cell loaded
  bitPut(cell, free, id);
  if (--s.n <= 0) player.bag[i] = null;
  SFX.stash();
  return true;
}
// a bit cell of the shelf: back into the pack, topping up a stack of
// its own kind first (bagAdd), and staying put if none of it fits
function sendBitCell(s, i) {
  const cell = player.tools[s];
  const id = cell && cell.bits[i];
  if (!id) return false;
  if (!bagAdd(player, bitType(id), 1)) { bagDenied(); return true; }
  bitPut(cell, i, null);
  SFX.stash();
  return true;
}
// the weapon well: the tool stows in the pack, bits and all, exactly as a bit
// does - the same gesture, one well over
function sendSlot(i) {
  const cell = player.tools[i];
  if (!cell) return false;
  if (!bagPut(player, cell)) { bagDenied(); return true; } // put it down before lifting it
  slotPut(player, i, null);
  SFX.place();
  return true;
}
// Where a SHIFT-held release lands while something is riding the cursor: the
// same wells dragDrop tries, in the same order, but acting on what is already
// SITTING there instead of on what is in hand. Everything else - the rest of
// the frame, the world - does nothing at all, because shift's whole promise
// is that the item in hand is still in hand afterwards.
function sendAt(mx, my) {
  const fh = shelfHit(mx, my);
  if (fh) return fh.kind === 'bit' ? sendBitCell(SHELF_SLOT, fh.i) : sendSlot(SHELF_SLOT);
  const sh = stripHit(mx, my);
  if (sh) return sh.kind === 'slot' && sendSlot(sh.i);
  const bh = bagHit(mx, my);
  if (bh) return bh.kind === 'cell' && sendBagCell(bh.i);
  return false;
}

// ---- the press / move / release the drag is made of ---------------------
// A press ARMS a pick-up rather than performing one, and only movement past a
// few pixels promotes it into a live drag. That is what keeps one gesture
// doing two jobs: a tap on a card still draws from it and a tap on a bit sends
// it into the weapon, while a drag off either one picks it up. `state.dragPend`
// is the armed press; it never survives the release that resolves it, and it
// is also where a press made WHILE CARRYING records which of the two things
// this gesture is (`keep`), so letting go of shift mid-click cannot change
// its mind halfway through.
const DRAG_SLOP = 3; // px of travel before a press becomes a drag
function hudPress(mx, my) {
  // Already carrying something: a plain press puts it down where it lands
  // (dragDrop), while a press begun with SHIFT is held for the release, which
  // acts on the well under the pointer and leaves the item in hand.
  if (state.drag) {
    if (keyHeld('slide')) state.dragPend = { keep: true };
    else dragDrop(mx, my);
    return true;
  }
  const fh = shelfHit(mx, my);
  if (fh) {
    if (fh.kind === 'bit') {
      if (shelfCell().bits[fh.i]) state.dragPend = { src: { k: 'bit', slot: SHELF_SLOT, i: fh.i }, x: mx, y: my };
    } else {
      state.dragPend = { src: { k: 'slot', i: SHELF_SLOT }, x: mx, y: my, empty: !shelfCell() };
    }
    return true; // the shelf swallows the press either way
  }
  // the floating buy plate over an ability well: its own press, clear of the
  // strip, so buying a level and casting can never steal each other's click
  const abb = abBuyHit(mx, my);
  if (abb >= 0) {
    SFX.unlock();
    player.input.cmd = { kind: 'ability', i: abb };
    return true;
  }
  const sh = stripHit(mx, my);
  if (sh) {
    if (sh.kind === 'ab') player.input.ability = sh.i; // click-to-cast: the well IS the key
    else if (sh.kind === 'food') player.input[sh.i === 0 ? 'eatBerry' : 'eatFish'] = true; // the button IS the key, refusals and all (startEat)
    else if (sh.kind === 'slot' && player.tools[sh.i]) state.dragPend = { src: { k: 'slot', i: sh.i }, x: mx, y: my };
    else if (sh.kind === 'slot') state.dragPend = { src: { k: 'slot', i: sh.i }, x: mx, y: my, empty: true };
    return true;
  }
  const bh = bagHit(mx, my);
  if (bh) {
    if (bh.kind === 'cell' && player.bag[bh.i]) state.dragPend = { src: { k: 'bag', i: bh.i }, x: mx, y: my };
    else if (bh.kind !== 'cell') return bagClick(bh); // the pack button acts on the press
    return true;
  }
  return false;
}
// the pointer moved: an armed press that has travelled far enough becomes the
// drag itself, lifting the item out of wherever it was sitting
function hudMove(mx, my) {
  const q = state.dragPend;
  if (!q || q.empty || q.keep) return; // neither an empty well nor a shift-hold picks anything up
  if (Math.abs(mx - q.x) < DRAG_SLOP && Math.abs(my - q.y) < DRAG_SLOP) return;
  state.dragPend = null;
  dragLift(q.src);
}
// The release, where every click in this widget is actually decided. A live
// drag is put down - or, when the press was begun with shift held, spends
// itself on the well under the pointer and stays in hand (sendAt). An armed
// press that never travelled is the click it always was, and that click is
// the TRANSFER: the bag cell's own use (a bit into the weapon, a tool into
// the hand, otherwise bagClick's eat/draft), the weapon well and a bit cell
// of the shelf both stowing what they hold in the pack.
//
// SHIFT sends too, in both hands: with an empty one it is the plain click
// (below - the transfer is what shift-click means everywhere else, so the
// modifier costs nothing and finds the gesture for anybody who reaches for
// it), and while carrying it is the same transfer aimed at the well under
// the pointer instead of at what is in hand (sendAt above).
function hudRelease(mx, my) {
  const q = state.dragPend;
  state.dragPend = null;
  if (state.drag) {
    if (q && q.keep) sendAt(mx, my);
    else dragDrop(mx, my);
    return true;
  }
  if (!q) return false;
  if (q.src.k === 'bag') { if (!sendBagCell(q.src.i)) bagClick({ kind: 'cell', i: q.src.i }); }
  else if (q.src.k === 'slot') sendSlot(q.src.i);
  else sendBitCell(q.src.slot, q.src.i);
  return true;
}
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
// else 8x8), so one call covers every well the two sizes share
function drawItemIcon(type, r, y, g) {
  const d = ITEMS[type];
  if (!d) return;
  const im = SPRITES[d.icon];
  if (!im) return;
  (g || ctx).drawImage(im, r.x + ((r.w - im.width) >> 1), y + ((r.h - im.height) >> 1));
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
function drawToolCell(i, now, hov) {
  const p = player;
  const cell = p.tools[i];
  const sel = p.toolSel === i;
  const r = toolCellRect(i);
  const dry = sel && !toolReady(p);
  const tp = cell ? tierPlate(cell.type, hov) : { plate: BAG_WELL, rim: hov ? '#8fa0c8' : '#232c52' };
  // "it does not fit in here": a red band all the way round the well and the
  // pack's own 1px shake, so the two containers refuse in one language
  const red = toolFlash > 0;
  if (red) {
    ctx.save();
    ctx.translate(((now * 40) | 0) % 2 ? -1 : 1, 0);
    ctx.fillStyle = '#c2465a';
    ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  }
  // The rim is the TIER, quiet at rest and brightened to the tier's ink on
  // hover - the four ability wells' own grammar. It used to go white and the
  // whole well used to sit a pixel proud, as the tell for the SELECTED slot;
  // there is one weapon slot (TOOL_SLOTS), so that highlight could never turn
  // off, and a highlight that is always on is not a highlight - it just made
  // the strip's left end shout over four wells that had something to say. A
  // tool that cannot answer the button still goes red: the dry-bow tell is
  // real news, and the only reason this well ever leaves its resting colour.
  ctx.fillStyle = red ? '#c2465a' : dry ? '#7e3346' : tp.rim;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = dry ? '#241028' : tp.plate;
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  if (cell) {
    tierShine(r, r.y, cell.type, now);
    // the 12px tool art doubled: the weapon well leads the strip
    // and reads at the ability icons' size, not the bag's
    const im = ITEMS[cell.type] && SPRITES[ITEMS[cell.type].icon];
    if (im) {
      ctx.drawImage(im, r.x + ((r.w - im.width * 2) >> 1), r.y + 1 + ((r.h - im.height * 2) >> 1),
        im.width * 2, im.height * 2);
    }
    // the SWEEP is the rate of fire, the same hand the ability wells turn
    // (drawSweepCover above): a slow tool holds its well longer, and the two
    // clocks a press waits on read in one shape
    if (p.nockT > 0 && sel) {
      drawSweepCover(r.x + 1, r.y + 1, r.w - 2, r.h - 2,
        Math.min(1, p.nockT / Math.max(0.01, toolCycle(p))), CD_SWEEP, CD_EDGE);
    }
    // ...and the "!" when the build weighs more than one press can spend
    if (toolOver(cell)) drawOverWarn(r, r.y, now);
  }
  if (red) ctx.restore();
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
function drawFoodCell(i, now, on) {
  const p = player, type = FOOD_BTNS[i].type;
  const r = foodCellRect(i);
  const n = bagCount(p, type);
  const red = foodFlash > 0 && foodFlashI === i;
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
  const live = n > 0 && p.foodCd <= 0;
  const lab = keyCapShort(FOOD_BTNS[i].act); // the meal's key, cut to the seat before the icon
  if (padActive()) drawPadBind(ctx, r.x + 2, r.y + 3, FOOD_BTNS[i].act, 1, !live); // the dpad arm the meal is on
  else drawPixelTextOutline(ctx, lab, r.x + (lab.length > 2 ? 2 : 4), r.y + 6, live ? '#f4f7ff' : '#7a8bb8', '#0f1632');
  if (n <= 0) ctx.globalAlpha = 0.35;
  ctx.drawImage(SPRITES[ITEMS[type].icon], r.x + FOOD_ICON_X, r.y + 4);
  ctx.globalAlpha = 1;
  // right-aligned on the same edge the purse's gold uses, so the three
  // numbers on this column read as one stacked tally
  const t = shortNum(n);
  drawPixelTextOutline(ctx, t, r.x + r.w - 3 - pixelTextWidth(t), r.y + 6,
    n > 0 ? '#f4f7ff' : '#7a8bb8', '#0f1632');
  drawFoodClock(r.x + 1, r.y + 1, r.w - 2, r.h - 2, type);
  if (red) ctx.restore();
}
// THE PURSE: the coin and the gold behind it, flush on the strip's top rim
// over the meal column - the strip's own plate and rim, so it reads as a tab
// of the widget rather than a bar parked over the world. Gold is inked
// '#f5c542' here exactly as it was on the pack's old numbers row, because the
// one number on the HUD that is money must never read as a count of something
// carried. Uncapped, so it wears shortNum like the meals under it.
function drawPurse() {
  const r = pursePlateRect();
  ctx.fillStyle = AB_BG;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#35426e';
  ctx.fillRect(r.x, r.y, r.w, 1);          // the tab's own top edge...
  ctx.fillRect(r.x, r.y + 1, 1, r.h - 1);  // ...and its sides, down onto the strip's rim
  ctx.fillRect(r.x + r.w - 1, r.y + 1, 1, r.h - 1);
  ctx.drawImage(SPRITES.itemGold, r.x + FOOD_ICON_X, r.y + 2);
  const t = shortNum(inv.gold);
  drawPixelTextOutline(ctx, t, r.x + r.w - 3 - pixelTextWidth(t), r.y + 4, '#f5c542', '#0f1632');
}
function drawHudStrip(now) {
  const R = hudStripRect();
  const hov = mouse.inside ? stripHit(mouse.x, mouse.y) : null;
  const bhov = mouse.inside ? abBuyHit(mouse.x, mouse.y) : -1;
  // one chamfered plate behind bar and wells - the bag's ground, so the
  // two HUD pieces sit in the same family
  ctx.fillStyle = AB_BG;
  ctx.fillRect(R.x - 3, R.y, R.w + 6, R.h);
  ctx.fillStyle = '#35426e';
  ctx.fillRect(R.x - 2, R.y, R.w + 4, 1);
  ctx.fillRect(R.x - 2, R.y + R.h - 1, R.w + 4, 1);
  ctx.fillRect(R.x - 3, R.y + 1, 1, R.h - 2);
  ctx.fillRect(R.x + R.w + 2, R.y + 1, 1, R.h - 2);
  for (let i = 0; i < TOOL_SLOTS; i++) {
    drawToolCell(i, now, hov && hov.kind === 'slot' && hov.i === i);
  }
  for (let i = 0; i < AB_N; i++) {
    drawClassAbCell(i, now, hov && hov.kind === 'ab' && hov.i === i);
    drawAbBuyPlate(i, now, bhov === i);
  }
  for (let i = 0; i < FOOD_BTNS.length; i++) {
    drawFoodCell(i, now, hov && hov.kind === 'food' && hov.i === i);
  }
  drawPurse();
  drawXpBar(now, R.x, R.y + AB_PAD + AB_CELL + AB_PAD);
}
// The strip and its buy plates at the HUD SIZE the settings dial holds. At 1x
// everything draws straight to the frame as it always did; any other size
// bakes the widget at 1x into hudScaleCv and blits it scaled about the strip's
// bottom-centre anchor - uictx's smoothing is off, so the art scales
// nearest-neighbour instead of every fillRect going soft under a fractional
// transform. The bake's headroom covers the buy plates' bob and the purse tab,
// and nothing taller: the build moved off this widget onto the pack's own
// shelf, which is drawn at 1x with the backpack it stands on.
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
  // the tool leads the row, in the tier plate it wears in every other well -
  // and it takes the weapon's refusal red (toolFlash) alongside the strip's,
  // since this is the well the pointer is on when a bit will not fit
  const t = shelfCellRect(-1), red = toolFlash > 0;
  ctx.save();
  if (red) ctx.translate(((now * 40) | 0) % 2 ? -1 : 1, 0);
  shelfWell(t, cell && cell.type, !!hov && hov.kind === 'tool', red ? '#c2465a' : null);
  if (cell) {
    tierShine(t, t.y, cell.type, now);
    drawItemIcon(cell.type, t, t.y);
    // the same "!" the strip's well and the pack's grid wear, in the one place
    // the budget track below can say exactly where the press runs out
    if (toolOver(cell)) drawOverWarn(t, t.y, now);
  }
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
    ctx.fillStyle = lit > 0.4 ? '#f4f7ff' : rail.col;
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
      drawItemIcon(bitType(id), r, r.y - 1); // a pixel up, clear of the pips
      // WEIGHT, as pips, on both kinds - a fitting costs the press what a
      // shot does, and the hatched plate is what says which kind it is
      ctx.fillStyle = dead ? '#e0637a' : '#f2cc6a';
      for (let k = 0; k < b.weight && k < 8; k++) ctx.fillRect(r.x + 1 + k * 2, r.y + r.h - 3, 1, 2);
      ctx.globalAlpha = 1;
    }
    const lit = bitLitAt(cell, i);
    if (lit > 0) { // what the last press spent, still glowing
      ctx.globalAlpha = 0.6 * lit;
      ctx.fillStyle = '#f4f7ff';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 1;
    }
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

// ------------------------------------------------------------ tooltips
// One panel, bottom left, that says what the pointer is on - and the one
// deliberate exception to show-don't-label in the HUD, recorded as such in
// CLAUDE.md's UI rule. The reason it earns the exception: a tool's rate of
// fire, a bit's weight and a card's effect are NUMBERS the player is being
// asked to compare, and there is no shape that compares numbers. The wells
// keep doing the at-a-glance job - tier plate, pips, wipes - and this is where
// you go when at-a-glance is not enough.
//
// It is bottom LEFT because that is the corner the pointer is furthest from
// while it hovers the backpack, the weapon strip or a tech node, so the panel
// never sits under the hand reading it. The event feed shares that corner and
// steps up by tipLift() while one is open, exactly as it already does for the
// replay window.
//
// EVERY tooltip comes from tipAt(), which asks the same hit-testers, in the
// same order, that the click handler does - so what the panel describes and
// what a click would do can never be two different things.
const TIP_PAD = 4;      // frame edge to content
const TIP_ROW = 8;      // pitch of a stat row
const TIP_MAXW = 168;   // wraps nothing; long lines are authored to fit
const TIP_LABEL = '#7a8bb8';
const TIP_DIM = '#9fb6d8';
let tipNow = null;      // this frame's descriptor, resolved once in render()

// seconds, to two places, without a trailing shout of precision
function tipSec(s) { return (Math.round(s * 100) / 100).toFixed(2) + 'S'; }
// A descriptor is { title, tcol, kind, rows: [[label, value, col]],
// notes: [[text, col]], icon, plate, rim }. Everything below builds one of
// these and drawTooltip is the only thing that knows how to paint it.
function tipBase(type, title, kind) {
  const t = itemTier(type);
  const tp = tierPlate(type, true);
  return {
    title, tcol: t >= 0 ? TOOL_TIERS[t].ink : '#f4f7ff',
    kind, rows: [], notes: [],
    icon: ITEMS[type] && SPRITES[ITEMS[type].icon], plate: tp.plate, rim: tp.rim, type,
  };
}
const TIP_PATH = { line: 'STRAIGHT', zig: 'ZIG-ZAG', orbit: 'ORBIT', boomer: 'BOOMERANG', lob: 'ARCS DOWN', curve: 'CURVES' };
// KNOCKBACK is the one bit number that is a multiple rather than a quantity
// (see BITS, js/tools.js), so it prints as one - 'x1' is the ordinary shove
const TIP_KB = (kb) => 'x' + (Math.round((kb === undefined ? 1 : kb) * 10) / 10);
// A TOOL: the numbers that are the whole of what a tool is, and then what is
// loaded in it - which is the other half of "what will this do". The list is
// the FIRING ORDER, cell 1 first, with each bit's weight beside it and the
// line where the press runs out of strength marked, because that order and
// that cut are now the entire build.
function tipTool(cell) {
  const id = toolIdOf(cell.type), T = TOOLS[id];
  const d = tipBase(cell.type, T.name, TOOL_TIERS[T.tier].name + ' TOOL');
  const plan = toolPlan(cell);
  const over = plan.load > T.tensile;
  d.rows.push(['RATE OF FIRE', tipSec(T.rof * TOOL_ROF_STEP), '#f4f7ff']);
  d.rows.push(['BIT SLOTS', bitsIn(cell) + '/' + T.cap, '#f4f7ff']);
  d.rows.push(['TENSILE', String(T.tensile), '#f2cc6a']);
  d.rows.push(['LOADED WEIGHT', String(plan.load), over ? '#e0637a' : '#f4f7ff']);
  d.rows.push(['SHOTS A PRESS', String(plan.shots.length), plan.shots.length ? '#8fe08a' : '#e0637a']);
  const lead = plan.shots.length ? plan.shots[0].i : -1;
  for (let i = 0; i < cell.bits.length; i++) {
    const b = cell.bits[i] && BITS[cell.bits[i]];
    if (!b) continue;
    const dead = plan.cut >= 0 && i >= plan.cut;
    d.notes.push([(i === lead ? '> ' : '  ') + (i + 1) + ' ' + b.name + ' ' + b.weight +
      (dead ? ' - NO STRENGTH LEFT' : ''),
      dead ? '#e0637a' : i === lead ? '#f2cc6a' : b.col]);
  }
  if (!bitsIn(cell)) d.notes.push(['  NO BITS LOADED', TIP_DIM]);
  else if (over) d.notes.push(['IT CARRIES MORE THAN IT CAN SWING', '#ffd95c']);
  return d;
}
// A BIT: every property the shot carries, because that is exactly the list a
// player is choosing between when they drag one into a cell.
function tipBit(id) {
  const b = BITS[id];
  const d = tipBase(bitType(id), b.name,
    TOOL_TIERS[b.tier].name + (b.proj ? ' BIT' : ' MODIFIER'));
  if (b.proj) {
    d.rows.push(['DAMAGE', String(b.dmg), '#e0637a']);
    d.rows.push(['WEIGHT', String(b.weight), '#f2cc6a']);
    d.rows.push(['SPEED', String(b.speed), '#f4f7ff']);
    d.rows.push(['KNOCKBACK', TIP_KB(b.kb), '#cfe0f2']);
    d.rows.push(['LIFESPAN', tipSec(b.life), '#f4f7ff']);
    d.rows.push(['FLIGHT', TIP_PATH[b.path] || b.path, b.col]);
    // the flags, only when they are true: an absent line is the default, and
    // four rows of NO would drown the three that matter
    if (b.solid === false) d.notes.push(['PASSES THROUGH WALLS', '#8fd8ff']);
    if (b.ff) d.notes.push(['HITS YOUR OWN TEAM TOO', '#e0637a']);
    if (b.lit) d.notes.push(['LIGHTS THE GROUND IT PASSES', '#ffd95c']);
    // what it does where it LANDS, when that is more than damage (BIT_IMPACT)
    if (b.impact === 'warp') d.notes.push(['LAND IT ON ANYTHING AND YOU ARE THERE', '#c58fff']);
    if (b.impact === 'chop') d.notes.push(['CHOPS EVERY TREE IT LANDS AMONG', '#8fe08a']);
  } else {
    // a fitting costs the press exactly what a shot does: that is the whole
    // reason where you put one is a decision and not a formality
    d.rows.push(['WEIGHT', String(b.weight), '#f2cc6a']);
    // A fire modifier is chosen on two numbers - how long the burn runs and
    // how hard it bites - so it prints them, the same reason the projectile
    // rows above exist. Read out of the envelope itself rather than written
    // twice, so a retuned FLAME can never disagree with its own tooltip.
    const m = bitMods(id);
    if (m.burn > 0) {
      d.rows.push(['BURNS FOR', tipSec(m.burn), '#ff9440']);
      d.rows.push(['BURN RATE', m.burnDps + '/S', '#ff9440']);
      if (m.cinder > 0) d.rows.push(['EMBER RING', String(m.cinder), '#ffb347']);
    }
    // the two rules a modifier lives by, and neither is guessable from the art
    d.notes.push(['CHANGES ONLY THE SHOTS AFTER IT', '#8fd8ff']);
    d.notes.push(['A SECOND ONE COMPOUNDS WITH THIS', '#8fe08a']);
    if (m.type === 'fire') d.notes.push(['FIRE KEEPS BURNING WHATEVER IT LANDS ON', '#ff9440']);
  }
  d.notes.push([b.blurb, TIP_DIM]);
  return d;
}
// anything else a bag cell can hold
function tipStack(s) {
  const r = CARD_TYPE_RARITY[s.type];
  if (r) {
    const d = tipBase(s.type, r.toUpperCase() + ' CARD', 'UNOPENED');
    d.tcol = RES_COLORS[s.type];
    d.rows.push(['CARRIED', String(s.n), '#f4f7ff']);
    d.notes.push(['CLICK: DRAW ONE OF THREE BUFFS', TIP_DIM]);
    return d;
  }
  if (ITEMS[s.type] && ITEMS[s.type].heal) {
    const heal = Math.round(ITEMS[s.type].heal * kitOf(player).foodMul);
    const d = tipBase(s.type, s.type === 'berry' ? 'BERRIES' : 'FISH', 'FOOD');
    d.tcol = RES_COLORS[s.type];
    d.rows.push(['HEALS', '+' + heal, '#8fe08a']);
    // the two halves of a meal, said the way an ability well says them: how
    // long you stand there eating it, and how long BOTH meals are away after
    d.rows.push(['EAT', tipSec(FOOD_EAT), '#f4f7ff']);
    d.rows.push(['COOLDOWN', tipSec(FOOD_CD), '#f4f7ff']);
    d.rows.push(['CARRIED', String(s.n), '#f4f7ff']);
    if (player.foodCd > 0) d.rows.push(['READY IN', tipSec(player.foodCd), '#e0637a']);
    d.notes.push(['A HIT BREAKS THE MEAL - CLICK OR ROLL TO CANCEL', TIP_DIM]);
    d.notes.push([s.type === 'berry' ? 'Q OR CLICK TO EAT' : 'F OR CLICK TO EAT', TIP_DIM]);
    return d;
  }
  const d = tipBase(s.type, s.type.toUpperCase(), 'ITEM');
  d.rows.push(['CARRIED', String(s.n), '#f4f7ff']);
  return d;
}
// What a click on this well will DO, said where the item actually SITS - a
// tool means "take it in hand" in the grid and "stow it" in the well, so the
// note is pushed on by tipAt's branches rather than by tipCell, which does
// not know where it is. Same phrasing as the food rows' own CLICK TO EAT.
function tipSend(d, txt) {
  if (d) d.notes.push(['CLICK TO ' + txt, TIP_DIM]);
  return d;
}
// whatever is in a bag cell, a slot, a bit cell or on the cursor
function tipCell(s) {
  if (!s) return null;
  if (isToolCell(s)) return tipTool(s);
  const b = bitIdOf(s.type);
  if (b) return tipBit(b);
  return tipStack(s);
}
// the two HUD rows that are not items: a gear piece and an ability
function tipGear(i) {
  const g = GEAR[i][player.gear[i]], lv = player.gearLv[i], cost = gearCost(player, i);
  const d = { title: g.name, tcol: GEAR_MATS[lv - 1], kind: GEAR_SLOTS[i], rows: [], notes: [],
    icon: SPRITES.gearIcons[i][player.gear[i]][lv - 1], plate: BAG_WELL, rim: '#35426e' };
  d.rows.push(['LEVEL', lv + '/' + GEAR_LV_MAX, GEAR_MATS[lv - 1]]);
  if (cost) d.rows.push(['NEXT LEVEL', cost.gold + ' GOLD',
    player.inv.gold >= cost.gold ? '#f2cc6a' : '#e0637a']);
  d.notes.push([g.blurb, TIP_DIM]);
  d.notes.push([cost ? 'CLICK TO BUY THE NEXT LEVEL' : 'FULLY UPGRADED', TIP_DIM]);
  return d;
}
// a class ability well - the strip's in play (cls omitted: the local player's
// class, live cooldown, the cast hint), or class select's stage (cls given:
// the previewed class, before it is ever locked, with nothing castable yet)
function tipClassAb(i, cls) {
  const c = cls == null ? player.cls : cls;
  const ab = CLASS_AB[c][i];
  const d = { title: ab.name, tcol: '#f4f7ff', kind: CLASSES[c].name + ' ABILITY',
    rows: [], notes: [], icon: classAbIcon(c, i), plate: BAG_WELL, rim: '#35426e' };
  // in play the cooldown is the LIVE one, level cuts and all; on class select
  // there is no slot to have levelled anything yet, so it is the base
  d.rows.push(['COOLDOWN', tipSec(cls == null ? abCdOf(player, i) : ab.cd), '#f4f7ff']);
  d.rows.push(['CAST', tipSec(ab.cast), '#f4f7ff']);
  if (cls == null) {
    const lock = !abUnlocked(player, i);
    d.rows.push(['LEVEL', lock ? 'LOCKED' : player.abLv[i] + '/' + AB_LV_MAX,
      lock ? '#e0637a' : '#f4f7ff']);
    if (player.abLv[i] < AB_LV_MAX) d.rows.push([lock ? 'UNLOCK' : 'NEXT LEVEL', '1 SKILL PT',
      player.skillPts > 0 ? '#f2cc6a' : '#e0637a']);
    if (player.abCd[i] > 0) d.rows.push(['READY IN', tipSec(player.abCd[i]), '#e0637a']);
  }
  for (const s of ab.blurb.split('. ')) d.notes.push([s.replace(/\.$/, ''), TIP_DIM]);
  if (cls == null) d.notes.push([abUnlocked(player, i)
    ? 'PRESS ' + (i + 1) + ' OR CLICK TO CAST'
    : 'SPEND A SKILL POINT TO UNLOCK IT', TIP_DIM]);
  return d;
}
// A KIND on the wiki's ARSENAL page - the one tooltip that is not about
// something you are holding, so it describes the kind itself and ends on the
// one thing the page knows about you: whether you have ever held one.
function tipKind(id) {
  const cell = toolIdOf(id) ? makeTool(toolIdOf(id)) : null;
  const d = cell ? tipTool(cell) : tipBit(bitIdOf(id));
  // A wiki row describes the KIND, not a tool somebody is holding, so the
  // "what is loaded in it" half goes: no bit list, and the player count is the
  // capacity rather than 0-out-of-capacity.
  d.notes.length = 0;
  if (cell) {
    d.rows.length = 3;
    d.rows[1] = ['BIT SLOTS', String(TOOLS[toolIdOf(id)].cap), '#f4f7ff'];
  }
  d.notes.push([PROFILE.techSeen(id) ? 'YOU HAVE HELD ONE OF THESE'
    : 'NEVER HELD ONE', PROFILE.techSeen(id) ? '#8fd8ff' : TIP_DIM]);
  return d;
}

// What the pointer is on, asked once per frame. The order mirrors the
// mousedown handler exactly: gear, then the shelf, then the weapon strip,
// then the backpack - so the panel and the click always agree.
function tipAt(mx, my) {
  if (window.DBG.hideUI || !mouse.inside) return null;
  if (state.mode === 'title') {
    const m = state.menu;
    if (m.screen === 'wiki' && m.wikiT >= 1) {
      const h = wikiHit(mx, my);
      // an ARSENAL row describes its kind; a CLASSES row is class select's
      // own ability card, read at the base cooldown since nobody has levelled
      return !h ? null : h.kind === 'row' ? tipKind(h.id) : h.kind === 'ab' ? tipClassAb(h.i, h.cls) : null;
    }
    // the stage's ability wells on class select: the strip's own tooltip,
    // readable before the class is ever locked
    if (m.screen === 'select' && m.screenT >= 1 && m.gearT <= 0) {
      const i = selectAbilHit(mx, my);
      return i >= 0 ? tipClassAb(i, m.csel) : null;
    }
    return null;
  }
  if (state.mode !== 'play') return null;
  // the counter is asked first, so a drag held over its sell well is priced
  // rather than merely described; over the bare slab it answers nothing and
  // the carried item below takes over
  const sp = shopHit(mx, my);
  const stip = sp && tipShop(sp);
  if (stip) return stip;
  if (state.drag) {
    // what is in hand, and the one thing shift is for: spending the click on a
    // well without putting this down
    const d = tipCell(state.drag.cell);
    if (d) d.notes.push(['SHIFT CLICK KEEPS THIS IN HAND', TIP_DIM]);
    return d;
  }
  const gi = gearHit(mx, my);
  if (gi >= 0) return tipGear(gi);
  const fh = shelfHit(mx, my);
  if (fh) {
    const cell = shelfCell();
    if (fh.kind === 'tool') {
      if (cell) return tipSend(tipCell(cell), 'STOW IT IN THE PACK');
      return { title: 'EMPTY WEAPON SLOT', tcol: TIP_DIM, kind: 'WEAPON', rows: [], plate: BAG_WELL, rim: '#35426e',
        notes: [['DRAG A TOOL HERE FROM THE PACK', TIP_DIM]] };
    }
    const id = cell.bits[fh.i];
    if (id) return tipSend(tipBit(id), 'STOW IT IN THE PACK');
    const T = TOOLS[toolIdOf(cell.type)];
    const d = tipBase(cell.type, 'EMPTY BIT CELL', TOOL_TIERS[T.tier].name + ' TOOL');
    d.icon = null; d.tcol = TIP_DIM;
    d.notes.push(['A FOUND BIT LANDS HERE ON ITS OWN', TIP_DIM]);
    d.notes.push(['THIS PRESS SPENDS ' + toolPlan(cell).used + ' OF ' + T.tensile, '#f2cc6a']);
    return d;
  }
  const abb = abBuyHit(mx, my);
  if (abb >= 0) return tipClassAb(abb); // the buy plate describes the ability it upgrades
  const sh = stripHit(mx, my);
  if (sh && sh.kind === 'ab') return tipClassAb(sh.i);
  // a meal button describes the meal it eats - the bag cell's own food
  // descriptor, so the two surfaces can never disagree about a berry
  if (sh && sh.kind === 'food') {
    const type = FOOD_BTNS[sh.i].type;
    return tipStack({ type, n: bagCount(player, type) });
  }
  if (sh && sh.kind === 'slot') {
    const cell = player.tools[sh.i];
    if (cell) return tipSend(tipCell(cell), 'STOW IT IN THE PACK');
    return { title: 'EMPTY SLOT ' + (sh.i + 1), tcol: TIP_DIM, kind: 'WEAPON', rows: [], plate: BAG_WELL, rim: '#35426e',
      notes: [['DRAG A TOOL HERE FROM THE PACK', TIP_DIM]] };
  }
  const bh = bagHit(mx, my);
  if (!bh) return null;
  if (bh.kind === 'btn') {
    return { title: 'BACKPACK', tcol: '#f4f7ff', kind: 'B TO OPEN', icon: bagIconCv,
      plate: BAG_WELL, rim: '#35426e',
      rows: [['CELLS USED', bagUsed(player) + '/' + player.bagCap,
        bagUsed(player) >= player.bagCap ? '#e0637a' : '#f4f7ff']],
      notes: [['DRAG ONTO THE SNOW TO THROW AWAY', TIP_DIM]] };
  }
  if (bh.kind === 'cell') {
    const s = player.bag[bh.i];
    const d = tipCell(s);
    if (d && isToolCell(s)) tipSend(d, 'TAKE IT IN HAND');
    else if (d && bitIdOf(s.type) && heldTool(player)) tipSend(d, 'LOAD IT IN THE WEAPON');
    // ...and while the counter is up, what it is worth over there
    if (d && shopOpen()) {
      d.rows.push(['SELLS FOR', sellValue(s) + ' GOLD', RES_COLORS.gold]);
      d.notes.push(['DRAG IT TO THE COUNTER TO SELL', TIP_DIM]);
    }
    return d;
  }
  return null;
}
// resolved once a frame, before anything that has to lay out around it
function tipResolve() { tipNow = tipAt(mouse.x, mouse.y); }
// how far the event feed steps up to keep clear of an open tooltip
function tipLift() { return tipNow ? tipSize(tipNow).h + 4 : 0; }
function tipSize(d) {
  const iw = d.icon ? d.icon.width + 3 : 0;
  let w = iw + pixelTextWidth(d.title);
  if (d.kind) w = Math.max(w, iw + pixelTextWidth(d.kind));
  for (const [l, v] of d.rows) w = Math.max(w, pixelTextWidth(l) + 10 + pixelTextWidth(v));
  for (const [t] of d.notes || []) w = Math.max(w, pixelTextWidth(t));
  const head = d.icon ? Math.max(14, d.icon.height + 2) : 14;
  const h = TIP_PAD * 2 + head + d.rows.length * TIP_ROW + (d.notes || []).length * TIP_ROW;
  return { w: Math.min(TIP_MAXW, w) + TIP_PAD * 2, h };
}
// The panel itself: an item's own tier plate behind the icon, the name in its
// tier ink, then label/value rows with a dotted leader between them - the
// PLAYER panel's ledger, which is where that pattern already lives.
function drawTooltip() {
  const d = tipNow;
  if (!d) return;
  const { w, h } = tipSize(d);
  const x = 4, y = VIEW_H - 8 - h;
  ctx.fillStyle = 'rgba(4,6,18,0.55)';
  ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = BAG_BG;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = d.rim || '#35426e';
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  let cy = y + TIP_PAD;
  let tx = x + TIP_PAD;
  if (d.icon) {
    // the icon on its own tier plate, so the panel opens with the same colour
    // the well the pointer is over is wearing
    const s = d.icon.width;
    ctx.fillStyle = d.plate || BAG_WELL;
    ctx.fillRect(tx - 1, cy - 1, s + 2, s + 2);
    modPlate(d.type, { x: tx - 1, y: cy - 1, w: s + 2, h: s + 2 }, cy - 1);
    ctx.drawImage(d.icon, tx, cy);
    tx += s + 3;
  }
  drawPixelTextShadow(ctx, d.title, tx, cy, d.tcol, '#0a0e23');
  if (d.kind) drawPixelTextShadow(ctx, d.kind, tx, cy + 7, TIP_LABEL, '#0a0e23');
  cy += d.icon ? Math.max(14, d.icon.height + 2) : 14;
  for (const [label, value, col] of d.rows) {
    const lw = pixelTextWidth(label), vw = pixelTextWidth(value);
    drawPixelTextShadow(ctx, label, x + TIP_PAD, cy, TIP_LABEL, '#0a0e23');
    // the dotted leader ties the pair across the gap, exactly as the PLAYER
    // panel's stat rows do - a bare gap reads as two unrelated columns
    ctx.fillStyle = '#2c3560';
    for (let px = x + TIP_PAD + lw + 3; px < x + w - TIP_PAD - vw - 2; px += 2) ctx.fillRect(px, cy + 4, 1, 1);
    drawPixelTextShadow(ctx, value, x + w - TIP_PAD - vw, cy, col || '#f4f7ff', '#0a0e23');
    cy += TIP_ROW;
  }
  for (const [text, col] of d.notes || []) {
    drawPixelTextShadow(ctx, text, x + TIP_PAD, cy, col || TIP_DIM, '#0a0e23');
    cy += TIP_ROW;
  }
}

// the day headline's bake: bare outlined text wants a fade, and an outline
// stamped under globalAlpha goes blotchy (the CLAUDE.md text rule), so the
// opaque stamp is baked once per day number and the CANVAS fades
let dayPopCv = null, dayPopDay = 0;
function renderUI(now) {
  if (state.mode === 'title' || state.mode === 'drop' || window.DBG.hideUI) return;
  if (endScreen()) return; // a victory or defeat screen owns the whole frame

  // title -> play: the HUD slides in over the last part of the intro - the
  // minimap from the top, the backpack from the right, the hud strip from
  // below.
  // The TOP LEFT is deliberately empty: the berry and fish counts that used
  // to stack there (and the gold that sat left of the minimap) live on the
  // hud strip's meal buttons and the purse tab over them now, which is why
  // nothing slides in from the left any more. Health lives on the in-world
  // bar.
  const hudIn = hudInT(); // 0 away .. 1 home; a drop brief pins it at 0 for the tour
  const slide = 1 - hudIn;
  const out = state.mode === 'dead'; // the local wallet is moot once you are out

  ctx.save();
  ctx.translate(0, Math.round(-slide * (MM_R * 2 + 40)));
  // minimap with day/night ring
  renderMinimap(now);
  ctx.restore();

  // The bottom-right corner - the backpack and the weapon shelf standing on
  // its top edge - rides the intro slide in from the right as ONE widget. It
  // slides by whichever of the two reaches further in from the edge, because
  // the pack now starts open and the widest tool's row is a few px wider than
  // it: a shove that only cleared the shut button would leave most of the
  // frame parked over the cinematic.
  if (!out) {
    ctx.save();
    ctx.translate(Math.round(slide * Math.max(bagOpenNow() ? BAG_W : BAG_BTN, VIEW_W - shelfCellRect(-1).x)), 0);
    drawBag(now);
    drawShelf(now);
    ctx.restore();
  }

  // hud strip (the xp bar over the weapon, ability and meal wells),
  // bottom-centre; it rides the intro slide up from below, at whatever HUD
  // SIZE the settings dial holds (drawHudScaled). The carried item rides the
  // pointer over everything, so it stays outside the scale and the slide.
  if (!out) {
    drawHudScaled(now, Math.round(slide * HUD_SLIDE));
    if (hudIn >= 1) drawDragGhost(now);
  }

  // the merchant's counter (js/shop.js): over the HUD like the character
  // sheet, with the pack open beside it to drag a sale out of
  if (!out && shopOpen()) drawShopPanel(now);

  // the character panel (G): over the HUD, under the toasts and the tooltip
  if (!out && state.charOpen && !player.dead) drawCharPanel(now);

  // the market's plates, top-right under the minimap (the `market notices`
  // banner, js/shop.js). Above the counter and the sheet on purpose: a price
  // that moved while you were standing at the shop is exactly the news that
  // must not arrive behind the panel it is about. They stay up while you are
  // down, like the feed - the market does not stop for a death.
  renderNotices();

  // arriving at a camp announces it, top centre: the name big, its
  // personality under it. Fades on the plate, so it uses the shadow font.
  if (state.loc) {
    const L = state.loc.L, t = state.loc.t;
    const a = t < 0.25 ? t / 0.25 : t > 2.8 ? Math.max(0, 1 - (t - 2.8) / 0.7) : 1;
    if (a > 0) {
      const nw = pixelTextWidth(L.name, 2), tw = pixelTextWidth(L.tag);
      const w = Math.max(nw, tw) + 26;
      const bx = Math.round((VIEW_W - w) / 2), by = 14;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(12,18,42,0.72)';
      ctx.fillRect(bx, by, w, 24);
      ctx.fillStyle = L.spec.mark;
      ctx.fillRect(bx, by, w, 1); ctx.fillRect(bx, by + 23, w, 1);
      drawCampIcon(ctx, L, bx + 10, by + 12, L.spec.mark, '#0a0e23');
      drawPixelTextShadow(ctx, L.name, Math.round((VIEW_W - nw) / 2) + 7, by + 4, '#f4f7ff', '#0a0e23', 2);
      drawPixelTextShadow(ctx, L.tag, Math.round((VIEW_W - tw) / 2) + 7, by + 15, L.spec.mark, '#0a0e23');
      ctx.globalAlpha = 1;
    }
  }

  // a new day announces itself, top centre: DAY N at 2x, bare text, nothing
  // else. It is the survival calendar a strategy is timed against ("push at
  // day 2", "hole up for night 1"), so it headlines instead of riding the
  // bottom message line. Drawn from the bake above so the outline survives
  // the fade; steps under the location plate when both are up.
  if (state.dayPop) {
    const t = state.dayPop.t;
    const a = t < 0.25 ? t / 0.25 : t > 2.8 ? Math.max(0, 1 - (t - 2.8) / 0.7) : 1;
    if (a > 0) {
      if (!dayPopCv || dayPopDay !== state.dayPop.day) {
        const txt = 'DAY ' + state.dayPop.day;
        dayPopCv = document.createElement('canvas');
        dayPopCv.width = pixelTextWidth(txt, 2) + 4;
        dayPopCv.height = 16;
        drawPixelTextOutline(dayPopCv.getContext('2d'), txt, 2, 2, '#f4f7ff', '#0f1632', 2);
        dayPopDay = state.dayPop.day;
      }
      ctx.globalAlpha = a;
      ctx.drawImage(dayPopCv, Math.round((VIEW_W - dayPopCv.width) / 2), state.loc ? 44 : 14);
      ctx.globalAlpha = 1;
    }
  }

  // message
  if (state.msgT > 0 && state.msg) {
    const a = Math.min(1, state.msgT * 2);
    ctx.globalAlpha = a;
    const w = pixelTextWidth(state.msg);
    drawPixelTextOutline(ctx, state.msg, (VIEW_W - w) / 2, VIEW_H - AB_H - 14, '#fff4d8', '#0f1632');
    ctx.globalAlpha = 1;
  }

  if (state.paused) {
    ctx.fillStyle = 'rgba(10,14,35,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const t = 'PAUSED';
    drawPixelTextShadow(ctx, t, (VIEW_W - pixelTextWidth(t, 2)) / 2, VIEW_H / 2 - 5, '#f4f7ff', '#0a0e23', 2);
  }
}


// ------------------------------------------------------------ touch controls
// The pixels of a phone's controls - js/touch.js decides, this draws: the
// plates (touchLayout), the two floating sticks, and the rotate prompt. The
// glyph set is shared with the CONTROLS page's TOUCH tab (bakeCtrlTouch,
// panels.js) so what is learned there is recognised here.
const TOUCH_PLATE = 'rgba(8,12,28,0.6)';
const TOUCH_RIM = '#35426e', TOUCH_INK = '#cfe0ff', TOUCH_HOT = '#ffd95c';
const TOUCH_STICK_COL = 'rgba(244,247,255,';   // the move stick, white
const TOUCH_AIM_COL = 'rgba(255,217,92,';       // the aim stick wears the draw's gold

// a filled disc and a 1px ring, in scanlines, so they are pixel art and not
// an anti-aliased arc
function touchDisc(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}
function touchRing(g, cx, cy, r, col) {
  g.fillStyle = col;
  const ri = r - 1;
  for (let dy = -r; dy <= r; dy++) {
    const wo = Math.floor(Math.sqrt(r * r - dy * dy));
    const wi = Math.abs(dy) > ri ? -1 : Math.floor(Math.sqrt(ri * ri - dy * dy));
    if (wi < 0) g.fillRect(cx - wo, cy + dy, wo * 2 + 1, 1);
    else { g.fillRect(cx - wo, cy + dy, wo - wi, 1); g.fillRect(cx + wi + 1, cy + dy, wo - wi, 1); }
  }
}

// one glyph, ~9px, centred on cx, cy. `bg` is the plate under it, for the
// one glyph that needs a bite taken out (the roll's arrow gap)
function drawTouchIcon(g, id, cx, cy, col, bg) {
  g.fillStyle = col;
  switch (id) {
    case 'dodge': // a curl with an arrowhead: the roll
      touchRing(g, cx, cy, 4, col);
      g.fillStyle = bg || TOUCH_PLATE; g.fillRect(cx + 1, cy - 5, 4, 4);
      g.fillStyle = col;
      g.fillRect(cx + 3, cy - 4, 1, 3); g.fillRect(cx + 2, cy - 3, 3, 1); g.fillRect(cx + 4, cy - 5, 1, 1);
      break;
    case 'work': // an axe: diagonal haft, blade top-right
      for (let i = 0; i < 6; i++) g.fillRect(cx - 3 + i, cy + 3 - i, 1, 1);
      g.fillRect(cx + 1, cy - 4, 3, 3); g.fillRect(cx + 4, cy - 3, 1, 2); g.fillRect(cx, cy - 3, 1, 2);
      break;
    case 'slide': // a boot on a blade, with the speed behind it
      g.fillRect(cx - 4, cy + 3, 9, 1);
      g.fillRect(cx - 2, cy - 3, 4, 5); g.fillRect(cx + 2, cy, 3, 2);
      g.fillRect(cx - 6, cy - 1, 2, 1); g.fillRect(cx - 7, cy + 1, 2, 1);
      break;
    case 'char': // the sheet's figure
      g.fillRect(cx - 1, cy - 4, 3, 3); g.fillRect(cx - 2, cy, 5, 3);
      g.fillRect(cx - 2, cy + 3, 2, 2); g.fillRect(cx + 1, cy + 3, 2, 2);
      break;
    case 'build': // a hammer
      g.fillRect(cx - 4, cy - 4, 6, 3); g.fillRect(cx - 1, cy - 1, 1, 6); g.fillRect(cx - 2, cy - 1, 3, 1);
      break;
    case 'flag': // a pennant on a pole
      g.fillRect(cx - 3, cy - 4, 1, 9); g.fillRect(cx - 2, cy - 4, 5, 3);
      g.fillStyle = bg || TOUCH_PLATE; g.fillRect(cx + 2, cy - 3, 1, 1);
      break;
    case 'cog': // the ESC slab
      touchRing(g, cx, cy, 3, col);
      g.fillRect(cx - 1, cy - 1, 3, 3);
      g.fillRect(cx - 1, cy - 5, 3, 2); g.fillRect(cx - 1, cy + 4, 3, 2);
      g.fillRect(cx - 5, cy - 1, 2, 3); g.fillRect(cx + 4, cy - 1, 2, 3);
      break;
    case 'x': // back out
      for (let i = -3; i <= 3; i++) { g.fillRect(cx + i, cy + i, 1, 1); g.fillRect(cx + i, cy - i, 1, 1); }
      break;
    case 'zoomOut': case 'zoomIn': // a glass, with the sign in it
      touchRing(g, cx - 1, cy - 1, 3, col);
      g.fillRect(cx + 2, cy + 2, 1, 1); g.fillRect(cx + 3, cy + 3, 1, 1);
      g.fillRect(cx - 3, cy - 1, 5, 1);
      if (id === 'zoomIn') g.fillRect(cx - 1, cy - 3, 1, 5);
      break;
    case 'stick': // a stick: the ring, and the knob off centre
      touchRing(g, cx, cy, 4, col);
      touchDisc(g, cx + 1, cy + 1, 1, col);
      break;
    case 'map': // the minimap disc
      touchRing(g, cx, cy, 4, col); g.fillRect(cx, cy, 1, 1);
      break;
    case 'pack': // the backpack
      g.fillRect(cx - 3, cy - 2, 7, 6); g.fillRect(cx - 2, cy - 4, 5, 2);
      g.fillStyle = bg || TOUCH_PLATE; g.fillRect(cx - 1, cy, 3, 1);
      break;
  }
}

function drawTouchPlate(b, now) {
  const on = !!touch.held[b.id] || (b.id === 'slide' && keyHeld('slide'));
  touchDisc(ctx, b.x, b.y, b.r, TOUCH_PLATE);
  touchRing(ctx, b.x, b.y, b.r, on ? TOUCH_HOT : TOUCH_RIM);
  if (on) { ctx.globalAlpha = 0.25; touchDisc(ctx, b.x, b.y, b.r - 1, TOUCH_HOT); ctx.globalAlpha = 1; }
  drawTouchIcon(ctx, b.glyph, b.x, b.y, on ? TOUCH_HOT : TOUCH_INK);
}
function drawTouchStick(f, col) {
  let dx = f.x - f.x0, dy = f.y - f.y0;
  const d = Math.hypot(dx, dy);
  if (d > TOUCH_STICK_R) { dx *= TOUCH_STICK_R / d; dy *= TOUCH_STICK_R / d; }
  const x0 = Math.round(f.x0), y0 = Math.round(f.y0);
  touchRing(ctx, x0, y0, TOUCH_STICK_R, col + '0.35)');
  touchRing(ctx, x0, y0, TOUCH_STICK_R - 1, col + '0.2)');
  touchDisc(ctx, Math.round(f.x0 + dx), Math.round(f.y0 + dy), TOUCH_KNOB_R, col + '0.55)');
}
function drawTouchControls(now) {
  for (const b of touchLayout()) drawTouchPlate(b, now);
  for (const f of touch.fingers.values()) {
    if (f.kind === 'move') drawTouchStick(f, TOUCH_STICK_COL);
    else if (f.kind === 'aim') drawTouchStick(f, TOUCH_AIM_COL);
  }
}

// held upright: the world under a night slab, and a phone turning sideways
// with an arrow curling round it - the game is played the other way
function drawRotatePrompt(now) {
  ctx.fillStyle = 'rgba(6,10,24,0.92)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const cx = Math.round(VIEW_W / 2), cy = Math.round(VIEW_H / 2);
  // the phone, easing between upright and sideways on a slow clock
  const t = (Math.sin(now * 1.6) + 1) / 2;
  const k = t < 0.5 ? 0 : 1; // it snaps: two poses read, a tween of rectangles does not
  const w = k ? 44 : 24, h = k ? 24 : 44;
  ctx.fillStyle = '#35426e'; ctx.fillRect(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4);
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.fillStyle = k ? '#7fa8d8' : '#141c3c'; ctx.fillRect(cx - w / 2 + 3, cy - h / 2 + 3, w - 6, h - 6);
  if (k) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(cx - 2, cy - 2, 4, 4); } // the game, lit, once it lies sideways
  // the arrow: a quarter arc of dots over the top-right, head at the end
  ctx.fillStyle = '#ffd95c';
  const r = 36;
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI * 0.95 + i * (Math.PI * 0.5 / 8);
    ctx.globalAlpha = 0.35 + 0.65 * ((i / 8 + now * 0.8) % 1);
    ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 3, 3);
  }
  ctx.globalAlpha = 1;
  const ax = Math.round(cx + Math.cos(-Math.PI * 0.45) * r), ay = Math.round(cy + Math.sin(-Math.PI * 0.45) * r);
  ctx.fillRect(ax - 2, ay - 5, 5, 2); ctx.fillRect(ax + 1, ay - 3, 2, 3); ctx.fillRect(ax + 3, ay - 1, 2, 5);
}
