# js/sim/weather.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the day's weather: the four rows of dials, how often each comes up, what a day rolls, and the dawn fade between them | `WEATHERS`, `WX_DIALS`, `WX_ODDS`, `WX_FADE`, `weatherOf`, `weatherNow` (the read for other systems), `stepWeather` (the dials in force: `state.wx`, core.js; the pin: `DBG.weather`) | `weather` |
| the one wind field: its strength, which way it is running, the gust over a tile, and the signed lean at a tile; the slow sweep of loose snow across the world every 15 s | `windAmp`, `windVeer`, `windGust`, `windSway`, `wsin`/`wskew`, `WIND_*`; `windSweep`, `SWEEP_EVERY`/`SWEEP_T`/`SWEEP_MIN` (drawn: `drawSweep`, js/draw/ground.js) | `wind` |
