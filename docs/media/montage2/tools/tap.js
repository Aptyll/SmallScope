// Document-start: tap the WebAudio graph.
//
// Everything the game synthesises or samples hangs off ONE master gain that
// connects to ctx.destination (js/audio.js); the MUSIC layer is HTMLAudioElement
// and never enters the graph at all. So mirroring every connection into
// ctx.destination onto a MediaStreamDestination captures exactly the SFX bus -
// all of it, none of the music - with no hook in the game itself.
(function () {
  const TAP = { ctx: null, dest: null };
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dst) {
    const out = orig.apply(this, arguments);
    try {
      if (dst && typeof AudioDestinationNode !== 'undefined' && dst instanceof AudioDestinationNode) {
        const c = dst.context;
        if (TAP.ctx !== c) { TAP.ctx = c; TAP.dest = c.createMediaStreamDestination(); }
        orig.call(this, TAP.dest);
      }
    } catch (e) { TAP.err = String(e); }
    return out;
  };
  window.__AUDIOTAP = TAP;
})();
