'use strict';
// The local human's controller: keyboard + mouse listeners writing the same
// input struct an AI fills, sampled once per sim step by sampleHumanInput().
// ------------------------------------------------------------ keys and binds
// THE KEYBOARD IS READ BY WHERE A KEY SITS, NOT BY WHAT IT PRINTS. An AZERTY
// board's walk keys are Z Q S D by name but sit exactly where W A S D do, so
// the listeners translate the browser's e.code - the physical key, blind to
// the layout - into the game's key NAME: the face that key wears on a US
// board, lowercase for a letter (keyName). `keys`, the binds and every
// keyPress comparison are written in those names; a code the table does not
// know (an on-screen keyboard sends none) falls back to e.key, so nothing is
// dead. What the player SEES runs the other way: keyLabel prints the face the
// key has on the board in hand where the browser can say (Chrome's layout
// map - KeyW is Z on AZERTY), else the US face.
const CODE_KEY = { Space: ' ', Period: '.', Comma: ',', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Control',
  ControlRight: 'Control', AltLeft: 'Alt', AltRight: 'Alt', MetaLeft: 'Meta', MetaRight: 'Meta', NumpadEnter: 'Enter',
  NumpadAdd: 'Numpad+', NumpadSubtract: 'Numpad-', NumpadMultiply: 'Numpad*', NumpadDivide: 'Numpad/', NumpadDecimal: 'Numpad.' };
const CODE_PLAIN = /^(Arrow(Up|Down|Left|Right)|F\d\d?|Numpad\d|Tab|Escape|Enter|Backspace|CapsLock|Delete|Insert|Home|End|PageUp|PageDown)$/;
function keyName(e) {
  const c = e.code || '';
  if (c.length === 4 && c.slice(0, 3) === 'Key') return c[3].toLowerCase();
  if (c.length === 6 && c.slice(0, 5) === 'Digit') return c[5];
  if (CODE_KEY[c]) return CODE_KEY[c];
  if (CODE_PLAIN.test(c)) return c;
  const k = e.key || '';
  return k.length === 1 ? k.toLowerCase() : k;
}
// the name a key prints on screen - a cap, the listing, a well's corner. The
// font has A-Z, 0-9 and a few marks (js/font.js), so anything else is a word.
const KEY_LABEL = { ' ': 'SPACE', Shift: 'SHIFT', Control: 'CTRL', Alt: 'ALT', Meta: 'META', Tab: 'TAB', Escape: 'ESC', Enter: 'ENTER',
  Backspace: 'BKSP', CapsLock: 'CAPS', Delete: 'DEL', Insert: 'INS', Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN',
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ';': 'SEMI', "'": 'QUOTE', '[': 'LBRKT', ']': 'RBRKT',
  '\\': 'BSLSH', '=': 'EQUAL', '`': 'TILDE', '*': 'STAR' };
const GLYPH_OK = /^[A-Z0-9\-+.,:!?\/%()<>]$/;
let kbLayout = null; // navigator.keyboard's code -> printed-face map, where the browser has one
function readKbLayout() {
  if (!navigator.keyboard || !navigator.keyboard.getLayoutMap) return;
  navigator.keyboard.getLayoutMap().then((m) => { kbLayout = m; }).catch(() => { });
}
readKbLayout();
if (navigator.keyboard && navigator.keyboard.addEventListener) navigator.keyboard.addEventListener('layoutchange', readKbLayout);
// a name back to its physical code, for the layout map
function keyCode(k) {
  if (/^[a-z]$/.test(k)) return 'Key' + k.toUpperCase();
  if (/^[0-9]$/.test(k)) return 'Digit' + k;
  if (k.length === 1) for (const c in CODE_KEY) if (CODE_KEY[c] === k) return c;
  return null;
}
function keyLabel(k) {
  const code = keyCode(k);
  const face = code && kbLayout && kbLayout.get(code);
  if (face && face.length === 1 && GLYPH_OK.test(face.toUpperCase())) return face.toUpperCase();
  if (k.slice(0, 6) === 'Numpad') return 'NUM ' + (KEY_LABEL[k.slice(6)] || k.slice(6));
  return KEY_LABEL[k] || k.toUpperCase();
}

// WHAT A KEY DOES IS AN ACTION, AND AN ACTION HAS A KEY: the binds, one key
// each, saved with the profile (settings.binds). This is every rebindable
// verb, in the order the CONTROLS page lists them, with the key each starts
// on. What is NOT here is fixed - Escape backs out of everything, Enter and
// the arrows walk the menus (and the arrows always walk the body too), F3 and
// '.' are the two debug flips, the mouse buttons are the mouse's. Nothing
// compares a key event against a literal: keyIs / keyHeld ask the binds, and
// a pad button or a touch plate names an ACTION (PAD_PLAY, TOUCH_BTNS) and
// presses whatever key it holds, so a rebind moves all three controllers.
const KEY_ACTIONS = [
  { id: 'up', verb: 'MOVE UP', key: 'w' }, { id: 'left', verb: 'MOVE LEFT', key: 'a' },
  { id: 'down', verb: 'MOVE DOWN', key: 's' }, { id: 'right', verb: 'MOVE RIGHT', key: 'd' },
  { id: 'ab1', verb: 'ABILITY 1', key: '1' }, { id: 'ab2', verb: 'ABILITY 2', key: '2' },
  { id: 'ab3', verb: 'ABILITY 3', key: '3' }, { id: 'ab4', verb: 'ABILITY 4', key: '4' },
  { id: 'dodge', verb: 'DODGE', key: ' ' }, { id: 'slide', verb: 'SLIDE', key: 'Shift' }, { id: 'work', verb: 'HARVEST', key: 'e' },
  { id: 'berry', verb: 'EAT BERRY', key: 'q' }, { id: 'fish', verb: 'EAT FISH', key: 'f' },
  { id: 'card', verb: 'DRAW CARD', key: 'c' }, { id: 'bag', verb: 'INVENTORY', key: 'b' },
  { id: 'char', verb: 'CHARACTER', key: 'g' },
  { id: 'build', verb: 'BUILD', key: 't' }, { id: 'rotate', verb: 'ROTATE', key: 'r' },
  { id: 'map', verb: 'WORLD MAP', key: 'm' }, { id: 'board', verb: 'STANDINGS', key: 'Tab' },
  { id: 'mute', verb: 'MUTE', key: 'n' }, { id: 'pause', verb: 'PAUSE', key: 'p' },
];
const KEY_ACT = {};
for (const a of KEY_ACTIONS) KEY_ACT[a.id] = a;
// keys no bind may take: the fixed jobs above, and the browser's F row
function keyReserved(k) { return k === 'Escape' || k === 'Enter' || k === 'Backspace' || k === '.' || k === 'Meta' || /^(Arrow|F\d)/.test(k); }
settings.binds = {};
for (const a of KEY_ACTIONS) settings.binds[a.id] = a.key;
// a loaded profile's binds made whole (boot.js, after loadSettings): a bind an
// action never had, a reserved key or a key two actions share falls back to
// the default
function mendBinds() {
  const s = settings.binds && typeof settings.binds === 'object' ? settings.binds : {};
  const out = {}, used = {};
  for (const a of KEY_ACTIONS) {
    const k = s[a.id];
    out[a.id] = typeof k === 'string' && k && !keyReserved(k) && !used[k] ? k : a.key;
    used[out[a.id]] = true;
  }
  settings.binds = out;
}
// an action's key ('work' -> 'e'), or the bare name of a key that is no
// action's (Escape) - what a pad button and a plate resolve through
function actKey(a) { return settings.binds[a] || a; }
function keyIs(e, a) { return e.key === settings.binds[a]; }           // is this key event the action's key?
function keyHeld(a) { return !!keys[settings.binds[a].toLowerCase()]; } // is the action's key down right now?
function keyBound(k) { for (const a of KEY_ACTIONS) if (settings.binds[a.id] === k) return true; return false; }
// a lowercase key as a menu direction: the four walk binds and the arrows,
// which every key-driven menu steps on (menuKey, deadKey, settingsKey ...)
function moveDir(k) {
  if (k === 'arrowup' || k === settings.binds.up.toLowerCase()) return 'up';
  if (k === 'arrowdown' || k === settings.binds.down.toLowerCase()) return 'down';
  if (k === 'arrowleft' || k === settings.binds.left.toLowerCase()) return 'left';
  if (k === 'arrowright' || k === settings.binds.right.toLowerCase()) return 'right';
  return null;
}
// what a keybind indicator prints for an action: the bound key's face, or
// the fixed word for the few that are no bind - esc, enter, click, and move
// (the four walk keys run together: WASD, or ZQSD on the board that has them)
function keyCap(a) {
  if (a === 'esc') return 'ESC';
  if (a === 'enter') return 'ENTER';
  if (a === 'click') return 'CLICK';
  if (a === 'move') {
    const l = ['up', 'left', 'down', 'right'].map((d) => keyLabel(settings.binds[d]));
    return l.every((s) => s.length === 1) ? l.join('') : l.join('/');
  }
  return keyLabel(settings.binds[a]);
}
// ...and its short form for a well's corner, where two or three characters fit
const KEY_SHORT = { SPACE: 'SPC', SHIFT: 'SHF', CTRL: 'CTL', ENTER: 'ENT', CAPS: 'CAP', DOWN: 'DN', LEFT: '<', RIGHT: '>', BKSP: 'BK' };
function keyCapShort(a) { const l = keyCap(a); return l.length <= 2 ? l : KEY_SHORT[l] || l.slice(0, 3); }

// REBINDING: a cap on the CONTROLS page is clicked and LISTENS (state.rebind
// is the action), and the next key down is its key. Escape calls it off, a
// reserved key is refused, and a key another action holds SWAPS - that
// action takes the old key - so every action always has one key of its own
// and no two share one. Whatever was held under the old names lets go, so a
// rebind mid-walk cannot leave a foot down.
function rebindStart(a) { state.rebind = a; SFX.pickup(); }
function rebindKey(e) {
  if (e.repeat) return;
  if (e.key === 'Escape') { state.rebind = null; SFX.pickup(); return; }
  if (keyReserved(e.key)) { SFX.deny(); return; }
  setBind(state.rebind, e.key);
  state.rebind = null;
  saveSettings();
  SFX.place();
}
function setBind(a, k) {
  const old = settings.binds[a];
  for (const b of KEY_ACTIONS) if (b.id !== a && settings.binds[b.id] === k) settings.binds[b.id] = old;
  settings.binds[a] = k;
  for (const n in keys) keys[n] = false;
}
function bindsDefault() { return KEY_ACTIONS.every((a) => settings.binds[a.id] === a.key); }
function resetBinds() {
  for (const a of KEY_ACTIONS) settings.binds[a.id] = a.key;
  for (const n in keys) keys[n] = false;
  saveSettings();
}
// the slab a listening cap lives on is showing: the in-match ESC slab, or
// the title's slide-in. Off it, a stale listen is dropped rather than eating
// the next key.
function rebindLive() {
  return (state.mode === 'play' && state.settingsOpen) || (state.mode === 'title' && state.menu.panel === 'settings');
}

// ------------------------------------------------------------ input
const keys = {}; // key name (lowercase) -> held; written by the listeners, a pad and a plate alike
// inside: pointer over the canvas. src: who moved it last - 'mouse', 'pad'
// (js/gamepad.js) or 'touch' (js/touch.js); in play the pad and a finger
// keep writing the aim through it every frame, and stop the moment the mouse
// itself moves, so the three never fight over one reticle
const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, inside: false, src: 'mouse' };

// EVERY CONTROLLER IS A KEYBOARD AND A MOUSE IN DISGUISE. The listeners here
// only translate the browser's events; what a key does lives in keyPress /
// keyRelease and what a button does in pointerPress / pointerRelease, so a
// gamepad and a finger press the same keys and the same buttons instead of
// each keeping a copy of this file - a key handled in a listener alone is
// dead on a pad. `e` is {key, repeat, char}: key the game's NAME for the key
// (keyName above), char what it typed (the name editor's letters) - a real
// KeyboardEvent translated, or the object a pad or a plate builds.
const KEY_PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab', 'F3']);
window.addEventListener('keydown', (e) => {
  const k = keyName(e);
  // Tab is held to read the scoreboard (scoreboardOpen()), so it must never
  // reach the browser's focus traversal - nor may a bound key in a match, or
  // any key while a cap is listening. A chord on ctrl / alt / meta is the
  // browser's own (reload, find) and passes.
  if (!e.ctrlKey && !e.altKey && !e.metaKey &&
      (state.rebind || KEY_PREVENT.has(k) || (state.mode !== 'title' && keyBound(k)))) e.preventDefault();
  keys[k.toLowerCase()] = true;
  keyPress({ key: k, repeat: e.repeat, char: e.key });
});
function keyPress(e) {
  // a cap on the CONTROLS page is listening: this key is its answer
  if (state.rebind) { if (rebindLive()) { rebindKey(e); return; } state.rebind = null; }
  // the name editor owns the keyboard while it is up: its letters are text,
  // not shortcuts, and F3 / '.' below would fire on keys the field ignores
  if (state.mode === 'title' && state.menu.panel === 'name') { nameKey(e); return; }
  // F3 flips the info stack in any mode, minecraft-style (the browser's own
  // F3 find bar is suppressed above)
  if (e.key === 'F3') { settings.info = !settings.info; saveSettings(); return; }
  // '.' toggles the debug overlay (off / bodies + routes) in any mode, beside
  // F3 and for the same reason: what it draws is as true of the title
  // screen's living world and of a spectated match as it is of your own feet
  if (e.key === '.') { settings.hitbox = settings.hitbox ? 0 : 2; saveSettings(); return; }
  if (state.mode === 'title') { menuKey(e); return; }
  if (state.mode === 'drop') {
    // the map key raises the world map mid-flight, Esc puts it away; the map
    // does not stop the sim, so the jump keys stay live under it. The lock
    // inside dropJump refuses (and denies) a jump before the window - the
    // repeat guard keeps a held key from machine-gunning that deny.
    if (keyIs(e, 'map')) { state.mapOpen = !state.mapOpen; return; }
    if (e.key === 'Escape') { state.mapOpen = false; return; }
    if ((keyIs(e, 'dodge') || e.key === 'Enter' || keyIs(e, 'work')) && !e.repeat) dropJump(player);
    return;
  }
  if (state.mode === 'dead') { deadKey(e.key.toLowerCase()); return; }
  if (state.mode !== 'play') return;
  // the ESC slab has the arrows while it is up: they page and scroll it
  // (settingsKey, js/panels.js) - what a pad's bumpers and dpad reach it by
  if (state.settingsOpen && settingsKey(e.key.toLowerCase())) return;
  // edge-triggered intents go into the local player's input struct; the sim
  // reads and clears them, exactly as it does for an bot
  if (keyIs(e, 'dodge')) player.input.dodge = true;
  if (keyIs(e, 'berry')) player.input.eatBerry = true;
  if (keyIs(e, 'fish')) player.input.eatFish = true;
  if (keyIs(e, 'card')) player.input.useCard = true;
  // the pack key drops the inventory drawer under the weapon shelf. It is
  // HUD and not an overlay, so unlike the map and ESC it neither stops the
  // sim nor swallows anything but its own clicks.
  if (keyIs(e, 'bag')) state.bagOpen = !state.bagOpen;
  // THE BUILD LIST (drawBuildList, js/ui.js): T opens it over the world and
  // T again closes it (so do Escape and the right button); while it is up
  // the ghost under the pointer is what a left-click lays, the wheel walks
  // the rows, and R turns a piece that turns. It takes the drawer's place
  // under the shelf, so the drawer lifts. Not over the map or the slab, not
  // dead, not seated on the roost.
  if (keyIs(e, 'build') && !e.repeat && !state.mapOpen && !state.settingsOpen && !player.dead && !player.aboard) {
    SFX.unlock();
    if (state.build) state.build = null;
    else { state.build = { sel: 0, rot: 0 }; state.wheel = null; state.bagOpen = false; }
  }
  if (keyIs(e, 'rotate') && !e.repeat && state.build) state.build.rot ^= 1;
  // The work key at the practice rack: the press opens the armory wheel over
  // it, the pointer picks, and RELEASING it takes - the right-click wheel's
  // own hold-and-release grammar, moved onto the key. A real work target in
  // reach keeps the key's day job (the same rule that decides which prompt
  // is showing), and ordinary work is suppressed while any wheel is up
  // (sampleHumanInput). Seated on the roost, it is the hop (updateDrop reads
  // the held work intent) and nothing else: the merchant stands beside the
  // roost, and the counter opening instead would swallow the very key that
  // gets you down.
  if (keyIs(e, 'work') && !e.repeat && !state.wheel && !state.mapOpen &&
      !state.settingsOpen && !state.drag && !player.dead && !player.aboard) {
    // The merchant's counter is a PANEL, not a held wheel, so the key that
    // opened it shuts it - whatever else has come into reach meanwhile.
    if (state.shop) { closeShop(); return; }
    const t = workTarget(player);
    if (!t || !t.near) {
      // one of your OWN buildings in reach: the press opens its manage
      // wheel (upgrade / demolish) on the rack's grammar - E is the one verb
      // for the world, and a building of yours is the one thing it never
      // swings at (manageNear, structures.js)
      const mg = manageNear(player);
      const rk = mg ? null : rackNear(player);
      if (mg) { SFX.unlock(); state.wheel = { kind: 'manage', tx: mg.tx, ty: mg.ty, seg: -1, ax: mouse.x, ay: mouse.y }; }
      else if (rk) { SFX.unlock(); state.wheel = { kind: 'rack', tx: rk.tx, ty: rk.ty, seg: -1, ax: mouse.x, ay: mouse.y }; }
      else {
        // the parkour die: holding the key beside it opens the roll wheel -
        // ROLL plus the three difficulties - on the rack wheel's own grammar
        const pk = pkDieNear(player);
        if (pk) { SFX.unlock(); state.wheel = { kind: 'pkdie', tx: pk.tx, ty: pk.ty, seg: -1, ax: mouse.x, ay: mouse.y }; }
        else {
          // the range bell: holding the key beside it opens the difficulty
          // wheel - easy, medium, hard - and releasing on a wedge rings the
          // round in at that difficulty (the roll die's own grammar). Only
          // while the range is idle: mid-round the bell is under the snow
          // with the rest of the furniture, and the sink and rise are
          // mid-ceremony.
          const bl = agBellNear(player);
          if (bl && agame.phase === 'off') { SFX.unlock(); state.wheel = { kind: 'agbell', tx: bl.tx, ty: bl.ty, seg: -1, ax: mouse.x, ay: mouse.y }; }
          // ...and a MERCHANT: the press opens its counter (js/shop.js). Last
          // in the chain because the practice room's furniture and a merchant
          // can never be in reach of each other.
          else { SFX.unlock(); openShop(merchNear(player)); }
        }
      }
    }
  }
  // the sheet key raises the character panel - the body, the live stat
  // ledger and the four gear pieces. HUD like the bag: the sim runs on
  // underneath.
  if (keyIs(e, 'char') && !state.settingsOpen) state.charOpen = !state.charOpen;
  // the four ability binds cast, left to right exactly as the strip shows
  // them (a click on the well sets the same field - hudPress, js/ui.js).
  // Edge-triggered like the dodge; the sim consumes it (tryAbility,
  // js/abilities.js). What is loaded in the weapon is on the shelf over the pack.
  const ab = e.repeat ? -1 : ['ab1', 'ab2', 'ab3', 'ab4'].findIndex((a) => keyIs(e, a));
  if (ab >= 0) { SFX.unlock(); player.input.ability = ab; }
  if (keyIs(e, 'map') && !state.settingsOpen && !state.dropBrief) { state.wheel = null; state.mapOpen = !state.mapOpen; }
  if (e.key === 'Escape') {
    // a carried item goes back first, then an open wheel: both are gestures
    // half-finished, and Escape is how either is thought better of
    if (state.drag) { dragReturn(); state.dragPend = null; }
    else if (state.wheel) state.wheel = null;
    else if (state.build) state.build = null;
    else if (state.mapOpen) state.mapOpen = false;
    else if (state.shop) closeShop();
    else if (state.charOpen) state.charOpen = false;
    else if (state.bagOpen) state.bagOpen = false; // the drawer slides back up
    else { state.settingsOpen = !state.settingsOpen; dragSlider = null; state.wheel = null; }
  }
  if (keyIs(e, 'mute')) { settings.muted = SFX.toggleMute(); saveSettings(); }
  if (keyIs(e, 'pause')) state.paused = !state.paused;
}
window.addEventListener('keyup', (e) => {
  const k = keyName(e);
  keys[k.toLowerCase()] = false;
  keyRelease({ key: k, char: e.key });
});
function keyRelease(e) {
  // letting go of the work key with a wheel it held up (armory, roll die or
  // range bell) takes what the pointer is on (or cancels from the hub),
  // exactly as releasing the right button does
  if (keyIs(e, 'work') && state.wheel &&
      (state.wheel.kind === 'rack' || state.wheel.kind === 'pkdie' || state.wheel.kind === 'agbell' || state.wheel.kind === 'manage')) {
    resolveWheel();
    state.wheel = null;
  }
}
// a key held while the window loses focus never sends its keyup: alt-tabbing
// out would otherwise leave the scoreboard (or a walk direction) stuck on
// - and an item on the cursor goes back where it came from rather than
// hanging there over a game that has stopped listening
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  state.rebind = null; // a cap left listening would eat the first key back
  state.dragPend = null;
  if (state.drag) dragReturn();
  // an E-held wheel (armory, roll die or range bell) is a held gesture too:
  // its keyup is lost with the focus, so it closes (choosing nothing)
  // instead of sticking open
  if (state.wheel && (state.wheel.kind === 'rack' || state.wheel.kind === 'pkdie' || state.wheel.kind === 'agbell' || state.wheel.kind === 'manage')) state.wheel = null;
});

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  pointerMove((e.clientX - r.left) / scale, (e.clientY - r.top) / scale, 'mouse');
});
// the pointer is at x, y (game px), moved by `src` (see `mouse`)
function pointerMove(x, y, src) {
  mouse.x = x;
  mouse.y = y;
  mouse.inside = true;
  mouse.src = src || 'mouse';
  state.menu.moved = true; // the menu only lets the mouse steal the selection when it actually moves
  // a press on a bag/slot/bit cell only becomes a DRAG once it travels: that
  // is what lets one gesture both use an item and move it (see hudMove, ui.js)
  if (state.dragPend) hudMove(mouse.x, mouse.y);
}
// the in-canvas cursor must vanish when the pointer leaves the page
canvas.addEventListener('mouseleave', () => { mouse.inside = false; });
document.addEventListener('mouseleave', () => { mouse.inside = false; });
canvas.addEventListener('mousedown', (e) => {
  // a press carries its own position - don't trust the last mousemove (touch,
  // synthetic clicks and pointer-lock all press without moving first)
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) / scale;
  mouse.y = (e.clientY - r.top) / scale;
  mouse.inside = true;
  mouse.src = 'mouse';
  // Middle click is also the browser's autoscroll, which only a
  // preventDefault on the PRESS suppresses.
  if (e.button === 1) e.preventDefault();
  pointerPress(e.button);
});
// a button went down at the pointer: 0 left, 1 middle, 2 right
function pointerPress(button) {
  if (button === 2) {
    if (state.mode !== 'play' || state.settingsOpen || state.wheel) return;
    if (state.build) { SFX.unlock(); state.build = null; return; } // the right button puts the build list away
    if (state.mapOpen) { openFlagWheel(); return; } // over the chart: the flag wheel, the one way to order a tile off-screen
    if (bagHit(mouse.x, mouse.y) || gearHit(mouse.x, mouse.y) >= 0 || stripHit(mouse.x, mouse.y) ||
        shopHit(mouse.x, mouse.y) || shelfHit(mouse.x, mouse.y)) return; // no wheel through the HUD
    // any tile on the map is a place to plant a flag on (building is the
    // list on T, managing is E beside your own building)
    openFlagWheel();
    return;
  }
  if (button === 1) return; // the middle button is nobody's
  if (button !== 0) return;
  if (state.mode === 'title') { menuClick(); return; }
  if (state.mode === 'drop') { SFX.unlock(); if (!state.mapOpen) dropJump(player); else if (mapCloseHit()) state.mapOpen = false; return; }
  if (state.mode === 'dead') { SFX.unlock(); deadClick(); return; }
  if (state.mode !== 'play') return;
  if (state.wheel) { state.wheel = null; return; } // left-click while it is open: cancel
  if (state.settingsOpen) { mouse.down = true; settingsMouseDown(); return; }
  if (state.mapOpen) { if (mapCloseHit()) { SFX.unlock(); state.mapOpen = false; } return; } // the chart's CLOSE plank; the rest of the slab swallows the press
  // the build list: a press on a row picks it, a press on the world lays
  // the ghost (a red ghost refuses with the deny cue and nothing else);
  // presses over the rest of the HUD go on to it as ever
  if (state.build) {
    const row = buildListHit(mouse.x, mouse.y);
    if (row >= 0) { SFX.unlock(); state.build.sel = row; return; }
    if (!overHud(mouse.x, mouse.y)) {
      const g = buildGhostAt();
      if (g && g.can.ok) { SFX.unlock(); player.input.cmd = { kind: 'build', tx: g.tx, ty: g.ty, id: g.type, rot: g.rot }; }
      else SFX.deny();
      return;
    }
  }
  // The backpack widget, the weapon slots and the weapon shelf swallow every
  // press over themselves before the tool ever sees them. The character panel
  // is asked first while it is up - a press on a gear well buys, the X
  // closes, and the slab eats the rest. Everything else goes through
  // hudPress, which arms a drag the mouseup below either completes or reads
  // as a click.
  if (shopClick(shopHit(mouse.x, mouse.y))) return;
  if (state.charOpen && charClick(charHit(mouse.x, mouse.y))) return;
  if (hudPress(mouse.x, mouse.y)) { SFX.unlock(); return; }
  // pressing on the world while carrying something: the release throws it,
  // and nothing is fired
  if (state.drag) return;
  mouse.down = true;
  clickAction(player);
}
window.addEventListener('mouseup', (e) => { pointerRelease(e.button); });
// ...and came back up
function pointerRelease(button) {
  if (button === 2 && state.wheel) { resolveWheel(); state.wheel = null; return; }
  if (button === 1) return;
  // a carried item is put down (or thrown), and an armed press that never
  // travelled resolves as the plain click it was - both before the tool's own
  // release, so a drag never also looses a shot
  if (button === 0 && state.mode === 'play' && (state.drag || state.dragPend)) {
    hudRelease(mouse.x, mouse.y);
    player.input.fire = false;
    mouse.down = false;
    dragSlider = null;
    return;
  }
  // releasing the button just drops the held intent; updatePlayer fires the
  // tool on that falling edge, the same way an AI's shot is timed
  if (button === 0) player.input.fire = false;
  // letting go of a dial: the two sound tracks answer with a real sampled cue
  // at the level just set, so the slider demonstrates itself instead of
  // labelling itself - and a dead sample layer is audible the moment you drag
  if (dragSlider) { saveSettings(); if (dragSlider === 'sfx' || dragSlider === 'vol') SFX.coin(); else SFX.pickup(); }
  mouse.down = false;
  dragSlider = null;
}

// The tool's own press and release, BARE: what a pad's trigger and a finger's
// aim stick send. The mouse arrives through pointerPress instead because a
// press has the HUD to get past first; a trigger is never over a well.
function fireDown() {
  if (state.mode !== 'play' || state.wheel || state.settingsOpen || state.mapOpen ||
      state.drag || state.dragPend || state.shop || player.dead) return false;
  mouse.down = true;
  clickAction(player);
  return true;
}
function fireUp() {
  player.input.fire = false;
  mouse.down = false;
}

// ---- haptics: telling the HAND something happened ------------------------
// A gesture that moves an item has to answer in the hand that made it and not
// only on the screen: a pad rumbles, a phone buzzes, and a mouse has neither,
// so for a mouse the answer is the cue and the pulse the caller raises beside
// this. ONE entry point, for the same reason a key is asked for through its
// action - a caller must never have to know which of the three controllers is
// in hand. It lives here because this is the file the three of them meet in;
// `pad` (gamepad.js) and `MOBILE` (mobile.js) are run-time reads, both files
// loading after this one.
//
// The four strengths are a LANGUAGE, not a volume dial: a grab is the lightest
// thing the hand can feel, a place is firmer, a SWAP is the longest and
// hardest because it is the one move that also changes what you are holding,
// and a refusal is a single hard knock. Told apart with the eyes shut, which
// is the whole job.
const HAPTIC = {
  grab:  { ms: 18, s: 0.22 },
  place: { ms: 28, s: 0.45 },
  seat:  { ms: 34, s: 0.55 },
  swap:  { ms: 55, s: 0.8 },
  deny:  { ms: 75, s: 0.95 },
};
function haptic(kind) {
  const h = HAPTIC[kind];
  if (!h || !settings.haptics) return;
  try {
    // the pad's own actuator first: a rumble belongs in the hands actually
    // holding the game, and a phone's motor is the fallback for a finger
    const gp = padActive() && pad.slot >= 0 ? (navigator.getGamepads() || [])[pad.slot] : null;
    const act = gp && (gp.vibrationActuator || (gp.hapticActuators && gp.hapticActuators[0]));
    if (act && act.playEffect) {
      // playEffect REJECTS rather than throws (a pad that went away
      // mid-gesture, an effect the browser will not run), and an unhandled
      // rejection in a hot path is a console full of noise
      const p = act.playEffect('dual-rumble', { duration: h.ms, strongMagnitude: h.s, weakMagnitude: h.s * 0.6 });
      if (p && p.catch) p.catch(() => {});
      return;
    }
    if (act && act.pulse) { const p = act.pulse(h.s, h.ms); if (p && p.catch) p.catch(() => {}); return; }
    if (MOBILE && navigator.vibrate) navigator.vibrate(h.ms);
  } catch (e) { /* no actuator, or a browser that refuses one: the ear and the eye still answered */ }
}

// The flag wheel: the four orders (FLAG_ORDER, robots.js) round the tile
// under the pointer, on the build wheel's own grammar - held open, the
// travel picks, the release plants (resolveWheel, ui.js). Over the chart it
// opens on the chart's tile and is pinned to the press point (sx/sy), the
// one way to order a tile that is off-screen. The right button, R3 on a
// pad and the touch FLAG plate all hold it; the caller resolves it on its
// own release, as the right button does. False when nothing opened.
function openFlagWheel() {
  if (state.mode !== 'play' || state.settingsOpen || state.wheel || player.dead) return false;
  let tx, ty, sx, sy;
  if (state.mapOpen) {
    const mt = mapTileAt(mouse.x, mouse.y);
    if (!mt) return false;
    tx = mt.tx; ty = mt.ty; sx = mouse.x; sy = mouse.y;
  } else {
    if (overHud(mouse.x, mouse.y)) return false; // the HUD swallows its own presses
    tx = Math.floor(mouseWX() / TILE); ty = Math.floor(mouseWY() / TILE);
  }
  if (!inWorld(tx, ty)) return false;
  SFX.unlock();
  state.wheel = { kind: 'flag', tx, ty, seg: -1, ax: mouse.x, ay: mouse.y, sx, sy };
  return true;
}

// A build wheel with no pointer to lay a ghost with - a pad's dpad and the
// touch BUILD plate: it opens on the tile the body FACES, offering what
// stands there (the net over a hole, the land list otherwise); the pick is
// laid on that tile, a big one fitted round it (placeStruct -> findSite).
// With a building of the player's own on that tile it is the manage wheel
// instead. ax/ay is the press point the pick travels from (wheelLayout,
// ui.js); the caller resolves the wheel on its own release, as the right
// button does.
function openWheelNear(p, ax, ay) {
  if (state.mode !== 'play' || state.mapOpen || state.settingsOpen || state.wheel || p.dead) return false;
  const dx = p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0, dy = p.dir === 'up' ? -1 : p.dir === 'down' ? 1 : 0;
  const tx = Math.floor(p.x / TILE) + dx, ty = Math.floor((p.y + 4) / TILE) + dy;
  if (!inWorld(tx, ty)) { SFX.deny(); return false; }
  const o = structOf(objAt(tx, ty));
  let kind = null;
  if (o && STRUCTS[o.type] && !o.building && !STRUCTS[o.type].fixed && o.team === p.team) kind = 'manage';
  else if (buildOptionsAt(tx, ty).some((t) => canPlaceAt(t, tx, ty, 0, p).ok || findSite(t, tx, ty))) kind = 'build';
  if (!kind) { SFX.deny(); return false; }
  SFX.unlock();
  state.wheel = { kind, tx, ty, seg: -1, ax, ay };
  return true;
}

// whichever scrolling page is up walks by d px - the wheel listener below,
// a finger's drag and a pad's right stick all arrive here. False when
// nothing on screen scrolls.
function panelScrollBy(d) {
  if (state.mode === 'title') {
    if (state.menu.panel === 'patch') patchScrollBy(d);
    else if (state.menu.panel === 'settings') settingsScrollBy(d);
    else if (state.menu.screen === 'wiki' && state.menu.wikiT >= 1) wikiScrollBy(d);
    else return false;
    return true;
  }
  if (state.mode === 'play' && state.settingsOpen) { settingsScrollBy(d); return true; }
  return false;
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// the middle button does nothing in-game, and nothing of it should reach the page either
canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
canvas.addEventListener('wheel', (e) => {
  if (state.mode === 'title') {
    if (state.menu.panel === 'patch') { e.preventDefault(); patchScrollBy(e.deltaY > 0 ? 16 : -16); }
    else if (state.menu.panel === 'settings') { e.preventDefault(); settingsScrollBy(e.deltaY > 0 ? 14 : -14); }
    else if (state.menu.screen === 'wiki' && state.menu.wikiT >= 1) { e.preventDefault(); wikiScrollBy(e.deltaY > 0 ? 14 : -14); }
    return;
  }
  if (state.mode !== 'play') return;
  e.preventDefault();
  // over the open ESC panel the wheel walks the open settings page
  if (state.settingsOpen) { settingsScrollBy(e.deltaY > 0 ? 14 : -14); return; }
  if (state.mapOpen || state.wheel) return;
  // the build list up: the wheel walks its rows (the camera's zoom waits)
  if (state.build) {
    const n = BUILD_ORDER.length;
    state.build.sel = (state.build.sel + (e.deltaY > 0 ? 1 : -1) + n) % n;
    return;
  }
  // over the minimap the wheel zooms the minimap instead of the camera
  if (overMinimap()) {
    settings.mmZoom = Math.max(0, Math.min(MM_ZOOMS.length - 1, (settings.mmZoom | 0) + (e.deltaY > 0 ? -1 : 1)));
    saveSettings();
    return;
  }
  // scroll up = closer. One notch = one device pixel per world pixel, which
  // is the finest step that still lands on a pixel-exact zoom.
  kWant = Math.max(kMin(), Math.min(kMax(), kWant + (e.deltaY > 0 ? -1 : 1)));
}, { passive: false });

// The local human's controller: keyboard + mouse folded into the same input
// struct an AI writes, once per sim step. Pause and the settings panel zero it
// (and drop any draw) so nothing leaks through a stopped sim; the map, which
// does not stop the sim, keeps the feet and drops everything else.
function sampleHumanInput(p) {
  const inp = p.input;
  inp.aimX = mouseWX();
  inp.aimY = mouseWY();
  // read the walk keys once - each branch below decides who gets them
  let mx = 0, my = 0;
  if (keyHeld('up') || keys['arrowup']) my -= 1;
  if (keyHeld('down') || keys['arrowdown']) my += 1;
  if (keyHeld('left') || keys['arrowleft']) mx -= 1;
  if (keyHeld('right') || keys['arrowright']) mx += 1;
  // ...and the two sticks, a pad's left one and the touch move stick, at
  // their tilt (both files load after this one; this is a run-time read)
  mx = Math.max(-1, Math.min(1, mx + pad.mx + touch.mx));
  my = Math.max(-1, Math.min(1, my + pad.my + touch.my));
  // The chart does not stop the world, so it does not stop the player: you
  // keep walking, sliding, rolling and burrowing with it up, and watch your
  // own marker move across it. Everything that acts on the world is dropped -
  // the pointer is over the parchment, so there is nothing to aim or work at,
  // and a gear plate bought blind under the dim would be bought by accident.
  if (state.mode === 'play' && state.mapOpen && !state.paused && !state.settingsOpen) {
    inp.mx = mx; inp.my = my;
    inp.slide = keyHeld('slide');
    inp.grapple = keyHeld('ab3'); // a reel in progress keeps answering the held key
    inp.fire = inp.work = false;
    inp.eatBerry = inp.eatFish = inp.useCard = false;
    inp.ability = -1;
    inp.cmd = null;
    if (p.charging) { p.charging = false; p.chargeT = 0; }
    p.firePrev = false;
    p.fireArmed = false;
    return;
  }
  // state.eagleCine / state.dropBrief: a ceremony has the camera - hands off
  // the controls until it hands back, exactly as pause zeroes them
  if (state.mode !== 'play' || state.paused || state.settingsOpen || state.eagleCine || state.dropBrief) {
    inp.mx = inp.my = 0;
    inp.fire = inp.work = inp.slide = inp.grapple = false;
    inp.dodge = inp.eatBerry = inp.eatFish = inp.useCard = false;
    inp.ability = -1;
    inp.cmd = null;
    if (p.charging) { p.charging = false; p.chargeT = 0; }
    p.firePrev = false;
    p.fireArmed = false;
    // the one thing that works mid-air: WASD drifts the fall (updateDrop reads it)
    if (state.mode === 'drop' && !state.paused) { inp.mx = mx; inp.my = my; }
    return;
  }
  inp.mx = mx; inp.my = my;
  inp.slide = keyHeld('slide');
  // the grapple reels only while its own key - ability 3's - is held: the one
  // HELD ability input, read by updatePlayer's grapple branch; releasing it
  // lets go early
  inp.grapple = keyHeld('ab3');
  inp.work = keyHeld('work') && !state.wheel && !state.shop; // the counter swallows the work key the way a wheel does
  if (state.wheel) { inp.fire = false; inp.dodge = false; inp.ability = -1; } // the wheel swallows the shot
}

