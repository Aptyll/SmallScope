'use strict';
// ------------------------------------------------------------ the coach
// The FIRST MATCH (PARTY_MODES.guide, js/ui/rooms.js) is a real 5v5 against
// EASY bots with one small card above the hud strip teaching the next thing
// to do: move, shop, abilities, last hits, recall, a tower, their eagle. The
// card is the key caps and one word, readable in a second; the DETAILS key (or ABILITY
// DETAILS on ALWAYS) opens one line of detail under it. A gold arrow stands
// over what a step is about (your merchant, your lane, their tower, their
// eagle), and until the first wave leaves its card carries the seconds to it.
// The card sits on the hud strip's buy plates. The dim X turns the coach off for good.
//
// It is this screen's UI and nothing else: it reads the local player and
// the world, never writes the sim, so every screen in a FIRST MATCH party
// coaches its own player and the match itself is any other match. A step's
// whole meaning is its GUIDE_STEPS row.
const GUIDE_MOVE_PX = 96;      // px walked from the landing that counts as moving
const GUIDE_RECALL_GOLD = 400; // gold in the purse (or half health) before RECALL is taught
const GUIDE_FLASH = 0.7;       // s a finished step's card holds, gold, before the next
const GUIDE_TIP_T = 7;         // s a lesson's line of detail stands open before it folds away
const GUIDE_HURT = 0.5, GUIDE_HURT_OUT = 0.75; // the share of your health under which RECALL is taught at once, and over which it steps back
const GUIDE_HOME_T = 1.5;      // s RECALL's card shows before standing at home counts
const GUIDE_HOME_PX = 400;     // px from your counter past which you are away from home (RECALL's moment)
const GUIDE_LANE_PX = 48;      // px from your lane's waiting spot that counts as there
const GUIDE_LIFT = 2;          // px between the card's foot and the strip's buy plates: it sits on the hud
const GUIDE_H = 16, GUIDE_PAD = 4;
const GUIDE_TIP_H = 9;         // the line of detail's band, in view px: it reads at the hud's own 1x, so the card stays low
const GUIDE_RAIL_AIR = 8;      // px of air between the top bar and an edge arrow under it
const GUIDE_K = 2;             // the card is drawn this many view px to one of its own: big enough that a first look finds it
const GUIDE_INK = '#07080a', GUIDE_EDGE = '#2f3238', GUIDE_BG = '#16181c';
const GUIDE_GOLD = '#f2cc6a', GUIDE_TXT = '#f4f7ff', GUIDE_LBL = '#a3a8b0', GUIDE_DIM = '#6c717a';

// the attack's button on the live scheme: the left click on WASD, the right on CLICK
function guideAttackCap() { return ckOn() ? 'RMB' : keyCap('click'); }
// your side's counter: the stall once it is pitched, else the merchant
function guideCounter() {
  const e = state.drop && state.drop.eagles[player.team], b = e && e.merchant;
  if (!b || b.dead) return null;
  if (stallUp(b.stall)) { const c = counterPt(b.stall); return { x: c.x, y: c.y - 48 }; } // over its awning
  return { x: b.x, y: b.y - 34 }; // over its name
}
// the lane your position holds (POSITIONS, js/sim/player.js): -1 in the jungle, which has none
function guideLaneOf() { const pos = POSITIONS[player.position]; return pos ? pos.lane : 1; }
// LANE's spot: where your lane's laner waits for the first wave (laneHold, js/sim/lanes.js)
function guideLaneSpot() { const l = guideLaneOf(); return l < 0 ? null : laneHold(player.team, l); }
function guideAtLane() {
  const h = guideLaneSpot();
  return !h || Math.hypot(h.x - player.x, h.y - player.y) < GUIDE_LANE_PX || guideFightUp();
}
// a rival soldier of your lane on the screen: the fight is in front of you and LAST HIT takes the card
function guideFightUp() {
  const lane = Math.max(0, guideLaneOf());
  for (const b of robots) {
    if (b.kind !== 'soldier' || b.lane !== lane || b.team === player.team || !unitAlive(b) || !inSight(player.team, b)) continue;
    const sx = wToSX(b.x), sy = wToSY(b.y);
    if (sx >= 0 && sx < VIEW_W && sy >= 0 && sy < VIEW_H) return true;
  }
  return false;
}
// s until the first wave leaves the barracks (barracksBeat, js/sim/structures.js); 0 once it has
function guideWave() { return state.elapsed < STRUCTS.barracks.first ? Math.ceil(barracksBeat(STRUCTS.barracks)) : 0; }
// RECALL's moment: hurt and away from home. It takes the card ahead of its turn under GUIDE_HURT of
// your health and keeps it until GUIDE_HURT_OUT, so a hero at the line does not flip cards
function guideHurt() {
  const up = guide.step >= 0 && GUIDE_STEPS[guide.step].id === 'recall';
  const c = guideCounter(), far = c ? Math.hypot(c.x - player.x, c.y - player.y) > GUIDE_HOME_PX : !roostRing(player); // home is a real walk away
  return far && player.hp < player.maxHp * (up ? GUIDE_HURT_OUT : GUIDE_HURT);
}
function guideRivalTowers() { return structures.filter((o) => o.type === 'tower' && o.team !== player.team); }
function guideNearTower() {
  let best = null, bd = Infinity;
  for (const o of guideRivalTowers()) {
    const f = towerFoot(o), d = Math.hypot(f.x - player.x, f.y - player.y);
    if (d < bd) { bd = d; best = f; }
  }
  return best ? { x: best.x, y: best.y - 70 } : null; // over the gun, not the foot
}

// where LAST HIT is learned: the rival soldier of your lane nearest you that
// your side sees, else your own lane's soldier furthest down it (walk with
// them and the fight finds you). With a rival soldier on the screen the
// lesson is in front of you and no arrow hops between them.
// With no soldier out yet it is the spot up your lane where they will meet,
// until that spot is on the screen.
function guideSoldier() {
  const lane = guideLaneOf() >= 0 ? guideLaneOf() : 1;
  const home = state.drop && state.drop.eagles[player.team];
  let rival = null, rd = Infinity, own = null, od = -1;
  for (const b of robots) {
    if (b.kind !== 'soldier' || b.lane !== lane || !unitAlive(b)) continue;
    if (b.team !== player.team) {
      if (!inSight(player.team, b)) continue;
      const d = Math.hypot(b.x - player.x, b.y - player.y);
      if (d < rd) { rd = d; rival = b; }
    } else if (home) {
      const d = Math.hypot(b.x - home.x, b.y - home.y);
      if (d > od) { od = d; own = b; }
    }
  }
  // until your own soldiers are out and past it, the arrow leads to where your lane's laner waits for them (laneHold):
  // the wait is the walk, and a wave leaving home never points you back
  const hold = laneHold(player.team, lane);
  if (own && home && od < Math.hypot(hold.x - home.x, hold.y - home.y)) own = null;
  const t = rival || own || hold;
  if (!own || rival) { const sx = wToSX(t.x), sy = wToSY(t.y); if (sx >= 0 && sx < VIEW_W && sy >= 0 && sy < VIEW_H) return null; }
  return { x: t.x, y: t.y - 24 };
}

// One row per lesson, in order. caps: the key faces shown; icon: an emblem
// before the word; word: the one word; tip: the DETAILS line; need/count: a
// number to reach; clock: it carries the seconds to the first wave; ready: the step
// waits (no card) until it is true; begin: noted as the coach starts, so
// a lesson done before its turn shows learned the moment its card comes up;
// now: true in the moment that calls for it, when it is shown ahead of its turn;
// done: it is learned; away: it is learned with its card down too (RECALL:
// SHOP takes the card as you near home, and the ring still counts); at: the
// world point its arrow stands over.
const GUIDE_STEPS = [
  { id: 'move', word: 'MOVE', tip: 'CHANGE YOUR KEYS IN SETTINGS: ESC',
    caps: () => [keyCap('move')],
    begin: (g) => { g.x0 = player.x; g.y0 = player.y; },
    done: (g) => Math.hypot(player.x - g.x0, player.y - g.y0) > GUIDE_MOVE_PX },
  // SHOP holds the card until the first buy, its arrow on the counter wherever you walk: a fight in front of you is the one thing ahead of it
  { id: 'shop', word: 'SHOP', tip: 'WALK TO YOUR MERCHANT AND BUY AN ITEM',
    caps: () => [keyCap('shop')],
    begin: (g) => { g.spent = player.goldSpent; },
    done: (g) => player.goldSpent > g.spent,
    at: guideCounter },
  { id: 'lane', word: 'LANE', tip: 'YOUR SOLDIERS MEET THEIRS HERE',
    caps: () => [], icon: () => player.position >= 0 ? posIcon(player.position, GUIDE_TXT) : null,
    done: guideAtLane, clock: true,
    at: () => { const h = guideLaneSpot(); return h && { x: h.x, y: h.y - 10 }; } },
  { id: 'ability', word: 'ABILITIES', tip: 'A POINT EACH LEVEL: PRESS ONCE TO LEARN, AGAIN TO CAST',
    caps: () => ['ab1', 'ab2', 'ab3', 'ab4'].map((a) => keyCap(a)),
    begin: (g) => { g.casts = 0; },
    need: 2, count: (g) => g.casts, clock: true },
  { id: 'farm', word: 'LAST HIT', tip: 'THE FINAL BLOW ON A SOLDIER PAYS GOLD',
    caps: () => [guideAttackCap()],
    begin: (g) => { g.farm0 = player.farm; },
    need: 3, count: (g) => player.farm - g.farm0, clock: true,
    now: guideFightUp, at: guideSoldier },
  { id: 'recall', word: 'RECALL', tip: 'STAND STILL: YOUR EAGLE TAKES YOU HOME AND THE RING HEALS YOU',
    caps: () => [keyCap('recall')],
    ready: () => player.gold >= GUIDE_RECALL_GOLD || player.hp < player.maxHp / 2,
    now: guideHurt,
    done: (g) => (g.up.recall || 0) > GUIDE_HOME_T && !!roostRing(player), away: true },
  { id: 'tower', word: 'TOWER', tip: 'GO IN BEHIND YOUR SOLDIERS: A TOWER SHOOTS THEM FIRST',
    caps: () => [],
    begin: (g) => { g.towers = guideRivalTowers().length; },
    done: (g) => guideRivalTowers().length < g.towers,
    at: guideNearTower },
  { id: 'eagle', word: 'THEIR EAGLE', tip: 'DRIVE IT OFF THEIR ROOST TO WIN',
    caps: () => [],
    done: () => false,
    at: () => { const e = state.drop && state.drop.eagles[1 - player.team]; return e ? { x: e.x, y: e.y - 40 } : null; } },
];

// the coach's own state: this page's, never the sim's (a rematch reloads it)
const guide = { step: -1, t: 0, flash: 0, off: false, casts: 0, cd: [0, 0, 0, 0], last: 0, hot: false, learned: [], up: {} }; // up: s each lesson's card has stood, by id

// the landing's headline (drawDropHeadline, js/draw/eagle.js) stands on the card's ground for its first seconds: the coach waits its turn
function guideHeadlineUp() {
  const e = state.drop && state.drop.eagles[player.team];
  return !!e && e.state === 'down' && e.restT < HEADLINE_IN + HEADLINE_HOLD;
}
function guideOn() {
  return NET.mode === 'guide' && !guide.off && state.mode === 'play' && !!state.drop &&
    !player.aboard && !inAir(player) && hudHome() && !guideHeadlineUp() && guideTour.t >= 0 && !guideTouring(); // the ride to their roost first; hudHome: never over a cinematic, the landing's or a bird driven off
}
function guideOpen(i) { guide.step = i; guide.t = 0; }
function guideDone(s) { return s.need ? s.count(guide) >= s.need : s.done(guide); }
// the lesson to show: one whose moment is this one, else the first not learned
function guideNext() {
  for (let i = 0; i < GUIDE_STEPS.length; i++) if (!guide.learned[i] && GUIDE_STEPS[i].now && GUIDE_STEPS[i].now()) return i; // ahead of its turn
  for (let i = 0; i < GUIDE_STEPS.length; i++) if (!guide.learned[i]) return i;
  return GUIDE_STEPS.length - 1;
}
// the card's clock, off the frame's time (it is UI, so it runs on a client too)
function updateGuide(now) {
  const dt = Math.max(0, Math.min(0.1, now - guide.last));
  guide.last = now;
  // every cast, by the cooldown starting on a key: sampled every frame, card up or not, so a
  // sample left over from before a ride or a death never hides the next cast behind it
  for (let i = 0; i < 4; i++) {
    const c = player.abCd[i] || 0;
    if (c > guide.cd[i] + 0.05 && guide.step >= 0) guide.casts++;
    guide.cd[i] = c;
  }
  if (!guideOn()) return;
  if (guide.step < 0) { for (const s of GUIDE_STEPS) if (s.begin) s.begin(guide); guideOpen(0); }
  if (guide.flash > 0) {
    guide.flash -= dt;
    if (guide.flash <= 0) {
      guide.flash = 0;
      guideOpen(guideNext());
    }
    return;
  }
  // the shown lesson is judged first, so a recall that lands you by the shop is credited before SHOP takes the card
  const s = GUIDE_STEPS[guide.step];
  if (!(s.ready && !s.ready() && guide.t === 0)) { // else it waits, unshown, for its moment
    guide.t += dt; guide.up[s.id] = (guide.up[s.id] || 0) + dt;
    if (guideDone(s)) {
      guide.learned[guide.step] = true; guide.flash = GUIDE_FLASH; SFX.place();
      if (GUIDE_STEPS.every((o, i) => guide.learned[i] || i === GUIDE_STEPS.length - 1)) PROFILE.setGuided(); // every lesson learned: the title stops offering it
      return;
    }
  }
  GUIDE_STEPS.forEach((o, i) => { if (o.away && !guide.learned[i] && guideDone(o)) guide.learned[i] = true; });
  const next = guideNext();
  if (next !== guide.step) guideOpen(next); // its place came to hand, or the shown one's fell behind
}

// the card's rect on the view: its head row is GUIDE_K view px to each of its
// own (lw x GUIDE_H, the X's corner at xx, xy in those), the line of detail
// under it at the view's 1x; centred over the strip, its foot on the buy plates
function guideRect(s) {
  const tip = guideTipOn();
  const caps = s.caps(), icon = s.icon && s.icon();
  let w = GUIDE_PAD;
  for (const c of caps) w += pixelTextWidth(c) + 6 + 2;
  if (caps.length) w += 2;
  if (icon) w += icon.width + 4;
  w += pixelTextWidth(guideWord(s));
  const clk = guideClock(s);
  if (clk) w += 5 + pixelTextWidth(clk);
  w += GUIDE_PAD + 9; // the X
  const tw = tip ? pixelTextWidth(s.tip) + GUIDE_PAD * 2 : 0;
  const vw = Math.max(w * GUIDE_K, tw), h = GUIDE_H * GUIDE_K + (tip ? GUIDE_TIP_H : 0);
  const top = VIEW_H - Math.round((AB_H + HUD_BAKE_HEAD) * hudSc()) - GUIDE_LIFT - h;
  const x = Math.round((VIEW_W - vw) / 2);
  return { x, y: top, w: vw, h, hx: x + ((vw - w * GUIDE_K) >> 1), lw: w, xx: w - 9, xy: 5 };
}
// the pointer over the card's X (its own px, with 3 px of grace to its left)
function guideOverX(r, mx, my) {
  return mx >= r.hx + (r.xx - 3) * GUIDE_K && mx < r.x + r.w && my >= r.y && my < r.y + GUIDE_H * GUIDE_K;
}
// the line of detail: open for a lesson's first GUIDE_TIP_T s, so a first match reads each one once
// unasked, then folded to the word; the DETAILS key (or ABILITY DETAILS on ALWAYS) opens it again
function guideTipOn() { return settings.tipFull || keyHeld('details') || state.mode === 'dead' || (guide.step >= 0 && !guide.flash && guide.t < GUIDE_TIP_T); }
function guideWord(s) { return s.need ? s.word + ' ' + Math.min(s.need, Math.max(0, s.count(guide))) + '/' + s.need : s.word; }
// the seconds to the first wave on a lesson that carries them, as the top bar's clock writes them; '' once it has left
function guideClock(s) { const t = s.clock && guideWave(); return t ? clockTxt(t) : ''; }
function guideShown() {
  if (!guideOn() || player.dead || guide.step < 0) return null;
  const s = GUIDE_STEPS[guide.step];
  if (!guide.flash && s.ready && guide.t === 0 && !s.ready()) return null;
  return s;
}
// a press on the X: the coach is off, and stays off
function guideClick(mx, my) {
  const s = guideShown();
  if (!s) return false;
  const r = guideRect(s);
  if (mx < r.x || mx >= r.x + r.w || my < r.y || my >= r.y + r.h) return false;
  if (guideOverX(r, mx, my)) { guide.off = true; PROFILE.setGuided(); SFX.pickup(); }
  return true; // the card eats the press either way
}

// the gold arrow's head, pointing down at a view point
function drawGuideTip(sx, sy) {
  ctx.fillStyle = GUIDE_INK;
  for (let r = 0; r < 5; r++) ctx.fillRect(sx - 5 + r, sy - 1 + r, 11 - 2 * r, 2);
  ctx.fillStyle = GUIDE_GOLD;
  for (let r = 0; r < 4; r++) ctx.fillRect(sx - 4 + r, sy + r, 9 - 2 * r, 1);
}
// SHOP's last step, at the open counter: the same arrow over BUY while the pick can be bought,
// so a first visit has one thing to press (drawn over the counter: renderUI, js/ui/compose.js)
function renderGuideShop(now) {
  const s = guideShown();
  if (!s || s.id !== 'shop' || guide.flash || !state.shopSel || !shopBuyState(state.shopSel).ok) return;
  const r = shopLayout().buy;
  drawGuideTip(r.x + (r.w >> 1), r.y - 7 + Math.round(Math.sin(now * 5) * 1.5));
}
// a gold arrow over a world point, bobbing; at the view's edge, pointing, when it is off screen
function drawGuideArrow(now, at) {
  const b = Math.round(Math.sin(now * 5) * 1.5);
  let sx = Math.round(wToSX(at.x)), sy = Math.round(wToSY(at.y));
  const M = 14;
  if (sx >= M && sx < VIEW_W - M && sy >= M + 30 && sy < VIEW_H - 60) { drawGuideTip(sx, sy + b); return; }
  // off screen: a 2x chevron on the edge, toward it, in one of eight
  // directions so its stairs stay even (GUIDE_EDGE_ARROW, turned by quarters)
  const cx = VIEW_W / 2, cy = VIEW_H / 2, dx = sx - cx, dy = sy - cy;
  const k = Math.min((VIEW_W / 2 - M) / Math.max(1, Math.abs(dx)), (VIEW_H / 2 - M - 20) / Math.max(1, Math.abs(dy)));
  const floor = VIEW_H - Math.round((AB_H + HUD_BAKE_HEAD) * hudSc()) - GUIDE_LIFT - GUIDE_H * GUIDE_K - GUIDE_TIP_H - 30; // ...and over the card on the hud: on the strip it reads as part of it
  const ex = Math.round(cx + dx * k) - 7, ey = Math.min(floor, Math.max(Math.round(cy + dy * k) - 7, railBottom() + GUIDE_RAIL_AIR)); // clear of the top bar: touching it, it reads as part of it
  const oct = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8; // 0 right, 1 down-right, ... clockwise
  const grid = GUIDE_EDGE_ARROW[oct & 1], turns = oct >> 1;
  const at2 = (i, j) => { for (let t = 0; t < turns; t++) { const n = 6 - j; j = i; i = n; } return [i, j]; };
  for (const ink of [GUIDE_INK, GUIDE_GOLD]) {
    ctx.fillStyle = ink;
    const o = ink === GUIDE_INK ? 1 : 0;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
      if (grid[j][i] !== '#') continue;
      const [x, y] = at2(i, j);
      ctx.fillRect(ex + x * 2 - o, ey + y * 2 - o, 2 + o * 2, 2 + o * 2);
    }
  }
}
// LANE's trail: gold dots from your feet to your own lane's road, then down
// it to the spot its laner waits at (laneHoldRoute, js/sim/lanes.js), a
// pulse running down them the way you go. An arrow points across the trees;
// the dots follow the road. They keep off the top bar, the strip and your own frame.
const GUIDE_TRAIL_GAP = 14; // px of road between two dots
const GUIDE_TRAIL_N = 40;   // dots ahead of you at most
const GUIDE_TRAIL_RUN = 7;  // dots between two pulses
const guideTrail = { key: '', pts: null };
function guideTrailPts() {
  const l = guideLaneOf();
  if (l < 0) return null;
  const key = player.team + ':' + l;
  if (guideTrail.key !== key) {
    const R = laneHoldRoute(player.team, l, GUIDE_TRAIL_GAP), out = [R[0]];
    let carry = 0;
    for (let i = 1; i < R.length; i++) { // even steps along the polyline
      const a = R[i - 1], b = R[i], d = Math.hypot(b.x - a.x, b.y - a.y);
      let t = GUIDE_TRAIL_GAP - carry;
      for (; t <= d; t += GUIDE_TRAIL_GAP) out.push({ x: a.x + (b.x - a.x) * t / d, y: a.y + (b.y - a.y) * t / d });
      carry = d - (t - GUIDE_TRAIL_GAP);
    }
    guideTrail.key = key; guideTrail.pts = out;
  }
  return guideTrail.pts;
}
function drawGuideTrail(now) {
  const P = guideTrailPts();
  if (!P) return;
  // the dot nearest you that still has road ahead of it, and a straight leg of dots from your feet to it
  let b = 0, bd = Infinity;
  for (let i = 0; i < P.length - 1; i++) { const d = Math.hypot(P[i].x - player.x, P[i].y - player.y); if (d < bd) { bd = d; b = i; } }
  const dots = [], leg = Math.floor(bd / GUIDE_TRAIL_GAP);
  for (let k = 1; k <= leg; k++) dots.push({ x: player.x + (P[b].x - player.x) * k / (leg + 1), y: player.y + (P[b].y - player.y) * k / (leg + 1) });
  for (let i = b; i < P.length && dots.length < GUIDE_TRAIL_N; i++) dots.push(P[i]);
  const run = Math.floor(now * 10) % GUIDE_TRAIL_RUN;
  const top = railBottom() + 4, foot = VIEW_H - Math.round((AB_H + HUD_BAKE_HEAD) * hudSc()) - 4;
  const px = wToSX(player.x), py = wToSY(player.y);
  dots.forEach((q, n) => {
    const sx = Math.round(wToSX(q.x)), sy = Math.round(wToSY(q.y));
    if (sx < 3 || sx >= VIEW_W - 3 || sy < top || sy >= foot) return;
    if (Math.abs(sx - px) < 16 && sy > py - 64 && sy < py + 8) return; // your body and the frame over it
    const lit = n % GUIDE_TRAIL_RUN === run; // the pulse runs away from you
    ctx.fillStyle = GUIDE_INK; ctx.fillRect(sx - 3, sy - 3, 6, 6);
    ctx.fillStyle = lit ? GUIDE_TXT : GUIDE_GOLD; ctx.fillRect(sx - 2, sy - 2, 4, 4);
  });
}
// the edge chevron pointing right and pointing down-right; the other six are these turned
const GUIDE_EDGE_ARROW = [
  ['#......', '###....', '#####..', '#######', '#####..', '###....', '#......'],
  ['......#', '.....##', '....###', '...####', '..#####', '.######', '#######'],
];

// ---- the wait to respawn ---------------------------------------------------
// A death in a FIRST MATCH is a lesson too: while the respawn clock runs the
// card stands where it always does, with the one thing that death teaches,
// read off the blows that did it (player.deathLog, recapNote in
// js/sim/player.js): a tower's share of them past GUIDE_DEATH_TOWER is the
// TOWER lesson, anything else is RECALL. Its line of detail stays open the
// whole wait and it wears no X (a press belongs to the death screen).
const GUIDE_DEATH_TOWER = 0.3; // a tower's share of the killing blows that makes the death the tower's
const GUIDE_DEATHS = {
  tower: { id: 'tower', word: 'TOWER', tip: 'GO IN BEHIND YOUR SOLDIERS: A TOWER SHOOTS THEM FIRST', caps: () => [] },
  recall: { id: 'recall', word: 'RECALL', tip: 'LOW ON HEALTH? YOUR EAGLE TAKES YOU HOME TO HEAL', caps: () => [keyCap('recall')] },
};
function guideDeathLesson() {
  if (NET.mode !== 'guide' || guide.off || state.mode !== 'dead' || state.over !== 'respawning') return null;
  const log = player.deathLog || [];
  let all = 0, tower = 0;
  for (const e of log) { all += e.d; if (e.k === 'world' && e.c === 'tower') tower += e.d; }
  return all > 0 && tower / all >= GUIDE_DEATH_TOWER ? GUIDE_DEATHS.tower : GUIDE_DEATHS.recall;
}
function renderGuideDead(now) {
  const s = guideDeathLesson();
  if (s) drawGuideCard(now, s, false, -1, false);
}

// the card: flat graphite, the caps and the word, the lessons' pips over it
function renderGuide(now) {
  guideTourDraw();
  updateGuide(now);
  const s = guideShown();
  if (!s) return;
  if (s.id === 'lane' && !guide.flash) drawGuideTrail(now); // the road to your lane, dot by dot
  const at = !guide.flash && s.at ? s.at() : null;
  if (at) drawGuideArrow(now, at);
  drawGuideCard(now, s, guide.flash > 0, guide.step, true);
}
// the card itself. cur: the lesson its white pip marks (-1: none); x: it wears the X
function drawGuideCard(now, s, lit, cur, x0) {
  const r = guideRect(s);
  const hot = x0 && mouse.inside && guideOverX(r, mouse.x, mouse.y);
  ctx.fillStyle = lit ? GUIDE_GOLD : GUIDE_INK; ctx.fillRect(r.x - GUIDE_K, r.y - GUIDE_K, r.w + GUIDE_K * 2, r.h + GUIDE_K * 2);
  ctx.fillStyle = GUIDE_EDGE; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = GUIDE_BG; ctx.fillRect(r.x + GUIDE_K, r.y + GUIDE_K, r.w - GUIDE_K * 2, r.h - GUIDE_K * 2);
  if (guideTipOn()) drawPixelText(ctx, s.tip, r.x + ((r.w - pixelTextWidth(s.tip)) >> 1), r.y + GUIDE_H * GUIDE_K - 2, GUIDE_LBL, 1);
  ctx.save();
  ctx.translate(r.hx, r.y); ctx.scale(GUIDE_K, GUIDE_K); // from here the head row's own px
  let x = GUIDE_PAD;
  const caps = s.caps(), icon = s.icon && s.icon();
  caps.forEach((c, i) => {
    // an ability key a point would learn pulses gold; one not learned is dim
    const learn = s.id === 'ability' && abLvCanBuy(player, i), dark = s.id === 'ability' && !abUnlocked(player, i);
    x += drawKeyCap(ctx, x, 3, c, dark && !learn, learn && Math.sin(now * 8) > 0 ? 2 : 0, now) + 2;
  });
  if (caps.length) x += 2;
  if (icon) { ctx.drawImage(icon, x, (GUIDE_H - icon.height) >> 1); x += icon.width + 4; }
  const word = guideWord(s);
  drawPixelText(ctx, word, x, 6, lit ? GUIDE_GOLD : GUIDE_TXT, 1);
  if (s.need) { // the count in gold
    const head = s.word + ' ';
    drawPixelText(ctx, word.slice(head.length), x + pixelTextWidth(head) + 1, 6, GUIDE_GOLD, 1);
  }
  const clk = guideClock(s);
  if (clk) drawPixelText(ctx, clk, x + pixelTextWidth(word) + 5, 6, GUIDE_GOLD, 1); // the first wave's seconds, in gold like the top bar's clock
  // the X
  ctx.fillStyle = hot ? GUIDE_GOLD : GUIDE_DIM;
  if (x0) for (let i = 0; i < 5; i++) { ctx.fillRect(r.xx + i, r.xy + i, 1, 1); ctx.fillRect(r.xx + 4 - i, r.xy + i, 1, 1); }
  // one pip a lesson: learned gold, this one white, the rest dark
  const n = GUIDE_STEPS.length, pw = n * 4 - 1, px0 = (r.lw - pw) >> 1;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = GUIDE_INK; ctx.fillRect(px0 + i * 4 - 1, -6, 4, 4);
    ctx.fillStyle = guide.learned[i] ? GUIDE_GOLD : i === cur ? GUIDE_TXT : GUIDE_EDGE;
    ctx.fillRect(px0 + i * 4, -5, 2, 2);
  }
  ctx.restore();
}

// ---- the ride to their roost -----------------------------------------------
// A FIRST MATCH shows the goal before the first lesson: once your landing's
// headline has gone, the camera rides down your lane from your eagle to
// theirs (zoomed out to the shows' framing, applyZoom, js/sim/sim.js), holds
// on their bird under one headline in their paint, and glides home. Walking
// off cuts it short: the hero is yours from the first frame. It is this
// screen's camera and nothing else, like the rest of the coach.
const GUIDE_TOUR_GO = 3.4;    // s the ride down the lane takes, eased at both ends
const GUIDE_TOUR_HOLD = 2.4;  // s it holds over their eagle
const GUIDE_TOUR_STOP = 24;   // px the hero walks that hands the camera back
const GUIDE_TOUR_ROAD = 24;   // points the middle road's ride is sampled at
const guideTour = { t: -1, path: null, len: 0, x0: 0, y0: 0, done: false }; // t: s into the ride, -1 before it
// the line the camera rides: your eagle, your lane to their hollow (the middle road for MID or the jungle), their eagle
function guideTourPath() {
  const mine = state.drop.eagles[player.team], theirs = state.drop.eagles[1 - player.team], lane = guideLaneOf();
  let pts;
  if (lane === 0 || lane === 2) pts = laneWaypoints(player.team, lane);
  else {
    const u0 = roadNest(player.team).u, u1 = roadNest(1 - player.team).u;
    pts = [];
    for (let i = 0; i <= GUIDE_TOUR_ROAD; i++) pts.push(roadPoint(u0 + (u1 - u0) * i / GUIDE_TOUR_ROAD));
  }
  return [{ x: mine.x, y: mine.y }].concat(pts, [{ x: theirs.x, y: theirs.y }]);
}
function guideTourAt(d) {
  const P = guideTour.path;
  for (let i = 1; i < P.length; i++) {
    const l = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
    if (d <= l || i === P.length - 1) { const k = l ? Math.min(1, d / l) : 1; return { x: P[i - 1].x + (P[i].x - P[i - 1].x) * k, y: P[i - 1].y + (P[i].y - P[i - 1].y) * k }; }
    d -= l;
  }
  return P[P.length - 1];
}
function guideTouring() { return guideTour.t >= 0 && !guideTour.done; }
// the camera's aim this frame while the ride runs (the play camera, js/sim/sim.js), else null
function guideTourAim(dt) {
  if (guideTour.done || NET.mode !== 'guide' || guide.off || state.mode !== 'play' || !state.drop) return null;
  const e = state.drop.eagles[player.team], r = state.drop.eagles[1 - player.team];
  if (guideTour.t < 0) { // it waits for both birds down and your headline gone
    if (!e || !r || e.state !== 'down' || r.state !== 'down' || guideHeadlineUp() || player.aboard || inAir(player)) return null;
    guideTour.path = guideTourPath(); guideTour.t = 0; guideTour.x0 = player.x; guideTour.y0 = player.y;
    guideTour.len = 0;
    for (let i = 1; i < guideTour.path.length; i++) guideTour.len += Math.hypot(guideTour.path[i].x - guideTour.path[i - 1].x, guideTour.path[i].y - guideTour.path[i - 1].y);
  }
  guideTour.t += dt;
  if (guideTour.t > GUIDE_TOUR_GO + GUIDE_TOUR_HOLD || Math.hypot(player.x - guideTour.x0, player.y - guideTour.y0) > GUIDE_TOUR_STOP) { guideTour.done = true; return null; }
  return guideTourAt(guideTour.len * easeInOut(Math.min(1, guideTour.t / GUIDE_TOUR_GO)));
}
// the one headline, over their bird while the ride holds there
function guideTourDraw() {
  if (!guideTouring() || window.DBG.hideUI) return;
  const t = guideTour.t - GUIDE_TOUR_GO + 0.3, left = GUIDE_TOUR_GO + GUIDE_TOUR_HOLD - guideTour.t; // up just before the camera arrives
  drawHeadline('DRIVE OFF THEIR EAGLE', 1 - player.team, Math.min(t / 0.25, left / 0.4));
}
