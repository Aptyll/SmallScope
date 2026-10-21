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
- **Lobby** (`menu.screen = 'lobby'`, the HERO SELECT or champ select, entered by a party's FIND MATCH via `beginLobby`): ONE
  screen laid out **the way League's champ select is**, in Graphite and flat (the party room's
  `SC_*` colours, js/ui/lobby.js), over its **own painted night** (`drawLobbyBackdrop` — starfield, two additive aurora
  ribbons, a vnoise ridge over a pine line, a lit snow floor, stateless snowfall off the clock,
  the cinematic band) dimmed under `SC_BG`, so the live ambient world is never this screen's
  backdrop. `lobbyLayout()`/`lobbyHit()` are the rect source for both drawing and the mouse
  (`lobbyHit` answers `'play'`, `'hero'`, `'swap'`, `'posN'`, `'search'`, `'skinN'`,
  `'skinPrev'`/`'skinNext'`, `'talk'`, `'map'`, `'ai'`, `'pickN'` or null). The screen runs the
  **draft** ([below](../rendering.md#lobby-draft), js/ui/draft.js); its pixels are js/ui/select.js.
  - **The top band** (`drawSelectTop`, `LOBBY_HEAD` tall): the **headline** (BAN A HERO!, PICK
    YOUR HERO!, PREPARE YOUR LOADOUT! once your pick is in and through the count), a **timer
    bar** under it draining toward the middle, and the **seconds** under that — gold while you
    still have to act, and pointed at your own row by a gold arrow in the gutter. Each side's
    **bans** sit in its own top corner, yours left: a dim face while the vote stands, struck
    through in red once made.
  - **Two columns of seat rows** glued to the edges (`drawSeats`/`drawSeatRow`; `pw` wide, at
    most `LOBBY_PANEL_W`, at least `LOBBY_PANEL_MIN`; rows `LOBBY_ROW_MIN`..`LOBBY_ROW_MAX`
    tall): your side's five down the left **in position order** (TOP first), the rivals' down
    the right. A row is a **portrait disc** (`drawSelDisc`: the hero's head trimmed to the disc;
    empty, the seat's position emblem) and three lines: what the seat is doing (PICKING...,
    BANNING...) or its position, the hero big (the position while none is pointed at), the
    player's name. Your side's discs show each seat's hero faded while only pointed at, whole
    once locked, its ring in the side's paint (red for a ban vote); yours wears the graphite
    highlight, a gold ring and the **trade mark** under the disc (`selSwapRect`, `'swap'`: the next
    position no person of your side holds, `draftRole`). An acting row wears a bar down its
    outer edge (gold for yours). A rival's row is **face-down** — only PICKING... or LOCKED IN
    and the name — until the countdown turns it.
  - **The middle**: the **search field** (`drawHeroFilters`, js/ui/heroes.js: right-aligned, a
    click giving it the keys, letters only) over the **hero grid**
    (`heroCells`/`drawHeroRow`: six `HERO_CELL` wells a row, fewer on a narrow view, each
    hero's head at 2× with its name under it; `heroShown` lets through the search's heroes, the
    coming ones only while nothing is typed). Under the grid, when the view
    has the room, the **stage** (`drawLobbyStage`): the hero you point at, its 48 px model at
    `LOBBY_MODEL` (2×) under a warm pool of light with a gold ring turning on the snow; clicking
    it opens the [hero pop-up](../rendering.md#the-hero-pop-up). Then the **confirm plate**
    (`drawSelPlay`, `draftWord`): BAN (red) or LOCK IN, white and live while you have a confirm
    to make, gold under the hand, slate once made. **Once your pick is locked** (and through the
    count, `lobbySplash`) the grid gives way to the **splash** (`drawSplash`: `heroSplash(h, id)`
    art `SPLASH_W`×`SPLASH_H` at 1×, centred and cut on a narrow view; with none painted yet the
    model at 3× on a slice of the night) with the look's name under it and the **skin strip**
    (`drawSkinStrip`/`selSkinCells`: up to `SKIN_SHOW` `SKIN_THUMB_W`×`SKIN_THUMB_H` thumbnails,
    chevrons when there are more; the worn one gold, one the profile does not own dimmed with a
    lock; a click wears an owned one, `draftSkin`).
  - **The foot**: the **chat** bottom left (`drawTalk` at `L.chat`, js/ui/roomtalk.js: up to
    `LOBBY_CHAT_LINES` lines over its plate, your side's only while the draft is on) and the
    **mode** bottom right (`drawSelMode`: 5V5 and the party's mode). The bots' level is not
    here: the leader sets it on the party screen ([settings](../gameplay/settings.md)), and the
    hero's abilities show only in the hero pop-up off the stage figure.

  Each hero wears **one fixed look** (`CLASSES[i].look`), so the face is the hero. What you point at
  is gold (red-rimmed while it is a ban). A banned hero is dimmed and struck through in red (flashing white
  as the bans land); one a person on your side locked is dimmed with your side's bar under it;
  one only a bot of yours holds keeps the bar but stays bright. A coming hero is its model's head as one flat shade
  (`HERO_SOON_INK`) and takes no press. A click (`'pickN'`) or the arrows (`lobbyStep(±1)`, past the banned ones) is
  `lobbyPick(i)` → `draftPoint`: in the pick, `setClass` puts the hero, its look and kit on the
  stage at once and `menu.cswapT` pops it. The grid dims and refuses outside the draft's two phases
  and once you have confirmed. The hero you fly out with is kept as the profile's hero
  (`draftCount` → `PROFILE.setHero`), which is the one a person starts the next pick pointing at.
  **Keys**: Enter starts a chat line (League's; a pad's A is still the confirm, `pad` on its
  key), Space confirms, the arrows walk the heroes, Esc leaves; a chat line or the search field
  takes every key while it is open, and Backspace never leaves the screen.

  **The hero pop-up** opens over the still-lit lobby off the stage figure, on its own ease
  (`menu.popT`, `menu.pop` naming it through its fade-out; `popOpen()`/`popHit()`/
  `openPop`/`leavePop`, and `drawPopSlab`/`drawPopX`/`popFrameHit` for the slab, the X and the
  inert hits; `m.screen` is `'hero'` while it is open). Esc, Backspace, the X or a click off the
  slab closes it. It is [below](../rendering.md#the-hero-pop-up).

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
  `draftBotPick`: a hero their side does not hold yet that plays their position, leaning to about `DRAFT_RANGED` at range)
  and give a hero up when a person of theirs locks it (`draftYield`). A phase ends early once
  every seat that must act has (`draftCheck`); the clock running out confirms what each seat
  points at, or picks for it the way a bot would (`draftReveal`). Space, a pad's A or the
  confirm plate call `pressPlay()` → `draftConfirm`.

  **Positions** (`POSITIONS`, the `draft roles` banner: TOP, JUNGLE, MID, BOT, SUPPORT): as the
  draft opens the host gives every seat one per side (`draftSeatRoles`, `DRAFT.role`): the
  people first, each on the one its profile asks for (`PROFILE.pos`; a guest's rides its
  hello, `NET.pos`) when nobody earlier on the side took it, then any free one, the bots last.
  A seat moves through the whole draft (`draftSwapRole`): a bot holding the asked one trades
  (keeping its hero), a person keeps theirs. A hero has no position of its own: any hero plays
  any of them, and the reveal hands each seat's into the match (`p.position`), where a bot
  plays it (js/ai/ai-farm.js). Your
  side's positions reach a guest in the `draft` message, the rivals' never.

  When the pick ends every seat's hero is set (`setClass`) and the **countdown** starts
  (`draftCount`): `menu.countT` runs `COUNT_T` (5) seconds; a gold ring bursts out from the figure's feet across
  the snow (`menu.lockFx` over `LOCK_FX_T`), the splash takes the middle, and the top band's
  seconds count it down in gold,
  `SFX.countTick` ticking each one (a low bell), and **one rival frame turning face-up per
  tick** (`lobbyRevealed()`: the first at the start, the last on ONE, all of them once it has
  run out — a white flash as each turns). The hero pop-up stays open through the count
  (the figure still opens it, which shuts itself at zero); the count runs to the end (Esc waits
  it out). At rest, Esc goes back: a leader's to the party's seats (`draftStop`), a
  guest's out of the party. <a id="lobby-lock-in"></a>At
  zero, `lockIn()` — `menu.lockT`, then straight to `beginDrop()` (the eagle
  ride, below). No
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
  first press on the title goes to play. Every plate here and on the hero grid shares one
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
  (the minimap and the team rail down from the top, and the hud strip up from the bottom by `HUD_SLIDE`)
  while the camera settles onto the play framing.

`DBG` exposes `menu`, `menuHit`, `menuClick`, `menuKey`, `settingsHit`, `beginIntro`, `beginLobby`,
`lobbyLayout`, `lobbyHit`, `pressPlay`, `DRAFT`/`draftAct`/`draftPoint`/`draftConfirm`, `setAiLevel`, `lockIn` and `layout()` (the live `VIEW_W`/`VIEW_H`, `SET_X`/`SET_Y`, `SL_X`, `PANEL_X`/`PANEL_Y` and `MM_CX`/`MM_CY` anchors) for driving all of this headlessly.
`DBG.MAP_TYPE`, `DBG.MAPS` and `DBG.mapTerrain` read back what a map shape is (`?map=N` picks one).

## The skins screen

On the lobby's painted night, in [js/ui/skins.js](../../../js/ui/skins.js)
(`menu.screen = 'skins'`, `beginSkins`/`leaveSkins`, its own ease `menu.skinT`). `skinsLayout()`
is the one rect source for the draw, the hit test (`skinsHit`) and the cursor.

- **The navbar** over the grid's left edge is one tab per `SKIN_TABS` category (HERO, EAGLE,
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
  wears them. The IRON HERO row is real: its card is the robot's own 64 px `icon`, and a match
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
  body of its own (the IRON HERO, [sprites](../sprites.md)), and every other player the class body.
  A hero's look is the exception: it is sent (`p.skins`, [classes](../multiplayer.md#classes)), so
  everyone sees the look a person wears; bots wear the hero's own.
