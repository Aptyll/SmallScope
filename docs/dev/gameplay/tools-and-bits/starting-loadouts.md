# Starting loadouts

`CLASS_LOADOUT` gives each class a tool and its bits, and `giveLoadout(p)` is called from
`Player.reset()` on the **first** landing and from `setClass()` — so the weapon is part of picking
a class and every AI player gets its own. A respawn keeps the weapon it died holding
([Death and respawn](../death-and-respawn.md)); `reset(false)` only hands the kit over again when every
weapon slot is bare, so nobody is set down with nothing to fire. Each class flies in with **one projectile and
nothing else**: the HUNTER a SHORTBOW loaded ARROW, the WARRIOR a LONGSWORD with a BARBED SHOT on
its edge — the one **melee** body ([the cut](the-cut-a-melee-tool.md) below).

**The shot sits in the first cell and the rest are left open** (`giveLoadout` runs `sortBits`),
so the first fitting anybody picks up has somewhere to go — a SPLITTER walked over turns that one
arrow into three on the very next press. The hero pop-up's preview
shows the weapon at the body's side (`drawHeroPreview`, js/ui/menu.js) — the other half of what a
class flies out with.
