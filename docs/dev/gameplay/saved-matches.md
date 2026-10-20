# Saved matches

Players never save a match (Noah, 2026-10-19: not a singleplayer game). What stays is the
machinery as a **determinism proof**: a match can be captured at any step and put back exactly
where it stood on a fresh page - every body, arrow in flight, building, drop, camp, every
player's item slots, the clock, and the two seeded streams' positions (`rng` and `fxRng`;
`mulberry32` keeps its state on the function as `.s` for this) - and it then **plays
out** the same from that step: the proof is below. Nothing a player reaches calls it; it is
`DBG.saveCapture`, `DBG.saveApply`, `DBG.saveHash` and `DBG.saveLoad` (js/app/boot.js).

**How it works** (js/sim/save.js). The world is a seed: a load is a page on the saved `?seed` and
`?map`, which grows the very same valley, and the save is what the match has done to it since.
`saveBaseline` records the valley as it grew, at boot, before anything moves (each tile's object
by reference with a hash of its contents, and the ground); `saveCapture` then writes

- **the roots** (`SAVE_ROOTS`): every mutable global the sim reads - `state` without its UI keys
  (`SAVE_STATE_SKIP`: the panels, the fade, the intro), `players`, the entity arrays,
  `iceBreaks`, `orca`, the streams, wildlife's and the bot brain's module `let`s, the post-game
  record, and the camera and zoom - **as one object graph**, so a reference shared anywhere (a
  bot's hunt target, a den's camp, `player` as `players[localId]`) comes back shared. JSON with a
  handful of `$` tags: an object reached twice is written once and pointed at, a `Player` comes
  back with its class, `Map`/`Set`/typed arrays/`NaN`/`Infinity`/`-0`/`undefined` survive, and
  so do an array's own fields (a route's `partial`, js/sim/nav.js - dropping it once made a loaded
  bot re-plan a step early); a reference into a static table (`saveTables`, three levels down:
  a camp's `CAMPS` row) is written as its path;
- **only the map objects and ground tiles that differ from the grown valley.** A reference to an
  untouched tile object is its tile index, so the 30 000-odd pines are never written. A tile
  object that points at a live thing (a den, hut or cairn at its camp's `site`, and the parts of
  its footprint) is always written, because the fresh valley's copy would point at the fresh
  page's camp.

**A new mutable global the sim reads joins `SAVE_ROOTS`**, or the proof silently misses it
(the CLAUDE.md rule). A new *field* on anything already saved rides along untold. Functions and
canvases are nobody's state and are dropped (a console warning names the path if one turns up).

**The flow.** `DBG.saveLoad(rec)` (`saveDevLoad`) puts a record from `saveCapture` into
`sessionStorage` (`softfall.load`) and reloads onto the same seed and shape; boot calls
`saveBootLoad` after the world stands and **before `prepGround`**, so the bake paints the saved
valley, then `saveBootEnter` once boot is done (the saved camera, the fade up from dark, the
match's music; no HUD slide, whose ease would move the camera and pop the day's headline). A
profile's saved matches from before saves were removed are cleared from storage once at load
(`clearOldSaves`, js/app/profile.js).

**The proof** (`DBG.saveHash`: a hash of everything a save carries, less the camera and what
runs on the frame's clock rather than the match's - the snowfall, which `updateFx` sways on
`performance.now` and tops up off `fxRng`, so an ember's tint, the one draw that stream lends the
sim). Step a match on a frozen page, `saveCapture`, keep stepping and hash; `saveLoad` the record onto a
page frozen from its first frame, step the same counts and hash: the two must agree at every
count, across all three shapes, from a save made in the eagle's ride, early in play with the local
human idle, and deep in a ten-bot match with hundreds of buildings and robots standing.
