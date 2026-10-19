# Where things live in the game code

The game code is ~34000 lines of flat top-level code across the folders of js/ (app, sim, ai, net, draw, ui, sprites and baked: [architecture.md](architecture.md) says which job each holds) sharing one global
scope ([architecture.md](architecture.md) has the file table and the load order), organized
inside each file only by banner comments of the form `// ------ name`. **Keep every banner
honest** — one that has drifted from what sits under it is worse than no banner, because it sends
future sessions to the wrong 600 lines. If a section grows past ~250 lines or picks up a second
responsibility, split it and add the new banner to its file's table below.

Grep the banner (`// ------ actions`) to jump; the function names are the durable anchors —
don't cite line numbers here, they go stale within a session. Sections follow index.html's load
order; the legacy `audio.js` row rides along because its dials get asked after constantly.

## js/app/audio.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the songs, the sampled one-shots, the dials behind them | `SFX.music`, `TRACKS`, `SAMPLES`, `smp`, `trim`, `loudness`, `level`, `setAmbience` | its own IIFE — see [gameplay.md](gameplay.md#audio) |
| BORROWING the music layer and giving it back where it was taken (the trading post's song) | `musicHold`, `musicRelease`, `held`, exposed as `SFX.music.hold`/`release`/`held` | `music` (its one caller: `openShop`/`closeShop`, js/ui/shop.js) |
| the market's two notification cues, and the one cue built out of two clips | `SFX.market(up)` (till / thud), `SFX.restock()` (the wagon, then the bell `RESTOCK_RING` behind it), the `spike`/`crash`/`freight`/`restock` rows of `SAMPLES` | its own IIFE (their callers: `marketNews`/`shopRestock`, js/ui/shop.js) |
| the notification layer — nothing in the world making a noise, and none of it jittered | `SFX.countTick`, `SFX.ui(open)`, `SFX.notch`, `SFX.turn`, `SFX.wheelUp`, `SFX.record`, `SFX.runUp(n)`/`SFX.runBroke`, `SFX.alarm`, `SFX.marked`/`SFX.dazed`, `SFX.stat(up)` (a number on your own sheet moved), `SFX.nightFall`, `SFX.warp`, `SFX.spectate`, `SFX.defeat`, `SFX.bigHurt`, `SFX.botOut` | its own IIFE — the `count`…`botOut` rows of `SAMPLES` (who calls each: [gameplay.md](gameplay.md#audio); `SFX.alarm`'s spacing `EAGLE_WARN_GAP`: js/sim/eagle.js) |

## js/sprites/core.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the `SPR` helpers every sprite file bakes with (`bake`, `flipH`, `bakeClips`/`mapClips`), and the team palettes | its head; `teams` | `teams` |

## js/baked/motion.js (generated)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the players' run, held run and dodge roll grids for both classes, each upright frame's first face row, the bobs and the roll's timing; never edit, rebake with app/bake-player/bake.py (doll.py paints and inks, bodies.py builds the two class bodies, anim.py poses them, preview.py lays every frame out on one sheet) | `BOX`, `GRIDS`, `FRINGE`, `RUN_BOB`/`HOLD_BOB`, `ROLL_AT` → `SPR.motion` | - |

## js/sprites/characters.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the player, the fish catch pose, the skater, prone, the raider | by banner | `player`, `the fish catch`, `skater (champion 2)`, `prone`, `raider` |
| the run, the held run and the roll in a paint: motion.js's grids baked a facing at a time on first use, a look's fringe on their upright frames | `motionSet`, `fringeAt`, `MOTION_CLS` | `run and roll` |
| a character's paint on the class body: the tone and hair-colour tables, the six fringes, the per-character bake and its cache | `LOOK`, `fringed`, `lookPal`, `lookSet`, `champLook` | `looks` |

## js/sprites/looks.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the 48 px character model: the two bodies, three heads, four beards, six hair styles, two class outfits, and the compose | `BODY`, `HEAD`, `BEARD`, `HAIR`, `OUTFIT`, `modelPal`, `portrait` | `bodies` (the file's one banner; the rest follow it by const name) |

## js/sprites/terrain.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the pines' bend frames and their nine palettes (`treePals`, filtered from `TSPAL`), gold ore, the gold mine, the bush at each stage | by banner | `trees`, `gold ore`, `gold mine (32x32, occupies 2x2 tiles)`, `bush` |

## js/sprites/rocks.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the three rock kinds' grids and their rubble, the crack overlays the channel draws, the glint sites | `RKPAL`, `common`/`rare`/`legendary` and their `*Spent`, `cracks`, `glints` → `SPRITES.rock`/`rockSpent`/`rockCracks`/`rockGlints` | the file's head |

## js/sprites/beasts.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the imp, the rabbit, the deer, the wolf, and the clip sets built from them | by banner (`bakeClips` at the foot) | `imp`, `rabbit`, `deer`, `wolf` |

## js/baked/bears.js (generated)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the brown bear (`dire`) and black bear (`alpha`) clips; never edit, rebake with app/bake-bears/bake.py (the rig: rig.py paints and bands, bear.py lays out and poses, anim.py holds the clips) | `BROWN`/`BLACK`, `BROWN_PAL`/`BLACK_PAL`, `TOP` (each frame's `top`: the tells), each bear's `crown` (its frame over the tallest pose but the roar) | - |

## js/baked/snowdrops.js (generated)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the warren's snowdrop clumps: four variants in 24 px cells, each shut and open at three wind leans and picked, and the open bloom's turning glow (kept as spark points); never edit, repaint with `python3 app/bake-snowdrops/paint.py` and rebake with `node app/bake-snowdrops/bake.js` | `SPRITES.snowdrop[variant]` (`closed`/`open`/`picked`/`glow`/`bell`/`at`; drawn by the snowdrop branch of `render()`, js/draw/render.js, `SNOWDROP_SWAY`, and lit by `litSnowdrops`, js/draw/light.js) | - |

## js/baked/robot.js (generated)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the IRON SCOUT skin (`robotSkin[skin(team)]`: `down`/`up`/`right`/`left` × `idle`/`run`, `top`, `foot`, `icon`); never edit, rebake with app/bake-robot/bake.py (the rig: rig.py) | `GRIDS`, `ICON`, `BASE`, `TOP`/`FOOT` | - |

## js/baked/pump.js (generated)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the gold pump (`teamBuild[skin(team)]`: `pumpAnim[tier][frame]`, `generator[tier]` the still, `icon.generator`; `SPRITES.pumpMouth`); never edit, repaint in app/bake-pump/pump.py and rebake with app/bake-pump/bake.py | `TIERS`, `ICON`, `BASE`, `MOUTH` | - |

## js/baked/orca.js (generated)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the orca (`SPRITES.orca`: the breach stood up out of the water, jaws `open`/`shut` and their mirrors `openR`/`shutR`, its `jaw` point in the `bcell`; the shadow under the ice, `shade(heading, step)`, 64 headings from east, clockwise, 8 steps of the tail's beat, in `cell` squares, baked on first use); never edit, repaint in app/bake-orca/paint.py (it rebakes this file) | the file's head | - |

## js/baked/cistern.js (generated)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the cistern (`SPRITES.cistern`: `geo` its measures in tiles, `flat` the sills and every shadow, `segs` the standing stone in y-sorted pieces with their keys, `solid` the footprint as runs per ground row, all in box px round the crossing); never edit, repaint in app/bake-cistern/paint.py (it rebakes this file) | the file's head | - |

## js/sprites/eagle.js (plain script, no art)

| Looking for | Start at | Banner |
| --- | --- | --- |
| what each bird skin IS: id, name, rarity, price in coins (its art: every skin is a look of Perch's, `SPRITES.perch`, perch.js; their cards `SPRITES.birdSkinIcon`) | `BIRD_SKINS` | the file's head |

## js/sprites/perch.js (IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| what each bird skin wears (the classic, ironclad and the four war eagles' helm, crown and arm armour) and their colours | `LOOKS`, `war`, `palette` | `palettes` |
| the shape tests on the 112 grid and their bounds | `rell`, `blade`, `poly`, `rect`, `box` | `shapes` |
| the bird itself: tail, talons (on the ground only), wings and arm armour, body, saddle, the arrow head with its helm and crown | `build`, `saddle`, `head`, `HEAD` | `the bird` |
| the poses: the roost's beats, level flight's stroke, the stoop (tuck, hold, flare), the takeoff; how a pose moves a part, the per-part map onto a frame, where a seat lands, the wing's light | `POSE`, `REST`, `stroke`/`STROKE_N`, `dive`/`DIVE_N`/`TUCK`/`FLARE`, `LIFT`, `mover`, `placer`, `sizeOf`, `litStep`, `HINGE`/`SHOULDER`/`WRIST`/`FOLD`/`ZK` | `poses` |
| filling the parts at a heading and size, the shading rules, the outline, the snow shadow, the flying shadow's mask | `paint`, `SHADOW` | `painter` |
| the frame cache (urgent and slow queues, the held frame), the riders' seats, the skins cards and the wiki figure, what drawEagle asks | `frame`, `shadow`, `put` (a trimmed frame at its whole frame's top-left), `flash`, `reach`, `warm`, `tick`, `seat`, `icons`, `figure`, `TURNS`/`KEEP`/`BUDGET`/`IDLE_GAP`, `SPRITES.perch` (`has`, `merchSeat`), `SPRITES.birdSkinIcon` | `cache` |

## js/sprites/buildings.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the wall, every tiered piece, the fish net, the bot bay, spikes, fire, the torch | by banner | `wall`, `tiered structures`, `fish net`, `bot bay`, `spikes`, `fire`, `torch` |

## js/sprites/items.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the bag icons, the two that move (the gold nugget, the berry - stepped by `stepItemIcons`, js/draw/render.js), the gold sack and the crate the market plates wear, the axe icon | by banner | `items`, `gold nugget`, `gold sack`, `crate`, `axe icon` |

## js/sprites/icons.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the gear icons, the heart, the cursors | by banner | `gear icons`, `heart`, `cursors` |

## js/sprites/landmarks.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the boat and its palette | `LMPAL`, `boat` | `landmarks` |

## js/sim/core.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the numbers with no one owner: the tile grid, the view, the authored frame the screens centre in, the day cycle | `TILE`, `WORLD`, `VIEW_W`/`VIEW_H`/`FULL_W`, `FRAME_H`/`frameTop`, `DAY_LEN`/`NIGHT_LEN`/`CYCLE` | `constants` |
| the economy: every gold payout in one table | `YIELD` | `constants` (`gainGold`, the one way it is paid: `players`, player.js) |
| tuning for one feature (the bow, the roll, prone, a wolf, a turret, a flag, a fish) | **not here** - each block sits above the code that reads it; find it in this file's per-file section | - |
| the one exception to that: `state` reads it at load, so it cannot live in a later file | `FISH_SPAWN_T` | `constants` (the rest of the shoal: `fish`, wildlife.js) |
| determinism: the seeded stream every world draw comes from | `mulberry32`, `SEED`, `rng` | `rng` (`hash2`/`vnoise`: `ground prerender`, js/draw/ground.js; `treeRare`: `world`, world.js) |
| the singletons | `state`, `settings`, `perf` | `state` (`players`/`player` + the entity arrays: `players`, player.js) |
| settings persistence, the team palette, and the minimap-size helpers | `saveSettings`, `loadSettings`, `applyTeamPal`, `mmScale`, `applyMinimapSize` | `state` |
| `relayout()` — the resize pair's second half | `relayout` | `state` (`fitCanvas`: `canvas`, canvas.js — still the resize pair) |
| page events held until boot: a listener registers here and boot.js attaches them all | `pageListen`, `pageListenStart`, `PAGE_LISTENERS` | `helpers` |
| floaters, particles, drops, cost math, and the HUD's four-character count (`999` › `1.2K` › `340K` › `1.2M`) | `addFloater`, `burst`, `streamTo` (motes from one point to another), `spawnDrop` (returns the drop), `canAfford`, `NUM_SUFFIX`/`shortNum` | `helpers` |
| a thing put down ON PURPOSE: the heading a throw carries, and the three seconds it refuses the hand that threw it | `TOSS_SPEED`, `TOSS_LOCK_T`, `flingDrop`, `lockDrop`, `dropLocked` (set by `throwCell`, js/ui/bag.js, and `shedBits`, js/sim/tools.js; read by the drop loop in `updatePlay` sim.js and the drop draw pass, js/draw/render.js) | `helpers` |
| food: the 1.5 s meal, the 3 s clock berries and fish share, and every way one is broken | `FOOD_CD`/`FOOD_EAT`/`FOOD_SLOW`/`FOOD_FX_T`, `startEat`, `eatBerry`/`eatFish`, `fishToEat` (which kind the fish well eats: the pick, else the smallest meal held), `updateEat`, `breakEat` | `helpers` › `food` (the heal numbers: `ITEMS[type].heal`, `players`, player.js; the wells that draw the clock: `drawFoodClock`, js/ui/bag.js) |
| a roguelike card opening itself the moment it is held on the ground: the count held, the draw, its burst | `cardsHeld`, `useCard` (its callers: `updatePlayer`, sim.js, and the `useCard` intent), `cardFx` | `helpers` › `food` |
| the gold flare and crack an ambush arrow lands with | `ambushFx` | `helpers` |
| a body's running damage total: adding a hit, and the quiet that starts a new one | `tallyHit`, `TALLY_HOLD` (where it is drawn: `queueTally`, js/draw/overhead.js) | `helpers` |
| the gold word a staged archery target says when it breaks: the list, its life and rise | `wordPops`, `wordPop`, `WORD_POP_T`/`WORD_POP_RISE` (aged in `updateFx`, js/sim/sim.js; drawn by `drawTallies`, js/draw/overhead.js) | `helpers` |

## js/app/director.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| director mode's state, its keys (F7 on, arrows/HOME/PAGE UP/DOWN, F8 HUD, F9 the 9:16 frame, F2 record), the free and steady cameras, the strip | `director`, `dirTall` (read by `fitCanvas`), `directorKey` (from `keyPress`, input.js), `dirCam` (first in `update()`'s camera, sim.js), `DIR_*`, `drawDirector` (last in `render()`) | `director` (the detail: [media](media.md#director-mode-filming-the-live-game)) |
| the take: the canvas filmed through its own copy, the sounds off `SFX.tap`, the download | `dirRecStart`, `dirRecStop`, `dirRecFrame` (in `render()`, before `drawDirector`), `DIR_REC_TYPES` | `recorder` |

## js/app/canvas.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| resolution, pillarbox frame | `fitCanvas`, `renderBars` | `canvas` (`relayout`: `state`, core.js) |
| world zoom: the pixel-exact rung, the eased scale, the world view (with the sub-pixel camera's spare px) and this frame's buffer corner, the two coordinate bridges | `ZOOM_*`, `kWant`/`kMin`/`kMax`/`zoomWantOf`, `zoomCur`, `WV_W`/`WV_H`, `wOX`/`wOY`, the air layer `airCv`/`actx`/`airMask`/`amctx`/`airOn`, the midday grade's copy `gradeCv`/`grctx` (todGrade), its riders and box `airRiders`/`airBox`/`airGrow`/`AIR_PAD`/`AIR_TOP` (lit by `lightAir`, js/draw/light.js), `sizeWorldView`, `wToSX`/`wToSY`, `mouseWX`/`mouseWY` | `canvas` |
| panel + minimap layout anchors (`PANEL_*`, `SET_*`, `ROW_*`, `MM_*`), and the map slab's fit to the view (`MAP_W`/`MAP_S`/`PANEL_W`/`PANEL_H` from `CHART_MAX`/`MAP_SIDE`/`MAP_HEAD`/`MAP_FOOT`) | assigned by `relayout()` (core.js) on every resize; `fitMapSlab` | `canvas` |

## js/sim/player.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| players, teams, heroes (`CLASSES`: kit and one fixed look each; `HEROES_SOON`, the ones to come), hero levels, the input struct, contested orders, the local slot and the roster a match is built from | `Player`, `CLASSES`, `HEROES_SOON`, `kitOf`, `setClass`, `gainGold`, `levelUp`, `makeInput`, `localId`/`LOCAL_SLOT`, `defaultRoster`, `initPlayers(roster, local)`, `applyProfile()`, `contest` | `players` |
| the one on-the-spot gold payout every source uses (gold is never a drop) | `awardGold` | `players` (beside `gainGold`) |
| the one way health comes back to a player - a meal, daylight, a second wind, a kill's heal - capped and counted | `healPlayer` | `players` (beside `gainGold`) |
| which way a player's body faces: the one function every turn goes through, its diagonal bias and the hold an aimed action leaves | `faceToward`, `FACE_BIAS`, `FACE_HOLD`, `p.faceT` | `facing` (player.js) |
| the numbers a player is made of: the player count and teams, walk/roll/slide speeds, hero levels, and the two bow baselines a kit is written against | `MAX_PLAYERS`, `TEAM_COUNT`, `PVP`, `PLAYER_SPEED`/`PLAYER_R`, `ICE_MAX`/`SLIDE_MIN`/`SLIDE_EXIT`/`TRAIL_MIN`/`SNOW_TRAIL_*`, `LEVEL_*`/`LVL_*`, `DODGE_*`, `BOW_CHARGE`/`BOW_NOCK` | `players` (above `CLASSES`, which reads some of them at load time) |
| which preset a team wears on this screen, and whether a rival wears its colour-blind shape cue | `TEAMS`, `skin`, `foeCue` | top of the file |
| the entity arrays and the local aliases | `animals`…`camps`, `players`, `player`, `inv` | `players` (the banner's tail) |
| the item table and the two carry stores: the bag's cells, and the uncapped POUCH (`p.food`) every `pouch` kind lives in - count, room, add, take, and putting an instanced cell (a loaded tool) in whole | `ITEMS`, `BAG_CAP`, `isPouch`, `bagCount`, `bagUsed`, `bagRoom`, `bagAdd`, `bagTake`, `bagPut` | `players` › `inventory` (the tool and bit rows register themselves from tools.js) |
| the gear table, the effective kit, buying a piece level | `GEAR`, `GEAR_SLOTS`, `GEAR_COSTS`, `baseKit`, `refreshKit`, `gearCost`, `buyGear` | `players` › `gear` |
| skill points (one per hero level, spent on class-ability levels) | `p.skillPts` (spent by `buyAbilityLv`, abilities.js) | `players` (granted in `levelUp`) |
| roguelike card effects and rarities | `CARDS`, `CARD_RARITIES`, `cardKey`, `CARD_TYPE_RARITY` | `players` › `roguelike cards` |
| how hidden a player is, and how far anything notices it from | `concealOf`, `seenAt`, `ambushReady` | `players` › `being seen` |
| death (which keeps everything on the body), the flat bounty a kill pays, the wait for the bird and the return at it, the one permanent path (a driven-off eagle), the team-level win check | `KILL_BOUNTY`, `die`, `RESPAWN_WAIT`, `respawnTime`, `updateRespawns`, `RESPAWN_OUT`, `respawnPlayer`, `teamInMatch`, `rivalTeamsInMatch`, `checkLastStanding`, `endMatch`, `endSnapshot` | `damage & death` (`teamEagleDown`: `eagle drop`, js/sim/eagle.js) |
| practice undoing a death on the spot | `practiceRevive` (die()'s first branch under `PRACTICE`) | `damage & death` |
| the match record every player keeps, for [the post-game lobby](../../js/ui/lobby.js) | `p.kills`/`p.deaths`/`p.dmgOut`/`p.dmgIn`/`p.dmgBird`/`p.dmgStruct`/`p.hGold`/`p.hDmg`, and the newer half as a table, `PLAYER_RECORD` (`dmgBeast`, `dmgInP`/`dmgInB`, `healed`, `goldSpent`, `beasts`, `streak`/`bestStreak`, `multiN`/`multiT`/`bestMulti` over `MULTI_T`, `ccOut`; an older save is filled from it in `saveApply`, js/sim/save.js) (written in `damagePlayer`, `die` and `healPlayer` here, `hurtEagle` js/sim/eagle.js, `hurtUnit`/`ccCredit`/`hurtStruct` js/sim/actions.js, `pay` js/sim/core.js, `animalDies` + `BEAST_CAUSES` js/sim/wildlife.js, `sampleStats` js/ui/lobby.js; a respawn's `reset` clears none of them) | `players` (declared) / `damage & death` (kept) |

## js/app/input.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the physical key -> game key name translation (e.code, AZERTY-proof), and what a key prints on screen (the layout map) | `CODE_KEY`, `keyName`, `KEY_LABEL`, `keyLabel`, `kbLayout` | `keys and binds` |
| the rebindable actions, their defaults per scheme, the two bind maps and the live one, how anything asks for a key, and a pad's held actions (`actHeld`, written by gamepad.js) | `KEY_ACTIONS`/`KEY_ACT` (`key` / `ck`), `SCHEMES`, `schemeKey`/`schemeActs`, `settings.binds`/`settings.bindsClick`/`binds()`, `mendBinds`, `actKey`, `actHeld`, `keyIs`/`keyHeld`/`keyBound`, `moveDir`, `keyCap`/`keyCapShort`, `keyReserved` | `keys and binds` |
| a cap listening for its key, the swap on a conflict, the reset | `state.rebind`, `rebindStart`, `rebindKey`, `setBind`, `resetBinds`, `bindsDefault`, `rebindLive` | `keys and binds` |
| the raw state, and who moved the pointer last | `keys`, `mouse` (`mouse.src`: mouse / pad) | `input` |
| what a key does, what a button does - the four entry points every controller presses through | `keyPress`/`keyRelease`, `pointerMove`, `pointerPress`/`pointerRelease` | `input` |
| the bare gestures a pad's trigger sends: the draw, the flag wheel, a build wheel with no tile under a pointer, a page scroll | `fireDown`/`fireUp`, `openFlagWheel`, `openWheelNear`, `panelScrollBy` | `input` |
| telling the HAND something happened - a pad's rumble, one call whichever controller is in hand | `HAPTIC`, `haptic` (its caller: `hudFx`, js/ui/bag.js; its off switch: the RUMBLE row, `SET_TABS` js/ui/panels.js) | `haptics` |
| the zoom wheel, the listeners | the `pageListen` block (attached at boot, js/sim/core.js), `wheelZoom` (in play, and dead while watching somebody) | `input` |
| folding keys, mouse and both sticks into the local player's struct | `sampleHumanInput` | `input` |
| the CLICK scheme: its state and constants, the right press and its release, the armed left press, what an order does per step (the walk, the chase and lock, the auto-attack, a use), who an attack-move takes, how far the tool reaches | `ck`, `CK_*`, `ckOn`/`ckClear`/`ckOrder`, `ckPoint`, `merchUnder`, `ckRightPress`/`ckRightRelease`, `ckArmedPress`, `ckSees`, `ckAcquire`, `ckReach`/`ckHoldR`, `ckUse`, `ckStep` (the rings: `drawClickMarks`, js/draw/marks.js; the armed reticle: `cursorInfo`, render.js; the scheme's listing and the navbar cell that picks it: `KEY_ROWS`/`ctrlCellNow`, js/ui/panels.js) | `click to move` |
| the MOUSE scheme (CLICK for one hand): its state, the side buttons as keys, the middle button's action wheel and its pick, readying a well and casting it, the left press's lock | `MS_WHEEL`, `ms`, `msOn`/`msClear`, `msAims`, `msCast`, `msWell`, `msLeftPress`, `msWheelPress`/`msWheelRelease`, `msKitPick`, `sideButton` (the wheel's wedges and label: `drawKitWedge`/`kitLabel`/`kitAb`, js/ui/wheel.js; the range preview: `drawCastPreview`, js/draw/marks.js, reading each row's `aim`, `CLASS_AB` js/sim/abilities.js; the readied well's rim: `drawClassAbCell`, js/ui/hud-draw.js; the `cast` reticle: `cursorInfo`, render.js) | `mouse only` |

## js/app/gamepad.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| which button is which key, in play and over a menu | `PAD_PLAY`, `PAD_MENU` (the dpad's one exception, an end screen's emote bar: `emotePad`, js/ui/screens.js) | `gamepad` |
| the poll, which pad out of the browser's list (a live one over an idle ghost), the sticks, the aim off the body (and a wedge off a wheel's hub), the pointer over a panel, the walk under the panels that keep the world running, the stick-as-arrows repeat, A as the click or the selection | `padPoll`, `padFind`/`padLive`, `padAim`, `padRepeat`, `padTake`, `padMenuMode`/`padPanelMode`/`padPointerMode` | `gamepad` |
| a pad in hand (the CONTROLS page opens on its tab); an unmapped pad's layout read off its rest values; the live sticks and triggers the readout draws | `padActive`, `pad`, `padCalibrate` (`pad.rest`), `pad.raw` | `gamepad` |

## js/sim/cistern.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the cistern at the middle: its measures off the bake, how far from the crossing, a ford outside each culvert and the waves' way round by one, the footprint's distance field, how much of a step a body may take before its feet meet the stone, whether a body stood here would be in it, the road's end on the gates, laying its ground and its tile flags and cuts | `CIST_*`, `cistTiles`/`cistCuts`/`cistField`/`cistOn`, `cisternR`, `cisternC`, `cisternIn`, `cisternTile`/`cisternBlocks`/`cisternTouches`/`cisternCuts`, `cisternLane` (`laneDist`, world.js), `cisternDist`, `cisternCrowds`, `cisternReach` (from `moveEntity`, nav.js), `cisternField`, `placeCistern` (the last step of `placeCreek`, world.js; lays the culverts' fords, `cistFords`), `cisternWayRound` (a wave's way round by a ford, from `makeSoldier`) | `the cistern` (the pixels: js/draw/cistern.js; the art: js/baked/cistern.js) |

## js/sim/world.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| worldgen, rivers, forest border and the two roost corners' guaranteed woods | `genWorld`, `carveRiver`, `borderNoise` (the seed's own border), `borderDepth` (that or the roost disc - what everything reads), `BORDER_MIN`/`BORDER_MAX`, `ROOST_R`/`ROOST_WOBBLE`, `CENTER_R`, `warrenGrove`/`GROVE_IN`/`GROVE_TAPER` (the border grown out round each warren, folded into `borderDepth`) | `world` |
| the snowdrop clump and its rest after a pick | `OBJECTS.snowdrop`, `SNOWDROP_CD`/`SNOWDROP_BUD_T`, `snowdropLeft` (`o.readyAt`; the pick: `pickSnowdrop`, js/sim/actions.js) | `world` |
| the **map shapes** - the table, the rule one IS, which shape this page grew, and the ore/berry top-up a grown one needs | `MAPS`, `MT_SNOW`/`MT_ICE`/`MT_FOREST`, `mapFbm`, `mapTerrain`, `mapName`, `mapGrown`, `MAP_TYPE` (set in js/app/boot.js after `loadSettings`), `MAP_ROCKS`/`MAP_BUSHES` | `world` > `the map types` (the pick and its chip: `mapChip`/`mapStep`/`pickMap`, js/ui/menu.js; the setting: `settings.mapType`, core.js; the lobby: `netHostHello`/`netHostRoom`, js/net/net.js) |
| the **paths** a grown shape cuts through its own woods: their tuning, the registry roadDist mins over, the per-tile index, the cost field where wood is a wall, the route search and its axe fallback, laying the network | `PATH_HW`/`PATH_RAG`/`PATH_WOOD` (the `cut` fallback only)/`PATH_ICE`/`PATH_LANE`/`PATH_CAMP`/`PATH_SEG`, `paths`, `pathLat`, `pathDist`, `addPathSeg`, `addPathRoute`, `indexPaths`, `pathCost`, `pathRoute`, `layPaths` (called at boot between `placeCreek` and `placeRoad`, boot.js) | `world` > `the paths` (the pixels: `paintRoadOverlay`'s `onIce`, js/draw/ground.js) |
| what a kind of scenery **is** - solid, which tool, the E verb and lift, what each map paints it (the minimap's colour, the chart's class) | `OBJECTS` | `world` (buildings carry the same `mm`/`map` pair: `STRUCTS`, structures.js) |
| what a tile's occupant paints on either map, over both tables: the minimap's colour, the chart's class, and the two team inks each map paints a side's buildings and its bird in | `objMapColor`, `objChart`, `CH_*`, `chTeam`/`chEagle`, `MM_TEAM_*`/`mmTeam`, `MM_EAGLE_*`, `MM_UNKNOWN` | `world` (its two readers: `updateMinimap` js/ui/minimap.js, `buildWorldMapImg` js/ui/panels.js) |
| a picked bush's regrow clock, the frame the bush wears at each stage of it, and the bar a hover shows over it | `BUSH_REGROW`/`BUSH_BUD_T`/`BUSH_RIPEN_T` | `world` (the pick: `hitObject`'s bush branch, actions.js; the tick: the object-timers loop, sim.js; the frame and the hover bar: the bush branch of `render()` off `hovO`, js/draw/render.js; the grids: `bush`/`bushEmpty`/`bushBud`/`bushRipen`, the `bush` section of js/sprites/terrain.js) |
| does this tile block a walker (a `gate` stands open to its own side's walker; a tile whose middle is the cistern's stone, unless the caller holds a body to it by the pixel: `swept`) | `isSolidTile` | `world` (it reads `STRUCTS` then `OBJECTS`, and names no type) |
| is this tile open water (an ice hole or the creek) - the one read every walker, route, spawn and climb-out asks | `waterAt` | `world` (under `isSolidTile`) |
| is this tile a bare hole (the one site left), and which wheel table a pad's build wheel gets on it; the net on a tile | `buildSiteAt`, `buildOptionsAt`, `netAt` | `world` (the two `*_ORDER` tables: `structures`, structures.js) |
| a footprint, turned or not: its width and height off the OBJECT (or a bare type, unturned), its tiles, its centre, its mouth, and the anchor a big piece ordered by one tile fits round | `structW`, `structH`, `structOf`, `footprint`, `structCenter`, `structMouth`, `findSite` | `world` |
| what a pine takes to fell, everywhere one is planted (the border, the practice forest, the regrowth) | `TREE_HP` (above `treeRare`) | `world` (what the fell pays: `YIELD`, core.js) |
| the rocks: lifting what genWorld stood, standing them two tiles wide in mirrored clusters on the band out from the border forest, and which kind each is | `placeRocks`, `ROCK_CLUSTERS`/`ROCK_CLUSTER_R`/`ROCK_CLUSTER_SLACK`/`ROCK_BAND_MIN`/`ROCK_BAND_MAX`/`ROCK_BAND_GROW`/`ROCK_BAND_LIMIT`/`ROCK_SPACING` | `world` |
| taking scenery off the map at runtime, the whole footprint (a two-tile rock) | `fellScenery` | `world` (its callers: the crash and the lane, boot.js; `merchFell`, robots.js) |
| treasure chests: where they take their trees, and what one pays | `placeChests`, `CHEST_COUNT`/`CHEST_SPACING`/`CHEST_GOLD_*`/`CHEST_ODDS`/`CHEST_BURIED` (the share a grown shape digs in deep) | `world` (opening: `hitObject`'s chest branch, actions.js; sprite: `CHEST_SPR`, js/draw/ground.js) |
| the road: its tuning, its geometry on the diagonal, each side's nest and junction, the spur registry a crash paves into, laying it, the march's waypoints | `ROAD_*`, `SPUR_HW`, `roadSpan`, `roadAlong`/`roadOffS`/`roadOff`/`roadPoint`, `roadHW`, `roadEdgeAt`, `roadMainDist`, `spurs`/`addSpur`/`addPad`/`spurDist`, `roadDist`, `laneDist` (the road as laid and drawn: ended on the cistern's gates), `onRoad`, `roadNestDeep`/`roadNest`, `placeRoad` (called at boot, boot.js), `roadWaypoints` | `world` › `the road` (pixels: `paintRoadOverlay` + `ROAD_COL_*`, `paintLog`/`LOG_COL` under `paintGroundTile`, `CAIRN_SPR`, js/draw/ground.js; `bannerCloth`, js/draw/practice.js; the maps: `updateMinimap`, js/ui/minimap.js, `buildWorldMapImg`, js/ui/panels.js; the paving: `laneStep`, js/sim/eagle.js) |
| the **creek**: its tuning, its geometry on the cross-diagonal, the bends round the two midline camps, the fixed fords and a path's, laying it at boot, the distance to its banks and the current, the plunge test | `CREEK_*`, `creekP`, `creekBends`, `creekBend`, `creekCalm`, `creekMid`, `creekHW`, `CQ`/`creekAt`, `creekFlow`, `creekWet`, `creekOuterFords`, `creekFord` (returns the row it laid), `placeCreek` (called at boot right after `genWorld`, boot.js; a path's fords: `addPathRoute`, `the paths`); **the orca's lake**, the cistern's frozen pool (`ORCA_LAKE_R`, `orcaLakeEdge`, `orcaLakeAt`, `orcaLakeNear`, `creekIced`; frozen by `placeCistern`, js/sim/cistern.js; what lives under it: js/sim/orca.js); the creek's catchable fish: `CREEK_FISH_*`, `creekFishN`, `creekFishAt` (where fish i is, a pure function of i and `windT`), `creekFishCatch` (a roll over one takes it, called from the roll in `playerMove`, sim.js), `state.creekGone` | `world` › `the creek` (pixels: `paintCreek`/`paintFordStone`/`drawCreekFlow`/`drawCreekFish`, js/draw/ground.js; the plunge: `playerPlunge`, sim.js; the climb-out: `nearestDryTile`, actions.js; a bot's walk: `WADE_SHOVE`, sim.js) |

## js/sim/zipline.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the zipline: its tuning, where each side's cable runs, laying it at boot, a point along a line and its height, the nearest point to a body, whether a body may clip on, and the ride's verbs (clip on / let go, the per-step ride, the knocked-off drop) | `ZIP_*`, `zips`, `zipTile`, `placeZips` (called at boot after `placeRoad`, boot.js), `zipPoint`, `zipLift`, `zipNearest`, `zipNear`, `zipUnder` (the cable as drawn under a world point: the hover, `hoverZip`, actions.js, and the click scheme's press), `zipToggle` (what `input.jump` does on the ground: `updatePlay`, sim.js), `zipStart` (a player's), `zipBoard`/`zipRide`/`zipEnd` (any body's: a soldier rides through them, robots.js), `zipStep` (the branch in `playerMove`, updatePlayer's movement ladder, sim.js), `ZIP_CRASH_R`/`ZIP_CRASH_STUN`/`zipCrash` (two rivals meeting on one cable: both stunned and dropped; called in `updatePlay` after the robots, sim.js), `zipMount` (the nearest point of a cable whose ground a body can stand on - the walk's goal, and a bot's), `zipWalkStart`/`zipWalkEnd`/`zipWalkStep` (the walk to the cable - a channel holding the stick at the top of `updatePlayer`'s input read, ended by any input of the player's own) | `zipline` (the pylon's `OBJECTS` entry: `world`; pixels: js/draw/zipline.js; the cap: `drawZipHint`, js/ui/wheel.js; the E press: `keyPress`/`ckRightPress`, input.js; the gates it joins: `tryWork`/`autoWork`/`tryDodge`/`tryProne`/`stunUnit`/`rootUnit`/`netUnit`, actions.js, `tryAbility`, abilities.js, `autoFish`, tools.js, `separateUnits`, nav.js) |

## js/sim/camps.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a camp: its kind's data, the fixed mirrored sites, the clearing, standing one up, stocking it, where a position is, the respawn clock its anchor wears | `CAMPS` (the hog hut's `hut` is an `OBJECTS` row with `w`/`h`; `render()`'s hut branch draws it off `HUT_FR`), `CAMP_SITES`/`CAMP_EDGE`, `campTile`, `campSites`, `RIVER_BANK`/`RIVER_REACH`/`RIVER_BAND`/`riverPath` (a river camp's bank, `C.path`), `campMark`, `campNear`, `campFrame`/`campLocal` (a treeline camp's along/out axes), `layCampPlan` (a drawn camp's `plan`; `C.spots`), `clearCamp`, `placeCamps`, `spawnCampMonster`, `stockCamps`, `campPop`, `campAt`, `CAMP_HOLD`, `updateCamps` (`C.repopT`; the anchor's `site`) | `camps` (the hover bar: `drawCampClock`, js/draw/marks.js, from the den and cairn branches of `render()` off `hovO`; the warren has no anchor; a river camp has no anchor, js/draw/render.js) |

## js/sim/practice.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the practice arena: its gen, the dummy's numbers, the grounds' clock | `PRACTICE` (core.js, above `WORLD` — practice worlds are 76 tiles), `genPracticeWorld`, `PR_W`/`PR_H`/`PR_SPAWN`, `DUMMY_HP`/`DUMMY_WORK_DMG`/`DUMMY_RESET_T`, `practiceDummies`, `updatePractice` | `practice arena` (the hits: `hitDummy`, actions.js; sprite: `DUMMY_SPR`, js/draw/practice.js) |
| the archery targets: the perimeter track, the two lanes and the hop, the three habits, the shared face geometry, a hit, its scoring/respawn and the consecutive-hit run | `ptargets`, `addPTarget`, `agPos`, `agEdge`, `AG_RECT`/`AG_INSET`/`AG_LEN`/`AG_LANE_GAP`/`AG_SPD`/`AG_SIZE`, `agBlocked`, `ptFace`, `ptLive`, `ptHitR`, `hitPTarget` (the impact: score and shatter land the same frame; a target's `word` is said instead of scored), `agShatter` (the break), `agStreak` (broken by the arrow loop, sim.js), `PT_HIT_R`/`PT_RESPAWN`/`PT_POP` | `practice arena` › `the archery track` (the arrow test: `shotContacts`, sim.js; pixels: `drawAgTrack`/`drawPTarget`, js/draw/practice.js) |
| the bell's rounds: what each one is (range, QUICK DRAW, DEFEND - clock, opening, tick, what a hit pays, when it is over, the plate's rows, the record), the wheel's wedges, quick draw's stages and spawner, DEFEND's raiders and their hop to the hold | `AG_ROUNDS`, `AG_WEDGES`, `agRoundOf`, `AG_RANGE_DIFF`, `agMedal`, `agTimeRow`, `QD_*`/`QD_STAGES`, `qdStage`, `qdSpawn`, `DF_*`/`DF_HOLD`, `dfSpawn`, `dfStep` (the records: `PROFILE.bestRange`/`bestRound`, profile.js) | `practice arena` › `the archery round: one bell` (the raider's pixels: `drawRaider`, the hold's ring: `drawDfHold`, the wedge marks: `AG_WEDGE_ART`/`drawAgRoundWedge`, the medals: `MEDAL_SPR`, js/draw/practice.js) |
| the archery round: the bell and its held round wheel, the spawn tables the range climbs, the furniture sink (bell included), the countdown, the spawner, the record | `agame` (incl. `diff`, `mode`, `left`), `AG_T`/`AG_BELL`/`AG_DIFF`, `agBellNear`, `agRing`, `agEndRound`, `agSpawn`, `agStock`, `agSinkU`, `agUpdate` (the wheel: kind `'agbell'` in keydown/keyup input.js, `wheelOptions`/`renderWheel`/`runCmd` js/ui/wheel.js; the `E RING` cap: `drawBellHint`, js/ui/wheel.js; the record: `PROFILE.bestRange`, profile.js) | `practice arena` › `the archery round: one bell` (readouts: `drawAgame`/`drawAgameUI`, js/draw/practice.js; the bell's pixels: `drawAgBell`, js/draw/practice.js; the sink crop: the dummy/rack/agbell branches, js/draw/render.js) |
| the ice parkour: the stock centreline, the carve, the fixed line strip, the lap clock's state and rules | `PK_PATH`, `PK_LINE` (force-iced by `pkPlanCarve`; its two end flags: `genPracticeWorld`), `PK_OFF_T`/`PK_GATE`/`PK_WALK`, `pkCarve`, `parkour` (incl. `cpTx/cpTy`, `custom`, `diff`), the parkour block of `updatePractice` (`the parkour clock`) | `practice arena` › `the ice parkour` (pixels: `drawParkourLine`/`drawParkour`, js/draw/practice.js) |
| the roll station: the die, its held wheel, random tracks, the carving-front sweep | `PK_DIFFS`/`PK_DIFF`, `PK_CX`/`PK_CY`/`PK_RX`/`PK_RY`/`PK_APRON`, `PK_DIE`, `pkTiles`, `pkGenPath`, `pkPlanCarve`/`pkIceTile`, `pkRoll`, `pkAngKey`/`pkAnimStep`/`pkAnim`/`PK_ANIM_T`/`PK_WARN`, `pkDieNear`, `pkWheelPick` (the wheel: kind `'pkdie'` in keydown/keyup input.js, `wheelOptions`/`renderWheel`/`runCmd` js/ui/wheel.js; the `E ROLL` cap: `drawPkHint`, js/ui/wheel.js) | `practice arena` › `the roll station: one die, one held wheel` (the carve and the generator sit below `genPracticeWorld`; pixels: `drawPkDie` + `PK_PIP_*`, js/draw/practice.js) |
| the practice world's layout and the deer ride: the field's block and its offset, the trail, its log and three posts, the tame deer and its stand | `PR_RING`/`PR_OX`/`PR_OY`, `RD_PATH`/`RD_RAD`/`RD_SHOT`/`RD_LOG`/`RD_TARGETS`, `rdCurve`, `rdCarve` (from `genPracticeWorld`), `rdTiles`, `PR_DEER`/`PR_DEER_BACK`, `prDeer`, `prDeerStep` (from `updatePractice`; the deer's `tame`: `updatePrey`, js/sim/wildlife.js) | `practice arena` › `the deer ride: a trail through the forest wing` |
| the practice bar's commands: level, gold, the two standing toggles, reset, teleport, a spawned dummy and clearing them | `cheatCmd`, `CHEAT_GOLD`/`CHEAT_DUMMIES`/`CHEAT_AUTO`, `cheatAuto` (ticked from `updatePractice`), `cheatDummy`/`cheatDummyGone`/`cheatDummies` (the bar itself: js/ui/cheats.js; the order: kind `'cheat'` in `cmdOk`/`runCmd`, js/ui/wheel.js) | `practice arena` › `the practice bar: League's practice-tool cheats` |
| the armory: taking a tool off the practice rack, and who counts as beside it | `rackEquip`, `rackNear` (the E-held wheel: keydown/keyup in input.js; kind `'rack'` in `wheelOptions` / `runCmd`, js/ui/wheel.js; the `E ARM` cap: `drawRackHint` / `drawKeyPrompt`, js/ui/wheel.js) | `practice arena` |

## js/sim/depth.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| how deep the snow lies anywhere: the map, its bands, the prevailing wind, the drift list and per-tile index, the lee pad behind every standing thing | `snowDepth`/`snowDepthPx`, `driftsDepth`, `hollowDepth`, `leeDepth`/`layLees`/`leeCell`/`LEE_AMP`, `DEPTH_DEEP`/`DEPTH_MID`, `driftWind`, `drifts`, `driftCell`, `driftDepth` (one drift's shape) | `snow depth` |
| laying the drifts: what breaks the wind, what a drift may lie on or bury, the keep-outs, the fair split between the halves, and the warrens' own set | `layDrifts` (boot.js, after worldgen), `driftBreak`, `driftBury`, `driftFree`, `driftTiles`, the `DRIFT_*` constants, `layMeadowDrifts`/`MEADOW_POOL`/`MEADOW_AMP`, `poolDepth` (a warren's round pool; `driftDepth` hands a `pool` drift to it) | `snow depth` › `laying the drifts` |
| the slowdown: the wade every unit eases, what it leaves of a walk, and its tuning | `wadeStep` (from `updateUnitStatus`, actions.js), `wadeEase` (the depth alone, no puff: `wadeStep`'s first half, and a client's own walk, `netPredictWalk`), `wadeMul` (`walkMax` in `walkStep`, sim.js; `unitMoveMul`, actions.js), `DEEP_WALK`/`DEEP_DODGE`/`DEEP_SLIDE`/`DEEP_SLIDE_BAR`/`DEEP_EASE` | `snow depth` |

## js/sim/landmarks.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a landmark is, where it may stand, and the pass that stands them | `LANDMARKS`, `LM_WHERE`, `lmFoot`, `lmIceDepth`, `lmClear`, `landmarks`, `placeLandmarks`, `lmStand` | `landmarks` |

## js/sim/nav.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| entity movement and unit-vs-unit solidity, and each body's room | `moveEntity`, `separateUnits`, `UNIT_MASS`, `unitSpace`, `UNIT_SPACE`, `UNIT_ROOM_RATE`, `unitShare` (the right of way; who outranks: `isAnchored`, `MONSTER.anchor`, wildlife.js) | `movement & collision` (the tile half, `isSolidTile`: `world`, world.js) |
| routes around obstacles: A*, the per-unit route follower, the stall/give-up signal, the toll a tile charges a route (the orca's ice) and the straight line that must not cut across it (nor the cistern's stone: `cisternBlocks`, `cisternCuts`, `cisternCrowds`, js/sim/cistern.js) | `findPath`, `walkable`, `navTo`, `navStep`, `navToll` (set by `spawnOrca`, js/sim/orca.js), `navLineClear` (its `free`: `navSmooth`, `navTo`) | `pathfinding` |

## js/sim/wildlife.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| an animal's level: the table's average, dealt at spawn and followed after while the body is unhurt and hunts nobody, what it grows (hp, and the kill's gold) | `ANIMAL_LV_HP`, `ANIMAL_LV_GOLD`, `animalLevel`, `animalLevelOf`, `animalHpAt`, `relevelAnimal` (under `ANIMAL_HP`; ticked by `updateAnimal`), `a.level` in `makeAnimal`, the payout in `animalDies` | `animals` (a monster's bite growth: `MONSTER.lvBite`, above the `camp monsters` banner) |
| the two deer: each side's line, the boot spawn, the walk along it, the restock clock and the clear-of-everyone point (the rabbits are the warrens' camp: `CAMPS.meadow`, js/sim/camps.js; a rabbit's warren is `a.meadow`, its hop home `preyWander`) | `DEER_ROUTE_*`/`DEER_ROAM`/`DEER_GRAZE_*`/`DEER_BEAST_SIGHT`/`DEER_BACK`/`PREY_CLEAR`, `deerRoutes`, `layDeerRoutes`, `spawnDeer`, `spawnAnimals`, `updatePreyStock` (called from `updatePlay`, sim.js, never under `PRACTICE`), `deerLegNear`, `deerRouteGoal` | `animals` |
| the title's ambient world behind the menu (the wildlife and the shoal), standing still once a room is shared | `titleWild` (from `updateTitle`, js/ui/menu.js) | `fish` |
| wildlife behaviour: the shared lifecycle and the prey half, with the rabbit's jink (the shot it reads as coming at it, and the dash) and the noticed mark's clock (`a.senseT`, set in `updatePrey` and `updateCampMonster`) | `updateAnimal`, `updatePrey`, `arrowAtRabbit`, `rabbitDodge`, `animalDies` | `animals` |
| what a beast is DOING, drawn: the clip table, the two movers of it, and the sit-up / head-up windows the prey read off | `ANIM_CLIPS`, `setClip`, `stepClip`, `RABBIT_ALERT` (`a.alertT`), `PREY_WARY_T` (`a.wary`) | `animals` (played by `clipFrame`, js/draw/bodies.js) |
| the tuning for everything wild: the prey's bolt, the deer's sprint and the rabbit's jink, the holes cut down to the fish, the shoal itself, the pack, the flock | `FLEE_SIGHT`/`FLEE_TIME`/`PREY_SPD`/`PREY_RUN`, `DEER_WALK_MUL`/`DEER_RUN_MUL`/`DEER_EASE_T`, `DEER_SPRINT`/`DEER_SPRINT_T`/`DEER_SPRINT_REGEN`, `RABBIT_DODGE_*`, `RABBIT_LEG`/`warrenHolds` (a warren rabbit keeps to its snow), `ICE_HOLE_HITS`, `HOLE_FALL_DMG`/`HOLE_FALL_T`, `FISH_CATCH_R`, `FISH_MAX`/`FISH_MIN`/`FISH_SPAWN_FAST`/`FISH_EMERGE_*`, `MONSTER`, `CAMP_GROUND`/`CAMP_LEASH_T`/`CAMP_REGEN_T`, `BIRD_*` | the top of `animals` (the prey), `fish` (the ice and shoal half) and above `camp monsters` (the three wolves, and the dormant flock); `FISH_SPAWN_T` alone stays in core.js |
| an animal taking a hit from anything (arrow or roll): flee/wake, damage total, knockback, kill credit | `hurtAnimal` | `animals` |
| riding a deer: what can be ridden, the reach, the hop on and off, the step that throws a rider, the ridden deer's carried step, the leap over a `leap` tile and the draw's lift | `RIDE`, `RIDE_GALLOP_MUL`, `RIDE_REACH`, `RIDE_LEAP_*`, `rideNear`, `hopToggle` (the ground's hop intent, from `updatePlay`), `rideStart`, `rideEnd`, `rideCheck`, `rideCarry`, `rideLeap`, `rideLeapStep`, `rideOverLeap`, `leapArc`, `rideLift` (the E cap: `drawRideHint`, js/ui/wheel.js; the deer's row under the rider's frame and the rider sat in the deer's back: `drawPlayer`, `riderSeat`, `backRow`, js/draw/bodies.js) | `riding` |
| where an animal walks next: the graze/patrol goal, and the bolt away from a player | `wanderGoal`, `preyWander`, `fleeGoal` | `animals` |
| a camp monster: neutral until hit, the camp waking on the hitter, the leash bar that holds on the camp's ground and drains off it, the heal at home, the bite, a river bear's walk up and down its bank and its fishing | `MONSTER`, `isCampKind`, `isBigBeast`, `wakeCamp`, `RIVER_LEG`/`RIVER_FISH_P`/`RIVER_FISH_WAIT`, `BEAR_FISH_FRAMES`/`BEAR_FISH_STRIKE`, `riverLeg`, `riverFish`, `updateCampMonster`, `monsterBite`, `BEAR_ATTACKS`/`BEAR_ATTACK_FRAMES`/`BEAR_STRIKE`/`BEAR_COMMIT_REACH`/`BEAR_ROAR_FRAMES` (a bear's set pieces) | `camp monsters` |
| the bear buffs (BLACK BUFF, BROWN BUFF): the midline kills' team payout and buff | `MONSTER`'s `buff`/`buffCol`, `CAMP_BUFF_EPIC_T`/`CAMP_BUFF_DMG`/`CAMP_BUFF_SPD`, `EPIC_TEAM_GOLD`, `campBuff` (above the banner); the grants in `animalDies` | `animals`/`camp monsters` (what it does: `hurtUnit`, actions.js; `abilityMoveMul`, abilities.js; the tick, `updateAbilities`, abilities.js; the ring: `drawBuffRing`, js/draw/bodies.js) |
| the flock: the flush, the circuit, the perch | `flushBirds`, `updateBird` | `birds` |
| fish shoal and ice holes; which kind a fish is (frost pike, or one in `FISH_RARE` a gold sunfish, hashed from its spawn spot in `addFish`) | `updateFish`, `fishClear`, `fishWater`, `spawnFish`, `addFish`, `FISH_RARE`, `f.kind` | `fish` |
| where new fish come from, and why one is invisible until it is under the ice | `spawnEmerger`, `buildEmergeSites`, `fishVis`, `f.born`/`f.vis`, `FISH_MAX`/`FISH_MIN`, `state.fishT` | `fish` |
| a fish net: the lure, the catch (`o.fish`, `o.sun` of them sunfish, handed over first), handing the catch over, drawing it | `nearestNet`, `angDelta`, `updateStructures` (`net` branch, structures.js), `drawNet`/`NET_FISH_PIKE`/`NET_FISH_SUN` (js/draw/structs.js), `NET_*` (js/sim/structures.js) | `fish` |

## js/sim/structures.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| THE one placement rule (the ghost's colour, the click, the pad's wheel, findSite and the AI all ask it), a dragged wall's run, the building E manages, then build, upgrade, repair, demolish, refunds, a chest's card rarity roll | `canPlaceAt`, `buildLine`/`placeLine` (`BUILD_LINE_MAX`), `manageNear`, `placeStruct`, `buildCost` (an income building's `ramp`), `startUpgrade`, `repairCost`/`startRepair` (`REPAIR_SHARE`/`REPAIR_RATE`), `structRefund`, `demolishStruct`, `cumulativeCost`, `rollCardRarity` | `structures` |
| every buildable: its tiers, costs, HP, footprint (and whether it `rotates` / is `tiled`), what it is for (`blurb`, the build list's hover: `tipStruct`, js/ui/tooltip.js), the two colours the maps paint it; the list's order, the two wheel tables, the builder's reach | `STRUCTS`, `BUILD_ORDER`, `STRUCT_ORDER`, `WATER_STRUCT_ORDER`, `BUILD_REACH` | `structures` (scenery carries the same `mm`/`map` pair: `OBJECTS`, world.js) |
| the build list and its ghost | not here: see [js/ui/wheel.js](#jsuiwheeljs) | `selection, hints & wheel` › `the build list and its ghost`, js/ui/wheel.js |
| a tiled building's draw (one tile of art per footprint tile) | `drawTiledStruct` | js/draw/structs.js (`the turret's sling, its rocks, the bay, the net and the tiled struct`) |
| where a bot lays a building | `aiBuildSite`, `AI_BUILD_R` | `ai`, ai.js |
| the fish net's tuning: what it holds, what it lures, how fast it catches and hands over | `NET_CAP`, `NET_R`, `NET_LURE`, `NET_CATCH_T`, `NET_TAKE_T` | `structures` (beside `STRUCTS`, whose `net` entry it belongs to) |
| tuning: the sling's pivot, its reach PER TIER (the draw reads the same row for how long to make the arms), its lock window, its release, and the rock's throw | `TUR_PIVOT_Y`, `TUR_MOUTH` (one per tier), `TUR_LOCK`, `TUR_SNAP`, `ROCK_SPD`, `ROCK_FALL`, `ROCK_MISS`, `ROCK_SPLASH` | `the building sim` › `turret gunnery` |
| construction ticks (quicker for the side standing by), a paid repair mending, generators, the bay rolling a bot out, the barracks queuing and rolling out a wave | `updateStructures`, `buildCrew` (`CREW_BOOST`/`CREW_MAX`), `BARRACKS_ROLL` | `the building sim` (the barracks' entry - `wave`/`waveT`/`grow`/`cap`, `art`, `fixed` - is in `STRUCTS`; its pixels `drawBarracksOverlay`, js/draw/overhead.js) |
| what a turret throws at and the one gate that says so (a player, a bot, a beast that is hunting, a building - `TUR_RANK` ranks them) | `turretAim`, `turretReach`, `turretHolds`, `turretMark`, `TUR_RANK` | `the building sim` › `turret gunnery` |
| the LOB itself: the solve both the aim and the throw read, the accuracy roll it is aimed through, the throw, and where a rock comes down (the only door a rock has to a building) | `turretLaunch`, `turretRoll`/`turretGoal`, `turretPivot`/`turretMouth`, `fireRock` (`solid: false`), `rockLands` | `the building sim` › `turret gunnery` |

## js/sim/robots.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| tuning: what a worker swing hits for, how far it notices and chases, how far a flag's ring reaches | `ROBOT_DMG`, `ROBOT_ATK_CD`, `ROBOT_REACH`, `ROBOT_AGGRO`, `ROBOT_LEASH`, `ROBOT_MAD`, `FLAG_R` | `team flags` |
| a bot leaving the bay's mouth, and the frame it spends deciding | `makeRobot`, `updateRobot` (`updateStructures` rolls them out: `the building sim`, structures.js) | `workers` |
| shooting a worker bot: its hitbox, its damage, its wreck, and who it is now angry at | `ROBOT_HIT_R`/`robotHitY` (the disc the arrow loop sweeps), `hurtRobot`, `robotDies`, `b.mad` | `workers` |
| what a worker does this frame: the flag dispatch, the harvest tick, the melee | the tail of `updateRobot`, `engage`, `gather`, `holdAt` | `workers` |
| the eagle's merchant: climbing down at the crash, pitching its market stall beside the spur's head (`OBJECTS.stall`), felling the back woods (away from the road) into its log stock, raising up to three bot bays (barracks) there for those logs (and rebuilding them), keeping to its post at the head of the spur, and standing still to serve whoever opens its counter | `MERCH_*` (incl. `MERCH_BAY_*`), `freeTileNear`, `spawnMerchant` (called from `eagleCrash`, js/sim/eagle.js), `updateMerchant` (dispatched from `updateRobot` on `b.merchant`), `merchFell`, `merchBearing`, `merchBayDir`, `merchBaySlots`, `merchNextBay`, `merchBaySite`, `merchBayBlocker`, `merchBackPine`, `merchStallSite`, `pitchStall`, `b.stall`/`b.stallT`/`b.stallSite`, `b.bays`/`b.bayT`/`b.baySite`/`b.wood`, `b.avoids`, `shopServing` (js/ui/shop.js) | `merchant` |
| a wave's soldier: its route down the road (round the cistern by a ford: `cisternWayRound`, js/sim/cistern.js), the four rungs it fights by, the bird strike, the bounty, the zipline ride on the march and the route read again after it | `SOLDIER_*`, `makeSoldier`, `soldierGoal`, `soldierBoard`, `soldierRejoin` (the ride itself: `zipRide` from `updateRobot`'s ride branch) (rolled out by `updateStructures`'s barracks branch, structures.js), `updateSoldier` (dispatched from `updateRobot` on `b.kind === 'soldier'`), `robotDies`'s bounty (the `workers` banner) | `soldiers` (the pennant: `drawRobot`, js/draw/bodies.js; the gust: `updateEagle`/`eagleGust`, js/sim/eagle.js) |
| the team flag: the four orders and their glyphs, the wheel's order, planting/moving/lifting one, whose flag a body serves (a human's over all), a teammate's to join, the nearest to help at | `FLAG_TYPES`, `FLAG_ORDER`, `FLAG_MINE`/`FLAG_FOE`, `plantFlag`, `clearFlag`, `flagRecall`, `flagOf`, `servedFlag`, `humanFlag`, `teamFlagAt`, `nearestTeamFlag`, `flagPos`, `inFlag` | `team flags` |
| what is hostile inside a flag's ring, and who has already claimed a tile in it | `flagFoe`, `enemyStructNear`, `objTaken` | `team flags` |
| a worker's attack: who is a valid mark, where the axe lands, the blow itself | `robotFoeUnit`, `foeAlive`, `foePoint`, `robotStrike`, `ROBOT_*` | `team flags` › `a worker's simple attack` |
| how an AI PLAYER answers a flag, and flies its own | `aiFlagSync`, `aiStructTile`, `AI_FLAG_*`, the `order` block and rung 5a of `updateAI` | not here: `ai` › `the flag`, ai.js |
| what a flag LOOKS like - all six draw functions | `drawFlagIcon`, `drawFlagPennant`, `drawFlagRing`, `drawFlagRings`, `drawFlag`, `drawFlagMark` | not here: `what a flag looks like`, js/draw/marks.js |

## js/sim/actions.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a click / E / space actually does, and the work the hands take with no key (a tree, a berried bush in reach) | `clickAction`, `tryWork`, `workTarget`/`workTargetAt` (by tile: the CLICK scheme's right button), `startSwing`, `autoToolFor`, `autoPrio`/`AUTO_PRIO_*`, `autoTarget`, `autoWork`, `tryDodge`, `hitObject`, `crackIce` (what a click FIRES: `fireTool`, tools.js; the fish half: `autoFish`, tools.js) | `actions` |
| the dawn shield: a snowdrop picked, the shield it lays on the picker's whole side (spent before health in `damagePlayer`, player.js; cleared by `die`) | `pickSnowdrop`, `DAWN_SHIELD`/`DAWN_SHIELD_MAX` (`p.dawnShield`; reached from `hitObject`'s snowdrop branch) | `actions` |
| one chop into a standing tree - gold, stump, fell payout, loot roll, jackpot - whatever landed it | `chopTree` | `actions` (above `hitObject`; its other caller is `BIT_IMPACT.chop`, tools.js) |
| the tuning for everything a player does: the three SWING tools, the shot trail, E's reach, the roll, prone | `SWING_TOOLS`/`SWING_*`, `BOW_Y`, `ARROW_*`, `WORK_REACH`, `STRUCT_HIT_DMG`, `ROLL_*`/`TACKLE_*`, `PRONE_*`, `AMBUSH_MUL` | `actions` (its head; the two kit baselines `BOW_CHARGE`/`BOW_NOCK`: `players`, player.js; the weapon's own tuning: `TOOLS`/`BITS`, tools.js) |
| the roll as a hit: the sweep and the tackle | `rollSweep`, `rollTackle`, `tackleObject`, `tackleObjAhead`, `rollPow`, `rollDmg` | `actions` › `the roll as a hit` |
| going to ground and getting back up | `tryProne`, `risePlayer` | `actions` › `prone` |
| the empty-press tell (an empty slot, or a budget that reaches no shot) | `dryFire` | `actions` › `the empty press` |
| one blow against a building on another team (E swing, every bit a tool fires, every ability, worker axe alike) | `hurtStruct`, `STRUCT_DR`, `STRUCT_HIT_DMG`, `destroyStructure` | `actions` (its tail) |
| which buildings an AREA effect reaches, and whose they are | `structsNear`, `structFoe` | `status effects` (beside `unitsNear`/`unitFoe`, which they mirror) |
| every way of hurting the practice dummy (E, every bit, the tackle), and the meter's combo ledger | `hitDummy` | `actions` (its tail; the dummy itself: `practice arena`, js/sim/practice.js; the plate: `drawDummyMeter`, js/draw/practice.js) |
| **the one blow every kind of unit takes** - a player, an animal, a worker bot | `hurtUnit` | `status effects` (its per-kind ends: `damagePlayer` player.js, `hurtAnimal` wildlife.js, `hurtRobot` robots.js) |
| every living thing in a circle an area effect may touch, in one list; and the rival body under a POINTER, by each kind's box (the hunt reticle and the CLICK scheme's right button) | `unitsNear`, `unitsHit` (blows only), `unitFoe`, `unitTeam`, `unitAlive`, `unitMidY`, `isAnimalUnit`, `unitUnder` | `status effects` › `what a unit IS` |
| asking those two on behalf of a THING in the world (a net, a shot) rather than a body | `sideOf` | `status effects` › `what a unit IS` (its kill-credit half: `abCredit`, abilities.js) |
| putting a state ON a body - the one writer for each (a `src` the stun, root and net take is that player's crowd control: `ccCredit`) | `stunUnit`, `rootUnit`, `slowUnit`, `netUnit`, `markUnit`, `igniteUnit`, `ccCredit` | `status effects` › `the states a unit can be under` |
| what a damage TYPE is, and the fire that outlives its blow | `DMG_TYPES`, `BURN_T`/`BURN_DPS`/`BURN_TICK`/`BURN_MAX`, `igniteUnit`, `updateBurn`, `douseUnit` | `status effects` › `fire` (the bits that deal it: `BITS.flame`/`pyre`/`cinder`, tools.js; the exemption from the roll’s and the respawn’s i-frames: `DOT_CAUSE`, player.js) |
| ageing those states, and what is left of a non-player's speed | `updateUnitStatus`, `unitMoveMul`, `clearUnitStatus` | `status effects` › `the clock every non-player unit runs` (a player's own copy: `updateAbilities`, abilities.js; where the speed is spent: `navStep`, nav.js) |

## js/sim/tools.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what every weapon and every shot IS: the two tables the whole system is driven from | `TOOLS`, `BITS`, `TOOL_TIERS`, `TOOL_SLOTS` (1 - the one weapon slot) | `tools & bits` (its head) |
| the tier a find wears, and where that colour is read back | `TOOL_TIERS`, `itemTier` (`tierPlate`, which paints it: js/ui/hud-draw.js) |`tools & bits` |
| the bag rows that make tools and bits carryable at all | the `ITEMS` / `RES_COLORS` loops at the foot of the file (the tables themselves: `ITEMS`, js/sim/player.js; `RES_COLORS`, js/sim/structures.js) | `tools & bits` › `icons` |
| a tool instance and the things that read one; the cycle a press starts | `makeTool`, `heldTool`, `bitsIn`, `toolLoad`, `newMods`, `bitMods`, `peekBit`, `toolRof`, `toolCycle`, `toolReady` | `tools & bits` › `a tool instance` |
| **what one press does**: every loaded shot, each in the envelope of every loaded fitting, the built-in arrow when no shot is loaded, and which fittings shaped each (`shots[].mods`, what the shelf draws its lines from) | `toolPlan`, `TOOL_BASE_SHOT` (returns `shots`/`spent`/`load`/`tensile`) — read by `fireTool`, `drawAimLine` (js/draw/render.js) and `drawShelf` (js/ui/hud-draw.js) alike | `tools & bits` › `a tool instance` |
| the draw curve: what a hold buys a shot, how long a full draw takes under the load, and the one flight envelope the sim fires and the aim line measures | `DRAW_RANGE_MIN`/`DRAW_SPEED_MIN`/`DRAW_DMG_MIN`, `DRAW_EASE`/`DRAW_LOAD`, `toolDrawMul`, `drawTime`, `drawPow`, `drawSpeedMul`/`drawRangeMul`/`drawDmgMul`, `shotFlight` | `tools & bits` › `the draw` |
| the fire a shot carries, and the three modifier bits that put it there | `BITS.flame`/`pyre`/`cinder`, `PYRE_T`/`PYRE_DPS`/`CINDER_R`, `m.type`/`m.burn`/`m.burnDps`/`m.cinder` in `newMods` | `tools & bits` (beside `BITS`; what a burn then DOES: `status effects`, actions.js) |
| moving a tool onto a key or a bit into a cell (the two the drag goes through), and the row laying itself out shots-left, fittings-right | `slotPut`, `bitPut`, `sortBits` | `tools & bits` › `equipping` |
| what a press actually fires, and the shot it puts in the air; the fish taken with no press at all | `fireTool`, `emitBit`, `offBy`/`SHOT_SKEW`/`DUP_SKEW`/`FAN_SPREAD` and `armOff` (the volley's spread; the pierce lays its arms out through it too), `autoFish`, `FISH_AUTO_CD` | `tools & bits` › `what a tool fires` |
| a melee tool's press: the wedge the blade sweeps at this draw, every bit in the plan as one cut of it, and the sweep left on the snow | `TOOLS[id].melee` (`reach`/`half`), `SLASH_T`, `SLASH_REACH_MIN`, `slashReach`, `slashTool`, `slashes`, `updateSlashes` (the hand's own swing: `p.slashT`/`slashA`/`slashHalf`, player.js, drawn by `drawHeldTool`, js/draw/bodies.js) | `tools & bits` › `the cut` |
| a weapon's art at its real length in the hand, where it differs from the bag icon; which way every art's business end is drawn | `TOOL_HELD_ART` (baked as `toolHeld_<art>_<tier>`), `TOOL_FWD` | `tools & bits` › `icons` |
| the catch pose: its clock and which fish it hoists (`p.catchKind`), the cancel every step, press and hit call, which of its three frames is up | `CATCH_T`, `startCatch(p, kind)`, `cancelCatch`, `catchFrame` | `tools & bits` - after `autoFish` (ticked in `updatePlayer`, sim.js; drawn by `drawPlayer`, js/draw/bodies.js; the net take in `updateStructures`, structures.js) |
| how each bit flies, and the numbers behind the four non-straight paths | `steerBit`, `ORBIT_R`, `LOB_DRAG`/`LOB_FALL`, `CURVE_TURN`, `BOOM_*` (the boomerang's return controller) | `tools & bits` › `how a bit flies` |
| what a shot does where it LANDS, and the two that do anything | `BIT_IMPACT`, `bitImpact`, `AXE_CHOP_R`, `WARP_BACK` | `tools & bits` › `what a bit does where it lands` (called from the arrow update: `update`, sim.js) |
| the teleport itself: the jump, and the silhouettes it strings across it | `warpPlayer`, `updateWarps`, `warps`, `WARP_FLASH_T`/`WARP_STEP`/`WARP_MAX` | `tools & bits` › `the teleport` (drawn by `drawWarps`, js/draw/render.js; aged in `updateFx`, sim.js) |
| how hard a shot shoves what it hits | `kb` on each `BITS` row (`HIT_KB` player.js, `ROBOT_KB` robots.js, `o.kbMul` in `hurtUnit`) | `tools & bits` (beside `BITS`) |
| where tools and bits come from, and how often | `dropLoot`, `LOOT_POOL`, `rebuildLootPool`, `TREE_DROP`, `CHEST_TOOL`, `LOOT_TOOL` | `tools & bits` › `loot` (its callers: `hitObject`, actions.js; `finishMine`, js/sim/mining.js, at a rock kind's `loot`) |
| the arsenal's kinds and their lineage on paper, all of it unlocked; the "held one" pip | `TECH`, `TECH_BY_ID`, `noteSeen` | `tools & bits` › `the tech tree` (storage: `PROFILE.techSeen`, profile.js; the page that lists them: `the wiki`, js/ui/wiki.js) |
| what each class flies in with | `CLASS_LOADOUT`, `giveLoadout` | `tools & bits` › `starting loadouts` (the weapon rides the hero pop-up's preview: `drawGearPreview`, js/ui/menu.js) |
| a bot putting its loot to work, having no shelf and no pointer | `botFitLoadout` | `tools & bits` › `a bot fitting what it has found` (called from `updateAI`: `ai`, ai.js) |
| the icons for both, and the one bake helper they share | `TOOL_ART`, `TOOL_ART_PAL`, `BIT_ART`, `BIT_PAL`, `bakeGrid` | `tools & bits` › `icons` |
| **a found bit arming itself**: the free cells of the tool in hand counted as room, and the pickup that fills them before the pack (a bot is left to `botFitLoadout`) | `autoFitTools`, `fitRoom`, `fitAdd`, and `fitBit` — the cell a bit lands in, sorted onto its own side (also `sendBagCell`'s click, js/ui/strip.js) (`fitAdd`'s callers: the drop pickup in `updatePlay`, sim.js; `shopBuy`, js/ui/shop.js) | `tools & bits` › `a find arms itself` |
| **a discarded weapon shedding its build** as it lands — every ground-drop path calls it | `SHED_KICK`, `shedBits` (its one caller: `throwCell`, js/ui/bag.js) | `tools & bits` › `a tool that lands in the snow arrives bare` |
| **a better body taking the hand and the build with it**: whether a find would swap, doing it (bits move cell for cell, right-aligned), and the tell it raises | `toolUpgrade`, `takeUpgrade`, `swapFx`, `SWAP_T`/`SWAP_RISE`/`swaps`, `updateSwaps` (called from the drop pickup in `updatePlay` sim.js; drawn by `drawSwaps`, js/draw/render.js) | `tools & bits` › `a better body takes the build with it` |
| what the last press SPENT — or, on a swap, the whole row — lit on the shelf and fading | `BIT_LIT_T`, `bitLit` (`{cell, cells, t, col}`; cell -1 is the tool well), `bitLitAt` (clamped), `bitLitCol` (set in `fireTool` and `swapFx`, aged in `updateFx`, sim.js) | `tools & bits` › `what a tool fires` |
| how big a stack of bits a cell holds | `BIT_STACK` (read by the `ITEMS` registration at the foot of the file) | `tools & bits` › `items: one bag entry per kind` |

## js/sim/mining.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the three rock kinds: mining time, gold, ore, find, regrow, glint, and each one's progress fill | `ROCK_KINDS`, `SPRITES.rockFill` | `rocks and ore` |
| the ores as carried items, their icons and prices | `ORE_ICONS`/`ORE_PAL`/`ORE_PRICE`, `ORE_STACK`, `isOre` (the rows go into `ITEMS`; the tooltip: `tipStack`, js/ui/tooltip.js; the price: `itemValue`, js/ui/shop.js) | `rocks and ore` |
| the pick that mines a rock on its own: taking the nearest free rock in reach, its tick, bite, landing, letting go and a rival's blow | `updateMine` (from `updatePlayer`, sim.js), `mineFree`, `mineIdle`, `mineStrike`, `finishMine`, `breakMine`, `mineHit` (from `damagePlayer`, player.js), `MINE_R`/`MINE_HIT_HOLD`/`MINE_STREAM_T`/`MINE_STRIKE`/`MINE_MOVE`/`ORE_FLING` | `rocks and ore` |
| is a rock standing, who is at it, is it in reach, and the timers: the cracks closing on a rock nobody is at (`MINE_DECAY`) and the rubble growing back | `rockReady`, `rockMiner`, `mineReach`, `rockCx`/`rockCy`, `tickRock` (the object timers, sim.js) | `rocks and ore` (the draw: `drawRock`, js/draw/render.js; the shade: `CASTERS.rock`, js/draw/ground.js) |
| a weapon's forge points and level, and what a level adds: damage on every body, then rate of fire or tensile by the body's `TOOLS` row `up`, tapering | `FORGE_PTS`/`FORGE_NEED`/`FORGE_NEED_UP`/`FORGE_TAPER`/`FORGE_DMG`/`FORGE_ROF`/`FORGE_TENSILE`, `forgeNeed`/`forgeCum`/`forgeBar`/`forgeLvlOf`, `toolFp` (`cell.fp`; a bare `lvl` reads as its points), `toolLvl`, `toolUp`, `forgeSum`, `forgeDmgAt`/`forgeRofAt`/`forgeTensileAt` (the bench's preview), `toolDmgMul` (read by `toolPlan`, tools.js, and `pierceMods`, abilities.js), `toolRofMul` (`toolRof`, tools.js), `toolTensile` (`toolPlan`, `toolDrawMul`, `botFitLoadout`, tools.js, and the tooltip) | `the forge` |
| what a pile is worth, what a forged weapon sells for, and the order that dumps a pile into it | `pilePts`, `forgeWorth`/`FORGE_GOLD` (`cellValue`, js/ui/shop.js), `forgeCell`, `forgeReady`, `forgeTool` (from `shopCmd` act `forge`, js/ui/shop.js) | `the forge` (the bench: js/ui/forge.js) |

## js/sim/icebreak.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the ice breaking in its own shape (the orca's hole, `orcaStrike`, js/sim/orca.js): the footprints (`orca` the orca's own), the tuning, breaking it, the tiles it opens and closes, the step, the footprint as a hit test, whether a pixel is its water, whether it holds a tile | `ICE_BREAK_SHAPES`/`breakLens`, `ICE_BREAK_*`, `iceBreaks`, `iceBreak`, `breakFoot`/`breakGeom` (the shape and the hole off `breakCache`), `breakOpen`/`breakClose`, `updateIceBreaks` (from `updatePlay`, sim.js), `iceBreakCovers`, `iceBreakWet` (the plunge, `playerPlunge`; `nearestDryTile`, actions.js; `moveEntity`, nav.js), `iceBreakHolds` (`paintGroundTile`, ground.js; the mirror, light.js; the fish clip, render.js), `iceBreakAge`/`breakFront` | `ice breaks` (the pixels: js/draw/icebreak.js; save: `SAVE_ROOTS`; wire: `snapSingles`) |

## js/sim/orca.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the orca: its tuning, its water and the homes it cruises to, putting it in at boot, the cruise, who it locks on and why it lets go, the countdown's clock, the stalk (the pass and the run in), the strike that breaks the ice, the bite and its one-shot, the countdown a player wears | `ORCA_*`, `ORCA_FRESH`, `orca`, `orcaWater`/`orcaHome`, `orcaAge`, `orcaTileIn`/`orcaIn`/`orcaClear`, `orcaIce`/`orcaOnIce`, `orcaPrey`, `spawnOrca` (boot, after `spawnFish`), `orcaGoal`, `orcaSwim`, `orcaUnder`, `updateOrca` (from `updateWildlife`, sim.js, after `updateFish`), `orcaLook`, `orcaPass`, `orcaStalk`, `orcaStrike` (`iceBreak`, icebreak.js), `orcaBite` (`unitsHit`, `hurtUnit` cause `orca`), `orcaLethal`, `orcaLine` | `orca` (its lake: `orcaLakeEdge`/`orcaLakeAt`, world.js; the pixels: js/draw/orca.js; the count's: `drawOrcaCount`, js/draw/overhead.js; save: `SAVE_ROOTS`; wire: `snapSingles`, the client's ease: `netClientLerp`, net.js) |
| a bot the orca is after: the way off its ice | `orcaShore` (rung 0b of `updateAI`, ai.js; the bot API's `me.orca`, js/ai/bot-api.js) | `orca` |

## js/sim/tunnel.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the burrow's tunnels: the tuning, the one placement rule, the dig order, the holes standing and caving, the far end, going under and coming up, and the step that runs it all | `TUN_*`, `tunSiteOk`, `tunPlaceOk`, `digTunnel` (the `tunnel` order: `runCmd`, js/ui/wheel.js), `tunHoleOf`/`tunHoles`, `caveTunnel`, `tunFarSite`, `tunnelEnter` (ahead of the swing in `playerSwing`, sim.js; `p.tunE` the fresh press), `tunUnder`, `tunnelExit`, `updateTunnels` (from `updatePlay`, sim.js) | `tunnels` (the hole's `OBJECTS` row: world.js; the rider out of the world: `inAir`, player.js; the drop: `animalDies`, wildlife.js; the state: `p.tun`/`p.tunCd`/`p.digT`/`p.tunHole`, player.js) |
| the aim: the local hand's ghost, standing it up and putting it away, and the press that sends the order; the burrow's icon | `tunnelAimToggle` (V: `keyPress`, input.js; a click on its pack cell: `ITEMS.tunnel.use`, run by `sendBagCell`), `tunnelAimTile`, `tunnelAimPress` (`pointerPress`, input.js), `state.tunAim` (in `SAVE_STATE_SKIP`), `SPRITES.itemTunnel` | `tunnels` › `the aim` |

## js/sim/abilities.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the two kits' four actives each: name, cooldown, cast, and the whole effect | `CLASS_AB` (each row's `use(p)`) | `class abilities` |
| the options on a key: the warrior's other four (WAR CRY, WHIRLWIND, HAMSTRING, SECOND WIND) and their tuning, what a key IS on a body, the key an id stands on | `CLASS_AB_ALT`, `abOptions`, `abOf`, `abKeyOf`, `CRY_*`/`WHIRL_*`/`HAM_*`/`WIND_*`, `abWarCry`, `abWhirlwind`, `abHamstring`, `abSecondWind` | `class abilities` › `the options on a key`, `warrior: the other four` (the pick: `p.abPick`, player.js; the strip: `pickAbility`, js/ui/menu.js) |
| the piercing shot wearing every modifier on the tool in hand (row order and tensile ignored), the flight that buys, and the loose | `pierceMods`, `PIERCE_FLIGHT`/`pierceFlight`, `abPierce` | `class abilities` › `hunter: the four effects` |
| tuning for every ability (pierce windup/multiplier/telegraph range, net slow, grapple reach/reel/assist, shield arc, the slam, rush ramp/slam, crater, the execute's missing-life scale, the telegraph colours and flash length) | `PIERCE_*`, `NET_*`, `GRAP_*`, `SHIELD_*`, `SLAM_*`, `RUSH_*`, `STOMP_*`/`CRATER_*`, `EXEC_*`, `AB_FX_T`/`TELE_COL`/`TELE_HOT` (snow cover's numbers are `PRONE_*`, actions.js) | `class abilities` (its head) |
| the shield's second half: the key again while the wall is up or mid-charge winds up the SLAM (the rush ended on the spot), and the execute's missing-life cut | `abSlam`, `execDmg`, `abExecute`, `startCast`/`castProg` (state: `p.castSlam`, `p.castMax`, player.js) | `class abilities` › `casting` / `warrior: the four effects` |
| the wedge every blade-shaped blow sweeps and draws, and the ring: units by centre plus radius, buildings by any footprint tile | `inCone`, `unitsInCone`, `structsInCone` | not here: js/sim/actions.js, `status effects` › `what a unit IS` (beside `unitsNear`/`structsNear`) |
| every wind-up's shape on the snow for both sides and the flash where it landed (the pierce/charge line, the stomp ring, the slam/execute wedge), and the sword's sweep over the bodies | `abFx`, `drawWedge`, `drawRing`, `teleLen`, `drawTeleLine`, `drawSlashes`, `drawAbilityGround` | `class abilities` › `drawing: the world layer` |
| ability levels: a skill point per level on the four keys (level 0 = LOCKED, the first point unlocks), the bought-and-ready gate every caster asks, and the level-cut cooldown every setter reads | `AB_LV_MAX`/`AB_LV_CD`, `abUnlocked`, `abReady`, `abLvCanBuy`, `buyAbilityLv`, `abCdOf` (state: `p.abLv`, player.js) | `class abilities` › `levelling` (bought via `runCmd`, js/ui/wheel.js, or the ability key itself while a point is unspent — `p.input.ability` in `updatePlayer`, sim.js; bots: `updateAI`'s rung 0, ai.js) |
| a keypress becoming a cast, and the per-player tick that lands it | `tryAbility`, `updateAbilities` | `class abilities` › `casting` |
| every movement cap an ability may touch, folded once | `abilityMoveMul` | `class abilities` › `casting` (read by `updatePlayer`, sim.js) |
| what the abilities leave in the world, stepped per sim step | `craters`/`nets`, `updateAbilityWorld` (the piercing shot rides `arrows`, sim.js; the grapple lives on its caster: `p.grapT`/`grapX`/`grapY`, `grapEnd`, and the reel branch in `playerMove`, updatePlayer's movement step) | `class abilities` › `the world tick` (called from `updatePlay`, sim.js) |
| the shield eating a shot, the rush's step/grab/slam | `abShieldBlocks` (read by the arrow loop, sim.js), `rushStep`/`rushEnd` (read by the rush branch of `playerMove`, updatePlayer's movement step) | `class abilities` |
| drawing it all: ground layer, air layer, the pose on the sprite, the states on a body | `drawAbilityGround`, `drawAbilityAir`, `abilityPose`, `drawAbilityOnPlayer` | `class abilities` › `drawing` (called from js/draw/render.js and `drawPlayer`, js/draw/bodies.js) |
| the net drape, the root's jaws, the flames and the mark's chevrons, on ANY sprite at its own size | `drawUnitStates` | `class abilities` › `drawing` (its four callers: `drawAbilityOnPlayer` here, `drawAnimal`/`drawBird`/`drawRobot`, js/draw/bodies.js) |
| who a thing left in the world credits its kill to, once the caster may be down | `abCredit` | `class abilities` › `the world tick` (whose SIDE it is on: `sideOf`, actions.js) |
| the twelve 32×32 ability icons (the eight firsts, the warrior's four others) and their bake per option | `AB32`, `AB32_ALT`, `AB32_PAL`, `classAbIcon(cls, i, k)` | `class abilities` › `the strip icons` (drawn by `drawClassAbCell`, js/ui/hud-draw.js, and `tipClassAb`, js/ui/tooltip.js) |

## js/ai/ai-skill.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| how well a bot plays: the four rival levels (every hand and choice field explained), the ally profile a notch above, the ladder's one pair of hands, which profile a player runs | `AI_LEVELS`, `AI_ALLY_PUSH`, `AI_ALLIES`, `AI_LADDER_HANDS`, `aiProfile` | `difficulty` |
| the hands between a decision and the input: noticing (the cone, a hit's wake-up), the read of a target and the aim wobble, each draw's release, the lapse, the crosshair's swing and the held draw, a blade's reach; the per-bot state the dashboard reads | `skillOf` (`p.ai.sk`), `skillTick`, `skillNotice`, `skillAim`, `skillDraw`, `skillSlip`, `skillHands`, `skillBlade`, `AI_SETTLE`/`AI_WOBBLE_T`/`AI_ALERT_T`/`AI_AIM_ON`/`AI_BLADE_CLOSE`/`AI_BLADE_HOLD` | `skill` |

## js/ai/ai.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a bot decides to do this frame | `updateAI` (the wrapper: the ride's let-go), `aiThink` (the ladder; rung 0, the skill point and the gear, is `aiSpend` above it), `aiNearestEnemy`, `aiLineClear`, `aiOpenSides` | `ai` |
| IMPOSSIBLE's `relentless` played (never gives ground, everyone pushes as a pack from the zipline's end, charges past anything not at arm's length); the ability roll | `AI_PACK`/`AI_PACK_R` and `ai.packGo` (the pack, in the objective rung), `charge` (beside `siege`, in `aiThink`), `AI_ABIL_T` | `ai` (the levels themselves: js/ai/ai-skill.js) |
| how a bot covers ground: the zipline ride folded into every walk - is the cable worth it, the mount point, the hold along it and the let-go at the exit, the ride no rung wanted | `ZIP_AI_GAIN`/`ZIP_AI_OFF`, `aiWalkT`, `aiZipWorth`, `steerTo`/`walkTo` (inside `aiThink`; the mount is `zipMount`, js/sim/zipline.js), `ai.zipUsed` (`updateAI`) | `ai` › `the ride` |
| the objective: who pushes and who guards, the walk into a roost through its lane, the defenders' turrets, the archer's station, the siege that ignores respawning defenders | `aiRank`, `aiPushers`, `aiWantsPush`, `aiOnGuard`, `aiFortSite`/`AI_FORT_N`, `AI_PATROL_*` (a guard's turrets and scouting walk), `aiWallSite`/`aiWallPlan`/`AI_WALL_BOX` (its walls), `aiRingPlan`/`AI_RING_*` (how open the roost is: the defence line), `aiKeepsWay`/`aiLaneDist` (no bot building cuts a way: `ai` › `bot walls`), `AI_GUARD_HOT` (js/ai/ai-team.js), `aiRivalEagle`/`aiOwnEagle`, `aiToRoost`, `aiLaneGate`, `aiInLane`, `aiEagleTile`, `AI_HOLD`, `AI_GATE`, `AI_ROOST_BUDGET`, `AI_ESCALATE`, `AI_SIEGE_R` (the `siege` read in `updateAI`) | `ai` › `difficulty` (the bird's numbers: `EAGLE_HP`/`EAGLE_ARROW_DMG`/`EAGLE_WORK_DMG`, js/sim/eagle.js) |
| what every bot knows about both birds: nerve, last hit, who is at each (a rival wave counted at half strength), the `threat` read the defend and push rungs ask, how many a threat calls home | `aiSituation`, `aiDefendersWanted`, `AI_ROOST_R`/`AI_DEFEND_T`/`AI_JOIN_HP`/`AI_ALARM_HP` | `ai` › `difficulty` › `the two birds` |
| the waves as a bot sees them: a rival soldier in sight is a target, its own column's head is what a pusher walks with | `aiNearestEnemy` (its `robots` loop), `aiWaveHead`, `AI_WAVE_R`/`AI_WAVE_D` (the `head` read in rung 5c of `updateAI`) | `ai` |
| a bot the orca is after: off its ice by the nearest way, a beat late | rung 0b of `aiThink` (`orcaShore`, js/sim/orca.js) | `ai` |
| an ally at your side: the escorts, the anchors that let it join your fight and your push | `aiEscorts`, `AI_ESCORT`/`AI_ESCORT_R`, `AI_ANCHOR_R`/`AI_ANCHOR_D` | `ai` › `difficulty` |

## js/ai/ai-team.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a bot's temperament and what it moves; the decision knobs read off the profile with their defaults | `AI_MOODS`, `aiMood`, `aiMoodOf`, `aiKnob`/`AI_KNOB_DEFAULT`, `aiJudge`, `aiFlee` | `team brain` |
| the side's plan: who pushes, guards, scouts, stalks or hunts the bear, the stance, the window, the focus, the plan's order (`aiRank`, ai.js) | `AI_ROLES`, `aiTeams`, `aiTeamNew`, `aiPlan`, `aiRole`, `aiPlanRank`, `AI_PLAN_T`, `AI_WINDOW_*` | `team brain` |
| what the side has seen and who is calling: sightings, calls for help, the stalker's pick, the odds and the fall-back, the scout's beat | `aiLook`/`aiSaw`, `aiCall`, `aiHumanCall`, `aiHelpCall`, `aiStalkTarget`, `aiOdds`, `aiFallBack`/`aiFallBackTo`, `aiScoutPoint`, `aiForget` | `team brain` |
| the bear party | `aiSideBear`, `aiBearJob`, `AI_BEAR_*` | `team brain` |
| a bot's grudge, an ally answering your flag (ON IT, GUARDING), the fight's commit window | `aiDowned` (called from `die`, player.js), `aiGrudge`, `aiGrudgeFoe`, `AI_GRUDGE_*`, `aiObeys`, `aiAnswerFlag`/`aiAnswerStep`, `AI_ONIT_T`/`AI_ONIT_STALE`, `aiHoldFoe`, `AI_COMMIT_*`, `AI_FLEE_HOLD` | `team brain` |
| what a bot buys with its gold (income by payback; the side's builder raises bays) | `aiEcoBuy`, `aiIncome`, `AI_MATCH_MIN`, `AI_BAY_RATE`, the moods' `eco`, `T.builder` | `team brain` |
| what a bot is doing and why, for the dashboard | `aiNote` (`p.ai.thought`) | `team brain` |

## js/ai/bot-api.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a seat driven by a bot FILE: its step in place of `updateAI`, taking and leaving a seat, its live runtime (never saved: `p.botId` is) | `botStep` (called from `updatePlay`, sim.js), `botAssign`/`botRelease`/`botOpen`, `botRt`, `BOT_THINK` | `bot api` |
| what a bot sees and what it may send: the observation, the hello, the act read field by field, the thought it leaves on `p.ai.thought`, the side's `say` | `botObserve` (`BOT_OBS_R`, `BOT_NODES`/`BOT_NODES_N`, `botSeen`), `botHello`, `botAct` (`BOT_CMDS`, `BOT_SAY_MAX`), `botSetThought`, `botHear`, `botIdOf`/`botRefs` | `bot api` |
| where a program runs: the library, the transports, the lockstep a headless runner waits on | `BOT_LIB`/`botLibAdd` (the examples: js/baked/bot-lib.js, baked from bots/*.js by app/bake-bots.js), `BOT_TRANSPORTS` (`botInline`, `botWorker`, `BOT_PRELUDE`), `botPending`/`botGiveUp`, `botEnd`, `window.BOTS` | `bot api` |

## js/ai/ai-callouts.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a rival's grudge said to its mark (YOU AGAIN); the words of the brain's flag answers (ON IT, GUARDING: who says them is `aiAnswerFlag`, js/ai/ai-team.js) | `callGrudge`, `CALL_GRUDGE_T`/`CALL_GRUDGE_SEEN`; `CALLS.onit`/`CALLS.guarding` | `grudges` |
| a bot's callout to its side: what each one is, when one is said, the anti-spam rules, the one door every call goes through | `CALLS`, `CALL_*`, `updateCallouts` (called from `updatePlay`, sim.js), `callLook`, `callFriend`, `callFree`/`callSaid`, `addCallout` (replayed by `evPlay`, js/net/events.js), `callouts` | `bot callouts` (the pixels: js/draw/callouts.js) |

## js/sim/sim.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the frame sim: momentum, day/night, timers | `update`, `updatePlay` | `update` |
| the wildlife's step of the frame: the animals, the lake's fish, the orca, the camps' clocks, the meadow's stock | `updateWildlife` (below `updatePlay`, which calls it) | `passive income` |
| one player's step off its input, and the walk inside it - the heading, the knockback's decay, the ice underfoot, the slide, the surface model, the world's edge - which a client also runs on its own body ahead of the host (`netPredictWalk`, net.js); and the step's named stretches, run in this order: the intents (stun, the fish hoist, the edge-triggered presses), what owns the velocity (the water, the roll, the rush, the rope, the leap, the cable, else the walk), the plunge into open water, the cover, the dodge charges and the stamina ghost, the marks left in the snow, the hands (swing, work, a tunnel's fresh press), the tool's draw and loose | `updatePlayer`, `walkHeading`, `kbDecay`, `iceUnder`, `walkSlide`, `walkStep`, `clampWorld`; `playerIntents`, `playerMove`, `playerPlunge`, `playerCover`, `playerStamina`, `playerTrails`, `playerSwing`, `playerTool` | `the player's step` |
| the disc an arrow lands in round a body | `ARROW_HIT_R` (above `updatePlay`) | `update` |
| a shot meeting everything its step CROSSED, in the order it met it: the swept disc and box, the tile walk (roost, dummy, wall), every standing building by its drawn shape (the art's opaque box, a turret's turntable disc), the target faces and the three kinds of body - resolved by the arrow loop in `updatePlay` | `sweepDisc`, `sweepBox`, `artBox`/`structShotBox` (also drawn by `drawHitboxes`), `shotContacts`, `shotHits` | `the shot's sweep` |
| a map object's running clocks (the hit blink, the shiver, a picked bush and a mined rock growing back): starting one, ticking only the objects that have one, the rebuild after a load | `joltObj`, `timeObj`, `objTimed`, `objTiming`, `tickObjTimers` (called at the end of `updatePlay`), `objTimersRescan` (`saveApply`, js/sim/save.js) | `object timers` |
| the clock paying every player on the ground a coin, silently | `TRICKLE_GOLD`/`TRICKLE_T` (the tick is in `updatePlay`'s player loop) | `passive income` |
| the zoom ease itself (runs first thing in `update`) | `applyZoom` | `update` |
| particles, floaters, footprints, drops, world-space snow flakes | `updateFx`, `makeFlake`, `fitFlakes` | `fx updates` |
| the belly-crawl drag furrow: emitted in `playerTrails` (updatePlayer's step), drawn as the `f.k === 3` branch | `footprints`, `p.trailD` | `update` (the draw branch: `render`, js/draw/render.js) |

## js/sim/weather.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the day's weather: the four rows of dials, how often each comes up, what a day rolls, and the dawn fade between them | `WEATHERS`, `WX_DIALS`, `WX_ODDS`, `WX_FADE`, `weatherOf`, `weatherNow` (the read for other systems), `stepWeather` (the dials in force: `state.wx`, core.js; the pin: `DBG.weather`) | `weather` |
| the one wind field: its strength, which way it is running, the gust over a tile, and the signed lean at a tile; the slow sweep of loose snow across the world every 15 s | `windAmp`, `windVeer`, `windGust`, `windSway`, `wsin`/`wskew`, `WIND_*`; `windSweep`, `SWEEP_EVERY`/`SWEEP_T`/`SWEEP_MIN` (drawn: `drawSweep`, js/draw/ground.js) | `wind` |

## js/sim/shed.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| snow knocked off a pine's crown: the gust draws round each human, the wait and the rest that stagger it, the cap, and the blow (axe or shot) that always sheds | `SHED_*`, `shedStep` (called from `updatePlay`, sim.js), `shedHit` (called from `chopTree`, actions.js, and the arrow loop's wall branch, sim.js), `shedPuff` | `snow off the pines` (the read: `windGust`, js/sim/weather.js; the puff: `burst`, core.js) |

## js/net/events.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the sim's cosmetics recorded for screens that do not run it: a cue or a shake at a place / for a body, the ring, its flush and its replay | `sfxAt`, `sfxFor`, `sfxOwn`, `shakeAt`, `shakeFor`, `evPush`, `evDrain`, `evPlay`, `evRecord`, `evInStep`, `EV_ANYWHERE` | `sim events` |

## js/net/net.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| which role this screen plays, the transport interface and the loopback solo speaks through, who counts as a person, whether another screen shares the match (then nothing pauses it) | `NET`, `SNAP_EVERY`/`LATE_JOIN_T`/`RECONNECT_GRACE`/`IN_QMAX`/`IN_QWIN`, `isHuman`, `netShared`, `loopbackTransport`, `netSetup` | `net roles` |
| which relay or transport a screen uses, the three doors the title opens (host, join, leave), a room's listing and the roster to every peer | `RELAY_DEFAULT`, `netRelay`, `netSteam`, `netTransportFor`, `netHost`, `netJoin`, `netLeave`, `netHostRoom`, `netHostRoster`, `netClientRoster` | `net roles` |
| a host's half: inputs in (queued, one per peer per step, a press latched), HELLO / leave, the roster, the snapshot flush and the tile slices between flushes | `netHostStep`, `netInEdges`, `netHostHello`, `netHostFull`, `netHostLeave`, `netRoster`, `netHostFlush` | `host` |
| the party's moves: the page (seats or hero select) turned on every screen, a person shown out, a hero picked (a guest's through the leader) | `seatsOpen`, `netPhase`, `netClientPhase`, `seatKick`, `seatPick`, `netPick`, `NET.kicked`, `NET.phase` | `seats` |
| the party's READY list, bot level, mode, code, ratings and pings, sent with every roster | `roomInfo`, `roomInfoIn`, `seatReady`, `netReady`, `PING_EVERY`, `PING_EASE`, `pingsHost`, `pongIn`, `NET.ready`, `NET.pings`, `NET.aiLevel`, `NET.mode`, `NET.code`, `NET.ranks`, `NET.botLv` | `room info` |
| a client's half: its input out, welcome / full / snap in, the screen the local body calls for | `netClientStep`, `netClientHello`, `netClientWelcome`, `netClientApply`, `netClientMode` | `client` |
| a client's lifetime stats and the leap's cue, read off its own snapshot body (what the step gates on `p === player`) | `netClientStats`, `NET.was` | `client` |
| a client easing every moved body to where the host put it, over the time deltas take to arrive | `LERP_SNAP`, `netClientApplyDelta`, `netClientLerp`, `EASE_MAX`, `netEaseClock` | `client` |
| a client's own walk ahead of the host: the inputs kept, the step, the host's word restored before a snapshot and the unseen inputs walked again after it, the correction bled off | `PRED`, `PRED_FIELDS`/`PRED_KEEP`/`PRED_EASE`/`PRED_SNAP`, `netPredictable`, `netPredictWalk`, `netPredictStep`, `netPredictRestore`, `netPredictMend` | `prediction` |
| the mid-match proofs: a client checking itself against the host's full form, a host throwing away a share of its sends | `NET.verify`/`VERIFY_EVERY`, `NET.lossOut` | `net roles` (the `NET` literal), `host` and `client` (the compare: `snapCompareLoose`, snapshot.js) |

## js/ui/rooms.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| QUICKPLAY and RANKED: a party hosted at once, leaving it, RANKED's rating and the bots' level read off it, FIND MATCH (every empty seat a bot, the party to the hero select) | `PARTY_MODES`, `RANK_STEP`/`RANK_BAND`, `beginParty`, `leaveRoom`, `partySeats`, `partyName`, `partySize`, `rankLevel`, `rankResult` (its caller: `endMatch`, player.js), `partyFind` | `party lobby` |
| joining a friend's party by its code: the list looked up (the relay's, or Steam lobbies' data), typing and pasting, a join answered or refused | `SEEK_T`, `roomsFeed`/`roomsFeedOpen`/`roomsFeedClose`, `roomOk`, `partySeek`, `seekMatch`, `joinRoom`, `partyBootJoin` (its caller: boot.js), `codeType`, `codeBoxShown`, the `paste` listener, `updateRooms` | `party lobby` › `joining a friend's party by its code` |
| the party screen: your side's five seats, the empty seat's invite, the leader's kick, READY and its tick, the ping bars, the code copied on a click | `RS_*`, `RM_CODE_*`, `beginRoom`, `roomHost`, `roomSide`, `roomLayout`, `roomWords`, `seatAct`, `roomCode`, `roomCodeRect`, `roomHit`, `roomCopy`, `seatInvite`, `roomDo`, `roomClick`, `roomKey`, `roomAllReady`, `roomLevel` (the moves themselves: `seatKick`/`seatPick`, js/net/net.js) | `the room` |
| the rematch: the next seed at a match's end, the reload back into the same party with the same code, the seats carried over, a guest's retried join | `REMATCH_*`, `rematchCarry`, `rematchOffer`, `rematchUrl` (read by `toLobby`, js/ui/screens.js), `rematchHeard`, `rematchSeat`, `rematchBootHost`, `rematchBootJoin` | `the rematch` |
| the pixels: the seat, the code box, the relay pip, the code plate on the hero select, the in-match link pip | `RM_OK`/`RM_SLOW`/`RM_BAD`, `PING_GOOD`/`PING_OK`, `drawRoomWord`, `drawTick`, `drawPingBars`, `drawRelayPip`, `drawCodeBox`, `drawRoomSeat`, `renderRoom`, `drawCodePlate`, `drawRoomPlate`, `drawNetLink` | `the pixels` |

## js/ui/roomtalk.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the room's chat: cleaning, keeping and handing lines round, typing one, the plate and the lines | `TALK_*`, `talkClean`, `talkAdd`, `talkHeard`, `talkFrom`, `talkSay`, `talkKey`, `talkOpen`, `talkLayout`, `drawTalk`, `NET.chat` | `room talk` |
| INVITE in a Steam lobby, and a friend's invite taken up | `roomInviteRect`, `roomInvite`, `steamJoinRequested` (the launch's `+connect_lobby`: desktop/main.js) | `invite` |
| the nudge: a taskbar flash or a starred tab title when a screen out of focus is needed | `roomAttention`, `talkTitle` (the wrapper's `win:flash`, desktop/main.js) | `the nudge` |

## js/net/snapshot.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the match's state as one plain object: which fields are skipped, which singletons ride | `SNAP_SKIP`, `SNAP_STATE` | `snapshot` |
| network ids: a stable id per moving entity, refs as tokens, the pack and its inverse | `snapNids`, `snapMaps`, `snapNid`, `snapNidSet`, `snapKindOf`, `snapToken`/`snapDeref`, `packEnt`, `pack`/`unpack`/`snapResolve` | `snapshot` › `network ids` |
| building the full form and weighing it | `snapBuild`, `snapSize` | `snapshot` › `build` |
| writing a full form back into the world | `snapApply` | `snapshot` › `apply` |
| the ack-keyed delta: the shadow, the history ring, the cut from a base, the in-place apply | `HIST_KEEP`, `snapShadow`, `snapShadowReset`, `snapSame`, `snapFieldDiff`, `snapHistoryPush`, `snapTileScan` (a slice of the tiles; `netHostFlush` runs one each step between flushes), `snapHistoryAt`, `snapDeltaFrom`, `snapBuildDelta`, `snapTileSame`, `snapApplyDelta`, `snapAssign`/`SNAP_MERGE` | `delta` |
| the bytes: the binary form, the shared key dictionary, the quantized positions and velocities | `SNAP_Q`, `SNAP_QPOS`, `SNAP_QUANT`, `snapQable`, `snapQi`, `snapQv`, `ENC_TAG`, `encDict`, `snapEncode`, `snapDecode` | `encode` |
| the wire's proofs: the echo through the bytes, a run sent as deltas, the compare and its one tolerance | `snapBlank`, `snapFrame`, `snapCompare`, `snapCompareLoose`, `snapQuantize`, `netEcho`, `netEchoRun`, `netDeltaRun` | `the echo harness` (how to run them: [checklists](checklists.md#verifying-a-change); the design: [pvp-architecture](../pvp-architecture.md)) |

## js/net/transport-ws.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the WebSocket transport over the relay, and the live list of open rooms | `WS_RETRY`, `wsUrl`, `wsTransport`, `wsRooms` | `ws transport` (the relay itself: app/server.js) |

## js/net/transport-steam.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the Steam transport under the wrapper: the lobby, the reliable and unreliable channels and their framing, the lobby's data as the room's listing, the feed of lobbies | `STEAM_LIST_T`, `steamRooms`, `STEAM_CHUNK`, `STEAM_UNREL`, `STEAM_LOSSY_PARTS`, `STEAM_FRAME_HDR`, `STEAM_MAGIC`, `STEAM_PENDING`, `STEAM_LOBBY_MAX`, `steamFrames`, `steamTransport` (`send`, `receive`, `receiveFrame`, `roomData`) | `steam transport` |

## js/draw/depth.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a deep drift's pixels: crest, lip, outline, cast shade, the ripples on its top | `DEEP_PAL`, `deepTone` (called per pixel by `snowTile`, ground.js), `deepPx`/`deepIn` + the tile's depth window `DEEP_WIN`/`deepWin`/`deepTileOpen`/`deepTileClose` | `deep snow's look` |
| a body sunk to the shins in it, and the collar round the cut | `drawWading` (wraps `drawPlayer`/`drawAnimal`/`drawRobot` in `render()`), `wadeLook`, `wadeWidth`, `WADE_SINK`/`WADE_CUT` | `deep snow's look` |

## js/draw/ground.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| ground painting and runtime repaints; the lazy bake in chunks (boot's prep, the view's chunks, the idle fill) | `paintGroundTile`, `repaintGround`, `hash2`, `vnoise`; `GROUND_CHUNK`/`GROUND_CN`/`GROUND_IDLE_MS`, `groundDone`/`groundLeft`/`groundBaked`, the pixel pen `penDot`/`penFlush` (every single-pixel painter's fills), `prepGround` (called at boot), `bakeGroundChunk`, `groundView` (called by `render()` before the ground blit), `groundNext`/`groundIdle`/`groundIdleArm`, `renderGround` (the whole map now) | `ground prerender` |
| the road's pixels: the overlay and its colours, the ruts, the felled trunk across each forest end | `paintRoadOverlay` + `ROAD_COL_*`, `roadRutAt`/`roadRutCache`, `paintLog`/`LOG_COL` (under `paintGroundTile`) | `the road's pixels` (the geometry they read: `the road`, world.js) |
| the creek's pixels: the water, its lit lip and pale far bank, the still streaks, a ford's stone, the frozen stretch through the cistern, the current's moving glints, and the whitefish and snow char swimming down it under the water | `CREEK_COL`/`STONE_COL`, `CREEK_SUN_X`/`CREEK_SUN_Y`, `creekNear`, `paintCreek` (under `paintGroundTile`), `paintFordStone`, `drawCreekFlow` (called by `render()` right after the ground blit) + `FLOW_SPD`/`FLOW_RUN`/`FLOW_A`, `drawCreekFish` (just before it, so the glints run over the fish) + `SWIM_A`/`SWIM_BEAT` (the sprites: `SPRITES.creekFish`, js/baked/fish.js) | `the creek's pixels` (the geometry they read: `the creek`, world.js) |
| a lake's ragged shore, its bank (the downwind bank, dust and cracks laid over it: js/draw/lakes.js), the two lake styles and which one each lake rolled, the depth in from the shore, the night mirror's shore masks | `ICE_STYLES`, `bakeLakes` (`lakeStyle`/`lakeDepth`, rolled by `rollIceStyle`; a tile iced after the bake: `relabelIce`, from `repaintGround`), `iceAtPx` (the edge test), `depthAtPx`, `iceTone`, `bankAt`, `paintIceTile`, `paintSnowShore`, `mirrorCv`/`mirrorSlot`/`markMirror` | `the ice shore` (the mirror drawn: `drawIceStars`, js/draw/light.js) |
| open snow's drifts: the tones, the three looks and their regions, the height lattice and a chunk bake's shared window of it, a tile's tones, a chunk bake's row strip | `SNOW_PAL`, `SNOW_LOOKS`, `SNOW_REGION`/`SNOW_CUT`/`SNOW_BLEND`, `snowH`, `snowTile` (fills `snowTone`; the ice shore reads it too), `paintSnowTile`, `LAT_*`/`latVal`/`latHas`/`snowLatOpen`/`snowLatClose`, `snowStrip`/`snowBulk` (called by `bakeGroundChunk`) | `the snow's pixels` |
| the sweep's streaks: the world grid they are laid on, how many, how far they drift, how long, their strands, the shadow and the drift | `drawSweep` (called by `render()` before `drawDropAir`), `SWEEP_CELL_W`/`SWEEP_CELL_H`/`SWEEP_RUN`/`SWEEP_STREAKS`/`SWEEP_LEN`/`SWEEP_LAG`/`SWEEP_STRANDS`/`SWEEP_SHADE`/`SWEEP_BODY`/`SWEEP_FULL` | `the wind's sweep` (when one blows: `windSweep`, js/sim/weather.js) |
| a blizzard day's low streaks: their grid, their loops, speeds and lengths, and the one atlas they are drawn off | `drawDrift` (called by `render()` after `drawIceStars`), `blowAtlas`, `BLOW_*` | `the ground blizzard` |
| cast shadows: the sun's direction, what casts (by object type), a frame's shade, the scenery's baked into the ground, a changed caster's repaint, a body's drawn per frame | `SUN_DX`/`SUN_DY`, `SHADE_*`, `CASTERS`, `CAST_REACH`, `shadeMask`/`shadeFor`, `paintCastShade`, `shadeChunk` (a chunk bake's), `castAt`/`syncCasts` (called by `render()` before the ground blit), `drawCastShade` (bodies.js, the building pass in render.js) | `cast shadows` |
| the treasure chest's and the cairn's baked sprites | `CHEST_SPR`, `CAIRN_SPR` | `the scenery bakes` (drawn in the y-sorted pass, js/draw/render.js; the dummy's twin `DUMMY_SPR`: js/draw/practice.js) |
| which bend frame a pine is wearing, and whether it draws mirrored (off the wind field); the frame it stands in with no wind (its shadow's); its atlas row (palette variant, forest-depth tone) and the nudge off its tile centre | `treeFrame`, `treeRestFrame`, `treeLean`, `TREE_FRAMES`/`TREE_REST`, `treeCell`, `treeTone`/`woody`/`TREE_TONES`, `treeNudgeX`/`treeNudgeY`/`TREE_NUDGE_X`/`TREE_NUDGE_Y` | `the scenery bakes` |

## js/draw/landmarks.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a landmark on its tiles and its shade | `lmArtPos`, `drawLandmark` (from `render()`'s object pass), the `CASTERS` loop | `landmarks` |

## js/draw/lakes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the snow's depth as this file reads it (js/sim/depth.js's map), the prevailing wind | `snowDepthAt`, `deepSnowAt`, `DRIFT_MID`/`DEEP_TOP`, `rollPrevailing` (`LW_X`/`LW_Y`, off `driftWind`) | `the snow's depth` |
| every lake's label and area, which count as big | `bakeLakeBodies` (`lakeId`/`lakeTiles`), `BIG_LAKE`, `bigLakeAt` | `lake bodies` |
| the per-tile pixel lists the bake fills and every tile paint stamps, their inks, where nothing may land | `bakeDressing` (called by `prepGround` after `bakeLakes`), `paintDressing` (under `paintGroundTile`), `dressPx`/`crackPx`, `stampAt`, `DRESS_INK`, `dressFree` | `the dressing's stamps` |
| the mid band drawn: the piles in the lee of a pine, a rock, the hut, and the skirt round a deep drift | `bakeDrifts` (reads `leeDepth`/`driftsDepth` per pixel), `DRIFT_FADE` | `drifts in the lee` |
| the bank on a lake's downwind shore | `bakeBanks`, `BANK_W`, `SUN_TO_X`/`SUN_TO_Y` | `the downwind bank` |
| the long cracks on a big lake | `bakeCracks`, `walkCrack`, `crackLine`, `CRACK_*` | `long cracks` |
| the dust on the ice, and the hook that scuffs it | `dustIce` (called on each ice pixel by `paintIceTile`/`paintSnowShore`), `iceDust`, `dustLee`/`bakeDustLee`, `DUST_*`, `trodden` (reads `trampleAt`), `iceDustInvalidate` (trampled snow calls it) | `dust on the ice` |
| the weather on the ice every frame: the dials, blown streaks over big lakes, a frosty night's glints and cracks, fresh dust | `lakeSky`, `drawLakeSky` (called by `render()` after `drawIceStars`), `LSTREAK_*`, `GLINT_*`, `CRACK_FROST*`, `dustCv`/`DUST_VARS`/`DUST_LEVELS` | `the weather on the ice` |
| the lake's fish drawn: a shadow under the ice, crisp where one crosses an open hole | `drawIceFish` (called by `render()` right after the ground blit) | `the fish under the ice` |

## js/draw/trample.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the trampled snow: the grid (4 px cells), what stamps it (a walk, a slide, a crawl, a roll, a knockback, a blow, a death), the refill and the snowfall seam the weather feeds, which pixels trample (snow, ice, nothing) | `trPack`/`trChurn`, `trStamp`, `trBody`, `trampleStep` (called by `update()`, sim.js, beside the step on a host and after `netClientStep` on a client), `trRefill`, `trampleSnowfall`/`TR_SNOW_LIGHT`, `trMask`, `trampleGroundChanged` (called by `repaintGround`), `TR_*` | `trampled snow` |
| trampled ice thinning the lakes' dust: the read they take, the per-tile scan, the repaint queue handed to `iceDustInvalidate` | `trampleAt`, `trDustLayer`, `trDustScan`, `trDustSync`, `trDustSig`/`trDustQ`/`trDustHot` | `the dust on the ice` |
| its pixels: the pressed bands, the churned clods, the frost scuffed into ice, the chunk canvases and their pool | `TR_PACK_COL`/`TR_PIT`/`TR_LUMP`/`TR_FROST`, `trPaint`, `drawTrample` (called by `render()` right before the footprints), `trEvict` | `the trample's pixels` |

## js/draw/practice.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the practice dummy's baked sprite, and its LAST HIT / DPS / TOTAL plate | `DUMMY_SPR`, `drawDummyMeter` (its linger: `DUMMY_METER_LINGER`, js/sim/practice.js) | the file's head, above `the training grounds' pixels` (drawn in the y-sorted pass, js/draw/render.js) |
| the training field's pixels: the target face bakes (both sizes), the perimeter track's rails, a carriage target in any habit, the range bell, the round's readouts and its off-screen target chevrons, the big gate flag, the two-tile bow rack, the parkour's line and readouts, the roll die | `bakeTargetFace`/`TARGET_SPR`/`TARGET_SPR_S`, `drawAgTrack`, `drawPTarget`, `drawRaider`, `drawDfHold`, `AG_WEDGE_ART`/`drawAgRoundWedge`, `MEDAL_SPR`, `drawAgRings`, `drawAgBell`, `drawAgame`, `drawAgameUI`, `drawAgMarkers`/`AG_MARK_*`/`agMarkAtlas`, `drawBanner`/`bannerCloth`, `RACK_SPR`, `drawParkourLine`, `drawParkour`, `drawPkDie`, `PK_DIE_COL`/`PK_PIP_COL`/`PK_PIP_AT` | `the training grounds' pixels`, `the ice parkour's pixels`, `the roll station's pixels`, `the archery track's pixels`, `the range bell's pixels` (the records they draw: `practice arena`, js/sim/practice.js) |

## js/draw/zipline.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a pylon's sprite in each side's colour and its draw in the y-sorted pass, the cable pass (a span rasterised pixel by pixel with its sag and wind lean, over every body and canopy, under the night; the hovered line lit gold), the dotted walk to the hovered cable, and a rider's handle and rope | `PYLON_H`/`PYLON_SPRS`, `drawPylon` (dispatched from `render()`'s object pass), `ZIP_INK`/`ZIP_LIT`/`ZIP_HOV_A`/`ZIP_HOV_B`/`ZIP_GUIDE`, `drawZips` (between `drawDropAir` and `renderLighting` in `render()`), `zipLitLine`, `drawZipGuide` (after `drawAimLine`), `drawZipHandle` (from `drawPlayer`, js/draw/bodies.js) | `zipline` (the geometry it reads: `zips`/`zipPoint`/`zipLift`, the `zipline` banner, js/sim/zipline.js) |

## js/draw/icebreak.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| an ice break's pixels: the warning cracks, the water, the plates in flight, the crack band and the long cracks, the freeze front and the new ice, the canvas each break owns | `IB_*`, `breakArt` (the parts that never change, built once a screen), `paintIceBreak` (one frame of it), `drawIceBreaks` (`render()`, after the pick cracks) | `ice breaks, drawn` (the thing itself: js/sim/icebreak.js) |

## js/draw/orca.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the orca's pixels: the shadow under the ice (cut to the ice's own pixels, a little deeper at the lock and darkening as it rises, its tail beating with its speed) and the breach (the lunge out of the hole, jaws anchored on the bitten spot, cut at the waterline, the slide back down) | `ORCA_SHADE*`, `ORCA_DEPTH`/`ORCA_DROP`/`ORCA_JAW_AT`, `orcaMask`/`orcaMaskBuild`, `drawOrcaShadow` (`render()`, after the lake's fish), `drawOrcaBreach` (the y-sorted list's `orca` entry, `render()`) | `the orca, drawn` (the thing itself: js/sim/orca.js; the count: `drawOrcaCount`, js/draw/overhead.js) |

## js/draw/cistern.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the cistern's pixels: its flat layer into the ground canvas a tile at a time, its stone into render's y-sorted pass (with the orca out of its ice), and the `.` view's footprint edge and feet rings | `cistOrigin`, `paintCisternFlat` (under `paintGroundTile`, ground.js), `pushMiddleDraws` (from `render()`), `drawCisternSeg`, `drawOrcaUp`, `drawCisternHitbox` (from `drawHitboxes`, render.js) | `the cistern's pixels` (the sim: js/sim/cistern.js) |

## js/draw/tunnel.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a burrow's pixels: the hole (crumbling as it caves) and its rings (the dig draining gold, your wait filling pale blue), the mound a rider pushes up, the dig's ring under a digger, the aim's ghost, the work key's cap over a hole | `tunOval`, `tunRing`, `tunHoleArt`, `drawTunnelHole` (the flat pass of `render()`), `drawTunnelGround` (`render()`, after it), `drawTunnelGhost` (beside `drawBuildGhost`), `drawTunnelHint` (`drawWorkHint`, js/ui/wheel.js), `TUN_RING_*`/`TUN_*_COL` | `tunnels, drawn` |

## js/draw/overhead.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the arrow body every shaft draws: the DDA rasteriser (crisp diagonals, mirrored vanes; the arrow's map by default, a bit's own shaft map when handed one), the parse that makes a shaft map, and its rim/colour painter | `arrowBodyPx`, `shaftBody`, `paintArrowPx` (the master: `ARROW_MAP`/`ARROW_BODY`, actions.js; the other shafts: `the bodies a bit flies as`, render.js) | `the arrow body, shared` |
| the overhead frame and the name over it: the three bars' palette (health by side, stamina white, the draw meter's two golds) | `BAR_FRAME`/`BAR_TRACK` (every frame's opaque ink and track), `BAR_NEUTRAL`/`barCol`, `STAM_COL`/`STAM_GHOST`, `DRAW_COL`/`DRAW_FULL_COL`/`DRAW_FULL_FLASH`, `NOCK_COL`/`EAT_COL`, `THREAT_COL` (a camp monster's leash bar; a deer's sprint bar and a rabbit's dodge bar reuse `STAM_COL`), `drawHealthBar` (a plate: `healthBarPx` draws it; its `u` hangs the body's damage total) and its hp chunks (`HP_SEG`/`HP_SEG_PX`/`hpSegCount`/`evenBarW`) | `the arrow body, shared, and the frame over every unit's head` (where the stack sits and the odd-width centring: `FRAME_DX`/`centreTextX`, js/draw/bodies.js) |
| the dawn shield's gold row over a player's hp bar, and the lift it gives the meter, name and callout | `drawShieldBar`, `SHIELD_LIFT`, `SHIELD_HI`/`SHIELD_LO`/`SHIELD_TICK`/`SHIELD_GLINT` (called by `drawPlayer`, js/draw/bodies.js) | `the arrow body, shared, and the frame over every unit's head` |
| the orca's count over the head it is after: 3 2 1, one big white number over the frame, hopping as each lands | `drawOrcaCount`, `ORCA_COUNT_*` (called by `drawPlayer`, js/draw/bodies.js, off `orcaLine`, js/sim/orca.js) | `the arrow body, shared, and the frame over every unit's head` |
| the level plate a hero and a beast share, the noticed `!` over an animal that sees you, the stun stars | `drawLevelBadge`, `drawSenseMark`, `drawStunStars` (under `drawHealthBar`) | `the arrow body, shared, and the frame over every unit's head` |
| the running damage total beside a frame's right edge: queuing it with the frame, its size, hold, fade and pop, a dead body's float, stamping it on the screen after the world blit, and a target's gold word beside them | `queueTally`, `drawTallies` (called from `render`, js/draw/render.js), `tallyImg`/`tallyInk`, `TALLY_SC`/`TALLY_POP_SC`, `TALLY_FADE`/`TALLY_POP`; a dead body's total floating off: `tallySpot`, `TALLY_DEATH`/`TALLY_RISE`, `tallyFall` (called from `trackDowns`, js/draw/bodies.js) (the total itself: `tallyHit`, js/sim/core.js) | `the running damage total beside the bar` |
| the build reveal a structure grows in under, and the barracks' overlay | `bigBuildReveal`, `drawBarracksOverlay` | `the arrow body, shared, and the frame over every unit's head` (the barracks' entry: `STRUCTS`, structures.js) |

## js/draw/structs.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the turret's sling - the PART TABLE it is drawn from (a row's `from` is the tier it appears at: that is the whole of how the three forks differ), this frame's pouch, cords and fork geometry, the ink a part wears, and the rasteriser that lays them at the live bearing | `SLING`, `SL_MOUTH`/`SL_DRAW`/`SL_FLY`/`SL_FLARE`, `slingState`, `slingInk`, `slingPart`, `drawTurretHead`, `paintRimmed`, `SLING_WOOD`/`TUR_RIM` | `the turret's sling, its rocks, the bay, the net and the tiled struct` |
| a thrown rock's tumbling body, and the dashed aim ARC plus the cords snapping on the release | `drawSlungRock`/`ROCK_MAP`/`ROCK_INK`, `drawTurretFx`, `TUR_ARC`/`TUR_LET` | `the turret's sling, its rocks, the bay, the net and the tiled struct` |
| the gold pump's stroke frame and its payout coin, the bay's overlay, the fish net's draw, a tiered piece's sprite and where it is laid (read by the draw and the shot's sweep), a tiled building's draw (one tile of art per footprint tile) | `pumpFrame`/`drawPumpCoin` (`PUMP_STROKE`, `PUMP_HOP`), `drawBayOverlay`, `drawNet`/`NET_FISH_AT`, `structSprite`, `structArtOff`, `drawTiledStruct` | `the turret's sling` (the file's one banner; what they read: `STRUCTS`, structures.js) |

## js/draw/canopy.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the canopy window: a pine or snag drawn over the viewed hero's model opens round exactly what it covers, eased by how much | `CANOPY_FULL`, `CANOPY_CUT`, `canopyFrame` (from `render`), `heroLayerOpen`/`heroLayerClose` (from `drawPlayer`, js/draw/bodies.js), `canopyOver`, `drawWindowed` (the tree and snag branches of `render`'s y-sorted pass), `inkMask` | `canopy window` (the shin clip it copies: `wadeCut`, js/draw/depth.js) |

## js/draw/bodies.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| drawing players / animals / robots / the merchant / held tool; a worn skin body standing in for the class body (its clock, the held tool and ability marks grown about the feet) | `drawPlayer`, `ROBOT_IDLE_FPS`, `WORN_SC`, `atFeet`, `drawGhost`, `drawHeldTool`, `drawAnimal`, `drawBird`, `drawRobot`, `drawMerchant` (dispatched from `drawRobot`) | `the player` (`drawPlayer`, `drawGhost`, `drawHeldTool`) and `beasts, robots and the merchant` (the rest; the overhead block inside `drawPlayer` reads js/draw/overhead.js) |
| which run or roll frame a class body shows: the stride off `animT`, the held run for busy hands, the bob what rides the body follows, the roll's frame off how far through `DODGE_T` | `RUN_STEP`, `runFrame`, `handsBusy`, `runBob`, `rollFrame` (the frames: `SPRITES.champ[c][team].run`/`hold`/`roll`, js/sprites/characters.js) | `the player` |
| the frame a beast is on: its clip and how far into it, wrapped so any `animT` lands on a frame | `clipFrame` (the clip is `a.clip`, set in js/sim/wildlife.js from `ANIM_CLIPS`; the frames are `SPRITES[kind][dir][clip]`, built in js/sprites/beasts.js and bears.js by `bakeClips`/`mapClips`, js/sprites/core.js) | `beasts, robots and the merchant` |
| a bear buff worn: the ring of pips around the feet in that bear's colour (`p.buffKind`) | `BUFF_RING`/`BUFF_COL`, `drawBuffRing` (above `drawPlayer`) | - |
| a body going down: the frozen shatter or the wind, picked by `hash2(id, deaths)`, started off the edge of `p.dead` | `DOWN_T`, `trackDowns` (from `render()` before the draw list), `goingDown` (also held by `viewPlayer` and the replay), `drawDown` | `going down` |
| the snow over a buried body, its row spans, and the bury meter | `drawSnowCover`, `poseBounds`, `poseSpans`, `drawBuryRing` | - |
| worn gear on the 16×16 sprite | `GEAR_MARKS`, `drawGearMarks` | - |
| where the overhead stack sits on a model, centring odd-width text on it, and the two frames that wear none of it | `FRAME_DX`, `centreTextX`, the `state.mode === 'title' || endScreen()` bail in `drawPlayer` (a composition somebody looks AT, not a match somebody reads) | - (the bars themselves: `drawHealthBar`, js/draw/overhead.js; `endScreen`: js/ui/screens.js) |

## js/draw/marks.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the camp glyph both maps stamp, and the respawn clock a hovered anchor wears | `drawCampIcon`, `drawCampClock` | `the camp glyph both maps and the drop chart stamp` (its `CAMPS` spec: `camps`, js/sim/camps.js) |
| what a flag looks like: the order's glyph (at any scale), the map pennant, the ring an order covers (every standing one and the held wheel's preview), the planted banner, and a map's pennant-with-ring | `drawFlagIcon`, `drawFlagPennant`, `drawFlagRing`, `drawFlagRings`, `drawFlag`, `drawFlagMark` | `what a flag looks like` (what they read, `FLAG_TYPES`/`FLAG_R`: `team flags`, robots.js; the wheel's pick: `wheelLayout`, js/ui/wheel.js) |
| what a body looks like on either map: the square in its side's ink (a player one step bigger than a robot), the watched body's white heart in its side's ring, the bird diamond, and a rival's cross under a colour-blind palette | `drawMapDot`, `drawMapUnit`, `drawMapCross`, `drawMapYou`, `drawMapBird` | `what a body looks like on a map` (its two callers: `renderMinimap` js/ui/minimap.js, `renderWorldMap` js/ui/panels.js) |
| a zipline on either map: a crisp two-pixel ribbon in its side's ink pylon to pylon, each pylon a pale pixel on it | `drawMapZip`, `MAP_ZIP_PYLON` | `a zipline on a map` (its two callers: `renderMinimap` js/ui/minimap.js, `renderWorldMap` js/ui/panels.js; the lines: `zips`, js/sim/zipline.js) |

## js/draw/callouts.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a callout looks like: the plate over the caller's name (or over the ping when the caller is off the screen), its glyphs, the ground ping's pulse, the minimap's | `drawCallouts` (called after `renderLighting`, render.js), `drawCallPlate`, `CALL_GLYPHS`, `callTag`/`callAnchor` (set from `drawPlayer`, js/draw/bodies.js), `drawCalloutsMap` (called from `renderMinimap`, js/ui/minimap.js) | `callout pixels` (what a call is: `bot callouts`, js/ai/ai-callouts.js) |

## js/draw/light.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| one baked speck (mote, star, flake) at a quantised brightness, and the atlas behind it | `bakeSpecks`, `drawSpeck`, `SPECK_*` | `light & weather` › `specks` |
| drifting cloud shadows, and the tileable noise they are baked from | `cloudShade`, `cloudLayer`, `bakeCloud`, `pnoise`, `CLOUD_*` | `light & weather` › `cloud shadows` |
| whether the sun shafts are up at all (the drop window, and noon), and the shafts themselves | `rayLight`, `godRays`, `RAY_*` | `light & weather` › `god rays` |
| the ice's night mirror + the parallax stars in it, and the "is this pixel on unbroken ice" mask (the painted shore's, `iceAtPx`) | `drawIceStars`, `overIce`, `STAR_*` | `light & weather` › `the reflected sky` |
| the hour's colour grade (rose dawn, crisp midday, gold dusk: a warm multiply over a cool screen off keyframes on `state.time`, and the noon self-multiply) | `todGrade`, `todMix`, `todNoon`, `TOD_KEYS`/`TOD_CRISP`/`TOD_NOON*` | `light & weather` › `the hour` |
| a clear frosty day: its cool grade and all-day crisp (applied in `todGrade`), the cloud it clears, the glints on bare snow, and a blizzard's milky haze | `FROST_TINT`/`FROST_CRISP`/`FROST_CLEAR`, `drawFrostGlint`, `GLINT_*`, `BLIZ_HAZE`/`BLIZ_HAZE_A` | `light & weather` › `frost glints` |
| the night colour, a lit shot's halo, snow (world-space flakes, see `fx updates`), vignette | `renderLighting`, `NIGHT_TINT`/`NIGHT_DEEP`/`NIGHT_DEEP_A`, `litShots`, `renderWeather`, `renderVignettes`/`vigCv` | `light & weather` › `the pass` |
| an open snowdrop's light, laid above every grade (its pool, bell, halo, twinkles and motes) | `litSnowdrops`, `litDrops` (filled by `render()`'s snowdrop branch), `SNOWDROP_POOL`/`SNOWDROP_SPECKS`, `SNOWDROP_*` | `light & weather` › `lit snowdrops` |
| the night RIM: the world-space vignette that closes the view in rather than dimming the middle | `nightEdge`, `NIGHT_EDGE`, `nvGrd` | `light & weather` › `the pass` |
| **text over the world, held back from the night grade** (a name tag, MERCH/PERCH, a damage floater, a sense mark), and **the frames over bodies, held back with it** (every bar, a player's and a beast's whole frame, PERCH's bar) | `drawWorldText`, `flushWorldInk`, `worldInk`, `inWorldLayer` (the world buffer or the air layer); `overheadPlate`, `flushPlates`, `worldPlates`, `platesNow`; the riders' names on a wing, the one text that never lands on another (ground names overlap): `drawNameTag`, `settleNameTags` (run by the flush), `TAG_GAP`/`TAG_CLIMB` | `light & weather` › `ink over the world` |

## js/draw/render.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| render pass order | `render` | `render` |
| the work-target rim: gold outline on the hovered tree/dead tree/berried bush/chest | `drawTargetRim`, the `o === wkO` stamps in the y-sorted pass | `render` |
| a rock as drawn: its kind or its rubble, the cracks and bar of its progress, its glint, and the ring of the pick's reach on the snow | `drawRock`, `drawMineRing`/`MINE_RING_NEAR`, `ROCK_GLINT_T`/`ROCK_GLINT_NIGHT` | `render` (above `drawTargetRim`; the art: js/sprites/rocks.js) |
| the `.` overlay: hitboxes, the model centre column, and its 1px ring/box/line rasterisers | `drawHitboxes`, `hbRing`, `hbBox`, `hbDot`, `hbLine`, `hbMid`, `HB_*` | `debug overlays` |
| the `.` overlay's routes: waypoints + goal tile, a bird's perch line, a fish's heading arrow | `drawNavPaths`, `hbArrow` | `debug overlays` |
| which body a bit flies as: the plain arrow and the three shafts that are not it (barbed, icy, gold with a glint), the grapple on its cord, the turning log, the comet wisp, the swung fist and axe, the teleport request; the inverse-sampled turn they share | `BIT_BODY`, `drawShaft`, `BARB_BODY`/`LANCE_BODY`/`CARE_INK`/`drawCare`, `HOOK_BODY`/`drawHook`, `stampTurned`, `LOG_MAP`/`drawTumbler`, `drawMote`, `drawSwungBody`/`FIST_MAP`/`AXE_MAP`/`BIT_INK`, `drawWarpShot` | `the bodies a bit flies as` (and its `the shafts` / `the swung bodies`, with `BIT_BODY` at the section's foot; the names they answer to: `body` on `BITS`, tools.js) |
| a burning shot's head: the tongue of fire (longer the hotter), and a CINDER BURST's sparks | `drawShotFire`, `FIRE_FLICK` | `the bodies a bit flies as` › `fire riding a shot` (called from the shots pass for any `a.burn > 0`) |
| the silhouettes a teleport strings across its jump | `drawWarps` | `render` › `the teleport's flash` (the flash itself: `warpPlayer`/`warps`, tools.js) |
| the ring and the risen icon a TOOL SWAP raises, on every player | `drawSwaps` | `render` › `the teleport's flash` (below `drawWarps`; the event itself: `swapFx`/`swaps`, tools.js) |
| **the two item icons that MOVE** (the gold piece, the berry): the frame stamped into each one's live canvas, once a frame off one clock, so `SPRITES[ITEMS[type].icon]` stays one generic read everywhere | `stepItemIcons`, `ITEM_FR` (the frames: `SPRITES.itemAnim`; the grids: the `gold nugget` and `items` sections of js/sprites/items.js) | `render` (called at the top of `render()`, before anything draws) |
| pointer state and the bow aim line | `cursorInfo`, `drawCursor`, `drawAimLine` | `cursor & aim line` |

## js/ui/wheel.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| radial menu geometry and hit math | `wheelSpan`, `wheelAng`, `wheelOptions`, `wheelLayout`, `resolveWheel`, `wheelOnOwnFlag`, `WHEEL_*` | `radial wheel` |
| brackets, the E prompt (never over what the hands take on their own, never under an open counter, and never over a work target at one - the `E SHOP` cap wins there and `drawWorkHint` stops on it), the fish brackets, wheel pixels, the command a pick runs | `drawSelection`, `drawWorkHint`, `drawFishHint`, `renderWheel`, `drawWheelHub`, `drawWheelStick`, `runCmd` | `selection, hints & wheel` |
| the `E SHOP` cap over a merchant in reach (it returns whether it drew: the merchant owns E in that bubble), the bare cap over a zipline's cable while the body stands under either side's (`zipNear`, js/sim/zipline.js - the key's next claim after the merchant's), and the arena's three caps | `drawShopHint`, `drawZipHint`, `drawBellHint`, `drawPkHint`, `drawRackHint` | `selection, hints & wheel` (the resolver behind the shop's: `merchNear`, js/ui/shop.js) |
| a keybind indicator: the key cap (the bound key's face, hover and listening states), the cap + verb prompt and its footprint, the action -> pad glyph table, the glyph worn while a pad is in hand, and the ESC BACK / CLOSE line under a slab | `drawKeyCap`, `drawKeyPrompt`, `promptW`, `PAD_BIND`, `padBindW`, `drawPadBind`, `drawBackHint`, `pixDisc`/`pixRing` (the scanline disc and ring every pad glyph is built from) (the flight HUD's two: `drawDropBind`, js/sim/eagle.js; the glyph pictures: `drawPadGlyph`, js/ui/panels.js) | `selection, hints & wheel` |
| the build list and its ghost: the one toggle and the last piece it opens on, the build key's tap-or-hold (the piece wheel), the rows standing over the strip's meal wells (the strip's 1x space) and their hit tests, a piece's icon, what the ghost snaps to and whether it can stand or be paid for, a wall's dragged run and the order it sends, the draws - and the piece the pointer wears | `BUILD_ROW`/`BUILD_W`, `BUILD_OK`/`BUILD_NO`/`BUILD_BROKE`/`BUILD_LIT`, `PIECE_HOLD`, `buildLast`, `buildTabUp`, `buildTabRect` (the column's anchor over `foodCellRect(0)`), `buildRowRect`, `buildHeadroom`, `buildListHit`, `buildCanOpen`, `toggleBuild` (a tap of T), `buildPick`, `buildKeyPress`/`pieceWheelShown`/`buildKeyRelease` (T's press and release, `keyPress`/`keyRelease`), `buildIcon`, `buildGhostAt`, `buildOrder` (a press or a drag's release, `pointerPress`/`pointerRelease`), `drawBuildGhost`, `drawBuildList` (drawn by `drawHudStrip`, js/ui/hud-draw.js), `drawBuildCursor` (off `cursorInfo`'s `piece`, js/draw/render.js) | `selection, hints & wheel` › `the build list and its ghost` (the placement rule it asks: `canPlaceAt`, structures.js) |

## js/ui/minimap.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the minimap (and the disc's inverse projection, for a walk ordered on it) | `renderMinimap`, `mmClockShown` (the clock under the disc, only while no team rail is up), `mmWorldAt`, `updateMinimap` (throttled to `MM_REBUILD` ticks), `mmChrome`/`mmArcBand` (the disc's baked chrome and cached day/night arc band), `mmMask`/`mmRing`/`mmView` | `minimap` (the disc's per-tile colour comes from `objMapColor(o)`: `world`, world.js; the marks over it: `drawMap*`, js/draw/marks.js) |

## js/ui/bag.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the backpack: the inventory DRAWER under the weapon shelf top-left, shut until B / L3 / the small tab under the weapon well (the counter holds it open), sliding out from under the tab; its twelve small cells, the refusal flash, the full-bag amber | `HUD_CELL` (the one well size the strip and the shelf share), `BAG_CELL`/`BAG_GAP`/`BAG_PAD`/`BAG_BG`/`BAG_WELL`/`BAG_TAB_W`/`BAG_TAB_H`/`BAG_TAB_AIR`/`BAG_SLIDE_T`, `bagEase` (chases `bagOpenNow` in `updateFx`, sim.js), `bagOpenNow`, `bagTabRect`, `bagFrameRect`, `bagCellRect`, `bagCellPlate`, `cornerMouse` (the corner's size map about the top-left corner), `bagHit`, `bagClick`, `bagDenied`, `drawFoodClock`, `drawBag` | `the backpack: a DRAWER under the weapon shelf, top-left` |
| is the pointer over HUD that owns its own clicks, rather than over the world | `overHud` | `the backpack` (its caller is `openFlagWheel`, input.js) |
| carrying an item between the grid, the weapon slot and the shelf | `state.drag`/`state.dragPend`, `dragTake`, `dragLift` (a well's item onto the cursor), `dragReturn`, `dragDropBag`, `throwCell` (the throw's heading + lock: `flingDrop`/`lockDrop`, core.js; a tool's bits: `shedBits`, tools.js) | `carrying an item on the cursor` (the press / move / release and the other two drops: `hudPress`/`hudMove`/`hudRelease`, `dragDrop`/`dragDropBit`/`dragDropSlot`, js/ui/strip.js; the ghost: `drawDragGhost`, js/ui/hud-draw.js) |
| where the item a drop DISPLACES goes - home, which makes the drop a swap | `dragHome` (its three callers are the three `dragDrop*`; false = the ousted item rides the cursor as before) | `carrying an item on the cursor` |
| **what a gesture answers with** — one call raising the cue, the rumble and the well's pulse together (five kinds: grab / place / seat / swap / deny) | `hudFx`, `HUD_FX`, `WELL_LIT_T`/`DRAG_LIT_T`, `wellLit`/`dragLit`, `wellLitAt`, `drawWellLit` (aged in `updateFx`, sim.js; the rumble: `haptic`, input.js) | `what a gesture answers with` |
| **what letting go would do**, as a ring on the well under the pointer while something is carried | `dropKindBag`, `dropKindSlot`, `dropKindBit`, `DROP_RIM`/`dropRim`, `drawDropRing` (the promise over the ghost: `drawDropPromise`, js/ui/hud-draw.js) | `what a gesture answers with` |
| the character panel (G): the live body with its gear bands, the stat ledger off the live kit, the four gear pieces and their buys | `CHAR_LEDW`/`CHAR_WELL`, `charLayout`, `charHit`, `gearHit` (the piece-index read tipAt and the cursor keep using), `charClick`, `drawCharPanel` (state: `state.charOpen`, core.js) | `the character panel (G)` |
| the SHIFT key cap over the pack: where the hovered well would send what it holds | `shiftVerb` (LOAD / STOW / HOLD / null, asking `sendAt`'s wells in `sendAt`'s order), `drawShiftHint` | `the pack's SHIFT plate` (the cap itself: `drawKeyPrompt`, js/ui/wheel.js) |

## js/ui/strip.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the hud strip (bottom-centre), its geometry and hit tests: the portrait, the four ability wells, the health and stamina bars, the meal wells and the purse, the fish picker over the fish well, the refusal flashes, the floating buy plates, the slide home and away | `AB_CELL`/`AB_PAD`/`PORT_SQ`/`PORT_GAP`/`AB_ROW_W`/`FOOD_GAP`/`FOOD_N`/`FOOD_W`/`HP_H`/`ST_H`/`BAR_TOP`/`ST_TOP`/`XP_TAG`/`AB_W`/`AB_H`/`FOOD_BTNS`/`AB_BUY`/`AB_BUY_AIR`/`HUD_SLIDE`/`hudStripRect`/`hudInT`/`hudHome`/`stripCellRect`/`abCellRect`/`portraitRect`/`hpBarRect`/`stBarRect`/`foodCellRect`/`goldCellRect`/`foodDenied`/`toolDenied`/`abDenied`/`abBuyRect`/`abBuyHit`/`FISH_POP`/`fishPopRect`/`fishPopCellRect`/`fishPopUp`/`fishPopHeadroom`/`stripHit` (its pixels: `drawFishPop`, hud-draw.js) | `hud strip` (its pixels: `drawing the strip, the shelf and the carried item`, js/ui/hud-draw.js) |
| the weapon's "it does not fit in here" red on the shelf's tool cell, the backpack's twin | `toolFlash`, `toolDenied` (aged in `updateFx`, sim.js, beside `bagFlash`) | `hud strip` (its head, above `hudStripRect`) |
| the hud frame: the chamfered plate (dark outline, a faint edge inside it, solid ground, all neutral graphite; League and Dota kept simple) the strip, the pack and the team rail stand on | `HUD_INK`/`HUD_EDGE`/`HUD_FROST`, `chamCut`, `drawHudFrame` | `the hud frame` |
| the HUD size dials, one per widget (`settings.hudScale` the strip, `hudCorner` the corner, `hudRail` the rail): every 5% from `HUD_MIN` to `HUD_MAX` plus the sizes crisp on this screen, capped where the widget would outgrow the view, the stop nearest a stored value, a bake's landing on the device grid, and the pointer's map back through the strip's bottom-centre anchor | `HUD_MIN`/`HUD_MAX`/`HUD_FINE`, `hudCrisp`, `hudSizes`, `hudPick`, `hudFit`, `stripCap`/`cornerCap`, `hudSc`/`cornerSc`, `hudSnapDown`, `hudPx`, `stripMouse` (the rail's own: `railCap`/`railSc`, js/ui/rail.js; the sliders: `HUD_DIALS`, js/ui/panels.js) | `the hud frame` (the bakes and blits: `drawHudScaled`/`drawCornerScaled`, js/ui/hud-draw.js) |
| the WEAPON SHELF top-left, up at all times - the one weapon the HUD shows: the row (cell -1 is the tool in its bigger well, with the sweep and the refusal red), what the pointer is on, the lines that say which fitting powers which shot | `SHELF_CELL`/`SHELF_ITEM`/`SHELF_GAP`/`SHELF_WGAP`/`SHELF_PAD`/`SHELF_LINE`/`SHELF_TOP`/`SHELF_SLOT`/`SHELF_X`, `shelfLines`, `shelfRowY`, `shelfRowRight`, `shelfPlateRect`, `shelfPlateHit` (the plate it stands on, and its click), `shelfCell`, `shelfBits`, `shelfUp`, `shelfCellRect`, `shelfHit`, `shelfRails` | `the weapon shelf` (one well and the draw: `shelfWell`/`drawShelf`, js/ui/hud-draw.js) |
| what the top-left corner claims of the frame, so another panel can be pinned clear of it | `CORNER_CLAIM`/`CORNER_REACH`, `cornerClaim` (across: the widest row a tool can grow to, or the drawer), `cornerBottom` (down: the open drawer's foot) - both at the corner's size (`cornerSc`), both read by `shopLayout`, js/ui/shop.js | `the weapon shelf` |
| a click or SHIFT-click SENDING an item to its one other side (bag <-> weapon, bag <-> shelf), or using a consumable (`ITEMS[type].use`, the burrow) | `sendBagCell`, `sendBitCell`, `sendSlot` (each returns whether it handled the click), `sendAt` (the shift-while-carrying hit test) | `one click sends it to the other side` (resolved in `hudRelease`, refused by `bagDenied`/`toolDenied`; the words: `tipSend`, js/ui/tooltip.js) |
| the press / move / release a drag is made of, and the three drops it can end in | `DRAG_SLOP`, `hudPress`, `hudMove`, `hudRelease`, `dragDrop`, `dragDropBit`, `dragDropSlot` (the take, the lift, the return and the bag drop: `carrying an item on the cursor`, js/ui/bag.js) | `the press / move / release the drag is made of` (its three listeners: `input`, input.js) |

## js/ui/hud-draw.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the plate a tier is stated on, wherever an item sits | `tierPlate`, `drawItemIcon` | `the plates, bars and icons the widgets share` (the tiers themselves: `TOOL_TIERS`, tools.js) |
| the hatch that marks a MODIFIER bit apart from a projectile, in every well either sits in | `modPlate` (its callers: `drawBag` js/ui/bag.js, `drawShelf`/`drawDragGhost` here, `drawTooltip` js/ui/tooltip.js, `drawShopWell` js/ui/shop.js, `drawWikiRow` js/ui/wiki.js, `drawToolPrimer` js/ui/panels.js) | `the plates, bars and icons the widgets share` (the `proj` flag it reads: `BITS`, tools.js) |
| the strip's pixels: the portrait (its xp band round the square, the level badge, the xp numbers over it, and the level-up it watches for), the health and stamina bars, the ability wells (and the cooldown-ready flash), the meal wells and the purse, the buy plates, the whole strip | `drawPortrait`/`portraitSprite`/`xpFrac`/`abLvSeen`/`PORT_*`, `drawHpBar`/`HP_*`, `drawStBar`, `drawClassAbCell`/`abCdSeen`, `drawFoodCell`, `drawGoldCell`, `drawAbBuyPlate`, `drawHudStrip`, `LOCK_DIM`, `cardDenied` | `drawing the strip, the shelf and the carried item` (their geometry: `hud strip`, js/ui/strip.js) |
| the cooldown sweep: League's radial clock cut to a square, and the ONE shape every wait is drawn in - the shelf's tool cell, the four ability wells and both meal buttons (through `drawFoodClock`); rasterised a pixel at a time and coalesced into one fillRect a run, the hand dropped below 12px of cell | `drawSweepCover`/`CD_SWEEP`/`CD_EDGE` | `drawing the strip, the shelf and the carried item` |
| the HUD size dials' draws: the 1x bake blitted about the strip's bottom-centre anchor (grown over the open build list: `buildHeadroom`), and the top-left corner's own bake (the shelf and the drawer: `drawCorner`) | `hudScaleCv`, `drawHudScaled`, `cornerScaleCv`, `drawCorner`, `drawCornerScaled`, `HUD_BAKE_HEAD` (the scales and the pointer's map back: `hudSc`/`cornerSc`/`stripMouse`, js/ui/strip.js) | `drawing the strip, the shelf and the carried item` |
| the shelf's pixels: one well, the row, the draw | `shelfWell`, `drawShelf` (its geometry: `the weapon shelf`, js/ui/strip.js) | `drawing the strip, the shelf and the carried item` |
| the carried item on the cursor, and the promise under it | `drawDragGhost`, `drawDropPromise` (drawn after `drawDragGhost`, over it; the ring's kind: `dropKind*`, js/ui/bag.js) | `drawing the strip, the shelf and the carried item` |

## js/ui/rail.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the team rail, top centre: one thin plate, the roster as 12px rimless emblems with a hp bar each in the side's colour, your teammates (never you) then the rival's, the score well held at the centre (the match clock over the two kill totals); a chip is up, waiting (the seconds to respawn in place of the emblem) or out (the emblem dim) - its whole-number scale about the top-centre anchor, the pointer's map back through it, the hover hit, and the bottom edge the top-centre headlines and the spectate control hang under | `RAIL_CHIP`/`RAIL_BAR`/`RAIL_BODY`/`RAIL_GAP`/`RAIL_SEP`/`RAIL_CLOCK_W`/`RAIL_LINE`/`RAIL_WAIT`/`RAIL_HOV`/`RAIL_Y`/`RAIL_PAD`/`RAIL_H`/`RAIL_SLIDE`/`RAIL_TRACK`, `railSides`, `railKills`, `railChipsW`, `railLayout`, `railSc`, `railBottom`, `headlineY`/`noteY`, `railMouse`, `railHit`, `drawRailChip`, `drawRailScore`, `drawRail`, `railScaleCv`, `drawRailScaled` (the tooltip: `tipRail`, js/ui/tooltip.js; the emblems: `CLASS12`/`classIcon12`, js/ui/menu.js; its reader off the HUD: `specLayout`, js/ui/screens.js) | `the team rail: the roster along the top edge` |

## js/ui/cheats.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the practice bar down the left edge: its buttons and icons, its geometry under the corner and its capped scale, the hit test, a press, the armed teleport/dummy aim and its world ghost, the fold tab, the tooltip card | `CHEATS`, `CB_*`, `CB_ICONS`/`cbIcon`, `cheatUi`, `cheatBarUp`, `cheatPlateRect`/`cheatCellRect`/`cheatTabRect`, `cheatTop`/`cheatSc`/`cheatMouse`, `cheatHit`, `cheatClick`, `cheatAimPress`/`cheatAimOk`/`cheatAimOff`/`cheatAimLive`, `drawCheatBar`, `drawCheatGhost`, `tipCheat` (the press wiring: mousedown/Escape/right button, js/app/input.js; the commands: `cheatCmd`, js/sim/practice.js) | `the practice bar` |

## js/ui/tooltip.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what the pointer is on, said in words | `tipAt`, `tipResolve`, `tipNow`, `tipSize`, `drawTooltip`, `TIP_*` | `tooltips` (resolved once per frame in `render`, js/draw/render.js) |
| where that panel sits — beside the pointer, or parked bottom left | `tipPos`, `TIP_GAP`, `TIP_EDGE` (the row that picks: `settings.tipFollow`, `SET_TABS` js/ui/panels.js) | `tooltips` |
| the per-kind descriptions that panel is built from | `tipBase`, `tipTool`, `tipBit`, `tipStack`, `tipCell`, `tipGear`, `tipGold`, `tipTunnel`, `tipClassAb`, `tipRail`, `tipSend`, `tipStruct` (a build list row), `tipKind` (a wiki ARSENAL row), `tipSec`, `TIP_PATH` | `tooltips` (the shop's own: `tipShop`, js/ui/shop.js) |

## js/ui/compose.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the frame's UI pass in order - what goes over the world while you play, from the minimap to the day headline | `renderUI`, `dayPopCv` (the day headline's bake) | `renderUI` (last of the HUD files; the pieces it calls live in the seven files above it) |
| the F3 info stack: fps, the ms a frame spends in the sim and in drawing (`perf`, js/sim/core.js), coords, seed | `drawTags` | `the info stack` |

## js/ui/shop.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the fish/berry market: the walk, the shocks, the rails, the three-day history, and the market's own rng stream | `GOODS`, `MKT_STEP`/`MKT_DAYS`/`MKT_HIST`/`MKT_REVERT`/`MKT_NEWS`, `mktRng`, `market` (`market.step`: the moves since the match began), `marketNow` (the market clock in moves, the graphs' right edge), `goodOf`/`goodScale`/`goodName` (every fish rides the fish market, priced by its heal), `marketPrice`, `marketHist`, `marketWalk`, `initMarket` (called from boot.js), `updateMarket` (called once a step from `updatePlay`, sim.js) | `market` |
| the ledger: every good a body bought or sold, pinned to the move and the coin it changed hands at (the MARKET page's markers) | `marketLog` (from `shopTrade`, `shopSell`, `shopSellAll`), `MKT_TRADES`, `p.trades` (js/sim/player.js) | `market` |
| a price move worth telling everyone about | `marketNews` (the good's own `news` gold floor beside `MKT_NEWS`) | `market` (the log line: `logEvent`'s colour override, js/ui/panels.js; the plate: `raiseNotice`, below; the cue: `SFX.market`, audio.js) |
| the plates top-right under the minimap - the market's, the roost's and the stat sheet's: raising one, ageing it, where it sits, its pixels | `NOTE_MAX`/`NOTE_LIFE`/`NOTE_IN`/`NOTE_FLASH`/`NOTE_WASH`/`NOTE_OUT`/`NOTE_SLIDE`/`NOTE_FR`/`NOTE_W`/`NOTE_H`/`NOTE_AIR`/`NOTE_GAP`, `NOTE_KIND` (the palette the feed line shares) + `NOTE_MARKS` (a STAMPED mark, named by a kind's `glyph` - the roost's bird), `raiseNotice`, `ageNotices` (called from `updateFx`, sim.js), `noteRect`, `renderNotices` (called from `renderUI`, js/ui/compose.js) | `notices` |
| **a plate is its kind's size**, and the lane sums the heights it finds rather than counting a pitch: the per-kind width, height and body, which slot holds which kind, and where the lane stops rather than run under the hud strip | `noteW`/`noteH`/`notePitch`, `noteKindAt`, `noteLaneFloor`, `noteBody` (the default mark / headline / tail row a kind with no `body` of its own wears), `noteCard`/`noteBox`/`noteFrame` (all sized by the kind) | `notices` |
| **the stat ledger**: your whole sheet flown into that lane when a number on it moves, the moved rows lit and blinking, one plate up at a time | `STAT_PAD`/`STAT_TOP`/`STAT_PITCH`/`STAT_PULSE`/`STAT_W`, `STAT_LABEL`/`STAT_VAL`/`STAT_LIT`/`STAT_DOT`/`STAT_UP`/`STAT_DOWN`, `statPlateH` (the kind's `h` getter - `GEAR_STATS` loads after this file), `statSeen`/`statOwner`/`statLit`, `raiseStatNote`, `updateStatLedger` (called from `updateFx`, sim.js), `statDeltaTxt`, `noteStatBody` | `the stat ledger: your sheet, as a notice` (the table it reads: `GEAR_STATS`, js/ui/menu.js; the cue: `SFX.stat`, audio.js) |
| what makes a plate read as a stamped tag: the shadow, the notched corners, the bevel and the life draining along its base | `noteCard`, `noteBox` (the notched rect), `noteFrame` | `notices` |
| the plates' own art: the two 16x16 marks (a price's sack, a turnover's crate), the STAMPED one (the roost's bird, a `NOTE_MARKS` grid inked in your side's colour) and the two tails | `NOTE_KIND[k].mark`/`.glyph` picks it - `SPRITES.goldSack` (ten 16x16 grids, `sack`/`SACKPAL` in the `gold sack` section of js/sprites/items.js, resampled off `docs/media/new_media3/bag_of_gold_bouncing.png`) or `SPRITES.crate` (the 16x16 `crate`/`CRATE_PAL` in the `crate` section) - and `NOTE_TAILS` (up, down; a kind may have none) | `notices` (the tails stamped with `stampGrid`: `the art`, js/ui/screens.js) |
| the twelve offers (one item each: a bought one is `null` until the turnover) and their turnover | `SHOP_RESTOCK`, `SHOP_COLS`, `SHOP_SECTIONS`, `SHOP_CARD_ODDS`, `shopPick`, `shopRestock`, `shopOffer` | `the counter's stock` |
| what a thing is worth, both ways | `itemValue`, `cellValue` (a tool carries its loaded bits), `sellValue` (half, except the two goods) | `buying and selling` (the prices themselves: `price` on `TOOLS`/`BITS` tools.js, `CARD_PRICE` player.js) |
| standing at a counter (a merchant or its stall), and the merchant standing still to serve it | `SHOP_REACH`, `counterPt`, `counterDist`, `stallUp`, `merchNear`, `inReach`, `shopServing` (read by `updateMerchant`, robots.js) | `buying and selling` |
| the trades | `shopBuy` (contested on its well; `shopCanBuy` is the check it runs on the click and again in the claim), `shopSell`, `shopSellCell`, `shopTrade`, `shopCmd` (the `runCmd` entry, js/ui/wheel.js), `shopFx`, `shopDeny`/`shopNoRoom` | `buying and selling` (a sale pays through `tradeGold`, player.js - gold without XP) |
| the whole pack over the counter in one press, and the two numbers the button reads itself out with | `shopSellAll` (the bag only - the pouch and the shelf are out of its reach by construction), `packValue`, `packCount` | `buying and selling` |
| the panel: whether it is up, opening and shutting it (and the song it holds while it is), and its geometry | `shopOpen`, `openShop`, `closeShop` (`state.shop` holds the merchant itself), `SHOP_W`/`SHOP_H`/`SHOP_Y`/`SHOP_HEAD`/`SHOP_ICON`/`SHOP_WELL_*`/`SHOP_SEC_*`/`SHOP_CARD_*`/`SHOP_SELL_*`/`SHOP_ALL_*`/`SHOP_CORNER_GAP`/`SHOP_TIP_CLEAR`/`SHOP_LANE_H`/`SHOP_FOOT`, `shopLayout` (pinned clear of the corner: beside it, or under it on a tall narrow frame - `cornerClaim`/`cornerBottom`, js/ui/strip.js), `shopHit`, `hitR`, `shopClick`, `shopDropSell` | `the shop panel` (the hold itself: `SFX.music.hold`/`release`, the `music` banner, audio.js) |
| the wash the whole frame goes under while the counter is up | `shopScrim`, `SHOP_WASH` (the draw ORDER that decides what stays lit is `renderUI`, js/ui/compose.js) | `the shop panel` › `drawing` |
| every offer's icon at one size, whatever grid it was drawn on | `shopIconCv` (baked once each, largest whole-number scale that fits `SHOP_ICON`), `shopIconCache` | `the shop panel` › `drawing` |
| the counter's own clock along the bottom rail: the road, the countdown plate, and the merchant's wagon going out and coming back on it | `drawShopLane`, `LANE_LEAVE`/`LANE_STEP`/`LANE_PLATE_W`, `SHOP_CLOCK`/`SHOP_CLOCK_PAL` (the clock face), `shopBuggyCv` (four baked canvases: two trot frames, mirrored), `SHOP_BUGGY`/`SHOP_BUGGY_PAL`/`SHOP_BUGGY_W`/`SHOP_BUGGY_H` | `the restock road` (the clock it reads: `market.stockT`, `SHOP_RESTOCK`, the `the counter's stock` banner) |
| the sell strip's resting shimmer | `sellSheen`, `SELL_SHEEN`/`SELL_SHEEN_W` | `the shop panel` › `drawing` (called from `drawSellWell`) |
| the SELL ALL button at the strip's right end, and the pack it draws to say what it empties | `drawSellAll`, `drawPackGlyph`, `PACK_GLYPH_W`/`PACK_GLYPH_H` | `the shop panel` › `drawing` |
| its pixels | `drawShopPanel`, `drawShopSign`, `drawShopHeading`, `drawShopSection`, `drawShopWell`, `drawSellWell`, `drawSellAll`, `drawTradeArrow`, `drawTrend` (the MARKET ticker cards: `drawMktTicker`, js/ui/market.js) | `the shop panel` › `drawing` (the `E SHOP` cap over the body: `drawShopHint`, js/ui/wheel.js) |
| the TRADING POST's own chrome: the timber frame and its iron brackets, the team-striped awning with its snow, scallops and icicles, the counter edge, and the two lanterns flanking the sign | `shopChromeCv` (baked once a side, keyed by team), `drawShopLantern`, `SHOP_WOOD_*`/`SHOP_CLOTH_*`/`SHOP_SNOW*`/`SHOP_LAMP*`/`SHOP_IRON*`/`SHOP_SIGN` | `the shop panel` › `drawing` |
| what the pointer is on there, in the shared descriptor shape | `tipShop` | `the shop panel` › `tooltips` (`tipBase`/`tipTool`/`tipBit`/`tipStack`: `tooltips`, js/ui/tooltip.js) |

## js/ui/forge.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the SHOP / MARKET / FORGE tab plates in the counter's sign row, and which face is up | `forgeTabs` (into `shopLayout`'s `L.tabs`), `drawShopTabs`, `state.shopTab`, `forgeTabOpen`, `FORGE_SIGN` (the sign board's word, `drawShopSign`; the MARKET's: `MKT_SIGN`), `FORGE_ANVIL` (the MARKET's: `MKT_GLYPH`) | `the forge tab` |
| the bench: its geometry, what the pointer is on, a click, a drop | `forgeLayout` (into `L.forge`), `forgeHit`/`forgeKind` (from `shopHit`), `forgeClick` (from `shopClick`), `forgeDrop` (from `dragDrop`, js/ui/strip.js) | `the forge tab` |
| what is in the weapon well and the pile, and filling them from the pack or the shelf | `state.forgeSel` (a pointer to the weapon's cell) + `forgeFind`, `state.forgePile` + `forgePileNow`/`pileCount`, `forgeSelect`, `forgeAdd`, `forgePut` (also from `sendBagCell`/`sendSlot`, js/ui/strip.js), `forgeCarried`, `forgeReset` (from `closeShop`), `FORGE_ORES` | `the forge tab` |
| drawing it - the wells, the forge bar, the preview, the plate, the ore plates - and the `+N` a forged weapon wears in every well | `drawForge` (from `drawShopPanel`), `forgeWell`, `forgeGhost`, `forgeArrow`, `forgeUpArrow`, `FORGE_WELL`/`FORGE_KIND_H`/`FORGE_INK`, `forgeMark` (also `drawBag`, js/ui/bag.js; `drawShelf`, js/ui/hud-draw.js) | `the forge tab` |
| the bench's tooltips | `tipForge` (from `tipShop`, js/ui/shop.js) | `the forge tab` |

## js/ui/market.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the page: its geometry, which good it is on, what the pointer is on, a click, and the four trades along the bottom | `MKT_GOODS`, `MKT_TRADE`, `mktSel`, `mktLayout` (into `shopLayout`'s `L.market`), `mktHit`/`mktKind` (from `shopHit`), `mktClick` (from `shopClick`; the order: `shopTrade`, js/ui/shop.js), `mktUnits`/`mktCan` | `the market tab` |
| the chart: the coin line, the window in market moves, the two maps onto the plot, the average your buys cost, the marker under the pointer | `mktChart`, `mktAvg`, `mktMarkAt`, `mktAgo`, `MKT_AXIS` | `the market tab` |
| drawing it - the rows, the chart and its pinned trades, the hairline, the line under it, the trade plates - and the ticker cards on the SHOP face | `drawMarket` (from `drawShopPanel`), `drawMktRow`, `drawMktChart`, `drawMktMark`, `drawMktInfo`, `drawMktBtn`, `drawMktTicker`, `MKT_BUY`/`MKT_SELL`/`MKT_AVG` | `the market tab` |
| the page's tooltips | `tipMarket` (from `tipShop`, js/ui/shop.js) | `the market tab` |

## js/ui/panels.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the TAB standings, the event log (kept, not drawn) | `logEvent`, `events`, `scoreGroups`, `renderScoreboard` | `scoreboard & log` |
| the M map: the chart's class map, its flatten and its resample into the slot, the flat inks, the marks, the camps' glyphs and the hovered one's name tag, the header's day, a press off the slab closing it, and the chart point -> world tile inverse a map order needs | `buildMapPanel`, `buildWorldMapImg` (throttled to `MM_REBUILD` ticks), `chartGround`, `chartSpan`, `CHART_INK`/`CHART_NEED`/`CHART_DARK`, `MAP_HEAD_Y`, `mapAlloc` (the buffers and the bake at the slab's current size), `CHART_HOVER_R`, `chartTagRect`/`chartTag`/`drawChartCamps`, `mapCloseHit` (read by `pointerPress`, input.js), `renderWorldMap`, `mapTileAt` | `world map (M)` (the class a tile files under comes from `objChart(o)`: `world`, world.js; the marks: `drawMap*`, js/draw/marks.js) |
| the ESC menu: its tabbed pages, their rows (a choice or dropdown row's `val`/`pick`), the open dropdown, the scroll, the keys that page and scroll it, the layout every reader shares | `SET_TABS`, `settingsLayout`, `settingsScrollBy`, `settingsTabBy`, `settingsKey`, `setTab`/`setScroll`, `setDrop`, `buildSettingsPanel`, `settingsHit`, `settingsMouseDown`, `renderSettings` | `settings menu (ESC)` |
| the CONTROLS page's listings (keyboard / gamepad) in three columns, its pinned sub-navbar of four cells (WASD, CLICK and MOUSE are the keyboard's, and pick the scheme), which opens by default, the pad glyphs, the live pad readout under the GAMEPAD listing | `CTRL_COL_X`, `PAD_READ_Y`/`PAD_READ_H`, `drawPadReadout`, `CTRL_TABS`, `CTRL_TAB_H`, `ctrlTab`/`ctrlTabNow`/`ctrlCellNow`, `ctrlCvs`, `bakeCtrlKeys`/`bakeCtrlPad`, `drawPadGlyph` | `settings menu (ESC)` |
| the KEYBOARD listing's live caps - the rows, their layout, the draw, and the `'key:<action>'` / `'keyreset'` hits | `KEY_ROWS`, `KEY_ROW_H`/`KEY_ROWS_Y`/`KEYS_PRIMER_Y`, `keyRowsLayout`, `drawKeyRows` (the click: `settingsMouseDown`; the listen itself: `rebindStart`, input.js) | `settings menu (ESC)` |
| the slab itself (flat and solid), its big gold head, and the foot's flat buttons: CLOSE, and in a match or practice LEAVE beside it | `SLAB_INK`/`SLAB_EDGE`/`SLAB_BG`, `bakeFlatSlab`, `drawSlabHead`, `drawFlatButton`, `drawNavCell` (a navbar cell, the settings and CONTROLS navbars both), `SET_FOOT_Y`/`SET_PLANK_*`, `footPlanks`, `leavePlankRect`, `settingsClose` (the clicks: `closeMenuPanel`/`leavePractice`, js/ui/menu.js; `toLobby`, js/ui/screens.js) | `settings menu (ESC)` |
| the CONTROLS page's weapon primer: the worked build it draws and the marks it borrows from the HUD | `PRIMER`, `PR_CELL`/`PR_GAP`/`PR_X`/`PR_TX`, `drawToolPrimer` (baked once into `ctrlCvs.keys`) | `settings menu (ESC)` › beside `bakeCtrlKeys` |
| the VIDEO page's quality macro over the render-pass toggles | `VID_PRESETS`, `vidPreset` (the flags themselves: `settings.vid*`, core.js; their gates sit at each pass's call site) | `settings menu (ESC)` |
| the VIDEO page's FPS CAP choice row: 30 / 60 / 120 / 144 / UNLIMITED into `settings.fpsCap` | the `fpsCap` row of `SET_TABS` (the gate: `capSkips`, boot.js) | `settings menu (ESC)` |
| the three sound dials, the speaker that mutes them, the grey-when-muted fill, the minimap and HUD size knobs (the HUD's notched), the dropdown's box and list and a palette's chip | `applySliderDrag`, `muteBtnRect`, `drawMuteBtn`, `drawSliderRow`, `drawSliderById`, `toggleVal`, `DROP_TXT_X`/`DROP_ROW_H`, `drawDropBox`/`drawDropList`/`drawDropCaret`, `drawPalChip` | `settings menu (ESC)` |

## js/ui/menu.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the title screen: the words, panels, play intro | `MENU_TXT_SCALE`/`MENU_TXT_PITCH`/`MENU_BOTTOM`, `menuLayout`, `drawTitleBackdrop`, `beginIntro`, `renderTitle` (the frost plank other screens stand: `drawMenuButton`, `drawMenuSlab`) | `main menu` |
| the seed die on the lobby (under the map), and the reroll | `drawSeedDie`, `rerollWorld`, `lobbyLayout().seed` | `main menu` › `lobby` |
| lobby: the painted night, the two team panels glued to the screen's edges (your side left, rivals right, face-down until the count), the map plate and the target side by side at the top centre with their names in white under them (each the way into its pop-up), the hero row under them (js/ui/heroes.js), your hero on stage at 3x (2x in a short view), LOCK IN as a bare word at the foot and the five-second count that takes its place (a second press skips it); the three pop-ups' shared ease, slab, X and inert hits | `LOBBY_*`, `lobbyLayout`, `lobbyHit`, the 12px emblems `CLASS12`/`classIcon12`, `drawLobbyBackdrop`, `drawLobbyStage`, `drawLobbyCard`, `drawLobbyRosters`, `pxDisc`, `drawLobbyTarget`/`wreckTargetFace`, `drawDiffPlates`, `drawChevron`, `drawMapPlate`, `drawLobbyTop`, `drawLobbyCount`, `renderLobby`, `mapStep`, `pressPlay`, `cancelCount`, `lobbyRevealed`, `setAiLevel`, `lockIn`, `COUNT_T`, `LOCK_FX_T`, `popOpen`/`popHit`/`openPop`/`leavePop`, `drawPopSlab`/`drawPopX`/`popFrameHit`, `POP_PIC` | `main menu` › `lobby` (the levels' names: `AI_LEVELS`, ai.js; the hero the pick opens on: `PROFILE`, profile.js; the shape and the page: `mapChip`/`pickMap`, `the map`) |
| the AI pop-up over the lobby: the target big beside the three difficulty plates | `aiLayout`, `aiScreenHit`, `beginAiPick`, `aiKey`, `aiClick`, `renderAiPick` | `main menu` › `the AI pop-up` |
| the map pop-up over the lobby: the picture with its chevrons, the shape's name, the seed row and the die | `mapLayout`, `mapScreenHit`, `beginMapPick`, `mapKey`, `mapClick`, `renderMapPick` | `main menu` › `the map pop-up` |
| entering/leaving the practice arena | `beginPractice`, `leavePractice` | `main menu` |
| the patch tag bottom-right of the title and the list it prints | `PATCH_TXT`, `PATCH_NOTES`, `patchTagRect`/`overPatchTag` | `main menu` |
| the pre-match build: the hero pop-up off your figure on the lobby - live preview, stat ledger with hover deltas, the gear column and the ability column (a well a piece, a well a key, a click turning each, a hover previewing the swap in the ledger), the equip flash, the stat points spent on the ledger's own rows (the unspent pips, a row's gold pips that give a point back), the ability card on hover | `heroLayout`, `heroScreenHit`, `pickGear`, `pickAbility`, `spendPt`, `renderHero`, `drawGearWell`, `drawGearPreview`, `heroPreviewKit`, `GEAR32`/`gearIcon32`, `beginHero`/`leaveHero`, `heroPipX`, `HERO_*` | `main menu` › `the hero pop-up` (the numbers' base: `baseKit`; the tracks and the budget: `STAT_TRACKS`/`STAT_POINTS`/`ptsSpent`, player.js `stat points`) |
| **what a stat IS**: the one table the hero pop-up, the character panel and the HUD's stat ledger all price a body with - label, getter `(kit, player?)`, format, and which way is better | `GEAR_STATS`, `GS_INT`/`GS_SEC`/`GS_PCT`/`GS_NUM`/`GS_LV` (the level's hp and damage, which the kit itself never holds - `levelMaxHp`, player.js and `emitBit`, tools.js) | `main menu` › `the gear pop-up` (its three readers: `renderGear` here, `drawCharPanel` js/ui/bag.js, `noteStatBody` js/ui/shop.js) |

## js/ui/notes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the title's three tabs (WIKI, PATCH NOTES, ROADMAP) over the wiki and the notes screen: the row, which is open, what is under a point, the switch, the draw | `PAGE_TABS`, `PAGE_TAB_GAP`, `NOTES_TOP`, `pageTabOpen`, `pageTabsLayout`, `pageTabHit`, `openPageTab`, `drawPageTabs` (called once from `renderTitle`, js/ui/menu.js) | `the pages' tabs` |
| the roadmap: what is left to build, by section, each line to do or done | `ROADMAP`, `ROAD_GROUPS`, `drawRoadBox` | `roadmap` (drawn by `renderNotes` on `menu.notesTab` 1) |
| the patch notes screen: every patch folded by tenth newest first, the pictures notes carry, the hand-written digest, what is open, the layout, what is under a point, the keys, the draw | `PATCH_DIGEST`, `DIGEST_FROM`, `NOTES_PICS`, `NOTES_PIC_MAX`, `NOTES_GROUPS`, `notesGroups`, `notesOpen`, `notesScroll`, `NOTES_W_MAX`, `notesLayout`, `notesHit`, `beginNotes`/`leaveNotes`, `notesScrollBy`, `notesToggle`, `notesKey`, `notesClick`, `drawNotesChevron`, `renderNotes` | `patch notes` (the list itself: `PATCH_NOTES`, js/ui/menu.js; its ease: `menu.notesT`, core.js; the wheel: input.js; the cursor: `cursorInfo`, js/draw/render.js) |

## js/ui/wiki.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the wiki: its pages as data, the slab, tabs, window and rail, the per-page scroll, what is under a point, the way in and out | `WIKI_PAGES`, `WIKI_W_MAX`/`WIKI_H`, `wikiScroll`, `wikiBlocks`, `wikiPage`, `wikiLayout`, `wikiHit`, `beginWiki`/`leaveWiki` (Esc to the title, a tab to the notes), `wikiScrollBy`, `wikiSetTab`, `wikiKey`, `wikiClick`, `renderWiki`, `drawWikiRail` | `the wiki` (the tooltip a row raises: `tipKind`, js/ui/tooltip.js; the wheel: input.js; its song WHISPERING WOODS: `TRACKS.wiki`, audio.js) |
| the BEASTS page: the five cards, a kind at a level, the figure wearing its frame, the labelled legend | `WIKI_BEASTS`, `WIKI_LEVELS`, `wikiBeastHp`, `wikiBeastGold`, `drawWikiBeast`, `wikiLeader` | `the wiki` (the numbers: `ANIMAL_HP`/`ANIMAL_LV_HP`/`ANIMAL_LV_GOLD`, wildlife.js; `YIELD`, core.js) |
| the ARSENAL page: the three tables' columns, the kinds of a sort worn to gilded, a row on its tier plate | `WIKI_TOOL_COLS`/`WIKI_BIT_COLS`/`WIKI_MOD_COLS`, `wikiKinds`, `drawWikiRow` | `the wiki` (the kinds themselves: `TECH`, `TOOLS`, `BITS`, tools.js) |
| the WORLD page: the setting's ten entries (name, paragraph, the sprites on its mound), the figure column, the mound the beasts share, the `lore` draw in `renderWiki` | `WIKI_WORLD`, `WIKI_FIG_W`/`WIKI_TEXT_X`, `drawWikiFig`, `wikiMound` | `the wiki` (the premise, the fixed words and the voice: [lore.md](lore.md); the road's colours: `ROAD_COL_A`/`ROAD_COL_RUT`, js/draw/ground.js) |
| the CLASSES page: an ability row's columns, the four stat pips, the word-wrap the blurbs and the WORLD page use, the `cls` and `ab` draws in `renderWiki` | `WIKI_AB_COLS`, `WIKI_STATS`, `wikiWrap` | `the wiki` (the classes and kits: `CLASSES`, player.js; the abilities: `CLASS_AB`, `classAbIcon`, abilities.js; the card a hover raises: `tipClassAb`, js/ui/tooltip.js) |

## js/ui/profile-card.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the name tag bottom-left of the title screen | `profileTagRect`, `overProfileTag`, `drawProfileTag` (the player that wears the name: `applyProfile`, player.js) | `profile card` › `the name tag` |
| the profile card: its layout, the name field (select, type, Enter keeps, Esc or a click off closes), the ledger | `PC_W`/`PC_H`, `profileLayout`, `beginProfile`/`leaveProfile`, `profileCommit`, `profileHit`, `profileKey`, `profileClick`, `updateProfile`, `renderProfileCard`, `NAME_SHAKE_T` | `profile card` › `the card` (the store: `PROFILE`, profile.js) |
| the plate grammar, the ledger and its icon grids | `drawWell`, `drawLedger`, `PC_ICON_PAL` and the `PC_*` grids | `profile card` › `pixels` |

## js/ui/heroes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the lobby's hero row: a head per hero, the coming ones as silhouettes, the name under it, the pick and the keys' step | `HERO_CELL`/`HERO_CROP`/`HERO_ROW_H`, `heroList`, `heroCells`, `heroCellAt`, `lobbyPick`, `lobbyStep`, `drawHeroRow` | `hero row` (the heroes: `CLASSES`/`HEROES_SOON`, player.js; where it stands: `lobbyLayout`, menu.js `lobby`) |

## js/ui/skins.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the catalogue: the navbar's categories, the rarity colours, the scout table (placeholders but the IRON SCOUT, whose `body` names its sprites), the placeholder weapon / trail tables, a bought skin's profile key | `SKIN_TABS`, `SKIN_RARITY`, `SCOUT_SKINS`, `WEAPON_SKINS`, `TRAIL_SKINS`, `skinRow`, `skinKey`, `skinHas`, `skinWorn` | `skins` › `the catalogue` (the eagle's table: `BIRD_SKINS`, js/sprites/eagle.js; the purse: `PROFILE.coins`/`buy`/`wear`, profile.js) |
| which skin a bird wears on this screen (your company's bird wears yours, the other company's the free one) | `birdSkinFor` (asked by `drawEagle`, js/sim/eagle.js), `birdSkinRow`, `skinOwned` | `skins` › `the catalogue` |
| which body a player wears on this screen (only you wear your scout skin; everyone else the class body) | `scoutBody` (asked by `drawPlayer`, js/draw/bodies.js), `SK_TAB_SCOUT` | `skins` › `the catalogue` |
| what a finished match pays | `COINS_MATCH`, `COINS_WIN`, `payMatchCoins` (its caller: `endMatch`, player.js) | `skins` › `the catalogue` |
| a card's picture: the eagle's own icon (`SPRITES.birdSkinIcon`), a scout body's own `icon`, a placeholder washed in its tint, a trail's streak | `skinArt` (the eagle's: `SPRITES.birdSkinIcon`, perch.js), `washed`, `trailArt`, `SK_ART_MAX` | `skins` › `the pictures` |
| the coin tag top-right of the title | `coinTagRect`, `overCoinTag`, `drawCoinTag`, `SK_COIN` | `skins` › `the coin tag` |
| the skins screen: the navbar, the grid of cards, a press that wears, picks or buys, the short purse's shake, the buy's flash, the keys | `SK_*`, `skinsLayout`, `skinsTab`, `beginSkins`/`leaveSkins`, `skinsHit`, `skinPress`, `skinsKey`, `skinsClick`, `updateSkins`, `drawSkinTab`, `drawSkinCard`, `renderSkins` | `skins` › `the screen` |

## js/ui/story.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the three lines under an end screen's tally: the record the sim keeps (who downed whom, each bird's worst moment and who stood by it), how the lines are picked for the local player, and how they are printed | `storyOf`, `storyDown` (called from the down block in js/sim/player.js), `storyBirdHit` (called from `hurtEagle`, js/sim/eagle.js), `storyLines`, `drawStoryLines` (called after `drawEndTally` by `renderVictory`/`renderDefeat`); `state.story` rides `SNAP_STATE` | `match story` |

## js/ui/screens.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the rolling four-second replay: the capture ring, its resolution, the full-frame recap on a death and the corner window on pause, the recap's close box and its ESC, the `#replay` overlay | `replayTick`, `rpTarget`, `rpEnsure`, `replayShowing`, `rpFull`, `replayFull`, `replayClose`, `rpRect`, `rpCloseRect`, `rpCloseHit`, `layoutReplay`, `renderReplay`, `RP_*` | `replay` |
| the death overlay and the respawn wait, spectating, back to the lobby, who the camera frames, the planks every ending shares | `DEAD_ITEMS`, `deadItems`, `endScreen`, `viewPlayer`, `specOk`, `specNext`, `toLobby`, `openDefeat`, `drawRespawnLine`, `renderDead`, `deadKey`, `deadClick`, `deadLayout`, `deadReady`, `endSkip`, `drawEndPlanks` | `death & spectate` (`endMatch`/`endSnapshot`: `damage & death`, player.js) |
| the victory screen: its timeline, the side's stands, its sound cues, its art, and the passes both endings share | `WIN_T`, `WIN_BODY`/`WIN_TIER`/`WIN_BANNER_W`/`WIN_BANNER_H`, `winLayout`, `winStands`, `winCues`, `tallyCues`, `renderVictory`, `stampGrid`, `drawWinAurora`, `drawWinRays`, `drawWinMotes`, `drawWinConfetti`, `WIN_CREST`, `mixHex`, `winBannerCv`, `drawWinBanner`, `drawBrazierIron`, `drawWinBrazier`, `drawWinDais`, `drawEndStatPlate`, `drawEndTally` | `victory` |
| the defeat screen: the loss's own summary, the whole side down in the drift, on the same anchors and stands | `DEF_T`, `DEF_STATS`, `defCues`, `renderDefeat`, `drawBlizzard`, `drawDefeatDrift`, `drawDeadBrazier`, `drawDefeatRime`, `DEF_RIME_BAND`/`DEF_RIME_GROW`, `DEF_ARROW` | `defeat` |
| the four emotes both end screens hand back to the player, what performs them, and the bar that picks them | `EMOTES` (each with an `up` and a `down` pose picker), `EM_T`, `EM_TURN`, `emo`, `emoteNow`, `emoteAmbient`, `drawEndBody`, `drawSnowPuff` | `emotes` |
| the bar's plates: where they sit, what the pointer is on, what plays one, and its pixels | `EM_PLATE`/`EM_GAP`/`EM_BAR_DY`, `emoteLayout`, `emoteScreen`/`emoteLive`, `emoteHit`, `emotePlay`, `emoteKey`/`emoteClick`, `drawEmoteBar`, `EM_GLYPHS`/`EM_GLYPH_HOT` | `emotes` (the cursor's hand: `cursorInfo`, js/draw/render.js) |
| which key or pad button plays which plate | `EM_KEYS` (the digits, read by `deadKey`), `EM_PAD`/`EM_PAD_CAP`/`emotePad` (the dpad, read by `padPress`/`padRelease`, js/app/gamepad.js) | `emotes` |

## js/ui/lobby.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the gold and damage samples (drawn by nothing on the lobby since the bar chart; the bot lab reads the last gold): the pitch, the cap, the halving that bounds a series of any length, and the sampler itself | `STAT_STEP`, `STAT_MAX`, `statT`, `statHalve`, `sampleStats` (its one caller: `updatePlay`, sim.js; the arrays it fills: `p.hGold`/`p.hDmg`, the `Player` constructor, js/sim/player.js) | `the samples` |
| the match's record, frozen at the whistle | `matchStats`, `statFreeze` (its one caller: `endMatch`, js/sim/player.js) | `the record` |
| the folding stat groups and their rows, the column geometry, the K/M/B cut, this screen's own state, and the accent each ending is struck in | `SCORE_GROUPS`, `SCORE_LABEL_W`/`SCORE_COL_W`/`SCORE_TEAM_GAP`/`SCORE_FACE`/`SCORE_NAME`/`SCORE_LIST_W`/`SCORE_LIST_ROW`/`SCORE_ROW`/`SCORE_HEAD`, `SCORE_STATS`, `scoreFmt`, `scoreName`, `scoreVal`, `scores`, `SCORE_WORDS`, `SCORE_IN`, `scoreAccent`, `scoreHead` | `the groups` |
| the composition: the columns in reading order, the narrowing on a small view, the scrolled window and its lines | `scoreCols`, `scoresLayout`, `scoreLines`, `scoresScrollBy` (the wheel: input.js) | `the layout` |
| the way in off either ceremony, the way back, and the controls: the page words, the GRAPHS page's stat list, a group's fold, BACK / LOBBY | `openScores`, `scoresBack`, `scoresHit`, `scoresActivate`, `scoresKey`, `scoresClick` (the four one-line hand-offs: `deadActivate`/`renderDead`/`deadKey`/`deadClick`, js/ui/screens.js; the door: `toLobby`, same file) | `the way in` |
| the pixels: the head, the page words, the faces, the groups with your column lit and each row's best underlined, the bare BACK / LOBBY words, and the GRAPHS page's stat list and bar chart | `SC_*`, `scoreWord`, `drawScoreFace`, `renderScores`, `drawScoreStats`, `scoreStep`, `drawScoreBars` | `the pixels` |

## js/sim/save.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a save carries: the roots, `state`'s UI keys it leaves behind, the three streams' positions | `SAVE_ROOTS`, `saveArr`, `SAVE_STATE_SKIP` (the streams' `.s`: `mulberry32`, core.js) | `saved matches` |
| the grown valley every save is written against, and the tile objects that are always written | `saveBaseline`, `saveSum`, `saveBase` (its `live` set) | `saved matches` |
| the object graph: the `$` tags, the static rows written as names, the classes rebuilt | `saveEncode`, `saveDecode`, `saveStatics`, `SAVE_CLASSES` | `saved matches` |
| the match as a record and back, and the proof's hash | `saveCapture`, `saveApply`, `saveHash` (`DBG.saveHash`) | `saved matches` |
| who may save, a slot's card and its name, the newest, packing | `canSave`, `saveMeta`, `saveTitleOf`, `saveList`, `saveNewest`, `saveZip`/`saveUnzip`, `saveMatch` (the storage: `PROFILE.saveMetas`/`saveBody`/`putSave`/`putSaveMeta`/`swapSaves`/`dropSave`, js/app/profile.js) | `saved matches` |
| the autosave ring: the timer, the pause's save, the gap | `SAVE_AUTO_T`, `SAVE_AUTO_GAP`, `autoSave`, `saveAutoTick` (from `loop`, boot.js; the pause's: the Escape and pause keys, `keyPress`, input.js) | `saved matches` |
| a load: the fade and the hand-off (and the save's character made active), boot's two halves | `loadSave`, `saveBootLoad` (before `prepGround`), `saveBootEnter`, `saveBootView` | `saved matches` |

## js/ui/saves.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the grid's state, the way in (the ESC panel's SAVES button; the lobby's SAVES plate) and out | `saveUi`, `savesUp`, `savesInLobby`, `openSaves`/`closeSaves`, `beginSavesPick`, `savesBack` (the hand-offs: `renderSettings`/`settingsHit`/`settingsMouseDown`/`settingsKey`/`footPlanks`, panels.js; `popOpen`/`popHit`/`menuKey`/`menuClick`/`renderTitle`, `lobbyHit`/`lobbyClick`/`drawLobbyTop`, menu.js) | `saves screen` |
| where the cards sit, each card's verb (save into an empty manual card, load a kept one), the press and the arm before a load, the keys | `savesFrame`, `savesCards`, `svVerb`, `savesLive`, `savesLayout`, `savesHit`, `savesAct`, `SV_ARM_T`, `savesClick`, `savesRelease` (from `pointerRelease`, input.js), `savesKey` | `saves screen` |
| a card's handles: delete, the name typed in place, carrying it to another slot | `svDelRect`/`savesDelete`, `svNameRect`/`savesEditStart`/`savesEditEnd`/`savesEditKey` (routed first in `keyPress`, input.js), `SV_NAME_MAX`, `savesDragTick`/`savesCarrying`/`savesCanMove`/`savesMove`, `SV_DRAG_PX` (storage: `PROFILE.putSaveMeta`/`swapSaves`, profile.js; the name: `saveTitleOf`, save.js) | `saves screen` |
| the pixels: a slot's thumbnail, a card, the autosave glyph, the verb's arrow, the X and the pencil, the grid, the lobby's plate; the HUD's saved mark | `saveThumb`, `drawSaveCard`, `drawThumbBadge`, `drawAutoGlyph`, `drawVerbArrow`, `drawSaveX`, `drawSavePencil`, `renderSaves`, `drawSavesPlate`, `drawSaveFlash` (called after `renderUI`, render.js) | `saves screen` |

## js/ui/botview.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a bot is thinking, read one way for every caller: the brain's `p.ai.thought` when it wrote one, else a guess off the ladder's state (marked `guess`, drawn with a `?`), the goal colours by kind, a firing bot's target, where a target is (only a finite point), how long ago it changed its mind | `botThought`, `botGuess`, `botAimed`, `botPoint`, `BOT_GOALS`/`botGoalCol`, `botIsBot`, `botLevel`, `botChangedAgo` | `bot thoughts` |
| the recorder: on its own clock every `BOTLOG_STEP`, every goal change, a sample a second, the seconds each bot spent on each goal, every kill, the birds' nerve, a new match on a new drop, a finished match's summary, each side's paint, the export the page saves | `BOTLOG`, `botLogStep` (from `updatePlay`, sim.js), `botLogKills`, `botLogReset`, `botRow`, `botCls`, `botSides`, `botPeople`, `botMatchSummary`, `botLogExport` | `bot recorder` |
| F4's two layers (a game of your own only, `botViewOk`): the line to each bot's target (world pass, after `drawHitboxes`), the goal under each bot (flashing on a change, `BOT_FLASH`), the hovered bot's card (beside the bot, or beside its row), the table with its per-level footer and the levels' inks | `botView`/`botViewStep` (F4 in `keyPress`, input.js), `drawBotLines`, `drawBotTags` (under the HUD), `drawBotView` (over it; all three called from `render`, render.js), `drawBotCard`, `drawBotPanel`, `botLevelRows`, `botBar`, `BOT_LEVEL_COL`/`botLevelCol` | `bot view` |
| F6: the out-of-game page opened as this window's child, its hello and save requests, the frames it is sent (only what is new since the last) | `openBotLab`, `botLabPump`, `BOTLAB_T` (the page: [botlab.html](../../botlab.html)) | `bot lab link` |

## js/sim/eagle.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the twin eagle rides down the corner-to-corner diagonal, the wing seats and the merchant's neck seat, the jump window and its lock, a bot's treeline-safe forced drop, riding the landing and the E hop off the roost, free fall, landing, the flight bar, the dotted path, the wind trail, the zoomed-out view | `diagEnd` (and the corner's `mouth` it returns; `e.mouth` itself is the spur's junction, `roadNest`, world.js), `makeEagleRoute`, `forestDepth`, `lastOpenU`, `EAGLE_LANE`, `eaglePathAt`, `EAGLE_BEAT_HZ` (the wingbeat), `makeEagles`, `eagleScale`, `riderScale`, `riderDir`, `drawSeated`, `seatPos`, `beginDrop`, `dropJump`, `landPlayer`, `handOver`, `landAboard`, `hopOff`, `HOP_FALL_T`/`HOP_ALT`/`HOP_GAP`, `drawHopPrompt`, `drawCapBind` (a key cap and its word, centred: JUMP and HOP OFF), `drawYouArrow`/`flightBob` (the gold arrow over your own name on the wing; the bird's bob in flight), `updateDrop`, `updateEagle`, `drawDropAir` (its `air` half on the air layer, `dropFlies` naming who flies), `flightShown`/`flightShownT` (the flight bar's render-side clock), `FLIGHT_BAR_CUT`/`FLIGHT_TRACK`/`FLIGHT_SHUT`/`FLIGHT_OPEN`/`FLIGHT_KEY_SHUT` (the bar's paint, which the path's window and the landing ring share), `dropPress`/`flightDenyAt`/`FLIGHT_DENY_T` (a jump press from any device, and the bar's red shake when the door refuses it), `seatedName` (a rider's name over the wing: only yours in flight), `TRAIL_T`/`TRAIL_STEP`/`TRAIL_RIM`/`TRAIL_TIP`/`TRAIL_TIP_AMP`/`TRAIL_BACK`/`TRAIL_BACK_AMP`, `drawEagleTrail`, `warmPerch`/`perchLiftBeat` (Perch's frames painted ahead, the takeoff's beat clock), `strokeAt`, `drawPerchBar`/`perchLag` (the roost's win/lose bar), `drawEagle` (the skin `birdSkinFor` names, through `SPRITES.perch`: flying, stooping, roosting and taking off), `renderDropUI` | `eagle drop` |
| the drop brief: the roost tour a landing ridden to the crash opens on - the phase machine (a beat, the rival roost, then your own to finish), the camera's aim, the two headlines, the DAY 1 it hands back to | `state.dropBrief` (core.js), `BRIEF_WAIT`/`BRIEF_HOLD`/`BRIEF_HOLD_OURS`/`BRIEF_GO_MIN`/`BRIEF_MAX_T`/`BRIEF_TEXT`/`BRIEF_RIM`/`BRIEF_Y`, `endBrief`, `dropBriefTarget`, `drawDropBrief` (the glide: the camera banner, sim.js; the control zeroing: `sampleHumanInput`, input.js) | `eagle drop` |
| the banking dive off the road onto the nest, the tree-shattering impact, the SPUR it fells straight back to the road pine by pine and paves behind the front, and the roosting objective: its wing-gust defense, its preen regen, and the driven-off ceremony that ends the match | `beginDive` (the bank: `e.diveH0`/`e.diveTurn`), `CRASH_DEPTH`/`MIN_CRASH_TREES`, `findCrashPoint`, `eagleCrash` (sets `e.laneDir`, the spur's direction toward `e.mouth`, and registers `e.spur`), `LANE_R`/`LANE_SPD`/`LANE_WARN`/`LANE_DELAY`/`LANE_MAX`, `laneFells`, `planLane` (the `pave` list), `laneStep` (the paving), `eagleBoomFx`, `eagleGust`, `eagleGustFx`, `hurtEagle`, `eagleFlee`, `eagleFleeResolve`, `teamEagleDown` (the driver it drops off: `spawnMerchant`, robots.js) | `eagle drop` |

## js/app/boot.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| boot order, `DBG` | `startGame`, `window.DBG` | `boot` |
| the match between screens: the sim's recorded cosmetics, roles, host and client, the snapshot, its delta and bytes, the two transports | not here: the five [js/net/](#jsneteventsjs) sections above, in load order | - |
| a hidden tab's frames: a worker's clock drives loop() while the page is hidden (stepping, never drawing), rAF when it is not | `hiddenTimer`, `hiddenTick`, `watchHidden` | `the fixed step` |
| the fixed step: the rAF loop banks each frame's time and steps the sim in whole 1/60 s slices (up to three a frame, the rest dropped; a quarter-slice of slack so a 60 Hz screen steps once a frame), polls the pad once a frame before them, renders once after | `TICK_DT`, `TICK_MAX`, `TICK_SLACK`, `tickAcc`, `loop` (`padPoll`, js/app/gamepad.js); the frames drawn in between steps (the camera by its centre and zoom, players, wildlife, robots, birds, shots and loot; render-only): `tween`, `tweenMark`, `tweenIn`, `tweenOut`, `TWEEN_SNAP` | `the fixed step` |
| the FPS cap: a frame under `settings.fpsCap` is skipped whole before the bank is touched, so the sim still steps every slice it is owed; a due clock advanced a period per frame taken holds the average exactly, and resyncs after a stall | `capDue`, `capSkips` | `the fixed step` |
