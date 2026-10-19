'use strict';
// The sky the sim reads: the day's weather and the one wind field.
// ------------------------------------------------------------ weather
// Every day of a match has one weather, rolled off the world seed and the
// day's number (hash2 - nothing rolls on a stream), so every client that knows
// the day knows the sky and the wire carries nothing new. A weather is only a
// row of DIALS the air already reads: how much of the snow is falling, how
// hard the wind blows and how far its gusts swing, how strong the loose-snow
// sweep is, how much ground blizzard skims the drifts (drawDrift,
// js/draw/ground.js), and how much frost is on the light (todGrade and
// drawFrostGlint, js/draw/light.js). state.wx holds the dials in force and
// eases them from where they were to the new day's row over WX_FADE seconds,
// so the dawn that changes the sky fades it in instead of snapping it. Night
// still stills the air whatever the day rolled: windAmp squares the daylight
// under every row.
const WEATHERS = {
  // snow: share of the flakes falling; wind: the field's strength; gust: how
  // far its envelope swings; sweep: the 15 s sweep; drift: the ground
  // blizzard; frost: the clear cold's grade and glints
  calm:     { snow: 0.4,  wind: 0.35, gust: 0.6,  sweep: 0, drift: 0, frost: 0 },
  snow:     { snow: 1,    wind: 1,    gust: 1,    sweep: 1, drift: 0, frost: 0 },
  blizzard: { snow: 0.22, wind: 1.6,  gust: 1.35, sweep: 0, drift: 1, frost: 0 },
  frost:    { snow: 0,    wind: 0.3,  gust: 0.6,  sweep: 0, drift: 0, frost: 1 },
};
const WX_DIALS = ['snow', 'wind', 'gust', 'sweep', 'drift', 'frost'];
// how often each weather comes up; the shares sum to 1
const WX_ODDS = [['snow', 0.35], ['calm', 0.25], ['frost', 0.2], ['blizzard', 0.2]];
const WX_FADE = 5; // s the dawn takes to turn one day's weather into the next
// The day's weather by name. The practice arena keeps today's ordinary snow:
// it has one fixed hour, and a blizzard over its instruments would change
// what they measure.
function weatherOf(day) {
  if (PRACTICE) return 'snow';
  let h = hash2(day * 7 + 3, 0x3a7f), k = 0;
  while (k < WX_ODDS.length - 1 && h >= WX_ODDS[k][1]) h -= WX_ODDS[k++][1];
  return WX_ODDS[k][0];
}
// THE READ for any other system the weather should reach (the ground's drifts,
// trampled snow, the ice): the dials in force this frame - name, snow, wind,
// gust, sweep, drift, frost, each 0..1 but wind (to 1.6) and gust (to 1.35) -
// already mid-fade at a dawn. Read it, never write it; a reader that wants the
// wind itself takes state.wind / windGust, which carry these dials already.
function weatherNow() { return state.wx; }
// Steps the dials; updateFx runs it above the wind. The first step of a page
// snaps to the day's row - a match opens on its weather, it does not fade in.
function stepWeather(dt) {
  const wx = state.wx, name = state.wxForce || weatherOf(state.day);
  if (name !== wx.name) {
    const first = wx.name === null;
    wx.from = {};
    for (const d of WX_DIALS) wx.from[d] = wx[d];
    wx.name = name; wx.k = first ? 1 : 0;
  }
  if (wx.k >= 1 && !wx.from) return;
  wx.k = Math.min(1, wx.k + dt / WX_FADE);
  const to = WEATHERS[name], e = wx.k * wx.k * (3 - 2 * wx.k);
  for (const d of WX_DIALS) wx[d] = wx.from[d] + (to[d] - wx.from[d]) * e;
  if (wx.k >= 1) wx.from = null;
}

// ------------------------------------------------------------ wind
// One wind field, and everything the weather moves reads it: the snow's drift,
// and how far over every pine on the field is leaning (treeFrame,
// js/draw-world.js). It is not one number and it is not one wave: a single
// travelling sine over the tile grid is a marching stripe, and a forest does
// not do that. What crosses the field is a SUM OF WAVES on different bearings,
// the way an ocean surface is - three fast ripples carrying the rustle, under a
// two-wave gust envelope deciding where the air is actually moving at all. No
// period here is a multiple of another, so no two crests ever meet twice in the
// same place and the pattern over the treeline never repeats. It dies with the
// light: windAmp() squares the daylight, so the air goes still over dusk and by
// full dark every tree is standing in its own rest pose.
//
// THE SHARED WIND is three reads, and anything new the air should move takes
// them rather than a clock of its own: state.windDir (which way, -1..1),
// state.wind (how hard, 0..1, the day's weather already in it) and
// windGust(tx, ty) (the gust passing over that tile right now). windSway() is
// what a pine makes of the three.
//
// What the field hands back is a SIGNED LEAN, not a phase - a pine's frames are
// a ladder from thrown-left to thrown-right - and that is what lets a gust read
// as a body of moving air instead of a shimmer. Three things make it read that
// way, and they are the three terms of windSway():
//
//   the LEAN     air pushes one way. A stand inside a gust is bent downwind and
//                held there for as long as the gust is on it, which is the part
//                you actually watch cross the treeline; it eases back upright
//                in the lull behind. This is the DC term, and the reason the
//                field is signed rather than an amplitude. Which way is downwind
//                VEERS over minutes (windVeer) - so a stand leans left for a
//                while, stands up as the air swings, then leans right - and it
//                is one answer for the whole map, because a prevailing wind is
//                a property of the day and not of a tile.
//   the RUSTLE   the crowns work about that lean, and only as hard as the air
//                on them - it is multiplied by the same gust, so a tree in a
//                lull barely stirs while one in the front is thrashing. It is
//                small enough against the lean that a gusted tree stays
//                downwind of vertical, the way a real one does.
//   the ARRIVAL  a gust is not a sine. It hits in about a third of its cycle
//                and takes the other two thirds to let go, so the envelope's
//                waves are SKEWED (wskew) rather than plain. That asymmetry is
//                most of what separates a front arriving from the whole forest
//                breathing in and out.
//
// A wave is (kx, ky) rad per TILE - the bearing is the vector and its length is
// the wavelength - plus rad/s of travel and a share of the amplitude. The three
// ripple bearings are deliberately spread: two run with the prevailing
// down-right air, the third cuts across it, and that crossing is what breaks a
// front into patches instead of bands.
// The amplitudes deliberately sum past 1: three waves at random phase mostly
// cancel, so a set that summed to exactly 1 would leave the forest permanently
// half-hearted. At 1.44 the ordinary rustle is a quiver of a frame or two and a
// gust that lands all three crests together throws that crown right over.
const WIND_R1X = 0.29, WIND_R1Y = 0.19, WIND_R1S = 2.40, WIND_R1A = 0.72;
const WIND_R2X = 0.16, WIND_R2Y = -0.33, WIND_R2S = 1.61, WIND_R2A = 0.42;
const WIND_R3X = 0.47, WIND_R3Y = 0.41, WIND_R3S = 3.07, WIND_R3A = 0.30;
// The crests are BENT before they travel. Plain sines added together give
// straight parallel fronts crossing each other - a plaid, which is exactly what
// air does not look like - so one long slow wave is folded into the spatial
// phase of all three ripples at once (phase modulation, the same trick FM
// synthesis is). It meanders the whole rustle together, so the fronts wander
// over the field instead of ruling lines across it.
const WIND_WX = 0.021, WIND_WY = 0.034, WIND_WS = 0.27, WIND_WARP = 2.6;
// The gust envelope: two waves an order of magnitude longer than the ripples
// (~56 and ~66 tiles against ~18), one running with the air and one across it.
// Summing them is what makes a gust a PATCH of field rather than a stripe of
// it. Their wavelength is set against the VIEW, not the world: about two
// screens each, so the near trees are already laid over while the far ones are
// still standing and you SEE the front travel. Much longer and a gust stops
// being something that crosses the treeline and becomes the weather; much
// shorter and neighbouring trees stop agreeing, which is a shimmer again.
// The speeds carry them at ~8 and ~6 tiles/s, a few seconds to cross a screen.
const WIND_G1X = 0.094, WIND_G1Y = 0.062, WIND_G1S = 0.95, WIND_G1A = 0.60;
const WIND_G2X = -0.052, WIND_G2Y = 0.080, WIND_G2S = 0.57, WIND_G2A = 0.40;
// How far the envelope's waves lean forward in time: 0 is a plain sine, and at
// 0.7 a gust spends ~32% of its cycle arriving and ~68% dying away. A wind
// gauge draws that shape and a sine does not, and it is what makes the eye read
// a front hitting rather than a swell passing.
const WIND_SKEW = 0.7;
// The envelope's floor and its peak. The floor is set against the VIEW: a
// screen is barely wider than one gust, so a floor near zero would leave a
// player parked in a lull staring at a dead forest for seconds at a time. The
// peak deliberately overshoots 1, so the heart of a gust runs into the soft
// knee below and lays those trees right over - a gust that only ever reached
// the same lean as ordinary air would not read as a gust at all.
const WIND_LULL = 0.26, WIND_GUST_PEAK = 1.30;
// The split between the two terms. LEAN is the push, RUSTLE the work about it,
// and RUSTLE is the smaller of the two once the ripples' typical (not peak) sum
// is allowed for - a gusted crown that swung back upwind of vertical every half
// second would read as a metronome, not as wind.
const WIND_LEAN = 0.52, WIND_RUSTLE = 0.55;
// The veer: how long the air takes to swing right round, and how hard that
// swing is overdriven into its clamp. At 1.7 the wind holds a steady quarter
// for most of a swing and crosses the still middle in about nine seconds,
// which is what a veer looks like - rather than a forest forever drifting
// through vertical, which is what a plain sine would give.
const WIND_VEER = 47, WIND_VEER_HOLD = 1.7;
// Where a crown starts running out of travel. Under this the lean is linear;
// over it a rational knee eases it toward 1 without ever reaching it, so a peak
// gust bends the tree to the end of its ladder and the rustle still shows on
// top. A hard clamp there instead would FREEZE the worst-hit trees at full
// lean, which is the one moment they should look busiest.
const WIND_SOFT = 0.70;
const WIND_SWELL = 31, WIND_SWELL2 = 19; // s: the field's two breathing periods, coprime
const WIND_STILL = 0.02;              // under this the trees simply stand up straight

// A 256-entry sine table, and it is what lets the field afford to be six waves:
// windSway() is read once per visible pine per frame and does eight lookups
// rather than eight Math.sin calls. Its answer is quantised to one of
// twenty-four frames, so a table is exact enough, and the cost stays flat when a
// zoomed-out view is holding a thousand trees. Negative phases are fine - the
// truncation then mask wraps them, at the price of an error a 256th of a cycle
// wide, which no tree can show.
const WSIN = new Float32Array(256);
for (let i = 0; i < 256; i++) WSIN[i] = Math.sin(i / 256 * Math.PI * 2);
function wsin(a) { return WSIN[((a * (256 / (Math.PI * 2))) | 0) & 255]; }
// The same wave with its own value folded into its phase, which leans it
// forward: the rise steepens and the fall stretches, and a gust gets an edge.
// Two lookups, no transcendentals, still -1..1.
function wskew(a) { return wsin(a + WIND_SKEW * wsin(a)); }

// The field's strength right now, 0..1; updateFx parks it in state.wind. Two
// swells on coprime periods rather than one, so the day's weather rises and
// falls without ever settling into a rhythm you could count.
// The day's weather scales it (state.wx.wind) and it is clamped at 1, so a
// blizzard spends most of its day at full strength rather than past it.
function windAmp() {
  const day = 1 - state.darkness, t = state.windT;
  const a = day * day * state.wx.wind * (0.52 + 0.30 * wsin(t * (Math.PI * 2 / WIND_SWELL))
    + 0.18 * wsin(t * (Math.PI * 2 / WIND_SWELL2) + 1.7));
  return a > 1 ? 1 : a;
}

// Which way the air is running right now, -1..1. Stepped once per frame in
// updateFx and parked in state.windDir, because it is the same answer for every
// tile on the map - windSway() would otherwise pay for it a thousand times a
// frame to be told the same thing.
function windVeer() {
  const v = WIND_VEER_HOLD * wsin(state.windT * (Math.PI * 2 / WIND_VEER));
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

// The signed lean at a tile, -1..1, where +1 is a crown thrown fully to the
// right: a gust envelope, a push downwind scaled by it, and the ripples working
// about that push and scaled by it too. Read the three terms in the banner
// above.
// Both halves ride the SAME envelope, which is the whole point - trees ahead of
// a gust standing up, trees inside it laid over and thrashing, trees behind it
// easing back - instead of the forest rustling on one clock.
// The gust over a tile right now: WIND_LULL in the calm between gusts, up to
// WIND_GUST_PEAK in the heart of one (the day's weather widens or narrows that
// swing, state.wx.gust). Where this corner of the field is in the gust,
// arriving fast and letting go slow; the smoothstep widens the calm and
// squares up the shoulders, so the eye reads a front with an inside and an
// outside. It is not scaled by state.wind - a reader multiplies the two. A
// pine's lean reads it below, and the snow it sheds reads its crest
// (shedStep, js/sim/shed.js).
function windGust(tx, ty) {
  const t = state.windT;
  const e = 0.5 + 0.5 * (WIND_G1A * wskew(tx * WIND_G1X + ty * WIND_G1Y + t * WIND_G1S)
    + WIND_G2A * wskew(tx * WIND_G2X + ty * WIND_G2Y + t * WIND_G2S));
  return WIND_LULL + (WIND_GUST_PEAK - WIND_LULL) * state.wx.gust * (e * e * (3 - 2 * e));
}

function windSway(tx, ty) {
  const w = state.wind;
  if (w <= WIND_STILL) return 0;
  const t = state.windT;
  const gust = windGust(tx, ty);
  // the rustle: three crossing ripples on a wandering phase
  const bend = WIND_WARP * wsin(tx * WIND_WX + ty * WIND_WY + t * WIND_WS);
  const r = WIND_R1A * wsin(tx * WIND_R1X + ty * WIND_R1Y + t * WIND_R1S + bend)
    + WIND_R2A * wsin(tx * WIND_R2X + ty * WIND_R2Y + t * WIND_R2S + bend)
    + WIND_R3A * wsin(tx * WIND_R3X + ty * WIND_R3Y + t * WIND_R3S + bend);
  const s = w * gust * (WIND_LEAN * state.windDir + WIND_RUSTLE * r);
  // the soft knee, taken on the magnitude so it works both ways
  const a = s < 0 ? -s : s;
  if (a <= WIND_SOFT) return s;
  const u = (a - WIND_SOFT) / (1 - WIND_SOFT);
  const c = WIND_SOFT + (1 - WIND_SOFT) * u / (1 + u);
  return s < 0 ? -c : c;
}

// The SWEEP: every SWEEP_EVERY seconds the air lifts a little loose snow and
// drifts it slowly downwind over the valley - a few faint streaks laid in the
// world, gone again well before the next (drawSweep, js/draw/ground.js). Not a gust and not weather
// of its own: it rides the field's clock (windT), runs the way the air is
// running (windDir), and is only as strong as the day's air (windAmp), so it
// fades out over dusk with everything else.
const SWEEP_EVERY = 15;  // s from one sweep to the next
const SWEEP_T = 7;       // s a sweep takes to drift across
const SWEEP_MIN = 0.1;   // no sweep while the field is weaker than this
// the sweep on now: { k: 0..1 across, n: which one (its streaks' seed), dir: +1
// blowing right, -1 left, w: the air's strength behind it }, or null. Its way
// is the veer's at the moment it set off, held to the end: the veer can cross
// still air in mid-sweep, and a streak must not jump to the other side.
function windSweep() {
  if (state.wind < SWEEP_MIN) return null;
  const n = Math.floor(state.windT / SWEEP_EVERY);
  const k = (state.windT - n * SWEEP_EVERY) / SWEEP_T;
  if (k >= 1) return null;
  const dir = wsin(n * SWEEP_EVERY * (Math.PI * 2 / WIND_VEER)) < 0 ? -1 : 1; // windVeer's sign then
  return { k, n, dir, w: state.wind };
}
