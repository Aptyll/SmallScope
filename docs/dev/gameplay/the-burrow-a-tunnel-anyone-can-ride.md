# The burrow: a tunnel anyone can ride

A rabbit's kill leaves a **burrow** one time in four (`TUN_DROP`), carried as a stack in a pack
cell (`ITEMS.tunnel`, stack 5; a full pack leaves it in the snow) and on no hud cell of its own.
Used (V, or a click on its cell in the drawer), it stands a **hole ghost** on the tile under
the pointer, the build list's grammar (`tunnelAimToggle`/`drawTunnelGhost`): the builder's reach
dotted round the body, green where `tunPlaceOk` says it can go (inside `BUILD_REACH`, on open
snow or the road, nothing standing there), red where not. A left press sends the `tunnel` order
(`runCmd` → `digTunnel`); the key again, the right button or Escape puts the ghost away.

The order lays the **near hole** (`OBJECTS.tunnel`, a tile object that knows its `mate`, its
digger and side, and `crumble`) and starts the dig: for `TUN_DIG` (10 s) the digger runs, and
wherever they stand when it ends — or the nearest free tile within `TUN_FAR` (2) — the **far hole**
opens (`updateTunnels`). Nowhere free puts the burrow back in the pack (or at the digger's boots
when the pack is full). While the ghost is up its cell is framed gold, and while the far end is
dug a gold fill drains up out of it. A tunnel can end anywhere
on the map. **One tunnel a digger**: a new dig caves the old one, and a digger who goes down before
the far end opens loses the near hole too. A finished tunnel outlives its digger
(`p.tunHole` is not cleared by `reset()`).

**Anyone takes a hole**, of either side, and many can be under at once: a fresh press of the work
key standing on it (`TUN_ON`, 9 px; `tunnelEnter`, ahead of the swing in `playerSwing`, a step of `updatePlayer` — a key held
from before stays the swing's). Underground the body is out of the world — `inAir` answers true
for `p.tun`, so nothing hits it, nothing it wants gets through, and every loop over players skips
it — and it rides the line between the holes at `TUN_SPEED` (240 px/s, at least `TUN_MIN_T`)
as a **mound of snow** every player can see, with its side's pip and a churned furrow behind it.
It comes up `TUN_UP` px above the far hole, so the hole lies in front of its boots, and waits
`TUN_CD` (3 s, `p.tunCd`) before any hole takes it again. Bots do not take holes yet.

A **rival standing on a hole** for `TUN_BREAK` (3 s, `h.crumble`, which drains back when they step
off) caves the whole tunnel. Every state is drawn on the hole (js/draw/tunnel.js): a ring of dots
draining **gold** is a dig running out (the same ring under the digger's boots, so a rival sees
where it comes up), one filling **pale blue** is your own wait, and a hole that shrinks and shakes
is caving. Standing on a hole you can take, the work key's bare cap rises over it
(`drawTunnelHint`).
