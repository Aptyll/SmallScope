---
name: hero
description: Work on a Softfall hero: rework or polish an existing hero's kit so it is simpler, more fun and clearer to read, hide a hero from the roster or bring one back, or build a new hero from Noah's text the way ARMATOS was built. Use whenever Noah says "rework X", "polish X", "simplify X", "X's Q feels bad", "hide X", "cut the roster", "new hero", "make another hero" or "same workflow as Armatos".
---

# Heroes: rework, hide, or build new

Noah's direction (11-16): a small roster, the best 10 to 12 heroes polished hard, the rest hidden
for later. Abilities more fun and visually clear, with less complexity. So the usual job is a
**rework**; a **new hero** is rare and only on his ask.

| the ask | where |
| --- | --- |
| rework, polish or simplify a hero already in the game | **Rework or polish a hero**, below |
| cut the roster, hide a hero, bring one back | **Hide a hero, or bring one back**, below |
| a new hero | [new-hero.md](new-hero.md), after the rules below |

This skill is the order of work and the loop with Noah. The facts live elsewhere, read by section:

- what a hero needs written, file by file: **Adding a class** in
  [checklists.md](../../../docs/dev/checklists.md);
- every key of every hero, the rank rules and the tooltip: [class abilities](../../../docs/dev/gameplay/class-abilities-keys-1-4.md);
- how a hero, an effect or an icon is drawn and picked: the `art` skill, its
  [Heroes](../art/kinds.md#heroes), Effects and Icons sections;
- the worked example: `js/sim/armatos.js`, `js/draw/armatos.js`, `js/sprites/armatos.js`. Copy their shape.

Say "hero", never "champion". Say "bots", never "AI".

## What every kit holds to

- **Positive, with a clear theme.** Noah's "Heroes and tone" rules in the project instructions
  and [lore.md](../../../docs/dev/lore.md) cover the name, the story and every ability name.
  Check them before building; a grey or villain type goes to Noah first.
- **One job a key.** A stranger who watches one cast can say what it did. A second rule, a
  hidden stack or a recast has to earn its place; when unsure, cut it.
- **Each key looks like the thing it is**, and unlike any other hero's. Fewer generic rings and
  dotted lines; a circle is fine where it is the clearest read (a heal's reach, a zone). An
  effect never shows less than its true reach.
- **Ranks like League**: each rank raises one number by a clear step. The tooltip is the
  cooldown, that number and a `tip` of at most 40 characters.
- **A basic attack never knocks back.** Cosmetics never change gameplay. No 32 px hero art.
- **It plays the same for bots and online**: a `bot` row on all four keys, and the wire proofs
  in step 6 below.
- **Ids never change**: a hero's `id` and its ability row ids are in profiles, saves and the
  death recap. Rename the words, keep the id.

## Rework or polish a hero

1. **See it before reading it.** Stage every key against a rival hero and grab frames of the
   cast, the blow and what is left behind (copy `app/media/scenes/iron-verdict.js`: one hero,
   one key, one rival; `rec.js --at`). Read the four tooltips in the real HUD.
2. **Say what is wrong, one line a key**, from the frames: can't tell what it does, too many
   rules, looks like another hero's, slow or weak to press, or fine. Leave the fine ones alone.
3. **Show Noah before code when a key's design changes**: one sheet, labelled STAGED (today's
   frame per key, and under each `today -> proposed` in one line), then one decision card with
   your pick. Stay inside what he asked: a note about one key does not redesign four. A number
   change or a bug fix needs no card.
4. **Change the kit** in the hero's own files, reaching the shared sim only through the
   `HERO_*` tables. Map every blow and state onto the shared functions (CLAUDE.md, js/sim/).
5. **A new effect or icon** goes through the `art` skill: one change a round, old beside new.
6. **Verify headless**, only what changed ([how](../../../docs/dev/checklists.md#verifying-a-change)):
   the key hits the other team's heroes, soldiers, wildlife and towers and spares its own; a bot
   playing the hero still spends all four keys; `netEcho()` diff 0 and `netDeltaRun` with no
   mismatch; `node app/check-globals.js` clean.
7. **Show Noah before merging**: before and after frames of each changed key and its tooltip,
   STAGED, with the PR link. Taste-heavy work is never merged unseen.
8. **Docs and patch.** Fix the hero's rows in the class abilities page and every other doc line
   made false; one `PATCH_NOTES` sentence and a `PATCH_DIGEST` line, the number taken at merge.

## Hide a hero, or bring one back

Hidden is never deleted: the hero's files, `id`, skins and saved matches stay, and bringing it
back is one edit. Which heroes stay is Noah's pick: show him one sheet of the whole roster in
game with your 10 to 12 marked and why, as a decision card.

Hidden is a fact on the hero's `CLASSES` row, read by every list a player or a bot picks from
(the hero pick, the bots' pick in `initPlayers`, the wiki, the skins tab), never an `if` on a
name. If no such field exists yet, add it once that way. Verify: the hero is in none of those
lists, a bot never rolls it, and a profile or a saved match that names it still loads.
