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
const TIP_LABEL = '#7a8bb8';
const TIP_DIM = '#9fb6d8';
let tipNow = null;      // this frame's descriptor, resolved once in render()

// seconds, to two places, without a trailing shout of precision
function tipSec(s) { return (Math.round(s * 100) / 100).toFixed(2) + 'S'; }
// A descriptor is { title, tcol, kind, rows: [[label, value, col]],
// notes: [[text, col]], icon, plate, rim }. Everything below builds one of
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
// (see BITS, js/tools.js), so it prints as one - 'x1' is the ordinary shove
const TIP_KB = (kb) => 'x' + (Math.round((kb === undefined ? 1 : kb) * 10) / 10);
// A TOOL: the numbers that are the whole of what a tool is, and then what is
// loaded in it - which is the other half of "what will this do". The list is
// the FIRING ORDER, cell 1 first, with each bit's weight beside it and the
// line where the press runs out of strength marked, because that order and
// that cut are now the entire build.
function tipTool(cell) {
  const id = toolIdOf(cell.type), T = TOOLS[id];
  const d = tipBase(cell.type, T.name, TOOL_TIERS[T.tier].name + ' TOOL');
  const plan = toolPlan(cell);
  const over = plan.load > T.tensile;
  d.rows.push(['RATE OF FIRE', tipSec(T.rof * TOOL_ROF_STEP), '#f4f7ff']);
  d.rows.push(['BIT SLOTS', bitsIn(cell) + '/' + T.cap, '#f4f7ff']);
  d.rows.push(['TENSILE', String(T.tensile), '#f2cc6a']);
  d.rows.push(['LOADED WEIGHT', String(plan.load), over ? '#e0637a' : '#f4f7ff']);
  d.rows.push(['SHOTS A PRESS', String(plan.shots.length), plan.shots.length ? '#8fe08a' : '#e0637a']);
  const lead = plan.shots.length ? plan.shots[0].i : -1;
  for (let i = 0; i < cell.bits.length; i++) {
    const b = cell.bits[i] && BITS[cell.bits[i]];
    if (!b) continue;
    const dead = plan.cut >= 0 && i >= plan.cut;
    d.notes.push([(i === lead ? '> ' : '  ') + (i + 1) + ' ' + b.name + ' ' + b.weight +
      (dead ? ' - NO STRENGTH LEFT' : ''),
      dead ? '#e0637a' : i === lead ? '#f2cc6a' : b.col]);
  }
  if (!bitsIn(cell)) d.notes.push(['  NO BITS LOADED', TIP_DIM]);
  else if (over) d.notes.push(['IT CARRIES MORE THAN IT CAN SWING', '#ffd95c']);
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
    // a fitting costs the press exactly what a shot does: that is the whole
    // reason where you put one is a decision and not a formality
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
    d.notes.push(['CHANGES ONLY THE SHOTS AFTER IT', '#8fd8ff']);
    d.notes.push(['A SECOND ONE COMPOUNDS WITH THIS', '#8fe08a']);
    if (m.type === 'fire') d.notes.push(['FIRE KEEPS BURNING WHATEVER IT LANDS ON', '#ff9440']);
  }
  d.notes.push([b.blurb, TIP_DIM]);
  return d;
}
// the card button: every rarity in hand on its own row, in its own ink, so
// what the next draw could be is read here and nowhere else
function tipCards() {
  const d = { title: 'CARDS', tcol: '#f4f7ff', kind: 'UNOPENED', icon: cardFanCv, plate: BAG_WELL, rim: '#35426e', rows: [], notes: [] };
  for (const r of CARD_RARITIES) {
    const n = bagCount(player, cardKey(r));
    if (n > 0) d.rows.push([r.toUpperCase(), String(n), RES_COLORS[cardKey(r)]]);
  }
  if (!d.rows.length) d.rows.push(['NONE', '', TIP_DIM]);
  d.notes.push(['ONE AT RANDOM, ITS BUFF AT RANDOM', TIP_DIM]);
  return d;
}
// the gold plate: the exact figure, since the plate itself is rounded
// a chip on the team rail: the name in the player's tint, the class under it,
// the level - and, while the body is down, the seconds until the bird sets it
// back (the scoreboard's own countdown), or OUT for one that is not coming back
function tipRail(c) {
  const p = c.p, cls = CLASSES[p.cls];
  const d = { title: p.name, tcol: playerTint(p), kind: cls.name, icon: classIcon12(p.cls, p === player),
    plate: BAG_WELL, rim: TEAMS[skin(p.team)].mark, rows: [['LEVEL', String(p.level), '#cfe0ff']], notes: [] };
  if (p.dead) d.rows.push(['RESPAWN', p.eliminated || p.respawnT <= 0 ? 'OUT' : Math.ceil(p.respawnT) + ' S', '#8f9cc4']);
  return d;
}
function tipGold() {
  return { title: 'GOLD', tcol: '#f5c542', kind: 'PURSE', icon: SPRITES.itemGold, plate: BAG_WELL, rim: '#35426e',
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
    const d = tipBase(s.type, s.type === 'berry' ? 'BERRIES' : 'FISH', 'FOOD');
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
  const d = tipBase(s.type, s.type.toUpperCase(), 'ITEM');
  d.rows.push(['CARRIED', String(s.n), '#f4f7ff']);
  return d;
}
// What a click on this well will DO, said where the item actually SITS - a
// tool means "take it in hand" in the grid and "stow it" in the well, so the
// note is pushed on by tipAt's branches rather than by tipCell, which does
// not know where it is. Same phrasing as the food rows' own CLICK TO EAT.
function tipSend(d, txt) {
  if (d) d.notes.push(['CLICK TO ' + txt, TIP_DIM]);
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
// the two HUD rows that are not items: a gear piece and an ability
function tipGear(i) {
  const g = GEAR[i][player.gear[i]], lv = player.gearLv[i], cost = gearCost(player, i);
  const d = { title: g.name, tcol: GEAR_MATS[lv - 1], kind: GEAR_SLOTS[i], rows: [], notes: [],
    icon: SPRITES.gearIcons[i][player.gear[i]][lv - 1], plate: BAG_WELL, rim: '#35426e' };
  d.rows.push(['LEVEL', lv + '/' + GEAR_LV_MAX, GEAR_MATS[lv - 1]]);
  if (cost) d.rows.push(['NEXT LEVEL', cost.gold + ' GOLD',
    player.inv.gold >= cost.gold ? '#f2cc6a' : '#e0637a']);
  d.notes.push([g.blurb, TIP_DIM]);
  d.notes.push([cost ? 'CLICK TO BUY THE NEXT LEVEL' : 'FULLY UPGRADED', TIP_DIM]);
  return d;
}
// a class ability well - the strip's in play (cls omitted: the local player's
// class, live cooldown, the cast hint), or class select's stage (cls given:
// the previewed class, before it is ever locked, with nothing castable yet)
function tipClassAb(i, cls) {
  const c = cls == null ? player.cls : cls;
  const ab = CLASS_AB[c][i];
  const d = { title: ab.name, tcol: '#f4f7ff', kind: CLASSES[c].name + ' ABILITY',
    rows: [], notes: [], icon: classAbIcon(c, i), plate: BAG_WELL, rim: '#35426e' };
  // in play the cooldown is the LIVE one, level cuts and all; on class select
  // there is no slot to have levelled anything yet, so it is the base
  d.rows.push(['COOLDOWN', tipSec(cls == null ? abCdOf(player, i) : ab.cd), '#f4f7ff']);
  d.rows.push(['CAST', tipSec(ab.cast), '#f4f7ff']);
  if (cls == null) {
    const lock = !abUnlocked(player, i);
    d.rows.push(['LEVEL', lock ? 'LOCKED' : player.abLv[i] + '/' + AB_LV_MAX,
      lock ? '#e0637a' : '#f4f7ff']);
    if (player.abLv[i] < AB_LV_MAX) d.rows.push([lock ? 'UNLOCK' : 'NEXT LEVEL', '1 SKILL PT',
      player.skillPts > 0 ? '#f2cc6a' : '#e0637a']);
    if (player.abCd[i] > 0) d.rows.push(['READY IN', tipSec(player.abCd[i]), '#e0637a']);
  }
  for (const s of ab.blurb.split('. ')) d.notes.push([s.replace(/\.$/, ''), TIP_DIM]);
  if (cls == null) d.notes.push([abUnlocked(player, i)
    ? 'PRESS ' + (i + 1) + ' OR CLICK TO CAST'
    : 'SPEND A SKILL POINT TO UNLOCK IT', TIP_DIM]);
  return d;
}
// A KIND on the wiki's ARSENAL page - the one tooltip that is not about
// something you are holding, so it describes the kind itself and ends on the
// one thing the page knows about you: whether you have ever held one.
function tipKind(id) {
  const cell = toolIdOf(id) ? makeTool(toolIdOf(id)) : null;
  const d = cell ? tipTool(cell) : tipBit(bitIdOf(id));
  // A wiki row describes the KIND, not a tool somebody is holding, so the
  // "what is loaded in it" half goes: no bit list, and the player count is the
  // capacity rather than 0-out-of-capacity.
  d.notes.length = 0;
  if (cell) {
    d.rows.length = 3;
    d.rows[1] = ['BIT SLOTS', String(TOOLS[toolIdOf(id)].cap), '#f4f7ff'];
  }
  d.notes.push([PROFILE.techSeen(id) ? 'YOU HAVE HELD ONE OF THESE'
    : 'NEVER HELD ONE', PROFILE.techSeen(id) ? '#8fd8ff' : TIP_DIM]);
  return d;
}

// What the pointer is on, asked once per frame. The order mirrors the
// mousedown handler exactly: gear, then the shelf, then the weapon strip,
// then the backpack - so the panel and the click always agree.
function tipAt(mx, my) {
  if (window.DBG.hideUI || !mouse.inside) return null;
  if (state.mode === 'title') {
    const m = state.menu;
    if (m.screen === 'wiki' && m.wikiT >= 1) {
      const h = wikiHit(mx, my);
      // an ARSENAL row describes its kind; a CLASSES row is class select's
      // own ability card, read at the base cooldown since nobody has levelled
      return !h ? null : h.kind === 'row' ? tipKind(h.id) : h.kind === 'ab' ? tipClassAb(h.i, h.cls) : null;
    }
    // the stage's ability wells on class select: the strip's own tooltip,
    // readable before the class is ever locked
    if (m.screen === 'select' && m.screenT >= 1 && m.gearT <= 0) {
      const i = selectAbilHit(mx, my);
      return i >= 0 ? tipClassAb(i, m.csel) : null;
    }
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
  const gi = gearHit(mx, my);
  if (gi >= 0) return tipGear(gi);
  const rc = railHit(mx, my);
  if (rc) return tipRail(rc);
  const fh = shelfHit(mx, my);
  if (fh) {
    const cell = shelfCell();
    if (fh.kind === 'tool') {
      if (cell) return tipSend(tipCell(cell), 'STOW IT IN THE PACK');
      return { title: 'EMPTY WEAPON SLOT', tcol: TIP_DIM, kind: 'WEAPON', rows: [], plate: BAG_WELL, rim: '#35426e',
        notes: [['DRAG A TOOL HERE FROM THE PACK', TIP_DIM]] };
    }
    const id = cell.bits[fh.i];
    if (id) return tipSend(tipBit(id), 'STOW IT IN THE PACK');
    const T = TOOLS[toolIdOf(cell.type)];
    const d = tipBase(cell.type, 'EMPTY BIT CELL', TOOL_TIERS[T.tier].name + ' TOOL');
    d.icon = null; d.tcol = TIP_DIM;
    d.notes.push(['A FOUND BIT LANDS HERE ON ITS OWN', TIP_DIM]);
    d.notes.push(['THIS PRESS SPENDS ' + toolPlan(cell).used + ' OF ' + T.tensile, '#f2cc6a']);
    return d;
  }
  const abb = abBuyHit(mx, my);
  if (abb >= 0) return tipClassAb(abb); // the buy plate describes the ability it upgrades
  const sh = stripHit(mx, my);
  if (sh && sh.kind === 'ab') return tipClassAb(sh.i);
  // a meal button describes the meal it eats - the bag cell's own food
  // descriptor, so the two surfaces can never disagree about a berry
  if (sh && sh.kind === 'food') {
    const type = FOOD_BTNS[sh.i].type;
    if (type === 'card') return tipCards();
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
    const d = tipCell(s);
    if (d && isToolCell(s)) tipSend(d, 'TAKE IT IN HAND');
    else if (d && bitIdOf(s.type) && heldTool(player)) tipSend(d, 'LOAD IT IN THE WEAPON');
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
  const h = TIP_PAD * 2 + head + d.rows.length * TIP_ROW + (d.notes || []).length * TIP_ROW;
  return { w: Math.min(TIP_MAXW, w) + TIP_PAD * 2, h };
}
// WHERE the panel goes, the one answer for both modes. FIXED is the corner it
// was born in; FOLLOWING rides the pointer, and the whole of that is clearing
// the hand: TIP_GAP is measured sideways because every cursor glyph and the
// 18px drag ghost are wider below the hotspot than beside it, so a panel held
// TIP_GAP px to one side is clear of the lot without being flung away from the
// numbers it is there to put under the eye. It flips to the pointer's other
// side at the right edge and clamps into the view, so a corner still reads.
//
// A FINGER keeps the corner whatever the setting says: a thumb is ON the well
// it is asking about, so a panel beside it is a panel under the hand. Same test
// drawCursor uses to keep an arrow out from under a thumb (js/draw/render.js).
const TIP_GAP = 11;   // clear air between pointer and panel, sideways
const TIP_EDGE = 4;   // closest the panel comes to any view edge
function tipPos(w, h) {
  if (!settings.tipFollow || mouse.src === 'touch') return { x: TIP_EDGE, y: VIEW_H - 8 - h };
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
  ctx.fillStyle = d.rim || '#35426e';
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  let cy = y + TIP_PAD;
  let tx = x + TIP_PAD;
  if (d.icon) {
    // the icon on its own tier plate, so the panel opens with the same colour
    // the well the pointer is over is wearing
    const s = d.icon.width;
    ctx.fillStyle = d.plate || BAG_WELL;
    ctx.fillRect(tx - 1, cy - 1, s + 2, s + 2);
    modPlate(d.type, { x: tx - 1, y: cy - 1, w: s + 2, h: s + 2 }, cy - 1);
    ctx.drawImage(d.icon, tx, cy);
    tx += s + 3;
  }
  drawPixelTextShadow(ctx, d.title, tx, cy, d.tcol, '#0a0e23');
  if (d.kind) drawPixelTextShadow(ctx, d.kind, tx, cy + 7, TIP_LABEL, '#0a0e23');
  cy += d.icon ? Math.max(14, d.icon.height + 2) : 14;
  for (const [label, value, col] of d.rows) {
    const lw = pixelTextWidth(label), vw = pixelTextWidth(value);
    drawPixelTextShadow(ctx, label, x + TIP_PAD, cy, TIP_LABEL, '#0a0e23');
    // the dotted leader ties the pair across the gap, exactly as the PLAYER
    // panel's stat rows do - a bare gap reads as two unrelated columns
    ctx.fillStyle = '#2c3560';
    for (let px = x + TIP_PAD + lw + 3; px < x + w - TIP_PAD - vw - 2; px += 2) ctx.fillRect(px, cy + 4, 1, 1);
    drawPixelTextShadow(ctx, value, x + w - TIP_PAD - vw, cy, col || '#f4f7ff', '#0a0e23');
    cy += TIP_ROW;
  }
  for (const [text, col] of d.notes || []) {
    drawPixelTextShadow(ctx, text, x + TIP_PAD, cy, col || TIP_DIM, '#0a0e23');
    cy += TIP_ROW;
  }
}
