# js/draw/sagitta.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| her bolts in flight: plain, heavy, PIN's and THE LONG BOLT's (`HERO_SHOTS`) | `drawBoltBody` | `sagitta` › `bolts` |
| her sight line down PIN's and THE LONG BOLT's aim, PAVISE coming up, CRANK BACK's crater (their rows' `tele`, `AB_FX_LOOK.crank`) | `drawSightLine`, `drawPaviseTele`, `drawCrankFx` | `sagitta` › `THE LONG BOLT's line` |
| the PAVISE standing on the snow, its health and its time (`HERO_MACHINE.sagPavise`'s `draw`) | `SG_PAV`, `sgPavArt`, `drawSagittaPavise` | `sagitta` › `the PAVISE` |
| HEAVY BOLTS' marks at her feet (`HERO_MARK`) | `drawSagittaMarks` | `sagitta` › `on her` |
| her crossbow carried low at her hip in every facing (`HERO_CARRY`) | `sagittaCarry`, `SG_CARRY` | `sagitta` › `the arbalest at her hip` |
