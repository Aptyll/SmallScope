# A new hero, the ARMATOS way

ARMATOS, the Last Standard (PR #348, PATCH 0.504) is the worked example. The rules every kit
holds to are in [SKILL.md](SKILL.md); this file is the order.

Noah pastes this (a missing part gets a stated default, never a question):

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

1. **Read and map.** `docs/dev/game.md`, `lore.md`, the class abilities page's rules and the
   Armatos files. Map every ability onto what already exists. Where the text forks on a detail
   (a range, a ring size), pick a default, write it in the PR, and ask at most 3 one-letter
   questions with the pick marked. Keep going on the picks; never park on a question.
2. **Build the kit on a borrowed look**: everything in **Adding a class**, with the `heroArt` row
   pointing at the closest hero's looks until step 4. Use Noah's RANKS line when given;
   otherwise scale like Armatos and show the numbers.
3. **Options for the look**, through the `art` skill's Heroes section: three bodies and three
   weapons, staged in a real game frame, lettered. Wait for Noah's pick.
4. **Own body and skins**: the picked looks ship as that Heroes section says.
5. **Verify headless**: SKILL.md's rework step 6 for all four keys, plus the four facings, running, rolling,
   every look, both teams, and buying the skin in the skins screen.
6. **Show Noah before merging**: one in-game sheet (the hero in each look, each key's tell, the
   four tooltips with their per-rank numbers) from `/mnt/project-files/<hero>/`, the PR link,
   and the open calls as decision cards.
7. **Docs and patch**: every doc line the hero makes false, then
   `PATCH 0.xxx — <NAME>, the <TITLE>` with the number taken at merge.
8. **Merge on Noah's OK**, give him `git push origin --delete <branch>`, and save the hero's
   picks to project memory.

Two hero PRs open at once collide in the shared tables and the doll bake: merge main into the
branch, redo the rebake, and never hand-merge a file under `js/baked/`.
