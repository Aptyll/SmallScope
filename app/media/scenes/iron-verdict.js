// Example scene, and the template for new ones: ARMATOS brings IRON VERDICT down on a
// rival standing in the middle of its line, on open snow.
//   node app/media/rec.js app/media/scenes/iron-verdict.js <take> [--dry]
// A scene sets window.SCENE. Only o is read in Node (rec.js takes the page size and seed
// from it), so nothing outside the functions may touch a game global.
//   o      seed, page w x h at dpr, k (device px per world px = the take's S), max frames
//   setup  once after the boot: find the spot, place the cast, track bodies, set M.cam
//   tick   every frame before the sim steps: write each actor's p.input, M.mark() beats
//   done   true ends the take
// STAGED: the cast is placed and the key is ranked by hand; from the press on, the sim's own.
window.SCENE = {
  o: { seed: 7, w: 540, h: 960, dpr: 2, k: 4, weather: 'calm', time: 0.5, max: 400 },

  setup(M) {
    // open snow, found on the map as it is now (a tile number goes stale when the map moves):
    // the first 13 x 7 patch with no object, water or lane road, away from the edges
    const free = (x, y) => !objects[y * WORLD + x] && !waterAt(x, y) && !onRoad(x, y);
    let c = null;
    for (let ty = 30; ty < WORLD - 30 && !c; ty++) for (let tx = 30; tx < WORLD - 30 && !c; tx++) {
      let ok = true;
      for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -6; dx <= 6 && ok; dx++) ok = free(tx + dx, ty + dy);
      if (ok) c = [(tx + 0.5) * TILE, (ty + 0.5) * TILE];
    }
    // the hero is the local player (it must never die: the RESPAWNING screen), the rival any of the other side
    const A = M.A = player, F = M.F = players.find((q) => q.team !== A.team);
    setClass(A, heroIndex('ARMATOS')); setClass(F, heroIndex('IGNIA'));
    A.abLv = [1, 0, 0, 0]; A.abCd = [0, 0, 0, 0];
    for (const p of [A, F]) { p.invuln = 0; p.fallT = 0; p.vx = p.vy = 0; p.hp = p.maxHp; } // no landing fall, no respawn blink
    F.respawnT = 99;
    A.x = c[0] - 22; A.y = c[1]; A.dir = 'right'; F.x = c[0] + 22; F.y = c[1]; F.dir = 'left';
    // everyone else out of the shot, never deleted (an empty team ends the match)
    M.park(players.filter((q) => q !== A && q !== F));
    M.park(animals.filter((q) => Math.hypot(q.x - c[0], q.y - c[1]) < 500));
    M.ears = [A];
    M.track('hero', A); M.track('rival', F);
    M.cam = c;
    return { spot: c, hero: CLASSES[A.cls].name, rival: CLASSES[F.cls].name };
  },

  tick(M) {
    const A = M.A, F = M.F, d = M.data;
    for (const p of [A, F]) { const i = p.input; i.mx = i.my = 0; i.fire = false; i.ability = -1; }
    A.input.aimX = F.x; A.input.aimY = F.y;
    // half a second of standing, then the key: a press is one frame of input, as a hand's is
    if (M.frame === 30) { A.input.ability = 0; M.mark('cast'); }
    if (F.hp < F.maxHp && d.slam == null) { d.slam = M.frame; M.mark('slam'); }
  },

  // what an edit or a dry run wants to read per frame, beyond the tracked bodies
  row(M) { return { hp: Math.round(M.F.hp) }; },
  done(M) { return M.data.slam != null && M.frame - M.data.slam > 90; },
};
