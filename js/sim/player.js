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
// it comes from being NEAR when a rival body dies - a soldier, a scout, a
// camp monster - shared among the allies standing there (shareXp, below), so
// the last hit is gold and the being-there is XP. Felling
// and the clock pay gold and never XP: the road is where you level.
// LEVEL_XP[n-1] is the total needed to reach level n, the gap growing by 30 a
// level. It is sized against a scout who keeps to the road and the camps
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

// Every player plays one of these HEROES. A hero is a body (its class outfit,
// js/sprites/looks.js) worn by ONE fixed `look` - the face, hair and beard
// every copy of it has, the way a League champion looks the same in every
// match (skins come later, never sliders) - plus a kit - the numbers
// updatePlayer / basicAttack / tryDodge read through kitOf(p) instead of the bare
// constants - plus its BASIC ATTACK on the left button (`attack`, read by
// js/sim/attack.js, which says what each field means) and its four ACTIVE
// ABILITIES on keys 1-4 (CLASS_AB,
// js/sim/abilities.js). Picked on the lobby's hero row (local, js/ui/chars.js)
// or hashed from the seed (bots) in initPlayers(). `look` axes are
// js/sprites/looks.js's: { sex, tone, hair, hairCol, beard, face }.
const CLASSES = [
  {
    name: 'HUNTER', role: 'BOW, DISTANCE, AMBUSH',
    look: { sex: 0, tone: 2, hair: 1, hairCol: 2, beard: 0, face: 1 },
    blurb: ['THE BOW IS THE ARGUMENT: KEEP THE GAP.', 'THE NET TANGLES THEM. THE GRAPPLE PULLS YOU CLEAR.', 'THE SNOW HIDES YOU. THE SHOT OUT OF IT HITS MUCH HARDER.'],
    story: 'THE EMPIRE FENCED ITS LAST FORESTS INTO HUNTING PARKS, AND ANYONE STILL HUNTING IN THEM BECAME A POACHER. THE VALLEY HAS NO FENCES. A HUNTER EATS WHAT THEY SHOOT AND SELLS THE REST AT THE COUNTER.', // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    // the seven stats at level 1, and what each level adds (js/sim/stats.js);
    // attack speed's base is the bow's own cycle (classAs), its growth a fraction
    base: { hp: 92, dmg: 16, armor: 12, ap: 0, haste: 0, ms: PLAYER_SPEED },
    grow: { hp: 7, dmg: 1.3, as: 0.013, armor: 2 }, // sized so 17 levels grow what 11 did when the cap was 12
    kit: { iceMax: 1, iceSteer: 2.8, slideMin: SLIDE_MIN, fatigue: 1, chargeMul: 0.55,
      bowCharge: BOW_CHARGE, nock: 0.4, spdDmg: 0, dodgeSpeed: DODGE_SPEED },
    rankOrder: [0, 1, 2], // the basic keys a bot ranks up first to last (aiSpend, js/ai/ai.js): the shot, the net, the grapple
    attack: { name: 'SHORTBOW', art: 'bow', cycle: 55 / 60, kb: 1, shot: { speed: 320, life: 0.85, col: '#e8dcb4' } },
  },
  {
    name: 'WARRIOR', role: 'PRESSURE, BLOCKING, MOMENTUM',
    look: { sex: 0, tone: 4, hair: 0, hairCol: 1, beard: 2, face: 0 },
    blurb: ['THE FIGHT IS AT ARM\'S LENGTH: GET THERE.', 'THE SHIELD EATS ARROWS. THE RUSH CARRIES BODIES.', 'THE SWORD REACHES A BODY LENGTH. THE EXECUTE FINISHES IT.'],
    story: 'THE EMPIRE SENDS ITS SOLDIERS HOME WHEN THE WAR ENDS, AND ITS WARS DO NOT END. A WARRIOR IS ONE WHO WALKED HOME ANYWAY. THE ONLY GATE STILL OPEN TO THEM WAS THE ONE AT THE PASS.', // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    base: { hp: 120, dmg: 18, armor: 20, ap: 0, haste: 0, ms: PLAYER_SPEED },
    grow: { hp: 9, dmg: 1.6, as: 0.01, armor: 2.6 },
    kit: { iceMax: 1.15, iceSteer: 3.2, slideMin: 70, fatigue: 0.7, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 230 },
    rankOrder: [2, 1, 0], // the stomp, the rush, the shield
    attack: { name: 'LONGSWORD', art: 'sword', cycle: 30 / 60, kb: 1.2, cut: { reach: 28, half: 1.05 } },
  },
  {
    // the first named hero (js/sim/armatos.js): the WARRIOR's body (`body`),
    // his own 16 px look over it (`skins`), his greatsword's cut and a kit of
    // his own on keys 1-4
    name: 'ARMATOS', role: 'THE LAST STANDARD', body: 1, passive: 'resolve', // HERO_PASSIVE, js/sim/heroes.js
    look: { sex: 0, tone: 1, hair: 2, hairCol: 6, beard: 3, face: 0 },
    blurb: ['NO SOLDIER LEFT BEHIND.', 'THE SHIELD TAKES THE HIT. THE BASH ANSWERS IT.', 'PLANT THE STANDARD: YOUR SIDE HOLDS, THEIRS CANNOT LEAVE.'],
    story: 'HE CARRIED THE STANDARD OF A LEGION THE EMPIRE MARCHED INTO THE SNOW AND FORGOT. HE BROUGHT EVERY ONE OF THEM HOME, AND THE EMPIRE CALLED IT A RETREAT. THE STANDARD IS BROKEN NOW. HE STILL PLANTS IT.', // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    base: { hp: 130, dmg: 16, armor: 24, ap: 0, haste: 0, ms: PLAYER_SPEED },
    grow: { hp: 10, dmg: 1.4, as: 0.008, armor: 2.9 },
    kit: { iceMax: 1.1, iceSteer: 3.2, slideMin: 70, fatigue: 0.7, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 225 },
    rankOrder: [0, 2, 1], // the verdict, the march, the brace
    attack: { name: 'OATH GREATSWORD', art: 'sword', cycle: 30 / 60, kb: 1.2, cut: { reach: 28, half: 1.05 } },
    // his own body in each of his looks (ARM_SKINS, js/sprites/armatos.js),
    // worn per player (heroSkinOf) in his iron over the side's coat
    skins: ARM_SKINS, skinPal: ARM_PAL, skinSlot: 'armatos',
    blade: 'oath', // his OATH GREATSWORD in his hands in place of the sword's own art (HERO_BLADES, js/draw/heroes.js)
    paint48: { t: '#7d8699', T: '#b4bdcc', g: '#1c2232', G: '#9aa3b8', m: '#5c6478', M: '#454c5e' }, // the 48 px model's (js/sprites/looks.js): its K is skin
  },
  {
    // the second named hero (js/sim/fortiva.js): a juggernaut on the WARRIOR's
    // frames and his sword's cut (`body`, `attack`) who wins the long fight: the most health of
    // anyone and a hard hit, a step slower so a hero who keeps its distance
    // can beat her
    name: 'FORTIVA', role: 'THE UNBROKEN', body: 1, passive: 'unbroken', // HERO_PASSIVE, js/sim/fortiva.js
    look: { sex: 1, tone: 2, hair: 3, hairCol: 3, beard: 0, face: 1 },
    blurb: ['STRENGTH IS THE POWER TO REFUSE TO KNEEL.', 'THE LONGER THE FIGHT, THE HARDER SHE IS TO STOP.', 'THE EDGE OF THE ARC HEALS HER. THE SHIELD PAYS BACK WHAT IT TOOK.'],
    story: 'THE EMPIRE WORKED HER IN CHAINS AT ITS FORGES UNTIL THE DAY SHE STOOD UP AND DID NOT KNEEL AGAIN. SHE CUT THE CHAIN AND HAMMERED IT INTO A SWORD. THE VALLEY DOES NOT ASK WHERE A BLADE CAME FROM.', // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    base: { hp: 132, dmg: 18, armor: 20, ap: 0, haste: 0, ms: PLAYER_SPEED - 3 },
    grow: { hp: 10, dmg: 1.7, as: 0.01, armor: 2.6 },
    rankOrder: [0, 2, 1], // the sever, the yoke, the heart
    attack: { name: 'CHAIN GREATSWORD', art: 'sword', cycle: 30 / 60, kb: 1.2, cut: { reach: 28, half: 1.05 } },
    // her own body in each of her looks (FORT_SKINS, js/sprites/fortiva.js),
    // worn per player (heroSkinOf) in her iron over the side's coat
    skins: FORT_SKINS, skinPal: FORT_PAL, skinSlot: 'fortiva',
    blade: 'chain', // her CHAIN GREATSWORD in her hands (HERO_BLADES, js/draw/heroes.js)
    paint48: { t: '#7d8699', T: '#b4bdcc', g: '#1c2232', G: '#9aa3b8', m: '#5c6478', M: '#454c5e' }, // the 48 px model's (js/sprites/looks.js): its K is skin
    kit: { iceMax: 1.1, iceSteer: 3.2, slideMin: 70, fatigue: 0.7, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 225 },
  },
  {
    // the third named hero (js/sim/bella.js): a duelist on the WARRIOR's frames
    // and his sword's cut (`body`, `attack`): quick and light, her damage in the
    // keys she chains, her life thin if she is caught
    name: 'BELLA', role: 'THE IMPERIAL GENERAL', body: 1, passive: 'calculated', // HERO_PASSIVE, js/sim/heroes.js
    look: { sex: 1, tone: 1, hair: 3, hairCol: 0, beard: 0, face: 2 },
    blurb: ['FIND THE WEAKNESS. SPEND IT FIRST.', 'THE LUNGE, THE SLIP AND THE PARRY CHAIN INTO EACH OTHER.', 'CALL OUT ONE HERO AND FINISH THEM.'],
    story: 'SHE WON THE EMPIRE A WAR ITS COURT HAD ALREADY CALLED LOST, AND THE COURT NEVER FORGAVE HER. TRAITOR WAS THE KINDEST WORD THEY HAD. SHE KEPT THE SPATHA WITH THE EAGLE ON IT. SHE SAYS IT IS HERS NOW.', // who they were before the pass: the wiki's hero page (docs/dev/lore.md)
    attack: { name: 'EAGLE SPATHA', art: 'sword', cycle: 26 / 60, kb: 1, cut: { reach: 26, half: 0.95 } }, // quicker and a little shorter than the longsword
    // her own body in each of her looks (BELLA_SKINS, js/sprites/bella.js),
    // worn per player (heroSkinOf) over the side's coat
    skins: BELLA_SKINS, skinPal: BELLA_PAL, skinSlot: 'bella',
    blade: 'spatha', // her EAGLE SPATHA in her hands (HERO_BLADES, js/draw/bella.js)
    paint48: { t: '#7d8699', T: '#b4bdcc', g: '#1c2232', G: '#9aa3b8', m: '#5c6478', M: '#454c5e' }, // the 48 px model's (js/sprites/looks.js): its K is skin
    base: { hp: 104, dmg: 18, armor: 16, ap: 0, haste: 0, ms: PLAYER_SPEED + 4 },
    grow: { hp: 7, dmg: 1.7, as: 0.013, armor: 2.1 }, // sized so 17 levels grow what 11 did when the cap was 12
    rankOrder: [0, 2, 1], // the lunge, the slip, the parry
    kit: { iceMax: 1.15, iceSteer: 3.4, slideMin: 70, fatigue: 0.75, chargeMul: 0.7,
      bowCharge: 0.75, nock: 0.5, spdDmg: 5, dodgeSpeed: 240 },
  },
];
// the body a hero wears - its sprites and its 48 px model: a hero that names
// none is its own (HUNTER 0, WARRIOR 1), a named hero borrows one
function heroBody(cls) { const c = CLASSES[cls]; return c && c.body != null ? c.body : cls; }
// the heroes announced but not yet playable: the hero row shows each as a
// dark silhouette of this body and look, its name on hover, and no press.
// One moves into CLASSES (with a kit and abilities) the day it ships.
const HEROES_SOON = [
  { name: 'SLEET', cls: 0, look: { sex: 1, tone: 1, hair: 4, hairCol: 6, beard: 0, face: 2 } },
  { name: 'DURAVO', cls: 1, look: { sex: 0, tone: 3, hair: 2, hairCol: 0, beard: 3, face: 0 } },
];
// the kit every sim site reads: the class's numbers with the player's items
// and items folded in. refreshKit() rebuilds the cache whenever one of them
// changes; kitOf() itself is called many times a frame and must stay a read.
function kitOf(p) { return p.kit || CLASSES[p.cls].kit; }
// swap a player's hero: its look comes with it (a copy - a snapshot merges
// `look` in place, js/net/snapshot.js, and must never write into CLASSES),
// kit hp applies on the spot (full heal, it's a pre-match choice), and the
// new hero's basic attack comes with its row (attackOf, js/sim/attack.js)
function setClass(p, c) { p.cls = c; p.look = Object.assign({}, CLASSES[c].look); refreshKit(p); p.hp = p.maxHp; }
// the hero's HEALTH stat: its base, its levels and its bonuses (statOf, js/sim/stats.js)
function levelMaxHp(p) { return statOf(p, 'hp'); }
// THE ONE WAY HEALTH COMES BACK to a player: a potion, a creek fish, a berry bush, the daylight, a second
// wind, a kill's heal. Capped at the most, and what it actually gave back is
// counted for the post-game record (js/ui/lobby.js) and returned.
function healPlayer(p, n) {
  const h = Math.max(0, Math.min(n, p.maxHp - p.hp));
  p.hp += h;
  p.healed += h;
  return h;
}
// the one way gold enters a wallet: the purse, and `earned`, the match's
// lifetime gold (the scoreboard's rank and the post-game GOLD). Gold buys;
// it no longer teaches - XP is gainXp's alone.
function gainGold(p, n) {
  p.inv.gold += n;
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
function tradeGold(p, n) { if (p && n > 0) p.inv.gold += n; }
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
// A death's XP, League style: every scout of `team` standing (alive, on the
// ground) within XP_R of the body shares it, and the one who landed the blow
// (`src`) always does, wherever they stood - a long shot still teaches. The
// pot grows XP_SHARE of the whole for each sharer past the first, so two
// scouts on a wave each get 65%, five get 46%: company pays, but less each.
// `team` is the side the death was good for - the rival of a soldier or a
// scout, the hunter's side for a beast (which has none).
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
  if (p.level >= LOG_LEVEL) logEvent(p.name + ' REACHED LEVEL ' + p.level, p);
  if (!inAir(p)) floaters.push({ x: p.x, y: p.y - 22, txt: 'LEVEL ' + p.level, color: '#f2cc6a', t: 0, vx: 0, scale: 2, rise: 20 });
  sfxFor(p, 'levelUp');
}
// the pose set a body draws from: its hero's body in its team's paint, worn
// by the hero's look (tone and fringe at 16 px - js/sprites/characters.js)
function classSet(p) { return SPRITES.champLook(p.cls, p.look, skin(p.team), heroSkinOf(p)); }
// the look a player wears on its hero (CLASSES[c].skins): the id its person
// picked for that hero (`p.skins`, a slot -> id map from their profile, sent
// with the hello and kept on the body, so every screen draws the same look),
// or null for the hero's own
function heroSkinOf(p) { const c = CLASSES[p.cls]; return c && c.skinSlot && p.skins ? p.skins[c.skinSlot] || null : null; }
// a hello's skins (msg.skins, js/net/net.js) as the host keeps them: only a
// hero's slot naming one of that hero's looks gets through
function cleanHeroSkins(m) {
  const out = {};
  if (!m || typeof m !== 'object') return out;
  for (const c of CLASSES) if (c.skinSlot && typeof m[c.skinSlot] === 'string' && c.skins.some((r) => r.id === m[c.skinSlot])) out[c.skinSlot] = m[c.skinSlot];
  return out;
}
// The local player wears the PROFILE: its name, and the hero it last locked
// in (js/app/profile.js), whose look and kit come with it. Called from
// initPlayers; the hero row (js/ui/chars.js) re-picks through setClass.
function applyProfile() {
  player.name = PROFILE.name();
  setClass(player, PROFILE.hero());
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
    huntMul: 1, nightHeal: false,
    harvestMul: 1, dodgeCd: DODGE_CD, stealth: 1,
    ambushMul: AMBUSH_MUL, bury: PRONE_BURY,
    killHeal: 0, kindle: false, chill: false, restHeal: 0, // the item passives (js/sim/items.js)
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
    grapple: false,      // held: the grapple reels only while this is down
                         // (key 3 for the human; the burrow itself is now the
                         // hunter's SNOW COVER cast, key 4, not an input)
    useItem: -1,         // edge-triggered: use what is in this item slot (0-5) - drink a potion (useItem, js/sim/items.js)
    ability: -1,         // edge-triggered: cast the class ability on this key (1-4), js/sim/abilities.js
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
  goldSpent: 0,                  // gold paid out of the purse (pay, js/sim/core.js)
  beasts: 0,                     // animals this body landed the last blow on (animalDies, js/sim/wildlife.js)
  farm: 0,                       // last hits on rival soldiers and camp monsters (farmHit, js/sim/farm.js)
  streak: 0, bestStreak: 0,      // rivals downed since this body last went down, and the most of it
  multiN: 0, multiT: -1e9, bestMulti: 0, // the run of kills MULTI_T apart, when the last one was, the most of it
  ccOut: 0,                      // s of stun, root and net put on RIVAL players (ccCredit, js/sim/actions.js)
  assists: 0,                    // rivals this body helped down without the last blow (payTakedown)
  feed: 0,                       // deaths since this body's last kill or assist: past FEED_FROM it is worth less (killWorth)
  earned: 0,                     // gold earned this match, spent or not (gainGold): the scoreboard's rank
};
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
    this.look = Object.assign({}, CLASSES[0].look); // the hero's face, set again by every setClass
    this.skins = {};                   // hero slot -> the look worn on that hero (heroSkinOf); a person's, from their profile
    this.spawn = { tx: WORLD >> 1, ty: WORLD >> 1 }; // landing tile once the eagle drops this player (the bot brain's "home")
    this.inv = { gold: 0 };             // the wallet is currency only
    this.cls = 0;                       // CLASSES index; the lobby sets the local one
    this.position = -1;                 // POSITIONS index the draft gave this seat, -1 none (draftReveal, js/ui/draft.js); the host's alone, never on the wire
    this.skillPts = 1;                  // unspent; level 1 starts with one, each levelUp adds one - spent on ability levels (buyAbilityLv, js/sim/abilities.js)
    this.abLv = [0, 0, 0, 0];           // ability ranks, 0 (LOCKED) ..abLvMax (5, the ultimate 3), a skill point each - like items, NOT cleared by reset(): a death keeps what was bought
    this.abPick = [0, 0, 0, 0];         // which option each key carries (abOf, js/sim/abilities.js), picked pre-match in the hero pop-up; a bot keeps the first
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
      hideT: 0, hideCd: 0,
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
      // in a fight (aiRangeBand), packT how long it has waited at the rally, scout/scoutN
      // the scout's point and step along its beat, thought what it is doing
      // and why (the dashboard's record)
      mood: null, helping: -1, foeId: -1, focusT: 0, focusOk: false, packT: 0, scout: null, scoutN: 0, thought: null, lastFoe: null, lastFoeT: -1e9, fleeT: -1e9, downs: {}, grudge: null, scoutCd: 0, answerAt: 0, answerKind: null, answerKey: "", band: null,
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
    // prone: lying down, how much snow is over you (0..1), the get-up window,
    // the crawl's animation phase, and the two tells a buried body still gives
    this.prone = false; this.hide = 0; this.riseT = 0;
    this.crawlT = 0; this.puffT = 0; this.hideFlash = 0;
    this.swingT = 0; this.swingCd = 0; this.swingDir = 0; this.swingHitDone = false;
    this.swing = SWING_BOW;                        // held SWING_TOOLS index (bow at rest)
    this.autoSwing = false;                        // the swing in flight was the hands' own (autoWork), so a draw may begin under it
    // the class abilities (keys 1-4, js/sim/abilities.js): per-key cooldowns, the
    // cast in progress, and every timed state one can leave on a body -
    // slowed under a net or a crater, mid-reel on the grapple, shielded,
    // or mid-rush
    this.abCd = [0, 0, 0, 0];                      // (abLv, the ranks bought, lives in the constructor: a death keeps them)
    this.windT = 0; this.windRate = 0;             // SECOND WIND's breath: s left, hp a second (abSecondWind)
    this.castAb = -1; this.castT = 0; this.castMax = 0; // castMax is the wind-up's full length, so a telegraph can read how far along it is (castProg)
    // Every state ANY unit can be under - stun, root, slow and its net
    // drape, the mark, and fire - is written and cleared in one place for
    // all three kinds of unit (`status effects`, js/sim/actions.js), so a player,
    // a deer and a bot wear the identical set.
    clearUnitStatus(this);
    this.shieldT = 0; this.shieldA = 0;            // the tower shield, and where it faces
    this.rushT = 0; this.rushNX = 0; this.rushNY = 0; this.rushVictim = null;
    this.castSlam = false;                         // the shield key pressed mid-wall or mid-rush: the cast in flight is the SLAM, not a raise (js/sim/abilities.js)
    this.buffT = 0;                                // s of a bear buff left (campBuff, wildlife.js): harder blows, a quicker walk
    this.buffKind = null;                          // ...and which bear's ('alpha' or 'dire'): its name and its ring's colour
    this.dawnShield = 0;                           // hp of the DAWN SHIELD left (pickSnowdrop, js/sim/actions.js): spent before health
    this.wardHp = 0; this.wardT = 0;               // a timed shield (shieldUnit, js/sim/actions.js): spent after the dawn's, gone when its clock runs out
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
    this.duelId = -1; this.duelT = 0; this.flurryN = 0; this.flurryT = 0; this.flurryId = -1; this.flurryArm = false;
    this.hopT = 0;                                 // the net shot's recoil hop, on the body
    this.grapT = 0; this.grapX = 0; this.grapY = 0; // the grapple: reel time left, and the anchor it hauls toward
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
let inv = null;      // === player.inv, the counters the HUD draws
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

// A ROSTER is one entry per slot: { control, team?, name?, cls?, look? }.
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
  inv = player.inv;
  applyProfile(); // the local player is the profile: its name and its last hero
}

// who p is allowed to shoot: another live player on another team (this is the
// one place the FFA/friendly-fire rule lives)
function enemyOf(p, q) { return q !== p && q.active && !q.dead && !inAir(q) && (!PVP || q.team !== p.team); }
// riding the eagle or falling from it: not in the world, nothing can touch it
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
// How buried a player reads to anything hunting for it. `p.hide` is the cover
// itself; a mound that is crawling is worth much less than one holding still,
// which is the whole reason to stop moving before you shoot.
function concealOf(p) { return p.hide > 0 ? p.hide * (p.moving ? PRONE_MOVE : 1) : 0; }
// How far p is noticed from by a watcher whose plain sight range is `range`.
// The kit's stealth (items) shortens it; lying under the snow shortens it hard - but
// never past PRONE_SNIFF, because at arm's length you are found whatever you
// are lying under. Every watcher in the game (the pack, the towers, the bot
// brain) resolves through this one function so they cannot disagree about who
// is hidden. A watcher that plays by the fog of war (a bot, a hand's lock-on)
// names its side as `team`: a rival outside that side's sight is not seen at
// all (inSight, js/sim/fog.js). Creatures watch without it.
function seenAt(p, range, team) {
  // the falcon's mark is the ONE legal bypass: a swept rival is simply seen,
  // whatever they are lying under or however deep in the fog, until the mark
  // runs out (js/sim/abilities.js)
  if (p.markT > 0) return range;
  if (team !== undefined && !inSight(team, p)) return 0;
  const c = concealOf(p);
  const r = range * kitOf(p).stealth * (1 - PRONE_CUT * c);
  return c > 0 ? Math.max(r, Math.min(range, PRONE_SNIFF)) : r;
}
// the shot that was worth the wait: full cover, and dead still while it goes
function ambushReady(p) { return p.prone && p.hide >= 1 && !p.moving; }

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
const structures = []; // every building: road towers, barracks, pumps, nets
const robots = []; // the bots: wave soldiers and the merchants
const arrows = []; // live bow shots: {x,y,vx,vy,t,life,dmg,pow}
const ARROW_PX = []; // scratch x,y,colour triples for one rasterised arrow body (render only)
const particles = []; // {x,y,vx,vy,life,color,size,grav} + optional `alpha` fade ceiling
const floaters = [];
const footprints = [];
const fish = []; // swimmers under the ice: {x,y,a,spd,t,turnT,spook}
const holes = []; // tile idx of open water holes; they refreeze each dawn
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
  dmg = armorTaken(p, dmg); // ARMOR cuts every hit by its share, never to zero (js/sim/stats.js)
  dmg = heroTaken(p, dmg, dx, dy, src); // ...and a hero's own cut: ARMATOS's brace (HERO_TAKEN, js/sim/heroes.js)
  passiveHurt(p, dmg, src); // a hero's passive fed by the hits it takes (LEGION'S RESOLVE)
  // the dawn shield (pickSnowdrop, js/sim/actions.js) takes the hit first, a burn
  // included; what is left of the blow goes on to health
  const shielded = Math.min(p.dawnShield, dmg);
  if (shielded > 0) {
    p.dawnShield -= shielded;
    burst(p.x, p.y - 10, '#ffd84a', 4, 36, 0.35);
    if (p.dawnShield <= 0) { sfxAt('shieldBreak', p.x, p.y); burst(p.x, p.y - 10, '#fff4b8', 10, 60, 0.5); }
  }
  // ...then a timed shield (shieldUnit), the same way
  const warded = Math.min(p.wardHp, dmg - shielded);
  if (warded > 0) {
    p.wardHp -= warded;
    burst(p.x, p.y - 10, '#f2cc6a', 4, 36, 0.35);
    if (p.wardHp <= 0) { p.wardT = 0; sfxAt('shieldBreak', p.x, p.y); }
  }
  p.hp -= dmg - shielded - warded;
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
  risePlayer(p); // nobody stays buried through a hit: the cover is blown with the body
  breakRecall(p); // ...and the walk home goes with it - that is what makes the channel a channel
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
const KILL_XP = 40, KILL_XP_LV = 15; // XP a downed scout is worth: 55 at level 1, 310 at 18
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
  p.prone = false; p.hide = 0; p.riseT = 0;
  p.fallT = 0;
  p.swingT = p.swingCd = 0;
  // whatever ability the body was mid-way through dies with it, and the potion
  p.potT = 0;
  p.recallT = 0; // ...and the walk home it was channelling
  p.castT = 0; p.castAb = -1;
  p.shieldT = 0; p.rushT = 0; p.rushVictim = null;
  p.castSlam = false; p.hopT = 0; p.grapT = 0;
  p.buffT = 0; // the bear buff goes with the body too
  p.dawnShield = 0; // ...and the dawn's shield
  p.wardHp = 0; p.wardT = 0; p.resolve = 0; // ...and any other shield, and ARMATOS's resolve
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
  // on the spot, back at the spawn tile with the build and the bag untouched
  if (PRACTICE && p === player) { practiceRevive(p); return; }
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
  // the XP is the rival side's whoever landed it - a scout the bear or the
  // orca took still teaches the rivals who stood by
  shareXp(p, KILL_XP + KILL_XP_LV * p.level, 1 - p.team, killer);
  storyDown(killer, p); // the match story (js/ui/story.js): who keeps downing whom
  // a killer the world stood in for keeps the world's line, in the killer's colours
  const shot = killer && killer === src;
  logEvent(shot ? killer.name + ' ' + (bounty ? 'SHUT DOWN' : KILL_VERB[cause] || 'SHOT') + ' ' + p.name
    : p.name + ' ' + (DEATH_CAUSE[cause] || 'WENT DOWN'), killer || p);
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
// from the bird, the nearest dry one - null while the bird is not down. The
// carried-back scout and the recall (js/sim/recall.js) both land here.
function roostTile(p) {
  const e = state.drop && state.drop.eagles[p.team];
  if (!e || e.state !== 'down') return null;
  const d = e.laneDir || { x: 0, y: 1 };
  return nearestDryTile(e.x + d.x * RESPAWN_OUT, e.y + d.y * RESPAWN_OUT, p);
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
  p.prone = false; p.hide = 0; p.riseT = 0;
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
// the whole side both stages stand, and the one fact only the loss prints
// (its placing).
function endSnapshot() {
  // where the local player finished: every player still in the match outlasted
  // it, so place is one past that count. A win is 1st by definition (the
  // screen that prints place never sees a win, but the object shouldn't lie).
  const left = players.filter((q) => q !== player && q.active && !q.eliminated).length;
  return {
    gold: player.earned, kills: player.kills, level: player.level, time: state.elapsed,
    team: player.team, cls: player.cls,
    // the whole side, the local player first: every body either ending stands
    // on its stage, with the name, class and kit it finished in (a mate who
    // is down at the whistle still shares the result)
    roster: players.filter((q) => q.active && q.team === player.team)
      .sort((a, b) => (a === player ? -1 : b === player ? 1 : a.id - b.id))
      .map((q) => ({ name: q.name, cls: q.cls, look: q.look, team: q.team })),
    place: player.eliminated ? left + 1 : 1, of: players.filter((q) => q.active).length,
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
  state.mode = 'dead';
  state.deadView = 'menu';
  state.deadSel = 0;
  state.deadHover = [0, 0];
  state.mapOpen = false;
  state.settingsOpen = false; setDrop = null;
  state.wheel = null;
  state.deadTimer = 0;
  state.defeatT = 0;
  state.rpClosed = false; // every death opens the replay again
  // an ENDING freezes its numbers here, not in the render pass: the match
  // runs on underneath (a generator can still pay out, a rival can still
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
// never funds the other. Every amount is counted in SCRAPPED SOLDIERS
// (SOLDIER_BOUNTY, js/sim/farm.js, read at the kill), so the kill keeps its
// place in the farm whatever a last hit is retuned to: a plain kill is three
// of them, the biggest shutdown eight, so ending a streak pays without
// erasing the lead the streak built. Gold only goes to the living, as a kill
// always has.
const KILL_SOLDIERS = 3;    // soldiers a downed rival is worth to its killer, before feed and bounty
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
      if (i >= 0) { e.i = i; e.o = src.abPick ? src.abPick[i] | 0 : 0; } else if (e.k === 'ab' && ab) e.m = ab;
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
function killBounty() { return KILL_SOLDIERS * SOLDIER_BOUNTY; }
function bountyOf(p) { return p.streak < BOUNTY_FROM ? 0 : SOLDIER_BOUNTY * Math.min(BOUNTY_MAX, BOUNTY_STEP * (p.streak - BOUNTY_FROM + 1)); }
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
