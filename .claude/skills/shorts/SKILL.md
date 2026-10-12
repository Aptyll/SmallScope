---
name: shorts
description: Plan a Softfall YouTube Short as a one-variable test, design its first frame as an honest hook, hand the filming to the media skill, and keep the Shorts log that learns from each result. Use whenever Noah asks for a Short or a Short idea, or brings back a Short's numbers.
---

# Shorts that keep viewers

The goal is viewers who stay: most swipe within about a second, judging mostly by the first frame.
This skill decides **what** to film and **what we learn**; filming is the `media` skill's job and
new art is the `concept-art` skill's. Do not restate their steps or rules here, and never write a
new recorder, editor or painter: follow those skills and [docs/dev/media.md](../../../docs/dev/media.md).

## The log

One file, `/mnt/project-files/shorts/log.md` (copy `log-template.md` beside this skill if it is
missing). It has three parts: **What we know** (rules a result proved), **Baseline** (the current
default for every variable) and **Tests** (one row per Short). Read it before anything else; re-read
it just before you write to it, and change only your own row or line.

- **Stayed %** is YouTube Studio's "Viewed" share in "Viewed vs swiped away". **APV** (average
  percentage viewed) checks the payoff. Both are read at the same age every time: **3 days** after
  posting. Noah pastes them or a screenshot; never guess a number.
- Under 500 views a row is **too few**: log it, learn nothing from it.
- A change of under 5 points against the median of the last three counted Shorts is **noise**.
- A variable joins What we know only after it wins on **two** counted Shorts, and its line names
  them. One win is a lead, written in the row, not a rule.
- High stayed % with low APV means the hook over-promised: log it as a broken hook, not a win.

## Steps

1. **Pick the test.** From the log, choose one variable to change (the list below); every other
   variable stays at Baseline. Never retest a rule in What we know without a reason. Write the
   row now: number, variable, baseline value, this value, and a one-line bet ("opening on the bear
   mid-swing beats opening on the walk-up").
2. **Find the moment.** Name the single most striking thing the Short shows, the thing a stranger
   would stop for: scale (a 2x bear over a player), speed (a gallop), danger (a one-shot), a
   surprise. It must be something the game really does; if staging needs the game to behave
   differently, that is a game change and a PR, per the media rules.
3. **Write the first frame** in three lines before filming, as a stranger would read it with no
   sound and no title:
   - **Subject:** one thing, big enough to read on a phone, that anyone names in a word.
   - **Happening:** it is already moving or already in trouble, never posed or waiting.
   - **Gap:** a question the frame raises that the Short answers.
4. **Open on the peak, or just before it.** The peak lands inside the first second, then the Short
   explains how it got there and pays off the gap. Keep Noah's one-timeline rule: open a beat
   before the peak so time runs straight, or, if the frame opens on the peak itself, explain it with
   a visible rewind (`cut.py` negative `step`), never a hidden jump.
5. **Check frame 0 before filming.** Grab two or three candidate opening frames with the media
   kit's stills (`still.js`, `rec.js --at`), shown at phone size, lettered, a pick marked with the
   three lines from step 3. This is Noah's gate; then the board and the rest go through `media`.
6. **Film and cut with the `media` skill.** If the moment needs a sprite that does not exist yet,
   `concept-art` makes it first. Pass the first-frame lines in as the scene's opening beat.
7. **Check the payoff.** Watch the cut: does the rest answer the gap the first frame opened? If not,
   fix the cut or the hook before delivery. Staged takes are labelled staged, never "real gameplay".
8. **Deliver and log.** Add the media board card (title starts with the test number, `#4 deer
   peak-open`), finish the row's files column, and ask Noah for the numbers at 3 days.
9. **Learn.** When numbers come back, fill the row, give a verdict (win, loss, noise, too few,
   broken hook), and update Baseline and What we know only by the rules above. Then suggest the
   next test in one line.

## Variables (change one per Short)

| variable | example values |
| --- | --- |
| opening | peak itself / a beat before the peak / mid-chase |
| subject | creature / player / creature and player at scale |
| framing | close (subject fills a third) / medium / wide |
| first-frame text | none / a claim / a question (game font, max 2 lines) |
| motion in frame 0 | fast / slow / still subject, moving world |
| sound at frame 0 | hit / roar / music only |
| length | under 8 s / 8 to 15 s / over 15 s |
| topic | creature fight / riding / scenery / a new feature |
| title | statement / question / "I added X to my game" |

Add a variable to the table when a test needs one; keep its name the same across rows.

Reply to Noah in a few lines: the bet, frame 0 as an image with letters, and the one question.
