'use strict';
// The road towers' pixels (the sim: js/sim/towers.js; the grids: js/baked/tower.js).
// ------------------------------------------------------------ road towers
// A TOWER is three layers, so the gun stands IN its deck: the body
// (structSprite, laid by drawStructObj like any building, js/draw/passes.js), the
// gun at its live heading and frame on the turntable, and the deck's front
// parapet over it - drawTowerTop lays the last two and the bar, from the
// building pass. drawTowerFx, over the bodies, is
// what is in the air: the line the gun is aimed down while it winds on a
// scout, the bolt in flight, and the spent one standing in the snow.
const TOWER_RIM = '#0d1226';    // the dark shadow pixel under the aim line, so it reads on snow
const TOWER_HEADS = 16;          // the baked headings (app/bake-tower/bake.py)
const TOWER_LOOSE_SHOW = 0.15;   // s the loosed frame holds before the winding starts
const TOWER_PIN_FADE = 0.6;      // s a spent bolt takes to fade out at the end of its TOWER_PIN_T

// which baked heading a bearing (rad, 0 = east, clockwise) is
function towerHead(a) {
  const n = TOWER_HEADS, i = Math.round(a / (Math.PI * 2 / n));
  return ((i % n) + n) % n;
}
// THE GUN'S FRAME, off the sim's own clocks: LOOSED for a beat after a
// loose, then WINDING and WOUND through the reload, and LOADED once it is
// done - the string coming back IS the reload, and a loaded gun is the threat
function towerFrame(o) {
  if (state.elapsed - (o.loose || -9) < TOWER_LOOSE_SHOW) return 1;
  if (!(o.cd > 0)) return 0;
  const p = 1 - o.cd / TOWER_RELOAD;
  return p < 0.34 ? 1 : p < 0.67 ? 2 : 3;
}
// the turntable's centre, px from the body sprite's top-left
function towerTurn() { return SPRITES.towerAt.turn; }
// ...and in the world: where the gun stands, and the bolt leaves from
function towerGunAt(o) {
  const spr = structSprite(o), off = structArtOff(o, spr), t = towerTurn();
  return { x: o.tx * TILE + off.x + t[0], y: o.ty * TILE + off.y + t[1] };
}
// the gun, the front parapet and the bar, over a body laid at (sx, sy)
function drawTowerTop(o, sx, sy) {
  const set = SPRITES.teamBuild[skin(o.team)], t = towerTurn(), g = SPRITES.towerAt.gun;
  const gun = set.towerGun[towerHead(o.ang || 0)][towerFrame(o)];
  drawSpriteFlash(gun, sx + t[0] + g[0], sy + t[1] + g[1], o.flash);
  drawSpriteFlash(set.towerFront, sx, sy, o.flash);
  // the bar stands over the tallest the gun ever gets, always up: a tower is
  // a thing to bring down, and how far along that is is the whole read
  drawHealthBar(sx + (structSprite(o).width >> 1), sy + t[1] + g[1] - 2, o.hp, o.maxHp, evenBarW(40), o.team, undefined, o);
}

function drawTowerFx(ex, ey, now) {
  for (const o of structures) {
    if (o.type !== 'tower') continue;
    const tm = TEAMS[skin(o.team)], gun = towerGunAt(o), foot = towerFoot(o);
    const gx = Math.round(gun.x - ex), gy = Math.round(gun.y - ey);
    if (gx < -260 || gy < -260 || gx > WV_W + 260 || gy > WV_H + 260) continue;
    const tg = o.tgt;
    // THE AIM: while it winds on a SCOUT, a dashed line on the snow from the
    // tower's foot to theirs, crawling toward them and brightening as the
    // string comes back, and a ring at their feet - the loose is coming, and
    // the way out of it is out of the ring. (A bot is never warned.)
    if (tg instanceof Player && o.chg > 0.02 && !o.bolt && fogShown(tg, now)) {
      const hot = o.chg > 0.85, crawl = Math.floor(now * 14);
      const dx = tg.x - foot.x, dy = tg.y + 4 - foot.y, L = Math.hypot(dx, dy) || 1, n = Math.floor(L / 2);
      ctx.globalAlpha = 0.3 + 0.6 * o.chg;
      for (let i = 4; i < n; i++) {
        if ((i - crawl) % 4 >= 2) continue;
        const x = Math.round(foot.x + dx * i / n - ex), y = Math.round(foot.y + dy * i / n - ey);
        ctx.fillStyle = TOWER_RIM; ctx.fillRect(x, y + 1, 1, 1);
        ctx.fillStyle = hot ? '#ffffff' : tm.mark; ctx.fillRect(x, y, 1, 1);
      }
      const rx = Math.round(tg.x - ex), ry = Math.round(tg.y + 4 - ey), r = Math.round(9 - 3 * o.chg);
      for (let a = 0; a < 24; a++) {
        if (a % 2) continue;
        const x = Math.round(rx + Math.cos(a / 24 * Math.PI * 2) * r), y = Math.round(ry + Math.sin(a / 24 * Math.PI * 2) * r * 0.55);
        ctx.fillStyle = TOWER_RIM; ctx.fillRect(x, y + 1, 1, 1);
        ctx.fillStyle = hot ? '#ffffff' : tm.mark; ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const set = SPRITES.teamBuild[skin(o.team)], bo = SPRITES.towerAt.bolt;
    // THE BOLT in the air, from the gun's nose to the mark's chest
    if (o.bolt && unitAlive(o.bolt.tg)) {
      const b = o.bolt, k = Math.min(1, b.t / TOWER_BOLT_T);
      const s0 = { x: gun.x + Math.cos(o.ang) * 14, y: gun.y + Math.sin(o.ang) * 9 - 10 };
      const s1 = { x: b.tg.x, y: b.tg.y - 6 };
      const x = s0.x + (s1.x - s0.x) * k, y = s0.y + (s1.y - s0.y) * k;
      const spr = set.towerBolt[towerHead(Math.atan2(s1.y - s0.y, s1.x - s0.x))];
      ctx.drawImage(spr, Math.round(x - ex) + bo[0], Math.round(y - ey) + bo[1]);
    }
    // THE SPENT BOLT, its head driven into the snow at the mark's feet and
    // its tail standing up the way it came: the far half of the in-flight
    // sprite is clipped off along its own line
    if (o.pin) {
      const p = o.pin, a = Math.atan2(p.y - p.fy, p.x - p.fx);
      const spr = set.towerBolt[towerHead(a)], ha = towerHead(a) * Math.PI * 2 / TOWER_HEADS;
      const qx = Math.round(p.x - ex), qy = Math.round(p.y - ey); // where it went in: the clip's edge
      const cx = Math.round(qx - Math.cos(ha) * 3), cy = Math.round(qy - Math.sin(ha) * 3); // the sprite's middle, a little short of it
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.t / TOWER_PIN_FADE);
      ctx.beginPath();
      const nx = -Math.sin(ha), ny = Math.cos(ha), R = 40;
      ctx.moveTo(qx + nx * R, qy + ny * R); ctx.lineTo(qx - nx * R, qy - ny * R);
      ctx.lineTo(qx - nx * R - Math.cos(ha) * R, qy - ny * R - Math.sin(ha) * R);
      ctx.lineTo(qx + nx * R - Math.cos(ha) * R, qy + ny * R - Math.sin(ha) * R);
      ctx.closePath(); ctx.clip();
      ctx.drawImage(spr, cx + bo[0], cy + bo[1]);
      ctx.restore();
      ctx.fillStyle = '#eef4fb'; ctx.fillRect(Math.round(p.x - ex) - 2, Math.round(p.y - ey), 4, 1); // the snow heaped where it went in
    }
  }
}

// the whole tower standing loaded, the gun on the road, as one canvas per
// side's skin: the wiki's figure (WIKI_WORLD, js/ui/wiki.js)
const towerFigs = [];
function towerFigure(sk) {
  if (towerFigs[sk]) return towerFigs[sk];
  const set = SPRITES.teamBuild[sk], body = set.tower[0], t = towerTurn(), g = SPRITES.towerAt.gun;
  const gun = set.towerGun[6][0], top = Math.min(0, t[1] + g[1]);
  const c = document.createElement('canvas'); c.width = body.width; c.height = body.height - top;
  const x = c.getContext('2d');
  x.drawImage(body, 0, -top); x.drawImage(gun, t[0] + g[0], t[1] + g[1] - top); x.drawImage(set.towerFront, 0, -top);
  return (towerFigs[sk] = c);
}
