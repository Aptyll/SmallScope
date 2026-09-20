'use strict';
// The store-art rig: boot Softfall once, warm the world until the merchants
// have raised their bases, then take single frames at whatever window size a
// capsule wants.
//
// A CAPSULE IS CAPTURED AT ITS OWN PIXEL SIZE. Emulation.setDeviceMetricsOverride
// makes the window the capsule's size, fitCanvas picks devScale from it, and
// SA.shotK sets kWant - image pixels per world pixel - so the game renders the
// art at the exact size the store wants and nothing is ever resampled.
// fitCanvas caps the view at 16:9 and pillarboxes anything wider, so a capsule
// wider than that (the library hero) is captured at 16:9 and composed from a
// band cut out of it.
const fs = require('fs');
const path = require('path');
const { CDP, GRAB } = require('./cdp.js');
const STAGE = require('./stage.js');

const SEED = 7;
const PORT = 9222;
const PAGE = 'http://localhost:8471/index.html';
const HERE = __dirname;

// Commit the pre-rolled first character, then fly the drop out with the sim
// frozen: DBG.step is the only clock, so this is the same every run. The first
// flight is a scripted RIDE (its manual jump is refused), so the way down is:
// wait for the bird to roost, cut the camera brief short, hop off.
const TO_PLAY = `
(function(){
  DBG.freeze = true;
  if (state.menu.cedit) createCommit();
  if (state.mode === 'title') startGame();
  var guard = 0;
  while (inAir(player) && guard++ < 4000) {
    DBG.step(1/60, 1);
    var e = state.drop && state.drop.eagles[player.team];
    if (e && e.state === 'down' && player.aboard) { state.dropBrief = null; DBG.hopOff(); }
  }
  DBG.step(1/60, 60);   // the hop's fall lands
  return JSON.stringify({ mode: state.mode, tick: state.tick, air: inAir(player),
    tile: [Math.floor(player.x/TILE), Math.floor(player.y/TILE)] });
})()`;

async function open(size) {
  const c = await CDP.open(PORT);
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: size ? size[0] : 1920, height: size ? size[1] : 1080, deviceScaleFactor: 1, mobile: false });
  return c;
}

async function boot(c, seed) {
  await c.goto(PAGE + '?seed=' + (seed || SEED));
  const info = JSON.parse(await c.eval(TO_PLAY));
  if (info.air) throw new Error('never reached the ground: ' + JSON.stringify(info));
  await c.eval(STAGE);
  return info;
}

// Let the world become itself: the merchants fell the rim, raise the gate, the
// guns and the barracks, and the first waves walk out onto the road.
async function warm(c, secs) {
  const n = Math.round((secs || 150) * 60);
  for (let done = 0; done < n; done += 600) await c.eval('DBG.step(1/60,' + Math.min(600, n - done) + ')');
  return c.eval('JSON.stringify({ structs: structures.length, robots: robots.length, tick: state.tick })');
}

// A cold boot by default: staging steps the sim on, so a set shot across a
// reused page is a set shot across a drifting world - by the eighth capsule
// the merchant has raised another gun. The -r flag is for iterating on one shot,
// where the forty-second walk to a built base is the whole cost.
async function ready(c, reuse, secs) {
  // reuse only a page THIS rig staged: an older one carries an older SA, and
  // its render wrap is still calling a camera hook that no longer exists
  const live = reuse && await c.eval('!!(window.SA && SA.rig === "store-2" && typeof state === "object" && state.mode === "play" && structures.length > 20)').catch(() => false);
  if (live) { await c.eval('SA.clean(true)'); return 'reused'; }
  await boot(c);
  const st = await warm(c, secs);
  await c.eval('SA.clean(true)');
  return 'booted ' + st;
}

async function resize(c, w, h) {
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  // The page's own resize listener is a queued event and the override returns
  // before it has run, so the driver refits by hand once the window really is
  // the new size - fitCanvas then relayout, the pair CLAUDE.md requires.
  for (let i = 0; i < 40; i++) {
    const [iw, ih] = JSON.parse(await c.eval('JSON.stringify([window.innerWidth, window.innerHeight])'));
    if (iw === w && ih === h) {
      const a = JSON.parse(await c.eval('(function(){ fitCanvas(); relayout(); return JSON.stringify([VIEW_W, VIEW_H, devScale, canvas.width, canvas.height]); })()'));
      if (a[3] !== w || a[4] !== h) throw new Error('canvas ' + a[3] + 'x' + a[4] + ' is not the window ' + w + 'x' + h + ' - the 16:9 view cap pillarboxed it');
      return a;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('resize never took: ' + w + 'x' + h);
}

// One frame: stage it, step the frozen sim `settle` frames, keep the last.
async function shoot(c, shot, outDir) {
  const dims = await resize(c, shot.size[0], shot.size[1]);
  c.errors.length = 0;
  await c.eval('(function(){ SA.clearFx(); SA.follow(); SA.clean(true); ' + (shot.stage || '') + ' })()');
  const n = shot.settle == null ? 1 : shot.settle;
  for (let i = 0; i < n; i++) {
    if (shot.per) await c.eval('(function(i,n){' + shot.per + '})(' + i + ',' + n + ')');
    await c.eval('DBG.step(1/60,1)');
  }
  const b64 = await c.eval(GRAB);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, shot.name + '.png');
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return { file, dims, kpx: await c.eval('SA.kpx()'), errors: c.errors.slice(0, 3),
    kb: Math.round(fs.statSync(file).size / 1024) };
}

module.exports = { open, boot, warm, ready, resize, shoot, SEED, HERE };
