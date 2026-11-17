# A YouTube Short

Viewers decide in about a second, mostly on the first frame. So frame 0 is designed and picked
**before** anything is recorded, and Noah steers every round: never record a frame he has not
picked. This file owns the idea, frame 0, the hook and the YouTube package; filming is
[SKILL.md](SKILL.md)'s steps 2 to 5.

## Noah's rules for a Short

These repeat his project instructions, which win where the two differ (then fix this file).

- **Format.** Vertical 1080x1920, cinematic, clean backdrop.
- **Frame 0 is the peak**, or the beat just before it: one subject anyone names in a word,
  something already happening, a question raised. Hold that first beat about 1 s so it reads.
  No frozen opening.
- **One continuous timeline.** Pans, zooms and cuts are fine; skipped time and teleport-looking
  jumps are not. Actions look practical, paths are not predictable.
- **One idea a Short.** The first hero spotlights ran five abilities with name captions in ten
  seconds; Noah found them confusing and boring.
- **End on the payoff, then the end card.** No loop unless asked. The card is the kit's default
  (`"end": { "card": {} }`): Softfall, the pixel Discord mark, a white JOIN THE over a big blue
  DISCORD, no subtext.
- **Text** in the game's font at an integer scale, outlined, no box, at most 2 lines, never over
  the action.

## The loop

```
Noah: "make a Short about <rough idea>"
  -> round 1: frames A B C, each with its hook          (decision card, wait)
  -> "more" / "more like B": round 2 D E F               (decision card, wait)
  -> "B": storyboard, stage, record, cut (SKILL.md)      (its own gates)
  -> package: title, thumbnail, description, pinned comment
```

### 1. Read the idea

Take Noah's rough idea as the brief. Find its **peak**: the one moment a stranger would stop for
(scale, speed, danger, surprise). Ask only if the idea cannot be staged at all; otherwise pick a
reading and say which in one line.

### 2. A round of first frames

Three frames, lettered A, B, C, **genuinely different** (another subject, moment or framing, not
one shot nudged). Letters run on across rounds (D, E, F), so "B" always means one frame.

- **Real stills, not paintings.** Stage each in the game (`still.js`, or a quick scene and
  `rec.js --at`) at 9:16 with the HUD hidden. The Short must show what the game does, so its
  first frame must too.
- **Opening text**, if a frame has any, is drawn on the still the way the cut will draw it
  (`look.py` `text` and `stamp`).
- Lay the round out with `board.py --cols 3`, captions `A  <name>`, in
  `/mnt/project-files/shorts/<short-name>/round-N.png`. Look at it at phone size before sending.

### 3. The hook under each frame

For every letter, three short lines and a working title:

- **Sees:** what a stranger sees in the first second.
- **Wonders:** the question it opens.
- **Pays off:** what the rest of the Short shows that answers it. If nothing in the game would
  answer it, the hook is dishonest: drop that frame.

Send the board with these lines, then one decision card with your pick marked. **Stop and wait.**

### 4. More, or a pick

Each answered round (a letter, "more", or none) goes to the Kitchen as a round of its dish.

- "more", "more like B", or a note: the next round of three (variations of the named frame when
  one is named, new directions otherwise), next letters.
- A letter: that frame is the Short's frame 0. Write the beats from it: the peak inside the first
  second, then the payoff, then the end card. Open a beat before the peak so time runs straight.
  Those beats are the scene for SKILL.md step 2.

### 5. The YouTube package

With the finished cut, deliver all four together:

- **Title:** under 40 characters (the feed cuts the rest), says what frame 0 promises, nothing
  the Short does not pay off. Three options, pick marked.
- **Thumbnail:** 1080x1920, the peak frame from the cut (`cut.py --keep`), same subject as
  frame 0, readable at the size of a channel grid tile. No text unless Noah asks.
- **Description:** line one restates the hook plainly; a staged take says it is staged; then the
  Steam and Discord links and two or three hashtags (`#indiegame #pixelart #gamedev`).
- **Pinned comment:** something interesting or funny. No links: Noah adds them.

Put the description and comment in a `writing_draft_v0` card so Noah can copy them, and add the
video to its dish on the Kitchen. Links: Steam https://store.steampowered.com/app/5244550/Softfall/,
Discord https://discord.com/invite/24teKhrGb8.

## Music and numbers

- **Music.** Noah makes the tracks; the library, its codes and the cutting grid are in
  `/mnt/project-files/shorts/music-library.md`, the files in `/mnt/project-files/shorts/music/`.
  Measure a track's tempo and hits before cutting to it; `mix.py --song` lays it under the cues.
- **Numbers.** Only the ones Noah brings. They go in `/mnt/project-files/shorts/hook-lab/hooks.md`
  with the letter that shipped; its README says how to read them. Nothing in this loop waits on
  statistics.
