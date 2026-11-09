# js/sim/loadout.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the tricks: each one's name, cooldown, card line, number and use; their reaches and timings | `TRICKS`, `TRICK_IDS`, `TRICK_N`, `TRICK_REACH`, `TRICK_ALLY_R`, `CLEAVER_REACH`, `SPRINT_*`, `BANDAGE_RUN_*`, `SHAKE_*`, `TORCH_T`, `BOLAS_*`, `WEAK_MUL`, `TORCH_CUT`, `trickBandage` .. `trickCleaver` | `loadout` |
| the callings and their numbers | `CALLINGS`, `CALLING_IDS`, `DUELIST_*`, `AMBUSH_*`, `STALWART_*`, `QUICK_*`, `OUTRIDE_*`, `WARDEN_*` | `loadout` |
| the defaults (a bot's, and a hero never picked), a record made whole, the short string form | `TRICKS_BY_POS`, `TRICKS_ANY`, `CALLING_OF`, `callingFor`, `loadoutDefault`, `loadoutClean`, `loadoutStr`, `loadoutParse` | `loadout` |
| every seat's picks as the match starts | `loadoutStart` (from `beginDrop`, js/sim/eagle.js; `practiceSeat`, js/sim/practice.js; `netHostHello`) | `loadout` |
| a press, its refusal, and the clocks | `tryTrick` (from `playerIntents`, js/sim/sim.js), `trickBusy`, `trickFoe`, `loadoutTick` (from `updateAbilities`), `trickOf`, `callingOf` | `loadout` |
| the callings at the blow | `loadoutDeal`, `loadoutOnHit`, `loadoutOnHurt` (from `hurtUnit`, js/sim/actions.js), `ksCount`, `ksBlank` (`p.ks`) | `loadout` |
| the hero hooks it registers | `HERO_STAT` (QUICKHAND), `HERO_MOVE` (SPRINT, BANDAGE, OUTRIDER), `HERO_TEN` (SHAKE OFF) | `loadout` |
| when a bot uses a trick | `aiTricks` (from `updateAI`, js/ai/ai.js), `AI_TRICK_LOW` | `loadout` |
