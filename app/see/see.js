// See the game: one place on the one map, as a player has it and pixel for pixel.
// Serves this tree itself (no app/server.js needed), plays nothing: it stages the spot,
// holds the clock, and writes PNGs no bigger than an eye takes in whole (1280x720),
// every one on whole pixels. Read docs/dev/see.md for what to look at and when.
//
//   node app/see/see.js --spots                         every named place, off the live map
//   node app/see/see.js --spot orca --out W/orca        three looks of one place:
//       far-<hour>.png    the world layer, 1 px a world px: the place in its surroundings
//       play-<hour>.png   the screen at the resting zoom, HUD and all (4 px a world px)
//       close-<hour>.png  the world layer round the spot, 8 px a world px
//   node app/see/see.js --map --out W/map               the whole map in one piece, its
//       quarters at 1 px a world px, and a half-size chart with every place named
//
//   --spot NAME[+dx,dy]   a place off --spots ('orca', 'wolf-den-w', 'lane-top-mid+0,-40'),
//                         '@X,Y' world px or 'tTX,TY' a tile; a part of a name is enough
//   --time day,night      hours to shoot: dawn morning day dusk night, or seconds (default day)
//   --hero A@dx,dy,...    heroes round the spot: NAME[@dx,dy][:foe][:left|right|up|down], the
//                         first the local player (default ARMATOS, on open ground beside the
//                         spot); 'none' for nobody
//   --put F.png@dx,dy:M   unbuilt art in the world: M is ground (flat, on its centre), stand
//                         (in the sort, on its bottom centre, with its shade) or beast (a
//                         camp beast wearing it, health frame and all); a comma joins several
//   --swap KEY=F.png      unbuilt art in place of a sprite the game draws: wolf, den,
//                         teamBuild.0.stall (a path under SPRITES); [--face left|right]
//   --vs [REF]            today beside new: REF (a commit, default origin/main) against this
//                         tree. With --put or --swap and no --vs, today is this tree without
//                         the art. Writes vs-*.png and counts the pixels that differ.
//   --strip N[@T]         N frames T ticks apart (default 6) of the close look in one sheet,
//                         the sim running: an idle, a sway, a walk-in
//   --do FILE.js          staging of your own, run in the page once the stage is set, with
//                         S (SEE), M (MEDIA), D (DBG) and at = [x, y]; --ticks N runs the sim after
//   --stocked             every camp out now, the timed ones too (the orca, the bear)
//   --weather NAME        calm snow blizzard frost (default calm); --fog keeps the fog of war
//   --boxes               the hitbox overlay ('.' in game)
//   --bare                no health plates, no names, no world text
//   --seed N --close 8 --size 720|1080 (1080 is for people: an eye resamples it)
// Prints one JSON line: every file written, and what differed.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { open, args, sleep } = require('../media/browser');

const ROOT = path.join(__dirname, '..', '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const EYE = 1568; // px: a picture longer than this on a side is shrunk on its way to a reader's eye

// a tree served as itself on a free port
function serve(root) {
  return new Promise((done) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(root, path.normalize(rel));
      if (!file.startsWith(root)) { res.writeHead(400); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => done({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}
// another commit's files, written out whole into a temp folder (app/check-same.js does the same)
function exportRef(ref) {
  const sha = execFileSync('git', ['rev-parse', '--verify', ref + '^{commit}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'see-'));
  execFileSync('sh', ['-c', 'git archive "$1" | tar -x -C "$2"', 'sh', sha, dir], { cwd: ROOT });
  return { sha, dir };
}
// before any game script: a seeded Math.random, a clock only a tick moves, and the page
// frozen the moment boot.js sets DBG, so two loads of one tree paint the same pixels
function preload() {
  let r = 12345;
  Math.random = () => ((r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 4294967296);
  window.__seeT = 1000;
  performance.now = () => window.__seeT;
  Date.now = () => 1767225600000 + window.__seeT;
  let d;
  Object.defineProperty(window, 'DBG', { configurable: true, get: () => d, set: (v) => { v.freeze = true; d = v; } });
}
const dataUrl = (file) => { if (!fs.existsSync(file)) throw new Error('no file ' + file); return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'); };
const save = (file, url) => { fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); return file; };
// 'A@1,2:foe,B@3,4' is two things: a comma inside a pair of numbers does not split
const list = (v) => String(v == null || v === true ? '' : v).split(',').filter(Boolean).reduce((a, t) => (/^-?[\d.]+(:.*)?$/.test(t) && a.length ? a[a.length - 1] += ',' + t : a.push(t), a), []);

// a game page on `root`, the stage set as asked; `art` false leaves the unbuilt art out
async function stage(root, A, art) {
  const { srv, url } = await serve(root);
  const W = A.size === '1080' ? [1920, 1080] : [1280, 720];
  const pg = await open({ width: W[0], height: W[1], dpr: 1 });
  const info = { pg, close: () => { srv.close(); return pg.close(); } };
  try {
    await pg.preload('(' + preload + ')()');
    await pg.goto(url + '/?seed=' + (+A.seed || 7));
    await sleep(300);
    if (await pg.eval(() => typeof DBG === 'undefined')) throw new Error('the game did not load from ' + root);
    await pg.inject(path.join(__dirname, '..', 'media', 'stage.js'));
    await pg.inject(path.join(__dirname, 'page.js'));
    info.boot = await pg.eval((o) => SEE.boot(o), { weather: A.weather, fog: !!A.fog, stocked: !!A.stocked, mute: A.bare ? ['overheadPlate', 'drawWorldText'] : [] });
    if (!A.spots && !A.map) await dress(pg, A, art, info);
  } catch (e) { await info.close().catch(() => {}); throw e; } // a stage that failed leaves no browser behind
  return info;
}
// the spot, its heroes, the unbuilt art and the caller's own staging
async function dress(pg, A, art, info) {
  info.spot = await pg.eval((q) => { const s = SEE.find(q); SEE.focus = [s.x, s.y]; return s; }, String(A.spot || 'centre'));
  info.heroes = await pg.eval((h) => SEE.heroes(h, SEE.focus), A.hero === 'none' ? [] : list(A.hero || 'ARMATOS'));
  info.art = [];
  if (art) {
    for (const s of list(A.swap)) { const [key, file] = s.split('='); info.art.push(await pg.eval((k, u, f) => SEE.swap(k, u, f), key, dataUrl(file), A.face || 'left')); }
    for (const p of list(A.put)) {
      const m = /^(.+?)@(-?[\d.]+),(-?[\d.]+)(?::(ground|stand|beast))?$/.exec(p);
      if (!m) throw new Error('--put is FILE.png@dx,dy[:ground|stand|beast], not "' + p + '"');
      info.art.push(await pg.eval((u, dx, dy, mode, f) => SEE.put(u, dx, dy, mode, f), dataUrl(m[1]), +m[2], +m[3], m[4] || 'stand', A.face || 'left'));
    }
  }
  if (A.boxes) await pg.eval(() => { settings.hitbox = 2; });
  await pg.eval((n) => SEE.run(n), A.weather && A.weather !== 'calm' ? 420 : 20);
  if (A.do) await pg.eval('(function (S, M, D, at) {' + fs.readFileSync(A.do, 'utf8') + '\n})(SEE, MEDIA, DBG, SEE.focus)');
  if (A.ticks) await pg.eval((n) => SEE.run(n), +A.ticks);
}

// the three looks of the spot at one hour, as data URLs
async function looks(pg, A, hour) {
  const C = +A.close || 8;
  return pg.eval((hour, C) => {
    const [x, y] = SEE.focus, o = { hour: SEE.time(hour) };
    o.far = SEE.world(x, y, 1280, 720, 1);
    o.close = SEE.world(x, y, Math.floor(1280 / C), Math.floor(720 / C), C);
    o.view = SEE.world(x, y, 320, 180, 2);
    SEE.aim(x, y, 2 * devScale, true);
    o.play = SEE.screen();
    return o;
  }, hour, C);
}

// today beside new at one hour. The world layer is compared at 1 px a world px (far, and
// the close look's own window of it), the screen in device px; each sheet shows the two
// whole, and the change alone goes up as big as whole pixels allow when it is small.
async function versus(pg, a, b, title, dir, hour, C, dev) {
  const sheet = async (file, panels, t) => save(path.join(dir, file), (await pg.eval((p, t) => SEE.sheet(p, 2, t), panels, t)).url);
  const pair = (ua, ub, crop, scale) => [{ url: ua, label: 'TODAY', crop, scale }, { url: ub, label: 'NEW', crop, scale }];
  const said = (d) => (d.changed ? d.changed + ' PX DIFFER' : 'NO PIXEL DIFFERS');
  const cw = Math.floor(1280 / C), ch = Math.floor(720 / C), near = [640 - (cw >> 1), 360 - (ch >> 1), cw, ch], out = [];
  // close: the spot's own window of the world layer, both whole at half the close look's scale
  const dc = await pg.eval((x, y, r) => SEE.diff(x, y, r), a.far.url, b.far.url, near);
  const vc = { look: 'close-' + hour, changed: dc.changed || 0, unit: 'world px', file: await sheet('vs-close-' + hour + '.png', pair(a.far.url, b.far.url, near, C >> 1), title + ' CLOSE ' + hour + '   ' + said(dc)) };
  if (dc.changed) {
    vc.box = dc.box;
    const zc = [Math.max(0, dc.box[0] - 6), Math.max(0, dc.box[1] - 6), dc.box[2] + 12, dc.box[3] + 12], z = Math.min(Math.floor(632 / zc[2]), Math.floor(700 / zc[3]), 16);
    if (z > C >> 1) vc.zoom = await sheet('vs-close-' + hour + '-zoom.png', pair(a.far.url, b.far.url, zc, z), title + ' THE CHANGE, ' + z + ' PX A WORLD PX');
  }
  out.push(vc);
  // play: the two screens whole, a game px an image px (the HUD's own grid, so still whole pixels)
  const dp = await pg.eval((x, y) => SEE.diff(x, y), a.play.url, b.play.url);
  out.push({ look: 'play-' + hour, changed: dp.changed || 0, unit: 'screen px', box: dp.box, file: await sheet('vs-play-' + hour + '.png', pair(a.play.url, b.play.url, null, 1 / dev), title + ' PLAY ' + hour + '   ' + said(dp)) });
  // far: the middle of both at 1 px a world px, and the whole frame with what changed left in colour
  const df = await pg.eval((x, y) => SEE.diff(x, y), a.far.url, b.far.url);
  const vf = { look: 'far-' + hour, changed: df.changed || 0, unit: 'world px', box: df.box, file: await sheet('vs-far-' + hour + '.png', pair(a.far.url, b.far.url, [324, 0, 632, 720], 1), title + ' FAR ' + hour + '   ' + said(df)) };
  if (df.changed) vf.where = save(path.join(dir, 'changed-far-' + hour + '.png'), df.url);
  out.push(vf);
  return out;
}

async function shootSpot(A, sides, dir) {
  const hours = list(A.time || 'day'), out = { files: [], vs: [] };
  const got = [];
  for (const side of sides) {
    const d = side.name === 'today' && sides.length > 1 ? path.join(dir, 'today') : dir;
    fs.mkdirSync(d, { recursive: true });
    const row = { side, by: {} };
    for (const h of hours) {
      const L = row.by[h] = await looks(side.st.pg, A, h);
      for (const k of ['far', 'play', 'close']) out.files.push(save(path.join(d, k + '-' + h + '.png'), L[k].url));
    }
    got.push(row);
  }
  // art the game does not have yet is STAGED, and every sheet that shows it says so
  const now = got[got.length - 1], pg = now.side.st.pg, spot = (now.side.st.art.length ? 'STAGED  ' : '') + now.side.st.spot.name.toUpperCase();
  if (hours.length > 1) {
    const sh = await pg.eval((p, t) => SEE.sheet(p, 2, t), hours.map((h) => ({ url: now.by[h].view.url, label: h })), spot + '   THE HOURS, 2 PX A WORLD PX');
    out.files.push(save(path.join(dir, 'hours.png'), sh.url));
  }
  if (got.length > 1) for (const h of hours) out.vs.push(...await versus(pg, got[0].by[h], now.by[h], spot, dir, h, +A.close || 8, now.side.st.boot.devScale));
  if (A.strip) {
    const [n, t] = String(A.strip).split('@').map(Number), frames = [];
    await pg.eval((h) => SEE.time(h), hours[0]);
    for (let i = 0; i < n; i++) {
      frames.push(await pg.eval((t, i) => { if (i) SEE.run(t); const [x, y] = SEE.focus; return { url: SEE.world(x, y, 160, 90, 2).url, label: 'T+' + i * t }; }, t || 6, i));
    }
    const sh = await pg.eval((p, t) => SEE.sheet(p, 4, t), frames, spot + '   ' + n + ' FRAMES, ' + (t || 6) + ' TICKS APART, 2 PX A WORLD PX');
    out.files.push(save(path.join(dir, 'strip.png'), sh.url));
  }
  out.spot = now.side.st.spot; out.heroes = now.side.st.heroes; out.art = now.side.st.art;
  return out;
}

async function shootMap(A, sides, dir) {
  const out = { files: [], vs: [] }, hour = list(A.time || 'day')[0], maps = [];
  for (const side of sides) {
    const d = side.name === 'today' && sides.length > 1 ? path.join(dir, 'today') : dir, pg = side.st.pg;
    fs.mkdirSync(d, { recursive: true });
    const m = await pg.eval((h) => { SEE.heroes([], [0, 0]); SEE.time(h); return SEE.map(); }, hour);
    const n = m.size, hx = n >> 1;
    out.files.push(save(path.join(d, 'map.png'), await pg.eval((n) => SEE.mapPart(0, 0, n, n), n)));
    for (const [q, x, y] of [['nw', 0, 0], ['ne', hx, 0], ['sw', 0, hx], ['se', hx, hx]]) out.files.push(save(path.join(d, 'map-' + q + '.png'), await pg.eval((x, y, w) => SEE.mapPart(x, y, w, w), x, y, hx)));
    out.files.push(save(path.join(d, 'map-spots.png'), await pg.eval(() => SEE.mapSpots())));
    out.map = m; maps.push(path.join(d, 'map.png'));
    if (m.seam) console.error('see: ' + m.seam + ' px disagree across the joins of the ' + side.name + ' map: something draws by the view, not by the world');
  }
  if (maps.length > 1) {
    const pg = sides[1].st.pg, d = await pg.eval((a, b) => SEE.diff(a, b), dataUrl(maps[0]), dataUrl(maps[1]));
    const v = { look: 'map', changed: d.changed || 0 };
    if (d.changed) { v.box = d.box; v.where = save(path.join(dir, 'changed-map.png'), d.url); }
    out.vs.push(v);
  }
  return out;
}

(async () => {
  const A = args(process.argv.slice(2));
  if (!A.spots && !A.map && !A.spot) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(1); }
  if (!A.spots && !A.out) { console.error('see: --out DIR (a work folder outside the repo)'); process.exit(1); }
  const hasArt = !!(A.swap || A.put), sides = [];
  let temp = null;
  try {
    if (!A.spots && (A.vs || hasArt)) {
      let root = ROOT, ref = 'this tree without the art';
      if (A.vs) { ref = A.vs === true ? 'origin/main' : A.vs; const e = exportRef(ref); root = temp = e.dir; ref += ' ' + e.sha.slice(0, 7); }
      sides.push({ name: 'today', ref, st: await stage(root, A, false) });
    }
    sides.push({ name: 'new', st: await stage(ROOT, A, true) });
    const pg = sides[sides.length - 1].st.pg;
    if (A.spots) { for (const s of await pg.eval(() => SEE.spots())) console.log(s.name.padEnd(24) + ('tile ' + s.tile).padEnd(16) + s.also.join(' ')); return; }
    const dir = path.resolve(A.out);
    fs.mkdirSync(dir, { recursive: true });
    const out = A.map ? await shootMap(A, sides, dir) : await shootSpot(A, sides, dir);
    if (sides.length > 1) out.today = sides[0].ref;
    // a picture longer than an eye takes whole is for people: a reader's eye would shrink it
    const all = out.files.concat(...out.vs.map((v) => [v.file, v.where, v.zoom].filter(Boolean)));
    out.big = all.filter((f) => { const b = fs.readFileSync(f); return Math.max(b.readUInt32BE(16), b.readUInt32BE(20)) > EYE; }).map((f) => path.basename(f));
    fs.writeFileSync(path.join(dir, 'look.json'), JSON.stringify(out, null, 1));
    console.log(JSON.stringify(out));
  } finally {
    for (const s of sides) await s.st.close().catch(() => {});
    if (temp) fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((e) => { console.error('see: ' + String(e.message).replace(/^page: (Error: )?/, '').split('\n')[0]); process.exit(1); });
