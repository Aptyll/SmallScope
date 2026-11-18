# Settings

**The hub** (js/ui/hub.js, `menu.screen = 'room'`; the party's logic is js/ui/rooms.js) is the
landing page: the title is only passed through (`hubEnter`), so a boot, a match's end, a closed
profile or wiki all land here. The page hosts its own party at once (`beginParty`: a room on the
relay, or a Steam lobby). League's client home in Graphite, flat and opaque: YOU (your face,
name, rank badge and rating, your record and the last ten results as pips, the purse that opens
the skins, the gear that opens the settings, QUIT in the desktop build) and MATCH HISTORY down the
left; PARTY, HEROES and ITEMS in the middle; FRIENDS (Steam's; empty off Steam) and LADDER down
the right. A
panel's click opens its whole page (the profile and its tabs, the wiki, the skins), and that
page's way out comes back here. HEROES walks every hero with its arrows: the four ability wells
(each raises the ability's card), the numbers, and the lit ability's words; ITEMS is that hero's
build (`buildsRec`). LADDER is everyone this screen has met, by rating, you lit.
PARTY's head names it with the count (people of `partyCap`, three: the 3v3's side) and the party's
four-letter code in gold behind a copy mark (a click copies it, white for a moment; dim with a red
dot blinking before it while the link is down). Your side's three seats stand under it with you
in the middle: a person's seat is a card with a portrait, the rank badge, a name, a guest's READY
tick and link bars (green, amber, red as the round trip grows), a crown over the leader's portrait; an empty
seat is a well with a gold + that invites (the code copied, or Steam's overlay). The leader's
pointer on a guest's card shows a red X that shows them out (`seatKick`). PLAY stands at the
strip's right end: a guest's READY, or the leader's PLAY, dim and flashing the seats it waits on
until every guest is ready (`partyFind`). Under the seats runs one row of plates as tall as each
other: while you are alone JOIN and four slots (type or paste, Ctrl+V, a friend's four letters to
join their party: `partySeek` looks the code up on the relay's list, or in a Steam lobby's data,
which carries the same code: `steamCode`, js/net/transport-steam.js; a code nobody answers to
rattles the slots); with people, the chat (js/ui/roomtalk.js: the ENTER key and the newest line;
Enter or a click starts a line and raises the chat over the seats with its kept lines, Enter
sends it, Esc drops it) and under PLAY the X that leaves. There is one mode, RANKED. A profile that has never seen a
match through plays its first PLAY alone as FIRST MATCH (`roomGo`): straight to bots, pinned
EASY (`NET.botLv` 0), with the coach, and its rematch is RANKED. RANKED looks for another party
doing the same (js/ui/matchmaking.js): PLAY becomes a gold clock with an X (a press stops
looking). Solo players and parties looking at once are packed into whole 3v3s, each party kept
on one side, the best host hosting and the others joining its room in place; a room starts once
both sides are full, or with bots in the empty seats after 8 s (longer while more people are on
their way, 30 s at most). After the match each party goes back to its own party. Then every empty seat on both sides takes a bot and the whole party goes to the
**hero select** (netPhase 'pick', the lobby, js/ui/champ-select.js), which every member sees as the
leader does. Everyone drafts there (js/ui/draft.js: bans, then a blind pick all at once; a
guest's presses go through the leader as `draft` messages); the count after the pick and the eagle on its zero are the
leader's; the leader's ESC takes everyone back to the party. RANKED keeps a
rating per profile (`PROFILE.rank`, starts at 1000): a win adds RANK_STEP, a loss takes it
(`rankResult`), and the bots' level is read off the party's average rating (`rankLevel`).
FRIENDS lists your Steam friends (js/ui/friends.js). The
keys walk the seats, right onto PLAY, down onto its X, right into the friends; Esc opens the
settings. A screen that is not in focus when someone joins, a chat
line lands or the count starts flashes its taskbar button (the wrapper) or marks its tab's
title with a star (a browser) until it is looked at. After the match LOBBY takes each screen
back to the same party on a fresh copy of the map, same code, same people in the same seats (the
rematch, js/ui/rooms.js); a guest who presses it first waits until the leader's party is back.
A guest whose leader walks out of the party, or who was shown out, is back in a party of its
own with a rattle; one whose leader leaves mid-match gets the HOST LEFT end screen (a headline
and a LOBBY plank over the frozen world, `hostleft` in DEAD_ITEMS, js/ui/screens.js), and one
whose socket drops mid-match shows a red pip blinking top-centre until the transport redials
(`drawNetLink`). Every page is born on the one map, so joining a party never reloads the page. Under the wrapper with Steam asked for (`netSteam()`, js/net/net.js) the
party is a Steam lobby (`steamRooms`, js/net/transport-steam.js: the leader writes its name,
patch, state, seat counts, code and `seek` into the lobby's data, and the list hands every key back). Which relay:
`netRelay()` (js/net/net.js) - `?relay=host:port` once,
remembered with the settings (`settings.relay`), else the page's own host.

`settings` (`v`, `volume`, `musicVol`, `sfxVol`, `mmSize`, `hudScale`, `hudRail`, `muted`, `info`, `pixelCursor`, `hitbox`,
`teamBlue` — your side always painted BLUE, see [teams and colours](../multiplayer.md#teams-and-colours) —
`teamPal` — the VIDEO page's COLOUR BLIND dropdown: `def` (OFF) or a colour-blind palette (`rg`, `by`, `hc`), same section —
`tipFollow` — the TOOLTIP row, the hover panel beside the pointer (the default) or parked bottom
left ([the hover tooltip](../rendering/the-hud-corners/the-hover-tooltip.md)) —
`camFree` — the CAMERA row: LOCKED (the default) rides your hero, FREE pans at the screen's edge ([camera modes](../rendering/camera-modes.md)) —
`tipFull` — the ABILITY DETAILS row: HOLD ALT (the default: an ability's hover is the short card, the DETAILS key, Alt unless rebound, opens every rank's numbers; the row prints the live bind, an `off` given as a function) or ALWAYS (`tipClassAb`) —
`aiLevel` — the rival bots' level where nothing pinned one (a party's PLAY always does: `NET.botLv`), an index into `AI_LEVELS` (js/ai/ai-skill.js), NORMAL until moved (a settings save from before EASY is moved up one, `loadSettings`) —
`scheme` — the keyboard scheme, `'wasd'` or `'click'` (a saved `'mouse'` wakes on `'click'`, `mendBinds`) — with `binds` / `bindsClick`,
the key each action is bound to under each
([the two controllers](../multiplayer.md#keyboard-and-mouse)) —
`relay` (above) —
`fpsCap` — the FPS CAP row, frames the loop may present a second, 0 = every frame the screen
offers ([the fixed step](../code-map/app/boot.md)) —
`uiSize` — the UI SIZE row, -1 / 0 / 1 (below) —
and the five video toggles `vidClouds`/`vidRays`/`vidStars`/`vidSnow`/`vidVig`) persists
**under the player profile** — `saveSettings()` is a call to `PROFILE.putSettings()` and
`loadSettings()` reads `PROFILE.settings()`, which returns `null` when this profile has never
saved any (the pre-profile migration: [architecture.md](../architecture.md#profilejs)). `applySettings()`
(js/app/boot.js) puts them in force: at boot, and again when Steam Cloud hands over newer ones.

**Steam Cloud.** Under the wrapper the settings and key binds follow the Steam account to any PC:
one file, `settings.json`, through the bridge's `cloudRead`/`cloudWrite` (desktop/main.js on
`steam.cloud`). Every key but `SETTINGS_LOCAL` (js/sim/core.js: UI SIZE, FPS CAP, the video toggles
and `relay`, what this PC's screen and GPU want) rides it. `PROFILE.putSettings` stamps the profile's
`setAt` only when the cloud part really changed (a digest, `setSum`) and writes it up 1.5 s after the
last change; `PROFILE.cloudSync`, once at boot, adopts the cloud's copy when its `at` is newer, else
writes this screen's up. Until that boot read answers, no save here counts as newer, so a fresh PC
saving its defaults never beats the account's. With no wrapper, or the cloud off for the app
(Steamworks' Cloud page needs a quota) or the account, nothing happens. `applyMinimapSize()` must be called after changing `mmSize` (the MINIMAP SIZE slider, default **1**, 0.6..1.5 in 5% steps) —
it recomputes `MM_X`/`MM_Y`/`MM_W`. `hudScale` and `hudRail` (the BOTTOM BAR and TOP BAR SIZE sliders, default **1**; each stops every 5% from 0.5 to 2 and on the screen's crisp sizes, `hudSizes`, and a stored value draws at the nearest stop, `hudSc`/`railSc`) need no apply
call: the hud strip and the rail read them live every frame. A save from before the split (`v` < 4) copies its one `hudScale` to `hudRail`; one from before the square minimap (`v` < 5) turns the old disc's `mmR` into `mmSize` (`mmR / 24`) and drops it and the disc's `mmZoom`; `mmSize` is clamped to `MM_SIZE_MIN`..`MM_SIZE_MAX`
([rendering.md](../rendering/the-hud-corners/the-hud-strip.md)). (Old saves may still carry `res`, `fps`, `seed`, `paths`, `hudCorner` or `haptics` keys from removed settings;
`Object.assign` in `loadSettings` copies them harmlessly and nothing reads them.)

The VIDEO page's DISPLAY row is fullscreen or a window (`setFullscreen`, js/app/canvas.js): the
wrapper's window under Electron (desktop/main.js remembers it in `window.json` beside the page's
storage, so the next launch opens the same way, and F11 or Alt+Enter flips it there too), else the
document's Fullscreen API, which needs the row's click. The row reads the state live
(`fullscreenOn`), and the resize that follows refits the canvas like any resize.

**The panel is a hub panel** (since 0.969; it was a navy slab under a big gold title): `bakeFlatSlab`
lays the Graphite page's plate (`SC_*`, js/ui/lobby.js) in a one-pixel edge inside an ink outline,
square-cornered and never see-through, with the hub's 20 px head (`SET_HEAD`): the panel's name small
on the left (`drawSlabHead`), its pages on the right, one edge line under it. Gold is only for what is
in force: a slider's fill, a toggle's track, a choice's word, the open page's hairline. A toggle is a
switch (gold track, knob right when on), and the row under the pointer lifts as a band with its name
white.

**The panel is tabbed.** A navbar in the head splits the rows into four pages — GAME
(top bar size, minimap size, bottom bar size, info display, cursor, tooltip, my team), VIDEO (below),
AUDIO (the three sound dials and the speaker), CONTROLS (the listings, below) — and each page scrolls independently
inside the content window (`SET_CONTENT_Y`..`SET_CONTENT_B`, panel-local 23..176) when its rows
outgrow it, which is what lets the slab hold any number of future settings: the slab is 320×200
(`SET_W`/`SET_H`, canvas.js), and 200 fits under the 240-row floor `fitCanvas()` keeps, so it can never get taller. The wheel over the
open panel scrolls the open page (both the in-match ESC slab and the title's slide-in — the
title also takes W/S and the arrows), a 1 px thumb on the right edge appears only when a page
overflows, and the open page's name is white with a 1 px gold line under the word alone
(`drawNavCell`, the CONTROLS sub-navbar the same) while the others sit dim until hovered. Everything inside the panel is laid out by **`settingsLayout()`** (js/ui/panels.js) off
the row tables in `SET_TABS` — draw, hit test and the `DBG.settingsRows` anchors all read the
same function, so a click can never disagree with a pixel. The tables hold text keys (`set.*`,
`ctl.*`, [the text table](../rendering/the-text-table.md)) and the layout turns them into words;
a bare number (FPS CAP's 30, 60, ...) prints as itself (`optWord`). Rows keep the **14 px pitch**;
`settingsHit()`'s bands are `y-3 .. y+10`, touching but never overlapping, so one click can
never land on two rows. It answers a row id, `'mute'`, `'close'`, `'leave'`, `'tab:<id>'`, `'ctab:<id>'`
(a CONTROLS sub-tab), `'c:<row>:<opt>'` (a choice row's word), `'drop:<row>'` (a dropdown's box) or
`'d:<row>:<opt>'` (an entry of the open list). A **choice row** carries its
own `val()` and `pick(id)` in `SET_TABS` — QUALITY's are the preset macro — so the draw (the word in force wears gold), the hit and
the click all read one table. A **toggle row** whose two states have names of their own carries
them there too, as `on`/`off` (CURSOR's PIXEL / BROWSER, TOOLTIP's FOLLOWS POINTER / BOTTOM LEFT, ABILITY DETAILS' ALWAYS / HOLD ALT,
MY TEAM's ALWAYS BLUE / AS DEALT); a row without them reads ON / OFF, and a plain toggle's row id
**is** its `settings` key, which is the whole of what its click does. A **dropdown row** (`kind: 'drop'`)
carries `val`/`pick` like a choice row; its box shows the entry in force and a click hangs the
list under it (`setDrop`), drawn over the page outside its clip. While the list is open it takes
the whole pointer: a click on an entry picks it, any click folds it, and ESC folds it before the panel.
The four size sliders share one grammar: the knob lands on the dial's nearest stop, a tick under the
track marks each size `hudCrisp` finds crisp on this screen, and the track past the widget's cap is
sunk (`HUD_DIALS`; [rendering](../rendering/the-hud-corners/the-hud-strip.md)). Dragging one previews its widget over the panel.

**The VIDEO page** opens with DISPLAY (above) and **UI SIZE**: SMALL / MEDIUM / LARGE scale the
whole interface (menus, HUD, text) a whole device px per game px smaller or larger than the default
(`uiDevFor`, js/app/canvas.js), never the world: the zoom ladder is measured against `worldDev`, so
every screen still sees the same rows of world ([world zoom](../rendering/world-zoom-and-the-two-pixel-spaces.md)).
The size in force lights, so a window too small for LARGE keeps MEDIUM lit. Under them it holds one QUALITY row, five toggles and the COLOUR BLIND dropdown, every one a cosmetic-only render
pass a weak GPU can shed (they read at draw time; nothing the sim computes changes):
CLOUD SHADOWS (`vidClouds` — `cloudShade`'s two full-view multiply fills, the one pass that
costs every daytime frame), SUN SHAFTS (`vidRays` — `godRays` and its motes), ICE STARS
(`vidStars` — the whole `drawIceStars` pass, mirror included), SNOWFALL (`vidSnow` — the
falling flakes' draw; the sim still moves them), VIGNETTE (`vidVig` — the frame vignette only,
the dark edge that closes in on a blow taken is feedback and never goes). The QUALITY row's LOW / MEDIUM / HIGH words are a
macro over four of them — clouds, shafts, stars and the vignette (`VID_PRESETS`): LOW turns them all off, MEDIUM keeps
everything but the cloud shadows, HIGH is everything, and the word matching the current mix
wears gold — a hand-picked mix golds none of them. SNOWFALL is deliberately in no preset:
falling snow is the game's identity and nearly free, so only a deliberate hand turns it off.
Between QUALITY and the toggles sits **FPS CAP** — 30 / 60 / 120 / 144 / UNLIMITED, a choice row
whose words are numbers because the row is an instrument — `settings.fpsCap`, which
`capSkips` (js/app/boot.js, [the fixed step](../code-map/app/boot.md)) reads at the top of every
animation frame: a frame under the cap is skipped whole, its time banked into the next, so
the sim still takes every 1/60 s step it is owed and only the presentation thins. UNLIMITED
is every frame the screen offers. Last sits **COLOUR BLIND**, the team palettes
([colour-blind palettes](../multiplayer.md#teams-and-colours)) named by what each is for: OFF,
PROTANOPIA / DEUTERANOPIA, TRITANOPIA, ACHROMATOPSIA, each entry beside its palette's chip.

**The foot is buttons, not a hint.** Under the content window (`SET_FOOT_Y`, `footPlanks`) sit
flat buttons (`drawFlatButton`, the hub's foot plates, their edge and word pale under the pointer, LEAVE? red): **CLOSE** — the one way out that is a
button; ESC still folds the slab — and, in a match only, the way out beside it,
LEAVE, out of the match (the ESC
slab is the one menu a match has, so its exit lives there; the title's slide-in has nothing to
leave, so it centres CLOSE alone). SURRENDER stands before LEAVE while your side may vote
(js/sim/surrender.js). `settingsHit()` answers `'close'` (→ `settingsClose`: the
in-match slab folds the way ESC folds it, the title's slide-in through `closeMenuPanel`), `'surrender'` and
`'leave'` (→ `toLobby()`, js/ui/screens.js, the death screen's own fade back to the title).

**Mute is not a row.** It is a 9×9 speaker plate (`muteBtnRect`, `drawMuteBtn`) hard against the
left end of the MASTER track on the AUDIO page — `muteBtnRect()` returns `null` on any other
page, and its callers null-check: a cone with two waves coming off it, the waves swapped for a
red × when it is off. While muted all three sound dials draw grey rather than gold
(`drawSliderRow`'s `dim`), so what the speaker silences reads off the page without a word of
text. **N** still toggles the same flag from anywhere.

**The CONTROLS page is itself tabbed** — WASD and CLICK (`CTRL_TABS`), **one cell per
scheme**: the cell in gold is the scheme in force (`settings.scheme`), and a click on another
makes it the live scheme (dropping every order the click scheme held) as well as showing its
listing, so there is no SCHEME row and no words to switch. Its sub-navbar is pinned at the top
of the content window (`CTRL_TAB_H`) and only the listing under it scrolls. The listing is
**three columns** (`CTRL_COL_X`) grouped by what the verbs are for — moving and fighting, the kit
and its panels, the match's own keys — so it fits the window without a scroll, and it is
**live**: each rebindable verb beside its key drawn as a **cap** — the same cap the work prompt
wears in the world (`drawKeyCap`, js/ui/wheel.js), printing whatever key the action is bound to —
and the fixed ones (the mouse's buttons, ESC, SCROLL, F3, `.`, where the scheme has room for
them) as plain gold text, since nothing about them can be pressed. A cap is a button: it lifts
white on hover, a click sets it **listening** (the face pulses gold) and the next key down is its
key; a key another cap holds swaps the two, a reserved key is refused, Escape or a click
elsewhere calls it off ([rebinding](../multiplayer.md#keyboard-and-mouse)). RESET, a row under
the listing at its right edge, puts the defaults back and sits dim while they already are.
`KEY_ROWS` is the three columns per scheme (an action id, a run of caps on one verb — MOVE,
ABILITIES — or a fixed pair), `keyRowsLayout` places every cap and word listing-local, and the
draw (`drawKeyRows`), `settingsHit` (`'key:<action>'`, `'keyreset'`) and `DBG.keyRows` all read
it; `KEYS_LIST_H` (the listing and its RESET row) sizes the scroll.

`settings.info` (one INFO DISPLAY toggle row in the ESC menu, **or F3**, minecraft-style — the
keydown handler flips it in any mode and suppresses the browser's find bar; default off) shows
the **info stack** — `drawTags()`, a vertical list on the left edge at the top quarter of the
view, drawn above every overlay. Five lines — **FPS** (`loop()`
hands each raw unclamped frame delta to `perfFrame`, js/sim/core.js, which refreshes `perf.fps` every
half second),
**SIM** and **DRAW**, the ms a frame spent in `update()` and in `render()` over the same window
(red together once they no longer fit a 60 Hz frame; DRAW is the script's side only, since a GPU
canvas rasterises later off the main thread),
**SFX**, the sampled sound bank's decoded/asked-for tally (below), and
**POS**, the tile coordinates of the player the camera frames (`viewPlayer()`, so spectators read
the watched player) — each drawn as a dim label plus a value on one
shared x, so the numbers line up in a column. **Red on the fps value (below 45) is the only colour in the
stack that means anything** alongside **SIM/DRAW** and **SFX** (below), and nothing else is
tinted, which is what lets a warning read. In title, FPS, SIM, DRAW and SFX show and POS
does not.

**SFX** is the sampled sound bank: files decoded / files the table asks for, from `SFX.banked()`,
red on anything missing — why it is there: [Audio](audio.md), *a failed load must never be quiet*.

`settings.hitbox` is the same idea one key over: **`.`** toggles it 0 ↔ 2 in any mode. One press
draws the circles and boxes the sim actually tests over the sprites that hide them, *and* the
route every walker is following with the tile it is heading for; the next press turns both off. It
has no ESC-menu row, only the `. HITBOX` line in the WASD scheme's CONTROLS block (CLICK
leaves it out); the rest is in
[Debug overlays](../rendering/debug-overlays-hitboxes-and-routes.md).

While no team rail is up, `renderMinimap()` prints the elapsed clock alone over the minimap's right
edge. There is no alive count: a match does not end on bodies. In the top-right corner runs the
notice lane, and the **stat sheet** flies into it whenever a
number on yours moves - every row of your sheet, the moved ones lit and blinking, gone again in
eight seconds: [rendering.md](../rendering/the-hud-corners/the-stat-ledger-your-sheet-as-a-notice.md).

## The FIRST MATCH

**The FIRST MATCH** (`PARTY_MODES.guide`) is a real 3v3 against EASY bots with the coach on (js/ui/guide.js);
the title's FIRST MATCH goes straight to the hero pick, its draft has no ban phase (`draftBansPerTeam`) and its pick has no clock at all (`draftPickT`): it waits for LOCK IN.
The game's very first launch (`PROFILE.firstRun`: no profile was saved before this boot) skips the title and opens that pick
at once (js/app/boot.js), unless the boot came for something else (a join, a party back, the field, a tool's `?seed=N` or `?local=N`).
A FIRST MATCH played alone ends on the title, by LEAVE or by its result (`titleUrl`, the way `rematchUrl` sends it, js/ui/rooms.js);
with friends in the party it goes back to the party like any match. In the pick the starters (`starter` in `CLASSES`) wear a gold
diamond while the profile is new or the mode is FIRST MATCH (`heroStarterLit`), and every face wears its `style` emblem (`styleIcon`, js/ui/heroes.js).

Before the first lesson the camera shows the goal (`guideTourAim`, the play camera's branch in js/sim/sim.js): once
both birds are down and your landing's headline is gone, it rides your lane from your eagle to theirs (`guideTourPath`; the
middle road for MID or the jungle) over `GUIDE_TOUR_GO`, zoomed out to the shows' framing, holds `GUIDE_TOUR_HOLD` on their bird
under **DRIVE OFF THEIR EAGLE** in their paint (`guideTourDraw`, `drawHeadline`, js/draw/eagle.js), and the follow camera glides
home. Walking `GUIDE_TOUR_STOP` cuts it short.

The coach is this screen's UI only: it reads the local player and never writes the sim, so every screen
in a FIRST MATCH party coaches its own player. The card is down with the rest of the HUD while a bird driven off has the camera (`hudHome`, js/ui/strip.js). One flat graphite card sits centred on the hud strip's
buy plates (`GUIDE_LIFT` over them), its head row drawn `GUIDE_K` view px to each of its own so a first look finds it: the key caps of the live scheme (`keyCap`) or an emblem, and one word, a gold count where a lesson has one, a
dim X that turns the coach off for good (`guideClick`, which also sets `PROFILE.setGuided`), and a row of
pips over it, one per lesson. One line of detail at the view's 1x stands open under the word for a lesson's first `GUIDE_TIP_T` seconds, then folds away; the DETAILS key (or ABILITY DETAILS on ALWAYS) opens it again. A
lesson's whole meaning is its `GUIDE_STEPS` row: MOVE (walk `GUIDE_MOVE_PX` off the landing), SHOP (any
buy; it holds the card until then, with a gold arrow over your side's stall or merchant wherever you walk, and at the open counter over BUY while the pick can be bought: `renderGuideShop`), LANE (your position's emblem, `posIcon`, and an arrow over where your lane's laner waits, `laneHold`; done within `GUIDE_LANE_PX` of it, or with the fight in front of you; the jungle has no lane and skips it), ABILITIES (two casts; a key a point would learn
pulses gold), LAST HIT (three), RECALL (shown once the purse holds `GUIDE_RECALL_GOLD` or health is
under half; done standing in the roost ring), TOWER (a rival tower falls; the arrow over the nearest)
and THEIR EAGLE, which stays to the end. LANE, ABILITIES and LAST HIT carry the seconds until the first wave leaves the barracks, in gold (`guideClock`, `guideWave`).
The card shows the first lesson not yet learned (`guideNext`), unless one's moment has come, which is shown ahead of its turn (`now`): LAST HIT while a rival soldier of your lane is on the screen (`guideFightUp`), RECALL the instant your health is under `GUIDE_HURT` past `GUIDE_HOME_PX` from home (`guideHurt`), until it is back over `GUIDE_HURT_OUT`. The shown lesson is judged before the card changes, and RECALL (`away`) is learned in the ring even after SHOP has taken the card. Every
lesson's count starts as the coach does, so one done before its turn shows learned the moment its card comes up.
An arrow off screen is a 2x chevron on the view's edge, kept under the top bar and over the card. While a respawn clock runs the card stands in the same place with the lesson of that death (`guideDeathLesson`, read off `player.deathLog`): TOWER when a tower dealt `GUIDE_DEATH_TOWER` of the blows, else RECALL; its line of detail stays open and it wears no X. A
finished lesson holds its card gold for `GUIDE_FLASH`. The title stops offering FIRST MATCH once every
lesson but the last is learned, the X is pressed, or any match reaches its result.

LEAVE in any match asks first (`settingsLeave`): its first press turns the plank red and reads LEAVE? until the second press leaves, another press on the slab calls it off, or the slab closes (no clock: a timed ask ran out under a slow hand).

RANKED is open from the first boot, with no matches to play first.
