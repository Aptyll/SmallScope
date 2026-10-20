# Tiers, and how a find reads

`TOOL_TIERS` is a colour and nothing else in the sim: what a tier buys you is written into each
tool's own numbers. The three read worse to better as **dim green, bright blue, bright gold**
(WORN, KEEN, GILDED). The tier is stated in **one** place and the same way everywhere — the 1px
rim round a dark plate, in every well the item ever sits in (bag cell, the shelf's weapon
well, drag ghost, loadout card) — which is why nothing on screen has to say "TIER 2". `tierPlate(type)` is
that lookup and `itemTier(type)` the raw index. Nothing shines or moves.

**Which of the two kinds of bit it is is stated on that same plate**, by `modPlate` (js/ui/hud-draw.js),
called wherever a bit sits — the pack's grid, the cursor, the tooltip's own icon plate. A **projectile** keeps the flat square plate every carried item
wears: it is a thing you fire. A **modifier** gets its plate hatched, inset 2px so the rim stays
one clean line, in its rarity's colour — it never flies, it is fitted *into* the tool — so the two
are told apart across a whole grid without recognising a single glyph. Colour is already spent on
tier, which is why the difference has to be texture. Weight has no mark on a cell; it shows as the
length of the draw. The 8×8 glyph (`BIT_ART`, js/sim/tools.js)
then says what the bit *does*, in the same two grammars: a **shot** is drawn as the thing that
flies, tip to the upper right like every other shot icon (the arrow; the barbed shaft; the
return loop of the hookshot; the gold arrow with a light for a head; the comet wisp; the cut
log; the icicle; the fist thrown with speed lines; the axe; the portal and the dotted line to
it), and a **fitting** as what it does to the shots, never a lone shaft (fast-forward
chevrons; one shaft coming apart into three tips; the same arrow
twice; a dumbbell; a head at the end of a long dashed flight; a flame, a banked fire on logs, an
impact throwing embers). On the ground a find glints in its tier's colour so it is
told from a berry at a distance. A tool's **shape** says which weapon it is and its **palette**
says its tier: six 12×12 silhouettes (`TOOL_ART`: bow, recurve, horn, long, sword, sling — one a
tool, every bow its own: the short plain D, the recurve's forward-flicked tips, the horn bow's
swept-back ears either side of a set-back grip, the full-height gold longbow), each baked in all
three tier palettes, the way one `SPRITES.gearIcons` glyph is baked in four materials.
