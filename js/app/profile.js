// The local player profile: who you are between matches.
//
// One object under one localStorage key, and THE ONLY PLACE THE GAME TOUCHES
// STORAGE. Everything else - game.js included - goes through window.PROFILE, so
// putting the profile on a server later is a change to this file and nothing
// else: swap the private read()/write() pair for requests, keep the surface
// below identical.
//
// There are no accounts, no passwords and no sign-in. A profile is ONE NAME
// and its lifetime stats, the hero last picked (so the pick opens on it),
// plus the flags, records and settings the player carries (moved here in v1;
// the old key is migrated once and removed). Heroes are picked per match and
// wear their looks (the skins screen's picks, under `worn`), so nothing here
// stores a body. v2's three character slots fold into one profile on load: the
// active slot's name and hero, every slot's stats added together. v4 keeps the
// hero by NAME, not by its place in CLASSES, so a hero added or taken away
// never moves anyone's pick; an older save's index is read through V3_HEROES.
(function () {
  const KEY = 'softfall.profile';
  // the saved matches a profile kept before saves were removed: an index key
  // and a body per slot, cleared once at load so they stop taking up storage
  const OLD_SAVES = 'softfall.saves', OLD_SAVE = 'softfall.save.';
  const OLD_SETTINGS = 'softfall.settings'; // pre-profile saves; migrated once
  const NAME_MAX = 16;
  const POS_N = 3;                 // POSITIONS.length (js/sim/player.js)
  // the position a v4 save asked for, from the five-a-side order it saved an
  // index into (TOP JUNGLE MID BOT SUPPORT, frozen: never edit it) to today's;
  // -1 for one 3v3 has not (MID, SUPPORT), so the draft deals any
  const V4_POS = [0, 1, -1, 2, -1];
  // the hero order v3 and older saved an index into (CLASSES as it stood then,
  // frozen: never edit it). The first two were not heroes and are gone, so a
  // pick of either opens on the default hero ('').
  const V3_HEROES = ['', '', 'ARMATOS', 'FORTIVA', 'BELLA', 'IGNIA', 'AURA', 'SALVIA', 'LUCERNA', 'HIEMS',
    'RUPES', 'VARRO', 'BUCINA', 'NIX', 'FABER', 'VELOX', 'FALCO', 'MARIS', 'LIGNUM', 'SAGITTA'];
  const HERO_NAME = /^[A-Z]{1,16}$/;
  // the coins a profile starts with: the cosmetics' purse, kept outside every
  // match (a match's gold never reaches it). What a coin buys is the skins
  // screen's table (js/ui/skins.js); this file only keeps the count and ids.
  const START_COINS = 100;
  // RANKED's rating, one per profile: where it starts and its floor. What
  // moves it is the party lobby's (rankResult, js/ui/rooms.js)
  const RANK_START = 1000, RANK_MIN = 0;
  // A FOUNDER bought Softfall before it went free to play (the price's promise:
  // free at a copies-sold goal, a badge for those who paid). The switch's unix
  // time goes here in the patch that makes the game free; until then every
  // copy bought is a founder's. Never saved: Steam says when this account
  // bought it (steamBought, at boot), so no hand edit makes a founder.
  const FOUNDER_UNTIL = null;
  let bought = 0;
  const ID_MAX = 24; // a cosmetic id is a short word; anything longer is junk from a hand edit

  // A fresh profile comes PRE-NAMED, never blank: one of these winter words,
  // so the first press on the title is play and not a form. The name is the
  // profile card's to change (js/ui/chars.js). Every word passes validate()
  // (A-Z, under NAME_MAX, clean), and none is a hero name.
  const NAME_POOL = [
    'JUNIPER', 'ROWAN', 'ASPEN', 'BIRCH', 'ALDER', 'BRAMBLE', 'SORREL', 'THISTLE',
    'FROST', 'DRIFT', 'FLURRY', 'EMBER', 'FLINT', 'TINDER', 'GLACIER', 'AURORA',
    'MARTEN', 'ERMINE', 'SABLE', 'VIXEN', 'LYNX', 'STOAT', 'OTTER', 'BADGER',
    'HERON', 'MAGPIE', 'STARLING', 'PLOVER', 'SISKIN', 'KESTREL', 'REDPOLL', 'BRANT',
  ];
  function randomName() {
    return NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
  }
  function randomPid() {
    let s = '';
    for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }
  function blankStats() {
    return { wins: 0, matches: 0, gold: 0, kills: 0, deaths: 0 };
  }
  // stats repaired onto `into`: whole, non-negative numbers ADDED to what is
  // there (so v2's slots sum into one ledger); anything else is skipped
  function addStats(into, src) {
    if (!src || typeof src !== 'object') return into;
    for (const k in into) {
      if (typeof src[k] === 'number' && isFinite(src[k])) into[k] += Math.max(0, Math.floor(src[k]));
    }
    return into;
  }

  // A basic filter, deliberately: it normalises the obvious letter-for-digit
  // swaps and then looks for any of these ANYWHERE in the name, so a handful of
  // innocent strings will be refused too. That trade is the right way round for
  // a name every other player sees, and the list is the one thing here a server
  // would replace outright.
  const BAD = [
    'FUCK', 'SHIT', 'CUNT', 'BITCH', 'BASTARD', 'DICK', 'COCK', 'PUSSY', 'PENIS',
    'VAGINA', 'WHORE', 'SLUT', 'ANUS', 'RAPE', 'NAZI', 'HITLER', 'NIGG', 'FAGG',
    'RETARD', 'WANK', 'TWAT', 'PISS', 'BOLLOCK', 'ARSEHOLE', 'ASSHOLE', 'PORN',
  ];
  // Entries are matched as substrings, so the list is deliberately missing the
  // short ones that live inside ordinary words - ASS in CLASS, CUM in SCUM. A
  // name is 16 characters; refusing half the dictionary to catch those is the
  // worse failure.
  const LEET = { '0': 'O', '1': 'I', '3': 'E', '4': 'A', '5': 'S', '7': 'T', '8': 'B' };

  // the shape a fresh install starts from; also what a corrupt save is repaired
  // against, so every field below is guaranteed present to every reader
  function blank() {
    return {
      v: 5,
      // who this profile is to other screens: 8 hex digits dealt once, so a
      // player met twice is the same entry in their list of people (PROFILE.people)
      // whatever they are called now. Nothing checks it: there is no server.
      pid: randomPid(),
      name: randomName(),
      pic: '',         // the profile picture: a hero's face by name ('' the hero last picked)
      named: false,    // the player chose the name; until then it follows the Steam name (steamName)
      stats: blankStats(),
      hero: '',        // the hero last locked in, by name ('' none): where the pick opens next time
      pos: -1,         // the position this profile asks for in the draft (a POSITIONS index, js/sim/player.js), -1 any
      // the cosmetics' purse and what it bought: coins, the owned ids, and
      // per slot (a hero's id) the id worn. A free cosmetic is never written to
      // `owned`, and an id the game no longer has is kept but never worn
      // (skinWorn, js/ui/skins.js, falls back to the free one), unless it is
      // retired and refunded (refundRetired).
      coins: START_COINS,
      rank: RANK_START,
      rankedN: 0,      // RANKED matches played (addRank): none, and a profile shows no rank badge
      // the FIRST MATCH's coach was seen through or turned off: the title
      // stops offering it (js/ui/guide.js)
      guided: false,
      // how often this machine fell behind its people when it hosted, 0..1
      // (netHostLag, js/net/net.js): matchmaking picks other hosts first (seekScore)
      hostLag: 0,
      owned: [],
      worn: {},
      // null, not {} - game.js reads a null here as "nothing was ever saved"
      // and skips its own settings migration, which a bare {} would trigger
      settings: null,
      // when the settings last CHANGED on this screen (ms), and a digest of the
      // part Steam Cloud carries as it stood then: the newer side wins a sync
      // (cloudSync), and a save that changed nothing never makes this side newer
      setAt: 0,
      setSum: '',
    };
  }

  let profile = blank();
  let firstRun = false;
  let dirty = false;
  let timer = 0;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) { }
  }
  // coalesced write: the stat calls fire mid-match (every gold payout is one),
  // and a localStorage round trip per coin is not worth paying
  function scheduleSave() {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => { timer = 0; flush(); }, 800);
  }
  function flush() {
    if (dirty) saveNow();
  }
  function saveNow() {
    dirty = false;
    write(profile);
  }

  // ---- name ---------------------------------------------------------------
  function fold(s) {
    let out = '';
    for (const ch of s) out += LEET[ch] || ch;
    return out;
  }
  function profane(name) {
    const f = fold(name);
    for (const w of BAD) if (f.indexOf(w) >= 0) return true;
    return false;
  }
  // The one validator. Returns { ok:true, name } with the stored form, or
  // { ok:false, why } where why is 'EMPTY' | 'CHARS' | 'LONG' | 'RUDE'. The UI
  // stops most of these at the keystroke, but every write goes through here.
  function validate(raw) {
    const s = String(raw == null ? '' : raw).trim().toUpperCase();
    if (!s) return { ok: false, why: 'EMPTY' };
    if (s.length > NAME_MAX) return { ok: false, why: 'LONG' };
    if (!/^[A-Z0-9]+$/.test(s)) return { ok: false, why: 'CHARS' };
    if (profane(s)) return { ok: false, why: 'RUDE' };
    return { ok: true, name: s };
  }

  window.PROFILE = {
    NAME_MAX, RANK_START,

    // Read the store once, at boot, before anything asks for a name. Repairs a
    // partial or corrupt save against blank() rather than throwing, and folds a
    // pre-profile settings key in on the way past.
    load() {
      const s = read();
      profile = blank();
      if (s && typeof s === 'object') {
        // who you are: v1 and v3 keep one name and one ledger; v2 kept up to
        // three character slots, which fold into one here - the active slot's
        // name and hero, and every slot's stats added together, so nobody
        // loses a win they had on any of them
        let name = s.name, hero = s.hero;
        if (Array.isArray(s.chars)) {
          const act = s.chars[s.active | 0] || s.chars[0];
          if (act && typeof act === 'object') { name = act.name; hero = act.cls; }
          for (const c of s.chars) if (c && typeof c === 'object') addStats(profile.stats, c.stats);
        } else addStats(profile.stats, s.stats);
        if (typeof name === 'string' && validate(name).ok) profile.name = validate(name).name;
        // a profile from before the flag: a name out of the winter pool was dealt, not chosen
        profile.named = typeof s.named === 'boolean' ? s.named : NAME_POOL.indexOf(profile.name) < 0;
        if (typeof s.pid === 'string' && /^[0-9a-f]{8}$/.test(s.pid)) profile.pid = s.pid; // else the fresh one blank() dealt is kept
        if (typeof s.pic === 'string' && HERO_NAME.test(s.pic)) profile.pic = s.pic;
        if (typeof hero === 'string' && HERO_NAME.test(hero)) profile.hero = hero; // a name the game no longer has opens on the default (profileHero, js/sim/player.js)
        else if (typeof hero === 'number' && isFinite(hero)) profile.hero = V3_HEROES[Math.floor(hero)] || '';
        const pos = typeof s.pos === 'number' && s.pos >= 0 ? Math.floor(s.pos) : -1;
        if (pos >= 0 && pos < (s.v === 5 ? POS_N : V4_POS.length)) profile.pos = s.v === 5 ? pos : V4_POS[pos];
        if (s.settings && typeof s.settings === 'object') profile.settings = s.settings;
        if (typeof s.setAt === 'number' && isFinite(s.setAt) && s.setAt > 0) profile.setAt = Math.floor(s.setAt);
        if (typeof s.setSum === 'string' && s.setSum.length <= 16) profile.setSum = s.setSum;
        // a profile from before the purse arrives without it and keeps the
        // START_COINS blank() gave it, like a fresh one
        if (typeof s.coins === 'number' && isFinite(s.coins)) profile.coins = Math.max(0, Math.floor(s.coins));
        if (typeof s.rank === 'number' && isFinite(s.rank)) profile.rank = Math.max(RANK_MIN, Math.floor(s.rank));
        // a profile from before the count: one game if the rating ever moved off the start
        profile.rankedN = typeof s.rankedN === 'number' && isFinite(s.rankedN) && s.rankedN >= 0 ? Math.floor(s.rankedN) : profile.rank !== RANK_START ? 1 : 0;
        // a profile from before the coach is not offered it once it has played
        profile.guided = typeof s.guided === 'boolean' ? s.guided : profile.stats.matches > 0;
        if (typeof s.hostLag === 'number' && s.hostLag >= 0 && s.hostLag <= 1) profile.hostLag = s.hostLag;
        if (Array.isArray(s.owned)) {
          for (const id of s.owned) if (typeof id === 'string' && id.length <= ID_MAX && profile.owned.indexOf(id) < 0) profile.owned.push(id);
        }
        if (s.worn && typeof s.worn === 'object') {
          for (const k in s.worn) if (typeof s.worn[k] === 'string' && s.worn[k].length <= ID_MAX) profile.worn[k] = s.worn[k];
        }
      } else {
        firstRun = true; // the game's very first boot on this machine (PROFILE.firstRun)
        // no profile yet: adopt the settings the player already had
        try {
          const old = JSON.parse(localStorage.getItem(OLD_SETTINGS));
          if (old && typeof old === 'object') profile.settings = old;
          localStorage.removeItem(OLD_SETTINGS);
        } catch (e) { }
        saveNow();
      }
      if (s && (s.v !== 5 || s.pid !== profile.pid)) saveNow(); // a migrated save is written back in its new shape at once
      clearOldSaves();
      return profile;
    },

    get() { return profile; },
    validate,

    // ---- who you are --------------------------------------------------------
    // The one name every other player sees, and the hero the pick opens on.
    name() { return profile.name; },
    // Returns validate()'s result; on a refusal nothing is written.
    setName(raw) {
      const r = validate(raw);
      if (!r.ok) return r;
      if (profile.name !== r.name) { profile.name = r.name; profile.named = true; saveNow(); }
      return r;
    },
    // On Steam a name nobody chose is the Steam one, cut to what a name may
    // hold (letters and digits, NAME_MAX); true when it changed
    steamName(raw) {
      if (profile.named) return false;
      const r = validate(String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, NAME_MAX));
      if (!r.ok || r.name === profile.name) return false;
      profile.name = r.name; saveNow();
      return true;
    },
    // Steam's first purchase of the game, unix seconds (0 none: a browser, a
    // borrowed copy), read at boot (js/app/boot.js); founder() is the badge's
    steamBought(t) { bought = typeof t === 'number' && isFinite(t) && t > 0 ? Math.floor(t) : 0; },
    founder() { return bought > 0 && (FOUNDER_UNTIL === null || bought < FOUNDER_UNTIL); },
    pid() { return profile.pid; },
    // the picture by hero name ('' none chosen: the screens show the hero last picked)
    pic() { return profile.pic; },
    setPic(name) {
      if (typeof name !== 'string' || (name && !HERO_NAME.test(name)) || profile.pic === name) return;
      profile.pic = name;
      saveNow();
    },
    // the hero by name ('' for none yet); the sim turns it into a CLASSES index (profileHero)
    hero() { return profile.hero; },
    setHero(name) {
      if (typeof name !== 'string' || !HERO_NAME.test(name) || profile.hero === name) return;
      profile.hero = name;
      saveNow();
    },

    // the position the draft seats this profile in first (draftSeatRoles, js/ui/draft.js), -1 any
    pos() { return profile.pos; },
    setPos(i) {
      i = i >= 0 && i < POS_N ? i | 0 : -1;
      if (profile.pos === i) return;
      profile.pos = i;
      saveNow();
    },

    // ---- settings ---------------------------------------------------------
    // The live stored object, or null if this profile has never saved any.
    settings() { return profile.settings; },
    // `local`: the keys that stay on this machine (SETTINGS_LOCAL, js/sim/core.js);
    // the rest ride Steam Cloud when they changed
    putSettings(s, local) {
      profile.settings = s;
      // before the boot's read answers nothing here is newer than the cloud: a
      // fresh PC saving its defaults at boot must not win over the account's
      const sum = synced ? digest(cloudPart(s, local)) : profile.setSum;
      if (sum !== profile.setSum) { profile.setSum = sum; profile.setAt = Date.now(); cloudPush(local); }
      saveNow();
    },
    // STEAM CLOUD: the settings and key binds follow the Steam account to any
    // PC, one small file through the wrapper (desktop/main.js, cloud:read and
    // cloud:write; Steam must have Cloud on for the app and the account). Read
    // once at boot: the newer side wins - the cloud's is adopted here (true:
    // the caller applies it, js/app/boot.js), or this screen's is written up.
    // With no wrapper, or no cloud, nothing happens and it answers false.
    cloudSync(local) {
      const b = window.steamBridge;
      if (!b || !b.cloudRead) { synced = true; return Promise.resolve(false); }
      return b.cloudRead(CLOUD_FILE).then((text) => {
        synced = true;
        if (text == null) return false; // no cloud for this app or account
        let doc = null;
        try { doc = JSON.parse(text); } catch (e) { }
        const ok = doc && typeof doc === 'object' && doc.settings && typeof doc.settings === 'object' && !Array.isArray(doc.settings) &&
          typeof doc.at === 'number' && isFinite(doc.at);
        if (ok && doc.at > profile.setAt) {
          const got = cloudPart(doc.settings, local); // a key this machine keeps is never taken from another
          profile.settings = Object.assign({}, profile.settings || {}, got);
          profile.setAt = Math.floor(doc.at);
          profile.setSum = digest(got);
          saveNow();
          return true;
        }
        if (profile.settings && (!ok || doc.at < profile.setAt)) cloudPush(local, true);
        return false;
      }).catch(() => { synced = true; return false; });
    },

    // ---- stats ------------------------------------------------------------
    // The lifetime numbers.
    stats() { return profile.stats; },
    addWin() { this.stats().wins++; scheduleSave(); },
    addGold(n) { if (n > 0) { this.stats().gold += n; scheduleSave(); } },
    addMatch() { this.stats().matches++; scheduleSave(); }, // one per eagle takeoff (beginMatch)
    addKill() { this.stats().kills++; scheduleSave(); },    // a rival the local player downed (die, js/sim/player.js)
    addDeath() { this.stats().deaths++; scheduleSave(); },  // the local player downed

    // ---- cosmetics ----------------------------------------------------------
    // The purse and the wardrobe. Prices and what an id IS live in the
    // callers' tables (each hero's looks, heroArt, js/sprites/hero-art.js); every write here is
    // a moment, not a trickle, so each saves through at once.
    coins() { return profile.coins; },
    owns(id) { return profile.owned.indexOf(id) >= 0; },
    // spend `price` on `id`: false, and nothing written, when it is already
    // owned or the purse is short
    buy(id, price) {
      price = Math.max(0, Math.floor(price) || 0);
      if (typeof id !== 'string' || !id || id.length > ID_MAX || this.owns(id) || profile.coins < price) return false;
      profile.coins -= price;
      profile.owned.push(id);
      saveNow();
      return true;
    },
    // the id worn in a slot, or null for the slot's free default
    worn(slot) { return profile.worn[slot] || null; },
    wear(slot, id) {
      if (profile.worn[slot] === id) return false;
      if (id) profile.worn[slot] = id; else delete profile.worn[slot];
      saveNow();
      return true;
    },
    // cosmetics the game no longer sells (`retired`: key -> what it cost) and
    // the wardrobe slots it no longer has: each one owned is taken off the
    // list and its coins handed back, and a gone slot's pick is forgotten
    // (SKIN_RETIRED, js/ui/skins.js). Once: after it nothing is left to find.
    refundRetired(retired, slots) {
      let back = 0, changed = false;
      profile.owned = profile.owned.filter((id) => { if (!(id in retired)) return true; back += retired[id]; changed = true; return false; });
      for (const k of slots) if (k in profile.worn) { delete profile.worn[k]; changed = true; }
      profile.coins += back;
      if (changed) saveNow();
      return back;
    },
    // a finished match's pay (payMatchCoins, js/ui/skins.js): a moment, so it saves through
    addCoins(n) { n = Math.floor(n) || 0; if (n > 0) { profile.coins += n; saveNow(); } },
    // ---- ranked -------------------------------------------------------------
    rank() { return profile.rank; },
    addRank(d) { profile.rank = Math.max(RANK_MIN, profile.rank + (Math.round(d) || 0)); profile.rankedN++; saveNow(); },
    rankedN() { return profile.rankedN; },
    // ---- new players ----------------------------------------------------------
    guided() { return profile.guided; },
    // no profile was saved before this boot: the first launch, which goes straight into the FIRST MATCH (js/app/boot.js)
    firstRun() { return firstRun; },
    setGuided(on) { on = on !== false; if (profile.guided !== on) { profile.guided = on; saveNow(); } },
    // ---- hosting ----------------------------------------------------------------
    hostLag() { return profile.hostLag; },
    setHostLag(f) { profile.hostLag = Math.max(0, Math.min(1, +f || 0)); saveNow(); },
    // DBG only: set the purse (a staged screenshot, a test of the short purse)
    setCoins(n) { profile.coins = Math.max(0, Math.floor(n) || 0); saveNow(); },

    // ---- build records --------------------------------------------------------
    // Every human seat's finished build and result from the matches this
    // screen saw or heard of (js/app/builds.js owns their shape and the
    // stats read off them). Kept under a key of their own: they are many and
    // written once a match, and the profile above is written for every coin.
    builds() {
      if (!buildRecs) { try { const a = JSON.parse(localStorage.getItem(BUILDS_KEY)); buildRecs = Array.isArray(a) ? a : []; } catch (e) { buildRecs = []; } }
      return buildRecs;
    },
    putBuilds(list) {
      buildRecs = list;
      try { localStorage.setItem(BUILDS_KEY, JSON.stringify(list)); } catch (e) { }
    },

    // ---- match history ----------------------------------------------------------
    // This screen's own finished matches, oldest first (js/app/history.js owns
    // their shape and checks each one on the way in). A key of their own for
    // the same reason as the builds: many, and written once a match.
    history() {
      if (!histRecs) {
        try { const a = JSON.parse(localStorage.getItem(HISTORY_KEY)); histRecs = Array.isArray(a) ? a.map(historyClean).filter(Boolean) : []; } catch (e) { histRecs = []; }
      }
      return histRecs;
    },
    putHistory(list) {
      histRecs = list;
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (e) { }
    },

    // the people this screen has sat in a party with: their cards as last
    // heard, keyed by their pid (js/app/history.js owns the shape)
    people() {
      if (!peopleRecs) {
        try { const a = JSON.parse(localStorage.getItem(PEOPLE_KEY)); peopleRecs = Array.isArray(a) ? a.map(peopleClean).filter(Boolean) : []; } catch (e) { peopleRecs = []; }
      }
      return peopleRecs;
    },
    putPeople(list) {
      peopleRecs = list;
      try { localStorage.setItem(PEOPLE_KEY, JSON.stringify(list)); } catch (e) { }
    },

    flush,
  };
  // ---- Steam Cloud's file -------------------------------------------------
  const CLOUD_FILE = 'settings.json';
  const CLOUD_WAIT = 1500; // ms a change waits for the next one before it goes up: a dragged slider is one write
  let cloudTimer = 0, cloudLocal = null;
  let synced = false; // the boot's cloudSync has answered (or there is no cloud to ask)
  // the settings minus the machine's own keys, top-level keys sorted so the
  // same settings always spell the same text (digest)
  function cloudPart(s, local) {
    const out = {};
    for (const k of Object.keys(s || {}).sort()) if (!local || local.indexOf(k) < 0) out[k] = s[k];
    return out;
  }
  // a short fingerprint of a part (32-bit FNV-1a over its text): has it changed?
  function digest(part) {
    const t = JSON.stringify(part);
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
  }
  function cloudPush(local, now) {
    const b = window.steamBridge;
    if (!b || !b.cloudWrite) return;
    cloudLocal = local;
    if (cloudTimer) clearTimeout(cloudTimer);
    cloudTimer = 0;
    if (now) cloudWrite(); else cloudTimer = setTimeout(cloudWrite, CLOUD_WAIT);
  }
  function cloudWrite() {
    cloudTimer = 0;
    if (!profile.settings) return;
    const doc = { v: 1, at: profile.setAt, settings: cloudPart(profile.settings, cloudLocal) };
    window.steamBridge.cloudWrite(CLOUD_FILE, JSON.stringify(doc)).catch(() => { });
  }
  // a change still waiting when the window goes
  function cloudFlush() { if (cloudTimer) { clearTimeout(cloudTimer); cloudWrite(); } }
  const PEOPLE_KEY = 'softfall.people';
  let peopleRecs = null;
  const BUILDS_KEY = 'softfall.builds';
  let buildRecs = null;
  const HISTORY_KEY = 'softfall.history';
  let histRecs = null;

  function clearOldSaves() {
    try {
      const dead = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === OLD_SAVES || (k && k.startsWith(OLD_SAVE))) dead.push(k); }
      for (const k of dead) localStorage.removeItem(k);
    } catch (e) { }
  }

  // a coalesced write still pending when the tab goes away
  window.addEventListener('pagehide', () => { flush(); cloudFlush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { flush(); cloudFlush(); } });
})();
