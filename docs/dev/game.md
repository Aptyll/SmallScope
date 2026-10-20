# What Softfall is

The design in one page: the shape of a match and the handful of ideas every system answers to.
Read this before proposing a feature or judging whether one fits — the *how* of each pillar is in
the deep doc it links to. Nothing here is an invariant; [CLAUDE.md](../../CLAUDE.md) carries those.

**Softfall is a browser canvas 2D top-down pixel-art cozy survival team battle on a winter map.**
Cozy and a war at once is the whole tension: the snowfield is quiet, the trees are pretty, and
nine other people are on it.

## A match

Ten players in `players` — **people and AI: every seat nobody takes is a bot's**, alone or in an
online lobby ([online play](multiplayer.md#online-play)) — across **two teams of five, RED vs
BLUE** (players alternate). Everyone plays one of **four heroes** (the ranged HUNTER, the melee
WARRIOR, ARMATOS the defensive initiator, and FORTIVA the juggernaut — a human's is the one picked on the lobby's hero row) and is **dropped in by their team's armoured eagle**, which flies in over its own corner and lands
the whole side at home; nobody starts at a spawn camp. Each side's **base** is a fixed hollow cut
into its **corner's** woods, RED always bottom-left, BLUE always top-right
([the bases](world.md#the-bases)); the bird roosts on its perch at the back and becomes its team's
**objective**; its
**merchant** climbs down and works home, never toward the fight: it pitches a stall beside
the road's head, a shop for anybody at all who walks up to it, then raises the bot bays and fells
the back woods behind the bird for logs to rebuild them; idle, it keeps to the road just up from the bird.
**Three lanes** join the bases, like a Rift: **the road** (mid) runs the map's diagonal from one
perch to the other, one straight, dry packed-earth lane, and **the top and bot lanes** curve round
either side of the valley along the treeline, each crossing the creek on a ford at the middle. All
three are there from worldgen, the same on every seed and readable from anywhere, and each leaves a
base by its own mouth of the hollow ([the road](world.md#the-road),
[the side lanes](world.md#the-side-lanes)). Half a minute after landing each merchant raises a
**barracks** (a bot bay) just inside the mid mouth, then one inside the top and bot mouths:
every thirty seconds each one marches a **wave** of soldier bots down its own lane at the rival
bird, one soldier more every three minutes, each lane's live soldiers capped. Both sides get the
same waves, so with nobody on a lane the two columns meet at its middle (the mid ones forking round
the cistern and over the stepping stones outside its wall) and grind there — which side's wave
gets through is decided by who walks out to it. **Drive off the rival eagle
and the match is won** — nothing else ends one: a player who goes down waits, and is set back
down at their own bird.

**Your side is always blue.** Whatever team index the roster dealt you, your allies are painted
BLUE and your enemies RED — nameplates, arrows, armour, buildings, map marks, bot names, all of
it — through one function (`skin`, js/sim/player.js) the paint goes through and the rules never do.
A settings toggle (MY TEAM) shows the roster's real colours instead.
[Teams and colours](multiplayer.md#teams-and-colours).

**The creek splits the valley.** One creek runs the other diagonal, corner to
corner through the woods and all, so the two roosts sit on opposite halves: it meets the road once,
at the middle, inside **the cistern**, and elsewhere it is crossed only at stepping-stone fords
(the mid waves' two just outside the cistern's wall, where it runs out under it, and one under
each side lane), or by a dodge roll
from the bank. The cistern is the works' ring of cut
stone round the crossing: the road comes in at two gates with stone sills, the wall is down in
four breaches with the fallen blocks round them, and nothing gets through the stone itself, roll
or charge. Inside, the creek pools and freezes into **the orca's lake**, both sides' alike: anyone
can walk over it, but the orca
under the ice locks on a player out on it, stalks them while a 3 2 1 counts down over their head, and then it comes up
through the ice and they go down. [The orca](gameplay/wildlife.md#the-orca). It swings round the two
midline camps in a half-loop each, so each side owns one on its own bank: the brown bear is RED's,
the black bear BLUE's, each walking its bank up and down and stopping to fish. Anyone who steps in plunges as through the ice, and a bot shoved off the
bank goes in like anybody. [The creek](world.md#the-creek), [the cistern](world.md#the-cistern).

The world is 232 tiles of 16 px — a 3712×3712 px snowfield with a forest border and an interior
threaded by frozen lakes and rivers, and **what that interior is, is a pick**: OPEN FIELD's wide
clearing, THICKET's stands with the pathways between them, or FROZEN ISLES' lake with wooded
islands standing out of it. A shape is chosen beside the character on the class screen and
changes only the interior — the border, both roosts and the road are every shape's alike, and a
grown one cuts its own packed-earth paths so the woods are never a wall.
See [world.md](world.md#the-tile-world) and [map shapes](world.md#map-shapes).

Outside the match sits one room: the **practice tool** — a small, fixed, seedless training field
cut to pure combat (a mending dummy, a perimeter target track with a bell-rung scored archery
round, and a timed ice-parkour loop through
the surrounding forest), found by breaking the ice off its menu plank. Nothing in it counts and
nothing in it is at stake. See [the practice arena](world.md#the-practice-arena).

## The pillars

**Your weapon is your hero's.** The left button is one plain MOBA basic attack that belongs to
the hero's kit (the HUNTER's SHORTBOW, the WARRIOR's LONGSWORD, ARMATOS's OATH GREATSWORD, FORTIVA's CHAIN GREATSWORD), held
to draw and released to land, and nothing on the map drops another: what grows over a match is the
hero's level and the six item slots. The **bottom bar** shows those six slots beside the
abilities at all times. [The basic attack](gameplay/the-basic-attack.md).

**Gold buys items, League's way.** Either team's **merchant's counter** sells five cheap parts and
eight finished items built out of them into six item slots, every one always on sale at one
fixed price, so you can save for the one you want. A finished item costs less by every part of it
you already hold, carries damage, health, armor, attack speed or move speed, and one passive
(a third hit that burns, a heal out of a fight, a slow on every hit). Bots buy their class's
build the same way. [The counter](gameplay/the-merchants-counter.md).

**Keys 1-4 are your class.** Each class carries four active abilities — the HUNTER's piercing
shot, net, grapple and snow cover; the WARRIOR's shield (and its slam), rush, stomp and execute — each with a
cooldown, a
cast the body visibly performs, and effects drawn plainly for both sides: the game is readable
first, sneaky second. [Class abilities](gameplay/class-abilities-keys-1-4.md),
[Classes](multiplayer.md#classes).

**Every item is on the table from the first match.** A **wiki** on the main menu writes every
part and finished item down with its stats, passive and price, and all of it is on sale to
everybody alike, so a new player and a veteran play the same game and nothing is ground out. The same
wiki is where the game explains itself — the beasts, what a level does to them, and on its WORLD
page the valley itself: why two companies are on the snow and why nobody on it dies
([the setting](lore.md)) — one page a subject, so the snow never has to.
[The wiki](gameplay/the-wiki.md).

**The draw is the ammunition.** There is no quiver: what a shot is worth — how far, how fast, how
hard — is how long the string was held, and the tool's own cycle is all that sits between one
press and the next. Spamming the button is punished by the shots themselves, short and weak, never
by a counter, so what the meter shows is exactly what you get.
[The draw](gameplay/the-swing-tools-e.md#the-draw).

**Momentum is the movement.** Ice is mechanically slippery, dodges chain, and **a roll is a hit** —
the dodge is an attack, which is why a player mid-roll passes through small units instead of
colliding with them. [Momentum movement](gameplay/momentum-movement-players-only.md),
[the roll is a hit](gameplay/dodge-roll.md#the-roll-is-a-hit).

**Snow cover goes prone and the snow covers you — and it is the hunter's.** Concealment is a real
state the world reads, not a
visual effect: everything that decides it can see a player goes through one function, and burial
lives inside it. It is a class ability (the hunter's key 4); a warrior never hides.
[Prone](gameplay/prone-under-the-snow.md).

**E is the one verb for the world.** The same key harvests a tree, breaks an
enemy building, and strikes a rival's grounded eagle — and the axe and pick it swings are never
selected, they come out on their own for whatever is under the cursor. A rock needs no key at all: it
mines itself for whoever stands by it. [The swing tools](gameplay/the-swing-tools-e.md).

**Gold is the only currency; XP is a separate number, League style.** No wood, no stone — one
currency earned many ways (last hits, kills, camps, the works, gold pumps, a slow trickle), each
source with its own yield profile, and it pays itself: gold is never a pickup on the ground,
every source pays the earner on the spot. **XP comes from being near when a rival body dies** —
a soldier, a scout, a camp monster — shared among the allies standing there, so the last hit
is gold and being there is XP. Mining, felling and fishing pay gold only: **the woods make you
rich and the road makes you level**, and the late levels come late. **Fish and berries have a fixed price**, and the counter buys them at
the same number it sells them for; a bigger fish fetches more.
[Economy](gameplay/economy-one-currency.md), [the counter](gameplay/the-merchants-counter.md),
[Hero levels](multiplayer.md#hero-levels).

**You carry a 12-cell backpack.** The wallet (`p.inv`) is gold and nothing
else, and the twelve cells (`BAG_CAP`) are for the consumables and ore a match hands you. Berries and fish are not in it: food is an uncapped **pouch**
(`p.food`) pressed on Q and F from the HUD, because a meal is never arranged, only eaten.
[Inventory and the backpack](gameplay/inventory-and-the-backpack.md).

**Items are bought at a counter.** You walk to a body to get them.
[Buying and selling](gameplay/the-merchants-counter.md#buying-and-selling).

**Your eagle is your life.** The bird that carried the team in crashes onto its base's perch and
roosts there, armoured in team colour — the hollow round it, the crater it blows (packed earth,
one ground with the road) and the bays its merchant raises at the lane mouths are the team's
starting base, an
easier opening for a new player who can help fortify before walking out. Its hp pool is its **nerve**:
hits spook it, it calms back down between scares, it defends its own ground with a wing gust —
and when its nerve breaks it is **driven off**, not killed: every camera pans to watch it fly
away, and its whole side falls with it as it goes. **It is also the way back**: a player who
goes down waits out a timer and is set down again at the roost with everything it had — wallet, bag, weapon and build;
death costs the wait and the walk, League-style, and a kill pays its
taker and the assists gold, more for ending a streak (a shutdown), less for a player who keeps dying. The bird is the **only objective** and the one way a
match ends, which is why both teams always have somewhere worth walking to — and why every bot
on the map knows where both birds are and what is happening at them, and answers a hit on its
own from anywhere. A side that wants out can **surrender** past fifteen minutes, League-style: a
vote calls its own bird home, so even giving up is the bird leaving
([Surrender vote](multiplayer.md#surrender-vote)). [Eagle drop](rendering/eagle-drop-mode-drop.md),
[Death and respawn](gameplay/death-and-respawn.md), [Bots](multiplayer.md#bots).

**Roguelike cards come out of the treeline's chests.** A sprung chest drops a **rarity-rolled
card** (and gives a free item part), which opens itself the moment it is held, one at random, without pausing the sim, and
the card is baked into the kit for the rest of the match. [Roguelike cards](gameplay/roguelike-cards.md).

**T is the build list, and the ghost under the pointer is what a click lays.** A tap opens it on
the last piece and holding T flicks a piece off a wheel. Any open snow or road tile within reach
takes a piece — a wall, a long wall R turns, a gate only your side walks through, a turret, a
gold pump, a bot bay — snapped to the
tile grid, the footprint rimmed white where it can stand, red where it cannot and grey where the
purse cannot pay, and the list stays up; a wall is dragged out as a run. Standing by a site of
your side's speeds it. Holding E beside a building of your own manages it: upgrade, repair, or
demolish — a site still going up comes back at its whole price. **An ice hole is the one site left**: break the ice twice and the hole it leaves takes the one
`water` building — a **fish net**, laid flat and walked *on* rather than into — over a live fish
population that walkers on the ice and nets draw down and a trickle refills.
[Base building](gameplay/base-building.md), [Ice holes and fishing](world.md#ice-holes-and-fishing).

**Right-click anywhere and the flag wheel offers four orders — ATTACK, DEFEND, GATHER, RALLY — and
the ring on the snow is the ground the order covers** (on the keyboard's CLICK scheme, where the
right button walks and orders the body itself, the wheel is held on G instead:
[the click scheme](multiplayer.md#the-click-scheme))**.** One flag per player, read by the whole
side: every worker bot the planter's bays roll out, and every AI teammate. Bots fly flags of
their own — a bot's flag is only ever its own decision made visible — and join a teammate's
rather than twin it, but **a human's flag is the side's whole plan**: while it stands every
bot on the team lifts its own and follows it. [Team flags](gameplay/team-flags.md),
[Robots](gameplay/robots.md), [Bots](multiplayer.md#bots).

**The camps are the jungle, and the jungle is symmetric.** Six fixed sites, three on each side of the
road, mirrored so both teams walk the same distance: four **WOLF DENS** that pay gold, and one
**BLACK BEAR STONE** and one **BROWN BEAR DEN**, each a bear patrolling one side's bank of the creek, whose kill pays and
gives the whole team that bear's own buff (the BLACK BUFF or the BROWN BUFF, which do the same thing).
Every camp is **neutral until hit** — then the whole camp comes for the hitter, leashes when
they leave its ground and heals — and every site sits well off the road, so the lane is never a
wolf's. [Camps](world.md#camps), [camp monsters](gameplay/wildlife.md#camp-monsters-neutral-until-hit).

**The lanes are where the match is fought.** The waves are the match's clock: a column that is not
met on its lane reaches the rival bird, and a scrapped soldier pays its killer gold and every
rival standing near XP — so the lane is where the fighting, the pushing and the levels are, and a base is
something to walk *out* of. A raid that wrecks a barracks thins a side's waves until its
merchant rebuilds it. **The walk out is not the fight, so a zipline compresses it**: each side
has a cable down each lane, from beside its bird along the lane's verge to short of the middle, and any body
under one clips on with E, rides either way at three times a walk, and lets go
anywhere — hands on the handle, still a target, dropped by a stun or a net, and the last stretch
into the fight always walked. **Two road towers hold each cable**: a stone tower with a
great crossbow on its deck stands beside the lane at the middle and at the end of every cable,
so six a side, and the cable runs only to the furthest one still standing, so breaking a tower takes ground back
from the rival's ride. A tower shoots the rival wave first, so a scout who walks in under it with
their own soldiers can bring it down, and a scout who hits one of its side's scouts in its ring, or
walks in alone, gets the bolt: it winds for a beat with a dashed line on the snow to its mark, and
each bolt in a row into the same scout hits harder. [Road towers](gameplay/robots.md#road-towers),
[the road](world.md#the-road), [the zipline](world.md#the-zipline),
[the ride](gameplay/momentum-movement-players-only.md#the-zipline), [the waves](gameplay/robots.md#soldiers-the-waves),
[the barracks](gameplay/base-building.md).

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
- **Not an account.** The player profile is **one name and its lifetime numbers** — plus the
  hero last locked in and a record of which kinds you have held, in the browser. No passwords,
  no sign-in, nothing to log into. **Heroes are picked at the start of each match**, League
  style, and every hero wears one fixed look; looks come back later as hero skins, never body
  sliders. A fresh install arrives pre-named on the title, so play is one press away and nobody
  is stopped at a form. **A profile is never power**: a match reads its name and the hero picked
  and nothing else — everything about a match is decided inside that match, and every item is
  on sale to everybody alike. See [architecture.md](architecture.md#profilejs),
  [the hero row](rendering.md#lobby) and [the profile card](rendering/main-menu-title.md#the-profile-card). An
  online lobby sends the host exactly that name and hero and nothing more; if a server ever
  holds the profile, it holds the same object.
