'use strict';
// renderUI: the frame's UI pass in order - what goes over the world while
// you play, from the minimap to the day headline. Last of the HUD files.
// ------------------------------------------------------------ renderUI
// the day headline's bake: bare outlined text wants a fade, and an outline
// stamped under globalAlpha goes blotchy (the CLAUDE.md text rule), so the
// opaque stamp is baked once per day number and the CANVAS fades
let dayPopCv = null, dayPopDay = 0;
function renderUI(now) {
  if (state.mode === 'title' || state.mode === 'drop' || window.DBG.hideUI) return;
  if (endScreen()) return; // a victory or defeat screen owns the whole frame

  // title -> play: the HUD slides in over the last part of the intro - the
  // minimap from the top, the backpack from the right, the hud strip from
  // below.
  // The TOP LEFT is deliberately empty: the berry and fish counts that used
  // to stack there (and the gold that sat left of the minimap) live on the
  // hud strip's meal buttons and the purse tab over them now, which is why
  // nothing slides in from the left any more. Health lives on the in-world
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
  // intro slide down from above like the minimap, at the HUD SIZE the dial
  // holds, and stays up while you are out - who is up is what a spectator reads
  drawRailScaled(now, slide);

  // THE COUNTER WASHES THE FRAME (shopScrim, js/shop.js), and exactly what a
  // trade is made of stays lit above the wash: the counter itself, the corner
  // - the weapon shelf and the pack drawer a sale is dragged out of - the item
  // on the cursor, and the tooltip that prices what the pointer is on (drawn
  // later still, js/render.js). Everything else goes under it, the minimap and
  // the hud strip included: neither is part of a sale, and a counter that only
  // dimmed the world left the two brightest widgets on screen competing with
  // the thing you opened.
  //
  // So the ORDER is the whole mechanism, and it is here rather than in the
  // panel: minimap and strip, the wash, then the corner and the slab.
  const shop = !out && shopOpen();
  // The top-left corner - the weapon shelf and the drawer under it - rides
  // the intro slide in from the LEFT as one widget, at the HUD SIZE the dial
  // holds (drawCornerScaled), by its widest reach so no tool's row is left
  // parked over the cinematic.
  const cornerSlide = -Math.round(slide * CORNER_REACH * hudSc());
  if (!out && !shop) drawCornerScaled(now, cornerSlide);

  // hud strip (the xp bar over the ability wells and the pouch block),
  // bottom-centre; it rides the intro slide up from below, at whatever HUD
  // SIZE the settings dial holds (drawHudScaled). The carried item rides the
  // pointer over everything, so it stays outside the scale and the slide.
  if (!out) drawHudScaled(now, Math.round(slide * HUD_SLIDE));

  // the merchant's counter (js/shop.js): over the HUD like the character
  // sheet, with the pack open beside it to drag a sale out of - and lit,
  // with the corner, out of the wash the two of them stand in
  if (shop) {
    shopScrim();
    drawCornerScaled(now, cornerSlide);
    drawShopPanel(now);
  }

  // whatever is riding the pointer, and the ring promising where a release
  // lands: last of the HUD, so it is over every well it could be dropped into
  // - the counter's sell strip and its wash included
  if (!out && hudIn >= 1) { drawDragGhost(now); drawDropPromise(); }

  // the character panel (G): over the HUD, under the toasts and the tooltip
  if (!out && state.charOpen && !player.dead) drawCharPanel(now);

  // the news plates, top-right under the minimap (the `notices` banner,
  // js/ui/shop.js): the market's three and the roost under attack. Above the
  // counter and the sheet on purpose: a price
  // that moved while you were standing at the shop is exactly the news that
  // must not arrive behind the panel it is about. They stay up while you are
  // down, like the feed - the market does not stop for a death.
  renderNotices();

  // arriving at a camp announces it, top centre: the name big, its
  // personality under it. Fades on the plate, so it uses the shadow font.
  if (state.loc) {
    const L = state.loc.L, t = state.loc.t;
    const a = t < 0.25 ? t / 0.25 : t > 2.8 ? Math.max(0, 1 - (t - 2.8) / 0.7) : 1;
    if (a > 0) {
      const nw = pixelTextWidth(L.name, 2), tw = pixelTextWidth(L.tag);
      const w = Math.max(nw, tw) + 26;
      const bx = Math.round((VIEW_W - w) / 2), by = noteY();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(12,18,42,0.72)';
      ctx.fillRect(bx, by, w, 24);
      ctx.fillStyle = L.spec.mark;
      ctx.fillRect(bx, by, w, 1); ctx.fillRect(bx, by + 23, w, 1);
      drawCampIcon(ctx, L, bx + 10, by + 12, L.spec.mark, '#0a0e23');
      drawPixelTextShadow(ctx, L.name, Math.round((VIEW_W - nw) / 2) + 7, by + 4, '#f4f7ff', '#0a0e23', 2);
      drawPixelTextShadow(ctx, L.tag, Math.round((VIEW_W - tw) / 2) + 7, by + 15, L.spec.mark, '#0a0e23');
      ctx.globalAlpha = 1;
    }
  }

  // a new day announces itself, top centre: DAY N at 2x, bare text, nothing
  // else. It is the survival calendar a strategy is timed against ("push at
  // day 2", "hole up for night 1"), so it headlines instead of riding the
  // bottom message line. Drawn from the bake above so the outline survives
  // the fade; steps under the location plate when both are up.
  if (state.dayPop) {
    const t = state.dayPop.t;
    const a = t < 0.25 ? t / 0.25 : t > 2.8 ? Math.max(0, 1 - (t - 2.8) / 0.7) : 1;
    if (a > 0) {
      if (!dayPopCv || dayPopDay !== state.dayPop.day) {
        const txt = 'DAY ' + state.dayPop.day;
        dayPopCv = document.createElement('canvas');
        dayPopCv.width = pixelTextWidth(txt, 2) + 4;
        dayPopCv.height = 16;
        drawPixelTextOutline(dayPopCv.getContext('2d'), txt, 2, 2, '#f4f7ff', '#0f1632', 2);
        dayPopDay = state.dayPop.day;
      }
      ctx.globalAlpha = a;
      ctx.drawImage(dayPopCv, Math.round((VIEW_W - dayPopCv.width) / 2), noteY() + (state.loc ? 30 : 0));
      ctx.globalAlpha = 1;
    }
  }

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
