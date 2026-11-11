// The boot check: a script the page never receives (a dropped request, the web
// build mid-update) must never boot a game that crashes later. It serves the
// game itself (app/server.js on CHECK_PORT) and drives Chromium through
// Playwright (`PLAYWRIGHT=<path to the package>`, else `playwright` as usual).
//   node app/check-boot.js     exit 1 on any failure
// Three pages, each missing js/baked/soldiers.js (the soldiers' sets and
// SPRITES.robotAx, whose absence threw in drawRobot at the first wave):
//   once     the first request fails: the page loads itself again and the
//            first wave draws with no throw
//   always   every request fails: one reload, then the page names the file
//            and never starts the loop
//   none     nothing blocked: the first wave draws, no reload
const path = require('path');
const { spawn } = require('child_process');

const CHECK_PORT = 8478;    // its own port, so a game already served on 8471 is left alone
const MISSED = 'js/baked/soldiers.js';
const WAVE_STEPS = 4800;    // ticks at 60/s: past the first wave's roll-out onto the lanes

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { } }
  console.error('check-boot: no Playwright (npm i -g playwright, or PLAYWRIGHT=<its folder>)'); process.exit(2);
}

async function run(browser, mode) {
  const page = await browser.newPage();
  let asked = 0; // requests for MISSED: one per page load
  const errors = [];
  page.on('pageerror', (e) => { if (!e.message.startsWith('boot stopped')) errors.push(e.message); }); // boot's own stop is the expected one
  await page.route('**/' + MISSED, (r) => (++asked === 1 && mode === 'once') || mode === 'always' ? r.abort() : r.continue());
  await page.goto('http://localhost:' + CHECK_PORT + '/?seed=1');
  await page.waitForFunction(() => window.DBG || document.body.innerText.includes('could not load'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const out = { mode, loads: asked, errors };
  if (mode === 'always') {
    out.ok = asked === 2 && !(await page.evaluate(() => !!window.DBG)) &&
      (await page.evaluate((f) => document.body.innerText.includes(f), MISSED));
    out.ok = out.ok && !errors.length;
  } else {
    const r = await page.evaluate((n) => {
      for (const p of players) DBG.setControl(p.id, 'ai');
      DBG.startGame();
      try { DBG.step(1 / 60, n); return { soldiers: robots.length }; } catch (e) { return { threw: e.message }; }
    }, WAVE_STEPS);
    Object.assign(out, r);
    out.ok = !r.threw && r.soldiers > 0 && !errors.length && asked === (mode === 'once' ? 2 : 1);
  }
  await page.close();
  return out;
}

(async () => {
  const { chromium } = loadPlaywright();
  const server = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env: Object.assign({}, process.env, { PORT: String(CHECK_PORT) }), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1000));
  const browser = await chromium.launch();
  let bad = 0;
  try {
    for (const mode of ['once', 'always', 'none']) {
      const r = await run(browser, mode);
      if (!r.ok) bad++;
      console.log((r.ok ? 'PASS ' : 'FAIL ') + JSON.stringify(r));
    }
  } finally { await browser.close(); server.kill(); }
  process.exit(bad ? 1 : 0);
})();
