// ------------------------------------------------------------ callout pixels
// What a bot's callout looks like (what it is and when one is said: the `bot
// callouts` banner, js/ai-callouts.js). Only the watched body's side sees its
// own side's calls. Three pieces, all in the call's accent ink:
//   the word  a dark plate with a steel edge over the caller's name tag: the
//             kind's glyph and the word, and a one-pixel tail down to the
//             head. A caller off the screen hangs it over the ping instead,
//             so a call always arrives where it is about.
//   the ping  a pixel ring that pulses outward twice from the spot it names
//             (not for HELP: the caller is the spot, and the plate is on it)
//   the map   the same pulse on the minimap disc (drawCalloutsMap)
// All of it draws above the lighting, like every other world text, so a call
// reads at midnight.
const CALL_PLATE = 'rgba(12,18,42,0.84)';
const CALL_EDGE = '#6f7a99';   // steel, one pixel, no bevel
const CALL_TEXT = '#f4f7ff';
const CALL_IN = 0.12;          // s the plate takes to rise in
const CALL_OUT = 0.5;          // s it takes to fade at the end
const CALL_PULSE = 0.8;        // s per ring, twice
const CALL_RING = 12;          // px the ring grows to
// 5x5 glyphs, one per kind (CALLS.icon), rows top first
const CALL_GLYPHS = {
  bird: ['#...#', '##.##', '.###.', '..#..', '.....'],
  help: ['..#..', '..#..', '#####', '..#..', '..#..'],
  low:  ['#####', '.###.', '..#..', '.....', '.....'],
  push: ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  here: ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
};

// where each player's name tag sat this frame (drawPlayer, js/draw/bodies.js),
// by seat: the plate hangs above it. Cleared once the calls are drawn.
const callAnchor = new Map();
function callTag(p, x, y) { callAnchor.set(p.id, [x, y]); }

function callFade(c) {
  return Math.min(1, c.t / CALL_IN, (CALL_T - c.t) / CALL_OUT);
}

function drawCallouts(ex, ey) {
  if (!callouts.length) { callAnchor.clear(); return; }
  const vp = viewPlayer();
  for (const c of callouts) {
    if (c.team !== vp.team) continue;
    const spec = CALLS[c.k], a = Math.max(0, callFade(c));
    const sx = Math.round(c.x - ex), sy = Math.round(c.y - ey);
    if (c.k !== 'help') {
      for (let i = 0; i < 2; i++) {
        const u = (c.t - i * CALL_PULSE) / CALL_PULSE;
        if (u < 0 || u > 1) continue;
        ctx.globalAlpha = a * (1 - u);
        hbRing(sx, sy, 2 + u * (CALL_RING - 2), spec.ink);
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = '#0f1632';
      ctx.fillRect(sx - 2, sy - 1, 5, 3); ctx.fillRect(sx - 1, sy - 2, 3, 5);
      ctx.fillStyle = spec.ink;
      ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3);
    }
    const at = callAnchor.get(c.id);
    const lift = c.t < CALL_IN ? 2 : 0;
    if (at) drawCallPlate(c, spec, at[0], at[1] - 2 - lift, a);
    else drawCallPlate(c, spec, sx, sy - 8 - lift, a);
  }
  ctx.globalAlpha = 1;
  callAnchor.clear();
}

// the plate, centred on x with its tail's tip on y
function drawCallPlate(c, spec, x, y, a) {
  const tw = pixelTextWidth(c.word), w = 2 + 5 + 2 + tw + 2, h = 9;
  const x0 = Math.round(x - w / 2), y0 = y - 2 - h;
  if (x0 + w < -1 || y0 + h < -1 || x0 > WV_W || y0 > WV_H) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = CALL_PLATE;
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = CALL_EDGE;
  ctx.fillRect(x0 - 1, y0 - 1, w + 2, 1); ctx.fillRect(x0 - 1, y0 + h, w + 2, 1);
  ctx.fillRect(x0 - 1, y0, 1, h); ctx.fillRect(x0 + w, y0, 1, h);
  ctx.fillRect(x - 1, y0 + h + 1, 3, 1); ctx.fillRect(x, y0 + h + 2, 1, 1); // the tail down to the head
  const g = CALL_GLYPHS[spec.icon];
  ctx.fillStyle = spec.ink;
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if (g[r][q] === '#') ctx.fillRect(x0 + 2 + q, y0 + 2 + r, 1, 1);
  drawPixelTextOutline(ctx, c.word, x0 + 9, y0 + 2, CALL_TEXT, '#0f1632');
}

// the same pulse on the minimap disc, for calls the screen may not show
function drawCalloutsMap(ptx, pty, s, vp) {
  ctx.save();
  ctx.beginPath(); ctx.arc(MM_CX, MM_CY, MM_R - 1, 0, Math.PI * 2); ctx.clip();
  for (const c of callouts) {
    if (c.team !== vp.team) continue;
    const u = (c.t % CALL_PULSE) / CALL_PULSE;
    if (c.t > CALL_PULSE * 2) continue;
    const mx = Math.round(MM_CX + (c.x / TILE - ptx) * s), my = Math.round(MM_CY + (c.y / TILE - pty) * s);
    const r = 1 + Math.round(u * 4), d = r * 2 + 1;
    ctx.globalAlpha = 1 - u;
    ctx.fillStyle = CALLS[c.k].ink;
    ctx.fillRect(mx - r, my - r, d, 1); ctx.fillRect(mx - r, my + r, d, 1);
    ctx.fillRect(mx - r, my - r, 1, d); ctx.fillRect(mx + r, my - r, 1, d);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
