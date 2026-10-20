# The radial wheel

One wheel serves every hold-and-flick choice in the game: the [ping wheel](pings.md), the mouse
scheme's action wheel, the parkour die and the archery range's bell. It lives in
[js/ui/wheel.js](../../../js/ui/wheel.js); its orders run through `cmdOk`/`runCmd` there.

- `state.wheel` (`{kind:'ping'|'kit'|'pkdie'|'agbell', tx, ty, seg, ax, ay}`, plus
  `sx`/`sy` on a ping wheel opened over the chart or the minimap) is the open wheel — `'ping'` is the
  [ping wheel](pings.md), `'kit'` the mouse scheme's action wheel (`MS_WHEEL`, js/app/input.js),
  `'pkdie'` the parkour roll die and `'agbell'` the archery
  range's bell, both opened by holding **E**
  beside them and resolved on its release
  ([world.md](../world.md#the-practice-arena)); ESC/M/settings/death
  close it, a left-click cancels it, and the game **keeps running** — opening the
  wheel mid-night is deliberate pressure. `wheelLayout()` is shared by `resolveWheel()` and
  `renderWheel()` so hover math and pixels can never disagree - and by `pointerMove` (js/app/input.js),
  which is what `seg` is for: it holds the wedge the cue last spoke for, so crossing into another one ticks `SFX.notch` once, for a mouse or a stick
  alike (the wheel opening itself is `SFX.wheelUp`). `resolveWheel()` does not act: it
  writes `player.input.cmd`, and `runCmd(p, c)` performs it in the next sim step (each order
  re-checks its own reach).
- **One geometry, any number of options.** `wheelSpan(n)` is `2*PI/n` and `wheelAng(i, n)` is
  `-PI/2 + i * span`: n wedges of exactly the same size, the first centred straight up and the
  rest clockwise. Nothing is special-cased per count — 4 options land on up/right/down/left and 2
  on up/down because that is what the formula gives, and 3 land 120° apart. The hover test reads
  the segment with the *same* `floor((angle + span/2) / span)` the wedges are drawn from, so a
  wedge is exactly its own hitbox at any count. `wheelOptions()` returns ids only; `wheelLayout()`
  stamps the angle on each, so there is one source for the layout.
- **Radii** (all in the `radial wheel` banner): `WHEEL_HUB` 13 is the hole in the middle,
  `WHEEL_R` 40 the rim, `WHEEL_PAD` 4 the backing disc beyond it, and `WHEEL_RING` — the midpoint
  of the band — is where every icon and label sits, so they are the same distance from the centre
  in every direction. Wedges are drawn as annulus sectors (arc out at `WHEEL_R`, arc back at
  `WHEEL_HUB`) with a `WHEEL_GAP` of daylight between them, measured in px at the rim so the gap
  looks the same however many wedges there are.
- **The hub is the cancel target.** It carries a cross rather than the word CANCEL, and goes hot
  red while the pointer is inside it — which is where the pointer starts, so the way out is the way
  you came in. `WHEEL_HUB` is also the deadzone: nothing is chosen until the pointer travels 13 px,
  which makes a plain right-click (press and release without moving) a no-op. ESC and a left-click
  both close the wheel outright, and the left-click also stops the right-release that follows from
  firing the order.
- **The pointer is measured from `ax`/`ay`, the point the press that opened the wheel went down
  at** (the pointer's spot at the press that opened it), not from
  the wheel's drawn hub: that press is what the hand remembers, and the hub is pinned to the tile,
  so it drifts as the camera follows the player and gets clamped near a screen edge. Because that
  travel is invisible (the cursor can be anywhere on screen), `drawWheelStick()` draws it at the
  hub as a knob that moves **1:1** with the pointer — so the knob is visibly inside the lit wedge —
  clamped to the lane between the hub rim and the icon ring so it never lands on an icon. Grey on
  the cross means nothing is chosen; gold out in a wedge means that is what a release will do.
