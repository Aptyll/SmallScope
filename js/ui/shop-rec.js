'use strict';
// ------------------------------------------------------------ recommended
// THE RECOMMENDED TAB (League's suggested items): three items drawn large on
// cards, each with its name, its price and WHY in two words, and under them a
// row of the small buys: START (the starter and the potion) and THEN (the
// rest of the build). The counter's slab and everything else in it is
// js/ui/shop.js; this file picks the three and draws their cards.
//
// The three are YOUR build, bent to the match you are in:
//   - the first card is always the next item of your hero's build (buildsRec,
//     js/app/builds.js: what its players finish most, or BOT_BUILDS while it
//     has too few games), skipping what you already hold.
//   - a THREAT on the rival side (SHOP_THREATS) puts the item that answers it
//     (its `counter`, js/sim/items.js) on the next card, for a hero whose job
//     it is to answer it, with the faces of the rivals it is good against.
//   - the build's next items fill what is left, an answer to a threat the
//     rival side does not bring last.
// Everything a threat reads is what the scoreboard (Tab) shows every player:
// the rival heroes, the items they carry, their kills and deaths. Nothing in
// the sim reads any of this (CLAUDE.md rule 2).
const SHOP_CARD_N = 3;          // cards on the tab
const SHOP_CARD_GAP = 7;        // px between two cards
const SHOP_CARD_H = 122;        // a card's height
const SHOP_CARD_WELL = 52;      // its icon's well: a 16 px icon at 3x...
const SHOP_CARD_SLIM = 36;      // ...or at 2x, on a card too narrow for that
const SHOP_CARD_FACE = 16;      // a rival's face under the tag
const SHOP_CARD_BG = '#181a1f', SHOP_TAG_BG = '#24272d';
const SHOP_ARMOR_HEAVY = 30;    // armor from items that makes a rival a wall on its own
const SHOP_FED = 3;             // kills past deaths that make a rival a threat on its own
// the passives that give their wearer health back (a healing cut answers them)
const SHOP_HEAL_PASSIVES = ['leech', 'feast', 'den', 'mend'];

// what a rival's items add up to in one stat
function shopItemStat(q, key) {
  return q.items.reduce((n, id) => n + (id && BUILD_ITEMS[id].stats[key] || 0), 0);
}
// THE THREATS: how much of each one rival brings (`of`), how much the whole
// side must bring before a card answers it (`need`), and the hero styles
// whose job it is to answer it (`for`). A key here is a `counter` on an item.
const SHOP_THREATS = {
  heal: { need: 1, for: ['marksman', 'assassin', 'bruiser', 'mage', 'support'],
    of: (q) => (CLASSES[q.cls].heals ? 1 : 0) + q.items.filter((id) => id && SHOP_HEAL_PASSIVES.includes(BUILD_ITEMS[id].passive)).length },
  armor: { need: 2, for: ['marksman', 'assassin', 'bruiser', 'mage'],
    of: (q) => (CLASSES[q.cls].style === 'tank' ? 1 : 0) + (shopItemStat(q, 'armor') >= SHOP_ARMOR_HEAVY ? 1 : 0) },
  burst: { need: 2, for: ['marksman', 'mage', 'bruiser', 'support'],
    of: (q) => (CLASSES[q.cls].style === 'assassin' ? 1 : 0) + (q.kills >= q.deaths + SHOP_FED ? 1 : 0) },
  attack: { need: 2, for: ['tank'],
    of: (q) => (['marksman', 'assassin'].includes(CLASSES[q.cls].style) ? 1 : 0) },
};
// what a hero or an item hits with: ability power, damage, or neither (a wall)
function shopHeroKind(style) { return style === 'tank' ? 'tank' : style === 'mage' || style === 'support' ? 'ap' : 'dmg'; }
function shopItemKind(id) { const s = BUILD_ITEMS[id].stats; return 'ap' in s ? 'ap' : 'dmg' in s ? 'dmg' : 'tank'; }

// the rival side's threats your hero should answer, strongest first: each
// { key, id: the item that answers it, faces: the rivals who bring it }
function shopThreats(p) {
  const style = CLASSES[p.cls].style, rivals = players.filter((q) => q.active && q.team !== p.team);
  const out = [];
  for (const key in SHOP_THREATS) {
    const T = SHOP_THREATS[key];
    if (!T.for.includes(style) || p.items.some((id) => id && BUILD_ITEMS[id].counter === key)) continue;
    const faces = rivals.filter((q) => T.of(q) > 0), n = rivals.reduce((s, q) => s + T.of(q), 0);
    if (n < T.need) continue;
    const answers = ITEM_DONE.filter((id) => BUILD_ITEMS[id].counter === key);
    const id = answers.find((k) => (BUILD_ITEMS[k].styles || []).includes(style)) ||
      answers.find((k) => shopItemKind(k) === shopHeroKind(style));
    if (id) out.push({ key, id, faces, n: n / T.need });
  }
  return out.sort((a, b) => b.n - a.n);
}

// THE TAB'S PICKS for p: { cards: [{ id, faces }], start: [ids], then: [ids], data }
function shopPicks(p) {
  const R = buildsRec(CLASSES[p.cls].name, botBuild(p));
  // the build in buying order: the first item, the boots, the rest (BOT_BUILDS' own order)
  const core = R.core[0].ids;
  const seq = core.slice(0, 1).concat(R.boots.length ? [R.boots[0].ids[0]] : [], core.slice(1), R.more);
  // the build without what you hold (an item held once covers it once)
  const have = p.items.slice(), left = [];
  for (const id of seq) { const i = have.indexOf(id); if (i >= 0) have[i] = null; else if (!left.includes(id)) left.push(id); }
  // a finished build still shows three: the other finished items of your style, then of your kind
  const style = CLASSES[p.cls].style;
  const more = (ok) => { for (const id of ITEM_DONE) if (left.length < SHOP_CARD_N + 4 && !left.includes(id) && !p.items.includes(id) && ok(id)) left.push(id); };
  more((id) => (BUILD_ITEMS[id].styles || []).includes(style));
  more((id) => shopItemKind(id) === shopHeroKind(style));
  // an answer to a threat the rival side does not bring waits behind the rest
  // (ANTI-TANK against three assassins is no advice), the build's order kept otherwise
  const threats = shopThreats(p), live = new Set(threats.map((t) => t.key));
  const quiet = (id) => !!BUILD_ITEMS[id].counter && !live.has(BUILD_ITEMS[id].counter);
  left.sort((a, b) => quiet(a) - quiet(b));
  const cards = left.slice(0, 1).map((id) => ({ id, faces: [] }));
  // a boots item while you wear a pair is no buy at all
  const fits = (id) => !cards.some((c) => c.id === id) && !(isBoots(id) && p.items.some((k) => k && isBoots(k) && k !== 'boots'));
  for (const t of threats) if (cards.length < SHOP_CARD_N && fits(t.id)) cards.push({ id: t.id, faces: t.faces });
  for (const id of left) if (cards.length < SHOP_CARD_N && fits(id)) cards.push({ id, faces: [] });
  // an answer your build already names still shows who it is good against
  for (const c of cards) { const t = threats.find((q) => q.id === c.id); if (t) c.faces = t.faces; }
  // START: the starter that opens the build while you have bought nothing, and the potion always
  const fresh = !p.items.some((id) => id && id !== 'potion');
  const start = (fresh ? [itemStarter(cards[0].id)] : []).concat(['potion']);
  const then = left.filter((id) => !cards.some((c) => c.id === id));
  return { cards, start, then, data: R.data };
}

// The tab's geometry, inside the grid's room (x0, y0, w wide, down to `bottom`):
// the three cards across the top, then the small wells. Pushes the small
// wells onto `grid` and their headlines onto `heads` (drawn as the grid is);
// returns the cards, each { id, faces, x, y, w, h, well }.
function shopRecLayout(x0, y0, w, bottom, grid, heads) {
  const P = shopPicks(player);
  const cw = Math.floor((w - (SHOP_CARD_N - 1) * SHOP_CARD_GAP) / SHOP_CARD_N);
  // a narrow view's card (5:4) takes the icon at 2x, and a name too long for
  // one line on two, broken at a space
  const B0 = cw >= SHOP_CARD_WELL + 16 ? SHOP_CARD_WELL : SHOP_CARD_SLIM;
  const names = P.cards.map((c) => shopCardName(BUILD_ITEMS[c.id].name, cw - 4));
  const wy = y0 + 16 + (Math.max(1, ...names.map((n) => n.length)) - 1) * 7; // the wells in one row
  const cards = P.cards.map((c, i) => {
    const x = x0 + i * (cw + SHOP_CARD_GAP), name = names[i];
    return Object.assign({ x, y: y0, w: cw, h: SHOP_CARD_H, name,
      well: { x: x + ((cw - B0) >> 1), y: wy, w: B0, h: B0 } }, c);
  });
  // the small row: START, then THEN, as many as fit (a well, its price under it)
  const B = 36, pitch = B + 6, ry = Math.min(y0 + SHOP_CARD_H + 10, bottom - B - 18);
  heads.push({ label: tr('shop.start'), x: x0, y: ry });
  P.start.forEach((id, i) => grid.push({ id, x: x0 + i * pitch, y: ry + 9, w: B, h: B }));
  const tx = x0 + P.start.length * pitch + 10, fit = Math.max(0, Math.floor((x0 + w - tx + 6) / pitch));
  if (P.then.length && fit) heads.push({ label: tr(P.data ? 'shop.alsoBuilt' : 'shop.then'), x: tx, y: ry });
  P.then.slice(0, fit).forEach((id, i) => grid.push({ id, x: tx + i * pitch, y: ry + 9, w: B, h: B }));
  return cards;
}

// a name in the lines it takes to fit `w`: one, or two broken at the space nearest its middle
function shopCardName(name, w) {
  if (pixelTextWidth(name) <= w || !name.includes(' ')) return [name];
  const cuts = [...name].map((ch, i) => ch === ' ' ? i : -1).filter((i) => i > 0);
  const at = cuts.sort((a, b) => Math.abs(a - name.length / 2) - Math.abs(b - name.length / 2))[0];
  return [name.slice(0, at), name.slice(at + 1)];
}
// One card: a flat plate, the item's NAME across the top in its tier's ink,
// its icon large in a tier-rimmed well, the PRICE you would pay now under it
// (red while your purse is short), the WHY on a flat tag, and the rivals it
// answers. Hover lights the rim, the pick lights it gold.
function drawShopCard(c, h) {
  const hot = !!h && h.kind === 'pick' && h.id === c.id;
  const pick = shopPicked().slot < 0 && shopPicked().id === c.id;
  const it = BUILD_ITEMS[c.id], M = itemMetal(c.id), mid = c.x + (c.w >> 1);
  shopWell(c, pick ? SHOP_PICK : hot ? SHOP_HOT : SHOP_RIM, SHOP_CARD_BG);
  c.name.forEach((ln, i) => drawPixelText(ctx, ln, mid - (pixelTextWidth(ln) >> 1), c.y + 6 + i * 7, M.ink));
  shopWell(c.well, M.rim);
  shopIcon(itemIcon(c.id), c.well);
  const n = itemCost(player, c.id).gold, t = String(n), pw = 10 + pixelTextWidth(t);
  shopPrice(n, mid - (pw >> 1), c.well.y + c.well.h + 6, n > player.gold);
  const pad = c.w - pixelTextWidth(it.why) >= 20 ? 5 : 2;
  const tag = { x: c.x + pad, y: c.well.y + c.well.h + 17, w: c.w - 2 * pad, h: 13 };
  ctx.fillStyle = SHOP_TAG_BG; ctx.fillRect(tag.x, tag.y, tag.w, tag.h);
  drawPixelText(ctx, it.why, mid - (pixelTextWidth(it.why) >> 1), tag.y + 4, SHOP_INK);
  // GOOD AGAINST, shown not said: the faces of the rivals it answers
  const fw = c.faces.length * (SHOP_CARD_FACE + 3) - 3;
  c.faces.forEach((q, i) => {
    const fx = mid - (fw >> 1) + i * (SHOP_CARD_FACE + 3), fy = tag.y + tag.h + 5;
    ctx.fillStyle = TEAMS[skin(q.team)].mark; ctx.fillRect(fx - 1, fy - 1, SHOP_CARD_FACE + 2, SHOP_CARD_FACE + 2);
    drawFace(fx, fy, SHOP_CARD_FACE, q);
  });
}
