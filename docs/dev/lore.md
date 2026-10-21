# The setting

Softfall's fiction in one page: the premise, the valley's reason for each thing a match does, the
words the game uses, the voice it is written in, and what is left unanswered on purpose. Read it
before naming anything, before writing a line a player will read (a blurb, an event line, a wiki
entry, a patch note, store copy), and before proposing a feature whose reason to exist *in the
valley* is not obvious.

**The player-facing canon is the wiki's WORLD page** (`WIKI_WORLD`, [js/ui/wiki.js](../../js/ui/wiki.js);
what the page is: [gameplay.md](gameplay/the-wiki.md)) **and each hero's story** (`story` on its
`CLASSES` entry, [js/sim/player.js](../../js/sim/player.js), printed under the hero's card on the
wiki's CLASSES page). The sentences live there and only there. This file is the rules they answer
to, and it never restates them.

## The premise: the exiles and the claim

Over the pass is **the empire**: big, old, never named. It keeps what it can use, and the rest it
walks up to its last pass and shuts the gate behind: a soldier who walked home from a war that
never ends, a smith who would not kneel, a general who won the wrong war. **Everyone who fights in
Softfall is an exile, and the valley takes anyone who can dig.** Nobody here was born here.

Softfall is a high valley, and the snow that buried it. The snow came down soft and did not
stop, and an older **works** went under whole — its gold, its tools, its machines. It falls again
every winter, and the valley comes out from under it a different shape each time.

Each winter two **companies** hire five **exiles** apiece, and fly each crew in on an armoured
**eagle** to dig the works back out. A company does not ask where its exiles came from. Valley law is one line long: **a claim stands while its bird holds its
roost.** So nobody comes to Softfall to kill anybody. An exile who goes down is carried back to
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
| ten heroes, every one with a past somewhere else | the empire throws people out; the valley takes anyone who can dig |
| two identical sides on a mirrored map | two companies after the same claim; neither is the villain |
| every seed is a new map | every winter's snow redraws the valley |
| gold in the pines | the works are under everything: the pines grew up through them |
| gold is the only currency in a match (the coins that buy skins are outside the valley) | the valley pays in one thing |
| XP comes from being near when rival bodies fall, never from gold; felling pays gold only | the works pay an exile pocket money; the road is what teaches one |
| nobody dies; an exile comes back at the roost with everything; the wait grows with level | valley law; they are carried back, and the better the exile, the longer the company sits them first |
| the eagle's hp is nerve, it gusts at a crowd, it is driven off and never killed | a bird is brave only up to a point |
| only a bird leaving ends a match | the claim |
| the merchant raises your base, sells to both sides and cannot be hurt | the counter is its own guild; nobody lays a hand on one |
| the counter's items and potions have one fixed price, the same for both sides | the prices are the guild's, not the companies', and the guild does not haggle |
| robots, road towers, gold pumps and a barracks beside bows and swords | the works' machines, woken with gold; nobody knows who built them |
| three lanes, the road straight down the middle | the works' haul road, older than everything but the machines, and a track round each side by the trees |
| two road towers on every zipline, and a company's zipline runs no further than its last one standing | the works raised them to hold the haul road and gold woke their crossbows; each company strings its cable out to its own |
| a creek down the other diagonal that never freezes, but for a frozen pool where the road crosses it | the works' old outfall, still running warm under the snow; at the crossing it slows to a pool, and the pool freezes |
| a ring of cut stone round that pool, two gates on the road, its wall down in four places | THE CISTERN: the works walled the pool in and ran the haul road through it; the stone has been coming down ever since |
| an orca under that pool's ice: stand on it too long and you go down | it was there before either company, and it takes whoever is on its ice, any side |
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
| **exile** | a player's character, in a sentence of fiction (the UI and the rules say HERO) | scout, champion, soldier, unit |
| **the empire** | where every exile came from, over the pass | the kingdom, the homeland, any name |
| **company** | a team, in a sentence | faction, army, clan, nation |
| **the bird**, **the eagle** | the objective | mount, base, core |
| **roost** | where the bird sits, and the base round it | nest, camp, spawn |
| **tower**, **road tower** | the stone towers with a crossbow on top beside the road | turret, fort, outpost |
| **nerve** | the eagle's health | hp, life |
| **driven off**, **leaves** | the eagle lost | killed, destroyed, dead |
| **goes down**, **carried back** | an exile's death and return | dies, killed, corpse, respawn |
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
- **Nobody is a villain.** Not the other company, and not quite the empire either: it is too big
  to hate, and it only did what empires do. The register is a working winter, not a saga.
- **A quiet sadness is allowed, told dry.** An exile's past is what happened and what they kept,
  never how it felt: `THE STANDARD IS BROKEN NOW. HE STILL PLANTS IT.` No grief words, no
  revenge, no blood, and the valley is never a punishment: it is the place that took them.
- **It never explains a control or quotes a number.** A lore sentence says why the merchant
  sells to both sides; it does not say what a fish costs. Numbers are the other three wiki pages'.
- **It prints in capitals, in a small alphabet.** The pixel font is A-Z, 0-9 and
  `- + . , : ; ! ? / % ( ) < > ' "` (`GLYPHS`, [js/app/font.js](../../js/app/font.js)) — no long dash, no
  ampersand, no brackets — and a character it lacks prints as `?`, so a sentence is built
  without them.
- **A WORLD entry or a hero's story is three or four lines** at the slab's full width, about 70
  characters a line beside its figure. `wikiWrap` makes any length safe; no orphaned last word is
  the tuning.

## Naming

- **Plain English, often a compound**: BEARSKIN, SUNSTONE, SNOW CLOAK, ICE LANCE. No invented
  proper nouns but SOFTFALL, no apostrophe-fantasy, no real places, brands or dates.
- **A kind is named for what it is or does** (THROWING LOG, HOOKSHOT); **a perk for the
  person it makes you** (SPRINTER, FORAGER, WINTER'S CHILD: the parked cards, gameplay/roguelike-cards.md).
- **A place is THE and a plain noun** — THE ROAD, THE ROOST, THE WORKS, THE COUNTER — and a camp
  is what is in it: WOLF DEN, BLACK BEAR STONE, BROWN BEAR DEN.
- **A person is a winter word**: a tree, a weather, a small animal, a bird (`NAME_POOL`,
  [js/app/profile.js](../../js/app/profile.js)).
- **A hero is one Latin-sounding word and a title**: ARMATOS, THE LAST STANDARD; FORTIVA, THE
  UNBROKEN. The word means a winter thing or the hero's old trade; the title is what the empire
  or the valley calls them. This is the one exception to plain English, and it marks them as
  from over the pass.
- The rules are for new names. Not every shipped name follows them, and one that does not is not
  a precedent.

## Where the fiction goes

Softfall shows its world the way League does: a title on every hero, a short bio a click away
from the hero, a page for the world, and art that tells most of it. Nothing is in the way of
playing.

**It goes in:** the WORLD page; each hero's story under its wiki card; a hero's name and title;
names; event-log lines and headlines; patch notes; the README and store copy; a trailer's cards.

**It never goes in:** the HUD, a hint, a tooltip's body (that carve-out is for numbers —
[the UI rule](rendering/show-dont-label.md)), or anything a player has to read to reach PLAY:
no crawl, no cutscene, no codex to unlock. A story is behind a click for whoever goes looking,
never in front of them. The snow never has to explain itself.

## Left unanswered, on purpose

A new line may deepen these. It never settles one.

- Who built the works, and what they were for.
- What the empire is called, and why it sends its exiles over this one pass.
- What the companies are called, and who pays them.
- Where the eagles come from, and why they put up with it.
- Whether the merchants answer to anyone.
- What the machines remember that they are not telling.
- How an orca came to live in a pool in a high valley.
