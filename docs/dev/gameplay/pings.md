# Pings

**A ping is a player's mark on the map for their own side: a glyph at the spot, on the minimap
and on the chart, with a short cue, and a hint the side's nearby bots act on.** It replaced the
team flags in 0.511. The sim is the `pings` banner in [js/sim/pings.js](../../../js/sim/pings.js);
the pixels are the `callout pixels` group in [js/draw/callouts.js](../../../js/draw/callouts.js);
the wheel is the `radial wheel` banner in [js/ui/wheel.js](../../../js/ui/wheel.js); how a bot
answers is the ping and back-off rungs in [js/ai/ai-ladder.js](../../../js/ai/ai-ladder.js).

## Making one

One button, `ping` (`KEY_ACTIONS`): the **right button** on WASD, **G** on CLICK and MOUSE, **R3**
on a pad, and the ping wedge of the MOUSE scheme's action wheel (`MS_WHEEL`, which stands the
wheel up for the next press to pick, its hub being GO HERE). `openPingWheel` (js/app/input.js)
opens a `state.wheel` of kind `'ping'` on the exact world point under the pointer (`wx`/`wy`) -
or over the chart or the minimap disc, pinned to the press (`sx`/`sy`, through `ckPoint`).

- **A tap is GO HERE.** The wheel draws nothing until the button has been held `PING_HOLD`
  (0.18 s) or the pointer has left the hub (`pingWheelShown`), so a tap never flashes a wheel.
- **A hold and a flick is a wedge**, `PING_WHEEL` clockwise from straight up: **ATTACK** (up),
  **ON MY WAY** (right), **DANGER** (down), **DEFEND** (left). A flick out of the hub picks even
  before the wheel shows. Let go in the hub of a shown wheel and it cancels.
- `resolveWheel` writes `input.cmd = { kind: 'ping', k, x, y }` and `runCmd` performs it next
  step through `pingCmd`, so a client's ping reaches the host like any order and `cmdOk` drops
  a malformed one.

**The spam guard** (`pingReady`): `PING_GAP` (0.4 s) between two pings of one player and at most
`PING_BURST` (3) inside `PING_WINDOW` (5 s); `p.pingLog` holds the recent times. A refused ping
does nothing at all.

## What it looks like

A ping **is a callout** (`addCallout`, js/ai/ai-callouts.js): the kinds are `PING_CALLS`, spread
into `CALLS` with `ping: true` and a life of `PING_T` (3.5 s). So it shares the list, the save
(`SAVE_ROOTS`) and the wire event, which a host sends only to the side whose `see` it is
(`netEvSeen`, js/net/net.js) - **a rival never sees or hears a ping**. Pings never count against
the bots' own callout limits (`callFree`, `aiAnswerStep`).

- **On the world** (`drawPingMark`): two pulses ring out from the spot, the spot's tick, and the
  7x7 glyph (`CALL_GLYPHS`) on a one-pixel stem over it, rimmed dark, in the ping's ink. No
  plate and no word: the glyph is the message (show, don't label).
- **On the minimap disc and the chart**: the same glyph at the spot for the whole of its life
  (`drawCalloutsMap`, `renderWorldMap`), the disc's square pulse under it for the first two beats.
- **On the wheel**: the glyph at twice its size, gold under the pick, its name under the wheel.
- **The cue**: `SFX.ping(k)` - two quick notes up, a DANGER's two notes down - for the side's
  screens only, in a match and on the practice field.

| ping | glyph | ink |
| --- | --- | --- |
| GO HERE (tap) | an arrow down onto the spot | cyan |
| ATTACK | a sword | red |
| ON MY WAY | a boot | blue |
| DANGER | a bang | orange |
| DEFEND | a shield | violet |

## What the bots do with it

Most matches are one human and nine bots, so **a ping is a hint nearby bots act on, never an
order that moves the whole side**. Only a human's ping steers (`pingSteer`); a bot's own ping
(the bot API's `ping` order) is a mark only.

- **GO HERE, ATTACK, ON MY WAY, DEFEND**: the `PING_ANSWERS` (2) bots of the side nearest the
  spot within `PING_HEAR` (1200 px) take it up - an ally may shrug it off, rolled once on the
  profile's `obey` knob, and the side's guard never leaves the bird for an ATTACK. Each says ON IT
  (`aiAnswer`, the team brain's one-at-a-time answer) and sets `ai.ping`. Rung 5a walks there for
  up to `PING_FOLLOW` (25 s) and then holds the spot `PING_STAY` seconds (GO HERE 5, ON MY WAY 6,
  ATTACK 10, DEFEND 15); rivals in sight are still rung 3's, the spot an anchor that finds them.
  An ATTACK breaks the rival buildings within `PING_R` (192 px) with E; an ATTACK covering the
  rival bird is the **push** and a DEFEND covering its own bird the **defence**, played by those
  rungs with everything they know. A ping overrides the guard, push and escort reads, but never
  the alarm (its bird under half nerve).
- **DANGER**: every bot of the side within `PING_DANGER_R` x 1.5 of the spot backs off for
  `PING_BACK_T` (6 s) - rung 2b walks it home, or straight out, fighting nothing, until it is
  `PING_DANGER_R` x 1.6 clear - and any bot walking to a ping inside the danger drops that walk.

Worker bots ignore pings: they cut the trees round their own bay and haul the gold home
([Robots](robots.md)).
