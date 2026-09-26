# Players, teams and AI

Softfall is a two-sided team battle, RED vs BLUE. Every combatant — the local human, the AI
fills, and a human on another screen ([Online play](#online-play)) — is a `Player` in the module-scope `players` array, and they
all run the same code. Read this before adding an ability, an input, or anything a player can do
to the world.

## The ten players

`MAX_PLAYERS` (10) players are created once at boot by `initPlayers()`. Each player is one of:

- `control: 'human'` — driven by this screen's keyboard/mouse or pad. Exactly one per screen: **this
  session's player**, in slot `localId` (0 unless `?local=N` or `DBG.setLocal(N)` seats it
  elsewhere — nothing about slot 0 makes it the local one, and anything that means "me" reads
  `player` or tests `p === player`, never an id). `player` and `inv` point at it (and only at
  it) for the camera, HUD, cursor, audio gating and the aim line.
- `control: 'remote'` — a human on another screen, in a match this screen hosts: its `input` is
  written from the wire (`netHostStep`, js/net/net.js) and it steps through `updatePlayer` like
  the local human. `isHuman(p)` is true for both kinds, and is what every human-only branch
  asks. On a **client** every body is drawn from the host's snapshot and none is stepped; the
  client's own slot is its `'human'` and the host's is a `'remote'` (`netClientApply`).
- `control: 'ai'` — driven by `updateAI()`. Every place nobody takes is filled with one at boot.
- `control: 'none'` — nobody is in it. The player still exists; it is drawn as a flat team-tinted
  silhouette at its `spawn` (`drawGhost`) and is skipped by the sim, arrows and drops. A player
  emptied before it ever landed stands at the world centre, the placeholder `spawn`.
  `p.active` is the `control !== 'none'` test every such loop uses.

`DBG.setControl(id, 'human'|'ai'|'none')` flips a player live, which is how you stage a scene with
fewer bots, a frozen target dummy, or a ghost. `DBG.setLocal(id)` rebuilds the ten with this
screen's player in slot `id` (title only: it is a fresh `initPlayers`).

**`initPlayers(roster, local)` takes a roster** — one `{ control, team?, name?, cls?, look? }` per
slot — and the local slot; with neither it builds today's match (`defaultRoster`: this screen's
human in `LOCAL_SLOT`, an AI everywhere else, teams alternating by slot). A bot still rolls its
class and gear off the seed; a roster entry's own `name`/`cls`/`look` land over that, which is
how a lobby dresses a remote human's body (`netClientWelcome`, [Online play](#online-play)).
The profile's character is only ever applied to this screen's player (`applyCharacter(p?)`).

**A `Player` owns its whole body** — position, velocity, facing, hp, bow draw,
dodge charges, slide state, swing state, held tool, i-frames, footprint cadence — plus `id`,
`team`, `control`, `name` (`TEAMS[team].name + '-' + (id + 1)` for an AI fill; the local player
wears its **active character's** name, class and look — `applyCharacter(p?)`, called by
`initPlayers` and whenever the roster's active slot changes — see
[architecture.md](architecture.md#profilejs)), `look` (the face on the class body: a bot's is
hashed off its id by `botLook`, so a replayed world fields the same faces), `spawn` (the tile it landed
on from the eagle), `aboard`/`dropT`/`dropU`
(the eagle ride, see [Eagle drop](rendering.md#eagle-drop-mode-drop)), its own `inv` wallet, `bag`
and `food` pouch (see [the backpack](gameplay.md#inventory-and-the-backpack)),
`level`/`xp` (see [Hero levels](#hero-levels)), `kills`, an `input` struct and an `ai` brain.
`reset(first)` places it at `spawn` and clears every transient; it is the single definition of
"a fresh player". Boot calls it with `first` true, and `respawnPlayer` — the team's bird setting a
downed player back down — with `false`, which is what gives the return its 3 s of i-frames.

Behaviour lives in free functions taking `p` (`updatePlayer`, `tryWork`, `fireTool`, `tryDodge`,
`startEat`, `damagePlayer`, `die`, `placeStruct`, …), matching the rest of the file's
style — the class is the state container, not a god object.

## The input struct

`makeInput()` is the **entire interface between a controller and the sim**:

```
mx, my        movement axis, -1..1 (the sim normalises)
aimX, aimY    world-space aim point — cursor for a human, target for a bot
fire          bow held: rising edge draws, falling edge looses. The rising edge
              also CANCELS a meal in progress (see Food in gameplay.md), so the
              button a player reaches for in a fight is never refused
work          E held (with it clear, the hands still take a tree, a bush or a fish in reach: autoWork/autoFish)
slide         shift held
dodge         edge-triggered, cleared by the sim when it reads it
jump          edge-triggered: the leap off the eagle, or the hop off the roost -
              the ride's one act (dropJump, js/boot.js; read at the top of
              updatePlay's player loop, before the air skips the body) - and
              on the ground the zipline's: clip on under your side's cable,
              let go while riding, or - out of reach with the aim on your
              cable as drawn - the walk there that clips on (zipToggle,
              js/world.js; E sets it there)
grapple       held (key 3): the hunter's grapple reels only while this is down -
              the one held ability input (updatePlayer's grapple branch reads it;
              the burrow is the SNOW COVER cast on `ability`, not a field here)
eatBerry      edge-triggered (Q): STARTS the 1.5s meal, it does not heal on the spot
eatFish       edge-triggered (F): same, and off the same shared 3s clock
              (startEat, js/core.js - see Food in gameplay.md)
useCard       edge-triggered (the card key): draw one unopened card at random
              (useCard, js/core.js)
ability       edge-triggered (keys 1-4): cast that class ability, -1 = none
              (tryAbility, js/abilities.js - see Classes below)
cmd           one-shot order, run by runCmd (js/ui/wheel.js):
              {kind:'build'|'upgrade'|'demolish', tx, ty, id} - a build also
              carries rot, the list's R (a wheel's order is unturned)
              or {kind:'gear', piece} - a gear buy: no tile, no reach, no contest
              or {kind:'ability', i} - an ability level: same, paid with a skill point
              or {kind:'shop', act, ...} - a buy or a food trade at the
              merchant's counter: no tile and no contest (an offer is a line,
              not a queue), but it re-checks its own reach (shopCmd, js/ui/shop.js)
              or {kind:'flag', tx, ty, id} - plant that order's flag there, no
              reach and no contest; id null lifts it
              or {kind:'rack'|'pkdie'|'agbell', ...} - the practice room's
              armory, roll die and range bell
```

`sampleHumanInput(player, dt)` (input banner) folds `keys`/`mouse` — and the pad's stick, `pad.mx/my`,
clamped in beside WASD — into the local player's struct once per step (under the
[CLICK scheme](#the-click-scheme) the walk keys are gone and `ckStep` writes the walk, the aim and
the auto-attack's fire edges into the same struct from its orders), and zeroes it — dropping any draw — while pause or the settings panel is up. The wheel and the
[map](gameplay.md#the-m-map-does-not-pause) don't stop the sim and so don't zero the whole struct:
each drops only the intents it swallows (the map keeps movement, the wheel keeps movement minus
the roll). The keydown
handlers and `resolveWheel()` never act directly: they set `input.dodge` / `input.eatFish` /
`input.cmd` and let the next `updatePlayer` perform it. **A new ability must be a field here** —
and in the `in` message a client sends and `netHostStep` copies (js/net/net.js) — or bots and
remote humans can't use it.

`workTarget(p)` reads `p.input.aimX/aimY`, not the mouse, which is why the cursor's lock ring and a
bot's chop resolve through exactly the same function.

## The two controllers

The local human has two: keyboard and mouse (js/input.js) and a gamepad (js/gamepad.js) — the
Steam Deck's hands. **The pad is the keyboard in disguise.** The browser listeners in
input.js only translate events; what a key *does* lives in `keyPress(e)`/`keyRelease(e)` (`e` is
`{key, repeat, char}` — a real KeyboardEvent translated, or an object a pad builds) and what a
button does in `pointerPress(button)`/`pointerRelease(button)`, with `pointerMove(x, y, src)`
carrying the pointer. A pad button presses a *key* through those, so it cannot
drift from the keyboard and a new key handled in a listener alone is dead on a pad (the rule in
[CLAUDE.md](../../CLAUDE.md#hard-rules)).

**And the answer runs back out the same way.** `haptic(kind)` (the `haptics` banner, input.js) is
the one call that tells the *hand* something happened — a pad through its own
`vibrationActuator`, a mouse not at all, since it has no
motor and the cue and the on-screen pulse beside it are its whole answer. A caller names what
happened (`grab`, `place`, `seat`, `swap`, `deny` — sized so the five are told apart with the
eyes shut) and never which controller is in hand, exactly as a key is asked for through its
action. The RUMBLE row on the ESC panel's GAME page (`settings.haptics`) is its off switch. Its
one caller today is the backpack's own feedback
([hudFx](gameplay.md#what-a-gesture-answers-with)).

**The keyboard is read by where a key sits, not by what it prints** (the `keys and binds`
banner, input.js; issue #43). The listeners translate `e.code` — the physical key — into the
game's key *name*, the face that key wears on a US board, lowercase for a letter (`keyName`:
`KeyW` → `'w'`, `Space` → `' '`, `ShiftLeft` → `'Shift'`, `Period` → `'.'`; a code the table
does not know falls back to `e.key`, so an on-screen keyboard is not dead). `keys`, the binds and
every comparison are written in those names, so an AZERTY board walks on its Z Q S D without
knowing it. `e.char` is what the key *typed*, which only the name editor reads (`createKey`, js/ui/chars.js). What
the player *sees* runs the other way: `keyLabel` prints the face the key has on the board in hand
where the browser can say (Chrome's `navigator.keyboard.getLayoutMap()`, cached in `kbLayout` and
refreshed on `layoutchange` — `KeyW` reads Z on AZERTY), else the US face; anything the pixel
font cannot draw (the arrows, the modifiers, punctuation with no glyph) is a word (`KEY_LABEL`:
SPACE, SHIFT, UP, SEMI …).

**What a key does is an action, and an action has a key.** `KEY_ACTIONS` is every rebindable
verb — the four walk keys, the four abilities, dodge, slide, harvest, the two meals, the card
draw, the inventory drawer, the sheet, the build list and its rotate, the map, the standings, mute,
pause, and the CLICK
scheme's three of its own (attack-move, stop, the held flag wheel) — with the key each starts on
per scheme (`key` on WASD, `ck` on CLICK, `ms` on MOUSE where it differs from `ck`; an action
with none is not on that scheme), in the
order the CONTROLS page lists them. **The keyboard has three schemes and each keeps its own map**
(`settings.scheme`, `SCHEMES`): `settings.binds` is the WASD scheme's (action id → key name),
`settings.bindsClick` the CLICK scheme's and `settings.bindsMouse` the MOUSE scheme's,
`binds()` whichever is live, all saved with the
profile and made whole by `mendBinds` after `loadSettings` (a bind an action never had, a
reserved key or a key two actions share falls back to its default; `schemeActs`/`schemeKey`
are the per-scheme roster and default). **Nothing compares a key
event against a literal**: `keyIs(e, 'work')`, `keyHeld('slide')`, `moveDir(k)` (the four walk
binds and the arrows, which every key-driven menu steps on — the title's planks, the death
planks, the wiki, gear, the lobby, the settings slab; under CLICK the arrows alone) and
`keyBound(k)` ask the live binds, and every keybind indicator names an action and prints
`keyCap(action)` (`keyCapShort` for a well's corner, where SPACE is SPC; an action the live scheme
has no key for prints RMB, because under CLICK the walk and the harvest are the right button's). What is *not* an action is fixed: Escape backs out of everything,
Enter and the arrows walk the menus (the arrows always walk the body too), F3 and `.` are the
debug flips, the three main mouse buttons are the mouse's, and `keyReserved` refuses those and the
browser's F row to a bind. A pad button names an *action* (`PAD_PLAY`):
the key event it builds carries it (`e.act`, which `keyIs` reads
before the key) and its held state is `actHeld`'s (which `keyHeld` reads beside `keys`), so a
rebind moves both controllers at once and neither scheme's map ever sits between a button
and its verb — a pad on the CLICK scheme still works with X, because X names `work`, not E.

**Rebinding** is a cap on the CONTROLS page's KEYBOARD listing
([the panel](gameplay.md#settings); the listing is the live scheme's, and the CONTROLS navbar's
WASD / CLICK / MOUSE cells are the scheme switch, `CTRL_TABS`/`KEY_ROWS`, panels.js): a click sets it listening (`state.rebind` is the action,
`rebindStart`), the next key down is its key (`rebindKey`, first thing in `keyPress`), Escape calls
it off, a reserved key is refused with the deny cue, and a key another action holds **swaps** —
that action takes the old key (`setBind`) — so every action always has one key of its own and no
two share one. Every held key lets go on a rebind, the listen dies with the slab (`rebindLive`),
on blur and on any press but its own cap, and `resetBinds` puts the defaults back. Four gestures have no key and are exposed bare for a
pad's trigger or button: `fireDown`/`fireUp` (the draw — the mouse goes through `pointerPress`
because a press has the HUD to get past first, a trigger is never over a well),
`openFlagWheel()` (the flag wheel on the tile under the pointer — the chart's tile while the map
is up), `openWheelNear(p, ax, ay)` (a build wheel on the tile the body faces — or the manage
wheel, with a building of the player's own there — for a controller with no pointer to lay the
build list's ghost with) and `panelScrollBy(d)` (whichever page is up). `mouse.src` is who moved the pointer
last — `'mouse'` or `'pad'` — and in play the pad keeps rewriting the aim
through it every frame so the reticle rides the body, until the mouse itself moves.

### The CLICK scheme

The keyboard's second scheme (`settings.scheme = 'click'`; the `click to move` banner, input.js),
the League / StarCraft / Age of Empires grammar, built to stand alone: **the right button is the
hand and no key walks the body** (WASD and the arrows are off the feet; a pad's
stick still walks, and a tilted stick drops the order it would fight but keeps the lock). Every
gesture is an *order* on `ck.order` and the sim never learns which scheme is in hand — `ckStep`
turns the order into the walk, the aim, the work and the fire edges of the same input struct a
bot fills, once per step from `sampleHumanInput`.

- **A right press on open ground walks there by route** (`navTo`, the bots' own walker, so the
  same feet go round the same trees); a route that fails drops the order, per the pathfinding
  rule. Holding the button drags the goal under the pointer (`ck.follow`). A right press on the
  chart or the minimap walks there across the map (`ckPoint`, `mmWorldAt`). Seated on the roost
  it is the hop, and the fall drifts toward the spot and walks on landing; in flight it is the
  jump, with the same rule the jump key has. Riding a zipline it lets go; standing under your
  side's cable, a press **on the drawn cable** (`zipUnder`, the strand the hover lights) clips on,
  or from out of reach walks the body there and clips on (`zipWalkStart` — the channel, ended by
  any order of your own; a press anywhere else is the walk it always was).
- **On a tree, a bush, an ice hole or a rival building it is a walk into reach and the swing**
  (`workTargetAt`, the work target by tile), held until the thing is spent. On one of your own
  buildings, a merchant or the practice furniture it is a walk into reach and the thing opening
  (`ckUse`: the counter as a panel; the manage, armory, die and bell wheels as wheels left
  standing, which the next right press picks from, or the press that walked up to them, held
  and released on a wedge).
- **On a rival body it is a CHASE with a LOCK** (`unitUnder`, the hunt reticle's own boxes):
  the body walks into its tool's reach (`ckReach`: a blade's reach, a bow's flight at the
  auto-draw) and stands at `ckHoldR` (`CK_HOLD_BOW` 90 px, or the blade's reach), and while the
  hand is off the button the tool draws and looses at the target by itself — `CK_AUTO_DRAW` 0.7
  of the full draw, a NORMAL bot's own loose — with a clear line (`aiLineClear`) and the target
  inside reach. The hand's own draw aims at the lock too, the assist, so a full draw is still the
  reward for holding. **Abilities never take the lock**: they cast at the pointer, the skillshot
  grammar (for that step the aim is the pointer and an auto-draw holds a step). The dodge rolls
  toward the pointer, one rule.
- **A (`amove`) arms the pointer** (the `amove` reticle) and the next left press is an
  **attack-move**: walk there, lock the first foe seen within `CK_ACQ_R` (160 px) on the way —
  a rival player through `seenAt`, a rival robot, a camp's monster, never a deer — chase it,
  and walk on when it is down. On a body, that body. **S (`stop`) drops the lot**, and so does a
  new order, a death and the scheme switch; Escape disarms A. **G (`flag`) holds the flag wheel**
  open over the pointer and its release plants, the pad's R3 grammar.
- **The balance of the assist:** a locked shot goes where the target *is*, never led, so a
  strafing rival at range is missed where a hand would lead it; the lock holds only to
  `CK_LOCK_R` (240 px) and through `seenAt`, so cover and GHOSTSTEP break it (`ckSees`); the
  auto-draw is a bot's, under the hand's; and a tool with nothing to swing fires nothing.
- **What the eye gets** (`drawClickMarks`, js/draw/marks.js): a ring blooms and fades where the
  order landed — white for a walk, gold for a job, red for a fight (`CK_COL`) — and a breathing
  ring in the foe's ink sits under a locked target's feet. Nothing is written.

### The MOUSE scheme

The keyboard's third scheme (`settings.scheme = 'mouse'`; the `mouse only` banner, input.js) is
**CLICK for one hand**: `ckOn()` is true under it too, so every CLICK gesture above stands, and
what CLICK leaves on the keyboard moves onto the mouse. The keys still work; nothing needs them.

- **The side buttons are keys.** `sideButton` names the back button `'Mouse4'` and forward
  `'Mouse5'` and presses them through `keyPress`/`keyRelease`, so they bind, rebind (a listening
  cap takes a side press) and hold like any key, on any scheme. MOUSE starts the **dodge** on
  back and the **slide** on forward (`ms` on `KEY_ACTIONS`); the caps print MB4 and MB5. The
  listeners swallow both buttons' browser back and forward.
- **A left press on a foe takes the lock** as it draws (`msLeftPress`, `ck.stand`): the loose
  goes to the body, CLICK's assist, and the auto-attack keeps working it from where you stand.
  A stand lock never walks (the chase is the right button's) and a new order drops it; a left
  press at open snow lets it go.
- **Holding the middle button opens the ACTION WHEEL** at the pointer (`msWheelPress`, wheel
  kind `'kit'`, `MS_WHEEL`): the four abilities clockwise from the top, the two meals, the flag.
  The travel picks and the release performs (`msKitPick`). An ability casts at the point the
  press was made, not where the flick ended: `ms.castAt` holds the aim through the whole
  wind-up (`ckStep`), since the effect lands at the aim held at its end. The flag wedge stands
  the flag wheel up on that tile (`w.stand`), and the next press of any button picks from it.
  Over the chart the middle button opens the flag wheel directly.
- **A click on an ability well readies it** (`msWell`, `ms.ready`) where the key would cast: the
  well's rim goes gold, the pointer wears the `cast` reticle, the next left press on the world
  casts there, and a right press (the walk), Escape or the well again puts it down. The scroll
  wheel walks the readied ability along the wells while one is up (the zoom waits, as it does
  for the build list). Only a row whose `aim` is a line or a cone readies (`msAims`); the rest
  cast at once, and a skill point in hand buys, as the key does.
- **A grapple cast off the mouse reels to its end** (`ms.reel` stands in for the held key;
  any right press lets go).
- **What the eye gets:** `drawCastPreview` (js/draw/marks.js) draws the ground the lit wedge or
  the readied ability covers, from the body toward its cast point, off the row's own `aim`
  (`CLASS_AB`, js/abilities.js: a `line`, a `cone` with its `half`, or a `ring` round the body),
  gold when it will cast and grey while it cannot. The wheel's wedges wear the strip's icons,
  dark while locked, waiting or out of stock (`drawKitWedge`, js/ui/wheel.js).

**The gamepad** (`padPoll`, once per frame from `loop()` — the API has no stick events. Which
pad, out of everything the browser lists, is `padFind`: one with a button down or its left stick
tilted beats an idle one — Steam and the driver shims park a silent virtual "Xbox 360" pad in
slot 0 beside the real controller, and Chrome lists a pad only once a button on it is pressed, so
the first pad by index is often the wrong one — then the one already held, then the slot the last
`gamepadconnected` event named, then a standard layout; switching pads releases whatever the
last one held. A pad the browser could not lay out — `mapping ''`, Firefox on Linux — is read by
where its axes rest the first frame its left stick does, `padCalibrate`: an axis parked near ±1
is a trigger, the rest are the sticks in index order). The CONTROLS page's GAMEPAD
listing ends in a live **readout** (`drawPadReadout`, js/ui/panels.js: the pad's name, the sticks'
knobs, the triggers' bars, the sixteen buttons as pips off `pad.raw`/`pad.down`) — a stick that
walks the knob but not the player, or a pad that moves the mouse but leaves the knob still, says
where the fault is. The one thing it cannot fix: a driver that turns the pad into a mouse and a
scroll wheel (Steam Input's desktop layout, DS4Windows and the like) reaches the page as pointer
motion, clicks and wheel ticks — aim, shots and zoom — while the Gamepad API may see nothing;
the readout shows exactly that (the name row stays dim), and the cure is the driver's setting,
not the game's. In play every button is a key (`PAD_PLAY`): A rolls (and hops
off a landed eagle: `updateDrop` reads the roll intent beside E's work, so the jump button is the
way off the roost), X works,
Y / B / LB / RB are abilities 1-4 in strip order (LB held is the grapple), START the ESC slab,
L3 the inventory drawer, dpad up the sheet, dpad left/right the two meals. Four are gestures: RT is the draw
(held, released fires — the same falling edge as the button), LT the slide, R3 holds the flag
wheel open over the aim (and draws a card on a tap under `PAD_TAP`, the way BACK splits map from standings), dpad down holds the build wheel over the tile the body faces — a pad has no pointer to lay the list's ghost with, so `openWheelNear` offers the wheel there and lays the pick on that tile — (the right stick picks the wedge by its tilt from the
wheel's own hub, `PAD_WHEEL_R` off `wheelLayout` — the same over a wheel X holds open: the
armory, the roll die, the range bell), and BACK is the standings while held and the map on a
tap under `PAD_TAP`. The
left stick is the walk; the right stick is the aim, a bearing off the body at
`PAD_AIM_R0`..`PAD_AIM_R1` world px by tilt, remembered while the stick rests. Over a menu or a
panel (`padMenuMode`: any mode but play and the drop, or play with a panel up) the set flips
(`PAD_MENU`): A *takes* — the thing under the pointer if the hand cursor is showing over a
pointer surface, and always Enter over a key-driven menu (the idle mouse may be resting on
another plank than the dpad picked), which every such menu answers (`padTake`) — B / BACK /
START are Escape, X is Delete (the [saves grid](gameplay.md#saved-matches)'s X on the picked
card), the dpad and bumpers the arrow keys (which also page the settings slab's tabs:
`settingsKey`, js/ui/panels.js, reached from both the title's slide-in and the in-match slab) —
with one exception, an [end screen](rendering.md#the-emote-bar), where the dpad is the emote bar
read clockwise from up (`emotePad`, js/ui/screens.js) and the bumpers keep the planks — the
right stick scrolls the page, and the left stick is a pointer
over pointer-only surfaces (a panel, the wiki, the lobby) and the arrow
keys on a repeat clock over the title's plank column and the death planks (`padPointerMode`,
`padRepeat`). The panels that keep the world running under them — the chart, the counter, the
sheet (`padPanelMode`) — keep the feet too: WASD walks under them
(`sampleHumanInput`), so there the left stick walks and the right stick is the hand. A mode flip under held buttons releases them in the mode they were pressed in and
keeps them marked down, so the START that opened the slab does not close it (`padReleaseAll`).
While the pad owns the pointer `mouse.inside` is held true, so a mouse parked off the window
never hides the pad's hand. `padActive()` — plugged in and touched within `PAD_IDLE` — is what
the CONTROLS page reads, and what every **keybind indicator** reads: while it is true the HOP
OFF cap, the work prompts, the strip's 1-4 and Q/F, the SHIFT plate, the flight HUD's two and
the ESC BACK / CLOSE line under a slab all wear the pad's button instead of the key
(`PAD_BIND`, keyed by action → `drawPadBind` / `drawBackHint`, js/ui/wheel.js; `drawDropBind`, boot.js) —
a change in `PAD_PLAY` is a row there.

## Classes

Every player also carries a class (`p.cls`, an index into `CLASSES` in the `players` banner).
A class is a look, a kit, and **four active abilities on keys 1-4** (`CLASS_AB`, a key carrying
one option or several — `CLASS_AB_ALT`, picked pre-match, [class abilities](gameplay.md#class-abilities-keys-1-4);
[js/abilities.js](../../js/abilities.js) — see [Class abilities](gameplay.md#class-abilities-keys-1-4)).
The kit is the handful of numbers the sim reads through `kitOf(p)`
instead of the bare constants. **`kitOf(p)` returns the *effective* kit**: the class's numbers
with the player's [gear](gameplay.md#gear) folded in by `refreshKit(p)` (cached on `p.kit`, rebuilt
on class or gear change — never per frame). The kit fields: `iceMax` (× `ICE_MAX`), `iceSteer`, `slideMin`, `fatigue`
(snow-slide fatigue rate), `chargeMul` (speed while drawn), `bowCharge` (seconds to full draw),
`nock` (the baseline every rate of fire is scaled against — a tool's own `rof` is multiplied by
`nock / BOW_NOCK`, so a class's hands still set the rhythm; see
[the cycle](gameplay.md#the-cycle)),
`dmgBase`/`dmgPow` (what the *player* adds to the bit's own damage), `spdDmg` (extra damage scaled
by the shooter's speed at release, capped at 200 px/s), `dodgeSpeed`, `maxHp`. Sites that read it:
`updatePlayer`'s movement block, `emitBit`, `tryDodge`, the AI's draw timing, the cursor,
aim line and draw meter. `setClass(p, c)` swaps one in (full heal — it's a pre-match choice);
`p.maxHp` is always `levelMaxHp(p)` = kit hp + the level growth below.

| # | Name | Fantasy | Kit | Flies in with |
| --- | --- | --- | --- | --- |
| 0 | **HUNTER** — bow, distance control, the one class that hides | keep the gap and own the ground between | the ranged numbers: quick nock (0.4 s), full draw power, 92 hp | a SHORTBOW with an ARROW in its second cell, the first held open |
| 1 | **WARRIOR** — close pressure, blocking, momentum | get to arm's length and stay there | 120 hp, faster on ice (×1.15), +5 speed damage, dash 230, softer bow numbers | a LONGSWORD — the one melee body — with a BARBED SHOT on its edge in the second cell, the first held open |

The **weapon is part of the class**: `CLASS_LOADOUT` (js/tools.js) pairs each one with a tool
and **one projectile**, and `setClass` / `Player.reset` (the first landing) hand it over — so the
two classes do not shoot the same thing and every bot arrives armed; a respawn keeps the weapon it
died with ([death keeps everything](gameplay.md#death-and-respawn)). The cell in FRONT of that projectile is
deliberately empty, so the first modifier you walk over auto-fits there and shapes the shot you are
already firing: [starting loadouts](gameplay.md#starting-loadouts). See
[Tools and bits](gameplay.md#tools-and-bits). The four ABILITIES beside the weapon — what each
one does, its cooldown, cast, and the states it leaves on a body — are
[Class abilities](gameplay.md#class-abilities-keys-1-4) in gameplay.md.

The local player's class is **fixed on the character** it was created with (js/profile.js; the
create screen's class pair, [the character screens](rendering.md#the-character-screens)) — the
only way to the other class is another character, and the lobby swaps between the profile's
three with the chevrons beside the stage figure; bots hash theirs — class, look, all four gear
variants **and** their stat points — from the seed in `initPlayers()` so a replayed world fields the same roster in the
same loadouts. Lobby shows that roster as two team panels on the screen's edges — your side left, the
rivals right, their picks face-down until LOCK IN's countdown turns them (a second press skips
the rest of the count) — and the target at the top, whose pop-up's three plates
set `settings.aiLevel` (`AI_LEVELS`, js/ai.js: NORMAL / HARD /
IMPOSSIBLE, remembered with the profile), the profile the rivals play by
(`aiProfile`, [Bots](#bots)). Sprites live in `SPRITES.champ[c][team]` (the sprite key keeps its legacy name;
the grid files under js/sprites/ are never rewritten) — same
16×16 body plan and frame set as the player, so `drawPlayer`/`drawGhost` just swap the set via
`classSet(p)`, which asks `SPRITES.champLook(cls, look, skin(team))` for the class body in the
character's tone and fringe ([sprites.md](sprites.md#looks-a-character-on-the-class-body));
`SPRITES.playerTeam` is class 0 in the default look.

## Hero levels

League-style: every player has `p.level` (1–`LEVEL_MAX` = 12) and `p.xp`, which is simply lifetime
gold earned. **`gainGold(p, n)` is the only way gold enters a wallet** (`awardGold` — the on-the-spot
payout every source uses — and robot deposits both route through it) — it pays the purse, adds the same `n` to `xp` and calls
`levelUp(p)` while `xp >= LEVEL_XP[level]` (cumulative thresholds 40, 100, 180, 280, 400, 540,
700, 880, 1080, 1300, 1540 — the gap grows by 20 each level, 1540 gold to cap). The table is
sized against a bot chaining pines all match (about a gold a second on the fells plus the
[trickle](gameplay.md#economy-one-currency)'s 15 a minute): that bot is level 9 or 10 at fifteen
minutes and capped past twenty, a player who fights and farms by halves sits two or three levels
under it, and the trickle alone is level 3 by seven minutes — a level is news all match. Spending gold and dying never touch
`xp`; level and xp are set in the constructor, not `reset()`, so they would survive a `reset`.

Growth is flat and identical for both classes: each level past 1 adds `LVL_HP` (9) to
`maxHp` (via `levelMaxHp(p)`, healed on the spot) and `LVL_DMG` (2) to every arrow
(`emitBit` adds it after the bit's base + pow × draw + speed bonus). Level 12 is +99 hp / +22
damage. A level-up pushes a 2× gold `LEVEL n` floater over the slot (skipped while `inAir`) and
raises its cue through `sfxOwn(p, 'levelUp', 'pickup')` — the level's own ring on the screen that
is that player, a pickup to bystanders in earshot. What the level BOUGHT flies into the notice
lane as the [stat sheet](rendering.md#the-stat-ledger-your-sheet-as-a-notice), its HEALTH and
DAMAGE rows lit with `+LVL_HP` and `+LVL_DMG` — which is why those two `GEAR_STATS` rows fold the
level in themselves: the kit never holds it.
The table's **average** level is also what the
wildlife is dealt at spawn (`animalLevel`, js/wildlife.js): an animal never levels, but the
meadow and the dens restock at the level the match has reached —
[gameplay.md](gameplay.md#wildlife).

Each level also grants **one skill point** (`p.skillPts`, starting with one at level 1), and a
point buys exactly one thing: **a level on one of the four class abilities**
([gameplay.md](gameplay.md#class-abilities-keys-1-4)), spent on the hud strip's floating buy
plates or by pressing the ability's own key while the point is unspent. The keys start **locked at level 0** — the first point on one is what makes it castable
at all — and the four of them hold exactly 12 levels, so twelve points by level 12 cap all four
with nothing stranded; what a build chooses is the ORDER, since you land with one point, four
dark keys and a match to spend the rest across. Bots spend each
free point in `updateAI`'s rung 0, lowest ability level first, so their first four unlock all
four keys.

The level shows as a 7-tall badge in `drawPlayer`, flush against the left edge of the overhead
bars' backing and spanning the health bar + stamina bar stacked (`py-8 .. py-1`), drawn for every
player in the bars' backing/track colours with the digit in gold — it sizes itself to the number
and grows left, so a two-digit level overhangs like the stun plate does on the other side.
`DBG.gainGold(n, p?)` pays a
player (default local) the way a pickup would, which is how to stage a level.

## Teams and colours

Two presets live in `SPRITES.teams` (`TEAM_SKINS` in [js/sprites/core.js](../../js/sprites/core.js)):
**RED** (the red/teal look) and **BLUE**. A player's team
is `id % TEAM_COUNT` (2), so the ten players alternate into five a side. The team table is the
only place a team colour is written down; the game code reads it back as `TEAMS` for name tags,
map markers, death bursts and the eagles' armour.

**The paint is per screen, the team is not.** Every colour lookup goes through
`skin(team)` (js/player.js) — `TEAMS[skin(p.team)]`, `SPRITES.champ[cls][skin(team)]`,
`eagleTeam`/`teamBuild`/`robotTeam`/`merchant[skin(...)]`, the two maps' eagle marks — and with
`settings.teamBlue` (the default, the ESC menu's MY TEAM row) it returns the BLUE preset for the
local player's side and RED for the rival side whatever indices the roster dealt, so allies are
always blue and enemies always red on your screen (a second human on the other team would see the
mirror). Bot names follow the paint live (`Player.name` is a getter: `RED-3` becomes `BLUE-3` with
the toggle); the human's profile name is stored. Nothing in the rules reads `skin` — `p.team`,
`enemyOf`, `PVP`, ownership and the eagles' `team` fields are untouched — so the toggle is purely
what colour things are drawn.

**Colour-blind palettes.** The GAME page's TEAM COLOURS row (`settings.teamPal`, applied by
`applyTeamPal`, js/core.js) repaints both presets from `TEAM_PALETTES`: orange against blue for
red-green eyes, vermilion against cyan for blue-yellow eyes, pale gold against dark blue for high
contrast ([sprites](sprites.md)). Each chip on the row is its palette, yours beside theirs, so a
player picks the pair they can tell apart. Any palette but the default also turns on the rival's
**shape cue** (`foeCue(team)`, js/player.js): a rival is a cross on both maps and on the lobby
graph's line head (`drawMapUnit`'s `foe`, `drawMapCross`), and its health bar wears a raised dark
cap on its right end (`drawHealthBar`), so the sides part in greyscale. The names stay RED and BLUE.

A team colour drives both **characters** and **buildings**:

- `SPRITES.playerTeam[team][dir][frame]` — the player grids baked with the coat/hat/trim swapped.
  `SPRITES.player` is literally `playerTeam[0]`, so team 0 is the pre-existing art.
- `SPRITES.teamBuild[team][type][tier]` — the tier material (wood → stone → gold) with the iron
  fittings and glow repainted in team colour, so tier still reads as tier. `structSprite(o)` is the
  lookup; it falls back to team 0 for an object with no `team`.
- `SPRITES.robotTeam[team]` — bay robots wear their owner's colour, and the bay itself is one
  palette per team (`bayTeamPal`: its lintel band), not a tier material.

Structures carry `owner` (player id) and `team`, set by `placeStruct()`. Ownership is the
**team's**: `ownsStruct(o, p)` (`o.team === p.team`, or no team at all) gates upgrades and
demolition in `runCmd`, and the same team test opens the manage wheel (hold E, or a pad's
`openWheelNear`) on anything not `fixed`. `cursorInfo()` (js/draw/render.js) shows the hammer in two
places only: over the world while the T build list is up (dim where the ghost cannot stand, and
wearing the picked piece's icon), and over a building of your side's. The right button builds nothing — it is the flag wheel.

Five players per colour means **teammates share it**, so anything that names one player in text
takes a second axis: `playerTint(p)` returns a per-player shade of that team's palette (`trim`,
`hatL`, `trimD`, `hat` by `floor(id / TEAM_COUNT) % 4` — the fifth teammate reuses the first
shade). The team colour stays the background, the tint is the ink — see the
[scoreboard and event log](rendering.md#scoreboard-and-event-log).

## PvP

`enemyOf(p, q)` is the one place the rule lives: another live, active player on **another** team.
Arrows carry `owner`/`team` and meet players in `updatePlay`'s arrow loop — swept along each step,
so a fast shot never steps over one ([flight paths](gameplay.md#flight-paths)) — on an
`ARROW_HIT_R` (10 px) disc round the player's centre — wider than the 4.5 px body a walker
collides with, because a walking target crosses its own width twice in the quarter second a
full-draw arrow takes to fly 80 px, and the same disc on every side keeps it a fact of arrows
rather than a hidden handicap; a hit calls `damagePlayer(target, dmg, dx, dy, src, cause)` for knockback, flash,
floater and possibly `die(p, src, cause)`. Friendly fire is off, and an arrow can never hit its
shooter. `damagePlayer` takes a seventh argument, `crit`, which the arrow loop passes from
`a.ambush`: it runs the damage floater hotter and at double scale and doubles the local shake. Any
hit also calls `risePlayer` before anything else, so nobody stays buried through one. A hunter's
PIERCING SHOT (`a.pierce`, every arm of it) is the one shot that takes a body and keeps flying — everyone on the
line is hit once each (`a.pierceHit`), and only a raised shield or the world stops it. A player
riding a zipline is a target like any other, and cannot shoot back ([the ride](gameplay.md#the-zipline)).

**Whether a rival can be seen at all is a separate question from whether they can be shot.**
`enemyOf` answers the second; `seenAt(p, range)` answers the first, and every watcher in the
game — the bot brain, both turret checks — resolves through it (a camp monster has no sight: a hit is its only trigger). See
[Prone](gameplay.md#prone-under-the-snow).

**A rival's worker bots are targets too** — they are tested straight after the players, on the same
team rule, through `hurtRobot` (see [Robots](gameplay.md#robots)). Shooting one costs the owner
its income and hands the gold it was carrying to whoever downed it, so a base's economy can be
raided without ever touching the base; the feed says so, but a worker is never a kill on the scoreboard.

**So is a rival's grounded eagle** — tested before tile solidity (its own roost tiles are solid,
and would otherwise eat the shot), same team rule, through `hurtEagle` (the `eagle drop` banner in
js/boot.js): a rival arrow landing on **any roost tile** spooks the bird `EAGLE_ARROW_DMG` (12) off
its `EAGLE_HP` (2000) pool — a flat chip, whatever the arrow would do to a body, so archers
standing off it take minutes and the side has time to answer — the
tiles are the one hit test walkers, arrows and E all share, so there is no corner an arrow can
strike without damage — a rival **E swing** chips `EAGLE_WORK_DMG` (20: a hundred swings, about a
minute for a lone warrior under the gust) through `hitObject`'s eagle
branch (the roost tiles are `eagle` objects, a rival-only work target — `workTarget` reads the
`team` they carry), and at zero the bird is **driven off**: `eagleFlee` lifts it away over the
treeline while every camera pans to watch (`state.eagleCine`, the driven-off ceremony), and
`EAGLE_CINE_T` later `eagleFleeResolve` takes the whole owning side out of the match (see
[Death and respawn](gameplay.md#death-and-respawn) and the eagle-drop section in
[rendering.md](rendering.md#eagle-drop-mode-drop)). Friendly arrows pass over it; a friendly
swing is refused. It is not helpless either: a rival lingering in `GUST_R` makes it rear
(wings spread for `GUST_WIND_T` — the telegraph) and **gust**, throwing every rival in
`GUST_BLAST_R` into a `GUST_STUN` tumble with no damage — the trigger resolves through
`seenAt`, like every other watcher — and after `PREEN_DELAY` unhit it preens `PREEN_RATE`
hp/s back.

`die(p, src, cause)` takes **nothing off the body** regardless of what happens next: wallet, pouch,
bag, weapon and build all stay, and the credited killer is paid a flat `KILL_BOUNTY` (12) via
`awardGold` — an uncredited death pays nobody (gold is never a physical drop). What happens next
depends on `teamEagleDown(p.team)` alone: the wait and the return of
[Respawn at the bird](#respawn-at-the-bird) while the team's eagle still roosts, or
`p.eliminated = true`, the permanent path, once it has been driven off;
`updatePlayer` just zeroes a dead player's intents either way. Only the local player's **elimination**
takes the full death overlay with it (`endMatch('lost')`); a respawn-pending local death gets the
lighter `endMatch('respawning')` wait instead — same `state.mode = 'dead'` machinery (so the
replay window and the TAB scoreboard still work), but no dim and no planks: the camera goes to an
ally, one countdown line sits over it, and the replay of the death opens large over the view until
it is closed. An elimination offers spectating any living player through
`viewPlayer()`/`specNext()` (a wait keeps to the side's own, `specOk`), or the way out to the
title — which for an **elimination** goes
through [the defeat screen](rendering.md#the-end-screens) first (`openDefeat()`, and its own plank
calls `toLobby()`), because a lost match ends when you stop watching it rather than when you go
down. Every death runs `checkLastStanding()`, which ends the match as a win once no **rival
team** is left — `rivalTeamsInMatch()`/`teamInMatch()` read the same other-team rule `enemyOf`
does, and **a team is in the match while its eagle roosts**: `teamInMatch` asks
`teamEagleDown(team)` first, so a fled eagle takes the side out whatever else it still holds
(`eagleFlee` in js/boot.js is what puts every player down at liftoff), and a side with every player
dead and waiting on its bird is not out — kills never end a match, only the bird does. **The
match keeps simulating while you are out** — `update()` runs `updatePlay` in both `play` and
`dead` mode; only pause and the settings panel stop the world (the map does not). Full detail:
[Death and respawn](gameplay.md#death-and-respawn).

### Respawn at the bird

The team's roosting eagle is the way back, and the only thing
that takes a player out for good is that eagle being driven off. `updateRespawns(dt)` (called from
`updatePlay` beside `updateStructures`) counts down every `p.dead && !p.eliminated` player's
`p.respawnT` — `respawnTime(p)`: `RESPAWN_BASE` (1 s) plus `RESPAWN_LV` (2 s) per hero level —
3 s at level 1, 5 s at level 2, 25 s at the `LEVEL_MAX` of 12, and nothing off the match clock:
gold is XP and the table only climbs, so the level *is* the clock. An early death costs almost
nothing and a late one costs real match, which is what makes a wiped side late in a game (everyone
high) a real window on a roost its defenders otherwise come back to from sixty pixels away every
few seconds. At zero it calls `respawnPlayer(p)`, which puts `p.spawn`
`RESPAWN_OUT` (40 px) down the spur from the bird (`e.laneDir`; the nearest standable tile there
through `nearestDryTile`, the same spiral a hole is climbed out of) and calls `p.reset(false)`,
the transient-clear a fresh landing gets, i-frames included — so the way back into the match is
the road everyone walked out on, past the merchant. A bird still in the air (a player
shot in the seconds between its own landing and the bird's) has nowhere to set anyone down, so
the timer holds at zero until it roosts; a bird that has fled mid-timer is left to
`eagleFleeResolve`, which puts the whole side out at the end of the ceremony. `reset()` never
touches `p.cards` (picked roguelike cards), gear, skill ranks, level, xp, the wallet, the pouch or
the bag, and with `first` false it leaves the weapon slots alone too (the class kit is only handed
over again when every slot is bare), so the whole player survives every respawn within a match —
the wait is the entire cost ([death keeps everything](gameplay.md#death-and-respawn)).

### Kills and the event log

The last two arguments are the whole credit system. `src` is the player who dealt the damage
(`players[a.owner]` for an arrow, null for the world) and `cause` names what the world did when
there is no `src` (`DEATH_CAUSE`, js/player.js: `ice`, `wolf` — a den's pack or the alpha — `dire`,
`tackle`, `eagle`, `fire`, `soldier`; an unnamed one reads WENT DOWN). A death with an `src` other than
the victim bumps `src.kills` — the scoreboard's KILLS column — and writes `"<killer> SHOT <victim>"` into the log in the killer's colours
(`KILL_VERB` swaps the verb where the cause was no arrow: a `worker`'s axe CUT DOWN, `fire` BURNED);
without one it writes the cause's line — `"<victim> FELL THROUGH THE ICE"` — in the victim's. **Any new way to hurt a
player must pass its `src`**, or the kill goes uncredited and the log line reads as an accident.

The log also takes a level-up at `LOG_LEVEL` (5) or above — the early levels come too
fast to be news — a wrecked building, a scrapped worker, the dire wolf's slayer, each eagle
landing, coming under attack and being driven off, a peer joining or leaving, and the market's
spikes, crashes and restocks. `logEvent(txt, p, o)` is the whole interface (`o` a palette for a line
no player owns); the log is not drawn
([rendering.md](rendering.md#scoreboard-and-event-log)). `DBG.logEvent`/`DBG.events` stage lines
without staging the kills behind them.

## Contested orders

Several players can order the same thing in one step and only one can have it. Those actions queue
a claim instead of acting:

```js
contest('work:' + idx(tx, ty), p, () => { /* runs only if p wins */ });
```

`resolveContests()` runs exactly one claim per key, choosing the lowest `contestRank(p)` =
`hash2(p.id * 131 + 7, state.tick)` — a pure function of the run **seed**, the **player id** and the
**sim tick**, so every machine simulating that step picks the same winner. It is called twice in
`updatePlay`: once after the player loop (work swings, build orders, fish) and once at the end
(drop pickups). Claims must re-check their preconditions inside the callback — cost is paid at
resolution, so a loser keeps its gold.

Currently contested: work swings (`swingHit`, keyed by tile), build orders (`placeStruct`, keyed by
tile), fish catches (`autoFish`, keyed by fish index — nothing refuses one, since fish go in the
pouch), drop pickups (keyed by drop index — every player standing on a drop
claims it *if they have room for it*, and the magnet pulls it toward the nearest such player,
so a full bag hands the pickup on rather than sitting on it, and only food is never refused — a
dropped card is a neutral pickup the same way, first-come whichever team gets there), shop buys
(`shopBuy`, keyed by the counter's well — one stock serves both counters, and a bought offer is
gone until the restock).

## Bots

`updateAI(p, dt)` (the `ai` banner) writes `p.input` and nothing else — a bot can never do anything
a human couldn't. It is a priority ladder re-picked a few times a second, and **a profile says how
well each rung is played** (the `difficulty` banner at the top of ai.js): the **rivals** run
`AI_LEVELS[settings.aiLevel]` — NORMAL / HARD / IMPOSSIBLE, the lobby's plates, remembered
with the profile — and **your allies** run `AI_ALLIES[level]`, the next notch up (capped at the
top) plus the support fields, so your side is always the more competent one and the difficulty
is how good the *other* side is. `aiProfile(p)` is the one place that choice is made
(`p.ai.prof` overrides it for a staged bot — `DBG`, the calibration harness). Every field is a
worse or better use of the same input struct: `sight` (147 / 200 / 267 px — sized to the share of a 640×360 screen a hand sees — through `seenAt` so
cover still works), `react` (0.7 / 0.3 / 0 s a rival stays noticed before the bot turns on it),
`aim` (30 / 8 / 0 px of scatter, re-rolled every `AI_AIM_T`), `lead` (0 / 0.5 / 1 of the
target's motion), `draw` (0.7 / 0.9 / 0.95 of `bowCharge` it looses at — a short draw is a
weak shot), `dodge` (×0.5 / 1 / 2), `abil` (0.35 / 0.8 / 1 chance per `AI_ABIL_T` that a
ready ability is spent), `flee` (0.5 / 0.35 / 0 hp it hides at), `work` (0.5 / 0.8 / 1 duty
cycle of the E key while harvesting — its level pace), `strafe` (0.45 / 0.8 / 1 of each 2 s it
keeps moving in a fight; the rest it PLANTS — stands, draws and shoots, the only time a slow side
fires, so stopping is the tell and the moment a new player hits it — and under 1 it circles that
much less, walking in straighter), `pick`
(`'near'`, or IMPOSSIBLE's `'weak'` — the rival with the least hp), `push` and `guard` (the
objective, below), `support` (allies only), and `relentless` — **IMPOSSIBLE's rivals alone**
(an ally borrows the top notch's hands, never this: `AI_ALLIES` strips it and keeps a flee point,
a guard and its own clock). A relentless side **never gives ground**: a bow crowded under 50 px
circles in instead of backing off, a blocked line is routed in through the open at any range, a
camp on it is fought where it stands, it never burrows (`flee` 0) and keeps no guard; after its
`push.t` **everyone** goes (`push.n` 99) — and goes as a **pack**: off the rival's lane the
pushers rally at their own zipline's end, the last fast ground before the fight, until `AI_PACK`
(5) of the side's living bots are within `AI_PACK_R` (200 px) of it, then each is committed
(`ai.packGo`, cleared only by a death or a recall) and goes on however the others fare, so a
respawn rides straight back to the rally and the roost is hit by a wave of them every time
rather than one body at a time into the guns. On the push it **charges**: only what closes to
`AI_SIEGE_R` is fought, the whole way — a wave on the road, an archer standing off, a defender
at the roost are all walked past for the bird (the siege rule from the first step, whatever the
numbers) — except at its own besieged bird, where a respawn fights everything it sees before it
rides out again. The one thing that turns it home is the pusher rule every level has: its own
bird under `AI_ALARM_HP` while it is *losing* the race. What is **not** in a profile: answering
a hit on its own bird — at every level the side answers from anywhere on the map
(`aiDefendersWanted`, **the two birds**, below); the difficulty is how well they fight when
they get there, never whether they come.

The ladder:

1. **eat** — fish below 50% hp, berry below 80%.
2. **burrow** — a hunter bot only, and decided up front, because two rungs below read the answer.
   A bot that has come off
   worse (under the profile's `flee`) with no rival and no camp monster on it goes [prone](gameplay.md#prone-under-the-snow)
   and waits the fight out for `ai.hideT` (7–12 s); it only ever tries where a player could — on
   snow, on its own feet, and with SNOW COVER's 60 s cooldown in hand. It gets
   straight back up for a monster hunting it, for a rival inside 48 px, or when the spell runs out, and rising
   starts an 18 s lockout so no bot spends the match flopping up and down. `hideT` doubles as the
   give-up: a spot that will not take burns it four times as fast and ends in the lockout.
   Both directions go through `inp.ability = 3`, exactly the cast key a human presses (rising is
   free — tryAbility's snow toggle).
3. **fight** — a rival within the profile's `sight` (`aiNearestEnemy`, filtered through `seenAt()`
   so a buried one is simply not there — plus anyone within `AI_ANCHOR_R` of an **anchor** the bot
   is minding, noticed from up to `AI_ANCHOR_D`: its own bird under attack, the rival bird it is
   pushing, the human it escorts — so a defender finds the archer standing off its roost and an
   ally joins the fight you are in; and a rival **wave's soldiers** in the same sight, with no cover
   to see through, a player in the same sight preferred by a small margin —
   [the waves](gameplay.md#soldiers-the-waves)) and **reacted to** (`ai.seeT` past `react`): circle at ~70 px,
   draw and loose at the profile's `draw`, dodge at its rate, stand for the profile's share of
   every strafe. The aim point carries the scatter and the lead. Only shoots
   when `aiLineClear()` says the flight path is open — and with **no** line it never walks into
   the corner blocking it: past 60 px it routes in through the open (`steerTo`, so in a lane it
   comes down the axis rather than into the tree wall), inside it gives ground straight back and
   lets them come round the corner into the line (bodies pushing into a lane's bend is a
   fight nobody fires a shot in). **Class abilities are spent here, off
   cooldown at the foe** — on the profile's ability roll (`ai.abilOk`), through the same edge
   field a human's key
   sets (`inp.ability`), each gated by the range it is good at (a warrior rushes the mid-gap,
   stomps at arm's length; a hunter locks the piercing draw on an open lane and nets the gap —
   the grapple alone is skipped, a held key and a terrain read the ladder does not try to fake).
   **Already prone, it holds perfectly still
   and shoots from where it lies** — which earns it the ambush multiplier off the same
   `ambushReady()` check a human gets, since `concealOf` discounts a moving mound and
   `ambushReady` refuses a moving shot outright.
4. **a camp on it** — the nearest camp monster already hunting this bot, inside `AI_SIGHT`: shoot it and give
   ground under 64 px, dodge under 30. A camp is neutral until hit, so a bot wakes one itself only
   through the hunt rung, which takes a den's wolves like any animal but never the dire wolf
   (nor the alpha under level 6). **An ally joins the human's camp fight**: a monster hunting
   anybody on its side inside `AI_ANCHOR_R` of the human, noticed from `AI_ANCHOR_D` (the human is
   the anchor, as at rung 3; its own bird under threat comes first), which it walks in on - a
   blade to arm's length, a bow to 90 px with the line open - since that monster is not coming
   to it. Every hit re-aims the camp at the latest hitter, so the helpers keep on whichever of
   the side it is chasing.
5. **lie low** — prone with nothing in sight: hold still and let the snow finish. Everything below
   this rung walks somewhere, and a bot crawling to a berry bush at 20 px/s has stopped playing.
5a. **the order** — a [flag](gameplay.md#team-flags) somebody else on the side planted that
   this bot serves (`servedFlag`): a human teammate's, which is the side's whole plan while it
   stands, or a teammate's it joined. Read before the ladder (`aiFlagSync`, then the `order`
   block): it overrides the defend, guard, push and escort reads below — the one exception the
   **alarm** (its own bird under `AI_ALARM_HP`), which no order overrides — and an ATTACK whose
   ring covers the rival bird, or a DEFEND whose ring covers its own, is folded straight into
   `pushE`/`defend` so rungs 6 and 8 play them with everything they know (the lane, the defenders'
   turrets, the archer's station). Every other order this rung walks: outside `AI_FLAG_IN` of
   the flag it goes there (on the roost budget — a ring in a corner's woods is a walk into
   trees), and a flag it cannot route to is left to the ladder; inside, ATTACK breaks the
   nearest rival building in the ring with E and holds the ground when nothing is left (rivals
   in sight are rung 3's — the ring is an anchor), RALLY stands (and on the way only a rival
   inside `AI_SIEGE_R` is fought: a rally is a disengage), DEFEND and GATHER go on down the
   ladder with the harvest bounded to the ring and the roam replaced by standing. **A bot's own
   flag is the ladder made visible**: rung 6 answering a threat flies DEFEND at its bird, rung 8
   pushing flies ATTACK at the rival bird, rung 13 flies GATHER where it works (`ai.want`, read
   every `AI_FLAG_T` and kept `AI_FLAG_DROP` past its last reason; a guard's station, rung 7,
   is a routine and flies nothing). It plants nothing a
   teammate is already flying over the same ground — it joins that flag (`ai.join`) — and a bot
   with nothing of its own to fly helps at the side's nearest standing flag that wants hands
   (`aiHelps`: an ATTACK from anywhere unless it is a guard, a GATHER only inside
   `AI_FLAG_HELP`, a DEFEND never — the threat read already calls the right number home — a
   RALLY from anywhere). A human's flag pulls every own flag down.
   Planting goes through `plantFlag` directly rather than `input.cmd`: a flag is per-player
   state, not an act in the world, and the human's radial ends in the same function.
6. **defend** — its own bird under `threat` on the shared read (**the two birds**, below): as
   many bots as `aiDefendersWanted` calls home walk to it (`aiToRoost`, below) from wherever on the map they are,
   farming, escorting or guarding, and stand 80 px off — the bird anchors rung 3, so the
   attackers are in sight on arrival — while a bot already inside `AI_ROOST_R` holds its station
   and the rest go on with the match (a side that empties the map for one arrow is a side that
   never pushes). Under `AI_ALARM_HP` (half its nerve) everyone comes, pushers included, the one
   exception a pusher whose side is winning the race — the rival bird lower still — who presses on.
7. **guard** — from 0.6 × `push.t` on, the profile's `guard` bots (1 / 2 / 0 — a relentless side keeps none; allies 1) after
   the pushers in player order (`aiRank`) stand by their own bird, going on down the ladder to work
   what is near while inside `AI_GUARD_R` of it. The bird is their anchor.
8. **push (the objective)** — after `push.t` (360 / 360 / 300 s; allies 720 / 480 / 420) the
   side's `push.n` lowest-ranked bots (2 / 3 / everyone), **one more every `AI_ESCALATE`** (120 s) so a
   stalemate always breaks (`aiPushers`), go for the rival bird — an ally goes whenever
   **the human is already on it** (inside `AI_ROOST_R`), so a push you start is a push your side
   joins — and **any** bot joins a siege its side has going once the rival bird is under
   `AI_JOIN_HP` (0.6) with friends at it, unless its own bird is under threat, which is where it
   is wanted. **The wave is the push**: off the rival's lane, a pusher walks with the head of its
   own side's column on the road (`aiWaveHead` — the own soldier nearest the rival bird that is
   still on the march, within `AI_WAVE_D`) rather than ahead of it alone, closing to `AI_WAVE_R`
   of it and going on from there; with no column out it walks as it always did. (A relentless
   side's grouping is its pack at the zipline's end instead — the profile, above.)
   The walk is `aiToRoost`: the roost sits in its corner's woods at the end of its spur and the
   spur is the only way in, so off it the route is road → `aiLaneGate` (`AI_GATE` px up the road
   from the junction, toward the field) → junction (`e.mouth`) → spur → bird, on a bigger pathfinder budget (`AI_ROOST_BUDGET`,
   `navTo`'s optional last argument); a route straight at the bird runs `NAV_BUDGET` out in
   the border and leaves a bot wedged in a pocket, which is what this exists to prevent. In the
   spur, any **turret the defenders raised comes down first** (E, `STRUCT_HIT_DMG` a swing, 10 of it once
   `STRUCT_DR` has taken its cut — a bot
   standing off the bird under bolt fire never finishes a draw), then a hunter takes its
   station `AI_HOLD` (96 px) out **on the spur's axis**, where the spur keeps the line to
   the roost open (off the axis a wall the defenders raised may eat the shot) and outside the gust, and looses at the
   profile's draw; a warrior walks up to the nearest roost tile (`aiEagleTile`) and swings E on
   it, gust and all, exactly as a hand does. Defenders in sight are rung 3's business — until
   the side outnumbers them: a pusher inside `AI_ROOST_R` of the rival bird whose side has more
   bodies there than the defenders (the `siege` read, above rung 3) keeps hitting the bird and
   leaves the fight to its friends, turning only for a rival inside `AI_SIEGE_R` (48 px),
   because defenders come back from sixty pixels away every few seconds and a push that turns
   to meet each one never lands a swing. A roost it cannot route to is left for `ai.pushCd`
   (10 s).
9. **escort** (allies only) — the two lowest allied bots (`aiEscorts`) keep within
   `AI_ESCORT` (120 px) of the human while they are on the ground and inside `AI_ESCORT_R`
   (400 px), going on down the ladder while they are close.
10. **hunt** — an animal within `AI_HUNT` (120 px), with a 6 s catch timer per animal (prey
   outruns a walk). Birds are excluded: they fly, and no ground route catches a flushed flock.
11. **loot** — walk onto a drop within 72 px (drops are neutral and first-come).
12. **spend** — (a [gear](gameplay.md#gear) level when the purse covers the cheapest piece
   plus a 15-gold float is bought at rung 0 beside the skill point, from anywhere, mid-push or
   mid-defence alike — the hero pop-up is a menu, and a pusher never reaches this rung.) **A bot never shops**: [the merchant's counter](gameplay.md#the-merchants-counter)
   takes the same `input.cmd` a gear buy does and `shopBuy`/`shopTrade` take any `p`, so the
   path is there the day this rung learns to walk to a roost and read a price — nothing about the
   shop is human-only except the drag that sells. Then, with a generator's price in hand, build a generator (or, 30% of the
   time, a bot bay) on the site `aiBuildSite` finds: the nearest tile within `AI_BUILD_R` (5 tiles)
   that passes `canPlaceAt` — the build list's own rule, any open snow or road tile, reach aside
   since the bot walks there — a 1×1 only with three open sides so it never walls itself in, the
   bay wherever its 3×2 fits; else upgrade its own side's work within three tiles. It steps off
   a build site first, since a building is solid, and a site it cannot reach (or is wedged on for
   3 s) is left for 15 s. Picking up a dropped card off the ground already falls out of the loot rung
   (drops are type-agnostic loot); a bot never presses the card key (`input.useCard`) — the
   instant one is carried, `resolveCardForBot` (top of every think) makes the same single random
   pick `useCard` makes for a hand, rarest first, minus the burst and the floater. The loot
   itself is put to work between the loot and spend rungs: every 2.5 s `botFitLoadout`
   (js/tools.js) loads found bits into the tool being fired.
13. **harvest** — walk to a tree/chest/berried bush or a standing rock nobody is at within
   `AI_FORAGE` (12 tiles) and hold E at the profile's `work` duty cycle - a rock's channel is held
   through, since a let-go key throws it away.
14. **roam** — wander between its landing site and the map centre.

**The two birds.** `aiSituation()` (the `the two birds` sub-banner) is what every bot knows
about the objective, both sides of it, all match — read once per sim step (cached on
`state.tick`) and shared by all ten players: for each roosting bird its position, its nerve as a
fraction of `EAGLE_HP`, how long since it was last hit, and who is **at** it inside `AI_ROOST_R`
(240 px) — `defenders` (its own side) and `attackers` (rivals, each resolved through `seenAt`, so
a buried archer is buried for the whole side — plus a rival **wave** at the roost counted at half
strength, so a five-column calls three defenders home rather than the whole side) — with `human`
set when the local player is among the attackers. `threat` is the one word the ladder asks — hit inside `AI_DEFEND_T` (8 s) or an
attacker seen — and `aiDefendersWanted` is how many it calls home (one more than the attackers,
at least two, everyone under `AI_ALARM_HP`). A hit on a roost is therefore news on the far side of the map the same tick,
which is what lets rung 6 answer from anywhere and rungs 6 and 8 weigh one bird against the
other. Nothing in it lets a bot do what a hand cannot: a human reads the same facts off the
map's eagle marks and the bird's nerve bar.

Every walk goes through `steerTo(x, y, reach, budget)`, which is `navTo` on the bot's own player
([gameplay.md](gameplay.md#pathfinding)) — it routes around trees, rocks, buildings and water,
and returns **-1 when there is no route** (or the bot has been pinned for a while). **It rides
the zipline** ([the ride](gameplay.md#the-zipline)) the way a hand does, through the same hop
intent, and nothing in the ladder knows: `steerTo` asks `aiZipWorth` first — would walking to
its own side's cable, riding to the point nearest the goal and walking the rest beat the feet by
`ZIP_AI_GAIN` (4 s)? — and if so walks to the mount (`zipMount`, world.js — the nearest point of
the cable whose ground a body can stand on, shared with a player's walk to the cable), presses `input.jump` under it, holds the stick along
the cable toward the exit while it rides (the goal re-read every think, so a rider called home
mid-cable holds the other way) and presses the hop again `ZIP_AI_OFF` (6 px) short of the exit.
A ride no rung wanted this think is let go of at once (`ai.zipUsed`, `updateAI`), so a bot
never coasts to the terminus by accident, and rungs 3 and 4 let go before they fight: nobody
rides past an enemy holding the handle (roost to cairn is about 12.5 s by the cable against
23 s on foot, seed 42). The -1, not a
timer, is what makes a bot drop a goal: harvest puts the target on `ai.avoid` for 12 s, hunt on
`ai.huntAvoid`, loot lets the drop lie, spend backs off for 15 s, a push on `ai.pushCd`, roam
re-picks. Harvest routes
with reach `WORK_REACH` (any open tile beside the target), so `aiOpenSides() >= 1` is the only
prefilter on work; a build site still wants `>= 3` open sides. Keep the -1 branches when you
extend the ladder — a goal that is never dropped is a bot that stands still forever.

**Calibrating a level** is done bot-vs-bot, headless, in the served page: make the local player a
bot (`player.control = 'ai'`, `players[0].ai.prof = AI_LEVELS[0]` for a middling player who
never pushes — `aiRank` skips `player`, so it holds no push or guard player), stub
`sampleHumanInput`, `DBG.beginDrop()`, then step the sim at its own `TICK_DT` (1/60 —
`DBG.step(dt, n)` runs `n` steps and one render; the bots' strafe and work clocks count ticks, so
any other `dt` plays a different bot) in a loop until
`teamInMatch` fails for a side (`state.elapsed` pauses while
the local player is dead, so write your own clock back into it each step, and only `'won'` /
`'lost'` in `state.over` end a match — `'respawning'` is the proxy dying). Set `DBG.freeze`
first so the frame loop stops stepping under you. Two runs of one seed are **not** the same
match: the title screen's live world spends seed draws for however many frames it was up
before the harness started, so a seed is a distribution, not a replay. Wrapping `gainGold`
and bucketing by the caller in `new Error().stack` (`hitObject`, the kill bounty in `die`,
`animalDies`, `updateStructures`, else the trickle) is how the economy is sized.
The match-length target is a match that ends round fifteen minutes with the human sitting it
out, ten to twenty at the tails, which is what the ally clocks are set for. Where the levels
last measured (seed 42 unless said): NORMAL resolves on the ally push at 17–21 min (seeds 42,
99, 7), a few minutes long of the target, so the ally clocks are the next thing to tune; HARD is
an ally win at about 12:35; relentless IMPOSSIBLE's pack of five goes at about 5:15 and takes
the allied bird to **15 % nerve** by six minutes, then bleeds to the levelled allies (a rusher
never farms: level 5–6 against 12), who win at about 16:30 — the dive, not the race, is what the
level is for, and with a hand rather than a bot on the human's side that dive is the match. A
`push.t` of 0 never touches the bird, and a four-minute pack of four reaches 36 % and loses.

## Online play

A match is ten seats, and any of them can be a person on another screen: relay rooms between
browsers (js/net/transport-ws.js, served by `app/server.js`) and Steam lobbies in the wrapper
(js/net/transport-steam.js, behind `window.steamBridge` and `?transport=steam`). The wire, the
lobby lifecycle and the migration plan are [docs/pvp-architecture.md](../pvp-architecture.md);
what the rest of the code needs to know is this:

- **`NET.role` is `'solo'`, `'host'` or `'client'`** (js/net/net.js). Solo is a host with no peers
  on a loopback transport, so everything that asks "am I simulating?" reads `NET.isHost` and solo
  and host share every branch. **The host runs the whole sim**; a `NET.isClient` screen runs no
  step at all — it sends its own `input` struct up (`netClientStep`, an `in` message the host
  copies onto that slot's `p.input`, `netHostStep`) and draws the snapshots the host sends every
  `SNAP_EVERY` (4) ticks, eased between two (`netClientLerp`). A key handler that calls a sim
  function directly therefore does nothing on a client.
- **A joiner takes an AI seat.** `netHostHello` refuses a different patch or seed, deals the first
  bot slot of the side with fewer people (none left: FULL; past `LATE_JOIN_T`, 300 s into a
  match: LATE), flips it to `'remote'` and dresses it with the joiner's name, look and class. The
  `welcome` carries the roster (`netRoster`: control, team, name, cls, look per slot), which the
  client hands to `initPlayers(roster, slot)` with its own seat as the `'human'`. A peer that
  drops gives its body back to a bot, and its seat waits `RECONNECT_GRACE` (60 s) for it.
- **A cue reaches a client only if the sim said where and who.** Inside the step, `sfxAt`,
  `sfxFor`, `sfxOwn`, `shakeAt` and `shakeFor` (js/net/events.js) play the cosmetic on the host and
  record it (`evPush`; `burst` and the floaters record themselves); the ring rides out with the
  snapshot and the client replays each entry against its *own* player (`evPlay`). A bare
  `if (p === player) SFX.cue()` in the step is a sound no client hears.
- **What is still the host's screen.** `aiProfile` deals the ally profile to the *host's*
  `player.team` and the rival profile to the other side, so a client on the far team plays beside
  rival-grade bots; `aiSituation`'s `human` flag, `aiRank`'s skip and the escort's ward are the
  host's `player` alone — a remote human is counted at a roost but starts no ally push and gets no
  escort. A human flag does lead its side for either kind (`isHuman`). Notices (`raiseNotice`) and
  the own-bird alarm are raised on the host's screen only.
- **What the step gates on `p === player`, a client does for itself.** The profile's lifetime
  stats, `markDropped` and the leap's hard music cut never run on a client's screen, so
  `netClientStats` (js/net/net.js) reads them off its snapshot body each step: `xp` climbing is gold,
  `kills` climbing a kill, `dead` rising a death, `aboard` falling the leap, and the first step of
  the ride the match and its first day. A new local-only side effect in the sim needs its edge there.

## Where players start

Nowhere, until they land: every active player boards **its team's** eagle in `beginDrop()` — RED
and BLUE fly the map's one diagonal (a fixed `EAGLE_FLIGHT_T` 10 s each) in opposite directions,
RED from the top-right corner down to the bottom-left, BLUE the reverse, so the two sides salt
themselves along it from opposite ends and each roosts in its own fixed corner — and gets its
`spawn` from `landPlayer()`, the
nearest open tile to where it jumped. Jumping only unlocks over the line's **last `DROP_LOCK_T`
(4 s)**: bots jump at a hashed fraction of that window (never past its end, the last open
ground before the corner's treeline — no bot is ever force-dropped in the trees), the human where
they press Space — drifting with WASD on the way down — or **not at all**: a human who never
jumps rides the dive and the crash on the bird's back, sits through the
[drop brief](rendering.md#the-drop-brief) (the camera tour of both roosts), then hops off the
roost with E under the E - HOP OFF indicator. A profile's first flight is exactly that ride with
the manual leap refused — scripted onboarding — and a real jump is the opt-out for everyone
after. That tile is what the bot brain
treats as "home". There are no spawn pockets, no starter rings, and no guaranteed resources near
a landing — reading the ride (the dotted path over the snow, or M for the map) is the whole
point. `ringPts` (six points on a ring
`SPAWN_D` tiles from the centre — `RING_N` is frozen at 6, decoupled from the player count) is the
old camp ring, kept only because river spokes and the keep-clear rules in `genWorld()` are built
on it.
