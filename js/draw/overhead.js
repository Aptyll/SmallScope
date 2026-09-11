'use strict';
// What every unit shares over its head and in the air: the one arrow body
// (flying, stuck, held), the overhead frame - health bar, level badge, the
// sense mark, stun stars - and the build reveal a structure grows in under.
// ---- the arrow body, shared, and the frame over every unit's head ---------
// One silhouette for every shaft in the game: the flying arrow (render.js)
// rasterises ARROW_BODY
// (js/actions.js) through this pair. hx/hy is the tip's exact (unrounded) screen position,
// i0..i1 the stretch of the body to draw (a buried head is skipped by raising
// i0), cT/cD the team feather and its dark edge, cB the bit collar, cG an
// optional shaft override (0 = the master's gold).
// DDA RASTERISATION, not per-pixel rounding: the spine advances exactly one
// pixel along the flight's dominant axis per step, so a diagonal shaft is a
// clean 8-connected staircase - no doubled cells, no gaps (rounding each
// column independently crammed 16 columns into ~11 cells at 45 deg and
// doubled four of them) - and each body column is sampled onto that chain
// (on a collision the structural pixel wins, because ARROW_BODY is
// priority-sorted at parse). The vane rows get the same treatment along the
// perpendicular, one exact pixel per row on ITS dominant axis, so no two
// rows ever collapse onto each other (plain rounding folded rows 1 and 2
// onto the same diagonal offset) and the two vanes stay mirrored at every
// bearing. At the four cardinals all of this degenerates to plain rounding,
// so straight shots are pixel-identical to the old spine-offset draw.
function arrowBodyPx(out, hx, hy, nx, ny, i0, i1, cT, cD, cB, cG) {
  const ax = nx < 0 ? -nx : nx, ay = ny < 0 ? -ny : ny, domX = ax >= ay;
  const maxA = domX ? ax : ay;
  const sx = nx < 0 ? -1 : 1, sy = ny < 0 ? -1 : 1;
  const X0 = Math.round(hx), Y0 = Math.round(hy);
  const qxs = -ny < 0 ? -1 : 1, qys = nx < 0 ? -1 : 1; // signs of the perpendicular (-ny, nx)
  for (let k = 0; k < ARROW_BODY.length; k += 3) {
    const i = ARROW_BODY[k];
    if (i < i0 || i > i1) continue;
    const j = ARROW_BODY[k + 1], key = ARROW_BODY[k + 2];
    const s = Math.round(i * maxA);
    let px, py, ox, oy;
    if (domX) { px = X0 - sx * s; py = Math.round(hy - ny * (s / ax)); }
    else      { py = Y0 - sy * s; px = Math.round(hx - nx * (s / ay)); }
    const aj = j < 0 ? -j : j, js = j < 0 ? -1 : 1;
    if (domX) { oy = js * qys * aj; ox = js * qxs * Math.round(aj * ay / ax); }
    else      { ox = js * qxs * aj; oy = js * qys * Math.round(aj * ax / ay); }
    out.push(px + ox, py + oy,
      key === 'T' ? cT : key === 'D' ? cD : key === 'B' ? cB :
      key === 'G' ? (cG || ARROW_INK.G) : ARROW_INK[key]);
  }
}
// rim first - a plus-shaped dilation of every pixel, so the whole body wears
// a 1px dark edge whatever direction it lies - then the colours over it
function paintArrowPx(px) {
  ctx.fillStyle = ARROW_RIM;
  for (let k = 0; k < px.length; k += 3) {
    const x = px[k], y = px[k + 1];
    ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1);
    ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
  }
  for (let k = 0; k < px.length; k += 3) {
    ctx.fillStyle = px[k + 2];
    ctx.fillRect(px[k], px[k + 1], 1, 1);
  }
}


// The three bars over a body are three COLOURS, never three shades of one:
//   health  - the SIDE's paint (barCol): your own side's mark over allies and
//             yourself, the rival's over everything of theirs - through
//             skin(), so allies are blue and rivals red on your screen - and
//             neutral gold (the WoW grammar) over wildlife, the dummy and
//             anything else with no team. How full it is says the rest; the
//             old green-amber-red drain spent the rival's colour on "hurt",
//             and a hurt ally read as an enemy at a glance.
//   stamina - WHITE for every side (the one bar with no side to it).
//   the draw meter - GOLD filling, PALE GOLD the instant it peaks (a single
//             white blink, DRAW_FULL_FLASH, marks the moment), slate while
//             the renock runs, heal green for a meal. Never orange: orange
//             beside a red rival bar was two warm bars, and it is fire's.
// The cursor's bow ring, the aim line and the mouse icon speak the same
// gold / pale gold (render.js, ui.js), so "full draw" is one colour everywhere.
const BAR_NEUTRAL = '#f2cc6a';
const STAM_COL = '#f4f7ff', STAM_GHOST = '#9aa4c0'; // the fill, and the dimmer chunk just spent draining into place
const DRAW_COL = '#ffd95c', DRAW_FULL_COL = '#fff3c4', DRAW_FULL_FLASH = 0.12; // s of white the peak blinks for
const NOCK_COL = '#6f7ca8', EAT_COL = '#8fe08a'; // reloading; eating (the heal colour the floater lands in)
const THREAT_COL = '#ff6a6a'; // a wolf's threat bar: the red it already wears on the debug overlay
function barCol(team) { return team === undefined || team === null ? BAR_NEUTRAL : TEAMS[skin(team)].mark; }

// small overhead bar shared by every living unit, in its side's colour
// (barCol - pass nothing for a thing with no side); col overrides it for a
// bar that is not health at all (a wolf's threat)
function drawHealthBar(cxp, topY, hp, maxHp, w, team, col) {
  const x = Math.round(cxp - w / 2), y = Math.round(topY);
  const frac = Math.max(0, Math.min(1, hp / maxHp));
  ctx.fillStyle = 'rgba(12,18,42,0.78)';
  ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = '#3a3448';
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = col || barCol(team);
  // a living thing's last sliver of hp is still a pixel; an empty charge
  // (a wolf's threat at rest, a spent jink) is bare track, not a false one
  ctx.fillRect(x, y, frac > 0 ? Math.max(1, Math.round(w * frac)) : 0, 2);
}

// The level plate: a 7-tall badge hard against a bar backing's LEFT column
// (`rx`, the column past the plate, already painted by the bar), sharing that
// one frame column and spanning the two bars stacked under it (topY..topY+6).
// Same backing and track as the bars. It sizes itself to the number and
// grows LEFT, so a two-digit level (the cap is 12) overhangs the way a stun
// plate does on the other side rather than squashing the digits. One shape
// for a hero (drawPlayer) and for a beast (drawAnimal): the number on a body
// is what it costs to take.
function drawLevelBadge(rx, topY, level) {
  const lt = String(level), lw = pixelTextWidth(lt);
  const bw = lw + 3, bx = rx - bw;
  ctx.fillStyle = 'rgba(12,18,42,0.78)';
  ctx.fillRect(bx, topY, bw, 7);
  ctx.fillStyle = '#3a3448';
  ctx.fillRect(bx + 1, topY + 1, bw - 1, 5);
  drawPixelText(ctx, lt, bx + 2, topY + 1, '#f2cc6a');
}

// The noticed mark: a "!" over a head for as long as an animal has a player
// in sight (e.senseT - seconds since it did, 0 while it does not; the prey
// and wolves banners, js/wildlife.js), in the colour of what that means -
// prey's alarm in stamina white, a wolf's in its threat red - rising out of
// the head over its first tenth of a second and gone the frame the sight is.
// It turns where the stun stars turn, and the stars win: a stunned body is
// seeing nothing. So a deer running wears the reason over its head, and one
// grazing on wears the absence of it.
function drawSenseMark(cx, topY, e, col) {
  const lift = e.senseT < 0.05 ? 2 : e.senseT < 0.1 ? 1 : 0;
  drawPixelTextOutline(ctx, '!', cx - 1, topY + lift, col, '#0f1632');
}

// Seeing stars. Three sparks on an orbit, phased off the unit's own stun
// timer so the ring keeps turning without a global clock and two stunned
// units are never in lockstep; the far half of the orbit dims, which is what
// sells it as a ring rather than three blinking dots. This is the whole
// vocabulary for the state - squashed and wide over an animal's head, round
// and tight inside the badge on a player's frame - so it reads the same
// wherever it turns up.
function drawStunStars(cx, cy, e, r, squash) {
  const a0 = -(e.stunT || 0) * 9, sq = squash === undefined ? 0.5 : squash;
  for (let i = 0; i < 3; i++) {
    const a = a0 + i * Math.PI * 2 / 3;
    ctx.fillStyle = Math.sin(a) > 0 ? '#ffb641' : '#fff3c4'; // the near half is the bright one
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * sq), 1, 1);
  }
}

// A big build's reveal: the first 12% of the timer is the staked foundation
// alone, then the sprite rises bottom-up. Shared by the draw pass (the clip)
// and updateStructures (sparks along the edge), so the two can't disagree.
function bigBuildReveal(o) {
  const spr = structSprite(o), h = spr.height;
  const p = o.buildT / o.buildTotal;
  const rows = p < 0.12 ? 0 : Math.min(h, Math.max(1, Math.round(h * (p - 0.12) / 0.86)));
  return { rows, h, edgeY: (o.ty + structH(o)) * TILE - rows };
}

// The barracks (STRUCTS.barracks, structures.js) wears the bay's sprite, so
// its overlay is the bay's geometry: the shutter over the doorway while no
// wave is rolling, the next soldier sliding down it as one does, the wave
// clock on the flank's plate filling toward the next roll-out in the side's
// paint, the beacon amber while a column is leaving, and the hp bar once hurt.
function drawBarracksOverlay(o, px, sy, now) {
  const t = STRUCTS.barracks.tiers[o.tier];
  if (o.queue > 0 && o.rollT <= 0.4) {
    const set = SPRITES.robotTeam[skin(o.team === undefined ? 0 : o.team)] || SPRITES.robot;
    const spr = set[Math.floor(now * 8) % 2];
    const k = 1 - o.rollT / 0.4;
    ctx.save();
    ctx.beginPath(); ctx.rect(px + 14, sy + 13, 20, 24); ctx.clip();
    ctx.drawImage(spr, px + 18, sy + 26 - Math.round(12 * (1 - k)));
    ctx.restore();
  }
  const shut = Math.round(23 * (1 - o.door));
  for (let i = 0; i < shut; i++) {
    ctx.fillStyle = i === shut - 1 ? '#1c2130' : (i % 3 === 2 ? '#5b6473' : '#98a1b0');
    ctx.fillRect(px + 14, sy + 13 + i, 20, 1);
  }
  ctx.fillStyle = '#1c2130'; ctx.fillRect(px + 35, sy + 23, 10, 9);
  ctx.fillStyle = '#3b4150'; ctx.fillRect(px + 36, sy + 24, 8, 2); ctx.fillRect(px + 36, sy + 28, 8, 2);
  ctx.fillStyle = TEAMS[skin(o.team === undefined ? 0 : o.team)].mark;
  ctx.fillRect(px + 36, sy + 24, Math.max(1, Math.round(8 * (1 - o.waveT / t.waveT))), 2);
  if (o.queue > 0) ctx.fillRect(px + 36, sy + 28, Math.min(8, o.queue), 2);
  const slat = sy + 17 + (Math.floor(now * 5) % 3) * 2;
  ctx.fillStyle = '#6c7486';
  ctx.fillRect(px + 5, slat, 6, 1); ctx.fillRect(px + 37, slat, 6, 1);
  ctx.fillStyle = '#1c2130'; ctx.fillRect(px + 44, sy - 4, 2, 5); ctx.fillRect(px + 42, sy - 7, 6, 4);
  ctx.fillStyle = o.queue > 0 ? (Math.floor(now * 4) % 2 ? '#ff9a3c' : '#7a3a1c') : '#6c7486';
  ctx.fillRect(px + 43, sy - 6, 4, 2);
  if (o.hp < o.maxHp) drawHealthBar(px + 24, sy - 11, o.hp, o.maxHp, 24, o.team);
}

// Everything the bay animates or reports, drawn over the baked sprite. Bay
// geometry is the sprite's: doorway cols 14-33, rows 13-35, floor row 36;
// the right flank's plain plate rows 23-29 carry the readouts.
//   roll-out - the next bot slides down the doorway over the last 0.8 s of its
//              timer, so the real one appears at the mouth mid-motion
//   shutter  - rolls down over the doorway as o.door -> 0 (guard mode)
//   pips     - one per bot: lit = alive, blinking = being built, dark = empty
//   bar      - the roll-out timer, under the pips
//   vents    - a slat flickers across each grille
//   beacon   - roof corner, amber blink while a bot is due, grey otherwise
//   hp       - a bar over the roof, only once damaged
