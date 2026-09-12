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
| [js/sprites/characters.js](../../js/sprites/characters.js) | ~890 | → `SPRITES` | the player body plan in every team paint, the skater, the prone poses, the fish catch, the raider, the merchant, and `champLook` - a character's tone and fringe on the class body |
| [js/sprites/looks.js](../../js/sprites/looks.js) | ~380 | → `SPRITES` | the 48 px character model: body, head, beard, hair and class-outfit layers composed per character (`portrait`) |
| [js/sprites/terrain.js](../../js/sprites/terrain.js) | ~1320 | → `SPRITES` | the pine and its 24 wind frames + the one atlas, stumps, rocks, ore, the mine, the bush, the dead snags, the den |
| [js/sprites/beasts.js](../../js/sprites/beasts.js) | ~1290 | → `SPRITES` | the imp, rabbit, deer, wolf and bird clips, and the camps' alpha and dire wolf derived from the wolf |
| [js/sprites/eagle.js](../../js/sprites/eagle.js) | ~200 | → `SPRITES` | the eagle's flap frames, each side's armour, the hit flash and the shadow |
| [js/sprites/buildings.js](../../js/sprites/buildings.js) | ~560 | → `SPRITES` | wall/turret/generator/spawner in three tiers and each side's fittings, the net, scaffold, bay, worker bots, spikes, fire, torch |
| [js/sprites/items.js](../../js/sprites/items.js) | ~750 | → `SPRITES` | goods and their icons: wood, stone, bag, the three animated goods and their live icons, the sack, the crate, the cards, the axe/bow/pick |
| [js/sprites/icons.js](../../js/sprites/icons.js) | ~340 | → `SPRITES` | HUD art: the gear glyphs in four materials, the hearts, the cursor set |
| [js/sfxdata.js](../../js/sfxdata.js) | ~40 | `SFXDATA` | **generated** — the sfx bank as base64 |
| [js/audio.js](../../js/audio.js) | ~570 | `SFX` | synth, samples and music under one master dial |
| [js/core.js](../../js/core.js) | ~250 | shared scope, no `window.*` export | the base layer: the numbers with no one owner (grid, view, day cycle, `YIELD`), the seeded rng, `state`/`settings`, the fx/economy helpers |
| [js/mobile.js](../../js/mobile.js) | ~70 | shared scope, no `window.*` export | phones: whether this is one (`MOBILE`, the TOUCH MODE setting over the device's answer), the overlays' footprint a phone's fit keeps, the portrait test, the fullscreen ask. Before canvas.js because `fitCanvas` asks it at load |
| [js/canvas.js](../../js/canvas.js) | ~260 | shared scope, no `window.*` export | screen + world + light buffers, `fitCanvas` (a phone branch: the biggest game pixel the overlays allow, no 16:9 cap), pixel-exact zoom, the panel layout anchors |
| [js/player.js](../../js/player.js) | ~880 | shared scope, no `window.*` export | the `Player` class and the ten of them, classes/kits/gear/cards, the entity arrays, damage & death |
| [js/input.js](../../js/input.js) | ~560 | shared scope, no `window.*` export | the physical-key translation and the binds (`keyName`, `KEY_ACTIONS`, `binds()` over the two schemes' maps, `keyIs`/`keyHeld`/`keyCap`, the rebind), `keys`/`mouse`, the listeners, and the four entry points every controller shares (`keyPress`/`keyRelease`, `pointerPress`/`pointerRelease`) plus the bare gestures (`fireDown`/`fireUp`, `flagDown`/`flagUp`, `openWheelNear`, `panelScrollBy`); `sampleHumanInput` folds keys, mouse and both sticks into the input struct |
| [js/gamepad.js](../../js/gamepad.js) | ~200 | shared scope, no `window.*` export | a pad as the keyboard and mouse it stands in for: the standard-mapping tables, `padPoll` (once per frame from `loop()`), the play set and the menu set |
| [js/touch.js](../../js/touch.js) | ~230 | shared scope, no `window.*` export | fingers: the two floating sticks, the plates' table and layout, a finger as the mouse everywhere else; `touchPoll` (from `loop()`) |
| [js/world.js](../../js/world.js) | ~1650 | shared scope, no `window.*` export | the tile grid, the `OBJECTS` table every kind of scenery is an entry in, worldgen, the road down the diagonal, the camps at their fixed mirrored sites, and the practice training grounds |
| [js/nav.js](../../js/nav.js) | ~310 | shared scope, no `window.*` export | `moveEntity`, `separateUnits`, and A* routing (`findPath`/`navTo`/`navStep`) |
| [js/wildlife.js](../../js/wildlife.js) | ~600 | shared scope, no `window.*` export | prey, the fish shoal, the camps' monsters (and the dormant flock) |
| [js/structures.js](../../js/structures.js) | ~500 | shared scope, no `window.*` export | the `STRUCTS` table, building/upgrading/wrecking, and the per-type building sim |
| [js/robots.js](../../js/robots.js) | ~900 | shared scope, no `window.*` export | the worker bots a bay rolls out, the eagle's merchant and the barracks it raises, the soldiers a barracks marches down the road, and the one flag per player whose tile is their standing order |
| [js/actions.js](../../js/actions.js) | ~830 | shared scope, no `window.*` export | what a player does: the swing tools and harvesting, the roll as a hit, prone — and, under its own banner, the damage types and status effects **every** kind of unit shares |
| [js/tools.js](../../js/tools.js) | ~760 | shared scope, no `window.*` export | the weapon: the `TOOLS` and `BITS` tables, what a press fires, how each bit flies, the loot rolls, the tech tree, and the icons for both |
| [js/abilities.js](../../js/abilities.js) | ~640 | shared scope, no `window.*` export | the class abilities on keys 1-4: the `CLASS_AB` table, casting, the pierce/net/grapple/snow-cover/shield-and-slam/rush/crater/execute sim, the telegraph and landing shapes every side sees, and their draw passes |
| [js/ai.js](../../js/ai.js) | ~380 | shared scope, no `window.*` export | the bot brain — a priority ladder writing the same input struct a human fills |
| [js/sim.js](../../js/sim.js) | ~810 | shared scope, no `window.*` export | `update`/`updatePlay`/`updatePlayer`, the camera (`camX`/`camY`), fx aging, the snow |
| [js/draw/ground.js](../../js/draw/ground.js) | ~330 | shared scope, no `window.*` export | `hash2`/`vnoise`, the prerendered ground and its runtime repaints, the road's pixels, the scenery bakes (the pine's wind frame, the chest, the cairn) - first of the draw files, every other one calls `hash2` |
| [js/draw/practice.js](../../js/draw/practice.js) | ~740 | shared scope, no `window.*` export | the practice arena's pixels only: the dummy and its meter, the training grounds, the ice parkour, the roll station, the archery track and the range bell |
| [js/draw/overhead.js](../../js/draw/overhead.js) | ~200 | shared scope, no `window.*` export | the one arrow body, and the frame every unit wears over its head: health bar, level badge, sense mark, stun stars, the build reveal |
| [js/draw/structs.js](../../js/draw/structs.js) | ~240 | shared scope, no `window.*` export | a building's pixels: the turret's rotating half and bolts, the bay and barracks overlays, the net, `structSprite`/`drawTiledStruct` |
| [js/draw/bodies.js](../../js/draw/bodies.js) | ~710 | shared scope, no `window.*` export | every walking thing's sprite pass: a beast on its clip, a robot, the merchant, and `drawPlayer` with its gear marks, buff ring, snow cover, burial, ghost and held tool |
| [js/draw/marks.js](../../js/draw/marks.js) | ~160 | shared scope, no `window.*` export | the glyph grammar both maps share: a camp's icon and clock, the flag family, what a body looks like as a dot |
| [js/draw/light.js](../../js/draw/light.js) | ~590 | shared scope, no `window.*` export | light and weather over the finished frame: specks, cloud shadows, god rays, the reflected sky, and the pass that grades day into night |
| [js/draw/render.js](../../js/draw/render.js) | ~1480 | shared scope, no `window.*` export | `render()` composes and blits the frame; the `.` debug overlays; cursor, reticle and aim line |
| [js/ui/wheel.js](../../js/ui/wheel.js) | ~650 | shared scope, no `window.*` export | the HUD in world space: the radial wheel and `runCmd`, the selection brackets, key and pad prompts, the work/rack/bell/shop hints, the build list and its ghost |
| [js/ui/minimap.js](../../js/ui/minimap.js) | ~200 | shared scope, no `window.*` export | the minimap: its rebuilt disc, masks, chrome and view arc, `renderMinimap` |
| [js/ui/bag.js](../../js/ui/bag.js) | ~670 | shared scope, no `window.*` export | the backpack drawer's geometry and hit tests, `overHud`, the drag verbs and what a gesture answers with, the character panel, the SHIFT plate, `drawBag` |
| [js/ui/strip.js](../../js/ui/strip.js) | ~640 | shared scope, no `window.*` export | the hud strip's bones: its constants, the hud frame, HUD SIZE, every cell rect and refusal flash, the weapon shelf's geometry and drops, sending a cell across, the drag's press/move/release |
| [js/ui/hud-draw.js](../../js/ui/hud-draw.js) | ~740 | shared scope, no `window.*` export | drawing the strip and the shelf: the xp bar, tier and mod plates, item icons, the cooldown sweep, the ability/pouch/food/gold cells, `drawHudStrip`, the scaled bakes, the shelf's wells, the drag ghost |
| [js/ui/rail.js](../../js/ui/rail.js) | ~150 | shared scope, no `window.*` export | the team rail along the top edge, and the anchors the screens hang under it |
| [js/ui/tooltip.js](../../js/ui/tooltip.js) | ~420 | shared scope, no `window.*` export | the hover tooltip: `tipAt`, `tipPos` and `drawTooltip` |
| [js/ui/compose.js](../../js/ui/compose.js) | ~140 | shared scope, no `window.*` export | `renderUI`, the frame's UI pass in order |
| [js/ui/touch-plates.js](../../js/ui/touch-plates.js) | ~140 | shared scope, no `window.*` export | the pixels of a phone's controls: the plates, the two sticks, the rotate prompt |
| [js/ui/shop.js](../../js/ui/shop.js) | ~1640 | shared scope, no `window.*` export | the merchant's counter: the fish/berry market and its three-day history, the rolled stock and its turnover, buying and selling, and the panel all three are read on |
| [js/ui/panels.js](../../js/ui/panels.js) | ~1220 | shared scope, no `window.*` export | the TAB scoreboard + the (undrawn) event log, the M world map, the ESC settings slab |
| [js/ui/menu.js](../../js/ui/menu.js) | ~2930 | shared scope, no `window.*` export | the title screen: menu planks, reroll die, tutorial + patch panels, class select, the gear pop-up, the tech tree screen, `PATCH_TXT` |
| [js/ui/chars.js](../../js/ui/chars.js) | ~460 | shared scope, no `window.*` export | the character roster, the create / customize screen, and the title's character tag |
| [js/ui/screens.js](../../js/ui/screens.js) | ~1370 | shared scope, no `window.*` export | the replay window, the death overlay and spectating, the victory and defeat ceremonies |
| [js/boot.js](../../js/boot.js) | ~1330 | `DBG` + shared scope | the last file to load: the eagle drop (the corner roosts, the spur, the drop brief), the boot order, `window.DBG`, the rAF loop |

Line counts are approximate on purpose; they are here for a sense of scale, not to be maintained.

### Shared global scope

The game code is **not** wrapped in an IIFE (it was, until the split began — tag `pre-split`; the
sprite files under js/sprites/ are the deliberate exception, each a private IIFE registering into
`SPRITES`).
It is flat top-level code in classic scripts: a top-level `function` declaration becomes a
`window` property, and a top-level `let`/`const` becomes a global lexical binding visible **as a
bare identifier** to every classic script loaded after it. That is the whole splitting mechanism
— sections moved between files verbatim and bare identifiers kept resolving, with no export
lists and no namespace. ES modules are off the table because `file://` must keep working. The
split is complete; the tag `pre-split` keeps the one-file history.

- **Load-order rule**: a file may reference names from any file at runtime, but its top-level
  (load-time) statements may only reference names from files loaded above it.
- **Collision behavior**: a `let`/`const` declared in two files throws a `SyntaxError` at load
  (loud, good); a `function` declared in two files silently overwrites (silent, bad) — which is
  why the split's Gate A greps for duplicate top-level names before every commit.
- **Performance**: splitting changes nothing at runtime — same total parse, same JIT. The split
  is for maintainability, a sim/render seam, and files a session can load whole.

### profile.js

The local player profile — up to `CHAR_MAX` (3) **characters** in `chars` with `active`
naming the one the local player wears (each `{ name, cls, look, stats, born }`: the class is
fixed at creation, `look` is an index per axis of `LOOK_N` — `sex`, `tone`, `hair`,
`hairCol`, `beard`, `face` — and `stats` the character's own `wins` / `matches` / `gold` /
`days` / `kills` / `deaths`), the
one-shot `dropped` flag (`hasDropped()`/`markDropped()`: has this profile ever jumped off the
eagle, gating the scripted first flight that rides the landing), the one-shot `practice` flag
(`practiceOpen()`/`markPractice()`: has the PRACTICE TOOL plank's ice been broken — three
knocks at the title, after which the plank stays a live menu item), `bestLap`
(`bestLap()`/`setBestLap()`: the ice parkour's all-time record, the one thing the practice
arena writes — [world.md](world.md#the-practice-arena)), the
[arsenal](gameplay.md#the-wiki)'s `tech.seen` (the wiki's "held one" pips; `tech.done` rides along unread) and the
`settings` object that used to live under a key of its own — as one JSON blob under
`softfall.profile`. **It is the only file in the project that touches `localStorage`**, and that
is the whole point of it: swapping the private `read()` / `write()` pair for requests turns the
local profile into a server account without touching the game code.
There are no accounts, no passwords and no sign-in, and nothing here is authoritative — a save
file is a save file.

- **`PROFILE.load()`** repairs a partial or corrupt save against a blank profile rather than
  throwing (`mendChar`/`mendLook` repair each slot axis by axis: a class or look index out of
  range lands on 0, a bad name is re-rolled), folds a pre-profile `softfall.settings` key in on
  the way past (once, then removes it), and turns a **v1 save's** one `name` + `stats` into its
  first character (a hunter with a rolled look; the numbers are the point). Boot calls it
  **before `loadSettings()`**, which now reads `PROFILE.settings()`. **A fresh install has no
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
  the character calls and `putSettings` write through immediately. A save written with the old `games` /
  `bestDay` pair keeps its gold and starts wins and days at zero — those were different
  numbers, not a rename.
- **The tech lists are ids and nothing else.** `markSeen` coalesces (it fires from a pickup) and is
  the only writer left: `tech.done` is what a pre-PATCH-2.08 save had researched, carried through
  load and save so a veteran's record survives, read by nothing now that the whole arsenal is
  unlocked. `load()` copies only strings and
  de-duplicates, so a hand-edited save cannot put a number or a repeat into the tree, and a save
  written before the tree existed simply arrives without them. What a node *is*, what it costs and
  what unlocking one does to a match are all in js/tools.js — this file only remembers.

The screens and the title-screen tag are js/ui/chars.js; the local player takes a character on
through `applyCharacter()` (js/player.js).

### font.js

A 3×5 bitmap font, **uppercase only** — an unknown character renders as `?`, so a lowercase
string silently comes out as a row of question marks. Four exports: `drawPixelText` (plain),
`drawPixelTextShadow` (one bottom-right 1 px shadow), `drawPixelTextOutline` (a 1 px rim on all
eight sides) and `pixelTextWidth` for layout.

**Which one to use is a rendering rule, not a taste call** — text over the world uses `Outline`,
text on a panel or plank uses `Shadow`, and anything drawn under a `globalAlpha` fade must use
`Shadow` because the outline's eight overlapping passes stack unevenly. The full reasoning and
the site-by-site list is in [rendering.md](rendering.md#text-over-the-world).

`<` was added for a resolution cycle that no longer exists — see
[Known drift](checklists.md#known-drift) before deleting a glyph that looks unused.

### js/sprites/

Literal ASCII grids paired with palette objects, baked to offscreen canvases by `bake()` at load.
`core.js` loads first: it makes the empty `window.SPRITES` registry and `window.SPR`, the helpers
(`bake`, `spansOf`, `bakeSpan`, `flipH`, `bakeClips`, `mapClips`, `liveIcon`, `wash`, `double`) plus
the `TEAM_SKINS` table and `teamBuildPal`. Every other file in the folder is a **private IIFE** that
destructures what it needs off `SPR`, keeps its grids and palettes to itself, and ends with
`Object.assign(SPRITES, { ... })` for the keys it owns - the same move js/tools.js makes for its
tool and bit art - so the seven art files load in any order after core and nothing reads another
file's grid. Team colours, classes and building tiers are all palette swaps of shared grids, which
is why a pose edit propagates further than it looks. The grids are **pure ASCII, byte-fragile art**:
move a row whole, never re-wrap or re-indent one. All of it, including which sprites share which
grid and which file holds what: [sprites.md](sprites.md).

Anything drawn through `drawSpriteFlash()` must fit in **64×64** — it recolours through a shared
64×64 scratch canvas and larger sprites clip.

### sfxdata.js

Generated by `node app/bake-sfx.js`, which reads `audio/sfx/*.mp3` and writes each clip into
this file as base64. **The output is committed.** It exists because a `file://` page may not
`fetch` its own folder, so without the inlined bytes every sound effect falls back to the synth
when the game is opened off the disk — which sounds exactly as it did before samples existed, and
is therefore invisible unless you are listening for it. Rerun the baker after any change to
`audio/sfx/` and before committing.

Music is deliberately **not** baked: it is ~70 MB, and an `<audio>` element streams a relative
`file://` path perfectly well — it was only ever `fetch` that was blocked.

### audio.js

Three layers under one master dial: a WebAudio synth for UI blips *and* as the fallback line
under every sampled cue, one-shot samples decoded out of `SFXDATA`, and `SFX.music` streaming
`audio/music/` through one `HTMLAudioElement` per track. Master / MUSIC / SOUNDS dials, the cue
list, the mixing targets and the track table: [gameplay.md](gameplay.md#audio).

### The game files (core.js … boot.js, with js/draw/ and js/ui/)

Thirty-nine files of flat top-level code (see [Shared global scope](#shared-global-scope)), each
organized only by `// ------ name` banners.
**Keep every banner honest.** Find any function by its banner in [code-map.md](code-map.md)
rather than grepping blind.

**A file that decides things does not also draw them.** Every one of the sim files - core, mobile,
player, input, gamepad, touch, world, nav, wildlife, structures, robots, actions, ai, sim -
contains zero canvas calls; the pixels for what they own live under **js/draw/** (the world) and
**js/ui/** (the HUD and the screens; the touch plates and sticks: js/ui/touch-plates.js; the pad
glyphs: `drawPadGlyph`, js/ui/panels.js), so the folder is the boundary. canvas.js is the
exception that proves it: it owns the buffers themselves.

**A feature's tuning constants live in the file that owns the feature**, directly above the code
that reads them — `MONSTER`/`CAMP_*` in wildlife.js, `TUR_*` in structures.js, `PRONE_*` in actions.js. Only
the numbers with no one owner stay in core.js: `TILE`/`WORLD`, the view size, the day cycle, and
the `YIELD` economy table that three files read. Adding a number for a feature means adding it
beside that feature, never here.

The one rule that constrains a move: **a const is only visible to a file that loads after the one
declaring it**, so anything read at *load time* — an object literal, a top-level loop, a `const`
initialised from another — has to be declared no later than that. Reads inside a function are
free, because every function in the game runs long after the last script tag. Two constants sit
where they do only because of this: `FISH_SPAWN_T` (core.js, because `state`'s literal reads it)
and `BOW_CHARGE`/`BOW_NOCK`/`DODGE_SPEED`/`SLIDE_MIN` (player.js, because the `CHAMPS` table
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
  (player 0) and its gold-only wallet; carried goods are `player.bag` and the two meals the
  uncapped `player.food` pouch. See
  [multiplayer.md](multiplayer.md#the-ten-players).

Plus the flat arrays every pass iterates: `animals`, `arrows`, `drops`, `particles`, `floaters`,
`footprints`, `structures`, `robots`, `fish`, `camps`.

## app/

Neither script is part of the game, and nothing in `js/` may depend on either having run — except
`sfxdata.js`, which one of them writes.

- **`app/server.js`** — a static server on `http://localhost:8471` with a `POST /shot` sink that
  writes the canvas to `shot.png`. It answers **Range requests**, which is why music seeks work
  when served; a plain 200 makes an `<audio>` element treat a multi-MB mp3 as an unbounded stream.
  Its single `ROOT` const carries the static root, the traversal guard and the shot sink alike.
- **`app/bake-sfx.js`** — reads `audio/sfx/`, writes `js/sfxdata.js`.
