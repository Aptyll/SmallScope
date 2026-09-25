// ------------------------------------------------------------ snow off the pines
// A pine's crown holds snow, and two things knock some of it loose: the heart
// of a gust passing over the tree, and a blow to the trunk (an axe or a shot).
// Either way the SIM raises the puff and it renders through burst(), which
// records itself for a host's clients (js/net/events.js) - so a client sees
// the same trees shed without running any of this.
//
// The gust half is sampled, not scanned: a scan would ask windGust() of every
// pine on the map every step. Instead each human in the match has a handful of
// tiles a second drawn at random from the view round them, and a draw that
// lands on a pine standing in the crest of a gust may shed it. Random draws,
// a random delay before the puff and a per-tree rest between two sheds are
// what stagger it: a gust front ripples through a stand instead of the whole
// stand letting go on one frame. A bot sees nothing, so a bot draws nothing.
const SHED_DRAWS = 36;         // tiles drawn per human per second
const SHED_RX = 20, SHED_RY = 12; // the half-extent drawn from, in tiles (about one view at the base zoom)
const SHED_CREST = 0.9;        // windGust() at or over this share of WIND_GUST_PEAK is the crest
const SHED_WIND = 0.25;        // under this much wind nothing sheds (a lull, a calm day, the night)
const SHED_P = 0.55;           // chance a crested pine sheds, times state.wind
const SHED_REST = 9;           // seconds a pine keeps what snow it has left before it can shed again
const SHED_DELAY = 0.7;        // a shed waits up to this long, so one draw's crest does not fire in step
const SHED_LIVE = 6;           // most gust puffs in the air at once; a blow's puff never waits on it
const SHED_LIFE = 1.3;         // what burst() makes of a puff's life (0.65..1.3 s)
const SHED_SPD = 36;           // the burst's spread: enough to open the puff to a crown's width before the damping stops it
const SHED_COL = '#ffffff';    // a shade over the crown's own snow, or a puff over the canopy is lost in it
// where the snow sits: the canopy reaches 21 px above the pine's tile (OBJECTS.tree)
const SHED_UP = 20;

const shedWait = []; // {o, t}: a crested pine counting down to its puff
let shedLive = [];   // the sim times the live gust puffs end at

// One puff off the pine's crown: a few flakes that fall slowly and ride the
// wind while they do. `n` is the flake count - a gust knocks off less than a blow.
function shedPuff(o, n) {
  const x = o.tx * TILE + 8, y = o.ty * TILE + 8 - SHED_UP;
  burst(x, y, SHED_COL, n, SHED_SPD, SHED_LIFE, 24, state.windDir * (4 + 14 * state.wind));
}

// A blow to a standing pine: the axe (chopTree, js/actions.js) or a shot that
// stops in it (the arrow loop's wall branch, js/sim.js). Always sheds, a
// little more than a gust does, and resets the tree's rest.
function shedHit(o) {
  if (!o || o.type !== 'tree') return;
  o.shedT = state.windT + SHED_REST;
  shedPuff(o, 9);
}

// Once per sim step (updatePlay). The clock is state.windT, the wind's own,
// so a shed's rest and the gust it answers are on one time.
function shedStep(dt) {
  const now = state.windT;
  if (shedLive.length) shedLive = shedLive.filter((t) => t > now);
  for (let i = shedWait.length - 1; i >= 0; i--) {
    const w = shedWait[i];
    if (now < w.t) continue;
    shedWait.splice(i, 1);
    // felled while it waited, or the air is full: the snow stays up there
    if (objAt(w.o.tx, w.o.ty) !== w.o || shedLive.length >= SHED_LIVE) continue;
    shedLive.push(now + SHED_LIFE);
    shedPuff(w.o, 6);
  }
  if (state.wind < SHED_WIND) return;
  const crest = SHED_CREST * WIND_GUST_PEAK;
  for (const p of players) {
    if (p.control === 'ai' || p.control === 'none' || !p.active || inAir(p)) continue;
    const cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE);
    // a fractional draw rolls for its last tile, so the rate holds at any step length
    let n = SHED_DRAWS * dt;
    for (; n > 0; n--) {
      if (n < 1 && rng() >= n) break;
      const tx = cx + Math.floor((rng() * 2 - 1) * SHED_RX), ty = cy + Math.floor((rng() * 2 - 1) * SHED_RY);
      if (!inWorld(tx, ty)) continue;
      const o = objAt(tx, ty);
      if (!o || o.type !== 'tree' || (o.shedT || 0) > now) continue;
      if (windGust(tx, ty) < crest || rng() >= SHED_P * state.wind) continue;
      o.shedT = now + SHED_REST;
      shedWait.push({ o, t: now + rng() * SHED_DELAY });
    }
  }
}
