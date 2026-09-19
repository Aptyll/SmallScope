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

// the game: the page, the code, the music. Nothing from docs/, app/ or the wrapper's own
// node_modules, and of audio/ only the streamed tracks - the sample clips are baked into
// js/sfxdata.js already, and audio/new_sfx_to_use holds clips the game does not play yet
fs.rmSync(APP, { recursive: true, force: true });
fs.mkdirSync(path.join(APP, 'audio'), { recursive: true });
for (const f of ['index.html', 'LICENSE']) fs.copyFileSync(path.join(ROOT, f), path.join(APP, f));
fs.cpSync(path.join(ROOT, 'js'), path.join(APP, 'js'), { recursive: true });
fs.cpSync(path.join(ROOT, 'audio', 'music'), path.join(APP, 'audio', 'music'), { recursive: true, filter: (src) => fs.statSync(src).isDirectory() || /\.mp3$/i.test(src) });

// main.js loads app/index.html when it is there, ../index.html when run from the repo
fs.rmSync(DIST, { recursive: true, force: true });
(async () => {
  const { packager } = require('@electron/packager');
  const [out] = await packager({
    dir: HERE, out: DIST, name: NAME, platform: 'win32', arch: 'x64', overwrite: true, asar: false,
    // anchored to this folder's own dist/: node_modules/steamworks.js/dist holds the native module and steam_api64.dll.
    // app.* catches a stale copy of the game parked beside app/ (app.stale-3.47 once shipped 46 MB);
    // the type packages are editor-only
    ignore: [/^[\\/]dist([\\/]|$)/, /^[\\/]app\.[^\\/]+/, /^[\\/]build\.js$/, /^[\\/]package-lock\.json$/,
      /^[\\/]node_modules[\\/](@types|undici-types)([\\/]|$)/],
    executableName: NAME,
  });
  // Steam's runtime reads the App ID from a file beside the exe
  fs.writeFileSync(path.join(out, 'steam_appid.txt'), fs.existsSync(path.join(HERE, 'steam_appid.txt')) ? fs.readFileSync(path.join(HERE, 'steam_appid.txt')) : '480');
  const zip = path.join(DIST, NAME + '-win64.zip');
  if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path "${out}\\*" -DestinationPath "${zip}" -Force`], { stdio: 'inherit' });
  else execFileSync('zip', ['-qr', zip, path.basename(out)], { cwd: DIST, stdio: 'inherit' });
  console.log('built ' + zip + ' (' + Math.round(fs.statSync(zip).size / 1048576) + ' MB)');
})().catch((e) => { console.error(e); process.exit(1); });
