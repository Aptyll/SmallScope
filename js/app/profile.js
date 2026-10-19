// The local player profile: who you are between matches.
//
// One object under one localStorage key (and the saved matches beside it,
// under keys of their own - see putSave), and THE ONLY PLACE THE GAME TOUCHES
// STORAGE. Everything else - game.js included - goes through window.PROFILE, so
// putting the profile on a server later is a change to this file and nothing
// else: swap the private read()/write() pair for requests, keep the surface
// below identical.
//
// There are no accounts, no passwords and no sign-in. A profile is ONE NAME
// and its lifetime stats, the hero last picked (so the pick opens on it),
// plus the flags, records and settings the player carries (moved here in v1;
// the old key is migrated once and removed). Heroes are picked per match and
// wear a fixed look (CLASSES, js/sim/player.js), so nothing here stores a
// body. v2's three character slots fold into v3's one profile on load: the
// active slot's name and hero, every slot's stats added together.
(function () {
  const KEY = 'softfall.profile';
  const SAVES_KEY = 'softfall.saves'; // the saved matches' index: { slot: meta }
  const SAVE_KEY = 'softfall.save.';  // + slot: one saved match's body
  const OLD_SETTINGS = 'softfall.settings'; // pre-profile saves; migrated once
  const NAME_MAX = 16;
  let quiet = false;               // PROFILE.quiet: the stats are not counting
  const HERO_N = 2;                // CLASSES.length (js/sim/player.js) - a hero index past this is repaired to 0
  // the coins a profile starts with: the cosmetics' purse, kept outside every
  // match (a match's gold never reaches it). What a coin buys is the skins
  // screen's table (js/ui/skins.js); this file only keeps the count and ids.
  const START_COINS = 100;
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
  function blankStats() {
    return { wins: 0, matches: 0, gold: 0, days: 0, kills: 0, deaths: 0 };
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
      v: 3,
      name: randomName(),
      stats: blankStats(),
      hero: 0,         // the hero last locked in (a CLASSES index): where the pick opens next time
      dropped: false,  // has this profile ever jumped off the eagle - gates the first-flight countdown
      bestLap: 0,      // the ice parkour's all-time best lap in seconds (0 = never lapped)
      bestRange: 0,    // the archery range's all-time best round score (0 = never played)
      bestRounds: {},  // ...and the bell's other rounds' (AG_ROUNDS, js/sim/practice.js), by round id - these three are all practice writes
      // The arsenal tree. A MATCH reads nothing back out of here - every kind
      // is unlocked for every profile alike - so the one live list is `seen`:
      // every `TECH` node id this profile has ever held, written from the
      // pickup and drawn as a pip on the node. `done` is the research a save
      // from before the unlock (PATCH 2.08) had bought; it is still carried
      // through so a veteran's record is not thrown away, and nothing reads it.
      tech: { seen: [], done: [] },
      // the cosmetics' purse and what it bought: coins, the owned ids, and
      // per slot ('bird') the id worn. A free cosmetic is never written to
      // `owned`, and an id the game no longer has is kept but never worn
      // (birdSkinFor, js/ui/skins.js, falls back to the free one).
      coins: START_COINS,
      owned: [],
      worn: {},
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
    NAME_MAX,

    // Read the store once, at boot, before anything asks for a name. Repairs a
    // partial or corrupt save against blank() rather than throwing, and folds a
    // pre-profile settings key in on the way past.
    load() {
      const s = read();
      profile = blank();
      if (s && typeof s === 'object') {
        profile.dropped = !!s.dropped;
        if (typeof s.bestLap === 'number' && isFinite(s.bestLap) && s.bestLap > 0) profile.bestLap = s.bestLap;
        if (typeof s.bestRange === 'number' && isFinite(s.bestRange) && s.bestRange > 0) profile.bestRange = Math.floor(s.bestRange);
        if (s.bestRounds && typeof s.bestRounds === 'object') {
          for (const k in s.bestRounds) {
            const n = s.bestRounds[k];
            if (/^[a-z]+$/.test(k) && typeof n === 'number' && isFinite(n) && n > 0) profile.bestRounds[k] = Math.floor(n);
          }
        }
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
        if (typeof hero === 'number' && isFinite(hero) && hero >= 0 && hero < HERO_N) profile.hero = Math.floor(hero);
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
        // a profile from before the purse arrives without it and keeps the
        // START_COINS blank() gave it, like a fresh one
        if (typeof s.coins === 'number' && isFinite(s.coins)) profile.coins = Math.max(0, Math.floor(s.coins));
        if (Array.isArray(s.owned)) {
          for (const id of s.owned) if (typeof id === 'string' && id.length <= ID_MAX && profile.owned.indexOf(id) < 0) profile.owned.push(id);
        }
        if (s.worn && typeof s.worn === 'object') {
          for (const k in s.worn) if (typeof s.worn[k] === 'string' && s.worn[k].length <= ID_MAX) profile.worn[k] = s.worn[k];
        }
      } else {
        // no profile yet: adopt the settings the player already had
        try {
          const old = JSON.parse(localStorage.getItem(OLD_SETTINGS));
          if (old && typeof old === 'object') profile.settings = old;
          localStorage.removeItem(OLD_SETTINGS);
        } catch (e) { }
        saveNow();
      }
      if (s && s.v !== 3) saveNow(); // a migrated save is written back in its new shape at once
      return profile;
    },

    get() { return profile; },
    validate,

    // ---- who you are --------------------------------------------------------
    // The one name every other player sees, and the hero the pick opens on.
    HERO_N,
    name() { return profile.name; },
    // Returns validate()'s result; on a refusal nothing is written.
    setName(raw) {
      const r = validate(raw);
      if (!r.ok) return r;
      if (profile.name !== r.name) { profile.name = r.name; saveNow(); }
      return r;
    },
    // a fresh winter word, unsaved: the profile card's die offers it
    rollName() { return randomName(); },
    hero() { return profile.hero; },
    setHero(i) {
      if (!(i >= 0 && i < HERO_N) || profile.hero === i) return;
      profile.hero = i | 0;
      saveNow();
    },

    // ---- first flight -------------------------------------------------------
    // whether this profile has ever left the eagle: false means the next ride
    // runs the PREPARE TO DROP countdown and jumps itself (js/sim/eagle.js)
    hasDropped() { return !!profile.dropped; },
    markDropped() { if (!profile.dropped) { profile.dropped = true; saveNow(); } },

    // the ice parkour's all-time best lap - one of the two things the arena
    // itself writes back (updatePractice, js/sim/practice.js). Stored at the plate's
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
    // (agEndRound, js/sim/practice.js). Whole points; only a strictly higher score
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
    // the bell's other rounds keep their records the same way, one per round id
    bestRound(id) { return profile.bestRounds[id] || 0; },
    setBestRound(id, n) {
      if (!(n > 0)) return false;
      const r = Math.floor(n);
      if (r <= (profile.bestRounds[id] || 0)) return false;
      profile.bestRounds[id] = r;
      saveNow();
      return true;
    },

    // ---- settings ---------------------------------------------------------
    // The live stored object, or null if this profile has never saved any.
    settings() { return profile.settings; },
    putSettings(s) { profile.settings = s; saveNow(); },

    // ---- stats ------------------------------------------------------------
    // The lifetime numbers; a quiet profile counts on a throwaway.
    stats() { return quiet ? blankStats() : profile.stats; },
    // a match the player only WATCHES (the bot ladder, js/ui/ladder.js) counts
    // on the throwaway too: until the page reloads, nothing reaches the stats
    quiet(on) { quiet = !!on; },
    addWin() { this.stats().wins++; scheduleSave(); },
    addGold(n) { if (n > 0) { this.stats().gold += n; scheduleSave(); } },
    // one call per day the player sets foot in: day 1 as the eagles take off
    // (js/sim/eagle.js beginDrop), every later day at its dawn (js/sim/sim.js) - counted
    // at the START of the day, so quitting mid-match keeps the days begun
    addDay() { this.stats().days++; scheduleSave(); },
    addMatch() { this.stats().matches++; scheduleSave(); }, // one per eagle takeoff (beginDrop)
    addKill() { this.stats().kills++; scheduleSave(); },    // a rival the local player downed (die, js/sim/player.js)
    addDeath() { this.stats().deaths++; scheduleSave(); },  // the local player downed

    // ---- cosmetics ----------------------------------------------------------
    // The purse and the wardrobe. Prices and what an id IS live in the
    // callers' tables (BIRD_SKINS, js/sprites/eagle.js); every write here is
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
    // a finished match's pay (payMatchCoins, js/ui/skins.js): a moment, so it saves through
    addCoins(n) { n = Math.floor(n) || 0; if (n > 0) { profile.coins += n; saveNow(); } },
    // DBG only: set the purse (a staged screenshot, a test of the short purse)
    setCoins(n) { profile.coins = Math.max(0, Math.floor(n) || 0); saveNow(); },

    // ---- tech tree ----------------------------------------------------------
    // Ids in and out; what a node IS lives in js/sim/tools.js. This file only
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

    // ---- saved matches ------------------------------------------------------
    // A save is a whole solo match frozen mid-play (js/sim/save.js builds and
    // reads it; this file only keeps it). The slots' METAS - what the lists
    // print: hero, level, clock, when, the thumbnail - live together under
    // one index key, so a list never opens a body; each BODY is its own key,
    // because a body is the big one and a quota refusal must cost one slot,
    // not the whole index.
    saveMetas() {
      try { const m = JSON.parse(localStorage.getItem(SAVES_KEY)); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; }
    },
    saveBody(slot) {
      try { return localStorage.getItem(SAVE_KEY + slot); } catch (e) { return null; }
    },
    // false when storage refused it (full, or blocked): the old slot stands
    putSave(slot, meta, body) {
      try {
        localStorage.setItem(SAVE_KEY + slot, body);
        const m = this.saveMetas(); m[slot] = meta;
        localStorage.setItem(SAVES_KEY, JSON.stringify(m));
        return true;
      } catch (e) { return false; }
    },
    dropSave(slot) {
      try {
        localStorage.removeItem(SAVE_KEY + slot);
        const m = this.saveMetas(); delete m[slot];
        localStorage.setItem(SAVES_KEY, JSON.stringify(m));
      } catch (e) { }
    },
    // a slot's card rewritten in place (its name), the body untouched
    putSaveMeta(slot, meta) {
      try {
        const m = this.saveMetas();
        if (!m[slot]) return false;
        m[slot] = meta;
        localStorage.setItem(SAVES_KEY, JSON.stringify(m));
        return true;
      } catch (e) { return false; }
    },
    // two slots trade places, either of them possibly empty (the list's
    // reordering): bodies first, then the index in one write. The two
    // bodies are held while they move, so a refusal halfway (storage full)
    // puts both back as they were and the swap simply did not happen.
    swapSaves(a, b) {
      let ba = null, bb = null;
      const put = (k, v) => { if (v !== null) localStorage.setItem(SAVE_KEY + k, v); else localStorage.removeItem(SAVE_KEY + k); };
      try {
        ba = localStorage.getItem(SAVE_KEY + a); bb = localStorage.getItem(SAVE_KEY + b);
        const m = this.saveMetas(), ma = m[a], mb = m[b];
        localStorage.removeItem(SAVE_KEY + a); localStorage.removeItem(SAVE_KEY + b);
        put(a, bb); put(b, ba);
        if (mb) m[a] = mb; else delete m[a];
        if (ma) m[b] = ma; else delete m[b];
        localStorage.setItem(SAVES_KEY, JSON.stringify(m));
        return true;
      } catch (e) {
        try { localStorage.removeItem(SAVE_KEY + a); localStorage.removeItem(SAVE_KEY + b); put(a, ba); put(b, bb); } catch (e2) { }
        return false;
      }
    },

    flush,
  };

  // a coalesced write still pending when the tab goes away
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
})();
