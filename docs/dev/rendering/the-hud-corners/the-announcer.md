# The announcer and the kill feed

League's two readouts of a fight, in the HUD's graphite (js/ui/announcer.js).

**The call.** A big moment raises one call: FIRST BLOOD (the match's first player kill), a
DOUBLE / TRIPLE / QUADRA / PENTA KILL (die()'s run of kills `MULTI_T` apart), SHUTDOWN (the body
wore a bounty), ACE (that kill left the whole fallen side down), TOWER DESTROYED (a road tower,
`STRUCTS.tower.call`) and BROWN BEAR SLAIN / BLACK BEAR SLAIN (a `teamPay` bear). A kill earns
one call, the biggest. The plate hangs at `noteY()` under the team rail, top centre: a 16px
face of who made it, the words at 2x over a 1px rule in that side's colour, and a 16px face of
what was taken, dimmed (none on an ACE). A player's face is the HUD portrait's frame at 2x on its
dusk; a tower and a bear are 7x7 glyphs (`ANN_TOWER`, the camp's own `icon`); a tower wrecked by
a wave and no player shows the wrecking side's colour. Calls queue: one is up at a time for
`ANN_LIFE`, cut to `ANN_RUSH` while others wait, and past `ANN_WAIT` waiting the oldest is
dropped. The sting (`SFX.announce`) rings when the plate comes up: a bell run as long as the
multi-kill, rising for your side's call and falling for theirs.

**The feed.** Every player kill, tower and bear also leaves a row under the notice plates, right
on the minimap's edge: maker's face, a chevron in their colour, the dimmed face taken. No words.
Newest on top, `FEED_MAX` rows, each gone after `FEED_LIFE`; it starts where the plates end
(`noteLaneBottom`) and stops at `noteLaneFloor`.

**Online.** The sim raises calls (the `calls` banner, js/sim/player.js) and `annRaise` records
each as an `'ann'` event; `netEvSeen` passes it to every side, so everyone hears every call. The
queue and the feed are each screen's own and are never saved.
