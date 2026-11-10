# Eagle drop (mode `drop`)

Everything in the `eagle drop` banner. `beginDrop()` (from `lockIn`, or `startGame`/`DBG.beginDrop`)
puts every active player aboard **its team's bird** (`p.aboard`) and builds
`state.drop = { eagles: [red, blue] }` via `makeEagles()`: **each bird flies in over
its own corner**, fixed for every match and seed: RED (team 0) from the bottom-left corner, BLUE
from the top-right, a short straight glide down the road's diagonal from `EAGLE_FROM_U` (3) u in
from the corner (every wing seat still on the map) to `EAGLE_STOOP_U` (9) u short of its
[base](../world.md#the-bases)'s **perch** (`basePerch`), where the stoop begins. The two birds never
cross the map and never meet. `e.mouth` is the side's **junction** (`roadNest(team)`,
[the road](../world.md#the-road)): where the road leaves the base's hollow, the way in for every
walker. Each flies its line dead straight (`eaglePathAt(e, u)`, the point and heading at
fraction u). `beginDrop` sets mode `drop`, snaps the world zoom tight on your seat
(`DROP_OPEN_ZOOM`, the camera clamped inside the world, since the bird starts at its corner) and
starts the menu exit, which pulls it out to `DROP_ZOOM` (the opening shot, the menu exit above).
The landing is **one shot, never a cut**: while your own bird stoops, `dropStoopZoom` (applyZoom's drop
want) walks the zoom from `DROP_ZOOM` in to your own play zoom, easing the bird's size *on screen*
(zoom × `eagleScale`) so the bird only grows as it nears, and the camera holds your seat exactly
while your bird flies, so `handOver` at the crash lands on the zoom and the framing already there.
Every rider gets a **wing seat** (`p.seat`, dealt per team in `beginDrop`; `seatPos` rotates the
`EAGLE_SEATS` offsets (one on the back, two inner wings, two out on the primaries) by the heading,
and the human sits seat 0 of their own bird); the team's **merchant** rides the neck
(`SPRITES.perch.merchSeat`, drawn by `drawEagle` ahead of the riders, see
[the merchant](../gameplay/robots.md#the-merchant)). The glide takes `EAGLE_FLIGHT_T` (2.5 s), each bird
deriving `e.spd` from its line's length. **Nobody jumps**: the whole side rides the landing.
`updateDrop` (called from `updatePlay`, so pause stops it) runs `updateEagle` per bird and keeps
every rider glued to its seat (`seatPos` at `eagleScale(e)`, the bird's drawn size: 3× in flight,
2× on the ground) through the dive and the crash. `eagleCrash` calls `landAboard` for the local
player: `handOver` flips mode `drop` → `play` (the HUD slide-in; the zoom and the camera are
already where the arrival's shot left them) and the ride's song is interrupted by the impact. A
client does the same off its snapshot when its own bird is `down` (`netClientMode`, js/net/net.js).

**Every match opens the same way**: one unbroken shot of the arrival, with no hop key and no
tour. While your bird flies the camera aims at `dropCamAim()`: your seat, leaning `DROP_CAM_LEAD`
(0.4) of the way on toward the roost it is bound for, so your base is in the shot; the lean grows
in with the opening's pull-out and is gone by the impact. Then, `CREW_HOP_T` (0.25 s) after the
crash, the **whole crew leaps off together**, humans and bots alike (`hopOff` from `updateDrop`;
while seated, E does nothing, so the merchant's counter never opens under the leap, `keyPress`'s
aboard guard, and a click order waits, `pointerPress`). The leap is a short low step off the wing
(`HOP_FALL_T`, `HOP_ALT`; every faller's arc reads `p.dropAlt`) that fans out from the bird's
centre at `HOP_SPREAD` (60 px/s), or is steered at `DRIFT_SPD` (130 px/s) like any fall;
`landPlayer` then spirals out (up to 80 tiles) to the nearest tile with no object and no water
hole, which becomes `p.spawn` (the bot brain's home tile), with 2 s of i-frames and a snow burst.
Your control starts when your boots touch, about a second after the impact. While your bird's
wings settle, **PROTECT YOUR EAGLE** comes up once under you (`drawDropHeadline`: from
`HEADLINE_IN` (0.4 s) after the crash for `HEADLINE_HOLD` (2.6 s), off the bird's own `restT` so
every screen shows it on the same beat; your side's paint at `HEADLINE_TEXT` (**four**) times the
drop HUD's text scale, `VIEW_H * HEADLINE_Y`, on **no plate**: a `HEADLINE_RIM` 2 px dark rim
carries it, baked opaque and faded as a canvas). It is the headline carve-out: the once the win
condition is ever written down. The practice field boots with its birds down and shows none.

**`state.drop` outlives the whole match** — it never goes null, because the roosts are the
objectives. A bird's life is `fly → dive → down → flee → gone` (`e.state`): at the end of its line
`beginDive` sets the crash point, `findCrashPoint`: the side's **perch** (`roadNest(team)`'s nest,
`basePerch`, at the back of its [base](../world.md#the-bases)'s hollow, on the road's diagonal),
fixed for every match and seed, so the cables are laid knowing it. The stoop runs
`EAGLE_DIVE_T` (1.4 s, `u²`-eased, wingbeats quickening, speed motes streaming) and **banks**: the
heading turns from the line's to the crash's bearing over the first part of the dive
(`e.diveH0`/`e.diveTurn`, set by `beginDive`), and the roosting bird faces the way it came down.
`eagleCrash` then clears every tree
within `BOOM_R` (3.6 tiles) outright and **paves the disc** (the pad: every snow tile in it turns
to ground `3` that frame and `addPad` registers it with the road, [world.md](../world.md#the-road),
so the roost stands on the same packed earth as the road it ends), snaps every tree beyond it
out to `BOOM_STUMP_R2` (6.0) to a stump, and clears every
bush out to the outer ring outright, so the whole disc is ground a side can build on —
**paying no gold**, a crater of free fells would warp the economy at minute one — plants the
**roost hitbox** (`eagle` objects on the open tiles within `EAGLE_TILE_R`, solid to walkers and a
rival-only E target; `eagleFlee` clears them again at liftoff), sets `e.laneDir` (the unit
vector from the roost up the road to `e.mouth`, the bearing the merchant's work reads) and drops
off the **merchant** (below), and fires `eagleBoomFx` (snow + team-colour
bursts, hanging feathers, a radial dust ring, two shockwave rings squashed flat over `BOOM_LIFE`
so they read as a blast wave along the ground, never a halo), distance-scaled `state.shake`,
`SFX.boom()` (the timber sample dropped low under a synth blast, layered on purpose) and a
`HAS LANDED` line in the event log (`logEvent`) — the landing is a landing, not a wound: the bird takes **no damage**
from its own dive. The grounded bird
is the team's **objective**, and its hp pool is its
**nerve**: `EAGLE_HP` (2000, sized as a siege, because the bots go for it),
spooked down a flat `EAGLE_ARROW_DMG` (12) per rival arrow through `hurtEagle` (the sim.js arrow
loop tests the roost tiles themselves — *before* tile solidity, which would eat the shot — so the
arrow hitbox is exactly the collision box, corners included) and `EAGLE_WORK_DMG` (20) per rival
E swing (via `hitObject`'s eagle branch) — a lone hero's E drives it off in about a minute under
the gust (a hundred swings, twelve gusts, 53 s), a pair in half that, but arrows alone take
minutes. **Every blow is audible, and one of the two cues carries off screen**: within earshot it
is the bird's own `SFX.bigHurt`, and out of earshot,
for your OWN bird only, `SFX.alarm` instead, at most one per `EAGLE_WARN_GAP` (9 s) — a siege is a
hundred blows and one piece of news. Each screen answers that for itself (`roostWarnHere`, its own
`roostWarnT` clock): the host records every blow as a `roost` event, so a guest is warned for its own side's bird too. It is not helpless: a rival inside `GUST_R` (64 — wide enough to cover a swing from the
next tile out past the roost's 3×3; resolved through `seenAt`, like every
watcher) makes it rear — wings thrown open for
`GUST_WIND_T`, the whole telegraph — then `eagleGust` throws every rival in `GUST_BLAST_R` back at
`GUST_KB` with a `GUST_STUN` tumble, on
a `GUST_CD` cooldown, dealing **no damage** — the objective punishes face-tanking, it never earns
kills. Left unhit for `PREEN_DELAY` it **preens**, recovering `PREEN_RATE` hp/s — the refilling
bar is the whole announcement, so chip damage must be pressed home. At zero nerve the bird is
**driven off, not killed**, and liftoff starts the **driven-off ceremony**, League-style:
`eagleFlee` clears the roost tiles, blasts the takeoff downdraft (`eagleGustFx` writ large,
`SFX.gust`), logs `WAS DRIVEN OFF` and sets `state.eagleCine` — the camera (its banner in
js/sim/sim.js) glides to the fleeing bird and holds it centred, `sampleHumanInput` zeroes the local
controls exactly as pause does, `hurtEagle` refuses a second flee, and `checkLastStanding` waits.
`EAGLE_CINE_T` (3.2 s) after liftoff, `eagleFleeResolve` (ticked from `updateDrop`) puts the
owning side down permanently (`die(p, null, 'eagle')` / `teamEagleDown`, which `die`,
`updateRespawns` and `teamInMatch` all gate on — see [multiplayer.md](../multiplayer.md#pvp)) and the
victory or defeat screen rises **over the escape still flying underneath** — the camera stays on
the bird through mode `dead`. The
takeoff itself: over `FLEE_LIFT_T` the bird turns from wherever the dive left it pointing to
`fleeTo` (away from the world's centre, shortest arc) while climbing; then it flies at `FLEE_SPD`
until `FLEE_T`, when it is `gone` and draws nothing ever again.

**The sky** (`drawDropSky`, the air layer's first and last strokes while your own bird is up,
`skyLift`: 1 in level flight, falling `1 − u²` down the stoop, 0 once mode `drop` ends): a pale
altitude veil (`DROP_VEIL`) over the ground under the birds, low clouds between the bird and the
pines with their flat cool shadows on the ground below (`SKY_DROP_SHADOW`, offset
`SKY_SHADOW_DX`/`DY`), and big high ones over the birds. Each layer is world-anchored on its own grid of
cells (`skyClouds`: one cloud or none per `SKY_CELL`/`SKY_CELL_OVER` cell by `hash2`), so the sky has
no edge, and slides faster than the ground by its parallax about the camera's centre
(`DROP_SKY_UNDER` 1.35, `DROP_SKY_OVER` 2.1); the stoop swells that parallax so the bird drops
through them as they fade. A cloud (`cloudSprite`, cached) is a cluster of stepped round puffs
on a 2 px block grid in three values (`SKY_LIGHT`/`SKY_MID`/`SKY_SHADE`, lit top left), never
smoothed. Pure reads of the bird's clock and the camera: nothing in it touches the match.

Drawing: `drawDropAir` (above the world, below lighting) first dots **the flight path across the
snow itself** while mode is `drop` — each flying bird's whole line dashed in its team colour, dots
crawling toward the end so the line reads as a direction — then runs `drawEagle` per bird — the
shadow `alt` px below and up to 10 px right of the body (`alt` is
`DROP_ALT` 56 px in flight, converging to 0 down the dive so shadow and bird meet at the crash
point) at the bird's **true ground size** — the roost's, not the nearer-the-camera flight size —
and beating with the same wings (`SPRITES.perch.shadow`: the silhouette of the very pose drawn,
painted at the roost's size), then the bird.
**Perch** (in its one look, `SPRITES.perch.look`, js/sprites/perch.js) is painted at
its heading and at its size, so it draws 1:1 and unrotated: in level flight a smooth stroke
(`'s' + strokeAt(e.flap, STROKE_N)`, `EAGLE_BEAT_HZ` (1) a second) at 1.5× the roost's size
(`EAGLE_SCALE` 3 over `EAGLE_REST_SCALE` 2), flying dead level; in the stoop the pose of its
progress (`'d' + round(u · DIVE_N)`): the wings tuck back off the last stroke, hold the stoop,
then flare wide to brake for the landing, shrinking to the roost's size as it falls; the riders
follow the wing they sit on (`SPRITES.perch.seat`, the same heading, pose and size). `warmPerch`
queues every frame a state will draw on its first frame in it, stepped by the same clocks the sim
runs, and the next state's frames well ahead on the perch cache's slow queue (one frame per
`IDLE_GAP`, only while nothing is urgent): in flight the stoop `beginDive` will start (its turn onto
`findCrashPoint`), at the roost the takeoff `eagleFlee` would fly; a frame not painted yet holds
the one the bird drew last. Under it the **wind trail** (`drawEagleTrail`,
drawn before the bird's own cull because it hangs behind a bird already off the frame): **one
continuous ribbon off each wingtip**, sampled every `TRAIL_STEP` (6) px back along the flown
line for `TRAIL_T` (1.1 s) of flight, each sample where the tip actually *was* on that beat —
the wing's reach and set follow the flap continuously (`TRAIL_TIP`±`TRAIL_TIP_AMP`,
`TRAIL_BACK`±`TRAIL_BACK_AMP`) and the body's bob — so the ribbon waves with the wingbeat and
hangs where it was torn while the bird flies on and the snow rushes away under it. It is solid
at the tip and fades to nothing at its tail: one linear gradient along the ribbon, a 3 px white
over a 5 px `TRAIL_RIM` dark line so white air reads over snow, the whole thing fading through
the stoop. Pure reads of the flight clock (`e.t`, `e.spd`, `e.flap`) — no particles, no sim step,
the same trail at any dt. Then **every rider seated on its wing** (`drawSeated`:
the pose set's direction picked by the heading's dominant axis — `riderDir`, so a crew flying
down-left shows its profiles — the bottom three rows tucked into the plumage so a body sits
rather than stands, the hem meeting the feathers at the seat point; **world-sized** — `riderScale(e)` is the bird's own perspective, `eagleScale / 2`:
1× on the roosting bird, 1.5× in flight because the bird itself is 1.5× bigger up there, so a
body never changes size against the feathers under it; the merchant on the neck the same way; the
local player drawn last; in flight only **your own** name rides the wing, in your side's paint (`seatedName`) under a bobbing gold arrow (`drawYouArrow`, drawn by `renderDropUI`, anchored over the tag in world space so it clears it at every zoom; both ride `flightBob`) - seven names on one bird told a new player nothing about which one was them), and a pulsing gold landing ring
in `FLIGHT_OPEN` under your own roosted bird once the brief has handed back, while you are still seated — then every faller: a `sin` **hop** off the wing
over the first quarter of the fall, then the shrink from `p.dropSc` (the seat's size as it left)
to 1× along
`alt = p.dropAlt·(1 − q²)` with a widening shadow. The faller cull is against `WV_*`, the world
pass rule — against `VIEW_*`, fallers in the far half of the zoomed-out frame vanish mid-air. A
`down` bird casts **no shadow** — it is on the ground, and a dark
copy under it read as a second bird (a roosting look keeps only the tight snow shadow painted into
its frame) — and folds its wings over `EAGLE_SETTLE_T` (the three
frames as a settle animation), then **rests**, breathing a ±1 px bob with a wing-shuffle idle
every 3.5–7 s (`RUFFLE_T`, mid frame only with a puff of settling snow — the full spread stays
the gust's telegraph, so the idle can never cry wolf), flashing all white when hit (`SPRITES.perch.flash` of the frame drawn: it is taller than the 128×128 `drawSpriteFlash` scratch),
with its team-colour hp bar (`drawPerchBar`: `PERCH_BAR_W` x `PERCH_BAR_H` in a `PERCH_BAR_RIM` ink frame, in `PERCH_BAR_SEGS` even segments, the biggest bar in the world since the match is won and lost on it; the chunk a hit takes holds pale `PERCH_LAG_HOLD` then drains at `PERCH_LAG_RATE`, a render-side `perchLag`; the pool's number sits inside; never on an end screen, `endScreen()`, like every other tell) up **from the moment it roosts** — the bar is the objective's
introduction, anchored to the bird's rotated extent; no nameplate over it, the bar alone names the objective. A gust windup draws wings thrown open
(frame 0) lifted 2 px: the spread IS the telegraph, no text. Perch roosts landed with its
wings half open and the crew's saddle on its back (`'r' + beat`, at the roost's size, the three
beats as wing turns, its seats again `SPRITES.perch.seat`). A `flee` bird climbs back out —
scale and `alt` walk from the roost's numbers to the flight's over `FLEE_LIFT_T`, the shadow
returning and diverging as the ground falls away, wingbeats at full panic (`perchLiftBeat`, counted
from the takeoff's first downstroke, so the roost can warm the whole climb: Perch's `'l'` poses) — and fades over the
last 1.4 s of `FLEE_T`; `gone` draws nothing. `renderDropUI` (mode `drop` only) draws your gold arrow while you ride,
`WASD - DRIFT` while falling; and an `M - MAP` keybind indicator bottom right (`drawDropBind`) —
the ride's wider read is the **M map** (`renderWorldMap` also runs in mode `drop`, where it
draws each flying bird's line dashed in team colour with the bird diamond riding it; M/Esc are
handled in input.js's drop branch, a click only closes the map, and the sim keeps running
under it). Text scale follows the view (2× when tall). Once `down`, both objectives are marked on
the minimap disc and the M map as the same bird diamond in team colour.

Airborne players (`inAir(p)`: aboard or `dropT > 0`) are skipped by `updatePlayer`/`updateAI`, arrows,
wildlife scares, `enemyOf`, the y-sorted draws, the minimap and the M map. The god rays answer
the ride alone (`rayLight` asks `aboard`/`dropT`, never `inAir`).
