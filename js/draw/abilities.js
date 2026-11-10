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
  drawUnitStates(p, px, py, 16, 16, now);
}

// ---- the strip icons -----------------------------------------------------
// Every ability's icon is a detailed 32x32 char grid in the sprite system's
// grammar, on its row (`icon`: ARM_ICON32, js/sprites/armatos.js, and the
// rest) and in this palette, baked lazily onto its own canvas. Drawn by the
// strip's ability wells and the ability tooltip (drawClassAbCell /
// tipClassAb). Each icon repeats the ability's in-world look, so the well
// and the snow speak the same picture.
// The rules a new icon is drawn to (blind reads, 11-10: bold art alone did not
// read better; art plus what it DOES did):
// - One bold shape, ink-outlined, inside the well's open box: x 7-31, y 7-31.
//   The strip lays the rank pips over rows 1-5 and the key digit over the
//   bottom-left corner (drawClassAbCell, js/ui/hud-draw.js).
// - The row's `mark` (an id) stamps what the ability does in the bottom-right
//   corner (abMark below): the SAME 7x7 icon the rival's health bar shows
//   (STATUS_ICONS, js/draw/overhead.js) or a kit mark (AB_MARKS). A mark only
//   says what the picture does not: no burn mark on a flame.
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
  f: '#ff9a3a', F: '#ffe07a', a: '#c8502a', // fire: flame, its hot core, its rim
  i: '#7fc8ff', I: '#4f86c0', // ice: the control blue of the colour key, its shade
};
// what an ability does that is not a body's control state, as a mark in the
// status plate's grammar ('#' ink, '+' lit; STATUS_ICONS holds the rest)
const AB_MARKS = {
  shield: { ink: '#ffd95c', lit: '#ffffff', deep: '#5a4410',
    px: ['#######', '#+#####', '#+#####', '#######', '.#####.', '..###..', '...#...'] },
  burn: { ink: '#ff9a3a', lit: '#ffe07a', deep: '#6a2a14',
    px: ['...#...', '..##...', '..###..', '.##+##.', '.#+++#.', '.#+++#.', '..###..'] },
  speed: { ink: '#f4f7ff', lit: '#ffffff', deep: '#3a3f4a',
    px: ['#..#...', '##.##..', '.##.##.', '..##.##', '.##.##.', '##.##..', '#..#...'] },
  heal: { ink: '#7fd36b', lit: '#ffffff', deep: '#1d3a22',
    px: ['..###..', '..#+#..', '###+###', '#+++++#', '###+###', '..#+#..', '..###..'] },
};
// stamp mark `id` on a baked icon: a 9x9 ink plate in the bottom-right
// corner, the mark's deep tone, its 7x7 icon
function abMark(cv, id) {
  const r = AB_MARKS[id] || STATUS_ICONS.find((q) => q.id === id);
  if (!r) throw new Error('no ability mark ' + id);
  const g = cv.getContext('2d');
  g.fillStyle = AB32_PAL.o; g.fillRect(23, 23, 9, 9);
  g.fillStyle = r.deep; g.fillRect(24, 24, 7, 7);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const c = r.px[y][x];
    if (c === '.') continue;
    g.fillStyle = c === '+' ? r.lit : c === 'x' ? AB32_PAL.o : r.ink;
    g.fillRect(24 + x, 24 + y, 1, 1);
  }
  return cv;
}
// A hero's kit shares one backing (its art row's `glow`, js/sprites/hero-art.js:
// five tones, dark edge to bright core): the colour says WHO, the shape and
// the mark say WHAT (Noah 11-10, from League's kits: one theme per champion,
// light behind the subject, dark at the edges). The core sits on the
// subject's own middle, so every icon lights where its picture is.
const AB_GLOW_R = [17, 12, 8, 5]; // a band's outer radius, edge tone inward
function abGlow(g, rows, glow) {
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (AB32_PAL[rows[y][x]]) { sx += x; sy += y; n++; }
  const cx = n ? sx / n : 15.5, cy = n ? sy / n : 15.5;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const d = Math.hypot(x - cx, y - cy);
    let b = 0;
    while (b < AB_GLOW_R.length && d < AB_GLOW_R[b]) b++;
    g.fillStyle = glow[b];
    g.fillRect(x, y, 1, 1);
  }
}
// hero cls's row's icon baked: the kit's backing, the grid, its mark if it has one
function bakeAbRow(cls, row) {
  const glow = heroArtOf(cls).glow;
  const cv = bakeAb32(row.icon, glow ? (g) => abGlow(g, row.icon, glow) : null);
  return row.mark ? abMark(cv, row.mark) : cv;
}
const ab32Cache = new Map();
// a 32x32 grid in AB32_PAL on its own canvas, over what `under(g)` paints
function bakeAb32(rows, under) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d');
  if (under) under(g);
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
  if (!ab32Cache.has(key)) ab32Cache.set(key, bakeAbRow(cls, HERO_PASSIVE[CLASSES[cls].passive]));
  return ab32Cache.get(key);
}
// the baked 32x32 icon for hero cls's ability on key i
function classAbIcon(cls, i) {
  const key = cls + ':' + i;
  let cv = ab32Cache.get(key);
  if (!cv) {
    cv = bakeAbRow(cls, CLASS_AB[cls][i]);
    ab32Cache.set(key, cv);
  }
  return cv;
}
