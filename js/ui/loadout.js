'use strict';
// ------------------------------------------------------------ loadout picks
// The champ select's three wells for the pre-game picks (js/sim/loadout.js),
// League's rune and spell buttons: a round CALLING well and two square TRICK
// wells, left of LOCK IN through the ban and the pick, and centred on the
// foot once your hero is locked. A click on a well opens its picker above it:
// one row of every option, the one worn lit gold, the one in your other trick
// well dim (taking it swaps the two). A hover on any of them raises its card
// (tipTrick, tipCalling). The picks are this profile's, kept per hero
// (PROFILE.loadout); a guest's go to the host as a `draft` word (draftLoadSend).
// Show, don't label: no words on the wells, the icons and the cards say it.
const LO_WELL = 22;          // a well, square (a trick's) or round (the calling's)
const LO_GAP = 6;            // the calling to the tricks
const LO_TGAP = 2;           // trick to trick
const LO_W = 3 * LO_WELL + LO_GAP + LO_TGAP;
const LO_OPT = 20, LO_OPT_G = 2, LO_PAD = 3; // the picker's cells, their air and its plate's margin

// a pick's 16 px icon (js/sprites/loadout-icons.js): kind 'trick' or 'calling'
function loIcon(kind, id) { return SPRITES[kind + '_' + id]; }
// this screen's picks on the hero it stands behind, made whole
function selLoadout() {
  const h = player.cls;
  return loadoutClean(PROFILE.loadout(CLASSES[h].name), h, DRAFT.role[localId]);
}
// the picks go with this screen's player: kept on the body for the host's
// beginDrop, and sent to the host from a guest (draftAct 'load')
function draftLoadSend() {
  const lo = selLoadout();
  player.loadout = lo;
  if (NET.isClient) NET.transport.send('host', { t: 'draft', k: 'load', h: player.cls, id: loadoutStr(lo) });
  else if (DRAFT.phase !== 'off') draftAct(localId, 'load', player.cls, loadoutStr(lo));
}
// the wells: { calling, tricks: [r, r] }, or null where the screen has no room for them
function loLayout(L) {
  if (DRAFT.phase === 'off' || DRAFT.phase === 'wait') return null;
  const y = L.play.y - 1;
  const x0 = lobbyShowcase() ? L.cx - (LO_W >> 1) : L.play.x - 10 - LO_W;
  const r = (x) => ({ x, y, w: LO_WELL, h: LO_WELL });
  return { calling: r(x0), tricks: [r(x0 + LO_WELL + LO_GAP), r(x0 + 2 * LO_WELL + LO_GAP + LO_TGAP)] };
}
// the open picker's cells over its well: [{ x, y, w, h, id }]
function loOptions(W) {
  const m = state.menu;
  if (!W || m.loPick == null) return [];
  const ids = m.loPick === 'c' ? CALLING_IDS : TRICK_IDS;
  const at = m.loPick === 'c' ? W.calling : W.tricks[m.loPick];
  const pw = ids.length * (LO_OPT + LO_OPT_G) - LO_OPT_G;
  const x0 = Math.max(4, Math.min(VIEW_W - 4 - pw, at.x + (at.w >> 1) - (pw >> 1)));
  const y = at.y - 6 - LO_PAD - LO_OPT;
  return ids.map((id, k) => ({ x: x0 + k * (LO_OPT + LO_OPT_G), y, w: LO_OPT, h: LO_OPT, id }));
}
// what the pointer is on: 'loC' / 'loT0' / 'loT1' (a well), 'loO:' + id (an
// option in the open picker), 'loP' (the picker's plate), or null
function loadoutHit(L) {
  const W = loLayout(L);
  if (!W) return null;
  const over = (r, p) => mouse.x >= r.x - p && mouse.x < r.x + r.w + p && mouse.y >= r.y - p && mouse.y < r.y + r.h + p;
  const opts = loOptions(W);
  for (const o of opts) if (over(o, 1)) return 'loO:' + o.id;
  if (opts.length) {
    const a = opts[0], b = opts[opts.length - 1];
    if (over({ x: a.x, y: a.y, w: b.x + b.w - a.x, h: a.h }, LO_PAD)) return 'loP';
  }
  if (over(W.calling, 0)) return 'loC';
  for (let i = 0; i < TRICK_N; i++) if (over(W.tricks[i], 0)) return 'loT' + i;
  return null;
}
// a press on the wells or the picker; true when it was theirs
function loadoutClick(h) {
  const m = state.menu;
  if (!h || !h.startsWith('lo')) { if (m.loPick != null) m.loPick = null; return false; }
  if (h === 'loP') return true;
  if (h === 'loC' || h === 'loT0' || h === 'loT1') {
    const want = h === 'loC' ? 'c' : +h.slice(3);
    m.loPick = m.loPick === want ? null : want;
    SFX.pickup();
    return true;
  }
  const id = h.slice(4), lo = selLoadout();
  if (m.loPick === 'c') lo.calling = id;
  else {
    const i = m.loPick, j = 1 - i;
    if (lo.tricks[j] === id) lo.tricks[j] = lo.tricks[i]; // the other well's: the two swap
    lo.tricks[i] = id;
  }
  PROFILE.setLoadout(CLASSES[player.cls].name, lo);
  draftLoadSend();
  m.loPick = null;
  SFX.place();
  return true;
}
function loadoutKey(k) {
  const m = state.menu;
  if (m.loPick == null || k !== 'escape') return false;
  m.loPick = null; SFX.pickup();
  return true;
}
// the hover's card, on the champ select
function loadoutTip(L) {
  const h = loadoutHit(L), lo = selLoadout();
  if (!h || h === 'loP') return null;
  // the card stands over the open picker's plate, else over the pick's brief above the well: never on the wells, LOCK IN beside them or the hero's own name
  const W = loLayout(L), opts = loOptions(W), B = selBrief(L);
  const well = h === 'loC' ? W.calling : h.startsWith('loT') ? W.tricks[+h.slice(3)] : null;
  const over = opts.length ? { x: opts[0].x - LO_PAD, y: opts[0].y - LO_PAD } : { x: well.x, y: B ? B.y : well.y };
  const id = h.slice(4);
  const d = h === 'loC' ? tipCalling(lo.calling) : well ? tipTrick(lo.tricks[+h.slice(3)]) : state.menu.loPick === 'c' ? tipCalling(id) : tipTrick(id);
  return d && Object.assign(d, { over });
}

// ---- the cards ------------------------------------------------------------------
// What each trick's number says, on its card: [label, unit] (TRICKS[id].pow)
const TRICK_POW = { bandage: ['HEALS', ''], torch: ['BURN', ''], bolas: ['WEAKER', '%'], bulwark: ['SHIELD', ''],
  sprint: ['FASTER', '%'], shake: ['TENACITY', '%'], cleaver: ['DAMAGE', ''] };
const CALLING_POW = { duelist: ['MORE DAMAGE', '%'], ambusher: ['DAMAGE', ''], stalwart: ['DAMAGE', ''],
  quickhand: ['MOST ATTACK SPEED', '%'], outrider: ['FASTER', '%'], warden: ['SHIELD', ''] };
// the body a card prices: yours in a match, else a level-1 one of the hero you stand behind
function loTipBody() { return state.mode === 'play' ? player : { level: 1, maxHp: statFrom(player.cls, 1, null, 'hp') }; }
function tipTrick(id) {
  const T = TRICKS[id];
  if (!T) return null;
  const p = loTipBody(), pw = TRICK_POW[id];
  const d = { title: T.name, tcol: '#f4f7ff', kind: 'COOLDOWN ' + T.cd + 'S', icon: loIcon('trick', id), plate: BAG_WELL, rim: '#3c4048', rows: [], notes: [] };
  d.rows.push([pw[0], Math.round(T.pow(p)) + pw[1], '#f4f7ff']);
  d.notes.push([T.line, TIP_DIM]);
  return d;
}
function tipCalling(id) {
  const C = CALLINGS[id];
  if (!C) return null;
  const p = loTipBody(), pw = CALLING_POW[id];
  const v = Math.round(C.pow(p));
  const d = { title: C.name, tcol: SEL_GOLD, kind: 'CALLING', icon: loIcon('calling', id), plate: BAG_WELL, rim: '#3c4048', rows: [], notes: [] };
  d.rows.push([pw[0], v + pw[1], '#f4f7ff']);
  d.notes.push([C.line, TIP_DIM]);
  return d;
}

// ---- the pixels ---------------------------------------------------------------------
function drawLoWell(r, icon, hot, open, round) {
  const rim = open ? SEL_GOLD : hot ? '#9ca1aa' : '#5a5e66';
  if (round) {
    const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
    ctx.fillStyle = rim; pxDisc(cx, cy, (r.w >> 1));
    ctx.fillStyle = BAG_WELL; pxDisc(cx, cy, (r.w >> 1) - 1);
  } else {
    ctx.fillStyle = rim; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = BAG_WELL; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  }
  if (icon) ctx.drawImage(icon, r.x + ((r.w - icon.width) >> 1), r.y + ((r.h - icon.height) >> 1));
}
function drawLoadoutPicks(L, a, hot) {
  const W = loLayout(L);
  if (!W) return;
  const m = state.menu, lo = selLoadout();
  ctx.globalAlpha = a;
  drawLoWell(W.calling, loIcon('calling', lo.calling), hot === 'loC', m.loPick === 'c', true);
  for (let i = 0; i < TRICK_N; i++) drawLoWell(W.tricks[i], loIcon('trick', lo.tricks[i]), hot === 'loT' + i, m.loPick === i, false);
  const opts = loOptions(W);
  if (!opts.length) return;
  const a0 = opts[0], b = opts[opts.length - 1];
  drawHudFrame(a0.x - LO_PAD, a0.y - LO_PAD, b.x + b.w - a0.x + 2 * LO_PAD, a0.h + 2 * LO_PAD, { corners: { tl: true, tr: true, bl: true, br: true } });
  for (const o of opts) {
    const worn = m.loPick === 'c' ? lo.calling === o.id : lo.tricks[m.loPick] === o.id;
    const other = m.loPick !== 'c' && lo.tricks[1 - m.loPick] === o.id;
    const on = hot === 'loO:' + o.id;
    ctx.globalAlpha = a;
    ctx.fillStyle = worn ? SEL_GOLD : on ? '#9ca1aa' : '#3c4048'; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = BAG_WELL; ctx.fillRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    ctx.globalAlpha = a * (other && !on ? 0.45 : 1);
    const ic = loIcon(m.loPick === 'c' ? 'calling' : 'trick', o.id);
    ctx.drawImage(ic, o.x + 2, o.y + 2);
  }
  ctx.globalAlpha = a;
}
