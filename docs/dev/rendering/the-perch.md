# The perch and its bird

A side's home is its PERCH, a disc of open ground on the lanes' loop at the middle of its end
(`basePerch`, js/sim/field.js). `beginMatch` (js/sim/eagle.js) makes both birds (`makeEagles`),
roosts each on its perch (`eagleRoost`: the bird's tiles take an `eagle` object, so walkers and
shots meet it), resets the waves (`wavesReset`, js/sim/robots.js), gives every player its start
tile a step up the lane, and sends each bird out to fly its side in (`arriveStart`).

**The arrival** (`the arrival` banner): each bird comes down onto its perch from `ARRIVE_FROM`,
behind the base, in `ARRIVE_T`, easing in and losing height (`arriveAt`, `eagleAlt`,
`eagleScale`), with its side on its back (`aboard`, `seat`, `EAGLE_SEATS`, `seatCrew`) and the
merchant on its neck (`merchAboard`; `updateMerchant` waits). It lands (`updateArrive`,
`eagleLandFx`), turns to face its lanes over `EAGLE_SETTLE_T`, and after `CREW_HOP_T` the crew
leap off onto their start tiles (`crewStep`, `crewLift`: the arc the draw lifts them by) and the
merchant hops to its post. While aboard, a player has no input and no body in the crowd
(`crewAboard`, `separateUnits`). Tools that want the match already standing call `arriveNow`.
`matchHandOver` sets `state.mode` to `play`, frames the camera on the local hero and starts the
HUD's slide-in; the camera follows the hero on the bird.

`state.drop` keeps its old name: it is `{ eagles }`, present while a match is live.

## What draws it (`eagle pixels`, js/draw/eagle.js)

- `drawEagles(ex, ey, now, air)`: both birds. `air` false is the world pass (a bird on its perch,
  y-sorted with everything else); true is the air layer, for a bird driven off and climbing away.
- `drawEagle`: one bird in its side's armour, Perch's one look (`SPRITES.perch.look`) painted at its
  heading and size in the pose of the moment, 1:1 and unrotated, its shadow its own silhouette.
- `warmPerch`: Perch's frames paint on first use, so the frames a bird is about to need are queued
  ahead (`SPRITES.perch.warm`). Render only: it reads the bird, never moves it.
- `drawPerchBar`: the roosting bird's pool, the widest bar in the world (`PERCH_BAR_SEGS` even
  segments, the chunk a hit just took holding pale before it drains through `perchLag`); while
  the order keeps it shut (`perchShut`, js/sim/towers.js) it is stone with a padlock (`drawShutBar`).
- `drawRiders`: the merchant on the neck and the side on the back during the arrival.
- `drawDropHeadline` / `drawHeadline`: PROTECT YOUR EAGLE, low in the view in your side's paint
  for the first seconds of every match (`HEADLINE_IN`, `HEADLINE_HOLD`, off the bird's own
  `restT`, so a client shows it on the same beat). This is the one headline carve-out
  ([show, don't label](show-dont-label.md)): a match has one win condition and this is the once it
  is written down (and once more in a FIRST MATCH, over their perch, js/ui/guide.js).

## Driven off

When a bird's pool runs out it takes off (`eagleFlee`) and climbs away in the air layer; the match
ends on `eagleFleeResolve`. `eagleAloft(e)` is true then and during the arrival.
