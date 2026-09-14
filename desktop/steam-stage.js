// Stages the portable build for SteamPipe: runs build.js, then copies the
// unzipped package into the Steamworks SDK's ContentBuilder content folder so
// Softfall.exe sits at the content root - what the app build script
// (tools/ContentBuilder/scripts/app_build_5244550.vdf) uploads.
//   npm run steam:stage                      -> C:\steamworks_sdk\tools\ContentBuilder\content\
//   STEAMWORKS_SDK=D:\sdk npm run steam:stage  another SDK location
// steam_appid.txt is NOT copied: Steam supplies the App ID to a build it
// launches, and the file beside a shipped exe is a dev-only convenience.
// The upload itself is Noah's to run, signed in:
//   builder\steamcmd.exe +login softfall7 +run_app_build ..\scripts\app_build_5244550.vdf +quit
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const SDK = process.env.STEAMWORKS_SDK || 'C:\\steamworks_sdk';
const CONTENT = path.join(SDK, 'tools', 'ContentBuilder', 'content');
const PKG = path.join(HERE, 'dist', 'Softfall-win32-x64'); // build.js's unzipped output
const EXE = 'Softfall.exe';

if (!fs.existsSync(path.join(SDK, 'tools', 'ContentBuilder'))) { console.error('no Steamworks SDK at ' + SDK + ' (tools/ContentBuilder missing); set STEAMWORKS_SDK'); process.exit(1); }
execFileSync(process.execPath, [path.join(HERE, 'build.js')], { stdio: 'inherit' });
if (!fs.existsSync(path.join(PKG, EXE))) { console.error('build left no ' + EXE + ' in ' + PKG); process.exit(1); }

fs.rmSync(CONTENT, { recursive: true, force: true });
fs.mkdirSync(CONTENT, { recursive: true });
let files = 0;
fs.cpSync(PKG, CONTENT, { recursive: true, filter: (src) => { if (path.basename(src) === 'steam_appid.txt') return false; if (fs.statSync(src).isFile()) files++; return true; } });
// build.js leaves the game copied into app/, which main.js would then prefer
// over the repo's page on the next `npm start`: not wanted after a stage
fs.rmSync(path.join(HERE, 'app'), { recursive: true, force: true });
console.log('staged ' + files + ' files into ' + CONTENT + '\nexe: ' + path.join(CONTENT, EXE));
