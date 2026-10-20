# The post-game lobby

The ceremony answers *what happened to me*; the lobby answers *what happened*. **LOBBY** on either
ending opens it (`openScores(state.deadView)`, js/ui/lobby.js, `state.deadView = 'scores'`) and
**this** screen's LOBBY is the door out, so the walk out of a match is ceremony, then record, then
the title. **BACK** (or ESC) hands the frame back to the ceremony it came from. It draws through
the same three chokepoints every other dead view does - `renderDead`, `deadKey`, `deadClick` each
hand off on one line - and counts as a full-frame screen in `endScreen()`, so the HUD and the
recap bow out under it the way they do under the two ceremonies.

**The page**, League's post-game STATS read sideways. Every active player is a **column**, the
local player first and their side next (its colour through `skin()` like everything else, so your
side is BLUE here too), then a gap and the rivals. Each column wears its player's HUD portrait
(`portraitSprite`, small) with the level on its corner and the side's colour as a line under it,
and its name printed whole under the face: the columns take turns between two lines, so each name
has two columns' width (`scoreName` cuts one only on a view narrowed below full width). Down the left are four **folding groups**,
`SCORE_GROUPS`: COMBAT (K/D/A, level, best streak, best multi-kill, crowd control), DAMAGE DEALT (to
players, the bird, buildings, beasts, and the total), TAKEN AND HEALED, and GOLD (earned, spent,
beasts hunted). A click on a group's heading folds it, a short view scrolls the groups (the wheel
or up/down), and a number past 99999 prints its magnitude (`scoreFmt` → `shortNum`: 154K, 1.2M).
This is the [instrument carve-out](show-dont-label.md); everything that is not a number still reads
as a shape: your column is a lit band with gold numbers and a gold rim on the face, and the biggest
value in each row is **underlined in its side's colour** (never brightened) - except K/D/A and the
two damage-taken rows, which have no single best. The page is graphite, the HUD's own neutral dark.
STATS and GRAPHS are page words in the top-left corner, the open one underlined to the word's
width (`drawNavCell`'s grammar), and BACK / LOBBY are bare 2x words at the foot, white and gold
under the pointer or the keys - the title screen's grammar, no plank. Left/right walks those four
words and Enter takes one.

**The graphs**, the GRAPHS page, League's: every stat of every group listed down the left under
its group's name, the charted one marked gold (a click, or up/down, picks another), and that stat as
a **horizontal bar chart** - one bar a player in its side's colour, your side first, a gap, the
rivals, each with its face at the head, its name over the bar (beside it on a view too short for
two lines a row) and its number at the end; yours carries a gold line and a gold number. A bar is
its player's share of the scale's top, a round step past the biggest value (`scoreStep`), and the
steps stand as faint uprights with their values (K/M/B) under the chart.

**Where the numbers come from.** `sampleStats(dt)` (called from `updatePlay`, sim.js) pushes every
player's cumulative gold earned and damage dealt onto `p.hGold`/`p.hDmg` every `STAT_STEP` seconds;
the lobby no longer draws them (the bars read the frozen record), and the bot lab reads the last gold.
They live on the PLAYER rather than in a table of their own because a player field crosses the wire
with everything else, so a client's lobby draws the host's graph instead of a flat line; every
player is sampled on the same tick, active or not, so index *i* means the same moment in all ten
arrays and the series can simply be summed per side. A match has no length limit, so past
`STAT_MAX` samples each series **halves** - every other sample dropped, newest kept - and the pitch
doubles with it, which keeps the spacing uniform and ten players' history a few hundred numbers
however long the match runs. The rest is counted where it happens, each at the shared function
every case goes through: damage dealt and taken (split into rival players' and a beast's bite,
`BEAST_CAUSES`) in `damagePlayer`, beasts' damage in `hurtUnit`, healing in `healPlayer` (the one
way health comes back), gold spent in `pay`, beasts hunted in `animalDies`, streaks and multi-kills
(kills `MULTI_T` apart) in `die`, and crowd control in `ccCredit`, which the stun, root and net
setters call with the `src` a caller names - the seconds a rival PLAYER is newly held. The table itself is frozen by `statFreeze()` from `endMatch` on every
real ending (a respawn wait is not one), because a won match runs on underneath its own ceremony
and the bots still farming must not move the numbers while they are being read.
