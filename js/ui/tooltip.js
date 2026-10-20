'use strict';
// The hover tooltip: tipAt resolves what the pointer is on into rows, tipPos
// places the panel, drawTooltip prints it. The one place the HUD compares numbers.
// ------------------------------------------------------------ tooltips
// One panel that says what the pointer is on - and the one
// deliberate exception to show-don't-label in the HUD, recorded as such in
// CLAUDE.md's UI rule. The reason it earns the exception: a tool's rate of
// fire, a bit's weight and a card's effect are NUMBERS the player is being
// asked to compare, and there is no shape that compares numbers. The wells
// keep doing the at-a-glance job - tier plate, pips, wipes - and this is where
// you go when at-a-glance is not enough.
//
// WHERE it sits is the player's (settings.tipFollow - the TOOLTIP row on the
// ESC panel's GAME page), and tipPos is the only thing that answers:
//   FOLLOWING, the default: beside the pointer, so the numbers arrive where the
//     eye already is and reading one costs no glance across the screen.
//   FIXED: bottom left - the corner the pointer is furthest from while it hovers
//     the backpack, the weapon strip or a tech node, so the panel can never
//     cover the well beside the one being read, and nothing else lives there.
//
// EVERY tooltip comes from tipAt(), which asks the same hit-testers, in the
// same order, that the click handler does - so what the panel describes and
// what a click would do can never be two different things.
const TIP_PAD = 4;      // frame edge to content
const TIP_ROW = 8;      // pitch of a stat row
const TIP_MAXW = 168;   // wraps nothing; long lines are authored to fit
const TIP_LABEL = '#8c919a';
const TIP_DIM = '#b4b8bf';
let tipNow = null;      // this frame's descriptor, resolved once in render()

// seconds, to two places, without a trailing shout of precision
function tipSec(s) { return (Math.round(s * 100) / 100).toFixed(2) + 'S'; }
// A descriptor is { title, tcol, kind, rows: [[label, value, col]],
// sum: [value, col] (a total under a rule, optional), notes: [[text, col]],
// icon, plate, rim }. Everything below builds one of
// these and drawTooltip is the only thing that knows how to paint it.
function tipBase(type, title, kind) {
  const t = itemTier(type);
  const tp = tierPlate(type, true);
  return {
    title, tcol: t >= 0 ? TOOL_TIERS[t].ink : '#f4f7ff',
    kind, rows: [], notes: [],
    icon: ITEMS[type] && SPRITES[ITEMS[type].icon], plate: tp.plate, rim: tp.rim, type,
  };
}
const TIP_PATH = { line: 'STRAIGHT', orbit: 'ORBIT', boomer: 'BOOMERANG', lob: 'ARCS DOWN', curve: 'CURVES' };
// KNOCKBACK is the one bit number that is a multiple rather than a quantity
// (see BITS, js/sim/tools.js), so it prints as one - 'x1' is the ordinary shove
const TIP_KB = (kb) => 'x' + (Math.round((kb === undefined ? 1 : kb) * 10) / 10);
// A TOOL: the numbers that are the whole of what a tool is, and then what is
// loaded in it - which is the other half of "what will this do". The list
// reads as the row does, shots then modifiers, each bit's weight beside it,
// because the weight is what the draw pays for (toolDrawMul).
function tipTool(cell) {
  const id = toolIdOf(cell.type), T = TOOLS[id];
  const d = tipBase(cell.type, T.name, TOOL_TIERS[T.tier].name + ' TOOL');
  const plan = toolPlan(cell);
  const slow = toolDrawMul(cell) > 1;
  d.rows.push(['RATE OF FIRE', tipSec(T.rof * TOOL_ROF_STEP), '#f4f7ff']);
  d.rows.push(['BIT SLOTS', bitsIn(cell) + '/' + T.cap, '#f4f7ff']);
  d.rows.push(['TENSILE', String(plan.tensile), '#f2cc6a']);
  d.rows.push(['LOADED WEIGHT', String(plan.load), '#f4f7ff']);
  d.rows.push(['FULL DRAW', tipSec(kitOf(player).bowCharge * toolDrawMul(cell) / asMul(player)), slow ? '#ffd95c' : '#f4f7ff']);
  d.rows.push(['SHOTS A PRESS', String(plan.shots.length), '#8fe08a']);
  for (let i = 0; i < cell.bits.length; i++) {
    const b = cell.bits[i] && BITS[cell.bits[i]];
    if (b) d.notes.push(['  ' + b.name + ' ' + b.weight, b.col]);
  }
  if (plan.shots[0].base) d.notes.push(['NO SHOT LOADED - FIRES A PLAIN ARROW', TIP_DIM]);
  if (slow) d.notes.push(['HEAVY - IT TAKES LONGER TO DRAW', '#ffd95c']);
  return d;
}
// A BIT: every property the shot carries, because that is exactly the list a
// player is choosing between when they drag one into a cell.
function tipBit(id) {
  const b = BITS[id];
  const d = tipBase(bitType(id), b.name,
    TOOL_TIERS[b.tier].name + (b.proj ? ' BIT' : ' MODIFIER'));
  if (b.proj) {
    d.rows.push(['DAMAGE', String(b.dmg), '#e0637a']);
    d.rows.push(['WEIGHT', String(b.weight), '#f2cc6a']);
    d.rows.push(['SPEED', String(b.speed), '#f4f7ff']);
    d.rows.push(['KNOCKBACK', TIP_KB(b.kb), '#cfe0f2']);
    d.rows.push(['LIFESPAN', tipSec(b.life), '#f4f7ff']);
    d.rows.push(['FLIGHT', TIP_PATH[b.path] || b.path, b.col]);
    // the flags, only when they are true: an absent line is the default, and
    // four rows of NO would drown the three that matter
    if (b.solid === false) d.notes.push(['PASSES THROUGH WALLS', '#8fd8ff']);
    if (b.ff) d.notes.push(['HITS YOUR OWN TEAM TOO', '#e0637a']);
    if (b.lit) d.notes.push(['LIGHTS THE GROUND IT PASSES', '#ffd95c']);
    // what it does where it LANDS, when that is more than damage (BIT_IMPACT)
    if (b.impact === 'warp') d.notes.push(['LAND IT ON ANYTHING AND YOU ARE THERE', '#c58fff']);
    if (b.impact === 'chop') d.notes.push(['CHOPS EVERY TREE IT LANDS AMONG', '#8fe08a']);
  } else {
    // a fitting weighs what a shot does, and the draw pays for both
    d.rows.push(['WEIGHT', String(b.weight), '#f2cc6a']);
    // A fire modifier is chosen on two numbers - how long the burn runs and
    // how hard it bites - so it prints them, the same reason the projectile
    // rows above exist. Read out of the envelope itself rather than written
    // twice, so a retuned FLAME can never disagree with its own tooltip.
    const m = bitMods(id);
    if (m.burn > 0) {
      d.rows.push(['BURNS FOR', tipSec(m.burn), '#ff9440']);
      d.rows.push(['BURN RATE', m.burnDps + '/S', '#ff9440']);
      if (m.cinder > 0) d.rows.push(['EMBER RING', String(m.cinder), '#ffb347']);
    }
    // the two rules a modifier lives by, and neither is guessable from the art
    d.notes.push(['CHANGES EVERY SHOT YOUR WEAPON FIRES', '#8fd8ff']);
    d.notes.push(['A SECOND ONE COMPOUNDS WITH THIS', '#8fe08a']);
    if (m.type === 'fire') d.notes.push(['FIRE KEEPS BURNING WHATEVER IT LANDS ON', '#ff9440']);
  }
  d.notes.push([b.blurb, TIP_DIM]);
  return d;
}
// the burrow's pack cell (js/sim/tunnel.js): the dig, the wait after a ride, and how
// long a rival's boots take to cave it - the numbers the hole itself shows
function tipTunnel() {
  const n = bagCount(player, 'tunnel');
  const d = tipBase('tunnel', 'BURROW', 'TUNNEL');
  d.tcol = RES_COLORS.tunnel;
  d.rows.push(['DIG', tipSec(TUN_DIG), '#f4f7ff']);
  d.rows.push(['COOLDOWN', tipSec(TUN_CD), '#f4f7ff']);
  d.rows.push(['CAVES IN', tipSec(TUN_BREAK), '#e0637a']);
  d.rows.push(['CARRIED', String(n), '#f4f7ff']);
  if (player.digT > 0) d.rows.push(['OPENS IN', tipSec(player.digT), '#f2cc6a']);
  return d;
}
// the gold plate: the exact figure, since the plate itself is rounded
// a chip on the team rail: the name in the player's tint, the class under it,
// the level - and, while the body is down, the seconds until the bird sets it
// back (the scoreboard's own countdown), or OUT for one that is not coming back
function tipRail(c) {
  const p = c.p, cls = CLASSES[p.cls];
  const d = { title: p.name, tcol: playerTint(p), kind: cls.name, icon: classIcon12(p.cls, false),
    plate: BAG_WELL, rim: TEAMS[skin(p.team)].mark, rows: [['LEVEL', String(p.level), '#cfe0ff']], notes: [] };
  if (p.dead) d.rows.push(['RESPAWN', p.eliminated || p.respawnT <= 0 ? 'OUT' : Math.ceil(p.respawnT) + ' S', '#8f9cc4']);
  return d;
}
function tipGold() {
  return { title: 'GOLD', tcol: '#f5c542', kind: 'PURSE', icon: SPRITES.itemGold, plate: BAG_WELL, rim: '#3c4048',
    rows: [['CARRIED', String(inv.gold), '#f5c542']], notes: [] };
}
// anything else a bag cell can hold
function tipStack(s) {
  const r = CARD_TYPE_RARITY[s.type];
  if (r) {
    const d = tipBase(s.type, r.toUpperCase() + ' CARD', 'UNOPENED');
    d.tcol = RES_COLORS[s.type];
    d.rows.push(['CARRIED', String(s.n), '#f4f7ff']);
    return d;
  }
  if (ITEMS[s.type] && ITEMS[s.type].heal) {
    const heal = Math.round(ITEMS[s.type].heal * kitOf(player).foodMul);
    const d = tipBase(s.type, ITEMS[s.type].name || 'BERRIES', 'FOOD');
    d.tcol = RES_COLORS[s.type];
    d.rows.push(['HEALS', '+' + heal, '#8fe08a']);
    // the two halves of a meal, said the way an ability well says them: how
    // long you stand there eating it, and how long BOTH meals are away after
    d.rows.push(['EAT', tipSec(FOOD_EAT), '#f4f7ff']);
    d.rows.push(['COOLDOWN', tipSec(FOOD_CD), '#f4f7ff']);
    d.rows.push(['CARRIED', String(s.n), '#f4f7ff']);
    if (player.foodCd > 0) d.rows.push(['READY IN', tipSec(player.foodCd), '#e0637a']);
    d.notes.push(['A HIT BREAKS THE MEAL - CLICK OR ROLL TO CANCEL', TIP_DIM]);
    d.notes.push([s.type === 'berry' ? 'Q OR CLICK TO EAT' : 'F OR CLICK TO EAT', TIP_DIM]);
    return d;
  }
  if (isOre(s.type)) {
    // an ore: its name in its rock's colour, what kind of rock it came out of
    const K = ROCK_KINDS[ITEMS[s.type].ore];
    const d = tipBase(s.type, ITEMS[s.type].name, K.key.toUpperCase() + ' ORE');
    d.tcol = RES_COLORS[s.type];
    d.rows.push(['CARRIED', String(s.n), '#f4f7ff']);
    d.rows.push(['FROM', K.name, '#f4f7ff']);
    return d;
  }
  const d = tipBase(s.type, s.type.toUpperCase(), 'ITEM');
  d.rows.push(['CARRIED', String(s.n), '#f4f7ff']);
  return d;
}
// whatever is in a bag cell, a slot, a bit cell or on the cursor
function tipCell(s) {
  if (!s) return null;
  if (isToolCell(s)) return tipTool(s);
  const b = bitIdOf(s.type);
  if (b) return tipBit(b);
  return tipStack(s);
}
// a class ability well - the strip's in play (cls omitted: the local player's
// class, live cooldown, the cast hint), or the lobby's stage (cls given:
// the previewed class, before it is ever locked, with nothing castable yet)
// (i, cls, k): the card for key i's option k on class cls - in play (cls null)
// the option the local player carries there
function tipClassAb(i, cls, k) {
  const c = cls == null ? player.cls : cls;
  const opt = cls == null ? (player.abPick[i] | 0) : (k | 0);
  const ab = abOptions(c, i)[opt] || CLASS_AB[c][i];
  const d = { title: ab.name, tcol: '#f4f7ff', kind: CLASSES[c].name + ' ABILITY',
    rows: [], notes: [], icon: classAbIcon(c, i, opt), plate: BAG_WELL, rim: '#3c4048' };
  // in play the cooldown is the LIVE one, level cuts and all; on the lobby
  // there is no slot to have levelled anything yet, so it is the base
  d.rows.push(['COOLDOWN', tipSec(cls == null ? abCdOf(player, i) : ab.cd), '#f4f7ff']);
  d.rows.push(['CAST', tipSec(ab.cast), '#f4f7ff']);
  if (cls == null) {
    const lock = !abUnlocked(player, i);
    d.rows.push(['LEVEL', lock ? 'LOCKED' : player.abLv[i] + '/' + AB_LV_MAX,
      lock ? '#e0637a' : '#f4f7ff']);
    if (player.abLv[i] < AB_LV_MAX) d.rows.push([lock ? 'UNLOCK' : 'NEXT LEVEL', '1 SKILL PT',
      player.skillPts > 0 ? '#f2cc6a' : '#e0637a']);
    const req = ab.lvReq && ab.lvReq[player.abLv[i]]; // an ultimate's next point waits for the hero (abLvCanBuy)
    if (req && player.level < req) d.rows.push(['HERO LEVEL', String(req), '#e0637a']);
    if (player.abCd[i] > 0) d.rows.push(['READY IN', tipSec(player.abCd[i]), '#e0637a']);
  }
  for (const s of ab.blurb.split('. ')) d.notes.push([s.replace(/\.$/, ''), TIP_DIM]);
  if (cls == null) d.notes.push([abUnlocked(player, i)
    ? 'PRESS ' + (i + 1) + ' OR CLICK TO CAST'
    : 'SPEND A SKILL POINT TO UNLOCK IT', TIP_DIM]);
  return d;
}
// A PIECE on the build list: the numbers a piece is chosen on - the price in
// the row's own pair of inks, then what it stands up to, how long it takes,
// and whatever that type alone has - and under them what it is FOR, one line
// a sentence (STRUCTS[type].blurb). Always the first tier: the one the list lays.
function tipStruct(type) {
  const S = STRUCTS[type], t = S.tiers[0];
  const d = { title: S.name, tcol: '#f4f7ff', kind: 'BUILDING', rows: [], notes: [],
    icon: buildIcon(type), plate: '#1d1f24', rim: '#3c4048' };
  const c0 = buildCost(type, player); // what the NEXT one costs: an income building's ramp
  d.rows.push(['COST', (c0.gold || 0) + ' GOLD', canAfford(c0) ? RES_COLORS.gold : '#e0637a']);
  d.rows.push(['HEALTH', String(t.hp), '#f4f7ff']);
  d.rows.push(['BUILDS IN', tipSec(t.buildT), '#f4f7ff']);
  if (t.dmg) {
    d.rows.push(['DAMAGE', String(t.dmg), '#e0637a']);
    d.rows.push(['FIRES EVERY', tipSec(t.rate), '#f4f7ff']);
    d.rows.push(['RANGE', String(t.range), '#f4f7ff']);
    if (t.acc) d.rows.push(['ACCURACY', Math.round(t.acc * 100) + '%', '#f4f7ff']);
  }
  if (t.pay) d.rows.push(['GOLD A MINUTE', String(Math.round(t.pay * 60 / t.period)), RES_COLORS.gold]);
  if (t.bots) {
    d.rows.push(['BOTS', String(t.bots), '#f4f7ff']);
    d.rows.push(['BOT HEALTH', String(t.botHp), '#f4f7ff']);
  }
  if (S.water) d.rows.push(['HOLDS', NET_CAP + ' FISH', '#7ac0e8']);
  for (const s of S.blurb.split('. ')) d.notes.push([s.replace(/\.$/, ''), TIP_DIM]);
  return d;
}
// What the pointer is on, asked once per frame. The order mirrors the
// mousedown handler exactly: the build list's rows, the character panel's
// items, then the shelf, then the weapon strip, then the backpack - so the
// panel and the click always agree.
function tipAt(mx, my) {
  if (window.DBG.hideUI || !mouse.inside) return null;
  if (state.mode === 'title') {
    const m = state.menu;
    if (m.screen === 'wiki' && m.wikiT >= 1) {
      const h = wikiHit(mx, my);
      // an ITEMS row is the shop's own item card; a CLASSES row is the lobby's
      // own ability card, read at the base cooldown since nobody has levelled
      return !h ? null : h.kind === 'row' ? tipItem(h.id) : h.kind === 'ab' ? tipClassAb(h.i, h.cls, h.k) : null;
    }
    // the hero pop-up's four ability wells raise the same card
    if (m.screen === 'hero' && m.popT >= 1) { const h = heroScreenHit(); return h && h.ab != null ? tipClassAb(h.ab, player.cls, player.abPick[h.ab]) : null; }
    return null;
  }
  if (state.mode !== 'play') return null;
  // the counter is asked first, so a drag held over its sell well is priced
  // rather than merely described; over the bare slab it answers nothing and
  // the carried item below takes over
  const sp = shopHit(mx, my);
  const stip = sp && tipShop(sp);
  if (stip) return stip;
  if (state.drag) {
    // what is in hand, and the one thing shift is for: spending the click on a
    // well without putting this down
    const d = tipCell(state.drag.cell);
    if (d) d.notes.push(['SHIFT CLICK KEEPS THIS IN HAND', TIP_DIM]);
    return d;
  }
  const bl = buildListHit(mx, my);
  if (bl >= 0) return tipStruct(BUILD_ORDER[bl]);
  const ci = charItemHit(mx, my);
  if (ci >= 0 && player.items[ci]) return tipItem(player.items[ci]);
  const rc = railHit(mx, my);
  if (rc) return tipRail(rc);
  const ch = cheatHit(mx, my);
  if (ch && ch.kind === 'cell') return tipCheat(ch.i);
  const fh = shelfHit(mx, my);
  if (fh) {
    // the class weapon, or an item slot: what is there, or nothing for an empty slot
    if (fh.kind === 'tool') return shelfCell() ? tipCell(shelfCell()) : null;
    const id = player.items[fh.i];
    return id ? tipItem(id) : null;
  }
  const abb = abBuyHit(mx, my);
  if (abb >= 0) return tipClassAb(abb); // the buy plate describes the ability it upgrades
  const sh = stripHit(mx, my);
  if (sh && sh.kind === 'ab') return tipClassAb(sh.i);
  if (sh && sh.kind === 'stat') return tipStat(sh.key); // the stat panel's breakdown (js/ui/statpanel.js)
  // a meal button describes the meal it eats - the bag cell's own food
  // descriptor, so the two surfaces can never disagree about a berry
  if (sh && (sh.kind === 'fishPick' || sh.kind === 'fishPop' || (sh.kind === 'food' && FOOD_BTNS[sh.i].type === 'fish'))) return null; // the picker says it (drawFishPop)
  if (sh && sh.kind === 'food') {
    const type = FOOD_BTNS[sh.i].type;
    return tipStack({ type, n: bagCount(player, type) });
  }
  if (sh && sh.kind === 'frame') {
    const g = goldCellRect(), m = stripMouse(mx, my);
    if (m.x >= g.x && m.x < g.x + g.w && m.y >= g.y && m.y < g.y + g.h) return tipGold();
  }
  const bh = bagHit(mx, my);
  if (!bh) return null;
  if (bh.kind === 'cell') {
    const s = player.bag[bh.i];
    const d = s && s.type === 'tunnel' ? tipTunnel() : tipCell(s);
    // ...and while the counter is up, what it is worth over there
    if (d && shopOpen()) {
      d.rows.push(['SELLS FOR', sellValue(s) + ' GOLD', RES_COLORS.gold]);
      d.notes.push(['DRAG IT TO THE COUNTER TO SELL', TIP_DIM]);
    }
    return d;
  }
  return null;
}
// resolved once a frame, before anything that has to lay out around it
function tipResolve() { tipNow = tipAt(mouse.x, mouse.y); }
function tipSize(d) {
  const iw = d.icon ? d.icon.width + 3 : 0;
  let w = iw + pixelTextWidth(d.title);
  if (d.kind) w = Math.max(w, iw + pixelTextWidth(d.kind));
  for (const [l, v] of d.rows) w = Math.max(w, pixelTextWidth(l) + 10 + pixelTextWidth(v));
  for (const [t] of d.notes || []) w = Math.max(w, pixelTextWidth(t));
  const head = d.icon ? Math.max(14, d.icon.height + 2) : 14;
  const h = TIP_PAD * 2 + head + d.rows.length * TIP_ROW + (d.notes || []).length * TIP_ROW + (d.sum ? TIP_ROW + 3 : 0);
  return { w: Math.min(TIP_MAXW, w) + TIP_PAD * 2, h };
}
// WHERE the panel goes, the one answer for both modes. FIXED is the corner it
// was born in; FOLLOWING rides the pointer, and the whole of that is clearing
// the hand: TIP_GAP is measured sideways because every cursor glyph and the
// 18px drag ghost are wider below the hotspot than beside it, so a panel held
// TIP_GAP px to one side is clear of the lot without being flung away from the
// numbers it is there to put under the eye. It flips to the pointer's other
// side at the right edge and clamps into the view, so a corner still reads.
const TIP_GAP = 11;   // clear air between pointer and panel, sideways
const TIP_EDGE = 4;   // closest the panel comes to any view edge
function tipPos(w, h) {
  if (!settings.tipFollow) return { x: TIP_EDGE, y: VIEW_H - 8 - h };
  const mx = Math.round(mouse.x), my = Math.round(mouse.y);
  let x = mx + TIP_GAP;
  if (x + w > VIEW_W - TIP_EDGE) x = mx - TIP_GAP - w;
  // the head row sits level with the pointer, so the name is what the eye lands
  // on and the rows read downward from it
  const y = my - TIP_PAD;
  const clamp = (v, hi) => Math.max(TIP_EDGE, Math.min(v, Math.max(TIP_EDGE, hi)));
  return { x: clamp(x, VIEW_W - TIP_EDGE - w), y: clamp(y, VIEW_H - TIP_EDGE - h) };
}

// The panel itself: an item's own tier plate behind the icon, the name in its
// tier ink, then label/value rows with a dotted leader between them - the
// PLAYER panel's ledger, which is where that pattern already lives.
function drawTooltip() {
  const d = tipNow;
  if (!d) return;
  const { w, h } = tipSize(d);
  const { x, y } = tipPos(w, h);
  ctx.fillStyle = 'rgba(4,6,18,0.55)';
  ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = BAG_BG;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = d.rim || '#3c4048';
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  let cy = y + TIP_PAD;
  let tx = x + TIP_PAD;
  if (d.icon) {
    // the icon on its own tier plate, so the panel opens with the same colour
    // the well the pointer is over is wearing
    const iw = d.icon.width, ih = d.icon.height;
    ctx.fillStyle = d.plate || BAG_WELL;
    ctx.fillRect(tx - 1, cy - 1, iw + 2, ih + 2);
    modPlate(d.type, { x: tx - 1, y: cy - 1, w: iw + 2, h: ih + 2 }, cy - 1);
    ctx.drawImage(d.icon, tx, cy);
    tx += iw + 3;
  }
  drawPixelTextShadow(ctx, d.title, tx, cy, d.tcol, '#121418');
  if (d.kind) drawPixelTextShadow(ctx, d.kind, tx, cy + 7, TIP_LABEL, '#121418');
  cy += d.icon ? Math.max(14, d.icon.height + 2) : 14;
  for (const [label, value, col] of d.rows) {
    const lw = pixelTextWidth(label), vw = pixelTextWidth(value);
    drawPixelTextShadow(ctx, label, x + TIP_PAD, cy, TIP_LABEL, '#121418');
    // the dotted leader ties the pair across the gap, exactly as the PLAYER
    // panel's stat rows do - a bare gap reads as two unrelated columns
    ctx.fillStyle = '#33363d';
    for (let px = x + TIP_PAD + lw + 3; px < x + w - TIP_PAD - vw - 2; px += 2) ctx.fillRect(px, cy + 4, 1, 1);
    drawPixelTextShadow(ctx, value, x + w - TIP_PAD - vw, cy, col || '#f4f7ff', '#121418');
    cy += TIP_ROW;
  }
  if (d.sum) { // a total under a rule (the stat panel's breakdown, tipStat)
    ctx.fillStyle = '#33363d'; ctx.fillRect(x + TIP_PAD, cy, w - TIP_PAD * 2, 1);
    cy += 3;
    drawPixelTextShadow(ctx, d.sum[0], x + w - TIP_PAD - pixelTextWidth(d.sum[0]), cy, d.sum[1], '#121418');
    cy += TIP_ROW;
  }
  for (const [text, col] of d.notes || []) {
    drawPixelTextShadow(ctx, text, x + TIP_PAD, cy, col || TIP_DIM, '#121418');
    cy += TIP_ROW;
  }
}
