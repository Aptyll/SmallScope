# js/draw/abilities.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| every wind-up's shape on the snow (the pierce/charge line, the stomp ring, the slam/execute wedge), and the sword's sweep over the bodies | `drawWedge`, `drawRing`, `drawTeleLine`, `drawSlashes`, `drawAbilityGround` | `ability pixels` › `drawing: the world layer` (the fx list and `teleLen`: js/sim/abilities.js) |
| drawing it all: ground layer, air layer, the pose on the sprite, the states on a body | `drawAbilityGround`, `drawAbilityAir`, `abilityPose`, `drawAbilityOnPlayer` | `ability pixels` (called from js/draw/render.js and `drawPlayer`, js/draw/bodies.js) |
| the net drape, the root's jaws, the flames and the mark's chevrons, on ANY sprite at its own size | `drawUnitStates` | `ability pixels` (its four callers: `drawAbilityOnPlayer` here, `drawAnimal`/`drawBird`/`drawRobot`, js/draw/bodies.js) |
| the twelve 32×32 ability icons (the eight firsts, the warrior's four others) and their bake per option | `AB32`, `AB32_ALT`, `AB32_PAL`, `classAbIcon(cls, i, k)` | `ability pixels` › `the strip icons` (drawn by `drawClassAbCell`, js/ui/hud-draw.js, and `tipClassAb`, js/ui/tooltip.js) |
