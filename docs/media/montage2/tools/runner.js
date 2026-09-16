// The montage harness: launch Chrome on the dev server, boot the game into a
// match, run each scene in real time while a MediaRecorder takes the canvas and
// the tapped SFX bus, and drop each clip out as its own mp4.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { launch, sleep } = require('./cdp');

const OUT = process.env.MONTAGE_OUT || path.join(__dirname, '..'); // docs/media/montage
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

// webm -> mp4. Vertical 9:16 is already what the canvas is, so there is no
// scaling to do; yuv420p and +faststart are what makes the file play
// everywhere, and the audio rides across as AAC untouched in level.
function toMp4(webm, mp4, gainDb) {
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', webm,
    ...(gainDb ? ['-af', 'volume=' + gainDb.toFixed(2) + 'dB'] : []),
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
  return { sec: +(+d.format.duration).toFixed(2), w: v.width, h: v.height, audio: !!a };
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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.reload');
  await sleep(3000);

  await cdp.eval(fs.readFileSync(path.join(__dirname, 'lib.js'), 'utf8'));
  const boot = await cdp.eval(`(function(){
    settings.mobile = 'off';
    settings.scheme = 'wasd';
    SFX.unlock();
    SFX.setVolume(0.4); // ten bodies stack far more cues at once than one does
    SFX.setSfxVolume(1);
    SFX.setMusicVolume(0);
    SFX.music.stop(0);
    settings.musicVol = 0;
    try { if (!PROFILE.hasChar()) { beginCreate(); createCommit(); } } catch (e) {}
    try { PROFILE.markDropped(); } catch (e) {}
    return JSON.stringify({ view: [VIEW_W, VIEW_H], canvas: [canvas.width, canvas.height],
      mimes: __M.mimes(), tap: !!(window.__AUDIOTAP && window.__AUDIOTAP.dest), audio: SFX.debug().state });
  })()`);
  console.log('boot', boot);
  if (!JSON.parse(boot).tap) throw new Error('audio tap never attached');
  console.log('mode', await cdp.eval('__M.toPlay()'));

  const results = [];
  for (const s of scenes) {
    process.stdout.write('  ' + s.name + ' ... ');
    try {
      await cdp.eval('__M.err = null; __M.step = null; __M.cam = null;');
      await cdp.eval(s.stage, { timeout: 60000 });
      await sleep(s.settle == null ? 350 : s.settle);
      await cdp.eval('__M.begin(' + j(s.rec || {}) + ')');
      if (s.roll) await cdp.eval(s.roll);
      await sleep(s.sec * 1000);
      const err = await cdp.eval('__M.err');
      const webm = await pull(cdp, s.name);
      await cdp.eval('__M.step = null; __M.cam = null;');
      const mp4 = path.join(OUT, s.name + '.mp4');
      toMp4(webm, mp4);
      const info = probe(mp4);
      results.push({ name: s.name, ...info, err });
      console.log(info.sec + 's ' + info.w + 'x' + info.h + (info.audio ? ' +audio' : ' NO AUDIO') + (err ? ' HOOK-ERR: ' + err : ''));
    } catch (e) {
      console.log('FAILED: ' + e.message);
      results.push({ name: s.name, error: e.message });
    }
  }

  // Prove the music layer never sounded. It is HTMLAudioElement (js/audio.js)
  // and never enters the WebAudio graph, so the tap could not have carried it
  // even at full volume - this is the belt to that braces.
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
  const webms = results.filter((r) => !r.error).map((r) => path.join(RAW, r.name + '.webm'));
  const g = process.env.GAIN ? { top: null, gain: +process.env.GAIN, forced: true } : sharedGain(webms);
  if (g.forced) console.log('using the set gain from GAIN: ' + g.gain.toFixed(2) + ' dB');
  else if (webms.length < 5) console.log('NOTE: partial run - this gain is over ' + webms.length + ' clip(s) only, pass GAIN=<db> to match the set');
  if (!g.forced) console.log('peak across the set: ' + g.top.toFixed(1) + ' dB -> gain ' + g.gain.toFixed(2) + ' dB');
  if (Math.abs(g.gain) > 0.05) {
    for (const r of results) {
      if (r.error) continue;
      toMp4(path.join(RAW, r.name + '.webm'), path.join(OUT, r.name + '.mp4'), g.gain);
      r.peak = +(peakDb(path.join(OUT, r.name + '.mp4')) || 0).toFixed(1);
    }
  }

  fs.writeFileSync(path.join(OUT, '_report.json'), JSON.stringify({ results, gain: g, pageErrors }, null, 2));
  if (pageErrors.length) console.log('page errors:', pageErrors.slice(0, 8));
  if (!process.env.KEEP) proc.kill();
  return results;
}

module.exports = { main };
