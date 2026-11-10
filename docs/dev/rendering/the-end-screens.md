# The end screens

A match ends on one of two full-frame screens — `renderVictory` in the `victory` banner,
`renderDefeat` in the `defeat` one — and they are deliberately **one composition drawn twice**,
League's end board kept short: the headline over the match (frozen and dimmed underneath), then
**your side as a table**. Both read their anchors from `winLayout()` (in the same `FRAME_H`-tall
authored frame every other screen uses, from `frameTop()`), so DEFEAT sits exactly where VICTORY
sat and the table lands in the same band. `deadLayout()` reads the same `plankY`, so LOBBY sits
under the table on both.

**When each is up.** A win goes straight to its screen (`endMatch('won')` → `state.over = 'won'`).
A loss goes there after one beat: the play screen dims under one line for `LOST_BEAT` s
(`lostBeat()`), with nothing to press, and then the defeat screen opens itself (`renderDead` calls
`openDefeat()`, `state.deadView = 'defeat'`; a press during the beat goes on at once, `endSkip`),
which carries a single **LOBBY** word. Neither ceremony's LOBBY leaves, though: both open
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

- **Victory**: white bloom off the last frame and a dim settling over the match → **VICTORY**
  dropping in a letter at a time (each landing white, then gold; `drawEndTitle`), with no rule under
  it → the table (`drawEndTable`) → the story lines → LOBBY sliding up.
- **Defeat**: the same board in frost. A colder dim → **DEFEAT** *falling* in a letter at a time on
  an ease-**in** (it drops, it does not spring), flashing cold rather than white → the same table in
  `DEF_ACCENT` → the story → LOBBY.
- **A 1V1** prints how it ended under either headline (`drawEndWhy`: FIRST STRIKE, 100 SOLDIERS
  or FIRST TOWER, from `onevoneWhy`); nothing is written there in any other match.

**The table** is a row a player of your side, you first and your row outlined in the ending's
accent (`WIN_ACCENT` gold, `DEF_ACCENT` frost): the face, the hero's name (yours in the accent; a
person's own name under it when it differs), the K/D/A, the damage dealt to rival heroes drawn as
a **bar against the side's best** with its number under it — who carried reads before any number
does — then soldiers' last hits and gold earned. A glyph heads each number's column and the match
clock sits over the names (`WIN_ICONS`, stamped through `stampGrid`; the coin is `SPRITES.itemGold`),
so the board needs no labels. The rows arrive a beat apart (`statStep`), each sliding up while its
bar grows and its numbers climb from zero, and `tallyCues` knocks and blips along with them. The
columns sit right to left from the table's edge (`endColumns`); on a narrow view the K/D/A drops
to 1× before the bar gets too short. LOBBY is the title screen's bare word, white and gold while
hot (`drawEndPlanks`); `dy` slides it without moving the rect `deadHit()` tests, so it is only
clickable once it has arrived.

**What they print** is one frozen object either way — `endSnapshot()` on `state.end`, taken in
`endMatch` because the match keeps running underneath and a total that climbs behind a table which
already counted it reads as a bug. Its `roster` is the whole side, the local player first: name,
class, look and the row's numbers per player, a mate who is down at the whistle included.

**The death dim** underneath is the third state, and it is not a ceremony: a wash, **YOUR EAGLE
WAS DRIVEN OFF** at 3× (2× on a view too narrow to hold it) in the upper band — it is the first thing
to read and the match is still playing behind it, so it goes where an eye lands rather than over
the body that fell (a 1V1 prints how it was lost in its place) — and nothing else: no second line, no plank and no recap, since the bird's
flight has just been watched live. It stands `LOST_BEAT` s and the defeat ceremony takes over, its dim deepening from
this one's. That is the **loss's beat**; a guest whose host left mid-match (`state.over =
'hostleft'`) gets the same dim under **THE HOST LEFT** / **THE MATCH ENDS HERE** and one LOBBY
word. **The respawn wait** is the fourth state and the lightest: no wash, no
planks, the camera already on an ally through the spectate strip, one line — **RESPAWNING IN Ns**
at the same 3× in the same band, the number live. The wait opens under
[the recap](replay-the-last-four-seconds.md), which owns the frame until it is closed.
