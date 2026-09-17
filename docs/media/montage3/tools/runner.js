// The montage harness: launch Chrome on the dev server, boot the game into a
// match, run each scene in real time while a MediaRecorder takes the canvas and
// the tapped SFX bus, and drop each clip out as its own mp4.
//
// MONTAGE 3 IS 16:9 - 1920x1080, the shape a Steam page wants. That is not a
// crop of the vertical harness: at a 1080-tall viewport fitCanvas picks 3
// device px per game px and VIEW_W lands on exactly 640x360, which is the
// game's own authored frame, so the canvas IS 1920x1080 and nothing is
// letterboxed or scaled on the way out.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { launch, sleep } = require('./cdp');

const OUT = process.env.MONTAGE_OUT || path.join(__dirname, '..'); // docs/media/montage3
const RAW = path.join(OUT, '_raw');
const SLICE = 6 * 1024 * 1024;

function j(v) { return JSON.stringify(v); }

async function pull(cdp, name) {
  const n = await cdp.eval('__M.end()');
  const parts = [];
  for (let at = 0; at < n; at += SLICE) {
    const b64 = await cdp.eval('__M.slice(' + at + ',' + SLICE + ')');
    parts.push(Buffer.from(b64, 'base64'));
  }
  const buf = Buffer.concat(parts);
  if (buf.length !== n) throw new Error(name + ': pulled ' + buf.length + ' of ' + n);
  fs.mkdirSync(RAW, { recursive: true });
  const webm = path.join(RAW, name + '.webm');
  fs.writeFileSync(webm, buf);
  return webm;
}

// webm -> mp4. 1920x1080 is already what the canvas is, so there is no scaling
// to do; yuv420p and +faststart are what makes the file play everywhere, and
// the audio rides across as AAC untouched in level.
// The video is RE-TIMED by frame index (setpts N/60): every frame the page
// handed over is exactly one sim step (lib.js, the hooks), so index is time.
// The wall-clock stamps MediaRecorder wrote carry every late rAF, and an
// fps conversion off those drops one frame and doubles its neighbour - a
// hitch in the video that was never in the game. -shortest: the recorder's
// last few frames never flush out of the encoder when it stops, so the audio
// runs a few frames past the picture - cut it where the picture ends.
// `skip` is the pre-roll in frames: cut from the picture by index and from
// the sound by the same time, so the two still start on the same step.
// The mark counts steps, and frame index tracks steps to within a frame or
// so: a state the recorder never got (the stall itself, the very first one)
// shifts the index, and a kept pre-roll frame is a camera CUT on frame 0. So
// two more frames go - 33 ms of the shot, never a frame of the pre-roll.
const PRE_ROLL_MS = 600;
const TRIM_MARGIN = 2;
function toMp4(webm, mp4, gainDb, skip) {
  const k = skip == null ? 0 : skip + TRIM_MARGIN;
  const af = ['atrim=start=' + (k / 60).toFixed(4), 'asetpts=PTS-STARTPTS'];
  if (gainDb) af.push('volume=' + gainDb.toFixed(2) + 'dB');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', webm,
    '-af', af.join(','),
    '-vf', 'trim=start_frame=' + k + ',setpts=N/(60*TB)', '-fps_mode', 'cfr', '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-r', '60',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    mp4,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
}

// volumedetect reports on stderr, so this reads the peak out of spawnSync
function peakDb(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8' });
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(r.stderr || '');
  return m ? +m[1] : null;
}

// ONE gain across the whole set, not per clip: a night shot is meant to be
// quieter than a robot war, and normalising each on its own would flatten
// exactly the difference the montage is being cut for. The shared gain only
// moves the loudest peak in the set to TARGET_PEAK.
const TARGET_PEAK = -1.0;
function sharedGain(webms) {
  let top = -99;
  for (const w of webms) { const p = peakDb(w); if (p != null && p > top) top = p; }
  return { top, gain: top > -90 ? TARGET_PEAK - top : 0 };
}

function probe(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-show_entries', 'stream=codec_type,width,height,nb_frames',
    '-of', 'json', file,
  ]).toString();
  const d = JSON.parse(out);
  const v = d.streams.find((s) => s.codec_type === 'video') || {};
  const a = d.streams.find((s) => s.codec_type === 'audio');
  return { sec: +(+d.format.duration).toFixed(2), w: v.width, h: v.height, audio: !!a, frames: +v.nb_frames || null };
}

async function main(scenes) {
  fs.mkdirSync(OUT, { recursive: true });
  const { cdp, proc } = await launch({ url: 'http://localhost:8471/index.html?seed=' + (process.env.SEED || 42) });

  const pageErrors = [];
  cdp.on('Runtime.exceptionThrown', (p) => {
    pageErrors.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || ''));
  });
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') pageErrors.push('console: ' + p.args.map((a) => a.value || a.description).join(' '));
  });

  // the tap has to exist before js/audio.js builds its graph, so it goes in on
  // a fresh document and the page is reloaded onto it
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: fs.readFileSync(path.join(__dirname, 'tap.js'), 'utf8'),
  });
  // 1920x1080: fitCanvas takes 3 device px per game px off a 1080-tall
  // viewport, which lands VIEW_W x VIEW_H on exactly 640x360 - the authored
  // frame - so the canvas IS the output resolution.
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.reload');
  await sleep(3000);

  const LIB = fs.readFileSync(path.join(__dirname, 'lib.js'), 'utf8');
  // Everything a freshly loaded page needs before a scene can stage on it.
  // It runs again after a reload, which is how a title shot filmed after a
  // play shot gets its title screen back (there is no way out of a match).
  async function bootPage() {
    await cdp.eval(LIB);
    const b = await cdp.eval(`(function(){
      settings.mobile = 'off';
      settings.scheme = 'wasd';
      SFX.unlock();
      SFX.setVolume(0.4); // ten bodies stack far more cues at once than one does
      SFX.setSfxVolume(1);
      SFX.setMusicVolume(0);
      SFX.music.stop(0);
      settings.musicVol = 0;
      // the camera operator is a named character, not DEFAULT: the title's
      // name tag and the class screen both read the profile, not the roster
      try { if (!PROFILE.hasChar()) { beginCreate(); createCommit(); } } catch (e) {}
      try {
        const c = PROFILE.char();
        if (c && c.name !== 'WREN') { PROFILE.updateChar(PROFILE.activeIndex(), { name: 'WREN', look: c.look }); applyCharacter(); }
      } catch (e) {}
      try { PROFILE.markDropped(); } catch (e) {}
      return JSON.stringify({ view: [VIEW_W, VIEW_H], canvas: [canvas.width, canvas.height],
        mimes: __M.mimes(), tap: !!(window.__AUDIOTAP && window.__AUDIOTAP.dest), audio: SFX.debug().state });
    })()`);
    if (!JSON.parse(b).tap) throw new Error('audio tap never attached');
    return b;
  }

  console.log('boot', await bootPage());

  // The page boots AT the title, so that is where the run starts. A scene
  // marked `title: true` is filmed there; the first one that is not flies the
  // drop out, and a title scene after that reloads the page to get back.
  let at = 'title';
  async function want(mode) {
    if (at === mode) return;
    if (mode === 'play') { await cdp.eval('__M.toPlay()'); at = 'play'; return; }
    await cdp.send('Page.reload');
    await sleep(3000);
    await bootPage();
    at = 'title';
  }

  const results = [];
  for (const s of scenes) {
    process.stdout.write('  ' + s.name + ' ... ');
    try {
      await want(s.title ? 'title' : 'play');
      await cdp.eval('__M.err = null; __M.step = null; __M.cam = null; __M.tstep = null;');
      await cdp.eval(s.stage, { timeout: 60000 });
      await sleep(s.settle == null ? 350 : s.settle);
      await cdp.eval('__M.begin(' + j(s.rec || {}) + ')');
      await sleep(PRE_ROLL_MS);
      // the mark and the hooks go in ONE evaluation, so no step falls between
      await cdp.eval('__M.mark();' + (s.roll || ''));
      await sleep(s.sec * 1000);
      const err = await cdp.eval('__M.err');
      const webm = await pull(cdp, s.name);
      // frames vs the sim steps the clip spanned vs its wall seconds: the
      // first two agree when no state was skipped, and the steps track the
      // wall clock unless a stall past TICK_MAX threw time away - which is
      // the one thing index timing cannot absorb (the audio would lead)
      const skip = await cdp.eval('__M.markAt()');
      const steps = (await cdp.eval('__M.recSteps()')) - skip;
      await cdp.eval('__M.step = null; __M.cam = null; __M.tstep = null;');
      const mp4 = path.join(OUT, s.name + '.mp4');
      toMp4(webm, mp4, 0, skip);
      const info = probe(mp4);
      // frames the shot spanned that are not in the file: the trim margin is
      // taken on purpose, and the encoder never flushes its last two or three
      // when the recorder stops - more than that is states lost mid-clip
      // (verify.js finds where)
      const short = info.frames != null ? steps - TRIM_MARGIN - info.frames : null;
      results.push({ name: s.name, ...info, steps, skip, short, err });
      console.log(info.sec + 's ' + info.w + 'x' + info.h + ' ' + info.frames + 'f/' + steps + ' steps'
        + (short > 4 ? ' SHORT ' + short + 'f' : '')
        + (info.audio ? ' +audio' : ' NO AUDIO') + (err ? ' HOOK-ERR: ' + err : ''));
    } catch (e) {
      console.log('FAILED: ' + e.message);
      results.push({ name: s.name, error: e.message });
    }
  }

  // Prove the music layer never sounded. It is HTMLAudioElement (js/audio.js)
  // and never enters the WebAudio graph, so the tap could not have carried it
  // even at full volume - this is the belt to that braces.
  // The music layer is `new Audio()` elements that are never put in the
  // DOM, so `elements` (a DOM query) reads 0 whatever is playing - the check
  // that means something is musicVol 0. What makes it certain is structural:
  // js/audio.js never calls createMediaElementSource, so no music element is
  // ever in the WebAudio graph the tap mirrors, at any volume.
  const music = await cdp.eval(`(function(){
    const els = [].slice.call(document.querySelectorAll('audio'));
    return JSON.stringify({ current: SFX.debug().music, musicVol: SFX.getMusicVolume(),
      elements: els.length, playing: els.filter(function(e){ return !e.paused && e.volume > 0; }).length,
      vols: els.map(function(e){ return +e.volume.toFixed(3); }) });
  })()`);
  console.log('music check', music);

  // second pass: one shared gain over the set, applied on the way out of the
  // raw webm so the mp4 is still a single encode
  // A PARTIAL run must reuse the gain the whole set was cut at, or the one clip
  // re-recorded comes back louder than its neighbours: the report carries it,
  // and GAIN=<db> forces it.
  // measured on the first-pass mp4s, not the webms: those still carry the
  // pre-roll, and a loud cue in it is not in the clip
  const cut = results.filter((r) => !r.error).map((r) => path.join(OUT, r.name + '.mp4'));
  const g = process.env.GAIN ? { top: null, gain: +process.env.GAIN, forced: true } : sharedGain(cut);
  if (g.forced) console.log('using the set gain from GAIN: ' + g.gain.toFixed(2) + ' dB');
  else if (cut.length < 5) console.log('NOTE: partial run - this gain is over ' + cut.length + ' clip(s) only, pass GAIN=<db> to match the set');
  if (!g.forced) console.log('peak across the set: ' + g.top.toFixed(1) + ' dB -> gain ' + g.gain.toFixed(2) + ' dB');
  if (Math.abs(g.gain) > 0.05) {
    for (const r of results) {
      if (r.error) continue;
      toMp4(path.join(RAW, r.name + '.webm'), path.join(OUT, r.name + '.mp4'), g.gain, r.skip);
      r.peak = +(peakDb(path.join(OUT, r.name + '.mp4')) || 0).toFixed(1);
    }
  }

  fs.writeFileSync(path.join(OUT, '_report.json'), JSON.stringify({ results, gain: g, pageErrors }, null, 2));
  if (pageErrors.length) console.log('page errors:', pageErrors.slice(0, 8));
  if (!process.env.KEEP) proc.kill();
  return results;
}

module.exports = { main };
