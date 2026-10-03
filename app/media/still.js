// One clean frame of the world: no HUD, no players, no beasts unless asked.
//   node app/media/still.js --out snow.png [--seed 7] [--w 1280 --h 720 --dpr 1] [--k 4]
//        [--at X,Y world px | --tile TX,TY | --find open] [--time 0.5] [--weather calm] [--keep players,beasts]
//        [--player DX,DY]   one player stands DX,DY world px from the centre, for scale
// --find open picks the first open snow patch beside a pine (for pasting concept art onto).
// Prints the camera and zoom as JSON, so a sheet can place art at world coordinates.
'use strict';
const path = require('path');
const { openGame, args } = require('./browser');

(async () => {
  const A = args(process.argv.slice(2));
  if (!A.out) { console.log('usage: node app/media/still.js --out f.png [--seed N] [--k K] [--at X,Y | --tile TX,TY | --find open] [--time 0..1] [--weather name]'); process.exit(1); }
  const pg = await openGame({ seed: +(A.seed || 7), width: +(A.w || 1280), height: +(A.h || 720), dpr: +(A.dpr || 1) });
  await pg.inject(path.join(__dirname, 'stage.js'));
  const keep = String(A.keep || '').split(',');
  const info = await pg.eval((o) => {
    const M = MEDIA; M.boot({ k: o.k, weather: o.weather, time: o.time });
    if (!o.keep.includes('players')) M.park(players, -4000, -4000);
    if (!o.keep.includes('beasts')) M.park(animals, -4000, -4000);
    let c = null;
    if (o.at) c = o.at.split(',').map(Number);
    else if (o.tile) c = o.tile.split(',').map((v) => (+v + 0.5) * TILE);
    else if (o.find) {
      const free = (x, y) => !objects[y * WORLD + x] && !waterAt(x, y) && ground[y * WORLD + x] !== 1;
      for (let ty = 20; ty < WORLD - 20 && !c; ty++) for (let tx = 20; tx < WORLD - 20 && !c; tx++) {
        let ok = true; for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -6; dx <= 6 && ok; dx++) if (!free(tx + dx, ty + dy)) ok = false;
        if (!ok) continue;
        let tree = false; for (let dy = -7; dy <= -4; dy++) for (let dx = -6; dx <= 6; dx++) { const q = objects[(ty + dy) * WORLD + tx + dx]; if (q && q.type === 'tree') tree = true; }
        if (tree) c = [(tx + 0.5) * TILE, (ty + 0.5) * TILE];
      }
    }
    M.cam = c || [player.x, player.y];
    if (o.player) { const [dx, dy] = o.player.split(',').map(Number); player.x = M.cam[0] + dx; player.y = M.cam[1] + dy; player.vx = player.vy = 0; player.dir = 'down'; }
    for (let i = 0; i < (o.weather ? 420 : 30); i++) M.tick();
    if (o.time != null) { state.time = o.time * DAY_LEN; M.tick(); }
    return { cam: [camX, camY], centre: M.cam, player: o.player ? [player.x, player.y] : null, k: DBG.getZoom().k, view: [WV_W, WV_H], tile: TILE };
  }, { k: +(A.k || 4), weather: A.weather || 'calm', time: A.time != null ? +A.time : null, at: A.at, tile: A.tile, find: A.find, keep, player: A.player });
  await pg.shot(A.out);
  console.log(JSON.stringify(info));
  await pg.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
