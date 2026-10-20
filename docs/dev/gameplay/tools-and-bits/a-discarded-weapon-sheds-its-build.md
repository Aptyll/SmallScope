# A discarded weapon sheds its build

The counterweight to the pack being the overflow: **a tool that lands in the snow arrives bare.**
`shedBits(cell, x, y, hx, hy, p)` (js/sim/tools.js) empties the row as the tool goes down, spawning
every loaded bit as its own drop flung along `hx`/`hy` — whatever threw the tool — plus a
`SHED_KICK` of its own, so what lies there is a body in a scatter of fittings. The one ground-drop
path calls it: the [drag out onto the world](the-weapon-shelf.md) (`throwCell`, js/ui/bag.js). A
death puts nothing down ([Death and respawn](../death-and-respawn.md) — the body keeps its build), so
the throw is the only caller; **any new ground-drop path for a tool must call `shedBits` first**,
or a thrown tool becomes the way to hand over a whole build in one gesture. Emptying the instance
at that one moment is not the rebuilding-from-type the [hard rule](../../../../CLAUDE.md#hard-rules)
forbids.
