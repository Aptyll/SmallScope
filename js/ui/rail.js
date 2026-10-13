'use strict';
// The team rail: every other player in the match as a chip along the top edge,
// and the anchors (railBottom, headlineY, noteY) the screens hang under it.
// ---- the team rail: the roster along the top edge ----------------------
// THE TEAM RAIL (3.33, joined into one scoreboard in 4.16, slimmed in 0.422):
// every other player in the match along the top centre, Dota's top bar kept
// clean and minimal. ONE thin plate (the hud frame's outline and flat
// ground, no bevel, no snow): your side's chips on the left, the rival's on
// the right, and between them the match clock with the kill score under
// it, each total in its side's mark. A CHIP per player: the class emblem at
// 12px (CLASS12, js/menu.js) with no rim - the side is the thin hp bar under
// it, in the side's colour (one solid run, no segments). You are not on it:
// your own hp and level are the strip's, so the rail is the other nine.
// A dead player's emblem gives way to the seconds until the bird sets them
// down again, Dota's grey portrait with its number; a chip that is never
// coming back is its emblem at LOCK_DIM. The tooltip carries the name, class
// and level of the one chip the pointer is on (tipRail). WHERE anyone is
// stays the minimap's job.
// It scales with its own TOP BAR size dial about its top-centre anchor
// (drawRailScaled), capped so the plate clears the view's edge (railSc),
// rides the intro slide down from above with the minimap, and stays up while
// you are dead - the side's state is exactly what a spectator reads.
const RAIL_CHIP = 12;               // a chip: the 12px emblem, no rim
const RAIL_BAR = 3;                 // the hp bar under a chip: 1px air, the 2px bar
const RAIL_BODY = RAIL_CHIP + RAIL_BAR;
const RAIL_GAP = 3;                 // the air between two chips
const RAIL_SEP = 6;                 // the air between a side's chips and the score well
const RAIL_CLOCK_W = 19;            // the score well's least width: M:SS up to MM:SS at 1x
const RAIL_LINE = 8;                // the clock's row to the score's row
const RAIL_WAIT = '#d4d7dc';        // a waiting chip's seconds
const RAIL_HOV = '#6a6f79';         // the outline round the chip under the pointer
const RAIL_Y = MM_GAP;              // the plate's top edge: level with the minimap's outline
const RAIL_PAD = AB_PAD;            // the plate's margin: line, light, ground
const RAIL_H = RAIL_PAD + RAIL_BODY + RAIL_PAD;
const RAIL_SLIDE = RAIL_Y + RAIL_H + 4; // how far it rises to be AWAY: the plate, the cap and the sky over it
const RAIL_TRACK = '#25282d';       // an hp bar's empty track
// the roster: your teammates then the rival's, each by id - never you.
// Null unless the rival side has a body - the practice arena has no rail.
function railSides() {
  const mine = [], theirs = [];
  for (const p of players) { if (!p.active || p === player) continue; (p.team === player.team ? mine : theirs).push(p); }
  if (!theirs.length) return null;
  const byId = (a, b) => a.id - b.id;
  mine.sort(byId); theirs.sort(byId);
  return [mine, theirs];
}
// a side's kills: every player who has worn its colour this match, a
// dropped seat's included - the scoreboard's own sum (the post-game lobby)
function railKills(team) {
  let n = 0;
  for (const p of players) if (p.team === team) n += p.kills || 0;
  return n;
}
// a side's chips and the air between them and the score well; nothing for a
// side with no one on it but you
function railChipsW(n) { return n ? n * RAIL_CHIP + (n - 1) * RAIL_GAP + RAIL_SEP : 0; }
// the plate, every chip, the two totals and the clock in 1x space, or null
// while there is no rail. The score well holds RAIL_CLOCK_W and only grows
// for a score row wider than that.
function railLayout() {
  const sides = railSides();
  if (!sides) return null;
  const teams = [player.team, sides[1][0].team];
  const kills = teams.map(railKills);
  const clock = clockTxt(state.elapsed);
  const kt = kills.map(String), kw = kt.map((t) => pixelTextWidth(t));
  const colon = pixelTextWidth(':'), scoreW = kw[0] + 2 + colon + 2 + kw[1];
  const wellW = Math.max(RAIL_CLOCK_W, pixelTextWidth(clock), scoreW);
  const w = RAIL_PAD + railChipsW(sides[0].length) + wellW + railChipsW(sides[1].length) + RAIL_PAD;
  // the score well holds the centre, so the clock never drifts when one
  // side is a chip short (yours always is: you are not on it)
  const x0 = Math.round(VIEW_W / 2 - RAIL_PAD - railChipsW(sides[0].length) - wellW / 2), y = RAIL_Y + RAIL_PAD;
  const span = 2 * Math.max(VIEW_W / 2 - x0, x0 + w - VIEW_W / 2);
  const chips = [];
  const row = (s, x) => {
    for (let j = 0; j < sides[s].length; j++) {
      chips.push({ p: sides[s][j], x: x + j * (RAIL_CHIP + RAIL_GAP), y, w: RAIL_CHIP, h: RAIL_CHIP });
    }
  };
  let x = x0 + RAIL_PAD;
  row(0, x);
  x += railChipsW(sides[0].length);
  const well = { x, y, w: wellW, h: RAIL_BODY };
  const clk = { x: x + Math.round((wellW - pixelTextWidth(clock)) / 2), y: y + 1, txt: clock };
  const sx = x + Math.round((wellW - scoreW) / 2), sy = clk.y + RAIL_LINE;
  const score = [
    { x: sx, y: sy, txt: kt[0], team: teams[0] },
    { x: sx + kw[0] + 2 + colon + 2, y: sy, txt: kt[1], team: teams[1] },
  ];
  const sep = { x: sx + kw[0] + 2, y: sy };
  x += wellW + RAIL_SEP;
  row(1, x);
  return { x: x0, w, span, plate: { x: x0, y: RAIL_Y, w, h: RAIL_H }, chips, well, score, sep, clock: clk };
}
// the size the rail is drawn at: its own dial (settings.hudRail, the stops
// hudSizes offers, js/ui/strip.js), capped on the device grid where the plate
// would reach the view's edge (railCap); no layout yet = no cap but the dial's
function railCap(L) { return L ? hudSnapDown((VIEW_W - 2 * 4) / (L.span + 2)) : HUD_MAX; }
function railSc(L) { return hudPick(settings.hudRail || 1, railCap(L)); }
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
// a chip: the emblem is the class, the bar its hp in the side's colour;
// while the body waits on the bird the emblem gives way to the seconds left,
// and a body that is never coming back keeps its emblem at LOCK_DIM
function drawRailChip(c, now, on) {
  const p = c.p, tm = TEAMS[skin(p.team)];
  const gone = p.dead && (p.eliminated || p.respawnT <= 0);
  const wait = p.dead && !gone;
  if (on) {
    ctx.fillStyle = RAIL_HOV;
    ctx.fillRect(c.x - 1, c.y - 1, c.w + 2, 1); ctx.fillRect(c.x - 1, c.y + c.h, c.w + 2, 1);
    ctx.fillRect(c.x - 1, c.y, 1, c.h); ctx.fillRect(c.x + c.w, c.y, 1, c.h);
  }
  if (wait) {
    const t = String(Math.ceil(p.respawnT));
    drawPixelText(ctx, t, c.x + Math.round((c.w - pixelTextWidth(t)) / 2), c.y + Math.round((c.h - 5) / 2), RAIL_WAIT);
  } else {
    if (gone) ctx.globalAlpha = LOCK_DIM;
    ctx.drawImage(classIcon12(p.cls, false), c.x, c.y);
    ctx.globalAlpha = 1;
  }
  // the hp bar hangs off the chip's foot: one solid run of the side's
  // colour on a dark track, no segments - a glance, not a count
  const by = c.y + c.h + 1, frac = p.dead ? 0 : Math.max(0, Math.min(1, p.hp / p.maxHp));
  ctx.fillStyle = RAIL_TRACK;
  ctx.fillRect(c.x, by, c.w, 2);
  if (frac > 0) {
    ctx.fillStyle = tm.mark;
    ctx.fillRect(c.x, by, Math.max(1, Math.round(c.w * frac)), 2);
  }
}
// the score well: the match clock, and under it the two kill totals in
// their sides' marks either side of a quiet colon
function drawRailScore(L) {
  const c = L.clock;
  drawPixelText(ctx, c.txt, c.x, c.y, '#f4f7ff');
  for (const s of L.score) drawPixelText(ctx, s.txt, s.x, s.y, TEAMS[skin(s.team)].mark);
  drawPixelText(ctx, ':', L.sep.x, L.sep.y, RAIL_HOV);
}
function drawRail(now, L) {
  const hov = mouse.inside ? railHit(mouse.x, mouse.y) : null;
  const pl = L.plate;
  drawHudFrame(pl.x, pl.y, pl.w, pl.h, { corners: { tl: true, tr: true, bl: true, br: true } });
  drawRailScore(L);
  for (const c of L.chips) drawRailChip(c, now, hov && hov.p === c.p);
}
// The rail at the size its dial holds: drawHudScaled's deal, the bake
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
  ctx.drawImage(railScaleCv, hudPx(VIEW_W / 2 - (VIEW_W / 2 - bx) * s), slideY, hudPx(bw * s), hudPx(bh * s));
}
