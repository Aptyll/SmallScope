# The Steam store art

The nine images Steamworks asks for, at the exact sizes it asks for them. Every one is a real
frame of the game — one staged second on **seed 7**, at the blue team's roost — with the
wordmark laid over it. `tools/` rebuilds the whole set from the seed.

| file | Steamworks slot | size |
| --- | --- | --- |
| `header-capsule.png` | Header capsule | 920×430 |
| `small-capsule.png` | Small capsule | 462×174 |
| `main-capsule.png` | Main capsule | 1232×706 |
| `vertical-capsule.png` | Vertical capsule | 748×896 |
| `page-background.png` | Page background | 1438×810 |
| `library-capsule.png` | Library capsule | 600×900 |
| `library-header.png` | Library header | 920×430 |
| `library-hero.png` | Library hero | 3840×1240 |
| `library-logo.png` | Library logo (transparent) | 1280×470 |

## The shot

The armoured eagle on its roost, the wall ring and the guns its merchant raised, a hunter at
full draw and a warrior between a rival and the bird, pines closing both edges. One scene framed
nine ways, so every capsule is plainly the same game at the same second — and the one thing the
whole game is about is in all of them: **the bird is the objective**.

The two capsules that carry no wordmark are the two Steam draws its own chrome over: the **page
background** sits behind the store page, and the **library hero** takes `library-logo.png` on top
at whatever position Steamworks is given, which is why its foot is weighted.

## Rebuilding

```
node app/server.js                                      # the page has to be served
msedge.exe --headless=new --disable-gpu --mute-audio \
  --autoplay-policy=no-user-gesture-required --hide-scrollbars \
  --force-device-scale-factor=1 --remote-debugging-port=9222 --user-data-dir=<scratch>

cd docs/media/steam/tools
node shoot.js                # capture every background frame into tools/raw/ (cold boot)
node compose.js              # ...and lay the grade, the scrim and the wordmark over them
node shoot.js -r main        # -r reuses the live page: for iterating on ONE shot
node sweep.js main -k 3 4 5  # a sheet of zoom rungs to pick a framing from (-s frames, -t hours)
node q.js "JSON.stringify(SA.tileOf(SA.mine()))"   # evaluate anything against the live page
node q.js -f map.js          # an ASCII plan of the crater, for placing the cast
node sheet.js .. 3 470       # tile the finished capsules into one sheet
```

`shoot.js` boots cold every time on purpose: staging steps the sim on, so a set shot across a
reused page is a set shot across a drifting world — by the eighth capsule the merchant has raised
another gun.

## Why it looks like this

- **Nothing is ever resampled.** Each background is captured at the capsule's exact pixel size:
  `Emulation.setDeviceMetricsOverride` makes the window that size, `fitCanvas` picks `devScale`
  from it, and `SA.shotK` sets `kWant` — which *is* image pixels per world pixel — so every world
  pixel gets the same whole square. `fitCanvas` caps the view at 16:9 and pillarboxes anything
  wider, so the three capsules wider than that are captured at 16:9 and cut from a band of it.
- **The frame is clean** — no HUD, no cursor, no name plates, no health bars. `DBG.hideUI` drops
  the HUD; `endScreen()` forced true drops every overhead tell, which is the branch `bodies.js`
  already takes on a victory screen ("a composition somebody is looking AT"); `drawWorldText`
  nulled drops the MERCH/PERCH plates and the floaters. The bird's nerve bar is the one thing
  drawn inline and gated by nothing, so `SA.clean` cuts it out of a copy of `drawEagle`'s own
  source. See `tools/stage.js`.
- **The cast is held still.** The rivals are live bodies with their brains held, placed by hand:
  a live AI wanders into the bird's wing, casts a telegraph ring over the crater, and looses
  arrows that flash the bird white. The local hunter holds a full draw and never lets go for the
  same reason.
- **The wordmark is the title screen's own.** `keylogo.js` runs the key `app/bake-logo.js` runs —
  a flood from the corners over everything that is not the letters' dark outline — over
  `docs/media/logos/mainMenuSoftfall.png` at full resolution instead of shrunk, so the capsules
  get the painted copy. The cold halo behind it is the one `renderTitle` draws.

`tools/raw/`, `tools/shots/` and the keyed `tools/logo-full.png` are generated and gitignored.
