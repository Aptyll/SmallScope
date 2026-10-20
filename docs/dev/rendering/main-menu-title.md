# Main menu (title)

`state.mode === 'title'` is a real menu, not a splash: the sim's ambient half keeps running
behind it (`updateTitle()` steps animals and fish - until a room is shared, when they stand still
for every guest's sake, [online play](../../pvp-architecture.md#the-wire-form) - and advances the menu
timers; players, arrows and structures do not tick and `state.time` is frozen), snow falls as usual, and the camera is
driven by `titleCamTarget()` — a slow lissajous drift around the open interior that stays
`BORDER_MAX + 6` tiles clear of the forest. Everything lives in the `main menu` banner and on
`state.menu`:

- **Items** `MENU_ITEMS` (QUICKPLAY / RANKED / PRACTICE TOOL —
  all three live from the first boot, and nothing else; `menuActivate` dispatches on the word. All three open the
  [party lobby](../gameplay/settings.md) in that mode (`beginParty`): QUICKPLAY's and RANKED's FIND
  MATCH leads to the [lobby](../rendering.md#lobby)'s hero select, PRACTICE TOOL's START to the
  [practice arena](../world.md#the-practice-arena);
  there is no WIKI or SETTINGS item: the [wiki](the-hud-corners/the-wiki-screen.md) opens from a word in the corner of
  the patch notes, settings are the ESC panel's in play, and the seed lives on
  [lobby](../rendering.md#lobby) under the map), stacked `MENU_TXT_PITCH` apart, climbing from `MENU_BOTTOM`
  above the view's foot. **`menu.hover` has one cell per item** and its length is
  a literal in core.js, a file that loads before `MENU_ITEMS`
  exists; the ease tops a missing cell up with `|| 0`, because a short array goes NaN and silently
  deletes a row - add an item, add a cell. `menuLayout()` is the single source of rects for hit-testing
  (`menuHit()`) and drawing. `menu.sel` is the keyboard selection; the mouse only steals it
  when it actually moves (`menu.moved`, set by mousemove), so arrows and hover never fight.
  Up/Down/W/S move, Enter/Space activate, Esc/Backspace close a panel; `menuKey()` and
  `menuClick()` are the only entry points (`keydown`/`mousedown` route there in title mode,
  and `mousedown` re-reads the pointer position from its own event).
- **Dressing** (all procedural, every piece taking its alpha from the
  caller so it fades with the chrome): `drawTitleBackdrop` replaces the flat tint with one that
  weighs on the top/bottom edges plus a corner vignette, leaving the centre clear;
  `drawMenuSlab` is the translucent slab with gilt corner brackets behind the items; the
  logo is `LOGO_IMG` (the picture `docs/media/logos/mainMenuSoftfall.png` keyed and baked to
  `js/baked/logodata.js` by `app/bake-logo.js`), drawn 1:1 with its top `LOGO_Y` below the view's top edge under a cold pulsing glow,
  still at rest, with no rule and no subtitle, the pixel-font word standing in only until it
  decodes. Nothing on the title burns and nothing is ruled: `drawEmbers` and `drawGoldRule` live
  here for the wiki's header and the end screens (js/ui/screens.js). `PATCH_TXT` prints bottom-right and the
  profile's name bottom-left (`drawProfileTag`, js/ui/profile-card.js); both are click targets, and both ride the footer's
  fade so a panel hides them.
- **Items** are plain words in the pixel font at `MENU_TXT_SCALE` with a dark rim (`drawPixelTextOutline`): white,
  and gold and lifted a px only under the pointer, or as the keys' pick until the pointer next
  moves (`menu.keyNav`; `menu.hover[i]` eases 0→1 toward it), a press (`menu.pressT`) sinking
  it a px; at rest nothing is lit. No plank, slab or frame — the
  **frost plank** (`drawMenuButton`: chamfered slab with hashed wood-grain, a snow cap, icicles,
  corner rivets, a gold rule when hot, and a sealed ice glaze with a cold shimmer when `frozen`)
  is drawn by the lobby's PLAY, the notes' WIKI and the end screens,
  sized `MENU_BW`×`MENU_BH` at `MENU_Y0` where those stand it.
- **Die** (`drawSeedDie`): shows `1 + (SEED % 6)` (faces
  1–6), cycles faces and jitters while hovered, tumbles while `menu.rolling`. It stands on
  the seed row of the [lobby](../rendering.md#lobby)'s map pop-up. Activating it (`rerollWorld`) starts a fade (the lobby's night there) via
  `state.fade` (`{ a, to, spd, color, then }`, stepped in `update()`, painted after the info
  stack) and then navigates to `?seed=<new>&map=<this shape>` — `SEED` is a const everything
  closes over, so a new world is a new page. Boot checks `sessionStorage['softfall.reroll']` and
  lands with the fade clearing from white and the die still settling, and `softfall.select`
  puts it back on the lobby.
- **Panels** slide up from the bottom edge over the still-visible world (`menu.panel`,
  `menu.panelT` over `PANEL_SLIDE_T`, `menu.closing` on the way out); the menu chrome ducks to
  zero alpha underneath. The `'settings'` kind is the existing panel via `renderSettings(now, { bare, slide })` (nothing on the title opens it since the SETTINGS plank went; the code stays for the ESC panel's sake)
  (no dim, no minimap preview, translated by `slide`) — its widgets only take input once
  `menuPanelReady()`, so a click can never land on a half-slid row, and clicking outside the
  slab closes it. The help panel (`helpPanelCv`, controls + the rules of the frostlands) is
  baked at boot (`buildHelpPanel`) but nothing on the title opens it. The `PATCH_TXT` tag
  bottom-right (`patchTagRect` / `overPatchTag`; gold with an underline on hover) opens the
  [patch notes screen](the-hud-corners/the-patch-notes-screen.md).
  The **name tag** bottom-left (`profileTagRect` / `overProfileTag` / `drawProfileTag`,
  js/ui/profile-card.js, the mirror of the patch tag: the profile's name and a quill, gold with an
  underline on hover) opens the [profile card](#the-profile-card) below. The **coin tag**
  top-right (`coinTagRect` / `overCoinTag` / `drawCoinTag`, js/ui/skins.js: the steel coin and
  the purse, gold with an underline on hover) opens the [skins screen](#the-skins-screen).
  Any open panel ducks the logo to zero alpha.
<a id="lobby"></a>
- **Lobby** (`menu.screen = 'lobby'`, the HERO SELECT, entered by a party's FIND MATCH via `beginLobby`): ONE
  screen on its **own painted night** (`drawLobbyBackdrop` — starfield, two additive aurora
  ribbons, a vnoise ridge over a pine line, a lit snow floor, stateless snowfall off the clock,
  the cinematic band; fully opaque at rest, so the live ambient world is never this screen's
  backdrop), laid out **the way a League lobby is**, in the full view (no authored frame).
  `lobbyLayout()`/`lobbyHit()` (which answers `'play'`, `'hero'`, `'map'`, `'ai'`, `'pickN'` (a hero on
  the row) or null) are the rect source for both drawing and the mouse.
  The screen runs the **draft** ([below](../rendering.md#lobby-draft), js/ui/draft.js).
  **Two team panels stand glued to the screen's edges** (`LOBBY_PANEL_W` wide, `drawLobbyRosters`/
  `drawLobbyCard`, js/ui/draft.js): your side's five **frames** down the left, the rivals' down the right, in
  player order under a `LOBBY_HEAD` head, each frame as tall as the view allows up to
  `LOBBY_FRAME_MAX` — the side's paint as a bar down the screen edge, the hero's body at 2×
  toward it (1× in a short view), the name inward of the body and the hero's name under it,
  yours gold-rimmed. Your side's frames show each seat's hero in the pick — faded while only
  pointed at, whole once locked; a gold pip in the inner corner marks a seat that has confirmed
  (its ban or its pick). A rival's frame is **face-down** (the body it came in on as one flat
  shade through the scratch canvas) through the whole draft, until the countdown turns it. At
  the **top centre** is the draft's band (`drawDraftTop`, `DRAFT_TOP` tall): the clock, the
  phase's word, and each side's ban wells. At the **foot**, either side of the draft's word and
  `LOBBY_MAP_IN` in from the panels (`drawLobbyTop`), stand the **map plate** and the
  **target**, each `LOBBY_MAP` square with its name beside it toward the middle in plain white — the
  shape's, the level's — gold only while the picture is under the hand, when
  the plate lifts a px: each is the way into its own pop-up. The map plate (`drawMapPlate`) holds this seed's own
  valley in the picked shape ([map shapes](../world.md#map-shapes)) — `mapChip` bakes it at 1 px a
  sampled tile straight off the grown `ground` (the ice sheets and holes as rolled, the road as
  cut; a neighbouring shape, which has no ground yet, off `mapTerrain` with the road's diagonal
  inked over it) and stamps the camps' glyphs over it (`drawCampIcon` at every `campSites()`
  tile, inked as the chart inks them). The target
  (`drawLobbyTarget`: the practice range's own archery face, `bakeTargetFace` from
  js/draw/practice.js with `bare` set so the rim carries no snow — straw batt, wooden frame, red
  ring, cream, red bullseye) is **worn by the level** (`wreckTargetFace`, baked once per size and
  level, every mark laid out in a 32 px face's pixels and scaled): whole on EASY, one puncture on NORMAL, a few
  punctures and one crack on HARD, crazed through on IMPOSSIBLE — one great split top to bottom
  through the bullseye with branches off it, hairlines in from the rim, a few more punctures.
  Whenever the level it shows changes (`menu.tgtLv`) the
  face swaps and the target jolts for a moment (`menu.tgtT`). In a
  room the map is a readout (the host's world: `'map'` is hit only when `NET.role` is
  `'solo'`) and a guest's target is too. Under the draft's band stands the **hero row**
  (js/ui/heroes.js, `heroCells`/`heroCellAt`/`drawHeroRow`): a `HERO_CELL` well per hero —
  every `CLASSES` entry, then every `HEROES_SOON` one — holding the hero's model cropped to its
  head at 2×, as many to a row as fit between the panels (`heroCols`), each row centred. Each
  hero wears **one fixed look** (`CLASSES[i].look`), so the face is the hero. What you point at
  is gold (red-rimmed while it is a ban), a hovered cell lifts, and the name under the row is the
  hovered hero's, else yours. A banned hero is dimmed and struck through in red (flashing white
  as the bans land); one a person on your side locked is dimmed with your side's bar under it;
  one only a bot of yours holds keeps the bar but stays bright. A coming hero is its model's head as one flat shade
  (`HERO_SOON_INK`), its name grey on hover, and takes no press. A click (`'pickN'` in
  `lobbyHit`) or Left/Right/Up/Down (`lobbyStep(±1)`, past the banned ones) is
  `lobbyPick(i)` → `draftPoint`: in the pick, `setClass` puts the hero, its look and kit on the
  stage at once and `menu.cswapT` pops it. The row dims and refuses outside the draft's two phases
  and once you have confirmed. The hero you fly out with is kept as the profile's hero
  (`draftCount` → `PROFILE.setHero`), which is the one a person starts the next pick pointing at.
  The **stage** under the row holds **your hero** alone (`drawLobbyStage`): the 48 px
  model (`SPRITES.portrait`, [sprites.md](../sprites.md#looks-a-character-on-the-class-body)) at
  `LOBBY_MODEL` (3×; `lobbyLayout` drops it to 2× when the view is too short for its head to
  clear the row and its name, `HERO_ROW_H`) in your side's paint under a warm pool of light with
  a gold ring turning on the snow, and **no weapon and no name under it** — the row carries the
  hero's name, the roster frame yours. **Clicking the figure** (it lifts under the hand; `'hero'` in `lobbyHit`, the
  body's own rect) opens the [hero pop-up](../rendering.md#the-hero-pop-up): the stats and the
  abilities.

  **Three pop-ups** open over the still-lit lobby, one at a time, on one shared ease
  (`menu.popT`, `menu.pop` naming the open one through its fade-out; `popOpen()`/`popHit()`/
  `openPop`/`leavePop`, and `drawPopSlab`/`drawPopX`/`popFrameHit` for the slab, the X and the
  inert hits they share; `m.screen` is `'hero'`, `'map'` or `'ai'` while one is open). Esc,
  Backspace, the X or a click off the slab closes any of them. The **hero pop-up** is
  [below](../rendering.md#the-hero-pop-up). The **map pop-up** (`menu.screen = 'map'`, off the map plate, solo
  only — `beginMapPick`, `mapLayout`/`mapScreenHit`, `renderMapPick`): the picture `POP_PIC` big
  in the middle with a bare **chevron either side** (`drawChevron`, white, gold under the hand) —
  a click or Left/Right is `mapStep(±1)`: the picture slides toward the pressed chevron with the
  neighbouring shape's coming in behind it (`menu.mapSlide = {d, k, from, t}`, clipped to the
  plate, the name already the new one, the lobby's small plate sliding the same way under the
  slab) and `pickMap` saves `settings.mapType` — **the screen never leaves**: the plate shows
  the picked shape (off `mapTerrain` until it is grown) and the pick is spent at LOCK IN
  ([below](../rendering.md#lobby-lock-in)) — the shape's name under it in white, and the **seed row** under
  that (`SEED_TXT` and the [die](main-menu-title.md), gold under the hand; a click is
  `rerollWorld`, which IS a page: it fades through the lobby's own night (`LOBBY_NIGHT`, the
  sky's darkest) and js/app/boot.js clears from it, so a roll never flashes white over this screen —
  white is the reroll's from anywhere else). The keyboard walks two rows (`menu.mrow`: the picture, then the seed —
  Up/Down; the lit row stands in for the hand while the pointer is off the view), Enter on the
  seed rolls, Enter on the picture closes. The **AI pop-up** (`menu.screen = 'ai'`, off the
  target, host or solo — `beginAiPick`, `aiLayout`/`aiScreenHit`, `renderAiPick`): the target
  `POP_PIC` big on the left worn as the hovered (else the picked) level wears it, and on the
  right the **four difficulty plates** (`drawDiffPlates`: `LOBBY_LV_W`×`LOBBY_LV_H`, one per
  `AI_LEVELS` row, stacked easy to hard, each carrying its level's name (js/ai/ai-skill.js — EASY /
  NORMAL / HARD / IMPOSSIBLE) and its tier in pips, the picked one filled in the rivals' paint, the hovered one
  lifting (`menu.dhover`)); a click or Up/Down is `setAiLevel`, which saves the profile's
  settings, and Enter closes. In RANKED the target is not pressed: the bots'
  level follows the party's rating (`NET.botLv`, js/ui/rooms.js).

  <a id="lobby-draft"></a>**The draft** (js/ui/draft.js, `DRAFT`, kept by the host and
  copied to each guest cut to what its side may see, `draftMsg`): `beginLobby` opens it
  (`draftStart`). **Bans** first (`DRAFT_BAN_T`): each team bans one hero while the roster is
  under `DRAFT_BAN_MANY`, one per seat from then on, never leaving fewer than `DRAFT_KEEP`
  (`draftBansPerTeam`; none at all on a roster too small). Every seat points at a hero and
  **BAN** confirms it; a team's bans are its most pointed-at heroes, the people's before the
  bots' (`draftTeamBans`), shown in your side's wells as dim faces while the vote stands, the
  rivals' hidden until the phase ends, then both struck through in red. Then the **blind pick**
  (`DRAFT_PICK_T`), all ten seats at once: a person starts pointing at the hero they came in on,
  **LOCK IN** confirms (`draftConfirm`, the gold ring bursting off the figure). A hero a person
  on your side locked is out for you until your side's people hold every hero still in the pick
  (`draftCanLock`/`draftSideFull`); the rivals may take the same one, and you never see what
  they point at or took, only that they locked. Bots act the moment a phase opens
  (`draftBotBan`: the rival people's own heroes, never their own side's people's;
  `draftBotPick`: the hero their side has least of, leaning to about `DRAFT_RANGED` at range)
  and give a hero up when a person of theirs locks it (`draftYield`). A phase ends early once
  every seat that must act has (`draftCheck`); the clock running out confirms what each seat
  points at, or picks for it the way a bot would (`draftReveal`). The top band's **clock**
  (`drawDraftTop`) is gold while you still have to act; the word at the foot (`draftWord`) is
  BAN or LOCK IN in the [main menu](main-menu-title.md)'s grammar, big (`LOBBY_LOCK_SCALE`,
  white, gold and lifted a px under the hand, sunk a px on the press — no plank), slate once
  you have confirmed. Enter, Space or the word call `pressPlay()` → `draftConfirm`.

  When the pick ends every seat's hero is set (`setClass`) and the **countdown** starts
  (`draftCount`): `menu.countT` runs `COUNT_T` (5) seconds; a gold ring bursts out from the figure's feet across
  the snow (`menu.lockFx` over `LOCK_FX_T`) and its light stays up, the hero row dims,
  and the word gives its place to the whole second left in gold digits (`drawLobbyCount`,
  white the instant it changes, sinking through its second),
  `SFX.countTick` ticking each one (a low bell), and **one rival frame turning face-up per
  tick** (`lobbyRevealed()`: the first at the start, the last on ONE, all of them once it has
  run out — a white flash as each turns). The hero pop-up stays open through the count
  (the figure still opens it, which shuts itself at zero); the count runs to the end (Esc waits
  it out). At rest, Esc/Backspace go back: a leader's to the party's seats (`draftStop`), a
  guest's out of the party. <a id="lobby-lock-in"></a>At
  zero, `lockIn()` — `menu.lockT`, then straight to `beginDrop()` (the eagle
  ride, below) — unless the picked shape is not the one this page grew: a shape is grown at boot
  (`MAP_TYPE`), so `lockIn` then loads `?seed=<this seed>&map=<the pick>` with the ability picks in
  `sessionStorage['softfall.drop']` (no profile holds them) and js/app/boot.js puts them back on and
  calls `beginDrop()` itself; the old page holds the lobby until the new one paints. No
  instructional text anywhere on the screen.

## The profile card

One surface over the dimmed title, in [js/ui/profile-card.js](../../../js/ui/profile-card.js) on
`menu.charT` (`menu.screen = 'profile'`, `beginProfile`/`leaveProfile`, entered from the name
tag). The store behind it is [profile.js](../architecture.md#profilejs): one name and one ledger.
`profileLayout()` is the one rect source for the draw, the hit test (`profileHit`: `'name'`,
`'card'` or off it) and the cursor.

- **The card** (`renderProfileCard`, `PC_W`×`PC_H`, a gold-rimmed well) has the **name field**
  across its head and the **ledger** under a rule — WINS / MATCHES / KILLS / DEATHS / DAYS /
  GOLD as icon, label, dotted leader, number (the character-panel text carve-out;
  `drawLedger`), `ESC BACK` under it. At rest the name stands in gold at 2× with its quill;
  under the hand the field's well shows. A click on it selects the name on a gold band
  (`menu.nameSel`: the next letter replaces it); typing (`menu.nameEdit`) shows the buffer in
  white with a caret, the capacity ticks under it and the underline red while the store would
  refuse it.
- The card **owns the keyboard** (input.js routes to `profileKey` before its own shortcuts):
  letters are the name, Backspace edits it, **Enter keeps it** (`profileCommit`: a refusal
  rattles and floods the field red, `menu.nameShake`, and the card stays) and **Esc or a click
  off the card closes**, keeping a name `PROFILE.setName` accepts and dropping one it refuses.
- A fresh install never sees a form: the profile arrives pre-named (a winter word), and the
  first press on the title goes to play. Every plate here and on the hero row shares one
  grammar (`drawWell`): a dark drop shadow, a slate rim that lightens under the hand and goes
  gold when picked, a navy floor.
<a id="the-hero-pop-up"></a>
- **Hero pop-up** (`menu.screen = 'hero'`, off your figure on the lobby, easing over the
  still-lit lobby on `menu.popT`): a dim, then a floating panel in two columns
  (`heroLayout()`/`heroScreenHit()`, which answers `{ab}` an ability well, `'x'`, `'panel'` or
  null). LEFT is the **live preview** (`drawHeroPreview`): the chosen class walking in place at 4×
  with the class weapon at hand, and under it the **stat ledger**: the seven
  [hero stats](../gameplay/hero-stats.md) at level 1 (`STAT_ROWS`, handed no player here), real
  values off the same `baseKit` (js/sim/player.js) the sim's `refreshKit` starts from, so the page
  can never lie. RIGHT is the **ability column**, four wells, each a button that turns it: one
  well a key wearing the picked option's `classAbIcon` with the key in the corner (the
  keybind-indicator carve-out), a click turning it to the key's next option (`pickAbility` →
  `player.abPick`; [the options on a key](../gameplay/class-abilities-keys-1-4.md): the warrior's
  carry two, the hunter's one, which a click leaves as it is), and a hover raising the option's
  card (`tipClassAb`, hooked in `tipAt`); their growth is the match's own skill points, never
  bought here. The hovered well's name prints once under the panel: what a click would turn it
  to. The keyboard walks `menu.grow` down the four ability wells: on a well (corner ticks) Enter,
  Space or Right turns it and Left turns it back. ESC, Backspace, the **X** in the corner, or a
  click anywhere off the panel close it back to the lobby (`leaveHero`); LOCK IN (and a running
  count) stays on the lobby behind it. The ledger's labelled rows are the PLAYER-panel text
  carve-out: comparing numbers is this panel's whole job.

- **Entrance**: `menu.t` staggers the logo and items in at boot.
- **Menu exit**: `state.intro` counting down from `INTRO_T` (1.6 s) with `state.introLen = INTRO_T`
  is what dissolves the menu — `renderTitle` keeps drawing while it runs: the tint dissolves over
  the first 45 % and the chrome sinks away in the first 22 %. `beginDrop` starts it into the eagle
  ride as the **opening shot**: the camera held dead on your seat while `applyZoom` pulls the view
  out from `DROP_OPEN_ZOOM` (180 rows, tight on you) to `DROP_ZOOM` on `easeInOut(1 - intro / introLen)`; `beginIntro` (debug only, `DBG.beginIntro`) starts it straight
  into `play` with the player already standing in the world, the camera easing from
  `state.introFrom` on the same curve instead of the play lerp.
- **Landing intro**: the human's `landPlayer` sets `state.intro = state.introLen = HUD_IN_T` (0.7 s)
  with `introFrom` at the touchdown framing, so `renderUI` (js/ui/compose.js) slides the HUD in
  (the minimap and the team rail down from the top, the top-left corner — the pack's tab and its
  drawer — from the left by `CORNER_REACH`, and the hud strip up from the bottom by `HUD_SLIDE`)
  while the camera settles onto the play framing.

`DBG` exposes `menu`, `menuHit`, `menuClick`, `menuKey`, `settingsHit`, `beginIntro`, `beginLobby`,
`lobbyLayout`, `lobbyHit`, `pressPlay`, `DRAFT`/`draftAct`/`draftPoint`/`draftConfirm`, `setAiLevel`, `lockIn` and `layout()` (the live `VIEW_W`/`VIEW_H`, `SET_X`/`SET_Y`, `SL_X`, `PANEL_X`/`PANEL_Y` and `MM_CX`/`MM_CY` anchors) for driving all of this headlessly.
The map and the seed die on it are driven the same way through the globals `mapStep`, `rerollWorld` and `pickMap` (which navigates), with `DBG.MAP_TYPE`,
`DBG.MAPS` and `DBG.mapTerrain` reading back what a shape is.

## The skins screen

On the lobby's painted night, in [js/ui/skins.js](../../../js/ui/skins.js)
(`menu.screen = 'skins'`, `beginSkins`/`leaveSkins`, its own ease `menu.skinT`). `skinsLayout()`
is the one rect source for the draw, the hit test (`skinsHit`) and the cursor.

- **The navbar** over the grid's left edge is one tab per `SKIN_TABS` category (SCOUT, EAGLE,
  WEAPON, TRAIL, then a tab per named hero, ARMATOS, FORTIVA and BELLA; `drawSkinTab`): an 8x8 glyph and the word, slate at rest, pale under the hand,
  white on the open tab (`menu.skTab`, the eagle at boot) with a 1 px line as wide as the word.
  A click, Q/E, or up off the grid's top row then left/right (`menu.skNav`) turns it. The purse
  (coin + number) sits over the grid's right edge.
- **A card per row of the open tab**, `SK_COLS` across (`drawSkinCard`): the picture (`skinArt`)
  on a low radial glow of its rarity's colour (`SKIN_RARITY`) at the largest whole scale its
  `SK_ART_H` box holds, capped at `SK_ART_MAX`, still at rest and moving under the hand, on the
  worn card and on a picked one; under a hairline the name and, opposite it, the price (coin +
  number, red when the purse is short) or a tick on the skin worn; a 2 px bar of the rarity's
  colour along the foot. Rims are slate, lighter under the hand, bright steel on the worn and the
  picked card. The weapon and trail tables and every tinted scout row are placeholders: today's
  portrait or bow washed in the row's tint, or a streak in its two colours, and nothing in a match
  wears them. The IRON SCOUT row is real: its card is the robot's own 64 px `icon`, and a match
  wears it (below). So is a hero's tab (`hero` on the tab, ARMATOS's `ARM_SKINS`, FORTIVA's `FORT_SKINS`, BELLA's `BELLA_SKINS`): its card is the
  hero standing in that look.
- **A press** (`skinPress`) on an owned card wears it; on a card for sale it picks it
  (`menu.skPick`) and its price plate lights and pulses; a second press on the same card buys it
  and wears it (`PROFILE.buy`, the card flashes white, the purse flashes, `SFX.coin`). A short
  purse shakes the plate (`SFX.deny`). A click off the cards or Esc drops the pick; Esc with
  nothing picked leaves. The arrows walk `menu.skSel` over the grid, Enter presses.
- **A skin is paint on this screen only.** `birdSkinFor(team)` is the drawer's one question: the
  local player's company wears the skin worn, the other company the free first row (skins are
  not sent over the wire). `drawEagle` asks it at draw time; it is paint, never read by the sim.
  `scoutBody(p)` is the same for a player: only the local player wears the scout skin worn, as a
  body of its own (the IRON SCOUT, [sprites](../sprites.md)), and every other player the class body.
  A hero's look is the exception: it is sent (`p.skins`, [classes](../multiplayer.md#classes)), so
  everyone sees the look a person wears; bots wear the hero's own.
