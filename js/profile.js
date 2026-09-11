// The local player profile: who you are between matches.
//
// One object under one localStorage key, and THE ONLY PLACE THE GAME TOUCHES
// STORAGE. Everything else - game.js included - goes through window.PROFILE, so
// putting the profile on a server later is a change to this file and nothing
// else: swap the private read()/write() pair for requests, keep the surface
// below identical.
//
// There are no accounts, no passwords and no sign-in. A profile is up to
// CHAR_MAX CHARACTERS - each a name, a class fixed at creation, a look and its
// own lifetime stats - one of them active, plus the flags and settings the
// player carries between them (moved here in v1; the old key is migrated once
// and removed; v2 turned the one name into the character slots).
(function () {
  const KEY = 'softfall.profile';
  const OLD_SETTINGS = 'softfall.settings'; // pre-profile saves; migrated once
  const NAME_MAX = 16;
  const DEFAULT_NAME = 'WANDERER'; // what a corrupt save falls back to mid-session
  const CHAR_MAX = 3;              // character slots a profile holds
  const CLASS_N = 2;               // CLASSES.length (js/player.js) - a class index past this is repaired to 0
  // the look's axes and how many choices each has. The pictures for them are
  // js/sprites/looks.js, which asserts its tables against these counts at
  // load; this file only stores and repairs the numbers.
  const LOOK_N = { sex: 2, tone: 6, hair: 6, hairCol: 8, beard: 4, face: 3 };

  // A fresh character comes PRE-ROLLED, not blank: the create screen opens on
  // one of these winter words and a random look, so a player who wants the
  // game presses PLAY once and a player who wants to be someone stays and
  // shapes it. Every word passes validate() (A-Z, under NAME_MAX, clean), and
  // none is a class name.
  const NAME_POOL = [
    'JUNIPER', 'ROWAN', 'ASPEN', 'BIRCH', 'ALDER', 'BRAMBLE', 'SORREL', 'THISTLE',
    'FROST', 'DRIFT', 'FLURRY', 'EMBER', 'FLINT', 'TINDER', 'GLACIER', 'AURORA',
    'MARTEN', 'ERMINE', 'SABLE', 'VIXEN', 'LYNX', 'STOAT', 'OTTER', 'BADGER',
    'HERON', 'MAGPIE', 'STARLING', 'PLOVER', 'SISKIN', 'KESTREL', 'REDPOLL', 'BRANT',
  ];
  function randomName() {
    return NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
  }
  function randomLook() {
    const look = {};
    for (const k in LOOK_N) look[k] = Math.floor(Math.random() * LOOK_N[k]);
    return look;
  }
  // a look repaired axis by axis against LOOK_N: a missing or out-of-range
  // value (a hand-edited save, a table that shrank) lands on 0, never throws
  function mendLook(src) {
    const look = {};
    for (const k in LOOK_N) {
      const v = src && typeof src[k] === 'number' && isFinite(src[k]) ? Math.floor(src[k]) : 0;
      look[k] = v >= 0 && v < LOOK_N[k] ? v : 0;
    }
    return look;
  }
  function blankStats() {
    return { wins: 0, matches: 0, gold: 0, days: 0, kills: 0, deaths: 0 };
  }
  // a character's stored shape. `born` is when it was made (ms), unread by
  // the game and kept for a server to order slots by.
  function mendChar(src) {
    const c = { name: '', cls: 0, look: mendLook(src && src.look), stats: blankStats(), born: Date.now() };
    if (src && typeof src === 'object') {
      if (typeof src.name === 'string' && validate(src.name).ok) c.name = validate(src.name).name;
      if (typeof src.cls === 'number' && isFinite(src.cls) && src.cls >= 0 && src.cls < CLASS_N) c.cls = Math.floor(src.cls);
      if (src.stats && typeof src.stats === 'object') {
        for (const k in c.stats) {
          if (typeof src.stats[k] === 'number' && isFinite(src.stats[k])) c.stats[k] = Math.max(0, Math.floor(src.stats[k]));
        }
      }
      if (typeof src.born === 'number' && isFinite(src.born)) c.born = src.born;
    }
    if (!c.name) c.name = randomName();
    return c;
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
      v: 2,
      // the character slots (mendChar's shape, at most CHAR_MAX) and which one
      // is active. An empty list is a fresh install: boot opens the create
      // screen before the title (js/boot.js). Everything a character owns -
      // its name, class, look and stats - lives in its slot; what follows is
      // the player's, shared by all three.
      chars: [],
      active: 0,
      dropped: false,  // has this profile ever jumped off the eagle - gates the first-flight countdown
      practice: false, // has the PRACTICE TOOL plank been knocked open (3 knocks; stays open)
      bestLap: 0,      // the ice parkour's all-time best lap in seconds (0 = never lapped)
      bestRange: 0,    // the archery range's all-time best round score (0 = never played) - these two are all practice writes
      // (the lifetime stats moved onto the characters in v2: a v1 save's
      // name and stats become its first character in load())
      // The arsenal tree. A MATCH reads nothing back out of here - every kind
      // is unlocked for every profile alike - so the one live list is `seen`:
      // every `TECH` node id this profile has ever held, written from the
      // pickup and drawn as a pip on the node. `done` is the research a save
      // from before the unlock (PATCH 2.08) had bought; it is still carried
      // through so a veteran's record is not thrown away, and nothing reads it.
      tech: { seen: [], done: [] },
      // null, not {} - game.js reads a null here as "nothing was ever saved"
      // and skips its own settings migration, which a bare {} would trigger
      settings: null,
    };
  }

  let profile = blank();
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
    NAME_MAX, DEFAULT_NAME,

    // Read the store once, at boot, before anything asks for a name. Repairs a
    // partial or corrupt save against blank() rather than throwing, and folds a
    // pre-profile settings key in on the way past.
    load() {
      const s = read();
      profile = blank();
      if (s && typeof s === 'object') {
        profile.dropped = !!s.dropped;
        profile.practice = !!s.practice;
        if (typeof s.bestLap === 'number' && isFinite(s.bestLap) && s.bestLap > 0) profile.bestLap = s.bestLap;
        if (typeof s.bestRange === 'number' && isFinite(s.bestRange) && s.bestRange > 0) profile.bestRange = Math.floor(s.bestRange);
        if (Array.isArray(s.chars)) {
          // the slots, each repaired on its own; past CHAR_MAX are dropped
          for (const c of s.chars.slice(0, CHAR_MAX)) profile.chars.push(mendChar(c));
        } else if (typeof s.name === 'string' && s.name) {
          // a v1 save: its one name and its numbers become the first
          // character, a hunter with a rolled look (the class is the
          // player's to fix by making another; the stats are the point)
          const c = mendChar({ name: s.name, cls: 0, look: randomLook(), stats: s.stats });
          if (validate(s.name).ok) c.name = validate(s.name).name;
          profile.chars.push(c);
        }
        if (typeof s.active === 'number' && isFinite(s.active)) profile.active = Math.floor(s.active);
        if (profile.active < 0 || profile.active >= profile.chars.length) profile.active = 0;
        // the tech lists: strings only, de-duplicated, and a save written
        // before the tree existed simply arrives without them and keeps the
        // empty pair blank() made
        if (s.tech && typeof s.tech === 'object') {
          for (const k of ['seen', 'done']) {
            if (!Array.isArray(s.tech[k])) continue;
            for (const id of s.tech[k]) {
              if (typeof id === 'string' && profile.tech[k].indexOf(id) < 0) profile.tech[k].push(id);
            }
          }
        }
        if (s.settings && typeof s.settings === 'object') profile.settings = s.settings;
      } else {
        // no profile yet: adopt the settings the player already had
        try {
          const old = JSON.parse(localStorage.getItem(OLD_SETTINGS));
          if (old && typeof old === 'object') profile.settings = old;
          localStorage.removeItem(OLD_SETTINGS);
        } catch (e) { }
        saveNow();
      }
      if (s && s.v !== 2) saveNow(); // a migrated save is written back in its new shape at once
      return profile;
    },

    get() { return profile; },
    validate,

    // ---- characters -------------------------------------------------------
    // The slots. A character is { name, cls, look, stats, born } (mendChar);
    // the active one is what the local player wears into a match
    // (applyCharacter, js/player.js). Everything a match writes back - the
    // stat calls below - lands on the active slot.
    CHAR_MAX, CLASS_N, LOOK_N,
    chars() { return profile.chars; },
    activeIndex() { return profile.active; },
    char() { return profile.chars[profile.active] || null; },
    hasChar() { return profile.chars.length > 0; },
    // the name to print: the active character's, the default only for a
    // profile with no character yet (boot never plays one)
    name() { const c = profile.chars[profile.active]; return c ? c.name : DEFAULT_NAME; },
    // a fresh, UNSAVED character for the create screen to open on: rolled
    // name, rolled look, the class the caller asks for (or a coin)
    rollChar(cls) {
      return mendChar({ name: randomName(), cls: typeof cls === 'number' ? cls : Math.floor(Math.random() * CLASS_N), look: randomLook() });
    },
    // Make a character from a spec ({ name, cls, look }) into the next free
    // slot and make it active. Returns validate()'s result for the name, or
    // { ok: false, why: 'FULL' }; on failure nothing is written.
    createChar(spec) {
      if (profile.chars.length >= CHAR_MAX) return { ok: false, why: 'FULL' };
      const r = validate(spec && spec.name);
      if (!r.ok) return r;
      const c = mendChar({ name: r.name, cls: spec.cls, look: spec.look, stats: null });
      profile.chars.push(c);
      profile.active = profile.chars.length - 1;
      saveNow();
      return r;
    },
    // Rename and re-dress slot i. The class is NOT taken from the spec: it is
    // fixed at creation, and the only way to another class is another
    // character. Returns validate()'s result; on failure nothing is written.
    updateChar(i, spec) {
      const c = profile.chars[i];
      if (!c) return { ok: false, why: 'EMPTY' };
      const r = validate(spec && spec.name);
      if (!r.ok) return r;
      c.name = r.name;
      c.look = mendLook(spec.look);
      saveNow();
      return r;
    },
    deleteChar(i) {
      if (!profile.chars[i]) return false;
      profile.chars.splice(i, 1);
      if (profile.active >= profile.chars.length) profile.active = Math.max(0, profile.chars.length - 1);
      else if (profile.active > i) profile.active--;
      saveNow();
      return true;
    },
    setActive(i) {
      if (!profile.chars[i] || profile.active === i) return false;
      profile.active = i;
      saveNow();
      return true;
    },

    // ---- first flight -------------------------------------------------------
    // whether this profile has ever left the eagle: false means the next ride
    // runs the PREPARE TO DROP countdown and jumps itself (js/boot.js)
    hasDropped() { return !!profile.dropped; },
    markDropped() { if (!profile.dropped) { profile.dropped = true; saveNow(); } },

    // ---- the practice tool --------------------------------------------------
    // whether the PRACTICE TOOL plank's ice has been broken (three knocks at
    // the title menu, js/menu.js). Once open it never refreezes for this
    // profile - the plank is a live menu item from then on.
    practiceOpen() { return !!profile.practice; },
    markPractice() { if (!profile.practice) { profile.practice = true; saveNow(); } },
    // the ice parkour's all-time best lap - one of the two things the arena
    // itself writes back (updatePractice, js/world.js). Stored at the plate's
    // own 0.1 s precision so the number shown IS the number kept; only a
    // strictly better (lower) time writes, and a lap record is a moment, not
    // a trickle, so it saves through immediately.
    bestLap() { return profile.bestLap; },
    setBestLap(t) {
      if (!(t > 0)) return false;
      const r = Math.round(t * 10) / 10;
      if (profile.bestLap && r >= profile.bestLap) return false;
      profile.bestLap = r;
      saveNow();
      return true;
    },
    // the archery range's all-time best round score - the lap record's twin
    // (agEndRound, js/world.js). Whole points; only a strictly higher score
    // writes, and a record is a moment, so it saves through immediately.
    bestRange() { return profile.bestRange; },
    setBestRange(n) {
      if (!(n > 0)) return false;
      const r = Math.floor(n);
      if (r <= profile.bestRange) return false;
      profile.bestRange = r;
      saveNow();
      return true;
    },

    // ---- settings ---------------------------------------------------------
    // The live stored object, or null if this profile has never saved any.
    settings() { return profile.settings; },
    putSettings(s) { profile.settings = s; saveNow(); },

    // ---- stats ------------------------------------------------------------
    // The ACTIVE character's lifetime numbers; a call with no character
    // (nothing plays without one) counts on a throwaway so it never throws.
    stats() { const c = profile.chars[profile.active]; return c ? c.stats : blankStats(); },
    addWin() { this.stats().wins++; scheduleSave(); },
    addGold(n) { if (n > 0) { this.stats().gold += n; scheduleSave(); } },
    // one call per day the player sets foot in: day 1 as the eagles take off
    // (js/boot.js beginDrop), every later day at its dawn (js/sim.js) - counted
    // at the START of the day, so quitting mid-match keeps the days begun
    addDay() { this.stats().days++; scheduleSave(); },
    addMatch() { this.stats().matches++; scheduleSave(); }, // one per eagle takeoff (beginDrop)
    addKill() { this.stats().kills++; scheduleSave(); },    // a rival the local player downed (die, js/player.js)
    addDeath() { this.stats().deaths++; scheduleSave(); },  // the local player downed

    // ---- tech tree ----------------------------------------------------------
    // Ids in and out; what a node IS lives in js/tools.js. This file only
    // remembers which kinds have been held.
    techSeen(id) { return profile.tech.seen.indexOf(id) >= 0; },
    // fired from the pickup, so it is coalesced like the stat calls
    markSeen(id) {
      if (profile.tech.seen.indexOf(id) >= 0) return false;
      profile.tech.seen.push(id);
      scheduleSave();
      return true;
    },
    // back to an unmarked tree without losing the name or the stats behind it
    // - the only way to re-stage the page for a look at it (DBG.wipeTech)
    clearTech() {
      profile.tech.seen.length = 0;
      profile.tech.done.length = 0;
      saveNow();
    },

    flush,
  };

  // a coalesced write still pending when the tab goes away
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
})();
