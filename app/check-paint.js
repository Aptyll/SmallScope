// The paint check: every letter of every hero's art has a colour. A letter its palette
// lacks bakes as a hole (the ground shows through), which no other check sees. It opens
// the game from index.html in headless Chromium (Playwright, which the repo does not
// install: `PLAYWRIGHT=<path to the package>` points at one), bakes each hero's every look
// for both teams with its roll, and every held blade and staff, and lists any letter
// SPR.bake met with no colour (SPR.takeUnpainted, js/sprites/core.js).
//   node app/check-paint.js        exit 1 on any hole
const path = require('path');

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { } }
  console.error('check-paint: no Playwright (npm i -g playwright, or PLAYWRIGHT=<its folder>)'); process.exit(2);
}

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.SPR && window.SPRITES && SPRITES.champLook, null, { timeout: 30000 });
  const holes = await page.evaluate(() => {
    const out = [];
    const take = (what) => { for (const [c, n] of SPR.takeUnpainted()) out.push(`${what}: letter '${c}' has no colour (${n} px)`); };
    SPR.takeUnpainted(); // the bakes at load are not all heroes': a menu or map bake may draw one layer of a grid on purpose
    const faces = ['down', 'up', 'right', 'left'];
    CLASSES.forEach((k, cls) => {
      const art = heroArtOf(cls);
      if (!art) return;
      for (const row of art.looks) for (const team of [0, 1]) {
        const set = SPRITES.champLook(cls, team, row.id);
        if (set.roll) for (const f of faces) void set.roll[f];
        take(`${k.id} ${row.id} team ${team}`);
      }
    });
    const held = { HERO_BLADES, HERO_STAVES };
    for (const [name, table] of Object.entries(held)) for (const [id, h] of Object.entries(table)) {
      if (h.art) h.art();
      take(`${name}.${id}`);
    }
    return out;
  });
  await browser.close();
  for (const e of errors) console.log('page error: ' + e);
  if (holes.length || errors.length) { for (const h of holes) console.log(h); console.log(`paint: ${holes.length} holes`); process.exit(1); }
  console.log('paint ok: every hero look on both teams and every held blade and staff');
})();
