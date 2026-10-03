// Render the game's own sound cues to a WAV, offline, through js/audio.js itself.
//   node app/media/audio.js <cues.json> <out.wav> <seconds>
// cues.json is [[t seconds, cue, arg], ...] (mix.py writes it from a take and its cut).
// The page's AudioContext is swapped for an OfflineAudioContext before the game loads;
// ctx.suspend(t) stops the clock at each cue, the cue plays, the clock resumes.
'use strict';
const fs = require('fs');
const { open, sleep } = require('./browser');
const PRE = 1.0, RATE = 48000;

(async () => {
  const [cueFile, outWav, dur] = process.argv.slice(2);
  if (!cueFile || !outWav || !dur) { console.log('usage: node app/media/audio.js <cues.json> <out.wav> <seconds>'); process.exit(1); }
  const pg = await open({ width: 320, height: 200, audio: true });
  await pg.preload(`window.__OFF = new OfflineAudioContext(2, ${Math.ceil((+dur + PRE) * RATE)}, ${RATE});
    { const C = window.__OFF, run = C.startRendering.bind(C), res = C.resume.bind(C); let on = false;
      C.startRendering = () => { on = true; return run(); };
      C.resume = () => on ? res() : Promise.resolve(); } // the game resumes on boot; an offline clock may not until it runs
    window.AudioContext = window.webkitAudioContext = function () { return window.__OFF; };`);
  await pg.goto(`http://localhost:${process.env.PORT || 8471}/?seed=1`);
  await sleep(1500);
  await pg.eval(() => SFX.unlock());
  await sleep(2500); // the sampled cues decode
  const cues = JSON.parse(fs.readFileSync(cueFile, 'utf8'));
  const ch = await pg.eval(async (ev, PRE) => {
    const C = window.__OFF, q = 128 / C.sampleRate, groups = new Map();
    for (const [t, cue, arg] of ev) { const k = Math.round((PRE + t) / q); if (!groups.has(k)) groups.set(k, []); groups.get(k).push([cue, arg]); }
    for (const [k, list] of groups) C.suspend(k * q).then(() => {
      for (const [cue, arg] of list) { try { if (SFX[cue]) SFX[cue](arg == null ? undefined : arg); } catch (e) { console.log(cue, e.message); } }
      C.resume();
    });
    const buf = await C.startRendering(), out = [];
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)), i16 = new Int16Array(d.length);
      for (let i = 0; i < d.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767)));
      const u8 = new Uint8Array(i16.buffer); let s = '';
      for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
      out.push(btoa(s));
    }
    return out;
  }, cues, PRE);
  const L = Buffer.from(ch[0], 'base64'), Rt = Buffer.from(ch[1], 'base64');
  const skip = PRE * RATE * 2, n = (L.length - skip) / 2, data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { L.copy(data, i * 4, skip + i * 2, skip + i * 2 + 2); Rt.copy(data, i * 4 + 2, skip + i * 2, skip + i * 2 + 2); }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(outWav, Buffer.concat([h, data]));
  console.log('wav', (n / RATE).toFixed(2) + 's', cues.length, 'cues');
  await pg.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
