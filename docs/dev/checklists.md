# Checklists

Step-by-step lists for the changes that touch many places at once, the open gaps
([Known drift](#known-drift)) and the [intentionally dead code](#intentional-dead-code) you
should not "clean up".

## Concepting a new look

A new sprite (a character, an NPC, a creature, a building, a plant) is **picked off a concept sheet
before anything goes into `js/sprites/`**: two to four candidate looks painted in code with
`app/media/paint.py`, shown big and pasted into a real game frame beside a player at each size in
question, lettered, and handed to Noah to choose from. The procedure is the `concept-art` skill in
[.claude/skills/concept-art/](../../.claude/skills/concept-art/SKILL.md); the kit is
[media.md](media.md). Older sheets typed as ASCII grids (`merchant-concepts-1`/`-2`) are history:
that method was retired.

## Verifying a change

After cloning, run `sh scripts/setup-hooks.sh` once: its pre-push hook refuses a push to main
or a branch behind origin/main.

The rule is in [CLAUDE.md](../../CLAUDE.md): look at the running game, don't re-read the code and
declare victory. The affordances:

- **`window.DBG`** (end of [js/app/boot.js](../../js/app/boot.js)) — read the object literal for the
  current surface; it is the whole external API. **Stage the scene** (place structures, warp
  beside a camp, jump `state.day`/`state.time`) instead of playing to reach it. The non-obvious
  members:
  - `step(dt, n)` runs `n` update ticks of `dt` (default `TICK_DT`, the live loop's own 1/60 s
    slice) and one render.
  - `freeze = true` stops the rAF loop so stepping is deterministic (it halts `render()` too, so
    the canvas holds the last frame — set the value you want *before* freezing).
  - `hideUI = true` drops the HUD/info stack/cursor for captures.
  - `buildStruct` stages a construction site with no cost or validation; `warp(tx, ty, p?)`
    drops a player on a tile.
  - `setControl(id, mode)` hands a player to an AI, a human or nobody; `setLocal(id)` reseats
    this screen's player in slot `id` (title only; `?local=N` does it at load).
  - `setHide(h, p?)` stages a buried body without lying in the snow for `PRONE_BURY`, and
    `concealOf` / `seenAt(range, p?)` / `ambushReady` read back what the world makes of it.
  - **Staging traps.** `warp` moves a player but **not the camera**, which lerps after it over
    about a second of stepped frames — step ~120 frames of `1/60` after warping before cropping
    anything, or the crop lands on empty world. A live bot parked beside the staged player will
    shoot it dead mid-capture: park its bow with `setNock(1e9, p)` first. And `warp` checks
    nothing: a player dropped into a pine's tile has nearly every shot it fires die in the tile it
    spawned in (a shot's first step strikes the solid its bow is inside unless it is leaving over
    the near edge - `shotContacts`), which reads as "the bow is broken" - test `objects[ty * WORLD + tx]` for the stand tile and the line of fire first.
- **The wire** — the `DBG.net*` handles, the proofs behind [the match](../pvp-architecture.md):
  - `netEcho()` writes the wire's quantum into the world (`snapQuantize`: positions to eighths
    of a px, the one designed loss), snapshots the match, blanks every singleton, applies the
    snapshot back through the bytes and returns the pixels of the world frame that differ
    (`diff`, zero or the snapshot is missing a field the eye can see), the JSON weight by section
    and the fields that did not round-trip (`mismatch`, tolerating one quantum on
    `x`/`y`/`vx`/`vy`/`kbx`/`kby` and nothing else). `netEchoRun(ticks, every)` does it along a
    run and reports the worst - **run it after adding a field to any entity**.
  - `netDeltaRun(ticks, every, loss)` sends this page's sim as binary deltas and applies them
    back, checking the world against the full form after each - **run it after adding a field
    that is a reference or a nested object**; `loss` throws that share away unacked, so the cuts
    come from older bases in the ring.
  - `netStatus()` is the match between tabs: role, the peers' slots, bytes each way and the
    last second's rate, the newest snapshot tick; it also counts `dropped`, `fulls`, the peers'
    `acks` and, under Steam, `framesLost` (deltas the unreliable channel lost a part of).
  - `netVerify(true)` on a host rides the full form along every 5 s so each client checks
    itself (`netStatus().verifyFail` names the first fields that disagreed); `netLoss(f)` on a
    host throws away that share of its snapshot sends before the transport, which is the
    ack-keyed delta's proof.
  - **A match between two tabs**: serve the game, open `?seed=N&net=host&room=R` in one tab and
    `?seed=N&net=client&room=R` in another (the same seed - the host refuses a different one);
    the client takes the smaller side's first AI slot, or its own slot back after a reload. In
    the Claude browser pane a tab that never got a frame does not tick at all: drive a client
    with `setInterval(() => DBG.step(1/60, 4), 66)` and it plays.
  - **`node app/check-join.js`** — run it after touching the party screen, a join path or
    `js/net/`: two headless pages join a party by code on the relay, by code on Steam, from a
    Steam invite, from the friends panel's row and from its invite card (Steam faked in the script with the wrapper's bridge calls), and each must end
    welcomed with both pages still drawing. It serves the game itself on its own port and needs
    Playwright (`PLAYWRIGHT=<its folder>` if it is not on the require path).
  - **Under the wrapper — Noah runs this by hand; a session never starts Electron or makes a
    Steam lobby.** `cd desktop && npm start -- --net=host` on one machine and `--join=LOBBYID`
    on another (Steam running on both) ride the same match over a Steam lobby; with Steam up
    QUICKPLAY hosts a party as a public lobby whose code a friend types into their own party
    (`--transport=relay` for the relay's rooms instead). `DBG.netStatus().lobby` is the id to hand a joiner and `DBG.lobbies()` lists them raw.
    `npm start -- --seed=42 --shot=out.png --wait=4 --quit` boots the game from disk headlessly
    and captures it.
- **The counter needs a merchant, and a merchant needs a roost**: `startGame()`, step until
  `DBG.merchants.length` is 2 and the mode is `play`, step out the `state.dropBrief`, `hopOff()`,
  then `warp` beside `DBG.merchants[i]` — it is a working NPC and wanders off its post, so re-warp
  before each check unless a counter is open (an open counter pins it: `shopServing`). `DBG.openShop()`,
  `shopHit(x, y)`, `buyItem(id, p?)`/`sellItem(slot, p?)`/`shopSellCell(i, p?)`
  and `shopLayout()` drive the panel without a pointer; `DBG.itemCost(id, p?)`, `botNextItem` and
  `botItemBuy` read what an item costs a seat and what a bot would buy, and `BUILD_ITEMS` is the
  catalogue. (`buyItem` and the trades still check the reach: warp to a counter first.) The
  [plates under the minimap](rendering/the-hud-corners/notices-the-plates-under-the-minimap.md):
  `DBG.notices` is the live stack, `DBG.noteRect(k)` where slot `k` sits, and
  `DBG.raiseNotice(kind, txt, good)` raises one.
  A plate ages on wall time in `updateFx`, so `DBG.step` runs its arrival and its fade.
- **`?seed=N`** pins the world — the same seed twice proves a change is deterministic, two seeds
  prove worldgen still varies. Without it every reload is a different world and A/B screenshots
  are meaningless. The seed prints in the [info stack](gameplay/settings.md) — top quarter of the
  left edge — but only while `settings.info` is on, and it defaults **off**: flip it on (the ESC
  menu's INFO row, or F3) before capturing anything you intend to compare later.
- **`.`** cycles the [debug overlay](rendering/debug-overlays-hitboxes-and-routes.md): one press
  for the boxes and circles the sim tests, a second for the route every walker is following and
  the tile it is heading for. Reach for it before reasoning about a collision from the code alone.
  It also draws the **pink centre column** down every player, animal, robot and building
  ([hbMid](rendering/debug-overlays-hitboxes-and-routes.md#the-centre-column-hbmid)) — the only way to see whether an overhead frame
  is square with the sprite it belongs to, since the true middle of an even-width sprite is a pixel
  boundary and being three pixels out is invisible without it.
  It draws in every mode, `settings.hitbox` sets it from `DBG` without the keypress, and
  `DBG.showPaths` still forces the routes on by itself.
- **A keyboard you do not have**: dispatch a `KeyboardEvent` on `window` with the physical
  `code` and the layout's `key` (`{ code: 'KeyA', key: 'q' }` is AZERTY's Q, which must walk
  left) — `DBG.keyName(e)` reads it back the way the listener does, `DBG.binds` is the live
  map, `DBG.setBind(action, key)` swaps as a click-and-press would, `DBG.rebindStart(action)`
  sets a cap listening for a real press, and `DBG.keyRows()` is where every cap sits on the
  CONTROLS page (listing-local; add `SET_X` and the content window's top less the scroll).
  **A pad without a pad**: replace `navigator.getGamepads` with a function returning one
  `{ connected: true, mapping: 'standard', axes: [..4], buttons: [{pressed, value}..17] }`,
  set axes and buttons, and call `padPoll(1/60)` before each `update` — the [two
  controllers](multiplayer.md#the-two-controllers) list what each does.
- **`localStorage.removeItem('softfall.profile')`** re-stages a first launch: a fresh profile
  boots on the title with a pre-rolled name, and its `dropped` flag comes back false, so the next
  ride runs the scripted first flight and its [drop brief](rendering/eagle-drop-mode-drop.md).
  A v2 save (`{ v: 2, active, chars: [{ name, cls, stats }..] }` written before a reload) stages
  the fold into one profile. `DBG.PROFILE` is the store; `DBG.beginProfile()` opens the profile
  card, driven by `profileHit`, `profileKey`, `profileCommit`/`leaveProfile` and read back
  through `profileLayout`/`profileTagRect`; `DBG.lobbyPick(i)` and `DBG.heroList()` drive the
  lobby's hero row, and `DBG.DRAFT`, `DBG.draftAct(slot, 'hover'|'lock', h)`, `DBG.draftPoint(h)` and
  `DBG.draftConfirm()` the draft (set `DBG.DRAFT.t` low to run a clock out). See [architecture.md](architecture.md#profilejs).
- **The [wiki](gameplay/the-wiki.md) needs no staging**: it is driven headlessly by `DBG.beginWiki()`, `wikiSetTab(i)`, `wikiScrollBy(px)`,
  `wikiLayout()` (tabs, rows, the window, the rail) and `wikiHit(x, y)`; the ease takes 0.35 s
  of real frames, so wait for `state.menu.wikiT` to read 1 before hovering anything. The patch
  notes and roadmap open with `DBG.beginNotes()` and `DBG.openPageTab(i)` (0 wiki, 1 patch notes,
  2 roadmap); `DBG.pageTabsLayout()` and `DBG.notesLayout()` read them back.
- **`POST /shot`** in [app/server.js](../../app/server.js) (its `/shot` branch) writes a base64 PNG body to `shot.png` in the
  repo root, for a headless driver doing `canvas.toDataURL()` → POST. Nothing in the client calls
  it; `shot.png` is gitignored.

The server itself needs no configuration: `PORT` overrides the default 8471, `.claude/launch.json`
sets `autoPort` so a second session previews alongside an already-running one, and it sends
`Cache-Control: no-store`, so a plain refresh always picks up an edit.

**Test off `file://`, not just off the server.** `node app/server.js` hides a whole class of bug: the
game is played by double-clicking [index.html](../../index.html), where `fetch` and XHR are
blocked against the page's own folder. Point the driver at the repo's own
`file:///.../index.html?seed=N` for anything that loads an asset.

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
  the maximum: world cues land at **0.2–0.55**, the synth UI blips at 0.15–0.18, and anything
  reading 0 never made signal. It proves a cue *fires*, not that it is mixed right — the bank is
  levelled on loudness, not peak, so two cues at the same rung of the `vol` ladder can sit 0.2
  apart on this meter and still be as loud as each other ([Audio](gameplay/audio.md)). The meter
  costs nothing until first called, and `SFX.debug()` prints the `g` every clip was levelled by.
- `SFX.music.current` names the track the state machine thinks should be sounding, and
  `SFX.music.el(key)` hands out the live `<audio>` element: seek it to `duration - 0.6` to prove
  the `jump → foxglove → silence` chain in seconds instead of nine minutes. `SFX.music.held` is
  what a **hold** interrupted and the second it was interrupted at — the way to prove the trading
  post's borrow-and-return without listening: play a track, seek it, `DBG.openShop()`, read
  `music.current` and `music.held`, `DBG.closeShop()`, and read the held element's
  `currentTime` back. `duration` is only
  finite because [app/server.js](../../app/server.js) answers Range requests — a plain 200 makes an element
  treat a multi-MB mp3 as an unbounded stream.
- `DBG.tipAt(x, y)` is the tooltip the pointer would get there (`null` for none) and
  `DBG.tipRect()` the rect this frame's panel is painted at - which is how the TOOLTIP row's two
  modes ([the hover tooltip](rendering/the-hud-corners/the-hover-tooltip.md)) are read without eyeballing pixels.
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

**Adding an object type** — one `OBJECTS` entry in [js/sim/world.js](../../js/sim/world.js) is most of
it: `solid` (does it block a walker), `tool` (what E reaches for) and `ready` (whether it is worth
reaching *right now* — a rock's regrowth, a snowdrop's rest), `auto` (the hands go to it on their own the moment it
is in reach — `autoWork`; without it the thing waits for E, as only bare ice and the dummy do; a
rival building needs no flag — `autoToolFor` asks `STRUCTS` and `ownsStruct`), `needs` (the tool a swing must already be holding,
null = any), `verb` and `lift` (the E key prompt, which an `auto` type never shows), and `mm`/`map` (what each of the two maps
paints it — `mm` an `[r, g, b]` for the minimap disc, `map` a `CH_*` class the chart files it
under, each a constant or a function of the object, as a roosting eagle's side is; leave `map`
out for anything that stands alone on its tile — a bush, a stump — since at the chart's
scale a speck is noise, and read [rendering](rendering/ui-panels-are-baked-once.md) for what the
chart does with a class). `isSolidTile()`, `workTarget()`, `autoTarget()`, `hitObject()`'s tool
gate, `drawWorkHint()`, `updateMinimap()` and `buildWorldMapImg()` all read that one entry and
need no edit — none of them names a type any more. An object *instance* carrying a `team` field
(the roosting eagles' hitbox tiles) is a rival-only E target — `workTarget()` applies that
generically, the same rule buildings answer through `ownsStruct`.

**Adding a story landmark** is none of that: one `LANDMARKS` entry in
[js/sim/landmarks.js](../../js/sim/landmarks.js) and one grid in js/sprites/landmarks.js. A new placement
rule is one more `LM_WHERE` function: [world.md](world.md#story-landmarks).

What is still per-type and has to be written by hand: the sprite branch in the flat pass or the
`draws` y-sort in `render()` (the draw *order* is one ordered function on purpose — see
[rendering.md](rendering.md)), what a swing actually **does** to it in `hitObject()` (its
particles, its sounds, what it leaves behind), a `CASTERS` entry in js/draw/ground.js if it
stands up off the snow (its art and where it sits, so its shade is baked and follows it —
[cast shadows](rendering/light-and-weather.md#cast-shadows)), and a pass of its own in `renderLighting` if it
glows — there is no light registry to add it to
([rendering](rendering/light-and-weather.md)). A new thing that **walks** draws
`drawCastShade(spr, x, y)` under its sprite instead of a flat rect. A **building**
is not an object type: it is a `STRUCTS` entry in [js/sim/structures.js](../../js/sim/structures.js),
which carries the same `mm`/`map` pair and gets solidity, both maps and the E prompt for free.

**Adding a carried item** — nothing is carried but gold and the six item slots (the backpack
went in 0.531, the food pouch with the potions). A new carried thing is a **shop item**: one
`BUILD_ITEMS` entry (js/sim/items.js) with a `price`, its stats, an `icon` and, for a consumable
that stacks in one slot, a `stack` (the potion, [Heals](gameplay/heals.md)), used off its slot's
key through `useItem`. What it still needs is its icon sprite (bake it beside its own code, not in
the byte-fragile grid files under js/sprites/ — see `SPR.bake` in js/sprites/core.js; an icon that
should **loop** is still one canvas to everything that draws it — put the frames in
`SPRITES.itemAnim[key]` and the canvas in `SPRITES[key]`, and `stepItemIcons` animates it, see
[sprites.md](sprites.md)). A heal the WORLD hands out is not carried at all: it is taken where it
stands through `healPlayer`, like the creek fish and the berry bush. Gold is **not** an item and
must not become one: it is a wallet number with no ceiling.

**Adding or changing a hero's basic attack** — one `attack` row on its `CLASSES` entry
(js/sim/player.js; [the basic attack](gameplay/the-basic-attack.md)): a `name`, an `art`, a
`cycle` (the renock, in seconds, before `kit.nock` and ATTACK SPEED scale it), a `kb`
([knockback](gameplay/the-basic-attack.md#knockback): a multiplier, 1 the ordinary shove), and either a `shot`
(`speed`, `life`, `col`) or a `cut` (`reach`, `half`). The press, the draw, the aim line, the held
weapon, the tooltip, the bots (`aiMelee` reads `cut`) and the ATTACK SPEED stat (`classAs`) all
read the row, so nothing else is edited. A new `art` is a 12×12 grid in `SPRITES.weaponArt`
(js/sprites/weapons.js), a blade's real-length grid in `SPRITES.weaponHeld`, and its heading in
`WEAPON_FWD`; draw a bow the way it is held (string toward the archer, arrowhead at +x). A hero
with a blade of its own sets `blade` on its `CLASSES` row and draws it through `heroBlade`
(js/draw/heroes.js). **Run the feel numbers after any change** (a shot's speed and life and a
cut's reach and damage at a tap, half and full draw, and the cycle): nothing else says when an
edit has changed how an attack plays.

**Adding an item to the merchant's counter**: one `BUILD_ITEMS` entry in
[js/sim/items.js](../../js/sim/items.js). A part has a `price`, one stat and an `icon`; a finished
item adds `from` (its parts, a part named twice is needed twice) and a `passive`. The grid, the
build tree, the price that drops by the parts held, the tooltip and the save all pick it up; the
panel's grid is four a row (`SHOP_COLS`), so a ninth finished item is a third row and the slab's
`SHOP_H` has to grow with it. A new **stat** is one `ITEM_STATS` row (its label, its format and
what it writes into the kit) plus its place in `ITEM_STAT_ORDER` and an icon in `drawShopCats`
(js/ui/shop.js). A new **passive** is one `ITEM_PASSIVES` row: a kit field the sim already reads
needs nothing else; anything that happens on a hit or on the clock goes in `itemsOnHit` or
`itemsTick`, and a new kit field gets its default in `baseKit` (js/sim/player.js). Put the item in
the bots' `BOT_BUILDS` if a class should buy it. A **stack** item (`stack: n`, the potion) is
built from nothing and into nothing, sits in one slot with its count in `p.potions`, and needs its
own buy, sell and use branches (`buyPotion`, `takePotion`, `useItem`).

**Adding a class** — a named hero goes through the `new-hero` skill
([.claude/skills/new-hero/](../../.claude/skills/new-hero/SKILL.md)), which runs this list in order
with Noah's picks around it. The tables make most of it mechanical, and every screen picks the new
entry up with no edit: the lobby's hero row grows a cell, the strip, the hero
pop-up's preview/ledger and the bot class hash
(`initPlayers`, already `floor(hash × CLASSES.length)`) are all generic over the tables. What a
new class needs written:

1. a `CLASSES` entry ([js/sim/player.js](../../js/sim/player.js)) — `name`, its one fixed `look`
   and the `kit` numbers are the load-bearing parts (a hero announced in `HEROES_SOON` moves
   over, keeping its look);
2. the full sprite set in the byte-fragile [js/sprites/characters.js](../../js/sprites/characters.js)
   (a beast goes in beasts.js, the bears in bears.js by rebaking, a building in buildings.js, an item in items.js, terrain in
   terrain.js, HUD art in icons.js), registered by adding its key to that file's
   `Object.assign(SPRITES, {...})` at the bottom —
   4 directions × 3 frames plus the 5-pose prone set, baked into `SPRITES.champ[c]` per team
   via the `TEAM_SKINS` bakes ([sprites.md](sprites.md)) — **this is the expensive part**; and
   its run, held run and roll: a body for the doll in `app/bake-player/bodies.py` (`BODIES`),
   measured off the new idle frames, rebaked into js/baked/motion.js, with its name in
   characters.js's `MOTION_CLS` ([the run and the roll](sprites.md#the-run-and-the-roll));
   a named hero may instead carry its own looks (`skins`, `skinPal`, `skinSlot` on its `CLASSES` row:
   each look's standing grids and a doll named in its row, [hero looks](sprites.md#hero-looks))
   and a skins tab with `hero` in js/ui/skins.js;
3. a `CLASS_AB` row of four actives ([js/sim/abilities.js](../../js/sim/abilities.js)): each ability's
   `cd`/`cast`/`blurb`/`use(p)` and its per-rank numbers (`rank`, read by `abRk`; `cd` a list when it
   shrinks by rank; [ranks](gameplay/class-abilities-keys-1-4.md)) (plus `acol`/`activeF` if a state runs on the body), its
   `abilityPose` case, any world entities it leaves and their tick/draw, and its on-body draw
   in `drawAbilityOnPlayer` if it leaves a visible state;
4. four detailed 32×32 icons in `AB32` (on `AB32_PAL` — one palette across every big icon);
5. a 12×12 class **emblem** in `CLASS12` ([js/ui/menu.js](../../js/ui/menu.js), same palette),
   drawn by hand (never a shrink), which the [team rail](rendering/the-hud-corners/the-team-rail.md), the rooms
   and the tooltips wear;
5b. an `OUTFIT` layer for the 48 px model ([js/sprites/looks.js](../../js/sprites/looks.js) —
   the hat stopping at row 8 so the hair shows under it) and `HERO_N` bumped in
   [js/app/profile.js](../../js/app/profile.js), which looks.js asserts against at load; a `champLook`
   branch in characters.js saying where the new body's fringe sits
   ([sprites.md](sprites.md#looks-a-character-on-the-class-body));
6. an `attack` row on its `CLASSES` entry ([the basic attack](gameplay/the-basic-attack.md));
7. a fight rung in `updateAI` ([js/ai/ai.js](../../js/ai/ai.js)) that spends the four keys at the
   ranges the kit is good at — the class branch there is per-class content and the one `if`
   that must grow. Ask **`abReady(p, i)`**, never a bare `p.abCd[i] <= 0`: a key starts locked
   at level 0 and a bot that skips the check tries to cast something it has not bought.

**Adding a stored profile field** — the field goes in `blank()` in
[js/app/profile.js](../../js/app/profile.js) *and* in the repair loop `PROFILE.load()` runs over an
existing save, or an old profile reaches its readers without it. Give it an accessor on the
`PROFILE` object rather than letting callers reach into `PROFILE.get()`, and pick a write policy:
`saveNow()` for something the player just chose, `scheduleSave()` for anything the sim writes
mid-match. Nothing outside that file may name a storage key.

**Adding a swing tool** (the axe's family that E brings out — *not* a weapon, which is the
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
`concealOf(p) >= PRONE_MAP` the way both maps do. A bot or anything else that plays for a side
passes that side: `seenAt(p, range, team)`, and `inSight(team, u)` for a body that is not a player,
or it sees through the [fog of war](gameplay/fog-of-war.md). **Drawing a body, its dot or anything
pinned to it** asks `fogShown(u, now)` first (js/draw/fog.js), or it shows in the fog. See
[gameplay.md](gameplay/prone-under-the-snow.md).

**Adding a way to hurt anything** — call `hurtUnit(e, dmg, nx, ny, src, o)`, never `damagePlayer` /
`hurtAnimal` / `hurtRobot` directly, and put a state on a body with its setter (`stunUnit`,
`rootUnit`, `slowUnit`, `netUnit`, `markUnit`, `igniteUnit`). One call, and a player, a deer and a
soldier all take it; the three per-kind functions under `hurtUnit` exist for what is genuinely
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
[gameplay.md](gameplay/status-effects-one-set-for-every-unit.md) and
[multiplayer.md](multiplayer.md#kills-and-the-event-log).

**Adding a kind of unit (neutral fauna included)** — a new thing that walks and can be hit is
pushed into `animals` (neutral: give it no `team`, and `unitFoe` makes it fair game to everyone) or
`robots` (sided). What it gets for free, with no edit at the call sites: every class ability, the
roll sweep, every basic attack, all six status effects, and the four on-body tells.
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
   disc the way `animalHitR`/`animalHitY` and `ROBOT_HIT_R`/`robotHitY` do, swept by a loop over its list
   in `shotContacts` (js/sim/sim.js) — that is the one thing the arrow loop asks per kind;
6. if it goes in `animals`, its `SPRITES` entry is **clips, not a flat frame list** —
   `{ right: { idle: [...], ... }, left: ... }`, `idle` mandatory because it is the fallback and
   the frame the wiki's card takes — plus an `ANIM_CLIPS` row naming the same clips with their
   frames a second, and a `setClip(a, name)` at the end of its update. Miss the row and the clip
   never advances; miss `idle` and `clipFrame` has nothing to fall back to
   ([the clips](gameplay/wildlife.md#what-a-beast-is-doing-the-clips)).

**Adding a structure** — add a `STRUCTS` entry (one tier: `cost`, `hp`, `buildT` and the type's
own numbers) and stand it with `createStruct` from whatever owns it (the map at boot, as
`placeTowers` does, or the merchant). Nobody builds by hand, so there is no list or wheel to add
it to. Art of its own needs a grid baked into the per-team `teamBuild` sets (see
[sprites.md](sprites.md)), and both maps colour it from the entry's `mm`/`map` — every building
wears its side's ink (`mmTeam`/`chTeam`, world.js), and `updateMinimap`/`buildWorldMapImg`
resolve a multi-tile footprint's `part` fillers through `structOf()` first, so the anchor's entry
colours the whole building. `isSolidTile()` is generic (`!!STRUCTS[o.type] || ...`) — a new
`STRUCTS` entry is solid for free. `hitObject()`, the draws pass (via `structSprite`),
construction, ownership and the wreck's pay already dispatch on `STRUCTS[o.type]` too, and a shot
meets the grid's own opaque box (`structShotBox`, js/sim/sim.js), so taller art is a taller target
for free. There is nothing to add unless the type does something once built (a functional tick
branch in `updateStructures()`, e.g. the gold pump's ring (`updatePump`, js/sim/pumps.js) or the barracks' waves).

**Adding a camp** — a `CAMPS` entry plus a site in `CAMP_SITES`; that is the whole feature (see
[world.md](world.md#camps) for the fields). The entry's shape:

```js
shipwreck: { name,                // what the M map prints
             r, mark, icon,       // footprint radius in tiles; map ink; the glyph as [x,y,w,h] rects in a 7x7 box
             kind, pop, repop,    // the monster kind and how many; seconds after the last dies before all are back
             props, spots,        // [dx, dy, type, variant] to stamp (the 0,0 one is the anchor); [dx, dy] a monster stands on
             woods }              // optional: the site is IN the border forest (the hog hut) - no path, no CAMP_EDGE
```

A camp with no monster (the HOG HUT) is `kind: null, pop: 0`: nothing stocks it, its clock never
runs, and what it offers is its `props` (the hog hut is scenery only since 0.531).

The site is written **once, for the RED half**, in road coordinates (`u` along the diagonal, `s`
off it) and mirrored for BLUE by `campSites()` — never write both halves by hand, and never a
site under `CAMP_EDGE` tiles from the world's edge (`placeCamps` throws). Nothing rolls: a camp
that wants variety takes it from `props`, not from `rng`. The abandoned mine, frozen fort,
shipwreck and shop are meant to land here, and so is a rookery. Nothing in the maps or the HUD
needs to learn about it. What *does* cost work: any **new object type** its `props` stamp (the
checklist above), and any **new kind of monster** (a `MONSTER` row if it fights like the three
wolves — hp in `ANIMAL_HP`/`ANIMAL_LV_HP`, a `HIT_PUFF` colour, a `YIELD` payout, a `WIKI_BEASTS`
card, its sprite set in `SPRITES[kind]`, the cursor's hover box in `cursorInfo` and the hitbox
overlay's sizes in js/draw/render.js, `animalHitR`'s radius if it is not 8, and — if it can hurt a player
— a `DEATH_CAUSE` key; a kind that does *not* fight needs its own `updateAnimal` branch).

**Adding a ground type** — extend `paintGroundTile()`, `updateMinimap()`, and `buildWorldMapImg()`,
give it a surface branch in `updatePlayer()`'s momentum block (steer/decay/target rates — ice is
the template; a ground that should walk like snow needs none, because only ice and holes are
special-cased — [the road](world.md#the-road), `3`, is the live example of one that walks like
snow and is not snow), and
if it is **open water** make `waterAt()` (world.js) say so — every walker, route, spawn and
climb-out asks that and nothing else ([the creek](world.md#the-creek), `4`, is the live example);
remember `genWorld()`'s `free()` helper treats "ground must be 0" as the placement rule — as do
`tryProne` (snow to dig into) and the footprint emitter. Check `fishWater()` too: it names the
swimmable grounds outright.

**Adding a map shape** — one `MAPS` entry in [js/sim/world.js](../../js/sim/world.js) (the `map types`
group) plus whatever `mapTerrain` needs to read it, and that is the feature: `genWorld`'s
interior pass plants from `mapTerrain`, the class screen's chip draws from it, `layPaths` cuts
its paths if it grows woods (`mapGrown`), and the rock/berry top-up puts it back to OPEN FIELD's
strength (its bushes only keep the stream; `placeBushes` lays the real ones after). Nothing else in the game knows a shape by name. Three rules bound one:

- **The border forest and the two roost corners stay.** `borderDepth` is what the road's gates
  (`roadSpan`) are measured off and what walls in the fixed [bases](world.md#the-bases), and a
  shape that thins them breaks the opening of every match.
- **OPEN FIELD must not move.** Grow the interior on `vnoise`/`hash2` alone, put any `rng()` a
  shape needs at the very **end** of `genWorld` behind `mapGrown(MAP_TYPE)`, and prove it: hash
  `ground`, `objects`, `animals` and `fish` against the same seeds on `main`
  ([world](world.md#map-shapes) records the five that were checked).
- **The valley has to be walkable.** `pathCost` refuses wood outright, so the route `layPaths`
  finds is the shortest way through the ground that is already clear; check the **strict** search
  returns one (`pathRoute(..., false)` non-null) rather than falling back to the axe, then
  flood-fill `walkable()` from `roadNest(0)`'s junction and check every camp and the rival's
  junction come back reachable **chopping nothing**. A shape that fails either is a shape that
  walls a camp in.

A shape is a **page**, so nothing may read `MAP_TYPE` at load time (it is set in js/app/boot.js after
`loadSettings`), and a new entry changes what a lobby considers the same world: `MAPS.length`
bounds the `?map=` parse, and the hello already carries the index.

**Adding a sound** — drop the file in `audio/sfx/`, **run `node app/bake-sfx.js`** (this is not
optional: without it the clip works when served and is silently dead when `index.html` is opened
off the disk, which is how the game is actually played), add it to `SAMPLES` in
[js/app/audio.js](../../js/app/audio.js) (a key may list several files; one is picked per shot), and write
the cue as `name() { if (smp('key', {...})) return; ...synth line... }`. **The synth line is not
optional** — `smp` returns false until the file has decoded, and a cue with nothing behind it is
silent on the first swing of every session. `trim()` levels the file to `SMP_LUFS` for you, so
**pick `vol` as a rung on the ladder the other cues already stand on** — a rare big moment near
0.89, an event worth turning your head for near 0.71, the work you do all match near 0.56, a thing
that never stops near 0.4 ([Audio](gameplay/audio.md)) — and never against the file's own loudness,
which the bank has already taken out. Anything that repeats goes **under** anything that happens
once. `SFX.meter()` proves the cue fires; it does not prove the level, because the bank is levelled
on loudness and the meter reads peak. Set `dur` if the clip holds more than one hit; several of the
existing files are a whole loop padded to a fixed length. **A cue the SIM raises never gates itself** (the CLAUDE.md rule): a world cue is
`sfxAt('cue', x, y, r?, arg?)` — which applies the `nearPlayer` gate, so a remote base cannot spam
the mix — a cue only one body should hear is `sfxFor(p, 'cue', arg?)`, one cue for the owner and
another for bystanders is `sfxOwn(p, own, other)`, and a shake is `shakeFor(p, n)` /
`shakeAt(x, y, n, r?)` (all js/net/events.js). They record the moment for a client that never ran
the step; a bare `if (nearPlayer(...)) SFX.cue()` inside the step is a sound that client never
hears. Outside the step (HUD, menus) the bare `SFX.cue()` is right. A cue on a repeating tick (`building()` on a
site's dust timer) needs a wide `jitter` and a `gap`, or it settles into a rhythm. A
**notification** cue is the opposite: no jitter at all (`SFX.buy`), since it is heard as a meaning
and not as a texture, and two directions get two *different* clips rather than one pitched two
ways. Two clips as one cue is one `smp` per clip with a `delay` on the second, and a cue with two
*directions* takes the direction as an argument and picks its clip from it (`SFX.ui(open)`) rather
than being two cues a caller has to choose between. Before
writing a new one, read the eighteen in the notification block: a surface opening, a step of a
stepped control and a countdown second already have cues, and the answer is usually to call one
of those from a new place. See [Audio](gameplay/audio.md).

**Adding a song** — one `TRACKS` entry in [js/app/audio.js](../../js/app/audio.js) (`f`, `loop`, `vol`,
and `next` if it should chain into another when it ends), then one `SFX.music.play('key')` at the
transition that owns it. Nothing polls for the right track: `play()` no-ops when its key is
already current, so it is safe to call from a state change that repeats.

**Tuning balance** — the numbers live inline, above the code that reads them:

| File | The numbers |
| --- | --- |
| js/sim/core.js | the `YIELD` table (every gold payout, the one table still in core.js) |
| js/sim/player.js | `RESPAWN_WAIT` (the wait for the bird, beside `die()`) and the takedown gold (`KILL_SOLDIERS`, `ASSIST_*`, `BOUNTY_*`, `FEED_*`, the `takedowns` banner); the hero-level table (`LEVEL_XP` — sized against the road's XP, see [multiplayer.md](multiplayer.md#hero-levels)) and what a downed scout is worth (`KILL_XP`/`KILL_XP_LV`); each hero's stats and growth (`CLASSES[c].base`/`.grow`, read through js/sim/stats.js); `BOW_CHARGE` and the momentum constants (`ICE_MAX`, `SLIDE_MIN`/`SLIDE_EXIT`, `TRAIL_MIN`) above `CLASSES`; the player count (`MAX_PLAYERS`) |
| js/sim/world.js | `TREE_HP`; `TREE_RARE_CHANCE` in `treeRare()`; the road (`ROAD_HW`/`ROAD_RAG`/`ROAD_ICE_KEEP`/`ROAD_ICE_TAPER`/`ROAD_STEP`/`ROAD_HW_WOOD`/`ROAD_NEST_IN`/`ROAD_NEST_OFF`/`ROAD_LOG_IN`/`SPUR_HW`), which reshapes the map |
| js/sim/base.js | the bases (`BASE_U`/`BASE_R`/`BASE_RAG`/`PERCH_U`/`BASE_KEEP`, the side mouths `BASE_SIDE_U`/`BASE_SIDE_S`, the bay spots `BASE_BAYS`), which reshape both roost corners |
| js/sim/lanes.js | the top and bot lanes (`LANE_HALF`, their fixed control points, `LANE_HW`/`LANE_RAG`, the ford's `LANE_FORD_HW`) and their cables (`LANE_ZIP_*`) |
| js/sim/structures.js | `STRUCTS` costs/HP/build times (plus the gold pump's pay/period and each type's `w`/`h` footprint); the waves (`STRUCTS.barracks`'s `wave`/`waveT`/`grow`/`cap`/`botHp`/`hp`, `BARRACKS_ROLL`) |
| js/sim/pumps.js | the gold pumps: the ring's size and speed (`PUMP_R`, `PUMP_CAP_T`, `PUMP_FADE_T`) and where they stand (`PUMP_SEEK`/`PUMP_SEEK_FAR`, `PUMP_ROAD`, `PUMP_STAND`/`PUMP_STAND_LONE`, `PUMP_CLEAR`); the bots' `AI_PUMP_*` sit with `aiPumpRung` in js/ai/ai-ladder.js |
| js/sim/robots.js | `SOLDIER_*` (speed, aggro, siege reach, the bird damage, `SOLDIER_HP_GROW`); `MERCH_BAYS`/`MERCH_BAY_*` (how many bays, the logs a rebuild costs, when the first is due, the order the lanes get theirs, the rebuild wait); `MERCH_BACK_R`/`MERCH_BACK_ARC` (how far and how wide the back woods reach) |
| js/sim/farm.js | `SOLDIER_BOUNTY`/`SOLDIER_BOUNTY_GROW` (a soldier's last hit), `COIN_POP_T`; the bots' farm knobs `AI_FARM_*`/`AI_DEN_EARLY`/`AI_LANE_N`/`AI_JUNGLE_N` sit in js/ai/ai-farm.js |
| js/sim/actions.js | `WORK_REACH` and the roll/prone blocks |
| js/sim/player.js, js/sim/attack.js | each hero's basic attack (`CLASSES[c].attack`: cycle, knockback, a shot's speed and life or a cut's reach and sweep); the draw curve (`DRAW_*_MIN`) and the damage roll in `attackDmg()` |
| js/sim/items.js | `BUILD_ITEMS` (every part's and item's price, stats and passive), `ITEM_PASSIVES`, `ITEM_SELL`, `ITEM_FIGHT_T`, `KINDLE_EVERY`/`KINDLE_BURN`, `CHILL_T`/`CHILL_MUL`, the bots' `BOT_BUILDS` |
| js/ui/shop.js | `SHOP_REACH` |
| js/ai/ai-skill.js | every level's numbers (`AI_LEVELS`: the hand fields, the choice knobs, `push`/`guard`), the ally clocks (`AI_ALLY_PUSH`), the ladder's hands (`AI_LADDER_HANDS`), the skill layer's clocks (`AI_SETTLE`, `AI_WOBBLE_T`, `AI_ALERT_T`, `AI_AIM_ON`, `AI_BLADE_CLOSE`, `AI_BLADE_HOLD`) |
| js/ai/ai.js | the bot ranges (`AI_SIGHT`, `AI_HUNT`, `AI_FORAGE`); the objective clocks (`AI_ESCALATE`, `AI_JOIN_HP`, `AI_ALARM_HP`, `AI_ROOST_R`); the waves as a bot reads them (`AI_WAVE_R`/`AI_WAVE_D`); how far a bot walks to its counter to buy (`AI_SHOP_DETOUR`) |
| js/sim/sim.js | the trickle (`TRICKLE_GOLD`/`TRICKLE_T`); the per-surface steer/decay rates inline in `updatePlayer()`'s movement block; the darkness ramp in `update()`; `FLAKE_BASE`/`FLAKE_MIN`/`FLAKE_MAX` beside the flake block |
| js/sim/weather.js | the `WIND_*` block (the three ripples, the bend that meanders them, the gust envelope's floor and peak, and how fast it all dies at dusk) |
| js/sim/eagle.js | the eagle's siege (`EAGLE_HP`/`EAGLE_WORK_DMG`/`EAGLE_ARROW_DMG`/`GUST_R`/`PREEN_RATE`) |
| js/draw/ground.js | the road's colours, `ROAD_COL_*` beside `paintRoadOverlay` |
| js/draw/light.js | the `CLOUD_*` / `RAY_*` / `NIGHT_*` / `STAR_*` blocks in the `light & weather` banner (including `RAY_AFTER` / `RAY_NOON_HALF`, which decide how long the sun shafts are up for) |

Several of the light.js numbers bake at LOAD, so a change to them needs a reload rather than
just a repaint: `bakeCloud`'s `lo`/`hi` ramp, its `CLOUD_CURVE` / `CLOUD_GAIN` contrast shaping and
`CLOUD_TINT` (all three baked into both cloud textures), the beam texture `RAY_CV`, and
the speck atlases `MOTE_CV` / `STAR_CV` / `FLAKE_CV` (colour and shape are baked in; only the alpha
that picks a level is live).

**Moving code between js files** — the game files share one global scope
([architecture.md](architecture.md#shared-global-scope)); these rules stand for any move.
Move whole sections **verbatim** — no renames, no reformatting, no "while I'm here" fixes
([intentional dead code](#intentional-dead-code) stays). Cut banner-boundary to banner-boundary, re-located
fresh with `grep -n "// ------" js/*.js js/*/*.js`, never by remembered line numbers. Before committing:
grep all files for duplicate top-level names (a duplicate `function` silently overwrites:
`grep -hE '^(async )?function |^(const|let|class) ' js/*.js js/*/*.js | sed -E 's/^(async )?(function|const|let|class) ([A-Za-z0-9_$]+).*/\3/' | sort | uniq -d`
must print nothing); scan the moved code's **top-level statements** — every name a
load-time statement references must live in a file loaded above it in index.html (runtime calls
may point anywhere); never reorder existing `<script>` tags; and update the docs in the same
commit — the architecture.md file table, code-map.md's sections, index.html's comment. Then the
full browser pass off both
the served URL and `file://`. The git index is LF and the working tree CRLF through autocrlf, so
an editor that writes LF is fine and git normalises, but `sed -i` still strips CRs and is banned;
and the grid files under js/sprites/ are byte-fragile ASCII art — move a grid line whole, never
re-wrap or re-indent one, and keep them pure ASCII (there is no BOM any more).

## Known drift

Open gaps between what the game does and what it is meant to: prune an entry once it is fixed.
Code that is dead **on purpose** is the next section.

- **No bot walks to a camp on purpose** (3.20): a bot pulls a den only through the hunt rung when
  one is within `AI_HUNT`, never a bear, and nothing in
  `aiSituation` weighs a camp against the road — so the two bear camps are the
  human's to start (the allies join a camp fight the human is in, rung 4) until an objective rung
  learns them ([Bots](multiplayer.md#bots)).
- **The bears keep the old wolves' kind keys** (`alpha`, `dire`) so saves and the net wire still
  load them; the names a player reads are the bears'.
- **The music is the Steam download**: the nine tracks in `audio/music/` are 39 MB of the
  game's 44 MB, encoded at 184–256 kbps. Re-encoding them to 128 kbps (ffmpeg, `-b:a 128k`,
  or `-q:a 5` VBR) would cut the music to roughly 26 MB; the code reads the files by name in
  `TRACKS` (js/app/audio.js), so a re-encode changes nothing but the bytes. Not a priority: it is
  Noah's ears that decide, and a first install is mostly Electron's own ~265 MB anyway.
- **A bot push that stands still mid-map** (seen in 2.63, not since 2.64's blocked-line rule in
  the fight rung, but seed 2 on NORMAL was never re-run): the way in is the harness's per-minute
  rows (own/rival roost distance per player) and `settings.hitbox = 1` on the stalled bots'
  routes.
- **Fire stops at buildings and the bird.** A structure (`hurtStruct`) and the roosting eagle
  (`hurtEagle`) are not units: a flaming shot does its impact damage and neither burns. Deliberate,
  but it is the obvious next place fire could go — it would need a burn clock and a draw pass on
  each.
- **The AI does not play around the new states.** `updateAI` reads no `burnT`, `netT` or `rootT`,
  so a bot on fire does not break off and a netted one does not change its mind. Everything lands
  on them correctly; nothing reacts to it yet.
- **bots never ping.** A ping is a human's hint to the bots (`pingSteer`); the ladder makes no
  ping of its own, so a bot's plan is read off its callouts and the F4 table, not off the map.
- **[README.md](../../README.md) is bare on purpose**: the main menu still
  (`docs/media/github-title.png`), the Steam, Discord, YouTube and X links and the license line; the store
  copy lives on Steam. The other `github-*` stills, the capsule set and the gallery pngs stay in
  the tree unreferenced. The repo's **Social
  preview** is set by hand in GitHub settings to `github-preview.png` (1280×640, under 1 MB). A
  still is staged through `DBG`: `PROFILE.markDropped()`, `beginDrop()`, `hideUI`, `step` to
  `e.t ≈ dur/2` for the pass, `freeze`, `POST /shot?f=`.

- **A record put back counts its lifetime stats again.** The profile's stats
  (`PROFILE.addKill`/`addDay`/`addWin`...) are written as they happen, so replaying a stretch
  with `DBG.saveLoad` adds its kills, days and a win a second time on the dev profile; only the
  lifetime tally is not rewound ([saved matches](gameplay/saved-matches.md)).
- **The day clock turns under the ESC panel and the pause plate.** `update` advances
  `state.time`/`state.elapsed` in play and drop whatever `state.paused`/`state.settingsOpen`
  say, while every body stands still; the match clock under the minimap ticks on behind the
  panel.
- **A loaded match's snow is untrodden.** The trampled-snow field (`trPack`/`trChurn`,
  js/draw/trample.js) is visual and not in `SAVE_ROOTS`, so the paths a match packed are gone
  after a load and refill from there; the match itself plays out the same.

## Intentional dead code

Kept on purpose — do not "clean up", and a verbatim code move carries it along.

- **`rootUnit`/`markUnit` have no caster** (since the hunter's 2.47 rework retired the snare
  trap and the falcon): the two setters, their `drawUnitStates` tells (the sprung jaws, the gold
  chevrons) and mark's `seenAt` bypass all stay, because they are part of the
  [universal status set](gameplay/status-effects-one-set-for-every-unit.md) a future ability or
  attack lands on for free.
- **The bird kind is dormant** (3.20, when the camps replaced the landmarks and the rookery went
  with them): `updateBird`/`flushBirds`/`rookeryPerch`/`drawBird`, the `BIRD_*` constants,
  `YIELD.bird`, `ANIMAL_HP.bird` and every `kind === 'bird'` branch stay, and nothing spawns
  one — a camp that wants a flock stands it up again with `deadTree` props and a perching spawn
  beside `spawnCampMonster` (js/sim/camps.js) ([Birds](gameplay/wildlife.md#birds-the-flock-dormant)). The
  `flushBirds(campAt(...))` calls on a felled snag are the live hooks it would wake through.
- `SPRITES.imp` (the `imp1`/`imp2` grids, `IPAL`) is baked but unreferenced since the bots
  got their own grids — kept in case the imp returns.
- A tree's `variant` (rolled by `randi(0, 1)` in `genWorld`) picks no art any more: there is one
  pine in twenty-four bend frames, `treeFrame` reads the wind for the lean it wears, and the tile's
  own `hash2` mirrors it, gives it a standing lean, a palette row and a nudge.
  **The roll has to stay** — removing an `rng()` call inside `genWorld` reshuffles every
  existing seed. `deadTree` still uses its `variant` for real.
- `SPRITES.spikes`, `SPRITES.fire`, `SPRITES.torch`, and the three heart sprites are baked but
  unreferenced since the buildables/HUD removal — kept in case those features return (the heart
  grids also carry the file's mangled-byte repair).
- The `<` glyph in [js/app/font.js](../../js/app/font.js) was added for the removed resolution cycle
  control and is currently unreferenced — kept as generic font coverage. (`>` is live again: it
  marks your own row on the scoreboard.)
- `SPRITES.raider` (+ `RDPAL`) is still baked but unreferenced since the
  raider removal — kept in case a threat returns; the raider set shares the player grids
  (as do the four `playerTeam` sets, which are the live ones).
- `SPRITES.itemWood` is baked but unreferenced since the single-currency change (no wood drops
  or HUD counters).
- `SWING_TOOLS[SWING_BOW].icon` (`'itemBow'`) is unread —
  `drawHeldTool` puts the hero's own weapon in the hands at rest, and only the axe row's
  icon is still resolved through the table. The row is kept so `SWING_TOOLS` stays one entry per
  `p.swing` value, and `SPRITES.itemBow` itself is live on the end screen's kills plate.
- `audio/music/` holds the nine mp3s `TRACKS` names, plus two tracked images nothing loads
  (`AlbumArtSmall.jpg`, `Folder.jpg`). The alternate takes (34 MB) were deleted in `PATCH 1.53`;
  recover one with `git show ee284a0:"audio/music/<name>"` if a cue ever wants it. A track is
  live only once it is in `TRACKS`. `app/server.js`'s `.ogg`/`.wav` MIME rows are forward-looking — every asset in the repo
  is an mp3.
