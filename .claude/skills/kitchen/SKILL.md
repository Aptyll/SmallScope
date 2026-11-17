---
name: kitchen
description: Add to the Softfall Kitchen, the public website where people watch the game get made (Aptyll/softfall-kitchen): a new idea on the board, a round of art or of a Short's first frames that Noah has answered, a finished video, or a dish he says to serve. Use after every round of the art or media skill he answers, and whenever Noah says "add it to the kitchen", "put it on the board" or "serve it".
---

# The Kitchen

The Kitchen is Softfall's open kitchen: a static site in its own repo,
[Aptyll/softfall-kitchen](https://github.com/Aptyll/softfall-kitchen), served on GitHub Pages at
https://aptyll.github.io/softfall-kitchen/ and opened by the title's KITCHEN tab (`KITCHEN_URL`,
js/ui/notes.js). Strangers from the Shorts read it, so it shows how the game is made, rejected
rounds included.

Its README is the format (dishes, stages, rounds, art and video sizes): read it before an edit and
follow it, not a memory of it. Everything the page shows is `kitchen.js` plus `art/<dish id>/`.

## What goes in, and when

| what | when | never |
| --- | --- | --- |
| **A round**: one sheet Noah saw, and what came of it | after he answers it (a letter, "more", or "none of these") | before he answers: the note says what he picked |
| **A video**: a finished Short or clip, as a round of its dish | when it is delivered | a take he has not seen |
| **An idea** on the board, named in his words | when Noah names one for the board | your own ideas |
| **Serving** a dish: its patch and an `In the game` round with a real screenshot | only when Noah says "serve it" | because a PR merged |

Stay out: code-only work, statistics, and anything Noah has not seen. No blood. Say "bots",
never "AI". Anything staged says so.

## How

1. Clone Aptyll/softfall-kitchen if the session lacks it (`add_repo`, push access) and read its README.
2. Start from its `origin/main` every time (`git fetch origin main`, then a fresh branch off it):
   a branch left from an earlier round cannot be force-pushed.
3. Copy the sheet Noah saw into `art/<dish id>/round-<n>.png` and add the round to the dish in
   `kitchen.js`: one or two short sentences in the game's voice
   ([lore.md](../../../docs/dev/lore.md)), what the round tried and what he picked. A board idea
   that starts cooking moves to `cooking` and gets a `cover` cropped from real art.
4. Open `index.html` headless (file:// works) and look at the board and the dish. The live site
   cannot be opened from a cloud thread, so this look is the check.
5. Commit on a branch `kitchen/<dish id>-round-<n>` (or the thread's own branch when only that
   one may be pushed), open a PR on Aptyll/softfall-kitchen and merge it yourself with a merge
   commit: content only, no patch number. Noah's project instructions allow this; never push
   straight to `main`. Pages updates on its own.
6. Say it in one line in your reply to Noah.
