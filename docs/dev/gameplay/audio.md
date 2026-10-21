# Audio

[js/app/audio.js](../../../js/app/audio.js) is three layers under one master dial, and `SFX` is all of them.

**Inside the step, a cue is asked for through js/net/events.js, never gated by hand.** A world
cue at a place is `sfxAt('cue', x, y[, r][, 0, arg])` (heard within `r` px, `nearPlayer`'s
default when 0; `EV_ANYWHERE` reaches every screen - the eagle's boom); a cue for one body is
`sfxFor(p, 'cue')` (a step, a nock, a refusal, a status landing on *you*); a level gained is
`sfxOwn(p, 'levelUp', 'pickup')` - one cue for the owner, another for bystanders in earshot.
Shakes go the same way (`shakeFor(p, n[, q])`, `shakeAt(x, y, n[, r])`). The why, and the bare
`SFX.cue()` outside the step, are CLAUDE.md's hard rule. Two cues still gate by hand on purpose, pending the plan's semantic events: the
roost alarm (with its plate) and the two end-of-match songs.
`SFX.stat(up)` is bare for a different reason and not an exception at all: `updateStatLedger`
runs inside the step but is the LOCAL screen's own chrome, watching the local body's kit, and a
client's snapshot moves those numbers for it.

`ensure()` builds the graph lazily: `master` (the master dial) → destination, and `sfxBus` (the
SOUNDS dial) under it. **Everything synthesised or sampled goes through `sfxBus`**, the wind bed
included — a new voice that connects to `master` directly would ignore the SOUNDS dial. The three
dial setters go through `dial(v, keep)`, which keeps the old value for anything that is not a
finite **number** — note the `typeof` test, since `+null` is `0`, not `NaN`, and a coercing guard
would let a null from a stale save clamp a whole bus to silence. Music runs *outside* this graph,
so a zeroed or broken `sfxBus` is silent while the songs play on, which is a confusing failure to
be handed and worth guarding against. Browsers
require a user gesture, so `SFX.unlock()` is called from click handlers; audio.js also arms its
own `pointerdown`/`mousedown`/`keydown` listeners, which is what actually starts the title track
(see *Music* below).

**The synth** (`tone`/`noise`) is two things: the UI blips in their own
right, and the fallback line under every sampled cue.

**Samples.** `SAMPLES` maps a key to the files behind it in `audio/sfx/`; `loadBank()` decodes all
of them on the first `ensure()`.

**The bytes come from [js/baked/sfxdata.js](../../../js/baked/sfxdata.js), not from the network.** That file is
generated — `node app/bake-sfx.js` writes every clip in `audio/sfx/` into it as base64 — and it exists
because **double-clicking `index.html` has to work** (CLAUDE.md, Run and verify): a `file://` page is
allowed neither `fetch` nor XHR against its own folder, and an unloaded bank falls back to synth
without a sound of complaint.
`bytes(f)` prefers the inline data and falls back to `fetch` for a clip that is in the folder but
not yet baked, so adding one works over http before anyone reruns the script — **rerun it before
committing, or the new sound is dead for anyone opening the file directly.** The music is
deliberately *not* baked: it is ~70 MB, and an `<audio>` element streams a relative `file://` path
perfectly well — only `fetch` is blocked. Filenames still go through
`encodeURIComponent` on the fetch path, since several carry a `#` that a raw URL reads as a
fragment. Each decoded buffer is run through `trim()`,
which finds where the sound actually starts and ends inside a clip padded out to a fixed length,
so an axe hit does not fire 200 ms late.

**`trim()` also levels the bank, and that is not cosmetic.** These files arrive at wildly
different levels, so each one gets a gain `g` bringing it to **`SMP_LUFS`** — capped at `SMP_MAXG`
so a near-silent clip is not amplified into hiss, and at `SMP_CEIL` so a lifted clip cannot clip.
Without it the quiet third of the bank is inaudible under the music at any sane master setting,
*and* no per-cue `vol` can be tuned, because the same number means something different for every
file.

**It levels on LOUDNESS, not on peak** — the loudest `SMP_WIN` seconds of the trimmed window,
K-weighted and summed across channels (ITU-R BS.1770, and `loudness()` designs its two filters at
the buffer's own rate rather than copying the standard's 48 kHz table). A peak is the one thing a
sharp click and a sustained howl have in common, so peak levelling left the bank **16 dB apart by
ear** with every file sitting at the same peak — and split cues against themselves: the two gold
coins measured 8 dB apart and `smp()` picks one at random, so the same pickup rang twice as loud
every other time. Peak keeps one job, the `SMP_CEIL` cap. A clip shorter than the window still
divides by the whole window, because a 60 ms tick *is* quieter than a 400 ms one of the same
density — without that a levelled bank turns every click into a crack. Peak is taken across **all**
channels (the files are stereo) and the silence threshold is relative to that peak — an absolute
one trims the quiet clips' own content off as if it were padding; loudness is measured over the
**trimmed** window for the same reason, or the padding drags it down.

**`vol` is therefore one ladder, and the same number means the same thing everywhere.** It reads as
a step down from `SMP_LUFS`: 0.89 is a decibel under, 0.71 three, 0.56 five, 0.4 eight — a cue that
cuts, slows or filters its clip needs a little more or less to land on the same rung. The rungs,
from the top: the rare big moments (a wingbeat, the bird struck, a level, a record, the match
lost), then the events worth turning your head for, then the work you do all match — an axe, a
pick, a hammer, gold in the purse — and at the bottom the things that never stop (a boot, a
build's tick, a notch, the wind). **Anything that repeats sits under anything that happens once**,
whatever it sounds like close up: a cue heard two hundred times a match is mixed against the two
hundredth and not the first. The whole sampled bank spans about **10 dB**, and no cue's own files
should sit more than ~2 dB apart — `SFX.debug()` prints every clip's `g` and `SFX.meter()` reads
the bus, so both are checkable without guessing.

**A failed load must never be quiet about it.** `loadBank()` counts every file into `bankStat`
(`want`/`got`/`err`), logs one console warning naming the first failure, and `SFX.banked()` reads
the tally back — the **info stack prints `SFX got/want`, red when anything is missing**. This is
not decoration: an empty bank falls back to the synth on every cue, which is indistinguishable
by ear from every cue being wired to the wrong event — never swallow those rejections. A bank that came up
empty also gets one retry on the next gesture (`retryBank`), since starting the dev server after
opening the page is the ordinary way this happens.

`smp(key, opts)` plays one, **and returns whether it handled the cue**: false means nothing has
decoded yet (or ever will — `file://`, a missing folder, a codec) and the caller falls through to
its synth line, so the game is never silent waiting on a download. It returns *true* while muted,
so a muted cue never doubles up. Every cue therefore reads
`someCue() { if (smp('key', {...})) return; ...synth... }`. `opts`: `vol`, `rate` + `jitter` (a
fraction of rate, rolled per shot, which is what stops a repeated cue sounding looped), `lp`/`hp`
filter corners, `delay`, `gap` (the minimum seconds between two of this key — insurance against
two events in one frame), and `dur`. **`dur` matters more than it looks:** several of these clips
hold more than one cue — the footstep file is a whole walking loop, the coin rolls for two seconds
— so `dur` takes one hit off the front and rides a release ramp down over its last 40 ms rather
than clicking off mid-waveform. A key with several files picks one at random per shot.

Sampled cues that sit beside a synth sibling: `coin()` (gold into the purse — an `awardGold`
payout, a bot's deposit) and `heal()` (a potion, a creek fish or a bush taken) are the world's;
`pickup()` stays the synth UI blip so menus keep an instant, identical
click. `hammer()` (finishing a structure, the merchant raising one) stands beside `place()` the same
way, with `building()` as its quieter, shorter sibling on a site's dust tick — it repeats for as
long as the build takes, so it is widely jittered and must never settle into a rhythm. `step()` is
one boot per footprint the local player leaves; `land()` is the same boot dropped an octave under a
low thump, so touching down off the eagle reads as weight rather than as an arrow connecting.
`yelp()` is a creature crying out under a hit it survived, and `monsterDie(kind)` takes the
animal's kind — a wolf yelps where a rabbit squeals.

**`buy()` is a notification cue, not a world sound**, and it is deliberately *not* jittered: it
plays `buy` (a money ding) whole when a finished item lands in a slot (`buyItem`,
js/sim/items.js), over the coin a part plays, so the purchase you saved for is told from a part by
ear.

**The notification layer is the buy ding's rule generalised: the cues in the table below, most of them not a thing in
the world making a noise.** A stepped control, a panel, a countdown, a status landing on your own
body and a warning from across the map all have to be told apart from each other *and* from the
axes and bowstrings in the same instant, and that is exactly what the synth blips do badly — half
of them are the same square wave two notes apart, which is why `pickup`/`place`/`swap` all read as
"the UI answered" and nothing more. They are **unjittered** (`jitter: 0`) for the buy ding's reason: each says
*this happened*, and a cue that arrives a little different every time reads as texture — but the
one that *is* a body in the world, `bigHurt`, keeps a 0.04 jitter.

| Cue | Says | Fired from |
| --- | --- | --- |
| `countTick()` | one whole second of a wait gone | the class screen's PLAY count (`state.menu.countT`, js/ui/menu.js) and the range's 3-2-1 (`agUpdate`, js/sim/practice.js) — never the `nock` blip, which is the sound of a bow being ready |
| `ui(open)` | a surface came up, or went away | every overlay toggle in `keyPress` (js/app/input.js): the sheet, the chart, the ESC slab, the pause plate, and each of Escape's back-outs |
| `notch()` | one step of a stepped control | the zoom rung (the `wheel` listener), the minimap's steps, and a radial wheel's wedge as the travel crosses it (`pointerMove`) |
| `wheelUp()` | a radial wheel rolled open | a ping wheel the first frame it shows (`renderWheel`), and whichever of the work key's two (roll die, range bell) the press opened |
| `record()` | a new BEST | `agEndRound` and the parkour line (js/sim/practice.js) — one cue for one meaning, on both instruments |
| `runUp(n)` / `runBroke()` | a run of hits reaching a milestone, and a run lost | `hitPTarget` every `AG_RUN_STEP` in a row (**pitched up as the run climbs** — the one place a rate is meant to be heard, because the number it tracks is the thing being climbed), and the arrow loop (js/sim/sim.js) when a run of that length ends in the snow |
| `alarm()` | **your roost is being struck and you cannot see it** | `hurtEagle` (js/sim/eagle.js) when the bird is out of earshot and it is your own — the one cue in the game that speaks for something off screen, held to one warning per `EAGLE_WARN_GAP`, and the one that arrives with a **plate**: the `roost` notice under the minimap ([the plates](../rendering/the-hud-corners/notices-the-plates-under-the-minimap.md)) and a feed line, so the ear turns your head and the corner says what happened |
| `marked()` / `dazed()` | you have been found; you are stunned out of your own hands | `markUnit`/`stunUnit` (js/sim/actions.js), **local player only and fresh applications only** — a state re-applied every second would otherwise re-ring every second |
| `nightFall()` | the cold coming down | the darkness curve crossing `NIGHT_CUE` upward (js/sim/sim.js), `dawnChime`'s opposite number |
| `warp()` | a body moved without walking it | the recall's arrival home (`sfxAt('warp')`, js/sim/recall.js) — never the dodge whoosh, the sound of air being crossed, the one thing a teleport never does |
| `spectate()` | the camera handed to another body | `specNext` (js/ui/screens.js) |
| `defeat()` | the match lost | `endMatch` (js/sim/player.js) — the sting the defeat song comes up under, as `victory()` is the win's |
| `bigHurt()` | a great bird taking a blow | `hurtEagle` within earshot — never `hurt()`, a man's winded oof. The clip is a bull at rest, so it plays `BIGHURT_RATE` (1.5) up with a 320 Hz highpass under it — pitch and the chest resonance are what separate a beast in a field from something with a beak |

**Never borrow a cue** for a new event: a borrowed cue teaches the ear the wrong thing — an
eagle that goes "oof" is a person, and two instruments that award a record two different ways
are two unrelated events.

**Ambience.** `SFX.setAmbience(on, night)` is called every frame from `update()`: on wherever the
world is live, off under the death and end screens where a song already owns the mix. audio.js
schedules a wind gust (or, once `state.darkness > 0.55`, sometimes an owl) every 11–26 s over the
synth wind bed.

**Music.** `SFX.music` streams `audio/music/` through one `HTMLAudioElement` per track — they run
minutes, and decoding them into buffers would cost tens of MB. They sit *outside* the WebAudio
graph, so `musicGain()` multiplies each element's `.volume` by its track volume, the MUSIC dial,
the master dial and mute by hand; a 50 ms `setInterval` walks the fades. `music.play(key, opts)`
crossfades (`in`/`out` seconds, `restart`), is a no-op when that key is already current, and
`music.stop(fade)` fades the whole layer out. `music.current` reads back the key; `music.el(key)`
hands out the live element, which is how a driver proves the handover chain without sitting
through five minutes of a track.

`music.hold(key, opts)` **borrows** the layer for as long as something is up on screen, and
`music.release(opts)` gives it back. A hold notes what was playing **and the second it had
reached** (`music.held`), fades it out, and the release brings it back and seeks it to that
second — so an interruption costs the listener the bars it covered rather than the whole song.
Holding twice over is still one hold: the first thing interrupted is the thing that comes back. An
ordinary `play` or `stop` clears the note, so a track that takes the layer for its own reason (a
victory, the lobby) can never be undone by a release arriving after it. The
[trading post](the-merchants-counter.md) is the one caller.

| Track | Plays from | Loops |
| --- | --- | --- |
| `intro` — FROZEN NORTH RUN INTRO | boot, and `leaveLobby()` back to the menu | yes |
| `lobby` — FROZEN NORTH RUN CLASS SELECTION | `beginLobby()`; the hero pop-up keeps it | yes |
| `eagle` — FLYING ON EAGLE | `beginDrop()` | yes |
| `jump` — JUMPING OFF EAGLE | `landAboard()` at the crash with the local player aboard (a client: `netClientMode`) | no → `foxglove` |
| `foxglove` — FOXGLOVE DROP | the end of `jump`, via `TRACKS.next` | no → silence |
| `village` — FOREST VILLAGE LOOP | `openShop()`, as a **hold**; `closeShop()` releases it | yes |
| `wiki` — WHISPERING WOODS | `beginWiki()`, as an ordinary **play**; `leaveWiki()` puts `intro` back | yes |
| `victory` — DROP THE ICE | `endMatch('won')` | yes |
| `defeat` — SLEEPY GAME SAVE | `endMatch('lost')` | yes |

The landing is a **hard cut**, not a crossfade (`{ out: 0.1, in: 0.05 }`): the ride's song is
interrupted by the impact. From there the layer runs itself — `jump` reaches its end, its `ended`
handler follows `TRACKS.next` into `foxglove`, and when *that* ends nothing follows it, so the
match plays out in silence until an end screen. `endMatch` is gated on `'won'`/`'lost'`, each with
its own song (`victory` / `defeat`); a `'respawning'` overlay is not the end of anything and must
not start either.
`toLobby()` fades the layer out under its wipe; it reloads the page, so the
title track comes back from boot.

The **title track cannot start on its own** — no gesture has happened at boot. `musicPlay` catches
the rejected `play()` promise into `pending`, and the first click or keypress starts it. This is
why the dev server ([app/server.js](../../../app/server.js)) answers Range requests: served a plain 200, an
`<audio>` element treats a multi-MB mp3 as an unbounded stream (`duration` `Infinity`) and cannot
seek in it.

The bow's rhythm has one of its own: `SFX.nock()` (a dry wooden tick when the renock clears —
deliberately near-silent, since it fires after every shot). See [the cycle](the-swing-tools-e.md#the-cycle).

[Prone](prone-under-the-snow.md) has four: `SFX.bury()` (a body dropping into deep snow — low crunch,
no pitch), `SFX.hidden()` (the cover finishing, barely there on purpose: it is the sound of *not*
being heard, and it plays with a rival somewhere close by), `SFX.rise()` (the snow shed in one
shove) and `SFX.ambush()` (the shot out of the snow landing — deeper and harder than `hit()`, with
a crack over the top, so an ambush never sounds like an ordinary arrow).

`SFX.victory()` (a four-note fanfare over a held low fifth) is the one *synth* cue longer than a
second; `endMatch` fires it the moment the match is won, as the sting the `victory` song comes up
underneath. `SFX.tally()` is the dry blip a climbing number makes on the victory screen — see
[The end screens](../rendering/the-end-screens.md) for the rest of that timeline.
