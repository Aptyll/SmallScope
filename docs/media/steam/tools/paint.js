'use strict';
// The page-side painter. Runs in the game's own page (a canvas is a canvas),
// and knows nothing about the game: a captured frame goes in, a finished
// capsule comes out.
//
// THE FRAME IS NEVER RESAMPLED. Every background was captured at the exact
// pixel size of the capsule it is for, so the art is drawn 1:1 and the only
// thing scaled is the wordmark - which is a painted picture, not a grid.
module.exports = `
(function(){
  window.PAINT = function(job){
    return (async function(){
      var load = function(url){ return new Promise(function(res, rej){
        var im = new Image(); im.onload = function(){ res(im); }; im.onerror = rej; im.src = url; }); };
      var bg = job.bg ? await load(job.bg) : null;   // a bare job (the library logo) has none
      var logo = job.logo ? await load(job.logo) : null;
      var W = job.out[0], H = job.out[1];
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');

      // ---- the frame, 1:1, with the band the capsule wants cut out of it
      if (bg) {
        var sx = Math.round((bg.width - W) / 2);
        var sy = Math.round((bg.height - H) * (job.anchor == null ? 0.5 : job.anchor));
        g.imageSmoothingEnabled = false;
        g.drawImage(bg, sx, sy, W, H, 0, 0, W, H);
      }

      // ---- a cold grade over the art: the store page is dark, and a capsule
      // that carries some of that dark reads as part of it rather than a
      // window cut in it
      if (job.grade) {
        g.globalCompositeOperation = 'multiply';
        g.globalAlpha = job.grade;
        g.fillStyle = '#8ea6d8';
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }

      // ---- vignette: an edge that closes in, the same move the game's own
      // night grade makes, so the eye lands in the middle
      if (job.vig) {
        var r = Math.hypot(W, H) / 2;
        var vg = g.createRadialGradient(W / 2, H / 2, r * 0.42, W / 2, H / 2, r);
        vg.addColorStop(0, 'rgba(8,13,32,0)');
        vg.addColorStop(1, 'rgba(8,13,32,' + job.vig + ')');
        g.fillStyle = vg; g.fillRect(0, 0, W, H);
      }

      // ---- the scrim the word sits on
      if (job.scrim) {
        var s = job.scrim;
        g.save();
        g.translate(s.cx * W, s.cy * H);
        g.scale(s.rx * W, s.ry * H);
        var sg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        sg.addColorStop(0, 'rgba(7,12,30,' + s.a + ')');
        sg.addColorStop(0.55, 'rgba(7,12,30,' + (s.a * 0.72).toFixed(3) + ')');
        sg.addColorStop(1, 'rgba(7,12,30,0)');
        g.fillStyle = sg; g.fillRect(-1, -1, 2, 2);
        g.restore();
      }
      // ...and a band across the foot, where a store page likes some weight
      if (job.foot) {
        var fg = g.createLinearGradient(0, H * (1 - job.foot.h), 0, H);
        fg.addColorStop(0, 'rgba(7,12,30,0)');
        fg.addColorStop(1, 'rgba(7,12,30,' + job.foot.a + ')');
        g.fillStyle = fg; g.fillRect(0, H * (1 - job.foot.h), W, H * job.foot.h);
      }

      // ---- the word: a dark bed, the title's own cyan halo, then the letters
      if (logo) {
        var lw = Math.round(job.logo_w * W), lh = Math.round(lw * logo.height / logo.width);
        var lx = Math.round(job.logo_cx * W - lw / 2), ly = Math.round(job.logo_cy * H - lh / 2);
        // the letters alone, at size, on their own sheet - everything below
        // is a filtered copy of this
        var ls = document.createElement('canvas'); ls.width = lw; ls.height = lh;
        var lg = ls.getContext('2d');
        lg.imageSmoothingEnabled = true; lg.imageSmoothingQuality = 'high';
        lg.drawImage(logo, 0, 0, lw, lh);
        // a tinted silhouette, for both the bed and the halo
        var tint = function(col){
          var t = document.createElement('canvas'); t.width = lw; t.height = lh;
          var tg = t.getContext('2d');
          tg.drawImage(ls, 0, 0);
          tg.globalCompositeOperation = 'source-in';
          tg.fillStyle = col; tg.fillRect(0, 0, lw, lh);
          return t;
        };
        var bed = tint('#060a1c'), halo = tint('#7fd8ff');
        var pad = Math.round(lh * 0.5);
        g.save();
        // the bed first: a soft dark spread, so the word holds on white snow
        g.filter = 'blur(' + Math.max(2, Math.round(lh * 0.10)) + 'px)';
        g.globalAlpha = 0.5 * (job.bed == null ? 1 : job.bed);
        if (g.globalAlpha > 0) for (var i = 0; i < 3; i++) g.drawImage(bed, lx, ly, lw, lh);
        // then the halo, added rather than laid over - the title screen's own
        // cold glow behind the letters (renderTitle, js/ui/menu.js)
        g.globalCompositeOperation = 'lighter';
        var hk = job.halo == null ? 1 : job.halo;
        g.filter = 'blur(' + Math.round(lh * 0.18 * hk) + 'px)';
        g.globalAlpha = 0.45; g.drawImage(halo, lx, ly, lw, lh);
        g.filter = 'blur(' + Math.round(lh * 0.42 * hk) + 'px)';
        g.globalAlpha = 0.30; g.drawImage(halo, lx, ly, lw, lh);
        g.restore();
        g.drawImage(ls, lx, ly);
      }

      return cv.toDataURL('image/png').slice(22);
    })();
  };
  return 'ok';
})()`;
