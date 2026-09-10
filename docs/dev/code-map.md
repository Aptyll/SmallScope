# Where things live in the game code

The game code is ~15000 lines of flat top-level code across twenty-five files sharing one global
scope ([architecture.md](architecture.md) has the file table and the load order), organized
inside each file only by banner comments of the form `// ------ name`. **Keep every banner
honest** — one that has drifted from what sits under it is worse than no banner, because it sends
future sessions to the wrong 600 lines. If a section grows past ~250 lines or picks up a second
responsibility, split it and add the new banner to its file's table below.

Grep the banner (`// ------ actions`) to jump; the function names are the durable anchors —
don't cite line numbers here, they go stale within a session. Sections follow index.html's load
order; the legacy `audio.js` row rides along because its dials get asked after constantly.

## js/audio.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the songs, the sampled one-shots, the dials behind them | `SFX.music`, `TRACKS`, `SAMPLES`, `smp`, `trim`, `setAmbience` | its own IIFE — see [gameplay.md](gameplay.md#audio) |
| BORROWING the music layer and giving it back where it was taken (the trading post's song) | `musicHold`, `musicRelease`, `held`, exposed as `SFX.music.hold`/`release`/`held` | `music` (its one caller: `openShop`/`closeShop`, shop.js) |
| the market's two notification cues, and the one cue built out of two clips | `SFX.market(up)` (till / thud), `SFX.restock()` (the wagon, then the bell `RESTOCK_RING` behind it), the `spike`/`crash`/`freight`/`restock` rows of `SAMPLES` | its own IIFE (their callers: `marketNews`/`shopRestock`, shop.js) |

## js/core.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the numbers with no one owner: the tile grid, the view, the authored frame the screens centre in, the day cycle | `TILE`, `WORLD`, `VIEW_W`/`VIEW_H`/`FULL_W`, `FRAME_H`/`frameTop`, `DAY_LEN`/`NIGHT_LEN`/`CYCLE` | `constants` |
| the economy: every gold payout in one table | `YIELD` | `constants` (`gainGold`, the one way it is paid: `players`, player.js) |
| tuning for one feature (the bow, the roll, prone, a wolf, a turret, a flag, a fish) | **not here** - each block sits above the code that reads it; find it in this file's per-file section | - |
| the one exception to that: `state` reads it at load, so it cannot live in a later file | `FISH_SPAWN_T` | `constants` (the rest of the shoal: `fish`, wildlife.js) |
| determinism: the seeded stream every world draw comes from | `mulberry32`, `SEED`, `rng` | `rng` (`hash2`/`vnoise`: `ground prerender`, draw-world.js; `treeRare`: `world`, world.js) |
| the singletons | `state`, `settings`, `perf` | `state` (`players`/`player` + the entity arrays: `players`, player.js) |
| settings persistence and the minimap-size helpers | `saveSettings`, `loadSettings`, `mmScale`, `applyMinimapSize` | `state` |
| `relayout()` — the resize pair's second half | `relayout` | `state` (`fitCanvas`: `canvas`, canvas.js — still the resize pair) |
| floaters, particles, drops, cost math, and the HUD's four-character count (`999` › `1.2K` › `340K` › `1.2M`) | `addFloater`, `burst`, `spawnDrop` (returns the drop), `canAfford`, `NUM_SUFFIX`/`shortNum` | `helpers` |
| a thing put down ON PURPOSE: the heading a throw carries, and the three seconds it refuses the hand that threw it | `TOSS_SPEED`, `TOSS_LOCK_T`, `flingDrop`, `lockDrop`, `dropLocked` (set by `throwCell`/`shedBits`, read by the drop loop in `updatePlay` sim.js and the drop draw pass, render.js) | `helpers` |
| a thing ON ITS WAY OUT: the drop's `fade`, and the one question every loot path asks before it wants a drop at all | `VANISH_T`, `VANISH_LIFT`, `VANISH_COL`, `vanishDrop`, `dropGone` (set by `evaporateTool`, tools.js; read by the drop loop in `updatePlay` sim.js, the bot loot scan in `updateAI` ai.js, and both drop passes — the draw and `drawHitboxes` — render.js) | `helpers` |
| food: the 1.5 s meal, the 3 s clock berries and fish share, and every way one is broken | `FOOD_CD`/`FOOD_EAT`/`FOOD_SLOW`/`FOOD_FX_T`, `startEat`, `eatBerry`/`eatFish`, `updateEat`, `breakEat` | `helpers` › `food` (the heal numbers: `ITEMS[type].heal`, `players`, player.js; the wells that draw the clock: `drawFoodClock`, ui.js) |
| the gold flare and crack an ambush arrow lands with | `ambushFx`, the `crit` flag on `addDmgFloater` | `helpers` |

## js/canvas.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| resolution, pillarbox frame | `fitCanvas`, `renderBars` | `canvas` (`relayout`: `state`, core.js) |
| world zoom: the pixel-exact rung, the eased scale, the world view, the two coordinate bridges | `ZOOM_*`, `kWant`/`kMin`/`kMax`/`zoomWantOf`, `zoomCur`, `WV_W`/`WV_H`, `sizeWorldView`, `wToSX`/`wToSY`, `mouseWX`/`mouseWY` | `canvas` |
| panel + minimap layout anchors (`PANEL_*`, `SET_*`, `ROW_*`, `MM_*`), and the map slab's fit to the view (`MAP_W`/`MAP_S`/`PANEL_W`/`PANEL_H` from `CHART_MAX`/`MAP_SIDE`/`MAP_HEAD`/`MAP_FOOT`) | assigned by `relayout()` (core.js) on every resize; `fitMapSlab` | `canvas` |

## js/player.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| players, teams, classes + kits, hero levels, the input struct, contested orders | `Player`, `CLASSES`, `kitOf`, `gainGold`, `levelUp`, `makeInput`, `initPlayers`, `contest` | `players` |
| the one on-the-spot gold payout every source uses (gold is never a drop) | `awardGold` | `players` (beside `gainGold`) |
| the numbers a player is made of: the player count and teams, walk/roll/slide speeds, hero levels, and the two bow baselines a kit is written against | `MAX_PLAYERS`, `TEAM_COUNT`, `PVP`, `PLAYER_SPEED`/`PLAYER_R`, `ICE_MAX`/`SLIDE_MIN`/`SLIDE_EXIT`/`TRAIL_MIN`/`SNOW_TRAIL_*`, `LEVEL_*`/`LVL_*`, `DODGE_*`, `BOW_CHARGE`/`BOW_NOCK` | `players` (above `CHAMPS`, which reads four of them at load time) |
| the entity arrays and the local aliases | `animals`…`camps`, `players`, `player`, `inv` | `players` (the banner's tail) |
| the item table and the two carry stores: the bag's cells, and the uncapped POUCH (`p.food`) every `pouch` kind lives in - count, room, add, take, and putting an instanced cell (a loaded tool) in whole | `ITEMS`, `BAG_CAP`, `isPouch`, `bagCount`, `bagUsed`, `bagRoom`, `bagAdd`, `bagTake`, `bagPut` | `players` › `inventory` (the tool and bit rows register themselves from tools.js) |
| the gear table, the effective kit, buying a piece level | `GEAR`, `GEAR_SLOTS`, `GEAR_COSTS`, `baseKit`, `refreshKit`, `gearCost`, `buyGear` | `players` › `gear` |
| skill points (one per hero level, spent on class-ability levels) | `p.skillPts` (spent by `buyAbilityLv`, abilities.js) | `players` (granted in `levelUp`) |
| roguelike card effects and rarities | `CARDS`, `CARD_RARITIES`, `cardKey`, `CARD_TYPE_RARITY` | `players` › `roguelike cards` |
| how hidden a player is, and how far anything notices it from | `concealOf`, `seenAt`, `ambushReady` | `players` › `being seen` |
| death, the wait for the bird and the return at it, the one permanent path (a driven-off eagle), the team-level win check | `die`, `RESPAWN_BASE`/`RESPAWN_LV`, `respawnTime`, `updateRespawns`, `RESPAWN_OUT`, `respawnPlayer`, `teamInMatch`, `rivalTeamsInMatch`, `checkLastStanding`, `endMatch`, `endSnapshot` | `damage & death` (`teamEagleDown`: `eagle drop`, boot.js) |
| practice undoing a death on the spot | `practiceRevive` (die()'s first branch under `PRACTICE`) | `damage & death` |

## js/mobile.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| is this a phone: the device's answer, the setting over it, the live flag | `mobileAuto`, `mobileRefresh`, `MOBILE`, `settings.mobile` (core.js) | `mobile` |
| the footprint a phone's fit keeps, and the camera it opens at | `MOBILE_MIN_W`/`MOBILE_MIN_H`, `MOBILE_ZOOM`, `MOBILE_SHORT` (read by `fitCanvas`, canvas.js) | `mobile` |
| held upright, and the first finger's fullscreen ask | `mobilePortrait`, `mobileGesture` | `mobile` (the prompt's pixels: `drawRotatePrompt`, `touch controls`, ui.js) |

## js/input.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the physical key -> game key name translation (e.code, AZERTY-proof), and what a key prints on screen (the layout map) | `CODE_KEY`, `keyName`, `KEY_LABEL`, `keyLabel`, `kbLayout` | `keys and binds` |
| the rebindable actions, their defaults, the live binds and how anything asks for a key | `KEY_ACTIONS`/`KEY_ACT`, `settings.binds`, `mendBinds`, `actKey`, `keyIs`/`keyHeld`/`keyBound`, `moveDir`, `keyCap`/`keyCapShort`, `keyReserved` | `keys and binds` |
| a cap listening for its key, the swap on a conflict, the reset | `state.rebind`, `rebindStart`, `rebindKey`, `setBind`, `resetBinds`, `bindsDefault`, `rebindLive` | `keys and binds` |
| the raw state, and who moved the pointer last | `keys`, `mouse` (`mouse.src`: mouse / pad / touch) | `input` |
| what a key does, what a button does - the four entry points every controller presses through | `keyPress`/`keyRelease`, `pointerMove`, `pointerPress`/`pointerRelease` | `input` |
| the bare gestures a trigger or a plate sends: the draw, the flag wheel, a build wheel with no tile under a pointer, a page scroll | `fireDown`/`fireUp`, `openFlagWheel`, `openWheelNear`, `panelScrollBy` | `input` |
| telling the HAND something happened - a pad's rumble, a phone's buzz, one call over all three controllers | `HAPTIC`, `haptic` (its caller: `hudFx`, ui.js; its off switch: the RUMBLE row, `SET_TABS` panels.js) | `haptics` |
| the zoom wheel, the listeners | the `addEventListener` block | `input` |
| folding keys, mouse and both sticks into player 0's struct | `sampleHumanInput` | `input` |

## js/gamepad.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| which button is which key, in play and over a menu | `PAD_PLAY`, `PAD_MENU` | `gamepad` |
| the poll, which pad out of the browser's list (a live one over an idle ghost), the sticks, the aim off the body (and a wedge off a wheel's hub), the pointer over a panel, the walk under the panels that keep the world running, the stick-as-arrows repeat, A as the click or the selection | `padPoll`, `padFind`/`padLive`, `padAim`, `padRepeat`, `padTake`, `padMenuMode`/`padPanelMode`/`padPointerMode` | `gamepad` |
| a pad in hand (the CONTROLS page opens on its tab); an unmapped pad's layout read off its rest values; the live sticks and triggers the readout draws | `padActive`, `pad`, `padCalibrate` (`pad.rest`), `pad.raw` | `gamepad` |

## js/touch.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what each plate does, and where the plates sit | `TOUCH_BTNS`, `touchLayout`, `touchBtnAt` | `touch` (their pixels: `drawTouchControls`, ui.js) |
| a finger landing: plate, minimap, HUD, or one of the two sticks | `touchDown`, `touchPtr`, `touchOverlay`, `touchMenuGlyph` | `touch` |
| the sticks read once per frame, and the aim riding the body | `touchPoll`, `touch` | `touch` |

## js/world.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| worldgen, rivers, forest border and the two roost corners' guaranteed woods | `genWorld`, `carveRiver`, `borderNoise` (the seed's own border), `borderDepth` (that or the roost disc - what everything reads), `BORDER_MIN`/`BORDER_MAX`, `ROOST_R`/`ROOST_WOBBLE` | `world` |
| what a kind of scenery **is** - solid, which tool, the E verb and lift, what each map paints it (the minimap's colour, the chart's class) | `OBJECTS` | `world` (buildings carry the same `mm`/`map` pair: `STRUCTS`, structures.js) |
| what a tile's occupant paints on either map, over both tables: the minimap's colour, the chart's class, and the two team inks each map paints a side's buildings and its bird in | `objMapColor`, `objChart`, `CH_*`, `chTeam`/`chEagle`, `MM_TEAM_*`/`mmTeam`, `MM_EAGLE_*`, `MM_UNKNOWN` | `world` (its two readers: `updateMinimap` ui.js, `buildWorldMapImg` panels.js) |
| a picked bush's regrow clock, the frame the bush wears at each stage of it, and the bar a hover shows over it | `BUSH_REGROW`/`BUSH_BUD_T`/`BUSH_RIPEN_T` | `world` (the pick: `hitObject`'s bush branch, actions.js; the tick: the object-timers loop, sim.js; the frame and the hover bar: the bush branch of `render()` off `hovO`, render.js; the grids: `bush`/`bushEmpty`/`bushBud`/`bushRipen`, sprites.js) |
| does this tile block a walker | `isSolidTile` | `world` (it reads `STRUCTS` then `OBJECTS`, and names no type) |
| is this tile a bare hole (the one site left), and which wheel table a pad's build wheel gets on it; the net on a tile | `buildSiteAt`, `buildOptionsAt`, `netAt` | `world` (the two `*_ORDER` tables: `structures`, structures.js) |
| a footprint, turned or not: its width and height off the OBJECT (or a bare type, unturned), its tiles, its centre, its mouth, and the anchor a big piece ordered by one tile fits round | `structW`, `structH`, `structOf`, `footprint`, `structCenter`, `structMouth`, `findSite` | `world` |
| what a pine takes to fell, everywhere one is planted (the border, the practice forest, the regrowth) | `TREE_HP` (above `treeRare`) | `world` (what the fell pays: `YIELD`, core.js) |
| treasure chests: where they take their trees, and what one pays | `placeChests`, `CHEST_COUNT`/`CHEST_SPACING`/`CHEST_GOLD_*`/`CHEST_ODDS` | `world` (opening: `hitObject`'s chest branch, actions.js; sprite: `CHEST_SPR`, draw-world.js) |
| the road: its two widths and ragged edge, the gates where it enters the woods, its geometry on the diagonal, where each side's nest and junction sit, the spur registry a crash paves into, laying it (pennants, the centre marker, the felled trunk across each forest end), how far the ice keeps off it, the march's waypoints | `ROAD_HW`/`ROAD_HW_WOOD`/`ROAD_GATE_BLEND`/`ROAD_RAG`/`ROAD_RUT`/`ROAD_SHOULDER`/`ROAD_ICE_KEEP`/`ROAD_ICE_TAPER`/`ROAD_STEP`/`ROAD_POLE_OUT`/`ROAD_NEST_IN`/`ROAD_NEST_MAX`/`ROAD_NEST_OFF`/`ROAD_LOG_IN`/`ROAD_LOG_HALF`/`SPUR_HW`, `roadSpan`, `roadAlong`/`roadOffS`/`roadOff`/`roadPoint`, `roadHW`, `roadEdgeAt`, `roadMainDist`, `spurs`/`addSpur`/`addPad`/`spurDist`, `roadDist`, `onRoad`, `roadNestDeep`/`roadNest`, `placeRoad` (called at boot, boot.js), `roadWaypoints` | `world` › `the road` (pixels: `paintRoadOverlay` + `ROAD_COL_*`, `paintLog`/`LOG_COL` under `paintGroundTile`, `CAIRN_SPR`, `bannerCloth`, draw-world.js; the maps: `updateMinimap`, ui.js, `buildWorldMapImg`, panels.js; the paving: `laneStep`, boot.js) |
| a camp: its kind's data, the fixed mirrored sites, the clearing, standing one up, stocking it, where a position is, the respawn clock its anchor wears | `CAMPS`, `CAMP_SITES`/`CAMP_EDGE`, `campTile`, `campSites`, `clearCamp`, `placeCamps`, `spawnCampMonster`, `stockCamps`, `campPop`, `campAt`, `CAMP_HOLD`, `updateCamps` (`C.repopT`; the anchor's `site`) | `camps` (the hover bar: `drawCampClock`, draw-world.js, from the den and cairn branches of `render()` off `hovO`, render.js) |
| the practice arena: its gen, the dummy's numbers, the grounds' clock | `PRACTICE` (core.js, above `WORLD` — practice worlds are 76 tiles), `genPracticeWorld`, `PR_W`/`PR_H`/`PR_SPAWN`, `DUMMY_HP`/`DUMMY_WORK_DMG`/`DUMMY_RESET_T`, `practiceDummies`, `updatePractice` | `practice arena` (the hits: `hitDummy`, actions.js; sprite: `DUMMY_SPR`, draw-world.js) |
| the archery targets: the perimeter track, the two lanes and the hop, the three habits, the shared face geometry, a hit, its scoring/respawn and the consecutive-hit run | `ptargets`, `addPTarget`, `agPos`, `agEdge`, `AG_RECT`/`AG_INSET`/`AG_LEN`/`AG_LANE_GAP`/`AG_SPD`/`AG_SIZE`, `agBlocked`, `ptFace`, `ptLive`, `ptHitR`, `hitPTarget` (the impact: score and shatter land the same frame), `agShatter` (the break), `agStreak` (broken by the arrow loop, sim.js), `PT_HIT_R`/`PT_RESPAWN`/`PT_POP` | `practice arena` (the arrow test: the PRACTICE branch, `update`, sim.js; pixels: `drawAgTrack`/`drawPTarget`, draw-world.js) |
| the archery round: the bell and its held difficulty wheel, the per-difficulty spawn tables, the furniture sink (bell included), the countdown, the spawner, the record | `agame` (incl. `diff`), `AG_T`/`AG_BELL`/`AG_DIFF`, `agBellNear`, `agRing`, `agEndRound`, `agSpawn`, `agStock`, `agSinkU`, `agUpdate` (the wheel: kind `'agbell'` in keydown/keyup input.js, `wheelOptions`/`renderWheel`/`runCmd` ui.js; the `E RING` cap: `drawBellHint`, ui.js; the record: `PROFILE.bestRange`, profile.js) | `practice arena` (readouts: `drawAgame`/`drawAgameUI`, draw-world.js; the bell's pixels: `drawAgBell`, draw-world.js; the sink crop: the dummy/rack/agbell branches, render.js) |
| the ice parkour: the stock centreline, the carve, the fixed line strip, the lap clock's state and rules | `PK_PATH`, `PK_LINE` (force-iced by `pkPlanCarve`; its two end flags: `genPracticeWorld`), `PK_OFF_T`/`PK_GATE`/`PK_WALK`, `pkCarve`, `parkour` (incl. `cpTx/cpTy`, `custom`, `diff`), the parkour block of `updatePractice` | `practice arena` (pixels: `drawParkourLine`/`drawParkour`, draw-world.js) |
| the roll station: the die, its held wheel, random tracks, the carving-front sweep | `PK_DIFFS`/`PK_DIFF`, `PK_CX`/`PK_CY`/`PK_RX`/`PK_RY`/`PK_APRON`, `PK_DIE`, `pkTiles`, `pkGenPath`, `pkPlanCarve`/`pkIceTile`, `pkRoll`, `pkAngKey`/`pkAnimStep`/`pkAnim`/`PK_ANIM_T`/`PK_WARN`, `pkDieNear`, `pkWheelPick` (the wheel: kind `'pkdie'` in keydown/keyup input.js, `wheelOptions`/`renderWheel`/`runCmd` ui.js; the `E ROLL` cap: `drawPkHint`, ui.js) | `practice arena` (pixels: `drawPkDie` + `PK_PIP_*`, draw-world.js) |
| the armory: taking a tool off the practice rack, and who counts as beside it | `rackEquip`, `rackNear` (the E-held wheel: keydown/keyup in input.js; kind `'rack'` in `wheelOptions` / `runCmd`, ui.js; the `E ARM` cap: `drawRackHint` / `drawKeyPrompt`, ui.js) | `practice arena` |

## js/nav.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| entity movement and unit-vs-unit solidity | `moveEntity`, `separateUnits`, `UNIT_MASS` | `movement & collision` (the tile half, `isSolidTile`: `world`, world.js) |
| routes around obstacles: A*, the per-unit route follower, the stall/give-up signal | `findPath`, `walkable`, `navTo`, `navStep`, `navLineClear` | `pathfinding` |

## js/wildlife.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| an animal's level: dealt once at spawn from the table's average, what it grows (hp, and the kill's gold) | `ANIMAL_LV_HP`, `ANIMAL_LV_GOLD`, `animalLevel` (under `ANIMAL_HP`), `a.level` in `makeAnimal`, the payout in `animalDies` | `animals` (a monster's bite growth: `MONSTER.lvBite`, above the `camp monsters` banner) |
| the meadow's strength and its restock: the boot spawn, the clock, the clear-of-everyone spot | `PREY_POP`/`PREY_REPOP`/`PREY_CLEAR`, `spawnPrey`, `bushList`, `spawnAnimals`, `updatePreyStock` (called from `updatePlay`, sim.js, never under `PRACTICE`) | `animals` |
| wildlife behaviour: the shared lifecycle and the prey half, with the rabbit's jink (the shot it reads as coming at it, and the dash) and the noticed mark's clock (`a.senseT`, set in `updatePrey` and `updateCampMonster`) | `updateAnimal`, `updatePrey`, `arrowAtRabbit`, `rabbitDodge`, `animalDies` | `animals` |
| what a beast is DOING, drawn: the clip table, the two movers of it, and the sit-up / head-up windows the prey read off | `ANIM_CLIPS`, `setClip`, `stepClip`, `RABBIT_ALERT` (`a.alertT`), `PREY_WARY_T` (`a.wary`) | `animals` (played by `clipFrame`, draw-world.js) |
| the tuning for everything wild: the prey's bolt, the deer's sprint and the rabbit's jink, the holes cut down to the fish, the shoal itself, the pack, the flock | `FLEE_SIGHT`/`FLEE_TIME`/`PREY_SPD`/`PREY_RUN`, `DEER_SPRINT`/`DEER_SPRINT_T`/`DEER_SPRINT_REGEN`, `RABBIT_DODGE_*`, `ICE_HOLE_HITS`, `HOLE_FALL_DMG`/`HOLE_FALL_T`, `FISH_CATCH_R`, `FISH_MAX`/`FISH_MIN`/`FISH_SPAWN_FAST`/`FISH_EMERGE_*`, `MONSTER`, `CAMP_GROUND`/`CAMP_LEASH_T`/`CAMP_REGEN_T`, `BIRD_*` | the top of `animals` (the prey), `fish` (the ice and shoal half) and above `camp monsters` (the three wolves, and the dormant flock); `FISH_SPAWN_T` alone stays in core.js |
| an animal taking a hit from anything (arrow or roll): flee/wake, floater, knockback, kill credit | `hurtAnimal` | `animals` |
| where an animal walks next: the graze/patrol goal, and the bolt away from a player | `wanderGoal`, `preyWander`, `fleeGoal` | `animals` |
| a camp monster: neutral until hit, the camp waking on the hitter, the leash bar that holds on the camp's ground and drains off it, the heal at home, the bite | `isCampKind`, `wakeCamp`, `updateCampMonster` | `camp monsters` |
| ALPHA'S BLOOD: the kill's buff and the epic's team payout | `CAMP_BUFF_T`/`CAMP_BUFF_EPIC_T`/`CAMP_BUFF_DMG`/`CAMP_BUFF_SPD`, `EPIC_TEAM_GOLD`, `campBuff` (above the banner); the grants in `animalDies` | `animals`/`camp monsters` (what it does: `hurtUnit`, actions.js; `abilityMoveMul`, abilities.js; the tick, `updateAbilities`, abilities.js; the ring: `drawBuffRing`, draw-world.js) |
| the flock: the flush, the circuit, the perch | `flushBirds`, `updateBird` | `birds` |
| fish shoal and ice holes | `updateFish`, `fishClear`, `fishWater`, `spawnFish` | `fish` |
| where new fish come from, and why one is invisible until it is under the ice | `spawnEmerger`, `buildEmergeSites`, `fishVis`, `f.born`/`f.vis`, `FISH_MAX`/`FISH_MIN`, `state.fishT` | `fish` |
| a fish net: the lure, the catch, handing the catch over, drawing it | `nearestNet`, `angDelta`, `updateStructures` (`net` branch, structures.js), `drawNet` (`entity draw`, draw-world.js), `NET_*` | `fish` |

## js/structures.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| THE one placement rule (the ghost's colour, the click, the pad's wheel, findSite and the AI all ask it), the building E manages, then build, upgrade, demolish, refunds, a chest's card rarity roll | `canPlaceAt`, `manageNear`, `placeStruct`, `startUpgrade`, `demolishStruct`, `cumulativeCost`, `rollCardRarity` | `structures` |
| every buildable: its tiers, costs, HP, footprint (and whether it `rotates` / is `tiled`), the two colours the maps paint it; the list's order, the two wheel tables, the builder's reach | `STRUCTS`, `BUILD_ORDER`, `STRUCT_ORDER`, `WATER_STRUCT_ORDER`, `BUILD_REACH` | `structures` (scenery carries the same `mm`/`map` pair: `OBJECTS`, world.js) |
| the build list and its ghost: the rows, their hit test, what the ghost snaps to and whether it can stand, the two draws | `BUILD_X`/`BUILD_Y`/`BUILD_ROW`/`BUILD_W`, `BUILD_OK`/`BUILD_NO`, `buildRowRect`, `buildListHit`, `buildGhostAt`, `drawBuildGhost`, `drawBuildList` | `selection, hints & wheel` › `the build list and its ghost`, ui.js |
| a tiled building's draw (one tile of art per footprint tile) | `drawTiledStruct` | `entity draw`, draw-world.js |
| where a bot lays a building | `aiBuildSite`, `AI_BUILD_R` | `ai`, ai.js |
| the fish net's tuning: what it holds, what it lures, how fast it catches and hands over | `NET_CAP`, `NET_R`, `NET_LURE`, `NET_CATCH_T`, `NET_TAKE_T` | `stump structures` (beside `STRUCTS`, whose `net` entry it belongs to) |
| tuning: the turret's pivot and barrel, its lock window, its bolts | `TUR_PIVOT_Y`, `TUR_BARREL`, `TUR_LOCK`, `TUR_MZ`, `BOLT_SPD`, `BOLT_LIFE` | `the building sim` › `turret gunnery` |
| construction ticks, generators, the bay rolling a bot out, the barracks queuing and rolling out a wave | `updateStructures`, `BARRACKS_ROLL` | `the building sim` (the barracks' entry - `wave`/`waveT`/`grow`/`cap`, `art`, `fixed` - is in `STRUCTS`; its pixels `drawBarracksOverlay`, draw-world.js) |
| turret targeting (range alone: a bolt flies over the world), traverse and firing | `turretPivot`, `turretMark`, `turretMuzzle`, `fireBolt` (`solid: false`) | `the building sim` › `turret gunnery` |

## js/robots.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| tuning: what a worker swing hits for, how far it notices and chases, how far a flag's ring reaches | `ROBOT_DMG`, `ROBOT_ATK_CD`, `ROBOT_REACH`, `ROBOT_AGGRO`, `ROBOT_LEASH`, `ROBOT_MAD`, `FLAG_R` | `team flags` |
| a bot leaving the bay's mouth, and the frame it spends deciding | `makeRobot`, `updateRobot` (`updateStructures` rolls them out: `the building sim`, structures.js) | `workers` |
| shooting a worker bot: its hitbox, its damage, its wreck, and who it is now angry at | `robotHit`, `hurtRobot`, `robotDies`, `b.mad` | `workers` |
| what a worker does this frame: the flag dispatch, the harvest tick, the melee | the tail of `updateRobot`, `engage`, `gather`, `holdAt` | `workers` |
| the eagle's merchant: climbing down at the crash, the barracks it clears the woods for and raises behind the roost (and rebuilds), the defence it raises off the two stump rings (four corner turrets inside, a wall ring with corner gaps outside), the rim it fells, keeping to its post at the head of the spur, and standing still to serve whoever opens its counter | `MERCH_*` (incl. `MERCH_BAY_*`), `freeTileNear`, `spawnMerchant` (called from `eagleCrash`, boot.js), `updateMerchant` (dispatched from `updateRobot` on `b.merchant`), `merchFell`, `merchBaySite`, `merchBayBlocker`, `b.bay`/`b.bayT`/`b.baySite`, `b.plan`/`b.avoids`, `shopServing` (js/shop.js) | `merchant` |
| a wave's soldier: its route down the road, the four rungs it fights by, the bird strike, the bounty | `SOLDIER_*`, `makeSoldier` (rolled out by `updateStructures`'s barracks branch, structures.js), `updateSoldier` (dispatched from `updateRobot` on `b.kind === 'soldier'`), `robotDies`'s bounty (the `workers` banner) | `soldiers` (the pennant: `drawRobot`, draw-world.js; the gust: `updateEagle`/`eagleGust`, boot.js) |
| the team flag: the four orders and their glyphs, the wheel's order, planting/moving/lifting one, whose flag a body serves (a human's over all), a teammate's to join, the nearest to help at | `FLAG_TYPES`, `FLAG_ORDER`, `FLAG_MINE`/`FLAG_FOE`, `plantFlag`, `clearFlag`, `flagRecall`, `flagOf`, `servedFlag`, `humanFlag`, `teamFlagAt`, `nearestTeamFlag`, `flagPos`, `inFlag` | `team flags` |
| what is hostile inside a flag's ring, and who has already claimed a tile in it | `flagFoe`, `enemyStructNear`, `objTaken` | `team flags` |
| a worker's attack: who is a valid mark, where the axe lands, the blow itself | `robotFoeUnit`, `foeAlive`, `foePoint`, `robotStrike`, `ROBOT_*` | `team flags` › `a worker's simple attack` |
| how an AI PLAYER answers a flag, and flies its own | `aiFlagSync`, `aiStructTile`, `AI_FLAG_*`, the `order` block and rung 5a of `updateAI` | not here: `ai` › `the flag`, ai.js |
| what a flag LOOKS like - all six draw functions | `drawFlagIcon`, `drawFlagPennant`, `drawFlagRing`, `drawFlagRings`, `drawFlag`, `drawFlagMark` | not here: `entity draw` › `what a flag looks like`, draw-world.js |

## js/actions.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a click / E / space actually does, and the work the hands take with no key (a tree, a berried bush in reach) | `clickAction`, `tryWork`, `workTarget`, `startSwing`, `autoToolFor`, `autoPrio`/`AUTO_PRIO_*`, `autoTarget`, `autoWork`, `tryDodge`, `hitObject`, `crackIce` (what a click FIRES: `fireTool`, tools.js; the fish half: `autoFish`, tools.js) | `actions` |
| one chop into a standing tree - gold, stump, fell payout, loot roll, jackpot - whatever landed it | `chopTree` | `actions` (above `hitObject`; its other caller is `BIT_IMPACT.chop`, tools.js) |
| the tuning for everything a player does: the three SWING tools, the shot trail, E's reach, the roll, prone | `SWING_TOOLS`/`SWING_*`, `BOW_Y`, `ARROW_*`, `WORK_REACH`, `STRUCT_HIT_DMG`, `ROLL_*`/`TACKLE_*`, `PRONE_*`, `AMBUSH_MUL` | `actions` (its head; the two kit baselines `BOW_CHARGE`/`BOW_NOCK`: `players`, player.js; the weapon's own tuning: `TOOLS`/`BITS`, tools.js) |
| the roll as a hit: the sweep and the tackle | `rollSweep`, `rollTackle`, `tackleObject`, `tackleObjAhead`, `rollPow`, `rollDmg` | `actions` › `the roll as a hit` |
| going to ground and getting back up | `tryProne`, `risePlayer` | `actions` › `prone` |
| the empty-press tell (an empty slot, or a budget that reaches no shot) | `dryFire` | `actions` › `the empty press` |
| one blow against a building on another team (E swing, every bit a tool fires, every ability, worker axe alike) | `hurtStruct`, `STRUCT_DR`, `STRUCT_HIT_DMG`, `destroyStructure` | `actions` (its tail) |
| which buildings an AREA effect reaches, and whose they are | `structsNear`, `structFoe` | `status effects` (beside `unitsNear`/`unitFoe`, which they mirror) |
| every way of hurting the practice dummy (E, every bit, the tackle), and the meter's combo ledger | `hitDummy` | `actions` (its tail; the dummy itself: `practice arena`, world.js; the plate: `drawDummyMeter`, draw-world.js) |
| **the one blow every kind of unit takes** - a player, an animal, a worker bot | `hurtUnit` | `status effects` (its per-kind ends: `damagePlayer` player.js, `hurtAnimal` wildlife.js, `hurtRobot` robots.js) |
| every living thing in a circle an area effect may touch, in one list | `unitsNear`, `unitsHit` (blows only), `unitFoe`, `unitTeam`, `unitAlive`, `unitMidY`, `isAnimalUnit` | `status effects` › `what a unit IS` |
| asking those two on behalf of a THING in the world (a net, a shot) rather than a body | `sideOf` | `status effects` › `what a unit IS` (its kill-credit half: `abCredit`, abilities.js) |
| putting a state ON a body - the one writer for each | `stunUnit`, `rootUnit`, `slowUnit`, `netUnit`, `markUnit`, `igniteUnit` | `status effects` › `the states a unit can be under` |
| what a damage TYPE is, and the fire that outlives its blow | `DMG_TYPES`, `BURN_T`/`BURN_DPS`/`BURN_TICK`/`BURN_MAX`, `igniteUnit`, `updateBurn`, `douseUnit` | `status effects` › `fire` (the bits that deal it: `BITS.flame`/`pyre`/`cinder`, tools.js; the exemption from the roll’s and the respawn’s i-frames: `DOT_CAUSE`, player.js) |
| ageing those states, and what is left of a non-player's speed | `updateUnitStatus`, `unitMoveMul`, `clearUnitStatus` | `status effects` › `the clock every non-player unit runs` (a player's own copy: `updateAbilities`, abilities.js; where the speed is spent: `navStep`, nav.js) |

## js/tools.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what every weapon and every shot IS: the two tables the whole system is driven from | `TOOLS`, `BITS`, `TOOL_TIERS`, `TOOL_SLOTS` (1 - the one weapon slot) | `tools & bits` (its head) |
| the tier a find wears, and where that colour is read back | `TOOL_TIERS`, `itemTier`, `TIER_SHINE` (`tierPlate`/`tierShine`, which paint it: `UI`, ui.js) |`tools & bits` |
| the bag rows that make tools and bits carryable at all | the `ITEMS` / `RES_COLORS` loops at the foot of the file | `tools & bits` › `icons` |
| a tool instance and the things that read one; the cycle a press starts | `makeTool`, `heldTool`, `bitsIn`, `toolLoad`, `toolOver`, `newMods`, `bitMods`, `peekBit`, `toolRof`, `toolCycle`, `toolReady` | `tools & bits` › `a tool instance` |
| **what one press does**: the tensile budget spent along the row, where it runs out, the envelope each shot is fired through, and which fittings shaped it (`shots[].mods`, what the shelf draws its rails from) | `toolPlan` (returns `shots`/`spent`/`used`/`cut`/`load`/`tensile`) — read by `fireTool`, `drawAimLine` (render.js) and `drawShelf` (ui.js) alike | `tools & bits` › `a tool instance` |
| the draw curve: what a hold buys a shot, and the one flight envelope the sim fires and the aim line measures | `DRAW_RANGE_MIN`/`DRAW_SPEED_MIN`/`DRAW_DMG_MIN`, `drawPow`, `drawSpeedMul`/`drawRangeMul`/`drawDmgMul`, `shotFlight` | `tools & bits` › `the draw` |
| the fire a shot carries, and the three modifier bits that put it there | `BITS.flame`/`pyre`/`cinder`, `PYRE_T`/`PYRE_DPS`/`CINDER_R`, `m.type`/`m.burn`/`m.burnDps`/`m.cinder` in `newMods` | `tools & bits` (beside `BITS`; what a burn then DOES: `status effects`, actions.js) |
| moving a tool onto a key or a bit into a cell (the two the drag goes through) | `slotPut`, `bitPut` | `tools & bits` › `equipping` |
| what a press actually fires, and the shot it puts in the air; the fish taken with no press at all | `fireTool`, `emitBit`, `offBy`/`SHOT_SKEW`/`DUP_SKEW` (the volley's spread), `autoFish`, `FISH_AUTO_CD` | `tools & bits` › `what a tool fires` |
| a melee tool's press: the wedge the blade sweeps at this draw, every bit in the plan as one cut of it, and the sweep left on the snow | `TOOLS[id].melee` (`reach`/`half`), `SLASH_T`, `SLASH_REACH_MIN`, `slashReach`, `slashTool`, `slashes`, `updateSlashes` (the hand's own swing: `p.slashT`/`slashA`/`slashHalf`, player.js, drawn by `drawHeldTool`, draw-world.js) | `tools & bits` › `the cut` |
| a weapon's art at its real length in the hand, where it differs from the bag icon; which way every art's business end is drawn | `TOOL_HELD_ART` (baked as `toolHeld_<art>_<tier>`), `TOOL_FWD` | `tools & bits` › `art` |
| the catch pose: its clock, the cancel every step, press and hit call, which of its three frames is up | `CATCH_T`, `startCatch`, `cancelCatch`, `catchFrame` | `tools & bits` - after `autoFish` (ticked in `updatePlayer`, sim.js; drawn by `drawPlayer`, draw-world.js; the net take in `updateStructures`, structures.js) |
| how each bit flies, and the numbers behind the four non-straight paths | `steerBit`, `ORBIT_R`, `LOB_DRAG`/`LOB_FALL`, `CURVE_TURN`, `BOOM_*` (the boomerang's return controller) | `tools & bits` › `how a bit flies` |
| what a shot does where it LANDS, and the two that do anything | `BIT_IMPACT`, `bitImpact`, `AXE_CHOP_R`, `WARP_BACK` | `tools & bits` › `what a bit does where it lands` (called from the arrow update: `update`, sim.js) |
| the teleport itself: the jump, and the silhouettes it strings across it | `warpPlayer`, `updateWarps`, `warps`, `WARP_FLASH_T`/`WARP_STEP`/`WARP_MAX` | `tools & bits` › `the teleport` (drawn by `drawWarps`, render.js; aged in `updateFx`, sim.js) |
| how hard a shot shoves what it hits | `kb` on each `BITS` row (`HIT_KB` player.js, `ROBOT_KB` robots.js, `o.kbMul` in `hurtUnit`) | `tools & bits` (beside `BITS`) |
| where tools and bits come from, and how often | `dropLoot`, `LOOT_POOL`, `rebuildLootPool`, `ROCK_DROP`, `TREE_DROP`, `CHEST_TOOL`, `LOOT_TOOL` | `tools & bits` › `loot` (its callers: `hitObject`, actions.js) |
| the arsenal's kinds and their lineage on paper, all of it unlocked; the "held one" pip | `TECH`, `TECH_BY_ID`, `noteSeen` | `tools & bits` › `the tech tree` (storage: `PROFILE.techSeen`, profile.js; the page that lists them: `the wiki`, menu.js) |
| what each class flies in with | `CLASS_LOADOUT`, `giveLoadout` | `tools & bits` › `starting loadouts` (the weapon rides the gear pop-up's preview: `drawGearPreview`, menu.js) |
| a bot putting its loot to work, having no shelf and no pointer | `botFitLoadout` | `tools & bits` › `a bot fitting what it has found` (called from `updateAI`: `ai`, ai.js) |
| the icons for both, and the one bake helper they share | `TOOL_ART`, `TOOL_ART_PAL`, `BIT_ART`, `BIT_PAL`, `bakeGrid` | `tools & bits` › `icons` |
| **a found bit arming itself**: the free cells of the tool in hand counted as room, and the pickup that fills them before the pack (a bot is left to `botFitLoadout`) | `autoFitTool`, `fitRoom`, `fitAdd` (its callers: the drop pickup in `updatePlay`, sim.js; `shopBuy`, shop.js) | `tools & bits` › `a find arms itself` |
| **a discarded weapon shedding its build** as it lands — every ground-drop path calls it; its `gone` flag sheds into thin air instead | `SHED_KICK`, `shedBits` (its callers: `throwCell`, ui.js; `spillInventory`, player.js) | `tools & bits` › `a tool that lands in the snow arrives bare` |
| **starting kit off a body never landing**: what counts as one, and the evaporation it goes down as instead | `STARTER_CAP`, `isStarterTool`, `evaporateTool` (its only caller: `spillInventory`, player.js — a throw, a loot roll and an upgrade swap all still land) | `tools & bits` › `a starting tool does not litter the snow` |
| **a better body taking the hand and the build with it**: whether a find would swap, doing it (bits move cell for cell), and the tell it raises | `toolUpgrade`, `takeUpgrade`, `swapFx`, `SWAP_T`/`SWAP_RISE`/`swaps`, `updateSwaps` (called from the drop pickup in `updatePlay` sim.js; drawn by `drawSwaps`, render.js) | `tools & bits` › `a better body takes the build with it` |
| what the last press SPENT — or, on a swap, the whole row — lit on the shelf and fading | `BIT_LIT_T`, `bitLit` (`{cell, cells, t, col}`; cell -1 is the tool well), `bitLitAt` (clamped), `bitLitCol` (set in `fireTool` and `swapFx`, aged in `updateFx`, sim.js) | `tools & bits` › `what a tool fires` |
| how big a stack of bits a cell holds | `BIT_STACK` (read by the `ITEMS` registration at the foot of the file) | `tools & bits` › `items: one bag entry per kind` |

## js/abilities.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the two kits' four actives each: name, cooldown, cast, and the whole effect | `CLASS_AB` (each row's `use(p)`) | `class abilities` |
| tuning for every ability (pierce windup/multiplier/telegraph range, net slow, grapple reach/reel/assist, shield arc, the slam, rush ramp/slam, crater, the execute's missing-life scale, the telegraph colours and flash length) | `PIERCE_*`, `NET_*`, `GRAP_*`, `SHIELD_*`, `SLAM_*`, `RUSH_*`, `STOMP_*`/`CRATER_*`, `EXEC_*`, `AB_FX_T`/`TELE_COL`/`TELE_HOT` (snow cover's numbers are `PRONE_*`, actions.js) | `class abilities` (its head) |
| the shield's second half: the key again while the wall is up or mid-charge winds up the SLAM (the rush ended on the spot), and the execute's missing-life cut | `abSlam`, `execDmg`, `abExecute`, `startCast`/`castProg` (state: `p.castSlam`, `p.castMax`, player.js) | `class abilities` › `casting` / `warrior: the four effects` |
| the wedge every blade-shaped blow sweeps and draws, and the ring: units by centre plus radius, buildings by any footprint tile | `inCone`, `unitsInCone`, `structsInCone` | actions.js › `units` (beside `unitsNear`/`structsNear`) |
| every wind-up's shape on the snow for both sides and the flash where it landed (the pierce/charge line, the stomp ring, the slam/execute wedge), and the sword's sweep over the bodies | `abFx`, `drawWedge`, `drawRing`, `drawTeleLine`, `drawSlashes`, `drawAbilityGround` | `class abilities` › `drawing: the world layer` |
| ability levels: a skill point per level on the four keys (level 0 = LOCKED, the first point unlocks), the bought-and-ready gate every caster asks, and the level-cut cooldown every setter reads | `AB_LV_MAX`/`AB_LV_CD`, `abUnlocked`, `abReady`, `abLvCanBuy`, `buyAbilityLv`, `abCdOf` (state: `p.abLv`, player.js) | `class abilities` › `levelling` (bought via `runCmd`, ui.js, or the ability key itself while a point is unspent — `p.input.ability` in `updatePlayer`, sim.js; bots: `updateAI`'s rung 0, ai.js) |
| a keypress becoming a cast, and the per-player tick that lands it | `tryAbility`, `updateAbilities` | `class abilities` › `casting` |
| every movement cap an ability may touch, folded once | `abilityMoveMul` | `class abilities` › `casting` (read by `updatePlayer`, sim.js) |
| what the abilities leave in the world, stepped per sim step | `craters`/`nets`, `updateAbilityWorld` (the piercing shot rides `arrows`, sim.js; the grapple lives on its caster: `p.grapT`/`grapX`/`grapY`, `grapEnd`, and the reel branch in `updatePlayer`) | `class abilities` › `the world tick` (called from `updatePlay`, sim.js) |
| the shield eating a shot, the rush's step/grab/slam | `abShieldBlocks` (read by the arrow loop, sim.js), `rushStep`/`rushEnd` (read by `updatePlayer`'s rush branch) | `class abilities` |
| drawing it all: ground layer, air layer, the pose on the sprite, the states on a body | `drawAbilityGround`, `drawAbilityAir`, `abilityPose`, `drawAbilityOnPlayer` | `class abilities` › `drawing` (called from render.js and `drawPlayer`, draw-world.js) |
| the net drape, the root's jaws, the flames and the mark's chevrons, on ANY sprite at its own size | `drawUnitStates` | `class abilities` › `drawing` (its four callers: `drawAbilityOnPlayer` here, `drawAnimal`/`drawBird`/`drawRobot`, draw-world.js) |
| who a thing left in the world credits its kill to, once the caster may be down | `abCredit` | `class abilities` › `the world tick` (whose SIDE it is on: `sideOf`, actions.js) |
| the eight 32×32 ability icons and their bake | `AB32`, `AB32_PAL`, `classAbIcon` | `class abilities` › `the strip icons` (drawn by `drawClassAbCell`/`tipClassAb`, ui.js) |

## js/ai.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a bot decides to do this frame | `updateAI`, `aiNearestEnemy`, `aiLineClear`, `aiOpenSides` | `ai` |
| how well it plays: the three rival levels, the ally profile a notch above, which one a player runs | `AI_LEVELS`, `AI_ALLIES`, `aiProfile`, `AI_AIM_T`/`AI_ABIL_T` | `ai` › `difficulty` |
| the objective: who pushes and who guards, the walk into a roost through its lane, the gate turrets, the archer's station, the siege that ignores respawning defenders | `aiRank`, `aiPushers`, `aiWantsPush`, `aiOnGuard`, `aiRivalEagle`/`aiOwnEagle`, `aiToRoost`, `aiLaneGate`, `aiInLane`, `aiEagleTile`, `AI_HOLD`, `AI_GATE`, `AI_ROOST_BUDGET`, `AI_ESCALATE`, `AI_SIEGE_R` (the `siege` read in `updateAI`) | `ai` › `difficulty` (the bird's numbers: `EAGLE_HP`/`EAGLE_ARROW_DMG`/`EAGLE_WORK_DMG`, boot.js) |
| what every bot knows about both birds: nerve, last hit, who is at each (a rival wave counted at half strength), the `threat` read the defend and push rungs ask, how many a threat calls home | `aiSituation`, `aiDefendersWanted`, `AI_ROOST_R`/`AI_DEFEND_T`/`AI_JOIN_HP`/`AI_ALARM_HP` | `ai` › `difficulty` › `the two birds` |
| the waves as a bot sees them: a rival soldier in sight is a target, its own column's head is what a pusher walks with | `aiNearestEnemy` (its `robots` loop), `aiWaveHead`, `AI_WAVE_R`/`AI_WAVE_D` (the `head` read in rung 5c of `updateAI`) | `ai` |
| an ally at your side: the escorts, the anchors that let it join your fight and your push | `aiEscorts`, `AI_ESCORT`/`AI_ESCORT_R`, `AI_ANCHOR_R`/`AI_ANCHOR_D` | `ai` › `difficulty` |

## js/sim.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the frame sim: momentum, day/night, timers | `update`, `updatePlay`, `updatePlayer` | `update` |
| the disc an arrow lands in round a body | `ARROW_HIT_R` (above `updatePlay`) | `update` |
| the clock paying every player on the ground a coin, silently | `TRICKLE_GOLD`/`TRICKLE_T` (the tick is in `updatePlay`'s player loop) | `passive income` |
| the zoom ease itself (runs first thing in `update`) | `applyZoom` | `update` |
| the one wind field: its strength, which way it is running, and the signed lean at a tile | `windAmp`, `windVeer`, `windSway`, `wsin`/`wskew`, `WIND_*` | `wind` |
| particles, floaters, footprints, drops, world-space snow flakes | `updateFx`, `makeFlake`, `fitFlakes` | `fx updates` |
| the belly-crawl drag furrow: emitted in `updatePlayer`, drawn as the `f.k === 3` branch | `footprints`, `p.trailD` | `update` (the draw branch: `render`, render.js) |

## js/draw-world.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| ground painting and runtime repaints | `paintGroundTile`, `renderGround`, `repaintGround`, `hash2`, `vnoise` | `ground prerender` |
| the treasure chest's and the practice dummy's baked sprites | `CHEST_SPR`, `DUMMY_SPR` | `entity draw` (its head; drawn in the y-sorted pass, render.js) |
| the dummy's LAST HIT / DPS / TOTAL plate | `drawDummyMeter` (its linger: `DUMMY_METER_LINGER`, world.js) | `entity draw` |
| the training field's pixels: the target face bakes (both sizes), the perimeter track's rails, a carriage target in any habit, the range bell, the round's readouts and its off-screen target chevrons, the big gate flag, the two-tile bow rack, the parkour's line and readouts, the roll die | `bakeTargetFace`/`TARGET_SPR`/`TARGET_SPR_S`, `drawAgTrack`, `drawPTarget`, `drawAgRings`, `drawAgBell`, `drawAgame`, `drawAgameUI`, `drawAgMarkers`/`AG_MARK_*`/`agMarkAtlas`, `drawBanner`, `RACK_SPR`, `drawParkourLine`, `drawParkour`, `drawPkDie`, `PK_DIE_COL`/`PK_PIP_COL`/`PK_PIP_AT` | `entity draw` (the records they draw: `practice arena`, world.js) |
| the one arrow body every shaft draws: the DDA rasteriser (crisp diagonals, mirrored vanes) and its rim/colour painter | `arrowBodyPx`, `paintArrowPx` (the master: `ARROW_MAP`/`ARROW_BODY`, actions.js) | `entity draw` |
| drawing players / animals / robots / the merchant / held tool | `drawPlayer`, `drawGhost`, `drawHeldTool`, `drawAnimal`, `drawRobot`, `drawMerchant` (dispatched from `drawRobot`) | `entity draw` |
| the frame a beast is on: its clip and how far into it, wrapped so any `animT` lands on a frame | `clipFrame` (the clip is `a.clip`, set in js/wildlife.js from `ANIM_CLIPS`; the frames are `SPRITES[kind][dir][clip]`, built by `bakeClips`/`mapClips` in sprites.js) | `entity draw` |
| the level plate a hero and a beast share, the noticed `!` over an animal that sees you, the stun stars | `drawLevelBadge`, `drawSenseMark`, `drawStunStars` (under `drawHealthBar`) | `entity draw` |
| the camp glyph both maps stamp, and the respawn clock a hovered anchor wears | `drawCampIcon`, `drawCampClock` | `entity draw` › `the camp glyph` (its `CAMPS` spec: `camps`, world.js) |
| ALPHA'S BLOOD worn: the amber ring of pips around a blooded player's feet | `BUFF_RING`/`BUFF_COL`, `drawBuffRing` (above `drawPlayer`) | `entity draw` |
| what a flag looks like: the order's glyph (at any scale), the map pennant, the ring an order covers (every standing one and the held wheel's preview), the planted banner, and a map's pennant-with-ring | `drawFlagIcon`, `drawFlagPennant`, `drawFlagRing`, `drawFlagRings`, `drawFlag`, `drawFlagMark` | `entity draw` › `what a flag looks like` (what they read, `FLAG_TYPES`/`FLAG_R`: `team flags`, robots.js; the wheel's pick: `wheelLayout`, ui.js) |
| what a body looks like on either map: the square in its side's ink (a player one step bigger than a robot), the watched body's white heart in its side's ring, the bird diamond | `drawMapDot`, `drawMapUnit`, `drawMapYou`, `drawMapBird` | `entity draw` › `what a body looks like on a map` (its two callers: `renderMinimap` ui.js, `renderWorldMap` panels.js) |
| the snow over a buried body, its row spans, and the bury meter | `drawSnowCover`, `poseBounds`, `poseSpans`, `drawBuryRing` | `entity draw` |
| worn gear on the 16×16 sprite | `GEAR_MARKS`, `drawGearMarks` | `entity draw` |
| the stun tell: orbiting sparks, and the plate that carries them on a player's frame while it lasts | `drawStunStars`, the overhead block inside `drawPlayer` | `entity draw` |
| the overhead frame and the name over it: where the stack sits, the three bars' palette (health by side, stamina white, the draw meter's two golds), and centring odd-width text on a model | `FRAME_DX`, `BAR_NEUTRAL`/`barCol`, `STAM_COL`/`STAM_GHOST`, `DRAW_COL`/`DRAW_FULL_COL`/`DRAW_FULL_FLASH`, `NOCK_COL`/`EAT_COL`, `THREAT_COL` (a camp monster's leash bar; a deer's sprint bar and a rabbit's dodge bar reuse `STAM_COL`), `drawHealthBar`, `centreTextX` | `entity draw` |
| the turret's rotating gun, its bolts, its aim line and muzzle flash | `drawTurretHead`, `drawBolt`, `drawTurretFx`, `paintRimmed` | `entity draw` |
| which bend frame a pine is wearing, and whether it draws mirrored (off the wind field) | `treeFrame`, `TREE_FRAMES`/`TREE_REST` | `entity draw` |
| one baked speck (mote, star, flake) at a quantised brightness, and the atlas behind it | `bakeSpecks`, `drawSpeck` | `light & weather` |
| whether the sun shafts are up at all (the drop window, and noon) | `rayLight` | `light & weather` |
| sun shafts, drifting cloud shadows, the tileable noise they are baked from | `godRays`, `cloudShade`, `cloudLayer`, `bakeCloud`, `pnoise` | `light & weather` |
| the ice's night mirror + the parallax stars in it, and the "is this pixel on unbroken ice" mask | `drawIceStars`, `overIce` | `light & weather` |
| the night colour, a lit shot's halo, snow (world-space flakes, see `fx updates`), vignette | `renderLighting`, `litShots`, `renderWeather` | `light & weather` |

## js/render.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| render pass order | `render` | `render` |
| the occluder fade: the visibility pocket around the viewed hero, and its silhouette rim | `TREE_FADE_A`/`TREE_FADE_R0`/`TREE_FADE_R1`, `treeFadeSil`, the tree branch of the y-sorted pass | `render` (the rim stamp: `drawPlayer`, draw-world.js) |
| the work-target rim: gold outline on the hovered tree/dead tree/rock/berried bush/chest | `drawTargetRim`, the `o === fadeWkO` stamps in the y-sorted pass | `render` |
| the F3 readout: fps, coords, seed | `drawTags` | `render` |
| the `.` overlay: hitboxes, the model centre column, and its 1px ring/box/line rasterisers | `drawHitboxes`, `hbRing`, `hbBox`, `hbDot`, `hbLine`, `hbMid`, `HB_*` | `debug overlays` |
| the `.` overlay's routes: waypoints + goal tile, a bird's perch line, a fish's heading arrow | `drawNavPaths`, `hbArrow` | `debug overlays` |
| which body a bit flies as, and the four that are not the arrow | `BIT_BODY`, `drawTumbler`, `drawMote`, `drawSwungBody`/`FIST_MAP`/`AXE_MAP`/`BIT_INK`, `drawWarpShot` | `render` (after the shots pass; the names they answer to: `body` on `BITS`, tools.js) |
| the silhouettes a teleport strings across its jump | `drawWarps` | `render` › `the teleport's flash` (the flash itself: `warpPlayer`/`warps`, tools.js) |
| the ring and the risen icon a TOOL SWAP raises, on every player | `drawSwaps` | `render` › `a weapon that changed hands with nobody's hand on it` (the event itself: `swapFx`/`swaps`, tools.js) |
| **the three item icons that MOVE** (the gold piece, the berry, the fish): the frame stamped into each one's live canvas, once a frame off one clock, so `SPRITES[ITEMS[type].icon]` stays one generic read everywhere | `stepItemIcons`, `ITEM_FR` (the frames: `SPRITES.itemAnim`; the grids: the `gold nugget` and `items` sections of sprites.js) | `render` (called at the top of `render()`, before anything draws) |
| pointer state and the bow aim line | `cursorInfo`, `drawCursor`, `drawAimLine` | `cursor & aim line` |

## js/ui.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| radial menu geometry and hit math | `wheelSpan`, `wheelAng`, `wheelOptions`, `wheelLayout`, `resolveWheel` | `radial wheel` |
| brackets, the E prompt (never over what the hands take on their own), the fish brackets, wheel pixels | `drawSelection`, `drawWorkHint`, `drawFishHint`, `renderWheel`, `drawWheelHub`, `drawWheelStick` | `selection, hints & wheel` |
| HUD and minimap | `renderUI`, `renderMinimap`, `updateMinimap` (throttled to `MM_REBUILD` ticks), `mmChrome`/`mmArcBand` (the disc's baked chrome and cached day/night arc band) | `UI` (the disc's per-tile colour comes from `objMapColor(o)`: `world`, world.js; the marks over it: `drawMap*`, draw-world.js) |
| is the pointer over HUD that owns its own clicks, rather than over the world | `overHud` | `UI` (its caller is `openFlagWheel`, input.js) |
| the `E SHOP` cap over a merchant in reach | `drawShopHint` | `selection, hints & wheel` (the resolver and everything behind it: `merchNear`, shop.js) |
| the backpack: the inventory DRAWER under the weapon shelf top-left, shut until B / L3 / the small arrow under the tool cell (the counter holds it open), sliding out from under the tab; its twelve small cells, the refusal flash, the full-bag amber | `HUD_CELL` (the one well size the strip and the shelf share), `BAG_CELL`/`BAG_GAP`/`BAG_PAD`/`BAG_BG`/`BAG_WELL`/`BAG_TAB_H`/`BAG_SLIDE_T`, `bagEase` (chases `bagOpenNow` in `updateFx`, sim.js), `bagOpenNow`, `bagTabRect`, `bagFrameRect`, `bagCellRect`, `bagCellPlate`, `cornerMouse` (the HUD SIZE map about the top-left corner), `bagHit`, `bagClick`, `bagDenied`, `drawFoodClock`, `drawBag` | `UI` › `the backpack` |
| the character panel (G): the live body with its gear bands, the stat ledger off the live kit, the four gear pieces and their buys | `CHAR_LEDW`/`CHAR_WELL`, `charLayout`, `charHit`, `gearHit` (the piece-index read tipAt and the cursor keep using), `charClick`, `drawCharPanel` (state: `state.charOpen`, core.js) | `UI` › `the character panel` |
| carrying an item between the grid, the weapon slot and the shelf | `state.drag`/`state.dragPend`, `DRAG_SLOP`, `hudPress`, `hudMove`, `hudRelease`, `dragTake`, `dragLift` (a well's item onto the cursor), `dragReturn`, `dragDrop`, `dragDropBag`, `dragDropBit`, `dragDropSlot`, `throwCell` (the throw's heading + lock: `flingDrop`/`lockDrop`, core.js; a tool's bits: `shedBits`, tools.js), `drawDragGhost` | `UI` › `carrying an item on the cursor` (its three listeners: `input`, input.js) |
| **what a gesture answers with** — one call raising the cue, the rumble and the well's pulse together (five kinds: grab / place / seat / swap / deny) | `hudFx`, `HUD_FX`, `WELL_LIT_T`/`DRAG_LIT_T`, `wellLit`/`dragLit`, `wellLitAt`, `drawWellLit` (aged in `updateFx`, sim.js; the rumble: `haptic`, input.js) | `UI` › `what a gesture answers with` |
| **what letting go would do**, as a ring on the well under the pointer while something is carried | `dropKindBag`, `dropKindSlot`, `dropKindBit`, `DROP_RIM`/`dropRim`, `drawDropRing`, `drawDropPromise` (drawn after `drawDragGhost`, over it) | `UI` › `what a gesture answers with` |
| where the item a drop DISPLACES goes - home, which makes the drop a swap | `dragHome` (its three callers are the three `dragDrop*`; false = the ousted item rides the cursor as before) | `UI` › `carrying an item on the cursor` |
| a click or SHIFT-click SENDING an item to its one other side (bag <-> weapon, bag <-> shelf) | `sendBagCell`, `sendBitCell`, `sendSlot` (each returns whether it handled the click), `sendAt` (the shift-while-carrying hit test), `tipSend` | `UI` › `one click sends it to the other side` (resolved in `hudRelease`, refused by `bagDenied`/`toolDenied`) |
| the SHIFT key cap over the pack: where the hovered well would send what it holds | `shiftVerb` (LOAD / STOW / HOLD / null, asking `sendAt`'s wells in `sendAt`'s order), `drawShiftHint` | `UI` › `the pack's SHIFT plate` (the cap itself: `drawKeyPrompt`, `selection, hints & wheel`) |
| a keybind indicator: the key cap (the bound key's face, hover and listening states), the cap + verb prompt and its footprint, the action -> pad glyph table, the glyph worn while a pad is in hand, and the ESC BACK / CLOSE line under a slab | `drawKeyCap`, `drawKeyPrompt`, `promptW`, `PAD_BIND`, `padBindW`, `drawPadBind`, `drawBackHint` (the flight HUD's two: `drawDropBind`, boot.js; the glyph pictures: `drawPadGlyph`, panels.js) | `selection, hints & wheel` |
| what the pointer is on, said in words, bottom left | `tipAt`, `tipResolve`, `tipNow`, `tipSize`, `drawTooltip`, `TIP_*` | `tooltips` (resolved once per frame in `render`, render.js) |
| the per-kind descriptions that panel is built from | `tipBase`, `tipTool`, `tipBit`, `tipStack`, `tipCell`, `tipGear`, `tipClassAb`, `tipKind` (a wiki ARSENAL row), `TIP_PATH` | `tooltips` |
| the four gear cells of that row and their hit test | `gearRects`, `gearHit`, `drawGearCells` | `UI` › `the four gear cells` |
| the hud frame: the chamfered, bevelled, snow-capped plate the strip (with its pouch tab) and the pack both stand on | `HUD_INK`/`HUD_LIT`/`HUD_SHADE`/`HUD_SNOW`/`HUD_FROST`, `chamCut`, `drawHudFrame` | `UI` › `hud strip` › `the hud frame` |
| the hud strip (bottom-centre): the four ability wells (a pip per point, 2x key digit, dim all over while the key is locked) following, the pouch block on the right end - berry over fish, gold over cards, each a 24px square with the doubled icon, the key cap bottom-left and a `shortNum` count top-right, on a tab standing above the strip, the meals under the shared food clock, the buttons' refusal flash - over the segmented plum xp bar, with the floating buy plates bobbing above affordable wells while the strip is home (`hudInT`/`hudHome`) | `AB_CELL`/`FOOD_SQ`/`POUCH_GAP`/`POUCH_W`/`POUCH_H`/`POUCH_RISE`/`FOOD_BTNS`/`AB_SEGS`/`AB_BUY`/`LOCK_DIM`/`HUD_SLIDE`/`hudStripRect`/`hudInT`/`hudHome`/`stripCellRect`/`abCellRect`/`pouchCellRect`/`pouchTabRect`/`foodCellRect`/`goldCellRect`/`foodDenied`/`cardDenied`/`cardTotal`/`cardFanCv`/`toolDenied`/`abDenied`/`abBuyRect`/`abBuyHit`/`stripHit`/`drawClassAbCell`/`drawPouchCell`/`drawFoodCell`/`drawGoldCell`/`drawAbBuyPlate`/`drawXpBar`/`drawHudStrip` | `UI` › `hud strip` |
| the cooldown sweep: League's radial clock cut to a square, and the ONE shape every wait is drawn in - the shelf's tool cell, the four ability wells and both meal buttons (through `drawFoodClock`); rasterised a pixel at a time and coalesced into one fillRect a run, the hand dropped below 12px of cell | `drawSweepCover`/`CD_SWEEP`/`CD_EDGE` | `UI` › `hud strip` |
| the HUD SIZE scale: the 1x bake blitted about the strip's bottom-centre anchor, the pointer's map back through it, and the top-left corner's own bake | `hudSc` (capped where the strip would outgrow the view), `stripMouse`, `hudScaleCv`, `drawHudScaled`, `cornerScaleCv`, `drawCornerScaled`, `CORNER_REACH` | `UI` › `hud strip` / `the weapon shelf` |
| what the top-left corner claims of the frame, so another panel can be pinned clear of it | `CORNER_CLAIM`, `cornerClaim` (across: the widest row a tool can grow to, or the drawer), `cornerBottom` (down: the open drawer's foot) - both at the HUD SIZE, both read by `shopLayout`, shop.js | `UI` › `the weapon shelf` |
| the weapon's "it does not fit in here" red on the shelf's tool cell, the backpack's twin | `toolFlash`, `toolDenied` (aged in `updateFx`, sim.js, beside `bagFlash`) | `UI` › `hud strip` (its head, above `hudStripRect`) |
| the WEAPON SHELF top-left, up at all times - the one weapon the HUD shows: the row (cell -1 is the tool, with the sweep, the dry and refusal reds and the "!"), what the pointer is on, the rails that say which fitting reaches which shot, one well, the draw | `SHELF_CELL`/`SHELF_GAP`/`SHELF_BAR`/`SHELF_RAIL`/`SHELF_SLOT`/`SHELF_X`, `shelfRowY`, `shelfRowRight`, `shelfCell`, `shelfUp`, `shelfCellRect`, `shelfHit`, `shelfRails`, `shelfWell`, `drawShelf` | `UI` › `the weapon shelf` |
| the plate a tier is stated on, wherever an item sits, and the shine on the top one | `tierPlate`, `tierShine`, `drawItemIcon` | `UI` › `hud strip` (the tiers themselves: `TOOL_TIERS`, tools.js) |
| the hatch and cut corners that mark a MODIFIER bit apart from a projectile, in every well either sits in | `modPlate` (its callers: `drawBag`, `drawShelf`, `drawDragGhost`, `drawTooltip` ui.js, `drawShopWell` shop.js, `drawTechNode` menu.js, `drawToolPrimer` panels.js) | `UI` › `hud strip` (the `proj` flag it reads: `BITS`, tools.js) |
| the "!" a tool wears when its build weighs more than one press can swing | `drawOverWarn` (from `drawShelf` and the CONTROLS page's `drawToolPrimer`, panels.js; the answer it draws: `toolOver`, tools.js) | `UI` › `hud strip` |

| a phone's plates and sticks (js/touch.js decides), the glyph set the CONTROLS page borrows, the rotate prompt | `drawTouchControls`, `drawTouchPlate`, `drawTouchStick`, `drawTouchIcon`, `touchDisc`/`touchRing`, `drawRotatePrompt`, `TOUCH_PLATE`/`TOUCH_RIM`/`TOUCH_INK`/`TOUCH_HOT` | `touch controls` |

## js/shop.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the fish/berry market: the walk, the shocks, the rails, the three-day history, and the market's own rng stream | `GOODS`, `MKT_STEP`/`MKT_DAYS`/`MKT_HIST`/`MKT_REVERT`/`MKT_NEWS`, `mktRng`, `market`, `marketPrice`, `marketHist`, `marketWalk`, `initMarket` (called from boot.js), `updateMarket` (called once a step from `updatePlay`, sim.js) | `market` |
| a price move worth telling everyone about | `marketNews` (the good's own `news` gold floor beside `MKT_NEWS`) | `market` (the log line: `logEvent`'s colour override, panels.js; the plate: `marketNotice`, below; the cue: `SFX.market`, audio.js) |
| the market's plates top-right under the minimap: raising one, ageing it, where it sits, its pixels | `NOTE_MAX`/`NOTE_LIFE`/`NOTE_IN`/`NOTE_FLASH`/`NOTE_OUT`/`NOTE_SLIDE`/`NOTE_FR`/`NOTE_W`/`NOTE_H`/`NOTE_PITCH`/`NOTE_GAP`, `NOTE_KIND` (the palette the feed line shares), `marketNotice`, `ageNotices` (called from `updateFx`, sim.js), `noteRect`, `renderNotices` (called from `renderUI`, ui.js) | `market notices` |
| what makes a plate read as a stamped tag: the shadow, the notched corners, the bevel and the life draining along its base | `noteCard`, `noteBox` (the notched rect), `noteFrame` | `market notices` |
| the plates' own art: the two 16x16 marks (a price's sack, a turnover's crate) and the two tails | `NOTE_KIND[k].mark` picks it - `SPRITES.goldSack` (ten 16x16 grids, `sack`/`SACKPAL` in the `gold sack` section of sprites.js, resampled off `docs/media/new_media3/bag_of_gold_bouncing.png`) or `SPRITES.crate` (the 16x16 `crate`/`CRATE_PAL` in the `crate` section) - and `NOTE_TAILS` (up, down; a kind may have none) | `market notices` (the tails stamped with `stampGrid`: `the art`, screens.js) |
| the twelve offers and their turnover | `SHOP_RESTOCK`, `SHOP_COLS`, `SHOP_SECTIONS`, `SHOP_CARD_ODDS`, `shopPick`, `shopRestock`, `shopOffer` | `the counter's stock` |
| what a thing is worth, both ways | `itemValue`, `cellValue` (a tool carries its loaded bits), `sellValue` (half, except the two goods) | `buying and selling` (the prices themselves: `price` on `TOOLS`/`BITS` tools.js, `CARD_PRICE` player.js) |
| standing at a counter, and the merchant standing still to serve it | `SHOP_REACH`, `merchNear`, `inReach`, `shopServing` (read by `updateMerchant`, robots.js) | `buying and selling` |
| the trades | `shopBuy`, `shopSell`, `shopSellCell`, `shopTrade`, `shopCmd` (the `runCmd` entry, ui.js), `shopFx`, `shopDeny`/`shopNoRoom` | `buying and selling` (a sale pays through `tradeGold`, player.js - gold without XP) |
| the whole pack over the counter in one press, and the two numbers the button reads itself out with | `shopSellAll` (the bag only - the pouch and the shelf are out of its reach by construction), `packValue`, `packCount` | `buying and selling` |
| the panel: whether it is up, opening and shutting it (and the song it holds while it is), and its geometry | `shopOpen`, `openShop`, `closeShop` (`state.shop` holds the merchant itself), `SHOP_W`/`SHOP_H`/`SHOP_Y`/`SHOP_HEAD`/`SHOP_ICON`/`SHOP_WELL_*`/`SHOP_SEC_*`/`SHOP_CARD_*`/`SHOP_SELL_*`/`SHOP_ALL_*`/`SHOP_CORNER_GAP`/`SHOP_TIP_CLEAR`/`SHOP_LANE_H`/`SHOP_FOOT`, `shopLayout` (pinned clear of the corner: beside it, or under it on a tall narrow frame - `cornerClaim`/`cornerBottom`, ui.js), `shopHit`, `hitR`, `shopClick`, `shopDropSell` | `the shop panel` (the hold itself: `SFX.music.hold`/`release`, the `music` banner, audio.js) |
| the wash the whole frame goes under while the counter is up | `shopScrim`, `SHOP_WASH` (the draw ORDER that decides what stays lit is `renderUI`, ui.js) | `the shop panel` › `drawing` |
| every offer's icon at one size, whatever grid it was drawn on | `shopIconCv` (baked once each, largest whole-number scale that fits `SHOP_ICON`), `shopIconCache` | `the shop panel` › `drawing` |
| the counter's own clock along the bottom rail: the road, the countdown plate, and the merchant's wagon going out and coming back on it | `drawShopLane`, `LANE_LEAVE`/`LANE_STEP`/`LANE_PLATE_W`, `SHOP_CLOCK`/`SHOP_CLOCK_PAL` (the clock face), `shopBuggyCv` (four baked canvases: two trot frames, mirrored), `SHOP_BUGGY`/`SHOP_BUGGY_PAL`/`SHOP_BUGGY_W`/`SHOP_BUGGY_H` | `the restock road` (the clock it reads: `market.stockT`, `SHOP_RESTOCK`, the `the counter's stock` banner) |
| the sell strip's resting shimmer | `sellSheen`, `SELL_SHEEN`/`SELL_SHEEN_W` | `the shop panel` › `drawing` (called from `drawSellWell`) |
| the SELL ALL button at the strip's right end, and the pack it draws to say what it empties | `drawSellAll`, `drawPackGlyph`, `PACK_GLYPH_W`/`PACK_GLYPH_H` | `the shop panel` › `drawing` |
| its pixels | `drawShopPanel`, `drawShopSign`, `drawShopHeading`, `drawShopSection`, `drawShopWell`, `drawSellWell`, `drawSellAll`, `drawMarketCard`, `drawMarketGraph`, `drawTradePlate`, `drawTradeArrow`, `drawTrend` | `the shop panel` › `drawing` (the `E SHOP` cap over the body: `drawShopHint`, ui.js) |
| the TRADING POST's own chrome: the timber frame and its iron brackets, the team-striped awning with its snow, scallops and icicles, the counter edge, and the two lanterns flanking the sign | `shopChromeCv` (baked once a side, keyed by team), `drawShopLantern`, `SHOP_WOOD_*`/`SHOP_CLOTH_*`/`SHOP_SNOW*`/`SHOP_LAMP*`/`SHOP_IRON*`/`SHOP_SIGN` | `the shop panel` › `drawing` |
| what the pointer is on there, in the shared descriptor shape | `tipShop` | `the shop panel` › `tooltips` (`tipBase`/`tipTool`/`tipBit`/`tipStack`: `tooltips`, ui.js) |

## js/panels.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the TAB standings, the event log (kept, not drawn) | `logEvent`, `events`, `scoreGroups`, `renderScoreboard` | `scoreboard & log` |
| the M map: the chart's class map, its flatten and its resample into the slot, the inks and rims and stipple, the marks, the header's day and CLOSE plank, and the chart point -> world tile inverse a map order needs | `buildMapPanel`, `buildWorldMapImg` (throttled to `MM_REBUILD` ticks), `chartGround`, `chartGrain`, `chartSpan`, `CHART_INK`/`CHART_RIM`/`CHART_LIT`/`CHART_GRAIN`/`CHART_NEED`/`CHART_DARK`, `MAP_HEAD_Y`/`MAP_HEAD_H`, `mapAlloc` (the buffers and the bake at the slab's current size), `drawParchButton`, `mapCloseRect`/`mapCloseHit` (read by `pointerPress`, input.js, and the cursor), `renderWorldMap`, `mapTileAt` | `world map (M)` (the class a tile files under comes from `objChart(o)`: `world`, world.js; the marks: `drawMap*`, draw-world.js) |
| the ESC menu: its tabbed pages, their rows (a choice row's `val`/`pick`), the scroll, the keys that page and scroll it, the layout every reader shares | `SET_TABS`, `settingsLayout`, `settingsScrollBy`, `settingsTabBy`, `settingsKey`, `setTab`/`setScroll`, `buildSettingsPanel`, `settingsHit`, `settingsMouseDown`, `renderSettings` | `settings menu (ESC)` |
| the CONTROLS page's three listings (keyboard / gamepad / touch), its pinned sub-navbar, which opens by default, the pad glyphs, the live pad readout under the GAMEPAD listing | `PAD_READ_Y`/`PAD_READ_H`, `drawPadReadout`, `CTRL_TABS`, `CTRL_TAB_H`, `ctrlTab`/`ctrlTabNow`, `ctrlCvs`, `bakeCtrlKeys`/`bakeCtrlPad`/`bakeCtrlTouch`, `drawPadGlyph` (the touch icons: `drawTouchIcon`, ui.js) | `settings menu (ESC)` |
| the KEYBOARD listing's live caps - the rows, their layout, the draw, and the `'key:<action>'` / `'keyreset'` hits | `KEY_ROWS`, `KEY_ROW_H`/`KEY_ROWS_Y`/`KEYS_PRIMER_Y`, `keyRowsLayout`, `drawKeyRows` (the click: `settingsMouseDown`; the listen itself: `rebindStart`, input.js) | `settings menu (ESC)` |
| the exit plank under the in-match slab: LEAVE PRACTICE or LEAVE MATCH | `leavePlankRect` (the clicks: `leavePractice`, menu.js; `toLobby`, screens.js) | `settings menu (ESC)` |
| the CONTROLS page's weapon primer: the worked build it draws and the marks it borrows from the HUD | `PRIMER`, `PR_CELL`/`PR_GAP`/`PR_X`/`PR_TX`, `drawToolPrimer` (baked once into `ctrlCvs.keys`) | `settings menu (ESC)` › beside `bakeCtrlKeys` |
| the VIDEO page's quality macro over the render-pass toggles | `VID_PRESETS`, `vidPreset` (the flags themselves: `settings.vid*`, core.js; their gates sit at each pass's call site) | `settings menu (ESC)` |
| the three sound dials, the speaker that mutes them, the grey-when-muted fill, the minimap and HUD size knobs (HUD SIZE edits `hudScaleKey()`'s field - the phone's own on a phone) | `applySliderDrag`, `muteBtnRect`, `drawMuteBtn`, `drawSliderRow`, `drawSliderById`, `toggleVal` | `settings menu (ESC)` |
| the PLAYER panel: the name field, its validation, the two planks | `openNamePanel`, `nameKey`, `nameOk`, `nameCommit`, `nameDismiss`, `namePanelHit`, `renderNamePanel`, `buildNamePanel` | `player profile` |
| the profile name bottom-left of the title screen, and the player that wears it | `nameTagRect`, `overNameTag`, `drawNameTag`, `applyProfileName` | `player profile` |

## js/menu.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the title screen: buttons, die, panels, play intro | `menuLayout`, `drawMenuButton`, `drawPillar`, `rerollWorld`, `beginIntro`, `renderTitle` | `main menu` |
| class select: the painted night, the two roster columns (your side left, rivals right, face-down until the count), the rivals' difficulty notches, PLAY in the title plank's place, the one-class stage with hoverable ability tooltips flanked by the emblems and the gear widget, the five-second count to the eagle (a second PLAY skips it) | `selectLayout`, `selectHit`, `selectAbilHit`, `CLASS32`/`classIcon32`, `drawSelectBackdrop`, `drawSelectPortrait`, `drawSelectStage`, `drawSelectCard`, `drawSelectRosters`, `drawSelectCount`, `renderSelect`, `selectClass`, `pressPlay`, `cancelCount`, `selectRevealed`, `setAiLevel`, `lockIn`, `COUNT_T`, `SEL_ROST_X` | `main menu` › `class select` (the levels' names: `AI_LEVELS`, ai.js) |
| the practice plank's breakable ice, and entering/leaving the arena | `menuFrozen`, `ICE_FLAW`, `iceRefuse`, `breakPracticeIce`, `beginPractice`, `leavePractice` | `main menu` (the resting crack `ICE_FLAW` and the standing knock cracks `menu.iceMarks`, both drawn in `drawMenuButton`) |
| the patch tag and its notes panel | `PATCH_TXT`, `PATCH_NOTES`, `buildPatchPanel`, `patchTagRect` | `main menu` |
| picking variants pre-match: the pop-up over class select - live preview, stat ledger with hover deltas, twelve 32×32 icon wells, the equip flash | `gearLayout`, `gearScreenHit`, `pickGear`, `renderGear`, `drawGearWell`, `drawGearPreview`, `gearPreviewKit`, `GEAR_STATS`, `GEAR32`/`gearIcon32`, `beginGear`/`leaveGear` | `main menu` › `the gear pop-up` (the numbers' base: `baseKit`, player.js) |
| the wiki: its pages as data, the slab, tabs, window and rail, the per-page scroll, what is under a point, the way in and out | `WIKI_PAGES`, `WIKI_W_MAX`/`WIKI_H`, `wikiScroll`, `wikiBlocks`, `wikiPage`, `wikiLayout`, `wikiHit`, `beginWiki`/`leaveWiki`, `wikiScrollBy`, `wikiSetTab`, `wikiKey`, `wikiClick`, `renderWiki`, `drawWikiRail` | `main menu` › `the wiki` (the tooltip a row raises: `tipKind`, ui.js; the wheel: input.js; its song WHISPERING WOODS: `TRACKS.wiki`, audio.js) |
| the BEASTS page: the five cards, a kind at a level, the figure wearing its frame, the labelled legend | `WIKI_BEASTS`, `WIKI_LEVELS`, `wikiBeastHp`, `wikiBeastGold`, `drawWikiBeast`, `wikiLeader` | `main menu` › `the wiki` (the numbers: `ANIMAL_HP`/`ANIMAL_LV_HP`/`ANIMAL_LV_GOLD`, wildlife.js; `YIELD`, core.js) |
| the ARSENAL page: the three tables' columns, the kinds of a sort worn to gilded, a row on its tier plate | `WIKI_TOOL_COLS`/`WIKI_BIT_COLS`/`WIKI_MOD_COLS`, `wikiKinds`, `drawWikiRow` | `main menu` › `the wiki` (the kinds themselves: `TECH`, `TOOLS`, `BITS`, tools.js) |
| the CLASSES page: an ability row's columns, the four stat pips, the word-wrap the blurbs use, the `cls` and `ab` draws in `renderWiki` | `WIKI_AB_COLS`, `WIKI_STATS`, `wikiWrap` | `main menu` › `the wiki` (the classes and kits: `CLASSES`, player.js; the abilities: `CLASS_AB`, `classAbIcon`, abilities.js; the card a hover raises: `tipClassAb`, ui.js) |

## js/screens.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the rolling four-second replay: the capture ring, its resolution, the full-frame recap on a death and the corner window on pause, the recap's close box and its ESC, the `#replay` overlay | `replayTick`, `rpTarget`, `rpEnsure`, `replayShowing`, `rpFull`, `replayFull`, `replayClose`, `rpRect`, `rpCloseRect`, `rpCloseHit`, `layoutReplay`, `renderReplay`, `RP_*` | `replay` |
| the death overlay and the respawn wait, spectating, back to the lobby, who the camera frames, the planks every ending shares | `DEAD_ITEMS`, `deadItems`, `endScreen`, `viewPlayer`, `specOk`, `specNext`, `toLobby`, `openDefeat`, `drawRespawnLine`, `renderDead`, `deadKey`, `deadClick`, `deadLayout`, `deadReady`, `endSkip`, `drawEndPlanks` | `death & spectate` (`endMatch`/`endSnapshot`: `damage & death`, player.js) |
| the victory screen: its timeline, the side's stands, its sound cues, its art, and the passes both endings share | `WIN_T`, `WIN_BODY`/`WIN_TIER`/`WIN_BANNER_W`/`WIN_BANNER_H`, `winLayout`, `winStands`, `winCues`, `tallyCues`, `renderVictory`, `stampGrid`, `drawWinAurora`, `drawWinRays`, `drawWinMotes`, `WIN_CREST`, `mixHex`, `winBannerCv`, `drawWinBanner`, `drawBrazierIron`, `drawWinBrazier`, `drawWinDais`, `drawEndStatPlate`, `drawEndTally` | `victory` |
| the defeat screen: the loss's own summary, on the same anchors and stands | `DEF_T`, `DEF_STATS`, `defCues`, `renderDefeat`, `drawBlizzard`, `drawDefeatDrift`, `drawDeadBrazier`, `DEF_ARROW` | `defeat` |

## js/boot.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the twin eagle rides down the fixed corner-to-corner diagonal, the wing seats and the merchant's neck seat, the jump window and its lock, a bot's treeline-safe forced drop, riding the landing and the E hop off the roost, free fall, landing, the flight bar, the dotted path, the wind trail, the zoomed-out view | `diagEnd` (and the corner's `mouth` it returns; `e.mouth` itself is the spur's junction, `roadNest`, world.js), `makeEagleRoute`, `forestDepth`, `lastOpenU`, `makeEagles`, `eagleScale`, `riderScale`, `riderDir`, `drawSeated`, `seatPos`, `MERCH_SEAT`, `beginDrop`, `dropJump`, `landPlayer`, `handOver`, `landAboard`, `hopOff`, `HOP_FALL_T`/`HOP_ALT`, `drawHopPrompt`, `updateDrop`, `updateEagle`, `drawDropAir`, `TRAIL_T`/`TRAIL_STEP`/`TRAIL_RIM`/`TRAIL_TIP`/`TRAIL_TIP_AMP`/`TRAIL_BACK`/`TRAIL_BACK_AMP`, `drawEagleTrail`, `drawEagle`, `renderDropUI` | `eagle drop` |
| the drop brief: the roost tour a landing ridden to the crash opens on - the phase machine (a beat, the rival roost, then your own to finish), the camera's aim, the two headlines, the DAY 1 it hands back to | `state.dropBrief` (core.js), `BRIEF_WAIT`/`BRIEF_HOLD`/`BRIEF_HOLD_OURS`/`BRIEF_GO_MIN`/`BRIEF_MAX_T`, `endBrief`, `dropBriefTarget`, `drawDropBrief` (the glide: the camera banner, sim.js; the control zeroing: `sampleHumanInput`, input.js) | `eagle drop` |
| the banking dive off the road onto the nest, the tree-shattering impact, the SPUR it fells straight back to the road pine by pine and paves behind the front, and the roosting objective: its wing-gust defense, its preen regen, and the driven-off ceremony that ends the match | `beginDive` (the bank: `e.diveH0`/`e.diveTurn`), `CRASH_DEPTH`/`MIN_CRASH_TREES`, `findCrashPoint`, `eagleCrash` (sets `e.laneDir`, the spur's direction toward `e.mouth`, and registers `e.spur`), `LANE_R`/`LANE_SPD`/`LANE_WARN`/`LANE_DELAY`/`LANE_MAX`, `laneFells`, `planLane` (the `pave` list), `laneStep` (the paving), `eagleBoomFx`, `eagleGust`, `eagleGustFx`, `hurtEagle`, `eagleFlee`, `eagleFleeResolve`, `teamEagleDown` (the driver it drops off: `spawnMerchant`, robots.js) | `eagle drop` |
| boot order (the saved TOUCH MODE re-fits the view), `DBG`, the rAF loop (which polls the pad and the fingers before each step) | `startGame`, `loop` (`padPoll`, `touchPoll`), `window.DBG` | `boot` |
