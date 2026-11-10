'use strict';
// All pixel art is defined as character grids and baked to canvases at load.
// This keeps every sprite hand-editable, pixel by pixel. SPRITES is the one
// registry the game reads; each js/sprites/ file is a private IIFE that bakes
// its own grids and Object.assign()s the keys it owns into it. SPR carries the helpers they share, so
// this file loads first and the rest in any order.
window.SPRITES = {};
window.SPR = (() => {
  // A sprite's own pixels, kept on the CPU from the moment it is made: what a
  // draw that measures art reads (a sun shade, a building's art box, a
  // canopy's ink, a fall's ice, a blade's reach), never the canvas itself. A
  // sprite canvas lives on the GPU, and reading one back (getImageData) stalls
  // the frame until the GPU catches up - read lazily, every hero frame's first
  // showing in a fight was a hitch. bake() and the flips record their pixels
  // as they paint; a canvas made any other way is read back once, on first ask
  // (`readbacks` counts those). A canvas handed here is never painted again.
  const pixels = new WeakMap();
  const rgbaCv = document.createElement('canvas');
  rgbaCv.width = rgbaCv.height = 1;
  const rgbaCtx = rgbaCv.getContext('2d', { willReadFrequently: true });
  const rgbaOf = new Map();
  // a palette colour as one pixel holds it: painted and read on a CPU pixel,
  // so it rounds exactly as the sprite's own pixel would
  function rgba(col) {
    let v = rgbaOf.get(col);
    if (!v) {
      rgbaCtx.clearRect(0, 0, 1, 1);
      rgbaCtx.fillStyle = col;
      rgbaCtx.fillRect(0, 0, 1, 1);
      rgbaOf.set(col, (v = rgbaCtx.getImageData(0, 0, 1, 1).data.slice()));
    }
    return v;
  }
  // a canvas painted from pixels already in hand (a putImageData of them):
  // they are its kept pixels, so it is never read back. Alpha is exact; a
  // half-clear pixel's colour may sit 1 off what a readback would round it to
  function keepPixels(cv, px) { pixels.set(cv, px); return cv; }
  const read = { n: 0 };
  function pixelsOf(cv) {
    let px = pixels.get(cv);
    if (!px) {
      px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      pixels.set(cv, px);
      read.n++;
    }
    return px;
  }
  // a CPU twin of a sprite whose pixels are known, for a layer that is read
  // back every frame (the canopy's hero layer, js/draw/canopy.js): drawing a GPU
  // canvas into a CPU one reads the GPU too. Null for a canvas made any other way
  const twins = new WeakMap();
  function cpuTwin(cv) {
    let t = twins.get(cv);
    if (t !== undefined) return t;
    const px = pixels.get(cv);
    t = null;
    if (px && cv.width && cv.height) {
      t = document.createElement('canvas');
      t.width = cv.width; t.height = cv.height;
      t.getContext('2d', { willReadFrequently: true }).putImageData(new ImageData(new Uint8ClampedArray(px), cv.width, cv.height), 0, 0);
    }
    twins.set(cv, t);
    return t;
  }

  // FINE2X: a 16 px grid of palette letters on twice the px, for a look drawn fine (`dens` 2):
  // Scale2x rounds its steps, then the outline comes back to one px (an ink px with fill on one
  // side and, behind it, ink that touches the outside is a doubled line's inner half: it takes the
  // fill), and an outer ink px with no fill round it at all (a doubled step) goes. The roll of a
  // fine look with no roll of its own, and a hero's blade (bakeBladeFine), are made with it.
  function fine2x(g) {
    const H = g.length, W = g[0].length, N = 2 * H, M = 2 * W;
    const at = (x, y) => g[Math.min(Math.max(y, 0), H - 1)][Math.min(Math.max(x, 0), W - 1)];
    const o = Array.from({ length: N }, () => Array(M).fill('.'));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const P = g[y][x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      o[2 * y][2 * x] = C === A && C !== D && A !== B ? A : P;
      o[2 * y][2 * x + 1] = A === B && A !== C && B !== D ? B : P;
      o[2 * y + 1][2 * x] = D === C && D !== B && C !== A ? C : P;
      o[2 * y + 1][2 * x + 1] = B === D && B !== A && D !== C ? D : P;
    }
    const S = (q) => (x, y) => (x >= 0 && x < M && y >= 0 && y < N ? q[y][x] : '.');
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const A0 = S(o), out = (x, y) => N4.some(([a, b]) => A0(x + a, y + b) === '.');
    const t = o.map((r) => r.slice());
    for (let y = 0; y < N; y++) for (let x = 0; x < M; x++) {
      if (A0(x, y) !== 'o' || out(x, y)) continue;
      for (const [a, b] of N4) {
        const c = A0(x + a, y + b);
        if (c !== '.' && c !== 'o' && A0(x - a, y - b) === 'o' && out(x - a, y - b)) { t[y][x] = c; break; }
      }
    }
    const T = S(t), gone = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < M; x++) {
      if (T(x, y) !== 'o' || !N4.some(([a, b]) => T(x + a, y + b) === '.')) continue;
      let fill = false;
      for (let b = -1; b <= 1 && !fill; b++) for (let a = -1; a <= 1; a++) { const c = T(x + a, y + b); if (c !== '.' && c !== 'o') { fill = true; break; } }
      if (!fill) gone.push(x, y);
    }
    for (let i = 0; i < gone.length; i += 2) t[gone[i + 1]][gone[i]] = '.';
    return t.map((r) => r.join(''));
  }

  function bake(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d'), px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const col = pal[row[x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); px.set(rgba(col), (y * w + x) * 4); }
      }
    }
    pixels.set(c, px);
    return c;
  }

  // a sprite mirrored left to right (flipH) or top to bottom (flipV), its
  // pixels mirrored with it when the source's are known
  function flipped(src, horiz) {
    const w = src.width, h = src.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (horiz) { g.translate(w, 0); g.scale(-1, 1); } else { g.translate(0, h); g.scale(1, -1); }
    g.drawImage(src, 0, 0);
    const from = pixels.get(src);
    if (from) {
      const px = new Uint8ClampedArray(from.length);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, j = horiz ? (y * w + w - 1 - x) * 4 : ((h - 1 - y) * w + x) * 4;
        px[i] = from[j]; px[i + 1] = from[j + 1]; px[i + 2] = from[j + 2]; px[i + 3] = from[j + 3];
      }
      pixels.set(c, px);
    }
    return c;
  }
  const flipH = (src) => flipped(src, true);
  const flipV = (src) => flipped(src, false);

  // A beast's frames are named CLIPS, one array per behaviour, so
  // `SPRITES[kind][dir]` is an object rather than a flat list and every kind
  // wears the same two names at least: `idle` is what it does standing still
  // and is the frame anything asking for "the beast" takes (the wiki's cards
  // read `.right.idle[0]`). Which clip is playing is the animal's business,
  // not the sprite's - js/sim/wildlife.js sets `a.clip`, drawAnimal plays it.
  function bakeClips(clips, pal) {
    const out = {};
    for (const k in clips) out[k] = clips[k].map((f) => bake(f, pal));
    return out;
  }
  function mapClips(set, fn) {
    const out = {};
    for (const k in set) out[k] = set[k].map(fn);
    return out;
  }

  // a blank same-size canvas that stepItemIcons (js/draw/render.js) stamps
  // an animated icon's current frame into; starts on frame 0 (js/sprites/items.js)
  function liveIcon(frames) {
    const c = document.createElement('canvas');
    c.width = frames[0].width; c.height = frames[0].height;
    c.getContext('2d').drawImage(frames[0], 0, 0);
    c.frame = 0;
    return c;
  }


  // ---------------------------------------------------------------- teams
  // Two team presets, RED vs BLUE. A team's colour drives its CHARACTERS
  // (coat, hat, trim), its BUILDINGS (fittings + glow accent, painted over the
  // tier material) and its EAGLE's armour, so a side reads as one side at a
  // glance. The game code reads the names/markers back out of SPRITES.teams -
  // TEAM_PALETTES is the only place the team palette is written down.
  // TEAM_PALETTES are the COLOUR BLIND dropdown's four answers (settings.teamPal): the
  // same two presets repainted for a player who cannot tell the default pair
  // apart. Slot 0 is the side your screen paints as the rival, slot 1 yours
  // (skin(), js/sim/player.js). RED-GREEN is orange against blue (the pair both
  // red-green blindnesses keep apart), BLUE-YELLOW vermilion against cyan
  // (the pair a tritan keeps apart) and CONTRAST pale gold against a dark
  // blue, apart on brightness alone. Every rival hat drops the default teal,
  // which a red-green eye reads as the blue side's hue. The names stay RED
  // and BLUE: they are the sides' names, not a description.
  const TEAM_PALETTES = {
    def: [
      { mark: '#e05548', // slot 0 - the original red/teal look
        coat: '#c9524e', coatL: '#df7358', coatD: '#96393f', hat: '#3e8c81', hatL: '#58ab98',
        trim: '#f6ecd4', trimD: '#d9c5a0', fit: '#5a3340', fitL: '#8c4f52', glow: '#ff9440' },
      { mark: '#6aa8e8',
        coat: '#3f6fb0', coatL: '#5e93d8', coatD: '#2b4d7d', hat: '#cfe4f2', hatL: '#f4faff',
        trim: '#e8f2fb', trimD: '#bcd0e4', fit: '#2a3a56', fitL: '#4c6a94', glow: '#8fd8ff' },
    ],
    rg: [
      { mark: '#f2a93a',
        coat: '#e08a1e', coatL: '#f4ab44', coatD: '#a25c12', hat: '#4a3526', hatL: '#6e503a',
        trim: '#fbeed0', trimD: '#dcc59a', fit: '#5a3a1e', fitL: '#8c5c2a', glow: '#ffc040' },
      { mark: '#5f9cf0',
        coat: '#2f5fb8', coatL: '#4f84dc', coatD: '#1f3f80', hat: '#cfe4f2', hatL: '#f4faff',
        trim: '#e8f2fb', trimD: '#bcd0e4', fit: '#1e2c56', fitL: '#3c5898', glow: '#7cc8ff' },
    ],
    by: [
      { mark: '#ff5a4a',
        coat: '#d8402a', coatL: '#f0623e', coatD: '#962a1a', hat: '#3a2420', hatL: '#5c3a30',
        trim: '#fbeae4', trimD: '#dcc0b4', fit: '#4a2018', fitL: '#7c3a28', glow: '#ff8a50' },
      { mark: '#28c0f0',
        coat: '#1a80c8', coatL: '#3aa4e8', coatD: '#105a90', hat: '#d8eef8', hatL: '#f4fbff',
        trim: '#e6f6fc', trimD: '#b4d8e8', fit: '#0e3450', fitL: '#2a6490', glow: '#8ae4ff' },
    ],
    hc: [
      { mark: '#ffe04a',
        coat: '#f0c828', coatL: '#fff070', coatD: '#b08a10', hat: '#2a2418', hatL: '#4a4028',
        trim: '#fffbe8', trimD: '#e8dcb0', fit: '#4a3a10', fitL: '#86701e', glow: '#fff4a0' },
      { mark: '#4c7cff',
        coat: '#1e3aa8', coatL: '#3458d4', coatD: '#101e60', hat: '#141a3a', hatL: '#28305a',
        trim: '#d8e4ff', trimD: '#a8b8e0', fit: '#0e163e', fitL: '#26367a', glow: '#6c9cff' },
    ],
  };
  const TEAM_SKINS = [
    Object.assign({ name: 'RED' }, TEAM_PALETTES.def[0]),
    Object.assign({ name: 'BLUE' }, TEAM_PALETTES.def[1]),
  ];
  const teamBuildPal = (base, t) => Object.assign({}, base, { k: t.fit, K: t.fitL, e: t.glow });
  SPRITES.teams = TEAM_SKINS;
  // Repainting: every file that bakes from TEAM_SKINS hands its team bakes to
  // onTeams, which runs them once now and again whenever setTeamPal swaps the
  // colours IN PLACE - so SPRITES.teams (TEAMS) and every set a draw reads
  // live through SPRITES stay the same objects the game already holds.
  const teamBakes = [];
  let teamPal = 'def';
  function onTeams(fn) { teamBakes.push(fn); fn(); }
  SPRITES.teamPalettes = TEAM_PALETTES;
  SPRITES.setTeamPal = (id) => {
    if (!TEAM_PALETTES[id]) id = 'def';
    if (id === teamPal) return;
    teamPal = id;
    TEAM_SKINS.forEach((t, i) => Object.assign(t, TEAM_PALETTES[id][i]));
    for (const fn of teamBakes) fn();
  };
  return { bake, fine2x, flipH, flipV, pixelsOf, keepPixels, cpuTwin, readbacks: () => read.n, bakeClips, mapClips, liveIcon, TEAM_SKINS, teamBuildPal, onTeams };
})();
