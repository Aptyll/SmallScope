# What Softfall is

The design in one page: the shape of a match and the handful of ideas every system answers to.
Read this before proposing a feature or judging whether one fits — the *how* of each pillar is in
the deep doc it links to. Nothing here is an invariant; [CLAUDE.md](../../CLAUDE.md) carries those.

**Softfall is a browser canvas 2D top-down pixel-art three-versus-three team battle (a MOBA) on a winter map.**
Cozy and a war at once is the whole tension: the snowfield is quiet, the trees are pretty, and
five other people are on it.

## A match

Six players in `players` — **people and bots: every seat nobody takes is a bot's**, alone or in an
online lobby ([online play](multiplayer.md#online-play)) — across **two teams of three, RED vs
BLUE** (players alternate). Everyone plays one of **twenty-two heroes** (ARMATOS the defensive initiator, FORTIVA the juggernaut, BELLA the duelist, IGNIA the hearthkeeper, AURA the artillery mage, SALVIA the healer, LUCERNA the catch-and-save support, HIEMS the control mage, RUPES the engage tank, VARRO the jungler who calls wolves, BUCINA the tempo support, NIX the night scout, FABER the zone mage, VELOX the skating marksman, FALCO the diving assassin, MARIS the catch tank, LIGNUM the treeline skirmisher, SAGITTA the siege marksman, CLIVUS the climbing fighter, ARCUS the fletcher, FOSSOR the digger and PORTITOR the carrier — a human's is the one picked on the champ select's hero grid) and **starts at home**, beside
their team's armoured eagle on its perch. The map is a **Twisted Treeline in the snow**: a square
field, RED's perch at the middle of the west end and BLUE's at the east
([the bases](world.md#the-bases)). The bird sits on its perch from the first frame and is its
team's **objective**; its **merchant** keeps a stall behind it, a shop for anybody at all who
walks up. **Two lanes** join the perches, the top and the bottom halves of one rounded loop round
the middle ([the lanes](world.md#the-lanes)), the same every match and readable from anywhere.
Every thirty seconds from the first minute each side marches a **wave** of soldier bots out of its
perch down both lanes at the rival bird, one soldier more every three minutes, each lane's live
soldiers capped. Both sides get the same waves, so with nobody on a lane the two columns meet at
its middle and grind there — which side's wave gets through is decided by who walks out to it.
**Drive off the rival eagle and the match is won** — nothing else ends one: a player who goes
down waits, and is set back down at their own bird.

**Your side is always blue.** Whatever team index the roster dealt you, your allies are painted
BLUE and your enemies RED — nameplates, arrows, armour, buildings, map marks, bot names, all of
it — through one function (`skin`, js/sim/player.js) the paint goes through and the rules never do.
Every hero, you included, stands in a ring of its side's colour under a bar of the same side's colour; no soldier or beast does. Your own hero is told apart by the stamina bar and XP over it and the name's full rim.
A settings toggle (MY TEAM) shows the roster's real colours instead.
[Teams and colours](multiplayer.md#teams-and-colours).

**A walled jungle fills the inside of the loop**, and two pits open off the lanes: the
**orca's pool** above the top lane, its own frozen pond where the orca lives — anyone can walk
over it, but the orca under the ice locks on a player out on it, stalks them while a 3 2 1 counts
down over their head, and then it comes up through the ice and they go down
([the orca](gameplay/wildlife.md#the-orca)) — and the **black bear's den** below the bottom lane.

The world is 140 tiles of 16 px — a 2240×2240 px field inside a pine border, symmetric both ways
by construction. Every match plays this one map.
See [world.md](world.md#the-tile-world) and [one map](world.md#one-map).

## The pillars

**Your weapon is your hero's.** The left button is one plain MOBA basic attack that belongs to
the hero's kit (ARMATOS's OATH GREATSWORD, FORTIVA's CHAIN GREATSWORD, BELLA's EAGLE SPATHA, IGNIA's CROOK AND LANTERN, NIX's ICE DIRK, FALCO's THROWING KNIFE, AURA's STAR-GLASS, SALVIA's SNOWDROP STAFF, LUCERNA's LANTERN, HIEMS's SNOWFLAKE STAFF, FABER's CLOCK STAFF, VARRO's HUNTING SPEAR, BUCINA's HORN, RUPES's ICE MAUL, MARIS's HARPOON, LIGNUM's FELLING AXE, VELOX's STAFF SLING, SAGITTA's HEAVY ARBALEST, CLIVUS's ICE AXE, ARCUS's WILLOW LONGBOW, FOSSOR's SPADE, PORTITOR's WALKING POLE), held
to draw and released to land, and nothing on the map drops another: what grows over a match is the
hero's level and the six item slots. The **bottom bar** shows those six slots beside the
abilities at all times. [The basic attack](gameplay/the-basic-attack.md).

**Gold buys items, League's way.** Either team's **merchant's counter** sells over fifty items in
four tiers (basic, epic, boots, legendary) built out of each other, three cheap starters for the
opening purse, into six item slots, every one
always on sale at one fixed price, so you can save for the one you want. An item costs less by
every component of it you already hold, carries the hero stats, and a legendary adds one passive
(a third hit that burns, a heal out of a fight, a slow on every hit). One pair of boots at a time.
The counter's RECOMMENDED tab is your hero's build as players build it: the most picked and the best-winning paths with their pick and win rates, from every match each screen has seen or heard of through a join, and the curated build (the one bots buy) until a hero has the games. [The counter](gameplay/the-merchants-counter.md).

**No summoner spells, no runes.** A hero is its four abilities and the items it buys; nothing
else is picked before the match. No flash: the roll is everybody's.

**Keys 1-4 are your hero.** Each hero carries four active abilities of its own (ARMATOS's line
slam, brace, march and planted standard; SAGITTA's pin, pavise, crank back and long bolt; ARCUS's volley, twin nock, gather up and full quiver; FOSSOR's spadeful, under the snow, bank up and break ground; PORTITOR's supply crate, shoulder, plough on and carry home) and a
passive beside them, each key with a cooldown, a cast the body visibly performs, and effects drawn plainly for both sides: the game is readable
first, sneaky second. [Class abilities](gameplay/class-abilities-keys-1-4.md),
[Classes](multiplayer.md#classes).

**Every item is on the table from the first match.** A **wiki** on the main menu writes every
part and finished item down with its stats, passive and price, and all of it is on sale to
everybody alike, so a new player and a veteran play the same game and nothing is ground out. The same
wiki is where the game explains itself — the beasts, what a level does to them, and on its WORLD
page the valley itself: why two companies are on the snow and why nobody on it dies
([the setting](lore.md)) — one page a subject, so the snow never has to.
[The wiki](gameplay/the-wiki.md).

**The attack is League's.** A click names a mark; the hero walks into range, stops, winds up and
strikes on its own, and a shot homes in and cannot miss. The skill is in the rhythm (step, stop,
hit) and in where you stand, never in holding a button. [The basic
attack](gameplay/the-basic-attack.md#the-attack).

**Momentum is the movement.** Ice is mechanically slippery, dodges chain, and **a roll is a hit** —
the dodge is an attack, which is why a player mid-roll passes through small units instead of
colliding with them. [Momentum movement](gameplay/momentum-movement-players-only.md),
[the roll is a hit](gameplay/dodge-roll.md#the-roll-is-a-hit).

**E is the one verb for the world.** The same key harvests a tree, breaks an
enemy building, and strikes a rival's grounded eagle — and the axe it swings is never
selected, it comes out on its own for whatever is under the cursor. [The swing tools](gameplay/the-swing-tools-e.md).

**Gold is the only currency; XP is a separate number, League style.** No wood, no stone — one
currency earned many ways (last hits, kills, camps, the works, holding a gold pump, a slow trickle), each
source with its own yield profile, and it pays itself: gold is never a pickup on the ground,
every source pays the earner on the spot. **XP comes from being near when a rival body dies** —
a soldier, a hero, a camp monster — shared among the allies standing there, so the last hit
is gold and being there is XP. Felling pays gold only: **soldiers are the farm,
the woods are side income, and the road makes you level**, and the late levels come late.
[Economy](gameplay/economy-one-currency.md), [the counter](gameplay/the-merchants-counter.md),
[Hero levels](multiplayer.md#hero-levels).

**You carry gold and items, and nothing else.** The wallet (`p.gold`) is gold, and the six item
slots are the build. There is no backpack and no food pouch.

**Heals are League's.** A **health potion** (50 gold, up to five stacked in one item slot) heals
100 over 15 s on the slot's key and nothing stops it. Nothing else is eaten.
[Heals](gameplay/heals.md).

**Items are bought at a counter.** You walk to a body to get them.
[Buying and selling](gameplay/the-merchants-counter.md#buying-and-selling).

**Your eagle is your life.** The bird roosts on its side's perch from the first frame, armoured in
team colour; the perch's disc and the plaza round it are the team's base. Its hp pool is its **nerve**:
hits spook it, it calms back down between scares, it defends its own ground with a wing gust —
and when its nerve breaks it is **driven off**, not killed: every camera pans to watch it fly
away, and its whole side falls with it as it goes. **It is also the way back**: a player who
goes down waits out a timer and is set down again at the roost with everything it had — wallet, weapon and build;
death costs the wait and the walk, League-style, and a kill pays its
taker and the assists gold, more for ending a streak (a shutdown), less for a player who keeps dying. The bird is the **only objective** and the one way a
match ends, which is why both teams always have somewhere worth walking to — and why every bot
on the map knows where both birds are and what is happening at them, and answers a hit on its
own from anywhere. A side that wants out can **surrender** past fifteen minutes, League-style: a
vote calls its own bird home, so even giving up is the bird leaving
([Surrender vote](multiplayer.md#surrender-vote)). [The perch](rendering/the-perch.md),
[Death and respawn](gameplay/death-and-respawn.md), [Bots](multiplayer.md#bots).

**Roguelike cards are parked** (0.531): the cards and the treeline's chests that dropped them are
out of the game for now, to be rebuilt later. [Roguelike cards](gameplay/roguelike-cards.md).

**Nobody builds.** Every building on the map is the map's own: the lane towers and the two gold
pumps. Player building (walls, gates, turrets, bot bays
and the build list) was cut in 0.525. [Buildings](gameplay/buildings.md).

**Two gold pumps are the map's objectives**, one each side of the middle of the jungle. Heroes take one by standing in its ring with no rival hero inside
(5 s; a rival inside pauses it), and while a side holds it every hero on that side gets 20 gold
every 10 s. The ring and the pump wear the holder's colour, grey when nobody holds it; no text.
Bots take and contest them. [The gold pumps](gameplay/buildings.md#the-gold-pumps).

**Pings, League's way: tap the right button to ping GO HERE, hold it and flick for ATTACK, ON
MY WAY, DANGER or DEFEND** (G on the keyboard's CLICK scheme, where the right button walks the
body: [the click scheme](multiplayer.md#the-click-scheme)). A ping is a glyph at the spot, on the
minimap and on the chart, with a short cue, for your own side only. It is a hint, not an order:
the two bots nearest an ATTACK, ON MY WAY, DEFEND or GO HERE say ON IT and go there, and the
bots near a DANGER back off. [Pings](gameplay/pings.md), [Bots](multiplayer.md#bots).

**Pine groves make the field a jungle** (js/sim/field.js): groves with ragged edges, mirrored left to
right, the top and bottom halves grown their own way, and a creek of rough ice down the middle.
**The camps are the jungle, and the jungle is symmetric left to right.** Each side has two **SCRAP
PILES** of stray robots in the bottom half, paying gold, and a rabbit warren by its base mouth; the
top half's halls are open snow. The
**BLACK BEAR** keeps its den below the bottom lane: first out at 5:00 and back 5:00 after each
kill, which pays the whole team, gives it the BLACK BUFF, and adds a black bear to the side's count:
+5% on every blow for the rest of the match, up to four. Its twin above the top lane is the
**ORCA'S POOL**: [the orca](gameplay/wildlife.md#the-orca) under its ice, and from 20:00 up in a hole
in the middle to be fought (back 6:00 after each kill). Its kill gives the whole team the ORCA BUFF for
3 minutes: the side's soldiers near a hero wearing it hit buildings twice as hard.
Every camp is **neutral until hit** — then the whole camp comes for the hitter, leashes when
they leave its ground and runs home fast, healing and untouchable — and every site sits off the lanes, so a lane is never a
wolf's. [Camps](world.md#camps), [camp monsters](gameplay/wildlife.md#camp-monsters-neutral-until-hit).

**The lanes are where the match is fought.** The waves are the match's clock: a column that is not
met on its lane reaches the rival bird, and a scrapped soldier pays its killer gold and every
rival standing near XP — so the lane is where the fighting, the pushing and the levels are, and a base is
something to walk *out* of. **Two lane towers a side stand on each lane**: a stone tower with a
great crossbow on its deck, one on the straight and one on the bend by the perch. A tower shoots
the rival wave first, so a hero who walks in under it with their own soldiers can bring it down,
and a hero who hits one of its side's heroes in its ring, or walks in alone, gets the bolt: it
winds for a beat with a dashed line on the snow to its mark, and each bolt in a row into the same
hero hits harder. **Each side's zipline** runs down each lane from beside its perch to just
past its outer tower: E under it rides out at three times a walk, and losing a tower cuts the cable
back to the next one. [Road towers](gameplay/robots.md#road-towers), [the lanes](world.md#the-lanes), [the ziplines](world.md#the-ziplines),
[the waves](gameplay/robots.md#soldiers-the-waves).

## What the design is not

- **Not a resource tree.** One currency, deliberately. A proposal that adds a second resource is
  proposing a different game.
- **Not a deathmatch.** Kills never win a match and never end one — only the bird does. Death
  costs a wait that grows with your level and the walk back from your roost, never what you
  carried; the stake is the time a wiped side hands the other, and the objective is the only place
  a death is ever permanent.
- **Not a solo survival game.** Every mechanic runs per player off `p.input` — a hand's, a bot's
  or a remote human's in an online lobby — and `player` is only this screen's: see
  [multiplayer.md](multiplayer.md).
- **Not a game that explains itself in text.** The UI rule in [CLAUDE.md](../../CLAUDE.md) is a
  design constraint, not a style preference.
- **Not an account.** The player profile is **one name, a picture and its lifetime numbers and match history** — plus the
  hero last locked in and a record of which kinds you have held, in the browser. No passwords,
  no sign-in, nothing to log into. **Heroes are picked at the start of each match**, League
  style, and a hero is drawn only in its own looks, picked as hero skins on the skins screen, never
  body sliders. A fresh install arrives pre-named on the title, so play is one press away and nobody
  is stopped at a form. **A profile is never power**: a match reads its name and the hero picked
  and nothing else — everything about a match is decided inside that match, and every item is
  on sale to everybody alike. See [architecture.md](architecture.md#profilejs),
  [the hero grid](rendering.md#lobby) and [the profile](rendering/main-menu-title.md#the-profile). An
  online lobby sends the host that name and hero, and a **player card** to show (the picture, the
  rating, the record and the last ten matches; `cardMine`, js/app/history.js) that the match never
  reads. Each screen keeps its own **match history** (every finished match with all its seats) and
  the cards it has heard; with no server, search finds only the people met. If a server ever holds
  the profile, it holds the same objects.
