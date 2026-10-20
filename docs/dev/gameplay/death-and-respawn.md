# Death and respawn

Death is a walk back, never the end: while your team's eagle still roosts (`teamEagleDown`, the
eagle-drop banner in js/sim/eagle.js) going down costs a **timer and nothing else**, and you are
set down again at the bird ([Respawn at the bird](../multiplayer.md#respawn-at-the-bird)); once the
eagle has been driven off every death on that side is permanent, and that is the only way anyone
is ever out of a match (a side that surrenders calls its own bird home: [Surrender vote](../multiplayer.md#surrender-vote)). `die(p, src, cause)` marks that player dead and drops its bow draw,
momentum and zipline handle either way (that half is `bodyOut(p)`, which a surrender runs alone, since nobody went down). **Death keeps everything**: the wallet, the pouch, the
bag, the weapon and the build loaded into it, the unopened cards, the items, the skill ranks, the
level and xp all stay on the body, and `reset(false)` brings the same player back — nothing
spills, nothing is looted, and the snow around a corpse is as clean as it was. (An item riding
the cursor mid-drag goes back in the bag, so it is still there when the body comes back instead
of vanishing with the hand holding it.) **What a kill is worth
is gold from nowhere**, paid by `payTakedown` to the killer and the assists (see
[Takedowns](#takedowns-assists-bounties-and-shutdowns) below). The XP is separate and never needs
the credit: `KILL_XP` (40) + `KILL_XP_LV` (15) × the downed scout's level, shared by every rival
standing near, the killer too wherever it stood ([Hero levels](../multiplayer.md#hero-levels)). `die` also credits the kill (and
heals the killer if their kit carries `killHeal`, off a card) and writes the log line — see
[Kills and the event log](../multiplayer.md#kills-and-the-event-log) — then asks
`teamEagleDown(p.team)`: with the eagle still roosting, `p.respawnT` starts counting down
(`respawnTime(p)`, `updateRespawns` — see [Respawn at the bird](../multiplayer.md#respawn-at-the-bird)
for the whole path); with it driven off, `p.eliminated = true`, the permanent path. Either way
`checkLastStanding()` asks whether every **rival team** is now gone, which ends the match as a
win — a team-level question a kill can never answer, since a side is in the match while its bird
roosts ([PvP](../multiplayer.md#pvp)).

Either way the local player's overlay goes up through `endMatch('lost' | 'won' | 'respawning')`
(js/sim/player.js, the `damage & death` banner; the screens it raises are the `death & spectate`
banner, js/ui/screens.js): `state.mode = 'dead'`, every local overlay closed, and the screen goes
to a dim with two planks — **SPECTATE** and **LOBBY** — for `'lost'` (permanent), to
[the victory screen](../rendering/the-end-screens.md), whose planks are **KEEP PLAYING** and
**LOBBY**, for `'won'`, or, for `'respawning'` (temporary), to **the wait**: no dim and no planks
at all — `endMatch` puts the view on an ally (`viewPlayer` holds it on the body until its
[fall](../rendering/going-down.md) is over) (`state.deadView = 'spec'`, `specNext` keeping to
the side's own through `specOk`), one line — **RESPAWNING IN Ns** at 3× in the upper band — reads
the live countdown, and [the replay window](../rendering/replay-the-last-four-seconds.md) opens large
over the view with a close box on its corner (or ESC), so the death is watched first and the ally
after, the player choosing when. **LOBBY** on a `'lost'` dim does not leave: it opens
[the defeat screen](../rendering/the-end-screens.md), the loss's own summary — a lost match ends when
you stop watching it, not the instant you go down. LOBBY on **either** ceremony then opens
[the post-game lobby](../rendering/the-post-game-lobby.md), the whole match's record, and that
screen's LOBBY is the door out.
`'respawning'` needs no state of its own beyond `state.rpClosed` (reset by every `endMatch`):
once `p.respawnT` hits 0, `respawnPlayer(p)` snaps `state.mode` back to `'play'` the same
one-line way `'KEEP PLAYING'` already does, lands the local player at its bird, and replays the HUD
slide-in a fresh eagle landing gets. A win *or* an elimination also freezes what its screen will
print (`endSnapshot()` on `state.end`: gold, kills, level, clock, team, class, the kit, and the
placing and killer only the loss prints) because the match keeps running underneath and a total
that climbs behind a tally which already counted it reads as a bug — and because a loss's summary
is opened off a plank minutes later, by which time none of those numbers are still true. Spectating
sets `state.spec` to a living player's id and `viewPlayer()` — the one place the camera and minimap
ask who to frame — returns it. The control is
a top-centre `[<] NAME [>]` strip (`specLayout`/`specHit`, sized to the widest player name so the
arrows never shift): clicking an arrow or pressing the arrow keys cycles (`specNext`, player order,
skipping the dead — and skipping rivals while a respawn wait runs, since the wait is not a scouting
window), ESC returns to the planks (on a wait, which has none, it closes the replay instead), and a
watched player that dies hands the view to the next. There is deliberately no hint text; with nobody left the plate shows a dash instead of a name. LOBBY (`toLobby`) fades to dark and reloads
the page on the same seed, which boots into the title screen. **TAB still opens the standings
while you are out**, which is the point of holding them above the dim.
`state.mode` is `title | drop | play | dead`, and `updatePlay()` runs in `play`, `dead` **and**
`drop` (the clock starts with the eagle; airborne players are skipped) — the match carries on
without you, and `updateRespawns` ticks a respawn timer down under the `'respawning'` overlay the
same way. Only **pause (P) and the settings panel (ESC)** stop the sim, and neither does in a
match another screen shares (`netShared`, js/net/net.js: a host's menu never stops its guests, and
its P does nothing); `update()` (time, darkness, camera, fx) always keeps running. In `title` only
the ambient half runs (`updateTitle`: animals and fish), and not even that once a room is shared
— see [Main menu](../rendering/main-menu-title.md).

## Takedowns: assists, bounties and shutdowns

League's kill economy, in the `takedowns` banner at the end of js/sim/player.js. Every rival
player's blow on a player (`damagePlayer`) and every stun, root or net it puts on one
(`ccCredit`, js/sim/actions.js) stamps `p.foeHits[src.id] = state.elapsed` through `noteFoe`;
`recentFoes` reads back the rivals inside `ASSIST_T` (10 s), latest first, and `die` clears the
record. On a death, `die` reads the victim's **worth** (`killWorth`) and **bounty** (`bountyOf`)
before it clears the streak, and `payTakedown` pays:

- the **killer**: the worth plus the bounty, through `awardGold`. A death with no rival `src`
  (the ice, the creek, the orca, wolves, a bear, a wave) goes to the latest rival on the record,
  who takes the kill, the streak and the gold; losing the bird (`cause` `eagle`) is nobody's.
  Its log line stays the world's (`DEATH_CAUSE`), in the killer's colours.
- every other recent rival: an **assist** (`p.assists`) and an even share of `ASSIST_SHARE`
  (half) of the worth, at least 1 each.
- gold goes only to the living, as a kill always has; a dead killer still takes the credit.

**Worth** is `killBounty()`: `KILL_SOLDIERS` (3) scrapped soldiers' `SOLDIER_BOUNTY`
(js/sim/farm.js, read at the kill, so retuning a last hit moves the kill with it; 48 gold at a
16-gold soldier, the base pay, not the one that grows with the clock), shrunk by `FEED_STEP` (20%) per death past `FEED_FROM` (2) the victim has died
without a kill or assist (`p.feed`, reset by either), to a floor of `FEED_FLOOR` (a third): so feeding
never funds the other side. **Bounty** grows from a streak of `BOUNTY_FROM` (2) by `BOUNTY_STEP`
(1 soldier) a kill to `BOUNTY_MAX` (5 soldiers); the killer cashes it as a **SHUTDOWN** (the log says SHUT DOWN,
and a 2x gold word rises off the body for 1.4 s), so ending a streak pays without erasing the
lead it built. The bounty is worn over the name for every screen to see (`drawBountyTag`,
js/draw/overhead.js: a 5 px gold coin and the number over the name tag). Bots run the same
`die`, so they assist, wear bounties and shut down like anyone.
