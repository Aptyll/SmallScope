# A tool

One entry in the `TOOLS` table (`shortbow`, `sling`, `longsword`, `recurve`, `hornbow`, `longbow`). A tool is a
**body** and carries no behaviour of its own — three numbers and a look (plus, on the one blade,
a `melee` block: [the cut](the-cut-a-melee-tool.md)):

| field | means |
| --- | --- |
| `rof` | game steps between shots. `toolRof(p, cell)` turns it into seconds and scales it by `kit.nock / BOW_NOCK`, so every card that shortens `kit.nock` (QUICKDRAW, QUICK HANDS, FLETCHER'S TOUCH, RELENTLESS) quickens it |
| `cap` | how many bit cells it has (2–5) |
| `tensile` | **how much weight it draws at the normal speed**: a loaded weight past `DRAW_EASE` (half) of it lengthens the pull to full power ([the draw](../the-swing-tools-e.md#the-draw)). Nothing is ever cut: every loaded bit fires |
| `tier` / `art` | which of the three `TOOL_TIERS` palettes it wears, and which 12×12 silhouette (`bow`, `sling`, `sword`, `recurve`) |

`cap` and `tensile` are the two halves of a tool: **cap is how much you may hang on it, tensile
how much of that it pulls easily.** The tiers grow the two together at roughly four weight a
cell — SHORTBOW 9/2, SLING 10/2, LONGSWORD 10/2, RECURVE 13/3, HORN BOW 15/4, LONGBOW 22/5 — so a
heavy build on a light body is never refused or cut short, it is only *slower to pull*.

A tool is **instanced**: its bag cell *is* the tool, `bits` array and all (`makeTool`), so it is
moved between bag, slot and drop rather than rebuilt from its type name — see the hard rule in
[CLAUDE.md](../../../../CLAUDE.md#hard-rules). `spawnDrop`'s `it` payload is the same object the bag had,
and `bagPut` puts that same object back, so nothing about a build is ever reconstructed.

The one exception is a tool that lands in the snow, which arrives bare:
[a discarded weapon sheds its build](a-discarded-weapon-sheds-its-build.md).
