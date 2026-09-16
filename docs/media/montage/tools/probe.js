// Stage a scene and take a still, without recording: the fast loop for
// getting a shot framed before it costs a clip's worth of wall time.
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./cdp');

const SHOTS = path.join(__dirname, 'shots');

async function shot(cdp, name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync(SHOTS, { recursive: true });
  const f = path.join(SHOTS, name + '.png');
  fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
  return f;
}

async function run(jobs) {
  const { cdp, proc } = await launch({ url: 'http://localhost:8471/index.html?seed=' + (process.env.SEED || 42) });
  const errs = [];
  cdp.on('Runtime.exceptionThrown', (p) => errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || '')));
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(__dirname, 'tap.js'), 'utf8') });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.reload');
  await sleep(3000);
  await cdp.eval(fs.readFileSync(path.join(__dirname, 'lib.js'), 'utf8'));
  await cdp.eval(`(function(){
    settings.mobile='off'; settings.scheme='wasd';
    SFX.unlock(); SFX.setMusicVolume(0); SFX.music.stop(0); settings.musicVol=0;
    try { if (!PROFILE.hasChar()) { beginCreate(); createCommit(); } } catch(e){}
    try { PROFILE.markDropped(); } catch(e){}
  })()`);
  await cdp.eval('__M.toPlay()');

  for (const job of jobs) {
    try {
      await cdp.eval('__M.step=null; __M.cam=null; __M.err=null;');
      const info = await cdp.eval(job.stage, { timeout: 60000 });
      if (job.roll) await cdp.eval(job.roll);
      await sleep(job.wait == null ? 900 : job.wait);
      const f = await shot(cdp, job.name);
      console.log(job.name, '->', (job.full ? String(info) : String(info).slice(0, 220)), '| err=', await cdp.eval('__M.err'));
    } catch (e) {
      console.log(job.name, 'FAILED', e.message);
    }
  }
  if (errs.length) console.log('page errors', errs.slice(0, 6));
  if (!process.env.KEEP) proc.kill();
}

module.exports = { run };
