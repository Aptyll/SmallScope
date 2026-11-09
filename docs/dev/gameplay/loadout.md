# The loadout: a calling and two tricks

League's runes and summoner spells, cut to three picks so a new player can read them, and named
for skill and craft rather than magic. Everything lives in [js/sim/loadout.js](../../../js/sim/loadout.js);
the champ select's wells are [js/ui/loadout.js](../../../js/ui/loadout.js).

- **A CALLING** (the keystone rune): one passive that says what kind of fighter you are. Named for
  the person it makes you ([lore](../lore.md#naming)): DUELIST, AMBUSHER, STALWART, QUICKHAND,
  OUTRIDER, WARDEN (`CALLINGS`).
- **Two TRICKS** (the summoner spells): two actives on their own keys (`TRICK_KEYS`, js/app/input.js:
  D and F under CLICK and MOUSE, Q and F on WASD), each on its own long cooldown that cooldown speed
  does not shorten: BANDAGE, TORCH, BOLAS, BULWARK, SPRINT, SHAKE OFF, CLEAVER (`TRICKS`).
  There is no FLASH: the [dodge roll](dodge-roll.md) is everybody's.

**Picked** on the champ select (`drawLoadoutPicks`): a round calling well and two square trick
wells left of LOCK IN, centred on the foot once the hero is locked; a click opens a picker row
above the well (the other trick well's pick shows dim, and taking it swaps the two), a hover
raises the card (`tipTrick`, `tipCalling`). The picks are the profile's, per hero
(`PROFILE.loadout`, keyed by the hero's name), opening on `loadoutDefault` for a hero never picked: tricks off the
seat's position (`TRICKS_BY_POS`), the calling off the hero (`CALLING_OF`). A guest's picks reach
the host as a `draft` word (`k: 'load'`, `draftLoadSend`) and ride its `hello` for the practice
field and a seat taken mid-match. The draft copy shows your side's people's picks (`load`).

**Into the match**: `beginDrop` (and `practiceSeat`) runs `loadoutStart` on every seat, which
makes `p.loadout` whole (`loadoutClean`: two different known tricks and a known calling) - this
screen's from the profile, a guest's from its word, a bot's from the defaults. The snapshot
carries `p.loadout`, `p.trickCd` and the calling's clocks `p.ks` to every screen like any body
field.

**Using a trick**: the `trick` intent (`p.input.trick`, edge-triggered, on the wire and the bot
API) is read first in `playerIntents`, before the stun drops every intent, so SHAKE OFF (`free`)
can be used stunned; `tryTrick` refuses the rest while stunned, airborne, floundering or on a
cable, on cooldown, or when the trick finds nothing to use it on (TORCH and BOLAS want a rival hero
your side can see inside `TRICK_REACH` of you, nearest the aim; CLEAVER a beast or a rival
soldier inside `CLEAVER_REACH`), and a refusal spends nothing (the well reddens: `trickDenied`).
Every effect goes through the shared setters: `igniteUnit` + `cutHeal` (TORCH), `slowUnit` +
`weakenUnit` (BOLAS), `shieldUnit` (BULWARK, kind `bulwark`), `healPlayer` (BANDAGE), `hurtUnit`
(CLEAVER). SPRINT, BANDAGE's quick step and OUTRIDER's burst are one `HERO_MOVE` entry; SHAKE
OFF's grace is a `HERO_TEN` entry; QUICKHAND's attack speed a `HERO_STAT` entry.

**The callings at the blow**: `hurtUnit` calls `loadoutDeal` before a blow lands (a DUELIST's
mark, a tangled striker's `WEAK_MUL`), `loadoutOnHit` after a player lands one on a rival hero
(the counts: `ksCount`, once a step) and `loadoutOnHurt` after a player takes one from a rival
hero (WARDEN). A calling's own blows carry `o.ks` so they never feed a count.

TORCH's heal cut is FROSTBITE's own (`cutHeal`, `TORCH_CUT` for `TORCH_T`). **One new state** joins
the [status set](status-effects-one-set-for-every-unit.md): WEAKENED (`weakT`: every blow it lands
is worth `WEAK_MUL`). Their tells, with the run's streaks and a DUELIST's mark, are
`drawLoadoutMarks` (js/draw/loadout.js).

**Bots** fly with the defaults and reach for a trick in `aiTricks` (from `updateAI`): a heal or a
shield when low, TORCH and BOLAS on the rival they fight when it is low, SHAKE OFF out of a long
hold, CLEAVER for a bear's last hit.

**The HUD** stands the two tricks in one column between the abilities and the items
(`trickCellRect`, `drawTrickCell`): the icon, the key, the cooldown sweep with its seconds.
