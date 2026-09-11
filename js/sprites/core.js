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
  // this table is the only place the team palette is written down.
  const TEAM_SKINS = [
    { name: 'RED', mark: '#e05548', // slot 0 - the original red/teal look
      coat: '#c9524e', coatL: '#df7358', coatD: '#96393f', hat: '#3e8c81', hatL: '#58ab98',
      trim: '#f6ecd4', trimD: '#d9c5a0', fit: '#5a3340', fitL: '#8c4f52', glow: '#ff9440' },
    { name: 'BLUE', mark: '#6aa8e8',
      coat: '#3f6fb0', coatL: '#5e93d8', coatD: '#2b4d7d', hat: '#cfe4f2', hatL: '#f4faff',
      trim: '#e8f2fb', trimD: '#bcd0e4', fit: '#2a3a56', fitL: '#4c6a94', glow: '#8fd8ff' },
  ];
  const teamBuildPal = (base, t) => Object.assign({}, base, { k: t.fit, K: t.fitL, e: t.glow });
  SPRITES.teams = TEAM_SKINS;
  return { bake, spansOf, bakeSpan, flipH, bakeClips, mapClips, liveIcon, wash, double, TEAM_SKINS, teamBuildPal };
})();
