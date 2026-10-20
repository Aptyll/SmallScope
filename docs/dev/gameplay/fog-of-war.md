# Fog of war

A side sees a circle round each of its heroes (`FOG_HERO`, 10 tiles), wave soldiers
(`FOG_SOLDIER`, 7) and road towers from their foot (`FOG_TOWER`,
8.5, past their reach). Everything else is dimmed, never black: terrain, buildings and both eagles stay, but a rival
player, a rival bot and every creature outside the side's sight are not there for it — not drawn on
the screen, the minimap or the M map, and not seen by its bots. Code: js/sim/fog.js (the rule),
js/draw/fog.js (the picture).

- **Stone cuts sight**: the cistern's stone (by its distance field, `cisternDist`). A sight line stops where it meets one
  (`sightReach`); the screen keeps `FOG_FACE` px past that lit so the wall's face shows.
- **Pines cast no shadow. The woods are brush instead**: a body standing on a walkable tile with
  `FOG_WOODS_N` pines or more in the 5x5 round it is hidden from a side even inside its circles,
  until one of that side's heroes or soldiers stands within `FOG_BRUSH` px (`woodsHide`).
- **Deep snow is brush too**: a body in a patch (`brushOf`) is hidden from a side until one of
  its heroes or soldiers stands in that patch or within `FOG_BRUSH_RIM` tiles of its rim
  (`brushHide`). `coverHide` asks both; `sightAt` and `fogShown` ask it
  ([deep snow](deep-snow.md)).
- **The falcon's mark sees through it**, as it sees through cover.
- **Where it is up** (`fogUp`): a match on the ground. Never the practice field, the drop's flight
  or the title tour; `DBG.fog = false` lifts it for a debug look, and the media
  kit films without it unless a scene asks (`MEDIA.boot({ fog: true })`).
- **Bots play by it.** `inSight(team, u)` is the side's answer, worked out once per unit per tick.
  Every bot sight check names its side: `seenAt(q, range, p.team)` returns 0 for a rival outside
  that side's sight, and the soldier, hunt and bot-API loops ask `inSight` straight. So a bot's
  profile sight (up to 267 px) is capped by what its side can see, and a bot never shoots into
  the fog. The CLICK scheme's lock and acquire ask the same.
- **Nothing is stored**: it is all read off where things stand. **Online, each side is sent only
  what it sees** (the `fog` banner in js/net/snapshot.js): a rival soldier, creature or shot out of
  a client's side's sight is not in its snapshot at all, and a rival player out of it comes as a
  stub (`fogHid` and the fields the rail and scoreboard show). The puffs, streams, numbers and coins
  raised out of a side's sight are left out of its cosmetics too (`netEvSeen`, asking `sightAt`).
  A client draws the host's verdict: `inSight` and `fogShown` answer no for a body with `fogHid`.
- **Shots and numbers.** A rival's arrow or rock in the fog is not drawn, nor its flame's light,
  and a damage number raised in the fog is not shown (`fogShown` on the shot or the floater).
