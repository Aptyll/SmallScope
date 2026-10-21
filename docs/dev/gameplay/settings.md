# Settings

**The party lobby** (js/ui/rooms.js, `menu.screen = 'room'`) is where QUICKPLAY, RANKED and
PRACTICE TOOL on the title land: the page hosts its own party at once (`beginParty`: a room on the relay, or a
Steam lobby) and NET.mode names the mode. League's party lobby in Graphite: the mode's name at
the head (the leader's opens a list of the modes under it; a click on one, or the keys' Enter, up,
down and Enter, sets it in place, `modeSet`, and spends every guest's READY, since it was said to
the old mode). Down the right edge runs the social column (League's, js/ui/friends.js
`drawSocial`): your face and name at its head with the party's four-letter code in gold under them
(a click copies it, white for a moment; dim with a red dot blinking after it while the link is
down), and your Steam friends under that. Your side's five seats stand in a row with you in the
middle and the others filling outward: a person's seat is a card with a 3x portrait, a name, the
rating in RANKED, a guest's READY tick and link bars (green, amber, red as the round trip grows),
a crown over the leader's portrait; an empty seat is a bare dotted well with a gold + that invites
(the code copied, or Steam's overlay). The leader's pointer on a guest's card shows a red X that
shows them out (`seatKick`). The rival side is never shown here: it is another party met by
matchmaking, or bots. While you are alone JOIN and four slots sit right of the head: type or paste (Ctrl+V) a friend's four letters to join their
party (`partySeek` looks the code up on the relay's list, or in a Steam lobby's data, which
carries the same code: `steamCode`, js/net/transport-steam.js); a code nobody answers to
rattles the slots. The chat sits in the bottom-left corner (js/ui/roomtalk.js): the last four
lines, each a name in its side's paint, clipped at the plate's width, over a plate showing an
ENTER key cap and a speech bubble; Enter or a click on the plate starts a line, Enter sends it,
Esc drops it. At the foot one button, League's, with an X attached before it that leaves: a
guest's READY or the leader's FIND MATCH, dim and flashing the seats it waits on until every
guest is ready (`partyFind`). In QUICKPLAY and RANKED the party then looks for another party doing the
same (js/ui/matchmaking.js): the word becomes a gold clock (a press stops looking) and the clock
also shows after the mode's name on every member's screen. Two parties that find each other play each
other, the one with the higher code reloading onto the other's valley as its rival side; with
nobody found within 8 s, bots take the rival side. After the match each party goes back to its
own party lobby. Then every empty seat on both sides takes a bot and the whole party goes to the
**hero select** (netPhase 'pick', the lobby, js/ui/menu.js), which every member sees as the
leader does, with the code on a 2x plate at the head of your side's roster and a crown over the
leader's card. Everyone drafts there (js/ui/draft.js: bans, then a blind pick all at once; a
guest's presses go through the leader as `draft` messages); a guest sees the leader's map and
target but cannot press them; the count after the pick and the eagle on its zero are the
leader's; the leader's ESC takes everyone back to the party. RANKED keeps a
rating per profile (`PROFILE.rank`, starts at 1000): a win adds RANK_STEP, a loss takes it
(`rankResult`), and the bots' level is read off the party's average rating (`rankLevel`), so
the target cannot be picked there. PRACTICE TOOL's leader has START in place of FIND MATCH
(`partyPractice`): once every friend is READY the leader's page reloads onto the
[practice arena](../world.md#the-practice-arena) hosting the party's code, each guest is told
(`practice`) and follows, joining while the leader's page comes up (`practiceBootHost`,
`practiceBootJoin`). A friend can also type the code from their own party while the party is on
the field, and lands straight on it (`joinRoom` reads the list's `practice` flag). The leader's
LEAVE takes everyone back to the party on the title (the rematch: guests follow on hearing it,
`rematchHeard`); a guest's LEAVE takes only them to the title. A screen that is not in focus when someone joins, a chat
line lands or the count starts flashes its taskbar button (the wrapper) or marks its tab's
title with a star (a browser) until it is looked at. After the match LOBBY takes each screen
back to the same party on a fresh valley, same code, same people in the same seats (the
rematch, js/ui/rooms.js); a guest who presses it first waits until the leader's party is back.
A guest whose leader walks out of the party, or who was shown out, is back in a party of its
own with a rattle; one whose leader leaves mid-match gets the HOST LEFT end screen (a headline
and a LOBBY plank over the frozen world, `hostleft` in DEAD_ITEMS, js/ui/screens.js), and one
whose socket drops mid-match shows a red pip blinking top-centre until the transport redials
(`drawNetLink`). Joining a party whose seed is not this page's reloads the page onto it
(`?seed=N&join=CODE`). Under the wrapper with Steam asked for (`netSteam()`, js/net/net.js) the
party is a Steam lobby (`steamRooms`, js/net/transport-steam.js: the leader writes its name,
patch, seed, state, seat counts and code into the lobby's data). Which relay:
`netRelay()` (js/net/net.js) - `?relay=host:port` once,
remembered with the settings (`settings.relay`), else the page's own host.

`settings` (`v`, `volume`, `musicVol`, `sfxVol`, `mmR`, `mmZoom`, `hudScale`, `hudRail`, `shake`, `muted`, `info`, `pixelCursor`, `hitbox`,
`teamBlue` — your side always painted BLUE, see [teams and colours](../multiplayer.md#teams-and-colours) —
`teamPal` — the VIDEO page's COLOUR BLIND dropdown: `def` (OFF) or a colour-blind palette (`rg`, `by`, `hc`), same section —
`tipFollow` — the TOOLTIP row, the hover panel beside the pointer (the default) or parked bottom
left ([the hover tooltip](../rendering/the-hud-corners/the-hover-tooltip.md)) —
`tipFull` — the ABILITY DETAILS row: HOLD SHIFT (the default: an ability's hover is the short card, Shift opens every rank's numbers) or ALWAYS (`tipClassAb`) —
`aiLevel` — the rival bots' level, picked in the lobby's AI pop-up, an index into `AI_LEVELS` (js/ai/ai-skill.js), NORMAL until moved (a settings save from before EASY is moved up one, `loadSettings`) —
`mapType` — the map shape picked in the lobby's map pop-up, an index into `MAPS` (js/sim/world.js); it is
what the NEXT load grows — LOCK IN reloads onto it when it is not this page's shape ([map shapes](../world.md#map-shapes)) —
`scheme` — the keyboard scheme, `'wasd'` or `'click'` — with `binds` / `bindsClick`, the key
each action is bound to under each
([the two controllers](../multiplayer.md#the-two-controllers)) —
`relay` (above) —
`fpsCap` — the FPS CAP row, frames the loop may present a second, 0 = every frame the screen
offers ([the fixed step](../code-map/app/boot.md)) —
and the five video toggles `vidClouds`/`vidRays`/`vidStars`/`vidSnow`/`vidVig`) persists
**under the player profile** — `saveSettings()` is a call to `PROFILE.putSettings()` and
`loadSettings()` reads `PROFILE.settings()`, which returns `null` when this profile has never
saved any (the pre-profile migration: [architecture.md](../architecture.md#profilejs)). `applyMinimapSize()` must be called after changing `mmR` —
it recomputes `MM_R`/`MM_CX`/`MM_CY`. `hudScale` and `hudRail` (the BOTTOM BAR and TOP BAR SIZE sliders, default **1**; each stops every 5% from 0.5 to 2 and on the screen's crisp sizes, `hudSizes`, and a stored value draws at the nearest stop, `hudSc`/`railSc`) need no apply
call: the hud strip and the rail read them live every frame. A save from before the split (`v` < 4) copies its one `hudScale` to `hudRail`, and `mmR` is clamped to `MM_R_MIN`..`MM_R_MAX` (12..48, shown as a percent of 24)
([rendering.md](../rendering/the-hud-corners/the-hud-strip.md)). (Old saves may still carry `res`, `fps`, `seed`, `paths`, `hudCorner` or `haptics` keys from removed settings;
`Object.assign` in `loadSettings` copies them harmlessly and nothing reads them.)

There is no fullscreen control in the ESC menu (players use F11); a `fullscreenchange` listener still refits the canvas when the
browser toggles it.

**The panel is a flat, solid slab** (`bakeFlatSlab`: an ink outline, one quiet steel line, a flat
night ground, never see-through) headed like the patch notes: its name big and gold with no rule
under it (`drawSlabHead`). A toggle is a switch (gold track, knob
right when on), and the row under the pointer lifts as a band with its name white.

**The panel is tabbed.** A navbar under the title splits the rows into four pages — GAME
(top bar size, minimap size, bottom bar size, screen shake, info display, cursor, tooltip, my team), VIDEO (below),
AUDIO (the three sound dials and the speaker), CONTROLS (the listings, below) — and each page scrolls independently
inside the content window (`SET_CONTENT_Y`..`SET_CONTENT_B`, panel-local 43..202) when its rows
outgrow it, which is what lets the slab hold any number of future settings: the slab is 320×226
(`SET_W`/`SET_H`, canvas.js), and 226 fits under the 240-row floor `fitCanvas()` keeps, so it can never get taller. The wheel over the
open panel scrolls the open page (both the in-match ESC slab and the title's slide-in — the
title also takes W/S and the arrows), a 1 px thumb on the right edge appears only when a page
overflows, and the open page's name wears gold with a 1 px gold line under the word alone
(`drawNavCell`, the CONTROLS sub-navbar the same) while the others sit dim until hovered. Everything inside the panel is laid out by **`settingsLayout()`** (js/ui/panels.js) off
the row tables in `SET_TABS` — draw, hit test and the `DBG.settingsRows` anchors all read the
same function, so a click can never disagree with a pixel. Rows keep the **14 px pitch**;
`settingsHit()`'s bands are `y-3 .. y+10`, touching but never overlapping, so one click can
never land on two rows. It answers a row id, `'mute'`, `'close'`, `'leave'`, `'tab:<id>'`, `'ctab:<id>'`
(a CONTROLS sub-tab), `'c:<row>:<opt>'` (a choice row's word), `'drop:<row>'` (a dropdown's box) or
`'d:<row>:<opt>'` (an entry of the open list). A **choice row** carries its
own `val()` and `pick(id)` in `SET_TABS` — QUALITY's are the preset macro — so the draw (the word in force wears gold), the hit and
the click all read one table. A **toggle row** whose two states have names of their own carries
them there too, as `on`/`off` (CURSOR's PIXEL / BROWSER, TOOLTIP's FOLLOWS POINTER / BOTTOM LEFT, ABILITY DETAILS' ALWAYS / HOLD SHIFT,
MY TEAM's ALWAYS BLUE / AS DEALT); a row without them reads ON / OFF, and a plain toggle's row id
**is** its `settings` key, which is the whole of what its click does. A **dropdown row** (`kind: 'drop'`)
carries `val`/`pick` like a choice row; its box shows the entry in force and a click hangs the
list under it (`setDrop`), drawn over the page outside its clip. While the list is open it takes
the whole pointer: a click on an entry picks it, any click folds it, and ESC folds it before the panel.
The four size sliders share one grammar: the knob lands on the dial's nearest stop, a tick under the
track marks each size `hudCrisp` finds crisp on this screen, and the track past the widget's cap is
sunk (`HUD_DIALS`; [rendering](../rendering/the-hud-corners/the-hud-strip.md)). Dragging one previews its widget over the panel.

**The VIDEO page** holds one QUALITY row, five toggles and the COLOUR BLIND dropdown, every one a cosmetic-only render
pass a weak GPU can shed (they read at draw time; nothing the sim computes changes):
CLOUD SHADOWS (`vidClouds` — `cloudShade`'s two full-view multiply fills, the one pass that
costs every daytime frame), SUN SHAFTS (`vidRays` — `godRays` and its motes), ICE STARS
(`vidStars` — the whole `drawIceStars` pass, mirror included), SNOWFALL (`vidSnow` — the
falling flakes' draw; the sim still moves them), VIGNETTE (`vidVig` — the frame vignette only,
the hurt flash is feedback and never goes). The QUALITY row's LOW / MEDIUM / HIGH words are a
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
flat buttons (`drawFlatButton`, their line and word gold under the pointer): **CLOSE** — the one way out that is a
button; ESC and the pad's B still fold the slab — and, in a match only, the way out beside it,
LEAVE, out of the match or out of [practice](../world.md#the-practice-arena) (the ESC
slab is the one menu either has, so its exit lives there; the title's slide-in has nothing to
leave, so it centres CLOSE alone). SURRENDER stands before LEAVE while your side may vote
(js/sim/surrender.js). `settingsHit()` answers `'close'` (→ `settingsClose`: the
in-match slab folds the way ESC folds it, the title's slide-in through `closeMenuPanel`), `'surrender'` and
`'leave'` (→ `toLobby()`, js/ui/screens.js, the death screen's own fade back to the title on this
seed, or back to the party for a party's leader on the practice field; anyone else there takes
`leavePractice()`, js/ui/menu.js, the reroll's whiteout onto a bare URL, landing on a fresh
title world); `leavePlankRect()` is the LEAVE plank, `null` on the title.

**Mute is not a row.** It is a 9×9 speaker plate (`muteBtnRect`, `drawMuteBtn`) hard against the
left end of the MASTER track on the AUDIO page — `muteBtnRect()` returns `null` on any other
page, and its callers null-check: a cone with two waves coming off it, the waves swapped for a
red × when it is off. While muted all three sound dials draw grey rather than gold
(`drawSliderRow`'s `dim`), so what the speaker silences reads off the page without a word of
text. **N** still toggles the same flag from anywhere.

**The CONTROLS page is itself tabbed** — WASD, CLICK, MOUSE, GAMEPAD (`CTRL_TABS`, each cell
naming its listing in `ctrl`), one listing per controller, since a pad puts the
same verbs somewhere else — and the keyboard's listing is **three cells, one per scheme**: the
cell in gold is the scheme in force (`ctrlCellNow`), and a click on the other makes it the
live scheme (`settings.scheme`, dropping every order the click scheme held) as well as opening
its listing, so there is no SCHEME row and no words to switch. Its sub-navbar is
pinned at the top of the content window (`CTRL_TAB_H`) and only the listing under it scrolls;
it opens on the controller in hand (`ctrlTabNow`: GAMEPAD while a pad is
active — a green pip beside that word says one is — the keyboard otherwise) until a click picks
one. Every listing is **three columns** (`CTRL_COL_X`) grouped by what the verbs are for —
moving and fighting, the kit and its panels, the match's own keys — so it fits the window
without a scroll. The pad's listing is baked once (`bakeCtrlPad` into
`ctrlCvs`, js/ui/panels.js); **the keyboard's is live**: each rebindable verb beside
its key drawn as a **cap** — the same cap the work prompt wears in the world (`drawKeyCap`,
js/ui/wheel.js), printing whatever key the action is bound to — and the fixed ones (the mouse's
buttons, ESC, SCROLL, F3, `.`, where the scheme has room for them) as plain gold text, since nothing about them can be pressed. A
cap is a button: it lifts white on hover, a click sets it **listening** (the face pulses gold)
and the next key down is its key; a key another cap holds swaps the two, a reserved key is
refused, Escape or a click elsewhere calls it off
([rebinding](../multiplayer.md#the-two-controllers)). RESET, a row under the listing at its right
edge, puts the defaults back and sits dim while they already are. `KEY_ROWS` is the three
columns per scheme (an action id, a run of caps on one verb — MOVE, ABILITIES — or a fixed pair), `keyRowsLayout`
places every cap and word listing-local, and the draw (`drawKeyRows`), `settingsHit`
(`'key:<action>'`, `'keyreset'`) and `DBG.keyRows` all read it. Its bake (`ctrlCvs.keys`) is
blank, `KEYS_LIST_H` tall (the listing and its RESET row), and only sizes the scroll.
GAMEPAD draws each button as a picture (`drawPadGlyph`: a face button is a disc with its
letter, a bumper a flat pill, a trigger a tall one, a stick a ring, the dpad a cross with its
pressed arm lit) beside its verb — moving and fighting, the abilities and the kit, then the
match's buttons with the menu set under a rule — and its live readout under them. The bindings themselves: [the two controllers](../multiplayer.md#the-two-controllers).

The title screen's TUTORIAL panel carries
the same keys under `1-4 CLASS ABILITIES`.

`settings.info` (one INFO DISPLAY toggle row in the ESC menu, **or F3**, minecraft-style — the
keydown handler flips it in any mode and suppresses the browser's find bar; default off) shows
the **info stack** — `drawTags()`, a vertical list on the left edge at the top quarter of the
view, drawn above every overlay. Six lines — **FPS** (`loop()`
hands each raw unclamped frame delta to `perfFrame`, js/sim/core.js, which refreshes `perf.fps` every
half second),
**SIM** and **DRAW**, the ms a frame spent in `update()` and in `render()` over the same window
(red together once they no longer fit a 60 Hz frame; DRAW is the script's side only, since a GPU
canvas rasterises later off the main thread),
**SFX**, the sampled sound bank's decoded/asked-for tally (below),
**POS**, the tile coordinates of the player the camera frames (`viewPlayer()`, so spectators read
the watched player), and **SEED**, the run seed (see
[world.md](../world.md#determinism-and-noise)) — each drawn as a dim label plus a value on one
shared x, so the numbers line up in a column. **Red on the fps value (below 45) is the only colour in the
stack that means anything** alongside **SIM/DRAW** and **SFX** (below), and nothing else is
tinted, which is what lets a warning read. In title, FPS, SIM, DRAW and SFX show and POS and SEED
do not.

**SFX** is the sampled sound bank: files decoded / files the table asks for, from `SFX.banked()`,
red on anything missing — why it is there: [Audio](audio.md), *a failed load must never be quiet*.

`settings.hitbox` is the same idea one key over: **`.`** toggles it 0 ↔ 2 in any mode. One press
draws the circles and boxes the sim actually tests over the sprites that hide them, *and* the
route every walker is following with the tile it is heading for; the next press turns both off. It
has no ESC-menu row, only the `. HITBOX` line in the WASD scheme's CONTROLS block (CLICK and
MOUSE leave it out); the rest is in
[Debug overlays](../rendering/debug-overlays-hitboxes-and-routes.md).

Beneath the minimap `renderMinimap()` prints the elapsed clock alone, centred on the disc. There
is no alive count: a match does not end on bodies (`aliveCount()`, js/sim/player.js, has no caller
but `DBG`). Under the disc runs the notice lane, and the **stat sheet** flies into it whenever a
number on yours moves - every row of your sheet, the moved ones lit and blinking, gone again in
eight seconds: [rendering.md](../rendering/the-hud-corners/the-stat-ledger-your-sheet-as-a-notice.md).
