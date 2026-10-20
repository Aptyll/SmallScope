# Replay: the last four seconds

The `replay` banner keeps a rolling four seconds of the world and plays it back while you
are **dead** or **paused**, in one of two shapes (`rpFull()`/`rpRect()`):

- **The recap**, on a **death** (a respawn wait or an elimination, once `deadReady()` — half a
  second of dim — has landed): the **whole frame**, the way a goal replays. The countdown reads
  over it on a wait; the spectate strip, the death dim, its headline and its planks wait
  underneath (`renderDead` returns early while `replayFull()`). A close box sits inside the
  frame's top-right corner (`rpCloseRect`/`rpCloseHit`, a 12 px plank with a cross that lights
  gold under the pointer), an **ESC BACK** prompt at its foot (`drawKeyPrompt` with the `esc`
  action, so a pad wears its B), and `deadKey` takes ESC, BACKSPACE, ENTER and SPACE as
  `replayClose()` — a pad's B arrives as escape. `state.rpClosed`
  remembers, reset by every `endMatch`, so it opens once per death.
- **The window**, on **pause**: the **bottom-left corner** at `RP_W`×`RP_H` (160×90), under the
  pause planks.

Never over [the end screens](the-end-screens.md).
It records pixels, not state, so it costs nothing to keep and re-renders nothing to play.

**Where each draws.** The recap draws in the game canvas: the capture is the **world layer**
(`worldCv`, one sample per world px, before the blit scales it), and each frame keeps the device
px per world px it was blitted at live (`rpFK`). Drawn back from the same top-left corner at that
same scale, nearest-neighbour, every world px lands on the same k×k block of device px it had
live, so the recap is **pixel for pixel at any resting zoom**, zoomed in or not. Only a view wider
than the cap (`RP_CAP_W`×`RP_CAP_H`, 640×360 world px, i.e. zoomed out past the default) is
reduced. The snowfall and the vignettes draw after the blit and the HUD after the capture, so
none of them is in it. The corner window cannot do that: 160×90 *game* px hold a sixteenth of the view,
and the detail is gone before anything is drawn. The same corner of the *screen* is
`RP_W * devScale` px across (480 device px at a 1080p fullscreen's 3×), so its frame goes to its
own canvas, `#replay` (z-order above `#game`, `pointer-events: none`), positioned over the
window's rect by `layoutReplay()` — which `relayout()` calls, so it follows every resize and
fullscreen toggle, and which `renderReplay` calls again whenever the rect it laid out (`rpKey`)
is not the one `rpRect()` now returns. The game canvas draws only the plate, the frost rim, the
playhead and a low-res copy underneath, which keeps the window legible in a plain
`canvas.toDataURL()` capture (`POST /shot`) and is covered exactly by the overlay on screen. The
recap hides the overlay outright (`rpOverlay(false)`), which is why its close box and prompt can
sit *inside* the frame.

Fullscreen here is the browser's (F11), which fullscreens the document, so a `position: fixed`
sibling still renders. Calling `requestFullscreen()` on `#game` itself would render *only* that
element and the replay window would vanish — fullscreen the document, or move the overlay inside
whatever element goes fullscreen.

**The ring.** `replayTick(now)` runs once per frame from the pass order above and owns the clock
(one `Math.min(0.05, …)` delta feeds both the capture cadence and the playhead). While
`replayLive()` — mode `play`, the local player alive, and no overlay freezing the sim, i.e. exactly
the condition `update()` steps on, and on through the local player's own
[fall](going-down.md) (`goingDown`) so the recap ends on it — it blits the finished world layer into
slot `rpHead` of one atlas canvas every `1/RP_FPS` s and wraps. `RP_SECS` 4 × `RP_FPS` 30 = `RP_N`
120 slots, `RP_COLS` 12 across; `RP_RATE` 1 plays it back in real time. `replayShowing()` holds the
recap back until the fall is over.

**Capture resolution is the world's.** `rpTarget()` is the world view (`WV_W`×`WV_H`) in world
px, reduced only past the memory cap and never an upscale, plus the device px each captured px
covered on screen. At the default zoom and closer it is a 1:1 copy; past the cap `rpAtx` keeps
smoothing on for the reduction (nearest would strobe an arrow in flight).

**A resize does not cost frames.** Each slot records the size it was captured at (`rpFW`/`rpFH`),
so a change in view or zoom changes what the *next* frames look like and leaves the banked ones
alone. If the new size needs a bigger slot, `rpEnsure()` allocates a larger atlas and re-blits
every banked frame into it at its own resolution — only ever upward, so dragging a window about
does not reallocate on every step. Playback resizes the overlay's backing store to whatever the
current frame was captured at (the CSS size stays put), which is why a replay spanning a resize
changes sharpness mid-loop instead of jumping size or losing its history.

**Memory** is `RP_CAP_W * RP_CAP_H * 4 * RP_N` at the ceiling — 110 MB, and the ring only grows to
what a given window actually captures (a small window stays near 12 MB). This is the price of a
recap that comes back pixel for pixel: it is the biggest allocation in the game, twice the 55 MB
baked ground. `RP_CAP_*`, `RP_FPS` and `RP_SECS` are the knobs.

**Per-frame cost while alive** is one `drawImage` at `RP_FPS`, straight off the finished world
pass. Canvas-to-canvas stays on the GPU; `getImageData`/`toDataURL` would stall the pipeline every
capture, so neither is used, and nothing is allocated per frame.

**Playback.** `replayShowing()` decides; every fresh open restarts at the oldest frame. The
playhead advances `RP_FPS * RP_RATE` frames a second, so the four seconds take four to watch and
then loop at 30 fps on screen. The window wears the standard `#35426e` frost rim with a gold
playhead sweeping the bottom — no label and no "REPLAY" string: a looping window under a sweeping
playhead is what a recording looks like. Because the overlay is a DOM layer it is **not** covered
by anything the game canvas draws, so `renderReplay()` hides it outright when the window is down
and mirrors `state.fade` onto its `opacity` — otherwise the replay would sit there through the
LOBBY fade-out.

`DBG.replay` exposes `{ cv, frames, showing(), full(), shot, slot, bytes, W, H, fps, rate, ov }` —
`cv` is the whole filmstrip, `full()` says the recap owns the frame, and `shot`/`slot`/`bytes`
report the live capture size, slot size and atlas cost, so a headless driver can check the
resolution without playing to a death; `DBG.replayClose()` puts the recap away.
