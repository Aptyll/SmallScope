# Show, don't label

The HUD and screens speak through shape, colour and hover state: an icon beside a number, an arrow
that is clickable, a colour that carries the team, a plank that lifts on hover, never "CLICK OR
ARROWS TO SWAP" or "PLAYERS LEFT: 5". A control must read as what it does by its shape and hover
state alone; a hint sentence is a sign to build the affordance instead. Text is for names, numbers,
headlines (a death, a camp) and five deliberate carve-outs:

- **Keybind indicators** (`'ESC BACK'`, a "1" in a slot's corner). They name an *action*, print
  whatever key it is bound to (`keyCap`, input.js) and wear the pad's button while one is in hand
  (`PAD_BIND`, ui/wheel.js), so a new one goes through `drawKeyPrompt`/`drawPadBind`.
- **The settings, PLAYER, hero, character and shop panels'** labelled rows.
- **The instruments**: the practice room's (the dummy meter, the parkour lap clock, the archery
  round's readouts and their BEST / LAST plates) and the [stat sheet](the-hud-corners/the-stat-ledger-your-sheet-as-a-notice.md). An instrument's whole job is comparing numbers.
- **The [hover tooltip](the-hud-corners/the-hover-tooltip.md)** (`tipAt`/`tipPos`/`drawTooltip`, ui/tooltip.js), because
  comparing an attack's speed against an item's stats is comparing numbers, and no shape does
  that. It is a carve-out, not a licence: the well still has to read at a glance without it.
- **A bot's callout** (`drawCallPlate`, js/draw/callouts.js): a teammate talking, a glyph and one
  or two words (HELP!, BEAR LOW!) on a plate over its name, because a bot that can't speak is
  a bot a human can't play beside ([bot callouts](../multiplayer.md#bot-callouts)).

Anything else that wants words is a design bug.
