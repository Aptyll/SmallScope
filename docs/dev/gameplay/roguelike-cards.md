# Roguelike cards (parked)

**Cards are out of the game since 0.531** (Noah, 2026-10-20: "keep the card system and find a way
to rebuild it in the future ... but remove the cards as well for now"). Chests, which were the only
source of cards, went in the same patch. This page is the note for building them back.

The last code that had them is main at **0.523** (`git show b094610:<file>`); every piece named
below can be read there whole.

## What the system was

A permanent buff for the rest of the match, found in the world and opened on the spot.

| Piece | Where it lived (at 0.523) | What it did |
| --- | --- | --- |
| `CARD_RARITIES` | js/sim/player.js | `['white', 'green', 'blue', 'purple', 'gold']`, rising in rarity and size |
| `CARDS` | js/sim/player.js, `roguelike cards` part | `{ rarity: [{ name, blurb, mod(k) }] }`, five per rarity (the table is below) |
| unopened card items | `ITEMS.cardWhite` … `cardGold`, js/sim/player.js | `pouch: true` counters in `p.food`, so the pickup and the counting helpers took them for free; `cardKey(r)` / `CARD_TYPE_RARITY` mapped rarity to item key |
| the draw | `useCard(p)`, `cardsHeld(p)`, `cardFx`, js/sim/core.js | called from `updatePlayer` (js/sim/sim.js) while any card was held and the body was on the ground: one held card at random, one entry of its rarity at random (`rng()`), pushed `{ rarity, id }` onto `p.cards`, `refreshKit(p)`, a burst in the rarity's colour and a floater with the name |
| the input | `input.useCard` (player.js, net.js, bot-api.js, input.js, sim.js, tunnel.js) | an edge-triggered intent for the bot API; a refused draw played `cardDenied` (js/ui/hud-draw.js) |
| bots | `resolveCardForBot(p)`, js/ai/ai.js, called at the top of `aiThink` (js/ai/ai-ladder.js) | opened the first rarity held, no fx |
| the kit | `refreshKit` (js/sim/player.js) | `for (const c of p.cards) CARDS[c.rarity][c.id].mod(k);` before `itemMods`, so a card stacked with itself and every kit reader saw it |
| where they came from | a sprung chest: `hitObject`'s chest branch (js/sim/actions.js) rolled `rollCardRarity(CHEST_ODDS)` (js/sim/structures.js) | `CHEST_ODDS = { white: 0.55, green: 0.28, blue: 0.12, purple: 0.04, gold: 0.01 }` |
| art | `itemCards` + `CARD_PALS`, js/sprites/items.js → `SPRITES.itemCard<Rarity>` | an 8×8 card back in the rarity's colour with 1–5 pips counted on it, so colour is never the only cue |
| colours | `RES_COLORS.card<Rarity>`, js/sim/structures.js | `#d9dfe8`, `#5fd18a`, `#4a90e2`, `#a259e6`, `#e8a33d` (must match `CARD_PALS`) |
| readouts | `tipStack` (js/ui/tooltip.js), `statParts`' `CARDS` row (js/sim/stats.js), the stat-sheet notice (js/ui/notices.js watches the kit, so it needed nothing) | |

`p.cards` was set once in the `Player` constructor and never cleared by `reset()`, so a build
survived every respawn within a match. `killHeal` (the heal on a kill, read in `die()`) stays in
the kit: the FEAST item passive uses it. `harvestMul` stays too (the fell reads it), sitting at 1
until FORAGER is back.

## The card table at 0.523

Every `mod(k)` writes the kit's own vocabulary (`k.add` is the hero stat bag, js/sim/stats.js;
`as` a fraction, the rest flat).

| Rarity | Name | Blurb | mod |
| --- | --- | --- | --- |
| white | QUICK HANDS | FASTER RENOCK | `add.as += 0.04` |
| white | THICK SOLES | WALK FASTER | `add.ms += 2` |
| white | SOFT LANDING | DODGES COME BACK SOONER | `dodgeCd -= 0.25` |
| white | FORAGER | FELLS AND BREAKS PAY MORE | `harvestMul += 0.5` |
| white | STEADY HAND | FASTER FULL DRAW | `add.as += 0.02` |
| green | SHARP POINT | ARROWS HIT HARDER | `add.dmg += 1` |
| green | PADDED VEST | MORE HEALTH | `add.hp += 12` |
| green | LIGHT FEET | WALK FASTER | `add.ms += 4` |
| green | CAMOUFLAGE | FOES SPOT YOU FROM CLOSER | `stealth -= 0.08` |
| green | FLETCHER'S TOUCH | FASTER RENOCK | `add.as += 0.07` |
| blue | HEAVY DRAW | HITS HARDER, SLOWER DRAW | `add.dmg += 2; add.as -= 0.03` |
| blue | IRON WILL | LESS DAMAGE, MORE HEALTH | `add.armor += 10; add.hp += 10` |
| blue | SPRINTER | WALK FASTER, DODGES SOONER | `add.ms += 6; dodgeCd -= 0.3` |
| blue | AMBUSHER'S EDGE | AMBUSH SHOTS HIT HARDER | `ambushMul += 0.4` |
| blue | ICE RUNNER | FASTER, SHARPER ON ICE | `iceMax *= 1.15; iceSteer += 0.2` |
| purple | EXECUTIONER | ARROWS HIT MUCH HARDER | `add.dmg += 4` |
| purple | STONE SKIN | MUCH LESS DAMAGE TAKEN | `add.armor += 20` |
| purple | GHOST | SEEN FROM MUCH CLOSER | `stealth -= 0.18` |
| purple | BLOODLUST | HEAL ON A KILL | `killHeal += 12` |
| purple | RELENTLESS | FASTER DODGES AND ARROWS | `dodgeCd -= 0.7; add.as += 0.1` |
| gold | BERSERKER'S HEART | HITS HARDER, LESS HEALTH | `add.dmg += 5; add.hp -= 15` |
| gold | FORTRESS | MUCH LESS DAMAGE, MORE HP | `add.armor += 35; add.hp += 25` |
| gold | PHANTOM | SEEN CLOSER, HARDER AMBUSH | `stealth -= 0.3; ambushMul += 0.5` |
| gold | VAMPIRE | HEAL ON KILL, HITS HARDER | `killHeal += 25; add.dmg += 1` |
| gold | WINTER'S CHILD | MUCH FASTER, SHARPER ON ICE | `iceMax *= 1.3; iceSteer += 0.35; add.ms += 4` |

The numbers are pre-MOBA; the hunter-only words (RENOCK, ARROWS) want a pass for the melee heroes.

## Building them back

The kit side is the cheap part: `p.cards` plus one line in `refreshKit` is the whole effect, and the
hero stat panel and stat-sheet notice read the kit already. What needs a decision first is **where
a card comes from** now that chests are gone. Options that fit the MOBA:

1. **A camp or objective reward**: the neutral objective (or a den kill) hands its killer, or
   their side, a card. Fits League's "buff from a neutral".
2. **A level reward**: a card at levels 3, 9 and 15, picked from three. A draft screen was cut in
   3.23 for being a menu mid-fight; a pick at the shop or on recall avoids that.
3. **Bought at the counter** as a seventh, card-only slot.

Steps once the source is chosen:

1. Put `CARD_RARITIES`, `CARDS` and `p.cards` back (js/sim/player.js), and the `refreshKit` line.
   `p.cards` is mutable sim state: check it rides the snapshot (players are serialized whole) and
   the save (`SAVE_ROOTS`, js/sim/save.js).
2. Grant through one shared function (`gainCard(p, rarity)`), from the source, on the host only
   (a client never runs the sim); any roll uses `rng()` outside `genWorld()`.
3. A pick between cards is a player action: it rides `p.input` (a `cmd`), never `keys`/`mouse`,
   and a bot answers it in js/ai/ai.js.
4. Show it: the card icons and colours above, a burst and the name floater (`cardFx` at 0.523), the
   `CARDS` row back in `statParts`. Show, don't label: the icon and colour, not a sentence.
5. Patch note, `PATCH_DIGEST` line, and fix this page to describe the live system.
