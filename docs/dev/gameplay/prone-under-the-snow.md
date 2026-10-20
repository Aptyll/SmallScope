# Prone: under the snow

**SNOW COVER — the HUNTER's key 4** — lies a player face-down in the snow and pulls it over them.
It is the game's only stealth, it belongs to one class, and once under it is paid for
entirely in speed; the way IN costs the ability's 60 s cooldown
([class abilities](class-abilities-keys-1-4.md)), and every way back up is free. There is no
burrow key and no `input.prone` — the ability is the one door.

`tryProne(p)`/`risePlayer(p)` (the `prone` sub-banner of `actions`, js/sim/actions.js) are the only two ways in and out —
`abSnowCover` (js/sim/abilities.js) is the one caller of `tryProne` and refunds the clock when the
snow refuses. Going down
needs **both feet still** (`hypot(vx, vy) <= PRONE_ENTER`, 14 px/s — you cannot dive at a run),
not sliding, not mid-roll, and **snow underfoot**: a river has nothing to dig into, and the press
there is denied before the kneel even starts. Getting up happens on key 4 again, on the ambush
shot, on a `tryWork` E
press, on `tryDodge` (the fast way out, and it costs a charge), on any hit
(`damagePlayer` calls `risePlayer` before anything else), on falling through the ice, and on death.

## The one number

`p.hide` (0..1) is the whole state. It climbs at `1 / kit.bury` (starts at `PRONE_BURY` 1.5 s,
shortened by ambush ranks) while lying **still on
snow**, holds while crawling, decays fast off snow — a body dragged onto bare ice keeps the pose
but loses the cover, because the cover is the snow, not the posture — and is zeroed the instant
`risePlayer` runs. Two derived reads sit on top of it and **everything else in the game uses
those, never `p.hide` directly**:

- `concealOf(p)` = `hide`, discounted to `PRONE_MOVE` (×0.5) while `p.moving`. A crawling mound is
  worth half a still one, which is what makes "stop before you shoot" a real decision.
- `seenAt(p, range, team)` = the distance a watcher with plain sight `range` actually notices p from
  (0 when `team` is given and p is in that side's [fog](fog-of-war.md); creatures and turrets give none):
  `range × kit.stealth × (1 − PRONE_CUT × conceal)`, floored at `PRONE_SNIFF` (22 px) whenever
  there is any cover at all — **nothing hides at arm's length**. A bot's sight is its profile's
  (`AI_LEVELS`, js/ai/ai-skill.js: EASY 120, NORMAL 147, HARD 200, IMPOSSIBLE 267 px), so full cover takes those to
  22 (the floor), 22, 28 and 37, and a tier-3 turret's 124 down to 22.

**Every watcher resolves through `seenAt`, and a new one must too** (a bot's names its side, so the
fog holds for it). Today's callers: a bot's
target pick and its roost-threat count (`aiNearestEnemy`, `aiSituation`, js/ai/ai.js), a turret
(`turretMark`/`turretHolds`), a worker bot's quarry and the flag's reach (js/sim/robots.js), prey
deciding to bolt (`updatePrey`), the eagle's gust (js/sim/eagle.js) and the CLICK scheme's lock and
acquire (js/app/input.js). A camp monster has no sight
to resolve, since a hit is its only trigger ([Camp monsters](wildlife.md#camp-monsters-neutral-until-hit)).
Both maps gate separately on `concealOf(p) >= PRONE_MAP` (0.55): a rival buried and still drops off
the minimap and the M map, and a rival *crawling* tops out at 0.5 and stays on both — moving puts
you back on their map before it puts you back in their sights.

## Crawling

`updatePlayer`'s movement block forces the plain direct-approach branch with
`walkMax = PRONE_SPEED` (20 px/s against a 72 px/s walk) on **any** surface — no ice cap, no
`chargeMul`, nothing to stack, and `inp.slide` is ignored (`wantSlide` requires `!p.prone`).
Rising costs `PRONE_RISE` (0.34 s) at 45% walk speed. Instead of footprints a crawl lays a **drag
furrow**: `k: 3` entries in the shared `footprints` array every 2 px, each storing the
perpendicular it was pushed with so the trough draws square to the path whichever way it went, two
deep so consecutive marks tile into one continuous line, with an elbow dimple to one side on every
other mark. It keeps the full 9 s footprint life — a trail worth following has to outlast the crawl
that made it — and it is the counterplay: a line like that leads straight to the mound at the end.

## The ambush shot

`ambushReady(p)` is `prone && hide >= 1 && !moving`: **full** cover, and dead still while it goes.
`basicAttack` reads it before anything else can break the cover, multiplies the whole damage roll
(`attackDmg`, js/sim/attack.js: `(DAMAGE + speed bonus) × drawDmgMul`) by `kit.ambushMul` (starts at `AMBUSH_MUL` 2.5, grown by ambush
cards and items) plus what SNOW COVER's rank adds (`ambushRank`: its `rank` `ambush`, ×2.5/3/3.5,
over the base), tags the arrow `ambush: true`, and calls
`risePlayer` after the loose — one ambush per burrow, then you are a player lying in the open with
a bow that still has to be renocked. A level-1 HUNTER's full draw (DAMAGE 16) goes 16 → 40. A fish taken off the ice (`autoFish`) is not a shot: it never touches the attack and breaks
no cover.

Wherever the tagged arrow lands — player, worker bot or animal — `ambushFx()` puts a gold flare
over the ordinary hit puff and plays `SFX.ambush()`; `damagePlayer`'s `crit` argument doubles the
local shake.

## The tells

None of them is a word:

- **The body disappears.** `drawSnowCover` closes over the prone sprite **from the outside in** —
  boots and elbows first, the middle of the back last — so at 85% there is still a seam of coat
  showing down the spine. Row extents come from `spr.spans`, the per-row `[firstX, lastX]`
  [sprites.md](../sprites.md) takes off the char grid at bake time, dilated a row into its neighbours
  so it is a drift rather than a traced outline; the finished mound is lit like every other drift
  here (white crest, shaded far side, dark rim under it doing the grounding a prone body's missing
  cast shadow would have done). Alpha is 1 for a rival, 0.85 for an ally and 0.66 for yourself, so
  **you can always see yourself under the snow** and nobody else can.
- **The overhead furniture fades with the cover** (`drawPlayer`) — name tag, health bar, stamina
  bar, level badge, and the draw meter that says a shot is coming. A rival keeps none of it. The
  whole stack also drops 6 rows with the pose, since a prone body starts that much lower in the
  same 16×16 cell.
- **The bury ring** (`drawBuryRing`, local player only) — twelve marks on a ring in the snow that
  light one at a time as the cover builds, then flash white and go. Each gets a dark pixel under
  it, because white on snow is white on white. A rival needs no meter: they can watch you vanish.
- **The reticle arms.** `cursorInfo` puts `amb` on every reticle it builds; `drawCursor` grows a
  second segment out along each of the crosshair's own axes and warms the centre pixel to gold —
  deliberately on the cross, where the renock's marks are on the diagonals.
- **Breath.** One timer on the player does two jobs, and which one says what state the body is in:
  while the cover is still building it throws up the snow being pulled over, and once it is
  finished it becomes a plume of breath every ~2 s. That, the mound itself and the furrow are the
  three things that keep "almost invisible" honest.

## Bots

A hunter bot casts it through the same ability key a human presses (`inp.ability = 3`) — rung 2
of the [ladder](../multiplayer.md#bots), decided before the rest because two later rungs read
the answer; a warrior bot has no burrow to decide.
