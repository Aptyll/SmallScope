# Text over the world

White pixel text on a white snowfield is unreadable with a drop shadow, so text over the world
wears an **outline**: `drawPixelTextOutline(ctx, text, x, y, color, outline, scale)` in
[font.js](../../../js/app/font.js) stamps the glyph at the eight 1-px integer offsets in the outline
colour, then once in the text colour — a solid rim on every side, exactly 1 game px at any text
scale, no blur. The outline colour is `#0f1632`. Every string is baked once into
[the string cache](../architecture.md#fontjs) and stamped as one image after that, so the nine
passes never overlap on the target. Which call reaches it depends on the pass:

- **In a world pass** (anything drawn while `ctx` is `wctx`) **call
  `drawWorldText(text, x, y, color, scale, alpha)`** (the `ink over the world` banner,
  js/draw/light.js), never the outline directly. It **queues** the glyphs, carrying the
  `globalAlpha` standing at the call (a buried head's fade) times its own `alpha` (a floater's),
  and `renderLighting` stamps the queue after the night grade — draw the outline in place and
  the tint sinks a team colour into blue snow. The queue itself:
  [Light and weather](light-and-weather.md). Sites: floaters (damage numbers, gold, `LEVEL n`),
  the overhead name tags, `MERCH`, the roost's `PERCH` (2x), the noticed `!` (`drawSenseMark`).
  Called from a UI pass (the wiki's animal page) it draws the outline where it stands. Names on
  the ground **overlap**, as League's do: a crowd's tags stacked into a tower read worse. The one
  exception is **a wing of riders** (`seatedName`: the riders seated on a bird; in flight only your own name rides it), queued
  through `drawNameTag` - the same queue, marked as a tag: before stamping, `settleNameTags` keeps
  the lowest tag on screen where it is and climbs any tag that would touch a placed one until it
  clears (`TAG_GAP`, at most `TAG_CLIMB` climbs).
- **In a UI pass** call `drawPixelTextOutline` directly: the radial-wheel labels, the strip's
  counts, the clock under the minimap (the rail's clock is on its own well, `drawPixelText`), `state.msg`, the DAY headline's bake,
  the info stack, and the drop-UI text. A keybind prompt's verb is outlined by `drawKeyPrompt`
  (js/ui/wheel.js) itself.

`drawPixelTextShadow` (a single bottom-right 1 px shadow) remains for text sitting on a panel,
plank or overlay — the settings/map panels, the main menu, the death overlay and the scoreboard —
where a full outline reads heavy. Checked at noon on open snow and at
full night. Either kind fades evenly under a `globalAlpha` (the cache stamps one opaque image),
so the choice between them is only weight: a rim over the world, a shadow on a panel.
