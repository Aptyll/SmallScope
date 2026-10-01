'use strict';
// The bot's eyes and hands: how well a bot plays (the levels) and the skill
// layer between what the ladder (js/ai.js) decides and the input it writes.
// ------------------------------------------------------------ difficulty
// Every bot plays the same ladder; a PROFILE says how well. The RIVALS run
// AI_LEVELS[settings.aiLevel] (the lobby's plates, remembered with the
// profile); your ALLIES run one notch above the rivals (capped at the top)
// plus the support fields, so your side is always the more competent one
// and the difficulty is how good the other side is. Nothing in a profile
// lets a bot do what a hand cannot - every field is a worse or better use
// of the same input struct. Two kinds of field:
//
// HANDS AND EYES (the skill layer, below, plays them):
//   sight   px it notices a rival from (through seenAt, so cover still works);
//           scaled 4/3 with the 640x360 frame (3.22) so a bot keeps the same
//           share of what a screen shows a hand
//   react   s a rival stays noticed before the bot turns on it
//   cone    deg either side of where it is aiming that it is watching; a
//           rival outside it is noticed at `rear` x the rate (a flank works
//           on an easy bot) - a hit on the bot wakes it at the full rate
//   perceive s its read of a rival's place and motion trails the truth (a
//           strafe beats a slow reader; 0 reads the truth)
//   turn    rad/s its crosshair swings at (0 = at once); it holds a draw
//           until the crosshair is on, so a body cutting across a slow
//           hand is a shot that comes late
//   aim     px of aim wobble at bow range (70 px), a smooth drift, wider
//           the farther and the faster either body moves
//   fresh   x the wobble on a new target, settling to 1 over AI_SETTLE
//   lead    0..1 of the (read) motion it aims ahead by (flight time)
//   draw    fraction of the full draw (drawTime) it looses at (a short draw is a weak shot)
//   drawVar how far each shot's release strays from `draw`
//   slip    lapses per minute of fighting: a freeze, an early loose or a
//           straight walk in (skillSlip)
//   dodge   x the chance per second it rolls when hurt
//   abil    chance each AI_ABIL_T tick that a ready ability is spent
//   strafe  fraction of each 2 s it keeps moving in a fight; the rest it
//           PLANTS - stands, draws and shoots, the only time a slow side
//           fires - so the moment it stops is the moment it is about to
//           shoot, and the moment a new player hits it. Under 1 it also
//           circles that much less: it walks in straighter
//   work    duty cycle of the E key while harvesting (its level pace)
// CHOICES (the ladder and the team brain read them; neutral when a
// staged profile leaves one out):
//   judge   0..1 how well it reads a fight before taking or staying in it
//           (the numbers, hp, cover); 0 takes every fight it sees
//   focus   0..1 how strongly it joins the side's called target (focus fire)
//           over its own nearest
//   team    0..1 how reliably it follows the side's plan over its own whim
//   think   s between its re-reads of a plan (the fight rung itself runs every tick)
//   memory  s it keeps a rival it lost sight of in mind (p.ai.sk.lost)
//   flee    hp fraction under which it hides (hunter) / gives ground
//   pick    'near' the closest rival, 'weak' the one with the least hp
//   push    { t, n } - after t s, the side's first n bots go for the rival
//           eagle (the objective rung), one more every AI_ESCALATE s after
//           that, so a stalemate always breaks
//   guard   how many of the next bots stand by their own bird from 0.6 t on
//   support allies only: escort the human and join their fights and pushes
//   relentless  IMPOSSIBLE's rivals only: never give ground - a bow closes
//           in instead of backing off when crowded, a blocked line is walked
//           in through the open at any range, a camp on it is fought where it
//           stands - which with push {0, 99}, guard 0 and flee 0 is a side
//           that rushes your bird from the first second, everyone, and never
//           stops fighting; the only thing that turns one home is its own
//           bird under half nerve while it is LOSING the race (the pusher
//           rule, ai.js). Allies never inherit it (AI_ALLIES)
// What is NOT in a profile: answering a hit on its own bird. At every level
// a struck roost, or a rival seen standing off it, is answered from anywhere
// on the map by as many bots as the threat calls for (the two birds, ai.js)
// - the difficulty is how well they fight when they get there, never
// whether they come.
const AI_LEVELS = [
  { name: 'EASY', sight: 120, react: 1.1, cone: 60, rear: 0.25, perceive: 0.3, turn: 4, aim: 20, fresh: 2.2, lead: 0, draw: 0.6, drawVar: 0.25, slip: 6,
    dodge: 0.25, abil: 0.2, flee: 0.55, work: 0.4, strafe: 0.3,
    judge: 0.1, focus: 0, team: 0.5, think: 1.2, memory: 2, pick: 'near', push: { t: 420, n: 2 }, guard: 1 },
  { name: 'NORMAL', sight: 147, react: 0.7, cone: 80, rear: 0.4, perceive: 0.15, turn: 6, aim: 14, fresh: 1.8, lead: 0, draw: 0.7, drawVar: 0.15, slip: 3,
    dodge: 0.5, abil: 0.35, flee: 0.5, work: 0.5, strafe: 0.45,
    judge: 0.4, focus: 0.3, team: 0.75, think: 0.8, memory: 4, pick: 'near', push: { t: 360, n: 2 }, guard: 1 },
  { name: 'HARD', sight: 200, react: 0.3, cone: 120, rear: 0.6, perceive: 0.06, turn: 10, aim: 5, fresh: 1.5, lead: 0.5, draw: 0.9, drawVar: 0.06, slip: 1,
    dodge: 1, abil: 0.8, flee: 0.35, work: 0.8, strafe: 0.8,
    judge: 0.75, focus: 0.7, team: 0.95, think: 0.5, memory: 7, pick: 'near', push: { t: 360, n: 3 }, guard: 2 },
  { name: 'IMPOSSIBLE', sight: 267, react: 0, cone: 180, rear: 1, perceive: 0, turn: 0, aim: 0, fresh: 1, lead: 1, draw: 0.95, drawVar: 0, slip: 0,
    dodge: 2, abil: 1, flee: 0, work: 1, strafe: 1,
    judge: 0.95, focus: 1, team: 1, think: 0.3, memory: 10, pick: 'weak', push: { t: 300, n: 99 }, guard: 0, relentless: true },
];
// your allies at each rival level: the next notch up, supportive, one of
// them on guard, and on the objective on their own clock - late on EASY and
// NORMAL, so that a player who goes for the bird decides the match and one
// who never does is still carried to it; earlier as the rivals push earlier.
// The clocks are set for a match that ends round fifteen minutes when the
// human sits it out (the harness, multiplayer.md): an ally push takes two
// to three minutes to drive a bird off, so NORMAL's leaves at twelve
const AI_ALLY_PUSH = [{ t: 720, n: 2 }, { t: 720, n: 2 }, { t: 480, n: 3 }, { t: 420, n: 3 }];
// (an ally borrows the notch's hands, never IMPOSSIBLE's recklessness: it
// keeps a guard, a clock and a flee point of its own, so the human's side
// is still the one that holds its bird)
const AI_ALLIES = AI_LEVELS.map((_, i) => Object.assign({}, AI_LEVELS[Math.min(AI_LEVELS.length - 1, i + 1)],
  { name: 'ALLY', support: true, push: AI_ALLY_PUSH[i], guard: 1, relentless: false, flee: Math.max(0.2, AI_LEVELS[Math.min(AI_LEVELS.length - 1, i + 1)].flee) }));
// the one pair of hands every scripted seat plays with (the bot API, the
// ladder): HARD's, and never a level's choices - so a ladder ranks what a bot
// decides, not how well it aims. The writer runs skillHands(p, this, dt)
// after each act; `hands` marks it as a whole-body wrap (the wobble and the
// held draw apply to every aim, not just a fight the ladder named)
const AI_LADDER_HANDS = { name: 'LADDER', hands: true, turn: AI_LEVELS[2].turn, aim: AI_LEVELS[2].aim };
// which profile p plays by: a staged override (DBG, the harness), else by side
function aiProfile(p) {
  if (p.ai.prof) return p.ai.prof;
  const lv = Math.max(0, Math.min(AI_LEVELS.length - 1, settings.aiLevel | 0));
  return player && p.team === player.team ? AI_ALLIES[lv] : AI_LEVELS[lv];
}

// ------------------------------------------------------------ skill
// The hands between a decision and the input struct. The ladder says WHAT
// (this rival, shoot, stay or back off); these say how well it comes out,
// off the profile's hand fields. Each is a plain read of what a person at
// the keys would have: where they are looking, how fast their hand swings,
// how shaky it is, and the odd lapse. Everything draws on rng(), the sim's
// stream, so a bot is the host's alone like the rest of the sim.
// Per-bot state is p.ai.sk (skillOf), live for the dashboard:
//   tgt       the rival its hands are on; px/py/pvx/pvy its READ of them
//   ex/ey     the aim wobble in px; settle the fresh-target multiplier
//   aa        the crosshair's bearing (rad); off how far it is from the wish
//   alertT    s it stays wide awake after a hit; rate the notice rate last tick
//   draw      this shot's release point; slipT/slipKind the lapse in play
//   lost      { x, y, t } the last rival it lost sight of, t s ago
//   engaged   the fight rung had its hands this tick
//   view      the few numbers the dev view shows, kept on p.ai.thought.skill
//             when a brain has written a thought: { level, react, aim (the
//             wobble now, px), off (rad the crosshair trails), rate, slip }
const AI_SETTLE = 0.6;     // s the fresh-target wobble takes to settle (time constant)
const AI_WOBBLE_T = 0.5;   // s the wobble's drift takes to wander back to centre
const AI_ALERT_T = 2;      // s a hit keeps a bot watching every side
const AI_AIM_ON = 0.3;     // rad off the wish inside which a drawn shot may go
function skillOf(p) {
  return p.ai.sk || (p.ai.sk = { tgt: null, px: 0, py: 0, pvx: 0, pvy: 0, ex: 0, ey: 0, settle: 1, aa: 0, off: 0,
    alertT: 0, rate: 1, draw: 0, drawing: false, slipT: 0, slipKind: null, lost: null, engaged: false });
}
// a standard normal off the sim's stream (Box-Muller)
function skillGauss() { return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); }
// the top of every think: the clocks, and a hit's wake-up
function skillTick(p, prof, dt) {
  const sk = skillOf(p);
  sk.engaged = false;
  if (p.hurtT > 0) sk.alertT = AI_ALERT_T;
  else if (sk.alertT > 0) sk.alertT -= dt;
  if (sk.lost) { sk.lost.t += dt; if (sk.lost.t > prof.memory) sk.lost = null; }
}
// how fast a seen rival becomes a NOTICED one (ai.seeT's rate, 0..1): full
// inside the cone round where it is aiming or while alert, `rear` outside
function skillNotice(p, prof, foe) {
  const sk = skillOf(p);
  let rate = 1;
  if (foe && sk.alertT <= 0 && prof.cone < 180) {
    let da = Math.atan2(foe.y - p.y, foe.x - p.x) - sk.aa;
    da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
    if (da > prof.cone * Math.PI / 180) rate = prof.rear;
  }
  // a rival lost from sight is remembered where it was last seen
  if (!foe && sk.tgt && unitAlive(sk.tgt)) sk.lost = { x: sk.px, y: sk.py, t: 0 };
  if (!foe) sk.tgt = null;
  sk.rate = rate;
  return rate;
}
// where it aims at a rival it is fighting: its READ of them (trailing the
// truth by `perceive`), led by that read's motion, plus the wobble - a
// smooth drift, wider on a new target, with range and with either body moving
function skillAim(p, prof, foe, dt) {
  const sk = skillOf(p);
  sk.engaged = true;
  const vx = foe.vx || 0, vy = foe.vy || 0;
  if (sk.tgt !== foe) {
    sk.tgt = foe; sk.px = foe.x; sk.py = foe.y; sk.pvx = vx; sk.pvy = vy;
    sk.settle = prof.fresh; sk.lost = null;
  }
  const k = prof.perceive > 0 ? 1 - Math.exp(-dt / prof.perceive) : 1;
  sk.px += (foe.x - sk.px) * k; sk.py += (foe.y - sk.py) * k;
  sk.pvx += (vx - sk.pvx) * k; sk.pvy += (vy - sk.pvy) * k;
  sk.settle = 1 + (sk.settle - 1) * Math.exp(-dt / AI_SETTLE);
  const d = Math.hypot(foe.x - p.x, foe.y - p.y);
  if (prof.aim > 0) {
    const run = (b) => Math.min(1, Math.hypot(b.vx || 0, b.vy || 0) / PLAYER_SPEED);
    const sd = prof.aim * sk.settle * (0.5 + d / 140) * (1 + 0.6 * run(foe) + 0.4 * run(p));
    const f = Math.sqrt(2 * dt / AI_WOBBLE_T) * sd;
    sk.ex += -sk.ex * dt / AI_WOBBLE_T + f * skillGauss();
    sk.ey += -sk.ey * dt / AI_WOBBLE_T + f * skillGauss();
  } else { sk.ex = 0; sk.ey = 0; }
  const tf = prof.lead > 0 ? d / 300 * prof.lead : 0; // s of flight it leads by
  return { x: sk.px + sk.pvx * tf + sk.ex, y: sk.py - 6 + sk.pvy * tf + sk.ey };
}
// the draw fraction this shot looses at: `draw`, strayed by `drawVar`,
// rolled once per draw
function skillDraw(p, prof) {
  const sk = skillOf(p);
  if (p.charging) {
    if (!sk.drawing) { sk.drawing = true; sk.draw = Math.max(0.3, Math.min(1, prof.draw + (rng() * 2 - 1) * prof.drawVar)); }
  } else sk.drawing = false;
  return sk.drawing ? sk.draw : prof.draw;
}
// the lapse: `slip` times a minute of fighting its hands go wrong for a
// moment - it FREEZES (stands, holds the draw), LOOSES EARLY (the weak tap),
// or WALKS STRAIGHT IN (no strafe, no shot). Rewrites this tick's input.
function skillSlip(p, prof, foe, dt) {
  const sk = skillOf(p), inp = p.input;
  if (sk.slipT <= 0) {
    if (!prof.slip || rng() >= dt * prof.slip / 60) return;
    const r = rng();
    sk.slipKind = r < 0.4 ? 'freeze' : r < 0.7 ? 'early' : 'overrun';
    sk.slipT = sk.slipKind === 'early' ? dt : 0.35 + rng() * 0.5;
  }
  sk.slipT -= dt;
  if (sk.slipKind === 'freeze') { inp.mx = 0; inp.my = 0; inp.fire = p.charging; }
  else if (sk.slipKind === 'early') inp.fire = false;
  else {
    const a = Math.atan2(foe.y - p.y, foe.x - p.x);
    inp.mx = Math.cos(a); inp.my = Math.sin(a); inp.fire = p.charging;
  }
}
// the crosshair: after the ladder has written where it WANTS to aim, the
// aim point swings there at `turn` rad/s round the bot, and a drawn shot is
// held until the crosshair is within AI_AIM_ON of the wish (only in a fight:
// a shot anywhere else goes where it goes)
function skillHands(p, prof, dt) {
  const sk = skillOf(p), inp = p.input;
  let dx = inp.aimX - p.x, dy = inp.aimY - p.y;
  if (prof.hands && prof.aim > 0) { // a scripted seat: skillAim never ran, so the wobble rides here
    const f = Math.sqrt(2 * dt / AI_WOBBLE_T) * prof.aim * (0.5 + Math.hypot(dx, dy) / 140);
    sk.ex += -sk.ex * dt / AI_WOBBLE_T + f * skillGauss();
    sk.ey += -sk.ey * dt / AI_WOBBLE_T + f * skillGauss();
    dx += sk.ex; dy += sk.ey;
    inp.aimX = p.x + dx; inp.aimY = p.y + dy;
  }
  const want = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
  let da = Math.atan2(Math.sin(want - sk.aa), Math.cos(want - sk.aa));
  if (prof.turn > 0) {
    const step = prof.turn * dt;
    sk.aa += Math.max(-step, Math.min(step, da));
    da = Math.atan2(Math.sin(want - sk.aa), Math.cos(want - sk.aa));
    inp.aimX = p.x + Math.cos(sk.aa) * r; inp.aimY = p.y + Math.sin(sk.aa) * r;
  } else { sk.aa = want; da = 0; }
  sk.off = Math.abs(da);
  const th = p.ai.thought;
  if (th) {
    const v = sk.view || (sk.view = { level: '', react: 0, aim: 0, off: 0, rate: 1, slip: null });
    v.level = prof.name || ''; v.react = prof.react || 0; v.aim = Math.round(Math.hypot(sk.ex, sk.ey));
    v.off = Math.round(sk.off * 100) / 100; v.rate = sk.rate; v.slip = sk.slipT > 0 ? sk.slipKind : null;
    th.skill = v;
  }
  if ((sk.engaged || prof.hands) && p.charging && !inp.fire && sk.off > AI_AIM_ON) inp.fire = true;
}
