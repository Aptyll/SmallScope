# The setting

Softfall's fiction in one page: the premise, the valley's reason for each thing a match does, the
words the game uses, the voice it is written in, and what is left unanswered on purpose. Read it
before naming anything, before writing a line a player will read (a blurb, an event line, a wiki
entry, a patch note, store copy), and before proposing a feature whose reason to exist *in the
valley* is not obvious.

**The player-facing canon is the wiki's WORLD page** (`WIKI_WORLD`, [js/ui/menu.js](../../js/ui/menu.js);
what the page is: [gameplay.md](gameplay.md#the-wiki)). The sentences live there and only there.
This file is the rules they answer to, and it never restates them.

## The premise: the claim

Softfall is a high valley, and the snow that buried it. The snow came down soft and did not
stop, and an older **works** went under whole — its gold, its tools, its machines. It falls again
every winter, and the valley comes out from under it a different shape each time.

Each winter two **companies** fly a crew of five **scouts** in on an armoured **eagle** to dig
the works back out. Valley law is one line long: **a claim stands while its bird holds its
roost.** So nobody comes to Softfall to kill anybody. A scout who goes down is carried back to
the roost and sent out again, and a company wins the valley by scaring the other bird off its
ground. The **merchants** are a guild of their own — one rides in with each bird and raises its
base, then sells to any purse that walks up. The **machines** are the works' own, woken with
gold, each doing the one thing it remembers.

It is a **rivalry under a law, never a war of good and evil.** That is the fiction's half of
"cozy and a war at once" ([game.md](game.md)): the stakes are a claim, the losers fly home, and
the valley is matter-of-fact about all of it.

## Why the match is the way it is

The fiction's job is to give what the match already does a reason. When a new feature needs one,
it comes from this table's logic — something buried, something the law allows, something the
guild sells — not from a new faction or a new magic.

| What a match does | The valley's reason |
| --- | --- |
| two identical sides on a mirrored map | two companies after the same claim; neither is the villain |
| every seed is a new map | every winter's snow redraws the valley |
| gold in pines and rocks, tools and bits inside them, chests at the treeline | the works are under everything: the pines grew up through them, the rocks are their rubble, the crates never shipped |
| gold is the only currency, and gold is also XP | the valley pays in one thing, and a scout who has earned a lot of it has done a lot |
| nobody dies; a scout comes back at the roost with everything; the wait grows with level | valley law; they are carried back, and the better the scout, the longer the company sits them first |
| the eagle's hp is nerve, it gusts at a crowd, it is driven off and never killed | a bird is brave only up to a point |
| only a bird leaving ends a match | the claim |
| the merchant raises your base, sells to both sides and cannot be hurt | the counter is its own guild; nobody lays a hand on one |
| fish and berry prices swing all day | the market is the guild's, not the companies' |
| robots, turrets, generators and a barracks beside bows and swords | the works' machines, woken with gold; nobody knows who built them |
| one straight road, corner to corner | the works' haul road, older than everything but the machines |
| camps are neutral until hit | the wolves were here first and have no opinion about claims |
| WORN, KEEN, GILDED | the condition salvage comes out of the snow in |
| the wind dies at dusk and night is a colour | the valley goes blue and quiet; the claim does not stop for it |

**A company can never own a colour, a name or a crest.** Your side is painted blue on your own
screen whatever the roster dealt ([teams and colours](multiplayer.md#teams-and-colours)), so a
"blue faction" would be a different company on every screen in the lobby. The fiction keeps them
nameless — *your company*, *the other company* — and the colour stays what it is in the rules:
paint.

## The words

One word per thing, in every sentence a player reads. The UI's own labels (RED, BLUE, TEAM, LVL,
the KILLS and DEATHS a scoreboard or a character sheet counts) stay as they are — these are for
sentences.

| Say | For | Never |
| --- | --- | --- |
| **scout** | a player's character | hero, champion, soldier, unit |
| **company** | a team, in a sentence | faction, army, clan, nation |
| **the bird**, **the eagle** | the objective | mount, base, core |
| **roost** | where the bird sits, and the base round it | nest, camp, spawn |
| **nerve** | the eagle's health | hp, life |
| **driven off**, **leaves** | the eagle lost | killed, destroyed, dead |
| **goes down**, **carried back** | a scout's death and return | dies, killed, corpse, respawn |
| **the works** | whatever is buried | ruins, ancients, the old ones |
| **the counter**, **the merchant** | the shop and its keeper | vendor, store, trader |
| **the machines**, **bots** | everything a bay, a barracks or a build makes | drones, golems, androids |
| **scrapped**, **wrecked** | a bot lost, a building lost | killed |
| **the claim** | what a match is for | victory condition, conquest |
| **the valley**, **a winter** | the map, one match's world | realm, kingdom, level |

Beasts are the one living thing that is *killed* — they are hunted, and the game says so (KILL
GOLD, `THE KILL WEARS`).

## The voice

The game already has a voice; new lines match it. `THE BOW IS THE ARGUMENT: KEEP THE GAP.`
`FLIES WRONG. YOU END UP WHERE IT DOES.` `WENT TO THE WOLVES.` `RAN INTO SOMETHING SOLID.`

- **Short declaratives, present tense.** A sentence states one fact and stops. A colon turns a
  claim into its consequence.
- **Plain nouns, concrete verbs.** A pine, a purse, a bird. If a word would not be said out loud
  over a fire, it is the wrong word.
- **Dry, never jokey.** The valley is matter-of-fact about strange things, and that is where the
  humour is: `THEY ARE NOT ON A SIDE. THEY ARE ON THE PRICE OF FISH.` No puns, no winks at the
  player, no references.
- **Nobody is a villain and nothing is tragic.** The register is a working winter, not a saga.
- **It never explains a control or quotes a number.** A lore sentence says why the merchant
  sells to both sides; it does not say what a fish costs. Numbers are the other three wiki pages'.
- **It prints in capitals, in a small alphabet.** The pixel font is A-Z, 0-9 and
  `- + . , : ; ! ? / % ( ) < > ' "` (`GLYPHS`, [js/font.js](../../js/font.js)) — no long dash, no
  ampersand, no brackets — and a character it lacks prints as `?`, so a sentence is built
  without them.
- **A WORLD entry is three lines** at the slab's full width, 80 characters a line beside its
  figure. `wikiWrap` makes any length safe; three lines with no orphaned last word is the tuning.

## Naming

- **Plain English, often a compound**: HEARTHWEAVE, GHOSTSTEP, PACKMULE, ICE LANCE. No invented
  proper nouns but SOFTFALL, no apostrophe-fantasy, no real places, brands or dates.
- **A kind is named for what it is or does** (THROWING LOG, HOOKSHOT); **a perk or a card for the
  person it makes you** (STRIDER, FORAGER, WINTER'S CHILD).
- **A place is THE and a plain noun** — THE ROAD, THE ROOST, THE WORKS, THE COUNTER — and a camp
  is what is in it: WOLF DEN, ALPHA STONE, DIRE HOLLOW.
- **A person is a winter word**: a tree, a weather, a small animal, a bird (`NAME_POOL`,
  [js/profile.js](../../js/profile.js)).
- The rules are for new names. Not every shipped name follows them, and one that does not is not
  a precedent.

## Where the fiction goes

**It goes in:** the WORLD page; names; event-log lines and headlines; patch notes; the README and
store copy; a trailer's cards.

**It never goes in:** the HUD, a hint, a tooltip's body (that carve-out is for numbers —
[the UI rule](../../CLAUDE.md#ui-rule-show-dont-label)), or anything between a player and PLAY:
no crawl, no cutscene, no codex to unlock. The snow never has to explain itself, and the fiction
is for whoever goes looking.

## Left unanswered, on purpose

A new line may deepen these. It never settles one.

- Who built the works, and what they were for.
- What the companies are called, and who pays them.
- Where the eagles come from, and why they put up with it.
- Whether the merchants answer to anyone.
- What the machines remember that they are not telling.
