'use strict';
// The class abilities' pixels: the shapes every telegraph draws with (wedge,
// ring, dashed line), the world layer (telegraphs, slashes, craters, nets and
// lines in the air), the poses and states drawn on a body, and the strip's
// 32x32 icons. Everything here draws; the abilities themselves, their tuning
// and their world entities are js/sim/abilities.js, loaded just before this.
// ------------------------------------------------------------ ability pixels

// ---- drawing: the world layer --------------------------------------------
// Flat things on the snow, drawn before the drops and the entities: the
// pierce telegraph is as plainly visible as the shot will be, to BOTH sides -
// the game is readable first, sneaky second.
// ---- the shapes ----
// One vocabulary for every blow with an area: a WEDGE (the sword, the slam,
// the execute - inCone's exact shape) and a RING (the stomp). Each is a
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

// a dashed line marching from (x0, y0) out along (nx, ny) for `len` px - the
// pierce's and the charge's telegraph
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
  // every wind-up's telegraph, live off the caster and drawn for BOTH sides:
  // the piercing shot's line, the charge's line, the stomp's ring, the
  // slam's and the execute's wedge - each in the wind-up red, hot gold for
  // the last quarter, filling in as the landing nears. It teaches the caster
  // what the key reaches, and it gives whoever is inside the whole wind-up
  // to not be
  heroGround(ex, ey, now); // the heroes' marks under it all: ARMATOS's standards (HERO_GROUND, js/sim/heroes.js)
  for (const p of players) {
    if (!p.active || p.dead || inAir(p) || p.castT <= 0) continue;
    const ab = abOf(p, p.castAb);
    if (!ab) continue;
    const closing = castProg(p);
    const col = closing > 0.75 ? TELE_HOT : TELE_COL;
    const px = Math.round(p.x - ex), py = Math.round(p.y - 2 - ey);
    // the pierce's line is the flight the loose will take, so it can cross
    // the screen from a caster well off it - the cull reaches as far as the
    // line does
    const pfl = ab.id === 'pierce' ? pierceFlight() : null;
    const cull = pfl ? pfl.spd * pfl.life : 80;
    if (px < -cull || py < -cull || px > WV_W + cull || py > WV_H + cull) continue;
    const a = aimAngle(p), nx = Math.cos(a), ny = Math.sin(a); // never p.input: a client is sent no other body's
    if (ab.id === 'pierce') {
      drawTeleLine(p.x, p.y - BOW_Y, nx, ny, teleLen(p.x, p.y - BOW_Y, nx, ny, cull), col, 0.5 + 0.45 * closing, now, ex, ey);
    } else if (ab.id === 'rush') {
      const len = teleLen(p.x, p.y, nx, ny, RUSH_SPD * RUSH_T);
      drawTeleLine(p.x, p.y, nx, ny, len, col, 0.5 + 0.45 * closing, now, ex, ey);
      // the end of the line: where the charge stops and the slam happens
      ctx.globalAlpha = 0.6 + 0.4 * closing;
      ctx.fillStyle = col;
      for (let i = -3; i <= 3; i++) ctx.fillRect(Math.round(p.x + nx * len - ny * i - ex), Math.round(p.y + ny * len + nx * i - ey), 1, 1);
      ctx.globalAlpha = 1;
    } else if (ab.id === 'stomp') {
      drawRing(px, py + 2, STOMP_R, col, 0.55 + 0.4 * closing, closing);
    } else if (ab.id === 'exec') {
      drawWedge(px, py, a, EXEC_R, EXEC_HALF, col, 0.55 + 0.4 * closing, closing);
    } else if (ab.tele) {
      ab.tele(p, px, py, a, col, closing, now, ex, ey); // a row that draws its own (js/sim/armatos.js)
    } else if (ab.id === 'shield' && p.castSlam) {
      drawWedge(px, py, a, SLAM_R, SLAM_HALF, col, 0.55 + 0.4 * closing, closing);
    }
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
  for (const z of craters) {
    const px = Math.round(z.x - ex), py = Math.round(z.y - ey);
    if (px < -40 || py < -40 || px > WV_W + 40 || py > WV_H + 40) continue;
    const a = Math.max(0, 1 - z.t / CRATER_T);
    // dithered pressed-snow bowl: pixels thin out toward the rim
    for (let dy = -CRATER_R; dy <= CRATER_R; dy += 2) {
      for (let dx = -CRATER_R; dx <= CRATER_R; dx += 2) {
        const d = Math.hypot(dx, dy * 1.6);
        if (d > CRATER_R) continue;
        const h = hash2(z.x + dx, z.y + dy);
        if (h > 0.28 + 0.55 * (1 - d / CRATER_R)) continue;
        ctx.fillStyle = h < 0.18 ? 'rgba(118,144,186,' + (a * 0.5).toFixed(2) + ')'
          : 'rgba(160,182,214,' + (a * 0.4).toFixed(2) + ')';
        ctx.fillRect(px + dx, py + Math.round(dy * 0.62), 1, 1);
      }
    }
    // the rim: shoved-up snow, lit pale
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * Math.PI * 2 + 0.2;
      ctx.fillStyle = 'rgba(238,244,251,' + (a * 0.6).toFixed(2) + ')';
      ctx.fillRect(px + Math.round(Math.cos(an) * CRATER_R * 0.9), py + Math.round(Math.sin(an) * CRATER_R * 0.55), 2, 1);
    }
  }
}

// airborne ability bodies, drawn with the arrows: the net spinning open, and
// the grapple's taut rope between a reeling body and its anchor
function drawAbilityAir(ex, ey, now) {
  for (const p of players) {
    if (!p.active || p.dead || inAir(p) || p.grapT <= 0) continue;
    // the rope: dark-seated tan dots every couple of px from chest to anchor,
    // and the steel hook biting where it caught
    const x0 = p.x, y0 = p.y - 4;
    const dx = p.grapX - x0, dy = p.grapY - 4 - y0;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    for (let s = 3; s < d - 2; s += 2) {
      const px = Math.round(x0 + nx * s - ex), py = Math.round(y0 + ny * s - ey);
      if (px < -2 || py < -2 || px > WV_W + 2 || py > WV_H + 2) continue;
      ctx.fillStyle = '#0d1226';
      ctx.fillRect(px, py + 1, 1, 1);
      ctx.fillStyle = '#a89263';
      ctx.fillRect(px, py, 1, 1);
    }
    const hx = Math.round(p.grapX - ex), hy = Math.round(p.grapY - 4 - ey);
    ctx.fillStyle = '#0d1226';
    ctx.fillRect(hx - 2, hy - 1, 5, 3);
    ctx.fillStyle = '#c8d2e4';
    ctx.fillRect(hx - 1, hy - 1, 3, 1);
    ctx.fillRect(hx - 2, hy, 1, 2);
    ctx.fillRect(hx + 2, hy, 1, 2);
  }
  for (const n of nets) {
    const px = Math.round(n.x - ex), py = Math.round(n.y - ey);
    if (px < -12 || py < -12 || px > WV_W + 12 || py > WV_H + 12) continue;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(n.spin);
    ctx.fillStyle = '#0d1226';
    for (let k = -3; k <= 3; k += 3) { ctx.fillRect(k - 1, -4, 1, 8); ctx.fillRect(-4, k - 1, 8, 1); }
    ctx.fillStyle = '#cfd8e8';
    for (let k = -3; k <= 3; k += 3) { ctx.fillRect(k, -4, 1, 8); ctx.fillRect(-4, k, 8, 1); }
    ctx.fillStyle = '#8b93a8'; // the weights on the corners
    ctx.fillRect(-4, -4, 2, 2); ctx.fillRect(3, -4, 2, 2);
    ctx.fillRect(-4, 3, 2, 2); ctx.fillRect(3, 3, 2, 2);
    ctx.restore();
  }
}

// ---- drawing: on the body ------------------------------------------------
// The pose a cast (or the net shot's recoil hop, or the rush's lean) puts on
// the sprite itself: drawPlayer applies dx/dy/rot to the body draw, so every
// ability visibly happens TO the model, not just around it.
function abilityPose(p) {
  if (p.upT > 0) return { dx: 0, dy: -upLift(p), rot: 0 }; // knocked up (knockUp, js/sim/actions.js)
  if (p.rushT > 0) {
    const hd = heroDash(p);
    if (hd && hd.pose) return hd.pose(p); // a hero's dash with a shape of its own (HERO_DASH, js/sim/heroes.js)
    return { dx: 0, dy: -1, rot: 0.26 * (p.rushNX >= 0 ? 1 : -1) };
  }
  if (p.hopT > 0) {
    return { dx: 0, dy: -Math.round(4 * Math.sin(Math.PI * (1 - p.hopT / 0.3))), rot: 0 };
  }
  if (p.castT <= 0 || p.castAb < 0) return null;
  const ab = abOf(p, p.castAb);
  const prog = 1 - p.castT / ab.cast;
  if (ab.wall && p.castSlam) return { dx: p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0, dy: prog < 0.6 ? 1 : -1, rot: 0 }; // coiled back, then the drive
  if (ab.pose) return ab.pose(p, prog);
  switch (ab.id) {
    // the locked draw: leant back off the aim, planted, and it does not move
    // again until the loose - the body itself is part of the telegraph
    case 'pierce': return { dx: p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0, dy: 1, rot: 0 };
    case 'net': return { dx: p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0, dy: 0, rot: 0 }; // braced back
    case 'grap': return { dx: 0, dy: -1, rot: 0.1 * (p.dir === 'left' ? -1 : 1) };  // arm slung forward
    case 'snow': return { dx: 0, dy: 2, rot: 0 };                                   // the kneel down
    case 'shield': return p.castSlam
      ? { dx: p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0, dy: prog < 0.6 ? 1 : -1, rot: 0 } // coiled back, then the drive
      : { dx: 0, dy: 1, rot: 0 };                                                   // planted
    case 'rush': return { dx: 0, dy: prog < 0.5 ? 1 : 0, rot: 0.14 * (p.dir === 'left' ? -1 : 1) }; // head down, feet dug in
    case 'stomp': return { dx: 0, dy: -Math.round(6 * Math.sin(Math.PI * prog)), rot: 0 }; // the leap
    case 'exec': return { dx: 0, dy: prog < 0.8 ? -Math.round(3 * prog) : 2, rot: 0 }; // the blade climbs, then comes down
  }
  return null;
}

// Everything a STATUS leaves on a body, drawn over whatever sprite is
// wearing it: the net drape, the sprung jaws at rooted feet, the flames, and
// the gold mark chevrons (root and mark currently have no caster in the
// game, but the tells stay with the universal status set - see Known drift,
// docs/dev/checklists.md). Takes the sprite's
// own box, so a rabbit, a bot
// and a player wear the same four tells at their own size - a state you
// cannot see is a rule you cannot play around, and that is as true of a deer
// as of a rival. Called by drawAbilityOnPlayer below and by drawAnimal /
// drawBird / drawRobot (js/draw-world.js).
function drawUnitStates(e, px, py, w, h, now) {
  if (e.netT > 0) {
    ctx.globalAlpha = Math.min(1, e.netT / 0.4);
    ctx.fillStyle = '#cfd8e8';
    // a 3px mesh inside the sprite's own box, however big that box is
    for (let x = 3; x < w - 2; x += 3) ctx.fillRect(px + x, py + 3, 1, h - 5);
    for (let y = 4; y < h - 2; y += 3) ctx.fillRect(px + 3, py + y, w - 6, 1);
    ctx.fillStyle = '#8b93a8';
    ctx.fillRect(px + 3, py + h - 3, w - 6, 1); // the sag at the hem
    ctx.globalAlpha = 1;
  }
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
// shield - over the four every unit shares.
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
// The eight ability icons: detailed 32x32 char grids in the sprite system's
// grammar (sprites.md - new sprites bake beside the code that draws them),
// AB32[cls][key] in CLASS_AB's own order, baked lazily onto their own
// canvases. Drawn by the strip's ability wells and the ability tooltip
// (drawClassAbCell / tipClassAb, js/ui.js). Each icon repeats the ability's
// in-world look - the pierce's gold line, the net's corner weights, the
// grapple's sagging rope - so the well and the snow speak the same picture.
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
};
const AB32 = [
  [ // HUNTER
    [ // PIERCING SHOT: the shaft already loosed down the thin gold telegraph
      // line, the flash still on the arrowhead
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '..b.............................',
      '......rr....................g...',
      '......rrrr....................W.',
      '.bbb...rrrr....................g',
      '.....ooooooooooooooooooooooooo..',
      '.....ottttttttttttttttsssSSWWo.W',
      'g.g.goddddddddddddddddsssSSWWg.g',
      '.....ooooooooooooooooooooooooo.W',
      '.bbb...rrrr....................g',
      '......rrrr....................W.',
      '......rr....................g...',
      '..b.............................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    [ // NET SHOT: the weighted net mid-flight - the rope weave bright on the
      // throw lines, and the four steel corner weights the air sprite wears
      '................................',
      '................................',
      '................................',
      '.....ooo.................ooo....',
      '....osCso...............osCso...',
      '....osCsoEWEEEWEEEWEEEWEosCso...',
      '....osSso...............osSso...',
      '.....ooo..e...e...e...e..ooo....',
      '......e...e...e...e...e...e.....',
      '......WeeeWeeeWeeeWeeeWeeeW.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......WeeeWeeeWeeeWeeeWeeeW.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......WeeeWeeeWeeeWeeeWeeeW.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......e...e...e...e...e...e.....',
      '......WeeeWeeeWeeeWeeeWeeeW.....',
      '......e...e...e...e...e...e.....',
      '.....ooo..e...e...e...e..ooo....',
      '....osCso.e...e...e...e.osCso...',
      '....osCsoEWEEEWEEEWEEEWEosCso...',
      '....osSso...............osSso...',
      '.....ooo.................ooo....',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    [ // GRAPPLE: the steel hook bitten into a trunk top-right, the rope
      // sagging home toward the reeling hand
      '......................oooooooooo',
      '......................ouwwwwwwww',
      '......................ouwwwwwwuw',
      '......................ouwwuwwwww',
      '......................ouwwwwwwww',
      '......................ouwwwwwuww',
      '......................ouwwwwwwww',
      '......................ouwwwwwwww',
      '......................Cuwuwwwwww',
      '......................oCswwwwwww',
      '.....................oCuwwwwuwww',
      '....................oCsuwwwwwwww',
      '...................oCsCCswwuwwww',
      '...................d..oooooooooo',
      '..................dk............',
      '..................d.............',
      '.................dk.............',
      '................dk..............',
      '................d...............',
      '...............dk...............',
      '..............dk................',
      '..............d.................',
      '.............dk.................',
      '............dk..................',
      '...........dk...................',
      '.........ddk....................',
      '........ddk.....................',
      '..b..dddkk......................',
      '....ddkk........................',
      '....kk..........................',
      '.b...b..........................',
      '................................',
    ],
    [ // SNOW COVER: the mound holding perfectly still, and the breath in the
      // cold air that is the one tell it still gives
      '................................',
      '................................',
      '................................',
      '................................',
      '........W.................W.....',
      '.........................bb.....',
      '................................',
      '................................',
      '....b...........................',
      '......................bWb.......',
      '......................bbB.......',
      '................................',
      '................................',
      '......W.............bW..........',
      '....................bb..........',
      '............................b...',
      '................................',
      '...........oWWWWWWWo............',
      '........oWWWWWWWWWWWWWo.........',
      '......oWWWWWWWWWWWWWWWWWo.......',
      '.....obbbbbbbbBBbbbbbbbbbo......',
      '.....obbbbbbbbbbbbbbbbbbbo......',
      '....obbbbbbbbbbbbbbbbbbbbbo.....',
      '.....obbbbbbbbbbbbbbbbbbbo......',
      '.....oBBBBBBBBBBBBBBBBBBBo......',
      '......oBBBBBBBBBBBBBBBBBo.......',
      '........oBBBBBBBBBBBBBo.........',
      '...........ooooooooo............',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  ],
  [ // WARRIOR
    [ // SHIELD WALL: the tower shield face-on - bright left edge, gold band
      // and boss, riveted corners
      '................................',
      '................................',
      '................................',
      '.........oooooooooooooo.........',
      '.........oCssssggssssSo.........',
      '.........oCksssggssskSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssogggGossSo.........',
      '.........oCssogWgGossSo.........',
      '.........oCssoggGGossSo.........',
      '.........oCssoooooossSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCssssggssssSo.........',
      '.........oCksssggssskSo.........',
      '.........oCssssggssssSo.........',
      '..........oCsssggsssSo..........',
      '...........oCssggssSo...........',
      '.............oCggSo.............',
      '...............oo...............',
      '................................',
      '................................',
    ],
    [ // BULL RUSH: the warrior mid-charge - head tucked, the big pauldron
      // leading, gauntlet up, legs driving, speed lines and plowed snow
      '................................',
      '................................',
      '................................',
      '................................',
      '.....................oooooo.....',
      '....................oCssssso....',
      '...................oCsssssso....',
      '...................oCskkkkso....',
      '...................oCsssssso....',
      '..............oooooossssoo......',
      '.............oCCCCCCssssso......',
      '..bbb........oCCCCssssssso......',
      '..bbb.......oCCssssssssSSo......',
      '............oCsssssssssSSo......',
      '............ossssssssssSSo......',
      '...........orrssssssssSSo.......',
      '.bbb......orrrsssssssoCWCo......',
      '..........orrrsssssssoCCCo......',
      '..........orrrrssssssooooo......',
      '..........orrrrrsssssoo.........',
      '.........orrrrrrrrroo...........',
      '........oDDDo.oDDDo.............',
      '.bb....oDDDo...oDDDo............',
      '......oDDDo.....oDDo............',
      '.....oDDDo......oDDDoo..........',
      '....oDDDDo......oDDDDDo.........',
      '....oooooo......ooooooo.........',
      '...bb............bWb..bb........',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    [ // AVALANCHE STOMP: the boot coming down, the shock chevrons and thrown
      // snow already leaving the point of impact
      '................................',
      '................................',
      '.........oooooooo...............',
      '........oWWWWWWWWo..............',
      '........obbWWWWbbo..............',
      '........oooooooooo..............',
      '.........owwwwwwuo..............',
      '.........owwwwwwuo..............',
      '.........owwgwwwuo..............',
      '.........owwwwwwuo..............',
      '.........owwwwwwuo..............',
      '.........owwwwwwuo..............',
      '.........owwwwwwuoo.............',
      '.........owwwwwwwuooo...........',
      '.........owwwwwwwwwuooo.........',
      '.........owwwwwwwwwwwuoo........',
      '.........owwwwwwwwwwwwwuo.......',
      '........oDDDDDDDDDDDDDDDDo......',
      '........oDkDDkDDkDDkDDkDDo......',
      '........oooooooooooooooooo......',
      '..........WW...WW...WW..........',
      '........WW.....WW.....WW........',
      '......bb.......bb.......bb......',
      '....bb.........BB.........bb....',
      '.........WW.........WW..........',
      '.....W.......b....b.......W.....',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    [ // FINISHING BLOW: the greatsword coming straight down - gold guard, wrapped
      // grip, a white gleam on the edge
      '................................',
      '................................',
      '..............oooo..............',
      '.............oGggGo.............',
      '..............oGGo..............',
      '..............oDko..............',
      '..............okDo..............',
      '..............oDko..............',
      '..............okDo..............',
      '..............oDko..............',
      '..........oooooooooooo..........',
      '.........oGgggggggggGo..........',
      '..........oooooooooooo..........',
      '.............oCssSo.............',
      '.............oWssSo.............',
      '.............oWssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '.............oCssSo.............',
      '..............oCSo..............',
      '..............oCSo..............',
      '...............oo...............',
      '................................',
      '................................',
    ],
  ],
];
// ---- the warrior's other four: the alternate option on each key ---------
// AB32_ALT[cls][key][k] in CLASS_AB_ALT's own order, baked by classAbIcon
// like the eight above
const AB32_ALT = [
  [[], [], [], []],
  [
    [[ // WAR CRY: the open mouth, three sound arcs rolling out
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '.......ooooo....................',
      '.....ooopppooo..................',
      '....oopppppppoo.................',
      '....oppprrrpppo.................',
      '...oopprrrrrppoo................',
      '...opprrrRrrrppoooooooooooooooo.',
      '...opprrRRRrrppoWWooggooggooGGo.',
      '...opprrrRrrrppoWWooggooggooGGo.',
      '...oopprrrrrppooWWooggooggooGGo.',
      '....oppprrrpppoWWWogggooggooGGo.',
      '....oopppppppoWWWooggoogggooGGo.',
      '.....ooopppooWWWWooggooggooGGoo.',
      '.......oooooooWWoogggooggooGGo..',
      '.............oooogggoogggoGGGo..',
      '...............ogggoogggooGGoo..',
      '...............oggoooggoooGGo...',
      '...............ooooogggooGGoo...',
      '.................oogggooGGGo....',
      '.................ogggooGGGoo....',
      '.................oooooGGGGo.....',
      '....................oGGGGoo.....',
      '....................oGGGoo......',
    ]],
    [[ // WHIRLWIND: two blades curling round the body, the sweep in white
      '................................',
      '................................',
      '................................',
      '............ooooooooo...........',
      '.........ooooWWWWWWWoooo........',
      '........ooWWWsssssssWWWoo.......',
      '.......ooWWsssssssssssWWoo......',
      '......ooWWssssooooossssWWoo.....',
      '.....ooWWsssooooooooosssWWoo....',
      '....ooWWssoooCCCCCCoooossWWo....',
      '....oWWssoooCCCCCCCo..oossWo....',
      '....oWssso.oCCCooooo...osooo....',
      '...ooWssoo.ooooo.......ooo......',
      '...oWssso.....ooooo.............',
      '...oWssoo....oogggoo............',
      '...ooooo.....oggWggo............',
      '.............ogWWWgo............',
      '.............oggWggo.....ooooo..',
      '.............oogggoo....oossWo..',
      '..............ooooo.....osssWo..',
      '.......ooo.......ooooo.oossWoo..',
      '.....oooso...oooooCCCo.osssWo...',
      '.....oWssoo..oCCCCCCCooossWWo...',
      '.....oWWssooooCCCCCCooossWWoo...',
      '.....ooWWsssooooooooosssWWoo....',
      '......ooWWssssooooossssWWoo.....',
      '.......ooWWsssssssssssWWoo......',
      '........ooWWWsssssssWWWoo.......',
      '.........ooooWWWWWWWoooo........',
      '............ooooooooo...........',
      '................................',
      '................................',
    ]],
    [[ // LEG SWEEP: a low blade across two shins, the cut a white arc
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '.........oooo......oooo.........',
      '.........ohho......ohho.........',
      '.........ohho......ohho.........',
      '.........ohho......ohho.....oooo',
      '.........ohho......ohho...oooggg',
      '.........ohho......ohho..oogggoo',
      '.........ohho......ohhooooWWWoo.',
      '.........ohho....ooohhWWWWsssso.',
      '.........ohhooooooWWWWsssssssoo.',
      '.........ohhooWWWWssssssssoooo..',
      '.....oooooWWWWssssssssooooo.....',
      '..ooooWWWWssssssssoohhoooCoo....',
      '..oWWWCCCsssssoooooohhooCCCo....',
      '..ossssCCChhooo....ohhoCCCoo....',
      '..osssooCCCnnoo...oonnCCCoo.....',
      '..oooooooCCCCCoooooCCCCCoo......',
      '........onCCCCCCCCCCCCCno.......',
      '........onnnnCCCCCCCnnnno.......',
      '........oonnnooooooonnnoo.......',
      '.........ooooo.....ooooo........',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ]],
    [[ // SECOND WIND: a heart, a breath curling up off it
      '................................',
      '.....................oooooooooo.',
      '.................ooooobbbbboobo.',
      '...............oooWWWbbooobbboo.',
      '...............oWWWoobWWWooboo..',
      '..............ooWoooobooWoooo...',
      '..............oWWo..oboooo......',
      '..............oWoo..ooo.........',
      '..........oooooWo.ooooo.........',
      '........ooorrroWooorrrooo.......',
      '.......oorppprrWWrrrrrrroo......',
      '.......orppppprrWrrrrrrrro......',
      '......oorppppprrrrrrrrrrroo.....',
      '......orrppppprrrrrrrrrrrro.....',
      '......orrrppprrrrrrrrrrrrro.....',
      '......orrrrrrrrrrrrrrrrrrro.....',
      '......oorrrrrrrrrrrrrrrrroo.....',
      '.......orrrrrrrrrrrrrrrrro......',
      '.......oorrrrrrrrrrrrrrroo......',
      '........ooorrrrrrrrrrrooo.......',
      '..........ooorrrrrrrooo.........',
      '............oorrrrroo...........',
      '.............oorrroo............',
      '..............ooroo.............',
      '...............oro..............',
      '...............oro..............',
      '...............ooo..............',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ]],
  ],
];
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
// the baked 32x32 icon for class ability (cls, i), option k (0 the first)
function classAbIcon(cls, i, k) {
  k = k | 0;
  const key = cls + ':' + i + ':' + k;
  let cv = ab32Cache.get(key);
  if (!cv) {
    cv = bakeAb32(abOptions(cls, i)[k].icon || (k ? AB32_ALT[cls][i][k - 1] : AB32[cls][i])); // a row may carry its own (ARM_AB)
    ab32Cache.set(key, cv);
  }
  return cv;
}
