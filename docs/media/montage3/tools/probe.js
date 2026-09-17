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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.reload');
  await sleep(3000);
  const LIB = fs.readFileSync(path.join(__dirname, 'lib.js'), 'utf8');
  async function bootPage() {
    await cdp.eval(LIB);
    await cdp.eval(`(function(){
      settings.mobile='off'; settings.scheme='wasd';
      SFX.unlock(); SFX.setMusicVolume(0); SFX.music.stop(0); settings.musicVol=0;
      try { if (!PROFILE.hasChar()) { beginCreate(); createCommit(); } } catch(e){}
      try { const c = PROFILE.char(); if (c && c.name !== 'WREN') { PROFILE.updateChar(PROFILE.activeIndex(), { name: 'WREN', look: c.look }); applyCharacter(); } } catch(e){}
      try { PROFILE.markDropped(); } catch(e){}
    })()`);
  }
  await bootPage();
  // the page boots at the title; a `title` job is filmed there and a play job
  // flies the drop out first (runner.js has the same ladder)
  let at = 'title';
  async function want(mode) {
    if (at === mode) return;
    if (mode === 'play') { await cdp.eval('__M.toPlay()'); at = 'play'; return; }
    await cdp.send('Page.reload'); await sleep(3000); await bootPage(); at = 'title';
  }

  for (const job of jobs) {
    try {
      await want(job.title ? 'title' : 'play');
      // `keep` reads a scene mid-roll without disarming its hooks
      if (!job.keep) await cdp.eval('__M.step=null; __M.cam=null; __M.tstep=null; __M.err=null;');
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
