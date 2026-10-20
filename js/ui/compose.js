'use strict';
// renderUI: the frame's UI pass in order - what goes over the world while
// you play, from the minimap to the announcer - and the F3 info stack.
// Last of the HUD files.
// ------------------------------------------------------------ renderUI
function renderUI(now) {
  if (state.mode === 'title' || state.mode === 'drop' || window.DBG.hideUI) return;
  drawNetLink(now); // a client's dropped link, or nothing (the `rooms` banner, menu.js)
  if (endScreen()) return; // a victory or defeat screen owns the whole frame

  // title -> play: the HUD slides in over the last part of the intro - the
  // minimap from the top, the hud strip from
  // below.
  // The TOP LEFT is deliberately empty: the gold that sat left of the
  // minimap lives in the hud strip's purse now, which is why nothing slides
  // in from the left any more. Health lives on the in-world
  // bar.
  const hudIn = hudInT(); // 0 away .. 1 home; a drop brief pins it at 0 for the tour
  const slide = 1 - hudIn;
  const out = state.mode === 'dead'; // the local wallet is moot once you are out

  ctx.save();
  ctx.translate(0, Math.round(-slide * (MM_R * 2 + 40)));
  // minimap with day/night ring
  renderMinimap(now);
  ctx.restore();

  // the team rail, top centre (the `team rail` block above): it rides the
  // intro slide down from above like the minimap, at its own size dial
  // (railSc), and stays up while you are out - who is up is what a spectator reads
  drawRailScaled(now, slide);
  drawVotePanel(); // the surrender vote, under the rail (js/ui/vote.js)

  // THE COUNTER WASHES THE FRAME (shopScrim, js/ui/shop.js), and exactly what a
  // trade is made of stays lit above the wash: the counter itself and the
  // tooltip that prices what the pointer is on (drawn later still,
  // js/render.js). Everything else goes under it, the minimap and
  // the hud strip included: neither is part of a sale, and a counter that only
  // dimmed the world left the two brightest widgets on screen competing with
  // the thing you opened.
  //
  // So the ORDER is the whole mechanism, and it is here rather than in the
  // panel: minimap and strip, the wash, then the slab.
  const shop = !out && shopOpen();
  // the practice bar down the left edge, PRACTICE TOOL only (js/ui/cheats.js)
  if (!out && PRACTICE) drawCheatBar(now);

  // hud strip (the portrait, the ability wells over the bars, the items),
  // bottom-centre; it rides the intro slide up from below, at whatever HUD
  // SIZE the settings dial holds (drawHudScaled).
  if (!out) drawHudScaled(now, Math.round(slide * HUD_SLIDE));

  // the merchant's counter (js/ui/shop.js): over the HUD like the character
  // sheet, and lit out of the wash it stands in
  if (shop) {
    shopScrim();
    drawShopPanel(now);
  }

  // the character panel (G): over the HUD, under the toasts and the tooltip
  if (!out && state.charOpen && !player.dead) drawCharPanel(now);

  // the news plates, top-right under the minimap (js/ui/notices.js): the
  // roost under attack. Above the counter and the sheet on purpose, so the
  // news never arrives behind a panel; they stay up while you are down,
  // like the feed.
  renderNotices();

  // the announcer, top centre under the rail, and the kill feed under the
  // news plates (js/ui/announcer.js): over the panels like the news, and up
  // while you are down - a spectator is exactly who wants the calls
  renderAnnouncer();

  // message
  if (state.msgT > 0 && state.msg) {
    const a = Math.min(1, state.msgT * 2);
    ctx.globalAlpha = a;
    const w = pixelTextWidth(state.msg);
    drawPixelTextOutline(ctx, state.msg, (VIEW_W - w) / 2, VIEW_H - AB_H - 14, '#fff4d8', '#0f1632');
    ctx.globalAlpha = 1;
  }

  if (state.paused) {
    ctx.fillStyle = 'rgba(10,14,35,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const t = 'PAUSED';
    drawPixelTextShadow(ctx, t, (VIEW_W - pixelTextWidth(t, 2)) / 2, VIEW_H / 2 - 5, '#f4f7ff', '#0a0e23', 2);
  }
}

// ------------------------------------------------------------ the info stack
// the info stack (settings.info - the INFO row in the ESC menu, or F3, the
// minecraft reflex): fps, the ms a frame spends stepping and drawing, the
// framed player's tile coordinates, and the run seed as one vertical list on
// the left edge at the top quarter of the view, above every overlay. In title only the fps, sim and
// draw lines show - nobody stands anywhere yet, and the menu prints the seed
// itself with the reroll die.
function drawTags() {
  if (!settings.info) return;
  // two columns: a dim label, then the value on one shared x so the numbers
  // line up down the stack - the same dim-label / bright-value pairing the
  // tooltips use. Red means one thing and one thing only:
  // something is wrong (a bad frame rate, a sample bank that did not load).
  // Nothing else is tinted for decoration.
  const lx = 5, vx = lx + Math.max(pixelTextWidth('SEED'), pixelTextWidth('DRAW')) + 5;
  let y = Math.round(VIEW_H * 0.25);
  const line = (label, value, col) => {
    drawPixelTextOutline(ctx, label, lx, y, '#7a8bb8', '#0f1632');
    drawPixelTextOutline(ctx, value, vx, y, col || '#f4f7ff', '#0f1632');
    y += 10;
  };
  line('FPS', String(perf.fps), perf.fps < 45 ? '#ff9a8a' : '#f4f7ff');
  // where a frame's time goes, in ms: the steps, then the drawing. Red once
  // the two together no longer fit a 60 Hz frame
  const slow = perf.sim + perf.draw > 1000 / 60 ? '#ff9a8a' : '#f4f7ff';
  line('SIM', perf.sim.toFixed(1), slow);
  line('DRAW', perf.draw.toFixed(1), slow);
  // the sampled sound bank: decoded / asked for. Red on anything missing,
  // because an empty bank is silent in exactly the way a mis-wired cue is -
  // every sampled sound falls back to the old synth line and the game sounds
  // untouched. See js/app/audio.js loadBank().
  const bs = SFX.banked();
  line('SFX', bs.got + '/' + bs.want, bs.got < bs.want ? '#ff9a8a' : '#f4f7ff');
  if (state.mode !== 'title') {
    const vp = viewPlayer(); // spectators read the player the camera frames
    line('POS', Math.floor(vp.x / TILE) + ', ' + Math.floor(vp.y / TILE));
    line('SEED', String(SEED));
  }
}
