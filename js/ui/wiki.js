'use strict';
// The wiki: the game written down, one page a subject, the first of the
// title's three tabs (js/ui/notes.js).
// ------------------------------------------------------------ the wiki
// Entered from the WIKI tab over the patch notes. One surface eased in over the chrome on its
// own clock (wikiT), under the title's tabs a bar of PAGES (the settings slab's
// navbar grammar), and under that a content window the open page scrolls
// through when it outgrows it - wheel, up/down, the rail on the right.
// It takes the music layer outright the way the lobby does, not as a hold:
// WHISPERING WOODS loops under it from the moment it opens (beginWiki), and
// the title track comes back on the way out (leaveWiki).
// A page is data: WIKI_PAGES is {id, label, build(cw)}, build returning the
// page's BLOCKS top to bottom (a heading, a line, a rule, a beast card, a
// table row, a world entry) for a content width, each with a fixed height, so the layout, the draw, the hit
// test and the scroll bound all read one list and a new page is one table
// entry and one builder, never new plumbing. Nothing here is bought, unlocked
// or researched. The ITEMS page is the merchant's catalogue written down:
// the parts, then the finished items, each with its price, its stats and its
// passive, read off BUILD_ITEMS (js/sim/items.js); a hover raises the same
// card the shop shows (tipItem). The BEASTS page is the meadow's two kinds and the camps' three - each drawn wearing
// the frame it wears in the snow - and what a level does to their health
// and to the gold and XP a kill pays, at levels 1, 6 and 12, read off the same
// constants the sim spends (ANIMAL_HP, ANIMAL_LV_HP, YIELD, ANIMAL_LV_GOLD, ANIMAL_LV_XP,
// js/sim/wildlife.js and js/sim/core.js), so the page can never disagree with the
// game. The CLASSES page is every hero as the lobby reads them -
// body, pitch and level 1 stats, the hero's story (who they were before
// the pass, CLASSES `story`) - and their abilities
// with the cooldown, the cast and what each does, off CLASS_AB itself. The
// WORLD page is the one with no numbers on it: the valley written down - the
// snow, what is under it, the one law, and who is on it - each entry a figure
// on its mound beside a paragraph (WIKI_WORLD; the premise and the rules the
// words answer to are docs/dev/lore.md).
const WIKI_W_MAX = 400;
const WIKI_H = 200;           // the slab; the window is inside it
const WIKI_LEVELS = [1, 6, 12]; // the three columns a beast's growth is shown at...
// ...from the least level the kind spawns at (MONSTER.lv: a bear's 6, then 9 and 12)
function wikiLevels(kind) {
  const lv0 = (MONSTER[kind] && MONSTER[kind].lv) || 1;
  return lv0 > 1 ? [lv0, Math.round((lv0 + LEVEL_MAX) / 2), LEVEL_MAX] : WIKI_LEVELS;
}
const wikiScroll = {};        // px scrolled per page id

// the beast cards: kind, name, a line of what it does - every number in it read off the sim's own constants
const WIKI_BEASTS = [
  { kind: 'rabbit', name: 'RABBIT',
    line: () => 'BOLTS AT ' + FLEE_SIGHT.rabbit + ' PX. ONE JINK CHARGE EVERY ' + RABBIT_DODGE_CD + ' S.' },
  { kind: 'deer', name: 'DEER',
    line: () => 'TWO, ONE EACH SIDE OF THE CREEK, ALWAYS ON THE MOVE. BOLTS AT ' + FLEE_SIGHT.deer + ' PX. SPRINTS ' + DEER_SPRINT_T + ' S AT ' + DEER_SPRINT + ', THEN ' + PREY_RUN.deer + '.' },
  { kind: 'wolf', name: 'WOLF',
    line: () => 'A DEN OF ' + CAMPS.resource.pop + '. NEUTRAL UNTIL HIT. BITES ' + MONSTER.wolf.bite + ' +' + MONSTER.wolf.lvBite + ' A LEVEL. BACK IN ' + CAMPS.resource.repop + ' S.' },
  { kind: 'alpha', name: 'BLACK BEAR',
    line: () => 'ONE A STONE, NEVER UNDER LV ' + MONSTER.alpha.lv + '. SWIPES ' + MONSTER.alpha.bite + ' +' + MONSTER.alpha.lvBite + '. THE TEAM GETS ' + EPIC_TEAM_GOLD + ' EACH AND ' + CAMP_BUFF_EPIC_T + ' S OF THE ' + MONSTER.alpha.buff + '.' },
  { kind: 'dire', name: 'BROWN BEAR',
    line: () => 'ONE A DEN, NEVER UNDER LV ' + MONSTER.dire.lv + '. SWIPES ' + MONSTER.dire.bite + ' +' + MONSTER.dire.lvBite + '. THE TEAM GETS ' + EPIC_TEAM_GOLD + ' EACH AND ' + CAMP_BUFF_EPIC_T + ' S OF THE ' + MONSTER.dire.buff + '.' },
];
// what a beast is at a level: the sim's own arithmetic (makeAnimal, animalDies)
function wikiBeastHp(kind, lv) { return animalHpAt(kind, lv); }
function wikiBeastGold(kind, lv) { const y = YIELD[kind]; return Math.round(y.coins * y.each * (1 + ANIMAL_LV_GOLD * (lv - 1))); }
// ...and its XP, the whole of it before the side standing near shares it (shareXp); 0 for a kind worth none
function wikiBeastXp(kind, lv) { const y = YIELD[kind]; return y && y.xp ? Math.round(y.xp * (1 + ANIMAL_LV_XP * (lv - 1))) : 0; }

// the items table: each column a label, a width and how to read it off the
// item's own BUILD_ITEMS record. STATS is the shop's own wording (ITEM_STATS).
function wikiItemStats(id) {
  const st = BUILD_ITEMS[id].stats;
  return ITEM_STAT_ORDER.filter((k) => st[k]).map((k) => ITEM_STATS[k].fmt(st[k]) + ' ' + ITEM_STATS[k].short).join('  ');
}
const WIKI_ITEM_COLS = [
  { label: 'STATS', w: 150, get: wikiItemStats, col: '#f4f7ff' },
  { label: 'PASSIVE', w: 52, get: (id) => BUILD_ITEMS[id].passive ? ITEM_PASSIVES[BUILD_ITEMS[id].passive].name : '', col: '#9fd6a0' },
  { label: 'PRICE', w: 30, get: (id) => String(BUILD_ITEMS[id].price), col: RES_COLORS.gold },
];
// the classes page: an ability row's two numbers (the tooltip's own rows,
// tipClassAb), and the stats a class card shows at level 1 (WIKI_STATS)
const WIKI_AB_COLS = [
  { label: 'COOLDOWN', w: 40, get: (ab) => tipSec(rankAt(ab.cd, 1)) }, // rank 1's: the card says every rank's
  { label: 'CAST', w: 32, get: (ab) => tipSec(ab.cast) },
];
const WIKI_CLS_TEXT_X = 56; // where a class card's words start, right of its 48 px model
const WIKI_STORY_INK = '#a8b4d6'; // a hero's story: quieter than the pitch, warmer than the rules
const WIKI_STATS = ['hp', 'dmg', 'as', 'armor', 'ms']; // the class card's rows: its level 1 numbers (STATS, js/sim/stats.js)
// a sentence broken into lines no wider than maxW, on word boundaries
function wikiWrap(text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (pixelTextWidth(next) > maxW && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// the world page: the setting, in the order an exile meets it. An entry is a
// name, a paragraph (wrapped to the column when the page is built) and `fig` -
// the sprites that stand on its mound, left to right, read at draw time so
// they wear the side you play. `road` stands them on packed earth, not snow,
// and `air` on nothing (the eagle's sprite is the bird seen from above).
// Every sentence is either something the match does or the reason for it -
// the voice, the fixed words and what stays unanswered: docs/dev/lore.md.
const WIKI_FIG_W = 44;   // the figure column...
const WIKI_TEXT_X = 52;  // ...and where an entry's words start, off the content's left margin
const WIKI_BEAST_W = 52; // a beast card's figure column, at least: a wider beast widens its own
// a hero standing in the snow as the world draws it, in your side's coat
function wikiHero(cls, dir) { return SPRITES.champLook(cls, CLASSES[cls].look, skin(player.team))[dir][0]; }
const WIKI_WORLD = [
  { name: 'SOFTFALL', fig: () => [SPRITES.tree[0]],
    text: 'THE SNOW CAME DOWN SOFT AND DID NOT STOP, AND THE VALLEY\'S OLD WORKS WENT UNDER WHOLE. IT STILL FALLS EVERY WINTER, AND THE VALLEY COMES OUT FROM UNDER IT A DIFFERENT SHAPE EACH TIME. NO MAP OF SOFTFALL IS GOOD FOR TWO WINTERS.' },
  { name: 'THE EMPIRE', fig: () => [wikiHero(2, 'down'), wikiHero(4, 'down')],
    text: 'OVER THE PASS IS AN EMPIRE BIG ENOUGH THAT IT HAS NEVER NEEDED A NAME. IT KEEPS WHAT IT CAN USE. THE REST IT WALKS UP TO THE LAST PASS, A GENERAL OR A LAMPLIGHTER ALIKE, AND SHUTS THE GATE BEHIND THEM. NOBODY IS LET BACK.' },
  { name: 'THE EXILES', fig: () => [SPRITES.champ[0][skin(player.team)].down[0], SPRITES.champ[1][skin(player.team)].down[0]],
    text: 'NOBODY IN SOFTFALL WAS BORN HERE. A SOLDIER WHO WALKED HOME, A SMITH WHO WOULD NOT KNEEL, A GENERAL WHO WON THE WRONG WAR: THE VALLEY TAKES ANYONE WHO CAN DIG. ONE WHO GOES DOWN IS CARRIED BACK TO THE ROOST AND SENT OUT AGAIN, AND THE BETTER THE EXILE, THE LONGER THE COMPANY MAKES THEM SIT FIRST.' },
  { name: 'THE WORKS', fig: () => [SPRITES.deadTree[0]],
    text: 'NOBODY ALIVE SAW THE WORKS RUNNING. THE PINES GREW UP THROUGH THEM, SO THERE IS GOLD IN THE WOOD. THE ROAD, ITS TOWERS AND THE MACHINES ARE WHAT STILL STANDS ABOVE THE SNOW.' },
  { name: 'THE CLAIM', fig: () => [SPRITES.champ[0][skin(player.team)].right[0], SPRITES.champ[1][skin(1 - player.team)].left[0]],
    text: 'TWO COMPANIES HIRE EXILES TO DIG THE WORKS OUT, AND NEITHER ASKS WHERE THEY CAME FROM. VALLEY LAW IS ONE LINE LONG: A CLAIM STANDS WHILE ITS BIRD HOLDS ITS ROOST. SO NOBODY COMES TO SOFTFALL TO KILL ANYBODY. SCARE THE OTHER BIRD OFF ITS GROUND AND THE VALLEY IS YOURS UNTIL THE NEXT SNOW.' },
  { name: 'THE EAGLES', air: true, fig: () => [SPRITES.perch.figure(BIRD_SKINS[0].id, skin(player.team))],
    text: 'BIG ENOUGH TO CARRY FIVE EXILES AND A MERCHANT, ARMOURED IN COMPANY COLOUR, AND BRAVE ONLY UP TO A POINT. IT BEATS ITS WINGS AT WHATEVER CROWDS IT. HIT IT ENOUGH AND ITS NERVE GOES. IT LEAVES, AND ITS COMPANY LEAVES WITH IT.' },
  { name: 'THE COUNTER', fig: () => [SPRITES.merchant[skin(player.team)].down[0]],
    text: 'THE MERCHANTS ARE A GUILD OF THEIR OWN. ONE RIDES IN WITH EACH BIRD, BUILDS ITS BARRACKS AND SELLS TO ANY PURSE THAT WALKS UP, YOURS OR THEIRS. THEY ARE NOT ON A SIDE. THEY ARE ON THE PRICE OF FISH. NOBODY LAYS A HAND ON ONE.' },
  { name: 'THE MACHINES', fig: () => [SPRITES.robotTeam[skin(player.team)][0], SPRITES.robotTeam[skin(player.team)][1]],
    text: 'OLDER THAN THE ROAD. THEY SLEEP UNDER THE SNOW UNTIL GOLD WAKES ONE, AND THEN THEY DO THE ONE THING THEY REMEMBER: GATHER, GUARD, OR MARCH. WHO BUILT THEM IS THE VALLEY\'S FAVOURITE ARGUMENT.' },
  { name: 'THE ROAD', road: true, fig: () => [SPRITES.robotTeam[skin(player.team)][0], SPRITES.robotTeam[skin(1 - player.team)][0]],
    text: 'THE WORKS\' HAUL ROAD RUNS STRAIGHT FROM ROOST TO ROOST, PACKED HARD BY WHATEVER THEY HAULED ALONG IT, AND A TRACK RUNS ROUND EACH SIDE OF THE VALLEY BY THE TREES. BOTH COLUMNS MARCH DOWN ALL THREE, SO EVERYTHING IN SOFTFALL ENDS UP ON A ROAD. MOST OF IT MEETS IN THE MIDDLE.' },
  { name: 'THE TOWERS', road: true, fig: () => [towerFigure(skin(player.team))],
    text: 'THE WORKS RAISED THEM IN CUT STONE TO HOLD THE ROADS, TWO TO EVERY CABLE, AND GOLD WOKE THE CROSSBOWS ON TOP. A COMPANY\'S CABLE RUNS NO FURTHER THAN ITS LAST TOWER STANDING. A TOWER SHOOTS THE MARCHING COLUMN, UNTIL AN EXILE HURTS ONE OF ITS OWN UNDER IT.' },
  { name: 'THE WOLVES', fig: () => [SPRITES.wolf.right.idle[0], SPRITES.wolf.left.idle[0]],
    text: 'THE WOLVES WERE HERE FIRST AND HAVE NO OPINION ABOUT CLAIMS. LEAVE A DEN ALONE AND IT LEAVES YOU ALONE. THE BLACK BEAR KEEPS TO ITS STONE AND THE BROWN BEAR TO ITS DEN, AND A COMPANY THAT BRINGS ONE DOWN WALKS TALLER FOR A WHILE.' },
  { name: 'GOLD', fig: () => [SPRITES.goldSack[SPRITES.goldSack.length - 1]],
    text: 'THE ONLY THING THE VALLEY PAYS IN. THE WORKS WILL MAKE AN EXILE RICH, BUT A PINE NEVER TAUGHT ANYBODY ANYTHING. AN EXILE LEARNS ON THE ROAD, STANDING CLOSE WHEN THINGS FALL, AND THAT IS ALL A LEVEL IS.' },
];

const WIKI_PAGES = [
  { id: 'classes', label: 'CLASSES', build(cw) {
    const b = [];
    b.push({ kind: 'line', h: 9, text: 'THE HEROES, ONE PICKED ON THE WAY IN. KEYS 1-4 ARE THE HERO, EACH ON ITS OWN COOLDOWN.', col: '#cfe0ff' });
    b.push({ kind: 'line', h: 9, text: 'A SKILL POINT UNLOCKS A KEY OR RANKS IT UP: ' + AB_RANK_LV.length + ' RANKS ON KEYS 1-3, ' + AB_ULT_LV.length + ' ON 4 AT LEVELS ' + AB_ULT_LV.join(', ') + '.', col: TIP_DIM });
    CLASSES.forEach((c, cls) => {
      b.push({ kind: cls ? 'rule' : 'gap', h: cls ? 10 : 4 });
      b.push({ kind: 'cls', h: 52, cls });
      // who the hero was before the pass, under the card the way League's
      // champion page puts the bio over the abilities (CLASSES `story`)
      if (c.story) { const lines = wikiWrap(c.story, cw - WIKI_CLS_TEXT_X); b.push({ kind: 'story', h: lines.length * 8 + 8, lines }); }
      b.push({ kind: 'head', h: 12, text: 'KEYS 1-4', cols: WIKI_AB_COLS });
      if (c.passive) b.push({ kind: 'ab', h: 36, cls, i: -1, cols: [] }); // a named hero's passive heads its keys (HERO_PASSIVE, js/sim/heroes.js)
      CLASS_AB[cls].forEach((ab, i) => abOptions(cls, i).forEach((o, k) => b.push({ kind: 'ab', h: 36, cls, i, k, cols: WIKI_AB_COLS })));
    });
    return b;
  } },
  { id: 'beasts', label: 'BEASTS', build(cw) {
    const b = [];
    b.push({ kind: 'line', h: 9, text: 'EVERY BEAST IS DEALT THE TABLE\'S AVERAGE HERO LEVEL WHEN IT SPAWNS, AND KEEPS IT.', col: '#cfe0ff' });
    b.push({ kind: 'line', h: 9, text: 'A LEVEL IS MORE HEALTH TO SHOOT THROUGH, AND MORE GOLD AND XP FOR THE KILL.', col: TIP_DIM });
    b.push({ kind: 'legend', h: SPRITES.deer.right.idle[0].height + 26 }); // the deer under its frame, as a card's figure
    b.push({ kind: 'rule', h: 8 });
    // a card is as wide and as tall as its beast standing under its frame
    // (a bear is a 112 px frame), and its line wraps to what is left
    for (const bs of WIKI_BEASTS) {
      const spr = SPRITES[bs.kind].right.idle[0];
      const figW = Math.max(WIKI_BEAST_W, spr.width), lines = wikiWrap(bs.line(), cw - figW - 8);
      const h = Math.max(46 + (wikiBeastXp(bs.kind, 1) ? 9 : 0) + (lines.length - 1) * 8, spr.height - (spr.crown || 0) + 18 * beastFrame(bs.kind).s + 8); // a KILL XP row is a row more
      b.push({ kind: 'beast', h, beast: bs, figW, lines });
    }
    return b;
  } },
  { id: 'items', label: 'ITEMS', build() {
    const b = [];
    b.push({ kind: 'line', h: 9, text: 'SIX SLOTS. EVERY ITEM IS ON SALE AT EITHER COUNTER, ALWAYS AT ONE PRICE.', col: '#cfe0ff' });
    b.push({ kind: 'line', h: 9, text: 'AN ITEM COSTS LESS FOR EVERY PART OF IT YOU ALREADY HOLD. ONE PAIR OF BOOTS.', col: TIP_DIM });
    for (const [title, kind] of [['BASIC', 'basic'], ['BOOTS', 'boots'], ['EPIC', 'epic'], ['LEGENDARY', 'legend']]) {
      b.push({ kind: 'gap', h: 4 });
      b.push({ kind: 'head', h: 12, text: title, cols: WIKI_ITEM_COLS });
      for (const id of ITEM_ALL) if (shopRowKind(id) === kind && !isStack(id)) b.push({ kind: 'row', h: 20, id, cols: WIKI_ITEM_COLS });
    }
    return b;
  } },
  { id: 'world', label: 'WORLD', build(cw) {
    // the one page of sentences, so the one page that wraps: every line is
    // broken to the content width it is built for (cw), and an entry is as
    // tall as the taller of its figure and its paragraph
    const b = [];
    const para = (text, col) => { for (const t of wikiWrap(text, cw)) b.push({ kind: 'line', h: 9, text: t, col }); };
    para('SOFTFALL IS A VALLEY OVER THE EMPIRE\'S LAST PASS, AND THE SNOW THAT BURIED IT.', '#cfe0ff');
    para('THE EMPIRE THROWS PEOPLE OUT. THE VALLEY TAKES ANYONE WHO CAN DIG.', TIP_DIM);
    b.push({ kind: 'rule', h: 10 });
    for (const e of WIKI_WORLD) {
      const lines = wikiWrap(e.text, cw - WIKI_TEXT_X);
      const fh = Math.max(...e.fig().map((s) => s.height));
      b.push({ kind: 'lore', h: Math.max(Math.max(fh, 18) + 12, 14 + lines.length * 8 + 8), entry: e, lines, fh });
    }
    b.push({ kind: 'rule', h: 10 });
    para('THAT IS ALL ANYBODY KNOWS. THE REST IS UNDER THE SNOW.', TIP_DIM);
    return b;
  } },
];
// a page's blocks, built once per content width: the content is constant, and
// only the sentences (the WORLD page, a hero's story) wrap to the width
const wikiBuilt = {};
function wikiBlocks(pageId, cw) {
  const key = pageId + ':' + cw;
  if (!wikiBuilt[key]) wikiBuilt[key] = WIKI_PAGES.find((p) => p.id === pageId).build(cw);
  return wikiBuilt[key];
}
function wikiPage() { return WIKI_PAGES[Math.max(0, Math.min(WIKI_PAGES.length - 1, state.menu.wikiTab))]; }

// everything positioned on the page comes from here: the slab, the tab
// cells, the content window, the rail, and the open page's blocks each
// carrying the y it draws at (pre-scroll). Draw and hit test both read it.
function wikiLayout() {
  const cx = Math.round(VIEW_W / 2);
  const w = Math.min(WIKI_W_MAX, VIEW_W - 24), x = cx - (w >> 1);
  const y = NOTES_TOP + 34, h = WIKI_H; // under the title's tabs (drawPageTabs, js/ui/notes.js)
  const n = WIKI_PAGES.length, cw = Math.floor((w - 24) / n);
  const tabs = WIKI_PAGES.map((p, i) => ({ id: p.id, label: p.label, x: x + 12 + i * cw, y: y + 7, w: cw, h: 9 }));
  const winY = y + 22, winH = h - 28;
  const page = wikiPage();
  const blocks = wikiBlocks(page.id, w - 28); // the content's width: the margins under `left`/`right` below
  let by = winY + 4, total = 4;
  const rows = blocks.map((bl) => { const r = { bl, y: by }; by += bl.h; total += bl.h; return r; });
  const maxScroll = Math.max(0, total + 4 - winH);
  const scroll = Math.max(0, Math.min(maxScroll, wikiScroll[page.id] || 0));
  wikiScroll[page.id] = scroll;
  const rail = { x: x + w - 9, y: winY + 2, w: 5, h: winH - 4 };
  const th = Math.max(8, Math.round(rail.h * winH / (total + 8)));
  const thumb = { x: rail.x, y: rail.y + Math.round((rail.h - th) * (maxScroll ? scroll / maxScroll : 0)), w: rail.w, h: th };
  return { cx, x, y, w, h, tabs, winY, winH, rows, scroll, maxScroll, rail, thumb, page,
    left: x + 12, right: x + w - 16 }; // the content's own margins, clear of the rail
}
// what is under (mx, my): one of the title's tabs, a page's tab, a table row (carrying its kind id, for the
// tooltip), the rail, or nothing. Shared by the hover, the click and the
// tooltip, so the three can never point at different things.
function wikiHit(mx, my) {
  const page = pageTabHit(mx, my);
  if (page >= 0) return { kind: 'page', i: page };
  const L = wikiLayout();
  for (let i = 0; i < L.tabs.length; i++) {
    const t = L.tabs[i];
    if (mx >= t.x && mx < t.x + t.w && my >= t.y - 3 && my < t.y + t.h + 3) return { kind: 'tab', i };
  }
  if (L.maxScroll > 0 && mx >= L.rail.x - 2 && mx < L.rail.x + L.rail.w + 2 && my >= L.rail.y && my < L.rail.y + L.rail.h) return { kind: 'rail', y: my };
  if (my < L.winY || my >= L.winY + L.winH || mx < L.left || mx >= L.right) return null;
  for (const r of L.rows) {
    if ((r.bl.kind !== 'row' && r.bl.kind !== 'ab') || r.bl.i < 0) continue; // (a passive's row has no card of its own)
    const ry = r.y - L.scroll;
    if (my < ry || my >= ry + r.bl.h) continue;
    return r.bl.kind === 'row' ? { kind: 'row', id: r.bl.id } : { kind: 'ab', cls: r.bl.cls, i: r.bl.i };
  }
  return null;
}
function beginWiki() {
  const m = state.menu;
  m.screen = 'wiki';
  SFX.place();
  SFX.music.play('wiki', { in: 0.6, out: 0.5 }); // WHISPERING WOODS, from the moment it opens
}
// Esc goes back to the title; the other two tabs to the notes screen
function leaveWiki(to) {
  state.menu.screen = to || 'menu';
  SFX.pickup();
  SFX.music.play('intro', { in: 0.6, out: 0.5 }); // ...and the title takes its own back
}
function wikiScrollBy(d) {
  const L = wikiLayout();
  wikiScroll[L.page.id] = Math.max(0, Math.min(L.maxScroll, L.scroll + d));
}
function wikiSetTab(i) {
  const m = state.menu;
  const t = Math.max(0, Math.min(WIKI_PAGES.length - 1, i));
  if (t !== m.wikiTab) { m.wikiTab = t; SFX.pickup(); }
}
function wikiKey(k) {
  const m = state.menu;
  if (k === 'escape' || k === 'backspace') { leaveWiki(); return; }
  if (moveDir(k) === 'left') wikiSetTab(m.wikiTab - 1);
  else if (moveDir(k) === 'right') { if (m.wikiTab < WIKI_PAGES.length - 1) wikiSetTab(m.wikiTab + 1); else openPageTab(1); } // past the last page: PATCH NOTES
  else if (moveDir(k) === 'up') wikiScrollBy(-12);
  else if (moveDir(k) === 'down') wikiScrollBy(12);
}
// a click: a title tab opens its screen, a page tab its page, the rail pages the window; a row is read,
// not pressed - the tooltip is already up over it
function wikiClick() {
  const m = state.menu;
  if (m.wikiT < 1) return;
  const h = wikiHit(mouse.x, mouse.y);
  if (!h) return;
  if (h.kind === 'page') openPageTab(h.i);
  else if (h.kind === 'tab') wikiSetTab(h.i);
  else if (h.kind === 'rail') {
    const L = wikiLayout();
    wikiScrollBy(h.y < L.thumb.y ? -L.winH : h.y >= L.thumb.y + L.thumb.h ? L.winH : 0);
  }
}

// the ground a figure stands on, w px wide: a low pale mound with a shaded
// rim - snow, or the road's packed earth (ROAD_COL_*, js/draw/ground.js)
function wikiMound(cx, baseY, w, road) {
  const hw = w >> 1;
  ctx.fillStyle = road ? ROAD_COL_RUT : '#c9dcee'; ctx.fillRect(cx - hw, baseY - 1, w, 3);
  ctx.fillStyle = road ? ROAD_COL_A : '#eef4fb'; ctx.fillRect(cx - hw + 2, baseY - 2, w - 4, 3);
}
// a WORLD entry's figures on one mound, left to right about cx, each over
// its own shadow - or, `air`, on the wing with no ground under them at all
function drawWikiFig(e, cx, baseY) {
  const sprs = e.fig();
  const total = sprs.reduce((w, s) => w + s.width, 0) + 2 * (sprs.length - 1);
  if (!e.air) wikiMound(cx, baseY, Math.max(26, total + 8), e.road);
  let x = cx - (total >> 1);
  for (const s of sprs) {
    if (!e.air) { ctx.fillStyle = 'rgba(110,130,170,0.35)'; ctx.fillRect(x + 2, baseY, s.width - 4, 2); }
    ctx.drawImage(s, x, baseY + 2 - s.height);
    x += s.width + 2;
  }
}
// One beast standing on its snow, wearing exactly the frame drawAnimal hangs
// over it in the world - health, the second bar, the level plate, the
// noticed mark - so the page teaches the frame by showing it, not naming it.
// A camp monster shows its leash bar part-filled, since bare track says nothing.
function drawWikiBeast(bs, cx, baseY, level, now) {
  const spr = SPRITES[bs.kind].right.idle[0];
  const F = beastFrame(bs.kind), bw = F.w * F.s;
  wikiMound(cx, baseY, Math.max(26, bw + 8)); // a bear's snow as wide as its bar
  ctx.fillStyle = 'rgba(110,130,170,0.35)'; ctx.fillRect(cx - (bw >> 1), baseY, bw, 2);
  const px = cx - (spr.width >> 1), py0 = baseY + 2 - spr.height;
  ctx.drawImage(spr, px, py0);
  // full, chunked the way the world chunks it, at the least level it spawns
  // at; a camp monster's leash part-filled, since bare track says nothing
  const lv = animalLevelOf(bs.kind), hp = wikiBeastHp(bs.kind, lv);
  drawBeastFrame(bs.kind, cx, cx, py0 + (spr.crown || 0), { hp, maxHp: hp, level: lv, senseT: 1 }, isCampKind(bs.kind) ? 0.6 : 1);
}
// a label tied to a point on the figure by a thin leader
function wikiLeader(x0, y0, x1, y1, text, col) {
  ctx.fillStyle = '#4a5480';
  ctx.fillRect(Math.min(x0, x1), y0, Math.abs(x1 - x0) + 1, 1);
  if (y1 !== y0) ctx.fillRect(x1, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1);
  drawPixelTextShadow(ctx, text, x1 > x0 ? x1 + 3 : x1 - 3 - pixelTextWidth(text), y1 - 2, col, '#0a0e23');
}
// the rail: only there when the page outgrows the window; the thumb's place
// is the whole affordance
function drawWikiRail(L) {
  if (!L.maxScroll) return;
  const { rail, thumb } = L;
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(rail.x - 1, rail.y - 1, rail.w + 2, rail.h + 2);
  ctx.fillStyle = '#1c2750'; ctx.fillRect(rail.x, rail.y, rail.w, rail.h);
  ctx.fillStyle = '#0f1632'; ctx.fillRect(rail.x + 2, rail.y, 1, rail.h);
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(thumb.x - 1, thumb.y - 1, thumb.w + 2, thumb.h + 2);
  ctx.fillStyle = '#c89a3c'; ctx.fillRect(thumb.x, thumb.y, thumb.w, thumb.h);
  ctx.fillStyle = '#ffd95c'; ctx.fillRect(thumb.x, thumb.y, thumb.w, 1); ctx.fillRect(thumb.x, thumb.y, 1, thumb.h);
  ctx.fillStyle = '#8a6a2a'; ctx.fillRect(thumb.x, thumb.y + thumb.h - 1, thumb.w, 1); ctx.fillRect(thumb.x + thumb.w - 1, thumb.y, 1, thumb.h);
}
// one item row: the item's icon in a well rimmed the way the shop rims it
// (part or finished), its name, and its numbers in the columns
function drawWikiRow(r, L, hot) {
  const id = r.bl.id, y = r.y - L.scroll;
  const n = { x: L.left, y: y + (hot ? 0 : 1), w: 18, h: 18 };
  ctx.fillStyle = hot ? '#ffffff' : itemMetal(id).rim; ctx.fillRect(n.x, n.y, n.w, n.h);
  ctx.fillStyle = '#080b1c'; ctx.fillRect(n.x + 1, n.y + 1, n.w - 2, n.h - 2);
  shopIcon(itemIcon(id), { x: n.x, y: n.y, w: n.w + 2, h: n.h + 2 }); // a 16 px icon, flush in the 16 px ground
  const name = BUILD_ITEMS[id].name;
  const nx = L.left + 23, ty = y + 7;
  drawPixelTextShadow(ctx, name, nx, ty, hot ? '#ffffff' : '#cfe0ff', '#0a0e23');
  // the columns, right to left off the content's right margin, each value
  // right-aligned under its head; a dotted leader ties the name to the first
  let rx = L.right;
  let firstX = rx;
  for (let i = r.bl.cols.length - 1; i >= 0; i--) {
    const c = r.bl.cols[i];
    const v = c.get(id), vw = pixelTextWidth(v);
    if (v) { drawPixelTextShadow(ctx, v, rx - vw, ty, c.col, '#0a0e23'); firstX = rx - vw; }
    rx -= c.w;
  }
  ctx.fillStyle = '#2c3560';
  for (let px = nx + pixelTextWidth(name) + 3; px < firstX - 3; px += 2) ctx.fillRect(px, ty + 4, 1, 1);
}
function renderWiki(now, a) {
  const m = state.menu;
  const L = wikiLayout();
  ctx.globalAlpha = a; // the title's tabs over it are drawPageTabs
  drawMenuSlab(L.x, L.y, L.w, L.h, a);
  const hit = m.wikiT >= 1 && mouse.inside ? wikiHit(mouse.x, mouse.y) : null;
  // the tab bar: the open page in gold over a gold underline, the rest dim
  // until hovered - the underline is the whole "you are here"
  for (let i = 0; i < L.tabs.length; i++) {
    const t = L.tabs[i], active = i === m.wikiTab;
    const col = active ? '#ffd95c' : hit && hit.kind === 'tab' && hit.i === i ? '#cfe0ff' : '#7a8bb8';
    drawPixelTextShadow(ctx, t.label, Math.round(t.x + (t.w - pixelTextWidth(t.label)) / 2), t.y, col, 'rgba(8,12,28,0.9)');
    if (active) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(t.x + 4, t.y + 8, t.w - 8, 1); }
  }
  ctx.fillStyle = '#2c3a68';
  ctx.fillRect(L.x + 10, L.winY - 3, L.w - 20, 1);
  // the open page, clipped to the window and shifted by its scroll
  ctx.save();
  ctx.beginPath(); ctx.rect(L.x + 2, L.winY, L.w - 4, L.winH); ctx.clip();
  const level = animalLevel();
  for (const r of L.rows) {
    const bl = r.bl, y = r.y - L.scroll;
    if (y + bl.h < L.winY || y > L.winY + L.winH) continue;
    if (bl.kind === 'line') drawPixelTextShadow(ctx, bl.text, L.left, y, bl.col, '#0a0e23');
    else if (bl.kind === 'rule') drawGoldRule(L.cx, y + 3, Math.round(L.w / 2) - 24, a);
    else if (bl.kind === 'head') {
      // a section: its name in gold with a dotted rule, the column heads over
      // their columns on the same line
      drawPixelTextShadow(ctx, bl.text, L.left, y + 2, '#ffd95c', '#0a0e23');
      let rx = L.right;
      for (let i = bl.cols.length - 1; i >= 0; i--) {
        const c = bl.cols[i];
        drawPixelTextShadow(ctx, c.label, rx - pixelTextWidth(c.label), y + 2, TIP_LABEL, '#0a0e23');
        rx -= c.w;
      }
      ctx.fillStyle = '#2c3a68';
      ctx.fillRect(L.left, y + 10, L.right - L.left, 1);
    } else if (bl.kind === 'row') drawWikiRow(r, L, hit && hit.kind === 'row' && hit.id === bl.id);
    else if (bl.kind === 'cls') {
      // a class card: the body at 3x on the left (the side you play in), its
      // name and role, the three lines of its pitch, and on the right its
      // stats at level 1
      const c = CLASSES[bl.cls];
      const spr = SPRITES.champLook(bl.cls, c.look, skin(player.team)).down[0];
      ctx.drawImage(spr, L.left, y + 2, 48, 48);
      const tx = L.left + WIKI_CLS_TEXT_X;
      drawPixelTextShadow(ctx, c.name, tx, y + 4, '#ffd95c', '#0a0e23');
      drawPixelTextShadow(ctx, c.role, tx + pixelTextWidth(c.name) + 7, y + 4, TIP_LABEL, '#0a0e23');
      c.blurb.forEach((t, k) => drawPixelTextShadow(ctx, t, tx, y + 14 + k * 8, k ? TIP_DIM : '#cfe0ff', '#0a0e23'));
      const lx = L.right - 24;
      WIKI_STATS.forEach((key, k) => {
        const s = STATS.find((q) => q.key === key), ry = y + 4 + k * 8, v = s.fmt(statFrom(bl.cls, 1, null, key));
        drawPixelTextShadow(ctx, s.name, lx - pixelTextWidth(s.name), ry, TIP_LABEL, '#0a0e23');
        drawPixelTextShadow(ctx, v, L.right - pixelTextWidth(v), ry, '#f4f7ff', '#0a0e23');
      });
    } else if (bl.kind === 'story') {
      // the hero's story under its card, hung off a thin rule like a quote
      const tx = L.left + WIKI_CLS_TEXT_X;
      ctx.fillStyle = '#2c3a68'; ctx.fillRect(tx - 5, y + 1, 1, bl.h - 6);
      bl.lines.forEach((t, k) => drawPixelTextShadow(ctx, t, tx, y + 1 + k * 8, WIKI_STORY_INK, '#0a0e23'));
    } else if (bl.kind === 'ab') {
      // an ability: its key on a plate, its icon in a well (the strip's
      // own), its name, the two numbers in the columns, and what it does
      // (key -1 is the hero's passive: no key, no numbers, its own icon)
      const ab = bl.i < 0 ? HERO_PASSIVE[CLASSES[bl.cls].passive] : abOptions(bl.cls, bl.i)[bl.k | 0];
      const hot = hit && hit.kind === 'ab' && hit.cls === bl.cls && hit.i === bl.i && (hit.k | 0) === (bl.k | 0);
      const iy = y + 1, wx = L.left + 10;
      ctx.fillStyle = '#0a0e23'; ctx.fillRect(L.left, iy + 12, 7, 8);
      ctx.fillStyle = '#1c2750'; ctx.fillRect(L.left + 1, iy + 13, 5, 6);
      drawPixelText(ctx, bl.i < 0 ? 'P' : String(bl.i + 1), L.left + 2, iy + 14, '#ffd95c');
      ctx.fillStyle = hot ? '#7a8bb8' : '#0a0e23'; ctx.fillRect(wx - 1, iy - 1, 34, 34);
      ctx.fillStyle = BAG_WELL; ctx.fillRect(wx, iy, 32, 32);
      ctx.drawImage(bl.i < 0 ? passiveIcon(bl.cls) : classAbIcon(bl.cls, bl.i, bl.k), wx, iy);
      const tx = wx + 37;
      drawPixelTextShadow(ctx, ab.name, tx, y + 4, hot ? '#ffd95c' : '#f4f7ff', '#0a0e23');
      let rx = L.right, firstX = rx;
      for (let k = bl.cols.length - 1; k >= 0; k--) {
        const col = bl.cols[k], v = col.get(ab), vw = pixelTextWidth(v);
        drawPixelTextShadow(ctx, v, rx - vw, y + 4, '#f4f7ff', '#0a0e23');
        firstX = rx - vw;
        rx -= col.w;
      }
      ctx.fillStyle = '#2c3560';
      for (let px = tx + pixelTextWidth(ab.name) + 3; px < firstX - 3; px += 2) ctx.fillRect(px, y + 8, 1, 1);
      wikiWrap(ab.blurb, L.right - tx).slice(0, 2).forEach((t, k) => drawPixelTextShadow(ctx, t, tx, y + 14 + k * 8, TIP_DIM, '#0a0e23'));
    } else if (bl.kind === 'legend') {
      // the frame, labelled: one deer, and a leader from each part of the
      // frame to what it is. Every beast on the page wears this same frame.
      // Each leader starts a clear pixel off the frame (the plate's left
      // edge, the mark's rim, the bar backing's right wall) and the three on
      // the right fan out - a column of their own each, label rows 10 px
      // apart - so no line crosses a plate, a bar or another line.
      const fx = L.left + 40, base = y + bl.h - 6;
      const spr = SPRITES.deer.right.idle[0], py = base + 2 - spr.height;
      drawWikiBeast(WIKI_BEASTS[1], fx, base, level, now);
      wikiLeader(fx - 17, py - 6, fx - 27, py - 6, 'LEVEL', '#f2cc6a');
      wikiLeader(fx + 4, py - 14, fx + 26, py - 22, 'SEES YOU', '#f4f7ff');
      wikiLeader(fx + 11, py - 7, fx + 34, py - 12, 'HEALTH', BAR_NEUTRAL);
      wikiLeader(fx + 11, py - 4, fx + 42, py - 2, 'STAMINA - A WOLF\'S LEASH', STAM_COL);
    } else if (bl.kind === 'lore') {
      // a WORLD entry: its figures on their mound in the left column, feet a
      // fixed drop under the entry's top, its name in gold and its paragraph
      const e = bl.entry, tx = L.left + WIKI_TEXT_X;
      drawWikiFig(e, L.left + (WIKI_FIG_W >> 1), y + Math.max(bl.fh, 18) + 4);
      drawPixelTextShadow(ctx, e.name, tx, y + 4, '#ffd95c', '#0a0e23');
      bl.lines.forEach((t, k) => drawPixelTextShadow(ctx, t, tx, y + 14 + k * 8, TIP_DIM, '#0a0e23'));
    } else if (bl.kind === 'beast') {
      const bs = bl.beast;
      drawWikiBeast(bs, L.left + (bl.figW >> 1), y + bl.h - 6, level, now);
      const nx = L.left + bl.figW + 8, dy = (bl.lines.length - 1) * 8; // a wrapped line pushes the table down
      drawPixelTextShadow(ctx, bs.name, nx, y + 4, '#ffd95c', '#0a0e23');
      bl.lines.forEach((t, k) => drawPixelTextShadow(ctx, t, nx, y + 13 + k * 8, TIP_DIM, '#0a0e23'));
      // the growth table: LV heads over three columns, HEALTH, KILL GOLD and
      // (a kind worth any) KILL XP under them, a dotted leader from each label to its first number
      const levels = wikiLevels(bs.kind), colW = 30, cx0 = L.right - colW * levels.length;
      levels.forEach((lv, i) => {
        const t = 'LV ' + lv;
        drawPixelTextShadow(ctx, t, cx0 + (i + 1) * colW - pixelTextWidth(t), y + 4, TIP_LABEL, '#0a0e23');
      });
      const rowsT = [['HEALTH', (lv) => String(wikiBeastHp(bs.kind, lv)), BAR_NEUTRAL], ['KILL GOLD', (lv) => String(wikiBeastGold(bs.kind, lv)), '#f2cc6a']];
      if (wikiBeastXp(bs.kind, 1)) rowsT.push(['KILL XP', (lv) => String(wikiBeastXp(bs.kind, lv)), PORT_XP_LIT]);
      rowsT.forEach(([label, get, col], k) => {
        const ry = y + 24 + dy + k * 9;
        drawPixelTextShadow(ctx, label, nx, ry, TIP_LABEL, '#0a0e23');
        let firstX = L.right;
        levels.forEach((lv, i) => {
          const v = get(lv), vw = pixelTextWidth(v), vx = cx0 + (i + 1) * colW - vw;
          if (i === 0) firstX = vx;
          drawPixelTextShadow(ctx, v, vx, ry, col, '#0a0e23');
        });
        ctx.fillStyle = '#2c3560';
        for (let px = nx + pixelTextWidth(label) + 3; px < firstX - 3; px += 2) ctx.fillRect(px, ry + 4, 1, 1);
      });
    }
  }
  ctx.restore();
  ctx.globalAlpha = a;
  drawWikiRail(L);
  drawBackHint(ctx, VIEW_W / 2, VIEW_H - 13);
  ctx.globalAlpha = 1;
}
