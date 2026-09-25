# CLAUDE.md

Softfall: a browser canvas 2D top-down pixel-art cozy survival team battle on a winter map — ten
players, two teams, drive off the rival eagle to win. **Read [docs/dev/game.md](docs/dev/game.md) before proposing
a feature or judging whether one fits**: that is the design in one page, and this file is only the
rules.

## Commands

```
node app/server.js          # static server + screenshot sink + the match relay on http://localhost:8471
node app/bake-sfx.js       # audio/sfx/*.mp3 -> js/sfxdata.js; rerun after changing a clip
node app/bake-logo.js      # docs/media/logos/mainMenuSoftfall.png -> js/logodata.js; rerun after replacing it
cd desktop && npm install && npm start   # the Windows wrapper: Electron (+ Steam behind a flag) - the ONE place with packages
cd desktop && npm run build              # the portable zip a version tag also builds and attaches to a Release
```

**Double-clicking [index.html](index.html) has to work** — nothing may depend on being served. A
`file://` page cannot `fetch` its own folder, which is why `app/bake-sfx.js` inlines the sound
effects (its output is committed); an asset loaded any other way is silently dead off the disk.
No package manager, dependencies, tests or linter: edit a file under `js/` and reload.

**The game ships on Steam for a desktop: keyboard and mouse, and a gamepad (Steam Deck).** Phone
and touch support was deleted — never add a touch
handler, a phone fit or a mobile layout, and never spend a verification step on one.

**Verify changes in the browser, not by re-reading code.** `window.DBG` (end of
[js/boot.js](js/boot.js)) stages a scene without playing to it, `?seed=N` pins the world,
`POST /shot` sinks the canvas, and **`.`** toggles hitboxes and routes:
[checklists](docs/dev/checklists.md#verifying-a-change).

## Deep docs

Read the relevant one **before** working in that area — they carry the detail this file omits.

| Working on | Read |
| --- | --- |
| what the game *is* — the pillars, and what it deliberately is not | [docs/dev/game.md](docs/dev/game.md) |
| **a name or any sentence a player reads**: the setting's premise, the valley's reason for what a match does, the fixed words, the voice | [docs/dev/lore.md](docs/dev/lore.md) |
| camera, zoom, a draw pass, HUD, baked panels, cursor, lighting, the main menu | [docs/dev/rendering.md](docs/dev/rendering.md) |
| worldgen, tiles, ground, **the three map shapes and the paths a grown one cuts**, **the creek and its bridge and fords**, determinism/RNG, day/night, ice holes and fish, the camps and their fixed mirrored sites | [docs/dev/world.md](docs/dev/world.md) |
| movement, tools and bits, the draw and the cycle, the class abilities, dodge, wildlife, economy, the merchant's shop and the fish/berry market, building, robots, settings, audio | [docs/dev/gameplay.md](docs/dev/gameplay.md) |
| players, classes and kits, the input struct, **the two controllers** (keyboard, gamepad), teams, AI bots, contested orders, PvP | [docs/dev/multiplayer.md](docs/dev/multiplayer.md) |
| **online play**: host and clients, the snapshot and the wire, the relay, Steam lobbies (`js/net/`, `app/server.js`, `desktop/`) | [docs/pvp-architecture.md](docs/pvp-architecture.md) |
| sprite grids and palettes | [docs/dev/sprites.md](docs/dev/sprites.md) |
| a **new look** for anything drawn — concept sheets Noah picks from before a grid ships | the `concept-art` skill ([.claude/skills/concept-art/SKILL.md](.claude/skills/concept-art/SKILL.md)); past sheets in `docs/media/concepts/` |
| adding an object/tool/structure/ground type/camp, tuning balance, intentional dead code | [docs/dev/checklists.md](docs/dev/checklists.md) |
| the file layout, load order, what each file exposes, `app/` | [docs/dev/architecture.md](docs/dev/architecture.md) |
| which banner / function in which js file owns a thing | [docs/dev/code-map.md](docs/dev/code-map.md) |

## Architecture

Five legacy files — `profile.js`, `font.js`, the generated `sfxdata.js` and `logodata.js`, `audio.js` — and the
nine sprite files under `js/sprites/` keep their IIFEs and expose fixed `window` globals (`core.js`
makes `SPRITES`, the other eight `Object.assign` their keys into it); after them the game code is
**flat top-level classic scripts sharing one global scope** — forty-five files, `core.js`
through `boot.js`, with everything that draws under `js/draw/` (the world) and `js/ui/` (the HUD
and the screens) (the tag `pre-split` keeps the one-file history).
[index.html](index.html) loads them in a fixed order and they communicate **only through
globals**, so each file's globals must exist before the next loads. The file table and the
shared-scope mechanism: [architecture](docs/dev/architecture.md).

**`js/profile.js` is the only file that touches `localStorage`** — the local player profile (up to
three characters - name, class, look, lifetime stats - the kinds it has held, and the settings).
Everything else goes through `PROFILE`, so putting the profile on a server stays a one-file change;
never read or write a storage key directly. **A match reads nothing back out of a profile but the
character's name, class and look**: the whole arsenal is unlocked for everybody, so `LOOT_POOL` is
the same on a first flight as on a five-hundredth ([the wiki](docs/dev/gameplay.md#the-wiki)).

All game state lives in module-scope singletons (`state`, `settings`, `players`) and the entity
arrays beside them; `player`/`inv` are the **local player only**, carried goods are `player.bag` and
the two meals are the uncapped `player.food` pouch — both reached only through the `bag*` helpers.
The full list: [code-map](docs/dev/code-map.md#jsplayerjs).

A feature's **tuning constants live in the file that owns the feature**, above the code that reads
them; `core.js` keeps only the numbers with no one owner. A const is invisible to files that load
before its own, so anything read at *load time* must be declared no later:
[architecture](docs/dev/architecture.md#the-game-files-corejs--bootjs-with-jsdraw-and-jsui).

The game code is organized only by `// ------ name` banners inside its forty-five files.
**Keep every banner honest**, and find any function by its banner in
[docs/dev/code-map.md](docs/dev/code-map.md) — read it before grepping blind.

## Versioning

**Never commit to main.** Branch as `<name>/<topic>`, run `/sync` before every push, merge via PR.
The PR's last commit bumps `PATCH_TXT` ([js/ui/menu.js](js/ui/menu.js)) by 0.01 over origin/main and tops
`PATCH_NOTES` with one uppercase sentence; the commit message begins with the patch name
(`PATCH 2.11 — ...`), so `git log --oneline` reads as a build history.

## UI rule: show, don't label

**Communicate through visuals and visual indicators wherever possible; avoid lengthy text
explanations.** An icon beside a number, an arrow that is clickable, a colour that carries the
team, a plank that lifts on hover — not "CLICK OR ARROWS TO SWAP", not "PLAYERS LEFT: 5". A
control must read as what it does by its shape and its hover state alone, and if you catch
yourself writing a hint sentence, build the affordance instead. Text is for names, numbers,
headlines (a death, a camp) and five deliberate carve-outs: **keybind indicators** (`'ESC
BACK'`, a "1" in a slot's corner — which name an *action*, print whatever key it is bound to
(`keyCap`, input.js) and wear the pad's button while one is in hand (`PAD_BIND`, ui/wheel.js), so a new
one goes through `drawKeyPrompt`/`drawPadBind`), the **settings, PLAYER, gear, character and shop panels**'
labelled rows, the **instruments** — the practice room's (the dummy meter, the parkour's lap
clock and the archery round's readouts, with their BEST / LAST plates), the merchant's
(the two price graphs and their high/low) and the **stat sheet** that flies into the notice
lane when a number on yours moves — because an instrument's whole job is comparing numbers, and the **hover tooltip** (beside the pointer, or parked bottom-left — `tipAt`/`tipPos`/
`drawTooltip`, ui/tooltip.js) — which earns it because comparing a tool's rate of fire against a
bit's weight is comparing *numbers*, and no shape does that. It is a carve-out, not a licence: the
well still has to read at a glance without it. Anything else that wants words is a design bug.

## Hard rules

Cross-file invariants — breaking one produces a bug that looks unrelated to its cause. The test for
belonging here: **would you break it without ever having reason to open the deep doc?** If not, it
lives in `docs/dev/*.md` beside the code it protects.

- **Canvas size changed?** Call `fitCanvas()` **then** `relayout()` — both paths (window resize,
  `fullscreenchange`) do. Never write layout against a literal 640/360; the view is `VIEW_W`×`VIEW_H`,
  and a screen authored in the old 270-row frame starts at `frameTop()` (`FRAME_H`, core.js).
- **Zoom scales the world, never the UI.** `render()` draws the world into `worldCv` at
  `WV_W`×`WV_H`, blits it in device px, then draws the UI in `VIEW_W`×`VIEW_H` under a `devScale`
  transform, so the HUD is one size at every zoom. A **world** pass bounds itself against `WV_*`;
  cross between spaces only through `mouseWX()`/`mouseWY()` and `wToSX()`/`wToSY()`.
- **The zoom the player rests at is a whole number of device px per world px** (`kWant`; the
  wheel steps it by 1). Anything that sets the zoom goes through that rung, or the pixel grid
  stops being uniform and sprites look stretched.
- **Screen position is `round(world − camera)`, rounded exactly once.** Statics subtract the
  rounded `ox`/`oy`; moving entities subtract the exact `ex`/`ey` and round at the end. Rounding
  camera and entity separately makes sprites vibrate ±1 px against the background while walking.
- **Text over the world goes through `drawWorldText`** (js/draw/light.js): a
  `drawPixelTextOutline` (1px dark rim all sides) *queued* and stamped after the night grade — call
  the outline directly in a world pass and the tint sinks a team blue into blue snow. In a UI pass
  the outline is the right call; `Shadow` is for panels and planks. White pixel text on white
  snow with only a drop shadow is unreadable.
- **Runtime ground change?** Call `repaintGround(tx, ty)` — it repaints the tile plus its four
  neighbours into the prerendered ground canvas. Never call `renderGround()` per frame; it bakes
  the entire 3712×3712 world and is a boot-time cost.
- **Nothing on the map emits light; night is a colour and a rim, never a darkness in the middle** —
  [`renderLighting`](docs/dev/rendering.md#light-and-weather) grades the finished world frame (the
  dark lives at `NIGHT_EDGE`), so a new glowing thing adds a pass there, not a registry.
- **Anything the weather moves reads the one wind** — `state.windDir`, `state.wind`,
  `windGust(tx, ty)`, and a pine's `windSway(tx, ty)` — never a clock of its own: one field (the
  `wind` banner, js/sim.js) drives the snow, the streaks and every pine's frame, the day's weather
  (`state.wx`) scales it, and it dies at dusk.
- **A sprite the world holds hundreds of draws from ONE texture** — a `drawImage` whose source
  canvas differs from the last cannot be batched, and one atlas doubled the pines' frame rate:
  [rendering](docs/dev/rendering.md#drawing-a-thousand-of-something).
- **Units are solid to each other.** `separateUnits()` runs once per sim step after every mover has
  stepped; a new kind of thing that walks must join its list (and `UNIT_MASS`, and be marked `small`
  unless a roll should stop on it) or it walks through everyone. A player mid-roll is the exception:
  it skips contact with a small unit, because `rollSweep` turns that contact into a hit instead.
- **Every target picker asks `unitAlive(e)`** — the arrow loop, the roll's sweep,
  `unitsNear`/`unitsHit`, a turret's mark, a worker's quarry, the hunt reticle — so one answer
  takes a body out of *every* weapon at once; that is what makes a **merchant** untouchable.
- **Every living thing takes the same hit.** A blow goes through `hurtUnit(e, dmg, nx, ny, src, o)`
  and a state through its setter (`stunUnit`/`rootUnit`/`slowUnit`/`netUnit`/`markUnit`/`igniteUnit`,
  the `status effects` banner); an area effect sweeps `unitsNear`/`unitsHit`, never a loop per kind.
  Reaching for `damagePlayer` in a new ability is how wildlife and worker bots quietly stop being in
  the game: [gameplay](docs/dev/gameplay.md#status-effects-one-set-for-every-unit).
- **A cue, a shake or a puff the SIM raises never asks the local screen itself.** Inside the
  step, `if (nearPlayer(x, y)) SFX.cue()` is `sfxAt('cue', x, y)`, `if (p === player) SFX.cue()`
  is `sfxFor(p, 'cue')` and a local shake is `shakeFor(p, n)`/`shakeAt(x, y, n)` (js/net/events.js):
  the helpers carry the where and the who so a host can record the moment for a client that
  never ran the step, and a bare gate is a sound that client never hears. `burst` and the
  floaters record themselves. Outside the step (HUD, menus) the bare call is right.
- **A building is not a unit, and takes its blow through `hurtStruct`** — which is where
  `STRUCT_DR` damps a player's damage, and only a player's (a bot names itself and keeps its
  own number). An area effect asks `structsNear`, the `unitsNear` for walls; anything shot dies
  on a wall already, so a bit sieges from the arrow loop's solid-tile branch and nowhere else.
- **Open water is `waterAt(tx, ty)`** — an ice hole (ground 2) or the creek (4) — never a bare
  `=== 2`: every walker, route, spawn and climb-out asks it, and a new one missing the creek walks on water.
- **Anything that walks to a goal routes there** through `navTo`/`navStep` (the `pathfinding`
  banner), never by steering straight at it, and **drops the goal when they return `ok = false`**
  (no route, or pinned) — there are no stuck timers; a caller that ignores `ok` stands still forever.
  `navStep` is also where `unitMoveMul` is spent, so a hand-steered walk folds it in itself.
- **A loop over `players` that touches the world must skip `inAir(p)`** (riding or falling from the
  eagle) alongside `!p.active`/`p.dead` — arrows, drops, wildlife, the draw list and both maps all do.
  A zipline's rider (`p.zip >= 0`) is the narrower case: still a target for every weapon, but
  nothing may shove or reposition it (`separateUnits` skips it) — the cable owns where it is.
- **Gold never goes straight into `p.inv.gold`** — every payout calls `gainGold(p, n)`, which is
  also the XP source; a direct `+=` earns no levels. One exception: `tradeGold`, the merchant's
  till — a sale is an exchange, and a counter that buys fish at its own asking price would
  otherwise be a level farm ([the counter](docs/dev/gameplay.md#the-merchants-counter)).
- **A tool is an instance, not a type name.** Its bag cell carries the bits loaded into it, so a
  tool is **moved** between bag, slot, drop and back (`bagPut`, `slotPut`, `spawnDrop`'s `it`) and
  never rebuilt from `s.type` — rebuilding it silently empties somebody's build. But a tool that
  lands in the **snow** arrives bare: the one ground-drop path (`throwCell`, js/ui/bag.js) calls
  `shedBits` first, and a new one must too, so the fittings lie beside the body. What the button fires goes through `fireTool` → `emitBit` for
  every player alike: [tools and bits](docs/dev/gameplay.md#tools-and-bits).
- **Anything deciding it can see a player asks `seenAt(p, range)`**, never a bare range — that one
  function is where GHOSTSTEP and burial live (both maps gate on `concealOf(p)`).
- **Anything painting a team's colour indexes by `skin(team)`** — `TEAMS[skin(p.team)]`,
  `SPRITES.champ[c][skin(t)]`, every per-team sprite set — never by the bare index: your side is
  always BLUE on your screen (`settings.teamBlue`), and a bare `TEAMS[p.team]` is the one thing
  on it painted the wrong colour. Rules (`p.team`, `enemyOf`) never call it.
- **What a key does lives in `keyPress`/`keyRelease`, what a button does in `pointerPress`/
  `pointerRelease`** (input.js), never in a listener: a gamepad presses the same keys
  and buttons through those four, so a key handled in the listener alone is dead on a pad. And
  **a key is asked for through its action** — `keyIs(e, 'work')`/`keyHeld('slide')`, never a
  literal `'e'` — because the player rebinds (`binds()`, one map per keyboard scheme) and the
  listener names keys by where they sit (`e.code`), so a literal is dead on a rebind, on an
  AZERTY board and on the CLICK scheme, where E is an ability.
- **Anything a player does takes a `p` and reads `p.input`**, never `keys`/`mouse` (local player
  only) - the leap off the eagle included (`input.jump`): a key handler that calls a sim function
  directly does nothing on a `client`, whose sim never runs (`NET.isClient`, js/net/net.js) - and
  anything only one of them can get (a work swing, a build, a drop, a fish) goes through
  `contest()`, which picks the winner from (SEED, player id, `state.tick`).
- **Never add or remove an `rng()` call inside `genWorld()`** — it reshuffles every existing seed
  (the chests and rocks roll on their own `chRng`/`rkRng`; the camps roll nothing; a **map shape** grows its
  interior on `vnoise` alone and adds rolls only at the very end, behind `mapGrown`). Use
  `hash2`/`vnoise` per tile, never before the `SEED` const.
- **At most one object per tile.** Create with `placeObj`, read with `objAt`, and route structures
  through `placeStruct`/`destroyStructure` so the `structures` registry stays in sync. A building with
  `w`/`h` in `STRUCTS` (the bot bay, 3×2), or a `w` in `OBJECTS` (the den), fills its other tiles
  with `part` objects pointing at the anchor — **read one off a tile with `structOf(objAt(...))`**, create/remove only via
  `createStruct`/`removeStruct`. **What a type *is* lives in its `OBJECTS`/`STRUCTS` entry, never
  in an `if`** — generic code asks the table: [checklists](docs/dev/checklists.md#common-changes).

## Keeping the docs current

**The docs are part of the deliverable.** When a change makes a line in this file or in
`docs/dev/*.md` false, fix it in the same turn as the code change — a stale line is worse than a
missing one, because future sessions act on it without re-verifying. Prune
[Known drift](docs/dev/checklists.md#known-drift) once fixed, and delete an
[intentional dead code](docs/dev/checklists.md#intentional-dead-code) entry with the code it names;
what is worth recording at all: [checklists](docs/dev/checklists.md#what-is-worth-recording).
**Write what the code does now** — no "used to", no "since 3.xx", no old measurements: history is
`git log`, and a fact explained in two places drifts in one of them, so give it one home and link.

**Keep this file under ~230 lines** — it loads in full at the start of every session, and rule
adherence drops as it grows. Anything derivable by reading the code belongs in `docs/dev/*.md`,
which costs nothing until opened. Move a section out rather than thinning every section into mush.
