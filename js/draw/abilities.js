'use strict';
// The heroes' abilities' pixels: the shapes every telegraph draws with (wedge,
// ring, dashed line), the world layer (telegraphs, slashes, the landed
// flashes), the poses and states drawn on a body, and the strip's 32x32
// icons. Everything here draws; the abilities themselves, their tuning
// and their world entities are js/sim/abilities.js, loaded just before this.
// ------------------------------------------------------------ ability pixels

// ---- drawing: the world layer --------------------------------------------
// Flat things on the snow, drawn before the drops and the entities: a
// telegraph is as plainly visible as the blow will be, to BOTH sides - the
// game is readable first, sneaky second.
// ---- the shapes ----
// One vocabulary for every blow with an area: a WEDGE (a blade's cut, a bash -
// inCone's exact shape) and a RING (a blow all round the body). Each is a
// 1px-seated dotted outline with a sparse hash inside so the snow still
// reads through it, drawn in world px with the camera already subtracted.
// `fill` 0..1 is how much of the inside is hashed - a wind-up fills in as it
// nears landing, a landed flash is full and fades.
function drawWedge(px, py, a, r, half, col, alpha, fill) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  const steps = Math.max(6, Math.round(r * half / 2.5));
  for (let i = 0; i <= steps; i++) {
    const t = a - half + (i / steps) * half * 2;
    const x = Math.round(px + Math.cos(t) * r), y = Math.round(py + Math.sin(t) * r);
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y + 1, 2, 2);
    ctx.fillStyle = col; ctx.fillRect(x, y, 2, 2);
  }
  for (const t of [a - half, a + half]) {
    for (let s = 4; s < r - 1; s += 3) {
      const x = Math.round(px + Math.cos(t) * s), y = Math.round(py + Math.sin(t) * s);
      ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
    }
  }
  if (fill > 0) {
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = col;
    for (let s = 6; s < r * fill; s += 4) {
      const n = Math.max(2, Math.round(s * half / 3));
      for (let i = 0; i <= n; i++) {
        const t = a - half + (i / n) * half * 2;
        if ((i + Math.round(s / 4)) % 2) continue;
        ctx.fillRect(Math.round(px + Math.cos(t) * s), Math.round(py + Math.sin(t) * s), 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
function drawRing(px, py, r, col, alpha, fill) {
  ctx.globalAlpha = alpha;
  const n = Math.max(12, Math.round(r * 1.2));
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.round(px + Math.cos(t) * r), y = Math.round(py + Math.sin(t) * r);
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y + 1, 2, 2);
    ctx.fillStyle = col; ctx.fillRect(x, y, 2, 2);
  }
  if (fill > 0) {
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = col;
    for (let s = 5; s < r * fill; s += 4) {
      const m = Math.round(s * 1.1);
      for (let i = 0; i < m; i++) {
        if ((i + Math.round(s / 4)) % 2) continue;
        const t = (i / m) * Math.PI * 2;
        ctx.fillRect(Math.round(px + Math.cos(t) * s), Math.round(py + Math.sin(t) * s), 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// a dashed line marching from (x0, y0) out along (nx, ny) for `len` px - a
// shot's or a dash's telegraph
function drawTeleLine(x0, y0, nx, ny, len, col, alpha, now, ex, ey) {
  const march = (now * 60) % 4; // dashes crawl toward the landing
  ctx.globalAlpha = alpha;
  for (let s = 10 + march; s < len; s += 4) {
    const px = Math.round(x0 + nx * s - ex), py = Math.round(y0 + ny * s - ey);
    if (px < -2 || py < -2 || px > WV_W + 2 || py > WV_H + 2) continue;
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(px, py + 1, 1, 1);
    ctx.fillStyle = col; ctx.fillRect(px, py, 1, 1);
  }
  ctx.globalAlpha = 1;
}
// the sword's sweep, drawn over the bodies (js/render.js beside the E swing
// arcs): the wedge it reached, fading, and a bright edge sweeping across it
function drawSlashes(ex, ey) {
  for (const s of slashes) {
    const px = Math.round(s.x - ex), py = Math.round(s.y - ey);
    if (px < -40 || py < -40 || px > WV_W + 40 || py > WV_H + 40) continue;
    const prog = s.t / SLASH_T;
    drawWedge(px, py, s.a, s.r, s.half, s.hit ? '#ffd95c' : '#f4f7ff', 0.7 * (1 - prog), 0);
    const e = s.a - s.half + prog * s.half * 2; // the edge, across the wedge over the sweep
    ctx.globalAlpha = 0.9 - prog * 0.5;
    for (let i = 0; i < 3; i++) {
      const t = e - i * 0.18;
      const rr = s.r - 1 - i * 2;
      for (let k = 6; k < rr; k += 2) {
        ctx.fillStyle = i ? '#cfe0f2' : '#ffffff';
        ctx.fillRect(Math.round(px + Math.cos(t) * k), Math.round(py + Math.sin(t) * k), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ---- the landing beat ----
// A blow's first beat on the snow is the whole shape filled solid in the
// blow's colour inside an ink rim, so the moment it lands is the loudest
// thing about it - louder than the wind-up that warned of it - and a pale
// blow still reads on white snow. Then the outline fades as before.
const AB_IMPACT = 0.4;   // share of AB_FX_T the solid beat holds
const IMPACT_INK = '#1b2233';
// fill polygons of whole pixels, row by row, even-odd (so a contour inside
// another is a hole), so the shape stays on the pixel grid: one rect per
// run, never a smoothed path. `cs` is a list of contours, each a list of [x, y]
function fillPolyPx(cs) {
  let y0 = Infinity, y1 = -Infinity;
  for (const c of cs) for (const q of c) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  y0 = Math.max(Math.ceil(y0), -2); y1 = Math.min(Math.floor(y1), WV_H + 2);
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    xs.length = 0;
    const yc = y + 0.5;
    for (const c of cs) for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      const a = c[i], b = c[j];
      if ((a[1] > yc) !== (b[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const l = Math.max(-2, Math.round(xs[k])), r = Math.min(WV_W + 2, Math.round(xs[k + 1]));
      if (r > l) ctx.fillRect(l, y, r - l, 1);
    }
  }
}
// a ring's or a wedge's arc as points, radius r
function arcPts(px, py, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = a0 + (i / n) * (a1 - a0); pts.push([px + Math.cos(t) * r, py + Math.sin(t) * r]); }
  return pts;
}
// the contours of a landed shape in screen px, grown by `grow`; a ring or a
// wedge wider than IMPACT_BAND is only its outer band (a shockwave, not a
// painted disc), the inside left to the hash
const IMPACT_BAND = 5;
function impactPts(f, px, py, grow) {
  if (f.kind === 'line') {
    const nx = Math.cos(f.a), ny = Math.sin(f.a), h = f.half + grow, l = f.r + grow, b = -grow;
    return [[[px + nx * b - ny * h, py + ny * b + nx * h], [px + nx * l - ny * h, py + ny * l + nx * h], [px + nx * l + ny * h, py + ny * l - nx * h], [px + nx * b + ny * h, py + ny * b - nx * h]]];
  }
  const r = f.r + grow, ri = r - IMPACT_BAND - grow;
  if (f.kind === 'wedge') {
    const n = Math.max(6, Math.round(r * f.half / 2));
    const out = arcPts(px, py, r, f.a - f.half, f.a + f.half, n);
    if (ri < 6) return [[[px, py], ...out]];
    return [[...out, ...arcPts(px, py, ri, f.a + f.half, f.a - f.half, n)]];
  }
  const n = Math.max(16, Math.round(r * 1.5));
  const cs = [arcPts(px, py + 2, r, 0, Math.PI * 2, n)];
  if (ri > 4) cs.push(arcPts(px, py + 2, ri, 0, Math.PI * 2, n));
  return cs;
}
// a pale blow (white, frost) lands in the wind-up's own hot gold instead:
// white on snow is no landing at all
const impactCols = {};
function impactCol(col) {
  if (impactCols[col]) return impactCols[col];
  const n = parseInt(col.slice(1), 16), lum = (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
  return (impactCols[col] = lum > 0.8 ? TELE_HOT : col);
}
// k: 1 at the landing, 0 as the beat ends
function drawImpact(f, px, py, k) {
  const grow = (1 - k) * 3;
  ctx.globalAlpha = 0.8 * k;
  ctx.fillStyle = IMPACT_INK;
  fillPolyPx(impactPts(f, px, py + 1, grow + 1.5));
  ctx.globalAlpha = Math.min(1, 0.35 + k);
  ctx.fillStyle = impactCol(f.col);
  fillPolyPx(impactPts(f, px, py, grow));
  ctx.globalAlpha = 1;
}

function drawAbilityGround(ex, ey, now) {
  // every wind-up's telegraph, live off the caster and drawn for BOTH sides
  // (each row's own `tele`): a line, a ring, a wedge - each in the wind-up
  // red, hot gold for the last quarter, filling in as the landing nears. It
  // teaches the caster what the key reaches, and it gives whoever is inside
  // the whole wind-up to not be
  heroGround(ex, ey, now); // the heroes' marks under it all: ARMATOS's standards (HERO_GROUND, js/sim/heroes.js)
  for (const p of players) {
    if (!p.active || p.dead || inAir(p) || p.castT <= 0) continue;
    const ab = abOf(p, p.castAb);
    if (!ab) continue;
    const closing = castProg(p);
    const col = closing > 0.75 ? TELE_HOT : TELE_COL;
    const px = Math.round(p.x - ex), py = Math.round(p.y - 2 - ey);
    const cull = Math.max(80, (ab.aim && ab.aim.line) || 0); // a long line reaches in from off the screen
    if (px < -cull || py < -cull || px > WV_W + cull || py > WV_H + cull) continue;
    const a = aimAngle(p); // never p.input: a client is sent no other body's
    if (ab.tele) ab.tele(p, px, py, a, col, closing, now, ex, ey); // a row that draws its own (js/sim/armatos.js)
  }
  // where a blow landed: the same shape, in the blow's own colour, full and
  // gone in a beat
  for (const f of abFx) {
    const px = Math.round(f.x - ex), py = Math.round(f.y - ey);
    if (px < -60 || py < -60 || px > WV_W + 60 || py > WV_H + 60) continue;
    const prog = f.t / AB_FX_T;
    const alpha = 0.9 * (1 - prog);
    if (prog < AB_IMPACT) drawImpact(f, px, py, 1 - prog / AB_IMPACT); // the beat it lands: the whole shape, solid
    if (f.kind === 'wedge') drawWedge(px, py, f.a, f.r + prog * 3, f.half, f.col, alpha, 1 - prog);
    else if (f.kind === 'line') drawLineBox(px, py, f.a, f.r, f.half, f.col, alpha, 1 - prog);
    else drawRing(px, py + 2, f.r + prog * 4, f.col, alpha, 1 - prog);
  }
}

// ---- drawing: on the body ------------------------------------------------
// The pose a cast (or a dash's lean, or a knock-up) puts on the sprite
// itself: drawPlayer applies dx/dy/rot to the body draw, so every ability
// visibly happens TO the model, not just around it.
function abilityPose(p) {
  if (p.upT > 0) return { dx: 0, dy: -upLift(p), rot: 0 }; // knocked up (knockUp, js/sim/actions.js)
  if (p.rushT > 0) {
    const hd = heroDash(p);
    if (hd && hd.pose) return hd.pose(p); // a hero's dash with a shape of its own (HERO_DASH, js/sim/heroes.js)
    return { dx: 0, dy: -1, rot: 0.26 * (p.rushNX >= 0 ? 1 : -1) };
  }
  if (p.castT <= 0 || p.castAb < 0) return null;
  const ab = abOf(p, p.castAb);
  const prog = 1 - p.castT / ab.cast;
  if (ab.wall && p.castSlam) return { dx: p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0, dy: prog < 0.6 ? 1 : -1, rot: 0 }; // coiled back, then the drive
  if (ab.pose) return ab.pose(p, prog);
  return null;
}

// Everything a STATUS leaves on a body, drawn over whatever sprite is
// wearing it: the sprung jaws at rooted feet, the flames, and the gold mark
// chevrons. Takes the sprite's own box, so a rabbit, a bot and a player wear
// the same tells at their own size - a state you cannot see is a rule you
// cannot play around, and that is as true of a deer as of a rival. Called by drawAbilityOnPlayer below and by drawAnimal /
// drawRobot (js/draw/bodies.js).
function drawUnitStates(e, px, py, w, h, now) {
  if (e.slowT > 0 && !(e.rootT > 0)) drawSlowFrost(e, px, py, w, h);
  if (e.rootT > 0) {
    // the sprung jaws, closed on the feet
    ctx.fillStyle = '#3c4356';
    ctx.fillRect(px + 4, py + h - 2, w - 8, 2);
    ctx.fillStyle = '#c8d2e4';
    for (let k = 0; k * 2 + 5 < w - 4; k++) ctx.fillRect(px + 5 + k * 2, py + h - 3, 1, 1);
  }
  if (e.burnT > 0) {
    // Alight: tongues licking UP off the crown, and the snow under the feet
    // lit by them - never a wash over the body, because a burning rival still
    // has to read as the rival it is. Phased off the body's own burn clock, so
    // two burning things are never in lockstep and no global clock is involved.
    const ph = e.burnT * 9;
    const n = Math.max(2, Math.min(4, w >> 2));
    for (let k = 0; k < n; k++) {
      const fx = px + 1 + Math.round((w - 3) * ((k + 0.5) / n));
      const lift = 2 + Math.round(2.2 * (1 + Math.sin(ph + k * 2.1)));
      ctx.fillStyle = '#e0533a';
      ctx.fillRect(fx, py - lift, 2, lift + 1);
      ctx.fillStyle = '#ff9440';
      ctx.fillRect(fx, py - lift + 1, 1, lift);
      ctx.fillStyle = '#ffd95c';
      ctx.fillRect(fx, py - lift, 1, 1);
    }
    ctx.globalAlpha = 0.45 + 0.2 * Math.sin(ph * 1.7);
    ctx.fillStyle = '#ff9440';
    ctx.fillRect(px + 2, py + h - 1, w - 4, 1);
    ctx.globalAlpha = 1;
  }
  if (e.markT > 0) {
    // the mark: gold chevrons falling toward the head, for everyone
    const ph = (now * 2.2) % 1;
    ctx.globalAlpha = e.markT < 0.6 ? e.markT / 0.6 : 1;
    const mx = px + (w >> 1) - 3;
    for (let k = 0; k < 2; k++) {
      const y = py - 8 - 5 * k + Math.round(ph * 4);
      ctx.fillStyle = '#0f1632';
      ctx.fillRect(mx, y + 1, 6, 2);
      ctx.fillStyle = '#f2cc6a';
      ctx.fillRect(mx, y, 2, 2); ctx.fillRect(mx + 4, y, 2, 2); ctx.fillRect(mx + 2, y + 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  heroMarks(e, px, py, w, h, now); // what a hero puts on a body: BELLA's marks and stacks (HERO_MARK, js/sim/heroes.js)
}

// The player's own layer: the one state only a player can be in - a raised
// shield - over the ones every unit shares.
function drawAbilityOnPlayer(p, px, py, now) {
  if (p.shieldT > 0) {
    const a = p.shieldA;
    ctx.save();
    ctx.translate(px + 8 + Math.round(Math.cos(a) * 7), py + 8 + Math.round(Math.sin(a) * 5));
    ctx.rotate(a);
    ctx.fillStyle = '#242a3a';
    ctx.fillRect(-1, -7, 4, 14);
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(-1, -6, 3, 12);
    ctx.fillStyle = '#c8d2e4';
    ctx.fillRect(-1, -6, 1, 12);
    ctx.fillStyle = p.holdHit ? '#ffd95c' : TEAMS[skin(p.team)].mark; // the trim carries the side - gold while ARMATOS's bash is primed
    ctx.fillRect(0, -2, 1, 4);
    ctx.restore();
  }
  drawWorn(p, px, py, now);
  drawUnitStates(p, px, py, 16, 16, now);
}

// ---- what a key leaves worn on a body ----------------------------------
// A key that changes a body without moving it (a brace, a buff, a quickening)
// names the clock it sets and one of three shared looks on its row (`worn`):
// GUARD a gold rim round the model (hits cut, a ward up), POWER an orange
// rim (its blows hit harder or faster), HASTE white streaks trailing it (it
// runs faster). The same look means the same thing on
// every hero, for both sides, and on an ally who was given it. Every ward
// (shieldUnit's wardHp) wears GUARD too. Each mark has an ink rim: pale alone
// vanishes on snow. The colours are the ability key's (damage red, control
// ice, heal green, protect gold, move white).
const WORN_COL = { guard: '#ffd95c', power: '#ff9440', haste: '#f4f7ff' };
const WORN_INK = '#1b2233';
const WORN_FADE = 0.5; // s a look fades out over before its clock ends
let wornRows = null;
function wornOf() {
  if (wornRows) return wornRows;
  wornRows = [];
  for (const rows of CLASS_AB) for (const ab of rows) if (ab && ab.worn && !wornRows.some((w) => w.t === ab.worn.t)) wornRows.push(ab.worn);
  return wornRows;
}
// how strongly each look is on this body, 0..1 (fading out over WORN_FADE)
function wornOn(p) {
  const on = { guard: 0, power: 0, haste: 0 };
  for (const w of wornOf()) if (p[w.t] > 0) on[w.look] = Math.max(on[w.look], Math.min(1, p[w.t] / WORN_FADE));
  if (p.wardHp > 0 && p.wardT > 0) on.guard = Math.max(on.guard, Math.min(1, p.wardT / WORN_FADE));
  return on;
}
// over the body: the streaks (the rims ride under the model, drawWornRim)
function drawWorn(p, px, py, now) {
  if (p.prone) return;
  const on = wornOn(p);
  if (on.haste) wornHaste(p, px, py, now, on.haste);
}
// GUARD and POWER hug the model itself: a 1 px rim of the look's colour round
// the sprite's own silhouette, drawn just before the sprite (drawPlayer), so it
// fits every hero and every frame and never sits where the frame or a weapon
// is. Guard wins when both are on: being hard to hurt is the thing to read.
const WORN_RIM1 = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]; // the colour, 1 px out
const WORN_RIM2 = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -1], [2, -1], [-2, 1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]]; // its ink, 2 px out
const wornTint = new WeakMap(); // sprite -> { colour: its silhouette in that colour }
function wornSil(spr, col) {
  let m = wornTint.get(spr);
  if (!m) wornTint.set(spr, (m = {}));
  if (m[col]) return m[col];
  const cv = document.createElement('canvas');
  cv.width = spr.width; cv.height = spr.height;
  const g = cv.getContext('2d');
  g.drawImage(spr, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height);
  return (m[col] = cv);
}
function drawWornRim(p, spr, sx, sy, now) {
  if (p.prone) return;
  const on = wornOn(p);
  const look = on.guard ? 'guard' : on.power ? 'power' : '';
  if (!look) return;
  const a0 = ctx.globalAlpha, ink = wornSil(spr, WORN_INK), sil = wornSil(spr, WORN_COL[look]);
  ctx.globalAlpha = a0 * on[look] * (0.8 + 0.2 * Math.sin(now * 8));
  for (const [dx, dy] of WORN_RIM2) ctx.drawImage(ink, sx + dx, sy + dy);
  for (const [dx, dy] of WORN_RIM1) ctx.drawImage(sil, sx + dx, sy + dy);
  ctx.globalAlpha = a0;
}
function wornDot(x, y, w, h, col) {
  ctx.fillStyle = WORN_INK; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
}
// three streaks trailing the way it came (behind its facing when it stands)
function wornHaste(p, px, py, now, a) {
  const sp = Math.hypot(p.vx || 0, p.vy || 0);
  let bx = -(p.vx || 0) / (sp || 1), by = -(p.vy || 0) / (sp || 1);
  if (sp < 8) { bx = p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0; by = p.dir === 'up' ? 1 : p.dir === 'down' ? -1 : 0; if (!bx && !by) bx = -1; }
  const side = Math.abs(bx) >= Math.abs(by);
  ctx.globalAlpha = a;
  for (let k = 0; k < 3; k++) {
    const len = 4 + ((k + Math.floor(now * 8)) % 3);
    if (side) {
      const x = bx > 0 ? px + 17 : px - 1 - len, y = py + 5 + k * 3;
      wornDot(x, y, len, 1, WORN_COL.haste);
    } else {
      const y = by > 0 ? py + 17 : py - 1 - len, x = px + 3 + k * 4;
      wornDot(x, y, 1, len, WORN_COL.haste);
    }
  }
  ctx.globalAlpha = 1;
}
// SLOWED: ice crusted round the feet, inked, in the control colour - the
// commonest state in a fight had no tell on the body at all
const SLOW_ICE = '#7fc8ff', SLOW_ICE_LIT = '#e6f6ff';
function drawSlowFrost(e, px, py, w, h) {
  ctx.globalAlpha = Math.min(1, e.slowT / WORN_FADE);
  const y = py + h - 2, n = Math.max(2, Math.round(w / 5));
  for (let k = 0; k < n; k++) {
    const x = px + Math.round((w - 3) * (k / Math.max(1, n - 1))), tall = k % 2 ? 2 : 3;
    ctx.fillStyle = WORN_INK; ctx.fillRect(x - 1, y - tall, 4, tall + 2);
    ctx.fillStyle = SLOW_ICE; ctx.fillRect(x, y - tall + 1, 2, tall);
    ctx.fillStyle = SLOW_ICE_LIT; ctx.fillRect(x, y - tall + 1, 1, 1);
  }
  ctx.globalAlpha = 1;
}

// ---- the strip icons -----------------------------------------------------
// Every ability's icon is a detailed 32x32 char grid in the sprite system's
// grammar, on its row (`icon`: ARM_ICON32, js/sprites/armatos.js, and the
// rest) and in this palette, baked lazily onto its own canvas. Drawn by the
// strip's ability wells and the ability tooltip (drawClassAbCell /
// tipClassAb). Each icon repeats the ability's in-world look, so the well
// and the snow speak the same picture.
const AB32_PAL = {
  o: '#141a2c', k: '#0f1632',
  W: '#f4f7ff', b: '#cfe0f2', B: '#9fb6d8',
  C: '#c8d2e4', s: '#8b93a8', S: '#5f6f96', D: '#3c4356',
  t: '#e8dcb4', d: '#a89263', w: '#a8794a', u: '#6e4a28',
  g: '#f2cc6a', G: '#b98a2e',
  r: '#e05a4a', R: '#a03428', p: '#f2937f',
  H: '#d9ad72', h: '#8a6d50', n: '#5c4a38',
  E: '#cfd8e8', e: '#8b93a8',
  v: '#4f8a46', V: '#9cc87a', // SALVIA's sage (js/sprites/salvia.js)
  q: '#2c5478', Q: '#5f9cc8', // MARIS's water (js/sprites/maris.js)
  j: '#2f5c4b', // LIGNUM's pine dark (js/sprites/lignum.js)
};
const ab32Cache = new Map();
// a 32x32 grid in AB32_PAL on its own canvas
function bakeAb32(rows) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d');
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = AB32_PAL[row[c]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(c, r, 1, 1);
    }
  }
  return cv;
}
// a named hero's passive icon (HERO_PASSIVE, js/sim/heroes.js)
function passiveIcon(cls) {
  const key = cls + ':p';
  if (!ab32Cache.has(key)) ab32Cache.set(key, bakeAb32(HERO_PASSIVE[CLASSES[cls].passive].icon));
  return ab32Cache.get(key);
}
// the baked 32x32 icon for hero cls's ability on key i
function classAbIcon(cls, i) {
  const key = cls + ':' + i;
  let cv = ab32Cache.get(key);
  if (!cv) {
    cv = bakeAb32(CLASS_AB[cls][i].icon);
    ab32Cache.set(key, cv);
  }
  return cv;
}
