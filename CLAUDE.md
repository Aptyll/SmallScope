# CLAUDE.md

Softfall: a League-style 5v5 MOBA in the snow, top-down pixel art in a browser canvas, wrapped in
Electron for Steam. Ten players (bots fill empty seats) pick heroes and push three lanes to drive
off the rival eagle. This file holds only the rules that break silently, laid out the way the code
is. Everything else lives in a doc or a skill, linked where it applies.

Before you propose a feature, read [game](docs/dev/game.md). Before you write a word a player
reads, read [lore](docs/dev/lore.md). To find code, start at [code-map](docs/dev/code-map.md)
(which file and banner owns a thing). Read docs by section, never whole: a doc with a Pages index,
only the pages you need; any other, its `## ` headings first, then the one section.
A change that spans many files has a list in [checklists](docs/dev/checklists.md). Procedures are
skills: `new-hero`, `concept-art` (any new look), `shorts` and `media`, `kitchen`.

## How the code is built

No bundler, no modules: classic scripts sharing one global scope, loaded in `index.html`'s order,
so a global must exist before a file that reads it at load ([architecture](docs/dev/architecture.md)).
A folder is a job, never a scope. A match flows one way:

**hands and bots fill `p.input` → the sim steps the match → net carries it → draw and ui paint it**

Only the host runs the sim. A client sends its input and paints what the host sends.

## Hard rules

Each rule spans folders; its names are listed under the folder that owns them.

1. **Go through the shared function, never around it.** Each one is where every case is handled,
   so a copy silently skips wildlife, bots, stealth, heroes or the other team.
2. **The sim never reads the local machine.** Anything it reads off this screen is dead online.
3. **The map grows from the seed alone.** Each worldgen pass rolls on its own `worldRng(name)`,
   never `rng()` or the local machine, so every screen grows the same valley and a changed pass
   moves only its own layer.
4. **Pixels stay exact.** Zoom scales the world, never the UI, and rests on a whole `kWant`.

## Folder by folder

**js/app/: the machine around the match** (input, canvas, sound, profile, boot)
- A key does its work in `keyPress`/`keyRelease`, asked by action with `keyIs`, and a mouse
  button in `pointerPress`/`pointerRelease`, never in a listener, so a headless check presses
  exactly what a hand does.
- Only `js/app/profile.js` touches `localStorage`. `window.DBG` (boot.js) is the one export.

**js/sim/: the match** ([world](docs/dev/world.md), [gameplay](docs/dev/gameplay.md))
- It decides and never draws: pixels for what it owns go in js/draw/ or js/ui/.
- Rule 2: player actions read `p.input`, never `keys`/`mouse`; single-winner actions go through
  `contest()`; sounds and shakes go through `sfxAt`/`sfxFor`/`shakeFor`.
- Rule 1: hits `hurtUnit` (a blow sweeps with `unitsHit`) and `hurtStruct`; states `stunUnit` and
  the other `*Unit` setters; areas `unitsNear`/`structsNear`; targets `unitAlive`; sight `seenAt`;
  gold `gainGold` in, `spendGold` out; XP `shareXp` on a death, `gainXp` under it; water
  `waterAt`; tiles `placeObj` and `createStruct`; walking `navTo`/`navStep`, dropping the goal on
  `ok = false`, and a new walker joins `separateUnits`. Loops over `players` skip `inAir(p)`.
- What a thing *is* lives in its table entry (`OBJECTS`, `STRUCTS`, `BUILD_ITEMS`),
  never in an `if`. A hero reaches the shared sim only through the `HERO_*` hook tables.
- Rule 3: `rng()` is the match's stream; a worldgen pass rolls on `worldRng(name)`, and a per-tile
  look reads `hash2`/`vnoise`.
- A feature's tuning constants sit in the file that owns it. New mutable state joins `SAVE_ROOTS`.

**js/ai/: the bots** ([bots](docs/dev/multiplayer.md#bots), [bot API](docs/bots/api.md))
- A bot only writes the input struct a human fills, so it can never do what a player cannot.

**js/net/: what screens share** ([online play](docs/pvp-architecture.md))
- Entity fields ride the snapshot on their own; a new `state` key a client shows joins `SNAP_STATE`.
  `DBG.netEcho()` proves the snapshot complete: zero pixels differ.

**js/draw/ and js/ui/: the pixels** ([rendering](docs/dev/rendering.md), [sprites](docs/dev/sprites.md))
- Rule 4: screen position is `round(world - camera)`, rounded once. Layout reads `VIEW_W`/`VIEW_H`,
  never 640/360.
- Rule 1: team colour `skin(team)`, world text `drawWorldText`, ground edits `repaintGround`.
- New team-painted sprites bake inside `SPR.onTeams`.
- UI shows, doesn't label: icons, colour and hover state, not hint sentences. Text is for names,
  numbers, headlines and the carve-outs in [show, don't label](docs/dev/rendering/show-dont-label.md).

**js/baked/, app/, desktop/: outside the game code**
- `js/baked/` is written by `app/bake-*`: change the source and rebake, never hand-edit.
- `app/` holds tools; nothing in `js/` may need one to have run, except reading what a bake wrote.
- Only `desktop/` (Electron and Steam) has packages.

## Run and verify

- `node app/server.js` serves the game on :8471. `node app/check-globals.js` is the one lint (it
  also fails on oversized files, unused names, missing text and docs that name gone code).
  `node app/check-join.js` drives every way a friend joins a party.
- Double-clicking `index.html` must work: nothing may `fetch` or need a server.
- There are no tests. Verify in headless Chromium with a small staged scene of exactly the changed
  case: `window.DBG`, `?seed=N`, `POST /shot`, `.` for hitboxes ([how](docs/dev/checklists.md#verifying-a-change)).
  A refactor proves itself against main with `node app/check-same.js`: same seeds, same
  `DBG.saveHash`, same pixels. A bot match never judges a feature.
- Keyboard and mouse only. Never add gamepad, touch or mobile support.

## Shipping

- Never commit to main. Branch, run `/sync` before every push, merge by PR.
- Take the patch number at merge time, after the last rebase: `PATCH_TXT` (js/ui/menu.js) goes
  +0.001 over main and over every open PR. That last commit is named `PATCH 0.xxx — ...` and tops
  `PATCH_NOTES` with one uppercase sentence. Player-facing work adds a `PATCH_DIGEST` line; art it
  shipped can ride the note (`app/bake-notes-art.js`). The first digit moves only when Noah says so.
- A change that makes a doc line false fixes it in the same PR. Docs say what the code does now.

## Keeping this file

A rule belongs here only if breaking it fails silently. Name functions, never counts, sizes or file
lists; those go stale here and live in `docs/dev/`. A new shared function joins its folder's rule 1
line instead of becoming a new rule. Edits to this file are shown to Noah before they merge.
