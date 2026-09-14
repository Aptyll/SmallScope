// Packages the wrapper as a portable Windows build: the game's files copied
// in beside main.js (Electron packages this folder as the app, and the game
// lives one level up), @electron/packager run over it, and the result zipped.
//   node build.js            -> dist/Softfall-win64.zip
// This is what the release workflow runs on a version tag
// (.github/workflows/desktop.yml); it works the same by hand.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = __dirname, ROOT = path.join(HERE, '..');
const APP = path.join(HERE, 'app');   // the game's files, copied for the package
const DIST = path.join(HERE, 'dist');
const NAME = 'Softfall';

// the game: the page, the code, the audio. Nothing from docs/, app/ or the wrapper's own node_modules
fs.rmSync(APP, { recursive: true, force: true });
fs.mkdirSync(APP, { recursive: true });
for (const f of ['index.html', 'LICENSE']) fs.copyFileSync(path.join(ROOT, f), path.join(APP, f));
for (const d of ['js', 'audio']) fs.cpSync(path.join(ROOT, d), path.join(APP, d), { recursive: true });

// main.js loads app/index.html when it is there, ../index.html when run from the repo
fs.rmSync(DIST, { recursive: true, force: true });
(async () => {
  const { packager } = require('@electron/packager');
  const [out] = await packager({
    dir: HERE, out: DIST, name: NAME, platform: 'win32', arch: 'x64', overwrite: true, asar: false,
    ignore: [/[\\/]dist([\\/]|$)/, /[\\/]build\.js$/, /[\\/]package-lock\.json$/],
    executableName: NAME,
  });
  // Steam's runtime reads the App ID from a file beside the exe
  fs.writeFileSync(path.join(out, 'steam_appid.txt'), fs.existsSync(path.join(HERE, 'steam_appid.txt')) ? fs.readFileSync(path.join(HERE, 'steam_appid.txt')) : '480');
  const zip = path.join(DIST, NAME + '-win64.zip');
  if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path "${out}\\*" -DestinationPath "${zip}" -Force`], { stdio: 'inherit' });
  else execFileSync('zip', ['-qr', zip, path.basename(out)], { cwd: DIST, stdio: 'inherit' });
  console.log('built ' + zip + ' (' + Math.round(fs.statSync(zip).size / 1048576) + ' MB)');
})().catch((e) => { console.error(e); process.exit(1); });
