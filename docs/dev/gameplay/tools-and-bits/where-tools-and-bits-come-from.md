# Where tools and bits come from

**Nothing drops a tool or a bit.** A rock pays gold and ore, a felled tree gold, and
a sprung chest gold, a card and a free item part (`chestPart`, [the items](../the-merchants-counter.md#the-items)). The
weapon a player fires is the class loadout ([below](starting-loadouts.md)); the `TOOLS` / `BITS`
engine still runs it. The [counter](../the-merchants-counter.md) sells no tools or bits; it buys them
back at half their `price`.

**A found bit arms itself.** The pack is the overflow, not the destination: a bit walked over
goes into a free cell of the tool, and only what the tool cannot
hold lands in the grid. **Anywhere it lands, it works** (`fitBit`): it takes a free cell and
`sortBits` seats it on its own side — a shot at the end of the shots, a fitting at the front of
the fittings — and since every fitting powers every shot, a find is never wasted — `fitAdd(p, type, n)`, with `fitRoom(p, type)` the room it counts, which
is why a FULL pack with an empty bit cell still magnetises a drop and still claims it. The drop
pickup (js/sim/sim.js) goes through the pair, so the ordinary way to
arm a find is to walk over it. It fills a free cell whatever the load (a heavy build only pulls
slower), and a **bot is left out** — `botFitLoadout` does this for them on its own timer and is choosier
about it, so a pickup that shoved a bit into a bot's tool would only make it a worse shot.

**And a strictly better body takes the build with it.** A tool walked over swaps itself straight
into the hand when two things are true at once: its **tier is higher** than the one held, and its
`cap` is **at least as big**, so nothing already loaded is left with nowhere to sit
(`toolUpgrade`). Then `takeUpgrade` moves the bits across and `sortBits` lays them out again,
shots left and fittings right, the new open cells between them — and the old body is treated exactly as the find was a moment earlier: into the pack, or
into the snow it was lying in if the pack is full. That last part is why a **full pack is still
room** for an upgrade (`roomFor`, the drop loop): the pickup is an exchange, not an addition.

It runs for **every** player, bot included, off the same two functions, and it is the one thing in
the game that rearms somebody with no hand on the weapon — which is why it carries a tell of its
own, drawn rather than announced: a ring in the new tier's colour opens out of the body and the
new tool's own icon rises out of it (`swapFx` → [`drawSwaps`](../../rendering/render-pass-order.md#the-tool-swap)), for
everyone on screen. Nothing is refused and nothing is lost: a same-tier find, or a higher-tier body
with fewer cells than the build needs, is an ordinary pickup into the pack.
