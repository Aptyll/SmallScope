# js/draw/recall.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| each down bird's healing edge (its moulted feathers lying along the rim in a pale tint of its side's colour, baked per side: `ROOST_*`, `roostEdgeArt`; the soft glowing rim `roostRingArt` is the pump's), and the recall's feathers round a channelling body (feathers in a pale tint of the side's colour, rocking as they drift down and turning round it, read off `p.recallT`) | `ROOST_GLOW`, `circlePts` (a midpoint circle's pixels), `roostRingArt`, `drawRecallGround` (before `drawClickMarks` in `render()`), `RECALL_FEATHERS`, `FEATHER_*`, `drawRecallFeathers` (from `drawPlayer`, behind the body and over it), `BACK_*`, `drawBackFeathers` (the feathers falling away round a body the bird just set down, off `p.backT`: a respawn, the recall's far end) | `recall's pixels` (the state: js/sim/recall.js) |
