# CLAUDE.md

Softfall: a browser-canvas, top-down pixel-art winter team battle (ten players, two teams, drive off
the rival eagle), wrapped in Electron for Steam. Read [game.md](docs/dev/game.md) before proposing a
feature, [lore.md](docs/dev/lore.md) before writing any word a player reads, and the matching deep doc
before working in an area: [code-map](docs/dev/code-map.md) (which banner owns a thing),
[architecture](docs/dev/architecture.md), [rendering](docs/dev/rendering.md), [world](docs/dev/world.md),
[gameplay](docs/dev/gameplay.md), [multiplayer](docs/dev/multiplayer.md), [sprites](docs/dev/sprites.md),
[checklists](docs/dev/checklists.md), [online play](docs/pvp-architecture.md); a new look goes through
the `concept-art` skill first.

## Run and verify

- `node app/server.js` serves the game, the screenshot sink and the match relay on :8471. Rerun
  `node app/bake-sfx.js` / `bake-logo.js` after changing a clip or the logo. `desktop/` (npm) is the only place with packages.
- Double-clicking `index.html` must work: nothing may `fetch` or depend on being served.
- No build, tests or linter. Verify in the browser (headless Chromium works): `window.DBG`, `?seed=N`,
  `POST /shot`, `.` for hitboxes ([checklists](docs/dev/checklists.md#verifying-a-change)).
- Keyboard, mouse and gamepad only. Never add touch or mobile support.

## Code shape

- Flat classic scripts sharing one global scope, loaded in a fixed order by `index.html`; a global
  must exist before the next file loads. Tuning constants sit in the file that owns the feature.
- Keep every `// ------ name` banner honest; find code through code-map before grepping.
- Only `js/profile.js` touches `localStorage`. A match reads only name, class and look from a profile.
- New mutable sim state joins `SAVE_ROOTS` (js/save.js). New team-painted sprites bake inside `SPR.onTeams`.
- What a type *is* lives in its `OBJECTS`/`STRUCTS` entry, never in an `if`.

## Hard rules (each breaks something that looks unrelated)

- Canvas resized: `fitCanvas()` then `relayout()`. Layout uses `VIEW_W`/`VIEW_H`, never 640/360.
- Zoom scales the world, never the UI, and rests on a whole-number `kWant`. Cross spaces only via `mouseWX`/`wToSX`.
- Screen position is `round(world - camera)`, rounded once: movers use exact `ex`/`ey`.
- World text goes through `drawWorldText`. Ground changed at runtime: `repaintGround`, never `renderGround`.
- Nothing emits light; night is a grade in `renderLighting`. Weather motion reads the one wind (`windGust`, `windSway`).
- Sprites drawn by the hundred come from one atlas texture.
- A new walker joins `separateUnits` and `UNIT_MASS`. Target pickers ask `unitAlive`.
- Hits go through `hurtUnit` / `hurtStruct` and the status setters; areas sweep `unitsNear`/`structsNear`.
- Sim-side sound and shake use `sfxAt`/`sfxFor`/`shakeFor`, never a local-screen check.
- Open water is `waterAt`. Walkers route with `navTo`/`navStep` and drop the goal on `ok = false`.
- Loops over `players` skip `inAir(p)`; nothing shoves a zipline rider.
- Gold goes through `gainGold` (the merchant's `tradeGold` excepted).
- A tool is an instance: move it, never rebuild it from its type; a snow drop calls `shedBits`.
- Visibility asks `seenAt`. Team colour indexes by `skin(team)`, rules by bare `p.team`.
- Keys live in `keyPress`/`keyRelease`, asked by action (`keyIs`), never a literal key or a listener.
- Player actions read `p.input`, never `keys`/`mouse`; single-winner actions go through `contest()`.
- Never add or remove an `rng()` call in `genWorld()`. One object per tile via `placeObj`/`placeStruct`.

## UI rule: show, don't label

Communicate with icons, colour and hover state, not hint sentences. Text is for names, numbers,
headlines and the carve-outs listed in [rendering](docs/dev/rendering.md#show-dont-label).

## Git and docs

- Never commit to main. Branch `<name>/<topic>`, run `/sync` before pushing, merge by PR.
- The PR's last commit bumps `PATCH_TXT` (js/ui/menu.js) by 0.01 over main, tops `PATCH_NOTES` with one
  uppercase sentence, and is named `PATCH x.yy — ...`. Player-facing work also adds a `PATCH_DIGEST` line.
- A change that makes a doc line false fixes the doc in the same PR. Write what the code does now.
- Keep this file near 50 lines; detail belongs in `docs/dev/`.
