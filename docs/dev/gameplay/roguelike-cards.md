# Roguelike cards

A permanent buff dropped by a sprung **chest** in the treeline (`placeChests`, js/sim/world.js;
`hitObject`'s chest branch in js/sim/actions.js rolls the rarity against `CHEST_ODDS` through
`rollCardRarity`), one at a time, drawn one at a time.
`CARDS` is `{ white: [...], green: [...], blue: [...], purple: [...], gold: [...] }`
(`CARD_RARITIES`, White → Gold rising in rarity and magnitude), each entry `{ name, blurb, mod(k) }` —
the same `mod(k)` an item passive has. Every effect stays inside `kitOf`'s existing field
vocabulary (the hero stat bag `add`, `stealth`, `ambushMul`, `iceMax`, …) except one
genuinely new field, `killHeal` — a flat heal on a confirmed kill, hooked at `die()`'s existing
kill-credit line the same way `updateEat` applies a meal's.

**The draw** (there is no draft screen and no key, 0.426): an unopened card is a pouch kind,
and it opens itself the moment it is held with the body on the ground — `updatePlayer`
(js/sim/sim.js) calls `useCard(p)` (js/sim/core.js, beside `startEat`) while `cardsHeld(p)` is above
zero, as does the input's `useCard` intent (the bots' API) —
one card taken at random from everything held (so a rarity is as likely as it is common in the
hand), one entry of that rarity at random, `bagTake` the card, push `{ rarity, id }` onto
`p.cards`, `refreshKit(p)`, then `cardFx` (a burst in the rarity's colour) and a floater with the
card's name. The floater names the CARD; what it did to the NUMBERS flies into the notice lane
as the [stat sheet](../rendering/the-hud-corners/the-stat-ledger-your-sheet-as-a-notice.md), every row the pick
moved lit and blinking on it. An intent with nothing to draw is refused (`cardDenied`, the deny cue). `refreshKit` folds every entry in `p.cards` in before the items, cumulatively
(`for (const c of p.cards) CARDS[c.rarity][c.id].mod(k);`), so picking the same effect twice stacks
it, and every existing kit-reading site in the sim — movement, `attackDmg`, dodge timing, the AI,
`seenAt`'s stealth — picks a card up for free, the same way it does for items. `p.cards` is
set once in the `Player` constructor and never touched by `reset()`, so a build survives every
respawn within a match.

**The built-in brain opens its own first** — the instant a bot is carrying any unopened card,
`resolveCardForBot(p)` (js/ai/ai.js, the top of `aiThink`, which runs before `updatePlayer`) resolves it: the first rarity in `CARD_RARITIES` order it holds (a human's draw
is weighted across everything held), one random entry from that rarity's pool, minus the burst
and the floater.
