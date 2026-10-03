// Example scene, and the template for new ones: the black antlered bear fishes at its
// bank, one archer looses a single arrow at it from up the bank, the bear roars and comes.
//   node app/media/rec.js app/media/scenes/bear-wakes.js <take> [--dry]
// A scene sets window.SCENE. Only o is read in Node (rec.js takes the page size and seed
// from it), so nothing outside the functions may touch a game global.
//   o      seed, page w x h at dpr, k (device px per world px = the take's S), max frames
//   setup  once after the boot: find the spot, place the cast, track bodies, set M.cam
//   tick   every frame before the sim steps: write each actor's p.input, M.mark() beats
//   done   true ends the take
window.SCENE = {
  o: { seed: 6, w: 540, h: 960, dpr: 2, k: 4, weather: 'calm', time: 0.5, max: 600 },

  setup(M) {
    const a = M.a = animals.find((q) => q.kind === 'alpha' && !q.dead);
    // let it walk its bank until it stops at the water to watch for a fish
    for (let i = 0; i < 60 * 600 && !(a.fishT > 0 && !a.goal); i++) update(1 / 60);
    state.time = M.o.time * DAY_LEN;
    // dry land from the bear: the direction with the longest run of no water
    const wet = (x, y) => waterAt(Math.floor(x / TILE), Math.floor(y / TILE)) || isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE));
    let L = [0, -1], best = -1;
    for (let i = 0; i < 32; i++) {
      const an = i / 32 * Math.PI * 2, dx = Math.cos(an), dy = Math.sin(an); let s = 0;
      for (let r = 12; r <= 160; r += 6) { if (wet(a.x + dx * r, a.y + dy * r)) break; s++; }
      if (s > best) { best = s; L = [dx, dy]; }
    }
    // the archer: a teammate of the local player, the rest of the world parked away
    const p = M.p = players.find((q) => q.team === player.team && q !== player);
    setClass(p, 0);
    p.x = a.x + L[0] * 110; p.y = a.y + L[1] * 110; p.vx = p.vy = 0; p.hp = p.maxHp;
    M.park(players.filter((q) => q !== p));
    M.park(animals.filter((q) => q !== a && Math.hypot(q.x - a.x, q.y - a.y) < 500));
    M.ears = [p];
    M.track('bear', a); M.track('archer', p);
    M.cam = [a.x + L[0] * 55, a.y + L[1] * 55];
    M.data.fishAt = null; M.data.shot = null;
    return { bear: [a.x, a.y], land: L, archer: [p.x, p.y] };
  },

  tick(M) {
    const a = M.a, p = M.p, i = p.input;
    i.mx = i.my = 0; i.aimX = a.x; i.aimY = animalHitY(a);
    if (a.clip === 'fish' && M.data.fishAt == null) { M.data.fishAt = M.frame; M.mark('fish'); }
    // hold the bear on its spot until the arrow lands
    if (!a.target) { a.goal = null; a.idleT = 99; }
    // draw 1 s into the catch, loose at full draw (a still target: it lands)
    const go = M.data.fishAt != null && M.frame - M.data.fishAt > 60;
    if (M.data.shot == null) {
      if (go && !p.charging) i.fire = true;
      else if (p.charging && drawPow(p) >= 1) { i.fire = false; M.data.shot = M.frame; M.mark('loose'); }
    } else i.fire = false;
    if (a.clip === 'roar' && !M.data.roar) { M.data.roar = M.frame; M.mark('roar'); }
    if (M.data.roar && a.clip !== 'roar' && !M.data.charge) { M.data.charge = M.frame; M.mark('charge'); }
  },

  done(M) { return M.data.charge != null && M.frame - M.data.charge > 50; },
};
