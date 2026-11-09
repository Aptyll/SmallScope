# CLAUDE.md

Softfall: a League-style 5v5 MOBA in the snow, top-down pixel art in a browser canvas, wrapped in
Electron for Steam. Ten players (bots fill empty seats) pick heroes and push three lanes to drive
off the rival eagle. This file holds only the rules that break silently; everything else lives in
a doc or a skill, linked below.

## Read first

Read the doc for your area before you start. Docs with a Pages index: read only the pages you need.

| Before you | Read |
| --- | --- |
| propose a feature | [game](docs/dev/game.md) |
| write a word a player reads | [lore](docs/dev/lore.md) |
| look for code | [code-map](docs/dev/code-map.md): which file and banner owns a thing |
| add a file, move a global | [architecture](docs/dev/architecture.md) |
| touch drawing, the HUD, the camera | [rendering](docs/dev/rendering.md) |
| touch the map or worldgen | [world](docs/dev/world.md) |
| touch combat, abilities, items, economy | [gameplay](docs/dev/gameplay.md) |
| touch players, teams, input, bots | [multiplayer](docs/dev/multiplayer.md) |
| touch online play | [pvp-architecture](docs/pvp-architecture.md) |
| touch sprites | [sprites](docs/dev/sprites.md) |
| make a change that spans many files | [checklists](docs/dev/checklists.md) |

Procedures are skills in `.claude/skills/`: `new-hero`, `concept-art` (any new look), `shorts` and
`media` (clips, GIFs, stills), `kitchen`. `/sync` rebases and lints.

## Run and verify

- `node app/server.js` serves the game on :8471. `node app/check-globals.js` is the one lint (it
  runs the size check too). `node app/check-join.js` drives every way a friend joins a party.
- Double-clicking `index.html` must work: nothing may `fetch` or need a server. Data the game loads
  is baked inline by `app/bake-*` into `js/baked/`; change the source and rebake, never hand-edit.
- There are no tests. Verify in headless Chromium with a small staged scene of exactly the changed
  case: `window.DBG`, `?seed=N`, `POST /shot`, `.` for hitboxes ([how](docs/dev/checklists.md#verifying-a-change)).
  A refactor proves itself against main: same seed, same `DBG.saveHash`, same pixels. A bot match
  never judges a feature.
- Keyboard, mouse and gamepad only. Never add touch or mobile support.

## Hard rules

1. **Go through the shared function, never around it.** Each one is where every case is handled,
   so a copy silently skips wildlife, bots, stealth, heroes or the other team.
   - Hits: `hurtUnit` (a blow sweeps with `unitsHit`), `hurtStruct`. States: `stunUnit` and the
     other `*Unit` setters. Areas: `unitsNear`/`structsNear`. Targets: `unitAlive`. Sight: `seenAt`.
   - Gold: `gainGold`. XP: `shareXp` on a death, `gainXp` under it.
   - World: `waterAt`, `placeObj`, `createStruct`, `repaintGround`. Walking: `navTo`/`navStep`,
     dropping the goal on `ok = false`; a new walker joins `separateUnits`.
   - Team colour: `skin(team)`. World text: `drawWorldText`. Keys: `keyPress`/`keyRelease`, asked
     by action with `keyIs`. Loops over `players` skip `inAir(p)`.
2. **The sim never reads the local machine.** Player actions read `p.input`, never `keys`/`mouse`;
   single-winner actions go through `contest()`; sim sounds and shakes use `sfxAt`/`sfxFor`/`shakeFor`.
   A client never runs the sim, so anything else is dead online.
3. **Never shift the seed.** Never add or remove an `rng()` call inside `genWorld()`.
4. **Pixels stay exact.** Zoom scales the world, never the UI, and rests on a whole `kWant`. Screen
   position is `round(world - camera)`, rounded once. Layout reads `VIEW_W`/`VIEW_H`, never 640/360.

## Code shape

- Classic scripts sharing one global scope, loaded in `index.html`'s order: a global must exist
  before the file that reads it loads. A feature's tuning constants sit in the file that owns it.
- Keep every `// ------ name` banner honest; find code through code-map before grepping.
- What a thing *is* lives in its table entry (`OBJECTS`, `STRUCTS`, `CLASSES`, `BUILD_ITEMS`),
  never in an `if`. A hero reaches the shared sim only through the `HERO_*` hook tables.
- New mutable sim state joins `SAVE_ROOTS`. New team-painted sprites bake inside `SPR.onTeams`.
- Only `js/app/profile.js` touches `localStorage`.

## UI: show, don't label

Speak through icons, colour and hover state, not hint sentences. Text is for names, numbers,
headlines and the carve-outs in [show, don't label](docs/dev/rendering/show-dont-label.md).

## Shipping

- Never commit to main. Branch, run `/sync` before every push, merge by PR.
- Take the patch number at merge time, after the last rebase: `PATCH_TXT` (js/ui/menu.js) goes
  +0.001 over main and over every open PR. That last commit is named `PATCH 0.xxx — ...` and tops
  `PATCH_NOTES` with one uppercase sentence. Player-facing work adds a `PATCH_DIGEST` line; art it
  shipped can ride the note (`app/bake-notes-art.js`). The first digit moves only when Noah says so.
- A change that makes a doc line false fixes it in the same PR. Docs say what the code does now.

## Keeping this file

A rule belongs here only if breaking it fails silently. Name functions, never counts, sizes or file
lists; those go stale here and live in `docs/dev/`. A new shared function joins rule 1's list
instead of becoming a new rule. Edits to this file are shown to Noah before they merge.
