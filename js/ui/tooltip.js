'use strict';
// The hover tooltip: tipAt resolves what the pointer is on into rows, tipPos
// places the panel, drawTooltip prints it. The one place the HUD compares numbers.
// ------------------------------------------------------------ tooltips
// One panel that says what the pointer is on - and the one
// deliberate exception to show-don't-label in the HUD, recorded as such in
// CLAUDE.md's UI rule. The reason it earns the exception: an attack's speed,
// an item's stats and an ability's ranks are NUMBERS the player is being asked
// to compare, and there is no shape that compares numbers. The wells keep
// doing the at-a-glance job - rims, pips, wipes - and this is where
// you go when at-a-glance is not enough.
//
// WHERE it sits is the player's (settings.tipFollow - the TOOLTIP row on the
// ESC panel's GAME page), and tipPos is the only thing that answers:
//   FOLLOWING, the default: beside the pointer, so the numbers arrive where the
//     eye already is and reading one costs no glance across the screen.
//   FIXED: bottom left - the corner the pointer is furthest from while it hovers
//     the strip or an item, so the panel can never
//     cover the well beside the one being read, and nothing else lives there.
//
// EVERY tooltip comes from tipAt(), which asks the same hit-testers, in the
// same order, that the click handler does - so what the panel describes and
// what a click would do can never be two different things.
const TIP_PAD = 4;      // frame edge to content
const TIP_ROW = 8;      // pitch of a stat row
const TIP_MAXW = 168;   // a note past it wraps (tipFit); a row never does
const TIP_LABEL = '#8c919a';
const TIP_DIM = '#b4b8bf';
let tipNow = null;      // this frame's descriptor, resolved once in render()

// seconds, to two places, without a trailing shout of precision
function tipSec(s) { return (Math.round(s * 100) / 100).toFixed(2) + 'S'; }
// An ability's ranked numbers (its row's `rank` table, read in play by abRk,
// js/sim/abilities.js), said the League way: every rank's number in one row,
// 14/19/24/29/34, the rank the hero holds lit gold. Here is how each key of a
// `rank` table is said: [label, the number, its unit]. A new key a hero needs
// gets its line here.
const tipNum = (v) => String(Math.round(v * 100) / 100);
const tipCent = (v) => String(Math.round(v * 100));
const AB_RANK_STAT = {
  dmg: ['tip.dmg', tipNum, ''], shove: ['tip.shove', tipNum, ''], cut: ['tip.cut', tipCent, '%'],
  slow: ['tip.slow', (v) => tipCent(1 - v), '%'], slowT: ['tip.slowT', tipNum, 'S'], stun: ['tip.stun', tipNum, 'S'],
  root: ['tip.root', tipNum, 'S'], up: ['tip.up', tipNum, 'S'], t: ['tip.t', tipNum, 'S'],
  ward: ['tip.ward', tipCent, '%'], // MARIS's BRACE FOR COLD, LIGNUM's BARK SKIN
  chop: ['tip.chop', tipNum, ''], // LIGNUM's CHOP, its second blow (js/sim/lignum.js)
  armor: ['tip.armor', tipNum, ''], ten: ['tip.ten', tipCent, '%'], heal: ['tip.heal', tipCent, '%'],
  mark: ['tip.mark', tipNum, 'S'], shieldHp: ['tip.shieldHp', tipCent, '%'],
  burn: ['tip.burn', tipNum, ''], walk: ['tip.walk', (v) => tipCent(v - 1), '%'],
  markDmg: ['tip.markDmg', tipNum, ''], hp: ['tip.hp', tipNum, ''], wolfHp: ['tip.wolfHp', tipNum, ''], hps: ['tip.hps', tipNum, ''], shield: ['tip.shield', tipNum, ''], as: ['tip.as', tipCent, '%'], shot: ['tip.shot', tipNum, ''],
  share: ['tip.share', tipCent, '%'], // ARCUS's TWIN NOCK (js/sim/arcus.js)
};
const TIP_RANK_ON = '#f2cc6a';
// one ranked value as a row's value: plain text when it never changes, else
// the segments, each rank's number with the held rank (`lv`, 0 for none) lit
function tipRanks(v, lv, fmt, unit) {
  if (!Array.isArray(v)) return fmt(v) + unit;
  const seg = [];
  v.forEach((x, k) => {
    if (k) seg.push(['/', TIP_LABEL]);
    seg.push([fmt(x) + (k === v.length - 1 ? unit : ''), !lv ? '#f4f7ff' : k === lv - 1 ? TIP_RANK_ON : TIP_LABEL]);
  });
  return seg;
}
// a row's value is a string, or segments [[text, col], ...] (tipRanks)
function tipValW(v) { return Array.isArray(v) ? v.reduce((w, sg) => w + pixelTextWidth(sg[0]), 0) : pixelTextWidth(v); }
// A descriptor is { title, tcol, kind, rows: [[label, value, col]],
// sum: [value, col] (a total under a rule, optional), notes: [[text, col]],
// icon, plate, rim }. Everything below builds one of
// these and drawTooltip is the only thing that knows how to paint it.
// THE HERO'S BASIC ATTACK (CLASSES[c].attack, js/sim/attack.js): what one
// full-draw hit does, how often it comes, and how far it reaches - read off
// the same functions the sim swings by, so the card can never disagree
function tipAttack(p) {
  const A = attackOf(p), tp = cellPlate(true);
  const d = { title: A.name, tcol: '#f4f7ff', kind: tr('tip.basicAttack'), rows: [], notes: [],
    icon: SPRITES.weaponArt[A.art], plate: tp.plate, rim: tp.rim };
  d.rows.push([tr('tip.dmg'), String(attackDmg(p, 1, false)), '#e0637a']);
  d.rows.push([tr('tip.fullCharge'), tipSec(drawTime(p)), '#f4f7ff']);
  d.rows.push([tr('tip.betweenHits'), tipSec(attackCycle(p)), '#f4f7ff']);
  const reach = A.cut ? A.cut.reach : (() => { const f = shotFlight(A.shot, 1); return Math.round(f.spd * f.life); })();
  d.rows.push([tr('tip.reach'), String(reach), '#f4f7ff']);
  return d;
}
// the gold plate: the exact figure, since the plate itself is rounded
// a chip on the team rail: the name in the player's tint, the class under it,
// the level - and, while the body is down, the seconds until the bird sets it
// back (the scoreboard's own countdown), or OUT for one that is not coming back
function tipRail(c) {
  const p = c.p, cls = CLASSES[p.cls];
  const d = { title: p.name, tcol: playerTint(p), kind: cls.name, icon: classIcon12(p.cls, false),
    plate: BAG_WELL, rim: TEAMS[skin(p.team)].mark, rows: [[tr('tip.level'), String(p.level), '#cfe0ff']], notes: [] };
  if (p.dead) d.rows.push([tr('tip.respawn'), p.eliminated || p.respawnT <= 0 ? tr('board.out') : tr('board.wait', { s: Math.ceil(p.respawnT) }), '#8f9cc4']);
  return d;
}
function tipGold() {
  return { title: tr('tip.gold'), tcol: '#f5c542', kind: tr('tip.purse'), icon: SPRITES.itemGold, plate: BAG_WELL, rim: '#3c4048',
    rows: [[tr('tip.carried'), String(player.gold), '#f5c542']], notes: [] };
}
// an ability well - the strip's in play (cls omitted: the local player's
// hero, live cooldown, the cast hint), or the lobby's stage (cls given:
// the previewed hero, before it is ever locked, with nothing castable yet)
function tipClassAb(i, cls) {
  const c = cls == null ? player.cls : cls;
  const ab = CLASS_AB[c][i];
  const d = { title: ab.name, tcol: '#f4f7ff', kind: tr('tip.heroAbility', { hero: CLASSES[c].name }),
    rows: [], notes: [], icon: classAbIcon(c, i), plate: BAG_WELL, rim: '#3c4048' };
  // Read mid-fight, so the short card says only what decides a press: the
  // cooldown and the number a rank raises (a `rank` key given as a list), at
  // the rank you hold (rank 1 on a dark key or the lobby), and the row's one
  // line (`tip`). The DETAILS key held - or ABILITY DETAILS on ALWAYS (settings.tipFull)
  // - opens every rank's numbers on each row, the held rank lit gold, and the
  // hero level the next rank waits for. The pips on the well say the rank,
  // its sweep the wait.
  const full = settings.tipFull || keyHeld('details');
  const lv = cls == null ? player.abLv[i] : 0;
  const hm = cls == null ? hasteMul(player) : 1;
  const val = (v, fmt, unit) => (full ? tipRanks(v, lv, fmt, unit) : fmt(rankAt(v, lv)) + unit);
  const cds = Array.isArray(ab.cd) ? ab.cd.map((v) => v * hm) : ab.cd * hm;
  // (short, the cooldown takes the line under the name the long card gives the hero's name)
  if (full) d.rows.push([tr('tip.cooldown'), val(cds, tipNum, 'S'), '#f4f7ff']);
  else d.kind = tr('tip.cooldownIs', { s: val(cds, tipNum, 'S') });
  for (const k in ab.rank || {}) {
    const st = AB_RANK_STAT[k];
    if (st && Array.isArray(ab.rank[k])) d.rows.push([tr(st[0]), val(ab.rank[k], st[1], st[2]), '#f4f7ff']);
  }
  if (cls == null && full) {
    const need = abReqOf(ab, i)[player.abLv[i]]; // the next rank waits for the hero (abLvCanBuy)
    if (need && player.level < need) d.rows.push([tr('tip.heroLevel'), String(need), '#e0637a']);
  }
  d.notes.push([ab.tip || ab.blurb.split('. ')[0].replace(/\.$/, ''), TIP_DIM]);
  return d;
}
// What the pointer is on, asked once per frame. The order mirrors the
// mousedown handler exactly: the character panel's items, then the strip - so the
// panel and the click always agree.
function tipAt(mx, my) {
  if (window.DBG.hideUI || !mouse.inside) return null;
  if (state.mode === 'title') {
    const m = state.menu;
    if (m.screen === 'wiki' && m.wikiT >= 1) {
      const h = wikiHit(mx, my);
      // an ITEMS row is the shop's own item card; a CLASSES row is the lobby's
      // own ability card, read at the base cooldown since nobody has levelled
      return !h ? null : h.kind === 'row' ? tipItem(h.id) : h.kind === 'ab' ? tipClassAb(h.i, h.cls) : null;
    }
    // the hero pop-up's four ability wells raise the same card
    if (m.screen === 'hero' && m.popT >= 1) { const h = heroScreenHit(); return h && h.ab != null ? tipClassAb(h.ab, player.cls) : null; }
    if (m.screen === 'lobby' && m.screenT >= 1) return loadoutTip(lobbyLayout()); // the picks' wells and picker (js/ui/loadout.js)
    return null;
  }
  if (state.mode !== 'play') return null;
  // the counter is asked first
  const sp = shopHit(mx, my);
  const stip = sp && tipShop(sp);
  if (stip) return stip;
  const ci = charItemHit(mx, my);
  if (ci >= 0 && player.items[ci]) return tipItem(player.items[ci]);
  const rc = railHit(mx, my);
  if (rc) return tipRail(rc);
  const ch = cheatHit(mx, my);
  if (ch && ch.kind === 'cell') return tipCheat(ch.i);
  if (ch && ch.kind === 'hero') return tipCheatHero(ch.h);
  const abb = abBuyHit(mx, my);
  if (abb >= 0) return tipClassAb(abb); // the buy plate describes the ability it upgrades
  const sh = stripHit(mx, my);
  if (sh && sh.kind === 'ab') return tipClassAb(sh.i);
  if (sh && sh.kind === 'trick') return tipTrick(trickOf(player, sh.i)); // a loadout trick (js/ui/loadout.js)
  if (sh && sh.kind === 'item') return player.items[sh.i] ? tipItem(player.items[sh.i]) : null; // an empty slot says nothing
  if (sh && sh.kind === 'port') return tipAttack(player); // the hero's face names the hero's own basic attack
  if (sh && sh.kind === 'stat') return tipStat(sh.key); // the stat panel's breakdown (js/ui/statpanel.js)
  if (sh && sh.kind === 'frame') {
    const g = goldCellRect(), m = stripMouse(mx, my);
    if (m.x >= g.x && m.x < g.x + g.w && m.y >= g.y && m.y < g.y + g.h) return tipGold();
  }
  return null;
}
// resolved once a frame, before anything that has to lay out around it
function tipResolve() { tipNow = tipFit(tipAt(mouse.x, mouse.y)); }
// a note wider than the panel breaks onto more lines (wrapText), so no
// ability, item or translation runs out of the frame
function tipFit(d) {
  if (d && d.notes) d.notes = d.notes.flatMap(([t, col]) => (pixelTextWidth(t) > TIP_MAXW ? wrapText(t, TIP_MAXW).map((l) => [l, col]) : [[t, col]]));
  return d;
}
function tipSize(d) {
  const iw = d.icon ? d.icon.width + 3 : 0;
  let w = iw + pixelTextWidth(d.title);
  if (d.kind) w = Math.max(w, iw + pixelTextWidth(d.kind));
  for (const [l, v] of d.rows) w = Math.max(w, pixelTextWidth(l) + 10 + tipValW(v));
  for (const [t] of d.notes || []) w = Math.max(w, pixelTextWidth(t));
  const head = d.icon ? Math.max(14, d.icon.height + 2) : 14;
  const h = TIP_PAD * 2 + head + d.rows.length * TIP_ROW + (d.notes || []).length * TIP_ROW + (d.sum ? TIP_ROW + 3 : 0);
  return { w: Math.min(TIP_MAXW, w) + TIP_PAD * 2, h };
}
// WHERE the panel goes, the one answer for both modes. FIXED is the corner it
// was born in; FOLLOWING rides the pointer, and the whole of that is clearing
// the hand: TIP_GAP is measured sideways because every cursor glyph is
// wider below the hotspot than beside it, so a panel held
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
    ctx.drawImage(d.icon, tx, cy);
    tx += iw + 3;
  }
  drawPixelTextShadow(ctx, d.title, tx, cy, d.tcol, '#121418');
  if (d.kind) drawPixelTextShadow(ctx, d.kind, tx, cy + 7, TIP_LABEL, '#121418');
  cy += d.icon ? Math.max(14, d.icon.height + 2) : 14;
  for (const [label, value, col] of d.rows) {
    const lw = pixelTextWidth(label), vw = tipValW(value);
    drawPixelTextShadow(ctx, label, x + TIP_PAD, cy, TIP_LABEL, '#121418');
    // the dotted leader ties the pair across the gap, exactly as the PLAYER
    // panel's stat rows do - a bare gap reads as two unrelated columns
    ctx.fillStyle = '#33363d';
    for (let px = x + TIP_PAD + lw + 3; px < x + w - TIP_PAD - vw - 2; px += 2) ctx.fillRect(px, cy + 4, 1, 1);
    if (Array.isArray(value)) {
      let vx = x + w - TIP_PAD - vw;
      for (const [t, c] of value) { drawPixelTextShadow(ctx, t, vx, cy, c, '#121418'); vx += pixelTextWidth(t); }
    } else drawPixelTextShadow(ctx, value, x + w - TIP_PAD - vw, cy, col || '#f4f7ff', '#121418');
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
