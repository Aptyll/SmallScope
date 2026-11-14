'use strict';
// The two screens at a match's end: the victory and the defeat, one
// composition drawn twice (the death overlay, spectating and LOBBY's words
// are js/ui/screens.js, loaded just before this).

// ------------------------------------------------------------ victory
// League's end board, short: the headline over the match, frozen and dimmed
// underneath, and your side as a table - a row a player, its K/D/A, its
// damage to rival heroes drawn as a BAR against the side's best (who carried
// reads before any number does), its soldiers and its gold. A 1V1's table is
// the duel: your row over your rival's. Your row is
// outlined in the ending's accent. state.deadTimer - already ticking for the
// death overlay - is the clock, and WIN_T names every beat, so the render
// pass and the sound cues read one timeline and cannot drift apart. Any press
// before the last beat skips to it (endSkip).
const WIN_T = {
  flash: 0.30,   // the white bloom off the winning frame
  dim: 0.50,     // the dim over the match has finished settling
  title: 0.30, letter: 0.06, land: 0.26, // VICTORY drops in a letter at a time
  rule: 0.95,    // a 1V1's ending fades in under the headline (drawEndWhy)
  stats: 1.05, statStep: 0.12, roll: 0.5, // the table, a row a beat, its bar and numbers climbing
  menu: 2.30,    // LOBBY is up and the screen is live
};
const WIN_SLIDE = 0.32; // LOBBY's slide, finishing exactly on WIN_T.menu
const END_TABLE_W = 460; // px the table spans, the view allowing
const END_ROW = 26;      // px a row
const END_FACE = 22;     // px the face square at a row's head

// a 1V1's ending under the headline, 2x, fading in at f 0..1: FIRST STRIKE,
// 100 SOLDIERS or FIRST TOWER (onevoneWhy, js/sim/onevone.js); nothing in any other match
function drawEndWhy(L, f, col, ink) {
  const why = onevoneWhy();
  if (!why || f <= 0) return;
  ctx.globalAlpha = Math.min(1, f);
  drawPixelTextOutline(ctx, why, Math.round(L.cx - pixelTextWidth(why, 2) / 2), L.ruleY + 6, col, ink, 2);
  ctx.globalAlpha = 1;
}

// the composition, in the 270-tall frame everything else is authored in
function winLayout() {
  const toy = frameTop();
  const cx = Math.round(VIEW_W / 2);
  const w = Math.min(END_TABLE_W, VIEW_W - 24);
  return {
    toy, cx, w, x: cx - (w >> 1),
    titleY: toy + 16,   // VICTORY / DEFEAT, 4x - 20px tall
    ruleY: toy + 34,    // the band under it a 1V1's ending sits in
    headY: toy + 54,    // the table's column glyphs
    rowY: toy + 72,     // its first row
    storyY: toy + 206,  // the three story lines (js/ui/story.js), 1x, under the table
    plankY: toy + 238,  // LOBBY
  };
}

// The table's columns, right to left from the table's edge: gold, soldiers,
// then the damage bar taking what the K/D/A leaves. kda2 is whether the K/D/A
// prints at 2x: a narrow view drops it to 1x before the bar gets too short.
function endColumns(L, ws) {
  const kdaW = (s) => Math.max.apply(null, ws.roster.map((m) => pixelTextWidth(endKda(m), s)));
  const gold = L.x + L.w, farm = gold - 52, barR = farm - 44;
  const nameR = L.x + END_FACE + 6 + 64;
  let kda2 = true, kdaR = nameR + 8 + kdaW(2);
  if (barR - kdaR - 10 < 60) { kda2 = false; kdaR = nameR + 8 + kdaW(1); }
  return { kdaR, kda2, barX: kdaR + 10, barW: Math.max(20, barR - kdaR - 10), farm, gold };
}
function endKda(m) { return m.kills + ' / ' + m.deaths + ' / ' + m.assists; }

// The stat glyphs with no sprite of their own (the coin is SPRITES.itemGold):
// a blade for damage to heroes, a helmet for soldiers' last hits, a clock
// face for the match time. 'g' is the accent, 'o' the cold line, 's' steel.
const WIN_ICONS = {
  dmg: [
    '......oo', '.....oo.', '....oo..', '...oo...',
    'g.oo....', '.gg.....', '.gg.....', 'g..g....',
  ],
  farm: [
    '..ssss..', '.soooos.', 'soooooos', 'ssssssss',
    '..s..s..', '..s..s..', '.ss..ss.', '........',
  ],
  time: [
    '..oooo..', '.o....o.', 'o..h...o', 'o..h...o',
    'o..hhh.o', 'o......o', '.o....o.', '..oooo..',
  ],
};
const WIN_ICON_PAL = { '.': null, g: '#f2cc6a', o: '#cfe0ff', h: '#ffd95c', s: '#a3a8b0' };
const DEF_ICON_PAL = { '.': null, g: '#9fbde0', o: '#8fa8d8', h: '#cfe4f2', s: '#7d8590' };
// the accent each ending is struck in: your row's outline and bar, the
// headline, the 1V1 line and the story's words, and the glyphs' palette
const WIN_ACCENT = { rule: '#c89a3c', txt: '#f2cc6a', icon: WIN_ICON_PAL };
const DEF_ACCENT = { rule: '#4a5f96', txt: '#9fbde0', icon: DEF_ICON_PAL };

function endIcon(k, x, y, ac) {
  if (k === 'gold') ctx.drawImage(SPRITES.itemGold, x, y, 16, 16);
  else stampGrid(WIN_ICONS[k], ac.icon, x, y, 2);
}

// A tally's sound track: a row landing knocks, and its climbing numbers blip
// as they go. A skip jumps the clock before update() reads it, so nothing in
// the skipped span plays.
function tallyCues(t0, t1, T, rows) {
  const TICK = 0.055;
  for (let i = 0; i < rows; i++) {
    const s0 = T.stats + i * T.statStep;
    if (t0 < s0 && t1 >= s0) SFX.place();
    const a = Math.max(s0, Math.min(s0 + T.roll, t0));
    const b = Math.max(s0, Math.min(s0 + T.roll, t1));
    if (b > a && Math.floor((b - s0) / TICK) > Math.floor((a - s0) / TICK)) SFX.tally();
  }
}

// ...plus the one cue the tally does not own: the headline landing
function winCues(t0, t1) {
  if (!state.end) return;
  const land = WIN_T.title + (tr('end.victory').length - 1) * WIN_T.letter + WIN_T.land;
  if (t0 < land && t1 >= land) SFX.levelUp();
  tallyCues(t0, t1, WIN_T, state.end.roster.length);
}

// A char grid painted at (x, y) with s-px cells - the shape sprites.js
// authors in, for art only a screen needs and so never earns a baked
// sprite. rim, when given, stamps a one-cell dark border under the whole
// silhouette first, so the piece reads against whatever is behind it.
function stampGrid(rows, pal, x, y, s, rim) {
  for (let pass = rim ? 0 : 1; pass < 2; pass++) {
    if (pass === 0) ctx.fillStyle = rim;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        if (!pal[row[c]]) continue;
        if (pass === 0) {
          ctx.fillRect(x + (c - 1) * s, y + r * s, s * 3, s);
          ctx.fillRect(x + c * s, y + (r - 1) * s, s, s * 3);
        } else {
          ctx.fillStyle = pal[row[c]];
          ctx.fillRect(x + c * s, y + r * s, s, s);
        }
      }
    }
  }
}

// ---- the shared passes -----------------------------------------------------
// The headline, a letter at a time: `drop` px it falls from, `col` once
// landed and `hot` on the frame it lands. ease is how it moves - a win
// springs in (easeOut), a loss drops (an ease in).
function drawEndTitle(L, txt, t, T, drop, col, hot, ease) {
  const S = 4, x0 = Math.round((VIEW_W - pixelTextWidth(txt, S)) / 2);
  for (let i = 0; i < txt.length; i++) {
    const lt = (t - T.title - i * T.letter) / T.land;
    if (lt <= 0) continue;
    const e = ease(Math.min(1, lt));
    ctx.globalAlpha = Math.min(1, lt * 2.5);
    drawPixelTextOutline(ctx, txt[i], x0 + i * 4 * S, L.titleY - Math.round((1 - e) * drop), lt < 1.12 ? hot : col, SC_INK, S);
  }
  ctx.globalAlpha = 1;
}

// The side's table: the clock over the names, a glyph over each number's
// column, then a row a beat, sliding up into place, its bar growing and its
// numbers climbing from zero. A mate's bar is its side's paint; yours is the
// accent, and your row is outlined in it.
function drawEndTable(L, ws, t, T, ac) {
  const C = endColumns(L, ws), rs = ws.roster;
  const best = Math.max(1, ...rs.map((m) => m.dmg));
  const head = Math.min(1, Math.max(0, (t - T.stats + 0.2) / 0.3));
  if (head > 0) {
    ctx.globalAlpha = head;
    endIcon('time', L.x, L.headY, ac);
    drawPixelTextOutline(ctx, clockTxt(ws.time), L.x + 20, L.headY + 3, SC_TXT, SC_INK, 2);
    endIcon('dmg', C.barX, L.headY, ac);
    endIcon('farm', C.farm - 16, L.headY, ac);
    endIcon('gold', C.gold - 16, L.headY, ac);
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < rs.length; i++) {
    const s0 = T.stats + i * T.statStep;
    if (t < s0) break;
    const m = rs[i], you = i === 0;
    const pop = easeOut(Math.min(1, (t - s0) / 0.24));
    const roll = easeOut(Math.min(1, (t - s0) / T.roll));
    const y = L.rowY + i * END_ROW + Math.round((1 - pop) * 8);
    ctx.globalAlpha = pop;
    if (you) {
      ctx.fillStyle = ac.rule; ctx.fillRect(L.x - 4, y - 2, L.w + 8, END_ROW - 2);
      ctx.fillStyle = SC_PLATE; ctx.fillRect(L.x - 3, y - 1, L.w + 6, END_ROW - 4);
    }
    const body = players.find((q) => q.id === m.id);
    if (body) drawFace(L.x, y, END_FACE, body, 2);
    const hero = CLASSES[m.cls].name, nx = L.x + END_FACE + 6;
    drawPixelTextOutline(ctx, hero, nx, y + 3, you ? ac.txt : endRowHit() === m.id ? '#ffd95c' : SC_LIT, SC_INK, 1); // gold under the hand: a press opens their profile
    if (m.name !== hero) drawPixelTextOutline(ctx, m.name, nx, y + 12, SC_DIM, SC_INK, 1);
    const kda = endKda(m), ks = C.kda2 ? 2 : 1;
    drawPixelTextOutline(ctx, kda, C.kdaR - pixelTextWidth(kda, ks), y + (C.kda2 ? 6 : 8), SC_LIT, SC_INK, ks);
    // the damage bar against the side's best, and the number under it
    ctx.fillStyle = SC_EDGE; ctx.fillRect(C.barX, y + 6, C.barW, 6);
    ctx.fillStyle = you ? ac.txt : TEAMS[skin(m.team)].mark;
    ctx.fillRect(C.barX, y + 6, Math.max(1, Math.round(C.barW * (m.dmg / best) * roll)), 6);
    drawPixelTextOutline(ctx, scoreFmt(m.dmg * roll), C.barX, y + 15, SC_DIM, SC_INK, 1);
    const farm = scoreFmt(m.farm * roll), gold = scoreFmt(m.gold * roll);
    drawPixelTextOutline(ctx, farm, C.farm - pixelTextWidth(farm, 2), y + 6, SC_TXT, SC_INK, 2);
    drawPixelTextOutline(ctx, gold, C.gold - pixelTextWidth(gold, 2), y + 6, SC_TXT, SC_INK, 2);
  }
  ctx.globalAlpha = 1;
}

// the seat whose row is under the pointer once the table is all in, when this
// screen holds their profile (yours, or a person's card: seatPid, js/ui/profile.js); -1 none
function endRowHit() {
  const ws = state.end;
  if (!ws || !endScreen() || state.deadView === 'scores' || state.deadView === 'spec') return -1;
  const T = state.over === 'won' ? WIN_T : DEF_T, t = state.over === 'won' ? state.deadTimer : state.defeatT;
  if (t < T.stats + ws.roster.length * T.statStep) return -1;
  const L = winLayout();
  for (let i = 0; i < ws.roster.length; i++) {
    const y = L.rowY + i * END_ROW;
    if (mouse.x >= L.x - 4 && mouse.x < L.x + L.w + 4 && mouse.y >= y - 2 && mouse.y < y + END_ROW - 4) return seatPid(ws.roster[i].id) ? ws.roster[i].id : -1;
  }
  return -1;
}
// the rest both endings share: the 1V1 line, the table, the story under it,
// and LOBBY sliding up to land exactly on T.menu
function drawEndBody(L, ws, t, T, ac, now) {
  drawEndWhy(L, (t - T.rule) / 0.4, ac.txt, SC_INK);
  drawEndTable(L, ws, t, T, ac);
  drawStoryLines(ws, t, L.storyY, T, ac); // the match story (js/ui/story.js)
  if (t > T.menu - WIN_SLIDE) {
    const e = easeOut(Math.min(1, (t - (T.menu - WIN_SLIDE)) / WIN_SLIDE));
    ctx.globalAlpha = e;
    drawEndPlanks(now, Math.round((1 - e) * 16));
    ctx.globalAlpha = 1;
  }
}

function renderVictory(now) {
  const ws = state.end || (state.end = endSnapshot());
  const t = state.deadTimer;
  const L = winLayout();
  // the match, frozen and dimmed under it all
  ctx.fillStyle = 'rgba(7,8,10,' + (0.86 * Math.min(1, t / WIN_T.dim)).toFixed(3) + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (t < WIN_T.flash) { // the white bloom off the last frame of the match
    ctx.globalAlpha = 1 - t / WIN_T.flash;
    ctx.fillStyle = '#f4f7ff'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
  drawEndTitle(L, tr('end.victory'), t, WIN_T, 40, SC_GOLD, '#ffffff', easeOut);
  drawEndBody(L, ws, t, WIN_T, WIN_ACCENT, now);
}

// ------------------------------------------------------------ defeat
// The same board in frost. A death only DIMS the screen - the match plays on
// underneath and you can sit and watch it - so a lost match does not end
// until you stop watching, which is why LOBBY on an elimination lands here
// (deadActivate) and this screen's own LOBBY is the door out. It is drawn on
// winLayout()'s anchors deliberately, so the two read as one pair: a colder
// dim, DEFEAT falling rather than springing in, frost where the win is gold.
// state.defeatT is the clock: state.deadTimer has been running since the
// body fell, which may have been minutes ago.
const DEF_T = {
  dim: 0.45,      // the cold dim has finished settling
  title: 0.18, letter: 0.06, land: 0.34, // DEFEAT falls in a letter at a time
  rule: 0.80,     // a 1V1's ending fades in under the headline (drawEndWhy)
  stats: 0.95, statStep: 0.12, roll: 0.5, // the table, a row a beat
  menu: 2.20,     // LOBBY is up and the screen is live
};

function defCues(t0, t1) {
  if (!state.end) return;
  tallyCues(t0, t1, DEF_T, state.end.roster.length);
}

function renderDefeat(now) {
  const ws = state.end || (state.end = endSnapshot());
  const t = state.defeatT;
  const L = winLayout();
  // the dim deepens from where the loss's beat left it (renderDead, js/ui/screens.js), never from clear
  ctx.fillStyle = 'rgba(5,8,20,' + Math.max(Math.min(0.75, state.deadTimer * 0.6), 0.9 * Math.min(1, t / DEF_T.dim)).toFixed(3) + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawEndTitle(L, tr('end.defeat'), t, DEF_T, 12, '#9fbde0', '#e8f2ff', (e) => e * e);
  drawEndBody(L, ws, t, DEF_T, DEF_ACCENT, now);
}
