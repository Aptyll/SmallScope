# What a gesture answers with

**Every move of an item answers in three places at once** — the ear, the hand and the well it
landed in — and one function raises all three (`hudFx(kind, k, i)`, the `what a gesture
answers with` banner, js/ui/bag.js) — so a new well or a new gesture calls `hudFx`, never a bare
`SFX`, and cannot end up with two of the three.

The kinds (`HUD_FX`) are a language rather than a volume: **`grab`** lifting something onto the
cursor, **`place`** setting it into an empty well, **`merge`** topping a stack up, **`seat`** a
heavier `place` that no well calls now, **`swap`** an exchange, and **`deny`** a refusal. The swap is the loudest of them on purpose
— it is the one move that hands you something *back* — so it gets a cue of its own (`SFX.swap`,
two notes crossing, told from `stash`'s rising pair by ear alone), the hardest rumble, and the
only pulse on the cursor itself.

- the **ear**: the cue above.
- the **hand**: `haptic(kind)` ([the two controllers](../../multiplayer.md#the-two-controllers)) —
  a pad rumbles, a mouse cannot.
- the **eye**: the well pulses for `WELL_LIT_T` (0.3 s) in the colour of what happened
  (`wellLit`/`drawWellLit`), and on a swap the carried ghost flares gold and grows a ring for
  `DRAG_LIT_T` (0.36 s) — so the hand visibly changes contents rather than quietly doing it. Both
  age in `updateFx` beside the refusal reds.

**And the cell says what will happen before it happens.** While something rides the cursor, the
pack cell under the pointer wears a **ring** in one of three colours — blue *drops it in*, green
*tops the stack up*, gold *trades with what is there* — from `dropKindBag`, which reads the same
branches `dragDropBag` takes, so the promise and the move can never disagree. The ring is drawn
last of all (`drawDropPromise`, after `drawDragGhost`) and outside the cell's own footprint,
because the thing asking the question is an 18 px ghost sitting on an 18 px cell — a rim inside
the cell is a rim nobody ever sees.

**Shift while carrying uses the cell under the pointer.** A plain press puts the item down where
it lands, while a press begun with shift held is remembered on `state.dragPend` (`keep`) and its
release runs `sendAt(mx, my)` instead: the click spent on the pack cell under the pointer
(`sendBagCell`), leaving what is in hand in hand. Over anything else it does nothing at all,
because that promise is the whole point. Recording the modifier at the press rather than reading
it at the release is deliberate: letting go of shift mid-click cannot change what the gesture
turns out to be.
