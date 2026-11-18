'use strict';
// The eagles' pixels: both birds, the roost's hp bar and the match's opening
// headline. Everything here draws; the bird's rules, its tuning and the
// headline's clock are js/sim/eagle.js, loaded just before this.
// ------------------------------------------------------------ eagle pixels

// both birds: `air` picks the half - false is the world pass (a bird on its
// perch), true the air layer (render(): a bird driven off and climbing)
function drawEagles(ex, ey, now, air) {
  const d = state.drop;
  if (!d) return;
  for (const e of d.eagles) if (eagleAloft(e) === air) drawEagle(e, ex, ey, now);
}

// A body SEATED on the bird, drawn at (x, y) = the seat point on the feathers:
// the bottom three rows (the boots) are tucked into the plumage - a rider
// sits, it does not stand on a wing - and the body rises from that point, so
// the hem meets the bird's back and nothing floats. `set` is a pose set
// (classSet(p) or SPRITES.merchant[...]), any height.
function drawSeated(set, dir, x, y, sc) {
  const spr = set[dir][0];
  const w = spr.width, keep = spr.height - 3;
  ctx.drawImage(spr, 0, 0, w, keep, Math.round(x - w * sc / 2), Math.round(y - (keep - 2) * sc), Math.round(w * sc), Math.round(keep * sc));
}
// ...and your own name over your seated body, in your side's paint, two
// clear rows over the head: only yours rides the bird, so you find yourself
function seatedName(set, dir, x, y, sc, name, team) {
  const top = Math.round(y - (set[dir][0].height - 5) * sc);
  overheadPlate(() => drawWorldText(name, centreTextX(x, name), top - 8, TEAMS[skin(team)].mark)); // over the grade, like every name
}
// which way a rider faces: the bird's heading's main axis, so a crew coming
// down the lane side shows its fronts and one riding across its profiles
function riderDir(e) {
  const c = Math.cos(e.heading), s = Math.sin(e.heading);
  return Math.abs(c) >= Math.abs(s) ? (c > 0 ? 'right' : 'left') : (s > 0 ? 'down' : 'up');
}
// the riders on a bird drawn with pose `key` at scale `sc` (its size over the
// roost's) at screen (sx, sy): the merchant on the neck first, then the
// crew on their seats, your own body last so a teammate never covers it
function drawRiders(e, key, sc, sx, sy) {
  const PR = SPRITES.perch, t = skin(e.team), rd = riderDir(e);
  const seatAt = (st) => PR.seat(e.heading, key, sc, st);
  if (merchAboard(e.merchant || {})) { const [dx, dy] = seatAt(PR.merchSeat); drawSeated(SPRITES.merchant[t], rd, sx + dx, sy + dy, sc); }
  for (let pass = 0; pass < 2; pass++) for (const p of players) {
    if (!p.active || !p.aboard || p.team !== e.team || (p === player) !== (pass === 1)) continue;
    const [dx, dy] = seatAt(EAGLE_SEATS[p.seat % EAGLE_SEATS.length]);
    drawSeated(classSet(p), rd, sx + dx, sy + dy, sc);
    if (p === player && !window.DBG.hideUI) seatedName(classSet(p), rd, sx + dx, sy + dy, sc, p.name, p.team);
  }
}
// the arrival's pose at u (0..1 of the glide): the stoop's whole sequence,
// wings swept back and thrown open to land (Perch's dive keys)
const arrivePose = (u) => 'd' + Math.round(Math.min(1, u) * SPRITES.perch.DIVE_N);

// Perch's frames paint on first use (a few ms each), so the ones a bird is
// about to need are queued ahead (SPRITES.perch.warm): at the roost its
// beats and, on the slow queue well before it comes, the takeoff eagleFlee
// would fly (away from the map's centre); in the takeoff, every frame it
// steps through by the clock updateEagle runs it on. Render only: it reads
// the bird, never moves it.
const perchWarmed = new WeakMap();
function warmPerch(e, id) {
  const key = id + '|' + e.state;
  if (perchWarmed.get(e) === key) return;
  perchWarmed.set(e, key);
  const PR = SPRITES.perch, t = skin(e.team);
  const both = (hd, k, sc, idle) => { PR.warm(id, t, hd, k, sc, false, idle); PR.warm(id, t, hd, k, 1, true, idle); };
  const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const takeoff = (from, to, T0, idle) => {
    const turn = wrap(to - from);
    for (let T = T0; T <= FLEE_LIFT_T + 0.5; T += 1 / 60) {
      const u = Math.min(1, T / FLEE_LIFT_T);
      both(from + turn * u, 'l' + perchLiftBeat(T), (EAGLE_REST_SCALE + (EAGLE_SCALE - EAGLE_REST_SCALE) * u) / EAGLE_REST_SCALE, idle);
    }
  };
  if (e.state === 'down') {
    for (let fi = 0; fi < 3; fi++) PR.warm(id, t, e.heading, 'r' + fi, 1);
    const c = WORLD * TILE / 2;
    takeoff(e.heading, Math.atan2(e.y - c, e.x - c), 0, true);
  }
  if (e.state === 'flee') takeoff(e.fleeFrom, e.fleeTo, e.fleeT);
  if (e.state === 'arrive') { // the whole glide, by the clock updateArrive runs it on, and the roost's beats it lands in
    for (let T = e.arriveT; T <= ARRIVE_T; T += 1 / 60) {
      const u = T / ARRIVE_T, k = 1 - (1 - u) * (1 - u);
      both(e.heading, arrivePose(u), (EAGLE_REST_SCALE + (EAGLE_SCALE - EAGLE_REST_SCALE) * (1 - k)) / EAGLE_REST_SCALE);
    }
    for (let fi = 0; fi < 3; fi++) PR.warm(id, t, e.heading, 'r' + fi, 1, false, true);
  }
}
// the takeoff's beat at T s into it: hard and fast, from the spread
const perchLiftBeat = (T) => [0, 1, 2, 1][Math.floor(T * 13) % 4];

// the roosting bird's pool: the match is won and lost on it, so it is the
// widest bar in the world, yet quieter than the bird it stands over. Even
// segments like every hp bar but few (PERCH_BAR_SEGS, not hpSegCount, which
// would split EAGLE_HP into a comb of 2 px blocks), a body's own ink frame, the chunk a hit just took holding pale
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
    drawWorldText(txt, centreTextX(sx, txt, 1), by + 1, '#f4f7ff', 1);
  }, true); // under every body's plate: a hero standing beneath keeps its name
}
// one bird in its team's armour, whatever its state. Climbing away, the
// sprite sits at (x, y) with the shadow `alt` px below it. It wears Perch's
// one look (SPRITES.perch.look), painted at its heading and its size in the
// pose of the moment, so the bird draws 1:1 and unrotated, and its shadow is
// its own silhouette at the roost's size
function drawEagle(e, ex, ey, now) {
  const sx = Math.round(e.x - ex), sy = Math.round(e.y - ey), t = skin(e.team);
  const PR = SPRITES.perch, look = PR.look;
  warmPerch(e, look); PR.tick(4); // paint the frames it is about to need, a few ms a frame
  if (e.state === 'arrive') {
    // the arrival: down its line onto the perch, its side on its back. The
    // shadow lies on the snow at the bird's true size, `alt` px under it and
    // a little to the right, and meets it at the touchdown
    const u = Math.min(1, e.arriveT / ARRIVE_T), alt = eagleAlt(e), sc = eagleScale(e) / EAGLE_REST_SCALE;
    const key = arrivePose(u);
    const spr = PR.frame(look, t, e.heading, key, sc, e), shw = PR.shadow(look, t, e.heading, key, e);
    const w = spr.fw, h = spr.fh;
    if (sx < -w - DROP_ALT - 40 || sy < -h - DROP_ALT - 40 || sx > WV_W + w + 40 || sy > WV_H + h + DROP_ALT + 40) return;
    ctx.globalAlpha = 0.8;
    PR.put(ctx, shw, sx + Math.round(10 * alt / DROP_ALT) - (shw.fw >> 1), sy + Math.round(alt) - (shw.fh >> 1));
    ctx.globalAlpha = 1;
    PR.put(ctx, spr, sx - Math.round(w / 2), sy - Math.round(h / 2));
    drawRiders(e, key, sc, sx, sy);
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
    // the roosting objective. At the match's start the bird folds its
    // wings over EAGLE_SETTLE_T and sits there breathing;
    // wings thrown open and raised (beat 0) are the gust's telegraph.
    const winding = e.windT > 0;
    // the idle's wing shuffle rides the MID beat only, in the middle of
    // RUFFLE_T (fold - shuffle - fold): the full spread stays the gust's
    const ruffling = !winding && e.ruffleT > RUFFLE_T * 0.25 && e.ruffleT < RUFFLE_T * 0.75;
    const fi = e.restT < EAGLE_SETTLE_T
      ? Math.min(2, Math.floor(e.restT / EAGLE_SETTLE_T * 3)) : (winding ? 0 : (ruffling ? 1 : 2));
    // Perch sits landed, painted at its heading
    const spr = PR.frame(look, t, e.heading, 'r' + fi, 1, e);
    const w = spr.fw, h = spr.fh;
    if (sx > -w - 70 && sy > -h - 70 && sx < WV_W + w + 70 && sy < WV_H + h + 70) {
      // no cast shadow at rest: the bird is ON the ground, and a dark copy
      // under it read as a second bird
      const breath = winding ? -2 : (ruffling ? -1 : (e.restT >= EAGLE_SETTLE_T ? Math.round(Math.sin(now * 1.5 + e.team * 2.1)) : 0));
      PR.put(ctx, spr, sx - Math.round(w / 2), sy + breath - Math.round(h / 2));
      drawRiders(e, 'r' + fi, 1, sx, sy + breath); // the crew, for the beat between the touchdown and the step off
      if (e.flash > 0) {
        ctx.globalAlpha = Math.min(1, e.flash * 7);
        PR.put(ctx, PR.flash(spr), sx - Math.round(w / 2), sy + breath - Math.round(h / 2));
        ctx.globalAlpha = 1;
      }
      // the pool, in team colour, up from the moment it roosts - the bar IS
      // the objective's introduction, so it never waits for a first hit.
      // Anchored to the bird's rotated extent, not the unrotated box, so it
      // hugs the sprite whatever way it points.
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
  // the gust's shockwave: two rings racing out over the roost, then gone -
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

// the opening headline: PROTECT YOUR EAGLE, low in the view under your
// own roost, every match, while its wings settle (HEADLINE_IN, HEADLINE_HOLD
// off the bird's own restT, so a client shows it on the same beat). The
// headline carve-out: a match has exactly one win condition, and this is the
// once it is ever written down (and once more in a FIRST MATCH, over their roost). Verb first, nothing under it, in your side's
// paint at HEADLINE_TEXT times the big view's text scale, on no plate - a
// dark rim carries it over the pines. Baked opaque and faded as a canvas: an
// outline stamped under globalAlpha goes blotchy (the CLAUDE.md text rule).
function drawDropHeadline() {
  const e = state.drop && state.drop.eagles[player.team];
  if (!e || e.state !== 'down' || window.DBG.hideUI || endScreen()) return;
  const t = e.restT - HEADLINE_IN;
  drawHeadline('PROTECT YOUR EAGLE', player.team, Math.min(1, t / 0.25, Math.max(0, (HEADLINE_HOLD - t) / 0.4)));
}
// a headline in a side's paint at alpha a, where the opening's stands (the
// FIRST MATCH's ride to their roost writes its one line the same way,
// guideTourDraw, js/ui/guide.js). Baked per text, side and scale.
const headCvs = new Map();
function drawHeadline(text, team, a) {
  if (a <= 0) return;
  const ts = VIEW_H >= 500 ? 2 : 1; // text scale follows the zoomed-out view
  const key = text + ':' + skin(team) + ':' + ts;
  let cv = headCvs.get(key);
  if (!cv) {
    const hs = HEADLINE_TEXT * ts, rim = HEADLINE_RIM;
    cv = document.createElement('canvas');
    cv.width = pixelTextWidth(text, hs) + rim * 2;
    cv.height = 5 * hs + rim * 2;
    const c2 = cv.getContext('2d');
    for (let dy = -rim; dy <= rim; dy++) for (let dx = -rim; dx <= rim; dx++) {
      if (dx || dy) drawPixelText(c2, text, rim + dx, rim + dy, '#0f1632', hs);
    }
    drawPixelText(c2, text, rim, rim, TEAMS[skin(team)].mark, hs);
    headCvs.set(key, cv);
  }
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(cv, Math.round((VIEW_W - cv.width) / 2), Math.round(VIEW_H * HEADLINE_Y));
  ctx.globalAlpha = 1;
}
