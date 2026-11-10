'use strict';
// ------------------------------------------------------------ the coach
// The FIRST MATCH (PARTY_MODES.guide, js/ui/rooms.js) is a real 5v5 against
// EASY bots with one small card above the hud strip teaching the next thing
// to do: move, shop, abilities, last hits, recall, a tower, their eagle. The
// card is the key caps and one word, readable in a second; the DETAILS key (or ABILITY
// DETAILS on ALWAYS) opens one line of detail under it. A gold arrow stands
// over what a step is about (your merchant, their tower, their eagle). The
// dim X turns the coach off for good.
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
const GUIDE_SHOP_PX = 400;     // px from your counter past which SHOP steps aside: out in the lane the next lesson teaches
const GUIDE_SHOP_BACK = 300;   // px from it within which SHOP comes back: the give between the two keeps a hero on the line from flipping cards
const GUIDE_LIFT = 8;          // px between the card's foot and the strip's buy plates
const GUIDE_H = 16, GUIDE_TIP_H = 10, GUIDE_PAD = 4;
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
// SHOP is taught where the shop is: within a short walk of your counter
function guideShopNear() {
  const c = guideCounter();
  const up = guide.step >= 0 && GUIDE_STEPS[guide.step].id === 'shop';
  return !!c && Math.hypot(c.x - player.x, c.y - player.y) < (up ? GUIDE_SHOP_PX : GUIDE_SHOP_BACK);
}
// RECALL's moment: hurt and away from home. It takes the card ahead of its turn under GUIDE_HURT of
// your health and keeps it until GUIDE_HURT_OUT, so a hero at the line does not flip cards
function guideHurt() {
  const up = guide.step >= 0 && GUIDE_STEPS[guide.step].id === 'recall';
  return !roostRing(player) && player.hp < player.maxHp * (up ? GUIDE_HURT_OUT : GUIDE_HURT);
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
  const pos = POSITIONS[player.position], lane = pos && pos.lane >= 0 ? pos.lane : 1;
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

// One row per lesson, in order. caps: the key faces shown; word: the one
// word; tip: the DETAILS line; need/count: a number to reach; ready: the step
// waits (no card) until it is true; here: false while its place is far away,
// and the next lesson teaches meanwhile; begin: noted as the coach starts, so
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
  { id: 'shop', word: 'SHOP', tip: 'WALK TO YOUR MERCHANT AND BUY AN ITEM',
    caps: () => [keyCap('work')],
    begin: (g) => { g.spent = player.goldSpent; },
    done: (g) => player.goldSpent > g.spent,
    here: guideShopNear, at: guideCounter },
  { id: 'ability', word: 'ABILITIES', tip: 'A POINT EACH LEVEL: PRESS ONCE TO LEARN, AGAIN TO CAST',
    caps: () => ['ab1', 'ab2', 'ab3', 'ab4'].map((a) => keyCap(a)),
    begin: (g) => { g.casts = 0; },
    need: 2, count: (g) => g.casts },
  { id: 'farm', word: 'LAST HIT', tip: 'THE FINAL BLOW ON A SOLDIER PAYS GOLD',
    caps: () => [guideAttackCap()],
    begin: (g) => { g.farm0 = player.farm; },
    need: 3, count: (g) => player.farm - g.farm0,
    at: guideSoldier },
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
  return NET.mode === 'guide' && !PRACTICE && !guide.off && state.mode === 'play' && !!state.drop &&
    !player.aboard && !inAir(player) && hudHome() && !guideHeadlineUp();
}
function guideOpen(i) { guide.step = i; guide.t = 0; }
function guideDone(s) { return s.need ? s.count(guide) >= s.need : s.done(guide); }
// the lesson to show: the first one not learned whose place is at hand
function guideNext() {
  for (let i = 0; i < GUIDE_STEPS.length; i++) if (!guide.learned[i] && GUIDE_STEPS[i].now && GUIDE_STEPS[i].now()) return i; // its moment is this one: ahead of its turn
  for (let i = 0; i < GUIDE_STEPS.length; i++) {
    const s = GUIDE_STEPS[i];
    if (!guide.learned[i] && (!s.here || s.here())) return i;
  }
  return GUIDE_STEPS.length - 1;
}
// the card's clock, off the frame's time (it is UI, so it runs on a client too)
function updateGuide(now) {
  const dt = Math.max(0, Math.min(0.1, now - guide.last));
  guide.last = now;
  if (!guideOn()) return;
  if (guide.step < 0) { for (const s of GUIDE_STEPS) if (s.begin) s.begin(guide); guideOpen(0); }
  // every cast, by the cooldown starting on a key
  for (let i = 0; i < 4; i++) {
    const c = player.abCd[i] || 0;
    if (c > guide.cd[i] + 0.05) guide.casts++;
    guide.cd[i] = c;
  }
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

// the card's rect on the view (x, y, w, h: GUIDE_K view px to each of its own
// lw x lh), centred over the strip and its buy plates, and its X's corner in its own px
function guideRect(s) {
  const tip = guideTipOn();
  const caps = s.caps();
  let w = GUIDE_PAD;
  for (const c of caps) w += pixelTextWidth(c) + 6 + 2;
  if (caps.length) w += 2;
  w += pixelTextWidth(guideWord(s)) + GUIDE_PAD + 9; // the X
  if (tip) w = Math.max(w, pixelTextWidth(s.tip) + GUIDE_PAD * 2);
  const h = GUIDE_H + (tip ? GUIDE_TIP_H : 0);
  const top = VIEW_H - Math.round((AB_H + HUD_BAKE_HEAD) * hudSc()) - GUIDE_LIFT - h * GUIDE_K;
  const x = Math.round((VIEW_W - w * GUIDE_K) / 2);
  return { x, y: top, w: w * GUIDE_K, h: h * GUIDE_K, lw: w, lh: h, xx: w - 9, xy: 5 };
}
// the pointer over the card's X (its own px, with 3 px of grace to its left)
function guideOverX(r, mx, my) {
  return mx >= r.x + (r.xx - 3) * GUIDE_K && mx < r.x + r.w && my >= r.y && my < r.y + GUIDE_H * GUIDE_K;
}
// the line of detail: open for a lesson's first GUIDE_TIP_T s, so a first match reads each one once
// unasked, then folded to the word; the DETAILS key (or ABILITY DETAILS on ALWAYS) opens it again
function guideTipOn() { return settings.tipFull || keyHeld('details') || state.mode === 'dead' || (guide.step >= 0 && !guide.flash && guide.t < GUIDE_TIP_T); }
function guideWord(s) { return s.need ? s.word + ' ' + Math.min(s.need, Math.max(0, s.count(guide))) + '/' + s.need : s.word; }
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
  const ex = Math.round(cx + dx * k) - 7, ey = Math.max(Math.round(cy + dy * k) - 7, railBottom() + GUIDE_RAIL_AIR); // clear of the top bar: touching it, it reads as part of it
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
  if (NET.mode !== 'guide' || PRACTICE || guide.off || state.mode !== 'dead' || state.over !== 'respawning') return null;
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
  updateGuide(now);
  const s = guideShown();
  if (!s) return;
  const at = !guide.flash && s.at ? s.at() : null;
  if (at) drawGuideArrow(now, at);
  drawGuideCard(now, s, guide.flash > 0, guide.step, true);
}
// the card itself. cur: the lesson its white pip marks (-1: none); x: it wears the X
function drawGuideCard(now, s, lit, cur, x0) {
  const r = guideRect(s);
  const hot = x0 && mouse.inside && guideOverX(r, mouse.x, mouse.y);
  const w = r.lw, h = r.lh;
  ctx.save();
  ctx.translate(r.x, r.y); ctx.scale(GUIDE_K, GUIDE_K); // from here the card's own px
  ctx.fillStyle = lit ? GUIDE_GOLD : GUIDE_INK; ctx.fillRect(-1, -1, w + 2, h + 2);
  ctx.fillStyle = GUIDE_EDGE; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = GUIDE_BG; ctx.fillRect(1, 1, w - 2, h - 2);
  let x = GUIDE_PAD;
  const caps = s.caps();
  caps.forEach((c, i) => {
    // an ability key a point would learn pulses gold; one not learned is dim
    const learn = s.id === 'ability' && abLvCanBuy(player, i), dark = s.id === 'ability' && !abUnlocked(player, i);
    x += drawKeyCap(ctx, x, 3, c, dark && !learn, learn && Math.sin(now * 8) > 0 ? 2 : 0, now) + 2;
  });
  if (caps.length) x += 2;
  const word = guideWord(s);
  drawPixelText(ctx, word, x, 6, lit ? GUIDE_GOLD : GUIDE_TXT, 1);
  if (s.need) { // the count in gold
    const head = s.word + ' ';
    drawPixelText(ctx, word.slice(head.length), x + pixelTextWidth(head) + 1, 6, GUIDE_GOLD, 1);
  }
  // the X
  ctx.fillStyle = hot ? GUIDE_GOLD : GUIDE_DIM;
  if (x0) for (let i = 0; i < 5; i++) { ctx.fillRect(r.xx + i, r.xy + i, 1, 1); ctx.fillRect(r.xx + 4 - i, r.xy + i, 1, 1); }
  if (guideTipOn()) drawPixelText(ctx, s.tip, GUIDE_PAD, GUIDE_H + 1, GUIDE_LBL, 1);
  // one pip a lesson: learned gold, this one white, the rest dark
  const n = GUIDE_STEPS.length, pw = n * 4 - 1, px0 = (w - pw) >> 1;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = GUIDE_INK; ctx.fillRect(px0 + i * 4 - 1, -6, 4, 4);
    ctx.fillStyle = guide.learned[i] ? GUIDE_GOLD : i === cur ? GUIDE_TXT : GUIDE_EDGE;
    ctx.fillRect(px0 + i * 4, -5, 2, 2);
  }
  ctx.restore();
}
