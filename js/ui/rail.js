'use strict';
// The team rail: every player in the match as a chip along the top edge,
// and the anchors (railBottom, headlineY, noteY) the screens hang under it.
// ---- the team rail: the roster along the top edge ----------------------
// THE TEAM RAIL (3.33): every player in the match, top centre, and nothing
// about them but whether they are UP. Two plates on the hud frame's chrome,
// your side on the left and the rival on the right, a CHIP per player: the
// class emblem at 12px (CLASS12, js/menu.js) in a rim painted by side
// through skin(), you at the head of your side with your emblem in white -
// the maps' own "you". A chip says exactly one thing. A dead player's chip
// goes under the wells' slate with the hand walking round it until the bird
// sets them down again (drawSweepCover - the one shape every wait on this
// HUD is drawn in), and a chip that is never coming back sits dark at
// LOCK_DIM. No hp, no names, no numbers: "three of us are up and two of them
// are down for a while" is counted in lit chips, and the tooltip carries the
// name, class and level of the one chip the pointer is on (tipRail). WHERE
// anyone is stays the minimap's job. The shape is what the references agree
// on - Helldivers and Fortnite stack text-free squad rows and none of the
// three puts an enemy frame on the HUD; League's one enemy read is the death
// timer, and the rail's right plate is that timer made a hand.
// It scales with the HUD SIZE dial about its top-centre anchor
// (drawRailScaled), capped so the plates clear a phone's zoom pair (railSc),
// rides the intro slide down from above with the minimap, and stays up while
// you are dead - the side's state is exactly what a spectator reads.
const RAIL_CHIP = 14;               // a chip: the 12px emblem and its 1px rim
const RAIL_GAP = 2;                 // the air between two chips
const RAIL_MID = 10;                // the air between the two sides' plates
const RAIL_Y = 3;                   // the plates' top edge: room for the snow cap
const RAIL_PAD = AB_PAD;            // the plate's margin: line, light, ground
const RAIL_H = RAIL_PAD + RAIL_CHIP + RAIL_PAD;
const RAIL_KEEP = 80;               // px a phone's zoom pair claims at the left end (and the right, for symmetry)
const RAIL_SLIDE = RAIL_Y + RAIL_H + 4; // how far it rises to be AWAY: the plates, the cap and the sky over them
// the roster: your side then the rival's, each by id, you at the head of
// yours. Null unless both sides have a body - the practice arena has no rail.
function railSides() {
  const mine = [], theirs = [];
  for (const p of players) { if (!p.active) continue; (p.team === player.team ? mine : theirs).push(p); }
  if (!mine.length || !theirs.length) return null;
  const byId = (a, b) => a.id - b.id;
  mine.sort(byId); theirs.sort(byId);
  const i = mine.indexOf(player);
  if (i > 0) { mine.splice(i, 1); mine.unshift(player); }
  return [mine, theirs];
}
function railPlateW(n) { return RAIL_PAD * 2 + n * RAIL_CHIP + (n - 1) * RAIL_GAP; }
// the plates and every chip in 1x space, or null while there is no rail
function railLayout() {
  const sides = railSides();
  if (!sides) return null;
  const w = railPlateW(sides[0].length) + RAIL_MID + railPlateW(sides[1].length);
  const x0 = Math.round((VIEW_W - w) / 2);
  const plates = [], chips = [];
  let x = x0;
  for (let s = 0; s < 2; s++) {
    const n = sides[s].length, pw = railPlateW(n);
    plates.push({ x, y: RAIL_Y, w: pw, h: RAIL_H, side: s });
    for (let j = 0; j < n; j++) {
      chips.push({ p: sides[s][j], x: x + RAIL_PAD + j * (RAIL_CHIP + RAIL_GAP), y: RAIL_Y + RAIL_PAD, w: RAIL_CHIP, h: RAIL_CHIP });
    }
    x += pw + RAIL_MID;
  }
  return { x: x0, w, plates, chips };
}
// the size the rail is drawn at: the HUD SIZE dial snapped to a whole number
// (never under 1 - a 12px emblem at 0.8 drops two of its rows, where a 34px
// well shrugs it off), capped where the plates would reach a phone's zoom
// pair or the view's edge
function railSc(L) {
  const keep = MOBILE ? RAIL_KEEP : 4;
  return Math.min(Math.max(1, Math.round(hudSc())), (VIEW_W - 2 * keep) / (L.w + 2));
}
// the rail's bottom edge in view px (0 while there is no rail): what the
// top-centre headlines - the camp plate and DAY N - hang under
function railBottom() {
  const L = railLayout();
  return L ? Math.round((RAIL_Y + RAIL_H) * railSc(L)) : 0;
}
function headlineY() { const b = railBottom(); return b ? b + 6 : 14; }
// where the top-centre notes (the camp plate, DAY N) start: under the rail,
// and under the spectate control while that is up (specLayout, screens.js)
function noteY() { return headlineY() + (state.mode === 'dead' && state.deadView === 'spec' ? SPEC_H + 4 : 0); }
function railMouse(mx, my, s) {
  return s === 1 ? { x: mx, y: my } : { x: VIEW_W / 2 + (mx - VIEW_W / 2) / s, y: my / s };
}
// the chip under the pointer, or null
function railHit(mx, my) {
  if (!hudHome()) return null;
  const L = railLayout();
  if (!L) return null;
  const m = railMouse(mx, my, railSc(L));
  for (const c of L.chips) {
    if (m.x >= c.x && m.x < c.x + c.w && m.y >= c.y && m.y < c.y + c.h) return c;
  }
  return null;
}
// a chip: the rim is the side (white under the pointer), the emblem the
// class, the slate and its hand the wait for the bird
function drawRailChip(c, now, on) {
  const p = c.p, tm = TEAMS[skin(p.team)];
  const gone = p.dead && (p.eliminated || p.respawnT <= 0);
  const wait = p.dead && !gone;
  ctx.fillStyle = on ? '#f4f7ff' : gone ? '#232c52' : wait ? '#35426e' : tm.mark;
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.fillStyle = BAG_WELL;
  ctx.fillRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  if (gone) ctx.globalAlpha = LOCK_DIM;
  ctx.drawImage(classIcon12(p.cls, p === player), c.x + 1, c.y + 1);
  ctx.globalAlpha = 1;
  if (wait) {
    const total = respawnTime(p);
    drawSweepCover(c.x + 1, c.y + 1, c.w - 2, c.h - 2, total > 0 ? Math.min(1, p.respawnT / total) : 1, CD_SWEEP, CD_EDGE);
  }
}
function drawRail(now, L) {
  const hov = mouse.inside ? railHit(mouse.x, mouse.y) : null;
  for (const pl of L.plates) {
    drawHudFrame(pl.x, pl.y, pl.w, pl.h, { corners: { tl: true, tr: true, bl: true, br: true }, seed: 41 + pl.side });
  }
  for (const c of L.chips) drawRailChip(c, now, hov && hov.p === c.p);
}
// The rail at the HUD SIZE the dial holds: drawHudScaled's deal, the bake
// blitted about the TOP-centre anchor. `slide` is the intro's 0..1 (1 away).
const railScaleCv = document.createElement('canvas');
const railScaleCtx = railScaleCv.getContext('2d');
function drawRailScaled(now, slide) {
  const L = railLayout();
  if (!L) return;
  const s = railSc(L);
  const slideY = -Math.round(slide * RAIL_SLIDE * s);
  if (s === 1) {
    ctx.save();
    ctx.translate(0, slideY);
    drawRail(now, L);
    ctx.restore();
    return;
  }
  const bx = L.x - 1, bw = L.w + 2, bh = RAIL_Y + RAIL_H + 1;
  if (railScaleCv.width !== bw || railScaleCv.height !== bh) {
    railScaleCv.width = bw; railScaleCv.height = bh;
    railScaleCtx.imageSmoothingEnabled = false;
  }
  const o = ctx;
  ctx = railScaleCtx;
  ctx.clearRect(0, 0, bw, bh);
  ctx.save();
  ctx.translate(-bx, 0);
  drawRail(now, L);
  ctx.restore();
  ctx = o;
  ctx.drawImage(railScaleCv, Math.round(VIEW_W / 2 - (VIEW_W / 2 - bx) * s), slideY, Math.round(bw * s), Math.round(bh * s));
}
