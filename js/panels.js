'use strict';
// The four overlay panels: the TAB scoreboard and the event feed, the M
// world map on its parchment, the ESC settings slab, and the PLAYER name
// panel with its lifetime numbers.
// ------------------------------------------------------------ scoreboard & log
// Two readouts of the match rather than of the world. TAB, held, opens the
// standings from any mode but the title - being dead is exactly when you want
// them - and everything significant that happens to a player leaves a line in
// the feed at the bottom left. Both draw after the death overlay so neither is
// dimmed by it. Colours everywhere: the team is the plate, playerTint(p) is
// the ink, so teammates read as one side and still as two people.

// ---- event feed ----
const EVENT_MAX = 4;      // lines on screen; the oldest scroll off the top
const EVENT_LIFE = 8;     // seconds from arrival to gone, faded linearly across it
const EVENT_FLASH = 0.35; // arrival: slides in from the edge under a white pop
const LOG_LEVEL = 5;      // level-ups below this come too fast to be news
const events = [];        // {txt, bg, fg, t}; updateFx ages and expires them

// p tints the line and is who it is about; null = a line nobody owns. The
// plate takes the team's dark coat, not its bright mark: the ink is a pale
// per-player tint, and a bright plate over snow leaves it nothing to sit on.
// `o` overrides that palette for a line no player owns but the world still
// wants coloured - the market's own headlines, green on a spike and red on a
// crash (marketNews, js/shop.js).
function logEvent(txt, p, o) {
  o = o || {};
  events.push({
    txt: String(txt).toUpperCase(), t: 0,
    bg: o.bg || (p ? TEAMS[skin(p.team)].coatD : '#2a3358'),
    edge: o.edge || (p ? TEAMS[skin(p.team)].mark : '#6d7ea6'),
    fg: o.fg || (p ? playerTint(p) : '#e6ecfa'),
  });
  while (events.length > EVENT_MAX * 3) events.shift();
}

function renderEventLog() {
  const n = Math.min(EVENT_MAX, events.length);
  if (!n) return;
  const pitch = 10;
  // oldest at the top, newest along the bottom; it shares the bottom-left
  // corner with the replay window and the tooltip, and steps up by their
  // height for as long as either is open
  let y = VIEW_H - 8 - replayLift() - tipLift() - pitch * n;
  for (let i = events.length - n; i < events.length; i++) {
    const e = events[i];
    const a = Math.max(0, 1 - e.t / EVENT_LIFE); // age alone sets the alpha
    const f = Math.max(0, 1 - e.t / EVENT_FLASH);
    const w = pixelTextWidth(e.txt) + 8;
    const x = 4 - Math.round(7 * f * f); // slides in off the left edge
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,9,22,0.75)'; // base: the world must not read through the plate
    ctx.fillRect(x, y, w, 9);
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = e.bg;
    ctx.fillRect(x, y, w, 9);
    ctx.globalAlpha = a;
    ctx.fillStyle = e.edge;
    ctx.fillRect(x, y, 1, 9); // the bright team mark, hard against the plate
    if (f > 0) { // the arrival pop
      ctx.globalAlpha = 0.6 * f * f;
      ctx.fillStyle = '#f4f7ff';
      ctx.fillRect(x, y, w, 9);
      ctx.globalAlpha = a;
    }
    drawPixelTextShadow(ctx, e.txt, x + 4, y + 2, e.fg, 'rgba(6,9,22,0.9)');
    ctx.globalAlpha = 1;
    y += pitch;
  }
}

// ---- scoreboard (hold TAB) ----
const SB_W = 168;
const SB_ROW = 9;
const SB_COL = [96, 128, 160]; // right edges of LVL / GOLD / KILLS, panel-relative

function scoreboardOpen() { return keyHeld('board') && state.mode !== 'title' && !window.DBG.hideUI; }

// "winning" is lifetime gold earned, not the purse: gold spent on a building
// is progress, and it is the same number the hero levels run on
function scoreOf(p) { return p.xp; }

// players grouped by team, teams ordered by their total, players by their own
function scoreGroups() {
  const byTeam = new Map();
  for (const p of players) {
    if (!p.active) continue;
    if (!byTeam.has(p.team)) byTeam.set(p.team, []);
    byTeam.get(p.team).push(p);
  }
  const groups = [...byTeam.values()];
  for (const g of groups) g.sort((a, b) => scoreOf(b) - scoreOf(a) || a.id - b.id);
  const total = (g) => g.reduce((n, p) => n + scoreOf(p), 0);
  groups.sort((a, b) => total(b) - total(a) || a[0].team - b[0].team);
  return groups;
}

function renderScoreboard() {
  const groups = scoreGroups();
  if (!groups.length) return;
  const rows = groups.reduce((n, g) => n + g.length, 0);
  const h = 30 + rows * SB_ROW + (groups.length - 1) * 3;
  const x = Math.round((VIEW_W - SB_W) / 2), y = Math.round((VIEW_H - h) / 2);
  const shadow = 'rgba(8,12,28,0.9)';

  ctx.fillStyle = 'rgba(4,7,20,0.45)'; ctx.fillRect(x + 2, y + 2, SB_W, h);
  ctx.fillStyle = 'rgba(10,15,34,0.96)'; ctx.fillRect(x, y, SB_W, h);
  ctx.fillStyle = '#2c3a68';
  ctx.fillRect(x, y, SB_W, 1); ctx.fillRect(x, y + h - 1, SB_W, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + SB_W - 1, y, 1, h);
  ctx.fillStyle = '#3d4f85'; ctx.fillRect(x + 1, y + 1, SB_W - 2, 1); // lit top edge

  drawPixelTextShadow(ctx, 'SCOREBOARD', x + 6, y + 6, '#cfe0ff', shadow);
  const day = 'DAY ' + state.day;
  drawPixelTextShadow(ctx, day, x + SB_W - 6 - pixelTextWidth(day), y + 6, '#7a8bb8', shadow);
  ctx.fillStyle = '#222c55'; ctx.fillRect(x + 4, y + 15, SB_W - 8, 1);

  const head = ['LVL', 'GOLD', 'KILLS'];
  drawPixelTextShadow(ctx, 'PLAYER', x + 14, y + 19, '#7a8bb8', shadow);
  for (let i = 0; i < 3; i++) {
    drawPixelTextShadow(ctx, head[i], x + SB_COL[i] - pixelTextWidth(head[i]), y + 19, '#7a8bb8', shadow);
  }

  let ry = y + 28;
  for (const g of groups) {
    const tm = TEAMS[skin(g[0].team)];
    ctx.fillStyle = tm.mark;
    ctx.fillRect(x + 4, ry, 2, g.length * SB_ROW - 2); // one stripe down the whole team
    for (const p of g) {
      const dim = p.dead ? 0.55 : 1;
      ctx.globalAlpha = dim * (p === player ? 0.26 : 0.13);
      ctx.fillStyle = tm.mark;
      ctx.fillRect(x + 8, ry, SB_W - 12, SB_ROW - 2);
      ctx.globalAlpha = dim;
      if (p === player) drawPixelTextShadow(ctx, '>', x + 9, ry + 1, '#ffd95c', shadow);
      drawPixelTextShadow(ctx, p.name, x + 14, ry + 1, playerTint(p), shadow);
      if (p.dead) {
        // eliminated reads OUT; a respawn-pending player shows the countdown
        // instead, since "OUT" on someone back in 3s is actively wrong
        const tag = p.eliminated ? 'OUT' : Math.ceil(p.respawnT) + 's';
        drawPixelTextShadow(ctx, tag, x + 18 + pixelTextWidth(p.name), ry + 1, '#8f9cc4', shadow);
      }
      const vals = [String(p.level), String(p.inv.gold), String(p.kills)];
      const cols = ['#cfe0ff', '#f2cc6a', '#ff9a8a'];
      for (let i = 0; i < 3; i++) {
        drawPixelTextShadow(ctx, vals[i], x + SB_COL[i] - pixelTextWidth(vals[i]), ry + 1, cols[i], shadow);
      }
      ctx.globalAlpha = 1;
      ry += SB_ROW;
    }
    ry += 3; // teams read as blocks
  }
}

// ------------------------------------------------------------ world map (M)
// PANEL_*/MAP_* anchors are declared in the canvas banner (relayout() writes them).

// a screen point over the chart -> the world tile under it (null off the map).
// The chart is the only way to flag a tile that is off-screen, so the middle
// click needs the inverse of the MAP_S projection everything else draws with.
function mapTileAt(sx, sy) {
  if (sx < MAP_X || sy < MAP_Y || sx >= MAP_X + MAP_W || sy >= MAP_Y + MAP_W) return null;
  const tx = Math.floor((sx - MAP_X) / MAP_S), ty = Math.floor((sy - MAP_Y) / MAP_S);
  return inWorld(tx, ty) ? { tx, ty } : null;
}

const mapCv = document.createElement('canvas');
mapCv.width = WORLD; mapCv.height = WORLD;
const mapCtx = mapCv.getContext('2d');
const mapImg = mapCtx.createImageData(WORLD, WORLD);

const panelCv = document.createElement('canvas');
panelCv.width = PANEL_W; panelCv.height = PANEL_H;

function buildMapPanel() {
  const g = panelCv.getContext('2d');
  const cham = (x, y, w, h) => { // rect with 2px chamfered corners
    g.fillRect(x + 2, y, w - 4, h);
    g.fillRect(x, y + 2, w, h - 4);
    g.fillRect(x + 1, y + 1, w - 2, h - 2);
  };
  // dark leather outline, then parchment
  g.fillStyle = '#241a10'; cham(0, 0, PANEL_W, PANEL_H);
  g.fillStyle = '#d3c39b'; cham(1, 1, PANEL_W - 2, PANEL_H - 2);
  // parchment mottling
  for (let y = 3; y < PANEL_H - 3; y += 3) {
    for (let x = 3; x < PANEL_W - 3; x += 3) {
      const h = hash2(x * 13 + 1, y * 17 + 9);
      if (h > 0.82) { g.fillStyle = '#dccfae'; g.fillRect(x, y, 3, 3); }
      else if (h < 0.18) { g.fillStyle = '#c9b78d'; g.fillRect(x, y, 3, 3); }
    }
  }
  // worn darker rim
  g.fillStyle = 'rgba(120,90,50,0.16)';
  g.fillRect(2, 2, PANEL_W - 4, 3); g.fillRect(2, PANEL_H - 5, PANEL_W - 4, 3);
  g.fillRect(2, 2, 3, PANEL_H - 4); g.fillRect(PANEL_W - 5, 2, 3, PANEL_H - 4);
  // stitched trim
  g.fillStyle = '#8a6a45';
  for (let x = 8; x < PANEL_W - 10; x += 6) { g.fillRect(x, 5, 3, 1); g.fillRect(x, PANEL_H - 6, 3, 1); }
  for (let y = 8; y < PANEL_H - 10; y += 6) { g.fillRect(5, y, 1, 3); g.fillRect(PANEL_W - 6, y, 1, 3); }
  // corner studs
  g.fillStyle = '#5a4028';
  for (const [sx, sy] of [[4, 4], [PANEL_W - 7, 4], [4, PANEL_H - 7], [PANEL_W - 7, PANEL_H - 7]]) {
    g.fillRect(sx, sy + 1, 3, 1); g.fillRect(sx + 1, sy, 1, 3);
  }
  // title with ornament dashes
  const title = 'THE FROSTLANDS';
  const tw = pixelTextWidth(title, 2);
  const tx0 = Math.round((PANEL_W - tw) / 2);
  drawPixelTextShadow(g, title, tx0, 8, '#4a3322', 'rgba(120,92,58,0.45)', 2);
  g.fillStyle = '#8a6a45';
  g.fillRect(tx0 - 26, 13, 18, 1); g.fillRect(tx0 + tw + 8, 13, 18, 1);
  g.fillRect(tx0 - 30, 12, 2, 3); g.fillRect(tx0 + tw + 28, 12, 2, 3);
  // map mat: highlight line, dark frame (map itself drawn dynamically inside)
  g.fillStyle = '#b5a37e';
  g.fillRect(7, 21, 198, 1); g.fillRect(7, 218, 198, 1);
  g.fillRect(7, 21, 1, 198); g.fillRect(204, 21, 1, 198);
  g.fillStyle = '#241a10';
  g.fillRect(8, 22, 196, 196);
  // column divider
  g.fillStyle = '#b5a37e'; g.fillRect(209, 24, 1, 192);
  // compass rose, center (254,49)
  g.fillStyle = '#4a3322';
  g.fillRect(253, 39, 2, 10);            // N arm (lower half)
  g.fillRect(253, 49, 2, 12);            // S arm
  g.fillRect(242, 48, 12, 2);            // W arm
  g.fillRect(254, 48, 12, 2);            // E arm
  g.fillRect(248, 43, 2, 2); g.fillRect(258, 43, 2, 2); // NW/NE ticks
  g.fillRect(248, 54, 2, 2); g.fillRect(258, 54, 2, 2); // SW/SE ticks
  g.fillStyle = '#a84438';               // red north tip
  g.fillRect(252, 37, 4, 2); g.fillRect(253, 35, 2, 2);
  g.fillStyle = '#d3c39b'; g.fillRect(253, 48, 2, 2);   // center pip
  drawPixelText(g, 'N', Math.round(254 - pixelTextWidth('N') / 2), 26, '#4a3322');
  // legend
  const legend = [
    ['FOREST', '#3c5840'], ['ROCKS', '#686c76'], ['ICE', '#7a9cb0'],
  ];
  let ly = 72;
  for (const [name, col] of legend) {
    g.fillStyle = '#241a10'; g.fillRect(218, ly, 5, 5);
    g.fillStyle = col; g.fillRect(219, ly + 1, 3, 3);
    drawPixelText(g, name, 228, ly - 1, '#4a3322');
    ly += 12;
  }
  // YOU entry uses the actual diamond marker glyph
  g.fillStyle = '#241a10';
  g.fillRect(218, ly + 1, 5, 3); g.fillRect(219, ly, 3, 5);
  g.fillStyle = '#e05548';
  g.fillRect(219, ly + 2, 3, 1); g.fillRect(220, ly + 1, 1, 3);
  drawPixelText(g, 'YOU', 228, ly - 1, '#4a3322');
  // close hint
  const hint = 'M CLOSE';
  drawPixelText(g, hint, Math.round(254 - pixelTextWidth(hint) / 2), 206, '#7a6647');
}

function buildWorldMapImg() {
  const d = mapImg.data;
  for (let ty = 0; ty < WORLD; ty++) {
    for (let tx = 0; tx < WORLD; tx++) {
      const i = ty * WORLD + tx;
      const o = structOf(objects[i]); // resolves a multi-tile building's 'part' fillers to the anchor
      const h = hash2(tx * 7 + 13, ty * 11 + 5);
      let r, g, b;
      const c = o && objMapColor(o, 'map', i, h);
      if (c) { r = c[0]; g = c[1]; b = c[2]; }
      else if (ground[i] === 2) { r = 44; g = 74; b = 104; } // carved water hole
      else if (ground[i] === 3) { // the road: a brown ink stroke down the parchment
        if (h > 0.8) { r = 150; g = 118; b = 78; } else { r = 138; g = 106; b = 68; }
      }
      else if (ground[i] === 1) {
        // inked pond with darker shoreline
        const edge =
          (tx > 0 && ground[i - 1] === 0) || (tx < WORLD - 1 && ground[i + 1] === 0) ||
          (ty > 0 && ground[i - WORLD] === 0) || (ty < WORLD - 1 && ground[i + WORLD] === 0);
        if (edge) { r = 88; g = 120; b = 142; }
        else if (h > 0.7) { r = 158; g = 190; b = 206; }
        else { r = 122; g = 156; b = 176; }
      }
      else {
        // open ground on parchment; tree to the north casts a soft shadow
        const up = ty > 0 ? objects[i - WORLD] : null;
        if (up && up.type === 'tree') { r = 192; g = 176; b = 138; }
        else if (h > 0.9) { r = 205; g = 188; b = 148; }
        else if (h < 0.05) { r = 198; g = 180; b = 140; }
        else { r = 216; g = 201; b = 163; }
      }
      const j = i * 4;
      d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255;
    }
  }
}

function renderWorldMap(now) {
  // dim the world behind the map
  ctx.fillStyle = 'rgba(6,10,24,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(panelCv, PANEL_X, PANEL_Y);

  // terrain
  buildWorldMapImg();
  mapCtx.putImageData(mapImg, 0, 0);
  ctx.drawImage(mapCv, MAP_X, MAP_Y, MAP_W, MAP_W);

  // faint surveyor's grid
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#3a2c1c';
  for (let gx = 24; gx < WORLD; gx += 24) ctx.fillRect(MAP_X + Math.round(gx * MAP_S), MAP_Y, 1, MAP_W);
  for (let gy = 24; gy < WORLD; gy += 24) ctx.fillRect(MAP_X, MAP_Y + Math.round(gy * MAP_S), MAP_W, 1);
  ctx.globalAlpha = 1;

  // night falls over the chart too
  if (state.darkness > 0.01) {
    ctx.globalAlpha = state.darkness * 0.22;
    ctx.fillStyle = '#2c3c6e';
    ctx.fillRect(MAP_X, MAP_Y, MAP_W, MAP_W);
    ctx.globalAlpha = 1;
  }

  // current camera view
  ctx.strokeStyle = 'rgba(58,44,28,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(MAP_X + (camX / TILE) * MAP_S + 0.5, MAP_Y + (camY / TILE) * MAP_S + 0.5,
    (WV_W / TILE) * MAP_S - 1, (WV_H / TILE) * MAP_S - 1);

  // the camps: glyph plus the name, inked like the rest of the chart. A name
  // hangs under its glyph unless one already inked would run into it - the
  // sites are fixed (CAMP_SITES, world.js) and two of them sit a label's
  // width apart - and then it goes over the glyph instead, so every name
  // stays whole
  const inked = [];
  for (const L of camps) {
    const lx = MAP_X + Math.round((L.tx + 0.5) * MAP_S);
    const ly = MAP_Y + Math.round((L.ty + 0.5) * MAP_S);
    drawCampIcon(ctx, L, lx, ly - 3, '#3a2c1c', 'rgba(228,216,186,0.85)');
    const w = pixelTextWidth(L.name);
    const nx = Math.max(MAP_X + 1, Math.min(MAP_X + MAP_W - w - 1, Math.round(lx - w / 2)));
    let ny = ly + 3;
    if (inked.some((r) => nx < r.x + r.w + 2 && nx + w + 2 > r.x && ny < r.y + 7 && ny + 7 > r.y)) ny = ly - 12;
    inked.push({ x: nx, y: ny, w });
    drawPixelTextShadow(ctx, L.name, nx, ny, '#3a2c1c', 'rgba(228,216,186,0.85)');
  }

  // the eagles as bird diamonds in team colour: the two roosted objectives,
  // and mid-flight (the M map is the ride's chart) each bird on its own line,
  // dashed across the parchment
  if (state.drop) for (const e of state.drop.eagles) {
    if (e.state === 'fly' || e.state === 'dive') {
      ctx.save();
      ctx.strokeStyle = TEAMS[skin(e.team)].mark;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(MAP_X + (e.x0 / TILE) * MAP_S, MAP_Y + (e.y0 / TILE) * MAP_S);
      ctx.lineTo(MAP_X + (e.x1 / TILE) * MAP_S, MAP_Y + (e.y1 / TILE) * MAP_S);
      ctx.stroke();
      ctx.restore();
    } else if (e.state !== 'down') continue;
    const lx = MAP_X + Math.round((e.x / TILE) * MAP_S);
    const ly = MAP_Y + Math.round((e.y / TILE) * MAP_S);
    ctx.fillStyle = '#241a10';
    ctx.fillRect(lx - 3, ly - 1, 7, 3); ctx.fillRect(lx - 1, ly - 3, 3, 7);
    ctx.fillStyle = TEAMS[skin(e.team)].mark;
    ctx.fillRect(lx - 2, ly, 5, 1); ctx.fillRect(lx, ly - 2, 1, 5);
  }

  // the other players, inked in their team colour
  for (const p of players) {
    if (p === player || !p.active || p.dead || inAir(p)) continue;
    if (p.team !== player.team && p.markT <= 0 && concealOf(p) >= PRONE_MAP) continue; // buried: off the map, same as the minimap - unless falcon-marked
    const ox2 = MAP_X + Math.round((p.x / TILE) * MAP_S);
    const oy2 = MAP_Y + Math.round((p.y / TILE) * MAP_S);
    ctx.fillStyle = '#241a10';
    ctx.fillRect(ox2 - 2, oy2 - 2, 5, 5);
    ctx.fillStyle = TEAMS[skin(p.team)].mark;
    ctx.fillRect(ox2 - 1, oy2 - 1, 3, 3);
  }

  // worker flags, your side's only: the same pennant the minimap draws, with
  // the job's icon over it - the chart is where an order across the world is
  // given and read, so it has room to say which order it was
  for (const q of players) {
    if (!q.active || q.team !== player.team || !q.flag) continue;
    const lx = MAP_X + Math.round((q.flag.tx + 0.5) * MAP_S);
    const ly = MAP_Y + Math.round((q.flag.ty + 0.5) * MAP_S);
    drawFlagIcon(ctx, q.flag.job, lx + 3, ly - 10, TEAMS[skin(q.team)].mark, '#241a10');
    drawFlagPennant(ctx, lx, ly, TEAMS[skin(q.team)].mark, '#241a10');
  }
  // the tile the pointer would plant on - only while the middle button is
  // held, exactly as in the world (state.flagAim)
  if (state.flagAim && mouse.inside) {
    const mt = mapTileAt(mouse.x, mouse.y);
    if (mt) {
      const f = player.flag;
      const lift = !!f && f.tx === mt.tx && f.ty === mt.ty;
      const gx = MAP_X + Math.round((mt.tx + 0.5) * MAP_S), gy = MAP_Y + Math.round((mt.ty + 0.5) * MAP_S);
      ctx.globalAlpha = 0.55 + 0.2 * Math.sin(now * 4);
      if (lift) drawFlagPennant(ctx, gx, gy, '#f4f7ff', '#241a10');
      else drawFlagIcon(ctx, flagResolve(player, mt.tx, mt.ty).job, gx, gy - 6, '#f4f7ff', '#241a10');
      ctx.globalAlpha = 1;
    }
  }

  // player marker: inked diamond + pulsing ring
  const pmx = MAP_X + Math.round((player.x / TILE) * MAP_S);
  const pmy = MAP_Y + Math.round((player.y / TILE) * MAP_S);
  const ph = (now * 0.9) % 1;
  ctx.globalAlpha = (1 - ph) * 0.5;
  ctx.strokeStyle = '#d84040';
  ctx.beginPath(); ctx.arc(pmx, pmy, 2 + ph * 6, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#241a10';
  ctx.fillRect(pmx - 2, pmy - 1, 5, 3); ctx.fillRect(pmx - 1, pmy - 2, 3, 5);
  ctx.fillStyle = '#e05548';
  ctx.fillRect(pmx - 1, pmy, 3, 1); ctx.fillRect(pmx, pmy - 1, 1, 3);

  // day & elapsed time, inked into the right column
  const dayT = 'DAY ' + state.day;
  drawPixelTextShadow(ctx, dayT, Math.round(COL_CX - pixelTextWidth(dayT) / 2), PANEL_Y + 168,
    '#4a3322', 'rgba(120,92,58,0.45)');
  const mins = Math.floor(state.elapsed / 60);
  const secs = Math.floor(state.elapsed % 60);
  const clk = mins + ':' + (secs < 10 ? '0' : '') + secs;
  drawPixelTextShadow(ctx, clk, Math.round(COL_CX - pixelTextWidth(clk) / 2), PANEL_Y + 179,
    '#6a5436', 'rgba(120,92,58,0.35)');
}

// ------------------------------------------------------------ settings menu (ESC)
// SET_*/SL_X/ROW_* anchors are declared in the canvas banner (relayout() writes them).

let dragSlider = null;

const setPanelCv = document.createElement('canvas');
setPanelCv.width = SET_W; setPanelCv.height = SET_H;

// the dark frost slab every baked panel sits on: chamfered, mottled, bevelled,
// crystal corners, and a gold title between ornament dashes. Shared by the
// settings panel and the main menu's TUTORIAL panel so they read as a set.
function bakeFrostSlab(g, w, h, title) {
  const cham = (x, y, ww, hh) => {
    g.fillRect(x + 2, y, ww - 4, hh);
    g.fillRect(x, y + 2, ww, hh - 4);
    g.fillRect(x + 1, y + 1, ww - 2, hh - 2);
  };
  g.fillStyle = '#0a0e23'; cham(0, 0, w, h);
  g.fillStyle = '#141c3c'; cham(1, 1, w - 2, h - 2);
  // subtle mottling
  for (let y = 3; y < h - 3; y += 3) {
    for (let x = 3; x < w - 3; x += 3) {
      const hv = hash2(x * 11 + 3, y * 7 + 19);
      if (hv > 0.86) { g.fillStyle = '#182148'; g.fillRect(x, y, 3, 3); }
      else if (hv < 0.10) { g.fillStyle = '#111834'; g.fillRect(x, y, 3, 3); }
    }
  }
  // bevel: icy top light, deep bottom shade
  g.fillStyle = '#35426e';
  g.fillRect(2, 1, w - 4, 1); g.fillRect(1, 2, 1, h - 4);
  g.fillStyle = '#080c1c';
  g.fillRect(2, h - 2, w - 4, 1); g.fillRect(w - 2, 2, 1, h - 4);
  // ice-crystal corner accents
  g.fillStyle = '#5a7fb8';
  for (const [cx2, cy2] of [[7, 7], [w - 8, 7], [7, h - 8], [w - 8, h - 8]]) {
    g.fillRect(cx2 - 2, cy2, 5, 1); g.fillRect(cx2, cy2 - 2, 1, 5);
    g.fillRect(cx2 - 1, cy2 - 1, 3, 3);
  }
  g.fillStyle = '#a8c8e8';
  for (const [cx2, cy2] of [[7, 7], [w - 8, 7], [7, h - 8], [w - 8, h - 8]]) {
    g.fillRect(cx2, cy2, 1, 1);
  }
  // title with dashes
  const tw = pixelTextWidth(title);
  const tx0 = Math.round((w - tw) / 2);
  drawPixelTextShadow(g, title, tx0, 8, '#ffd95c', 'rgba(8,12,28,0.9)');
  g.fillStyle = '#4a5480';
  g.fillRect(tx0 - 26, 11, 18, 1); g.fillRect(tx0 + tw + 8, 11, 18, 1);
  g.fillRect(tx0 - 30, 10, 2, 3); g.fillRect(tx0 + tw + 28, 10, 2, 3);
}

// The panel is TABBED: a navbar under the title splits the rows into pages,
// and each page scrolls independently when its rows outgrow the content
// window - which is what makes the slab, pinned at 240x218 by the 240-row
// floor fitCanvas() guarantees, able to hold any number of future settings.
// Row tables, not row code: a page is a list of {id, label, kind} and the
// layout, the draw, the hit test and the DBG anchors all read the same table.
const SET_TABS = [
  { id: 'game', label: 'GAME', rows: [
    { id: 'map', label: 'MINIMAP SIZE', kind: 'slider' },
    { id: 'hud', label: 'HUD SIZE', kind: 'slider' },
    { id: 'shake', label: 'SCREEN SHAKE', kind: 'toggle' },
    // the pad's rumble / a phone's buzz when an item is grabbed, placed or
    // swapped (haptic, js/input.js) - dead on a mouse, which has no motor
    { id: 'haptics', label: 'RUMBLE', kind: 'toggle' },
    { id: 'info', label: 'INFO DISPLAY', kind: 'toggle' },
    { id: 'cursor', label: 'CURSOR', kind: 'toggle' },
    { id: 'teamBlue', label: 'MY TEAM', kind: 'toggle' }, // BLUE always, or the roster's colour (skin, player.js)
    // phone mode (js/mobile.js): the device's own answer, or forced either
    // way - the fit, the camera and the touch controls all follow it
    { id: 'mobile', label: 'TOUCH MODE', kind: 'choice',
      opts: [{ id: 'auto', label: 'AUTO' }, { id: 'on', label: 'ON' }, { id: 'off', label: 'OFF' }],
      val: () => settings.mobile || 'auto', pick: (v) => { settings.mobile = v; fitCanvas(); relayout(); } },
  ] },
  { id: 'video', label: 'VIDEO', rows: [
    { id: 'quality', label: 'QUALITY', kind: 'choice',
      opts: [{ id: 'low', label: 'LOW' }, { id: 'medium', label: 'MEDIUM' }, { id: 'high', label: 'HIGH' }],
      val: () => vidPreset(), pick: (v) => Object.assign(settings, VID_PRESETS[v]) },
    { id: 'vidClouds', label: 'CLOUD SHADOWS', kind: 'toggle' },
    { id: 'vidRays', label: 'SUN SHAFTS', kind: 'toggle' },
    { id: 'vidStars', label: 'ICE STARS', kind: 'toggle' },
    { id: 'vidSnow', label: 'SNOWFALL', kind: 'toggle' },
    { id: 'vidVig', label: 'VIGNETTE', kind: 'toggle' },
  ] },
  { id: 'audio', label: 'AUDIO', rows: [
    { id: 'vol', label: 'MASTER', kind: 'slider' },
    { id: 'music', label: 'MUSIC', kind: 'slider' },
    { id: 'sfx', label: 'SOUNDS', kind: 'slider' },
  ] },
  { id: 'controls', label: 'CONTROLS', rows: [] }, // the three listings below: the keyboard's live, the pad's and the touch baked
];
// The QUALITY row is a macro over the video toggles, one click for a weak
// machine: LOW turns the whole weather-and-light dressing off, MEDIUM keeps
// everything but the cloud shadows (the one pass that costs every daytime
// frame - two full-view multiply fills), HIGH is everything. SNOWFALL is
// deliberately not in any preset: falling snow is the game's identity and
// nearly free (baked speck atlas), so only a deliberate hand turns it off.
const VID_PRESETS = {
  low: { vidClouds: false, vidRays: false, vidStars: false, vidVig: false },
  medium: { vidClouds: false, vidRays: true, vidStars: true, vidVig: true },
  high: { vidClouds: true, vidRays: true, vidStars: true, vidVig: true },
};
// which preset the toggles currently spell, or null for a hand-picked mix
function vidPreset() {
  outer: for (const name in VID_PRESETS) {
    for (const k in VID_PRESETS[name]) if (settings[k] !== VID_PRESETS[name][k]) continue outer;
    return name;
  }
  return null;
}

let setTab = 'game';                                        // the open page
const setScroll = { game: 0, video: 0, audio: 0, controls: 0 }; // px scrolled per page
const SET_TAB_Y = 20;      // navbar baseline, panel-local
const SET_CONTENT_Y = 36;  // content window top
const SET_CONTENT_B = 202; // ... and bottom (the ESC CLOSE hint sits below)

// The CONTROLS page is itself tabbed - one listing per controller, since a
// phone and a pad each put the same verbs somewhere else. Its navbar sits
// pinned at the top of the content window and only the listing scrolls. The
// tab opens on the controller in hand (ctrlTabNow) until a click picks one.
const CTRL_TABS = [{ id: 'keys', label: 'KEYBOARD' }, { id: 'pad', label: 'GAMEPAD' }, { id: 'touch', label: 'TOUCH' }];
const CTRL_TAB_H = 13; // the band the sub-navbar takes off the content window
let ctrlTab = null;
function ctrlTabNow() { return ctrlTab || (MOBILE ? 'touch' : padActive() ? 'pad' : 'keys'); }

// Everything positioned inside the panel comes from here: the navbar cells,
// the open page's rows (each carrying its y in view space, pre-scroll), the
// content window, and how far this page can scroll. Draw, hit test and the
// DBG anchors all call it, so a click can never disagree with a pixel.
function settingsLayout() {
  const n = SET_TABS.length, cw = Math.floor((SET_W - 24) / n);
  const tabs = SET_TABS.map((t, i) => ({ id: t.id, label: t.label,
    x: SET_X + 12 + i * cw, y: SET_Y + SET_TAB_Y, w: cw, h: 9 }));
  const tab = SET_TABS.find(t => t.id === setTab) || SET_TABS[0];
  const clipY0 = SET_Y + SET_CONTENT_Y, clipY1 = SET_Y + SET_CONTENT_B;
  const rows = [];
  let y = clipY0 + 6;
  for (const r of tab.rows) {
    const row = { id: r.id, label: r.label, kind: r.kind, y, val: r.val, pick: r.pick };
    if (r.kind === 'choice') {
      let x = SL_X;
      row.opts = r.opts.map(o => { const w = pixelTextWidth(o.label); const q = { id: o.id, label: o.label, x, w }; x += w + 8; return q; });
    }
    rows.push(row); y += 14;
  }
  // the controls page: its own navbar's cells, and the open listing under them
  const cn = CTRL_TABS.length, ccw = Math.floor((SET_W - 24) / cn);
  const ctabs = CTRL_TABS.map((t, i) => ({ id: t.id, label: t.label, x: SET_X + 12 + i * ccw, y: clipY0 + 2, w: ccw, h: 9 }));
  const ctrl = ctrlTabNow();
  const contentH = setTab === 'controls' ? ctrlCvs[ctrl].height + CTRL_TAB_H : (y + 2 - clipY0);
  const maxScroll = Math.max(0, contentH - (clipY1 - clipY0));
  setScroll[setTab] = Math.max(0, Math.min(setScroll[setTab] || 0, maxScroll));
  return { tabs, rows, clipY0, clipY1, scroll: setScroll[setTab], maxScroll, ctabs, ctrl };
}

// the wheel over the open panel walks the open page (input.js, both the
// in-match ESC slab and the title menu's slide-in)
function settingsScrollBy(d) {
  const L = settingsLayout();
  setScroll[setTab] = Math.max(0, Math.min(L.maxScroll, setScroll[setTab] + d));
}
// the navbar walked by key: left/right steps the page, the way a click on a
// tab does - what a pad's bumpers and dpad reach the tabs through
function settingsTabBy(d) {
  const i = SET_TABS.findIndex(t => t.id === setTab);
  setTab = SET_TABS[(i + d + SET_TABS.length) % SET_TABS.length].id;
  SFX.pickup();
}
// the keys the open slab answers wherever it is up (the title's slide-in
// and the in-match ESC slab both route here): the arrows page and scroll.
// True when the key was the panel's, so the caller drops it.
function settingsKey(k) {
  const d = moveDir(k);
  if (d === 'left') settingsTabBy(-1);
  else if (d === 'right') settingsTabBy(1);
  else if (d === 'up') settingsScrollBy(-8);
  else if (d === 'down') settingsScrollBy(8);
  else return false;
  return true;
}

function buildSettingsPanel() {
  const g = setPanelCv.getContext('2d');
  bakeFrostSlab(g, SET_W, SET_H, 'SETTINGS');
  // the close hint is drawn live (renderSettings): it names the controller in hand
}

// The CONTROLS page: three listings, one per controller, blitted into the
// content window at the page's scroll like any other page. The pad's and
// the touch listing bake once (neither changes); the keyboard's is LIVE
// (drawKeyRows, below) over a bake that holds only the weapon primer.
const PAD_READ_Y = 148, PAD_READ_H = 44; // the pad listing's live readout: where it starts, and the band it takes (drawPadReadout)
const ctrlCvs = { keys: document.createElement('canvas'), pad: document.createElement('canvas'), touch: document.createElement('canvas') };
ctrlCvs.keys.width = SET_W; // its height is set by bakeCtrlKeys, under the listing
ctrlCvs.pad.width = SET_W; ctrlCvs.pad.height = 148 + PAD_READ_H;
ctrlCvs.touch.width = SET_W; ctrlCvs.touch.height = 96;

// THE WEAPON PRIMER: the one thing about the left button a new player cannot
// work out by pressing it, drawn rather than explained. It is a real HORN BOW
// carrying a real overload - ARROW 2, FLAME 4, ARROW 2, THROWING LOG 8 against
// a tensile of 15 - so every number on it is the game's own arithmetic
// (toolPlan, js/tools.js) and the picture cannot drift from the weapon.
//
// It is the SHELF, drawn at rest: the same row in the same order, the tool at
// the left end, the hatch on the modifier, the weight pips, the gold bar on
// the lead shot, the FLAME's rail reaching forward over the shot it is riding
// (shelfRails, js/ui.js), the budget track under the lot and the "!" on a tool
// carrying more than it can swing. That is the whole point of the page: what
// is learned here is recognised in the corner of the screen.
const PRIMER = {
  tool: 'hornbow',
  // cell 0 first, exactly as the row reads left to right and the press spends
  bits: ['arrow', 'flame', 'arrow', 'log'],
  notes: [
    'ARROW 2 - FIRES FIRST, PLAIN',
    'FLAME 4 - EVERY SHOT AFTER IT BURNS',
    'ARROW 2 - FIRES TOO, AND IT BURNS',
    'THROWING LOG 8 - ONLY 7 LEFT, SO IT SITS',
  ],
};
const PR_CELL = 18, PR_GAP = 2, PR_X = 22, PR_TX = 16; // the row's cells, and the notes stacked under it
function drawToolPrimer(g, y0) {
  const T = TOOLS[PRIMER.tool];
  const cell = makeTool(PRIMER.tool);
  for (let i = 0; i < PRIMER.bits.length; i++) cell.bits[i] = PRIMER.bits[i];
  const plan = toolPlan(cell);
  const n = PRIMER.bits.length;
  // cell -1 is the tool, at the row's left end - the shelf's own order
  const rowY = y0 + 16;
  const rect = (i) => ({ x: PR_X + (i + 1) * (PR_CELL + PR_GAP), y: rowY, w: PR_CELL, h: PR_CELL });
  const mid = PR_CELL >> 1;

  g.fillStyle = '#2c3a68';                                   // the section's own rule
  g.fillRect(12, y0 - 5, SET_W - 24, 1);
  drawPixelText(g, 'THE WEAPON', 16, y0 - 1, '#ffd95c');

  // THE RAILS, off the same reader the shelf uses: the FLAME reaches the one
  // arrow that fires after it, and nothing before it
  shelfRails(cell, plan).forEach((rail, d) => {
    const from = rect(rail.i), to = rect(rail.hits[rail.hits.length - 1]);
    const y = rowY - 3 - d * SHELF_RAIL, x0 = from.x + mid;
    g.fillStyle = rail.col;
    g.fillRect(x0, y, to.x + mid - x0 + 1, 1);
    g.fillRect(x0, y, 1, rowY - y);
    for (const j of rail.hits) g.fillRect(rect(j).x + mid - 1, y - 1, 3, 2);
  });

  // the tool at the head of the row, wearing the "!" its load has earned
  const tr = rect(-1);
  g.fillStyle = TOOL_TIERS[T.tier].rim;
  g.fillRect(tr.x, tr.y, tr.w, tr.h);
  g.fillStyle = TOOL_TIERS[T.tier].plate;
  g.fillRect(tr.x + 1, tr.y + 1, tr.w - 2, tr.h - 2);
  drawItemIcon(toolType(PRIMER.tool), tr, tr.y, g);
  drawOverWarn(tr, tr.y, 0, g);

  for (let i = 0; i < n; i++) {
    const id = PRIMER.bits[i], b = BITS[id];
    const r = rect(i);
    const dead = plan.cut >= 0 && i >= plan.cut;
    const tp = TOOL_TIERS[b.tier];
    g.fillStyle = dead ? '#c2465a' : tp.rim;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = tp.plate;
    g.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    if (dead) g.globalAlpha = 0.45;
    modPlate(bitType(id), r, r.y, PR_CELL, g);
    drawItemIcon(bitType(id), r, r.y - 2, g);
    g.fillStyle = dead ? '#e0637a' : '#f2cc6a';                // weight, as pips
    for (let k = 0; k < b.weight && k < 8; k++) g.fillRect(r.x + 2 + k * 2, r.y + r.h - 3, 1, 2);
    g.globalAlpha = 1;
    // the note for this cell, stacked under the row in the bit's own colour -
    // in firing order, so the list reads as the row does
    drawPixelText(g, PRIMER.notes[i], PR_TX, rowY + 40 + i * 9, dead ? '#e0637a' : b.col);
  }

  // the gold bar on the lead shot: the press starts here
  const lead = rect(plan.shots[0].i);
  g.fillStyle = '#f2cc6a';
  g.fillRect(lead.x - PR_GAP, lead.y, PR_GAP, lead.h);

  // the budget track under the bit cells: what the tool can swing, and what
  // this build actually spends of it
  const b0 = rect(0), bN = rect(n - 1);
  const bx = b0.x + 1, by = rowY + PR_CELL + 1, bw = bN.x + bN.w - b0.x - 2;
  let fill = Math.round(bw * Math.min(1, plan.used / T.tensile));
  if (plan.load > T.tensile) fill = Math.min(fill, bw - 3);
  g.fillStyle = '#0f1632';
  g.fillRect(bx - 1, by, bw + 2, 5);
  g.fillStyle = TOOL_TIERS[T.tier].ink;
  g.fillRect(bx, by + 1, fill, 3);
  g.fillStyle = '#c2465a';
  g.fillRect(bx + fill, by + 1, bw - fill, 3);
  drawPixelText(g, T.name + ' - STRENGTH ' + T.tensile + ', SPENDS ' + plan.used,
    PR_TX, rowY + 28, '#f2cc6a');

  // and the three rules the picture alone cannot say
  const foot = rowY + 40 + n * 9 + 4;
  drawPixelText(g, 'THE ! IS THE TOOLS OVERLOAD - THE RED IS WHAT SITS', PR_TX, foot, '#9fb6d8');
  drawPixelText(g, 'ONE CLICK FIRES EVERY BIT THE TOOL CAN AFFORD', PR_TX, foot + 9, '#cfe0f2');
  drawPixelText(g, 'TWO OF ONE MODIFIER COMPOUND - 2X AND 2X IS 4X', PR_TX, foot + 18, '#8fe08a');
}

// THE KEYBOARD LISTING IS LIVE, NOT BAKED: every rebindable verb sits beside
// its key drawn as a cap - the same cap the work prompt wears in the world
// (drawKeyCap, ui.js), so what is learned here is recognised there - and a
// cap is a button: it lifts on hover, a click sets it LISTENING (the face
// pulses gold; state.rebind, input.js) and the next key down is its key. The
// fixed keys - the mouse's buttons, ESC, the debug pair - are plain gold
// text, because nothing about them can be pressed. RESET at the foot of the
// right column puts the defaults back, and sits dim while they already are.
// Two columns; a row is an action id, {acts, verb} for a run of caps on one
// verb (the four walk keys, the four abilities), or [key, verb] for a fixed
// one. keyRowsLayout lays it out listing-local (the blit origin is the
// content window's top less the scroll); the draw, the hit test and
// DBG.keyRows all read it, so a click can never disagree with a pixel.
const KEY_ROWS = [
  [{ acts: ['up', 'left', 'down', 'right'], verb: 'MOVE' }, { acts: ['ab1', 'ab2', 'ab3', 'ab4'], verb: 'ABILITIES' },
    'dodge', 'slide', 'work', 'berry', 'fish', 'bag', 'char'],
  ['map', 'board', 'mute', 'pause', ['CLICK', 'FIRE'], ['RMB', 'BUILD WHEEL'], ['MMB', 'ORDER CREW'],
    ['ESC', 'SETTINGS'], ['SCROLL', 'ZOOM'], ['F3', 'INFO'], ['.', 'HITBOX']],
];
const KEY_ROW_H = 12, KEY_ROWS_Y = 5;
const KEYS_PRIMER_Y = KEY_ROWS_Y + 12 * KEY_ROW_H + 12; // the primer bakes under the listing and its RESET
function keyRowsLayout() {
  const caps = [], words = [];
  for (let c = 0; c < 2; c++) {
    const x0 = c === 0 ? 14 : 124;
    const rows = KEY_ROWS[c].map((row) => {
      if (Array.isArray(row)) return { fixed: row[0], verb: row[1], w: pixelTextWidth(row[0]) };
      const acts = row.acts || [row];
      const runs = acts.map((a) => { const lab = keyCap(a); return { act: a, lab, w: pixelTextWidth(lab) + 6 }; });
      return { runs, verb: row.verb || KEY_ACT[row].verb, w: runs.reduce((s, r) => s + r.w + 2, -2) };
    });
    const dx = Math.max(30, rows.reduce((m, r) => Math.max(m, r.w), 0) + 4); // the verbs line up past the widest run
    let y = KEY_ROWS_Y;
    for (const r of rows) {
      if (r.fixed) words.push({ x: x0, y: y + 3, t: r.fixed, col: '#ffd95c' });
      else { let x = x0; for (const q of r.runs) { caps.push({ act: q.act, x, y, w: q.w, h: 10, lab: q.lab }); x += q.w + 2; } }
      words.push({ x: x0 + dx, y: y + 3, t: r.verb, col: '#7a8bb8' });
      y += KEY_ROW_H;
    }
  }
  const rw = pixelTextWidth('RESET');
  return { caps, words, reset: { x: SET_W - 16 - rw, y: KEY_ROWS_Y + 11 * KEY_ROW_H + 3, w: rw, h: 7 } };
}
// the listing at ox, oy (the blit origin); hit is settingsHit's answer
function drawKeyRows(ox, oy, hit, now) {
  const K = keyRowsLayout();
  for (const w of K.words) drawPixelText(ctx, w.t, ox + w.x, oy + w.y, w.col);
  for (const c of K.caps) drawKeyCap(ctx, ox + c.x, oy + c.y, c.lab, false, state.rebind === c.act ? 2 : hit === 'key:' + c.act ? 1 : 0, now);
  drawPixelText(ctx, 'RESET', ox + K.reset.x, oy + K.reset.y, bindsDefault() ? '#2c3a68' : hit === 'keyreset' ? '#cfe0ff' : '#7a8bb8');
}
(function bakeCtrlKeys() {
  ctrlCvs.keys.height = KEYS_PRIMER_Y + 128; // the primer's own height
  drawToolPrimer(ctrlCvs.keys.getContext('2d'), KEYS_PRIMER_Y);
})();

// A pad button as a picture, ~9px, at x, y (its top-left): a face button is a
// disc with its letter, a bumper a flat pill, a trigger a tall one, a stick
// a ring with a knob, the dpad a cross with the pressed arm lit, and START /
// BACK the two small pills. Gold, like the key names beside the keyboard list.
function drawPadGlyph(g, x, y, kind, label) {
  const gold = '#ffd95c', ink = '#141c3c';
  g.fillStyle = gold;
  if (kind === 'face') {
    touchDisc(g, x + 4, y + 4, 4, gold);
    drawPixelText(g, label, x + 3, y + 2, ink);
  } else if (kind === 'bump') {
    g.fillRect(x, y + 2, 13, 5); g.fillRect(x + 1, y + 1, 11, 7);
    drawPixelText(g, label, x + 3, y + 2, ink);
  } else if (kind === 'trig') {
    g.fillRect(x + 2, y, 9, 9); g.fillRect(x + 1, y + 1, 11, 7);
    drawPixelText(g, label, x + 3, y + 2, ink);
  } else if (kind === 'stick') {
    touchRing(g, x + 4, y + 4, 4, gold);
    touchDisc(g, x + 4, y + 4, 2, gold);
    drawPixelText(g, label, x + 11, y + 2, gold);
  } else if (kind === 'dpad') {
    g.fillStyle = '#7a8bb8';
    g.fillRect(x + 3, y, 3, 9); g.fillRect(x, y + 3, 9, 3);
    g.fillStyle = gold;
    if (label === 'U') g.fillRect(x + 3, y, 3, 3);
    else if (label === 'D') g.fillRect(x + 3, y + 6, 3, 3);
    else if (label === 'L') g.fillRect(x, y + 3, 3, 3);
    else if (label === 'R') g.fillRect(x + 6, y + 3, 3, 3);
  } else if (kind === 'pill') {
    g.fillRect(x + 1, y + 2, 9, 5); g.fillRect(x, y + 3, 11, 3);
    g.fillStyle = ink;
    if (label === 'START') { g.fillRect(x + 3, y + 3, 5, 1); g.fillRect(x + 3, y + 5, 5, 1); }
    else { g.fillRect(x + 3, y + 3, 2, 3); g.fillRect(x + 6, y + 3, 2, 3); }
  }
}
// The pad READOUT under the GAMEPAD listing: the name the browser gives the
// pad in hand (none: the row stays dim - the browser sees no pad, whatever is
// plugged in), then the two sticks as rings with a knob riding the live tilt,
// the triggers as bars, and the sixteen buttons as pips that light while
// held. An instrument, drawn live over the baked listing (renderSettings):
// what it moves is what the game reads, so a stick that walks the knob but
// not the player, or a pad that moves the mouse but not the knob, says where
// the fault is without a word. A pad the browser could not lay out wears an
// UNMAPPED tag (padCalibrate, gamepad.js, is reading it by its rest values).
function drawPadReadout(x0, y0) {
  const gold = '#ffd95c', dim = '#4a5480', ink = '#7a8bb8';
  ctx.fillStyle = '#2c3a68'; ctx.fillRect(x0 + 14, y0, SET_W - 28, 1);
  const y = y0 + 6;
  drawPixelText(ctx, 'GAMEPAD', x0 + 14, y, '#cfe0ff');
  let name = pad.id ? pad.id.replace(/\s*\(.*$/, '').toUpperCase() : '-';
  const maxW = SET_W - 14 - 60 - 8 - (pad.std ? 0 : pixelTextWidth('UNMAPPED') + 6);
  while (name.length > 1 && pixelTextWidth(name) > maxW) name = name.slice(0, -1);
  drawPixelText(ctx, name, x0 + 60, y, pad.id ? gold : dim);
  if (!pad.std && pad.id) drawPixelText(ctx, 'UNMAPPED', x0 + SET_W - 14 - pixelTextWidth('UNMAPPED'), y, '#ff9a8a');
  // the sticks: a ring each, the knob at the live tilt
  const sy = y + 20, live = !!pad.id;
  const stick = (cx, tx, ty, lbl) => {
    touchRing(ctx, cx, sy, 8, live ? ink : dim);
    touchDisc(ctx, cx + Math.round(tx * 5), sy + Math.round(ty * 5), 2, live ? gold : dim);
    drawPixelText(ctx, lbl, cx - 2, sy + 11, ink);
  };
  stick(x0 + 30, pad.raw.lx, pad.raw.ly, 'L');
  stick(x0 + 58, pad.raw.rx, pad.raw.ry, 'R');
  // the triggers: two bars filling with the squeeze
  const bar = (bx, v, lbl) => {
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(bx, sy - 8, 6, 16);
    ctx.fillStyle = live ? gold : dim; const h = Math.round(v * 14); ctx.fillRect(bx + 1, sy + 7 - h, 4, h);
    drawPixelText(ctx, lbl, bx - 2, sy + 11, ink);
  };
  bar(x0 + 80, pad.raw.lt, 'LT'); bar(x0 + 96, pad.raw.rt, 'RT');
  // the sixteen buttons, in the standard order, lit while held
  for (let i = 0; i < 16; i++) {
    const bx = x0 + 118 + (i % 8) * 8, by = sy - 6 + Math.floor(i / 8) * 8;
    ctx.fillStyle = pad.down[i] || (i === 6 && pad.lt) || (i === 7 && pad.rt) ? gold : live ? '#2c3a68' : '#1a2245';
    ctx.fillRect(bx, by, 5, 5);
  }
}
(function bakeCtrlPad() {
  const g = ctrlCvs.pad.getContext('2d');
  // the play set on the left, the hold-and-drag gestures and the menu set on
  // the right; every row is [glyph kind, its label, the verb]
  const cols = [
    [['stick', 'L', 'MOVE'], ['stick', 'R', 'AIM'], ['trig', 'RT', 'FIRE'], ['trig', 'LT', 'SLIDE'], ['face', 'A', 'DODGE - HOP OFF'], ['face', 'X', 'HARVEST'],
      ['face', 'Y', 'ABILITY 1'], ['face', 'B', 'ABILITY 2'], ['bump', 'LB', 'ABILITY 3'], ['bump', 'RB', 'ABILITY 4'], ['dpad', 'L', 'EAT BERRY'], ['dpad', 'R', 'EAT FISH']],
    [['stick', 'L3', 'BACKPACK'], ['dpad', 'U', 'CHARACTER'], ['dpad', 'D', 'HOLD: BUILD WHEEL'], ['stick', 'R3', 'HOLD: ORDER CREW'], ['pill', 'BACK', 'WORLD MAP'], ['pill', 'BACK', 'HOLD: STANDINGS'],
      ['pill', 'START', 'SETTINGS'], null, ['face', 'A', 'TAKE'], ['face', 'B', 'BACK'], ['bump', 'LB', 'PAGE TABS'], ['dpad', 'L', 'SELECT'], ['stick', 'L', 'POINTER'], ['stick', 'R', 'SCROLL']],
  ];
  for (let c = 0; c < 2; c++) {
    let y = 4;
    const x0 = c === 0 ? 14 : 124;
    for (const row of cols[c]) {
      if (row) {
        drawPadGlyph(g, x0, y, row[0], row[1]);
        drawPixelText(g, row[2], x0 + (row[0] === 'stick' ? 22 : 16), y + 2, '#7a8bb8');
      } else { // the rule between the play set and the menu set
        g.fillStyle = '#2c3a68'; g.fillRect(x0, y + 4, 100, 1);
      }
      y += 10;
    }
  }
})();
(function bakeCtrlTouch() {
  const g = ctrlCvs.touch.getContext('2d');
  // the two sticks and the pack's own button first, then the plates in the
  // order they climb the right column and sit on the left; the icons are the
  // plates' own (drawTouchIcon, ui.js)
  const cols = [
    [['stick', 'MOVE', TOUCH_INK], ['stick', 'AIM - LIFT TO FIRE', TOUCH_HOT], ['dodge', 'DODGE'], ['work', 'HARVEST'], ['slide', 'SLIDE'], ['char', 'CHARACTER'], ['pack', 'BACKPACK']],
    [['build', 'HOLD: BUILD WHEEL'], ['flag', 'HOLD: ORDER CREW'], ['map', 'WORLD MAP'], ['cog', 'SETTINGS'], ['x', 'BACK'], ['zoomOut', 'ZOOM']],
  ];
  for (let c = 0; c < 2; c++) {
    let y = 6;
    const x0 = c === 0 ? 14 : 124;
    for (const [id, desc, col] of cols[c]) {
      const ink = col || '#ffd95c';
      touchDisc(g, x0 + 5, y + 3, 7, TOUCH_PLATE);
      touchRing(g, x0 + 5, y + 3, 7, col === TOUCH_HOT ? TOUCH_HOT : TOUCH_RIM);
      if (id === 'stick') touchRing(g, x0 + 5, y + 3, 3, ink), touchDisc(g, x0 + 6, y + 4, 1, ink);
      else drawTouchIcon(g, id, x0 + 5, y + 3, ink);
      if (id === 'zoomOut') { touchDisc(g, x0 + 21, y + 3, 7, TOUCH_PLATE); touchRing(g, x0 + 21, y + 3, 7, TOUCH_RIM); drawTouchIcon(g, 'zoomIn', x0 + 21, y + 3, ink); }
      drawPixelText(g, desc, x0 + (id === 'zoomOut' ? 34 : 18), y + 1, '#7a8bb8');
      y += 13;
    }
  }
})();

function applySliderDrag() {
  const t = Math.max(0, Math.min(1, (mouse.x - SL_X) / SL_W));
  if (dragSlider === 'vol') {
    settings.volume = Math.round(t * 20) / 20;
    SFX.setVolume(settings.volume);
  } else if (dragSlider === 'music') {
    settings.musicVol = Math.round(t * 20) / 20;
    SFX.setMusicVolume(settings.musicVol);
  } else if (dragSlider === 'sfx') {
    settings.sfxVol = Math.round(t * 20) / 20;
    SFX.setSfxVolume(settings.sfxVol);
  } else if (dragSlider === 'map') {
    settings.mmR = Math.round(16 + t * 18);
    applyMinimapSize();
  } else if (dragSlider === 'hud') {
    // 0.75x-1.5x in 0.05 steps; the strip reads it live (hudSc, ui.js) -
    // the phone's own dial or the desktop's, whichever is playing
    settings[hudScaleKey()] = Math.round((0.75 + t * 0.75) * 20) / 20;
  }
}

// the speaker beside the MASTER track: 9x9, the same plate the toggle rows
// use. It lives on the AUDIO page, so it only has a rect while that page is
// open - callers null-check.
function muteBtnRect() {
  if (setTab !== 'audio') return null;
  const L = settingsLayout();
  const r = L.rows.find(r => r.id === 'vol');
  return r ? { x: SET_MUTE_X, y: r.y - L.scroll - 1, w: 9, h: 9 } : null;
}

// The way out: a frost plank hanging under the in-match settings slab (the
// ESC panel is the one menu a match or the arena has). In practice it is
// LEAVE PRACTICE - leavePractice() (js/menu.js), the reroll's whiteout onto
// a bare URL, so leaving lands on a fresh title world; in a match LEAVE
// MATCH - toLobby() (js/screens.js), the death screen's own way back to the
// title. Only the in-match slab hangs it: the title's slide-in has nothing
// to leave.
function leavePlankRect() { return { x: Math.round((VIEW_W - 132) / 2), y: SET_Y + SET_H + 8, w: 132, h: 20 }; }

// which settings widget is under the pointer (null for none); shared by the
// click handler and the cursor so the hand cursor can never disagree with a click
// Answers: a row id ('vol', 'shake', 'vidClouds', ...), 'mute', 'leave',
// 'tab:<id>' for a navbar cell, 'ctab:<id>' for a controls-page cell,
// 'c:<row>:<opt>' for a choice row's word (QUALITY, TOUCH MODE), or
// 'key:<action>' for a keyboard cap and 'keyreset' for the word under them.
function settingsHit() {
  const mx = mouse.x, my = mouse.y;
  const L = settingsLayout();
  for (const t of L.tabs)
    if (t.id !== setTab && mx >= t.x && mx < t.x + t.w && my >= t.y - 3 && my < t.y + t.h + 3) return 'tab:' + t.id;
  if (setTab === 'controls') for (const t of L.ctabs)
    if (t.id !== L.ctrl && mx >= t.x && mx < t.x + t.w && my >= t.y - 2 && my < t.y + t.h + 2) return 'ctab:' + t.id;
  const b = muteBtnRect();
  if (b && mx >= b.x - 2 && mx < b.x + b.w + 2 && my >= b.y - 2 && my < b.y + b.h + 2) return 'mute';
  if (state.settingsOpen) {
    const l = leavePlankRect();
    if (mx >= l.x - 2 && mx < l.x + l.w + 2 && my >= l.y - 3 && my < l.y + l.h + 3) return 'leave';
  }
  if (my < L.clipY0 || my >= L.clipY1) return null; // the content window scrolls; nothing outside it is live
  // the CONTROLS page: the keyboard listing's caps and its RESET are live,
  // the other two listings are pictures
  if (setTab === 'controls') {
    if (L.ctrl !== 'keys' || my < L.clipY0 + CTRL_TAB_H) return null;
    const K = keyRowsLayout(), ox = SET_X, oy = L.clipY0 + CTRL_TAB_H - L.scroll;
    for (const c of K.caps) if (mx >= ox + c.x - 1 && mx < ox + c.x + c.w + 1 && my >= oy + c.y - 1 && my < oy + c.y + c.h + 1) return 'key:' + c.act;
    const r = K.reset;
    if (!bindsDefault() && mx >= ox + r.x - 3 && mx < ox + r.x + r.w + 3 && my >= oy + r.y - 3 && my < oy + r.y + r.h + 3) return 'keyreset';
    return null;
  }
  for (const r of L.rows) {
    const y = r.y - L.scroll;
    // 14px pitch, so the bands must not overlap or a click lands on two rows
    if (my < y - 3 || my > y + 10) continue;
    if (r.kind === 'choice') {
      for (const o of r.opts) if (mx >= o.x - 2 && mx < o.x + o.w + 4) return 'c:' + r.id + ':' + o.id;
      return null;
    }
    if (mx < SL_X - 4 || mx > SL_X + SL_W + 6) return null;
    return r.id;
  }
  return null;
}

function settingsMouseDown() {
  SFX.unlock();
  const hit = settingsHit();
  // a listening cap: any press but its own calls it off first
  if (state.rebind && hit !== 'key:' + state.rebind) state.rebind = null;
  if (!hit) return;
  if (hit.startsWith('key:')) { const a = hit.slice(4); if (state.rebind === a) { state.rebind = null; SFX.pickup(); } else rebindStart(a); return; }
  if (hit === 'keyreset') { resetBinds(); SFX.place(); return; }
  if (hit.startsWith('tab:')) { setTab = hit.slice(4); SFX.pickup(); return; }
  if (hit.startsWith('ctab:')) { ctrlTab = hit.slice(5); SFX.pickup(); return; }
  if (hit === 'vol' || hit === 'music' || hit === 'sfx' || hit === 'map' || hit === 'hud') { dragSlider = hit; applySliderDrag(); return; }
  if (hit === 'leave') { if (PRACTICE) leavePractice(); else toLobby(); return; }
  if (hit.startsWith('c:')) {
    const [, rid, oid] = hit.split(':');
    const row = settingsLayout().rows.find(r => r.id === rid);
    if (row && row.pick) row.pick(oid);
  }
  else if (hit === 'mute') settings.muted = SFX.toggleMute();
  else if (hit === 'cursor') settings.pixelCursor = !settings.pixelCursor;
  else settings[hit] = !settings[hit]; // every plain toggle row's id IS its settings key
  SFX.pickup();
  saveSettings();
}

// dim: the fill and the readout go grey. The three sound dials pass it while
// muted, so the speaker's state reads off every track it silences at a glance
function drawSliderRow(y, t, txt, dim) {
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(SL_X - 1, y + 1, SL_W + 2, 5);
  ctx.fillStyle = '#2c3a68'; ctx.fillRect(SL_X, y + 2, SL_W, 3);
  ctx.fillStyle = dim ? '#4a5480' : '#ffd95c'; ctx.fillRect(SL_X, y + 2, Math.round(t * SL_W), 3);
  const kx = SL_X + Math.round(t * SL_W);
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(kx - 2, y - 1, 5, 9);
  ctx.fillStyle = dim ? '#7a8bb8' : '#f4f7ff'; ctx.fillRect(kx - 1, y, 3, 7);
  drawPixelTextShadow(ctx, txt, SL_X + SL_W + 9, y, dim ? '#5a6690' : '#9fb6d8', 'rgba(8,12,28,0.9)');
}

// The mute control is a speaker, not a labelled toggle: a cone with two waves
// coming off it, the waves swapped for a cross when it is off.
function drawMuteBtn(hot) {
  const b = muteBtnRect();
  const on = !SFX.isMuted();
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = hot ? '#1f2b5c' : '#121a3a'; ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  const x = b.x + 1, y = b.y + 1; // the 7x7 glyph field
  ctx.fillStyle = on ? '#ffd95c' : '#7a8bb8';
  ctx.fillRect(x, y + 2, 1, 3); ctx.fillRect(x + 1, y + 1, 1, 5); ctx.fillRect(x + 2, y, 1, 7);
  if (on) {
    ctx.fillRect(x + 4, y + 2, 1, 3);
    ctx.fillRect(x + 6, y + 1, 1, 5);
  } else {
    ctx.fillStyle = '#ff6a5a';
    ctx.fillRect(x + 4, y + 2, 1, 1); ctx.fillRect(x + 5, y + 3, 1, 1); ctx.fillRect(x + 6, y + 4, 1, 1);
    ctx.fillRect(x + 6, y + 2, 1, 1); ctx.fillRect(x + 4, y + 4, 1, 1);
  }
}

function drawToggleRow(y, on, onTxt, offTxt) {
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(SL_X, y - 1, 9, 9);
  ctx.fillStyle = '#121a3a'; ctx.fillRect(SL_X + 1, y, 7, 7);
  if (on) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(SL_X + 2, y + 1, 5, 5); }
  drawPixelTextShadow(ctx, on ? (onTxt || 'ON') : (offTxt || 'OFF'), SL_X + 14, y,
    on ? '#cfe0ff' : '#7a8bb8', 'rgba(8,12,28,0.9)');
}

// one slider row's live half, by row id - the labels come off the row table
function drawSliderById(id, y, off) {
  if (id === 'vol') drawSliderRow(y, settings.volume, String(Math.round(settings.volume * 100)), off);
  else if (id === 'music') drawSliderRow(y, settings.musicVol, String(Math.round(settings.musicVol * 100)), off);
  else if (id === 'sfx') drawSliderRow(y, settings.sfxVol, String(Math.round(settings.sfxVol * 100)), off);
  else if (id === 'map') drawSliderRow(y, (settings.mmR - 16) / 18, 'R' + settings.mmR);
  else if (id === 'hud') drawSliderRow(y, (hudSc() - 0.75) / 0.75, String(Math.round(hudSc() * 100)));
}

// one toggle row's state, by row id
function toggleVal(id) { return id === 'cursor' ? settings.pixelCursor : !!settings[id]; }

// opts.slide (px): draw the panel shifted down by that much - the main menu
// slides it in over the living world and skips the dim + minimap preview
function renderSettings(now, opts) {
  if (dragSlider && mouse.down) applySliderDrag();
  const slide = opts && opts.slide ? Math.round(opts.slide) : 0;
  if (!opts || !opts.bare) {
    ctx.fillStyle = 'rgba(6,10,24,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // live minimap preview while resizing
    renderMinimap(now);
  }
  if (slide) { ctx.save(); ctx.translate(0, slide); }
  ctx.drawImage(setPanelCv, SET_X, SET_Y);
  drawBackHint(ctx, SET_X + SET_W / 2, SET_Y + 208, 'CLOSE');
  const off = SFX.isMuted();
  const hit = slide ? null : settingsHit(); // the menu's slide-in is not hoverable mid-flight
  const L = settingsLayout();
  // the navbar: the open page's name in gold over a gold underline, the rest
  // dim until hovered - the underline is the whole "you are here"
  for (const t of L.tabs) {
    const active = t.id === setTab;
    const col = active ? '#ffd95c' : hit === 'tab:' + t.id ? '#cfe0ff' : '#7a8bb8';
    drawPixelTextShadow(ctx, t.label, Math.round(t.x + (t.w - pixelTextWidth(t.label)) / 2), t.y, col, 'rgba(8,12,28,0.9)');
    if (active) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(t.x + 4, t.y + 8, t.w - 8, 1); }
  }
  ctx.fillStyle = '#2c3a68';
  ctx.fillRect(SET_X + 10, L.clipY0 - 3, SET_W - 20, 1);
  // the open page, clipped to the content window and shifted by its scroll
  ctx.save();
  ctx.beginPath(); ctx.rect(SET_X + 2, L.clipY0, SET_W - 4, L.clipY1 - L.clipY0); ctx.clip();
  if (setTab === 'controls') {
    // the listing, under a second clip so it scrolls beneath the pinned navbar
    ctx.save();
    ctx.beginPath(); ctx.rect(SET_X + 2, L.clipY0 + CTRL_TAB_H, SET_W - 4, L.clipY1 - L.clipY0 - CTRL_TAB_H); ctx.clip();
    ctx.drawImage(ctrlCvs[L.ctrl], SET_X, L.clipY0 + CTRL_TAB_H - L.scroll);
    if (L.ctrl === 'keys') drawKeyRows(SET_X, L.clipY0 + CTRL_TAB_H - L.scroll, hit, now);
    if (L.ctrl === 'pad') drawPadReadout(SET_X, L.clipY0 + CTRL_TAB_H - L.scroll + PAD_READ_Y);
    ctx.restore();
    // the navbar: the open listing's name in gold over a gold underline,
    // the rest dim until hovered; a green pip on GAMEPAD while one is in hand
    for (const t of L.ctabs) {
      const active = t.id === L.ctrl;
      const col = active ? '#ffd95c' : hit === 'ctab:' + t.id ? '#cfe0ff' : '#7a8bb8';
      const tw = pixelTextWidth(t.label), tx = Math.round(t.x + (t.w - tw) / 2);
      drawPixelTextShadow(ctx, t.label, tx, t.y, col, 'rgba(8,12,28,0.9)');
      if (active) { ctx.fillStyle = '#ffd95c'; ctx.fillRect(t.x + 4, t.y + 8, t.w - 8, 1); }
      if (t.id === 'pad' && padActive()) { ctx.fillStyle = '#8fe08a'; ctx.fillRect(tx + tw + 3, t.y + 1, 2, 2); }
    }
  } else {
    for (const r of L.rows) {
      const y = r.y - L.scroll;
      if (y < L.clipY0 - 12 || y > L.clipY1 + 4) continue;
      drawPixelText(ctx, r.label, SET_X + 14, y, '#cfe0ff');
      if (r.kind === 'slider') drawSliderById(r.id, y, r.id === 'vol' || r.id === 'music' || r.id === 'sfx' ? off : false);
      else if (r.kind === 'toggle') drawToggleRow(y, toggleVal(r.id),
        r.id === 'cursor' ? 'PIXEL' : r.id === 'teamBlue' ? 'ALWAYS BLUE' : undefined,
        r.id === 'cursor' ? 'BROWSER' : r.id === 'teamBlue' ? 'AS DEALT' : undefined);
      else if (r.kind === 'choice') {
        const cur = r.val ? r.val() : null; // the word in force wears gold; a hand-picked mix golds none
        for (const o of r.opts) {
          const col = cur === o.id ? '#ffd95c' : hit === 'c:' + r.id + ':' + o.id ? '#f4f7ff' : '#7a8bb8';
          drawPixelTextShadow(ctx, o.label, o.x, y, col, 'rgba(8,12,28,0.9)');
        }
      }
    }
    if (setTab === 'audio') drawMuteBtn(hit === 'mute');
  }
  ctx.restore();
  // the scroll track: only there when the page outgrows the window, thumb
  // position IS the affordance - grab the wheel, not a widget
  if (L.maxScroll > 0) {
    const x = SET_X + SET_W - 8, h = L.clipY1 - L.clipY0;
    ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, L.clipY0, 3, h);
    const th = Math.max(8, Math.round(h * h / (h + L.maxScroll)));
    const ty = L.clipY0 + Math.round((h - th) * (L.scroll / L.maxScroll));
    ctx.fillStyle = '#4a5480'; ctx.fillRect(x + 1, ty, 1, th);
  }
  // the one exit, on the same frost plank the title menu is made of
  // (drawMenuButton, js/menu.js) - the in-match slab only, never the title's
  if (state.settingsOpen && !slide) drawMenuButton(leavePlankRect(), PRACTICE ? 'LEAVE PRACTICE' : 'LEAVE MATCH', hit === 'leave' ? 1 : 0, now, false, false);
  if (slide) ctx.restore();
  // live strip preview while the HUD SIZE knob is in hand - the minimap
  // slider's grammar. Only during the drag, and drawn last: the strip's home
  // sits under the slab's bottom edge, so it rides over the panel for exactly
  // as long as the hand is resizing it.
  if (dragSlider === 'hud' && state.mode === 'play' && !player.dead) drawHudScaled(now, 0, false);
}

// ------------------------------------------------------------ player profile
// Who you are between matches: the display name every other player reads over
// your head, and the three lifetime numbers under it. The STORE is
// js/profile.js and nothing here touches localStorage - this banner is only
// the panel, the field and the title-screen tag that opens them.
//
// The panel is the menu's fourth sub-panel ('name'), so it inherits the slide,
// the frost slab and overMenuPanel() from the settings/tutorial/patch set. It
// opens itself once, on a first launch (updateTitle), and after that only from
// the tag bottom-left. There is no separate "click to edit" state: the panel
// being open IS the editor, and the keyboard belongs to it while it is up.
const NAME_FIELD = { x: 22, y: 30, w: 196, h: 22 }; // panel-local, like every other panel offset
const NAME_TICK_Y = 58;   // the capacity ticks under the field: one per allowed character
const NAME_STAT_Y = 100;  // first stat row
const NAME_STAT_P = 24;   // and the pitch of the three
const NAME_PLANK_Y = 176;
const NAME_BW = 88, NAME_BH = 20, NAME_GAP = 12;
const NAME_SHAKE_T = 0.3; // the field's refusal: it rattles and flushes red

// The three stats read as a ledger: an icon, a plain-English label, and the
// number right-aligned on the row with a dotted leader tying the pair across
// the gap - bare icon-and-number proved unreadable to anyone but the author.
// The quill is the edit affordance on the title-screen tag.
const NAME_CROWN_ICON = [
  '........', 'y..yy..y', 'y.yyyy.y', 'yyyyyyyy',
  '.yyyyyy.', '........', '........', '........',
];
const NAME_SUN_ICON = [
  '...yy...', '.y....y.', '..yyyy..', 'y.yyyy.y',
  'y.yyyy.y', '..yyyy..', '.y....y.', '...yy...',
];
const NAME_ICON_PAL = { '.': null, y: '#f2cc6a' };
const NAME_QUILL = ['....hh', '...hh.', '..hh..', '.hh...', 'th....', 't.....'];
const NAME_QUILL_PAL = { '.': null, h: '#9fb6d8', t: '#f2cc6a' };
const NAME_QUILL_HOT = { '.': null, h: '#ffd95c', t: '#fff1c2' };

const namePanelCv = document.createElement('canvas');
namePanelCv.width = SET_W; namePanelCv.height = SET_H;
function buildNamePanel() {
  const g = namePanelCv.getContext('2d');
  bakeFrostSlab(g, SET_W, SET_H, 'PLAYER');
  // the field: a well sunk into the slab (dark floor, lit lower lip), with
  // the frame's ice-blue picked up in its top corners
  const f = NAME_FIELD;
  g.fillStyle = '#080c1c'; g.fillRect(f.x - 1, f.y - 1, f.w + 2, f.h + 2);
  g.fillStyle = '#0a0e23'; g.fillRect(f.x, f.y, f.w, f.h);
  g.fillStyle = '#2c3a68'; g.fillRect(f.x + 1, f.y + f.h - 1, f.w - 2, 1);
  g.fillStyle = '#35426e';
  g.fillRect(f.x, f.y, 3, 1); g.fillRect(f.x, f.y, 1, 3);
  g.fillRect(f.x + f.w - 3, f.y, 3, 1); g.fillRect(f.x + f.w - 1, f.y, 1, 3);
  // the rule between the name and the numbers it has earned
  g.fillStyle = '#2c3a68'; g.fillRect(14, 74, SET_W - 28, 1);
}

// the local player wears the profile name; it is set in the Player constructor
// and this is the only other place it changes
function applyProfileName() { player.name = PROFILE.name(); }

function openNamePanel() {
  const m = state.menu;
  m.nameBuf = PROFILE.get().name || '';
  m.nameShake = 0;
  m.nameHover = [0, 0];
  openMenuPanel('name');
}
// the buffer as it stands would be accepted: what lights the DONE plank
function nameOk() { return PROFILE.validate(state.menu.nameBuf).ok; }

function nameCommit() {
  const m = state.menu;
  const r = PROFILE.setName(m.nameBuf);
  if (!r.ok) { m.nameShake = NAME_SHAKE_T; SFX.iceKnock(); return; } // rejected: the field says so, and stays open
  applyProfileName();
  SFX.unlock();
  closeMenuPanel();
}
// ESC, or the right-hand plank: a plain cancel that leaves the stored name
// alone. There is no first-launch prompt any more - a fresh profile rolls a
// random name at load (PROFILE, js/profile.js) and this panel only ever
// opens from the name tag or the PLAYER planks, when the player wants it.
function nameDismiss() {
  SFX.pickup();
  closeMenuPanel();
}

// The editor owns the keyboard while it is up (see the keydown handler). A
// character the name may not hold is simply never drawn - that refusal IS the
// validation message, so the only rejections with a sound are a full field and
// a name the filter turns down.
function nameKey(e) {
  const m = state.menu;
  if (m.panelT < 1 || m.closing) return; // still sliding
  if (e.key === 'Enter') { nameCommit(); return; }
  if (e.key === 'Escape') { nameDismiss(); return; }
  if (e.key === 'Backspace') {
    if (m.nameBuf) { m.nameBuf = m.nameBuf.slice(0, -1); SFX.tally(); }
    return;
  }
  const ch = String(e.char != null ? e.char : e.key).toUpperCase(); // what the key TYPED, not where it sits: a Z on AZERTY is a Z
  if (ch.length !== 1) return;
  if (!/^[A-Z0-9]$/.test(ch)) return;
  if (m.nameBuf.length >= PROFILE.NAME_MAX) { m.nameShake = NAME_SHAKE_T; SFX.iceKnock(); return; }
  m.nameBuf += ch;
  SFX.tally();
}

function namePlankRects() {
  const y = SET_Y + NAME_PLANK_Y;
  const x0 = SET_X + Math.round((SET_W - (NAME_BW * 2 + NAME_GAP)) / 2);
  return [{ x: x0, y, w: NAME_BW, h: NAME_BH }, { x: x0 + NAME_BW + NAME_GAP, y, w: NAME_BW, h: NAME_BH }];
}
// which plank is under the pointer, or -1; DONE refuses the hover while the
// buffer would be rejected, so the hand cursor never promises a dead click
function namePanelHit() {
  const r = namePlankRects();
  for (let i = 0; i < 2; i++) {
    if (mouse.x >= r[i].x - 2 && mouse.x < r[i].x + r[i].w + 2 &&
      mouse.y >= r[i].y - 3 && mouse.y < r[i].y + r[i].h + 3) return i === 0 && !nameOk() ? -1 : i;
  }
  return -1;
}
function namePanelClick() {
  const h = namePanelHit();
  if (h === 0) { state.menu.pressT = 0.12; nameCommit(); }
  else if (h === 1) { state.menu.pressT = 0.12; nameDismiss(); }
}

function renderNamePanel(now, slide) {
  const m = state.menu;
  const px = SET_X, py = SET_Y + slide;
  ctx.drawImage(namePanelCv, px, py);

  // ---- the field -------------------------------------------------------
  const f = NAME_FIELD;
  const bad = m.nameShake / NAME_SHAKE_T;
  const shake = bad > 0 ? Math.round(Math.sin(now * 90) * 2.5 * bad) : 0;
  if (bad > 0) { // the refusal floods the well red rather than printing a reason
    ctx.globalAlpha = 0.5 * bad;
    ctx.fillStyle = '#a83a3a'; ctx.fillRect(px + f.x, py + f.y, f.w, f.h);
    ctx.globalAlpha = 1;
  }
  // an empty buffer shows the default, greyed: what SKIP would give you
  const empty = !m.nameBuf;
  const txt = empty ? PROFILE.DEFAULT_NAME : m.nameBuf;
  const tw = pixelTextWidth(txt, 2);
  const tx = px + f.x + Math.round((f.w - tw - 5) / 2) + shake;
  const ty = py + f.y + 6;
  drawPixelTextShadow(ctx, txt, tx, ty, empty ? '#4a5480' : bad > 0 ? '#ffb0a0' : '#f4f7ff', '#0a0e23', 2);
  if (Math.floor(now * 2) % 2 === 0) { // caret: after the buffer, or before the ghost default
    ctx.fillStyle = '#ffd95c';
    ctx.fillRect(empty ? tx - 5 : tx + tw + 2, ty, 2, 10);
  }
  // capacity: one tick per allowed character, lit as far as the buffer reaches
  const tks = PROFILE.NAME_MAX;
  const kw = tks * 4 - 1;
  let kx = px + Math.round((SET_W - kw) / 2);
  for (let i = 0; i < tks; i++) {
    ctx.fillStyle = i < m.nameBuf.length ? '#f2cc6a' : '#2c3a68';
    ctx.fillRect(kx, py + NAME_TICK_Y, 3, 2);
    kx += 4;
  }

  // ---- the lifetime numbers --------------------------------------------
  // WINS / GOLD EARNED / DAYS PLAYED - not matches started, not a best day
  const st = PROFILE.stats();
  const grand = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, ','); // 12345 -> 12,345
  const rows = [[NAME_CROWN_ICON, 'WINS', grand(st.wins), '#cfe0ff'],
    [null, 'GOLD EARNED', grand(st.gold), '#f2cc6a'],
    [NAME_SUN_ICON, 'DAYS PLAYED', grand(st.days), '#cfe0ff']];
  for (let i = 0; i < rows.length; i++) {
    const ry = py + NAME_STAT_Y + i * NAME_STAT_P;
    const lx = px + NAME_FIELD.x;
    if (rows[i][0]) stampGrid(rows[i][0], NAME_ICON_PAL, lx, ry + 1, 1);
    else ctx.drawImage(SPRITES.itemGold, lx, ry + 1);
    drawPixelTextShadow(ctx, rows[i][1], lx + 13, ry + 3, '#7a8bb8', 'rgba(8,12,28,0.9)');
    const nx = px + SET_W - NAME_FIELD.x - pixelTextWidth(rows[i][2], 2);
    drawPixelTextShadow(ctx, rows[i][2], nx, ry, rows[i][3], '#0a0e23', 2);
    ctx.fillStyle = '#2c3a68'; // the leader: dots from the label to its number
    for (let dx = lx + 13 + pixelTextWidth(rows[i][1]) + 6; dx < nx - 6; dx += 4) {
      ctx.fillRect(dx, ry + 7, 2, 1);
    }
  }

  // ---- the two planks ---------------------------------------------------
  const r = namePlankRects();
  const ok = nameOk();
  const pressed = m.pressT > 0;
  ctx.globalAlpha = ok ? 1 : 0.4; // a name that would be refused dims its own way out
  drawMenuButton({ x: r[0].x, y: r[0].y + slide, w: r[0].w, h: r[0].h }, 'DONE',
    ok ? m.nameHover[0] : 0, now, ok && pressed && m.nameHover[0] > 0.5);
  ctx.globalAlpha = 1;
  drawMenuButton({ x: r[1].x, y: r[1].y + slide, w: r[1].w, h: r[1].h },
    'CANCEL', m.nameHover[1], now, pressed && m.nameHover[1] > 0.5);
}

// The name bottom-left of the title screen, mirroring the patch tag on the
// right: the name plus a quill that gilds on hover. Clicking either opens the
// panel - the quill IS the edit affordance, so there is nothing to caption.
function nameTagRect() {
  return { x: 5, y: VIEW_H - 9, w: pixelTextWidth(PROFILE.name()) + 4 + 6, h: 6 };
}
function overNameTag() {
  const r = nameTagRect();
  return mouse.x >= r.x - 3 && mouse.x < r.x + r.w + 3 && mouse.y >= r.y - 3 && mouse.y < r.y + r.h + 3;
}
function drawNameTag() {
  const hot = !state.menu.panel && overNameTag();
  const r = nameTagRect();
  const nm = PROFILE.name();
  drawPixelTextShadow(ctx, nm, r.x, r.y, hot ? '#ffd95c' : '#9fb6d8', 'rgba(15,22,50,0.9)');
  stampGrid(NAME_QUILL, hot ? NAME_QUILL_HOT : NAME_QUILL_PAL, r.x + pixelTextWidth(nm) + 4, r.y, 1);
  if (hot) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(r.x, r.y + 7, r.w, 1); }
}

