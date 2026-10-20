# js/sprites/perch.js (IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| what each bird skin wears (the classic, ironclad and the four war eagles' helm, crown and arm armour) and their colours | `LOOKS`, `war`, `palette` | `palettes` |
| the shape tests on the 112 grid and their bounds | `rell`, `blade`, `poly`, `rect`, `box` | `shapes` |
| the bird itself: tail, talons (on the ground only), wings and arm armour, body, saddle, the arrow head with its helm and crown | `build`, `saddle`, `head`, `HEAD` | `the bird` |
| the poses: the roost's beats, level flight's stroke, the stoop (tuck, hold, flare), the takeoff; how a pose moves a part, the per-part map onto a frame, where a seat lands, the wing's light | `POSE`, `REST`, `stroke`/`STROKE_N`, `dive`/`DIVE_N`/`TUCK`/`FLARE`, `LIFT`, `mover`, `placer`, `sizeOf`, `litStep`, `HINGE`/`SHOULDER`/`WRIST`/`FOLD`/`ZK` | `poses` |
| filling the parts at a heading and size, the shading rules, the outline, the snow shadow, the flying shadow's mask | `paint`, `SHADOW` | `painter` |
| the frame cache (urgent and slow queues, the held frame), the riders' seats, the skins cards and the wiki figure, what drawEagle asks | `frame`, `shadow`, `put` (a trimmed frame at its whole frame's top-left), `flash`, `reach`, `warm`, `tick`, `seat`, `icons`, `figure`, `TURNS`/`KEEP`/`BUDGET`/`IDLE_GAP`, `SPRITES.perch` (`has`, `merchSeat`), `SPRITES.birdSkinIcon` | `cache` |
