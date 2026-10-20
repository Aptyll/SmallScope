# Food: the meal is a channel

Berries and fish are the only heal a player carries, and they answer the same question — *can I take
this fight* — so the whole thing is **one clock and one channel**, in the `food` banner of
[js/sim/core.js](../../../js/sim/core.js):

| | |
| --- | --- |
| `FOOD_CD` | **3 s**, and it is **shared**: eating either meal puts *both* away |
| `FOOD_EAT` | **1.5 s** of channel, interruptible for its whole length |
| `FOOD_SLOW` | **×0.5** on the walk cap and the ice cap while chewing — the drag a cast puts on the legs |
| `ITEMS[type].heal` | what the meal is worth before `foodMul`: berry **20**, fish **50** |

**Nothing is spent up front.** `startEat(p, type)` only arms `p.eatT`/`p.eatType`; the food leaves
the pouch and `p.foodCd` starts when `updateEat` lands the channel — exactly the way an ability's
cooldown starts when its *cast* lands, not when the key is pressed
([Class abilities](class-abilities-keys-1-4.md)). So a meal knocked out of your hands costs the time
and the tempo and **nothing out of the pouch**, and can be restarted on the spot.

`eatBerry(p)` / `eatFish(p)` are the two edge-triggered intents Q and F set (two keys, two
meals — the hud strip's meal buttons click the same intents a key sets); both are one
line into `startEat`. **Four fish** share F (`FISH_KINDS`, js/sim/player.js): the WHITEFISH (+40) and
the rarer SNOW CHAR (+70) caught in the creek ([world](../world.md)), and the FROST PIKE (+50, item
`fish`) and the rarer GOLD SUNFISH (+80) from a hole or a net. `fishToEat(p)` says which: the body's pick (`p.fishPick`) if it has one, else the smallest
meal it carries. Pointing at the fish well raises the **fish picker**, a column of the four with
their counts rising straight up off it (`drawFishPop`, hovering one names it and its heal); a click
picks one (gold rim, the others dim) and F then eats only that, refused when none are left, and a
click on the picked one lets it go. The pick is set through the input's `cmd`
(`{kind: 'fishPick'}`, `runCmd`), so it holds online. It refuses — with the `SFX.deny()` an ability well
speaks — while the clock is up, the body is busy (stunned, falling, rolling, mid-cast, mid-rush,
airborne), or there is nothing a meal could do (no food, or already at full hp).

**What breaks a meal** is `breakEat(p)`, and every side that can break one calls it. The world
takes it away: a hit (`damagePlayer`), a stun (`stunUnit`), the ice (the hole plunge in
`updatePlayer`), death (`die`, `practiceRevive`). And **you** drop it on purpose, two ways — a
**dodge roll** (`tryDodge`), and the **fire button**: the rising edge of `inp.fire` in
`updatePlayer` cancels the meal and the draw gate two lines below arms in the *same frame*, so a
body mid-chew is never a body that cannot fight back. The food is unspent, so the cancel costs the
1.5 s and the tempo and nothing else, and the meal can be started again the moment the shot is
away.

**What a meal still refuses** is the E swing (`tryWork`) and an ability (`tryAbility`) — the two
presses that spend a cooldown, which a stray keypress should not be able to throw away. A meal does
*not* break the burrow — you can eat lying in the snow — and its crumbs fade with the cover exactly
as the overhead tells do (`alpha: 1 - concealOf(p)`).

**It reads without a word of it** ([UI rule](../rendering/show-dont-label.md)):

- the **overhead frame** carries the channel in the same slot as the bow-draw meter, filled in the
  heal green — gold = drawing, slate = reloading, **green = eating** — so a rival can see the meal
  and take it away ([Overhead health bars](../rendering/overhead-health-bars.md));
- crumbs in the meal's own colour fly at the mouth for the whole channel;
- the shared clock **wipes top-down over the food itself** (`drawFoodClock`, UI › `backpack`) — in
  the bag cell the click that eats lands on, on the open pack's strip counters *and* on the hud
  strip's two **meal buttons** (`drawFoodCell`, [rendering.md](../rendering/the-hud-corners/the-hud-strip.md) — icon,
  count, key letter, and a click that sets the same `eatBerry`/`eatFish` intent the key does).
  All wipe together: that is the point of one clock. The meal being chewed lights its own well
  white, the way a casting ability well does.
- the food tooltip carries `HEALS` / `EAT` / `COOLDOWN` / `CARRIED` and a red `READY IN` while the
  clock runs — the same rows `tipClassAb` prints.

**Bots eat through the same one path** (rung 1 of `aiThink`, the ladder `updateAI` wraps — which is why it reads `foe` before the
burrow rung): a bot only starts a meal with no rival inside `AI_EAT_R` (110 px), because standing
there chewing under fire is not patience, it is a free kill.
