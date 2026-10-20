---
name: shorts
description: Turn Noah's rough idea into a Softfall YouTube Short with him in the loop: three lettered first-frame options with their hooks, more rounds or a pick, then recording through the media skill, and the title, thumbnail, description and pinned comment. Use whenever Noah asks for a Short, a Short idea, or "use the shorts skill".
---

# Shorts: from a rough idea to a posted Short

Viewers decide in about a second, mostly on the first frame, so the first frame is designed and
picked **before** anything is recorded. Noah steers every round; Claude never records a frame he
has not picked. This skill owns the idea, the first frame, the hook and the YouTube package.
Filming belongs to the `media` skill and new sprites to `concept-art`: follow them, never restate
or rebuild them ([docs/dev/media.md](../../../docs/dev/media.md)).

## The loop

```
Noah: "use the shorts skill to make a Short about <rough idea>"
  -> round 1: frames A B C, each with its hook          (stop, wait)
  -> "more" / "more like B": round 2 D E F               (stop, wait)
  -> "B": record with the media skill                    (its own gates)
  -> package: title, thumbnail, description, comment
```

### 1. Read the idea

Take Noah's rough idea as the brief. Find its **peak**: the one moment a stranger would stop for
(scale, speed, danger, surprise). Only ask if the idea cannot be staged at all; otherwise pick a
reading and say which in one line.

### 2. Round of first frames

Make three first frames, lettered A, B, C, **genuinely different** (another subject, moment or
framing, not one shot nudged). Letters run on across rounds (D, E, F), as `concept-art` does, so
"B" always means one frame.

- **Real stills, not paintings.** Stage each in the game with the media kit (`still.js`, or a
  quick scene and `rec.js --at`) at 9:16, HUD hidden (`DBG.hideUI`). The Short must show what the
  game does, so its first frame must too. If the idea needs a creature or prop the game lacks,
  that sprite goes through `concept-art` first and Noah picks it before any frame uses it.
- **Opening text**, if a frame has any, is drawn on the still the way the cut will draw it
  (`look.py` `text` and `stamp`: game font, integer scale, outline, no box, at most 2 lines).
- Each frame must pass, at phone size: **one subject** anyone names in a word, big enough to read;
  something **already happening**, never posed or waiting; a **question** the frame raises.
- Lay the round out with `board.py --cols 3`, captions `A  <name>`, in
  `/mnt/project-files/shorts/<short-name>/round-N.png`. Look at it yourself before sending.

### 3. Hook text under each frame

For every letter, three short lines:

- **Sees:** what a stranger sees in the first second.
- **Wonders:** the question it opens.
- **Pays off:** what the rest of the Short shows that answers it. If nothing in the game would
  answer it, the hook is dishonest: drop that frame.

Add one working title per letter. Send the board image with these lines, your pick and why, then
**stop and wait**.

### 4. Iterate or pick

Each answered round (a letter, "more", or none) goes to the Kitchen as a round of its dish (the
`kitchen` skill).

- "more", "more like B", or a note: make the next round of three (variations of the named frame
  when one is named, new directions otherwise), same rules, next letters.
- A letter: that frame is the Short's frame 0. Write the beats from it: peak inside the first
  second, then how it got there, then the payoff and the end card. Hand that to the `media` skill,
  which boards, stages, records and cuts with its own gates. Open a beat before the peak so time
  runs straight; if frame 0 is the peak itself, the explanation is a visible rewind (`cut.py`
  negative `step`), never a hidden jump.

### 5. Package for YouTube

With the finished cut, deliver all four together:

- **Title:** under 40 characters (the feed cuts the rest), says what frame 0 promises, no clickbait
  the Short does not pay off. Three options, pick marked.
- **Thumbnail:** 1080x1920, the peak frame from the cut (`cut.py --keep`), same subject as frame 0,
  readable at the size of a channel grid tile. No text unless Noah asks.
- **Description:** line one restates the hook plainly; then Steam and Discord links; two or three
  hashtags (`#indiegame #pixelart #gamedev`). Staged takes never say "real gameplay".
- **Pinned comment:** the reason to act now (a playtest date, a question for viewers), with the
  Discord link. Dates go here, not on the end card.

Put the description and comment in a `writing_draft_v0` card so Noah can copy them, and add the
video to its dish on the Kitchen (the `kitchen` skill). Links: Steam https://store.steampowered.com/app/5244550/Softfall/,
Discord https://discord.com/invite/24teKhrGb8.

## After posting

If Noah brings numbers back, add a row to `/mnt/project-files/shorts/log.md` with the letter that
was used. Nothing else in this flow waits on statistics.
