# js/draw/idle.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a hero standing still: its two breath frames on each body's own phase, and its loose cloth (a look's `cloth` boxes and `hem` rows) a pixel behind for the beat after a stop or a turn, kept per body on this screen; the frames themselves are `heroBreath` and `heroCloth` (js/sprites/armatos.js), baked as `set.breath` and `set.cloth` by `champLook` | `idleTick`, `idleFrame`, `idleBreath`, `idleCloth`, `idleShown` (`drawPlayer`, bodies.js; ARMATOS's standard, `drawHeroBack`) | `idle` |
