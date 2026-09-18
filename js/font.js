// Tiny 3x5 pixel font. Each glyph is 15 chars, row-major, '1' = pixel on.
(function () {
  const GLYPHS = {
    'A': '010101111101101',
    'B': '110101110101110',
    'C': '011100100100011',
    'D': '110101101101110',
    'E': '111100110100111',
    'F': '111100110100100',
    'G': '011100101101011',
    'H': '101101111101101',
    'I': '111010010010111',
    'J': '001001001101010',
    'K': '101101110101101',
    'L': '100100100100111',
    'M': '101111111101101',
    'N': '111101101101101',
    'O': '010101101101010',
    'P': '110101110100100',
    'Q': '010101101010001',
    'R': '110101110101101',
    'S': '011100010001110',
    'T': '111010010010010',
    'U': '101101101101011',
    'V': '101101101101010',
    'W': '101101111111101',
    'X': '101101010101101',
    'Y': '101101010010010',
    'Z': '111001010100111',
    '0': '111101101101111',
    '1': '010110010010111',
    '2': '110001010100111',
    '3': '110001010001110',
    '4': '101101111001001',
    '5': '111100110001110',
    '6': '011100110101010',
    '7': '111001001010010',
    '8': '111101111101111',
    '9': '010101111001110',
    '-': '000000111000000',
    '+': '000010111010000',
    '.': '000000000000010',
    ',': '000000000010100',
    ':': '000010000010000',
    ';': '000010000010100',
    '!': '010010010000010',
    '?': '110001010000010',
    '/': '001001010100100',
    '%': '101001010100101',
    '(': '010100100100010',
    ')': '010001001001010',
    '<': '001010100010001',
    '>': '100010001010100',
    "'": '010010000000000',
    '"': '101101000000000',
    ' ': '000000000000000',
  };

  // The raster: one fillRect per lit glyph pixel, at an integer position.
  // Only the bake below calls it - a frame draws a few hundred strings, and
  // stamping each one pixel by pixel (nine times over for an outline) was a
  // quarter of the frame at 1080p. Returns the width in px.
  function raster(ctx, text, x, y, color, scale) {
    ctx.fillStyle = color;
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (let i = 0; i < text.length; i++) {
      const g = GLYPHS[text[i]] || GLYPHS['?'];
      for (let p = 0; p < 15; p++) {
        if (g[p] === '1') {
          const gx = p % 3, gy = (p / 3) | 0;
          ctx.fillRect(cx + gx * scale, cy + gy * scale, scale, scale);
        }
      }
      cx += 4 * scale;
    }
    return cx - Math.round(x) - scale; // trailing space removed
  }

  // THE STRING CACHE. Every string is baked ONCE per (kind, scale, colour,
  // rim, text) into its own small canvas and stamped with one drawImage
  // after that: the glyph pixels are opaque and the canvas is transparent
  // around them, so globalAlpha, the composite mode and the UI pass's
  // devScale transform all land on it exactly as they landed on the rects
  // (every drawing context in the game runs with smoothing off). A side
  // effect worth having: the outline's nine passes are one image now, so a
  // faded outlined string fades EVENLY and the rim colour no longer has to
  // be opaque. The cache is dropped whole once it holds CACHE_MAX strings -
  // a clock or a floater retires a string a second, never thousands.
  const CACHE_MAX = 2048;
  let cache = new Map();
  // kind 0 = plain, 1 = shadow (bottom-right, one scale), 2 = outline (eight
  // 1 px offsets at any scale); `rim` is the shadow or outline colour
  function bake(kind, text, color, rim, scale) {
    const key = kind + '|' + scale + '|' + color + '|' + rim + '|' + text;
    let e = cache.get(key);
    if (e) return e;
    if (cache.size >= CACHE_MAX) cache = new Map();
    const w = Math.max(1, text.length * 4 * scale - scale), h = 5 * scale;
    const pad = kind === 2 ? 1 : 0;              // the outline reaches 1 px outside the glyphs
    const grow = kind === 1 ? scale : pad * 2;   // the shadow reaches one scale down and right
    const cv = document.createElement('canvas');
    cv.width = w + grow; cv.height = h + grow;
    const g = cv.getContext('2d');
    if (kind === 1) raster(g, text, scale, scale, rim, scale);
    else if (kind === 2) {
      for (let dy = 0; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) {
        if (dx !== 1 || dy !== 1) raster(g, text, dx, dy, rim, scale);
      }
    }
    raster(g, text, pad, pad, color, scale);
    e = { cv, off: pad, w };
    cache.set(key, e);
    return e;
  }
  function stamp(ctx, kind, text, x, y, color, rim, scale) {
    scale = scale || 1;
    text = String(text).toUpperCase();
    if (!text.length) return 0;
    const e = bake(kind, text, String(color), String(rim), scale);
    ctx.drawImage(e.cv, Math.round(x) - e.off, Math.round(y) - e.off);
    return e.w;
  }

  // Draws text at integer pixel position. Returns width in px.
  window.drawPixelText = function (ctx, text, x, y, color, scale) {
    return stamp(ctx, 0, text, x, y, color, '', scale);
  };

  window.pixelTextWidth = function (text, scale) {
    scale = scale || 1;
    return String(text).length * 4 * scale - scale;
  };

  // Text with a 1px drop shadow (bottom-right only): for text sitting on a
  // panel or plank, where a full outline would look heavy.
  window.drawPixelTextShadow = function (ctx, text, x, y, color, shadow, scale) {
    return stamp(ctx, 1, text, x, y, color, shadow, scale);
  };

  // Text with a full dark outline, exactly 1 game px on all eight sides at any
  // text scale (a 2x floater still gets a 1px rim, not a 2px slab), for
  // anything drawn over the world: white on snow is unreadable with a mere
  // shadow. Crisp: the same glyph stamped at eight integer offsets, no blur.
  window.drawPixelTextOutline = function (ctx, text, x, y, color, outline, scale) {
    return stamp(ctx, 2, text, x, y, color, outline, scale);
  };
})();
