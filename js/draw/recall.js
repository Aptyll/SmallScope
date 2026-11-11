// ------------------------------------------------------------ recall's pixels
// The bird's feathers on a body (js/sim/recall.js): the recall's channel, the set-down
// at its far end, and the mending at the roost.
//
// THE ROOST has no ring: its kerbed paving marks the place (js/draw/footings.js), and
// the mending shows on the mended body (drawMendFeathers below). The soft glowing rim
// (roostRingArt: four one-pixel circles stepping in from the rim, bright to faint, one
// mirrored step pattern, circlePts, baked once per colour and size) is what a pump
// wears (drawPumpRings, js/draw/structs.js).
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

// SET DOWN BY THE BIRD (a respawn, the recall's far end; p.backT, js/sim/player.js): the
// take-off run backwards. The feathers come down round the body together, close and
// turning fast, open out as they sink to the waist, and drift off one by one. Read off
// p.backT alone, so every screen shows the same feathers; they stay with the body if it
// walks off.
const BACK_FEATHERS = 6, BACK_DROP_PX = 5; // how many, and how far up they come down from: head height, under the plate over the head
const BACK_LAND = 0.35, BACK_GO = 0.55;     // the share of the time they take to come down, and the share they start leaving at
function drawBackFeathers(p, cx, cy, front) {
  const u = 1 - p.backT / BACK_FX_T, tc = u * BACK_FX_T, T = TEAMS[skin(p.team)], vane = featherTint(T.mark);
  const fall = Math.max(0, 1 - u / BACK_LAND), drop = fall * fall * BACK_DROP_PX; // quick, easing onto the waist
  const r = FEATHER_R_MIN + (FEATHER_R + 3 - FEATHER_R_MIN) * Math.min(1, u / BACK_GO);
  for (let i = 0; i < BACK_FEATHERS; i++) {
    if (u > BACK_GO + (1 - BACK_GO) * (i + 1) / BACK_FEATHERS) continue; // gone, one by one
    const a = i * 2.399 - tc * (4.2 - 3 * u);
    if ((Math.sin(a) >= 0) !== !!front) continue;
    const h = 5 + (i % 3) * 2.5 + drop - Math.max(0, u - BACK_GO) * 10; // waist to shoulder, clear of the face, sinking as they leave
    const art = featherFrames()[Math.floor(tc * 2.5 + i * 0.6) % 2], flip = i % 2 === 1;
    const c0 = Math.cos(a), side = fall > 0 ? Math.sign(c0 || 1) * Math.max(Math.abs(c0), 0.7) : c0; // coming down, they keep to his sides: never across the face
    const x0 = Math.round(cx + side * r), y0 = Math.round(cy + Math.sin(a) * r * 0.5 - h) - 4;
    for (const [x, y, c] of art) {
      ctx.fillStyle = c === 'V' ? vane : c === 'Q' ? T.coat : FEATHER_RIM;
      ctx.fillRect(x0 + (flip ? 5 - x : x - 5), y0 + y, 1, 1);
    }
  }
}

// KNOCKED OFF A STRUCK BIRD (a particle with art 'feather', knockFeather in js/sim/eagle.js):
// a white breast feather with a dark quill and rim, turning over as it sinks and swaying
// side to side. Drawn over the bird, after the particle pass.
function drawLooseFeathers(ex, ey) {
  for (const p of particles) {
    if (p.art !== 'feather') continue;
    const x = Math.round(p.x - ex), y = Math.round(p.y - ey);
    if (x < -8 || y < -8 || x > WV_W + 8 || y > WV_H + 8) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife)); // it fades over its last moment
    drawLooseFeather(p, x, y);
  }
  ctx.globalAlpha = 1;
}
function drawLooseFeather(p, x, y) {
  const age = FEATHER_LIFE - p.life, art = featherFrames()[Math.floor(age * 5) % 2], flip = (p.side > 0) !== (Math.floor(age * 2.5) % 2 === 1);
  const x0 = x + Math.round(Math.sin(age * 6) * 3), y0 = y - 2;
  for (const [ax, ay, c] of art) {
    ctx.fillStyle = c === 'V' ? '#f4f7ff' : c === 'Q' ? '#8a93a8' : FEATHER_RIM;
    ctx.fillRect(x0 + (flip ? 5 - ax : ax - 5), y0 + ay, 1, 1);
  }
}

// MENDED BY THE BIRD (p.mendT, the time its roost has been giving health or the roll
// back without a break, js/sim/recall.js): a white feather off the bird's breast comes
// down beside the body and settles at its waist, then the next on its other side, from
// the first mending frame. White with a dark quill on every side; beside the body,
// never across the face or the plate.
const MEND_FALL = 1.1, MEND_DROP = 6;  // s one feather takes to settle, and the px it comes down
const MEND_OUT = 12;                   // px out from the body's middle it falls at
function drawMendFeathers(p, cx, cy, front) {
  const n = Math.floor(p.mendT / MEND_FALL), u = p.mendT / MEND_FALL - n; // which feather, and how far down it is
  if (!front === (n % 3 !== 2)) return; // two in front of the body, then one behind it
  const side = n % 2 ? 1 : -1, sway = Math.round(Math.sin(u * Math.PI * 2.5) * 2);
  const art = featherFrames()[Math.floor(u * 3) % 2];
  const x0 = cx + side * (MEND_OUT - Math.round(u * 3)) + sway, y0 = cy - 6 - Math.round((1 - u) * MEND_DROP) - 4;
  ctx.globalAlpha = u > 0.8 ? (1 - u) / 0.2 : 1; // it settles into the cloth
  for (const [x, y, c] of art) {
    ctx.fillStyle = c === 'V' ? '#f4f7ff' : c === 'Q' ? '#8a93a8' : FEATHER_RIM;
    ctx.fillRect(x0 + (side > 0 ? 5 - x : x - 5), y0 + y, 1, 1);
  }
  ctx.globalAlpha = 1;
}
