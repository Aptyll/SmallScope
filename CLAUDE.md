# CLAUDE.md

Softfall: a top-down pixel-art winter team battle in a browser canvas, wrapped in Electron for Steam.
Ten players (bots fill empty seats) in two teams of HUNTERs and WARRIORs drive off the rival eagle.
Read [game.md](docs/dev/game.md) before proposing a feature and [lore.md](docs/dev/lore.md) before
writing a word a player reads. Before working in an area, read its doc: [code-map](docs/dev/code-map.md)
(which file and banner owns a thing), [architecture](docs/dev/architecture.md),
[rendering](docs/dev/rendering.md), [world](docs/dev/world.md), [gameplay](docs/dev/gameplay.md),
[multiplayer](docs/dev/multiplayer.md), [online play](docs/pvp-architecture.md),
[sprites](docs/dev/sprites.md), [checklists](docs/dev/checklists.md). New art starts with the `concept-art` skill;
Shorts, GIFs, storyboards and stills use the kit in [media](docs/dev/media.md).

## Run and verify

- `node app/server.js` serves the game on :8471. `/sync` runs `node app/check-globals.js`, the one lint.
  `app/bake-*` regenerate the inlined sound, logo and bears. Only `desktop/` (Electron) has packages.
- Double-clicking `index.html` must work: nothing may `fetch` or depend on being served.
- There are no tests. Verify in the browser (headless Chromium works) with `window.DBG`, `?seed=N`,
  `POST /shot` and `.` for hitboxes: [how](docs/dev/checklists.md#verifying-a-change).
- Keyboard, mouse and gamepad only. Never add touch or mobile support.

## Code shape

- Classic scripts sharing one global scope, loaded in `index.html`'s order: a global must exist
  before the file that reads it loads. A feature's tuning constants sit in the file that owns it.
- Keep every `// ------ name` banner honest; find code through code-map before grepping.
- What a type *is* lives in its `OBJECTS`/`STRUCTS` entry, never in an `if`.
- New mutable sim state joins `SAVE_ROOTS` (js/save.js). New team-painted sprites bake inside `SPR.onTeams`.
- Only `js/profile.js` touches `localStorage`.

## Hard rules

1. **Go through the shared function, never around it.** Each one is where every case is handled, so
   a copy silently skips wildlife, bots, stealth or the other team. Hits: `hurtUnit`/`hurtStruct` and
   the status setters. Areas: `unitsNear`/`structsNear`. Targets: `unitAlive`. Sight: `seenAt`.
   Gold: `gainGold`. Water: `waterAt`. Walking: `navTo`/`navStep`, dropping the goal on `ok = false`.
   Team colour: `skin(team)`. Keys: `keyPress`/`keyRelease`, asked by action with `keyIs`. Tiles:
   `placeObj`/`placeStruct`. World text: `drawWorldText`. Ground edits: `repaintGround`. A new walker
   joins `separateUnits`. Loops over `players` skip `inAir(p)`.
2. **The sim never reads the local machine.** Player actions read `p.input`, never `keys`/`mouse`;
   single-winner actions go through `contest()`; sim sounds and shakes use `sfxAt`/`sfxFor`/`shakeFor`.
   A client never runs the sim, so anything else is dead online.
3. **Never shift the seed.** Never add or remove an `rng()` call inside `genWorld()`.
4. **A tool is an instance.** Move it between bag, slot and drop; never rebuild it from its type.
   A tool dropped in the snow calls `shedBits` first.
5. **Pixels stay exact.** Zoom scales the world, never the UI, and rests on a whole `kWant`. Screen
   position is `round(world - camera)`, rounded once. Layout reads `VIEW_W`/`VIEW_H`, never 640/360.

## UI: show, don't label

Speak through icons, colour and hover state, not hint sentences. Text is for names, numbers,
headlines and the carve-outs in [rendering](docs/dev/rendering.md#show-dont-label).

## Git and docs

- Never commit to main. Branch, run `/sync` before pushing, merge by PR.
- The last commit bumps `PATCH_TXT` (js/ui/menu.js) by 0.001 over main, tops `PATCH_NOTES` with one
  uppercase sentence and is named `PATCH 0.xxx — ...`; the first digit moves only when Noah says so.
  Player-facing work adds a `PATCH_DIGEST` line; art it shipped can ride the note (`app/bake-notes-art.js`).
- A change that makes a doc line false fixes it in the same PR. Write what the code does now.
- This file holds only rules that break silently. Name functions, never counts, sizes or file lists;
  those live in `docs/dev/` and go stale here.
