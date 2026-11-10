# js/draw/abilities.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| every wind-up's shape on the snow (a row's own `tele`: the line, the ring, the wedge) and the flash where a blow landed, and the sword's sweep over the bodies | `drawWedge`, `drawRing`, `drawTeleLine`, `drawSlashes`, `drawAbilityGround` (from js/draw/passes.js; the heroes' own marks under it: `heroGround`, js/sim/heroes.js) | `ability pixels` › `drawing: the world layer` (the fx list and `teleLen`: js/sim/abilities.js) |
| the pose a cast, a dash or a knock-up puts on the sprite, and the states on a player's body | `abilityPose`, `drawAbilityOnPlayer` | `ability pixels` › `drawing: on the body` (called from `drawPlayer`, js/draw/bodies.js) |
| the root's jaws, the flames and the mark's chevrons, on ANY sprite at its own size | `drawUnitStates` | `ability pixels` › `drawing: on the body` (its callers: `drawAbilityOnPlayer` here, `drawAnimal`/`drawRobot`/`drawMerchant`, js/draw/bodies.js, FABER's machines, js/draw/faber.js) |
| the 32×32 ability and passive icons: each row's `icon` grid (`ARM_ICON32` and the rest) baked in one palette on first ask | `AB32_PAL`, `bakeAb32`, `classAbIcon(cls, i)`, `passiveIcon(cls)` | `ability pixels` › `the strip icons` (drawn by `drawClassAbCell`, js/ui/hud-draw.js, and `tipClassAb`, js/ui/tooltip.js) |
