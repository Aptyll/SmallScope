# js/ui/wheel.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| radial menu geometry and hit math | `wheelSpan`, `wheelAng`, `wheelOptions`, `wheelLayout`, `resolveWheel` (the ping wheel: a wedge, or GO HERE on a tap), `pingWheelShown`/`PING_HOLD` (how long a press stays a tap), `WHEEL_*` | `radial wheel` |
| brackets, the E prompt (never over what the hands take on their own, never under an open counter; a merchant in reach adds its `B SHOP` cap beside it), wheel pixels, the command a pick runs | `GHOST_OK`/`GHOST_NO` (an aimed ghost's rim: the practice bar), `drawSelection`, `drawWorkHint`, `renderWheel`, `drawWheelHub`, `drawWheelStick`, `runCmd` | `selection, hints & wheel` |
| the SHOP key's cap over a merchant in reach (`B SHOP`, the counter's own key), the bare work-key cap over a zipline's cable while the body stands under either side's (`zipNear`, js/sim/zipline.js - the work key's first claim), and the arena's three caps | `drawShopHint`, `drawZipHint`, `drawBellHint`, `drawPkHint` | `selection, hints & wheel` (the resolver behind the shop's: `merchNear`, js/ui/shop.js) |
| a keybind indicator: the key cap (the bound key's face, hover and listening states), the cap + verb prompt and its footprint, and the ESC BACK / CLOSE line under a slab | `drawKeyCap`, `drawKeyPrompt`, `promptW`, `drawBackHint` (the flight HUD's two: `drawDropBind`, js/draw/eagle.js) | `selection, hints & wheel` |
