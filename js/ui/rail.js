'use strict';
// The team rail: every player in the match as a chip along the top edge,
// and the anchors (railBottom, headlineY, noteY) the screens hang under it.
// ---- the team rail: the roster along the top edge ----------------------
// THE TEAM RAIL (3.33, joined into one scoreboard in 4.16): every player in
// the match along the top centre, Dota's top bar kept clean and minimal.
// ONE plain plate (the hud frame's outline and flat ground, no bevel, no
// snow): your side's chips on the left, the rival's on the right, and
// between them the score - your side's kill total, the match clock, the
// rival's total - on a darker panel, each total in its
// side's mark. A CHIP per player: the class emblem at 12px (CLASS12,
// js/menu.js) in a rim painted by side through skin(), a thin hp bar under it
// in the same colour (one solid run, no segments), and you at
// the head of your side with a frost tick under your bar - there, not loud.
// A dead player's chip goes under the wells' slate with the hand walking
// round it until the bird sets them down again (drawSweepCover - the one
// shape every wait on this HUD is drawn in), and its rim is drawn back in
// behind the hand (drawRimSweep): the side's colour returns round the chip
// as the countdown runs, whole the moment they are up. A chip that is never
// coming back sits dark at LOCK_DIM. The tooltip carries the name, class and
// level of the one chip the pointer is on (tipRail). WHERE anyone is stays
// the minimap's job.
// It scales with the HUD SIZE dial about its top-centre anchor
// (drawRailScaled), capped so the plate clears the view's edge (railSc),
// rides the intro slide down from above, and stays up while
// you are dead - the side's state is exactly what a spectator reads.
const RAIL_CHIP = 14;               // a chip: the 12px emblem and its 1px rim
const RAIL_BAR = 4;                 // the hp bar under a chip: 1px air, the 2px bar, 1px air
const RAIL_BODY = RAIL_CHIP + RAIL_BAR;
const RAIL_GAP = 2;                 // the air between two chips
const RAIL_SEP = 4;                 // the air between a side's chips and the score well, and inside the well
const RAIL_KILL_W = 14;             // a kill total's cell: two digits at 2x
const RAIL_CLOCK_W = 19;            // the clock's cell: M:SS up to MM:SS at 1x
const RAIL_Y = MM_GAP;              // the plate's top edge: level with the shelf and the notice lane
const RAIL_PAD = AB_PAD;            // the plate's margin: line, light, ground
const RAIL_H = RAIL_PAD + RAIL_BODY + RAIL_PAD;
const RAIL_SLIDE = RAIL_Y + RAIL_H + 4; // how far it rises to be AWAY: the plate, the cap and the sky over it
const RAIL_YOU = HUD_FROST;         // the tick under your own bar
const RAIL_TRACK = '#1e2544';       // an hp bar's empty track
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
// a side's kills: every player who has worn its colour this match, a
// dropped seat's included - the scoreboard's own sum (the post-game lobby)
function railKills(team) {
  let n = 0;
  for (const p of players) if (p.team === team) n += p.kills || 0;
  return n;
}
function railChipsW(n) { return n * RAIL_CHIP + (n - 1) * RAIL_GAP; }
// the plate, every chip, the two totals and the clock in 1x space, or null
// while there is no rail. The score cells grow for a third digit rather
// than spill, so the layout only moves on a hundredth kill.
function railLayout() {
  const sides = railSides();
  if (!sides) return null;
  const teams = [sides[0][0].team, sides[1][0].team];
  const kills = teams.map(railKills);
  const clock = clockTxt(state.elapsed);
  const kw = kills.map((k) => Math.max(RAIL_KILL_W, pixelTextWidth(String(k), 2)));
  const cw = Math.max(RAIL_CLOCK_W, pixelTextWidth(clock));
  const wellW = 1 + RAIL_SEP + kw[0] + RAIL_SEP + cw + RAIL_SEP + kw[1] + RAIL_SEP + 1;
  const w = RAIL_PAD + railChipsW(sides[0].length) + RAIL_SEP + wellW + RAIL_SEP + railChipsW(sides[1].length) + RAIL_PAD;
  const x0 = Math.round((VIEW_W - w) / 2), y = RAIL_Y + RAIL_PAD;
  const chips = [];
  const row = (s, x) => {
    for (let j = 0; j < sides[s].length; j++) {
      chips.push({ p: sides[s][j], x: x + j * (RAIL_CHIP + RAIL_GAP), y, w: RAIL_CHIP, h: RAIL_CHIP });
    }
  };
  let x = x0 + RAIL_PAD;
  row(0, x);
  x += railChipsW(sides[0].length) + RAIL_SEP;
  const well = { x, y, w: wellW, h: RAIL_BODY };
  x += 1 + RAIL_SEP;
  const score = [{ x, w: kw[0], n: kills[0], team: teams[0] }];
  x += kw[0] + RAIL_SEP;
  const clk = { x, w: cw, txt: clock };
  x += cw + RAIL_SEP;
  score.push({ x, w: kw[1], n: kills[1], team: teams[1] });
  x += kw[1] + RAIL_SEP + 1 + RAIL_SEP;
  row(1, x);
  return { x: x0, w, plate: { x: x0, y: RAIL_Y, w, h: RAIL_H }, chips, well, score, clock: clk };
}
// the size the rail is drawn at: the one HUD scale every widget shares
// (hudSc, whole device pixels, so a 12px emblem never drops a row), capped
// on the same grid where the plate would reach the view's edge
function railSc(L) {
  return Math.min(hudSc(), hudSnapDown((VIEW_W - 2 * 4) / (L.w + 2)));
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
// A dead chip's rim drawn back in behind the respawn hand: the rim's
// pixels from twelve clockwise to where drawSweepCover's hand stands are the
// side's colour, the rest the cooldown's slate. `frac` is the wait still to
// run, the cover's own argument, so the rim and the uncovered emblem are
// always the same wedge of the chip.
function drawRimSweep(x, y, w, h, frac, lit, dim) {
  const TAU = Math.PI * 2, cx = x + w / 2, cy = y + h / 2, done = TAU * (1 - frac);
  for (let py = 0; py < h; py++) {
    const edgeRow = py === 0 || py === h - 1;
    for (let px = 0; px < w; px += edgeRow ? 1 : w - 1) {
      const a = ((Math.atan2(y + py + 0.5 - cy, x + px + 0.5 - cx) + Math.PI / 2) % TAU + TAU) % TAU;
      ctx.fillStyle = a < done ? lit : dim;
      ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
}
// a chip: the rim is the side (white under the pointer), the emblem the
// class, the bar its hp, the slate and its hand the wait for the bird, with
// the rim returning behind the hand
function drawRailChip(c, now, on) {
  const p = c.p, tm = TEAMS[skin(p.team)];
  const gone = p.dead && (p.eliminated || p.respawnT <= 0);
  const wait = p.dead && !gone;
  const total = wait ? respawnTime(p) : 0;
  const left = wait ? (total > 0 ? Math.min(1, p.respawnT / total) : 1) : 0;
  if (wait && !on) drawRimSweep(c.x, c.y, c.w, c.h, left, tm.mark, HUD_LIT);
  else {
    ctx.fillStyle = on ? '#f4f7ff' : gone ? '#232c52' : tm.mark;
    ctx.fillRect(c.x, c.y, c.w, c.h);
  }
  ctx.fillStyle = BAG_WELL;
  ctx.fillRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  if (gone) ctx.globalAlpha = LOCK_DIM;
  ctx.drawImage(classIcon12(p.cls, false), c.x + 1, c.y + 1);
  ctx.globalAlpha = 1;
  if (wait) drawSweepCover(c.x + 1, c.y + 1, c.w - 2, c.h - 2, left, CD_SWEEP, CD_EDGE);
  // the hp bar hangs off the chip's foot: one solid run of the side's
  // colour on a dark track, no segments - a glance, not a count
  const by = c.y + c.h + 1, frac = p.dead ? 0 : Math.max(0, Math.min(1, p.hp / p.maxHp));
  ctx.fillStyle = RAIL_TRACK;
  ctx.fillRect(c.x, by, c.w, 2);
  if (frac > 0) {
    ctx.fillStyle = tm.mark;
    ctx.fillRect(c.x, by, Math.max(1, Math.round(c.w * frac)), 2);
  }
  if (p === player) {
    ctx.fillStyle = RAIL_YOU;
    ctx.fillRect(c.x + c.w / 2 - 2, c.y + RAIL_BODY, 4, 1);
  }
}
// the score well: a darker panel between the two sides, the kill totals in
// their sides' marks and the match clock between them
function drawRailScore(L) {
  const wl = L.well;
  ctx.fillStyle = BAG_WELL;
  ctx.fillRect(wl.x, wl.y, wl.w, wl.h);
  const ky = wl.y + Math.round((wl.h - 10) / 2);
  for (const s of L.score) {
    const t = String(s.n);
    drawPixelText(ctx, t, s.x + Math.round((s.w - pixelTextWidth(t, 2)) / 2), ky, TEAMS[skin(s.team)].mark, 2);
  }
  const c = L.clock;
  drawPixelText(ctx, c.txt, c.x + Math.round((c.w - pixelTextWidth(c.txt)) / 2), wl.y + Math.round((wl.h - 5) / 2), '#f4f7ff');
}
function drawRail(now, L) {
  const hov = mouse.inside ? railHit(mouse.x, mouse.y) : null;
  const pl = L.plate;
  drawHudFrame(pl.x, pl.y, pl.w, pl.h, { corners: { tl: true, tr: true, bl: true, br: true } });
  drawRailScore(L);
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
  ctx.drawImage(railScaleCv, hudPx(VIEW_W / 2 - (VIEW_W / 2 - bx) * s), slideY, bw * s, bh * s);
}
