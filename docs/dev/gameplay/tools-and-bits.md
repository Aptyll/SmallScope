# Tools and bits

Everything in this section lives in **[js/sim/tools.js](../../../js/sim/tools.js)**, under the `tools & bits`
banner. It loads after `actions.js` because a shot it fires is the arrow pipeline's, and its
top-level code registers one `ITEMS` row per kind — which is what makes the bag, the drop pickup,
the throw and the refusal flash work on tools and bits with no storage code of their own.

**There is ONE weapon slot** (`p.tools`, `TOOL_SLOTS` = 1 — the array and the drag plumbing stay
generic over it), and the left button fires it. Keys 1-4 belong to the
[class abilities](class-abilities-keys-1-4.md). The slot holds a **tool**; a tool holds
**bits**; the bits are what actually fly. Neither drops in the world: a player fires the class
loadout ([Starting loadouts](tools-and-bits/starting-loadouts.md)), and [the counter](the-merchants-counter.md) buys
either back.

## Parts

- [A tool](tools-and-bits/a-tool.md) (2 KB)
- [A bit](tools-and-bits/a-bit.md) (7 KB)
- [Firing](tools-and-bits/firing.md) (4 KB)
- [The cut: a melee tool](tools-and-bits/the-cut-a-melee-tool.md) (2 KB)
- [Flight paths](tools-and-bits/flight-paths.md) (6 KB)
- [The weapon shelf](tools-and-bits/the-weapon-shelf.md) (4 KB)
- [What a gesture answers with](tools-and-bits/what-a-gesture-answers-with.md) (3 KB)
- [Where tools and bits come from](tools-and-bits/where-tools-and-bits-come-from.md) (3 KB)
- [A discarded weapon sheds its build](tools-and-bits/a-discarded-weapon-sheds-its-build.md) (1 KB)
- [Tiers, and how a find reads](tools-and-bits/tiers-and-how-a-find-reads.md) (2 KB)
- [Bots](tools-and-bits/bots.md) (1 KB)
- [Starting loadouts](tools-and-bits/starting-loadouts.md) (1 KB)
