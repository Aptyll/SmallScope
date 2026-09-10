# Checklists

Step-by-step lists for the changes that touch many places at once, plus the intentionally dead
code you should not "clean up".

## Concepting a new look

A new sprite — a character, an NPC, a creature, a building — is **picked off a concept sheet
before its grid goes into `js/sprites.js`**: three candidate looks in the game's own ASCII grid
language, rendered at 6× in both team colours and every facing beside a player for scale, saved
under `docs/media/concepts/` and handed to Noah to choose from. The whole procedure, the sheet
template and the grid lint are the `concept-art` skill in
[.claude/skills/concept-art/](../../.claude/skills/concept-art/SKILL.md); the merchant's two
rounds (`merchant-concepts-1`, hoods, rejected; `merchant-concepts-2`, D picked) are the worked
example.

## Verifying a change

The rule is in [CLAUDE.md](../../CLAUDE.md): look at the running game, don't re-read the code and
declare victory. The three affordances:

- **`window.DBG`** (end of [js/boot.js](../../js/boot.js)) — read the object literal for the
  current surface; it is the whole external API. The non-obvious members: `step(dt, n)` runs `n`
  fixed-`dt` update ticks and one render, `freeze = true` stops the rAF loop so stepping is
  deterministic (it halts `render()` too, so the canvas holds the last frame — set the value you
  want *before* freezing), `hideUI = true` drops the HUD/info stack/cursor for captures, `buildStruct` stages
  a construction site with no cost or validation, `warp(tx, ty, p?)` drops a player on a tile, and
  `setControl(id, mode)` hands a player to an AI, a human or nobody. `setHide(h, p?)` stages a
  buried body without lying in the snow for `PRONE_BURY`, and `concealOf` / `seenAt(range, p?)` /
  `ambushReady` read back what the world makes of it. **Stage the scene** (place
  structures, warp beside a camp, jump `state.day`/`state.time`) instead of playing to reach it.
  Two things a staged scene walks into: `warp` moves a player but **not the camera**, which lerps
  after it over about a second of stepped frames — step ~120 frames of `1/60` after warping before
  cropping anything, or the crop lands on empty world; and a live bot parked beside the staged
  player will quietly shoot it dead mid-capture, so park its bow with `setNock(1e9, p)` first.
  And `warp` checks nothing: a player dropped into a pine's tile has every shot it fires die in the
  tile it spawned in (the arrow loop strikes the solid it starts inside), which reads as "the bow
  is broken" - test `objects[ty * WORLD + tx]` for the stand tile and the line of fire first.
- **The counter needs a merchant, and a merchant needs a roost**: `startGame()`, step until
  `DBG.merchants.length` is 2 and the mode is `play`, step out the `state.dropBrief`, `hopOff()`,
  then `warp` beside `DBG.merchants[i]` — it is a working NPC and wanders off its post, so re-warp
  before each check unless a counter is open (an open counter pins it: `shopServing`). `DBG.openShop()`,
  `shopHit(x, y)`, `shopBuy/shopSellCell/shopTrade` and `shopLayout()` drive the panel without a
  pointer; `DBG.marketStep(n)` walks the prices n moves on, so a spike is one call rather than
  three days of waiting, and it ticks the restock clock with them. The news it cuts is a
  [plate under the minimap](rendering.md#market-notices-the-plates-under-the-minimap) as well as a
  feed line: `DBG.notices` is the live stack, `DBG.noteRect(k)` where slot `k` sits,
  `DBG.marketNotice(kind, txt, good)` raises one without moving a price, and
  `DBG.shopRestock(true)` turns the counter over *loudly* (bare, it is the quiet boot roll).
  A plate ages on wall time in `updateFx`, so `DBG.step` runs its arrival and its fade.
- **`?seed=N`** pins the world — the same seed twice proves a change is deterministic, two seeds
  prove worldgen still varies. Without it every reload is a different world and A/B screenshots
  are meaningless. The seed prints in the [info stack](gameplay.md#settings) — top quarter of the
  left edge — but only while `settings.info` is on, and it defaults **off**: flip it on (the ESC
  menu's INFO row, or F3) before capturing anything you intend to compare later.
- **`.`** cycles the [debug overlay](rendering.md#debug-overlays-hitboxes-and-routes): one press
  for the boxes and circles the sim tests, a second for the route every walker is following and
  the tile it is heading for. Reach for it before reasoning about a collision from the code alone.
  It also draws the **pink centre column** down every player, animal, robot and building
  ([hbMid](rendering.md#the-centre-column-hbmid)) — the only way to see whether an overhead frame
  is square with the sprite it belongs to, since the true middle of an even-width sprite is a pixel
  boundary and being three pixels out is invisible without it.
  It draws in every mode, `settings.hitbox` sets it from `DBG` without the keypress, and
  `DBG.showPaths` still forces the routes on by itself.
- **A phone without a phone**: Chrome's device emulation (or the desktop app's Browser pane at
  a width under 768, which also turns clicks into touches) plus `DBG.setMobile('on')` — the
  emulated screen has `devicePixelRatio` 1, so fake it first
  (`Object.defineProperty(window, 'devicePixelRatio', { value: 3 })`, then `setMobile`) or the
  fit picks a 1× pixel and 360 rows. `DBG.layout()` and `DBG.getZoom()` read the fit back,
  `DBG.touchLayout()` where every plate is, and `DBG.touchDown(id, x, y)` / `touchMove` /
  `touchUp(id)` stage fingers by hand (game px; `touchPoll()` then `update()` step a stick).
  **A keyboard you do not have**: dispatch a `KeyboardEvent` on `window` with the physical
  `code` and the layout's `key` (`{ code: 'KeyA', key: 'q' }` is AZERTY's Q, which must walk
  left) — `DBG.keyName(e)` reads it back the way the listener does, `DBG.binds` is the live
  map, `DBG.setBind(action, key)` swaps as a click-and-press would, `DBG.rebindStart(action)`
  sets a cap listening for a real press, and `DBG.keyRows()` is where every cap sits on the
  CONTROLS page (listing-local; add `SET_X` and the content window's top less the scroll).
  **A pad without a pad**: replace `navigator.getGamepads` with a function returning one
  `{ connected: true, mapping: 'standard', axes: [..4], buttons: [{pressed, value}..17] }`,
  set axes and buttons, and call `padPoll(1/60)` before each `update` — the [three
  controllers](multiplayer.md#the-three-controllers) list what each does. Then the real thing:
  `node app/server.js` and the phone on the same network at `http://<this machine's LAN
  ip>:8471`.
- **`localStorage.removeItem('softfall.profile')`** re-stages a first launch: the fresh profile
  rolls a random display name at load (there is no first-launch prompt) and its `dropped` flag
  comes back false, so the next ride runs the scripted first flight and its
  [drop brief](rendering.md#eagle-drop-mode-drop). `DBG.PROFILE` is the store and
  `DBG.openNamePanel()` opens the name editor. See
  [architecture.md](architecture.md#profilejs).
- **The arsenal needs no staging** — every kind is unlocked for
  every profile, so `DBG.LOOT_POOL` is the same on a fresh install as on a played-in one, and
  reading it back is how you prove what a match may drop. `DBG.wipeTech()` still forgets which
  kinds this profile has *held*, which is all the [wiki](gameplay.md#the-wiki)'s blue pips are.
  The wiki itself is driven headlessly by `DBG.beginWiki()`, `wikiSetTab(i)`, `wikiScrollBy(px)`,
  `wikiLayout()` (tabs, rows, the window, the rail) and `wikiHit(x, y)`; the ease takes 0.35 s
  of real frames, so wait for `state.menu.wikiT` to read 1 before hovering anything.
- **`POST /shot`** in [app/server.js](../../app/server.js#L14) writes a base64 PNG body to `shot.png` in the
  repo root, for a headless driver doing `canvas.toDataURL()` → POST. Nothing in the client calls
  it; `shot.png` is gitignored.

The server itself needs no configuration: `PORT` overrides the default 8471, `.claude/launch.json`
sets `autoPort` so a second session previews alongside an already-running one, and it sends
`Cache-Control: no-store`, so a plain refresh always picks up an edit.

**Test off `file://`, not just off the server.** `node app/server.js` hides a whole class of bug: the
game is played by double-clicking [index.html](../../index.html), where `fetch` and XHR are
blocked against the page's own folder. Point the driver at the repo's own
`file:///.../index.html?seed=N` for anything that loads an asset — the sampled sound layer was dead
there for two rounds while every served check passed.

**Audio** is verifiable from outside too, and needs to be — headless Chrome has no speakers, and
"I can't hear it" has several completely different causes that are indistinguishable by ear.
- **`SFX got/want` in the info stack (F3) answers it first**, red when anything is missing — no
  console needed. `SFX.banked()` is the same tally, and `SFX.debug()` adds the context state, the
  three dials and the per-file errors. An **empty bank** means nothing downloaded (the console
  carries one warning naming the first failure); a **populated bank** means the cue is wired
  wrong, mixed too low, or a dial is at zero.
- **Which dial is zero matters.** The SOUNDS bus carries the synth cues too, so `sfxVol: 0` kills
  *every* sound effect, old and new, while the music plays on — whereas an empty bank kills only
  the sampled half and leaves the old synth cues audible. "I hear the menu clicks but no new
  sounds" and "I hear nothing but music" are different faults; do not treat them as one.
- `SFX.meter()` is the peak on the SOUNDS bus right now. Poll it every 25 ms around a cue and take
  the maximum: world cues should land at **0.3–0.7**, the synth UI blips at 0.15–0.18. Anything
  under ~0.12 is inaudible in play, which is how a third of the bank was caught sitting at
  0.05–0.15 before `trim()` levelled it ([Audio](gameplay.md#audio)). The meter costs nothing
  until first called.
- `SFX.music.current` names the track the state machine thinks should be sounding, and
  `SFX.music.el(key)` hands out the live `<audio>` element: seek it to `duration - 0.6` to prove
  the `jump → foxglove → silence` chain in seconds instead of nine minutes. `SFX.music.held` is
  what a **hold** interrupted and the second it was interrupted at — the way to prove the trading
  post's borrow-and-return without listening: play a track, seek it, `DBG.openShop()`, read
  `music.current` and `music.held`, `DBG.closeShop()`, and read the held element's
  `currentTime` back. `duration` is only
  finite because [app/server.js](../../app/server.js) answers Range requests — a plain 200 makes an element
  treat a multi-MB mp3 as an unbounded stream.
- For the ESC panel, `DBG.settingsRows` gives the open page's row anchors (already scrolled -
  a row's `y` is where it is on screen), the navbar cells and the scroll state;
  `DBG.setSettingsTab(id)` flips the page, `DBG.settingsScrollBy(px)` walks it, and
  `DBG.muteBtnRect()` is the speaker's plate (`null` unless the AUDIO page is open) - so a
  driver can click a dial through the real pointer instead of guessing at the 14 px pitch.

A page that loads the same script set as index.html, stages through `DBG` and POSTs the canvas is enough to
drive the whole game from a headless browser; keep such a rig out of the repo (or delete it when
you are done) so `index.html` stays the only entry point.

## What is worth recording

[CLAUDE.md](../../CLAUDE.md) carries the rule (docs are part of the deliverable, fixed in the same
turn as the code); this is the inventory.

**Worth recording:** a new object type, buildable, ground type, resource, camp, or enemy; new
or rebound keys; new state on `state`/`settings`/`player`; a new render pass, overlay, or
offscreen canvas; a change to the day/night, lighting, tool, or difficulty formulas; anything that
adds a cross-file invariant; any change to how the game is run or verified; and durable
preferences or constraints the user states in conversation.

**Not worth recording:** balance tweaks to existing numbers, sprite pixel edits, and refactors
that preserve the described structure.

## Common changes

**Adding an object type** — one `OBJECTS` entry in [js/world.js](../../js/world.js) is most of
it: `solid` (does it block a walker), `tool` (what E reaches for) and `ready` (whether it is worth
reaching *right now* — the bush's berries), `auto` (the hands go to it on their own the moment it
is in reach — `autoWork`; without it the thing waits for E, as only bare ice and the dummy do; a
rival building needs no flag — `autoToolFor` asks `STRUCTS` and `ownsStruct`), `needs` (the tool a swing must already be holding,
null = any), `verb` and `lift` (the E key prompt, which an `auto` type never shows), and `mm`/`map` (what each of the two maps
paints it — `mm` an `[r, g, b]` for the minimap disc, `map` a `CH_*` class the chart files it
under, each a constant or a function of the object, as a roosting eagle's side is; leave `map`
out for anything that stands alone on its tile — a bush, a rock, a stump — since at the chart's
scale a speck is noise, and read [rendering](rendering.md#ui-panels-are-baked-once) for what the
chart does with a class). `isSolidTile()`, `workTarget()`, `autoTarget()`, `hitObject()`'s tool
gate, `drawWorkHint()`, `updateMinimap()` and `buildWorldMapImg()` all read that one entry and
need no edit — none of them names a type any more. An object *instance* carrying a `team` field
(the roosting eagles' hitbox tiles) is a rival-only E target — `workTarget()` applies that
generically, the same rule buildings answer through `ownsStruct`.

What is still per-type and has to be written by hand: the sprite branch in the flat pass or the
`draws` y-sort in `render()` (the draw *order* is one ordered function on purpose — see
[rendering.md](rendering.md)), what a swing actually **does** to it in `hitObject()` (its
particles, its sounds, what it leaves behind), and a pass of its own in `renderLighting` if it
glows — there is no light registry to add it to
([rendering](rendering.md#light-and-weather)). A **building**
is not an object type: it is a `STRUCTS` entry in [js/structures.js](../../js/structures.js),
which carries the same `mm`/`map` pair and gets solidity, both maps and the E prompt for free.

**Adding a carried item** — one `ITEMS` entry (`icon`, `stack`, plus `heal` and `pouch: true` if
it is food) is the storage half: the bag *or* the [pouch](gameplay.md#inventory-and-the-backpack),
the drop pickup, the death spill, the drag and the refusal tell are all generic over that table.
What is *not* generic and must be written per item: an 8×8 icon sprite (bake it beside its own
code, not in the byte-fragile js/sprites.js — see `bakeGrid` in js/tools.js and `CHEST_SPR`; an
icon that should **loop** is still one canvas to everything that draws it — put the frames in
`SPRITES.itemAnim[key]` and the canvas in `SPRITES[key]`, and `stepItemIcons` animates it, see
[sprites.md](sprites.md)), a colour in `RES_COLORS` for the pickup floater, **what it is worth** (see the counter below, or
it sells for nothing), whatever *makes* the item, and what using it does —
`bagClick` maps a cell click onto an input flag, so a new item needs its own branch there or
clicking its cell will just deny (`sendBagCell` runs first and handles only the two kinds that
have somewhere to *go*, a bit and a tool) — and a branch in `tipStack` (the `tooltips` banner, js/ui.js) or
hovering it says only its raw type name. **A new FOOD is the one item that is already generic**:
give its `ITEMS` row a `heal` and `pouch: true` and it picks up the pouch, the meal channel, the
shared clock and the tooltip rows for free (`startEat`, js/core.js — see
[Food](gameplay.md#food-the-meal-is-a-channel)); what it still needs is its own key and a seat in
`FOOD_BTNS` (js/ui.js), because a meal is pressed from the hud strip and never from a cell. The
drop draw pass and the bag cell both centre an icon
on its own width, so a 12×12 needs no branch. Gold is **not** an `ITEMS` entry and must not become
one: it is a wallet number with no ceiling. See
[gameplay.md](gameplay.md#inventory-and-the-backpack).

**Adding a weapon (a tool) or a bit** — both are one entry in `TOOLS` / `BITS`
([js/tools.js](../../js/tools.js)); the loop at the foot of that file registers the `ITEMS` and
`RES_COLORS` rows, so storage, drops, the death spill, the drag, the click that sends it between
pack and weapon, and the loot pools all pick it up
with no other edit. Both need a `price`, or the merchant sells it for nothing and buys it back
for nothing ([the counter](gameplay.md#the-merchants-counter) - half the price is what it fetches,
and a tool carries its loaded bits into that sum). A **tool** needs `rof`/`cap`/`tensile`/`tier`
and an `art` key — reuse one of
the three 12×12 silhouettes in `TOOL_ART` (it is baked once per tier) or add a fourth. `tensile`
is the **weight budget one press spends**, not a ceiling on one bit: price it against `cap` at
roughly four weight a cell, or the tool either cannot fire what it holds or never has to choose.
`tier` and `cap` together also decide what a find does when it is walked over: a higher tier with
a `cap` at least as big **swaps itself into the hand** and takes the build with it
([the swap](gameplay.md#where-tools-and-bits-come-from)), so a new tool that is a straight upgrade
of an existing one needs no pickup code — and one that is better but *narrower* is deliberately
left an ordinary pickup rather than being made to drop somebody's bits.
**A `cap` above 5 is the one number with a layout cost**: the corner's two width constants
(`CORNER_REACH` and `CORNER_CLAIM`, js/ui.js) both spell "six wells" out as `6 * SHELF_CELL +
5 * SHELF_GAP`, so a roomier tool would run its row off the intro bake and under the merchant's
slab, which is pinned off the claim ([the panel](gameplay.md#the-panel)). Widen both together.

**A new way to put a tool on the ground must call `shedBits` first** (js/tools.js) — the two that
exist, `throwCell` (ui.js) and `spillInventory` (player.js), both do. Skip it and that one path is
the only one in the game handing the next person to walk over it a finished weapon.

**A new way to take a drop must ask `dropGone(d)` first** (js/core.js) — the three that exist, the
pickup loop in `updatePlay` (sim.js), the bot's loot scan (ai.js) and the drop draw pass
(render.js), all do. A drop with a `fade` is evaporating and belongs to nobody
([a starting tool does not litter](gameplay.md#a-starting-tool-does-not-litter)); skip the question
and starting kit becomes lootable again from that one path alone.

**Every bit needs a `weight`**, both kinds, because weight is what the press spends. A
**projectile bit** also needs `path`/`solid`/`ff`/`kb`/`life`/`speed`/`dmg`/`col` and an
8×8 grid in `BIT_ART` — `kb` being KNOCKBACK, a *multiplier* on the shove that kind of body
takes anyway, where 1 is the ordinary blow and a missing one means the same
([knockback](gameplay.md#knockback-one-number-thrown-at-three-weights)); a **modifier bit** needs
`proj: false` and a `mod(m)` that edits the envelope `toolPlan` walks forward.

**A `mod` MUST COMPOSE with the value it is handed** — `*=` a multiplier, `+=` a quantity — and
must never `=` or `Math.max` it. A modifier only reaches the projectiles *after* it, so the fold
is ordered by design and two of a kind are meant to stack: two SPEEDUPs are ×4 speed, two FLAMEs
burn twice as long at twice the rate. A `mod` that sets a value silently makes the second copy
worthless, which is the one bug the whole
[forward walk](gameplay.md#toolplan-one-activation-in-one-pass) exists to prevent — and it is not
visible in the tool that holds one. The single exception is `m.type`, a category rather than a
magnitude.

Both need a `name` and a `blurb` — the tooltip prints them, and they are the only words the kind
ever gets; a modifier's blurb says "EVERY SHOT AFTER IT …", because that is what it does. A
modifier that carries a **damage type** sets `m.type` (see `DMG_TYPES`, js/actions.js) and the
arrow carries it to `hurtUnit` with no per-kind code; add its numbers to `tipBit`'s modifier
branch, which reads them back out of `bitMods` rather than restating them.

**It also needs a `TECH` node**, or the tech screen never shows it — the loot pool rolls it either
way, since the pool is every kind at or under a tier, but a kind missing from the page is a kind
nobody can read the numbers of. Give it a `req` naming the node beneath it (null only on the
tier-0 row), and keep each lineage to a root plus at most two children — the tech screen's 8×3 grid
derives its rows from `TECH` and a fourth column would draw off the page. A ninth *lineage* is
the other way off it: the rows have to fall between the tier names and the ESC line, so adding one
means retuning `TECH_ROWH`/`y0` (js/menu.js) as the eighth did. The screen and its
tooltip both follow from that one row.

A brand-new `path` is the only thing that is not table-driven: it needs a
branch in `steerBit` — plus a line in `drawAimLine`'s honesty
rule, which refuses to draw a straight line for a path that does not fly straight. A new **body**
is table-driven again: name it in the bit's `body` and add that name to `BIT_BODY`
(js/render.js), which is the only place the names mean anything. Same for a new **impact** —
what the shot does where it *lands* — one `impact` on the bit and one row in `BIT_IMPACT`
(js/tools.js), which the arrow update calls only when the shot ended on something.

**Putting something on the merchant's counter** — nothing, if it is a tool, a bit or a card: the
stock is rolled off `TOOLS`/`BITS`/`CARD_RARITIES` themselves (`shopRestock`,
[js/shop.js](../../js/shop.js)), so a new kind is on sale the moment it has a `price`. A new
**section** is a row in `SHOP_SECTIONS` plus its branch in `shopOffer` and room in
`shopLayout`'s 2×2 grid — which is full, so a fifth section is a re-layout, not an insert.
A new **traded good** (a thing whose price moves) is one `GOODS` entry and its `MKT_ORDER`
place; the walk, the graph, the headlines, the trade plates and the tooltip are all generic over
that table, but the panel has room for exactly two cards, and "one currency" ([game.md](game.md))
means a good is a *commodity you carry*, never a second wallet.

**Adding a class** — the tables make most of it mechanical, and every screen picks the new
entry up with no edit: the select roster grows a portrait (the column wraps right past
`SEL_P_PER`), the strip, the gear pop-up's preview/ledger and the bot class hash
(`initPlayers`, already `floor(hash × CLASSES.length)`) are all generic over the tables. What a
new class needs written:

1. a `CLASSES` entry ([js/player.js](../../js/player.js)) — `name` and the `kit` numbers are
   the load-bearing halves;
2. the full sprite set in the byte-fragile [js/sprites.js](../../js/sprites.js) —
   4 directions × 3 frames plus the 5-pose prone set, baked into `SPRITES.champ[c]` per team
   via the `TEAM_SKINS` bakes ([sprites.md](sprites.md)) — **this is the expensive part**;
3. a `CLASS_AB` row of four actives ([js/abilities.js](../../js/abilities.js)): each ability's
   `cd`/`cast`/`blurb`/`use(p)` (plus `acol`/`activeF` if a state runs on the body), its
   `abilityPose` case, any world entities it leaves and their tick/draw, and its on-body draw
   in `drawAbilityOnPlayer` if it leaves a visible state;
4. four detailed 32×32 icons in `AB32` (on `AB32_PAL` — one palette across every big icon);
5. a 32×32 class **emblem** in `CLASS32` ([js/menu.js](../../js/menu.js), same palette) — the
   symbolic mark the select roster reads the class by;
6. a `CLASS_LOADOUT` entry ([js/tools.js](../../js/tools.js));
7. a fight rung in `updateAI` ([js/ai.js](../../js/ai.js)) that spends the four keys at the
   ranges the kit is good at — the class branch there is per-class content and the one `if`
   that must grow. Ask **`abReady(p, i)`**, never a bare `p.abCd[i] <= 0`: a key starts locked
   at level 0 and a bot that skips the check tries to cast something it has not bought.

**Adding a stored profile field** — the field goes in `blank()` in
[js/profile.js](../../js/profile.js) *and* in the repair loop `PROFILE.load()` runs over an
existing save, or an old profile reaches its readers without it. Give it an accessor on the
`PROFILE` object rather than letting callers reach into `PROFILE.get()`, and pick a write policy:
`saveNow()` for something the player just chose, `scheduleSave()` for anything the sim writes
mid-match. Nothing outside that file may name a storage key.

**Adding a swing tool** (the axe/pick family that E brings out — *not* a weapon, which is the
entry above) — append to `SWING_TOOLS` with a `SWING_*` index constant, add an 8×8 icon sprite and
name it in the entry's `icon` field, map the object types it works in `workTarget()` (that is the
only selection logic — there are no keys or bar slots), and give its `key` behavior in
`hitObject()`'s gating.

**Adding an ability or input** — it belongs to *every* player, not to the local player. Add the
field to `makeInput()`, fill it for the human in `sampleHumanInput()` (edge-triggered flags are
set by the event handlers and cleared by the sim), consume it in `updatePlayer(p, dt)`, and give
bots a way to use it in `updateAI()`. If only one player can have the result, queue it through
`contest()`. See [multiplayer.md](multiplayer.md). **A modifier key is a trap**: Ctrl+W, Ctrl+T
and Ctrl+N are reserved above the page and `preventDefault()` cannot stop them, so a modifier
bound as a *held* state that the player uses alongside WASD will close their tab. Bind it as a
tap that toggles, and drop `e.repeat` — a held modifier auto-repeats.

**Adding something that hunts a player** — a new enemy, a new building, anything that decides it
can see a player — asks `seenAt(p, range)`, never a bare distance against a bare range. That one
function is where GHOSTSTEP and lying buried in the snow both live, and a hunter that skips it
stares straight through the cover with nothing in the code to say why. If it also *marks* the
player somewhere the player can read (a map dot, an icon), gate that on
`concealOf(p) >= PRONE_MAP` the way both maps do. See
[gameplay.md](gameplay.md#prone-under-the-snow).

**Adding a way to hurt anything** — call `hurtUnit(e, dmg, nx, ny, src, o)`, never `damagePlayer` /
`hurtAnimal` / `hurtRobot` directly, and put a state on a body with its setter (`stunUnit`,
`rootUnit`, `slowUnit`, `netUnit`, `markUnit`, `igniteUnit`). One call, and a player, a deer and a
worker bot all take it; the three per-kind functions under `hurtUnit` exist for what is genuinely
per-kind and are not the entry point. For an **area** effect sweep `unitsHit(src, x, y, r)` (a blow:
a player mid-roll or fresh off a respawn is dropped) or `unitsNear` (a lasting ground condition,
which a roll should not shrug off) rather than writing a loop per kind — that loop is exactly how wildlife and bots
fall out of a feature. Still pass the attacker as `src` (or, when the world did it, a `DEATH_CAUSE`
key as `o.cause`): miss it and the kill is uncredited on the TAB scoreboard and the event log
records the death as an accident. A **new damage type** is one row in `DMG_TYPES`; if it lingers on
the body the way `fire` does, it also needs a `DOT_CAUSE` key, or a roll or a respawn puts the
fire out. **A hit grants no i-frames** — two shots landing in the same step both count, which is
what makes a volley worth its weight; only something deliberate (the roll, a respawn, the landing)
ever sets `p.invuln`. See
[gameplay.md](gameplay.md#status-effects-one-set-for-every-unit) and
[multiplayer.md](multiplayer.md#kills-and-the-event-feed).

**Adding a kind of unit (neutral fauna included)** — a new thing that walks and can be hit is
pushed into `animals` (neutral: give it no `team`, and `unitFoe` makes it fair game to everyone) or
`robots` (sided). What it gets for free, with no edit at the call sites: every class ability, the
roll sweep, every bit the left button fires, all six status effects, and the four on-body tells.
What it must do to get them:

1. build it through a maker that calls **`clearUnitStatus(e)`** (as `makeAnimal`/`makeRobot` do),
   or it has no status fields and the setters write onto a body nothing reads;
2. run **`updateUnitStatus(e, dt)`** at the top of its own update, and bail if the burn killed it —
   a corpse must not then take a step;
3. move through **`navStep`** (which spends `unitMoveMul`), or fold `unitMoveMul(e)` in by hand if
   it steers itself the way a bird's flight and a bot's loiter do — otherwise nothing slows it;
4. call **`drawUnitStates(e, px, py, w, h, now)`** in its draw pass, or its states are invisible and
   unplayable-around;
5. join `separateUnits`, `UNIT_MASS` and `unitRadius` (see the CLAUDE.md rule), and give it a hit
   test the way `animalHit`/`robotHit` do — that is the one thing the arrow loop asks per kind;
6. if it goes in `animals`, its `SPRITES` entry is **clips, not a flat frame list** —
   `{ right: { idle: [...], ... }, left: ... }`, `idle` mandatory because it is the fallback and
   the frame the wiki's card takes — plus an `ANIM_CLIPS` row naming the same clips with their
   frames a second, and a `setClip(a, name)` at the end of its update. Miss the row and the clip
   never advances; miss `idle` and `clipFrame` has nothing to fall back to
   ([the clips](gameplay.md#what-a-beast-is-doing-the-clips)).

**Adding a structure** — add a `STRUCTS` entry (3 tiers) and its row in `BUILD_ORDER` (the
build list draws the local team's `SPRITES.teamBuild[team][type][0]` or, for a sprite too big to
be its own 16×16 icon — see the bay, the turret — a dedicated entry in `teamBuild[team].icon`; a
new row is a new row, no layout to touch) and, unless it is the net's kind, in `STRUCT_ORDER` too
(the pad's wheel sizes itself: a sixth entry is six even wedges). A piece that wears another
type's tile on every footprint tile (`tiled: 'wall'`, the long wall) needs no grid at all and may
`rotates`; anything else with art of its own needs a grid baked into the per-team `teamBuild` sets
(see [sprites.md](sprites.md)), and both
maps colour it from the entry's `mm`/`map` — every building wears its side's ink (`mmTeam`/`chTeam`,
world.js), and `updateMinimap`/`buildWorldMapImg` resolve a multi-tile footprint's `part`
fillers through `structOf()` first, so the anchor's entry colours the whole building. `isSolidTile()` is now generic (`!!STRUCTS[o.type] || ...`) — a new
`STRUCTS` entry is automatically solid for free, and only a genuinely new *non-`STRUCTS`* scenery
type needs a line there. `hitObject()`, the draws pass (via `structSprite`), construction,
ownership and refunds already dispatch on `STRUCTS[o.type]` too — no per-type work there, and
nothing to add unless the type does something once built (a functional tick branch in
`updateStructures()`, e.g. the generator's payout timer or the bay's roll-out).
**The manage wheel is a separate, hand-built list, not generic over `STRUCT_ORDER`** — this bit
the old Keep's "queue card" order and is worth remembering for the next one: `wheelOptions()` only
ever returns `[upgrade, demolish]`, so a structure with its own extra manage-wheel order needs a
line there, between the two (and a matching `runCmd()` branch), regardless of how automatic the
*build* wheel's sizing is.

**Adding a camp** — a `CAMPS` entry plus a site in `CAMP_SITES`; that is the whole feature (see
[world.md](world.md#camps) for the fields). The entry's shape:

```js
shipwreck: { name, tag,           // what both maps and the arrival toast print
             r, mark, icon,       // footprint radius in tiles; map ink; the glyph as [x,y,w,h] rects in a 7x7 box
             kind, pop, repop,    // the monster kind and how many; seconds after the last dies before all are back
             props, spots }       // [dx, dy, type, variant] to stamp (the 0,0 one is the anchor); [dx, dy] a monster stands on
```

The site is written **once, for the RED half**, in road coordinates (`u` along the diagonal, `s`
off it) and mirrored for BLUE by `campSites()` — never write both halves by hand, and never a
site under `CAMP_EDGE` tiles from the world's edge (`placeCamps` throws). Nothing rolls: a camp
that wants variety takes it from `props`, not from `rng`. The abandoned mine, frozen fort,
shipwreck and shop are meant to land here, and so is a rookery. Nothing in the maps or the HUD
needs to learn about it. What *does* cost work: any **new object type** its `props` stamp (the
checklist above), and any **new kind of monster** (a `MONSTER` row if it fights like the three
wolves — hp in `ANIMAL_HP`/`ANIMAL_LV_HP`, a `HIT_PUFF` colour, a `YIELD` payout, a `WIKI_BEASTS`
card, its sprite set in `SPRITES[kind]`, the cursor's hover box in `cursorInfo` and the hitbox
overlay's sizes in render.js, `animalHit`'s radius if it is not 8, and — if it can hurt a player
— a `DEATH_CAUSE` key; a kind that does *not* fight needs its own `updateAnimal` branch).

**Adding a ground type** — extend `paintGroundTile()`, `updateMinimap()`, and `buildWorldMapImg()`,
give it a surface branch in `updatePlayer()`'s momentum block (steer/decay/target rates — ice is
the template; a ground that should walk like snow needs none, because only ice and holes are
special-cased — [the road](world.md#the-road), `3`, is the live example of one that walks like
snow and is not snow), and
remember `genWorld()`'s `free()` helper treats "ground must be 0" as the placement rule — as do
`tryProne` (snow to dig into) and the footprint emitter. Check `fishWater()` too: it names the
swimmable grounds outright.

**Adding a sound** — drop the file in `audio/sfx/`, **run `node app/bake-sfx.js`** (this is not
optional: without it the clip works when served and is silently dead when `index.html` is opened
off the disk, which is how the game is actually played), add it to `SAMPLES` in
[js/audio.js](../../js/audio.js) (a key may list several files; one is picked per shot), and write
the cue as `name() { if (smp('key', {...})) return; ...synth line... }`. **The synth line is not
optional** — `smp` returns false until the file has decoded, and a cue with nothing behind it is
silent on the first swing of every session. `trim()` levels the file for you, so pick `vol` as a
mix against the other cues, not against the file's own loudness — then check it with `SFX.meter()`
(0.3–0.7 for a world cue) rather than by ear, because these clips arrive 20 dB apart. Set `dur` if
the clip holds more than one hit; several of the existing files are a whole loop padded to a fixed
length. World cues gate on `nearPlayer(x, y)` so a remote base cannot spam the mix; cues only the
local player should hear gate on `p === player`. A cue on a repeating tick (`building()` on a
site's dust timer) needs a wide `jitter` and a `gap`, or it settles into a rhythm. A
**notification** cue is the opposite: no jitter at all, and two directions get two *different*
clips rather than one pitched two ways (`SFX.market`), since it is heard as a meaning and not as
a texture. Two clips as one cue is one `smp` per clip with a `delay` on the second
(`SFX.restock`). See [Audio](gameplay.md#audio).

**Adding a song** — one `TRACKS` entry in [js/audio.js](../../js/audio.js) (`f`, `loop`, `vol`,
and `next` if it should chain into another when it ends), then one `SFX.music.play('key')` at the
transition that owns it. Nothing polls for the right track: `play()` no-ops when its key is
already current, so it is safe to call from a state change that repeats.

**Tuning balance** — the numbers live inline: `STRUCTS` costs/HP/build times (plus turret
range/dmg/rate, generator pay/period, bay bot count/HP and its `w`/`h` footprint; the roll-out
cadence is inline in `updateStructures()`'s spawner branch), `CHEST_ODDS` (a chest's card rarity
roll, js/actions.js), `RESPAWN_BASE`/`RESPAWN_LV` (the wait for the
bird, beside `die()`, js/player.js), the `CARDS` table (every card's effect, by rarity) and `useCard`'s (js/core.js)
random draw, the `YIELD` table (every gold payout, the one table still in core.js), the trickle
(`TRICKLE_GOLD`/`TRICKLE_T`, js/sim.js) and `TREE_HP` (js/world.js) beside it, the hero-level table
(`LEVEL_XP`/`LVL_HP`/`LVL_DMG`, js/player.js — sized against the harness, see
[multiplayer.md](multiplayer.md#bots)), the eagle's siege (`EAGLE_HP`/`EAGLE_WORK_DMG`/
`EAGLE_ARROW_DMG`/`GUST_R`/`PREEN_RATE`, js/boot.js), the waves (`STRUCTS.barracks`'s
`wave`/`waveT`/`grow`/`cap`/`botHp`/`hp`, `BARRACKS_ROLL`, js/structures.js; `SOLDIER_*` —
speed, aggro, siege reach, the bird damage, the bounty — and `MERCH_BAY_*` — when the barracks
is due, how far behind the roost, the rebuild wait — js/robots.js; `ROAD_HW`/`ROAD_RAG`/`ROAD_ICE_KEEP`/`ROAD_ICE_TAPER`/
`ROAD_STEP`/`ROAD_HW_WOOD`/`ROAD_NEST_IN`/`ROAD_NEST_OFF`/`ROAD_LOG_IN`/`SPUR_HW`, js/world.js, which reshape the map, and the road's colours
`ROAD_COL_*` beside `paintRoadOverlay` (draw-world.js); `AI_WAVE_R`/`AI_WAVE_D`, js/ai.js) and the bots' objective clocks (`AI_LEVELS`'
`push`/`guard`, `AI_ALLY_PUSH`, `AI_ESCALATE`, `AI_JOIN_HP`, `AI_ALARM_HP`, `AI_ROOST_R`,
js/ai.js), the chest
count/spacing/payout (`CHEST_*` above `placeChests()` in js/world.js),
`WORK_REACH` and the roll/prone blocks in js/actions.js, `BOW_CHARGE` and the
momentum constants (`ICE_MAX`, `SLIDE_MIN`/`SLIDE_EXIT`, `TRAIL_MIN`) in js/player.js above
`CHAMPS`, the per-surface steer/decay rates inline in `updatePlayer()`'s movement block,
the player count (`MAX_PLAYERS`, js/player.js) and the bot ranges (`AI_SIGHT`, `AI_HUNT`, `AI_FORAGE`),
the `TOOLS` and `BITS` tables and the loot rates (`ROCK_DROP`/`TREE_DROP`/`CHEST_TOOL`/`LOOT_TOOL`)
in js/tools.js, the flight-path constants beside `steerBit`, the damage roll in `emitBit()`,
`TREE_RARE_CHANCE` in `treeRare()`, the darkness ramp in
`update()`, the `WIND_*` block in js/sim.js (the three ripples, the bend that meanders them, the
gust envelope's floor and peak, and how fast it all dies at dusk) and the
`CLOUD_*` / `RAY_*` / `NIGHT_*` / `STAR_*` blocks in the
`light & weather` banner of js/draw-world.js (including `RAY_AFTER` / `RAY_NOON_HALF`, which decide
how long the sun shafts are up for), and `FLAKE_BASE` / `FLAKE_MIN` / `FLAKE_MAX` beside the flake
block in js/sim.js. Several of those bake at LOAD, so a change to them needs a reload rather than
just a repaint: `bakeCloud`'s `lo`/`hi` ramp, its `CLOUD_CURVE` / `CLOUD_GAIN` contrast shaping and
`CLOUD_TINT` (all three baked into both cloud textures), the beam texture `RAY_CV`, and
the speck atlases `MOTE_CV` / `STAR_CV` / `FLAKE_CV` (colour and shape are baked in; only the alpha
that picks a level is live).

**Moving code between js files** — the game files share one global scope
([architecture.md](architecture.md#shared-global-scope)); these rules stand for any move.
Move whole sections **verbatim** — no renames, no reformatting, no "while I'm here" fixes
(intentional dead code stays; see Known drift). Cut banner-boundary to banner-boundary, re-located
fresh with `grep -n "// ------" js/*.js`, never by remembered line numbers. Before committing:
grep all files for duplicate top-level names (a duplicate `function` silently overwrites:
`grep -hE '^(async )?function |^(const|let|class) ' js/*.js | sed -E 's/^(async )?(function|const|let|class) ([A-Za-z0-9_$]+).*/\3/' | sort | uniq -d`
must print nothing); scan the moved code's **top-level statements** — every name a
load-time statement references must live in a file loaded above it in index.html (runtime calls
may point anywhere); never reorder existing `<script>` tags; and update the docs in the same
commit — the architecture.md file table, code-map.md's sections, index.html's comment. Then the
full browser pass off both
the served URL and `file://`. Use a CRLF-preserving editor (the repo is CRLF; `sed -i` mangles it
here), and **never rewrite js/sprites.js** — it has a UTF-8 BOM and byte-fragile grids.

## Known drift

- **`rootUnit`/`markUnit` currently have no caster** (intentional dead code since the hunter's
  2.47 rework retired the snare trap and the falcon): the two setters, their `drawUnitStates`
  tells (the sprung jaws, the gold chevrons) and mark's `seenAt` bypass all stay, because they are
  part of the [universal status set](gameplay.md#status-effects-one-set-for-every-unit) a future
  ability or bit lands on for free.
- **The bird kind is dormant** (3.20, when the camps replaced the landmarks and the rookery went
  with them): `updateBird`/`flushBirds`/`rookeryPerch`/`drawBird`, the `BIRD_*` constants,
  `YIELD.bird`, `ANIMAL_HP.bird` and every `kind === 'bird'` branch stay, and nothing spawns
  one — a camp that wants a flock stands it up again with `deadTree` props and a perching
  `spawnOne` ([Birds](gameplay.md#birds-the-flock-dormant)). The `flushBirds(campAt(...))` calls
  on a felled snag are the live hooks it would wake through.
- **No bot walks to a camp on purpose** (3.20): a bot pulls a den only through the hunt rung when
  one is within `AI_HUNT`, never the alpha under level 6 or the dire wolf at all, and nothing in
  `aiSituation` weighs a camp against the road — so the alpha stones and the dire hollow are the
  human's until an objective rung learns them ([Bots](multiplayer.md#bots)).
- **The alpha and the dire wolf wear placeholder sprites** (3.20): the wolf's grids washed and,
  for the dire, doubled ([sprites.md](sprites.md)). Each wants its own concept sheet.
- **A bot push could stall mid-map with nothing in its way** (2.63, seed 2 on NORMAL, twice in
  five runs): from `AI_ALLY_PUSH` on, every ally read `aiWantsPush` true, `pushCd` 0, and stood
  at one spot ~2700 px from the rival roost for eight minutes, hp bleeding a few points a
  minute. 2.64's blocked-line rule in the fight rung (a bot with no line routes or gives ground
  instead of walking into the corner) removed the one such stall it reproduced — ten bodies
  jammed at a lane's bend, seed 99 — and none of 2.64's runs stalled, but seed 2 itself was not
  re-run; if a push stands still again, the harness's per-minute rows (own/rival roost distance
  per player) and `settings.hitbox = 1` on the stalled bots' routes are the way in.
- **A player's whole wallet still goes to the killer** (2.63): with the fells cut, kill transfers
  are the biggest single swing left in the harness buckets (400–590 gold to one bot in a
  20-minute run, from bots that hoard once their gear is bought) — a level and a half late. It is
  the stake pillar, not a bug, but it is the next snowball to weigh: a bounty cap, or a hoarder's
  sink.
- [README.md](../../README.md) is the GitHub page (`PATCH 3.17`; it was a Steam mock-up from
  `PATCH 2.45` through `2.70`). It leads with **Genre**, a short description under 300
  characters, **Tags**, a links row (Discord, YouTube, mail), the **1280×640 GitHub social
  preview** (`docs/media/github-preview.png` — the two eagles crossing, no HUD, cropped 2:1 from
  a DROP_ZOOM pass on seed 7), then the match copy. Gallery stills in `docs/media/` (`github-title`,
  `github-roost`, `github-hunt`, `github-practice`, plus the fishing capsule `capsule/03-catch`)
  are 1920×1080 canvas dumps except the preview. `github-pass` stays in the tree unreferenced
  (it duplicated the 1280×640 hero). Steam coming-soon sits at the bottom. [LICENSE](../../LICENSE)
  is MIT for the source code only; art, audio and the Softfall name are all rights reserved,
  including the sprite grids in `js/sprites.js`, baked sound in `js/sfxdata.js`, and files under
  `audio/` and `docs/media/`. The About copy is still
  the pillars of [game.md](game.md) — when a pillar changes, both change. No docs links and no
  controls list. The older capsule set (`docs/media/capsule/01-pass` … `05-practice`, Noah's
  played captures) and the gallery pngs (`hero`, `player`, `bow`, `axe`, `deer`, `rabbits`) stay
  in the tree unreferenced by the README. Set the repo **Social preview** in GitHub settings to
  `github-preview.png` (1280×640, under 1 MB); GitHub does not pick the README's first image on
  its own. A still can also be staged through `DBG` (`PROFILE.markDropped()`, `beginDrop()`,
  `hideUI`, `step` to `e.t ≈ dur/2` for the pass, `freeze` and `POST /shot?f=`).
- `SPRITES.imp` (the `imp1`/`imp2` grids, `IPAL`) is baked but unreferenced since the worker bot
  got its own grids — kept in case the imp returns.
- A tree's `variant` (rolled by `randi(0, 1)` in `genWorld`) picks no art any more: there is one
  pine in twenty-four bend frames, `treeFrame` reads the wind for the lean it wears, and the tile's
  own `hash2` only mirrors it and gives it a standing lean.
  **The roll has to stay** — removing an `rng()` call inside `genWorld` reshuffles every
  existing seed. `deadTree` still uses its `variant` for real.
- The flat `SPRITES.spawner` (the old 16×16 hut grid in the three tier palettes) is baked but
  unreferenced since the bot bay; the live sprite is `teamBuild[team].spawner[0]`.
- `SPRITES.spikes`, `SPRITES.fire`, `SPRITES.torch`, and the three heart sprites are baked but
  unreferenced since the buildables/HUD removal — kept in case those features return (the heart
  grids also carry the file's mangled-byte repair).
- The `<` glyph in [js/font.js](../../js/font.js) was added for the removed resolution cycle
  control and is currently unreferenced — kept as generic font coverage. (`>` is live again: it
  marks your own row on the scoreboard.)
- `SPRITES.raider` (+ `RDPAL`) and `SPRITES.mine` are still baked but unreferenced since the
  raider/mine removal — kept in case a threat returns; the raider set shares the player grids
  (as do the four `playerTeam` sets, which are the live ones).
- `SPRITES.goldOre`, `SPRITES.itemWood`, and `SPRITES.itemStone` are baked but unreferenced since
  the single-currency change (no ore object, no wood/stone drops or HUD counters). They are now
  one `ITEMS` entry each away from being carryable, should a resource ever return.
- `SWING_TOOLS[SWING_BOW].icon` (`'itemBow'`) is unread since the weapon slots landed —
  `drawHeldTool` puts the *equipped* tool in the hands at rest, and only the axe and pick rows'
  icons are still resolved through the table. The row is kept so `SWING_TOOLS` stays one entry per
  `p.swing` value, and `SPRITES.itemBow` itself is live on the end screen's kills plate.
- `SFX.nightSting` in [js/audio.js](../../js/audio.js) is unreferenced since the raider removal
  (`SFX.monsterDie` is live again — every animal death plays it).
- `audio/music/` is again exactly the files `TRACKS` names — nine, since WHISPERING WOODS was
  wired to the wiki in `PATCH 3.01`. The alternate takes and album art
  that sat beside them (34 MB, nothing loading them) were deleted in `PATCH 1.53`; recover one with
  `git show ee284a0:"audio/music/<name>"` if a cue ever wants it. A track is live only once it is in
  `TRACKS`. `app/server.js`'s `.ogg`/`.wav` MIME rows are forward-looking — every asset in the repo
  is an mp3.
- The `tracers` pass is kept working but has no trigger — it went idle with the raiders. The
  **turret is live** (it shoots enemy players and worker bots) but it does not use `tracers`: it
  fires a travelling bolt through the `arrows` array, so the `tracers` pass still has nothing
  pushing to it. Wolves are hostile but only to players.
  Worker bots take arrows from any rival, the turret bolts that were already aiming at them, a
  rival worker's axe on an attack [flag](gameplay.md#team-flags), and now every class ability and
  the roll like any other body — but the AI's target picker still ignores them: a bot only
  downs a worker by accident, with a shot meant for a player. Buildings are not immune either: a
  **player** on another team breaks one with E, with **any bit a wall stops**, or with any
  ability that lands damage, and a worker on a siege flag does the same — all through the one
  `hurtStruct`, which damps a player's blow by `STRUCT_DR` and a bot's not at all (see
  [Base building](gameplay.md#base-building)). No wildlife does. A bit that passes walls
  (`solid: false`) passes buildings too, and a turret bolt chips whatever rival wall it dies on.
- **A structure is not a unit, and neither is the roosting eagle.** Everything in
  [status effects](gameplay.md#status-effects-one-set-for-every-unit) — damage types, fire, the six
  states — is for bodies that walk. A building has an hp pool and `hurtStruct` (and `structsNear`
  where a body would answer to `unitsNear`); the eagle is an
  objective with `hurtEagle` and a ceremony of its own. A flaming shot that hits either does its
  impact damage and nothing more: neither burns. That is deliberate, not an oversight — but it is
  the obvious next place fire could go, and it would need a burn clock and a draw pass on each.
- **The AI does not play around the new states.** `updateAI` reads no `burnT`, `netT` or `rootT`,
  so a bot on fire does not break off and a netted one does not change its mind. Everything lands
  on them correctly; nothing reacts to it yet.
- **bots never plant a RALLY flag.** Every other order a bot flies is its ladder's own decision
  made visible (`aiFlagSync`, ai.js); nothing in the ladder is a retreat, so the fourth wedge is a
  human's alone until one is.
