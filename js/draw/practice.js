'use strict';
// The practice arena's pixels, and only the arena's: the dummy and its
// meter, the training grounds, the ice parkour, the roll station, the
// archery track and its range bell. Nothing here draws in a match.
const DUMMY_SPR = (() => {
  const pal = {
    o: '#1c1208',                                        // outline
    w: '#5c4226', W: '#8a6142', v: '#b98a58',            // post + crossbar wood
    b: '#a8875a', B: '#c9a874', d: '#7a5f3d', D: '#5e4930', // burlap, lit to shaded
    r: '#5c4526', R: '#93744a',                          // rope windings
    t: '#a83232', T: '#d05548',                          // the painted ring
    s: '#f4f7ff', S: '#c4d4ea',                          // snow cap and drift
    y: '#e0c890', Y: '#f2e0a8',                          // straw
    x: '#4a3826',                                        // stitching
  };
  const rows = [
    '..........oooooo..........',
    '.........osssssso.........',
    '........obsssssSbdo.......',
    '.......oBBbbbbbbbddo......',
    '.......oBbbbbbbbbddo......',
    '.......oBbbxbbxbbddo......',
    '.......oBbbbxxbbbddo......',
    '.......odbbbbbbbbdDo......',
    '........odbbbbbbdDo.......',
    '..........orrrro..........',
    '.osWWWWWWWrrrrrrWWWWWWWso.',
    '.ovWWWWWWWrbbbbrWWWWWWWvo.',
    '.owwWWWWWWrbbbbrWWWWWWwwo.',
    '..oowwwwwWrbbbbrWwwwwwoo..',
    '.....oBBbbbbbbbbbbddo.....',
    '....oBBbbbbbbbbbbbbddo....',
    '....oBbbbbbbbbbbbbbddo....',
    '....oRrrRrrRrrRrrRrro.....',
    '....oBbbbbbttttbbbbddo....',
    '....oBbbbttbbbbttbbddo....',
    '....oBbbttbbbbbbttbddo....',
    '....oBbbtbbbTTbbbtbddo....',
    '....oBbbtbbTTTTbbtbddo....',
    '....oBbbtbbbTTbbbtbddo....',
    '....oBbbttbbbbbbttbddo....',
    '....oBbbbttbbbbttbbddo....',
    '....oBbbbbbttttbbbbddo....',
    '....oRrrRrrRrrRrrRrro.....',
    '....oBbbbxbbbbbbxbbddo....',
    '.....odbbbbbbbbbbdDo......',
    '......yodbbbbbbdoy........',
    '.......Yorrrrrroy.........',
    '..........oWwwwo..........',
    '..........oWwwwo..........',
    '..........oWwwwo..........',
    '..........oWwvwo..........',
    '..........oWwwwo..........',
    '..........oWwwwo..........',
    '........ooWWwwWWoo........',
    '......oWWwwwwwwwwWWo......',
    '....osWWwwwwwwwwwwWWso....',
    '...ssSsssssssssssssSss....',
  ];
  const c = document.createElement('canvas');
  c.width = 26; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => {
    for (let x = 0; x < 26; x++) if (pal[r[x]]) { g.fillStyle = pal[r[x]]; g.fillRect(x, y, 1, 1); }
  });
  return c;
})();
// ---- the training grounds' pixels (practice arena only) -------------------
// The archery target face, baked per-pixel rather than from a grid:
// concentric rings want true circles, and the hand-made feel comes back in
// through hash dithering on every band edge, a top-left light direction on
// every band, straw ticks around the batt, four iron pins and a dusting of
// snow on the wooden rim. Same bake-beside-the-draw rule as the chest. One
// bake, two sizes: every ring threshold scales with the face, so the small
// face is its own crisp sprite instead of a runtime downscale of the big one.
function bakeTargetFace(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const put = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const k = size / 32, cc = size / 2 - 0.5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x - cc, dy = y - cc;
    let d = Math.hypot(dx, dy);
    d += (hash2(x * 7 + 3, y * 11 + 5) - 0.5) * 0.9 * k; // hand-jitter every band edge
    if (d > 15.4 * k) continue;
    const lit = (-dx * 0.55 - dy * 0.83) > 0.5 * k;      // light from the upper left
    const h = hash2(x * 13 + 1, y * 17 + 9);
    if (d > 14.4 * k) { put(x, y, '#241a12'); continue; }              // outline
    if (d > 13.1 * k) {                                                 // wooden frame ring
      put(x, y, lit ? (h > 0.75 ? '#a3794f' : '#8a6142') : (h > 0.8 ? '#5c4226' : '#4a3421'));
      continue;
    }
    if (d > 12.5 * k) { put(x, y, '#3a2c1c'); continue; }               // the batt's shadow ring
    if (d > 9.4 * k) {                                                  // outer straw ring
      const a = Math.atan2(dy, dx);
      const tick = hash2(((a * 9) | 0) * 5 + 2, 7) > 0.6 && h > 0.45;   // radial straw grain
      put(x, y, tick ? '#c9b078' : lit ? '#ece0c2' : '#d9c9a8');
      continue;
    }
    if (d > 6.2 * k) { put(x, y, lit ? '#d0453a' : '#a83232'); continue; } // red ring
    if (d > 3.2 * k) { put(x, y, lit ? '#f0e6cc' : '#ddd0b0'); continue; } // inner cream
    put(x, y, d > 1.4 * k ? (lit ? '#d0453a' : '#b03428') : '#e05548');    // the bullseye
  }
  // four iron pins holding the batt to its frame
  const m = cc | 0, e = size - 3;
  for (const [px2, py2] of [[m, 1], [m, e], [1, m], [e, m]]) {
    g.fillStyle = '#241a12'; g.fillRect(px2, py2, 2, 2);
    g.fillStyle = '#8b93a8'; g.fillRect(px2, py2, 1, 1);
  }
  // snow settled along the top of the rim
  for (let x = (size >> 2); x < size - (size >> 2); x++) {
    if (hash2(x * 3 + 1, 51) > 0.35) {
      const y = 1 + Math.round(Math.abs(x - cc) * Math.abs(x - cc) / (60 * k));
      g.fillStyle = '#f4f7ff'; g.fillRect(x, y, 1, 1);
      if (hash2(x * 5, 53) > 0.6) { g.fillStyle = '#c4d4ea'; g.fillRect(x, y + 1, 1, 1); }
    }
  }
  return c;
}
const TARGET_SPR = bakeTargetFace(32);   // the large face
const TARGET_SPR_S = bakeTargetFace(20); // the small one (32 * AG_SIZE[0])

// The weapon rack, TWO TILES wide (the `rack` entry in js/world.js carries
// the lead/follower pair). Baked per-pixel like the target face rather than
// from a grid, because a strung bow stave wants a true curve: an A-frame of
// posts and rails with three strung longbows leaned against the top rail and
// a hung quiver of fletched shafts. Snow rides the rail and the post caps.
const RACK_SPR = (() => {
  const c = document.createElement('canvas');
  c.width = 34; c.height = 28;
  const g = c.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const O = '#241a12', wd = '#5c4226', wl = '#8a6142', wp = '#a3794f';
  // the two posts, into flared feet
  for (const x0 of [1, 29]) {
    rect(x0, 2, 4, 23, O);
    rect(x0 + 1, 3, 1, 21, wl);
    rect(x0 + 2, 3, 1, 21, wd);
    rect(x0 - 1, 24, 6, 3, O);       // the foot block
    rect(x0, 25, 4, 1, wd);
    px(x0, 25, wl);
  }
  // rails: the heavy top rail the bows lean on, a thin keeper rail below
  rect(0, 5, 34, 4, O);
  rect(1, 6, 32, 1, wl); rect(1, 7, 32, 1, wd);
  px(0, 6, wp); px(33, 6, wp);       // end-grain glints on the overhang
  rect(1, 18, 32, 3, O);
  rect(2, 19, 30, 1, wd);
  // three strung longbows, tips hooked over the top rail. The stave bends
  // left off the straight string, each with its own height and draw
  const bows = [[9, 2, 3], [16, 4, 2], [23, 2, 3]]; // centre, top y, belly
  for (const [cx2, ty0, bend] of bows) {
    rect(cx2, ty0 + 1, 1, 23 - ty0 - 1, '#f0e6cc');            // the string
    for (let y = ty0; y <= 23; y++) {                           // the stave
      const u = (y - ty0) / (23 - ty0);
      const b = Math.round(Math.sin(u * Math.PI) * bend);
      px(cx2 - b, y, '#6b4a30');
      px(cx2 - b - 1, y, '#c9a874');
    }
    rect(cx2 - bend - 1, 11, 2, 3, '#5c4226');                  // the grip wrap
  }
  // the quiver, leaned inside the right post, shafts fletched red and straw
  rect(25, 10, 4, 13, O);
  rect(26, 11, 1, 11, '#93744a'); rect(27, 11, 1, 11, '#6e4f2f');
  rect(26, 13, 2, 1, '#8b93a8');                                // iron band
  rect(26, 20, 2, 1, '#8b93a8');
  for (const [sx2, sy0, f] of [[26, 6, '#d0453a'], [28, 7, '#e0c890'], [27, 5, '#d0453a']]) {
    rect(sx2, sy0 + 2, 1, 10 - sy0, wp);                        // shaft into the mouth
    px(sx2, sy0, f); px(sx2, sy0 + 1, f);                       // the fletching
  }
  // snow: a broken run along the top rail and caps on both posts
  for (let x = 0; x < 34; x++) {
    if (hash2(x * 7, 91) > 0.45) px(x, 4, '#f4f7ff');
    if (hash2(x * 5, 93) > 0.75) px(x, 5, '#c4d4ea');
  }
  for (const x0 of [1, 29]) { rect(x0, 1, 4, 1, '#f4f7ff'); px(x0 + 3, 2, '#c4d4ea'); }
  return c;
})();

// The damage meter over a dummy's head: LAST HIT / DPS / TOTAL for the combo
// in progress, on a small frost plate in the overhead frame's language. A
// deliberate labelled-row carve-out from show-don't-label (recorded in
// CLAUDE.md beside the settings and PLAYER panels): a training instrument's
// whole job is comparing numbers, and no shape does that. Visible only while
// a combo is live, hanging on DUMMY_METER_LINGER past the mend so the final
// read stands, then fading - Shadow text throughout, since the plate rides a
// globalAlpha fade. `botY` is where the plate's bottom edge sits.
function drawDummyMeter(o, cxp, botY) {
  if (!o.mTotal) return;
  const over = o.hitT - DUMMY_RESET_T;
  const a = over <= DUMMY_METER_LINGER - 0.8 ? 1 : (DUMMY_METER_LINGER - over) / 0.8;
  if (a <= 0) return;
  const dps = Math.round(o.mTotal / Math.max(1, o.mT1 - o.mT0));
  const rows = [
    ['LAST HIT', String(Math.round(o.mLast)), '#ffd95c'],
    ['DPS',      String(dps),                 '#f4f7ff'],
    ['TOTAL',    String(Math.round(o.mTotal)), '#e0c890'],
  ];
  const W = 60, H = 25;
  const x = Math.round(cxp - W / 2), y = Math.round(botY - H);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(12,18,42,0.85)';
  ctx.fillRect(x - 1, y - 1, W + 2, H + 2);
  ctx.fillStyle = '#3a4470';
  ctx.fillRect(x, y, W, 1); ctx.fillRect(x, y + H - 1, W, 1);
  ctx.fillRect(x, y, 1, H); ctx.fillRect(x + W - 1, y, 1, H);
  for (let i = 0; i < 3; i++) {
    const ry = y + 3 + i * 7;
    drawPixelTextShadow(ctx, rows[i][0], x + 3, ry, '#9fb6d8', 'rgba(8,12,28,0.9)');
    const v = rows[i][1];
    drawPixelTextShadow(ctx, v, x + W - 3 - pixelTextWidth(v), ry, rows[i][2], 'rgba(8,12,28,0.9)');
  }
  ctx.globalAlpha = 1;
}

// ---- the ice parkour's pixels (practice arena only) -----------------------
// the start/finish line: ONE fixed-width checker band laid flat across the
// force-iced PK_LINE strip (the practice arena banner, js/world.js - the
// same box updatePractice times laps with), in the flat pass before anything
// that walks. The strip is always exactly x0..x1 whatever the roll carved,
// so the band never stretches, never gaps, and always ends at its two flags.
function drawParkourLine(ox, oy) {
  const px = PK_LINE.x0 * TILE - ox, py = PK_LINE.y * TILE - oy;
  const w = (PK_LINE.x1 - PK_LINE.x0 + 1) * TILE;
  if (px > WV_W || py > WV_H || px + w < 0 || py + TILE < 0) return;
  ctx.fillStyle = '#1c2130';
  ctx.fillRect(px, py + 3, w, 1); ctx.fillRect(px, py + 12, w, 1); // edge rails
  for (let cx2 = 0; cx2 < w; cx2 += 4) {
    for (let r = 0; r < 2; r++) {
      ctx.fillStyle = ((cx2 >> 2) + r) % 2 ? '#1c2130' : '#f4f7ff';
      ctx.fillRect(px + cx2, py + 4 + r * 4, 4, 4);
    }
  }
}

// The parkour's two readouts. The live lap clock rides over the runner's
// head while a run is on - the clock appearing at all is what says the line
// worked. Once any lap exists, BEST / LAST hang on a frost plate over the
// gate flags: the dummy meter's instrument language, and the same recorded
// labelled-row carve-out from show-don't-label (CLAUDE.md) - a stopwatch's
// whole job is comparing numbers.
function drawParkour(ex, ey, now) {
  if (parkour.on && !player.dead) {
    // above the overhead name frame, not on it - the clock and the name are
    // both centred on the player and would collide at the same row
    const t = parkour.t.toFixed(1);
    drawPixelTextOutline(ctx, t, Math.round(player.x - ex - pixelTextWidth(t) / 2),
      Math.round(player.y - ey - 42), parkour.cp ? '#8fd8ff' : '#ffd95c');
  }
  if (!parkour.best) return;
  const x0 = Math.round(PK_GATE.x - ex), y0 = Math.round(PK_GATE.y - ey);
  if (x0 < -40 || y0 < -30 || x0 > WV_W + 40 || y0 > WV_H + 30) return;
  // BEST can arrive from the profile with no lap run yet this session, so an
  // unrun LAST shows a dash rather than a meaningless 0.0
  const rows = [
    ['BEST', parkour.best.toFixed(1), '#ffd95c'],
    ['LAST', parkour.last ? parkour.last.toFixed(1) : '-', '#f4f7ff'],
  ];
  const W = 46, H = 18;
  const x = x0 - (W >> 1), y = y0 - H;
  ctx.fillStyle = 'rgba(12,18,42,0.85)';
  ctx.fillRect(x - 1, y - 1, W + 2, H + 2);
  ctx.fillStyle = '#3a4470';
  ctx.fillRect(x, y, W, 1); ctx.fillRect(x, y + H - 1, W, 1);
  ctx.fillRect(x, y, 1, H); ctx.fillRect(x + W - 1, y, 1, H);
  for (let i = 0; i < 2; i++) {
    const ry = y + 3 + i * 7;
    drawPixelTextShadow(ctx, rows[i][0], x + 3, ry, '#9fb6d8', 'rgba(8,12,28,0.9)');
    const v = rows[i][1];
    drawPixelTextShadow(ctx, v, x + W - 3 - pixelTextWidth(v), ry, rows[i][2], 'rgba(8,12,28,0.9)');
  }
}

// ---- the roll station's pixels -------------------------------------------
// One colour per difficulty, hotter with the count: green, amber, red, no
// words. PK_DIE_COL is the DIE's body in that colour (lite/body/dark for the
// cube's lighting) - the standing die wears the current track's set, and the
// roll wheel's wedges (renderWheel, js/ui.js) are the same three cubes, so
// picking a wedge visibly becomes the die. PK_PIP_COL colours the wheel's
// hovered labels.
const PK_PIP_COL = ['#7ddb7a', '#ffd95c', '#d0453a'];
const PK_DIE_COL = [
  { lite: '#aeeea9', body: '#7ddb7a', dark: '#4f9c55' },  // easy: green die
  { lite: '#ffe9a0', body: '#ffd95c', dark: '#c89a3c' },  // medium: amber die
  { lite: '#e8776a', body: '#d0453a', dark: '#8f2a24' },  // hard: red die
];
const PK_PIP_AT = [[[3, 3]], [[1, 1], [5, 5]], [[1, 5], [3, 3], [5, 1]]]; // die-face pip layouts, on an 8x8 face

// The die on its pedestal: a cube on a slate plinth with a gilt trim (the
// chest's gold - "this is worth walking to"), its whole BODY dyed the
// current track's difficulty colour with the matching pip count on its face
// - the die is the readout of what the track is. While rollT runs it
// tumbles - jitters on its plinth scrambling the face - which is the whole
// "the world just rerolled" announcement at the spot the press happened.
function drawPkDie(o, px, py, now) {
  ctx.fillStyle = 'rgba(40,60,100,0.25)'; ctx.fillRect(px + 2, py + 14, 12, 2);
  // the plinth
  ctx.fillStyle = '#242a38'; ctx.fillRect(px + 1, py + 9, 14, 6);
  ctx.fillStyle = '#454e60'; ctx.fillRect(px + 2, py + 10, 12, 4);
  ctx.fillStyle = '#5c6880'; ctx.fillRect(px + 2, py + 10, 12, 1);
  ctx.fillStyle = '#ffd95c'; ctx.fillRect(px + 2, py + 9, 2, 1); ctx.fillRect(px + 12, py + 9, 2, 1); // gilt corners
  // the die, tumbling while a roll runs
  const rolling = o.rollT > 0;
  const jx = rolling ? Math.round(Math.sin(now * 41) * 1.5) : 0;
  const jy = rolling ? Math.round(Math.cos(now * 33)) : 0;
  const dx = px + 3 + jx, dy = py - 1 + jy;
  const di = Math.max(0, PK_DIFFS.indexOf(parkour.diff));
  const C = PK_DIE_COL[di];
  ctx.fillStyle = '#241a12'; ctx.fillRect(dx - 1, dy - 1, 12, 12);
  ctx.fillStyle = C.body; ctx.fillRect(dx, dy, 10, 10);
  ctx.fillStyle = C.lite; ctx.fillRect(dx, dy, 10, 1); ctx.fillRect(dx, dy, 1, 10);
  ctx.fillStyle = C.dark; ctx.fillRect(dx + 9, dy + 1, 1, 9); ctx.fillRect(dx + 1, dy + 9, 9, 1);
  // the face: the difficulty's pip count in dark, scrambled while tumbling
  const n = rolling ? ((now * 15) | 0) % 3 : di;
  ctx.fillStyle = '#1c2130';
  for (const [ax2, ay2] of PK_PIP_AT[n]) ctx.fillRect(dx + 1 + ax2, dy + 1 + ay2, 2, 2);
}

// ---- the archery track's pixels ------------------------------------------
// The two-rail target track around the field's perimeter (AG_RECT,
// js/world.js), drawn flat in the ground pass (render.js) under everything
// that walks: ties spanning both rails like a narrow-gauge railway, then the
// outer and inner rail, snow dusted along the wood by position hash. The
// trolleys riding it are the targets themselves (drawPTarget below).
function drawAgTrack(ox, oy) {
  const R = AG_RECT, g = AG_LANE_GAP;
  const x0 = Math.round(R.x0 - ox), x1 = Math.round(R.x1 - ox);
  const y0 = Math.round(R.y0 - oy), y1 = Math.round(R.y1 - oy);
  if (x0 > WV_W || y0 > WV_H || x1 < 0 || y1 < 0) return;
  // a hollow rectangular band of thickness t whose four bars share EXACT
  // corner extents - each rail below is two of these (dark rim over the
  // ground, light wood core on top), so no bar can overhang or gap another
  const band = (bx0, by0, bx1, by1, t, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(bx0, by0, bx1 - bx0 + t, t);
    ctx.fillRect(bx0, by1, bx1 - bx0 + t, t);
    ctx.fillRect(bx0, by0, t, by1 - by0 + t);
    ctx.fillRect(bx1, by0, t, by1 - by0 + t);
  };
  // the ties first, under both rails and kept clear of the corner joins so
  // no tie ever pokes through a rail's turn
  ctx.fillStyle = '#6e4f2f';
  for (let wx = Math.round(R.x0) + g + 6; wx <= R.x1 - g - 6; wx += 14) {
    const x = wx - ox;
    if (x < -3 || x > WV_W + 3) continue;
    if (y0 > -12 && y0 < WV_H + 12) ctx.fillRect(x, y0 - 1, 2, g + 3);
    if (y1 > -12 && y1 < WV_H + 12) ctx.fillRect(x, y1 - g - 1, 2, g + 3);
  }
  for (let wy = Math.round(R.y0) + g + 6; wy <= R.y1 - g - 6; wy += 14) {
    const y = wy - oy;
    if (y < -3 || y > WV_H + 3) continue;
    if (x0 > -12 && x0 < WV_W + 12) ctx.fillRect(x0 - 1, y, g + 3, 2);
    if (x1 > -12 && x1 < WV_W + 12) ctx.fillRect(x1 - g - 1, y, g + 3, 2);
  }
  // the two rails: outer on AG_RECT, inner AG_LANE_GAP inside it - each a
  // dark rim band with a light wood core, corners joining exactly
  for (const n of [0, g]) {
    band(x0 + n - 1, y0 + n - 1, x1 - n - 1, y1 - n - 1, 3, '#241a12');
    band(x0 + n, y0 + n, x1 - n, y1 - n, 1, '#8a6142');
  }
  // snow settled on the wood, keyed to world position so it never crawls
  ctx.fillStyle = '#f4f7ff';
  for (let wx = Math.round(R.x0); wx <= R.x1; wx += 5) {
    if (hash2(wx, 71) > 0.7) ctx.fillRect(wx - ox, y0, 1, 1);
    if (hash2(wx, 73) > 0.7) ctx.fillRect(wx - ox, y1, 1, 1);
  }
  for (let wy = Math.round(R.y0); wy <= R.y1; wy += 5) {
    if (hash2(75, wy) > 0.7) ctx.fillRect(x0, wy - oy, 1, 1);
    if (hash2(77, wy) > 0.7) ctx.fillRect(x1, wy - oy, 1, 1);
  }
}

// One target, whatever its habit: a rail CARRIAGE - plank body, two steel
// wheels gripping the rail along the rail's own axis (agEdge, js/world.js),
// wheels visibly turning while it rolls - then a mast sized to its face and
// planted in the body (or the hatch mouth a pop-up flips out of), then the
// face from its own baked sprite. The whole carriage lifts through a lane
// swap (the hop) and a hidden pop-up rattles on its rail for a beat before
// the face flips up. ptFace() (js/world.js) is the same geometry the arrow
// test reads, so what you see is exactly what a shot can hit.
function drawPTarget(t, ex, ey, now) {
  if (t.gone) return; // shot this very frame; the sweep collects it next tick
  const vert = agEdge(t.s) % 2 === 1; // side rails run vertically
  // the lane hop: the carriage lifts off its rail through a swap
  const hd = Math.abs(t.lane - t.laneU);
  const hop = hd > 0.01 ? Math.round(Math.sin(Math.PI * (1 - hd)) * 3) : 0;
  const gy = Math.round(t.y - ey);       // the rail line
  const bx = Math.round(t.x - ex), by = gy - hop;
  // the pre-rise rattle: a hidden pop-up shudders side to side on its rail
  let rx = 0;
  if (t.kind === 'pop' && t.up <= 0) {
    const C = t.pop || PT_POP;
    const u = t.t % (C.hide + C.rise + C.hold + C.sink);
    if (C.hide - u < 0.35) rx = Math.round(Math.sin(t.t * 42));
  }
  // shadow on the ground (never lifted - the hop reads against it)
  ctx.fillStyle = 'rgba(40,60,100,0.28)';
  ctx.fillRect(bx - 5, gy + 2, 11, 2);
  // the wheels, seated on the rail along its axis; spoke glints alternate
  // with track distance, so a rolling carriage's wheels visibly turn
  const wf = t.spd > 0 ? ((t.s / 5) | 0) % 2 : 0;
  const wheel = (wx, wy) => {
    ctx.fillStyle = '#241a12'; ctx.fillRect(wx, wy, 3, 3);
    ctx.fillStyle = '#3c4250'; ctx.fillRect(wx + 1, wy + 1, 1, 1);
    ctx.fillStyle = '#8b93a8';
    if (wf) { ctx.fillRect(wx + 1, wy, 1, 1); ctx.fillRect(wx + 1, wy + 2, 1, 1); }
    else { ctx.fillRect(wx, wy + 1, 1, 1); ctx.fillRect(wx + 2, wy + 1, 1, 1); }
  };
  if (vert) { wheel(bx - 1 + rx, by - 8); wheel(bx - 1 + rx, by - 1); }
  else { wheel(bx - 5 + rx, by - 1); wheel(bx + 2 + rx, by - 1); }
  // the plank body, over the wheels
  ctx.fillStyle = '#241a12'; ctx.fillRect(bx - 6 + rx, by - 6, 13, 5);
  ctx.fillStyle = '#6b4a30'; ctx.fillRect(bx - 5 + rx, by - 5, 11, 3);
  ctx.fillStyle = '#8a6142'; ctx.fillRect(bx - 5 + rx, by - 5, 11, 1);
  if (t.kind === 'pop') {
    // the mouth the face flips up out of
    ctx.fillStyle = '#1c1208'; ctx.fillRect(bx - 4 + rx, by - 5, 9, 2);
  } else {
    // the mast: sized to its face, planted in the body, overlapped by the
    // face bottom - face, mast, carriage and rail read as one built thing
    const pw = t.size ? 7 : 5;
    const px0 = bx - (pw >> 1) + rx;
    ctx.fillStyle = '#241a12'; ctx.fillRect(px0, by - 15, pw, 12);
    ctx.fillStyle = '#5c4226'; ctx.fillRect(px0 + 1, by - 14, pw - 2, 10);
    ctx.fillStyle = '#8a6142'; ctx.fillRect(px0 + 1, by - 14, 1, 10);
    if (t.broken > 0) { // the bare mast, splintered where the face was shot off
      ctx.fillStyle = '#a3794f';
      ctx.fillRect(px0, by - 17, 1, 2); ctx.fillRect(px0 + pw - 2, by - 18, 1, 3); ctx.fillRect(px0 + (pw >> 1), by - 16, 1, 1);
    }
  }
  if (t.broken > 0) return;
  // the face itself, from its own size's baked sprite (wob is the only
  // runtime scaling left - spawn/respawn bounce and the pop-up's lock-up)
  const spr = t.size ? TARGET_SPR : TARGET_SPR_S;
  const rise = t.kind === 'pop' ? Math.max(0, Math.min(1, t.up)) : 1;
  if (rise <= 0.02) return;
  const wobS = t.wob > 0 ? 1 + Math.sin(t.wob * 22) * 0.14 * (t.wob / 0.45) : 1;
  const w = Math.round(spr.width * wobS);
  const h = Math.max(1, Math.round(spr.height * rise * wobS));
  if (t.kind === 'pop') ctx.drawImage(spr, bx - (w >> 1) + rx, by - 5 - h, w, h);
  else ctx.drawImage(spr, bx - (w >> 1), Math.round(ptFace(t).y - ey) - hop - (h >> 1), w, h);
}

// The hit-ring flash: one quick shock ring snapping out from every face
// break (agRings, js/world.js), sized to the face it came off. Rasterised
// 1px dots rather than an arc stroke, so the ring stays as crisp as the
// pixel grid; white-hot young, cooling to gold as it spreads and fades.
function drawAgRings(ex, ey) {
  for (const g of agRings) {
    const u = g.t / AG_RING_T;
    const r = 3 + (g.max - 3) * (1 - (1 - u) * (1 - u)); // eased out fast
    const cx = g.x - ex, cy = g.y - ey;
    if (cx < -20 || cy < -20 || cx > WV_W + 20 || cy > WV_H + 20) continue;
    // a dark rim pass under the lit pass - the outline-text rule: light
    // pixels on white snow are invisible without a dark edge to stand on
    ctx.globalAlpha = 1 - u;
    const n = Math.max(10, (r * 6) | 0);
    ctx.fillStyle = '#1c2130';
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r) + 1, 1, 1);
    }
    ctx.fillStyle = u < 0.45 ? '#f4f7ff' : '#ffd95c';
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ---- the range bell's pixels ---------------------------------------------
// The bell that runs the archery round: a bronze bell hung in a two-post
// frame west of the dummy, rope off the clapper. While o.ring runs (the press
// just landed, js/world.js) the bell swings on its yoke - the whole "the
// round heard you" announcement at the spot the press happened.
function drawAgBell(o, px, py, now) {
  ctx.fillStyle = 'rgba(40,60,100,0.25)'; ctx.fillRect(px + 2, py + 14, 12, 2);
  // the frame: two posts into a crossbar, snow on top
  ctx.fillStyle = '#241a12';
  ctx.fillRect(px, py - 8, 3, 24); ctx.fillRect(px + 13, py - 8, 3, 24);
  ctx.fillRect(px - 1, py - 11, 18, 4);
  ctx.fillStyle = '#5c4226';
  ctx.fillRect(px + 1, py - 7, 1, 22); ctx.fillRect(px + 14, py - 7, 1, 22);
  ctx.fillRect(px, py - 10, 16, 2);
  ctx.fillStyle = '#8a6142'; ctx.fillRect(px, py - 10, 16, 1);
  ctx.fillStyle = '#f4f7ff';
  ctx.fillRect(px - 1, py - 12, 6, 1); ctx.fillRect(px + 9, py - 12, 7, 1);
  // the bell on its yoke, swinging while the ring runs down
  const sw = o.ring > 0 ? Math.round(Math.sin(now * 21) * 2.5 * o.ring) : 0;
  const bxx = px + 5 + sw;
  ctx.fillStyle = '#241a12'; ctx.fillRect(px + 7, py - 8, 2, 2); // the hanger
  ctx.fillStyle = '#1c1208'; ctx.fillRect(bxx - 1, py - 7, 8, 8);
  ctx.fillStyle = '#c89a3c'; ctx.fillRect(bxx, py - 6, 6, 6);
  ctx.fillStyle = '#ffe9a0'; ctx.fillRect(bxx + 1, py - 6, 1, 5);
  ctx.fillStyle = '#8a6a28'; ctx.fillRect(bxx + 4, py - 5, 1, 5);
  ctx.fillStyle = '#1c1208'; ctx.fillRect(bxx - 2, py - 1, 10, 2);   // the lip
  ctx.fillStyle = '#c89a3c'; ctx.fillRect(bxx - 1, py - 1, 8, 1);
  ctx.fillStyle = '#241a12'; ctx.fillRect(bxx + 2 + (sw >> 1), py + 1, 2, 2); // the clapper
}

// The range's standing readout: BEST / LAST round score on a frost plate
// over the bell - the parkour gate plate's instrument language, the same
// recorded labelled-row carve-out (CLAUDE.md). Hidden mid-round, when the
// live top-centre plate (drawAgameUI) carries the numbers instead.
function drawAgame(ex, ey, now) {
  if (!agame.best && !agame.last) return;
  if (agame.phase !== 'off' && agame.phase !== 'end') return;
  // high enough that the E RING cap (drawBellHint, -30) never rides into it
  const x0 = Math.round((AG_BELL.tx + 0.5) * TILE - ex), y0 = Math.round(AG_BELL.ty * TILE - ey - 38);
  if (x0 < -40 || y0 < -30 || x0 > WV_W + 40 || y0 > WV_H + 30) return;
  const rows = [
    ['BEST', agame.best ? String(agame.best) : '-', '#ffd95c'],
    ['LAST', agame.last ? String(agame.last) : '-', '#f4f7ff'],
  ];
  const W = 46, H = 18;
  const x = x0 - (W >> 1), y = y0 - H;
  ctx.fillStyle = 'rgba(12,18,42,0.85)';
  ctx.fillRect(x - 1, y - 1, W + 2, H + 2);
  ctx.fillStyle = '#3a4470';
  ctx.fillRect(x, y, W, 1); ctx.fillRect(x, y + H - 1, W, 1);
  ctx.fillRect(x, y, 1, H); ctx.fillRect(x + W - 1, y, 1, H);
  for (let i = 0; i < 2; i++) {
    const ry = y + 3 + i * 7;
    drawPixelTextShadow(ctx, rows[i][0], x + 3, ry, '#9fb6d8', 'rgba(8,12,28,0.9)');
    const v = rows[i][1];
    drawPixelTextShadow(ctx, v, x + W - 3 - pixelTextWidth(v), ry, rows[i][2], 'rgba(8,12,28,0.9)');
  }
}

// Off-screen targets: while the round runs, every live face outside the view
// gets a chevron pinned to the screen edge on the line from the archer to it
// - the shooter's off-screen threat marker - and nothing at all while every
// face is in view, so a full field stays clean. Eight 7x7 pixel arrowheads
// (a filled triangle for the four sides, a corner triangle for the four
// diagonals - the same two masks turned) baked once with a 1px dark rim, in
// the round's gold; the tip rests AG_MARK_INSET px in from the edge, and a
// marker that would land under the TIME/SCORE plate drops beneath it, one
// that would land on the minimap steps off its disc, and one that would land
// on the hud strip rises above it - the chrome is never covered.
const AG_MARK_INSET = 6;
const AG_MARK_SIDE = [   // pointing east; turned clockwise for S, W, N
  '.#.....',
  '.##....',
  '.###...',
  '.####..',
  '.###...',
  '.##....',
  '.#.....',
];
const AG_MARK_CORNER = [ // pointing north-east; turned clockwise for SE, SW, NW
  '..#####',
  '...####',
  '....###',
  '.....##',
  '......#',
  '.......',
  '.......',
];
let agMarkCv = null; // the 8-frame atlas, 9x9 a frame, baked on first use
function agMarkAtlas() {
  if (agMarkCv) return agMarkCv;
  const turn = (g) => g.map((_, r) => g.map((_, c) => g[6 - c][r]).join('')); // 90 degrees clockwise
  const E = AG_MARK_SIDE, NE = AG_MARK_CORNER;
  const S = turn(E), W = turn(S), N = turn(W);
  const SE = turn(NE), SW = turn(SE), NW = turn(SW);
  const frames = [E, SE, S, SW, W, NW, N, NE]; // index = round(angle / 45 deg), screen y down
  const cv = document.createElement('canvas');
  cv.width = 9 * 8; cv.height = 9;
  const g = cv.getContext('2d');
  frames.forEach((m, i) => {
    const ox = i * 9 + 1;
    // the rim first, the mask stamped at the eight neighbours, then the fill
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.fillStyle = '#0f1632';
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (m[r][c] === '#') g.fillRect(ox + c + dx, 1 + r + dy, 1, 1);
    }
    g.fillStyle = '#ffd95c';
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (m[r][c] === '#') g.fillRect(ox + c, 1 + r, 1, 1);
  });
  agMarkCv = cv;
  return cv;
}
function drawAgMarkers() {
  const px = wToSX(player.x), py = wToSY(player.y - 8); // the archer's chest, in view px
  const x0 = AG_MARK_INSET, y0 = AG_MARK_INSET, x1 = VIEW_W - 1 - AG_MARK_INSET, y1 = VIEW_H - 1 - AG_MARK_INSET;
  const cxm = Math.round(VIEW_W / 2), plateW = 62, plateB = 8 + 25; // drawAgameUI's plate
  const atlas = agMarkAtlas();
  for (const t of ptargets) {
    if (!ptLive(t)) continue;
    const tx = wToSX(t.x), ty = wToSY(t.y - 12); // the face, not the rail
    const m = 10 * zoomCur; // a face half in view counts as in view: no marker
    if (tx >= -m && tx <= VIEW_W + m && ty >= -m && ty <= VIEW_H + m) continue;
    const dx = tx - px, dy = ty - py;
    if (!dx && !dy) continue;
    // where the archer-to-face line leaves the inset rect
    let s = Infinity;
    if (dx > 0) s = Math.min(s, (x1 - px) / dx); else if (dx < 0) s = Math.min(s, (x0 - px) / dx);
    if (dy > 0) s = Math.min(s, (y1 - py) / dy); else if (dy < 0) s = Math.min(s, (y0 - py) / dy);
    if (!(s > 0) || s === Infinity) continue;
    let mx = Math.max(x0, Math.min(x1, px + dx * s)), my = Math.max(y0, Math.min(y1, py + dy * s));
    if (my < plateB + 4 && Math.abs(mx - cxm) < (plateW >> 1) + 6) my = plateB + 4;
    // the minimap (top-right, with its clock row underneath): a marker inside
    // its square slides along the edge it is on - down past the clock row if
    // it came off the right edge, left past the disc if it came off the top
    const mq = MM_R + 8;
    if (Math.abs(mx - MM_CX) < mq && my < MM_CY + mq + 12) {
      if (mx >= x1 - 1) my = Math.max(my, MM_CY + mq + 12); else mx = MM_CX - mq - 1;
    }
    // the hud strip (bottom-centre), at the HUD SIZE it is drawn at
    const R = hudStripRect(), hs = hudSc(), top = VIEW_H - (R.h + 4) * hs;
    if (my > top - 5 && Math.abs(mx - VIEW_W / 2) < (R.w / 2 + 4) * hs + 6) my = top - 5;
    mx = Math.max(x0, Math.min(x1, mx)); my = Math.max(y0, Math.min(y1, my));
    const dir = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
    ctx.drawImage(atlas, dir * 9, 0, 9, 9, Math.round(mx) - 4, Math.round(my) - 4, 9, 9);
  }
}

// The round's live layer, drawn in UI space (render.js, after renderUI): the
// 3-2-1 countdown in the eagle drop's own big-number language, GO as the
// window opens, the TIME / SCORE / HITS plate top-centre while the clock
// runs (a practice instrument's whole job is comparing numbers - the same
// carve-out the dummy meter claims), and the final score standing large
// while the field resets - gold when it is a new record.
function drawAgameUI(now) {
  if (window.DBG.hideUI) return;
  const G = agame;
  if (G.phase === 'off' || G.phase === 'sink') return;
  const cxm = Math.round(VIEW_W / 2);
  if (G.phase === 'count') {
    const left = AG_COUNT_T - G.t;
    const s = String(Math.max(1, Math.ceil(left)));
    const frac = left - Math.floor(left); // each second lands with a fade
    ctx.globalAlpha = 0.45 + 0.55 * frac;
    drawPixelTextOutline(ctx, s, Math.round(cxm - pixelTextWidth(s, 4) / 2),
      Math.round(VIEW_H * 0.3), '#ffd95c', '#0f1632', 4);
    ctx.globalAlpha = 1;
    return;
  }
  if (G.phase === 'play') {
    drawAgMarkers(); // under the plate and the GO, so neither is ever covered
    if (G.t < 0.6) { // GO flashes as the window opens
      ctx.globalAlpha = Math.min(1, (0.6 - G.t) / 0.25);
      drawPixelTextOutline(ctx, 'GO', Math.round(cxm - pixelTextWidth('GO', 4) / 2),
        Math.round(VIEW_H * 0.3), '#7ddb7a', '#0f1632', 4);
      ctx.globalAlpha = 1;
    }
    const left = Math.max(0, AG_T - G.t);
    const rows = [
      ['TIME',  left.toFixed(1),  left < 5.05 ? '#ff6a5a' : '#ffd95c'],
      ['SCORE', String(G.score),  '#f4f7ff'],
      ['HITS',  String(G.hits),   '#e0c890'],
    ];
    const W = 62, H = 25;
    const x = cxm - (W >> 1), y = 8;
    ctx.fillStyle = 'rgba(12,18,42,0.85)';
    ctx.fillRect(x - 1, y - 1, W + 2, H + 2);
    ctx.fillStyle = '#3a4470';
    ctx.fillRect(x, y, W, 1); ctx.fillRect(x, y + H - 1, W, 1);
    ctx.fillRect(x, y, 1, H); ctx.fillRect(x + W - 1, y, 1, H);
    for (let i = 0; i < 3; i++) {
      const ry = y + 3 + i * 7;
      drawPixelTextShadow(ctx, rows[i][0], x + 3, ry, '#9fb6d8', 'rgba(8,12,28,0.9)');
      const v = rows[i][1];
      drawPixelTextShadow(ctx, v, x + W - 3 - pixelTextWidth(v), ry, rows[i][2], 'rgba(8,12,28,0.9)');
    }
    return;
  }
  // 'end': the final score stands while the furniture rises back
  const col = G.record ? '#ffd95c' : '#f4f7ff';
  const s = String(G.last);
  drawPixelTextOutline(ctx, 'SCORE', Math.round(cxm - pixelTextWidth('SCORE') / 2),
    Math.round(VIEW_H * 0.28), '#9fb6d8', '#0f1632');
  if (G.record) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now * 7);
  drawPixelTextOutline(ctx, s, Math.round(cxm - pixelTextWidth(s, 3) / 2),
    Math.round(VIEW_H * 0.28) + 9, col, '#0f1632', 3);
  ctx.globalAlpha = 1;
  const hs = G.lastHits + ' HITS';
  drawPixelTextOutline(ctx, hs, Math.round(cxm - pixelTextWidth(hs) / 2),
    Math.round(VIEW_H * 0.28) + 28, '#e0c890', '#0f1632');
}

// A flag: dark pole with a gilt finial, and a big red cloth streaming off it
// on the frame clock - the parkour gate's marker, in the target rings' own
// red. The cloth is a full rectangle (18 wide, 11 deep) with a swallowtail
// cut at the fly end, waving column by column with folds shaded where the
// wave crests, so it reads as heavy cloth rather than a pennant.
// the cloth: the practice gate's red, or - for the road's pennant poles,
// which carry a `team` (placeRoad, world.js) - that side's coat
const BANNER_RED = { dark: '#a83232', lit: '#d0453a', mid: '#c0392b', hem: '#e05548', seam: '#8f2a24' };
function bannerCloth(o) {
  if (o.team === undefined) return BANNER_RED;
  const t = TEAMS[skin(o.team)];
  return { dark: t.coatD, lit: t.coatL, mid: t.coat, hem: t.mark, seam: t.coatD };
}
function drawBanner(o, px, py, now) {
  const bx = px + 4, top = py - 18;
  const cl = bannerCloth(o);
  ctx.fillStyle = 'rgba(40,60,100,0.25)'; ctx.fillRect(bx - 1, py + 14, 6, 2);
  // the pole, snow at its foot
  ctx.fillStyle = '#241a12'; ctx.fillRect(bx - 1, top - 2, 4, 36);
  ctx.fillStyle = '#5c4226'; ctx.fillRect(bx, top - 1, 2, 34);
  ctx.fillStyle = '#8a6142'; ctx.fillRect(bx, top - 1, 1, 34);
  ctx.fillStyle = '#f4f7ff'; ctx.fillRect(bx - 1, py + 12, 4, 2);
  // the finial: a gilt ball on a collar
  ctx.fillStyle = '#241a12'; ctx.fillRect(bx - 1, top - 5, 4, 3);
  ctx.fillStyle = '#ffd95c'; ctx.fillRect(bx, top - 5, 2, 2);
  ctx.fillStyle = '#fff3c4'; ctx.fillRect(bx, top - 5, 1, 1);
  // the cloth, hung from the pole top, waving toward the fly
  const W = 18, H = 11;
  for (let i = 0; i < W; i++) {
    const u = i / (W - 1);
    const wave = Math.sin(now * 4.5 + i * 0.55 + o.ty) * u * 2.6;
    const y0 = top + Math.round(wave);
    // the swallowtail: the last few columns lose their middle rows
    const notch = Math.max(0, i - (W - 5));
    const gap = notch > 0 ? Math.min(H - 4, notch * 2) : 0;
    const x = bx + 3 + i;
    // fold shading rides the wave's slope: leaning columns catch the dark
    const slope = Math.cos(now * 4.5 + i * 0.55 + o.ty) * u;
    const cloth = slope < -0.35 ? cl.dark : slope > 0.45 ? cl.lit : cl.mid;
    if (gap === 0) {
      ctx.fillStyle = '#241a12'; ctx.fillRect(x, y0 - 1, 1, H + 2);
      ctx.fillStyle = cloth; ctx.fillRect(x, y0, 1, H);
      ctx.fillStyle = cl.hem; ctx.fillRect(x, y0, 1, 1); // the lit top hem
      if (i === 0 || i === 7) { ctx.fillStyle = cl.seam; ctx.fillRect(x, y0 + 1, 1, H - 1); } // seam shadows
    } else {
      const arm = ((H - gap) >> 1) + 1;
      ctx.fillStyle = '#241a12'; ctx.fillRect(x, y0 - 1, 1, arm + 1); ctx.fillRect(x, y0 + H - arm, 1, arm + 1);
      ctx.fillStyle = cloth; ctx.fillRect(x, y0, 1, arm); ctx.fillRect(x, y0 + H - arm, 1, arm);
      ctx.fillStyle = cl.hem; ctx.fillRect(x, y0, 1, 1);
    }
  }
  ctx.fillStyle = '#ffd95c'; ctx.fillRect(bx + 2, top, 1, H); // the gilt hoist stripe
  ctx.fillStyle = '#c89a3c'; ctx.fillRect(bx + 2, top + H - 2, 1, 2);
}
