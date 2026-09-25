'use strict';
// All pixel art is defined as character grids and baked to canvases at load.
// This keeps every sprite hand-editable, pixel by pixel. SPRITES is the one
// registry the game reads; each js/sprites/ file is a private IIFE that bakes
// its own grids and Object.assign()s the keys it owns into it (tools.js adds
// its tool and bit art the same way). SPR carries the helpers they share, so
// this file loads first and the rest in any order.
window.SPRITES = {};
window.SPR = (() => {
  function bake(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const col = pal[row[x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    }
    return c;
  }

  // Per-row [firstX, lastX] of the painted pixels, taken straight off the grid.
  // The game's snow cover needs to know how wide a prone body is on every row;
  // reading that back off the baked canvas would mean a getImageData per pose,
  // and the char grid already knows. Attached to the canvas as `.spans`.
  function spansOf(rows, pal) {
    return rows.map((r) => {
      let lo = 99, hi = -1;
      for (let x = 0; x < r.length; x++) if (pal[r[x]]) { if (x < lo) lo = x; hi = x; }
      return hi < 0 ? null : [lo, hi];
    });
  }
  function bakeSpan(rows, pal) {
    const c = bake(rows, pal);
    c.spans = spansOf(rows, pal);
    return c;
  }


  function flipH(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    // a mirrored pose's spans mirror with it
    if (src.spans) c.spans = src.spans.map((s) => (s ? [src.width - 1 - s[1], src.width - 1 - s[0]] : null));
    return c;
  }

  // A beast's frames are named CLIPS, one array per behaviour, so
  // `SPRITES[kind][dir]` is an object rather than a flat list and every kind
  // wears the same two names at least: `idle` is what it does standing still
  // and is the frame anything asking for "the beast" takes (the wiki's cards
  // read `.right.idle[0]`). Which clip is playing is the animal's business,
  // not the sprite's - js/wildlife.js sets `a.clip`, drawAnimal plays it.
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


  // a tinted copy and a nearest-neighbour 2x copy: the placeholder camp
  // wolves (js/sprites/beasts.js) are the wolf through these
  function wash(src, col, amt) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = amt;
    g.fillStyle = col;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function double(src) {
    const c = document.createElement('canvas');
    c.width = src.width * 2; c.height = src.height * 2;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  // ---------------------------------------------------------------- teams
  // Two team presets, RED vs BLUE. A team's colour drives its CHARACTERS
  // (coat, hat, trim), its BUILDINGS (fittings + glow accent, painted over the
  // tier material) and its EAGLE's armour, so a side reads as one side at a
  // glance. The game code reads the names/markers back out of SPRITES.teams -
  // TEAM_PALETTES is the only place the team palette is written down.
  // TEAM_PALETTES are the COLOURS row's four answers (settings.teamPal): the
  // same two presets repainted for a player who cannot tell the default pair
  // apart. Slot 0 is the side your screen paints as the rival, slot 1 yours
  // (skin(), js/player.js). RED-GREEN is orange against blue (the pair both
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
  SPRITES.teamPal = () => teamPal;
  SPRITES.teamPalettes = TEAM_PALETTES;
  SPRITES.setTeamPal = (id) => {
    if (!TEAM_PALETTES[id]) id = 'def';
    if (id === teamPal) return;
    teamPal = id;
    TEAM_SKINS.forEach((t, i) => Object.assign(t, TEAM_PALETTES[id][i]));
    for (const fn of teamBakes) fn();
  };
  return { bake, spansOf, bakeSpan, flipH, bakeClips, mapClips, liveIcon, wash, double, TEAM_SKINS, teamBuildPal, onTeams };
})();
