# js/sim/tunnel.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the burrow's tunnels: the tuning, the one placement rule, the dig order, the holes standing and caving, the far end, going under and coming up, and the step that runs it all | `TUN_*`, `tunSiteOk`, `tunPlaceOk`, `digTunnel` (the `tunnel` order: `runCmd`, js/ui/wheel.js), `tunHoleOf`/`tunHoles`, `caveTunnel`, `tunFarSite`, `tunnelEnter` (ahead of the swing in `playerSwing`, sim.js; `p.tunE` the fresh press), `tunUnder`, `tunnelExit`, `updateTunnels` (from `updatePlay`, sim.js) | `tunnels` (the hole's `OBJECTS` row: world.js; the rider out of the world: `inAir`, player.js; the drop: `animalDies`, wildlife.js; the state: `p.tun`/`p.tunCd`/`p.digT`/`p.tunHole`, player.js) |
| the aim: the local hand's ghost, standing it up and putting it away, and the press that sends the order; the burrow's icon | `tunnelAimToggle` (V: `keyPress`, input.js; a click on its pack cell: `ITEMS.tunnel.use`, run by `sendBagCell`), `tunnelAimTile`, `tunnelAimPress` (`pointerPress`, input.js), `state.tunAim` (in `SAVE_STATE_SKIP`), `SPRITES.itemTunnel` | `tunnels` › `the aim` |
