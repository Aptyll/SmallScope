// What Steam knows of this copy, which steamworks.js (0.4, its latest) does not
// reach: when this account first bought Softfall. The page's FOUNDER badge
// reads it (PROFILE.founder, js/app/profile.js): a copy bought before the
// free-to-play switch is a founder's. A borrowed (family-shared) copy, a free
// weekend, a browser or any failure answers 0, and 0 is never a founder.
// Calls steam_api64.dll's flat API through koffi, the DLL steamworks.js
// already loaded and initialised, as steam-friends.js does.
const path = require('path');

function dllPath() {
  if (process.env.SF_STEAM_API) return process.env.SF_STEAM_API; // a stand-in library, for a check off Steam
  const dist = path.join(path.dirname(require.resolve('steamworks.js')), 'dist');
  if (process.platform === 'win32') return path.join(dist, 'win64', 'steam_api64.dll');
  if (process.platform === 'darwin') return path.join(dist, 'osx', 'libsteam_api.dylib');
  return path.join(dist, 'linux64', 'libsteam_api.so');
}

function steamApps(appId) {
  const A = { ok: false, error: null };
  let api = null;
  try {
    const koffi = require('koffi');
    const lib = koffi.load(dllPath());
    api = {
      apps: lib.func('void *SteamAPI_SteamApps_v008()'),
      earliest: lib.func('uint32 SteamAPI_ISteamApps_GetEarliestPurchaseUnixTime(void *self, uint32 app)'),
      shared: lib.func('bool SteamAPI_ISteamApps_BIsSubscribedFromFamilySharing(void *self)'),
      weekend: lib.func('bool SteamAPI_ISteamApps_BIsSubscribedFromFreeWeekend(void *self)'),
    };
    if (!api.apps()) throw new Error('no ISteamApps');
    A.ok = true;
  } catch (e) { A.error = e.message; api = null; }
  // unix seconds of this account's first purchase of the app, 0 if none or unknown
  A.bought = () => {
    if (!api) return 0;
    try {
      const self = api.apps();
      if (api.shared(self) || api.weekend(self)) return 0; // played on someone else's copy, or free for the weekend
      return Number(api.earliest(self, appId)) || 0;
    } catch (e) { return 0; }
  };
  return A;
}

module.exports = { steamApps };
