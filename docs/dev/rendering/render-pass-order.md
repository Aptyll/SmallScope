# Render pass order

`render()` (js/draw/render.js) runs, in order; most steps are named functions in js/draw/passes.js
(`drawGroundPass`, `drawFlatPass`, `drawSorted` and its `drawSceneryObj`, `renderAirLayer`,
`renderScreen` and the rest). **World space** (`ctx = wctx`):

1. `syncCasts` (repaint the shade of any scenery that changed, [cast shadows](light-and-weather.md#cast-shadows)) →
   ground blit → **the creek's fish** (`drawCreekFish`, js/draw/ground.js: whitefish and snow char under the
   water, at `SWIM_A` alpha with a rim in the water's own shade) → **the creek's current**
   (`drawCreekFlow`, the same file: glints drifting downstream over the still water the bake laid
   and over the fish, on the field's clock) → under-ice fish (`drawIceFish`, js/draw/lakes.js: frost pike and gold sunfish,
   `SPRITES.iceFish[kind].shadow` at 0.42 alpha, a solid rim over a half-strength core, and the crisp `swim` sprite clipped to the open-hole
   tiles round a fish crossing one) → **the orca's shadow** (`drawOrcaShadow`, js/draw/orca.js:
   the same look at a deer's size, cut to the ice's own pixels so it never shows over the road it
   swims under, darkening as it comes up, gone while it is out) →
   ice-crack decals → ice breaks (`drawIceBreaks`, js/draw/icebreak.js);
2. `PRACTICE` only: `drawAgTrack` (the archery rails) and `drawParkourLine` (the start line);
3. **the trampled snow** (`drawTrample`, js/draw/trample.js: the match's slow record of where
   bodies walked and fought, drawn from pooled 128 px chunk canvases repainted only when their
   grid moved - see [trampled snow](../gameplay/trampled-snow.md)) → footprints (walking prints, slide
   grooves, skate scratches and belly-crawl furrows share the one `footprints` array, branching on
   `f.k` - the crisp, short-lived detail over the trample);
4. **the stars reflected in the ice** (`drawIceStars`, `settings.vidStars` — on the surface, so
   it covers the fish and the cracks, and under everything that walks) → `drawDrift` (a
   blizzard day's low streaks, [the day's weather](drawing-a-thousand-of-something.md#the-days-weather)) → **the weather on the
   ice** (`drawLakeSky`, js/draw/lakes.js: blown streaks over big lakes, a frosty night's glints
   and cracks, fresh dust while it snows - [the wind's leavings](../world.md#the-winds-leavings));
5. flat objects (stumps, and **fish nets** via `drawNet`);
6. `drawRecallGround` (the roost rings and the recall's) → `drawClickMarks` (the CLICK scheme's order and lock rings) → `drawCastPreview` (the MOUSE
   scheme's range preview) → `drawAbilityGround` (craters,
   the piercing shot's telegraph) → item drops;
7. the **y-sorted `draws` array** (tall objects, every player, animals, robots, the practice
   targets, sorted by feet Y; empty player slots draw as team-tinted
   silhouettes via `drawGhost`; `pushMiddleDraws` adds the cistern's stone, piece by piece at
   the key of a body standing on it, and the orca out of the water, `drawOrcaBreach`, sorted by
   its hole's waterline and cut at it - [the cistern](../world.md#the-cistern));
8. `drawSelection` (white pulsing corners with a dark shadow over an open wheel's target)
   → `drawWorkHint` (the E work prompt) → `drawFishHint` (the fish brackets);
9. `PRACTICE` only: `drawParkour` (the lap clock and BEST/LAST plate), `drawAgame`,
   `drawAgRings`;
10. construction progress bars → particles → `drawAimLine` (the bow's) → `drawZipGuide` (the
    dotted walk to the hovered zipline, js/draw/zipline.js) → arrows (`drawShaft`);
11. `drawAbilityAir` (the spinning net, the grapple's rope)
    → `drawTowerFx` (each road tower's dashed aim line and ring, js/draw/towers.js);
12. `drawSlashes` (the sword's sweeps) → swing arcs (one per swinging player) → `drawPops`
    (js/draw/pops.js): the floaters (queued through `drawWorldText`, see
    [Text over the world](text-over-the-world.md)) and the farm's coins (plates,
    [gameplay.md](../gameplay/robots.md#farming));
13. `drawSweep` (the wind's slow sweep of loose snow, over every canopy, as strong as the day's
    weather lets it — [the wind field](drawing-a-thousand-of-something.md#the-wind-field))
    → `drawDropAir` (the dotted flight path and a bird on the ground, while `state.drop`
    exists; the fliers draw on the air layer, below) → `drawZips` (each side's zipline cables, span by span with its sag and wind lean —
    over every body and canopy, under the night; the line under the pointer lit gold, `hoverZip`;
    js/draw/zipline.js);
14. `renderLighting` (its first pass `drawFog`, [the fog of war](../gameplay/fog-of-war.md), js/draw/fog.js) → `drawNavPaths` + `drawHitboxes` (the `.` debug overlay — deliberately
    **above** the lighting, see [Debug overlays](debug-overlays-hitboxes-and-routes.md));
15. the air layer (`ctx = actx`): `drawDropAir(…, true)` (a bird in flight, its shadow and trail,
    the riders and every faller) → the zipline riders (`airRiders`, `drawPlayer`) → `lightAir` ([the air layer](world-zoom-and-the-two-pixel-spaces.md#the-resting-zoom-is-always-pixel-exact)).

Then **the world blit** (`ctx = uictx`; `worldCv` scaled onto the canvas — everything above it
drew in world space, everything below draws in screen space; see
[World zoom](world-zoom-and-the-two-pixel-spaces.md)). **Screen space**:
`renderWeather` (snow, see below) →
`renderVignettes` (the frame vignette is a canvas baked once per canvas size and blitted, since
a radial gradient filled over every device px cost 5 ms a frame on a CPU-drawn canvas) →
**`replayTick`** (banks the frame just finished into the replay ring — it
sits here, not at the end of `render()`, so the strip holds no HUD, no dim and no picture of
itself) → `tipResolve` ([the hover tooltip](the-hud-corners/the-hover-tooltip.md)'s one answer for the frame) →
`renderUI` (skipped in `title` and `drop`) → `drawAgameUI` (`PRACTICE`, mode `play`) →
`renderDropUI` (mode `drop` only: your arrow, keybind indicators) → `drawDropBrief` (mode
`play`, only while [the drop brief](eagle-drop-mode-drop.md#the-drop-brief) holds a roost) or `drawHopPrompt` (mode
`play`, the local player still seated on its roost: the HOP OFF key cap — E, or the pad's A disc
while one is in hand) → `renderWorldMap` (the M map, in `play` and `drop`) → `renderWheel` (the radial menu — after
the chart, because a ping wheel opens over it) → `renderSettings` → `renderTitle` (the main
menu, also during the play intro) → `renderReplay` (the replay window: the whole frame on a
death, the corner on pause — **before** the death overlay, whose countdown and ESC prompt draw
over it) → the end-of-match overlay (`renderDead`: the death dim and its planks, or
`renderVictory` / `renderDefeat` — see [The end screens](the-end-screens.md)) → `drawTooltip`
(every mode but an end screen) → the held-TAB scoreboard (deliberately **above** the death dim,
see [Scoreboard and event log](scoreboard-and-event-log.md)) → the info stack (`drawTags`, left
edge at the top quarter: FPS / POS / SEED as aligned label-value rows — one ESC-menu toggle or
F3; only the fps line in `title`) → the screen fade (`state.fade`, the reroll whiteout) → the pixel cursor (always last).

Anything that should be occluded by trees goes into `draws` with a sort key; anything flat goes
in the pre-pass.

A **tree** is 27×37 and draws at `(px - 5, py - 21)` — bottom-aligned on its own tile, trunk on
the tile's centre line, canopy overhanging the tile above (which the `draws`
loop's existing 1-tile top margin and 2-tile bottom margin already cover) — **nudged** off that
line by `treeNudgeX`/`treeNudgeY` (up to 2 px across, 1 px up or down, off the tile's `hash2`) so
the forest does not stand on the tile grid. Only the art moves: the tile, its collision and its
chop reach stay put, and the sprite, its cast shade (`CASTERS.tree`), the work-target rim and the
hit flash all read the nudge. The atlas **row** it draws from is the tile's too (`treeCell`): a
palette variant off the hash, a third of the forest each, and a **tone** for its depth in the
forest (`treeTone`: 0 if any of its 8 neighbours is open, 2 if the ring two out is forest too, 1
between; a dead snag and the world's border count as forest). It is read live, so felling a pine
lightens the ones it opens up. None of it is world state — no `rng`, nothing on the wire. How far over it is
leaning comes from `treeFrame(tx, ty)` off the [wind field](drawing-a-thousand-of-something.md#the-wind-field), never
from a clock of its own, and it is blitted out of **one atlas texture** rather than a per-frame
canvas — see [Drawing a thousand of something](drawing-a-thousand-of-something.md), which is the
largest performance fact in this file. A pine (or a dead snag) drawn **over the viewed hero's
model** opens the **canopy window** ([js/draw/canopy.js](../../../js/draw/canopy.js)): `drawPlayer`
draws that hero's model (body in any pose, held tool, ability marks, snow cover; never its shade
or foot rings) through a small layer as well as onto the world (`heroLayerOpen`/`heroLayerClose`),
and each canopy drawn after the hero in the y-sort counts
the model pixels its own ink covers (`canopyOver`). A covering one composes off-batch with the
model's silhouette cut out of it plus a two-pixel falloff (`CANOPY_CUT`), opened in proportion to
the covered share (full at `CANOPY_FULL`), so the body reads crisp, the forest round it stays
whole, and a tree merely beside or in front of the hero draws untouched. Nothing is stored per
tree. The hero's **work target** — the hovered tree, dead tree, rock,
berried bush or chest — draws under a **pulsing gold rim** (`drawTargetRim`: the buy plates' two
golds, stamped through the scratch canvas at the eight neighbours, the rim grammar of
`drawPixelTextOutline`; a windowed pine's rim opens with it), so the target is its own visible
state everywhere the cursor lands;
a bare bush never rims because `workTarget`'s `ready` gate already refuses it — a *hovered* bare
bush shows its regrow clock instead, the neutral unit bar (`drawHealthBar`, gold) over the plant
filling toward `BUSH_REGROW`, drawn only while the pointer's tile is that bush (`hovO`, resolved
beside `wkO` at any reach, since a look asks nothing of the legs). A **camp anchor**
(a wolf den's mouth; the bears' river camps have none) wears the seconds until the camp is back
over the prop, hovered or not, while the camp is cleared (`drawCampClock`,
[world.md](../world.md#runtime)), nothing while anything in it lives. Only a
covering canopy leaves the atlas batch, so the batch below stays whole. A **dead tree** is a 16×24 snag at `py - 8`. Short ground sprites (bush,
stump) all draw at `py + 4` to stay clear of that band — drop one lower and
a tree on the tile below hides it almost completely. The den is tall enough not to need it: its 21 rows
sit at `py - 4`, the lip on the foot of its two tiles. A **rock** (`drawRock`) stands on the foot of its two tiles like
the den, as tall as its kind: its rubble while it regrows, its cracks and a bar over it while it is
being mined (and closing back up) with the kind's colour risen up its body as far as the bar has come (`SPRITES.rockFill`), a ring of the pick's reach under it (`drawMineRing`), and now and then a glint (a `+` of white, `ROCK_GLINT_T`) off one of its crystal's or
amber's brightest pixels (`SPRITES.rockGlints`) every `glint` s of its kind, `ROCK_GLINT_NIGHT`
times rarer after dark — a reflection, drawn under the grade, never a light. Plain stone never glints.

The **fish net** is the one building that is not in `draws` at all. It lies flat on its hole and
gets walked over, so y-sorting it would put it in front of the player standing on it: `drawNet`
runs in the flat pre-pass instead, at `(px, py)` filling its tile exactly, with its own health bar
and its catch (up to `NET_CAP` fish at `NET_FISH_AT`, each on its own bob, the gold sunfish first in
`NET_FISH_SUN`, the pike in `NET_FISH_PIKE`) drawn into the mesh —
the catch showing through the rope is the only thing that says a net is worth walking to. An
unfinished net fades in with `buildT`, because there is nothing out on the water to stand a frame on. Its construction bar comes from the shared progress-bar pass
like every other building's.

Sprite hit-flash goes through `drawSpriteFlash()`, which recolours via a shared 128×128 `scratch`
canvas with `source-in` — sprites larger than 128×128 will clip (a bear's 112×76 frame is the biggest).

An **item drop** wears its icon centred on its own width over a flat shadow. A drop inside
its [throw lock](../gameplay/the-basic-attack.md#the-item-slots-and-the-drag) draws at half alpha, and only
for the one player it is locked against (`dropLocked(d, viewPlayer())`) — what you just threw away
lies dim until it is yours again, and everyone else sees it whole.

## Snow

Flakes are **world-space**, not a screen overlay, and the zoom reaches them the way it reaches
everything else in the world. Each entry of `flakes` (the block at the top of the `fx updates`
banner) has a world `x/y` and drifts in world px — `spd` down, its own sine sway plus the
[wind field](drawing-a-thousand-of-something.md#the-wind-field)'s drift, which runs the way `state.windDir` does, so snow blows
sideways in a gust, the way the pines lean, and falls almost straight down once the air stills at
night. How much of the field falls is the day's weather's (`state.wx.snow`, [the day's
weather](drawing-a-thousand-of-something.md#the-days-weather)): `renderWeather` draws only that share of the array, the flake on
the edge at the fraction left, so a dawn fade thins the snow flake by flake.

The field is **one world view** in size, not one screen, and that is what makes the zoom read:

- **Count follows the world area on screen.** `fitFlakes()` targets `FLAKE_BASE` (70) per
  `FLAKE_AREA` (480×270) of **world** px — 124 on a 640×360 view at zoom 1 — so zooming out —
  looking at more sky — puts more snow in frame, clamped to `FLAKE_MIN`…`FLAKE_MAX` (26…240)
  because physics alone leaves six flakes on screen at the closest rung and a blizzard of specks
  at the widest, and neither reads as snow. The density per world px is what was tuned, so the
  look at any one spot is unchanged by the wider frame.
- **Grain follows the zoom.** `renderWeather` draws each flake `round(f.size × zoomCur)` px
  across, so up close a flake is a fat crumb rather than a pixel. Between the two the amount of
  white in frame stays about constant while its grain changes, which is what "further away"
  looks like.
- **`fitFlakes()` therefore runs every frame from `updateFx`**, not just from `relayout()`: the
  zoom moves the target as surely as a resize does. Both its loops are no-ops when the count
  already matches, which is every frame but the ones a zoom ease is passing through.

`renderWeather(ex, ey)` wraps every flake **modulo `WV_W`/`WV_H` around the exact camera and
scales up after**, so the field always covers the canvas (`sizeWorldView` ceils, so `WV × zoomCur`
is never short of `VIEW`) while a pan still slides every flake the right way; the wrap is
invisible because it only ever happens at the screen edge. Flakes go through the same
[speck atlas](drawing-a-thousand-of-something.md#specks) as the motes and the stars — `FLAKE_CV`, one baked cell per size — because
240 of them as `fillRect`s with their own `globalAlpha` is 240 draw calls.

A flake does not fall screen-top to screen-bottom: it is born with `h` (30–120) world px left to
fall, **lands** when that runs out, rests on the ground fading out for `FLAKE_REST` (0.7 s), and is
then reborn (`makeFlake`) at a fresh spot in the field.

**The seventy boot flakes come off the main `rng` and that count is load-bearing** — that loop runs
before `genWorld()`, so adding or dropping one shifts the rng prefix and every existing seed with
it. Everything else (resize and zoom top-ups, and **rebirths**) draws from `fxRng`, never `rng`:
the count follows the zoom, so a rebirth off the main stream would make a match's rolls depend on
the player's camera.

Drawn after `renderLighting` (never graded) and before the vignettes and HUD. `DBG.flakes` and
`DBG.cam()` expose the array and the exact camera.
