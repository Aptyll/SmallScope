'use strict';
// The two ceremonies at a match's end: the victory and the defeat, which share
// one composition (the side's stands, the emotes and the replay come from
// js/ui/screens.js, loaded just before this).

// ------------------------------------------------------------ victory
// Winning is the one thing in a match that earns a ceremony, so the screen is
// staged rather than drawn. state.deadTimer - already ticking for the death
// overlay - is the clock, and WIN_T names every beat, so the render pass and
// the sound cues read one timeline and cannot drift apart. Any press before
// the last beat skips to it (endSkip): the reward is worth watching, never
// twice. Everything here is procedural in the title screen's idiom (hash2 for
// static grain, the frame clock for flicker); the only sprites are the
// side's bodies and the coin.
const WIN_T = {
  flash: 0.30,   // the white bloom off the winning frame
  dim: 0.50,     // the backdrop has finished settling
  title: 0.45, letter: 0.07, land: 0.26, // VICTORY drops in a letter at a time
  rule: 1.10,    // the gold rule sweeps out of the middle
  stage: 1.00, stand: 0.07, // banners, dais and the side rise - each rank a beat after the last
  crown: 1.70, crownLand: 2.02,
  stats: 2.25, statStep: 0.16, roll: 0.5, // the tally, one plate at a time
  menu: 3.30,    // the planks are up and the screen is live
};
const WIN_SLIDE = 0.32; // the planks' slide, finishing exactly on WIN_T.menu
// the side on its stage: every body at 3x (WIN_BODY px square), the local
// player in the middle on a block WIN_TIER px above the mates either side of it
const WIN_BODY = 48, WIN_TIER = 8;
const WIN_BANNER_W = 36, WIN_BANNER_H = 96; // the cloth; the rail hangs above it

// the composition, in the 270-tall frame everything else is authored in
function winLayout() {
  const toy = frameTop();
  const cx = Math.round(VIEW_W / 2);
  // the stage is set from the outside in, so it breathes with the view: the
  // braziers stand as far out as the frame allows, the banners hang just
  // inside them, and the bodies take what is left with a gap between them
  // that closes on a narrow view before anything overlaps
  const brazierX = Math.min(200, cx - 14);
  const bannerX = brazierX - 36;
  const gap = Math.max(0, Math.min(6, Math.floor((bannerX - (WIN_BANNER_W >> 1) - 6 - WIN_BODY * 2.5) / 2)));
  return {
    toy, cx, brazierX, bannerX, gap,
    titleY: toy + 20,   // VICTORY / DEFEAT, 4x - 20px tall
    ruleY: toy + 44,
    bannerY: toy + 50,  // the rail the banners hang from
    stageY: toy + 138,  // the stage: the step the side stands on (the loss's drift lies here)
    statY: toy + 174,
    storyY: toy + 198,  // the three story lines (js/ui/story.js), 1x, under the plates
    plankY: toy + 226,
  };
}

// Where each body of the side stands: the roster's first entry (the local
// player) in the middle, tier px up (the win's raised block; the loss has
// none), the rest fanning out a rank at a time to the right and the left of
// it, so the line is mirrored whatever order the roster came in. y is the
// top of the 3x body box, feet sunk two rows into the snow. Both endings
// stand the side on these.
function winStands(L, ws, tier) {
  const pitch = WIN_BODY + L.gap;
  return ws.roster.map((m, i) => {
    const rank = (i + 1) >> 1, side = i & 1 ? 1 : -1;
    return {
      m, rank,
      x: L.cx + (i ? side * rank * pitch : 0) - (WIN_BODY >> 1),
      y: L.stageY + 2 - WIN_BODY - (i ? 0 : tier),
    };
  });
}

// a blend of two hex colours, f of the way from a to b: the loss's banner is
// the win's chilled toward the wash, not a second palette to keep
function mixHex(a, b, f) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  let out = '#';
  for (let s = 16; s >= 0; s -= 8) {
    const v = Math.round(((A >> s) & 255) * (1 - f) + ((B >> s) & 255) * f);
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

// the numbers the screen prints, frozen at the win. Icon plus number, no
// labels - the icon is the label. roll climbs from zero during the tally.
const WIN_STATS = [
  { icon: 'gold', roll: true, val: (w) => String(w.gold) },
  { icon: 'kills', roll: true, val: (w) => String(w.kills) },
  { icon: 'level', roll: true, val: (w) => String(w.level) },
  { icon: 'time', roll: false, val: (w) => clockTxt(w.time) },
];

// A tally's sound track: every cue inside this tick's slice of the timeline
// fires once - a plate lands with a knock, and every climbing number blips as
// it goes. Shared, because the two tallies differ only in their timeline and
// their columns. A skip jumps the clock before update() reads it, so nothing
// in the skipped span plays.
function tallyCues(t0, t1, T, stats) {
  const TICK = 0.055;
  for (let i = 0; i < stats.length; i++) {
    const s0 = T.stats + i * T.statStep;
    if (t0 < s0 && t1 >= s0) SFX.place();
    if (!stats[i].roll) continue;
    const a = Math.max(s0, Math.min(s0 + T.roll, t0));
    const b = Math.max(s0, Math.min(s0 + T.roll, t1));
    if (b > a && Math.floor((b - s0) / TICK) > Math.floor((a - s0) / TICK)) SFX.tally();
  }
}

// ...plus the one cue the tally does not own: the crown landing
function winCues(t0, t1) {
  if (!state.end) return;
  if (t0 < WIN_T.crownLand && t1 >= WIN_T.crownLand) {
    SFX.levelUp(); state.shake = Math.max(state.shake, 2.5);
  }
  tallyCues(t0, t1, WIN_T, WIN_STATS);
}

// ---- the art -------------------------------------------------------------
// A char grid painted at (x, y) with s-px cells - the shape sprites.js
// authors in, for art only this screen needs and so never earns a baked
// sprite. rim, when given, stamps a one-cell dark border under the whole
// silhouette first, so the piece reads against the aurora behind it.
function stampGrid(rows, pal, x, y, s, rim) {
  for (let pass = rim ? 0 : 1; pass < 2; pass++) {
    if (pass === 0) ctx.fillStyle = rim;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        if (!pal[row[c]]) continue;
        if (pass === 0) {
          ctx.fillRect(x + (c - 1) * s, y + r * s, s * 3, s);
          ctx.fillRect(x + c * s, y + (r - 1) * s, s, s * 3);
        } else {
          ctx.fillStyle = pal[row[c]];
          ctx.fillRect(x + c * s, y + r * s, s, s);
        }
      }
    }
  }
}

// the winner's crown: three gem-tipped spikes on a jewelled gold band
const WIN_CROWN = [
  '.w....w....w.',
  '.g....g....g.',
  'ggg..ggg..ggg',
  'hhhhhhhhhhhhh',
  'gggjggjggjggg',
  'ddddddddddddd',
];
const WIN_CROWN_PAL = { '.': null, w: '#ffffff', g: '#f2cc6a', h: '#ffedb0', j: '#7ad4ff', d: '#b8912f' };
// the stat glyphs with no sprite of their own: stacked chevrons for the hero
// level, a clock face for the match time, a podium for where a loss placed
// (gold and the bow are sprites). 'g' is the accent, 'o' the cold outline.
const WIN_ICONS = {
  level: [
    '........', '...gg...', '..g..g..', '.g....g.',
    '........', '...gg...', '..g..g..', '.g....g.',
  ],
  time: [
    '..oooo..', '.o....o.', 'o..h...o', 'o..h...o',
    'o..hhh.o', 'o......o', '.o....o.', '..oooo..',
  ],
  place: [
    '........', '...gg...', '...oo...', '.oo.oo..',
    '.oo.oo.o', '.oo.oo.o', '.oo.oo.o', 'oooooooo',
  ],
};
const WIN_ICON_PAL = { '.': null, g: '#f2cc6a', o: '#cfe0ff', h: '#ffd95c' };
const DEF_ICON_PAL = { '.': null, g: '#9fbde0', o: '#8fa8d8', h: '#cfe4f2' };
// the accent each tally is struck in: the plate rule, its landed number, and
// the palette its stamped glyphs use
const WIN_ACCENT = { rule: '#c89a3c', txt: '#ffd95c', icon: WIN_ICON_PAL };
const DEF_ACCENT = { rule: '#4a5f96', txt: '#cfe4f2', icon: DEF_ICON_PAL };

// the sky answers: three curtains across the top band, each a row of 2px
// strands riding its own sine, length breathing along it. Additive, like
// every other light in the game.
const WIN_AURORA = [
  { y: 26, amp: 10, k: 0.030, spd: 0.10, len: 30, hi: '#3ce8a0', lo: '#1f8f6a' },
  { y: 44, amp: 14, k: 0.019, spd: -0.07, len: 24, hi: '#5aa8f0', lo: '#2a5aa0' },
  { y: 16, amp: 7, k: 0.046, spd: 0.16, len: 16, hi: '#a86ce8', lo: '#5a3a90' },
];
function drawWinAurora(now, a, toy) {
  ctx.globalCompositeOperation = 'lighter';
  for (const b of WIN_AURORA) {
    for (let x = 0; x < VIEW_W; x += 2) {
      const ph = x * b.k + now * b.spd;
      const top = toy + b.y + Math.sin(ph) * b.amp + Math.sin(ph * 2.3 + 1.7) * b.amp * 0.3;
      const len = b.len * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(ph * 1.7 + 2.1)));
      const seg = Math.max(2, Math.round(len / 5));
      const shimmer = 0.6 + 0.4 * Math.sin(now * 1.7 + x * 0.05);
      for (let i = 0; i < 5; i++) {
        ctx.globalAlpha = a * 0.23 * (1 - i / 5) * shimmer;
        ctx.fillStyle = i < 2 ? b.hi : b.lo;
        ctx.fillRect(x, Math.round(top + (i * len) / 5), 2, seg);
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// light behind the winner: wedges stepped outward from a point a block at a
// time, so they stay on the pixel grid instead of being a smooth triangle
function drawWinRays(cx, cy, now, a) {
  ctx.globalCompositeOperation = 'lighter';
  const N = 10, far = Math.max(VIEW_W, VIEW_H) * 0.55;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + now * 0.09 + hash2(i, 7) * 0.5;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let d = 10; d < far; d += 2) {
      const f = d / far;
      const sz = 2 + Math.round(d * 0.06);
      ctx.globalAlpha = a * 0.075 * (1 - f) * (1 - f);
      ctx.fillStyle = i & 1 ? '#ffd95c' : '#ffb347';
      ctx.fillRect(Math.round(cx + ca * d - sz / 2), Math.round(cy + sa * d - sz / 2), sz, sz);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// gold and snow drifting down over everything: no state and no array, the
// same procedural loop the title's embers use, so a resize costs it nothing.
// cold drops the sparks out of the mix - a loss has nothing burning.
function drawWinMotes(now, a, n, cold) {
  const span = VIEW_H + 40;
  for (let i = 0; i < n; i++) {
    const h1 = hash2(i * 13 + 1, 57), h2 = hash2(i * 7 + 5, 113), h3 = hash2(i * 5 + 9, 191);
    const y = ((now * (10 + h1 * 26) + h2 * span) % span) - 20;
    const x = Math.round(h3 * (VIEW_W - 2) + Math.sin(now * (0.7 + h1) + i) * 5);
    ctx.globalAlpha = a * (0.45 + 0.5 * (0.5 + 0.5 * Math.sin(now * 3.1 + i * 2.3)));
    ctx.fillStyle = cold ? (h1 > 0.55 ? '#e8f2ff' : h1 > 0.28 ? '#b8cce6' : '#8fa8d8')
      : h1 > 0.55 ? '#ffd95c' : h1 > 0.28 ? '#ff8a3c' : '#e8f2ff';
    ctx.fillRect(x, Math.round(y), h2 > 0.78 ? 2 : 1, h2 > 0.78 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

// The confetti the crown fires: 2px flakes in the side's own colours and the
// ceremony's gold, tumbling as they fall - a flake is one px wide on the
// frames its edge is toward you, which is the whole of the tumble. Wound off
// the beat the crown landed on, so it BURSTS rather than drizzling, and
// stateless like the motes: `since` is all it is given.
function drawWinConfetti(now, since, a, tm) {
  const cols = [tm.coat, tm.coatL, tm.trim, '#ffd95c', '#ffffff', '#ff8a3c'];
  for (let i = 0; i < 96; i++) {
    const h1 = hash2(i * 9 + 1, 31), h2 = hash2(i * 3 + 7, 97), h3 = hash2(i * 11 + 5, 149);
    const d = since - h1 * 0.55; // staggered, so the burst has a front to it
    if (d <= 0) continue;
    const y = -12 + d * (20 + h2 * 46) + d * d * 6; // and it gathers speed
    if (y > VIEW_H) continue;
    const x = Math.round(h3 * (VIEW_W - 2) + Math.sin(d * (1.4 + h1 * 2) + i) * (4 + h2 * 10));
    const face = Math.abs(Math.sin(d * (5 + h1 * 6) + i)) > 0.35;
    ctx.globalAlpha = a * Math.min(1, d * 3) * Math.min(1, (VIEW_H - y) / 40);
    ctx.fillStyle = cols[Math.floor(h1 * 971) % cols.length];
    ctx.fillRect(x, Math.round(y), face ? 3 : 1, 2);
  }
  ctx.globalAlpha = 1;
}

// The crest every banner wears: an eagle displayed - the bird both sides
// ride in on - wings raised to the corners, feathers notched along their
// lower edge, tail fanned, talons spread, in the team's trim over its
// cloth. 15 x 14, stamped at 2x. 'm' the feathers, 'w' the eyes, 'g' the
// beak and the talons, 'o' the outline.
const WIN_CREST = [
  'o.....ooo.....o',
  'oo...owgwo...oo',
  'omo..ommmo..omo',
  'ommo.ommmo.ommo',
  'ommmoommmoommmo',
  'ommmmmmmmmmmmmo',
  'ommmmmmmmmmmmmo',
  'ommmmmmmmmmmmmo',
  'omomommmmmomomo',
  '.o.oommmmmoo.o.',
  '....ommmmmo....',
  '...gommmmmog...',
  '..ggomomomogg..',
  '..g.ooooooo.g..',
];
const WIN_TAIL = 12; // the swallowtail's depth, in cloth rows

// One side's banner, baked once: a gold-bordered cloth with a lit fold and
// a shaded edge, a pale chief across the top, the crest, the team's diamond
// between two gold rules, fold lines down the hang and a fringed swallowtail
// cut out of the alpha - so the live pass has only to ripple the rows. flip
// mirrors it, so the lit fold of both banners faces the middle of the stage.
// cold is the loss's: the same cloth chilled halfway to the wash, its gold
// gone to frost, moth-eaten down the hang and frayed where the tassels were.
// ti is the team PRESET (already through skin()).
function winBannerCv(ti, flip, cold) {
  const cache = winBannerCv.cache || (winBannerCv.cache = {});
  const key = ti + (flip ? 'f' : '') + (cold ? 'c' : '');
  if (cache[key]) return cache[key];
  const T = TEAMS[ti], WASH = '#141c3c';
  const C = cold ? (c) => mixHex(c, WASH, 0.5) : (c) => c;
  const tm = { coat: C(T.coat), coatL: C(T.coatL), coatD: C(T.coatD), trim: C(T.trim), trimD: C(T.trimD), mark: C(T.mark) };
  const W = WIN_BANNER_W, H = WIN_BANNER_H, half = W >> 1, CLOTH = H - 3; // 3 rows of tassel under the tips
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const px = (x, y, c, w) => { w = w || 1; g.fillStyle = c; g.fillRect(flip ? W - x - w : x, y, w, 1); };
  const GOLD = cold ? RULE_FROST.bar : '#c89a3c', GILT = cold ? RULE_FROST.hi : '#ffd95c', DARK = '#1a1430';
  for (let y = 0; y < CLOTH; y++) {
    const cut = y >= CLOTH - WIN_TAIL ? y - (CLOTH - WIN_TAIL) + 1 : 0; // the notch, widening down the tail
    const segs = cut === 0 ? [[0, W]] : [[0, half - cut], [half + cut, W - half - cut]];
    for (const seg of segs) {
      const o = seg[0], sw = seg[1];
      if (sw <= 0) continue;
      px(o, y, tm.coat, sw);
      if (o === 0) px(0, y, tm.coatL, 2); else px(o, y, tm.coatL); // the lit fold, and the notch's lit edge
      px(o + sw - 1, y, tm.coatD);                                   // the shaded edge
      for (let x = o; x < o + sw; x++) {                              // wear, sparse, on plain cloth only
        if ((y < 8 || y > 56) && hash2(x * 7 + 3, y * 11 + ti) < 0.035) px(x, y, tm.coatD);
      }
      if (cut) { // the fringe: gilt tassels off both edges of the notch, every other row
        if (y & 1) { px(o === 0 ? o + sw - 1 : o, y, GILT); px(o === 0 ? o + sw : o - 1, y + 1, GOLD); }
      }
    }
    if (y === 2) px(2, y, GOLD, W - 4);                                // the top border
    if (y >= 2 && !cut) { px(2, y, y % 6 === 1 ? GILT : GOLD); px(W - 3, y, y % 6 === 4 ? GILT : GOLD); }
    if (y >= 4 && y <= 6) px(3, y, y === 6 ? tm.trimD : tm.trim, W - 6);  // the chief
    if (y === 7) px(3, y, tm.coatD, W - 6);
    if (y === 44 || y === 52) { px(5, y, GOLD, W - 10); px(half - 3, y, GILT, 7); } // the two rules
    if (y >= 60 && y < 60 + half - 4) { // a gold chevron down the lower cloth, meeting under the rules
      const k = y - 60;
      px(3 + k, y, k & 1 ? GOLD : GILT, 2); px(W - 5 - k, y, k & 1 ? GOLD : GILT, 2);
    }
  }
  // the crest, 2px cells, over the cloth between the chief and the rules
  const CPAL = { '.': null, o: DARK, m: tm.trim, w: '#ffffff', g: '#f2cc6a' };
  for (let r = 0; r < WIN_CREST.length; r++) {
    for (let c = 0; c < WIN_CREST[r].length; c++) {
      const col = CPAL[WIN_CREST[r][c]];
      if (!col) continue;
      px(3 + c * 2, 12 + r * 2, col, 2); px(3 + c * 2, 13 + r * 2, col, 2);
    }
  }
  // the team's diamond between the rules, on a dark rim
  for (let d = -4; d <= 4; d++) { const dw = 4 - Math.abs(d); px(half - dw - 1, 48 + d, DARK, dw * 2 + 3); }
  for (let d = -3; d <= 3; d++) { const dw = 3 - Math.abs(d); px(half - dw, 48 + d, d < 0 ? tm.trim : tm.mark, dw * 2 + 1); }
  // the tips: a gilt hem, and tassels hanging off it - or, cold, a frayed one
  const tipW = half - WIN_TAIL;
  for (const o of [0, W - tipW]) {
    px(o, CLOTH - 1, GILT, tipW);
    for (let x = o; x < o + tipW; x += 2) {
      if (cold) { px(x, CLOTH, tm.coatD); continue; }
      px(x, CLOTH, GILT); px(x, CLOTH + 1, GOLD); px(x, CLOTH + 2, '#8a6a2c');
    }
  }
  if (cold) { // moth holes down the hang, bitten out of the alpha
    for (let y = 30; y < CLOTH; y++) for (let x = 3; x < W - 3; x++) {
      if (hash2(x * 13 + 5, y * 7 + ti) < 0.012) g.clearRect(x, y, 2, 2);
    }
  }
  cache[key] = cv;
  return cv;
}

// a banner hung from its rail at cx: an iron bar wider than the cloth with a
// gilt finial at each end and two rings, then the baked cloth a row at a
// time under a ripple that is pinned at the rail and swings more the lower
// it hangs, so it moves like weight rather than like a flag in a gale
function drawWinBanner(cx, top, ti, flip, a, now, cold) {
  const cv = winBannerCv(ti, flip, cold), w = cv.width, h = cv.height;
  const x = cx - (w >> 1);
  ctx.globalAlpha = a;
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(x - 6, top - 6, w + 12, 5);
  ctx.fillStyle = '#2a3560'; ctx.fillRect(x - 5, top - 5, w + 10, 3);
  ctx.fillStyle = '#4a5a90'; ctx.fillRect(x - 5, top - 5, w + 10, 1);
  for (const fx of [x - 8, x + w + 5]) {
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(fx - 1, top - 8, 5, 8);
    ctx.fillStyle = cold ? RULE_FROST.bar : '#c89a3c'; ctx.fillRect(fx, top - 7, 3, 6);
    ctx.fillStyle = cold ? RULE_FROST.hi : '#ffd95c'; ctx.fillRect(fx, top - 7, 3, 1); ctx.fillRect(fx, top - 6, 1, 3);
  }
  for (const rx of [x + 4, x + w - 6]) {
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(rx - 1, top - 3, 4, 4);
    ctx.fillStyle = '#5a6690'; ctx.fillRect(rx, top - 2, 2, 2);
  }
  for (let yy = 0; yy < h; yy++) {
    const wob = Math.round(Math.sin(now * 1.1 + yy * 0.11) * 1.6 * Math.min(1, yy / 24));
    ctx.drawImage(cv, 0, yy, w, 1, x + wob, top + yy, w, 1);
  }
  ctx.globalAlpha = 1;
}

// The stand and the empty bowl - iron pan on a stem, the title pillar's
// brazier freed from the pillar so it can flank the dais. rim is the coals
// over its lip, the only thing a lit brazier and a dead one disagree on.
// Returns the bowl's top, which is what anything above it is measured from.
function drawBrazierIron(cx, baseY, rim) {
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(cx - 2, baseY - 16, 4, 16); ctx.fillRect(cx - 7, baseY - 4, 14, 4);
  ctx.fillStyle = '#3a2a22'; ctx.fillRect(cx - 1, baseY - 15, 2, 13);
  ctx.fillStyle = '#5a4434'; ctx.fillRect(cx - 1, baseY - 15, 1, 13);
  ctx.fillStyle = '#2a3560'; ctx.fillRect(cx - 6, baseY - 3, 12, 3);
  ctx.fillStyle = '#4a5a90'; ctx.fillRect(cx - 6, baseY - 3, 12, 1);
  ctx.fillStyle = '#f4f7ff'; ctx.fillRect(cx - 6, baseY - 4, 5, 1); ctx.fillRect(cx + 2, baseY - 4, 4, 1);
  const by = baseY - 22;
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(cx - 8, by, 16, 7); ctx.fillRect(cx - 5, by + 7, 10, 1);
  ctx.fillStyle = '#3a2a22'; ctx.fillRect(cx - 7, by + 1, 14, 5);
  ctx.fillStyle = '#5a4434'; ctx.fillRect(cx - 7, by + 1, 14, 1);
  ctx.fillStyle = rim; ctx.fillRect(cx - 5, by, 10, 1);
  return by;
}

// lit: a flickering ember stack over the coals, and warm additive light
function drawWinBrazier(cx, baseY, now, a) {
  ctx.globalAlpha = a;
  const by = drawBrazierIron(cx, baseY, '#ff8a3c');
  const fl = now * 11 + cx;
  const hgt = 5 + Math.round(Math.sin(fl) + Math.sin(fl * 0.37) * 0.8);
  const rows = [[8, '#ffe37a'], [8, '#ffd95c'], [6, '#ffb347'], [4, '#ff8a3c'], [4, '#ff6a30'], [2, '#ff4a28'], [2, '#ff4a28']];
  for (let i = 0; i < Math.min(rows.length, hgt); i++) {
    const dx = i > 2 ? Math.round(Math.sin(fl * 1.3 + i * 1.7)) : 0;
    ctx.fillStyle = rows[i][1];
    ctx.fillRect(cx - (rows[i][0] >> 1) + dx, by - 1 - i, rows[i][0], 1);
  }
  drawEmbers(now, a * 0.9, cx, by - 5, 11, 7, (cx | 0) + 3);
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter';
  const gr = 66 * (1 + Math.sin(now * 9 + cx) * 0.08), gy = by - 3;
  const grd = ctx.createRadialGradient(cx, gy, 1, cx, gy, gr);
  grd.addColorStop(0, 'rgba(255,170,80,' + (0.40 * a).toFixed(3) + ')');
  grd.addColorStop(0.45, 'rgba(255,140,60,' + (0.13 * a).toFixed(3) + ')');
  grd.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = grd; ctx.fillRect(cx - gr, gy - gr, gr * 2, gr * 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// the stage: three snow-capped tiers of coursed stone - a raised block in
// the middle for the local player, the wide step the whole side stands on (hw
// is its half width) and a base a step wider again that carries a gold inlay
// with the team's diamond, icicles under its lip. top is the middle step's
// cap; the block rises WIN_TIER above it.
function drawWinDais(cx, top, hw, tm, a) {
  ctx.globalAlpha = a;
  // one tier: dark rim, speckled snow cap, lit-left coursed stone face
  const step = (y, half, h, ice) => {
    const x = cx - half, w = half * 2;
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(x - 2, y - 1, w + 4, h + 2);
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(x - 1, y, w + 2, 3);
    for (let px = 0; px < w + 2; px++) {
      const hb = hash2(px * 7 + 3, y * 5);
      if (hb > 0.82) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1 + px, y - 1, 1, 1); }
      else if (hb < 0.16) { ctx.fillStyle = '#dfe8f8'; ctx.fillRect(x - 1 + px, y + 2, 1, 1); }
    }
    ctx.fillStyle = '#b8cce6'; ctx.fillRect(x - 1, y + 3, w + 2, 1);
    ctx.fillStyle = '#2a3560'; ctx.fillRect(x, y + 4, w, h - 4);
    ctx.fillStyle = '#3a4878'; ctx.fillRect(x, y + 4, 2, h - 4);
    ctx.fillStyle = '#161d3c'; ctx.fillRect(x + w - 2, y + 4, 2, h - 4);
    for (let px = 2; px < w - 2; px++) for (let py = 5; py < h; py++) {
      if (hash2(px * 5 + py * 3, cx + 11) < 0.05) { ctx.fillStyle = '#1c2750'; ctx.fillRect(x + px, y + py, 1, 1); }
    }
    if (ice) {
      for (let px = 3; px < w - 3; px += 3) {
        const hb = hash2(px * 11 + 7, cx + y);
        if (hb < 0.5) continue;
        ctx.fillStyle = '#cfe4f2'; ctx.fillRect(x + px, y + h, 1, 2 + Math.round(hb * 3));
        ctx.fillStyle = '#f4f7ff'; ctx.fillRect(x + px, y + h, 1, 1);
      }
    }
    return { x, w };
  };
  step(top - WIN_TIER, 30, WIN_TIER + 1, false);
  step(top, hw, 10, false);
  const b = step(top + 10, hw + 14, 12, true);
  // gold inlay across the base, the team's diamond set in the middle of it
  const iy = top + 17;
  ctx.fillStyle = '#c89a3c'; ctx.fillRect(b.x + 5, iy, b.w - 10, 1);
  ctx.fillStyle = '#ffd95c'; ctx.fillRect(cx - 20, iy, 40, 1);
  for (let d = -3; d <= 3; d++) {
    const dw = 3 - Math.abs(d);
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(cx - dw - 1, iy + d, dw * 2 + 3, 1);
  }
  for (let d = -2; d <= 2; d++) {
    const dw = 2 - Math.abs(d);
    ctx.fillStyle = d < 0 ? tm.mark : tm.coatD; ctx.fillRect(cx - dw, iy + d, dw * 2 + 1, 1);
  }
  ctx.globalAlpha = 1;
}

// one number: a chamfered plate, its icon at 2x on the left, the value at
// 2x beside it. The plate pops up as it arrives and the value climbs from
// zero behind it, the rule warming on the frame it lands. T is the ending's
// timeline and ac its accent pair, so the same plate tallies a win in gold
// and a loss in frost.
function drawEndStatPlate(r, st, ws, t, i, T, ac) {
  const s0 = T.stats + i * T.statStep;
  if (t < s0) return;
  const pop = easeOut(Math.min(1, (t - s0) / 0.24));
  const y = r.y + Math.round((1 - pop) * 8);
  const roll = Math.min(1, Math.max(0, (t - s0) / T.roll));
  const txt = st.roll ? String(Math.round(Number(st.val(ws)) * roll)) : st.val(ws);
  const done = !st.roll || roll >= 1;
  ctx.globalAlpha = pop;
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; chamRect(r.x + 2, r.y + 2, r.w, r.h);
  ctx.fillStyle = '#0a0e23'; chamRect(r.x, y, r.w, r.h);
  ctx.fillStyle = '#141c3c'; chamRect(r.x + 1, y + 1, r.w - 2, r.h - 2);
  ctx.fillStyle = done ? ac.rule : '#35426e';
  ctx.fillRect(r.x + 2, y + 1, r.w - 4, 1); ctx.fillRect(r.x + 2, y + r.h - 2, r.w - 4, 1);
  const iy = y + ((r.h - 16) >> 1);
  if (st.icon === 'gold') ctx.drawImage(SPRITES.itemGold, r.x + 4, iy, 16, 16);
  else if (st.icon === 'kills') ctx.drawImage(SPRITES.itemBow, r.x + 4, iy, 16, 16);
  else stampGrid(WIN_ICONS[st.icon], ac.icon, r.x + 4, iy, 2);
  drawPixelTextShadow(ctx, txt, r.x + 24, y + ((r.h - 10) >> 1), done ? ac.txt : '#f4f7ff', '#0a0e23', 2);
  ctx.globalAlpha = 1;
}

// the tally row: n plates of one width, centred, each on its own beat
function drawEndTally(stats, ws, t, y, T, ac) {
  const pw = 24 + Math.max.apply(null, stats.map((st) => pixelTextWidth(st.val(ws), 2))) + 6;
  let sx = Math.round((VIEW_W - (stats.length * pw + (stats.length - 1) * 6)) / 2);
  for (let i = 0; i < stats.length; i++) {
    drawEndStatPlate({ x: sx, y, w: pw, h: 22 }, stats[i], ws, t, i, T, ac);
    sx += pw + 6;
  }
}

function renderVictory(now) {
  const ws = state.end || (state.end = endSnapshot());
  const t = state.deadTimer;
  const L = winLayout();
  const ti = skin(ws.team), tm = TEAMS[ti];
  const dim = Math.min(1, t / WIN_T.dim);

  // --- backdrop: wash, aurora, rays, vignette, flurry ---------------------
  ctx.fillStyle = 'rgba(7,10,26,' + (0.88 * dim).toFixed(3) + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawWinAurora(now, dim, L.toy);
  drawWinRays(L.cx, L.stageY - 32, now, dim);
  const vg = ctx.createRadialGradient(L.cx, L.toy + 120, VIEW_H * 0.22, L.cx, L.toy + 120, VIEW_W * 0.62);
  vg.addColorStop(0, 'rgba(3,5,16,0)');
  vg.addColorStop(1, 'rgba(3,5,16,' + (0.85 * dim).toFixed(3) + ')');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawWinMotes(now, dim, 52);

  // the white bloom off the last frame of the match, over the wash
  if (t < WIN_T.flash) {
    ctx.globalAlpha = Math.min(1, 1 - t / WIN_T.flash);
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }

  // --- the stage: braziers, banners, the dais and the side on it ----------
  const rise = easeOut(Math.max(0, Math.min(1, (t - WIN_T.stage) / 0.55)));
  if (rise > 0) {
    const lift = Math.round((1 - rise) * 26);
    drawWinBrazier(L.cx - L.brazierX, L.stageY + 14, now, rise);
    drawWinBrazier(L.cx + L.brazierX, L.stageY + 14, now, rise);
    drawWinBanner(L.cx - L.bannerX, L.bannerY - lift, ti, true, rise, now);
    drawWinBanner(L.cx + L.bannerX, L.bannerY - lift, ti, false, rise, now);
    const stands = winStands(L, ws, WIN_TIER);
    const ranks = stands.length >> 1;
    drawWinDais(L.cx, L.stageY + lift, ranks * (WIN_BODY + L.gap) + (WIN_BODY >> 1) + 8, tm, rise);
    // every body of the side, outer ranks first and the local player last: 3x,
    // each breathing on its own beat, its
    // name over its head - the local player's a row higher, clear of its crown
    let bobMe = 0, crownOff = false;
    for (let k = stands.length - 1; k >= 0; k--) {
      const s = stands[k];
      const sr = easeOut(Math.max(0, Math.min(1, (t - WIN_T.stage - s.rank * WIN_T.stand) / 0.55)));
      if (sr <= 0) continue;
      const set = SPRITES.champLook(s.m.cls, s.m.look, ti);
      const ph = now * 2.2 + k * 1.3;
      const bob = Math.round(Math.sin(ph) * 1.5);
      // the local player performs what the player asked for; the mates
      // celebrate on their own once the crown is down (the `emotes` banner)
      const act = k === 0 ? emoteNow(now) : (t > WIN_T.crownLand ? emoteAmbient(k, now) : null);
      const pose = act ? act.e.up(set, act.f) : null;
      // how far over its own head the pose reaches - the cheer's hoist frame
      // is four rows taller than the body plan and hops on top of that - so
      // the name and the crown ride clear of it instead of through it
      const lift = pose ? (pose.spr.height - 16) * 3 + (pose.dy || 0) : 0;
      if (k === 0) { bobMe = pose ? -lift : bob; crownOff = !!(pose && pose.low); }
      const by = s.y + Math.round((1 - sr) * 26) + (pose ? 0 : bob);
      ctx.globalAlpha = sr;
      if (pose) {
        drawEndBody(pose.spr, s.x + (pose.dx || 0), by + WIN_BODY - (pose.dy || 0));
        if (pose.puff) drawSnowPuff(s.x + (WIN_BODY >> 1), by + WIN_BODY, pose.puff, sr);
      } else {
        ctx.drawImage(set.down[Math.sin(ph) > 0.6 ? 1 : 0], s.x, by, WIN_BODY, WIN_BODY);
      }
      drawPixelTextOutline(ctx, s.m.name, centreTextX(s.x + (WIN_BODY >> 1), s.m.name), by - (k ? 8 : 13) - lift, tm.mark, '#0f1632');
      ctx.globalAlpha = 1;
      // the snow it kicks up arriving on the stage, on its own rank's beat
      const land = WIN_T.stage + s.rank * WIN_T.stand + 0.55;
      if (t > land && t < land + 0.45) drawSnowPuff(s.x + (WIN_BODY >> 1), s.y + WIN_BODY, (t - land) / 0.45, 1);
    }
    // the crown, dropped onto the local player's head
    const ct = (t - WIN_T.crown) / (WIN_T.crownLand - WIN_T.crown);
    if (ct > 0) {
      const e = Math.min(1, ct);
      const cy = Math.round(stands[0].y + 1 + (ct >= 1 ? bobMe : 0) - (1 - e * e) * 70);
      // ...and it comes off the moment the head it sits on goes into the
      // snow: it lies on the block beside the body until that body is up
      stampGrid(WIN_CROWN, WIN_CROWN_PAL, L.cx - 13 - (crownOff ? 26 : 0),
        (crownOff ? stands[0].y + 36 : cy) + (ct > 1 && ct < 1.25 ? 1 : 0), 2, '#3c2a1e');
      if (ct >= 1 && ct < 1.6) { // a ring of sparks off the landing
        const f = (ct - 1) / 0.6;
        ctx.globalAlpha = 1 - f;
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 2, rr = 6 + f * 30;
          ctx.fillStyle = i & 1 ? '#ffd95c' : '#ffffff';
          ctx.fillRect(Math.round(L.cx + Math.cos(ang) * rr), Math.round(cy + 6 + Math.sin(ang) * rr * 0.6), 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  // the confetti the crown fires, over the stage and under the headline
  if (t > WIN_T.crownLand) drawWinConfetti(now, t - WIN_T.crownLand, dim, tm);

  // --- the headline: VICTORY, one letter at a time ------------------------
  const TXT = tr('end.victory'), S = 4;
  const tw = pixelTextWidth(TXT, S);
  const tx0 = Math.round((VIEW_W - tw) / 2);
  for (let i = 0; i < TXT.length; i++) {
    const lt = (t - WIN_T.title - i * WIN_T.letter) / WIN_T.land;
    if (lt <= 0) continue;
    const e = easeOut(Math.min(1, lt));
    const lx = tx0 + i * 4 * S;
    const ly = L.titleY - Math.round((1 - e) * 40);
    ctx.globalAlpha = Math.min(1, lt * 2.5);
    // a hot white frame on the beat it lands, gold from then on
    drawPixelTextOutline(ctx, TXT[i], lx, ly, lt < 1.12 ? '#ffffff' : '#ffd95c', '#2a1c10', S);
    ctx.globalAlpha = 1;
    if (lt >= 1 && lt < 1.5) { // snow kicked up where it hit
      const f = (lt - 1) / 0.5;
      ctx.globalAlpha = 1 - f;
      ctx.fillStyle = '#dfe8f8';
      for (let k = 0; k < 5; k++) {
        const h = hash2(i * 7 + k, 23);
        ctx.fillRect(Math.round(lx + h * 4 * S + (h - 0.5) * f * 22), Math.round(L.titleY + 5 * S - f * 9), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // the rule sweeps out of the middle; the stage under it says who won
  if (t > WIN_T.rule) {
    drawGoldRule(L.cx, L.ruleY, Math.round((tw / 2 + 10) * easeOut(Math.min(1, (t - WIN_T.rule) / 0.4))), 1, RULE_GOLD);
  }

  // --- the tally ----------------------------------------------------------
  drawEndTally(WIN_STATS, ws, t, L.statY, WIN_T, WIN_ACCENT);
  drawStoryLines(ws, t, L.storyY, WIN_T, WIN_ACCENT); // the match story (js/ui/story.js), under the plates

  // --- the planks, sliding up to land exactly on WIN_T.menu ---------------
  if (t > WIN_T.menu - WIN_SLIDE) {
    const e = easeOut(Math.min(1, (t - (WIN_T.menu - WIN_SLIDE)) / WIN_SLIDE));
    ctx.globalAlpha = e;
    drawEndPlanks(now, Math.round((1 - e) * 16));
    drawEmoteBar(now, WIN_ACCENT, Math.round((1 - e) * 16));
    ctx.globalAlpha = 1;
  }
}
// ------------------------------------------------------------ defeat
// The other end of the same ceremony. A death only DIMS the screen - the
// match plays on underneath and you can sit and watch it - so a lost match
// does not actually end until you stop watching, which is why LOBBY on an
// elimination lands here (deadActivate) and this screen's own plank is the
// door out. It is drawn on winLayout()'s anchors deliberately: DEFEAT sits
// exactly where VICTORY sat, the side stands on the same stands, the rule
// and the tally land in the same bands, and the two read as one pair rather
// than two designs. Everything else is the win inverted - the letters fall
// instead of dropping in, the rule is frost instead of gold, the banners
// are cold and moth-eaten, the braziers are out, no block and no crown, and
// the side stands knee-deep in a drift where the dais stood with the local
// player face down in the middle of it. state.defeatT is the clock:
// state.deadTimer has been running since the body fell, which may have been
// minutes ago.
const DEF_T = {
  dim: 0.45,      // the cold wash has finished settling
  title: 0.18, letter: 0.06, land: 0.34, // DEFEAT falls in a letter at a time
  stage: 0.55, stand: 0.07, // the drift, the dead braziers and the side settle in, a rank a beat after the last
  rule: 0.95,     // the frost rule sweeps out of the middle
  stats: 1.55, statStep: 0.16, roll: 0.5, // the tally, one plate at a time
  menu: 2.70,     // the plank is up and the screen is live
};
const DEF_SLIDE = 0.32; // the plank's slide, finishing exactly on DEF_T.menu

// Where the local player finished, and what it earned getting there: the four
// columns the win prints, with the placing in front of them. That number is
// the one thing a loss has to say that a win does not - "4/6" and not a word
// of it, because the podium glyph beside it is the label. Who put the local
// player down is the death headline's, not this screen's: the side lost.
const DEF_STATS = [
  { icon: 'place', roll: false, val: (w) => w.place + '/' + w.of },
  { icon: 'gold', roll: true, val: (w) => String(w.gold) },
  { icon: 'kills', roll: true, val: (w) => String(w.kills) },
  { icon: 'level', roll: true, val: (w) => String(w.level) },
  { icon: 'time', roll: false, val: (w) => clockTxt(w.time) },
];

function defCues(t0, t1) {
  if (!state.end) return;
  tallyCues(t0, t1, DEF_T, DEF_STATS);
}

// ---- the art -------------------------------------------------------------
// Wind driving across the frame: streaks on their own lane at their own
// speed, wrapped by the modulo rather than tracked - the same no-array idiom
// as the motes. The motes fall through this, and two speeds is what makes it
// read as weather instead of as static.
function drawBlizzard(now, a) {
  const span = VIEW_W + 80;
  // ...under one slow envelope over the whole sheet, so the wind arrives in
  // GUSTS instead of hissing flat: two sines beating against each other, the
  // way the world's own wind is summed (windSway, js/sim/weather.js)
  const gust = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.55) * Math.sin(now * 0.23 + 1.3));
  for (let i = 0; i < 52; i++) {
    const h1 = hash2(i * 17 + 3, 41), h2 = hash2(i * 11 + 7, 89);
    const y = Math.round(h1 * (VIEW_H + 16)) - 8;
    const x = Math.round(((now * (60 + h2 * 150) * gust + h1 * span) % span) - 50);
    const len = 4 + Math.round(h2 * 12 * gust);
    ctx.globalAlpha = a * (0.12 + h2 * 0.16) * gust;
    ctx.fillStyle = '#cfe4f2';
    ctx.fillRect(x, y, len, 1);
    if (len > 8) ctx.fillRect(x + 3, y + 1, len - 5, 1); // a shallow slant, in two steps
  }
  ctx.globalAlpha = 1;
}

// A snow bank where the dais stood: near level across its middle and curving
// away at the two ends - a plain cosine domes, and a dome leaves the ends of
// a body lying on it up in the air, which is what the flattening root on the
// profile is for. Lit along its top three rows and speckled
// with the same hash the dais's cap uses. Drawn twice, once behind the body
// and once in front, so the body lies IN the snow instead of on a hill.
function drawDefeatDrift(cx, bot, hw, peak, a) {
  ctx.globalAlpha = a;
  for (let dx = -hw; dx <= hw; dx++) {
    const h = Math.round(Math.pow(Math.cos((dx / hw) * Math.PI / 2), 0.45) * peak) +
      (hash2(dx * 7 + 3, 19) > 0.72 ? 1 : 0);
    const x = cx + dx, y = bot - h;
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(x, y, 1, 3);
    ctx.fillStyle = '#dfe8f8'; ctx.fillRect(x, y + 3, 1, 2);
    ctx.fillStyle = '#b8cce6'; ctx.fillRect(x, y + 5, 1, Math.max(0, h - 5));
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, bot, 1, 2);
    if (hash2(dx * 5 + 11, 37) > 0.87) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 1, 1, 1); }
  }
  ctx.globalAlpha = 1;
}

// a brazier that has gone out: the win's ironwork with ash on the rim and a
// thread of smoke instead of a flame, and no light on anything near it
function drawDeadBrazier(cx, baseY, now, a) {
  ctx.globalAlpha = a;
  const by = drawBrazierIron(cx, baseY, '#3c4468');
  ctx.fillStyle = '#5a6690'; ctx.fillRect(cx - 3, by - 1, 6, 1);
  ctx.fillStyle = '#2a3560'; ctx.fillRect(cx - 1, by - 2, 3, 1);
  for (let i = 0; i < 9; i++) { // the smoke, thinning as it climbs
    const f = i / 9;
    ctx.globalAlpha = a * 0.30 * (1 - f);
    ctx.fillStyle = '#8fa8d8';
    ctx.fillRect(Math.round(cx + Math.sin(now * 0.9 + i * 0.7) * (1 + f * 4)), by - 3 - i * 3, 1, 2);
  }
  ctx.globalAlpha = 1;
}

// The frame icing over from its edges in, the way a window does: crystals
// crowding the very edge and thinning inward, the band they may reach
// growing while the screen sits there, so the loss keeps closing in after
// everything else has settled. Sampled rather than swept - 300 points placed
// by hash around the border, not a loop over fifty thousand pixels a frame.
const DEF_RIME_BAND = 30, DEF_RIME_GROW = 7; // px deep, and the seconds it takes to get there
function drawDefeatRime(t, a) {
  const grow = Math.min(1, t / DEF_RIME_GROW) * DEF_RIME_BAND;
  for (let i = 0; i < 620; i++) {
    const h1 = hash2(i * 7 + 3, 211), h2 = hash2(i * 5 + 11, 307), h3 = hash2(i * 13 + 1, 17);
    const dep = Math.pow(h2, 2.3) * DEF_RIME_BAND; // crowded at the edge, sparse inward
    if (dep > grow) continue;
    const e = Math.floor(h1 * 4), ver = e < 2;
    const along = Math.round(h3 * (ver ? VIEW_W : VIEW_H));
    const x = ver ? along : e === 2 ? Math.round(dep) : VIEW_W - 1 - Math.round(dep);
    const y = e === 0 ? Math.round(dep) : e === 1 ? VIEW_H - 1 - Math.round(dep) : along;
    // a crystal is a SPUR pointing in off the edge, not a speck: a sheet of
    // specks is the snow this screen already has two of
    const len = 1 + Math.round(h1 * 3);
    const dir = e === 1 || e === 3 ? -1 : 1;
    ctx.globalAlpha = a * 0.85 * Math.pow(1 - dep / DEF_RIME_BAND, 1.6);
    ctx.fillStyle = h3 > 0.72 ? '#ffffff' : h3 > 0.35 ? '#e8f2ff' : '#b8cce6';
    if (ver) ctx.fillRect(x, dir > 0 ? y : y - len + 1, 1, len);
    else ctx.fillRect(dir > 0 ? x : x - len + 1, y, len, 1);
  }
  ctx.globalAlpha = 1;
}

// an arrow planted where a body fell - what the crown is on the other
// screen, and the only thing on this one still standing up
const DEF_ARROW = [
  '...s...', '..fsf..', '..fsf..', '..fsf..', '...s...',
  '...s...', '...s...', '...s...', '...s...', '...s...',
];
const DEF_ARROW_PAL = { '.': null, f: '#c8d4ee', s: '#8a6a44' };

function renderDefeat(now) {
  const ws = state.end || (state.end = endSnapshot());
  const t = state.defeatT;
  const L = winLayout();
  const ti = skin(ws.team), tm = TEAMS[ti];
  const dim = Math.min(1, t / DEF_T.dim);

  // --- backdrop: a colder, heavier wash than the win's --------------------
  ctx.fillStyle = 'rgba(5,8,20,' + (0.94 * dim).toFixed(3) + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawBlizzard(now, dim);
  const vg = ctx.createRadialGradient(L.cx, L.toy + 120, VIEW_H * 0.16, L.cx, L.toy + 120, VIEW_W * 0.58);
  vg.addColorStop(0, 'rgba(3,5,16,0)');
  vg.addColorStop(1, 'rgba(3,5,16,' + (0.92 * dim).toFixed(3) + ')');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawWinMotes(now, dim, 44, true);

  // --- the stage: dead braziers, cold banners, the side in the drift ------
  const rise = easeOut(Math.max(0, Math.min(1, (t - DEF_T.stage) / 0.6)));
  if (rise > 0) {
    const settle = Math.round((1 - rise) * 8); // it comes down into place, not up
    drawDeadBrazier(L.cx - L.brazierX, L.stageY + 14, now, rise);
    drawDeadBrazier(L.cx + L.brazierX, L.stageY + 14, now, rise);
    drawWinBanner(L.cx - L.bannerX, L.bannerY - settle, ti, true, rise, now, true);
    drawWinBanner(L.cx + L.bannerX, L.bannerY - settle, ti, false, rise, now, true);
    const stands = winStands(L, ws, 0);
    const hw = (stands.length >> 1) * (WIN_BODY + L.gap) + (WIN_BODY >> 1);
    drawDefeatDrift(L.cx, L.stageY - 4 - settle, hw + 12, 26, rise); // the bank behind
    // The whole side down in it, SIDE-ON: a body lying across the frame is
    // the one pose that cannot be misread as standing, and a mate still on
    // their feet among the fallen reads as a survivor, which is exactly what
    // this screen has none of. Heads toward the middle, so the line lies
    // mirrored the way it stood, each sunk a row or two off the hash so it
    // is a field of them rather than a rank of dominoes. Outer ranks
    // first, each settling a beat after the last; the name sits over the
    // body's top row (row 7 of the prone grid).
    const DEAD_INK = mixHex(tm.mark, '#141c3c', 0.42); // a colder plate than the win's
    for (let k = stands.length - 1; k >= 0; k--) {
      const s = stands[k];
      const sr = easeOut(Math.max(0, Math.min(1, (t - DEF_T.stage - s.rank * DEF_T.stand) / 0.6)));
      if (sr <= 0) continue;
      const set = SPRITES.champLook(s.m.cls, s.m.look, ti);
      // side-on with the head toward the middle, or face down head-on, off
      // the hash: one row of identical silhouettes reads as cordwood
      const hf = hash2(k * 17 + 5, 97);
      const face = k === 0 ? 'right' : hf < 0.34 ? 'down' : (k & 1) ? 'left' : 'right';
      const sink = k ? Math.round(hash2(k * 11 + 3, 47) * 2) - 1 : 0;
      // even down there the local player can still say something - the loss's
      // emotes are performed WITHOUT getting up (the `emotes` banner)
      const act = k === 0 ? emoteNow(now) : null;
      const pose = act ? act.e.down(set, act.f) : null;
      const by = L.stageY + 2 - WIN_BODY - settle + sink + Math.round((1 - sr) * 8);
      ctx.globalAlpha = sr * 0.92; // the cold has them already
      if (pose) {
        drawEndBody(pose.spr, s.x + (pose.dx || 0), by + WIN_BODY - (pose.dy || 0));
        if (pose.puff) drawSnowPuff(s.x + (WIN_BODY >> 1), by + WIN_BODY - 6, pose.puff, sr);
      } else {
        ctx.drawImage(set.prone[face][0], s.x, by, WIN_BODY, WIN_BODY);
      }
      drawPixelTextOutline(ctx, s.m.name, centreTextX(s.x + (WIN_BODY >> 1), s.m.name), by + 4 - Math.max(0, pose ? pose.dy || 0 : 0), DEAD_INK, '#0f1632');
      ctx.globalAlpha = 1;
    }
    // ...and the snow in FRONT of them all, over every boot and the bodies'
    // last rows: the drift has already started taking them back
    drawDefeatDrift(L.cx, L.stageY + 10 - settle, hw + 32, 7, rise);
    // an arrow planted where a body fell - what the crown is on the other
    // screen, and the only thing on this one still standing up. The local
    // player always earns one; the rest are the hash's to give, so the line
    // reads as a field somebody walked away from.
    for (let k = 0; k < stands.length; k++) {
      if (k && hash2(k * 9 + 3, 61) < 0.5) continue;
      const ax = k ? stands[k].x + 6 + Math.round(hash2(k * 7 + 5, 23) * 28) : L.cx + 14;
      stampGrid(DEF_ARROW, DEF_ARROW_PAL, ax, L.stageY - 24 - settle + (k ? Math.round(hash2(k * 3 + 1, 83) * 4) : 0), 2, '#0a0e23');
    }
  }

  // --- the headline: DEFEAT, one letter at a time, falling ----------------
  const TXT = tr('end.defeat'), S = 4;
  const tw = pixelTextWidth(TXT, S);
  const tx0 = Math.round((VIEW_W - tw) / 2);
  for (let i = 0; i < TXT.length; i++) {
    const lt = (t - DEF_T.title - i * DEF_T.letter) / DEF_T.land;
    if (lt <= 0) continue;
    const e = Math.min(1, lt) * Math.min(1, lt); // ease IN: it drops, it does not spring
    const lx = tx0 + i * 4 * S;
    const ly = L.titleY - Math.round((1 - e) * 12);
    ctx.globalAlpha = Math.min(1, lt * 2);
    // a cold flash on the beat it lands, steel from then on
    drawPixelTextOutline(ctx, TXT[i], lx, ly, lt < 1.12 ? '#e8f2ff' : '#9fbde0', '#0a0e23', S);
    ctx.globalAlpha = 1;
    if (lt >= 1 && lt < 1.5) { // frost shaken loose, falling away
      const fr = (lt - 1) / 0.5;
      ctx.globalAlpha = 1 - fr;
      ctx.fillStyle = '#cfe4f2';
      for (let k = 0; k < 5; k++) {
        const h = hash2(i * 7 + k, 23);
        ctx.fillRect(Math.round(lx + h * 4 * S), Math.round(L.titleY + 5 * S + fr * 12), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // the rule sweeps out of the middle; the stage under it says who lost
  if (t > DEF_T.rule) {
    drawGoldRule(L.cx, L.ruleY, Math.round((tw / 2 + 10) * easeOut(Math.min(1, (t - DEF_T.rule) / 0.4))), 1, RULE_FROST);
  }

  // --- the tally ----------------------------------------------------------
  drawEndTally(DEF_STATS, ws, t, L.statY, DEF_T, DEF_ACCENT);
  drawStoryLines(ws, t, L.storyY, DEF_T, DEF_ACCENT);

  // --- the plank, sliding up to land exactly on DEF_T.menu ----------------
  if (t > DEF_T.menu - DEF_SLIDE) {
    const e = easeOut(Math.min(1, (t - (DEF_T.menu - DEF_SLIDE)) / DEF_SLIDE));
    ctx.globalAlpha = e;
    drawEndPlanks(now, Math.round((1 - e) * 16));
    drawEmoteBar(now, DEF_ACCENT, Math.round((1 - e) * 16));
    ctx.globalAlpha = 1;
  }

  // the frost taking the frame itself, last of all, so it sits over
  // everything the screen has said
  drawDefeatRime(t, dim);
}
