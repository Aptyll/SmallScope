# Architecture

Which file holds what, what each one puts on `window`, and the load order that makes it work.
Read this before adding a file, moving a function between files, or wondering where a global
came from. The rules that survive in [CLAUDE.md](../../CLAUDE.md) are the ones you break without
ever opening this page; everything here is reference.

## Three legacy IIFEs, the sprite folder, one generated data file, and the flat game code

[index.html](../../index.html) loads them in a fixed order. There is no bundler,
no module system and no import statement anywhere — **the files communicate only through
globals, so each file's globals must exist before the next one loads.** Reordering the script
tags breaks the build silently: a missing global is `undefined` at call time, not at parse time.

| File | Lines | Exposes | Role |
| --- | --- | --- | --- |
| [js/profile.js](../../js/profile.js) | ~370 | `PROFILE` | the local player profile - up to three characters (name, class, look, stats), which kinds it has held, the settings - and the only file that touches storage |
| [js/font.js](../../js/font.js) | ~100 | `drawPixelText`, `drawPixelTextShadow`, `drawPixelTextOutline`, `pixelTextWidth` | the bitmap font |
| [js/sprites/core.js](../../js/sprites/core.js) | ~120 | `SPRITES`, `SPR` | the empty sprite registry and the bake helpers (`bake`/`bakeSpan`/`flipH`/`bakeClips`/`liveIcon`/`wash`/`double`) plus the `TEAM_SKINS` table; every other sprite file is a private IIFE that bakes its grids and `Object.assign`s the keys it owns into `SPRITES` |
| [js/sprites/characters.js](../../js/sprites/characters.js) | ~900 | → `SPRITES` | the player body plan in every team paint, the skater, the prone poses, the fish catch, the raider, the merchant, and `champLook` - a character's tone and fringe on the class body |
| [js/sprites/looks.js](../../js/sprites/looks.js) | ~380 | → `SPRITES` | the 48 px character model: body, head, beard, hair and class-outfit layers composed per character (`portrait`) |
| [js/sprites/terrain.js](../../js/sprites/terrain.js) | ~1320 | → `SPRITES` | the pine and its 24 wind frames + the one atlas, stumps, rocks, ore, the mine, the bush, the dead snags, the den |
| [js/sprites/beasts.js](../../js/sprites/beasts.js) | ~1290 | → `SPRITES` | the imp, rabbit, deer, wolf and bird clips, and the camps' alpha and dire wolf derived from the wolf |
| [js/sprites/eagle.js](../../js/sprites/eagle.js) | ~200 | → `SPRITES` | the eagle's flap frames, each side's armour, the hit flash and the shadow |
| [js/sprites/buildings.js](../../js/sprites/buildings.js) | ~560 | → `SPRITES` | wall/turret/generator/spawner in three tiers and each side's fittings, the net, scaffold, bay, worker bots, spikes, fire, torch |
| [js/sprites/items.js](../../js/sprites/items.js) | ~750 | → `SPRITES` | goods and their icons: wood, stone, bag, the three animated goods and their live icons, the sack, the crate, the cards, the axe/bow/pick |
| [js/sprites/icons.js](../../js/sprites/icons.js) | ~340 | → `SPRITES` | HUD art: the gear glyphs in four materials, the hearts, the cursor set |
| [js/sfxdata.js](../../js/sfxdata.js) | ~60 | `SFXDATA` | **generated** — the sfx bank as base64 |
| [js/audio.js](../../js/audio.js) | ~780 | `SFX` | synth, samples and music under one master dial |
| [js/logodata.js](../../js/logodata.js) | ~6 | `LOGO_PNG` | **generated** — the title logo as a PNG data URL |
| [js/core.js](../../js/core.js) | ~520 | shared scope, no `window.*` export | the base layer: the numbers with no one owner (grid, view, day cycle, `YIELD`), the seeded rng, `state`/`settings`, the fx/economy helpers |
| [js/canvas.js](../../js/canvas.js) | ~270 | shared scope, no `window.*` export | screen + world + light buffers, `fitCanvas`, pixel-exact zoom, the panel layout anchors |
| [js/player.js](../../js/player.js) | ~1010 | shared scope, no `window.*` export | the `Player` class and the ten of them, classes/kits/gear/cards, the entity arrays, damage & death |
| [js/input.js](../../js/input.js) | ~1000 | shared scope, no `window.*` export | the physical-key translation and the binds (`keyName`, `KEY_ACTIONS`, `binds()` over the two schemes' maps, `keyIs`/`keyHeld`/`keyCap`, the rebind), `keys`/`mouse`, the listeners, and the four entry points every controller shares (`keyPress`/`keyRelease`, `pointerPress`/`pointerRelease`) plus the bare gestures (`fireDown`/`fireUp`, `openFlagWheel`, `openWheelNear`, `panelScrollBy`); `sampleHumanInput` folds keys, mouse and both sticks into the input struct |
| [js/gamepad.js](../../js/gamepad.js) | ~320 | shared scope, no `window.*` export | a pad as the keyboard and mouse it stands in for: the standard-mapping tables, `padPoll` (once per frame from `loop()`), the play set and the menu set |
| [js/world.js](../../js/world.js) | ~2030 | shared scope, no `window.*` export | the tile grid, the `OBJECTS` table every kind of scenery is an entry in, worldgen, the road down the diagonal, the camps at their fixed mirrored sites, and the practice training grounds |
| [js/nav.js](../../js/nav.js) | ~320 | shared scope, no `window.*` export | `moveEntity`, `separateUnits`, and A* routing (`findPath`/`navTo`/`navStep`) |
| [js/wildlife.js](../../js/wildlife.js) | ~910 | shared scope, no `window.*` export | prey, the fish shoal, the camps' monsters (and the dormant flock) |
| [js/structures.js](../../js/structures.js) | ~530 | shared scope, no `window.*` export | the `STRUCTS` table, building/upgrading/wrecking, and the per-type building sim |
| [js/robots.js](../../js/robots.js) | ~990 | shared scope, no `window.*` export | the worker bots a bay rolls out, the eagle's merchant and the barracks it raises, the soldiers a barracks marches down the road, and the one flag per player whose tile is their standing order |
| [js/actions.js](../../js/actions.js) | ~1020 | shared scope, no `window.*` export | what a player does: the swing tools and harvesting, the roll as a hit, prone — and, under its own banner, the damage types and status effects **every** kind of unit shares |
| [js/tools.js](../../js/tools.js) | ~1490 | shared scope, no `window.*` export | the weapon: the `TOOLS` and `BITS` tables, what a press fires, how each bit flies, the loot rolls, the tech tree, and the icons for both |
| [js/abilities.js](../../js/abilities.js) | ~1310 | shared scope, no `window.*` export | the class abilities on keys 1-4: the `CLASS_AB` table, casting, the pierce/net/grapple/snow-cover/shield-and-slam/rush/crater/execute sim, the telegraph and landing shapes every side sees, and their draw passes |
| [js/ai.js](../../js/ai.js) | ~1060 | shared scope, no `window.*` export | the bot brain — a priority ladder writing the same input struct a human fills |
| [js/sim.js](../../js/sim.js) | ~1340 | shared scope, no `window.*` export | `update`/`updatePlay`/`updatePlayer`, the camera (`camX`/`camY`), fx aging, the snow |
| [js/net/events.js](../../js/net/events.js) | ~80 | shared scope, no `window.*` export | the sim's cosmetics on their way to the screen: `sfxAt`/`sfxFor`/`sfxOwn`/`shakeAt`/`shakeFor`, the ring a host records them into (`evPush`/`evDrain`, only inside the step and only with `evRecord` on - solo records nothing) and `evPlay`, the client's replay of one entry. The online plan the js/net/ files follow: [docs/pvp-architecture.md](../pvp-architecture.md) |
| [js/net/net.js](../../js/net/net.js) | ~420 | shared scope, no `window.*` export | `NET`: this screen's role (`solo` / `host` / `client`; `isHost` is "am I simulating?"), `isHuman`, the five-call transport interface and its loopback, and the match protocol (`netHostStep`/`netHostFlush`, `netClientStep`/`netClientMode`; `RECONNECT_GRACE`, `SNAP_EVERY`) - the detail: [code-map](code-map.md) |
| [js/net/snapshot.js](../../js/net/snapshot.js) | ~810 | shared scope, no `window.*` export | the match's authoritative state as one plain object (`snapBuild`/`snapApply`, refs packed to kind+id tokens by `pack`), its wire form (`snapBuildDelta`/`snapApplyDelta` against a shadow of the last send, `snapEncode`/`snapDecode` binary with a shared key dictionary) and the proofs (`netEcho`, `netEchoRun`, `netDeltaRun`: render, send through the bytes, render again, count differing pixels) |
| [js/net/transport-ws.js](../../js/net/transport-ws.js) | ~90 | shared scope, no `window.*` export | the transport for tabs on one machine: the dev server's relay over a WebSocket, JSON frames, a client redialing every `WS_RETRY` s with the same uid |
| [js/net/transport-steam.js](../../js/net/transport-steam.js) | ~190 | shared scope, no `window.*` export | the transport for the wrapper: a Steam lobby is the room and its owner the host, packets peer to peer through `window.steamBridge` - text reliable in parts over `STEAM_CHUNK`, a lossy delta as binary frames on the unreliable channel under its 1200-byte cap, dropped whole when a part never comes - a joiner reloading onto the lobby's seed |
| [js/draw/ground.js](../../js/draw/ground.js) | ~330 | shared scope, no `window.*` export | `hash2`/`vnoise`, the prerendered ground and its runtime repaints, the road's pixels, the scenery bakes (the pine's wind frame, the chest, the cairn) - first of the draw files, every other one calls `hash2` |
| [js/draw/practice.js](../../js/draw/practice.js) | ~740 | shared scope, no `window.*` export | the practice arena's pixels only: the dummy and its meter, the training grounds, the ice parkour, the roll station, the archery track and the range bell |
| [js/draw/zipline.js](../../js/draw/zipline.js) | ~110 | shared scope, no `window.*` export | the zipline's pixels: the pylon bakes (one per team skin), the cable pass `drawZips` and a rider's handle and rope `drawZipHandle` (the thing itself: the `zipline` banner, world.js) |
| [js/draw/overhead.js](../../js/draw/overhead.js) | ~200 | shared scope, no `window.*` export | the one arrow body, and the frame every unit wears over its head: health bar, level badge, sense mark, stun stars, the build reveal |
| [js/draw/structs.js](../../js/draw/structs.js) | ~240 | shared scope, no `window.*` export | a building's pixels: the turret's rotating half and bolts, the bay and barracks overlays, the net, `structSprite`/`drawTiledStruct` |
| [js/draw/bodies.js](../../js/draw/bodies.js) | ~710 | shared scope, no `window.*` export | every walking thing's sprite pass: a beast on its clip, a robot, the merchant, and `drawPlayer` with its gear marks, buff ring, snow cover, burial, ghost and held tool |
| [js/draw/marks.js](../../js/draw/marks.js) | ~200 | shared scope, no `window.*` export | the glyph grammar both maps share: a camp's icon and clock, the flag family, what a body looks like as a dot |
| [js/draw/light.js](../../js/draw/light.js) | ~680 | shared scope, no `window.*` export | light and weather over the finished frame: specks, cloud shadows, god rays, the reflected sky, and the pass that grades day into night |
| [js/draw/render.js](../../js/draw/render.js) | ~1460 | shared scope, no `window.*` export | `render()` composes and blits the frame; the `.` debug overlays; cursor, reticle and aim line |
| [js/ui/wheel.js](../../js/ui/wheel.js) | ~800 | shared scope, no `window.*` export | the HUD in world space: the radial wheel and `runCmd`, the selection brackets, key and pad prompts, the work/rack/bell/shop hints, the build list (its hammer plate, its column, the piece on the pointer) and its ghost |
| [js/ui/minimap.js](../../js/ui/minimap.js) | ~230 | shared scope, no `window.*` export | the minimap: its rebuilt disc, masks, chrome and view arc, `renderMinimap` |
| [js/ui/bag.js](../../js/ui/bag.js) | ~670 | shared scope, no `window.*` export | the backpack drawer's geometry and hit tests, `overHud`, the drag verbs and what a gesture answers with, the character panel, the SHIFT plate, `drawBag` |
| [js/ui/strip.js](../../js/ui/strip.js) | ~640 | shared scope, no `window.*` export | the hud strip's bones: its constants, the hud frame, HUD SIZE, every cell rect and refusal flash, the weapon shelf's geometry and drops, sending a cell across, the drag's press/move/release |
| [js/ui/hud-draw.js](../../js/ui/hud-draw.js) | ~740 | shared scope, no `window.*` export | drawing the strip and the shelf: the xp bar, tier and mod plates, item icons, the cooldown sweep, the ability/pouch/food/gold cells, `drawHudStrip`, the scaled bakes, the shelf's wells, the drag ghost |
| [js/ui/rail.js](../../js/ui/rail.js) | ~150 | shared scope, no `window.*` export | the team rail along the top edge, and the anchors the screens hang under it |
| [js/ui/tooltip.js](../../js/ui/tooltip.js) | ~440 | shared scope, no `window.*` export | the hover tooltip: `tipAt`, `tipPos` and `drawTooltip` |
| [js/ui/compose.js](../../js/ui/compose.js) | ~150 | shared scope, no `window.*` export | `renderUI`, the frame's UI pass in order |
| [js/ui/shop.js](../../js/ui/shop.js) | ~1680 | shared scope, no `window.*` export | the merchant's counter: the fish/berry market and its three-day history, the rolled stock and its turnover, buying and selling, and the panel all three are read on |
| [js/ui/panels.js](../../js/ui/panels.js) | ~1210 | shared scope, no `window.*` export | the TAB scoreboard + the (undrawn) event log, the M world map, the ESC settings slab |
| [js/ui/menu.js](../../js/ui/menu.js) | ~3210 | shared scope, no `window.*` export | the title screen: menu planks, reroll die, tutorial + patch panels, class select, the gear pop-up, the tech tree screen, `PATCH_TXT` |
| [js/ui/chars.js](../../js/ui/chars.js) | ~580 | shared scope, no `window.*` export | the character roster, the create / customize screen, and the title's character tag |
| [js/ui/screens.js](../../js/ui/screens.js) | ~1380 | shared scope, no `window.*` export | the replay window, the death overlay and spectating, the victory and defeat ceremonies |
| [js/ui/lobby.js](../../js/ui/lobby.js) | ~470 | shared scope, no `window.*` export | the post-game lobby: the match's own record, and the sampling during play its graphs are drawn from |
| [js/boot.js](../../js/boot.js) | ~1840 | `DBG` + shared scope | the last file to load: the eagle drop (the corner roosts, the spur, the drop brief), the boot order, `window.DBG`, the rAF loop and the fixed 1/60 s step it feeds the sim |

Line counts are approximate on purpose; they are here for a sense of scale, not to be maintained.

### Shared global scope

The game code is **not** wrapped in an IIFE (the sprite files under js/sprites/ are the
deliberate exception, each a private IIFE registering into `SPRITES`).
It is flat top-level code in classic scripts: a top-level `function` declaration becomes a
`window` property, and a top-level `let`/`const` becomes a global lexical binding visible **as a
bare identifier** to every classic script loaded after it. That is the whole mechanism: a
section moves between files verbatim and its bare identifiers keep resolving, with no export
lists and no namespace. ES modules are off the table because `file://` must keep working. The
tag `pre-split` keeps the one-file history.

- **Load-order rule**: a file may reference names from any file at runtime, but its top-level
  (load-time) statements may only reference names from files loaded above it.
- **Collision behavior**: a `let`/`const` declared in two files throws a `SyntaxError` at load
  (loud, good); a `function` declared in two files silently overwrites (silent, bad) — so grep
  for a duplicate top-level name before adding or moving a function.
- **Performance**: the file count changes nothing at runtime — same total parse, same JIT. The
  files are for maintainability, a sim/render seam, and files a session can load whole.

### profile.js

The local player profile — up to `CHAR_MAX` (3) **characters** in `chars` with `active`
naming the one the local player wears (each `{ name, cls, look, stats, born }`: the class is
fixed at creation, `look` is an index per axis of `LOOK_N` — `sex`, `tone`, `hair`,
`hairCol`, `beard`, `face` — and `stats` the character's own `wins` / `matches` / `gold` /
`days` / `kills` / `deaths`), the
one-shot `dropped` flag (`hasDropped()`/`markDropped()`: has this profile ever jumped off the
eagle, gating the scripted first flight that rides the landing), `bestLap`
(`bestLap()`/`setBestLap()`: the ice parkour's all-time record) and `bestRange`
(`bestRange()`/`setBestRange()`: the archery round's best score) — the only two things the
practice arena writes ([world.md](world.md#the-practice-arena)) — the
[arsenal](gameplay.md#the-wiki)'s `tech.seen` (the wiki's "held one" pips; `tech.done` rides along unread) and the
`settings` object — as one JSON blob under
`softfall.profile`. It is the only file that touches `localStorage` (the CLAUDE.md rule):
swapping the private `read()` / `write()` pair for requests turns the
local profile into a server account without touching the game code.
There are no accounts, no passwords and no sign-in, and nothing here is authoritative — a save
file is a save file.

- **`PROFILE.load()`** repairs a partial or corrupt save against a blank profile rather than
  throwing (`mendChar`/`mendLook` repair each slot axis by axis: a class or look index out of
  range lands on 0, a bad name is re-rolled) and migrates older saves in place (a pre-profile
  `softfall.settings` key is folded in once and removed; a v1 save's `name` + `stats` become its
  first character). Boot calls it
  **before `loadSettings()`**, which reads `PROFILE.settings()`. **A fresh install has no
  character** (`hasChar()` false) and boot opens the create screen before the title.
- **The character calls**: `chars()`, `activeIndex()`, `char()`, `rollChar(cls)` (a fresh
  unsaved spec with a random name and look), `createChar(spec)` (into the next free slot, made
  active; `{ ok: false, why: 'FULL' }` past three), `updateChar(i, spec)` (name and look only —
  the class in the spec is ignored), `deleteChar(i)`, `setActive(i)`. `LOOK_N` and `CLASS_N`
  are exported so js/sprites/looks.js can assert its tables against them at load.
- **`PROFILE.validate(raw)`** is the one name validator: trimmed, uppercased, `A-Z0-9` only, 16
  characters, and a basic profanity list matched after the obvious digit-for-letter swaps are
  folded out. It returns `{ ok, name }` or `{ ok: false, why }`. **A character always has a
  name**: a new one is pre-rolled from `NAME_POOL` — winter words, every one clean under the
  validator — so the create screen opens on a name rather than a blank.
- **The stat calls coalesce, and land on the active character.** `addGold` fires on every
  payout, `addWin` once per `endMatch('won')`, `addMatch` and `addDay` at eagle takeoff (and
  `addDay` at each dawn the local player is still in), `addKill`/`addDeath` from `die()`, so
  writes are batched behind an 800 ms timer and flushed on `pagehide` / `visibilitychange`;
  the character calls and `putSettings` write through immediately.
- **The tech lists are ids and nothing else.** `markSeen` coalesces (it fires from a pickup) and is
  the only writer: `tech.done` is carried through load and save untouched and read by nothing
  (the whole arsenal is unlocked). `load()` copies only strings and de-duplicates, so a
  hand-edited save cannot put a number or a repeat into the lists. What a node *is* lives in
  js/tools.js — this file only remembers.

The screens and the title-screen tag are js/ui/chars.js; the local player takes a character on
through `applyCharacter()` (js/player.js).

### font.js

A 3×5 bitmap font, **uppercase only** — an unknown character renders as `?`, so a lowercase
string silently comes out as a row of question marks. Four exports: `drawPixelText` (plain),
`drawPixelTextShadow` (one bottom-right 1 px shadow), `drawPixelTextOutline` (a 1 px rim on all
eight sides) and `pixelTextWidth` for layout.

**The string cache.** A frame draws a few hundred strings, and stamping each one glyph pixel
by glyph pixel (nine times over for an outline) cost a quarter of the frame at 1080p. So
`raster` is called only by `bake`: every string is drawn once per (kind, scale, colour, rim,
text) into its own small canvas and every draw after that is one `drawImage` (`stamp`). The
pixels are opaque and the canvas transparent around them, so `globalAlpha`, the composite
mode and the UI pass's `devScale` transform land on it exactly as they landed on the rects;
an outlined string under a fade therefore fades evenly, and the rim colour need not be
opaque. The cache is dropped whole at `CACHE_MAX` (2048) strings — a clock retires one a
second, never thousands.

**Which one to use is a rendering rule, not a taste call** (the CLAUDE.md hard rule): a rim
over the world, a shadow on a panel. The site-by-site list:
[rendering.md](rendering.md#text-over-the-world).

See [Intentional dead code](checklists.md#intentional-dead-code) before deleting a glyph that looks unused (`<`).

### js/sprites/

Literal ASCII grids paired with palette objects, baked to offscreen canvases by `bake()` at load.
Nine files: `core.js` loads first and makes the empty `window.SPRITES` registry and `window.SPR`
(the bake helpers); each of the eight art files is a **private IIFE** that ends with
`Object.assign(SPRITES, { ... })` for the keys it owns - the same move js/tools.js makes for its
tool and bit art - so they load in any order after core and nothing reads another file's grid.
Team colours, classes and building tiers are all palette swaps of shared grids, which
is why a pose edit propagates further than it looks. The helper list, the byte-fragile grid rule,
the 64×64 `drawSpriteFlash()` limit, which sprites share which grid and which file holds what:
[sprites.md](sprites.md#the-shape-of-a-sprite-file).

### sfxdata.js

Generated by `node app/bake-sfx.js`, which reads `audio/sfx/*.mp3` and writes each clip into
this file as base64. **The output is committed.** It exists because a `file://` page may not
`fetch` its own folder, so without the inlined bytes every sound effect silently falls back to
the synth when the game is opened off the disk. Rerun the baker after any change to
`audio/sfx/` and before committing.

### logodata.js

Generated by `node app/bake-logo.js` from `docs/media/logos/mainMenuSoftfall.png`: the word is
keyed out of its painted sky (a flood from the corners that stops at the letters' dark outline),
trimmed and box-filtered down four times to the size the title draws it at 1:1, and written as
one PNG data URL. **The output is committed.** A data URL rather than an `<img src>` because a
picture read off a `file://` path taints the canvas it lands on, and with it the shot sink and
every `getImageData`. Rerun the baker after replacing the picture.

Music is deliberately **not** baked: it is ~70 MB, and an `<audio>` element streams a relative
`file://` path perfectly well — only `fetch` is blocked.

### audio.js

Three layers under one master dial: a WebAudio synth for UI blips *and* as the fallback line
under every sampled cue, one-shot samples decoded out of `SFXDATA`, and `SFX.music` streaming
`audio/music/` through one `HTMLAudioElement` per track. Master / MUSIC / SOUNDS dials, the cue
list, the mixing targets and the track table: [gameplay.md](gameplay.md#audio).

Cues come in two grammars and the file is ordered by them: **world** cues, which are a thing on
the map making a noise and are pitch-jittered per shot, and the **notification** layer — the
market's four and the eighteen abstract cues under them — which are not, because each says *this
happened* and must arrive identical every time.

### The game files (core.js … boot.js, with js/draw/ and js/ui/)

Forty-three files of flat top-level code (see [Shared global scope](#shared-global-scope)), each
organized only by `// ------ name` banners; find any function by its banner in
[code-map.md](code-map.md).

**A file that decides things does not also draw them.** Every one of the sim files - core,
player, input, gamepad, world, nav, wildlife, structures, robots, actions, ai, sim -
contains zero canvas calls; the pixels for what they own live under **js/draw/** (the world) and
**js/ui/** (the HUD and the screens; the pad
glyphs: `drawPadGlyph`, js/ui/panels.js), so the folder is the boundary. canvas.js is the
exception that proves it: it owns the buffers themselves.

**A feature's tuning constants live in the file that owns the feature** (the CLAUDE.md rule) —
`MONSTER`/`CAMP_*` in wildlife.js, `TUR_*` in structures.js, `PRONE_*` in actions.js. What stays
in core.js: `TILE`/`WORLD`, the view size, the day cycle, and the `YIELD` economy table that
three files read.

The one rule that constrains a move: **a const is only visible to a file that loads after the one
declaring it**, so anything read at *load time* — an object literal, a top-level loop, a `const`
initialised from another — has to be declared no later than that. Reads inside a function are
free, because every function in the game runs long after the last script tag. Two constants sit
where they do only because of this: `FISH_SPAWN_T` (core.js, because `state`'s literal reads it)
and `BOW_CHARGE`/`BOW_NOCK`/`DODGE_SPEED`/`SLIDE_MIN` (player.js, because the `CLASSES` table
does). Each one says so in a comment; if you move a block and the console shows a
`ReferenceError` naming a constant on load, this is why.

`softfall.reroll` is the only storage key touched outside profile.js; sessionStorage by design
(write in menu.js, read in boot.js — survives the reload, not the tab).

Their only deliberate `window.*` export is `DBG`, the debug surface at the end of boot.js: live
singletons plus the helpers that stage a scene without playing to it. Read the object literal
for the current API — it is deliberately the whole external surface, and
[checklists.md](checklists.md#verifying-a-change) covers the non-obvious members.

## State

All game state lives in top-level singletons shared across the game files — `state` and
`settings` in core.js, `players`/`player`/`inv` and the entity arrays in player.js:

- **`state`** — the match: tick, day/time, darkness, mode, overlays (`state.mapOpen`, `state.msg`).
- **`settings`** — the player's dials, persisted **under the profile** (`PROFILE.putSettings`).
- **`players`** — the ten players. `player` and `inv` are aliases for **the local player only**
  (slot `localId`, 0 by default) and its gold-only wallet; carried goods are `player.bag` and the two meals the
  uncapped `player.food` pouch. See
  [multiplayer.md](multiplayer.md#the-ten-players).

Plus the flat arrays every pass iterates: `animals`, `arrows`, `drops`, `particles`, `floaters`,
`footprints`, `structures`, `robots`, `fish`, `camps`.

## desktop/

The Windows wrapper, and **the one folder with packages** (`package.json`: Electron and
steamworks.js; `npm install` once, `npm start`; `npm run build` is build.js: the game copied in
beside main.js, @electron/packager over it, a portable zip - what a `v*` tag's workflow attaches
to a Release; `npm run steam:stage` is steam-stage.js: that build unzipped into the Steamworks
SDK's `tools/ContentBuilder/content/` with `Softfall.exe` at the root and no steam_appid.txt,
for the SteamPipe upload Noah runs by hand). `main.js` opens one `BrowserWindow` on the same
`index.html` a browser opens - `backgroundThrottling` off, so a host keeps stepping behind another
window - initialises Steam on the App ID it resolves in this order: the `SteamAppId`/`SteamGameId`
environment variable (a build Steam launched), else `steam_appid.txt` beside main.js (Softfall's
own, 5244550, committed; the build copies it beside the exe), else Valve's Spacewar (480) - and
answers the bridge's IPC: lobbies (create / join / leave / list / data / invite), packets
(`send`, a pump reading Steam's P2P queue every 8 ms into the page), and the lobby callbacks as
events. `preload.js` exposes exactly that as `window.steamBridge` and nothing else of Node; the
game reads it only in js/net/transport-steam.js and at boot's role pick. Without Steam running
the bridge reports `ready: false` and the page plays solo. Flags: `--net=host`, `--join=LOBBYID`,
`--seed=N`, `--devtools`, and for a headless check `--shot=PATH --wait=S --quit`.

**main.js prefers `desktop/app/index.html` over `../index.html`**, and build.js is what fills
`desktop/app/` (the page, the code, the audio). A `desktop/app/` left over from an earlier build
therefore silently runs an **old game** under `npm start`: delete it, or rebuild, before judging a
change in the wrapper.

steamworks.js
0.4 exposes Steam's older P2P sockets (reliable packets to 1 MB, unreliable to 1200 bytes);
the transport chunks text above the first, and a
snapshot delta rides the second as numbered binary frames (`steamFrames`), the bridge carrying
bytes both ways ([docs/pvp-architecture.md](../pvp-architecture.md)).

## app/

None of the scripts is part of the game, and nothing in `js/` may depend on one having run — except
`sfxdata.js` and `logodata.js`, which two of them write.

- **`app/server.js`** — a static server on `http://localhost:8471` with a `POST /shot` sink that
  writes the canvas to `shot.png`, and the **match relay** at `/ws` (`role=host` is given a
  four-letter room code, `role=client&room=CODE` joins one, `role=list` is pushed the open rooms;
  `GET /ws-debug` lists them): a hand-rolled WebSocket server, since the repo takes no dependency
  - text frames, fragmentation, 64-bit lengths - that forwards a client's frames to its room's host
  and a host's to the client it names, and never reads a match. This is the server Noah runs to
  host a night of games, with the port forwarded; a browser at any address and the wrapper both
  reach it (`netRelay`, js/net/net.js). It answers **Range requests**, which is why music seeks work
  when served; a plain 200 makes an `<audio>` element treat a multi-MB mp3 as an unbounded stream.
  Its single `ROOT` const carries the static root, the traversal guard and the shot sink alike.
- **`app/bake-sfx.js`** — reads `audio/sfx/`, writes `js/sfxdata.js`.
- **`app/bake-logo.js`** — reads `docs/media/logos/mainMenuSoftfall.png`, writes `js/logodata.js`
  (`--probe` prints the key's box without writing).
