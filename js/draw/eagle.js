'use strict';
// The eagle drop's pixels: a body seated on the bird and its name, both birds
// and every faller over the world, the flight trail, the roost's hp bar, the
// bird itself, the ride's HUD and the drop brief's headline. Everything here
// draws; the bird's rules, its tuning and the brief's clock are js/sim/eagle.js,
// loaded just before this.
// ------------------------------------------------------------ eagle drop pixels

// A body SEATED on the bird, drawn at (x, y) = the seat point on the feathers:
// the bottom three rows (the boots) are tucked into the plumage - a rider
// sits, it does not stand on a wing - and the body rises from that point, so
// the hem meets the bird's back and nothing floats. `set` is a pose set
// (classSet(p) or SPRITES.merchant[...]), any height.
function drawSeated(set, dir, x, y, sc, frame) {
  const spr = set[dir][frame || 0];
  const w = spr.width, keep = spr.height - 3;
  ctx.drawImage(spr, 0, 0, w, keep, Math.round(x - w * sc / 2), Math.round(y - (keep - 2) * sc), Math.round(w * sc), Math.round(keep * sc));
}
// ...and the name over a seated body, in its side's paint, two clear rows
// over the head drawSeated just drew - a tag (drawNameTag), so a wing of
// riders sorts its names out instead of stamping them on each other
function seatedName(set, dir, x, y, sc, name, team) {
  const top = Math.round(y - (set[dir][0].height - 5) * sc);
  drawNameTag(name, centreTextX(x, name), top - 8, TEAMS[skin(team)].mark);
}

// both birds, the rider and every faller, above the world and below the
// lighting. Shadows sit `alt` below (and a little right of) each body,
// converging as a dive comes down.

// `air` picks the half: false is the world pass (the path dotted over the
// snow and a bird on the ground), true the air layer (render())
function drawDropAir(ex, ey, now, air) {
  const d = state.drop;
  if (!d) return;
  // the flight path itself, dotted over the snow in each team's colour - the
  // world-space chart. The dots crawl toward the line's end so it reads as a
  // direction.
  if (!air && state.mode === 'drop') for (const e of d.eagles) {
    if (e.state !== 'fly') continue;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 9]);
    ctx.lineDashOffset = -((now * 30) % 14);
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = TEAMS[skin(e.team)].mark;
    const path = (u0, u1) => {
      const a = eaglePathAt(e, u0), b = eaglePathAt(e, u1);
      ctx.beginPath(); ctx.moveTo(a.x - ex, a.y - ey); ctx.lineTo(b.x - ex, b.y - ey); ctx.stroke();
    };
    path(0, 1);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  for (const e of d.eagles) if (dropFlies(e) === air) drawEagle(e, ex, ey, now);
  if (!air) return;
  // fallers: a hop off the wing, then the shrink from rider scale to the
  // ground's, shadow growing under them. This is a WORLD pass, so the cull is
  // against WV_*, not VIEW_* - the old VIEW_* bounds were half the zoomed-out
  // frame, which is what made fallers on the far side of it vanish mid-air.
  for (const p of players) {
    if (!p.active || p.dropT <= 0) continue;
    const q = 1 - p.dropT / HOP_FALL_T;      // 0 just stepped off .. 1 touching down
    const hop = Math.sin(Math.min(1, q * 4) * Math.PI) * 7; // the leap: up and off the wing first
    const alt = p.dropAlt * (1 - q * q) + hop; // then gravity: slow start, fast finish
    const sc = p.dropSc - (p.dropSc - 1) * q;  // from the seat's perspective size down to the ground's 1x
    const px = Math.round(p.x - ex), py = Math.round(p.y - ey);
    if (px < -40 || py < -DROP_ALT - 60 || px > WV_W + 40 || py > WV_H + 40) continue;
    const sw = Math.round(3 + 5 * q);
    ctx.fillStyle = 'rgba(40,60,100,' + (0.12 + 0.28 * q).toFixed(2) + ')';
    ctx.fillRect(px - sw, py - 1, sw * 2, 2);
    const ps = classSet(p).down[1 + (Math.floor(p.dropT * 10) % 2)];
    const dw = Math.round(16 * sc);
    ctx.drawImage(ps, Math.round(px - dw / 2), Math.round(py - alt - 12 * sc), dw, dw);
  }
}

// The WIND TRAIL: level flight tears the air. ONE continuous ribbon streams
// off each wingtip: sampled every TRAIL_STEP px back along the flown line
// for TRAIL_T seconds of flight, each sample where the tip actually WAS on
// that beat (the wing's reach and set follow the flap continuously -
// TRAIL_TIP/TRAIL_TIP_AMP, TRAIL_BACK/TRAIL_BACK_AMP - and the body's bob),
// so the ribbon waves with the wingbeat and hangs where it was torn while
// the bird flies on. It is solid at the tip and fades to nothing at its tail
// (one gradient along it, over a TRAIL_RIM dark line so white air reads over
// white snow). Pure reads of the flight clock - no particle, no sim step, the
// same trail at any dt - and the stoop fades the whole ribbon out as the bird
// tips over. Drawn at the bird's altitude, under the sprite.
const TRAIL_TIP = 19, TRAIL_TIP_AMP = 2;   // sprite px across to the wingtip, and the gentle swing the flap puts on it (the tip itself moves 4, the air behind it half that)
const TRAIL_BACK = -8, TRAIL_BACK_AMP = 3; // ...and how far back along the body it sits, and its swing
function drawEagleTrail(e, ex, ey, S, now) {
  const hc = Math.cos(e.heading), hs = Math.sin(e.heading);
  const dive = e.state === 'dive' ? Math.min(1, e.diveT / EAGLE_DIVE_T) : 0;
  if (dive >= 1) return;
  const T = e.t + (e.state === 'dive' ? e.diveT : 0);   // the flight clock: e.t stops at the line's end
  const head = Math.min(T, e.dur);                       // the ribbon's tip never leaves the line
  const n = Math.ceil(Math.min(TRAIL_T, head) * e.spd / TRAIL_STEP);
  if (n < 2) return;
  // a sample's point on the ribbon: the tip's world position `age` seconds ago
  const at = (side, age, out) => {
    const t = head - age, d = Math.min(e.spd * t, e.len);
    const ph = Math.cos((e.flap - (T - t)) * EAGLE_BEAT_HZ * 2 * Math.PI); // the flap cycle: spread -> top -> spread, EAGLE_BEAT_HZ a second
    const lat = side * (TRAIL_TIP + TRAIL_TIP_AMP * ph) * S, back = (TRAIL_BACK + TRAIL_BACK_AMP * ph) * S;
    out.x = e.x0 + hc * (d + back) - hs * lat - ex;
    out.y = e.y0 + hs * (d + back) + hc * lat - ey + Math.round(Math.sin((now - age) * 2.4 + e.team * 2.1) * 3);
  };
  const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
  ctx.save();
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    at(side, 0, a); at(side, Math.min(TRAIL_T, head), b);
    if (Math.max(a.x, b.x) < -40 || Math.max(a.y, b.y) < -40 || Math.min(a.x, b.x) > WV_W + 40 || Math.min(a.y, b.y) > WV_H + 40) continue;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      at(side, (i / n) * Math.min(TRAIL_T, head), b);
      if (i === 0) ctx.moveTo(b.x, b.y); else ctx.lineTo(b.x, b.y);
    }
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y); // solid at the tip, gone at the tail
    ctx.globalAlpha = 1 - dive;
    g.addColorStop(0, TRAIL_RIM); g.addColorStop(0.55, 'rgba(40,60,100,0.32)'); g.addColorStop(1, 'rgba(40,60,100,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.stroke();
    const w = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    w.addColorStop(0, 'rgba(255,255,255,0.95)'); w.addColorStop(0.55, 'rgba(255,255,255,0.55)'); w.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = w; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

const strokeAt = (flap, n) => Math.floor(flap * EAGLE_BEAT_HZ * n) % n;

// Perch's frames paint on first use (a few ms each), so the ones a bird is
// about to need are queued ahead (SPRITES.perch.warm): on its first frame in a
// state, every frame that state will draw - level flight's stroke; the
// stoop and the takeoff stepped a frame at a time by the same clocks
// updateEagle runs them on (the dive's turn and shrink, the takeoff's turn,
// climb and beats), so a frame is painted before it is shown; the roost's
// beats. The next state's frames go on the slow queue well before it comes:
// in flight the stoop the line's end will start (beginDive's turn onto
// findCrashPoint), at the roost the takeoff eagleFlee would fly (away from
// the map's centre). Render only: it reads the bird, never moves it.
const perchWarmed = new WeakMap();
function warmPerch(e, id) {
  const key = id + '|' + e.state;
  if (perchWarmed.get(e) === key) return;
  perchWarmed.set(e, key);
  const PR = SPRITES.perch, t = skin(e.team);
  const both = (hd, k, sc, idle) => { PR.warm(id, t, hd, k, sc, false, idle); PR.warm(id, t, hd, k, 1, true, idle); };
  const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const stoop = (h0, turn, T0, idle) => {
    for (let T = T0; T <= EAGLE_DIVE_T; T += 1 / 60) {
      const u = T / EAGLE_DIVE_T;
      both(h0 + turn * Math.min(1, u * 1.8), 'd' + Math.round(u * PR.DIVE_N), (EAGLE_SCALE - (EAGLE_SCALE - EAGLE_REST_SCALE) * u * u) / EAGLE_REST_SCALE, idle);
    }
    for (let fi = 0; fi < 3; fi++) PR.warm(id, t, h0 + turn, 'r' + fi, 1, false, idle);
  };
  const takeoff = (from, to, T0, idle) => {
    const turn = wrap(to - from);
    for (let T = T0; T <= FLEE_LIFT_T + 0.5; T += 1 / 60) {
      const u = Math.min(1, T / FLEE_LIFT_T);
      both(from + turn * u, 'l' + perchLiftBeat(T), (EAGLE_REST_SCALE + (EAGLE_SCALE - EAGLE_REST_SCALE) * u) / EAGLE_REST_SCALE, idle);
    }
  };
  if (e.state === 'fly') {
    for (let k = 0; k <= PR.STROKE_N / 2; k++) both(e.heading, 's' + k, EAGLE_SCALE / EAGLE_REST_SCALE);
    const end = eaglePathAt(e, 1), crash = findCrashPoint(e);
    stoop(e.heading, wrap(Math.atan2(crash.y - end.y, crash.x - end.x) - e.heading), 0, true);
  }
  if (e.state === 'dive') stoop(e.diveH0, e.diveTurn, e.diveT);
  if (e.state === 'down') {
    for (let fi = 0; fi < 3; fi++) PR.warm(id, t, e.heading, 'r' + fi, 1);
    const c = WORLD * TILE / 2;
    takeoff(e.heading, Math.atan2(e.y - c, e.x - c), 0, true);
  }
  if (e.state === 'flee') takeoff(e.fleeFrom, e.fleeTo, e.fleeT);
}
// the takeoff's beat at T s into it: hard and fast, from the spread
const perchLiftBeat = (T) => [0, 1, 2, 1][Math.floor(T * 13) % 4];

// the roosting bird's pool: the match is won and lost on it, so it is the
// biggest bar in the world. Even segments like every hp bar but big and few
// (PERCH_BAR_SEGS, not hpSegCount, which would split EAGLE_HP into a comb of
// 2 px blocks), a heavy ink frame, the chunk a hit just took holding pale
// before it drains (render-side: perchLag eases toward e.hp), the pool's
// number inside. `bottom` is the world row just above the bird.
const perchLag = new WeakMap();
function drawPerchBar(e, sx, bottom, now) {
  const L = perchLag.get(e) || { v: e.hp, t: now, last: now };
  if (e.hp > L.v) L.v = e.hp;                                  // healed or a new pool: no ghost
  else if (e.hp < L.v && now - L.t > PERCH_LAG_HOLD) L.v = Math.max(e.hp, L.v - PERCH_LAG_RATE * Math.max(0, now - L.last));
  if (e.hp < L.hp0) L.t = now;                                 // a fresh hit restarts the hold
  L.hp0 = e.hp; L.last = now;
  perchLag.set(e, L);
  const T = TEAMS[skin(e.team)], bw = PERCH_BAR_W, bh = PERCH_BAR_H, r = PERCH_BAR_RIM;
  const bx = Math.round(sx - bw / 2), by = bottom - r - bh;
  const fill = (v) => Math.round(bw * Math.max(0, v) / e.maxHp);
  overheadPlate(() => { // over the grade, like every frame (js/draw/light.js)
    ctx.fillStyle = BAR_FRAME; ctx.fillRect(bx - r, by - r, bw + 2 * r, bh + 2 * r);
    ctx.fillStyle = BAR_TRACK; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(bx, by, fill(L.v), bh);   // the chunk a hit just took, pale
    ctx.fillStyle = T.mark; ctx.fillRect(bx, by, fill(e.hp), bh);
    ctx.fillStyle = T.coatD; ctx.fillRect(bx, by + bh - 2, fill(e.hp), 2);  // its lower rows a step darker: weight, not a bevel
    const seg = (bw + 1) / PERCH_BAR_SEGS;
    ctx.fillStyle = HP_TICK;
    for (let k = 1; k < PERCH_BAR_SEGS; k++) ctx.fillRect(bx + k * seg - 1, by, 1, bh);
    const txt = String(Math.max(0, Math.ceil(e.hp))); // the pool's number, 1x outlined, centred in the bar
    drawWorldText(txt, centreTextX(sx, txt, 1), by + 2, '#f4f7ff', 1);
  });
}
// one bird in its team's armour, whatever its state. In the air the sprite
// sits at (x, y) with the shadow `alt` px below it; the dive walks that gap
// to zero so shadow and bird meet exactly at the crash point. It wears
// Perch's one look (SPRITES.perch.look), painted at its heading and its size in the pose of
// the moment, so the bird draws 1:1 and unrotated, its
// shadow is its own silhouette at the roost's size, and a rider on a wing
// rides that wing (SPRITES.perch.seat)
function drawEagle(e, ex, ey, now) {
  const sx = Math.round(e.x - ex), sy = Math.round(e.y - ey), t = skin(e.team);
  const PR = SPRITES.perch, look = PR.look;
  warmPerch(e, look); PR.tick(4); // paint the frames it is about to need, a few ms a frame
  if (e.state === 'fly' || e.state === 'dive') {
    const u = e.state === 'dive' ? Math.min(1, e.diveT / EAGLE_DIVE_T) : 0;
    const fall = u * u; // gravity: slow tip-over, hard finish
    const alt = DROP_ALT * (1 - fall);
    const S = EAGLE_SCALE - (EAGLE_SCALE - EAGLE_REST_SCALE) * fall; // 3x down to the roost's 2x
    // the shadow lies on the snow at the bird's TRUE size - the roost's, not
    // the nearer-the-camera flight size - and beats with the same wings
    // level flight's stroke, or the stoop's pose by how far down it is
    const key = e.state === 'fly' ? 's' + strokeAt(e.flap, PR.STROKE_N) : 'd' + Math.round(u * PR.DIVE_N), sc = S / EAGLE_REST_SCALE;
    const spr = PR.frame(look, t, e.heading, key, sc, e), shw = PR.shadow(look, t, e.heading, key, e);
    const seatAt = (st) => PR.seat(e.heading, key, sc, st);
    const w = spr.fw, h = spr.fh;
    drawEagleTrail(e, ex, ey, S, now); // before the cull: the trail hangs behind a bird already off the frame
    if (sx < -w - 40 || sy < -h - DROP_ALT - 40 || sx > WV_W + w + 40 || sy > WV_H + h + 40) return;
    const bob = flightBob(e, now);
    PR.put(ctx, shw, sx + Math.round(10 * (1 - fall)) - (shw.fw >> 1), sy + alt - (shw.fh >> 1));
    PR.put(ctx, spr, sx - Math.round(w / 2), sy + bob - Math.round(h / 2));
    // every rider seated on its wing, facing the way the bird flies, at the
    // bird's own perspective size (riderScale); the local player draws last so
    // it is never under a teammate. Only YOUR name rides the wing (in your
    // side's paint, under the gold arrow renderDropUI hangs over you): seven
    // names on one bird told a new player nothing about which one was them
    const RS = riderScale(e), rd = riderDir(e);
    { // the driver first, on the neck: the team's merchant, who climbs down at the crash
      const [dx, dy] = seatAt(PR.merchSeat);
      drawSeated(SPRITES.merchant[t], rd, sx + dx, sy + bob + dy, RS);
    }
    for (let pass = 0; pass < 2; pass++) for (const p of players) {
      if (!p.active || !p.aboard || p.team !== e.team || (p === player) !== (pass === 1)) continue;
      const [dx, dy] = seatAt(EAGLE_SEATS[p.seat % EAGLE_SEATS.length]);
      drawSeated(classSet(p), rd, sx + dx, sy + bob + dy, RS);
      if (p === player) seatedName(classSet(p), rd, sx + dx, sy + bob + dy, RS, p.name, p.team);
    }
  } else if (e.state === 'flee') {
    // driven off: the climb out. Scale and altitude walk back up from the
    // roost's to the flight's, the wings beat hard, and the bird fades out
    // over the last stretch of its escape.
    const u = Math.min(1, e.fleeT / FLEE_LIFT_T);
    const alt = DROP_ALT * u;
    const S = EAGLE_REST_SCALE + (EAGLE_SCALE - EAGLE_REST_SCALE) * u;
    const fi = perchLiftBeat(e.fleeT); // beating for its life, from the first downstroke
    const spr = PR.frame(look, t, e.heading, 'l' + fi, S / EAGLE_REST_SCALE, e), shw = PR.shadow(look, t, e.heading, 'l' + fi, e);
    const w = spr.fw, h = spr.fh;
    if (sx < -w - DROP_ALT - 40 || sy < -h - DROP_ALT - 40 || sx > WV_W + w + 40 || sy > WV_H + h + 40) return;
    const fade = Math.min(1, Math.max(0, (FLEE_T - e.fleeT) / 1.4));
    ctx.globalAlpha = 0.8 * u * fade; // the shadow returns as the ground falls away
    PR.put(ctx, shw, sx + Math.round(10 * u) - (shw.fw >> 1), sy + alt - (shw.fh >> 1));
    ctx.globalAlpha = fade;
    PR.put(ctx, spr, sx - Math.round(w / 2), sy - Math.round(h / 2));
    ctx.globalAlpha = 1;
  } else if (e.state === 'down') {
    // the roosting objective. The landing is a landing, not a wound - the
    // bird folds its wings over EAGLE_SETTLE_T and sits there breathing;
    // wings thrown open and raised (beat 0) are the gust's telegraph.
    const winding = e.windT > 0;
    // the idle's wing shuffle rides the MID beat only, in the middle of
    // RUFFLE_T (fold - shuffle - fold): the full spread stays the gust's
    const ruffling = !winding && e.ruffleT > RUFFLE_T * 0.25 && e.ruffleT < RUFFLE_T * 0.75;
    const fi = e.restT < EAGLE_SETTLE_T
      ? Math.min(2, Math.floor(e.restT / EAGLE_SETTLE_T * 3)) : (winding ? 0 : (ruffling ? 1 : 2));
    // Perch sits landed, painted at its heading
    const spr = PR.frame(look, t, e.heading, 'r' + fi, 1, e), seatAt = (st) => PR.seat(e.heading, 'r' + fi, 1, st);
    const w = spr.fw, h = spr.fh;
    if (sx > -w - 70 && sy > -h - 70 && sx < WV_W + w + 70 && sy < WV_H + h + 70) {
      // no cast shadow at rest: the bird is ON the ground, and a dark copy
      // under it read as a second bird
      const breath = winding ? -2 : (ruffling ? -1 : (e.restT >= EAGLE_SETTLE_T ? Math.round(Math.sin(now * 1.5 + e.team * 2.1)) : 0));
      PR.put(ctx, spr, sx - Math.round(w / 2), sy + breath - Math.round(h / 2));
      if (e.flash > 0) {
        ctx.globalAlpha = Math.min(1, e.flash * 7);
        PR.put(ctx, PR.flash(spr), sx - Math.round(w / 2), sy + breath - Math.round(h / 2));
        ctx.globalAlpha = 1;
      }
      // whoever rode the landing, still seated - world-sized now, the bird at
      // rest is just a big bird - breathing with it, facing where it points
      // (the local player: their first ground is this bird's back), with the
      // gold landing ring pulsing under the bird once the brief has handed
      // back - where the hop lands
      const rd = riderDir(e);
      for (const p of players) {
        if (!p.active || !p.aboard || p.team !== e.team) continue;
        const [dx, dy] = seatAt(EAGLE_SEATS[p.seat % EAGLE_SEATS.length]);
        drawSeated(classSet(p), rd, sx + dx, sy + breath + dy, 1);
        seatedName(classSet(p), rd, sx + dx, sy + breath + dy, 1, boardName(p), p.team);
      }
      if (player.aboard && player.team === e.team && state.mode === 'play' && !state.dropBrief) {
        const ph = (now * 1.2) % 1;
        ctx.globalAlpha = 0.8 - ph * 0.6;
        ctx.strokeStyle = '#ffd95c';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, sy, 10 + ph * 14, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // the pool, in team colour, up from the moment it roosts - the bar IS
      // the objective's introduction, so it never waits for a first hit.
      // Anchored to the bird's rotated extent, not the unrotated box, so it
      // hugs the sprite whatever way the dive left it pointing.
      const vh = PR.reach(spr).up;
      // in even health segments like every hp bar, but big and few: the
      // objective's bar reads from across the clearing, so PERCH_BAR_SEGS
      // is set here rather than asked of hpSegCount (which would split
      // EAGLE_HP into a comb of 2 px blocks). An end screen's frozen world
      // wears no tells (endScreen; the bodies skip theirs the same way), so
      // the bar never runs behind the podium
      if (!endScreen()) drawPerchBar(e, sx, sy - Math.round(vh) - 6, now);
    }
  }
  // the impact shockwave: two rings racing out over the crater, then gone -
  // squashed flat so they read as a blast wave along the ground, never as a
  // halo circling the bird's head
  if (e.boomT > 0) {
    const q = 1 - e.boomT / BOOM_LIFE;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.55);
    ctx.strokeStyle = '#f4f7ff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7 * (1 - q);
    ctx.beginPath(); ctx.arc(0, 0, 10 + q * 78, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = TEAMS[skin(e.team)].mark; ctx.lineWidth = 1; ctx.globalAlpha = 0.5 * (1 - q);
    ctx.beginPath(); ctx.arc(0, 0, 5 + q * 52, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// the ride's HUD: the gold arrow over you on the wing, the DRIFT key while
// you step down, and the MAP key. The wider read is the M map.
const FLIGHT_OPEN = '#ffd95c'; // the gold every "do it now" wears: your arrow on the wing, the HOP OFF key
function renderDropUI(now) {
  const d = state.drop;
  if (!d || window.DBG.hideUI) return;
  const big = VIEW_H >= 500;
  const ts = big ? 2 : 1;                   // text scale follows the zoomed-out view
  if (player.aboard) drawYouArrow(now, d.eagles[player.team]);
  else drawDropBind('move', 'DRIFT', Math.round(VIEW_W / 2), 10 * ts, '#f4f7ff', ts, true);
  // keybind indicator, bottom right: the map itself is the affordance
  if (!state.mapOpen) drawDropBind('map', 'MAP', VIEW_W - 6 * ts, VIEW_H - 12 * ts, '#9fb6d8', ts, false);
}
// the bird's bob in flight: its riders, their names and your arrow ride it
function flightBob(e, now) {
  return e.state === 'fly' ? Math.round(Math.sin(now * 2.4 + e.team * 2.1) * 3) : 0;
}
// the gold arrow over your own name on the wing, bobbing: with only your
// name riding the bird, this is the "that one is you" a first flight needs.
// World-anchored like the tag under it (seatedName: 8 px over the seated
// head, at the bird's rider scale), so it stays clear of it at every zoom
// of the opening shot.
function drawYouArrow(now, e) {
  const set = classSet(player), RS = riderScale(e);
  const tagTop = wToSY(player.y + flightBob(e, now) - (set[riderDir(e)][0].height - 5) * RS - 8);
  const b = Math.round(Math.sin(now * 5) * 1.5);
  const cx = Math.round(wToSX(player.x)), cy = Math.round(tagTop) - 9 + b;
  ctx.fillStyle = '#0f1632';
  for (let r = 0; r < 5; r++) ctx.fillRect(cx - 5 + r, cy - 1 + r, 11 - 2 * r, 2);
  ctx.fillStyle = FLIGHT_OPEN;
  for (let r = 0; r < 4; r++) ctx.fillRect(cx - 4 + r, cy + r, 9 - 2 * r, 1);
}
// an action's key cap - the shared one (drawKeyCap, js/ui/wheel.js), its
// face lit white when `lit` - with its one word beside it in `col`, the pair centred on x with its top at y.
// The roost's HOP OFF wears it.
function drawCapBind(act, verb, x, y, col, lit) {
  const vw = pixelTextWidth(verb);
  const lab = keyCap(act), x0 = Math.round(x - (pixelTextWidth(lab) + 6 + 3 + vw) / 2);
  const cw = drawKeyCap(ctx, x0, y, lab, false, lit ? 1 : 0);
  drawPixelTextOutline(ctx, verb, x0 + cw + 3, y + 3, col, '#0f1632');
}
// one of the flight HUD's two keybind indicators: `KEY - VERB` as text for
// the keyboard - the key the action is bound to (keyCap, input.js).
// Centred on x, or ending at x when `centre` is false.
function drawDropBind(act, verb, x, y, col, ts, centre) {
  const t = keyCap(act) + ' - ' + verb, w = pixelTextWidth(t, ts);
  drawPixelTextOutline(ctx, t, Math.round(centre ? x - w / 2 : x - w), y, col, '#0f1632', ts);
}

// The way off the roost, for a rider still seated after the brief: a keybind
// indicator - the work key's cap with the one word beside it, bobbing at the seated
// player's shoulder (beside, not above: above is the bird's own bar and
// whoever is standing on the far side of it) - and the gold landing ring
// pulsing under the bird (drawEagle). Play mode's UI pass, over the world (wToSX/wToSY), gone
// the moment the hop starts.
function drawHopPrompt(now) {
  if (!state.drop || !player.aboard || state.dropBrief || window.DBG.hideUI) return;
  const e = state.drop.eagles[player.team];
  if (e.state !== 'down') return;
  const bob = Math.round(Math.sin(now * 4) * 2);
  // centred over your head, its foot HOP_GAP clear of your name tag's top
  // (seatedName: the tag sits 8 world px over the seated body's head)
  const set = classSet(player), dir = riderDir(e);
  const tagTop = Math.round(wToSY(player.y - (set[dir][0].height - 5) - 8));
  const y = tagTop - HOP_GAP - 10 + bob, cx = Math.round(wToSX(player.x));
  drawCapBind('work', 'HOP OFF', cx, y, FLIGHT_OPEN, true);
}


// the brief's two headlines, one per roost: the bird on screen is the
// picture, this says what to DO about it (the headline carve-out - a match
// has exactly one win condition, and this is the once it is ever written
// down). One line, verb first, nothing under it: the roost's team colour at
// four times the drop HUD's text scale, low in the view under the bird, on
// no plate - a 2 px dark rim carries it over the pines instead. Baked opaque
// and faded as a canvas: an outline stamped under
// globalAlpha goes blotchy (the CLAUDE.md text rule).
let briefCv = null, briefCvKey = '';
function drawDropBrief() {
  const b = state.dropBrief;
  if (!b || window.DBG.hideUI) return;
  if (b.ph !== 'ours' && b.ph !== 'theirs') return;
  const hold = b.ph === 'ours' ? BRIEF_HOLD_OURS : BRIEF_HOLD;
  const a = Math.min(1, b.t / 0.25, Math.max(0, (hold - b.t) / 0.3));
  if (a <= 0) return;
  const ts = VIEW_H >= 500 ? 2 : 1; // the drop HUD's own text scale (renderDropUI)
  const key = b.ph + ts;
  if (!briefCv || briefCvKey !== key) {
    const team = b.ph === 'ours' ? player.team : 1 - player.team;
    const t1 = b.ph === 'ours' ? 'PROTECT YOUR EAGLE' : 'ATTACK THEIR EAGLE';
    const hs = BRIEF_TEXT * ts, rim = BRIEF_RIM;
    briefCv = document.createElement('canvas');
    briefCv.width = pixelTextWidth(t1, hs) + rim * 2;
    briefCv.height = 5 * hs + rim * 2;
    const c2 = briefCv.getContext('2d');
    for (let dy = -rim; dy <= rim; dy++) for (let dx = -rim; dx <= rim; dx++) {
      if (dx || dy) drawPixelText(c2, t1, rim + dx, rim + dy, '#0f1632', hs);
    }
    drawPixelText(c2, t1, rim, rim, TEAMS[skin(team)].mark, hs);
    briefCvKey = key;
  }
  ctx.globalAlpha = a;
  ctx.drawImage(briefCv, Math.round((VIEW_W - briefCv.width) / 2), Math.round(VIEW_H * BRIEF_Y));
  ctx.globalAlpha = 1;
}
