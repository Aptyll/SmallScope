'use strict';
// ------------------------------------------------------------ badges
// The two badges a player wears beside their name: the FOUNDER's (a copy of
// Softfall bought before it went free to play, PROFILE.founder) and the
// RANKED tier their rating stands in. They stand under a profile's name
// (PF_BADGES, js/ui/profile.js) and the tier beside the rating on a RANKED
// party seat (drawRoomSeat, js/ui/rooms.js). Nothing in a match reads them.
// Another person's ride their player card (cardMine, js/app/history.js): the
// founder's as an id in `bd`, the tier off the rating `rk` and the RANKED
// matches played `rn`, so a person who never played RANKED wears no tier.

// ---- the tiers ------------------------------------------------------------
// RANKED's rating starts at PROFILE.RANK_START in the middle of BRONZE and
// moves RANK_STEP a match (js/ui/rooms.js); a tier is RANK_TIER_W wide, the
// lowest open below and the highest open above. Metals, in the order a smith
// would rank them, and the valley's ice at the top.
const RANK_TIERS = ['FLINT', 'IRON', 'BRONZE', 'SILVER', 'GOLD', 'CRYSTAL'];
const RANK_TIER_LOW = 850;  // FLINT ends here, IRON starts
const RANK_TIER_W = 150;    // each tier after
function rankTier(r) {
  return Math.max(0, Math.min(RANK_TIERS.length - 1, Math.floor((r - RANK_TIER_LOW) / RANK_TIER_W) + 1));
}

// ---- the art ----------------------------------------------------------------
// BADGE_PX square, lit from the up-left. Digits index the palette: 1 outline,
// 2 shadow, 3 the metal, 4 light, 5 highlight, 6 white (a gem's glint). A
// tier is the same shield with more on it: a mark, studs, wings, a crown, a gem.
const BADGE_PX = 16;
const BADGE_METAL = { // outline, shadow, metal, light, highlight
  FLINT: ['#141210', '#2e2a26', '#463f38', '#5e554c', '#7c7166'],
  IRON: ['#1a1d24', '#3e4552', '#58606e', '#76808f', '#9aa4b2'],
  BRONZE: ['#2a160a', '#6a3d1f', '#8e5530', '#b2733f', '#d49a62'],
  SILVER: ['#252a33', '#7d8794', '#a6b0bc', '#c9d1da', '#eef2f6'],
  GOLD: ['#3a2508', '#9a6c1c', '#c8962c', '#e8bd4a', '#ffe68e'],
  CRYSTAL: ['#10263d', '#2f74a8', '#4fa3d9', '#8fd0f2', '#e2f6ff'],
};
const RANK_ART = {
  FLINT: [
    '................',
    '................',
    '................',
    '...1111111111...',
    '...1555555541...',
    '...1533333321...',
    '...1533333321...',
    '...1533333321...',
    '...1533333321...',
    '....15333321....',
    '....14333321....',
    '.....143321.....',
    '......1421......',
    '.......11.......',
    '................',
    '................',
  ],
  IRON: [
    '................',
    '................',
    '................',
    '...1111111111...',
    '...1555555541...',
    '...1533113321...',
    '...1531111321...',
    '...1533113321...',
    '...1531111321...',
    '....11111111....',
    '....14311321....',
    '.....143321.....',
    '......1421......',
    '.......11.......',
    '................',
    '................',
  ],
  BRONZE: [
    '................',
    '................',
    '................',
    '...1111111111...',
    '...1155555511...',
    '...1533113321...',
    '...1531111321...',
    '...1533113321...',
    '...1531111321...',
    '....11111111....',
    '....14311321....',
    '.....143321.....',
    '......1421......',
    '.......11.......',
    '................',
    '................',
  ],
  SILVER: [
    '................',
    '................',
    '................',
    '...1111111111...',
    '1115555555555111',
    '.15333311333341.',
    '.14333111133321.',
    '..143331133321..',
    '...1531111321...',
    '....11111111....',
    '....14311321....',
    '.....143321.....',
    '......1421......',
    '.......11.......',
    '................',
    '................',
  ],
  GOLD: [
    '...1...11...1...',
    '...11.1541.11...',
    '...1515335141...',
    '...1553333521...',
    '1113333333333111',
    '.15333311333341.',
    '.14333111133321.',
    '..143331133321..',
    '...1531111321...',
    '....11111111....',
    '....14311321....',
    '.....143321.....',
    '......1421......',
    '.......11.......',
    '................',
    '................',
  ],
  CRYSTAL: [
    '...1...11...1...',
    '...11.1661.11...',
    '...1515335141...',
    '...1553333521...',
    '1113333333333111',
    '.15333311333341.',
    '.14333111133321.',
    '..143331133321..',
    '...1531111321...',
    '....11111111....',
    '....14311321....',
    '.....143321.....',
    '......1421......',
    '.......11.......',
    '................',
    '................',
  ],
};
// the founder's: the eagle's gold feather
const FOUNDER_ART = [
  '..........111...',
  '.........15541..',
  '........153121..',
  '.......1531321..',
  '......1531321...',
  '.....1531321....',
  '....1531321.....',
  '...1531321......',
  '...151321.......',
  '..151221........',
  '..11211.........',
  '.1121...........',
  '.141............',
  '141.............',
  '11..............',
  '................',
];
// each grid painted once onto its own canvas, on first use
const badgeCvs = {};
function badgeCanvas(key, rows, pal) {
  if (badgeCvs[key]) return badgeCvs[key];
  const cv = document.createElement('canvas');
  cv.width = cv.height = BADGE_PX;
  const g = cv.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const v = row.charCodeAt(x) - 48;
      if (v < 1 || v > 6) continue;
      g.fillStyle = v === 6 ? '#ffffff' : pal[v - 1];
      g.fillRect(x, y, 1, 1);
    }
  });
  return (badgeCvs[key] = cv);
}
function drawRankBadge(x, y, r) {
  const t = RANK_TIERS[rankTier(r)];
  ctx.drawImage(badgeCanvas(t, RANK_ART[t], BADGE_METAL[t]), Math.round(x), Math.round(y));
}
function drawFounderBadge(x, y) {
  ctx.drawImage(badgeCanvas('founder', FOUNDER_ART, BADGE_METAL.GOLD), Math.round(x), Math.round(y));
}

// ---- who wears what -----------------------------------------------------------
// c: a player card (PROFILE.people, NET.cards), or null for this screen's own
function wearsFounder(c) { return c ? Array.isArray(c.bd) && c.bd.indexOf('founder') >= 0 : PROFILE.founder(); }
function wearsRank(c) { return (c ? c.rn | 0 : PROFILE.rankedN()) > 0; }
function badgeRating(c) { return c ? c.rk | 0 : PROFILE.rank(); }

PF_BADGES.push(
  { id: 'founder', has: wearsFounder, draw: (x, y) => drawFounderBadge(x, y), name: () => 'FOUNDER' },
  { id: 'rank', has: wearsRank, draw: (x, y, c) => drawRankBadge(x, y, badgeRating(c)), name: (c) => RANK_TIERS[rankTier(badgeRating(c))] },
);
