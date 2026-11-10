'use strict';
// Every combatant in the match: the numbers a player is made of, the Player
// class and the ten of them, the two playable classes and their kits,
// the input struct, contested orders, the entity arrays - and the damage &
// death lifecycle those players live and die by.
// ------------------------------------------------------------ players
// Every player in the match is a Player. They all carry identical state and are
// all driven from the same `input` struct, so a feature written for "the
// player" is a feature every player has: the local human (slot localId), the AI fills,
// and eventually a network peer are only different in who fills that struct.
// Sim code takes a `p` argument; `player` (the local player) is for the camera,
// HUD, cursor and audio only.
const TEAMS = SPRITES.teams; // the 2 colour presets (RED, BLUE), baked into the sprites
// Which PRESET a team wears on this screen. With settings.teamBlue (the
// default) the local player's side is always the BLUE one and the rival side
// always RED, whatever team index the roster dealt - so allies read blue and
// enemies red from the first match to the last, and a future second human
// sees the mirror. The match itself never asks this: team indices, enemyOf,
// PVP and every rule read p.team; only the PAINT goes through here - every
// TEAMS[...] lookup, the per-team sprite sets (champ, the birds, teamBuild,
// robotTeam, merchant) and the two maps' eagle colours. Bot names are
// computed from it live (Player.name), so RED-3 turns BLUE-3 with the toggle.
function skin(team) { return settings.teamBlue && player && player.team === 0 ? 1 - team : team; }
// The rival's SHAPE cue: under any colour-blind palette (settings.teamPal, not
// 'def') a rival's minimap dot is a cross (drawMapUnit, js/draw/marks.js) and
// its health bar wears a raised dark cap on its right end (drawHealthBar, js/draw/overhead.js),
// so the two sides still part in greyscale. Paint only, like skin().
function foeCue(team) { return settings.teamPal !== 'def' && team != null && !!player && team !== player.team; }

// Players. Every combatant in the match - the local human, the AI fills,
// and (later) network peers - is a Player in `players`, so anything written
// for "the player" is automatically something every player can do. Only the
// camera, HUD and cursor address one specific player (`player`, the local one).
const MAX_PLAYERS = 10; // five a side
const TEAM_COUNT = 2;      // RED vs BLUE; players alternate (id % TEAM_COUNT)
const PVP = true;          // arrows hit players on another team (friendly fire is off)
const PLAYER_SPEED = 72;
const PLAYER_R = 4.5;

// momentum (player-only): input accelerates vx/vy, the surface underfoot sets
// friction and speed caps. Walking on snow is tuned to feel like the old fixed
// PLAYER_SPEED; everything faster than that is earned via ice, dodges, or sliding.
const ICE_MAX = 150;      // ice speed cap (~2x walk); holding a direction pumps toward it
const SLIDE_MIN = 85;     // shift-slide only engages above this speed...
const SLIDE_EXIT = 55;    // ...and drops out below this one (hysteresis)
const TRAIL_MIN = 110;    // sliding faster than this carves the snow trail
const SNOW_TRAIL_LIFE = 3.5; // snow groove lifetime (ice scratches keep the 9s footprint life)
const SNOW_TRAIL_FADE = 1.4; // fade window at the end of that life: hold crisp, then wipe tail-first

// Hero levels (League-style, max 18). XP is its own number, apart from gold:
// it comes from being NEAR when a rival body dies - a soldier, a hero, a
// camp monster - shared among the allies standing there (shareXp, below), so
// the last hit is gold and the being-there is XP. Felling
// and the clock pay gold and never XP: the road is where you level.
// LEVEL_XP[n-1] is the total needed to reach level n, the gap growing by 30 a
// level. It is sized against a hero who keeps to the road and the camps
// (waves every 30 s growing a soldier every 3 min, a share of the kills, a
// den now and then): about level 6 at ten minutes and 12 near 25, the cap of
// 18 later still, so a lead in levels is still news late. XP is never spent or lost on death. What a level grows is the hero's
// own: CLASSES[c].grow, read through statOf (js/sim/stats.js), the health it
// adds healed on the spot.
const LEVEL_MAX = 18; // one skill point a level: 5 + 5 + 5 ranks on keys 1-3 and 3 on the ultimate (AB_RANK_LV, js/sim/abilities.js)
const LEVEL_XP = [0, 60, 150, 270, 420, 600, 810, 1050, 1320, 1620, 1950, 2310, 2700, 3120, 3570, 4050, 4560, 5100];

// The dodge roll as an ability: how long it lasts, how hard it throws you,
// and how many charges refill how fast. What a roll HITS on the way through
// is the ROLL_/TACKLE_ block in js/sim/actions.js.
const DODGE_T = 0.28;     // roll duration (s)
const DODGE_SPEED = 215;  // roll velocity -> ~60px travelled
const DODGE_CHARGES = 2;
const DODGE_CD = 3.5;     // seconds to refill one charge

// The two bow numbers a class kit is expressed against - CLASSES below
// reads both at load time, which is why they sit here and the rest of the
// bow (the draw curve and the cycle: js/sim/attack.js; the trail: js/sim/actions.js).
const BOW_CHARGE = 0.9;   // seconds to a full draw
const BOW_NOCK = 0.45;    // WREN's seconds between loosing and the next draw

// ---- classes ------------------------------------------------------------
// League's five POSITIONS. Each seat on a side plays one, handed out in the
// draft (draftSeatRoles, js/ui/draft.js) and kept on the player as
// `p.position` for the match (-1: none, a match that skipped the draft). A
// bot plays its own (aiPosJob, js/ai/ai-farm.js): `lane` is the lane it
// holds (lanes.js's 0 top, 1 mid, 2 bot; -1 none), `job` the plan's role
// for it (AI_ROLES, js/ai/ai-team.js).
const POSITIONS = [
  { id: 'top', name: 'TOP', lane: 0, job: 'laner' },
  { id: 'jungle', name: 'JUNGLE', lane: -1, job: 'jungler' },
  { id: 'mid', name: 'MID', lane: 1, job: 'laner' },
  { id: 'bot', name: 'BOT', lane: 2, job: 'laner' },
  { id: 'support', name: 'SUPPORT', lane: 2, job: 'support' },
];

// Every player plays one of these HEROES, the way a League champion is the
// same in every match: its `id`, which names its art in the hero registry
// (its looks, worn per person, its paint, glyph and emblem: heroArtOf,
// js/sprites/hero-art.js, filled by js/sprites/<hero>.js), a kit - the numbers
// updatePlayer / basicAttack / tryDodge read through kitOf(p) instead of the
// bare constants - its BASIC ATTACK on the left button (`attack`, read by
// js/sim/attack.js, which says what each field means) and its four ACTIVE
// ABILITIES on keys 1-4 (CLASS_AB, js/sim/abilities.js). Picked in the draft
// (js/ui/draft.js) or hashed from the seed (bots) in initPlayers().
const CLASSES = [
  {
    // the first hero (js/sim/armatos.js): his own 16 px body in each look
    // (`skins`), his greatsword's cut and a kit of his own on keys 1-4
    name: 'ARMATOS', role: 'THE LAST STANDARD', passive: 'resolve', // HERO_PASSIVE, js/sim/heroes.js
    blurb: ['NO SOLDIER LEFT BEHIND.', 'THE SHIELD TAKES THE HIT. THE BASH ANSWERS IT.', 'PLANT THE STANDARD: YOUR SIDE HOLDS, THEIRS IS SLOWED LEAVING.'],
    story: 'HE CARRIED THE STANDARD OF A LEGION THE EMPIRE MARCHED INTO THE SNOW AND FORGOT. HE BROUGHT EVERY ONE OF THEM HOME, AND THE EMPIRE CALLED IT A RETREAT. THE STANDARD IS BROKEN NOW. HE STILL PLANTS IT.', // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    base: { hp: 130, dmg: 16, armor: 24, ap: 0, haste: 0, ms: PLAYER_SPEED },
    grow: { hp: 10, dmg: 1.4, as: 0.008, armor: 2.9 },
    kit: { iceMax: 1.1, iceSteer: 3.2, slideMin: 70, fatigue: 0.7, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 225 },
    rankOrder: [0, 2, 1], // the verdict, the march, the brace
    attack: { name: 'OATH GREATSWORD', art: 'sword', cycle: 30 / 60, kb: 1.2, cut: { reach: 28, half: 1.05 } },
    // its art: the heroArt('armatos') row in js/sprites/armatos.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'armatos',
    blade: 'oath', // his OATH GREATSWORD in his hands in place of the sword's own art (HERO_BLADES, js/draw/heroes.js)
  },
  {
    // the second hero (js/sim/fortiva.js): a juggernaut with a sword's cut
    // (`attack`) who wins the long fight: the most health of
    // anyone and a hard hit, a step slower so a hero who keeps its distance
    // can beat her
    name: 'FORTIVA', role: 'THE UNBROKEN', passive: 'unbroken', // HERO_PASSIVE, js/sim/fortiva.js
    blurb: ['STRENGTH IS THE POWER TO REFUSE TO KNEEL.', 'THE LONGER THE FIGHT, THE HARDER SHE IS TO STOP.', 'THE EDGE OF THE ARC HEALS HER. THE SHIELD PAYS BACK WHAT IT TOOK.'],
    story: 'THE EMPIRE WORKED HER IN CHAINS AT ITS FORGES UNTIL THE DAY SHE STOOD UP AND DID NOT KNEEL AGAIN. SHE CUT THE CHAIN AND HAMMERED IT INTO A SWORD. THE VALLEY DOES NOT ASK WHERE A BLADE CAME FROM.', // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    base: { hp: 132, dmg: 18, armor: 20, ap: 0, haste: 0, ms: PLAYER_SPEED - 3 },
    grow: { hp: 10, dmg: 1.7, as: 0.01, armor: 2.6 },
    rankOrder: [0, 2, 1], // the sever, the yoke, the heart
    attack: { name: 'CHAIN GREATSWORD', art: 'sword', cycle: 30 / 60, kb: 1.2, cut: { reach: 28, half: 1.05 } },
    // its art: the heroArt('fortiva') row in js/sprites/fortiva.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'fortiva',
    blade: 'chain', // her CHAIN GREATSWORD in her hands (HERO_BLADES, js/draw/heroes.js)
    kit: { iceMax: 1.1, iceSteer: 3.2, slideMin: 70, fatigue: 0.7, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 225 },
  },
  {
    // the third hero (js/sim/bella.js): a duelist with a sword's cut
    // (`attack`): quick and light, her damage in the
    // keys she chains, her life thin if she is caught
    name: 'BELLA', role: 'THE IMPERIAL GENERAL', passive: 'calculated', // HERO_PASSIVE, js/sim/heroes.js
    blurb: ['FIND THE WEAKNESS. SPEND IT FIRST.', 'THE LUNGE, THE SLIP AND THE PARRY CHAIN INTO EACH OTHER.', 'CALL OUT ONE HERO AND FINISH THEM.'],
    story: 'SHE WON THE EMPIRE A WAR ITS COURT HAD ALREADY CALLED LOST, AND THE COURT NEVER FORGAVE HER. TRAITOR WAS THE KINDEST WORD THEY HAD. SHE KEPT THE SPATHA WITH THE EAGLE ON IT. SHE SAYS IT IS HERS NOW.', // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    attack: { name: 'EAGLE SPATHA', art: 'sword', cycle: 26 / 60, kb: 1, cut: { reach: 26, half: 0.95 } }, // quicker and a little shorter than ARMATOS's greatsword
    // its art: the heroArt('bella') row in js/sprites/bella.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'bella',
    blade: 'spatha', // her EAGLE SPATHA in her hands (HERO_BLADES, js/draw/bella.js)
    base: { hp: 104, dmg: 18, armor: 16, ap: 0, haste: 0, ms: PLAYER_SPEED + 4 },
    grow: { hp: 7, dmg: 1.7, as: 0.013, armor: 2.1 }, // sized so 17 levels grow what 11 did when the cap was 12
    rankOrder: [0, 2, 1], // the lunge, the slip, the parry
    kit: { iceMax: 1.15, iceSteer: 3.4, slideMin: 70, fatigue: 0.75, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 240 },
  },
  {
    // the fourth named hero and the first mage (js/sim/ignia.js): fire that
    // spreads through a crowd and zones a lane, at a bow's range or a little
    // short of it; slow damage, not burst, and the least life of anyone
    name: 'IGNIA', role: 'THE HEARTHKEEPER', passive: 'spreadflame', // HERO_PASSIVE, js/sim/ignia.js
    blurb: ['THE ONLY FIRE FOR MILES.', 'ONE BURNING RIVAL SETS THE NEXT ALIGHT.', 'SNOW AND WATER PUT YOUR FIRE OUT.'],
    story: "SHE KEPT THE GREAT HEARTH IN THE EMPEROR'S HALL, AND ONE HARD WINTER SHE CARRIED ITS COALS TO A VILLAGE THAT HAD NONE. THE HALL WENT COLD AND THE COURT DID NOT FORGIVE IT. IN THE VALLEY SHE IS THE ONLY FIRE FOR MILES, AND EVERYONE WANTS TO SIT NEAR HER.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // a staff's ember, not an arrow: a little shorter and slower than the shortbow
    staff: 'crook', // her CROOK AND LANTERN, carried upright (HERO_STAVES, js/draw/ignia.js)
    attack: { name: 'CROOK AND LANTERN', art: 'staff', cycle: 60 / 60, kb: 0.6, shot: { speed: 260, life: 0.85, col: '#ff9a3a', look: 'ember' } },
    base: { hp: 84, dmg: 14, armor: 10, ap: 0, haste: 0, ms: PLAYER_SPEED },
    grow: { hp: 6, dmg: 1.1, as: 0.01, armor: 1.8 },
    rankOrder: [0, 1, 2], // the brand, the brushfire, the warm hands
    // its art: the heroArt('ignia') row in js/sprites/ignia.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'ignia',
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: SLIDE_MIN, fatigue: 1, chargeMul: 0.55,
      bowCharge: BOW_CHARGE, nock: 0.4, spdDmg: 0, dodgeSpeed: DODGE_SPEED },
  },
  {
    // the fifth named hero (js/sim/aura.js): the far, patient mage - artillery.
    // The longest reach in the game and the least life to back it, a step
    // slower than anyone; slow, telegraphed strikes, one blink, and nothing else
    name: 'AURA', role: 'THE NORTHERN LIGHT', passive: 'starlight', // HERO_PASSIVE, js/sim/aura.js
    blurb: ['THE NIGHT IS ON YOUR SIDE.', 'OUTREACH ANYONE. NOTHING HIDES FROM YOUR LIGHT.', 'CAUGHT UP CLOSE, YOU HAVE ONE STEP.'],
    story: "SHE STEERED THE EMPIRE'S FLEET BY THE STARS, AND WARNED THE ADMIRALS A STORM WAS COMING. THEY SAILED ANYWAY, AND SHE BROUGHT HER ONE SHIP HOME. THE VALLEY'S NIGHTS ARE CLEAR AND BLUE, AND SHE STILL KNOWS EVERY STAR BY NAME.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // a staff's star bolt: a little shorter and slower than the shortbow
    staff: 'shard', // her STAR SHARD, carried upright (HERO_STAVES, js/draw/aura.js)
    attack: { name: 'STAR SHARD', art: 'starstaff', cycle: 66 / 60, kb: 0.5, shot: { speed: 270, life: 0.95, col: '#e6f8ff', look: 'starbolt' } },
    base: { hp: 78, dmg: 13, armor: 9, ap: 0, haste: 0, ms: PLAYER_SPEED - 4 },
    grow: { hp: 5.5, dmg: 1, as: 0.01, armor: 1.7 },
    rankOrder: [0, 1, 2], // the falling star, the drifting light, the step
    // its art: the heroArt('aura') row in js/sprites/aura.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'aura',
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: SLIDE_MIN, fatigue: 1, chargeMul: 0.55,
      bowCharge: BOW_CHARGE, nock: 0.4, spdDmg: 0, dodgeSpeed: DODGE_SPEED },
  },
  {
    // the sixth named hero and the first healer (js/sim/salvia.js): heals, speed for
    // her side and the slows taken off them, at a mage's range; almost no damage and
    // little control, and under focus her heals are spent fast
    name: 'SALVIA', role: 'THE MENDER', passive: 'warmbroth', // HERO_PASSIVE, js/sim/salvia.js
    blurb: ['THERE ARE NO SIDES IN HER TENT.', 'HEAL YOUR SIDE, SPEED THEM UP, TAKE THEIR SLOWS OFF.', 'ALMOST NO DAMAGE. KEEP BEHIND THEM.'],
    story: "SHE MENDED THE EMPIRE'S SOLDIERS ON BOTH SIDES OF A BORDER, WHICH THE EMPIRE CALLED TREASON. IN THE VALLEY THERE ARE NO SIDES IN HER TENT. SHE CHARGES BOTH COMPANIES THE SAME PRICE, AND NOBODY ARGUES WITH HER.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // a staff's sprig: the ember's reach, a little weaker; her keys are the point
    staff: 'snowdrop', // her SNOWDROP STAFF, carried upright (HERO_STAVES, js/draw/salvia.js)
    attack: { name: 'SNOWDROP STAFF', art: 'dropstaff', cycle: 62 / 60, kb: 0.5, shot: { speed: 250, life: 0.85, col: '#9cc87a', look: 'sprig' } },
    base: { hp: 80, dmg: 12, armor: 10, ap: 0, haste: 0, ms: PLAYER_SPEED },
    grow: { hp: 5.8, dmg: 0.9, as: 0.01, armor: 1.8 },
    rankOrder: [0, 2, 1], // the poultice, the cloak, the snowdrops
    // its art: the heroArt('salvia') row in js/sprites/salvia.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'salvia',
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: SLIDE_MIN, fatigue: 1, chargeMul: 0.55,
      bowCharge: BOW_CHARGE, nock: 0.4, spdDmg: 0, dodgeSpeed: DODGE_SPEED },
  },  {
    // the seventh named hero (js/sim/lucerna.js): the catch-and-save support, the only
    // pull of a rival in the game, a lantern that brings an ally home, a light that shows
    // what hides near her; little damage, and a missed crook leaves her open
    name: 'LUCERNA', role: 'THE LANTERN', passive: 'lamplight', // HERO_PASSIVE, js/sim/lucerna.js
    blurb: ['SOMEBODY HAS TO CARRY A LIGHT.', 'HOOK A RIVAL IN. THROW YOUR LANTERN TO BRING AN ALLY HOME.', 'MISS THE CROOK AND YOU ARE OPEN.'],
    story: "SHE LIT THE EMPIRE'S ROAD LAMPS AT DUSK, AND WAS SENT AWAY FOR LIGHTING THE WAY OUT FOR PEOPLE WHO WERE NOT SUPPOSED TO LEAVE. THE VALLEY GOES BLUE AT NIGHT AND THE CLAIM DOES NOT STOP FOR IT. SOMEBODY HAS TO CARRY A LIGHT.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // a spark off her lantern: the staff mages' reach, a little stronger than SALVIA's sprig
    staff: 'lantern', // her LANTERN, hung from her hand (HERO_STAVES, js/draw/lucerna.js)
    attack: { name: 'LANTERN', art: 'lantern', cycle: 62 / 60, kb: 0.6, shot: { speed: 260, life: 0.8, col: '#f2cc6a', look: 'lampspark' } },
    base: { hp: 88, dmg: 13, armor: 12, ap: 0, haste: 0, ms: PLAYER_SPEED },
    grow: { hp: 6.2, dmg: 1, as: 0.01, armor: 2 },
    rankOrder: [0, 2, 1], // the crook, the shoo, the lantern
    // its art: the heroArt('lucerna') row in js/sprites/lucerna.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'lucerna',
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: SLIDE_MIN, fatigue: 1, chargeMul: 0.55,
      bowCharge: BOW_CHARGE, nock: 0.4, spdDmg: 0, dodgeSpeed: DODGE_SPEED },
  },
  {
    // the eighth named hero (js/sim/hiems.js): the control mage. She freezes a
    // fight slowly - every hit chills, the third freezes - and holds a choke
    // with ice and a blizzard; low burst, and a step slower than most
    name: 'HIEMS', role: 'THE LONG WINTER', passive: 'deepchill', // HERO_PASSIVE, js/sim/hiems.js
    blurb: ['THE COLD IS ON YOUR SIDE.', 'EVERY HIT CHILLS. THE THIRD CHILL FREEZES THEM IN PLACE.', 'LITTLE BURST: FREEZE THEM, THEN LET YOUR SIDE FINISH.'],
    story: "SHE KEPT THE WEATHER RECORDS FOR THE EMPIRE'S COURT, AND TOLD THEM THE COLD YEARS WERE COMING AND WOULD NOT STOP. THEY SENT HER AWAY FOR SPOILING THE HARVEST FEAST. SHE CAME UP THE PASS TO SEE WHETHER SHE WAS RIGHT. THE SNOW HAS NOT STOPPED.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // a staff's frost bolt: AURA's star bolt, a little shorter
    staff: 'flake', // her SNOWFLAKE STAFF, carried upright (HERO_STAVES, js/draw/hiems.js)
    attack: { name: 'SNOWFLAKE STAFF', art: 'flakestaff', cycle: 62 / 60, kb: 0.5, shot: { speed: 270, life: 0.85, col: '#e6f8ff', look: 'frostbolt' } },
    base: { hp: 82, dmg: 13, armor: 10, ap: 0, haste: 0, ms: PLAYER_SPEED - 4 },
    grow: { hp: 5.8, dmg: 1, as: 0.01, armor: 1.8 },
    rankOrder: [0, 2, 1], // the icicle, the cold snap, the clear ice
    // its art: the heroArt('hiems') row in js/sprites/hiems.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'hiems',
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: SLIDE_MIN, fatigue: 1, chargeMul: 0.55,
      bowCharge: BOW_CHARGE, nock: 0.4, spdDmg: 0, dodgeSpeed: DODGE_SPEED },
  },
  {
    // the ninth named hero (js/sim/rupes.js): a tank who engages. Slow to start and
    // impossible to stop once he is rolling; little damage of his own, very hard to
    // kill while he is packed with snow, and worn down by a rival who keeps away
    name: 'RUPES', role: 'THE AVALANCHE', passive: 'snowpack', // HERO_PASSIVE, js/sim/rupes.js
    blurb: ['BE THE SLOPE.', 'THE HITS YOU TAKE PACK SNOW ONTO YOU. SHED IT IN ONE BURST.', 'ROLL FROM FAR OFF: THE FURTHER YOU ROLL, THE BIGGER THE BURST.'],
    story: "HE CUT ICE FOR THE EMPIRE'S CELLARS UNTIL THE QUARRY FACE CAME DOWN, AND HE HELD THE WAY OUT OPEN WITH HIS BACK UNTIL THE LAST CUTTER WAS CLEAR. THE EMPIRE BILLED HIM FOR THE ICE. IN THE VALLEY HE DIGS WHERE THE SNOW IS DEEPEST, BECAUSE IT NEVER SURPRISES HIM.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    attack: { name: 'ICE MAUL', art: 'sword', cycle: 34 / 60, kb: 1.4, cut: { reach: 27, half: 1.05 } }, // a little slower than ARMATOS's greatsword, a harder shove
    base: { hp: 134, dmg: 15, armor: 24, ap: 0, haste: 0, ms: PLAYER_SPEED - 2 },
    grow: { hp: 10.5, dmg: 1.3, as: 0.008, armor: 2.9 },
    rankOrder: [0, 1, 2], // the heave, the shed, the shoulder
    // its art: the heroArt('rupes') row in js/sprites/rupes.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'rupes',
    blade: 'maul', // his ICE MAUL in his hands (HERO_BLADES, js/draw/rupes.js)
    kit: { iceMax: 1.1, iceSteer: 3.2, slideMin: 70, fatigue: 0.7, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 220 },
  },
  {
    // the tenth named hero and the first jungler (js/sim/varro.js): a diver
    // who picks one rival and runs them down; quick and a little
    // light, strongest in the woods with wolves near him, thin when caught alone
    name: 'VARRO', role: 'THE WOLF-KEPT', passive: 'pack', // HERO_PASSIVE, js/sim/varro.js
    blurb: ['RUN WITH THE PACK.', 'LEAP IN, MARK THEM, AND STAY ON THEM.', 'CALL THE WOLVES: ONE RIVAL CANNOT OUTRUN THEM.'],
    story: 'THE EMPIRE LEFT HIM ON THE MOUNTAIN AS A CHILD. THE WOLVES FOUND HIM FIRST AND KEPT HIM WARM THROUGH THE WINTER. HE GREW UP RUNNING WITH THEM, AND HE STILL SHARES EVERY CATCH WITH THE PACK.', // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // a spear's thrust: a touch longer and narrower than ARMATOS's greatsword's cut
    attack: { name: 'HUNTING SPEAR', art: 'spear', cycle: 28 / 60, kb: 1, cut: { reach: 30, half: 0.8 } },
    base: { hp: 112, dmg: 17, armor: 18, ap: 0, haste: 0, ms: PLAYER_SPEED + 2 },
    grow: { hp: 8.5, dmg: 1.6, as: 0.012, armor: 2.4 },
    rankOrder: [0, 2, 1], // the lunge, the snap, the howl
    // its art: the heroArt('varro') row in js/sprites/varro.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'varro',
    blade: 'spear', // his HUNTING SPEAR in his hands (HERO_BLADES, js/draw/varro.js)
    kit: { iceMax: 1.15, iceSteer: 3.4, slideMin: 70, fatigue: 0.75, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 235 },
  },
  {
    // the tenth named hero (js/sim/bucina.js): the tempo support, her side's speed and
    // nerve: a horn that shoves, rallies, echoes off the walls and calls the snow down off
    // the pines; no heals, no shields, and little damage of her own
    name: 'BUCINA', role: 'THE HORN', passive: 'heard', // HERO_PASSIVE, js/sim/bucina.js
    blurb: ['ONE NOTE AT THE RIGHT TIME WINS THE FIGHT.', 'YOUR SIDE RUNS FASTER, HITS FASTER AND DOES NOT STOP.', 'NO HEALS, NO SHIELDS: YOUR SIDE HAS TO FOLLOW.'],
    story: "SHE BLEW THE HORN FOR THE EMPIRE'S RETREATS, AND ONCE BLEW IT WITHOUT AN ORDER AND BROUGHT A WHOLE COLUMN HOME. THEY TOOK THE HORN AWAY FOR IT. NOW SHE CARRIES HER OWN, IT CALLS A COMPANY FORWARD, AND THE SNOW COMES OFF THE PINES WHEN IT DOES.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // a note off her horn: the staff mages' reach, a little short of it
    staff: 'horn', // her HORN, carried upright (HERO_STAVES, js/draw/bucina.js)
    attack: { name: 'HORN', art: 'horn', cycle: 62 / 60, kb: 0.6, shot: { speed: 255, life: 0.8, col: '#cfe0f2', look: 'hornnote' } },
    base: { hp: 92, dmg: 14, armor: 14, ap: 0, haste: 0, ms: PLAYER_SPEED },
    grow: { hp: 6.5, dmg: 1.1, as: 0.01, armor: 2.2 },
    rankOrder: [1, 0, 2], // the note, the blast, the echo
    // its art: the heroArt('bucina') row in js/sprites/bucina.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'bucina',
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: SLIDE_MIN, fatigue: 1, chargeMul: 0.55,
      bowCharge: BOW_CHARGE, nock: 0.4, spdDmg: 0, dodgeSpeed: DODGE_SPEED },
  },
  {
    // the twelfth named hero (js/sim/nix.js): the night scout, an assassin of
    // skill and weather. Quick and light, her damage in one hidden blow; she
    // has the least armor of any blade and little to fall back on once seen
    name: 'NIX', role: 'THE SNOWBLIND', passive: 'nightwatch', // HERO_PASSIVE, js/sim/nix.js
    blurb: ['THE NIGHT IS HERS TO KEEP.', 'THE SNOW HIDES HER. THE FIRST BLOW FROM IT HITS HARDEST.', 'SEEN IN THE OPEN, SHE IS EASY TO CATCH.'],
    story: "SHE WAS THE EMPIRE'S BEST SCOUT UNTIL SHE CAME HOME WITH A TRUE REPORT NOBODY WANTED TO READ. IN THE VALLEY SHE KEEPS WATCH THROUGH THE LONG NIGHTS SO THE DIGGERS CAN SLEEP. SHE DOES NOT GIVE HER NAME, SO THE COMPANY GAVE HER ONE.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    attack: { name: 'ICE DIRK', art: 'sword', cycle: 24 / 60, kb: 0.8, cut: { reach: 22, half: 0.9 } }, // quicker and shorter than the spatha
    // its art: the heroArt('nix') row in js/sprites/nix.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'nix',
    blade: 'dirk', // her ICE DIRK in her hands (HERO_BLADES, js/draw/nix.js)
    base: { hp: 98, dmg: 19, armor: 14, ap: 0, haste: 0, ms: PLAYER_SPEED + 6 },
    grow: { hp: 6.5, dmg: 1.8, as: 0.013, armor: 2 },
    rankOrder: [0, 2, 1], // the shard, the drift step, the cloud
    kit: { iceMax: 1.15, iceSteer: 3.4, slideMin: 70, fatigue: 0.75, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 240 },
  },
  {
    // the ninth named hero (js/sim/faber.js): the zone mage. He holds a spot with
    // machines he winds himself - small guns, a clockspring trap, the old engine -
    // and is strong defending it; slow on his feet and poor at a chase
    name: 'FABER', role: 'THE TINKER', passive: 'spareparts', // HERO_PASSIVE, js/sim/faber.js
    blurb: ['SET UP A SPOT AND DARE THEM TO WALK IN.', 'SMALL MACHINES SHOOT FOR YOU. A TRAP HOLDS A HERO. THE OLD ENGINE SLAMS.', 'STRONG HOLDING GROUND, SLOW TO CHASE.'],
    story: "HE KEPT THE EMPIRE'S WATER CLOCKS RUNNING, AND ONE WINTER HE BUILT A CLOCK THAT RAN THE WHOLE CITY'S FOUNTAINS AT ONCE. IT FLOODED THE PALACE. THEY THANKED HIM AND SENT HIM UP THE PASS. THE WORKS HERE ARE FULL OF OLD MACHINES SOMEBODY BUILT WITH CARE, AND HE MEANS TO MEND EVERY ONE.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // a staff's brass bolt: HIEMS's frost bolt's pace
    staff: 'clock', // his CLOCK STAFF, carried upright (HERO_STAVES, js/draw/faber.js)
    attack: { name: 'CLOCK STAFF', art: 'clockstaff', cycle: 62 / 60, kb: 0.5, shot: { speed: 270, life: 0.85, col: '#f2cc6a', look: 'cog' } },
    base: { hp: 80, dmg: 12, armor: 10, ap: 0, haste: 0, ms: PLAYER_SPEED - 6 },
    grow: { hp: 5.6, dmg: 1, as: 0.01, armor: 1.8 },
    rankOrder: [0, 1, 2], // the spark, the small machine, the clockspring
    // its art: the heroArt('faber') row in js/sprites/faber.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'faber',
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: SLIDE_MIN, fatigue: 1, chargeMul: 0.55,
      bowCharge: BOW_CHARGE, nock: 0.4, spdDmg: 0, dodgeSpeed: DODGE_SPEED },
  },
  {
    // the fourteenth named hero (js/sim/velox.js): the kiting marksman. She throws her
    // sling while she skates, a shorter reach than a bow's and less damage; quick,
    // steady on ice and very hard to catch, and caught, she has nothing to stop a rival
    name: 'VELOX', role: 'THE SKATER', passive: 'keepmoving', // HERO_PASSIVE, js/sim/velox.js
    blurb: ['NEVER STAND STILL.', 'THROW WHILE YOU SKATE: EVERY HIT QUICKENS YOU.', 'LAY YOUR OWN ICE AND FLY ALONG IT.'],
    story: "SHE CARRIED THE EMPIRE'S MESSAGES DOWN ITS FROZEN CANALS, FASTER THAN ANY HORSE. ONE NIGHT SHE READ THE ORDER SHE CARRIED: BURN A VILLAGE THAT WOULD NOT PAY. SHE SKATED THERE FIRST AND WARNED THEM. NOW SHE CARRIES WORD FOR ANYONE WHO NEEDS IT CARRIED FAST.",
    // a sling stone: a shorter, quicker throw than an arrow, barely slowed by her skating
    staff: 'sling', // her STAFF SLING, carried upright (HERO_STAVES, js/draw/velox.js)
    attack: { name: 'STAFF SLING', art: 'sling', cycle: 50 / 60, kb: 0.6, shot: { speed: 300, life: 0.6, col: '#9aa3b8', look: 'slingstone' } },
    base: { hp: 82, dmg: 14, armor: 10, ap: 0, haste: 0, ms: PLAYER_SPEED + 3 },
    grow: { hp: 6, dmg: 1.2, as: 0.016, armor: 1.7 },
    rankOrder: [0, 2, 1], // the skip stone, the quick step, the ice lane
    // its art: the heroArt('velox') row in js/sprites/velox.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'velox',
    // ice is her ground: a higher cap and a sharp turn on it; a drawn sling barely slows her
    kit: { iceMax: 1.25, iceSteer: 9, slideMin: SLIDE_MIN, fatigue: 0.8, chargeMul: 0.9,
      bowCharge: 0.6, nock: 0.4, spdDmg: 3, dodgeSpeed: 240 },
  },
  {
    // the fifteenth named hero (js/sim/falco.js): the falconer, an assassin who dives.
    // His hawk finds a rival and marks it, his thrown knives bite harder on the mark,
    // and he falls out of the sky on it; without a mark he is weak, and clumsy in a crowd
    name: 'FALCO', role: 'THE KESTREL', passive: 'hawk', // HERO_PASSIVE, js/sim/falco.js
    blurb: ['PATIENT, THEN SUDDEN.', 'YOUR HAWK FINDS THEM. YOUR KNIVES BITE HARDER ON WHAT IT MARKS.', 'WITHOUT A MARK YOU ARE WEAK. PICK THE LONE RIVAL.'],
    story: "HE KEPT THE HAWKS FOR AN IMPERIAL HUNT AND LET THEM ALL FLY THE DAY THE EMPIRE BURNED THE HUNTING PARK FOR A PARADE GROUND. ONE CAME BACK. IT IS THE ONLY ONE HE WILL SPEAK TO.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // a thrown knife: short, quick, a little further than a blade
    attack: { name: 'THROWING KNIFE', art: 'knife', cycle: 40 / 60, kb: 0.5, shot: { speed: 330, life: 0.42, col: '#c8d2e4', look: 'knife' } },
    // its art: the heroArt('falco') row in js/sprites/falco.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'falco',
    base: { hp: 96, dmg: 17, armor: 13, ap: 0, haste: 0, ms: PLAYER_SPEED + 4 },
    grow: { hp: 6.2, dmg: 1.7, as: 0.014, armor: 1.9 },
    rankOrder: [1, 0, 2], // the knife fan, the talons, the glide
    kit: { iceMax: 1.1, iceSteer: 3.2, slideMin: 70, fatigue: 0.85, chargeMul: 0.65,
      bowCharge: 0.75, nock: 0.45, spdDmg: 3, dodgeSpeed: 230 },
  },
  {
    // the sixteenth named hero (js/sim/maris.js): a tank who catches one rival. Quick and chilling on
    // ice and by open water, she swims where others go in; much weaker on dry ground far
    // from it, and once she has surfaced she has no way out
    name: 'MARIS', role: 'THE ICE DIVER', passive: 'coldwater', // HERO_PASSIVE, js/sim/maris.js
    blurb: ['THE THING UNDER THE ICE.', 'ON ICE AND BY THE WATER YOU ARE QUICK, AND YOUR STRIKES CHILL.', 'ONCE YOU SURFACE YOU HAVE NO WAY OUT.'],
    story: "SHE DOVE FOR THE EMPIRE'S SUNKEN GRAIN BARGES IN WATER NOBODY ELSE WOULD TOUCH, AND WAS SENT AWAY WHEN SHE WOULD NOT DIVE FOR A SUNKEN TAX CHEST. SHE SAYS THE ORCA IN THE CISTERN POOL IS THE ONLY HONEST THING IN THE VALLEY. SHE GIVES IT THE FIRST FISH OF EVERY CATCH.", // the wiki's hero page (docs/dev/lore.md)
    attack: { name: 'HARPOON', art: 'sword', cycle: 32 / 60, kb: 1.1, cut: { reach: 28, half: 0.8 } }, // a thrust: ARMATOS's greatsword's reach, narrower
    // its art: the heroArt('maris') row in js/sprites/maris.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'maris',
    blade: 'harpoon', // her HARPOON in her hands (HERO_BLADES, js/draw/maris.js)
    base: { hp: 126, dmg: 14, armor: 22, ap: 0, haste: 0, ms: PLAYER_SPEED - 2 },
    grow: { hp: 10, dmg: 1.2, as: 0.009, armor: 2.7 },
    rankOrder: [0, 2, 1], // the harpoon, the undertow, the brace
    kit: { iceMax: 1.2, iceSteer: 3.6, slideMin: 70, fatigue: 0.7, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 220 },
  },
  {
    // the seventeenth named hero (js/sim/lignum.js): a skirmisher who owns the treeline.
    // Strong short trades and great near the woods; short reach, and in an open lane or on
    // the ice he has nothing to hold a rival with until his ultimate
    name: 'LIGNUM', role: 'THE FELLER', passive: 'treeline', // HERO_PASSIVE, js/sim/lignum.js
    blurb: ['OWN THE TREELINE.', 'WAIT IN THE WOODS, STEP OUT, CHOP HARD, STEP BACK.', 'FELL A PINE ACROSS THE FIGHT.'],
    story: "HE FELLED TIMBER FOR THE EMPIRE'S SHIPS UNTIL THERE WAS NO FOREST LEFT TO FELL, THEN REFUSED TO BURN THE LAST ONE. THE VALLEY'S PINES GREW UP THROUGH THE WORKS AND NOBODY OWNS THEM. HE LIKES THAT.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // an axe's blow: ARMATOS's greatsword's reach, a little wider and slower
    attack: { name: 'FELLING AXE', art: 'sword', cycle: 34 / 60, kb: 1.2, cut: { reach: 26, half: 1 } },
    // its art: the heroArt('lignum') row in js/sprites/lignum.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'lignum',
    blade: 'felling', // his FELLING AXE in his hands (HERO_BLADES, js/draw/lignum.js)
    base: { hp: 114, dmg: 18, armor: 18, ap: 0, haste: 0, ms: PLAYER_SPEED },
    grow: { hp: 9, dmg: 1.7, as: 0.011, armor: 2.4 },
    rankOrder: [0, 1, 2], // the chop, the thrown axe, the bark skin
    // a woodsman off the ice: a low cap and a slow turn on it
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: 70, fatigue: 0.75, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 225 },
  },
  {
    // the eighteenth named hero (js/sim/sagitta.js): the siege marksman. Her heavy crossbow
    // reaches further than any bow and hits like a hammer, but it is slow to wind and
    // slower to carry; she is safe behind her pavise and easy prey once it is down
    name: 'SAGITTA', role: 'THE BOLT-THROWER', passive: 'heavybolts', // HERO_PASSIVE, js/sim/sagitta.js
    blurb: ['SET UP, THEN STRIKE FROM FAR AWAY.', 'EVERY THIRD BOLT HITS LIKE A HAMMER.', 'PIN RIVALS TO THE TREES.'],
    story: "SHE BUILT THE EMPIRE'S SIEGE ENGINES. WHEN ONE OF THEM WAS TURNED ON THE CITY THAT PAID FOR IT, SHE SAID SO, AND WAS SENT OVER THE PASS FOR IT. THE ROAD TOWERS IN THE VALLEY CARRY CROSSBOWS SHE COULD HAVE DRAWN. SHE STUDIES THEM MORE THAN SHE LETS ON.",
    // a crossbow bolt: further and harder than an arrow, and a long wind between
    attack: { name: 'HEAVY ARBALEST', art: 'arbalest', cycle: 80 / 60, kb: 1.3, shot: { speed: 430, life: 0.82, col: '#c3ccd8', look: 'bolt' } },
    base: { hp: 78, dmg: 20, armor: 9, ap: 0, haste: 0, ms: PLAYER_SPEED - 5 },
    grow: { hp: 5.6, dmg: 1.7, as: 0.01, armor: 1.6 },
    rankOrder: [0, 2, 1], // the pin, the crank back, the pavise
    // its art: the heroArt('sagitta') row in js/sprites/sagitta.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'sagitta',
    // a heavy draw that all but plants her feet while she winds it
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: SLIDE_MIN, fatigue: 1, chargeMul: 0.45,
      bowCharge: 0.75, nock: 0.4, spdDmg: 0, dodgeSpeed: DODGE_SPEED },
  },
  {
    // the nineteenth named hero (js/sim/clivus.js): a fighter who climbs. He goes over what
    // stands between him and a rival, ties them and holds them; strong once he is on you,
    // and a long wait between vaults, so a rival who slips his rope gets away
    name: 'CLIVUS', role: 'THE GUIDE', passive: 'foothold', // HERO_PASSIVE, js/sim/clivus.js
    blurb: ['GO OVER, NOT AROUND.', 'VAULT IN, TIE THEM, STRIKE WHAT YOU HOLD.', 'STAKE A RING THEY CANNOT LEAVE.'],
    story: "HE GUIDED THE EMPIRE'S COLUMNS OVER THE PASS FOR TWENTY WINTERS. THE LAST COLUMN HE TOOK WAS FAMILIES THE EMPIRE MEANT TO KEEP, ROPED TOGETHER IN A WHITEOUT, AND HE BROUGHT EVERY ONE OF THEM DOWN. HE HAS NOT BEEN BACK UP SINCE.", // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // an ice axe's blow: quicker and a little shorter than LIGNUM's felling axe
    attack: { name: 'ICE AXE', art: 'sword', cycle: 30 / 60, kb: 1, cut: { reach: 24, half: 0.95 } },
    // its art: the heroArt('clivus') row in js/sprites/clivus.js (its look, its paint,
    // the glyph and the emblem)
    id: 'clivus',
    blade: 'iceaxe', // his ICE AXE in his hands (HERO_BLADES, js/draw/clivus.js)
    base: { hp: 110, dmg: 17, armor: 17, ap: 0, haste: 0, ms: PLAYER_SPEED },
    grow: { hp: 8.6, dmg: 1.7, as: 0.012, armor: 2.3 },
    rankOrder: [0, 1, 2], // the pick strike, the rope, the vault
    // a mountain guide: sure on the ice, a quick turn and a high cap on it
    kit: { iceMax: 1.1, iceSteer: 3.6, slideMin: 80, fatigue: 0.8, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 225 },
  },
  {
    // the twentieth named hero (js/sim/arcus.js): the planted marksman. His longbow is quick
    // on the string and his arrows in the snow quicken it more; he has no dash, so a rival
    // who reaches him has him
    name: 'ARCUS', role: 'THE FLETCHER', passive: 'wastenothing', // HERO_PASSIVE, js/sim/arcus.js
    blurb: ['PLANT YOUR FEET AND FILL THE SNOW.', 'WALK OVER YOUR ARROWS TO SHOOT FASTER.', 'CALL THEM BACK THROUGH YOUR RIVALS.'],
    story: "HE MADE THE EMPIRE'S ARROWS, TEN THOUSAND A WINTER. WHEN A CARTLOAD WAS SENT AGAINST A TOWN THAT HAD DONE NOTHING, HE BROKE EVERY SHAFT ON THE CART AND WALKED OVER THE PASS. NOW HE CUTS HIS OWN FROM THE VALLEY'S WILLOWS AND WILL NOT LEAVE ONE LYING IN THE SNOW.",
    // a longbow arrow: a little further and quicker than VELOX's stone, well short of the arbalest
    attack: { name: 'WILLOW LONGBOW', art: 'longbow', cycle: 46 / 60, kb: 0.7, shot: { speed: 400, life: 0.68, col: '#c8a46a' } },
    base: { hp: 80, dmg: 15, armor: 9, ap: 0, haste: 0, ms: PLAYER_SPEED - 2 },
    grow: { hp: 5.8, dmg: 1.5, as: 0.02, armor: 1.6 },
    rankOrder: [0, 2, 1], // the volley, the gather, the twin nock
    // its art: the heroArt('arcus') row in js/sprites/arcus.js (its looks, worn
    // per player through heroSkinOf, their paint, the glyph and the emblem)
    id: 'arcus',
    // a light draw he can walk through, no better than anyone on ice
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: SLIDE_MIN, fatigue: 1, chargeMul: 0.75,
      bowCharge: 0.6, nock: 0.4, spdDmg: 0, dodgeSpeed: DODGE_SPEED },
  },
];
// a hero's CLASSES index by name, -1 for none: what a profile or a bot names
function heroIndex(name) { return CLASSES.findIndex((c) => c.name === name); }
// the kit every sim site reads: the class's numbers with the player's items
// and items folded in. refreshKit() rebuilds the cache whenever one of them
// changes; kitOf() itself is called many times a frame and must stay a read.
function kitOf(p) { return p.kit || CLASSES[p.cls].kit; }
// swap a player's hero: kit hp applies on the spot (full heal, it's a
// pre-match choice), and the new hero's basic attack comes with its row
// (attackOf, js/sim/attack.js)
function setClass(p, c) { p.cls = c; refreshKit(p); p.hp = p.maxHp; }
// the hero's HEALTH stat: its base, its levels and its bonuses (statOf, js/sim/stats.js)
function levelMaxHp(p) { return statOf(p, 'hp'); }
// THE ONE WAY HEALTH COMES BACK to a player: a potion, a creek fish, a berry bush, the daylight, a hero's
// heal, a kill's heal. Capped at the most, and what it actually gave back is
// counted for the post-game record (js/ui/lobby.js) and returned.
function healPlayer(p, n) {
  if (p.healCutT > 0) n *= 1 - p.healCut; // FROSTBITE (cutHeal, js/sim/actions.js)
  const h = Math.max(0, Math.min(n, p.maxHp - p.hp));
  p.hp += h;
  p.healed += h;
  return h;
}
// the one way gold enters a wallet: the purse, and `earned`, the match's
// lifetime gold (the scoreboard's rank and the post-game GOLD). Gold buys;
// it no longer teaches - XP is gainXp's alone.
function gainGold(p, n) {
  p.gold += n;
  p.earned += n;
  // lifetime total, coalesced - see profile.js. Practice gold is play money:
  // a free room must never farm the tech tree's points.
  if (p === player && !PRACTICE) PROFILE.addGold(n);
}
// The merchant's till, and the ONE way gold reaches a wallet without counting
// as earned. A SALE is an exchange, not a source: an item sold back is gold the
// player already spent, so counting it would turn a buy and a sell into a
// scoreboard farm rather than into a trade. Everything that
// EARNS gold - a fell, a kill, the clock - still goes through gainGold.
function tradeGold(p, n) { if (p && n > 0) p.gold += n; }
// Gold leaving a wallet: the shop's one way to take it, so the post-game
// record (goldSpent, js/ui/lobby.js) never misses a purchase. The caller has
// already checked the purse holds n.
function spendGold(p, n) {
  p.gold -= n;
  if (n > 0) p.goldSpent += n;
}
// Gold is never a physical drop: every source pays the earner on the spot
// through this one wrapper - the wallet (via gainGold), the '+N' popup at
// the place the action happened, and the coin blip for the local earner.
// (x, y) is the tree, the kill, the wreck - not the player.
function awardGold(p, n, x, y) {
  if (!p || n <= 0) return;
  gainGold(p, n);
  addFloater(x, y - 14, String(n), RES_COLORS.gold);
  sfxFor(p, 'coin');
}

// THE ONE WAY XP ENTERS A BODY: the bar, the levels it crosses, and the
// running total over the head (xpN since xpTick, the damage total's rules:
// one number that adds each gain and fades TALLY_HOLD s after the last - the
// purple +N left of the level badge, queueXp in js/draw/overhead.js).
function gainXp(p, n) {
  n = Math.round(n);
  if (!p || n <= 0) return;
  p.xp += n;
  if (!p.xpN || (state.tick - p.xpTick) * TICK_DT > TALLY_HOLD) p.xpN = 0;
  p.xpN += n;
  p.xpTick = state.tick;
  while (p.level < LEVEL_MAX && p.xp >= LEVEL_XP[p.level]) levelUp(p);
}
// A death's XP, League style: every hero of `team` standing (alive, on the
// ground) within XP_R of the body shares it, and the one who landed the blow
// (`src`) always does, wherever they stood - a long shot still teaches. The
// pot grows XP_SHARE of the whole for each sharer past the first, so two
// heroes on a wave each get 65%, five get 46%: company pays, but less each.
// `team` is the side the death was good for - the rival of a soldier or a
// hero, the killer's side for a beast (which has none).
const XP_R = 160;      // px round a death that shares its XP: about half the view at the default zoom
const XP_SHARE = 0.3;  // of the whole added to the pot for each sharer past the first
function shareXp(dead, xp, team, src) {
  if (!(xp > 0) || team < 0) return;
  const who = unitsNear(dead, dead.x, dead.y - (dead.alt || 0), XP_R).filter((q) => q instanceof Player && q.team === team);
  if (src instanceof Player && src.team === team && unitAlive(src) && !who.includes(src)) who.push(src);
  const each = xp * (1 + XP_SHARE * (who.length - 1)) / who.length;
  for (const q of who) gainXp(q, each);
}
function levelUp(p) {
  p.level++;
  p.skillPts++;
  p.maxHp = levelMaxHp(p);
  p.hp = Math.min(p.maxHp, p.hp + (CLASSES[p.cls].grow.hp || 0));
  // the early levels come too fast to be news; the late ones say who is ahead
  if (p.level >= LOG_LEVEL) logEvent(boardName(p) + ' REACHED LEVEL ' + p.level, p);
  if (!inAir(p)) floaters.push({ x: p.x, y: p.y - 22, txt: 'LEVEL ' + p.level, color: '#f2cc6a', t: 0, vx: 0, scale: 2, rise: 20 });
  sfxFor(p, 'levelUp');
}
// the pose set a body draws from: its hero in the look it wears, in its
// team's paint (champLook, js/sprites/characters.js)
function classSet(p) { return SPRITES.champLook(p.cls, skin(p.team), heroSkinOf(p)); }
// a hero's art in the registry (HERO_ART, js/sprites/hero-art.js): its looks,
// their paint, the skins tab's glyph and the 12px emblem
function heroArtOf(cls) { return HERO_ART[CLASSES[cls].id]; }
// every hero has its art and every art its hero: a new hero without its
// heroArt row, or a row left behind by a cut one, refuses to boot
for (const c of CLASSES) if (!HERO_ART[c.id]) throw new Error('player.js: ' + c.name + ' has no heroArt row (js/sprites/hero-art.js)');
for (const id in HERO_ART) if (!CLASSES.some((c) => c.id === id)) throw new Error('player.js: heroArt ' + id + ' has no CLASSES row');
// the look a player wears on its hero (heroArtOf(cls).looks): the id its person
// picked for that hero (`p.skins`, a slot -> id map from their profile, sent
// with the hello and kept on the body, so every screen draws the same look),
// or null for the hero's own
function heroSkinOf(p) { const c = CLASSES[p.cls]; return c && p.skins ? p.skins[c.id] || null : null; }
// a hello's skins (msg.skins, js/net/net.js) as the host keeps them: only a
// hero's slot naming one of that hero's looks gets through
function cleanHeroSkins(m) {
  const out = {};
  if (!m || typeof m !== 'object') return out;
  for (const c of CLASSES) if (typeof m[c.id] === 'string' && HERO_ART[c.id].looks.some((r) => r.id === m[c.id])) out[c.id] = m[c.id];
  return out;
}
// the CLASSES index of the hero the profile last locked in (kept by name,
// js/app/profile.js): the first hero for none, or for a name no hero has now
function profileHero() { return Math.max(0, heroIndex(PROFILE.hero())); }
// The local player wears the PROFILE: its name, and the hero it last locked
// in, whose look and kit come with it. Called from initPlayers; the draft
// (js/ui/draft.js) re-picks through setClass.
function applyProfile() {
  player.name = PROFILE.name();
  setClass(player, profileHero());
  player.skins = profileHeroSkins(); // the looks worn on each hero (js/ui/skins.js)
}
// Five players share each team colour, so text that names one player (the
// scoreboard, the event log) also needs a per-player shade of that team's
// palette - the team colour stays the background, this is the ink.
function playerTint(p) {
  const t = TEAMS[skin(p.team)];
  return [t.trim, t.hatL, t.trimD, t.hat][Math.floor(p.id / TEAM_COUNT) % 4];
}

// ---- inventory -------------------------------------------------------------
// Gold is a wallet number and never an item - it is currency, and a purse
// that could run out of room would make a kill refuse its own bounty. The six
// item slots are their own list (p.items, js/sim/items.js), and a health
// potion stacks in one of them. Nothing else is carried: a creek fish and a
// berry bush heal where they stand (js/sim/world.js).
// the class kit plus the defaults no class kit carries; an
// item's mod() edits them in place. Shared by refreshKit and the hero
// pop-up's preview ledger (js/ui/menu.js), so the numbers that page shows can
// never drift from the ones the sim reads.
function baseKit(cls) {
  return Object.assign({}, CLASSES[cls].kit, {
    cls, add: statBag(), // whose kit, and the stat bonuses items write (js/sim/stats.js)
    dodgeCd: DODGE_CD, stealth: 1,
    killHeal: 0, kindle: false, chill: false, restHeal: 0, // the item passives (js/sim/items.js)
    leech: false, thorns: false, cull: false, steady: false, surge: false, brace: false, smolder: false, scorch: false,
  });
}
// rebuild p.kit from class + items
function refreshKit(p) {
  const k = baseKit(p.cls);
  itemMods(k, p); // the six item slots (js/sim/items.js)
  p.kit = k;
  p.maxHp = levelMaxHp(p);
  if (p.hp === undefined || p.hp > p.maxHp) p.hp = p.maxHp;
}
// one frame of intent - the whole interface between a controller and the sim
function makeInput() {
  return {
    mx: 0, my: 0,        // movement axis (the sim normalises)
    aimX: 0, aimY: 0,    // world-space aim point (cursor, for the human)
    fire: false,         // bow held: press draws, release looses
    work: false,         // E held
    slide: false,        // shift held
    dodge: false,        // edge-triggered, cleared once the sim reads it
    jump: false,         // edge-triggered: the hop off the roost (hopOff, js/sim/eagle.js), or on/off a cable or a deer
    useItem: -1,         // edge-triggered: use what is in this item slot (0-5) - drink a potion (useItem, js/sim/items.js)
    ability: -1,         // edge-triggered: cast the class ability on this key (1-4), js/sim/abilities.js
    trick: -1,           // edge-triggered: use the loadout's trick on this key (0-1), js/sim/loadout.js
    cmd: null,           // one-shot: {kind:'shop'|'ping'|..., ...} or {kind:'ability', i} (cmdOk, js/ui/wheel.js)
  };
}

// The newer half of the match record, as a table so a save written before a
// field existed can be filled in on load (saveApply, js/sim/save.js).
const PLAYER_RECORD = {
  dmgBeast: 0,                   // damage dealt to wildlife, what landed of it (hurtUnit, actions.js)
  dmgInP: 0,                     // ...of dmgIn, what rival players dealt
  dmgInB: 0,                     // ...and what a beast's bite dealt (BEAST_CAUSES, js/sim/wildlife.js)
  healed: 0,                     // health given back to this body, whatever gave it (healPlayer)
  goldSpent: 0,                  // gold paid out of the purse (spendGold)
  beasts: 0,                     // animals this body landed the last blow on (animalDies, js/sim/wildlife.js)
  farm: 0,                       // last hits on rival soldiers and camp monsters (farmHit, js/sim/farm.js)
  streak: 0, bestStreak: 0,      // rivals downed since this body last went down, and the most of it
  multiN: 0, multiT: -1e9, bestMulti: 0, // the run of kills MULTI_T apart, when the last one was, the most of it
  ccOut: 0,                      // s of stun and root put on RIVAL players (ccCredit, js/sim/actions.js)
  assists: 0,                    // rivals this body helped down without the last blow (payTakedown)
  feed: 0,                       // deaths since this body's last kill or assist: past FEED_FROM it is worth less (killWorth)
  earned: 0,                     // gold earned this match, spent or not (gainGold): the scoreboard's rank
};
// gold every player lands with, League's start: a first part and a potion at the
// counter before the walk out. Never `earned` (gainGold): nothing paid it.
const START_GOLD = 500;
class Player {
  constructor(id, control, team) {
    this.id = id;
    this.team = team === undefined ? id % TEAM_COUNT : team; // alternating by slot unless a roster says otherwise
    this.control = control;             // 'human' | 'ai' | 'none' (nobody -> ghost)
    this.botId = null;                  // an 'ai' seat's bot FILE (BOT_LIB, js/ai/bot-api.js); null = the built-in brain
    // the local player wears the profile's display name; every other player is
    // named off its team - live, through the `name` getter below, so the name
    // follows the paint (skin) when the team-colour setting flips. Who the
    // local player IS (name, hero) is applyProfile().
    this._name = control === 'human' ? PROFILE.name() : null; // a remote human is named by the roster
    this.skins = {};                   // hero slot -> the look worn on that hero (heroSkinOf); a person's, from their profile
    this.spawn = { tx: WORLD >> 1, ty: WORLD >> 1 }; // landing tile once the eagle drops this player (the bot brain's "home")
    this.gold = START_GOLD;             // the wallet: currency only, no ceiling; a start that buys a first part and a potion
    this.cls = 0;                       // CLASSES index; the lobby sets the local one
    this.position = -1;                 // POSITIONS index the draft gave this seat, -1 none (draftReveal, js/ui/draft.js); the host's alone, never on the wire
    this.skillPts = 1;                  // unspent; level 1 starts with one, each levelUp adds one - spent on ability levels (buyAbilityLv, js/sim/abilities.js)
    this.abLv = [0, 0, 0, 0];           // ability ranks, 0 (LOCKED) ..abLvMax (5, the ultimate 3), a skill point each - like items, NOT cleared by reset(): a death keeps what was bought
    this.cheatOn = { cd: false, hp: false }; // the practice bar's standing toggles, this player's own (cheatCmd/cheatAuto, js/sim/practice.js)
    // the pre-game picks (js/sim/loadout.js): two tricks and a calling, set
    // whole as the match starts (loadoutStart); the tricks' cooldowns and the
    // calling's own clocks, which a death does not reset (League's own)
    this.loadout = { tricks: [null, null], calling: null };
    this.trickCd = [0, 0];
    this.ks = { foe: -1, n: 0, t: 0, tick: -1, on: 0, mark: -1, cd: 4 };
    // the times of this player's recent pings, the spam guard's memory
    // (pingReady, js/sim/pings.js)
    this.pingLog = [];
    this.eliminated = false;            // its bird was driven off: no coming back - see die()/eagleFleeResolve
    this.respawnT = 0;                  // seconds left on an active respawn countdown
    this.level = 1; this.xp = 0;        // hero level and its XP (gainXp); survive death
    this.trickleT = 0;                  // s toward the next passive coin (TRICKLE_T, js/sim/sim.js)
    this.kills = 0;                     // rivals downed; scoreboard only, survives death
    this.foeHits = {};                  // rival id -> state.elapsed of its latest blow or crowd control on this body (noteFoe); a death clears it
    this.lastDeath = null;              // { by, cause, tick } of the latest death: the kill feed's line, as data (js/ai/bot-api.js)
    this.hurtLog = [];                  // the blows of the last RECAP_T s, as the side saw them (recapNote); a death hands it to deathLog
    this.deathLog = null;               // ...the latest death's: what the death recap reads (js/ui/recap.js)
    this.lastCmd = null;                // { kind, tick, ok, why } of the latest order run (runCmd)
    // The rest of the match record, for the post-game lobby (js/ui/lobby.js).
    // Every one of them is a running total for the WHOLE match: a death
    // clears nothing here, and reset() leaves them alone the way it leaves
    // kills and the level. They cross the wire like any other field, so a
    // client's lobby prints the host's numbers rather than its own guess.
    this.deaths = 0;                    // times this body went down
    this.dmgOut = 0;                    // damage dealt to RIVAL players, counted after their DR
    this.dmgIn = 0;                     // damage taken from anything at all, counted after this body's DR
    this.dmgBird = 0;                   // nerve knocked off the rival eagle (hurtEagle, eagle.js)
    this.dmgStruct = 0;                 // damage dealt to rival buildings, after STRUCT_DR (hurtStruct, actions.js)
    Object.assign(this, PLAYER_RECORD); // the rest of the record, which a save older than a field fills from too (saveApply)
    this.hGold = [];                    // the lobby's two graphs, sampled every STAT_STEP: gold earned...
    this.hDmg = [];                     // ...and damage dealt, both cumulative (sampleStats, js/ui/lobby.js)
    this.items = new Array(ITEM_SLOTS).fill(null); // the six item slots, ids or null (js/sim/items.js) - they survive a respawn
    this.potions = 0;                   // how many potions stand in the slot that holds 'potion' (the `potion` banner, js/sim/items.js)
    this.fightT = 0; this.kindleN = 0;  // s since the last hit given or taken, and KINDLING's count (itemsOnHit)
    this.surgeT = 0; this.smolderT = 0; // SURGE's window after a key, SMOLDER's next pulse (itemsTick)
    this.lifeT = 0;                     // LIFELINE's wait before it can shield again (itemsLifeline)
    this.healCutT = 0; this.healCut = 0; // FROSTBITE on this body: how long, and the share of a heal it takes (cutHeal, js/sim/actions.js)
    this.buys = [];                     // every finished item and pair of boots bought this match, in order: the build the match records (buildsNote, js/app/builds.js)
    refreshKit(this);                   // builds this.kit and this.maxHp from class + items
    this.aboard = false;                // riding the eagle (beginDrop sets it, hopOff clears it)
    this.dropT = 0;                     // seconds left of the step down off the roost (0 = on the ground)
    this.dropAlt = 0;                   // px the step down started from: HOP_ALT off the roost
    this.dropSc = 1;                    // the body's drawn scale as it left the seat, shrinking to 1 as it lands
    // bot brain (unused by a human player): current job, give-up timers and the
    // short blacklists that keep a bot from re-picking work it cannot reach
    this.ai = {
      tgt: null, avoid: null, avoidT: 0, thinkT: 0,
      huntTgt: null, huntT: 0, huntAvoid: null, huntAvoidT: 0,
      wx: 0, wy: 0, roam: 0,
      // the difficulty profile's clocks (ai-skill.js): prof overrides the
      // side's profile (DBG / the harness), seeT is how long a rival has been
      // noticed, sk the skill layer's hands (skillOf, made on first use),
      // abilOk this tick's ability roll, pushCd a roost it could not reach
      prof: null, seeT: 0, sk: null, abilT: 0, abilOk: true, pushCd: 0,
      // want is what this tick's ladder decided ({ type, x, y } or null:
      // DEFEND at its bird, ATTACK at the rival's - the dashboard reads it),
      // ping the human's ping it has taken up ({ k, x, y, owner, t, at }:
      // pingSteer, js/sim/pings.js) and backOff a DANGER it is backing off
      // from ({ x, y, t })
      want: null, ping: null, backOff: null,
      // the team brain (js/ai/ai-team.js): mood its temperament's key (dealt on
      // first read), helping the teammate whose call it answers, foeId the
      // player it is shooting (the side's focus tally), focusT/focusOk the
      // focus roll, lastFoe/lastFoeT the rival it last fought and when (the
      // commit window, aiHoldFoe), fleeT until when a fall-back holds,
      // downs/grudge who it has downed
      // and the mark it holds a grudge on, answerAt/answerKind/answerKey the
      // human ping it last answered and when its ON IT is due (aiAnswer), band its range band
      // in a fight (aiRangeBand), packT how long it has waited at the rally,
      // thought what it is doing and why (the dashboard's record)
      mood: null, helping: -1, foeId: -1, focusT: 0, focusOk: false, packT: 0, thought: null, lastFoe: null, lastFoeT: -1e9, fleeT: -1e9, downs: {}, grudge: null, answerAt: 0, answerKind: null, answerKey: "", band: null,
    };
    this.reset(true);
  }
  get active() { return this.control !== 'none'; }
  // a named player (the human, via applyProfile) keeps its name; every other
  // player is called after the colour it is WEARING right now
  get name() { return this._name !== null ? this._name : TEAMS[skin(this.team)].name + '-' + (this.id + 1); }
  set name(v) { this._name = v; }
  // spawn placement + every transient cleared; boot calls it with first=true,
  // respawnPlayer() (the team's bird setting a player back down) with first=false
  reset(first) {
    this.x = (this.spawn.tx + 0.5) * TILE;
    this.y = (this.spawn.ty + 0.5) * TILE;
    this.vx = 0; this.vy = 0;
    this.dir = 'down'; this.faceT = 0; this.moving = false; this.animT = 0;
    this.hp = this.maxHp;
    this.dead = false;
    this.charging = false; this.chargeT = 0;      // bow draw state
    // the potion being drunk: its heal's time left, and its motes' clock (js/sim/items.js)
    this.potT = 0; this.potFxT = 0;
    // the recall's channel, and the roost ring's motes' clock (js/sim/recall.js)
    this.recallT = 0; this.ringFxT = 0;
    this.nockT = 0;                                // the cycle: seconds until the next press (attackCycle, js/sim/attack.js)
    this.slashT = 0; this.slashA = 0; this.slashHalf = 0; // a blade's sweep in flight: the hand swings the sword through it (cutAttack, js/sim/attack.js; drawHeldTool, js/draw/bodies.js)
    this.fireArmed = false;                        // the bow button has been pressed since the last loose
    this.readyFlash = 0;                           // the HUD's tell: renocked
    this.dodgeT = 0; this.dodgeVX = 0; this.dodgeVY = 0; this.dodgeDustT = 0;
    this.dodgeCharges = DODGE_CHARGES; this.dodgeRegenT = 0;
    this.rollHit = [];                             // what this roll has already swiped (once each)
    this.stamGhost = 0; this.stamGhostT = 0;      // spent-stamina ghost
    this.sliding = false; this.slideT = 0; this.trailD = 0; this.slideDustT = 0;
    this.swingT = 0; this.swingCd = 0; this.swingDir = 0; this.swingHitDone = false;
    this.autoSwing = false;                        // the swing in flight was the hands' own (autoWork), so a draw may begin under it
    // the class abilities (keys 1-4, js/sim/abilities.js): per-key cooldowns, the
    // cast in progress, and every timed state one can leave on a body -
    // shielded, or mid-dash
    this.abCd = [0, 0, 0, 0];                      // (abLv, the ranks bought, lives in the constructor: a death keeps them)
    this.sprintT = 0; this.runT = 0; this.shakeT = 0; // a trick's running effect: SPRINT, BANDAGE's quick step, SHAKE OFF's grace (js/sim/loadout.js)
    this.castAb = -1; this.castT = 0; this.castMax = 0; // castMax is the wind-up's full length, so a telegraph can read how far along it is (castProg)
    // Every state ANY unit can be under - stun, root, slow, the mark,
    // and fire - is written and cleared in one place for
    // all three kinds of unit (`status effects`, js/sim/actions.js), so a player,
    // a deer and a bot wear the identical set.
    clearUnitStatus(this);
    this.shieldT = 0; this.shieldA = 0;            // the tower shield, and where it faces
    this.rushT = 0; this.rushNX = 0; this.rushNY = 0;
    this.castSlam = false;                         // the shield key pressed mid-wall or mid-rush: the cast in flight is the SLAM, not a raise (js/sim/abilities.js)
    this.buffT = 0;                                // s of a bear buff left (campBuff, wildlife.js): harder blows, a quicker walk
    this.pushT = 0;                                // s of the orca buff left (animalDies, wildlife.js): the side's soldiers near hit buildings harder
    this.buffKind = null;                          // ...and which beast's ('alpha', the bear): its name and its ring's colour
    this.shields = [];                             // { kind, hp, t }: every shield up, in the order a hit spends them (SHIELD_KINDS, js/sim/actions.js)
    // ARMATOS (js/sim/armatos.js): his resolve (0..1, full = the next key shields him) and
    // the seconds since a hit last fed it; the brace (`hold`, on the shieldT state) and
    // whether a hero has struck it (the bash primed); a hero's dash (`dash`, a HERO_DASH id
    // riding the rushT state: his march) and the lesser bodies it has already shouldered aside
    this.resolve = 0; this.resolveIdle = 0;
    this.hold = false; this.holdHit = false;
    this.dash = ''; this.marchHit = [];
    // FORTIVA (js/sim/fortiva.js; her resolve is `resolve` above): DEFIANT HEART's clock
    // and the shield's size at the cast, NO KNEELING's after, and the leap's length
    this.defyT = 0; this.defyHp = 0; this.nkT = 0; this.vaultMax = 0;
    // BELLA (js/sim/bella.js): her precision (stacks) and the seconds since a hero hit fed
    // it; the edge a consumed stack lends her key's blows and the burst of speed; the
    // lunge's cut bodies and its key (its refund, once); the parry's stance and the hero
    // owed a riposte; the duel (the hero called out, its clock) and the flurry's strikes
    this.prec = 0; this.precIdle = 0; this.edgeT = 0; this.edgeMsT = 0;
    this.lungeHit = []; this.lungeKey = -1;
    this.parryT = 0; this.riposteId = -1;
    this.aimA = 0;                                 // the held aim as an angle (aimHold), what every screen draws a drawn weapon along
    this.duelId = -1; this.duelT = 0; this.flurryN = 0; this.flurryT = 0; this.flurryId = -1; this.flurryArm = false;
    // IGNIA (js/sim/ignia.js): WARM HANDS waiting; and on any body, whose fire it is
    // burning with (SPREADING FLAME carries it on) and how long a wildfire's flame lets it jump
    this.warmT = 0; this.kindleBy = -1; this.wildT = 0;
    // HIEMS (js/sim/hiems.js), on any body: DEEP CHILL's stacks and their window, the
    // wait before it can be frozen again, and the freeze's ice (drawn while it holds)
    this.chillN = 0; this.chillT = 0; this.chillImm = 0; this.frozeT = 0;
    // SALVIA (js/sim/salvia.js), on any player she helped: WARM BROTH's speed and the cloak's run
    this.brothT = 0; this.cloakT = 0;
    // LUCERNA (js/sim/lucerna.js), on any body she pulls: the spot it is drawn to and the clock
    this.pullT = 0; this.pullX = 0; this.pullY = 0;
    // BUCINA (js/sim/bucina.js), on any player who heard her: HEARD's run, and the note's hold and its attack speed
    this.heardT = 0; this.rallyT = 0; this.rallyAs = 0;
    // RUPES (js/sim/rupes.js): his snowpack (0..1, PACK_LAYERS layers) and the seconds since a
    // hit fed it; the px his avalanche has rolled (its size)
    this.pack = 0; this.packIdle = 0; this.avaD = 0;
    // MARIS (js/sim/maris.js): COLD WATER's clock, her brace (its clock and the share it cuts),
    // the s left under the snow, and the spot her reel or her dive is headed to
    this.coldT = 0; this.braceT = 0; this.braceCut = 0; this.underT = 0; this.reelX = 0; this.reelY = 0;
    // LIGNUM (js/sim/lignum.js): in the woods last step, TREELINE's ready blow and its run, CHOP's wait for the second blow, BARK SKIN's clock and its share
    this.lgWoods = false; this.lgEdgeT = 0; this.lgRunT = 0; this.chopT = 0; this.barkT = 0; this.barkCut = 0;
    // CLIVUS (js/sim/clivus.js): FOOTHOLD's ready strike, in the air on a vault, the vault's whole flight (s), and its landing blow as it was sprung
    this.clFootT = 0; this.clAir = false; this.clVaultT = 0; this.clVaultDmg = 0; this.clVaultSlow = 1;
    // VARRO (js/sim/varro.js): the body LUNGE is leaping at, SNAP's strikes still to land and
    // their clock; and on any body, whose mark it wears (LUNGE) and until when
    this.leapQ = null; this.snapN = 0; this.snapT = 0; this.packBy = -1; this.packUntil = 0;
    // VELOX (js/sim/velox.js): KEEP MOVING's stacks and their clock, QUICK STEP's readied
    // throw, LONG RUN's clock
    this.keepN = 0; this.keepT = 0; this.quickT = 0; this.runT = 0;
    // SAGITTA (js/sim/sagitta.js): the bolts loosed since her last heavy one (HEAVY BOLTS)
    this.boltN = 0;
    // ARCUS (js/sim/arcus.js): WASTE NOTHING's stacks and their clock, TWIN NOCK's clock,
    // his volley and gather counts; on any body, which volley and which gather struck it and how often
    this.arcN = 0; this.arcT = 0; this.twinT = 0; this.arcVolN = 0; this.arcGathN = 0;
    this.arcVol = -1; this.arcGId = -1; this.arcGN = 0;
    // NIX (js/sim/nix.js): a moment shown after striking from her cloud; WHITEOUT's
    // vanish and the hero it struck (the reset's clock, and whether this cast may reset);
    // NIGHT WATCH's hidden blow waiting
    this.nixOutT = 0; this.nixWhiteT = 0; this.nixStrikeId = -1; this.nixResetT = 0; this.nixRecast = false; this.nixStrikeOnce = false;
    this.nixAmbush = false; this.nixDriftId = -1; this.nixDriftX = 0; this.nixDriftY = 0;
    // FALCO (js/sim/falco.js): STOOP's climb and the hero it falls on, KNIFE FAN's throw count;
    // on any body his hawk marked or his fan struck: who marked it and until when, which throw and how many knives
    this.falcoSkyT = 0; this.falcoStoopId = -1; this.falcoFanN = 0; this.falcoDownT = 0;
    this.falcoBy = -1; this.falcoUntil = 0; this.falcoFanId = -1; this.falcoFanHits = 0;
    this.zip = -1; this.zipD = 0; this.zipDir = 1;  // the zipline (js/sim/zipline.js): the line ridden (its index in zips, or -1), px along it, and which way
    this.lastMx = 0; this.lastMy = 0;                // the stick's last held direction, unit (updatePlayer): what the clip-on reads when the body stands still for the press
    this.zipWalk = false; this.zipWalkL = 0;         // walking itself to a cable to clip on, and which (zipWalkStep, js/sim/zipline.js)
    this.zipLast = 0;                                // px along the cable a step ago (zipCrash, js/sim/zipline.js)
    // the deer ridden (the `riding` banner, js/sim/wildlife.js), or null; the leap
    // in the air (s left), how long it has been up, and the wait before the next
    this.mount = null; this.leapT = 0; this.leapUp = 0; this.leapCd = 0;
    this.workTx = -1; this.workTy = -1;            // tile the current E swing is aimed at
    this.hurtT = 0; this.invuln = first ? 0 : 3;
    this.kbx = 0; this.kby = 0;
    this.fallT = 0; this.fallRipT = 0;             // floundering in an ice hole
    this.footT = 0; this.footSide = 0;
    this.firePrev = false;
    this.input = makeInput();
  }
}

const players = [];  // every player; filled by initPlayers() at boot
let player = null;   // the local player - camera, HUD, cursor and audio follow this one
// which slot THIS screen's player sits in. Nothing about a slot makes it the
// local one - slot 0 is only the default - so anything that means "me" reads
// `player` (or `p === player`), never an id: an online match seats this screen
// wherever the host's roster says (docs/pvp-architecture.md), and a bot-vs-bot
// harness seats it nowhere in particular. ?local=N seats it in slot N for a
// session, the way ?seed=N pins the world - the check that no code still
// assumes slot 0 is to play from slot 7.
let localId = 0;
const LOCAL_SLOT = (function () {
  const q = /[?&]local=([0-9]+)/.exec(location.search);
  return q ? Math.min(MAX_PLAYERS - 1, parseInt(q[1], 10) || 0) : 0;
})();

// A ROSTER is one entry per slot: { control, team?, name?, cls? }.
// The default is today's match - this screen's human in its slot and an AI
// in every other - and a lobby hands in one of its own, with its humans
// already named, classed and dressed.
function defaultRoster(local) {
  const r = [];
  for (let i = 0; i < MAX_PLAYERS; i++) r.push({ control: i === local ? 'human' : 'ai' });
  return r;
}
function initPlayers(roster, local) {
  local = local === undefined ? LOCAL_SLOT : local;
  roster = roster || defaultRoster(local);
  players.length = 0;
  for (let i = 0; i < MAX_PLAYERS; i++) players.push(new Player(i, roster[i].control, roster[i].team));
  // bots draw their class from the seed, so a replayed world fields the
  // same roster
  for (const p of players) if (p.control === 'ai') {
    // floor(hash * N): even over however many classes exist (for two it maps
    // exactly as the old `< 0.5` coin, so old seeds keep their rosters)
    setClass(p, Math.floor(hash2(p.id * 17 + 3, 77) * CLASSES.length)); // refreshes the kit too
  }
  // a roster's own dressing (a lobby's humans) lands over the defaults
  for (const p of players) {
    const r = roster[p.id];
    if (r.name != null) p.name = r.name;
    if (r.cls != null) setClass(p, r.cls);
  }
  localId = local;
  player = players[local];
  applyProfile(); // the local player is the profile: its name and its last hero
}

// who p is allowed to shoot: another live player on another team (this is the
// one place the FFA/friendly-fire rule lives)
function enemyOf(p, q) { return q !== p && q.active && !q.dead && !inAir(q) && (!PVP || q.team !== p.team); }
// riding the eagle or falling from it: not in the world, nothing can touch it
// The aim a drawn bow, a wound-up blade, a parry or a cast's telegraph points along, as an angle
// from the bow's height. Input never crosses the wire, so a client knows
// another body's aim only from this, written by the step while a draw is
// held; the local body draws off its own live pointer (aimAngle,
// js/draw/bodies.js).
function aimHold(p) { p.aimA = Math.atan2(p.input.aimY - (p.y - BOW_Y), p.input.aimX - p.x); }
function inAir(p) { return p.aboard || p.dropT > 0; }

// ---- facing --------------------------------------------------------------
// The one way a body turns (faceToward). Near a diagonal the facing it
// already has wins until the other axis leads by FACE_BIAS, so a walk or an
// aim along 45 degrees no longer flicks between two sprites every frame. An
// action aimed at something - a shot, a slash, a cast, a rush, a roll -
// passes `hold`: the body keeps that facing for FACE_HOLD (p.faceT) and the
// walk cannot turn it straight back on the next frame, which read as the
// body blinking. A draw or a raised shield still turns it every step.
const FACE_BIAS = 1.25;
const FACE_HOLD = 0.15; // s
function faceToward(p, dx, dy, hold) {
  if (!dx && !dy) return;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const wide = p.dir === 'left' || p.dir === 'right' ? ax * FACE_BIAS >= ay : ax > ay * FACE_BIAS;
  p.dir = wide ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  if (hold) p.faceT = FACE_HOLD;
}

// ---- being seen ---------------------------------------------------------
// How far p is noticed from by a watcher whose plain sight range is `range`.
// The kit's stealth (items) shortens it. Every watcher in the game (the pack, the towers, the bot
// brain) resolves through this one function so they cannot disagree about who
// is hidden. A watcher that plays by the fog of war (a bot, a hand's lock-on)
// names its side as `team`: a rival outside that side's sight is not seen at
// all (inSight, js/sim/fog.js). Creatures watch without it.
function seenAt(p, range, team) {
  // a mark (markUnit) is the ONE legal bypass: a marked rival is simply seen,
  // however deep in the fog, until the mark runs out (js/sim/actions.js)
  if (p.markT > 0) return range;
  if (team !== undefined && !inSight(team, p)) return 0;
  return range * kitOf(p).stealth;
}

// ---- contested orders --------------------------------------------------
// Several players can order the same tile, drop or fish inside one sim step,
// and only one of those can happen. Each such action queues a claim here;
// resolveContests() runs exactly one per key, picked from (SEED, player id,
// sim tick) - so the same step resolves the same way on every machine.
const contests = new Map();
function contest(key, p, fn) {
  let list = contests.get(key);
  if (!list) { list = []; contests.set(key, list); }
  list.push({ p, fn });
}
function contestRank(p) { return hash2(p.id * 131 + 7, state.tick); }
function resolveContests() {
  for (const list of contests.values()) {
    let win = list[0], wr = contestRank(win.p);
    for (let i = 1; i < list.length; i++) {
      const r = contestRank(list[i].p);
      if (r < wr) { win = list[i]; wr = r; }
    }
    win.fn();
  }
  contests.clear();
}

const animals = []; // passive wildlife: rabbits and deer, spawned once at boot
const structures = []; // every building: road towers, barracks, pumps, cisterns
const robots = []; // the bots: wave soldiers and the merchants
const arrows = []; // live bow shots: {x,y,vx,vy,t,life,dmg,pow}
const ARROW_PX = []; // scratch x,y,colour triples for one rasterised arrow body (render only)
const particles = []; // {x,y,vx,vy,life,color,size,grav} + optional `alpha` fade ceiling
const floaters = [];
const footprints = [];
const fish = []; // swimmers under the ice: {x,y,a,spd,t,turnT,spook}
const camps = []; // the jungle camps, stood up at fixed sites by worldgen (see the camps banner, js/sim/camps.js)

// ------------------------------------------------------------ damage & death
// Nothing to do with the wheel above: a hit, what a hit spills, the split
// between a respawn timer and permanent elimination, and the overlay the
// local player's ending puts up.

// Causes that are a BURN rather than a blow (see updateBurn, js/sim/actions.js).
// A bite of one is not a hit: it goes through the i-frames a body DOES have
// (a roll does not put a fire out, and neither does a respawn) and never
// shoves - a burn is a condition on the body, not a blow landing on it.
const DOT_CAUSE = { fire: true };

// The shove a blow lands on a body, in px/s. It is the BASELINE, not the
// whole story: `kb` is a multiplier on it, so a basic attack's KNOCKBACK
// (js/sim/attack.js) scales a player's shove exactly as it scales an animal's or a
// soldier's, and the ordinary blow is 1.
const HIT_KB = 110;

// A hit grants NO i-frames. `invuln` is only ever set by something DELIBERATE -
// the dodge roll, a respawn, the drop's landing, scrambling out of a hole - so
// two arrows arriving in the same step both land, both shove and both light
// their fire, rather than the second being eaten by the first's grace.
//
// src: the player who dealt it (kill credit + the log line), null for the
// world; cause: a DEATH_CAUSE key naming what the world did, when src is null;
// kb: the multiplier on HIT_KB (hurtUnit's `kbMul`, undefined = an ordinary shove)
function damagePlayer(p, dmg, dx, dy, src, cause, crit, kb, o) {
  const dot = !!DOT_CAUSE[cause];
  if (p.dead || (p.invuln > 0 && !dot)) return;
  dmg = armorTaken(p, dmg, src); // ARMOR cuts every hit by its share, never to zero (js/sim/stats.js; less of it against PIERCE)
  dmg = heroTaken(p, dmg, dx, dy, src); // ...and a hero's own cut: ARMATOS's brace (HERO_TAKEN, js/sim/heroes.js)
  passiveHurt(p, dmg, src); // a hero's passive fed by the hits it takes (LEGION'S RESOLVE)
  // the shields take the hit first, in their order (shieldSpend, js/sim/actions.js),
  // a burn included; what is left of the blow goes on to health
  p.hp -= dmg - shieldSpend(p, dmg);
  itemsLifeline(p); // LIFELINE's shield, the moment a hit takes you low (js/sim/items.js)
  // the match record both ends of the blow keep (the post-game lobby, js/ui/lobby.js).
  // What is counted is what LANDED, DR already off it - the overkill on the
  // last hit of a kill included, because that is what the swing was worth.
  // Only a RIVAL's blow is anybody's damage dealt: the world's and your own
  // side's still show up as damage taken, which is the honest read of both.
  p.dmgIn += dmg;
  recapNote(p, dmg, src, cause, o);
  if (src instanceof Player && src !== p && src.team !== p.team) { src.dmgOut += dmg; p.dmgInP += dmg; noteFoe(p, src); }
  else if (BEAST_CAUSES.has(cause)) p.dmgInB += dmg;
  p.hurtT = 0.25;
  p.fightT = ITEM_FIGHT_T; // in a fight: DEN's heal waits (js/sim/items.js)
  if (!dot) {
    const k = HIT_KB * (kb === undefined ? 1 : kb);
    p.kbx = dx * k; p.kby = dy * k;
  }
  breakRecall(p); // a hit ends the walk home - that is what makes the channel a channel
  // a burn shakes and shouts once, when it lights (igniteUnit) - not four
  // times a second for as long as it runs
  if (!dot) shakeFor(p, crit ? 6 : 3);
  tallyHit(p, dmg);
  if (!dot) sfxAt('hurt', p.x, p.y);
  burst(p.x, p.y - 6, dot ? '#ff9440' : '#cfd8e8', 8, 50, 0.45);
  if (p.hp <= 0) die(p, src, cause);
}

// what the log says when nobody gets the credit
const DEATH_CAUSE = { ice: 'FELL THROUGH THE ICE', creek: 'WENT IN THE CREEK', wolf: 'WENT TO THE WOLVES', bear: 'MET A BEAR', tackle: 'RAN INTO SOMETHING SOLID', eagle: 'LOST THEIR EAGLE', fire: 'BURNED IN THE SNOW', soldier: 'FELL TO THE WAVE', orca: 'WENT TO THE ORCA', tower: 'TOOK A TOWER BOLT' };
// ...and what the line says when there IS credit but no arrow: `cause` is
// read for the verb too, so a burn doesn't get written up as a shot
const KILL_VERB = { fire: 'BURNED' };

// DEATH COSTS TIME, NOTHING ELSE. A body goes down with everything it had
// and comes back with all of it: the wallet, the weapon
// and its build, the items, the level. Nothing spills and nothing
// is looted (the 1.25-3.54 rule, where the killer pocketed the wallet and the
// build lay where it fell, is gone - it made the fifteenth minute a bag you
// were afraid to carry). What a kill is worth is gold from nowhere, paid out
// by payTakedown (the `takedowns` banner below) - and XP, which is the
// victim's level's worth (KILL_XP + KILL_XP_LV a level) shared by every
// rival standing near (shareXp), so a kill teaches the fight, not the blow.
// The one stake left on a death is the wait below and the walk back.
const KILL_XP = 40, KILL_XP_LV = 15; // XP a downed hero is worth: 55 at level 1, 310 at 18
const MULTI_T = 10;       // s a kill may follow the one before and still count toward a multi-kill (the post-game record)

// The wait for the bird to set a downed player back down: a read of the
// hero's level alone, shaped like League's (its base wait runs 10 s to
// 52.5 s over 18 levels, flat early, steepest mid-game). Early, levels 1-5
// (the opening minutes), a death is a few seconds and the fighting
// goes on; mid-game, 6-9, it starts to cost; from 10 a death is a real hole
// in the side, which is what makes a wiped side late a real window on a
// roost whose defenders otherwise come back sixty pixels from the bird.
// Nothing off the match clock: the level IS the clock, since XP only
// climbs. With nothing else lost on a death, this wait is the
// WHOLE penalty.
const RESPAWN_WAIT = [5, 6, 7, 8, 10, 12, 14, 17, 20, 23, 26, 29, 32, 35, 38, 41, 45, 50]; // s, by hero level 1..LEVEL_MAX
function respawnTime(p) { return RESPAWN_WAIT[Math.max(1, Math.min(LEVEL_MAX, p.level)) - 1]; }

// The body leaves the world: whatever it was holding, riding, casting or
// eating stops here. die() is this plus the record (the death, the kill, the
// feed line, the wait); a side that surrenders (js/sim/surrender.js) is this alone,
// since nobody went down.
function bodyOut(p) {
  p.dead = true;
  p.zip = -1;   // the handle is let go of (the respawn's reset clears the rest)
  p.zipWalk = false;
  rideEnd(p, true); // ...and off the deer, which bolts (js/sim/wildlife.js)
  p.charging = false;
  p.chargeT = 0;
  p.fireArmed = false;
  p.dodgeT = 0;
  p.vx = p.vy = 0;
  p.sliding = false;
  p.fallT = 0;
  p.swingT = p.swingCd = 0;
  // whatever ability the body was mid-way through dies with it, and the potion
  p.potT = 0;
  p.recallT = 0; // ...and the walk home it was channelling
  p.castT = 0; p.castAb = -1;
  p.shieldT = 0; p.rushT = 0;
  p.castSlam = false;
  p.buffT = 0; p.pushT = 0; // the bear buff and the orca buff go with the body too
  p.shields = []; p.resolve = 0; // ...and every shield, and ARMATOS's resolve
  p.hold = false; p.holdHit = false; p.dash = ''; p.marchHit.length = 0;
  passiveOut(p); // ...and whatever a hero's passive keeps on the body (HERO_PASSIVE out, js/sim/heroes.js)
  clearUnitStatus(p); // root, slow, net, mark and the fire go out with the body
  // an item on the cursor goes back in the bag, so it is still there when the
  // body comes back instead of vanishing with the hand that was holding it
}

// A player goes down two ways. While its team's bird still roosts (or is
// still flying in) it is temporary: p.dead is set (out of the world right
// now) but p.eliminated stays false and respawnT counts down to a return AT
// THE BIRD (see updateRespawns/respawnPlayer). Once the bird has been driven
// off it is permanent: p.eliminated = true, no way back - the eagle is the
// only thing that takes a player out of a match for good. Only the local
// player's ELIMINATION takes the screen with it (the death overlay); a
// respawn-pending local death gets the lighter 'respawning' overlay instead
// (see endMatch/DEAD_ITEMS/renderDead).
function die(p, src, cause) {
  // practice: nothing is at stake and nobody is ever out - a death is undone
  // on the spot, back at the spawn tile (on the map its side's roost) with
  // the build and the bag untouched; a party's guests the same as its leader
  if (PRACTICE) { practiceRevive(p); return; }
  // what this body is worth is read before the death clears the streak it wears
  const worth = killWorth(p), bounty = bountyOf(p);
  p.deathLog = p.hurtLog; p.hurtLog = []; // the blows that did it, for the death recap (js/ui/recap.js)
  p.deaths++;      // the match record; a respawn never clears it (js/ui/lobby.js)
  p.feed++;        // ...a run of deaths without a takedown makes it worth less (killWorth)
  p.streak = 0;    // ...and the run of kills ends with the body
  bodyOut(p);
  burst(p.x, p.y - 6, TEAMS[skin(p.team)].mark, 12, 55, 0.6);
  // kill credit and the feed line: the killer's colours if there is one,
  // otherwise the victim's, since the victim is who the line is about
  // A death the world dealt (the ice, the orca, the wolves) goes to the rival
  // who hit this body last inside ASSIST_T, the way League hands a tower's
  // execution to the last champion in; losing the bird is nobody's kill.
  const foes = cause === 'eagle' ? [] : recentFoes(p);
  p.foeHits = {};
  const killer = src && src !== p ? src : foes.length ? foes[0] : null;
  p.lastDeath = { by: killer && players.includes(killer) ? killer.id : -1, cause: cause || null, tick: state.tick };
  if (killer) {
    killer.kills++;
    killer.streak++; killer.bestStreak = Math.max(killer.bestStreak, killer.streak);
    // a multi-kill: each kill inside MULTI_T of the one before carries the run on
    killer.multiN = state.elapsed - killer.multiT <= MULTI_T ? killer.multiN + 1 : 1;
    killer.multiT = state.elapsed;
    killer.bestMulti = Math.max(killer.bestMulti, killer.multiN);
    if (killer.control === 'ai') aiDowned(killer, p); // a bot remembers who it keeps downing (the grudge, js/ai/ai-team.js)
    payTakedown(p, killer, foes, worth, bounty); // the kill's gold, the assists' share and a shutdown's bounty
    if (killer === player && !PRACTICE) PROFILE.addKill(); // the profile's lifetime count
    // FEAST (js/sim/items.js): a flat heal on a confirmed kill, the one
    // passive that isn't a plain kitOf() field
    if (killer.kit.killHeal > 0 && killer.hp < killer.maxHp) {
      const heal = healPlayer(killer, killer.kit.killHeal);
      addFloater(killer.x, killer.y - 14, '+' + heal, '#8fe08a');
      sfxAt('heal', killer.x, killer.y);
    }
  }
  callKill(p, killer, bounty); // the announcer's call and the kill feed's row (the `calls` banner below)
  // the XP is the rival side's whoever landed it - a hero the bear or the
  // orca took still teaches the rivals who stood by
  shareXp(p, KILL_XP + KILL_XP_LV * p.level, 1 - p.team, killer);
  storyDown(killer, p); // the match story (js/ui/story.js): who keeps downing whom
  // a killer the world stood in for keeps the world's line, in the killer's colours
  const shot = killer && killer === src;
  logEvent(shot ? boardName(killer) + ' ' + (bounty ? 'SHUT DOWN' : KILL_VERB[cause] || 'SHOT') + ' ' + boardName(p)
    : boardName(p) + ' ' + (DEATH_CAUSE[cause] || 'WENT DOWN'), killer || p);
  // the bird is the way back - a side whose objective has fallen is out,
  // however its players go down after that
  if (!teamEagleDown(p.team)) p.respawnT = respawnTime(p);
  else p.eliminated = true;
  if (p === player) { if (!PRACTICE) PROFILE.addDeath(); endMatch(p.eliminated ? 'lost' : 'respawning'); }
  // no NAME DOWN over the body: the feed line above says it, and the body's
  // own fall (the `going down` banner, js/draw/bodies.js) shows it, where a
  // word in the air sat over whatever the fight was still about
  else if (state.spec === p.id) specNext(1); // the player being watched went down: follow another
  checkLastStanding();
}

// ticks every dead-but-not-eliminated player's respawn timer; called from
// updatePlay alongside updateStructures, so it keeps running under the
// 'respawning' overlay exactly like the rest of the sim does under 'dead'
function updateRespawns(dt) {
  for (const p of players) {
    if (!p.active || !p.dead || p.eliminated) continue;
    // the bird left mid-timer: eagleFleeResolve puts the whole side out at
    // the end of the ceremony, so the timer simply stops meaning anything
    if (teamEagleDown(p.team)) continue;
    p.respawnT -= dt;
    if (p.respawnT > 0) continue;
    // a bird still in the air has nowhere to set anyone down: hold at zero
    // until it roosts (a player shot in the seconds between its own landing
    // and the bird's)
    const e = state.drop && state.drop.eagles[p.team];
    if (!e || e.state !== 'down') { p.respawnT = 0; continue; }
    respawnPlayer(p);
  }
}

// brings a downed player back at its team's bird: p.reset(false) is the exact
// full-clear a fresh eagle landing gets (same 3 s i-frames), anchored
// RESPAWN_OUT px down the lane from the roost - the nearest tile a body can
// stand on there - so the way back into the match is the road everyone
// else walked out on.
const RESPAWN_OUT = 40;
// the tile a body is set down on at its own roost: RESPAWN_OUT up the road
// from the bird, that tile itself when it stands (r0 0: the ring-out search
// alone took the tile above, which on a lane pointing up carried the body
// past the roost ring, BOOM_R) - null while the bird is not down. The
// carried-back hero and the recall (js/sim/recall.js) both land here.
function roostTile(p) {
  const e = state.drop && state.drop.eagles[p.team];
  if (!e || e.state !== 'down') return null;
  const d = e.laneDir || { x: 0, y: 1 };
  return nearestDryTile(e.x + d.x * RESPAWN_OUT, e.y + d.y * RESPAWN_OUT, p, 0);
}
function respawnPlayer(p) {
  const t = roostTile(p);
  if (t) p.spawn = t;
  p.eliminated = false;
  p.respawnT = 0;
  p.reset(false);
  burst(p.x, p.y - 2, '#f4f7ff', 16, 70, 0.5, true);
  sfxAt('place', p.x, p.y);
  if (p === player) {
    state.over = null;
    state.mode = 'play';
    state.spec = -1; // the camera returns to the local player, not whoever it was watching
    camX = Math.max(0, Math.min(WORLD * TILE - WV_W, p.x - WV_W / 2));
    camY = Math.max(0, Math.min(WORLD * TILE - WV_H, p.y - WV_H / 2));
    state.introFrom = { x: camX, y: camY };
    state.intro = HUD_IN_T; state.introLen = HUD_IN_T; // the HUD slides in, like a fresh landing
  }
}

// players still in the match (riding the eagle counts: it is about to land)
function aliveCount() { let n = 0; for (const p of players) if (p.active && !p.dead) n++; return n; }

// a team is still "in the match" while its bird has not been driven off and
// anyone on it is still in - note !eliminated, not !dead: a wiped team
// is waiting on its bird, not out, so the objective is the only way to win
function teamInMatch(team) {
  if (teamEagleDown(team)) return false; // the objective: a fallen eagle takes its whole side out
  return players.some((q) => q.active && q.team === team && !q.eliminated);
}

// rival TEAMS still in the match, by the same rule enemyOf()/PVP state -
// p's own team is never counted, and each rival team counts once however
// many players it has.
function rivalTeamsInMatch(p) {
  const seen = new Set();
  let n = 0;
  for (const q of players) {
    if (!q.active || seen.has(q.team) || !(!PVP || q.team !== p.team)) continue;
    seen.add(q.team);
    if (teamInMatch(q.team)) n++;
  }
  return n;
}

// the local player not eliminated and every RIVAL team gone: the match is won
// (only once, and only when there was another side to beat). Teams win
// together - a side is in the match while its bird roosts, whoever is
// standing - so this is the last BIRD standing, never the last player.
function checkLastStanding() {
  // practice has no rivals and no ending - an empty roster must not read as a win
  if (PRACTICE) return;
  // state.eagleCine: the driven-off ceremony is playing - the screens wait
  // for it (eagleFleeResolve re-runs this once the camera has had its moment)
  if (state.over || state.eagleCine || player.eliminated || rivalTeamsInMatch(player) > 0) return;
  endMatch('won');
}

// the practice room's answer to a fall: full pool, spawn tile, a beat of
// grace - the fall through the ice or the tackle still HAPPENED (the damage
// numbers taught what they taught), it just costs nothing that lasts
function practiceRevive(p) {
  p.hp = p.maxHp;
  p.vx = p.vy = 0;
  p.dodgeT = 0;
  clearUnitStatus(p); // the fire goes out with the fall, same as the stun
  p.fallT = 0; p.sliding = false;
  p.charging = false; p.chargeT = 0; p.fireArmed = false;
  p.potT = 0;                                    // the potion dies with the body here too
  p.recallT = 0;                                 // ...and the recall
  const s = p.spawn || { tx: WORLD >> 1, ty: WORLD >> 1 };
  p.x = (s.tx + 0.5) * TILE; p.y = (s.ty + 0.5) * TILE;
  p.invuln = 2;
  burst(p.x, p.y - 4, '#f4f7ff', 14, 60, 0.5, true);
  sfxAt('place', p.x, p.y); // in earshot only - it had rung on every screen for every bot's return
}

// Both end screens print the same object, so there is one of these rather
// than one per ending: the four tally numbers, the class it was played in,
// and the whole side both stages stand.
function endSnapshot() {
  return {
    gold: player.earned, kills: player.kills, level: player.level, time: state.elapsed,
    team: player.team, cls: player.cls,
    // the whole side, the local player first: every body either ending stands
    // on its stage, with the name TAB gives it (boardName: a bot goes by its hero), the hero and look it finished in (a mate who
    // is down at the whistle still shares the result)
    roster: players.filter((q) => q.active && q.team === player.team)
      .sort((a, b) => (a === player ? -1 : b === player ? 1 : a.id - b.id))
      .map((q) => ({ name: boardName(q), cls: q.cls, skin: heroSkinOf(q), team: q.team })),
  };
}

// the local player leaves the match, one way or the other: the overlay takes
// the screen (mode 'dead'), the sim runs on underneath it
function endMatch(how) {
  // count a win only the first time this match resolves as won - a second
  // endMatch('won') (or a driver poking it) must not increment twice
  const awardWin = how === 'won' && state.over !== 'won';
  // ...and the same edge for the loss sting below: a second endMatch('lost')
  // (or a driver poking it) must not ring twice over one ending
  const firstLoss = how === 'lost' && state.over !== 'lost';
  state.over = how;
  // the post-game lobby prints the match as it ENDED (js/ui/lobby.js): a won
  // match runs on underneath its own ceremony, so the table is frozen here
  // rather than read off `players` once the plank is finally pressed. A
  // respawn wait is not an ending and freezes nothing.
  if (how !== 'respawning') statFreeze();
  if (awardWin) PROFILE.addWin();
  // the coins: once per ending, on the same edges as the win and the loss sting
  if (awardWin || firstLoss) payMatchCoins(awardWin);
  if (awardWin || firstLoss) rankResult(awardWin); // RANKED's rating (js/ui/rooms.js)
  if (awardWin || firstLoss) buildsNote(awardWin); // every person's build and result, for the shop's RECOMMENDED (js/app/builds.js)
  state.mode = 'dead';
  state.deadView = 'menu';
  state.deadSel = 0;
  state.deadHover = [0, 0];
  state.mapOpen = false;
  state.settingsOpen = false; setDrop = null;
  state.wheel = null;
  state.deadTimer = 0;
  state.defeatT = 0;
  state.rpClosed = how === 'hostleft'; // every death opens the replay again; a host walking out is no death, and its door (LOBBY) shows at once
  // an ENDING freezes its numbers here, not in the render pass: the match
  // runs on underneath (a gold pump can still pay out, a rival can still
  // fall) and a total that climbs behind a tally which already counted it
  // reads as a bug. A loss's summary is opened minutes later, off the LOBBY
  // plank, so this is the only moment its numbers are still true.
  state.end = how === 'won' || how === 'lost' ? endSnapshot() : null;
  // a side that surrendered skips its defeat and lands on the post-game stats (js/sim/surrender.js)
  if (how === 'lost' && state.surrendered === player.team) openScores('menu');
  if (how === 'won') { SFX.victory(); state.shake = Math.max(state.shake, 4); }
  // ...and a loss gets the same courtesy: the defeat song used to come up
  // under silence where a win got a fanfare, so the worse of the two endings
  // was the quieter one. A sting, not a dirge - the song does the mourning.
  else if (firstLoss) SFX.defeat();
  // the end screen has a song of its own; a respawn timer is not the end of anything
  if (how === 'won' || how === 'lost') SFX.music.play(how === 'won' ? 'victory' : 'defeat', { in: 1.2 });
  player.input = makeInput(); // whatever was held dies with the player
  // a respawn wait has no planks: it opens straight onto an ally, with the
  // replay window over the view until it is closed (the `death & spectate`
  // banner, js/screens.js); specNext keeps to the side while the wait runs
  if (how === 'respawning') { state.deadView = 'spec'; state.spec = -1; specNext(1); }
}


// ------------------------------------------------------------ takedowns
// What a downed rival pays, League's way. The KILLER takes the body's worth;
// every other rival who hit it or pinned it in the last ASSIST_T s (noteFoe,
// fed by damagePlayer and ccCredit, js/sim/actions.js) takes an ASSIST and a
// share of half that worth. A body on a streak wears a BOUNTY (bountyOf, the
// coin over its name, drawBountyTag js/draw/overhead.js) that its killer
// cashes as a SHUTDOWN on top. A body that keeps going down without a kill or
// an assist (p.feed) is worth less, down to FEED_FLOOR, so feeding one side
// never funds the other. Every amount is counted in TAKEDOWN_GOLD shares: a
// plain kill is three of them, the biggest shutdown eight, so ending a streak
// pays without erasing the lead the streak built. Gold only goes to the
// living, as a kill always has.
const TAKEDOWN_GOLD = 110;  // one share: a takedown's unit of gold (League's scale, the `economy` note in js/sim/core.js)
const KILL_SOLDIERS = 3;    // shares a downed rival is worth to its killer, before feed and bounty
const ASSIST_T = 10;        // s a rival's blow or crowd control stays on a body's record
const ASSIST_SHARE = 0.5;   // of the worth, split evenly among the assists (each at least 1)
const BOUNTY_FROM = 2;      // the streak at which a body starts wearing a bounty
const BOUNTY_STEP = 1;      // soldiers the bounty grows by each kill from there...
const BOUNTY_MAX = 5;       // ...up to this (a streak of 6)
const FEED_FROM = 2;        // deaths without a takedown before a body is worth less
const FEED_STEP = 0.2;      // ...the worth lost each death past that...
const FEED_FLOOR = 1 / 3;   // ...down to this share of the plain kill

// ---- the death recap's record --------------------------------------------
// Every blow a player takes, kept for RECAP_T s: how much, from whom, and with
// what - a basic attack (`basic`), a key (`ab`, the ability's id, found on the
// hitter's keys here), a burn, or the world (`cause`). It is written AS THE
// SIDE SAW IT: a rival out of the side's sight when the blow landed (inSight,
// js/sim/fog.js) is kept as nobody - no id, no hero, no key - so neither the
// recap nor the wire can say what the dead player could not have known. What
// kind of blow it was stays (an arrow in you is an arrow you saw).
// An entry: { t, d, by (player id or -1), k ('atk'|'ab'|'burn'|'world'),
// c (the hitter's class, or the world's cause), i/o (key and option),
// m (a hit's `ab` that is no key: 'roll'), s (0: unseen) }
const RECAP_T = 10;  // s of blows a death looks back over
const RECAP_N = 64;  // most blows kept (a long burn is many small ones)
function recapNote(p, dmg, src, cause, o) {
  const log = p.hurtLog || (p.hurtLog = []), now = state.elapsed;
  while (log.length && (now - log[0].t > RECAP_T || log.length >= RECAP_N)) log.shift();
  const e = { t: now, d: dmg, by: -1, k: 'world', c: cause || '' };
  if (src instanceof Player && src !== p) {
    const ab = o && o.ab;
    e.k = cause === 'fire' ? 'burn' : o && o.basic ? 'atk' : 'ab';
    e.c = '';
    if (src.team !== p.team && !inSight(p.team, src)) e.s = 0;
    else {
      e.by = src.id; e.c = src.cls;
      const i = e.k === 'ab' && ab ? abKeyOf(src, ab) : -1;
      if (i >= 0) e.i = i; else if (e.k === 'ab' && ab) e.m = ab;
    }
  }
  log.push(e);
}

// a rival player's blow or crowd control on a player, for the assist list
function noteFoe(p, src) {
  if (!(src instanceof Player) || !(p instanceof Player) || src === p || src.team === p.team) return;
  (p.foeHits || (p.foeHits = {}))[src.id] = state.elapsed;
}
// the rivals inside ASSIST_T on p's record, the latest first
function recentFoes(p) {
  const h = p.foeHits || {}, out = [];
  for (const id in h) {
    const q = players[id];
    if (q && q.active && q.team !== p.team && state.elapsed - h[id] <= ASSIST_T) out.push(q);
  }
  return out.sort((a, b) => h[b.id] - h[a.id] || a.id - b.id);
}
// the plain kill in gold, and a body's bounty and worth
function killBounty() { return KILL_SOLDIERS * TAKEDOWN_GOLD; }
function bountyOf(p) { return p.streak < BOUNTY_FROM ? 0 : TAKEDOWN_GOLD * Math.min(BOUNTY_MAX, BOUNTY_STEP * (p.streak - BOUNTY_FROM + 1)); }
function killWorth(p) { return Math.round(killBounty() * Math.max(FEED_FLOOR, 1 - FEED_STEP * Math.max(0, p.feed - FEED_FROM + 1))); }

// p is down: the killer and the assists are paid, and every one of them has
// broken their run of feeding. The SHUTDOWN word rises over the body.
function payTakedown(p, killer, foes, worth, bounty) {
  killer.feed = 0;
  if (!killer.dead) awardGold(killer, worth + bounty, killer.x, killer.y); // from nowhere, never the victim's purse
  const help = foes.filter((q) => q !== killer);
  const share = help.length ? Math.max(1, Math.round(worth * ASSIST_SHARE / help.length)) : 0;
  for (const q of help) {
    q.assists++; q.feed = 0;
    if (!q.dead) awardGold(q, share, q.x, q.y);
  }
  if (bounty > 0) addFloater(p.x, p.y - 40, 'SHUTDOWN', '#f2cc6a', { scale: 2, rise: 20, life: 1.4 });
}

// ------------------------------------------------------------ calls
// What the sim hands the announcer (js/ui/announcer.js): the moment, who made
// it and who it was made on, and nothing about how it looks or sounds. A call
// is raised here, inside the step, and annRaise records it for the clients the
// way a cue is recorded (the `sim events` banner, js/net/events.js) - and every
// side hears every call, the way League's announcer speaks to the whole match.
// Practice is never a match: it calls nothing.
//
// One call per kill, the biggest it earns: FIRST BLOOD (the match's first),
// else a MULTI-kill of 2..5 (the run die() keeps, MULTI_T apart), else a
// SHUTDOWN (the body wore a bounty). Every player kill leaves a row on the
// feed whether it earned a call or not. An ACE follows when that kill left
// every body on the fallen side down.
const ANN_MULTI_MAX = 5; // PENTA is the last multi-kill with a name
function callKill(p, killer, bounty) {
  if (PRACTICE || !killer || !players.includes(killer)) return;
  let kind = 'kill', n = 0;
  if (!state.firstBlood) { state.firstBlood = true; kind = 'first'; }
  else if (killer.multiN >= 2 && killer.multiN <= ANN_MULTI_MAX) { kind = 'multi'; n = killer.multiN; }
  else if (bounty > 0) kind = 'shut';
  annRaise(kind, n, killer.id, killer.team, 'p', p.id);
  const side = players.filter((q) => q.active && q.team === p.team);
  if (side.length > 1 && side.every((q) => q.dead)) annRaise('ace', 0, killer.id, killer.team, 'side', p.team);
}
// a road tower down (STRUCTS[type].call, hurtStruct): credited to the player
// who broke it, or to the side whose wave did
function callStruct(o, p) {
  if (PRACTICE) return;
  const by = p && players.includes(p) ? p : null;
  annRaise('tower', 0, by ? by.id : -1, by ? by.team : 1 - o.team, 'tower', o.team);
}
// a midline bear down (MONSTER[kind].teamPay, animalDies): the hunter's call
function callBeast(a, hunter) {
  if (PRACTICE || !hunter) return;
  annRaise('beast', 0, hunter.id, hunter.team, 'beast', a.kind);
}
