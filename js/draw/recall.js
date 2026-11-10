// ------------------------------------------------------------ recall's pixels
// Flat on the snow, under everything that walks it (drawn in the world
// flat pass, drawFlatPass in js/draw/passes.js): each roost's healing ring, and the recall's channel
// feathers round whoever is leaving (js/sim/recall.js).
//
// THE ROOST RING is a soft glowing edge in the bird's side's colour round the
// packed-earth disc (BOOM_R, js/sim/eagle.js): four one-pixel circles stepping
// in from the rim, bright to faint, so the edge reads without a hard line. One
// mirrored step pattern (circlePts), baked once per colour and size into a
// canvas, since the rim is hundreds of pixels.
// THE CHANNEL is the bird's own feathers (drawRecallFeathers, called by drawPlayer,
// js/draw/bodies.js, behind the body and again over it): feathers in a pale tint of
// the side's colour drift down one by one as the channel runs and turn round the
// body at the waist, closer and quicker as it fills, and take off together on the
// last beat; the bar over the head fills with it. No ring on the snow.
const ROOST_GLOW = [0.85, 0.5, 0.28, 0.14]; // the rim's four rings, outside in
const RECALL_FEATHERS = 6;                  // how many have come down by three quarters of the channel
const FEATHER_R = 15, FEATHER_R_MIN = 10;   // px out from the body they turn at, start and end
const FEATHER_DROP = 22, FEATHER_DROP_T = 0.8; // px a feather comes down from, and the s it takes
const FEATHER_LIFT = 0.88, FEATHER_LIFT_PX = 26; // the share of the channel they all take off at, and how far up
// a feather: the quill line in the side's darker tone (`Q`, bare at one end), the vane a
// pale tint of the side's own colour either side of it (`V`), one soft notch in its lower
// edge, and a dark rim all round so it holds on snow and on ice (`o`). It is a shallow
// curve, never straight: FEATHER_LINE gives the quill's row at each column for the two
// ways it rocks as it falls through the air (whole pixels, never turned), and it lies
// near level, never pointing at the body.
const FEATHER_RIM = '#2a3042', FEATHER_PALE = 0.62; // how far the vane goes to white from the side's mark
const FEATHER_LINE = [[5, 5, 4, 4, 4, 3, 3, 3, 3, 3, 4], [2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5]];
const FEATHER_NOTCH = 6; // the column the lower edge is nicked at
// the two frames' pixels, [x, y, part], built once: quill, vane, then the rim round the vane
let featherArt = null;
function featherFrames() {
  if (featherArt) return featherArt;
  return (featherArt = FEATHER_LINE.map((line) => {
    const m = new Map(), put = (x, y, c) => { if (!m.has(x + ',' + y)) m.set(x + ',' + y, [x, y, c]); };
    line.forEach((y, x) => {
      put(x, y, x === line.length - 1 ? 'V' : 'Q');
      if (x >= 3 && x < line.length - 1) put(x, y - 1, 'V');
      if (x >= 3 && x < line.length - 2 && x !== FEATHER_NOTCH) put(x, y + 1, 'V');
    });
    for (const [x, y] of [...m.values()]) if (x >= 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + dy, 'o');
    return [...m.values()];
  }));
}
const featherTints = {};
function featherTint(col) {
  if (featherTints[col]) return featherTints[col];
  const v = parseInt(col.slice(1), 16), k = (c) => Math.round(c + (255 - c) * FEATHER_PALE);
  return (featherTints[col] = 'rgb(' + k(v >> 16) + ',' + k((v >> 8) & 255) + ',' + k(v & 255) + ')');
}

// a midpoint circle's pixels, each once: the eight octants mirror one step pattern
const circleMemo = new Map();
function circlePts(r) {
  if (circleMemo.has(r)) return circleMemo.get(r);
  const s = new Set(), out = [];
  let x = r, y = 0, e = 1 - r;
  while (x >= y) {
    for (const [a, b] of [[x, y], [y, x], [-x, y], [-y, x], [x, -y], [y, -x], [-x, -y], [-y, -x]]) {
      const k = a + ',' + b;
      if (!s.has(k)) { s.add(k); out.push([a, b]); }
    }
    y++;
    if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; }
  }
  circleMemo.set(r, out);
  return out;
}

const roostRingCv = new Map(); // 'colour|r' -> the baked rim, (2r+1) px square
function roostRingArt(col, r) {
  const key = col + '|' + r;
  let cv = roostRingCv.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = 2 * r + 1;
  const g = cv.getContext('2d');
  g.fillStyle = col;
  ROOST_GLOW.forEach((a, k) => {
    g.globalAlpha = a;
    for (const [x, y] of circlePts(r - k)) g.fillRect(r + x, r + y, 1, 1);
  });
  roostRingCv.set(key, cv);
  return cv;
}

function drawRecallGround(ex, ey) {
  if (!state.drop) return;
  const r = Math.round(BOOM_R * TILE);
  for (const e of state.drop.eagles) {
    if (e.state !== 'down') continue;
    const x = Math.round(e.x - ex) - r, y = Math.round(e.y - ey) - r;
    if (x > WV_W || y > WV_H || x + 2 * r < 0 || y + 2 * r < 0) continue;
    ctx.drawImage(roostRingArt(TEAMS[skin(e.team)].mark, r), x, y);
  }
  ctx.globalAlpha = 1;
}

// the channel's feathers round one body: (cx, cy) its feet on screen, `front` the
// half nearer the camera (drawn over the body), else the far half (drawn before it).
// All of it is read off p.recallT, so every screen shows the same feathers.
function drawRecallFeathers(p, cx, cy, front) {
  const q = 1 - p.recallT / RECALL_T, tc = q * RECALL_T, T = TEAMS[skin(p.team)], vane = featherTint(T.mark);
  const lift = Math.max(0, q - FEATHER_LIFT) / (1 - FEATHER_LIFT); // the take-off, all of them together
  const r = FEATHER_R - (FEATHER_R - FEATHER_R_MIN) * q + lift * 5;
  for (let i = 0; i < RECALL_FEATHERS; i++) {
    const age = tc - (Math.max(0, i - 1) / RECALL_FEATHERS) * 0.75 * RECALL_T; // the first two come together
    if (age < 0) break;
    const a = i * 2.399 + tc * (1.2 + 1.4 * q);
    if ((Math.sin(a) >= 0) !== !!front) continue;
    // waist to shoulder, clear of the face
    const h = 5 + (i % 3) * 2.5 + Math.max(0, 1 - age / FEATHER_DROP_T) * FEATHER_DROP + lift * FEATHER_LIFT_PX;
    const art = featherFrames()[Math.floor(tc * 2.5 + i * 0.6) % 2], flip = i % 2 === 1;
    const x0 = Math.round(cx + Math.cos(a) * r), y0 = Math.round(cy + Math.sin(a) * r * 0.5 - h) - 4;
    for (const [x, y, c] of art) {
      ctx.fillStyle = c === 'V' ? vane : c === 'Q' ? T.coat : FEATHER_RIM;
      ctx.fillRect(x0 + (flip ? 5 - x : x - 5), y0 + y, 1, 1);
    }
  }
}
