---
name: kitchen
description: Add to the Softfall Kitchen, the public website where people watch the game get made (Aptyll/softfall-kitchen): a new idea on the board, a round of art or a Short storyboard Noah has answered, or a dish he says to serve. Use after every concept-art or shorts round he answers, and whenever Noah says "add it to the kitchen", "put it on the board" or "serve it".
---

# The Kitchen

The Kitchen is Softfall's open kitchen: a static site in its own repo,
[Aptyll/softfall-kitchen](https://github.com/Aptyll/softfall-kitchen), served on GitHub Pages at
https://aptyll.github.io/softfall-kitchen/ and opened by the title's KITCHEN tab (`KITCHEN_URL`,
js/ui/notes.js). Strangers from the Shorts read it, so it shows how the game is made, rejected
rounds included.

Its README is the format (dishes, stages, rounds, art sizes); read it before an edit. Everything
the page shows is `kitchen.js` plus `art/<dish id>/`.

## When to add

- **A round:** after Noah answers a concept-art sheet or a Short's first-frame round (a letter, or
  "none of these"). Never before: a round's note says what he picked. One sheet, one round.
- **An idea:** when Noah names one for the board. His words for the name.
- **Serving:** only when Noah says so ("serve it"), never because a PR merged. Then the dish gets
  its patch and an `In the game` round with a real screenshot.

Stay out: code-only work, statistics, and anything Noah has not seen.

## How

1. `add_repo` Aptyll/softfall-kitchen (push), clone it, read its README.
2. Copy the sheet Noah saw into `art/<dish id>/round-<n>.png` (optimized PNG, under 1.5 MB) and add
   the round to the dish in `kitchen.js`: one or two short sentences in the game's voice
   ([lore.md](../../../docs/dev/lore.md)). A board idea that starts cooking moves to `cooking` and
   gets a `cover` cropped from real art.
3. Open `index.html` headless (file:// works) and look at the board and the dish.
4. Commit straight to `main` (content only, no patch number) and push. Pages updates on its own.
5. Mention it in your reply to Noah in one line.
