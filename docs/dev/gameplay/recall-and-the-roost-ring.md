# Recall and the roost ring

League's loop: fight, go back, heal, shop, ride the zipline out. Both halves live in the `recall`
banner of [js/sim/recall.js](../../../js/sim/recall.js).

| | |
| --- | --- |
| `RECALL_T` | **6 s** of channel standing still |
| `RING_HP` | **22%** of max health a second |
| `RING_STAM` | the roll's charges refill **4x** as fast |

**The recall** is the **H** key (`recall`, KEY_ACTIONS; on every scheme, and a CLICK order is
dropped on the press). It arrives as a cmd (`{ kind: 'recall' }` through `runCmd` to
`startRecall`), so it holds online and the bots' API can send it. `recallBlocked` refuses it while
the bird is not down, in the air or under the snow, stunned, falling, rolling, casting, rushing,
on the rope, the cable or a deer, drawing, or prone. When the channel runs out the body is set
down on `roostTile` (js/sim/player.js), the tile a carried-back scout lands on, inside the ring.
The play camera cuts to a body that moved more than `CAM_CUT` in one frame instead of sweeping
the map (js/sim/sim.js).

**What breaks it**: `recallIntents` at the top of `playerIntents` ends it on any action of the
body's own (a step, the bow, E, the slide, the roll, a jump, an ability), and `breakRecall` is
called from every way a body is knocked out of standing still (a hit through `damagePlayer`, a
stun, the water, the cable, the roll). A potion never ends it. Death clears it.

**The roost ring** is the packed-earth disc the bird blew clear (`BOOM_R`, js/sim/eagle.js), read
off the bird where it sits, so it follows the roost wherever a map puts it (`roostRing`). Inside
your own side's ring and out of a fight (`p.fightT`, the items' clock: `ITEM_FIGHT_T` after any
blow given or taken, js/sim/items.js), `updateRecall` heals and refills the roll, with green motes rising off the body. A rival in it gets nothing.

**It reads without a word** ([UI rule](../rendering/show-dont-label.md)): `drawRecallGround`
(js/draw/recall.js) draws each down bird's ring as a soft glowing rim in its side's colour (four
one-pixel circles, baked once), and under a recalling body a dotted ring with a solid one closing
from it to the feet; the overhead frame's bar slot fills in the side's glow for the channel
(`drawPlayer`, js/draw/bodies.js).

**Bots** (`aiRecall`, js/ai/ai.js, read after the ladder in `updateAI`): with no rival player or
machine inside `AI_RECALL_SAFE`, a bot under `AI_RECALL_HP` of its health, or out of a fight with
the gold for its next whole item (`botNextItem`, the counter stands by the bird), and more than
`AI_RECALL_FAR` from its bird recalls and stands still for the channel, and a bot hurt in its own
ring and out of a fight waits there to `AI_RING_FULL`. A rival its side sees in reach hands it back to
the ladder.
