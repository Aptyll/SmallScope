# Damage feedback

Combat damage is **one running total per body**, never a number per hit. `tallyHit(u, amount)`
(js/sim/core.js, called by `damagePlayer`, `hurtAnimal`, `hurtRobot`, the building blows and the
dummy) adds the hit to `u.tallyN` and stamps `u.tallyTick` with `state.tick`; a hit after
`TALLY_HOLD` (1 s) of quiet starts a new total. Both are fields on the body, so a save and a
snapshot carry them and a client fades a total on the host's tick. The total stands **`TALLY_GAP`
(2) px clear of the frame's right edge** (past the colour-blind cap or the stun plate when one is
up), centred on the frame (a hero's 7-row plate, a unit's 4-row bar), in **that bar's colour** (`barCol`: a blue player's damage is blue, a
beast's gold), holds `TALLY_HOLD`, then fades over `TALLY_FADE`. Its size is `TALLY_SC` (1)
world px per font px, so its 7 outlined rows stand as tall as a hero's frame, and `TALLY_POP_SC`
(1.25) for the `TALLY_POP` instant a hit adds to it, which no world pixel can take: so `drawHealthBar(…, u)` and a player's frame only **queue** it
(`queueTally`, with the frame's alpha), and `drawTallies(kPx)` stamps the queue on the screen
right after the world blit, as the world-1x outlined number scaled whole into device px, crisp
at any zoom and under the HUD. A body that **dies** loses its frame, so `queueTally` also keeps
each body's last spot (`tallySpot`, world px) and `drawTallies` floats a dead body's total
`TALLY_RISE` px up from there, fading over `TALLY_DEATH`. A one-shot never hung a frame, so
`trackDowns` calls `tallyFall(p)` to seed the spot where the frame would have stood. A word an
archery target says when it breaks (`wordPop`, js/sim/core.js, a staged scene's only) is stamped by
the same `drawTallies` pass in the same ink, gold (`BAR_NEUTRAL`): `TALLY_POP_SC` for the
`TALLY_POP` instant it lands, then `TALLY_SC`, rising `WORD_POP_RISE` px and fading over
`WORD_POP_T`. A player who goes down gets no `NAME DOWN` in the air: the feed
says it and the fall shows it. Units also flash white on hit via `drawSpriteFlash` (0.8-alpha
overlay).

## The running XP total

XP gets the damage total's treatment, on the frame's other side and for **your own scout only**:
`gainXp` (js/sim/player.js) adds each gain to `p.xpN` and stamps `p.xpTick`, a gain after
`TALLY_HOLD` of quiet starting a new total, and `drawPlayer` queues it for the local player
(`queueXp`, js/draw/overhead.js) as a plain purple number in the portrait's xp ink (`PORT_XP_LIT`),
its right edge `TALLY_GAP` px clear of the **level badge's left** and centred on the badge: the
damage total's mirror, the same gap and height on the other side. `drawTallies`
stamps it right-aligned at the same sizes, `TALLY_POP_SC` the instant a gain adds to it, and it
holds and fades by the same `TALLY_HOLD`/`TALLY_FADE`. The rivals' and your mates' XP is never
drawn: ten totals in a wave fight would be noise. No floater, no sound: the number and the
portrait's xp band are the tell.
