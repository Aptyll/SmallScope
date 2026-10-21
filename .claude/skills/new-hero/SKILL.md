---
name: new-hero
description: Build a new named Softfall hero from Noah's lore, fantasy, gameplay and abilities text, the way ARMATOS was built (0.504): kit first, in-game concept sheet, his picks, own body and skins, bots, online, one PR. Use whenever Noah says "make another hero", "new hero", or "same workflow as Armatos".
---

# A new hero, the ARMATOS way

ARMATOS, the Last Standard (PR #348, PATCH 0.504) is the worked example: read
`js/sim/armatos.js`, `js/draw/armatos.js` and `js/sprites/armatos.js` before writing a line, and
copy their shape. The mechanical list of what a hero needs is **Adding a class** in
[docs/dev/checklists.md](../../../docs/dev/checklists.md); this skill is the order and the loop
with Noah around it. New art follows the `concept-art` skill; this skill never restates it.

Say "hero", never "champion". Say "bots", never "AI".

## What Noah gives

A paste like this (missing parts get a stated default, never a question):

```
Make another hero with the same workflow as Armatos.
NAME / TITLE:
LORE:
FANTASY (how playing them should feel):
GAMEPLAY (role, range, strengths, weaknesses):
PASSIVE:
Q:
W:
E:
R:
RANKS (optional): what each key gains per rank, e.g. "Q damage 60/90/120/150/180"
LOOKS (optional): default look name, first buyable skin name
```

## The order

1. **Read and map.** Read `docs/dev/game.md`, `lore.md`, the `gameplay.md` index and only the gameplay pages the kit touches, and the Armatos files.
   Map every ability onto what already exists (`hurtUnit`, the status setters, `knockUp`,
   `shieldUnit`, tenacity through `ccMul`, `unitsNear`, `navTo`). A blow that lands after its
   key's `use()` returns (a dash, a projectile, a ground zone) passes `ab: '<row id>'` to
   `hurtUnit`, or the death recap shows it as an unnamed ability. Where the text forks on a
   detail (a range, a ring size, which body it borrows), pick a default,
   write it in the PR, and ask at most 3 one-letter questions with the pick marked. Keep going on
   the picks; never park on a question.
2. **Build the kit on a borrowed body.** One file per side, named for the hero:
   - `js/sim/<hero>.js`: its ability rows (the `ARM_AB` shape: `cd`, `cast`, `blurb`, `use`,
     `tele`, a `bot` hint saying when a bot should press it, its own `icon`; `recast`/`ok` if
     needed), its passive in `HERO_PASSIVE`,
     - **Rank numbers on every key**, League-style ([class abilities](../../../docs/dev/gameplay/class-abilities-keys-1-4.md)):
       keys 1-3 hold 5 ranks (hero levels 1/3/5/7/9), key 4 is the ultimate with 3 (6/11/16), no
       `lvReq`. Each row's `rank: { dmg: [5 numbers], stun: 1, ... }` holds its numbers (a list
       scales, a plain number stays flat) and `cd` is a list when the wait shrinks. Every rank
       raises ONE number (damage, or the effect) by a clear step; rank 1 is the number you would
       ship flat. Each row also gets a `tip`: one line of at most 40 characters, all the tooltip
       shows under the cooldown and that number (the full `blurb` stays on the wiki).
       `use()` reads them through `abRk(p, id, key)`, never a module constant, and anything a
       cast leaves in the world copies its rank numbers when it is cast. A `rank` key the
       tooltip has no words for gets a line in `AB_RANK_STAT` (js/ui/tooltip.js). Use Noah's
       RANKS line when given; otherwise scale like Armatos (`js/sim/armatos.js`) and show them.
       The `CLASSES` row's `rankOrder` is the order a bot maxes keys 1-3 (it takes R whenever it can). any entities it leaves (tick, `SAVE_ROOTS` in
     js/sim/save.js, packed in js/net/snapshot.js).
   - `js/draw/<hero>.js`: tells, rings, entities, the held weapon.
   - `js/sprites/<hero>.js`: ability icons, then bodies and weapon once picked (step 4).
   - Its `CLASSES` row in js/sim/player.js with `pos:` (the draft positions it plays, best first:
     `POSITIONS` ids, js/ui/draft.js), `body:` (the hero whose outfit it borrows
     through `heroBody`), `passive`, `base`/`grow` stats, and its own **basic attack**: an
     `attack` row (`name`, `art`, `cycle`, `kb`, and a `shot` `{ speed, life, col, look }` or a `cut`
     `{ reach, half }`; [the basic attack](../../../docs/dev/gameplay/the-basic-attack.md)). Copy the
     closest hero's row and say in the PR what you changed; a new `art` goes in
     js/sprites/weapons.js. `HERO_N` in js/app/profile.js; the 12px emblem in js/ui/menu.js; a
     build in `BOT_BUILDS` (js/sim/items.js); its name in `BOT_CALL_LOW` (js/ai/bot-api.js); the
     scripts in `index.html` in load order.
   - **Register, don't stack.** The shared sim reaches a hero only through the lists and tables
     in js/sim/heroes.js (`HERO_PASSIVE` with hurt/deal/cast/tick, `HERO_TAKEN`, `HERO_STAT`,
     `HERO_TEN`, `HERO_MOVE`, `HERO_DASH`, `HERO_TICK`, `HERO_GROUND`) and js/draw/heroes.js
     (`HERO_BLADES`, `HERO_STAVES`, `HERO_SHOTS`, `HERO_BODY_FX`). A hero file pushes into them at load. When a kit needs a kind of hook none
     of them is, add a new list there rather than a hero-named call in shared code.
3. **Concept sheet of in-game visuals.** Through the `concept-art` skill: 3 bodies and 3 weapons
   as real 16px grids, staged live in a real game frame beside players (Armatos round 4,
   `/mnt/project-files/armatos/round4/`). Noah rejected 3D renders and 32px art: show what the
   game will draw, lettered, with a pick marked. Wait for his pick before step 4.
4. **Own body and skins.** The picked looks become `<HERO>_BODY` grids and a `<HERO>_SKINS` list
   (default look `price: 0`, first buyable skin `rarity: 'rare'`, 200 coins, as Armatos), a doll
   per look in `app/bake-player/bodies.py`, then `python app/bake-player/bake.py`. The rebake
   must only add lines to js/baked/motion.js: every other hero's frames stay byte-identical.
   Add the hero's tab in js/ui/skins.js (`hero:` its index). The weapon is held naturally in all
   four facings (a `HERO_BLADES` row: flat and slanted art, the grip, the hip by facing; a mage's
   staff is a `HERO_STAVES` row named by `staff:` on the `CLASSES` row, IGNIA's crook). The side run
   comes off the drawn side frame (`heroRunSide`): keep the head as wide as the front and the body
   about 2px narrower (ARMATOS: front body 10, side 8), or the run reads fat;
   a look the doll's front run does not match takes `run: 'drawn'` on its skins row (IGNIA).
5. **Verify headless** (`node app/server.js` + Playwright, [how](../../../docs/dev/checklists.md#verifying-a-change)):
   each ability hits the other team's heroes, soldiers, wildlife and towers and spares its own;
   a bot playing the hero spends all four keys; the four facings, running, rolling, both looks;
   buying the skin in the skins screen; `netEcho()` diff 0 and `netDeltaRun` with no mismatch,
   skins on; `node app/check-globals.js` clean, including the size lint. Turn off respawn
   `invuln` before capturing, or the body draws faded.
6. **Show Noah before merging.** One reply: an in-game sheet (the hero in each look, each
   ability's tell, and the four ability tooltips with their per-rank numbers) attached from `/mnt/project-files/<hero>/`, the PR link, and the open calls as
   one-letter questions. Taste-heavy work is never merged unseen.
7. **Docs and patch.** Fix every doc line the hero makes false (Armatos touched sprites,
   gameplay, multiplayer, rendering, architecture, checklists, code-map, game). Bump
   `PATCH_TXT` +0.001 over main (re-check main right before merging), one uppercase
   `PATCH_NOTES` sentence, `PATCH_DIGEST` lines, commit `PATCH 0.xxx — <NAME>, the <TITLE>`.
8. **Merge on Noah's OK**, give him `git push origin --delete <branch>`, and save the hero's
   picks to project memory (one file per hero, like `armatos-concepts`).

## Known gaps to carry, not hide

- The 48px portrait (hero row, HUD) still draws the borrowed body's model for Armatos; say so if
  the new hero has the same gap.
- No hero has been tested in a 10-human online match.
