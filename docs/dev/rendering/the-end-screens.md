# The end screens

A match ends on one of two full-frame ceremonies — `renderVictory` in the `victory` banner,
`renderDefeat` in the `defeat` one — and they are deliberately **one composition drawn twice**:
both read their anchors from `winLayout()` (in the same `FRAME_H`-tall authored frame every other
screen uses, from `frameTop()`), so DEFEAT sits exactly where VICTORY sat, the side stands on the same stands
(`winStands`), and the rule and the tally land in the same bands. `deadLayout()` reads the same
`plankY`, so the planks sit under the tally on both. The stage (`stageY`, `bannerY`, `brazierX`,
`bannerX`, `gap`) is set **from the outside in** — the braziers as far out as the view allows, the
banners just inside them, the line of bodies taking what is left with a gap that closes on a narrow
view.

**When each is up.** A win goes straight to its screen (`endMatch('won')` → `state.over = 'won'`).
A loss does **not**: an elimination only dims the play screen, because the match runs on underneath
and you can sit and watch it, so a lost match ends when you stop watching — **LOBBY** on the death
overlay opens the defeat screen (`openDefeat()`, `state.deadView = 'defeat'`), which carries a
single **LOBBY** plank of its own. Neither ceremony's LOBBY leaves, though: both open
[the post-game lobby](the-post-game-lobby.md) first, and that screen's LOBBY is the door out. A
respawn-pending death's LOBBY leaves directly — nothing has been lost yet, so there is no record
to read. `endScreen()` is the one test for "a screen owns the frame" —
`renderUI` and `replayShowing` both bow out under it (the recap would cover the
whole ceremony), and so does every per-body tell in the world under the wash (`drawPlayer` bails
on it exactly as it does on the title's living world: a name plate with a health bar under it
floating through the ceremony is the HUD showing up to a party it was not invited to); the
held-TAB scoreboard and the info stack still draw over both. The post-game lobby answers it too.

**The two timelines.** `WIN_T` and `DEF_T` name every beat, and the render pass and the sound cues
(`winCues` / `defCues`, called from `update`) read one table each so they cannot drift apart. The
win is clocked off `state.deadTimer`, already ticking since the body fell; the loss has
`state.defeatT`, started when its view opens, which may be minutes later. Any press before the last
beat calls `endSkip()`, which jumps the relevant clock to the end.

- **Victory**: white bloom → **VICTORY** dropping in a letter at a time (each landing white, then
  gold, kicking up snow) → the gold rule sweeping out → the stage rising: braziers, the two crested
  team banners, the three-tier dais and **the whole winning side** on it — every active player of the
  team at 3× in a mirrored line (`winStands`: the local player in the middle on the raised block,
  mates fanning out a rank at a time to the right and the left, each rank a beat after the last),
  its name over its head in the team's mark → a crown falling onto
  the local player's head, firing a confetti burst (`drawWinConfetti`) across the whole frame →
  four stat plates popping in with their numbers climbing from zero → the planks and the emote bar
  sliding up together. Each body throws a puff of snow (`drawSnowPuff`) on the beat it lands on the
  stage. Nothing is written under the rule: the stage is the headline.
- **Defeat**: the same beats inverted. A colder, heavier wash → **DEFEAT** *falling* in a letter at
  a time on an ease-**in** (it drops, it does not spring), flashing cold rather than white → a
  **frost** rule (`drawGoldRule` takes a `pal`; `RULE_FROST`) → the stage *settling* rather than
  rising: the braziers out (`drawDeadBrazier` — the same ironwork with ash on the rim and a thread
  of smoke), the same two banners **cold** (`winBannerCv`'s `cold`: the cloth chilled halfway to the
  wash through `mixHex`, gold gone to frost, moth holes bitten out of the alpha, frayed where the
  tassels were), a snow bank where the dais stood and **the whole losing side down in it** on the
  win's stands — no raised block, every body **prone** at the same 3×, head toward the middle so
  the line lies mirrored the way it stood, sunk a row or two off the hash and mixed side-on with
  face-down so it is a field rather than a rank of cordwood, names in a chilled plate — with
  arrows planted among them where the crown would be → five stat plates → one plank and the emote
  bar. A mate still on their feet among the fallen would read as a survivor, which is exactly
  what this screen has none of. Frost then takes the frame itself (`drawDefeatRime`), crowding in
  from the edges for as long as the screen is up. Nothing under the rule here either: who put you
  down is the death headline's, and this screen is the side's loss, not yours.

**What they print** is one frozen object either way — `endSnapshot()` on `state.end`, taken in
`endMatch` because the match keeps running underneath and a total that climbs behind a tally which
already counted it reads as a bug. Its `roster` is the whole side, the local player first — name,
class and kit per player, a mate who is down at the whistle included — and is what both stages
stand. The four shared columns are gold / kills / level / clock; the loss puts its **placing**
(`4/6`, off `place`/`of`) in front of them. `drawEndTally` / `drawEndStatPlate` / `drawEndPlanks`
are the shared passes: each takes the ending's timeline and its accent pair (`WIN_ACCENT` gold,
`DEF_ACCENT` frost), so one plate tallies both. A plate is icon-and-number and nothing else — the
icon at 2× (the coin and the bow blitted at 16 px, the stamped glyphs at 2 px cells) beside the
value at 2×, so the row reads at a glance with no label on it. `dy` on the planks slides them
without moving the rects `deadHit()` tests, so a plank is only clickable once it has arrived. There
is no kit strip.

The art is procedural, in the title screen's idiom — `drawWinAurora` (three additive curtains of
2 px strands across the top band), `drawWinRays` (stepped wedges walking out from behind the
local player, blocks rather than an anti-aliased triangle), `drawWinMotes` (gold and snow falling from
`hash2` alone, no array; `cold` drops the sparks for the loss), `drawBlizzard` (wind streaks on the
same no-array idiom, a second speed under the motes), `winBannerCv` + `drawWinBanner` (each
side's banner **baked once** — a 36×96 gold-bordered cloth with a lit fold and a shaded edge, a
pale chief, the `WIN_CREST` eagle displayed stamped at 2×, the team's diamond between two gold
rules, a gold chevron down the hang and a fringed swallowtail cut into the alpha, mirrored with
`flip` so both lit folds face the stage — then hung from a finialed iron rail a row at a time
under a ripple pinned at the rail), `drawBrazierIron` + `drawWinBrazier` / `drawDeadBrazier`,
`drawWinDais` (three tiers: the raised block the local player stands on, the side's step, the
inlaid base with its icicles), `drawWinConfetti` (flakes in the side's own colours wound off the
beat the crown landed, tumbling to an edge and back as they fall — stateless, `since` is all it is
given), `drawSnowPuff`, `drawDefeatRime` (crystals as short spurs pointing in off the frame's
edge, 620 of them placed by hash rather than a sweep of the border band) and `drawDefeatDrift`.
`drawBlizzard` rides one slow gust envelope over the whole sheet — two sines beating against each
other, the way the world's own wind is summed — so the weather swells instead of hissing flat. The drift's profile is a
cosine under a flattening root: a plain cosine domes, and a dome leaves the ends of a body lying on
it up in the air. It is drawn twice, once behind the body and once in front, so the fallen player lies
**in** the snow rather than on a hill. `stampGrid(rows, pal, x, y, s, rim)` paints a char grid at
any cell size, the shape the [js/sprites/](../../../js/sprites/) grid files author in, for the crown, the arrow and
the stat glyphs (`WIN_ICONS`) that never earned a baked sprite; the sprites the screens do use are
the class bodies (`SPRITES.champ`), `itemBow` and `itemGold` — that last one a **live
canvas** whose frame `stepItemIcons()` stamps in each frame, like every item icon that moves
([sprites.md](../sprites.md)).

## The emote bar

Once the planks are up there is nothing left to win, which is the moment a scored goal hands back
to the players. Four emotes — a cheer, a shuffle, a twirl, a flop — sit on a bar of four picture
plates under the planks (`emoteLayout`, the `emotes` banner): a digit plays one, and so does the
pad's dpad read clockwise from up, which is why a plate wears its direction in the corner the way
an item slot wears its number rather than a word of hint. `emotePad` is what `padPress` asks, so the
dpad *is* the bar over an end screen and the planks keep the stick and the bumpers. The bar is
live exactly when the planks are (`emoteLive`): before that a press is a skip (`endSkip`).

An emote is a **pose picker** over the set every body on the stage is already drawn from
(`champLook`) — it hands back a frame, an offset off that body's own feet and sometimes a puff —
so the whole feature costs no art. The cheer is the catch's hoist frame, the one pose in the set
with both arms over the head; the twirl is the four facings in order, which is the whole trick of
it; the flop drops onto the prone frames and gets back up, and the crown comes off with it and
lies on the block until the body is up again. `drawEndBody` bottom-aligns whatever frame comes
back on the line the feet stand on, so the hoist's extra rows keep their feet, and the name and
the crown ride clear of a pose that reaches over the head.

Every emote has a **second performance for a body already down**, and the loss's screen plays that
one: the side lies in the drift and emotes without getting up, so nothing on that screen ever
stands back up. The mates on a **win** celebrate on their own (`emoteAmbient`) — each rolls its
own slot off the hash every `EM_AMB` seconds, about half of them play, and nothing is kept between
frames, the same no-array idiom as the motes. A loss has no ambient at all.

**The death dim** underneath is the third state, and it is not a ceremony: a wash, **YOU COLLAPSED
IN THE SNOW** at 3× (2× on a view too narrow to hold it) in the upper band — it is the first thing
to read and the match is still playing behind it, so it goes where an eye lands rather than over
the body that fell — a second line saying the match is over for you, and two planks (SPECTATE /
LOBBY). That is the **elimination**; a guest whose host left mid-match (`state.over =
'hostleft'`) gets the same dim under **THE HOST LEFT** / **THE MATCH ENDS HERE** and one LOBBY
plank. **The respawn wait** is the fourth state and the lightest: no wash, no
planks, the camera already on an ally through the spectate strip, one line — **RESPAWNING IN Ns**
at the same 3× in the same band, the number live. Both open under
[the recap](replay-the-last-four-seconds.md), which owns the frame until it is closed.
