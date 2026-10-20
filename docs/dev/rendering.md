# Rendering

> The party lobby that QUICKPLAY and RANKED open:
> [gameplay.md](gameplay/settings.md) (it is a lobby, not a surface of their own).

Everything that draws: the camera, the pass order, the baked panels, and the pixel cursor.
Read this before touching `render()`, adding a draw pass, or changing anything positioned off
`VIEW_W`/`VIEW_H`. The hard invariants are summarised in [../../CLAUDE.md](../../CLAUDE.md).

## Pages

Read only the page you need. Big pages list their parts at the bottom. A new section is a new
page linked here; a page past about 30 KB splits into a folder of parts.

- [One-camera fullscreen pixel rendering](rendering/one-camera-fullscreen-pixel-rendering.md) (3 KB): Every player gets the **same camera** (the SC2/League model)
- [World zoom, and the two pixel spaces](rendering/world-zoom-and-the-two-pixel-spaces.md) (10 KB): **Zoom scales the world and nothing else.** The canvas keeps its `TARGET_ROWS` size at every zoom level,...
- [Render pass order](rendering/render-pass-order.md) (16 KB): `render()` (js/draw/render.js) runs, in order
- [Show, don't label](rendering/show-dont-label.md) (2 KB): The HUD and screens speak through shape, colour and hover state
- [UI panels are baked once](rendering/ui-panels-are-baked-once.md) (8 KB): `buildMapPanel()`, `buildSettingsPanel()` and `buildHelpPanel()` draw the static chrome (parchment, labels...
- [The HUD corners](rendering/the-hud-corners.md) (3 KB): `renderUI()` owns three corners, the top edge and one strip, and every one of them is positioned off...
- [Overhead health bars](rendering/overhead-health-bars.md) (11 KB): Beside the bar sits the other thing drawn on every body alike
- [Text over the world](rendering/text-over-the-world.md) (3 KB): White pixel text on a white snowfield is unreadable with a drop shadow, so text over the world wears an...
- [Going down](rendering/going-down.md) (1 KB): A body that drops does not blink out
- [Damage feedback](rendering/damage-feedback.md) (3 KB): Combat damage is **one running total per body**, never a number per hit
- [Debug overlays: hitboxes and routes](rendering/debug-overlays-hitboxes-and-routes.md) (6 KB): What the sim tests, drawn over what the art shows — the two are deliberately different (a tree's canopy...
- [Camps on the maps](rendering/camps-on-the-maps.md) (2 KB): A camp is a *named* place, so it has to be legible on every surface that shows the world
- [The end screens](rendering/the-end-screens.md) (11 KB): A match ends on one of two full-frame ceremonies — `renderVictory` in the `victory` banner, `renderDefeat`...
- [The post-game lobby](rendering/the-post-game-lobby.md) (5 KB): The ceremony answers *what happened to me*
- [Replay: the last four seconds](rendering/replay-the-last-four-seconds.md) (6 KB): The `replay` banner keeps a rolling four seconds of the world and plays it back while you are **dead** or...
- [Scoreboard and event log](rendering/scoreboard-and-event-log.md) (2 KB): Two readouts of the **match** rather than of the world, in the `scoreboard & log` banner
- [Cursor](rendering/cursor.md) (4 KB): The native pointer is hidden over the canvas and a **pixel-art cursor is drawn in-canvas** as the very...
- [Main menu (title)](rendering/main-menu-title.md) (23 KB): `state.mode === 'title'` is a real menu, not a splash
- [Eagle drop (mode `drop`)](rendering/eagle-drop-mode-drop.md) (17 KB): Everything in the `eagle drop` banner
- [Light and weather](rendering/light-and-weather.md) (17 KB): Everything over the finished world frame, in world pixels, in `renderLighting()` (js/draw/light.js, the...
- [Drawing a thousand of something](rendering/drawing-a-thousand-of-something.md) (17 KB): **A `drawImage` whose source canvas differs from the last one cannot be batched.** The driver has to...
